// ربط الدفعة بعرضها — ثغرتا الدفع على كود الإنتاج (api/pay.js · api/_simple.js · api/_bnpl.js · api/_mode.js).
//
// ما كان يحدث:
//  • سماح الريالين (200 هللة) كان يُطبَّق على عروض الأسعار الموقّعة (sv1:) أيضاً، فدفعةٌ ناقصة ريالاً ونصف
//    (أو مال عرضٍ واحد موزَّع على عرضين) كانت تُسوّي العرض كاملاً.
//  • الطلب (order.items) يأتي من المتصفح، فدفعة العرض (أ) تُقدَّم مع طلب يسمّي العرض (ب) بالسعر نفسه فتُسوّي (ب).
//  • دفعة ثانية على طلب مدفوع أصلاً كانت تُبتلع بصمت، وطلبٌ مدفوع كان لا يُسعَّر أثناء التسوية.
//  • فشل تقييد الطلب بعد وصول المال كان يُرجع settle.ok=true.
//  • مفتاح مُيسّر مباشر (live) على معاينة فيرسل كان يعمل.
//
// المسار هنا حقيقي كاملاً في عملية واحدة: api/pay.js ← الاستدعاء المختوم ← api/requests.js (paid-order)
// ← api/_simple.js (markRequestPaidByRef) على قاعدة JSON مؤقتة (LOCAL_DB=1). والخوادم الخارجية وهمية داخل
// العملية: مُيسّر (GET /v1/payments/:id) وتمارا (orders/authorise/capture) والبريد (Resend) ونوشن.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pay-quote-binding-"));
const WEBHOOK = "unit-webhook-secret-binding";
Object.assign(process.env, {
  APP_ENV: "production", VERCEL_ENV: "production", LOCAL_DB: "1", LOCAL_DB_DIR: DIR,
  OTP_SECRET: "unit-otp-secret-binding", NOTION_TOKEN: "notion-unit-token",
  MKT_SITE_BASE: "http://unit.local", CATALOG_URL: "http://unit.local/catalog.json",
  MOYASAR_PUBLISHABLE_KEY: "pk_test_unit00000000000000000000000000000000",
  MOYASAR_SECRET_KEY: "sk_test_unit00000000000000000000000000000000",
  MOYASAR_WEBHOOK_SECRET: WEBHOOK,
  TAMARA_API_TOKEN: "tamara-unit-token", TAMARA_API_BASE: "http://tamara.unit",
  RESEND_API_KEY: "re_unit", BP_OWNER_EMAIL: "owner@unit.test",
});
for (const k of ["DAFTRA_API_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_TOKEN", "PAYMENTS_MODE", "TAMARA_OFF", "SIMPLE_TEST_MODE"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));

// ------------------------------------------------------- الخوادم الوهمية --
const gw = {
  moyasar: new Map(),      // payment id → السجل عند مُيسّر
  tamara: new Map(),       // order id → الطلب عند تمارا
  mails: [],               // كل رسالة خرجت عبر Resend
  unexpected: [],
  beforePaidOrder: null,   // خطّاف يحاكي سباقاً بين التسعير والتقييد
};
let requestsHandler;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (u === "http://unit.local/catalog.json") return json(CATALOG);
  if (u.startsWith("https://api.notion.com/")) return /\/query$/.test(u) ? json({ results: [] }) : json({ id: "page-unit" });
  if (u === "http://unit.local/api/requests") {
    if (gw.beforePaidOrder) await gw.beforePaidOrder();
    return await new Promise((resolve, reject) => {
      const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
        end(s) { resolve(new Response(s, { status: this.statusCode, headers: { "content-type": "application/json" } })); } };
      Promise.resolve(requestsHandler({ method: "POST", headers: {}, query: {}, url: "/api/requests", body: init.body }, res)).catch(reject);
    });
  }
  let m = u.match(/^https:\/\/api\.moyasar\.com\/v1\/payments\/([^/?]+)$/);
  if (m) { const p = gw.moyasar.get(m[1]); return p ? json(p) : json({ message: "not found" }, 404); }
  if (u === "https://api.resend.com/emails") {
    const b = JSON.parse(init.body);
    gw.mails.push({ to: [].concat(b.to).join(","), subject: b.subject, html: b.html });
    return json({ id: "mail-unit" });
  }
  m = u.match(/^http:\/\/tamara\.unit\/orders\/([^/]+)(\/authorise)?$/);
  if (m) {
    const o = gw.tamara.get(m[1]);
    if (!o) return json({ message: "not found" }, 404);
    if (m[2]) { o.status = "authorised"; return json({ ok: true }); }
    return json(o);
  }
  if (u === "http://tamara.unit/payments/capture") {
    const b = JSON.parse(init.body); const o = gw.tamara.get(b.order_id);
    if (o) o.status = "fully_captured";
    return json({ capture_id: "cap-unit" });
  }
  if (u === "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify") return json({ ok: true });   // إشعار العميل المحتمل — خارج هذا الاختبار
  gw.unexpected.push(u);
  return json({ message: "blocked in unit test" }, 599);
};

const { default: payHandler } = await import("../api/pay.js");
({ default: requestsHandler } = await import("../api/requests.js"));
const { sb } = await import("../api/_db.js");

// مفتاح «مباشر» وهمي يُركَّب وقت التشغيل: حرفه الكامل في الملف يوقظ ماسح الأسرار.
const fakeLive = (kind) => [kind, "live", "unit" + "0".repeat(30)].join("_");

// ------------------------------------------------------------- أدوات --
let seq = 0;
const nextRef = () => "BP-R-" + (0xA00000 + (++seq)).toString(16).toUpperCase();       // BP-R-A00001
const sar = (halalas) => halalas / 100;
async function mkQuote(net, status = "SIGNED") {
  const ref = nextRef();
  const vat = Math.round(net * 0.15 * 100) / 100;
  await sb("requests", { method: "POST", prefer: "return=minimal", body: [{
    ref, type: "CONSULTATION", source: "WEBSITE", status, lang: "ar", title: "عرض اختبار " + ref,
    client_name: "عميل العرض", client_email: "buyer@unit.test", client_phone: "", company_name: "شركة الاختبار",
    quote: { number: "Q-" + ref.slice(5), status: "APPROVED", net, vat, total: Math.round((net + vat) * 100) / 100, items: [], vat_rate: 15, currency: "SAR" },
  }] });
  return ref;
}
const row = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const sv1 = (ref) => ({ id: "sv1:" + ref, qty: 1 });
const metaItems = (...refs) => refs.map((r) => (/^svc-/.test(r) ? r : "sv1:" + r) + "~1").join(",");

// يسجّل الدفعة عند «مُيسّر» كما ستظهر لخادمنا حين يسأل عنها
let pseq = 0;
function moyasarPays(halalas, items, extra = {}) {
  const id = "pay_unit_" + String(++pseq).padStart(4, "0");
  gw.moyasar.set(id, {
    id, status: "paid", amount: halalas, currency: "SAR", description: "unit",
    source: { type: "creditcard", company: "mada" },
    metadata: { ref: "BP-" + id.slice(-4), email: "buyer@unit.test", name: "عميل", phone: "0500000000", co: "", items, disc: "", tax: "personal" },
    ...extra,
  });
  return id;
}
async function call(method, { body, query } = {}) {
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await payHandler({ method, headers: {}, query: query || {}, body: body || {}, url: "/api/pay" }, res);
  return out;
}
// رجوع المتصفح: يطلب التحقق من الدفعة ومعه الطلب الذي يدّعيه
const browserReturn = (payId, items, orderRef) =>
  call("POST", { body: { id: payId, order: { ref: orderRef || "BP-" + payId.slice(-4), name: "عميل", email: "buyer@unit.test", phone: "0500000000", company: "", items } } });
// خطّاف مُيسّر
const webhook = (payId) => call("POST", { body: { type: "payment_paid", secret_token: WEBHOOK, data: { id: payId } } });
const mailsWith = (needle) => gw.mails.filter((m) => m.subject.includes(needle));

// ------------------------------------------------------------ ١) السماح --
test("١) عرض موقّع ناقص ريالاً ونصف لا يُصادَق عليه ولا يُقيَّد مدفوعاً", async () => {
  const A = await mkQuote(300);                                    // 300 + 45 = 345.00
  const id = moyasarPays(34350, metaItems(A));                     // 343.50 — ناقص 1.50
  const r = await browserReturn(id, [sv1(A)]);
  assert.equal(r.body.settle.verified, false, "الناقص ريالاً ونصف ليس مدفوعاً بالكامل");
  assert.equal((await row(A)).status, "SIGNED", "العرض لم يتحوّل إلى مدفوع");
});

test("١ب) ضبط: العرض بمبلغه بالهللة يُصادَق عليه، وهللتان سماح، وثلاث لا", async () => {
  const exact = await mkQuote(300), two = await mkQuote(300), three = await mkQuote(300);
  const r1 = await browserReturn(moyasarPays(34500, metaItems(exact)), [sv1(exact)]);
  assert.equal(r1.body.settle.verified, true);
  assert.equal(r1.body.settle.ok, true);
  assert.equal((await row(exact)).status, "PAID");
  const r2 = await browserReturn(moyasarPays(34498, metaItems(two)), [sv1(two)]);
  assert.equal(r2.body.settle.verified, true, "هللتان ضمن السماح");
  assert.equal((await row(two)).status, "PAID");
  const r3 = await browserReturn(moyasarPays(34497, metaItems(three)), [sv1(three)]);
  assert.equal(r3.body.settle.verified, false, "ثلاث هللات خارج السماح");
  assert.equal((await row(three)).status, "SIGNED");
});

test("١ج) ضبط: سلة الكتالوج تبقى بسماح ريالين", async () => {
  const net = CATALOG.services.find((s) => s.code === "BP-SBC-31").amount;
  const total = Math.round(net * 1.15 * 100);
  const near = await browserReturn(moyasarPays(total - 150, "svc-bp-sbc-31~1"), [{ id: "svc-bp-sbc-31", qty: 1 }]);
  assert.equal(near.body.settle.verified, true, "ناقص ريالاً ونصفاً في الكتالوج ضمن الريالين");
  const far = await browserReturn(moyasarPays(total - 250, "svc-bp-sbc-31~1"), [{ id: "svc-bp-sbc-31", qty: 1 }]);
  assert.equal(far.body.settle.verified, false, "وما فوق الريالين مرفوض");
});

// ------------------------------------------------- ٢) ربط الدفعة بعرضها --
test("٢) دفعة العرض (أ) لا تُسوّي العرض (ب) ولو تساوى السعر", async () => {
  const A = await mkQuote(300), B = await mkQuote(300);
  const idA = moyasarPays(34500, metaItems(A));                    // دُفعت عن (أ)
  const before = mailsWith("لا تطابق العرض").length;
  const r = await browserReturn(idA, [sv1(B)]);                    // والمتصفح يدّعي (ب)
  assert.equal(r.body.settle.verified, false);
  assert.equal((await row(B)).status, "SIGNED", "(ب) لم يُسوَّ بمال (أ)");
  assert.equal((await row(A)).status, "SIGNED", "(أ) لم يُمسّ أيضاً");
  assert.equal(mailsWith("لا تطابق العرض").length, before + 1, "المالك أُبلغ مرة واحدة");
  assert.ok(gw.mails.some((m) => m.to === "owner@unit.test" && m.html.includes("payment_quote_mismatch") && m.html.includes(idA)), "الرسالة تسمّي الدفعة");
  // الدفعة نفسها بطلبها الصحيح تُسوّي (أ)
  const ok = await browserReturn(idA, [sv1(A)]);
  assert.equal(ok.body.settle.verified, true);
  assert.equal((await row(A)).status, "PAID");
  assert.equal((await row(B)).status, "SIGNED");
});

test("٢ب) دفعة بلا قائمة عروض في بياناتها لا تُسوّي عرضاً", async () => {
  const A = await mkQuote(300);
  const r = await browserReturn(moyasarPays(34500, ""), [sv1(A)]);
  assert.equal(r.body.settle.verified, false);
  assert.equal((await row(A)).status, "SIGNED");
});

test("٢ج) دفعة تسمّي عرضين بمبلغ واحد لا تُسوّي أيّاً منهما", async () => {
  const big = await mkQuote(300), tiny = await mkQuote(1);          // مجموعهما 301 ⇒ 346.15، والمدفوع 345.00
  const id = moyasarPays(34500, metaItems(big, tiny));
  const r = await browserReturn(id, [sv1(big), sv1(tiny)]);
  assert.equal(r.body.settle.verified, false);
  assert.equal((await row(big)).status, "SIGNED");
  assert.equal((await row(tiny)).status, "SIGNED", "العرض الصغير لم يُسدَّد بمال الكبير");
});

test("٢د) ضبط: عرضان بمبلغهما معاً يُسوَّيان معاً", async () => {
  const a = await mkQuote(300), b = await mkQuote(100);             // 345 + 115 = 460
  const r = await browserReturn(moyasarPays(46000, metaItems(a, b)), [sv1(a), sv1(b)]);
  assert.equal(r.body.settle.verified, true);
  assert.equal(r.body.settle.ok, true);
  assert.equal((await row(a)).status, "PAID");
  assert.equal((await row(b)).status, "PAID");
});

// ------------------------------------------------------------ تمارا --
function tamaraOrder(id, totalSar, quoteRefs) {
  gw.tamara.set(id, {
    order_id: id, status: "approved", total_amount: { amount: totalSar.toFixed(2), currency: "SAR" },
    shipping_amount: { amount: "0.00" }, tax_amount: { amount: "0.00" }, discount_amount: { amount: "0.00" },
    items: quoteRefs.map((r) => ({ reference_id: "sv1:" + r, sku: "sv1:" + r, quantity: 1 })),
  });
}
const tamaraVerify = (orderId, items) =>
  call("POST", { body: { action: "bnpl-verify", provider: "tamara", id: orderId, order: { ref: "BP-TMR-" + orderId.slice(-4), name: "عميل", email: "buyer@unit.test", phone: "0500000000", items } } });

test("٣) تمارا: طلب مدفوع عن (أ) يدّعيه المتصفح لـ(ب) ⇒ 409 order_mismatch وبريد للمالك", async () => {
  const A = await mkQuote(300), B = await mkQuote(300);
  tamaraOrder("TMR-ORDER-AAAA0001", 345, [A]);
  const r = await tamaraVerify("TMR-ORDER-AAAA0001", [sv1(B)]);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, "order_mismatch");
  assert.equal((await row(B)).status, "SIGNED", "(ب) لم يُسوَّ");
  assert.equal((await row(A)).status, "SIGNED", "ولا (أ): لا يُسوّى إلا بطلب يطابقه");
  assert.ok(gw.mails.some((m) => m.to === "owner@unit.test" && m.html.includes("TMR-ORDER-AAAA0001") && m.html.includes("payment_quote_mismatch")), "المالك أُبلغ");
});

test("٣ب) ضبط تمارا: الطلب المطابق يُسوّي (أ) مرة واحدة", async () => {
  const A = await mkQuote(300);
  tamaraOrder("TMR-ORDER-BBBB0002", 345, [A]);
  const r = await tamaraVerify("TMR-ORDER-BBBB0002", [sv1(A)]);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.settle.verified, true);
  assert.equal(r.body.settle.ok, true);
  const rw = await row(A);
  assert.equal(rw.status, "PAID");
  assert.equal(rw.payment.provider, "tamara");
  // إعادة التحقق من الطلب نفسه ليست دفعة مكرّرة
  const again = await tamaraVerify("TMR-ORDER-BBBB0002", [sv1(A)]);
  assert.equal(again.status, 200);
  assert.equal(((await row(A)).payment.duplicates || []).length, 0);
});

// -------------------------------------------------------- ٤) المكرّرة --
test("٤) دفعة مكرّرة على طلب مدفوع لا تُبتلع: تُسجَّل وتُفتح لها مهمة ويصل المالك بريد", async () => {
  const C = await mkQuote(300);
  const p1 = moyasarPays(34500, metaItems(C)), p2 = moyasarPays(34500, metaItems(C));
  await browserReturn(p1, [sv1(C)]);
  assert.equal((await row(C)).status, "PAID");
  const mailsBefore = mailsWith("دفعة مكرّرة").length;

  const r = await browserReturn(p2, [sv1(C)]);                      // الدفعة الثانية على الطلب نفسه
  assert.equal(r.body.settle.ok, true);
  assert.equal(r.body.settle.verified, true, "الطلب المدفوع يُسعَّر أثناء التسوية");
  const rw = await row(C);
  assert.equal(rw.status, "PAID");
  assert.equal(rw.payment.ref, p1, "الدفعة الأولى تبقى مرجع الطلب");
  assert.equal((rw.payment.duplicates || []).length, 1, "المكرّرة مسجّلة (1 لا 0)");
  assert.equal(rw.payment.duplicates[0].payId, p2);
  assert.equal(rw.payment.duplicates[0].amount, 345);
  const tasks = await sb(`tasks?request_id=eq.${rw.id}&source=eq.${encodeURIComponent("payment.duplicate")}&select=id,human_action,status`);
  assert.equal(tasks.length, 1, "مهمة payment.duplicate واحدة");
  assert.equal(tasks[0].human_action, true);
  const evs = (await sb(`request_events?request_id=eq.${rw.id}&select=event`)).map((e) => e.event);
  assert.ok(evs.includes("payment.duplicate"));
  assert.ok(mailsWith("دفعة مكرّرة").some((m) => m.to.includes("owner@unit.test")), "بريد للمالك");
  assert.equal(mailsWith("دفعة مكرّرة").length, mailsBefore + 1);

  // نداء الدفعة الثانية مرة أخرى (إعادة محاولة المتصفح أو الخطّاف) لا يضاعف شيئاً
  await browserReturn(p2, [sv1(C)]);
  await webhook(p2);
  const again = await row(C);
  assert.equal(again.payment.duplicates.length, 1);
  assert.equal((await sb(`tasks?request_id=eq.${rw.id}&source=eq.${encodeURIComponent("payment.duplicate")}&select=id`)).length, 1);
  assert.equal(mailsWith("دفعة مكرّرة").length, mailsBefore + 1, "بريد واحد لكل دفعة مكرّرة");
});

test("٤ب) ضبط: بطاقة + خطّاف + رجوع للدفعة نفسها = طلب مدفوع واحد بلا تكرار", async () => {
  const D = await mkQuote(300);
  const id = moyasarPays(34500, metaItems(D));
  const w1 = await webhook(id);                                    // الخطّاف أولاً
  assert.equal(w1.body.handled, true);
  assert.equal(w1.body.settled, true);
  assert.equal((await row(D)).status, "PAID");
  const back = await browserReturn(id, [sv1(D)]);                  // ثم رجوع المتصفح
  assert.equal(back.body.settle.ok, true);
  assert.equal(back.body.settle.verified, true);
  const w2 = await webhook(id);                                    // وإعادة محاولة الخطّاف
  assert.equal(w2.body.settled, true);
  const rows = await sb(`requests?ref=eq.${D}&select=id,status,payment`);
  assert.equal(rows.length, 1, "صف واحد");
  assert.equal(rows[0].status, "PAID");
  assert.equal(rows[0].payment.ref, id);
  assert.equal((rows[0].payment.duplicates || []).length, 0, "لا تُعدّ القناتان دفعتين");
  assert.equal((await sb(`tasks?request_id=eq.${rows[0].id}&source=eq.${encodeURIComponent("payment.duplicate")}&select=id`)).length, 0);
});

test("٤ج) الطلب الملغى لا يُسعَّر ولا يُدفَع أبداً", async () => {
  const X = await mkQuote(300, "CANCELLED");
  const id = moyasarPays(34500, metaItems(X));
  const r = await browserReturn(id, [sv1(X)]);
  assert.equal(r.body.settle.verified, false);
  assert.equal((await row(X)).status, "CANCELLED");
});

// ------------------------------------------------ ٥) فشل التقييد بعد المال --
test("٥) فشل تقييد الطلب بعد وصول المال: settle.ok=false · quote_settle_failed · تنبيه واحد لكل دفعة", async () => {
  const E = await mkQuote(300);
  const id = moyasarPays(34500, metaItems(E));
  // الطلب يُلغى بين التسعير والتقييد (سباق) ⇒ لا يُقيَّد مدفوعاً
  gw.beforePaidOrder = async () => { await sb(`requests?ref=eq.${E}`, { method: "PATCH", prefer: "return=minimal", body: { status: "CANCELLED" } }); };
  try {
    const before = mailsWith("لم تُقيَّد").length;
    const r = await browserReturn(id, [sv1(E)]);
    assert.equal(r.status, 200);
    assert.equal(r.body.settle.ok, false, "لا يُقال إن الطلب سُوّي");
    assert.equal(r.body.settle.error, "quote_settle_failed");
    assert.equal(r.body.settle.verified, true);
    assert.equal((await row(E)).status, "CANCELLED", "لم يُقيَّد مدفوعاً");
    const alerts = mailsWith("لم تُقيَّد").slice(before);
    assert.equal(alerts.length, 1, "تنبيه الإدارة");
    assert.ok(alerts[0].to.includes("owner@unit.test"));
    assert.ok(alerts[0].html.includes(E) && alerts[0].html.includes(id), "مرجع العرض ورقم الدفعة في الرسالة");
    assert.equal(mailsWith("ولم يكتمل تسجيلها").filter((m) => m.html.includes(id)).length, 0, "لا رسالة عامة ثانية لنفس الدفعة");
    // الدفعة نفسها مرة ثانية (إعادة محاولة) ⇒ الفشل نفسه ولا تنبيه ثانٍ لنفس الدفعة والسبب
    await sb(`requests?ref=eq.${E}`, { method: "PATCH", prefer: "return=minimal", body: { status: "SIGNED" } });
    const again = await browserReturn(id, [sv1(E)]);
    assert.equal(again.body.settle.ok, false);
    assert.equal(mailsWith("لم تُقيَّد").slice(before).length, 1, "مرة واحدة لكل دفعة وسبب");
  } finally { gw.beforePaidOrder = null; }
});

test("٥ب) الطلب يغيب كلياً بعد المال ⇒ settle.ok=false أيضاً (لا يمرّ كنجاح)", async () => {
  const F = await mkQuote(300);
  const id = moyasarPays(34500, metaItems(F));
  gw.beforePaidOrder = async () => { await sb(`requests?ref=eq.${F}`, { method: "DELETE", prefer: "return=minimal" }); };
  try {
    const r = await browserReturn(id, [sv1(F)]);
    assert.equal(r.body.settle.ok, false);
    assert.equal(r.body.settle.error, "quote_settle_failed");
  } finally { gw.beforePaidOrder = null; }
});

// ---------------------------------------------------- ٦) حارس المعاينة --
test("٦) مفتاح مُيسّر live على معاينة فيرسل ⇒ 503 live_keys_in_preview إلا بـPAYMENTS_MODE=live", async () => {
  const keep = { v: process.env.VERCEL_ENV, pk: process.env.MOYASAR_PUBLISHABLE_KEY, sk: process.env.MOYASAR_SECRET_KEY };
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.MOYASAR_PUBLISHABLE_KEY = fakeLive("pk");
    const get = await call("GET");
    assert.equal(get.status, 503);
    assert.equal(get.body.error, "live_keys_in_preview");
    assert.equal(get.body.enabled, false);
    assert.equal(get.body.publishableKey, undefined, "المفتاح لا يخرج");
    const post = await call("POST", { body: { id: "pay_unit_preview01", order: { ref: "BP-PV", items: [] } } });
    assert.equal(post.status, 503);
    assert.equal(post.body.error, "live_keys_in_preview");
    // مفتاح السرّ وحده يكفي ليُمنع
    process.env.MOYASAR_PUBLISHABLE_KEY = keep.pk;
    process.env.MOYASAR_SECRET_KEY = fakeLive("sk");
    assert.equal((await call("GET")).status, 503);
    // عمداً: PAYMENTS_MODE=live
    process.env.PAYMENTS_MODE = "live";
    assert.equal((await call("GET")).status, 200, "الإذن الصريح يفتحه");
    delete process.env.PAYMENTS_MODE;
    // مفاتيح الاختبار على المعاينة تعمل
    process.env.MOYASAR_SECRET_KEY = keep.sk;
    assert.equal((await call("GET")).status, 200);
  } finally {
    delete process.env.PAYMENTS_MODE;
    process.env.VERCEL_ENV = keep.v; process.env.MOYASAR_PUBLISHABLE_KEY = keep.pk; process.env.MOYASAR_SECRET_KEY = keep.sk;
  }
});

test("٦ب) ضبط: الإنتاج بلا تغيير — مفتاح live على production لا يُمنع", async () => {
  const keep = { pk: process.env.MOYASAR_PUBLISHABLE_KEY };
  try {
    process.env.VERCEL_ENV = "production";
    process.env.MOYASAR_PUBLISHABLE_KEY = fakeLive("pk");
    const get = await call("GET");
    assert.equal(get.status, 200);
    assert.equal(get.body.enabled, true);
  } finally { process.env.MOYASAR_PUBLISHABLE_KEY = keep.pk; }
});

test("لا نداء شبكة خارج الخوادم الوهمية", () => {
  assert.deepEqual(gw.unexpected, []);
});
