// التوطين والامتثال للمتقدّم عبر الموقع  (api/candidate.js)
//
// شغّله: npm test
//
// لماذا يستحقّ هذا اختباراً:
//
// المالك طلب أن يرى صاحب العمل لكل مرشّح «هل هو متوافق مع نظام التوظيف السعودي
// ونسب التوطين». الشاشة مبنيّة في بوابة صاحب العمل وتلوّن رقاقتين بقيمٍ مخزّنة
// حرفاً بحرف. لكن قياس القاعدة (2026-09-29): ٢٤٥٨٦ صفّاً من ٢٦٤١٩ لها توطين،
// و**صفرٌ** من الـ١١٧ صفّاً التي تظهر فعلاً في اللوحة — لأن من يحسبها هو وكيل
// Outlook في n8n لصفوف `Source = ترشيح`، والمتقدّم عبر الموقع لا يمرّ به.
//
// وأوجه هذا الاختبار كلها أعطالٌ ممكنة، اثنان منها واقعان في القاعدة اليوم:
//   ① سعودي على مهنة مقصورة ⇒ ✅ مطابق. وغير سعودي عليها ⇒ ⛔. وهذه هي القاعدة
//      الوحيدة التي ينصّ عليها نصّ وكيل Outlook، فلا يجوز أن تُخالف.
//   ② مهنة لا يعرفها المحرّك ⇒ «بحاجة فحص» لا حكماً. اختلاق حالة توطين معلومةٌ
//      حكومية، و«بحاجة فحص» قيمةٌ في القاعدة لهذا الغرض بالضبط.
//   ③ **التناقض**: ٢٢٠ صفّاً اليوم توطينها «مسموح لغير السعوديين» وامتثالها
//      «⛔ مهنة سعودية - غير سعودي». سببه أن الوكيل يسأل النموذج عن المفتاحين
//      **مستقلّين** ولا يتحقّق من اتّساقهما. هنا الامتثال مشتقٌّ في الكود، فهذا
//      الاختبار يمرّ على كل التوليفات ويُثبت أن التناقض مستحيل.
//   ④ قيمةٌ خامسة ⇒ رقاقةٌ رمادية بلا معنى في الواجهة. القائمة تقصّ كل شيء.
//   ⑤ رقمٌ أو نسبةٌ أو قرار وزاري في التفاصيل ⇒ يُنزع. المنع بالطلب وحده ليس
//      منعاً: ما يقوله النموذج يُفحص لا يُصدَّق.
//   ⑥ فشل الحساب لا يُسقط إنشاء المرشّح. فقدانُ تقديمٍ حقيقي لأجل حقل حالة أسوأ
//      من فقدان الحقل.
//   ⑦ صفٌّ قائم عليه توطينٌ محسوم لا يُنسخ عليه حسابُنا، وامتثاله يُشتقّ من
//      قيمته هو — وإلا وُلد تناقضٌ جديد من طرفين صحيحين كلٌّ على حدة.
//
// بلا شبكة: أي نداء إلى غير نوشن/n8n/أزور يرمي. ولا مفتاح حقيقي في العملية.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-saud-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.N8N_ATS_WEBHOOK = "https://n8n.test/webhook/bp-ats-application";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
delete process.env.AZURE_DOCINTEL_ENDPOINT;
delete process.env.AZURE_DOCINTEL_KEY;
delete process.env.AZURE_OPENAI_ENDPOINT_2;
delete process.env.RESEND_API_KEY;
delete process.env.PANEL_KEY;
delete process.env.LEADS_KEY;

const ATS_DB = "71792742873e4de398135c7855542b95";
const SAUD_PROP = "التوطين Saudization";
const COMP_PROP = "الامتثال Compliance";
const DET_PROP = "تفاصيل التوطين";

// ----------------------------------------------------- ما يقرره كل اختبار --
let saudReply = null;   // ما يردّ به أزور على سؤال التوطين، أو "fail"
let n8nReply = null;
let calls = { saud: 0, notionCreate: 0, notionPatch: 0 };
let created = null, patched = null, existingRow = null;

const reset = () => {
  calls = { saud: 0, notionCreate: 0, notionPatch: 0 };
  created = patched = existingRow = null;
  n8nReply = null;
  saudReply = { saudization: "بحاجة فحص", saudization_details: "غير معروفة." };
};

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const chat = (content) => ({ choices: [{ message: { content }, finish_reason: "stop" }] });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};

  if (u.startsWith("https://n8n.test/")) {
    if (n8nReply === "abort") throw new DOMException("aborted", "AbortError");
    return json(n8nReply || {});
  }

  if (u.startsWith("https://azure.test/")) {
    const sent = JSON.stringify(body);
    // سؤال التوطين يُعرَف بنصّه: لا يُخلط بقراءة السيرة ولا بتحسينها، وإلا صار
    // عدّاد «نداء واحد لكل مسمّى» كاذباً.
    if (sent.includes("مختص امتثال توطين")) {
      calls.saud += 1;
      assert.ok(!sent.includes("محمد العبدالله"), "اسمُ المرشّح ذهب في سؤالٍ عن المهنة وحدها");
      if (saudReply === "fail") return json({ error: "azure boom" }, 500);
      if (saudReply === "garbage") return json(chat("لا أعرف، اسأل الوزارة."));
      return json(chat(JSON.stringify(saudReply)));
    }
    return json(chat("{}"));
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

const mod = await import("../api/candidate.js");
const handler = mod.default;
const { SAUD_VALUES, COMP_VALUES, complianceFor, nationalityKind } = mod;

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

let seq = 0;
// كل تقديم بهاتفٍ وبريدٍ جديدين حتى لا تتشارك اختباران صفّاً، وبمسمّى مهنة
// مميّز حتى لا تُجيب ذاكرةُ المسميات بدل أزور.
const apply = (extra = {}) => invoke({
  name: "محمد العبدالله", phone: "05000000" + String(++seq).padStart(2, "0"),
  email: `c${seq}@example.com`, jobId: "candidate-pool", jobTitle: "General candidate pool",
  consent: true, field: "مهنة الاختبار " + seq, ...extra,
});

const val = (props, key) => {
  const p = props && props[key];
  if (!p) return "";
  if (p.select) return p.select.name;
  if (p.rich_text) return p.rich_text.map((t) => t.text.content).join("");
  return "";
};

/* ───────── ① القاعدة الوحيدة المنصوصة في وكيل Outlook: مقصورة × الجنسية ── */
test("مهنة مقصورة على السعوديين: سعودي ⇒ ✅ مطابق · غير سعودي ⇒ ⛔", async () => {
  reset();
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "المهنة محفوظة للسعوديين." };

  await apply({ residenceStatus: "مواطن سعودي", nationality: "السعودية" });
  assert.equal(val(created, SAUD_PROP), "مقصورة على السعوديين");
  assert.equal(val(created, COMP_PROP), "✅ مطابق",
    "سعوديٌّ على مهنةٍ مقصورةٍ على السعوديين وُسم غير مطابق");
  assert.equal(val(created, "Nationality Type"), "سعودي");

  reset();
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "المهنة محفوظة للسعوديين." };
  await apply({ nationality: "مصري", residenceStatus: "مقيم بإقامة نظامية قابلة للنقل" });
  assert.equal(val(created, SAUD_PROP), "مقصورة على السعوديين");
  assert.equal(val(created, COMP_PROP), "⛔ مهنة سعودية - غير سعودي",
    "غير سعوديٍّ على مهنةٍ مقصورة مرّ كأنه مطابق — وهذا ما تُبنى عليه مخالفة");
  assert.equal(val(created, "Nationality Type"), "غير سعودي");
});

/* ───────── ② المجهول يُقال مجهولاً — لا حكم، ولا معلومةٌ حكومية مُختلقة ── */
test("مهنة لا يعرفها المحرّك ⇒ «بحاجة فحص» و🔍، لا حكماً", async () => {
  reset();
  saudReply = { saudization: "بحاجة فحص", saudization_details: "المسمّى غير واضح." };
  await apply({ nationality: "هندي" });

  assert.equal(val(created, SAUD_PROP), "بحاجة فحص");
  assert.equal(val(created, COMP_PROP), "🔍 بحاجة فحص",
    "حُكم على مهنةٍ مجهولة — اختلاقُ حالة توطين معلومةٌ حكومية ممنوعة");
  assert.match(val(created, DET_PROP), /لم تُحدَّد/);
});

test("لا جنسية في الطلب ⇒ 🔍 لا ⛔، ولا يُفترض أنه غير سعودي", async () => {
  reset();
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "محفوظة للسعوديين." };
  await apply({});

  assert.equal(val(created, SAUD_PROP), "مقصورة على السعوديين");
  assert.equal(val(created, COMP_PROP), "🔍 بحاجة فحص",
    "وُسم ⛔ مرشّحٌ لم يقل جنسيته — افتراضٌ يُسقط طلب عملٍ بلا سبب");
  assert.equal(val(created, "Nationality Type"), "", "كُتبت جنسيةٌ لم يقلها أحد");
});

/* ───────── ③ التناقض القائم في ٢٢٠ صفّاً: مستحيلٌ بنيةً لا انتباهاً ── */
test("لا توليفة (توطين × جنسية) تُنتج التناقض القائم في القاعدة", () => {
  const nats = ["سعودي", "غير سعودي", ""];
  for (const s of SAUD_VALUES) {
    for (const n of nats) {
      const c = complianceFor(s, n);
      assert.ok(COMP_VALUES.includes(c), `امتثالٌ خارج القائمة: ${c}`);
      // هذا هو العطل الحرفي: «مسموح لغير السعوديين» + «⛔ مهنة سعودية - غير سعودي».
      assert.ok(!(s === "مسموح لغير السعوديين" && c === "⛔ مهنة سعودية - غير سعودي"),
        `التناقض تكرّر: ${s} / ${n} ⇒ ${c}`);
      assert.ok(!(c === "⛔ مهنة سعودية - غير سعودي" && n !== "غير سعودي"),
        `⛔ «غير سعودي» على جنسية ${JSON.stringify(n)}`);
      assert.ok(!(c === "⛔ مهنة سعودية - غير سعودي" && s !== "مقصورة على السعوديين"),
        `⛔ على توطين ${s}`);
    }
  }
  // ومرآةُ ذلك على المسار الحقيقي: الامتثال لا يأتي من النموذج أصلاً، فلا يمكن
  // أن يخالف التوطين المكتوب معه في الصفّ نفسه.
  assert.equal(complianceFor("مسموح لغير السعوديين", "غير سعودي"), "✅ مطابق");
});

test("الامتثال لا يُسأل عنه النموذج: قيمةُ compliance في ردّه تُتجاهل", async () => {
  reset();
  saudReply = {
    saudization: "مسموح لغير السعوديين",
    compliance: "⛔ مهنة سعودية - غير سعودي", // ما فعله الوكيل فولّد ٢٢٠ صفّاً متناقضاً
    saudization_details: "المهنة مفتوحة.",
  };
  await apply({ nationality: "فلبيني" });

  assert.equal(val(created, SAUD_PROP), "مسموح لغير السعوديين");
  assert.equal(val(created, COMP_PROP), "✅ مطابق",
    "نُسخ امتثالُ النموذج كما هو فوُلد التناقض نفسه من جديد");
});

/* ───────── ④ القيمة الخامسة = شاشةٌ رمادية بلا معنى ── */
test("قيمة خارج القائمة أو ردٌّ غير مقروء ⇒ تقع على «بحاجة فحص»", async () => {
  reset();
  saudReply = { saudization: "مسموح جزئياً بشروط خاصة", saudization_details: "كذا." };
  await apply({ nationality: "سوداني" });
  assert.equal(val(created, SAUD_PROP), "بحاجة فحص", "كُتبت قيمةٌ خامسة لا تعرفها الواجهة");
  assert.equal(val(created, COMP_PROP), "🔍 بحاجة فحص");
  assert.ok(SAUD_VALUES.includes(val(created, SAUD_PROP)));

  reset();
  saudReply = "garbage";
  await apply({ nationality: "سوداني" });
  assert.equal(val(created, SAUD_PROP), "بحاجة فحص");
  assert.match(val(created, DET_PROP), /غير مقروء/);
});

/* ───────── ⑤ لا رقم ولا نسبة ولا قرار وزاري في النصّ المخزّن ── */
test("رقمٌ أو نسبةٌ أو قرار وزاري في جملة النموذج ⇒ تُنزع الجملة", async () => {
  reset();
  saudReply = {
    saudization: "نسبة توطين + اشتراطات",
    saudization_details: "نسبة التوطين المطلوبة ٣٠٪ حسب القرار الوزاري ٤٩٠٤.",
  };
  // مسمّى بلا أرقام: المسمّى نفسه يُقتبس في السطر، ورقمٌ فيه يُربك القياس.
  await apply({ nationality: "أردني", field: "محاسب قانوني للفحص" });

  const det = val(created, DET_PROP);
  assert.equal(val(created, SAUD_PROP), "نسبة توطين + اشتراطات");
  assert.equal(val(created, COMP_PROP), "⚠️ اشتراطات");
  assert.ok(!/٣٠|30|٪|%/.test(det), "نسبةٌ مئوية دخلت القاعدة: " + det);
  assert.ok(!/قرار/.test(det), "اسمُ قرارٍ وزاري دخل القاعدة: " + det);
  assert.ok(!/[0-9٠-٩]/.test(det.replace(/\(\d{4}-\d\d-\d\d\)/, "")),
    "رقمٌ غير التاريخ دخل القاعدة: " + det);
  // ويقول من حسبه: جملةٌ بلا مصدر تُقرأ كأنها فحصٌ رسمي.
  assert.match(det, /حُسب آلياً/);
  assert.match(det, /لا يقوم مقام فحص رسمي/);
});

/* ───────── ⑥ الفشل لا يُسقط المرشّح ── */
test("فشل أزور ⇒ المرشّح يُنشأ كاملاً و«بحاجة فحص»، ولا يضيع التقديم", async () => {
  reset();
  saudReply = "fail";
  const { status, data } = await apply({ nationality: "مصري" });

  assert.equal(status, 200, "سقط تقديمٌ حقيقي لأجل حقل حالة");
  assert.equal(data.ok, true);
  assert.ok(data.ref);
  assert.equal(calls.notionCreate, 1);
  assert.equal(val(created, "Source"), "الموقع");
  assert.equal(val(created, SAUD_PROP), "بحاجة فحص");
  assert.equal(val(created, COMP_PROP), "🔍 بحاجة فحص");
  assert.match(val(created, DET_PROP), /تعذّر التحليل/);
});

test("محرّك التحليل غير مهيّأ ⇒ لا نداء، و«بحاجة فحص» بسببها", async () => {
  reset();
  const ep = process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_ENDPOINT;
  try {
    await apply({ nationality: "مصري" });
  } finally { process.env.AZURE_OPENAI_ENDPOINT = ep; }

  assert.equal(calls.saud, 0, "نُودي محرّكٌ غير مهيّأ");
  assert.equal(val(created, SAUD_PROP), "بحاجة فحص");
  assert.match(val(created, DET_PROP), /غير مهيّأ/);
});

/* ───────── ⑦ لا نداء بلا مهنة، ونداءٌ واحد لكل مسمّى ── */
test("تسجيلٌ في السلّة بلا مسمّى مهنة ⇒ صفر نداء، و«بحاجة فحص»", async () => {
  reset();
  const { status } = await invoke({
    name: "محمد العبدالله", phone: "0591111111", email: "pool@example.com",
    jobId: "candidate-pool", jobTitle: "General candidate pool", consent: true,
  });

  assert.equal(status, 200);
  assert.equal(calls.saud, 0, "نداءٌ مدفوع على سؤالٍ بلا مهنة");
  assert.equal(val(created, SAUD_PROP), "بحاجة فحص");
  assert.match(val(created, DET_PROP), /لا مسمّى مهنة/);
});

test("مسمّى مكرّر ⇒ نداءٌ واحد لا اثنان (ذاكرة المسميات)", async () => {
  reset();
  saudReply = { saudization: "مسموح لغير السعوديين", saudization_details: "مفتوحة." };
  const role = "مطوّر برمجيات مكرّر " + Date.now();
  await apply({ field: role, nationality: "هندي" });
  assert.equal(calls.saud, 1);
  await apply({ field: role.toUpperCase(), nationality: "هندي" });
  assert.equal(calls.saud, 1, "أُعيد النداء على مسمّى مُجاب — نداءٌ ومالٌ بلا سبب");
  assert.equal(val(created, SAUD_PROP), "مسموح لغير السعوديين");
});

/* ───────── ⑧ إعادة تقديم: المحسوم لا يُنسخ عليه، ولا يُولَد تناقضٌ جديد ── */
test("إعادة تقديم على صفٍّ توطينه محسوم: لا يُنسخ، والامتثال يُشتقّ من قيمته هو", async () => {
  reset();
  // الصفّ محسومٌ من وكيل Outlook على السيرة كاملةً، وامتثاله لم يُكتب بعد.
  // حسابُنا على المسمّى وحده يقول عكسه — فلا يجوز أن يُشتقّ الامتثال منه.
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "محفوظة." };
  existingRow = {
    id: "99999999-8888-7777-6666-555555555555",
    properties: {
      [SAUD_PROP]: { type: "select", select: { name: "مسموح لغير السعوديين" } },
      [COMP_PROP]: { type: "select", select: { name: "🔍 بحاجة فحص" } },
    },
  };
  const { data } = await apply({ nationality: "مصري" });

  assert.equal(data.updated, true);
  assert.ok(!(SAUD_PROP in (patched || {})), "نُسخ حسابُنا فوق توطينٍ محسوم من السيرة كاملة");
  assert.ok(!(DET_PROP in (patched || {})), "استُبدلت تفاصيلُ توطينٍ محسوم");
  assert.equal(val(patched, COMP_PROP), "✅ مطابق",
    "اشتُقّ الامتثال من حسابنا لا من التوطين المخزّن — وهذا مولّد التناقض بالضبط");
});

test("إعادة تقديم على صفٍّ «بحاجة فحص» ⇒ يُملأ فعلاً", async () => {
  reset();
  saudReply = { saudization: "مسموح لغير السعوديين", saudization_details: "مفتوحة." };
  existingRow = {
    id: "99999999-8888-7777-6666-444444444444",
    properties: { [SAUD_PROP]: { type: "select", select: { name: "بحاجة فحص" } } },
  };
  await apply({ nationality: "باكستاني" });

  assert.equal(val(patched, SAUD_PROP), "مسموح لغير السعوديين", "بقي «بحاجة فحص» وعندنا جواب");
  assert.equal(val(patched, COMP_PROP), "✅ مطابق");
});

test("امتثالٌ محسوم على صفٍّ قائم لا يُلمس", async () => {
  reset();
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "محفوظة." };
  existingRow = {
    id: "99999999-8888-7777-6666-333333333333",
    properties: {
      [SAUD_PROP]: { type: "select", select: { name: "مقصورة على السعوديين" } },
      [COMP_PROP]: { type: "select", select: { name: "⚠️ اشتراطات" } },
    },
  };
  await apply({ nationality: "مصري" });

  assert.ok(!(COMP_PROP in (patched || {})), "أُعيدت كتابة امتثالٍ حسمه إنسان أو وكيل");
});

/* ───────── ⑨ خطّاف n8n إن ردّ بقيمةٍ من القائمة فهو أولى ── */
test("n8n يُرجع توطيناً من القائمة ⇒ يُقدَّم على حسابنا، وخارجها يُرفض", async () => {
  reset();
  saudReply = { saudization: "بحاجة فحص", saudization_details: "غير معروفة." };
  n8nReply = { ai: { saudization: "نسبة توطين + اشتراطات", saudization_details: "اشتراطات مهنية." } };
  await apply({ nationality: "يمني" });
  assert.equal(val(created, SAUD_PROP), "نسبة توطين + اشتراطات");
  assert.equal(val(created, COMP_PROP), "⚠️ اشتراطات");

  reset();
  saudReply = { saudization: "مسموح لغير السعوديين", saudization_details: "مفتوحة." };
  n8nReply = { ai: { saudization: "مسموح بشروط غريبة" } };
  await apply({ nationality: "يمني" });
  assert.equal(val(created, SAUD_PROP), "مسموح لغير السعوديين",
    "قيمةٌ خارج القائمة من مصدرٍ خارجي دخلت القاعدة");
});

/* ───────── ⑩ الجنسية: تعريفٌ واحد لا اثنان ── */
test("nationalityKind: الخيار المُنتقى يقطع، و«خارج السعودية» لا تدلّ", () => {
  assert.equal(nationalityKind("", "مواطن سعودي"), "سعودي");
  assert.equal(nationalityKind("Saudi", ""), "سعودي");
  assert.equal(nationalityKind("السعودية", ""), "سعودي");
  assert.equal(nationalityKind("مصري", ""), "غير سعودي");
  assert.equal(nationalityKind("", "مقيم بإقامة غير قابلة للنقل"), "غير سعودي");
  // مزدوجُ الجنسية سعوديٌّ فعلاً: مطابقةٌ حرفية كانت تكتب ⛔ على مواطن.
  assert.equal(nationalityKind("سعودي/أمريكي", ""), "سعودي");
  assert.equal(nationalityKind("أمريكي/سعودي", ""), "سعودي");
  assert.equal(nationalityKind("Saudi Arabia", ""), "سعودي");
  // ولا يُقلب النفيُ إثباتاً بمجرّد ورود الكلمة.
  assert.equal(nationalityKind("غير سعودي", ""), "غير سعودي");
  assert.equal(nationalityKind("non-saudi", ""), "غير سعودي");
  // سعوديٌّ مغترب يختار «خارج السعودية» — فهي لا تُقرأ «غير سعودي».
  assert.equal(nationalityKind("", "خارج السعودية"), "");
  assert.equal(nationalityKind("", ""), "");
});

test.after(() => { try { fs.rmSync(DBDIR, { recursive: true, force: true }); } catch {} });
