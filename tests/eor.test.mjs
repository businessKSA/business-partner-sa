// خدمة EOR (موظفون على بند التعاقد) — api/_eor.js و/eor. يعمل بلا شبكة: كل ما يخرج من الآلة محاكى.
//
// اختبارات الصفحة تقرأ الصفحات المولَّدة (شغّل npm run build قبلها)، كبقية اختبارات الصفحات في هذا المجلد.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// يجب أن يسبق الاستيراد: يمنع أي مسار افتراضي من لمس شبكةٍ أو Notion حقيقيين.
process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-test-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const E = await import("../api/_eor.js");
const { OCCUPATIONS } = await import("../api/_occupations.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-10-01T09:00:00Z");

const good = (over = {}) => ({
  company: "شركة الأمل", contactName: "سارة", email: "Sara@Example.com", phone: "0501234567", city: "الرياض",
  workerType: "foreign", recruitment: "yes",
  items: [{ occupationId: "hosp.waiter", count: 5, nationalities: ["IN", "PK"], salary: 2500 }],
  startDate: "2026-11-01", durationMonths: 12, notes: "ملاحظة", lang: "ar", ...over,
});
const items = (n, count = 1) => Array.from({ length: n }, () => ({ occupationId: "hosp.waiter", count, nationalities: [] }));
const v = (b) => E.validateEorRequest(b, { now: NOW });
const bad = (b, error) => { const r = v(b); assert.equal(r.ok, false, `يجب أن يُرفض: ${error}`); assert.equal(r.error, error); assert.equal(r.status, 400); };

/* ───────────── التحقق ───────────── */
test("حمولة صحيحة تُقبل وتُنظَّف (بريد بحروف صغيرة، جوال مطبَّع، العدد الكلي محسوب)", () => {
  const r = v(good({ phone: "٠٥٠ ١٢٣-٤٥٦٧", company: "  شركة‮ الأمل \n " }));
  assert.equal(r.ok, true);
  assert.equal(r.value.email, "sara@example.com");
  assert.equal(r.value.phone, "0501234567");
  assert.equal(r.value.company, "شركة الأمل");
  assert.equal(r.value.totalCount, 5);
  assert.equal(r.value.source, "site:/eor");
});

test("حدود البنود: ٢٠ تُقبل و٢١ تُرفض، وبنود فارغة أو غير مصفوفة تُرفض", () => {
  assert.equal(v(good({ items: items(20) })).ok, true);
  bad(good({ items: items(21) }), "too_many_items");
  bad(good({ items: [] }), "items_required");
  bad(good({ items: undefined }), "items_required");
  bad(good({ items: "x" }), "items_required");
  bad(good({ items: [null] }), "item_invalid");
});

test("العدد: ١ إلى ٥٠٠ للبند، والكلي ≤ ٥٠٠", () => {
  assert.equal(v(good({ items: items(1, 500) })).ok, true);
  assert.equal(v(good({ items: [...items(1, 300), ...items(1, 200)] })).ok, true);
  bad(good({ items: [...items(1, 300), ...items(1, 201)] }), "total_count_exceeded");
  bad(good({ items: items(1, 501) }), "item_count_invalid");
  bad(good({ items: items(1, 0) }), "item_count_invalid");
  bad(good({ items: items(1, 1.5) }), "item_count_invalid");
  bad(good({ items: items(1, -3) }), "item_count_invalid");
  bad(good({ items: items(1, "abc") }), "item_count_invalid");
  assert.equal(v(good({ items: items(1, "7") })).value.totalCount, 7);
});

test("مهنة غير موجودة في التصنيف الموحّد تُرفض، والموجودة كلها تُقبل", () => {
  bad(good({ items: [{ occupationId: "made.up", count: 1 }] }), "item_occupation_unknown");
  bad(good({ items: [{ count: 1 }] }), "item_occupation_unknown");
  bad(good({ items: [{ occupationId: "unclassified", count: 1 }] }), "item_occupation_unknown");
  assert.equal(OCCUPATIONS.length, 297);
  for (const o of OCCUPATIONS) assert.equal(v(good({ items: [{ occupationId: o.id, count: 1 }] })).ok, true, o.id);
});

test("جنسية مجهولة أو أكثر من ١٠ جنسيات أو نوع غير مصفوفة تُرفض", () => {
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, nationalities: ["ZZ"] }] }), "nationality_unknown");
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, nationalities: ["India"] }] }), "nationality_unknown");
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, nationalities: "IN" }] }), "nationality_invalid");
  const eleven = E.NATIONALITIES.slice(0, 11).map((n) => n.code);
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, nationalities: eleven }] }), "too_many_nationalities");
  const ten = E.NATIONALITIES.slice(0, 10).map((n) => n.code);
  assert.equal(v(good({ items: [{ occupationId: "hosp.waiter", count: 1, nationalities: ten }] })).ok, true);
  // حروف صغيرة تُقبل وتُوحَّد، والتكرار يُحذف
  assert.deepEqual(v(good({ items: [{ occupationId: "hosp.waiter", count: 1, nationalities: ["in", "IN"] }] })).value.items[0].nationalities, ["IN"]);
});

test("البريد والجوال والحقول الإلزامية", () => {
  for (const email of ["", "abc", "a@b", "a b@c.com", "a@b.c", "x".repeat(170) + "@a.com"]) bad(good({ email }), "email_invalid");
  for (const phone of ["", "123", "abcdefghij", "05012", "+".repeat(3), "1".repeat(16)]) bad(good({ phone }), "phone_invalid");
  assert.equal(v(good({ phone: "00966501234567" })).value.phone, "+966501234567");
  bad(good({ company: " " }), "company_required");
  bad(good({ contactName: "" }), "contact_required");
  bad(good({ city: "" }), "city_required");
  bad(good({ workerType: "x" }), "worker_type_invalid");
  bad(good({ recruitment: "maybe" }), "recruitment_invalid");
  bad(null, "invalid_body");
  bad([], "invalid_body");
});

test("الراتب والمدة وتاريخ البدء", () => {
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, salary: -1 }] }), "salary_invalid");
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, salary: 1e7 }] }), "salary_invalid");
  bad(good({ items: [{ occupationId: "hosp.waiter", count: 1, salary: "abc" }] }), "salary_invalid");
  assert.equal(v(good({ items: [{ occupationId: "hosp.waiter", count: 1, salary: "" }] })).value.items[0].salary, null);
  assert.equal(v(good({ items: [{ occupationId: "hosp.waiter", count: 1, salary: "2,500.5" }] })).value.items[0].salary, 2500.5);
  bad(good({ durationMonths: 0 }), "duration_invalid");
  bad(good({ durationMonths: 61 }), "duration_invalid");
  bad(good({ durationMonths: 1.5 }), "duration_invalid");
  bad(good({ durationMonths: undefined }), "duration_invalid");
  assert.equal(v(good({ durationMonths: 60 })).ok, true);
  bad(good({ startDate: "2026-02-30" }), "start_date_invalid");
  bad(good({ startDate: "2020-01-01" }), "start_date_invalid");
  bad(good({ startDate: "2031-01-01" }), "start_date_invalid");
  bad(good({ startDate: "1/1/2027" }), "start_date_invalid");
  assert.equal(v(good({ startDate: "" })).value.startDate, "");
});

test("الملاحظات: تُقصّ وتُنظَّف، وغير النص مرفوض", () => {
  bad(good({ notes: "x".repeat(2001) }), "notes_too_long");
  assert.equal(v(good({ notes: "x".repeat(2000) })).value.notes.length, 2000);
  const r = v(good({ notes: "سطر ١\r\n\r\n\r\n\r\nسطر\u0000 ٢" }));
  assert.equal(r.ok, true);
  assert.equal(r.value.notes, "سطر ١\n\nسطر ٢");
  bad(good({ notes: { a: 1 } }), "notes_invalid");
  assert.equal(v(good({ lang: "xx" })).value.lang, "ar");
});

/* ───────────── المعالج: Notion والبريد والتنبيه ───────────── */
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) });
function rig(over = {}) {
  const calls = { fetch: [], mail: [], notify: [] };
  const ctx = {
    dev: false, notionToken: "secret_test", dbId: "db-test", now: NOW, ip: "", pricing: null, refGen: () => "EOR-123456",
    fetch: async (url, init) => { calls.fetch.push({ url, init, body: JSON.parse(init.body) }); return resp(200, { id: "11111111-2222-3333-4444-555555555555" }); },
    sendEmail: async (to, subject, html) => { calls.mail.push({ to, subject, html }); return { ok: true }; },
    notify: async (p) => { calls.notify.push(p); return { ok: true }; },
    teamEmail: "team@test.local", ownerEmail: "owner@test.local",
    ...over,
  };
  return { ctx, calls };
}

test("إرسال صحيح: صفٌّ في Notion بالأعمدة المطلوبة، وبريدان للفريق وتأكيد للعميل، وتنبيه، ويُرجع {ok,ref}", async () => {
  const { ctx, calls } = rig();
  const r = await E.handleEor(good(), ctx);
  assert.deepEqual(r, { ok: true, ref: "EOR-123456" });
  assert.equal(calls.fetch.length, 1);
  const { url, body, init } = calls.fetch[0];
  assert.equal(url, "https://api.notion.com/v1/pages");
  assert.equal(init.headers.Authorization, "Bearer secret_test");
  assert.equal(body.parent.database_id, "db-test");
  const p = body.properties;
  assert.equal(p["رقم مرجعي"].title[0].text.content, "EOR-123456");
  assert.equal(p["الحالة"].select.name, "جديد");
  assert.equal(p["نوع العاملين"].select.name, "أجانب");
  assert.equal(p["الاستقدام"].select.name, "يلزم");
  assert.equal(p["عدد الموظفين الكلي"].number, 5);
  assert.equal(p["المدة (أشهر)"].number, 12);
  assert.equal(p["تاريخ البدء"].date.start, "2026-11-01");
  assert.equal(p["اللغة"].select.name, "ar");
  assert.equal(p["البريد"].email, "sara@example.com");
  assert.equal(p["تقدير عرض السعر"].rich_text[0].text.content, "pending_pricing");
  const itemsTxt = p["بنود المهن"].rich_text.map((x) => x.text.content).join("");
  assert.match(itemsTxt, /نادل \| Waiter/);
  assert.match(itemsTxt, /العدد: 5/);
  assert.match(itemsTxt, /الهند، باكستان/);
  assert.match(itemsTxt, /الراتب المتوقع: 2500/);
  // الحمولة الكاملة كتلةُ كودٍ في جسم الصفحة (للإيجنت لاحقاً)
  const json = JSON.parse(body.children[0].code.rich_text.map((x) => x.text.content).join(""));
  assert.equal(json.ref, "EOR-123456");
  assert.equal(json.items[0].occupationId, "hosp.waiter");
  // بريد: فريق + مالك + عميل
  assert.deepEqual(calls.mail.map((m) => m.to).sort(), ["owner@test.local", "sara@example.com", "team@test.local"]);
  assert.ok(calls.mail.every((m) => m.html.includes("EOR-123456")));
  const client = calls.mail.find((m) => m.to === "sara@example.com");
  assert.ok(!/ريال|SAR|\d+\s*﷼/.test(client.html), "بريد العميل لا يحوي سعراً");
  assert.ok(client.html.includes("لم يُحدَّد سعر بعد"));
  // تنبيه المالك/فرح
  assert.equal(calls.notify.length, 1);
  assert.equal(calls.notify[0].source, "eor-request");
  assert.equal(calls.notify[0].ref, "EOR-123456");
  assert.equal(calls.notify[0].total, 5);
  assert.match(calls.notify[0].transcript, /طلب خدمة EOR بعدد 5 موظف/);
});

test("عمود غائب في Notion يُسقَط وحده وتُعاد الكتابة بلا انهيار (نمط notionWriteOptional)", async () => {
  let n = 0;
  const { ctx, calls } = rig({
    fetch: async (url, init) => {
      const body = JSON.parse(init.body); calls.fetch.push({ body });
      n++;
      if (body.properties["ملاحظات"]) return resp(400, { message: "ملاحظات is not a property that exists." });
      if (body.properties["تقدير عرض السعر"]) return resp(400, { message: "تقدير عرض السعر is expected to be rich_text." });
      return resp(200, { id: "abc" });
    },
  });
  const r = await E.handleEor(good(), ctx);
  assert.equal(r.ok, true);
  assert.equal(n, 3);
  const last = calls.fetch[2].body.properties;
  assert.equal(last["ملاحظات"], undefined);
  assert.equal(last["تقدير عرض السعر"], undefined);
  assert.ok(last["المنشأة"] && last["بنود المهن"] && last["عدد الموظفين الكلي"], "باقي الأعمدة محفوظة");
  assert.ok(last["رقم مرجعي"], "العنوان لا يُسقَط أبداً");
});

test("notionCreateOptional: رسالة لا تسمّي عموداً تُسقِط الاختياري كله، وخطأ آخر لا يُعاد", async () => {
  let calls = 0;
  const f1 = async (u, init) => { calls++; return Object.keys(JSON.parse(init.body).properties).length > 1 ? resp(400, "body.properties.x is not a property that exists") : resp(200, { id: "i" }); };
  const props = { "رقم مرجعي": { title: [] }, "أ": {}, "ب": {} };
  const w = await E.notionCreateOptional(f1, "t", "d", props);
  assert.equal(w.ok, true); assert.deepEqual(w.dropped.sort(), ["أ", "ب"].sort());
  calls = 0;
  const w2 = await E.notionCreateOptional(async () => { calls++; return resp(401, "unauthorized"); }, "t", "d", props);
  assert.equal(w2.ok, false); assert.equal(calls, 1);
});

test("Notion يفشل لكن البريد وصل: يُقبل الطلب (ok) — وإن فشل الاثنان: 502 صريح لا نجاح كاذب", async () => {
  const a = rig({ fetch: async () => resp(500, "boom"), notify: async () => ({ ok: false }) });
  assert.deepEqual(await E.handleEor(good(), a.ctx), { ok: true, ref: "EOR-123456" });
  const b = rig({ fetch: async () => resp(500, "boom"), notify: async () => ({ ok: false }), sendEmail: async () => ({ ok: false, error: "x" }) });
  const r = await E.handleEor(good(), b.ctx);
  assert.equal(r.ok, false); assert.equal(r.status, 502); assert.equal(r.error, "unavailable");
  // بلا رمز Notion أصلاً
  const c = rig({ notionToken: "" });
  assert.equal((await E.handleEor(good(), c.ctx)).ok, true);
  assert.equal(c.calls.fetch.length, 0);
});

test("فشل البريد أو التنبيه (استثناء) لا يُفشل طلباً حُفظ", async () => {
  const { ctx } = rig({ sendEmail: async () => { throw new Error("smtp"); }, notify: async () => { throw new Error("hook"); } });
  assert.equal((await E.handleEor(good(), ctx)).ok, true);
});

test("الفخّ (honeypot): نجاحٌ ظاهري بلا كتابة ولا بريد ولا تنبيه", async () => {
  const { ctx, calls } = rig();
  const r = await E.handleEor(good({ website: "http://spam.example" }), ctx);
  assert.equal(r.ok, true); assert.match(r.ref, /^EOR-\d{6}$/);
  assert.equal(calls.fetch.length + calls.mail.length + calls.notify.length, 0);
});

test("طلب غير صالح لا يكتب شيئاً", async () => {
  const { ctx, calls } = rig();
  const r = await E.handleEor(good({ email: "bad" }), ctx);
  assert.deepEqual([r.ok, r.status, r.error, r.field], [false, 400, "email_invalid", "email"]);
  assert.equal(calls.fetch.length + calls.mail.length + calls.notify.length, 0);
});

test("الحدّ من الإساءة: السابعة من العنوان نفسه ترجع 429", async () => {
  E._resetEorRateLimit();
  const { ctx } = rig({ ip: "9.9.9.9" });
  for (let i = 0; i < 6; i++) assert.equal((await E.handleEor(good(), ctx)).ok, true);
  const r = await E.handleEor(good(), ctx);
  assert.deepEqual([r.ok, r.status, r.error], [false, 429, "rate_limited"]);
  E._resetEorRateLimit();
});

test("بحث المهن عبر المعالج: مرادفات التصنيف (CDP) وبلا حقول خاصة", async () => {
  const r = await E.handleEor({ action: "search", q: "cdp" }, {});
  assert.equal(r.ok, true);
  assert.ok(r.results.some((x) => x.id === "hosp.chef-de-partie"));
  assert.deepEqual(Object.keys(r.results[0]).sort(), ["id", "nameAr", "nameEn"]);
  assert.deepEqual(await E.handleEor({ action: "search", q: "a" }, {}), { ok: true, results: [] });
});

test("في بيئة التطوير بلا fetch محقون: لا شبكة — يُسجَّل في الـoutbox", async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (...a) => { sent.push(a[0]); throw new Error("no network in tests"); };
  try {
    const r = await E.handleEor(good(), { now: NOW, ip: "", pricing: null });   // dev من APP_ENV=development
    assert.equal(r.ok, true);
    assert.deepEqual(sent, []);
  } finally { globalThis.fetch = realFetch; }
});

/* ───────────── التسعير ───────────── */
const PRICING = {
  currency: "SAR", vat_rate: 0.15, valid_from: null, valid_until: null,
  service_fee_monthly_per_employee: { saudi: 400, foreign: 300.5 },
  recruitment_fee_per_employee: { saudi: 1000, foreign: 2500 }, notes: null,
};
const IT = (count, nationalities, salary) => ({ occupationId: "hosp.waiter", count, nationalities, salary: salary == null ? null : salary });

test("estimateQuote: الملف المرفق (كله null) وأي null ⇒ { status:'pending_pricing' } فقط", () => {
  const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
  assert.equal(shipped.currency, null); assert.equal(shipped.vat_rate, null);
  for (const k of ["saudi", "foreign"]) { assert.equal(shipped.service_fee_monthly_per_employee[k], null); assert.equal(shipped.recruitment_fee_per_employee[k], null); }
  assert.deepEqual(E.estimateQuote([IT(2, ["IN"])], shipped, { workerType: "foreign", recruitment: "yes", durationMonths: 6, now: NOW }), { status: "pending_pricing" });
  assert.deepEqual(E.loadPricing(), shipped);
  assert.deepEqual(E.estimateQuote([IT(2, ["IN"])], null), { status: "pending_pricing" });
  assert.deepEqual(E.estimateQuote([], PRICING), { status: "pending_pricing" });
  const noVat = { ...PRICING, vat_rate: null };
  assert.deepEqual(E.estimateQuote([IT(1, ["IN"])], noVat, { now: NOW }), { status: "pending_pricing" });
  const noForeign = { ...PRICING, service_fee_monthly_per_employee: { saudi: 400, foreign: null } };
  assert.deepEqual(E.estimateQuote([IT(1, ["IN"])], noForeign, { now: NOW }), { status: "pending_pricing" });
  // استقدام مطلوب ورسمه فارغ
  const noRec = { ...PRICING, recruitment_fee_per_employee: { saudi: null, foreign: null } };
  assert.deepEqual(E.estimateQuote([IT(1, ["IN"])], noRec, { recruitment: "yes", now: NOW }), { status: "pending_pricing" });
  // سريان منتهٍ أو لم يبدأ
  assert.deepEqual(E.estimateQuote([IT(1, ["IN"])], { ...PRICING, valid_until: "2026-09-30" }, { now: NOW }), { status: "pending_pricing" });
  assert.deepEqual(E.estimateQuote([IT(1, ["IN"])], { ...PRICING, valid_from: "2026-10-02" }, { now: NOW }), { status: "pending_pricing" });
});

test("estimateQuote مكتمل: بنود مفصّلة بالهللة وضريبة على كل مجموع بلا تقريبٍ مضلّل", () => {
  const q = E.estimateQuote([IT(3, ["IN"], 2000), IT(2, ["SA"], 5000)], PRICING, { workerType: "both", recruitment: "yes", durationMonths: 12, now: NOW });
  assert.equal(q.status, "estimated");
  assert.equal(q.currency, "SAR");
  assert.equal(q.lines.length, 2);
  assert.deepEqual([q.lines[0].workerType, q.lines[0].serviceFeePerEmployeeMonthly, q.lines[0].serviceFeeMonthly, q.lines[0].recruitmentFee], ["foreign", 300.5, 901.5, 7500]);
  assert.deepEqual([q.lines[1].workerType, q.lines[1].serviceFeeMonthly, q.lines[1].recruitmentFee], ["saudi", 800, 2000]);
  assert.deepEqual(q.monthly, { subtotal: 1701.5, vat: 255.23, total: 1956.73 });    // 170150 × 0.15 = 25522.5 → 25523 هللة
  assert.deepEqual(q.oneTime, { subtotal: 9500, vat: 1425, total: 10925 });
  assert.deepEqual(q.term, { months: 12, subtotal: 29918, vat: 4487.7, total: 34405.7 });  // 1701.5×12 + 9500
  assert.deepEqual(q.payroll, { declaredMonthly: 16000, itemsWithSalary: 2, itemsTotal: 2, includedInFees: false });
  assert.equal(q.notice, "estimate_not_an_offer");
});

test("estimateQuote: استقدام «غير متأكد» لا يدخل المجاميع، والراتب الناقص لا يُخترع", () => {
  const q = E.estimateQuote([IT(2, ["IN"], 3000), IT(1, ["PK"])], PRICING, { recruitment: "unsure", durationMonths: 6, now: NOW });
  assert.equal(q.status, "estimated");
  assert.equal(q.oneTime, null);
  assert.equal(q.lines[0].recruitmentFee, null);
  assert.equal(q.lines[0].recruitmentFeeOptional, 5000);
  assert.equal(q.term.subtotal, 300.5 * 3 * 6);
  assert.deepEqual(q.payroll, { declaredMonthly: null, itemsWithSalary: 1, itemsTotal: 2, includedInFees: false });
  const no = E.estimateQuote([IT(1, ["IN"])], PRICING, { recruitment: "no", now: NOW });
  assert.equal(no.oneTime, null); assert.equal(no.term, null);
});

test("estimateQuote: نوع العامل غير المحسوم أو المختلط ⇒ needs_review لا رقم مخمَّن", () => {
  const q = E.estimateQuote([IT(1, []), IT(1, ["SA", "IN"])], PRICING, { workerType: "both", now: NOW });
  assert.deepEqual(q, { status: "needs_review", reasons: [{ index: 0, reason: "worker_type_unclear" }, { index: 1, reason: "mixed_nationalities" }] });
  // «سعوديون» بلا جنسية تُحسم سعودياً
  assert.equal(E.estimateQuote([IT(1, [])], PRICING, { workerType: "saudi", now: NOW }).lines[0].workerType, "saudi");
});

test("المعالج يحسب التقدير حين يكتمل التسعير ويكتبه في العمود (والعميل لا يرى رقماً)", async () => {
  const { ctx, calls } = rig({ pricing: PRICING });
  const r = await E.handleEor(good({ items: [{ occupationId: "hosp.waiter", count: 2, nationalities: ["IN"] }], durationMonths: 6, recruitment: "no" }), ctx);
  assert.deepEqual(r, { ok: true, ref: "EOR-123456" });
  const txt = calls.fetch[0].body.properties["تقدير عرض السعر"].rich_text[0].text.content;
  assert.match(txt, /^estimated: شهري 691\.15 SAR/);
  assert.deepEqual(Object.keys(r), ["ok", "ref"]);
});

/* ───────────── نطاق العمل ───────────── */
test("buildScopeOfWork: أقسام ثابتة بالعربية والإنجليزية، تعكس الطلب، بلا موادّ نظامية", () => {
  const req = { company: "شركة الأمل", workerType: "foreign", recruitment: "yes", durationMonths: 12, startDate: "2026-11-01", items: [{ occupationId: "hosp.waiter", count: 5, nationalities: ["IN"], salary: 2500 }], totalCount: 5 };
  const ar = E.buildScopeOfWork(req, "ar");
  assert.deepEqual(ar.sections.map((s) => s.key), ["summary", "company", "client", "term", "delivery", "exclusions"]);
  assert.match(ar.text, /شركة الأمل/); assert.match(ar.text, /نادل \| Waiter/); assert.match(ar.text, /الهند/);
  assert.match(ar.text, /12 أشهر/); assert.match(ar.text, /2026-11-01/); assert.match(ar.text, /الاستقدام والتوطين عند الحاجة/);
  const en = E.buildScopeOfWork(req, "en");
  assert.equal(en.lang, "en"); assert.match(en.text, /India/); assert.match(en.text, /Waiter/); assert.match(en.text, /12 months/);
  assert.equal(E.buildScopeOfWork(req, "fr").lang, "en");
  for (const s of [ar.text, en.text]) {
    assert.ok(!/المادة|مادة\s*\d|Article\s*\d|Art\.\s*\d/i.test(s), "لا أرقام موادّ");
    assert.ok(!/نضمن|guarantee(?!.*no|.*Any)/i.test(s.replace(/ضمان الموافقات[^\n]*/g, "").replace(/Any guarantee[^\n]*/g, "")), "لا ضمانات");
  }
  // بلا استقدام: لا بند استقدام
  assert.ok(!/الاستقدام والتوطين عند الحاجة/.test(E.buildScopeOfWork({ ...req, recruitment: "no" }, "ar").text));
});

/* ───────────── الصفحة المولَّدة ───────────── */
const PAGES = { ar: "site/ar/eor.html", en: "site/eor.html", fr: "site/fr/eor.html", zh: "site/zh/eor.html" };
const page = (lang) => fs.readFileSync(path.join(ROOT, PAGES[lang]), "utf8");

for (const lang of Object.keys(PAGES)) {
  test(`/eor (${lang}): قشرة SV1 بلا main.js، الحقول والزر والفخّ، وبلا localStorage`, () => {
    const h = page(lang);
    assert.ok(new RegExp(`<html[^>]*lang="${lang}"`).test(h), "lang");
    assert.equal(/<script[^>]*main\.js/.test(h), false, "بلا main.js");
    assert.ok(h.includes('class="sv1"') || h.includes('<div class="sv1">'), "قشرة SV1");
    for (const id of ["eorForm", "eorCompany", "eorContact", "eorEmail", "eorPhone", "eorCity", "eorItems", "eorAdd", "eorStart", "eorMonths", "eorNotes", "eorGo", "eorWebsite", "eorTotal"]) assert.ok(h.includes(`id="${id}"`), id);
    for (const val of ["saudi", "foreign", "both", "yes", "no", "unsure"]) assert.ok(h.includes(`value="${val}"`), "راديو " + val);
    assert.ok(h.includes('name="website"') && h.includes('tabindex="-1"'), "honeypot");
    assert.ok(h.includes("/api/requests?__route=eor"), "نقطة الإرسال");
    // بلا تخزين متصفّح في ما تملكه الصفحة: الأنماط والمحتوى والسكربت العميل (قشرة SV1 لها تلميح جلسة خاص بها)
    const css = h.slice(h.indexOf('id="sv1-eor-css"'), h.indexOf("</style>", h.indexOf('id="sv1-eor-css"')));
    const mainHtml = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    const s0 = h.indexOf("<script>(function eorClient");
    assert.ok(s0 > 0, "السكربت العميل eorClient موجود");
    const client = h.slice(s0, h.indexOf("</script>", s0));
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(css + mainHtml + client), false, "بلا تخزين");
    assert.ok(client.includes("action=search") && client.includes("JSON.stringify(payload)"), "بحث الخادم والإرسال");
    // أربع لغات في ترويسة اللغات، ولا زرّ واتساب داخل المحتوى
    for (const l of ["ar", "en", "fr", "zh"]) assert.ok(h.includes(`data-lang="${l}"`), "لغة " + l);
    const main = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    assert.equal(/wa\.me|whatsapp/i.test(main), false, "لا واتساب في المحتوى");
    // لا سعر في الصفحة
    assert.equal(/\d\s*(﷼|ر\.س|SAR)/.test(main), false, "لا سعر");
  });

  test(`/eor (${lang}): العنوان والوصف ومحتوى الأقسام (٦ بطاقات، ٥ خطوات، ٥ أسئلة)`, () => {
    const h = page(lang);
    assert.match(h, /<title>[^<]*Business Partner[^<]*<\/title>/);
    assert.equal((h.match(/class="sv1-eor-card"/g) || []).length, 6);
    assert.equal((h.match(/<ol class="sv1-eor-steps">(?:<li>[^<]+<\/li>){5}<\/ol>/g) || []).length, 1);
    assert.equal((h.match(/<details><summary>/g) || []).length, 5);
    assert.equal(/\{\{|\[object|undefined/.test(h.slice(h.indexOf("<main>"), h.indexOf("</main>"))), false, "لا بقايا قوالب");
  });
}

test("/eor العربية تحمل الاسم الواضح وسطر «صاحب العمل الرسمي»", () => {
  const h = page("ar");
  assert.ok(h.includes("موظفون على بند التعاقد (EOR)"));
  assert.ok(h.includes("نحن صاحب العمل الرسمي لموظفيك"));
  assert.ok(/<html[^>]*dir="rtl"/.test(h));
  assert.equal(/شريك الأعمال|شريك أعمالك/.test(h), false);
});

const cfgOf = (h) => {
  const m = h.match(/\)\((\{"lang":.*\})\);<\/script>/s);
  assert.ok(m, "CFG");
  return JSON.parse(m[1]);
};

test("/eor: قائمة المهن المدمجة = id + عربي + إنجليزي فقط (٢٩٧ مهنة)، والجنسيات من القائمة المدمجة", () => {
  for (const lang of Object.keys(PAGES)) {
    const c = cfgOf(page(lang));
    assert.equal(c.lang, lang);
    assert.equal(c.occ.length, 297);
    assert.ok(c.occ.every((o) => Array.isArray(o) && o.length === 3 && typeof o[0] === "string" && typeof o[1] === "string" && typeof o[2] === "string"));
    assert.deepEqual(c.occ.map((o) => o[0]).sort(), OCCUPATIONS.map((o) => o.id).sort());
    assert.equal(c.nats.length, E.NATIONALITIES.length);
    assert.deepEqual(c.lim, { maxItems: 20, maxTotal: 500, maxItemCount: 500, maxMonths: 60, maxSalary: 100000, maxNats: 10 });
  }
});

test("الصفحة العامة لا تحوي أي شيء من الخريطة الخاصة (_occupation-map.json)", () => {
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_occupation-map.json"), "utf8"));
  const publicNames = OCCUPATIONS.map((o) => (o.id + " " + o.nameAr + " " + o.nameEn).toLowerCase()).join(" ");
  const secrets = Object.keys(map.map).filter((k) => k.length >= 10 && !publicNames.includes(k)).slice(0, 2000);
  assert.ok(secrets.length > 500, "عيّنة كافية من المسمّيات الخاصة");
  for (const lang of Object.keys(PAGES)) {
    const h = page(lang);
    const low = h.toLowerCase();
    for (const k of secrets) assert.equal(low.includes(JSON.stringify(k).slice(1, -1).toLowerCase()), false, `تسرّب مفتاح خريطة خاصة في ${lang}: ${k}`);
    for (const marker of ["_occupation-map", "OCC_VERSION", map.note.slice(0, 30), "Original Position", '"aliases"', '"sector"', '"via"']) assert.equal(h.includes(marker), false, `${lang}: ${marker}`);
  }
  // الباني لا يستورد الخريطة أصلاً
  const src = fs.readFileSync(path.join(ROOT, "site/scripts/simple-v1-eor.mjs"), "utf8");
  assert.equal(/import[^;]*_occupation-map|readFileSync[^;]*occupation-map/.test(src), false);
});

test("generate.mjs يستدعي /eor بسطرين فقط (استيراد + كتابة) داخل كتلة SIMPLE_V1", () => {
  const g = fs.readFileSync(path.join(ROOT, "site/scripts/generate.mjs"), "utf8");
  assert.equal((g.match(/simple-v1-eor\.mjs/g) || []).length, 1);
  assert.equal((g.match(/buildSimpleEor\(/g) || []).length, 1);
});

test("api/_eor.js ملف مساعد (يبدأ بـ_) ولا ملف api/ جديداً بلا _", () => {
  const fns = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  assert.ok(fns.length <= 12, `الدوال ${fns.length}`);
  assert.ok(!fns.includes("eor.js"));
});
