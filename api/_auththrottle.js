// Business Partner — brute-force throttle for the supplier portal.
// A guessable login (password or 6-digit e-mail code) must not be guessable
// without limit. Counters live in `supplier_auth_attempts` (db/schema.sql) and
// are keyed by a SHA-256 of the e-mail (and, separately and more loosely, of the
// client IP) — never the raw address. The helper is fail-closed: if the counter
// cannot be read, the attempt is refused rather than allowed through.
// Files prefixed "_" are not deployed as serverless functions.
import { createHash } from "node:crypto";
import { DB_ON, sb } from "./_db.js";

export const MAX_FAILS = 5;            // per e-mail, per kind
export const IP_MAX_FAILS = 30;        // per IP, per kind (looser: shared NAT)
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

const mem = new Map();                 // used only when no database is configured
const hash = (v) => createHash("sha256").update(String(v || "").trim().toLowerCase()).digest("hex").slice(0, 40);

export function throttleKeys(kind, email, ip) {
  const keys = [{ key: `${kind}|e|${hash(email)}`, max: MAX_FAILS }];
  if (ip) keys.push({ key: `${kind}|i|${hash(ip)}`, max: IP_MAX_FAILS });
  return keys;
}

async function load(key) {
  if (!DB_ON) return mem.get(key) || null;
  const rows = await sb(`supplier_auth_attempts?key=eq.${encodeURIComponent(key)}&select=key,fails,window_start,locked_until&limit=1`);
  return (rows && rows[0]) || null;
}

async function save(row) {
  if (!DB_ON) { mem.set(row.key, row); return; }
  await sb("supplier_auth_attempts?on_conflict=key", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: [row],
  });
}

async function clear(key) {
  if (!DB_ON) { mem.delete(key); return; }
  await sb(`supplier_auth_attempts?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", prefer: "return=minimal" });
}

// → { blocked:false } or { blocked:true, retryAfter:<seconds>, unavailable?:true }
export async function authBlocked(kind, email, ip, now = Date.now()) {
  try {
    for (const { key } of throttleKeys(kind, email, ip)) {
      const r = await load(key);
      const until = r && r.locked_until ? Date.parse(r.locked_until) : 0;
      if (until > now) return { blocked: true, retryAfter: Math.ceil((until - now) / 1000) };
    }
    return { blocked: false };
  } catch (e) {
    console.error("auth throttle read failed", String(e && e.message || e).slice(0, 120));
    return { blocked: true, retryAfter: 60, unavailable: true };   // fail closed
  }
}

// Record the outcome of one attempt. A success clears the e-mail counter only
// (the IP counter keeps counting so one valid login cannot reset an attacker).
export async function authRecord(kind, email, ip, ok, now = Date.now()) {
  try {
    const keys = throttleKeys(kind, email, ip);
    if (ok) { await clear(keys[0].key); return; }
    for (const { key, max } of keys) {
      const r = await load(key);
      const start = r && r.window_start ? Date.parse(r.window_start) : 0;
      const inWindow = r && start && now - start < WINDOW_MS;
      const fails = (inWindow ? Number(r.fails || 0) : 0) + 1;
      await save({
        key,
        fails,
        window_start: new Date(inWindow ? start : now).toISOString(),
        locked_until: fails >= max ? new Date(now + LOCK_MS).toISOString() : null,
      });
    }
  } catch (e) {
    console.error("auth throttle write failed", String(e && e.message || e).slice(0, 120));
  }
}

export const _resetForTests = () => mem.clear();
