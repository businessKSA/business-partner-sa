// Business Partner — قاعدة البيانات على Azure Database for PostgreSQL.
//
// كل وحدات الخادم تتحدث عبر عميل PostgREST الصغير في api/_db.js بصيغة
// `sb("table?col=eq.x&select=…")`. Azure Postgres لا يفهم PostgREST، ففي هذا
// الملف مترجمٌ يحوّل تلك الصيغة إلى SQL مُعاملي.
//
// الصيغة المدعومة هي نفسها الموثّقة في api/_localdb.js حرفاً بحرف، والمُحلّلان
// (parseSelect وsingular) مستوردان من هناك لا منسوخان — نسختان تتباعدان مع
// أول تعديل، وعندها يعمل المحلي ويفشل الإنتاج بلا سبب ظاهر.
//
// ما لا يُدعم يرمي بصوتٍ عالٍ. الصمت هنا أسوأ من العطل: مرشّحٌ لا يُفهم يعني
// استعلاماً بلا شرط، أي بيانات منشأةٍ أخرى تُعاد لعميلٍ لا يملكها.
//
// التفعيل: DB_DRIVER=azure + AZURE_PG_URL في البيئة (انظر api/_db.js). بلا
// المتغيّرين لا يُحمَّل `pg` أصلاً، فلا كلفة على نشرات Supabase الحالية.
//
// الاختبار الحقيقي في tests/azpg.test.mjs يطبّق db/schema.sql على Postgres
// فعلي ويمرّر كل شكل استعلامٍ يصدره المستودع. لا تعدّل هذا الملف بلا تشغيله.
import { parseSelect, singular } from "./_localdb.js";

const CONN = () => String(process.env.AZURE_PG_URL || process.env.AZURE_POSTGRES_URL || "").trim();
export const azurePgReady = () => !!CONN();
export const azurePgMissing = () => "AZURE_PG_URL";

// ------------------------------------------------------------- القيم كما يعيدها PostgREST --
// PostgREST يعيد JSON: الأوقات نصوصاً بصيغة ISO، والأرقام أرقاماً. أما `pg`
// فيعيد timestamptz كائن Date وnumeric نصاً — وكلا الاختلافين يكسر كوداً
// قائماً (`row.created_at.slice(0,10)`، `a + b`). فتُثبَّت الصيغة هنا حتى
// لا يفرّق المستدعي بين Supabase وAzure.
const OID = { DATE: 1082, TIMESTAMP: 1114, TIMESTAMPTZ: 1184, NUMERIC: 1700, INT8: 20 };
const TS_RE = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)(?:([+-]\d\d)(?::?(\d\d))?)?$/;
export function pgTextToIso(s) {
  if (s === null || s === undefined) return s;
  const m = TS_RE.exec(String(s));
  if (!m) return String(s);
  const [, d, t, tzH, tzM] = m;
  if (!tzH) return `${d}T${t}`;
  return `${d}T${t}${tzH}:${tzM || "00"}`;
}
// المعرّفات لا تُعامَل معاملة القيم: القيم تُمرَّر كمعاملات، والمعرّفات تُفحَص
// بقائمة محارف مسموحة ثم تُقتبس. أي اسم خارجها يرمي بدل أن يُركَّب في النص.
const ident = (name) => {
  const s = String(name || "");
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`azpg: معرّف غير صالح "${s}"`);
  return `"${s}"`;
};

// تجمّع اتصالات واحد لكل نسخة عاملة. الحدّ منخفض عمداً: كل نداء serverless
// نسخة مستقلة، وسقف اتصالات Azure يُستهلك بعدد النسخ لا بعدد الاستعلامات.
// `pg` يُستورد عند أول حاجة فقط: استيراده في رأس الملف كان سيُحمَّل مع كل
// دالة على Vercel حتى والقاعدة ما زالت Supabase.
let pool = null;
let pgModule = null;
async function db() {
  if (pool) return pool;
  if (!CONN()) throw new Error("azpg: AZURE_PG_URL غير مضبوط");
  pgModule = pgModule || (await import("pg")).default;
  const base = pgModule.types;
  const parsers = new Map([
    [OID.TIMESTAMPTZ, pgTextToIso],
    [OID.TIMESTAMP, pgTextToIso],
    [OID.DATE, (s) => String(s)],
    [OID.NUMERIC, (s) => Number(s)],
    [OID.INT8, (s) => Number(s)],
  ]);
  // التوقيت UTC على كل اتصال (عبر معاملات بدء الجلسة، لا بـSET لاحق يتسابق
  // مع أول استعلام) حتى تخرج الأوقات بلاحقة +00:00 كما من PostgREST. ما في
  // الرابط من options (مثل search_path في الاختبارات) يُحفَظ ويُلحق به.
  let options = "";
  try { options = new URL(CONN()).searchParams.get("options") || ""; } catch {}
  pool = new pgModule.Pool({
    connectionString: CONN(),
    options: `${options} -c timezone=UTC`.trim(),
    max: Number(process.env.AZURE_PG_POOL_MAX || 2),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    // Azure يفرض TLS. الشهادة من سلطة عامة، والتحقق يبقى مفعّلاً ما لم
    // يُطفأ صراحةً لخادمٍ بشهادة ذاتية التوقيع أو لقاعدة اختبار محلية.
    ssl: String(process.env.AZURE_PG_SSL || "1") === "0"
      ? false
      : String(process.env.AZURE_PG_SSL_REJECT_UNAUTHORIZED || "1") === "0"
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true },
    types: { getTypeParser: (oid, format) => (format === "text" && parsers.has(oid) ? parsers.get(oid) : base.getTypeParser(oid, format)) },
  });
  pool.on("error", (e) => console.error("azpg pool", String(e.message || e).slice(0, 200)));
  return pool;
}

/** يغلق التجمّع — للسكربتات والاختبارات، لا للدوال على Vercel. */
export async function azpgClose() {
  const p = pool; pool = null;
  if (p) await p.end();
}

/** فحص صحة بلا بيانات: يُرجع { ok, error? } ولا يرمي. */
export async function azpgPing() {
  try {
    const p = await db();
    await p.query("select 1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && (e.code || e.message) || e).slice(0, 80) };
  }
}

// أعمدة كل جدول وأنواعها تُقرأ مرة واحدة من information_schema وتُحفظ: بها
// يُعرف اتجاه العلاقة في select المتداخل (هل المفتاح على الأب أم على الابن؟)،
// وبها يُعرف كيف تُرسَل القيمة (jsonb تُسلسل، والمصفوفة تُمرَّر كما هي).
const columnCache = new Map();
async function columnsOf(client, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);
  const { rows } = await client.query(
    "select column_name, data_type, udt_name from information_schema.columns " +
    "where table_schema = current_schema() and table_name = $1",
    [tableName],
  );
  if (!rows.length) throw new Error(`azpg: الجدول "${tableName}" غير موجود في المخطّط`);
  const map = new Map(rows.map((r) => [r.column_name, { type: r.data_type, udt: r.udt_name }]));
  columnCache.set(tableName, map);
  return map;
}
export const azpgForgetColumns = () => columnCache.clear();

/** قيمة جاهزة للإرسال كمعامل بحسب نوع العمود. */
function encodeValue(v, col) {
  if (v === undefined) return null;
  if (v === null) return null;
  const type = col ? col.type : "";
  if (type === "json" || type === "jsonb") return JSON.stringify(v);
  if (type === "ARRAY") return Array.isArray(v) ? v : [v];
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
}

const listValues = (rest) => {
  const inner = String(rest).replace(/^\(|\)$/g, "");
  if (!inner) return [];
  return inner.match(/"(?:[^"\\]|\\.)*"|[^,]+/g)?.map((v) => v.trim().replace(/^"|"$/g, "")) || [];
};

const SIMPLE_OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };

/**
 * شرط SQL واحد من `col=op.value`، والقيم تذهب إلى `params` لا إلى النص.
 * المعامل يُرسَل بلا نوع فيستنتجه Postgres من العمود — كما يفعل PostgREST —
 * فيقارَن الوقت وقتاً والرقم رقماً، لا نصاً (مقارنة `created_at::text` بقيمة
 * ISO فيها `T` كانت تُسقط صفوفاً صحيحة بصمت).
 */
function filterSql(col, expr, params, alias) {
  const m = /^(not\.[a-z]+|[a-z]+)\.(.*)$/s.exec(String(expr));
  if (!m) throw new Error(`azpg: مرشّح غير مفهوم "${col}=${expr}"`);
  const [, op, rest] = m;
  const c = `${alias}.${ident(col)}`;

  if (op === "is" || op === "not.is") {
    if (rest === "null") return `${c} ${op === "is" ? "IS NULL" : "IS NOT NULL"}`;
    if (rest === "true" || rest === "false") return `${c} IS ${op === "not.is" ? "NOT " : ""}${rest.toUpperCase()}`;
    throw new Error(`azpg: is.${rest} غير مدعوم`);
  }
  if (op === "in" || op === "not.in") {
    const vals = listValues(rest);
    if (!vals.length) return op === "in" ? "false" : "true";
    const ph = vals.map((v) => { params.push(v); return `$${params.length}`; }).join(", ");
    return `${c} ${op === "in" ? "IN" : "NOT IN"} (${ph})`;
  }
  if (op === "like" || op === "ilike" || op === "not.like" || op === "not.ilike") {
    params.push(String(rest).replace(/[\\%_]/g, (ch) => "\\" + ch).replace(/\*/g, "%"));
    const neg = op.startsWith("not.") ? "NOT " : "";
    return `${c}::text ${neg}${op.endsWith("ilike") ? "ILIKE" : "LIKE"} $${params.length}`;
  }
  const base = op.startsWith("not.") ? op.slice(4) : op;
  const sqlOp = SIMPLE_OPS[base];
  if (!sqlOp) throw new Error(`azpg: عامل غير مدعوم "${op}"`);
  params.push(rest);
  const cond = `${c} ${sqlOp} $${params.length}`;
  return op.startsWith("not.") ? `NOT (${cond})` : cond;
}

function orFilterSql(expr, params, alias) {
  const inner = String(expr).replace(/^\(|\)$/g, "");
  const parts = [];
  let depth = 0, buf = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf) parts.push(buf);
  const each = parts.map((p) => {
    const i = p.indexOf(".");
    if (i < 1) throw new Error(`azpg: جزء or غير مفهوم "${p}"`);
    return filterSql(p.slice(0, i), p.slice(i + 1), params, alias);
  });
  return `(${each.join(" OR ")})`;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function whereSql(params, entries, alias) {
  const parts = [];
  for (const [k, v] of entries) {
    if (RESERVED.has(k)) continue;
    parts.push(k === "or" ? orFilterSql(v, params, alias) : filterSql(k, v, params, alias));
  }
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
}

/** اتجاه العلاقة بين جدولٍ وابنه، من الأعمدة الفعلية لا من التخمين. */
async function relation(client, tableName, childName) {
  const parentCols = await columnsOf(client, tableName);
  const childCols = await columnsOf(client, childName);
  const fkOnParent = `${singular(childName)}_id`;
  if (parentCols.has(fkOnParent)) return { many: false, fk: fkOnParent };
  const candidates = [`${singular(tableName)}_id`, `${singular(tableName).replace(/^[a-z0-9]+_/, "")}_id`];
  const fk = candidates.find((c) => childCols.has(c));
  if (!fk) throw new Error(`azpg: تعذّر ربط "${childName}" بـ"${tableName}" — لا مفتاح خارجي متوقع`);
  return { many: true, fk };
}

/**
 * قائمة الأعمدة المطلوبة، مع select المتداخل كاستعلامات فرعية تُعيد JSON.
 * الأوقات داخل JSON تُنسَّق بـto_json فتخرج ISO تماماً كما من PostgREST.
 */
async function selectList(client, tableName, sel, alias) {
  if (sel.all) return `${alias}.*`;
  const cols = sel.cols.length ? sel.cols.map((c) => (c === "*" ? `${alias}.*` : `${alias}.${ident(c)}`)) : [];
  for (const e of sel.embeds) {
    const childName = e.name;
    const childAlias = ident(`e_${childName}`);
    const inner = await selectList(client, childName, e.select, childAlias);
    const rel = await relation(client, tableName, childName);
    if (!rel.many) {
      cols.push(
        `(SELECT row_to_json(x) FROM (SELECT ${inner} FROM ${ident(childName)} ${childAlias} ` +
        `WHERE ${childAlias}."id" = ${alias}.${ident(rel.fk)} LIMIT 1) x) AS ${ident(childName)}`,
      );
      continue;
    }
    cols.push(
      `(SELECT coalesce(json_agg(x), '[]'::json) FROM (SELECT ${inner} FROM ${ident(childName)} ${childAlias} ` +
      `WHERE ${childAlias}.${ident(rel.fk)} = ${alias}."id") x) AS ${ident(childName)}`,
    );
  }
  return cols.length ? cols.join(", ") : `${alias}.*`;
}

/** شرط وجود صفٍّ ابن، لـ`rel!inner(...)`: يحذف الأب الذي لا ابن له. */
async function innerExists(client, tableName, sel, alias) {
  const parts = [];
  for (const e of sel.embeds) {
    if (!e.inner) continue;
    const rel = await relation(client, tableName, e.name);
    parts.push(rel.many
      ? `EXISTS (SELECT 1 FROM ${ident(e.name)} c WHERE c.${ident(rel.fk)} = ${alias}."id")`
      : `EXISTS (SELECT 1 FROM ${ident(e.name)} c WHERE c."id" = ${alias}.${ident(rel.fk)})`);
  }
  return parts;
}

/** ترتيب PostgREST: الافتراضي هو افتراضي Postgres (asc→nulls last، desc→nulls first). */
function orderSql(orders, alias) {
  if (!orders.length) return "";
  return " ORDER BY " + orders.map((o) => {
    const nulls = o.nullsFirst ? "FIRST" : o.nullsLast ? "LAST" : o.desc ? "FIRST" : "LAST";
    return `${alias}.${ident(o.col)} ${o.desc ? "DESC" : "ASC"} NULLS ${nulls}`;
  }).join(", ");
}

/**
 * نفس عقد sb(): يأخذ مسار PostgREST ويعيد صفوفاً (أو null مع return=minimal).
 */
export async function azpgRest(pathAndQuery, { method = "GET", body, prefer } = {}) {
  const [name, qs = ""] = String(pathAndQuery).split("?");
  const t = ident(name);
  const alias = t;                       // الجدول نفسه هو الاسم المستعار
  const params = new URLSearchParams(qs);
  const sel = parseSelect(params.get("select"));
  const limit = Number(params.get("limit") || 0) || 0;
  const offset = Number(params.get("offset") || 0) || 0;
  const onConflict = (params.get("on_conflict") || "").split(",").filter(Boolean);
  const orders = (params.getAll("order") || []).flatMap((o) => o.split(",")).filter(Boolean).map((o) => {
    const [col, ...rest] = o.split(".");
    return { col, desc: rest.includes("desc"), nullsLast: rest.includes("nullslast"), nullsFirst: rest.includes("nullsfirst") };
  });
  const minimal = /return=minimal/.test(prefer || "");
  const entries = [...params.entries()];

  const pool = await db();
  const client = await pool.connect();
  try {
    if (method === "GET") {
      const vals = [];
      const cols = await selectList(client, name, sel, alias);
      let sql = `SELECT ${cols} FROM ${t}`;
      let where = whereSql(vals, entries, alias);
      const inner = await innerExists(client, name, sel, alias);
      if (inner.length) where = where ? `${where} AND ${inner.join(" AND ")}` : ` WHERE ${inner.join(" AND ")}`;
      sql += where + orderSql(orders, alias);
      if (limit) sql += ` LIMIT ${Number(limit)}`;
      if (offset) sql += ` OFFSET ${Number(offset)}`;
      const { rows } = await client.query(sql, vals);
      return rows;
    }

    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : [body]).filter((r) => r && typeof r === "object");
      if (!incoming.length) return minimal ? null : [];
      const types = await columnsOf(client, name);
      // الصفوف تُجمَّع بحسب أعمدتها: صفٌّ لا يذكر عموداً يأخذ افتراضي الجدول
      // (created_at now()، id gen_random_uuid()) لا null صريحاً يُبطل الافتراضي.
      const groups = new Map();
      incoming.forEach((row, index) => {
        const keys = Object.keys(row).filter((k) => row[k] !== undefined).sort();
        if (!keys.length) throw new Error("azpg: إدراج بلا أعمدة");
        const key = keys.join(",");
        if (!groups.has(key)) groups.set(key, { keys, rows: [], indexes: [] });
        groups.get(key).rows.push(row);
        groups.get(key).indexes.push(index);
      });
      // الصفوف المُعادة بترتيب الإدخال نفسه كما يفعل PostgREST، لا بترتيب
      // المجموعات — مستدعٍ يقابل rows[i] بـbody[i] يجب ألا يُفاجأ.
      const out = new Array(incoming.length);
      const extra = [];
      for (const { keys, rows: group, indexes } of groups.values()) {
        const vals = [];
        const tuples = group.map((row) => "(" + keys.map((c) => {
          vals.push(encodeValue(row[c], types.get(c)));
          return `$${vals.length}`;
        }).join(", ") + ")");
        let sql = `INSERT INTO ${t} (${keys.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`;
        if (onConflict.length) {
          const target = onConflict.map(ident).join(", ");
          if (/ignore-duplicates/.test(prefer || "")) sql += ` ON CONFLICT (${target}) DO NOTHING`;
          else {
            const updates = keys.filter((c) => !onConflict.includes(c));
            sql += updates.length
              ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`
              : ` ON CONFLICT (${target}) DO NOTHING`;
          }
        }
        if (!minimal) sql += " RETURNING *";
        const { rows } = await client.query(sql, vals);
        if (minimal) continue;
        if (rows.length === indexes.length) rows.forEach((r, i) => { out[indexes[i]] = r; });
        else extra.push(...rows);          // DO NOTHING أسقط صفوفاً فلا مقابلة موضعية
      }
      return minimal ? null : [...out.filter((r) => r !== undefined), ...extra];
    }

    if (method === "PATCH") {
      const patch = body && typeof body === "object" ? body : {};
      const cols = Object.keys(patch).filter((c) => patch[c] !== undefined);
      if (!cols.length) return minimal ? null : [];
      const types = await columnsOf(client, name);
      const vals = [];
      const sets = cols.map((c) => {
        vals.push(encodeValue(patch[c], types.get(c)));
        return `${ident(c)} = $${vals.length}`;
      });
      let sql = `UPDATE ${t} SET ${sets.join(", ")}${whereSql(vals, entries, alias)}`;
      if (!minimal) sql += " RETURNING *";
      const { rows } = await client.query(sql, vals);
      return minimal ? null : rows;
    }

    if (method === "DELETE") {
      const vals = [];
      let sql = `DELETE FROM ${t}${whereSql(vals, entries, alias)}`;
      if (!minimal) sql += " RETURNING *";
      const { rows } = await client.query(sql, vals);
      return minimal ? null : rows;
    }

    throw new Error(`azpg: طريقة غير مدعومة "${method}"`);
  } finally {
    client.release();
  }
}
