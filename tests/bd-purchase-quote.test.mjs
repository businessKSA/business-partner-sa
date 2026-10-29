// شراء باقة تطوير الأعمال = عرض سعر مباشر بنطاق العمل (طلب المالك 2026-10-29).
//
// يشغّل المسار الذي ينفّذه زرّ «اطلب عرض السعر» في /business-development حرفاً بحرف:
//   request-create (النوع BUSINESS_DEVELOPMENT، بند واحد بكود الباقة ووصفه نطاق العمل)
//   ← scope-confirm ← عرض سعر آلي من سعر الكتالوج بالـSKU ← quote-view.
// قاعدة محلية JSON وبريد وواتساب في صندوق ملفّي: لا شبكة ولا بيانات إنتاج.
//
// المقاس:
//  ١) باقة لها سعر في الكتالوج (REV-GROWTH) ⇒ عرض صادر فوراً، سعره من services.json لا من الصفحة،
//     والضريبة 15%، ونطاق العمل مكتوب تحت البند في العرض (وفي مستند العرض الكامل).
//  ٢) باقة بلا سعر في الكتالوج (REV-START) ⇒ لا عرض ولا سعر مخترع: تذهب إلى التسعير البشري.
//  ٣) الصفحة المبنيّة تُرسل نصّ النطاق نفسه الذي يقبله الخادم دون قصّ (≤ 400 حرفاً).
//  ٤) لا يمكن للعميل أن يفرض سعراً: السعر من الكتالوج حتى لو أُرسل رقمٌ آخر مع البند.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bd-purchase-"));
Object.assign(process.env, {
  APP_ENV: "development", LOCAL_DB_DIR: DIR, LOCAL_DB: "1",
  OTP_SECRET: "unit-otp-secret-bd-purchase", NOTION_TOKEN: "notion-unit-token", BP_OPEN_ACCESS: "0",
  MKT_SITE_BASE: "http://unit.local",
});
for (const k of ["MOYASAR_PUBLISHABLE_KEY", "MOYASAR_SECRET_KEY", "RESEND_API_KEY", "RESEND_KEY", "RESEND", "DAFTRA_API_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => new Response(JSON.stringify({ results: [], id: "page-unit" }), { status: 200, headers: { "content-type": "application/json" } });

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const SERVICES = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/services.json"), "utf8"));
const svc = (code) => SERVICES.find((s) => s.code === code);

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-bd-purchase-aaaaaa" };
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: new Date(Date.now() + 36e5).toISOString() }] });

// أزور تشترط اسماً كاملاً وجوالاً في الملف الشخصي قبل إصدار العرض (profile_required): حساب الاختبار يكمل ملفه.
await sb(`users?id=eq.${CLIENT.user}`, { method: "PATCH", prefer: "return=minimal", body: { full_name: "عميل الاختبار", phone: "+966501234500" } });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: `bp_sid=${CLIENT.token}` }, socket: {}, query: {}, body: { action, ...body } }, res);
  return out;
}

// نصّ النطاق كما تُرسله الصفحة المبنيّة (من ar/business-development.html نفسها).
const page = fs.readFileSync(path.join(ROOT, "site/ar/business-development.html"), "utf8");
const SCOPE = JSON.parse("\"" + /"scope":"([^"]+)"/.exec(page)[1] + "\"");
const DOCS = JSON.parse(/"docs":(\[[^\]]+\])/.exec(page)[1]);

async function buy(code, name, extra = {}) {
  const c = await call("request-create", {
    type: "BUSINESS_DEVELOPMENT", source: "WEBSITE", lang: "ar", title: "طلب باقة تطوير الأعمال — " + name,
    summary: "طلب عرض سعر مباشر لباقة من صفحة تطوير الأعمال كخدمة.",
    scope: [{ code, title: name, why: SCOPE, qty: 1, ...extra }], documents: DOCS,
    conversation: [{ role: "bp", content: "طلب " + name }],
  });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  return c.body.ref;
}

test("نصّ النطاق في الصفحة ≤ 400 حرف (حدّ الخادم) ومعه قائمة مستندات", () => {
  assert.ok(SCOPE.length > 100 && SCOPE.length <= 400, "طول النطاق " + SCOPE.length);
  assert.ok(Array.isArray(DOCS) && DOCS.length >= 2);
});

test("باقة لها سعر: عرض سعر آلي من الكتالوج بالـSKU وفيه ما سنعمل عليه", async () => {
  const code = "REV-GROWTH";
  const amount = svc(code).price.amount;
  assert.ok(amount > 0);
  const ref = await buy(code, "باقة النمو");
  const r = await call("scope-confirm", { ref });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stage, "QUOTE");
  assert.equal(r.body.auto, true);
  const q = r.body.quote;
  assert.equal(q.items.length, 1);
  assert.equal(q.items[0].code, code);
  assert.equal(q.net, amount, "السعر من services.json");
  assert.equal(q.vat, Math.round(amount * 0.15 * 100) / 100);
  assert.equal(q.total, Math.round(amount * 1.15 * 100) / 100);
  assert.equal(q.items[0].description, SCOPE, "نطاق العمل مكتوب في بند العرض");

  const got = await call("request-get", { ref });
  assert.equal(got.body.request.type, "BUSINESS_DEVELOPMENT");
  assert.equal(got.body.request.status, "QUOTE_SENT");
  assert.deepEqual(got.body.request.documents.map((d) => d.title), DOCS);

  const view = await call("quote-view", { ref });
  assert.equal(view.status, 200);
  // ورقة العرض بالهوية الدائمة (v3) تطبع لباقات REV صفحات الباقة ونموذج الإيراد من الكتالوج (الورقة المعتمدة
  // من فريق المبيعات) بدل سطر النطاق الحرّ؛ ونصّ النطاق يبقى في بند العرض المحفوظ (q.items[0].description أعلاه).
  assert.ok(view.body.html.includes("Revenue model"), "ورقة العرض v3 تحمل صفحات باقة تطوير الأعمال");
});

test("باقة بلا سعر في الكتالوج: لا عرض ولا سعر مخترع — تسعير بشري", async () => {
  const code = "REV-START";
  assert.equal(svc(code).price.amount, null);
  const ref = await buy(code, "باقة البداية");
  const r = await call("scope-confirm", { ref });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stage, "PRICING");
  assert.ok(r.body.unpriced.length === 1);
  assert.equal(r.body.quote, undefined);
  const got = await call("request-get", { ref });
  assert.equal(got.body.request.status, "REVIEWING");
  assert.equal(got.body.request.quote || null, null);
});

test("العميل لا يفرض سعراً: رقمٌ مرسل مع البند لا يغيّر سعر الكتالوج", async () => {
  const code = "REV-LAUNCH";
  const amount = svc(code).price.amount;
  const ref = await buy(code, "باقة الانطلاق", { price: 1 });
  const r = await call("scope-confirm", { ref });
  assert.equal(r.body.stage, "QUOTE");
  assert.equal(r.body.quote.net, amount);
});

// ---- بقية الحلقات: العقد ← التوقيع ← الدفع ← الفاتورة ← تفعيل مساحة العمل -----------

const { default: requestsHandler } = await import("../api/requests.js");
async function myOrders() {
  const out = { body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await requestsHandler({ method: "GET", headers: { cookie: `bp_sid=${CLIENT.token}` }, socket: {}, query: { action: "my-orders" }, url: "/api/requests?action=my-orders" }, res);
  return out.body;
}

test("السلسلة كاملة: عرض ← اعتماد ← عقد ← توقيع ← دفع ← فاتورة، ومساحة العمل تعرف أن العميل مشترك", async () => {
  const before = await myOrders();
  assert.ok(before && before.ok, JSON.stringify(before));
  assert.notEqual(before.bd.state, "subscribed", "قبل الدفع لا اشتراك");

  const ref = await buy("REV-PRO", "الباقة الاحترافية");
  assert.equal((await call("scope-confirm", { ref })).body.stage, "QUOTE");
  const ap = await call("quote-approve", { ref });
  assert.equal(ap.body.status, "CONTRACT_SENT");

  const sg = await call("contract-sign", { ref, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "عميل تجريبي" });
  assert.equal(sg.body.status, "SIGNED");
  const pay = await call("pay-test", { ref, outcome: "success" });
  assert.equal(pay.body.status, "PAID");
  assert.ok(pay.body.invoice && /INV-/.test(pay.body.invoice.number), "فاتورة بعد الدفع");
  assert.equal(pay.body.invoice.net, svc("REV-PRO").price.amount);

  const after = await myOrders();
  assert.equal(after.bd.state, "subscribed", "الدفع بمسار عرض السعر يفعّل اشتراك مساحة العمل");
});

test("فجوة معلومة (تُقلب حين تُسدّ): عقد الطلب لا يحمل الاشتراك الشهري ولا عمولة النجاح ولا نطاق العمل", async () => {
  const ref = await buy("REV-GROWTH", "باقة النمو");
  await call("scope-confirm", { ref });
  await call("quote-approve", { ref });
  const cv = await call("contract-view", { ref });
  const txt = String(cv.body.html || "").replace(/<[^>]+>/g, " ");
  assert.ok(/باقة النمو/.test(txt), "البند في العقد");
  assert.ok(!/يتجدد الاشتراك/.test(txt) && !/عمولة النجاح/.test(txt) && !/نطاق العمل الشهري/.test(txt),
    "إن فشل هذا السطر فقد سُدّت الفجوة: حدّث الاختبار والتقرير");
});
