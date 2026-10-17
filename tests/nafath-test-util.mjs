// Shared set-up for the Nafath / client sign-in tests. Not a test itself (no
// ".test" in the name): it fixes the environment BEFORE api/otp.js is imported —
// the modules read OTP_SECRET and the owner list when they load — and gives the
// tests one way to call the handler as a browser would.
//
// Everything runs on the local JSON database and the simulated Nafath provider
// (api/_nafath.js, development only). A fetch that tries to leave the machine
// throws, so a test that reached for a real service would fail loudly.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nafath-"));
process.env.OTP_SECRET = "test-otp-secret-for-nafath-signin-0123456789";
process.env.NAFATH_MOCK_DELAY_MS = "500";
process.env.OWNER_NATIONAL_IDS = "1000000002";
// Read at import by api/_simple.js and api/_trial.js, so they are fixed here, before the imports below.
process.env.PANEL_KEY = "the-real-panel-key";
process.env.OWNER_EMAILS = "owner.mail@example.com,owner.mail2@example.com";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "NAFATH_APP_ID", "NAFATH_PROVIDER", "PANEL_REQUIRE_NAFATH", "NAFATH_DAILY_LIMIT", "GOOGLE_CLIENT_ID"]) delete process.env[k];

globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

export const DB_DIR = process.env.LOCAL_DB_DIR;
export const { default: otpHandler } = await import("../api/otp.js");
export const nafath = await import("../api/_nafath.js");
export const { handleSimple } = await import("../api/_simple.js");

let ipN = 0;
const freshIp = () => `10.${(ipN >> 16) & 255}.${(ipN >> 8) & 255}.${++ipN & 255}`;

function run(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(s) { let json = null; try { json = JSON.parse(s); } catch {} resolve({ status: this.statusCode, json, cookie: this.headers["set-cookie"] || "" }); },
    };
    handler(req, res);
  });
}

/** POST /api/otp. `cookie` is a raw bp_sid value; `ip` pins the source address. */
export function otp(body, { cookie = "", ip = freshIp(), headers = {} } = {}) {
  return run(otpHandler, {
    method: "POST", body,
    headers: { host: "localhost:3000", "x-forwarded-for": ip, ...(cookie ? { cookie: "bp_sid=" + cookie } : {}), ...headers },
  });
}

/** POST /api/simple (the client + ops actions). */
export function simple(body, { cookie = "", query = {} } = {}) {
  return run(handleSimple, {
    method: "POST", body, query,
    headers: { host: "localhost:3000", "x-forwarded-for": freshIp(), ...(cookie ? { cookie: "bp_sid=" + cookie } : {}) },
  });
}

/** The handler's own per-id / per-address Nafath throttle (1 per minute per id). */
export const resetNafathThrottle = () => { if (globalThis.__bpNafathSeen) globalThis.__bpNafathSeen.clear(); };
export const rawCookie = (c) => (/bp_sid=([^;]+)/.exec(c || "") || [])[1] || "";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Everything stored in the local database, as text — to prove what is NOT in it. */
export function dbText() {
  try { return fs.readFileSync(path.join(DB_DIR, "db.json"), "utf8"); } catch { return ""; }
}
export async function dbRows(table) {
  const { sb } = await import("../api/_db.js");
  return sb(`${table}?select=*&limit=500`);
}

/** Run a whole Nafath sign-in with the simulator; returns the final poll answer + cookie. */
export async function nafathSignIn(nationalId, { purpose = "portal", cookie = "" } = {}) {
  resetNafathThrottle();
  const s = await otp({ action: "nafath-start", nationalId, purpose }, { cookie });
  if (!s.json || !s.json.ok) return { start: s, poll: null, cookie: "" };
  await sleep(650);
  const p = await otp({ action: "nafath-poll", challenge: s.json.challenge }, { cookie });
  return { start: s, poll: p, cookie: rawCookie(p.cookie) || cookie };
}
