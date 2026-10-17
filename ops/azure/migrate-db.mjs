#!/usr/bin/env node
// Business Partner — نقل بيانات قاعدة Postgres إلى Azure Database for PostgreSQL مباشرةً (Postgres → Postgres).
//
// متى يُستعمل ولماذا بجانب db/copy-to-azure.mjs:
//   • db/copy-to-azure.mjs ينسخ قاعدة الموقع (Supabase) عبر PostgREST — ولا يصلح لقاعدة لا PostgREST عندها.
//   • هذا الأداة تتصل بمصدر Postgres مباشرةً (SOURCE_PG_URL)، فتصلح لقاعدة لوحة العروض `bp-quotes` (Prisma)،
//     ولقاعدة الموقع نفسها إن فُتح الاتصال المباشر (من Cloud Shell: مُجمِّع Supabase على المنفذ 5432 يعمل بـIPv4).
//   • المصدر يُقرأ داخل معاملة REPEATABLE READ للقراءة فقط: لقطة متّسقة واحدة لكل الجداول (لا يملكها نسخ PostgREST).
//   • القيم تُنقل نصّاً كما يعيدها Postgres ثم تُحوَّل بنوع عمود الهدف (jsonb وarray وnumeric وtimestamp بلا فقد).
//
// الاستعمال:
//   node ops/azure/migrate-db.mjs --dry-run                  الخطة والأعداد فقط، بلا كتابة
//   node ops/azure/migrate-db.mjs                            نسخ ثم تحقّق
//   node ops/azure/migrate-db.mjs --verify                   تحقّق فقط (العدّ + بصمة كل جدول)
//   --tables=a,b   جداول بعينها      --batch=N   حجم الدفعة (500)      --schema=public
//   --skip-missing يتجاوز جداول المصدر غير الموجودة في الهدف بدل الرفض
//   --clean        يُفرغ جداول الهدف المخطَّطة ثم ينسخ (مرآة دقيقة تلتقط المحذوف في المصدر؛ قبل التبديل فقط)
//   --replace-nopk يستبدل محتوى جدول بلا مفتاح أساسي في الهدف (لإعادة نسخ الفرق قبل التبديل فقط)
//   --from-file=<json>   مصدر ملف محلي {"جدول":[صفوف]} (للتجربة بلا اتصال؛ مثل db/seed.local.json)
//   --schema-file=<sql>  يصف الهدف من ملف SQL بدل الاتصال (لـ--dry-run بلا أي اتصال)
//
// البيئة: SOURCE_PG_URL (المصدر، قراءة فقط) و AZURE_PG_URL (الهدف)، + SOURCE_PG_SSL/AZURE_PG_SSL=0 لخادم محلي،
//        + *_SSL_REJECT_UNAUTHORIZED=0 لشهادة ذاتية التوقيع. لا تُطبع قيمة أبداً: أسماء الجداول والأعداد
//        وأسماء المضيفين فقط (وبصمات قصيرة لمفاتيح الصفوف المختلفة).
//
// القواعد التي لا تُكسر:
//   * الهدف لا يكون المصدر ولا مضيف Supabase/Neon؛ والمصدر لا يُكتب فيه (معاملة READ ONLY).
//   * النسخ متكرّر بلا ضرر: INSERT … ON CONFLICT (pk) DO UPDATE؛ جدول بلا مفتاح أساسي يُنسخ إلى هدف فارغ فقط.
//   * الأب قبل الابن بحسب المفاتيح الخارجية على الهدف؛ كل جدول في معاملة واحدة.
//
// رمز الخروج: 0 تطابق/نجاح، 1 عدم تطابق أو فشل نسخ، 2 خطأ استعمال/بيئة.

import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// ------------------------------------------------------------- أدوات عامة --
export const ident = (name) => {
  const s = String(name ?? "");
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(s)) throw new Error(`معرّف غير صالح "${s.slice(0, 40)}"`);
  return `"${s}"`;
};
const redact = (m) => String(m || "").replace(/postgres(?:ql)?:\/\/[^@\s]*@/gi, "postgres://***@").slice(0, 300);
export const hostOf = (url) => { try { const u = new URL(url); return `${u.hostname}:${u.port || 5432}${u.pathname}`; } catch { return ""; } };
const shortHash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 8);
const FORBIDDEN_TARGET = /(supabase\.(co|com)|pooler\.supabase|neon\.tech|neon\.build)/i;

// ------------------------------------------------- وصف الهدف من ملف المخطّط --
/** أقسام قائمة مفصولة بفواصل على المستوى الأعلى (يتجاهل الفواصل داخل الأقواس). */
function splitTop(s) {
  const out = []; let depth = 0; let cur = ""; let q = false;
  for (const ch of s) {
    if (ch === "'") q = !q;
    if (!q) { if (ch === "(") depth++; if (ch === ")") depth--; }
    if (ch === "," && depth === 0 && !q) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * يقرأ `create table` من ملف SQL (db/schema.sql أو مخرجات prisma migrate diff) ويعيد وصف الهدف:
 * { tables: Map(name → {columns: Map(col → {type, generated, identity}), pk}), fks:[{child, parent, childCols, deferrable}] }.
 * تحليل نصّي كافٍ للتخطيط وغير الكتابة؛ الاتصال الحقيقي (pgTarget.meta) هو المرجع عند النسخ.
 */
export function parseSchemaSql(sql) {
  const text = String(sql).replace(/--[^\n]*/g, "");
  const tables = new Map(); const fks = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(/gi;
  let m;
  while ((m = re.exec(text))) {
    let i = re.lastIndex, depth = 1;
    while (i < text.length && depth > 0) { if (text[i] === "(") depth++; else if (text[i] === ")") depth--; i++; }
    const name = m[1];
    const body = text.slice(re.lastIndex, i - 1);
    const columns = new Map(); let pk = [];
    for (const part of splitTop(body)) {
      const pkc = /^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]*)\)/i.exec(part);
      if (pkc) { pk = pkc[1].split(",").map((x) => x.replace(/["\s]/g, "")); continue; }
      const fkc = /^(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+"?(?:public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)/i.exec(part);
      if (fkc) { fks.push({ child: name, parent: fkc[2], childCols: fkc[1].split(",").map((x) => x.replace(/["\s]/g, "")), deferrable: /deferrable/i.test(part) && !/not\s+deferrable/i.test(part) }); continue; }
      if (/^(constraint|unique|check|exclude|like)\b/i.test(part)) continue;
      const col = /^"?([A-Za-z_][A-Za-z0-9_]*)"?\s+([A-Za-z_][A-Za-z0-9_ ]*?(?:\[\])*)(?:\s*\(|\s+(?:not|null|default|primary|references|unique|check|generated|constraint)\b|$)/i.exec(part);
      if (!col) continue;
      columns.set(col[1], { type: col[2].trim().toLowerCase(), generated: /generated\s+always\s+as\s*\(/i.test(part), identity: /generated\s+always\s+as\s+identity/i.test(part) ? "a" : /generated\s+by\s+default\s+as\s+identity/i.test(part) ? "d" : "" });
      if (/\bprimary\s+key\b/i.test(part)) pk = [col[1]];
      const ref = /references\s+"?(?:public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)/i.exec(part);
      if (ref) fks.push({ child: name, parent: ref[1], childCols: [col[1]], deferrable: /deferrable/i.test(part) && !/not\s+deferrable/i.test(part) });
    }
    tables.set(name, { columns, pk });
  }
  // أعمدة أُضيفت لاحقاً: alter table X add column [if not exists] c type …  (الملف idempotent ويُراكم أعمدته هكذا)
  const alter = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:"?public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s+([^;]*);/gi;
  let a;
  while ((a = alter.exec(text))) {
    const tb = tables.get(a[1]);
    if (!tb) continue;
    for (const part of splitTop(a[2])) {
      const add = /^add\s+column\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s+([A-Za-z_][A-Za-z0-9_ ]*?(?:\[\])*)(?:\s*\(|\s+(?:not|null|default|primary|references|unique|check|generated|constraint)\b|$)/i.exec(part);
      const addFk = /^add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+"?(?:public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)/i.exec(part);
      if (addFk) { fks.push({ child: a[1], parent: addFk[2], childCols: addFk[1].split(",").map((x) => x.replace(/["\s]/g, "")), deferrable: /deferrable/i.test(part) && !/not\s+deferrable/i.test(part) }); continue; }
      if (!add) continue;
      tb.columns.set(add[1], { type: add[2].trim().toLowerCase(), generated: /generated\s+always\s+as\s*\(/i.test(part), identity: "" });
      const ref = /references\s+"?(?:public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)/i.exec(part);
      if (ref) fks.push({ child: a[1], parent: ref[1], childCols: [add[1]], deferrable: /deferrable/i.test(part) && !/not\s+deferrable/i.test(part) });
    }
  }
  return { tables, fks };
}

// ------------------------------------------------------------------ الخطة --
/** كان (Kahn): الأب قبل الابن. المرجع الذاتي لا يدخل الرسم (يُعالَج داخل الجدول). ما يبقى حلقةٌ بين جداول. */
export function planOrder(selected, fks) {
  const set = new Set(selected);
  const edges = fks.filter((e) => set.has(e.child) && set.has(e.parent) && e.child !== e.parent);
  const indeg = new Map(selected.map((t) => [t, 0]));
  const children = new Map(selected.map((t) => [t, new Set()]));
  const seen = new Set();
  for (const e of edges) {
    const k = `${e.parent}>${e.child}`;
    if (seen.has(k)) continue;
    seen.add(k); children.get(e.parent).add(e.child); indeg.set(e.child, indeg.get(e.child) + 1);
  }
  const order = [];
  let ready = selected.filter((t) => indeg.get(t) === 0).sort();
  while (ready.length) {
    const t = ready.shift();
    order.push(t);
    for (const c of [...children.get(t)].sort()) { indeg.set(c, indeg.get(c) - 1); if (indeg.get(c) === 0) { ready.push(c); ready.sort(); } }
  }
  const cycle = selected.filter((t) => !order.includes(t)).sort();
  const hard = edges.filter((e) => cycle.includes(e.child) && cycle.includes(e.parent) && !e.deferrable);
  return { order, cycle, problem: cycle.length ? `حلقة مفاتيح خارجية بين: ${cycle.join(", ")}${hard.length ? " — بقيود غير قابلة للتأجيل؛ اجعلها DEFERRABLE أو انسخ الجداول بـ--tables على مراحل" : ""}` : null };
}

/**
 * يجمع وصف المصدر والهدف في خطة. sourceInfo: Map(table → {count, columns:Set}).
 * لا يكتب ولا يقرأ قيماً.
 */
export function buildPlan(sourceInfo, meta, { only = null, skipMissing = false } = {}) {
  const system = (t) => /^_prisma/i.test(t);
  let names = [...sourceInfo.keys()].filter((t) => !system(t)).sort();
  if (only) names = names.filter((t) => only.includes(t));
  const missingOnTarget = names.filter((t) => !meta.tables.has(t));
  const selected = names.filter((t) => meta.tables.has(t));
  const ord = planOrder(selected, meta.fks);
  const rows = ord.order.map((t) => {
    const tcols = meta.tables.get(t).columns;
    const scols = sourceInfo.get(t).columns || new Set();
    return {
      table: t, source: sourceInfo.get(t).count,
      extraOnSource: [...scols].filter((c) => !tcols.has(c)).sort(),
      notOnSource: [...tcols.keys()].filter((c) => scols.size && !scols.has(c) && !tcols.get(c).generated).sort(),
      pk: meta.tables.get(t).pk,
    };
  });
  const errors = [];
  if (ord.problem) errors.push(ord.problem);
  if (missingOnTarget.length && !skipMissing) errors.push(`جداول في المصدر غير موجودة في الهدف: ${missingOnTarget.join(", ")} — أنشئها أولاً (prisma db push أو db/schema.sql) أو مرّر --skip-missing`);
  if (only) for (const t of only) if (!sourceInfo.has(t)) errors.push(`--tables: الجدول ${t} غير موجود في المصدر`);
  return { order: ord.order, cycle: ord.cycle, rows, missingOnTarget, skippedSystem: [...sourceInfo.keys()].filter(system).sort(), errors };
}

// ----------------------------------------------------- ترميز القيم للهدف --
const pgArrayLiteral = (arr) => `{${arr.map((v) => (v === null || v === undefined ? "NULL" : Array.isArray(v) ? pgArrayLiteral(v) : `"${String(typeof v === "object" ? JSON.stringify(v) : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)).join(",")}}`;
/** قيمة مصدر JSON (من ملف) → معامل نصّي لعمود الهدف. قيم المصدر Postgres تصل نصّاً جاهزاً فلا تمرّ من هنا. */
export function encodeForColumn(v, col) {
  if (v === null || v === undefined) return null;
  const type = col && col.type ? col.type : "";
  if (/^jsonb?$/.test(type)) return typeof v === "string" ? v : JSON.stringify(v);
  if (/\[\]$/.test(type) || type === "array") return Array.isArray(v) ? pgArrayLiteral(v) : String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// -------------------------------------------------------------- النسخ ----
/** ترتيب صفوف جدول يشير إلى نفسه: الأب قبل الابن، بمفتاح أساسي مفرد وعمود إشارة واحد. بلا حلقة ممكنة. */
export function orderSelfRef(rows, pkCol, fkCol) {
  const byPk = new Map(rows.map((r) => [String(r[pkCol]), r]));
  const done = new Set(); const out = []; const visiting = new Set();
  const visit = (r) => {
    const id = String(r[pkCol]);
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error("حلقة في المرجع الذاتي داخل الجدول");
    visiting.add(id);
    const parent = r[fkCol] === null || r[fkCol] === undefined ? null : byPk.get(String(r[fkCol]));
    if (parent) visit(parent);
    visiting.delete(id); done.add(id); out.push(r);
  };
  rows.forEach(visit);
  return out;
}

/**
 * ينسخ كل جدول في الخطة. source: {pages(t, pk, batch), textual}، target: {meta, upsert(t, cols, rows, opts), begin, commit, rollback, count}.
 * يعيد [{table, source, copied}].
 */
export async function runCopy({ plan, source, target, meta, batch = 500, replaceNoPk = false, clean = false, log = () => {} }) {
  const results = [];
  if (clean) {
    // مرآة دقيقة: يُفرَّغ الهدف (الجداول المخطَّطة وحدها، بلا CASCADE) ثم يُنسخ. يلتقط ما حُذف من المصدر منذ النسخة السابقة،
    // وهو ما لا يلتقطه upsert. للهدف قبل التبديل فقط.
    await target.begin();
    try { await target.truncate(plan.order); await target.commit(); } catch (e) { await target.rollback().catch(() => {}); throw new Error(`--clean: ${redact(e.message)}`); }
    log(`  ⟲ --clean: أُفرغ الهدف (${plan.order.length} جدولاً) قبل النسخ`);
  }
  for (const t of plan.order) {
    const info = meta.tables.get(t);
    const row = plan.rows.find((r) => r.table === t);
    const replacing = !info.pk.length && (await target.count(t)) > 0;
    if (replacing && !replaceNoPk) throw new Error(`${t}: بلا مفتاح أساسي والهدف غير فارغ — لا نسخ آمن (إعادة التشغيل ستكرّر الصفوف). مرّر --replace-nopk لاستبدال محتواه (قبل التبديل فقط)`);
    const selfFk = meta.fks.find((e) => e.child === t && e.parent === t);
    let copied = 0, read = 0; let buffered = [];
    await target.begin();
    try {
      if (replacing) { await target.clear(t); log(`  ↻ ${t}: بلا مفتاح أساسي — استُبدل محتوى الهدف (--replace-nopk)`); }
      for await (const page of source.pages(t, info.pk, batch)) {
        read += page.length;
        if (selfFk && info.pk.length === 1 && selfFk.childCols.length === 1) buffered.push(...page);
        else copied += await target.upsert(t, page, { columns: info.columns, pk: info.pk, textual: !!source.textual, skip: row.extraOnSource });
      }
      if (buffered.length) {
        const ordered = orderSelfRef(buffered, info.pk[0], selfFk.childCols[0]);
        for (let i = 0; i < ordered.length; i += batch) copied += await target.upsert(t, ordered.slice(i, i + batch), { columns: info.columns, pk: info.pk, textual: !!source.textual, skip: row.extraOnSource });
      }
      await target.commit();
    } catch (e) { await target.rollback().catch(() => {}); throw Object.assign(new Error(`${t}: ${redact(e.message)}`), { table: t }); }
    log(`  ✓ ${t}: ${copied}/${read}`);
    results.push({ table: t, source: read, copied });
  }
  await target.resetSequences?.(plan.order);
  return results;
}

// ---------------------------------------------------------- محوّل: ملف ----
export function fileSource(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("--from-file: يجب أن يكون كائناً {جدول: [صفوف]}");
  const tables = Object.keys(data).filter((k) => Array.isArray(data[k]));
  return {
    kind: "file", textual: false, label: `ملف ${jsonPath.split("/").pop()}`,
    async info() { return new Map(tables.map((t) => [t, { count: data[t].length, columns: new Set(data[t].flatMap((r) => Object.keys(r))) }])); },
    async *pages(t, _pk, batch) { for (let i = 0; i < data[t].length; i += batch) yield data[t].slice(i, i + batch); },
    async hashes() { return null; },     // لا بصمة قابلة للمقارنة مع Postgres من ملف JSON — العدّ فقط
    async close() {},
  };
}

// --------------------------------------------------------- محوّلات: pg ----
const sslFor = (prefix, env) => {
  if (String(env[`${prefix}_PG_SSL`] ?? "1") === "0") return false;
  return { rejectUnauthorized: String(env[`${prefix}_PG_SSL_REJECT_UNAUTHORIZED`] ?? "1") !== "0" };
};
const textTypes = { getTypeParser: () => (v) => v };

async function connect(url, ssl, types) {
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000, ...(types ? { types } : {}) });
  client.on("error", (e) => console.error("pg", redact(e.message)));
  await client.connect();
  await client.query("SET TimeZone TO 'UTC'");
  await client.query("SET extra_float_digits TO 3");
  await client.query("SET DateStyle TO 'ISO, YMD'");
  return client;
}

/** عمود بصمة الجدول: العدّ + md5 مجمَّع لأسطر مُهشَّمة بترتيب الهاش (لا يتطلّب مفتاحاً). الأعمدة المشتركة مرتّبة بالاسم. */
export function hashSql(table, cols) {
  const parts = cols.map((c) => `coalesce(${ident(c)}::text, chr(2))`).join(", ");
  return `select count(*)::text as c, coalesce(md5(string_agg(h, '' order by h)), '') as h from (select md5(concat_ws(chr(31), ${parts})) as h from ${ident(table)}) x`;
}

export async function pgSource(url, { schema = "public", env = process.env } = {}) {
  const client = await connect(url, sslFor("SOURCE", env), textTypes);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  return {
    kind: "pg", textual: true, label: hostOf(url),
    async info() {
      const t = await client.query("select table_name from information_schema.tables where table_schema=$1 and table_type='BASE TABLE' order by 1", [schema]);
      const c = await client.query("select table_name, column_name from information_schema.columns where table_schema=$1", [schema]);
      const cols = new Map();
      for (const r of c.rows) { if (!cols.has(r.table_name)) cols.set(r.table_name, new Set()); cols.get(r.table_name).add(r.column_name); }
      const out = new Map();
      for (const { table_name } of t.rows) {
        const n = await client.query(`select count(*)::text as n from ${ident(schema)}.${ident(table_name)}`);
        out.set(table_name, { count: Number(n.rows[0].n), columns: cols.get(table_name) || new Set() });
      }
      return out;
    },
    async *pages(t, pk, batch) {
      const order = pk.length ? pk.map(ident).join(", ") : "ctid";
      for (let off = 0; ; off += batch) {
        const r = await client.query(`select * from ${ident(schema)}.${ident(t)} order by ${order} limit ${batch} offset ${off}`);
        if (!r.rows.length) return;
        yield r.rows;
        if (r.rows.length < batch) return;
      }
    },
    async hashes(t, cols) { const r = await client.query(hashSql(t, cols)); return { count: Number(r.rows[0].c), hash: r.rows[0].h }; },
    async rowHashes(t, pk, cols) {
      const r = await client.query(`select md5(concat_ws(chr(31), ${pk.map((c) => `${ident(c)}::text`).join(", ")})) as k, md5(concat_ws(chr(31), ${cols.map((c) => `coalesce(${ident(c)}::text, chr(2))`).join(", ")})) as h from ${ident(t)}`);
      return new Map(r.rows.map((x) => [x.k, x.h]));
    },
    async close() { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); },
  };
}

export async function pgTarget(url, { schema = "public", env = process.env } = {}) {
  const client = await connect(url, sslFor("AZURE", env));
  const q = (sql, params) => client.query(sql, params);
  let metaCache = null;
  const t = {
    kind: "pg", label: hostOf(url),
    async meta() {
      if (metaCache) return metaCache;
      const cols = await q(
        `select c.relname as t, a.attname as col, format_type(a.atttypid, a.atttypmod) as type, a.attgenerated as gen, a.attidentity as ident
           from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
          where n.nspname=$1 and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by c.relname, a.attnum`, [schema]);
      const tables = new Map();
      for (const r of cols.rows) {
        if (!tables.has(r.t)) tables.set(r.t, { columns: new Map(), pk: [] });
        tables.get(r.t).columns.set(r.col, { type: r.type, generated: r.gen !== "", identity: r.ident });
      }
      const pks = await q(
        `select c.relname as t, a.attname as col from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
           join pg_attribute a on a.attrelid=c.oid and a.attnum = any(i.indkey)
          where i.indisprimary and n.nspname=$1 order by c.relname, array_position(i.indkey::int2[], a.attnum)`, [schema]);
      for (const r of pks.rows) if (tables.has(r.t)) tables.get(r.t).pk.push(r.col);
      const f = await q(
        `select cl.relname as child, pcl.relname as parent, c.condeferrable as def,
                (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum) as cols
           from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_class pcl on pcl.oid=c.confrelid join pg_namespace n on n.oid=cl.relnamespace
          where c.contype='f' and n.nspname=$1`, [schema]);
      metaCache = { tables, fks: f.rows.map((r) => ({ child: r.child, parent: r.parent, childCols: Array.isArray(r.cols) ? r.cols : String(r.cols || "").replace(/[{}"]/g, "").split(",").filter(Boolean), deferrable: r.def })) };
      return metaCache;
    },
    async count(table) { return Number((await q(`select count(*)::text n from ${ident(schema)}.${ident(table)}`)).rows[0].n); },
    async begin() { await q("BEGIN"); await q("SET CONSTRAINTS ALL DEFERRED"); },
    async truncate(tables) { if (tables.length) await q(`truncate table ${tables.map((t) => `${ident(schema)}.${ident(t)}`).join(", ")} restart identity`); },
    async clear(table) { await q(`delete from ${ident(schema)}.${ident(table)}`); },
    async commit() { await q("COMMIT"); },
    async rollback() { await q("ROLLBACK"); },
    async upsert(table, rows, { columns, pk, textual, skip = [] }) {
      if (!rows.length) return 0;
      const skipSet = new Set(skip);
      const cols = [...columns.keys()].filter((c) => !columns.get(c).generated && !skipSet.has(c) && rows.some((r) => c in r));
      if (!cols.length) return 0;
      const hasAlways = cols.some((c) => columns.get(c).identity === "a");
      const per = Math.max(1, Math.floor(60000 / cols.length));
      let n = 0;
      for (let i = 0; i < rows.length; i += per) {
        const chunk = rows.slice(i, i + per); const params = [];
        const values = chunk.map((r) => `(${cols.map((c) => {
          params.push(textual ? (r[c] === undefined ? null : r[c]) : encodeForColumn(r[c], columns.get(c)));
          return `$${params.length}::${columns.get(c).type}`;
        }).join(", ")})`);
        const nonPk = cols.filter((c) => !pk.includes(c));
        const conflict = pk.length ? ` on conflict (${pk.map(ident).join(", ")}) ${nonPk.length ? `do update set ${nonPk.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}` : "do nothing"}` : "";
        const res = await q(`insert into ${ident(schema)}.${ident(table)} (${cols.map(ident).join(", ")})${hasAlways ? " overriding system value" : ""} values ${values.join(", ")}${conflict}`, params);
        n += res.rowCount;
      }
      return n;
    },
    async resetSequences(tablesCopied) {
      const m = await t.meta();
      for (const tb of tablesCopied) {
        for (const [col, c] of m.tables.get(tb).columns) {
          const seq = (await q(`select pg_get_serial_sequence($1, $2) as s`, [`${ident(schema)}.${ident(tb)}`, col])).rows[0].s;
          if (!seq) continue;
          await q(`select setval($1, coalesce((select max(${ident(col)}) from ${ident(schema)}.${ident(tb)}), 1), (select max(${ident(col)}) is not null from ${ident(schema)}.${ident(tb)}))`, [seq]);
          void c;
        }
      }
    },
    async hashes(table, cols) { const r = await q(hashSql(table, cols)); return { count: Number(r.rows[0].c), hash: r.rows[0].h }; },
    async rowHashes(table, pk, cols) {
      const r = await q(`select md5(concat_ws(chr(31), ${pk.map((c) => `${ident(c)}::text`).join(", ")})) as k, md5(concat_ws(chr(31), ${cols.map((c) => `coalesce(${ident(c)}::text, chr(2))`).join(", ")})) as h from ${ident(table)}`);
      return new Map(r.rows.map((x) => [x.k, x.h]));
    },
    async close() { await client.end().catch(() => {}); },
  };
  return t;
}

// -------------------------------------------------------------- التحقّق ----
/**
 * يقارن كل جدول: العدّ ثم بصمة الأعمدة المشتركة. عند اختلاف البصمة بعدّ متساوٍ يفصّل الصفوف المختلفة
 * (عدداً وبصمات قصيرة لمفاتيحها). مع مصدر ملف: العدّ فقط. يعيد { ok, rows }.
 */
export async function verify({ plan, source, target, meta, log = () => {} }) {
  const rows = [];
  for (const r of plan.rows) {
    const info = meta.tables.get(r.table);
    const common = [...info.columns.keys()].filter((c) => !r.extraOnSource.includes(c) && !r.notOnSource.includes(c)).sort();
    const tgt = await target.hashes(r.table, common);
    const src = await source.hashes(r.table, common);
    const out = { table: r.table, source: src ? src.count : r.source, target: tgt.count, status: "ok", differing: 0, sample: [] };
    if (!src) { out.status = tgt.count === r.source ? "count-only-ok" : "count-mismatch"; }
    else if (src.count !== tgt.count) out.status = "count-mismatch";
    else if (src.hash !== tgt.hash) {
      out.status = "content-mismatch";
      if (info.pk.length && source.rowHashes) {
        const a = await source.rowHashes(r.table, info.pk, common); const b = await target.rowHashes(r.table, info.pk, common);
        const bad = [...a.keys()].filter((k) => b.get(k) !== a.get(k));
        out.differing = bad.length; out.sample = bad.slice(0, 3).map(shortHash);
      }
    }
    rows.push(out);
    log(`  ${out.status.endsWith("ok") ? "✓" : "✗"} ${r.table}: مصدر ${out.source} · هدف ${out.target} · ${out.status}${out.differing ? ` · ${out.differing} صف مختلف (بصمات: ${out.sample.join(",")})` : ""}`);
  }
  return { ok: rows.every((x) => x.status === "ok" || x.status === "count-only-ok"), rows };
}

// --------------------------------------------------------------------- CLI --
export function parseArgs(argv) {
  const a = { dryRun: false, verify: false, tables: null, batch: 500, schema: "public", skipMissing: false, replaceNoPk: false, clean: false, fromFile: null, schemaFile: null };
  for (const x of argv) {
    const [k, ...r] = x.split("="); const v = r.join("=");
    if (k === "--dry-run") a.dryRun = true;
    else if (k === "--verify") a.verify = true;
    else if (k === "--skip-missing") a.skipMissing = true;
    else if (k === "--replace-nopk") a.replaceNoPk = true;
    else if (k === "--clean") a.clean = true;
    else if (k === "--tables") a.tables = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "--batch") a.batch = Number(v) > 0 ? Math.floor(Number(v)) : 0;
    else if (k === "--schema") a.schema = v;
    else if (k === "--from-file") a.fromFile = v;
    else if (k === "--schema-file") a.schemaFile = v;
    else throw Object.assign(new Error(`معامل غير معروف: ${k}`), { usage: true });
  }
  if (!a.batch) throw Object.assign(new Error("--batch يجب أن يكون رقماً موجباً"), { usage: true });
  return a;
}

export async function main(argv, env = process.env, out = console) {
  let args;
  try { args = parseArgs(argv); } catch (e) { out.error(`${e.message}\nاستعمال: node ops/azure/migrate-db.mjs [--dry-run|--verify] [--tables=a,b] [--batch=N] [--schema=public] [--skip-missing] [--replace-nopk] [--clean] [--from-file=x.json] [--schema-file=x.sql]`); return 2; }
  const say = (m) => out.log(m);
  const srcUrl = String(env.SOURCE_PG_URL || "").trim();
  const dstUrl = String(env.AZURE_PG_URL || "").trim();
  if (!args.fromFile && !srcUrl) { out.error("المصدر غير مضبوط: SOURCE_PG_URL (أو --from-file=...)"); return 2; }
  if (args.fromFile && srcUrl) { out.error("اختر مصدراً واحداً: SOURCE_PG_URL أو --from-file"); return 2; }
  const offline = !!args.schemaFile;
  if (!offline && !dstUrl) { out.error("الهدف غير مضبوط: AZURE_PG_URL (أو --schema-file مع --dry-run)"); return 2; }
  if (offline && !args.dryRun) { out.error("--schema-file يصف الهدف بلا اتصال فيصلح لـ--dry-run وحده"); return 2; }
  if (!offline) {
    if (!hostOf(dstUrl)) { out.error("AZURE_PG_URL ليس رابط Postgres صالحاً"); return 2; }
    if (FORBIDDEN_TARGET.test(hostOf(dstUrl))) { out.error(`مرفوض: مضيف الهدف "${hostOf(dstUrl).split(":")[0]}" مزوّد المصدر المعروف — هذه الأداة تقرأ القديم ولا تكتب فيه.`); return 2; }
    if (srcUrl && hostOf(srcUrl) === hostOf(dstUrl)) { out.error("مرفوض: المصدر والهدف الاتصال نفسه."); return 2; }
  }

  let source, target;
  try {
    source = args.fromFile ? fileSource(args.fromFile) : await pgSource(srcUrl, { schema: args.schema, env });
    say(`المصدر: ${source.label}`);
    const info = await source.info();
    let meta;
    if (offline) { meta = parseSchemaSql(fs.readFileSync(args.schemaFile, "utf8")); say(`الهدف: وصف من ${args.schemaFile.split("/").pop()} (بلا اتصال)`); }
    else { target = await pgTarget(dstUrl, { schema: args.schema, env }); meta = await target.meta(); say(`الهدف: ${target.label}`); }
    const plan = buildPlan(info, meta, { only: args.tables, skipMissing: args.skipMissing });

    say(`\nالجداول (${plan.order.length}) بترتيب النسخ:`);
    for (const r of plan.rows) {
      const tgt = target ? await target.count(r.table) : "—";
      say(`  ${r.table}: مصدر ${r.source} · هدف ${tgt}${r.pk.length ? "" : " · بلا مفتاح أساسي"}`
        + (r.extraOnSource.length ? ` · أعمدة المصدر غير الموجودة في الهدف (تُسقط): ${r.extraOnSource.join(",")}` : "")
        + (r.notOnSource.length ? ` · أعمدة الهدف غير الموجودة في المصدر (تبقى افتراضية): ${r.notOnSource.join(",")}` : ""));
    }
    if (plan.missingOnTarget.length) say(`\nجداول المصدر غير الموجودة في الهدف: ${plan.missingOnTarget.join(", ")}`);
    if (plan.skippedSystem.length) say(`جداول نظام تُتجاوز: ${plan.skippedSystem.join(", ")}`);
    const totalRows = plan.rows.reduce((s, r) => s + r.source, 0);
    say(`\nالمجموع: ${totalRows} صف في ${plan.order.length} جدول.`);
    for (const e of plan.errors) out.error(`✗ ${e}`);

    if (args.dryRun) { say("\n--dry-run: لم يُكتب شيء."); return plan.errors.length ? 1 : 0; }
    if (plan.errors.length) return 1;

    if (!args.verify) {
      say("\nالنسخ:");
      await runCopy({ plan, source, target, meta, batch: args.batch, replaceNoPk: args.replaceNoPk, clean: args.clean, log: say });
    }
    if (source.kind === "file") say("\nمصدر ملف: التحقّق بالعدّ فقط.");
    say("\nالتحقّق:");
    const v = await verify({ plan, source, target, meta, log: say });
    say(v.ok ? "\n✓ تطابق تام." : "\n✗ عدم تطابق — لا تبدّل DB_DRIVER ولا الاتصال.");
    return v.ok ? 0 : 1;
  } catch (e) {
    out.error(`فشل: ${redact(e.message)}`);
    return 1;
  } finally {
    await source?.close?.();
    await target?.close?.();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
