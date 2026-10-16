// انتهاء اشتراك صاحب العمل: صفٌّ «مفعّل» له تاريخ نهاية ماضٍ ⇒ sub=false
// (api/candidates.js: subscriptionWindow · subscriptionGate · resolvePlan · employerRowFor)
//
// شغّله: npm test
//
// قرار المالك (2026-10-08): `activateSubscription` يكتب مدّة الاشتراك في «تاريخ التفعيل»
// لكن القراءة لم تكن تنظر إليها، فمن توقّف عن الدفع بقيت بيانات المرشحين مفتوحةً له. الآن
// تُقرأ النهاية — وأربع حالات لا تختلط:
//   ① غياب النهاية        ⇒ مفتوح (عملاء فُعّلوا يدوياً بلا تواريخ؛ لا يُقطع أحد)
//   ② نهاية مستقبلية       ⇒ مفتوح (ويوم النهاية نفسه كاملاً)
//   ③ نهاية ماضية          ⇒ مغلق: sub=false، تبقى اللوحة ومتقدّمو إعلاناته كاملين
//   ④ تاريخ فاسد           ⇒ مغلق (فشلٌ مغلق موثّق) لا مفتوح
// + فترة السماح GRACE_DAYS (الافتراضي 0)، والانتقال منتهٍ ← مفعّل بدفعةٍ جديدة، وألا يتأثر
// الفريق/المالك (OWNER_EMAILS · OWNER_EMAIL).
//
// الوحدة (subscriptionWindow/Gate) تُقاس بـ`now` مُمرَّر، والمسار الحقيقي على `handler`
// الفعلي: الجلسة تُقرأ من api/_db.js (LOCAL_DB=1)، ونوشن وAzure وحدهما مُحاكيان. بلا شبكة.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------- الجلسات --
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-employer-expiry-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const futureSess = new Date(Date.now() + 86400000).toISOString();
const NOW_ISO = new Date().toISOString();

const OWNER_EMAIL = "dr.baher.magnas@gmail.com";
const STAFF_EMAIL = "business@businesspartner.sa";           // OWNER_EMAILS الافتراضي
const KEYS = ["nodate", "future", "today", "past", "corrupt", "garbage", "bad2902", "dtfuture", "dtpast", "renew", "staff", "owner", "grace", "ghost", "free"];
const EMAILS = Object.fromEntries(KEYS.map((k) => [k, `${k}@example.com`]));
EMAILS.staff = STAFF_EMAIL; EMAILS.owner = OWNER_EMAIL;
const SID = Object.fromEntries(KEYS.map((k) => [k, "sid-" + k]));
const ACC = KEYS.map((k) => ({
  user: { id: "u-" + k, email: EMAILS[k], full_name: k, locale: "ar" },
  org: { id: "org-" + k, name_ar: "شركة " + k, created_at: NOW_ISO },
  sess: { id: "s-" + k, user_id: "u-" + k, organization_id: "org-" + k, token_hash: sha(SID[k]), revoked_at: null, expires_at: futureSess },
}));
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: ACC.map((a) => a.user), organizations: ACC.map((a) => a.org),
  user_sessions: ACC.map((a) => a.sess), audit_logs: [],
}, null, 2));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.OWNER_EMAIL = OWNER_EMAIL;
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_TEXT_DEPLOYMENT = "gpt-test";
delete process.env.AZURE_OPENAI_ENDPOINT_2;
delete process.env.RESEND_API_KEY; delete process.env.RESEND_KEY; delete process.env.RESEND;
delete process.env.OWNER_DEMO_CODE; delete process.env.EMPLOYER_CODES; delete process.env.OWNER_EMAILS;
delete process.env.BP_OPEN_ACCESS; delete process.env.GRACE_DAYS;
process.env.HIRE_DAILY_LIMIT = "500";

// ------------------------------------------------------------ نوشن مُحاكى --
const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";
const JOBS_DB = "260d76959d464631943f79f313fbf3c9";
const ATS_DB = "71792742873e4de398135c7855542b95";

const DAY = 86400000;
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);
const T0 = Date.now();
const TODAY = dayStr(T0);
const D = (offsetDays) => dayStr(T0 + offsetDays * DAY);       // اليوم ± n بحساب UTC

const ti = (s) => ({ type: "title", title: s ? [{ plain_text: String(s) }] : [] });
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: String(s) }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const em = (s) => ({ type: "email", email: s || null });
const ph = (s) => ({ type: "phone_number", phone_number: s || null });
const ur = (s) => ({ type: "url", url: s || null });
const nu = (n) => ({ type: "number", number: typeof n === "number" ? n : null });
const cb = (v) => ({ type: "checkbox", checkbox: !!v });
const ms = (arr) => ({ type: "multi_select", multi_select: arr.map((n) => ({ name: n })) });
// `date` يقبل أي شكلٍ خام ليُحاكي ما قد يكتبه إنسان أو يعيده نوشن.
const dr = (date) => ({ type: "date", date });

const CODE = (k) => `BP-EMP-${k.toUpperCase().padEnd(12, "X").slice(0, 12)}`;
const empRow = (k, { date, status = "مفعّل", plan = "احترافية", extra = {} } = {}) => ({
  id: "emp-" + k, created_time: "2026-02-01T00:00:00.000Z",
  properties: {
    "اسم الشركة": ti("شركة " + k), "البريد": em(EMAILS[k]), "الحالة": se(status), "الباقة": se(plan),
    "رمز الوصول": rt(CODE(k)),
    ...(date === undefined ? {} : { "تاريخ التفعيل": dr(date) }),
    ...extra,
  },
});
const rowDates = {
  nodate: undefined,                                          // ① لا عمود تاريخ أصلاً
  future: { start: D(-20), end: D(10) },                      // ②
  today: { start: D(-30), end: TODAY },                       // ② يوم النهاية نفسه
  past: { start: D(-40), end: D(-1) },                        // ③
  corrupt: { start: D(-40), end: "الأسبوع القادم" },          // ④
  garbage: { start: D(-40), end: "2026-13-45" },              // ④
  bad2902: { start: D(-40), end: "2026-02-31" },              // ④ تاريخٌ لا وجود له
  dtfuture: { start: D(-5), end: new Date(T0 + 3600 * 1000).toISOString() },     // ② وقتٌ كامل لم يحِن
  dtpast: { start: D(-5), end: new Date(T0 - 3600 * 1000).toISOString() },       // ③ وقتٌ كامل مضى
  renew: { start: D(-40), end: D(-3) },                       // ③ ثم يُجدَّد بدفعة
  staff: { start: D(-40), end: D(-30) },                      // ③ لكنه الفريق
  owner: { start: D(-40), end: D(-30) },                      // ③ لكنه المالك
  grace: { start: D(-40), end: D(-2) },                       // ③ يومان مضيا — للسماح
  ghost: { start: D(-40), end: null },                        // ① بداية بلا نهاية
};
// «free» جلسةُ عميلٍ بلا صفّ اشتراك أصلاً: لم يشترك قط.
const EMP_ROWS = KEYS.filter((k) => k !== "free").map((k) => empRow(k, { date: rowDates[k] }));
// صفٌّ مفعّل لكنّ العمود ليس من نوع «تاريخ» (غُيِّر مخطّط القاعدة): لا تاريخ ⇒ مفتوح كغيابه.
EMP_ROWS.find((r) => r.id === "emp-ghost").properties["تاريخ التفعيل"] = { type: "rich_text", rich_text: [{ plain_text: "ما شئت" }] };
const rowOf = (k) => EMP_ROWS.find((r) => r.id === "emp-" + k);

// ── مرشّحان: متقدّمٌ على إعلان «past» ومرشّح قاعدةٍ بقيمٍ فريدة تُبحث في الحمولة الخام ──
const C = { poolName: "كاناري-مرشح-القاعدة", poolEmail: "pool.canary@leak.example", poolPhone: "0559988771", cvText: "CANARYCVTEXTZZ",
  applName: "كاناري-متقدّم-الإعلان", applEmail: "applicant.canary@leak.example" };
const FILL = "إدارة الحسابات والمطالبات المالية وإعداد القوائم الشهرية ومطابقة الفواتير لدى شركات متوسطة الحجم في المملكة.";
const JOB = { past: "b1b1b1b1-aaaa-4bbb-8ccc-111111111111", nodate: "b2b2b2b2-aaaa-4bbb-8ccc-222222222222" };
const atsRow = (id, label, props) => ({ id, created_time: "2026-09-12T00:00:00.000Z", properties: {
  "Candidate Name": ti(label), "Name (EN)": ti(""), "Phone": ph(C.poolPhone), "Email": em(C.poolEmail),
  "City": rt("الرياض"), "Country": rt("السعودية"), "Field": se("محاسبة ومالية"), "Original Position": rt("محاسب أول"),
  "Skills": rt("محاسبة"), "Experience Years": nu(7), "Education": se("بكالوريوس"), "Languages": ms(["العربية"]),
  "Nationality Type": se("غير سعودي"), "Nationality": rt("هندي"), "Availability": se("فوري"),
  "CV Link": ur("https://drive.example/CV"), "ATS CV Text": rt(`${C.cvText} ${FILL}`), "حالة القراءة": se("مكتمل"),
  "مخفي عن الموقع": cb(false), "Pipeline Stage": se("جديد"), "Source": se("ترشيح"), ...props } });
const ATS_ROWS = [
  atsRow("a0000000-0000-4000-8000-000000000001", C.poolName, {}),
  atsRow("a0000000-0000-4000-8000-0000000000f1", C.applName, {
    "Email": em(C.applEmail), "Phone": ph("0541112233"),
    "الوظيفة المتقدم لها": rt(`إعلان past (${JOB.past})`), "Notes": rt("تقديم عبر الموقع") }),
];
const jobRow = (id, title, code) => ({ id, created_time: "2026-09-10T08:00:00.000Z", properties: {
  "العنوان الوظيفي": ti(title), "رمز صاحب العمل": rt(code), "المدينة": rt("الرياض"), "المجال": se("محاسبة ومالية"),
  "الوصف والمتطلبات": rt("مطلوب محاسب."), "الحالة": se("نشطة") } });
const JOB_ROWS = [jobRow(JOB.past, "إعلان past", CODE("past")), jobRow(JOB.nodate, "إعلان nodate", CODE("nodate"))];

const rtText = (p) => (p && p.rich_text ? p.rich_text.map((x) => x.plain_text).join("") : "");
const selName = (p) => (p && p.select ? p.select.name : null);
let aiCalls = 0, empDbQueries = 0;
const patched = [];

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://azure.test/")) { aiCalls++; return json({ choices: [{ message: { content: "نصٌّ من النموذج المُحاكى." } }] }); }
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : {};
  const pm = /\/pages\/([^/?]+)$/.exec(u);
  if (pm) {
    const id = decodeURIComponent(pm[1]);
    if (method === "PATCH") {
      patched.push({ id, body });
      const row = EMP_ROWS.find((r) => r.id === id);
      if (row) for (const [k, v] of Object.entries(body.properties || {})) {
        row.properties[k] = v.date ? dr(v.date) : v.select ? se(v.select.name) : v.rich_text ? rt(v.rich_text.map((x) => x.text.content).join("")) : row.properties[k];
      }
      return json({ id });
    }
    const row = ATS_ROWS.find((r) => r.id === id) || JOB_ROWS.find((r) => r.id === id);
    return row ? json(row) : json({ message: "Could not find page" }, 404);
  }
  const m = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (!m) return json({ results: [], has_more: false });
  const f = body.filter || {};
  if (m[1] === EMP_DB) {
    empDbQueries++;
    if (f.and) {   // resolvePlan: الرمز + الحالة
      const code = (f.and.find((x) => x.property === "رمز الوصول") || {}).rich_text;
      const st = (f.and.find((x) => x.property === "الحالة") || {}).select;
      return json({ results: EMP_ROWS.filter((r) => rtText(r.properties["رمز الوصول"]) === (code && code.equals) && selName(r.properties["الحالة"]) === (st && st.equals)), has_more: false });
    }
    if (f.property === "ملاحظات") {   // rowsByNotes (التجديد)
      const needle = String(f.rich_text.contains).toLowerCase();
      return json({ results: EMP_ROWS.filter((r) => rtText(r.properties["ملاحظات"]).toLowerCase().includes(needle)), has_more: false });
    }
    const want = String((f.email && (f.email.equals || f.email.contains)) || "").toLowerCase();
    return json({ results: EMP_ROWS.filter((r) => (r.properties["البريد"].email || "").toLowerCase() === want), has_more: false });
  }
  if (m[1] === JOBS_DB) {
    let rows = JOB_ROWS;
    if (f.property === "رمز صاحب العمل") rows = rows.filter((r) => rtText(r.properties["رمز صاحب العمل"]) === f.rich_text.equals);
    return json({ results: rows, has_more: false });
  }
  if (m[1] === ATS_DB) return json({ results: ATS_ROWS.slice(0, body.page_size || 100), has_more: false, next_cursor: null });
  return json({ results: [], has_more: false });
};

const CAND = await import("../api/candidates.js");
const { default: handler, subscriptionWindow, subscriptionGate, graceDays, resolvePlan } = CAND;
const { default: hire } = await import("../api/hire.js");
const EMPJS = await import("../api/employer.js");

function call(h, method, url, { sid = "", body, ip = "203.0.113.7" } = {}) {
  let out = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
  const req = { method, url, body, headers: { "x-forwarded-for": ip, ...(sid ? { cookie: `bp_sid=${sid}` } : {}) }, on() {} };
  return h(req, res).then(() => ({ status: status || 200, raw: out, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}
const get = (qs, opts) => call(handler, "GET", "/api/candidates?" + qs, opts);
const validate = (k) => get("validate=1&code=self", { sid: SID[k] });
const hpost = (body, opts) => call(hire, "POST", "/api/hire", { ...opts, body });
const withGrace = async (v, fn) => {
  const old = process.env.GRACE_DAYS;
  if (v === undefined) delete process.env.GRACE_DAYS; else process.env.GRACE_DAYS = v;
  try { return await fn(); } finally { if (old === undefined) delete process.env.GRACE_DAYS; else process.env.GRACE_DAYS = old; }
};
const quiet = async (fn) => {   // الفساد يُسجَّل بـconsole.error عمداً؛ لا نُغرق مخرجات الاختبار
  const e = console.error, logged = [];
  console.error = (...a) => logged.push(a.join(" "));
  try { return { value: await fn(), logged }; } finally { console.error = e; }
};

// ═══════════════════ الوحدة: subscriptionWindow بـ`now` مُمرَّر ═══════════════════
const win = (end, now, grace = 0) => subscriptionWindow({ "تاريخ التفعيل": dr(end === undefined ? undefined : { start: "2026-01-01", end }) }, now, grace);
const at = (iso) => Date.parse(iso);

test("① غياب النهاية = مفتوح: لا عمود، عمودٌ فارغ، بداية بلا نهاية، نهاية فارغة، نوعٌ آخر", () => {
  const now = at("2026-10-08T12:00:00Z");
  assert.equal(subscriptionWindow({}, now).state, "nodate", "لا عمود");
  assert.equal(subscriptionWindow(undefined, now).state, "nodate", "لا خصائص");
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": dr(null) }, now).state, "nodate", "عمود فارغ");
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": dr({ start: "2026-01-01", end: null }) }, now).state, "nodate", "بداية بلا نهاية");
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": dr({ start: "2026-01-01" }) }, now).state, "nodate");
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": dr({ start: "2026-01-01", end: "" }) }, now).state, "nodate", "نهاية نصٌّ فارغ");
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": { type: "rich_text", rich_text: [{ plain_text: "x" }] } }, now).state, "nodate", "نوعٌ آخر");
});

test("② نهاية مستقبلية = مفتوح، ويوم النهاية نفسه كاملاً (حتى آخر لحظة منه بتوقيت UTC)", () => {
  assert.equal(win("2026-10-20", at("2026-10-08T12:00:00Z")).state, "future");
  assert.equal(win("2026-10-08", at("2026-10-08T00:00:00Z")).state, "future", "أول لحظةٍ من يوم النهاية");
  assert.equal(win("2026-10-08", at("2026-10-08T23:59:59.999Z")).state, "future", "آخر لحظةٍ من يوم النهاية");
  assert.equal(win("2026-10-08", at("2026-10-08T23:59:59Z")).end, "2026-10-08");
  // وقتٌ كامل: ينتهي في تلك اللحظة لا في نهاية يومها
  assert.equal(win("2026-10-08T10:00:00.000+03:00", at("2026-10-08T06:59:59Z")).state, "future");
  assert.equal(win("2026-10-08T10:00:00.000+03:00", at("2026-10-08T07:00:00Z")).state, "expired");
});

test("③ نهاية ماضية = منتهٍ: من اللحظة الأولى بعد يوم النهاية", () => {
  assert.equal(win("2026-10-08", at("2026-10-09T00:00:00Z")).state, "expired");
  assert.equal(win("2026-10-08", at("2026-10-09T00:00:00Z")).end, "2026-10-08");
  assert.equal(win("2025-01-01", at("2026-10-08T12:00:00Z")).state, "expired");
});

test("④ تاريخٌ فاسد = corrupt (لا يُفسَّر مفتوحاً ولا يُخمَّن)", () => {
  const now = at("2026-10-08T12:00:00Z");
  for (const bad of ["الأسبوع القادم", "2026-13-45", "2026-02-31", "2026-10-8", "10/08/2026", "tomorrow", "2026", "NaN", "2026-10-08Tgarbage", "0000-00-00", " "]) {
    assert.equal(win(bad, now).state, "corrupt", JSON.stringify(bad));
  }
  assert.equal(win(20261008, now).state, "corrupt", "رقمٌ بدل نصّ");
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": { type: "date", date: "2026-10-08" } }, now).state, "corrupt", "date نفسه نصٌّ لا كائن");
  // فسادٌ في البداية وحدها لا يُسقط شيئاً: القاعدة تقرأ النهاية.
  assert.equal(subscriptionWindow({ "تاريخ التفعيل": dr({ start: "؟؟؟", end: "2026-12-01" }) }, now).state, "future");
});

test("فترة السماح: تُضاف إلى النهاية قبل الحكم، وتُقاس بالأيام الكاملة", () => {
  const end = "2026-10-08";                                   // ينتهي 2026-10-09T00:00Z
  assert.equal(win(end, at("2026-10-10T12:00:00Z"), 0).state, "expired", "بلا سماح");
  assert.equal(win(end, at("2026-10-10T12:00:00Z"), 3).state, "grace", "داخل السماح");
  assert.equal(win(end, at("2026-10-11T23:59:59Z"), 3).state, "grace", "آخر لحظةٍ في السماح");
  assert.equal(win(end, at("2026-10-12T00:00:00Z"), 3).state, "expired", "خرج السماح");
  assert.equal(win(end, at("2026-10-08T12:00:00Z"), 3).state, "future", "السماح لا يغيّر ما قبل النهاية");
  assert.equal(win("garbage", at("2026-10-08T12:00:00Z"), 365).state, "corrupt", "السماح لا يفتح الفاسد");
});

test("GRACE_DAYS: الافتراضي 0، والقيمة غير العددية أو السالبة تُقرأ 0، والسقف 365", async () => {
  assert.equal(graceDays(), 0, "غير مضبوط");
  for (const [raw, want] of [["", 0], ["0", 0], ["7", 7], [" 3 ", 3], ["abc", 0], ["-2", 0], ["1.5", 0], ["3d", 0], ["999999", 0], ["400", 365], ["365", 365]]) {
    assert.equal(await withGrace(raw, () => graceDays()), want, JSON.stringify(raw));
  }
});

test("subscriptionGate: الصف المنتهي/الفاسد يُحجب، والفريق والمالك لا يُحكم عليهما بالتاريخ", async () => {
  const now = at("2026-10-08T12:00:00Z");
  const row = (end) => ({ id: "r1", properties: { "تاريخ التفعيل": dr({ start: "2026-01-01", end }) } });
  assert.deepEqual(subscriptionGate(row("2026-09-01"), "x@example.com", now), { sub: false, subState: "expired", subEnd: "2026-09-01" });
  assert.deepEqual(subscriptionGate(row("2026-12-01"), "x@example.com", now), { sub: true, subState: "ok", subEnd: "2026-12-01" });
  const { value: bad, logged } = await quiet(() => subscriptionGate(row("nope"), "x@example.com", now));
  assert.deepEqual(bad, { sub: false, subState: "invalid", subEnd: "" });
  assert.ok(logged.some((l) => l.includes("end-date invalid") && l.includes("r1")), "الفساد يُسجَّل بمعرّف الصف ليُصلَح");
  for (const mail of [STAFF_EMAIL, OWNER_EMAIL, " Business@BusinessPartner.sa "]) {
    assert.equal(subscriptionGate(row("2020-01-01"), mail, now).sub, true, "منتهٍ لكنه الفريق: " + mail);
    assert.equal(subscriptionGate(row("nope"), mail, now).sub, true, "فاسدٌ لكنه الفريق: " + mail);
  }
  assert.equal(subscriptionGate({ id: "r2", properties: {} }, "x@example.com", now).sub, true, "بلا تاريخ: مفتوح");
});

// ═══════════════════ المسار الحقيقي: validate=1 بالجلسة ═══════════════════
test("① صفٌّ مفعّل بلا تاريخ نهاية يبقى sub=true (العملاء الحاليون لا يُقطعون)", async () => {
  for (const k of ["nodate", "ghost"]) {
    const r = await validate(k);
    assert.equal(r.status, 200, k);
    assert.equal(r.data.unlocked, true, k);
    assert.equal(r.data.sub, true, `${k}: غياب التاريخ يعني الفتح`);
    assert.ok(!("subState" in r.data), k);
  }
});

test("② نهاية مستقبلية أو اليوم نفسه أو وقتٌ كاملٌ لم يحِن ⇒ sub=true", async () => {
  for (const k of ["future", "today", "dtfuture"]) {
    const r = await validate(k);
    assert.equal(r.data.sub, true, k);
    assert.ok(!("subState" in r.data), k);
    assert.equal(r.data.subEnd, rowDates[k].end.slice(0, 10), k + ": تاريخ الانتهاء يظهر لصاحبه");
  }
});

test("③ نهاية ماضية ⇒ sub=false + subState:expired، واللوحة تبقى مفتوحة والرمز لا يخرج", async () => {
  for (const k of ["past", "dtpast"]) {
    const r = await validate(k);
    assert.equal(r.status, 200, k);
    assert.equal(r.data.unlocked, true, `${k}: اللوحة (إعلاناته) تبقى`);
    assert.equal(r.data.sub, false, `${k}: بنك السير يُغلق`);
    assert.equal(r.data.subState, "expired", k);
    assert.equal(r.data.subEnd, rowDates[k].end.slice(0, 10), k);
    assert.equal(r.data.account, true, k);
    assert.equal(r.data.plan, "احترافية", "الباقة تبقى مسجّلة");
    assert.ok(!r.raw.includes(CODE(k)), "رمز الوصول لا يخرج في أي ردّ");
    assert.ok(!("emp" in r.data), "ليس «لا اشتراك له»: reason بقيت ok");
  }
});

test("④ تاريخ فاسد ⇒ sub=false + subState:invalid (فشلٌ مغلق) مع تسجيل الخطأ", async () => {
  for (const k of ["corrupt", "garbage", "bad2902"]) {
    const { value: r, logged } = await quiet(() => validate(k));
    assert.equal(r.data.unlocked, true, k);
    assert.equal(r.data.sub, false, `${k}: الفساد يُغلق لا يفتح`);
    assert.equal(r.data.subState, "invalid", k);
    assert.ok(!("subEnd" in r.data), k);
    assert.ok(logged.some((l) => l.includes("end-date invalid") && l.includes("emp-" + k)), k + ": مسجَّل بمعرّف الصف");
  }
});

test("«منتهٍ» غير «مجاني»: من لم يشترك قط بلا subState، والمنتهي يحمله — واجهتان مختلفتان", async () => {
  // جلسة عميلٍ بلا صفّ اشتراك: يدخل بحساب Business Partner (portal) — لم يشترك قط.
  const free = await validate("free");
  assert.equal(free.data.unlocked, true, "اللوحة تُفتح بجلسة العميل");
  assert.equal(free.data.sub, false);
  assert.equal(free.data.portal, true);
  assert.ok(!("subState" in free.data), "المجاني لا يُقال له «انتهى اشتراكك»");
  assert.ok(!("account" in free.data));
  const expired = await validate("past");
  assert.equal(expired.data.subState, "expired");
  assert.equal(expired.data.account, true);
  assert.ok(!("portal" in expired.data));
});

// ═══════════════════ فترة السماح على المسار الحقيقي ═══════════════════
test("GRACE_DAYS: صفٌّ منتهٍ منذ يومين: 0 ⇒ مغلق · 3 ⇒ مفتوح · 1 ⇒ مغلق", async () => {
  assert.equal((await validate("grace")).data.sub, false, "الافتراضي 0");
  assert.equal(await withGrace("3", async () => (await validate("grace")).data.sub), true, "داخل السماح");
  assert.equal(await withGrace("1", async () => (await validate("grace")).data.sub), false, "خرج السماح");
  assert.equal(await withGrace("abc", async () => (await validate("grace")).data.sub), false, "قيمةٌ فاسدة = 0");
  // والسماح لا يفتح الفاسد
  const fsd = await quiet(() => withGrace("365", async () => (await validate("corrupt")).data.sub));
  assert.equal(fsd.value, false);
});

// ═══════════════════ الفريق والمالك ═══════════════════
test("الفريق (OWNER_EMAILS) والمالك (OWNER_EMAIL): صفٌّ منتهٍ ولا يتأثران", async () => {
  for (const k of ["staff", "owner"]) {
    const r = await validate(k);
    assert.equal(r.data.unlocked, true, k);
    assert.equal(r.data.sub, true, `${k}: لا يُقطع`);
    assert.ok(!("subState" in r.data), k);
  }
});

// ═══════════════════ بالرمز الصريح (كلمة المرور) ═══════════════════
test("resolvePlan بالرمز: منتهٍ ⇒ unlocked:true وsub:false + subState، ومفتوحٌ ⇒ sub:true، والفاسد مغلق", async () => {
  const past = await resolvePlan(CODE("past"));
  assert.equal(past.unlocked, true);
  assert.equal(past.sub, false);
  assert.equal(past.subState, "expired");
  assert.equal(past.plan, "احترافية");
  assert.equal((await resolvePlan(CODE("nodate"))).sub, true);
  assert.equal((await resolvePlan(CODE("future"))).sub, true);
  assert.equal((await resolvePlan(CODE("owner"))).sub, true, "المالك بالرمز");
  const bad = await quiet(() => resolvePlan(CODE("corrupt")));
  assert.equal(bad.value.unlocked, true);
  assert.equal(bad.value.sub, false);
  assert.equal(bad.value.subState, "invalid");
  const v = await get("validate=1&code=" + encodeURIComponent(CODE("past")));
  assert.equal(v.data.unlocked, true);
  assert.equal(v.data.sub, false);
  assert.equal(v.data.subState, "expired");
  assert.ok(!v.raw.includes(CODE("past")), "الرمز لا يُعاد");
});

// ═══════════════════ ما يراه المنتهي: إعلاناته ومتقدّموها كاملون، وبنك السير محجوب ═══════════════════
test("منتهٍ: متقدّمو إعلانه ظاهرون كاملين، ومرشّح القاعدة بلا اسم ولا تواصل ولا سيرة", async () => {
  const ap = await get("applicants=1&code=self", { sid: SID.past });
  assert.equal(ap.status, 200, ap.raw.slice(0, 200));
  const a = ap.data.jobs.flatMap((j) => j.applicants).find((x) => x.name === C.applName);
  assert.ok(a, "متقدّمٌ على إعلانه اختفى بسبب الانتهاء");
  assert.equal(a.email, C.applEmail);
  assert.ok(!ap.raw.includes(C.poolName) && !ap.raw.includes(C.poolEmail));

  for (const qs of ["limit=40&code=self", "limit=40&code=self&q=" + encodeURIComponent("محاسب"), "limit=40&code=" + encodeURIComponent(CODE("past"))]) {
    const r = await get(qs, { sid: SID.past });
    assert.equal(r.status, 200, qs);
    assert.equal(r.data.unlocked, false, `${qs}: unlocked=false تعني أن البيانات محجوبة`);
    for (const secret of [C.poolName, C.poolEmail, C.poolPhone, C.cvText]) assert.ok(!r.raw.includes(secret), `${qs}: تسرّب «${secret}»`);
  }
});

test("مقارنة: غير المنتهي (بلا تاريخ) يرى مرشّح القاعدة كاملاً — الحجب سببه الانتهاء وحده", async () => {
  const r = await get("limit=40&code=self", { sid: SID.nodate });
  assert.equal(r.data.unlocked, true);
  assert.ok(r.raw.includes(C.poolEmail), "المشترك يرى قاعدة المواهب");
});

test("hire: المنتهي ⇒ 403 subscription_required بلا نموذج، والمفتوح والفريق يمرّان", async () => {
  const before = aiCalls;
  const exp = await hpost({ task: "summary", candidate: { role: "محاسب" }, code: "self" }, { sid: SID.past });
  assert.equal(exp.status, 403);
  assert.equal(exp.data.error, "subscription_required");
  assert.equal(aiCalls, before, "نموذجٌ نودي لمنتهي الاشتراك");
  for (const k of ["nodate", "future", "staff"]) {
    const ok = await hpost({ task: "summary", candidate: { role: "محاسب" }, code: "self" }, { sid: SID[k] });
    assert.equal(ok.status, 200, k + " " + ok.raw.slice(0, 160));
  }
});

// ═══════════════════ الانتقال من منتهٍ إلى مفعّل بدفعةٍ جديدة ═══════════════════
test("تجديد صاحب اشتراكٍ منتهٍ بدفعةٍ مُتحقَّق منها: يعود sub=true فوراً، ومن اليوم لا من النهاية القديمة", async () => {
  assert.equal((await validate("renew")).data.sub, false, "قبل الدفع: منتهٍ");
  // نيّة تجديد (الصفّ «مفعّل» فلا يُمسّ بابه قبل الدفع) ثم دفعةٌ بمبلغ السعر.
  const intent = await EMPJS.createPendingSubscription({ email: EMAILS.renew, company: "x", plan: "pro", billing: "monthly" });
  assert.equal(intent.ok, true, JSON.stringify(intent));
  assert.equal(intent.renewal, true);
  assert.equal((await validate("renew")).data.sub, false, "النيّة وحدها لا تفتح");

  const offer = EMPJS.getPlanOffer("pro", "monthly");
  const act = await EMPJS.activateSubscription({
    reference: intent.reference, paymentRef: "pay_expiry_0001", amountHalalas: offer.amountHalalas, billing: "monthly",
  });
  assert.equal(act.ok, true, JSON.stringify(act));

  const after = await validate("renew");
  assert.equal(after.data.unlocked, true);
  assert.equal(after.data.sub, true, "بعد الدفع تُفتح البيانات");
  assert.ok(!("subState" in after.data));
  const w = rowOf("renew").properties["تاريخ التفعيل"].date;
  assert.equal(w.start, TODAY, "المدّة تبدأ اليوم: النهاية القديمة منتهية فلا تُمدَّد");
  assert.ok(w.end > TODAY, "نهاية جديدة في المستقبل: " + w.end);
  assert.equal(after.data.subEnd, w.end);
  // والرمز نفسه لم يتغيّر (لا يُصدَر رمزٌ جديد عند التجديد)
  assert.equal((await resolvePlan(CODE("renew"))).sub, true);
});

test("دفعةٌ مرفوضة (مبلغ خاطئ) لا تجدّد: يبقى منتهياً (يُغلق ولا يُفتح)", async () => {
  // صفٌّ آخر منتهٍ، بنيّة تجديد، ثم دفعةٌ مرفوضة (مبلغٌ لا يطابق السعر).
  const row = empRow("renew", { date: { start: D(-40), end: D(-2) } });
  row.id = "emp-renew2";
  row.properties["البريد"] = em("renew2@example.com");
  row.properties["رمز الوصول"] = rt("BP-EMP-RENEWTWOXXXX");
  EMP_ROWS.push(row);
  const intent = await EMPJS.createPendingSubscription({ email: "renew2@example.com", company: "x", plan: "basic", billing: "monthly" });
  assert.equal(intent.ok, true, JSON.stringify(intent));
  const before = JSON.stringify(row.properties["تاريخ التفعيل"]);
  // paymentRef غير مطابقٍ للمبلغ ⇒ رفضٌ قبل أي كتابة
  const bad = await EMPJS.activateSubscription({ reference: intent.reference, paymentRef: "pay_expiry_0002", amountHalalas: 1, billing: "monthly" });
  assert.equal(bad.ok, false);
  assert.equal(JSON.stringify(row.properties["تاريخ التفعيل"]), before, "التاريخ لم يُمسّ");
  const r = await resolvePlan("BP-EMP-RENEWTWOXXXX");
  assert.equal(r.sub, false);
  assert.equal(r.subState, "expired");
});

// ═══════════════════ لا كتابة على نوشن من مسار القراءة ═══════════════════
test("القراءة وحدها: الحكم بالانتهاء لا يكتب شيئاً في نوشن (لا يغيّر «الحالة»)", async () => {
  const before = patched.length;
  await validate("past"); await validate("corrupt"); await resolvePlan(CODE("past"));
  assert.equal(patched.length, before, "مسار القراءة كتب على نوشن");
  assert.equal(rowOf("past").properties["الحالة"].select.name, "مفعّل", "الصف يبقى «مفعّل» — الانتهاء يُحكم بالتاريخ لا بالتعديل");
});
