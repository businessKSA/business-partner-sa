// الألماس الأزرق — اختبار المسار كاملاً على القاعدة المحلية.
//
// يُشغَّل بـ LOCAL_DB=1 على مجلد مؤقت، فلا يلمس Supabase ولا يرسل واتساب
// (api/_mode.js يحوّل كل خروج إلى صندوق صادر محلي). ما يُختبر هنا ليس
// الاستخراج — ذاك في rematch.test.mjs — بل الحلقة: رسالة تدخل، فصفٌّ
// يُكتب، فمطابقة تقع، ورسالة مكرّرة لا تُعالَج مرتين.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bd-re-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = TMP;
process.env.APP_ENV = "development";   // واتساب محاكى، لا رسالة تغادر
process.env.BD_OPS_KEY = "test-bd";
process.env.BD_OWNER_WA = "966500000001";
delete process.env.ANTHROPIC_API_KEY;   // القواعد وحدها — هذا هو المسار الذي يجب أن يصمد

let RE;
before(async () => { RE = await import("../api/_realestate.js"); });

// مناوِل رد بسيط يلتقط ما كُتب، حتى يُختبر handleRealEstate كما يُنادى فعلاً.
function fakeRes() {
  return {
    statusCode: 200, body: "", headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(chunk = "") { this.body += chunk; return this; },
    get json() { try { return JSON.parse(this.body); } catch { return null; } },
  };
}
const call = async (method, query, body) => {
  const res = fakeRes();
  await RE.handleRealEstate({ method, query: query || {}, body: body || {}, headers: {} }, res);
  return res;
};

test("طلب يصل واتساب: يُسجَّل، ويُسأل عن أول ناقص، ولا يُفقد", async () => {
  const out = await RE.handleInbound({
    from: "0551112233", name: "عبدالله",
    text: "السلام عليكم، أدور أرض خام شمال الرياض",
    messageId: "wamid.req1",
  });
  assert.equal(out.intent, "REQUEST");
  assert.match(out.ref, /^BD-T-\d{6}$/);
  assert.equal(out.replied, true);
  // ناقصه الميزانية والمساحة — لكنه محفوظ رغم النقص.
  const res = await call("GET", { action: "list", of: "requests", key: "test-bd" });
  const rows = res.json.rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].city, "الرياض");
  assert.equal(rows[0].property_type, "LAND");
  assert.ok(rows[0].completeness > 0 && rows[0].completeness < 100);
});

test("الرسالة نفسها مرتين تُعالَج مرة واحدة", async () => {
  const again = await RE.handleInbound({
    from: "0551112233", text: "السلام عليكم، أدور أرض خام شمال الرياض", messageId: "wamid.req1",
  });
  assert.equal(again.duplicate, true);
  const res = await call("GET", { action: "list", of: "requests", key: "test-bd" });
  assert.equal(res.json.rows.length, 1, "لا صفّ ثانٍ من إعادة إرسال ميتا");
});

test("طلب مكتمل يُطابَق فوراً على المخزون", async () => {
  // عرضٌ سبق أن وصل من مسوّق
  const offer = await RE.handleInbound({
    from: "0555556666", name: "مكتب النخبة",
    text: "للبيع أرض خام شمال الرياض حي النرجس المساحة 5200 متر السعر 7.8 مليون صك إلكتروني",
    messageId: "wamid.off1",
  });
  assert.equal(offer.intent, "LISTING");
  assert.match(offer.ref, /^BD-A-\d{6}$/);

  // ثم طلب مكتمل من عميل
  const req = await RE.handleInbound({
    from: "0557778888", name: "سعد",
    text: "عميلي يبحث عن أرض خام شمال الرياض من 5000 إلى 6000 متر بحدود 8 مليون، غير مدرة للدخل",
    messageId: "wamid.req2",
  });
  assert.equal(req.intent, "REQUEST");
  assert.ok(req.matches >= 1, `يجب أن يطابق العرض السابق، جاء ${req.matches}`);
});

test("عرضٌ يصل الآن يجد الطلب الذي كان ينتظره", async () => {
  const out = await RE.handleInbound({
    from: "0554443333", name: "مطور",
    text: "للبيع أرض خام شمال الرياض 5500 متر السعر 7.5 مليون",
    messageId: "wamid.off2",
  });
  assert.equal(out.intent, "LISTING");
  assert.ok(out.matches >= 1, "المطابقة العكسية هي الفائدة كلها — عرضٌ يجد طلباً قديماً");
});

test("العرض الوارد من واتساب لا يُقدَّم كموثّق", async () => {
  const res = await call("GET", { action: "list", of: "listings", key: "test-bd" });
  const rows = res.json.rows;
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.status === "UNVERIFIED"), "التوثيق خطوة بشرية لا استنتاج");
});

test("المسوّق يُسجَّل بدوره، والعميل بدوره", async () => {
  const res = await call("GET", { action: "list", of: "contacts", key: "test-bd" });
  const byPhone = Object.fromEntries(res.json.rows.map((c) => [c.wa_phone, c]));
  assert.ok(byPhone["966555556666"].roles.includes("MARKETER"));
  assert.ok(byPhone["966557778888"].roles.includes("CLIENT"));
  assert.equal(byPhone["966555556666"].offers_count, 1);
});

test("طلب السوق يخرج للمسوّقين ويُسجَّل نصّه", async () => {
  const list = await call("GET", { action: "list", of: "requests", key: "test-bd" });
  const complete = list.json.rows.find((r) => r.completeness === 100);
  assert.ok(complete, "لا بد من طلب مكتمل");
  const res = await call("POST", {}, { action: "broadcast", key: "test-bd", ref: complete.ref });
  assert.equal(res.json.ok, true);
  assert.ok(res.json.audience >= 1, "المسوّقون في القاعدة هم الجمهور");
  assert.match(res.json.message, /مطلوب لعميل/);
  assert.match(res.json.message, /الألماس الأزرق/);
});

test("اللوحة تُرجع الأرقام، والمفتاح شرطٌ لها", async () => {
  const denied = await call("GET", { action: "dashboard" });
  assert.equal(denied.statusCode, 401);
  const ok = await call("GET", { action: "dashboard", key: "test-bd" });
  assert.equal(ok.json.db, true);
  assert.ok(ok.json.counts.openRequests >= 1);
  assert.ok(ok.json.counts.activeListings >= 2);
  assert.ok(ok.json.counts.contacts >= 3);
});

test("قارئ النص مفتوح ولا يكتب شيئاً", async () => {
  const res = await call("POST", {}, { action: "parse", text: "للبيع عمارة سكنية بجدة مؤجرة السعر 12 مليون" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.intent, "LISTING");
  assert.equal(res.json.listing.city, "جدة");
  assert.equal(res.json.listing.price, 12_000_000);
});

test("التعديل من اللوحة يمرّ بقائمة بيضاء", async () => {
  const list = await call("GET", { action: "list", of: "listings", key: "test-bd" });
  const row = list.json.rows[0];
  const bad = await call("POST", {}, { action: "update", key: "test-bd", of: "listing", id: row.id, patch: { ref: "BD-A-999999" } });
  assert.equal(bad.statusCode, 400, "الحقل غير المسموح يُرفض لا يُمرَّر");
  const good = await call("POST", {}, { action: "update", key: "test-bd", of: "listing", id: row.id, patch: { status: "ACTIVE", verified_at: new Date().toISOString() } });
  assert.equal(good.json.ok, true);
  assert.equal(good.json.row.status, "ACTIVE");
});

test("ويبهوك ميتا يُسطَّح صحيحاً", () => {
  const msgs = RE.parseMetaWebhook({
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "966501234567", profile: { name: "فهد" } }],
      messages: [{ from: "966501234567", id: "wamid.x", type: "text", text: { body: "مرحبا" } }],
    } }] }],
  });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].name, "فهد");
  assert.equal(msgs[0].text, "مرحبا");
  assert.equal(msgs[0].messageId, "wamid.x");
});

test("التحقق من الويبهوك يرفض رمزاً خاطئاً", async () => {
  process.env.BD_WA_VERIFY_TOKEN = "";
  const res = await call("GET", { "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "123" });
  assert.equal(res.statusCode, 403);
});

test("لا رسالة غادرت الجهاز — كلها في صندوق الصادر", async () => {
  const outboxFile = path.join(TMP, "outbox.json");
  const rows = JSON.parse(fs.readFileSync(outboxFile, "utf8"));
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.kind === "whatsapp"));
});
