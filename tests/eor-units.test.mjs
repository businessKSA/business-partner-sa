// «العمالة المرنة» (Casual): سعر الساعة واليوم والشهر للعميل (تصحيح المالك 2026-10-08) — api/_eor-cost.js (computeCasualRate/casualUnitView)
// وestimatePackageQuote/handleEor في api/_eor.js وواجهة /eor. خدمة مستقلة عن EOR التي تبقى بصيغة الإكسل بلا تغيير.
// الصيغ هنا مكتوبة مرة ثانية بحساب BigInt مستقل عن الكود كي لا يُقارَن الحساب بنفسه. أمثلة المالك مفاهيمية حتى يؤكّد المعاملات.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-casual-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const C = await import("../api/_eor-cost.js");
const E = await import("../api/_eor.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
const CFG = C.packageRateConfigFromPricing(PRICING);
const NOW = Date.parse("2026-10-09T09:00:00Z");
const clone = (o) => JSON.parse(JSON.stringify(o));
const withCasual = (patch) => { const p = clone(PRICING); Object.assign(p.package_rate.casual, patch); return p; };
const cfgOf = (p) => C.packageRateConfigFromPricing(p);
const casual = (P, cfg = CFG, hoursPerDay) => C.computeCasualRate({ package: P, hoursPerDay, config: cfg });
const IT = (count, nationalities, salary, extra = {}) => ({ occupationId: "hosp.waiter", count, nationalities, salary, ...extra });
const CIT = (count, salary, extra = {}) => IT(count, ["IN"], salary, { billingUnit: "hourly", quantity: null, hoursPerDay: null, ...extra });
const body = (items, extra = {}) => ({ company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض", workerType: "foreign", recruitment: "no", items, startDate: "2026-11-01", durationMonths: 12, lang: "ar", ...extra });

// مرجع مستقل: round-half-up(a×b÷c) بأعداد صحيحة، والصيغة حرفياً من كلام المالك.
const mdh = (a, b, c) => Number((2n * BigInt(a) * BigInt(b) + BigInt(c)) / (2n * BigInt(c)));
const halalas = (sar) => Math.round(Number((sar * 100).toPrecision(12)));
const ppm = (x) => Math.round(x * 1e6);
function ref(P, { hwm = 5, mwm = 1, sale = 2, h = 8 } = {}) {
  const Ph = halalas(P);
  const wH = mdh(Ph, ppm(hwm), 240 * 1e6), wD = wH * h, wM = mdh(Ph, ppm(mwm), 1e6);
  const s = (x) => mdh(x, ppm(sale), 1e6);
  return { wH, wD, wM, sH: s(wH), sD: s(wD), sM: s(wM) };
}
const SALARIES = [800, 1000, 1440, 1500, 2000, 2750, 3000, 3333.33, 5000, 7777.77, 12345.67, 100000];

/* ═════════════ الصيغة ومراجع المالك ═════════════ */
test("أمثلة المالك: راتب مرجعي 1500/2000/3000 ⇒ أجر ساعة مرجعي 6.25/8.33/12.5، وساعة قيمتها 6 يأخذ العامل عنها 30 (×5) ويُباع بـ60", () => {
  const refs = [1500, 2000, 3000].map((P) => casual(P).internal.referenceHourlyHalalas);
  assert.deepEqual(refs, [625, 833, 1250]);
  const six = casual(1440);                              // 1440 ÷ 30 ÷ 8 = 6.00 بالضبط
  assert.equal(six.internal.referenceHourlyHalalas, 600);
  assert.equal(six.internal.workerHourlyHalalas, 3000);  // 30.00
  assert.equal(six.units.hourlyHalalas, 6000);           // الدبل: 60.00
  assert.equal(six.internal.profitShareMonthly, 0.5);
  // الشهري: الراتب × معامل العامل الشهري × البيع. مثال المالك 1500 يُعطى 1800 فيُباع بـ3600 (معامل شهري 1.2)
  const m = casual(1500, cfgOf(withCasual({ monthly_worker_multiplier: 1.2 })));
  assert.equal(m.internal.workerMonthlyHalalas, 180000);
  assert.equal(m.units.monthlyHalalas, 360000);
  // الافتراضي 1.0: 1500 ⇒ يُباع 3000 (600 مقابل 300 و200 مقابل 100 بنسبة الدبل)
  assert.equal(casual(1500).units.monthlyHalalas, 300000);
});

test("الافتراضيات: ساعة العامل ×5، البيع ×2، الشهري ×1.0، اليوم = ساعة العامل المقرَّبة × ساعات اليوم ثم البيع — لكل رواتب العيّنة وساعات 4..12", () => {
  for (const P of SALARIES) {
    for (const h of [undefined, 4, 8, 10, 12]) {
      const r = casual(P, CFG, h), x = ref(P, { h: h || 8 });
      assert.equal(r.status, "ok", `${P}/${h}`);
      assert.equal(r.hoursPerDay, h || 8);
      assert.deepEqual([r.units.hourlyHalalas, r.units.dailyHalalas, r.units.monthlyHalalas], [x.sH, x.sD, x.sM], `${P}/${h}`);
      assert.deepEqual([r.internal.workerHourlyHalalas, r.internal.workerDailyHalalas, r.internal.workerMonthlyHalalas], [x.wH, x.wD, x.wM]);
      assert.equal(r.currency, "SAR");
    }
  }
  assert.deepEqual(casual(1500).units, { hourlyHalalas: 6250, dailyHalalas: 50000, monthlyHalalas: 300000 });
});

test("المعاملات إعدادٌ لا كود: ×10 و×20 ومعامل بيع ومعامل شهري مختلفة تغيّر السعر بالصيغة المستقلة", () => {
  for (const [hwm, sale, mwm] of [[10, 2, 1], [20, 2, 1], [5, 2.5, 1], [5, 2, 1.2], [7.5, 1.8, 0.9]]) {
    const cfg = cfgOf(withCasual({ hourly_worker_multiplier: hwm, sale_multiplier: sale, monthly_worker_multiplier: mwm }));
    for (const P of [1500, 2750, 5000.55]) {
      const r = casual(P, cfg, 9), x = ref(P, { hwm, sale, mwm, h: 9 });
      assert.deepEqual([r.units.hourlyHalalas, r.units.dailyHalalas, r.units.monthlyHalalas], [x.sH, x.sD, x.sM], `${hwm}/${sale}/${mwm}/${P}`);
    }
  }
  // لا أرقام المالك حرفياً داخل منطق الحاسبة المرنة (القيم في ملف الإعداد)
  const src = fs.readFileSync(path.join(ROOT, "api/_eor-cost.js"), "utf8");
  const calc = src.slice(src.indexOf("export function computeCasualRate"), src.indexOf("export function casualRateForRole")).replace(/\/\/.*$/gm, "");
  for (const lit of ["240", "30", "8", "5", "2"]) assert.equal(new RegExp(`(?<![\\d.\\w])${lit}(?![\\d.\\w])`).test(calc.replace(/\[[^\]]*\]/g, "")), false, "ثابت " + lit);
});

test("min_hourly_halalas: حدّ أدنى لسعر بيع الساعة (يرفع الساعة واليوم إن كان أعلى، وإلا لا أثر)", () => {
  const hi = cfgOf(withCasual({ min_hourly_halalas: 9000 }));
  const r = casual(1500, hi, 10);
  assert.deepEqual([r.units.hourlyHalalas, r.units.dailyHalalas, r.internal.minApplied], [9000, 90000, true]);
  const lo = cfgOf(withCasual({ min_hourly_halalas: 100 }));
  assert.deepEqual([casual(1500, lo).units.hourlyHalalas, casual(1500, lo).internal.minApplied], [6250, false]);
  assert.equal(PRICING.package_rate.casual.min_hourly_halalas, null);
  assert.equal(casual(1500, cfgOf(withCasual({ min_hourly_halalas: 0 }))).units.hourlyHalalas, 6250);
});

test("ملف الإعداد: معاملات المالك معلَّمة _owner_decision، وحدود الساعات تطابق الواجهة (4–12 افتراضي 8)، وEOR (lump) لم يتغيّر", () => {
  const K = PRICING.package_rate.casual;
  assert.deepEqual([K.reference_month_days, K.reference_hours_per_day, K.hourly_worker_multiplier, K.monthly_worker_multiplier, K.sale_multiplier], [30, 8, 5, 1.0, 2.0]);
  assert.match(K._hourly_worker_multiplier, /اعتمده المالك ×5/);
  assert.match(K._sale_multiplier, /اعتمده المالك ×2/);
  for (const k of ["_owner_decision", "_sale_multiplier", "_monthly_worker_multiplier", "_rounding", "_applies_to_worker_types", "_client_visible"]) assert.ok(String(K[k]).length > 20, k);
  assert.deepEqual(K.hours_per_day, { default: CASUAL_HOURS().default, min: CASUAL_HOURS().min, max: CASUAL_HOURS().max });
  assert.equal(PRICING.package_rate.hourly, undefined, "لا كتلة hourly: المعامل المشتقّ سُحب بتصحيح المالك");
  // EOR كما هو
  const eor = C.computePackageRate({ mode: "lump", package: 2000, config: CFG });
  assert.deepEqual([eor.billable, eor.otHour, eor.internal.cost], [4820, 15, 4339.17]);
  assert.equal("units" in eor.internal, false);
});
function CASUAL_HOURS() { return E.CASUAL_HOURS; }

/* ═════════════ فشل مغلق ═════════════ */
test("إعداد casual فاسد أو ناقص أو خارج الصلاحية ⇒ pending_pricing بلا رقم، وساعات يوم خارج 4–12 ⇒ invalid_input", () => {
  const bads = [
    { hourly_worker_multiplier: 0 }, { hourly_worker_multiplier: -5 }, { hourly_worker_multiplier: "5" }, { hourly_worker_multiplier: null }, { hourly_worker_multiplier: 101 }, { hourly_worker_multiplier: NaN },
    { monthly_worker_multiplier: 0 }, { monthly_worker_multiplier: null }, { monthly_worker_multiplier: "1" },
    { sale_multiplier: 0 }, { sale_multiplier: null }, { sale_multiplier: -2 }, { sale_multiplier: true },
    { reference_month_days: 0 }, { reference_month_days: "30" }, { reference_month_days: 32 }, { reference_hours_per_day: 0 }, { reference_hours_per_day: 7.5 }, { reference_hours_per_day: 25 },
    { min_hourly_halalas: -1 }, { min_hourly_halalas: 1.5 }, { min_hourly_halalas: "5" },
    { hours_per_day: null }, { hours_per_day: { default: 8, min: 4 } }, { hours_per_day: { default: 3, min: 4, max: 12 } }, { hours_per_day: { default: 13, min: 4, max: 12 } },
  ];
  for (const patch of bads) {
    const cfg = cfgOf(withCasual(patch)), r = casual(1500, cfg);
    assert.equal(r.status, "pending_pricing", JSON.stringify(patch));
    assert.ok(r.missing.length >= 1);
    assert.equal("units" in r, false);
    assert.deepEqual(C.casualUnitView(r, cfg, "hourly"), { status: "pending_pricing" });
  }
  const p1 = clone(PRICING); delete p1.package_rate.casual;
  assert.deepEqual(casual(1500, cfgOf(p1)), { status: "pending_pricing", missing: ["package_rate.casual"] });
  assert.deepEqual(C.computeCasualRate({ package: 1500, config: null }), { status: "pending_pricing", missing: ["config.package_rate"] });
  const p2 = clone(PRICING); p2.package_rate.currency = null;
  assert.equal(casual(1500, cfgOf(p2)).status, "pending_pricing");
  assert.deepEqual(C.computeCasualRate({ package: 1500, config: { ...CFG, validUntil: "2026-09-30", today: "2026-10-09" } }), { status: "pending_pricing", missing: ["config.valid_window"] });
  for (const P of [0, -5, NaN, Infinity, "1500", null, undefined, 2_000_000]) assert.equal(C.computeCasualRate({ package: P, config: CFG }).status, "invalid_input", String(P));
  for (const h of [3, 13, 0, 8.5, "x", -4, true]) assert.equal(C.computeCasualRate({ package: 1500, hoursPerDay: h, config: CFG }).status, "invalid_input", String(h));
});

test("بوابات العميل: client_price_visible=false أو casual.client_visible=false ⇒ pending وحدها لكل الوحدات", () => {
  const a = clone(PRICING); a.package_rate.client_price_visible = false;
  const b = withCasual({ client_visible: false });
  for (const p of [a, b]) {
    const cfg = cfgOf(p);
    for (const u of ["monthly", "daily", "hourly"]) assert.deepEqual(C.casualUnitView(casual(1500, cfg), cfg, u), { status: "pending_pricing" });
  }
  for (const bad of [null, undefined, {}, { status: "pending_pricing", missing: ["x"] }, { status: "ok" }, { status: "ok", units: { hourlyHalalas: -1 } }]) assert.deepEqual(C.casualUnitView(bad, CFG, "hourly"), { status: "pending_pricing" });
});

test("القوائم البيضاء: الوحدة (المجهول ⇒ شهري) ونوع التعاقد (المجهول ⇒ contract) والكمية وساعات اليوم", () => {
  assert.deepEqual([...C.BILLING_UNITS], ["monthly", "daily", "hourly"]);
  assert.deepEqual([...C.ENGAGEMENT_TYPES], ["contract", "casual"]);
  for (const v of [undefined, null, "", "weekly", "hour", 1, true, {}, [], "__proto__", "constructor"]) { assert.equal(C.normalizeBillingUnit(v), "monthly", String(v)); assert.equal(C.normalizeEngagementType(v), "contract", String(v)); }
  assert.equal(C.normalizeBillingUnit(" HOURLY "), "hourly");
  assert.equal(C.normalizeEngagementType(" Casual "), "casual");
  assert.deepEqual({ ...C.UNIT_QUANTITY_MAX }, { monthly: 36, daily: 3650, hourly: 10000 });
  const q = (u, v) => C.parseUnitQuantity(u, v);
  for (const [u, v] of [["hourly", 1], ["hourly", 10000], ["daily", 3650], ["monthly", 36], ["hourly", "120"], ["daily", " 7 "]]) assert.equal(q(u, v).ok, true, `${u} ${v}`);
  for (const [u, v] of [["hourly", 10001], ["daily", 3651], ["monthly", 37], ["hourly", 0], ["hourly", -1], ["hourly", 1.5], ["hourly", "abc"], ["hourly", "1e3"], ["hourly", NaN], ["hourly", Infinity], ["hourly", true], ["hourly", []], ["hourly", "-5"], ["hourly", "9999999"]]) assert.equal(q(u, v).ok, false, `${u} ${String(v)}`);
  for (const v of [undefined, null, ""]) assert.deepEqual(q("hourly", v), { ok: true, value: null });
  assert.deepEqual({ ...C.CASUAL_HOURS }, { min: 4, max: 12, default: 8 });
  for (const v of [4, 8, 12, "10"]) assert.equal(C.parseCasualHours(v).ok, true, String(v));
  for (const v of [3, 13, 0, 8.5, "x", -1, true, [], {}]) assert.equal(C.parseCasualHours(v).ok, false, String(v));
  assert.deepEqual(C.parseCasualHours(null), { ok: true, value: null });
});

/* ═════════════ التحقق من الطلب ═════════════ */
test("validateEorRequest: engagementType — المجهول تعاقد؛ المرنة تحمل الوحدة والكمية وساعات اليوم بلا حقول تأمين؛ والتعاقد بلا أي حقل وحدة", () => {
  const v = (extra, b = {}) => E.validateEorRequest(body([{ occupationId: "hosp.waiter", count: 2, nationalities: ["IN"], salary: 2000, ...extra }], b), { now: NOW });
  const legacy = v({});
  assert.equal(legacy.value.engagementType, "contract");
  assert.equal("billingUnit" in legacy.value.items[0], false);
  assert.equal(legacy.value.items[0].insuranceClass, "basic");
  assert.equal(v({}, { engagementType: "weekly" }).value.engagementType, "contract");
  assert.equal("billingUnit" in v({ billingUnit: "hourly", quantity: 5 }, { engagementType: "contract" }).value.items[0], false, "حقول المرنة تُهمَل في التعاقد");
  const h = v({ billingUnit: "daily", quantity: "22", hoursPerDay: "10", insuranceClass: "A" }, { engagementType: "casual" });
  assert.equal(h.value.engagementType, "casual");
  assert.deepEqual([h.value.items[0].billingUnit, h.value.items[0].quantity, h.value.items[0].hoursPerDay], ["daily", 22, 10]);
  assert.equal("insuranceClass" in h.value.items[0], false);
  const hourly = v({ billingUnit: "hourly", quantity: 160, hoursPerDay: 10 }, { engagementType: "casual" });
  assert.equal(hourly.value.items[0].hoursPerDay, null, "ساعات اليوم للوحدة اليومية وحدها");
  assert.equal(v({ billingUnit: "weekly" }, { engagementType: "casual" }).value.items[0].billingUnit, "monthly");
  for (const q of [0, -3, 1.5, "x", 10001, true]) { const r = v({ billingUnit: "hourly", quantity: q }, { engagementType: "casual" }); assert.deepEqual([r.ok, r.error, r.status], [false, "quantity_invalid", 400], String(q)); }
  for (const hp of [3, 13, 8.5, "x", true]) { const r = v({ billingUnit: "daily", quantity: 5, hoursPerDay: hp }, { engagementType: "casual" }); assert.deepEqual([r.ok, r.error], [false, "hours_per_day_invalid"], String(hp)); }
  assert.equal(v({ billingUnit: "monthly", quantity: 37 }, { engagementType: "casual" }).error, "quantity_invalid");
});

/* ═════════════ estimatePackageQuote وaction=price ═════════════ */
test("العمالة المرنة: سعر الوحدة وإجمالي الكمية = سعر الوحدة × الكمية لكل موظف × العدد، وإجمالي الكميات يجمع البنود", () => {
  const items = [CIT(3, 1500, { billingUnit: "hourly", quantity: 160 }), CIT(2, 1500, { billingUnit: "daily", quantity: 22, hoursPerDay: 10 }), CIT(1, 1500, { billingUnit: "monthly", quantity: 6 })];
  const q = E.estimatePackageQuote(items, PRICING, { workerType: "foreign", now: NOW, engagementType: "casual" });
  assert.equal(q.status, "ok");
  assert.equal(q.engagementType, "casual");
  assert.deepEqual(q.lines[0].unit, { status: "ok", billingUnit: "hourly", unitPrice: 62.5, quantity: 160, total: 62.5 * 160 * 3 });
  assert.deepEqual(q.lines[1].unit, { status: "ok", billingUnit: "daily", unitPrice: 625, hoursPerDay: 10, quantity: 22, total: 625 * 22 * 2 });
  assert.deepEqual(q.lines[2].unit, { status: "ok", billingUnit: "monthly", unitPrice: 3000, quantity: 6, total: 18000 });
  assert.equal(q.unitTotal, 30000 + 27500 + 18000);
  assert.deepEqual(q.insuranceUi, { selectable: false, addons: false });
  for (const l of q.lines) { assert.equal("monthlyPerEmployee" in l, false); assert.equal("otHour" in l, false); assert.equal("insurance" in l, false); }
  assert.equal("monthlyTotal" in q, false);
  // كمية غائبة ⇒ سعر الوحدة بلا إجمالي، ولا unitTotal
  const q2 = E.estimatePackageQuote([CIT(2, 1500, { quantity: null })], PRICING, { workerType: "foreign", now: NOW, engagementType: "casual" });
  assert.deepEqual(q2.lines[0].unit, { status: "ok", billingUnit: "hourly", unitPrice: 62.5, quantity: null, total: null });
  assert.equal("unitTotal" in q2, false);
  // ساعات اليوم الغائبة ⇒ افتراضي الإعداد (8)
  const q3 = E.estimatePackageQuote([CIT(1, 1500, { billingUnit: "daily", quantity: 1, hoursPerDay: null })], PRICING, { workerType: "foreign", now: NOW, engagementType: "casual" });
  assert.deepEqual([q3.lines[0].unit.unitPrice, q3.lines[0].unit.hoursPerDay], [500, 8]);
  // كمية فاسدة تصل الدالة مباشرة ⇒ تُسقَط إلى null لا رقم مشوَّه
  assert.equal(E.estimatePackageQuote([CIT(1, 1500, { quantity: 10001 })], PRICING, { workerType: "foreign", now: NOW, engagementType: "casual" }).lines[0].unit.quantity, null);
});

test("المرنة: العامل السعودي والأجنبي حسب applies_to، المختلط يحتاج مراجعة، الراتب الغائب needs_salary، والإعداد المغلق ⇒ pending", () => {
  const run = (items, pricing = PRICING, workerType = "foreign") => E.estimatePackageQuote(items, pricing, { workerType, now: NOW, engagementType: "casual" });
  assert.equal(run([IT(1, ["SA"], 1500, { billingUnit: "hourly", quantity: 2 })], PRICING, "saudi").status, "ok");
  const onlyForeign = withCasual({ applies_to_worker_types: ["foreign"] });
  assert.equal(run([IT(1, ["SA"], 1500, { billingUnit: "hourly" })], onlyForeign, "saudi").lines[0].status, "not_applicable");
  assert.equal(run([IT(1, ["SA", "IN"], 1500, { billingUnit: "hourly" })]).lines[0].status, "needs_review");
  assert.equal(run([IT(1, ["IN"], null, { billingUnit: "hourly" })]).lines[0].status, "needs_salary");
  assert.equal(run([CIT(1, 1500), IT(1, ["IN"], null, { billingUnit: "hourly" })]).status, "partial");
  assert.deepEqual(run([CIT(1, 1500)], withCasual({ client_visible: false })), { status: "pending_pricing" });
  assert.deepEqual(run([CIT(1, 1500)], withCasual({ sale_multiplier: null })), { status: "pending_pricing" });
  assert.deepEqual(run([CIT(1, 1500, { billingUnit: "daily", hoursPerDay: 12 })], withCasual({ hours_per_day: { default: 8, min: 4, max: 10 } })), { status: "pending_pricing" });
  const shut = clone(PRICING); shut.package_rate.client_price_visible = false;
  assert.deepEqual(run([CIT(1, 1500)], shut), { status: "pending_pricing" });
  const noCasual = clone(PRICING); delete noCasual.package_rate.casual;
  assert.deepEqual(run([CIT(1, 1500)], noCasual), { status: "pending_pricing" });
});

test("EOR (تعاقد) لم يتغيّر: نفس الأسعار والأسطر والشكل، وحقول المرنة لا تدخل حسابه", () => {
  const q = E.estimatePackageQuote([IT(3, ["IN"], 2000, { billingUnit: "hourly", quantity: 99 })], PRICING, { workerType: "foreign", now: NOW });
  assert.equal(q.lines[0].monthlyPerEmployee, 4820);
  assert.equal(q.lines[0].otHour, 15);
  assert.equal(q.monthlyTotal, 14460);
  assert.equal("unit" in q.lines[0], false);
  assert.equal("unitTotal" in q, false);
  assert.equal("engagementType" in q, false);
  assert.equal(C.packageSaleMonthlyHalalas(C.computePackageRate({ mode: "lump", package: 2000, config: CFG })), 482000);
});

test("action=price: engagementType casual يعيد سعر الوحدة وإجمالي الكمية من الخادم، والمجهول تعاقد، وكمية/ساعات فاسدة ⇒ 400", async () => {
  const price = (items, extra = {}, pricing = PRICING) => E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items, ...extra }, { now: NOW, ip: "", pricing });
  const api = await price([{ count: 2, nationalities: ["IN"], salary: "1,500", billingUnit: "hourly", quantity: "100" }], { engagementType: "casual" });
  assert.deepEqual(Object.keys(api), ["ok", "quote"]);
  assert.deepEqual(api.quote.lines[0].unit, { status: "ok", billingUnit: "hourly", unitPrice: 62.5, quantity: 100, total: 12500 });
  assert.equal(api.quote.unitTotal, 12500);
  const contract = await price([{ count: 1, nationalities: ["IN"], salary: 2000, billingUnit: "hourly", quantity: 5 }], { engagementType: "bogus" });
  assert.equal(contract.quote.lines[0].monthlyPerEmployee, 4820);
  assert.equal("unit" in contract.quote.lines[0], false);
  for (const quantity of [0, 1.5, "x", 10001]) { const r = await price([{ count: 1, nationalities: ["IN"], salary: 1500, billingUnit: "hourly", quantity }], { engagementType: "casual" }); assert.deepEqual([r.ok, r.error, r.status], [false, "quantity_invalid", 400]); }
  const hp = await price([{ count: 1, nationalities: ["IN"], salary: 1500, billingUnit: "daily", hoursPerDay: 14 }], { engagementType: "casual" });
  assert.deepEqual([hp.ok, hp.error], [false, "hours_per_day_invalid"]);
  const shut = await price([{ count: 1, nationalities: ["IN"], salary: 1500, billingUnit: "hourly", quantity: 5 }], { engagementType: "casual" }, withCasual({ client_visible: false }));
  assert.deepEqual(shut.quote, { status: "pending_pricing" });
});

test("itemsText للفريق: عمالة مرنة بالوحدة والكمية وساعات اليوم، بلا سعر ولا معامل", () => {
  const t = E.itemsText([CIT(2, 1500, { billingUnit: "hourly", quantity: 120 }), CIT(1, 1500, { billingUnit: "daily", quantity: 5, hoursPerDay: 10 }), IT(1, ["IN"], 2000)]).split("\n");
  assert.match(t[0], / — عمالة مرنة: بالساعة × 120 لكل موظف$/);
  assert.match(t[1], / — عمالة مرنة: يومي × 5 لكل موظف — 10 ساعات يومياً$/);
  assert.equal(/عمالة مرنة/.test(t[2]), false);
});

/* ═════════════ الخصوصية: لا معامل ولا أجر عامل ولا ربح ولا حدّ أدنى أمام العميل ═════════════ */
const CANARY = clone(PRICING);
Object.assign(CANARY, { currency: "SAR", vat_rate: 0.15 });
Object.assign(CANARY.package_rate.casual, { hourly_worker_multiplier: 4.7654321, monthly_worker_multiplier: 1.0987654, sale_multiplier: 2.3456789, min_hourly_halalas: 1357 });
const CANARY_CFG = cfgOf(CANARY);
const ASK = { billingUnit: "hourly", quantity: 120, hoursPerDay: null };

function secrets() {
  const ops = C.casualRateForRole({ package: 2750, hoursPerDay: 10, config: CANARY_CFG }, "ops");
  assert.equal(ops.status, "ok");
  assert.equal(ops.internal.minApplied, false, "الحدّ الأدنى للكناري أقل من السعر فلا يظهر كسعر");
  const i = ops.internal, sar = (h) => String(h / 100);
  return ["4.7654321", "4765432", "7654321", "1.0987654", "1098765", "0987654", "2.3456789", "2345679", "3456789", "1357", "13.57",
    sar(i.workerHourlyHalalas), sar(i.workerDailyHalalas), sar(i.workerMonthlyHalalas), sar(i.referenceHourlyHalalas), sar(i.profitHourlyHalalas), sar(i.profitDailyHalalas), sar(i.profitMonthlyHalalas), String(i.profitShareMonthly)];
}
const KEYS_RE = /multiplier|workerHourly|workerDaily|workerMonthly|referenceHourly|profit|margin|saleMult|sale_mult|minHourly|min_hourly|minApplied|"internal"|worker_/i;
const clean = (label, text, raw) => {
  for (const n of raw) assert.equal(text.includes(n), false, `${label}: قيمة داخلية ${n}`);
  const m = text.match(KEYS_RE);
  assert.equal(m, null, `${label}: مفتاح داخلي ${m && m[0]}`);
};

test("canaries: الحاسبة الداخلية تحمل القيم فعلاً (حتى لا يمرّ الاختبار فارغاً)", () => {
  const raw = secrets();
  assert.ok(new Set(raw).size >= 17);
  const ops = JSON.stringify(C.casualRateForRole({ package: 2750, hoursPerDay: 10, config: CANARY_CFG }, "ops"));
  assert.ok(ops.includes("workerHourlyHalalas") && ops.includes("profitMonthlyHalalas"));
});

test("canaries: casualUnitView وردّ الأدوار غير ops وestimatePackageQuote وaction=price بلا معاملات ولا أجر عامل ولا ربح ولا حدّ أدنى", async () => {
  const raw = secrets();
  const res = casual(2750, CANARY_CFG, 10);
  for (const unit of ["monthly", "daily", "hourly", "weekly", undefined]) clean("casualUnitView " + unit, JSON.stringify(C.casualUnitView(res, CANARY_CFG, unit)), raw);
  for (const role of ["client", "vendor", "candidate", undefined, null, "", "admin", "OPS", "owner"]) clean("role " + role, JSON.stringify(C.casualRateForRole({ package: 2750, hoursPerDay: 10, config: CANARY_CFG }, role)), raw);
  const pq = JSON.stringify(E.estimatePackageQuote([IT(2, ["IN"], 2750, ASK)], CANARY, { workerType: "foreign", durationMonths: 12, now: NOW, engagementType: "casual" }));
  clean("estimatePackageQuote", pq, raw);
  assert.equal(JSON.parse(pq).status, "ok");
  for (const unit of ["monthly", "daily", "hourly"]) {
    const api = JSON.stringify(await E.handleEor({ action: "price", engagementType: "casual", workerType: "foreign", durationMonths: 12, items: [{ count: 2, nationalities: ["IN"], salary: 2750, billingUnit: unit, quantity: 10, hoursPerDay: 10 }] }, { now: NOW, ip: "", pricing: CANARY }));
    clean("api/price " + unit, api, raw);
    assert.equal(JSON.parse(api).quote.status, "ok");
  }
  // وحتى الحدّ الأدنى المطبَّق لا يكشف مفتاحه (يظهر كسعر فقط)
  const hiMin = clone(CANARY); hiMin.package_rate.casual.min_hourly_halalas = 99999;
  const shown = JSON.stringify(E.estimatePackageQuote([IT(1, ["IN"], 2750, ASK)], hiMin, { workerType: "foreign", now: NOW, engagementType: "casual" }));
  assert.equal(shown.match(KEYS_RE), null);
  assert.equal(JSON.parse(shown).lines[0].unit.unitPrice, 999.99);
});

test("canaries: بريد العميل وطلب Notion والتنبيه وبريد الفريق لا تحمل المعاملات ولا أجر العامل ولا الربح ولا الحدّ الأدنى", async () => {
  const raw = secrets();
  const calls = [], mails = [], notes = [];
  const ctx = {
    dev: false, notionToken: "secret_test", dbId: "db-test", now: NOW, ip: "", pricing: CANARY, refGen: () => "EOR-717171",
    fetch: async (url, init) => { calls.push(init.body); return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
    sendEmail: async (to, subject, html) => { mails.push({ to, subject, html }); return { ok: true }; },
    notify: async (p) => { notes.push(p); return { ok: true }; }, teamEmail: "team@test.local", ownerEmail: "owner@test.local",
  };
  const r = await E.handleEor(body([IT(2, ["IN"], 2750, ASK)], { engagementType: "casual" }), ctx);
  assert.deepEqual(r, { ok: true, ref: "EOR-717171" });
  clean("ردّ الطلب", JSON.stringify(r), raw);
  const toClient = mails.find((m) => m.to === "sara@example.com");
  const noStyle = (h) => h.replace(/style="[^"]*"/g, "");
  clean("بريد العميل", toClient.subject + noStyle(toClient.html), raw);
  assert.equal(/ريال|SAR/.test(toClient.html), false, "بريد العميل بلا مبلغ");
  const notion = calls.join("\n");
  clean("Notion", notion, raw);
  assert.ok(notion.includes("عمالة مرنة: بالساعة × 120 لكل موظف"), "اختيار العميل محفوظ للفريق");
  assert.ok(notion.includes("\"نوع التعاقد\"") && notion.includes("عمالة مرنة"), "نوع التعاقد في الصف");
  assert.match(notion, /بند 1: بالساعة \d+(\.\d+)? × 120 × 2 موظف = /, "سعر الوحدة الذي رآه العميل محفوظ للفريق");
  clean("بريد الفريق", noStyle(mails.find((m) => m.to === "team@test.local").html), raw);
  clean("تنبيه واتساب", JSON.stringify(notes), raw);
  assert.equal(notes[0].eor.engagementType, "casual");
});

/* ═════════════ الصفحة /eor ═════════════ */
test("/eor بالأربع لغات: نوع التعاقد (تعاقد/عمالة مرنة)، الوحدة والكمية وساعات اليوم، الأسعار من الخادم بلا حساب في الواجهة، بلا معاملات ولا إعداد داخلي", async () => {
  const { simpleV1 } = await import("../site/scripts/simple-v1.mjs");
  const { buildSimpleEor } = await import("../site/scripts/simple-v1-eor.mjs");
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const names = {};
  for (const l of ["ar", "en", "fr", "zh"]) {
    const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
    const sv1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang: (p, x) => (x === "en" ? p : "/" + x + p), assetV: (x) => x, knowledge: null });
    const h = buildSimpleEor(sv1, { lang: () => l, esc });
    const s0 = h.indexOf("<script>(function eorClient");
    const client = h.slice(s0, h.indexOf("</script>", s0));
    const cfg = JSON.parse(h.slice(s0).match(/\)\((\{"lang":.*\})\);<\/script>/s)[1]);
    assert.deepEqual(cfg.units.map((u) => u.id), ["monthly", "daily", "hourly"], l);
    assert.deepEqual(cfg.units.map((u) => u.max), [36, 3650, 10000], l);
    assert.deepEqual([cfg.lim.hMin, cfg.lim.hMax, cfg.lim.hDef], [4, 12, 8], l);
    for (const u of cfg.units) assert.ok(u.name && u.qty && u.price, `${l}.${u.id}`);
    assert.equal(new Set(cfg.units.map((u) => u.name)).size, 3, l);
    names[l] = cfg.tx;
    for (const k of ["engH", "etContract", "etCasual", "etHint", "salaryRef", "hpdH", "hrs", "unitH", "pUTotal", "pUSum", "eQty"]) assert.ok(cfg.tx[k] && cfg.tx[k].length >= 2, `${l}.${k}`);
    assert.ok(h.includes('name="eorET" value="contract"') && h.includes('name="eorET" value="casual"') && h.includes('id="eorRCW"'), l);
    // الواجهة تُرسل الاختيار وتعرض ما يعيده الخادم فقط
    assert.ok(client.includes("engagementType") && client.includes("billingUnit") && client.includes("quantity") && client.includes("hoursPerDay") && client.includes("unitPrice") && client.includes("cu.total") && client.includes("unitTotal"), l);
    assert.equal(/unitPrice\s*\*|\*\s*(?:cu\.)?unitPrice|quantity\s*\*|\*\s*quantity|\/\s*240|\*\s*[258]\b/.test(client), false, l + ": لا حساب سعر في الواجهة");
    assert.equal(/multiplier|worker_|workerHourly|sale_mult|saleMult|min_hourly|package_rate|margin_|overhead|profit|markup|referenceHourly|casual\./i.test(h), false, l + ": لا معامل ولا إعداد داخلي");
    assert.equal(/localStorage|sessionStorage/.test(client), false);
    const css = h.slice(h.indexOf('id="sv1-eor-css"'), h.indexOf("</style>", h.indexOf('id="sv1-eor-css"')));
    const rules = css.split("\n").filter((ln) => ln.startsWith(".sv1-eor-unit"));
    assert.ok(rules.length >= 2);
    for (const ln of rules) assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(ln), false, "لون حرفي: " + ln);
    const main = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    assert.equal(/\d\s*(﷼|ر\.س|SAR)/.test(main), false);
    assert.equal(/wa\.me|whatsapp/i.test(main), false);
    assert.equal(/شريك الأعمال|شريك أعمالك/.test(h), false);
    // لا ادّعاء نظامي في نص الواجهة عن الكفالة/الإقامة/التأمين للعمالة المرنة (يحتاج مراجعة قانونية قبل النشر)
    assert.equal(/كفالة[^"]*لا|بلا كفالة|no sponsorship|sans parrainage|无需担保/i.test(cfg.tx.etHint), false);
  }
  assert.match(names.ar.etCasual, /عمالة مرنة/);
  assert.match(names.en.etCasual, /Flexible staffing/);
});

test("المواصفة: قسم «العمالة المرنة» بالأمثلة العددية المفاهيمية والقرارات المفتوحة، ولا دالة API جديدة", () => {
  const spec = fs.readFileSync(path.join(ROOT, "docs/hr-pricing-calculator-spec.md"), "utf8");
  const sec = spec.slice(spec.indexOf("## العمالة المرنة"));
  assert.ok(sec.length > 1500, "قسم العمالة المرنة");
  for (const w of ["مفاهيمية", "hourly_worker_multiplier", "sale_multiplier", "مرحلة لاحقة", "قرارات مفتوحة", "مراجعة قانونية"]) assert.ok(sec.includes(w), w);
  const files = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  assert.ok(files.length <= 12, `${files.length} دالة`);
});
