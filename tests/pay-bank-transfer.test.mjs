// حوالة السلة البنكية من الطرف إلى الطرف (أمر المالك 2026-10-23): POST /api/pay {action:"bank-receipt"}.
//
// يشغّل المعالجات الحقيقية (api/pay.js ثم api/requests.js paid-order ثم api/_simple.js) في عملية
// واحدة على قاعدة JSON مؤقتة؛ الشبكة مُحاكاة: الكتالوج من القرص، و/api/requests و/api/pay تُوجَّه
// إلى المعالج نفسه، وما سواها 404 — فلا شيء يغادر الجهاز. أسماء الإيصالات demo-* تُحاكي ما يقرؤه
// المستشار (تعمل في وضع التطوير وحده، انظر demoRead).
//
// بيانات الحساب وهمية صريحة (BP_BANK_* أدناه): لا آيبان ولا رقم حساب حقيقي في الاختبارات.
//
// المقاس:
//   ① مطابق كل شيء → الدفع يُعتمد والطلب PAID بالمسار نفسه الذي يسلكه دفع البطاقة، ومهمة هادئة لمطابقة كشف الحساب.
//   ② أي اختلاف (مبلغ أقل/أعلى · آيبان · مستفيد · ليس إيصالاً · غير مقروء · قارئ غير متاح) → «بانتظار التحقق»
//      بسببه، ومهمة بشرية، ولا فاتورة ولا تفعيل.
//   ③ الإيصال المكرر على طلبٍ آخر لا يُعتمد آلياً. وإعادة الرفع على الطلب نفسه لا تفتح طلباً ثانياً.
//   ④ السعر للخادم: بند خارج الكتالوج / عرض موقّع / اشتراك توظيف لا يُقبل في الحوالة.
//   ⑤ اعتماد إنسان من «تأكيد الدفع» في اللوحة يمرّ بالمسار نفسه؛ الرمز المزوَّر أو لطلبٍ آخر يُرفض.
//   ⑥ فرملة السرعة.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-bank-"));
Object.assign(process.env, {
  LOCAL_DB: "1", LOCAL_DB_DIR: dir, APP_ENV: "development", SIMPLE_TEST_MODE: "1", SIMPLE_OPS_KEY: "test-ops",
  EMAIL_MODE: "preview", WHATSAPP_MODE: "mock", OTP_SECRET: "unit-test-secret-never-used-elsewhere",
  MKT_SITE_BASE: "http://localhost.test", CATALOG_URL: "http://catalog.test/catalog.json",
  BP_BANK_BENEFICIARY: "شركة اختبار وهمية للحلول", BP_BANK_NAME: "بنك وهمي", BP_BANK_IBAN: "SA00FAKE0000000000000000",
});
delete process.env.MOYASAR_METHODS;

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const mkRes = () => { const r = { statusCode: 200, headers: {}, setHeader(k, v) { r.headers[k] = v; }, end(t) { r.body = t; } }; return r; };
const pay = (await import("../api/pay.js")).default;
const requests = (await import("../api/requests.js")).default;
const { handleSimple } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");

let ipn = 0;
async function route(handler, method, body, query = {}, ip = "10.1." + Math.floor(++ipn / 250) + "." + (ipn % 250)) {
  const res = mkRes();
  await handler({ method, body, query, headers: { "x-forwarded-for": ip }, socket: {}, url: "/api/x" }, res);
  return { status: res.statusCode, json: JSON.parse(res.body || "{}") };
}
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith("http://catalog.test/")) return new Response(JSON.stringify(catalog), { status: 200 });
  if (u === "http://localhost.test/api/requests") { const r = await route(requests, "POST", JSON.parse(opts.body)); return new Response(JSON.stringify(r.json), { status: r.status }); }
  if (u === "http://localhost.test/api/pay") { const r = await route(pay, "POST", JSON.parse(opts.body)); return new Response(JSON.stringify(r.json), { status: r.status }); }
  return new Response("{}", { status: 404 });
};
const realLog = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith("[outbox")) realLog(...a); };

// ---- helpers
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake-png-body")]);
let seq = 1000;
const uniq = () => Buffer.concat([PNG, Buffer.from("#" + Math.random() + Date.now())]);
const ITEMS = [{ id: "bp-absher-01", qty: 2 }];              // 2 × 300 + 15% = 690.00
const TOTAL = 690;
const order = (over = {}) => ({
  ref: "BP-" + (++seq), name: "عميل اختبار", email: `buyer${seq}@example.com`, phone: "0500000000",
  items: ITEMS, company: "", surchargeFee: 0, discountCode: "", taxProfile: { kind: "personal" }, ...over,
});
const upload = (o, name = "demo-match.png", buf = uniq(), mime = "image/png", ip) =>
  route(pay, "POST", { action: "bank-receipt", lang: "ar", order: o, file: { name, mime, base64: buf.toString("base64") } }, {}, ip);
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*&limit=1`))[0];
const orderRow = async (orderRef) => ((await sb("requests?payment=not.is.null&select=*&limit=500")) || []).filter((r) => r.payment && r.payment.order_ref === orderRef);
const tasksOf = async (row) => (await sb(`tasks?request_id=eq.${row.id}&select=source,status,human_action`)) || [];

// ---------------------------------------------------------------- config
test("GET config: the bank block carries the account from api/_identity.js (env override), and each wallet's switch state", async () => {
  const { json } = await route(pay, "GET", undefined, {});
  assert.equal(json.bank.enabled, true);
  assert.equal(json.bank.beneficiary, "شركة اختبار وهمية للحلول");
  assert.equal(json.bank.bank, "بنك وهمي");
  assert.equal(json.bank.iban, "SA00FAKE0000000000000000");
  assert.equal(json.bank.currency, "SAR");
  assert.deepEqual(Object.keys(json.wallets).sort(), ["apple", "google", "samsung"]);
  assert.equal(json.wallets.apple.on, false);
});

// ---------------------------------------------------------------- ① approved
test("a receipt that matches amount, IBAN and beneficiary approves the payment and opens a PAID request", async () => {
  const o = order();
  const { status, json } = await upload(o);
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.ok, true);
  assert.equal(json.state, "approved");
  assert.equal(json.amount, TOTAL);
  assert.deepEqual(json.reasons, []);
  assert.equal(json.checks.amount && json.checks.iban && json.checks.beneficiary, true);
  assert.ok("invoice" in json, "the invoice engine was asked, exactly as for a card payment");
  const rows = await orderRow(o.ref);
  assert.equal(rows.length, 1, "one request, never two");
  const row = rows[0];
  assert.equal(row.status, "PAID");
  assert.equal(row.payment.status, "PAID");
  assert.equal(row.payment.provider, "bank");
  assert.equal(row.payment.total, TOTAL);
  assert.equal(row.payment.pay_ref, "bank_" + o.ref);
  assert.equal(row.payment.confirmed_by, "المستشار الذكي");
  assert.equal(row.payment.receipt.verdict, "match");
  assert.equal(row.payment.test, false);
  assert.ok((row.attachments || []).some((a) => a.kind === "receipt" && a.id && a.path), "the receipt file is attached to the order");
  assert.equal(json.ref, row.ref);
  const tasks = await tasksOf(row);
  assert.ok(tasks.some((t) => t.source === "bank-reconcile" && t.status === "open"), "a quiet task to match the bank statement (a read receipt is not proof of money)");
  assert.ok(!tasks.some((t) => t.source === "bank-review"));
  const ev = (await sb(`request_events?request_id=eq.${row.id}&select=event`)).map((e) => e.event);
  for (const e of ["request.created.cart", "payment.pending", "payment.receipt", "payment.paid"]) assert.ok(ev.includes(e), e);
});

// ---------------------------------------------------------------- ② review
for (const [file, reason] of [
  ["demo-short.png", "amount_short"], ["demo-over.png", "amount_over"], ["demo-iban.png", "iban_mismatch"],
  ["demo-name.png", "beneficiary_mismatch"], ["demo-notreceipt.png", "not_receipt"], ["demo-unreadable.png", "unreadable"],
  ["real-receipt.png", "checker_unavailable"],
]) {
  test(`${file}: the order waits «بانتظار التحقق» with its reason (${reason}) and a human task`, async () => {
    const o = order();
    const { json } = await upload(o, file);
    assert.equal(json.ok, true);
    assert.equal(json.state, "review");
    assert.ok(json.reasons.includes(reason), `${reason}: ${json.reasons}`);
    const [row] = await orderRow(o.ref);
    assert.equal(row.status, "PAYMENT_PENDING");
    assert.equal(row.payment.status, "REVIEW");
    assert.equal(row.payment.provider, "bank");
    assert.equal(row.payment.receipt.verdict, "review");
    assert.ok(row.payment.receipt.reasons.includes(reason));
    assert.equal(row.invoice == null, true, "no invoice before the payment is approved");
    const tasks = await tasksOf(row);
    assert.ok(tasks.some((t) => t.source === "bank-review" && t.status === "open" && t.human_action), "a human task is open");
    assert.ok(!tasks.some((t) => t.source === "sweep-start"), "no «start the work» task before payment is approved");
    assert.equal(row.payment.expected_total, TOTAL, "the expected amount is the SERVER's price");
  });
}

// ---------------------------------------------------------------- ③ duplicates and re-uploads
test("the same receipt on a second order is never auto-approved", async () => {
  const bytes = uniq();
  const first = await upload(order(), "demo-match.png", bytes);
  assert.equal(first.json.state, "approved");
  const second = order();
  const r = await upload(second, "demo-match.png", bytes);
  assert.equal(r.json.state, "review");
  assert.ok(r.json.reasons.includes("duplicate_receipt"));
  const [row] = await orderRow(second.ref);
  assert.equal(row.status, "PAYMENT_PENDING");
});

test("re-uploading on the same order replaces nothing and opens no second request; a good receipt then approves that same row", async () => {
  const o = order();
  const a = await upload(o, "demo-short.png");
  assert.equal(a.json.state, "review");
  const b = await upload(o, "demo-match.png");
  assert.equal(b.json.state, "approved");
  assert.equal(b.json.ref, a.json.ref, "same request");
  const rows = await orderRow(o.ref);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "PAID");
  assert.equal((rows[0].attachments || []).filter((x) => x.kind === "receipt").length, 2, "both receipts are kept");
  const tasks = await tasksOf(rows[0]);
  assert.ok(!tasks.some((t) => t.source === "bank-review" && t.status === "open"), "the review task is closed once approved");
});

test("a paid order refuses another upload; another e-mail cannot use someone's order reference", async () => {
  const o = order();
  await upload(o);
  const again = await upload(o);
  assert.equal(again.status, 409);
  assert.equal(again.json.error, "already_paid");
  const o2 = order();
  await upload(o2, "demo-short.png");
  const thief = await upload({ ...o2, email: "someone-else@example.com" });
  assert.equal(thief.status, 409);
  assert.equal(thief.json.error, "ref_taken");
});

// ---------------------------------------------------------------- ④ the price is the server's
test("the browser's numbers are ignored: an item the catalogue does not price, a signed-quote line and an employer plan are refused", async () => {
  const cases = [
    [{ items: [{ id: "no-such-service-xyz", qty: 1 }] }, "quote_only_items"],
    [{ items: [{ id: "sv1:BP-R-AAAAAA", qty: 1 }] }, "quote_payment_use_request"],
    [{ items: [{ id: "BP-EMP-BASIC-M", qty: 1 }] }, "bank_not_for_plan"],
    [{ items: [] }, "bad_order"],
    [{ email: "not-an-email" }, "bad_order"],
    [{ ref: "nope" }, "bad_order"],
    [{ name: "" }, "bad_order"],
  ];
  for (const [patch, error] of cases) {
    const r = await upload(order(patch));
    assert.equal(r.status, 400, error);
    assert.equal(r.json.error, error);
  }
  const lowball = order({ items: ITEMS, total: 1, amount: 1 });           // a page cannot name its own price
  const r = await upload(lowball, "demo-match.png");
  const [row] = await orderRow(lowball.ref);
  assert.equal(row.payment.expected_total, TOTAL);
  assert.equal(r.json.amount, TOTAL);
});

test("file checks: type, signature and size", async () => {
  const o = () => order();
  assert.equal((await upload(o(), "x.exe", Buffer.from("MZ....."), "application/x-msdownload")).json.error, "bad_type");
  assert.equal((await upload(o(), "fake.png", Buffer.from("this is not a png at all"), "image/png")).json.error, "bad_type", "declared PNG whose bytes are not");
  const big = await upload(o(), "big.png", Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]));
  assert.equal(big.status, 413);
  assert.equal(big.json.error, "too_large");
  const none = await route(pay, "POST", { action: "bank-receipt", order: o(), file: {} });
  assert.equal(none.json.error, "no_file");
  const pdf = await upload(order(), "demo-match.pdf", Buffer.from("%PDF-1.4\n%fake\n" + Math.random()), "application/pdf");
  assert.equal(pdf.json.state, "approved", "a PDF receipt is accepted");
});

// ---------------------------------------------------------------- ⑤ a person approves
test("«تأكيد الدفع» in the panel approves a bank order that waited for review — same settle, row becomes PAID", async () => {
  const o = order();
  const up = await upload(o, "demo-iban.png");
  assert.equal(up.json.state, "review");
  const call = (body) => new Promise(async (resolve) => {
    const res = mkRes();
    await handleSimple({ method: "POST", body: { key: "test-ops", ...body }, query: {}, headers: { "user-agent": "bank-test" }, socket: {} }, res);
    resolve({ status: res.statusCode, json: JSON.parse(res.body) });
  });
  const done = await call({ action: "ops-mark-paid", ref: up.json.ref });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  assert.equal(done.json.ok, true);
  const row = await rowOf(up.json.ref);
  assert.equal(row.status, "PAID");
  assert.equal(row.payment.status, "PAID");
  assert.equal(row.payment.total, TOTAL);
  assert.notEqual(row.payment.confirmed_by, "المستشار الذكي", "recorded as a person's decision, not the agent's");
  const tasks = await tasksOf(row);
  assert.ok(!tasks.some((t) => t.source === "bank-review" && t.status === "open"));
  assert.ok(!tasks.some((t) => t.source === "bank-reconcile"), "no reconcile nag when a person looked at the money");
  const again = await call({ action: "ops-mark-paid", ref: up.json.ref });
  assert.equal(again.status, 409);
  assert.equal(again.json.error, "already_paid");
});

test("an amount typed by the team that differs from the order total is recorded but held for review, never silently verified", async () => {
  const o = order();
  const up = await upload(o, "demo-short.png");
  const res = mkRes();
  await handleSimple({ method: "POST", body: { key: "test-ops", action: "ops-mark-paid", ref: up.json.ref, amount: 500 }, query: {}, headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 200);
  const row = await rowOf(up.json.ref);
  assert.equal(row.payment.total, 500);
  assert.equal(row.payment.verified, false);
  assert.equal(row.status, "REVIEWING");
});

test("bank-approve refuses a forged token, a missing one, and a token for another order", async () => {
  const o = order();
  const up = await upload(o, "demo-short.png");
  assert.equal((await route(pay, "POST", { action: "bank-approve", t: "garbage.token" })).status, 401);
  assert.equal((await route(pay, "POST", { action: "bank-approve" })).status, 401);
  const { signBankToken } = await import("../api/_bank-transfer.js");
  const other = await route(pay, "POST", { action: "bank-approve", t: signBankToken({ ref: "BP-R-ZZZZZZ", orderRef: o.ref }) });
  assert.equal(other.status, 404, "the token names a request that is not that order's");
  const row = await rowOf(up.json.ref);
  assert.equal(row.payment.status, "REVIEW", "nothing was approved");
});

// ---------------------------------------------------------------- ⑥ the speed bump
test("many uploads from one address are slowed", async () => {
  let last = null;
  for (let i = 0; i < 14; i++) last = await upload(order(), "demo-short.png", uniq(), "image/png", "7.7.7.7");
  assert.equal(last.status, 429);
  assert.equal(last.json.error, "slow_down");
});
