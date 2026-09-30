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

const job = (id, title, code) => ({ id, created_time: "2026-09-10T08:00:00.000Z", properties: {
  "العنوان الوظيفي": ti(title), "رمز صاحب العمل": rt(code), "المدينة": rt("الرياض"),
  "المجال": se("موارد بشرية"), "الوصف والمتطلبات": rt("وصف"), "الحالة": se("نشطة"),
} });
const JOB_ROWS = [
  job(OWNER_JOB_ID, "إعلان المالك", OWNER_ACCESS_CODE),
  job(EMPLOYER_JOB_ID, "إعلان محمد", EMPLOYER_ACCESS_CODE),
];

// المتقدّمون، مختومون كما يختمهم api/candidate.js: "العنوان (المعرّف)" في
// «الوظيفة المتقدم لها»، وللصفوف القديمة السطر نفسه داخل Notes.
const ATS_ROWS = [];
const nu = (n) => ({ type: "number", number: typeof n === "number" ? n : null });
const ur = (s) => ({ type: "url", url: s || null });

const applicant = (name, phone, stampTitle, stampId, { legacy = false, extra = null, notes = "" } = {}) => {
  const line = `تقديم عبر الموقع — الوظيفة: ${stampTitle} (${stampId})`;
  ATS_ROWS.push({ id: `cand-${ATS_ROWS.length + 1}`, created_time: "2026-09-12T00:00:00.000Z", properties: {
    "Candidate Name": ti(name), "Phone": ph(phone), "Email": em(`${phone}@example.com`),
    "City": rt("الرياض"), "Nationality Type": se("سعودي"), "Pipeline Stage": se("جديد"),
    "مخفي عن الموقع": cb(false),
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
const CV_TEXT_FULL = "# سعود العتيبي\n\n## الخبرة\n- أخصائي موارد بشرية — **خمس سنوات**\n\n## التعليم\n- بكالوريوس إدارة أعمال";
// سيرةٌ فيها وسم سكربت: تُعاد من الخادم كما هي (هو لا يبني HTML)، والواجهة
// هي التي تهرّبها. الصفّ موجود كي يُقاس الهرب على المولَّد فعلاً.
const CV_TEXT_XSS = "# <script>alert('xss')</script>\n\n- <img src=x onerror=alert(1)>";
const RICH = applicant("مرشّح محمد — ملفٌّ مكتمل", "0510000005", "إعلان محمد", EMPLOYER_JOB_ID, { extra: {
  "ATS CV Text": rt(CV_TEXT_FULL),
  "CV Link": ur("https://drive.google.com/file/d/ORIGINAL_FILE/view"),
  "ATS CV (Drive)": ur("https://docs.google.com/document/d/ATS_DOC/edit"),
  "درجة المطابقة": nu(82),
  "مبرر الدرجة": rt("خبرة مطابقة في المجال نفسه، والمدينة نفسها."),
  "الوظيفة المُقيَّم عليها": rt("إعلان محمد"),
  "تاريخ التقييم": { type: "date", date: { start: "2026-09-20" } },
  "التوطين Saudization": se("مسموح لغير السعوديين"),
  "الامتثال Compliance": se("✅ مطابق"),
  "تفاصيل التوطين": rt("المهنة مفتوحة، ولا اشتراط جنسية عليها."),
} });
const XSS = applicant("مرشّح محمد — سيرةٌ فيها وسم سكربت", "0510000006", "إعلان محمد", EMPLOYER_JOB_ID, {
  extra: { "ATS CV Text": rt(CV_TEXT_XSS) },
});
// لا سيرة ولا ملف ولا درجة ولا توطين — وهذه حالة الغالبية العظمى فعلاً.
const BARE = applicant("مرشّح محمد — لا سيرة ولا درجة", "0510000007", "إعلان محمد", EMPLOYER_JOB_ID);
// درجةٌ قديمة مكتوبةً نصّاً في Notes وحدها: الحقل الرقمي أُضيف فارغاً، فلو
// استُبدل الاحتياطي لاختفت كل درجةٍ معروضة اليوم.
const LEGACY_SCORE = applicant("مرشّح محمد — درجةٌ في Notes وحدها", "0510000008", "إعلان محمد", EMPLOYER_JOB_ID, {
  notes: "تقديم عبر الموقع — score 64/100 من الفرز الآلي",
});
EMPLOYERS_OWN.push(RICH, XSS, BARE, LEGACY_SCORE);

// متقدّمٌ **على إعلان المالك** وله سيرةٌ كاملة — هو مقياس التسريب في المسار
// الجديد: محمد يعرف معرّفه (أو يخمّنه) ويسأل عنه مباشرةً، فيجب ألا يصله حرف.
const STRANGER_CV = "# سرّ لا يراه محمد\n\n- بيانات مرشّح صاحب عملٍ آخر";
const STRANGER = applicant("مرشّح المالك — ملفٌّ مكتمل", "0500000003", "إعلان المالك", OWNER_JOB_ID, { extra: {
  "ATS CV Text": rt(STRANGER_CV),
  "CV Link": ur("https://drive.google.com/file/d/STRANGER_FILE/view"),
  "درجة المطابقة": nu(91),
} });
OWNERS_OWN.push(STRANGER);
// السيرة تُكتب غالباً في **جسم صفحة** المرشّح لا في الحقل (صفٌّ واحد من
// ٢٦٤١٩ يحمل الحقل مملوءاً)، فالاحتياطي هو المسار الحقيقي لا الاستثناء.
const BODY_CV = applicant("مرشّح محمد — سيرته في جسم الصفحة", "0510000009", "إعلان محمد", EMPLOYER_JOB_ID);
EMPLOYERS_OWN.push(BODY_CV);
const BODY_ROW_ID = ATS_ROWS[ATS_ROWS.length - 1].id;
const PAGE_BLOCKS = {
  [BODY_ROW_ID]: [
    { type: "heading_2", heading_2: { rich_text: [{ plain_text: "الخبرة العملية" }] } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "محاسب أول — ثلاث سنوات" }] } },
    { type: "paragraph", paragraph: { rich_text: [{ plain_text: "" }] } },
  ],
};
const idOf = (name) => (ATS_ROWS.find((r) => (r.properties["Candidate Name"].title[0] || {}).plain_text === name) || {}).id;
// تسجيلات عامة ووظائف الموقع: ليست صفوفاً في JOBS_DB ولا رمز صاحب عملٍ لها،
// فهي للمالك وحده — التسجيل في القاعدة ليس «تقدّماً على إعلان» أحد.
const SITE_OWN = [
  applicant("مرشّح القاعدة العامة", "0520000001", "قاعدة المرشحين العامة", "candidate-pool"),
  applicant("متقدّم على وظيفة الموقع", "0520000002", "أخصائي عمليات موارد بشرية", "hr-operations-specialist"),
];

// يُقلب في اختبار «الفشل المغلق» وحده.
let jobsDbFails = false;

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
    const row = ATS_ROWS.find((r) => r.id === decodeURIComponent(pm[1]));
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
  if (db === ATS_DB) return json({ results: ATS_ROWS, has_more: false });
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

  assert.deepEqual(names(data), [...EMPLOYERS_OWN].sort(),
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
  assert.equal(totalApplicants(data), EMPLOYERS_OWN.length);
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
  assert.equal(totalApplicants(data), ATS_ROWS.length,
    `المالك يرى ${totalApplicants(data)} من ${ATS_ROWS.length}`);
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
  assert.equal(c.scoredFor, "إعلان محمد");
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
  assert.equal(c.cvText, "");
  assert.equal(c.cvFrom, "");
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

test("⑩ السيرة المكتوبة في جسم الصفحة تُقرأ احتياطياً وتُعلن مصدرها", async () => {
  const { data } = await detailFor(SID.employer, idOf(BODY_CV));
  assert.equal(data.candidate.cvFrom, "page");
  assert.ok(data.candidate.cvText.includes("## الخبرة العملية"), "لم يُقرأ العنوان من الكتل");
  assert.ok(data.candidate.cvText.includes("- محاسب أول"), "لم تُقرأ نقطة القائمة من الكتل");
});

test("⑪ القائمة لا تحمل نصّ سيرةٍ ولا مبرر درجة — الحمولة تبقى صغيرة", async () => {
  const { raw, data } = await applicantsFor(SID.employer);
  assert.ok(!raw.includes("بكالوريوس إدارة أعمال"), "نصّ السيرة رُكب في قائمة المجموعات");
  assert.ok(!raw.includes("خبرة مطابقة"), "مبرر الدرجة رُكب في قائمة المجموعات");
  const card = (data.jobs[0].applicants || []).find((a) => a.name === RICH);
  assert.equal(card.score, 82, "الدرجة الرقمية لا تصل البطاقة");
  assert.ok(!("cvText" in card) && !("atsCvText" in card));
});

test.after(() => { try { fs.rmSync(DBDIR, { recursive: true, force: true }); } catch {} });
