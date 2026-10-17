// إصلاح الامتثال المتناقض واستدراك التوطين  (api/candidate.js)
//
// شغّله: npm test
//
// لماذا يستحقّ هذا اختباراً:
//
// قياسٌ على القاعدة الحقيقية 2026-09-29 (تجميعٌ بلا أي حقل شخصي) أعطى صفوفاً
// ثلاثةَ أصناف، والاختبار مبنيٌّ على أرقامها هي:
//   • ٢٢٠ صفّاً: «مسموح لغير السعوديين» + «⛔ مهنة سعودية - غير سعودي» — نقيضٌ
//     حرفي. و٣ صفوف ⛔ على **سعودي**. وصفٌّ واحد «✅ مطابق» على (مقصورة × غير
//     سعودي). المجموع ٢٢٤ صفّاً هي كل ما يجوز لمسه.
//   • ٢٠٠ صفّ «مقصورة على السعوديين» + ⛔ + غير سعودي — **سليمة**، لا تُمسّ.
//   • ٥٠٠ صفّ «نسبة توطين + اشتراطات» + «✅ مطابق» على سعودي — تخالف حسابنا
//     (الذي يقول ⚠️) ولا تناقض نفسها. **لا تُمسّ.** هذا هو حدّ المالك الصريح:
//     إعادةُ كتابة أربعة وعشرين ألف صفّ على منطقٍ جديد تمحو حكماً محسوباً على
//     سيرةٍ كاملة بحكمٍ محسوب على مسمّى وحده.
//
// وأوجه الاختبار:
//   ① المتناقض يُصلَح، بحسابٍ صِرف بلا نداء نموذج واحد.
//   ② المتّسق لا يُمسّ — الصنفان أعلاه، و⚠️ و🔍 مهما كانت التوليفة.
//   ③ صفٌّ بلا جنسية ⇒ 🔍 «بحاجة فحص»، ولا يُفترض «غير سعودي» أبداً.
//   ④ الإصلاح يكتب **الامتثال وحده**: توطينُ الصفّ وتفاصيلُه ليست من شأنه.
//   ⑤ لا حقل شخصي في الرد: اللوحة تحتاج ماذا تغيّر لا مَن.
//   ⑥ الاستدراك يكلّف عدد المسميات المتميّزة لا عدد الصفوف (٣٨ لـ١١٧)، ولا
//      يدهس قيمةً موجودة، ولا يكتب شيئاً إن كان المحرّك غير مهيّأ.
//   ⑦ ولا يفتح المسارَان بابَ مالكٍ بلا مفتاح.
//
// بلا شبكة: أي نداء إلى غير نوشن/أزور يرمي. ولا مفتاح حقيقي في العملية.

import test from "node:test";
import assert from "node:assert/strict";

process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.PANEL_KEY = "test-owner-key";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
delete process.env.AZURE_OPENAI_ENDPOINT_2;
delete process.env.N8N_ATS_WEBHOOK;
delete process.env.RESEND_API_KEY;
delete process.env.CRON_SECRET;

const ATS_DB = "71792742873e4de398135c7855542b95";
const SAUD_PROP = "التوطين Saudization";
const COMP_PROP = "الامتثال Compliance";
const DET_PROP = "تفاصيل التوطين";
const NAT_PROP = "Nationality Type";
const BLOCKED = "⛔ مهنة سعودية - غير سعودي";
const NEEDS = "🔍 بحاجة فحص";

// ----------------------------------------------------- ما يقرره كل اختبار --
let queryRows = [], hasMore = false, saudReply = null;
let calls = { patch: 0, saud: 0 };
let patches = [], lastFilter = null, lastQuery = null;

const reset = () => {
  queryRows = []; hasMore = false; patches = []; lastFilter = null; lastQuery = null;
  calls = { patch: 0, saud: 0 };
  saudReply = { saudization: "مسموح لغير السعوديين", saudization_details: "المهنة مفتوحة." };
};

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const chat = (content) => ({ choices: [{ message: { content }, finish_reason: "stop" }] });
const sel = (name) => ({ type: "select", select: { name } });
const rtp = (v) => ({ type: "rich_text", rich_text: [{ plain_text: v, text: { content: v } }] });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : {};

  if (u.startsWith("https://azure.test/")) {
    if (JSON.stringify(body).includes("مختص امتثال توطين")) {
      calls.saud += 1;
      if (saudReply === "fail") return json({ error: "boom" }, 500);
      return json(chat(JSON.stringify(saudReply)));
    }
    return json(chat("{}"));
  }
  if (u === `https://api.notion.com/v1/databases/${ATS_DB}/query`) {
    lastFilter = body.filter; lastQuery = body;
    return json({ results: queryRows, has_more: hasMore, next_cursor: hasMore ? "CURSOR-2" : null });
  }
  if (u.startsWith("https://api.notion.com/v1/pages/") && init.method === "PATCH") {
    calls.patch += 1;
    patches.push({ id: u.split("/pages/")[1], props: body.properties });
    return json({ id: "patched" });
  }
  throw new Error("no network in tests: " + u);
};

const mod = await import("../api/candidate.js");
const handler = mod.default;
const { complianceConflict, complianceRepair, rowNationalityKind, SAUD_VALUES, COMP_VALUES } = mod;

function get(qs) {
  let out = "", status = 0;
  const res = {
    setHeader() {},
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { out = b; },
  };
  return handler({ method: "GET", url: "/api/candidate?" + qs, headers: {} }, res)
    .then(() => ({ status: status || 200, raw: out, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}

// صفٌّ بالشكل الذي يردّه نوشن فعلاً، ومعه حقول شخصية كي يُثبت الاختبار أنها
// لا تخرج في الرد.
let seq = 0;
const row = (props) => ({
  id: `00000000-0000-0000-0000-0000000000${String(++seq).padStart(2, "0")}`,
  properties: {
    "Candidate Name": { type: "title", title: [{ plain_text: "محمد العبدالله" }] },
    "Email": { type: "email", email: "secret@example.com" },
    "Phone": { type: "phone_number", phone_number: "0591234567" },
    ...props,
  },
});

/* ═════════════════ ① الحساب الصِرف: ما يُصلَح وما لا يُمسّ ═════════════════ */

test("الصفوف الـ٢٢٤ المتناقضة في القاعدة تُصلَح، بحسابٍ صِرف", () => {
  // ٢٢٠ صفّاً: المهنة مفتوحة والرقاقة تقول مقصورة.
  assert.equal(complianceRepair("مسموح لغير السعوديين", "غير سعودي", BLOCKED), "✅ مطابق");
  // ٣ صفوف: ⛔ تقول «غير سعودي» والصفّ يقول سعودي.
  assert.equal(complianceRepair("مقصورة على السعوديين", "سعودي", BLOCKED), "✅ مطابق");
  // صفٌّ واحد: التناقض معكوساً — ✅ على مهنةٍ مقصورة لغير سعودي.
  assert.equal(complianceRepair("مقصورة على السعوديين", "غير سعودي", "✅ مطابق"), BLOCKED);
});

test("المتّسق لا يُمسّ — ولو خالف حسابنا (٥٠٠ صفّ + ٢٠٠ صفّ)", () => {
  // ٢٠٠ صفّ: ⛔ على (مقصورة × غير سعودي) — هذا معناها بالضبط.
  assert.equal(complianceRepair("مقصورة على السعوديين", "غير سعودي", BLOCKED), "");
  // ٥٠٠ صفّ: حسابُنا يقول «⚠️ اشتراطات»، والمخزّن «✅ مطابق». لا تناقض، فلا لمس.
  assert.equal(complianceRepair("نسبة توطين + اشتراطات", "سعودي", "✅ مطابق"), "",
    "أُعيدت كتابة ٥٠٠ صفّ على منطقٍ جديد — وهو ما نهى عنه المالك حرفاً");
  assert.equal(complianceRepair("نسبة توطين + اشتراطات", "غير سعودي", "✅ مطابق"), "");
  assert.equal(complianceRepair("بحاجة فحص", "سعودي", "✅ مطابق"), "");
  assert.equal(complianceRepair("مسموح لغير السعوديين", "غير سعودي", "✅ مطابق"), "");
});

test("⚠️ و🔍 لا تُمسّان في أي توليفة — لا تدّعيان شيئاً يُنفى", () => {
  for (const s of [...SAUD_VALUES, "", "قيمة خامسة"]) {
    for (const n of ["سعودي", "غير سعودي", ""]) {
      assert.equal(complianceRepair(s, n, "⚠️ اشتراطات"), "", `مُسّت ⚠️ على ${s}/${n}`);
      assert.equal(complianceRepair(s, n, NEEDS), "", `مُسّت 🔍 على ${s}/${n}`);
      // وامتثالٌ بلا قيمة ليس تناقضاً يُصلَح هنا — هذا شأن مسار الاستدراك.
      assert.equal(complianceRepair(s, n, ""), "", `لُمس امتثالٌ فارغ على ${s}/${n}`);
    }
  }
});

test("توطينٌ فارغ مع ⛔ ادّعاءٌ بلا سند لا تناقض — يُترك (وهو صفرٌ في القياس)", () => {
  assert.equal(complianceRepair("", "غير سعودي", BLOCKED), "");
  assert.equal(complianceRepair("قيمة خامسة", "غير سعودي", BLOCKED), "");
});

/* ═════════════════ ② بلا جنسية: 🔍 لا حكم، ولا افتراض ═════════════════ */

test("صفٌّ بلا جنسية ⇒ 🔍 «بحاجة فحص»، ولا يُفترض «غير سعودي» أبداً", () => {
  // ⛔ تدّعي «غير سعودي» ولا شيء في الصفّ يقولها ⇒ تناقض، وإصلاحه 🔍 لا حكم.
  assert.equal(complianceRepair("مقصورة على السعوديين", "", BLOCKED), NEEDS);
  assert.equal(complianceRepair("مسموح لغير السعوديين", "", BLOCKED), NEEDS,
    "حُسم امتثالُ صفٍّ لا نعرف جنسية صاحبه");
  assert.equal(complianceRepair("بحاجة فحص", "", BLOCKED), NEEDS);
  // ولا يُكتب ⛔ على صفٍّ بلا جنسية في أي حال.
  for (const s of SAUD_VALUES) {
    for (const cur of COMP_VALUES) {
      const out = complianceRepair(s, "", cur);
      assert.ok(out !== BLOCKED, `كُتبت ⛔ على صفٍّ بلا جنسية: ${s}/${cur}`);
      assert.ok(out === "" || COMP_VALUES.includes(out), `قيمةٌ خارج القائمة: ${out}`);
    }
  }
});

test("لا توليفة تنتج حالةً متناقضة بعد الإصلاح، ولا قيمةً خارج القائمة", () => {
  for (const s of [...SAUD_VALUES, ""]) {
    for (const n of ["سعودي", "غير سعودي", ""]) {
      for (const cur of COMP_VALUES) {
        const to = complianceRepair(s, n, cur);
        const after = to || cur;
        assert.ok(COMP_VALUES.includes(after), `امتثالٌ خارج القائمة: ${after}`);
        assert.equal(complianceConflict(s, n, after), false,
          `بقيت الحالة متناقضة بعد الإصلاح: ${s}/${n}/${cur} ⇒ ${after}`);
      }
    }
  }
});

test("rowNationalityKind: الخيار المخزّن يقطع، ثم ما سجّله الصفّ، ولا افتراض", () => {
  assert.equal(rowNationalityKind({ [NAT_PROP]: sel("سعودي") }), "سعودي");
  assert.equal(rowNationalityKind({ [NAT_PROP]: sel("غير سعودي") }), "غير سعودي");
  // الخيار فارغ والصفّ سجّل جنسيته نصاً: تُقرأ، لا تُفترض.
  assert.equal(rowNationalityKind({ "Nationality": rtp("مصري") }), "غير سعودي");
  assert.equal(rowNationalityKind({ "Nationality": rtp("سعودي/أمريكي") }), "سعودي");
  assert.equal(rowNationalityKind({ "حالة الإقامة": sel("مواطن سعودي") }), "سعودي");
  // ولا شيء يقوله الصفّ ⇒ لا شيء نقوله عنه.
  assert.equal(rowNationalityKind({}), "");
  assert.equal(rowNationalityKind({ "حالة الإقامة": sel("خارج السعودية") }), "");
  assert.equal(rowNationalityKind(null), "");
});

/* ═════════════════ ③ المسار: يكتب الامتثال وحده، ويعدّ السليم ═════════════════ */

test("fix-compliance: يُصلح المتناقض، ويعدّ السليم دون أن يلمسه", async () => {
  reset();
  queryRows = [
    row({ [SAUD_PROP]: sel("مسموح لغير السعوديين"), [COMP_PROP]: sel(BLOCKED), [NAT_PROP]: sel("غير سعودي") }),
    row({ [SAUD_PROP]: sel("مقصورة على السعوديين"), [COMP_PROP]: sel(BLOCKED), [NAT_PROP]: sel("غير سعودي") }),
    row({ [SAUD_PROP]: sel("مقصورة على السعوديين"), [COMP_PROP]: sel(BLOCKED), [NAT_PROP]: sel("سعودي") }),
  ];
  const { status, data } = await get("action=fix-compliance&key=test-owner-key");

  assert.equal(status, 200);
  assert.equal(data.fixed, 2);
  assert.equal(data.intact, 1, "لُمس صفٌّ ⛔ صحيح — وهي ٢٠٠ صفّ في القاعدة");
  assert.equal(calls.patch, 2, "عدد الكتابات لا يساوي عدد المتناقضات");
  // والكتابة الامتثالُ وحده: لا توطين ولا تفاصيل ولا حالة قراءة.
  for (const p of patches) {
    assert.deepEqual(Object.keys(p.props), [COMP_PROP], "كُتب أكثر من الامتثال: " + Object.keys(p.props));
    assert.equal(p.props[COMP_PROP].select.name, "✅ مطابق");
  }
  assert.equal(calls.saud, 0, "نُودي نموذجٌ في إصلاحٍ حسابيٍّ بحت — كلفةٌ بلا سبب");
});

test("fix-compliance: dryRun لا يكتب شيئاً ويُظهر ما سيتغيّر", async () => {
  reset();
  hasMore = true;
  queryRows = [
    row({ [SAUD_PROP]: sel("مسموح لغير السعوديين"), [COMP_PROP]: sel(BLOCKED), [NAT_PROP]: sel("غير سعودي") }),
    row({ [SAUD_PROP]: sel("مقصورة على السعوديين"), [COMP_PROP]: sel(BLOCKED), [NAT_PROP]: sel("غير سعودي") }),
  ];
  const { data, raw } = await get("action=fix-compliance&key=test-owner-key&dryRun=true");

  assert.equal(calls.patch, 0, "كتبت جولةٌ تجريبية على القاعدة");
  assert.equal(data.dryRun, true);
  assert.equal(data.fixed, 1);
  assert.equal(data.intact, 1);
  assert.equal(data.changes[0].from, BLOCKED);
  assert.equal(data.changes[0].to, "✅ مطابق");
  assert.ok(Object.keys(data.counts).length, "لا خلاصة تُقرأ قبل الكتابة الحقيقية");
  // ⑤ لا حقل شخصي في الرد.
  assert.ok(!raw.includes("secret@example.com"), "بريد مرشّح خرج في رد مسار صيانة");
  assert.ok(!raw.includes("0591234567"), "جوال مرشّح خرج في رد مسار صيانة");
  assert.ok(!raw.includes("محمد العبدالله"), "اسم مرشّح خرج في رد مسار صيانة");
  // والمؤشّر يُعاد ليُكمل عليه: بلاه تدور الجولة على أول صفحةٍ أبداً.
  assert.equal(data.next, "CURSOR-2");
  assert.equal(data.more, true);
});

test("fix-compliance: انتهاء القاعدة يُقال صريحاً، لا بمؤشّرٍ فارغ يُشبه البداية", async () => {
  reset();
  hasMore = false;
  queryRows = [row({ [SAUD_PROP]: sel("مقصورة على السعوديين"), [COMP_PROP]: sel(BLOCKED), [NAT_PROP]: sel("غير سعودي") })];
  const { data } = await get("action=fix-compliance&key=test-owner-key");
  assert.equal(data.more, false, "لم يُقل إن الجولة انتهت — فتدور اللوحة إلى الأبد");
  assert.equal(data.next, "");
  assert.equal(data.deferred, 0);
});

test("fix-compliance: المؤشّر يُمرَّر إلى نوشن، ونطاق المُرشِّح هو المتناقض المحتمل", async () => {
  reset();
  await get("action=fix-compliance&key=test-owner-key&cursor=CURSOR-2");
  assert.equal(lastQuery.start_cursor, "CURSOR-2");
  const or = lastFilter.or;
  assert.equal(or.length, 2);
  assert.equal(or[0].property, COMP_PROP);
  assert.equal(or[0].select.equals, BLOCKED);
  // الاتجاه المعكوس مُرشَّحٌ بدقّة، لا يُمشَّط الـ✅ كله لأجل صفٍّ واحد.
  assert.equal(or[1].and.length, 3);
});

test("fix-compliance: لا مفتاح ⇒ ٤٠٣ ولا استعلام", async () => {
  reset();
  const { status } = await get("action=fix-compliance");
  assert.equal(status, 403);
  assert.equal(lastQuery, null, "استُعلمت قاعدة المرشحين بلا مصادقة");
  assert.equal(calls.patch, 0);
  const bad = await get("action=fix-compliance&key=wrong");
  assert.equal(bad.status, 403);
});

/* ═════════════════ ④ الاستدراك: الكلفة عدد المسميات لا الصفوف ═════════════════ */

test("saudization dryRun: يقيس المسميات المتميّزة — وهي الكلفة الحقيقية", async () => {
  reset();
  queryRows = [
    row({ "Target Role": sel("HR Specialist") }),
    row({ "Target Role": sel("hr specialist") }),   // المسمّى نفسه بحالة أحرف أخرى
    row({ "Target Role": sel("Recruiter") }),
    row({}),                                        // بلا مسمّى أصلاً
  ];
  const { data } = await get("action=saudization&key=test-owner-key&dryRun=true");

  assert.equal(data.queued, 4);
  assert.equal(data.distinctRoles, 2, "عُدّ المكرّر نداءً — والذاكرة تُجيبه بلا نداء");
  assert.equal(data.noRole, 1);
  assert.equal(data.scope, "stamped");
  assert.equal(calls.saud, 0, "نُودي أزور في جولةٍ تجريبية");
  assert.equal(calls.patch, 0);
  // والنطاق الافتراضي هو الظاهرون في لوحة صاحب العمل: مختومون بوظيفة، بلا توطين.
  assert.equal(lastFilter.and.length, 2);
  assert.equal(lastFilter.and[0].property, SAUD_PROP);
  assert.equal(lastFilter.and[0].select.is_empty, true);
  assert.equal(lastFilter.and[1].property, "الوظيفة المتقدم لها");
});

test("saudization: نداءٌ واحد لكل مسمّى متميّز، والتوطين والامتثال يُكتبان", async () => {
  reset();
  const role = "أخصائي موارد بشرية " + Date.now();
  saudReply = { saudization: "مسموح لغير السعوديين", saudization_details: "المهنة مفتوحة." };
  queryRows = [
    row({ "Target Role": sel(role), [NAT_PROP]: sel("غير سعودي") }),
    row({ "Target Role": sel(role), [NAT_PROP]: sel("سعودي") }),
  ];
  const { data } = await get("action=saudization&key=test-owner-key");

  assert.equal(calls.saud, 1, "نداءان لمسمّى واحد — نداءٌ ومالٌ بلا سبب");
  assert.equal(data.written, 2);
  for (const p of patches) {
    assert.equal(p.props[SAUD_PROP].select.name, "مسموح لغير السعوديين");
    assert.equal(p.props[COMP_PROP].select.name, "✅ مطابق");
    assert.match(p.props[DET_PROP].rich_text[0].text.content, /حُسب آلياً/);
  }
});

test("saudization: لا تُدهس قيمةٌ موجودة — التوطين المحسوم والامتثال المحسوم", async () => {
  reset();
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "محفوظة." };
  queryRows = [row({
    "Target Role": sel("محاسب قانوني " + Date.now()),
    [SAUD_PROP]: sel("مسموح لغير السعوديين"),   // محسومٌ من وكيل قرأ السيرة كاملة
    [COMP_PROP]: sel("⚠️ اشتراطات"),            // حسمه إنسان
    [NAT_PROP]: sel("غير سعودي"),
  })];
  const { data } = await get("action=saudization&key=test-owner-key");

  // لا شيء يُكتب أصلاً: الطرفان محسومان، فلا كتابةَ فارغة على القاعدة.
  assert.equal(calls.patch, 0, "كُتب على صفٍّ طرفاه محسومان");
  assert.equal(data.results[0].skipped, "already_decided");
  const p = (patches[0] || { props: {} }).props;
  assert.ok(!(SAUD_PROP in p), "نُسخ حسابُنا فوق توطينٍ محسوم");
  assert.ok(!(DET_PROP in p), "استُبدلت تفاصيلُ توطينٍ محسوم");
  assert.ok(!(COMP_PROP in p), "أُعيدت كتابة امتثالٍ حسمه إنسان");
});

test("saudization: توطينٌ محسوم وامتثالٌ فارغ ⇒ يُشتقّ الامتثال من القيمة المخزّنة لا من حسابنا", async () => {
  reset();
  // حسابُنا على المسمّى وحده يقول «مقصورة»، والمخزّن يقول «مسموح». الامتثال
  // يُشتقّ من المخزّن — وإلا وُلد تناقضٌ جديد من طرفين صحيحين كلٌّ على حدة.
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "محفوظة." };
  queryRows = [row({
    "Target Role": sel("مدقّق داخلي " + Date.now()),
    [SAUD_PROP]: sel("مسموح لغير السعوديين"),
    [NAT_PROP]: sel("غير سعودي"),
  })];
  await get("action=saudization&key=test-owner-key");

  const p = patches[0].props;
  assert.ok(!(SAUD_PROP in p), "نُسخ حسابُنا فوق توطينٍ محسوم");
  assert.equal(p[COMP_PROP].select.name, "✅ مطابق",
    "اشتُقّ الامتثال من حسابنا لا من التوطين المخزّن — وهذا مولّد التناقض بالضبط");
});

test("saudization: صفٌّ بلا جنسية ⇒ 🔍 لا حكم، وبلا مسمّى ⇒ صفر نداء", async () => {
  reset();
  saudReply = { saudization: "مقصورة على السعوديين", saudization_details: "محفوظة." };
  queryRows = [row({ "Target Role": sel("طيّار اختبار " + Date.now()) })];   // لا جنسية
  await get("action=saudization&key=test-owner-key");
  assert.equal(patches[0].props[COMP_PROP].select.name, NEEDS,
    "وُسم ⛔ صفٌّ لا نعرف جنسية صاحبه");

  reset();
  queryRows = [row({})];
  await get("action=saudization&key=test-owner-key");
  assert.equal(calls.saud, 0, "نداءٌ مدفوع على صفٍّ بلا مسمّى مهنة");
  assert.equal(patches[0].props[SAUD_PROP].select.name, "بحاجة فحص");
});

test("saudization: محرّك التحليل غير مهيّأ ⇒ ٥٠٣ ولا كتابة", async () => {
  reset();
  queryRows = [row({ "Target Role": sel("مهندس اختبار") })];
  const ep = process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_ENDPOINT;
  try {
    const { status, data } = await get("action=saudization&key=test-owner-key");
    assert.equal(status, 503);
    assert.equal(data.error, "ai_not_configured");
  } finally { process.env.AZURE_OPENAI_ENDPOINT = ep; }
  assert.equal(calls.patch, 0, "كُتب «بحاجة فحص» على صفوفٍ لأن المحرّك مطفأ — وسمٌ كاذب يُخرجها من الجولة");
});

test("saudization: لا مفتاح ⇒ ٤٠٣ ولا استعلام", async () => {
  reset();
  const { status } = await get("action=saudization");
  assert.equal(status, 403);
  assert.equal(lastQuery, null);
  assert.equal(calls.saud, 0);
});
