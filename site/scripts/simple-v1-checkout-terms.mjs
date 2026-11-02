// Business Partner — Simple V1: شروط كل بند في السلة (getTermsFor).
//
// قرار المالك 2026-11-02: لا دفع قبل أن يقرأ العميل شروط **كل بند** في سلته ويوافق.
// وكيل القانون يبني `site/assets/data/terms.json` وبوابة الشروط؛ حتى يجهز الملف
// تقف السلة والدفع على هذه الواجهة البديلة الصغيرة، وهي قابلة للاستبدال بلا
// مساس بالصفحتين: كلتاهما تستهلكان `termsData()` وحده، والعميل يستهلك
// `getTermsFor(item)` المبنية منه.
//
// ما تفعله:
//   • تشتقّ فئة كل بند من الكتالوج وقت البناء (تماماً كما تفعل recurringMap للدورة)
//     وتعطيه مرساة `/terms#cat-<slug>`؛ البنود التي لا فئة لها (عرض سعر sv1: ، اشتراك
//     التوظيف BP-EMP-* ، باقات Business Partner AI BP-AIWS-* ، الباقات) لها فئاتها.
//   • إن وُجد `terms.json` تأخذ منه `version` وعناوين الفئات وخريطة `skus` — بلا افتراض
//     أكثر من هذا الشكل التسامحي (انظر readTermsJson). غير ذلك: نسخة بديلة صريحة الاسم
//     `-fallback` حتى لا يُظنّ أن موافقةً سُجّلت على نصٍّ قانوني معتمد.
//
// الحساب لا يمرّ من هنا: هذا عرضٌ وتوثيق موافقة فقط، والمبالغ يقولها الخادم.
import fs from "node:fs";
import path from "node:path";

export const FALLBACK_VERSION = "bp-terms-fallback-2026-11";

// عناوين الفئات (ar/en؛ الفرنسية والصينية تسقط إلى الإنجليزية).
const CATS = {
  "company-formation":   { ar: "تأسيس الشركات", en: "Company formation" },
  "foreign-investment":  { ar: "الاستثمار الأجنبي", en: "Foreign investment" },
  "premium-residency":   { ar: "الإقامة المميزة", en: "Premium residency" },
  "government-relations":{ ar: "العلاقات الحكومية", en: "Government relations" },
  "hr-services":         { ar: "خدمات الموارد البشرية", en: "HR services" },
  "recruitment":         { ar: "الاستقدام والتوظيف", en: "Recruitment" },
  "business-support":    { ar: "دعم الأعمال", en: "Business support" },
  "real-estate":         { ar: "العقارات", en: "Real estate" },
  "ai-automation":       { ar: "الأتمتة والذكاء الاصطناعي", en: "AI automation" },
  "ai-workspace":        { ar: "مساحات Business Partner AI", en: "Business Partner AI workspaces" },
  "recruitment-platform":{ ar: "منصة التوظيف (اشتراك صاحب العمل)", en: "Recruitment platform (employer subscription)" },
  "packages":            { ar: "الباقات", en: "Packages" },
  "quotation":           { ar: "عروض الأسعار", en: "Quotations" },
  "general":             { ar: "الشروط العامة", en: "General terms" },
};

const slugOf = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// شكل تسامحي: { version, categories: [{slug|id, titleAr|ar, titleEn|en}] | {slug:{ar,en}}, skus: {code: slug} }.
function readTermsJson(cats, skuCat) {
  let version = "", source = "fallback";
  try {
    const f = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/terms.json"), "utf8"));
    if (f && typeof f.version === "string" && f.version.trim()) { version = f.version.trim().slice(0, 40); source = "terms.json"; }
    const list = Array.isArray(f.categories)
      ? f.categories.map((c) => [c && (c.slug || c.id), c])
      : f.categories && typeof f.categories === "object" ? Object.entries(f.categories) : [];
    for (const [k, c] of list) {
      const slug = slugOf(k);
      if (!slug || !c || typeof c !== "object") continue;
      const ar = c.titleAr || c.ar || (c.title && c.title.ar) || "";
      const en = c.titleEn || c.en || (c.title && c.title.en) || "";
      if (ar || en) cats[slug] = { ar: ar || en, en: en || ar };
    }
    if (f.skus && typeof f.skus === "object") for (const [code, slug] of Object.entries(f.skus)) if (slugOf(slug)) skuCat[String(code).toLowerCase()] = slugOf(slug);
  } catch {}
  return { version: version || FALLBACK_VERSION, source };
}

export function termsData() {
  const cats = JSON.parse(JSON.stringify(CATS));
  const skuCat = {};
  try {
    const c = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8"));
    for (const s of c.services || []) if (s.code) skuCat[String(s.code).toLowerCase()] = slugOf(s.category) || "general";
    for (const p of c.packages || []) for (const k of [p.key, p.code]) if (k) skuCat[String(k).toLowerCase()] = "packages";
    for (const a of c.aiPlans || []) if (a.code) skuCat[String(a.code).toLowerCase()] = "ai-workspace";
  } catch {}
  const { version, source } = readTermsJson(cats, skuCat);
  for (const slug of Object.values(skuCat)) if (!cats[slug]) cats[slug] = CATS.general;
  return { version, source, cats, skuCat };
}

// تُسلسَل كما هي داخل سكربت الصفحة. تعتمد على TERMS و LANG و HOME في نطاقها.
// دالة واحدة بلا اعتمادات خارجية، حتى يسهل استبدالها حين يصل terms.json بشكله النهائي.
export const GET_TERMS_FOR_SRC = `function getTermsFor(i){
 var id=String((i&&i.id)||'').toLowerCase(),bare=id.replace(/^(svc|pkg)-/,'');
 var slug=TERMS.skuCat[id]||TERMS.skuCat[bare]||'';
 if(!slug){
  if(/^bp-emp-/.test(id))slug='recruitment-platform';
  else if(/^bp-aiws-|^svc-bp-aiws-/.test(id))slug='ai-workspace';
  else if(/^sv1:/.test(id))slug='quotation';
  else if(/^(bp-)?pkg-/.test(id))slug='packages';
  else slug='general'}
 var c=TERMS.cats[slug]||TERMS.cats.general;
 return {slug:slug,title:c[LANG]||c.en||c.ar,href:HOME+'terms#cat-'+slug}}`;
