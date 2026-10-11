// الشريحة ب (أمر المالك 2026-10-08): تفصيل الكوستنج الحكومي سطراً سطراً · تسعير العامل السعودي بشرائح التأمينات الاجتماعية · لا شيء داخلي للعميل.
// api/_eor-cost.js + api/_eor-labor.js + api/_eor.js + site/scripts/simple-v1-eor.mjs. الصيغ هنا مكتوبة بيد مستقلة عن الكود، وأرقام الأنظمة تُقرأ من
// api/_saudi-labor-data.json نفسه (لا أرقام نظامية مكتوبة هنا) ثم يُغيَّر الملف في نسخة لإثبات أن الكود يقرأ منه لا من ثابت.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-saudi-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const C = await import("../api/_eor-cost.js");
const E = await import("../api/_eor.js");
const L = await import("../api/_eor-labor.js");
const { stripCat, cfgFromHtml } = await import("./eor-test-util.mjs");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_saudi-labor-data.json"), "utf8"));
const NOW = Date.parse("2026-10-09T09:00:00Z");
const TODAY = "2026-10-09";
const clone = (o) => JSON.parse(JSON.stringify(o));
const CFG = C.packageRateConfigFromPricing(PRICING);
const cfgFor = (pricing, raw = RAW) => C.packageRateConfigFromPricing(pricing, L.normalizeLabor(raw));
const rate = (P, over = {}, cfg = CFG) => C.computePackageRate({ mode: "lump", workerType: "saudi", package: P, config: { ...cfg, today: TODAY }, ...over });
const mround = (x) => Math.floor(x / 10 + 0.5 + 1e-9) * 10;

// حصة صاحب العمل كما في الملف المرجعي (لا أرقام هنا): الجديد حسب جدول السنة، والقديم الثابت.
const NEW_SCHEDULE = RAW.gosi.regimes.new_system_saudi.schedule_by_year.map((r) => [r.effective_from, r.employer_total]);
const LEGACY_PCT = RAW.gosi.regimes.legacy_saudi.employer_total;
const CAP = RAW.gosi.contributory_wage.maximum.value;
const pctOn = (date) => NEW_SCHEDULE.filter(([from]) => from <= date).at(-1)[1];

// صيغة السعودي مستقلة عن الكود: الراتب + تأمينات (حتى الحد) + تأمين طبي 600/12 + إجازة (P/30×21)/12 + نهاية خدمة P×0.5/12 + مصاريف 900، ÷ 0.9، MROUND 10.
const saudiCost = (P, pct) => P + Math.min(P, CAP) * pct / 100 + 600 / 12 + (P / 30 * 21) / 12 + (P * 0.5) / 12 + 900;
const saudiPrice = (P, pct) => mround(saudiCost(P, pct) / 0.9);

/* ═════════════ بيانات الأنظمة: القراءة والتحقق ═════════════ */
test("الملف المرجعي: الحصة الحالية للمشترك الجديد 12.75% وللقديم 11.75% (يُقرآن من الملف، والقديم verify)", () => {
  const lab = L.saudiLabor();
  assert.deepEqual(lab.gosi.newSystem.schedule.map((r) => [r.from, r.employerPct]), NEW_SCHEDULE);
  assert.equal(L.gosiEmployerPct(lab.gosi, "new", TODAY).pct, 12.75, "المشترك الجديد الآن");
  assert.equal(L.gosiEmployerPct(lab.gosi, "legacy", TODAY).pct, 11.75, "المشترك القديم");
  assert.equal(L.gosiEmployerPct(lab.gosi, "legacy", TODAY).verify, true, "القديم verify:true في الملف ⇒ قرار مفتوح");
  assert.equal(L.gosiEmployerPct(lab.gosi, "new", TODAY).verify, false, "الجديد مؤكَّد (high)");
  assert.equal(lab.gosi.wageCap, CAP);
  assert.equal(lab.eosb.monthsPerYearFirst5, 0.5);
  assert.equal(lab.leave.days, 21);
});

test("شرائح التأمينات حسب تاريخ سريان النسبة: قبل الزيادة وبعدها، والنظام (جديد/قديم) بتاريخ أول اشتراك", () => {
  const g = L.saudiLabor().gosi;
  for (const [from, pct] of NEW_SCHEDULE) assert.equal(L.gosiEmployerPct(g, "new", from).pct, pct, from);
  assert.equal(L.gosiEmployerPct(g, "new", "2026-06-30").pct, pctOn("2026-06-30"));
  assert.equal(L.gosiEmployerPct(g, "new", "2026-07-01").pct, pctOn("2026-07-01"));
  assert.equal(L.gosiEmployerPct(g, "new", "2024-07-02"), null, "قبل بداية الجدول لا نسبة");
  assert.equal(L.gosiEmployerPct(g, "new", "2026-10-01", "2027-12-31").pct, pctOn("2027-12-31"), "أعلى نسبة داخل المدة");
  const start = g.newSystem.startsOn;
  assert.equal(L.gosiRegimeFor(g, ""), "new");
  assert.equal(L.gosiRegimeFor(g, start), "new");
  assert.equal(L.gosiRegimeFor(g, "2024-07-02"), "legacy");
  assert.equal(L.gosiRegimeFor(g, "garbage"), "new");
});

/* ═════════════ التسعير: صيغة السعودي ═════════════ */
test("سعر السعودي = صيغة مستقلة لكل راتب من 4000 إلى 100000 (جديد 12.75%) وقديم 11.75%", () => {
  for (let P = 4000; P <= 100000; P += 250) {
    const n = rate(P);
    assert.equal(n.status, "ok", String(P));
    assert.equal(n.workerType, "saudi");
    assert.equal(n.billable, saudiPrice(P, pctOn(TODAY)), "جديد @" + P);
    assert.ok(Math.abs(n.internal.cost - saudiCost(P, pctOn(TODAY))) < 0.006, "تكلفة @" + P);
    const o = rate(P, { firstSubscription: "2019-05-01" });
    assert.equal(o.billable, saudiPrice(P, LEGACY_PCT), "قديم @" + P);
    assert.equal(o.internal.gosi.regime, "legacy");
  }
  // لا رسوم أجنبي: بلا حكومي ولا خروج وعودة ولا انضمام ولا تذكرة
  const ln = rate(5000).internal.lines;
  assert.deepEqual(Object.keys(ln).sort(), ["annualLeave", "endOfService", "insurance", "overhead", "package", "socialInsurance"]);
  assert.equal(rate(5000).otHour, 5000 / 240 * 1.5 * 1.2);
});

test("الحد الأعلى للأجر الخاضع: فوق الحد تُحسب التأمينات على الحد لا على الراتب", () => {
  const P = CAP + 20000;
  assert.equal(rate(P).internal.lines.socialInsurance, Math.round(CAP * pctOn(TODAY)) / 100);
  assert.equal(rate(P).billable, saudiPrice(P, pctOn(TODAY)));
});

test("نسبة التأمينات تتبع تاريخ البدء ومدة العقد (rate_basis): start وpeak_in_term", () => {
  const at = (startDate, over = {}, cfg = CFG) => rate(8000, { startDate, ...over }, cfg);
  assert.equal(at("2026-06-15").internal.gosi.employerPct, pctOn("2026-06-15"));
  assert.equal(at("2026-07-01").internal.gosi.employerPct, pctOn("2026-07-01"));
  assert.equal(at("2027-07-01").internal.gosi.employerPct, pctOn("2027-07-01"));
  assert.ok(at("2027-07-01").billable > at("2026-07-01").billable, "الزيادة تنعكس على السعر");
  // عقد يمتد عبر زيادة 1 يوليو: start يسعّر بنسبة البدء، وpeak_in_term بأعلى نسبة داخل المدة
  const p = clone(PRICING); p.package_rate.saudi.social_insurance.rate_basis = "peak_in_term";
  const peak = C.packageRateConfigFromPricing(p);
  assert.equal(at("2027-01-15", { termMonths: 12 }).internal.gosi.employerPct, pctOn("2027-01-15"));
  assert.equal(at("2027-01-15", { termMonths: 12 }, peak).internal.gosi.employerPct, pctOn("2027-12-31"));
  assert.equal(at("2027-01-15", { termMonths: 3 }, peak).internal.gosi.employerPct, pctOn("2027-01-15"), "عقد قصير لا يعبر الزيادة");
});

test("الأرقام تأتي من ملف الأنظمة لا من ثابت: تغيير الملف يغيّر السعر (نسب، حد أعلى، نهاية الخدمة، الإجازة)", () => {
  const base = rate(6000).billable;
  const bump = clone(RAW);
  bump.gosi.regimes.new_system_saudi.schedule_by_year.find((r) => r.effective_from === "2026-07-01").employer_total = 20.75;
  assert.equal(rate(6000, {}, cfgFor(PRICING, bump)).billable, saudiPrice(6000, 20.75));
  assert.ok(saudiPrice(6000, 20.75) > base);
  const cap = clone(RAW); cap.gosi.contributory_wage.maximum.value = 5000;
  assert.equal(rate(9000, {}, cfgFor(PRICING, cap)).billable, saudiPrice9000(5000));
  function saudiPrice9000(capVal) { return mround((9000 + capVal * pctOn(TODAY) / 100 + 50 + (9000 / 30 * 21) / 12 + (9000 * 0.5) / 12 + 900) / 0.9); }
  const eos = clone(RAW); eos.eosb.accrual.formula.months_per_year_first_5 = 1;
  assert.equal(rate(6000, {}, cfgFor(PRICING, eos)).internal.lines.endOfService, 500);
  const lv = clone(RAW); lv.leave_tickets.annual_leave.days_default = 30;
  assert.equal(rate(6000, {}, cfgFor(PRICING, lv)).internal.lines.annualLeave, 6000 / 30 * 30 / 12);
  // وفي ملف الإعداد: الرقم الصريح يغلب "labor"
  const own = clone(PRICING); own.package_rate.saudi.end_of_service_months_per_year = 0.25;
  assert.equal(rate(6000, {}, cfgFor(own)).internal.lines.endOfService, 125);
  // لا نسبة تأمينات مكتوبة في الكود
  const src = fs.readFileSync(path.join(ROOT, "api/_eor-cost.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const lit of ["12.75", "11.75", "12.25", "13.25", "45000"]) assert.equal(src.includes(lit), false, "ثابت نظامي في الكود: " + lit);
});

test("الفشل المغلق: ما لا مصدر له (null) أو فسد ⇒ pending_pricing بلا رقم، والإغلاق بمفتاح enabled", () => {
  const pend = (mutate, labor = RAW, over = {}) => { const p = clone(PRICING); mutate(p.package_rate.saudi); return rate(6000, over, cfgFor(p, labor)); };
  for (const [name, m] of [
    ["margin_on_price", (s) => { s.margin_on_price = null; }], ["mround_step", (s) => { s.mround_step = null; }], ["insurance_yearly", (s) => { s.insurance_yearly = null; }],
    ["overhead_monthly", (s) => { s.overhead_monthly = null; }], ["end_of_service", (s) => { s.end_of_service_months_per_year = null; }],
    ["leave days", (s) => { s.annual_leave.days = null; }], ["employer_rate", (s) => { s.social_insurance.employer_rate = null; }],
    ["wage_cap", (s) => { s.social_insurance.wage_cap = null; }], ["overtime", (s) => { s.overtime = null; }],
  ]) {
    const r = pend(m);
    assert.equal(r.status, "pending_pricing", name);
    assert.ok(Array.isArray(r.missing) && r.missing.length, name);
    assert.equal("billable" in r, false, name);
  }
  assert.equal(pend((s) => { s.enabled = false; }).status, "pending_pricing");
  assert.equal(pend((s) => { s.enabled = "true"; }).status, "pending_pricing", "true وحدها تفتح");
  // ملف الأنظمة ينقصه الجدول أو الحد الأعلى ⇒ بلا رقم
  const noSched = clone(RAW); noSched.gosi.regimes.new_system_saudi.schedule_by_year = [];
  assert.equal(rate(6000, {}, cfgFor(PRICING, noSched)).status, "pending_pricing");
  const noCap = clone(RAW); noCap.gosi.contributory_wage.maximum.value = null;
  assert.equal(rate(6000, {}, cfgFor(PRICING, noCap)).status, "pending_pricing");
  assert.equal(rate(6000, {}, cfgFor(PRICING, null)).status, "pending_pricing", "الملف غائب");
  // تاريخ قبل بداية الجدول (مشترك جديد بتاريخ بدء قديم) ⇒ لا نسبة
  assert.equal(rate(6000, { startDate: "2024-01-01" }).status, "pending_pricing");
  // القديم مغلق بمفتاح price_legacy_cohort
  const noLegacy = clone(PRICING); noLegacy.package_rate.saudi.social_insurance.price_legacy_cohort = false;
  assert.equal(rate(6000, { firstSubscription: "2010-01-01" }, cfgFor(noLegacy)).status, "pending_pricing");
  assert.equal(rate(6000, {}, cfgFor(noLegacy)).status, "ok", "الجديد لا يتأثر");
  // أي مصدر غير "labor" للنسبة لا يُقبل (لا نسبة تُكتب في الإعداد)
  assert.equal(pend((s) => { s.social_insurance.employer_rate = 12.75; }).status, "pending_pricing");
  // غياب كتلة saudi أصلاً
  const none = clone(PRICING); delete none.package_rate.saudi;
  assert.equal(rate(6000, {}, cfgFor(none)).status, "pending_pricing");
  // الأجنبي لا يتأثر بأي من ذلك
  assert.equal(C.computePackageRate({ mode: "lump", package: 2000, config: { ...cfgFor(none), today: TODAY } }).billable, 4820);
});

test("القرارات المفتوحة داخلية فقط: المشترك القديم والبنود verify تُعلَّم في internal وwarnings ولا تصل العميل", () => {
  const legacy = rate(6000, { firstSubscription: "2018-01-01" });
  assert.deepEqual(legacy.internal.openDecisions, ["gosi_legacy_rate_unverified"]);
  assert.deepEqual(legacy.warnings, ["open_decision:gosi_legacy_rate_unverified"]);
  assert.deepEqual(rate(6000).internal.openDecisions, [], "الجديد مؤكَّد");
  // بند استحقاق مأخوذ من الملف وverify:true ⇒ يُعلَّم أيضاً
  const unv = clone(RAW); unv.eosb.accrual.verify = true;
  assert.ok(rate(6000, {}, cfgFor(PRICING, unv)).internal.openDecisions.includes("eosb_unverified"));
  const view = JSON.stringify(C.packageClientView(legacy, CFG));
  assert.equal(/openDecisions|open_decision|legacy|gosi|verify/i.test(view), false);
});

/* ═════════════ التقدير الفوري (estimatePackageQuote / price) ═════════════ */
const IT = (count, nationalities, salary, extra = {}) => ({ count, nationalities, salary, gender: "unspecified", ...extra });

test("السعودي في الطلب: يُسعَّر بمساره، يحترم الحدّ الأدنى 4000، والمختلط لا يُسعَّر إلا بتقسيم البند", async () => {
  const q = E.estimatePackageQuote([IT(2, ["SA"], 5000), IT(1, ["SA"], 3999), IT(1, ["SA", "IN"], 5000), IT(1, ["IN"], 2000)], PRICING, { workerType: "both", now: NOW, startDate: "2026-11-01" });
  assert.equal(q.status, "partial");
  assert.deepEqual(q.lines.map((l) => l.status), ["priced", "below_min", "needs_review", "priced"]);
  assert.equal(q.lines[0].monthlyPerEmployee, saudiPrice(5000, pctOn("2026-11-01")));
  assert.equal(q.lines[0].monthlyTotal, 2 * q.lines[0].monthlyPerEmployee);
  assert.equal(q.lines[1].minSalary, 4000);
  assert.equal("monthlyPerEmployee" in q.lines[2], false);
  // تقسيم المختلط إلى بندين ⇒ كلاهما يُسعَّر
  const split = E.estimatePackageQuote([IT(1, ["SA"], 5000), IT(1, ["IN"], 5000)], PRICING, { workerType: "both", now: NOW });
  assert.equal(split.status, "ok");
  const foreignCost = (P) => P + (9700 + 650 + 240) / 12 + 600 / 12 + (P / 30 * 21) / 12 + 200 / 12 + 3000 / 12 + P / 2 / 12 + P * 0.02 + 900;
  assert.deepEqual(split.lines.map((l) => l.monthlyPerEmployee), [saudiPrice(5000, pctOn(TODAY)), mround(foreignCost(5000) / 0.9)], "كلٌّ بمساره");
  // سعودي بإعداد ناقص يُعلَّم «بعد المراجعة» لبنده وحده ولا يُسقط الأجنبي
  const p = clone(PRICING); p.package_rate.saudi.overhead_monthly = null;
  const part = E.estimatePackageQuote([IT(1, ["SA"], 5000), IT(1, ["IN"], 2000)], p, { workerType: "both", now: NOW });
  assert.deepEqual(part.lines.map((l) => l.status), ["needs_review", "priced"]);
  assert.equal(part.monthlyTotal, 4820);
});

test("تاريخ أول اشتراك: الاختيار يحدّد الشريحة في التقدير، والفاسد يُهمَل في السعر ويُرفض عند الإرسال", async () => {
  const price = (extra) => E.handleEor({ action: "price", workerType: "saudi", durationMonths: 12, startDate: "2026-11-01", items: [{ count: 1, nationalities: ["SA"], salary: 6000, ...extra }] }, { now: NOW, ip: "", pricing: PRICING });
  const neu = (await price({})).quote.lines[0].monthlyPerEmployee;
  const old = (await price({ firstSubscriptionDate: "2019-04-01" })).quote.lines[0].monthlyPerEmployee;
  const afterStart = (await price({ firstSubscriptionDate: "2025-01-01" })).quote.lines[0].monthlyPerEmployee;
  const junk = (await price({ firstSubscriptionDate: "31/12/2019" })).quote.lines[0].monthlyPerEmployee;
  const future = (await price({ firstSubscriptionDate: "2030-01-01" })).quote.lines[0].monthlyPerEmployee;
  assert.equal(neu, saudiPrice(6000, pctOn("2026-11-01")));
  assert.equal(old, saudiPrice(6000, LEGACY_PCT));
  assert.equal(afterStart, neu, "بعد بداية النظام الجديد ⇒ جديد");
  assert.equal(junk, neu);
  assert.equal(future, neu);
  const good = { company: "ش", contactName: "س", email: "a@b.co", phone: "0501234567", city: "الرياض", workerType: "saudi", recruitment: "no", durationMonths: 12, startDate: "2026-11-01" };
  const v = (fs) => E.validateEorRequest({ ...good, items: [{ occupationId: "hosp.waiter", count: 1, nationalities: ["SA"], salary: 5000, ...(fs === undefined ? {} : { firstSubscriptionDate: fs }) }] }, { now: NOW, pricing: PRICING });
  assert.equal(v("2019-04-01").value.items[0].firstSubscriptionDate, "2019-04-01");
  assert.equal("firstSubscriptionDate" in v().value.items[0], false);
  assert.equal(v("").ok, true);
  for (const bad of ["2030-01-01", "31/12/2019", "2019-02-30", "1960-01-01", 5, {}]) assert.equal(v(bad).error, "first_subscription_invalid", String(bad));
});

/* ═════════════ التفصيل: مجموع الأسطر = السعر بالتمام لكل راتب وفئة تأمين ═════════════ */
const sumH = (bd) => bd.lines.reduce((s, x) => s + Math.round(x.amount * 100), 0);
const PROVS = [{}, { housing: "us" }, { meals: "us", transport: "us" }, { housing: "us", meals: "us", transport: "us" }];
const INS_CASES = [
  {}, { insuranceClass: "basic" }, { insuranceClass: "C", ageBand: "18-29" }, { insuranceClass: "B", ageBand: "40-49", gender: "female", maternity: true },
  { insuranceClass: "A", ageBand: "60+", chronic: true, insurer: "bupa" }, { insuranceClass: "A", ageBand: "0-17", gender: "female", maternity: true, chronic: true, insurer: "tawuniya" }, { insuranceClass: "quote" },
];

test("مجموع الأسطر + رسوم الخدمة = السعر الشهري بالهللة تماماً: كل راتب (الأجنبي 400→100000، السعودي 4000→100000) × فئات التأمين × «علينا»", async () => {
  const asks = [];
  for (let P = 400; P <= 100000; P += P < 5000 ? 150 : 1325) asks.push(P);
  asks.push(2000, 2750, 399.99 + 0.01, 12345.67, 99999.99, 100000);
  let checked = 0;
  for (const P of asks) {
    const ins = INS_CASES[checked % INS_CASES.length], pv = PROVS[checked % PROVS.length];
    for (const wt of P >= 4000 ? ["foreign", "saudi"] : ["foreign"]) {
      const nat = wt === "saudi" ? ["SA"] : ["IN"];
      const r = await E.handleEor({ action: "price", workerType: wt, durationMonths: 12, provisions: pv, startDate: "2026-11-01", items: [{ count: 1, nationalities: nat, salary: P, ...ins }] }, { now: NOW, ip: "", pricing: PRICING });
      const ln = r.quote.lines[0];
      assert.equal(ln.status, "priced", `${wt}@${P}`);
      const bd = ln.breakdown;
      assert.ok(bd, `${wt}@${P} تفصيل`);
      assert.equal(sumH(bd), Math.round(ln.monthlyPerEmployee * 100), `${wt}@${P} ${JSON.stringify(ins)} ${JSON.stringify(pv)}`);
      const svc = bd.lines.find((x) => x.key === "service");
      assert.ok(svc && svc.amount > 0, "رسوم الخدمة موجبة");
      assert.equal(bd.lines.filter((x) => x.key === "service").length, 1);
      assert.equal(bd.lines[0].key, "salary");
      assert.equal(bd.lines.at(-1).key, "service");
      assert.equal(new Set(bd.lines.map((x) => x.key)).size, bd.lines.length, "لا تكرار");
      checked++;
    }
  }
  assert.ok(checked > 150, "عدد التركيبات: " + checked);
});

test("أسطر الأجنبي والسعودي وأسماؤها: الأجنبي كل مكوّنات الصيغة، والسعودي بلا رسوم حكومية ولا تأشيرات", async () => {
  const get = async (wt, nat, P, extra = {}) => (await E.handleEor({ action: "price", workerType: wt, durationMonths: 12, startDate: "2026-11-01", items: [{ count: 1, nationalities: nat, salary: P, ...extra }] }, { now: NOW, ip: "", pricing: PRICING })).quote.lines[0].breakdown.lines;
  const f = await get("foreign", ["IN"], 3000);
  assert.deepEqual(f.map((x) => x.key), ["salary", "government", "insurance", "annual_leave", "exit_reentry", "joining", "end_of_service", "social_insurance", "service"]);
  const s = await get("saudi", ["SA"], 6000);
  assert.deepEqual(s.map((x) => x.key), ["salary", "insurance", "annual_leave", "end_of_service", "social_insurance", "service"]);
  const by = Object.fromEntries(s.map((x) => [x.key, x.amount]));
  assert.equal(by.social_insurance, Math.round(6000 * pctOn("2026-11-01")) / 100);
  assert.equal(by.end_of_service, 250);
  assert.equal(by.annual_leave, 350);
  // تذكرة العودة تظهر حين يفعّلها المالك (return_ticket_yearly) وتدخل المجموع
  const p = clone(PRICING); p.package_rate.lump.return_ticket_yearly = 1500;
  const r = (await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 1, nationalities: ["IN"], salary: 3000 }] }, { now: NOW, ip: "", pricing: p })).quote.lines[0];
  const rt = r.breakdown.lines.find((x) => x.key === "return_ticket");
  assert.equal(rt.amount, 125);
  assert.equal(sumH(r.breakdown), Math.round(r.monthlyPerEmployee * 100));
  // إجازة خارج السعر الشهري (تُفوتَر منفصلة) ⇒ لا سطر لها، والمجموع ثابت
  const q = clone(PRICING); q.package_rate.lump.annual_leave.included_in_cost = false; q.package_rate.lump.joining.included_in_cost = false;
  const r2 = (await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 1, nationalities: ["IN"], salary: 3000 }] }, { now: NOW, ip: "", pricing: q })).quote.lines[0];
  assert.equal(r2.breakdown.lines.some((x) => x.key === "annual_leave" || x.key === "joining"), false);
  assert.equal(sumH(r2.breakdown), Math.round(r2.monthlyPerEmployee * 100));
  // رسوم الخدمة السالبة (إعداد شاذ) ⇒ لا تفصيل بدل تصفير صامت يكسر المجموع
  const z = clone(PRICING); z.package_rate.lump.margin_on_price = 0; z.package_rate.lump.mround_step = 1000000;
  const r3 = (await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [{ count: 1, nationalities: ["IN"], salary: 3000 }] }, { now: NOW, ip: "", pricing: z })).quote.lines[0];
  assert.ok(!r3.breakdown || sumH(r3.breakdown) === Math.round(r3.monthlyPerEmployee * 100));
});

/* ═════════════ الخصوصية (canaries): الاسم والمبلغ فقط ═════════════ */
const CAN = clone(PRICING);
Object.assign(CAN.package_rate.lump, { margin_on_price: 0.13579, overhead_monthly: 912.3456, end_of_service_months_per_year: 0.54321, insurance_yearly: 611.2233, social_insurance_rate: 0.02123, exit_reentry_yearly: 211.7771, return_ticket_yearly: 1511.3131 });
CAN.package_rate.lump.annual_government_fees = { residence: 9701.7777, work_permit: 651.8888, ajeer: 241.9999 };
CAN.package_rate.lump.joining.visa_and_joining_yearly = 3011.9191;
Object.assign(CAN.package_rate.saudi, { margin_on_price: 0.14681, overhead_monthly: 923.4567, insurance_yearly: 622.3344, end_of_service_months_per_year: 0.56789 });

test("canaries: لا مرجع نظامي ولا معامل ولا تكلفة خام ولا نسب التأمينات الخام في ردّ الأجنبي ولا السعودي — الاسم والمبلغ فقط", async () => {
  const cfg = C.packageRateConfigFromPricing(CAN);
  const secretsOf = (res) => [String(res.internal.cost), String(res.internal.rate), String(res.internal.profit), String(res.internal.markup), String(res.internal.margin).slice(0, 8)];
  for (const [wt, nat, P] of [["foreign", ["IN"], 2750], ["saudi", ["SA"], 6400]]) {
    const res = C.computePackageRate({ mode: "lump", workerType: wt, package: P, config: { ...cfg, today: TODAY } });
    const reply = JSON.stringify(await E.handleEor({ action: "price", workerType: wt, durationMonths: 12, startDate: "2026-11-01", provisions: { housing: "us", meals: "us", transport: "us" }, items: [{ count: 2, nationalities: nat, salary: P, gender: "female", ageBand: "30-39", insuranceClass: "B", maternity: true, insurer: "bupa", firstSubscriptionDate: "2019-01-01" }] }, { now: NOW, ip: "", pricing: CAN }));
    const raw = ["0.13579", "912.3456", "0.54321", "611.2233", "0.02123", "211.7771", "1511.3131", "9701.7777", "651.8888", "241.9999", "3011.9191", "0.14681", "923.4567", "622.3344", "0.56789",
      "12.75", "11.75", "12.25", "13.25", "13.75", "0.1275", "0.1175", "45000", "45,000", ...secretsOf(res)];
    for (const s of raw) assert.equal(reply.includes(s), false, `${wt}: قيمة داخلية ${s}`);
    // لا مرجع نظامي ولا اسم نظام ولا تسمية داخلية
    assert.equal(/م84|م109|م40|المادة|المقابل المالي|مجلس الوزراء|hrsd|gosi|نظام العمل|الأخطار المهنية|ساند|هامش|ربح|تكلفة|margin|profit|cost|overhead|multiplier|coefficient|article|legal|verify|openDecision|open_decision|regime|rateBasis|wageCap/i.test(reply), false, wt + ": " + (reply.match(/م84|م109|المقابل المالي|gosi|هامش|ربح|تكلفة|verify|open_decision|regime/i) || [])[0]);
    const lines = JSON.parse(reply).quote.lines[0].breakdown.lines;
    for (const ln of lines) assert.deepEqual(Object.keys(ln).sort(), ln.key === "insurance" ? ["amount", "class", "insurer", "key"] : ["amount", "key"], "الاسم والمبلغ فقط (+فئة التأمين وشركته المختارتين)");
  }
});

test("canaries: الصفحة والبريد وNotion بلا مراجع نظامية ولا نسب تأمينات ولا حقول داخلية للسعودي", async () => {
  // الباني يُختبر في tests/eor-request-form.test.mjs؛ هنا الحمولة المرسلة للفريق والعميل والتنبيه
  const sent = { mail: [], notify: [], fetch: [] };
  const ctx = {
    dev: false, notionToken: "secret_test", dbId: "db-test", now: NOW, ip: "", pricing: CAN, refGen: () => "EOR-424242",
    fetch: async (url, init) => { sent.fetch.push(init.body); return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
    sendEmail: async (to, subject, html) => { sent.mail.push({ to, html }); return { ok: true }; },
    notify: async (p) => { sent.notify.push(p); return { ok: true }; }, teamEmail: "team@test.local", ownerEmail: "owner@test.local",
  };
  const r = await E.handleEor({ company: "شركة", contactName: "س", email: "c@example.com", phone: "0501234567", city: "الرياض", workerType: "saudi", recruitment: "no", startDate: "2026-11-01", durationMonths: 12, lang: "ar",
    items: [{ occupationId: "hosp.waiter", count: 1, nationalities: ["SA"], salary: 5000, firstSubscriptionDate: "2019-01-01" }] }, ctx);
  assert.equal(r.ok, true);
  const toClient = sent.mail.find((m) => m.to === "c@example.com").html;
  assert.equal(/ريال|SAR|\d{3,}/.test(toClient.replace(/style="[^"]*"/g, "").replace(/EOR-\d+/g, "")), false, "بريد العميل بلا مبلغ ولا نسبة");
  const wide = sent.fetch.join("\n") + sent.mail.map((m) => m.html).join("\n") + JSON.stringify(sent.notify);
  for (const s of ["0.14681", "923.4567", "622.3344", "0.56789", "12.75", "11.75", "45000"]) assert.equal(wide.includes(s), false, s);
});

test("الصفحات الأربع: أسماء الأسطر الجديدة بكل لغة ومن غير مراجع نظامية ولا نسب", async () => {
  const { buildSimpleEor } = await import("../site/scripts/simple-v1-eor.mjs");
  const { simpleV1 } = await import("../site/scripts/simple-v1.mjs");
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const render = (l) => {
    const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
    const sv1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang: (p, x) => (x === "en" ? p : "/" + x + p), assetV: (x) => x, knowledge: null });
    return buildSimpleEor(sv1, { lang: () => l, esc });
  };
  const KEYS = ["bdGov", "bdLeave", "bdExit", "bdJoin", "bdEos", "bdSocial", "bdReturn", "bdNote"];
  const tx = {};
  for (const l of ["ar", "en", "fr", "zh"]) {
    const h = render(l), cfg = cfgFromHtml(h);
    tx[l] = cfg.tx;
    for (const k of KEYS) assert.ok(typeof cfg.tx[k] === "string" && cfg.tx[k].length >= 2, `${l}.${k}`);
    if (l !== "ar") for (const k of KEYS) assert.equal(/[؀-ۿ]/.test(cfg.tx[k]), false, `${l}.${k} عربية في صفحة ${l}`);
    // لا مرجع نظامي ولا رقم نسبة ولا أسماء أنظمة في الصفحة (خارج الكتالوج العام)
    const page = stripCat(h);
    assert.equal(/12\.75|11\.75|45000|م84|م109|المقابل المالي|hrsd\.gov|gosi\.gov|101319|132249|Article 84|Art\. 84|article 109/i.test(page), false, l);
  }
  for (const k of KEYS) assert.equal(new Set(["ar", "en", "fr", "zh"].map((l) => tx[l][k])).size, 4, `${k}: أربع صياغات مختلفة`);
  assert.equal(tx.ar.bdGov, "رخصة العمل والإقامة وأجير");
  assert.equal(tx.en.bdEos, "End of service (monthly accrual)");
});

test("الصفحة: بند يجمع سعودياً وأجنبياً يُوجَّه إلى التقسيم بدل «بعد المراجعة»، وبعد التقسيم يُسعَّر كلٌّ بمساره", async () => {
  const { bootPage } = await import("./eor-fake-dom.mjs");
  const { buildSimpleEor } = await import("../site/scripts/simple-v1-eor.mjs");
  const { simpleV1 } = await import("../site/scripts/simple-v1.mjs");
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const html = (l) => {
    const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
    const sv1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang: (p, x) => (x === "en" ? p : "/" + x + p), assetV: (x) => x, knowledge: null });
    return buildSimpleEor(sv1, { lang: () => l, esc });
  };
  for (const [l, re] of [["ar", /قسّمه إلى بندين/], ["en", /split it into two rows/]]) {
    const dom = bootPage(html(l), { server: (b) => E.handleEor(b, { ip: "", now: NOW, dev: true, pricing: PRICING }) });
    await dom.flush();
    const card = dom.$("eorItems").children[0];
    const inputs = dom.find(card, (e) => e.tagName === "INPUT");
    const nat = dom.byClass(card, "sv1-eor-chipin")[0], nums = inputs.filter((e) => e.type === "number"), price = dom.byClass(card, "sv1-eor-price")[0];
    for (const q of l === "ar" ? ["السعودية", "الهند"] : ["Saudi", "India"]) { dom.type(nat, q); dom.key(nat, "Enter"); }
    nums[0].value = "1"; nums[1].value = "6000"; nums[1].fire("input"); await dom.flush();
    assert.match(price.textContent, re, l);
    assert.ok(price._cls.includes("hold"));
  }
});
