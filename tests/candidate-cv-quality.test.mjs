// جودة نصّ السيرة وقراءة العربية في مدخل المرشّح  (api/candidate.js)
//
// شغّله: npm test
//
// قياس 2026-10-01 على القاعدة الحقيقية (٢٦٤٦١ صفاً، ١٨٣٢٩ منها «مكتمل»):
//   • ١١٢٤ صفاً «مكتمل» بلا نصّ أصلاً، و٢٢٣ صفاً نصّه دون ٣٠٠ حرف — وعيّنةٌ منها
//     (١٧ صفاً) كلها هيكلٌ فارغ: عناوين «## الخبرات / ## التعليم» بلا سطرٍ تحتها.
//   • n8n لا يفحص النصّ إلا بـ`length < 30`، فيمرّ نصّ PDF رديءٌ إلى النموذج
//     ويعود هيكلاً، وتُكتب «مكتمل».
//   • الأرقام الهندية (٥ سنوات / ٨٬٠٠٠) كانت تُقرأ صفراً/فراغاً لأن `\d` لاتينيةٌ.
//   • تقديمٌ ثانٍ بلا مدينةٍ ولا خبرة كان يمحو المدينة والسنوات المستخرجتين.
//   • رابط لينكدإن يُلصق في «Skills» فيُعرض مهارةً (٣١٦ صفاً).
//
// الحمولات هنا مصنوعةٌ على شكل الصفوف الحقيقية، بلا اسمٍ ولا بريدٍ ولا جوالٍ حقيقي.
// بلا شبكة: أي نداء إلى غير نوشن/n8n/أزور يرمي.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cv-quality-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.N8N_ATS_WEBHOOK = "https://n8n.test/webhook/bp-ats-application";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
delete process.env.AZURE_DOCINTEL_ENDPOINT;
delete process.env.AZURE_DOCINTEL_KEY;
delete process.env.AZURE_OPENAI_ENDPOINT_2;
delete process.env.RESEND_API_KEY;
delete process.env.PANEL_KEY;
delete process.env.LEADS_KEY;

const ATS_DB = "71792742873e4de398135c7855542b95";

const GOOD_AR = [
  "# مرشح تجريبي", "", "## التواصل", "- **البريد الإلكتروني:** t@example.com", "- **الهاتف:** 0500000000", "",
  "## ملخص", "محاسب بخبرة خمس سنوات في الحسابات الدائنة وإعداد القوائم المالية.", "",
  "## المهارات", "- الحسابات الدائنة", "- إعداد الميزانيات", "",
  "## الخبرات", "- **محاسب** في شركة المثال (2019 - الحاضر)", "  - إعداد القوائم الشهرية.", "",
  "## التعليم", "- **بكالوريوس** في المحاسبة، جامعة الملك سعود", "",
  "## اللغات", "- العربية", "- الإنجليزية",
].join("\n");

const GOOD_EN = [
  "# Test Candidate", "", "## Contact Information", "- **Email:** t@example.com", "- **Phone:** +966500000000", "",
  "## Summary", "Logistics coordinator with six years of experience in warehouse and shipping operations.", "",
  "## Skills", "- SAP", "- Inventory management", "",
  "## Work Experience", "### Logistics Coordinator", "**Example Logistics Co.**  ", "*2018 - Present*", "- Coordinated inbound shipments.", "",
  "## Education", "- **Bachelor of Science** in Supply Chain, Example University", "",
  "## Languages", "- Arabic", "- English",
].join("\n");

// هياكل فارغة بالشكل الذي ردّ به النموذج على صفوفٍ حقيقية.
const SKELETON_HEADINGS = [
  "# مرشح تجريبي", "", "## التواصل", "- **البريد الإلكتروني:** t@example.com", "",
  "## ملخص", "", "## المهارات", "", "## الخبرات", "", "## التعليم", "", "## اللغات", "", "## الشهادات",
].join("\n");
const SKELETON_EDU_ONLY = SKELETON_HEADINGS.replace("## التعليم\n", "## التعليم\n- دبلوم من الكلية التقنية\n");

/* ───────────────────────────── الدوال الصِرفة ───────────────────────────── */
const mod = await import("../api/candidate.js");

test("الأرقام الهندية والفارسية وفاصل الآلاف العربي إلى لاتينية", () => {
  assert.equal(mod.toLatinDigits("٥ سنوات"), "5 سنوات");
  assert.equal(mod.toLatinDigits("۱۲ years"), "12 years");
  assert.equal(mod.toLatinDigits("٨٬٠٠٠"), "8,000");
  assert.equal(mod.toLatinDigits("٣٫٥"), "3.5");
  assert.equal(mod.toLatinDigits(null), "");
});

test("normalizeCvText: أشكال العرض ترجع حروفاً أصلاً، وتُنزع علامات الاتجاه والكشيدة", () => {
  // «\uFEE3\uFEA4\uFEE4\uFEAA» بأشكال العرض (ما يُخرجه استخراج PDF بالترتيب البصري) ⇒ «محمد»
  assert.equal(mod.normalizeCvText("\uFEE3\uFEA4\uFEE4\uFEAA"), "محمد");
  assert.equal(mod.normalizeCvText("\uFDF2"), "الله");
  assert.equal(mod.normalizeCvText("خبرة: ٢٠٢١\u200F"), "خبرة: 2021");
  assert.equal(mod.normalizeCvText("الســـلام"), "السلام");
  assert.equal(mod.normalizeCvText("a\n\n\n\nb"), "a\n\nb");
  // فاصلُ السطر في ماركداون (مسافتان في آخره) يبقى كما هو — لا نغيّر ما لم نُسأل عنه.
  assert.equal(mod.normalizeCvText("a  \nb"), "a  \nb");
});

test("cvTextQuality: السيرة العربية والإنجليزية الحقيقية تُقبل", () => {
  assert.deepEqual(mod.cvTextQuality(GOOD_AR).ok, true);
  assert.deepEqual(mod.cvTextQuality(GOOD_EN).ok, true);
  assert.ok(mod.cvTextQuality(GOOD_AR).substance >= mod.CV_MIN_SUBSTANCE);
});

test("cvTextQuality: الهيكل الفارغ يُرفض سبباً «skeleton» لا «empty»", () => {
  const a = mod.cvTextQuality(SKELETON_HEADINGS);
  assert.equal(a.ok, false);
  assert.equal(a.reason, "skeleton");
  const b = mod.cvTextQuality(SKELETON_EDU_ONLY);
  assert.equal(b.ok, false, "سطرُ تعليمٍ واحد لا يجعل الهيكل سيرة");
  assert.equal(b.reason, "skeleton");
  // وما دون أربعين حرفاً «empty» كما كان.
  assert.equal(mod.cvTextQuality("# اسم").reason, "empty");
});

test("cvTextQuality: بيانات الاتصال وسطور اللغات لا تُحسب مضموناً", () => {
  const onlyContact = "# مرشح\n\n## التواصل\n- **البريد الإلكتروني:** someone@example.com\n- **الهاتف:** 0500000000\n- **المدينة:** الرياض\n\n## اللغات\n- العربية (اللغة الأم)\n- الإنجليزية (جيد)\n";
  const q = mod.cvTextQuality(onlyContact);
  assert.equal(q.ok, false);
  assert.ok(q.substance < 20, "حُسب الاتصال/اللغات مضموناً: " + q.substance);
});

test("cvTextQuality: حروف ليست عربية ولا لاتينية بنسبة عالية ⇒ garbled", () => {
  const cyrillic = "Опыт работы менеджером по продажам в крупной компании. Образование высшее. Навыки переговоров и ведения документации. " + "я".repeat(60);
  const q = mod.cvTextQuality(cyrillic);
  assert.equal(q.ok, false);
  assert.equal(q.reason, "garbled");
  const repl = "x".repeat(40) + "\uFFFD\uFFFD\uFFFD\uFFFD" + "y".repeat(40);
  assert.equal(mod.cvTextQuality(repl).reason, "garbled");
});

test("cvTextQuality: سنواتٌ معكوسة (3102) بلا عامٍ سليم ⇒ garbled؛ ومعها عامٌ سليم لا", () => {
  const rev = "# مرشحة\n\n## الخبرات\n- مستشفى المثال *من 02/10/3102 إلى 10/10/4102* إدارة المرافق وخدمة العملاء والتنسيق\n## التعليم\n- بكالوريوس قانون مع مرتبة الشرف جامعة الملك سعود";
  assert.equal(mod.cvTextQuality(rev).reason, "garbled");
  const mixed = rev + "\n- شركة أخرى 2021";
  assert.equal(mod.cvTextQuality(mixed).ok, true, "عامٌ سليم في النصّ يُسقط الحكم بالعكس");
});

test("cvTextQuality: سيرةٌ رقيقة لكن فيها مضمون تُقبل (لا نرفض مرشّحاً ضعيفاً، نرفض الفارغ)", () => {
  const thin = [
    "# Test C", "", "## Contact Information", "- **Email:** t@example.com", "",
    "## Summary", "Hello, my name is Test. I am 32 years old.", "", "## Skills", "",
    "## Experience", "- **Cashier** at Example Restaurant, Example Retail Pvt Ltd (12/2020 - 12/2020)", "",
    "## Education", "- **Commerce** from Example University", "", "## Languages", "- العربية", "- الإنجليزية",
  ].join("\n");
  assert.equal(mod.cvTextQuality(thin).ok, true);
});

/* ───────────────────────── المعالج الحقيقي، بلا شبكة ───────────────────────── */
let n8nReply = null;
let azureText = null;       // ما يُرجعه أزور على قراءة السيرة
let calls = { n8n: 0, cvRead: 0 };
let created = null, patched = null, existingRow = null;

const reset = () => {
  calls = { n8n: 0, cvRead: 0 };
  created = patched = existingRow = null;
  n8nReply = null;
  azureText = GOOD_AR;
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};
  if (u.startsWith("https://n8n.test/")) {
    calls.n8n += 1;
    if (n8nReply === "abort") throw new DOMException("The operation was aborted", "AbortError");
    return json(n8nReply || {});
  }
  if (u.startsWith("https://azure.test/")) {
    const sent = JSON.stringify(body);
    if (sent.includes("cv_markdown")) {
      calls.cvRead += 1;
      return json({ choices: [{ message: { content: JSON.stringify({ cv_markdown: azureText }) }, finish_reason: "stop" }] });
    }
    // تحسين السيرة / التوطين: ردٌّ فارغ — لا يعنينا هنا.
    return json({ choices: [{ message: { content: "{}" } }], finish_reason: "stop" });
  }
  if (u.startsWith("https://api.notion.com/v1/databases/")) {
    assert.ok(u.includes(ATS_DB), "استعلامٌ على قاعدة غير قاعدة المرشحين: " + u);
    return json({ results: existingRow ? [existingRow] : [], has_more: false });
  }
  if (u === "https://api.notion.com/v1/pages" && init.method === "POST") { created = body.properties; return json({ id: "11111111-2222-3333-4444-555555555555" }); }
  if (u.startsWith("https://api.notion.com/v1/pages/") && init.method === "PATCH") { patched = body.properties; return json({ id: "patched" }); }
  if (u.startsWith("https://api.notion.com/v1/pages/") && (init.method || "GET") === "GET") return json({}, 404);
  throw new Error("no network in tests: " + u);
};

const handler = mod.default;
function invoke(payload) {
  let out = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
  return handler({ method: "POST", url: "/api/candidate", headers: {}, body: payload, on() {} }, res)
    .then(() => ({ status: status || 200, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}
const pngCv = () => ({ name: "cv.png", type: "image/png", size: 500, base64: Buffer.from("\x89PNG" + "x".repeat(400)).toString("base64") });
const base = (extra = {}) => ({
  name: "مرشح تجريبي", phone: "0500000009", email: "t@example.com",
  field: "محاسب", jobId: "candidate-pool", jobTitle: "General candidate pool", consent: true, ...extra,
});
const val = (props, key) => {
  const p = props && props[key];
  if (!p) return "";
  if (p.select) return p.select.name;
  if (p.rich_text) return p.rich_text.map((t) => t.text.content).join("");
  if (p.number != null) return p.number;
  return "";
};

test("n8n يردّ بهيكلٍ فارغ + ملفٌ مرفوع ⇒ يُرفض الهيكل ويُجرَّب الاحتياطي ويُكتب نصّه", async () => {
  reset();
  n8nReply = { ai: { ats_cv_markdown: SKELETON_HEADINGS } };
  const { status, data } = await invoke(base({ cvFile: pngCv() }));
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(calls.cvRead, 1, "الهيكل مرّ كأنه سيرة ولم يُجرَّب الاحتياطي");
  assert.ok(val(created, "ATS CV Text").includes("جامعة الملك سعود"), "نصّ الاحتياطي لم يُكتب");
  assert.ok(!val(created, "ATS CV Text").includes("## الشهادات"), "بقي الهيكل في الصفّ");
  assert.equal(val(created, "حالة القراءة"), "مكتمل");
  assert.match(val(created, "سبب عدم الاكتمال"), /n8n/);
});

test("n8n يردّ بهيكلٍ فارغ بلا ملف ⇒ لا «ATS CV Text» ولا «مكتمل»، والسبب صادق", async () => {
  reset();
  n8nReply = { ai: { ats_cv_markdown: SKELETON_EDU_ONLY } };
  const { status, data } = await invoke(base());
  assert.equal(status, 200, "سقط الطلب لأجل سيرة لا مضمون فيها");
  assert.equal(data.ok, true);
  assert.equal(calls.cvRead, 0, "لا ملف ⇒ لا نداء قراءة");
  assert.equal(val(created, "ATS CV Text"), "", "الهيكل كُتب في ATS CV Text فسيُعرض لصاحب العمل");
  assert.ok(!("ATS CV Text" in created), "الخاصية نفسها يجب ألا تُرسَل");
  assert.equal(val(created, "حالة القراءة"), "ناقص - بيانات غير كافية");
  assert.match(val(created, "سبب عدم الاكتمال"), /هيكلٌ بلا مضمون/, "السبب لا يقول إنه هيكل");
});

test("الاحتياطي نفسه يردّ هيكلاً ⇒ يُوسم ولا يُكتب نصّه", async () => {
  reset();
  n8nReply = "abort";
  azureText = SKELETON_HEADINGS;
  const { data } = await invoke(base({ cvFile: pngCv() }));
  assert.equal(data.ok, true);
  assert.equal(calls.cvRead, 1);
  assert.ok(!("ATS CV Text" in created));
  assert.equal(val(created, "حالة القراءة"), "ناقص - بيانات غير كافية");
});

test("نصّ n8n بأشكال العرض والأرقام الهندية يُكتب مطبَّعاً", async () => {
  reset();
  const pres = GOOD_AR.replace("محاسب بخبرة", "\uFEE3\uFEA4\uFEE4\uFEAA بخبرة").replace("2019", "٢٠١٩");
  n8nReply = { ai: { ats_cv_markdown: pres } };
  await invoke(base());
  const written = val(created, "ATS CV Text");
  assert.ok(written.includes("محمد بخبرة"), "أشكال العرض لم تُرجَع حروفاً: " + written.slice(0, 160));
  assert.ok(written.includes("2019") && !written.includes("٢٠١٩"), "الأرقام الهندية بقيت");
  assert.equal(val(created, "حالة القراءة"), "مكتمل");
});

test("نصّ n8n الجيّد (إنجليزي) يمرّ كما هو ولا يُنادى الاحتياطي", async () => {
  reset();
  n8nReply = { ai: { ats_cv_markdown: GOOD_EN } };
  await invoke(base({ cvFile: pngCv() }));
  assert.equal(calls.cvRead, 0);
  assert.equal(val(created, "ATS CV Text"), GOOD_EN);
  assert.equal(val(created, "حالة القراءة"), "مكتمل");
});

test("الخبرة والراتب بأرقامٍ هندية تُقرآن لا تُصفَّران", async () => {
  reset();
  await invoke(base({ experience: "٥ سنوات", salary: "٨٬٠٠٠ – ١٢٬٠٠٠" }));
  assert.equal(val(created, "Experience Years"), 5);
  assert.equal(val(created, "Expected Salary"), 8000);
});

test("لينكدإن لا يُكتب مهارةً بل في الملاحظات", async () => {
  reset();
  await invoke(base({ linkedin: "https://www.linkedin.com/in/test-user" }));
  assert.ok(!/linkedin/i.test(val(created, "Skills")), "رابط لينكدإن في Skills: " + val(created, "Skills"));
  assert.equal(val(created, "Skills"), "محاسب");
  assert.match(val(created, "Notes"), /لينكدإن: https:\/\/www\.linkedin\.com\/in\/test-user/);
});

test("تقديمٌ ثانٍ بلا مدينةٍ ولا خبرة لا يمحو ما في الصفّ، ولا تُستبدل مهاراته", async () => {
  reset();
  existingRow = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    properties: {
      City: { type: "rich_text", rich_text: [{ plain_text: "الرياض" }] },
      Skills: { type: "rich_text", rich_text: [{ plain_text: "SAP، إكسل" }] },
      "Experience Years": { type: "number", number: 7 },
    },
  };
  const { data } = await invoke(base());
  assert.equal(data.updated, true);
  assert.ok(patched, "لم يُكتب تحديث");
  assert.ok(!("City" in patched), "كُتبت مدينةٌ فارغة فوق مدينة الصفّ");
  assert.ok(!("Experience Years" in patched), "كُتب صفرٌ فوق سنوات الخبرة");
  assert.ok(!("Skills" in patched), "استُبدلت مهارات الصفّ بنصّ المسمّى");
});

test("تقديمٌ ثانٍ يذكر مدينةً وخبرة ⇒ تُحدَّثان", async () => {
  reset();
  existingRow = { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", properties: {} };
  await invoke(base({ city: "جدة", experience: "٣ سنوات" }));
  assert.equal(val(patched, "City"), "جدة");
  assert.equal(val(patched, "Experience Years"), 3);
  assert.equal(val(patched, "Skills"), "محاسب", "صفٌّ بلا مهارات: المسمّى يُكتب كما كان");
});
