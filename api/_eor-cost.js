// Business Partner — حاسبة تكلفة وتسعير الموظف على بند التعاقد (EOR) وفاتورته الشهرية.
//
// يملكه وكيل `eor`. وحدة صِرفة (ESM): لا شبكة ولا قاعدة ولا ساعة، ولا قراءة ملفات إلا ما يفوّضه إلى api/_eor-labor.js (بيانات أنظمة العمل الثابتة، تُقرأ مرة
// وتُخزَّن، والاختبار يمرّر نسخة معدَّلة عبر packageRateConfigFromPricing(pricing, labor)). ملف مساعد يبدأ بـ`_` فلا يُحتسب
// دالةً جديدة (السقف ١٢). المستدعي (طبقة الـAPI) يقرأ api/_eor-pricing.json ويحوّله بـcostConfigFromPricing
// ثم يمرّره هنا — فلا رقم في هذا الملف: الهامش والضريبة وقواعد المخصّص وأيام الشهر المتفق عليها كلها من
// الإعداد الذي يملؤه المالك (CLAUDE.md §4: لا أسعار مخترعة).
//
// القاعدة: أي قيمة لازمة فارغة (null/غائبة) ⇒ { status:"pending_pricing", missing:[…] } ولا رقم واحد في الردّ.
// والصفر الصريح قيمة صالحة (عاملٌ سعودي بلا رسوم استقدام = 0) — الفرق بين «لا أعرف» و«صفر» مقصود.
//
// المبالغ كلها أعدادٌ صحيحة بالهللة (١ ريال = ١٠٠ هللة). أسماء الحقول تنتهي بـHalalas كي لا يُمرَّر ريالٌ بالخطأ؛
// وأي قيمة غير صحيحة أو سالبة تُرفض { status:"invalid_input" } ولا تُقرَّب بصمت.
//
// التقريب (معلَن في كل ردّ: rounding = "half_up_per_line"):
//   • نصف لأعلى على مستوى كل سطر، بحساب BigInt صحيح — بلا أعداد عشرية في أي مرحلة.
//   • الاستقدام والتأشيرة والمورّد: كلٌّ يُقسَّم على مدة العقد ويُقرَّب سطره على حدة، والفرق التراكمي مع
//     المجموع الأصلي يُعرض صراحةً في oneTime.residualHalalas (لا يُخفى ولا يُوزَّع).
//   • الهامش = التكلفة × النسبة مقرَّبةً، وسعر البيع = التكلفة + الهامش (فلا يخالف مجموعُه أجزاءه).
//   • الضريبة على مجموع الفاتورة مرة واحدة، لا على كل سطر.
//
// الحساب:
//   التكلفة الشهرية = الراتب + الحكومي + مخصّص نهاية الخدمة + مخصّص الإجازات + (استقدام + تأشيرة + مورّد) ÷ المدة
//   سعر البيع الشهري = التكلفة × (1 + الهامش)
//   سطر الفاتورة = سعر البيع الشهري × أيام الحضور المعتمدة ÷ أيام الشهر المتفق عليها
//
// الخصوصية: computeCostSheet يُخرج بنيةً داخلية (راتب، هامش…) لا تصل واجهة العميل أبداً؛ clientView وحدها
// تُخرج للعميل سعر البيع (وتفصيلاً بمجموعتين اختياري) دون الهامش أو الراتب الخام أو رسوم المورّد.

import { BILLABLE_STAGES } from "./_eor-flow.js";
import { saudiLabor, gosiEmployerPct, gosiRegimeFor } from "./_eor-labor.js";

export const ROUNDING_MODE = "half_up_per_line";
export const COST_VISIBILITY = Object.freeze(["total", "breakdown"]);
export const TIMESHEET_STATUSES = Object.freeze(["draft", "submitted", "approved", "rejected"]);
const RATE_SCALE = 1_000_000;                         // دقة النسب: جزء من مليون
const MAX_CONTRACT_MONTHS = 120;

/* ═════════════ الحساب الصحيح ═════════════ */
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isHalalas = (v) => Number.isSafeInteger(v) && v >= 0;
const isRate = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const nul = (v) => v === null || v === undefined;

// round-half-up(a × b ÷ c) لأعداد صحيحة غير سالبة، بلا أي عدد عشري.
export function mulDivHalfUp(a, b, c) {
  const A = BigInt(a), B = BigInt(b), C = BigInt(c);
  if (A < 0n || B < 0n || C <= 0n) throw new RangeError("mulDivHalfUp: non-negative integers and a positive divisor only");
  const r = (2n * A * B + C) / (2n * C);
  if (r > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("mulDivHalfUp: result out of safe range");
  return Number(r);
}
const ppm = (rate) => Math.round(rate * RATE_SCALE);
const applyRate = (amount, rate) => mulDivHalfUp(amount, ppm(rate), RATE_SCALE);

// ريال (قد يحمل كسراً) ← هللة صحيحة. toPrecision يزيل ضجيج الفاصلة العائمة (0.285×100 = 28.499999…).
export const sarToHalalas = (sar) => Math.round(Number((Number(sar) * 100).toPrecision(12)));
export const halalasToSar = (h) => h / 100;

/* ═════════════ الإعداد ═════════════ */
// يحوّل ملف api/_eor-pricing.json (ريال، كسور عشرية) إلى إعداد هذه الوحدة (هللة). قيمة غير صالحة النوع ⇒ null
// ⇒ تظهر «ناقصة» لا رقماً مشوَّهاً.
export function costConfigFromPricing(pricing) {
  const p = isObj(pricing) ? pricing : {};
  const c = isObj(p.cost) ? p.cost : {};
  const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const money = (v) => (num(v) === null ? null : sarToHalalas(v));
  const rule = (r) => {
    const x = isObj(r) ? r : {};
    return { percentOfSalary: num(x.percent_of_salary), fixedMonthlyHalalas: money(x.fixed_monthly) };
  };
  return {
    currency: typeof p.currency === "string" && p.currency.trim() ? p.currency.trim() : null,
    vatRate: num(p.vat_rate),
    marginRate: num(c.margin_rate),
    accrual: { eos: rule(c.end_of_service_accrual), leave: rule(c.leave_accrual) },
    agreedMonthDays: num(c.agreed_month_days),
    hoursPerDay: num(c.hours_per_day),
    clientCostVisibility: COST_VISIBILITY.includes(c.client_cost_visibility) ? c.client_cost_visibility : null,
    validFrom: typeof p.valid_from === "string" ? p.valid_from : null,
    validUntil: typeof p.valid_until === "string" ? p.valid_until : null,
  };
}

/* ═════════════ ورقة التكلفة ═════════════ */
const MONEY_INPUTS = [
  ["salaryHalalas", "input.salary"],
  ["governmentMonthlyHalalas", "input.government_monthly"],
  ["recruitmentHalalas", "input.recruitment"],
  ["visaHalalas", "input.visa"],
  ["vendorFeeHalalas", "input.vendor_fee"],
];

// مخصّص شهري: الإدخال الصريح، ثم الثابت في الإعداد، ثم النسبة من الراتب.
// يُرجع { value, missing }: missing=true إن لم توجد أي قاعدة (والنسبة بلا راتب ليست «ناقصة» — الراتب نفسه مُبلَّغ ناقصاً).
function accrualOf(override, rule, salary, errors, field) {
  if (!nul(override)) {
    if (!isHalalas(override)) { errors.push({ field, error: "not_halalas" }); return { value: null, missing: false }; }
    return { value: override, missing: false };
  }
  const r = isObj(rule) ? rule : {};
  if (!nul(r.fixedMonthlyHalalas)) {
    if (!isHalalas(r.fixedMonthlyHalalas)) { errors.push({ field: "config." + field, error: "not_halalas" }); return { value: null, missing: false }; }
    return { value: r.fixedMonthlyHalalas, missing: false };
  }
  if (!nul(r.percentOfSalary)) {
    if (!isRate(r.percentOfSalary)) { errors.push({ field: "config." + field, error: "rate_out_of_range" }); return { value: null, missing: false }; }
    return { value: salary === null ? null : applyRate(salary, r.percentOfSalary), missing: false };
  }
  return { value: null, missing: true };
}

// computeCostSheet(input, config) →
//   { status:"ok", currency, contractMonths, lines:{…}, oneTime:{…}, costMonthlyHalalas, marginRate, marginHalalas,
//     saleMonthlyHalalas, rounding }
//   | { status:"pending_pricing", missing:[…] } | { status:"invalid_input", errors:[{field,error}] }
// input: { salaryHalalas, governmentMonthlyHalalas, recruitmentHalalas, visaHalalas, vendorFeeHalalas, contractMonths,
//          eosAccrualMonthlyHalalas?, leaveAccrualMonthlyHalalas?, marginRate? }
// config: { currency, marginRate, accrual:{eos,leave}, validFrom?, validUntil?, today? } (انظر costConfigFromPricing)
export function computeCostSheet(input, config) {
  if (!isObj(input)) return { status: "invalid_input", errors: [{ field: "input", error: "not_object" }] };
  const cfg = isObj(config) ? config : {};
  const errors = [];
  const missing = [];

  const v = {};
  for (const [key, label] of MONEY_INPUTS) {
    if (nul(input[key])) { missing.push(label); v[key] = null; }
    else if (!isHalalas(input[key])) { errors.push({ field: key, error: "not_halalas" }); v[key] = null; }
    else v[key] = input[key];
  }
  let months = null;
  if (nul(input.contractMonths)) missing.push("input.contract_months");
  else if (!Number.isInteger(input.contractMonths) || input.contractMonths < 1 || input.contractMonths > MAX_CONTRACT_MONTHS) errors.push({ field: "contractMonths", error: "out_of_range" });
  else months = input.contractMonths;

  let currency = null;
  if (typeof cfg.currency === "string" && cfg.currency.trim()) currency = cfg.currency.trim(); else missing.push("config.currency");

  let rate = null;
  const rawRate = !nul(input.marginRate) ? input.marginRate : cfg.marginRate;
  if (nul(rawRate)) missing.push("config.margin_rate");
  else if (!isRate(rawRate)) errors.push({ field: !nul(input.marginRate) ? "marginRate" : "config.margin_rate", error: "rate_out_of_range" });
  else rate = rawRate;

  const acc = isObj(cfg.accrual) ? cfg.accrual : {};
  const eosR = accrualOf(input.eosAccrualMonthlyHalalas, acc.eos, v.salaryHalalas, errors, "eosAccrualMonthlyHalalas");
  const leaveR = accrualOf(input.leaveAccrualMonthlyHalalas, acc.leave, v.salaryHalalas, errors, "leaveAccrualMonthlyHalalas");
  if (eosR.missing) missing.push("config.end_of_service_accrual");
  if (leaveR.missing) missing.push("config.leave_accrual");
  const eos = eosR.value, leave = leaveR.value;

  if (errors.length) return { status: "invalid_input", errors };

  if (typeof cfg.today === "string") {
    if ((typeof cfg.validFrom === "string" && cfg.validFrom > cfg.today) || (typeof cfg.validUntil === "string" && cfg.validUntil < cfg.today)) missing.push("config.valid_window");
  }
  if (missing.length) return { status: "pending_pricing", missing };

  const amort = (total) => mulDivHalfUp(total, 1, months);
  const recA = amort(v.recruitmentHalalas), visaA = amort(v.visaHalalas), vendA = amort(v.vendorFeeHalalas);
  const lines = {
    salaryHalalas: v.salaryHalalas,
    governmentHalalas: v.governmentMonthlyHalalas,
    eosAccrualHalalas: eos,
    leaveAccrualHalalas: leave,
    recruitmentAmortizedHalalas: recA,
    visaAmortizedHalalas: visaA,
    vendorFeeAmortizedHalalas: vendA,
  };
  const cost = Object.values(lines).reduce((s, x) => s + x, 0);
  const margin = applyRate(cost, rate);
  const oneTimeTotal = v.recruitmentHalalas + v.visaHalalas + v.vendorFeeHalalas;
  return {
    status: "ok",
    currency,
    contractMonths: months,
    lines,
    oneTime: {
      recruitmentHalalas: v.recruitmentHalalas, visaHalalas: v.visaHalalas, vendorFeeHalalas: v.vendorFeeHalalas,
      totalHalalas: oneTimeTotal,
      residualHalalas: oneTimeTotal - months * (recA + visaA + vendA),   // ما فقده/زاده التقريب على كامل المدة
    },
    costMonthlyHalalas: cost,
    marginRate: ppm(rate) / RATE_SCALE,
    marginHalalas: margin,
    saleMonthlyHalalas: cost + margin,
    rounding: ROUNDING_MODE,
  };
}

/* ═════════════ ما يراه العميل ═════════════ */
// clientView(sheet, config) → سعر البيع الشهري (قبل الضريبة) فقط، أو تفصيلاً بمجموعتين إن كان
// config.clientCostVisibility === "breakdown". لا يحمل أي مفتاح للهامش أو الراتب أو المورّد أو الاستقدام،
// ولا قائمة missing (أسماء الحقول الناقصة داخلية). ورقة غير مكتملة ⇒ { status:"pending_pricing" } وحدها.
//   employment = (الراتب + الحكومي + المخصّصات) بعد توزيع الهامش بالنسبة ذاتها؛ onboarding = الباقي (الاستقدام والتأشيرة
//   والمورّد مجتمعةً) — المجموعتان تجمعان سعر البيع بالتمام (الثانية هي الباقي).
export function clientView(sheet, config) {
  if (!isObj(sheet) || sheet.status !== "ok") return { status: "pending_pricing" };
  const cfg = isObj(config) ? config : {};
  const visibility = cfg.clientCostVisibility === "breakdown" ? "breakdown" : "total";
  const out = {
    status: "ok",
    currency: sheet.currency,
    contractMonths: sheet.contractMonths,
    monthlyPriceHalalas: sheet.saleMonthlyHalalas,
    vatExcluded: true,
    visibility,
  };
  if (visibility === "breakdown") {
    const L = sheet.lines;
    const employmentRaw = L.salaryHalalas + L.governmentHalalas + L.eosAccrualHalalas + L.leaveAccrualHalalas;
    const employment = sheet.costMonthlyHalalas > 0 ? mulDivHalfUp(sheet.saleMonthlyHalalas, employmentRaw, sheet.costMonthlyHalalas) : 0;
    out.breakdown = [
      { key: "employment", amountHalalas: employment },
      { key: "onboarding", amountHalalas: sheet.saleMonthlyHalalas - employment },
    ];
  }
  return out;
}

/* ═════════════ الفاتورة الشهرية ═════════════ */
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const near = (x) => Math.abs(x - Math.round(x)) < 1e-6;

// مجموع إدخالات الحضور ← مئويات اليوم (١٠٠ = يوم كامل). كل إدخال إما days (٠..١) أو hours (٠..٢٤).
// القرار في أي نوع يوم يُحتسب (إجازة/عطلة…) عند من يملأ الإدخالات: الدالة تجمع ما يصلها ولا تخترع سياسة.
// يُرجع { daysH, needHours }: needHours=true إن وُجدت ساعات ولا ساعات-يوم في الإعداد.
function entriesToDayHundredths(entries, period, hoursPerDay, errors, label) {
  let daysH = 0, hoursH = 0;
  const seen = new Set();
  for (const [i, e] of entries.entries()) {
    const at = `${label}.entries[${i}]`;
    if (!isObj(e)) { errors.push({ field: at, error: "not_object" }); continue; }
    if (typeof e.date !== "string" || !DATE_RE.test(e.date) || !e.date.startsWith(period + "-")) { errors.push({ field: at + ".date", error: "outside_period" }); continue; }
    if (seen.has(e.date)) { errors.push({ field: at + ".date", error: "duplicate_date" }); continue; }
    seen.add(e.date);
    const hasD = !nul(e.days), hasH = !nul(e.hours);
    if (hasD === hasH) { errors.push({ field: at, error: "days_xor_hours" }); continue; }
    if (hasD) {
      if (typeof e.days !== "number" || !(e.days >= 0 && e.days <= 1) || !near(e.days * 100)) { errors.push({ field: at + ".days", error: "out_of_range" }); continue; }
      daysH += Math.round(e.days * 100);
    } else {
      if (typeof e.hours !== "number" || !(e.hours >= 0 && e.hours <= 24) || !near(e.hours * 100)) { errors.push({ field: at + ".hours", error: "out_of_range" }); continue; }
      hoursH += Math.round(e.hours * 100);
    }
  }
  if (hoursH > 0) {
    if (nul(hoursPerDay)) return { daysH, needHours: true };
    const hpdH = Math.round(hoursPerDay * 100);
    if (typeof hoursPerDay !== "number" || hpdH <= 0 || hoursPerDay > 24) { errors.push({ field: "config.hoursPerDay", error: "out_of_range" }); return { daysH, needHours: false }; }
    daysH += mulDivHalfUp(hoursH, 100, hpdH);
  }
  return { daysH, needHours: false };
}

// monthlyInvoiceLines(placements, timesheets, config) →
//   { status:"ok", period, currency, lines, excluded, subtotalHalalas, vatRate, vatHalalas, totalHalalas, rounding }
//   | { status:"pending_pricing", missing } | { status:"invalid_input", errors }
// placements: [{ id, stage?, saleMonthlyHalalas|null, agreedDays? }]  — saleMonthlyHalalas من ورقة التكلفة الحالية
// timesheets: [{ placementId, period, status, entries?:[{date,days|hours}] | approvedDays? }]
// config: { period, currency, vatRate, agreedMonthDays?, hoursPerDay? }
// سطرٌ لا يُفوتَر (لا تايم شيت معتمد، يتجاوز الأيام المتفق عليها، سعر معلّق…) يذهب إلى excluded بسببه ولا يُخمَّن له مبلغ.
// الأسطر لا تحمل اسماً ولا تكلفة ولا هامشاً: placementId فقط (يربطه العرض بالاسم المكشوف حسب القناع).
export function monthlyInvoiceLines(placements, timesheets, config) {
  const cfg = isObj(config) ? config : {};
  const errors = [];
  const missing = [];
  if (!Array.isArray(placements)) return { status: "invalid_input", errors: [{ field: "placements", error: "not_array" }] };
  if (!Array.isArray(timesheets)) return { status: "invalid_input", errors: [{ field: "timesheets", error: "not_array" }] };
  if (typeof cfg.period !== "string" || !PERIOD_RE.test(cfg.period)) return { status: "invalid_input", errors: [{ field: "config.period", error: "invalid_period" }] };
  const period = cfg.period;

  let currency = null;
  if (typeof cfg.currency === "string" && cfg.currency.trim()) currency = cfg.currency.trim(); else missing.push("config.currency");
  let vatRate = null;
  if (nul(cfg.vatRate)) missing.push("config.vat_rate");
  else if (!isRate(cfg.vatRate)) errors.push({ field: "config.vatRate", error: "rate_out_of_range" });
  else vatRate = cfg.vatRate;
  if (!nul(cfg.agreedMonthDays) && !(Number.isInteger(cfg.agreedMonthDays) && cfg.agreedMonthDays >= 1 && cfg.agreedMonthDays <= 31)) errors.push({ field: "config.agreedMonthDays", error: "out_of_range" });

  const byPlacement = new Map();
  for (const [i, t] of timesheets.entries()) {
    if (!isObj(t) || nul(t.placementId)) { errors.push({ field: `timesheets[${i}]`, error: "invalid" }); continue; }
    if (t.period !== period) continue;                                        // شهر آخر: خارج هذه الفاتورة
    const id = String(t.placementId);
    if (byPlacement.has(id)) { errors.push({ field: `timesheets[${i}]`, error: "duplicate_timesheet" }); continue; }
    if (!TIMESHEET_STATUSES.includes(t.status)) { errors.push({ field: `timesheets[${i}].status`, error: "unknown_status" }); continue; }
    byPlacement.set(id, { t, i });
  }

  const lines = [], excluded = [], seenP = new Set();
  let needAgreed = false, needHours = false;
  for (const [pi, p] of placements.entries()) {
    if (!isObj(p) || nul(p.id)) { errors.push({ field: `placements[${pi}]`, error: "invalid" }); continue; }
    const id = String(p.id);
    if (seenP.has(id)) { errors.push({ field: `placements[${pi}]`, error: "duplicate_placement" }); continue; }
    seenP.add(id);
    if (!nul(p.stage) && !BILLABLE_STAGES.includes(p.stage)) { excluded.push({ placementId: id, reason: "not_billable_stage" }); continue; }
    if (nul(p.saleMonthlyHalalas)) { excluded.push({ placementId: id, reason: "sale_price_pending" }); continue; }
    if (!isHalalas(p.saleMonthlyHalalas)) { errors.push({ field: `placements[${pi}].saleMonthlyHalalas`, error: "not_halalas" }); continue; }
    const hit = byPlacement.get(id);
    if (!hit) { excluded.push({ placementId: id, reason: "no_timesheet" }); continue; }
    if (hit.t.status !== "approved") { excluded.push({ placementId: id, reason: "timesheet_not_approved", timesheetStatus: hit.t.status }); continue; }

    const agreed = !nul(p.agreedDays) ? p.agreedDays : cfg.agreedMonthDays;
    if (nul(agreed)) { needAgreed = true; continue; }
    if (!Number.isInteger(agreed) || agreed < 1 || agreed > 31) { errors.push({ field: `placements[${pi}].agreedDays`, error: "out_of_range" }); continue; }

    let approvedH;
    const label = `timesheets[${hit.i}]`;
    if (Array.isArray(hit.t.entries)) {
      const r = entriesToDayHundredths(hit.t.entries, period, cfg.hoursPerDay, errors, label);
      if (r.needHours) { needHours = true; continue; }
      approvedH = r.daysH;
    } else if (!nul(hit.t.approvedDays)) {
      if (typeof hit.t.approvedDays !== "number" || hit.t.approvedDays < 0 || !near(hit.t.approvedDays * 100)) { errors.push({ field: label + ".approvedDays", error: "out_of_range" }); continue; }
      approvedH = Math.round(hit.t.approvedDays * 100);
    } else { errors.push({ field: label, error: "no_days" }); continue; }

    if (approvedH > agreed * 100) { excluded.push({ placementId: id, reason: "days_exceed_agreed", approvedDaysHundredths: approvedH, agreedDays: agreed }); continue; }
    lines.push({
      placementId: id,
      saleMonthlyHalalas: p.saleMonthlyHalalas,
      approvedDaysHundredths: approvedH,
      agreedDays: agreed,
      amountHalalas: mulDivHalfUp(p.saleMonthlyHalalas, approvedH, agreed * 100),
    });
  }
  if (needAgreed) missing.push("config.agreed_month_days");
  if (needHours) missing.push("config.hours_per_day");

  if (errors.length) return { status: "invalid_input", errors };
  if (missing.length) return { status: "pending_pricing", missing };

  const subtotal = lines.reduce((s, l) => s + l.amountHalalas, 0);
  const vat = applyRate(subtotal, vatRate);
  return { status: "ok", period, currency, lines, excluded, subtotalHalalas: subtotal, vatRate: ppm(vatRate) / RATE_SCALE, vatHalalas: vat, totalHalalas: subtotal + vat, rounding: ROUNDING_MODE };
}

/* ═════════════════════════════════════════════════════════════════════════
   حاسبة سعر الحزمة الشهري للموظف (صيغ إكسل المالك «Salary vs Rate Hospitality»)
   ═════════════════════════════════════════════════════════════════════════
   المرجع: docs/hr-pricing-calculator-spec.md. الأرقام كلها من كتلة package_rate في api/_eor-pricing.json
   (لا ثابت مالي في هذا الكود؛ الصفر والواحد والاثنا عشر شهراً ثوابتُ حساب لا أسعار).

   الفرق عن computeCostSheet أعلاه: تلك تبني سعر موظفٍ مُسكَّن فعلياً بالهللة من مكوّناته المعلومة؛ وهذه تسعّر «حزمة
   راتب» P قبل التعاقد بصيغة المالك وبالريال، وتُقرِّب السعر لأقرب step (MROUND، النصف للأعلى) كما يفعل الإكسل.

   وضعان:
     lump      هامش 10% من السعر. التكلفة:
                 P + (إقامة+رخصة+أجير)/12 + تأمين/12 + (P/30×21)/12 + خروج وعودة/12 + (تأشيرة وانضمام)/12
                   + (P×0.5)/12 + P×2% + 900                 (+ تذكرة العودة/12 إن حدّدها المالك)
               السعر = MROUND(التكلفة ÷ (1 − 0.10), 10) ، ساعة الإضافي = P/(30×8) × 1.5 × 1.2.
     costplus  ⚠ pending_decision — التعريف غير محسوم. المبسّط: (1.02·P + 542) ÷ 0.8. للمالك داخلياً وبتنبيه صريح؛
               لا يصل عميلاً ما لم يضع المالك client_visible=true.

   الخصوصية: computePackageRate يُخرج بنيةً داخلية (internal: تكلفة، هامش، ربح، وتفصيل التأمين) لا تصل العميل أبداً؛
   packageClientView وحدها (قائمة بيضاء) تُخرج للعميل السعر الشهري وساعة الإضافي، ولمن اختار تأميناً: الفئة والفرق الشهري عن الأساسي فقط.
   التأمين (lump فقط): input.insurance = { insuranceClass, ageBand, gender, maternity, chronic } اختياري، انظر insurancePremium أعلاه.
   الحساب بأعداد عشرية عادية (الإكسل نفسه كذلك)؛ التقريب الوحيد المعتمد هو MROUND للسعر، وكل الباقي يُعرض مقرَّباً لهللتين
   في الواجهة الداخلية فقط. */

export const PACKAGE_MODES = Object.freeze(["lump", "costplus"]);
const MAX_PACKAGE = 1_000_000;
const pn = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// MROUND كما في إكسل: أقرب مضاعف للـstep، والنصف للأعلى. الإبسلون يمتصّ ضجيج الفاصلة العائمة (…4.9999999 لا يهبط).
export function mround(x, step) {
  if (!(step > 0)) throw new RangeError("mround: step must be positive");
  return Math.floor(x / step + 0.5 + 1e-9) * step;
}

/* ═════════════ كتالوج التأمين الطبي (يختاره العميل: فئة × عمر × جنس) ═════════════
   يستبدل بند التأمين (insurance_yearly/12) في صيغة lump حين يختار العميل فئة طبية. المصدر: package_rate.insurance_catalog في
   api/_eor-pricing.json — «تقدير سوق يُستبدل بعروض شركات التأمين» (أسعار أفراد قبل خصم المجموعات، لا عرض شركة).
   القسط الشهري = ((سنوي الفئة × معامل العمر × معامل الجنس × خصم المجموعات) [+ علاوة المزمن × ذلك] [+ أمومة ثابتة للأنثى المؤهّلة])
                   × (1 + ضريبة إن فُعِّلت) ÷ 12، مقرَّباً لأقرب هللة (نصف لأعلى) بحساب BigInt صحيح.
   «الأساسي» = lump.insurance_yearly كما هو (صيغة الإكسل) بلا أي معامل. فشل مغلق: أي قيمة مجهولة أو إعداد ناقص ⇒ الأساسي لا خطأ
   ولا سعراً صفرياً. القيم الخام (القسط السنوي، المعاملات، الخصم، الضريبة) داخلية: لا تصل العميل إلا السعر الشهري والفرق عن الأساسي. */
export const INSURANCE_CLASSES = Object.freeze(["basic", "C", "B", "A", "quote"]);
export const INSURANCE_AGE_BANDS = Object.freeze(["0-17", "18-29", "30-39", "40-49", "50-59", "60+"]);
export const INSURANCE_GENDERS = Object.freeze(["unspecified", "male", "female"]);
const MEDICAL_CLASSES = Object.freeze(["C", "B", "A"]);

// شركة التأمين المفضّلة: معرّف بحروف صغيرة وشرطة سفلية فقط؛ المجهول/الفاسد ⇒ "any" (أي شركة معتمدة، نختار الأنسب).
// القائمة البيضاء الفعلية هي insurance_catalog.insurers في الإعداد (تُفحص في insurancePremium وفي طبقة الـAPI)؛ هنا حارس شكلٍ فقط.
export const DEFAULT_INSURER = "any";
const INSURER_ID_RE = /^[a-z][a-z0-9_]{1,30}$/;
export function normalizeInsurerId(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return INSURER_ID_RE.test(s) ? s : DEFAULT_INSURER;
}

// يحوّل اختيار العميل (من أي مصدر غير موثوق) إلى قيم مسموحة فقط. المجهول يعود للافتراضي الآمن؛ والمنطقي صارم (true وحدها).
export function normalizeInsuranceFields(raw) {
  const r = isObj(raw) ? raw : {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const cls = INSURANCE_CLASSES.find((c) => c.toLowerCase() === str(r.insuranceClass).toLowerCase()) || "basic";
  const gender = INSURANCE_GENDERS.find((g) => g === str(r.gender).toLowerCase()) || "unspecified";
  return {
    insuranceClass: cls,
    ageBand: INSURANCE_AGE_BANDS.find((a) => a === str(r.ageBand)) || "",
    gender,
    maternity: r.maternity === true,
    chronic: r.chronic === true,
    insurer: normalizeInsurerId(r.insurer),
  };
}

function insuranceConfigFrom(cat) {
  if (!isObj(cat)) return null;
  const pos = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const unit = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1 ? v : null);
  const ages = isObj(cat.age_bands) ? cat.age_bands : {};
  const gf = isObj(cat.gender_factor) ? cat.gender_factor : {};
  const cls = isObj(cat.classes) ? cat.classes : {};
  const mat = isObj(cat.maternity) ? cat.maternity : {};
  const classes = {};
  for (const k of MEDICAL_CLASSES) { const x = isObj(cls[k]) ? cls[k] : {}; classes[k] = { baseYearly: pos(x.base_yearly_18_29), maternityYearly: pn(x.maternity_yearly) }; }
  // شركات التأمين: معرّف + اسمان + معامل سعر (price_factor، افتراضي 1.0 للجميع). معامل فاسد ⇒ null ⇒ الحساب يعود للأساسي إن اختير صاحبه.
  const insurers = {};
  if (Array.isArray(cat.insurers)) {
    for (const x of cat.insurers) {
      if (!isObj(x) || typeof x.id !== "string" || !INSURER_ID_RE.test(x.id) || insurers[x.id]) continue;
      const f = x.price_factor === undefined ? 1 : (typeof x.price_factor === "number" && Number.isFinite(x.price_factor) && x.price_factor > 0 && x.price_factor <= 100 ? x.price_factor : null);
      insurers[x.id] = { nameAr: typeof x.name_ar === "string" ? x.name_ar : "", nameEn: typeof x.name_en === "string" ? x.name_en : "", priceFactor: f };
    }
  }
  const classDescriptions = {};
  for (const k of ["basic", ...MEDICAL_CLASSES, "quote"]) {
    const x = isObj(cls[k]) ? cls[k] : {};
    if (typeof x.description_ar === "string" || typeof x.description_en === "string") classDescriptions[k] = { ar: typeof x.description_ar === "string" ? x.description_ar : "", en: typeof x.description_en === "string" ? x.description_en : "" };
  }
  return {
    insurers, classDescriptions,
    clientSelectable: cat.client_selectable === true,
    addonsVisible: cat.client_addons_visible === true,
    groupDiscountFactor: unit(cat.group_discount_factor),
    vatIncluded: typeof cat.vat_on_insurance_included === "boolean" ? cat.vat_on_insurance_included : null,
    vatRate: pn(cat.vat_rate),
    ageFactor: Object.fromEntries(INSURANCE_AGE_BANDS.map((k) => [k, pos(ages[k])])),
    genderFactor: Object.fromEntries(INSURANCE_GENDERS.map((k) => [k, pos(gf[k])])),
    classes,
    maternityBands: Array.isArray(mat.eligible_age_bands) ? mat.eligible_age_bands.filter((x) => INSURANCE_AGE_BANDS.includes(x)) : [],
    chronicLoading: pn(cat.chronic_loading),
    quoteAvailable: isObj(cls.quote) && cls.quote.quote_only === true,
  };
}

// قسمة BigInt بتقريب النصف لأعلى (للأعداد غير السالبة).
const divHalfUpBig = (num, den) => (2n * num + den) / (2n * den);
const ppmBig = (x) => BigInt(Math.round(x * RATE_SCALE));

// insurancePremium(choice, icfg) → { status, class, … }
//   status: "basic" (الأساسي: لا شيء يتغيّر) | "quote_only" (فئة عليا بلا رقم) | "needs_age" (فئة طبية بلا فئة عمرية) | "applied"
//   applied يحمل: monthlyHalalas, monthly (ريال)، maternity/chronic (المُطبَّق فعلاً)، detail (داخلي: القسط السنوي والمعاملات…).
export function insurancePremium(choice, icfg) {
  const ch = normalizeInsuranceFields(choice);
  const BASIC = { status: "basic", class: "basic", insurer: DEFAULT_INSURER, maternity: false, chronic: false };
  if (!isObj(icfg) || icfg.clientSelectable !== true || ch.insuranceClass === "basic") return BASIC;
  if (ch.insuranceClass === "quote") return icfg.quoteAvailable ? { status: "quote_only", class: "quote", maternity: false, chronic: false } : BASIC;
  const k = icfg.classes && icfg.classes[ch.insuranceClass];
  if (!k || !(k.baseYearly > 0)) return BASIC;
  if (!ch.ageBand) return { status: "needs_age", class: ch.insuranceClass, maternity: false, chronic: false };
  const age = icfg.ageFactor && icfg.ageFactor[ch.ageBand], gen = icfg.genderFactor && icfg.genderFactor[ch.gender], grp = icfg.groupDiscountFactor;
  if (!(age > 0) || !(gen > 0) || !(grp > 0)) return BASIC;
  if (typeof icfg.vatIncluded !== "boolean" || (icfg.vatIncluded && icfg.vatRate === null)) return BASIC;
  const wantMat = icfg.addonsVisible === true && ch.maternity && ch.gender === "female" && Array.isArray(icfg.maternityBands) && icfg.maternityBands.includes(ch.ageBand);
  const wantChr = icfg.addonsVisible === true && ch.chronic;
  if (wantMat && icfg.classes[ch.insuranceClass].maternityYearly === null) return BASIC;
  if (wantChr && icfg.chronicLoading === null) return BASIC;
  // معامل شركة التأمين: المجهول أو "any" بلا مدخل ⇒ 1؛ مدخل بمعامل فاسد ⇒ الأساسي (فشل مغلق، لا سعر مشوَّه).
  const entry = isObj(icfg.insurers) ? icfg.insurers[ch.insurer] : undefined;
  const insurer = entry ? ch.insurer : DEFAULT_INSURER;
  if (entry && entry.priceFactor === null) return BASIC;
  const insFactor = entry ? entry.priceFactor : 1;

  const S = BigInt(RATE_SCALE);
  const adj = BigInt(sarToHalalas(k.baseYearly)) * ppmBig(age) * ppmBig(gen) * ppmBig(grp);          // هللات × S³
  let total = adj * S;                                                                                // × S⁴
  if (wantChr) total += adj * ppmBig(icfg.chronicLoading);
  if (wantMat) total += BigInt(sarToHalalas(k.maternityYearly)) * S ** 4n;
  total *= S + (icfg.vatIncluded ? ppmBig(icfg.vatRate) : 0n);                                        // × S⁵
  total *= ppmBig(insFactor);                                                                         // × S⁶ (معامل الشركة)
  const monthlyH = Number(divHalfUpBig(total, 12n * S ** 6n));
  return {
    status: "applied", class: ch.insuranceClass, insurer, maternity: wantMat, chronic: wantChr,
    monthlyHalalas: monthlyH, monthly: monthlyH / 100,
    detail: {
      baseYearly: k.baseYearly, ageBand: ch.ageBand, ageFactor: age, gender: ch.gender, genderFactor: gen, groupDiscountFactor: grp,
      maternityYearly: wantMat ? icfg.classes[ch.insuranceClass].maternityYearly : 0, chronicLoading: wantChr ? icfg.chronicLoading : 0,
      vatIncluded: icfg.vatIncluded, vatRate: icfg.vatIncluded ? icfg.vatRate : 0, insurerPriceFactor: insFactor, yearly: Number(divHalfUpBig(total, S ** 6n)) / 100,
    },
  };
}

// يحوّل كتلة package_rate من api/_eor-pricing.json إلى إعداد مُطبَّع. القيمة الناقصة/غير الصالحة = null ⇒ تظهر في missing.
// labor (اختياري): بيانات أنظمة العمل المطبَّعة من api/_eor-labor.js (الافتراضي: الملف المرجعي)؛ منها حصة التأمينات الاجتماعية للسعودي
// واستحقاق نهاية الخدمة وأيام الإجازة حين يطلبها إعداد package_rate.saudi بقيمة "labor". الاختبار يمرّر نسخة معدَّلة.
export function packageRateConfigFromPricing(pricing, labor) {
  const root = isObj(pricing) && isObj(pricing.package_rate) ? pricing.package_rate : null;
  if (!root) return null;
  const ot = (o) => { const x = isObj(o) ? o : {}; return { monthDays: pn(x.month_days), hoursPerDay: pn(x.hours_per_day), multiplier: pn(x.multiplier), extraFactor: pn(x.extra_factor) }; };
  const L = isObj(root.lump) ? root.lump : {};
  const fees = isObj(L.annual_government_fees) ? L.annual_government_fees : {};
  const leave = isObj(L.annual_leave) ? L.annual_leave : {};
  const join = isObj(L.joining) ? L.joining : {};
  const C = isObj(root.costplus) ? root.costplus : {};
  return {
    currency: typeof root.currency === "string" && root.currency.trim() ? root.currency.trim() : null,
    clientPriceVisible: root.client_price_visible === true,
    // تفصيل السعر للعميل (قرار المالك): صارم — true وحدها تفتحه، والغائب/الفاسد مغلق.
    clientBreakdownVisible: root.client_breakdown_visible === true,
    limits: salaryLimitsFrom(root.salary_limits),
    extras: extrasConfigFrom(root.extras),
    appliesTo: Array.isArray(root.applies_to_worker_types) ? root.applies_to_worker_types.filter((x) => typeof x === "string") : [],
    validFrom: isObj(pricing) && typeof pricing.valid_from === "string" ? pricing.valid_from : null,
    validUntil: isObj(pricing) && typeof pricing.valid_until === "string" ? pricing.valid_until : null,
    lump: {
      marginOnPrice: pn(L.margin_on_price),
      step: pn(L.mround_step),
      residenceYearly: pn(fees.residence), workPermitYearly: pn(fees.work_permit), ajeerYearly: pn(fees.ajeer),
      insuranceYearly: pn(L.insurance_yearly),
      exitReentryYearly: pn(L.exit_reentry_yearly),
      socialInsuranceRate: pn(L.social_insurance_rate),
      endOfServiceMonthsPerYear: pn(L.end_of_service_months_per_year),
      overheadMonthly: pn(L.overhead_monthly),
      leaveIncluded: typeof leave.included_in_cost === "boolean" ? leave.included_in_cost : null,
      leaveDays: pn(leave.days), leaveMonthDays: pn(leave.month_days),
      joiningIncluded: typeof join.included_in_cost === "boolean" ? join.included_in_cost : null,
      joiningYearly: pn(join.visa_and_joining_yearly),
      returnTicketYearly: pn(L.return_ticket_yearly),
      overtime: ot(L.overtime),
    },
    insurance: insuranceConfigFrom(root.insurance_catalog),
    casual: casualConfigFrom(root.casual),
    saudi: saudiConfigFrom(root.saudi, {
      marginOnPrice: pn(L.margin_on_price), step: pn(L.mround_step), insuranceYearly: pn(L.insurance_yearly), overheadMonthly: pn(L.overhead_monthly),
      endOfServiceMonthsPerYear: pn(L.end_of_service_months_per_year), leaveIncluded: typeof leave.included_in_cost === "boolean" ? leave.included_in_cost : null,
      leaveDays: pn(leave.days), leaveMonthDays: pn(leave.month_days), overtime: ot(L.overtime),
    }, labor === undefined ? saudiLabor() : labor),
    costplus: {
      clientVisible: C.client_visible === true,
      marginOnPrice: pn(C.margin_on_price),
      step: pn(C.mround_step),
      pExtraRate: pn(C.p_extra_rate),
      fixedMonthly: pn(C.fixed_monthly),
      overtime: ot(C.overtime),
    },
  };
}

/* ═════════════ تسعير العامل السعودي (package_rate.saudi) ═════════════
   مسار تكلفة مستقل عن صيغة الأجنبي: بلا رخصة عمل ولا إقامة ولا أجير ولا تأشيرة ولا خروج وعودة ولا تذكرة. بنوده:
     الراتب + حصة صاحب العمل في التأمينات الاجتماعية + التأمين الطبي (الأساسي أو الفئة المختارة) + الإجازة السنوية
            + نهاية الخدمة (م84) + المصاريف العامة ،  ثم السعر = MROUND( التكلفة ÷ (1 − الهامش) ، الخطوة ) كصيغة الأجنبي.
   كل مفتاح في الإعداد: رقمٌ صريح | "lump" (قيمة العامل الأجنبي نفسها) | "labor" (من api/_saudi-labor-data.json عبر api/_eor-labor.js) |
   null (بعد المراجعة بلا رقم). التأمينات الاجتماعية: نسبة صاحب العمل تُقرأ من الملف بحسب نظام المشترك (جديد بجدول زيادة سنوية
   | قديم بنسبة ثابتة) وتاريخ سريانها، على الأجر الخاضع (الراتب حتى الحد الأعلى للأجر الخاضع). المشترك القديم نسبته verify:true في
   الملف ⇒ تُسعَّر إن فتح المالك price_legacy_cohort (وتُعلَّم قراراً مفتوحاً داخلياً) وإلا «بعد المراجعة».
   ⚠ مراجعة قانونية: الاستنتاج التسعيري لنهاية الخدمة (استحقاق نصف شهر عن كل سنة، م84) وأساس الأجر الخاضع (الراتب كله) تقديران. */
const otCfg = (o) => { const x = isObj(o) ? o : {}; return { monthDays: pn(x.month_days), hoursPerDay: pn(x.hours_per_day), multiplier: pn(x.multiplier), extraFactor: pn(x.extra_factor) }; };
function saudiConfigFrom(s, L, labor) {
  if (!isObj(s)) return null;
  const lab = isObj(labor) ? labor : {};
  const gosi = isObj(lab.gosi) ? lab.gosi : null;
  const val = (v, lumpV, laborV) => (v === "lump" ? lumpV : v === "labor" ? (laborV === undefined ? null : laborV) : pn(v));
  const al = isObj(s.annual_leave) ? s.annual_leave : {};
  const si = isObj(s.social_insurance) ? s.social_insurance : {};
  const eosFromLabor = s.end_of_service_months_per_year === "labor";
  const leaveFromLabor = al.days === "labor";
  const open = [];
  if (eosFromLabor && lab.eosb && lab.eosb.verify) open.push("eosb_unverified");
  if (leaveFromLabor && lab.leave && lab.leave.verify) open.push("leave_unverified");
  return {
    enabled: s.enabled === true,
    marginOnPrice: val(s.margin_on_price, L.marginOnPrice),
    step: val(s.mround_step, L.step),
    insuranceYearly: val(s.insurance_yearly, L.insuranceYearly),
    overheadMonthly: val(s.overhead_monthly, L.overheadMonthly),
    endOfServiceMonthsPerYear: val(s.end_of_service_months_per_year, L.endOfServiceMonthsPerYear, lab.eosb ? lab.eosb.monthsPerYearFirst5 : null),
    leaveIncluded: al.included_in_cost === "lump" ? L.leaveIncluded : typeof al.included_in_cost === "boolean" ? al.included_in_cost : null,
    leaveDays: val(al.days, L.leaveDays, lab.leave ? lab.leave.days : null),
    leaveMonthDays: val(al.month_days, L.leaveMonthDays),
    overtime: s.overtime === "lump" ? L.overtime : otCfg(s.overtime),
    // التأمينات: المصدر "labor" وحده معتمد (لا نسبة تُكتب في الإعداد)؛ غيره ⇒ gosi = null ⇒ بعد المراجعة.
    gosi: si.employer_rate === "labor" && gosi && gosi.newSystem && gosi.legacy
      ? { labor: gosi, wageCap: si.wage_cap === "labor" ? (typeof gosi.wageCap === "number" ? gosi.wageCap : null) : (pn(si.wage_cap) > 0 ? si.wage_cap : null) }
      : null,
    priceLegacy: si.price_legacy_cohort === true,
    rateBasis: si.rate_basis === "peak_in_term" ? "peak_in_term" : "start",
    openDecisions: open,
  };
}

const ISO_D = /^\d{4}-\d{2}-\d{2}$/;
const validIso = (s) => typeof s === "string" && ISO_D.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
function addMonthsIso(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/* ═════════════ حدّ الراتب الأدنى + السكن والإعاشة والمواصلات + تفصيل السعر للعميل (قرار المالك 2026-10-08) ═════════════
   كل رقم من package_rate.salary_limits / package_rate.extras (لا ثابت هنا). الفشل مغلق: قيمة فاسدة ⇒ null ⇒ لا حدّ / لا بند.
   المبالغ الشهرية بالهللة. تفصيل السعر (packageBreakdown) قائمة بيضاء: بنود العميل المعلنة وسطر «رسوم الخدمة» = الإجمالي − ما قبله؛
   بلا معاملات ولا تكلفة خام ولا تسمية «ربح/هامش/تكلفة». */
function salaryLimitsFrom(x) {
  const l = isObj(x) ? x : {};
  const lim = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_PACKAGE ? v : null);
  return { saudiMin: lim(l.saudi_min_salary), foreignMin: lim(l.foreign_min_salary) };
}
function extrasConfigFrom(x) {
  const e = isObj(x) ? x : {};
  const amt = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100000 ? sarToHalalas(v) : null);
  const meals = isObj(e.meals) ? e.meals : {};
  return {
    housingHalalas: amt(e.housing_monthly), mealsHalalas: amt(e.meals_monthly), transportHalalas: amt(e.transport_monthly),
    mealsMaxSalary: typeof meals.max_salary === "number" && Number.isFinite(meals.max_salary) && meals.max_salary >= 0 ? meals.max_salary : null,
  };
}

// الحدّ الأدنى للراتب لنوع عامل البند. mixed ⇒ الأعلى (حقل راتب واحد للبند يجب أن يحقّق الحدّين)؛ غير ذلك (foreign/unknown) ⇒ حدّ الأجنبي
// (الأدنى؛ لا نعرف أنه سعودي). → رقم أو null (لا حدّ مُهيَّأ).
export function salaryMinFor(workerType, limits) {
  const l = isObj(limits) ? limits : {};
  const s = typeof l.saudiMin === "number" ? l.saudiMin : null, f = typeof l.foreignMin === "number" ? l.foreignMin : null;
  if (workerType === "saudi") return s;
  if (workerType === "mixed") return s === null && f === null ? null : Math.max(s === null ? 0 : s, f === null ? 0 : f);
  return f;
}

export const PROVISION_KEYS = Object.freeze(["housing", "meals", "transport"]);
export const PROVISION_CHOICES = Object.freeze(["client", "us"]);
// اختيار العميل لكل بند: "us" وحدها تعني «علينا»؛ المجهول/الغائب/غير النص ⇒ "client" (على العميل، بلا إضافة).
export function normalizeProvisions(raw) {
  const r = isObj(raw) ? raw : {};
  const out = {};
  for (const k of PROVISION_KEYS) out[k] = typeof r[k] === "string" && r[k].trim().toLowerCase() === "us" ? "us" : "client";
  return out;
}

// خطة السكن/الإعاشة/المواصلات لبندٍ براتب salary: { status:"ok", items:[{key, halalas}], totalHalalas, mealsSkipped } | { status:"unavailable" }
// unavailable = اختار العميل «علينا» لبندٍ لا قيمة صالحة له في الإعداد ⇒ لا رقم (المستدعي يعيد pending_pricing). لا اختيار ⇒ ok بلا بنود.
export function provisionPlan(choice, salary, cfg) {
  const ch = normalizeProvisions(choice);
  const ex = isObj(cfg) && isObj(cfg.extras) ? cfg.extras : {};
  const amountOf = { housing: ex.housingHalalas, meals: ex.mealsHalalas, transport: ex.transportHalalas };
  const items = [];
  let mealsSkipped = false;
  for (const k of PROVISION_KEYS) {
    if (ch[k] !== "us") continue;
    const h = amountOf[k];
    if (!Number.isSafeInteger(h) || h < 0) return { status: "unavailable" };
    if (k === "meals" && typeof ex.mealsMaxSalary === "number" && typeof salary === "number" && salary > ex.mealsMaxSalary) { mealsSkipped = true; continue; }
    items.push({ key: k, halalas: h });
  }
  return { status: "ok", items, totalHalalas: items.reduce((s, x) => s + x.halalas, 0), mealsSkipped };
}

// ما تعرضه الواجهة قبل الاختيار («علينا +500 ريال/شهر»): القيم الشهرية بالريال أو null. مغلق إن أُغلق سعر العميل.
export function provisionDisplayAmounts(cfg) {
  const ex = isObj(cfg) && isObj(cfg.extras) ? cfg.extras : {};
  if (!isObj(cfg) || cfg.clientPriceVisible !== true) return { housing: null, meals: null, transport: null };
  const v = (h) => (Number.isSafeInteger(h) ? h / 100 : null);
  return { housing: v(ex.housingHalalas), meals: v(ex.mealsHalalas), transport: v(ex.transportHalalas) };
}

// توزيع القيمة الشهرية على وحدة العمالة المرنة: يوم = ÷ أيام الشهر المرجعي، ساعة = ÷ (أيام الشهر × ساعات اليوم المرجعية). نصف لأعلى لأقرب هللة.
export function casualProvisionHalalas(monthlyHalalas, unit, casualCfg) {
  const k = isObj(casualCfg) ? casualCfg : {};
  if (unit === "monthly") return monthlyHalalas;
  const days = k.refMonthDays, hrs = k.refHoursPerDay;
  if (!Number.isInteger(days) || days < 1) return null;
  if (unit === "daily") return mulDivHalfUp(monthlyHalalas, 1, days);
  if (!Number.isInteger(hrs) || hrs < 1) return null;
  return mulDivHalfUp(monthlyHalalas, 1, days * hrs);
}

/* ═════════════ تفصيل السعر الشهري للعميل (قرار المالك 2026-10-08: «لازم يكون واضح للعميل») ═════════════
   كل سطر مكوّنٌ من مكوّنات صيغة الإكسل نفسها (لا أرقام مشتقة من الأنظمة لهذا المسار حتى يطابق المجموع السعر بالهللة):
     الراتب · government (رخصة العمل والإقامة وأجير) · insurance (التأمين الطبي) · annual_leave (الإجازة السنوية) · exit_reentry (تأشيرة الخروج والعودة)
     · joining (التأشيرة ورسوم الانضمام) · end_of_service (استحقاق شهري) · social_insurance (التأمينات الاجتماعية) · return_ticket (إن فُعِّلت)
     · housing/meals/transport (حين «علينا») · service (= السعر الشهري − مجموع ما سبق؛ يحمل المصاريف العامة والهامش دون تسميتهما).
   السعودي: الراتب · insurance · annual_leave · end_of_service · social_insurance (حصة صاحب العمل) · service. بلا رسوم حكومية ولا تأشيرات.
   العميل يرى الاسم والمبلغ فقط: لا نسبة ولا معامل ولا قسط سنوي ولا مرجع نظامي (المراجع أدناه للمراجعين داخلياً).

   مراجع نظامية داخلية (لا تصل العميل أبداً؛ مصدرها api/_saudi-labor-data.json وdocs/saudi-labor-sources.md — تحتاج مراجعة قانونية):
     government       → المقابل المالي 800 ريال/شهر (9,600 سنوياً) + رسم رخصة العمل 100 (قرار مجلس الوزراء 197 وتاريخ 1438/3/23هـ؛ دليل HRSD 2021)،
                        ورسم الإقامة (لا مبلغ رسمي في الملف، والرقم المرشّح verify) ورسم منصة أجير.
                        ⚠ مفتاحا الإكسل residence وwork_permit في كتلة annual_government_fees مسمّيان بالعكس قياساً بالقيم (الأكبر منهما = 9600 مقابل مالي + 100
                        رسم رخصة العمل، والأصغر = الإقامة) ولهذا يُعرض مجموع الثلاثة سطراً واحداً «رخصة العمل والإقامة وأجير» لا مفصّلاً بتسمية قد تكون خاطئة.
     annual_leave     → م109 الإجازة السنوية 21 يوماً (30 بعد 5 سنوات)، وم111 بدل الإجازة غير المستعملة.
     exit_reentry     → أنظمة الجوازات: خروج وعودة مفردة 200 (≤ شهرين) +100/شهر، متعددة 500 (3 أشهر) +200/شهر (م/71 وتاريخ 1444/6/1هـ).
     joining          → رسوم الاستقدام/التأشيرة (م40(1) نظام العمل: على صاحب العمل). قيمتها السنوية في الإعداد (والجدول الجانبي في الإكسل يخالفها) — قرار المالك.
     end_of_service   → م84 نصف شهر عن كل سنة من أول 5 سنوات (وشهر بعدها) على الأجر الأخير؛ عقد EOR محدد المدة ينتهي بانتهائه فتُستحق كاملة (م74(2)).
     social_insurance → الأجنبي: فرع الأخطار المهنية 2% على صاحب العمل (م4(1))؛ السعودي: حصة صاحب العمل من المعاشات وساند والأخطار.
     return_ticket    → م40(1) تذكرة عودة غير السعودي إلى موطنه بعد انتهاء العلاقة (تعاقدية في الإكسل، مفتاحها return_ticket_yearly). */
const BREAKDOWN_ORDER = Object.freeze([
  ["government", "government"], ["insurance", "insurance"], ["annualLeave", "annual_leave"], ["exitReentry", "exit_reentry"],
  ["joining", "joining"], ["endOfService", "end_of_service"], ["socialInsurance", "social_insurance"], ["returnTicket", "return_ticket"],
]);

// تفصيل السعر الشهري للموظف الواحد للعميل (قائمة بيضاء حقلاً حقلاً). result: ناتج computePackageRate (lump، ok). plan: provisionPlan (ok).
// مجموع الأسطر = السعر الشهري الذي يراه العميل بالتمام (الهللة). سطر مكوّنه صفر (كإجازة خارج السعر أو تذكرة عودة غير مفعّلة) لا يظهر.
// مغلق (clientBreakdownVisible≠true) ⇒ null. وإن خرج «رسوم الخدمة» سالباً (إعداد شاذ) ⇒ null لا تصفير صامت يكسر المجموع.
export function packageBreakdown(result, plan, cfg) {
  if (!isObj(cfg) || cfg.clientBreakdownVisible !== true || cfg.clientPriceVisible !== true) return null;
  if (!isObj(result) || result.status !== "ok" || result.mode !== "lump" || !isObj(result.internal) || !isObj(result.internal.lines)) return null;
  if (!isObj(plan) || plan.status !== "ok" || !Number.isFinite(result.billable)) return null;
  const L = result.internal.lines;
  const ins = isObj(result.insurance) ? result.insurance : null;
  const applied = !!ins && ins.status === "applied";
  const salaryH = sarToHalalas(result.package);
  let sumH = salaryH;
  const lines = [{ key: "salary", amount: salaryH / 100 }];
  for (const [src, key] of BREAKDOWN_ORDER) {
    if (typeof L[src] !== "number" || !Number.isFinite(L[src])) continue;
    const h = sarToHalalas(L[src]);
    if (!(h > 0)) continue;
    sumH += h;
    lines.push(key === "insurance"
      ? { key, amount: h / 100, class: applied && INSURANCE_CLASSES.includes(ins.class) ? ins.class : "basic", insurer: applied ? normalizeInsurerId(ins.insurer) : DEFAULT_INSURER }
      : { key, amount: h / 100 });
  }
  for (const x of plan.items) lines.push({ key: x.key, amount: x.halalas / 100 });
  // رسوم الخدمة = السعر الشهري − ما قبله؛ «علينا» مضافة فوق السعر فلا تدخل في طرحه.
  const serviceH = sarToHalalas(result.billable) - sumH;
  if (serviceH < 0) return null;
  lines.push({ key: "service", amount: serviceH / 100 });
  return { lines };
}

// لقطة تكلفة داخلية لتنسيبٍ يُثبَّت سعره (الفوترة): سعر الوحدة = السعر الشهري + «علينا»، وتكلفة الوحدة = تكلفة الصيغة + «علينا» تمريراً بالتكلفة
// (بلا هامش على البنود المضافة) فيبقى الهامش = هامش الصيغة. ⚠ داخلي: لا يصل العميل أبداً (يُحفظ في «مدخلات التسعير» لدى الفريق).
export function packageCostSnapshot(result, plan) {
  if (!isObj(result) || result.status !== "ok" || result.mode !== "lump" || !isObj(result.internal) || !isObj(result.internal.lines)) return null;
  if (!isObj(plan) || plan.status !== "ok" || !Number.isFinite(result.billable)) return null;
  const lines = {};
  for (const [k, v] of Object.entries(result.internal.lines)) if (typeof v === "number" && Number.isFinite(v)) lines[k] = sarToHalalas(v);
  const provisions = {};
  for (const x of plan.items) provisions[x.key] = x.halalas;
  const costH = sarToHalalas(result.internal.cost) + plan.totalHalalas;
  const priceH = sarToHalalas(result.billable) + plan.totalHalalas;
  return { lines, provisions, costHalalas: costH, priceHalalas: priceH, marginHalalas: priceH - costH };
}

const OT_FIELDS = ["monthDays", "hoursPerDay", "multiplier", "extraFactor"];
const otHourOf = (P, o) => (P / (o.monthDays * o.hoursPerDay)) * o.multiplier * o.extraFactor;
const marginOk = (m) => typeof m === "number" && m >= 0 && m < 1;      // 1 − m يقسم السعر؛ m=1 قسمة على صفر

// ذيل مشترك لمساري lump (الأجنبي والسعودي): اختيار التأمين الطبي ثم السعر والبنية الداخلية. build(insuranceMonthly) → { lines, cost, rate, billable }.
function finishLump({ mode, workerType, P, currency, o, build, basicInsurance, inp, cfg, separate, extraInternal, warnings }) {
  const ins = inp.insurance === undefined || inp.insurance === null ? null : insurancePremium(inp.insurance, cfg.insurance);
  const sel = build(ins && ins.status === "applied" ? ins.monthly : basicInsurance);
  const { lines, cost, rate, billable } = sel;
  const out = {
    status: "ok", mode, workerType, package: P, currency,
    billable, otHour: r2(otHourOf(P, o)),
    pendingDecision: false,
    warnings: Array.isArray(warnings) ? warnings : [],
    internal: {
      cost: r2(cost), rate: r2(rate), markup: r2(billable - P), profit: r2(billable - cost), margin: (billable - cost) / billable,
      lines: Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, r2(v)])), separate: separate || {},
      ...(extraInternal || {}),
    },
  };
  if (ins) {
    // ما يخرج للعميل منه: الفئة والحالة والفرق الشهري عن الأساسي (فرق سعرين مقرَّبين) وما طُبِّق من الإضافات — لا أرقام الأقساط.
    const delta = ins.status === "applied" ? billable - build(basicInsurance).billable : 0;
    out.insurance = { class: ins.class, status: ins.status, insurer: ins.status === "applied" ? ins.insurer : DEFAULT_INSURER, deltaMonthly: r2(delta), maternity: ins.maternity === true, chronic: ins.chronic === true };
    out.internal.insurance = ins.status === "applied"
      ? { ...ins.detail, class: ins.class, monthly: ins.monthly, basicMonthly: r2(basicInsurance), basicBillable: build(basicInsurance).billable }
      : { class: ins.class, status: ins.status };
  }
  return out;
}

// مسار العامل السعودي (انظر saudiConfigFrom أعلاه). المدخلات الإضافية: firstSubscription (تاريخ أول اشتراك ISO، اختياري: الافتراضي مشترك جديد)،
// startDate (تاريخ البدء ISO: تاريخ سريان نسبة التأمينات؛ الافتراضي اليوم)، termMonths (مدة العقد إن كان rate_basis = peak_in_term).
function computeSaudiLump(P, inp, cfg, currency) {
  const s = isObj(cfg.saudi) ? cfg.saudi : null;
  if (!s || s.enabled !== true) return { status: "pending_pricing", missing: ["package_rate.saudi.enabled"] };
  const missing = [];
  if (!currency) missing.push("package_rate.currency");
  const need = (key, label) => { if (!(typeof s[key] === "number" && Number.isFinite(s[key]))) missing.push("saudi." + label); };
  need("marginOnPrice", "margin_on_price"); need("step", "mround_step"); need("insuranceYearly", "insurance_yearly");
  need("overheadMonthly", "overhead_monthly"); need("endOfServiceMonthsPerYear", "end_of_service_months_per_year");
  if (typeof s.leaveIncluded !== "boolean") missing.push("saudi.annual_leave.included_in_cost");
  if (s.leaveIncluded !== false) { need("leaveDays", "annual_leave.days"); need("leaveMonthDays", "annual_leave.month_days"); }
  const o = isObj(s.overtime) ? s.overtime : {};
  for (const k of OT_FIELDS) if (!(typeof o[k] === "number" && Number.isFinite(o[k]))) missing.push("saudi.overtime." + k);
  const g = isObj(s.gosi) ? s.gosi : null;
  if (!g || !(typeof g.wageCap === "number" && g.wageCap > 0)) missing.push("saudi.social_insurance");
  const refDate = validIso(inp.startDate) ? inp.startDate : (validIso(inp.config && inp.config.today) ? inp.config.today : (validIso(cfg.today) ? cfg.today : null));
  if (!refDate) missing.push("saudi.social_insurance.reference_date");
  const regime = g ? gosiRegimeFor(g.labor, validIso(inp.firstSubscription) ? inp.firstSubscription : "") : "new";
  if (g && regime === "legacy" && s.priceLegacy !== true) missing.push("saudi.social_insurance.price_legacy_cohort");
  let pct = null;
  if (g && refDate) {
    const terms = Number.isInteger(inp.termMonths) && inp.termMonths > 0 && inp.termMonths <= MAX_CONTRACT_MONTHS ? inp.termMonths : 0;
    const peakUntil = s.rateBasis === "peak_in_term" && terms ? addMonthsIso(refDate, terms) : undefined;
    pct = gosiEmployerPct(g.labor, regime, refDate, peakUntil);
    if (!pct) missing.push("saudi.social_insurance.employer_rate");
  }
  if (missing.length) return { status: "pending_pricing", missing };
  if (!marginOk(s.marginOnPrice)) return { status: "invalid_input", errors: [{ field: "config.saudi.margin_on_price", error: "rate_out_of_range" }] };
  if (!(s.step > 0) || !(o.monthDays > 0) || !(o.hoursPerDay > 0) || (s.leaveIncluded !== false && !(s.leaveMonthDays > 0))) return { status: "invalid_input", errors: [{ field: "config.saudi", error: "must_be_positive" }] };

  const leaveMonthly = s.leaveIncluded === false ? 0 : ((P / s.leaveMonthDays) * s.leaveDays) / 12;
  const basicInsurance = s.insuranceYearly / 12;
  const base = Math.min(P, g.wageCap);                     // الأجر الخاضع: الراتب حتى الحد الأعلى
  const build = (insuranceMonthly) => {
    const lines = {
      package: P,
      insurance: insuranceMonthly,
      annualLeave: leaveMonthly,
      endOfService: (P * s.endOfServiceMonthsPerYear) / 12,
      socialInsurance: base * (pct.pct / 100),
      overhead: s.overheadMonthly,
    };
    const cost = Object.values(lines).reduce((x, y) => x + y, 0);
    const rate = cost / (1 - s.marginOnPrice);
    return { lines, cost, rate, billable: mround(rate, s.step) };
  };
  const separate = {};
  if (s.leaveIncluded === false) separate.annualLeaveMonthlyEquivalent = r2(((P / s.leaveMonthDays) * s.leaveDays) / 12);
  // قرارات مفتوحة داخلية: نسبة التأمينات غير المؤكدة في الملف (verify) والمشترك القديم وأي استحقاق مأخوذ من بند غير مؤكد.
  const open = [...s.openDecisions];
  if (pct.verify) open.push(`gosi_${regime}_rate_unverified`);
  return finishLump({
    mode: "lump", workerType: "saudi", P, currency, o, build, basicInsurance, inp, cfg, separate,
    warnings: open.map((x) => "open_decision:" + x),
    extraInternal: { gosi: { regime, employerPct: pct.pct, wageCap: g.wageCap, referenceDate: refDate, basis: s.rateBasis }, openDecisions: open },
  });
}

// computePackageRate({ mode, package, config }) →
//   { status:"ok", mode, package, currency, billable, otHour, pendingDecision, warnings:[…],
//     internal:{ cost, rate, markup, profit, margin, lines:{…}, separate:{…} } }
//   | { status:"pending_pricing", missing:[…] } | { status:"invalid_input", errors:[{field,error}] }
// config: الناتج من packageRateConfigFromPricing. ⚠ internal داخلي: لا يُمرَّر إلى العميل — packageClientView وحدها.
export function computePackageRate(input) {
  const inp = isObj(input) ? input : {};
  const errors = [];
  const mode = inp.mode;
  if (!PACKAGE_MODES.includes(mode)) errors.push({ field: "mode", error: "unknown_mode" });
  const P = inp.package;
  if (typeof P !== "number" || !Number.isFinite(P) || P <= 0 || P > MAX_PACKAGE) errors.push({ field: "package", error: "out_of_range" });
  if (errors.length) return { status: "invalid_input", errors };

  const cfg = isObj(inp.config) ? inp.config : null;
  if (!cfg) return { status: "pending_pricing", missing: ["config.package_rate"] };
  if (typeof cfg.validFrom === "string" || typeof cfg.validUntil === "string") {
    const today = typeof cfg.today === "string" ? cfg.today : null;
    if (today && ((typeof cfg.validFrom === "string" && cfg.validFrom > today) || (typeof cfg.validUntil === "string" && cfg.validUntil < today))) return { status: "pending_pricing", missing: ["config.valid_window"] };
  }
  const missing = [];
  const need = (obj, key, label) => { if (!(typeof obj[key] === "number" && Number.isFinite(obj[key]))) missing.push(label); };
  const currency = typeof cfg.currency === "string" && cfg.currency.trim() ? cfg.currency.trim() : (missing.push("package_rate.currency"), null);

  if (mode === "lump" && inp.workerType === "saudi") return computeSaudiLump(P, inp, cfg, currency);

  if (mode === "lump") {
    const c = isObj(cfg.lump) ? cfg.lump : {};
    for (const [k, label] of [["marginOnPrice", "margin_on_price"], ["step", "mround_step"], ["residenceYearly", "annual_government_fees.residence"], ["workPermitYearly", "annual_government_fees.work_permit"],
      ["ajeerYearly", "annual_government_fees.ajeer"], ["insuranceYearly", "insurance_yearly"], ["exitReentryYearly", "exit_reentry_yearly"], ["socialInsuranceRate", "social_insurance_rate"],
      ["endOfServiceMonthsPerYear", "end_of_service_months_per_year"], ["overheadMonthly", "overhead_monthly"], ["returnTicketYearly", "return_ticket_yearly"]]) need(c, k, "lump." + label);
    if (typeof c.leaveIncluded !== "boolean") missing.push("lump.annual_leave.included_in_cost");
    if (typeof c.joiningIncluded !== "boolean") missing.push("lump.joining.included_in_cost");
    if (c.leaveIncluded !== false) { need(c, "leaveDays", "lump.annual_leave.days"); need(c, "leaveMonthDays", "lump.annual_leave.month_days"); }
    if (c.joiningIncluded !== false) need(c, "joiningYearly", "lump.joining.visa_and_joining_yearly");
    const o = isObj(c.overtime) ? c.overtime : {};
    for (const k of OT_FIELDS) need(o, k, "lump.overtime." + k);
    if (missing.length) return { status: "pending_pricing", missing };
    if (!marginOk(c.marginOnPrice)) return { status: "invalid_input", errors: [{ field: "config.lump.margin_on_price", error: "rate_out_of_range" }] };
    if (!(c.step > 0) || !(o.monthDays > 0) || !(o.hoursPerDay > 0) || (c.leaveIncluded !== false && !(c.leaveMonthDays > 0))) return { status: "invalid_input", errors: [{ field: "config.lump", error: "must_be_positive" }] };

    const leaveMonthly = c.leaveIncluded === false ? 0 : ((P / c.leaveMonthDays) * c.leaveDays) / 12;
    const joiningMonthly = c.joiningIncluded === false ? 0 : c.joiningYearly / 12;
    // التأمين: الأساسي = insurance_yearly/12 كما في الإكسل؛ فئة طبية مختارة (insurancePremium) تستبدله بقسطها الشهري.
    const basicInsurance = c.insuranceYearly / 12;
    const build = (insuranceMonthly) => {
      const lines = {
        package: P,
        government: (c.residenceYearly + c.workPermitYearly + c.ajeerYearly) / 12,
        insurance: insuranceMonthly,
        annualLeave: leaveMonthly,
        exitReentry: c.exitReentryYearly / 12,
        joining: joiningMonthly,
        returnTicket: c.returnTicketYearly / 12,
        endOfService: (P * c.endOfServiceMonthsPerYear) / 12,
        socialInsurance: P * c.socialInsuranceRate,
        overhead: c.overheadMonthly,
      };
      const cost = Object.values(lines).reduce((s, x) => s + x, 0);
      const rate = cost / (1 - c.marginOnPrice);
      return { lines, cost, rate, billable: mround(rate, c.step) };
    };
    const separate = {};
    if (c.leaveIncluded === false) separate.annualLeaveMonthlyEquivalent = r2(((P / c.leaveMonthDays) * c.leaveDays) / 12);
    if (c.joiningIncluded === false) separate.joiningMonthlyEquivalent = r2(c.joiningYearly / 12);
    return finishLump({ mode, workerType: "foreign", P, currency, o, build, basicInsurance, inp, cfg, separate });
  }

  // costplus — pending_decision
  const c = isObj(cfg.costplus) ? cfg.costplus : {};
  for (const [k, label] of [["marginOnPrice", "margin_on_price"], ["step", "mround_step"], ["pExtraRate", "p_extra_rate"], ["fixedMonthly", "fixed_monthly"]]) need(c, k, "costplus." + label);
  const o = isObj(c.overtime) ? c.overtime : {};
  for (const k of OT_FIELDS) need(o, k, "costplus.overtime." + k);
  if (missing.length) return { status: "pending_pricing", missing };
  if (!marginOk(c.marginOnPrice)) return { status: "invalid_input", errors: [{ field: "config.costplus.margin_on_price", error: "rate_out_of_range" }] };
  if (!(c.step > 0) || !(o.monthDays > 0) || !(o.hoursPerDay > 0)) return { status: "invalid_input", errors: [{ field: "config.costplus", error: "must_be_positive" }] };
  const cost = P * (1 + c.pExtraRate) + c.fixedMonthly;
  const rate = cost / (1 - c.marginOnPrice);
  const billable = mround(rate, c.step);
  const res = {
    status: "ok", mode, package: P, currency,
    billable, otHour: r2(otHourOf(P, o)),
    pendingDecision: true,
    warnings: ["costplus_definition_pending_owner_decision", "simplified_costplus_cost_definition"],
    internal: {
      cost: r2(cost), rate: r2(rate), markup: r2(billable - P), profit: r2(billable - cost), margin: (billable - cost) / billable,
      lines: { package: P, extra: r2(P * c.pExtraRate), fixed: r2(c.fixedMonthly) }, separate: {},
    },
  };
  return res;
}

// ما يراه العميل: السعر الشهري وساعة الإضافي فقط — قائمة بيضاء تُبنى حقلاً حقلاً (لا نسخ كائن ولا حذف حقول).
// costplus لا يظهر إلا إن وضع المالك costplus.client_visible=true؛ وclient_price_visible=false يُخفي كل شيء.
// أي حالة غير ok ⇒ { status:"pending_pricing" } وحدها (بلا missing ولا أسماء حقول داخلية).
export function packageClientView(result, config) {
  const PENDING = { status: "pending_pricing" };
  if (!isObj(result) || result.status !== "ok") return PENDING;
  const cfg = isObj(config) ? config : {};
  if (cfg.clientPriceVisible !== true) return PENDING;
  if (result.mode === "costplus" && !(isObj(cfg.costplus) && cfg.costplus.clientVisible === true)) return PENDING;
  if (result.mode !== "lump" && result.mode !== "costplus") return PENDING;
  const view = { status: "ok", currency: result.currency, monthlyPrice: result.billable, otHour: result.otHour };
  // اختيار التأمين (إن طُلب): الفئة والحالة والفرق الشهري عن الأساسي وما طُبِّق من إضافات — حقلاً حقلاً، لا أقساط ولا معاملات.
  if (result.mode === "lump" && isObj(result.insurance)) {
    const i = result.insurance;
    view.insurance = {
      class: INSURANCE_CLASSES.includes(i.class) ? i.class : "basic",
      status: ["basic", "quote_only", "needs_age", "applied"].includes(i.status) ? i.status : "basic",
      insurer: typeof i.insurer === "string" ? normalizeInsurerId(i.insurer) : DEFAULT_INSURER,   // اختيار العميل نفسه (معرّف فقط، لا معامل سعر)
      deltaMonthly: Number.isFinite(i.deltaMonthly) ? i.deltaMonthly : 0,
      maternity: i.maternity === true,
      chronic: i.chronic === true,
    };
  }
  return view;
}

// ما تعرضه الواجهة من كتالوج التأمين: أعلام + قائمة الشركات (معرّف واسمان) + وصف مستوى كل فئة. لا أرقام ولا معاملات ولا أقساط أبداً.
// الأوصاف نصوص شبكة وتغطية عامة بلا أرقام ولا وعود، وتحتاج مراجعة قانونية قبل النشر (انظر _review في الملف).
export function insuranceUiFromConfig(cfg) {
  const ic = isObj(cfg) && isObj(cfg.insurance) ? cfg.insurance : null;
  const selectable = !!(ic && ic.clientSelectable);
  const out = { selectable, addons: !!(ic && ic.clientSelectable && ic.addonsVisible), defaultInsurer: DEFAULT_INSURER, insurers: [], classes: [] };
  if (!selectable) return out;
  const clip = (x) => String(x || "").slice(0, 120);
  out.insurers = Object.entries(ic.insurers || {}).map(([id, x]) => ({ id, nameAr: clip(x.nameAr), nameEn: clip(x.nameEn) }));
  out.classes = ["basic", ...MEDICAL_CLASSES, "quote"].filter((k) => (ic.classDescriptions || {})[k]).map((k) => ({ id: k, descAr: clip(ic.classDescriptions[k].ar), descEn: clip(ic.classDescriptions[k].en) }));
  return out;
}

// السعر الشهري كهللات صحيحة لتغذية monthlyInvoiceLines (placements[].saleMonthlyHalalas) بالسعر المقرَّب نفسه.
export function packageSaleMonthlyHalalas(result) {
  return isObj(result) && result.status === "ok" && Number.isFinite(result.billable) ? sarToHalalas(result.billable) : null;
}

/* ═════════════ العمالة المرنة (Casual): بالساعة / باليوم / بالشهر (تصحيح المالك 2026-10-08) ═════════════
   خدمة مستقلة عن EOR: عاملٌ يأتي لمهمة ثم يمضي، يُسعَّر بالساعة أو اليوم أو الشهر. EOR (عقد بكفالة، دفع شهري، نهاية خدمة) تبقى بصيغة
   الإكسل أعلاه كما هي بلا أي تغيير. لا تأمين ولا رسوم حكومية في المرنة. كل رقم من package_rate.casual (قرارات المالك فيه معلَّمة):
     أجر الساعة المرجعي  = الراتب المرجعي ÷ 30 ÷ 8                                     (reference_month_days / reference_hours_per_day)
     أجر الساعة للعامل   = المرجعي × hourly_worker_multiplier                           (افتراضي 5: ساعة قيمتها 6 يأخذ العامل 30)
     أجر اليوم للعامل    = أجر الساعة للعامل (مقرَّباً لهللة) × ساعات اليوم            (4–12، افتراضي 8)
     أجر الشهر للعامل    = الراتب المرجعي × monthly_worker_multiplier                   (افتراضي 1.0)
     سعر البيع للعميل    = ما يأخذه العامل × sale_multiplier                            (افتراضي 2.0 «الدبل» = ربح 50% من السعر)
   حسابٌ صحيح بالهللة (BigInt)، التقريب لأقرب هللة نصفاً لأعلى ويُعرض بخانتين (قرار مفتوح). min_hourly_halalas حدّ أدنى اختياري لسعر بيع الساعة
   (اليوم لا ينزل عن حدّ الساعة × ساعات اليوم). الفشل مغلق: إعداد ناقص أو فاسد ⇒ pending_pricing بلا رقم.
   الخصوصية: أجر العامل والمعاملات والربح في internal وحده (computeCasualRate/casualRateForRole للمالك)؛ casualUnitView تُخرج للعميل
   الوحدة وسعرها فقط. */
export const BILLING_UNITS = Object.freeze(["monthly", "daily", "hourly"]);
export const UNIT_QUANTITY_MAX = Object.freeze({ monthly: 36, daily: 3650, hourly: 10000 });
export const ENGAGEMENT_TYPES = Object.freeze(["contract", "casual"]);
export const CASUAL_HOURS = Object.freeze({ min: 4, max: 12, default: 8 });      // اختيار العميل لساعات اليوم (واجهة وتحقّق)
const MAX_CASUAL_MULT = 100;

// قوائم بيضاء؛ المجهول يعود إلى الأكثر أماناً (شهري / تعاقد EOR).
export function normalizeBillingUnit(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return BILLING_UNITS.find((u) => u === s) || "monthly";
}
export function normalizeEngagementType(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return ENGAGEMENT_TYPES.find((u) => u === s) || "contract";
}

// الكمية لكل موظف (ساعات/أيام/أشهر): غائبة ⇒ { ok:true, value:null }؛ عدد صحيح موجب بسقف الوحدة ⇒ ok؛ غير ذلك ⇒ { ok:false }.
export function parseUnitQuantity(unit, raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  const max = UNIT_QUANTITY_MAX[normalizeBillingUnit(unit)];
  return Number.isInteger(n) && n >= 1 && n <= max ? { ok: true, value: n } : { ok: false };
}

// ساعات اليوم التي يختارها العميل: غائبة ⇒ null (يُستعمل افتراضي الإعداد)؛ عدد صحيح ضمن CASUAL_HOURS وإلا { ok:false }.
export function parseCasualHours(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = typeof raw === "string" && /^\d{1,2}$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  return Number.isInteger(n) && n >= CASUAL_HOURS.min && n <= CASUAL_HOURS.max ? { ok: true, value: n } : { ok: false };
}

function casualConfigFrom(c) {
  if (!isObj(c)) return null;
  const bad = [];
  const int = (v, lo, hi, label) => { if (Number.isInteger(v) && v >= lo && v <= hi) return v; bad.push(label); return null; };
  const mult = (v, label) => { if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_CASUAL_MULT) return v; bad.push(label); return null; };
  const hpd = isObj(c.hours_per_day) ? c.hours_per_day : {};
  const out = {
    clientVisible: c.client_visible === true,
    appliesTo: Array.isArray(c.applies_to_worker_types) ? c.applies_to_worker_types.filter((x) => typeof x === "string") : [],
    refMonthDays: int(c.reference_month_days, 1, 31, "casual.reference_month_days"),
    refHoursPerDay: int(c.reference_hours_per_day, 1, 24, "casual.reference_hours_per_day"),
    hourlyWorkerMult: mult(c.hourly_worker_multiplier, "casual.hourly_worker_multiplier"),
    monthlyWorkerMult: mult(c.monthly_worker_multiplier, "casual.monthly_worker_multiplier"),
    saleMult: mult(c.sale_multiplier, "casual.sale_multiplier"),
    hoursMin: int(hpd.min, 1, 24, "casual.hours_per_day.min"),
    hoursMax: int(hpd.max, 1, 24, "casual.hours_per_day.max"),
    hoursDefault: int(hpd.default, 1, 24, "casual.hours_per_day.default"),
    minHourlyHalalas: null,
    bad,
  };
  if (c.min_hourly_halalas !== undefined && c.min_hourly_halalas !== null) { if (isHalalas(c.min_hourly_halalas)) out.minHourlyHalalas = c.min_hourly_halalas; else bad.push("casual.min_hourly_halalas"); }
  if (out.hoursMin !== null && out.hoursMax !== null && out.hoursDefault !== null && !(out.hoursMin <= out.hoursDefault && out.hoursDefault <= out.hoursMax)) bad.push("casual.hours_per_day");
  return out;
}

// computeCasualRate({ package, hoursPerDay?, config }) — نقيّة. package: الراتب المرجعي الشهري (ريال). config: ناتج packageRateConfigFromPricing.
//   → { status:"ok", currency, hoursPerDay, units:{ hourlyHalalas, dailyHalalas, monthlyHalalas } (سعر البيع للعميل),
//       internal:{ referenceHourlyHalalas, workerHourlyHalalas, workerDailyHalalas, workerMonthlyHalalas, profit…, minApplied, … } }
//   | { status:"pending_pricing", missing } | { status:"invalid_input", errors }
// ⚠ internal داخلي: لا يُمرَّر إلى العميل — casualUnitView وحدها.
export function computeCasualRate(input) {
  const inp = isObj(input) ? input : {};
  const P = inp.package;
  if (typeof P !== "number" || !Number.isFinite(P) || P <= 0 || P > MAX_PACKAGE) return { status: "invalid_input", errors: [{ field: "package", error: "out_of_range" }] };
  const hp = parseCasualHours(inp.hoursPerDay);
  if (!hp.ok) return { status: "invalid_input", errors: [{ field: "hoursPerDay", error: "out_of_range" }] };
  const cfg = isObj(inp.config) ? inp.config : null;
  if (!cfg) return { status: "pending_pricing", missing: ["config.package_rate"] };
  if (typeof cfg.validFrom === "string" || typeof cfg.validUntil === "string") {
    const today = typeof cfg.today === "string" ? cfg.today : null;
    if (today && ((typeof cfg.validFrom === "string" && cfg.validFrom > today) || (typeof cfg.validUntil === "string" && cfg.validUntil < today))) return { status: "pending_pricing", missing: ["config.valid_window"] };
  }
  const k = isObj(cfg.casual) ? cfg.casual : null;
  if (!k) return { status: "pending_pricing", missing: ["package_rate.casual"] };
  const missing = [...k.bad];
  const currency = typeof cfg.currency === "string" && cfg.currency.trim() ? cfg.currency.trim() : (missing.push("package_rate.currency"), null);
  if (missing.length) return { status: "pending_pricing", missing };
  const h = hp.value === null ? k.hoursDefault : hp.value;
  if (h < k.hoursMin || h > k.hoursMax) return { status: "pending_pricing", missing: ["casual.hours_per_day"] };

  const Ph = sarToHalalas(P);
  const refPer = k.refMonthDays * k.refHoursPerDay;
  const refHourlyExact = mulDivHalfUp(Ph, 1, refPer);                                         // أجر الساعة المرجعي بالهللة (للعرض الداخلي)
  const workerHourly = mulDivHalfUp(Ph, ppm(k.hourlyWorkerMult), refPer * RATE_SCALE);
  const workerDaily = workerHourly * h;
  const workerMonthly = mulDivHalfUp(Ph, ppm(k.monthlyWorkerMult), RATE_SCALE);
  const sale = (x) => mulDivHalfUp(x, ppm(k.saleMult), RATE_SCALE);
  let saleHourly = sale(workerHourly), saleDaily = sale(workerDaily);
  const saleMonthly = sale(workerMonthly);
  let minApplied = false;
  if (k.minHourlyHalalas !== null && saleHourly < k.minHourlyHalalas) { saleHourly = k.minHourlyHalalas; saleDaily = Math.max(saleDaily, saleHourly * h); minApplied = true; }
  return {
    status: "ok", currency, hoursPerDay: h,
    units: { hourlyHalalas: saleHourly, dailyHalalas: saleDaily, monthlyHalalas: saleMonthly },
    internal: {
      referenceHourlyHalalas: refHourlyExact, workerHourlyHalalas: workerHourly, workerDailyHalalas: workerDaily, workerMonthlyHalalas: workerMonthly,
      profitHourlyHalalas: saleHourly - workerHourly, profitDailyHalalas: saleDaily - workerDaily, profitMonthlyHalalas: saleMonthly - workerMonthly,
      profitShareMonthly: saleMonthly > 0 ? (saleMonthly - workerMonthly) / saleMonthly : 0, minApplied,
    },
  };
}

// ما يراه العميل لوحدةٍ واحدة: { status:"ok", unit, unitPrice, hoursPerDay? } (ريال بخانتين) أو { status:"pending_pricing" } وحدها.
// البوابات: package_rate.client_price_visible وcasual.client_visible. ساعات اليوم يراها العميل (مدخلٌ منه) في الوحدة اليومية فقط.
export function casualUnitView(result, config, unit) {
  const PENDING = { status: "pending_pricing" };
  const cfg = isObj(config) ? config : {};
  if (!isObj(result) || result.status !== "ok" || !isObj(result.units)) return PENDING;
  if (cfg.clientPriceVisible !== true || !(isObj(cfg.casual) && cfg.casual.clientVisible === true)) return PENDING;
  const un = normalizeBillingUnit(unit);
  const h = un === "daily" ? result.units.dailyHalalas : un === "hourly" ? result.units.hourlyHalalas : result.units.monthlyHalalas;
  if (!Number.isSafeInteger(h) || h < 0) return PENDING;
  return { status: "ok", unit: un, unitPrice: h / 100, ...(un === "daily" ? { hoursPerDay: result.hoursPerDay } : {}) };
}

// حساب العمالة المرنة بدور: ops/system (المالك والفريق) يأخذان النتيجة كاملة بما فيها internal؛ أي دور آخر أو غائب يأخذ casualUnitView وحدها (الشهري)
// وتفشل مغلقةً إلى pending_pricing. طبقات العميل تستعمل casualUnitView بالوحدة المختارة مباشرةً.
export function casualRateForRole(input, role) {
  const res = computeCasualRate(input);
  if (role === "ops" || role === "system") return res;
  return casualUnitView(res, isObj(input) ? input.config : null, "monthly");
}

// نقطة الدخول الوحيدة المعتمدة لمن يطلب حساباً بدور: ops/system (المالك والفريق) يأخذان النتيجة الكاملة بما فيها internal
// ووضعا lump وcostplus معاً؛ أي دور آخر (client/vendor/candidate) أو دور غائب/مجهول يأخذ packageClientView وحدها — يفشل مُغلقاً.
// وضع costplus لا يصل غير ops/system مهما كان إعداد client_visible إلا بفتحه عمداً من المالك (انظر packageClientView).
// computePackageRate نفسها نقيّة وداخلية: طبقات الـAPI التي تخدم العميل لا تستدعيها إلا عبر estimatePackageQuote أو هذه الدالة.
export function packageRateForRole(input, role) {
  const res = computePackageRate(input);
  if (role === "ops" || role === "system") return res;
  const cfg = isObj(input) && isObj(input.config) ? input.config : {};
  return packageClientView(res, cfg);
}
