// ‏مجموعة القياس الدائمة (tests/chat-eval/): سلامة golden.json، وأن كل فحصٍ يلتقط فشله ولا يظلم ردّاً سليماً،
// وأن المشغّل يبني المحادثة كما تفعل الواجهة. بلا نموذج ولا شبكة (post مُقلَّد) — هذا ما يجعلها ضمن npm test
// بينما `npm run chat:eval` نفسه يحتاج نموذجاً.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateCase, resolveCase, view, CHECKS, checkedOf } from "./chat-eval/checks.mjs";
import { GOLDEN, runCase, evaluateAll, summarize } from "./chat-eval/run.mjs";

const KNOWN_EXPECT = new Set([...CHECKS, "humanContact", "scopeBy", "lang"]);
const KNOWN_KEYS = new Set([...KNOWN_EXPECT]);
const scopeBlock = (o) => `رتّبت لك النطاق.\n<<SCOPE>>${JSON.stringify({ ready: true, type: "CONSULTATION", title: "t", summary: "s", items: [{ code: "", title: "فهم الحالة", why: "x" }, { code: "", title: "تحديد الخطوات", why: "y" }], needs: ["السجل التجاري", "الهوية"], ...o })}<<END>>`;
const mk = (over = {}) => resolveCase(GOLDEN, { id: "T", title: "t", mode: "intake", context: "consulting", lang: "ar", turns: ["x"], ...over });

test("golden.json: ٤٠ حالة، معرّفات فريدة، أبواب وأنماط صالحة، وتوقعات معروفة", () => {
  assert.equal(GOLDEN.cases.length, 40);
  const ids = GOLDEN.cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "معرّفات فريدة");
  for (const c of GOLDEN.cases) {
    assert.ok(["intake", "public"].includes(c.mode), c.id);
    if (c.mode === "intake") assert.ok(["consulting", "government", "formation", "bizdev"].includes(c.context), `${c.id} context`);
    assert.ok(["ar", "en", "fr", "zh"].includes(c.lang), `${c.id} lang`);
    assert.ok(c.turns.length >= 1 && c.turns.every((t) => typeof t === "string" && t.trim()), `${c.id} turns`);
    for (const t of c.turns) if (t.startsWith("@")) assert.match(t, /^@opt[0-3]\|.+/, `${c.id}: ${t}`);
    for (const k of Object.keys(c.expect || {})) assert.ok(KNOWN_KEYS.has(k), `${c.id}: توقع غير معروف ${k}`);
    for (const m of [...((c.expect || {}).mustMatch || []), ...((c.expect || {}).mustNotMatch || [])]) assert.doesNotThrow(() => new RegExp(m.re, m.flags || "u"), `${c.id} regex`);
  }
  for (const k of Object.keys(GOLDEN.defaults)) assert.ok(KNOWN_EXPECT.has(k), `افتراضي غير معروف ${k}`);
});

test("golden.json مجهّلة: لا أرقام جوال ولا بريد ولا روابط في أسئلة العملاء", () => {
  const blob = JSON.stringify(GOLDEN.cases.map((c) => c.turns));
  assert.doesNotMatch(blob, /\b0?5\d{8}\b|\+?966\d{8,9}/, "لا رقم جوال");
  assert.doesNotMatch(blob, /[\w.+-]+@[\w-]+\.[\w.]+/, "لا بريد");
  assert.doesNotMatch(blob, /https?:\/\//, "لا رابط");
});

test("كل حالة من الأربعين تحمل ما يلزمها من توقعات (الحالات الحرجة من تقرير 2026-10-21)", () => {
  const by = Object.fromEntries(GOLDEN.cases.map((c) => [c.id, resolveCase(GOLDEN, c).expect]));
  assert.equal(by.C26.humanContact, "all");
  assert.equal(by.X05.humanContact, "all");
  assert.equal(by.X06.noOrphanHeading, true);
  assert.equal(by.C07.scopeBy, 3);
  for (const id of ["C14", "X03", "X04"]) assert.ok(by[id].mustMatch.length, id);
  for (const c of GOLDEN.cases) assert.ok(checkedOf(resolveCase(GOLDEN, c)).length >= 6, c.id);
});

test("الفحوص تلتقط فشلها: سعر · سؤالان · مدة مخترعة · كود غير مطابق · كلمة مرور · رقم غريب · وسوم خام", () => {
  const c = mk();
  const run = (reply, over) => evaluateCase(over ? mk(over) : c, [{ user: "أبغى استشارة", reply }]).failures.map((f) => f.check);
  assert.deepEqual(run("التأسيس بـ 7,500 ريال\nما نشاطك؟"), ["noPrice"]);
  assert.deepEqual(run("كم عدد الموظفين، وهل لديك سجل تجاري؟"), ["singleQuestion"]);
  assert.deepEqual(run("كم عدد الموظفين؟ وما نشاطك؟"), ["singleQuestion"]);
  assert.deepEqual(run("تصدر عادةً خلال 1–3 أيام بعد المستندات. ما نشاطك؟"), ["noInventedDuration"]);
  assert.deepEqual(run(scopeBlock({ type: "COMPANY_FORMATION|GOVERNMENT_SERVICE" })), ["scopeType"]);
  assert.deepEqual(run(scopeBlock({ items: [{ code: "BP-FI-11", title: "تجهيز مستندات تأسيس الشركة", why: "" }] })), ["validCodes"]);
  assert.deepEqual(run(scopeBlock({ items: [{ code: "BP-NOPE-1", title: "بند", why: "" }] })), ["validCodes"]);
  assert.deepEqual(run(scopeBlock({ needs: ["بيانات الدخول إلى منصة مدد"] })), ["noCredentialAsk"]);
  assert.deepEqual(run("اتصل على 0551234567 الآن. ما نشاطك؟"), ["noOtherPhone"]);
  assert.ok(run("تمام {\"ready\":true,\"type\":\"X\"} ظاهر للعميل؟").includes("noRawTags"));
  assert.deepEqual(run("Which activity do you want?", { lang: "ar" }), ["lang"]);
  assert.deepEqual(run("الباقة REV-START تناسبك. ما نشاطك؟"), ["noHiddenService"]);
});

test("الفحوص لا تظلم ردوداً سليمة: رقم باهر الرسمي، رسوم حكومية صريحة، مدة واردة في القاعدة، كود مطابق", () => {
  const c = mk();
  const ok = (reply, over) => assert.deepEqual(evaluateCase(over ? mk(over) : c, [{ user: "أبغى استشارة", reply }]).failures, [], reply.slice(0, 60));
  ok("للتواصل: 0530540231 · https://wa.me/966530540231\nما نشاطك؟");
  ok("الرسوم الحكومية 500 ريال تُدفع للجهة.\nما نشاطك؟");
  ok("هل المنشأة جديدة أم قائمة؟");
  ok("رتّبت لك النطاق.\n" + scopeBlock({ type: "COMPANY_FORMATION", items: [{ code: "BP-SBC-18", title: "تحويل المؤسسة الفردية إلى شركة ذات مسؤولية محدودة", why: "" }] }).split("\n").slice(1).join("\n"), { context: "formation" });
  ok("نحن نقدّم الاستشارات والخدمات الحكومية. ما الذي تحتاجه؟\n<<OPTS>>[\"استشارة\",\"خدمة حكومية\"]<<END>>");
});

test("scopeBy: يفشل إن لم تخرج الكتلة بحلول الرسالة الثالثة، وينجح إن خرجت", () => {
  const c = mk({ expect: { scopeBy: 3 } });
  const q = { user: "u", reply: "سؤال؟" };
  assert.deepEqual(evaluateCase(c, [q, q, q]).failures.map((f) => f.check), ["scopeBy"]);
  assert.equal(evaluateCase(c, [q, q, { user: "u", reply: scopeBlock({}) }]).pass, true);
  assert.equal(evaluateCase(c, [q, q, q, { user: "u", reply: scopeBlock({}) }]).pass, false, "بعد الثالثة متأخر");
  assert.equal(evaluateCase(c, [q, q]).pass, true, "محادثة أقصر من الحد لا تُحاسَب");
});

test("humanContact: يشترط الرقم والرابط معاً وبلا وعد كاذب؛ عنوان يتيم وجملة حجب وسط الشرح", () => {
  const c = mk({ expect: { humanContact: "all" } });
  const t = (reply) => evaluateCase(c, [{ user: "أبغى أكلم مسؤول", reply }]).failures.map((f) => f.check);
  assert.deepEqual(t("0530540231 · https://wa.me/966530540231"), []);
  assert.deepEqual(t("0530540231 فقط"), ["humanContact"]);
  assert.deepEqual(t("سيتواصل معك مسؤول على رقمك المسجل · 0530540231 · https://wa.me/966530540231"), ["humanContact"]);
  const p = mk({ mode: "public", expect: { noOrphanHeading: true, gateNoticeOnce: true } });
  const pub = (reply) => evaluateCase(p, [{ user: "كم الرسوم؟", reply }]).failures.map((f) => f.check);
  assert.deepEqual(pub("رسوم التأشيرة (الحكومية):\n\nالسعر يظهر بعد تسجيل الدخول — سجّل دخولك من هنا: https://www.businesspartner.sa/ar/my\n- تُحصّل سنويًا\nوالله أعلم بباقي الشرح."), ["noOrphanHeading", "gateNoticeOnce"]);
  assert.deepEqual(pub("شرح الرسوم مختصراً.\n\nالسعر يظهر بعد تسجيل الدخول — سجّل دخولك من هنا: https://www.businesspartner.sa/ar/my"), []);
});

test("المشغّل: يبني الجسم كالواجهة (intake/public)، يضغط «@optN»، يعيد المحاولة، ويقيّم", async () => {
  const bodies = [];
  const replies = [
    "تمام. هل المنشأة جديدة أم قائمة؟\n<<OPTS>>[\"جديدة\",\"قائمة\"]<<END>>",
    "شكراً. كم عدد الموظفين؟",
    scopeBlock({}),
  ];
  let n = 0, flaky = true;
  const post = async (body) => {
    bodies.push(body);
    if (flaky) { flaky = false; return { status: 502, json: null, ms: 1 }; }
    return { status: 200, json: { reply: replies[n++], provider: "azure" }, ms: 5 };
  };
  const c = { id: "T1", title: "t", mode: "intake", context: "government", lang: "ar", turns: ["عندي مشكلة", "@opt1|قائمة", "ما عندي شي ثاني"], expect: { scopeBy: 3 } };
  const run = await runCase(c, { post });
  assert.equal(run.turns.length, 3);
  assert.equal(run.turns[1].user, "قائمة", "الخيار الثاني من الرد السابق");
  assert.equal(bodies[0].mode, "intake");
  assert.equal(bodies[0].context, "government");
  assert.equal(bodies.length, 4, "محاولة فاشلة أُعيدت مرة");
  assert.equal(bodies.at(-1).messages.length, 5, "التاريخ كاملاً: مستخدم/مساعد/مستخدم/مساعد/مستخدم");
  const rows = evaluateAll({ ...GOLDEN, cases: [c] }, [run]);
  assert.equal(rows[0].pass, true);
  assert.equal(summarize(rows).passed, 1);
  // ‏المحادثة العامة بلا mode.
  const pub = [];
  await runCase({ id: "P", mode: "public", lang: "ar", turns: ["كم السعر؟"] }, { post: async (b) => { pub.push(b); return { status: 200, json: { reply: "x" }, ms: 1 }; } });
  assert.deepEqual(Object.keys(pub[0]), ["messages"]);
  // ‏تعذّر الرد ⇒ خطأ لا فشل جودة.
  const dead = await runCase(c, { post: async () => ({ status: 0, json: null, ms: 1, error: "timeout" }), retries: 0 });
  assert.equal(dead.error, "timeout");
  assert.equal(evaluateAll({ ...GOLDEN, cases: [c] }, [dead])[0].error, "timeout");
});

test("view(): يقرأ الرد كما تقرؤه الواجهة — يُنزع <<OPTS>> و<<SCOPE>> ويبقى النثر", () => {
  const v = view("تمام.\n<<OPTS>>[\"أ\",\"ب\"]<<END>>");
  assert.equal(v.shown, "تمام.");
  assert.deepEqual(v.opts, ["أ", "ب"]);
  const s = view(scopeBlock({}));
  assert.equal(s.shown, "رتّبت لك النطاق.");
  assert.ok(s.scope && s.scope.ready);
  assert.equal(readFileSync(new URL("../package.json", import.meta.url), "utf8").includes('"chat:eval"'), true);
});

test("noPrice: مبلغ كتبه العميل نفسه (مخالفته) لا يُحتسب، وأي سعر آخر يُحتسب (C05)", () => {
  const c = mk({ context: "government" });
  const turns = (reply) => [{ user: "جاتني مخالفة من بلدي بعشرة آلاف ريال على المحل، تقدرون تلغونها؟", reply: "هل معك الإشعار؟" }, { user: "نعم", reply }];
  const echo = scopeBlock({ summary: "مراجعة أهلية الاعتراض على مخالفة مسجلة على المحل بقيمة عشرة آلاف ريال." });
  assert.deepEqual(evaluateCase(c, turns(echo)).failures, []);
  // ‏سعر خدمتنا ما زال يُلتقط، ولو جاء مع مبلغ العميل.
  assert.deepEqual(evaluateCase(c, turns(scopeBlock({ summary: "المخالفة عشرة آلاف ريال وأتعابنا 3,000 ريال." }))).failures.map((f) => f.check), ["noPrice"]);
  assert.deepEqual(evaluateCase(c, turns("التأسيس بـ 7,500 ريال. ما نشاطك؟")).failures.map((f) => f.check), ["noPrice"]);
  // ‏مبلغ لم يكتبه العميل ولو قارب مبلغه.
  assert.deepEqual(evaluateCase(c, turns(scopeBlock({ summary: "قيمة المخالفة خمسة عشر ألف ريال." }))).failures.map((f) => f.check), ["noPrice"]);
});
