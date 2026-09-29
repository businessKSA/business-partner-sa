// مساعد التوظيف الذكي — من يملك نداء النموذج، ومن يدفع ثمنه؟ (api/hire.js)
//
// شغّله: npm test
//
// ما الذي يُثبَّت هنا، ولماذا كلٌّ منه يستحقّ اختباراً:
//
// حتى 2026-09-29 كان معالج POST /api/hire يمضي من قراءة الجسم إلى نداء
// النموذج مباشرةً: بلا جلسة، بلا رمز صاحب عمل، بلا باقة، بلا سقف. أي أحد على
// الإنترنت كان يستهلك رصيد Azure للمالك — و`task:"match"` مع `postingId`
// **يكتب في نوشن**، فيعدّل «المرشحون المطابقون» في إعلانٍ حقيقي. عاش التسريب
// لأن لا اختبار يقيسه، فهذه الاختبارات هي ما يمنع عودته بدفعةٍ واحدة.
//
// وله وجهان متساويان في الأهمية:
//   ① أن يُقفل ما هو لصاحب العمل: jobdesc · summary · interview · outreach،
//      و`match` **مع postingId** (وهي الكتابة) — ولا يكفي أن يكون المُستدعي
//      مشتركاً: يجب أن يكون الإعلان إعلانَه.
//   ② ألا يُقفل ما هو عامٌّ بحقّ: `translate` (صفحة الإعلان تترجم لكل زائر)
//      و`cv-boost` (للمرشّح لا لصاحب العمل) و`match` بلا postingId (تبويب
//      /hiring العامة، وإيجنت الباحث عن عمل من الخادم إلى الخادم). تشديدٌ
//      يقفل واحدةً من هؤلاء عطلٌ آخر بلبوس إصلاح.
//
// وللسقف والقياس شرطان يُقاسان هنا أيضاً: **المالك بلا سقف**، و**فشل التسجيل
// لا يُسقط النداء** — خدمةٌ تتعطّل لأن عدّادها تعطّل أسوأ من عدّادٍ ناقص.
//
// كلّه على `handler` الحقيقي: الجلسة تُقرأ من api/_db.js فعلاً (LOCAL_DB=1 →
// ملف JSON مؤقّت)، ونوشن وAzure وحدهما مُحاكيان. بلا شبكة: أي fetch إلى غيرهما
// يُرمى.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------- الجلسة --
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-hire-gate-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();

const OWNER_EMAIL = "dr.baher.magnas@gmail.com";
const EMPLOYER_EMAIL = "mohammed@example.com";
const CAP_EMAIL = "capped@example.com";
const SID = { owner: "sid-owner", employer: "sid-employer", capped: "sid-capped" };

fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-owner", email: OWNER_EMAIL, full_name: "المالك", locale: "ar" },
    { id: "u-emp", email: EMPLOYER_EMAIL, full_name: "محمد", locale: "ar" },
    { id: "u-cap", email: CAP_EMAIL, full_name: "شركة السقف", locale: "ar" },
  ],
  organizations: [
    { id: "org-owner", name_ar: "بيزنس بارتنر", created_at: new Date().toISOString() },
    { id: "org-emp", name_ar: "شركة محمد", created_at: new Date().toISOString() },
    { id: "org-cap", name_ar: "شركة السقف", created_at: new Date().toISOString() },
  ],
  user_sessions: [
    { id: "s1", user_id: "u-owner", organization_id: "org-owner", token_hash: sha(SID.owner), revoked_at: null, expires_at: future },
    { id: "s2", user_id: "u-emp", organization_id: "org-emp", token_hash: sha(SID.employer), revoked_at: null, expires_at: future },
    { id: "s3", user_id: "u-cap", organization_id: "org-cap", token_hash: sha(SID.capped), revoked_at: null, expires_at: future },
  ],
  audit_logs: [],
}, null, 2));

// تُضبط قبل الاستيراد: الوحدات تقرأ البيئة وقت التحميل لا وقت النداء.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.OWNER_EMAIL = OWNER_EMAIL;
// Azure مُهيّأ وهماً: بلا هذا يعود المعالج بـ503 قبل أن يصل إلى المصادقة،
// فتمرّ اختبارات الصلاحيات كاذبةً.
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_TEXT_DEPLOYMENT = "gpt-test";
delete process.env.AZURE_OPENAI_ENDPOINT_2;
// ‏BP_OPEN_ACCESS/‏رمز التجربة يفتحان كل شيء — لا يُتركان في اختبارٍ عن الصلاحيات.
delete process.env.OWNER_DEMO_CODE;
delete process.env.EMPLOYER_CODES;
delete process.env.BP_OPEN_ACCESS;
// حدودٌ عالية افتراضاً، ويُشدَّد كلٌّ في اختباره ثم يُعاد.
process.env.HIRE_DAILY_LIMIT = "500";
process.env.HIRE_ANON_DAILY_LIMIT = "500";
process.env.HIRE_ANON_TOTAL_DAILY_LIMIT = "5000";

// ------------------------------------------------------------ نوشن مُحاكى --
const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";   // أصحاب العمل — الاشتراكات

const OWNER_CODE = "BP-EMP-MYTD63BKZAPB";
const EMPLOYER_CODE = "BP-EMP-NKATJ6ZKX7HH";
const CAP_CODE = "BP-EMP-QQ77ZZ44MMBB";

const ti = (s) => ({ type: "title", title: s ? [{ plain_text: String(s) }] : [] });
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: String(s) }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const em = (s) => ({ type: "email", email: s || null });

const EMP_ROWS = [
  { id: "emp-owner", created_time: "2026-01-01T00:00:00.000Z", properties: {
    "اسم الشركة": ti("Business Partner — المالك"), "البريد": em(OWNER_EMAIL),
    "الحالة": se("مفعّل"), "الباقة": se("مؤسسية"), "رمز الوصول": rt(OWNER_CODE) } },
  { id: "emp-mohammed", created_time: "2026-02-01T00:00:00.000Z", properties: {
    "اسم الشركة": ti("شركة محمد"), "البريد": em(EMPLOYER_EMAIL),
    "الحالة": se("مفعّل"), "الباقة": se("احترافية"), "رمز الوصول": rt(EMPLOYER_CODE) } },
  { id: "emp-capped", created_time: "2026-03-01T00:00:00.000Z", properties: {
    "اسم الشركة": ti("شركة السقف"), "البريد": em(CAP_EMAIL),
    "الحالة": se("مفعّل"), "الباقة": se("أساسية"), "رمز الوصول": rt(CAP_CODE) } },
];

const MY_POSTING = "11111111-aaaa-2222-bbbb-333333333333";
const OTHER_POSTING = "99999999-cccc-8888-dddd-777777777777";
const POSTINGS = {
  [MY_POSTING]: EMPLOYER_CODE,
  [OTHER_POSTING]: OWNER_CODE,
};
// معرّف مرشّح على شكل معرّف صفحة نوشن — النموذج يعيده، والمعالج يفلتر بالنمط.
const CAND_ID = "abcdef12-3456-7890-abcd-ef1234567890";

const patched = [];      // كل PATCH وصل نوشن — أي كل كتابةٍ فعلية
let aiCalls = 0;

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

  // ---- Azure: النموذج مُحاكى، ولا يُنادى إلا بعد أن تمرّ المصادقة والسقف.
  if (u.startsWith("https://azure.test/")) {
    aiCalls++;
    const body = init.body ? JSON.parse(init.body) : {};
    const prompt = (body.messages || []).map((m) => m.content).join("\n");
    const content = /المطلوب توظيفه/.test(prompt)
      ? JSON.stringify([{ id: CAND_ID, score: 91, reason: "مطابقة عالية" }])
      : "نصٌّ من النموذج المُحاكى.";
    return json({ choices: [{ message: { content } }] });
  }

  // ---- نوشن
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  const q = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (q) {
    if (q[1] !== EMP_DB) return json({ results: [], has_more: false });
    const f = (init.body ? JSON.parse(init.body) : {}).filter || {};
    const want = String((f.email && (f.email.equals || f.email.contains)) || "").toLowerCase();
    return json({ results: EMP_ROWS.filter((r) => (r.properties["البريد"].email || "").toLowerCase() === want), has_more: false });
  }
  const pg = /\/v1\/pages\/([0-9a-f-]+)$/i.exec(u);
  if (pg) {
    const id = pg[1];
    if ((init.method || "GET").toUpperCase() === "PATCH") {
      patched.push({ id, body: JSON.parse(init.body || "{}") });
      return json({ id });
    }
    if (!POSTINGS[id]) return json({ message: "not found" }, 404);
    return json({ id, properties: { "رمز صاحب العمل": rt(POSTINGS[id]) } });
  }
  return json({}, 404);
};

const { default: handler } = await import("../api/hire.js");
const { sink, HIRE_ACTION } = await import("../api/_hiremeter.js");
const { sb } = await import("../api/_db.js");

// ------------------------------------------------------------- الاستدعاء --
function post(body, { sid = "", ip = "203.0.113.9" } = {}) {
  let out = "", status = 0;
  const res = {
    setHeader() {},
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { out = b; },
  };
  const req = {
    method: "POST", url: "/api/hire", body,
    headers: { "x-forwarded-for": ip, ...(sid ? { cookie: `bp_sid=${sid}` } : {}) },
    on() {},
  };
  return handler(req, res).then(() => ({
    status: status || 200,
    data: (() => { try { return JSON.parse(out); } catch { return null; } })(),
  }));
}
const meterRows = () => sb(`audit_logs?action=eq.${HIRE_ACTION}&select=id,actor_label,after`);

// ═══════════════════════════════════════ ① ما يجب أن يُقفل — وكان مفتوحاً ══
test("بلا مصادقة: مهامّ صاحب العمل الأربع تُرفض بـ403 locked", async () => {
  for (const task of ["jobdesc", "summary", "interview", "outreach"]) {
    const before = aiCalls;
    const r = await post({ task, title: "محاسب", candidate: { role: "محاسب" } }, { ip: "198.51.100.1" });
    assert.equal(r.status, 403, `${task} مرّ بلا مصادقة`);
    assert.equal(r.data.error, "locked");
    assert.equal(aiCalls, before, `${task} نادى النموذج قبل المصادقة — رصيد Azure`);
  }
});

test("بلا مصادقة: match مع postingId تُرفض — هي الكتابة في نوشن", async () => {
  const before = patched.length;
  const r = await post({ task: "match", postingId: MY_POSTING, role: "محاسب", candidates: [{ id: CAND_ID }] }, { ip: "198.51.100.2" });
  assert.equal(r.status, 403);
  assert.equal(r.data.error, "locked");
  assert.equal(patched.length, before, "غريبٌ كتب في إعلانٍ حقيقي");
});

// ═════════════════════════════════════ ② ما يجب أن يبقى مفتوحاً — لا يُكسر ══
test("عامّة بحقّ: translate وcv-boost وmatch بلا postingId تمرّ بلا حساب", async () => {
  const tr = await post({ task: "translate", lang: "en", text: "وصف الوظيفة" }, { ip: "198.51.100.3" });
  assert.equal(tr.status, 200, "ترجمة الإعلان أُقفلت على زوّار الموقع");
  assert.equal(tr.data.ok, true);

  const cv = await post({ task: "cv-boost", cvText: "سيرة ذاتية" }, { ip: "198.51.100.4" });
  assert.equal(cv.status, 200, "cv-boost أُقفل على المرشّحين");
  assert.equal(cv.data.ok, true);

  const mt = await post({ task: "match", role: "محاسب", candidates: [{ id: CAND_ID, role: "محاسب" }] }, { ip: "198.51.100.5" });
  assert.equal(mt.status, 200, "مطابقة /hiring العامة وإيجنت الباحث عن عمل أُقفلا");
  assert.equal(mt.data.ok, true);
  assert.equal(mt.data.ranked.length, 1);
});

// ═════════════════════════════════════════ ③ صاحب العمل المشترك يعمل كما كان ══
test("بجلسة بريدٍ مُثبت: jobdesc تمرّ، ورمز الوصول يُحلّ في الخادم", async () => {
  const r = await post({ task: "jobdesc", title: "محاسب" }, { sid: SID.employer });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(typeof r.data.result, "string");
});

test("match مع postingId: تُكتب في إعلانه، ولا تُكتب في إعلان غيره", async () => {
  const mine = await post({ task: "match", postingId: MY_POSTING, role: "محاسب", candidates: [{ id: CAND_ID }] }, { sid: SID.employer });
  assert.equal(mine.status, 200);
  assert.equal(patched.length, 1, "لم تُكتب المطابقة في إعلان صاحبها");
  assert.equal(patched[0].id, MY_POSTING);

  const theirs = await post({ task: "match", postingId: OTHER_POSTING, role: "محاسب", candidates: [{ id: CAND_ID }] }, { sid: SID.employer });
  assert.equal(theirs.status, 200, "النتيجة تعود لصاحبها");
  assert.equal(theirs.data.ok, true);
  assert.equal(patched.length, 1, "مشتركٌ كتب في إعلان مشتركٍ آخر");
});

// ══════════════════════════════════════════════════════════ ④ القياس ══
test("القياس: كل نداءٍ ناجح يُسجَّل — وبلا رمز الوصول في السجلّ", async () => {
  const before = (await meterRows()).length;
  await post({ task: "jobdesc", title: "سكرتير" }, { sid: SID.employer });
  const rows = await meterRows();
  assert.equal(rows.length, before + 1, "نداءٌ ناجح لم يُسجَّل — فلا فوترة");
  const last = rows[rows.length - 1];
  assert.equal(last.after.task, "jobdesc");
  assert.equal(last.after.kind, "employer");
  assert.ok(last.after.chars_in > 0 && last.after.chars_out > 0, "حجم المدخل والمخرج مفقود");
  assert.equal(last.after.company, "شركة محمد");
  const blob = JSON.stringify(rows);
  for (const code of [EMPLOYER_CODE, OWNER_CODE, CAP_CODE]) {
    assert.ok(!blob.includes(code), "رمز الوصول كُتب في سجلّ القياس");
  }
});

test("فشل التسجيل لا يُسقط النداء — ولا فشل العدّ", async () => {
  const realWrite = sink.write, realCount = sink.count;
  try {
    sink.write = async () => { throw new Error("db down"); };
    const r = await post({ task: "jobdesc", title: "مندوب" }, { sid: SID.employer });
    assert.equal(r.status, 200, "عدّادٌ معطّل أسقط خدمةً تعمل");
    assert.equal(r.data.ok, true);

    sink.write = realWrite;
    sink.count = async () => { throw new Error("db down"); };
    const r2 = await post({ task: "jobdesc", title: "مندوب ٢" }, { sid: SID.employer });
    assert.equal(r2.status, 200, "تعذّر العدّ منع الخدمة بدل أن يفتحها");
  } finally {
    sink.write = realWrite;
    sink.count = realCount;
  }
});

// ═══════════════════════════════════════════════════════════ ⑤ السقف ══
test("تجاوز السقف اليومي: 429 برسالة عربية تقول الحدّ ومتى يتجدّد", async () => {
  process.env.HIRE_DAILY_LIMIT = "2";
  try {
    const a = await post({ task: "jobdesc", title: "١" }, { sid: SID.capped });
    const b = await post({ task: "jobdesc", title: "٢" }, { sid: SID.capped });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const before = aiCalls;
    const c = await post({ task: "jobdesc", title: "٣" }, { sid: SID.capped });
    assert.equal(c.status, 429);
    assert.equal(c.data.error, "rate_limited");
    assert.equal(c.data.limit, 2);
    assert.ok(/الحدّ اليومي/.test(c.data.message), "رسالة السقف ليست عربيةً مفهومة");
    assert.ok(/يتجدّد/.test(c.data.message), "الرسالة لا تقول متى يتجدّد الحدّ");
    assert.ok(Date.parse(c.data.resets_at) > Date.now(), "resets_at ليس وقتاً قادماً");
    assert.equal(aiCalls, before, "السقف لم يمنع نداء النموذج — فلا يحمي رصيداً");
  } finally { process.env.HIRE_DAILY_LIMIT = "500"; }
});

test("المالك بلا سقف", async () => {
  process.env.HIRE_DAILY_LIMIT = "1";
  try {
    for (let i = 0; i < 3; i++) {
      const r = await post({ task: "jobdesc", title: "إعلان " + i }, { sid: SID.owner });
      assert.equal(r.status, 200, "المالك اصطدم بسقف");
      assert.equal(r.data.ok, true);
    }
  } finally { process.env.HIRE_DAILY_LIMIT = "500"; }
});

test("الزائر المجهول مسقوف أيضاً — لكل عنوان، وللمجهولين جملةً", async () => {
  process.env.HIRE_ANON_DAILY_LIMIT = "1";
  try {
    const a = await post({ task: "translate", lang: "en", text: "إعلان" }, { ip: "198.51.100.77" });
    assert.equal(a.status, 200);
    const b = await post({ task: "translate", lang: "en", text: "إعلان" }, { ip: "198.51.100.77" });
    assert.equal(b.status, 429, "زائرٌ واحد بلا سقف = رصيد Azure بلا سقف");
  } finally { process.env.HIRE_ANON_DAILY_LIMIT = "500"; }

  process.env.HIRE_ANON_TOTAL_DAILY_LIMIT = "1";
  try {
    // عنوانٌ جديد تحت سقفه الخاص، لكن السقف الجماعي للمجهولين مستهلك —
    // وإلا كفى ألفُ عنوانٍ لاستنزاف الرصيد وكلٌّ منها تحت سقفه.
    const c = await post({ task: "translate", lang: "en", text: "إعلان" }, { ip: "198.51.100.88" });
    assert.equal(c.status, 429);
    assert.equal(c.data.error, "rate_limited");
  } finally { process.env.HIRE_ANON_TOTAL_DAILY_LIMIT = "5000"; }
});

// ═══════════════════════════════════════════════ ⑥ المسار الداخلي ══
// api/candidate.js لا يمرّ بمعالج HTTP: يستورد aiText ويستدعي النموذج مباشرةً
// (تحسين السيرة الحقيقي). فبقي بلا قياس، أي بنداً في فاتورة Azure بلا سجلّ.
test("aiText الداخلية تُقاس أيضاً — لا نداء ذكاء بلا سجلّ", async () => {
  const { aiText } = await import("../api/hire.js");
  const before = (await meterRows()).length;
  const out = await aiText("حسّن هذه السيرة الذاتية", 600, "cv-boost");
  assert.equal(typeof out, "string");
  const rows = await meterRows();
  assert.equal(rows.length, before + 1, "نداء داخلي لم يُسجَّل");
  const last = rows[rows.length - 1];
  assert.equal(last.after.kind, "internal");
  assert.equal(last.after.task, "cv-boost");
});
