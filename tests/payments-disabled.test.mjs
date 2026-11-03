// Payments switched off on staging (PAYMENTS_DISABLED=1 or APP_ENV=staging).
//
// Staging carries the real pk_live_/sk_live_ keys; this pins that every payment
// path is refused with no outbound call and no key in the reply, and that
// production (neither variable set) behaves exactly as before.
import test from "node:test";
import assert from "node:assert/strict";

process.env.MOYASAR_PUBLISHABLE_KEY = "pk_live_TESTONLYNOTREAL";
process.env.MOYASAR_SECRET_KEY = "sk_live_TESTONLYNOTREAL";
process.env.MOYASAR_WEBHOOK_SECRET = "whsec_test";
delete process.env.PAYMENTS_DISABLED;
delete process.env.APP_ENV;

const { default: handler } = await import("../api/pay.js");
const { paymentsDisabled, payGuard } = await import("../api/_mode.js");
const { moyasarPing, mpfCheck } = await import("../api/_moyasar.js");

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => { calls.push(String(u)); return new Response("{}", { status: 200 }); };

function run(method, { query = {}, body } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
      end(t) { resolve({ status: this.statusCode, json: t ? JSON.parse(t) : null, raw: t || "" }); },
    };
    handler({ method, query, headers: {}, url: "/api/pay", body: body ?? {} }, res);
  });
}

const POSTS = [
  { action: "reconcile", key: "x" },
  { action: "bnpl-checkout" },
  { action: "bnpl-verify" },
  { id: "pay_123", amount: 345, order: { metadata: {} } },       // card verify/settle
  { type: "payment_paid", data: { id: "pay_123", status: "paid" } }, // webhook shape
];

for (const flag of [{ PAYMENTS_DISABLED: "1" }, { APP_ENV: "staging" }]) {
  test(`disabled via ${Object.keys(flag)[0]}: POSTs refused 403, no outbound call`, async () => {
    Object.assign(process.env, flag);
    try {
      assert.equal(paymentsDisabled(), true);
      for (const body of POSTS) {
        const before = calls.length;
        const r = await run("POST", { body });
        assert.equal(r.status, 403, JSON.stringify(body));
        assert.equal(r.json.error, "payments_disabled");
        assert.match(r.json.message, /الدفع معطّل على النسخة التجريبية/);
        assert.equal(calls.length, before, "no fetch for " + JSON.stringify(body));
      }
    } finally { for (const k of Object.keys(flag)) delete process.env[k]; }
  });
}

test("disabled: config exposes no key and modeMatch=false", async () => {
  process.env.PAYMENTS_DISABLED = "1";
  try {
    const r = await run("GET", { query: { action: "config" } });
    assert.equal(r.status, 503);
    assert.equal(r.json.enabled, false);
    assert.equal(r.json.modeMatch, false);
    assert.equal(r.json.publishableKey, null);
    assert.ok(!/pk_live_|sk_live_/.test(r.raw), "no key anywhere in the reply");
    assert.equal(payGuard().ok, false);
  } finally { delete process.env.PAYMENTS_DISABLED; }
});

test("disabled: moyasarPing and mpfCheck make no outbound call", async () => {
  process.env.PAYMENTS_DISABLED = "1";
  try {
    const before = calls.length;
    const p = await moyasarPing();
    const m = await mpfCheck();
    assert.equal(p.ok, false); assert.equal(p.error, "payments_disabled");
    assert.equal(m.ok, false);
    assert.equal(calls.length, before);
  } finally { delete process.env.PAYMENTS_DISABLED; }
});

test("production (variable absent) is unchanged", async () => {
  assert.equal(paymentsDisabled(), false);
  assert.equal(payGuard().ok, true);
  const r = await run("GET", { query: { action: "config" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.enabled, true);
  assert.equal(r.json.modeMatch, true);
  assert.equal(r.json.publishableKey, process.env.MOYASAR_PUBLISHABLE_KEY);
  // A POST reaches the normal flow (reconcile with no panel key → 401, not 403).
  const p = await run("POST", { body: { action: "reconcile" } });
  assert.notEqual(p.status, 403);
  for (const v of ["0", "", "false"]) {
    process.env.PAYMENTS_DISABLED = v;
    assert.equal(paymentsDisabled(), false, "value " + JSON.stringify(v));
  }
  delete process.env.PAYMENTS_DISABLED;
  process.env.APP_ENV = "production";
  assert.equal(paymentsDisabled(), false);
  delete process.env.APP_ENV;
});

test.after(() => { globalThis.fetch = realFetch; });
