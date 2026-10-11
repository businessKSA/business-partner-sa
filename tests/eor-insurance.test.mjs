// كتالوج التأمين الطبي في حاسبة سعر الموظف (api/_eor-cost.js: insurancePremium + computePackageRate.insurance، api/_eor.js، /eor).
// المرجع: docs/hr-pricing-calculator-spec.md قسم «التأمين». الأرقام تقدير سوق (أسعار أفراد قبل خصم المجموعات، الربع الأول 2026) لا عرض شركة.
// الحساب في هذا الاختبار مكتوب مرة ثانية بأعداد صحيحة (هللات) مستقلاً عن الكود، كي لا يُقارَن الحساب بنفسه.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-ins-"));

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
const lump = (P, insurance, cfg = CFG) => C.computePackageRate({ mode: "lump", package: P, insurance, config: cfg });
const cfgWith = (mut) => { const p = clone(PRICING); mut(p.package_rate.insurance_catalog); return C.packageRateConfigFromPricing(p); };

/* ═════════════ الجدول المرجعي (من مصدر السوق في المواصفة) — مكتوب مستقلاً بأعداد صحيحة ═════════════ */
const BASE_H = { C: 200000, B: 420000, A: 900000 };                 // هللات سنوياً، عمر 18–29، قبل الضريبة
const MAT_H = { C: 140000, B: 220000, A: 350000 };                  // أمومة ثابتة سنوياً
const AGE_TENTHS = { "0-17": 9, "18-29": 10, "30-39": 11, "40-49": 14, "50-59": 18, "60+": 25 };
const MAT_BANDS = ["18-29", "30-39", "40-49"];
const BANDS = Object.keys(AGE_TENTHS);
const CLASSES = ["C", "B", "A"];
const GENDERS = ["unspecified", "male", "female"];
// القسط الشهري بالهللة: ((سنوي × عمر) [+25% منه] [+ أمومة]) × 1.15 ÷ 12، نصف لأعلى — أعداد صحيحة فقط.
function expectedMonthlyH(cls, band, gender, { maternity = false, chronic = false } = {}) {
  const adj = (BASE_H[cls] * AGE_TENTHS[band]) / 10;               // صحيح لأن الأساس مضاعف 100 هللة
  assert.ok(Number.isInteger(adj));
  const chr = chronic ? adj / 4 : 0;
  assert.ok(Number.isInteger(chr));
  const mat = maternity && gender === "female" && MAT_BANDS.includes(band) ? MAT_H[cls] : 0;
  const num = (adj + chr + mat) * 115, den = 100 * 12;               // ×1.15 ÷ 12
  return Math.floor((2 * num + den) / (2 * den));
}

test("صفوف مرجعية: كل فئة × فئة عمرية × جنس × أمومة × مزمن تطابق الجدول بحساب مستقل (بالهللة)", () => {
  let n = 0;
  for (const cls of CLASSES) for (const band of BANDS) for (const gender of GENDERS) for (const maternity of [false, true]) for (const chronic of [false, true]) {
    const r = C.insurancePremium({ insuranceClass: cls, ageBand: band, gender, maternity, chronic }, CFG.insurance);
    assert.equal(r.status, "applied", `${cls}/${band}/${gender}`);
    assert.equal(r.monthlyHalalas, expectedMonthlyH(cls, band, gender, { maternity, chronic }), `${cls}/${band}/${gender}/m${maternity}/c${chronic}`);
    // ومن خلال الحاسبة: بند التأمين في الصيغة = القسط الشهري نفسه
    const res = lump(2000, { insuranceClass: cls, ageBand: band, gender, maternity, chronic });
    assert.equal(res.internal.lines.insurance, r.monthlyHalalas / 100);
    n++;
  }
  assert.equal(n, 3 * 6 * 3 * 2 * 2);
});

test("قيم الجدول الحرفية من المصدر: C وB وA عند 18–29، ومعاملات العمر، والأمومة، والمزمن، و15% ضريبة", () => {
  const m = (cls, band, gender = "male", o = {}) => C.insurancePremium({ insuranceClass: cls, ageBand: band, gender, ...o }, CFG.insurance).monthlyHalalas;
  assert.equal(m("C", "18-29"), 19167);                 // 2000 × 1.15 ÷ 12 = 191.67
  assert.equal(m("B", "18-29"), 40250);                 // 4200 × 1.15 ÷ 12 = 402.50
  assert.equal(m("A", "18-29"), 86250);                 // 9000 × 1.15 ÷ 12 = 862.50
  assert.equal(m("A", "60+"), 215625);                  // 9000 × 2.5 × 1.15 ÷ 12 = 2156.25
  assert.equal(m("C", "0-17"), 17250);                  // 2000 × 0.9 × 1.15 ÷ 12 = 172.50
  assert.equal(m("B", "40-49"), 56350);                 // 4200 × 1.4 × 1.15 ÷ 12 = 563.50
  assert.equal(m("B", "30-39", "female", { maternity: true }), 65358);   // (4620 + 2200) × 1.15 ÷ 12 = 653.58
  assert.equal(m("C", "50-59", "male", { chronic: true }), 43125);       // 2000 × 1.8 × 1.25 × 1.15 ÷ 12 = 431.25
  assert.equal(m("C", "50-59", "male", { chronic: true }), expectedMonthlyH("C", "50-59", "male", { chronic: true }));
});

/* ═════════════ الافتراضي = صيغة الإكسل بالضبط ═════════════ */
test("الافتراضي (الأساسي المعتمد 600 سنوياً) يطابق fixture الورقة بلا انحدار، مع أي جنس أو عمر أو إضافات", () => {
  const variants = [undefined, null, {}, { insuranceClass: "basic" },
    { insuranceClass: "basic", ageBand: "60+", gender: "female", maternity: true, chronic: true },
    { insuranceClass: "BASIC", ageBand: "0-17", gender: "male" }];
  for (const row of FIX.lumpSum) {
    const ref = lump(row.package);
    assert.ok(Math.abs(ref.internal.cost - row.cost) < 0.006, `cost @${row.package}`);
    for (const v of variants) {
      const r = lump(row.package, v);
      assert.equal(r.billable, ref.billable, `@${row.package}`);
      assert.equal(r.internal.cost, ref.internal.cost);
      assert.equal(r.internal.lines.insurance, 50);
      assert.equal(r.otHour, ref.otHour);
    }
  }
  assert.equal(lump(2000).billable, 4820);
  assert.equal("insurance" in lump(2000), false, "بلا اختيار تأمين لا مفتاح insurance في النتيجة (الشكل القديم)");
  assert.deepEqual(Object.keys(C.packageClientView(lump(2000), CFG)), ["status", "currency", "monthlyPrice", "otHour"]);
});

test("الجنس غير المحدد والذكر لا يضيفان أمومة؛ الأنثى المؤهلة فقط، والفئة العمرية غير المؤهلة لا", () => {
  const m = (gender, band, maternity = true) => C.insurancePremium({ insuranceClass: "B", ageBand: band, gender, maternity }, CFG.insurance);
  const none = (band) => C.insurancePremium({ insuranceClass: "B", ageBand: band, gender: "female" }, CFG.insurance).monthlyHalalas;
  for (const g of ["unspecified", "male"]) for (const b of MAT_BANDS) { const r = m(g, b); assert.equal(r.maternity, false); assert.equal(r.monthlyHalalas, none(b)); }
  for (const b of ["0-17", "50-59", "60+"]) { const r = m("female", b); assert.equal(r.maternity, false); assert.equal(r.monthlyHalalas, none(b)); }
  for (const b of MAT_BANDS) assert.equal(m("female", b).maternity, true, b);
  // الفرق = الأمومة الثابتة × 1.15 ÷ 12 (لا تُضرب بمعامل العمر)
  assert.equal(m("female", "40-49").monthlyHalalas - none("40-49"), 21083);     // 2200 × 1.15 ÷ 12 = 210.83
  assert.equal(m("female", "18-29").monthlyHalalas - none("18-29"), 21083);
  // الأمومة والمزمن على الأساسي لا يفعلان شيئاً
  assert.equal(C.insurancePremium({ insuranceClass: "basic", gender: "female", ageBand: "30-39", maternity: true, chronic: true }, CFG.insurance).status, "basic");
});

/* ═════════════ فشل مغلق ═════════════ */
test("قيم غير معروفة ⇒ الأساسي لا خطأ ولا سعراً صفرياً ولا NaN", () => {
  const base = lump(2000);
  const junk = [{ insuranceClass: "VIP+" }, { insuranceClass: 7 }, { insuranceClass: null }, { insuranceClass: {} }, { insuranceClass: "__proto__" }, { insuranceClass: ["C"] },
    { insuranceClass: "", ageBand: "30-39", gender: "female" }, "C", 42, [], { insuranceClass: "D", ageBand: "30-39" }];
  for (const v of junk) {
    const r = lump(2000, v);
    assert.equal(r.status, "ok", JSON.stringify(v));
    assert.equal(r.billable, base.billable, JSON.stringify(v));
    assert.ok(r.billable > 0 && Number.isFinite(r.billable));
    assert.equal(r.internal.lines.insurance, 50);
    assert.equal(r.insurance.class, "basic");
    assert.equal(r.insurance.deltaMonthly, 0);
  }
  // عمر/جنس مجهول مع فئة صحيحة: العمر المجهول ⇒ needs_age بسعر الأساسي؛ الجنس المجهول ⇒ غير محدد
  for (const band of ["70+", "18–29", 30, null, "", "0-17 "]) {
    const r = lump(2000, { insuranceClass: "C", ageBand: band, gender: "female" });
    if (band === "0-17 ") assert.equal(r.insurance.status, "applied");     // المسافات الطرفية تُقصّ
    else { assert.equal(r.insurance.status, "needs_age", String(band)); assert.equal(r.billable, base.billable); }
  }
  const g = lump(2000, { insuranceClass: "C", ageBand: "30-39", gender: "other", maternity: true });
  assert.equal(g.internal.insurance.gender, "unspecified");
  assert.equal(g.insurance.maternity, false);
  // المنطقي صارم: النص "true" والرقم 1 ليسا true
  const s = lump(2000, { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: "true", chronic: 1 });
  assert.equal(s.insurance.maternity, false); assert.equal(s.insurance.chronic, false);
  assert.deepEqual(C.normalizeInsuranceFields({ insuranceClass: "x", ageBand: "y", gender: "z", maternity: "1", chronic: {} }),
    { insuranceClass: "basic", ageBand: "", gender: "unspecified", maternity: false, chronic: false, insurer: "any" });
  assert.deepEqual(C.normalizeInsuranceFields(null), { insuranceClass: "basic", ageBand: "", gender: "unspecified", maternity: false, chronic: false, insurer: "any" });
});

test("إعداد ناقص أو فاسد أو مغلق ⇒ الأساسي (لا رقم مخمَّن)", () => {
  const ask = { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true, chronic: true };
  const base = lump(2000).billable;
  const noCatalog = clone(PRICING); delete noCatalog.package_rate.insurance_catalog;
  assert.equal(C.packageRateConfigFromPricing(noCatalog).insurance, null);
  assert.equal(lump(2000, ask, C.packageRateConfigFromPricing(noCatalog)).billable, base);
  const broken = [
    (c) => { c.client_selectable = false; }, (c) => { c.group_discount_factor = 0; }, (c) => { c.group_discount_factor = 1.5; }, (c) => { c.group_discount_factor = null; },
    (c) => { c.vat_on_insurance_included = null; }, (c) => { c.vat_rate = null; }, (c) => { c.age_bands["30-39"] = null; }, (c) => { c.age_bands["30-39"] = 0; },
    (c) => { c.gender_factor.female = -1; }, (c) => { c.classes.B.base_yearly_18_29 = null; }, (c) => { c.classes.B.maternity_yearly = null; }, (c) => { c.chronic_loading = null; },
  ];
  broken.forEach((mut, i) => {
    const r = lump(2000, ask, cfgWith(mut));
    assert.equal(r.status, "ok", "#" + i);
    assert.equal(r.billable, base, "#" + i + " يرجع للأساسي");
    assert.equal(r.insurance.status, "basic", "#" + i);
  });
  // الإضافات مغلقة (client_addons_visible=false): تُسقَط الإضافتان فقط ويبقى سعر الفئة
  const off = lump(2000, ask, cfgWith((c) => { c.client_addons_visible = false; }));
  const plain = lump(2000, { ...ask, maternity: false, chronic: false });
  assert.equal(off.billable, plain.billable);
  assert.equal(off.insurance.maternity, false);
});

test("الفئة العليا (VIP/بعرض سعر): بلا رقم، والسعر يبقى على الأساسي، والحالة quote_only", () => {
  const r = lump(2000, { insuranceClass: "quote", ageBand: "60+", gender: "male" });
  assert.equal(r.billable, lump(2000).billable);
  assert.deepEqual(r.insurance, { class: "quote", status: "quote_only", insurer: "any", deltaMonthly: 0, maternity: false, chronic: false });
  const off = lump(2000, { insuranceClass: "quote" }, cfgWith((c) => { c.classes.quote = {}; }));
  assert.equal(off.insurance.status, "basic");
});

/* ═════════════ مفاتيح الإعداد قابلة للتغيير ═════════════ */
test("معاملات العمر والجنس وخصم المجموعات والضريبة وعلاوة المزمن والأمومة كلها من الإعداد", () => {
  const ask = { insuranceClass: "C", ageBand: "30-39", gender: "female" };
  const h = (cfg, a = ask) => C.insurancePremium(a, cfg.insurance).monthlyHalalas;
  const base = h(CFG);
  assert.equal(base, expectedMonthlyH("C", "30-39", "female"));
  // خصم المجموعات
  assert.equal(h(cfgWith((c) => { c.group_discount_factor = 0.5; })), Math.floor((2 * (200000 * 11 / 10 / 2) * 115 + 1200) / 2400));
  // الضريبة معطّلة
  assert.equal(h(cfgWith((c) => { c.vat_on_insurance_included = false; })), 18333);      // 2000 × 1.1 ÷ 12 = 183.33 بلا ضريبة
  // معامل الجنس (يُضرب في القسط)
  assert.equal(h(cfgWith((c) => { c.gender_factor.female = 2; })), Math.floor((2 * 440000 * 115 + 1200) / 2400));
  // معامل العمر
  assert.equal(h(cfgWith((c) => { c.age_bands["30-39"] = 2; })), Math.floor((2 * 200000 * 2 * 115 + 1200) / 2400));
  // علاوة المزمن 30%
  const chr = { ...ask, insuranceClass: "B", chronic: true };
  assert.equal(h(cfgWith((c) => { c.chronic_loading = 0.3; }), chr), Math.floor((2 * (462000 * 130 / 100) * 115 + 1200) / 2400));
  // خصم المجموعات يُطبَّق على المزمن لا على الأمومة
  const both = { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true, chronic: true };
  const cfgD = cfgWith((c) => { c.group_discount_factor = 0.5; });
  const num = (462000 / 2 + 462000 / 2 * 0.25 + 220000) * 115;
  assert.equal(h(cfgD, both), Math.floor((2 * num + 1200) / 2400));
  // أمومة غير مؤهَّلة عمرياً بتغيير الإعداد
  assert.equal(h(cfgWith((c) => { c.maternity.eligible_age_bands = ["18-29"]; }), { ...ask, maternity: true, ageBand: "30-39" }), h(CFG));
  // لا ثابت مالي مدفون في الكود: الأرقام كلها من الإعداد (نفحص الكتلة الجديدة)
  const src = fs.readFileSync(path.join(ROOT, "api/_eor-cost.js"), "utf8");
  const code = src.slice(src.indexOf("export const INSURANCE_CLASSES"), src.indexOf("export function packageRateConfigFromPricing")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const lit of ["2000", "4200", "9000", "1400", "2200", "3500", "0.25", "1.15", "0.15", "1.1", "1.4", "1.8", "2.5", "600"]) assert.equal(new RegExp(`(?<![\\d.])${lit.replace(".", "\\.")}(?![\\d])`).test(code), false, "ثابت " + lit);
});

test("الدفعة الافتراضية للإعداد في الملف: القيم المذكورة في أمر المالك فقط، ومعلَّمة تقدير سوق ومصدرها وتاريخها وقراراتها", () => {
  const cat = PRICING.package_rate.insurance_catalog;
  assert.equal(cat._status, "market_estimate_replace_with_insurer_quotes");
  assert.match(cat._source, /ehsabi\.com\/c\/cchi-health-insurance-cost-ksa/);
  assert.match(cat._source, /concordarabia\.com\/en\/medical-insurance-price-in-saudi-arabia/);
  assert.equal(cat._as_of, "2026-Q1");
  assert.deepEqual([cat.classes.C.base_yearly_18_29, cat.classes.B.base_yearly_18_29, cat.classes.A.base_yearly_18_29], [2000, 4200, 9000]);
  assert.deepEqual([cat.classes.C.maternity_yearly, cat.classes.B.maternity_yearly, cat.classes.A.maternity_yearly], [1400, 2200, 3500]);
  assert.deepEqual(cat.age_bands, { "0-17": 0.9, "18-29": 1.0, "30-39": 1.1, "40-49": 1.4, "50-59": 1.8, "60+": 2.5 });
  assert.deepEqual(cat.gender_factor, { male: 1, female: 1, unspecified: 1 });
  assert.equal(cat.chronic_loading, 0.25);
  assert.deepEqual(cat.chronic_loading_range, [0.2, 0.3]);
  assert.equal(cat.group_discount_factor, 1);
  assert.equal(cat.vat_on_insurance_included, true);
  assert.equal(cat.vat_rate, 0.15);
  assert.equal(cat.default_class, "basic");
  assert.equal(PRICING.package_rate.lump.insurance_yearly, 600);
  for (const k of ["_group_discount_factor", "_vat_on_insurance_included", "_gender_factor", "_client_addons_visible"]) assert.match(String(cat[k]), /_owner_decision|لا معامل جنس/, k);
  assert.ok(String(cat.maternity._owner_decision).length > 20);
  assert.equal(cat.classes.quote.quote_only, true);
  assert.equal("A_vip" in cat.classes, false);
});

/* ═════════════ الفرق عن الأساسي، ما يراه العميل، والفاتورة ═════════════ */
test("الفرق الشهري عن الأساسي = فرق سعرين مقرَّبين (مضاعف 10)، والعميل يرى الفئة والفرق فقط", () => {
  const r = lump(2000, { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true });
  assert.equal(r.billable, 5490);
  assert.equal(r.insurance.deltaMonthly, r.billable - lump(2000).billable);
  assert.equal(r.insurance.deltaMonthly, 670);
  assert.equal(r.insurance.deltaMonthly % 10, 0);
  const v = C.packageClientView(r, CFG);
  assert.deepEqual(Object.keys(v), ["status", "currency", "monthlyPrice", "otHour", "insurance"]);
  assert.deepEqual(Object.keys(v.insurance), ["class", "status", "insurer", "deltaMonthly", "maternity", "chronic"]);
  assert.equal(v.monthlyPrice, 5490);
  assert.equal(v.otHour, 15);                                 // ساعة الإضافي من الحزمة وحدها
  // تفصيل ops وحده
  const ops = C.packageRateForRole({ mode: "lump", package: 2000, insurance: { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true }, config: CFG }, "ops");
  assert.equal(ops.internal.insurance.yearly, 7843);
  assert.equal(ops.internal.insurance.baseYearly, 4200);
  assert.equal(ops.internal.insurance.maternityYearly, 2200);
  assert.equal(ops.internal.insurance.monthly, 653.58);
  assert.equal(ops.internal.insurance.basicBillable, 4820);
  for (const role of ["client", "vendor", "candidate", undefined, ""]) {
    const out = C.packageRateForRole({ mode: "lump", package: 2000, insurance: { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true }, config: CFG }, role);
    assert.equal("internal" in out, false, String(role));
  }
  // costplus يتجاهل التأمين (صيغته لا تحمله)
  const cp = C.computePackageRate({ mode: "costplus", package: 2000, insurance: { insuranceClass: "A", ageBand: "60+" }, config: CFG });
  assert.equal(cp.billable, 3230);
  assert.equal("insurance" in cp, false);
});

test("السعر نفسه يصل packageSaleMonthlyHalalas وmonthlyInvoiceLines", () => {
  const r = lump(2000, { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true });
  const sale = C.packageSaleMonthlyHalalas(r);
  assert.equal(sale, 549000);
  const inv = C.monthlyInvoiceLines(
    [{ id: "p1", stage: "active", saleMonthlyHalalas: sale }],
    [{ placementId: "p1", period: "2026-10", status: "approved", approvedDays: 30 }],
    { period: "2026-10", currency: "SAR", vatRate: 0.15, agreedMonthDays: 30 });
  assert.equal(inv.status, "ok");
  assert.equal(inv.lines[0].amountHalalas, 549000);
  assert.equal(inv.subtotalHalalas, 549000);
});

/* ═════════════ الطلب (الخادم) ═════════════ */
const IT = (count, nationalities, salary, extra = {}) => ({ occupationId: "hosp.waiter", count, nationalities, salary, ...extra });
const body = (items) => ({ company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض", workerType: "foreign", recruitment: "no", items, startDate: "2026-11-01", durationMonths: 12, lang: "ar" });

test("التحقق: الحقول الاختيارية تُنظَّف بقوائم بيضاء، والمجهول يسقط للافتراضي دون رفض الطلب", () => {
  const v = (it) => E.validateEorRequest(body([it]), { now: NOW });
  const ok = v(IT(2, ["IN"], 2000, { gender: "female", ageBand: "30-39", insuranceClass: "B", maternity: true, chronic: true }));
  assert.equal(ok.ok, true);
  const { gender, ageBand, insuranceClass, maternity, chronic } = ok.value.items[0];
  assert.deepEqual({ gender, ageBand, insuranceClass, maternity, chronic }, { gender: "female", ageBand: "30-39", insuranceClass: "B", maternity: true, chronic: true });
  const none = v(IT(2, ["IN"], 2000));
  assert.deepEqual([none.value.items[0].gender, none.value.items[0].ageBand, none.value.items[0].insuranceClass, none.value.items[0].maternity, none.value.items[0].chronic], ["unspecified", "", "basic", false, false]);
  const junk = v(IT(2, ["IN"], 2000, { gender: "<script>", ageBand: "99+", insuranceClass: "VIP", maternity: "yes", chronic: "true" }));
  assert.equal(junk.ok, true);
  assert.deepEqual([junk.value.items[0].gender, junk.value.items[0].ageBand, junk.value.items[0].insuranceClass, junk.value.items[0].maternity, junk.value.items[0].chronic], ["unspecified", "", "basic", false, false]);
  assert.equal(JSON.stringify(junk.value).includes("script"), false);
});

test("estimatePackageQuote وaction=price: سعر الفئة المختارة × العدد، وسطر لكل بند بفرقه، وأعلام الواجهة منطقية فقط", async () => {
  const items = [IT(3, ["IN"], 2000, { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true }), IT(1, ["IN"], 2000, { insuranceClass: "basic", ageBand: "", gender: "unspecified", maternity: false, chronic: false })];
  const q = E.estimatePackageQuote(items, PRICING, { workerType: "foreign", now: NOW });
  assert.equal(q.status, "ok");
  assert.equal(q.lines[0].monthlyPerEmployee, 5490);
  assert.equal(q.lines[0].monthlyTotal, 16470);
  assert.deepEqual(q.lines[0].insurance, { class: "B", status: "applied", insurer: "any", deltaMonthly: 670, maternity: true, chronic: false });
  assert.equal(q.lines[1].monthlyPerEmployee, 4820);
  assert.equal(q.lines[1].insurance.status, "basic");
  assert.equal(q.monthlyTotal, 16470 + 4820);
  assert.equal(q.insuranceUi.selectable, true);
  assert.equal(q.insuranceUi.addons, true);
  const api = await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 3, nationalities: ["IN"], salary: "2,000", insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true }] }, { now: NOW, ip: "", pricing: PRICING });
  assert.equal(api.quote.lines[0].monthlyPerEmployee, 5490);
  assert.equal(api.quote.lines[0].insurance.deltaMonthly, 670);
  assert.deepEqual(Object.keys(api), ["ok", "quote"]);
  // مغلق: أعلام الواجهة تُخفي الاختيار والأسعار على الأساسي
  const shut = clone(PRICING); shut.package_rate.insurance_catalog.client_selectable = false;
  const q2 = E.estimatePackageQuote(items, shut, { workerType: "foreign", now: NOW });
  assert.equal(q2.insuranceUi.selectable, false);
  assert.equal(q2.insuranceUi.addons, false);
  assert.deepEqual(q2.insuranceUi.insurers, []);       // مغلق ⇒ لا قائمة شركات ولا أوصاف
  assert.equal(q2.lines[0].monthlyPerEmployee, 4820);
  // بلا حقول تأمين في البند (الشكل القديم) ⇒ لا مفتاح insurance في السطر
  const old = E.estimatePackageQuote([IT(1, ["IN"], 2000)], PRICING, { workerType: "foreign", now: NOW });
  assert.equal("insurance" in old.lines[0], false);
  assert.equal(old.lines[0].monthlyPerEmployee, 4820);
  // سعودي ⇒ none مع أعلام الواجهة
  const sa = E.estimatePackageQuote([IT(1, ["SA"], 3000, { insuranceClass: "C", ageBand: "30-39" })], PRICING, { workerType: "saudi", now: NOW });
  assert.equal(sa.status, "none");
});

test("itemsText للفريق يذكر اختيار العميل (فئة/جنس/عمر/إضافات) فقط إن خالف الافتراضي، بلا أرقام أقساط", () => {
  const t = E.itemsText([
    IT(2, ["IN"], 2000, { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true }),
    IT(1, ["IN"], 2000, { insuranceClass: "basic", ageBand: "", gender: "unspecified", maternity: false, chronic: false }),
    IT(1, ["IN"], null),
  ]);
  const lines = t.split("\n");
  assert.match(lines[0], /التأمين: الفئة B — الجنس: أنثى — الفئة العمرية: 30-39 — أمومة$/);
  assert.equal(/التأمين|الجنس:|أمومة/.test(lines[1] + lines[2]), false);
});

/* ═════════════ الخصوصية: لا قسط خام ولا معامل ولا خصم ولا ضريبة تأمين تصل العميل ═════════════ */
const CANARY = clone(PRICING);
Object.assign(CANARY, { currency: "SAR", vat_rate: 0.15 });
Object.assign(CANARY.package_rate.insurance_catalog, { group_discount_factor: 0.98765, vat_rate: 0.15432, chronic_loading: 0.25678 });
CANARY.package_rate.insurance_catalog.classes = { basic: {}, C: { base_yearly_18_29: 2003.77, maternity_yearly: 1403.21 }, B: { base_yearly_18_29: 4207.31, maternity_yearly: 2203.33 }, A: { base_yearly_18_29: 9011.13, maternity_yearly: 3503.55 }, quote: { quote_only: true } };
CANARY.package_rate.insurance_catalog.age_bands = { "0-17": 0.91234, "18-29": 1.00123, "30-39": 1.12345, "40-49": 1.43219, "50-59": 1.81234, "60+": 2.51234 };
CANARY.package_rate.insurance_catalog.gender_factor = { male: 1.00777, female: 1.00888, unspecified: 1.00999 };
CANARY.package_rate.lump.insurance_yearly = 611.2233;
// تفصيل السعر للعميل (قرار المالك 2026-10-08) يعرض القسط الشهري للتأمين سطراً مستقلاً عمداً؛ هذه الحالة هي «التفصيل مغلق»: لا قسط ولا فرق داخلي بأي شكل.
// حالة التفصيل المفتوح (القسط الشهري وحده ظاهر، وبقية القيم الخام محجوبة) في tests/eor-request-form.test.mjs.
CANARY.package_rate.client_breakdown_visible = false;
const CANARY_CFG = C.packageRateConfigFromPricing(CANARY);
const ASK = { insuranceClass: "B", ageBand: "30-39", gender: "female", maternity: true, chronic: true };

function insuranceSecrets() {
  const ops = C.packageRateForRole({ mode: "lump", package: 2750, insurance: ASK, config: CANARY_CFG }, "ops");
  const d = ops.internal.insurance;
  assert.equal(d.class, "B");
  const raw = ["2003.77", "1403.21", "4207.31", "2203.33", "9011.13", "3503.55", "0.98765", "0.15432", "0.25678", "0.91234", "1.00123", "1.12345", "1.43219", "1.81234", "2.51234", "1.00777", "1.00888", "1.00999", "611.2233",
    String(d.yearly), String(d.monthly), String(ops.internal.cost), String(ops.internal.profit), String(ops.internal.rate), String(d.basicMonthly)];
  return raw;
}
const INS_KEYS_RE = /insurance_catalog|insuranceCatalog|base_yearly|baseYearly|maternity_yearly|maternityYearly|age_bands|ageFactor|genderFactor|gender_factor|group_discount|groupDiscount|vat_on_insurance|vatIncluded|chronic_loading|chronicLoading|insurance_yearly|insuranceYearly|"yearly"|"detail"|"internal"|basicMonthly|basicBillable/;
const cleanOf = (label, text, raw) => {
  for (const n of raw) assert.equal(text.includes(n), false, `${label}: قيمة داخلية ${n}`);
  const m = text.match(INS_KEYS_RE);
  assert.equal(m, null, `${label}: مفتاح داخلي ${m && m[0]}`);
};

test("canaries: الحاسبة الداخلية تحمل القيم فعلاً (حتى لا يمرّ الاختبار فارغاً)", () => {
  const raw = insuranceSecrets();
  assert.ok(new Set(raw).size >= 20);
  const ops = JSON.stringify(C.packageRateForRole({ mode: "lump", package: 2750, insurance: ASK, config: CANARY_CFG }, "ops"));
  assert.ok(ops.includes("0.98765") && ops.includes("4207.31"), "تفصيل ops يحمل القسط الخام والخصم");
});

test("canaries: packageClientView وردّ الأدوار غير ops وestimatePackageQuote وردّ action=price بلا قسط ولا معامل ولا خصم ولا ضريبة تأمين", async () => {
  const raw = insuranceSecrets();
  const res = C.computePackageRate({ mode: "lump", package: 2750, insurance: ASK, config: CANARY_CFG });
  cleanOf("packageClientView", JSON.stringify(C.packageClientView(res, CANARY_CFG)), raw);
  for (const role of ["client", "vendor", "candidate", undefined, null, "", "admin", "OPS", "owner"]) {
    cleanOf("role " + role, JSON.stringify(C.packageRateForRole({ mode: "lump", package: 2750, insurance: ASK, config: CANARY_CFG }, role)), raw);
  }
  const items = [IT(2, ["IN"], 2750, ASK)];
  const pq = JSON.stringify(E.estimatePackageQuote(items, CANARY, { workerType: "foreign", durationMonths: 12, now: NOW }));
  cleanOf("estimatePackageQuote", pq, raw);
  assert.equal(JSON.parse(pq).status, "ok");
  assert.ok(JSON.parse(pq).lines[0].insurance.deltaMonthly > 0);
  const api = JSON.stringify(await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 2, nationalities: ["IN"], salary: 2750, ...ASK }] }, { now: NOW, ip: "", pricing: CANARY }));
  cleanOf("api/price", api, raw);
  // وفي حالات الفئة العليا والعمر الناقص
  for (const a of [{ insuranceClass: "quote" }, { insuranceClass: "A" }, { insuranceClass: "nope", ageBand: "30-39" }]) {
    cleanOf("api/price " + a.insuranceClass, JSON.stringify(await E.handleEor({ action: "price", workerType: "foreign", items: [{ count: 1, nationalities: ["IN"], salary: 2750, ...a }] }, { now: NOW, ip: "", pricing: CANARY })), raw);
  }
});

test("canaries: بريد العميل وطلب Notion والتنبيه وبريد الفريق لا تحمل قسطاً خاماً ولا معاملاً ولا خصماً ولا ضريبة تأمين", async () => {
  const raw = insuranceSecrets();
  const calls = [], mails = [], notes = [];
  const ctx = {
    dev: false, notionToken: "secret_test", dbId: "db-test", now: NOW, ip: "", pricing: CANARY, refGen: () => "EOR-515151",
    fetch: async (url, init) => { calls.push(init.body); return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
    sendEmail: async (to, subject, html) => { mails.push({ to, subject, html }); return { ok: true }; },
    notify: async (p) => { notes.push(p); return { ok: true }; }, teamEmail: "team@test.local", ownerEmail: "owner@test.local",
  };
  const r = await E.handleEor(body([IT(2, ["IN"], 2750, ASK)]), ctx);
  assert.deepEqual(r, { ok: true, ref: "EOR-515151" });
  cleanOf("ردّ الطلب", JSON.stringify(r), raw);
  const toClient = mails.find((m) => m.to === "sara@example.com");
  cleanOf("بريد العميل", toClient.subject + toClient.html, raw);
  assert.equal(/ريال|SAR|\d{4}/.test(toClient.html.replace(/style="[^"]*"/g, "").replace(/EOR-\d+/g, "")), false, "بريد العميل بلا مبلغ");
  cleanOf("Notion", calls.join("\n"), raw);
  cleanOf("بريد الفريق", mails.find((m) => m.to === "team@test.local").html, raw);
  cleanOf("تنبيه واتساب", JSON.stringify(notes), raw);
  // لكن اختيار العميل نفسه محفوظ للفريق
  assert.ok(calls.join("\n").includes("التأمين: الفئة B"));
});

/* ═════════════ الصفحة /eor ═════════════ */
test("/eor بالأربع لغات: اختيار الفئة والجنس والعمر، بطاقة الفئات، سطر «السعر تقديري ويُثبَّت بعرض الشركة»، بلا أرقام ولا ألوان حرفية ولا إعداد داخلي", async () => {
  const { simpleV1 } = await import("../site/scripts/simple-v1.mjs");
  const { buildSimpleEor } = await import("../site/scripts/simple-v1-eor.mjs");
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EST = { ar: "السعر تقديري ويُثبَّت بعرض الشركة", en: "estimate", fr: "estimation", zh: "估算" };
  for (const l of ["ar", "en", "fr", "zh"]) {
    const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
    const sv1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang: (p, x) => (x === "en" ? p : "/" + x + p), assetV: (x) => x, knowledge: null });
    const h0 = buildSimpleEor(sv1, { lang: () => l, esc });
    const cfg = cfgFromHtml(h0);
    const h = stripCat(h0);                       // الكتالوج العام خارج فحوص «لا تسعير ولا معامل في الصفحة» (انظر tests/eor-test-util.mjs)
    const s0 = h.indexOf("<script>(function eorClient");
    const client = h.slice(s0, h.indexOf("</script>", s0));
    assert.deepEqual(cfg.ins.classes.map((c) => c[0]), ["basic", "C", "B", "A", "quote"], l);
    assert.deepEqual(cfg.ins.ages.map((c) => c[0]), ["0-17", "18-29", "30-39", "40-49", "50-59", "60+"], l);
    // الجنس صار حقل البند الموحَّد (ذكر | أنثى | لا يهم) خارج كتلة التأمين: تسمياته في tx لا في ins.
    assert.equal("genders" in cfg.ins, false, l);
    for (const k of ["gU", "gM", "gF"]) assert.ok(cfg.tx[k] && cfg.tx[k].length >= 1, `${l}.${k}`);
    for (const [, label] of [...cfg.ins.classes, ...cfg.ins.ages]) assert.ok(label && label.length >= 1, l);
    for (const k of ["insH", "gender", "age", "insClass", "mat", "chr", "pDelta", "perMonth", "pQuoteOnly", "pNeedAge", "pNoMat", "insEst"]) assert.ok(cfg.tx[k] && cfg.tx[k].length >= 2, `${l}.${k}`);
    assert.ok(h.includes('id="eorInsInfo"'), l);
    assert.ok(h.includes(cfg.tx.insEst), l);
    if (l === "ar") assert.ok(h.includes(EST.ar));
    // العميل: الواجهة لا تحسب شيئاً، تُرسل الاختيار للخادم وتعرض الفرق الذي يعيده
    assert.ok(client.includes("insuranceClass") && client.includes("deltaMonthly") && client.includes('action: "price"'), l);
    assert.equal(/localStorage|sessionStorage/.test(client), false);
    assert.equal(/margin_|overhead|profit|markup|package_rate|saleMonthly|marginRate|insurance_catalog|base_yearly|group_discount|vat_on|age_bands|gender_factor|chronic_loading|maternity_yearly/i.test(stripCat(h)), false, l);
    assert.equal(/\*\s*1\.\d|1\.15|0\.25/.test(client), false, "لا معامل حسابي في سكربت العميل");
    // الأنماط الجديدة بمتغيرات SV1 فقط
    const css = h.slice(h.indexOf('id="sv1-eor-css"'), h.indexOf("</style>", h.indexOf('id="sv1-eor-css"')));
    for (const sel of [".sv1-eor-ins", ".sv1-eor-insg", ".sv1-eor-insx", ".sv1-eor-insnote", ".sv1-eor-insinfo"]) {
      const rules = css.split("\n").filter((ln) => ln.startsWith(sel));
      assert.ok(rules.length > 0, sel);
      for (const ln of rules) assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(ln), false, `لون حرفي في ${sel}`);
    }
    // لا سعر ولا رقم مبلغ في محتوى الصفحة
    const main = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    assert.equal(/\d\s*(﷼|ر\.س|SAR)/.test(main), false);
    assert.equal(/wa\.me|whatsapp/i.test(main), false);
    // التسمية: لا «الوكيل» ولا «شريك الأعمال» في الجديد
    assert.equal(/شريك الأعمال|شريك أعمالك/.test(h), false);
  }
});

test("بناء الصفحات: ملف الباني يستورد قوائم الاختيار من _eor.js لا من الحاسبة ولا الإعداد", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/scripts/simple-v1-eor.mjs"), "utf8");
  assert.equal(/_eor-cost|_eor-pricing|loadPricing|computePackageRate|packageRateConfig|insurancePremium/.test(src), false);
  assert.ok(/INSURANCE_CLASSES[\s\S]*from "\.\.\/\.\.\/api\/_eor\.js"/.test(src));
});
