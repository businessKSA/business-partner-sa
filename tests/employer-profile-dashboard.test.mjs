// لوحة ملف المرشّح بمربّعات، وشاشة المطابقة — على الصفحة المولَّدة نفسها (2026-10-01)
//
// شغّله: npm test
//
// كما في employer-cv-render: تُستخرج الدوال من ‎site/ar/employer.html‎ كما شُحنت وتُنفَّذ في
// node:vm بلا jsdom ولا متصفّح. المقيس ما يخرج من الدوال (نصّ HTML)، فالاختبار يفشل إن
// انكسرت البنية في المولِّد أو لم يُبنَ المولِّد بعد التعديل.
//
// ما يستحقّ القياس هنا:
//  ① كل مربّعٍ مطلوب موجود، من الحقول المنظَّمة؛ وما لا قيمة له «—» لا فراغ ولا صفر ولا
//     «undefined/null/NaN».
//  ② نصّ السيرة الكامل في قسمٍ مطويّ في الأسفل — لا في الواجهة الأولى — ومهرَّب.
//  ③ «تحميل السيرة الأصلية» عند وجود ملفٍ فقط، ومعه التحذير الصادق بأن Drive قد لا يكون مشتركاً.
//  ④ الدرجة لا تُرسم بلا مبرّرٍ مكتوب (لا «٠/١٠٠» من null)، ولا تُرسم لسجلٍّ لا درجة له.
//  ⑤ التقييم دفعاتٌ ≤٥، والخصائص المنطقية وحدها في CSS الجديد (يصحّ في RTL وLTR).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "site", "ar", "employer.html"), "utf8");

function between(from, to, why) {
  const a = html.indexOf(from);
  assert.notEqual(a, -1, `غائب عن الصفحة المولَّدة: ${why || from}`);
  const b = html.indexOf(to, a);
  assert.notEqual(b, -1, `لم تُوجد نهاية ${why || from}: ${to}`);
  return html.slice(a, b);
}
const TX = JSON.parse(/var TX=(\{.*?\}),HOME=/s.exec(html)[1]);

const src = [
  between("function esc(", "\nfunction show(", "esc"),
  between("var SPLIT=", "\n", "SPLIT"),
  between("function cvInl(", "\nfunction cvHtml(", "cvInl"),
  between("function cvHtml(", "\n// رقاقة", "cvHtml"),
  between("var SAUD_CLS=", "\nvar detSeq=0", "SAUD_CLS..stChip"),
  between("function nil(){", "\nfunction openCand(", "لوحة المربّعات"),
].join("\n");

const els = {};
const stub = (id) => (els[id] ||= { innerHTML: "", textContent: "" });
const ctx = { TX, $: stub, out: null };
vm.createContext(ctx);
vm.runInContext(src + "\nout={drawCandDet:drawCandDet,expTxt:expTxt,dlUrl:dlUrl};", ctx);
const { drawCandDet, expTxt, dlUrl } = ctx.out;
const draw = (c, d) => { els.candDet = { innerHTML: "" }; els.candHead = { innerHTML: "" }; els.candChips = { innerHTML: "" }; drawCandDet(c, d); return els.candDet.innerHTML; };

const FULL = {
  name: "سعود العتيبي", role: "محاسب أول", originalPosition: "Senior Accountant", field: "محاسبة ومالية",
  city: "الرياض", country: "السعودية", experience: "6", education: "بكالوريوس",
  skills: "محاسبة, إكسل, ERP", languages: "العربية، الإنجليزية", nationalityType: "غير سعودي", nationality: "هندي",
  residenceStatus: "مقيم بإقامة نظامية قابلة للنقل", availability: "فوري", region: "خبرة سعودية", countries: ["السعودية", "الإمارات"],
  saudization: "مسموح لغير السعوديين", compliance: "✅ مطابق", saudizationDetails: "المهنة مفتوحة.",
  cvText: "# سعود\n\n- خبرة <script>alert(1)</script>", cvLink: "https://drive.google.com/file/d/ABC123/view",
  atsDocUrl: "https://docs.google.com/document/d/X/edit", phone: "0500000000", email: "a@b.co",
  score: 82, scoreReason: "خبرة مطابقة في المجال نفسه.", scoredFor: "محاسب أول (id)", registered: "2026-09-12T00:00:00.000Z",
};

test("① كل المربّعات المطلوبة موجودة وعناوينها عربية", () => {
  const out = draw({}, FULL);
  for (const t of ["الملخّص", "التعليم", "الخبرة", "المهارات", "اللغات", "الموقع", "الجنسية والإقامة", "التوطين والامتثال", "الدرجة وسببها", "التواصل", "السيرة الأصلية"]) {
    assert.ok(out.includes(`<h5>${t}</h5>`), `غاب مربّع «${t}»`);
  }
  assert.equal((out.match(/class="sv1-pf-t/g) || []).length, 11);
  for (const v of ["بكالوريوس", "الرياض", "هندي", "خبرة سعودية", "فوري", "المهنة مفتوحة.", "العربية", "ERP"]) assert.ok(out.includes(v), `القيمة غائبة: ${v}`);
  assert.ok(out.includes(">82<") || out.includes("82 <small>"), "الدرجة غائبة");
  assert.ok(out.includes("خبرة مطابقة في المجال نفسه."), "مبرّر الدرجة غائب");
});

test("① ب ما لا قيمة له يُرسم «—» — لا فراغ ولا undefined ولا null ولا NaN ولا «0 سنة»", () => {
  const out = draw({}, { experience: "0", countries: [] });
  assert.ok((out.match(/class="nil">—</g) || []).length >= 8, "الحقول الفارغة لم تُرسم «—»");
  assert.ok(!/undefined|null|NaN/.test(out), "قيمةٌ خام تسرّبت: " + out.match(/.{20}(undefined|null|NaN).{20}/));
  assert.ok(!out.includes("0 سنة"), "الصفر عُرض خبرةً");
  assert.equal(expTxt("0"), "");
  assert.equal(expTxt(""), "");
  assert.equal(expTxt("6"), "6 سنة");
  assert.ok(out.includes("لم تُقيَّم بعد"), "غابت حالة «بلا درجة»");
});

test("② نصّ السيرة الكامل في قسمٍ مطويّ بعد الشبكة، ومهرَّب", () => {
  const out = draw({}, FULL);
  const gridEnd = out.indexOf("</div><details");
  const det = out.indexOf('<details class="sv1-pf-full">');
  assert.ok(det > 0 && gridEnd > 0 && det > out.indexOf('class="sv1-pf-grid"'), "القسم المطويّ ليس بعد الشبكة");
  assert.ok(!/<details[^>]*\sopen/.test(out), "القسم مفتوحٌ افتراضاً");
  assert.ok(out.indexOf("خبرة &lt;script&gt;") > det, "نصّ السيرة خارج القسم المطويّ");
  assert.ok(!out.includes("<script"), "وسم script نجا");
  assert.ok(out.includes("نصّ السيرة الكامل"));
});

test("③ زرّ التحميل عند وجود الملف الأصلي فقط، والتحذير الصادق باقٍ", () => {
  const withFile = draw({}, FULL);
  assert.ok(withFile.includes("تحميل السيرة الأصلية"));
  assert.ok(withFile.includes("https://drive.google.com/uc?export=download&amp;id=ABC123"), "لم يُحوَّل رابط Drive إلى تنزيل");
  assert.ok(withFile.includes("قد يطلب Google صلاحية الوصول"), "غاب تنبيه أن الملف غير مشترك");
  const none = draw({}, { ...FULL, cvLink: "", atsDocUrl: "" });
  assert.ok(!none.includes("تحميل السيرة الأصلية") && none.includes("لا ملف أصلي محفوظ"));
  assert.equal(dlUrl("https://example.com/cv.pdf"), "https://example.com/cv.pdf");
});

test("④ الدرجة بلا مبرّر تُقال بلا مبرّرها، ولا درجة تُرسم من null", () => {
  const bare = draw({}, { ...FULL, scoreReason: "" });
  assert.ok(bare.includes("لا مبرّر مكتوب لهذه الدرجة"));
  const none = draw({}, { ...FULL, score: null, scoreReason: "" });
  assert.ok(!/<span class="big">null|0 <small>\/ 100/.test(none));
  assert.ok(none.includes("لم تُقيَّم بعد"));
});

test("④ ب بطاقة المطابقة: الدرجة بلا مبرّرٍ لا تُرسم", () => {
  const pieces = [
    between("var MT={", "\nfunction jk(", "MT"),
    between("function jk(", "\nfunction mtJobSel(", "jk"),
    between("var CK={", "\nfunction mkItem(", "جداول المطابقة"),
    between("function mkItem(", "\nfunction critLine(", "mkItem"),
    between("function mtCard(", "\nfunction drawMtBar(", "mtCard"),
    between("function initials(", "\nfunction cardHtml(", "initials"),
    between("function nil(){", "\nfunction listOf(", "nil"),
    between("function expTxt(", "\n// تنزيل الملف", "expTxt"),
  ].join("\n");
  const c2 = { TX, byId: {}, esc: ctx.esc, out: null };
  vm.createContext(c2);
  vm.runInContext(between("function esc(", "\nfunction show(") + "\n" + pieces + "\nout={mkItem:mkItem,mtCard:mtCard,okScore:okScore,isScored:isScored};", c2);
  const { mkItem, mtCard, okScore, isScored } = c2.out;
  const base = { id: "x", name: "فلان", role: "محاسب", city: "الرياض" };
  // محفوظ بمبرّر ⇒ تُرسم.
  const ok = mkItem({ ...base, match: { score: 77, reason: "سبب مكتوب كافٍ", confidence: "low", confidenceWhy: "نصّ السيرة قصير" } });
  assert.ok(isScored(ok) && mtCard(ok).includes("<b>77</b>") && mtCard(ok).includes("سبب مكتوب كافٍ") && mtCard(ok).includes("ثقة منخفضة"));
  // درجة بلا سبب ⇒ لا تُرسم ولا تُعدّ مُقيَّمة.
  const noWhy = mkItem({ ...base, match: { score: 90, reason: "  " } });
  assert.equal(isScored(noWhy), false);
  assert.ok(!mtCard(noWhy).includes("<b>90</b>"));
  // درجة null/عنصرٌ بلا match ⇒ لا «0».
  const nul = mkItem({ ...base, match: { score: null, reason: "سبب" } });
  assert.equal(okScore(nul), false);
  assert.ok(!mtCard(nul).includes("<b>0</b>") && !mtCard(nul).includes("<b>null</b>"));
  assert.ok(mtCard(mkItem(base)).includes("لم يُقيَّم بعد"));
  // المعايير مستوفى/ناقص/غير معروف بلا نسبة.
  const withChecks = mkItem({ ...base, checks: [{ key: "field", status: "met", detail: "محاسبة" }, { key: "city", status: "missing", detail: "جدة" }, { key: "experience", status: "unknown" }] });
  const card = mtCard(withChecks);
  assert.ok(card.includes("sv1-pill ok") && card.includes("sv1-pill bad") && card.includes("sv1-pill off"));
  assert.ok(!/%/.test(card), "نسبةٌ مئوية في بطاقة المطابقة");
});

test("⑤ التقييم بدفعات ≤٥، مع إيقافٍ واستئنافٍ وعدّادٍ صادق", () => {
  const loop = between("$('mtScoreGo').onclick=function(){", "$('mtStop').onclick", "حلقة التقييم");
  assert.ok(/isTodo\)\.slice\(0,5\)/.test(loop), "الدفعة ليست مقسومةً على خمسة");
  assert.ok(loop.includes("MT.stop") && loop.includes("MT.proc+=batch.length") && loop.includes("MT.total=MT.proc+todo.length"));
  assert.ok(html.includes('id="mtStop"') && html.includes('id="mtProgBar"'));
  for (const p of ["قيّم المعروضين (٥ في كل دفعة)", "استئناف التقييم", "جرت معالجة {a} من {b}"]) assert.ok(html.includes(p), p);
  // الكلفة والمسمّى: «المستشار الذكي» لا «الوكيل».
  const mt = between('<div id="scMatch"', '<div id="scPool"', "شاشة المطابقة");
  assert.ok(!/الوكيل/.test(mt));
});

test("⑥ CSS اللوحة الجديد بخصائص منطقية فقط (يصحّ في RTL وLTR)", () => {
  const css = between("ملف المرشّح: لوحة مربّعات", "</style>", "CSS اللوحة");
  assert.ok(css.includes(".sv1-pf-grid{") && css.includes(".sv1-pf-t{") && css.includes(".sv1-pf-full"));
  assert.ok(!/(^|[;{\s])(left|right)\s*:/.test(css), "خاصية left/right فيزيائية");
  assert.ok(!/(margin|padding|border)-(left|right)/.test(css), "هامش/حشوة فيزيائية");
  assert.ok(!/text-align:\s*(left|right)/.test(css));
  assert.ok(/@media\(max-width:640px\)\{\.sv1-pf-t\.w2\{grid-column:auto\}\}/.test(css), "لا انهيار للجوال");
});

test("⑦ لا localStorage ولا sessionStorage في الشاشات الجديدة", () => {
  const s = between("var detSeq=0", "$('acctBox').addEventListener", "كود الشاشات");
  assert.ok(!/localStorage|sessionStorage/.test(s));
});
