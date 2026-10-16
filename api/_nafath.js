// Business Partner — identity verification through Nafath (Elm's MFA API).
//
// The flow the API describes, in the order it happens:
//   1. we create a request for a national id; Elm returns a transId and a
//      two-digit `random`
//   2. the user is shown that number, opens the Nafath app, and picks the
//      matching one out of several — which is the whole anti-phishing device:
//      a fake site cannot show the number the real request generated
//   3. we poll for status until COMPLETED / REJECTED / EXPIRED
//   4. anything Nafath asserts is trusted only after its signature is checked
//      against the JWK Elm publishes
//
// APP-ID is a credential: every call runs on the server, never from a browser.
//
// Underscore-prefixed: a shared module, not a 13th serverless function.

import crypto from "node:crypto";
import { DEV } from "./_mode.js";
import { DB_ON, sb } from "./_db.js";
import { asciiDigits } from "./_clientauth.js";
import rabet from "./_nafath-rabet.js";

const env = (n, d = "") => (process.env[n] || d).trim();
const APP_ID = env("NAFATH_APP_ID");
// Some Elm deployments also require an APP-KEY alongside APP-ID; the published
// spec lists only APP-ID, so the second header is sent when configured and
// omitted when it is not, rather than guessed at.
const APP_KEY = env("NAFATH_APP_KEY");
const IS_PROD = /^prod/i.test(env("NAFATH_ENV", "stg"));
const BASE = env("NAFATH_BASE_URL", IS_PROD ? "https://nafath.api.elm.sa" : "https://nafath.api.elm.sa/stg").replace(/\/+$/, "");
// The service name Elm registered for this consumer. It is account-specific,
// so it is configuration and has no default worth inventing.
const SERVICE = env("NAFATH_SERVICE");

/* --- which provider answers --------------------------------------------------
 * One interface, whoever stands behind it:
 *     request({ nationalId, locale, service }) → { requestId, transId, random }
 *     status({ nationalId, transId, random })  → { status, raw }
 * NAFATH_PROVIDER picks the implementation: "elm" (the default — today's
 * behaviour, untouched), "rabet" (api/_nafath-rabet.js, a skeleton that refuses
 * with not_implemented until its documentation arrives), or "mock" (local
 * development only: a stateless simulation so the sign-in screens can be walked
 * with no Nafath account — it does not exist outside APP_ENV=development).
 * An unrecognised value is an error, not a silent fall-back to Elm: a typo must
 * not change who is asked to verify an identity.
 */
const rawProvider = () => env("NAFATH_PROVIDER").toLowerCase();
export function nafathProviderName() {
  const p = rawProvider();
  if (!p) return DEV && !APP_ID ? "mock" : "elm";
  return p;
}
function pickProvider() {
  const n = nafathProviderName();
  if (n === "elm") return elmProvider;
  if (n === "rabet") return rabet;
  if (n === "mock" && DEV) return mockProvider;
  const e = new Error("nafath_provider_unknown"); e.provider = n; throw e;
}
export function nafathConfigured() {
  try { return !!pickProvider().configured(); } catch { return false; }
}

// The spec contradicts itself: creating a request accepts an id starting with
// 9, checking its status does not. A 9-prefixed id would therefore start a
// verification that could never be completed, so the stricter pattern is
// applied at the door — refusing early beats stranding someone mid-flow.
const ID_CREATE = /^[1234569]\d{9}$/;
const ID_STATUS = /^[123456]\d{9}$/;
// The first digits the status call accepts — the sign-in page mirrors this one
// rule in the browser (a test holds the two together), so a mistyped id is
// caught before it rings anyone's phone.
export const NATIONAL_ID_FIRST_DIGITS = "123456";
export function nationalIdState(id) {
  const v = asciiDigits(id).replace(/\D/g, "");
  if (!/^\d{10}$/.test(v)) return { ok: false, reason: "must_be_10_digits" };
  if (!ID_CREATE.test(v)) return { ok: false, reason: "bad_prefix" };
  // Accepted by create, rejected by status — unusable end to end.
  if (!ID_STATUS.test(v)) return { ok: false, reason: "unsupported_prefix_9" };
  return { ok: true, value: v };
}

async function call(path, { method = "POST", query, body } = {}) {
  if (!APP_ID) throw new Error("nafath_not_configured");
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  const headers = { "APP-ID": APP_ID, "content-type": "application/json;charset=utf-8", accept: "application/json" };
  if (APP_KEY) headers["APP-KEY"] = APP_KEY;
  let r;
  try {
    r = await fetch(`${BASE}${path}${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    const err = new Error("nafath_unreachable"); err.detail = String(e.message || "").slice(0, 120); throw err;
  }
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    console.error("nafath error", method, path, r.status, text.slice(0, 300));
    const err = new Error(r.status === 401 || r.status === 403 ? "nafath_unauthorized" : `nafath_http_${r.status}`);
    err.detail = text.slice(0, 300);
    throw err;
  }
  return data;
}

/**
 * Start a verification. Returns the transaction and the two-digit number that
 * MUST be shown to the user — without it they cannot tell our request apart
 * from anyone else's, which is the point of the mechanism.
 */
export async function nafathRequest({ nationalId, locale = "ar", service }) {
  const id = nationalIdState(nationalId);
  if (!id.ok) { const e = new Error("bad_national_id"); e.reason = id.reason; throw e; }
  return pickProvider().request({ nationalId: id.value, locale, service });
}

async function elmRequest({ nationalId, locale = "ar", service }) {
  const id = { value: nationalId };
  const svc = service || SERVICE;
  if (!svc) throw new Error("nafath_service_not_configured");
  const requestId = crypto.randomUUID();
  const out = await call("/api/v1/mfa/request", {
    query: { local: locale === "en" ? "en" : "ar", requestId },
    body: { nationalId: id.value, service: svc },
  });
  return { requestId, transId: out && out.transId, random: out && out.random };
}

/** WAITING | EXPIRED | REJECTED | COMPLETED */
export async function nafathStatus({ nationalId, transId, random }) {
  const id = nationalIdState(nationalId);
  if (!id.ok) { const e = new Error("bad_national_id"); e.reason = id.reason; throw e; }
  return pickProvider().status({ nationalId: id.value, transId, random });
}

async function elmStatus({ nationalId, transId, random }) {
  const id = { value: nationalId };
  const out = await call("/api/v1/mfa/request/status", {
    body: { nationalId: id.value, transId: String(transId || ""), random: String(random || "") },
  });
  return { status: (out && out.status) || "UNKNOWN", raw: out };
}

const elmProvider = { name: "elm", configured: () => !!APP_ID, request: elmRequest, status: elmStatus };

/* Local simulation. Stateless on purpose (the dev server re-reads api/ on every
 * request, so memory would not survive): the transaction id carries its own
 * start time. A national id ending in 7 is REJECTED, ending in 8 EXPIRES, any
 * other COMPLETES after NAFATH_MOCK_DELAY_MS (default 6 s). */
const MOCK_DELAY = Math.max(500, Number(env("NAFATH_MOCK_DELAY_MS", "6000")) || 6000);
const mockProvider = {
  name: "mock",
  configured: () => DEV,
  async request({ nationalId }) {
    const transId = "mock-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex");
    const random = String(10 + (crypto.createHash("sha256").update(transId + nationalId).digest()[0] % 90));
    return { requestId: crypto.randomUUID(), transId, random };
  },
  async status({ nationalId, transId }) {
    const t0 = Number(String(transId).split("-")[1]) || 0;
    if (Date.now() - t0 < MOCK_DELAY) return { status: "WAITING", raw: null };
    const last = String(nationalId).slice(-1);
    return { status: last === "7" ? "REJECTED" : last === "8" ? "EXPIRED" : "COMPLETED", raw: null };
  },
};

// Elm's public keys, cached. Refetched when a token names a key we have not
// seen, so a rotation does not need a deploy.
let _jwks = null, _jwksAt = 0;
export async function nafathJwk({ force = false } = {}) {
  if (!force && _jwks && Date.now() - _jwksAt < 6 * 60 * 60 * 1000) return _jwks;
  const out = await call("/api/v1/mfa/jwk", { method: "GET" });
  _jwks = out; _jwksAt = Date.now();
  return out;
}

function keysFrom(jwks) {
  if (!jwks) return [];
  if (Array.isArray(jwks.keys)) return jwks.keys;
  if (jwks.kty) return [jwks];
  return [];
}

/**
 * Verify a Nafath-issued JWT and return its payload.
 *
 * A status of COMPLETED read out of an unverified body proves nothing: anyone
 * who can reach the callback could assert it. Only a signature Elm's published
 * key validates is evidence, so an unverifiable token is treated as a failure
 * rather than as a slow path.
 */
export async function nafathVerify(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false, error: "malformed_token" };
  let header;
  try { header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { return { ok: false, error: "bad_header" }; }
  if (!/^RS(256|384|512)$/.test(String(header.alg || ""))) return { ok: false, error: `unsupported_alg_${header.alg}` };

  const signed = `${parts[0]}.${parts[1]}`;
  const sig = Buffer.from(parts[2], "base64url");
  const algo = { RS256: "sha256", RS384: "sha384", RS512: "sha512" }[header.alg];

  for (const force of [false, true]) {
    let keys = [];
    try { keys = keysFrom(await nafathJwk({ force })); } catch { return { ok: false, error: "jwk_unreachable" }; }
    const candidates = header.kid ? keys.filter((k) => k.kid === header.kid) : keys;
    for (const jwk of candidates.length ? candidates : keys) {
      try {
        const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
        if (crypto.verify(algo, Buffer.from(signed), key, sig)) {
          let payload = {};
          try { payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); } catch {}
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && now > Number(payload.exp) + 60) return { ok: false, error: "expired" };
          return { ok: true, payload, kid: header.kid || null };
        }
      } catch { /* wrong key shape — try the next */ }
    }
    // Signature matched nothing we hold: refetch once in case a key rotated.
  }
  return { ok: false, error: "signature_not_verified" };
}

// Configuration only — never the app id itself.
export function nafathPing() {
  return {
    configured: nafathConfigured(),
    provider: nafathProviderName(),
    dailyLimit: nafathDailyLimit(),
    environment: IS_PROD ? "production" : "staging",
    base: BASE,
    serviceConfigured: nafathProviderName() !== "elm" || !!SERVICE,
    appKeySent: !!APP_KEY,
    // How many identities may open the owner's panels — the count, never the ids.
    owners: ownerIdsConfigured(),
    hashSecret: !!HASH_SECRET,
    missing: [nafathProviderName() !== "elm" || APP_ID ? null : "NAFATH_APP_ID", nafathProviderName() !== "elm" || SERVICE ? null : "NAFATH_SERVICE", HASH_SECRET ? null : "OTP_SECRET"].filter(Boolean),
  };
}

/* ---------------------------------------------------------------------------
 * Who is allowed where.
 *
 * OWNER_NATIONAL_IDS lists the identities that may open the owner's panels —
 * /admin and anything else private to him. It is deliberately an allowlist of
 * people, not a password: a shared key can be forwarded, copied out of a
 * browser, or pasted into a chat, and it says nothing about who used it.
 * ------------------------------------------------------------------------- */

// The secret that makes the stored identity unreadable. A plain SHA-256 of a
// national id is not a hash in any useful sense — there are only ten billion
// of them, so the whole space can be enumerated on a laptop. Keyed with a
// server secret, the digest is worthless to anyone who does not hold the key.
const HASH_SECRET = env("NAFATH_HASH_SECRET") || env("OTP_SECRET");

/** A stable, non-reversible handle for a national id. Never store the raw. */
export function nafathIdHash(nationalId) {
  const v = String(nationalId || "").replace(/\D/g, "");
  if (!v || !HASH_SECRET) return "";
  return crypto.createHmac("sha256", HASH_SECRET).update("nafath:" + v).digest("base64url");
}

function ownerIds() {
  return env("OWNER_NATIONAL_IDS").split(/[\s,;]+/).map((s) => s.replace(/\D/g, "")).filter((s) => /^\d{10}$/.test(s));
}

export const ownerIdsConfigured = () => ownerIds().length;

/** Is this national id one of the owner's? Compared as digests, never logged. */
export function isOwnerId(nationalId) {
  const h = nafathIdHash(nationalId);
  if (!h) return false;
  return ownerIds().some((id) => {
    const a = Buffer.from(nafathIdHash(id)), b = Buffer.from(h);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/* --- Sealed state -----------------------------------------------------------
 * Two things travel through the browser and must not be trusted on the way
 * back: the pending verification (which national id is being checked) and the
 * proof that it succeeded. Both are sealed with AES-256-GCM under the server
 * secret, so the browser carries them but cannot read or forge either. In
 * particular the national id never reaches the client, and the ticket that
 * opens the panel carries only a digest.
 * -------------------------------------------------------------------------- */
const sealKey = () => crypto.createHash("sha256").update(HASH_SECRET).digest();

export function nafathSeal(obj) {
  if (!HASH_SECRET) throw new Error("nafath_secret_missing");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", sealKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function nafathUnseal(token) {
  if (!HASH_SECRET) return null;
  try {
    const raw = Buffer.from(String(token || ""), "base64url");
    if (raw.length < 29) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", sealKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const obj = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
    if (obj && obj.exp && Date.now() > Number(obj.exp)) return null;
    return obj;
  } catch { return null; }
}

// How long a panel session lasts before the owner verifies again.
const TICKET_TTL_MS = Number(env("PANEL_TICKET_HOURS", "12")) * 60 * 60 * 1000;

export function mintOwnerTicket(nationalId) {
  if (!isOwnerId(nationalId)) return null;
  return nafathSeal({ t: "panel", nid: nafathIdHash(nationalId), exp: Date.now() + TICKET_TTL_MS });
}

/**
 * Does this ticket open the owner's panels?
 *
 * The allowlist is consulted again here, not only when the ticket was minted.
 * Removing an identity from OWNER_NATIONAL_IDS therefore shuts the door on the
 * next request rather than whenever the outstanding tickets happen to expire.
 */
export function ownerTicketOk(ticket) {
  const t = nafathUnseal(ticket);
  if (!t || t.t !== "panel" || !t.nid) return false;
  return ownerIds().some((id) => {
    const a = Buffer.from(nafathIdHash(id)), b = Buffer.from(String(t.nid));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/**
 * Should the owner's panels refuse a bare key?
 *
 * Off by default, and that default is deliberate: turning identity on before
 * a real Nafath verification has ever succeeded would lock the owner out of
 * his own panel with no way back in except a Vercel env edit. He flips this to
 * 1 once he has seen his own identity open the door, and from that moment the
 * shared key stops being a way in.
 */
export const panelRequiresNafath = () => /^(1|true|yes)$/i.test(env("PANEL_REQUIRE_NAFATH"));

/* ---------------------------------------------------------------------------
 * The daily meter.
 *
 * Every request rings a real person's phone and, with a commercial provider,
 * is billed. Without a ceiling, one script could spend a month's allowance in
 * an afternoon — so the number of requests started per Riyadh day is counted
 * and refused past NAFATH_DAILY_LIMIT (default 1000), with a warning logged
 * (and a row left in audit_logs for the owner's dashboard) once 80% is used.
 *
 * Counting lives where the platform already keeps its tallies: rows in
 * audit_logs (action "nafath.request"), the same table the hiring meter uses,
 * so the count survives restarts and is shared by every function instance. A
 * per-instance counter sits in front of it and the table is re-read at most
 * every 30 seconds. If the table cannot be read the memory count alone decides
 * — the meter must never be the reason a client cannot sign in.
 *
 * The owner's own panel sign-in is counted but never refused: a flood of
 * public requests must not be able to lock him out of his own screens.
 * ------------------------------------------------------------------------- */
export const NAFATH_REQUEST_ACTION = "nafath.request";
export const NAFATH_ALERT_ACTION = "nafath.alert";
const RIYADH_OFFSET_MS = 3 * 3600 * 1000;
export const riyadhDayStart = (now = Date.now()) =>
  new Date(Math.floor((now + RIYADH_OFFSET_MS) / 86400000) * 86400000 - RIYADH_OFFSET_MS);
export function nafathDailyLimit() {
  const v = Math.floor(Number(env("NAFATH_DAILY_LIMIT", "1000")));
  return Number.isFinite(v) && v > 0 ? v : 1000;
}
const ALERT_AT = 0.8;
const meter = (globalThis.__bpNafathMeter ||= { day: "", n: 0, readAt: 0, alerted: false });

async function meterSync(now) {
  const since = riyadhDayStart(now);
  const key = since.toISOString();
  if (meter.day !== key) { meter.day = key; meter.n = 0; meter.readAt = 0; meter.alerted = false; }
  if (!DB_ON || now - meter.readAt < 30000) return;
  meter.readAt = now;
  try {
    const cap = nafathDailyLimit() + 1;
    const rows = await sb(`audit_logs?action=eq.${NAFATH_REQUEST_ACTION}&created_at=gte.${encodeURIComponent(key)}&select=id&limit=${cap}`);
    if (Array.isArray(rows)) meter.n = Math.max(meter.n, rows.length);
  } catch (e) { console.warn("nafath meter read failed", String(e && e.message || e).slice(0, 120)); }
}

/** { used, limit, remaining, ratio } for today (Riyadh day). */
export async function nafathUsage(now = Date.now()) {
  await meterSync(now);
  const limit = nafathDailyLimit();
  return { used: meter.n, limit, remaining: Math.max(0, limit - meter.n), ratio: meter.n / limit, day: meter.day };
}

/** May a new request start? The panel is never refused; everyone else is at the ceiling. */
export async function nafathQuota({ purpose = "portal", now = Date.now() } = {}) {
  const u = await nafathUsage(now);
  if (purpose === "panel") return { ok: true, ...u };
  return { ok: u.used < u.limit, reason: u.used < u.limit ? null : "daily_limit", ...u };
}

/** Count one request that Nafath really accepted. Never throws. */
export async function nafathQuotaRecord({ purpose = "portal", now = Date.now() } = {}) {
  try {
    await meterSync(now);
    meter.n += 1;
    const limit = nafathDailyLimit();
    if (DB_ON) {
      try { await sb("audit_logs", { method: "POST", prefer: "return=minimal", body: [{ action: NAFATH_REQUEST_ACTION, actor_label: "nafath:" + purpose, after: { purpose } }] }); } catch {}
    }
    if (!meter.alerted && meter.n >= Math.ceil(limit * ALERT_AT)) {
      meter.alerted = true;
      console.warn(`[nafath] daily usage at ${Math.round((meter.n / limit) * 100)}% (${meter.n}/${limit}) — requests are refused at ${limit}`);
      if (DB_ON) {
        try {
          const dup = await sb(`audit_logs?action=eq.${NAFATH_ALERT_ACTION}&created_at=gte.${encodeURIComponent(meter.day)}&select=id&limit=1`);
          if (!dup.length) await sb("audit_logs", { method: "POST", prefer: "return=minimal", body: [{ action: NAFATH_ALERT_ACTION, actor_label: "nafath:meter", after: { used: meter.n, limit, threshold: ALERT_AT } }] });
        } catch {}
      }
    }
    return { used: meter.n, limit };
  } catch { return null; }
}

/* ---------------------------------------------------------------------------
 * The account a first Nafath sign-in creates.
 *
 * Nafath proves WHO a person is; it returns no mailbox. A client signing in
 * for the first time therefore gets an account at once, keyed by the keyed
 * digest of the national id (nafathIdHash — the raw number is never stored),
 * under a placeholder address that cannot receive mail (the reserved .invalid
 * TLD). The first screen after sign-in asks for the real e-mail and mobile,
 * once; until they are confirmed the account can look but not act.
 * ------------------------------------------------------------------------- */
export const NAFATH_PLACEHOLDER_DOMAIN = "nafath.invalid";
export const NAFATH_ORG_LABEL = "حسابي";
export function nafathPlaceholderEmail(hash) {
  if (!hash) return "";
  return "nafath-" + crypto.createHash("sha256").update("placeholder:" + hash).digest("hex").slice(0, 24) + "@" + NAFATH_PLACEHOLDER_DOMAIN;
}
export const isNafathPlaceholderEmail = (e) => String(e || "").toLowerCase().endsWith("@" + NAFATH_PLACEHOLDER_DOMAIN);
