// حاسبة تكلفة EOR وفاتورتها الشهرية — api/_eor-cost.js (وحدة صِرفة، بلا شبكة).
//
// ⚠ كل الأرقام هنا «أرقام اختبار لا أسعار»: الهامش 10% والضريبة 15% وأيام الشهر 30 قيمٌ وهمية للاختبار فقط ولا تعني
// أن المالك اعتمد شيئاً. الملف الحقيقي api/_eor-pricing.json كله null، وأحد الاختبارات يثبّت أن الحاسبة معه ترجع pending_pricing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const C = await import("../api/_eor-cost.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL = fs.readFileSync(path.join(ROOT, "db/migrations/2026-10-eor-ops.sql"), "utf8");

// أرقام اختبار لا أسعار
const CFG = { currency: "SAR", vatRate: 0.15, marginRate: 0.10, accrual: { eos: {}, leave: {} }, agreedMonthDays: 30, hoursPerDay: 8, period: "2026-10" };
const sar = (n) => Math.round(n * 100);
// مثال المالك: راتب 4000، حكومي 1500، مخصّص 500 (نهاية خدمة 300 + إجازات 200)، استقدام/تأشيرة 1000 (700 + 300) على 12 شهراً، هامش 10%
const OWNER = {
  salaryHalalas: sar(4000), governmentMonthlyHalalas: sar(1500),
  eosAccrualMonthlyHalalas: sar(300), leaveAccrualMonthlyHalalas: sar(200),
  recruitmentHalalas: sar(700), visaHalalas: sar(300), vendorFeeHalalas: 0, contractMonths: 12,
};
// حساب مستقل (أعداد صحيحة بلا استدعاء الحاسبة): نصف لأعلى = floor((2n + d) / 2d)
const halfUp = (n, d) => Math.floor((2 * n + d) / (2 * d));
const sheet = (over = {}, cfg = CFG) => C.computeCostSheet({ ...OWNER, ...over }, cfg);

/* ═════════════ مثال المالك ═════════════ */
test("مثال المالك (أرقام اختبار لا أسعار): التكلفة 6083.33 والبيع 6691.66 بحساب مستقل", () => {
  // استقدام 700/12 = 58.3333 → 58.33 ؛ تأشيرة 300/12 = 25.00 ؛ مورّد 0
  const recA = halfUp(70000, 12), visaA = halfUp(30000, 12);
  assert.equal(recA, 5833); assert.equal(visaA, 2500);
  const cost = 400000 + 150000 + 30000 + 20000 + recA + visaA;
  assert.equal(cost, 608333);
  const margin = halfUp(cost * 10, 100);                     // 10% من 608333 = 60833.3 → 60833
  assert.equal(margin, 60833);
  const s = sheet();
  assert.equal(s.status, "ok");
  assert.equal(s.costMonthlyHalalas, cost);
  assert.equal(s.marginHalalas, margin);
  assert.equal(s.saleMonthlyHalalas, 669166);
  assert.equal(s.saleMonthlyHalalas, cost + margin);
  assert.equal(C.halalasToSar(s.costMonthlyHalalas), 6083.33);
  assert.equal(C.halalasToSar(s.saleMonthlyHalalas), 6691.66);
  assert.equal(s.contractMonths, 12);
  assert.equal(s.currency, "SAR");
  assert.equal(s.rounding, "half_up_per_line");
});

test("التقريب معلَن لا مخفيّ: فرق توزيع الاستقدام على المدة في oneTime.residualHalalas، ومجموع الأسطر = التكلفة", () => {
  const s = sheet();
  assert.equal(s.oneTime.totalHalalas, 100000);
  assert.equal(s.oneTime.residualHalalas, 100000 - 12 * (5833 + 2500));   // 4 هللات
  assert.equal(s.oneTime.residualHalalas, 4);
  assert.equal(Object.values(s.lines).reduce((a, b) => a + b, 0), s.costMonthlyHalalas);
  assert.deepEqual(Object.keys(s.lines), ["salaryHalalas", "governmentHalalas", "eosAccrualHalalas", "leaveAccrualHalalas", "recruitmentAmortizedHalalas", "visaAmortizedHalalas", "vendorFeeAmortizedHalalas"]);
});

test("التقريب نصف لأعلى على مستوى السطر: 12.5 هللة ⇒ 13، و12.4 ⇒ 12، و0.5 ⇒ 1", () => {
  assert.equal(C.mulDivHalfUp(100, 1, 8), 13);        // 12.5
  assert.equal(C.mulDivHalfUp(99, 1, 8), 12);         // 12.375
  assert.equal(C.mulDivHalfUp(1, 1, 2), 1);           // 0.5
  assert.equal(C.mulDivHalfUp(1, 1, 3), 0);
  assert.equal(C.mulDivHalfUp(0, 5, 7), 0);
  const s = sheet({ visaHalalas: 100, recruitmentHalalas: 0, contractMonths: 8 });
  assert.equal(s.lines.visaAmortizedHalalas, 13);
  assert.equal(s.oneTime.residualHalalas, 100 - 8 * 13);      // -4: الزيادة كذلك معلَنة
});

test("الهامش بنصف لأعلى بلا ضجيج عشري: هامش 15% على 10 هللات = 1.5 ⇒ 2 (لا 1)", () => {
  const s = C.computeCostSheet({ ...OWNER, salaryHalalas: 10, governmentMonthlyHalalas: 0, eosAccrualMonthlyHalalas: 0, leaveAccrualMonthlyHalalas: 0, recruitmentHalalas: 0, visaHalalas: 0, vendorFeeHalalas: 0 }, { ...CFG, marginRate: 0.15 });
  assert.equal(s.costMonthlyHalalas, 10);
  assert.equal(s.marginHalalas, 2);
  assert.equal(s.saleMonthlyHalalas, 12);
});

test("هامش صفر صريح وسعودي بلا استقدام (أصفار صريحة) ⇒ ok والبيع = التكلفة", () => {
  const s = sheet({ recruitmentHalalas: 0, visaHalalas: 0, vendorFeeHalalas: 0 }, { ...CFG, marginRate: 0 });
  assert.equal(s.status, "ok");
  assert.equal(s.marginHalalas, 0);
  assert.equal(s.saleMonthlyHalalas, s.costMonthlyHalalas);
  assert.equal(s.costMonthlyHalalas, 400000 + 150000 + 30000 + 20000);
});

test("رسوم المورّد تدخل التكلفة موزَّعة على المدة", () => {
  const s = sheet({ vendorFeeHalalas: sar(1200) });
  assert.equal(s.lines.vendorFeeAmortizedHalalas, 10000);
  assert.equal(s.costMonthlyHalalas, 608333 + 10000);
});

/* ═════════════ المخصّصات من قواعد الإعداد ═════════════ */
test("المخصّص من نسبة الراتب في الإعداد، والثابت يغلب النسبة، والإدخال الصريح يغلبهما", () => {
  const base = { ...OWNER }; delete base.eosAccrualMonthlyHalalas; delete base.leaveAccrualMonthlyHalalas;
  const pct = C.computeCostSheet(base, { ...CFG, accrual: { eos: { percentOfSalary: 0.0833 }, leave: { fixedMonthlyHalalas: 20000 } } });
  assert.equal(pct.status, "ok");
  assert.equal(pct.lines.eosAccrualHalalas, halfUp(400000 * 833, 10000));   // 33320
  assert.equal(pct.lines.eosAccrualHalalas, 33320);
  assert.equal(pct.lines.leaveAccrualHalalas, 20000);
  const both = C.computeCostSheet(base, { ...CFG, accrual: { eos: { percentOfSalary: 0.5, fixedMonthlyHalalas: 111 }, leave: { fixedMonthlyHalalas: 0 } } });
  assert.equal(both.lines.eosAccrualHalalas, 111);
  assert.equal(both.lines.leaveAccrualHalalas, 0, "صفر ثابت صريح قاعدة صالحة");
  const over = C.computeCostSheet({ ...base, eosAccrualMonthlyHalalas: 7 }, { ...CFG, accrual: { eos: { fixedMonthlyHalalas: 111 }, leave: { fixedMonthlyHalalas: 0 } } });
  assert.equal(over.lines.eosAccrualHalalas, 7);
});

test("هامش على مستوى الإدخال يغلب هامش الإعداد", () => {
  const s = sheet({ marginRate: 0.2 });
  assert.equal(s.marginHalalas, halfUp(608333 * 2, 10));
});

/* ═════════════ pending_pricing: لا رقم ═════════════ */
test("أي قيمة لازمة null ⇒ pending_pricing مع missing ولا رقم واحد في الردّ", () => {
  const cases = [
    [{}, { ...CFG, marginRate: null }, "config.margin_rate"],
    [{}, { ...CFG, currency: null }, "config.currency"],
    [{}, { ...CFG, currency: "  " }, "config.currency"],
    [{ salaryHalalas: null }, CFG, "input.salary"],
    [{ governmentMonthlyHalalas: undefined }, CFG, "input.government_monthly"],
    [{ recruitmentHalalas: null }, CFG, "input.recruitment"],
    [{ visaHalalas: null }, CFG, "input.visa"],
    [{ vendorFeeHalalas: null }, CFG, "input.vendor_fee"],
    [{ contractMonths: null }, CFG, "input.contract_months"],
    [{ eosAccrualMonthlyHalalas: null }, CFG, "config.end_of_service_accrual"],
    [{ leaveAccrualMonthlyHalalas: null }, CFG, "config.leave_accrual"],
    [{}, { ...CFG, today: "2027-01-01", validUntil: "2026-12-31" }, "config.valid_window"],
    [{}, { ...CFG, today: "2026-01-01", validFrom: "2026-06-01" }, "config.valid_window"],
  ];
  for (const [over, cfg, field] of cases) {
    const r = sheet(over, cfg);
    assert.equal(r.status, "pending_pricing", field);
    assert.ok(r.missing.includes(field), `${field} ∉ ${r.missing}`);
    assert.deepEqual(Object.keys(r).sort(), ["missing", "status"], "لا مفاتيح أخرى");
    assert.ok(!/\d{3,}/.test(JSON.stringify(r)), "لا أرقام مالية في الردّ");
  }
});

test("pending_pricing يجمع كل الناقص دفعة واحدة، وحدود الصلاحية مفتوحة داخل النافذة", () => {
  const r = C.computeCostSheet({ salaryHalalas: 1 }, {});
  assert.equal(r.status, "pending_pricing");
  for (const f of ["input.government_monthly", "input.recruitment", "input.visa", "input.vendor_fee", "input.contract_months", "config.currency", "config.margin_rate", "config.end_of_service_accrual", "config.leave_accrual"]) assert.ok(r.missing.includes(f), f);
  assert.equal(sheet({}, { ...CFG, today: "2026-10-08", validFrom: "2026-10-08", validUntil: "2026-10-08" }).status, "ok");
});

test("نسبة مخصّص بلا راتب لا تُبلَّغ ناقصة مرتين: الراتب هو الناقص", () => {
  const r = C.computeCostSheet({ ...OWNER, salaryHalalas: null, eosAccrualMonthlyHalalas: undefined, leaveAccrualMonthlyHalalas: undefined }, { ...CFG, accrual: { eos: { percentOfSalary: 0.08 }, leave: { percentOfSalary: 0.05 } } });
  assert.equal(r.status, "pending_pricing");
  assert.deepEqual(r.missing, ["input.salary"]);
});

test("الملف الحقيقي api/_eor-pricing.json (كله null) ⇒ الحاسبة pending_pricing بلا رقم", () => {
  const pricing = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
  // كتلة package_rate (2026-10-08) أرقام إكسل المالك مملوءة عمداً ولها اختباراتها في tests/eor-package-rate.test.mjs؛ وكتلة billing (2026-10-08) افتراضاتها معلَّمة _owner_decision واختباراتها في tests/eor-billing.test.mjs؛ الباقي كله null.
  const walk = (o) => Object.entries(o).filter(([k]) => k !== "_readme" && k !== "package_rate" && k !== "billing").every(([, v]) => (v && typeof v === "object" ? walk(v) : v === null));
  assert.ok(walk(pricing), "المالك لم يملأ شيئاً بعد — وإن ملأه تحدَّث هذا الاختبار عمداً");
  const cfg = C.costConfigFromPricing(pricing);
  assert.equal(cfg.marginRate, null);
  assert.equal(cfg.clientCostVisibility, null);
  const r = C.computeCostSheet(OWNER, cfg);
  assert.equal(r.status, "pending_pricing");
  assert.ok(r.missing.includes("config.margin_rate") && r.missing.includes("config.currency"));
  assert.equal(C.clientView(r, cfg).status, "pending_pricing");
  const inv = C.monthlyInvoiceLines([], [], { ...cfg, period: "2026-10" });
  assert.equal(inv.status, "pending_pricing");
});

test("costConfigFromPricing: يحوّل الريال إلى هللة ويتجاهل غير الصالح (يصير null ⇒ ناقصاً لا رقماً مشوَّهاً)", () => {
  const cfg = C.costConfigFromPricing({
    currency: " SAR ", vat_rate: 0.15, valid_from: "2026-01-01", valid_until: null,
    cost: { margin_rate: 0.1, end_of_service_accrual: { percent_of_salary: null, fixed_monthly: 285.285 }, leave_accrual: { percent_of_salary: 0.05, fixed_monthly: null }, agreed_month_days: 30, hours_per_day: 8, client_cost_visibility: "breakdown" },
  });
  assert.deepEqual(cfg, {
    currency: "SAR", vatRate: 0.15, marginRate: 0.1,
    accrual: { eos: { percentOfSalary: null, fixedMonthlyHalalas: 28529 }, leave: { percentOfSalary: 0.05, fixedMonthlyHalalas: null } },
    agreedMonthDays: 30, hoursPerDay: 8, clientCostVisibility: "breakdown", validFrom: "2026-01-01", validUntil: null,
  });
  const bad = C.costConfigFromPricing({ currency: 5, vat_rate: "0.15", cost: { margin_rate: -1, client_cost_visibility: "everything" } });
  assert.equal(bad.currency, null); assert.equal(bad.vatRate, null); assert.equal(bad.marginRate, null); assert.equal(bad.clientCostVisibility, null);
  assert.equal(C.costConfigFromPricing(null).marginRate, null);
  assert.equal(C.sarToHalalas(0.285), 29);        // لا 28 بسبب 28.499999…
  assert.equal(C.sarToHalalas(4000), 400000);
});

/* ═════════════ رفض المدخلات الفاسدة ═════════════ */
test("invalid_input: هللات كسرية أو سالبة أو نصوص، نسبة خارج 0..1 (15 بدل 0.15)، مدة غير معقولة — لا تقريب صامت", () => {
  const bad = (over, cfg, field) => {
    const r = sheet(over, cfg || CFG);
    assert.equal(r.status, "invalid_input", field);
    assert.ok(r.errors.some((e) => e.field === field), `${field} ∉ ${JSON.stringify(r.errors)}`);
  };
  bad({ salaryHalalas: 4000.5 }, null, "salaryHalalas");
  bad({ salaryHalalas: -1 }, null, "salaryHalalas");
  bad({ salaryHalalas: "400000" }, null, "salaryHalalas");
  bad({ salaryHalalas: NaN }, null, "salaryHalalas");
  bad({ visaHalalas: Infinity }, null, "visaHalalas");
  bad({ contractMonths: 0 }, null, "contractMonths");
  bad({ contractMonths: 1.5 }, null, "contractMonths");
  bad({ contractMonths: 121 }, null, "contractMonths");
  bad({}, { ...CFG, marginRate: 10 }, "config.margin_rate");
  bad({ marginRate: 15 }, null, "marginRate");
  bad({}, { ...CFG, marginRate: -0.1 }, "config.margin_rate");
  bad({ eosAccrualMonthlyHalalas: 1.5 }, null, "eosAccrualMonthlyHalalas");
  assert.equal(C.computeCostSheet(null, CFG).status, "invalid_input");
  assert.equal(C.computeCostSheet([], CFG).status, "invalid_input");
});

test("الأسعار القياسية لا تتغيّر بين استدعاءين ولا يُعدَّل المُدخَل", () => {
  const input = { ...OWNER }; const cfg = JSON.parse(JSON.stringify(CFG));
  const a = C.computeCostSheet(input, cfg), b = C.computeCostSheet(input, cfg);
  assert.deepEqual(a, b);
  assert.deepEqual(input, OWNER);
  assert.deepEqual(cfg, CFG);
});

/* ═════════════ clientView: لا هامش ولا راتب خام ولا مورّد ═════════════ */
// أرقام فريدة كي يكشف الفحص النصي أي تسرّب لقيمة (لا لاسم مفتاح فقط)
const LEAK = {
  salaryHalalas: 413729, governmentMonthlyHalalas: 151717, eosAccrualMonthlyHalalas: 30303, leaveAccrualMonthlyHalalas: 20202,
  recruitmentHalalas: 77777, visaHalalas: 33333, vendorFeeHalalas: 88888, contractMonths: 12,
};
const KEY_BAN = /margin|markup|salary|vendor|supplier|recruit|visa|government|accrual|eos|leave|cost|fee|rate/i;

test("clientView (total): سعر البيع الشهري فقط — فحص نصي على JSON: لا مفتاح ولا قيمة من الهامش/الراتب/المورّد/التكلفة", () => {
  const s = C.computeCostSheet(LEAK, { ...CFG, marginRate: 0.1234 });
  const v = C.clientView(s, { clientCostVisibility: "total" });
  assert.equal(v.status, "ok");
  assert.equal(v.monthlyPriceHalalas, s.saleMonthlyHalalas);
  assert.equal(v.visibility, "total");
  assert.equal(v.vatExcluded, true);
  assert.equal(v.breakdown, undefined);
  const json = JSON.stringify(v);
  const keys = [...json.matchAll(/"([^"]+)":/g)].map((m) => m[1]);
  for (const k of keys) assert.ok(!KEY_BAN.test(k), `مفتاح محظور في ردّ العميل: ${k}`);
  for (const secretVal of [LEAK.salaryHalalas, LEAK.governmentMonthlyHalalas, LEAK.eosAccrualMonthlyHalalas, LEAK.leaveAccrualMonthlyHalalas, LEAK.recruitmentHalalas, LEAK.visaHalalas, LEAK.vendorFeeHalalas, s.marginHalalas, s.costMonthlyHalalas, 0.1234, "1234"]) {
    assert.ok(!json.includes(String(secretVal)), `قيمة داخلية تسرّبت: ${secretVal}`);
  }
});

test("clientView (breakdown): مجموعتان تجمعان سعر البيع بالتمام، بلا مفاتيح أو قيم داخلية على أي عمق", () => {
  const s = C.computeCostSheet(LEAK, { ...CFG, marginRate: 0.1234 });
  const v = C.clientView(s, { clientCostVisibility: "breakdown" });
  assert.equal(v.visibility, "breakdown");
  assert.deepEqual(v.breakdown.map((b) => b.key), ["employment", "onboarding"]);
  assert.equal(v.breakdown.reduce((a, b) => a + b.amountHalalas, 0), s.saleMonthlyHalalas);
  assert.ok(v.breakdown.every((b) => Number.isInteger(b.amountHalalas) && b.amountHalalas >= 0));
  const json = JSON.stringify(v);
  for (const m of json.matchAll(/"([^"]+)":/g)) assert.ok(!KEY_BAN.test(m[1]), `مفتاح محظور: ${m[1]}`);
  for (const secretVal of [LEAK.salaryHalalas, LEAK.recruitmentHalalas, LEAK.vendorFeeHalalas, s.marginHalalas, s.costMonthlyHalalas, 0.1234]) assert.ok(!json.includes(String(secretVal)), `تسرّب ${secretVal}`);
  // حالة تكلفة صفرية لا تقسم على صفر
  const z = C.computeCostSheet({ salaryHalalas: 0, governmentMonthlyHalalas: 0, eosAccrualMonthlyHalalas: 0, leaveAccrualMonthlyHalalas: 0, recruitmentHalalas: 0, visaHalalas: 0, vendorFeeHalalas: 0, contractMonths: 1 }, CFG);
  assert.deepEqual(C.clientView(z, { clientCostVisibility: "breakdown" }).breakdown.map((b) => b.amountHalalas), [0, 0]);
});

test("clientView: الإعداد الفارغ أو القيمة المجهولة ⇒ total (الأضيق)", () => {
  const s = sheet();
  for (const cfg of [undefined, null, {}, { clientCostVisibility: null }, { clientCostVisibility: "everything" }]) assert.equal(C.clientView(s, cfg).visibility, "total");
});

test("clientView: ورقة غير مكتملة/فاسدة ⇒ { status:'pending_pricing' } وحدها بلا قائمة missing", () => {
  const pend = C.computeCostSheet({ salaryHalalas: 1 }, {});
  assert.deepEqual(C.clientView(pend, {}), { status: "pending_pricing" });
  assert.deepEqual(C.clientView({ status: "invalid_input", errors: [] }, {}), { status: "pending_pricing" });
  assert.deepEqual(C.clientView(null, {}), { status: "pending_pricing" });
  assert.deepEqual(C.clientView(undefined), { status: "pending_pricing" });
});

test("clientView لا يحمل ورقة التكلفة نفسها: تعديل الردّ لا يمسّ الورقة والعكس", () => {
  const s = sheet(); const before = JSON.stringify(s);
  const v = C.clientView(s, { clientCostVisibility: "breakdown" });
  v.breakdown[0].amountHalalas = 1;
  assert.equal(JSON.stringify(s), before);
});

/* ═════════════ الفاتورة الشهرية ═════════════ */
const PL = (id, over = {}) => ({ id, stage: "active", saleMonthlyHalalas: 669166, ...over });
const TS = (placementId, over = {}) => ({ placementId, period: "2026-10", status: "approved", approvedDays: 30, ...over });
const inv = (p, t, cfg = {}) => C.monthlyInvoiceLines(p, t, { ...CFG, ...cfg });

test("فاتورة شهر كامل: السطر = سعر البيع، الضريبة على المجموع (أرقام اختبار 15%)", () => {
  const r = inv([PL("a")], [TS("a")]);
  assert.equal(r.status, "ok");
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].amountHalalas, 669166);
  assert.equal(r.subtotalHalalas, 669166);
  assert.equal(r.vatHalalas, halfUp(669166 * 15, 100));      // 100374.9 → 100375
  assert.equal(r.vatHalalas, 100375);
  assert.equal(r.totalHalalas, 669166 + 100375);
  assert.equal(r.currency, "SAR"); assert.equal(r.period, "2026-10");
});

test("حضور جزئي: 15 من 30 ⇒ نصف السعر، و17 من 30 ⇒ نصف لأعلى", () => {
  assert.equal(inv([PL("a")], [TS("a", { approvedDays: 15 })]).lines[0].amountHalalas, 334583);
  assert.equal(inv([PL("a")], [TS("a", { approvedDays: 17 })]).lines[0].amountHalalas, 379194);       // 379194.07
  assert.equal(inv([PL("a", { saleMonthlyHalalas: 1 })], [TS("a", { approvedDays: 15 })]).lines[0].amountHalalas, 1);   // 0.5 ⇒ 1
  assert.equal(inv([PL("a")], [TS("a", { approvedDays: 0 })]).lines[0].amountHalalas, 0, "صفر أيام = سطر بصفر لا استبعاد");
  assert.equal(inv([PL("a")], [TS("a", { approvedDays: 22.5 })]).lines[0].approvedDaysHundredths, 2250);
});

test("الضريبة على المجموع لا على كل سطر: ثلاثة أسطر بـ10 هللات ⇒ ضريبة 5 لا 6", () => {
  const r = inv([PL("a", { saleMonthlyHalalas: 10 }), PL("b", { saleMonthlyHalalas: 10 }), PL("c", { saleMonthlyHalalas: 10 })], [TS("a"), TS("b"), TS("c")]);
  assert.equal(r.subtotalHalalas, 30);
  assert.equal(r.vatHalalas, 5);                       // 4.5 ⇒ 5 ؛ لو لكل سطر: 3 × round(1.5) = 6
  assert.equal(r.totalHalalas, 35);
  assert.notEqual(r.vatHalalas, 3 * halfUp(10 * 15, 100));
});

test("مجموع عدة موظفين وفاتورة بلا أسطر ممكنة (مجموع صفر)", () => {
  const r = inv([PL("a"), PL("b", { saleMonthlyHalalas: 500000 })], [TS("a", { approvedDays: 30 }), TS("b", { approvedDays: 15 })]);
  assert.equal(r.subtotalHalalas, 669166 + 250000);
  const empty = inv([], []);
  assert.equal(empty.status, "ok");
  assert.deepEqual([empty.lines, empty.subtotalHalalas, empty.vatHalalas, empty.totalHalalas], [[], 0, 0, 0]);
});

test("لا تايم شيت معتمد ⇒ لا مبلغ: مسودة/مقدَّم/مُرجَع/غائب تذهب إلى excluded بسببها", () => {
  const r = inv([PL("a"), PL("b"), PL("c"), PL("d"), PL("e")], [TS("a", { status: "draft" }), TS("b", { status: "submitted" }), TS("c", { status: "rejected" }), TS("d")]);
  assert.deepEqual(r.lines.map((l) => l.placementId), ["d"]);
  assert.deepEqual(r.excluded.map((x) => [x.placementId, x.reason]), [["a", "timesheet_not_approved"], ["b", "timesheet_not_approved"], ["c", "timesheet_not_approved"], ["e", "no_timesheet"]]);
  assert.equal(r.excluded[0].timesheetStatus, "draft");
});

test("تايم شيت شهرٍ آخر لا يُحتسب، ومكرَّر الشهر نفسه مرفوض", () => {
  const other = inv([PL("a")], [TS("a", { period: "2026-09" })]);
  assert.equal(other.lines.length, 0);
  assert.equal(other.excluded[0].reason, "no_timesheet");
  const dup = inv([PL("a")], [TS("a"), TS("a", { approvedDays: 1 })]);
  assert.equal(dup.status, "invalid_input");
  assert.ok(dup.errors.some((e) => e.error === "duplicate_timesheet"));
});

test("أيام تتجاوز المتفق عليه ⇒ استبعاد للمراجعة لا قصّ صامت ولا مبلغ زائد", () => {
  const r = inv([PL("a")], [TS("a", { approvedDays: 31 })]);
  assert.equal(r.lines.length, 0);
  assert.deepEqual(r.excluded[0], { placementId: "a", reason: "days_exceed_agreed", approvedDaysHundredths: 3100, agreedDays: 30 });
});

test("المرحلة غير القابلة للفوترة وسعر البيع المعلّق يُستبعدان", () => {
  const r = inv([PL("a", { stage: "ready" }), PL("b", { stage: "on_hold" }), PL("c", { saleMonthlyHalalas: null }), PL("d", { stage: "offboarding" }), PL("e", { stage: undefined })], [TS("a"), TS("b"), TS("c"), TS("d"), TS("e")]);
  assert.deepEqual(r.lines.map((l) => l.placementId), ["d", "e"]);
  assert.deepEqual(r.excluded.map((x) => x.reason), ["not_billable_stage", "not_billable_stage", "sale_price_pending"]);
});

test("أيام الشهر المتفق عليها من الموضع تغلب الإعداد، وغيابهما معاً ⇒ pending_pricing", () => {
  const own = inv([PL("a", { agreedDays: 26 })], [TS("a", { approvedDays: 13 })], { agreedMonthDays: null });
  assert.equal(own.status, "ok");
  assert.equal(own.lines[0].amountHalalas, 334583);
  const none = inv([PL("a")], [TS("a", { approvedDays: 13 })], { agreedMonthDays: null });
  assert.deepEqual(none, { status: "pending_pricing", missing: ["config.agreed_month_days"] });
  const unused = inv([PL("a", { stage: "ready" })], [], { agreedMonthDays: null });
  assert.equal(unused.status, "ok", "لا حاجة لأيام الشهر إن لم يُفوتَر شيء");
});

test("الضريبة أو العملة null ⇒ pending_pricing بلا أسطر ولا أرقام", () => {
  for (const [over, field] of [[{ vatRate: null }, "config.vat_rate"], [{ currency: null }, "config.currency"]]) {
    const r = inv([PL("a")], [TS("a")], over);
    assert.deepEqual(r, { status: "pending_pricing", missing: [field] });
  }
  assert.equal(inv([PL("a")], [TS("a")], { vatRate: 15 }).status, "invalid_input");
  assert.equal(inv([PL("a")], [TS("a")], { vatRate: 0 }).vatHalalas, 0, "ضريبة صفر صريحة صالحة");
});

test("الحضور بالساعات والأيام معاً من الإدخالات: 8 ساعات = يوم، وساعات-اليوم من الإعداد", () => {
  const day = (d, x) => ({ date: `2026-10-${String(d).padStart(2, "0")}`, ...x });
  const entries = [day(1, { days: 1 }), day(2, { days: 0.5 }), day(3, { hours: 8 }), day(4, { hours: 4 }), day(5, { days: 0 })];
  const r = inv([PL("a")], [{ placementId: "a", period: "2026-10", status: "approved", entries }]);
  assert.equal(r.status, "ok");
  assert.equal(r.lines[0].approvedDaysHundredths, 100 + 50 + 100 + 50);
  assert.equal(r.lines[0].amountHalalas, halfUp(669166 * 300, 3000));
  const noHpd = inv([PL("a")], [{ placementId: "a", period: "2026-10", status: "approved", entries }], { hoursPerDay: null });
  assert.deepEqual(noHpd, { status: "pending_pricing", missing: ["config.hours_per_day"] });
  const onlyDays = inv([PL("a")], [{ placementId: "a", period: "2026-10", status: "approved", entries: [day(1, { days: 1 })] }], { hoursPerDay: null });
  assert.equal(onlyDays.status, "ok");
});

test("إدخالات حضور فاسدة مرفوضة: تاريخ خارج الشهر، مكرَّر، أيام وساعات معاً، قيمة خارج المدى", () => {
  const run = (entries) => inv([PL("a")], [{ placementId: "a", period: "2026-10", status: "approved", entries }]);
  const errs = (r) => r.errors.map((e) => e.error);
  assert.ok(errs(run([{ date: "2026-09-30", days: 1 }])).includes("outside_period"));
  assert.ok(errs(run([{ date: "2026-10-01", days: 1 }, { date: "2026-10-01", days: 1 }])).includes("duplicate_date"));
  assert.ok(errs(run([{ date: "2026-10-01", days: 1, hours: 8 }])).includes("days_xor_hours"));
  assert.ok(errs(run([{ date: "2026-10-01" }])).includes("days_xor_hours"));
  assert.ok(errs(run([{ date: "2026-10-01", days: 1.5 }])).includes("out_of_range"));
  assert.ok(errs(run([{ date: "2026-10-01", hours: 25 }])).includes("out_of_range"));
  assert.ok(errs(run([{ date: "2026-10-01", days: 0.333 }])).includes("out_of_range"));
  assert.equal(run([{ date: "2026-10-01", days: 1 }]).status, "ok");
});

test("مدخلات الفاتورة الهيكلية: فترة غير صالحة، مصفوفات مفقودة، موضع بلا معرّف أو مكرَّر، سعر غير هللات", () => {
  assert.equal(C.monthlyInvoiceLines([], [], { ...CFG, period: "2026-13" }).status, "invalid_input");
  assert.equal(C.monthlyInvoiceLines([], [], { ...CFG, period: undefined }).status, "invalid_input");
  assert.equal(C.monthlyInvoiceLines(null, [], CFG).status, "invalid_input");
  assert.equal(C.monthlyInvoiceLines([], null, CFG).status, "invalid_input");
  assert.equal(inv([{ saleMonthlyHalalas: 1 }], []).status, "invalid_input");
  assert.equal(inv([PL("a"), PL("a")], [TS("a")]).status, "invalid_input");
  assert.equal(inv([PL("a", { saleMonthlyHalalas: 12.5 })], [TS("a")]).status, "invalid_input");
  assert.equal(inv([PL("a")], [TS("a", { status: "weird" })]).status, "invalid_input");
});

test("أسطر الفاتورة لا تحمل اسماً ولا تكلفة ولا هامشاً (تُعرض للعميل)", () => {
  const r = inv([PL("a", { costSheet: { marginHalalas: 60833 }, candidateName: "اسم اختباري" })], [TS("a")]);
  const json = JSON.stringify(r);
  for (const m of json.matchAll(/"([^"]+)":/g)) assert.ok(!/margin|markup|salary|vendor|cost|name|contact/i.test(m[1]), `مفتاح: ${m[1]}`);
  assert.ok(!json.includes("60833") && !json.includes("اسم اختباري"));
  assert.deepEqual(Object.keys(r.lines[0]), ["placementId", "saleMonthlyHalalas", "approvedDaysHundredths", "agreedDays", "amountHalalas"]);
});

test("تدفق كامل: ورقة التكلفة ← فاتورة الشهر (أرقام اختبار) ومقارنة بحساب مستقل", () => {
  const s = sheet();
  const r = inv([PL("w1", { saleMonthlyHalalas: s.saleMonthlyHalalas })], [TS("w1", { approvedDays: 24 })]);
  const line = halfUp(669166 * 2400, 3000);                  // 24/30
  assert.equal(r.lines[0].amountHalalas, line);
  assert.equal(r.lines[0].amountHalalas, 535333);            // 669166 × 0.8 = 535332.8
  assert.equal(r.totalHalalas, 535333 + halfUp(535333 * 15, 100));
});

/* ═════════════ اتساق القاعدة والكود ═════════════ */
test("حالات التايم شيت في الكود = قيد SQL، وحالات ورقة التكلفة موافقة", () => {
  const m = SQL.match(/create table if not exists eor_timesheets \([\s\S]*?status text not null default 'draft' check \(status in \(([^)]*)\)\)/);
  assert.ok(m, "لم يُعثر على قيد حالة التايم شيت");
  assert.deepEqual([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]), [...C.TIMESHEET_STATUSES]);
  assert.match(SQL, /eor_cost_sheets[\s\S]*?status text not null check \(status in \('ok','pending_pricing'\)\)/);
  assert.match(SQL, /rounding text not null default 'half_up_per_line'/);
  assert.equal(C.ROUNDING_MODE, "half_up_per_line");
  assert.deepEqual([...C.COST_VISIBILITY], ["total", "breakdown"]);
  assert.match(SQL, /cost_visibility in \('total','breakdown'\)/);
});
