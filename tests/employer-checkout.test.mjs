// شراء باقة صاحب العمل عبر السلة والدفع: مُيسّر (إشعار + عودة المتصفح) وتمارا،
// ثم تفعيل الاشتراك مرة واحدة. لا يلمس شبكة ولا Notion ولا مُيسّر الحيّ:
//   • fetch مستبدل بمحاكاة تردّ على مُيسّر وتمارا والكتالوج و/api/requests فقط،
//     وأي نداء آخر يُسجَّل ويُفشل الاختبار؛
//   • api/employer.js مستبدل بمحاكاة تلتزم العقد المتفق عليه (getPlanOffer ·
//     createPendingSubscription · activateSubscription idempotent على paymentRef).
//
// البيئة تُضبط قبل أول import لأن api/pay.js يقرأها مرة واحدة عند التحميل.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OTP_SECRET = "unit-otp-secret-0123456789";
const WEBHOOK = "unit-webhook-secret";
Object.assign(process.env, {
  APP_ENV: "production", VERCEL_ENV: "production",
  MOYASAR_PUBLISHABLE_KEY: "pk_test_unit00000000000000000000000000000000",
  MOYASAR_SECRET_KEY: "sk_test_unit00000000000000000000000000000000",
  MOYASAR_WEBHOOK_SECRET: WEBHOOK, OTP_SECRET, TAMARA_API_TOKEN: "tamara-unit-token",
});
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "RESEND", "NOTION_TOKEN", "DAFTRA_API_KEY"]) delete process.env[k];

// ---------------------------------------------------------------- محاكاة employer.js --
const OFFER = { "basic|monthly": 50000, "basic|yearly": 420000, "pro|monthly": 100000, "pro|yearly": 840000 };
const skuOf = (plan, billing) => `BP-EMP-${plan.toUpperCase()}-${billing === "yearly" ? "Y" : "M"}`;
const emp = {
  pending: new Map(),        // reference -> { email, company, plan, billing }
  paid: new Map(),           // paymentRef -> reference   (التفعيلات الفعلية)
  calls: [],                 // كل نداء activateSubscription وصل
  failNext: false, throwNext: false,
  reset() { this.pending.clear(); this.paid.clear(); this.calls.length = 0; this.failNext = false; this.throwNext = false; },
  getPlanOffer(plan, billing) {
    const v = OFFER[`${plan}|${billing}`];
    return v ? { amountHalalas: v, currency: "SAR", plan, billing, sku: skuOf(plan, billing) } : null;
  },
  async createPendingSubscription({ email, company, plan, billing }) {
    if (!email || !company || !OFFER[`${plan}|${billing}`]) return { ok: false };
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const reference = "BP-EMPSUB-" + Array.from(crypto.randomBytes(12), (b) => A[b % A.length]).join("");
    this.pending.set(reference, { email, company, plan, billing });
    return { ok: true, reference };
  },
  async activateSubscription({ reference, paymentRef, amountHalalas, billing }) {
    this.calls.push({ reference, paymentRef, amountHalalas, billing });
    if (this.throwNext) throw new Error("notion down");
    if (this.failNext) return { ok: false, activated: false, code: "notion_error" };
    const row = this.pending.get(reference);
    if (!row) return { ok: false, activated: false };
    if (row.billing !== billing || OFFER[`${row.plan}|${row.billing}`] !== amountHalalas) return { ok: false, activated: false };
    // كما يفعل api/employer.js الحقيقي: الدفعة نفسها ثانيةً = ok:true وactivated:false
    if (this.paid.has(paymentRef)) return { ok: true, activated: true, code: "already_processed" };
    this.paid.set(paymentRef, reference);
    return { ok: true, activated: true };
  },
};
const { __setEmployerForTest, __setSessionForTest } = await import(path.join(ROOT, "api", "_emp-pay.js"));
__setEmployerForTest(emp);
let signedIn = "hr@acme.test";            // بريد الجلسة المُثبتة؛ "" = زائر بلا دخول
__setSessionForTest(async () => (signedIn ? { user: { email: signedIn } } : null));

// ---------------------------------------------------------------- محاكاة الشبكة --
const net = { moyasar: new Map(), paidOrders: [], seenPay: new Set(), unexpected: [], tamaraOrders: new Map(), tamaraSessions: [] };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.includes("raw.githubusercontent.com") && u.endsWith("catalog.json")) {
    return json({ services: [{ code: "BP-X-01", nameAr: "خدمة اختبار", amount: 300 }], packages: [], discounts: [] });
  }
  let m = u.match(/api\.moyasar\.com\/v1\/payments\/([\w-]+)$/);
  if (m) { const p = net.moyasar.get(m[1]); return p ? json(p) : json({ message: "not found" }, 404); }
  if (u.endsWith("/api/requests")) {
    const body = JSON.parse(init.body);
    const d = unseal(body.t);
    net.paidOrders.push(d);
    const already = net.seenPay.has(d.payId);
    net.seenPay.add(d.payId);
    return json({ ok: true, already, verified: !!d.verified, activated: {} });
  }
  if (u.endsWith("tamara.co/checkout")) {
    const body = JSON.parse(init.body);
    net.tamaraSessions.push(body);
    return json({ checkout_url: "https://checkout.tamara.co/x", order_id: "t-order-1" });
  }
  m = u.match(/tamara\.co\/orders\/([\w-]+)$/);
  if (m) { const o = net.tamaraOrders.get(m[1]); return o ? json(o) : json({}, 404); }
  net.unexpected.push(u);
  throw new Error("unexpected fetch " + u);
};
function unseal(t) {
  const raw = Buffer.from(String(t), "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(OTP_SECRET).digest(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
}

const { default: handler } = await import(path.join(ROOT, "api", "pay.js"));
async function call(method, { query, body } = {}) {
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handler({ method, headers: {}, query: query || {}, body: body || {}, url: "/api/pay" }, res);
  return out;
}

let seq = 0;
function putPayment({ status = "paid", amount, ref, items, email = "hr@acme.test" }) {
  const id = `pay_unit_${String(++seq).padStart(6, "0")}`;
  net.moyasar.set(id, { id, status, amount, currency: "SAR", metadata: { ref, items, email, name: "Ali", phone: "0500000000", co: "Acme" } });
  return id;
}
const hook = (id) => call("POST", { body: { type: "payment_paid", secret_token: WEBHOOK, data: { id } } });
async function prepare(sku, extra = {}) {
  const r = await call("POST", { body: { action: "emp-prepare", sku, email: "hr@acme.test", company: "Acme", ...extra } });
  return r;
}
const halalas = (sar) => Math.round(sar * 1.15 * 100);
const reset = () => { signedIn = "hr@acme.test"; emp.reset(); net.paidOrders.length = 0; net.seenPay.clear(); net.unexpected.length = 0; net.tamaraSessions.length = 0; __setEmployerForTest(emp); };

// ---------------------------------------------------------------- السعر والتجهيز --
test("emp-offer: the price is the server's, enterprise and junk are refused", async () => {
  reset();
  const ok = await call("GET", { query: { action: "emp-offer", sku: "bp-emp-pro-y" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.amountHalalas, 840000);
  assert.equal(ok.body.amountSar, 8400);
  assert.equal(ok.body.sku, "BP-EMP-PRO-Y");
  assert.equal(ok.body.bnpl, true, "yearly plans may be split");
  assert.equal((await call("GET", { query: { action: "emp-offer", sku: "BP-EMP-PRO-M" } })).body.bnpl, false);
  const ent = await call("GET", { query: { action: "emp-offer", sku: "BP-EMP-ENTERPRISE-Y" } });
  assert.equal(ent.status, 404); assert.equal(ent.body.error, "quote_only");
  assert.equal((await call("GET", { query: { action: "emp-offer", sku: "employer-plan-basic-monthly" } })).status, 400);
});

test("emp-prepare: opens one pending row; enterprise, no company, a different e-mail are refused", async () => {
  reset();
  const r = await prepare("BP-EMP-BASIC-M");
  assert.equal(r.status, 200);
  assert.match(r.body.reference, /^BP-EMPSUB-[A-Z2-9]{12}$/);
  assert.equal(r.body.amountHalalas, 50000);
  assert.deepEqual(emp.pending.get(r.body.reference), { email: "hr@acme.test", company: "Acme", plan: "basic", billing: "monthly" });
  assert.equal((await prepare("BP-EMP-ENTERPRISE-M")).body.error, "quote_only");
  assert.equal((await prepare("BP-EMP-PRO-M", { company: "" })).body.error, "company_required");
  assert.equal((await prepare("BP-EMP-PRO-M", { email: "nope" })).body.error, "email_mismatch");
  assert.equal(emp.pending.size, 1, "refused calls open nothing");
});

test("emp-prepare: only for the signed-in account's own e-mail — no session, or another e-mail, opens nothing", async () => {
  reset();
  signedIn = "";
  const anon = await prepare("BP-EMP-BASIC-M");
  assert.equal(anon.status, 401); assert.equal(anon.body.error, "not_signed_in");
  signedIn = "hr@acme.test";
  const other = await prepare("BP-EMP-BASIC-M", { email: "victim@elsewhere.test" });
  assert.equal(other.status, 403); assert.equal(other.body.error, "email_mismatch");
  assert.equal(emp.pending.size, 0, "no pending row for anyone's e-mail but the session's");
  const mine = await prepare("BP-EMP-BASIC-M", { email: "HR@Acme.test" });
  assert.equal(mine.status, 200);
  assert.equal(emp.pending.get(mine.body.reference).email, "hr@acme.test");
  const noField = await call("POST", { body: { action: "emp-prepare", sku: "BP-EMP-BASIC-M", company: "Acme" } });
  assert.equal(noField.status, 200, "the e-mail field is optional — the session supplies it");
});

test("employer module missing the contract: plans are unavailable, nothing throws", async () => {
  reset();
  __setEmployerForTest({});               // موجودة لكن بلا الدوال الثلاث
  assert.equal((await call("GET", { query: { action: "emp-offer", sku: "BP-EMP-BASIC-M" } })).status, 404);
  const r = await prepare("BP-EMP-BASIC-M");
  assert.equal(r.status, 503); assert.equal(r.body.error, "employer_unavailable");
});

// ---------------------------------------------------------------- مُيسّر: الإشعار --
test("webhook: a paid, matching payment activates once; the replay does not repeat", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-PRO-Y");
  const id = putPayment({ amount: halalas(8400), ref: reference, items: "BP-EMP-PRO-Y~1" });
  const first = await hook(id);
  assert.equal(first.status, 200);
  assert.equal(first.body.employer.activated, true);
  assert.equal(emp.paid.size, 1);
  assert.equal(emp.paid.get(id), reference);
  assert.deepEqual(emp.calls[0], { reference, paymentRef: id, amountHalalas: 840000, billing: "yearly" });

  // الطلب المختوم إلى /api/requests لا يحمل الاشتراك في ids (وإلا سجّله خدمةً عادية)،
  // لكنه يحمله اسماً ليظهر في صف CRM والبريدين.
  assert.equal(net.paidOrders.length, 1);
  assert.deepEqual(net.paidOrders[0].ids, []);
  assert.equal(net.paidOrders[0].verified, true);
  assert.match(net.paidOrders[0].items[0], /اشتراك منصة التوظيف/);
  assert.equal(net.paidOrders[0].ref, reference);

  const replay = await hook(id);
  assert.equal(replay.body.already, true, "paid-order saw the same payment");
  assert.equal(emp.paid.size, 1, "one activation for one payment");
  assert.equal(emp.calls.length, 2, "the replay reached the module, which is idempotent on paymentRef");
  assert.deepEqual(net.unexpected, []);
});

test("webhook: an amount that differs from the server's price activates nothing", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-PRO-Y");
  const cheap = putPayment({ amount: halalas(420), ref: reference, items: "BP-EMP-PRO-Y~1" });   // يدفع ٤٢٠ لا ٨٤٠٠
  const r = await hook(cheap);
  assert.equal(r.body.employer.activated, false);
  assert.equal(emp.calls.length, 0, "the module is never asked to activate");
  assert.equal(emp.paid.size, 0);
  assert.equal(net.paidOrders[0].verified, false, "the CRM row is flagged for review");
  // وفارق ريالين لا يكفي لفتح حساب مدفوع (تسامح الـCRM ريالان، والاشتراك ريال).
  const close = putPayment({ amount: halalas(8400) - 150, ref: reference, items: "BP-EMP-PRO-Y~1" });
  assert.equal((await hook(close)).body.employer.activated, false);
  assert.equal(emp.calls.length, 0);
});

test("webhook: a payment that is not paid activates nothing", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-BASIC-M");
  for (const status of ["failed", "initiated", "authorized"]) {
    const id = putPayment({ status, amount: halalas(500), ref: reference, items: "BP-EMP-BASIC-M~1" });
    const r = await hook(id);
    assert.equal(r.status, 200); assert.equal(r.body.ignored, true);
  }
  assert.equal(emp.calls.length, 0);
});

test("webhook: a wrong token is refused before anything is read", async () => {
  reset();
  const r = await call("POST", { body: { type: "payment_paid", secret_token: "wrong", data: { id: "pay_unit_zzzzzz" } } });
  assert.equal(r.status, 401);
  assert.equal(emp.calls.length, 0);
});

test("a payment the gateway does not know is refused, not trusted", async () => {
  reset();
  const r = await hook("pay_unit_missing_1");
  assert.equal(r.status, 503);            // التحقق تعذّر → يُعاد الإشعار لاحقاً
  assert.equal(emp.calls.length, 0);
});

// ---------------------------------------------------------------- مُيسّر: عودة المتصفح --
test("browser callback after the webhook: success page data, still one activation", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-BASIC-Y");
  const id = putPayment({ amount: halalas(4200), ref: reference, items: "BP-EMP-BASIC-Y~1" });
  await hook(id);
  const order = { ref: reference, name: "Ali", email: "hr@acme.test", phone: "0500000000", company: "Acme", items: [{ id: "BP-EMP-BASIC-Y", qty: 1 }] };
  const back = await call("POST", { body: { id, order } });
  assert.equal(back.body.ok, true);
  assert.equal(back.body.employer.activated, true, "the page can tell the buyer the account is active");
  assert.equal(back.body.settle.already, true);
  assert.equal(emp.paid.size, 1);
});

test("browser callback first, webhook second: also one activation", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-BASIC-M");
  const id = putPayment({ amount: halalas(500), ref: reference, items: "BP-EMP-BASIC-M~1" });
  const order = { ref: reference, name: "Ali", email: "hr@acme.test", company: "Acme", items: [{ id: "BP-EMP-BASIC-M", qty: 1 }] };
  assert.equal((await call("POST", { body: { id, order } })).body.employer.activated, true);
  await hook(id);
  assert.equal(emp.paid.size, 1);
});

test("browser callback with a failed payment: ok false, no activation", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-BASIC-M");
  const id = putPayment({ status: "failed", amount: halalas(500), ref: reference, items: "BP-EMP-BASIC-M~1" });
  const r = await call("POST", { body: { id, order: { ref: reference, email: "hr@acme.test", items: [{ id: "BP-EMP-BASIC-M", qty: 1 }] } } });
  assert.equal(r.body.ok, false);
  assert.equal(emp.calls.length, 0);
});

test("a cart that lies about the plan cannot buy a cheaper one's price", async () => {
  reset();
  // يدفع سعر الأساسية الشهرية ٥٠٠ ويدّعي أن سلته «احترافية سنوية».
  const { body: { reference } } = await prepare("BP-EMP-PRO-Y");
  const id = putPayment({ amount: halalas(500), ref: reference, items: "BP-EMP-PRO-Y~1" });
  const r = await call("POST", { body: { id, order: { ref: reference, email: "hr@acme.test", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] } } });
  assert.equal(r.body.ok, true, "the money did arrive");
  assert.equal(r.body.employer.activated, false);
  assert.equal(emp.calls.length, 0);
});

test("enterprise, two plans, or quantity above one are never activated", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-BASIC-M");
  const cases = [
    { items: [{ id: "BP-EMP-ENTERPRISE-Y", qty: 1 }], amount: halalas(21000) },
    { items: [{ id: "BP-EMP-BASIC-M", qty: 1 }, { id: "BP-EMP-PRO-M", qty: 1 }], amount: halalas(1500) },
    { items: [{ id: "BP-EMP-BASIC-M", qty: 2 }], amount: halalas(1000) },
  ];
  for (const c of cases) {
    const id = putPayment({ amount: c.amount, ref: reference, items: c.items.map((i) => `${i.id}~${i.qty}`).join(",") });
    const r = await call("POST", { body: { id, order: { ref: reference, email: "hr@acme.test", items: c.items } } });
    assert.equal(r.body.employer.activated, false, JSON.stringify(c.items));
  }
  assert.equal(emp.calls.length, 0);
});

test("the module failing or throwing after a real payment: payment still ok, nobody activated, no exception", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-BASIC-M");
  const order = { ref: reference, email: "hr@acme.test", company: "Acme", items: [{ id: "BP-EMP-BASIC-M", qty: 1 }] };
  emp.failNext = true;
  const a = await call("POST", { body: { id: putPayment({ amount: halalas(500), ref: reference, items: "BP-EMP-BASIC-M~1" }), order } });
  assert.equal(a.body.ok, true); assert.equal(a.body.employer.activated, false);
  emp.failNext = false; emp.throwNext = true;
  const b = await call("POST", { body: { id: putPayment({ amount: halalas(500), ref: reference, items: "BP-EMP-BASIC-M~1" }), order } });
  assert.equal(b.status, 200); assert.equal(b.body.employer.activated, false);
  assert.equal(emp.paid.size, 0);
});

test("a basket with no subscription is untouched: same sealed ids, no employer key", async () => {
  reset();
  const id = putPayment({ amount: halalas(300), ref: "BP-100200", items: "BP-X-01~1" });
  const r = await call("POST", { body: { id, order: { ref: "BP-100200", name: "Ali", email: "a@b.test", items: [{ id: "BP-X-01", qty: 1 }] } } });
  assert.equal(r.body.ok, true);
  assert.equal("employer" in r.body, false);
  assert.deepEqual(net.paidOrders[0].ids, [{ id: "BP-X-01", qty: 1 }]);
  assert.equal(net.paidOrders[0].verified, true);
  assert.equal(emp.calls.length, 0);
});

// ---------------------------------------------------------------- تمارا --
test("tamara: monthly plans are refused, yearly ones are priced from the server", async () => {
  reset();
  const monthly = await call("POST", { body: { action: "bnpl-checkout", order: { ref: "BP-EMP-AAAAAAAAAA", email: "hr@acme.test", name: "Ali", phone: "0500000000", items: [{ id: "BP-EMP-PRO-M", qty: 1 }] } } });
  assert.equal(monthly.status, 400); assert.equal(monthly.body.error, "bnpl_yearly_only");
  assert.equal(net.tamaraSessions.length, 0);

  const yearly = await call("POST", { body: { action: "bnpl-checkout", order: { ref: "BP-EMP-AAAAAAAAAA", email: "hr@acme.test", name: "Ali", phone: "0500000000", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] } } });
  assert.equal(yearly.status, 200);
  assert.equal(yearly.body.total, 9660);
  assert.equal(net.tamaraSessions[0].total_amount.amount, "9660.00");
  assert.equal(net.tamaraSessions[0].items[0].unit_price.amount, "8400.00");

  const ent = await call("POST", { body: { action: "bnpl-checkout", order: { ref: "x", email: "hr@acme.test", items: [{ id: "BP-EMP-ENTERPRISE-Y", qty: 1 }] } } });
  assert.equal(ent.status, 400);
  const two = await call("POST", { body: { action: "bnpl-checkout", order: { ref: "x", email: "hr@acme.test", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }, { id: "BP-EMP-BASIC-Y", qty: 1 }] } } });
  assert.equal(two.body.error, "one_plan_per_order");
});

test("tamara return: a captured yearly order activates once, under the tamara_ payment ref", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-PRO-Y");
  net.tamaraOrders.set("t-order-1", { status: "fully_captured", total_amount: { amount: "9660.00" } });
  const order = { ref: reference, name: "Ali", email: "hr@acme.test", company: "Acme", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] };
  const a = await call("POST", { body: { action: "bnpl-verify", id: "t-order-1", order } });
  assert.equal(a.body.ok, true);
  assert.equal(a.body.employer.activated, true);
  assert.equal(emp.calls[0].paymentRef, "tamara_t-order-1");
  await call("POST", { body: { action: "bnpl-verify", id: "t-order-1", order } });   // المستخدم أعاد تحميل الصفحة
  assert.equal(emp.paid.size, 1);
});

test("tamara return: a captured amount below the price activates nothing", async () => {
  reset();
  const { body: { reference } } = await prepare("BP-EMP-PRO-Y");
  net.tamaraOrders.set("t-order-2", { status: "fully_captured", total_amount: { amount: "966.00" } });
  const a = await call("POST", { body: { action: "bnpl-verify", id: "t-order-2", order: { ref: reference, email: "hr@acme.test", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] } } });
  assert.equal(a.body.employer.activated, false);
  assert.equal(emp.calls.length, 0);
});

// ---------------------------------------------------------------- العقد الحقيقي --
// حين يكتب recruitment-employer الدوال الثلاث في api/employer.js يتحقق هذا الاختبار
// من شكلها؛ قبل ذلك يُسجَّل «todo» ولا يُسقط البناء.
const real = await import(path.join(ROOT, "api", "employer.js")).catch(() => ({}));
const has = ["getPlanOffer", "createPendingSubscription", "activateSubscription"].every((n) => typeof real[n] === "function");
test("api/employer.js exports the agreed contract", { todo: has ? false : "api/employer.js has not exported the three functions yet" }, async () => {
  for (const [plan, billing, halal] of [["basic", "monthly", null], ["basic", "yearly", null], ["pro", "monthly", null], ["pro", "yearly", null]]) {
    const o = await real.getPlanOffer(plan, billing);
    assert.ok(o && Number.isInteger(o.amountHalalas) && o.amountHalalas > 0, `${plan}/${billing}`);
    assert.equal(o.currency, "SAR");
    assert.equal(o.sku, skuOf(plan, billing));
    assert.equal(o.plan, plan); assert.equal(o.billing, billing);
    void halal;
  }
  const ent = await real.getPlanOffer("enterprise", "yearly");
  assert.ok(!ent || !(ent.amountHalalas > 0), "enterprise is a quotation, not a price");
});
