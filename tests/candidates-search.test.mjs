// بحث المرشحين `q` + تصفّح الزائر العام (api/candidates.js) — 2026-10-01.
//
// الحادثة: كتب المالك «CDP» في /hiring فعاد مرشّحٌ واحد، والقاعدة فيها مئاتٌ بمسمّياتٍ
// هي الشيء نفسه (Chef de Partie، شيف دي بارتي، رئيس قسم الطهاة). والفلتر المُستنتَج
// «ضيافة وسياحة» لا يطابق إلا صفاً واحداً بينما ٤٨١٣ صفاً «ضيافة ومطاعم».
//
// يُقاس على `handler` الحقيقي ونوشن وحده مُحاكى (الفلتر يُقيَّم فعلاً على الصفوف). بلا شبكة.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cand-search-"));
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({ users: [], organizations: [], user_sessions: [] }));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.OWNER_DEMO_CODE = "TEST-OWNER-CODE";
delete process.env.EMPLOYER_CODES;

const ATS_DB = "71792742873e4de398135c7855542b95";
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: String(s) }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const ti = (s) => ({ type: "title", title: s ? [{ plain_text: String(s) }] : [] });
const cb = (v) => ({ type: "checkbox", checkbox: !!v });
const nu = (n) => ({ type: "number", number: typeof n === "number" ? n : null });
const rtText = (p) => (p && p.rich_text ? p.rich_text.map((x) => x.plain_text).join("") : "");
const FILL = "إدارة المطبخ والإشراف على فريق التحضير وضمان جودة الأطباق ومعايير السلامة الغذائية في مطاعم الفنادق الكبرى.";

let N = 0;
const ROWS = [];
const row = (role, extra = {}) => {
  N++;
  ROWS.push({ id: `c-${String(N).padStart(4, "0")}`, created_time: "2026-09-20T00:00:00.000Z", properties: {
    "Candidate Name": ti(`Secret Fullname${N} Surname`), "Name (EN)": rt(`Secret Fullname${N} Surname`),
    "Phone": { type: "phone_number", phone_number: `05512${String(N).padStart(5, "0")}` },
    "Email": { type: "email", email: `person${N}@mail.example` },
    "City": rt("الرياض"), "Field": se("ضيافة ومطاعم"), "Source": se("ترشيح"),
    "Original Position": rt(role), "Skills": rt("Menu planning, Plating"),
    "Experience Years": nu(5), "مخفي عن الموقع": cb(false),
    "حالة القراءة": se("مكتمل"), "ATS CV Text": rt("سيرة. " + FILL),
    ...extra,
  } });
  return `c-${String(N).padStart(4, "0")}`;
};

// ── نوشن مُحاكى: يقيّم الفلتر فعلاً ───────────────────────────────────────────
const log = [];
function evalFilter(r, f) {
  if (!f) return true;
  if (f.and) return f.and.every((x) => evalFilter(r, x));
  if (f.or) return f.or.some((x) => evalFilter(r, x));
  const p = r.properties[f.property];
  if (f.checkbox) return !!(p && p.checkbox) === f.checkbox.equals;
  if (f.select) {
    const v = p && p.select ? p.select.name : null;
    if ("equals" in f.select) return v === f.select.equals;
    if ("does_not_equal" in f.select) return v !== f.select.does_not_equal;
  }
  if (f.rich_text) {
    const v = rtText(p).toLowerCase();
    const o = f.rich_text;
    if ("is_not_empty" in o) return v !== "";
    if ("contains" in o) return v.includes(String(o.contains).toLowerCase());
    if ("starts_with" in o) return v.startsWith(String(o.starts_with).toLowerCase());
    if ("equals" in o) return v === String(o.equals).toLowerCase();
  }
  if (f.number && "greater_than_or_equal_to" in f.number) {
    const v = p && typeof p.number === "number" ? p.number : null;
    return v !== null && v >= f.number.greater_than_or_equal_to;
  }
  throw new Error("المُحاكي لا يعرف هذا الفلتر: " + JSON.stringify(f));
}
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  const body = init.body ? JSON.parse(init.body) : {};
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const m = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (!m) return json({}, 404);
  if (m[1] !== ATS_DB) return json({ results: [], has_more: false });
  log.push(body);
  const rows = ROWS.filter((r) => evalFilter(r, body.filter));
  const start = body.start_cursor ? Number(body.start_cursor) : 0;
  const size = body.page_size || 100;
  const more = start + size < rows.length;
  return json({ results: rows.slice(start, start + size), has_more: more, next_cursor: more ? String(start + size) : null });
};

const { default: handler, expandQuery, termsMatch, synKey } = await import("../api/candidates.js");
function get(qs) {
  let body = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { body = b; } };
  return handler({ method: "GET", url: "/api/candidates?" + qs, headers: {}, on() {} }, res)
    .then(() => ({ status: status || 200, raw: body, data: JSON.parse(body) }));
}
const roles = (d) => d.candidates.map((c) => c.role);

// ── البيانات ─────────────────────────────────────────────────────────────────
const CDP_ROWS = ["CDP", "Chef de Partie", "DEMI CHEF DE PARTIE", "شيف دي بارتي", "رئيس قسم الطهاة", "Pastry Chef de Partie"];
for (const r of CDP_ROWS) row(r);
const WAITER = row("Waiter");
const CHRIS = row("Chris Manager");              // فيه «hr» داخل كلمة
const HR_ROW = row("HR Specialist", { "Field": se("موارد بشرية") });
const HR_PAREN = row("Recruiter (HR)", { "Field": se("موارد بشرية") });
const ACCOUNTANT = row("محاسب أول", { "Field": se("محاسبة ومالية") });
// بريدٌ وجوّالٌ داخل المهارات والمسمّى — يجب ألا يصلا الزائر العام (حادثة /hiring).
const LEAKY = row("Private Chef · leaky.person@gmail.com", { "Skills": rt("Cook, +966 50 123 4567, Grill") });
// الكلمة في نصّ السيرة وحده — لا يجدها الزائر العام.
const CV_ONLY = row("Kitchen Helper", { "ATS CV Text": rt("سيرة. " + FILL + " خبرة في zanzibarspice وتحضير المأكولات.") });
// غير مقروء: لا يظهر مهما طابق.
row("CDP", { "حالة القراءة": se("فشل التحليل") });
row("CDP", { "مخفي عن الموقع": cb(true) });

// ── التوسيع والمطابقة ────────────────────────────────────────────────────────
test("«CDP» يتوسّع إلى Chef de Partie وشيف دي بارتي ورئيس قسم الطهاة", () => {
  const ex = expandQuery("CDP");
  for (const want of ["cdp", "chef de partie", "شيف دي بارتي", "رئيس قسم الطهاة", "شيف قسم"]) {
    assert.ok(ex.terms.some((t) => t.k === synKey(want)), "مفقود: " + want);
  }
  for (const r of CDP_ROWS) assert.ok(termsMatch(r, ex.terms), "لم يطابق: " + r);
  assert.ok(!termsMatch("Waiter", ex.terms));
});

test("العكس: «Chef de Partie» يجد «CDP»، وحالة الأحرف لا تهمّ", () => {
  assert.ok(termsMatch("CDP", expandQuery("chef de partie").terms));
  assert.ok(termsMatch("cdp", expandQuery("CHEF DE PARTIE").terms));
  assert.ok(termsMatch("Sous-Chef", expandQuery("sous chef").terms), "الشرطة = فراغ");
  assert.ok(termsMatch("F & B Manager", expandQuery("F&B").terms));
  assert.ok(termsMatch("Food and Beverage Supervisor", expandQuery("f&b").terms));
});

test("المختصر الحرفي كلمةٌ كاملة: «HR» لا يطابق «Chris»", () => {
  const ex = expandQuery("HR");
  assert.ok(termsMatch("HR Specialist", ex.terms));
  assert.ok(termsMatch("Recruiter (HR)", ex.terms));
  assert.ok(termsMatch("الموارد البشرية", ex.terms), "المرادف العربي");
  assert.ok(!termsMatch("Chris Manager", ex.terms));
});

test("ما لا مجموعة له يُبحث حرفياً كما كان (جزئياً)", () => {
  const ex = expandQuery("pas");
  assert.ok(termsMatch("Pastry Chef", ex.terms));
  assert.deepEqual(ex.push.map((p) => p.t), ["pas"]);
});

test("الاستعلام الفارغ لا يُنتج حدوداً", () => {
  assert.deepEqual(expandQuery("   ").terms, []);
});

// ── المسار العام ─────────────────────────────────────────────────────────────
test("الزائر العام: q=CDP يعيد كل المسمّيات المرادفة لا صفاً واحداً", async () => {
  const { status, data } = await get("limit=30&q=CDP");
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.unlocked, false);
  const got = new Set(roles(data));
  for (const r of CDP_ROWS) assert.ok(got.has(r), "غاب: " + r);
  assert.ok(!got.has("Waiter") && !got.has("Chris Manager"));
  assert.equal(data.candidates.length, CDP_ROWS.length, "المخفي وغير المقروء لا يظهران");
});

test("q=cdp بأحرف صغيرة، وq=رئيس قسم مباشرةً", async () => {
  const a = await get("limit=30&q=cdp");
  assert.equal(a.data.candidates.length, CDP_ROWS.length);
  const b = await get("limit=30&q=" + encodeURIComponent("رئيس قسم"));
  assert.deepEqual(roles(b.data), ["رئيس قسم الطهاة"]);
});

test("الفلتر المُستنتَج «ضيافة وسياحة» لا يُفرغ القائمة", async () => {
  const { data } = await get("limit=30&field=" + encodeURIComponent("ضيافة وسياحة"));
  assert.ok(data.candidates.length >= CDP_ROWS.length, "فارغةٌ رغم وجود صفوف «ضيافة ومطاعم»");
  const withQ = await get("limit=30&field=" + encodeURIComponent("ضيافة وسياحة") + "&q=CDP");
  assert.equal(withQ.data.candidates.length, CDP_ROWS.length);
});

test("«HR» في المسار العام: الكلمة الكاملة فقط (الحدّ يُمسك في الذاكرة)", async () => {
  const { data } = await get("limit=30&q=hr");
  const got = roles(data);
  assert.ok(got.includes("HR Specialist") && got.includes("Recruiter (HR)"), got.join(" | "));
  assert.ok(!got.includes("Chris Manager"), "«hr» داخل «Chris»");
});

test("الزائر العام لا يرى بريداً ولا جوّالاً ولا الاسم الكامل", async () => {
  for (const qs of ["limit=50", "limit=50&q=chef", "limit=50&q=cook", "limit=50&q=CDP"]) {
    const { raw, data } = await get(qs);
    assert.ok(!/@/.test(raw), "بريد في الحمولة: " + qs);
    assert.ok(!/gmail|leaky\.person|mail\.example/.test(raw));
    assert.ok(!/\+?966\s*50\s*123|55\d{8}/.test(raw), "جوّال في الحمولة: " + qs);
    assert.ok(!/Fullname|Surname/.test(raw), "اسمٌ كامل");
    for (const c of data.candidates) {
      assert.equal(c.email, undefined);
      assert.equal(c.phone, undefined);
      assert.match(c.name, /^S\.( F\.)?$|^S\. S\.$/, "الاسم المقنَّع فقط: " + c.name);
    }
  }
  const leaky = (await get("limit=50&q=" + encodeURIComponent("private chef"))).data.candidates;
  assert.equal(leaky.length, 1);
  assert.ok(!/@|gmail/.test(leaky[0].role + leaky[0].skills), "المسمّى والمهارات من scrubContact");
});

test("بريدٌ أو رقمٌ في خانة البحث لا يُبحث لزائرٍ مجهول", async () => {
  for (const q of ["leaky.person@gmail.com", "gmail", "0501234567", "+966501234567"]) {
    const before = log.length;
    const { data } = await get("limit=30&q=" + encodeURIComponent(q));
    if (/@|\d{5,}/.test(q)) {
      assert.equal(data.candidates.length, 0, q);
      assert.equal(log.length, before, "لا استعلام يصل نوشن: " + q);
    } else {
      // «gmail» ليس بيانات تواصل صريحة، لكنه يُفحص على النصّ المنقّى فلا يطابق شيئاً
      assert.equal(data.candidates.length, 0, q);
    }
  }
});

test("نصّ السيرة لا يُبحث فيه للزائر العام، ويُبحث للمفتوح له", async () => {
  const pub = await get("limit=30&q=zanzibarspice");
  assert.equal(pub.data.candidates.length, 0);
  assert.ok(!log[log.length - 1] || !JSON.stringify(log[log.length - 1]).includes("ATS CV Text\",\"rich_text\":{\"contains\":\"zanzibarspice"),
    "شرط نصّ السيرة لا يصل نوشن من زائرٍ عام");
  const emp = await get("limit=30&code=TEST-OWNER-CODE&q=zanzibarspice");
  assert.equal(emp.data.unlocked, true);
  assert.equal(emp.data.candidates.length, 1);
  assert.ok(emp.data.candidates[0].email, "المفتوح له يرى بيانات التواصل");
});

// ── التصفيح ──────────────────────────────────────────────────────────────────
test("done و nextCursor صحيحان عبر الصفحات، وlimit الافتراضي ٣٠ والأقصى ٥٠ للزائر", async () => {
  const before = ROWS.length;
  for (let i = 0; i < 70; i++) row("Line Cook " + i);
  const def = await get("");                       // بلا limit: مصفَّح بـ٣٠ لا مسحٌ كامل
  assert.equal(def.data.candidates.length, 30);
  assert.equal(def.data.done, false);
  assert.ok(def.data.nextCursor);

  const seen = new Set(def.data.candidates.map((c) => c.id));
  let cur = def.data.nextCursor, pages = 1, last = def.data;
  while (cur && pages < 20) {
    last = (await get("cursor=" + encodeURIComponent(cur))).data;
    for (const c of last.candidates) { assert.ok(!seen.has(c.id), "صفٌّ مكرَّر"); seen.add(c.id); }
    cur = last.nextCursor; pages++;
  }
  assert.equal(last.done, true);
  assert.equal(last.nextCursor, null);
  const readable = ROWS.filter((r) => r.properties["حالة القراءة"].select.name === "مكتمل" && !r.properties["مخفي عن الموقع"].checkbox).length;
  assert.equal(seen.size, readable, "كل المقروء وصل مرةً واحدة");
  assert.ok(ROWS.length - before === 70);

  const big = await get("limit=500");
  assert.equal(big.data.candidates.length, 50, "الأقصى للزائر ٥٠");
  const small = await get("limit=7");
  assert.equal(small.data.candidates.length, 7);
});

test("total: إجماليٌّ صادق أو غائب — لا عدد الصفحة", async () => {
  // فلترٌ تنتهي نتائجه في صفحة ⇒ العدد الدقيق
  const exact = (await get("limit=30&q=CDP")).data;
  assert.equal(exact.total, CDP_ROWS.length);
  assert.equal(exact.totalApprox, false);
  assert.equal(exact.done, true);
  // نتائج أكثر من صفحة ⇒ لا total
  const more = (await get("limit=30&field=" + encodeURIComponent("ضيافة ومطاعم"))).data;
  assert.equal(more.done, false);
  assert.equal("total" in more, false, "لا إجماليَّ معروفاً: لا يُعاد");
  // صفحةٌ تالية ⇒ لا total
  const next = (await get("limit=30&cursor=" + encodeURIComponent(more.nextCursor))).data;
  assert.equal("total" in next, false);
  // بلا فلتر ومعه عدّاد مخزَّن ⇒ تقريبٌ معلَّم
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (/245f3a1ffb1844b19707bb67120b9605\/query/.test(String(url))) {
      return new Response(JSON.stringify({ results: [{ id: "m1", properties: {
        "القيمة": { number: 26000 }, "آخر حساب": { date: { start: new Date().toISOString() } } } }], has_more: false }),
      { status: 200, headers: { "content-type": "application/json" } });
    }
    return prev(url, init);
  };
  try {
    const un = (await get("limit=30")).data;
    assert.equal(un.total, 26000);
    assert.equal(un.totalApprox, true);
  } finally { globalThis.fetch = prev; }
});

test("minExp يعمل في المسار العام", async () => {
  row("Exp Cook Nine", { "Experience Years": nu(9) });
  const { data } = await get("limit=30&minExp=9&q=" + encodeURIComponent("exp cook"));
  assert.deepEqual(roles(data), ["Exp Cook Nine"]);
});

test("الصفحة الناقصة تُكمَّل من التالية دون تجاوز limit", async () => {
  // خمسةٌ غير مقروءة متتالية تُسقط صفحةً صغيرة، والمقروء بعدها يُجلب في الطلب نفسه.
  const start = ROWS.length;
  for (let i = 0; i < 5; i++) row("Refill Probe", { "ATS CV Text": rt("# الاسم\n## الخبرة\n## التعليم") });   // هيكلٌ فارغ ⇒ غير مقروء
  for (let i = 0; i < 5; i++) row("Refill Probe");
  const { data } = await get("limit=5&q=" + encodeURIComponent("refill probe"));
  assert.equal(data.candidates.length, 5, "الصفحة اكتملت من الصفّ التالي");
  assert.ok(ROWS.length - start === 10);
  assert.equal(data.done, true);
});
