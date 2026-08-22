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

export const nafathConfigured = () => !!APP_ID;

// The spec contradicts itself: creating a request accepts an id starting with
// 9, checking its status does not. A 9-prefixed id would therefore start a
// verification that could never be completed, so the stricter pattern is
// applied at the door — refusing early beats stranding someone mid-flow.
const ID_CREATE = /^[1234569]\d{9}$/;
const ID_STATUS = /^[123456]\d{9}$/;
export function nationalIdState(id) {
  const v = String(id || "").replace(/\D/g, "");
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
  const out = await call("/api/v1/mfa/request/status", {
    body: { nationalId: id.value, transId: String(transId || ""), random: String(random || "") },
  });
  return { status: (out && out.status) || "UNKNOWN", raw: out };
}

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
    configured: !!APP_ID,
    environment: IS_PROD ? "production" : "staging",
    base: BASE,
    serviceConfigured: !!SERVICE,
    appKeySent: !!APP_KEY,
    // How many identities may open the owner's panels — the count, never the ids.
    owners: ownerIdsConfigured(),
    hashSecret: !!HASH_SECRET,
    missing: [APP_ID ? null : "NAFATH_APP_ID", SERVICE ? null : "NAFATH_SERVICE", HASH_SECRET ? null : "OTP_SECRET"].filter(Boolean),
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
