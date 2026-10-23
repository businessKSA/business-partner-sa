// تقرير فاحص الرحلة الكاملة — عيوب نطاق الدفع (٤ · ٥ · ٦ · ٧ · ١٥)، على المعالجات الحقيقية
// (api/pay.js ← api/requests.js ← api/_simple.js) وقاعدة JSON مؤقتة والشبكة محاكاة. بيانات الحساب وهمية صريحة،
// والأسماء demo-* تُحاكي ما يقرؤه المستشار (وضع التطوير وحده). الجلسة تُحاكى برأس x-test-user عبر __setSessionForTest
// لمسار الدفع، وبجلسة قاعدة حقيقية (bp_sid) لمسارات /api/simple.
//
//   ٤  عرضٌ موقّع يُدفع بحوالة من صفحة طلبه: المدقّق نفسه والسقف نفسه، ويُعتمد على الطلب نفسه بفاتورته
//   ٥  الحوالة المعتمدة آلياً تمرّ بمحرّك الفاتورة نفسه (TEST-INV- محلياً) والرسالة الأخيرة وحدها تبقى
//   ٦  مبلغ طلب السلة يُقرأ من الدفعة لا من عرض سعر غير موجود (كان «0 ر.س»)
//   ٧  إيصال قيد المراجعة ليس «بانتظار الدفع» ولا «مستحقاً» ولا عليه زرُّ دفعٍ جديد
//  ١٥  جوال الملف المحفوظ يملأ #coPhone في /checkout
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-payjourney-"));
Object.assign(process.env, {
  LOCAL_DB: "1", LOCAL_DB_DIR: dir, APP_ENV: "development", SIMPLE_TEST_MODE: "1", SIMPLE_OPS_KEY: "test-ops",
  EMAIL_MODE: "preview", WHATSAPP_MODE: "mock", OTP_SECRET: "unit-test-secret-never-used-elsewhere",
  MKT_SITE_BASE: "http://localhost.test", CATALOG_URL: "http://catalog.test/catalog.json",
  BP_BANK_BENEFICIARY: "شركة اختبار وهمية للحلول", BP_BANK_NAME: "بنك وهمي", BP_BANK_IBAN: "SA00FAKE0000000000000000",
});
for (const k of ["BANK_AUTO_APPROVE_MAX_SAR", "DAFTRA_API_KEY", "DAFTRA_SUBDOMAIN", "DAFTRA_ALLOW_NONLIVE"]) delete process.env[k];

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const mkRes = () => { const r = { statusCode: 200, headers: {}, setHeader(k, v) { r.headers[k] = v; }, end(t) { r.body = t; } }; return r; };
const pay = (await import("../api/pay.js")).default;
const requests = (await import("../api/requests.js")).default;
const simple = await import("../api/_simple.js");
const emp = await import("../api/_emp-pay.js");
const { sb, sha256 } = await import("../api/_db.js");

emp.__setSessionForTest(async (req) => { const u = req.headers && req.headers["x-test-user"]; return u ? { user: { email: String(u) } } : null; });

let ipn = 0;
async function route(handler, method, body, headers = {}) {
  const res = mkRes();
  await handler({ method, body, query: {}, headers: { "x-forwarded-for": "10.7." + Math.floor(++ipn / 250) + "." + (ipn % 250), ...headers }, socket: {}, url: "/api/x" }, res);
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
console.error = () => {};

// ---------------------------------------------------------------- helpers
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function realPng(seed = 1) {
  const w = 8, h = 8, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (seed * 37 + x * 5 + y * 11) & 255;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}
const round2 = (n) => Math.round(n * 100) / 100;
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let seq = 7000;
const rand6 = () => Array.from({ length: 6 }, () => ALPH[crypto.randomInt(ALPH.length)]).join("");

// a request whose quotation was approved and contract signed — the state a client pays from
async function mkSigned({ email, total = 690, status = "SIGNED", name = "عميل اختبار" } = {}) {
  const suffix = rand6(), ref = "BP-R-" + suffix, net = round2(total / 1.15);
  const [row] = await sb("requests", { method: "POST", prefer: "return=representation", body: [{
    ref, type: "GOVERNMENT_SERVICE", source: "WEBSITE", status, lang: "ar", title: "خدمة موقّعة " + suffix, summary: "", conversation: [], scope: [], documents: [],
    client_name: name, client_email: email, client_phone: "0500000000", company_name: "",
    quote: { number: "Q-" + suffix, status: "APPROVED", net, vat: round2(total - net), total, valid_until: "2099-01-01", items: [{ title: "خدمة موقّعة", qty: 1, price: net, line: net }] },
    contract: { number: "C-" + suffix, status: "SIGNED", signed_at: new Date().toISOString() },
    payment: { status: "PENDING", amount: total },
  }] });
  return row;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*`))[0];
const tasksOf = async (row) => (await sb(`tasks?request_id=eq.${row.id}&select=source,status,urgency,human_action`)) || [];
const eventsOf = async (row) => (await sb(`request_events?request_id=eq.${row.id}&select=event`)).map((e) => e.event);
const upload = (ref, { name = "demo-match.png", buf = realPng(++seq), mime = "image/png", user, lang = "ar" } = {}) =>
  route(pay, "POST", { action: "bank-receipt", lang, requestRef: ref, file: { name, mime, base64: buf.toString("base64") } }, user ? { "x-test-user": user } : {});

// a signed-in client (a real session row) for /api/simple
async function mkClient(email) {
  const [u] = await sb("users", { method: "POST", prefer: "return=representation", body: [{ email, full_name: "سارة العتيبي", phone: "0555123456" }] });
  const [org] = await sb("organizations", { method: "POST", body: [{ name_ar: "منشأة " + email }] });
  await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: org.id, user_id: u.id, role_id: "owner", status: "active" }] });
  const TOKEN = "tok-payjourney-" + crypto.randomBytes(8).toString("hex");
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(TOKEN), user_id: u.id, organization_id: org.id, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });
  return { email, TOKEN, user: u, org };
}
async function asClient(c, action, body = {}) {
  const res = mkRes();
  await simple.handleSimple({ method: "POST", headers: { cookie: `bp_sid=${c.TOKEN}` }, socket: {}, query: {}, body: { action, ...body } }, res);
  return { status: res.statusCode, json: JSON.parse(res.body || "{}") };
}
async function asOps(action, body = {}) {
  const res = mkRes();
  await simple.handleSimple({ method: "POST", headers: { "user-agent": "payjourney" }, socket: {}, query: {}, body: { key: "test-ops", action, ...body } }, res);
  return { status: res.statusCode, json: JSON.parse(res.body || "{}") };
}

// ------------------------------------------------------------------ ٤ signed quotation by transfer
test("٤ a signed quotation is paid by transfer from its request: same checker, approved on the SAME request with its invoice", async () => {
  const email = `q4a${++seq}@example.com`;
  const row = await mkSigned({ email, total: 690 });
  const r = await upload(row.ref, { name: "demo-match.png", user: email });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.state, "approved", JSON.stringify(r.json));
  assert.equal(r.json.amount, 690);
  assert.equal(r.json.ref, row.ref, "the answer names the request itself, not a second one");
  assert.ok(r.json.invoice && r.json.invoice.invoiced && /^TEST-INV-/.test(r.json.invoice.number), JSON.stringify(r.json.invoice));
  const after = await rowOf(row.ref);
  assert.equal(after.status, "PAID");
  assert.equal(after.payment.status, "PAID");
  assert.equal(after.payment.provider, "bank");
  assert.equal(after.payment.amount, 690);
  assert.ok(after.payment.receipt && after.payment.receipt.verdict === "match", "the verified receipt stays on the paid payment");
  assert.equal(after.payment.confirmed_by, "المستشار الذكي");
  assert.ok(/^TEST-INV-/.test(after.invoice.number), "the invoice came out of the same engine the card uses");
  assert.equal((await sb(`requests?client_email=eq.${email}&select=ref`)).length, 1, "no second request was opened");
  const ev = await eventsOf(after);
  assert.equal(ev.filter((e) => e === "payment.paid").length, 1);
  assert.ok((await tasksOf(after)).every((t) => t.source !== "bank-review" || t.status === "done"), "no open review task is left behind");
});

test("٤ the same ceiling: above BANK_AUTO_APPROVE_MAX_SAR a matching receipt waits for a person, with the reason in words", async () => {
  const email = `q4b${++seq}@example.com`;
  const row = await mkSigned({ email, total: 4600 });
  const r = await upload(row.ref, { name: "demo-match.png", user: email });
  assert.equal(r.json.state, "review", JSON.stringify(r.json));
  assert.deepEqual(r.json.reasons, ["above_auto_limit"]);
  assert.ok(r.json.reasonsText[0].includes("3000") || r.json.reasonsText[0].includes("حدّ"), r.json.reasonsText[0]);
  const after = await rowOf(row.ref);
  assert.equal(after.status, "PAYMENT_PENDING");
  assert.equal(after.payment.status, "REVIEW");
  assert.ok(!after.invoice, "nothing is invoiced before the money is confirmed");
  const t = await tasksOf(after);
  assert.ok(t.some((x) => x.source === "bank-review" && x.human_action && x.urgency === "urgent"), JSON.stringify(t));
});

test("٤ a short receipt is held for a person and the team's «confirm payment» settles the same request with the receipt kept", async () => {
  const email = `q4c${++seq}@example.com`;
  const row = await mkSigned({ email, total: 690 });
  const r = await upload(row.ref, { name: "demo-short.png", user: email });
  assert.equal(r.json.state, "review");
  assert.ok(r.json.reasons.includes("amount_short"), JSON.stringify(r.json.reasons));
  const held = await rowOf(row.ref);
  assert.equal(held.status, "PAYMENT_PENDING");
  const ok = await asOps("ops-mark-paid", { ref: row.ref });
  assert.equal(ok.json.ok, true, JSON.stringify(ok.json));
  const after = await rowOf(row.ref);
  assert.equal(after.status, "PAID");
  assert.ok(after.payment.receipt, "the receipt the client uploaded is still on the payment");
  assert.ok(/^TEST-INV-/.test(after.invoice.number));
  assert.ok((await tasksOf(after)).filter((t) => t.source === "bank-review").every((t) => t.status === "done"), "the review task closes when the payment is confirmed");
});

test("٤ guards: no session, someone else's request, an unsigned or cancelled one, a paid one", async () => {
  const owner = `q4d${++seq}@example.com`, other = `q4e${++seq}@example.com`;
  const row = await mkSigned({ email: owner, total: 690 });
  const anon = await upload(row.ref, {});
  assert.equal(anon.status, 401); assert.equal(anon.json.error, "login_required");
  const stranger = await upload(row.ref, { user: other });
  assert.equal(stranger.status, 404); assert.equal(stranger.json.error, "not_found", "the same answer as a request that does not exist");
  const ghost = await upload("BP-R-ZZZZZZ", { user: other });
  assert.deepEqual(stranger.json, ghost.json);
  assert.equal((await rowOf(row.ref)).status, "SIGNED", "a stranger changed nothing");
  const unsigned = await mkSigned({ email: owner, status: "QUOTE_SENT" });
  const u = await upload(unsigned.ref, { user: owner });
  assert.equal(u.status, 409); assert.equal(u.json.error, "not_payable");
  const cancelled = await mkSigned({ email: owner, status: "CANCELLED" });
  const c = await upload(cancelled.ref, { user: owner });
  assert.equal(c.status, 409); assert.equal(c.json.error, "request_closed"); assert.ok(c.json.message && c.json.message.length > 20);
  const done = await upload(row.ref, { user: owner });
  assert.equal(done.json.state, "approved");
  const again = await upload(row.ref, { user: owner });
  assert.equal(again.status, 409); assert.equal(again.json.error, "already_paid");
  assert.equal((await rowOf(row.ref)).payment.amount, 690);
});

test("٤ concurrent matching uploads settle ONCE (one claim, one payment event, one invoice)", async () => {
  const email = `q4f${++seq}@example.com`;
  const row = await mkSigned({ email, total: 690 });
  const outs = await Promise.all([1, 2, 3, 4].map((i) => upload(row.ref, { name: "demo-match.png", user: email, buf: realPng(900 + i) })));
  assert.ok(outs.every((o) => o.status === 200 || o.status === 409), JSON.stringify(outs.map((o) => o.status)));
  const after = await rowOf(row.ref);
  assert.equal(after.status, "PAID");
  const ev = await eventsOf(after);
  assert.equal(ev.filter((e) => e === "payment.paid").length, 1, "settled once");
  assert.equal(ev.filter((e) => e === "invoice.issued").length, 1, "invoiced once");
});

test("٤ a receipt already used on another request is not accepted twice (duplicate lookup)", async () => {
  const a = `q4g${++seq}@example.com`, b = `q4h${++seq}@example.com`;
  const r1 = await mkSigned({ email: a, total: 690 }), r2 = await mkSigned({ email: b, total: 690 });
  const same = realPng(4242);
  const first = await upload(r1.ref, { name: "demo-short.png", user: a, buf: same });
  assert.equal(first.json.state, "review");
  const second = await upload(r2.ref, { name: "demo-match.png", user: b, buf: same });
  assert.equal(second.json.state, "review", JSON.stringify(second.json));
  assert.ok(second.json.reasons.includes("duplicate_receipt"), JSON.stringify(second.json.reasons));
  assert.notEqual((await rowOf(r2.ref)).status, "PAID");
});

test("٤ the cart still refuses an sv1 line on the cart path (the request page is the route)", async () => {
  const email = `q4i${++seq}@example.com`;
  const row = await mkSigned({ email, total: 690 });
  const r = await route(pay, "POST", { action: "bank-receipt", order: { ref: "BP-" + (++seq), name: "عميل", email, phone: "0500000000", items: [{ id: "sv1:" + row.ref, qty: 1 }] }, file: { name: "demo-match.png", mime: "image/png", base64: realPng(5).toString("base64") } }, { "x-test-user": email });
  assert.equal(r.status, 400); assert.equal(r.json.error, "quote_payment_use_request");
});

// ------------------------------------------------------------------ ٥ cart transfer: invoice + latest message only
const ITEMS = [{ id: "bp-absher-01", qty: 2 }];            // 2 × 300 + 15% = 690.00
const cartOrder = (email, over = {}) => ({ ref: "BP-" + (++seq), name: "عميل اختبار", email, phone: "0500000000", items: ITEMS, company: "", surchargeFee: 0, discountCode: "", taxProfile: { kind: "personal" }, ...over });
const cartUpload = (o, name) => route(pay, "POST", { action: "bank-receipt", lang: "ar", order: o, file: { name, mime: "image/png", base64: realPng(++seq).toString("base64") } }, { "x-test-user": o.email });
const cartRow = async (o) => (await sb("requests?select=*&limit=5000")).find((r) => r.payment && r.payment.order_ref === o.ref);

test("٥ an auto-approved cart transfer is invoiced by the same engine as the card (TEST-INV- locally), not left paid without an invoice", async () => {
  const email = `c5a${++seq}@example.com`, o = cartOrder(email);
  const r = await cartUpload(o, "demo-match.png");
  assert.equal(r.json.state, "approved", JSON.stringify(r.json));
  assert.ok(r.json.invoice && r.json.invoice.invoiced, "the answer says it was invoiced: " + JSON.stringify(r.json.invoice));
  assert.match(String(r.json.invoice.number), /^TEST-INV-/);
  const row = await cartRow(o);
  assert.equal(row.status, "PAID");
  assert.ok(row.invoice && /^TEST-INV-/.test(row.invoice.number), JSON.stringify(row.invoice));
  assert.equal(row.invoice.total, 690);
  assert.equal(row.invoice.mode, "test");
  // asking again never makes a second record
  const evs = (await eventsOf(row)).filter((e) => e === "invoice.issued");
  assert.equal(evs.length, 1);
});

test("٥ after approval the request shows the LAST status only: «بانتظار التحقق» is replaced by the approval", async () => {
  const email = `c5b${++seq}@example.com`, o = cartOrder(email);
  const first = await cartUpload(o, "demo-short.png");
  assert.equal(first.json.state, "review");
  const held = await cartRow(o);
  assert.ok(held.conversation.some((m) => m.content.includes("بانتظار التحقق")), "while held the client is told it is waiting");
  const second = await cartUpload(o, "demo-match.png");
  assert.equal(second.json.state, "approved");
  const row = await cartRow(o);
  const texts = row.conversation.map((m) => m.content);
  assert.equal(texts.some((t) => t.includes("بانتظار التحقق")), false, JSON.stringify(texts));
  assert.equal(texts.filter((t) => t.includes("اعتُمد دفع حوالتك")).length, 1);
});

test("٥ a person's «confirm payment» on a held cart transfer also leaves an invoice and one message", async () => {
  const email = `c5c${++seq}@example.com`, o = cartOrder(email);
  assert.equal((await cartUpload(o, "demo-short.png")).json.state, "review");
  const held = await cartRow(o);
  const ok = await asOps("ops-mark-paid", { ref: held.ref });
  assert.equal(ok.json.ok, true, JSON.stringify(ok.json));
  const row = await cartRow(o);
  assert.equal(row.status, "PAID");
  assert.ok(row.invoice && /^TEST-INV-/.test(row.invoice.number), JSON.stringify(row.invoice));
  assert.equal(row.conversation.filter((m) => m.content.includes("بانتظار التحقق")).length, 0);
});

test("٥ testInvoiceForPayment is idempotent and refuses a row that is not paid", async () => {
  const email = `c5d${++seq}@example.com`, o = cartOrder(email);
  assert.equal((await cartUpload(o, "demo-short.png")).json.state, "review");
  assert.equal(await simple.testInvoiceForPayment("bank_" + o.ref, o.ref), null, "no invoice on an unpaid row");
  const email2 = `c5e${++seq}@example.com`, o2 = cartOrder(email2);
  assert.equal((await cartUpload(o2, "demo-match.png")).json.state, "approved");
  const a = await simple.testInvoiceForPayment("bank_" + o2.ref, o2.ref);
  assert.equal(a.already, true);
  assert.match(a.number, /^TEST-INV-/);
});

// ------------------------------------------------------------------ ٦ amount of a cart request
test("٦ a cart request has no quotation: its amount comes from the payment (summary, never 0)", async () => {
  const email = `c6a${++seq}@example.com`, o = cartOrder(email);
  assert.equal((await cartUpload(o, "demo-short.png")).json.state, "review");
  const row = await cartRow(o);
  assert.equal(row.quote ?? null, null, "a cart row carries no quotation");
  const client = await mkClient(email);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { user_id: client.user.id, organization_id: client.org.id } });
  const me = await asClient(client, "me");
  const mine = me.json.requests.find((r) => r.ref === row.ref);
  assert.equal(mine.payment.amount, 690, JSON.stringify(mine.payment));
  assert.equal(simple.paymentAmount(row), 690);
  assert.equal(simple.paymentAmount({ quote: { total: 345 }, payment: { amount: 0 } }), 345, "a quotation still wins when there is one");
  assert.equal(simple.paymentAmount({ payment: { total: 287.5 } }), 287.5);
  assert.equal(simple.paymentAmount({ payment: { expected_total: 345 } }), 345);
  assert.equal(simple.paymentAmount({}), 0);
  // the team's list carries the same figure
  const list = await asOps("ops-requests");
  const op = (list.json.requests || []).find((r) => r.ref === row.ref);
  assert.equal(op.payment.amount, 690);
});

// ------------------------------------------------------------------ ٧ a receipt under review is not "payment due"
test("٧ a receipt under review is «قيد المراجعة»: flagged, not counted as a payment due, not payable again", async () => {
  const email = `c7a${++seq}@example.com`;
  const client = await mkClient(email);
  const signed = await mkSigned({ email, total: 690 });
  await sb(`requests?id=eq.${signed.id}`, { method: "PATCH", body: { user_id: client.user.id, organization_id: client.org.id } });
  const before = await asClient(client, "me");
  assert.equal(before.json.counts.payments, 1, "a signed request awaiting payment is due");
  assert.ok(!before.json.requests.find((r) => r.ref === signed.ref).payment.review);

  assert.equal((await upload(signed.ref, { name: "demo-short.png", user: email })).json.state, "review");
  const o = cartOrder(email);
  assert.equal((await cartUpload(o, "demo-iban.png")).json.state, "review");
  const cart = await cartRow(o);
  await sb(`requests?id=eq.${cart.id}`, { method: "PATCH", body: { user_id: client.user.id, organization_id: client.org.id } });

  const me = await asClient(client, "me");
  const a = me.json.requests.find((r) => r.ref === signed.ref), b = me.json.requests.find((r) => r.ref === cart.ref);
  assert.equal(a.status, "PAYMENT_PENDING"); assert.equal(a.payment.review, true);
  assert.equal(b.status, "PAYMENT_PENDING"); assert.equal(b.payment.review, true);
  assert.equal(me.json.counts.payments, 0, "neither is a payment the client still owes");
  // the detail the request page draws from carries the flag too
  const det = await asClient(client, "request-get", { ref: signed.ref });
  assert.equal(det.json.request.payment.review, true, JSON.stringify(det.json).slice(0, 300));
  // the team still sees it as a payment to act on (their counter is unchanged)
  const sum = await asOps("ops-summary");
  assert.ok(sum.json.counts.payments_due >= 2);
  // once approved the flag is gone
  assert.equal(simple.bankUnderReview({ status: "PAID", payment: { provider: "bank", receipt: {} } }), false);
  assert.equal(simple.bankUnderReview({ status: "PAYMENT_PENDING", payment: { provider: "moyasar", status: "PENDING" } }), false, "a card in flight is not a bank receipt");
  assert.equal(simple.bankUnderReview({ status: "SIGNED", payment: { status: "PENDING" } }), false);
});

// ------------------------------------------------------------------ the pages (static, over the real built scripts)
const LANGS = ["ar", "en", "fr", "zh"];
const { buildSimpleMy } = await import(pathToFileURL(path.join(ROOT, "site/scripts/simple-v1-my.mjs")).href);
const { buildSimpleOps } = await import(pathToFileURL(path.join(ROOT, "site/scripts/simple-v1-ops.mjs")).href);
const { buildSimpleCheckout } = await import(pathToFileURL(path.join(ROOT, "site/scripts/simple-v1-checkout.mjs")).href);
function build(fn, lang) {
  let out = "";
  const sv1 = { href: (p) => p, header: () => "", footer: () => "", shell: (o) => { out = o.script; return o.script; } };
  fn(sv1, { lang: () => lang, esc: (s) => String(s) });
  return out;
}
const inner = (s) => s.replace(/<\/script>\s*<script>/g, "\n").replace(/^<script>/, "").replace(/<\/script>$/, "");
const txOf = (s) => JSON.parse(/TX=(\{.*?\}),ST=/s.exec(s)[1]);

test("٤ /my: the signed request offers the transfer (details, receipt upload, the new action) in all four languages", () => {
  for (const l of LANGS) {
    const s = build(buildSimpleMy, l);
    assert.doesNotThrow(() => new vm.Script(inner(s)), l);
    assert.ok(s.includes("action:'bank-receipt'") && s.includes("requestRef:r.ref"), l + ": posts requestRef");
    assert.ok(s.includes("/api/pay"), l);
    const tx = txOf(s);
    for (const k of ["payBankNow", "bkTitle", "bkBene", "bkIban", "bkAmt", "bkRef", "bkFile", "bkGo", "bkApproved", "bkReview", "bkLogin", "bkFail", "reviewTitle", "reviewText"]) {
      assert.ok(tx[k] && tx[k].length > 1, `${l}.${k}`);
      if (l !== "ar") assert.ok(!/[؀-ۿ]/.test(tx[k]), `${l}.${k} has no Arabic`);
    }
  }
});

test("٧ /my: a receipt under review reads «إيصالك قيد المراجعة», has no pay buttons, and is not in the pay list", () => {
  for (const l of LANGS) {
    const s = build(buildSimpleMy, l), tx = txOf(s);
    assert.ok(tx.reviewTitle && tx.reviewText);
    const st = JSON.parse(/ST=(\{.*?\}),TY=/s.exec(s)[1]);
    assert.ok(st.BANK_REVIEW && st.BANK_REVIEW.length > 3, l + ": a status label for it");
    if (l !== "ar") assert.ok(!/[؀-ۿ]/.test(st.BANK_REVIEW));
  }
  const s = inner(build(buildSimpleMy, "ar"));
  assert.ok(s.includes("payment.review"), "the page reads the flag");
  // the pay list, the home «needs you» list and the pay button row skip a receipt under review
  const viewPay = s.slice(s.indexOf("function viewPay("), s.indexOf("function viewChats("));
  assert.ok(viewPay.includes("payReview"), "viewPay filters on it");
  const home = s.slice(s.indexOf("function viewHome("), s.indexOf("function viewNew("));
  assert.ok(home.includes("payReview"), "home filters on it");
});

test("٦ /my and /ops read the amount from the payment when the request has no quotation", () => {
  const my = inner(build(buildSimpleMy, "ar"));
  const viewPay = my.slice(my.indexOf("function viewPay("), my.indexOf("function viewChats("));
  assert.ok(!viewPay.includes("r.quote?r.quote.total:0"), "no more quote-or-zero");
  assert.ok(/payAmt\(r\)/.test(viewPay));
  const ops = inner(build(buildSimpleOps, "ar"));
  const pay = ops.slice(ops.indexOf("payments:function(m)"), ops.indexOf("invoices:function(m)"));
  assert.ok(!pay.includes("r.quote?r.quote.total:0"), "ops payments no more quote-or-zero");
  assert.ok(/payAmt\(r\)/.test(pay));
});

test("٤ /checkout: a signed-quotation line leads to its request page instead of a dead-end sentence (4 languages)", () => {
  for (const l of LANGS) {
    const s = build(buildSimpleCheckout, l);
    assert.doesNotThrow(() => new vm.Script(inner(s)), l);
    assert.ok(s.includes("my?view=request&ref='+encodeURIComponent(String(quoteLine.id)"), l + ": the link to the request");
    const m = /var TX=(\{.*\});\n/.exec(s);
    assert.ok(m, l + ": TX embedded");
    const tx = JSON.parse(m[1]);
    assert.ok(tx.bankQuoteMsg && tx.bankQuoteGo, l + ": strings");
    if (l !== "ar") assert.ok(!/[؀-ۿ]/.test(tx.bankQuoteMsg + tx.bankQuoteGo), l + ": no Arabic");
  }
});

// ------------------------------------------------------------------ ١٥ phone prefill on /checkout (DOM stub over the real script)
function makeEl(id) {
  const el = {
    id, children: [], style: {}, attrs: {}, value: "", _t: "", className: "", disabled: false, onclick: null, href: "", classes: new Set(),
    classList: { toggle(c, on) { (on === undefined ? !el.classes.has(c) : on) ? el.classes.add(c) : el.classes.delete(c); }, add(c) { el.classes.add(c); }, remove(c) { el.classes.delete(c); }, contains: (c) => el.classes.has(c) },
    appendChild(c) { el.children.push(c); return c; },
    setAttribute(k, v) { el.attrs[k] = v; }, getAttribute: (k) => (k in el.attrs ? el.attrs[k] : null), removeAttribute(k) { delete el.attrs[k]; },
    querySelector: () => null, scrollIntoView() {},
    set innerHTML(v) { el.children = []; el._html = v; }, get innerHTML() { return el._html || ""; },
    set textContent(v) { el._t = String(v); el.children = []; }, get textContent() { return el._t; },
  };
  return el;
}
async function bootCheckout({ cart, snap, api }) {
  const els = new Map();
  const store = (init) => { const m = new Map(Object.entries(init || {})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const local = store({ bp_cart: JSON.stringify(cart) });
  const session = store(snap ? { bp_pay_order: JSON.stringify(snap) } : {});
  const fetches = [];
  const ways = ["card", "tamara", "bank"].map((w) => { const e = makeEl("way-" + w); e.attrs["data-way"] = w; e.classes.add("sv1-co-way"); return e; });
  const document = {
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    createElement: (tag) => { const e = makeEl(tag); e.tag = tag; return e; },
    querySelectorAll: (sel) => (sel === ".sv1-co-way" ? ways : []),
    documentElement: { getAttribute: () => "on" }, head: { appendChild() {} }, addEventListener() {}, dispatchEvent() {},
  };
  const location = { href: "https://x.test/ar/checkout", pathname: "/ar/checkout", origin: "https://x.test" };
  const sandbox = {
    document, localStorage: local, sessionStorage: session, location, URL, console,
    history: { replaceState() {} }, Event: class {}, CustomEvent: class {}, addEventListener() {}, dispatchEvent() {}, window: {},
    setTimeout, clearTimeout, Promise, JSON, Math, Number, String, Array, Object, Date, RegExp, encodeURIComponent,
    fetch: async (u, init = {}) => { const rec = { url: String(u), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null }; fetches.push(rec); return { ok: true, json: async () => api(rec) }; },
  };
  sandbox.window = sandbox;
  const page = buildSimpleCheckout({ header: () => "", footer: () => "", shell: (o) => o }, { lang: () => "ar", esc: (s) => String(s) });
  vm.runInNewContext(String(page.script).replace(/^<script>/, "").replace(/<\/script>$/, ""), sandbox);
  for (let i = 0; i < 14; i++) await new Promise((r) => setImmediate(r));
  return { els, fetches, document, session };
}
const CART = [{ id: "svc-bp-sbc-31", nameAr: "خدمة", nameEn: "Svc", amount: 1000, price: "", qty: 1, kind: "service", pricePublic: 1 }];
const apiWith = (profile) => (rec) => {
  if (rec.url === "/api/otp") return { ok: true, session: { user: { email: "sara@example.com", full_name: "Sara Al" } } };
  if (rec.url === "/api/simple") return { ok: true, user: profile };
  if (rec.method === "GET") return { enabled: true, mock: true, provider: "local-mock", formUrl: "/api/pay?action=mock-form", bnpl: { tamara: true } };
  return {};
};

test("١٥ /checkout: the saved mobile of the signed-in profile fills #coPhone", async () => {
  const w = await bootCheckout({ cart: CART, api: apiWith({ name: "Sara Al", email: "sara@example.com", phone: "0555123456" }) });
  assert.equal(w.document.getElementById("coPhone").value, "0555123456");
  assert.equal(w.document.getElementById("coEmail").value, "sara@example.com");
  const call = w.fetches.find((f) => f.url === "/api/simple");
  assert.ok(call && call.body.action === "me");
});

test("١٥ what the client typed (or came back from the gateway with) is never overwritten by the profile", async () => {
  const snap = { ref: "BP-123456", name: "Ali", email: "ali@acme.test", phone: "0599999999", company: "", items: [{ id: "svc-bp-sbc-31", qty: 1 }] };
  const w = await bootCheckout({ cart: CART, snap, api: apiWith({ phone: "0555123456" }) });
  assert.equal(w.document.getElementById("coPhone").value, "0599999999");
});

test("١٥ a profile without a mobile, a failed lookup and a guest all leave the field empty without an error", async () => {
  const w1 = await bootCheckout({ cart: CART, api: apiWith({ name: "Sara Al", phone: "" }) });
  assert.equal(w1.document.getElementById("coPhone").value, "");
  const w2 = await bootCheckout({ cart: CART, api: (rec) => { if (rec.url === "/api/simple") throw new Error("network"); return apiWith({})(rec); } });
  assert.equal(w2.document.getElementById("coPhone").value, "");
  const w3 = await bootCheckout({ cart: CART, api: (rec) => (rec.url === "/api/otp" ? { ok: true, session: null } : apiWith({})(rec)) });
  assert.equal(w3.document.getElementById("coPhone").value, "");
  assert.equal(w3.fetches.some((f) => f.url === "/api/simple"), false, "a guest triggers no profile lookup");
});

// ------------------------------------------------------------------ regressions found on the re-check
test("انحدار: «السلة والدفع» لا تنهار حين كل المعلّق قيد مراجعة الإيصال (rows فارغة وheld غير فارغة)", () => {
  for (const l of LANGS) {
    const s = inner(build(buildSimpleMy, l));
    const src = s.slice(s.indexOf("function viewPay("), s.indexOf("function viewChats("));
    assert.ok(src.length > 50, l);
    const sandbox = {
      TX: { navPay: "pay", reviewList: "review", empty: "empty" }, CHECKOUT: "/checkout",
      h: (tag, attrs, kids) => {
        const e = { tag, children: [] };
        (kids || []).forEach((k) => { if (k && typeof k === "object") e.children.push(k); });
        e.appendChild = (c) => { if (c == null) throw new TypeError("appendChild(null)"); e.children.push(c); return c; };
        e.insertBefore = (c) => { e.children.unshift(c); };
        return e;
      },
      reqRow: () => ({ children: [{}, {}], insertBefore() {} }), money: (n) => String(n), payAmt: (r) => r.amount || 0,
      payReview: (r) => !!(r.payment && r.payment.review), state: { me: { requests: [] } },
    };
    vm.runInNewContext(src, sandbox);
    const draw = (requests) => { sandbox.state.me.requests = requests; const m = sandbox.h("div"); sandbox.viewPay(m); return m; };
    const held = { status: "PAYMENT_PENDING", amount: 345, payment: { review: true } }, due = { status: "SIGNED", amount: 690, payment: {} };
    assert.doesNotThrow(() => draw([held, { ...held }]), l + ": only held");
    assert.doesNotThrow(() => draw([due]), l + ": only due");
    assert.doesNotThrow(() => draw([due, held]), l + ": both");
    assert.doesNotThrow(() => draw([]), l + ": none");
    assert.ok(!draw([held]).children.some((c) => c.tag === "p"), "no empty note when something is under review");
    assert.equal(draw([]).children.filter((c) => c.tag === "p").length, 1, "the empty note shows when there is nothing");
  }
});

test("انحدار: خانة الجوال في /checkout اتجاهها ltr فلا يظهر «+966…» معكوساً في الصفحة العربية", () => {
  for (const l of LANGS) {
    let body = "";
    buildSimpleCheckout({ header: () => "", footer: () => "", shell: (o) => { body = String(o.body); return o.script; } }, { lang: () => l, esc: (s) => String(s) });
    const m = /<input id="coPhone"[^>]*>/.exec(body);
    assert.ok(m, l + ": phone input");
    assert.match(m[0], /dir="ltr"/, l);
    assert.match(m[0], /type="tel"/, l);
  }
});
