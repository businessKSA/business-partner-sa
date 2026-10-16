// الدفع المحلي لباقة صاحب العمل: APP_ENV=development ولا مفتاح مُيسّر ⇒ بوابة محاكاة
// يخدمها الخادم نفسه (api/_mode.js). لا بطاقة تُخصم ولا شبكة، والمسار بعد البوابة هو
// مسار الإنتاج بعينه: نفس التحقق ونفس التفعيل ونفس idempotency.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Object.assign(process.env, { APP_ENV: "development" });
for (const k of ["MOYASAR_PUBLISHABLE_KEY", "MOYASAR_SECRET_KEY", "MOYASAR_WEBHOOK_SECRET", "TAMARA_API_TOKEN", "OTP_SECRET",
  "RESEND_API_KEY", "RESEND_KEY", "RESEND", "NOTION_TOKEN", "DAFTRA_API_KEY", "LOCAL_DB"]) delete process.env[k];

const outbound = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("raw.githubusercontent.com") && u.endsWith("catalog.json")) {
    return new Response(JSON.stringify({ services: [], packages: [], discounts: [] }), { status: 200 });
  }
  outbound.push(u);
  throw new Error("a local run must not reach the network: " + u);
};

const activations = new Map();
const calls = [];
const employer = {
  getPlanOffer: (plan, billing) => (plan === "pro" && billing === "yearly"
    ? { amountHalalas: 840000, currency: "SAR", plan, billing, sku: "BP-EMP-PRO-Y" } : null),
  createPendingSubscription: async () => ({ ok: true, reference: "BP-EMPSUB-LOCALTEST22" }),
  activateSubscription: async ({ reference, paymentRef, amountHalalas, billing }) => {
    calls.push({ reference, paymentRef, amountHalalas, billing });
    if (activations.has(paymentRef)) return { ok: true, activated: true, code: "already_processed" };
    activations.set(paymentRef, reference);
    return { ok: true, activated: true };
  },
};
const { __setEmployerForTest, __setSessionForTest } = await import(path.join(ROOT, "api", "_emp-pay.js"));
__setEmployerForTest(employer);
__setSessionForTest(async () => ({ user: { email: "hr@acme.test" } }));
const { default: pay } = await import(path.join(ROOT, "api", "pay.js"));

async function call(method, { query, body } = {}) {
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await pay({ method, headers: {}, query: query || {}, body: body || {}, url: "/api/pay" }, res);
  return out;
}
const order = { ref: "BP-EMPSUB-LOCALTEST22", name: "Ali", email: "hr@acme.test", company: "Acme", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] };

test("local: the checkout is offered the mock gateway, never a live form", async () => {
  const cfg = await call("GET");
  assert.equal(cfg.body.enabled, true);
  assert.equal(cfg.body.mock, true);
  assert.equal(cfg.body.provider, "local-mock");
  assert.equal(cfg.body.publishableKey, null);
  assert.equal(cfg.body.bnpl.tamara, true, "Tamara stays walkable offline (sandbox mock)");
  assert.equal(cfg.body.modes.payments, "test");
  assert.equal(cfg.body.modes.tamara, "sandbox");
});

test("local: a live Moyasar key is refused outright while developing", async () => {
  process.env.MOYASAR_SECRET_KEY = ["sk", "live", "unit00000000000000000000000000000000"].join("_");
  const cfg = await call("GET");
  delete process.env.MOYASAR_SECRET_KEY;
  assert.equal(cfg.status, 503);
  assert.equal(cfg.body.error, "live_keys_in_development");
});

test("local: mock payment → activated once, replay does not repeat, nothing leaves the machine", async () => {
  const price = await call("GET", { query: { action: "emp-offer", sku: "BP-EMP-PRO-Y" } });
  assert.equal(price.body.amountSar, 8400);
  const prep = await call("POST", { body: { action: "emp-prepare", sku: "BP-EMP-PRO-Y", email: "hr@acme.test", company: "Acme" } });
  assert.equal(prep.body.reference, "BP-EMPSUB-LOCALTEST22");

  // البوابة المحلية تعيد id وamount (الإجمالي بعد الضريبة) كما تفعل صفحة الدفع.
  const total = 8400 * 1.15;
  const ok = await call("POST", { body: { id: "mock_card_a1b2c3d4e5f6", amount: total, order } });
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.employer.activated, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { reference: "BP-EMPSUB-LOCALTEST22", paymentRef: "mock_card_a1b2c3d4e5f6", amountHalalas: 840000, billing: "yearly" });

  const again = await call("POST", { body: { id: "mock_card_a1b2c3d4e5f6", amount: total, order } });
  assert.equal(again.body.employer.activated, true);
  assert.equal(activations.size, 1);
  assert.deepEqual(outbound, []);
});

test("local: a mock payment of a different amount activates nothing", async () => {
  activations.clear(); calls.length = 0;
  const r = await call("POST", { body: { id: "mock_card_ffffffffffff", amount: 100, order } });
  assert.equal(r.body.employer.activated, false);
  assert.equal(calls.length, 0);
});

test("local: enterprise cannot be prepared or paid", async () => {
  const prep = await call("POST", { body: { action: "emp-prepare", sku: "BP-EMP-ENTERPRISE-Y", email: "hr@acme.test", company: "Acme" } });
  assert.equal(prep.body.error, "quote_only");
  const pay2 = await call("POST", { body: { id: "mock_card_eeeeeeeeeeee", amount: 21000 * 1.15, order: { ...order, items: [{ id: "BP-EMP-ENTERPRISE-Y", qty: 1 }] } } });
  assert.equal(pay2.body.employer.activated, false);
  assert.equal(calls.length, 0);
});
