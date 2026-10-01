// حارس «القسم المقيَّد» في api/_knowledge.js.
//
// قسم «تطوير الأعمال كخدمة (Revenue OS)» أُضيف إلى knowledge.json بكلمات عامة
// جداً («أعمال»، «عملاء»، «شركات»، «خدمة») فأزاح أقساماً صحيحة في ٧ من ٢٠ رسالة
// من الأبواب القديمة. الإصلاح: القسم موسوم `<!--gate:bizdev-->` فلا ينافس
// بالدرجات أصلاً، ويُضمّ فقط لباب bizdev أو لسؤالٍ بعبارةٍ خاصة به.
//
// المعيار الذي يحرسه هذا الملف:
//   ١) أي سؤال لا نيّة تطوير أعمال فيه → ناتج pickKnowledge **هو نفسه حرفاً**
//      ناتجه على قاعدةٍ لا قسم فيها (القسم منزوعٌ فعلاً من النص).
//   ٢) أي سؤال فيه نيّة تطوير الأعمال، أو يأتي من باب bizdev → يضمّ القسم.
//   ٣) الميزانية لا تُتجاوز، ولا وسم بوّابة يتسرّب إلى نصّ يصل النموذج.
//
// الأسئلة مُصدَّرة ليقيس بها من يشاء قبل/بعد أي تعديل لاحق على المعرفة.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makePicker, pickKnowledge } from "../api/_knowledge.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(HERE, "..", "api", "knowledge.json"), "utf8"));
const HEADING = "خدمة: تطوير الأعمال كخدمة";

// ── ٢٠ سؤالاً من الأبواب القديمة (حكومي · تأسيس · استشارة) ──────────────────
// بعضها يحوي عمداً كلمات القسم العامة: أعمال / عملاء / شركات / مبيعات / سعر الباقة.
export const OLD_BASE = [
  // ‏حكومي: قوى، مدد، مقيم، أجير، نطاقات، مخالفات، تأشيرات، بلدي، سلامة، زاتكا
  "كيف أرفع نطاق منشأتي من الأحمر إلى الأخضر في قوى؟",
  "ما خطوات تفعيل مدد وحماية الأجور للمنشأة؟",
  "كيف أجدد إقامة عامل عن طريق مقيم؟",
  "أريد نقل خدمات عامل بمنصة أجير لمنشأة أخرى",
  "عندي مخالفة من وزارة الموارد البشرية على منشأتي ماذا أفعل؟",
  "كيف أصدر تأشيرة عمل لعامل جديد من الخارج؟",
  "كيف أستخرج رخصة بلدية لمحل جديد في منصة بلدي؟",
  "ما متطلبات شهادة السلامة من الدفاع المدني؟",
  "كيف أقدم إقرار ضريبة القيمة المضافة عن مبيعات شركتي؟",            // مبيعات
  "هل عدد العملاء والشركات المتعاقدة معي يؤثر على نطاقات منشأتي؟",    // عملاء، شركات
  "ما سعر الباقة المناسبة لتجديد السجل التجاري؟",                      // سعر الباقة
  "كيف أضيف موظفين على أبشر أعمال لمنشأتي؟",                          // أعمال
  // ‏تأسيس: فرع شركة أجنبية، MISA، سجل تجاري، ريادة الأعمال
  "كيف أفتح فرعاً لشركة أجنبية في السعودية؟",
  "ما هي خطوات الحصول على رخصة MISA للاستثمار الأجنبي؟",
  "أريد قيد سجل تجاري لمؤسسة فردية",
  "ما شروط رخصة ريادة الأعمال للأجانب؟",                              // أعمال
  "أبغى رخصة ريادة الأعمال وأفتح شركة لخدمة عملاء من الخارج",         // أعمال، عملاء، شركة
  "كم رسوم تأسيس شركة ذات مسؤولية محدودة وما سعر الباقة؟",            // سعر الباقة
  "ما الفرق بين الشركة ذات المسؤولية المحدودة والشركة المساهمة؟",
  // ‏استشارة عامة
  "أعمالي تواجه تدفقاً نقدياً ضعيفاً وأريد استشارة عامة قبل أي قرار",
];

// ── ١٢ فخّاً إضافياً: كلمات القسم نفسها في أسئلةٍ لا نيّة تطوير أعمال فيها ───
export const OLD_HARD = [
  "هل أحتاج ترخيصاً لتخزين بيانات العملاء في نظام CRM داخل شركتي؟",
  "كيف أصدر فاتورة ضريبية لعملاء من خارج السعودية؟",
  "ما إيرادات الشركة التي تُلزمها بالتسجيل في ضريبة القيمة المضافة؟",
  "What is the annual revenue threshold for VAT registration?",
  "هل تحتاج الشركة الأجنبية شريكاً سعودياً عند فتح فرع؟",
  "كم عمولة الوكيل التجاري المسجّل وكيف يُقيَّد؟",
  "كيف أحجز موعداً في أبشر أعمال لاجتماع مع الجوازات؟",
  "Which license do I need for my business customers and clients in Riyadh?",
  "هل المبيعات المخفّضة تحتاج ترخيص تخفيضات؟",
  "نمو الشركات الصغيرة: ما رسوم حجز الاسم التجاري والانطلاق في مشروع جديد؟",
  "Quel est le délai pour ouvrir une succursale d'une société étrangère ?",
  "外国公司如何在沙特开设分公司？",
];

export const OLD_QUESTIONS = [...OLD_BASE, ...OLD_HARD];

// ── ٢٠ سؤالاً بنيّة تطوير أعمال صريحة (ولا يصل أيٌّ منها من باب bizdev) ────────
export const BIZDEV_QUESTIONS = [
  "مبيعاتنا ضعيفة",
  "أبغى عملاء جدد لشركتي",
  "Revenue OS",
  "نظام تشغيل الإيرادات",
  "ما هي باقة النمو",
  "أبحث عن موردين للمواد الخام",
  "أبحث عن شريك أو موزع في السعودية",
  "أبغى خدمة تطوير الأعمال لشركتي",
  "كيف تبنون لي قائمة شركات مستهدفة وتحجزون اجتماعات؟",
  "ما الفرق بين الانطلاق والنمو في الباقات؟",
  "We need new customers - how does your business development service work?",
  "I want to build a sales pipeline for my company",
  "نبي نبني Pipeline مبيعات ونتابع الفرص",
  "كم عمولة النجاح وكيف تُحتسب؟",
  "REV-GROWTH ماذا تشمل؟",
  "عندنا فريق مبيعات صغير، من يغلق الصفقات معنا؟",
  "Je cherche de nouveaux clients, avez-vous un service de développement commercial ?",
  "我们想要业务拓展服务，帮我们找客户",
  "هل توجد مساحة العمل التجريبية لثلاثين يوماً؟",
  "أبغى أزيد مبيعاتي وأحصل على عملاء من الشركات الكبيرة",
];

// ‏النص نفسه بلا القسم المقيَّد — بطريقةٍ مستقلة عن تعبير الاستخراج في الوحدة:
// من بداية سطر عنوانه (وما يسبقه من أسطر فارغة) حتى فاصل القسم التالي أو النهاية.
function withoutGated(raw) {
  const mark = raw.indexOf("<!--gate:");
  assert.ok(mark > 0, "وسم البوّابة غير موجود في knowledge.json");
  const headStart = raw.lastIndexOf("\n## ", mark) + 1;
  const end = raw.indexOf("\n\n## ", mark);
  const before = raw.slice(0, headStart).replace(/\n+$/, "");
  return end < 0 ? before : before + raw.slice(end);
}

// ‏الميزانية في الخوارزمية الأصلية تعدّ حروف الأقسام لا الفواصل (`\n\n`) بينها،
// فقد يزيد الناتج عن `budget` بحرفين لكل فاصل. السقف الصارم الذي نحرسه إذن:
// الميزانية + فواصل (٢٥ فاصلاً أكثر من كافية) — لا قسماً زائداً.
const SLACK = 50;

const WITH = makePicker(RAW);
const WITHOUT = makePicker(withoutGated(RAW));

test("المجموعة: ٤٠ سؤالاً على الأقل، عشرون منها بنيّة صريحة", () => {
  assert.ok(OLD_QUESTIONS.length + BIZDEV_QUESTIONS.length >= 40);
  assert.equal(OLD_BASE.length, 20);
  assert.equal(BIZDEV_QUESTIONS.length, 20);
});

test("القاعدة: وسمٌ واحد لبوّابة bizdev، والأقسام العادية هي نفسها بدونه", () => {
  assert.equal((RAW.match(/<!--gate:/g) || []).length, 1);
  assert.deepEqual(WITH.gated, ["bizdev"]);
  assert.deepEqual(WITHOUT.gated, []);
  assert.equal(WITH.sections, WITHOUT.sections);
  assert.equal(WITH.index, WITHOUT.index);
});

test("الأسئلة القديمة (٣٢): الناتج حرفاً هو الناتج بلا القسم — ولا يدخل القسم", () => {
  const changed = [];
  for (const q of OLD_QUESTIONS) {
    for (const budget of [9000, 20000]) {
      const got = WITH.pick(q, budget);
      if (got !== WITHOUT.pick(q, budget) || got.includes(HEADING)) changed.push(`${budget}: ${q}`);
    }
  }
  assert.deepEqual(changed, []);
});

test("الأسئلة الصريحة (٢٠): القسم يدخل ولا يُتجاوز سقف الميزانية", () => {
  const missed = [];
  for (const q of BIZDEV_QUESTIONS) {
    for (const budget of [9000, 20000]) {
      const got = WITH.pick(q, budget);
      if (!got.includes(HEADING) || got.length > budget + SLACK) missed.push(`${budget}: ${q}`);
    }
  }
  assert.deepEqual(missed, []);
});

test("باب bizdev يضمّ القسم لأي سؤال — حتى القديم — بلا ملخص الأسعار الحكومية", () => {
  for (const q of [...OLD_QUESTIONS, "مرحبا", ""]) {
    const got = WITH.pick(q, 9000, { door: "bizdev" });
    assert.ok(got.includes(HEADING), q);
    assert.ok(got.length <= 9000 + SLACK, q);
  }
  // ‏سؤالٌ لا يطابق قسماً آخر: القسم وحده، لا حشو من «جدول ملخص سريع».
  const alone = WITH.pick("مرحبا", 9000, { door: "bizdev" });
  assert.ok(!alone.includes("جدول ملخص سريع"));
  assert.ok(alone.startsWith("## 🚀 " + HEADING));
});

test("باب آخر لا يفتح القسم، والأبواب القديمة بلا opts تعمل كما كانت", () => {
  for (const q of OLD_QUESTIONS) {
    assert.equal(WITH.pick(q, 9000, { door: "formation" }), WITHOUT.pick(q, 9000), q);
    assert.equal(WITH.pick(q, 9000, {}), WITHOUT.pick(q, 9000), q);
  }
});

test("وسم البوّابة لا يصل نصّ النموذج، والقسم يصل كاملاً (٤٠٠٠ حرف تقريباً)", () => {
  const got = WITH.pick("Revenue OS", 9000);
  assert.ok(!got.includes("<!--gate"));
  assert.ok(got.includes("REV-LAUNCH") && got.includes("ما يلزم لبدء التصور"));
  assert.ok(got.length > 3500);
});

test("الميزانية الصغيرة: القسم يُقصّ ولا يتجاوز السقف", () => {
  const got = WITH.pick("Revenue OS", 1500);
  assert.ok(got.length <= 1500 && got.startsWith("## "));
});

test("الوحدة الحيّة (pickKnowledge) تطابق الأداة المبنيّة على القاعدة نفسها", () => {
  for (const q of [...OLD_QUESTIONS, ...BIZDEV_QUESTIONS]) {
    assert.equal(pickKnowledge(q), WITH.pick(q), q);
  }
  assert.equal(pickKnowledge("x", 9000, { door: "bizdev" }), WITH.pick("x", 9000, { door: "bizdev" }));
});
