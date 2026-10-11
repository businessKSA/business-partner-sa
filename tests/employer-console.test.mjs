// لوحة صاحب العمل — من يرى متقدّمي من؟  (api/candidates.js, ?applicants=1)
//
// شغّله: npm test
//
// ما الذي يُثبَّت هنا، ولماذا كلٌّ منه يستحقّ اختباراً:
//
// نقطة النهاية هذه تعيد **بيانات شخصية**: اسم المرشّح وجوّاله وبريده ومدينته
// وجنسيته ورابط سيرته. وكانت تمشي على قاعدة المرشحين كلها ثم تعيد كل مجموعة
// وجدتها بلا أي شرطٍ على مالك الإعلان — فأيّ رمزٍ مفعّل (بل أيّ عميلٍ مسجّل،
// لأن BP_OPEN_ACCESS يفتح اللوحة لكل جلسة) كان يرى متقدّمي **كل** أصحاب
// العمل. جارُها list-postings كان يفلتر على «رمز صاحب العمل» منذ اليوم الأول،
// فالفارق لم يكن قراراً بل سطراً غائباً — وبقي صامتاً لأن لا شيء يقيسه.
//
// ولهذا الاختبار وجهان متساويان في الأهمية:
//   ① ألا يرى صاحب عملٍ متقدّماً ليس لإعلانه.
//   ② ألا يسقط متقدّمٌ **حقيقي** لإعلانٍ **حقيقي**. فالتشديد الذي يُسقط
//      تقديماً وصل فعلاً هو عطلٌ آخر بلبوس إصلاح، وهذه أسهل طريقة لصنعه:
//      ختم التقديم يحمل ما كان في `?id=` بالرابط، ونوشن يقبل معرّف الصفحة
//      بشرطاته وبلا شرطاته وبأي حالة أحرف — ومنها صفوفٌ قديمة ختمها في Notes.
//
// وكلاهما يُقاس على `handler` الحقيقي: الجلسة تُقرأ من api/_db.js فعلاً
// (LOCAL_DB=1 → ملف JSON مؤقّت)، ونوشن وحده هو المُحاكى. بلا شبكة، وبلا
// NOTION_TOKEN حقيقي: كل fetch إلى غير api.notion.com يرمي.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------- الجلسة --
// قاعدة محلية مؤقّتة تحت tmp، لا تحت .localdb المشتركة مع npm run dev.
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-employer-console-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
const SID = { owner: "sid-owner", employer: "sid-employer", client: "sid-client" };

const OWNER_EMAIL = "dr.baher.magnas@gmail.com";
const EMPLOYER_EMAIL = "mohammed@example.com";
const CLIENT_EMAIL = "client@example.com";

fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-owner", email: OWNER_EMAIL, full_name: "المالك", locale: "ar" },
    { id: "u-emp", email: EMPLOYER_EMAIL, full_name: "محمد", locale: "ar" },
    { id: "u-cli", email: CLIENT_EMAIL, full_name: "عميل", locale: "ar" },
  ],
  organizations: [
    { id: "org-owner", name_ar: "بيزنس بارتنر", created_at: new Date().toISOString() },
    { id: "org-emp", name_ar: "شركة محمد", created_at: new Date().toISOString() },
    { id: "org-cli", name_ar: "شركة العميل", created_at: new Date().toISOString() },
  ],
  user_sessions: [
    { id: "s1", user_id: "u-owner", organization_id: "org-owner", token_hash: sha(SID.owner), revoked_at: null, expires_at: future },
    { id: "s2", user_id: "u-emp", organization_id: "org-emp", token_hash: sha(SID.employer), revoked_at: null, expires_at: future },
    { id: "s3", user_id: "u-cli", organization_id: "org-cli", token_hash: sha(SID.client), revoked_at: null, expires_at: future },
  ],
}, null, 2));

// تُضبط قبل الاستيراد: الوحدتان تقرآن البيئة وقت التحميل لا وقت النداء.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.OWNER_EMAIL = OWNER_EMAIL;
// رمز التجربة البيئي يفتح كل شيء — لا يُترك مضبوطاً في اختبارٍ عن الصلاحيات.
delete process.env.OWNER_DEMO_CODE;
delete process.env.EMPLOYER_CODES;

// ------------------------------------------------------------ نوشن مُحاكى --
const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";   // أصحاب العمل — الاشتراكات
const JOBS_DB = "260d76959d464631943f79f313fbf3c9";  // الإعلانات
const ATS_DB = "71792742873e4de398135c7855542b95";   // قاعدة المرشحين
const METRICS_DB = "245f3a1ffb1844b19707bb67120b9605"; // عدّاد القاعدة المخزَّن (يوميّ)
let metricRow = null;

const OWNER_ACCESS_CODE = "BP-EMP-MYTD63BKZAPB";
const EMPLOYER_ACCESS_CODE = "BP-EMP-NKATJ6ZKX7HH";

const ti = (s) => ({ type: "title", title: s ? [{ plain_text: String(s) }] : [] });
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: String(s) }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const em = (s) => ({ type: "email", email: s || null });
const ph = (s) => ({ type: "phone_number", phone_number: s || null });
const cb = (v) => ({ type: "checkbox", checkbox: !!v });

const EMP_ROWS = [
  { id: "emp-owner", created_time: "2026-01-01T00:00:00.000Z", properties: {
    "اسم الشركة": ti("Business Partner — المالك (Owner)"), "البريد": em(OWNER_EMAIL),
    "الحالة": se("مفعّل"), "الباقة": se("مؤسسية"), "رمز الوصول": rt(OWNER_ACCESS_CODE),
  } },
  { id: "emp-mohammed", created_time: "2026-02-01T00:00:00.000Z", properties: {
    "اسم الشركة": ti("شركة محمد"), "البريد": em(EMPLOYER_EMAIL),
    "الحالة": se("مفعّل"), "الباقة": se("احترافية"), "رمز الوصول": rt(EMPLOYER_ACCESS_CODE),
  } },
];

// معرّفات صفحات نوشن كما يكتبها: ٣٢ خانة ستّ عشرية بأربع شرطات.
const OWNER_JOB_ID = "11111111-aaaa-2222-bbbb-333333333333";
const EMPLOYER_JOB_ID = "99999999-cccc-8888-dddd-777777777777";

const job = (id, title, code, { field = "موارد بشرية", desc = "وصف" } = {}) => ({ id, created_time: "2026-09-10T08:00:00.000Z", properties: {
  "العنوان الوظيفي": ti(title), "رمز صاحب العمل": rt(code), "المدينة": rt("الرياض"),
  "المجال": se(field), "الوصف والمتطلبات": rt(desc), "الحالة": se("نشطة"),
} });
const JOB_ROWS = [
  job(OWNER_JOB_ID, "إعلان المالك", OWNER_ACCESS_CODE),
  // إعلان محمد له معايير حتمية: مجالٌ منظَّم، وحدٌّ أدنى للخبرة في وصفه نصّاً.
  job(EMPLOYER_JOB_ID, "إعلان محمد", EMPLOYER_ACCESS_CODE, { field: "محاسبة ومالية", desc: "مطلوب محاسب بخبرة خمس سنوات خبرة في المحاسبة." }),
];

// المتقدّمون، مختومون كما يختمهم api/candidate.js: "العنوان (المعرّف)" في
// «الوظيفة المتقدم لها»، وللصفوف القديمة السطر نفسه داخل Notes.
// ⚠️ نصّ السيرة يمرّ بفحص الجودة (cvTextQuality: ستّون حرفاً من المضمون على الأقل خارج
// العناوين) — ما دونه «هيكل فارغ» غير مقروء. فكل سيرةٍ هنا تحمل فقرةً حقيقية.
const FILL = "إدارة شؤون الموظفين ومتابعة عقود العمل وإجراءات التأمينات الاجتماعية والتوطين لدى شركات متوسطة الحجم في المملكة.";
const ATS_ROWS = [];
const nu = (n) => ({ type: "number", number: typeof n === "number" ? n : null });
const ur = (s) => ({ type: "url", url: s || null });

const applicant = (name, phone, stampTitle, stampId, { legacy = false, extra = null, notes = "" } = {}) => {
  const line = `تقديم عبر الموقع — الوظيفة: ${stampTitle} (${stampId})`;
  ATS_ROWS.push({ id: `cand-${ATS_ROWS.length + 1}`, created_time: "2026-09-12T00:00:00.000Z", properties: {
    "Candidate Name": ti(name), "Phone": ph(phone), "Email": em(`${phone}@example.com`),
    "City": rt("الرياض"), "Nationality Type": se("سعودي"), "Pipeline Stage": se("جديد"),
    "مخفي عن الموقع": cb(false),
    // «المقروء» (2026-10-01): حالة القراءة «مكتمل» ونصّ ATS في الحقل. وما سواهما
    // يختفي — له قسمه أدناه (الصفوف غير المقروءة).
    "حالة القراءة": se("مكتمل"), "ATS CV Text": rt("سيرة مقروءة. " + FILL),
    "الوظيفة المتقدم لها": rt(legacy ? "" : `${stampTitle} (${stampId})`),
    "Notes": rt(legacy ? line : (notes || "تقديم عبر الموقع")),
    ...(extra || {}),
  } });
  return name;
};

// متقدّمو المالك — هؤلاء بالضبط هم من كان محمد يراهم.
const OWNERS_OWN = [
  applicant("مرشّح المالك الأول", "0500000001", "إعلان المالك", OWNER_JOB_ID),
  applicant("مرشّح المالك الثاني", "0500000002", "إعلان المالك", OWNER_JOB_ID),
];
// متقدّمو محمد الأربعة — وثلاثةٌ منهم مختومون بأشكالٍ يسهل أن يُسقطها تشديدٌ
// ساذج: معرّفٌ بلا شرطات، معرّفٌ بأحرفٍ كبيرة، وصفٌّ قديمٌ ختمه في Notes.
// والترتيب مقصود: الختم غير القياسي **أولاً**، لأن معرّف المجموعة يُؤخذ من
// أول صفٍّ يصل. فلو أُخذ من الختم بدل صفّ الإعلان في نوشن، لحمل المجموعةَ
// معرّفٌ بلا شرطات لا تطابقه اللوحة، وتُعرض «٠ متقدّم» على إعلانٍ له أربعة.
const EMPLOYERS_OWN = [
  applicant("مرشّح محمد — معرّف بلا شرطات", "0510000001", "إعلان محمد", EMPLOYER_JOB_ID.replace(/-/g, "")),
  applicant("مرشّح محمد — معرّف بأحرف كبيرة", "0510000002", "إعلان محمد", EMPLOYER_JOB_ID.toUpperCase()),
  applicant("مرشّح محمد — ختمٌ قياسي", "0510000003", "إعلان محمد", EMPLOYER_JOB_ID),
  applicant("مرشّح محمد — صفٌّ قديم مختوم في Notes", "0510000004", "إعلان محمد", EMPLOYER_JOB_ID, { legacy: true }),
];

// ── صفوفٌ لمسار ملفّ المتقدّم الواحد (?applicant=1&id=…) ──────────────────
// الحقول الأربعة الجديدة في القاعدة («درجة المطابقة» ومبرّرها، والتوطين
// والامتثال) فارغةٌ فعلاً على كل متقدّمي الموقع اليوم (٠ من ١١٧)، فالحالتان
// تُمثَّلان هنا كلتاهما: صفٌّ مملوء وصفٌّ فارغ.
const CV_TEXT_FULL = "# سعود العتيبي\n\n## الخبرة\n- أخصائي موارد بشرية — **خمس سنوات**\n- " + FILL + "\n\n## التعليم\n- بكالوريوس إدارة أعمال";
// سيرةٌ فيها وسم سكربت: تُعاد من الخادم كما هي (هو لا يبني HTML)، والواجهة
// هي التي تهرّبها. الصفّ موجود كي يُقاس الهرب على المولَّد فعلاً.
const CV_TEXT_XSS = "# <script>alert('xss')</script>\n\n- <img src=x onerror=alert(1)>\n- " + FILL;
const RICH = applicant("مرشّح محمد — ملفٌّ مكتمل", "0510000005", "إعلان محمد", EMPLOYER_JOB_ID, { extra: {
  "ATS CV Text": rt(CV_TEXT_FULL),
  "CV Link": ur("https://drive.google.com/file/d/ORIGINAL_FILE/view"),
  "ATS CV (Drive)": ur("https://docs.google.com/document/d/ATS_DOC/edit"),
  "درجة المطابقة": nu(82),
  "مبرر الدرجة": rt("خبرة مطابقة في المجال نفسه، والمدينة نفسها."),
  "الوظيفة المُقيَّم عليها": rt(`إعلان محمد (${EMPLOYER_JOB_ID})`),
  "تاريخ التقييم": { type: "date", date: { start: "2026-09-20" } },
  "التوطين Saudization": se("مسموح لغير السعوديين"),
  "الامتثال Compliance": se("✅ مطابق"),
  "تفاصيل التوطين": rt("المهنة مفتوحة، ولا اشتراط جنسية عليها."),
} });
const XSS = applicant("مرشّح محمد — سيرةٌ فيها وسم سكربت", "0510000006", "إعلان محمد", EMPLOYER_JOB_ID, {
  extra: { "ATS CV Text": rt(CV_TEXT_XSS) },
});
// مقروءٌ بنصٍّ مختصر، لكن بلا ملف ولا درجة ولا توطين.
const BARE = applicant("مرشّح محمد — لا سيرة ولا درجة", "0510000007", "إعلان محمد", EMPLOYER_JOB_ID);
// درجةٌ قديمة مكتوبةً نصّاً في Notes وحدها: الحقل الرقمي أُضيف فارغاً، فلو
// استُبدل الاحتياطي لاختفت كل درجةٍ معروضة اليوم.
const LEGACY_SCORE = applicant("مرشّح محمد — درجةٌ في Notes وحدها", "0510000008", "إعلان محمد", EMPLOYER_JOB_ID, {
  notes: "تقديم عبر الموقع — score 64/100 من الفرز الآلي",
});
EMPLOYERS_OWN.push(RICH, XSS, BARE, LEGACY_SCORE);

// متقدّمٌ **على إعلان المالك** وله سيرةٌ كاملة — هو مقياس التسريب في المسار
// الجديد: محمد يعرف معرّفه (أو يخمّنه) ويسأل عنه مباشرةً، فيجب ألا يصله حرف.
const STRANGER_CV = "# سرّ لا يراه محمد\n\n- بيانات مرشّح صاحب عملٍ آخر\n- " + FILL;
const STRANGER = applicant("مرشّح المالك — ملفٌّ مكتمل", "0500000003", "إعلان المالك", OWNER_JOB_ID, { extra: {
  "ATS CV Text": rt(STRANGER_CV),
  "CV Link": ur("https://drive.google.com/file/d/STRANGER_FILE/view"),
  "درجة المطابقة": nu(91),
} });
OWNERS_OWN.push(STRANGER);
// السيرة تُكتب غالباً في **جسم صفحة** المرشّح لا في الحقل (صفٌّ واحد من
// ٢٦٤١٩ يحمل الحقل مملوءاً)، فالاحتياطي هو المسار الحقيقي لا الاستثناء.
// حقل ATS فارغ والسيرة في الجسم وحده ⇒ غير مقروء ⇒ يختفي (لا يدخل EMPLOYERS_OWN).
const BODY_CV = applicant("مرشّح محمد — سيرته في جسم الصفحة", "0510000009", "إعلان محمد", EMPLOYER_JOB_ID, { extra: { "ATS CV Text": rt("") } });
const BODY_ROW_ID = ATS_ROWS[ATS_ROWS.length - 1].id;
const PAGE_BLOCKS = {
  [BODY_ROW_ID]: [
    { type: "heading_2", heading_2: { rich_text: [{ plain_text: "الخبرة العملية" }] } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "محاسب أول — ثلاث سنوات" }] } },
    { type: "paragraph", paragraph: { rich_text: [{ plain_text: "" }] } },
  ],
};
// ── الصفوف غير المقروءة: كلّها على إعلان محمد، وكلّها يجب أن تختفي ─────────────
// كل حالةٍ سمّاها المالك، ومعها الصفّ «مكتمل» بلا نصّ ATS (وهو الأخطر: يبدو مقروءاً
// من حالته)، والمخفي صراحةً. وأسماؤها مميّزة كي يُبحث عنها في الحمولة الخام.
const UNREADABLE = [];
const unreadable = (label, phone, status, extra) => {
  const nm = applicant(`غير مقروء — ${label}`, phone, "إعلان محمد", EMPLOYER_JOB_ID, { extra: { "حالة القراءة": se(status), ...(extra || {}) } });
  UNREADABLE.push(nm);
  return nm;
};
unreadable("PDF مصوّر", "0560000001", "غير مقروء - PDF مصور");
unreadable("فشل التحليل", "0560000002", "فشل التحليل");
unreadable("ناقص", "0560000003", "ناقص - بيانات غير كافية");
unreadable("حالة فارغة", "0560000004", "");
unreadable("مكتمل بلا نصّ ATS", "0560000005", "مكتمل", { "ATS CV Text": rt("") });
unreadable("مخفي عن الموقع", "0560000006", "مكتمل", { "مخفي عن الموقع": cb(true) });

// المتقدّم يظهر لصاحب الإعلان **دائماً** ولو لم تُقرأ سيرته (إلا إن أُخفي صراحةً):
// يوم نُشر فلتر «المقروء» اختفى ١٢٠ من ١٢١ متقدّماً حقيقياً. فهؤلاء يُعدّون هنا
// متقدّمين ظاهرين، أما قاعدة المواهب والمطابقة فتبقى على «المقروء».
const HIDDEN_NAME = "غير مقروء — مخفي عن الموقع";
const UNREAD_VISIBLE = [...UNREADABLE.filter((n) => n !== HIDDEN_NAME), BODY_CV];
const EMPLOYER_SEES = () => [...EMPLOYERS_OWN, ...UNREAD_VISIBLE];

// ما يعدّه الاختبار «مقروءاً» — مكتوبٌ هنا بيدٍ مستقلةٍ عن api/candidates.js كي لا
// يقيس الاختبار الكودَ بنفسه.
const isReadableRow = (r) => !(r.properties["مخفي عن الموقع"] || {}).checkbox
  && ((r.properties["حالة القراءة"] || {}).select || {}).name === "مكتمل"
  && rtText(r.properties["ATS CV Text"]) !== "";
// ── مرشّحو القاعدة (لا ختم تقديمٍ لهم): قاعدة المواهب ───────────────────────────
const ms = (arr) => ({ type: "multi_select", multi_select: arr.map((n) => ({ name: n })) });
const dt = (d) => ({ type: "date", date: d ? { start: d } : null });
let POOL_N = 0;
const POOL = [];
const poolRow = (label, props) => {
  POOL_N++;
  const id = `pool-${String(POOL_N).padStart(3, "0")}`;
  ATS_ROWS.push({ id, created_time: `2026-09-${String(10 + (POOL_N % 15)).padStart(2, "0")}T00:00:00.000Z`, properties: {
    "Candidate Name": ti(label), "Phone": ph(`057${String(POOL_N).padStart(7, "0")}`), "Email": em(`pool${POOL_N}@example.com`),
    "City": rt("الرياض"), "Field": se("محاسبة ومالية"), "Target Role": se("محاسب"), "Original Position": rt("محاسب أول"),
    "Skills": rt("محاسبة, إكسل, ERP"), "Experience Years": nu(6), "Education": se("بكالوريوس"),
    "Languages": ms(["العربية", "الإنجليزية"]), "Nationality Type": se("غير سعودي"), "Nationality": rt("هندي"),
    "حالة الإقامة": se("مقيم بإقامة نظامية قابلة للنقل"), "Availability": se("فوري"),
    "الامتثال Compliance": se("✅ مطابق"), "التوطين Saudization": se("مسموح لغير السعوديين"),
    "تفاصيل التوطين": rt("المهنة مفتوحة."),
    "CV Link": ur(`https://drive.google.com/file/d/${id}/view`),
    "Pipeline Stage": se("جديد"), "مخفي عن الموقع": cb(false),
    "حالة القراءة": se("مكتمل"), "ATS CV Text": rt(`سيرة ${label} — محاسب أول، خبرة ست سنوات. ${FILL}`),
    "Source": se("ترشيح"),
    "Expected Salary": nu(9000),
    ...(props || {}),
  } });
  POOL.push(label);
  return id;
};
const P_OK = [];
for (let i = 1; i <= 12; i++) P_OK.push(poolRow(`قاعدة مقروء ${i}`));
const P_WRONGFIELD = poolRow("قاعدة مجال آخر", { "Field": se("هندسة") });
const P_LOWEXP = poolRow("قاعدة خبرة قليلة", { "Experience Years": nu(2) });
const P_NOEXP = poolRow("قاعدة خبرة مجهولة", { "Experience Years": nu(null) });
const P_JEDDAH = poolRow("قاعدة من جدة", { "City": rt("جدة") });
const P_RIYADH_EN = poolRow("قاعدة Riyadh بالإنجليزية", { "City": rt("Riyadh") });
const P_SAUDI = poolRow("قاعدة سعودي", { "Nationality Type": se("سعودي"), "Nationality": rt("سعودي") });
const P_SCORED_MINE = poolRow("قاعدة مُقيَّم لإعلاني", {
  "درجة المطابقة": nu(88), "مبرر الدرجة": rt("خبرة محاسبية مطابقة تماماً للإعلان."),
  "الوظيفة المُقيَّم عليها": rt(`إعلان محمد (${EMPLOYER_JOB_ID})`), "تاريخ التقييم": dt("2026-09-30") });
const P_SCORED_OTHER = poolRow("قاعدة مُقيَّم لإعلان غيري", {
  "درجة المطابقة": nu(95), "مبرر الدرجة": rt("مبرّرٌ سرّي لصاحب عملٍ آخر."),
  "الوظيفة المُقيَّم عليها": rt(`إعلان المالك السرّي (${OWNER_JOB_ID})`), "تاريخ التقييم": dt("2026-09-29") });
// غير المقروءة في القاعدة — لا تظهر في أي مسار.
const P_BAD = [
  poolRow("قاعدة غير مقروء PDF", { "حالة القراءة": se("غير مقروء - PDF مصور") }),
  poolRow("قاعدة فشل تحليل", { "حالة القراءة": se("فشل التحليل") }),
  poolRow("قاعدة ناقص", { "حالة القراءة": se("ناقص - بيانات غير كافية") }),
  poolRow("قاعدة حالة فارغة", { "حالة القراءة": se("") }),
  poolRow("قاعدة مكتمل بلا نص", { "ATS CV Text": rt("") }),
  poolRow("قاعدة مخفي", { "مخفي عن الموقع": cb(true) }),
];
// «مكتمل» ونصّ ATS غير فارغ — لكن النصّ هيكلٌ فارغ أو مشوَّه (cvTextQuality ok=false).
// يمرّ من شروط نوشن الثلاثة، فلا يمسكه إلا فحصُ الصفّ بعد الجلب.
const SKELETON_TXT = "# الاسم\n## الخبرة العملية\n## التعليم والمؤهلات\n## المهارات\n## اللغات\n- العربية\n- الإنجليزية\nالبريد: a@b.co";
const GARBLED_TXT = "ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ṭṛṣḥ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿ ﾟ﾿";
const QUALITY_BAD = [
  poolRow("قاعدة سيرة هيكل فارغ", { "ATS CV Text": rt(SKELETON_TXT) }),
  poolRow("قاعدة سيرة مشوَّهة", { "ATS CV Text": rt(GARBLED_TXT) }),
];
P_BAD.push(...QUALITY_BAD);
const BAD_NAMES = [...UNREADABLE, ...P_BAD.map((id) => ATS_ROWS.find((r) => r.id === id).properties["Candidate Name"].title[0].plain_text)];

const idOf = (name) => (ATS_ROWS.find((r) => (r.properties["Candidate Name"].title[0] || {}).plain_text === name) || {}).id;
// تسجيلات عامة ووظائف الموقع: ليست صفوفاً في JOBS_DB ولا رمز صاحب عملٍ لها،
// فهي للمالك وحده — التسجيل في القاعدة ليس «تقدّماً على إعلان» أحد.
const SITE_OWN = [
  applicant("مرشّح القاعدة العامة", "0520000001", "قاعدة المرشحين العامة", "candidate-pool"),
  applicant("متقدّم على وظيفة الموقع", "0520000002", "أخصائي عمليات موارد بشرية", "hr-operations-specialist"),
];

// يُقلب في اختبار «الفشل المغلق» وحده.
let jobsDbFails = false;
// يُقلب في اختبار الحارس الثاني (الفحص على كل صفٍّ) وحده: المُحاكي يتجاهل الفلتر
// ويعيد كل الصفوف، كأن استعلام نوشن لم يُطبَّق، فيجب أن يمسك الكود الصفوف بنفسه.
let ignoreAtsFilter = false;
const atsLog = [];   // كل استعلامٍ وصل قاعدة المرشحين: جسمه كاملاً

const rtText = (p) => (p && p.rich_text ? p.rich_text.map((x) => x.plain_text).join("") : "");
function evalFilter(row, f) {
  if (!f) return true;
  if (f.and) return f.and.every((x) => evalFilter(row, x));
  if (f.or) return f.or.some((x) => evalFilter(row, x));
  const p = row.properties[f.property];
  if (f.checkbox) return !!(p && p.checkbox) === f.checkbox.equals;
  if (f.select) {
    const v = p && p.select ? p.select.name : null;
    if ("equals" in f.select) return v === f.select.equals;
    if ("does_not_equal" in f.select) return v !== f.select.does_not_equal;
  }
  if (f.rich_text) {
    const v = rtText(p);
    if ("is_not_empty" in f.rich_text) return v !== "";
    if ("contains" in f.rich_text) return v.toLowerCase().includes(String(f.rich_text.contains).toLowerCase());
    if ("equals" in f.rich_text) return v === f.rich_text.equals;
  }
  if (f.number) {
    const v = p && typeof p.number === "number" ? p.number : null;
    if ("greater_than_or_equal_to" in f.number) return v !== null && v >= f.number.greater_than_or_equal_to;
    if ("is_not_empty" in f.number) return v !== null;
  }
  if (f.multi_select && "contains" in f.multi_select) return !!(p && (p.multi_select || []).some((o) => o.name === f.multi_select.contains));
  throw new Error("المُحاكي لا يعرف هذا الفلتر: " + JSON.stringify(f));
}

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  // أي نداءٍ خارج نوشن يعني أن الاختبار لمس الشبكة — يُرمى، لا يُتجاهل.
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  const body = init.body ? JSON.parse(init.body) : {};
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  // ملفّ المتقدّم الواحد يقرأ صفحةً بمعرّفها، ثم كتلَ جسمها إن كان الحقل
  // فارغاً — كلاهما GET لا استعلام قاعدة، فيُخدَمان قبل مُطابِق الاستعلام.
  const bm = /\/blocks\/([^/]+)\/children/.exec(u);
  if (bm) return json({ results: PAGE_BLOCKS[decodeURIComponent(bm[1])] || [], has_more: false });
  const pm = /\/pages\/([^/?]+)$/.exec(u);
  if (pm) {
    const wanted = decodeURIComponent(pm[1]);
    const row = ATS_ROWS.find((r) => r.id === wanted) || JOB_ROWS.find((r) => r.id === wanted);
    return row ? json(row) : json({ message: "Could not find page" }, 404);
  }
  const m = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (!m) return json({}, 404);
  const db = m[1];
  const f = body.filter || {};

  if (db === EMP_DB) {
    const want = String((f.email && (f.email.equals || f.email.contains)) || "").toLowerCase();
    return json({ results: EMP_ROWS.filter((r) => (r.properties["البريد"].email || "").toLowerCase() === want), has_more: false });
  }
  if (db === JOBS_DB) {
    // 500 لا 429: ‏queryAllRows يعيد المحاولة مع انتظارٍ على 429 وحدها.
    if (jobsDbFails) return new Response('{"message":"simulated notion outage"}', { status: 500 });
    let rows = JOB_ROWS;
    if (f.property === "رمز صاحب العمل") {
      rows = rows.filter((r) => (r.properties["رمز صاحب العمل"].rich_text[0] || {}).plain_text === f.rich_text.equals);
    }
    return json({ results: rows, has_more: false });
  }
  if (db === METRICS_DB) return json({ results: metricRow ? [metricRow] : [], has_more: false });
  if (db === ATS_DB) {
    atsLog.push(body);
    // الاستعلام يُنفَّذ كما يفعل نوشن: الفلتر يُقيَّم فعلاً على الصفوف، فاختبار «يختفي
    // غير المقروء عند المصدر» يقيس شرطاً أُرسل لا وعداً. ومرشّحٌ لا يعرفه المُحاكي
    // يُرمى: فلتر جديد لا يمرّ بلا أن يعلم الاختبار.
    let rows = ignoreAtsFilter ? ATS_ROWS : ATS_ROWS.filter((r) => evalFilter(r, body.filter));
    // الترتيب بالدرجة تنازلياً (وحده يُحاكى؛ غيره يبقى بترتيب الإضافة).
    const sc = (body.sorts || [])[0];
    if (sc && sc.property === "درجة المطابقة") {
      const n = (r) => (typeof (r.properties["درجة المطابقة"] || {}).number === "number" ? r.properties["درجة المطابقة"].number : -1);
      rows = [...rows].sort((a, b) => n(b) - n(a));
    }
    const start = body.start_cursor ? Number(body.start_cursor) : 0;
    const size = body.page_size || 100;
    const slice = rows.slice(start, start + size);
    const more = start + size < rows.length;
    return json({ results: slice, has_more: more, next_cursor: more ? String(start + size) : null });
  }
  return json({ results: [], has_more: false });
};

const { default: handler } = await import("../api/candidates.js");

// ------------------------------------------------------------- الاستدعاء --
function invoke(req) {
  let body = "", status = 0;
  const res = {
    setHeader() {},
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { body = b; },
  };
  return handler(req, res).then(() => ({
    status: status || 200,
    raw: body,
    data: (() => { try { return JSON.parse(body); } catch { return null; } })(),
  }));
}
const applicantsFor = (sid) => invoke({
  method: "GET", url: "/api/candidates?applicants=1&code=self",
  headers: { cookie: `bp_sid=${sid}` }, on() {},
});
const names = (d) => (d.jobs || []).flatMap((g) => (g.applicants || []).map((a) => a.name)).sort();
const totalApplicants = (d) => (d.jobs || []).reduce((n, g) => n + (g.applicants || []).length, 0);

/* ───────────────────────────────────────────────────────────── ① الحاسمة ── */
// الاختبار الذي يستحقّ الوجود: احذف سطر الإسقاط في api/candidates.js
//   if (ownJobs && !ownJobs.has(key)) continue;
// ويجب أن يحمرّ هذا.
test("صاحب عمل عادي لا يرى إلا متقدّمي إعلاناته هو", async () => {
  const { status, data, raw } = await applicantsFor(SID.employer);
  assert.equal(status, 200);
  assert.equal(data.ok, true);

  assert.deepEqual(names(data), EMPLOYER_SEES().sort(),
    "قائمة المتقدّمين العائدة لصاحب العمل ليست متقدّمي إعلانه بالضبط");

  for (const stranger of [...OWNERS_OWN, ...SITE_OWN]) {
    assert.ok(!raw.includes(stranger), `تسرّب مرشّحٌ ليس لإعلانه: ${stranger}`);
  }
  // البيانات الشخصية نفسها، لا الأسماء فقط: جوّال مرشّح المالك يجب ألا يظهر
  // في الحمولة بأي شكل.
  assert.ok(!raw.includes("0500000001") && !raw.includes("0520000001"),
    "تسرّب جوّال مرشّحٍ لصاحب عملٍ آخر في حمولة الردّ");

  const titles = (data.jobs || []).map((g) => g.jobTitle);
  assert.deepEqual(titles, ["إعلان محمد"], "ظهرت مجموعةٌ لإعلانٍ ليس له: " + titles.join("، "));
});

/* ─────────────────────────────────── ② ما ينجو من الشرط بحقّ ── */
// الوجه الثاني: تشديدٌ يُسقط تقديماً وصل فعلاً هو عطلٌ لا إصلاح. هذه الثلاثة
// هي بالضبط ما يسقط إن قُورن المعرّف نصّاً حرفياً بدل jobKey().
test("المعرّف بلا شرطات، وبأحرف كبيرة، والصفّ القديم المختوم في Notes — كلها تصل", async () => {
  const { data } = await applicantsFor(SID.employer);
  for (const who of EMPLOYERS_OWN) {
    assert.ok(names(data).includes(who), `سقط متقدّمٌ حقيقي لإعلانٍ حقيقي: ${who}`);
  }
  assert.equal(totalApplicants(data), EMPLOYER_SEES().length);
});

test("الأشكال الثلاثة للمعرّف تندمج في مجموعةٍ واحدة بمعرّف الصفحة القانوني", async () => {
  const { data } = await applicantsFor(SID.employer);
  // مجموعتان لإعلانٍ واحد تعني أن اللوحة (jobMatch) تعدّ إحداهما صفراً ولا
  // يصل متقدّموها أبداً.
  assert.equal((data.jobs || []).length, 1, "انقسم الإعلان الواحد أكثر من مجموعة");
  assert.equal(data.jobs[0].jobId, EMPLOYER_JOB_ID,
    "معرّف المجموعة ليس معرّف الصفحة كما يكتبه نوشن: " + data.jobs[0].jobId);
});

/* ────────────────────────────────────────────── ③ الفشل المغلق ── */
test("تعذّر استعلام الملكية على نوشن يعطي 502، لا قائمةً غير مفلترة", async () => {
  jobsDbFails = true;
  try {
    const { status, data } = await applicantsFor(SID.employer);
    assert.equal(status, 502, "لم يُقفل الباب عند فشل نوشن");
    assert.equal(data.ok, false);
    assert.equal(data.error, "notion_failed");
    assert.ok(!data.jobs, "أعاد مجموعاتٍ رغم أنه لا يعرف من يملك ماذا");
  } finally {
    jobsDbFails = false;
  }
});

/* ───────────────────────────────── ④ جلسة عميلٍ مفتوحة (org:<id>) ── */
// BP_OPEN_ACCESS صحيحٌ افتراضاً، فكل عميل مسجّل تُفتح له اللوحة عبر
// portalUnlock برمز org:<id> — وهو لا يملك إعلاناً واحداً في JOBS_DB.
test("عميل بوابةٍ مسجّل (org:<id>) لا يرى متقدّم أحد", async () => {
  const { status, data } = await applicantsFor(SID.client);
  assert.equal(status, 200);
  assert.equal(data.ok, true, "الباب مفتوح له — فالمقياس هو ما يراه بعده");
  assert.equal(totalApplicants(data), 0, "رأى متقدّمين وهو لا يملك إعلاناً");
  assert.deepEqual(data.jobs, []);
});

/* ────────────────────────────────────────────── ⑤ المالك يرى الكل ── */
// ليس ثغرةً في حالته: هو مالك المنصّة، ولهذا تُدرج له SITE_ROLES وحدَه في
// list-postings. مثبَّتٌ هنا كي لا يكسر أول «تشديد» لاحقٍ لوحتَه بلا تنبيه.
test("المالك يبقى يرى كل المتقدّمين، ومنهم التسجيلات العامة ووظائف الموقع", async () => {
  const { status, data } = await applicantsFor(SID.owner);
  assert.equal(status, 200);
  // «يرى الكل» = كل متقدّمٍ غير مخفي (قُرئت سيرته أو لم تُقرأ).
  const readable = ATS_ROWS.filter((r) => !(r.properties["مخفي عن الموقع"] || {}).checkbox).filter((r) => rtText(r.properties["الوظيفة المتقدم لها"]) !== "" || rtText(r.properties["Notes"]).includes("تقديم عبر الموقع")).length;
  assert.equal(totalApplicants(data), readable,
    `المالك يرى ${totalApplicants(data)} من ${readable}`);
  for (const who of [...OWNERS_OWN, ...EMPLOYERS_OWN, ...SITE_OWN]) {
    assert.ok(names(data).includes(who), `اختفى عن لوحة المالك: ${who}`);
  }
  assert.ok((data.jobs || []).some((g) => g.jobTitle === "قاعدة المرشحين العامة"),
    "القاعدة العامة تُعرض للمالك باسمها");
});

/* ─────────────────────────────── تاريخ النشر (البند الثالث) ── */
test("list-postings يعيد posted، و?openJobs=1 يعيد postedAt", async () => {
  const lp = await invoke({
    method: "POST", url: "/api/candidates",
    headers: { cookie: `bp_sid=${SID.employer}` },
    body: { action: "list-postings", code: "self" }, on() {},
  });
  assert.equal(lp.status, 200);
  assert.equal(lp.data.postings.length, 1);
  // الاستعلام يرتّب بـ«تاريخ النشر» — إعادته هي ما يجعل عمود التاريخ ممكناً.
  assert.equal(lp.data.postings[0].posted, "2026-09-10T08:00:00.000Z");

  const oj = await invoke({ method: "GET", url: "/api/candidates?openJobs=1", headers: {}, on() {} });
  assert.equal(oj.status, 200);
  assert.ok(oj.data.jobs.length > 0);
  for (const j of oj.data.jobs) assert.equal(j.postedAt, "2026-09-10T08:00:00.000Z");
});

/* ═══════════════ ملفّ المتقدّم الواحد (?applicant=1&id=…) ═══════════════
 *
 * هذا المسار يعيد ما لا تعيده القائمة: **نصّ السيرة** ورابط الملف الأصلي.
 * فهو أوسع حمولةً وأخطر تسريباً، والفلترة نفسها (ownJobsFor) تحرسه — وهذه
 * الاختبارات هي ما يمنع أن تُنسخ في المسار الثاني ناقصةً كما غابت عن الأول.
 */
const detailFor = (sid, id) => invoke({
  method: "GET",
  url: `/api/candidates?applicant=1&code=self&id=${encodeURIComponent(id || "")}`,
  headers: { cookie: `bp_sid=${sid}` }, on() {},
});

test("⑥ صاحب عمل لا يرى نصّ سيرة مرشّحٍ ليس على إعلانه", async () => {
  const strangerId = idOf(STRANGER);
  assert.ok(strangerId, "لم يُبنَ صفّ المرشّح الغريب");
  // ويراه صاحبه فعلاً — وإلا لم يقس الاختبار حجباً بل عطلاً.
  const mine = await detailFor(SID.owner, strangerId);
  assert.equal(mine.status, 200);
  assert.ok(mine.data.candidate.cvText.includes("سرّ لا يراه محمد"));

  const { status, data, raw } = await detailFor(SID.employer, strangerId);
  assert.equal(status, 404, "فُتح ملفّ مرشّحٍ لصاحب عملٍ آخر");
  assert.equal(data.error, "not_found");
  assert.ok(!data.candidate, "أعاد ملفّاً لمرشّحٍ ليس على إعلانه");
  assert.ok(!raw.includes("سرّ لا يراه محمد"), "تسرّب نصّ سيرة مرشّحٍ لصاحب عملٍ آخر");
  assert.ok(!raw.includes("STRANGER_FILE"), "تسرّب رابط الملف الأصلي لمرشّحٍ آخر");
  assert.ok(!raw.includes("91"), "تسرّبت درجة مرشّحٍ آخر");
});

test("⑥ب عميل بوابةٍ بلا إعلان لا يفتح ملفّ أي متقدّم، وتعذّر الملكية يقفل الباب", async () => {
  const id = idOf(RICH);
  const cli = await detailFor(SID.client, id);
  assert.equal(cli.status, 404, "عميلٌ لا يملك إعلاناً فتح ملفّ متقدّم");
  assert.ok(!cli.raw.includes("سعود العتيبي"));

  jobsDbFails = true;
  try {
    const out = await detailFor(SID.employer, id);
    assert.equal(out.status, 502, "لم يُقفل الباب عند فشل استعلام الملكية");
    assert.equal(out.data.error, "notion_failed");
    assert.ok(!out.data.candidate);
  } finally { jobsDbFails = false; }
});

test("⑦ الملفّ المكتمل يعيد السيرة والملف الأصلي والدرجة والتوطين والامتثال", async () => {
  const { status, data } = await detailFor(SID.employer, idOf(RICH));
  assert.equal(status, 200);
  const c = data.candidate;
  assert.equal(c.cvText, CV_TEXT_FULL, "نصّ السيرة لم يُعَد كما هو");
  assert.equal(c.cvFrom, "field");
  assert.equal(c.cvLink, "https://drive.google.com/file/d/ORIGINAL_FILE/view");
  assert.equal(c.atsDocUrl, "https://docs.google.com/document/d/ATS_DOC/edit");
  // الدرجة من حقلها الرقمي، لا من نمطٍ نصّي في Notes.
  assert.equal(c.score, 82);
  assert.equal(c.scoreFrom, "field");
  assert.ok(c.scoreReason.includes("خبرة مطابقة"), "لم يُعَد مبرر الدرجة");
  assert.equal(c.scoredFor, `إعلان محمد (${EMPLOYER_JOB_ID})`);
  assert.equal(c.scoredAt, "2026-09-20");
  // التوطين والامتثال كما هما، بلا حسابٍ ولا نسبةٍ من عندنا.
  assert.equal(c.saudization, "مسموح لغير السعوديين");
  assert.equal(c.compliance, "✅ مطابق");
  assert.ok(c.saudizationDetails.includes("المهنة مفتوحة"));
});

test("⑧ الحقل الفارغ يعطي حالة فراغ صريحة لا خطأ", async () => {
  const { status, data } = await detailFor(SID.employer, idOf(BARE));
  assert.equal(status, 200, "الفراغ أُعيد خطأً بدل حالة فراغ");
  assert.equal(data.ok, true);
  const c = data.candidate;
  // القيم الفارغة تُعاد **قابلةً للتمييز**: لا سيرة، لا ملف، لا درجة — ولا
  // واحدةٌ منها صفرٌ ولا سلسلةٌ تُقرأ «مطابق».
  assert.equal(c.cvText, "سيرة مقروءة. " + FILL, "الصفّ المقروء يحمل نصّه دائماً");
  assert.equal(c.cvFrom, "field");
  assert.equal(c.cvLink, "");
  assert.equal(c.atsDocUrl, "");
  assert.equal(c.score, null, "الدرجة الفارغة عادت صفراً — صفرٌ درجةٌ، والفراغ ليس درجة");
  assert.equal(c.scoreFrom, "");
  assert.equal(c.saudization, "");
  assert.equal(c.compliance, "");
  assert.equal(c.saudizationDetails, "");
});

test("⑨ الدرجة القديمة في Notes تبقى تُقرأ (الحقل الرقمي فارغ في القاعدة كلها)", async () => {
  const { data } = await detailFor(SID.employer, idOf(LEGACY_SCORE));
  assert.equal(data.candidate.score, 64, "اختفت درجةٌ معروضة اليوم باستبدال الاحتياطي");
  assert.equal(data.candidate.scoreFrom, "notes");
  // والقائمة تقرأها بالمصدر نفسه، فلا تختلف البطاقة عن الملف.
  const list = await applicantsFor(SID.employer);
  const card = (list.data.jobs[0].applicants || []).find((a) => a.name === LEGACY_SCORE);
  assert.equal(card.score, 64, "البطاقة والملف يعطيان درجتين مختلفتين");
});

test("⑩ متقدّمٌ سيرته في جسم الصفحة وحقل ATS فارغ: يظهر، بلا نصّ، وبعلامة «لم تُقرأ»", async () => {
  // يظهر في القائمة والملفّ (طلبٌ وصل). ولا يُقرأ جسم الصفحة احتياطياً: النصّ فارغ و cvReady=false.
  const { status, data, raw } = await detailFor(SID.employer, idOf(BODY_CV));
  assert.equal(status, 200);
  assert.equal(data.candidate.cvText, "");
  assert.equal(data.candidate.cvReady, false);
  assert.ok(!raw.includes("محاسب أول — ثلاث سنوات"), "قُرئ جسم الصفحة لصفٍّ غير مقروء");
  const list = await applicantsFor(SID.employer);
  assert.ok(names(list.data).includes(BODY_CV), "اختفى متقدّمٌ حقيقي لأن سيرته لم تُقرأ");
  const card = (list.data.jobs[0].applicants || []).find((a) => a.name === BODY_CV);
  assert.equal(card.cvReady, false);
  const ok = (list.data.jobs[0].applicants || []).find((a) => a.name === RICH);
  assert.equal(ok.cvReady, true);
});

test("⑪ القائمة لا تحمل نصّ سيرةٍ ولا مبرر درجة — الحمولة تبقى صغيرة", async () => {
  const { raw, data } = await applicantsFor(SID.employer);
  assert.ok(!raw.includes("بكالوريوس إدارة أعمال"), "نصّ السيرة رُكب في قائمة المجموعات");
  assert.ok(!raw.includes("خبرة مطابقة"), "مبرر الدرجة رُكب في قائمة المجموعات");
  const card = (data.jobs[0].applicants || []).find((a) => a.name === RICH);
  assert.equal(card.score, 82, "الدرجة الرقمية لا تصل البطاقة");
  assert.ok(!("cvText" in card) && !("atsCvText" in card));
});


/* ═══════════ المقروء، وقاعدة المواهب المصفَّحة، وتصفية الإعلان (2026-10-01) ═══════════
 *
 * قرار المالك: ما لم يُقرأ يختفي عند صاحب العمل كأنه غير موجود — والإخفاء عند
 * **المصدر** (شرطٌ في استعلام نوشن) لا في الواجهة. فالاختبار الأول يقيس الأمرين:
 * أن الاستعلام الذي وصل نوشن يحمل الشروط الثلاثة، وأن الكود نفسه يمسك الصفّ
 * غير المقروء لو تجاهل نوشن الفلتر.
 */
const listFor = (qs, sid) => invoke({
  method: "GET", url: `/api/candidates?${qs}`,
  headers: sid ? { cookie: `bp_sid=${sid}` } : {}, on() {},
});
const poolFor = (qs, sid = SID.employer) => listFor(`code=self&${qs}`, sid);
const poolNames = (d) => (d.candidates || []).map((c) => c.name);
const READ_FILTER_TOKENS = ['"حالة القراءة"', '"مكتمل"', '"ATS CV Text"', '"is_not_empty":true', '"مخفي عن الموقع"'];

test("⑫ غير المقروء لا يخرج من أي مسار — والشرط في استعلام نوشن نفسه", async () => {
  assert.ok(BAD_NAMES.length >= 12, "لم تُبنَ الصفوف غير المقروءة");
  const phones = [...UNREADABLE, ...P_BAD].map((x) => {
    const row = ATS_ROWS.find((r) => (r.properties["Candidate Name"].title[0] || {}).plain_text === x) || ATS_ROWS.find((r) => r.id === x);
    return row.properties["Phone"].phone_number;
  });
  const leak = (raw, where, names0 = BAD_NAMES, phones0 = phones) => {
    for (const n of names0) assert.ok(!raw.includes(n), `تسرّب «${n}» من ${where}`);
    for (const ph0 of phones0) assert.ok(!raw.includes(ph0), `تسرّب جوّال صفٍّ غير مقروء من ${where}`);
  };
  // قائمة المتقدّمين وملفّ المتقدّم: غير المقروء ظاهر (طلبٌ وصل)، والمخفي وحده يختفي.
  const hiddenRow = ATS_ROWS.find((r) => (r.properties["Candidate Name"].title[0] || {}).plain_text === HIDDEN_NAME);
  const hiddenPhone = hiddenRow.properties["Phone"].phone_number;
  const appNames = [HIDDEN_NAME, ...P_BAD.map((id) => ATS_ROWS.find((r) => r.id === id).properties["Candidate Name"].title[0].plain_text)];
  const appPhones = [hiddenPhone];
  for (const ignore of [false, true]) {
    ignoreAtsFilter = ignore;           // الحارس الثاني: نوشن «نسي» الفلتر
    try {
      const tag = ignore ? " (والمُحاكي تجاهل الفلتر)" : "";
      for (const sid of [SID.employer, SID.owner]) {
        leak((await applicantsFor(sid)).raw, "قائمة المتقدّمين" + tag, appNames, appPhones);
        leak((await poolFor("limit=100", sid)).raw, "قاعدة المواهب المصفَّحة" + tag);
        leak((await poolFor("", sid)).raw, "قاعدة المواهب القديمة" + tag);
        leak((await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}`, sid)).raw, "تصفية الإعلان" + tag);
      }
      // ملفّ الواحد: المتقدّم (applicant=1) والقاعدة (id=) والتقييم — 404 كغير الموجود.
      for (const id of [...UNREADABLE, ...P_BAD].map((x) => (x.startsWith("pool-") ? x : idOf(x)))) {
        const hiddenId = id === idOf(HIDDEN_NAME) || id.startsWith("pool-");
        for (const sid of [SID.employer, SID.owner]) {
          const a = await detailFor(sid, id);
          // ملفّ المتقدّم: يُفتح لغير المقروء، ويُغلق للمخفي ولصفوف القاعدة (لا ختم تقديم).
          assert.equal(a.status, hiddenId ? 404 : 200, `ملفّ المتقدّم ${id}` + tag);
          const b = await invoke({ method: "GET", url: `/api/candidates?id=${id}&code=self`, headers: { cookie: `bp_sid=${sid}` }, on() {} });
          assert.equal(b.status, 404, `فُتح ملفّ قاعدةٍ لغير مقروء ${id}` + tag);
          leak(b.raw, "ملفّ القاعدة" + tag);
          if (hiddenId) leak(a.raw, "ملفّ المتقدّم المخفي" + tag);
        }
      }
    } finally { ignoreAtsFilter = false; }
  }
  // الشروط الثلاثة (+ المخفي) وصلت نوشن في **كل** استعلامٍ على قاعدة المرشحين.
  atsLog.length = 0;
  await poolFor("limit=20");
  await poolFor("");
  await poolFor(`limit=20&forJob=${EMPLOYER_JOB_ID}`);
  await invoke({ method: "GET", url: "/api/candidates?count=1", headers: {}, on() {} });
  assert.ok(atsLog.length >= 4, "لم يُسجَّل استعلام");
  for (const body of atsLog) {
    const f = JSON.stringify(body.filter);
    for (const tok of READ_FILTER_TOKENS) assert.ok(f.includes(tok), `استعلامٌ وصل نوشن بلا ${tok}: ${f.slice(0, 200)}`);
  }
  // قائمة المتقدّمين: المخفي وحده في الاستعلام — لا شرط قراءة (وإلا اختفى كل من لا نصّ له).
  atsLog.length = 0;
  await applicantsFor(SID.employer);
  assert.ok(atsLog.length >= 1);
  for (const body of atsLog) {
    const f = JSON.stringify(body.filter);
    assert.ok(f.includes('"مخفي عن الموقع"'), "المخفي لا يُستثنى في استعلام المتقدّمين");
    assert.ok(!f.includes('"ATS CV Text"') && !f.includes('"حالة القراءة"'),
      "استعلام المتقدّمين يشترط القراءة فيُخفي من لا نصّ له: " + f.slice(0, 200));
  }
});

test("⑬ القائمة المصفَّحة: صفحةٌ واحدة لكل طلب ومؤشّر، والعدّاد ما وصل فعلاً", async () => {
  const total = ATS_ROWS.filter(isReadableRow).filter((r) => !rtText(r.properties["الوظيفة المتقدم لها"])).length;
  let cursor = "", seen = [], pages = 0, last;
  atsLog.length = 0;
  do {
    last = await poolFor(`limit=7${cursor ? `&cursor=${cursor}` : ""}`);
    assert.equal(last.status, 200);
    assert.ok(last.data.candidates.length <= 7, "الصفحة أكبر من الحدّ");
    seen = seen.concat(poolNames(last.data));
    // `total` إجماليٌّ حقيقيٌّ أو غائب — لا عدد الصفحة (2026-10-01، طلب واجهة /hiring). وكل صفحةٍ
    // هنا لها تالية أو سابقة، فلا إجماليَّ دقيقاً معروفاً: الحقل غائب.
    assert.ok(!("total" in last.data), "total عُرض بلا إجماليٍّ حقيقي: " + last.data.total);
    cursor = last.data.nextCursor || "";
    pages++;
  } while (cursor && pages < 100);
  // نوشن استُعلم **مرّةً واحدة** لكل صفحة — لا مشيٌ على القاعدة في طلبٍ واحد.
  assert.equal(atsLog.length, pages, "طلبٌ مصفَّح مشى على أكثر من صفحةٍ من نوشن");
  assert.ok(atsLog.every((b) => b.page_size === 7));
  assert.ok(pages > 1, "لم يتصفّح");
  assert.equal(last.data.done, true);
  assert.equal(new Set(seen).size, seen.length, "تكرّر مرشّحٌ بين الصفحات");
  const wantPool = ATS_ROWS.filter((r) => isReadableRow(r) && r.id.startsWith("pool-") && !QUALITY_BAD.includes(r.id)).length;
  assert.equal(seen.filter((n) => POOL.includes(n)).length, wantPool, "فُقد مرشّحٌ مقروء من القاعدة");
  assert.ok(total > 0);
  // والصفحة لا تحمل نصّ السيرة (آلاف الأحرف للصفّ).
  const one = await poolFor("limit=3");
  assert.ok(!one.raw.includes("خبرة ست سنوات"), "نصّ السيرة رُكب في القائمة المصفَّحة");
  assert.ok(!("cvText" in one.data.candidates[0]));
  // الحدّ مسقوف بمئة.
  atsLog.length = 0;
  await poolFor("limit=5000");
  assert.equal(atsLog[0].page_size, 100);
});

test("⑭ q يُدفع إلى نوشن فلا يمسح طلبٌ واحد القاعدة — ونصّ السيرة لمن فُتح له وحده", async () => {
  atsLog.length = 0;
  const r = await poolFor("limit=20&q=ERP");
  assert.equal(r.status, 200);
  assert.equal(atsLog.length, 1, "q مسح أكثر من صفحة");
  const f = JSON.stringify(atsLog[0].filter);
  assert.ok(f.includes('"Original Position"') && f.includes('"Skills"') && f.includes('"ERP"'), f);
  assert.ok(f.includes('"ATS CV Text"') && f.includes('"contains":"ERP"'), "البحث في نصّ السيرة غاب عن المفتوح له");
  assert.ok(r.data.candidates.length > 0);

  // الزائر المقنَّع (بلا جلسة): لا بحث في نصّ السيرة — وإلا صارت الصفحة أداة تحقّقٍ
  // من محتوى سيرٍ لا يراها.
  atsLog.length = 0;
  const anon = await listFor("limit=20&q=ERP", "");
  assert.equal(anon.status, 200);
  const fa = JSON.stringify(atsLog[0].filter);
  assert.ok(fa.includes('"Skills"') && fa.includes('"contains":"ERP"'), "q لم يُدفع إلى نوشن للزائر: " + fa);
  assert.ok(!fa.includes('{"property":"ATS CV Text","rich_text":{"contains"'), "زائرٌ مقنَّع يبحث في نصّ السير: " + fa);
  assert.ok(anon.data.candidates.every((c) => !c.phone && !c.email && !c.cvText), "تسرّبت بيانات تواصل لزائر");
  assert.ok(anon.data.candidates.every((c) => /\./.test(c.name) || c.name === "—"), "الاسم غير مقنَّع");
});

test("⑮ العدّاد: إجمالي المقروء من المخزَّن وحده، وبلا فلتر فقط", async () => {
  metricRow = null;
  const none = await poolFor("limit=10");
  assert.equal(none.data.poolTotal, null, "إجماليٌّ مخمَّن بلا عدّادٍ مخزَّن");
  metricRow = { id: "m1", properties: {
    "القيمة": { type: "number", number: 17205 }, "آخر حساب": dt(new Date().toISOString()) } };
  const withMetric = await poolFor("limit=10");
  assert.equal(withMetric.data.poolTotal, 17205);
  assert.equal(withMetric.data.poolTotalStale, false);
  // مع فلتر لا إجماليَّ معروف: الرقم المخزَّن للقاعدة كلّها لا لهذا الفلتر.
  const filtered = await poolFor("limit=10&city=" + encodeURIComponent("الرياض"));
  assert.equal(filtered.data.poolTotal, null, "عُرض إجمالي القاعدة كلها على نتيجةٍ مصفّاة");
  // ومن الصفحة الثانية لا يُعاد (لا نداء إضافي).
  const second = await poolFor("limit=10&cursor=10");
  assert.equal(second.data.poolTotal, null);
  metricRow = null;
});

test("⑯ العدّاد العام ?count=1 يعدّ المقروء وحده", async () => {
  const r = await invoke({ method: "GET", url: "/api/candidates?count=1", headers: {}, on() {} });
  assert.equal(r.status, 200);
  assert.equal(r.data.done, true);
  assert.equal(r.data.total, ATS_ROWS.filter(isReadableRow).length, "العدّاد يعدّ ما لم يُقرأ");
});

test("⑰ تصفية الإعلان: المعايير الحتمية في استعلام نوشن، والخبرة من الوصف", async () => {
  atsLog.length = 0;
  const r = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.criteria.minExp, 5, "لم يُستخرج حدّ الخبرة من «خمس سنوات خبرة»");
  assert.equal(r.data.criteria.minExpFrom, "description");
  assert.equal(r.data.criteria.field, "محاسبة ومالية");
  const got = poolNames(r.data);
  for (const bad of ["قاعدة مجال آخر", "قاعدة خبرة قليلة", "قاعدة خبرة مجهولة"]) {
    assert.ok(!got.includes(bad), `«${bad}» نجا من التصفية الصلبة`);
  }
  // المدينة تفضيلٌ افتراضاً: يبقى مرشّح جدة ويُقال إن مدينته ناقصة.
  assert.ok(got.includes("قاعدة من جدة"));
  const jed = r.data.candidates.find((c) => c.name === "قاعدة من جدة");
  assert.equal(jed.checks.find((k) => k.key === "city").status, "missing");
  assert.equal(jed.checks.find((k) => k.key === "field").status, "met");
  // و«Riyadh» بالإنجليزية مدينةٌ مطابقة لـ«الرياض».
  const en = r.data.candidates.find((c) => c.name === "قاعدة Riyadh بالإنجليزية");
  assert.equal(en.checks.find((k) => k.key === "city").status, "met", "Riyadh لا تطابق الرياض");

  // المدينة شرطاً: يُدفع إلى الاستعلام، فيسقط مرشّح جدة.
  const hard = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}&cityHard=1`);
  assert.ok(!poolNames(hard.data).includes("قاعدة من جدة"));
  assert.ok(poolNames(hard.data).includes("قاعدة Riyadh بالإنجليزية"), "شرط المدينة أسقط الرياض المكتوبة بالإنجليزية");
  // شرط التوطين من صاحب العمل: بوّابة في الاستعلام.
  const sa = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}&nat=${encodeURIComponent("سعودي")}`);
  assert.deepEqual(poolNames(sa.data), ["قاعدة سعودي"]);
  // حدّ الخبرة يعدّله صاحب العمل بيده.
  const mx = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}&minExp=7`);
  assert.equal(mx.data.criteria.minExpFrom, "owner");
  assert.deepEqual(poolNames(mx.data), [], "حدٌّ أعلى من خبرة الجميع لم يُسقط أحداً");
});

test("⑱ تصفية الإعلان لصاحبه وحده، وبلا زائرٍ ولا قائمةٍ قديمة", async () => {
  const other = await poolFor(`limit=20&forJob=${OWNER_JOB_ID}`);
  assert.equal(other.status, 404, "فُتحت تصفيةُ إعلانِ صاحب عملٍ آخر");
  assert.ok(!other.raw.includes("إعلان المالك"));
  const own = await poolFor(`limit=20&forJob=${OWNER_JOB_ID}`, SID.owner);
  assert.equal(own.status, 200, "المالك مُنع من تصفية إعلانه");
  assert.equal((await poolFor(`limit=20&forJob=${EMPLOYER_JOB_ID}`, SID.client)).status, 404, "عميل بوابةٍ بلا إعلان");
  const anon = await listFor(`limit=20&forJob=${EMPLOYER_JOB_ID}`, "");
  assert.equal(anon.status, 403);
  const noLimit = await poolFor(`forJob=${EMPLOYER_JOB_ID}`);
  assert.equal(noLimit.status, 400);
  jobsDbFails = true;
  try {
    const f = await poolFor(`limit=20&forJob=${EMPLOYER_JOB_ID}`);
    assert.equal(f.status, 502, "تعذّر استعلام الملكية لم يُقفل الباب");
  } finally { jobsDbFails = false; }
});

test("⑲ الدرجة المحفوظة تُعرض لوظيفتها وحدها — لا لصاحب عملٍ آخر", async () => {
  const sc = await poolFor(`limit=50&forJob=${EMPLOYER_JOB_ID}&scored=1`);
  assert.equal(sc.status, 200);
  assert.deepEqual(poolNames(sc.data), ["قاعدة مُقيَّم لإعلاني"]);
  const mine = sc.data.candidates[0];
  assert.equal(mine.match.score, 88);
  assert.ok(mine.match.reason.includes("خبرة محاسبية"), "لم يُعَد المبرّر");
  // وفي القائمة غير المقتصرة على المُقيَّمين: درجة إعلان غيره لا تظهر ولا مبرّرها ولا اسم إعلانه.
  const all = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}`);
  const other = all.data.candidates.find((c) => c.name === "قاعدة مُقيَّم لإعلان غيري");
  assert.ok(other, "المرشّح نفسه يجب أن يُعرض (للتقييم على إعلانه)");
  assert.equal(other.match, undefined, "درجةُ إعلانٍ آخر ظهرت لصاحب العمل");
  for (const secret of ["مبرّرٌ سرّي", "إعلان المالك السرّي", '"score":95']) {
    assert.ok(!all.raw.includes(secret), `تسرّب «${secret}»`);
  }
  // مرشّحٌ مقروء بلا تقييمٍ لا يحمل match.
  assert.equal(all.data.candidates.find((c) => c.name === "قاعدة مقروء 1").match, undefined);
});

test("⑳ ملفّ القاعدة (?id=): الحقول المنظَّمة كلها، بلا راتبٍ ولا درجة", async () => {
  const id = P_OK[0];
  const r = await invoke({ method: "GET", url: `/api/candidates?id=${id}&code=self`, headers: { cookie: `bp_sid=${SID.employer}` }, on() {} });
  assert.equal(r.status, 200);
  const c = r.data.candidate;
  for (const [k, v] of Object.entries({
    // مرشّحٌ مستورد (Source=ترشيح): المسمّى هو «Original Position»، لا Target Role المخمَّن.
    field: "محاسبة ومالية", role: "محاسب أول", originalPosition: "محاسب أول", city: "الرياض", experience: "6",
    education: "بكالوريوس", nationalityType: "غير سعودي", nationality: "هندي",
    residenceStatus: "مقيم بإقامة نظامية قابلة للنقل", availability: "فوري",
    compliance: "✅ مطابق", saudization: "مسموح لغير السعوديين", saudizationDetails: "المهنة مفتوحة.",
  })) assert.equal(c[k], v, `الحقل ${k}`);
  assert.equal(c.languages, "العربية، الإنجليزية");
  assert.ok(c.skills.includes("ERP"), "المهارات الكاملة");
  assert.ok(c.cvText.includes("خبرة ست سنوات"));
  assert.equal(c.cvLink, `https://drive.google.com/file/d/${id}/view`, "رابط الملف الأصلي");
  assert.ok(c.registered);
  assert.ok(!("score" in c) && !("scoreReason" in c), "درجةٌ في ملفّ القاعدة");
  assert.ok(!r.raw.includes("9000") && !("expectedSalary" in c), "الراتب المتوقع تسرّب");
  // الزائر المقنَّع: لا اسم ولا جوّال ولا نصّ سيرة ولا رابط.
  const anon = await listFor(`id=${id}`, "");
  assert.equal(anon.status, 200);
  assert.ok(!anon.raw.includes("خبرة ست سنوات") && !anon.raw.includes("drive.google.com") && !anon.raw.includes("هندي"), "تسرّب لزائرٍ مقنَّع");
});

test("㉑ الأجنبي على القائمة القديمة بلا limit يعمل كما كان (مقروء فقط)", async () => {
  const r = await poolFor("");
  assert.equal(r.status, 200);
  assert.equal(r.data.done, true);
  assert.ok(r.data.candidates.length > 10);
  assert.ok(r.data.candidates.every((c) => "cvText" in c), "القديمة كانت تحمل نصّ السيرة");
  const q = await poolFor("q=" + encodeURIComponent("محاسب"));
  assert.ok(q.data.candidates.length > 0 && q.data.candidates.every((c) => /محاسب/.test(c.role + c.skills + c.field)));
});

test("㉒ درجةُ إعلانٍ آخر لا تظهر في ملفّ المتقدّم ولا في بطاقته", async () => {
  // متقدّمٌ على إعلان محمد، قُيِّم (فيما بعد) على إعلانٍ لا يملكه محمد.
  applicant("مرشّح محمد — درجته لإعلانٍ آخر", "0510000099", "إعلان محمد", EMPLOYER_JOB_ID, { extra: {
    "درجة المطابقة": nu(77), "مبرر الدرجة": rt("مبرّرٌ كُتب لإعلانٍ آخر."),
    "الوظيفة المُقيَّم عليها": rt(`إعلان صاحبٍ آخر (${OWNER_JOB_ID})`) } });
  const id = idOf("مرشّح محمد — درجته لإعلانٍ آخر");
  const d = await detailFor(SID.employer, id);
  assert.equal(d.status, 200);
  assert.equal(d.data.candidate.score, null);
  assert.equal(d.data.candidate.scoreReason, "");
  assert.ok(!d.raw.includes("مبرّرٌ كُتب لإعلانٍ آخر") && !d.raw.includes("إعلان صاحبٍ آخر"));
  const l = await applicantsFor(SID.employer);
  const card = l.data.jobs[0].applicants.find((a) => a.name === "مرشّح محمد — درجته لإعلانٍ آخر");
  assert.equal(card.score, null);
  // وللمالك يظهر: هو صاحب المنصّة.
  const o = await detailFor(SID.owner, id);
  assert.equal(o.data.candidate.score, 77);
  // ودرجة إعلانه هو تظهر وتحمل scoreJob لتقارنها المطابقة بالإعلان المختار.
  const rich = l.data.jobs[0].applicants.find((a) => a.name === RICH);
  assert.equal(rich.score, 82);
  assert.equal(rich.scoreJob, EMPLOYER_JOB_ID.replace(/-/g, ""));
});


/* ═══════ نظافة القيم المعروضة (تدقيق الاستخراج 2026-10-01) ═══════ */
const { normCity, normCountry, normNationality, cleanSkills, roleOf, scoringRow } = await import("../api/candidates.js");

test("㉓ المدينة: التطبيع الحتمي — Riyadh/الرياض، و«غير محدد» و«KSA» فارغة", () => {
  for (const v of ["Riyadh", "riyadh", "الرياض", "الرياض، السعودية", "Riyadh, KSA", "Riyadh - Saudi Arabia"]) {
    assert.equal(normCity(v), "الرياض", v);
  }
  assert.equal(normCity("Jeddah"), "جدة");
  assert.equal(normCity("جده"), "جدة");
  for (const v of ["غير محدد", "KSA", "Saudi Arabia", "السعودية", "N/A", "-", "", null, undefined]) {
    assert.equal(normCity(v), "", `«${v}» عُرضت قيمةً`);
  }
  assert.equal(normCity("القصيم"), "القصيم", "مدينةٌ خارج القائمة تبقى كما هي");
  assert.equal(normCountry("KSA"), "السعودية");
  assert.equal(normCountry("غير محدد"), "");
  assert.equal(normCountry("مصر"), "مصر");
});

test("㉔ الجنسية المكتوبة تُوحَّد للعرض، والتوطين من Nationality Type وحدها", async () => {
  for (const v of ["سعودي", "سعودية", "Saudi", "Saudi Arabia", "السعودية", "KSA"]) {
    assert.equal(normNationality(v), "سعودي", v);
  }
  assert.equal(normNationality("غير محدد"), "");
  assert.equal(normNationality("هندي"), "هندي");
  // نصُّ الجنسية «سعودية» وNationality Type «غير سعودي»: شرط التوطين يتبع النوع.
  const odd = poolRow("قاعدة نصّ الجنسية يخالف النوع", { "Nationality": rt("سعودية"), "Nationality Type": se("غير سعودي") });
  const r = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}&nat=${encodeURIComponent("سعودي")}`);
  assert.ok(!poolNames(r.data).includes("قاعدة نصّ الجنسية يخالف النوع"), "التوطين اتّبع نصّ الجنسية المخمَّن");
  const d = await invoke({ method: "GET", url: `/api/candidates?id=${odd}&code=self`, headers: { cookie: `bp_sid=${SID.employer}` }, on() {} });
  assert.equal(d.data.candidate.nationality, "سعودي", "الجنسية المكتوبة لم تُوحَّد");
  assert.equal(d.data.candidate.nationalityType, "غير سعودي");
});

test("㉕ المسمّى: Target Role لمن كتبه المرشّح بنفسه (الموقع) فقط", async () => {
  const imp = poolRow("قاعدة مستورد", { "Source": se("ترشيح"), "Target Role": se("Executive Chef"), "Original Position": rt("Pizza Maker") });
  const site = poolRow("قاعدة من الموقع", { "Source": se("الموقع"), "Target Role": se("Sales Manager"), "Original Position": rt("Sales Exec") });
  const siteNoTarget = poolRow("قاعدة موقع بلا هدف", { "Source": se("الموقع"), "Target Role": se(""), "Original Position": rt("Cashier") });
  const noOrig = poolRow("قاعدة مستورد بلا مسمّى", { "Source": se("استيراد قاعدة"), "Target Role": se("Executive Chef"), "Original Position": rt("") });
  const get1 = async (id) => (await invoke({ method: "GET", url: `/api/candidates?id=${id}&code=self`, headers: { cookie: `bp_sid=${SID.employer}` }, on() {} })).data.candidate;
  assert.equal((await get1(imp)).role, "Pizza Maker", "عُرض Target Role المخمَّن لمستورد");
  assert.equal((await get1(site)).role, "Sales Manager");
  assert.equal((await get1(siteNoTarget)).role, "Cashier");
  assert.equal((await get1(noOrig)).role, "", "عُرض Target Role لمستوردٍ بلا مسمّى");
  // والقائمة، وبطاقة المطابقة، ومادة التقييم تتبعه كلّها.
  const list = await poolFor("limit=100");
  assert.equal(list.data.candidates.find((c) => c.id === imp).role, "Pizza Maker");
  const sc = await scoringRow(imp);
  assert.equal(sc.brief.role, "Pizza Maker");
  assert.equal(sc.gate.role, "Pizza Maker");
  assert.ok(!JSON.stringify(sc.brief).includes("Executive Chef"));
  assert.equal(roleOf({ "Source": se("ترشيح"), "Target Role": se("X"), "Original Position": rt("Y") }), "Y");
});

test("㉖ سنوات الخبرة صفر = مجهول: «—» ولا تدخل التصفية كأنها صفرٌ حقيقي", async () => {
  const zero = poolRow("قاعدة خبرة صفر", { "Experience Years": nu(0) });
  const d = await invoke({ method: "GET", url: `/api/candidates?id=${zero}&code=self`, headers: { cookie: `bp_sid=${SID.employer}` }, on() {} });
  assert.equal(d.data.candidate.experience, "", "صفرٌ عُرض «0 سنة»");
  const list = await poolFor("limit=100");
  assert.equal(list.data.candidates.find((c) => c.id === zero).experience, "");
  const sc = await scoringRow(zero);
  assert.equal(sc.gate.experience, null, "الصفر دخل التصفية الحتمية");
  assert.equal(sc.brief.experience, "", "قيل للمُقيِّم إن خبرته صفر");
  // وحدٌّ أدنى للخبرة لا يقبله (مجهولٌ لا يُعدّ مستوفى).
  const f = await poolFor(`limit=100&forJob=${EMPLOYER_JOB_ID}`);
  assert.ok(!poolNames(f.data).includes("قاعدة خبرة صفر"));
  // ومن تقدّم على الإعلان وخبرته صفر يُعرض «—» في بطاقته.
  const ap = (await applicantsFor(SID.owner)).data.jobs.flatMap((g) => g.applicants);
  assert.ok(ap.every((a) => a.experience !== "0"));
});

test("㉗ المهارات: لا مهارة تساوي المسمّى ولا رابط", async () => {
  assert.equal(cleanSkills("محاسب أول, linkedin.com/in/x, https://example.com/cv, محاسبة, إكسل, محاسبة", ["محاسب أول"]), "محاسبة, إكسل");
  assert.equal(cleanSkills("Sales Manager، LinkedIn: abc، Negotiation", ["sales manager"]), "Negotiation");
  const id = poolRow("قاعدة مهارات ملوّثة", { "Original Position": rt("محاسب أول"), "Skills": rt("محاسب أول, www.linkedin.com/in/x, محاسبة, إكسل") });
  const d = await invoke({ method: "GET", url: `/api/candidates?id=${id}&code=self`, headers: { cookie: `bp_sid=${SID.employer}` }, on() {} });
  assert.equal(d.data.candidate.skills, "محاسبة, إكسل");
  const sc = await scoringRow(id);
  assert.ok(!sc.brief.skills.includes("linkedin") && !sc.brief.skills.includes("محاسب أول"), "مهارةٌ ملوّثة وصلت المُقيِّم");
});

test("㉘ المدينة المعروضة موحَّدة في القائمة والملفّ والتقييم", async () => {
  const a = poolRow("قاعدة مدينة مكتوبة بالإنجليزية", { "City": rt("Riyadh, KSA") });
  const b = poolRow("قاعدة مدينة غير محدد", { "City": rt("غير محدد") });
  const l = await poolFor("limit=100");
  assert.equal(l.data.candidates.find((c) => c.id === a).city, "الرياض");
  assert.equal(l.data.candidates.find((c) => c.id === b).city, "", "«غير محدد» عُرضت قيمةً");
  assert.equal((await scoringRow(a)).gate.city, "الرياض");
  assert.equal((await scoringRow(b)).brief.city, "");
});

test.after(() => { try { fs.rmSync(DBDIR, { recursive: true, force: true }); } catch {} });
