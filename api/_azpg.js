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
import pg from "pg";
import { parseSelect, singular } from "./_localdb.js";

const CONN = () => String(process.env.AZURE_PG_URL || process.env.AZURE_POSTGRES_URL || process.env.DATABASE_URL || "").trim();
export const azurePgReady = () => !!CONN();
export const azurePgMissing = () => "AZURE_PG_URL";

// تجمّع اتصالات واحد لكل نسخة عاملة. الحدّ منخفض عمداً: كل نداء serverless
// نسخة مستقلة، وسقف اتصالات Azure يُستهلك بعدد النسخ لا بعدد الاستعلامات.
let pool = null;
function db() {
  if (pool) return pool;
  if (!CONN()) throw new Error("azpg: AZURE_PG_URL غير مضبوط");
  pool = new pg.Pool({
    connectionString: CONN(),
    max: Number(process.env.AZURE_PG_POOL_MAX || 2),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    // Azure يفرض TLS. الشهادة من سلطة عامة، والتحقق يبقى مفعّلاً ما لم
    // يُطفأ صراحةً لخادمٍ بشهادة ذاتية التوقيع.
    ssl: String(process.env.AZURE_PG_SSL_REJECT_UNAUTHORIZED || "1") === "0"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true },
  });
  pool.on("error", (e) => console.error("azpg pool", String(e.message || e).slice(0, 200)));
  return pool;
}

// المعرّفات لا تُعامَل معاملة القيم: القيم تُمرَّر كمعاملات، والمعرّفات تُفحَص
// بقائمة محارف مسموحة ثم تُقتبس. أي اسم خارجها يرمي بدل أن يُركَّب في النص.
const ident = (name) => {
  const s = String(name || "");
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`azpg: معرّف غير صالح "${s}"`);
  return `"${s}"`;
};

// أعمدة كل جدول تُقرأ مرة واحدة من information_schema وتُحفظ: بها يُعرف اتجاه
// العلاقة في select المتداخل (هل المفتاح على الأب أم على الابن؟)، وهي نفس
// القاعدة التي يستعملها المُحاكي المحلي على الصفوف.
const columnCache = new Map();
async function columnsOf(client, tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);
  const { rows } = await client.query(
    "select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1",
    [tableName],
  );
  const set = new Set(rows.map((r) => r.column_name));
  columnCache.set(tableName, set);
  return set;
}

const listValues = (rest) => {
  const inner = String(rest).replace(/^\(|\)$/g, "");
  if (!inner) return [];
  return inner.match(/"(?:[^"\\]|\\.)*"|[^,]+/g)?.map((v) => v.trim().replace(/^"|"$/g, "")) || [];
};

const SIMPLE_OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };

/** شرط SQL واحد من `col=op.value`، والقيم تذهب إلى `params` لا إلى النص. */
function filterSql(col, expr, params, alias) {
  const m = /^(not\.[a-z]+|[a-z]+)\.(.*)$/s.exec(String(expr));
  if (!m) throw new Error(`azpg: مرشّح غير مفهوم "${col}=${expr}"`);
  const [, op, rest] = m;
  const c = `${alias}.${ident(col)}`;

  if (op === "is" || op === "not.is") {
    if (rest !== "null") throw new Error(`azpg: is.${rest} غير مدعوم`);
    return `${c} ${op === "is" ? "IS NULL" : "IS NOT NULL"}`;
  }
  if (op === "in" || op === "not.in") {
    const vals = listValues(rest);
    if (!vals.length) return op === "in" ? "false" : "true";
    // ::text على الطرفين يطابق سلوك PostgREST مع أعمدة enum وuuid معاً.
    const ph = vals.map((v) => { params.push(v); return `$${params.length}`; }).join(", ");
    return `${c}::text ${op === "in" ? "IN" : "NOT IN"} (${ph})`;
  }
  if (op === "like" || op === "ilike") {
    params.push(String(rest).replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/\*/g, "%"));
    return `${c}::text ${op === "like" ? "LIKE" : "ILIKE"} $${params.length}`;
  }
  const sqlOp = SIMPLE_OPS[op];
  if (!sqlOp) throw new Error(`azpg: عامل غير مدعوم "${op}"`);
  params.push(rest);
  return `${c}::text ${sqlOp} $${params.length}`;
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

/**
 * قائمة الأعمدة المطلوبة، مع select المتداخل كاستعلامات فرعية تُعيد JSON.
 * اتجاه العلاقة يُحسم من أعمدة الجدولين لا من التخمين.
 */
async function selectList(client, tableName, sel, alias) {
  if (sel.all) return `${alias}.*`;
  const cols = sel.cols.length ? sel.cols.map((c) => (c === "*" ? `${alias}.*` : `${alias}.${ident(c)}`)) : [];
  for (const e of sel.embeds) {
    const childName = e.name;
    const parentCols = await columnsOf(client, tableName);
    const childCols = await columnsOf(client, childName);
    const childAlias = `e_${childName}`;
    const inner = await selectList(client, childName, e.select, ident(childAlias));
    const fkOnParent = `${singular(childName)}_id`;

    if (parentCols.has(fkOnParent)) {
      // واحد إلى واحد: المفتاح على الأب.
      cols.push(
        `(SELECT row_to_json(x) FROM (SELECT ${inner} FROM ${ident(childName)} ${ident(childAlias)} ` +
        `WHERE ${ident(childAlias)}."id" = ${alias}.${ident(fkOnParent)} LIMIT 1) x) AS ${ident(childName)}`,
      );
      continue;
    }
    const candidates = [`${singular(tableName)}_id`, `${singular(tableName).replace(/^[a-z0-9]+_/, "")}_id`];
    const fk = candidates.find((c) => childCols.has(c));
    if (!fk) throw new Error(`azpg: تعذّر ربط "${childName}" بـ"${tableName}" — لا مفتاح خارجي متوقع`);
    cols.push(
      `(SELECT coalesce(json_agg(x), '[]'::json) FROM (SELECT ${inner} FROM ${ident(childName)} ${ident(childAlias)} ` +
      `WHERE ${ident(childAlias)}.${ident(fk)} = ${alias}."id") x) AS ${ident(childName)}`,
    );
  }
  return cols.length ? cols.join(", ") : `${alias}.*`;
}

/** شرط وجود صفٍّ ابن، لـ`rel!inner(...)`: يحذف الأب الذي لا ابن له. */
async function innerExists(client, tableName, sel, alias) {
  const parts = [];
  for (const e of sel.embeds) {
    if (!e.inner) continue;
    const parentCols = await columnsOf(client, tableName);
    const childCols = await columnsOf(client, e.name);
    const fkOnParent = `${singular(e.name)}_id`;
    if (parentCols.has(fkOnParent)) {
      parts.push(`EXISTS (SELECT 1 FROM ${ident(e.name)} c WHERE c."id" = ${alias}.${ident(fkOnParent)})`);
      continue;
    }
    const candidates = [`${singular(tableName)}_id`, `${singular(tableName).replace(/^[a-z0-9]+_/, "")}_id`];
    const fk = candidates.find((c) => childCols.has(c));
    if (!fk) throw new Error(`azpg: تعذّر ربط "${e.name}" بـ"${tableName}"`);
    parts.push(`EXISTS (SELECT 1 FROM ${ident(e.name)} c WHERE c.${ident(fk)} = ${alias}."id")`);
  }
  return parts;
}

/**
 * نفس عقد sb(): يأخذ مسار PostgREST ويعيد صفوفاً (أو null مع return=minimal).
 */
export async function azpgRest(pathAndQuery, { method = "GET", body, prefer } = {}) {
  const [rawName, qs = ""] = String(pathAndQuery).split("?");
  const name = rawName;
  const t = ident(name);
  const alias = t;                       // الجدول نفسه هو الاسم المستعار
  const params = new URLSearchParams(qs);
  const sel = parseSelect(params.get("select"));
  const limit = Number(params.get("limit") || 0) || 0;
  const offset = Number(params.get("offset") || 0) || 0;
  const onConflict = (params.get("on_conflict") || "").split(",").filter(Boolean);
  const orders = (params.getAll("order") || []).flatMap((o) => o.split(",")).filter(Boolean).map((o) => {
    const [col, ...rest] = o.split(".");
    return { col, desc: rest.includes("desc"), nullsLast: rest.includes("nullslast") };
  });
  const minimal = /return=minimal/.test(prefer || "");
  const entries = [...params.entries()];

  const client = await db().connect();
  try {
    if (method === "GET") {
      const vals = [];
      const cols = await selectList(client, name, sel, alias);
      let sql = `SELECT ${cols} FROM ${t}`;
      let where = whereSql(vals, entries, alias);
      const inner = await innerExists(client, name, sel, alias);
      if (inner.length) where = where ? `${where} AND ${inner.join(" AND ")}` : ` WHERE ${inner.join(" AND ")}`;
      sql += where;
      if (orders.length) {
        sql += " ORDER BY " + orders.map((o) =>
          `${alias}.${ident(o.col)} ${o.desc ? "DESC" : "ASC"} NULLS ${o.nullsLast || o.desc ? "LAST" : "FIRST"}`).join(", ");
      }
      if (limit) sql += ` LIMIT ${Number(limit)}`;
      if (offset) sql += ` OFFSET ${Number(offset)}`;
      const { rows } = await client.query(sql, vals);
      return rows;
    }

    if (method === "POST") {
      const incoming = Array.isArray(body) ? body : [body];
      if (!incoming.length) return minimal ? null : [];
      // كل الصفوف تكتب نفس الأعمدة، وما نقص في صفٍّ يُرسَل null، فتبقى
      // العبارة واحدة بدل عبارةٍ لكل صف.
      const colSet = [...new Set(incoming.flatMap((r) => Object.keys(r || {})))];
      if (!colSet.length) throw new Error("azpg: إدراج بلا أعمدة");
      const vals = [];
      const tuples = incoming.map((row) => "(" + colSet.map((c) => {
        const v = row && row[c] !== undefined ? row[c] : null;
        vals.push(v && typeof v === "object" ? JSON.stringify(v) : v);
        return `$${vals.length}`;
      }).join(", ") + ")");
      let sql = `INSERT INTO ${t} (${colSet.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`;
      if (onConflict.length) {
        const target = onConflict.map(ident).join(", ");
        if (/ignore-duplicates/.test(prefer || "")) sql += ` ON CONFLICT (${target}) DO NOTHING`;
        else {
          const updates = colSet.filter((c) => !onConflict.includes(c));
          sql += updates.length
            ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`
            : ` ON CONFLICT (${target}) DO NOTHING`;
        }
      }
      if (!minimal) sql += " RETURNING *";
      const { rows } = await client.query(sql, vals);
      return minimal ? null : rows;
    }

    if (method === "PATCH") {
      const patch = body && typeof body === "object" ? body : {};
      const cols = Object.keys(patch);
      if (!cols.length) return minimal ? null : [];
      const vals = [];
      const sets = cols.map((c) => {
        const v = patch[c];
        vals.push(v && typeof v === "object" ? JSON.stringify(v) : v);
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
