// لوحة صاحب العمل — عرض السيرة الذاتية في الصفحة: هل تُهرَّب؟
//
// شغّله: npm test
//
// ما الذي يستحقّ اختباراً هنا:
//
// «أظهر السيرة الذاتية على الموقع» تعني أخذ نصٍّ **كتبه شخصٌ من خارجنا** —
// سيرةٌ رفعها مرشّح، مرّت على استخراج نصّ آلي، وحُفظت في نوشن — ثم وضعه في
// ‏innerHTML داخل لوحةٍ يفتحها صاحب عمل بجلسةٍ مفتوحة. سيرةٌ فيها وسم سكربت
// تصير عندئذٍ تنفيذاً في صفحةٍ ترى متقدّمي صاحب العمل كلهم بأسمائهم وبُرُدهم
// وجوّالاتهم. والخادم لا يحمينا من هذا ولا يجب أن يفعل: هو يعيد النصّ كما هو
// (‏api/candidates.js، ?applicant=1)، والهرب وظيفة الواجهة وحدها.
//
// ولهذا يُقاس هنا على **الصفحة المولَّدة نفسها** لا على نسخةٍ من الدالة في
// الاختبار: تُستخرج esc و cvInl و cvHtml من ‎site/ar/employer.html‎ كما شُحنت
// حرفاً بحرف وتُنفَّذ. فالاختبار يفشل إذا انكسر الهرب في المولِّد، وإذا لم
// يُبنَ المولَّد بعد التعديل أيضاً — وهو المطلوب في الحالتين.
//
// ولا تبعية خارجية: لا jsdom ولا متصفّح. المقيس نصّ HTML يخرج من دالة، لا
// شجرةُ DOM — فـ node:vm يكفي، ولا شيء في هذه الدوال يلمس document.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = path.join(ROOT, "site", "ar", "employer.html");

const html = fs.readFileSync(PAGE, "utf8");

// تُقتطع كل دالة من أول سطرها إلى آخر سطرٍ فيها — والعلامة الفاصلة هي سطر
// التعريف التالي، لا قوسٌ مُعَدّ. لو أُعيدت تسمية إحداها فشل الاقتطاع صريحاً
// برسالةٍ تقول أيّها، بدل أن يمرّ الاختبار على نصٍّ فارغ.
function grab(name, endsBefore) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `لم تُوجد ${name} في الصفحة المولَّدة — أُعيدت تسميتها أو لم يُبنَ المولِّد`);
  const end = html.indexOf(endsBefore, start);
  assert.notEqual(end, -1, `لم يُوجد نهاية ${name} (${endsBefore})`);
  return html.slice(start, end);
}

const src = [
  grab("esc", "\nfunction show("),
  grab("cvInl", "\nfunction cvHtml("),
  grab("cvHtml", "\n// رقاقة"),
].join("\n");

const ctx = { out: null };
vm.createContext(ctx);
vm.runInContext(src + "\nout={esc:esc,cvInl:cvInl,cvHtml:cvHtml};", ctx);
const { esc, cvHtml } = ctx.out;

test("esc المُشحونة تهرّب المحارف الخمسة", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("نصّ سيرةٍ فيه <script> يخرج هرباً ولا يبقى وسماً", () => {
  const out = cvHtml("# <script>alert('xss')</script>\n\n- <img src=x onerror=alert(1)>");
  // لا وسم تنفيذٍ ولا وسم صورةٍ بحادثة في المخرَج، بأي حالة أحرف.
  assert.ok(!/<script/i.test(out), "نجا وسم script إلى المخرَج:\n" + out);
  assert.ok(!/<\/script/i.test(out), "نجا وسم إغلاق script إلى المخرَج");
  assert.ok(!/<img/i.test(out), "نجا وسم img إلى المخرَج:\n" + out);
  assert.ok(!/onerror/i.test(out) || /&lt;img/.test(out), "نجا onerror داخل وسمٍ حقيقي");
  // ويظهر النصّ للقارئ مهرَّباً، لا محذوفاً: صاحب العمل يرى ما في السيرة.
  assert.ok(out.includes("&lt;script&gt;"), "لم يُهرَّب الوسم بل اختفى:\n" + out);
  assert.ok(out.includes("&lt;img src=x onerror=alert(1)&gt;"), "اختفى سطر القائمة بدل أن يُهرَّب");
  // والبنية تبقى: العنوان عنواناً والنقطة نقطة.
  assert.ok(out.startsWith("<h4>"), "لم يُبنَ العنوان: " + out.slice(0, 40));
  assert.ok(out.includes("<li>"), "لم تُبنَ نقطة القائمة");
});

test("محاولة كسر السمة بعلامة تنصيص أو حرفٍ مفرد لا تفتح وسماً", () => {
  const out = cvHtml(`- " onmouseover="alert(1)`);
  assert.ok(!out.includes('"'), "نجت علامة تنصيص خام إلى المخرَج: " + out);
  assert.ok(out.includes("&quot;"), "لم تُهرَّب علامة التنصيص: " + out);
});

test("البنية المقروءة تُبنى: عنوانان وقائمة وعريض", () => {
  const out = cvHtml("# سعود\n\n## الخبرة\n- محاسب — **خمس سنوات**\n\nنصّ فقرة.");
  assert.ok(out.includes("<h4>سعود</h4>"), out);
  assert.ok(out.includes("<h5>الخبرة</h5>"), out);
  assert.ok(out.includes("<strong>خمس سنوات</strong>"), "لم يُبنَ العريض من **…**");
  assert.ok(out.includes("<ul>") && out.includes("</ul>"), "القائمة غير مغلقة");
  assert.ok(out.includes("<p>نصّ فقرة.</p>"), out);
  // ‏<strong> وحده يُعاد بناؤه؛ فما عداه يبقى نصّاً — وهذا هو حدّ الثقة.
  assert.ok(!/<(?!\/?(h4|h5|ul|li|p|strong)\b)/i.test(out), "خرج وسمٌ خارج القائمة المسموحة:\n" + out);
});

test("سطرٌ فارغ بين نقطتين لا يقسم القائمة قائمتين", () => {
  // تصدير Drive يضع فراغاً بين كل نقطتين؛ إغلاق القائمة عنده يقسم كل نقطة.
  const out = cvHtml("- الأولى\n\n- الثانية\n\n- الثالثة");
  assert.equal((out.match(/<ul>/g) || []).length, 1, "انقسمت القائمة: " + out);
  assert.equal((out.match(/<li>/g) || []).length, 3, out);
});

test("الفراغ يعطي سلسلةً فارغة لا خطأً ولا «undefined»", () => {
  for (const v of ["", null, undefined, "   \n\n  "]) {
    assert.equal(cvHtml(v), "", "قيمة فارغة أعطت مخرَجاً: " + JSON.stringify(cvHtml(v)));
  }
});

// ── الواجهة: هل الشاشة موجودة فعلاً في الصفحة المشحونة؟ ────────────────────
// ملخّص الوكيل يقول ما نواه؛ هذه تقرأ ما شُحن.
test("شاشة ملف المرشّح تحمل حاوية التفاصيل ورقاقاتها وحالات الفراغ", () => {
  for (const needle of [
    'id="candDet"', 'id="candChips"',           // الحاويتان اللتان يُكتب فيهما
    "applicant=1&id=", "loadCandDet(c)",         // الجلب عند الفتح لا عند الإقلاع
    ".sv1-pill.warn", ".sv1-pill.bad",           // لونا «اشتراطات» و«ممنوع»
    ".sv1-cv{",                                  // إطار السيرة المعروضة
  ]) assert.ok(html.includes(needle), "غائب عن الصفحة المولَّدة: " + needle);
  // حالات الفراغ الثلاث مكتوبةً بالعربية في نصوص الصفحة.
  for (const phrase of ["السيرة لم تُقرأ بعد", "لا ملف أصلي محفوظ", "لم تُقيَّم بعد", "لم يُفحص"]) {
    assert.ok(html.includes(phrase), "حالة فراغٍ غائبة: " + phrase);
  }
  // الجملة التي تمنع زرّاً يَعِد بما لا يفتح.
  assert.ok(html.includes("قد يطلب Google صلاحية الوصول"), "غاب تنبيه صلاحية الملف الأصلي");
  // أسماء خيارات نوشن كما هي — لا تُترجم ولا تُحسب.
  for (const opt of ["مسموح لغير السعوديين", "مقصورة على السعوديين", "✅ مطابق", "⛔ مهنة سعودية - غير سعودي"]) {
    assert.ok(html.includes(opt), "غاب خيار نوشن من خريطة الألوان: " + opt);
  }
});

// ── الدرس الذي كلّف هذه الجلسة تشخيصاً ────────────────────────────────────
// أُضيفت هنا مفاتيح T اسمها scoreL و scoreNo، وكانا مأخوذين أصلاً لشاشة
// المطابقة الذكية. المفتاح المكرّر في كائنٍ حرفي واحد يطمس الأول **بلا خطأ
// بناءٍ ولا تحذير**: البناء نجح، الصفحة بُنيت، وشاشةٌ أخرى تغيّر نصّها بصمت.
// وجدولٌ فيه ٢٣٤ مفتاحاً في ملفٍ واحد يجعل هذا مسألةَ وقتٍ لا احتمالاً.
test("جدول T بلا مفتاحٍ مكرّر — المكرّر يطمس الأول بصمت", () => {
  const src = fs.readFileSync(path.join(ROOT, "site", "scripts", "simple-v1-employer.mjs"), "utf8");
  const at = src.indexOf("const T = {");
  assert.notEqual(at, -1, "لم يُوجد جدول T");
  const body = src.slice(at, src.indexOf("\n};", at));
  const keys = [...body.matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*)\s*:\s*\{/gm)].map((m) => m[1]);
  assert.ok(keys.length > 200, "لم تُقرأ مفاتيح T (قُرئ " + keys.length + ")");
  const seen = new Set(), dup = [];
  for (const k of keys) { if (seen.has(k)) dup.push(k); seen.add(k); }
  assert.deepEqual(dup, [], "مفاتيح مكرّرة في T: " + dup.join("، "));
});

test("اللغات الأربع: النصوص الجديدة مُترجَمة في كل صفحة", () => {
  const pages = {
    en: "site/employer.html", fr: "site/fr/employer.html", zh: "site/zh/employer.html",
  };
  const want = {
    en: ["Full CV text", "Not scored yet", "Not checked", "Original CV (as uploaded)"],
    fr: ["Texte complet du CV", "Pas encore évalué", "Non vérifié"],
    zh: ["简历全文", "尚未评分", "未核查"],
  };
  for (const [lang, rel] of Object.entries(pages)) {
    const p = path.join(ROOT, rel);
    assert.ok(fs.existsSync(p), "صفحة غائبة: " + rel);
    const s = fs.readFileSync(p, "utf8");
    for (const phrase of want[lang]) {
      assert.ok(s.includes(phrase), `${rel}: غائب «${phrase}» — سلسلةٌ لم تُترجَم`);
    }
    // ولا نصَّ عربيٍّ مكتوبٍ في واجهة اللغات الأخرى بدل الترجمة.
    assert.ok(!s.includes("تحميل السيرة الأصلية"), rel + ": سُرِّبت السلسلة العربية إلى واجهةٍ أخرى");
  }
});
