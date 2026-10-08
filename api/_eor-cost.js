// Business Partner — حاسبة تكلفة وتسعير الموظف على بند التعاقد (EOR) وفاتورته الشهرية.
//
// يملكه وكيل `eor`. وحدة صِرفة (ESM): لا شبكة ولا قاعدة ولا ملفات ولا ساعة. ملف مساعد يبدأ بـ`_` فلا يُحتسب
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
