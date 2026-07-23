// Business Partner — shared operational-DB helpers (Supabase/PostgREST).
// Files prefixed with "_" inside api/ are NOT deployed as serverless
// functions by Vercel, so this stays a plain shared module (keeps us under
// the 12-function plan cap).
import crypto from "node:crypto";

// Normalize hand-pasted env values; fall back to the project's known URL
// (a public identifier, not a secret) when the value isn't a valid
// *.supabase.co URL. A valid env value always wins.
const DEFAULT_SUPABASE_URL = "https://cpmgffwjxrdgevvkybcm.supabase.co";
let _su = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
if (_su && !/^https?:\/\//i.test(_su)) _su = "https://" + _su;
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(_su)) _su = _su ? DEFAULT_SUPABASE_URL : "";
export const SUPABASE_URL = _su;
export const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
export const DB_ON = !!(SUPABASE_URL && SUPABASE_KEY);

export async function sb(path, { method = "GET", body, prefer } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      Prefer: prefer || (method === "GET" ? "" : "return=representation"),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) { console.error("supabase error", method, path, r.status, text.slice(0, 300)); throw new Error("db_failed"); }
  return data;
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export const SESSION_COOKIE = "bp_sid";

// Resolve the httpOnly session cookie into { sessionId, user, organization }.
export async function getSession(req) {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw || !DB_ON) return null;
  const rows = await sb(
    `user_sessions?token_hash=eq.${sha256(raw)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}` +
    `&select=id,organization_id,expires_at,users(id,email,full_name,locale)&limit=1`
  );
  if (!rows.length) return null;
  const s = rows[0];
  let org = null;
  if (s.organization_id) {
    const orgs = await sb(`organizations?id=eq.${s.organization_id}&select=id,name_ar,name_en,cr_number,profile_completeness&limit=1`);
    org = orgs[0] || null;
  }
  return { sessionId: s.id, user: s.users, organization: org, expiresAt: s.expires_at };
}

// Best-effort audit trail — never throws.
export async function audit(entry) {
  if (!DB_ON) return;
  try { await sb("audit_logs", { method: "POST", prefer: "return=minimal", body: [entry] }); }
  catch {}
}

// Best-effort idempotent in-app notification — never throws.
export async function notify(row) {
  if (!DB_ON) return;
  try {
    await sb("notifications?on_conflict=idempotency_key", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: [row],
    });
  } catch {}
}
