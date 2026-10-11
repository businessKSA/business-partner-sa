// الشراء بالسلة يفتح طلباً حقيقياً في requests — القاعدة التي يقرؤها /my و/ops.
//
// الفجوة (تدقيق 2026-10-10، ف١): الدفع بالسلة كان يكتب صف CRM في Notion ويرسل بريداً ولا يخلق صفاً في
// جدول requests، فلا يراه العميل في /my ولا المالك في /ops، ولا تتبّع ولا مستندات ولا تسليم.
//
// هذا الاختبار يشغّل المسار الحقيقي كاملاً في عملية واحدة: api/pay.js (تحقق المبلغ من الكتالوج الحقيقي)
// ← الاستدعاء المختوم ← api/requests.js paid-order ← api/_simple.js createCartRequest. قاعدة محلية JSON،
// نوشن مُحاكى، والبريد وواتساب يُسجَّلان في صندوق ملفّي. لا شبكة.
//
// المقاس:
//  ١) الدفع يفتح طلباً مربوطاً بحساب العميل، نوعه من الكتالوج، حالته مدفوع، ومصدره وبنوده ومبالغه في payment.
//  ٢) المستندات المطلوبة تُنشأ بحالة requested من قائمة الخدمة، ويرفع العميل ويسلّم المالك ويرى العميل.
//  ٣) إعادة معالجة الدفع نفسه (ويبهوك/تحديث) لا تضاعف الطلب ولا الإبلاغ.
//  ٤) مبلغ لم يُطابَق ⇒ «قيد المراجعة» بلا وعدٍ كاذب ومهمة مراجعة، ولا تُفتح له قنوات تعديل النطاق.
//  ٥) سلة مختلطة وباقة اشتراك، ودفعُ عرضٍ قائم (sv1:) لا يفتح طلباً ثانياً.
//  ٦) إبلاغ: بريد إيصال برابط /ar/my?ref= ، وواتساب العميل والمالك مرة واحدة.
//  ٧) تعذّر فتح الطلب مع نجاح الدفع: يُنبَّه المالك، والردّ لا يحمل رقماً (فتبقى رسالة «لا تدفع مرة أخرى»).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cart-request-"));
Object.assign(process.env, {
  APP_ENV: "development", LOCAL_DB_DIR: DIR, LOCAL_DB: "1",
  OTP_SECRET: "unit-otp-secret-cart-request", NOTION_TOKEN: "notion-unit-token",
  MKT_SITE_BASE: "http://unit.local", CATALOG_URL: "http://unit.local/catalog.json",
});
for (const k of ["MOYASAR_PUBLISHABLE_KEY", "MOYASAR_SECRET_KEY", "RESEND_API_KEY", "RESEND_KEY", "RESEND", "DAFTRA_API_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const price = (code) => CATALOG.services.find((s) => s.code === code).amount;
const sar = (code, qty = 1) => Math.round(price(code) * qty * 1.15 * 100) / 100;   // شامل الضريبة

let requestsHandler;
const unexpected = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (u === "http://unit.local/catalog.json") return json(CATALOG);
  if (u.startsWith("https://api.notion.com/")) {
    if (/\/query$/.test(u)) return json({ results: [] });          // لا صف CRM سابق: يختبر أن الطلب نفسه idempotent لا نوشن
    return json({ id: "page-unit" });
  }
  if (u === "http://unit.local/api/requests") {
    return await new Promise((resolve, reject) => {
      const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
        end(s) { resolve(new Response(s, { status: this.statusCode, headers: { "content-type": "application/json" } })); } };
      Promise.resolve(requestsHandler({ method: "POST", headers: {}, query: {}, url: "/api/requests", body: init.body }, res)).catch(reject);
    });
  }
  unexpected.push(u);
  return json({ message: "blocked in unit test" }, 599);
};

const { default: payHandler } = await import("../api/pay.js");
({ default: requestsHandler } = await import("../api/requests.js"));
const { handleSimple, createCartRequest, cartRequestRef } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const outboxFile = path.join(DIR, "outbox.json");
const readOutbox = () => { try { return JSON.parse(fs.readFileSync(outboxFile, "utf8")); } catch { return []; } };
let seq = 0;

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-cart-aaaaaaaaaa" };
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });

async function call(action, body = {}, who = CLIENT) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${who.token}` }, socket: {}, query: {}, body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body } }, res);
  return out;
}
const pdf = () => Buffer.from("%PDF-1.4\nx\n%%EOF").toString("base64");

// يدفع سلةً (أو يعيد دفعةً بعينها بتمرير payId) ويعيد ما سُجّل
async function pay(items, amountSar, { email = CLIENT.email, phone = "0500000000", payId, ref } = {}) {
  const before = readOutbox().length;
  const orderRef = ref || "BP-C" + String(++seq).padStart(5, "0");
  const id = payId || "mock_card_cart" + String(seq).padStart(5, "0");
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; out.body = JSON.parse(b); } };
  await payHandler({ method: "POST", headers: {}, query: {}, url: "/api/pay",
    body: { id, amount: amountSar, order: { ref: orderRef, name: "مشتري السلة", email, phone, company: "شركة الاختبار", items } } }, res);
  const added = readOutbox().slice(0, readOutbox().length - before);
  const request = out.body && out.body.settle && out.body.settle.request;
  return { orderRef, payId: id, status: out.status, body: out.body, settle: out.body && out.body.settle, request, added,
    mails: added.filter((e) => e.kind === "email"), wa: added.filter((e) => e.kind === "whatsapp") };
}
const rowsOf = async (payId) => (await sb("requests?select=*")).filter((r) => r.payment && r.payment.pay_ref === payId);

// ----------------------------------------------------------------- ١) الطلب الحقيقي --
test("شراء خدمة تأسيس مسعّرة: يُفتح طلب COMPANY_FORMATION مدفوع ومربوط بحساب العميل", async () => {
  const r = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31"));
  assert.equal(r.settle.ok, true);
  assert.equal(r.settle.verified, true);
  assert.equal(r.request.ok, true, JSON.stringify(r.request));
  assert.equal(r.request.created, true);
  assert.match(r.request.ref, /^BP-R-[0-9A-F]{6}$/, "نفس صيغة طلبات الرئيسية");

  const rows = await rowsOf(r.payId);
  assert.equal(rows.length, 1, "صف واحد لهذه الدفعة");
  const row = rows[0];
  assert.equal(row.ref, r.request.ref);
  assert.equal(row.type, "COMPANY_FORMATION");
  assert.equal(row.status, "PAID", "يبدأ مدفوعاً — الحالة التي يقبلها محرك /my ومسار المخرجات");
  assert.equal(row.organization_id, CLIENT.org, "مربوط بحساب العميل عبر بريده");
  assert.equal(row.user_id, CLIENT.user);
  assert.equal(row.client_email, CLIENT.email);
  assert.equal(row.quote, undefined, "لا عرض سعر لشراء مباشر");
  assert.equal(row.contract, undefined);
  const p = row.payment;
  assert.equal(p.status, "PAID");
  assert.equal(p.source, "cart");
  assert.equal(p.order_ref, r.orderRef);
  assert.equal(p.pay_ref, r.payId);
  assert.equal(p.provider, "moyasar");
  assert.equal(p.verified, true);
  assert.equal(p.net, 1000);
  assert.equal(p.vat, 150);
  assert.equal(p.total, 1150);
  assert.equal(p.amount, 1150, "الإيراد في /ops يقرأ payment.amount");
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].code, "BP-SBC-31");
  assert.equal(p.items[0].qty, 1);
  assert.equal(p.items[0].amount, 1000);
  assert.equal(p.items[0].cycle, "");
  assert.equal(row.scope[0].code, "BP-SBC-31");
  assert.match(row.title, /مؤسسة فردية/);
  // الخط الزمني يقول من أين جاء الطلب
  const evs = (await sb(`request_events?request_id=eq.${row.id}&select=event`)).map((e) => e.event);
  assert.ok(evs.includes("request.created.cart") && evs.includes("payment.paid"), evs.join());
});

test("النوع من فئة البنود: خدمة حكومية، واستشارة فقط ⇒ CONSULTATION، وفيها تأسيس ⇒ COMPANY_FORMATION", async () => {
  const gov = await pay([{ id: "svc-bp-gr-01", qty: 1 }], sar("BP-GR-01"));
  assert.equal((await rowsOf(gov.payId))[0].type, "GOVERNMENT_SERVICE");

  const consult = await pay([{ id: "svc-bp-pl-0066", qty: 1 }], sar("BP-PL-0066"));
  assert.equal((await rowsOf(consult.payId))[0].type, "CONSULTATION", "استشارة ما قبل التأسيس تحت فئة التأسيس لكنها استشارة");

  const mixed = await pay([{ id: "svc-bp-gr-01", qty: 1 }, { id: "svc-bp-sbc-31", qty: 1 }], Math.round((price("BP-GR-01") + price("BP-SBC-31")) * 1.15 * 100) / 100);
  const m = (await rowsOf(mixed.payId))[0];
  assert.equal(m.type, "COMPANY_FORMATION", "سلة فيها بند تأسيس");
  assert.equal(m.payment.items.length, 2);
  assert.equal(m.payment.net, price("BP-GR-01") + price("BP-SBC-31"));
  assert.match(m.title, /و1 بند آخر/);
});

// ----------------------------------------------------------------- ٢) المستندات والتسليم --
test("المستندات المطلوبة تُنشأ requested من قائمة الخدمة؛ العميل يرفع، والمالك يسلّم، والعميل يرى", async () => {
  const r = await pay([{ id: "svc-bp-gr-01", qty: 1 }], sar("BP-GR-01"));
  const ref = r.request.ref;
  const g = await call("request-get", { ref });
  assert.equal(g.body.ok, true, "الطلب يظهر لصاحبه في /my");
  const docs = g.body.request.documents;
  assert.equal(docs.length, 3, "قائمة BP-GR-01 في site.json overrides");
  assert.ok(docs.every((d) => d.status === "requested"));
  assert.equal(docs[0].title, "السجل التجاري");
  assert.equal(r.request.documents, 3);

  // يظهر في قائمة طلباته مع وسم المصدر
  const me = await call("me");
  const mine = me.body.requests.find((x) => x.ref === ref);
  assert.ok(mine, "في قائمة /my");
  assert.equal(mine.origin, "cart");
  assert.equal(mine.payment.status, "PAID");

  // رفع مستند ⇒ received
  const up = await call("attachment-add", { ref, name: "cr.pdf", mime: "application/pdf", base64: pdf(), doc_index: 0 });
  assert.equal(up.body.ok, true, JSON.stringify(up.body));
  assert.equal(up.body.documents[0].status, "received");
  assert.equal(up.body.documents[1].status, "requested");

  // المالك يسلّم مخرجاً — مسموح لأن الطلب مدفوع
  const d = await call("ops-deliverable-add", { ref, title: "شهادة التصنيف", name: "cert.pdf", mime: "application/pdf", base64: pdf() });
  assert.equal(d.body.ok, true, JSON.stringify(d.body));
  const after = await call("request-get", { ref });
  const del = after.body.request.attachments.find((a) => a.kind === "deliverable");
  assert.ok(del, "العميل يرى المخرج");
  assert.equal(del.title, "شهادة التصنيف");
  const link = await call("attachment-link", { ref, id: del.id });
  assert.equal(link.body.ok, true);

  // المالك يراه في /ops بمصدره
  const ops = await call("ops-requests");
  const opsRow = ops.body.requests.find((x) => x.ref === ref);
  assert.equal(opsRow.origin, "cart");
  const sum = await call("ops-summary");
  assert.ok(sum.body.revenue.paid_orders >= 1);
  assert.ok(sum.body.revenue.today >= sar("BP-GR-01"), "إيراد اليوم يشمل الشراء المباشر: " + JSON.stringify(sum.body.revenue));
  assert.ok(sum.body.counts.ready_for_execution >= 1, "ينتظر «بدء التنفيذ»");
});

test("بند بلا قائمة مستندات: لا مستندات", async () => {
  const r = await pay([{ id: "svc-bp-chamber-01", qty: 1 }], sar("BP-CHAMBER-01"));
  const row = (await rowsOf(r.payId))[0];
  assert.deepEqual(row.documents, []);
  assert.equal(r.request.documents, 0);
});

test("طلب الشراء المباشر لا يقبل «اعتماد النطاق» (فلا يصير عرض سعر ثانياً على ما دُفع)", async () => {
  const r = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31"));
  const a = await call("scope-confirm", { ref: r.request.ref });
  assert.equal(a.status, 409);
  assert.equal(a.body.error, "scope_locked");
  const b = await call("scope-update", { ref: r.request.ref, scope: [{ title: "x" }] });
  assert.equal(b.status, 409);
  const row = (await rowsOf(r.payId))[0];
  assert.equal(row.status, "PAID");
  assert.equal(row.quote, undefined);
});

// ----------------------------------------------------------------- ٣) idempotent --
test("إعادة معالجة الدفع نفسه (ويبهوك/تحديث) لا تضاعف الطلب ولا الإبلاغ", async () => {
  const first = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31"));
  assert.equal(first.request.created, true);
  const waFirst = first.wa.filter((w) => /طلبك/.test(w.body) && w.to === "966500000000");
  assert.equal(waFirst.length, 1, "واتساب العميل مرة واحدة");

  const again = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31"), { payId: first.payId, ref: first.orderRef });
  assert.equal(again.request.ok, true);
  assert.equal(again.request.created, false, "الطلب قائم");
  assert.equal(again.request.ref, first.request.ref, "الرقم نفسه");
  assert.equal((await rowsOf(first.payId)).length, 1, "ما زال صفاً واحداً");
  assert.equal(again.wa.filter((w) => /طلبك|استلمنا دفعتك/.test(w.body)).length, 0, "لا إبلاغ ثانٍ للعميل");
  const tasks = await sb(`tasks?request_id=eq.${(await rowsOf(first.payId))[0].id}&select=source`);
  assert.equal(tasks.filter((t) => t.source === "sweep-start").length, 1, "مهمة واحدة للفريق");

  // سباق حقيقي: ثلاث معالجات في اللحظة نفسها
  const rId = "mock_card_race0001";
  const body = { lines: [{ id: "svc-bp-sbc-31", name: "x", qty: 1, amount: 1000 }], ref: "BP-RACE01", payId: rId, verified: true, email: CLIENT.email, name: "n", phone: "", total: 1150, net: 1000 };
  const outs = await Promise.all([createCartRequest(body), createCartRequest(body), createCartRequest(body)]);
  assert.equal(new Set(outs.map((o) => o.ref)).size, 1);
  assert.equal((await rowsOf(rId)).length, 1);
});

// ----------------------------------------------------------------- ٤) مبلغ لم يُطابَق --
test("مبلغ لم يُطابَق ⇒ «قيد المراجعة» بلا وعد، ومهمة مراجعة، وبلا تفعيل", async () => {
  const r = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31") - 300);
  assert.equal(r.settle.verified, false);
  assert.equal(r.request.ok, true);
  const row = (await rowsOf(r.payId))[0];
  assert.equal(row.status, "REVIEWING");
  assert.equal(row.payment.status, "PAID", "المال وصل فعلاً من البوابة");
  assert.equal(row.payment.verified, false);
  assert.equal(row.payment.net_estimated, true);
  assert.match(row.conversation[0].content, /لم يُطابَق آلياً/);
  assert.doesNotMatch(row.conversation[0].content, /سنبدأ التنفيذ/);
  const tasks = await sb(`tasks?request_id=eq.${row.id}&select=source,title`);
  assert.deepEqual(tasks.map((t) => t.source), ["cart-review"], "مهمة مراجعة الدفعة لا «ابدأ التنفيذ»");
  const client = r.wa.find((w) => w.to === "966500000000");
  assert.match(client.body, /لا تدفع مرة أخرى/);
  const sweep = await call("ops-sweep", { dry: true });
  if (sweep.body && sweep.body.ok) assert.ok(!(sweep.body.due || []).some((d) => d.ref === row.ref), "المتابعة لا تحوّله إلى مهمة تسعير");
});

// ----------------------------------------------------------------- ٥) الاشتراك والباقة وغيرهما --
test("اشتراك شهري: يُنشئ الطلب نفسه ببند دورته، ولا يتغيّر التفعيل", async () => {
  const r = await pay([{ id: "svc-bp-ai-03", qty: 1 }], sar("BP-AI-03"));
  assert.equal(r.settle.activated.compliance, true, "التفعيل كما كان");
  const row = (await rowsOf(r.payId))[0];
  assert.equal(row.payment.items[0].cycle, "monthly");
  assert.match(row.scope[0].why, /شهري/);
  assert.equal(row.status, "PAID");
});

test("باقة شهرية: بند الباقة بدورته (pkg-…-monthly)", async () => {
  const pkg = CATALOG.packages.find((p) => p.key === "silver");
  const r = await pay([{ id: "pkg-silver-monthly", qty: 1 }], Math.round(pkg.amount * 1.15 * 100) / 100);
  assert.equal(r.settle.ok, true);
  assert.equal(r.request.ok, true, JSON.stringify(r.request));
  const row = (await rowsOf(r.payId))[0];
  assert.equal(row.payment.items[0].cycle, "monthly");
  assert.equal(row.payment.items[0].code, "BP-PKG-LAUNCH");
  assert.equal(row.payment.verified, true);
});

test("بند سنوي خارج الكتالوج: الطلب بدورته واسم الباقة لا معرّفها، وقيد المراجعة", async () => {
  const r = await pay([{ id: "pkg-silver-yearly", qty: 1 }], 66240);
  assert.equal(r.settle.verified, false);
  const row = (await rowsOf(r.payId))[0];
  assert.equal(row.status, "REVIEWING");
  assert.equal(row.payment.items[0].cycle, "yearly");
  assert.equal(row.payment.items[0].name, "باقة الانطلاق");
  assert.equal(row.payment.items[0].amount, null, "لا مبلغ مُسعَّر لبند لا يعرفه الخادم");
});

test("دفعُ عرضٍ قائم (sv1:) لا يفتح طلباً ثانياً", async () => {
  const before = (await sb("requests?select=ref")).length;
  const out = await createCartRequest({ lines: [{ id: "sv1:BP-R-DEMO02", name: "x", qty: 1, amount: 100 }], ref: "BP-SV1", payId: "mock_card_sv1only", verified: true, email: CLIENT.email, total: 115, net: 100 });
  assert.equal(out.ok, true);
  assert.equal(out.skipped, "pays_existing_request");
  assert.equal((await sb("requests?select=ref")).length, before);
});

test("بريد بلا حساب: لا يُخترع حساب، والصف ينتظر بريده ويُرى عند أول دخول", async () => {
  const r = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31"), { email: "newbuyer@unit.test" });
  const row = (await rowsOf(r.payId))[0];
  assert.equal(row.organization_id, null);
  assert.equal(row.user_id, null);
  assert.equal(row.client_email, "newbuyer@unit.test");
  assert.equal((await sb("users?email=eq.newbuyer%40unit.test&select=id")).length, 0, "لم يُنشأ مستخدم");
  // حساب جديد بالبريد نفسه يرى الطلب من myRequests (client_email)
  const uid = crypto.randomUUID(), org = crypto.randomUUID(), token = "tok-newbuyer-cart-bbbbbbbbb";
  await sb("users", { method: "POST", prefer: "return=minimal", body: [{ id: uid, email: "newbuyer@unit.test", full_name: "مشتري جديد", locale: "ar" }] });
  await sb("organizations", { method: "POST", prefer: "return=minimal", body: [{ id: org, name_ar: "منشأة", name_en: "Org" }] });
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(token), user_id: uid, organization_id: org, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });
  const me = await call("me", {}, { token });
  assert.ok(me.body.requests.some((x) => x.ref === r.request.ref), "يراه عند أول دخول");
  const claimed = (await rowsOf(r.payId))[0];
  assert.equal(claimed.organization_id, org, "صار مربوطاً بحسابه");
});

// ----------------------------------------------------------------- ٦) الإبلاغ --
test("الإبلاغ: بريد الإيصال برابط /ar/my?ref= ، وواتساب العميل والمالك مرة واحدة، والمالك برابط اللوحة", async () => {
  const r = await pay([{ id: "svc-bp-gr-01", qty: 1 }], sar("BP-GR-01"));
  const ref = r.request.ref;
  const toBuyer = r.mails.filter((m) => m.to === CLIENT.email && /^تم الدفع وتفعيل خدمتك/.test(m.subject));
  assert.equal(toBuyer.length, 1, "إيصال واحد للعميل: " + r.mails.map((m) => m.to + " ← " + m.subject).join(" | "));
  assert.ok(toBuyer[0].body.includes(`http://unit.local/ar/my?ref=${ref}`), "رابط الطلب");
  assert.ok(!toBuyer[0].body.includes("/ar/account"), "لا رابط للبوابة القديمة");
  assert.match(toBuyer[0].body, /المستندات المطلوبة \(3\)/);
  assert.ok(toBuyer[0].body.includes(ref), "رقم الطلب في البريد");
  const owner = r.mails.filter((m) => /businesspartner/.test(m.to));
  assert.ok(owner.length >= 1);
  assert.ok(owner.every((m) => m.body.includes(`/ops?ref=${ref}`)), "رابط الطلب في اللوحة للمالك");
  const waClient = r.wa.filter((w) => w.to === "966500000000");
  assert.equal(waClient.length, 1);
  assert.ok(waClient[0].body.includes(`/ar/my?ref=${ref}`));
  assert.match(waClient[0].body, /ارفع المستندات المطلوبة \(3\)/);
  const waOwner = r.wa.filter((w) => w.to === "966530540231");
  assert.equal(waOwner.length, 1);
  assert.ok(waOwner[0].body.includes(`/ops?ref=${ref}`));
  // الجرس داخل الحساب
  const notes = await sb(`notifications?organization_id=eq.${CLIENT.org}&select=event,title`);
  assert.ok(notes.some((n) => n.event === "simple_cart-paid"), JSON.stringify(notes.map((n) => n.event)));
});

// ----------------------------------------------------------------- ٧) تعذّر فتح الطلب --
test("تعذّر فتح الطلب مع نجاح الدفع: الردّ بلا رقم طلب، والمالك يُنبَّه، والإيصال لا يعد برقم", async () => {
  // نشغل المرجع الثلاثة المشتقّة بطلبات عادية فيتعذّر الاشتقاق (تصادم) — عطلٌ حقيقي يمكن بلوغه
  const payId = "mock_card_collide01";
  for (let salt = 0; salt < 3; salt++) {
    await sb("requests", { method: "POST", prefer: "return=minimal", body: [{ ref: cartRequestRef(payId, salt), type: "CONSULTATION", source: "WEBSITE", status: "NEW", title: "طلب آخر", client_email: "x@y.z" }] });
  }
  const r = await pay([{ id: "svc-bp-sbc-31", qty: 1 }], sar("BP-SBC-31"), { payId });
  assert.equal(r.settle.ok, true, "الدفع نفسه سُجّل");
  assert.equal(r.request.ok, false);
  assert.equal(r.request.error, "ref_collision");
  assert.equal(r.request.ref, undefined, "لا رقم يُعرض للعميل");
  const alert = r.mails.find((m) => /لم يُفتح لها طلب/.test(m.subject));
  assert.ok(alert, "المالك يُنبَّه: " + r.mails.map((m) => m.subject).join(" | "));
  assert.match(alert.body, new RegExp(payId));
  const receipt = r.mails.find((m) => m.to === CLIENT.email);
  assert.ok(receipt.body.includes("http://unit.local/ar/my"), "الإيصال يرسل إلى /ar/my بلا ref");
  assert.ok(!receipt.body.includes("?ref=BP-R"), "لا رقم طلب لم يُفتح");
});

test("لا نداء شبكة خارج المحاكاة", () => {
  assert.deepEqual(unexpected, []);
});
