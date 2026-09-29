// الإيجنت الباحث عن وظيفة يقرأ التوطين  (api/_jobhunt.js)
//
// شغّله: npm test
//
// لماذا يستحقّ هذا اختباراً:
//
// الوكيل كان يقرأ «حالة الإقامة» وحدها، فيرشّح غير سعوديٍّ لإعلانٍ على مهنة
// مقصورة على السعوديين. المرشّح يستلم بريداً بوظيفةٍ لن يُقبل فيها — وهذا أسوأ
// من ألا يستلم شيئاً، لأنه يبني عليه.
//
// وأوجه الاختبار وجهان متقابلان، وأخطرهما الثاني:
//   ① مرشّحٌ امتثاله «⛔ مهنة سعودية - غير سعودي» **لا يُرشَّح**: لا نداء مطابقة،
//      ولا بريد له، ويُكتب على صفّه سببٌ يقرأه من يراجع ملفه.
//   ② ومرشّحٌ **بلا توطين محسوب — وهم الأغلبية اليوم** (١٨٣٣ صفّاً بلا قيمة في
//      قياس 2026-09-29، وكل الـ١١٧ الظاهرة منها) يبقى يرى الوظائف كما اليوم
//      بلا أي فرق. فلترةٌ على حقلٍ فارغ تُسكت الوكيل عن كل الناس، وهذا عطلٌ
//      أكبر من الذي تُصلحه. الغياب ليس منعاً.
//   ③ و🔍 و⚠️ و✅ تمرّ كلها: القيمة الواحدة الصريحة هي وحدها الحاجز.
//   ④ والتوطين يصل المطابق فعلاً في نصّ الملف، وإلا فما قرأناه لم يُستعمل.
//   ⑤ والنصّ الحرفي للقيمة واحدٌ في الملفين: `api/candidate.js` يكتبها وهذا
//      يقرؤها، فحرفٌ مختلف يفتح الحاجز بصمت.
//
// بلا شبكة: أي نداء إلى غير نوشن/المطابق يرمي. ولا مفتاح حقيقي في العملية.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.PANEL_KEY = "test-owner-key";
process.env.SITE_ORIGIN = "https://site.test";
delete process.env.RESEND_API_KEY;   // لا بريد يُرسل في الاختبار
delete process.env.CRON_SECRET;

const ATS_DB = "71792742873e4de398135c7855542b95";
const JOBS_DB = "260d76959d464631943f79f313fbf3c9";
const BLOCKED = "⛔ مهنة سعودية - غير سعودي";

// ----------------------------------------------------- ما يقرره كل اختبار --
let subscriber = null;          // صفّ المشترك الواحد في هذه الجولة
let calls = { rank: 0, patch: 0 };
let patched = null, rankProfile = "";

const reset = () => { calls = { rank: 0, patch: 0 }; patched = null; rankProfile = ""; };

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

const sel = (name) => ({ type: "select", select: { name } });
const rtp = (v) => ({ type: "rich_text", rich_text: [{ plain_text: v, text: { content: v } }] });

const row = (props) => ({
  id: "11111111-2222-3333-4444-555555555555",
  properties: {
    "Candidate Name": { type: "title", title: [{ plain_text: "محمد العبدالله" }] },
    "Email": { type: "email", email: "c1@example.com" },
    "Target Role": sel("أخصائي موارد بشرية"),
    "خدمة البحث عن وظيفة": sel("مفعّلة"),
    ...props,
  },
});

const JOB = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  properties: {
    "العنوان الوظيفي": { type: "title", title: [{ plain_text: "أخصائي موارد بشرية" }] },
    "الشركة": rtp("شركة الاختبار"),
    "المدينة": rtp("الرياض"),
    "المجال": sel("موارد بشرية"),
    "الوصف والمتطلبات": rtp("خبرة في الموارد البشرية"),
    "الحالة": sel("نشطة"),
  },
};

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};

  if (u === "https://site.test/api/hire") {
    calls.rank += 1;
    rankProfile = String(body.role || "");
    return json({ ok: true, ranked: [{ id: JOB.id, score: 88, reason: "مطابقة عالية" }] });
  }
  if (u === `https://api.notion.com/v1/databases/${JOBS_DB}/query`) return json({ results: [JOB] });
  if (u === `https://api.notion.com/v1/databases/${ATS_DB}/query`) return json({ results: subscriber ? [subscriber] : [] });
  if (u.startsWith("https://api.notion.com/v1/pages/") && init.method === "PATCH") {
    calls.patch += 1;
    patched = body.properties;
    return json({ id: "patched" });
  }
  throw new Error("no network in tests: " + u);
};

const { handleJobhunt, blockedBySaudization } = await import("../api/_jobhunt.js");

function run() {
  let out = "", status = 0;
  const res = {
    setHeader() {},
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { out = b; },
  };
  return handleJobhunt({ method: "GET", url: "/api/jobhunt?action=run&key=test-owner-key&limit=5", headers: {} }, res)
    .then(() => ({ status: status || 200, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}

const suggestion = () => {
  const p = patched && patched["وظائف مقترحة من الوكيل"];
  return p ? p.rich_text.map((t) => t.text.content).join("") : "";
};

/* ───────── ① ⛔ لا يُرشَّح: لا نداء ولا بريد، وسببٌ مكتوب ───────── */
test("مرشّح امتثاله ⛔ ⇒ لا مطابقة ولا ترشيح، ويُكتب السبب على صفّه", async () => {
  reset();
  subscriber = row({
    "التوطين Saudization": sel("مقصورة على السعوديين"),
    "الامتثال Compliance": sel(BLOCKED),
  });
  const { status, data } = await run();

  assert.equal(status, 200);
  assert.equal(calls.rank, 0, "رُتّبت إعلاناتٌ على مهنةٍ لن يُقبل فيها — وهذا العطل نفسه");
  assert.equal(data.report[0].matches, 0, "رُشّح مرشّحٌ مهنته مقصورة على السعوديين");
  assert.equal(data.report[0].blocked, "saudization");
  assert.equal(calls.patch, 1, "لم يُكتب على الصفّ شيء — فلا أثر يراجعه أحد");
  assert.match(suggestion(), /مقصورة على السعوديين/);
  assert.match(suggestion(), /يُراجع الملف/, "لم يُقل للمراجع ما العمل");
  // ولا وعدٌ ولا إلغاء ولا رقم ولا قرار وزاري في النصّ المخزّن.
  assert.ok(!/نضمن|سنلغي|إلغاء|٪|%|قرار|المادة|[0-9٠-٩]/.test(suggestion()), "وعدٌ أو رقمٌ أو قرار دخل نصّ الصفّ: " + suggestion());
});

/* ───────── ② الحاجز الإلزامي: الغياب ليس منعاً ───────── */
test("مرشّح بلا توطين محسوب (الأغلبية اليوم) ⇒ يبقى يرى الوظائف كما اليوم", async () => {
  reset();
  subscriber = row({});   // لا «التوطين Saudization» ولا «الامتثال Compliance» أصلاً
  const { data } = await run();

  assert.equal(calls.rank, 1, "سكت الوكيل عن مرشّحٍ حقله فارغ — فلترةٌ على الغياب تُسكته عن كل الناس");
  assert.equal(data.report[0].matches, 1);
  assert.ok(!data.report[0].blocked);
  assert.match(suggestion(), /أخصائي موارد بشرية/);
});

test("حقلٌ موجودٌ لكنه فارغ الاختيار ⇒ يمرّ أيضاً", async () => {
  reset();
  subscriber = row({
    "التوطين Saudization": { type: "select", select: null },
    "الامتثال Compliance": { type: "select", select: null },
  });
  await run();
  assert.equal(calls.rank, 1, "قيمةٌ فارغة قُرئت منعاً");
});

/* ───────── ③ كل القيم الأخرى تمرّ — الحاجز قيمةٌ واحدة صريحة ───────── */
test("🔍 و⚠️ و✅ و«بحاجة فحص» تمرّ كلها، ولا يحجب إلا ⛔", async () => {
  for (const [saud, comp] of [
    ["بحاجة فحص", "🔍 بحاجة فحص"],
    ["نسبة توطين + اشتراطات", "⚠️ اشتراطات"],
    ["مسموح لغير السعوديين", "✅ مطابق"],
    ["مقصورة على السعوديين", "✅ مطابق"],   // سعوديٌّ على مهنةٍ مقصورة
  ]) {
    reset();
    subscriber = row({ "التوطين Saudization": sel(saud), "الامتثال Compliance": sel(comp) });
    const { data } = await run();
    assert.equal(calls.rank, 1, `حُجب مرشّحٌ امتثاله «${comp}» — والحاجز قيمةٌ واحدة لا فئة`);
    assert.equal(data.report[0].matches, 1);
  }
});

test("blockedBySaudization: القيمة الواحدة تحجب، وما عداها لا", () => {
  assert.equal(blockedBySaudization({ compliance: BLOCKED }), true);
  for (const c of ["", "🔍 بحاجة فحص", "⚠️ اشتراطات", "✅ مطابق", undefined, null]) {
    assert.equal(blockedBySaudization({ compliance: c }), false, `حجبت «${c}»`);
  }
  assert.equal(blockedBySaudization({}), false);
  assert.equal(blockedBySaudization(null), false);
});

/* ───────── ④ ما قُرئ يُستعمل فعلاً في نصّ المطابقة ───────── */
test("التوطين والامتثال يصلان المطابق في نصّ الملف", async () => {
  reset();
  subscriber = row({
    "التوطين Saudization": sel("نسبة توطين + اشتراطات"),
    "الامتثال Compliance": sel("⚠️ اشتراطات"),
    "حالة الإقامة": sel("مقيم بإقامة نظامية قابلة للنقل"),
  });
  await run();

  assert.match(rankProfile, /نسبة توطين \+ اشتراطات/, "التوطين قُرئ ولم يُستعمل — قراءةٌ بلا أثر");
  assert.match(rankProfile, /⚠️ اشتراطات/);
  assert.match(rankProfile, /حالة الإقامة/, "انقطع ما كان يقرؤه الوكيل أصلاً");
  // ولا رقم ولا نسبة ولا قرار يُختلق في النصّ المُرسل.
  assert.ok(!/قرار|المادة|اللائحة/.test(rankProfile), "مرجعٌ نظامي مُختلق في نصّ المطابقة");
});

/* ───────── ⑤ النصّ الحرفي واحدٌ في الملفين ───────── */
test("قيمة الحجب نفسها حرفاً بحرف في api/candidate.js (الكاتب) و_jobhunt.js (القارئ)", () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), "api", f), "utf8");
  const grab = (src) => {
    const m = src.match(/const COMP_BLOCKED = "([^"]+)"/);
    return m ? m[1] : "";
  };
  const writer = grab(read("candidate.js"));
  const reader = grab(read("_jobhunt.js"));
  assert.ok(writer, "COMP_BLOCKED غير موجودة في api/candidate.js");
  assert.equal(reader, writer, "النصّان اختلفا — الحاجز مفتوحٌ بصمت");
  assert.equal(reader, BLOCKED);
  // وهي فعلاً من قائمة الامتثال المعتمدة في القاعدة، لا قيمةٌ خامسة.
  assert.ok(read("candidate.js").includes(`COMP_VALUES = ["✅ مطابق", "${BLOCKED}"`),
    "القيمة ليست من قائمة الامتثال المخزّنة");
});
