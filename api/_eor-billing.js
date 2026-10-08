// Business Partner — الفوترة الشهرية لموظفي EOR والعمالة المرنة: تنسيب → ورقة دوام → اعتماد العميل → فاتورة.
//
// يملكه وكيل `eor`. ملف مساعد يبدأ بـ`_` فلا يُحتسب دالةً (السقف ١٢). لا يستورد من `_eor.js` (لا دورة استيراد):
// `handleEor` هو من يفوّض إلى handleEorBilling ويمرّر ctx.pricing وctx.auth. المخطط الكامل لقواعد Notion الثلاث
// وقراراتها المفتوحة في docs/hr-pricing-calculator-spec.md قسم «الفوترة الشهرية».
//
// القواعد الصلبة:
//   ١) يفشل مغلقاً: بلا EOR_PLACEMENTS_DB وEOR_TIMESHEETS_DB وEOR_INVOICES_DB (ورمز Notion) ترجع كل الإجراءات
//      503 not_configured ولا يُنادى Notion. لا كتابة بلا معرّف قاعدتها.
//   ٢) المال كله أعداد صحيحة بالهللة (BigInt عبر mulDivHalfUp، نصف لأعلى لكل سطر). سعر الوحدة «لقطة» تُثبَّت وقت
//      التنسيب فلا يتغيّر بتغيّر ملف الإعداد لاحقاً.
//   ٣) لا يدخل سطرٌ بدوامٍ لم يعتمده العميل. من لا ورقة معتمدة له يُذكَر «بانتظار الاعتماد» ولا يُفوتَر.
//   ٤) العميل لا يرى إلا ما في clientInvoiceView (قائمة بيضاء حقلاً حقلاً): لا تكلفة ولا ربح ولا هامش ولا معاملات
//      ولا مورّداً ولا سعره ولا مصدراً. التكلفة والهامش في opsInvoiceView وحدها. المورّد لا يملك أي إجراء هنا.
//   ٥) الملكية: العميل يرى ويعتمد لتنسيباته وحدها، والتنسيب يُحمَّل من قاعدته ويُفحص انتماؤه (لا يُوثَق بنسخة العميل
//      المخزَّنة في ورقة الدوام). تنسيب غيره ⇒ 404 كأنه غير موجود.
//   ٦) فاتورة واحدة فعّالة (مسودة/صادرة/مدفوعة) لكل (عميل، شهر)؛ الرقم BP-INV-YYYYMM-NNNN يتزايد بلا تكرار
//      (تحقّق لاحق للكتابة لأن Notion بلا تسلسل ذرّي). ورقة دوام مُفوتَرة مقفلة؛ تغييرها يستلزم إلغاء الفاتورة وإصدار أخرى.

import { createHash } from "node:crypto";
import {
  mulDivHalfUp, sarToHalalas, packageRateConfigFromPricing, computePackageRate, computeCasualRate, packageSaleMonthlyHalalas,
  normalizeInsuranceFields, normalizeEngagementType, normalizeBillingUnit, parseCasualHours, TIMESHEET_STATUSES,
} from "./_eor-cost.js";
import { occupationById } from "./_occupations.js";

/* ═════════════ الثوابت ═════════════ */
export const BILLING_DB_ENVS = Object.freeze({ placements: "EOR_PLACEMENTS_DB", timesheets: "EOR_TIMESHEETS_DB", invoices: "EOR_INVOICES_DB" });
export const BILLING_LIMITS = Object.freeze({
  hoursMax: 744,            // ساعات الشهر (31 × 24)
  overtimeMax: 744,
  monthsMax: 1,             // أشهر ورقة الدوام الواحدة
  maxLinesPerInvoice: 400,
  maxPriceHalalas: 1_000_000_000,   // 10 ملايين ريال للوحدة
  maxScanPages: 5,          // 500 صفٍّ لكل مسح؛ أكثر منها ⇒ فشل مغلق لا فاتورة ناقصة
  maxJsonChars: 180_000,
  nameMax: 120, noMax: 40, reasonMax: 300, refMax: 120,
});
export const BILLING_ACTIONS = Object.freeze({
  "create-placement": ["ops"], "list-placements": ["ops", "client"],
  "submit-timesheet": ["ops"], "list-timesheets": ["ops", "client"], "approve-timesheet": ["client"],
  "generate-invoice": ["ops"], "issue-invoice": ["ops"], "cancel-invoice": ["ops"], "record-payment": ["ops"],
  "list-invoices": ["ops", "client"], "get-invoice": ["ops", "client"],
});
export const isBillingAction = (a) => typeof a === "string" && Object.prototype.hasOwnProperty.call(BILLING_ACTIONS, a);
export const INVOICE_STATUSES = Object.freeze(["draft", "issued", "paid", "cancelled"]);
export const PLACEMENT_STATUSES = Object.freeze(["active", "ended", "cancelled"]);
const ACTIVE_INVOICE = Object.freeze(["draft", "issued", "paid"]);
export const PRORATION_MODES = Object.freeze(["full_month", "calendar_days"]);
export const DEFAULT_VAT_RATE = 0.15;                  // _owner_decision: افتراضي حتى يحدّد المالك (انظر المواصفة)

// أسماء الأعمدة الحرفية في Notion — مصدر واحد للكود والمواصفة والاختبار.
export const PLACEMENT_PROPS = Object.freeze({
  key: "مفتاح التنسيب", client: "معرّف العميل", clientName: "اسم العميل", employee: "اسم الموظف", employeeNo: "الرقم الداخلي",
  occupationId: "معرّف المهنة", occupation: "المهنة", engagement: "نوع التعاقد", unit: "وحدة التسعير",
  unitPrice: "سعر الوحدة (هللة)", otPrice: "سعر ساعة الإضافي (هللة)", currency: "العملة",
  start: "تاريخ البدء", end: "تاريخ الانتهاء", status: "الحالة", requestRef: "رقم الطلب",
  costUnit: "تكلفة الوحدة (هللة)", vendorId: "معرّف المورّد", priceSource: "مصدر السعر", pricingInput: "مدخلات التسعير (JSON)",
});
export const TIMESHEET_PROPS = Object.freeze({
  key: "مفتاح الورقة", placement: "معرّف التنسيب", client: "معرّف العميل", month: "الشهر",
  hours: "الساعات المعتمدة", days: "الأيام المعتمدة", months: "الأشهر المعتمدة", overtime: "ساعات إضافية",
  status: "الحالة", submittedBy: "قدّمها", approvedBy: "اعتمدها", approvedAt: "تاريخ الاعتماد", rejectReason: "سبب الرفض", invoiceId: "معرّف الفاتورة",
});
export const INVOICE_PROPS = Object.freeze({
  key: "مفتاح الفاتورة", client: "معرّف العميل", clientName: "اسم العميل", month: "الشهر", serial: "الرقم التسلسلي",
  lines: "السطور (JSON)", internal: "تفاصيل داخلية (JSON)", pending: "بانتظار الاعتماد (JSON)",
  subtotal: "المجموع قبل الضريبة (هللة)", vat: "الضريبة (هللة)", total: "الإجمالي (هللة)", vatRate: "نسبة الضريبة",
  currency: "العملة", status: "الحالة", paymentRef: "مرجع الدفع", issuedAt: "تاريخ الإصدار", dueAt: "تاريخ الاستحقاق",
  cancelReason: "سبب الإلغاء", digest: "بصمة الأوراق",
});
// خيارات select بالعربية (القيمة الحرفية في Notion).
export const PLACEMENT_STATUS_AR = Object.freeze({ active: "نشط", ended: "منتهٍ", cancelled: "ملغى" });
export const TIMESHEET_STATUS_AR = Object.freeze({ draft: "مسودة", submitted: "مقدَّمة", approved: "معتمدة من العميل", rejected: "مرفوضة" });
export const INVOICE_STATUS_AR = Object.freeze({ draft: "مسودة", issued: "صادرة", paid: "مدفوعة", cancelled: "ملغاة" });
const ENGAGEMENT_AR = Object.freeze({ contract: "تعاقد (EOR)", casual: "عمالة مرنة" });
const UNIT_AR = Object.freeze({ month: "شهري", day: "يومي", hour: "بالساعة" });
const SOURCE_AR = Object.freeze({ config: "الإعداد", override: "سعر متفق عليه" });
const invert = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const PLACEMENT_STATUS_BY_AR = invert(PLACEMENT_STATUS_AR), TIMESHEET_STATUS_BY_AR = invert(TIMESHEET_STATUS_AR), INVOICE_STATUS_BY_AR = invert(INVOICE_STATUS_AR);
const ENGAGEMENT_BY_AR = invert(ENGAGEMENT_AR), UNIT_BY_AR = invert(UNIT_AR), SOURCE_BY_AR = invert(SOURCE_AR);
// وحدة التسعير الداخلية ↔ BILLING_UNITS في الحاسبة (monthly/daily/hourly)
const UNIT_OF = Object.freeze({ monthly: "month", daily: "day", hourly: "hour" });
const BILLING_UNIT_OF = Object.freeze({ month: "monthly", day: "daily", hour: "hourly" });

/* ═════════════ أدوات صغيرة ═════════════ */
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nul = (v) => v === null || v === undefined || v === "";
const CTRL = /[\u0000-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;
const oneLine = (v, max) => String(v == null ? "" : v).replace(CTRL, " ").replace(/\s+/g, " ").trim().slice(0, max);
const normId = (v) => String(v == null ? "" : v).replace(/-/g, "").toLowerCase();
const PAGE_ID_RE = /^[0-9a-f]{32}$/;
export const isPageId = (v) => typeof v === "string" && PAGE_ID_RE.test(normId(v));
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (m) => typeof m === "string" && MONTH_RE.test(m);
const isoDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const riyadhToday = (nowMs) => new Date((nowMs == null ? Date.now() : nowMs) + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400e3).toISOString().slice(0, 10);
const dayIndex = (iso) => Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86400e3);
export const daysInMonth = (month) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const monthStart = (month) => month + "-01";
const monthEnd = (month) => `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
const isHalalas = (v) => Number.isSafeInteger(v) && v >= 0;
const ppm = (rate) => Math.round(rate * 1_000_000);

class Fail extends Error {
  constructor(status, error, extra) { super(error); this.status = status; this.code = error; this.extra = extra || {}; }
}
const fail = (status, error, extra) => ({ ok: false, status, error, ...(extra || {}) });

// كمية بخانتين عشريتين على الأكثر ← مئويات صحيحة. رقم أو نص رقمي فقط؛ سالب/علمي/أكثر من خانتين ⇒ null.
export function parseHundredths(raw, { max = 1_000_000 } = {}) {
  let s;
  if (typeof raw === "number") { if (!Number.isFinite(raw) || raw < 0) return null; s = String(raw); if (/e/i.test(s)) return null; }
  else if (typeof raw === "string") s = raw.trim();
  else return null;
  const m = s.match(/^(\d{1,6})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, "0")) : 0);
  return h <= max ? h : null;
}

/* ═════════════ الإعداد ═════════════ */
// billingConfigFromPricing(pricing) — كتلة billing في api/_eor-pricing.json. الضريبة: billing.vat_rate ثم vat_rate العام ثم 0.15 الافتراضي
// (_owner_decision). لا رقم مالي آخر هنا: الاستحقاق (due_days) فارغ حتى يحدّده المالك.
export function billingConfigFromPricing(pricing) {
  const p = isObj(pricing) ? pricing : {};
  const b = isObj(p.billing) ? p.billing : {};
  const rate = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);
  const fromBilling = rate(b.vat_rate), fromTop = rate(p.vat_rate);
  const vatRate = fromBilling !== null ? fromBilling : fromTop !== null ? fromTop : DEFAULT_VAT_RATE;
  const pr = isObj(p.package_rate) ? p.package_rate : {};
  const cur = [pr.currency, p.currency].find((c) => typeof c === "string" && c.trim());
  const hm = Number.isInteger(b.timesheet_max_hours) && b.timesheet_max_hours >= 1 && b.timesheet_max_hours <= BILLING_LIMITS.hoursMax ? b.timesheet_max_hours : BILLING_LIMITS.hoursMax;
  return {
    currency: cur ? cur.trim() : null,
    vatRate, vatSource: fromBilling !== null ? "billing" : fromTop !== null ? "pricing" : "default",
    pricesIncludeVat: b.prices_include_vat === true,
    proration: PRORATION_MODES.includes(b.proration) ? b.proration : "full_month",
    dueDays: Number.isInteger(b.due_days) && b.due_days >= 0 && b.due_days <= 365 ? b.due_days : null,
    hoursMax: hm,
  };
}

/* ═════════════ التسلسل ═════════════ */
// nextSerial("2026-10", ["BP-INV-202610-0001", …]) ⇒ "BP-INV-202610-0002". يتجاهل ما ليس من هذا الشهر. نقيّة.
export function nextSerial(month, existing) {
  if (!isMonth(month)) throw new RangeError("nextSerial: month");
  const prefix = `BP-INV-${month.replace("-", "")}-`;
  let max = 0;
  for (const s of Array.isArray(existing) ? existing : []) {
    if (typeof s === "string" && s.startsWith(prefix) && /^\d{4,}$/.test(s.slice(prefix.length))) max = Math.max(max, Number(s.slice(prefix.length)));
  }
  return prefix + String(max + 1).padStart(4, "0");
}
export const isSerial = (s) => typeof s === "string" && /^BP-INV-\d{6}-\d{4,}$/.test(s);

/* ═════════════ ورقة الدوام: التحقق من الكميات ═════════════ */
// الكمية المطلوبة تتبع وحدة التنسيب: شهر ⇒ months (0..1)، يوم ⇒ days (0..أيام الشهر)، ساعة ⇒ hours (0..744). غير ذلك مرفوض
// (quantity_unit_mismatch) لا يُهمَل بصمت. الإضافي للتعاقد وحده (0..744)؛ المرنة ⇒ overtime_not_allowed.
// → { ok:true, column:"months"|"days"|"hours", quantityH, overtimeH } | { ok:false, error, field }
export function validateTimesheetQuantities(input, { engagement, unit, month, hoursMax = BILLING_LIMITS.hoursMax }) {
  const i = isObj(input) ? input : {};
  const col = unit === "month" ? "months" : unit === "day" ? "days" : unit === "hour" ? "hours" : null;
  if (!col || !isMonth(month)) return { ok: false, error: "invalid_input", field: "unit" };
  for (const other of ["months", "days", "hours"]) if (other !== col && !nul(i[other])) return { ok: false, error: "quantity_unit_mismatch", field: other };
  if (nul(i[col])) return { ok: false, error: "quantity_required", field: col };
  const max = col === "months" ? BILLING_LIMITS.monthsMax * 100 : col === "days" ? daysInMonth(month) * 100 : hoursMax * 100;
  const q = parseHundredths(i[col], { max });
  if (q === null) return { ok: false, error: "quantity_out_of_range", field: col };
  let ot = 0;
  if (!nul(i.overtimeHours)) {
    if (engagement !== "contract") return { ok: false, error: "overtime_not_allowed", field: "overtimeHours" };
    const o = parseHundredths(i.overtimeHours, { max: Math.min(hoursMax, BILLING_LIMITS.overtimeMax) * 100 });
    if (o === null) return { ok: false, error: "overtime_out_of_range", field: "overtimeHours" };
    ot = o;
  }
  return { ok: true, column: col, quantityH: q, overtimeH: ot };
}

/* ═════════════ التقسيم النسبي ═════════════ */
// أيام تداخل [start,end] مع الشهر وأيام الشهر. end فارغ = مفتوح.
export function activeDaysInMonth(placement, month) {
  const first = monthStart(month), last = monthEnd(month);
  const lo = placement.startDate && placement.startDate > first ? placement.startDate : first;
  const hi = placement.endDate && placement.endDate < last ? placement.endDate : last;
  const days = hi < lo ? 0 : dayIndex(hi) - dayIndex(lo) + 1;
  return { activeDays: days, monthDays: daysInMonth(month) };
}

/* ═════════════ بناء الفاتورة (نقيّة) ═════════════ */
const DIGEST_VERSION = "v1";
// بصمة المدخلات الحاكمة (حالة الورقة وكمياتها وسعر الوحدة لكل تنسيب فعّال في الشهر). تغيّرها بعد الإصدار = فاتورة متقادمة.
export function inputsDigest(entries) {
  const lines = entries.map((e) => [e.placementId, e.sheetStatus || "none", e.monthsH ?? "", e.daysH ?? "", e.hoursH ?? "", e.overtimeH ?? "", e.unitPriceHalalas ?? "", e.overtimeHourHalalas ?? ""].join("|")).sort();
  return createHash("sha256").update(DIGEST_VERSION + "\n" + lines.join("\n")).digest("hex").slice(0, 32);
}

// buildInvoice({ clientId, month, placements, timesheets, config })
//   placements: [{ id, clientId, employeeName, employeeNo, occupationId, engagement, unit:"month|day|hour", unitPriceHalalas, overtimeHourHalalas|null,
//                  costUnitHalalas|null, vendorId, currency, startDate, endDate|null, status }]
//   timesheets: [{ id, placementId, clientId, month, status, monthsH|null, daysH|null, hoursH|null, overtimeH }]
//   config: { vatRate, pricesIncludeVat?, proration, currency?, hoursMax? }
//   → { status:"ok", lines, internalLines, pending, excluded, subtotalHalalas, vatHalalas, totalHalalas, vatRate, currency, digest, … }
//   | { status:"nothing_to_bill", pending, excluded, digest } | { status:"invalid_input", errors } | { status:"pending_pricing", missing }
// سطر لكل موظف (base) + سطر إضافي (overtime) للتعاقد إن وُجدت ساعات. كل سطر يُقرَّب نصفاً لأعلى على حدة.
export function buildInvoice(input) {
  const inp = isObj(input) ? input : {};
  const cfg = isObj(inp.config) ? inp.config : {};
  const errors = [];
  if (typeof inp.clientId !== "string" || !inp.clientId) return { status: "invalid_input", errors: [{ field: "clientId", error: "required" }] };
  if (!isMonth(inp.month)) return { status: "invalid_input", errors: [{ field: "month", error: "invalid_month" }] };
  if (!Array.isArray(inp.placements)) return { status: "invalid_input", errors: [{ field: "placements", error: "not_array" }] };
  if (!Array.isArray(inp.timesheets)) return { status: "invalid_input", errors: [{ field: "timesheets", error: "not_array" }] };
  const month = inp.month;
  if (!(typeof cfg.vatRate === "number" && Number.isFinite(cfg.vatRate) && cfg.vatRate >= 0 && cfg.vatRate <= 1)) return { status: "invalid_input", errors: [{ field: "config.vatRate", error: "rate_out_of_range" }] };
  const proration = PRORATION_MODES.includes(cfg.proration) ? cfg.proration : "full_month";
  const hoursMax = Number.isInteger(cfg.hoursMax) && cfg.hoursMax > 0 ? Math.min(cfg.hoursMax, BILLING_LIMITS.hoursMax) : BILLING_LIMITS.hoursMax;
  const pricesIncludeVat = cfg.pricesIncludeVat === true;

  // الأوراق: واحدة لكل تنسيب في الشهر؛ تكرار ⇒ خطأ لا تخمين. ورقة تنسيبٍ ليس في القائمة (أو لعميل آخر) لا تدخل.
  const placementById = new Map();
  for (const [i, p] of inp.placements.entries()) {
    if (!isObj(p) || typeof p.id !== "string" || !p.id) { errors.push({ field: `placements[${i}]`, error: "invalid" }); continue; }
    if (placementById.has(p.id)) { errors.push({ field: `placements[${i}]`, error: "duplicate_placement" }); continue; }
    if (p.clientId !== inp.clientId) { errors.push({ field: `placements[${i}]`, error: "foreign_placement" }); continue; }
    placementById.set(p.id, p);
  }
  const sheetByPlacement = new Map();
  for (const [i, t] of inp.timesheets.entries()) {
    if (!isObj(t) || typeof t.placementId !== "string") { errors.push({ field: `timesheets[${i}]`, error: "invalid" }); continue; }
    if (t.month !== month) continue;
    const p = placementById.get(t.placementId);
    if (!p) continue;
    if (!TIMESHEET_STATUSES.includes(t.status)) { errors.push({ field: `timesheets[${i}].status`, error: "unknown_status" }); continue; }
    if (nul(t.clientId) || t.clientId !== inp.clientId) { errors.push({ field: `timesheets[${i}]`, error: "sheet_client_mismatch" }); continue; }
    if (sheetByPlacement.has(t.placementId)) { errors.push({ field: `timesheets[${i}]`, error: "duplicate_timesheet" }); continue; }
    sheetByPlacement.set(t.placementId, t);
  }

  const lines = [], internalLines = [], pending = [], excluded = [], digestEntries = [];
  const currencies = new Set();
  const ordered = [...placementById.values()].sort((a, b) => (a.employeeNo || "").localeCompare(b.employeeNo || "") || a.id.localeCompare(b.id));
  for (const p of ordered) {
    if (!PLACEMENT_STATUSES.includes(p.status)) { errors.push({ field: `placement ${p.id}.status`, error: "unknown_status" }); continue; }
    if (p.status === "cancelled") { excluded.push({ placementId: p.id, reason: "placement_cancelled" }); continue; }
    if (!["month", "day", "hour"].includes(p.unit) || !["contract", "casual"].includes(p.engagement)) { errors.push({ field: `placement ${p.id}`, error: "invalid_unit_or_engagement" }); continue; }
    if (p.engagement === "contract" && p.unit !== "month") { errors.push({ field: `placement ${p.id}`, error: "contract_must_be_monthly" }); continue; }
    if (!isHalalas(p.unitPriceHalalas) || p.unitPriceHalalas > BILLING_LIMITS.maxPriceHalalas) { errors.push({ field: `placement ${p.id}.unitPriceHalalas`, error: "not_halalas" }); continue; }
    if (typeof p.startDate !== "string" || !isoDate(p.startDate) || (!nul(p.endDate) && !isoDate(p.endDate))) { errors.push({ field: `placement ${p.id}.dates`, error: "invalid_date" }); continue; }
    const { activeDays, monthDays } = activeDaysInMonth({ startDate: p.startDate, endDate: nul(p.endDate) ? null : p.endDate }, month);
    if (activeDays === 0) { excluded.push({ placementId: p.id, reason: "not_active_in_month" }); continue; }
    const sh = sheetByPlacement.get(p.id);
    digestEntries.push({ placementId: p.id, sheetStatus: sh && sh.status, monthsH: sh && sh.monthsH, daysH: sh && sh.daysH, hoursH: sh && sh.hoursH, overtimeH: sh && sh.overtimeH, unitPriceHalalas: p.unitPriceHalalas, overtimeHourHalalas: p.overtimeHourHalalas });
    const who = { placementId: p.id, employeeName: p.employeeName, employeeNo: p.employeeNo };
    if (!sh) { pending.push({ ...who, reason: "no_timesheet" }); continue; }
    if (sh.status !== "approved") { pending.push({ ...who, reason: "timesheet_" + sh.status, timesheetStatus: sh.status }); continue; }

    // الكمية المعتمدة حسب الوحدة؛ أعمدة الوحدات الأخرى يجب أن تكون فارغة.
    const col = p.unit === "month" ? "monthsH" : p.unit === "day" ? "daysH" : "hoursH";
    const others = ["monthsH", "daysH", "hoursH"].filter((c) => c !== col);
    if (others.some((c) => !nul(sh[c]))) { errors.push({ field: `timesheet ${sh.id || p.id}`, error: "quantity_unit_mismatch" }); continue; }
    const qH = sh[col];
    const maxQ = col === "monthsH" ? BILLING_LIMITS.monthsMax * 100 : col === "daysH" ? monthDays * 100 : hoursMax * 100;
    if (!Number.isSafeInteger(qH) || qH < 0 || qH > maxQ) { errors.push({ field: `timesheet ${sh.id || p.id}.${col}`, error: "quantity_out_of_range" }); continue; }
    const otH = nul(sh.overtimeH) ? 0 : sh.overtimeH;
    if (!Number.isSafeInteger(otH) || otH < 0 || otH > Math.min(hoursMax, BILLING_LIMITS.overtimeMax) * 100) { errors.push({ field: `timesheet ${sh.id || p.id}.overtimeH`, error: "overtime_out_of_range" }); continue; }
    if (otH > 0 && p.engagement !== "contract") { errors.push({ field: `timesheet ${sh.id || p.id}.overtimeH`, error: "overtime_not_allowed" }); continue; }
    if (otH > 0 && !isHalalas(p.overtimeHourHalalas)) { errors.push({ field: `placement ${p.id}.overtimeHourHalalas`, error: "overtime_price_missing" }); continue; }
    if (typeof p.currency === "string" && p.currency) currencies.add(p.currency);

    // التقسيم النسبي للتعاقد وحده (المرنة تُفوتَر بما اعتُمد فعلاً): أيام النشاط ÷ أيام الشهر إن كان الوضع calendar_days.
    let num = 1, den = 1, prorated = false;
    if (p.engagement === "contract" && proration === "calendar_days" && activeDays < monthDays) { num = activeDays; den = monthDays; prorated = true; }
    if (qH === 0 && otH === 0) { excluded.push({ placementId: p.id, reason: "zero_quantity" }); continue; }
    const base = {
      kind: "base", ...who, occupationId: p.occupationId, engagement: p.engagement, unit: p.unit,
      quantityH: qH, unitPriceHalalas: p.unitPriceHalalas,
      ...(prorated ? { prorationDays: num, prorationOf: den } : {}),
      amountHalalas: mulDivHalfUp(p.unitPriceHalalas * qH, num, 100 * den),
    };
    if (qH > 0) {
      lines.push(base);
      const hasCost = isHalalas(p.costUnitHalalas);
      const costAmount = hasCost ? mulDivHalfUp(p.costUnitHalalas * qH, num, 100 * den) : null;
      internalLines.push({ placementId: p.id, kind: "base", vendorId: p.vendorId || "", costUnitHalalas: hasCost ? p.costUnitHalalas : null, costAmountHalalas: costAmount, marginHalalas: costAmount === null ? null : base.amountHalalas - costAmount });
    }
    if (otH > 0) {
      lines.push({ kind: "overtime", ...who, occupationId: p.occupationId, engagement: p.engagement, unit: "hour", quantityH: otH, unitPriceHalalas: p.overtimeHourHalalas, amountHalalas: mulDivHalfUp(p.overtimeHourHalalas, otH, 100) });
      internalLines.push({ placementId: p.id, kind: "overtime", vendorId: p.vendorId || "", costUnitHalalas: null, costAmountHalalas: null, marginHalalas: null });
    }
  }
  if (currencies.size > 1) errors.push({ field: "placements", error: "mixed_currency" });
  if (lines.length > BILLING_LIMITS.maxLinesPerInvoice) errors.push({ field: "lines", error: "too_many_lines" });
  if (errors.length) return { status: "invalid_input", errors };

  const digest = inputsDigest(digestEntries);
  if (!lines.length) return { status: "nothing_to_bill", pending, excluded, digest };
  const currency = currencies.size === 1 ? [...currencies][0] : (typeof cfg.currency === "string" && cfg.currency.trim() ? cfg.currency.trim() : null);
  if (!currency) return { status: "pending_pricing", missing: ["billing.currency"] };

  const sum = lines.reduce((s, l) => s + l.amountHalalas, 0);
  let subtotal, vat, total;
  if (pricesIncludeVat) {            // _owner_decision: أسعار شاملة ⇒ الإجمالي = المجموع، والضريبة مستخرجة منه
    total = sum; vat = mulDivHalfUp(sum, ppm(cfg.vatRate), 1_000_000 + ppm(cfg.vatRate)); subtotal = total - vat;
  } else {
    subtotal = sum; vat = mulDivHalfUp(sum, ppm(cfg.vatRate), 1_000_000); total = subtotal + vat;
  }
  return {
    status: "ok", clientId: inp.clientId, month, currency, lines, internalLines, pending, excluded,
    subtotalHalalas: subtotal, vatHalalas: vat, totalHalalas: total, vatRate: ppm(cfg.vatRate) / 1_000_000, pricesIncludeVat, proration,
    digest, rounding: "half_up_per_line",
  };
}

/* ═════════════ ما يراه كل دور ═════════════ */
const DESC = Object.freeze({
  "base:contract:month": { ar: "الأجر الشهري — موظف على بند التعاقد", en: "Monthly fee — employee under contract" },
  "overtime": { ar: "ساعات إضافية", en: "Overtime hours" },
  "base:casual:hour": { ar: "عمالة مرنة — بالساعة", en: "Flexible staffing — hourly" },
  "base:casual:day": { ar: "عمالة مرنة — باليوم", en: "Flexible staffing — daily" },
  "base:casual:month": { ar: "عمالة مرنة — بالشهر", en: "Flexible staffing — monthly" },
});
const descOf = (l) => DESC[l.kind === "overtime" ? "overtime" : `base:${l.engagement}:${l.unit}`] || { ar: "", en: "" };
const sar = (h) => (Number.isFinite(h) ? h / 100 : null);

// سطر للعميل: قائمة بيضاء حقلاً حقلاً (لا نسخ كائن). الموظف باسمه ورقمه الداخلي ومهنته؛ لا معرّف مورّد ولا تكلفة ولا هامش.
function clientLine(l) {
  const o = occupationById(l.occupationId);
  const d = descOf(l);
  const out = {
    kind: l.kind === "overtime" ? "overtime" : "base",
    employeeName: String(l.employeeName || ""), employeeNo: String(l.employeeNo || ""),
    occupation: o ? { id: o.id, nameAr: o.nameAr, nameEn: o.nameEn } : { id: String(l.occupationId || ""), nameAr: "", nameEn: "" },
    descriptionAr: d.ar, descriptionEn: d.en,
    unit: l.unit, quantity: l.quantityH / 100, unitPrice: sar(l.unitPriceHalalas), amount: sar(l.amountHalalas),
  };
  if (Number.isInteger(l.prorationDays) && Number.isInteger(l.prorationOf)) out.proration = { days: l.prorationDays, ofDays: l.prorationOf };
  return out;
}

// clientInvoiceView(invoice) → كائن أو null. المسودة لا تُعرض للعميل؛ والمُلغاة التي لم تُصدَر (بلا رقم) كذلك؛ والتالف null.
export function clientInvoiceView(inv) {
  if (!isObj(inv) || inv.corrupt === true || !INVOICE_STATUSES.includes(inv.status) || inv.status === "draft") return null;
  if (inv.status === "cancelled" && !inv.serial) return null;
  return {
    id: String(inv.id), number: String(inv.serial || ""), month: String(inv.month), status: inv.status, currency: String(inv.currency || ""),
    lines: (Array.isArray(inv.lines) ? inv.lines : []).map(clientLine),
    subtotal: sar(inv.subtotalHalalas), vatRate: typeof inv.vatRate === "number" ? inv.vatRate : null, vat: sar(inv.vatHalalas), total: sar(inv.totalHalalas),
    issuedAt: inv.issuedAt || null, dueDate: inv.dueAt || null,
  };
}

// opsInvoiceView(invoice) — للمالك والفريق وحدهما: كل ما في عرض العميل + التكلفة والهامش (إن توفّرت لكل الأسطر الأساسية) + المعلّقون.
export function opsInvoiceView(inv) {
  if (!isObj(inv)) return null;
  const internal = Array.isArray(inv.internalLines) ? inv.internalLines : [];
  const base = (Array.isArray(inv.lines) ? inv.lines : []).map((l, i) => ({ ...clientLine(l), placementId: l.placementId, amountHalalas: l.amountHalalas, unitPriceHalalas: l.unitPriceHalalas, quantityH: l.quantityH, internal: internal[i] || null }));
  const baseIdx = (Array.isArray(inv.lines) ? inv.lines : []).map((l, i) => (l.kind === "base" ? i : -1)).filter((i) => i >= 0);
  const costKnown = baseIdx.length > 0 && baseIdx.every((i) => internal[i] && isHalalas(internal[i].costAmountHalalas));
  const costTotal = costKnown ? baseIdx.reduce((s, i) => s + internal[i].costAmountHalalas, 0) : null;
  const revenueBase = baseIdx.reduce((s, i) => s + inv.lines[i].amountHalalas, 0);
  return {
    id: String(inv.id), clientId: inv.clientId, clientName: inv.clientName || "", number: inv.serial || "", month: inv.month, status: inv.status, currency: inv.currency,
    lines: base, subtotalHalalas: inv.subtotalHalalas, vatHalalas: inv.vatHalalas, totalHalalas: inv.totalHalalas, vatRate: inv.vatRate,
    costHalalas: costTotal, marginHalalas: costTotal === null ? null : revenueBase - costTotal,
    pending: Array.isArray(inv.pending) ? inv.pending : [], paymentRef: inv.paymentRef || "", cancelReason: inv.cancelReason || "",
    issuedAt: inv.issuedAt || null, dueDate: inv.dueAt || null, digest: inv.digest || "", corrupt: inv.corrupt === true,
  };
}

const placementOpsView = (p) => ({
  id: p.id, clientId: p.clientId, clientName: p.clientName, employeeName: p.employeeName, employeeNo: p.employeeNo, occupationId: p.occupationId,
  engagementType: p.engagement, unit: p.unit, unitPriceHalalas: p.unitPriceHalalas, overtimeHourHalalas: p.overtimeHourHalalas, currency: p.currency,
  startDate: p.startDate, endDate: p.endDate, status: p.status, requestRef: p.requestRef, costUnitHalalas: p.costUnitHalalas, vendorId: p.vendorId, priceSource: p.priceSource,
});
// الموظف كما يراه عميله: هوية وظيفية وفترة فقط (لا سعر ولا تكلفة ولا مورّد ولا مصدر تسعير).
export function clientPlacementView(p) {
  if (!isObj(p)) return null;
  const o = occupationById(p.occupationId);
  return {
    id: p.id, employeeName: p.employeeName, employeeNo: p.employeeNo,
    occupation: o ? { id: o.id, nameAr: o.nameAr, nameEn: o.nameEn } : { id: String(p.occupationId || ""), nameAr: "", nameEn: "" },
    engagementType: p.engagement, unit: p.unit, startDate: p.startDate, endDate: p.endDate || null, status: p.status,
  };
}

export const sheetVersion = (s) => createHash("sha256").update([s.id, s.status, s.monthsH ?? "", s.daysH ?? "", s.hoursH ?? "", s.overtimeH ?? 0].join("|")).digest("hex").slice(0, 16);
const sheetQuantity = (s) => ({ months: s.monthsH === null || s.monthsH === undefined ? null : s.monthsH / 100, days: s.daysH === null || s.daysH === undefined ? null : s.daysH / 100, hours: s.hoursH === null || s.hoursH === undefined ? null : s.hoursH / 100, overtimeHours: (s.overtimeH || 0) / 100 });
export function clientTimesheetView(s, p) {
  if (!isObj(s) || !isObj(p)) return null;
  return {
    id: s.id, placementId: s.placementId, employeeName: p.employeeName, employeeNo: p.employeeNo, month: s.month, status: s.status,
    ...sheetQuantity(s), unit: p.unit, version: sheetVersion(s), invoiced: !!s.invoiceId, approvedAt: s.approvedAt || null,
  };
}
const opsTimesheetView = (s, p) => ({ ...clientTimesheetView(s, p || { employeeName: "", employeeNo: "", unit: null }), submittedBy: s.submittedBy || "", approvedBy: s.approvedBy || "", rejectReason: s.rejectReason || "", invoiceId: s.invoiceId || "" });

/* ═════════════ الهوية والملكية ═════════════ */
// معرّف العميل في كل سجل: "org:<uuid>" | "user:<uuid>" | "email:<بريد>". الحرف الصغير والأحرف المسموحة فقط.
const CLIENT_ID_RE = /^(?:(?:org|user):[0-9a-z-]{8,64}|email:[^\s@<>]{1,64}@[^\s@<>]{1,90}\.[^\s@<>]{2,24})$/;
export function normalizeClientId(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s.length <= 160 && CLIENT_ID_RE.test(s) ? s : "";
}
// authFromSession(sess) — من نتيجة getSession(req). تُرجع { role:"client", keys, email } أو null. المفاتيح هي ما يملكه العميل من معرّفات.
export function authFromSession(sess) {
  const u = sess && sess.user;
  if (!isObj(u)) return null;
  const keys = [];
  const add = (k) => { const n = normalizeClientId(k); if (n && !keys.includes(n)) keys.push(n); };
  if (sess.organization && sess.organization.id) add(`org:${sess.organization.id}`);
  if (u.id) add(`user:${u.id}`);
  const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
  if (email) add(`email:${email}`);
  return keys.length ? { role: "client", keys, email } : null;
}
const ownsClient = (auth, clientId) => !!(auth && auth.role === "client" && Array.isArray(auth.keys) && clientId && auth.keys.includes(clientId));

/* ═════════════ Notion: الاتصال والقراءة والكتابة ═════════════ */
const NOTION_VERSION = "2022-06-28";
const NOTION_TOKEN_ENV = ["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"];
const MISSING_PROP_RE = /is not a property that exists|could not find property|invalid property identifier|is expected to be/i;
const dbIdOf = (v) => (typeof v === "string" && /^[0-9a-f-]{32,36}$/i.test(v.trim()) ? normId(v.trim()) : "");

// معرّفات القواعد الثلاث من البيئة وقت النداء. أي معرّف غائب أو فاسد ⇒ { ok:false } (كل الإجراءات تردّ not_configured).
export function billingDbIds(env = process.env) {
  const out = {};
  for (const [k, name] of Object.entries(BILLING_DB_ENVS)) out[k] = dbIdOf(env && env[name]);
  return out;
}
function makeStore(ctx) {
  const env = ctx.env || process.env;
  const dbs = billingDbIds(env);
  let token = ctx.notionToken;
  if (token === undefined) { token = ""; for (const n of NOTION_TOKEN_ENV) if (env[n] && String(env[n]).trim()) { token = String(env[n]).trim(); break; } }
  if (!dbs.placements || !dbs.timesheets || !dbs.invoices || !token) throw new Fail(503, "not_configured");
  const doFetch = ctx.fetch || fetch;
  const call = async (method, path, body) => {
    let r;
    try {
      r = await doFetch("https://api.notion.com/v1" + path, {
        method, headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Fail(502, "notion_unavailable"); }
    let text = "", json = null;
    try { text = await r.text(); } catch {}
    if (text) { try { json = JSON.parse(text); } catch {} }
    else if (typeof r.json === "function") { try { json = await r.json(); } catch {} }
    return { ok: !!r.ok, status: r.status, json, text };
  };
  return { dbs, call };
}

const rtChunks = (s) => { const out = []; const str = String(s || ""); for (let i = 0; i < str.length; i += 1900) out.push({ type: "text", text: { content: str.slice(i, i + 1900) } }); return out; };
const P = {
  title: (s) => ({ title: rtChunks(oneLine(s, 200) || "—") }),
  text: (s) => ({ rich_text: s ? rtChunks(String(s)) : [] }),
  num: (n) => ({ number: n === null || n === undefined ? null : n }),
  sel: (s) => ({ select: s ? { name: s } : null }),
  date: (s) => ({ date: s ? { start: s } : null }),
  json: (o) => {
    const s = JSON.stringify(o);
    if (s.length > BILLING_LIMITS.maxJsonChars) throw new Fail(413, "too_large");
    return { rich_text: rtChunks(s) };
  },
};
const richPlain = (arr) => (Array.isArray(arr) ? arr.map((x) => (x && (x.plain_text != null ? x.plain_text : x.text && x.text.content)) || "").join("") : "");
const rd = {
  text: (p) => (p ? richPlain(p.rich_text || p.title) : ""),
  num: (p) => (p && typeof p.number === "number" ? p.number : null),
  int: (p) => (p && Number.isSafeInteger(p.number) ? p.number : null),
  sel: (p) => (p && p.select ? p.select.name : ""),
  date: (p) => (p && p.date && p.date.start ? String(p.date.start).slice(0, 10) : ""),
  json: (p) => { const t = richPlain(p && p.rich_text); if (!t) return { ok: true, value: null }; try { return { ok: true, value: JSON.parse(t) }; } catch { return { ok: false, value: null }; } },
};

// كتابة صفحة (إنشاء أو تحديث). أعمدة «اختيارية» فقط تُسقَط عند غيابها من Notion؛ أي عمود آخر مفقود ⇒ فشل مغلق schema_mismatch
// (لا نُفوتر ولا نعتمد على بيانات ناقصة بصمت). نمط notionWriteOptional مع قائمة إسقاط ضيقة.
async function writePage(store, { method, path, parentDb, props, droppable = [], archived }) {
  let cur = { ...props };
  for (let attempt = 0; attempt <= droppable.length; attempt++) {
    const body = method === "POST" ? { parent: { database_id: parentDb }, properties: cur } : { ...(archived !== undefined ? { archived } : {}), ...(Object.keys(cur).length ? { properties: cur } : {}) };
    const r = await store.call(method, path, body);
    if (r.ok) return r.json;
    if (r.status === 400 && MISSING_PROP_RE.test(r.text || "")) {
      const named = droppable.filter((n) => n in cur && (r.text || "").includes(n));
      if (named.length) { delete cur[named[0]]; console.warn("eor-billing: Notion dropped optional prop", named[0]); continue; }
      console.error("eor-billing: schema mismatch", String(r.text).slice(0, 160));
      throw new Fail(502, "schema_mismatch");
    }
    console.error("eor-billing notion write error", r.status);
    throw new Fail(502, "notion_unavailable");
  }
  throw new Fail(502, "schema_mismatch");
}

// صفحة بمعرّفها مع فحص أنها من القاعدة المقصودة وغير مؤرشفة؛ وإلا 404 (لا يُكشف وجودها).
async function getPage(store, id, dbKey) {
  if (!isPageId(id)) throw new Fail(400, "invalid_id");
  const r = await store.call("GET", `/pages/${normId(id)}`);
  if (r.status === 404) throw new Fail(404, "not_found");
  if (!r.ok || !isObj(r.json)) throw new Fail(502, "notion_unavailable");
  const pg = r.json;
  if (pg.archived || pg.in_trash) throw new Fail(404, "not_found");
  if (normId(pg.parent && pg.parent.database_id) !== store.dbs[dbKey]) throw new Fail(404, "not_found");
  return pg;
}

// مسح قاعدة بفلتر؛ تجاوز السقف ⇒ فشل مغلق too_many_rows (لا نكمل على بيانات ناقصة). الصفوف المؤرشفة تُسقَط.
async function queryRows(store, dbKey, filter) {
  const rows = [];
  let cursor = "";
  for (let page = 0; page < BILLING_LIMITS.maxScanPages; page++) {
    const r = await store.call("POST", `/databases/${store.dbs[dbKey]}/query`, { ...(filter ? { filter } : {}), sorts: [{ timestamp: "created_time", direction: "ascending" }], page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    if (!r.ok || !isObj(r.json)) throw new Fail(502, "notion_unavailable");
    for (const x of r.json.results || []) if (isObj(x) && !x.archived && !x.in_trash && normId(x.parent && x.parent.database_id) === store.dbs[dbKey]) rows.push(x);
    if (!r.json.has_more || !r.json.next_cursor) return rows;
    cursor = String(r.json.next_cursor);
  }
  throw new Fail(503, "too_many_rows");
}
const eq = (prop, v) => ({ property: prop, rich_text: { equals: v } });
const and = (...f) => (f.length === 1 ? f[0] : { and: f });

/* ═════════════ تحويل الصفوف ═════════════ */
function placementFromPage(pg) {
  const q = pg.properties || {};
  const t = PLACEMENT_PROPS;
  const unit = UNIT_BY_AR[rd.sel(q[t.unit])] || null;
  const o = {
    id: normId(pg.id), clientId: rd.text(q[t.client]), clientName: rd.text(q[t.clientName]), employeeName: rd.text(q[t.employee]), employeeNo: rd.text(q[t.employeeNo]),
    occupationId: rd.text(q[t.occupationId]), engagement: ENGAGEMENT_BY_AR[rd.sel(q[t.engagement])] || null, unit,
    unitPriceHalalas: rd.int(q[t.unitPrice]), overtimeHourHalalas: rd.int(q[t.otPrice]), currency: rd.text(q[t.currency]),
    startDate: rd.date(q[t.start]), endDate: rd.date(q[t.end]) || null, status: PLACEMENT_STATUS_BY_AR[rd.sel(q[t.status])] || null,
    requestRef: rd.text(q[t.requestRef]), costUnitHalalas: rd.int(q[t.costUnit]), vendorId: rd.text(q[t.vendorId]), priceSource: SOURCE_BY_AR[rd.sel(q[t.priceSource])] || null,
  };
  return o;
}
function sheetFromPage(pg) {
  const q = pg.properties || {};
  const t = TIMESHEET_PROPS;
  const h = (p) => { const n = rd.num(p); return n === null ? null : Math.round(n * 100); };
  return {
    id: normId(pg.id), placementId: normId(rd.text(q[t.placement])), clientId: rd.text(q[t.client]), month: rd.text(q[t.month]),
    monthsH: h(q[t.months]), daysH: h(q[t.days]), hoursH: h(q[t.hours]), overtimeH: h(q[t.overtime]) || 0,
    status: TIMESHEET_STATUS_BY_AR[rd.sel(q[t.status])] || null, submittedBy: rd.text(q[t.submittedBy]), approvedBy: rd.text(q[t.approvedBy]), approvedAt: rd.date(q[t.approvedAt]) || null,
    rejectReason: rd.text(q[t.rejectReason]), invoiceId: normId(rd.text(q[t.invoiceId])), createdTime: pg.created_time || "",
  };
}
function invoiceFromPage(pg) {
  const q = pg.properties || {};
  const t = INVOICE_PROPS;
  const lines = rd.json(q[t.lines]), internal = rd.json(q[t.internal]), pending = rd.json(q[t.pending]);
  const inv = {
    id: normId(pg.id), clientId: rd.text(q[t.client]), clientName: rd.text(q[t.clientName]), month: rd.text(q[t.month]), serial: rd.text(q[t.serial]),
    lines: Array.isArray(lines.value) ? lines.value : [], internalLines: internal.value && Array.isArray(internal.value.lines) ? internal.value.lines : [],
    internalCfg: internal.value && isObj(internal.value.cfg) ? internal.value.cfg : {}, pending: Array.isArray(pending.value) ? pending.value : [],
    subtotalHalalas: rd.int(q[t.subtotal]), vatHalalas: rd.int(q[t.vat]), totalHalalas: rd.int(q[t.total]), vatRate: rd.num(q[t.vatRate]),
    currency: rd.text(q[t.currency]), status: INVOICE_STATUS_BY_AR[rd.sel(q[t.status])] || null, paymentRef: rd.text(q[t.paymentRef]),
    issuedAt: rd.date(q[t.issuedAt]) || null, dueAt: rd.date(q[t.dueAt]) || null, cancelReason: rd.text(q[t.cancelReason]), digest: rd.text(q[t.digest]),
    createdTime: pg.created_time || "",
  };
  // سلامة المال: JSON سليم والمجاميع تطابق الأسطر؛ وإلا العلم corrupt (العميل لا يراها والفريق يُنبَّه).
  const sum = inv.lines.reduce((s, l) => s + (isObj(l) && Number.isSafeInteger(l.amountHalalas) ? l.amountHalalas : NaN), 0);
  const incl = inv.internalCfg.pricesIncludeVat === true;
  inv.corrupt = !(lines.ok && internal.ok && pending.ok) || !Number.isSafeInteger(sum) || !isHalalas(inv.subtotalHalalas) || !isHalalas(inv.vatHalalas) || !isHalalas(inv.totalHalalas)
    || inv.totalHalalas !== inv.subtotalHalalas + inv.vatHalalas || (incl ? inv.totalHalalas !== sum : inv.subtotalHalalas !== sum) || !INVOICE_STATUSES.includes(inv.status) || !isMonth(inv.month);
  return inv;
}

const placementProps = (p) => {
  const t = PLACEMENT_PROPS, o = occupationById(p.occupationId);
  return {
    [t.key]: P.title(`${p.employeeNo} · ${p.employeeName}`), [t.client]: P.text(p.clientId), [t.clientName]: P.text(p.clientName), [t.employee]: P.text(p.employeeName), [t.employeeNo]: P.text(p.employeeNo),
    [t.occupationId]: P.text(p.occupationId), [t.occupation]: P.text(o ? o.nameAr : ""), [t.engagement]: P.sel(ENGAGEMENT_AR[p.engagement]), [t.unit]: P.sel(UNIT_AR[p.unit]),
    [t.unitPrice]: P.num(p.unitPriceHalalas), [t.otPrice]: P.num(p.overtimeHourHalalas), [t.currency]: P.text(p.currency), [t.start]: P.date(p.startDate), [t.end]: P.date(p.endDate),
    [t.status]: P.sel(PLACEMENT_STATUS_AR[p.status]), [t.requestRef]: P.text(p.requestRef), [t.costUnit]: P.num(p.costUnitHalalas), [t.vendorId]: P.text(p.vendorId),
    [t.priceSource]: P.sel(SOURCE_AR[p.priceSource]), [t.pricingInput]: P.json(p.pricingInput || {}),
  };
};
const PLACEMENT_DROPPABLE = [PLACEMENT_PROPS.clientName, PLACEMENT_PROPS.occupation, PLACEMENT_PROPS.requestRef];
const SHEET_DROPPABLE = [TIMESHEET_PROPS.submittedBy, TIMESHEET_PROPS.rejectReason];
const INVOICE_DROPPABLE = [INVOICE_PROPS.clientName, INVOICE_PROPS.cancelReason, INVOICE_PROPS.pending];

/* ═════════════ تحميل المدخلات ═════════════ */
async function loadClientPlacements(store, clientId) {
  const rows = await queryRows(store, "placements", eq(PLACEMENT_PROPS.client, clientId));
  return rows.map(placementFromPage).filter((p) => p.clientId === clientId);
}
async function loadMonthSheets(store, clientId, month) {
  const rows = await queryRows(store, "timesheets", and(eq(TIMESHEET_PROPS.client, clientId), eq(TIMESHEET_PROPS.month, month)));
  return rows.map(sheetFromPage).filter((s) => s.clientId === clientId && s.month === month);
}
async function loadClientInvoices(store, clientId) {
  const rows = await queryRows(store, "invoices", eq(INVOICE_PROPS.client, clientId));
  return rows.map(invoiceFromPage).filter((i) => i.clientId === clientId);
}
async function loadInvoice(store, id) { return invoiceFromPage(await getPage(store, id, "invoices")); }
async function loadPlacement(store, id) { return placementFromPage(await getPage(store, id, "placements")); }
async function loadSheet(store, id) { return sheetFromPage(await getPage(store, id, "timesheets")); }

const toBuildPlacement = (p) => ({ ...p });
async function buildFor(store, clientId, month, config) {
  const placements = await loadClientPlacements(store, clientId);
  const sheets = await loadMonthSheets(store, clientId, month);
  return { placements, sheets, build: buildInvoice({ clientId, month, placements: placements.map(toBuildPlacement), timesheets: sheets, config }) };
}

/* ═════════════ الإجراءات ═════════════ */
function readMonth(body, nowMs, { allowFuture = false } = {}) {
  if (!isMonth(body.month)) throw new Fail(400, "month_invalid", { field: "month" });
  if (!allowFuture && body.month > riyadhToday(nowMs).slice(0, 7)) throw new Fail(400, "month_in_future", { field: "month" });
  return body.month;
}
function readClientId(body) {
  const c = normalizeClientId(body.clientId);
  if (!c) throw new Fail(400, "client_invalid", { field: "clientId" });
  return c;
}
const clip = (s, n) => oneLine(s, n);

async function createPlacement(body, ctx, store, nowMs) {
  const clientId = readClientId(body);
  const employeeName = clip(body.employeeName, BILLING_LIMITS.nameMax);
  if (!employeeName) throw new Fail(400, "employee_name_required", { field: "employeeName" });
  const employeeNo = clip(body.employeeNo, BILLING_LIMITS.noMax);
  if (!employeeNo) throw new Fail(400, "employee_no_required", { field: "employeeNo" });
  const occupationId = typeof body.occupationId === "string" ? body.occupationId : "";
  if (!occupationById(occupationId)) throw new Fail(400, "occupation_unknown", { field: "occupationId" });
  const engagement = typeof body.engagementType === "string" && ["contract", "casual"].includes(body.engagementType.trim().toLowerCase()) ? body.engagementType.trim().toLowerCase() : null;
  if (!engagement) throw new Fail(400, "engagement_invalid", { field: "engagementType" });
  const billingUnit = engagement === "contract" ? "monthly" : (typeof body.billingUnit === "string" && ["monthly", "daily", "hourly"].includes(body.billingUnit.trim().toLowerCase()) ? body.billingUnit.trim().toLowerCase() : null);
  if (!billingUnit) throw new Fail(400, "billing_unit_invalid", { field: "billingUnit" });
  const unit = UNIT_OF[billingUnit];
  const workerType = body.workerType === "saudi" || body.workerType === "foreign" ? body.workerType : null;
  if (!workerType) throw new Fail(400, "worker_type_invalid", { field: "workerType" });
  const startDate = typeof body.startDate === "string" && isoDate(body.startDate) ? body.startDate : null;
  if (!startDate) throw new Fail(400, "start_date_invalid", { field: "startDate" });
  let endDate = null;
  if (!nul(body.endDate)) { if (typeof body.endDate !== "string" || !isoDate(body.endDate) || body.endDate < startDate) throw new Fail(400, "end_date_invalid", { field: "endDate" }); endDate = body.endDate; }
  const requestRef = nul(body.requestRef) ? "" : (typeof body.requestRef === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(body.requestRef.trim()) ? body.requestRef.trim() : null);
  if (requestRef === null) throw new Fail(400, "request_ref_invalid", { field: "requestRef" });
  const vendorId = nul(body.vendorId) ? "" : (typeof body.vendorId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.vendorId.trim()) ? body.vendorId.trim() : null);
  if (vendorId === null) throw new Fail(400, "vendor_invalid", { field: "vendorId" });
  const clientName = clip(body.clientName, BILLING_LIMITS.nameMax);

  // — السعر: لقطة تُثبَّت الآن. إمّا سعر متفق عليه صريح (override) وإمّا من ملف الإعداد وراتب مرجعي. —
  const intIn = (v, name, { max = BILLING_LIMITS.maxPriceHalalas, min = 0 } = {}) => {
    if (nul(v)) return null;
    if (!Number.isSafeInteger(v) || v < min || v > max) throw new Fail(400, name + "_invalid", { field: name });
    return v;
  };
  const ovUnit = intIn(body.unitPriceHalalas, "unitPriceHalalas", { min: 1 });
  const ovOt = intIn(body.overtimeHourHalalas, "overtimeHourHalalas");
  const ovCost = intIn(body.costUnitHalalas, "costUnitHalalas");
  if (engagement === "casual" && ovOt !== null) throw new Fail(400, "overtime_not_allowed", { field: "overtimeHourHalalas" });
  let unitPrice, otPrice = null, costUnit = ovCost, currency, source, pricingInput;
  const cfgAll = packageRateConfigFromPricing(ctx.pricing);
  const bcfg = billingConfigFromPricing(ctx.pricing);
  if (ovUnit !== null) {
    if (engagement === "contract" && ovOt === null) throw new Fail(400, "overtime_price_required", { field: "overtimeHourHalalas" });
    unitPrice = ovUnit; otPrice = engagement === "contract" ? ovOt : null; source = "override";
    currency = (cfgAll && cfgAll.currency) || bcfg.currency;
    if (!currency) throw new Fail(409, "pricing_pending");
    pricingInput = { source };
  } else {
    if (!cfgAll) throw new Fail(409, "pricing_pending");
    const salary = typeof body.salary === "number" ? body.salary : (typeof body.salary === "string" && /^\d{1,7}(\.\d{1,2})?$/.test(body.salary.trim()) ? Number(body.salary.trim()) : NaN);
    if (!Number.isFinite(salary) || salary <= 0 || salary > 100000) throw new Fail(400, "salary_invalid", { field: "salary" });
    const today = riyadhToday(nowMs);
    if (engagement === "contract") {
      if (!cfgAll.appliesTo.includes(workerType)) throw new Fail(409, "not_applicable");
      const insurance = isObj(body.insurance) ? normalizeInsuranceFields(body.insurance) : undefined;
      const res = computePackageRate({ mode: "lump", package: salary, insurance, config: { ...cfgAll, today } });
      if (res.status === "invalid_input") throw new Fail(400, "salary_invalid", { field: "salary" });
      if (res.status !== "ok" || res.pendingDecision) throw new Fail(409, "pricing_pending");
      unitPrice = packageSaleMonthlyHalalas(res);
      otPrice = sarToHalalas(res.otHour);
      if (costUnit === null) costUnit = sarToHalalas(res.internal.cost);
      currency = res.currency;
      pricingInput = { source: "config", mode: "lump", salary, ...(insurance ? { insurance } : {}) };
    } else {
      if (!(cfgAll.casual && cfgAll.casual.appliesTo.includes(workerType))) throw new Fail(409, "not_applicable");
      const hp = parseCasualHours(body.hoursPerDay);
      if (!hp.ok) throw new Fail(400, "hours_per_day_invalid", { field: "hoursPerDay" });
      const res = computeCasualRate({ package: salary, hoursPerDay: hp.value === null ? undefined : hp.value, config: { ...cfgAll, today } });
      if (res.status === "invalid_input") throw new Fail(400, "salary_invalid", { field: "salary" });
      if (res.status !== "ok") throw new Fail(409, "pricing_pending");
      unitPrice = unit === "hour" ? res.units.hourlyHalalas : unit === "day" ? res.units.dailyHalalas : res.units.monthlyHalalas;
      if (costUnit === null) costUnit = unit === "hour" ? res.internal.workerHourlyHalalas : unit === "day" ? res.internal.workerDailyHalalas : res.internal.workerMonthlyHalalas;
      currency = res.currency;
      pricingInput = { source: "config", mode: "casual", salary, hoursPerDay: res.hoursPerDay };
      source = "config";
    }
    source = "config";
  }
  if (!isHalalas(unitPrice) || unitPrice < 1 || unitPrice > BILLING_LIMITS.maxPriceHalalas) throw new Fail(409, "pricing_pending");

  // — منع التكرار: موظف برقم داخلي واحد نشط لكل عميل —
  const existing = await loadClientPlacements(store, clientId);
  if (existing.some((p) => p.status === "active" && p.employeeNo === employeeNo)) throw new Fail(409, "duplicate_placement");

  const placement = { clientId, clientName, employeeName, employeeNo, occupationId, engagement, unit, unitPriceHalalas: unitPrice, overtimeHourHalalas: otPrice, currency, startDate, endDate, status: "active", requestRef, costUnitHalalas: costUnit, vendorId, priceSource: source, pricingInput };
  const pg = await writePage(store, { method: "POST", path: "/pages", parentDb: store.dbs.placements, props: placementProps(placement), droppable: PLACEMENT_DROPPABLE });
  if (!pg || !pg.id) throw new Fail(502, "notion_unavailable");
  return { ok: true, placement: placementOpsView({ ...placement, id: normId(pg.id) }) };
}

async function listPlacements(body, auth, store) {
  let rows = [];
  if (auth.role === "ops") {
    const filters = [];
    if (!nul(body.clientId)) filters.push(eq(PLACEMENT_PROPS.client, readClientId(body)));
    rows = await queryRows(store, "placements", filters.length ? and(...filters) : undefined);
    return { ok: true, placements: rows.map(placementFromPage).map(placementOpsView) };
  }
  const seen = new Map();
  for (const key of auth.keys) for (const p of await loadClientPlacements(store, key)) if (ownsClient(auth, p.clientId)) seen.set(p.id, p);
  return { ok: true, placements: [...seen.values()].map(clientPlacementView) };
}

async function submitTimesheet(body, auth, store, ctx, nowMs) {
  if (!isPageId(body.placementId)) throw new Fail(400, "placement_invalid", { field: "placementId" });
  const month = readMonth(body, nowMs);
  const placement = await loadPlacement(store, body.placementId);
  if (placement.status === "cancelled") throw new Fail(409, "placement_cancelled");
  const bcfg = billingConfigFromPricing(ctx.pricing);
  const { activeDays } = activeDaysInMonth({ startDate: placement.startDate, endDate: placement.endDate }, month);
  if (activeDays === 0) throw new Fail(409, "placement_not_active_in_month");
  const q = validateTimesheetQuantities(body, { engagement: placement.engagement, unit: placement.unit, month, hoursMax: bcfg.hoursMax });
  if (!q.ok) throw new Fail(400, q.error, { field: q.field });
  const status = body.status === undefined || body.status === null || body.status === "" ? "submitted" : body.status;
  if (status !== "draft" && status !== "submitted") throw new Fail(400, "status_invalid", { field: "status" });

  const t = TIMESHEET_PROPS;
  const qty = { [t.months]: P.num(null), [t.days]: P.num(null), [t.hours]: P.num(null) };
  qty[q.column === "months" ? t.months : q.column === "days" ? t.days : t.hours] = P.num(q.quantityH / 100);
  const actor = auth.role === "ops" ? "ops" : "";
  const fields = {
    ...qty, [t.overtime]: P.num(q.overtimeH / 100), [t.status]: P.sel(TIMESHEET_STATUS_AR[status]), [t.submittedBy]: P.text(actor),
    [t.approvedBy]: P.text(""), [t.approvedAt]: P.date(null), [t.rejectReason]: P.text(""),
  };
  const all = (await queryRows(store, "timesheets", eq(t.placement, placement.id))).map(sheetFromPage).filter((s) => s.placementId === placement.id && s.month === month);
  if (all.length > 1) throw new Fail(409, "duplicate_timesheet");
  let sheet;
  if (all.length === 1) {
    if (all[0].invoiceId) throw new Fail(409, "timesheet_invoiced");
    await writePage(store, { method: "PATCH", path: `/pages/${all[0].id}`, props: fields, droppable: SHEET_DROPPABLE });
    sheet = await loadSheet(store, all[0].id);
  } else {
    const props = { [t.key]: P.title(`${placement.id.slice(0, 8)}-${month}`), [t.placement]: P.text(placement.id), [t.client]: P.text(placement.clientId), [t.month]: P.text(month), [t.invoiceId]: P.text(""), ...fields };
    const pg = await writePage(store, { method: "POST", path: "/pages", parentDb: store.dbs.timesheets, props, droppable: SHEET_DROPPABLE });
    if (!pg || !pg.id) throw new Fail(502, "notion_unavailable");
    // سباق إدخالين متزامنين: الأقدم يبقى والأحدث يُؤرشَف.
    const again = (await queryRows(store, "timesheets", eq(t.placement, placement.id))).map(sheetFromPage).filter((s) => s.placementId === placement.id && s.month === month);
    if (again.length > 1) {
      again.sort((a, b) => (a.createdTime || "").localeCompare(b.createdTime || "") || a.id.localeCompare(b.id));
      for (const loser of again.slice(1)) await writePage(store, { method: "PATCH", path: `/pages/${loser.id}`, props: {}, archived: true });
      if (again[0].id !== normId(pg.id)) { sheet = again[0]; return { ok: true, timesheet: opsTimesheetView(sheet, placement), deduped: true }; }
    }
    sheet = sheetFromPage(pg);
  }
  return { ok: true, timesheet: opsTimesheetView(sheet, placement) };
}

async function listTimesheets(body, auth, store, nowMs) {
  const month = nul(body.month) ? "" : readMonth(body, nowMs, { allowFuture: true });
  const status = nul(body.status) ? "" : (TIMESHEET_STATUSES.includes(body.status) ? body.status : (() => { throw new Fail(400, "status_invalid", { field: "status" }); })());
  const keys = auth.role === "ops" ? (nul(body.clientId) ? [null] : [readClientId(body)]) : auth.keys;
  const out = [];
  for (const key of keys) {
    const placements = key ? await loadClientPlacements(store, key) : (await queryRows(store, "placements")).map(placementFromPage);
    const byId = new Map(placements.filter((p) => auth.role === "ops" || ownsClient(auth, p.clientId)).map((p) => [p.id, p]));
    const filters = [];
    if (key) filters.push(eq(TIMESHEET_PROPS.client, key));
    if (month) filters.push(eq(TIMESHEET_PROPS.month, month));
    const rows = (await queryRows(store, "timesheets", filters.length ? and(...filters) : undefined)).map(sheetFromPage);
    for (const s of rows) {
      const p = byId.get(s.placementId);
      if (!p) continue;                                           // ورقة بلا تنسيب مملوك ⇒ لا تُعرض (تنسيبها من القاعدة هو المرجع)
      if (month && s.month !== month) continue;
      if (status && s.status !== status) continue;
      if (!nul(body.placementId) && s.placementId !== normId(body.placementId)) continue;
      if (auth.role === "client" && s.status === "draft") continue;   // المسودة لم تُقدَّم بعد
      out.push(auth.role === "ops" ? opsTimesheetView(s, p) : clientTimesheetView(s, p));
    }
  }
  out.sort((a, b) => b.month.localeCompare(a.month) || a.employeeNo.localeCompare(b.employeeNo));
  return { ok: true, timesheets: out };
}

async function approveTimesheet(body, auth, store) {
  if (!isPageId(body.timesheetId)) throw new Fail(400, "timesheet_invalid", { field: "timesheetId" });
  const decision = body.decision === undefined || body.decision === null || body.decision === "" ? "approve" : body.decision;
  if (decision !== "approve" && decision !== "reject") throw new Fail(400, "decision_invalid", { field: "decision" });
  const sheet = await loadSheet(store, body.timesheetId);
  // الملكية: التنسيب من قاعدته هو المرجع، لا النسخة المخزَّنة في الورقة.
  let placement;
  try { placement = await loadPlacement(store, sheet.placementId); } catch (e) { if (e instanceof Fail && e.status === 404) throw new Fail(404, "not_found"); throw e; }
  if (!ownsClient(auth, placement.clientId)) throw new Fail(404, "not_found");
  if (sheet.clientId !== placement.clientId) throw new Fail(409, "data_inconsistent");
  const target = decision === "approve" ? "approved" : "rejected";
  if (sheet.status === target) return { ok: true, timesheet: clientTimesheetView(sheet, placement), unchanged: true };       // تكرار الطلب لا يضرّ
  if (sheet.invoiceId) throw new Fail(409, "timesheet_invoiced");
  if (sheet.status !== "submitted") throw new Fail(409, "not_submitted");
  if (decision === "approve") {
    if (typeof body.version !== "string" || !body.version) throw new Fail(400, "version_required", { field: "version" });
    if (body.version !== sheetVersion(sheet)) throw new Fail(409, "timesheet_changed");
  }
  const t = TIMESHEET_PROPS;
  const nowIso = new Date().toISOString();
  const props = decision === "approve"
    ? { [t.status]: P.sel(TIMESHEET_STATUS_AR.approved), [t.approvedBy]: P.text(auth.email || auth.keys[0]), [t.approvedAt]: P.date(nowIso.slice(0, 10)), [t.rejectReason]: P.text("") }
    : { [t.status]: P.sel(TIMESHEET_STATUS_AR.rejected), [t.approvedBy]: P.text(""), [t.approvedAt]: P.date(null), [t.rejectReason]: P.text(clip(body.reason, BILLING_LIMITS.reasonMax)) };
  await writePage(store, { method: "PATCH", path: `/pages/${sheet.id}`, props, droppable: SHEET_DROPPABLE });
  return { ok: true, timesheet: clientTimesheetView(await loadSheet(store, sheet.id), placement) };
}

// يضبط/يمسح معرّف الفاتورة على أوراق الدوام المشمولة. يتحقق من كل ورقة بعد الكتابة.
async function setSheetsInvoice(store, sheetIds, invoiceId) {
  for (const id of sheetIds) await writePage(store, { method: "PATCH", path: `/pages/${id}`, props: { [TIMESHEET_PROPS.invoiceId]: P.text(invoiceId) } });
}
const includedSheetIds = (build, sheets) => {
  const billed = new Set(build.lines.map((l) => l.placementId));
  return sheets.filter((s) => s.status === "approved" && billed.has(s.placementId)).map((s) => s.id);
};
const invoiceProps = (inv, build, bcfg) => {
  const t = INVOICE_PROPS;
  return {
    [t.key]: P.title(`${inv.month} · ${inv.clientId}`), [t.client]: P.text(inv.clientId), [t.clientName]: P.text(inv.clientName), [t.month]: P.text(inv.month),
    [t.lines]: P.json(build.lines), [t.internal]: P.json({ lines: build.internalLines, cfg: { vatRate: build.vatRate, pricesIncludeVat: build.pricesIncludeVat, proration: build.proration, vatSource: bcfg.vatSource } }),
    [t.pending]: P.json(build.pending), [t.subtotal]: P.num(build.subtotalHalalas), [t.vat]: P.num(build.vatHalalas), [t.total]: P.num(build.totalHalalas),
    [t.vatRate]: P.num(build.vatRate), [t.currency]: P.text(build.currency), [t.digest]: P.text(build.digest),
  };
};

async function generateInvoice(body, store, ctx, nowMs) {
  const clientId = readClientId(body);
  const month = readMonth(body, nowMs);
  const bcfg = billingConfigFromPricing(ctx.pricing);
  const { placements, sheets, build } = await buildFor(store, clientId, month, bcfg);
  if (build.status === "invalid_input") throw new Fail(409, "build_invalid", { errors: build.errors });
  if (build.status === "pending_pricing") throw new Fail(409, "pricing_pending", { missing: build.missing });
  const invoices = (await loadClientInvoices(store, clientId)).filter((i) => i.month === month && ACTIVE_INVOICE.includes(i.status));
  if (invoices.length > 1) throw new Fail(409, "duplicate_invoices", { invoiceIds: invoices.map((i) => i.id) });
  const active = invoices[0] || null;
  if (active) {
    if (active.corrupt) throw new Fail(409, "invoice_corrupt", { invoiceId: active.id });
    if (active.digest === build.digest) return { ok: true, invoice: opsInvoiceView(active), existing: true, stale: false };
    if (active.status !== "draft") throw new Fail(409, "invoice_stale", { invoiceId: active.id, invoiceStatus: active.status, hint: "cancel_and_reissue" });
    if (build.status === "nothing_to_bill") throw new Fail(409, "invoice_stale", { invoiceId: active.id, invoiceStatus: "draft", hint: "cancel_draft" });
    // مسودة متقادمة: تُحدَّث في مكانها (لم تُصدَر بعد) وتُقفل أوراقها الجديدة وتُفكّ القديمة.
    const prev = sheets.filter((s) => s.invoiceId === active.id).map((s) => s.id);
    const inv = { month, clientId, clientName: active.clientName };
    await writePage(store, { method: "PATCH", path: `/pages/${active.id}`, props: invoiceProps(inv, build, bcfg), droppable: INVOICE_DROPPABLE });
    const next = includedSheetIds(build, sheets);
    await setSheetsInvoice(store, prev.filter((x) => !next.includes(x)), "");
    await setSheetsInvoice(store, next, active.id);
    return { ok: true, invoice: opsInvoiceView(await loadInvoice(store, active.id)), refreshed: true };
  }
  if (build.status === "nothing_to_bill") throw new Fail(409, "nothing_to_bill", { pending: build.pending, excluded: build.excluded });

  const clientName = clip(body.clientName, BILLING_LIMITS.nameMax) || (placements.find((p) => p.clientName) || {}).clientName || "";
  const inv = { month, clientId, clientName };
  const props = { ...invoiceProps(inv, build, bcfg), [INVOICE_PROPS.status]: P.sel(INVOICE_STATUS_AR.draft), [INVOICE_PROPS.serial]: P.text(""), [INVOICE_PROPS.paymentRef]: P.text(""), [INVOICE_PROPS.cancelReason]: P.text("") };
  const pg = await writePage(store, { method: "POST", path: "/pages", parentDb: store.dbs.invoices, props, droppable: INVOICE_DROPPABLE });
  if (!pg || !pg.id) throw new Fail(502, "notion_unavailable");
  const id = normId(pg.id);
  // سباق توليدين متزامنين لنفس (عميل، شهر): الأقدم يبقى والأحدث يُلغى — فلا فاتورتان فعّالتان.
  const mine = (await loadClientInvoices(store, clientId)).filter((i) => i.month === month && ACTIVE_INVOICE.includes(i.status));
  if (mine.length > 1) {
    mine.sort((a, b) => (a.createdTime || "").localeCompare(b.createdTime || "") || a.id.localeCompare(b.id));
    for (const loser of mine.slice(1)) await writePage(store, { method: "PATCH", path: `/pages/${loser.id}`, props: { [INVOICE_PROPS.status]: P.sel(INVOICE_STATUS_AR.cancelled), [INVOICE_PROPS.cancelReason]: P.text("duplicate_generation") }, droppable: INVOICE_DROPPABLE });
    if (mine[0].id !== id) return { ok: true, invoice: opsInvoiceView(mine[0]), existing: true, stale: false };
  }
  const sheetIds = includedSheetIds(build, sheets);
  try { await setSheetsInvoice(store, sheetIds, id); }
  catch (e) {            // لم يكتمل القفل ⇒ نلغي المسودة ونفك ما قُفل: لا فاتورة بأوراق غير مقفلة
    try { await writePage(store, { method: "PATCH", path: `/pages/${id}`, props: { [INVOICE_PROPS.status]: P.sel(INVOICE_STATUS_AR.cancelled), [INVOICE_PROPS.cancelReason]: P.text("lock_failed") }, droppable: INVOICE_DROPPABLE }); await setSheetsInvoice(store, sheetIds, ""); } catch {}
    throw e;
  }
  return { ok: true, invoice: opsInvoiceView(await loadInvoice(store, id)), created: true };
}

// حجز رقم تسلسلي: اكتب الرقم أولاً ثم تحقّق أنه عند هذه الفاتورة وحدها (Notion بلا تسلسل ذرّي)؛ الخاسر يتراجع ويعيد.
async function reserveSerial(store, inv) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const monthRows = (await queryRows(store, "invoices", eq(INVOICE_PROPS.month, inv.month))).map(invoiceFromPage).filter((i) => i.month === inv.month);
    const serial = inv.serial && isSerial(inv.serial) && attempt === 0 ? inv.serial : nextSerial(inv.month, monthRows.map((i) => i.serial));
    await writePage(store, { method: "PATCH", path: `/pages/${inv.id}`, props: { [INVOICE_PROPS.serial]: P.text(serial) } });
    const holders = (await queryRows(store, "invoices", eq(INVOICE_PROPS.serial, serial))).map(invoiceFromPage).filter((i) => i.serial === serial);
    holders.sort((a, b) => (a.createdTime || "").localeCompare(b.createdTime || "") || a.id.localeCompare(b.id));
    if (holders.length === 1 && holders[0].id === inv.id) return serial;
    if (holders.length > 1 && holders[0].id === inv.id) return serial;       // الأقدم يفوز؛ الآخر يتراجع عند دوره
    await writePage(store, { method: "PATCH", path: `/pages/${inv.id}`, props: { [INVOICE_PROPS.serial]: P.text("") } });
    inv = { ...inv, serial: "" };
  }
  throw new Fail(503, "serial_conflict");
}

async function issueInvoice(body, store, ctx, nowMs) {
  const inv = await loadInvoice(store, body.invoiceId);
  if (inv.corrupt) throw new Fail(409, "invoice_corrupt");
  if (inv.status === "issued" || inv.status === "paid") return { ok: true, invoice: opsInvoiceView(inv), unchanged: true };
  if (inv.status !== "draft") throw new Fail(409, "invoice_not_draft");
  const bcfg = billingConfigFromPricing(ctx.pricing);
  const { build } = await buildFor(store, inv.clientId, inv.month, bcfg);       // المسودة المتقادمة لا تُصدَر
  if (build.status !== "ok" || build.digest !== inv.digest) throw new Fail(409, "invoice_stale", { invoiceId: inv.id, hint: "regenerate" });
  let dueDays = bcfg.dueDays;
  if (!nul(body.dueDays)) { if (!Number.isInteger(body.dueDays) || body.dueDays < 0 || body.dueDays > 365) throw new Fail(400, "due_days_invalid", { field: "dueDays" }); dueDays = body.dueDays; }
  const serial = await reserveSerial(store, inv);
  const today = riyadhToday(nowMs);
  await writePage(store, { method: "PATCH", path: `/pages/${inv.id}`, props: {
    [INVOICE_PROPS.status]: P.sel(INVOICE_STATUS_AR.issued), [INVOICE_PROPS.serial]: P.text(serial), [INVOICE_PROPS.issuedAt]: P.date(today), [INVOICE_PROPS.dueAt]: P.date(dueDays === null ? null : addDays(today, dueDays)),
  } });
  return { ok: true, invoice: opsInvoiceView(await loadInvoice(store, inv.id)) };
}

async function cancelInvoice(body, store) {
  const inv = await loadInvoice(store, body.invoiceId);
  if (inv.status === "cancelled") return { ok: true, invoice: opsInvoiceView(inv), unchanged: true };
  if (inv.status === "paid") throw new Fail(409, "invoice_paid");
  const reason = clip(body.reason, BILLING_LIMITS.reasonMax);
  if (!reason) throw new Fail(400, "reason_required", { field: "reason" });
  await writePage(store, { method: "PATCH", path: `/pages/${inv.id}`, props: { [INVOICE_PROPS.status]: P.sel(INVOICE_STATUS_AR.cancelled), [INVOICE_PROPS.cancelReason]: P.text(reason) }, droppable: INVOICE_DROPPABLE });
  const locked = (await loadMonthSheets(store, inv.clientId, inv.month)).filter((s) => s.invoiceId === inv.id).map((s) => s.id);
  await setSheetsInvoice(store, locked, "");                       // تُفكّ الأوراق فيصير التعديل ممكناً وتُصدر فاتورة جديدة
  return { ok: true, invoice: opsInvoiceView(await loadInvoice(store, inv.id)), unlocked: locked.length };
}

async function recordPayment(body, store) {
  const inv = await loadInvoice(store, body.invoiceId);
  const ref = clip(body.paymentRef, BILLING_LIMITS.refMax);
  if (!ref) throw new Fail(400, "payment_ref_required", { field: "paymentRef" });
  if (inv.status === "paid") { if (inv.paymentRef === ref) return { ok: true, invoice: opsInvoiceView(inv), unchanged: true }; throw new Fail(409, "already_paid"); }
  if (inv.status !== "issued" || inv.corrupt) throw new Fail(409, "invoice_not_issued");
  await writePage(store, { method: "PATCH", path: `/pages/${inv.id}`, props: { [INVOICE_PROPS.status]: P.sel(INVOICE_STATUS_AR.paid), [INVOICE_PROPS.paymentRef]: P.text(ref) } });
  return { ok: true, invoice: opsInvoiceView(await loadInvoice(store, inv.id)) };
}

async function listInvoices(body, auth, store) {
  const statusF = nul(body.status) ? "" : (INVOICE_STATUSES.includes(body.status) ? body.status : (() => { throw new Fail(400, "status_invalid", { field: "status" }); })());
  const monthF = nul(body.month) ? "" : (isMonth(body.month) ? body.month : (() => { throw new Fail(400, "month_invalid", { field: "month" }); })());
  let invs = [];
  if (auth.role === "ops") {
    const filters = [];
    if (!nul(body.clientId)) filters.push(eq(INVOICE_PROPS.client, readClientId(body)));
    if (monthF) filters.push(eq(INVOICE_PROPS.month, monthF));
    invs = (await queryRows(store, "invoices", filters.length ? and(...filters) : undefined)).map(invoiceFromPage);
  } else {
    for (const key of auth.keys) invs.push(...(await loadClientInvoices(store, key)).filter((i) => ownsClient(auth, i.clientId)));
  }
  invs = invs.filter((i) => (!statusF || i.status === statusF) && (!monthF || i.month === monthF));
  invs.sort((a, b) => b.month.localeCompare(a.month) || (b.createdTime || "").localeCompare(a.createdTime || ""));
  const out = auth.role === "ops" ? invs.map(opsInvoiceView) : invs.map(clientInvoiceView).filter(Boolean);
  return { ok: true, invoices: out.slice(0, 100) };
}

async function getInvoice(body, auth, store, ctx) {
  const inv = await loadInvoice(store, body.invoiceId);
  if (auth.role === "ops") {
    const view = opsInvoiceView(inv);
    if (body.check === true && !inv.corrupt && ACTIVE_INVOICE.includes(inv.status)) {           // متقادمة؟ (يفحص الأوراق الحالية)
      const { build } = await buildFor(store, inv.clientId, inv.month, billingConfigFromPricing(ctx.pricing));
      view.stale = !(build.status === "ok" || build.status === "nothing_to_bill") || build.digest !== inv.digest;
    }
    return { ok: true, invoice: view };
  }
  if (!ownsClient(auth, inv.clientId)) throw new Fail(404, "not_found");
  const view = clientInvoiceView(inv);
  if (!view) throw new Fail(404, "not_found");
  return { ok: true, invoice: view };
}

/* ═════════════ المعالج ═════════════ */
// handleEorBilling(body, ctx) → { ok:true, … } | { ok:false, status, error, field? }
//   ctx: { auth, pricing, now, fetch, notionToken, env }
//   ctx.auth: { role:"ops" } من فحص مفتاح المالك/جلسته في المسار، أو authFromSession(await getSession(req)) للعميل. غيابه ⇒ 401.
export async function handleEorBilling(body, ctx = {}) {
  try {
    const b = isObj(body) ? body : {};
    const allowed = BILLING_ACTIONS[b.action];
    if (!allowed) return fail(400, "unknown_action");
    const auth = ctx.auth;
    if (!isObj(auth) || (auth.role !== "ops" && !(auth.role === "client" && Array.isArray(auth.keys) && auth.keys.length))) return fail(401, "unauthorized");
    if (!allowed.includes(auth.role)) return fail(403, "forbidden");
    const nowMs = ctx.now != null ? ctx.now : Date.now();
    const store = makeStore(ctx);
    switch (b.action) {
      case "create-placement": return await createPlacement(b, ctx, store, nowMs);
      case "list-placements": return await listPlacements(b, auth, store);
      case "submit-timesheet": return await submitTimesheet(b, auth, store, ctx, nowMs);
      case "list-timesheets": return await listTimesheets(b, auth, store, nowMs);
      case "approve-timesheet": return await approveTimesheet(b, auth, store);
      case "generate-invoice": return await generateInvoice(b, store, ctx, nowMs);
      case "issue-invoice": if (!isPageId(b.invoiceId)) throw new Fail(400, "invoice_invalid", { field: "invoiceId" }); return await issueInvoice(b, store, ctx, nowMs);
      case "cancel-invoice": if (!isPageId(b.invoiceId)) throw new Fail(400, "invoice_invalid", { field: "invoiceId" }); return await cancelInvoice(b, store);
      case "record-payment": if (!isPageId(b.invoiceId)) throw new Fail(400, "invoice_invalid", { field: "invoiceId" }); return await recordPayment(b, store);
      case "list-invoices": return await listInvoices(b, auth, store);
      case "get-invoice": if (!isPageId(b.invoiceId)) throw new Fail(400, "invoice_invalid", { field: "invoiceId" }); return await getInvoice(b, auth, store, ctx);
      default: return fail(400, "unknown_action");
    }
  } catch (e) {
    if (e instanceof Fail) return fail(e.status, e.code, e.extra);
    console.error("eor-billing exception", String((e && e.message) || e).slice(0, 120));
    return fail(502, "unavailable");
  }
}
