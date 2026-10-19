// وقود وكلاء التوظيف — نصّ السيرة الذاتية  (api/candidate.js)
//
// شغّله: npm test
//
// ما الذي يُثبَّت هنا، ولماذا يستحقّ اختباراً:
//
// وكلاء التوظيف (فرز، تقييم، أسئلة مقابلة، عرض، عقد) تتغذّى كلها من حقل واحد
// في قاعدة المرشحين: «ATS CV Text». وكان استخراجه معلّقاً بكامله على خطّاف n8n
// خارجي: ننتظره، وإن تأخّر أو فشل يُنشأ المرشّح **بلا نصّ سيرة ولا علامة** —
// و«حالة القراءة» تُكتب «مكتمل» على أي حال. القياس على القاعدة الحقيقية
// (2026-09-29، ٢٦٤٠٢ صفاً): «ATS CV Text» غير فارغ في صفٍّ واحد، وكُتب «مكتمل»
// على ١٠٢٥ صفاً من صفوف الموقع لا نصّ فيها.
//
// فلهذا الاختبار أربعة أوجه، وكلٌّ منها عطلٌ مضى:
//   ① n8n ينجح ⇒ **لا نداء احتياطي** على أزور. الاحتياطي ليس مجاناً، ونجاحُ
//      الأول يجب أن يعني صفر تكلفة.
//   ② n8n يفشل/يتأخّر ⇒ الاحتياطي يعمل والنصّ يُكتب فعلاً في «ATS CV Text».
//   ③ كلاهما يفشل ⇒ المرشّح **يُنشأ** موسوماً بالسبب. فقدانُ طلبِ مرشّحٍ
//      حقيقي أسوأ من فقدان سيرته، والوسمُ هو ما يمنع الفرز من الحكم على فراغ.
//   ④ نوعٌ غير مدعوم (ملف Word) ⇒ لا نداء أزور إطلاقاً، وعلامةٌ صحيحة —
//      لا «فشل تحليل» على ملفٍ لم تُحاول قراءته أصلاً.
//
// وكلها تُقاس على `handler` الحقيقي. بلا شبكة: أي نداء إلى غير نوشن/n8n/أزور
// يرمي. ولا مفتاح حقيقي في العملية.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// تُضبط قبل الاستيراد: الوحدة تقرأ البيئة وقت التحميل لا وقت النداء.
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cv-fuel-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.N8N_ATS_WEBHOOK = "https://n8n.test/webhook/bp-ats-application";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
// قراءة الـPDF خدمةٌ أخرى بمفتاحٍ آخر — تُترك مطفأة ليُقاس فرعُ «غير مهيّأ».
delete process.env.AZURE_DOCINTEL_ENDPOINT;
delete process.env.AZURE_DOCINTEL_KEY;
delete process.env.AZURE_OPENAI_ENDPOINT_2;
// لا بريد يُرسل في اختبار، ولا رمز لوحة يفتح مسار الاستدراك.
delete process.env.RESEND_API_KEY;
delete process.env.PANEL_KEY;
delete process.env.LEADS_KEY;

const ATS_DB = "71792742873e4de398135c7855542b95";
const CV_TEXT = [
  "# محمد العبدالله",
  "## الملخص",
  "أخصائي موارد بشرية بخبرة سبع سنوات في التوظيف وعمليات الموارد البشرية في الرياض.",
  "## الخبرات",
  "- أخصائي توظيف — شركة المثال — 2019 حتى الآن",
  "- منسّق موارد بشرية — شركة أخرى — 2017 إلى 2019",
  "## التعليم",
  "- بكالوريوس إدارة أعمال — جامعة الملك سعود",
].join("\n");

// ------------------------------------------------------- ما يقرره كل اختبار --
let n8nReply = null;        // ما يردّ به n8n، أو "abort" ليُحاكي المهلة
let azureReply = null;      // ما يردّ به أزور على قراءة السيرة، أو "fail"
// عدّادات: النداء الذي لا يقع هو نصف ما يُقاس هنا.
let calls = { n8n: 0, cvRead: 0, boost: 0, notionCreate: 0, notionPatch: 0 };
let created = null;         // خصائص الصفحة التي أُنشئت
let patched = null;
let existingRow = null;     // ما يعيده findExisting

const reset = () => {
  calls = { n8n: 0, cvRead: 0, boost: 0, notionCreate: 0, notionPatch: 0 };
  created = patched = existingRow = null;
  n8nReply = null;
  azureReply = { choices: [{ message: { content: JSON.stringify({ cv_markdown: CV_TEXT }) }, finish_reason: "stop" }] };
};

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};

  if (u.startsWith("https://n8n.test/")) {
    calls.n8n += 1;
    // ما يراه `forwardToN8n` عند انتهاء مهلته هو بالضبط هذا: رفضُ fetch
    // بـAbortError. فالفرع المقيس هو فرع المهلة نفسه، بلا انتظار ٢٥ ثانية.
    if (n8nReply === "abort") throw new DOMException("The operation was aborted", "AbortError");
    if (n8nReply === "error") return json({ message: "n8n down" }, 500);
    return json(n8nReply || {});
  }

  if (u.startsWith("https://azure.test/")) {
    // نداءان يذهبان إلى العنوان نفسه: قراءة السيرة، وتحسينها (hire.js). يفرّق
    // بينهما ما في الحمولة — وخلطهما يجعل عدّاد «لا نداء احتياطي» كاذباً.
    const sent = JSON.stringify(body);
    if (sent.includes("cv_markdown")) {
      calls.cvRead += 1;
      if (azureReply === "fail") return json({ error: "azure boom" }, 500);
      return json(azureReply);
    }
    calls.boost += 1;
    return json({ choices: [{ message: { content: "{}" } }], finish_reason: "stop" });
  }

  if (u.startsWith("https://api.notion.com/v1/databases/")) {
    assert.ok(u.includes(ATS_DB), "استعلامٌ على قاعدة غير قاعدة المرشحين: " + u);
    return json({ results: existingRow ? [existingRow] : [], has_more: false });
  }
  if (u === "https://api.notion.com/v1/pages" && init.method === "POST") {
    calls.notionCreate += 1;
    created = body.properties;
    return json({ id: "11111111-2222-3333-4444-555555555555" });
  }
  if (u.startsWith("https://api.notion.com/v1/pages/") && init.method === "PATCH") {
    calls.notionPatch += 1;
    patched = body.properties;
    return json({ id: "patched" });
  }
  throw new Error("no network in tests: " + u);
};

const { default: handler } = await import("../api/candidate.js");

// ------------------------------------------------------------- الاستدعاء --
function invoke(payload) {
  let out = "", status = 0;
  const res = {
    setHeader() {},
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { out = b; },
  };
  return handler({ method: "POST", url: "/api/candidate", headers: {}, body: payload, on() {} }, res)
    .then(() => ({ status: status || 200, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}

const pdfBytes = (n = 400) => Buffer.from("%PDF-1.7\n" + "x".repeat(n)).toString("base64");
const apply = (cvFile) => invoke({
  name: "محمد العبدالله", phone: "0500000009", email: "m@example.com",
  field: "أخصائي موارد بشرية", jobId: "candidate-pool", jobTitle: "General candidate pool",
  consent: true, ...(cvFile === undefined ? {} : { cvFile }),
});
// صورة: مسارٌ بنداء أزور واحد (الـPDF يحتاج Document Intelligence، وهي مطفأة).
const imageCv = () => ({ name: "cv.png", type: "image/png", size: 500, base64: pdfBytes(500) });

const val = (props, key) => {
  const p = props && props[key];
  if (!p) return "";
  if (p.select) return p.select.name;
  if (p.rich_text) return p.rich_text.map((t) => t.text.content).join("");
  return "";
};

/* ─────────────────────────────────────── ① نجاح n8n = صفر نداء احتياطي ── */
test("n8n يُرجع نصّ السيرة ⇒ لا نداء احتياطي على أزور إطلاقاً", async () => {
  reset();
  n8nReply = { ai: { ats_cv_markdown: CV_TEXT } };
  const { status, data } = await apply(imageCv());

  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(calls.n8n, 1, "n8n يبقى الأول ولا يُتجاوز");
  assert.equal(calls.cvRead, 0, "نُودي الاحتياطي رغم نجاح n8n — نداءٌ ومالٌ بلا سبب");
  assert.ok(val(created, "ATS CV Text").includes("أخصائي موارد بشرية"), "نصّ n8n لم يُكتب");
  assert.equal(val(created, "حالة القراءة"), "مكتمل");
  assert.equal(val(created, "سبب عدم الاكتمال"), "", "سببُ عدم اكتمالٍ على سيرةٍ مكتملة");
});

/* ───────────────────────────────── ② تأخّر n8n ⇒ الاحتياطي يعمل ويُكتب ── */
// هذا هو الاختبار الذي يستحقّ الوجود: أزل نداء `extractCvText` من المعالج
// ويجب أن يحمرّ هذا وحده.
test("n8n يتأخّر (مهلة) ⇒ الاحتياطي يستخرج النصّ ويُكتب في ATS CV Text", async () => {
  reset();
  n8nReply = "abort";
  const { status, data } = await apply(imageCv());

  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(calls.cvRead, 1, "لم يُنادَ الاحتياطي وقد تأخّر n8n — هذا هو العطل الأصلي");
  const written = val(created, "ATS CV Text");
  assert.ok(written.includes("بكالوريوس إدارة أعمال"), "نصّ السيرة المستخرج محلياً لم يُكتب: " + written.slice(0, 80));
  assert.equal(val(created, "حالة القراءة"), "مكتمل");
  // الشفافية: الصفّ يقول من استخرج السيرة ولماذا، فالمالك يرى أن n8n يتعطّل.
  assert.match(val(created, "سبب عدم الاكتمال"), /محلياً/);
  assert.match(val(created, "سبب عدم الاكتمال"), /n8n/);
});

/* ───────────────────────── ③ فشل الاثنين ⇒ المرشّح يُنشأ موسوماً لا يضيع ── */
test("فشل n8n وأزور ⇒ المرشّح يُنشأ وموسومٌ بالسبب، ولا يضيع الطلب", async () => {
  reset();
  n8nReply = "abort";
  azureReply = "fail";
  const { status, data } = await apply(imageCv());

  assert.equal(status, 200, "سقط الطلب كله لأجل سيرة لم تُقرأ");
  assert.equal(data.ok, true);
  assert.ok(data.ref, "لا رقم مرجعي — المرشّح لم يُنشأ");
  assert.equal(calls.notionCreate, 1, "لم يُكتب المرشّح في القاعدة");
  assert.equal(calls.cvRead, 1);
  assert.equal(val(created, "ATS CV Text"), "", "كُتب نصّ سيرة وهي لم تُقرأ");
  assert.equal(val(created, "حالة القراءة"), "فشل التحليل",
    "«مكتمل» على صفٍّ بلا سيرة — وهذا ما جعل ١٠٢٥ صفاً يكذب");
  assert.match(val(created, "سبب عدم الاكتمال"), /لم تُستخرج/);
  assert.match(val(created, "سبب عدم الاكتمال"), /فشلت قراءة الملف/);
  // ولا يزال المرشّح مرشّحاً كاملاً بحقوله: الفقدُ سيرةٌ لا شخص.
  assert.equal(val(created, "Source"), "الموقع");
});

/* ─────────────────────── ④ نوعٌ غير مدعوم ⇒ لا نداء أزور، وعلامةٌ صحيحة ── */
test("ملف Word ⇒ لا نداء أزور، والعلامة «ناقص» لا «فشل تحليل»", async () => {
  reset();
  n8nReply = "abort";
  const { status } = await apply({
    name: "cv.docx", size: 9000,
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    base64: pdfBytes(300),
  });

  assert.equal(status, 200);
  assert.equal(calls.n8n, 1, "n8n لا يُعطَّل لنوعٍ لا نقرأه نحن — هو قد يقرأه");
  assert.equal(calls.cvRead, 0, "نُودي أزور على نوعٍ يرفضه DOC_MIME_OK — نداءٌ محكومٌ بالفشل");
  assert.equal(val(created, "حالة القراءة"), "ناقص - بيانات غير كافية",
    "«فشل التحليل» على ملفٍ لم تُحاول قراءته أصلاً يخبّئ السبب الحقيقي");
  assert.match(val(created, "سبب عدم الاكتمال"), /نوع الملف/);
});

/* ───────────────────────────── ⑤ الـPDF بلا Document Intelligence ── */
test("PDF وDocument Intelligence غير مهيّأ ⇒ لا نداء، والسبب يسمّي التهيئة", async () => {
  reset();
  n8nReply = "abort";
  await apply({ name: "cv.pdf", type: "application/pdf", size: 900, base64: pdfBytes(900) });

  assert.equal(calls.cvRead, 0, "نُودي أزور وقارئ الـPDF غير مهيّأ — عطلٌ معروفٌ سلفاً");
  assert.equal(val(created, "حالة القراءة"), "فشل التحليل");
  assert.match(val(created, "سبب عدم الاكتمال"), /غير مهيّأ/);
});

/* ─────────── ⑥ إعادة تقديمٍ بلا مرفق لا تُنزّل صفّاً سيرتُه مقروءة ── */
// وسمُ «لم تُستخرج» على مرشّحٍ سيرتُه عندنا هو نفس الكذب معكوساً: يُسقطه الفرز
// وهو مقروء.
test("إعادة تقديم بلا مرفق لا تمسّ حالة صفٍّ فيه نصّ سيرة سابق", async () => {
  reset();
  n8nReply = "abort";
  existingRow = {
    id: "99999999-8888-7777-6666-555555555555",
    properties: {
      "ATS CV Text": { type: "rich_text", rich_text: [{ plain_text: CV_TEXT, text: { content: CV_TEXT } }] },
      "حالة القراءة": { type: "select", select: { name: "مكتمل" } },
    },
  };
  const { status, data } = await apply(undefined);

  assert.equal(status, 200);
  assert.equal(data.updated, true);
  assert.equal(calls.cvRead, 0, "لا ملف مرفوع — لا نداء");
  assert.ok(!("حالة القراءة" in (patched || {})), "أُعيدت كتابة حالة القراءة على صفٍّ سيرتُه مقروءة");
  assert.ok(!("سبب عدم الاكتمال" in (patched || {})), "وُسم صفٌّ مقروءٌ بأن سيرته لم تُستخرج");
  assert.ok(!("ATS CV Text" in (patched || {})), "كادت تُمسح سيرةٌ قائمة");
});

/* ─────────────────────────── ⑦ مهلة n8n صارت قراراً للمُنادي ── */
// الميزانية كلها مبنية على هذا: نافذةُ n8n تُقصَّر حين يوجد احتياطي. ولو تُجاهل
// الوسيط لعاد المسار إلى ٥٠ ثانية وضاع الاحتياطي معها.
test("forwardToN8n يحترم المهلة الممرّرة له", async () => {
  reset();
  const { forwardToN8n } = await import("../api/candidate.js");
  const slow = globalThis.fetch;
  globalThis.fetch = (url, init = {}) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  const t0 = Date.now();
  const r = await forwardToN8n({ x: 1 }, 40);
  const ms = Date.now() - t0;
  globalThis.fetch = slow;

  assert.equal(r.ok, false);
  assert.equal(r.error, "forward_failed");
  assert.ok(ms < 3000, `لم تُحترم المهلة الممرّرة (${ms}ms) — النافذة المشتركة لا تعمل`);
});

/* ──────────────────────────── ⑧ مسار الاستدراك للمالك وحده ── */
test("استدراك السير للموجود: ممنوع بلا مفتاح المالك", async () => {
  reset();
  const { status, data } = await invoke({ type: "extract-cvs", limit: 1 });
  assert.equal(status, 403);
  assert.equal(data.error, "forbidden");
  assert.equal(calls.notionPatch, 0, "لمس صفوف مرشّحين بلا صلاحية");
});

test.after(() => { try { fs.rmSync(DBDIR, { recursive: true, force: true }); } catch {} });
