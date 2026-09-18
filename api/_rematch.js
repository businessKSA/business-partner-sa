// الألماس الأزرق — محرك المطابقة وقراءة رسائل السوق.
//
// هذا الملف لا يتصل بشبكة ولا بقاعدة بيانات: يدخله نصٌّ أو صفّان ويخرج منه
// حكم. السبب أنّ المطابقة هي المنتج نفسه — إن أخطأت، أُرسل للعميل عقارٌ لا
// يشبه طلبه، وهذا أسوأ من ألا يُرسل شيء. وما لا يتصل بشيء يُختبر وحده، وهو
// ما يفعله tests/rematch.test.mjs.
//
// قراران يحكمان الملف كله:
//
// ١) الاستخراج حتمي أولاً، والذكاء يحسّن لا يقرر. رسائل السوق العقاري
//    السعودي تُكتب بصيغ متكررة («أرض خام ٥٠٠٠م شمال الرياض، المطلوب ٨
//    مليون»)، وقواعد مكتوبة تقرأها بلا مفتاح API ولا كلفة ولا انتظار. حين
//    يتوفر مفتاح، يملأ النموذج ما فات القواعد فقط (api/_realestate.js) —
//    فلو سقط المزوّد أو نفد الرصيد يبقى المكتب يعمل.
//
// ٢) الدرجة تُعلَّل. كل مطابقة تحمل «أسباباً» و«فجوات» بالعربية، لأن بندر
//    يرسل العرض للعميل ومعه سطر يشرح لماذا يناسبه — والفجوة تُقال قبل أن
//    يكتشفها العميل بنفسه في المعاينة، فتلك هي الفرق بين وسيط يُوثق به
//    ووسيط يُرسل كل ما يصله.
//
// ملف بادئته «_» عمداً: Vercel تحوّل كل ملف آخر في api/ إلى دالة، والسقف ١٢.

// ---------------------------------------------------------------- التطبيع --
// النص العربي في واتساب يصل بكل الأشكال: بألف همزة وبدونها، بتاء مربوطة أو
// هاء، بأرقام هندية أو عربية، وبتشكيل أحياناً. التطبيع يجعل «الريـاض»
// و«الریاض» و«الرياض» شيئاً واحداً قبل أي مقارنة.
const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
                    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };

export function normalizeAr(input) {
  let s = String(input == null ? "" : input);
  s = s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d] || d);
  s = s.replace(/[ً-ْٰـ]/g, "");      // تشكيل وتطويل
  s = s.replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/[،؛]/g, " ").replace(/‏|‎/g, "");
  return s.replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------ أنواع العقار --
// المفتاح إنجليزي لأنه يُخزَّن ويُرشَّح به؛ العربي للعرض؛ والمرادفات هي ما
// يكتبه الناس فعلاً. «عمارة» و«بناية» و«مبنى سكني» شيء واحد في السوق.
export const PROPERTY_TYPES = {
  LAND:                 { ar: "أرض خام",        syn: ["ارض", "اراضي", "قطعه", "قطعة", "بلك", "خام", "مخطط"] },
  RESIDENTIAL_BUILDING: { ar: "عمارة سكنية",    syn: ["عماره", "عمارة", "بنايه", "بناية", "مبني سكني", "سكنيه", "مجمع سكني"] },
  COMMERCIAL_BUILDING:  { ar: "مبنى تجاري",     syn: ["مبني تجاري", "عماره تجاريه", "تجاري", "مجمع تجاري", "سنتر"] },
  VILLA:                { ar: "فيلا",           syn: ["فيلا", "فلل", "دوبلكس", "دبلكس", "قصر"] },
  APARTMENT:            { ar: "شقة",            syn: ["شقه", "شقق", "ستوديو", "استوديو"] },
  SHOWROOM:             { ar: "معرض / محل",     syn: ["معرض", "محل", "محلات", "معارض", "صاله عرض"] },
  WAREHOUSE:            { ar: "مستودع",         syn: ["مستودع", "مستودعات", "مخزن", "ورشه", "ورشة", "هنجر"] },
  TOWER:                { ar: "برج",            syn: ["برج", "ابراج"] },
  HOTEL:                { ar: "فندق / شقق فندقية", syn: ["فندق", "فندقيه", "نزل", "شقق فندقيه"] },
  FARM:                 { ar: "مزرعة / استراحة", syn: ["مزرعه", "مزرعة", "استراحه", "استراحة", "شاليه"] },
  COMPOUND:             { ar: "مجمع سكني مغلق", syn: ["كمبوند", "مجمع مغلق"] },
  OFFICE:               { ar: "مكتب",           syn: ["مكتب", "مكاتب", "دور مكتبي"] },
  MIXED:                { ar: "استخدام مختلط",  syn: ["مختلط", "متعدد الاستخدام"] },
};

// أنواع يقبل بعضها بعضاً جزئياً: من يطلب عمارة سكنية يقبل غالباً مجمعاً
// سكنياً، ومن يطلب معرضاً يقبل مبنى تجارياً صغيراً. القرابة تُدرَّج ولا
// تُساوى بالتطابق — ولذلك 0.6 لا 1.
const TYPE_KIN = {
  RESIDENTIAL_BUILDING: { COMPOUND: 0.6, TOWER: 0.5, APARTMENT: 0.35 },
  COMMERCIAL_BUILDING:  { TOWER: 0.6, SHOWROOM: 0.5, OFFICE: 0.5, MIXED: 0.6 },
  SHOWROOM:             { COMMERCIAL_BUILDING: 0.5, OFFICE: 0.4 },
  OFFICE:               { COMMERCIAL_BUILDING: 0.5, TOWER: 0.45, SHOWROOM: 0.4 },
  TOWER:                { COMMERCIAL_BUILDING: 0.6, RESIDENTIAL_BUILDING: 0.5, MIXED: 0.5 },
  COMPOUND:             { RESIDENTIAL_BUILDING: 0.6 },
  APARTMENT:            { RESIDENTIAL_BUILDING: 0.3 },
  MIXED:                { COMMERCIAL_BUILDING: 0.6, RESIDENTIAL_BUILDING: 0.4, TOWER: 0.5 },
};

export function propertyTypeLabel(code) {
  return (PROPERTY_TYPES[code] && PROPERTY_TYPES[code].ar) || code || "";
}

export function detectPropertyType(text) {
  const s = normalizeAr(text);
  let best = null, bestAt = Infinity;
  for (const [code, def] of Object.entries(PROPERTY_TYPES)) {
    for (const w of def.syn) {
      const at = s.indexOf(normalizeAr(w));
      // الأقرب إلى أول الرسالة هو الموضوع؛ ما بعده غالباً وصف أو مقارنة.
      if (at >= 0 && at < bestAt) { best = code; bestAt = at; }
    }
  }
  return best;
}

// ------------------------------------------------------------------ المدن --
// ليست كل مدن المملكة — بل ما يرد فعلاً في رسائل السوق، ومعها الأحياء
// والاتجاهات التي تُكتب بدل اسم المدينة («شمال الرياض»).
export const CITIES = {
  "الرياض": ["الرياض", "رياض"],
  "جدة": ["جده", "جدة"],
  "مكة المكرمة": ["مكه", "مكة", "مكه المكرمه"],
  "المدينة المنورة": ["المدينه", "المدينة المنوره"],
  "الدمام": ["الدمام"],
  "الخبر": ["الخبر"],
  "الظهران": ["الظهران"],
  "الأحساء": ["الاحساء", "الهفوف"],
  "القصيم": ["القصيم", "بريده", "بريدة", "عنيزه"],
  "الطائف": ["الطائف", "الطايف"],
  "أبها": ["ابها", "خميس مشيط", "عسير"],
  "تبوك": ["تبوك"],
  "حائل": ["حائل", "حايل"],
  "نجران": ["نجران"],
  "جازان": ["جازان", "جيزان"],
  "ينبع": ["ينبع"],
  "الجبيل": ["الجبيل"],
  "نيوم": ["نيوم"],
};

export function detectCity(text) {
  const s = normalizeAr(text);
  for (const [city, syns] of Object.entries(CITIES)) {
    for (const w of syns) if (s.includes(normalizeAr(w))) return city;
  }
  return null;
}

// الاتجاه داخل المدينة يُعامل كحيّ مفضّل لا كمدينة: «شمال الرياض» طلبٌ
// شائع، وتجاهله يعني إرسال عقار في جنوبها لمن اشترط شمالها.
const DIRECTIONS = { "شمال": "شمال", "جنوب": "جنوب", "شرق": "شرق", "غرب": "غرب", "وسط": "وسط" };

export function detectDistricts(text) {
  const s = normalizeAr(text);
  const out = [];
  for (const [k, v] of Object.entries(DIRECTIONS)) {
    const re = new RegExp(`${k}\\s+(ال)?[\\u0621-\\u064A]+`);
    if (re.test(s)) out.push(v);
  }
  // «حي كذا» — الكلمة التالية لكلمة «حي» هي اسم الحي.
  const m = s.match(/حي\s+([ء-ي]+(?:\s+[ء-ي]+)?)/g) || [];
  for (const one of m) {
    const name = one.replace(/^حي\s+/, "").trim();
    if (name && name.length >= 3 && !out.includes(name)) out.push(name);
  }
  return out;
}

// ----------------------------------------------------------------- الأرقام --
// «٨ مليون» و«8م» و«8,000,000» و«850 ألف» كلها مبالغ في هذا السوق، و«500م»
// في سياق المساحة خمسمائة متر لا خمسمائة مليون. لذلك لا يوجد مستخرج أرقام
// عام واحد: لكل حقل مستخرجه الذي يعرف سياقه.
const UNIT = [
  { re: /(مليار|بليون)/, mul: 1e9 },
  { re: /(مليون|ملايين)/, mul: 1e6 },
  { re: /(الف|آلاف|الاف)/, mul: 1e3 },
];

function numAt(raw) {
  const n = Number(String(raw).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * مبلغ بالريال من نص. يبحث قرب كلمات السعر أولاً، ثم عن رقم بوحدة صريحة.
 * يعيد null حين لا يجد — والـ null هنا معلومة: «لم يُذكر سعر» لا «صفر».
 */
export function extractPrice(text) {
  const s = normalizeAr(text);
  // 1) رقم يتبع كلمة سعر/مطلوب/ميزانيه ومعه وحدة أو عملة
  const near = s.match(/(?:السعر|سعر|المطلوب|مطلوب|بسعر|الميزانيه|ميزانيه|ميزانيتي|بحدود|حدود|قيمه|القيمه)\s*:?\s*([\d.,]+)\s*(مليار|بليون|مليون|ملايين|الف|آلاف|الاف|م(?![ء-ي])|ك(?![ء-ي]))?/);
  if (near) {
    const base = numAt(near[1]);
    if (base != null) {
      const u = near[2] || "";
      if (/مليار|بليون/.test(u)) return base * 1e9;
      if (/مليون|ملايين/.test(u)) return base * 1e6;
      if (/الف|آلاف|الاف|^ك$/.test(u)) return base * 1e3;
      // «٨م» بعد كلمة سعر = ثمانية ملايين؛ المتر لا يُقاس بعد «السعر».
      if (u === "م") return base * 1e6;
      return base;
    }
  }
  // 2) رقم بوحدة صريحة في أي موضع
  for (const { re, mul } of UNIT) {
    const m = s.match(new RegExp(`([\\d.,]+)\\s*${re.source}`));
    if (m) { const b = numAt(m[1]); if (b != null) return b * mul; }
  }
  // 3) رقم كبير مع ريال
  const sar = s.match(/([\d.,]{4,})\s*(?:ريال|ر\.?س|sar)/i);
  if (sar) return numAt(sar[1]);
  return null;
}

/** مدى الميزانية: «من ٥ إلى ٨ مليون» أو «٨ مليون» (سقفاً) أو «لا يزيد عن». */
export function extractBudgetRange(text) {
  const s = normalizeAr(text);
  // المدى يُقبل ميزانيةً فقط إذا حمل وحدة مال أو عملة. بدون هذا الشرط كانت
  // «من ٥٠٠٠ إلى ٦٠٠٠ متر» تُقرأ ميزانيةً من خمسة آلاف ريال إلى ستة آلاف،
  // فيُرفض كل عرض في السوق — وهي الجملة الأشيع في رسائل الطلبات.
  const range = s.match(/من\s*([\d.,]+)\s*(?:الي|الى|-)\s*([\d.,]+)\s*(مليون|مليار|الف|ريال|ر\.?س)/);
  if (range) {
    const u = range[3] || "";
    const mul = /مليون/.test(u) ? 1e6 : /مليار/.test(u) ? 1e9 : /الف/.test(u) ? 1e3 : 1;
    const a = numAt(range[1]), b = numAt(range[2]);
    if (a != null && b != null) return { min: Math.min(a, b) * mul, max: Math.max(a, b) * mul };
  }
  const one = extractPrice(s);
  if (one == null) return { min: null, max: null };
  // رقم واحد في طلب = سقف، إلا أن يُقال «ابتداءً من».
  if (/(ابتداء|يبدا|فوق|اكثر من)/.test(s)) return { min: one, max: null };
  return { min: null, max: one };
}

/** المساحة بالمتر المربع، ومدى المساحة حين يُذكر مدى. */
export function extractArea(text) {
  const s = normalizeAr(text);
  const range = s.match(/(?:مساحه)?\s*من\s*([\d.,]+)\s*(?:الي|الى|-)\s*([\d.,]+)\s*(?:م2|م٢|متر|م(?![ء-ي]))/);
  if (range) {
    const a = numAt(range[1]), b = numAt(range[2]);
    if (a != null && b != null) return { min: Math.min(a, b), max: Math.max(a, b), value: null };
  }
  const near = s.match(/(?:المساحه|مساحه|مساحة)\s*:?\s*([\d.,]+)/);
  if (near) { const v = numAt(near[1]); if (v != null) return { min: null, max: null, value: v }; }
  const unit = s.match(/([\d.,]+)\s*(?:م2|م٢|متر مربع|متر|m2|sqm)/i);
  if (unit) { const v = numAt(unit[1]); if (v != null) return { min: null, max: null, value: v }; }
  return { min: null, max: null, value: null };
}

/** الدخل السنوي للعقار المدر. */
export function extractIncome(text) {
  const s = normalizeAr(text);
  const m = s.match(/(?:الدخل|دخل|الايجار|ايجار|العايد|عايد|ريع)(?:\s*(?:السنوي|سنوي|السنه|سنويا))?\s*:?\s*([\d.,]+)\s*(مليون|الف|م(?![ء-ي])|ك(?![ء-ي]))?/);
  if (!m) return null;
  const b = numAt(m[1]);
  if (b == null) return null;
  const u = m[2] || "";
  if (/مليون/.test(u)) return b * 1e6;
  if (/الف|^ك$/.test(u)) return b * 1e3;
  if (u === "م") return b * 1e6;
  return b;
}

/** نسبة العائد المئوية حين تُصرَّح («عائد ٧٪»). */
export function extractYield(text) {
  const s = normalizeAr(text);
  const m = s.match(/(?:عايد|العايد|ريع|نسبه)\s*:?\s*([\d.,]+)\s*%?/) || s.match(/([\d.,]+)\s*%\s*(?:عايد|ريع)/);
  if (!m) return null;
  const v = numAt(m[1]);
  return v != null && v > 0 && v < 100 ? v : null;
}

// «مدر للدخل» / «غير مدر» / «خام» — ثلاث حالات، والثالثة هي السكوت.
export function extractIncomeProducing(text) {
  const s = normalizeAr(text);
  if (/(غير مدر|غير موجر|غير موجره|شاغر|خام|بدون دخل|فاضي)/.test(s)) return false;
  if (/(مدر للدخل|مدر|موجر|موجره|عليه عقد|دخل سنوي|مستاجر|ريع)/.test(s)) return true;
  return null;
}

export function extractDeedType(text) {
  const s = normalizeAr(text);
  if (/حجه استحكام|حجة استحكام/.test(s)) return "حجة استحكام";
  if (/زراعي/.test(s) && /صك/.test(s)) return "صك زراعي";
  if (/منحه|منحة/.test(s)) return "منحة";
  if (/صك الكتروني|صك إلكتروني|صك/.test(s)) return "صك إلكتروني";
  return null;
}

// ------------------------------------------------------- الطلب أم العرض؟ --
// السؤال الأول في كل رسالة واردة. الفرق ليس في المحتوى — كلاهما يذكر نوعاً
// ومساحة وسعراً — بل في اتجاه الفعل: «أبغى/مطلوب/أدور» طلب، و«لدينا/للبيع/
// معروض» عرض. الكلمات الحاسمة تُوزن، ولا يُحسم إلا بفارق واضح.
const REQUEST_CUES = [
  ["ابغي", 3], ["ابي", 3], ["اريد", 3], ["ادور", 3], ["نبحث", 3], ["ابحث", 3], ["مطلوب", 4],
  ["عميلي يبحث", 5], ["عميل يبحث", 5], ["لدي عميل", 5], ["عندي عميل", 5], ["احتاج", 3],
  ["ميزانيه", 2], ["ميزانيتي", 2], ["تتوفر", 1], ["يوجد لديكم", 3], ["تبحث عن", 3],
];
const LISTING_CUES = [
  ["للبيع", 4], ["للايجار", 4], ["معروض", 4], ["لدينا", 3], ["عندنا", 3], ["متوفر", 3],
  ["يتوفر لدينا", 4], ["فرصه", 2], ["فرصة", 2], ["السعر", 2], ["المطلوب", 1], ["الموقع", 1],
  ["حصري", 3], ["مباشر من المالك", 4], ["من المالك", 3], ["صك", 1], ["واجهه", 1], ["للاستثمار", 2],
];
const STUDY_CUES = [
  ["دراسه جدوي", 5], ["دراسة جدوى", 5], ["تحليل عقاري", 5], ["تقييم", 4], ["تثمين", 4],
  ["دراسه سوق", 4], ["هندسه ماليه", 4], ["استشاره", 3], ["استشارة", 3],
];

function weigh(s, cues) {
  let score = 0;
  for (const [w, pts] of cues) if (s.includes(normalizeAr(w))) score += pts;
  return score;
}

/**
 * تصنيف رسالة واردة.
 * @returns {{intent:'REQUEST'|'LISTING'|'STUDY'|'QUESTION', confidence:number, scores:object}}
 */
export function classifyMessage(text) {
  const s = normalizeAr(text);
  const scores = { REQUEST: weigh(s, REQUEST_CUES), LISTING: weigh(s, LISTING_CUES), STUDY: weigh(s, STUDY_CUES) };
  // رسالة قصيرة بلا رقم ولا نوع عقار سؤالٌ غالباً، لا طلب ولا عرض.
  const hasSubstance = !!detectPropertyType(s) || extractPrice(s) != null || extractArea(s).value != null;
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] === 0 || (!hasSubstance && top[1] < 4)) {
    return { intent: "QUESTION", confidence: 0.3, scores };
  }
  const second = Object.entries(scores).sort((a, b) => b[1] - a[1])[1];
  const margin = top[1] - (second ? second[1] : 0);
  return { intent: top[0], confidence: Math.min(1, 0.45 + margin * 0.12), scores };
}

/** قراءة طلب من نص واتساب، حتمياً وبلا نموذج. */
export function parseRequestText(text) {
  const s = normalizeAr(text);
  const area = extractArea(s);
  const budget = extractBudgetRange(s);
  return {
    property_type: detectPropertyType(s),
    city: detectCity(s),
    districts: detectDistricts(s),
    area_min: area.min != null ? area.min : area.value,
    area_max: area.max != null ? area.max : area.value,
    budget_min: budget.min,
    budget_max: budget.max,
    income_producing: extractIncomeProducing(s),
    target_yield: extractYield(s),
    deed_type: extractDeedType(s),
    purpose: /(ايجار|استيجار|للايجار)/.test(s) ? "RENT" : /(استثمار|عايد|ريع)/.test(s) ? "INVEST" : /(تطوير|نطور)/.test(s) ? "DEVELOP" : "BUY",
    financing: /(كاش|نقد)/.test(s) ? "CASH" : /(بنك|تمويل|رهن)/.test(s) ? "BANK" : /(صندوق)/.test(s) ? "FUND" : null,
    timeline: /(عاجل|بسرعه|فورا|فوري)/.test(s) ? "IMMEDIATE" : null,
    raw_text: String(text || "").slice(0, 4000),
  };
}

/** قراءة عرض من نص واتساب. */
export function parseListingText(text) {
  const s = normalizeAr(text);
  const area = extractArea(s);
  const price = extractPrice(s);
  const income = extractIncome(s);
  const a = area.value != null ? area.value : area.min;
  const yld = extractYield(s);
  const url = String(text || "").match(/https?:\/\/[^\s]+/);
  return {
    property_type: detectPropertyType(s),
    city: detectCity(s),
    district: (detectDistricts(s)[0]) || null,
    area: a,
    price,
    // سعر المتر يُحسب حين يغيب لأن المساومة في هذا السوق تجري عليه لا على
    // الإجمالي — ومن لا يملكه لا يستطيع أن يقول «أغلى من السوق بكم».
    price_per_m: price != null && a ? Math.round((price / a) * 100) / 100 : null,
    annual_income: income,
    yield_pct: yld != null ? yld : (income != null && price ? Math.round((income / price) * 10000) / 100 : null),
    income_producing: extractIncomeProducing(s),
    deed_type: extractDeedType(s),
    deed_no: (s.match(/صك\s*(?:رقم)?\s*([\d/]{6,})/) || [])[1] || null,
    offer_kind: /(للايجار|ايجار سنوي)/.test(s) ? "RENT" : /(استثمار|عايد|ريع)/.test(s) && income != null ? "INVESTMENT" : "SALE",
    exclusive: /(حصري|حصريا)/.test(s),
    location_url: url ? url[0] : null,
    raw_text: String(text || "").slice(0, 4000),
  };
}

// ------------------------------------------------------------- الاكتمال --
// ما الذي ينقص الطلب حتى يصير قابلاً للبحث؟ هذا ما يقرر سؤال المستشار
// التالي. ثلاثة حقول تصنع بحثاً، والباقي يحسّن الترتيب — فلا يُسأل العميل
// عن الصك قبل أن نعرف المدينة.
export const REQUIRED_FIELDS = [
  { key: "property_type", weight: 30, ar: "نوع العقار", ask: "أي نوع عقار تبحث عنه؟ (أرض خام، عمارة سكنية، مبنى تجاري، فيلا، معرض...)" },
  { key: "city",          weight: 25, ar: "المدينة",     ask: "في أي مدينة؟ وإن كان لك اتجاه أو حي مفضّل اذكره." },
  { key: "budget_max",    weight: 20, ar: "الميزانية",   ask: "ما سقف الميزانية تقريباً؟" },
  { key: "area_min",      weight: 15, ar: "المساحة",     ask: "ما المساحة المطلوبة تقريباً (بالمتر المربع)؟" },
  { key: "income_producing", weight: 10, ar: "مدر للدخل من عدمه", ask: "تبحث عن عقار مدر للدخل (مؤجر بعقود قائمة) أم غير مدر؟" },
];

export function requestCompleteness(req) {
  let got = 0;
  const missing = [];
  for (const f of REQUIRED_FIELDS) {
    const v = req ? req[f.key] : undefined;
    const has = f.key === "income_producing" ? v === true || v === false
      : Array.isArray(v) ? v.length > 0
      : v !== null && v !== undefined && v !== "";
    if (has) got += f.weight; else missing.push(f);
  }
  return { completeness: got, missing };
}

/** السؤال الواحد التالي — واحد لا قائمة: النموذج الطويل يُهجر في واتساب. */
export function nextQuestion(req) {
  const { missing } = requestCompleteness(req);
  return missing.length ? missing[0] : null;
}

// ------------------------------------------------------------- المطابقة --
const money = (n) => (n == null ? "" : Number(n).toLocaleString("en-US"));
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

// تدرّج بدل عتبة: قيمة داخل المدى = 1، وخارجه تنزل تدريجياً حتى حدّ التسامح.
// السبب عملي: عرضٌ يتجاوز السقف بـ٣٪ صفقةٌ يُساوَم عليها، وإخفاؤه عن العميل
// باسم «الدقة» يضيّع عليه ما كان سيشتريه.
function bandFit(value, min, max, tolerance = 0.15) {
  if (value == null) return null;
  if (min == null && max == null) return null;
  const lo = min == null ? -Infinity : min;
  const hi = max == null ? Infinity : max;
  if (value >= lo && value <= hi) return 1;
  if (value < lo) {
    const slack = (Number.isFinite(lo) ? lo : 0) * tolerance;
    return slack > 0 ? clamp01(1 - (lo - value) / slack) : 0;
  }
  const slack = (Number.isFinite(hi) ? hi : 0) * tolerance;
  return slack > 0 ? clamp01(1 - (value - hi) / slack) : 0;
}

function typeFit(reqType, lstType) {
  if (!reqType || !lstType) return null;          // لا معلومة ≠ عدم تطابق
  if (reqType === lstType) return 1;
  const kin = TYPE_KIN[reqType] && TYPE_KIN[reqType][lstType];
  return kin != null ? kin : 0;
}

// الطلب يشتري والعرض يبيع — التقاطع الذي لا يُتجاوز.
function sideOk(purpose, offerKind) {
  if (!purpose || !offerKind) return true;
  if (purpose === "RENT") return offerKind === "RENT";
  if (purpose === "BUY" || purpose === "DEVELOP") return offerKind === "SALE" || offerKind === "INVESTMENT";
  if (purpose === "INVEST") return offerKind === "SALE" || offerKind === "INVESTMENT";
  return true;
}

/**
 * درجة مطابقة عرضٍ لطلب، مع أسبابها وفجواتها بالعربية.
 *
 * @param {object} req صفّ re_requests (أو ما يشبهه)
 * @param {object} lst صفّ re_listings
 * @returns {{score:number, reasons:string[], gaps:string[], rejected:string|null}}
 */
export function scoreMatch(req, lst) {
  const reasons = [];
  const gaps = [];
  const r = req || {}, l = lst || {};

  // ---- مرشّحات قاطعة: ما لا يُرسل أصلاً ----
  // «غير متاح» يعني بِيع أو حُجز أو سُحب. أما UNVERIFIED فهو عرضٌ وصل
  // واتساب ولم يُعاينه أحد بعد — وهو حال كل عرض في أول ساعته. رفضه هنا كان
  // يعني ألا تقع مطابقة واحدة أبداً، فالتحفّظ يُقال في الفجوات لا يُقصي.
  const GONE = new Set(["SOLD", "RESERVED", "WITHDRAWN", "EXPIRED"]);
  if (l.status && GONE.has(l.status)) return { score: 0, reasons, gaps, rejected: "العرض غير متاح" };
  if (l.available === false) return { score: 0, reasons, gaps, rejected: "العرض غير متاح" };
  if (l.status === "UNVERIFIED") gaps.push("العرض وصل من السوق ولم يُوثَّق بعد — يحتاج تأكيد المالك والصك");
  if (!sideOk(r.purpose, l.offer_kind)) return { score: 0, reasons, gaps, rejected: "اتجاه الصفقة مختلف (بيع مقابل إيجار)" };
  if (r.city && l.city && normalizeAr(r.city) !== normalizeAr(l.city)) {
    return { score: 0, reasons, gaps, rejected: `المدينة مختلفة (${l.city} بدل ${r.city})` };
  }
  const tf = typeFit(r.property_type, l.property_type);
  if (tf === 0) {
    return { score: 0, reasons, gaps, rejected: `نوع العقار مختلف (${propertyTypeLabel(l.property_type)})` };
  }
  // شرط الدخل شرطٌ لا ترجيح: من طلب مدراً للدخل لا يُرسل له عقار شاغر.
  if (r.income_producing === true && l.income_producing === false) {
    return { score: 0, reasons, gaps, rejected: "العقار غير مدر للدخل والطلب يشترط ذلك" };
  }
  if (r.income_producing === false && l.income_producing === true) {
    return { score: 0, reasons, gaps, rejected: "العقار مؤجر والطلب يشترط عقاراً شاغراً" };
  }

  // ---- الأوزان: مجموعها ١٠٠ حين تتوفر كل المعلومات ----
  const parts = [];
  const add = (weight, fit, whenGood, whenBad) => {
    if (fit == null) return;                     // حقل مجهول لا يُحتسب ولا يُعاقَب
    parts.push({ weight, fit });
    if (fit >= 0.85 && whenGood) reasons.push(whenGood);
    else if (fit < 0.5 && whenBad) gaps.push(whenBad);
  };

  add(20, tf,
    r.property_type === l.property_type ? `النوع مطابق: ${propertyTypeLabel(l.property_type)}` : null,
    tf != null && tf < 0.5 ? `النوع قريب لا مطابق: ${propertyTypeLabel(l.property_type)}` : null);

  const areaFit = bandFit(l.area, r.area_min, r.area_max, 0.2);
  add(22, areaFit,
    l.area ? `المساحة ${money(l.area)} م² داخل المطلوب` : null,
    l.area ? `المساحة ${money(l.area)} م² خارج المدى المطلوب` : null);

  const priceFit = bandFit(l.price, r.budget_min, r.budget_max, 0.12);
  add(26, priceFit,
    l.price ? `السعر ${money(l.price)} ريال ضمن الميزانية` : null,
    l.price && r.budget_max ? `السعر ${money(l.price)} ريال يتجاوز السقف (${money(r.budget_max)})` : null);

  // الحي: ترجيح لا إقصاء — العميل الذي فضّل شمال الرياض يشتري في شرقها
  // إذا كان العرض أفضل، لكنه يستحق أن يعرف أن الموقع ليس ما طلبه.
  if (Array.isArray(r.districts) && r.districts.length && l.district) {
    const want = r.districts.map(normalizeAr);
    const got = normalizeAr(l.district);
    const hit = want.some((w) => got.includes(w) || w.includes(got));
    add(12, hit ? 1 : 0.25,
      hit ? `الموقع ضمن المفضّل: ${l.district}` : null,
      hit ? null : `الموقع «${l.district}» خارج الأحياء المفضّلة`);
  }

  // العائد: يُقارَن بالمطلوب حين يُذكر، ويُكافأ وجوده حين لا يُذكر مطلوب.
  if (r.target_yield != null && l.yield_pct != null) {
    const fit = l.yield_pct >= r.target_yield ? 1 : clamp01(l.yield_pct / r.target_yield);
    add(14, fit,
      fit >= 0.85 ? `العائد ${l.yield_pct}% يحقق المستهدف (${r.target_yield}%)` : null,
      `العائد ${l.yield_pct}% أقل من المستهدف (${r.target_yield}%)`);
  } else if (r.income_producing === true && l.yield_pct != null) {
    add(10, clamp01(l.yield_pct / 8), `العائد ${l.yield_pct}% سنوياً`, null);
  }

  if (r.deed_type && l.deed_type) {
    add(6, normalizeAr(r.deed_type) === normalizeAr(l.deed_type) ? 1 : 0.3,
      `الصك مطابق: ${l.deed_type}`, `نوع الصك مختلف: ${l.deed_type}`);
  }

  if (!parts.length) return { score: 0, reasons, gaps, rejected: "لا توجد بيانات كافية للمطابقة" };

  // القسمة على الأوزان المتوفرة لا على ١٠٠: طلبٌ لم يذكر ميزانية يجب ألا
  // تنخفض درجته لأنه لم يذكرها — تُقاس المطابقة على ما قيل فقط.
  const sumW = parts.reduce((a, p) => a + p.weight, 0);
  const got = parts.reduce((a, p) => a + p.weight * p.fit, 0);
  let score = Math.round((got / sumW) * 100);

  // ثقة أقل حين كان المُقاس قليلاً: مطابقة بُنيت على حقلين لا تُقدَّم كأنها
  // بُنيت على خمسة. السقف يرتفع مع اتساع ما قِيس.
  const coverage = clamp01(sumW / 80);
  score = Math.round(score * (0.6 + 0.4 * coverage));

  if (l.exclusive) { score = Math.min(100, score + 3); reasons.push("عرض حصري لدى المكتب"); }
  return { score, reasons, gaps, rejected: null };
}

/** ترتيب عروض على طلب. يُسقط ما دون العتبة لأن الضجيج يُفقد الثقة. */
export function rankListings(req, listings, { min = 45, limit = 10 } = {}) {
  const out = [];
  for (const l of listings || []) {
    const m = scoreMatch(req, l);
    if (m.rejected || m.score < min) continue;
    out.push({ listing: l, ...m });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** الاتجاه المعاكس: عرضٌ وصل الآن، أي طلبٍ مفتوح ينتظره؟ */
export function rankRequests(listing, requests, { min = 45, limit = 10 } = {}) {
  const out = [];
  for (const r of requests || []) {
    if (r.status && !["OPEN", "SEARCHING", "MATCHED", "VIEWING"].includes(r.status)) continue;
    const m = scoreMatch(r, listing);
    if (m.rejected || m.score < min) continue;
    out.push({ request: r, ...m });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// ------------------------------------------------------------ نصوص جاهزة --
/** بطاقة عرض كما تُرسل للعميل في واتساب — مختصرة، وبالفجوة مذكورة. */
export function listingCard(listing, match) {
  const l = listing || {};
  const lines = [
    `*${propertyTypeLabel(l.property_type)}${l.city ? ` — ${l.city}` : ""}*`,
    l.district ? `الموقع: ${l.district}` : "",
    l.area ? `المساحة: ${money(l.area)} م²` : "",
    l.price ? `السعر: ${money(l.price)} ريال${l.price_per_m ? ` (${money(l.price_per_m)} ريال/م²)` : ""}` : "",
    l.annual_income ? `الدخل السنوي: ${money(l.annual_income)} ريال` : "",
    l.yield_pct ? `العائد: ${l.yield_pct}%` : "",
    l.deed_type ? `الصك: ${l.deed_type}` : "",
    l.location_url ? `الموقع على الخريطة: ${l.location_url}` : "",
    l.ref ? `الرقم المرجعي: ${l.ref}` : "",
  ].filter(Boolean);
  if (match && match.reasons && match.reasons.length) lines.push(`\n✅ ${match.reasons.slice(0, 3).join(" · ")}`);
  if (match && match.gaps && match.gaps.length) lines.push(`⚠️ ${match.gaps.slice(0, 2).join(" · ")}`);
  return lines.join("\n");
}

/**
 * نص طلب السوق الذي يُرسل للمسوّقين والمطوّرين.
 * موحّد عمداً: المسوّق الذي يقرأ الطلب نفسه كل مرة يعرف ما يُرسله، والعروض
 * تعود بصيغة أقرب لما يقرأه المحلل — وهذا يقصّر دورة السوق أكثر من أي أتمتة.
 */
export function broadcastText(req, officeName = "الألماس الأزرق العقارية") {
  const r = req || {};
  const area = r.area_min && r.area_max && r.area_min !== r.area_max
    ? `${money(r.area_min)} – ${money(r.area_max)} م²`
    : r.area_min ? `${money(r.area_min)} م² تقريباً` : "";
  const budget = r.budget_min && r.budget_max
    ? `${money(r.budget_min)} – ${money(r.budget_max)} ريال`
    : r.budget_max ? `حتى ${money(r.budget_max)} ريال` : r.budget_min ? `من ${money(r.budget_min)} ريال` : "";
  return [
    `*مطلوب لعميل — ${officeName}*`,
    r.property_type ? `النوع: ${propertyTypeLabel(r.property_type)}` : "",
    r.city ? `المدينة: ${r.city}${Array.isArray(r.districts) && r.districts.length ? ` (${r.districts.join("، ")})` : ""}` : "",
    area ? `المساحة: ${area}` : "",
    budget ? `الميزانية: ${budget}` : "",
    r.income_producing === true ? "الشرط: مدر للدخل بعقود قائمة" : r.income_producing === false ? "الشرط: شاغر / غير مدر" : "",
    r.target_yield ? `العائد المستهدف: ${r.target_yield}% فأعلى` : "",
    r.deed_type ? `الصك: ${r.deed_type}` : "",
    r.timeline === "IMMEDIATE" ? "الجاهزية: فوري" : "",
    "",
    "من لديه ما يطابق، يرسل: النوع · المدينة والحي · المساحة · السعر · الدخل السنوي إن وُجد · نوع الصك · موقع الخريطة.",
    r.ref ? `مرجع الطلب: ${r.ref}` : "",
  ].filter(Boolean).join("\n");
}
