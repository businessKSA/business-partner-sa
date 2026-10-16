// Business Partner — Nafath through «رابط» (Rabet, rabet.sa).
//
// Selected with NAFATH_PROVIDER=rabet (api/_nafath.js). Built from the OpenAPI
// document the owner downloaded from the provider's page (nafath-app.json,
// 2026-10-16) — nothing here is guessed:
//
//   POST {base}/api/v1/mfa/request?local=ar|en&requestId=<ours>
//        headers  APP-ID, APP-KEY   (the document lists app_id / app_key as well,
//                                    so both spellings are sent)
//        body     { nationalId, service }
//        200      { transId, random }          random = the two-digit number
//                                               the user must pick in the app
//   POST {base}/api/v1/mfa/request/status
//        body     { nationalId, transId, random }
//        200      { status: WAITING | EXPIRED | REJECTED | COMPLETED }
//
// What the document does NOT say, and therefore stays configuration:
//   RABET_BASE_URL  the address requests go to. The document's only server is
//                   «mock-service.api.elm.sa/nafath» (a mock that answers
//                   403 without credentials); the provider's real address is
//                   shown in the owner's rabet.sa portal. There is no default.
//   RABET_SERVICE   the "service" value of this account — account-specific.
//   RABET_APP_ID / RABET_APP_KEY   the credentials. They are read from the
//                   server's environment only, never logged, never returned.
//
// The contract the rest of the system relies on is unchanged:
//   request({ nationalId, locale, service }) → { requestId, transId, random }
//   status({ nationalId, transId, random })  → { status, raw }
// Underscore-prefixed: a shared module, not a 13th serverless function.

import crypto from "node:crypto";

const env = (n) => String(process.env[n] || "").trim();
const TIMEOUT_MS = 12000;

const base = () => env("RABET_BASE_URL").replace(/\/+$/, "");
const missing = () => ["RABET_APP_ID", "RABET_APP_KEY", "RABET_BASE_URL", "RABET_SERVICE"].filter((n) => !env(n));

// The base must be an absolute https address. A value without a scheme (the
// document writes its server that way) is taken as https; plain http is refused
// because the credentials travel in headers.
function baseUrl() {
  let b = base();
  if (!b) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(b)) b = "https://" + b;
  return /^https:\/\/[^/\s]+/i.test(b) ? b : "";
}

async function call(path, { query, body } = {}) {
  const b = baseUrl();
  const id = env("RABET_APP_ID"), key = env("RABET_APP_KEY");
  if (!b || !id || !key) { const e = new Error("nafath_not_configured"); e.provider = "rabet"; throw e; }
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  const headers = {
    "APP-ID": id, "APP-KEY": key, app_id: id, app_key: key,
    "content-type": "application/json;charset=utf-8", accept: "application/json",
  };
  let r;
  try {
    r = await fetch(`${b}${path}${qs}`, { method: "POST", headers, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const err = new Error("nafath_unreachable"); err.provider = "rabet"; err.detail = String((e && e.name) || "").slice(0, 60); throw err;
  }
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    // The body of a refusal can echo a header; log the status and a short, non-credential hint only.
    console.error("nafath rabet error", path, r.status);
    const err = new Error(r.status === 401 || r.status === 403 ? "nafath_unauthorized" : `nafath_http_${r.status}`);
    err.provider = "rabet"; err.detail = `status ${r.status}`;
    throw err;
  }
  return data;
}

const STATUSES = new Set(["WAITING", "EXPIRED", "REJECTED", "COMPLETED"]);

export default {
  name: "rabet",
  configured: () => missing().length === 0 && !!baseUrl(),
  missing,

  async request({ nationalId, locale = "ar", service }) {
    const svc = String(service || env("RABET_SERVICE") || "");
    if (!svc) { const e = new Error("nafath_service_not_configured"); e.provider = "rabet"; throw e; }
    const requestId = crypto.randomUUID();
    // `local` (sic) is the document's own spelling of the query parameter.
    const out = await call("/api/v1/mfa/request", {
      query: { local: locale === "en" ? "en" : "ar", requestId },
      body: { nationalId, service: svc },
    });
    const transId = out && out.transId, random = out && out.random;
    if (!transId || !/^\d{2}$/.test(String(random || ""))) { const e = new Error("nafath_bad_response"); e.provider = "rabet"; throw e; }
    return { requestId, transId: String(transId), random: String(random) };
  },

  async status({ nationalId, transId, random }) {
    const out = await call("/api/v1/mfa/request/status", { body: { nationalId, transId, random } });
    const s = String((out && out.status) || "").toUpperCase();
    if (!STATUSES.has(s)) { const e = new Error("nafath_bad_response"); e.provider = "rabet"; throw e; }
    return { status: s, raw: { status: s } };
  },
};
