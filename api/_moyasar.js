// Business Partner — is Moyasar actually connected, and in which mode.
//
// Written because "the variable exists" is not the same claim as "the key
// works", and this project has already lost an evening to the difference. The
// panel asks Moyasar itself and reports what Moyasar answered.
//
// Nothing here ever returns a key, a prefix of a key, or a payment's details —
// only whether the call authenticated, and which environment the key belongs
// to, which is readable from its own public prefix.
//
// Underscore-prefixed: a shared module, not a 13th serverless function.

const PK = (process.env.MOYASAR_PUBLISHABLE_KEY || "").trim();
const SK = (process.env.MOYASAR_SECRET_KEY || "").trim();
const WEBHOOK_SECRET = (process.env.MOYASAR_WEBHOOK_SECRET || "").trim();
// Read the same way api/pay.js reads it, so the panel reports the list the
// payment form actually gets rather than a second opinion about it.
const ALLOWED_METHODS = new Set(["creditcard", "applepay", "stcpay"]);
const RAW_METHODS = (process.env.MOYASAR_METHODS || "creditcard")
  .split(",").map((m) => m.trim().toLowerCase()).filter((m) => ALLOWED_METHODS.has(m));
const PAY_METHODS = RAW_METHODS.length ? RAW_METHODS : ["creditcard"];
const API = "https://api.moyasar.com/v1";

// A Moyasar key names its own environment: pk_live_/sk_live_ vs pk_test_/sk_test_.
// That prefix is not a secret — it is the part printed in their dashboard —
// and knowing it is the difference between "no payments yet" and "you have
// been taking test payments all week".
function modeOf(key) {
  if (!key) return "";
  if (/^(pk|sk)_live_/.test(key)) return "live";
  if (/^(pk|sk)_test_/.test(key)) return "test";
  return "unknown";
}

// The three variables, reported by presence and shape only.
export function moyasarVars() {
  return {
    publishable: { set: !!PK, mode: modeOf(PK), name: "MOYASAR_PUBLISHABLE_KEY" },
    secret: { set: !!SK, mode: modeOf(SK), name: "MOYASAR_SECRET_KEY" },
    webhook: { set: !!WEBHOOK_SECRET, length: WEBHOOK_SECRET.length, name: "MOYASAR_WEBHOOK_SECRET" },
    // Which wallets the buyer is actually offered. Apple Pay only shows on
    // Apple devices, so "is it on?" cannot be answered by looking at the site
    // from a laptop running Chrome — it is answered here.
    methods: PAY_METHODS,
    applePayOn: PAY_METHODS.includes("applepay"),
    stcPayOn: PAY_METHODS.includes("stcpay"),
    missing: [
      PK ? null : "MOYASAR_PUBLISHABLE_KEY",
      SK ? null : "MOYASAR_SECRET_KEY",
      WEBHOOK_SECRET ? null : "MOYASAR_WEBHOOK_SECRET",
    ].filter(Boolean),
    // Both keys must describe the same environment or the form and the
    // verification disagree about which account is being charged.
    modeMatch: !PK || !SK || modeOf(PK) === modeOf(SK),
  };
}

// Ask Moyasar whether this secret key is real. A listing of one payment is the
// cheapest authenticated call their API offers; the payment itself is thrown
// away — only the status code is the answer.
export async function moyasarPing() {
  const vars = moyasarVars();
  if (!SK) return { ok: false, error: "secret_key_missing", vars };
  try {
    const r = await fetch(`${API}/payments?limit=1`, {
      headers: { Authorization: `Basic ${Buffer.from(`${SK}:`).toString("base64")}` },
    });
    if (r.status === 401) return { ok: false, error: "unauthorized", status: 401, vars };
    if (!r.ok) return { ok: false, error: `http_${r.status}`, status: r.status, vars };
    let count = null;
    try { const d = await r.json(); count = d && d.meta && typeof d.meta.total_count === "number" ? d.meta.total_count : null; } catch {}
    return { ok: true, status: r.status, mode: vars.secret.mode, paymentsSoFar: count, vars };
  } catch (e) {
    return { ok: false, error: String(e.message || "network_failed").slice(0, 80), vars };
  }
}
