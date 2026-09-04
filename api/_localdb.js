// Business Partner — local development database (JSON file, no network).
//
// WHY: every server module talks to Supabase through the tiny PostgREST
// client in api/_db.js (`sb("table?col=eq.x&select=…")`). Pointing localhost
// at the real project would mean developing against LIVE CUSTOMER DATA, so
// this module re-implements the slice of PostgREST that the repo actually
// uses on top of a JSON file under .localdb/ (git-ignored). Turn it on with
// LOCAL_DB=1 (site/scripts/devserver.mjs sets it for you); it is inert in
// production because Vercel never sets that variable, and files prefixed
// with "_" are never deployed as functions.
//
// Supported grammar (everything the repo issues today):
//   filters   col=eq.V  neq.  gt.  gte.  lt.  lte.  is.null  like.*x*
//             in.(a,b)  not.in.(a,b)
//   shaping   select=a,b,rel(a,b),rel!inner(a,b)  order=col.desc  limit=  offset=
//   methods   GET / POST (+ on_conflict upsert) / PATCH / DELETE
// Anything outside that raises loudly instead of silently returning [].

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const LOCAL_DB = process.env.LOCAL_DB === "1";

const ROOT = process.env.LOCAL_DB_DIR || path.join(process.cwd(), ".localdb");
const DB_FILE = path.join(ROOT, "db.json");
const STORAGE_DIR = path.join(ROOT, "storage");
const SEED_FILE = path.join(process.cwd(), "db", "seed.local.json");

let cache = null;

function load() {
  if (cache) return cache;
  fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    let seed = {};
    try { seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8")); } catch {}
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
  try { cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { cache = {}; }
  return cache;
}

let saveTimer = null;
function save() {
  // Debounced: a request touches the file a handful of times and the dev
  // server is single-process, so batching the writes keeps it snappy while
  // still surviving a Ctrl-C between requests.
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2)); }
    catch (e) { console.error("localdb write failed", e.message); }
  }, 40);
}

export function localReset() {
  cache = null;
  try { fs.rmSync(DB_FILE, { force: true }); } catch {}
  try { fs.rmSync(STORAGE_DIR, { recursive: true, force: true }); } catch {}
  return load();
}

function table(name) {
  const db = load();
  if (!Array.isArray(db[name])) db[name] = [];
  return db[name];
}

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- filters --
const OPS = {
  eq: (a, b) => String(a ?? "") === b,
  neq: (a, b) => String(a ?? "") !== b,
  gt: (a, b) => cmp(a, b) > 0,
  gte: (a, b) => cmp(a, b) >= 0,
  lt: (a, b) => cmp(a, b) < 0,
  lte: (a, b) => cmp(a, b) <= 0,
};
function cmp(a, b) {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a ?? "") < String(b) ? -1 : String(a ?? "") > String(b) ? 1 : 0;
}
function listValues(raw) {
  // in.(a,b,"c d") — PostgREST quotes only when the value needs it.
  return raw.replace(/^\(|\)$/g, "").split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
}

// or=(ref.ilike.*x*,title.ilike.*x*) — one level deep, which is all we issue.
function makeOrFilter(expr) {
  const inner = expr.replace(/^\(|\)$/g, "");
  const parts = [];
  let depth = 0, buf = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf) parts.push(buf);
  const fns = parts.map((p) => {
    const i = p.indexOf(".");
    return makeFilter(p.slice(0, i), p.slice(i + 1));
  });
  return (r) => fns.some((f) => f(r));
}

function makeFilter(col, expr) {
  // The operator is the FIRST segment, exactly as PostgREST reads it — plus
  // the two-segment "not." prefix. A greedy [a-z.]+ swallowed values that
  // themselves contain a dot: "event=eq.followup.reminded" parsed as the
  // operator "eq.followup", threw, and the caller's catch turned a broken
  // filter into a silently empty result.
  const m = /^(not\.[a-z]+|[a-z]+)\.(.*)$/s.exec(expr);
  if (!m) throw new Error(`localdb: bad filter "${col}=${expr}"`);
  const [, op, rest] = m;
  if (op === "is") { const want = rest === "null"; return (r) => (r[col] === null || r[col] === undefined) === want; }
  if (op === "in") { const set = new Set(listValues(rest)); return (r) => set.has(String(r[col] ?? "")); }
  if (op === "not.in") { const set = new Set(listValues(rest)); return (r) => !set.has(String(r[col] ?? "")); }
  if (op === "not.is") { const want = rest === "null"; return (r) => (r[col] === null || r[col] === undefined) !== want; }
  if (op === "like" || op === "ilike") {
    const rx = new RegExp("^" + rest.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", op === "ilike" ? "is" : "s");
    return (r) => rx.test(String(r[col] ?? ""));
  }
  const fn = OPS[op];
  if (!fn) throw new Error(`localdb: unsupported operator "${op}"`);
  return (r) => fn(r[col], rest);
}

// ------------------------------------------------------------ select trees --
// "id,ref,users(id,email),documents!inner(organization_id)" → columns + embeds
function parseSelect(sel) {
  if (!sel || sel === "*") return { all: true, cols: [], embeds: [] };
  const cols = [], embeds = [];
  let depth = 0, buf = "";
  const flush = () => {
    const part = buf.trim(); buf = "";
    if (!part) return;
    const m = /^([a-z0-9_]+)(!inner|!left)?\((.*)\)$/is.exec(part);
    if (m) embeds.push({ name: m[1], inner: m[2] === "!inner", select: parseSelect(m[3]) });
    else cols.push(part);
  };
  for (const ch of sel) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { flush(); continue; }
    buf += ch;
  }
  flush();
  return { all: false, cols, embeds };
}

const singular = (s) => (s.endsWith("ies") ? s.slice(0, -3) + "y" : s.endsWith("s") ? s.slice(0, -1) : s);

// PostgREST resolves embeds from the real foreign keys; here we infer them
// from the naming conventions used across db/schema.sql.
function resolveEmbed(parentName, parentRow, embed) {
  const child = table(embed.name);
  const fkOnParent = `${singular(embed.name)}_id`;
  if (fkOnParent in parentRow) {
    const hit = child.find((r) => String(r.id) === String(parentRow[fkOnParent]));
    return { many: false, rows: hit ? [hit] : [] };
  }
  const candidates = [
    `${singular(parentName)}_id`,
    `${singular(parentName).replace(/^[a-z0-9]+_/, "")}_id`,
  ];
  const sample = child[0] || {};
  const fk = candidates.find((c) => c in sample) || candidates[0];
  return { many: true, rows: child.filter((r) => String(r[fk]) === String(parentRow.id)) };
}

function shape(name, row, sel) {
  if (sel.all) return { ...row };
  const out = {};
  for (const c of sel.cols) {
    if (c === "*") Object.assign(out, row);
    else out[c] = row[c] === undefined ? null : row[c];
  }
  for (const e of sel.embeds) {
    const { many, rows } = resolveEmbed(name, row, e);
    const shaped = rows.map((r) => shape(e.name, r, e.select));
    out[e.name] = many ? shaped : shaped[0] || null;
  }
  return out;
}

function passesInner(name, row, sel) {
  for (const e of sel.embeds) {
    if (!e.inner) continue;
    const { rows } = resolveEmbed(name, row, e);
    if (!rows.length) return false;
  }
  return true;
}

// ------------------------------------------------------------------ engine --
export async function localRest(pathAndQuery, { method = "GET", body, prefer } = {}) {
  const [name, qs = ""] = String(pathAndQuery).split("?");
  const params = new URLSearchParams(qs);
  const sel = parseSelect(params.get("select"));
  const limit = Number(params.get("limit") || 0) || 0;
  const offset = Number(params.get("offset") || 0) || 0;
  const onConflict = (params.get("on_conflict") || "").split(",").filter(Boolean);
  const orders = (params.getAll("order") || []).flatMap((o) => o.split(",")).filter(Boolean).map((o) => {
    const [col, ...rest] = o.split(".");
    return { col, desc: rest.includes("desc"), nullsLast: rest.includes("nullslast") };
  });

  const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
  const filters = [];
  for (const [k, v] of params.entries()) {
    if (reserved.has(k)) continue;
    filters.push(k === "or" ? makeOrFilter(v) : makeFilter(k, v));
  }
  const match = (r) => filters.every((f) => f(r));

  const rows = table(name);
  const minimal = /return=minimal/.test(prefer || "");

  if (method === "GET") {
    let hits = rows.filter((r) => match(r) && passesInner(name, r, sel));
    for (const o of [...orders].reverse()) {
      hits.sort((a, b) => (o.desc ? -1 : 1) * cmp(a[o.col], b[o.col]));
    }
    if (offset) hits = hits.slice(offset);
    if (limit) hits = hits.slice(0, limit);
    return hits.map((r) => shape(name, r, sel));
  }

  if (method === "POST") {
    const incoming = Array.isArray(body) ? body : [body];
    const out = [];
    for (const raw of incoming) {
      const row = { ...raw };
      let existing = null;
      if (onConflict.length) {
        existing = rows.find((r) => onConflict.every((c) => String(r[c] ?? "") === String(row[c] ?? "")));
      }
      if (existing) {
        if (/ignore-duplicates/.test(prefer || "")) { out.push(existing); continue; }
        Object.assign(existing, row, { updated_at: nowIso() });
        out.push(existing);
        continue;
      }
      if (row.id === undefined) row.id = crypto.randomUUID();
      if (row.created_at === undefined) row.created_at = nowIso();
      rows.push(row);
      out.push(row);
    }
    save();
    return minimal ? null : out.map((r) => shape(name, r, sel));
  }

  if (method === "PATCH") {
    const hits = rows.filter(match);
    for (const r of hits) Object.assign(r, body);
    save();
    return minimal ? null : hits.map((r) => shape(name, r, sel));
  }

  if (method === "DELETE") {
    const hits = rows.filter(match);
    const keep = rows.filter((r) => !hits.includes(r));
    load()[name] = keep;
    save();
    return minimal ? null : hits.map((r) => shape(name, r, sel));
  }

  throw new Error(`localdb: unsupported method ${method}`);
}

// ----------------------------------------------------------------- storage --
// Supabase Storage stands in as plain files under .localdb/storage/.
const keyPath = (k) => path.join(STORAGE_DIR, String(k).replace(/\.\./g, "_"));

export async function localStoragePut(p, buffer) {
  const f = keyPath(p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buffer);
  return p;
}
export async function localStorageGet(p) {
  return fs.readFileSync(keyPath(p));
}
export async function localStorageDelete(p) {
  try { fs.rmSync(keyPath(p), { force: true }); } catch {}
}
export async function localStorageSign(p) {
  return `/__localdb/storage/${encodeURI(String(p))}`;
}
export const LOCAL_STORAGE_DIR = STORAGE_DIR;
