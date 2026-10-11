// دفعة مؤكدة ← فاتورة ضريبية في الدفترة ← تصل بريد العميل مرة واحدة (طلب المالك 2026-10-11:
// «إذا العميل دفع تجيه فاتورة على الإيميل من الدفترة»).
//
// يشغّل المسار الحقيقي كاملاً في عملية واحدة: api/pay.js (رجوع المتصفح، خطّاف مُيسّر، تحقق تمارا)
// ← التسوية المختومة ← api/requests.js ← api/_simple.js (صف الطلب) ← api/_invoicing.js ← api/_daftra.js.
// قاعدة محلية JSON، والدفترة ومُيسّر وتمارا ونوشن وResend كلها محاكاة داخل fetch: لا شبكة، ولا شيء
// يصل الدفترة الحقيقية أو بريداً حقيقياً.
//
// المقاس:
//  ١) الدفع بالسلة ← فاتورة واحدة في الدفترة، السداد مسجَّل برقم عملية البوابة، تصل بريد العميل (لا المالك)
//     بأحسن ما يتوفّر: PDF مرفقاً، وإلا رابط الدفترة العام، وإلا الأرقام ورابط /my.
//  ٢) الفاتورة مربوطة بصف الطلب فتظهر في «الفواتير» داخل /my، والعميل لا يرى مسودتها ولا حالتها الداخلية.
//  ٣) إعادة الخطّاف / سبق أحدهما الآخر / سباق متزامن / سباق بين نسختين: فاتورة واحدة وبريد واحد.
//  ٤) تمارا: الطريقة المسجَّلة «Tamara»، ومرة واحدة عند إعادة التحميل.
//  ٥) فشل الدفترة: الدفع لا يضيع، يُسجَّل، يُنبَّه المالك مرة، تُفتح مهمة، ولا بريد للعميل بلا فاتورة؛
//     ثم تكتمل بإعادة المحاولة (يدوية أو بالمتابعة) بفاتورة واحدة وبريد واحد.
//  ٦) رفض البريد (المرسل التجريبي): الفاتورة قائمة والمالك يُخبَر بالسبب، ثم يصل العميل عند الإصلاح.
//  ٧) ردّ الدفترة الضائع بعد الإنشاء لا يُنتج فاتورة ثانية. وعامل ميّت يُستأنف عمله.
//  ٨) دفعة لا تُصدَر لها فاتورة (مبلغ لا يطابق): تُنبَّه مرة واحدة ولا يُستدعى الدفترة.
//  ٩) دفع عرضٍ قائم (sv1): الفاتورة على الطلب نفسه، تصل العميل، ولا تتكرر.
// ١٠) خارج الإنتاج لا شيء يصل الدفترة ما لم يُسمح صراحةً.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "invoice-delivery-"));
const OWNER = "owner@unit.local";
Object.assign(process.env, {
  APP_ENV: "development", LOCAL_DB_DIR: DIR, LOCAL_DB: "1",
  OTP_SECRET: "unit-otp-secret-invoice", NOTION_TOKEN: "notion-unit-token",
  MKT_SITE_BASE: "http://unit.local", CATALOG_URL: "http://unit.local/catalog.json",
  DAFTRA_API_KEY: "unit-daftra-key", DAFTRA_ALLOW_NONLIVE: "1",
  EMAIL_MODE: "live", RESEND_API_KEY: "re_unit_key", OTP_FROM_EMAIL: "Business Partner <invoices@unit.local>",
  BP_OWNER_EMAIL: OWNER,
  MOYASAR_SECRET_KEY: "sk_test_unit", MOYASAR_WEBHOOK_SECRET: "unit-hook-secret",
  TAMARA_API_TOKEN: "tamara-unit-token",
});
for (const k of ["MOYASAR_PUBLISHABLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_TOKEN", "ACS_CONNECTION_STRING", "AZURE_COMMUNICATION_CONNECTION_STRING"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const price = (code) => CATALOG.services.find((s) => s.code === code).amount;
const sar = (code, qty = 1) => Math.round(price(code) * qty * 1.15 * 100) / 100;   // شامل الضريبة
const ITEM = [{ id: "svc-bp-sbc-31", qty: 1 }];
const AMOUNT = sar("BP-SBC-31");

// ------------------------------------------------------------ the outside world --
const daftra = {};
const resend = {};
const moyasar = { payments: {} };
const tamara = { orders: {} };
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1500, 65), Buffer.from("\n%%EOF")]);
let invSeq = 0, clientSeq = 0;
function resetWorld() {
  Object.assign(daftra, { calls: [], clients: [], invoices: [], payments: [], pdf: false, publicOk: true, down: false, reject: false, lostReplies: 0 });
  Object.assign(resend, { sent: [], mode: "ok" });
}
resetWorld();

const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
function daftraFetch(u, init = {}) {
  const url = new URL(u);
  const method = init.method || "GET";
  const p = url.pathname.replace(/^\/api2/, "");
  daftra.calls.push(`${method} ${p}`);
  const body = init.body ? JSON.parse(init.body) : null;
  const isApi = url.pathname.startsWith("/api2/");
  if (isApi && p === "/taxes.json") return json({ data: [{ Tax: { id: 7, value: "15", is_active: 1 } }] });
  if (isApi && p === "/products.json") return json({ data: [] });
  if (isApi && p === "/clients.json" && method === "GET") return json({ data: daftra.clients.map((c) => ({ Client: c })) });
  if (isApi && p === "/clients.json" && method === "POST") {
    const c = { id: 900 + ++clientSeq, ...body.Client };
    daftra.clients.push(c);
    return json({ result: "successful", id: c.id });
  }
  if (isApi && /^\/clients\/\d+\.json$/.test(p)) return json({ result: "successful" });
  if (isApi && p === "/invoices.json" && method === "POST") {
    if (daftra.down) return new Response("Service Unavailable", { status: 503 });
    if (daftra.reject) return json({ result: "failed", message: "فشل في حفظ الفاتورة", validation_errors: { Invoice: { client_id: ["مطلوب"] } } });
    const id = 5000 + ++invSeq;
    const h = body.Invoice;
    daftra.invoices.push({ id, no: "INV" + id, client_id: h.client_id, client_reference: h.client_reference || "", notes: h.notes, items: body.InvoiceItem });
    if (daftra.lostReplies > 0) { daftra.lostReplies--; return new Response("Bad Gateway", { status: 502 }); }
    return json({ result: "successful", id });
  }
  if (isApi && p === "/invoices.json" && method === "GET") {
    return json({ data: daftra.invoices.map((i) => ({ Invoice: { id: i.id, no: i.no, client_reference: i.client_reference, notes: i.notes } })) });
  }
  let m = /^\/invoices?\/(\d+)\.json$/.exec(p);
  if (isApi && m && method === "GET") {
    const inv = daftra.invoices.find((i) => String(i.id) === m[1]);
    return inv ? json({ Invoice: { id: inv.id, no: inv.no } }) : json({ result: "failed" }, 404);
  }
  if (isApi && p === "/invoice_payments.json" && method === "POST") {
    daftra.payments.push(body.InvoicePayment);
    return json({ result: "successful", id: 7000 + daftra.payments.length });
  }
  // the client-facing page of one invoice (no query) vs. every PDF route Daftra might answer
  m = /^\/invoices\/view\/(\d+)$/.exec(url.pathname);
  if (m && !url.search) {
    return daftra.publicOk
      ? new Response("<html><body>فاتورة ضريبية — الرقم الضريبي 312079341500003</body></html>", { status: 200 })
      : new Response("<html><body>تسجيل الدخول — password</body></html>", { status: 200 });
  }
  if (/\.pdf$|\/pdf\/|download|\/print\//.test(url.pathname) && daftra.pdf) return new Response(PDF, { status: 200, headers: { "content-type": "application/pdf" } });
  return new Response("not found", { status: 404 });
}

let requestsHandler;
const unexpected = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === "http://unit.local/catalog.json") return json(CATALOG);
  if (u.startsWith("https://api.notion.com/")) return /\/query$/.test(u) ? json({ results: [] }) : json({ id: "page-unit" });
  if (u === "http://unit.local/api/requests") {
    return await new Promise((resolve, reject) => {
      const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
        end(s) { resolve(new Response(s, { status: this.statusCode, headers: { "content-type": "application/json" } })); } };
      Promise.resolve(requestsHandler({ method: "POST", headers: {}, query: {}, url: "/api/requests", body: init.body }, res)).catch(reject);
    });
  }
  if (u.startsWith("https://businesspartner.daftra.com/")) return daftraFetch(u, init);
  if (u === "https://api.resend.com/emails") {
    const b = JSON.parse(init.body);
    const to = b.to[0];
    if (resend.mode === "down") return new Response("boom", { status: 500 });
    if (resend.mode === "sandbox" && to !== OWNER) return json({ message: "You can only send testing emails to your own email address" }, 403);
    resend.sent.push({ to, subject: b.subject, html: b.html, attachments: b.attachments || [], from: b.from });
    return json({ id: "em_" + resend.sent.length });
  }
  if (u.startsWith("https://api.resend.com/")) return json({});          // audiences / contacts
  let m = /^https:\/\/api\.moyasar\.com\/v1\/payments\/([\w-]+)$/.exec(u);
  if (m) return moyasar.payments[m[1]] ? json(moyasar.payments[m[1]]) : json({ message: "not found" }, 404);
  m = /^https:\/\/api-sandbox\.tamara\.co\/orders\/([\w-]+)$/.exec(u);
  if (m) return tamara.orders[m[1]] ? json(tamara.orders[m[1]]) : json({ message: "not found" }, 404);
  unexpected.push(u);
  return json({ message: "blocked in unit test" }, 599);
};

const { default: payHandler } = await import("../api/pay.js");
({ default: requestsHandler } = await import("../api/requests.js"));
const { handleSimple, markPaid, markRequestPaidByRef, retryPendingInvoices } = await import("../api/_simple.js");
const { issuePaidInvoice, publicInvoice, invoiceIsComplete, tuning } = await import("../api/_invoicing.js");
const { daftraResetPdfCache } = await import("../api/_daftra.js");
const { sb, sha256 } = await import("../api/_db.js");
tuning.transientPauseMs = 5;

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-inv-aaaaaaaaaaa" };
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${CLIENT.token}` }, socket: {}, query: {}, body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body } }, res);
  return out;
}
let seq = 0;
const nextIds = () => { seq++; return { orderRef: "BP-V" + String(seq).padStart(5, "0"), payId: "mock_card_inv" + String(seq).padStart(5, "0") }; };

// المتصفح يعود من البوابة (المسار الذي يستعمله النموذج بعد الدفع)
async function pay(items = ITEM, amountSar = AMOUNT, { email = CLIENT.email, ids = nextIds(), order = {} } = {}) {
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; out.body = JSON.parse(b); } };
  await payHandler({ method: "POST", headers: {}, query: {}, url: "/api/pay",
    body: { id: ids.payId, amount: amountSar, order: { ref: ids.orderRef, name: "مشتري السلة", email, phone: "0500000000", company: "شركة الاختبار", items, ...order } } }, res);
  return { ...ids, status: out.status, body: out.body, invoice: out.body && out.body.invoice, requestRef: out.body && out.body.settle && out.body.settle.request && out.body.settle.request.ref };
}
// مُيسّر يُبلغ بالدفعة (الخطّاف): يُسأل مُيسّر نفسه عن الدفعة قبل تصديقها
async function webhook(ids, { items = ITEM, amountSar = AMOUNT, email = CLIENT.email, tax = "" } = {}) {
  moyasar.payments[ids.payId] = {
    id: ids.payId, status: "paid", amount: Math.round(amountSar * 100), currency: "SAR",
    metadata: { ref: ids.orderRef, items: items.map((i) => `${i.id}~${i.qty}`).join(","), name: "مشتري السلة", email, phone: "0500000000", co: "شركة الاختبار", ...(tax ? { tax } : {}) },
  };
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; out.body = JSON.parse(b); } };
  await payHandler({ method: "POST", headers: {}, query: {}, url: "/api/pay", body: { secret_token: "unit-hook-secret", type: "payment_paid", data: { id: ids.payId } } }, res);
  return out;
}
const rowOf = async (payId) => (await sb("requests?select=*")).find((r) => r.payment && r.payment.pay_ref === payId);
const invoiceMails = () => resend.sent.filter((m) => /^فاتورة /.test(m.subject));
const ownerMails = () => resend.sent.filter((m) => m.to === OWNER);

// ============================================================ ١) المسار الكامل ==
test("دفع بالسلة: فاتورة واحدة في الدفترة، السداد برقم العملية، وتصل بريد العميل لا المالك", async () => {
  resetWorld(); daftraResetPdfCache();
  const r = await pay();
  assert.equal(r.body.ok, true);
  assert.equal(r.invoice.invoiced, true, JSON.stringify(r.invoice));
  assert.match(r.invoice.number, /^INV\d+$/);
  assert.equal(r.invoice.clientEmailed, true, "«أُرسلت» تُقرأ من نجاح الإرسال لا من وجود ملف");

  assert.equal(daftra.invoices.length, 1, "فاتورة واحدة في الدفترة");
  assert.equal(daftra.invoices[0].client_reference, r.orderRef);
  assert.match(daftra.invoices[0].notes, new RegExp("مرجع الطلب: " + r.orderRef));
  assert.equal(daftra.payments.length, 1);
  assert.equal(daftra.payments[0].transaction_id, r.payId, "السداد برقم عملية البوابة");
  assert.equal(daftra.payments[0].payment_method, "Moyasar");
  assert.equal(daftra.payments[0].amount, AMOUNT);
  assert.equal(daftra.clients.length, 1);

  const inv = invoiceMails();
  assert.equal(inv.length, 1, "بريد فاتورة واحد");
  assert.equal(inv[0].to, CLIENT.email, "إلى العميل");
  assert.ok(!ownerMails().some((m) => /^فاتورة /.test(m.subject)), "ليست للمالك");
  assert.ok(inv[0].html.includes(r.invoice.number) && inv[0].html.includes(String(AMOUNT)), "الرقم والإجمالي في المتن");
  assert.ok(inv[0].html.includes("/ar/my?ref=" + r.requestRef), "رابط الفاتورة في حسابه");
  assert.ok(inv[0].html.includes("https://businesspartner.daftra.com/invoices/view/"), "رابط صفحة الدفترة الرسمية عند غياب الـPDF");
  assert.equal(inv[0].attachments.length, 0);
  assert.match(inv[0].from, /invoices@unit\.local/, "المرسل المضبوط لا التجريبي");

  // ما يُرسل إلى المتصفح لا يحمل مسودة الفاتورة
  assert.ok(!JSON.stringify(r.body).includes("draft") && !("record" in r.invoice));
});

test("الفاتورة تُربط بصف الطلب: تظهر في «الفواتير» داخل /my، والعميل لا يرى مسودتها ولا حالتها", async () => {
  resetWorld();
  const r = await pay();
  const row = await rowOf(r.payId);
  assert.equal(row.ref, r.requestRef);
  const iv = row.invoice;
  assert.equal(iv.number, r.invoice.number);
  assert.equal(iv.mode, "daftra");
  assert.equal(iv.status, "issued");
  assert.equal(iv.daftra_id, daftra.invoices[0].id);
  assert.equal(iv.payment_recorded, true);
  assert.equal(iv.total, AMOUNT);
  assert.equal(iv.delivery.to, CLIENT.email);
  assert.ok(iv.delivery.sent_at);
  assert.match(iv.pdf_url, /^https:\/\/businesspartner\.daftra\.com\/invoices\/view\//, "الفاتورة الرسمية تُفتح من /my");
  assert.equal(invoiceIsComplete(iv), true);

  // قائمة /my (الفواتير تُرسم من requests التي لها invoice)
  const me = await call("me");
  const mine = me.body.requests.find((x) => x.ref === r.requestRef);
  assert.deepEqual(mine.invoice, { number: iv.number, total: AMOUNT });
  const g = await call("request-get", { ref: r.requestRef });
  const seen = g.body.request.invoice;
  assert.equal(seen.number, iv.number);
  assert.equal(seen.pdf_url, iv.pdf_url);
  for (const k of ["draft", "claim_id", "claimed_at", "attempts", "last_error", "alerts", "status"]) assert.ok(!(k in seen), "لا يرى العميل " + k);
  assert.equal(seen.delivery.to, CLIENT.email);
  // الخط الزمني: «صدرت الفاتورة» ظاهرة، وسجلات البريد الداخلية لا
  const evs = g.body.request.events.map((e) => e.event);
  assert.ok(evs.includes("invoice.issued"));
  assert.ok(!evs.includes("invoice.emailed") && !evs.includes("invoice.failed"));
});

test("الـPDF متاح ⇒ يُرفق بالبريد، ولا يُغني عنه الرابط", async () => {
  resetWorld(); daftraResetPdfCache(); daftra.pdf = true;
  const r = await pay();
  assert.equal(r.invoice.invoiced, true);
  assert.equal(r.invoice.pdfAttached, true);
  const m = invoiceMails();
  assert.equal(m.length, 1);
  assert.equal(m[0].attachments.length, 1);
  assert.match(m[0].attachments[0].filename, /^TAX_Invoice-INV\d+\.pdf$/);
  assert.ok(Buffer.from(m[0].attachments[0].content, "base64").subarray(0, 5).toString("latin1") === "%PDF-");
  assert.match(m[0].html, /مرفقة/);
});

test("لا PDF ولا صفحة عامة: يصل العميل الرقم والمبالغ ورابط حسابه — لا «أرفقها يدوياً» على المالك", async () => {
  resetWorld(); daftraResetPdfCache(); daftra.publicOk = false;
  const r = await pay();
  assert.equal(r.invoice.invoiced, true);
  const m = invoiceMails();
  assert.equal(m.length, 1, "العميل لا يُترك بلا شيء");
  assert.equal(m[0].to, CLIENT.email);
  assert.ok(m[0].html.includes(r.invoice.number) && m[0].html.includes("/ar/my?ref="));
  assert.ok(!m[0].html.includes("daftra.com"), "لا رابط يقود إلى صفحة دخول");
  assert.equal(ownerMails().filter((x) => /يدوياً|تحتاج إرفاق/.test(x.subject)).length, 0);
  const row = await rowOf(r.payId);
  assert.equal(row.invoice.delivery.mode, "summary");
  assert.equal(row.invoice.status, "issued");
  assert.ok(!row.invoice.pdf_url);
});

// ============================================================ ٣) idempotent ==
test("إعادة الخطّاف بعد رجوع المتصفح (مرتين): فاتورة واحدة وبريد واحد", async () => {
  resetWorld();
  const ids = nextIds();
  const a = await pay(ITEM, AMOUNT, { ids });
  assert.equal(a.invoice.invoiced, true);
  const w1 = await webhook(ids);
  const w2 = await webhook(ids);
  assert.equal(w1.body.handled, true);
  // (سجلّ نوشن قد لا يكشف التكرار فيُقال «غير مسوّاة» — الحارس الفعلي هو سجلّ الفاتورة على صف الطلب)
  assert.equal(w1.body.invoice.invoiced, true);
  assert.equal(w1.body.invoice.already, true, "الفاتورة قائمة لا تُصدر ثانية");
  assert.equal(w2.body.invoice.already, true);
  assert.equal(daftra.invoices.length, 1);
  assert.equal(daftra.payments.length, 1);
  assert.equal(invoiceMails().length, 1);
  // وإعادة رجوع المتصفح نفسه (تحديث الصفحة)
  const b = await pay(ITEM, AMOUNT, { ids });
  assert.equal(b.invoice.invoiced, true);
  assert.equal(b.invoice.already, true);
  assert.equal(b.invoice.number, a.invoice.number, "الرقم نفسه");
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
});

test("الخطّاف يسبق المتصفح: يصدر هو، والمتصفح لا يكرّر", async () => {
  resetWorld();
  const ids = nextIds();
  const w = await webhook(ids);
  assert.equal(w.body.invoice.invoiced, true, JSON.stringify(w.body));
  assert.equal(w.body.invoice.clientEmailed, true);
  assert.equal(invoiceMails().length, 1);
  const b = await pay(ITEM, AMOUNT, { ids });
  assert.equal(b.invoice.already, true);
  assert.equal(b.invoice.number, w.body.invoice.number);
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
  assert.equal(invoiceMails()[0].to, CLIENT.email);
});

test("سباق: المتصفح والخطّاف في اللحظة نفسها ⇒ فاتورة واحدة وبريد واحد", async () => {
  resetWorld();
  const ids = nextIds();
  const [a, w] = await Promise.all([pay(ITEM, AMOUNT, { ids }), webhook(ids)]);
  assert.equal(daftra.invoices.length, 1, "فاتورة واحدة");
  assert.equal(invoiceMails().length, 1, "بريد واحد");
  const numbers = new Set([a.invoice.number, w.body.invoice && w.body.invoice.number].filter(Boolean));
  assert.equal(numbers.size, 1);
  assert.equal((await sb("requests?select=ref,payment")).filter((r) => r.payment && r.payment.pay_ref === ids.payId).length, 1);
});

test("سباق بين نسختين من الدالة (لا ذاكرة مشتركة): الحجز في صف الطلب يحسم، والخاسر لا يصدر", async () => {
  resetWorld();
  const ids = nextIds();
  // الطلب موجود بلا فاتورة (دفع سُوّي ولم تُصدر فاتورته بعد)
  const first = await pay(ITEM, AMOUNT, { ids });
  const row = await rowOf(ids.payId);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { invoice: null } });
  const before = daftra.invoices.length, mails = invoiceMails().length;
  const draft = { ref: ids.orderRef, payId: ids.payId, method: "Moyasar", buyer: { name: "مشتري السلة", email: CLIENT.email, phone: "0500000000" }, items: [{ code: "BP-SBC-31", name: "x", quantity: 1, unitPrice: price("BP-SBC-31") }], notes: "مرجع الطلب: " + ids.orderRef + "\nنسخة" };
  const target = { rowId: row.id, myUrl: "http://unit.local/ar/my?ref=" + row.ref, hooks: null };
  const A = issuePaidInvoice({ key: "copy-A", draft, target });
  const B = issuePaidInvoice({ key: "copy-B", draft, target });      // مفتاح مختلف = ذاكرة نسخة أخرى
  const [ra, rb] = await Promise.all([A, B]);
  const won = [ra, rb].filter((x) => x.invoiced && !x.already);
  const lost = [ra, rb].filter((x) => !x.invoiced);
  assert.equal(won.length, 1, JSON.stringify([ra, rb]));
  assert.equal(lost.length, 1);
  assert.equal(lost[0].reason, "already_settled");
  assert.equal(daftra.invoices.length, before + 1, "فاتورة واحدة جديدة");
  assert.equal(invoiceMails().length, mails + 1, "بريد واحد");
  assert.ok(first.invoice.invoiced);
});

// ============================================================ ٤) تمارا ==
test("تمارا: الفاتورة بطريقة «Tamara» وتصل العميل مرة واحدة، وإعادة التحميل لا تكرّرها", async () => {
  resetWorld();
  const orderRef = "BP-T00001", orderId = "t-order-0001";
  tamara.orders[orderId] = { status: "fully_captured", total_amount: { amount: AMOUNT.toFixed(2), currency: "SAR" } };
  const verify = async () => {
    const out = { status: 200, body: null };
    const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; out.body = JSON.parse(b); } };
    await payHandler({ method: "POST", headers: {}, query: {}, url: "/api/pay", body: { action: "bnpl-verify", id: orderId, order: { ref: orderRef, name: "مشتري تمارا", email: CLIENT.email, phone: "0500000000", items: ITEM } } }, res);
    return out.body;
  };
  const a = await verify();
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.invoice.invoiced, true, JSON.stringify(a.invoice));
  assert.equal(daftra.payments.length, 1);
  assert.equal(daftra.payments[0].payment_method, "Tamara");
  assert.equal(daftra.payments[0].transaction_id, "tamara_" + orderId);
  assert.equal(invoiceMails().length, 1);
  assert.equal(invoiceMails()[0].to, CLIENT.email);
  const b = await verify();                      // المستخدم أعاد تحميل صفحة العودة
  assert.equal(b.invoice.invoiced, true);
  assert.equal(b.invoice.already, true);
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
});

// ============================================================ ٥) فشل الدفترة ==
test("الدفترة معطّلة: الدفع محفوظ، السجلّ والمهمة والتنبيه مرة واحدة، لا بريد للعميل بلا فاتورة؛ ثم تكتمل بإعادة المحاولة", async () => {
  resetWorld();
  daftra.down = true;
  const ids = nextIds();
  const r = await pay(ITEM, AMOUNT, { ids });
  assert.equal(r.body.ok, true, "الدفع لا يضيع");
  assert.equal(r.invoice.invoiced, false);
  assert.equal(r.invoice.alerted, true);
  assert.ok(r.requestRef, "الطلب مفتوح ومدفوع");
  const row = await rowOf(ids.payId);
  assert.equal(row.status, "PAID");
  assert.equal(row.payment.status, "PAID");
  assert.equal(row.invoice.status, "failed");
  assert.equal(row.invoice.attempts, 1);
  assert.ok(Date.parse(row.invoice.next_retry_at) > Date.now(), "موعد المحاولة التالية مسجَّل");
  assert.ok(row.invoice.draft && row.invoice.draft.items.length === 1, "المسودة محفوظة لتعاد بالأسعار التي دُفعت");
  assert.equal(invoiceMails().length, 0, "لا بريد فاتورة للعميل");
  assert.equal(daftra.invoices.length, 0);

  // المالك أُخبر مرة واحدة بالسبب، وفُتحت مهمة بشرية
  const alerts = ownerMails().filter((m) => /لم تصدر من الدفترة/.test(m.subject));
  assert.equal(alerts.length, 1, resend.sent.map((m) => m.subject).join(" | "));
  assert.match(alerts[0].html, /daftra_failed|الدفترة/);
  assert.ok(!ownerMails().some((m) => /وصلت ولم يكتمل تسجيلها/.test(m.subject)), "لا تنبيه عام مكرر");
  const tasks = (await sb(`tasks?request_id=eq.${row.id}&select=source,status,human_action`)).filter((t) => t.source === "invoice-failed");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].human_action, true);

  // العميل لا يرى فاتورة وهمية
  const g = await call("request-get", { ref: r.requestRef });
  assert.equal(g.body.request.invoice, null);
  const me = await call("me");
  assert.equal(me.body.requests.find((x) => x.ref === r.requestRef).invoice, null);

  // رجوع الخطّاف قبل الموعد لا يضرب الدفترة ولا يُنبّه ثانية
  const callsBefore = daftra.calls.length;
  const w = await webhook(ids);
  assert.equal(w.body.invoice.invoiced, false);
  assert.equal(daftra.calls.length, callsBefore, "ينتظر موعده");
  assert.equal(ownerMails().filter((m) => /لم تصدر من الدفترة/.test(m.subject)).length, 1, "التنبيه مرة واحدة");

  // المتابعة قبل الموعد: لا شيء
  const early = await retryPendingInvoices();
  assert.equal(early.retried, 0);

  // الدفترة تعود، ويحين الموعد ⇒ المتابعة (ops-sweep) تكمل
  daftra.down = false;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { invoice: { ...row.invoice, next_retry_at: new Date(Date.now() - 1000).toISOString() } } });
  const sweep = await call("ops-sweep", {});
  assert.equal(sweep.body.invoices.issued, 1, JSON.stringify(sweep.body.invoices));
  assert.equal(daftra.invoices.length, 1);
  assert.equal(daftra.payments.length, 1);
  assert.equal(invoiceMails().length, 1);
  assert.equal(invoiceMails()[0].to, CLIENT.email);
  const done = await rowOf(ids.payId);
  assert.equal(done.invoice.status, "issued");
  assert.equal(done.invoice.attempts, 2);
  assert.ok(done.invoice.number);
  const t2 = (await sb(`tasks?request_id=eq.${row.id}&select=source,status`)).filter((t) => t.source === "invoice-failed");
  assert.equal(t2[0].status, "done", "المهمة تُغلق حين تصل الفاتورة");
  const seen = (await call("request-get", { ref: r.requestRef })).body.request.invoice;
  assert.equal(seen.number, done.invoice.number, "تظهر الآن في /my");

  // ولا مرة ثالثة
  await call("ops-sweep", {});
  await webhook(ids);
  const again = await call("ops-invoice-retry", { ref: r.requestRef });
  assert.equal(again.body.retried, 0);
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
});

test("«أعد المحاولة» من اللوحة تتجاوز الانتظار، ويُرفض الخطأ نفسه فلا تتكاثر الفواتير", async () => {
  resetWorld();
  daftra.reject = true;                              // الدفترة ترفض الحفظ (تحقق) لا تنقطع
  const ids = nextIds();
  const r = await pay(ITEM, AMOUNT, { ids });
  assert.equal(r.invoice.invoiced, false);
  assert.match(r.invoice.reason, /daftra_failed/);
  assert.equal(daftra.invoices.length, 0, "الرفض لا ينشئ شيئاً");
  const row = await rowOf(ids.payId);
  assert.equal(row.invoice.status, "failed");
  const again = await call("ops-invoice-retry", { ref: row.ref });       // ما زالت مرفوضة
  assert.equal(again.body.failed, 1);
  assert.equal((await rowOf(ids.payId)).invoice.attempts, 2);
  assert.equal(ownerMails().filter((m) => /لم تصدر من الدفترة/.test(m.subject)).length, 1, "لا تنبيه ثانٍ لنفس السبب");
  daftra.reject = false;
  const ok = await call("ops-invoice-retry", { ref: row.ref });
  assert.equal(ok.body.issued, 1);
  assert.equal(ok.body.invoice.status, "issued");
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
});

// ============================================================ ٦) رفض البريد ==
test("المرسل التجريبي يرفض عميلاً: الفاتورة قائمة، المالك يعرف السبب، وتصل العميل مرة عند الإصلاح", async () => {
  resetWorld(); resend.mode = "sandbox";
  const keepFrom = process.env.OTP_FROM_EMAIL;
  process.env.OTP_FROM_EMAIL = "Business Partner <onboarding@resend.dev>";      // ما يحدث حين لا يُضبط OTP_FROM_EMAIL
  const ids = nextIds();
  let r;
  try { r = await pay(ITEM, AMOUNT, { ids }); } finally { process.env.OTP_FROM_EMAIL = keepFrom; }
  assert.equal(r.invoice.invoiced, true, "الفاتورة صدرت في الدفترة");
  assert.equal(r.invoice.clientEmailed, false, "لم تصل — ولا ندّعي أنها وصلت");
  assert.equal(invoiceMails().length, 0);
  const row = await rowOf(ids.payId);
  assert.equal(row.invoice.status, "created");
  assert.match(row.invoice.last_error, /resend_sandbox_sender/);
  assert.equal(row.invoice.payment_recorded, true);
  const alerts = ownerMails().filter((m) => /لم تصل العميل/.test(m.subject));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].html, /OTP_FROM_EMAIL/, "يقول ما الذي يُضبط");
  // لم تُنشأ فاتورة ثانية ولا سُجّل السداد ثانية
  resend.mode = "ok";
  const fix = await call("ops-invoice-retry", { ref: row.ref });
  assert.equal(fix.body.issued, 1, JSON.stringify(fix.body));
  assert.equal(daftra.invoices.length, 1);
  assert.equal(daftra.payments.length, 1);
  assert.equal(invoiceMails().length, 1);
  assert.equal(invoiceMails()[0].to, CLIENT.email);
  assert.equal((await rowOf(ids.payId)).invoice.status, "issued");
  const again = await call("ops-invoice-retry", { ref: row.ref });
  assert.equal(again.body.retried, 0);
  assert.equal(invoiceMails().length, 1);
});

// ============================================================ ٧) ردّ ضائع وعامل ميّت ==
test("الدفترة حفظت الفاتورة وضاع ردّها (502): لا فاتورة ثانية — تُتبنّى بمرجعها", async () => {
  resetWorld(); daftra.lostReplies = 1;
  const r = await pay();
  assert.equal(r.invoice.invoiced, true, JSON.stringify(r.invoice));
  assert.equal(daftra.invoices.length, 1, "فاتورة واحدة في الدفترة");
  assert.equal(daftra.payments.length, 1);
  assert.equal(invoiceMails().length, 1);
  assert.equal(r.invoice.number, daftra.invoices[0].no);
});

test("عامل مات بعد أن أنشأ الفاتورة في الدفترة: يُستأنف بلا تكرار ولا بريد مضاعف", async () => {
  resetWorld();
  daftra.down = true;
  const ids = nextIds();
  await pay(ITEM, AMOUNT, { ids });
  const row = await rowOf(ids.payId);
  daftra.down = false;
  // ما فعله الميّت: أنشأ الفاتورة في الدفترة، ثم مات والسجلّ ما زال «قيد الإصدار» منذ دقائق
  daftra.invoices.push({ id: 6001, no: "INV6001", client_id: 900, client_reference: ids.orderRef, notes: "مرجع الطلب: " + ids.orderRef, items: [] });
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { invoice: { ...row.invoice, status: "issuing", claimed_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), next_retry_at: null } } });
  const r = await retryPendingInvoices();
  assert.equal(r.issued, 1, JSON.stringify(r));
  assert.equal(daftra.invoices.length, 1, "لا فاتورة ثانية");
  const done = await rowOf(ids.payId);
  assert.equal(done.invoice.daftra_id, 6001);
  assert.equal(done.invoice.number, "INV6001");
  assert.equal(done.invoice.status, "issued");
  assert.equal(daftra.payments.length, 1);
  assert.equal(invoiceMails().length, 1);
  // وعاملٌ حيّ (حجزه طازج) لا يُسرق منه العمل
  const live = await call("ops-invoice-retry", { ref: row.ref });
  assert.equal(live.body.retried, 0);
});

// ============================================================ ٨) لا تُصدَر ==
test("مبلغ لا يطابق السلة: لا نداء للدفترة، ويُنبَّه المالك مرة واحدة (لا مرتين من قناتين)", async () => {
  resetWorld();
  const ids = nextIds();
  const r = await pay(ITEM, AMOUNT - 300, { ids });
  assert.equal(r.invoice.invoiced, false);
  assert.equal(r.invoice.reason, "amount_mismatch");
  assert.equal(daftra.calls.length, 0, "لا يمسّ الدفترة");
  assert.equal(invoiceMails().length, 0);
  const row = await rowOf(ids.payId);
  assert.equal(row.invoice.status, "blocked");
  assert.equal(ownerMails().filter((m) => /لا يمكن إصدارها آلياً/.test(m.subject)).length, 1);
  assert.equal(ownerMails().filter((m) => /وصلت ولم يكتمل تسجيلها/.test(m.subject)).length, 0, "التنبيه العام لا يتكرر");
  const w = await webhook(ids, { amountSar: AMOUNT - 300 });
  assert.equal(w.body.invoice.invoiced, false);
  assert.equal(ownerMails().filter((m) => /لا يمكن إصدارها آلياً/.test(m.subject)).length, 1, "ولا من الخطّاف");
  assert.equal(daftra.calls.length, 0);
  assert.equal((await call("request-get", { ref: row.ref })).body.request.invoice, null);
});

// ============================================================ ٩) دفع عرضٍ قائم (sv1) ==
test("دفع عرضٍ موقَّع (sv1): الفاتورة على الطلب نفسه، تصل العميل مرة، ولا تتكرر", async () => {
  resetWorld();
  const ref = "BP-R-A1B2C3";
  const quote = { number: "Q-2026-77", status: "APPROVED", net: 2000, vat: 300, total: 2300, items: [{ title: "ترخيص نشاط", qty: 1, price: 2000, line: 2000 }] };
  await sb("requests", { method: "POST", body: [{
    ref, organization_id: CLIENT.org, user_id: CLIENT.user, type: "GOVERNMENT_SERVICE", source: "WEBSITE", status: "SIGNED", lang: "ar", title: "ترخيص نشاط",
    quote, client_name: "عميل العرض", client_email: CLIENT.email, client_phone: "0500000000", company_name: "شركة العرض",
  }] });
  const payId = "mock_card_sv100001";
  const up = await markRequestPaidByRef(ref, { provider: "moyasar", payId, amount: 2300, test: false, actor: "moyasar" });
  assert.equal(up.status, "PAID");
  assert.equal(daftra.invoices.length, 1);
  assert.equal(daftra.payments.length, 1);
  assert.equal(daftra.payments[0].transaction_id, payId);
  assert.equal(daftra.invoices[0].client_reference, ref);
  const mail = invoiceMails();
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, CLIENT.email);
  assert.ok(mail[0].html.includes("2300"));
  const row = (await sb(`requests?ref=eq.${ref}&select=*`))[0];
  assert.equal(row.invoice.mode, "daftra");
  assert.equal(row.invoice.status, "issued");
  assert.match(row.invoice.number, /^INV\d+$/, "رقم الدفترة لا رقم داخلي مختلق");
  const me = await call("me");
  assert.equal(me.body.requests.find((x) => x.ref === ref).invoice.number, row.invoice.number, "في «الفواتير»");
  // مرة ثانية (إعادة المعالجة) لا تُصدر ولا تُرسل
  await markPaid({ ...row, status: "SIGNED" }, { provider: "moyasar", payId, amount: 2300, test: false, actor: "moyasar" });
  await markRequestPaidByRef(ref, { provider: "moyasar", payId, amount: 2300, test: false, actor: "moyasar" });
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
});

test("sv1 والدفترة معطّلة: لا رقم مختلق للعميل، مهمة للفريق، وتكتمل بإعادة المحاولة", async () => {
  resetWorld(); daftra.down = true;
  const ref = "BP-R-D4E5F6";
  await sb("requests", { method: "POST", body: [{
    ref, organization_id: CLIENT.org, user_id: CLIENT.user, type: "GOVERNMENT_SERVICE", source: "WEBSITE", status: "SIGNED", lang: "ar", title: "تجديد سجل",
    quote: { number: "Q-2026-78", status: "APPROVED", net: 1000, vat: 150, total: 1150, items: [{ title: "تجديد سجل", qty: 1, price: 1000, line: 1000 }] },
    client_name: "عميل", client_email: CLIENT.email, client_phone: "0500000000",
  }] });
  await markRequestPaidByRef(ref, { provider: "moyasar", payId: "mock_card_sv100002", amount: 1150, test: false, actor: "moyasar" });
  const row = (await sb(`requests?ref=eq.${ref}&select=*`))[0];
  assert.equal(row.status, "PAID");
  assert.equal(row.invoice.status, "failed");
  assert.ok(!row.invoice.number, "لا INV- مختلق");
  assert.equal((await call("request-get", { ref })).body.request.invoice, null);
  assert.equal(invoiceMails().length, 0);
  assert.equal((await sb(`tasks?request_id=eq.${row.id}&select=source`)).filter((t) => t.source === "invoice-failed").length, 1);
  daftra.down = false;
  const r = await call("ops-invoice-retry", { ref });
  assert.equal(r.body.issued, 1, JSON.stringify(r.body));
  assert.equal(daftra.invoices.length, 1);
  assert.equal(invoiceMails().length, 1);
});

// ============================================================ ١٠) أمان ==
test("خارج الإنتاج لا شيء يصل الدفترة ما لم يُسمح صراحةً (DAFTRA_ALLOW_NONLIVE)", async () => {
  resetWorld();
  delete process.env.DAFTRA_ALLOW_NONLIVE;
  try {
    const r = await pay();
    assert.equal(r.body.ok, true);
    assert.equal(r.invoice.invoiced, false);
    assert.equal(r.invoice.reason, "daftra_skipped_nonlive");
    assert.equal(daftra.calls.length, 0, "لا نداء للدفترة");
    assert.equal(invoiceMails().length, 0);
  } finally { process.env.DAFTRA_ALLOW_NONLIVE = "1"; }
});

test("publicInvoice: لا رقم ⇒ لا يظهر، ولا تتسرب المسودة", () => {
  assert.equal(publicInvoice(null), null);
  assert.equal(publicInvoice({ number: "", status: "failed", draft: { buyer: { email: "a@b.c" } } }), null);
  const v = publicInvoice({ number: "INV1", total: 115, status: "issued", draft: { x: 1 }, claim_id: "z", alerts: ["email"], attempts: 2, last_error: "boom",
    delivery: { to: "a@b.c", mode: "link", sent_at: "2026-10-11T00:00:00Z", last_error: "x", attempts: 1 }, pdf_url: "https://d/x" });
  assert.deepEqual(Object.keys(v).sort(), ["delivery", "number", "pdf_url", "total"]);
  assert.deepEqual(v.delivery, { to: "a@b.c", mode: "link", sent_at: "2026-10-11T00:00:00Z" });
});

test("لا نداء شبكة خارج المحاكاة", () => {
  assert.deepEqual(unexpected, []);
});
