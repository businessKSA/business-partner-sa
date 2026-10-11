// الدفع من السلة يفعّل الاشتراك — مستشار الامتثال (BP-AI-03) · فريق الخدمات المشتركة
// (BP-AI-04) · الموظف الذكي المتخصص (BP-AI-SMART-EMPLOYEE).
//
// العطل (تدقيق 2026-10-10، الفجوة ١٠/١١): صفحة الخدمة الجديدة تضيف العنصر بمعرّف
// svc-<رمز الكتالوج>، بينما التفعيل في api/requests.js {action:"paid-order"} يقرأ
// agent-compliance-agent / agent-shared-services-team / employee-<slug>. فيُدفع المبلغ كاملاً
// ويُسجَّل «خدمة عادية»: لا رمز ولا بوابة ولا اشتراك.
//
// هذا الاختبار يشغّل المسار الحقيقي كاملاً في عملية واحدة: api/pay.js (تحقق المبلغ من الكتالوج
// الحقيقي site/assets/data/catalog.json) ← الاستدعاء المختوم ← api/requests.js (التفعيل).
// لا شبكة: الدفع «mock_» محلي، ونوشن مُحاكى، والبريد وCRM يُسجَّلان في صندوق ملفّي (APP_ENV=development).
//
// المقاس: ① كل معرّف (القديم والجديد) يفعّل ما يستحقه بالسعر نفسه من الكتالوج.
//         ② مبلغ أقل (أو سعر خدمة أخرى) ⇒ لا تفعيل، والصف «قيد المراجعة».
//         ③ لا ثغرة تسعير: employee-all لا يفتح الفريق كاملاً بسعر موظف واحد.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "paid-order-activation-"));
Object.assign(process.env, {
  APP_ENV: "development", LOCAL_DB_DIR: DIR, LOCAL_DB: "1",
  OTP_SECRET: "unit-otp-secret-paid-order", NOTION_TOKEN: "notion-unit-token",
  MKT_SITE_BASE: "http://unit.local", CATALOG_URL: "http://unit.local/catalog.json",
});
for (const k of ["MOYASAR_PUBLISHABLE_KEY", "MOYASAR_SECRET_KEY", "RESEND_API_KEY", "RESEND_KEY", "RESEND", "DAFTRA_API_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];

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
    if (/\/query$/.test(u)) return json({ results: [] });          // لا صف سابق: لا تكرار ولا اشتراك قائم
    return json({ id: "page-unit" });
  }
  if (u === "http://unit.local/api/requests") {                      // الاستدعاء المختوم من pay.js إلى requests.js
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

const outboxFile = path.join(DIR, "outbox.json");
const readOutbox = () => { try { return JSON.parse(fs.readFileSync(outboxFile, "utf8")); } catch { return []; } };
let seq = 0;

// يدفع سلةً ويعيد ما سُجّل: ردّ pay.js + ما وصل البريد وCRM
async function pay(items, amountSar, email = "buyer@unit.test") {
  const before = readOutbox().length;
  const ref = "BP-U" + String(++seq).padStart(5, "0");
  const out = { status: 200, body: null };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; out.body = JSON.parse(b); } };
  await payHandler({
    method: "POST", headers: {}, query: {}, url: "/api/pay",
    body: { id: "mock_card_unit" + String(seq).padStart(5, "0"), amount: amountSar,
      order: { ref, name: "مشتري", email, phone: "0500000000", company: "شركة الاختبار", items } },
  }, res);
  const added = readOutbox().slice(0, readOutbox().length - before);
  const mails = added.filter((e) => e.kind === "email");
  const rows = added.filter((e) => e.kind === "crm").map((e) => ({ status: e.props["حالة الطلب"] && e.props["حالة الطلب"].select.name, notes: e.props.Notes.rich_text[0].text.content }));
  // صف الطلب المدفوع هو الذي يحمل PAYID؛ التفعيل يكتب صفوفاً أخرى (مثل «معتمد ومفعّل»)
  const crm = [rows.find((x) => /PAYID:/.test(x.notes)), ...rows.filter((x) => !/PAYID:/.test(x.notes))];
  return { ref, status: out.status, body: out.body, settle: out.body && out.body.settle, activated: (out.body && out.body.settle && out.body.settle.activated) || {}, mails, crm };
}
const subjects = (r) => r.mails.map((m) => m.subject);
const hasMail = (r, re) => r.mails.some((m) => re.test(m.subject));

// ------------------------------------------------------------------ الإثبات: كل معرّف يفعّل --
test("svc-bp-ai-03 (مستشار الامتثال): الدفع بسعر الكتالوج يفعّل الاشتراك لا خدمةً عادية", async () => {
  const r = await pay([{ id: "svc-bp-ai-03", qty: 1 }], sar("BP-AI-03"));
  assert.equal(r.settle.ok, true);
  assert.equal(r.settle.verified, true, "المبلغ طابق الكتالوج (١٠٠٠ ﷼ شهرياً)");
  assert.equal(r.activated.compliance, true, "فُعِّل اشتراك الامتثال");
  assert.equal("service" in r.activated, false, "لم يُسجَّل كخدمة عادية");
  assert.ok(hasMail(r, /تم تفعيل اشتراكك — وكيل الامتثال/), "رمز الدخول وصل العميل: " + subjects(r).join(" | "));
  assert.ok(!hasMail(r, /^تم اعتماد طلبك/), "ولا بريد «اعتماد طلبك» العام");
  assert.equal(r.crm[0].status, "مؤكد - قيد التنفيذ");
});

test("svc-bp-ai-04 (فريق الخدمات المشتركة): يفعّل الاشتراك ويكتب AGENTS:all", async () => {
  const r = await pay([{ id: "svc-bp-ai-04", qty: 1 }], sar("BP-AI-04"));
  assert.equal(r.settle.verified, true, "المبلغ طابق الكتالوج (١٥٠٠ ﷼ شهرياً)");
  assert.equal(r.activated.shared, true);
  assert.equal("service" in r.activated, false);
  assert.ok(hasMail(r, /كود الوصول — الخدمات المشتركة/), subjects(r).join(" | "));
  assert.match(r.crm[0].notes, /AGENTS:all/);
});

test("svc-bp-ai-smart-employee (الموظف الذكي): يفعّل المقعد ويراسل العميل ولا يمنح الفريق كاملاً", async () => {
  const r = await pay([{ id: "svc-bp-ai-smart-employee", qty: 1 }], sar("BP-AI-SMART-EMPLOYEE"));
  assert.equal(r.settle.verified, true, "المبلغ طابق الكتالوج (٥٠٠ ﷼ شهرياً)");
  assert.ok("seat" in r.activated, "تفعيل المقعد جرى: " + JSON.stringify(r.activated));
  assert.equal("service" in r.activated, false, "لم يُسجَّل كخدمة عادية");
  assert.ok(hasMail(r, /تم تفعيل اشتراك الموظف الذكي المتخصص/), subjects(r).join(" | "));
  assert.doesNotMatch(r.crm[0].notes, /AGENTS:/, "لا موظف بعينه ولا ALL");
  assert.equal(r.crm[0].status, "مؤكد - قيد التنفيذ");
  const owner = r.mails.find((m) => /مفعّل تلقائياً/.test(m.subject));
  assert.match(owner.body, /يختاره العميل من البوابة/, "المالك يعرف أن الاختيار على العميل");
});

test("الموظف الذكي بكمية ٢ يدفع ضعف السعر ويُفعَّل مقعدان", async () => {
  const r = await pay([{ id: "svc-bp-ai-smart-employee", qty: 2 }], sar("BP-AI-SMART-EMPLOYEE", 2));
  assert.equal(r.settle.verified, true);
  const mail = r.mails.find((m) => /تفعيل اشتراك الموظف الذكي المتخصص/.test(m.subject));
  assert.match(mail.body, /<b>2<\/b>/);
});

// ------------------------------------------------------------------ المعرّفات القديمة لم تتغيّر --
test("المعرّفات القديمة (agent-* / employee-*) تفعّل كما كانت وبالسعر نفسه من الكتالوج", async () => {
  const c = await pay([{ id: "agent-compliance-agent", qty: 1 }], sar("BP-AI-03"));
  assert.equal(c.settle.verified, true, "السعر الثابت في pay.js يطابق الكتالوج — إن اختلفا يقع الطلب في المراجعة");
  assert.equal(c.activated.compliance, true);
  const s = await pay([{ id: "agent-shared-services-team", qty: 1 }], sar("BP-AI-04"));
  assert.equal(s.settle.verified, true);
  assert.equal(s.activated.shared, true);
  const e = await pay([{ id: "employee-badr", qty: 1 }], sar("BP-AI-SMART-EMPLOYEE"));
  assert.equal(e.settle.verified, true, "٥٠٠ ﷼ للموظف = سعر BP-AI-SMART-EMPLOYEE");
  assert.match(e.crm[0].notes, /AGENTS:badr/);
  assert.ok(hasMail(e, /تم تفعيل موظفيك الأذكياء/));
});

test("سلة فيها الاشتراكين معاً: كلاهما يُفعَّل ولا يُسجَّل شيء كخدمة عادية", async () => {
  const total = Math.round((price("BP-AI-03") + price("BP-AI-04")) * 1.15 * 100) / 100;
  const r = await pay([{ id: "svc-bp-ai-03", qty: 1 }, { id: "svc-bp-ai-04", qty: 1 }], total);
  assert.equal(r.settle.verified, true);
  assert.equal(r.activated.compliance, true);
  assert.equal(r.activated.shared, true);
  assert.equal("service" in r.activated, false);
});

test("سلة مختلطة: خدمة عادية + الامتثال → الامتثال يُفعَّل والخدمة العادية تأخذ بريد الاعتماد", async () => {
  const plain = CATALOG.services.find((s) => s.amount > 0 && !/^BP-AI-/.test(s.code) && !s.requiresProposal);
  const total = Math.round((plain.amount + price("BP-AI-03")) * 1.15 * 100) / 100;
  const r = await pay([{ id: "svc-" + plain.code.toLowerCase(), qty: 1 }, { id: "svc-bp-ai-03", qty: 1 }], total);
  assert.equal(r.settle.verified, true);
  assert.equal(r.activated.compliance, true);
  assert.ok("service" in r.activated, "الخدمة العادية في السلة نفسها تأخذ بريد الاعتماد");
});

// ------------------------------------------------------------------ مبلغ أقل ⇒ مراجعة، لا تفعيل --
test("مبلغ أقل من الكتالوج لا يفعّل شيئاً: الصف «قيد المراجعة» ويصل المالك طلب المراجعة", async () => {
  const cases = [
    ["svc-bp-ai-03", sar("BP-AI-03") - 250 * 1.15 * 3],                 // دفع ٢٥٠ بدل ١٠٠٠ (السعر القديم)
    ["svc-bp-ai-04", sar("BP-AI-03")],                                   // دفع سعر الامتثال لفريق الخدمات المشتركة
    ["svc-bp-ai-smart-employee", sar("BP-AI-SMART-EMPLOYEE") - 100],
    ["agent-compliance-agent", 250 * 1.15],                              // القديم أيضاً
  ];
  for (const [id, amount] of cases) {
    const r = await pay([{ id, qty: 1 }], amount);
    assert.equal(r.settle.ok, true, id);
    assert.equal(r.settle.verified, false, `${id} @ ${amount}: لا يُعدّ مطابقاً`);
    assert.deepEqual(r.activated, {}, `${id}: لا تفعيل بمبلغ ناقص`);
    assert.equal(r.crm[0].status, "قيد المراجعة", id);
    assert.match(r.crm[0].notes, /المبلغ لم يُطابَق آلياً/, id);
    assert.ok(hasMail(r, /تحتاج مراجعة/), `${id}: ${subjects(r).join(" | ")}`);
    assert.ok(!hasMail(r, /كود الوصول|تفعيل اشتراكك|تفعيل موظفيك|تفعيل اشتراك الموظف/), `${id}: لا رمز وصول لدافع ناقص`);
  }
});

test("مبلغ أكثر من الكتالوج بكثير لا يمرّ آلياً أيضاً (الفرق أكثر من ريالين)", async () => {
  const r = await pay([{ id: "svc-bp-ai-03", qty: 1 }], sar("BP-AI-03") + 50);
  assert.equal(r.settle.verified, false);
  assert.deepEqual(r.activated, {});
});

// ------------------------------------------------------------------ ثغرة التسعير --
test("employee-all لا يفتح الفريق كاملاً بسعر موظف واحد", async () => {
  const r = await pay([{ id: "employee-all", qty: 1 }], sar("BP-AI-SMART-EMPLOYEE"));
  assert.equal(r.settle.verified, false, "معرّف غير معروف السعر ⇒ مراجعة");
  assert.deepEqual(r.activated, {});
  assert.doesNotMatch(r.crm[0].notes, /AGENTS:all/i);
});

test("لا نداء شبكة خارج المحاكاة", () => {
  assert.deepEqual(unexpected, []);
});
