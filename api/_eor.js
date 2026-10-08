// Business Partner — خدمة «موظفون على بند التعاقد» (EOR) — الخادم (ESM).
//
// يملكه وكيل `eor`. ملف مساعد يبدأ بـ`_` فلا يُحتسب دالةً جديدة (السقف ١٢).
// المسار العام يمرّ عبر api/requests.js?__route=eor (يملكه owner-ops) ويفوّض إلى
// `handleEor(body, ctx)` أدناه — لا يقرأ هذا الملف req/res ولا يكتبهما.
//
// ما يفعله handleEor:
//   ١) يتحقق من الحمولة (أنواع وحدود وتنظيف) ويرفض البريد/الجوال/المهنة/الجنسية غير الصالحة.
//   ٢) يكتب صفاً في قاعدة Notion «BP EOR Requests» (NOTION_EOR_DB).
//   ٣) يرسل بريداً للفريق وتأكيداً للعميل، وينبّه المالك على واتساب عبر الـwebhook القائم.
//   ٤) يُرجع { ok, ref } — بلا سعر. السعر لا يظهر لعميل قبل أن يملأ المالك api/_eor-pricing.json.
//
// لا ادّعاءات نظامية هنا: نصوص نطاق العمل (buildScopeOfWork) قالبٌ عامّ يُحال فيه إلى
// «الأنظمة المعمول بها والعقد الموقَّع» دون ذكر موادّ أو أرقام.
//
// listVendorDemand(opts) في آخر الملف: يقرأ الطلبات التي وضع المالك عليها «مفتوح للمورّدين» ويعيد لكل بند مهنة
// **قائمةً بيضاء فقط** (مهنة، عدد، جنسيات، تاريخ بدء، مدة، مجال، منطقة عامة) — بلا اسم المنشأة ولا تواصل ولا سعر
// ولا ملاحظات. كل حقل يُبنى من قيمة تحقّقنا منها (لا يُنسخ كائن المصدر)، فحقلٌ جديد في الحمولة لا يمرّ تلقائياً.
//
// الأخطاء تُرجَع قيماً ({ ok:false, error, status }) لا استثناءات؛ والمستدعي يكتب status كما هو.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { EMAIL_LIVE, WHATSAPP_LIVE, outbox, DEV } from "./_mode.js";
import { OCCUPATIONS, searchOccupations } from "./_occupations.js";
import { packageRateConfigFromPricing, computePackageRate, packageClientView, computeCasualRate, casualUnitView, normalizeInsuranceFields, insuranceUiFromConfig, DEFAULT_INSURER, normalizeBillingUnit, normalizeEngagementType, parseUnitQuantity, parseCasualHours, INSURANCE_GENDERS, normalizeProvisions, provisionPlan, provisionDisplayAmounts, packageBreakdown, salaryMinFor, casualProvisionHalalas, PROVISION_KEYS } from "./_eor-cost.js";
import { isCountryCode, countryNameFromCatalog, resolveOccupationId, occupationRef, isKnownOccupation, cityById, sectorById, isSeniority, seniorityLabel, searchCatalogOccupations, catalogIdsForOld, catalogOccupations, catalogCountries, cleanAssistText, assistSystemPrompt, parseAssistOutput, ASSIST_LIMITS } from "./_eor-form.js";
import { azureChat, azureConfigured } from "./_azure.js";
import { isBillingAction, handleEorBilling } from "./_eor-billing.js";
// المسار (api/requests.js) يحسب ctx.auth للإجراءات المحجوزة ويستورد هذين من هنا مع handleEor.
export { isBillingAction, authFromSession } from "./_eor-billing.js";
// قوائم اختيار التأمين المسموحة (معرّفات فقط، لا أرقام) — تستوردها صفحة /eor من هنا لا من الحاسبة.
export { INSURANCE_CLASSES, INSURANCE_AGE_BANDS, INSURANCE_GENDERS, BILLING_UNITS, UNIT_QUANTITY_MAX, ENGAGEMENT_TYPES, CASUAL_HOURS } from "./_eor-cost.js";
// كتالوجات النموذج (الصفحة تبني منها قوائمها): الكتالوج المضغوط بلغة الصفحة والقيم المسبقة للمدة.
export { pageCatalog, DURATION_PRESETS, SENIORITY_LEVELS } from "./_eor-form.js";
export { PROVISION_KEYS } from "./_eor-cost.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN_ENV = ["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"];
const NOTION_VERSION = "2022-06-28";
const EOR_DB_DEFAULT = "11797acc09724f66a99d5a7576a66976";
const SITE = process.env.MKT_SITE_BASE || "https://www.businesspartner.sa";
const OWNER_WA_WEBHOOK_DEFAULT = "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify";

/* ═════════════ الحدود ═════════════ */
export const EOR_LIMITS = Object.freeze({
  maxItems: 20,            // بنود المهن
  maxTotalCount: 500,      // مجموع الموظفين
  maxItemCount: 500,
  maxNationalities: 10,    // لكل بند
  maxSalary: 100000,       // راتب شهري متوقع (ريال)
  minMonths: 1,
  maxMonths: 120,          // سقف وحدة «شهر» في المدة (= 10 سنوات)
  maxStartDays: 730,       // أبعد تاريخ بدء من اليوم
  company: 120, contact: 80, city: 60, email: 160, notes: 2000, source: 60,
});

// ═════════════ مدة الطلب: ساعة | يوم | شهر | سنة (أمر المالك 2026-10-08) ═════════════
// على مستوى الطلب لا البند. durationUnit قائمة بيضاء (المجهول ⇒ month)، وdurationValue عدد صحيح موجب بسقف الوحدة.
// التوافق العكسي: الطلب القديم بـdurationMonths وحده يُترجَم إلى month/القيمة نفسها.
// العمالة المرنة تقبل hour|day|month؛ التعاقد يقبل month|year. وحدة غير مقبولة تُسقَط إلى month بلا خطأ:
//   تعاقد hour/day ⇒ durationMonths القديم إن وُجد وصحّ، وإلا ceil(الساعات ÷ 720) أو ceil(الأيام ÷ 30) (مدة تقويمية)؛ مرنة year ⇒ سنوات × 12.
//   الناتج المُسقَط يُحصر في سقف الأشهر ولا يُرفض.
export const DURATION_UNITS = Object.freeze(["hour", "day", "month", "year"]);
export const DURATION_MAX = Object.freeze({ hour: 10000, day: 3650, month: 120, year: 10 });
const DURATION_ALLOWED = Object.freeze({ contract: ["month", "year"], casual: ["hour", "day", "month"] });
const durInt = (raw) => {
  if (raw === undefined || raw === null || raw === "") return { absent: true };
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  return Number.isInteger(n) && n >= 1 ? { value: n } : { invalid: true };
};
const durClamp = (m) => Math.min(Math.max(m, EOR_LIMITS.minMonths), DURATION_MAX.month);
// → { ok:true, unit, value, months (عدد الأشهر للشهر/السنة وإلا null), downgraded } | { ok:false }
export function normalizeDuration(src, engagementType) {
  const b = src && typeof src === "object" ? src : {};
  const eng = normalizeEngagementType(engagementType);
  const u = typeof b.durationUnit === "string" ? b.durationUnit.trim().toLowerCase() : "";
  let unit = DURATION_UNITS.includes(u) ? u : "month";
  const v = durInt(b.durationValue), legacy = durInt(b.durationMonths);
  if (v.invalid || legacy.invalid) return { ok: false };
  let value;
  if (!v.absent) value = v.value;
  else if (!legacy.absent) { unit = "month"; value = legacy.value; }
  else return { ok: false };
  if (value > DURATION_MAX[unit]) return { ok: false };
  let downgraded = false;
  if (!DURATION_ALLOWED[eng].includes(unit)) {
    downgraded = true;
    if (unit === "year") value = durClamp(value * 12);
    else if (!legacy.absent && legacy.value <= DURATION_MAX.month) value = legacy.value;
    else value = durClamp(Math.ceil(value / (unit === "hour" ? 720 : 30)));
    unit = "month";
  }
  return { ok: true, unit, value, months: unit === "month" ? value : unit === "year" ? value * 12 : null, downgraded };
}
const AR_DUR = { hour: ["ساعة واحدة", "ساعتان", "ساعات", "ساعة"], day: ["يوم واحد", "يومان", "أيام", "يوماً"], month: ["شهر واحد", "شهران", "أشهر", "شهراً"], year: ["سنة واحدة", "سنتان", "سنوات", "سنة"] };
// «12 شهراً» · «سنتان» · «5 أيام» — عربي للفريق؛ غير العربية بالإنجليزية.
export function durationText(unit, value, lang = "ar") {
  if (!DURATION_UNITS.includes(unit) || !Number.isInteger(value) || value < 1) return "";
  if (lang !== "ar") return `${value} ${unit}${value > 1 ? "s" : ""}`;
  const f = AR_DUR[unit];
  return value === 1 ? f[0] : value === 2 ? f[1] : value <= 10 ? `${value} ${f[2]}` : `${value} ${f[3]}`;
}

export const WORKER_TYPES = Object.freeze({ saudi: "سعوديون", foreign: "أجانب", both: "الاثنان" });
export const RECRUITMENT_VALUES = Object.freeze({ yes: "يلزم", no: "لا يلزم", unsure: "غير محدد" });
export const EOR_LANGS = ["ar", "en", "fr", "zh"];

/* ═════════════ الجنسيات (قائمة مدمجة: الرمز ISO-2 ← عربي/إنجليزي) ═════════════ */
const N = (code, ar, en) => ({ code, ar, en });
export const NATIONALITIES = Object.freeze([
  N("SA", "السعودية", "Saudi Arabia"), N("EG", "مصر", "Egypt"), N("SD", "السودان", "Sudan"),
  N("YE", "اليمن", "Yemen"), N("JO", "الأردن", "Jordan"), N("SY", "سوريا", "Syria"),
  N("LB", "لبنان", "Lebanon"), N("PS", "فلسطين", "Palestine"), N("IQ", "العراق", "Iraq"),
  N("MA", "المغرب", "Morocco"), N("TN", "تونس", "Tunisia"), N("DZ", "الجزائر", "Algeria"),
  N("LY", "ليبيا", "Libya"), N("MR", "موريتانيا", "Mauritania"), N("SO", "الصومال", "Somalia"),
  N("AE", "الإمارات", "United Arab Emirates"), N("KW", "الكويت", "Kuwait"), N("BH", "البحرين", "Bahrain"),
  N("QA", "قطر", "Qatar"), N("OM", "عُمان", "Oman"),
  N("IN", "الهند", "India"), N("PK", "باكستان", "Pakistan"), N("BD", "بنغلاديش", "Bangladesh"),
  N("LK", "سريلانكا", "Sri Lanka"), N("NP", "نيبال", "Nepal"), N("AF", "أفغانستان", "Afghanistan"),
  N("PH", "الفلبين", "Philippines"), N("ID", "إندونيسيا", "Indonesia"), N("MY", "ماليزيا", "Malaysia"),
  N("TH", "تايلاند", "Thailand"), N("VN", "فيتنام", "Vietnam"), N("MM", "ميانمار", "Myanmar"),
  N("CN", "الصين", "China"), N("KR", "كوريا الجنوبية", "South Korea"), N("JP", "اليابان", "Japan"),
  N("TR", "تركيا", "Türkiye"), N("IR", "إيران", "Iran"),
  N("KE", "كينيا", "Kenya"), N("UG", "أوغندا", "Uganda"), N("ET", "إثيوبيا", "Ethiopia"),
  N("ER", "إريتريا", "Eritrea"), N("NG", "نيجيريا", "Nigeria"), N("GH", "غانا", "Ghana"),
  N("CM", "الكاميرون", "Cameroon"), N("SN", "السنغال", "Senegal"), N("ML", "مالي", "Mali"),
  N("TZ", "تنزانيا", "Tanzania"), N("ZA", "جنوب أفريقيا", "South Africa"), N("ZW", "زيمبابوي", "Zimbabwe"),
  N("GB", "المملكة المتحدة", "United Kingdom"), N("US", "الولايات المتحدة", "United States"),
  N("CA", "كندا", "Canada"), N("AU", "أستراليا", "Australia"), N("NZ", "نيوزيلندا", "New Zealand"),
  N("FR", "فرنسا", "France"), N("DE", "ألمانيا", "Germany"), N("IT", "إيطاليا", "Italy"),
  N("ES", "إسبانيا", "Spain"), N("PT", "البرتغال", "Portugal"), N("IE", "أيرلندا", "Ireland"),
  N("RU", "روسيا", "Russia"), N("UA", "أوكرانيا", "Ukraine"), N("BR", "البرازيل", "Brazil"),
]);
const NAT_BY_CODE = new Map(NATIONALITIES.map((n) => [n.code, n]));
// قائمة بيضاء بأكواد الفهرس الكامل (٢٥٠ دولة) — القائمة المدمجة القديمة (٦٣) مجموعةٌ جزئية منها فتبقى مقبولة (توافق عكسي).
const isNat = (code) => NAT_BY_CODE.has(code) || isCountryCode(code);
// اسم الدولة: القائمة القديمة أولاً (فلا يتغيّر نص سجلٍّ قائم)، ثم الفهرس بلغة الصفحة (fr/zh لهما أسماؤهما في الفهرس).
export const nationalityName = (code, lang = "ar") => {
  const n = NAT_BY_CODE.get(code);
  if (n) return lang === "ar" ? n.ar : n.en;
  return countryNameFromCatalog(code, lang === "ar" ? "ar" : "en") || String(code || "");
};

/* ═════════════ مجال نشاط المنشأة (اختياري) ═════════════
// الاسم العربي = قيمة select «المجال» في Notion حرفياً، وهي نفسها قيم «المجال» في قاعدة «وظائف صاحب العمل»
// (نوشن 260d7695…، ٢٦ قيمة، فُحصت 2026-10-08). المعرّف (id) هو ما يسافر في الحمولة، فتغيير نص عرضٍ لا يكسر شيئاً. */
const S = (id, ar, en, fr, zh) => ({ id, ar, en, fr, zh });
export const SECTORS = Object.freeze([
  S("engineering", "هندسة", "Engineering", "Ingénierie", "工程"),
  S("it", "تقنية معلومات", "Information technology", "Technologies de l'information", "信息技术"),
  S("sales-marketing", "مبيعات وتسويق", "Sales and marketing", "Ventes et marketing", "销售与市场营销"),
  S("finance", "محاسبة ومالية", "Accounting and finance", "Comptabilité et finance", "会计与金融"),
  S("admin", "إداري وسكرتارية", "Administration and secretarial", "Administration et secrétariat", "行政与文秘"),
  S("hr", "موارد بشرية", "Human resources", "Ressources humaines", "人力资源"),
  S("hospitality", "ضيافة ومطاعم", "Hospitality and restaurants", "Hôtellerie et restauration", "酒店与餐饮"),
  S("construction", "مقاولات وإنشاءات", "Contracting and construction", "Entreprise et construction", "承包与建筑"),
  S("health", "صحة وطب", "Health and medicine", "Santé et médecine", "医疗健康"),
  S("education", "تعليم", "Education", "Éducation", "教育"),
  S("logistics", "لوجستيات ونقل", "Logistics and transport", "Logistique et transport", "物流与运输"),
  S("trades", "حرف مهنية وصيانة", "Skilled trades and maintenance", "Métiers techniques et maintenance", "技工与维修"),
  S("manufacturing", "تصنيع وصناعة", "Manufacturing and industry", "Fabrication et industrie", "制造与工业"),
  S("real-estate", "عقارات", "Real estate", "Immobilier", "房地产"),
  S("legal", "قانون", "Legal", "Juridique", "法律"),
  S("energy", "طاقة ونفط وغاز", "Energy, oil and gas", "Énergie, pétrole et gaz", "能源、石油与天然气"),
  S("media", "إعلام وإبداع", "Media and creative", "Médias et création", "媒体与创意"),
  S("government", "حكومي وقطاع عام", "Government and public sector", "Gouvernement et secteur public", "政府与公共部门"),
  S("agriculture", "زراعة وبيئة", "Agriculture and environment", "Agriculture et environnement", "农业与环境"),
  S("retail", "تجزئة وتجارة إلكترونية", "Retail and e-commerce", "Commerce de détail et e-commerce", "零售与电子商务"),
  S("security", "أمن وسلامة", "Security and safety", "Sécurité", "安保与安全"),
  S("science", "علوم وأبحاث", "Science and research", "Sciences et recherche", "科学与研究"),
  S("aviation-maritime", "طيران وبحري", "Aviation and maritime", "Aviation et maritime", "航空与海事"),
  S("beauty", "تجميل وعناية", "Beauty and personal care", "Beauté et soins", "美容与护理"),
  S("household", "خدمات منزلية", "Household services", "Services à domicile", "家政服务"),
  S("other", "أخرى", "Other", "Autre", "其他"),
]);
const SECTOR_BY_ID = new Map(SECTORS.map((x) => [x.id, x]));
const SECTOR_BY_AR = new Map(SECTORS.map((x) => [x.ar, x]));
export const sectorName = (id, lang = "ar") => { const x = SECTOR_BY_ID.get(id); return x ? (x[lang] || x.en) : ""; };

/* ═════════════ أدوات التنظيف ═════════════ */
// أحرف تحكّم وأحرف تعديل الاتجاه (تُستعمل في انتحال النصوص) تُحذف؛ \n يبقى في الملاحظات وحدها.
const CTRL_ONE = /[\u0000-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;
const CTRL_MULTI = /[\u0000-\u0009\u000B-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;
const oneLine = (v, max) => String(v == null ? "" : v).replace(CTRL_ONE, " ").replace(/\s+/g, " ").trim().slice(0, max);
const multiLine = (v, max) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(CTRL_MULTI, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
export function normalizePhone(v) {
  let p = String(v == null ? "" : v).replace(/[\s().\-‎‏]/g, "");
  // أرقام عربية-هندية → لاتينية
  p = p.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  if (p.startsWith("00")) p = "+" + p.slice(2);
  return /^\+?\d{8,15}$/.test(p) ? p : "";
}
const isoDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const riyadhToday = (nowMs) => new Date((nowMs == null ? Date.now() : nowMs) + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400e3).toISOString().slice(0, 10);

/* ═════════════ التحقق من الحمولة ═════════════ */
// العمالة المرنة: وحدة تسعير البند وكميتها لكل موظف وساعات اليوم. الوحدة بقائمة بيضاء (المجهول ⇒ شهري)، والكمية غائبة ⇒ null أو عدد صحيح موجب بسقف
// الوحدة، وساعات اليوم غائبة ⇒ null (افتراضي الإعداد) أو عدد صحيح 4–12؛ وإلا { ok:false, error }.
function readCasualFields(it) {
  const billingUnit = normalizeBillingUnit(it && it.billingUnit);
  const q = parseUnitQuantity(billingUnit, it && it.quantity);
  if (!q.ok) return { ok: false, error: "quantity_invalid" };
  const h = parseCasualHours(it && it.hoursPerDay);
  if (!h.ok) return { ok: false, error: "hours_per_day_invalid" };
  return { ok: true, value: { billingUnit, quantity: q.value, hoursPerDay: billingUnit === "daily" ? h.value : null } };
}
const fail = (error, field, extra) => ({ ok: false, status: 400, error, ...(field ? { field } : {}), ...(extra || {}) });

// الجنس (ذكر | أنثى | لا يهم): حقل واحد للبند يقرؤه التأمين أيضاً (المجهول ⇒ لا يهم = unspecified). قائمة بيضاء.
const genderOf = (it) => {
  const g = it && typeof it.gender === "string" ? it.gender.trim().toLowerCase() : "";
  return INSURANCE_GENDERS.find((x) => x === g) || "unspecified";
};

// يُرجع { ok:true, value } أو { ok:false, status:400, error, field }.
//   opts: now، pricing (لاختبار حدّ الراتب الأدنى؛ الافتراضي ملف التسعير).
export function validateEorRequest(body, opts = {}) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : null;
  if (!b) return fail("invalid_body");
  const today = riyadhToday(opts.now);
  const limits = (packageRateConfigFromPricing(opts.pricing !== undefined ? opts.pricing : loadPricing()) || {}).limits || null;

  const company = oneLine(b.company, EOR_LIMITS.company);
  if (!company) return fail("company_required", "company");
  const contactName = oneLine(b.contactName, EOR_LIMITS.contact);
  if (!contactName) return fail("contact_required", "contactName");
  const email = oneLine(b.email, EOR_LIMITS.email + 1).toLowerCase();
  if (!email || email.length > EOR_LIMITS.email || !EMAIL_RE.test(email)) return fail("email_invalid", "email");
  const phone = normalizePhone(b.phone);
  if (!phone) return fail("phone_invalid", "phone");
  // المدينة: معرّف من فهرس مدن المملكة (اختياري، المجهول يُرفض لا يُهمَل) أو نصٌّ حر (الإرسال القديم). المعرّف الصالح يُسجَّل باسمه العربي.
  let cityId = "";
  if (b.cityId != null && b.cityId !== "") {
    const cid = typeof b.cityId === "string" ? b.cityId.trim() : "";
    if (!cityById(cid)) return fail("city_invalid", "cityId");
    cityId = cid;
  }
  const city = cityId ? cityById(cityId).ar : oneLine(b.city, EOR_LIMITS.city);
  if (!city) return fail("city_required", "city");

  // مجال نشاط المنشأة: اختياري. sectorId من فهرس ISIC (١١٨) يُحوَّل بـeor_sector إلى المجال القديم (٢٦) الذي يكتبه عمود Notion؛ وsector القديم يبقى مقبولاً.
  // الغائب/الفارغ يبقى صالحاً (الإرسال القديم)، والقيمة غير المعروفة تُرفض لا تُهمَل.
  let sector = "", sectorId = "";
  if (b.sectorId != null && b.sectorId !== "") {
    const sid = typeof b.sectorId === "string" ? b.sectorId.trim() : "";
    const sx = sectorById(sid);
    if (!sx) return fail("sector_invalid", "sectorId");
    sectorId = sid;
    sector = SECTOR_BY_ID.has(sx.eor_sector) ? sx.eor_sector : "";
  } else if (b.sector != null && b.sector !== "") {
    const sid = typeof b.sector === "string" ? b.sector.trim() : "";
    if (!SECTOR_BY_ID.has(sid)) return fail("sector_invalid", "sector");
    sector = sid;
  }

  const engagementType = normalizeEngagementType(b.engagementType);      // قائمة بيضاء؛ المجهول ⇒ تعاقد (EOR)
  const workerType = String(b.workerType || "");
  if (!Object.prototype.hasOwnProperty.call(WORKER_TYPES, workerType)) return fail("worker_type_invalid", "workerType");
  const recruitment = String(b.recruitment || "");
  if (!Object.prototype.hasOwnProperty.call(RECRUITMENT_VALUES, recruitment)) return fail("recruitment_invalid", "recruitment");

  if (!Array.isArray(b.items) || b.items.length === 0) return fail("items_required", "items");
  if (b.items.length > EOR_LIMITS.maxItems) return fail("too_many_items", "items");
  const items = [];
  let total = 0;
  for (let i = 0; i < b.items.length; i++) {
    const it = b.items[i];
    if (!it || typeof it !== "object" || Array.isArray(it)) return fail("item_invalid", "items", { index: i });
    // المهنة: معرّف قديم (٢٩٧) أو من الفهرس (١٠٠٦). انظر resolveOccupationId لقاعدة التخزين.
    const occ = resolveOccupationId(String(it.occupationId || ""));
    if (!occ.ok) return fail("item_occupation_unknown", "items", { index: i });
    // مستوى الوظيفة حقلٌ منفصل (اختياري، المجهول يُرفض).
    let seniority = "";
    if (it.seniority != null && it.seniority !== "") {
      const sv = typeof it.seniority === "string" ? it.seniority.trim() : "";
      if (!isSeniority(sv)) return fail("seniority_invalid", "items", { index: i });
      seniority = sv;
    }
    const count = typeof it.count === "string" && /^\d+$/.test(it.count.trim()) ? Number(it.count.trim()) : it.count;
    if (!Number.isInteger(count) || count < 1 || count > EOR_LIMITS.maxItemCount) return fail("item_count_invalid", "items", { index: i });
    total += count;
    if (total > EOR_LIMITS.maxTotalCount) return fail("total_count_exceeded", "items", { index: i });

    let nats = [];
    if (it.nationalities != null) {
      if (!Array.isArray(it.nationalities)) return fail("nationality_invalid", "items", { index: i });
      if (it.nationalities.length > EOR_LIMITS.maxNationalities) return fail("too_many_nationalities", "items", { index: i });
      for (const c of it.nationalities) {
        const code = String(c || "").toUpperCase();
        if (!isNat(code)) return fail("nationality_unknown", "items", { index: i });
        if (!nats.includes(code)) nats.push(code);
      }
    }
    let salary = null;
    if (it.salary != null && it.salary !== "") {
      const s = typeof it.salary === "string" ? Number(it.salary.replace(/,/g, "").trim()) : it.salary;
      if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > EOR_LIMITS.maxSalary) return fail("salary_invalid", "items", { index: i });
      salary = Math.round(s * 100) / 100;
    }
    // الحدّ الأدنى للراتب (قاعدة المالك: السعودي 4000 أساسي، الأجنبي 400) على عقد التعاقد وحده؛ المرنة راتبها مرجعي لا راتب عقد.
    if (engagementType !== "casual" && salary !== null && salary > 0 && limits) {
      const wt = itemWorkerType({ nationalities: nats }, workerType);
      const min = salaryMinFor(wt, limits);
      if (min !== null && salary < min) return fail("salary_below_min", "items", { index: i, min, workerType: wt });
    }
    // التأمين من خصائص التعاقد (EOR) وحدها؛ والوحدة والكمية من خصائص العمالة المرنة وحدها.
    let extra;
    if (engagementType === "casual") {
      const un = readCasualFields(it);
      if (!un.ok) return fail(un.error, "items", { index: i });
      extra = un.value;
    } else extra = normalizeInsuranceFields(it);
    items.push({ occupationId: occ.occupationId, ...(occ.occupationCatalogId ? { occupationCatalogId: occ.occupationCatalogId } : {}), ...(seniority ? { seniority } : {}), count, nationalities: nats, salary, gender: genderOf(it), ...extra });
  }

  let startDate = "";
  if (b.startDate != null && b.startDate !== "") {
    const s = String(b.startDate);
    if (!isoDate(s) || s < addDays(today, -1) || s > addDays(today, EOR_LIMITS.maxStartDays)) return fail("start_date_invalid", "startDate");
    startDate = s;
  }
  const dur = normalizeDuration(b, engagementType);
  if (!dur.ok) return fail("duration_invalid", "durationValue");
  const dm = dur.months;

  if (b.notes != null && typeof b.notes !== "string") return fail("notes_invalid", "notes");
  if (typeof b.notes === "string" && b.notes.length > EOR_LIMITS.notes) return fail("notes_too_long", "notes");
  const notes = multiLine(b.notes, EOR_LIMITS.notes);

  const lang = EOR_LANGS.includes(b.lang) ? b.lang : "ar";
  const source = oneLine(b.source, EOR_LIMITS.source) || "site:/eor";

  return {
    ok: true,
    value: { company, contactName, email, phone, city, ...(cityId ? { cityId } : {}), sector, ...(sectorId ? { sectorId } : {}), engagementType, workerType, recruitment, items, totalCount: total, startDate, durationMonths: dm, durationUnit: dur.unit, durationValue: dur.value, provisions: normalizeProvisions(b.provisions), notes, lang, source },
  };
}

/* ═════════════ التسعير ═════════════ */
let PRICING_CACHE;
export function loadPricing() {
  if (PRICING_CACHE !== undefined) return PRICING_CACHE;
  try { PRICING_CACHE = JSON.parse(readFileSync(join(__dirname, "_eor-pricing.json"), "utf8")); } catch { PRICING_CACHE = null; }
  return PRICING_CACHE;
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const cents = (v) => Math.round(v * 100);
const sar = (c) => c / 100;

// نوع العامل لبندٍ واحد: من جنسياته إن حُدّدت، وإلا من نوع الطلب العام (سعوديون/أجانب). «الاثنان» بلا جنسية = غير محسوم.
export function itemWorkerType(item, requestType) {
  const nats = (item && item.nationalities) || [];
  if (nats.length) {
    const hasSA = nats.includes("SA");
    const hasOther = nats.some((c) => c !== "SA");
    if (hasSA && hasOther) return "mixed";
    return hasSA ? "saudi" : "foreign";
  }
  if (requestType === "saudi") return "saudi";
  if (requestType === "foreign") return "foreign";
  return "unknown";
}

// estimateQuote(items, pricing, opts{ workerType, recruitment, durationMonths, now })
//   pricing ناقص/null/منتهٍ  ⇒ { status: "pending_pricing" } فقط — لا رقم ولا مفاتيح أخرى.
//   بنودٌ نوع عاملها غير محسوم ⇒ { status: "needs_review", reasons }.
//   مكتمل ⇒ { status: "estimated", ... } بالهللة (عددٌ صحيح) داخلياً، وتقريبٌ واحد فقط: ضريبة كل مجموعٍ على حدة.
// الرواتب المصرَّح بها معلومةٌ لا تدخل الرسوم (payroll.includedInFees=false).
export function estimateQuote(items, pricing, opts = {}) {
  const PENDING = { status: "pending_pricing" };
  const list = Array.isArray(items) ? items : [];
  if (!pricing || typeof pricing !== "object" || !list.length) return PENDING;

  const today = riyadhToday(opts.now);
  if (typeof pricing.valid_from === "string" && pricing.valid_from > today) return PENDING;
  if (typeof pricing.valid_until === "string" && pricing.valid_until < today) return PENDING;
  if (typeof pricing.currency !== "string" || !pricing.currency.trim()) return PENDING;
  if (!isNum(pricing.vat_rate) || pricing.vat_rate > 1) return PENDING;

  const types = list.map((it) => itemWorkerType(it, opts.workerType));
  const known = new Set(types.filter((t) => t === "saudi" || t === "foreign"));
  const svc = pricing.service_fee_monthly_per_employee || {};
  const rec = pricing.recruitment_fee_per_employee || {};
  const needRecruit = opts.recruitment === "yes";
  for (const t of known) {
    if (!isNum(svc[t])) return PENDING;
    if (needRecruit && !isNum(rec[t])) return PENDING;
  }
  const reasons = [];
  types.forEach((t, i) => { if (t === "mixed" || t === "unknown") reasons.push({ index: i, reason: t === "mixed" ? "mixed_nationalities" : "worker_type_unclear" }); });
  if (reasons.length) return { status: "needs_review", reasons };

  const months = Number.isInteger(opts.durationMonths) && opts.durationMonths > 0 ? opts.durationMonths : null;
  let monthlyC = 0, oneTimeC = 0, payrollC = 0, withSalary = 0;
  const lines = list.map((it, i) => {
    const t = types[i];
    const perEmp = cents(svc[t]);
    const monthly = perEmp * it.count;
    const recPer = needRecruit ? cents(rec[t]) : 0;
    const oneTime = recPer * it.count;
    monthlyC += monthly; oneTimeC += oneTime;
    if (isNum(it.salary)) { payrollC += cents(it.salary) * it.count; withSalary++; }
    let recruitmentOptional = null;
    if (opts.recruitment === "unsure" && isNum(rec[t])) recruitmentOptional = sar(cents(rec[t]) * it.count);
    return {
      occupationId: it.occupationId, count: it.count, workerType: t,
      serviceFeePerEmployeeMonthly: sar(perEmp), serviceFeeMonthly: sar(monthly),
      recruitmentFeePerEmployee: needRecruit ? sar(recPer) : null, recruitmentFee: needRecruit ? sar(oneTime) : null,
      recruitmentFeeOptional: recruitmentOptional,
    };
  });
  const vatOf = (c) => Math.round(c * pricing.vat_rate);
  const block = (subC) => ({ subtotal: sar(subC), vat: sar(vatOf(subC)), total: sar(subC + vatOf(subC)) });
  const termC = months ? monthlyC * months + oneTimeC : null;
  return {
    status: "estimated",
    currency: pricing.currency.trim(),
    vatRate: pricing.vat_rate,
    validUntil: typeof pricing.valid_until === "string" ? pricing.valid_until : null,
    lines,
    monthly: block(monthlyC),
    oneTime: needRecruit ? block(oneTimeC) : null,
    term: months ? { months, ...block(termC) } : null,
    payroll: {
      declaredMonthly: withSalary === list.length ? sar(payrollC) : null,
      itemsWithSalary: withSalary, itemsTotal: list.length, includedInFees: false,
    },
    notice: "estimate_not_an_offer",
  };
}

// ═════════════ سعر الحزمة الشهري الفوري (حاسبة المالك — api/_eor-cost.js) ═════════════
// estimatePackageQuote(items, pricing, opts{ workerType, durationMonths, now })
//   يُسعِّر كل بندٍ عُرف راتبه بصيغة الإكسل (وضع lump)، للعامل الأجنبي وحده (package_rate.applies_to_worker_types).
//   ما يخرج من هنا آمنٌ للعميل: السعر الشهري للموظف وساعة الإضافي ومجموع البند فقط — لا تكلفة ولا هامش ولا ربح.
//   كتلة package_rate غائبة/مُغلقة (client_price_visible=false)/خارج الصلاحية ⇒ { status:"pending_pricing" } وحدها.
//   مدة العقد (durationMonths) معلومةٌ فقط: لا تدخل الحساب (التوزيع على 12/24/36 شهراً غير محسوم عند المالك).
// الحالات: ok (كل البنود مسعَّرة) | partial (بعضها) | none (لا بند قابل للتسعير: راتب غائب أو عامل سعودي أو مختلط) — ويبقى سطر لكل بند بحالته.
export function estimatePackageQuote(items, pricing, opts = {}) {
  const PENDING = { status: "pending_pricing" };
  const list = Array.isArray(items) ? items : [];
  if (!list.length || !pricing || typeof pricing !== "object") return PENDING;
  const cfg = packageRateConfigFromPricing(pricing);
  if (!cfg) return PENDING;
  const today = riyadhToday(opts.now);
  if ((cfg.validFrom && cfg.validFrom > today) || (cfg.validUntil && cfg.validUntil < today)) return PENDING;
  const engagement = normalizeEngagementType(opts.engagementType);
  // المدة: (durationUnit, durationValue) إن مُرِّرا، وإلا durationMonths القديم كما كان (بلا سقف جديد).
  const hasUnitValue = opts.durationValue !== undefined && opts.durationValue !== null;
  const dur = hasUnitValue ? normalizeDuration({ durationUnit: opts.durationUnit, durationValue: opts.durationValue }, engagement) : null;
  const months = dur && dur.ok ? dur.months : (Number.isInteger(opts.durationMonths) && opts.durationMonths > 0 ? opts.durationMonths : null);
  const durationOut = dur && dur.ok ? { unit: dur.unit, value: dur.value } : null;
  if (engagement === "casual") return estimateCasualQuote(list, cfg, today, months, opts, durationOut);

  let priced = 0, totalC = 0;
  const lines = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const wt = itemWorkerType(it, opts.workerType);
    const line = { index: i, count: it.count, workerType: wt };
    // الحدّ الأدنى للراتب (قاعدة المالك) قبل أي تسعير: تحته لا سعر، والواجهة تُصحّح وتعرض الرسالة. الحدّ نفسه إعدادٌ لا سرّ.
    if (isNum(it.salary) && it.salary > 0) {
      const min = salaryMinFor(wt, cfg.limits);
      if (min !== null && it.salary < min) { lines.push({ ...line, status: "below_min", minSalary: min }); continue; }
    }
    if (wt === "mixed" || wt === "unknown") { lines.push({ ...line, status: "needs_review" }); continue; }
    if (!cfg.appliesTo.includes(wt)) { lines.push({ ...line, status: "not_applicable" }); continue; }
    if (!isNum(it.salary) || it.salary <= 0) { lines.push({ ...line, status: "needs_salary" }); continue; }
    // اختيار التأمين (اختياري لكل بند): يُمرَّر فقط حين يحمل البند حقوله، والحاسبة تُسقط المجهول إلى «الأساسي».
    const insurance = "insuranceClass" in it ? { insuranceClass: it.insuranceClass, ageBand: it.ageBand, gender: it.gender, maternity: it.maternity, chronic: it.chronic, insurer: it.insurer } : undefined;
    const res = computePackageRate({ mode: "lump", package: it.salary, insurance, config: { ...cfg, today } });
    const view = packageClientView(res, cfg);
    if (view.status !== "ok") return PENDING;      // حاسبة ناقصة أو مغلقة: لا رقم لأي بند
    // السكن والإعاشة والمواصلات «علينا»: قيمة شهرية لكل فرد تُضاف فوق السعر بلا هامش. قيمة ناقصة في الإعداد لبندٍ اختاره العميل ⇒ لا رقم.
    const plan = provisionPlan(opts.provisions, it.salary, cfg);
    if (plan.status !== "ok") return PENDING;
    const perEmpC = cents(view.monthlyPrice) + plan.totalHalalas;
    const monthlyC = perEmpC * it.count;
    totalC += monthlyC; priced++;
    const breakdown = packageBreakdown(res, plan, cfg);        // null إن أُغلق التفصيل (قرار المالك: client_breakdown_visible)
    lines.push({ ...line, status: "priced", salary: it.salary, monthlyPerEmployee: sar(perEmpC), otHour: view.otHour, monthlyTotal: sar(monthlyC), ...(view.insurance ? { insurance: view.insurance } : {}), ...(breakdown ? { breakdown } : {}) });
  }
  // أعلام واجهة فقط (منطقية): هل يُعرض اختيار التأمين وإضافتاه؟ لا أرقام.
  // + قائمة الشركات (معرّف واسمان) وأوصاف الفئات للواجهة: لا أرقام ولا معاملات.
  const insuranceUi = insuranceUiFromConfig(cfg);
  if (!priced) return { status: "none", currency: cfg.currency, lines, insuranceUi, ...(durationOut ? { duration: durationOut } : {}), notice: "estimate_not_an_offer" };
  return {
    status: priced === list.length ? "ok" : "partial",
    currency: cfg.currency,
    lines,
    insuranceUi,
    monthlyTotal: sar(totalC),
    durationMonths: months,
    ...(durationOut ? { duration: durationOut } : {}),
    // مدة بالسنة: إجمالي تقديري = السعر الشهري × 12 × السنوات (سعر البيع الذي يراه العميل نفسه، بلا ربح أو معاملات).
    ...(durationOut && durationOut.unit === "year" ? { termTotal: sar(totalC * 12 * durationOut.value) } : {}),
    notice: "estimate_not_an_offer",
  };
}

// ═════════════ العمالة المرنة (Casual): سعر الوحدة (ساعة/يوم/شهر) وإجمالي الكمية — حاسبة api/_eor-cost.js ═════════════
// الراتب المرجعي الذي يدخله العميل هو أساس الحساب؛ المعاملات وأجر العامل والربح داخلية. يخرج للعميل: سعر الوحدة وإجمالي الكمية
// (= سعر الوحدة × الكمية لكل موظف × عدد الموظفين) فقط، وساعات اليوم التي اختارها هو. لا تأمين ولا ساعة إضافي ولا سعر شهري EOR.
// أي إعداد ناقص/مغلق (package_rate.client_price_visible أو casual.client_visible) ⇒ { status:"pending_pricing" } وحدها.
function estimateCasualQuote(list, cfg, today, months, opts, durationOut) {
  const PENDING = { status: "pending_pricing" };
  const k = cfg.casual;
  if (!k) return PENDING;
  let priced = 0, unitC = 0, complete = true;
  const lines = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const wt = itemWorkerType(it, opts.workerType);
    const line = { index: i, count: it.count, workerType: wt };
    if (wt === "mixed" || wt === "unknown") { lines.push({ ...line, status: "needs_review" }); continue; }
    if (!k.appliesTo.includes(wt)) { lines.push({ ...line, status: "not_applicable" }); continue; }
    if (!isNum(it.salary) || it.salary <= 0) { lines.push({ ...line, status: "needs_salary" }); continue; }
    const res = computeCasualRate({ package: it.salary, hoursPerDay: it.hoursPerDay, config: { ...cfg, today } });
    const uv = casualUnitView(res, cfg, it.billingUnit);
    if (uv.status !== "ok") return PENDING;        // حاسبة ناقصة أو مغلقة أو ساعات يوم خارج الإعداد: لا رقم لأي بند
    // السكن/الإعاشة/المواصلات «علينا»: القيمة الشهرية موزَّعة على الوحدة (يوم = ÷30، ساعة = ÷(30×ساعات اليوم المرجعية)) — قرار مفتوح للمالك.
    const plan = provisionPlan(opts.provisions, it.salary, cfg);
    if (plan.status !== "ok") return PENDING;
    const provLines = [];
    let provC = 0;
    for (const x of plan.items) {
      const h = casualProvisionHalalas(x.halalas, uv.unit, cfg.casual);
      if (h === null) return PENDING;
      provLines.push({ key: x.key, amount: sar(h) }); provC += h;
    }
    const unitPriceC = cents(uv.unitPrice) + provC;
    const qty = parseUnitQuantity(uv.unit, it.quantity);
    const quantity = qty.ok ? qty.value : null;
    const totalU = quantity === null ? null : unitPriceC * quantity * it.count;
    if (totalU === null) complete = false; else unitC += totalU;
    priced++;
    lines.push({ ...line, status: "priced", salary: it.salary, unit: { status: "ok", billingUnit: uv.unit, unitPrice: sar(unitPriceC), quantity, ...(uv.hoursPerDay ? { hoursPerDay: uv.hoursPerDay } : {}), ...(provLines.length ? { provisions: provLines } : {}), total: totalU === null ? null : sar(totalU) } });
  }
  const insuranceUi = insuranceUiFromConfig(null);          // لا تأمين في المرنة: الأعلام مغلقة والقوائم فارغة
  if (!priced) return { status: "none", engagementType: "casual", currency: cfg.currency, lines, insuranceUi, ...(durationOut ? { duration: durationOut } : {}), notice: "estimate_not_an_offer" };
  return {
    status: priced === list.length ? "ok" : "partial",
    engagementType: "casual",
    currency: cfg.currency,
    lines,
    insuranceUi,
    ...(complete ? { unitTotal: sar(unitC) } : {}),
    durationMonths: months,
    ...(durationOut ? { duration: durationOut } : {}),
    notice: "estimate_not_an_offer",
  };
}

// يُنظّف بنود طلب السعر (count وnationalities وsalary فقط) — لا مهنة ولا أي بيان تواصل. { ok, items } | { ok:false, ... }
function normalizePriceItems(rawItems, engagementType) {
  if (!Array.isArray(rawItems) || !rawItems.length) return fail("items_required", "items");
  if (rawItems.length > EOR_LIMITS.maxItems) return fail("too_many_items", "items");
  const items = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    if (!it || typeof it !== "object" || Array.isArray(it)) return fail("item_invalid", "items", { index: i });
    const count = typeof it.count === "string" && /^\d+$/.test(it.count.trim()) ? Number(it.count.trim()) : it.count;
    if (!Number.isInteger(count) || count < 1 || count > EOR_LIMITS.maxItemCount) return fail("item_count_invalid", "items", { index: i });
    const nats = [];
    if (it.nationalities != null) {
      if (!Array.isArray(it.nationalities) || it.nationalities.length > EOR_LIMITS.maxNationalities) return fail("nationality_invalid", "items", { index: i });
      for (const c of it.nationalities) {
        const code = String(c || "").toUpperCase();
        if (!isNat(code)) return fail("nationality_unknown", "items", { index: i });
        if (!nats.includes(code)) nats.push(code);
      }
    }
    let salary = null;
    if (it.salary != null && it.salary !== "") {
      const s = typeof it.salary === "string" ? Number(it.salary.replace(/,/g, "").trim()) : it.salary;
      if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > EOR_LIMITS.maxSalary) return fail("salary_invalid", "items", { index: i });
      salary = Math.round(s * 100) / 100;
    }
    let extra;
    if (engagementType === "casual") {
      const un = readCasualFields(it);
      if (!un.ok) return fail(un.error, "items", { index: i });
      extra = un.value;
    } else extra = normalizeInsuranceFields(it);
    items.push({ count, nationalities: nats, salary, gender: genderOf(it), ...extra });
  }
  return { ok: true, items };
}

/* ═════════════ نطاق العمل (قالب ثابت بلا ادعاءات نظامية) ═════════════ */
const SOW = {
  ar: {
    title: "نطاق العمل — موظفون على بند التعاقد (EOR)",
    secs: {
      summary: "ملخص الطلب",
      company: "ما تقدّمه Business Partner",
      client: "ما على العميل",
      term: "المدة",
      delivery: "التسليم",
      excl: "الاستثناءات",
    },
    lbl: { client: "العميل", total: "إجمالي الموظفين", workers: "نوع العاملين", recruit: "الاستقدام", start: "تاريخ البدء", months: "أشهر", tbd: "يُحدَّد في العرض", count: "العدد", nat: "الجنسيات", any: "غير محدّدة", sal: "الراتب الشهري المتوقع", sar: "ريال", prov: "توفّره Business Partner (بحسب طلبك)", provNames: { housing: "السكن", meals: "الإعاشة", transport: "المواصلات" } },
    company: [
      "العمل صاحبَ عملٍ رسمياً (جهة التعاقد) للعاملين المحدّدين في هذا الطلب، بموجب اتفاقية موقّعة مع العميل.",
      "إعداد عقود العاملين وإدارة ملفاتهم الوظيفية.",
      "تشغيل الرواتب في مواعيدها المتفق عليها وفق بيانات الحضور التي يعتمدها العميل.",
      "ترتيب التأمينات والإجازات والمستحقات المرتبطة بالعاملين بحسب الأنظمة المعمول بها وما تنصّ عليه الاتفاقية.",
      "إدارة إنهاء التعاقد والتسوية النهائية للمستحقات وفق الاتفاقية والأنظمة المعمول بها.",
    ],
    recruitYes: "الاستقدام والتوطين عند الحاجة: البحث عن المرشّحين المناسبين للمهن المطلوبة ومتابعة إجراءات الاستقدام عبر القنوات الرسمية، بحسب الحالة ودون وعدٍ بنتيجةٍ أو بمدّةٍ محدّدة.",
    recruitUnsure: "الاستقدام: يُبحث مع العميل عند مراجعة الطلب إن كان لازماً.",
    client_: [
      "توجيه العاملين في العمل اليومي وتوفير موقع العمل وأدواته وبيئةً آمنة.",
      "تزويدنا بوصفٍ وظيفيٍّ دقيق لكل مهنة، وببيانات الحضور في المواعيد المتفق عليها.",
      "اعتماد المسيّرات والفواتير ودفعها في مواعيدها.",
      "إبلاغنا مسبقاً بأي تغيير في أعداد العاملين أو مهامّهم أو مواقعهم.",
    ],
    delivery: "تبدأ الخدمة بعد توقيع الاتفاقية واكتمال متطلبات التعاقد والموافقات اللازمة. المواعيد الفعلية تُحدَّد في عرض السعر ولا تُعدّ التزاماً قبل توقيعه.",
    excl: [
      "رواتب العاملين وبدلاتهم وتكاليفهم المباشرة ما لم يُنصّ عليها في عرض السعر.",
      "الرسوم الحكومية ما لم يُنصّ عليها في عرض السعر.",
      "أي مهنةٍ أو عددٍ أو موقعٍ غير مذكورٍ في هذا النطاق.",
      "ضمان الموافقات أو التأشيرات أو توفّر مرشّحين بمواصفاتٍ أو جنسياتٍ بعينها.",
    ],
  },
  en: {
    title: "Scope of work — Employer of Record (EOR)",
    secs: {
      summary: "Request summary",
      company: "What Business Partner provides",
      client: "What the client provides",
      term: "Term",
      delivery: "Delivery",
      excl: "Exclusions",
    },
    lbl: { client: "Client", total: "Total employees", workers: "Worker type", recruit: "Recruitment", start: "Start date", months: "months", tbd: "To be set in the quote", count: "Headcount", nat: "Nationalities", any: "Not specified", sal: "Expected monthly salary", sar: "SAR", prov: "Provided by Business Partner (as requested)", provNames: { housing: "Housing", meals: "Meals", transport: "Transport" } },
    company: [
      "Acting as the official employer (contracting entity) of the workers named in this request, under an agreement signed with the client.",
      "Preparing employment contracts and managing the workers' employment files.",
      "Running payroll on the agreed dates, based on the attendance data the client approves.",
      "Arranging insurance, leave and end-of-service entitlements as required by the regulations in force and the agreement.",
      "Managing contract termination and final settlement of entitlements in line with the agreement and the regulations in force.",
    ],
    recruitYes: "Recruitment and localization where needed: sourcing suitable candidates for the requested occupations and following the recruitment procedures through official channels, case by case, with no promise of an outcome or a fixed timeline.",
    recruitUnsure: "Recruitment: whether it is needed is discussed with the client when the request is reviewed.",
    client_: [
      "Directing the workers day to day and providing the workplace, tools and a safe environment.",
      "Giving us an accurate job description for each occupation, and attendance data on the agreed dates.",
      "Approving and paying payroll statements and invoices on time.",
      "Telling us in advance about any change in headcount, duties or locations.",
    ],
    delivery: "The service starts after the agreement is signed and the contracting requirements and necessary approvals are complete. Actual dates are set in the quote and are not a commitment before it is signed.",
    excl: [
      "Workers' salaries, allowances and direct costs, unless stated in the quote.",
      "Government fees, unless stated in the quote.",
      "Any occupation, headcount or location not listed in this scope.",
      "Any guarantee of approvals, visas, or the availability of candidates of specific profiles or nationalities.",
    ],
  },
};

// يُرجع { title, lang, sections:[{key,title,lines}], text }. اللغات غير العربية تُخدَّم بالإنجليزية.
export function buildScopeOfWork(request, lang = "ar") {
  const L = lang === "ar" ? "ar" : "en";
  const T = SOW[L];
  const r = request || {};
  const items = Array.isArray(r.items) ? r.items : [];
  const itemLines = items.map((it, i) => {
    const o = occupationRef(it.occupationId, it.occupationCatalogId);
    const name = o ? (L === "ar" ? `${o.nameAr} | ${o.nameEn}` : o.nameEn) : String(it.occupationId || "");
    const nats = (it.nationalities || []).map((c) => nationalityName(c, L)).join(L === "ar" ? "، " : ", ") || T.lbl.any;
    const sal = isNum(it.salary) ? ` — ${T.lbl.sal}: ${it.salary} ${T.lbl.sar}` : "";
    const lvl = it.seniority ? seniorityLabel(it.seniority, L) : "";
    return `${i + 1}) ${name}${lvl ? ` (${lvl})` : ""} — ${T.lbl.count}: ${it.count} — ${T.lbl.nat}: ${nats}${sal}`;
  });
  const total = Number.isInteger(r.totalCount) ? r.totalCount : items.reduce((s, it) => s + (Number(it.count) || 0), 0);
  const wt = { ar: WORKER_TYPES, en: { saudi: "Saudi", foreign: "Foreign", both: "Saudi and foreign" } }[L][r.workerType] || "—";
  const rc = { ar: RECRUITMENT_VALUES, en: { yes: "Needed", no: "Not needed", unsure: "Undecided" } }[L][r.recruitment] || "—";
  const summary = [
    `${T.lbl.client}: ${r.company || "—"}`,
    `${T.lbl.total}: ${total}`,
    `${T.lbl.workers}: ${wt}`,
    `${T.lbl.recruit}: ${rc}`,
    ...itemLines,
  ];
  // السكن/الإعاشة/المواصلات التي اختار العميل أن نوفّرها (ما لم يُختر شيء فلا سطر). شروطها وكلفتها في عرض السعر.
  const usProv = PROVISION_KEYS.filter((k) => r.provisions && r.provisions[k] === "us").map((k) => T.lbl.provNames[k]);
  if (usProv.length) summary.push(`${T.lbl.prov}: ${usProv.join(L === "ar" ? "، " : ", ")}`);
  const company = [...T.company];
  if (r.recruitment === "yes") company.push(T.recruitYes);
  else if (r.recruitment === "unsure") company.push(T.recruitUnsure);
  const durTxt = r.durationUnit && r.durationValue ? durationText(r.durationUnit, r.durationValue, L) : "";
  const term = [
    `${durTxt || (r.durationMonths ? r.durationMonths + " " + T.lbl.months : T.lbl.tbd)}`,
    `${T.lbl.start}: ${r.startDate || T.lbl.tbd}`,
  ];
  const sections = [
    { key: "summary", title: T.secs.summary, lines: summary },
    { key: "company", title: T.secs.company, lines: company },
    { key: "client", title: T.secs.client, lines: [...T.client_] },
    { key: "term", title: T.secs.term, lines: term },
    { key: "delivery", title: T.secs.delivery, lines: [T.delivery] },
    { key: "exclusions", title: T.secs.excl, lines: [...T.excl] },
  ];
  const text = [T.title, ...sections.map((s) => `\n${s.title}\n${s.lines.map((x) => "- " + x).join("\n")}`)].join("\n");
  return { title: T.title, lang: L, sections, text };
}

/* ═════════════ نصوص منظّمة للحفظ والتنبيه ═════════════ */
// بنود المهن بصيغة العرض للفريق (عربي دائماً — هذا سجلٌّ داخلي).
export function itemsText(items, insurerNames) {
  return (items || []).map((it, i) => {
    const o = occupationRef(it.occupationId, it.occupationCatalogId);
    const name = o ? `${o.nameAr} | ${o.nameEn}` : String(it.occupationId);
    const nats = (it.nationalities || []).map((c) => nationalityName(c, "ar")).join("، ") || "غير محدّدة";
    const lvl = it.seniority && seniorityLabel(it.seniority, "ar") ? ` — المستوى: ${seniorityLabel(it.seniority, "ar")}` : "";
    // الجنس يُكتب داخل نص التأمين لبنود التعاقد (ترتيب ثابت)؛ وللمرنة (بلا تأمين) هنا.
    const gen = !("insuranceClass" in it) && GENDER_AR[it.gender] ? ` — الجنس: ${GENDER_AR[it.gender]}` : "";
    return `${i + 1}) ${name} — العدد: ${it.count} — الجنسيات: ${nats}${lvl}${isNum(it.salary) ? ` — الراتب المتوقع: ${it.salary} ريال` : ""}${insuranceText(it, insurerNames)}${gen}${unitText(it)}`;
  }).join("\n");
}

// اختيار التأمين كما كتبه العميل (للفريق، عربي): يظهر فقط إن خالف الافتراضي. لا قسط ولا معامل.
const INS_CLASS_AR = { basic: "الأساسي", C: "الفئة C", B: "الفئة B", A: "الفئة A", quote: "فئة عليا بعرض سعر الشركة" };
const GENDER_AR = { male: "ذكر", female: "أنثى" };
function insuranceText(it, insurerNames) {
  if (!it || typeof it !== "object" || !("insuranceClass" in it)) return "";
  const n = normalizeInsuranceFields(it);
  const parts = [];
  if (n.insuranceClass !== "basic") parts.push(`التأمين: ${INS_CLASS_AR[n.insuranceClass]}`);
  // الشركة المفضّلة تفضيلٌ يخصّ الفريق (لا يغيّر السعر إلا بمعامل المالك): تُكتب إن لم تكن «أي شركة».
  if (n.insurer !== DEFAULT_INSURER) parts.push(`الشركة المفضّلة: ${(insurerNames && insurerNames[n.insurer]) || n.insurer}`);
  if (GENDER_AR[n.gender]) parts.push(`الجنس: ${GENDER_AR[n.gender]}`);
  if (n.ageBand) parts.push(`الفئة العمرية: ${n.ageBand}`);
  if (n.maternity) parts.push("أمومة");
  if (n.chronic) parts.push("مزمن");
  return parts.length ? ` — ${parts.join(" — ")}` : "";
}

// العمالة المرنة كما اختارها العميل (للفريق، عربي): الوحدة والكمية وساعات اليوم. لا سعر ولا معامل ولا أجر عامل.
const UNIT_AR = { monthly: "شهري", daily: "يومي", hourly: "بالساعة" };
function unitText(it) {
  if (!it || typeof it !== "object" || !("billingUnit" in it)) return "";
  const u = normalizeBillingUnit(it.billingUnit);
  const q = parseUnitQuantity(u, it.quantity);
  const qty = q.ok ? q.value : null;
  const h = u === "daily" ? parseCasualHours(it.hoursPerDay) : { ok: true, value: null };
  return ` — عمالة مرنة: ${UNIT_AR[u]}${qty !== null ? ` × ${qty} لكل موظف` : ""}${h.ok && h.value !== null ? ` — ${h.value} ساعات يومياً` : ""}`;
}

function quoteSummaryText(q) {
  if (!q || q.status === "pending_pricing") return "pending_pricing";
  if (q.status === "needs_review") return "needs_review";
  const t = q.term;
  return `estimated: شهري ${q.monthly.total} ${q.currency} (شامل الضريبة)` +
    (q.oneTime ? ` + استقدام مرة واحدة ${q.oneTime.total}` : "") +
    (t ? ` — إجمالي ${t.months} شهر: ${t.total}` : "");
}

// سطر للفريق عن سعر الحزمة الفوري الذي رآه العميل (ok/partial فقط؛ وإلا لا شيء يُضاف).
function packageSummaryText(p, provisions) {
  if (!p || (p.status !== "ok" && p.status !== "partial")) return "";
  const usP = PROVISION_KEYS.filter((k) => provisions && provisions[k] === "us").map((k) => PROV_AR[k]);
  const provNote = usP.length ? ` (يشمل ما علينا: ${usP.join("، ")})` : "";
  if (p.engagementType === "casual") {
    // العمالة المرنة: سعر الوحدة وإجمالي الكمية الذي رآه العميل فقط.
    const us = p.lines.filter((l) => l.status === "priced" && l.unit && l.unit.status === "ok")
      .map((l) => `بند ${l.index + 1}: ${UNIT_AR[l.unit.billingUnit]} ${l.unit.unitPrice}${l.unit.quantity !== null ? ` × ${l.unit.quantity} × ${l.count} موظف = ${l.unit.total}` : ""}`);
    return ` | عمالة مرنة (تقدير للعميل${p.status === "partial" ? "، بنود جزئية" : ""}): ${us.join("؛ ")} ${p.currency}${provNote} قبل مراجعة الفريق`;
  }
  return ` | سعر الحزمة (إكسل المالك، تقدير للعميل): شهري ${p.monthlyTotal} ${p.currency}${p.status === "partial" ? " (بنود جزئية)" : ""}${provNote} قبل مراجعة الفريق`;
}

/* ═════════════ Notion ═════════════ */
// قيمتا select «نوع التعاقد» في Notion (العمود اختياري؛ غيابه يُسقَط تلقائياً ويبقى النوع في «بنود المهن» وفي متن الصفحة).
const ENGAGEMENT_AR = { contract: "تعاقد (EOR)", casual: "عمالة مرنة" };
const MISSING_PROP_RE = /is not a property that exists|could not find property|invalid property identifier|is expected to be/i;
const chunks = (s, n = 1900) => { const out = []; const str = String(s || ""); for (let i = 0; i < str.length; i += n) out.push(str.slice(i, i + n)); return out; };
const rt = (s) => chunks(s).map((c) => ({ type: "text", text: { content: c } }));
const rtProp = (s) => ({ rich_text: s ? rt(s) : [] });

// «السكن: علينا · الإعاشة: على العميل · المواصلات: على العميل» — عربي للفريق.
const PROV_AR = { housing: "السكن", meals: "الإعاشة", transport: "المواصلات" };
export function provisionsText(p) {
  if (!p || typeof p !== "object") return "";
  return PROVISION_KEYS.map((k) => `${PROV_AR[k]}: ${p[k] === "us" ? "علينا" : "على العميل"}`).join(" · ");
}

function buildProps(ref, v, quoteText, insurerNames) {
  const props = {
    "رقم مرجعي": { title: [{ type: "text", text: { content: ref } }] },
    "الحالة": { select: { name: "جديد" } },
    "المنشأة": rtProp(v.company),
    "التواصل": rtProp(v.contactName),
    "البريد": { email: v.email },
    "الجوال": { phone_number: v.phone },
    "المدينة": rtProp(v.city),
    "نوع التعاقد": { select: { name: ENGAGEMENT_AR[v.engagementType] || ENGAGEMENT_AR.contract } },
    "نوع العاملين": { select: { name: WORKER_TYPES[v.workerType] } },
    "الاستقدام": { select: { name: RECRUITMENT_VALUES[v.recruitment] } },
    "عدد الموظفين الكلي": { number: v.totalCount },
    "بنود المهن": rtProp(itemsText(v.items, insurerNames)),
    "المدة": rtProp(durationText(v.durationUnit, v.durationValue, "ar")),
    "اللغة": { select: { name: v.lang } },
    "المصدر": rtProp(v.source),
    "تقدير عرض السعر": rtProp(quoteText),
  };
  if (Number.isInteger(v.durationMonths)) props["المدة (أشهر)"] = { number: v.durationMonths };
  if (v.startDate) props["تاريخ البدء"] = { date: { start: v.startDate } };
  if (v.sector && SECTOR_BY_ID.has(v.sector)) props["المجال"] = { select: { name: SECTOR_BY_ID.get(v.sector).ar } };
  // القطاع التفصيلي (ISIC) والسكن/الإعاشة/المواصلات: عمودا نص اختياريان (الغائب يُسقَط ويبقى المحتوى في كتلة JSON ومتن الصفحة).
  const sx = v.sectorId ? sectorById(v.sectorId) : null;
  if (sx) props["القطاع التفصيلي"] = rtProp(`${sx.ar} | ${sx.en}`);
  const pt = provisionsText(v.provisions);
  if (pt) props["السكن والإعاشة والمواصلات"] = rtProp(pt);
  if (v.notes) props["ملاحظات"] = rtProp(v.notes);
  return props;
}

// يكتب صفحةً في القاعدة. خاصية غائبة/متغيّر نوعها ⇒ تُسقَط المسمّاة وحدها وتُعاد المحاولة (نمط notionWriteOptional
// في api/candidate.js) — فلا يضيع طلبُ عميلٍ لأن أحدهم أعاد تسمية عمود. العنوان وحده غير اختياري.
export async function notionCreateOptional(doFetch, token, dbId, props, children) {
  const optional = Object.keys(props).filter((k) => k !== "رقم مرجعي");
  let cur = { ...props };
  const dropped = [];
  for (let attempt = 0; attempt <= optional.length; attempt++) {
    const r = await doFetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: dbId }, properties: cur, ...(children ? { children } : {}) }),
    });
    if (r.ok) { let id = ""; try { id = (await r.json()).id || ""; } catch {} return { ok: true, id, dropped }; }
    const body = await r.text().catch(() => "");
    if (r.status !== 400 || !MISSING_PROP_RE.test(body)) return { ok: false, status: r.status, dropped, detail: body.slice(0, 200) };
    const names = optional.filter((n) => cur[n] != null);
    const named = names.filter((n) => body.includes(n));
    const drop = named.length ? [named[0]] : names;      // نوشن يسمّي أول خاصية معيبة؛ وإن لم يسمِّ شيئاً أُسقط الكل
    if (!drop.length) return { ok: false, status: 400, dropped, detail: body.slice(0, 200) };
    console.warn("eor: Notion dropped props", drop.join(" / "), body.slice(0, 160));
    cur = { ...cur }; for (const n of drop) { delete cur[n]; dropped.push(n); }
  }
  return { ok: false, status: 400, dropped, detail: "retries_exhausted" };
}

/* ═════════════ البريد والتنبيه ═════════════ */
const RESEND_FROM = () => process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
async function defaultSendEmail(to, subject, html) {
  if (!EMAIL_LIVE) { await outbox({ kind: "email", to, subject, body: html }); return { ok: false, skipped: "email_mode" }; }
  const key = process.env.RESEND_API_KEY || "";
  if (!key) return { ok: false, error: "email_not_configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM(), to: [to], subject, html }),
    });
    return r.ok ? { ok: true } : { ok: false, error: "email_send_failed" };
  } catch { return { ok: false, error: "email_send_failed" }; }
}
async function defaultNotify(payload) {
  const url = process.env.OWNER_WA_WEBHOOK || OWNER_WA_WEBHOOK_DEFAULT;
  if (!WHATSAPP_LIVE) { await outbox({ kind: "whatsapp", to: url, subject: `${payload.source} ${payload.ref}`, body: String(payload.transcript || "").slice(0, 2000), payload }); return { ok: false, skipped: "whatsapp_mode" }; }
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return { ok: r.ok };
  } catch { return { ok: false, error: "webhook_failed" }; }
}

const row = (k, v) => `<tr><td style="padding:4px 10px;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:4px 10px"><b>${esc(v || "—")}</b></td></tr>`;
function teamEmailHtml(ref, v, quoteText, notionUrl, insurerNames) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
<h2 style="color:#0B1B5A">👥 طلب EOR جديد ${esc(ref)}</h2>
<table>${row("المنشأة", v.company)}${row("جهة التواصل", v.contactName)}${row("البريد", v.email)}${row("الجوال", v.phone)}${row("المدينة", v.city)}${row("مجال النشاط", v.sector ? sectorName(v.sector, "ar") : "")}${row("القطاع التفصيلي", v.sectorId && sectorById(v.sectorId) ? `${sectorById(v.sectorId).ar} | ${sectorById(v.sectorId).en}` : "")}${row("السكن والإعاشة والمواصلات", provisionsText(v.provisions))}${row("نوع التعاقد", ENGAGEMENT_AR[v.engagementType] || ENGAGEMENT_AR.contract)}${row("نوع العاملين", WORKER_TYPES[v.workerType])}${row("الاستقدام", RECRUITMENT_VALUES[v.recruitment])}${row("عدد الموظفين", String(v.totalCount))}${row("تاريخ البدء", v.startDate)}${row("المدة", durationText(v.durationUnit, v.durationValue, "ar") || (v.durationMonths ? v.durationMonths + " شهراً" : ""))}${row("اللغة", v.lang)}${row("تقدير السعر", quoteText)}</table>
<h3 style="color:#0B1B5A">بنود المهن</h3><pre style="font-family:inherit;white-space:pre-wrap">${esc(itemsText(v.items, insurerNames))}</pre>
${v.notes ? `<h3 style="color:#0B1B5A">ملاحظات</h3><p style="white-space:pre-wrap">${esc(v.notes)}</p>` : ""}
${notionUrl ? `<p><a href="${esc(notionUrl)}">فتح الطلب في Notion</a></p>` : ""}</div>`;
}
const CLIENT_MAIL = {
  ar: { subject: (ref) => `استلمنا طلبك — موظفون على بند التعاقد (${ref})`, html: (ref, name) => `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px"><h2 style="color:#0B1B5A">استلمنا طلبك</h2><p>مرحباً ${esc(name)}، استلمنا طلبك لخدمة «موظفون على بند التعاقد (EOR)» برقم مرجع <b style="direction:ltr;display:inline-block">${esc(ref)}</b>. سيراجعه فريقنا ونعود إليك. لم يُحدَّد سعر بعد؛ يصلك عرض السعر بعد مراجعة الطلب.</p><p style="color:#666;margin-top:22px">Business Partner · الرياض · businesspartner.sa</p></div>` },
  en: { subject: (ref) => `We received your request — Employer of Record (${ref})`, html: (ref, name) => `<div style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px"><h2 style="color:#0B1B5A">We received your request</h2><p>Hello ${esc(name)}, we received your Employer of Record request, reference <b>${esc(ref)}</b>. Our team will review it and get back to you. No price has been set yet; you will receive a quote after the review.</p><p style="color:#666;margin-top:22px">Business Partner · Riyadh · businesspartner.sa</p></div>` },
};

/* ═════════════ الحدّ من الإساءة (على مستوى النسخة، بلا مخزن) ═════════════ */
const HITS = new Map();
const RL = { windowMs: 10 * 60e3, max: 6 };
function rateLimited(ip, nowMs) {
  if (!ip) return false;
  const arr = (HITS.get(ip) || []).filter((t) => nowMs - t < RL.windowMs);
  if (arr.length >= RL.max) { HITS.set(ip, arr); return true; }
  arr.push(nowMs); HITS.set(ip, arr);
  if (HITS.size > 5000) { for (const [k, v] of HITS) if (!v.some((t) => nowMs - t < RL.windowMs)) HITS.delete(k); }
  return false;
}
export const _resetEorRateLimit = () => { HITS.clear(); ASSIST_HITS.clear(); };

// المستشار الذكي: حدّ أضيق (استدعاء نموذج مدفوع) — ٨ في ١٠ دقائق لكل IP، على مستوى النسخة بلا مخزن. بلا IP ⇒ لا حدّ (الاختبارات).
const ASSIST_HITS = new Map();
const ASSIST_RL = { windowMs: 10 * 60e3, max: 8 };
function assistRateLimited(ip, nowMs) {
  if (!ip) return false;
  const arr = (ASSIST_HITS.get(ip) || []).filter((t) => nowMs - t < ASSIST_RL.windowMs);
  if (arr.length >= ASSIST_RL.max) { ASSIST_HITS.set(ip, arr); return true; }
  arr.push(nowMs); ASSIST_HITS.set(ip, arr);
  if (ASSIST_HITS.size > 5000) { for (const [k, v] of ASSIST_HITS) if (!v.some((t) => nowMs - t < ASSIST_RL.windowMs)) ASSIST_HITS.delete(k); }
  return false;
}

// عميل النموذج الافتراضي: Azure OpenAI (المزوّد الوحيد في المنصة، api/_azure.js — نفس عميل المستشارين). ctx.assistChat(system, userText) → نص يحقنه الاختبار.
const defaultAssistChat = (system, text) => azureChat({ system, messages: [{ role: "user", content: text }], maxTokens: 900, temperature: 0.1, json: true, timeoutMs: 25000 });

// يستنتج نوع العاملين من جنسيات البنود: كلها سعودية ⇒ saudi، ولا سعودية فيها ⇒ foreign، وخليط ⇒ both، وبلا جنسيات ⇒ null.
function workerTypeFromItems(items) {
  const nats = items.flatMap((it) => it.nationalities || []);
  if (!nats.length) return null;
  const sa = nats.includes("SA"), other = nats.some((c) => c !== "SA");
  return sa && other ? "both" : sa ? "saudi" : "foreign";
}

// handleAssist → { ok:true, suggestion, unresolved } | { ok:false, status, error }
//   لا شيء يُكتب ولا يُرسل: الاقتراح يعود للواجهة لتتحقق منه وتعرضه للتأكيد. غياب الخدمة أو فشلها ⇒ assist_unavailable (503) والنموذج يعمل يدوياً.
async function handleAssist(body, ctx, nowMs) {
  const text = cleanAssistText(body.text);
  if (text.length < ASSIST_LIMITS.minText) return fail("assist_text_required", "text");
  if (assistRateLimited(ctx.ip, nowMs)) return { ok: false, status: 429, error: "rate_limited" };
  const chat = typeof ctx.assistChat === "function" ? ctx.assistChat : (azureConfigured() ? defaultAssistChat : null);
  if (!chat) return { ok: false, status: 503, error: "assist_unavailable" };
  const today = riyadhToday(nowMs);
  let raw;
  try { raw = await chat(assistSystemPrompt(today), text); } catch (e) {
    console.error("eor assist model error", String((e && e.message) || e).slice(0, 120));
    return { ok: false, status: 503, error: "assist_unavailable" };
  }
  const parsed = parseAssistOutput(raw, { today });
  if (!parsed.ok) return { ok: false, status: 502, error: "assist_unusable" };
  const sg = parsed.suggestion;
  // المدة: وحدة من القائمة البيضاء وقيمة ضمن سقف الوحدة (الإسقاط حسب نوع التعاقد تتولاه الواجهة عند التطبيق). ساعة/يوم ⇒ عمالة مرنة.
  let duration = null;
  if (sg.duration && DURATION_UNITS.includes(sg.duration.unit) && sg.duration.value >= 1 && sg.duration.value <= DURATION_MAX[sg.duration.unit]) duration = sg.duration;
  else if (sg.duration) parsed.unresolved.push({ field: "duration", text: `${sg.duration.value} ${sg.duration.unit}`.slice(0, 30) });
  const engagementType = duration && (duration.unit === "hour" || duration.unit === "day") ? "casual" : sg.engagementType;
  return {
    ok: true,
    suggestion: {
      engagementType, workerType: workerTypeFromItems(sg.items),
      items: sg.items.map((it) => ({ occupationId: it.occupationCatalogId, occupationLabel: it.occupationLabel, count: it.count, nationalities: it.nationalities, gender: it.gender, seniority: it.seniority, salary: it.salary })),
      cityId: sg.cityId, sectorId: sg.sectorId, startDate: sg.startDate, duration, provisions: sg.provisions, note: sg.note,
    },
    unresolved: parsed.unresolved,
  };
}

// أسماء الشركات العربية للفريق من الإعداد (id → nameAr)، وتصحيح اختيار الشركة بقائمة الإعداد: المجهول ⇒ any (فشل مغلق).
function insurerNamesOf(cfg) {
  const m = {};
  const ins = cfg && cfg.insurance && cfg.insurance.insurers;
  if (ins) for (const [id, x] of Object.entries(ins)) if (x.nameAr) m[id] = x.nameAr;
  return m;
}
function resolveInsurers(items, cfg) {
  const ins = (cfg && cfg.insurance && cfg.insurance.insurers) || {};
  return (items || []).map((it) => (it && typeof it === "object" && "insurer" in it && !ins[it.insurer] ? { ...it, insurer: DEFAULT_INSURER } : it));
}

/* ═════════════ المعالج ═════════════ */
// handleEor(body, ctx) → { ok:true, ref } | { ok:false, status, error, field? }
//   body: الحمولة (انظر validateEorRequest) أو { action:"search", q } لبحث المهن.
//   ctx (كلّها اختيارية؛ owner-ops يمرّر ما عنده ليتطابق السلوك مع بقية الطلبات):
//     ip, sendEmail(to,subject,html)→{ok,skipped?}, notify(payload)→{ok,skipped?},
//     teamEmail, ownerEmail, fetch, notionToken, dbId, dev, now, pricing, refGen
export async function handleEor(body, ctx = {}) {
  const nowMs = ctx.now != null ? ctx.now : Date.now();

  // الفوترة الشهرية (تنسيب → ورقة دوام → اعتماد العميل → فاتورة): مصادقة إلزامية يمرّرها المسار في ctx.auth، ويفشل مغلقاً بدونها.
  if (body && typeof body === "object" && isBillingAction(body.action)) {
    return handleEorBilling(body, { ...ctx, pricing: ctx.pricing !== undefined ? ctx.pricing : loadPricing(), now: nowMs });
  }

  // بحث المهن بالتصنيف الموحّد (مع المرادفات) — نتائجه {id,nameAr,nameEn} فقط.
  if (body && typeof body === "object" && body.action === "search") {
    const q = oneLine(body.q, 80);
    if (q.length < 2) return { ok: true, results: [] };
    // results: المصنِّف القديم بمرادفاته (CDP، chef de partie…) كما كان؛ catalog: مهن الفهرس (١٠٠٦) بمعرّفاتها — الصفحة تستعمل الثانية وتُكمل بالأولى.
    const old = searchOccupations(q, { limit: 8 });
    const mapped = {};
    for (const o of old) { const ids = catalogIdsForOld(o.id).slice(0, 4); if (ids.length) mapped[o.id] = ids; }     // المعرّف القديم ← معرّفات الفهرس المقابلة
    return {
      ok: true,
      results: old.map((o) => ({ id: o.id, nameAr: o.nameAr, nameEn: o.nameEn })),
      catalog: searchCatalogOccupations(q, 8),
      mapped,
    };
  }

  // السعر الشهري الفوري للموظف حين يُعرف راتبه: حسابٌ صِرف بلا كتابة ولا بريد، ويُرجع للعميل السعر وساعة الإضافي فقط.
  if (body && typeof body === "object" && body.action === "price") {
    const wt = String(body.workerType || "");
    if (!Object.prototype.hasOwnProperty.call(WORKER_TYPES, wt)) return fail("worker_type_invalid", "workerType");
    const engagement = normalizeEngagementType(body.engagementType);
    const n = normalizePriceItems(body.items, engagement);
    if (!n.ok) return n;
    // المدة هنا متساهلة (تقدير فوري): الفاسد يُهمَل ولا يُرفض الطلب. الوحدة/القيمة الجديدتان، وإلا durationMonths القديم.
    const explicitDur = body.durationValue !== undefined && body.durationValue !== null && body.durationValue !== "";
    const dur = explicitDur ? normalizeDuration(body, engagement) : { ok: false };      // الطلب القديم (durationMonths وحده) يبقى على مساره كما كان
    const dm = typeof body.durationMonths === "string" && /^\d+$/.test(body.durationMonths.trim()) ? Number(body.durationMonths.trim()) : body.durationMonths;
    const pricingNow = ctx.pricing !== undefined ? ctx.pricing : loadPricing();
    return { ok: true, quote: estimatePackageQuote(n.items, pricingNow, { workerType: wt, durationMonths: dur.ok ? dur.months : (Number.isInteger(dm) ? dm : null), durationUnit: dur.ok ? dur.unit : undefined, durationValue: dur.ok ? dur.value : undefined, now: nowMs, engagementType: engagement, provisions: normalizeProvisions(body.provisions) }) };
  }

  // إعدادات النموذج التي تحتاجها الواجهة قبل أي سعر: حدّا الراتب الأدنى (سعودي/أجنبي) وقيمة السكن/الإعاشة/المواصلات الشهرية لعرضها بجانب «علينا»،
  // وهل التفصيل مفتوح. أرقام إعدادٍ علنية بقرار المالك لا معاملات؛ مغلق سعر العميل ⇒ تختفي قيم البنود.
  if (body && typeof body === "object" && body.action === "form_config") {
    const pc = packageRateConfigFromPricing(ctx.pricing !== undefined ? ctx.pricing : loadPricing());
    const lim = (pc && pc.limits) || {};
    return { ok: true, config: {
      salaryMin: { saudi: lim.saudiMin == null ? null : lim.saudiMin, foreign: lim.foreignMin == null ? null : lim.foreignMin },
      provisions: pc ? provisionDisplayAmounts(pc) : { housing: null, meals: null, transport: null },
      breakdown: !!(pc && pc.clientBreakdownVisible && pc.clientPriceVisible),
    } };
  }

  // المستشار الذكي داخل النموذج: نصٌّ حر ⇒ حقول مقترحة موثَّقة بالقوائم البيضاء (لا كتابة ولا إرسال؛ العميل يؤكّد في الواجهة).
  if (body && typeof body === "object" && body.action === "assist") return handleAssist(body, ctx, nowMs);

  // الفخّ: حقلٌ مخفيّ لا يملؤه إنسان. نردّ نجاحاً كاذباً ولا نكتب شيئاً.
  if (body && typeof body === "object" && String(body.website || "").trim()) {
    return { ok: true, ref: "EOR-" + String(randomInt(100000, 1000000)) };
  }

  const checked = validateEorRequest(body, { now: nowMs, ...(ctx.pricing !== undefined ? { pricing: ctx.pricing } : {}) });
  if (!checked.ok) return checked;
  if (rateLimited(ctx.ip, nowMs)) return { ok: false, status: 429, error: "rate_limited" };
  const v = checked.value;

  const ref = typeof ctx.refGen === "function" ? ctx.refGen() : "EOR-" + String(randomInt(100000, 1000000));
  const pricing = ctx.pricing !== undefined ? ctx.pricing : loadPricing();
  const quote = estimateQuote(v.items, pricing, { workerType: v.workerType, recruitment: v.recruitment, durationMonths: v.durationMonths, now: nowMs });
  // شركة التأمين المفضّلة تُفحص بقائمة الإعداد (المجهولة ⇒ any) قبل أي حفظ؛ والأسماء العربية للفريق من الإعداد نفسه.
  const pcfg = packageRateConfigFromPricing(pricing);
  const insurerNames = insurerNamesOf(pcfg);
  v.items = resolveInsurers(v.items, pcfg);
  const pkg = estimatePackageQuote(v.items, pricing, { workerType: v.workerType, durationMonths: v.durationMonths, durationUnit: v.durationUnit, durationValue: v.durationValue, now: nowMs, engagementType: v.engagementType, provisions: v.provisions });
  const quoteText = quoteSummaryText(quote) + packageSummaryText(pkg, v.provisions);

  // — Notion —
  const dev = ctx.dev != null ? ctx.dev : DEV;
  const token = ctx.notionToken !== undefined ? ctx.notionToken : envFrom(NOTION_TOKEN_ENV);
  const dbId = ctx.dbId || process.env.NOTION_EOR_DB || EOR_DB_DEFAULT;
  const props = buildProps(ref, v, quoteText, insurerNames);
  const children = [{ object: "block", type: "code", code: { language: "json", rich_text: rt(JSON.stringify({ ref, ...v, quote }, null, 1)) } }];
  let stored = false, notionUrl = "";
  const doFetch = ctx.fetch || fetch;
  if (dev && !ctx.fetch) {
    await outbox({ kind: "crm", to: `notion:${dbId}`, subject: `EOR ${ref}`, body: itemsText(v.items, insurerNames), props });
    stored = true;
  } else if (token) {
    try {
      const w = await notionCreateOptional(doFetch, token, dbId, props, children);
      stored = w.ok;
      if (w.ok && w.id) notionUrl = "https://www.notion.so/" + String(w.id).replace(/-/g, "");
      if (!w.ok) console.error("eor notion error", w.status, w.detail);
    } catch (e) { console.error("eor notion exception", String(e).slice(0, 150)); }
  }

  // — بريد + تنبيه — لا يُفشل أحدُهما الطلب؛ الطلب «مستلَم» إن حُفظ أو وصل أحدهما.
  const sendEmail = ctx.sendEmail || defaultSendEmail;
  const notify = ctx.notify || defaultNotify;
  const teamEmail = ctx.teamEmail || process.env.BOOKING_EMAIL || "business@businesspartner.sa";
  const ownerEmail = ctx.ownerEmail || (process.env.BP_OWNER_EMAIL || "business@businesspartner.sa").toLowerCase();
  const tpl = v.lang === "ar" ? CLIENT_MAIL.ar : CLIENT_MAIL.en;
  const subject = `👥 طلب EOR جديد ${ref} — ${v.company} · ${v.totalCount} موظف`;
  const html = teamEmailHtml(ref, v, quoteText, notionUrl, insurerNames);
  const transcript = `👥 طلب EOR جديد (${ref}): عميل (${v.company}) طلب خدمة EOR بعدد ${v.totalCount} موظف — المهن: ${v.items.map((it) => { const o = occupationRef(it.occupationId, it.occupationCatalogId); return `${o ? o.nameAr : it.occupationId} ×${it.count}`; }).join("، ")} — ${v.city} — ${v.contactName} ${v.phone}`;
  const settled = await Promise.allSettled([
    sendEmail(teamEmail, subject, html),
    ownerEmail && ownerEmail !== teamEmail ? sendEmail(ownerEmail, subject, html) : Promise.resolve({ ok: true, skipped: "same_as_team" }),
    sendEmail(v.email, tpl.subject(ref), tpl.html(ref, v.contactName)),
    notify({
      source: "eor-request", ref, name: v.contactName, company: v.company, phone: v.phone, email: v.email, city: v.city,
      total: v.totalCount, transcript, url: notionUrl || `${SITE}/ops`,
      eor: { engagementType: v.engagementType, workerType: v.workerType, recruitment: v.recruitment, durationMonths: v.durationMonths, durationUnit: v.durationUnit, durationValue: v.durationValue, startDate: v.startDate, items: v.items, quote: quoteText },
    }),
  ]);
  const val = (s) => (s.status === "fulfilled" && s.value ? s.value : { ok: false });
  const [teamMail, , , wa] = settled.map(val);
  const reached = !!(teamMail.ok || teamMail.skipped || wa.ok || wa.skipped);
  if (!stored && !reached) {
    console.error("eor: request not stored and not delivered", ref);
    return { ok: false, status: 502, error: "unavailable" };
  }
  if (!stored) console.error("eor: Notion write failed — delivered by email/notify only", ref);
  return { ok: true, ref };
}

/* ═════════════ طلبات مجهولة العميل لبوابة المورّدين ═════════════
// المصدر: صفوف قاعدة «BP EOR Requests» التي وضع المالك عليها «مفتوح للمورّدين» وحالتها ليست «مغلق».
// الناتج لكل بند مهنة هذه الحقول فقط (VENDOR_ITEM_FIELDS). لا يمرّ شيء آخر: لا المنشأة ولا التواصل ولا البريد ولا الجوال
// ولا الملاحظات ولا الراتب المتوقع ولا تقدير السعر ولا عنوان. كل قيمة تُبنى من مدخلٍ تحقّقنا منه (تصنيف المهن، قائمة الجنسيات،
// قائمة المجالات، تاريخ ISO، أعداد صحيحة، قائمة مدن عامة) — لا يُنسخ كائن المصدر ولا يُمرَّر نصٌّ حرّ من العميل. */
const PROP_OPEN = "مفتوح للمورّدين";
const PROP_LAUNCH = "تاريخ الإطلاق";
export const VENDOR_ITEM_FIELDS = Object.freeze(["ref", "itemId", "occupationId", "nameAr", "nameEn", "count", "nationalities", "startDate", "durationMonths", "sector", "region"]);
export const VENDOR_DEMAND_MAX = 100;
const VENDOR_MAX_PAGES = 5;          // ٥٠٠ صفٍّ كحدّ أقصى للمسح قبل الترتيب
const VENDOR_BODY_PARALLEL = 5;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/;

// المدينة حقلٌ حرّ قد يحمل عنواناً («الرياض، حي الملقا، شارع…»). لا نعرضه أبداً: نعرض مدينة من هذه القائمة فقط إذا كان
// الحقل كله اسمها وحدها (بعد التطبيع)، وإلا «السعودية».
const COUNTRY_REGION = "السعودية";
const CITY_GROUPS = [
  ["الرياض", "riyadh"], ["جدة", "jeddah", "jedda"], ["مكة المكرمة", "مكة", "makkah", "mecca"], ["المدينة المنورة", "المدينة", "madinah", "medina"],
  ["الدمام", "dammam"], ["الخبر", "khobar", "al khobar"], ["الظهران", "dhahran"], ["الجبيل", "jubail"], ["الأحساء", "الاحساء", "hofuf", "al ahsa", "ahsa"],
  ["القطيف", "qatif"], ["الطائف", "taif"], ["تبوك", "tabuk"], ["أبها", "abha"], ["خميس مشيط", "khamis mushait"], ["بريدة", "buraydah", "buraidah"],
  ["حائل", "hail"], ["نجران", "najran"], ["جازان", "jazan", "jizan"], ["ينبع", "yanbu"], ["الخرج", "kharj", "al kharj"], ["رابغ", "rabigh"],
  ["العلا", "alula", "al ula"], ["نيوم", "neom"], ["الباحة", "baha", "al baha"], ["عرعر", "arar"], ["سكاكا", "sakaka"], ["الجوف", "jouf", "al jouf"],
];
const normCity = (s) => String(s == null ? "" : s).toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const CITY_BY_KEY = new Map();
for (const g of CITY_GROUPS) for (const k of g) CITY_BY_KEY.set(normCity(k), g[0]);
export function publicRegion(city) {
  const key = normCity(city).replace(/^(مدينه|city of) /, "").replace(/ city$/, "");
  return CITY_BY_KEY.get(key) || COUNTRY_REGION;
}

const plainText = (p) => {
  if (!p) return "";
  const arr = p.rich_text || p.title;
  return Array.isArray(arr) ? arr.map((x) => (x && (x.plain_text != null ? x.plain_text : x.text && x.text.content)) || "").join("") : "";
};
const OCC_BY_LABEL = (() => {
  const m = new Map();
  for (const o of OCCUPATIONS) { const k = `${o.nameAr} | ${o.nameEn}`; m.set(k, m.has(k) ? null : o.id); }
  // مهن الفهرس: التسمية نفسها كما يكتبها itemsText؛ المعرّف المعتمد هو الذي يُخزَّن (القديم إن وُجد). التسمية المشتركة بين معرّفين مختلفين ⇒ غامضة (null).
  for (const o of catalogOccupations()) { const k = `${o.ar} | ${o.en}`; const id = resolveOccupationId(o.id).occupationId; m.set(k, m.has(k) && m.get(k) !== id ? null : id); }
  return m;
})();
const NAT_BY_AR = new Map([...catalogCountries().map((n) => [n.ar, n.code]), ...NATIONALITIES.map((n) => [n.ar, n.code])]);

// بند مهنة واحد من مدخلٍ غير موثوق → { occupationId, count, nationalities } أو null. لا شيء آخر يبقى من المدخل.
function cleanItem(it) {
  if (!it || typeof it !== "object") return null;
  const occupationId = typeof it.occupationId === "string" ? it.occupationId : "";
  if (!isKnownOccupation(occupationId)) return null;
  const cid = typeof it.occupationCatalogId === "string" && occupationRef("", it.occupationCatalogId) ? it.occupationCatalogId : "";
  const count = it.count;
  if (!Number.isInteger(count) || count < 1 || count > EOR_LIMITS.maxItemCount) return null;
  const nats = [];
  if (Array.isArray(it.nationalities)) {
    for (const c of it.nationalities) {
      const code = typeof c === "string" ? c.toUpperCase() : "";
      if (isNat(code) && !nats.includes(code) && nats.length < EOR_LIMITS.maxNationalities) nats.push(code);
    }
  }
  return { occupationId, ...(cid ? { occupationCatalogId: cid } : {}), count, nationalities: nats };
}

// بنود العمود النصّي «بنود المهن» (احتياط حين لا تتوفر كتلة JSON): سطر لكل بند كما كتبه itemsText. الراتب في آخر السطر يُهمَل.
function itemsFromText(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^\s*(\d{1,3})\)\s*(.+?)\s+—\s+العدد:\s*(\d{1,3})(?:\s+—\s+الجنسيات:\s*([^—]*))?/);
    if (!m) continue;
    const id = OCC_BY_LABEL.get(m[2].trim());
    if (!id) continue;
    const nats = (m[4] || "").split("،").map((x) => NAT_BY_AR.get(x.trim())).filter(Boolean);
    const it = cleanItem({ occupationId: id, count: Number(m[3]), nationalities: nats });
    if (it) out.push({ index: Number(m[1]), ...it });
  }
  return out;
}

// كتلة JSON التي يكتبها handleEor أول جسم الصفحة. null إن غابت أو فسدت.
async function readBodyPayload(doFetch, headers, pageId) {
  try {
    const r = await doFetch(`https://api.notion.com/v1/blocks/${encodeURIComponent(pageId)}/children?page_size=20`, { method: "GET", headers });
    if (!r.ok) return null;
    const j = await r.json();
    for (const b of (j && j.results) || []) {
      if (b && b.type === "code" && b.code && Array.isArray(b.code.rich_text)) {
        try {
          const o = JSON.parse(b.code.rich_text.map((x) => (x && (x.plain_text != null ? x.plain_text : x.text && x.text.content)) || "").join(""));
          if (o && typeof o === "object" && Array.isArray(o.items)) return o;
        } catch { /* كتلة أخرى */ }
      }
    }
  } catch { /* احتياط العمود */ }
  return null;
}

const validIso = (s) => (typeof s === "string" && isoDate(s) ? s : "");
const validMonths = (n) => (Number.isInteger(n) && n >= EOR_LIMITS.minMonths && n <= EOR_LIMITS.maxMonths ? n : null);

// listVendorDemand(opts) → { ok:true, items:[…] } | { ok:false, error }.   لا يرمي استثناءً أبداً.
//   opts: fetch (قابل للحقن)، notionToken، dbId، limit (≤ 100).
//   الأحدث أولاً: بتاريخ الإطلاق إن وُضع وإلا بتاريخ الاستلام.
export async function listVendorDemand(opts = {}) {
  try {
    const token = opts.notionToken !== undefined ? opts.notionToken : envFrom(NOTION_TOKEN_ENV);
    if (!token) return { ok: false, error: "not_configured" };
    const dbId = opts.dbId || process.env.NOTION_EOR_DB || EOR_DB_DEFAULT;
    const doFetch = opts.fetch || fetch;
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? Math.min(opts.limit, VENDOR_DEMAND_MAX) : VENDOR_DEMAND_MAX;
    const headers = { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" };

    const rows = [];
    let cursor = "";
    for (let page = 0; page < VENDOR_MAX_PAGES; page++) {
      const r = await doFetch(`https://api.notion.com/v1/databases/${encodeURIComponent(dbId)}/query`, {
        method: "POST", headers,
        body: JSON.stringify({
          filter: { and: [{ property: PROP_OPEN, checkbox: { equals: true } }, { property: "الحالة", select: { does_not_equal: "مغلق" } }] },
          sorts: [{ timestamp: "created_time", direction: "descending" }],
          page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
        }),
      });
      if (!r.ok) { console.error("eor vendor-demand notion error", r.status); return { ok: false, error: "notion_unavailable" }; }
      const j = await r.json();
      for (const x of (j && j.results) || []) rows.push(x);
      if (!j || !j.has_more || !j.next_cursor) break;
      cursor = String(j.next_cursor);
    }

    // نعيد التحقق محلياً — الفلتر في الاستعلام لا يُعتمد وحده — ثم نرتّب الأحدث أولاً.
    const eligible = [];
    for (const row of rows) {
      const p = (row && row.properties) || {};
      if (!row || row.archived || row.in_trash) continue;
      if (!(p[PROP_OPEN] && p[PROP_OPEN].checkbox === true)) continue;
      const status = p["الحالة"] && p["الحالة"].select ? p["الحالة"].select.name : "";
      if (status === "مغلق") continue;
      const ref = plainText(p["رقم مرجعي"]).trim();
      if (!REF_RE.test(ref) || typeof row.id !== "string") continue;
      const launch = p[PROP_LAUNCH] && p[PROP_LAUNCH].date ? Date.parse(p[PROP_LAUNCH].date.start) : NaN;
      const created = Date.parse(row.created_time);
      eligible.push({ row, p, ref, at: Number.isFinite(launch) ? launch : Number.isFinite(created) ? created : 0 });
    }
    eligible.sort((a, b) => b.at - a.at);

    const items = [];
    for (let i = 0; i < eligible.length && items.length < limit; i += VENDOR_BODY_PARALLEL) {
      const batch = eligible.slice(i, i + VENDOR_BODY_PARALLEL);
      const bodies = await Promise.all(batch.map((e) => readBodyPayload(doFetch, headers, e.row.id)));
      batch.forEach((e, k) => {
        const body = bodies[k];
        const p = e.p;
        // مصدر البنود: كتلة JSON إن وُجدت، وإلا العمود النصّي.
        const src = body
          ? body.items.slice(0, EOR_LIMITS.maxItems).map((it, idx) => { const c = cleanItem(it); return c ? { index: idx + 1, ...c } : null; }).filter(Boolean)
          : itemsFromText(plainText(p["بنود المهن"]));
        const colStart = p["تاريخ البدء"] && p["تاريخ البدء"].date ? p["تاريخ البدء"].date.start : "";
        const colMonths = typeof p["المدة (أشهر)"]?.number === "number" ? p["المدة (أشهر)"].number : null;
        const colSector = p["المجال"] && p["المجال"].select ? SECTOR_BY_AR.get(p["المجال"].select.name) : null;
        const startDate = validIso(body && body.startDate) || validIso(String(colStart || "").slice(0, 10));
        const durationMonths = validMonths(body && body.durationMonths) ?? validMonths(colMonths);
        const sector = body && typeof body.sector === "string" && SECTOR_BY_ID.has(body.sector) ? body.sector : colSector ? colSector.id : "";
        const region = publicRegion(body && typeof body.city === "string" ? body.city : plainText(p["المدينة"]));
        for (const it of src) {
          const o = occupationRef(it.occupationId, it.occupationCatalogId);
          if (!o) continue;
          items.push({
            ref: e.ref, itemId: `${e.ref}-${it.index}`, occupationId: it.occupationId, nameAr: o.nameAr, nameEn: o.nameEn,
            count: it.count, nationalities: it.nationalities, startDate, durationMonths, sector, region,
          });
        }
      });
    }
    return { ok: true, items: items.slice(0, limit) };
  } catch (e) {
    console.error("eor vendor-demand exception", String((e && e.message) || e).slice(0, 120));
    return { ok: false, error: "unavailable" };
  }
}
