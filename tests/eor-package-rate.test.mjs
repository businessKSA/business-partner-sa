// حاسبة سعر الحزمة الشهري للموظف (صيغ إكسل المالك «Salary vs Rate Hospitality») — api/_eor-cost.js + estimatePackageQuote في api/_eor.js.
// المرجع: docs/hr-pricing-calculator-spec.md · العيّنة: tests/fixtures/hr-pricing-sheet.json (١٠١ صفاً من الورقة ١ بخطوة ١٠٠٠).
// الصيغة في الاختبار مكتوبة مرة ثانية حرفياً (مستقلة عن الكود) كي لا يُقارَن الحساب بنفسه.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-pkg-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { stripCat, cfgFromHtml } = await import("./eor-test-util.mjs");
const C = await import("../api/_eor-cost.js");
const E = await import("../api/_eor.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/hr-pricing-sheet.json"), "utf8"));
const CFG = C.packageRateConfigFromPricing(PRICING);
const NOW = Date.parse("2026-10-09T09:00:00Z");
const clone = (o) => JSON.parse(JSON.stringify(o));

// صيغ المالك حرفياً (عمود E ثم B ثم C ثم D) — مستقلة عن الكود.
const sheetCost = (P) => P + (9700 + 650 + 240) / 12 + 600 / 12 + (P / 30 * 21) / 12 + 200 / 12 + 3000 / 12 + P / 2 / 12 + P * 0.02 + 900;
const sheetRate = (P) => sheetCost(P) / (1 - 0.10);
const sheetMround = (x) => Math.floor(x / 10 + 0.5 + 1e-9) * 10;
const lump = (P, cfg = CFG) => C.computePackageRate({ mode: "lump", package: P, config: cfg });

/* ═════════════ الورقة ١ (Lump sum) ═════════════ */
test("fixture الورقة: التكلفة والسعر الخام وساعة الإضافي يطابقون الورقة لكل صفوف العيّنة", () => {
  assert.equal(FIX.lumpSum.length, 101);
  for (const row of FIX.lumpSum) {
    const r = lump(row.package);
    assert.equal(r.status, "ok", String(row.package));
    assert.ok(Math.abs(r.internal.cost - row.cost) < 0.006, `cost @${row.package}: ${r.internal.cost} vs ${row.cost}`);
    assert.ok(Math.abs(r.internal.rate - row.rate) < 0.006, `rate @${row.package}`);
    assert.ok(Math.abs(r.otHour - row.otPerHour) < 0.006, `ot @${row.package}`);
  }
});

test("التقريب بـMROUND (أقرب 10، النصف للأعلى) لا بالقيم الملصوقة المعروضة في الورقة", () => {
  let differ = 0;
  for (const row of FIX.lumpSum) {
    const r = lump(row.package);
    assert.equal(r.billable, sheetMround(row.rate), `billable @${row.package}`);
    assert.equal(r.billable % 10, 0);
    if (r.billable !== row.billableInSheet) { differ++; assert.equal(row.billableInSheet - r.billable, 10, `الملصوق أعلى بـ10 فقط @${row.package}`); }
  }
  // في العيّنة 11 صفاً يعرض فيها الإكسل القيمة الملصوقة أعلى بـ10 من MROUND (المواصفة: 111 من 997) — الصيغة هي المرجع.
  assert.equal(differ, 11);
  assert.equal(lump(1400).billable, 4070);        // الورقة تعرض 4080
  assert.equal(lump(1400).internal.rate, 4074.63);
});

test("٩٩٧ صفاً (٤٠٠ إلى ١٠٠٬٠٠٠ بخطوة ١٠٠): التكلفة = ١٫١٢·P + ٢٠٩٩٫١٧، والسعر مضاعف ١٠ وضمن ±٥ من الخام", () => {
  let n = 0;
  for (let P = 400; P <= 100000; P += 100) {
    n++;
    const r = lump(P);
    assert.equal(r.status, "ok");
    assert.ok(Math.abs(r.internal.cost - (1.12 * P + 2099.1666667)) < 0.006, `cost ${P}`);
    assert.equal(r.billable, sheetMround(sheetRate(P)), `billable ${P}`);
    assert.ok(Math.abs(r.billable - sheetRate(P)) <= 5 + 1e-6);
    assert.ok(Math.abs(r.otHour - P * 0.0075) < 0.006);
  }
  assert.equal(n, 997);
});

test("مثال المواصفة: راتب 2000 ⇒ تكلفة 4339.17 وسعر خام 4821.3 وسعر 4820 وإضافي 15 (لا 4397.5 الجدول الجانبي)", () => {
  const r = lump(2000);
  assert.equal(r.internal.cost, 4339.17);
  assert.equal(r.internal.rate, 4821.3);
  assert.equal(r.billable, 4820);
  assert.equal(r.otHour, 15);
  assert.equal(r.mode, "lump");
  assert.equal(r.pendingDecision, false);
  assert.equal(r.currency, "SAR");
  assert.equal(r.internal.lines.government, 882.5);
  assert.equal(r.internal.lines.insurance, 50);
  assert.equal(r.internal.lines.joining, 250);
  assert.equal(r.internal.lines.overhead, 900);
});

test("MROUND: النصف للأعلى، وضجيج الفاصلة العائمة لا يُسقِط", () => {
  assert.equal(C.mround(25, 10), 30);
  assert.equal(C.mround(24.99, 10), 20);
  assert.equal(C.mround(4074.63, 10), 4070);
  assert.equal(C.mround(4075, 10), 4080);
  assert.equal(C.mround(0.1 + 0.2 + 4.7, 10), 10);       // 4.999999999… ⇒ 5 ⇒ 10 (كما يفعل الإكسل بالنصف)
  assert.throws(() => C.mround(5, 0), RangeError);
});

/* ═════════════ كل رقم من الإعداد لا من الكود ═════════════ */
test("تغيير الهامش أو المصاريف في الإعداد يغيّر السعر (لا ثابت مالي مدفون في الكود)", () => {
  const p1 = clone(PRICING); p1.package_rate.lump.margin_on_price = 0.20;
  const a = lump(2000, C.packageRateConfigFromPricing(p1));
  assert.equal(a.billable, sheetMround(sheetCost(2000) / 0.8));
  const p2 = clone(PRICING); p2.package_rate.lump.overhead_monthly = 1000;
  assert.equal(lump(2000, C.packageRateConfigFromPricing(p2)).internal.cost, 4439.17);
  const p3 = clone(PRICING); p3.package_rate.lump.mround_step = 50;
  assert.equal(lump(2000, C.packageRateConfigFromPricing(p3)).billable % 50, 0);
  const p4 = clone(PRICING); p4.package_rate.lump.overtime.multiplier = 2;
  assert.equal(lump(2000, C.packageRateConfigFromPricing(p4)).otHour, 2000 / 240 * 2 * 1.2);
  // لا أرقام الإكسل حرفياً داخل منطق الحاسبة (القيم في ملف الإعداد)
  const src = fs.readFileSync(path.join(ROOT, "api/_eor-cost.js"), "utf8");
  const calc = src.slice(src.indexOf("export const PACKAGE_MODES"));
  for (const lit of ["9700", "650", "240", "882.5", "3600", "0.9", "0.8", "542", "900"]) assert.equal(new RegExp(`(?<![\\d.])${lit.replace(".", "\\.")}(?![\\d])`).test(calc.replace(/\/\/.*$/gm, "")), false, "ثابت " + lit);
});

test("بنود قرار المالك مفاتيح إعداد بقيمة افتراضية = العمود الرئيسي، ومعلَّمة _owner_decision في الملف", () => {
  const L = PRICING.package_rate.lump;
  assert.equal(L.annual_leave.included_in_cost, true);
  assert.equal(L.joining.included_in_cost, true);
  assert.equal(L.joining.visa_and_joining_yearly, 3000);
  assert.equal(L.return_ticket_yearly, 0);
  for (const node of [L.annual_leave, L.joining]) assert.ok(typeof node._owner_decision === "string" && node._owner_decision.length > 20);
  assert.ok(String(L._return_ticket_yearly).includes("_owner_decision"));
  assert.ok(String(PRICING.package_rate.costplus._owner_decision).length > 20);
  assert.equal(PRICING.package_rate.costplus._status, "pending_decision");

  // الإجازة كفوترة منفصلة: تخرج من التكلفة وتظهر في internal.separate
  const p = clone(PRICING); p.package_rate.lump.annual_leave.included_in_cost = false;
  const r = lump(2000, C.packageRateConfigFromPricing(p));
  assert.equal(r.internal.lines.annualLeave, 0);
  assert.equal(r.internal.separate.annualLeaveMonthlyEquivalent, 116.67);
  assert.ok(r.billable < lump(2000).billable);
  // الانضمام كفوترة منفصلة
  const p2 = clone(PRICING); p2.package_rate.lump.joining.included_in_cost = false;
  const r2 = lump(2000, C.packageRateConfigFromPricing(p2));
  assert.equal(r2.internal.lines.joining, 0);
  assert.equal(r2.internal.separate.joiningMonthlyEquivalent, 250);
  // التأشيرة 3600 بدل 3000 وتذكرة العودة 1500: تغيير إعداد لا كود
  const p3 = clone(PRICING); p3.package_rate.lump.joining.visa_and_joining_yearly = 3600; p3.package_rate.lump.return_ticket_yearly = 1500;
  assert.equal(lump(2000, C.packageRateConfigFromPricing(p3)).internal.cost, 4339.17 + 50 + 125);
});

/* ═════════════ الورقة ٢ (Cost plus) — pending_decision ═════════════ */
test("costplus: معلَّم pending_pricing/pending_decision، بالتعريف المبسّط (1.02P+542)/0.8 وتنبيه صريح، للمالك داخلياً", () => {
  const r = C.computePackageRate({ mode: "costplus", package: 2000, config: CFG });
  assert.equal(r.status, "ok");
  assert.equal(r.pendingDecision, true);
  assert.ok(r.warnings.includes("costplus_definition_pending_owner_decision"));
  assert.ok(r.warnings.includes("simplified_costplus_cost_definition"));
  assert.equal(r.internal.cost, 2582);                       // 2000·1.02 + 542
  assert.equal(r.internal.rate, 3227.5);                     // /0.8
  assert.equal(r.billable, C.mround(3227.5, 10));
  assert.equal(r.billable, 3230);
  // الحاسبة الأخرى لا تُعلِّم lump كمعلّق
  assert.equal(lump(2000).pendingDecision, false);
});

/* ═════════════ ما يراه العميل ═════════════ */
test("العميل يرى السعر الشهري وساعة الإضافي فقط: قائمة مفاتيح ثابتة، لا تكلفة ولا هامش ولا ربح ولا خام ولا internal", () => {
  const view = C.packageClientView(lump(2000), CFG);
  assert.deepEqual(view, { status: "ok", currency: "SAR", monthlyPrice: 4820, otHour: 15 });
  const text = JSON.stringify(view);
  for (const w of ["cost", "margin", "profit", "rate", "internal", "markup", "overhead", "lines", "package", "warnings", "pending"]) assert.equal(text.includes(w), false, w);
  // ومن الصيغة حتى طبقة الـAPI: لا قيمة التكلفة ولا الهامش في ردّ العميل
  assert.equal(text.includes("4339"), false);
  assert.equal(text.includes("4821"), false);
});

test("costplus لا يصل العميل افتراضياً (client_visible=false)، ويصله فقط إن فتحه المالك؛ والإغلاق الكلي يُخفي lump أيضاً", () => {
  const cp = C.computePackageRate({ mode: "costplus", package: 2000, config: CFG });
  assert.deepEqual(C.packageClientView(cp, CFG), { status: "pending_pricing" });
  const open = clone(PRICING); open.package_rate.costplus.client_visible = true;
  assert.equal(C.packageClientView(cp, C.packageRateConfigFromPricing(open)).status, "ok");
  const shut = clone(PRICING); shut.package_rate.client_price_visible = false;
  assert.deepEqual(C.packageClientView(lump(2000), C.packageRateConfigFromPricing(shut)), { status: "pending_pricing" });
  // أي حالة غير ok ⇒ pending وحدها بلا missing
  for (const bad of [null, undefined, {}, { status: "pending_pricing", missing: ["x"] }, { status: "invalid_input", errors: [] }]) assert.deepEqual(C.packageClientView(bad, CFG), { status: "pending_pricing" });
});

/* ═════════════ الإدخال والإعداد الناقص ═════════════ */
test("إدخال فاسد ⇒ invalid_input، وإعداد ناقص ⇒ pending_pricing مع missing بلا رقم", () => {
  for (const P of [0, -5, NaN, Infinity, "2000", null, undefined, 2_000_000]) assert.equal(C.computePackageRate({ mode: "lump", package: P, config: CFG }).status, "invalid_input", String(P));
  assert.equal(C.computePackageRate({ mode: "other", package: 2000, config: CFG }).status, "invalid_input");
  assert.equal(C.computePackageRate({ package: 2000, config: CFG }).status, "invalid_input");
  assert.equal(C.computePackageRate(null).status, "invalid_input");
  assert.deepEqual(C.computePackageRate({ mode: "lump", package: 2000, config: null }), { status: "pending_pricing", missing: ["config.package_rate"] });
  assert.equal(C.packageRateConfigFromPricing({}), null);
  assert.equal(C.packageRateConfigFromPricing(null), null);
  const p = clone(PRICING); delete p.package_rate.lump.overhead_monthly; p.package_rate.lump.margin_on_price = null; p.package_rate.currency = null;
  const r = lump(2000, C.packageRateConfigFromPricing(p));
  assert.equal(r.status, "pending_pricing");
  assert.ok(r.missing.includes("lump.overhead_monthly") && r.missing.includes("lump.margin_on_price") && r.missing.includes("package_rate.currency"));
  assert.equal("billable" in r, false);
  // هامش 100% = قسمة على صفر ⇒ مرفوض لا Infinity
  const p2 = clone(PRICING); p2.package_rate.lump.margin_on_price = 1;
  assert.equal(lump(2000, C.packageRateConfigFromPricing(p2)).status, "invalid_input");
  // خارج نافذة الصلاحية
  assert.deepEqual(C.computePackageRate({ mode: "lump", package: 2000, config: { ...CFG, validUntil: "2026-09-30", today: "2026-10-09" } }), { status: "pending_pricing", missing: ["config.valid_window"] });
});

test("السعر المقرَّب نفسه يغذّي الفاتورة الشهرية (هللات) عبر packageSaleMonthlyHalalas", () => {
  const sale = C.packageSaleMonthlyHalalas(lump(2000));
  assert.equal(sale, 482000);
  assert.equal(C.packageSaleMonthlyHalalas({ status: "pending_pricing" }), null);
  const inv = C.monthlyInvoiceLines(
    [{ id: "p1", stage: "active", saleMonthlyHalalas: sale }],
    [{ placementId: "p1", period: "2026-10", status: "approved", approvedDays: 30 }],
    { period: "2026-10", currency: "SAR", vatRate: 0.15, agreedMonthDays: 30 },
  );
  assert.equal(inv.status, "ok");
  assert.equal(inv.lines[0].amountHalalas, 482000);
});

/* ═════════════ estimatePackageQuote (السعر الفوري في طلب EOR) ═════════════ */
const IT = (count, nationalities, salary) => ({ occupationId: "hosp.waiter", count, nationalities, salary });

test("estimatePackageQuote: أجنبي براتب ⇒ سعر شهري للموظف × العدد، والمدة معلومة فقط لا تدخل الحساب", () => {
  const q12 = E.estimatePackageQuote([IT(3, ["IN"], 2000)], PRICING, { workerType: "foreign", durationMonths: 12, now: NOW });
  const q36 = E.estimatePackageQuote([IT(3, ["IN"], 2000)], PRICING, { workerType: "foreign", durationMonths: 36, now: NOW });
  assert.equal(q12.status, "ok");
  assert.equal(q12.currency, "SAR");
  assert.equal(q12.lines[0].monthlyPerEmployee, 4820);
  assert.equal(q12.lines[0].otHour, 15);
  assert.equal(q12.lines[0].monthlyTotal, 14460);
  assert.equal(q12.monthlyTotal, 14460);
  assert.equal(q12.durationMonths, 12);
  assert.equal(q36.monthlyTotal, q12.monthlyTotal);          // 12/24/36 خارج الحساب
  assert.equal(q12.notice, "estimate_not_an_offer");
  const leak = JSON.stringify(q12);
  for (const w of ["cost", "margin", "profit", "internal", "rate\"", "4339", "4821"]) assert.equal(leak.includes(w), false, w);
});

test("estimatePackageQuote: بلا راتب/مختلط/غير محسوم لا رقم مخمَّن، والسعودي يُسعَّر بمساره (الشريحة ب)، والبنود المختلطة partial", () => {
  const q = E.estimatePackageQuote([IT(1, ["IN"], 2000), IT(2, ["IN"], null), IT(1, ["SA"], 5000), IT(1, ["SA", "IN"], 5000), IT(1, [], 2500)], PRICING, { workerType: "both", now: NOW });
  assert.equal(q.status, "partial");
  assert.deepEqual(q.lines.map((l) => l.status), ["priced", "needs_salary", "priced", "needs_review", "needs_review"]);
  assert.equal(q.lines[2].monthlyPerEmployee, 7880, "سعودي 5000: تكلفة 7087.5 ÷ 0.9 = 7875 ⇒ MROUND 10");
  assert.equal(q.monthlyTotal, 4820 + 7880);
  for (const l of [q.lines[1], q.lines[3], q.lines[4]]) assert.equal("monthlyPerEmployee" in l, false, "المختلط لا يُسعَّر إلا بتقسيم البند");
  // مفتاح الإغلاق: saudi.enabled=false يعيد السعودي إلى «بعد المراجعة»
  const off = clone(PRICING); off.package_rate.saudi.enabled = false;
  const saudi = E.estimatePackageQuote([IT(1, [], 5000)], off, { workerType: "saudi", now: NOW });
  assert.equal(saudi.status, "none");
  assert.equal(saudi.lines[0].status, "not_applicable");
  assert.equal("monthlyTotal" in saudi, false);
  const nob = clone(PRICING); delete nob.package_rate.saudi;
  assert.equal(E.estimatePackageQuote([IT(1, [], 5000)], nob, { workerType: "saudi", now: NOW }).lines[0].status, "not_applicable");
});

test("estimatePackageQuote: بلا إعداد/مغلق/خارج الصلاحية/قائمة فارغة ⇒ { status:'pending_pricing' } فقط", () => {
  const args = [[IT(1, ["IN"], 2000)]];
  const o = { workerType: "foreign", now: NOW };
  assert.deepEqual(E.estimatePackageQuote(...args, null, o), { status: "pending_pricing" });
  assert.deepEqual(E.estimatePackageQuote(...args, {}, o), { status: "pending_pricing" });
  assert.deepEqual(E.estimatePackageQuote([], PRICING, o), { status: "pending_pricing" });
  const shut = clone(PRICING); shut.package_rate.client_price_visible = false;
  assert.deepEqual(E.estimatePackageQuote(...args, shut, o), { status: "pending_pricing" });
  const exp = clone(PRICING); exp.valid_until = "2026-09-30";
  assert.deepEqual(E.estimatePackageQuote(...args, exp, o), { status: "pending_pricing" });
  const half = clone(PRICING); delete half.package_rate.lump.overhead_monthly;
  assert.deepEqual(E.estimatePackageQuote(...args, half, o), { status: "pending_pricing" });
});

test("estimateQuote الحالي لم يتغيّر: الملف المرفق ما زال يرجع pending_pricing لرسوم الخدمة (لا رقم من package_rate)", () => {
  assert.deepEqual(E.estimateQuote([IT(2, ["IN"], 2000)], PRICING, { workerType: "foreign", recruitment: "no", durationMonths: 12, now: NOW }), { status: "pending_pricing" });
});

/* ═════════════ نقطة الإرسال: action = price ═════════════ */
test("handleEor action=price: يرجع سعر العميل فقط، بلا كتابة ولا بريد ولا تنبيه", async () => {
  let wrote = 0;
  const ctx = { now: NOW, ip: "", fetch: async () => { wrote++; return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" }; }, sendEmail: async () => { wrote++; return { ok: true }; }, notify: async () => { wrote++; return { ok: true }; }, notionToken: "t" };
  const r = await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 2, nationalities: ["IN"], salary: "2,000" }] }, ctx);
  assert.equal(r.ok, true);
  assert.equal(r.quote.status, "ok");
  assert.equal(r.quote.lines[0].monthlyPerEmployee, 4820);
  assert.equal(r.quote.monthlyTotal, 9640);
  assert.equal(wrote, 0);
  assert.deepEqual(Object.keys(r).sort(), ["ok", "quote"]);
  // سعودي ⇒ لا سعر
  const s = await E.handleEor({ action: "price", workerType: "saudi", items: [{ count: 1, salary: 3000 }] }, ctx);
  assert.equal(s.quote.status, "none");
  // pricing=null ⇒ pending
  const n = await E.handleEor({ action: "price", workerType: "foreign", items: [{ count: 1, nationalities: ["IN"], salary: 2000 }] }, { ...ctx, pricing: null });
  assert.deepEqual(n, { ok: true, quote: { status: "pending_pricing" } });
});

test("handleEor action=price: مدخلات فاسدة تُرفض 400 بلا استثناء", async () => {
  const H = (b) => E.handleEor(b, { now: NOW, ip: "" });
  assert.equal((await H({ action: "price", workerType: "x", items: [{ count: 1 }] })).error, "worker_type_invalid");
  assert.equal((await H({ action: "price", workerType: "foreign" })).error, "items_required");
  assert.equal((await H({ action: "price", workerType: "foreign", items: [] })).error, "items_required");
  assert.equal((await H({ action: "price", workerType: "foreign", items: Array.from({ length: 21 }, () => ({ count: 1 })) })).error, "too_many_items");
  assert.equal((await H({ action: "price", workerType: "foreign", items: [{ count: 0 }] })).error, "item_count_invalid");
  assert.equal((await H({ action: "price", workerType: "foreign", items: [{ count: 1, salary: -1 }] })).error, "salary_invalid");
  assert.equal((await H({ action: "price", workerType: "foreign", items: [{ count: 1, salary: 999999 }] })).error, "salary_invalid");
  assert.equal((await H({ action: "price", workerType: "foreign", items: [{ count: 1, nationalities: ["ZZ"] }] })).error, "nationality_unknown");
  assert.equal((await H({ action: "price", workerType: "foreign", items: ["x"] })).error, "item_invalid");
  assert.equal((await H({ action: "price", workerType: "foreign", items: [{ count: 1, salary: 2000 }], durationMonths: "abc" })).ok, true);
});

test("الطلب الكامل: سطر سعر الحزمة يُضاف لعمود «تقدير عرض السعر» للفريق، والردّ للعميل { ok, ref } وحده", async () => {
  const calls = [];
  const ctx = {
    dev: false, notionToken: "secret_test", dbId: "db-test", now: NOW, ip: "", refGen: () => "EOR-123456",
    fetch: async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
    sendEmail: async () => ({ ok: true }), notify: async () => ({ ok: true }), teamEmail: "t@test.local", ownerEmail: "o@test.local",
  };
  const body = { company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض", workerType: "foreign", recruitment: "no",
    items: [{ occupationId: "hosp.waiter", count: 2, nationalities: ["IN"], salary: 2000 }], startDate: "2026-11-01", durationMonths: 12, lang: "ar" };
  const r = await E.handleEor(body, { ...ctx, pricing: PRICING });
  assert.deepEqual(r, { ok: true, ref: "EOR-123456" });
  const txt = calls[0].properties["تقدير عرض السعر"].rich_text[0].text.content;
  assert.match(txt, /^pending_pricing \| سعر الحزمة .*شهري 9640 SAR/);
  // لا راتب → لا سطر
  const r2 = await E.handleEor({ ...body, items: [{ occupationId: "hosp.waiter", count: 2, nationalities: ["IN"] }] }, { ...ctx, pricing: PRICING });
  assert.equal(r2.ok, true);
  assert.equal(calls[1].properties["تقدير عرض السعر"].rich_text[0].text.content, "pending_pricing");
});

test("api/_eor-cost.js ملف مساعد (يبدأ بـ_): لا ملف api/ جديد، والسقف ١٢ دالة", () => {
  const files = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  assert.ok(files.length <= 12, `${files.length} دالة`);
});

/* ═════════════ لا ربح ولا تكلفة ولا هامش أمام العميل (أمر المالك 2026-10-08) — انحدار بقيم فريدة (canaries) ═════════════ */
// قيم إعداد فريدة لا تتصادف مع أي رقم عادي في ردّ أو صفحة؛ وأرقام التكلفة/الربح تُشتقّ من الحاسبة الداخلية نفسها.
const CANARY = clone(PRICING);
Object.assign(CANARY, { currency: "SAR", vat_rate: 0.15, service_fee_monthly_per_employee: { saudi: 401.01, foreign: 301.01 }, recruitment_fee_per_employee: { saudi: 1001.01, foreign: 2501.01 } });
CANARY.cost = { margin_rate: 0.31337, end_of_service_accrual: { percent_of_salary: 0.04243, fixed_monthly: null }, leave_accrual: { percent_of_salary: 0.05151, fixed_monthly: null }, agreed_month_days: 29, hours_per_day: 7, client_cost_visibility: "total" };
Object.assign(CANARY.package_rate.lump, { margin_on_price: 0.13579, overhead_monthly: 912.3456, insurance_yearly: 611.2233, end_of_service_months_per_year: 0.54321 });
CANARY.package_rate.lump.annual_government_fees = { residence: 9701.7777, work_permit: 651.8888, ajeer: 241.9999 };
CANARY.package_rate.costplus.fixed_monthly = 543.2468;
const CANARY_CFG = C.packageRateConfigFromPricing(CANARY);

// كل ما يحمل قيمة الإعداد الفريدة أو ناتجاً داخلياً منها أو اسم مفتاح داخلي
function secretsFor() {
  const inner = lump(2750, CANARY_CFG), cp = C.computePackageRate({ mode: "costplus", package: 2750, config: CANARY_CFG });
  const nums = [912.3456, 611.2233, 0.13579, 0.31337, 0.54321, 9701.7777, 651.8888, 241.9999, 543.2468, 0.04243, 0.05151,
    inner.internal.cost, inner.internal.rate, inner.internal.profit, inner.internal.markup, cp.internal.cost, cp.internal.rate, cp.internal.profit]
    .map((n) => String(n));
  const marg = String(inner.internal.margin).slice(0, 8);
  return { nums: [...nums, marg], inner, cp };
}
const KEYS_RE = /margin_on_price|marginOnPrice|margin_rate|marginRate|marginHalalas|overhead_monthly|package_rate|packageRate|markup|profit|"internal"|costMonthly|saleMonthly|mround_step|annual_government_fees|end_of_service_accrual|clientPriceVisible|client_price_visible|costplus|pendingDecision/;
const assertClean = (label, text, secrets) => {
  for (const n of secrets.nums) assert.equal(text.includes(n), false, `${label}: قيمة داخلية ${n}`);
  const m = text.match(KEYS_RE);
  assert.equal(m, null, `${label}: مفتاح داخلي ${m && m[0]}`);
};

test("canaries: الحاسبة الداخلية تحمل القيم فعلاً (حتى لا يمرّ الاختبار فارغاً)", () => {
  const { inner, cp, nums } = secretsFor();
  assert.ok(inner.internal.cost > 0 && inner.internal.profit > 0 && cp.pendingDecision);
  assert.ok(new Set(nums).size >= 14);
  assert.equal(JSON.stringify(inner).includes("912.3456"), false);   // الإعداد لا يُنسخ في النتيجة نفسها (الأسطر مقرَّبة)، لكن internal.cost موجودة
  assert.ok(JSON.stringify(inner).includes(String(inner.internal.cost)));
});

test("canaries: packageClientView وpackageRateForRole للعميل والمورّد والمرشح والدور الغائب لا تُخرج إلا السعر وساعة الإضافي", () => {
  const sec = secretsFor();
  for (const role of ["client", "vendor", "candidate", undefined, null, "", "admin", "OPS", "owner"]) {
    for (const mode of ["lump", "costplus"]) {
      const out = C.packageRateForRole({ mode, package: 2750, config: CANARY_CFG }, role);
      assertClean(`${role}/${mode}`, JSON.stringify(out), sec);
      if (mode === "lump") assert.deepEqual(Object.keys(out), ["status", "currency", "monthlyPrice", "otHour"], String(role));
      else assert.deepEqual(out, { status: "pending_pricing" }, `costplus ${role}`);
    }
  }
  // ops/system وحدهما: النتيجة الكاملة بوضعيها
  for (const role of ["ops", "system"]) {
    assert.ok(C.packageRateForRole({ mode: "lump", package: 2750, config: CANARY_CFG }, role).internal.profit > 0, role);
    assert.equal(C.packageRateForRole({ mode: "costplus", package: 2750, config: CANARY_CFG }, role).pendingDecision, true, role);
  }
  assertClean("view", JSON.stringify(C.packageClientView(sec.inner, CANARY_CFG)), sec);
});

test("canaries: clientView (ورقة التسكين) وردّ estimateQuote العام وestimatePackageQuote وردّ action=price بلا أي قيمة أو مفتاح داخلي", async () => {
  const sec = secretsFor();
  // clientView على ورقة التكلفة الفعلية (الهامش 0.31337 قيمة فريدة)
  const cc = C.costConfigFromPricing(CANARY);
  const sheet = C.computeCostSheet({ salaryHalalas: 275000, governmentMonthlyHalalas: 100000, recruitmentHalalas: 90000, visaHalalas: 30000, vendorFeeHalalas: 0, contractMonths: 12 }, cc);
  assert.equal(sheet.status, "ok");
  for (const vis of ["total", "breakdown"]) {
    const v = JSON.stringify(C.clientView(sheet, { ...cc, clientCostVisibility: vis }));
    assertClean("clientView/" + vis, v, sec);
    for (const w of [String(sheet.costMonthlyHalalas), String(sheet.marginHalalas), "0.31337", "lines", "oneTime", "marginRate", "residual"]) assert.equal(v.includes(w), false, `clientView ${vis}: ${w}`);
  }
  // estimateQuote العام
  const items = [IT(2, ["IN"], 2750)];
  const q = JSON.stringify(E.estimateQuote(items, CANARY, { workerType: "foreign", recruitment: "yes", durationMonths: 12, now: NOW }));
  assertClean("estimateQuote", q, sec);
  assert.equal(JSON.parse(q).status, "estimated");
  // estimatePackageQuote وردّ API
  const pq = JSON.stringify(E.estimatePackageQuote(items, CANARY, { workerType: "foreign", durationMonths: 12, now: NOW }));
  assertClean("estimatePackageQuote", pq, sec);
  assert.equal(JSON.parse(pq).status, "ok");
  const api = JSON.stringify(await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 2, nationalities: ["IN"], salary: 2750 }] }, { now: NOW, ip: "", pricing: CANARY }));
  assertClean("api/price", api, sec);
  assert.equal(JSON.parse(api).quote.status, "ok");
});

test("canaries: بريد العميل ومحتوى Notion المرسل لا يحويان تكلفة ولا ربحاً ولا هامشاً ولا مفتاح إعداد داخلياً", async () => {
  const sec = secretsFor();
  const calls = [], mails = [], notes = [];
  const ctx = {
    dev: false, notionToken: "secret_test", dbId: "db-test", now: NOW, ip: "", pricing: CANARY, refGen: () => "EOR-424242",
    fetch: async (url, init) => { calls.push(init.body); return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
    sendEmail: async (to, subject, html) => { mails.push({ to, subject, html }); return { ok: true }; },
    notify: async (p) => { notes.push(p); return { ok: true }; }, teamEmail: "team@test.local", ownerEmail: "owner@test.local",
  };
  const body = { company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض", workerType: "foreign", recruitment: "yes",
    items: [{ occupationId: "hosp.waiter", count: 2, nationalities: ["IN"], salary: 2750 }], startDate: "2026-11-01", durationMonths: 12, lang: "ar" };
  const r = await E.handleEor(body, ctx);
  assert.deepEqual(r, { ok: true, ref: "EOR-424242" });
  assertClean("ردّ الطلب", JSON.stringify(r), sec);
  const toClient = mails.filter((m) => m.to === "sara@example.com");
  assert.equal(toClient.length, 1);
  assertClean("بريد العميل", toClient[0].subject + toClient[0].html, sec);
  assert.equal(/ريال|SAR|9640|4820|482\d/.test(toClient[0].html), false, "بريد العميل بلا أي مبلغ");
  // Notion: الصف والمتن (الفريق يرى سعر الحزمة المعروض للعميل فقط، لا تكلفة ولا ربح)
  assertClean("Notion", calls.join("\n"), sec);
  // أيضاً: نسخة الفريق الداخلية لا تكشف التكلفة (السعر الشهري المعروض للعميل فقط)
  const team = mails.find((m) => m.to === "team@test.local");
  assertClean("بريد الفريق", team.html, sec);
});

test("canaries: الصفحات الأربع المولَّدة لـ/eor (HTML وCSS وJSON الإعداد) بلا قيمة داخلية ولا مفتاح تسعير داخلي", () => {
  const sec = secretsFor();
  // القيم الحقيقية في الملف المرفق أيضاً: أرقام المالك لا تُدفن في صفحة عامة
  const real = lump(2000).internal;
  const realNums = [String(real.cost), String(real.rate), String(real.profit), "882.5", "9700", "4339", "4821.3"];
  for (const rel of ["site/eor.html", "site/ar/eor.html", "site/fr/eor.html", "site/zh/eor.html"]) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) continue;       // الصفحات تُولَّد بـnpm run build
    const h0 = fs.readFileSync(f, "utf8");
    const cfg = h0.match(/<script>\(function eorClient[\s\S]*?\)\((\{[\s\S]*?\})\);<\/script>/);
    assert.ok(cfg, rel + " كتلة الإعداد");
    // مفاتيح الكتلة: الكتالوج العام (cat) والقيم المسبقة للمدة (pre) صارا فيها؛ لا مفتاح تسعير.
    assert.deepEqual(Object.keys(JSON.parse(cfg[1])).sort(), ["cat", "ins", "lang", "lim", "pre", "tx", "units"], rel + " مفاتيح كتلة الإعداد ثابتة");
    const h = stripCat(h0);                       // الكتالوج العام (أسماء مهن وقطاعات) خارج فحوص التسعير
    assertClean(rel, h, sec);
    for (const n of realNums) assert.equal(h.includes(n), false, `${rel}: ${n}`);
    assert.equal(/package_rate|pricing\.json|_eor-pricing/.test(h), false, rel);
  }
});

test("canaries: ملف بناء صفحة /eor لا يستورد الإعداد ولا الحاسبة (التسعير على الخادم وحده)", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/scripts/simple-v1-eor.mjs"), "utf8");
  assert.equal(/_eor-cost|_eor-pricing|loadPricing|computePackageRate|packageRateConfig/.test(src), false);
  assert.equal(/overhead|profit|markup|margin_on_price|margin_rate/i.test(src), false);
});

/* ═════════════ واجهة السعر الفوري في /eor ═════════════ */
test("/eor: السكربت يسأل الخادم action=price ويعرض السعر الشهري وساعة الإضافي، وأنماطه الجديدة بمتغيرات SV1 بلا ألوان حرفية", async () => {
  const { simpleV1 } = await import("../site/scripts/simple-v1.mjs");
  const { buildSimpleEor } = await import("../site/scripts/simple-v1-eor.mjs");
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  for (const l of ["ar", "en", "fr", "zh"]) {
    const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
    const sv1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang: (p, x) => (x === "en" ? p : "/" + x + p), assetV: (x) => x, knowledge: null });
    const h = stripCat(buildSimpleEor(sv1, { lang: () => l, esc }));      // الكتالوج العام خارج فحوص «لا تسعير في الصفحة»
    const s0 = h.indexOf("<script>(function eorClient");
    const client = h.slice(s0, h.indexOf("</script>", s0));
    assert.ok(client.includes('action: "price"') && client.includes("monthlyPerEmployee") && client.includes("otHour"), l);
    assert.ok(h.includes('id="eorPriceSum"'), l);
    assert.equal(/localStorage|sessionStorage/.test(client), false);
    const css = h.slice(h.indexOf('id="sv1-eor-css"'), h.indexOf("</style>", h.indexOf('id="sv1-eor-css"')));
    for (const sel of [".sv1-eor-price", ".sv1-eor-sum", ".sv1-eor-hr"]) {
      const rules = css.split("\n").filter((ln) => ln.startsWith(sel));
      assert.ok(rules.length > 0, sel);
      for (const ln of rules) assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(ln), false, `لون حرفي في ${sel}`);
    }
    // لا تكلفة/هامش/ربح في سكربت العميل (الحساب على الخادم)
    assert.equal(/margin_|overhead|profit|markup|package_rate|saleMonthly|marginRate/i.test(client), false);
  }
});
