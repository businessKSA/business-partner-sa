// وحدات المدة (ساعة/يوم/شهر/سنة) وشركات التأمين وأوصاف الفئات — أمر المالك 2026-10-08. api/_eor.js وapi/_eor-cost.js.
// الحساب المرجعي هنا بأعداد صحيحة مكتوبة مستقلة عن الكود. الاختبار بلا شبكة: Notion يُحقن (ctx.fetch).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-dur-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const C = await import("../api/_eor-cost.js");
const E = await import("../api/_eor.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
const NOW = Date.parse("2026-10-09T09:00:00Z");
const clone = (o) => JSON.parse(JSON.stringify(o));
const WAITER = (extra = {}) => ({ occupationId: "hosp.waiter", count: 2, nationalities: ["IN"], salary: 2000, ...extra });
const body = (extra = {}, items = [WAITER()]) => ({ company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض", workerType: "foreign", recruitment: "no", items, startDate: "2026-11-01", lang: "ar", ...extra });
const v = (b) => E.validateEorRequest(b, { now: NOW });
const CAS = { billingUnit: "hourly", quantity: 10 };

/* ═════════════ المدة: الوحدات والسقوف ═════════════ */
test("الثوابت: القائمة البيضاء والسقوف", () => {
  assert.deepEqual([...E.DURATION_UNITS], ["hour", "day", "month", "year"]);
  assert.deepEqual({ ...E.DURATION_MAX }, { hour: 10000, day: 3650, month: 120, year: 10 });
});

test("التعاقد: شهر وسنة بسقفيهما؛ الحدّ الأقصى يُقبل وما بعده يُرفض duration_invalid", () => {
  for (const [unit, max] of [["month", 120], ["year", 10]]) {
    const ok = v(body({ durationUnit: unit, durationValue: max }));
    assert.equal(ok.ok, true, unit);
    assert.equal(ok.value.durationUnit, unit);
    assert.equal(ok.value.durationValue, max);
    assert.equal(ok.value.durationMonths, unit === "year" ? 120 : 120);
    for (const bad of [max + 1, 0, -1, 1.5, "abc", "1e2", {}, [3]]) {
      const r = v(body({ durationUnit: unit, durationValue: bad }));
      assert.equal(r.ok, false, `${unit} ${JSON.stringify(bad)}`);
      assert.equal(r.error, "duration_invalid");
      assert.equal(r.status, 400);
    }
  }
  const s = v(body({ durationUnit: "year", durationValue: "3" }));          // نص رقمي يُقبل
  assert.equal(s.value.durationValue, 3); assert.equal(s.value.durationMonths, 36);
});

test("المرنة: ساعة ويوم وشهر بسقوفها؛ بلا أشهر للساعة واليوم", () => {
  const items = [WAITER(CAS)];
  for (const [unit, max] of [["hour", 10000], ["day", 3650], ["month", 120]]) {
    const ok = v(body({ engagementType: "casual", durationUnit: unit, durationValue: max }, items));
    assert.equal(ok.ok, true, unit);
    assert.equal(ok.value.durationUnit, unit); assert.equal(ok.value.durationValue, max);
    assert.equal(ok.value.durationMonths, unit === "month" ? max : null);
    assert.equal(v(body({ engagementType: "casual", durationUnit: unit, durationValue: max + 1 }, items)).error, "duration_invalid");
  }
});

test("وحدة غير مقبولة للنوع تُسقَط إلى month بلا خطأ", () => {
  // تعاقد + ساعة/يوم ⇒ شهر: ceil(ساعات ÷ 720) / ceil(أيام ÷ 30)، ويُحصر في 1..120
  const h = v(body({ durationUnit: "hour", durationValue: 1500 }));
  assert.deepEqual([h.ok, h.value.durationUnit, h.value.durationValue, h.value.durationMonths], [true, "month", 3, 3]);   // 1500/720 = 2.08 ⇒ 3
  const d = v(body({ durationUnit: "day", durationValue: 45 }));
  assert.deepEqual([d.value.durationUnit, d.value.durationValue], ["month", 2]);                                          // 45/30 = 1.5 ⇒ 2
  const dMax = v(body({ durationUnit: "day", durationValue: 3650 }));
  assert.equal(dMax.value.durationValue, 120);                                                                            // 122 ⇒ يُحصر
  const hMin = v(body({ durationUnit: "hour", durationValue: 1 }));
  assert.equal(hMin.value.durationValue, 1);
  // durationMonths القديم المرافق يغلب الترجمة
  const both = v(body({ durationUnit: "day", durationValue: 45, durationMonths: 6 }));
  assert.deepEqual([both.value.durationUnit, both.value.durationValue], ["month", 6]);
  // مرنة + سنة ⇒ شهر × 12
  const y = v(body({ engagementType: "casual", durationUnit: "year", durationValue: 2 }, [WAITER(CAS)]));
  assert.deepEqual([y.ok, y.value.durationUnit, y.value.durationValue, y.value.durationMonths], [true, "month", 24, 24]);
  // وفوق سقف الوحدة الأصلية يبقى مرفوضاً حتى لو كانت ستُسقَط
  assert.equal(v(body({ durationUnit: "hour", durationValue: 10001 })).error, "duration_invalid");
});

test("وحدة مجهولة ⇒ month (قائمة بيضاء)؛ والقيمة وحدها تكفي", () => {
  for (const u of ["weeks", "", null, 5, "YEAR ", "__proto__", "MONTHS"]) {
    const r = v(body({ durationUnit: u, durationValue: 6 }));
    const expectYear = typeof u === "string" && u.trim().toLowerCase() === "year";
    assert.equal(r.ok, true, String(u));
    assert.equal(r.value.durationUnit, expectYear ? "year" : "month", String(u));
  }
  assert.equal(v(body({ durationValue: 9 })).value.durationUnit, "month");
});

test("التوافق العكسي: durationMonths القديم وحده ⇒ month/القيمة نفسها وتبقى القيم القديمة صالحة", () => {
  const r = v(body({ durationMonths: 12 }));
  assert.deepEqual([r.ok, r.value.durationUnit, r.value.durationValue, r.value.durationMonths], [true, "month", 12, 12]);
  assert.equal(v(body({ durationMonths: "18" })).value.durationValue, 18);
  assert.equal(v(body({ durationMonths: 120 })).ok, true);
  assert.equal(v(body({ durationMonths: 121 })).error, "duration_invalid");
  // الوحدة الجديدة تغلب القديم حين تتعارضان
  const w = v(body({ durationMonths: 12, durationUnit: "year", durationValue: 2 }));
  assert.deepEqual([w.value.durationUnit, w.value.durationValue, w.value.durationMonths], ["year", 2, 24]);
});

test("فشل مغلق: بلا أي مدة ⇒ duration_invalid؛ وقيمة فاسدة لا تعود إلى القديم بصمت", () => {
  assert.equal(v(body({})).error, "duration_invalid");
  assert.equal(v(body({ durationUnit: "year" })).error, "duration_invalid");
  assert.equal(v(body({ durationValue: 0, durationMonths: 12 })).error, "duration_invalid");
  assert.equal(v(body({ durationValue: 3, durationMonths: "x" })).error, "duration_invalid");
});

test("durationText: عربي وإنجليزي بأعداده الصحيحة", () => {
  assert.equal(E.durationText("month", 12), "12 شهراً");
  assert.equal(E.durationText("month", 1), "شهر واحد");
  assert.equal(E.durationText("year", 2), "سنتان");
  assert.equal(E.durationText("year", 5), "5 سنوات");
  assert.equal(E.durationText("day", 11), "11 يوماً");
  assert.equal(E.durationText("hour", 3), "3 ساعات");
  assert.equal(E.durationText("hour", 100), "100 ساعة");
  assert.equal(E.durationText("year", 3, "en"), "3 years");
  assert.equal(E.durationText("weeks", 3), "");
  assert.equal(E.durationText("day", 0), "");
});

/* ═════════════ التسعير: إجمالي السنة ═════════════ */
const price = (extra, items = [WAITER()]) => E.handleEor({ action: "price", workerType: "foreign", items, ...extra }, { now: NOW, ip: "", pricing: PRICING });

test("مدة بالسنة: الإجمالي التقديري = السعر الشهري × 12 × السنوات (سعر العميل نفسه)", async () => {
  const one = await price({ durationMonths: 12 });
  assert.equal(one.quote.status, "ok");
  const monthly = one.quote.monthlyTotal;                                 // 2 موظفين × 4820 (مرجع الورقة عند 2000)
  assert.equal(monthly, 9640);
  const y3 = await price({ durationUnit: "year", durationValue: 3 });
  assert.deepEqual(y3.quote.duration, { unit: "year", value: 3 });
  assert.equal(y3.quote.durationMonths, 36);
  assert.equal(y3.quote.termTotal, 9640 * 12 * 3);
  // الشهر لا يضيف إجمالياً (السلوك القديم) لكنه يعرّف المدة
  const m = await price({ durationUnit: "month", durationValue: 6 });
  assert.equal("termTotal" in m.quote, false);
  assert.deepEqual(m.quote.duration, { unit: "month", value: 6 });
  assert.equal(m.quote.durationMonths, 6);
  // القديم وحده لا يضيف مفتاح duration
  assert.equal("duration" in one.quote, false);
  assert.equal(one.quote.durationMonths, 12);
});

test("action=price متساهل مع المدة الفاسدة (لا 400)، والمرنة بالساعة/اليوم تعرض المدة بلا أشهر", async () => {
  for (const extra of [{ durationUnit: "year", durationValue: 99 }, { durationValue: "abc" }, { durationUnit: "x", durationValue: -3 }]) {
    const r = await price(extra);
    assert.equal(r.ok, true);
    assert.equal(r.quote.status, "ok");
    assert.equal("termTotal" in r.quote, false);
  }
  const c = await price({ engagementType: "casual", durationUnit: "hour", durationValue: 80 }, [WAITER({ billingUnit: "hourly", quantity: 10 })]);
  assert.equal(c.quote.status, "ok");
  assert.deepEqual(c.quote.duration, { unit: "hour", value: 80 });
  assert.equal(c.quote.durationMonths, null);
  assert.equal("termTotal" in c.quote, false);
  // تعاقد + يوم ⇒ يُسقَط إلى شهر في الردّ
  const d = await price({ durationUnit: "day", durationValue: 90 });
  assert.deepEqual(d.quote.duration, { unit: "month", value: 3 });
});

/* ═════════════ السجل والبريد ═════════════ */
async function submit(b, pricing = PRICING) {
  const calls = [];
  const emails = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }), text: async () => "" };
  };
  const r = await E.handleEor(b, { now: NOW, ip: "", pricing, fetch, notionToken: "t", dbId: "db", dev: false, refGen: () => "EOR-100001",
    sendEmail: async (to, subject, html) => { emails.push({ to, subject, html }); return { ok: true }; }, notify: async () => ({ ok: true }) });
  return { r, calls, emails };
}
const richText = (p) => p.rich_text.map((x) => x.text.content).join("");

test("Notion للفريق: «المدة» نص، و«المدة (أشهر)» للشهر والسنة فقط، والبريد يحمل المدة", async () => {
  const yr = await submit(body({ durationUnit: "year", durationValue: 2 }));
  assert.equal(yr.r.ok, true);
  const props = yr.calls[0].body.properties;
  assert.equal(richText(props["المدة"]), "سنتان");
  assert.equal(props["المدة (أشهر)"].number, 24);
  const team = yr.emails.find((e) => e.subject.includes("EOR-100001") && e.to !== "sara@example.com");
  assert.ok(team.html.includes("سنتان"));
  const legacy = await submit(body({ durationMonths: 12 }));
  assert.equal(richText(legacy.calls[0].body.properties["المدة"]), "12 شهراً");
  assert.equal(legacy.calls[0].body.properties["المدة (أشهر)"].number, 12);
  const hrs = await submit(body({ engagementType: "casual", durationUnit: "hour", durationValue: 80 }, [WAITER(CAS)]));
  assert.equal(hrs.r.ok, true);
  assert.equal(richText(hrs.calls[0].body.properties["المدة"]), "80 ساعة");
  assert.equal("المدة (أشهر)" in hrs.calls[0].body.properties, false);
  // سرد الصفحة JSON يحمل الوحدة والقيمة
  const blk = JSON.parse(hrs.calls[0].body.children[0].code.rich_text.map((x) => x.text.content).join(""));
  assert.deepEqual([blk.durationUnit, blk.durationValue, blk.durationMonths], ["hour", 80, null]);
  // عمود «المدة» غائب في Notion ⇒ يُسقَط ولا يضيع الطلب
  const calls = [];
  const fetch = async (url, init) => {
    const b = JSON.parse(init.body); calls.push(b);
    if ("المدة" in b.properties) return { ok: false, status: 400, text: async () => "المدة is not a property that exists." };
    return { ok: true, status: 200, json: async () => ({ id: "abc" }), text: async () => "" };
  };
  const r = await E.handleEor(body({ durationMonths: 12 }), { now: NOW, ip: "", pricing: PRICING, fetch, notionToken: "t", dbId: "db", dev: false, sendEmail: async () => ({ ok: true }), notify: async () => ({ ok: true }) });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
  assert.equal("المدة (أشهر)" in calls[1].properties, true);
});

test("جسم SOW يعرض المدة بوحدتها، ويبقى القديم", () => {
  const a = E.buildScopeOfWork({ company: "ش", items: [], durationUnit: "year", durationValue: 2, startDate: "" }, "ar");
  assert.ok(a.text.includes("سنتان"));
  const b = E.buildScopeOfWork({ company: "ش", items: [], durationUnit: "year", durationValue: 2 }, "en");
  assert.ok(b.text.includes("2 years"));
  const old = E.buildScopeOfWork({ company: "ش", items: [], durationMonths: 12 }, "ar");
  assert.ok(old.text.includes("12 أشهر"));
});

/* ═════════════ شركات التأمين ═════════════ */
const ASK = { insuranceClass: "B", ageBand: "30-39", gender: "female" };
const factorPricing = (id, f) => { const p = clone(PRICING); p.package_rate.insurance_catalog.insurers.find((x) => x.id === id).price_factor = f; return p; };

test("الكتالوج: ثمان شركات + any، أسماء عربية وإنجليزية، وكل المعاملات 1.0", () => {
  const list = PRICING.package_rate.insurance_catalog.insurers;
  assert.deepEqual(list.map((x) => x.id), ["any", "bupa", "tawuniya", "medgulf", "malath", "walaa", "rajhi_takaful", "arabian_shield", "allianz_sf"]);
  assert.equal(PRICING.package_rate.insurance_catalog.default_insurer, "any");
  for (const x of list) { assert.ok(x.name_ar && x.name_en, x.id); assert.equal(x.price_factor, 1.0, x.id); }
  const names = Object.fromEntries(list.map((x) => [x.id, [x.name_ar, x.name_en]]));
  assert.deepEqual(names.bupa, ["بوبا العربية", "Bupa Arabia"]);
  assert.deepEqual(names.allianz_sf, ["أليانز السعودي الفرنسي", "Allianz Saudi Fransi"]);
  assert.match(PRICING.package_rate.insurance_catalog._insurers, /تُراجع مع قائمة مجلس الضمان الصحي/);
});

test("insurer مجهول أو فاسد ⇒ any؛ والمعروف يبقى", () => {
  for (const bad of [undefined, null, "", 7, {}, [], "Bupa!", "../x", "__proto__", "x".repeat(60), "9bupa"]) {
    assert.equal(C.normalizeInsuranceFields({ ...ASK, insurer: bad }).insurer, "any", JSON.stringify(bad));
  }
  assert.equal(C.normalizeInsuranceFields({ ...ASK, insurer: " BUPA " }).insurer, "bupa");
  const cfg = C.packageRateConfigFromPricing(PRICING);
  const unknown = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: "nonexistent_co" }, config: cfg });
  const any = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: "any" }, config: cfg });
  assert.equal(unknown.billable, any.billable);
  assert.equal(unknown.insurance.insurer, "any");
});

test("المعاملات الافتراضية 1.0 ⇒ كل الشركات بسعر any نفسه", () => {
  const cfg = C.packageRateConfigFromPricing(PRICING);
  const base = C.computePackageRate({ mode: "lump", package: 2000, insurance: ASK, config: cfg }).billable;
  for (const id of PRICING.package_rate.insurance_catalog.insurers.map((x) => x.id)) {
    const r = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: id }, config: cfg });
    assert.equal(r.billable, base, id);
    assert.equal(r.insurance.insurer, id);
  }
});

test("price_factor يغيّر السعر عند ضبطه (اختباراً فقط): قسط الفئة B × المعامل، بحساب صحيح مستقل", () => {
  // B، عمر 30-39 (×1.1)، أنثى (×1.0)، بلا خصم، بضريبة 15%: قسط شهري = 4200 × 1.1 × 1.15 ÷ 12
  const monthlyH = (factor) => Number((2n * 420000n * 1100000n * 1000000n * 1150000n * BigInt(Math.round(factor * 1e6)) + 12n * 10n ** 24n) / (24n * 10n ** 24n));
  assert.equal(monthlyH(1), 44275);
  const cfg = (f) => C.packageRateConfigFromPricing(factorPricing("bupa", f));
  for (const f of [1.0, 1.25, 0.8, 2]) {
    const p = C.insurancePremium({ ...ASK, insurer: "bupa" }, cfg(f).insurance);
    assert.equal(p.status, "applied");
    assert.equal(p.monthlyHalalas, monthlyH(f), String(f));
    assert.equal(p.insurer, "bupa");
  }
  // السعر الفعلي للعميل يتحرك (مضاعف 10) والآخرون لا يتأثرون
  const hi = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: "bupa" }, config: cfg(2) });
  const same = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: "tawuniya" }, config: cfg(2) });
  const lo = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: "bupa" }, config: C.packageRateConfigFromPricing(PRICING) });
  assert.ok(hi.billable > lo.billable);
  assert.equal(hi.billable % 10, 0);
  assert.equal(same.billable, lo.billable);
  assert.equal(hi.insurance.deltaMonthly, hi.billable - C.computePackageRate({ mode: "lump", package: 2000, config: C.packageRateConfigFromPricing(PRICING) }).billable);
  // الأساسي لا يتأثر بالشركة مهما كان معاملها
  const basic = C.computePackageRate({ mode: "lump", package: 2000, insurance: { insuranceClass: "basic", insurer: "bupa" }, config: cfg(5) });
  assert.equal(basic.billable, 4820);
});

test("معامل شركة فاسد ⇒ الأساسي (فشل مغلق) لا سعر مشوَّه؛ ومعامل any المحذوف ⇒ 1", () => {
  for (const bad of [0, -1, "x", null, 101, NaN]) {
    const r = C.computePackageRate({ mode: "lump", package: 2000, insurance: { ...ASK, insurer: "bupa" }, config: C.packageRateConfigFromPricing(factorPricing("bupa", bad)) });
    assert.equal(r.status, "ok");
    assert.equal(r.billable, 4820, String(bad));
    assert.equal(r.insurance.status, "basic");
  }
  const noFactor = clone(PRICING); delete noFactor.package_rate.insurance_catalog.insurers[0].price_factor;
  const a = C.computePackageRate({ mode: "lump", package: 2000, insurance: ASK, config: C.packageRateConfigFromPricing(noFactor) });
  assert.equal(a.insurance.status, "applied");
});

test("ما يراه العميل: اسم شركته المفضّلة (معرّفاً) وقوائم الشركات والأوصاف — بلا معامل ولا قسط", async () => {
  const q = await price({ durationMonths: 12 }, [WAITER({ ...ASK, insurer: "bupa", maternity: false })]);
  assert.equal(q.quote.lines[0].insurance.insurer, "bupa");
  assert.deepEqual(q.quote.insuranceUi.insurers.map((x) => x.id), PRICING.package_rate.insurance_catalog.insurers.map((x) => x.id));
  assert.deepEqual(Object.keys(q.quote.insuranceUi.insurers[1]), ["id", "nameAr", "nameEn"]);
  assert.equal(q.quote.insuranceUi.defaultInsurer, "any");
  assert.deepEqual(q.quote.insuranceUi.classes.map((x) => x.id), ["basic", "C", "B", "A", "quote"]);
  for (const c of q.quote.insuranceUi.classes) { assert.ok(c.descAr && c.descEn, c.id); assert.equal(/\d/.test(c.descAr + c.descEn), false, "لا أرقام في الوصف " + c.id); }
  // مجهول ⇒ any
  const u = await price({ durationMonths: 12 }, [WAITER({ ...ASK, insurer: "zzz" })]);
  assert.equal(u.quote.lines[0].insurance.insurer, "any");
});

test("canaries: معاملات الشركات لا تظهر في أي ردّ للعميل (price، الحسابات بأدوار غير ops، الطلب، Notion، البريد)", async () => {
  const CAN = clone(PRICING);
  const f = { bupa: 1.3771, tawuniya: 0.9123 };
  for (const x of CAN.package_rate.insurance_catalog.insurers) if (f[x.id]) x.price_factor = f[x.id];
  const secrets = ["1.3771", "0.9123", "price_factor", "priceFactor", "insurerPriceFactor"];
  const clean = (label, text) => { for (const s of secrets) assert.equal(text.includes(s), false, `${label}: ${s}`); };
  const cfg = C.packageRateConfigFromPricing(CAN);
  const res = C.computePackageRate({ mode: "lump", package: 2750, insurance: { ...ASK, insurer: "bupa" }, config: cfg });
  assert.ok(JSON.stringify(res.internal).includes("1.3771"), "ops يحمل المعامل فعلاً");
  clean("view", JSON.stringify(C.packageClientView(res, cfg)));
  for (const role of ["client", "vendor", "candidate", undefined, "", "admin"]) clean("role " + role, JSON.stringify(C.packageRateForRole({ mode: "lump", package: 2750, insurance: { ...ASK, insurer: "bupa" }, config: cfg }, role)));
  clean("ui", JSON.stringify(C.insuranceUiFromConfig(cfg)));
  clean("estimate", JSON.stringify(E.estimatePackageQuote([WAITER({ ...ASK, insurer: "bupa", salary: 2750 })], CAN, { workerType: "foreign", now: NOW })));
  const api = await E.handleEor({ action: "price", workerType: "foreign", durationMonths: 12, items: [WAITER({ ...ASK, insurer: "tawuniya", salary: 2750 })] }, { now: NOW, ip: "", pricing: CAN });
  clean("api/price", JSON.stringify(api));
  const sub = await submit(body({ durationMonths: 12 }, [WAITER({ ...ASK, insurer: "bupa", salary: 2750 })]), CAN);
  assert.equal(sub.r.ok, true);
  clean("ردّ الطلب", JSON.stringify(sub.r));
  clean("Notion", JSON.stringify(sub.calls));
  clean("البريد", JSON.stringify(sub.emails));
  // تفضيل الفريق: الاسم العربي يظهر في سجلّ الفريق وبريده
  assert.ok(richText(sub.calls[0].body.properties["بنود المهن"]).includes("الشركة المفضّلة: بوبا العربية"));
  assert.ok(sub.emails.some((e) => e.html.includes("بوبا العربية")));
  const anyRun = await submit(body({ durationMonths: 12 }, [WAITER({ ...ASK, insurer: "any", salary: 2750 })]), CAN);
  assert.equal(richText(anyRun.calls[0].body.properties["بنود المهن"]).includes("الشركة المفضّلة"), false);
  // شركة مجهولة ⇒ any فلا تظهر في السجل
  const unk = await submit(body({ durationMonths: 12 }, [WAITER({ ...ASK, insurer: "evil_co", salary: 2750 })]), CAN);
  assert.equal(richText(unk.calls[0].body.properties["بنود المهن"]).includes("evil_co"), false);
});

test("أوصاف الفئات: بلا أرقام ولا وعود، وللفئات الخمس، وتعليق المراجعة القانونية موجود", () => {
  const cls = PRICING.package_rate.insurance_catalog.classes;
  for (const k of ["basic", "C", "B", "A", "quote"]) {
    assert.ok(cls[k].description_ar && cls[k].description_en, k);
    assert.equal(/\d|%|100|يضمن|نضمن|guarantee/i.test(cls[k].description_ar + cls[k].description_en), false, k);
  }
  assert.match(PRICING.package_rate.insurance_catalog._class_descriptions_review, /يراجَع قانونياً/);
});
