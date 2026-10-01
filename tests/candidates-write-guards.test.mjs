// بوابات الكتابة وحدّ محاولات الرمز  (api/candidates.js)
//
// شغّله: npm test
//
// ① update-stage و request-interview تكتبان على صفّ مرشّحٍ بمعرّف صفحته. كانتا
//    لا تفحصان ملكية صاحب العمل، وportalUnlock يفتحهما لأي جلسة عميل (OPEN_ACCESS).
//    الآن: المرشّح يجب أن يكون من متقدّمي إعلانٍ يملكه المنادي (والمالك بلا حدّ)،
//    وإلا 404 ولا كتابة، وتعذّر الملكية = 502 ولا كتابة.
// ② الرمز الخاطئ: ٢٠ محاولة فاشلة/ساعة لكل عنوان (بصمة لا IP خام، ولا الرمز
//    المُخمَّن يُسجَّل) ثم 429 — بنمط fail-open، ولا يمسّ code:"self".
//
// المُحاكى نوشن وحدها، والجلسة تُقرأ فعلاً من api/_db.js (LOCAL_DB=1 → ملف مؤقّت).
// كل fetch إلى غير api.notion.com / api.resend.com يرمي.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-write-guards-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
const SID = { owner: "sid-owner", a: "sid-a", b: "sid-b", client: "sid-client" };
const OWNER_EMAIL = "dr.baher.magnas@gmail.com";
const A_EMAIL = "a@example.com", B_EMAIL = "b@example.com";

fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-owner", email: OWNER_EMAIL, full_name: "المالك", locale: "ar" },
    { id: "u-a", email: A_EMAIL, full_name: "أ", locale: "ar" },
    { id: "u-b", email: B_EMAIL, full_name: "ب", locale: "ar" },
    { id: "u-c", email: "client@example.com", full_name: "عميل", locale: "ar" },
  ],
  organizations: [
    { id: "org-owner", name_ar: "المالك", created_at: new Date().toISOString() },
    { id: "org-a", name_ar: "شركة أ", created_at: new Date().toISOString() },
    { id: "org-b", name_ar: "شركة ب", created_at: new Date().toISOString() },
    { id: "org-c", name_ar: "عميل", created_at: new Date().toISOString() },
  ],
  user_sessions: [
    { id: "s1", user_id: "u-owner", organization_id: "org-owner", token_hash: sha(SID.owner), revoked_at: null, expires_at: future },
    { id: "s2", user_id: "u-a", organization_id: "org-a", token_hash: sha(SID.a), revoked_at: null, expires_at: future },
    { id: "s3", user_id: "u-b", organization_id: "org-b", token_hash: sha(SID.b), revoked_at: null, expires_at: future },
    { id: "s4", user_id: "u-c", organization_id: "org-c", token_hash: sha(SID.client), revoked_at: null, expires_at: future },
  ],
}, null, 2));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.RESEND_API_KEY = "re_test_key";
process.env.OWNER_EMAIL = OWNER_EMAIL;
delete process.env.OWNER_DEMO_CODE;
delete process.env.EMPLOYER_CODES;
delete process.env.EMP_CODE_MISS_LIMIT;

const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";
const JOBS_DB = "260d76959d464631943f79f313fbf3c9";
const ATS_DB = "71792742873e4de398135c7855542b95";

const ti = (s) => ({ type: "title", title: s ? [{ plain_text: String(s) }] : [] });
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: String(s) }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const em = (s) => ({ type: "email", email: s || null });

const OWNER_CODE = "BP-EMP-OWNER0000001";
const A_CODE = "BP-EMP-AAAAAAAAAAAA";
const B_CODE = "BP-EMP-BBBBBBBBBBBB";
const SHORT_CODE = "BP-EMP-AB12";   // الرمز القصير القابل للتخمين

const EMP_ROWS = [
  { id: "emp-owner", created_time: "2026-01-01T00:00:00.000Z", properties: { "اسم الشركة": ti("المالك"), "البريد": em(OWNER_EMAIL), "الحالة": se("مفعّل"), "الباقة": se("مؤسسية"), "رمز الوصول": rt(OWNER_CODE) } },
  { id: "emp-a", created_time: "2026-02-01T00:00:00.000Z", properties: { "اسم الشركة": ti("شركة أ"), "البريد": em(A_EMAIL), "الحالة": se("مفعّل"), "الباقة": se("احترافية"), "رمز الوصول": rt(A_CODE) } },
  { id: "emp-b", created_time: "2026-02-02T00:00:00.000Z", properties: { "اسم الشركة": ti("شركة ب"), "البريد": em(B_EMAIL), "الحالة": se("مفعّل"), "الباقة": se("احترافية"), "رمز الوصول": rt(B_CODE) } },
  { id: "emp-short", created_time: "2026-02-03T00:00:00.000Z", properties: { "اسم الشركة": ti("قصير"), "البريد": em("short@example.com"), "الحالة": se("مفعّل"), "الباقة": se("احترافية"), "رمز الوصول": rt(SHORT_CODE) } },
];

const JOB_OWNER = "11111111-aaaa-2222-bbbb-333333333333";
const JOB_A = "aaaaaaaa-1111-2222-3333-444444444444";
const JOB_B = "bbbbbbbb-1111-2222-3333-444444444444";
const job = (id, title, code) => ({ id, created_time: "2026-09-10T08:00:00.000Z", properties: {
  "العنوان الوظيفي": ti(title), "رمز صاحب العمل": rt(code), "المدينة": rt("الرياض"), "الحالة": se("نشطة"),
} });
const JOB_ROWS = [job(JOB_OWNER, "إعلان المالك", OWNER_CODE), job(JOB_A, "إعلان أ", A_CODE), job(JOB_B, "إعلان ب", B_CODE)];

const cand = (id, name, stampTitle, stampId, extra) => ({ id, created_time: "2026-09-12T00:00:00.000Z", properties: {
  "Candidate Name": ti(name), "Pipeline Stage": se("جديد"),
  "الوظيفة المتقدم لها": rt(stampId ? `${stampTitle} (${stampId})` : ""),
  ...(extra || {}),
} });
const C_A = "cand-of-a", C_B = "cand-of-b", C_OWNER = "cand-of-owner", C_POOL = "cand-pool", C_OFFICE_B = "cand-office-b";
const ATS_ROWS = [
  cand(C_A, "مرشّح أ", "إعلان أ", JOB_A),
  cand(C_B, "مرشّح ب", "إعلان ب", JOB_B),
  cand(C_OWNER, "مرشّح المالك", "إعلان المالك", JOB_OWNER),
  cand(C_POOL, "مرشّح قاعدة بلا ختم", "", ""),
  cand(C_OFFICE_B, "مرشّح مكتب لإعلان ب", "إعلان ب", JOB_B, { "مكتب الاستقدام": rt("مكتب س"), "بريد المكتب": em("office@example.com") }),
];

// ما يكتبه الكود فعلاً: كل PATCH على صفحة، وكل بريد.
let patches = [];
let mails = [];
let jobsDbFails = false;
let empDbFails = false;
let pageGetFails = null;   // معرّفٌ يردّ GET عليه بـ500

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://api.resend.com/")) { mails.push(JSON.parse(init.body)); return json({ id: "m1" }); }
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  const body = init.body ? JSON.parse(init.body) : {};
  const pm = /\/pages\/([^/?]+)$/.exec(u);
  if (pm) {
    const id = decodeURIComponent(pm[1]);
    if ((init.method || "GET") === "PATCH") { patches.push({ id, body }); return json({ id }); }
    if (pageGetFails === id) return new Response("{}", { status: 500 });
    const row = ATS_ROWS.find((r) => r.id === id) || JOB_ROWS.find((r) => r.id === id) || EMP_ROWS.find((r) => r.id === id);
    return row ? json(row) : json({ message: "Could not find page" }, 404);
  }
  const m = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (!m) return json({}, 404);
  const f = body.filter || {};
  if (m[1] === EMP_DB) {
    if (empDbFails) return new Response("{}", { status: 500 });
    if (f.email) return json({ results: EMP_ROWS.filter((r) => r.properties["البريد"].email === f.email.equals), has_more: false });
    const conds = f.and || [];
    const code = (conds.find((c) => c.property === "رمز الوصول") || {}).rich_text;
    const rows = EMP_ROWS.filter((r) => code && r.properties["رمز الوصول"].rich_text[0].plain_text === code.equals);
    return json({ results: rows, has_more: false });
  }
  if (m[1] === JOBS_DB) {
    if (jobsDbFails) return new Response("{}", { status: 500 });
    let rows = JOB_ROWS;
    if (f.property === "رمز صاحب العمل") rows = rows.filter((r) => r.properties["رمز صاحب العمل"].rich_text[0].plain_text === f.rich_text.equals);
    return json({ results: rows, has_more: false });
  }
  if (m[1] === ATS_DB) return json({ results: [], has_more: false });
  return json({ results: [], has_more: false });
};

const { default: handler, codeMissSink, CODE_MISS_ACTION } = await import("../api/candidates.js");

function invoke(req) {
  let body = "", status = 0;
  const headers = {};
  const res = {
    setHeader(k, v) { headers[k] = v; },
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { body = b; },
  };
  return handler(req, res).then(() => ({
    status: status || 200, headers, raw: body,
    data: (() => { try { return JSON.parse(body); } catch { return null; } })(),
  }));
}
const post = (sid, body, ip) => invoke({
  method: "POST", url: "/api/candidates", body,
  headers: { ...(sid ? { cookie: `bp_sid=${sid}` } : {}), ...(ip ? { "x-forwarded-for": ip } : {}) }, on() {},
});
const get = (qs, sid, ip) => invoke({
  method: "GET", url: `/api/candidates?${qs}`,
  headers: { ...(sid ? { cookie: `bp_sid=${sid}` } : {}), ...(ip ? { "x-forwarded-for": ip } : {}) }, on() {},
});
const reset = () => { patches = []; mails = []; jobsDbFails = false; empDbFails = false; pageGetFails = null; };

/* ═════════════════════ ① update-stage ═════════════════════ */
test("update-stage: صاحب عمل ب لا يحرّك مرشّح إعلان أ — 404 ولا كتابة", async () => {
  reset();
  const r = await post(SID.b, { action: "update-stage", code: "self", id: C_A, stage: "hired" });
  assert.equal(r.status, 404);
  assert.equal(r.data.error, "not_found");
  assert.equal(patches.length, 0, "كُتب على صفّ مرشّحٍ ليس له");
});

test("update-stage: ردّ المعرّف الخاطئ هو ردّ مرشّح الغير نفسه (لا يُكشف وجود الصف)", async () => {
  reset();
  const other = await post(SID.b, { action: "update-stage", code: "self", id: C_A, stage: "hired" });
  const missing = await post(SID.b, { action: "update-stage", code: "self", id: "no-such-page", stage: "hired" });
  assert.equal(missing.status, 404);
  assert.equal(other.raw, missing.raw);
  assert.equal(patches.length, 0);
});

test("update-stage: صفحةٌ ليست مرشّحاً (إعلان/صفّ صاحب عمل) و مرشّحٌ بلا ختم ⇒ 404", async () => {
  reset();
  for (const id of [JOB_A, "emp-a", C_POOL]) {
    const r = await post(SID.a, { action: "update-stage", code: "self", id, stage: "rejected" });
    assert.equal(r.status, 404, `نجحت الكتابة على ${id}`);
  }
  assert.equal(patches.length, 0);
});

test("update-stage: عميل بوابةٍ مسجّل (org:<id>) لا يحرّك أي مرشّح", async () => {
  reset();
  const r = await post(SID.client, { action: "update-stage", id: C_A, stage: "hired" });
  assert.equal(r.status, 404);
  assert.equal(patches.length, 0);
});

test("update-stage: مالك الإعلان ينجح، والمالك ينجح على أي مرشّح", async () => {
  reset();
  const a = await post(SID.a, { action: "update-stage", code: "self", id: C_A, stage: "interview" });
  assert.equal(a.status, 200); assert.equal(a.data.ok, true);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, C_A);
  assert.equal(patches[0].body.properties["Pipeline Stage"].select.name, "مقابلة");
  reset();
  for (const id of [C_B, C_A, C_POOL]) {
    const o = await post(SID.owner, { action: "update-stage", code: "self", id, stage: "shortlist" });
    assert.equal(o.status, 200, `المالك مُنع من ${id}`);
  }
  assert.equal(patches.length, 3);
});

test("update-stage: تعذّر استعلام الملكية ⇒ 502 ولا كتابة", async () => {
  reset(); jobsDbFails = true;
  const r = await post(SID.a, { action: "update-stage", code: "self", id: C_A, stage: "hired" });
  assert.equal(r.status, 502);
  assert.equal(r.data.error, "notion_failed");
  assert.equal(patches.length, 0);
});

test("update-stage: تعذّر قراءة صفّ المرشّح ⇒ 502 ولا كتابة", async () => {
  reset(); pageGetFails = C_A;
  const r = await post(SID.a, { action: "update-stage", code: "self", id: C_A, stage: "hired" });
  assert.equal(r.status, 502);
  assert.equal(patches.length, 0);
});

/* ═════════════════════ ① request-interview ═════════════════════ */
test("request-interview: صاحب عمل ب لا يطلب مقابلة مرشّح إعلان أ — 404 ولا كتابة ولا بريد", async () => {
  reset();
  const r = await post(SID.b, { action: "request-interview", code: "self", id: C_A, employer: "منتحل" });
  assert.equal(r.status, 404);
  assert.equal(patches.length, 0);
  assert.equal(mails.length, 0, "أُرسل بريدٌ باسم صاحب عملٍ لا يملك المرشّح");
});

test("request-interview: لا يصل مكتبَ الاستقدام بريدٌ عن مرشّحه من غير صاحب إعلانه", async () => {
  reset();
  const r = await post(SID.a, { action: "request-interview", code: "self", id: C_OFFICE_B });
  assert.equal(r.status, 404);
  const c = await post(SID.client, { action: "request-interview", id: C_OFFICE_B });
  assert.equal(c.status, 404);
  assert.equal(patches.length, 0);
  assert.equal(mails.length, 0);
});

test("request-interview: مالك الإعلان ينجح (يُوجَّه للمكتب)، والمالك ينجح", async () => {
  reset();
  const b = await post(SID.b, { action: "request-interview", code: "self", id: C_OFFICE_B, employer: "شركة ب" });
  assert.equal(b.status, 200); assert.equal(b.data.routed, "office");
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, C_OFFICE_B);
  assert.ok(mails.some((m) => m.to.includes("office@example.com")));
  reset();
  const o = await post(SID.owner, { action: "request-interview", code: "self", id: C_A });
  assert.equal(o.status, 200); assert.equal(o.data.routed, "internal");
  assert.equal(patches.length, 1);
});

test("request-interview: تعذّر الملكية ⇒ 502، وتعذّر قراءة الصفّ ⇒ 502، ولا كتابة", async () => {
  reset(); jobsDbFails = true;
  const r = await post(SID.a, { action: "request-interview", code: "self", id: C_A });
  assert.equal(r.status, 502);
  reset(); pageGetFails = C_A;
  const r2 = await post(SID.a, { action: "request-interview", code: "self", id: C_A });
  assert.equal(r2.status, 502);
  assert.equal(patches.length, 0);
  assert.equal(mails.length, 0);
});

/* ═════════════════════ ② حدّ محاولات الرمز ═════════════════════ */
const guessBody = (code) => ({ action: "list-postings", code });
const rowsOf = () => {
  // اقرأ الأثر المكتوب فعلاً في قاعدة الاختبار.
  return codeMissSink.count(`action=eq.${CODE_MISS_ACTION}&select=actor_label,after,ip,entity_type`);
};

test("② عشرون محاولة فاشلة من عنوانٍ ثم 429 — حتى للرمز الصحيح من العنوان نفسه", async () => {
  reset();
  const IP = "203.0.113.9";
  for (let i = 0; i < 20; i++) {
    const r = await post(null, guessBody("BP-EMP-GUESS" + String(i).padStart(4, "0")), IP);
    assert.equal(r.status, 403, `المحاولة ${i + 1} حُجبت مبكراً`);
  }
  const blocked = await post(null, guessBody("BP-EMP-GUESS9999"), IP);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.data.error, "too_many_attempts");
  assert.equal(blocked.headers["Retry-After"], "3600");
  // الرمز الصحيح من العنوان المحظور لا يُجاب بنعم.
  const good = await post(null, guessBody(A_CODE), IP);
  assert.equal(good.status, 429);
  // ?validate=1 يمرّ من الحاجز نفسه.
  const v = await get(`validate=1&code=${A_CODE}`, null, IP);
  assert.equal(v.status, 429);
  // عنوانٌ آخر لا يتأثّر.
  const other = await post(null, guessBody(A_CODE), "203.0.113.77");
  assert.equal(other.status, 200);
  assert.equal(other.data.ok, true);
  // وجلسة code:"self" الصحيحة من العنوان المحظور نفسه تعمل.
  const self = await post(SID.a, { action: "list-postings", code: "self" }, IP);
  assert.equal(self.status, 200);
  const selfGet = await get("validate=1&code=self", SID.a, IP);
  assert.equal(selfGet.status, 200);
  assert.equal(selfGet.data.unlocked, true);
});

test("② السجلّ بصمةٌ لا IP خام، ولا الرمز المُخمَّن يُكتب", async () => {
  const rows = await rowsOf();
  assert.ok(rows.length >= 20);
  const dump = JSON.stringify(rows);
  assert.ok(!dump.includes("203.0.113"), "عنوانٌ خام في السجلّ");
  assert.ok(!dump.includes("GUESS"), "رمزٌ مُخمَّن في السجلّ");
  for (const r of rows) {
    assert.match(r.actor_label, /^empcode:[0-9a-f]{16}$/);
    assert.ok(!r.ip, "عمود ip مكتوب");
  }
});

test("② الرمز الصحيح والمالك وorg: وبلا رمز لا تُحسب أخطاءً — ثلاثون طلباً ولا حظر", async () => {
  reset();
  const IP = "198.51.100.5";
  for (let i = 0; i < 30; i++) {
    const r = await post(null, guessBody(i % 2 ? A_CODE : OWNER_CODE), IP);
    assert.equal(r.status, 200, `حُظر رمزٌ صحيح في الطلب ${i + 1}`);
  }
  for (let i = 0; i < 25; i++) {
    const r = await get(`validate=1&code=org:xyz${i}`, null, IP);
    assert.equal(r.status, 200);
    const n = await get("validate=1", null, IP);
    assert.equal(n.status, 200);
  }
  const miss = await post(null, guessBody("BP-EMP-NOPE0000001"), IP);
  assert.equal(miss.status, 403, "الصحيح حُسب خطأً فحُظر العنوان");
});

test("② تعذّر نوشن (لا جواب) لا يُحسب تخميناً فاشلاً", async () => {
  reset(); empDbFails = true;
  const IP = "198.51.100.66";
  for (let i = 0; i < 25; i++) {
    const r = await post(null, guessBody("BP-EMP-OUTAGE" + i), IP);
    assert.equal(r.status, 403);
  }
  empDbFails = false;
  const r = await post(null, guessBody(A_CODE), IP);
  assert.equal(r.status, 200, "أخطاء العطل حُسبت على العنوان");
});

test("② fail-open: فشل العدّ أو الكتابة لا يمنع ولا يُسقط الطلب", async () => {
  reset();
  const IP = "192.0.2.50";
  const origCount = codeMissSink.count, origWrite = codeMissSink.write;
  try {
    codeMissSink.write = async () => { throw new Error("db down"); };
    for (let i = 0; i < 25; i++) {
      const r = await post(null, guessBody("BP-EMP-FAILOPEN" + i), IP);
      assert.equal(r.status, 403, "فشل الكتابة أسقط الطلب");
    }
    codeMissSink.count = async () => { throw new Error("db down"); };
    const good = await post(null, guessBody(A_CODE), IP);
    assert.equal(good.status, 200, "فشل العدّ منع رمزاً صحيحاً");
  } finally { codeMissSink.count = origCount; codeMissSink.write = origWrite; }
});

test("② الرمز القصير: تخمينٌ متتابع يُقطع قبل أن يتّسع", async () => {
  reset();
  const IP = "192.0.2.99";
  let hit = 0, blocked = 0;
  for (let i = 0; i < 40; i++) {
    const r = await post(null, guessBody("BP-EMP-ZZ" + String(i).padStart(2, "0")), IP);
    if (r.status === 429) blocked++; else if (r.status === 200) hit++;
  }
  assert.equal(hit, 0);
  assert.equal(blocked, 20, "الحدّ ليس عشرين");
});

test("② السقف قابل للضبط من EMP_CODE_MISS_LIMIT", async () => {
  reset();
  process.env.EMP_CODE_MISS_LIMIT = "3";
  try {
    const IP = "192.0.2.123";
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await post(null, guessBody("BP-EMP-LIM" + i), IP)).status);
    assert.deepEqual(codes, [403, 403, 403, 429, 429]);
  } finally { delete process.env.EMP_CODE_MISS_LIMIT; }
});

// /api/hire لا يبقى مسارَ تخمينٍ للرمز: الحدّ نفسه، ثم 429 (لا 403).
test("hire.js يمرّر req إلى resolvePlan ويحوّل limited إلى 429", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../api/hire.js", import.meta.url), "utf8");
  assert.match(src, /resolvePlan\(asked, req\)/, "resolvePlan تُستدعى بلا req فيفلت الحدّ");
  assert.match(src, /r\.limited\) return \{ ok: false, limited: true \}/);
  assert.match(src, /auth\.limited[\s\S]{0,120}statusCode = 429/);
});
