// Business Partner — Etimad (اعتماد) API access.
//
// Etimad fronts its APIs with an Apigee-style OAuth2 client-credentials flow:
// exchange a client id and secret for a bearer token, then call the product
// endpoint with it. The token is short-lived, so it is cached and refreshed
// rather than fetched per call.
//
// Underscore-prefixed: a shared module, not a 13th serverless function.

const env = (n, d = "") => (process.env[n] || d).trim();

const CLIENT_ID = env("ETIMAD_CLIENT_ID");
const CLIENT_SECRET = env("ETIMAD_CLIENT_SECRET");
const IS_PROD = /^prod/i.test(env("ETIMAD_ENV", "sandbox"));

// Only the sandbox host is known from Etimad's own portal. The production
// host and token path are issued with the production credentials, so they are
// configuration with no default worth inventing — a wrong guess would send a
// live secret to a host we picked ourselves.
const BASE = env("ETIMAD_BASE_URL", IS_PROD ? "" : "https://sandboxapi.etimad.sa").replace(/\/+$/, "");
const TOKEN_URL = env("ETIMAD_TOKEN_URL", IS_PROD ? "" : "https://sandboxapi.etimad.sa/sandbox/oauth/v2/accesstoken");
const SCOPE = env("ETIMAD_SCOPE", "ReadBanksContracts");

export const etimadConfigured = () => !!(CLIENT_ID && CLIENT_SECRET && TOKEN_URL);

/* --- the token ------------------------------------------------------------
 * Cached until shortly before it expires. The single-flight promise matters
 * on a serverless platform: a burst of requests hitting a cold instance would
 * otherwise each open their own token exchange, and Etimad counts those.
 * ------------------------------------------------------------------------ */
let _tok = null, _tokExp = 0, _inflight = null;

async function fetchToken() {
  // Two encodings are in the wild for the same flow. Basic auth is what the
  // OAuth spec prefers and what Apigee documents; some gateways only read the
  // form body. Rather than guess, try the documented one and fall back —
  // and report which worked, so the answer is knowledge, not luck.
  const attempts = [
    { how: "basic", headers: { authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64") },
      body: new URLSearchParams({ grant_type: "client_credentials", ...(SCOPE ? { scope: SCOPE } : {}) }) },
    { how: "body", headers: {},
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...(SCOPE ? { scope: SCOPE } : {}) }) },
  ];
  let last = null;
  for (const a of attempts) {
    let r, text = "";
    try {
      r = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...a.headers },
        body: a.body.toString(),
      });
      text = await r.text();
    } catch (e) {
      last = { how: a.how, error: "unreachable", detail: String(e.message || e).slice(0, 140) };
      continue;
    }
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    const token = data && (data.access_token || data.accessToken);
    if (r.ok && token) {
      // expires_in is seconds in the spec; some Apigee deployments answer in
      // milliseconds. A value that would mean months is the giveaway.
      let ttl = Number(data.expires_in || data.expiresIn || 3600);
      if (ttl > 86400 * 30) ttl = Math.floor(ttl / 1000);
      return { token, ttl, how: a.how };
    }
    last = { how: a.how, error: `http_${r.status}`, detail: text.slice(0, 200) };
  }
  const err = new Error(last && last.error === "unreachable" ? "etimad_unreachable" : "etimad_token_rejected");
  err.detail = last ? `${last.how}: ${last.detail || last.error}` : "no_attempt";
  throw err;
}

export async function etimadToken({ force = false } = {}) {
  if (!etimadConfigured()) throw new Error("etimad_not_configured");
  if (!force && _tok && Date.now() < _tokExp) return _tok;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const { token, ttl } = await fetchToken();
      _tok = token;
      // Retire it a minute early so a call never starts with a token that
      // expires mid-flight.
      _tokExp = Date.now() + Math.max(30, ttl - 60) * 1000;
      return token;
    } finally { _inflight = null; }
  })();
  return _inflight;
}

/**
 * Call an Etimad endpoint with a bearer token.
 *
 * A 401 is retried once with a freshly minted token: tokens can be revoked or
 * invalidated before their stated expiry, and a cached-but-dead token would
 * otherwise turn into a permanent outage until the instance recycled.
 */
export async function etimadCall(path, { method = "GET", query, body } = {}) {
  if (!BASE) throw new Error("etimad_base_url_missing");
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  const url = `${BASE}${path.startsWith("/") ? path : "/" + path}${qs}`;
  for (const force of [false, true]) {
    const token = await etimadToken({ force });
    let r, text = "";
    try {
      r = await fetch(url, {
        method,
        headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      text = await r.text();
    } catch (e) {
      const err = new Error("etimad_unreachable"); err.detail = String(e.message || e).slice(0, 140); throw err;
    }
    if (r.status === 401 && !force) { _tok = null; _tokExp = 0; continue; }
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) {
      console.error("etimad error", method, path, r.status, text.slice(0, 240));
      const err = new Error(r.status === 404 ? "etimad_not_found" : `etimad_http_${r.status}`);
      err.status = r.status; err.detail = text.slice(0, 240);
      throw err;
    }
    return data;
  }
}

/**
 * Does the credential actually work?
 *
 * Checking that the variables exist proves nothing — a wrong secret sets the
 * variable just as well as a right one. This performs the real exchange and
 * reports what Etimad answered.
 */
export async function etimadPing() {
  const out = {
    configured: etimadConfigured(),
    environment: IS_PROD ? "production" : "sandbox",
    base: BASE || null,
    tokenUrl: TOKEN_URL || null,
    scope: SCOPE,
    missing: [CLIENT_ID ? null : "ETIMAD_CLIENT_ID", CLIENT_SECRET ? null : "ETIMAD_CLIENT_SECRET", TOKEN_URL ? null : "ETIMAD_TOKEN_URL", BASE ? null : "ETIMAD_BASE_URL"].filter(Boolean),
  };
  if (!out.configured) return { ...out, ok: false, error: "not_configured" };
  try {
    const { token, ttl, how } = await fetchToken();
    // Never the token itself — only that one arrived, and its shape.
    return { ...out, ok: true, tokenLength: String(token).length, expiresInSeconds: ttl, auth: how };
  } catch (e) {
    return { ...out, ok: false, error: String(e.message || e), detail: String(e.detail || "").slice(0, 200) };
  }
}
