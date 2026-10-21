// ‏حراس ردّ المستشار (api/_chat-guards.js + guardReply في api/chat.js).
// ‏كل حالة فشلٍ هنا مأخوذة من محادثة حقيقية على التجريبي (2026-10-21، ٤٠ محادثة، ١٤٠ استدعاءً):
// الرد الفاشل حرفياً (أو مُحاكى بالشكل نفسه حين لم يُحفظ خامه) ثم ما يخرج إلى العميل بعد الحارس.
// ‏ومعها حالات سلبية: ما يجب ألا يُمسّ (رقم الهاتف، مدة واردة في القاعدة، أرقام المستندات).
// ‏لا نموذج ولا شبكة: fetch مُقلَّد.
process.env.WHATSAPP_MODE = "live";
process.env.AZURE_OPENAI_ENDPOINT = "https://bp-ai.openai.azure.com";
process.env.AZURE_OPENAI_KEY = "test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
delete process.env.APP_ENV;

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as G from "../api/_chat-guards.js";
import { pickKnowledge } from "../api/_knowledge.js";

const CATALOG = JSON.parse(readFileSync(new URL("../site/assets/data/catalog.json", import.meta.url), "utf8"));
const SERVICES = CATALOG.services;
const AZ = "https://bp-ai.openai.azure.com/openai/v1/chat/completions";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const azureOk = (text) => json({ choices: [{ message: { content: text } }] });
const turn = (role, content) => ({ role, content });
const scopeOf = (text) => JSON.parse(/<<SCOPE>>([\s\S]*?)<<END>>/.exec(text)[1]);

function stub(handler) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url && url.url ? url.url : url);
    calls.push({ url: u, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return handler(u, calls.filter((c) => c.url.startsWith(AZ)).length, calls);
  };
  return { calls, az: () => calls.filter((c) => c.url.startsWith(AZ)), restore: () => { globalThis.fetch = real; } };
}
async function ask(body) {
  const { default: handler } = await import("../api/chat.js");
  let out = "";
  const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handler({ method: "POST", body, headers: {} }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}

// ───────────────────────── ١) شكوى / طلب مسؤول (C26) ─────────────────────────

const C26_T1 = "أعتذر لك عن التأخير وسوء التواصل الذي واجهته، وسوف أرفع ملاحظتك فوراً للمسؤول المختص ليتابع التواصل معك بأولوية. هل تفضل أن يتم التواصل معك هاتفياً أم عبر واتساب؟  \n<<OPTS>>[\"اتصال هاتفي\",\"واتساب فقط\"]<<END>>";
const C26_T2 = "تم تسجيل طلبك وسيتواصل معك مسؤول خدمة العملاء هاتفياً على رقمك المسجل لدينا قريباً. إذا رغبت بموعد محدد أو لديك تفاصيل إضافية تود مشاركتها؟  \n<<OPTS>>[\"أي وقت يناسبهم\",\"أفضل فترة صباحية\"]<<END>>";
const C26_U1 = "أنا زعلان، طلبي متأخر ثلاث أسابيع وما أحد يرد علي، أبغى أكلم مسؤول وأعطوني رقم";
const C26_U2 = "أبغى رقم اتصال مباشر مو واتساب";

test("C26: من طلب مسؤولاً/رقماً يخرج برقم باهر الرسمي ورابطه، لا بوعد تصعيد ولا «رقمك المسجل»", () => {
  for (const [reply, user] of [[C26_T1, C26_U1], [C26_T2, C26_U2]]) {
    const r = G.ensureHumanContact(reply, { userText: user, lang: "ar" });
    assert.equal(r.intent, "strong");
    assert.ok(r.replaced);
    assert.match(r.text, /0530540231/);
    assert.match(r.text, /https:\/\/wa\.me\/966530540231/);
    assert.doesNotMatch(r.text, /تم تسجيل|سيتم تصعيد|سيتواصل معك مسؤول|رقمك المسجل|أرفع ملاحظتك|<<OPTS>>/);
  }
});

test("الكاشف: كلمات الطلب والشكوى بأربع لغات، ولا يلتقط الكلام العادي", () => {
  for (const u of [C26_U1, C26_U2, "أبغى أكلم المدير", "عطوني رقم الجوال المباشر", "I want to speak to a manager", "Give me your phone number", "Je veux parler à un responsable", "我要人工客服", "ابغى موظف بشري"]) {
    assert.equal(G.escalationIntent(u), "strong", u);
  }
  for (const u of ["عندي شكوى على الخدمة", "I have a complaint", "我要投诉", "J'ai une plainte"]) assert.equal(G.escalationIntent(u), "weak", u);
  // ‏سلبية: ليست طلباً للتواصل.
  for (const u of ["رقم جوالي 0501234567 وأبغى المتابعة", "عطوني رقم الطلب", "وش رقم السجل التجاري المطلوب؟", "كم غرامة التأخير في مدد؟", "أبغى أسجل منشأتي في التأمينات", "My phone number is 0551234567", "ابغى رقم الوزارة", "What is the ministry phone number?", "أعطني رقم السجل التجاري للشركة", "اتصلت بموظف الجوازات ولم يردوا علي", "مدير الشركة هو من سيوقع العقد"]) {
    assert.equal(G.escalationIntent(u), "", u);
  }
});

test("شكوى (ضعيفة): الرقم يُضاف للرد دون استبداله، وعبارات الوعد تُحذف", () => {
  const r = G.ensureHumanContact("نعتذر عن ذلك. سيتم تصعيد شكواك. ما نوع النشاط لديكم؟", { userText: "عندي شكوى على الخدمة", lang: "ar" });
  assert.equal(r.intent, "weak");
  assert.ok(!r.replaced);
  assert.match(r.text, /نعتذر عن ذلك/);
  assert.match(r.text, /ما نوع النشاط/);
  assert.doesNotMatch(r.text, /سيتم تصعيد/);
  assert.match(r.text, /0530540231/);
  // ‏وإن كان فيه الرقم أصلاً فلا تكرار.
  const again = G.ensureHumanContact("اتصل على 0530540231", { userText: "عندي شكوى", lang: "ar" });
  assert.equal(again.text, "اتصل على 0530540231");
});

test("طلب صريح والنموذج أعطى الرقم بلا وعد: الرد كما جاء حرفاً", () => {
  const good = "للتواصل المباشر: 0530540231 · https://wa.me/966530540231";
  assert.equal(G.ensureHumanContact(good, { userText: "أبغى أكلم مسؤول", lang: "ar" }).text, good);
});

test("الوعود الكاذبة: تُحذف عبارات التسجيل والتصعيد، ويبقى «سيتواصل معك فريقنا» (وعدٌ صادق في عرض السعر)", () => {
  assert.equal(G.stripFalsePromises("هل رقمك هو المسجل معنا؟ سيتم تصعيد طلبك. شكراً لتواصلك.").text, "شكراً لتواصلك.");
  const ok = "سيتواصل معك فريقنا لتأكيد عرض السعر بعد المراجعة.";
  assert.equal(G.stripFalsePromises(ok).text, ok);
  assert.ok(G.stripFalsePromises("A manager will contact you shortly on your registered number.").hit);
  assert.ok(!G.stripFalsePromises("You can reach our team on WhatsApp.").hit);
});

test("C26 من طرف إلى طرف: Azure يرد بالوعد الكاذب فيخرج للعميل الرقم الرسمي", async () => {
  const f = stub(() => azureOk(C26_T2));
  try {
    const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", C26_U1), turn("assistant", C26_T1), turn("user", C26_U2)] });
    assert.match(r.json.reply, /0530540231/);
    assert.doesNotMatch(r.json.reply, /رقمك المسجل|تم تسجيل طلبك/);
    assert.equal(f.az().length, 1, "المشتكي لا يُلاحَق بإعادة نداء النطاق");
  } finally { f.restore(); }
});

// ───────────────────────── ٢) النطاق لا يتأخر ─────────────────────────

const SCOPE_OK = `رتّبت لك النطاق.\n<<SCOPE>>{"ready":true,"type":"CONSULTATION","title":"استشارة","summary":"ملخص","items":[{"code":"","title":"فهم الحالة","why":"للبدء"},{"code":"","title":"تحديد الخطوات","why":"للتنفيذ"}],"needs":["السجل التجاري ساري","هوية الممثل"]}<<END>>`;
const history3 = [turn("user", "عندي مطعم والتكاليف عالية"), turn("assistant", "في أي مدينة؟\n<<OPTS>>[\"جدة\"]<<END>>"), turn("user", "جدة"), turn("assistant", "كم موظف؟"), turn("user", "25 موظف")];

test("shouldForceScope: يُفرض عند الرسالة الثالثة بلا نطاق، ولا يُفرض قبلها ولا بعد نطاقٍ سابق", () => {
  assert.equal(G.shouldForceScope(history3, "كم ميزانيتك الشهرية؟"), true);
  assert.equal(G.shouldForceScope(history3, SCOPE_OK), false, "هذا الرد فيه نطاق");
  assert.equal(G.shouldForceScope(history3.slice(0, 3), "سؤال؟"), false, "رسالتان فقط");
  assert.equal(G.shouldForceScope([...history3.slice(0, 2), turn("user", "جدة"), turn("assistant", SCOPE_OK), turn("user", "عدّل"), turn("assistant", "تم"), turn("user", "وزد بنداً")], "تمام"), false, "نطاقٌ سابق في التاريخ");
  assert.equal(G.shouldForceScope(history3, `<<SCOPE>>{"ready":false}<<END>>`), true, "كتلة غير جاهزة لا تُحتسب");
  assert.equal(G.shouldForceScope(history3, "<<SCOPE>>{مكسور<<END>>"), true, "كتلة مكسورة لا تُقرأ في الواجهة فلا تُحتسب");
});

test("النطاق عند الرسالة الثالثة: إعادة نداء واحدة بتعليمة «أخرج الكتلة الآن»، وتنجح إن خرجت الكتلة", async () => {
  const f = stub((u, n) => azureOk(n === 1 ? "هل عندك فريق مبيعات؟" : SCOPE_OK));
  try {
    const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: history3 });
    assert.equal(f.az().length, 2);
    assert.doesNotMatch(f.az()[0].body.messages[0].content, /إلزامي في هذا الدور/);
    assert.match(f.az()[1].body.messages[0].content, /إلزامي في هذا الدور: بلغ العميل رسالته الثالثة/);
    assert.equal(r.json.provider, "azure");
    assert.ok(G.hasValidScope(r.json.reply));
  } finally { f.restore(); }
});

test("النطاق عند الرسالة الثالثة: إن أبى النموذج مرتين فالنطاق الاحتياطي (intakeFallback) لا سؤال رابع", async () => {
  const f = stub(() => azureOk("وما حجم ميزانيتك؟"));
  try {
    const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: history3 });
    assert.equal(f.az().length, 2, "مرة واحدة فقط تُعاد");
    assert.equal(r.json.provider, "intake-fallback");
    assert.ok(G.hasValidScope(r.json.reply));
    assert.match(scopeOf(r.json.reply).summary, /25 موظف/);
  } finally { f.restore(); }
});

test("النطاق: لا إعادة نداء قبل الثالثة ولا بعد نطاقٍ سابق ولا مع الشكوى", async () => {
  for (const messages of [
    history3.slice(0, 3),
    [turn("user", "أ"), turn("assistant", SCOPE_OK), turn("user", "ب"), turn("assistant", "تم"), turn("user", "ج")],
    [...history3.slice(0, 4), turn("user", "أبغى أكلم مسؤول")],
  ]) {
    const f = stub(() => azureOk("سؤال تالٍ؟"));
    try {
      const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages });
      assert.equal(f.az().length, 1);
      assert.notEqual(r.json.provider, "intake-fallback");
    } finally { f.restore(); }
  }
});

// ───────────────────────── ٣) مدد مخترعة ─────────────────────────

const C04_REPLY = "رسوم تجديد الإقامة تعتمد على عدد العمالة وتُحدد بحسب نظام المقابل المالي، وعادةً تتم الموافقة خلال 1–3 أيام بعد استكمال الشروط ودفع الرسوم. ما هو عدد الموظفين الوافدين الذي ترغب في تجديد إقاماتهم حالياً؟\n<<OPTS>>[\"موظف واحد أو موظفان\",\"3–10 موظفين\"]<<END>>";
const KN = "مدة الإصدار 3-10 أيام عمل. الصلاحية 12 شهر. مهلة ٣ أشهر. 72 ساعة.";

test("مدة مخترعة (C04 «1–3 أيام»): تُحايَد ولا تُحذف الجملة، وتبقى الخيارات", () => {
  const g = G.guardDurations(C04_REPLY, { knowledge: KN });
  assert.ok(g.hit);
  assert.doesNotMatch(g.text, /1–3 أيام/);
  assert.match(g.text, /تتم الموافقة خلال مدة تحددها الجهة المختصة بعد استكمال الشروط/);
  assert.match(g.text, /ما هو عدد الموظفين الوافدين/);
  assert.match(g.text, /3–10 موظفين/, "العدّ بلا وحدة زمنية لا يُمسّ");
});

test("مدد مخترعة بالإنجليزية والصينية والفرنسية و«يومين»", () => {
  const cases = [
    ["Opening a branch in Riyadh for a German company typically takes around 1–2 weeks if documents are ready.", /takes a period set by the competent authority if documents are ready/],
    ["一般情况下，外国人在沙特设立公司所需时间为1-2周，具体取决于资料是否齐全。", /所需时间为主管部门规定的期限/],
    ["La succursale est généralement ouverte en 3 à 5 jours ouvrables.", /un délai fixé par l’autorité compétente/],
    ["يتم تجديد الإقامة في يومين عمل فقط.", /مدة تحددها الجهة المختصة فقط/],
    ["مدة إصدار الترخيص بعد تقديم المستندات \\~1–10 أيام عمل حسب النشاط.", /مدة تحددها الجهة المختصة حسب النشاط/],
    ["تُنجز المعاملة في ثلاثة أسابيع.", null],
  ];
  const kn = "لا مدد هنا";
  for (const [text, want] of cases) {
    const g = G.guardDurations(text, { knowledge: kn });
    if (want) { assert.ok(g.hit, text); assert.match(g.text, want, text); }
  }
  assert.ok(G.guardDurations("تُنجز المعاملة في ثلاثة أسابيع.", { knowledge: "x" }).hit, "الرقم بالحروف يُلتقط");
});

test("مدة واردة حرفاً في المقاطع أو في كلام العميل: لا تُحجب (أرقام هندية وفواصل مختلفة)", () => {
  const kn = KN;
  for (const ok of ["تصدر خلال 3 إلى 10 أيام عمل", "تصدر خلال ٣–١٠ أيام", "تصدر خلال 10 أيام", "الصلاحية 12 شهراً", "المهلة ٣ أشهر", "المهلة 3 أشهر", "خلال 72 ساعة", "valid for 12 months", "within 3-10 business days"]) {
    const g = G.guardDurations(ok, { knowledge: kn });
    assert.equal(g.text, ok, ok);
  }
  // ‏ما كتبه العميل نفسه.
  const g = G.guardDurations("إقامتك تنتهي بعد 5 أشهر، فلنبدأ مبكراً.", { knowledge: "", userText: "إقاماتهم تنتهي بعد 5 أشهر" });
  assert.equal(g.hit, false);
});

test("مدة غير واردة لا يُنقذها نطاقٌ يشبهها: «1-3 أيام» ليست «3-10 أيام» ولا طرفاً منها", () => {
  assert.ok(G.guardDurations("خلال 1-3 أيام", { knowledge: KN }).hit);
  assert.ok(G.guardDurations("خلال 4-10 أيام", { knowledge: KN }).hit);
  assert.ok(G.guardDurations("خلال 5 أسابيع", { knowledge: KN }).hit, "وحدةٌ أخرى");
});

test("حالات سلبية للمدد: رقم الهاتف، أرقام المستندات، أعداد الموظفين، السنة التقويمية، الأكواد", () => {
  for (const ok of [
    "تواصل على 0530540231 أو https://wa.me/966530540231",
    "نحتاج 3 نسخ من الجواز و12 موظف ورقم السجل 1010123456",
    "تأسست الشركة عام 2015 وسجلها 2015 ساري",
    "الخدمة BP-FI-11 والكود BP-SBC-04",
    "ثلاثة مستندات و5 موظفين",
    "تأسست في 2009年",
  ]) assert.equal(G.guardDurations(ok, { knowledge: "" }).text, ok, ok);
});

test("مدة مخترعة من طرف إلى طرف: ما يصل للعميل بلا «1–3 أيام» والمعرفة هي المرجع", async () => {
  const f = stub(() => azureOk(C04_REPLY));
  try {
    const r = await ask({ mode: "intake", context: "government", lang: "ar", messages: [turn("user", "كم رسوم تجديد الإقامة وكم تاخذ المدة؟")] });
    assert.doesNotMatch(r.json.reply, /1–3 أيام/);
    assert.match(r.json.reply, /مدة تحددها الجهة المختصة/);
    assert.match(r.json.reply, /<<OPTS>>/);
  } finally { f.restore(); }
});

test("مدة واردة في القاعدة المُرفقة فعلاً: المعالج لا يحجبها (المعرفة الحقيقية)", async () => {
  const q = "كم مدة إصدار رخصة ريادة الأعمال؟";
  const kn = pickKnowledge(q, 9000);
  const real = G.durationsIn(kn).find((d) => d.fam === "day" && d.lo !== d.hi) || G.durationsIn(kn)[0];
  assert.ok(real, "في المقاطع المختارة مدة واحدة على الأقل");
  const phrase = kn.slice(real.start, real.end);
  const f = stub(() => azureOk(`تصدر خلال ${phrase} بعد اكتمال المستندات.\nما نشاط شركتك؟`));
  try {
    const r = await ask({ mode: "intake", context: "formation", lang: "ar", messages: [turn("user", q)] });
    assert.ok(r.json.reply.includes(phrase), `«${phrase}» واردة في القاعدة فتبقى`);
  } finally { f.restore(); }
});

// ───────────────────────── ٤) حارس الأسعار: لا عناوين يتيمة (X06 وX07) ─────────────────────────

const GUEST = { priceMode: "login", cfg: null };
const X06_RAW = "رسوم رخصة العمل للوافد (الرسوم الحكومية):\n- الرسوم السنوية: 9,600 ريال عن كل عامل\n- تُحصّل الرسوم سنويًا عند تجديد أو إصدار الرخصة.\n- أول 3 أشهر من إصدار رخصة العمل مجانية.\n\nرسوم تأشيرة الخروج والعودة المتعددة (الحكومية):\n- 200 ريال لكل 3 أشهر\n- 300 ريال للتأشيرة الواحدة\n\nإذا تحتاج المساعدة في إصدار أو تجديد رخصة العمل، تواصل معنا على واتساب: https://wa.me/966530540231";
const X07_RAW = "نسبة اشتراك التأمينات الاجتماعية للعاملين في السعودية كالتالي:\n- السعودي: 11.75% من الأجر وبحد أدنى 400 ريال\n- غير السعودي: 2% من الأجر ويُحسب بمبلغ 150 ريال كحد أدنى\n\nأما غرامة التأخير في سداد الاشتراكات: فهي لا تتجاوز 100% من قيمة الاشتراكات.";

test("X06: العنوان الذي حُجب كل بنوده يُحذف معها، وجملة الحجب مرة واحدة في آخر الشرح لا وسطه", async () => {
  const { guardReply } = await import("../api/chat.js");
  const g = guardReply(X06_RAW, GUEST);
  assert.equal(g.gated, true);
  assert.doesNotMatch(g.text, /9,600|200 ريال|300 ريال/);
  assert.doesNotMatch(g.text, /رسوم تأشيرة الخروج والعودة المتعددة \(الحكومية\):/, "عنوان بلا محتوى");
  assert.match(g.text, /رسوم رخصة العمل للوافد \(الرسوم الحكومية\):/, "عنوان بقي تحته بنود");
  assert.match(g.text, /أول 3 أشهر من إصدار رخصة العمل مجانية/);
  assert.equal((g.text.match(/السعر يظهر بعد تسجيل الدخول/g) || []).length, 1);
  const lines = g.text.split("\n").filter(Boolean);
  assert.match(lines[lines.length - 1], /wa\.me\/966530540231|السعر يظهر/, "لا جملة حجب وسط الشرح");
  assert.ok(g.text.indexOf("السعر يظهر بعد تسجيل الدخول") > g.text.indexOf("أول 3 أشهر"), "الملاحظة بعد الشرح");
  assert.doesNotMatch(g.text, /:\s*\n\s*\n\s*السعر يظهر/);
});

test("X07: «كالتالي:» بلا قائمة ← يُحذف العنوان ويبقى باقي الشرح", async () => {
  const { guardReply } = await import("../api/chat.js");
  const g = guardReply(X07_RAW, GUEST);
  assert.doesNotMatch(g.text, /كالتالي:/);
  assert.match(g.text, /غرامة التأخير في سداد الاشتراكات/);
  assert.equal((g.text.match(/السعر يظهر بعد تسجيل الدخول/g) || []).length, 1);
  assert.doesNotMatch(g.text, /150 ريال|400 ريال/);
});

test("سياسة الأسعار لم تُخفَّف: السعر يُحجب كما كان، والرسوم الحكومية الصريحة في سطرها تمرّ، والرد السليم لا يُمسّ", async () => {
  const { guardReply } = await import("../api/chat.js");
  assert.ok(guardReply("تأسيس الشركة 7,500 ﷼", GUEST).gated);
  assert.match(guardReply("الرسوم الحكومية 500 ريال", GUEST).text, /الرسوم الحكومية 500 ريال/);
  const plain = "نسبة الاشتراك:\n- بند أول\n- بند ثانٍ\nوالمدة 3 أيام.";
  assert.equal(guardReply(plain, GUEST).text, plain);
  // ‏عنوان بقي تحته بند سليم لا يُحذف.
  const partial = guardReply("الرسوم:\n- الخدمة 5,000 ريال\n- تحتاج هوية سارية", GUEST).text;
  assert.match(partial, /الرسوم:/);
  assert.match(partial, /تحتاج هوية سارية/);
});

// ───────────────────────── ٥) النوع والأكواد ─────────────────────────

const C07R3 = "تم ترتيب نطاق الخدمات.\n\n<<SCOPE>>" + JSON.stringify({ ready: true, type: "COMPANY_FORMATION", title: "تأسيس فرع لشركة مصرية في السعودية", summary: "تأسيس شركة فرعية في الرياض", items: [
  { code: "BP-FI-11", title: "الحصول على الترخيص الاستثماري من وزارة الاستثمار", why: "مطلوب للشركات الأجنبية التي تؤسس فروعًا في السعودية" },
  { code: "BP-SBC-04", title: "إصدار سجل تجاري للفرع في السعودية", why: "للحصول على كيان قانوني رسمي في السعودية" },
  { code: "", title: "تجهيز النظام الأساسي وعقد التأسيس للفرع", why: "لتطبيق المتطلبات النظامية" }], needs: ["السجل التجاري للشركة الأم في مصر مصدقًا", "جواز سفر الشريك"] }) + "<<END>>";
const C09 = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "COMPANY_FORMATION", title: "تأسيس شركة عبر رخصة ريادة الأعمال للأجانب", summary: "تأسيس شركة تقنية", items: [
  { code: "", title: "مراجعة خطاب دعم الحاضنة/المسرعة المعتمدة", why: "التأكد من مطابقة المتطلبات" },
  { code: "BP-FI-11", title: "تجهيز وتقديم مستندات تأسيس الشركة بعد الرخصة", why: "لاستكمال تأسيس الكيان القانوني حسب المسار المعتمد" }], needs: ["جواز سفر المستثمر"] }) + "<<END>>";
const C10R2 = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "COMPANY_FORMATION", title: "Ouverture d’une succursale à Riyad", summary: "Ouverture d’une succursale", items: [
  { code: "BP-FI-11", title: "Demande de licence d’investissement MISA pour la succursale", why: "Nécessaire pour opérer légalement en Arabie Saoudite" }], needs: ["Passeport du représentant légal"] }) + "<<END>>";
const C05 = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "GOVERNMENT_SERVICE", title: "الاعتراض على مخالفة عدم وجود رخصة بلدية", summary: "مخالفة بلدي", items: [
  { code: "BP-HRSD-04", title: "مراجعة المخالفة وتقييم إمكانية الاعتراض", why: "للتحقق من أهلية الاعتراض وفق الأنظمة" },
  { code: "", title: "تجهيز وتقديم طلب الاعتراض على منصة بلدي", why: "لرفع الاعتراض رسمياً" }], needs: ["إشعار المخالفة الرسمي من منصة بلدي"] }) + "<<END>>";
const C08R3 = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "COMPANY_FORMATION|GOVERNMENT_SERVICE", title: "فتح فرع لشركة ألمانية في الرياض", summary: "فرع", items: [
  { code: "BP-FI-06", title: "تسجيل فرع لشركة أجنبية (ألمانيا) في الرياض", why: "لتمكين الشركة الأم من مزاولة النشاط" },
  { code: "BP-SUBL-01", title: "التسجيل في العنوان الوطني للمكتب", why: "يُطلب لتوثيق مقر الشركة" },
  { code: "BP-SBC-06", title: "فتح حساب شركة على منصة أبشر أعمال", why: "إدارة الخدمات الحكومية الإلكترونية" },
  { code: "BP-SBC-05", title: "حجز اسم الشركة للفرع", why: "لاستكمال متطلبات السجل التجاري" }], needs: ["البيانات المالية المدققة"] }) + "<<END>>";
const C06 = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "COMPANY_FORMATION", title: "تحويل مؤسسة فردية إلى شركة وإضافة شريك وتعديل النشاط", summary: "تحويل", items: [
  { code: "BP-SBC-18", title: "تحويل المؤسسة الفردية إلى شركة ذات مسؤولية محدودة", why: "لإمكانية إضافة شريك جديد" },
  { code: "BP-SBC-11", title: "تعديل بيانات السجل التجاري (النشاط)", why: "لتحديث النشاط التجاري بعد التحويل" }], needs: ["صورة هوية صاحب المؤسسة"] }) + "<<END>>";
const sanitize = (r, o = {}) => G.sanitizeScope(r, { context: "formation", services: SERVICES, ...o });
const codesOf = (text) => scopeOf(text).items.map((i) => i.code);

test("الكود في غير معناه: BP-FI-11 (تعديل ترخيص) لتأسيس جديد يُسقط كوده ويبقى البند (ثلاث حالات حقيقية)", () => {
  for (const [name, raw] of [["C07r3", C07R3], ["C09", C09], ["C10r2", C10R2]]) {
    const s = sanitize(raw);
    const sc = scopeOf(s.text);
    assert.ok(!codesOf(s.text).includes("BP-FI-11"), name);
    assert.ok(s.changes.some((c) => c.startsWith("code-mismatch:BP-FI-11")), name);
    assert.equal(sc.items.length, scopeOf(raw).items.length, `${name}: البند باقٍ`);
  }
  assert.deepEqual(codesOf(sanitize(C07R3).text), ["", "BP-SBC-04", ""], "الكود الصحيح بجواره يبقى");
});

test("BP-HRSD-04 (مخالفة نظام العمل) لمخالفة بلدية: يسقط الكود بتعارض الجهة", () => {
  assert.deepEqual(codesOf(sanitize(C05, { context: "government" }).text), ["", ""]);
});

test("أكواد صحيحة بمعناها تبقى كما هي (سلبي): فرع أجنبي · عنوان وطني · أبشر أعمال · حجز اسم · تحويل وتعديل", () => {
  const a = sanitize(C08R3);
  assert.deepEqual(codesOf(a.text), ["BP-FI-06", "BP-SUBL-01", "BP-SBC-06", "BP-SBC-05"]);
  assert.deepEqual(codesOf(sanitize(C06).text), ["BP-SBC-18", "BP-SBC-11"]);
});

test("type: «COMPANY_FORMATION|GOVERNMENT_SERVICE» ← قيمة واحدة (الأقرب لباب المحادثة)، وغير الصالح ← نوع الباب", () => {
  assert.equal(scopeOf(sanitize(C08R3).text).type, "COMPANY_FORMATION");
  assert.equal(scopeOf(sanitize(C08R3, { context: "government" }).text).type, "GOVERNMENT_SERVICE");
  assert.equal(G.normalizeScopeType("OTHER", "government"), "GOVERNMENT_SERVICE");
  assert.equal(G.normalizeScopeType("", "consulting"), "CONSULTATION");
  assert.equal(G.normalizeScopeType("BUSINESS_DEVELOPMENT", "consulting"), "CONSULTATION", "الباب الرابع مخفي");
  assert.equal(G.normalizeScopeType("BUSINESS_DEVELOPMENT", "bizdev", { allowBizdev: true }), "BUSINESS_DEVELOPMENT");
  assert.equal(G.normalizeScopeType("GOVERNMENT_SERVICE", "formation"), "GOVERNMENT_SERVICE", "نوع صالح يخالف الباب يبقى (الطلب قد يعبر الأبواب)");
});

test("الخدمة التي اختارها العميل من الموقع تبقى بكودها حتى لو لم يتطابق نصّ البند", () => {
  const raw = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "GOVERNMENT_SERVICE", title: "x", summary: "y", items: [{ code: "BP-GOSI-01", title: "تمام", why: "" }], needs: ["السجل التجاري"] }) + "<<END>>";
  assert.deepEqual(codesOf(sanitize(raw, { context: "government" }).text), [""]);
  assert.deepEqual(codesOf(sanitize(raw, { context: "government", picked: ["BP-GOSI-01"] }).text), ["BP-GOSI-01"]);
});

test("كود غير موجود في الكتالوج يسقط، وحالة الأحرف تُصحَّح", () => {
  const mk = (code) => "<<SCOPE>>" + JSON.stringify({ ready: true, type: "GOVERNMENT_SERVICE", title: "x", summary: "y", items: [{ code, title: "التسجيل في التأمينات الاجتماعية (GOSI)", why: "" }], needs: ["السجل التجاري"] }) + "<<END>>";
  assert.deepEqual(codesOf(sanitize(mk("BP-XXX-99"), { context: "government" }).text), [""]);
  assert.deepEqual(codesOf(sanitize(mk("bp-gosi-01"), { context: "government" }).text), ["BP-GOSI-01"]);
});

test("BP-BS-01 (التسويق الرقمي والإعلان) موجود في الكتالوج، والتعليمات تمنع إنكاره", async () => {
  assert.ok(SERVICES.some((s) => s.code === "BP-BS-01" && /الإعلان/.test(s.nameAr)));
  const f = stub(() => azureOk("تمام."));
  try {
    await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", "تسوون حملات إعلانية على سناب؟")] });
    const sys = f.az()[0].body.messages[0].content;
    assert.match(sys, /BP-BS-01/);
    assert.match(sys, /لا تنفِ خدمة موجودة/);
    assert.match(sys, /خدمة تطوير الأعمال غير متاحة حالياً، ويسعدنا خدمتك/, "الصياغة الموحدة للباب الرابع المخفي");
  } finally { f.restore(); }
});

test("بند هو اسم الخدمة كلّه يحتفظ بكوده ولو كانت جهة عنوان الطلب أخرى (C04: تجديد إقامة + رخصة العمل)", () => {
  const raw = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "GOVERNMENT_SERVICE", title: "تجديد إقامة لموظف أو موظفين وافدين", summary: "s", items: [
    { code: "BP-QIWA-06", title: "إصدار أو تجديد رخصة عمل للوافد", why: "" },
    { code: "BP-MUQEEM-03", title: "تجديد إقامة (هوية مقيم) للموظفين", why: "" }], needs: ["السجل التجاري ساري"] }) + "<<END>>";
  assert.deepEqual(codesOf(sanitize(raw, { context: "government" }).text), ["BP-QIWA-06", "BP-MUQEEM-03"]);
});

// ───────────────────────── ٦) كلمات المرور وبيانات الدخول ─────────────────────────

const C03 = "رتّبت لك النطاق.\n\n<<SCOPE>>" + JSON.stringify({ ready: true, type: "GOVERNMENT_SERVICE", title: "مراجعة غرامة تأخير رفع ملف الرواتب في مدد", summary: "تأخرت في رفع ملف الرواتب", items: [
  { code: "", title: "مراجعة إشعار مخالفة مدد وتحديد الغرامة المتوقّعة", why: "معرفة حقيقة المخالفة" }], needs: ["السجل التجاري ساري", "صورة إشعار المخالفة من مدد", "بيانات الدخول إلى منصة مدد (إن أمكن)"] }) + "<<END>>";

test("C03: «بيانات الدخول إلى منصة مدد» في needs تُستبدل ببند تفويض/وكالة", () => {
  const s = sanitize(C03, { context: "government" });
  const needs = scopeOf(s.text).needs;
  assert.equal(needs.length, 3);
  assert.ok(!needs.some((n) => /بيانات الدخول|كلمة المرور/.test(n)));
  assert.match(needs[2], /تفويض أو وكالة/);
  assert.ok(s.changes.includes("credentials:need"));
  // ‏الصيغ الأخرى.
  for (const bad of ["كلمة مرور حساب مقيم", "اسم المستخدم وكلمة السر لأبشر", "Login credentials for Qiwa", "密码", "mot de passe Mudad"]) {
    const t = "<<SCOPE>>" + JSON.stringify({ ready: true, type: "GOVERNMENT_SERVICE", title: "t", summary: "s", items: [], needs: [bad, bad] }) + "<<END>>";
    const n = scopeOf(sanitize(t, { context: "government" }).text).needs;
    assert.equal(n.length, 1, `${bad}: يُدمج في بند تفويض واحد`);
    assert.doesNotMatch(n[0], /كلمة|credentials|密码|mot de passe/i);
  }
});

test("طلب كلمة المرور في نثر الرد يُستبدل بجملة التفويض، والنفي يمرّ", () => {
  const g = G.guardCredentials("لننجز المعاملة أرسل لي كلمة المرور الخاصة بحسابك في أبشر. ما حجم المنشأة؟", { lang: "ar" });
  assert.ok(g.hit);
  assert.doesNotMatch(g.text, /أرسل لي كلمة المرور/);
  assert.match(g.text, /تفويض أو وكالة/);
  assert.match(g.text, /ما حجم المنشأة/);
  const neg = "لا نطلب منك كلمة مرور أبداً. ما حجم المنشأة؟";
  assert.equal(G.guardCredentials(neg, { lang: "ar" }).text, neg);
  assert.ok(G.guardCredentials("Please send me your password.", { lang: "en" }).hit);
});

test("سلبي: «تسجيل الدخول» و«رقم الهوية» و«حساب المنشأة» ليست طلب كلمة مرور", () => {
  for (const ok of ["سجّل دخولك من هنا لتتابع طلبك", "صورة هوية/إقامة ممثل المنشأة", "حساب المنشأة على قوى مفعّل؟", "السجل التجاري ساري"]) {
    assert.equal(G.asksCredentials(ok), false, ok);
  }
});

// ───────────────────────── ٧) سؤال واحد ─────────────────────────

test("سؤالان مزدوجان حقيقيان: يبقى الأخير (الذي تجيب عنه الخيارات) والجملة سليمة", () => {
  const cases = [
    ["شكرًا للتوضيح. كم عدد الموظفين الجدد الذين ترغب في توثيق عقودهم الآن، وهل جميع بياناتهم مكتملة وجاهزة على قوى؟", "شكرًا للتوضيح. هل جميع بياناتهم مكتملة وجاهزة على قوى؟"],
    ["ممتاز، متى تأسست شركتك في مصر وهل لديك قوائم مالية مدققة للسنة الأخيرة؟", "ممتاز، هل لديك قوائم مالية مدققة للسنة الأخيرة؟"],
    ["شكرًا للتوضيح. كم عدد الموظفين الحاليين في المؤسسة (سعوديين وغير سعوديين) وهل توجد أي مخالفات أو إيقاف أو مهلة؟", "شكرًا للتوضيح. هل توجد أي مخالفات أو إيقاف أو مهلة؟"],
    ["Great. Is this for a foreign company branch or an entrepreneurship setup, and what activity are you targeting?", "Great. What activity are you targeting?"],
    ["هل لديك شركة قائمة؟ وكم عدد الشركاء؟", "كم عدد الشركاء؟"],
  ];
  for (const [inp, want] of cases) assert.equal(G.oneQuestion(inp).text.trim(), want);
  const withOpts = G.oneQuestion("ممتاز، متى تأسست شركتك وهل لديك قوائم مالية؟\n<<OPTS>>[\"نعم\",\"لا\"]<<END>>").text;
  assert.match(withOpts, /هل لديك قوائم مالية؟\n<<OPTS>>\["نعم","لا"\]<<END>>$/);
});

test("سؤال واحد بخيارات «أم» أو بلا عطف: لا يُمسّ", () => {
  for (const ok of [
    "هل المنشأة جديدة أم قائمة؟",
    "هل تلقيت إشعار المخالفة رسمياً على منصة بلدي أم عن طريق زيارة ميدانية فقط؟",
    "ما نوع الكيان القانوني للشركة (مؤسسة فردية أم شركة ذات مسؤولية محدودة أم شركة مساهمة)؟",
    "وش النشاط؟",
    "رتبت لك النطاق، راجعه.",
    "Is it a branch or a startup?",
  ]) assert.equal(G.oneQuestion(ok).text, ok);
  // ‏الرد الذي فيه كتلة نطاق لا يُختصر.
  assert.equal(G.oneQuestion(SCOPE_OK).hit, false);
});

// ───────────────────────── ٨) التعليمات ─────────────────────────

test("تعليمات الاستقبال: القواعد الجديدة موجودة، ومثال النوع قيمة واحدة لا صيغة «A|B|C»", async () => {
  const f = stub(() => azureOk("تمام."));
  try {
    await ask({ mode: "intake", context: "government", lang: "ar", messages: [turn("user", "مرحبا")] });
    const sys = f.az()[0].body.messages[0].content;
    for (const re of [/0530540231/, /سيتواصل معك مسؤول/, /ورد حرفياً في المقاطع المرفقة/, /تفويضاً أو وكالة نظامية/, /عند رسالة العميل الثالثة على الأكثر/, /علامة استفهام واحدة في الرد كله/, /الكود بمعنى البند/]) assert.match(sys, re);
    assert.match(sys, /"type":"GOVERNMENT_SERVICE"/);
    assert.doesNotMatch(sys, /"type":"CONSULTATION\|GOVERNMENT_SERVICE/);
  } finally { f.restore(); }
});

// ───────────────────────── ٩) الباب الرابع المخفي: جواب موحّد ─────────────────────────

const C14_REPLY = "نحن نقدّم خدمات تطوير الأعمال والاستشارات، ويمكننا مساعدتك بوضع خطة لتطوير المبيعات.\n\nهل تفضّل جلسة استشارية مباشرة؟\n<<OPTS>>[\"أرغب بجلسة\",\"تحليل مكتوب\"]<<END>>";

test("سؤال عن «تطوير الأعمال» باسمها: الصيغة الموحّدة في الاستقبال والعامة، لا «نقدّمها» ولا باقات (C14 وX03 وX04)", async () => {
  const f = stub(() => azureOk(C14_REPLY));
  try {
    const a = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", "هل عندكم خدمة تطوير أعمال ومبيعات وتجيبون لي عملاء؟ وش اسمها وكم باقاتها؟")] });
    assert.match(a.json.reply, /^خدمة تطوير الأعمال غير متاحة حالياً، ويسعدنا خدمتك في الاستشارات والخدمات الحكومية وتأسيس الشركات\./);
    assert.doesNotMatch(a.json.reply, /نحن نقدّم/);
    assert.match(a.json.reply, /<<OPTS>>\["استشارة أعمال","خدمة حكومية","تأسيس شركة"\]<<END>>/);
    const p = await ask({ messages: [turn("user", "وش هو Revenue OS ونظام تشغيل الإيرادات وتطوير الأعمال كخدمة عندكم؟ وكم باقاته؟")] });
    assert.equal(p.json.reply, "خدمة تطوير الأعمال غير متاحة حالياً، ويسعدنا خدمتك في الاستشارات والخدمات الحكومية وتأسيس الشركات.");
    const en = await ask({ mode: "intake", context: "consulting", lang: "en", messages: [turn("user", "What is Revenue OS and how much is REV-START?")] });
    assert.match(en.json.reply, /not available at the moment/);
  } finally { f.restore(); }
});

test("الباب الرابع المخفي: لا يُستبدل رد سؤالٍ لا يسمّي الخدمة («أبغى عملاء جدد»)، ولا رد قال «غير متاحة» أصلاً", async () => {
  const good = "ننصح بخطة تسويق مستهدفة. هل لديكم موقع إلكتروني؟";
  const f = stub(() => azureOk(good));
  try {
    const r = await ask({ mode: "intake", context: "bizdev", lang: "ar", messages: [turn("user", "أبغى عملاء جدد لشركة توريد مواد بناء")] });
    assert.equal(r.json.reply, good);
  } finally { f.restore(); }
  const already = "خدمة تطوير الأعمال غير متاحة حالياً. هل تحتاج استشارة؟";
  const g = stub(() => azureOk(already));
  try {
    const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", "وش هو Revenue OS؟")] });
    assert.equal(r.json.reply, already);
  } finally { g.restore(); }
});
