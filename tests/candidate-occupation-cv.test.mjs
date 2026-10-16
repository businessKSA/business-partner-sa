// استدراك المهنة من آخر دورٍ مؤرَّخ في السيرة (api/candidate.js ‏action=occupation-backfill) — 2026-10-01.
//
// الغاية: «Original Position» يطابق آخر منصبٍ في 85٪ فقط من عيّنةٍ قِيست، والمتدرّب والمسمّى العامّ لا مهنة
// لهما من العنوان. فيُسأل أزور عن مسمّى آخر دورٍ مؤرَّخ في **قسم الخبرات وحده**، ويصنّفه المصنِّف نفسه.
// ما يُثبَّت هنا (نوشن وأزور مُحاكيان، بلا شبكة):
//   ① المصادقة (مفتاح المالك أو Bearer CRON_SECRET) وdryRun لا يكتب ولا ينادي.
//   ② لا اسمَ ولا بريدَ ولا جوّالَ يذهب إلى أزور — قسم الخبرات فقط، منزوعاً منه التواصل.
//   ③ لا يكتب إلا إن كان الحكم أفضل، ولا يدهس مهنةً بثقةٍ مساوية أو أعلى، والهلوسة لا ترفع الثقة فوق «متوسطة».
//   ④ التدريب لا يصير مهنة. ⑤ idempotent: يُختم الصفّ دائماً بعد المحاولة، ولا يُنادى النموذج مرّتين.
//   ⑥ الميزانية: لا يبدأ نداءٌ بعد ٥٥ ثانية. ⑦ فشلُ أزور لا يختم الصفّ فيُعاد.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-occcv-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.CRON_SECRET = "cron-secret-for-tests";
process.env.PANEL_KEY = "panel-key-for-tests";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
for (const k of ["AZURE_OPENAI_ENDPOINT_2", "RESEND_API_KEY", "LEADS_KEY"]) delete process.env[k];

const ATS_DB = "71792742873e4de398135c7855542b95";
const NONE = "غير مصنّف | Unclassified";
let queryBody, queryStatus, rowsOut, hasMore, patches, azureCalls, azureReply, clock;
const reset = () => { queryBody = null; queryStatus = 200; rowsOut = []; hasMore = false; patches = {}; azureCalls = []; azureReply = () => ({ last_role: "", period: "" }); clock = null; };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};
  if (u.startsWith("https://azure.test/")) {
    azureCalls.push(body);
    if (clock) clock.t += clock.perCall;
    const r = azureReply(body, azureCalls.length);
    if (r === "fail") return json({ error: "boom" }, 400);
    return json({ choices: [{ message: { content: typeof r === "string" ? r : JSON.stringify(r) }, finish_reason: "stop" }] });
  }
  if (u.startsWith("https://api.notion.com/v1/databases/") && u.endsWith("/query")) {
    assert.ok(u.includes(ATS_DB));
    queryBody = body;
    if (queryStatus !== 200) return json({ message: "validation_error: property" }, queryStatus);
    return json({ results: rowsOut, has_more: hasMore, next_cursor: hasMore ? "cur-2" : null });
  }
  if (u.startsWith("https://api.notion.com/v1/pages/") && init.method === "PATCH") {
    patches[u.split("/").pop()] = body.properties;
    return json({ id: "ok" });
  }
  throw new Error("no network in tests: " + u);
};

const mod = await import("../api/candidate.js");
const { cvExperienceSection, decideOccupationFromRole, OCC_REASON_PROP, OCC_CV_MARK } = mod;
const handler = mod.default;

function call(method, { query = "", headers = {}, body } = {}) {
  let out = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
  const req = { method, url: "/api/candidate" + query, headers, body, on() {} };
  return handler(req, res).then(() => ({ status: status || 200, data: JSON.parse(out) }));
}
const cron = { authorization: "Bearer cron-secret-for-tests" };
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: s }] : [] });
const se = (s) => ({ type: "select", select: s ? { name: s } : null });
const PHONE = "0551234567", EMAIL = "secret.person@example.com", NAME = "Secret Fullname Person";
const cv = (exp) => `# ${NAME}\n\n## التواصل\n- **البريد الإلكتروني:** ${EMAIL}\n- **الهاتف:** ${PHONE}\n- **المدينة:** الرياض\n\n## ملخص\nملخصٌ لا يُرسَل.\n\n${exp}\n\n## التعليم\n- بكالوريوس\n\n## اللغات\n- العربية`;
const EXP_WAITER = `## الخبرات\n- **Waiter** at Crustacean Restaurant (2022 - Present)\n- **Barista** at Cafe X (2019 - 2020)\n- **Intern** at Hotel Y (2018)`;
let n = 0;
const row = (extra = {}, text = cv(EXP_WAITER)) => {
  n += 1;
  return { id: `page-${n}`, properties: {
    "Candidate Name": { type: "title", title: [{ plain_text: NAME }] }, "Phone": { type: "phone_number", phone_number: PHONE },
    "Email": { type: "email", email: EMAIL }, "ATS CV Text": rt(text), "المهنة الموحّدة": se(NONE), ...extra,
  } };
};
const sel = (props, k) => (props && props[k] && props[k].select && props[k].select.name) || "";
const reasonOf = (id) => (patches[id][OCC_REASON_PROP].rich_text || []).map((t) => t.text.content).join("");

test("المصادقة: بلا مفتاح ولا Bearer ⇒ 403؛ ومفتاح المالك أو Bearer CRON_SECRET ⇒ يمرّ", async () => {
  reset();
  assert.equal((await call("GET", { query: "?action=occupation-backfill&dryRun=1" })).status, 403);
  assert.equal((await call("GET", { query: "?action=occupation-backfill&dryRun=1", headers: { authorization: "Bearer wrong" } })).status, 403);
  assert.equal((await call("GET", { query: "?action=occupation-backfill&dryRun=1&key=panel-key-for-tests" })).status, 200);
  assert.equal((await call("GET", { query: "?action=occupation-backfill&dryRun=1", headers: cron })).status, 200);
  assert.equal(azureCalls.length, 0);
});

test("المرشِّح: غير مصنّف أو ثقة منخفضة أو بلا مسمّى، ولها نصّ سيرة، ولا علامة «من السيرة» بعد", async () => {
  reset();
  await call("GET", { query: "?action=occupation-backfill&dryRun=1", headers: cron });
  const f = JSON.stringify(queryBody.filter);
  assert.ok(f.includes('"ATS CV Text"') && f.includes("is_not_empty"));
  assert.ok(f.includes(NONE) && f.includes("منخفضة"));
  assert.ok(f.includes('"Original Position"') && f.includes("is_empty"), "الصفوف بلا مسمّى تدخل");
  assert.ok(f.includes(OCC_REASON_PROP) && f.includes("does_not_contain") && f.includes(OCC_CV_MARK), "لا علامة ⇒ يُعاد إلى الأبد");
});

test("dryRun: لا نداء ولا كتابة، ويقدّر النداءات والرموز، بلا حقلٍ شخصي", async () => {
  reset();
  rowsOut = [row(), row({}, cv("## ملخص\nبلا خبرات")), row()];
  hasMore = true;
  const r = await call("GET", { query: "?action=occupation-backfill&dryRun=1&limit=50", headers: cron });
  assert.equal(r.status, 200);
  assert.equal(azureCalls.length, 0); assert.deepEqual(patches, {});
  assert.equal(r.data.dryRun, true); assert.equal(r.data.scanned, 3);
  assert.equal(r.data.withSection, 2); assert.equal(r.data.noSection, 1); assert.equal(r.data.estCalls, 2);
  assert.ok(r.data.estTokensIn > 400 && r.data.estTokensIn < 1500, String(r.data.estTokensIn));
  assert.equal(r.data.more, true); assert.equal(r.data.next, "cur-2");
  const s = JSON.stringify(r.data);
  for (const x of [NAME, PHONE, EMAIL]) assert.ok(!s.includes(x), "حقلٌ شخصي في الردّ: " + x);
});

test("مفتاحٌ مفقود في المخطّط ⇒ 503 صريح لا عطلاً صامتاً", async () => {
  reset(); queryStatus = 400;
  const r = await call("GET", { query: "?action=occupation-backfill&dryRun=1", headers: cron });
  assert.equal(r.status, 503); assert.equal(r.data.error, "schema_missing");
});

test("قسم الخبرات وحده يذهب إلى أزور، بلا اسمٍ ولا بريدٍ ولا جوّال، ونصّ السيرة يُحاط ببيانات", async () => {
  reset();
  const dirty = cv(`## الخبرات\n- **Waiter** (2022 - Present) — للتواصل ${EMAIL} أو ${PHONE}`);
  rowsOut = [row({}, dirty)];
  azureReply = () => ({ last_role: "Waiter", period: "2022 - Present" });
  await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(azureCalls.length, 1);
  const sent = JSON.stringify(azureCalls[0]);
  for (const x of [NAME, PHONE, EMAIL, "الرياض", "ملخصٌ لا يُرسَل", "بكالوريوس"]) assert.ok(!sent.includes(x), "ذهب إلى أزور: " + x);
  assert.ok(sent.includes("Waiter"));
  assert.ok(sent.includes("<experience>") && sent.includes("تعليمات"), "السيرة بياناتٌ لا تعليمات");
  assert.equal(azureCalls[0].temperature, 0);
  assert.deepEqual(azureCalls[0].response_format, { type: "json_object" });
});

test("غير مصنّف + آخر دور «Waiter» (والتدريب بعده في النصّ لا يُحتسب) ⇒ تُكتب المهنة والثقة والسبب", async () => {
  reset();
  rowsOut = [row()];
  azureReply = () => ({ last_role: "Waiter", period: "2022 - Present" });
  const r = await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(r.status, 200); assert.equal(r.data.calls, 1); assert.equal(r.data.written, 1);
  const p = patches["page-" + n];
  assert.equal(sel(p, "المهنة الموحّدة"), "نادل | Waiter / Server");
  assert.equal(sel(p, "ثقة المهنة"), "عالية", "مسمّىً ورد حرفياً في السيرة وطابق تماماً");
  assert.match(reasonOf("page-" + n), /^\[من السيرة \d{4}-\d{2}-\d{2}\] آخر دور: Waiter \(2022 - Present\)/);
  assert.ok(r.data.tokensIn > 0 && r.data.tokensOut > 0);
  const s = JSON.stringify(r.data);
  for (const x of [NAME, PHONE, EMAIL]) assert.ok(!s.includes(x));
});

test("التدريب لا يصير مهنة: «Intern» ⇒ لا تغيير في المهنة، ويُختم الصفّ", async () => {
  reset();
  rowsOut = [row()];
  azureReply = () => ({ last_role: "Intern", period: "2018" });
  const r = await call("GET", { query: "?action=occupation-backfill", headers: cron });
  const p = patches["page-" + n];
  assert.equal(p["المهنة الموحّدة"], undefined);
  assert.equal(r.data.unchanged, 1); assert.equal(r.data.written, 0);
  assert.match(reasonOf("page-" + n), /لم يُحسم المسمّى/);
});

test("لا يدهس مهنةً بثقةٍ مساوية أو أعلى، ويرفع المنخفضة", async () => {
  // الحالية «متوسطة» والجديدة «عالية» ⇒ تُكتب. الحالية «عالية» ⇒ لا تُمسّ.
  const cur = (name, conf) => ({ "المهنة الموحّدة": se(name), "ثقة المهنة": se(conf) });
  reset();
  azureReply = () => ({ last_role: "Waiter", period: "2022" });
  rowsOut = [row(cur("طباخ | Cook", "عالية"))];
  await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(patches["page-" + n]["المهنة الموحّدة"], undefined, "دِيست مهنةٌ بثقةٍ عالية");
  assert.match(reasonOf("page-" + n), /الحالية بثقةٍ مساوية أو أعلى/);

  reset(); azureReply = () => ({ last_role: "Waiter", period: "2022" });
  rowsOut = [row(cur("طباخ | Cook", "منخفضة"))];
  await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(sel(patches["page-" + n], "المهنة الموحّدة"), "نادل | Waiter / Server");
  assert.match(reasonOf("page-" + n), /ثقةٌ أعلى/);
});

test("الهلوسة: مسمّىً لم يرد في السيرة حرفياً لا تتجاوز ثقته «متوسطة»", async () => {
  reset();
  rowsOut = [row()];
  azureReply = () => ({ last_role: "Executive Chef", period: "2022" });     // ليس في EXP_WAITER
  await call("GET", { query: "?action=occupation-backfill", headers: cron });
  const p = patches["page-" + n];
  assert.equal(sel(p, "المهنة الموحّدة"), "شيف تنفيذي | Executive Chef");
  assert.equal(sel(p, "ثقة المهنة"), "متوسطة");
});

test("لا قسم خبرات ⇒ لا نداء، ويُختم الصفّ كي لا يُعاد", async () => {
  reset();
  rowsOut = [row({}, cv("## ملخص\nلا خبرات هنا"))];
  const r = await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(azureCalls.length, 0);
  assert.equal(r.data.noSection, 1);
  assert.match(reasonOf("page-" + n), /لا قسم خبرات/);
  assert.equal(patches["page-" + n]["المهنة الموحّدة"], undefined);
});

test("idempotent: صفٌّ مختومٌ يُتجاهل ولو وصل، فلا نداءَ ثانياً", async () => {
  reset();
  rowsOut = [row({ [OCC_REASON_PROP]: rt("[من السيرة 2026-10-01] آخر دور: X") })];
  const r = await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(azureCalls.length, 0); assert.deepEqual(patches, {}); assert.equal(r.data.scanned, 0);
});

test("فشلُ أزور لا يختم الصفّ (يُعاد لاحقاً) ولا يكتب شيئاً، وردّه غير مقروء كذلك", async () => {
  reset();
  rowsOut = [row(), row()];
  azureReply = (b, i) => (i === 1 ? "fail" : "ليس JSON");
  const r = await call("GET", { query: "?action=occupation-backfill", headers: cron });
  assert.equal(r.data.failed, 2); assert.equal(r.data.written, 0);
  assert.deepEqual(patches, {});
});

test("الميزانية: لا يبدأ نداءٌ بعد ٥٥ ثانية، ويُبلَّغ بالمتبقّي لا بالنجاح", async () => {
  reset();
  const realNow = Date.now;
  clock = { t: realNow(), perCall: 20000 };
  Date.now = () => clock.t;
  try {
    rowsOut = Array.from({ length: 12 }, () => row());
    azureReply = () => ({ last_role: "Waiter", period: "2022" });
    const r = await call("GET", { query: "?action=occupation-backfill&limit=12", headers: cron });
    assert.ok(r.data.skipped >= 1, "لم يتوقف عند الميزانية");
    assert.ok(r.data.calls < 12);
    assert.equal(r.data.more, true);
    assert.equal(Object.keys(patches).length, r.data.written + r.data.unchanged);
  } finally { Date.now = realNow; }
});

test("POST type=occupation-backfill يعمل بمفتاح المالك، والحدّ الأعلى للدفعة ٢٥", async () => {
  reset();
  rowsOut = [];
  const r = await call("POST", { body: { type: "occupation-backfill", key: "panel-key-for-tests", limit: 999 } });
  assert.equal(r.status, 200);
  assert.equal(queryBody.page_size, 25);
});

test("وحدات صِرفة: قسم الخبرات يُستخرج بلا تواصل، والقرار قابلٌ للاختبار بلا شبكة", () => {
  const sec = cvExperienceSection(cv(EXP_WAITER));
  assert.ok(sec.includes("Waiter") && sec.includes("Barista"));
  assert.ok(!sec.includes(EMAIL) && !sec.includes(PHONE) && !sec.includes("بكالوريوس"));
  assert.equal(cvExperienceSection("لا عناوين"), "");
  assert.ok(cvExperienceSection("# X\n## Work Experience\n### Co\n**Chef** 2020-2022\n## Education\nBSc").includes("Chef"), "العناوين الفرعية جزءٌ من القسم");
  assert.equal(decideOccupationFromRole({ name: NONE, conf: "" }, "Waiter", true).write, true);
  assert.equal(decideOccupationFromRole({ name: NONE, conf: "" }, "Intern", true).write, false);
  assert.equal(decideOccupationFromRole({ name: "طباخ | Cook", conf: "عالية" }, "Waiter", true).write, false);
  assert.equal(decideOccupationFromRole({ name: "طباخ | Cook", conf: "متوسطة" }, "Waiter", true).write, true);
  assert.equal(decideOccupationFromRole({ name: NONE, conf: "" }, "Waiter", false).conf, "medium");
});
