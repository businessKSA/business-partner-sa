// المهنة الموحّدة عند استيراد المتقدّم عبر الموقع (api/candidate.js) — 2026-10-01.
//
// الطلب: جدول المرشّحين يُقسَّم على المهنة الحقيقية، والبحث والمطابقة يعملان على مهنةٍ واحدة لا على
// نصٍّ حرّ. هنا تُثبَّت ثلاثةُ أمورٍ على المسار الحقيقي (handler) ونوشن وحده مُحاكى:
//   ① المهنة تُكتب مرةً عند الإنشاء، بقيمةٍ واحدة لكل صيغٍ الكتابة («CDP»/«Chef de Partie»/«شيف دي بارتي»)،
//      وثقتها لا تتجاوز «متوسطة» لأن المصدر مسمّىً كتبه المرشّح عن نفسه لا آخر منصبٍ في سيرته.
//   ② إعادة التقديم لا تُنشئ صفاً ثانياً، ولا تمحو مهنةً محسومة، ولا تكتب مهنةً من عنوان الإعلان.
//   ③ قاعدةٌ لا عمودَ فيها لا يسقط معها إنشاء المرشّح (الكتابة اختيارية كالتوطين).
// ولا شيءَ من هذا يُرجَع في الاستجابة: الشاشة لا تحتاج المهنة.
//
// بلا شبكة: أي نداء إلى غير نوشن/n8n/أزور يرمي.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-occ-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.N8N_ATS_WEBHOOK = "https://n8n.test/webhook/bp-ats-application";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
for (const k of ["AZURE_DOCINTEL_ENDPOINT", "AZURE_DOCINTEL_KEY", "AZURE_OPENAI_ENDPOINT_2", "RESEND_API_KEY", "PANEL_KEY", "LEADS_KEY"]) delete process.env[k];

const ATS_DB = "71792742873e4de398135c7855542b95";
let calls, created, patched, existingRow, missingColumn;
const reset = () => { calls = { create: 0, patch: 0, createAttempts: 0 }; created = patched = existingRow = null; missingColumn = false; };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};
  if (u.startsWith("https://n8n.test/")) return json({});
  if (u.startsWith("https://azure.test/")) return json({ choices: [{ message: { content: JSON.stringify({ saudization: "بحاجة فحص", saudization_details: "غير معروفة." }) }, finish_reason: "stop" }] });
  if (u.startsWith("https://api.notion.com/v1/databases/")) {
    assert.ok(u.includes(ATS_DB), "استعلامٌ على قاعدة غير قاعدة المرشحين: " + u);
    return json({ results: existingRow ? [existingRow] : [], has_more: false });
  }
  // نوشن يسمّي أول خاصيةٍ غائبة فقط في كل ردّ
  const bad = (props) => json({ object: "error", status: 400, code: "validation_error", message: `${props["المهنة الموحّدة"] ? "المهنة الموحّدة" : "ثقة المهنة"} is not a property that exists.` }, 400);
  const lacks = (props) => missingColumn && (props["المهنة الموحّدة"] || props["ثقة المهنة"]);
  if (u === "https://api.notion.com/v1/pages" && init.method === "POST") {
    calls.createAttempts += 1;
    if (lacks(body.properties)) return bad(body.properties);
    calls.create += 1; created = body.properties;
    return json({ id: "11111111-2222-3333-4444-555555555555" });
  }
  if (u.startsWith("https://api.notion.com/v1/pages/") && init.method === "PATCH") {
    if (lacks(body.properties)) return bad(body.properties);
    calls.patch += 1; patched = body.properties;
    return json({ id: "patched" });
  }
  throw new Error("no network in tests: " + u);
};

const mod = await import("../api/candidate.js");
const { applyOccupation, OCC_PROP, OCC_CONF_PROP } = mod;
const handler = mod.default;

function invoke(payload) {
  let out = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
  return handler({ method: "POST", url: "/api/candidate", headers: {}, body: payload, on() {} }, res)
    .then(() => ({ status: status || 200, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}
let seq = 0;
const apply = (extra = {}) => invoke({
  name: "محمد العبدالله", phone: "05100000" + String(++seq).padStart(2, "0"), email: `occ${seq}@example.com`,
  jobId: "candidate-pool", jobTitle: "General candidate pool", consent: true, ...extra,
});
const sel = (props, k) => (props && props[k] && props[k].select && props[k].select.name) || "";
const txtOf = (props, k) => (props && props[k] && props[k].rich_text ? props[k].rich_text.map((t) => t.text.content).join("") : "");
const CDP = "شيف قسم (CDP) | Chef de Partie (CDP)";
const NONE = "غير مصنّف | Unclassified";

test("اسما العمودين كما أُنشئا في القاعدة", () => {
  assert.equal(OCC_PROP, "المهنة الموحّدة");
  assert.equal(OCC_CONF_PROP, "ثقة المهنة");
});

test("إنشاء: صيغٌ شتّى لمهنةٍ واحدة ⇒ قيمةٌ واحدة، والثقة لا تتجاوز «متوسطة»", async () => {
  const seen = new Set();
  for (const field of ["CDP", "Chef de Partie", "شيف دي بارتي", "شيف قسم", "chef de party - Marriott (Riyadh)"]) {
    reset();
    const r = await apply({ field });
    assert.equal(r.status, 200, field);
    assert.equal(calls.create, 1, "صفٌّ واحد");
    seen.add(sel(created, OCC_PROP));
    assert.equal(sel(created, OCC_CONF_PROP), "متوسطة", `${field}: مسمّىً ذكره بنفسه — لا «عالية»`);
  }
  assert.deepEqual([...seen], [CDP]);
});

test("مسمّى لا يعرفه المصنِّف ⇒ «غير مصنّف» صريحة بثقة منخفضة، لا تخميناً", async () => {
  reset();
  await apply({ field: "xyzzy plugh frobnicator" });
  assert.equal(sel(created, OCC_PROP), NONE);
  assert.equal(sel(created, OCC_CONF_PROP), "منخفضة");
  reset();
  await apply({ field: "مدير" });                      // مسمّىً عامّ بلا مجال
  assert.equal(sel(created, OCC_PROP), NONE);
});

test("بلا مسمّىً ⇒ لا تُكتب المهنة، وعنوان الإعلان ليس مسمّى المرشّح", async () => {
  reset();
  await apply({ field: "", jobId: "job-123", jobTitle: "نادل" });
  assert.equal(calls.create, 1);
  assert.equal(created[OCC_PROP], undefined, "كُتبت مهنةٌ من عنوان إعلان تقدّم له");
  assert.equal(created[OCC_CONF_PROP], undefined);
});

test("إعادة التقديم: لا صفّ ثانٍ، ومهنةٌ محسومة لا تُمحى، ومسمّى الصفّ أصدق من مسمّى التقديم", async () => {
  // ① الصفّ الأول
  reset();
  const first = await apply({ field: "Waiter", email: "dup@example.com", phone: "0510099900" });
  assert.equal(first.status, 200); assert.equal(calls.create, 1); assert.equal(calls.patch, 0);
  assert.equal(sel(created, OCC_PROP), "نادل | Waiter / Server");

  // ② نفس الشخص يعيد التقديم بمسمّىً آخر، والصفّ قائمٌ بمهنةٍ محسومة (كتبها الباك فيل مثلاً)
  reset();
  existingRow = { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", properties: {
    "المهنة الموحّدة": { type: "select", select: { name: "شيف تنفيذي | Executive Chef" } },
    "Original Position": { type: "rich_text", rich_text: [{ plain_text: "Executive Chef" }] },
    "Skills": { type: "rich_text", rich_text: [{ plain_text: "x" }] },
  } };
  const again = await apply({ field: "Waiter", email: "dup@example.com", phone: "0510099900" });
  assert.equal(again.status, 200); assert.equal(again.data.updated, true);
  assert.equal(calls.create, 0, "أُنشئ صفٌّ ثانٍ لنفس الشخص");
  assert.equal(calls.patch, 1);
  assert.equal(patched[OCC_PROP], undefined, "مُحيت مهنةٌ محسومة");
  assert.equal(patched[OCC_CONF_PROP], undefined);

  // ③ صفٌّ قائم بلا مهنة وله Original Position: تُشتقّ منه لا من مسمّى التقديم
  reset();
  existingRow = { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", properties: {
    "Original Position": { type: "rich_text", rich_text: [{ plain_text: "Executive Chef" }] },
    "Skills": { type: "rich_text", rich_text: [{ plain_text: "x" }] },
  } };
  await apply({ field: "Waiter", email: "dup@example.com", phone: "0510099900" });
  assert.equal(sel(patched, OCC_PROP), "شيف تنفيذي | Executive Chef");

  // ④ صفٌّ مهنته «غير مصنّف» يُستبدل حين يتبيّن
  reset();
  existingRow = { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", properties: {
    "المهنة الموحّدة": { type: "select", select: { name: NONE } },
    "Skills": { type: "rich_text", rich_text: [{ plain_text: "x" }] },
  } };
  await apply({ field: "Barista", email: "dup@example.com", phone: "0510099900" });
  assert.equal(sel(patched, OCC_PROP), "باريستا | Barista");
});

test("قاعدةٌ لا عمودَ فيها ⇒ لا يسقط إنشاء المرشّح (يُعاد بدون العمودين)", async () => {
  reset(); missingColumn = true;
  const r = await apply({ field: "Waiter" });
  assert.equal(r.status, 200, "سقط تقديمُ مرشّحٍ حقيقي لأجل عمودٍ غائب");
  assert.equal(r.data.ok, true);
  assert.equal(calls.createAttempts, 3, "نوشن يسمّي عموداً واحداً في كل ردّ: محاولتان تسقطان العمودين ثم ثالثةٌ تنجح");
  assert.equal(calls.create, 1);
  assert.equal(created[OCC_PROP], undefined);
  assert.equal(created[OCC_CONF_PROP], undefined);
  assert.equal(txtOf(created, "Skills"), "Waiter");
  // العمودان وحدهما سقطا: غياب «المهنة الموحّدة» لا يُسقط التوطين ولا حالة القراءة معه
  assert.ok(created["التوطين Saudization"], "سقط التوطين لأن عمود المهنة غائب");
  assert.ok(created["حالة القراءة"], "سقطت حالة القراءة لأن عمود المهنة غائب");
});

test("الاستجابة لا تُرجع المهنة ولا غيرها: الشاشة لا تحتاجها", async () => {
  reset();
  const r = await apply({ field: "Accountant" });
  assert.deepEqual(Object.keys(r.data).sort(), ["n8n", "ok", "ref", "updated"]);
  assert.ok(!JSON.stringify(r.data).includes("محاسب"));
});

test("applyOccupation نقيّة: لا تغيّر المدخل الأصلي بل تكتب على props وحدها", () => {
  const props = {};
  const out = applyOccupation(props, "محاسب أول", null, "");
  assert.equal(out, props);
  assert.equal(sel(props, OCC_PROP), "محاسب / مسؤول مالي | Accountant / Finance Officer");
  assert.equal(sel(props, OCC_CONF_PROP), "متوسطة");
  const existing = Object.freeze({ "المهنة الموحّدة": { select: { name: "طباخ | Cook" } } });
  const p2 = {};
  applyOccupation(p2, "محاسب", existing, "");
  assert.deepEqual(p2, {}, "كُتب فوق مهنةٍ محسومة");
  const p3 = {};
  applyOccupation(p3, "", null, "");
  assert.deepEqual(p3, {});
});
