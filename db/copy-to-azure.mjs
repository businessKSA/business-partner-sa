#!/usr/bin/env node
// Business Partner — نسخ بيانات Supabase إلى Azure Database for PostgreSQL،
// ثم قراءة مزدوجة تتحقّق من التطابق قبل تبديل الكتابة (ops/azure/README.md §5،
// الخطوة 3).
//
// المصدر يُقرأ عبر PostgREST بالمفتاح الخدمي (نفس ما تفعله api/_db.js)، لأن
// الوصول المباشر إلى Postgres على Supabase مغلق من هذه البيئة. والهدف Postgres
// حقيقي عبر `pg`، بالتجمّع نفسه وخيارات TLS نفسها التي في api/_azpg.js.
//
// الاستعمال:
//   node db/copy-to-azure.mjs                    # نسخ ثم تحقّق
//   node db/copy-to-azure.mjs --dry-run          # الخطة والأعداد فقط، بلا كتابة
//   node db/copy-to-azure.mjs --verify           # مقارنة فقط، بلا كتابة
//   node db/copy-to-azure.mjs --tables=users,organizations --batch=200
//   node db/copy-to-azure.mjs --since=2026-09-01T00:00:00Z   # دفعة فرقية
//
// البيئة: SUPABASE_URL + SUPABASE_SERVICE_KEY (أو SUPABASE_SERVICE_ROLE_KEY)
// للمصدر، وAZURE_PG_URL للهدف (+ AZURE_PG_SSL وAZURE_PG_SSL_REJECT_UNAUTHORIZED
// كما في api/_azpg.js). لا يُطبع سرٌّ أبداً — أسماء المضيفين فقط.
//
// القواعد التي لا تُكسر:
//   * الهدف لا يكون Supabase أبداً (مضيفه لا يحتوي "supabase")؛ القاعدة الحيّة
//     تُقرأ ولا تُكتب.
//   * النسخ متكرّر بلا ضرر: INSERT … ON CONFLICT (pk) DO UPDATE، فإعادة التشغيل
//     تُصلح ما اختلف ولا تكرّر شيئاً.
//   * الترتيب من المفاتيح الخارجية على الهدف (الأب قبل الابن)، وكل جدول في
//     معاملة واحدة: إمّا يصل كاملاً أو لا يصل.
//   * التحقّق يُقارن كل صفّ بكل صفّ، لا الأعداد فقط.
//
// رمز الخروج: 0 تطابق تام، 1 عدم تطابق أو خطأ تخطيط، 2 خطأ استعمال/بيئة.
import crypto from "node:crypto";

// ------------------------------------------------------------------ المعاملات --
const USAGE = `node db/copy-to-azure.mjs [--tables=a,b] [--dry-run] [--verify] [--batch=N] [--since=<ISO>]`;
const args = { tables: null, dryRun: false, verify: false, batch: 500, since: null };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, ""];
  if (k === "--tables") args.tables = v.split(",").map((s) => s.trim()).filter(Boolean);
  else if (k === "--dry-run") args.dryRun = true;
  else if (k === "--verify") args.verify = true;
  else if (k === "--batch") args.batch = Math.max(1, Number(v) || 0);
  else if (k === "--since") args.since = v;
  else if (k === "--help" || k === "-h") { console.log(USAGE); process.exit(0); }
  else { console.error(`معامل غير معروف: ${a}\n${USAGE}`); process.exit(2); }
}
if (!args.batch) { console.error("--batch يجب أن يكون رقماً موجباً"); process.exit(2); }
if (args.since && Number.isNaN(Date.parse(args.since))) { console.error(`--since ليس تاريخاً مفهوماً: ${args.since}`); process.exit(2); }
const SINCE = args.since ? new Date(args.since).toISOString() : null;

// ----------------------------------------------------------------- البيئة --
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const AZURE_PG_URL = String(process.env.AZURE_PG_URL || "").trim();

function die(msg) { console.error(msg); process.exit(2); }
function hostOf(url) { try { return new URL(url).host; } catch { return ""; } }
if (!SUPABASE_URL) die("المصدر غير مضبوط: SUPABASE_URL");
if (!SUPABASE_KEY) die("مفتاح المصدر غير مضبوط: SUPABASE_SERVICE_KEY (أو SUPABASE_SERVICE_ROLE_KEY)");
if (!AZURE_PG_URL) die("الهدف غير مضبوط: AZURE_PG_URL");
const SRC_HOST = hostOf(SUPABASE_URL);
const DST_HOST = hostOf(AZURE_PG_URL);
if (!SRC_HOST) die("SUPABASE_URL ليس رابطاً صالحاً");
if (!DST_HOST) die("AZURE_PG_URL ليس رابط اتصال Postgres صالحاً (postgres://user:pass@host:5432/db)");
// الحارس الأهم: لا يُكتب في Supabase أبداً، مهما كانت المتغيّرات.
if (/supabase/i.test(DST_HOST)) die(`مرفوض: مضيف الهدف "${DST_HOST}" هو Supabase — هذا السكربت يقرأ القاعدة الحيّة ولا يكتب فيها.`);

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const ident = (name) => {
  const s = String(name || "");
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`معرّف غير صالح "${s}"`);
  return `"${s}"`;
};
const warn = (m) => console.warn(`  ⚠ ${m}`);

// ------------------------------------------------------- المصدر: PostgREST --
// أخطاء PostgREST تُرمى بحالتها وأول 200 حرف من ردّها، بلا مفتاح ولا رابط كامل.
const parseTotal = (cr) => { const m = /\/(\d+|\*)$/.exec(String(cr || "")); return m && m[1] !== "*" ? Number(m[1]) : null; };
async function rest(path, { range, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" };
  if (range) { headers["Range-Unit"] = "items"; headers.Range = range; }
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await r.text();
  const total = parseTotal(r.headers.get("content-range"));
  if (r.status === 416) return { rows: [], total };          // مدى بعد نهاية الجدول = لا شيء
  if (!r.ok) throw new Error(`PostgREST ${r.status} على ${path.split("?")[0]}: ${text.slice(0, 200)}`);
  let rows = [];
  try { rows = text ? JSON.parse(text) : []; } catch { throw new Error(`PostgREST ردّ بغير JSON على ${path.split("?")[0]}: ${text.slice(0, 200)}`); }
  return { rows: Array.isArray(rows) ? rows : [], total };
}

/** أسماء الجداول (والمشاهد) المكشوفة على المصدر، من جذر OpenAPI. */
async function sourceTables() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const text = await r.text();
  if (!r.ok) throw new Error(`PostgREST ${r.status} على /rest/v1/: ${text.slice(0, 200)}`);
  let spec; try { spec = JSON.parse(text); } catch { throw new Error(`جذر PostgREST ليس JSON: ${text.slice(0, 200)}`); }
  const defs = spec && spec.definitions && typeof spec.definitions === "object" ? Object.keys(spec.definitions) : [];
  if (!defs.length) throw new Error("جذر PostgREST بلا definitions — هل المفتاح خدمي (service_role)؟ المفتاح المجهول لا يرى الجداول.");
  return defs.sort();
}

// مرشّح --since على المصدر: بحسب ما في الجدول من created_at/updated_at.
// جدول بلا أيّهما يُنسخ كاملاً ويُقال ذلك — النسخ الكامل آمن لأنه upsert.
function sinceFilter(cols) {
  if (!SINCE) return { qs: "", sql: "", note: "" };
  const has = ["created_at", "updated_at"].filter((c) => cols.has(c));
  const v = encodeURIComponent(SINCE);
  if (!has.length) return { qs: "", sql: "", note: "بلا created_at/updated_at — يُنسخ كاملاً رغم --since" };
  if (has.length === 2) return { qs: `&or=(created_at.gte.${v},updated_at.gte.${v})`, sql: ` WHERE "created_at" >= $1 OR "updated_at" >= $1`, note: "" };
  return { qs: `&${has[0]}=gte.${v}`, sql: ` WHERE ${ident(has[0])} >= $1`, note: "" };
}

/** عدد صفوف المصدر بدقّة، من ترويسة Content-Range. */
async function sourceCount(t, filter) {
  const { total } = await rest(`${t}?select=*${filter.qs}`, { range: "0-0", prefer: "count=exact" });
  if (total === null) throw new Error(`PostgREST لم يُرجع عدداً لـ${t} (Content-Range بلا مجموع)`);
  return total;
}

/** صفحات المصدر مرتّبةً بالمفتاح الأساسي؛ بلا مفتاح يُستعمل offset/limit. */
async function* sourcePages(t, pk, filter) {
  let from = 0;
  for (;;) {
    let res;
    if (pk.length) {
      const order = pk.map((c) => `${c}.asc`).join(",");
      res = await rest(`${t}?select=*&order=${order}${filter.qs}`, { range: `${from}-${from + args.batch - 1}` });
    } else {
      res = await rest(`${t}?select=*&offset=${from}&limit=${args.batch}${filter.qs}`);
    }
    if (!res.rows.length) return;
    yield res.rows;
    from += res.rows.length;
    if (res.total !== null && from >= res.total) return;
  }
}

// ------------------------------------------------------------ الهدف: pg --
// نفس محلّلات الأنواع في api/_azpg.js: الأوقات نصوص ISO، وnumeric/int8 أرقام —
// فتُقارَن قيم الهدف بقيم PostgREST على صيغة واحدة.
const OID = { DATE: 1082, TIMESTAMP: 1114, TIMESTAMPTZ: 1184, NUMERIC: 1700, INT8: 20 };
const TS_RE = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)(?:([+-]\d\d)(?::?(\d\d))?)?$/;
function pgTextToIso(s) {
  if (s === null || s === undefined) return s;
  const m = TS_RE.exec(String(s));
  if (!m) return String(s);
  const [, d, t, tzH, tzM] = m;
  if (!tzH) return `${d}T${t}`;
  return `${d}T${t}${tzH}:${tzM || "00"}`;
}
let pool = null;
async function db() {
  if (pool) return pool;
  const pg = (await import("pg")).default;
  const base = pg.types;
  const parsers = new Map([
    [OID.TIMESTAMPTZ, pgTextToIso], [OID.TIMESTAMP, pgTextToIso], [OID.DATE, (s) => String(s)],
    [OID.NUMERIC, (s) => Number(s)], [OID.INT8, (s) => Number(s)],
  ]);
  pool = new pg.Pool({
    connectionString: AZURE_PG_URL,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    ssl: String(process.env.AZURE_PG_SSL || "1") === "0"
      ? false
      : String(process.env.AZURE_PG_SSL_REJECT_UNAUTHORIZED || "1") === "0"
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true },
    types: { getTypeParser: (oid, format) => (format === "text" && parsers.has(oid) ? parsers.get(oid) : base.getTypeParser(oid, format)) },
  });
  pool.on("connect", (client) => { client.query("SET timezone TO 'UTC'").catch(() => {}); });
  pool.on("error", (e) => console.error("pg pool", String(e.message || e).slice(0, 200)));
  return pool;
}

/** بنية الهدف من information_schema: الجداول، الأعمدة، المفاتيح، العلاقات. */
async function targetMeta(client) {
  const tables = await client.query(
    "select table_name, table_type from information_schema.tables where table_schema = current_schema() and table_type in ('BASE TABLE','VIEW')",
  );
  const base = new Set(tables.rows.filter((r) => r.table_type === "BASE TABLE").map((r) => r.table_name));
  const views = new Set(tables.rows.filter((r) => r.table_type === "VIEW").map((r) => r.table_name));

  const cols = await client.query(
    "select table_name, column_name, data_type, udt_name, column_default from information_schema.columns " +
    "where table_schema = current_schema() order by table_name, ordinal_position",
  );
  const columns = new Map();   // table → Map(col → {type, udt, default})
  for (const r of cols.rows) {
    if (!columns.has(r.table_name)) columns.set(r.table_name, new Map());
    columns.get(r.table_name).set(r.column_name, { type: r.data_type, udt: r.udt_name, default: r.column_default });
  }

  const pks = await client.query(
    "select tc.table_name, kcu.column_name from information_schema.table_constraints tc " +
    "join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema " +
    "where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = current_schema() order by tc.table_name, kcu.ordinal_position",
  );
  const pk = new Map();        // table → [cols]
  for (const r of pks.rows) { if (!pk.has(r.table_name)) pk.set(r.table_name, []); pk.get(r.table_name).push(r.column_name); }

  const fks = await client.query(
    "select tc.constraint_name, tc.table_name as child, kcu.column_name as child_col, " +
    "pk.table_name as parent, pkcu.column_name as parent_col, tc.is_deferrable " +
    "from information_schema.referential_constraints rc " +
    "join information_schema.table_constraints tc on tc.constraint_name = rc.constraint_name and tc.constraint_schema = rc.constraint_schema " +
    "join information_schema.key_column_usage kcu on kcu.constraint_name = rc.constraint_name and kcu.constraint_schema = rc.constraint_schema " +
    "join information_schema.table_constraints pk on pk.constraint_name = rc.unique_constraint_name and pk.constraint_schema = rc.unique_constraint_schema " +
    "join information_schema.key_column_usage pkcu on pkcu.constraint_name = pk.constraint_name and pkcu.constraint_schema = pk.constraint_schema " +
    "  and pkcu.ordinal_position = kcu.position_in_unique_constraint " +
    "where tc.table_schema = current_schema() order by tc.table_name, tc.constraint_name, kcu.ordinal_position",
  );
  const fk = fks.rows.map((r) => ({ name: r.constraint_name, child: r.child, childCol: r.child_col, parent: r.parent, parentCol: r.parent_col, deferrable: r.is_deferrable === "YES" }));
  return { base, views, columns, pk, fk };
}

// ------------------------------------------------------------------ الترتيب --
// كان (Kahn): الأب قبل الابن. ما يبقى بعده حلقةٌ: تُنسخ أعضاؤها في معاملة
// واحدة بـSET CONSTRAINTS ALL DEFERRED إن كانت قيودها كلها قابلة للتأجيل،
// وإلا يُبلَّغ بوضوح ويتوقف السكربت — لا تخمين في ترتيب بيانات العملاء.
// المرجع الذاتي (جدول يشير إلى نفسه) لا يدخل الرسم؛ يُعالَج بالمرور المتعدد.
function planOrder(selected, fk) {
  const set = new Set(selected);
  const edges = fk.filter((e) => set.has(e.child) && set.has(e.parent) && e.child !== e.parent);
  const indeg = new Map(selected.map((t) => [t, 0]));
  const children = new Map(selected.map((t) => [t, new Set()]));
  const seen = new Set();
  for (const e of edges) {
    const key = `${e.parent}>${e.child}`;
    if (seen.has(key)) continue;
    seen.add(key);
    children.get(e.parent).add(e.child);
    indeg.set(e.child, indeg.get(e.child) + 1);
  }
  const order = [];
  let ready = selected.filter((t) => indeg.get(t) === 0).sort();
  while (ready.length) {
    const t = ready.shift();
    order.push(t);
    for (const c of [...children.get(t)].sort()) {
      indeg.set(c, indeg.get(c) - 1);
      if (indeg.get(c) === 0) { ready.push(c); ready.sort(); }
    }
  }
  const cycle = selected.filter((t) => !order.includes(t)).sort();
  const groups = order.map((t) => ({ tables: [t], deferred: false }));
  let problem = null;
  if (cycle.length) {
    const inCycle = edges.filter((e) => cycle.includes(e.child) && cycle.includes(e.parent));
    const hard = inCycle.filter((e) => !e.deferrable);
    if (hard.length) {
      problem = `حلقة مفاتيح خارجية بين: ${cycle.join(", ")} — قيود غير قابلة للتأجيل: ` +
        [...new Set(hard.map((e) => `${e.child}.${e.childCol}→${e.parent} (${e.name})`))].join("، ") +
        `. اجعلها DEFERRABLE في db/schema.sql أو انسخ الجداول بـ--tables على مراحل.`;
    } else {
      groups.push({ tables: cycle, deferred: true });
    }
  }
  return { order: groups.flatMap((g) => g.tables), groups, cycle, problem };
}

// ------------------------------------------------------------------- القيم --
/** قيمة جاهزة للإرسال بحسب نوع عمود الهدف (كما في api/_azpg.js encodeValue). */
function encodeValue(v, col) {
  if (v === undefined || v === null) return null;
  const type = col ? col.type : "";
  if (type === "json" || type === "jsonb") return JSON.stringify(v);
  if (type === "ARRAY") return Array.isArray(v) ? v : [v];
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
}

// تطبيع القيم للمقارنة: الوقت رقماً (Date.parse)، والرقم رقماً ولو جاء نصاً،
// وJSON بمفاتيح مرتّبة. يُطبَّق على الطرفين بالتساوي، فالاختلاف الباقي حقيقي.
const deepSorted = (v) => {
  if (Array.isArray(v)) return v.map(deepSorted);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, deepSorted(v[k])]));
  return v;
};
const NUMERIC_TYPES = /^(numeric|integer|bigint|smallint|double precision|real|decimal|money)$/;
const TIME_TYPES = /^(timestamp|date$)/;
function normScalar(v) {
  if (typeof v === "string") {
    if (/^\d{4}-\d\d-\d\d(?:[T ]\d\d:\d\d)/.test(v)) { const p = Date.parse(v); if (!Number.isNaN(p)) return p; }
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  }
  return v;
}
function normValue(v, col) {
  if (v === null || v === undefined) return null;
  const type = col ? col.type : "";
  if (type === "json" || type === "jsonb") return deepSorted(v);
  if (TIME_TYPES.test(type)) { const p = Date.parse(v); return Number.isNaN(p) ? String(v) : p; }
  if (NUMERIC_TYPES.test(type)) return Number(v);
  if (type === "boolean") return v === true || v === "true" || v === "t";
  if (type === "ARRAY") return (Array.isArray(v) ? v : [v]).map(normScalar);
  if (type === "text" || type === "character varying" || type === "uuid") return v;
  return normScalar(v);
}
const jsonOf = (v) => JSON.stringify(v === undefined ? null : v);

// --------------------------------------------------------------------- النسخ --
/**
 * ينسخ جدولاً واحداً داخل معاملة المستدعي: صفحات من المصدر، upsert بالمفتاح
 * الأساسي على الهدف. يُرجع { source, copied, dropped }.
 */
async function copyTable(client, t, meta, filter) {
  const cols = meta.columns.get(t);
  const pk = meta.pk.get(t) || [];
  const selfRef = meta.fk.filter((e) => e.child === t && e.parent === t);
  let insertCols = null;
  let dropped = [];
  let copied = 0, source = 0;
  const buffered = [];   // للجداول ذات المرجع الذاتي فقط

  for await (const page of sourcePages(t, pk, filter)) {
    source += page.length;
    if (!insertCols) {
      const srcKeys = new Set(page.flatMap((r) => Object.keys(r)));
      insertCols = [...cols.keys()].filter((c) => srcKeys.has(c));
      dropped = [...srcKeys].filter((c) => !cols.has(c)).sort();
      if (dropped.length) warn(`${t}: أعمدة على المصدر لا يعرفها الهدف، أُسقطت: ${dropped.join(", ")}`);
      const missingPk = pk.filter((c) => !insertCols.includes(c));
      if (missingPk.length) throw new Error(`${t}: المفتاح الأساسي (${missingPk.join(", ")}) غير موجود في صفوف المصدر`);
    }
    if (selfRef.length) buffered.push(...page);
    else copied += await upsert(client, t, insertCols, pk, cols, page);
  }
  if (selfRef.length && buffered.length) copied += await upsertSelfRef(client, t, insertCols, pk, cols, buffered, selfRef);
  return { source, copied, dropped };
}

/** إدراج متعدّد الصفوف بـON CONFLICT، مجزّأً حتى لا يتجاوز سقف المعاملات (65535). */
async function upsert(client, t, insertCols, pk, cols, rows) {
  if (!rows.length) return 0;
  const chunk = Math.max(1, Math.min(args.batch, Math.floor(60000 / insertCols.length)));
  const updates = insertCols.filter((c) => !pk.includes(c));
  let conflict;
  if (!pk.length) conflict = " ON CONFLICT DO NOTHING";
  else if (!updates.length) conflict = ` ON CONFLICT (${pk.map(ident).join(", ")}) DO NOTHING`;
  else conflict = ` ON CONFLICT (${pk.map(ident).join(", ")}) DO UPDATE SET ${updates.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`;
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const vals = [];
    const tuples = part.map((row) => "(" + insertCols.map((c) => { vals.push(encodeValue(row[c], cols.get(c))); return `$${vals.length}`; }).join(", ") + ")");
    const sql = `INSERT INTO ${ident(t)} (${insertCols.map(ident).join(", ")}) VALUES ${tuples.join(", ")}${conflict}`;
    const r = await client.query(sql, vals);
    n += r.rowCount || 0;
  }
  return n;
}

/**
 * جدول يشير إلى نفسه: مرورٌ تلو مرور — أولاً الصفوف التي مرجعها null أو موجود
 * فعلاً على الهدف، ثم ما صار مرجعه موجوداً، حتى لا يبقى شيء. مرجعٌ معلّق لا
 * يجد أباه أبداً يوقف الجدول باسم أول خمسة مفاتيح.
 */
async function upsertSelfRef(client, t, insertCols, pk, cols, rows, selfRef) {
  const present = new Map(selfRef.map((e) => [e.parentCol, new Set()]));
  for (const col of present.keys()) {
    const r = await client.query(`SELECT ${ident(col)} AS v FROM ${ident(t)}`);
    for (const row of r.rows) present.get(col).add(String(row.v));
  }
  let remaining = rows, n = 0;
  while (remaining.length) {
    const ready = remaining.filter((r) => selfRef.every((e) => r[e.childCol] == null || present.get(e.parentCol).has(String(r[e.childCol]))));
    if (!ready.length) {
      const keys = remaining.slice(0, 5).map((r) => pk.map((c) => r[c]).join("|"));
      throw new Error(`${t}: ${remaining.length} صفّاً مرجعها الذاتي لا يشير إلى صفّ موجود — أول المفاتيح: ${keys.join(", ")}`);
    }
    n += await upsert(client, t, insertCols, pk, cols, ready);
    for (const r of ready) for (const e of selfRef) if (r[e.parentCol] != null) present.get(e.parentCol).add(String(r[e.parentCol]));
    remaining = remaining.filter((r) => !ready.includes(r));
  }
  return n;
}

/** إعادة ضبط المتتاليات لأعمدة nextval() — بلا ذلك يفشل أول إدراج جديد بتكرار مفتاح. */
async function resetSequences(client, tables, meta) {
  let n = 0;
  for (const t of tables) {
    for (const [c, col] of meta.columns.get(t)) {
      if (!/^nextval\(/.test(String(col.default || ""))) continue;
      await client.query(
        `SELECT setval(pg_get_serial_sequence(format('%I.%I', current_schema(), $1::text), $2::text), coalesce((SELECT max(${ident(c)}) FROM ${ident(t)}), 1))`,
        [t, c],
      );
      n++;
    }
  }
  return n;
}

// ------------------------------------------------------------------ التحقّق --
/**
 * القراءة المزدوجة: كل الصفوف من الطرفين، مطبّعةً ومُختصرةً بـsha256، وتُقارن
 * بالمفتاح الأساسي (أو كمجموعة بلا ترتيب حين لا مفتاح). الترتيب على المصدر
 * والهدف قد يختلف لاختلاف ترتيب النصوص (collation)، فالمقارنة بالمفتاح لا
 * بالموضع.
 */
async function verifyTable(client, t, meta, filter) {
  const cols = meta.columns.get(t);
  const pk = meta.pk.get(t) || [];
  const params = filter.sql ? [SINCE] : [];
  const srcCount = await sourceCount(t, filter);
  const tgtCount = Number((await client.query(`SELECT count(*)::int AS n FROM ${ident(t)}${filter.sql}`, params)).rows[0].n);

  const src = [];
  for await (const page of sourcePages(t, pk, filter)) src.push(...page);
  const tgt = [];
  const orderBy = pk.length ? ` ORDER BY ${pk.map(ident).join(", ")}` : "";
  for (let off = 0; ; off += args.batch) {
    const r = await client.query(`SELECT * FROM ${ident(t)}${filter.sql}${orderBy} LIMIT ${args.batch} OFFSET ${off}`, params);
    tgt.push(...r.rows);
    if (r.rows.length < args.batch) break;
  }

  // الأعمدة المقارَنة: ما يعرفه الهدف ويُرجعه المصدر معاً.
  const srcKeys = new Set(src.flatMap((r) => Object.keys(r)));
  const compare = [...cols.keys()].filter((c) => srcKeys.has(c) || !src.length);
  const norm = (row) => Object.fromEntries(compare.map((c) => [c, normValue(row[c], cols.get(c))]));
  const keyOf = (row) => pk.map((c) => jsonOf(normValue(row[c], cols.get(c)))).join("|");

  const mismatches = [];   // { key, cols }
  if (pk.length) {
    const tmap = new Map(tgt.map((r) => { const n = norm(r); return [keyOf(r), { n, h: sha256(JSON.stringify(n)) }]; }));
    const seen = new Set();
    for (const r of src) {
      const k = keyOf(r), n = norm(r), h = sha256(JSON.stringify(n));
      seen.add(k);
      const o = tmap.get(k);
      if (!o) { mismatches.push({ key: k, cols: ["(غائب على الهدف)"] }); continue; }
      if (o.h !== h) mismatches.push({ key: k, cols: compare.filter((c) => jsonOf(n[c]) !== jsonOf(o.n[c])) });
    }
    for (const k of tmap.keys()) if (!seen.has(k)) mismatches.push({ key: k, cols: ["(زائد على الهدف)"] });
  } else {
    const count = (rows) => { const m = new Map(); for (const r of rows) { const h = sha256(JSON.stringify(norm(r))); m.set(h, (m.get(h) || 0) + 1); } return m; };
    const a = count(src), b = count(tgt);
    for (const [h, n] of a) if ((b.get(h) || 0) !== n) mismatches.push({ key: h.slice(0, 12), cols: ["(عدد مختلف، بلا مفتاح)"] });
    for (const [h, n] of b) if (!a.has(h)) mismatches.push({ key: h.slice(0, 12), cols: [`(زائد على الهدف ×${n})`] });
  }
  return { srcCount, tgtCount, srcRows: src.length, tgtRows: tgt.length, mismatches };
}

// ------------------------------------------------------------------ التقرير --
function printTable(rows, head) {
  const widths = head.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => "  " + r.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(line(head));
  console.log("  " + widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(r));
}

// ------------------------------------------------------------------- التنفيذ --
async function main() {
  const mode = args.dryRun ? "dry-run" : args.verify ? "verify" : "copy+verify";
  console.log(`copy-to-azure — الوضع: ${mode} | المصدر: ${SRC_HOST} | الهدف: ${DST_HOST} | batch=${args.batch}${SINCE ? ` | since=${SINCE}` : ""}`);

  const src = await sourceTables();
  const p = await db();
  const client = await p.connect();
  let exitCode = 0;
  try {
    const meta = await targetMeta(client);
    const schema = (await client.query("select current_schema() s")).rows[0].s;
    const srcSet = new Set(src);
    const common = src.filter((t) => meta.base.has(t));
    const sourceOnly = src.filter((t) => !meta.base.has(t) && !meta.views.has(t));
    const targetOnly = [...meta.base].filter((t) => !srcSet.has(t)).sort();
    console.log(`المخطّط على الهدف: ${schema} — ${meta.base.size} جدولاً و${meta.views.size} مشهداً؛ على المصدر ${src.length} تعريفاً؛ المشترك ${common.length}.`);
    if (sourceOnly.length) console.log(`  ⚠ على المصدر ولا مقابل لها على الهدف (تُضاف إلى db/schema.sql قبل التبديل): ${sourceOnly.join(", ")}`);
    if (targetOnly.length) console.log(`  ℹ على الهدف بلا مصدر (لا بأس): ${targetOnly.join(", ")}`);

    let selected = common;
    if (args.tables) {
      const unknown = args.tables.filter((t) => !common.includes(t));
      if (unknown.length) throw Object.assign(new Error(`--tables: ليست جداول مشتركة: ${unknown.join(", ")}`), { exitCode: 2 });
      selected = common.filter((t) => args.tables.includes(t));
    }
    if (!selected.length) throw Object.assign(new Error("لا جداول مشتركة بين المصدر والهدف"), { exitCode: 2 });

    const plan = planOrder(selected, meta.fk);
    if (args.tables) {
      const outside = meta.fk.filter((e) => selected.includes(e.child) && !selected.includes(e.parent) && e.child !== e.parent).map((e) => `${e.child}→${e.parent}`);
      if (outside.length) warn(`جداول مختارة تشير إلى جداول خارج الاختيار (يفشل الإدراج إن غاب الأب): ${[...new Set(outside)].join(", ")}`);
    }
    const filters = new Map(selected.map((t) => [t, sinceFilter(meta.columns.get(t))]));
    for (const t of plan.order) if (filters.get(t).note) console.log(`  ℹ ${t}: ${filters.get(t).note}`);
    const noPk = plan.order.filter((t) => !(meta.pk.get(t) || []).length);
    if (noPk.length) warn(`جداول بلا مفتاح أساسي (ON CONFLICT DO NOTHING؛ إعادة التشغيل قد تكرّر صفوفها): ${noPk.join(", ")}`);

    console.log(`الترتيب (${plan.order.length} جدولاً، الأب قبل الابن):`);
    let i = 0;
    for (const g of plan.groups) {
      for (const t of g.tables) console.log(`  ${String(++i).padStart(2)}. ${t}${g.deferred ? "  [حلقة — قيود مؤجّلة]" : ""}  pk=(${(meta.pk.get(t) || []).join(",") || "—"})`);
    }
    if (plan.problem) throw Object.assign(new Error(plan.problem), { exitCode: 1 });

    if (args.dryRun) {
      const rows = [];
      let total = 0;
      for (const t of plan.order) { const n = await sourceCount(t, filters.get(t)); total += n; rows.push([t, n]); }
      printTable(rows, ["الجدول", "صفوف المصدر"]);
      console.log(`الخلاصة (dry-run): ${plan.order.length} جدولاً، ${total} صفّاً على المصدر — لم يُكتب شيء.`);
      return 0;
    }

    const stats = new Map();
    if (!args.verify) {
      console.log("النسخ:");
      for (const g of plan.groups) {
        await client.query("BEGIN");
        try {
          if (g.deferred) await client.query("SET CONSTRAINTS ALL DEFERRED");
          for (const t of g.tables) {
            const s = await copyTable(client, t, meta, filters.get(t));
            stats.set(t, s);
            console.log(`  ${t}: ${s.source} → ${s.copied}`);
          }
          await client.query("COMMIT");
        } catch (e) {
          await client.query("ROLLBACK").catch(() => {});
          throw new Error(`فشل نسخ ${g.tables.join(", ")} (أُلغيت المعاملة): ${String(e.message || e).slice(0, 300)}`);
        }
      }
      const seq = await resetSequences(client, plan.order, meta);
      console.log(`  المتتاليات المُعاد ضبطها: ${seq}`);
    }

    console.log("التحقّق (قراءة مزدوجة):");
    const report = [];
    let totalMismatch = 0, totalSrc = 0, totalCopied = 0;
    for (const t of plan.order) {
      const v = await verifyTable(client, t, meta, filters.get(t));
      const s = stats.get(t);
      totalMismatch += v.mismatches.length;
      totalSrc += v.srcCount;
      totalCopied += s ? s.copied : 0;
      report.push([t, v.srcCount, s ? s.copied : "—", v.tgtCount, v.mismatches.length]);
      if (v.srcCount !== v.srcRows) warn(`${t}: عدد المصدر ${v.srcCount} لكن المقروء ${v.srcRows} — تغيّر الجدول أثناء القراءة؟`);
      if (v.mismatches.length) {
        console.log(`  ✗ ${t}: ${v.mismatches.length} صفّاً غير متطابق — أول ${Math.min(5, v.mismatches.length)}:`);
        for (const m of v.mismatches.slice(0, 5)) console.log(`      ${m.key}: ${m.cols.join(", ")}`);
      }
    }
    console.log("");
    printTable(report, ["الجدول", "المصدر", "المنسوخ", "الهدف", "غير متطابق"]);
    const ok = totalMismatch === 0;
    console.log(`الخلاصة: ${plan.order.length} جدولاً، ${totalSrc} صفّاً على المصدر، ${args.verify ? "بلا نسخ" : `${totalCopied} منسوخاً`}، ${totalMismatch} غير متطابق — ${ok ? "متطابق ✓" : "غير متطابق ✗"}`);
    exitCode = ok ? 0 : 1;
  } finally {
    client.release();
    await p.end();
  }
  return exitCode;
}

main().then((code) => process.exit(code)).catch(async (e) => {
  console.error(`خطأ: ${String(e && e.message || e).slice(0, 500)}`);
  if (pool) await pool.end().catch(() => {});
  process.exit(e && e.exitCode ? e.exitCode : 1);
});
