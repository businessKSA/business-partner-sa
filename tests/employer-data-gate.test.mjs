// بوابة البيانات: التسجيل مجاني، والبيانات بالاشتراك  (api/candidates.js · api/hire.js)
//
// شغّله: npm test
//
// قرار المالك (2026-10-08): صاحب العمل يسجّل مجاناً ويدخل /employer، لكنه لا يحصل
// على بيانات المرشحين (الاسم والبريد والجوال ورابط السيرة ونصّها) إلا باشتراك فعّال.
// وقبل هذا القرار كان الأمر معكوساً بصمت: جلسة أي عميلٍ مسجّل كانت تفتح اللوحة
// (BP_OPEN_ACCESS)، واللوحة كانت تفتح معها `unlocked:true` فتخرج بيانات كل المرشحين
// من الخادم — والواجهة وحدها كانت تُخفي بابَي بنك السير. الإخفاء في الواجهة ليس
// إخفاءً: يكفي طلبٌ مباشر.
//
// ما يُقاس هنا، وكلٌّ منه بقيم فريدة (canaries) تُبحث في **الحمولة الخام** لا في حقولٍ
// مختارة — فحقلٌ جديد يتسرّب من حيث لا يُنتظر يُمسك:
//   ① الحساب المجاني لا يتسرّب له اسمٌ ولا بريدٌ ولا جوالٌ ولا رابط سيرةٍ ولا نصّها ولا
//      اسم المكتب ولا وسم المصدر ولا معرّف المكتب — من أي مسارٍ يعرض مرشّح قاعدة:
//      القائمة (مصفَّحة وقديمة) · البحث بـq · المطابقة (forJob) · الدرجة · ملف المرشّح.
//   ② المشترك يرى كل شيء كما قبل (لا انحدار) — إلا الحقلين الداخليين، فلا يخرجان
//      لأحد (حارس وكيل المكاتب).
//   ③ المتقدّمون على إعلانات صاحب العمل نفسه ظاهرون له كاملين ولو لم يشترك.
//   ④ الفشل يُغلق: خللٌ في نوشن، أو رمزٌ لا يطابق صفاً مفعّلاً، أو صفٌّ معلّق ⇒ حجب.
//   ⑤ المالك/الفريق لا يُحجب عنه شيء.
//
// كلّه على `handler` الحقيقي: الجلسة تُقرأ من api/_db.js فعلاً (LOCAL_DB=1 → ملف JSON
// مؤقّت)، ونوشن وAzure وحدهما مُحاكيان. بلا شبكة.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------- الجلسة --
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-employer-gate-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
const NOW = new Date().toISOString();

const SUB_EMAIL = "sub@example.com";
const FREE_EMAIL = "free@example.com";
const PEND_EMAIL = "pending@example.com";
const STAFF_EMAIL = "business@businesspartner.sa";   // OWNER_EMAILS الافتراضي، بلا صفّ اشتراك
const OWNER_EMAIL = "dr.baher.magnas@gmail.com";
const SID = { sub: "sid-sub", free: "sid-free", pend: "sid-pend", staff: "sid-staff" };

const mk = (key, email, org) => ({
  user: { id: "u-" + key, email, full_name: key, locale: "ar" },
  org: { id: "org-" + key, name_ar: "شركة " + key, created_at: NOW },
  sess: { id: "s-" + key, user_id: "u-" + key, organization_id: "org-" + key, token_hash: sha(SID[key]), revoked_at: null, expires_at: future },
});
const ACC = [mk("sub", SUB_EMAIL), mk("free", FREE_EMAIL), mk("pend", PEND_EMAIL), mk("staff", STAFF_EMAIL)];
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: ACC.map((a) => a.user), organizations: ACC.map((a) => a.org),
  user_sessions: ACC.map((a) => a.sess), audit_logs: [],
}, null, 2));

// تُضبط قبل الاستيراد: الوحدات تقرأ البيئة وقت التحميل لا وقت النداء.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.OWNER_EMAIL = OWNER_EMAIL;
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_TEXT_DEPLOYMENT = "gpt-test";
delete process.env.AZURE_OPENAI_ENDPOINT_2;
delete process.env.OWNER_DEMO_CODE;
delete process.env.EMPLOYER_CODES;
delete process.env.OWNER_EMAILS;
// الافتراضي الحقيقي: BP_OPEN_ACCESS غير مضبوط = كل جلسة عميلٍ تفتح اللوحة. هذا هو
// الوضع الذي كان يسرّب، فلا يُعطَّل هنا.
delete process.env.BP_OPEN_ACCESS;
delete process.env.HIRE_SCORE_POOL;
process.env.HIRE_DAILY_LIMIT = "500";

// ------------------------------------------------------------ نوشن مُحاكى --
const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";
const JOBS_DB = "260d76959d464631943f79f313fbf3c9";
const ATS_DB = "71792742873e4de398135c7855542b95";
const METRICS_DB = "245f3a1ffb1844b19707bb67120b9605";

const SUB_CODE = "BP-EMP-SUBSUBSUB001";
const PEND_CODE = "BP-EMP-PENDPENDPEND";

const ti = (s) => ({ type: "title", title: s ? [{ plain_text: String(s) }] : [] });
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: String(s) }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const em = (s) => ({ type: "email", email: s || null });
const ph = (s) => ({ type: "phone_number", phone_number: s || null });
const ur = (s) => ({ type: "url", url: s || null });
const nu = (n) => ({ type: "number", number: typeof n === "number" ? n : null });
const cb = (v) => ({ type: "checkbox", checkbox: !!v });
const ms = (arr) => ({ type: "multi_select", multi_select: arr.map((n) => ({ name: n })) });
const dt = (d) => ({ type: "date", date: d ? { start: d } : null });

const EMP_ROWS = [
  { id: "emp-sub", created_time: "2026-02-01T00:00:00.000Z", properties: {
    "اسم الشركة": ti("شركة المشترك"), "البريد": em(SUB_EMAIL), "الحالة": se("مفعّل"), "الباقة": se("احترافية"), "رمز الوصول": rt(SUB_CODE) } },
  { id: "emp-pend", created_time: "2026-02-02T00:00:00.000Z", properties: {
    "اسم الشركة": ti("شركة المعلّق"), "البريد": em(PEND_EMAIL), "الحالة": se("بانتظار الدفع"), "الباقة": se("أساسية"), "رمز الوصول": rt(PEND_CODE) } },
];

// ── الصفوف بقيمٍ فريدة: كل قيمةٍ تُبحث في الحمولة الخام ────────────────────────
const C = {
  nameAr: "كاناري-الاسم-العربي", nameEn: "CanaryNameEnglishZQ",
  email: "canary.pool@leak.example", phone: "0559988771", phoneIntl: "+966559988771",
  cvOrig: "https://drive.example/CANARY-CV-ORIGINAL", cvAts: "https://docs.example/CANARY-ATS-DOC",
  cvText: "CANARYCVTEXTZZ", interviewLink: "https://meet.example/CANARY-INTERVIEW",
  office: "مكتب-الكاناري-للاستقدام", officeEmail: "office.canary@leak.example",
  sourceTag: "vendor:office", officeId: "OFFICEID-CANARY-77",
  reason: "REASON-CANARY-QUOTES-THE-CV",
  applName: "كاناري-متقدّم-مجاني", applEmail: "applicant.free@leak.example", applPhone: "0541112233",
  applCv: "https://drive.example/APPLICANT-FREE-CV",
  otherApplName: "كاناري-متقدّم-الغير",
};
const SOURCE_COL = "مصدر المرشح", OFFICE_COL = "معرّف المكتب";   // الحارس يعرف الاسمين؛ ملفات الواجهة لا

const FILL = "إدارة الحسابات والمطالبات المالية وإعداد القوائم الشهرية ومطابقة الفواتير لدى شركات متوسطة الحجم في المملكة.";
const FREE_JOB = "f1f1f1f1-aaaa-4bbb-8ccc-111111111111";
const SUB_JOB = "5b5b5b5b-aaaa-4bbb-8ccc-222222222222";
const ORG_FREE = "org:org-free";

const ATS_ROWS = [];
const baseRow = (id, label, props) => {
  const row = { id, created_time: "2026-09-12T00:00:00.000Z", properties: {
    "Candidate Name": ti(C.nameAr + "-" + label), "Name (EN)": ti(C.nameEn + label),
    "Phone": ph(C.phone), "Email": em(C.email),
    "City": rt("الرياض"), "Country": rt("السعودية"), "Field": se("محاسبة ومالية"),
    "Original Position": rt("محاسب أول"), "Skills": rt("محاسبة, إكسل"), "Experience Years": nu(7),
    "Education": se("بكالوريوس"), "Languages": ms(["العربية"]), "Nationality Type": se("غير سعودي"),
    "Nationality": rt("هندي"), "حالة الإقامة": se("مقيم بإقامة نظامية قابلة للنقل"), "Availability": se("فوري"),
    "CV Link": ur(C.cvOrig), "ATS CV (Drive)": ur(C.cvAts),
    "ATS CV Text": rt(`${C.cvText} ${FILL}`), "حالة القراءة": se("مكتمل"), "مخفي عن الموقع": cb(false),
    "Pipeline Stage": se("جديد"), "Interview Status": se("مطلوبة من صاحب العمل"),
    "رابط المقابلة": ur(C.interviewLink), "مكان المقابلة": rt("مكان-مقابلة-كاناري"),
    "مكتب الاستقدام": rt(C.office), "بريد المكتب": em(C.officeEmail),
    [SOURCE_COL]: se(C.sourceTag), [OFFICE_COL]: rt(C.officeId),
    "التوطين Saudization": se("مسموح لغير السعوديين"), "الامتثال Compliance": se("✅ مطابق"),
    "تفاصيل التوطين": rt("تفصيل-توطين-كاناري"),
    "Source": se("ترشيح"), ...props } };
  ATS_ROWS.push(row);
  return row;
};
// مرشّحو القاعدة (لا ختم تقديمٍ لهم).
const POOL1 = baseRow("a0000000-0000-4000-8000-000000000001", "P1").id;
const POOL_SCORED = baseRow("a0000000-0000-4000-8000-000000000002", "P2", {
  "درجة المطابقة": nu(88), "مبرر الدرجة": rt(C.reason),
  "الوظيفة المُقيَّم عليها": rt(`إعلان المجاني (${FREE_JOB})`), "تاريخ التقييم": dt("2026-09-30"),
}).id;
// متقدّم على إعلان صاحب العمل المجاني، وآخر على إعلان غيره.
const stamp = (title, id) => ({ "الوظيفة المتقدم لها": rt(`${title} (${id})`), "Notes": rt("تقديم عبر الموقع") });
const APPL_FREE = baseRow("a0000000-0000-4000-8000-0000000000f1", "AF", {
  "Candidate Name": ti(C.applName), "Name (EN)": ti(""), "Email": em(C.applEmail), "Phone": ph(C.applPhone),
  "CV Link": ur(C.applCv), ...stamp("إعلان المجاني", FREE_JOB),
}).id;
const APPL_OTHER = baseRow("a0000000-0000-4000-8000-0000000000e1", "AO", {
  "Candidate Name": ti(C.otherApplName), "Name (EN)": ti(""), ...stamp("إعلان المشترك", SUB_JOB),
}).id;
// وهو **متقدّمٌ على إعلان المجاني وفي الوقت نفسه** ظاهرٌ في قائمة مطابقة ذلك الإعلان.
const jobRow = (id, title, code) => ({ id, created_time: "2026-09-10T08:00:00.000Z", properties: {
  "العنوان الوظيفي": ti(title), "رمز صاحب العمل": rt(code), "المدينة": rt("الرياض"), "المجال": se("محاسبة ومالية"),
  "الوصف والمتطلبات": rt("مطلوب محاسب."), "الحالة": se("نشطة") } });
const JOB_ROWS = [jobRow(FREE_JOB, "إعلان المجاني", ORG_FREE), jobRow(SUB_JOB, "إعلان المشترك", SUB_CODE)];

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
    if ("starts_with" in f.rich_text) return v.toLowerCase().startsWith(String(f.rich_text.starts_with).toLowerCase());
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

let empDbFails = false;     // خللٌ في قاعدة أصحاب العمل ⇒ يجب أن يكون الحجب
let aiCalls = 0;
const patched = [];

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://azure.test/")) {
    aiCalls++;
    return json({ choices: [{ message: { content: "نصٌّ من النموذج المُحاكى." } }] });
  }
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  const body = init.body ? JSON.parse(init.body) : {};
  const pm = /\/pages\/([^/?]+)$/.exec(u);
  if (pm) {
    const id = decodeURIComponent(pm[1]);
    if ((init.method || "GET").toUpperCase() === "PATCH") { patched.push({ id, body }); return json({ id }); }
    const row = ATS_ROWS.find((r) => r.id === id) || JOB_ROWS.find((r) => r.id === id);
    return row ? json(row) : json({ message: "Could not find page" }, 404);
  }
  if (/\/blocks\//.test(u)) return json({ results: [], has_more: false });
  const m = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (!m) return json({}, 404);
  const f = body.filter || {};
  if (m[1] === EMP_DB) {
    if (empDbFails) return new Response('{"message":"simulated outage"}', { status: 500 });
    if (f.and) {   // البحث بالرمز: resolvePlan
      const code = (f.and.find((x) => x.property === "رمز الوصول") || {}).rich_text;
      const st = (f.and.find((x) => x.property === "الحالة") || {}).select;
      return json({ results: EMP_ROWS.filter((r) => rtText(r.properties["رمز الوصول"]) === (code && code.equals) && r.properties["الحالة"].select.name === (st && st.equals)), has_more: false });
    }
    const want = String((f.email && (f.email.equals || f.email.contains)) || "").toLowerCase();
    return json({ results: EMP_ROWS.filter((r) => (r.properties["البريد"].email || "").toLowerCase() === want), has_more: false });
  }
  if (m[1] === JOBS_DB) {
    let rows = JOB_ROWS;
    if (f.property === "رمز صاحب العمل") rows = rows.filter((r) => rtText(r.properties["رمز صاحب العمل"]) === f.rich_text.equals);
    return json({ results: rows, has_more: false });
  }
  if (m[1] === METRICS_DB) return json({ results: [], has_more: false });
  if (m[1] === ATS_DB) {
    const rows = ATS_ROWS.filter((r) => evalFilter(r, f)).slice(0, body.page_size || 100);
    return json({ results: rows, has_more: false, next_cursor: null });
  }
  return json({ results: [], has_more: false });
};

const { default: handler, mapCandidate } = await import("../api/candidates.js");
const { default: hire } = await import("../api/hire.js");
const SRC = await import("../api/_sources.js");

// ------------------------------------------------------------- الاستدعاء --
function call(h, method, url, { sid = "", body, ip = "203.0.113.7" } = {}) {
  let out = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
  const req = { method, url, body, headers: { "x-forwarded-for": ip, ...(sid ? { cookie: `bp_sid=${sid}` } : {}) }, on() {} };
  return h(req, res).then(() => ({ status: status || 200, raw: out, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}
const get = (qs, opts) => call(handler, "GET", "/api/candidates?" + qs, opts);
const post = (body, opts) => call(handler, "POST", "/api/candidates", { ...opts, body });
const hpost = (body, opts) => call(hire, "POST", "/api/hire", { ...opts, body });

// كل قيمةٍ سرّية، وكل اسم عمودٍ داخلي: لا شيء منها يظهر في حمولة صاحب عملٍ بلا اشتراك.
const PII = [C.nameAr, C.nameEn, C.email, C.phone, C.phoneIntl.slice(4), C.cvOrig, C.cvAts, C.cvText, C.interviewLink,
  "مكان-مقابلة-كاناري", "تفصيل-توطين-كاناري", C.reason];
// داخلي للجميع (حتى المشترك): الشريك ومعرّف المكتب ووسم المصدر وأسماء الأعمدة.
const INTERNAL = [C.office, C.officeEmail, C.sourceTag, C.officeId, SOURCE_COL, OFFICE_COL];
const clean = (raw, list, what) => { for (const v of list) assert.ok(!raw.includes(v), `${what}: تسرّب «${v}»`); };

// ═══════════════════ ① الحساب المجاني: لا شيء يعرّف مرشّح القاعدة ═══════════════════
const FREE = { sid: SID.free };
const FREE_PATHS = {
  "قائمة مصفَّحة": "limit=40",
  "قائمة قديمة بلا limit": "",
  "بحث q": "limit=40&q=" + encodeURIComponent("محاسب"),
  "مطابقة forJob": "limit=40&forJob=" + FREE_JOB,
  "مطابقة مقيَّمة (scored)": "limit=40&scored=1&forJob=" + FREE_JOB,
  "ملف مرشّح ?id=": "id=" + POOL1,
  "ملف مرشّح مقيَّم ?id=": "id=" + POOL_SCORED,
};

for (const [what, qs] of Object.entries(FREE_PATHS)) {
  test(`مجاني · ${what}: لا اسم ولا بريد ولا جوال ولا سيرة ولا حقل داخلي`, async () => {
    for (const code of ["self", "", ORG_FREE]) {
      const r = await get(qs + (qs ? "&" : "") + "code=" + encodeURIComponent(code), FREE);
      assert.equal(r.status, 200, r.raw.slice(0, 200));
      assert.equal(r.data.unlocked, false, "unlocked تعني: البيانات مفتوحة");
      // متقدّمو إعلانه (applied) يظهرون له كاملين — وهذا مقصود (انظر ③) — فيُستثنون من
      // الفحص، وما عداهم هو قاعدة المواهب.
      const scan = r.data.candidates ? JSON.stringify({ ...r.data, candidates: r.data.candidates.filter((c) => !c.applied) }) : r.raw;
      clean(scan, PII, `${what} [code=${code || "—"}]`);
      clean(r.raw, INTERNAL, what);
    }
  });
}

test("مجاني · القائمة: الاسم فارغ ومُعلَّم locked، والمهنة والخبرة والجنسية باقية", async () => {
  const r = await get("limit=40&code=self", FREE);
  assert.equal(r.data.free, true);
  const pool = r.data.candidates.find((c) => c.id === POOL1);
  assert.ok(pool, "مرشّح القاعدة غاب كلّه");
  assert.equal(pool.name, "");
  assert.equal(pool.locked, true);
  assert.equal(pool.role, "محاسب أول");
  assert.equal(pool.experience, "7");
  assert.equal(pool.nationalityType, "غير سعودي");
  assert.ok(pool.nationality, "الجنسية الكاملة مما يراه المجاني");
  for (const k of ["phone", "email", "cv", "cvText", "cvLink", "nameAlt", "viaPartner", "interviewLink"]) {
    assert.ok(!(k in pool), `الحقل «${k}» لا يُعاد للمجاني`);
  }
});

test("مجاني · ملف المرشّح ?id=: حقول المقابلة والامتثال للمشترك وحده", async () => {
  const r = await get("id=" + POOL1 + "&code=self", FREE);
  assert.equal(r.status, 200);
  const c = r.data.candidate;
  assert.equal(c.name, "");
  for (const k of ["interviewDate", "hiredDate", "pipelineStage", "interviewStatus", "interviewMode", "interviewLink",
    "interviewPlace", "compliance", "saudizationDetails", "originalPosition", "cvText", "cvLink", "atsDocUrl", "phone", "email"]) {
    assert.ok(!(k in c), `الحقل «${k}» لا يُعاد للمجاني`);
  }
});

test("مجاني · البحث بالبريد/الرقم يُردّ فارغاً — لا أداة تحقّقٍ من وجوده", async () => {
  for (const q of [C.email, C.phone]) {
    const r = await get("limit=40&code=self&q=" + encodeURIComponent(q), FREE);
    assert.equal(r.status, 200);
    assert.equal(r.data.candidates.length, 0);
  }
});

test("مجاني · البحث بكلمةٍ لا توجد إلا في نصّ السيرة لا يُرجع شيئاً", async () => {
  const r = await get("limit=40&code=self&q=" + encodeURIComponent(C.cvText), FREE);
  assert.equal(r.status, 200);
  assert.equal(r.data.candidates.length, 0, "نصّ السيرة لا يُبحث فيه إلا لمشترك");
});

test("مجاني · المطابقة: النسبة المخزَّنة تظهر بلا سببها", async () => {
  const r = await get("limit=40&forJob=" + FREE_JOB + "&code=self", FREE);
  const scored = r.data.candidates.find((c) => c.id === POOL_SCORED);
  assert.ok(scored, "مرشّح القاعدة المقيَّم غاب");
  assert.equal(scored.match.score, 88);
  assert.equal(scored.match.locked, true);
  assert.ok(!("reason" in scored.match) && !("for" in scored.match));
  assert.equal(scored.name, "");
});

// ═══════════════════ ③ المتقدّمون على إعلانه يبقون ظاهرين ═══════════════════
test("مجاني · ?applicants=1: متقدّمو إعلانه كاملون، ولا متقدّم لغيره", async () => {
  const r = await get("applicants=1&code=self", FREE);
  assert.equal(r.status, 200);
  const all = r.data.jobs.flatMap((j) => j.applicants);
  const a = all.find((x) => x.id === APPL_FREE);
  assert.ok(a, "متقدّمٌ على إعلانه اختفى بسبب الحجب");
  assert.equal(a.name, C.applName);
  assert.equal(a.email, C.applEmail);
  assert.equal(a.phone, C.applPhone);
  assert.equal(a.cv, C.applCv);
  assert.ok(!r.raw.includes(C.otherApplName), "متقدّم إعلان غيره ظهر");
  clean(r.raw, [C.nameAr, C.office, C.officeId, C.sourceTag], "applicants");
});

test("مجاني · ?applicant=1: ملف متقدّمه مفتوح بسيرته، وملف غيره 404", async () => {
  const mine = await get("applicant=1&id=" + APPL_FREE + "&code=self", FREE);
  assert.equal(mine.status, 200);
  assert.ok(mine.data.candidate.cvText.includes(C.cvText));
  clean(mine.raw, INTERNAL, "applicant");
  const other = await get("applicant=1&id=" + APPL_OTHER + "&code=self", FREE);
  assert.equal(other.status, 404);
  const pool = await get("applicant=1&id=" + POOL1 + "&code=self", FREE);
  assert.equal(pool.status, 404, "مرشّح قاعدة لا يُفتح ملفه من باب المتقدّمين");
});

test("مجاني · المطابقة: من تقدّم على الإعلان المختار يظهر باسمه، ومرشّح القاعدة مموّه", async () => {
  const r = await get("limit=40&forJob=" + FREE_JOB + "&code=self", FREE);
  const ap = r.data.candidates.find((c) => c.id === APPL_FREE);
  assert.ok(ap, "المتقدّم غاب من قائمة المطابقة");
  assert.equal(ap.applied, true);
  assert.equal(ap.name, C.applName);
  assert.ok(!ap.locked);
  const pool = r.data.candidates.find((c) => c.id === POOL1);
  assert.equal(pool.name, "");
  assert.equal(pool.applied, false);
  assert.ok(!r.raw.includes(C.nameAr) && !r.raw.includes(C.email));
  clean(r.raw, INTERNAL, "forJob");
});

test("مجاني · نشر إعلانٍ وإدارة متقدّميه تعمل كما كانت (الاشتراك للبيانات لا للأدوات)", async () => {
  const lp = await post({ action: "list-postings", code: "self" }, FREE);
  assert.equal(lp.status, 200);
  assert.deepEqual(lp.data.postings.map((p) => p.id), [FREE_JOB]);
  const stage = await post({ action: "update-stage", id: APPL_FREE, stage: "interview", code: "self" }, FREE);
  assert.equal(stage.status, 200, stage.raw);
  const foreign = await post({ action: "update-stage", id: POOL1, stage: "interview", code: "self" }, FREE);
  assert.equal(foreign.status, 404, "مرشّح قاعدة لا تُحرَّك مرحلته من حسابٍ مجاني");
});

test("مجاني · validate=1 يقول sub:false ولا يعيد رمز الوصول", async () => {
  const r = await get("validate=1&code=self", FREE);
  assert.equal(r.data.unlocked, true, "اللوحة تُفتح");
  assert.equal(r.data.sub, false, "والبيانات لا");
  assert.equal(r.data.portal, true);
  assert.ok(!r.raw.includes("org-free") || !/"code"\s*:\s*"self"/.test(r.raw));
});

// ═══════════════════ ④ الفشل يُغلق ═══════════════════
test("صفٌّ معلّق (بانتظار الدفع): حجب، وبالرمز الصريح كذلك", async () => {
  for (const code of ["self", PEND_CODE]) {
    const r = await get("limit=40&code=" + code, { sid: SID.pend });
    assert.equal(r.status, 200);
    assert.equal(r.data.unlocked, false);
    clean(r.raw, [...PII, ...INTERNAL], "pending " + code);
  }
});

test("رمزٌ لا يطابق صفاً مفعّلاً، بجلسة عميل: حجب (كان يُفتح بجلسة العميل)", async () => {
  const r = await get("limit=40&code=BP-EMP-NOTAREALCODE0", { sid: SID.free });
  assert.equal(r.status, 200);
  assert.equal(r.data.unlocked, false);
  clean(r.raw, [...PII, ...INTERNAL], "bad code");
});

test("مشتركٌ بالجلسة وقاعدة أصحاب العمل معطّلة: حجب لا فتح", async () => {
  empDbFails = true;
  try {
    for (const qs of ["limit=40&code=self", "id=" + POOL1 + "&code=self", "limit=40&code=" + SUB_CODE]) {
      const r = await get(qs, { sid: SID.sub });
      assert.equal(r.status, 200, qs);
      assert.equal(r.data.unlocked, false, qs);
      clean(r.raw, [...PII, ...INTERNAL], "outage " + qs);
    }
    const v = await get("validate=1&code=self", { sid: SID.sub });
    assert.equal(v.data.sub, false);
  } finally { empDbFails = false; }
});

test("زائرٌ عام (بلا جلسة): الأحرف الأولى كما كان، لا اسم كامل ولا تواصل", async () => {
  const r = await get("limit=40&field=" + encodeURIComponent("محاسبة ومالية"));
  assert.equal(r.status, 200);
  const c = r.data.candidates.find((x) => x.id === POOL1);
  assert.ok(c && c.name && c.name !== "", "الزائر العام يرى الأحرف الأولى");
  clean(r.raw, [...PII, ...INTERNAL], "public");
  const d = await get("id=" + POOL1);
  clean(d.raw, [...PII, ...INTERNAL], "public detail");
  assert.ok(!("interviewLink" in d.data.candidate), "رابط المقابلة كان يخرج للزائر العام في ?id=");
});

// ═══════════════════ ② المشترك: لا انحدار ═══════════════════
test("مشترك (جلسة): القائمة بالأسماء والبريد والجوال والسيرة كما كانت", async () => {
  const r = await get("limit=40&code=self", { sid: SID.sub });
  assert.equal(r.status, 200);
  assert.equal(r.data.unlocked, true);
  assert.ok(!r.data.free);
  const c = r.data.candidates.find((x) => x.id === POOL1);
  assert.equal(c.name, C.nameEn + "P1");
  assert.equal(c.phone, C.phone);
  assert.equal(c.email, C.email);
  assert.equal(c.cv, C.cvAts);
  assert.ok(!c.locked);
  clean(r.raw, INTERNAL, "مشترك: القائمة");
});

test("مشترك (رمز صريح، كلمة المرور): القائمة والملف والبحث في السيرة", async () => {
  const list = await get("limit=40&code=" + SUB_CODE);
  assert.equal(list.data.unlocked, true);
  assert.equal(list.data.candidates.find((x) => x.id === POOL1).email, C.email);
  const det = await get("id=" + POOL1 + "&code=" + SUB_CODE);
  const c = det.data.candidate;
  assert.equal(c.name, C.nameEn + "P1");
  assert.ok(c.cvText.includes(C.cvText));
  assert.equal(c.cvLink, C.cvOrig);
  assert.equal(c.interviewLink, C.interviewLink, "حقول المقابلة للمشترك كما كانت");
  assert.equal(c.compliance, "✅ مطابق");
  clean(det.raw, INTERNAL, "مشترك: الملف");
  const q = await get("limit=40&code=" + SUB_CODE + "&q=" + encodeURIComponent(C.cvText));
  assert.ok(q.data.candidates.some((x) => x.id === POOL1), "المشترك يبحث في نصّ السيرة");
});

test("مشترك: المطابقة بسببها الكامل، والحقلان الداخليان لا يخرجان", async () => {
  const r = await get("limit=40&forJob=" + SUB_JOB + "&code=self", { sid: SID.sub });
  assert.equal(r.status, 200);
  const unscored = r.data.candidates.find((c) => c.id === POOL1);
  assert.equal(unscored.name, C.nameEn + "P1");
  clean(r.raw, INTERNAL, "مشترك: forJob");
  // سبب الدرجة محفوظٌ لإعلان المجاني فلا يظهر للمشترك أصلاً (ownedScore) — وهذا قائم قبلنا.
  assert.ok(!r.raw.includes(C.reason));
});

test("مشترك: ?applicants=1 و?applicant=1 كما كانا", async () => {
  const r = await get("applicants=1&code=self", { sid: SID.sub });
  const all = r.data.jobs.flatMap((j) => j.applicants);
  assert.deepEqual(all.map((x) => x.id), [APPL_OTHER]);
  assert.equal(all[0].name, C.otherApplName);
  clean(r.raw, INTERNAL, "مشترك: applicants");
  const one = await get("applicant=1&id=" + APPL_OTHER + "&code=self", { sid: SID.sub });
  assert.equal(one.status, 200);
  clean(one.raw, INTERNAL, "مشترك: applicant");
});

test("الفريق (OWNER_EMAILS) بلا صفّ اشتراك: يرى كل شيء — لا يُحجب المالك", async () => {
  const r = await get("limit=40&code=self", { sid: SID.staff });
  assert.equal(r.data.unlocked, true);
  assert.equal(r.data.candidates.find((x) => x.id === POOL1).email, C.email);
  const v = await get("validate=1&code=self", { sid: SID.staff });
  assert.equal(v.data.sub, true);
});

// ═══════════════════ ⑤ حارس المخرجات (طلب وكيل المكاتب) ═══════════════════
test("حارس المخرجات: صفٌّ فيه «مصدر المرشح» و«معرّف المكتب» لا يخرج منه أيٌّ منهما بأي طبقة", () => {
  assert.equal(SRC.SOURCE_PROP, SOURCE_COL);
  assert.equal(SRC.OFFICE_ID_PROP, OFFICE_COL);
  const pg = ATS_ROWS.find((r) => r.id === POOL1);
  const variants = {
    "مشترك": [true, { full: true, cvInList: true }],
    "مشترك (ملف)": [true, { full: true }],
    "مجاني": [false, { free: true }],
    "مجاني (ملف)": [false, { free: true, full: true }],
    "زائر": [false, {}],
    "زائر (ملف)": [false, { full: true }],
  };
  for (const [what, [unlocked, opts]] of Object.entries(variants)) {
    const out = mapCandidate(pg, unlocked, opts);
    const raw = JSON.stringify(out);
    clean(raw, [C.sourceTag, C.officeId, C.office, C.officeEmail, SOURCE_COL, OFFICE_COL], "mapCandidate " + what);
    for (const k of Object.keys(out)) assert.ok(!SRC.INTERNAL_SOURCE_PROPS.includes(k), `${what}: مفتاح داخلي «${k}»`);
  }
  // مجاني/زائر: لا بيانات تواصل ولا سيرة، ولا اسم كامل.
  for (const opts of [{ free: true }, {}]) {
    const raw = JSON.stringify(mapCandidate(pg, false, opts));
    clean(raw, PII, "mapCandidate بلا اشتراك");
  }
});

test("حارس المخرجات: لا مسار يعيد الحقلين لصاحب عمل — مجاني أو مشترك أو فريق", async () => {
  const paths = [...Object.values(FREE_PATHS), "applicants=1", "applicant=1&id=" + APPL_FREE, "validate=1"];
  for (const sid of [SID.free, SID.sub, SID.staff, SID.pend]) {
    for (const qs of paths) {
      const r = await get(qs + (qs ? "&" : "") + "code=self", { sid });
      clean(r.raw, INTERNAL, `sid=${sid} ${qs}`);
    }
  }
  // request-interview يردّ routed:"office" إن كان للمرشّح مكتب — الكلمة لا الاسم ولا المعرّف.
  const ri = await post({ action: "request-interview", id: APPL_FREE, code: "self" }, FREE);
  clean(ri.raw, INTERNAL, "request-interview");
});

// ═══════════════════ مساعد التوظيف (api/hire.js) ═══════════════════
test("hire · score: مرشّح قاعدة بلا اشتراك ⇒ subscription_required بلا نموذج", async () => {
  const before = aiCalls;
  for (const peek of [true, false]) {
    const r = await hpost({ task: "score", postingId: FREE_JOB, candidateIds: [POOL1], peek, code: "self" }, FREE);
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.data.results[0].error, "subscription_required");
    assert.ok(!r.raw.includes(C.nameAr) && !r.raw.includes(C.cvText));
  }
  assert.equal(aiCalls, before, "نموذجٌ نودي لمرشّحٍ محجوب");
});

test("hire · score: متقدّم على إعلانه يعمل بلا اشتراك", async () => {
  const r = await hpost({ task: "score", postingId: FREE_JOB, candidateIds: [APPL_FREE], peek: true, code: "self" }, FREE);
  assert.equal(r.status, 200, r.raw);
  assert.equal(r.data.results[0].ok, true, r.raw);
});

test("hire · summary/interview/outreach بلا اشتراك ⇒ 403 subscription_required، وللمشترك تمرّ", async () => {
  for (const task of ["summary", "interview", "outreach"]) {
    const before = aiCalls;
    const r = await hpost({ task, candidate: { role: "محاسب" }, code: "self" }, FREE);
    assert.equal(r.status, 403, task);
    assert.equal(r.data.error, "subscription_required");
    assert.equal(aiCalls, before);
    const ok = await hpost({ task, candidate: { role: "محاسب" }, code: "self" }, { sid: SID.sub });
    assert.equal(ok.status, 200, task + " " + ok.raw);
  }
});

test("hire · jobdesc ومطابقة القائمة تعمل بلا اشتراك (الأدوات لا البيانات)", async () => {
  const jd = await hpost({ task: "jobdesc", title: "محاسب", code: "self" }, FREE);
  assert.equal(jd.status, 200, jd.raw);
  const mt = await hpost({ task: "match", role: "محاسب", candidates: [{ id: POOL1, role: "محاسب" }], code: "self" }, FREE);
  assert.equal(mt.status, 200, mt.raw);
});

test("hire · الفريق بلا صفّ اشتراك يقدّر على كل شيء كالمشترك", async () => {
  const r = await hpost({ task: "summary", candidate: { role: "محاسب" }, code: "self" }, { sid: SID.staff });
  assert.equal(r.status, 200, r.raw);
});
