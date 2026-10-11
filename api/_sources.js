// Business Partner — تصنيف مصدر المرشّح (داخلي فقط) (ESM).
//
// يملكه وكيل `recruitment-agencies`. ملف مساعد يبدأ بـ`_` فلا يُحتسب دالةً (السقف ١٢). بلا I/O: دوال نقيّة.
//
// لماذا موجود: نظام التوظيف يستقبل مرشّحين من قنوات شتّى (مكتب، مستقل، منصة، الموقع، لينكدإن، إنديد، بريد).
// يحتاج الفريق أن يعرف من أين جاء كل مرشّح ليحسب أداء القنوات — ولا يحتاج العميل ولا صاحب العمل أن يعرف.
//
// القاعدة الصلبة: **الوسم يُكتب في Notion (عمود «مصدر المرشح») ولا يخرج في أي واجهة لعميل أو صاحب عمل أو مرشّح.**
// واجهات صاحب العمل تبني ناتجها حقلاً حقلاً (mapCandidate في api/candidates.js)، فعمودٌ جديد لا يمرّ تلقائياً؛
// وtests/vendor-portal.test.mjs يفحص نصّ تلك الملفات ألّا تذكر أسماء الأعمدة الداخلية هنا.
//
// القيم المعتمدة:
//   vendor:office       مكتب استقدام / وكالة توظيف سجّلت في بوابة المورّدين
//   vendor:freelancer   مستقلّ (مُجنِّد فرد) سجّل في البوابة نفسها
//   vendor:corporate    مورّد مؤسسي (شركة قوى عاملة كبرى) — يعتمده المالك قبل أن يرى شيئاً (docs/hr-supplier-model.md)
//   platform:<name>     منصة توظيف خارجية (اسمها بحروف صغيرة وأرقام وشرطات)
//   site                تقديم المرشّح بنفسه عبر الموقع
//   linkedin · indeed   قنوات خارجية رسمية
//   email               وارد عبر البريد

export const SOURCE_PROP = "مصدر المرشح";       // عمود select في قاعدة ATS — داخلي
export const OFFICE_ID_PROP = "معرّف المكتب";    // عمود نصّي في قاعدة ATS — داخلي (ربط المرشّح بمكتبه بالمعرّف لا بالاسم)

// كل ما هو داخل ولا يجوز أن يظهر في ناتج لعميل/صاحب عمل/مرشّح: أسماء الأعمدة، ونمط قيمة الوسم نفسها.
export const INTERNAL_SOURCE_PROPS = Object.freeze([SOURCE_PROP, OFFICE_ID_PROP]);

// نوع الجهة في سجلّ المكاتب («نوع الجهة») الذي يعني «مورّد مؤسسي». القيمة تُكتب في Notion كما هي.
export const CORPORATE_KIND = "مورّد مؤسسي";

export const FIXED_SOURCES = Object.freeze(["vendor:office", "vendor:freelancer", "vendor:corporate", "site", "linkedin", "indeed", "email"]);
export const PLATFORM_PREFIX = "platform:";
const PLATFORM_RE = /^platform:[\p{L}\p{N}][\p{L}\p{N}-]{0,39}$/u;

// نمط يلتقط أي وسم مصدر داخل نصٍّ حرّ (يستعمله الحارس على مخرجات الواجهات).
export const SOURCE_TAG_RE = /\b(?:vendor:(?:office|freelancer|corporate)|platform:[\p{L}\p{N}-]+)/u;

// اسم منصة → الجزء بعد `platform:`؛ "" إن لم يبقَ شيء صالح.
export function platformSlug(name) {
  return String(name == null ? "" : name).normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}

export function platformSource(name) {
  const slug = platformSlug(name);
  return slug ? PLATFORM_PREFIX + slug : "";
}

export function isSource(tag) {
  const s = String(tag == null ? "" : tag);
  return FIXED_SOURCES.includes(s) || PLATFORM_RE.test(s);
}

// أي مدخل → وسم صالح أو "". لا يخترع قيمة: غير المعروف يعود فارغاً فلا يُكتب شيء.
export function normalizeSource(input) {
  const s = String(input == null ? "" : input).trim().toLowerCase();
  if (!s) return "";
  if (FIXED_SOURCES.includes(s)) return s;
  if (s.startsWith(PLATFORM_PREFIX)) { const p = platformSource(s.slice(PLATFORM_PREFIX.length)); return p && isSource(p) ? p : ""; }
  return "";
}

// نوع الجهة في سجلّ المكاتب («نوع الجهة») → وسم مصدر مرشّحيها.
// مستقل → vendor:freelancer · مورّد مؤسسي → vendor:corporate · منصة → platform:<اسمها> · غير ذلك (مكتب استقدام / وكالة توظيف / الاثنان / غير محدد) → vendor:office.
export function sourceForVendor(agency) {
  const kind = String((agency && agency.kind) || "").trim();
  if (kind === "مستقل") return "vendor:freelancer";
  if (kind === CORPORATE_KIND) return "vendor:corporate";
  if (kind === "منصة") return platformSource(agency && agency.name) || "vendor:office";
  return "vendor:office";
}

// خاصية Notion جاهزة للكتابة، أو null إن لم يكن الوسم صالحاً.
export function sourceProp(tag) {
  const v = normalizeSource(tag);
  return v ? { select: { name: v } } : null;
}

// يحذف الأعمدة الداخلية من كائن خصائص Notion قبل أن يُبنى منه أي ناتج عام (طبقة دفاع إضافية، لا بديل عن البناء حقلاً حقلاً).
export function stripInternalSource(properties) {
  if (!properties || typeof properties !== "object") return properties;
  const out = { ...properties };
  for (const k of INTERNAL_SOURCE_PROPS) delete out[k];
  return out;
}
