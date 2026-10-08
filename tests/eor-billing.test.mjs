// الفوترة الشهرية لموظفي EOR والعمالة المرنة — api/_eor-billing.js.
// الحسابات المرجعية هنا أعداد صحيحة مكتوبة بيد مستقلة عن الكود (BigInt). Notion يُحاكى بذاكرة (fake) تحفظ الصفوف بصيغة القراءة
// وتطبّق الفلاتر والترقيم وأعمدة غائبة، فتُختبر الاستعلامات والتحويلات والفشل المغلق بلا شبكة.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-billing-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const B = await import("../api/_eor-billing.js");
const E = await import("../api/_eor.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
const NOW = Date.parse("2026-11-03T09:00:00Z");           // الشهر الجاري 2026-11 (توقيت الرياض)
const clone = (o) => JSON.parse(JSON.stringify(o));

// مرجع مستقل: round-half-up(a×b÷c)
const mdh = (a, b, c) => Number((2n * BigInt(a) * BigInt(b) + BigInt(c)) / (2n * BigInt(c)));
const CFG = { vatRate: 0.15, proration: "full_month", currency: "SAR", pricesIncludeVat: false };
const CL = "org:aaaaaaaa-1111-2222-3333-444444444444";
const PL = (id, over = {}) => ({ id, clientId: CL, employeeName: "اسم " + id, employeeNo: "E-" + id, occupationId: "hosp.waiter", engagement: "contract", unit: "month",
  unitPriceHalalas: 482000, overtimeHourHalalas: 1500, costUnitHalalas: null, vendorId: "", currency: "SAR", startDate: "2026-01-01", endDate: null, status: "active", ...over });
const TS = (placementId, over = {}) => ({ id: "t-" + placementId, placementId, clientId: CL, month: "2026-10", status: "approved", monthsH: 100, daysH: null, hoursH: null, overtimeH: 0, ...over });
const build = (placements, timesheets, config = CFG, month = "2026-10") => B.buildInvoice({ clientId: CL, month, placements, timesheets, config });

/* ═════════════ الحساب النقي ═════════════ */
test("العقد الشهري + الإضافي + الضريبة: صفوف مرجعية بالأعداد الصحيحة", () => {
  // 4820 ريال شهرياً، إضافي 15 ريال/ساعة، 10.5 ساعة إضافية
  const r = build([PL("a")], [TS("a", { overtimeH: 1050 })]);
  assert.equal(r.status, "ok");
  assert.equal(r.lines.length, 2);
  assert.deepEqual(r.lines.map((l) => [l.kind, l.quantityH, l.unitPriceHalalas, l.amountHalalas]), [["base", 100, 482000, 482000], ["overtime", 1050, 1500, 15750]]);
  const sub = 482000 + 15750;
  assert.equal(r.subtotalHalalas, sub);
  assert.equal(r.vatHalalas, mdh(sub * 15, 1, 100));                    // 74662.5 ⇒ 74663 (نصف لأعلى)
  assert.equal(r.vatHalalas, 74663);
  assert.equal(r.totalHalalas, sub + 74663);
  assert.equal(r.vatRate, 0.15);
  assert.equal(r.currency, "SAR");
});

test("المرنة بالساعة واليوم والشهر: السعر المثبَّت × الكمية المعتمدة، وتقريب نصف لأعلى لكل سطر", () => {
  const ps = [
    PL("h", { engagement: "casual", unit: "hour", unitPriceHalalas: 8335, overtimeHourHalalas: null }),
    PL("d", { engagement: "casual", unit: "day", unitPriceHalalas: 66672, overtimeHourHalalas: null }),
    PL("m", { engagement: "casual", unit: "month", unitPriceHalalas: 400000, overtimeHourHalalas: null }),
  ];
  const r = build(ps, [TS("h", { monthsH: null, hoursH: 1225 }), TS("d", { monthsH: null, daysH: 650 }), TS("m", { monthsH: 50 })]);
  assert.equal(r.status, "ok");
  const by = Object.fromEntries(r.lines.map((l) => [l.placementId, l.amountHalalas]));
  assert.equal(by.h, mdh(8335 * 1225, 1, 100));                         // 102103.75 ⇒ 102104
  assert.equal(by.h, 102104);
  assert.equal(by.d, 433368);                                           // 666.72 × 6.5
  assert.equal(by.m, 200000);                                           // 4000 × 0.5
  assert.equal(r.subtotalHalalas, 102104 + 433368 + 200000);
  assert.equal(r.vatHalalas, mdh(r.subtotalHalalas * 15, 1, 100));
});

test("المرنة لا إضافي لها: إضافي في ورقة مرنة ⇒ خطأ لا سطر", () => {
  const r = build([PL("h", { engagement: "casual", unit: "hour", unitPriceHalalas: 8334, overtimeHourHalalas: null })], [TS("h", { monthsH: null, hoursH: 800, overtimeH: 100 })]);
  assert.equal(r.status, "invalid_input");
  assert.ok(r.errors.some((e) => e.error === "overtime_not_allowed"));
});

test("لا يدخل سطرٌ بدوام غير معتمد؛ والمعلَّق يُذكر «بانتظار الاعتماد» لا يُفوتَر", () => {
  const ps = [PL("a"), PL("b"), PL("c"), PL("d"), PL("e")];
  const r = build(ps, [TS("a"), TS("b", { status: "submitted" }), TS("c", { status: "draft" }), TS("d", { status: "rejected" })]);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.lines.map((l) => l.placementId), ["a"]);
  assert.deepEqual(Object.fromEntries(r.pending.map((p) => [p.placementId, p.reason])), { b: "timesheet_submitted", c: "timesheet_draft", d: "timesheet_rejected", e: "no_timesheet" });
  assert.equal(r.subtotalHalalas, 482000);
  // لا شيء معتمد ⇒ nothing_to_bill مع قائمة المعلَّقين
  const none = build(ps, [TS("a", { status: "submitted" })]);
  assert.equal(none.status, "nothing_to_bill");
  assert.equal(none.pending.length, 5);
  assert.equal("subtotalHalalas" in none, false);
  // ورقة شهر آخر لا تحسب
  assert.equal(build([PL("a")], [TS("a", { month: "2026-09" })]).status, "nothing_to_bill");
});

test("التقسيم النسبي: الافتراضي شهر كامل؛ calendar_days بأيام النشاط ÷ أيام الشهر (للتعاقد وحده)", () => {
  const start = PL("a", { startDate: "2026-10-11" });                    // 21 من 31 يوماً
  assert.equal(build([start], [TS("a")]).lines[0].amountHalalas, 482000);                       // شهر كامل
  const cd = build([start], [TS("a", { overtimeH: 200 })], { ...CFG, proration: "calendar_days" });
  assert.equal(cd.lines[0].amountHalalas, mdh(482000 * 21, 1, 31));      // 326516.13 ⇒ 326516
  assert.equal(cd.lines[0].amountHalalas, 326516);
  assert.deepEqual([cd.lines[0].prorationDays, cd.lines[0].prorationOf], [21, 31]);
  assert.equal(cd.lines[1].amountHalalas, 3000);                         // الإضافي لا يُقسَّم
  const end = build([PL("a", { endDate: "2026-10-10" })], [TS("a")], { ...CFG, proration: "calendar_days" });
  assert.equal(end.lines[0].amountHalalas, mdh(482000 * 10, 1, 31));     // 155483.87 ⇒ 155484
  const both = build([PL("a", { startDate: "2026-10-05", endDate: "2026-10-20" })], [TS("a")], { ...CFG, proration: "calendar_days" });
  assert.equal(both.lines[0].amountHalalas, mdh(482000 * 16, 1, 31));
  // أشهر معتمدة 0.5 × نسبة 21/31 بتقريب واحد
  const half = build([start], [TS("a", { monthsH: 50 })], { ...CFG, proration: "calendar_days" });
  assert.equal(half.lines[0].amountHalalas, mdh(482000 * 50 * 21, 1, 100 * 31));
  // المرنة لا تُقسَّم
  const cas = build([PL("m", { engagement: "casual", unit: "month", unitPriceHalalas: 400000, overtimeHourHalalas: null, startDate: "2026-10-20" })], [TS("m")], { ...CFG, proration: "calendar_days" });
  assert.equal(cas.lines[0].amountHalalas, 400000);
});

test("تنسيب غير فعّال في الشهر يُستبعد بلا ادّعاء انتظار: لم يبدأ/انتهى/ملغى", () => {
  const r = build([PL("a"), PL("future", { startDate: "2026-11-01" }), PL("old", { endDate: "2026-09-30" }), PL("x", { status: "cancelled" }), PL("ended", { status: "ended", endDate: "2026-10-15" })], [TS("a"), TS("ended")]);
  assert.deepEqual(r.lines.map((l) => l.placementId).sort(), ["a", "ended"]);
  assert.deepEqual(Object.fromEntries(r.excluded.map((e) => [e.placementId, e.reason])), { future: "not_active_in_month", old: "not_active_in_month", x: "placement_cancelled" });
  assert.equal(r.pending.length, 0);
});

test("مدخلات فاسدة: تنسيب عميل آخر، ورقة مكررة أو لعميل آخر، سعر غير صحيح، تاريخ فاسد، عملتان", () => {
  const err = (res, code) => { assert.equal(res.status, "invalid_input"); assert.ok(res.errors.some((e) => e.error === code), code + " " + JSON.stringify(res.errors)); };
  err(build([PL("a", { clientId: "org:bbbbbbbb-1111-2222-3333-444444444444" })], []), "foreign_placement");
  err(build([PL("a")], [TS("a"), { ...TS("a"), id: "t2" }]), "duplicate_timesheet");
  err(build([PL("a")], [TS("a", { clientId: "org:bbbbbbbb-1111-2222-3333-444444444444" })]), "sheet_client_mismatch");
  err(build([PL("a", { unitPriceHalalas: 4820.5 })], [TS("a")]), "not_halalas");
  err(build([PL("a", { unitPriceHalalas: -1 })], [TS("a")]), "not_halalas");
  err(build([PL("a", { startDate: "2026-02-30" })], [TS("a")]), "invalid_date");
  err(build([PL("a"), PL("b", { currency: "USD" })], [TS("a"), TS("b")]), "mixed_currency");
  err(build([PL("a", { status: "weird" })], [TS("a")]), "unknown_status");
  err(build([PL("a", { engagement: "contract", unit: "hour" })], [TS("a", { monthsH: null, hoursH: 100 })]), "contract_must_be_monthly");
  err(build([PL("a")], [TS("a", { status: "bogus" })]), "unknown_status");
  err(build([PL("a")], [TS("a", { daysH: 100 })]), "quantity_unit_mismatch");
  err(build([PL("a")], [TS("a", { monthsH: 101 })]), "quantity_out_of_range");
  err(build([PL("a", { overtimeHourHalalas: null })], [TS("a", { overtimeH: 100 })]), "overtime_price_missing");
  assert.equal(B.buildInvoice({ clientId: CL, month: "2026-13", placements: [], timesheets: [], config: CFG }).status, "invalid_input");
  assert.equal(B.buildInvoice({ clientId: CL, month: "2026-10", placements: [], timesheets: [], config: { ...CFG, vatRate: 1.5 } }).status, "invalid_input");
  assert.equal(B.buildInvoice({ clientId: "", month: "2026-10", placements: [], timesheets: [], config: CFG }).status, "invalid_input");
});

test("حدود الأرقام: ساعات ≤ 744، أيام ≤ أيام الشهر، أشهر ≤ 1، إضافي ≤ 744 (التحقق عند الإدخال وعند البناء)", () => {
  const V = (input, unit, extra = {}) => B.validateTimesheetQuantities(input, { engagement: "contract", unit, month: "2026-10", ...extra });
  assert.equal(V({ hours: 744 }, "hour").quantityH, 74400);
  assert.equal(V({ hours: 744.01 }, "hour").error, "quantity_out_of_range");
  assert.equal(V({ hours: 745 }, "hour").error, "quantity_out_of_range");
  assert.equal(V({ hours: 744, overtimeHours: 744 }, "hour").overtimeH, 74400);
  assert.equal(V({ months: 1 }, "month").quantityH, 100);
  assert.equal(V({ months: 1.01 }, "month").error, "quantity_out_of_range");
  assert.equal(V({ months: 0 }, "month").quantityH, 0);
  assert.equal(V({ days: 31 }, "day").quantityH, 3100);
  assert.equal(B.validateTimesheetQuantities({ days: 31 }, { engagement: "casual", unit: "day", month: "2026-11" }).error, "quantity_out_of_range");     // نوفمبر 30 يوماً
  assert.equal(B.validateTimesheetQuantities({ days: 29 }, { engagement: "casual", unit: "day", month: "2028-02" }).quantityH, 2900);                     // فبراير كبيسة
  assert.equal(B.validateTimesheetQuantities({ days: 29 }, { engagement: "casual", unit: "day", month: "2026-02" }).error, "quantity_out_of_range");
  for (const bad of [-1, "-1", "1e2", "8.555", "abc", NaN, Infinity, null, [], {}, true, "٨"]) {
    const r = V({ months: bad }, "month");
    assert.equal(r.ok, false, String(bad));
  }
  assert.equal(V({ months: "0.5" }, "month").quantityH, 50);
  assert.equal(V({ months: 1, days: 3 }, "month").error, "quantity_unit_mismatch");
  assert.equal(V({}, "month").error, "quantity_required");
  assert.equal(V({ months: 1, overtimeHours: 745 }, "month").error, "overtime_out_of_range");
  assert.equal(B.validateTimesheetQuantities({ hours: 8, overtimeHours: 1 }, { engagement: "casual", unit: "hour", month: "2026-10" }).error, "overtime_not_allowed");
  assert.equal(V({ hours: 700 }, "hour", { hoursMax: 600 }).error, "quantity_out_of_range");                // سقف الإعداد أدنى
  // البناء يعيد الفحص: ورقة بساعات 744.01 تصل البناء من Notion مباشرة ⇒ ترفض
  const r = build([PL("h", { engagement: "casual", unit: "hour", unitPriceHalalas: 100, overtimeHourHalalas: null })], [TS("h", { monthsH: null, hoursH: 74401 })]);
  assert.equal(r.status, "invalid_input");
});

test("أسعار شاملة الضريبة (قرار مفتوح): الإجمالي = المجموع والضريبة مستخرجة", () => {
  const r = build([PL("a")], [TS("a")], { ...CFG, pricesIncludeVat: true });
  assert.equal(r.totalHalalas, 482000);
  assert.equal(r.vatHalalas, mdh(482000 * 150000, 1, 1150000));          // 62869.57 ⇒ 62870
  assert.equal(r.subtotalHalalas, 482000 - r.vatHalalas);
  assert.equal(r.pricesIncludeVat, true);
});

test("الرقم التسلسلي BP-INV-YYYYMM-NNNN: يتزايد بلا تكرار ويتجاهل غير الشهر والتالف", () => {
  assert.equal(B.nextSerial("2026-10", []), "BP-INV-202610-0001");
  assert.equal(B.nextSerial("2026-10", ["BP-INV-202610-0001", "BP-INV-202610-0007", "BP-INV-202609-0099", "garbage", "", null, 5, "BP-INV-202610-12", "BP-INV-202610-00ab"]), "BP-INV-202610-0008");
  assert.equal(B.nextSerial("2026-10", ["BP-INV-202610-9999"]), "BP-INV-202610-10000");
  assert.equal(B.isSerial("BP-INV-202610-0001"), true);
  assert.equal(B.isSerial("BP-INV-2026-0001"), false);
  assert.throws(() => B.nextSerial("2026-1", []));
});

test("البصمة تتغيّر بحالة الورقة وكمياتها وسعر الوحدة وتثبت بترتيب المدخلات", () => {
  const a = build([PL("a"), PL("b")], [TS("a"), TS("b")]);
  const sameOrder = build([PL("b"), PL("a")], [TS("b"), TS("a")]);
  assert.equal(a.digest, sameOrder.digest);
  assert.notEqual(a.digest, build([PL("a"), PL("b")], [TS("a"), TS("b", { status: "submitted" })]).digest);
  assert.notEqual(a.digest, build([PL("a"), PL("b")], [TS("a"), TS("b", { overtimeH: 100 })]).digest);
  assert.notEqual(a.digest, build([PL("a"), PL("b", { unitPriceHalalas: 482010 })], [TS("a"), TS("b")]).digest);
});

/* ═════════════ العرض: قائمة بيضاء وcanaries ═════════════ */
const CAN = { vendor: "VND-CANARY-7741", cost: 7771234, costSar: "77712.34", margin: 4410099, ref: 2753.21, ver: "pricingInput-canary-91" };
function canaryInvoice(over = {}) {
  const lines = [{ kind: "base", placementId: "p1", employeeName: "خالد", employeeNo: "E-7", occupationId: "hosp.waiter", engagement: "contract", unit: "month", quantityH: 100, unitPriceHalalas: 482000, amountHalalas: 482000,
    vendorId: CAN.vendor, costUnitHalalas: CAN.cost, marginHalalas: CAN.margin, pricingInput: { salary: CAN.ref }, priceSource: CAN.ver }];
  return { id: "abc", clientId: CL, clientName: "شركة الأمل", month: "2026-10", serial: "BP-INV-202610-0001", status: "issued", currency: "SAR", lines,
    internalLines: [{ placementId: "p1", kind: "base", vendorId: CAN.vendor, costUnitHalalas: CAN.cost, costAmountHalalas: CAN.cost, marginHalalas: CAN.margin }],
    pending: [{ placementId: "p2", employeeName: "سعد", employeeNo: "E-8", reason: "no_timesheet" }], subtotalHalalas: 482000, vatHalalas: 72300, totalHalalas: 554300, vatRate: 0.15,
    issuedAt: "2026-11-03", dueAt: "2026-12-03", paymentRef: "PAY-CANARY-1", cancelReason: "", digest: "d", corrupt: false, internalCfg: { vatRate: 0.15 }, ...over };
}
test("clientInvoiceView: قائمة بيضاء حرفياً، بلا تكلفة ولا ربح ولا هامش ولا مورّد ولا مصدر ولا معاملات", () => {
  const v = B.clientInvoiceView(canaryInvoice());
  assert.deepEqual(Object.keys(v), ["id", "number", "month", "status", "currency", "lines", "subtotal", "vatRate", "vat", "total", "issuedAt", "dueDate"]);
  assert.deepEqual(Object.keys(v.lines[0]), ["kind", "employeeName", "employeeNo", "occupation", "descriptionAr", "descriptionEn", "unit", "quantity", "unitPrice", "amount"]);
  assert.deepEqual(v.lines[0].occupation.id, "hosp.waiter");
  assert.equal(v.lines[0].unitPrice, 4820); assert.equal(v.lines[0].amount, 4820); assert.equal(v.total, 5543);
  const s = JSON.stringify(v);
  for (const t of [CAN.vendor, String(CAN.cost), CAN.costSar, String(CAN.margin), String(CAN.ref), CAN.ver, "PAY-CANARY-1", "internal", "vendor", "cost", "margin", "profit", "pricingInput", "priceSource", "digest", "pending", "E-8", "سعد", "placementId"]) assert.equal(s.includes(t), false, t);
});

test("clientInvoiceView: المسودة والتالف والمُلغاة غير المُصدَرة لا تُعرض؛ والمُلغاة المُصدَرة تُعرض بحالتها", () => {
  assert.equal(B.clientInvoiceView(canaryInvoice({ status: "draft", serial: "" })), null);
  assert.equal(B.clientInvoiceView(canaryInvoice({ corrupt: true })), null);
  assert.equal(B.clientInvoiceView(canaryInvoice({ status: "cancelled", serial: "" })), null);
  assert.equal(B.clientInvoiceView(canaryInvoice({ status: "cancelled" })).status, "cancelled");
  assert.equal(B.clientInvoiceView(null), null);
  assert.equal(B.clientInvoiceView(canaryInvoice({ status: "weird" })), null);
});

test("opsInvoiceView للمالك: التكلفة والهامش إن توفّرا لكل الأسطر الأساسية، وإلا null", () => {
  const o = B.opsInvoiceView(canaryInvoice());
  assert.equal(o.costHalalas, CAN.cost);
  assert.equal(o.marginHalalas, 482000 - CAN.cost);
  const none = B.opsInvoiceView(canaryInvoice({ internalLines: [{ placementId: "p1", kind: "base", costUnitHalalas: null, costAmountHalalas: null, marginHalalas: null }] }));
  assert.equal(none.costHalalas, null); assert.equal(none.marginHalalas, null);
  assert.equal(o.pending[0].employeeNo, "E-8");
});

/* ═════════════ Notion المحاكى ═════════════ */
function fakeNotion({ allowed = null, failQuery = false, forcePageSize = 0, failWrites = false } = {}) {
  const pages = new Map();
  let seq = 0;
  const log = [];
  const idOf = (n) => { const h = n.toString(16).padStart(32, "0"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
  const toRead = (props) => {
    const out = {};
    for (const [k, v] of Object.entries(props || {})) {
      if ("title" in v) out[k] = { type: "title", title: v.title.map((x) => ({ plain_text: x.text.content })) };
      else if ("rich_text" in v) out[k] = { type: "rich_text", rich_text: v.rich_text.map((x) => ({ plain_text: x.text.content })) };
      else if ("number" in v) out[k] = { type: "number", number: v.number };
      else if ("select" in v) out[k] = { type: "select", select: v.select };
      else if ("date" in v) out[k] = { type: "date", date: v.date };
    }
    return out;
  };
  const plain = (p) => (p ? (p.rich_text || p.title || []).map((x) => x.plain_text).join("") : "");
  const match = (pg, f) => {
    if (f.and) return f.and.every((x) => match(pg, x));
    if (f.rich_text) return plain(pg.properties[f.property]) === f.rich_text.equals;
    throw new Error("filter not supported");
  };
  const resp = (status, json) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(json), json: async () => json });
  const checkProps = (dbId, props) => {
    if (!allowed) return null;
    const ok = allowed[dbId];
    for (const k of Object.keys(props || {})) if (ok && !ok.includes(k)) return resp(400, { object: "error", code: "validation_error", message: `${k} is not a property that exists.` });
    return null;
  };
  async function fetch(url, init) {
    const u = new URL(url); const body = init.body ? JSON.parse(init.body) : null;
    log.push({ method: init.method, path: u.pathname, body });
    assert.ok(/Bearer /.test(init.headers.Authorization));
    if (failQuery && /\/query$/.test(u.pathname)) return resp(500, { object: "error" });
    if (failWrites && init.method !== "GET" && !/\/query$/.test(u.pathname)) return resp(500, { object: "error" });
    let m;
    if (init.method === "POST" && u.pathname === "/v1/pages") {
      const dbId = body.parent.database_id.replace(/-/g, "");
      const bad = checkProps(dbId, body.properties); if (bad) return bad;
      seq++;
      const pg = { object: "page", id: idOf(seq), created_time: new Date(Date.UTC(2026, 10, 1) + seq * 1000).toISOString(), archived: false, parent: { type: "database_id", database_id: idOf(1000 + parseInt(dbId.slice(-2), 16)) }, properties: toRead(body.properties) };
      pg.parent.database_id = body.parent.database_id;
      pages.set(pg.id.replace(/-/g, ""), pg);
      return resp(200, pg);
    }
    if ((m = u.pathname.match(/^\/v1\/pages\/([0-9a-f]{32})$/))) {
      const pg = pages.get(m[1]);
      if (!pg) return resp(404, { object: "error", code: "object_not_found" });
      if (init.method === "GET") return resp(200, pg);
      if (init.method === "PATCH") {
        const bad = checkProps(pg.parent.database_id.replace(/-/g, ""), body.properties); if (bad) return bad;
        if (body.properties) Object.assign(pg.properties, toRead(body.properties));
        if (body.archived !== undefined) pg.archived = body.archived;
        return resp(200, pg);
      }
    }
    if (init.method === "POST" && (m = u.pathname.match(/^\/v1\/databases\/([0-9a-f]{32})\/query$/))) {
      let rows = [...pages.values()].filter((p) => p.parent.database_id.replace(/-/g, "") === m[1] && !p.archived);
      if (body.filter) rows = rows.filter((p) => match(p, body.filter));
      rows.sort((a, b) => a.created_time.localeCompare(b.created_time));
      const size = forcePageSize || body.page_size || 100;
      const start = body.start_cursor ? Number(body.start_cursor) : 0;
      const slice = rows.slice(start, start + size);
      return resp(200, { object: "list", results: slice, has_more: start + size < rows.length, next_cursor: start + size < rows.length ? String(start + size) : null });
    }
    return resp(404, { object: "error", code: "object_not_found" });
  }
  return { fetch, pages, log, writes: () => log.filter((l) => l.method !== "GET" && !/\/query$/.test(l.path)) };
}
const DB = { p: "a".repeat(30) + "01", t: "b".repeat(30) + "02", i: "c".repeat(30) + "03" };
const ENV = { EOR_PLACEMENTS_DB: DB.p, EOR_TIMESHEETS_DB: DB.t, EOR_INVOICES_DB: DB.i };
const OPS = { role: "ops" };
const SESSION_A = { user: { id: "aaaaaaaa-0000-0000-0000-000000000001", email: "A@Client.example" }, organization: { id: "aaaaaaaa-1111-2222-3333-444444444444" } };
const SESSION_B = { user: { id: "bbbbbbbb-0000-0000-0000-000000000001", email: "b@other.example" }, organization: { id: "bbbbbbbb-1111-2222-3333-444444444444" } };
const AUTH_A = B.authFromSession(SESSION_A), AUTH_B = B.authFromSession(SESSION_B);
function api(fake, defaults = {}) {
  return (body, auth, over = {}) => B.handleEorBilling(body, { auth, pricing: PRICING, now: NOW, fetch: fake.fetch, notionToken: "t", env: ENV, ...defaults, ...over });
}
const placeBody = (over = {}) => ({ action: "create-placement", clientId: CL, clientName: "شركة الأمل", employeeName: "خالد الحربي", employeeNo: "E-100", occupationId: "hosp.waiter", engagementType: "contract", workerType: "foreign", salary: 2000, startDate: "2026-01-01", ...over });
const sheetBody = (placementId, over = {}) => ({ action: "submit-timesheet", placementId, month: "2026-10", months: 1, ...over });

/* ═════════════ الهوية ═════════════ */
test("authFromSession وnormalizeClientId", () => {
  assert.deepEqual(AUTH_A.keys, ["org:aaaaaaaa-1111-2222-3333-444444444444", "user:aaaaaaaa-0000-0000-0000-000000000001", "email:a@client.example"]);
  assert.equal(AUTH_A.role, "client");
  assert.equal(B.authFromSession(null), null);
  assert.equal(B.authFromSession({ user: {} }), null);
  assert.equal(B.authFromSession({ user: { id: "x y\n" } }), null);
  for (const bad of ["", "org:", "org:x", "client", "email:nope", "org:../../etc/passwd", 7, null, "email:a@b", "user:" + "a".repeat(80)]) assert.equal(B.normalizeClientId(bad), "", String(bad));
  assert.equal(B.normalizeClientId(" ORG:AAAAAAAA-1111-2222 "), "org:aaaaaaaa-1111-2222");
});

/* ═════════════ الفشل المغلق بلا إعداد ═════════════ */
test("بلا معرّفات القواعد أو الرمز: 503 not_configured لكل الإجراءات ولا يُنادى Notion", async () => {
  const fake = fakeNotion();
  const A = api(fake);
  const bodies = [placeBody(), { action: "list-placements" }, sheetBody("a".repeat(32)), { action: "list-timesheets" }, { action: "approve-timesheet", timesheetId: "a".repeat(32), version: "x" },
    { action: "generate-invoice", clientId: CL, month: "2026-10" }, { action: "issue-invoice", invoiceId: "a".repeat(32) }, { action: "cancel-invoice", invoiceId: "a".repeat(32), reason: "x" },
    { action: "record-payment", invoiceId: "a".repeat(32), paymentRef: "x" }, { action: "list-invoices" }, { action: "get-invoice", invoiceId: "a".repeat(32) }];
  const envs = [{}, { EOR_PLACEMENTS_DB: DB.p }, { EOR_PLACEMENTS_DB: DB.p, EOR_TIMESHEETS_DB: DB.t }, { ...ENV, EOR_INVOICES_DB: "not-an-id" }, { ...ENV, EOR_TIMESHEETS_DB: "" }];
  for (const env of envs) for (const b of bodies) {
    const auth = ["approve-timesheet"].includes(b.action) ? AUTH_A : OPS;
    const r = await A(b, auth, { env });
    assert.equal(r.status, 503, b.action + JSON.stringify(env));
    assert.equal(r.error, "not_configured");
  }
  const noToken = await A(placeBody(), OPS, { notionToken: "", env: ENV });
  assert.equal(noToken.error, "not_configured");
  assert.equal(fake.log.length, 0, "لا نداء Notion واحد");
  assert.deepEqual(B.billingDbIds({ EOR_PLACEMENTS_DB: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE" }), { placements: "aaaaaaaabbbbccccddddeeeeeeeeeeee", timesheets: "", invoices: "" });
});

test("المصادقة: بلا auth ⇒ 401، والدور غير المسموح ⇒ 403، وإجراء مجهول ⇒ 400", async () => {
  const fake = fakeNotion(); const A = api(fake);
  for (const auth of [undefined, null, {}, { role: "client" }, { role: "client", keys: [] }, { role: "vendor" }, { role: "OPS" }, "ops"]) assert.equal((await A({ action: "list-invoices" }, auth)).status, 401, JSON.stringify(auth));
  assert.equal((await A(placeBody(), AUTH_A)).status, 403);
  assert.equal((await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, AUTH_A)).status, 403);
  assert.equal((await A({ action: "approve-timesheet", timesheetId: "a".repeat(32), version: "v" }, OPS)).status, 403);        // الاعتماد للعميل وحده
  assert.equal((await A({ action: "nope" }, OPS)).status, 400);
  assert.equal((await A(null, OPS)).status, 400);
  assert.equal(fake.log.length, 0);
  // وعبر handleEor نفسه (نقطة الدخول)
  const via = await E.handleEor({ action: "list-invoices" }, { ctx: 1, pricing: PRICING, fetch: fake.fetch, notionToken: "t" });
  assert.equal(via.status, 401);
  const via2 = await E.handleEor({ action: "list-invoices" }, { auth: OPS, pricing: PRICING, fetch: fake.fetch, notionToken: "t", env: ENV });
  assert.equal(via2.status === 503 || via2.ok === true, true);
});

/* ═════════════ التنسيب ═════════════ */
test("create-placement للتعاقد: السعر لقطة من الحاسبة (4820 / إضافي 15)، وتكلفة المالك داخلية", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const r = await A(placeBody(), OPS);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.placement.unitPriceHalalas, 482000);
  assert.equal(r.placement.overtimeHourHalalas, 1500);
  assert.equal(r.placement.unit, "month");
  assert.equal(r.placement.currency, "SAR");
  assert.equal(r.placement.priceSource, "config");
  assert.ok(r.placement.costUnitHalalas > 0 && r.placement.costUnitHalalas < 482000);
  assert.equal(r.placement.status, "active");
  const row = [...fake.pages.values()][0].properties;
  assert.equal(row[B.PLACEMENT_PROPS.unitPrice].number, 482000);
  assert.equal(row[B.PLACEMENT_PROPS.client].rich_text[0].plain_text, CL);
  assert.equal(row[B.PLACEMENT_PROPS.engagement].select.name, "تعاقد (EOR)");
  // العميل لا يرى السعر ولا التكلفة في تنسيبه
  const mine = await A({ action: "list-placements" }, AUTH_A);
  assert.equal(mine.placements.length, 1);
  assert.deepEqual(Object.keys(mine.placements[0]), ["id", "employeeName", "employeeNo", "occupation", "engagementType", "unit", "startDate", "endDate", "status"]);
});

test("create-placement للمرنة: ساعة/يوم/شهر من الحاسبة (8334 / 66672 / 400000)", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const mk = async (unit, no, extra = {}) => (await A(placeBody({ engagementType: "casual", billingUnit: unit, employeeNo: no, ...extra }), OPS));
  const h = await mk("hourly", "H1"), d = await mk("daily", "D1", { hoursPerDay: 8 }), m = await mk("monthly", "M1");
  assert.deepEqual([h.placement.unitPriceHalalas, h.placement.unit, h.placement.overtimeHourHalalas], [8334, "hour", null]);
  assert.deepEqual([d.placement.unitPriceHalalas, d.placement.unit], [66672, "day"]);
  assert.deepEqual([m.placement.unitPriceHalalas, m.placement.unit], [400000, "month"]);
  assert.equal(h.placement.costUnitHalalas, 4167);
  assert.equal((await mk("hourly", "H2", { overtimeHourHalalas: 100, unitPriceHalalas: 9000 })).error, "overtime_not_allowed");
  assert.equal((await mk("weekly", "W1")).error, "billing_unit_invalid");
  assert.equal((await mk("daily", "D2", { hoursPerDay: 3 })).error, "hours_per_day_invalid");
});

test("لقطة السعر: تغيير ملف الإعداد بعد التنسيب لا يغيّر فاتورته، وتنسيب جديد يأخذ الجديد", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const p = await A(placeBody(), OPS);
  assert.equal(p.placement.unitPriceHalalas, 482000);
  const changed = clone(PRICING);
  changed.package_rate.lump.overhead_monthly = 1900;                        // +1000 على التكلفة
  changed.package_rate.casual.sale_multiplier = 3;
  const s = await A(sheetBody(p.placement.id), OPS, { pricing: changed });
  const ap = await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, AUTH_A, { pricing: changed });
  assert.equal(ap.timesheet.status, "approved");
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS, { pricing: changed });
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal(g.invoice.lines[0].unitPriceHalalas, 482000);               // اللقطة لا الإعداد الجديد
  const p2 = await A(placeBody({ employeeNo: "E-101" }), OPS, { pricing: changed });
  assert.ok(p2.placement.unitPriceHalalas > 482000);                       // الجديد يأخذ الإعداد الجديد
});

test("create-placement: التحقق والفشل المغلق (سعودي غير مُسعَّر، تكرار، تواريخ، مهنة، سعر صريح)", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const err = async (over, code, status = 400) => { const r = await A(placeBody(over), OPS); assert.equal(r.ok, false, code); assert.equal(r.error, code, JSON.stringify(r)); assert.equal(r.status, status); };
  await err({ clientId: "bad" }, "client_invalid");
  await err({ employeeName: " " }, "employee_name_required");
  await err({ employeeNo: "" }, "employee_no_required");
  await err({ occupationId: "nope" }, "occupation_unknown");
  await err({ engagementType: "x" }, "engagement_invalid");
  await err({ workerType: "both" }, "worker_type_invalid");
  await err({ startDate: "2026-02-30" }, "start_date_invalid");
  await err({ endDate: "2025-12-31" }, "end_date_invalid");
  await err({ salary: 0 }, "salary_invalid");
  await err({ salary: "abc" }, "salary_invalid");
  await err({ salary: 1e9 }, "salary_invalid");
  await err({ requestRef: "x" }, "request_ref_invalid");
  await err({ vendorId: "bad id!" }, "vendor_invalid");
  await err({ workerType: "saudi" }, "not_applicable", 409);               // الصيغة للأجنبي وحده حتى يقرر المالك
  assert.equal(fake.writes().length, 0, "لا كتابة عند أي رفض");
  assert.equal((await A(placeBody(), OPS)).ok, true);
  await err({}, "duplicate_placement", 409);
  // سعر متفق عليه صريح (للسعودي مثلاً): يشترط سعر الإضافي للتعاقد
  await err({ employeeNo: "S1", workerType: "saudi", unitPriceHalalas: 500000 }, "overtime_price_required");
  const ov = await A(placeBody({ employeeNo: "S1", workerType: "saudi", unitPriceHalalas: 500000, overtimeHourHalalas: 1600, costUnitHalalas: 450000, salary: undefined }), OPS);
  assert.equal(ov.ok, true, JSON.stringify(ov));
  assert.deepEqual([ov.placement.unitPriceHalalas, ov.placement.overtimeHourHalalas, ov.placement.costUnitHalalas, ov.placement.priceSource], [500000, 1600, 450000, "override"]);
  await err({ employeeNo: "S2", unitPriceHalalas: 4820.5, overtimeHourHalalas: 1, salary: undefined }, "unitPriceHalalas_invalid");
  // إعداد تسعير غائب ⇒ pricing_pending
  const none = await A(placeBody({ employeeNo: "Z1" }), OPS, { pricing: null });
  assert.equal(none.error, "pricing_pending");
});

/* ═════════════ ورقة الدوام والملكية ═════════════ */
async function seed(A, { clientNo = "E-100", over = {} } = {}) {
  const p = await A(placeBody({ employeeNo: clientNo, ...over }), OPS);
  assert.equal(p.ok, true, JSON.stringify(p));
  return p.placement;
}
test("submit → approve: العميل يعتمد بإصدار الورقة الذي رآه؛ وغيره لا يرى ولا يعتمد (ملكية)", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const p = await seed(A);
  const s = await A(sheetBody(p.id, { overtimeHours: 4.5 }), OPS);
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.equal(s.timesheet.status, "submitted");
  assert.deepEqual([s.timesheet.months, s.timesheet.overtimeHours], [1, 4.5]);
  // العميل الآخر
  assert.deepEqual((await A({ action: "list-timesheets" }, AUTH_B)).timesheets, []);
  assert.deepEqual((await A({ action: "list-placements" }, AUTH_B)).placements, []);
  const foreign = await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, AUTH_B);
  assert.equal(foreign.status, 404); assert.equal(foreign.error, "not_found");
  assert.equal((await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version, decision: "reject" }, AUTH_B)).status, 404);
  // صاحب التنسيب
  const mine = await A({ action: "list-timesheets", month: "2026-10" }, AUTH_A);
  assert.equal(mine.timesheets.length, 1);
  assert.equal((await A({ action: "approve-timesheet", timesheetId: s.timesheet.id }, AUTH_A)).error, "version_required");
  assert.equal((await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: "stale" }, AUTH_A)).error, "timesheet_changed");
  const ok = await A({ action: "approve-timesheet", timesheetId: mine.timesheets[0].id, version: mine.timesheets[0].version }, AUTH_A);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.timesheet.status, "approved");
  const row = fake.pages.get(s.timesheet.id).properties;
  assert.equal(row[B.TIMESHEET_PROPS.approvedBy].rich_text[0].plain_text, "a@client.example");
  assert.equal(row[B.TIMESHEET_PROPS.status].select.name, "معتمدة من العميل");
  assert.equal((await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: "whatever" }, AUTH_A)).unchanged, true);      // تكرار الطلب آمن
  // ورقة بمعرّف صفحة من قاعدة أخرى أو غير موجودة ⇒ 404/400
  assert.equal((await A({ action: "approve-timesheet", timesheetId: p.id, version: "v" }, AUTH_A)).status, 404);        // معرّف تنسيب لا ورقة
  assert.equal((await A({ action: "approve-timesheet", timesheetId: "f".repeat(32), version: "v" }, AUTH_A)).status, 404);
  assert.equal((await A({ action: "approve-timesheet", timesheetId: "bad", version: "v" }, AUTH_A)).status, 400);
});

test("ملكية عبر أي معرّف في الجلسة (org/user/email) ولا تتسرّب بين العملاء", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const byEmail = await A(placeBody({ clientId: "email:a@client.example", employeeNo: "E-1" }), OPS);
  const byUser = await A(placeBody({ clientId: "user:aaaaaaaa-0000-0000-0000-000000000001", employeeNo: "E-2" }), OPS);
  const other = await A(placeBody({ clientId: "org:bbbbbbbb-1111-2222-3333-444444444444", employeeNo: "E-3" }), OPS);
  assert.deepEqual([byEmail.ok, byUser.ok, other.ok], [true, true, true]);
  const a = await A({ action: "list-placements" }, AUTH_A), b = await A({ action: "list-placements" }, AUTH_B);
  assert.deepEqual(a.placements.map((p) => p.employeeNo).sort(), ["E-1", "E-2"]);
  assert.deepEqual(b.placements.map((p) => p.employeeNo), ["E-3"]);
  assert.equal((await A({ action: "list-placements" }, OPS)).placements.length, 3);
  assert.equal((await A({ action: "list-placements", clientId: "org:bbbbbbbb-1111-2222-3333-444444444444" }, OPS)).placements.length, 1);
  // العميل لا يستطيع تمرير clientId لرؤية غيره
  assert.deepEqual((await A({ action: "list-placements", clientId: "org:bbbbbbbb-1111-2222-3333-444444444444" }, AUTH_A)).placements.map((p) => p.employeeNo).sort(), ["E-1", "E-2"]);
});

test("submit-timesheet: حدود وملكية الوحدة والشهر (مستقبلي، غير نشط، ساعات 745، إضافي للمرنة، وحدة خاطئة)", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const c = await seed(A, { clientNo: "C1" });
  const h = await seed(A, { clientNo: "H1", over: { engagementType: "casual", billingUnit: "hourly" } });
  const late = await seed(A, { clientNo: "L1", over: { startDate: "2026-10-20" } });
  const e = async (body, code, status = 400) => { const r = await A(body, OPS); assert.equal(r.error, code, JSON.stringify(r)); assert.equal(r.status, status); };
  await e(sheetBody(c.id, { month: "2026-12" }), "month_in_future");
  await e(sheetBody(c.id, { month: "2026-13" }), "month_invalid");
  await e(sheetBody(c.id, { months: 1.5 }), "quantity_out_of_range");
  await e(sheetBody(c.id, { months: undefined }), "quantity_required");
  await e(sheetBody(c.id, { days: 3 }), "quantity_unit_mismatch");
  await e(sheetBody(c.id, { overtimeHours: 745 }), "overtime_out_of_range");
  await e(sheetBody(c.id, { status: "approved" }), "status_invalid");
  await e(sheetBody(h.id, { months: undefined, hours: 745 }), "quantity_out_of_range");
  await e(sheetBody(h.id, { months: undefined, hours: 100, overtimeHours: 1 }), "overtime_not_allowed");
  await e(sheetBody("zzz"), "placement_invalid");
  await e(sheetBody(late.id, { month: "2026-09" }), "placement_not_active_in_month", 409);
  assert.equal((await A(sheetBody(h.id, { months: undefined, hours: 744 }), OPS)).ok, true);
  assert.equal((await A(sheetBody(c.id, { status: "draft" }), OPS)).timesheet.status, "draft");
  // المسودة لا تظهر للعميل
  assert.equal((await A({ action: "list-timesheets" }, AUTH_A)).timesheets.every((t) => t.status !== "draft"), true);
  // العميل لا يقدّم أوراقاً
  assert.equal((await A(sheetBody(c.id), AUTH_A)).status, 403);
});

test("إعادة التقديم تعيد الورقة للمراجعة، والرفض يُسجَّل، والمُفوتَرة مقفلة", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const p = await seed(A);
  let s = await A(sheetBody(p.id), OPS);
  const rej = await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, decision: "reject", reason: "ساعات غير صحيحة" }, AUTH_A);
  assert.equal(rej.timesheet.status, "rejected");
  assert.equal(fake.pages.get(s.timesheet.id).properties[B.TIMESHEET_PROPS.rejectReason].rich_text[0].plain_text, "ساعات غير صحيحة");
  assert.equal((await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: rej.timesheet.version }, AUTH_A)).error, "not_submitted");
  s = await A(sheetBody(p.id, { overtimeHours: 2 }), OPS);                                  // تصحيح وإعادة تقديم على الصف نفسه
  assert.equal(s.timesheet.status, "submitted");
  assert.equal([...fake.pages.values()].filter((x) => x.parent.database_id === DB.t).length, 1);
  const ap = await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, AUTH_A);
  assert.equal(ap.timesheet.status, "approved");
  // تعديل بعد الاعتماد (قبل الفوترة) يعيدها مقدَّمة ويمسح الاعتماد
  const again = await A(sheetBody(p.id, { overtimeHours: 3 }), OPS);
  assert.equal(again.timesheet.status, "submitted");
  assert.equal(fake.pages.get(s.timesheet.id).properties[B.TIMESHEET_PROPS.approvedBy].rich_text.length, 0);
  const ap2 = await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: again.timesheet.version }, AUTH_A);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal((await A(sheetBody(p.id, { overtimeHours: 9 }), OPS)).error, "timesheet_invoiced");   // مقفلة
  assert.equal((await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, decision: "reject" }, AUTH_A)).status, 409);
  assert.equal(ap2.timesheet.status, "approved");
});

/* ═════════════ الفاتورة: التوليد والعدم التكرار ═════════════ */
async function scenario() {
  const fake = fakeNotion(); const A = api(fake);
  const a = await seed(A, { clientNo: "E-1" });
  const b = await seed(A, { clientNo: "E-2", over: { employeeName: "سعد" } });
  const h = await seed(A, { clientNo: "H-1", over: { engagementType: "casual", billingUnit: "hourly", employeeName: "فهد" } });
  const approve = async (placementId, over = {}) => {
    const s = await A(sheetBody(placementId, over), OPS);
    assert.equal(s.ok, true, JSON.stringify(s));
    const r = await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, AUTH_A);
    assert.equal(r.ok, true, JSON.stringify(r));
    return s.timesheet.id;
  };
  return { fake, A, a, b, h, approve };
}
const activeInvoices = (fake) => [...fake.pages.values()].filter((p) => p.parent.database_id === DB.i && !p.archived && ["مسودة", "صادرة", "مدفوعة"].includes(p.properties[B.INVOICE_PROPS.status].select.name));

test("generate-invoice: المعتمد وحده يُفوتَر، وغير المعتمد «بانتظار الاعتماد»، والحساب بالأعداد المرجعية", async () => {
  const { fake, A, a, b, h, approve } = await scenario();
  await approve(a.id, { overtimeHours: 10.5 });
  await A(sheetBody(b.id), OPS);                                                           // مقدَّمة لم يعتمدها العميل
  await approve(h.id, { months: undefined, hours: 12.25 });
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal(g.created, true);
  const inv = g.invoice;
  assert.equal(inv.status, "draft"); assert.equal(inv.number, "");
  assert.deepEqual(inv.lines.map((l) => [l.employeeNo, l.kind, l.amountHalalas]), [["E-1", "base", 482000], ["E-1", "overtime", 15750], ["H-1", "base", mdh(8334 * 1225, 1, 100)]]);
  const sub = 482000 + 15750 + mdh(8334 * 1225, 1, 100);
  assert.equal(inv.subtotalHalalas, sub);
  assert.equal(inv.vatHalalas, mdh(sub * 15, 1, 100));
  assert.equal(inv.totalHalalas, sub + inv.vatHalalas);
  assert.deepEqual(inv.pending.map((p) => [p.employeeNo, p.reason]), [["E-2", "timesheet_submitted"]]);
  assert.ok(inv.costHalalas === null || inv.costHalalas > 0);
  // لا ورقة غير معتمدة تُقفل
  const locked = [...fake.pages.values()].filter((p) => p.parent.database_id === DB.t && p.properties[B.TIMESHEET_PROPS.invoiceId].rich_text.length).length;
  assert.equal(locked, 2);
  assert.equal(activeInvoices(fake).length, 1);
});

test("idempotency: نفس (عميل، شهر) لا يُصدِر فاتورتين فعّالتين، تتابعاً أو تزامناً", async () => {
  const { fake, A, a, approve } = await scenario();
  await approve(a.id);
  const g1 = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  const g2 = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(g2.existing, true); assert.equal(g2.invoice.id, g1.invoice.id);
  assert.equal(activeInvoices(fake).length, 1);
  // تزامن: شهر جديد، استدعاءان معاً
  const s = await A(sheetBody(a.id, { month: "2026-09" }), OPS);
  await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, AUTH_A);
  const [x, y] = await Promise.all([A({ action: "generate-invoice", clientId: CL, month: "2026-09" }, OPS), A({ action: "generate-invoice", clientId: CL, month: "2026-09" }, OPS)]);
  assert.equal(x.ok && y.ok, true, JSON.stringify([x, y]));
  assert.equal(x.invoice.id, y.invoice.id);
  const sept = activeInvoices(fake).filter((p) => p.properties[B.INVOICE_PROPS.month].rich_text[0].plain_text === "2026-09");
  assert.equal(sept.length, 1);
  // شهر آخر مستقل
  assert.equal(activeInvoices(fake).length, 2);
});

test("generate-invoice: لا شيء معتمد ⇒ 409 nothing_to_bill بلا كتابة؛ ومدخلات فاسدة؛ وعميل بلا تنسيبات", async () => {
  const { fake, A, a } = await scenario();
  await A(sheetBody(a.id), OPS);
  const before = fake.writes().length;
  const r = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(r.status, 409); assert.equal(r.error, "nothing_to_bill");
  assert.ok(r.pending.length >= 1);
  assert.equal(fake.writes().length, before);
  assert.equal((await A({ action: "generate-invoice", clientId: CL, month: "2026-12" }, OPS)).error, "month_in_future");
  assert.equal((await A({ action: "generate-invoice", clientId: "x", month: "2026-10" }, OPS)).error, "client_invalid");
  assert.equal((await A({ action: "generate-invoice", clientId: "org:bbbbbbbb-1111-2222-3333-444444444444", month: "2026-10" }, OPS)).error, "nothing_to_bill");
});

test("issue-invoice: BP-INV-YYYYMM-NNNN متزايد بلا تكرار، تتابعاً وتزامناً؛ وإعادة الإصدار لا تغيّر الرقم", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const clients = [CL, "org:bbbbbbbb-1111-2222-3333-444444444444", "org:cccccccc-1111-2222-3333-444444444444"];
  const invoices = [];
  for (const [i, c] of clients.entries()) {
    const p = await A(placeBody({ clientId: c, employeeNo: "E-" + i }), OPS);
    const s = await A(sheetBody(p.placement.id), OPS);
    await A({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, B.authFromSession({ user: { id: "u" + "0".repeat(7) + i, email: "x" + i + "@x.example" }, organization: { id: c.slice(4) } }));
    invoices.push((await A({ action: "generate-invoice", clientId: c, month: "2026-10" }, OPS)).invoice);
  }
  const first = await A({ action: "issue-invoice", invoiceId: invoices[0].id, dueDays: 14 }, OPS);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.invoice.number, "BP-INV-202610-0001");
  assert.equal(first.invoice.status, "issued");
  assert.equal(first.invoice.issuedAt, "2026-11-03");
  assert.equal(first.invoice.dueDate, "2026-11-17");
  const [s2, s3] = await Promise.all([A({ action: "issue-invoice", invoiceId: invoices[1].id }, OPS), A({ action: "issue-invoice", invoiceId: invoices[2].id }, OPS)]);
  assert.equal(s2.ok && s3.ok, true, JSON.stringify([s2, s3]));
  const nums = [first.invoice.number, s2.invoice.number, s3.invoice.number];
  assert.equal(new Set(nums).size, 3, nums.join());
  assert.deepEqual([...nums].sort(), ["BP-INV-202610-0001", "BP-INV-202610-0002", "BP-INV-202610-0003"]);
  assert.equal(s2.invoice.dueDate, null);                                                    // due_days غير محدّد في الإعداد
  const again = await A({ action: "issue-invoice", invoiceId: invoices[0].id }, OPS);
  assert.equal(again.unchanged, true); assert.equal(again.invoice.number, "BP-INV-202610-0001");
  // الرقم من شهر الفاتورة لا شهر الإصدار
  const all = [...fake.pages.values()].filter((p) => p.parent.database_id === DB.i).map((p) => p.properties[B.INVOICE_PROPS.serial].rich_text.map((x) => x.plain_text).join("")).filter(Boolean);
  assert.equal(new Set(all).size, all.length);
});

test("due_days من الإعداد يُستعمل إن حُدّد، والقيمة الفاسدة في الطلب مرفوضة", async () => {
  const { A, a, approve } = await scenario();
  await approve(a.id);
  const cfg = clone(PRICING); cfg.billing.due_days = 30;
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS, { pricing: cfg });
  assert.equal((await A({ action: "issue-invoice", invoiceId: g.invoice.id, dueDays: -1 }, OPS, { pricing: cfg })).error, "due_days_invalid");
  const i = await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS, { pricing: cfg });
  assert.equal(i.invoice.dueDate, "2026-12-03");
});

test("تغيّر ورقة بعد إصدار الفاتورة: لا تُعدَّل (409 invoice_stale)؛ الإلغاء يفكّ القفل وتُصدر جديدة", async () => {
  const { fake, A, a, b, approve } = await scenario();
  await approve(a.id);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  const iss = await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS);
  assert.equal(iss.invoice.status, "issued");
  // اعتماد متأخر لموظف آخر
  await approve(b.id);
  const stale = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(stale.status, 409); assert.equal(stale.error, "invoice_stale"); assert.equal(stale.hint, "cancel_and_reissue");
  const chk = await A({ action: "get-invoice", invoiceId: g.invoice.id, check: true }, OPS);
  assert.equal(chk.invoice.stale, true);
  // الفاتورة الصادرة لم تتغيّر
  assert.equal((await A({ action: "get-invoice", invoiceId: g.invoice.id }, OPS)).invoice.lines.length, 1);
  // إلغاء بإذن المالك (ops) يتطلب سبباً
  assert.equal((await A({ action: "cancel-invoice", invoiceId: g.invoice.id }, OPS)).error, "reason_required");
  assert.equal((await A({ action: "cancel-invoice", invoiceId: g.invoice.id, reason: "اعتماد متأخر" }, AUTH_A)).status, 403);
  const c = await A({ action: "cancel-invoice", invoiceId: g.invoice.id, reason: "اعتماد متأخر" }, OPS);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(c.invoice.status, "cancelled"); assert.equal(c.unlocked, 1);
  assert.equal(c.invoice.number, "BP-INV-202610-0001");                                      // الرقم محفوظ للسجل
  assert.equal((await A({ action: "cancel-invoice", invoiceId: g.invoice.id, reason: "x" }, OPS)).unchanged, true);
  const re = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(re.created, true); assert.equal(re.invoice.lines.length, 2);
  assert.notEqual(re.invoice.id, g.invoice.id);
  const iss2 = await A({ action: "issue-invoice", invoiceId: re.invoice.id }, OPS);
  assert.equal(iss2.invoice.number, "BP-INV-202610-0002");                                   // لا إعادة استعمال للرقم الملغى
  assert.equal(activeInvoices(fake).length, 1);
});

test("مسودة متقادمة تُحدَّث في مكانها؛ ولا تُصدَر مسودة متقادمة", async () => {
  const { fake, A, a, b, approve } = await scenario();
  await approve(a.id);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  await approve(b.id);
  const bad = await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS);
  assert.equal(bad.error, "invoice_stale"); assert.equal(bad.status, 409);
  const re = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(re.refreshed, true); assert.equal(re.invoice.id, g.invoice.id); assert.equal(re.invoice.lines.length, 2);
  assert.equal(activeInvoices(fake).length, 1);
  const locked = [...fake.pages.values()].filter((p) => p.parent.database_id === DB.t && p.properties[B.TIMESHEET_PROPS.invoiceId].rich_text.length).length;
  assert.equal(locked, 2);
  assert.equal((await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS)).ok, true);
});

test("تعديل ورقة معتمدة مباشرة في Notion بعد الفوترة يُكشف (stale) ويمنع الإصدار", async () => {
  const { fake, A, a, approve } = await scenario();
  const sid = await approve(a.id);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  fake.pages.get(sid).properties[B.TIMESHEET_PROPS.status] = { type: "select", select: { name: "مقدَّمة" } };       // تلاعب خارجي
  assert.equal((await A({ action: "get-invoice", invoiceId: g.invoice.id, check: true }, OPS)).invoice.stale, true);
  assert.equal((await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS)).error, "invoice_stale");
});

test("record-payment: مُصدَرة ⇒ مدفوعة بمرجع؛ ولا يُلغى المدفوع", async () => {
  const { A, a, approve } = await scenario();
  await approve(a.id);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal((await A({ action: "record-payment", invoiceId: g.invoice.id, paymentRef: "P1" }, OPS)).error, "invoice_not_issued");
  await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS);
  assert.equal((await A({ action: "record-payment", invoiceId: g.invoice.id }, OPS)).error, "payment_ref_required");
  assert.equal((await A({ action: "record-payment", invoiceId: g.invoice.id, paymentRef: "P1" }, AUTH_A)).status, 403);
  const p = await A({ action: "record-payment", invoiceId: g.invoice.id, paymentRef: "MOY-123" }, OPS);
  assert.equal(p.invoice.status, "paid"); assert.equal(p.invoice.paymentRef, "MOY-123");
  assert.equal((await A({ action: "record-payment", invoiceId: g.invoice.id, paymentRef: "MOY-123" }, OPS)).unchanged, true);
  assert.equal((await A({ action: "record-payment", invoiceId: g.invoice.id, paymentRef: "OTHER" }, OPS)).error, "already_paid");
  assert.equal((await A({ action: "cancel-invoice", invoiceId: g.invoice.id, reason: "x" }, OPS)).error, "invoice_paid");
  assert.equal((await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS)).existing, true);         // المدفوعة فعّالة
});

/* ═════════════ ما يراه العميل من الفواتير ═════════════ */
test("العميل: يرى فواتيره المُصدَرة وحدها، لا مسودات ولا فواتير غيره؛ وget-invoice لغيره 404", async () => {
  const { A, a, approve } = await scenario();
  await approve(a.id);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.deepEqual((await A({ action: "list-invoices" }, AUTH_A)).invoices, []);               // مسودة
  assert.equal((await A({ action: "get-invoice", invoiceId: g.invoice.id }, AUTH_A)).status, 404);
  await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS);
  const mine = await A({ action: "list-invoices" }, AUTH_A);
  assert.equal(mine.invoices.length, 1);
  assert.equal(mine.invoices[0].number, "BP-INV-202610-0001");
  assert.deepEqual((await A({ action: "list-invoices" }, AUTH_B)).invoices, []);
  const foreign = await A({ action: "get-invoice", invoiceId: g.invoice.id }, AUTH_B);
  assert.equal(foreign.status, 404); assert.equal(foreign.error, "not_found");
  const own = await A({ action: "get-invoice", invoiceId: g.invoice.id }, AUTH_A);
  assert.equal(own.invoice.total, own.invoice.subtotal + own.invoice.vat);
  assert.equal(own.invoice.lines[0].employeeName, "خالد الحربي");
  assert.equal((await A({ action: "list-invoices", status: "weird" }, AUTH_A)).error, "status_invalid");
  assert.equal((await A({ action: "list-invoices", month: "2026-10", status: "issued" }, AUTH_A)).invoices.length, 1);
  assert.equal((await A({ action: "list-invoices", month: "2026-09" }, AUTH_A)).invoices.length, 0);
  assert.equal((await A({ action: "list-invoices", clientId: CL }, OPS)).invoices.length, 1);
  assert.equal((await A({ action: "get-invoice", invoiceId: "nope" }, OPS)).status, 400);
  // رقم صفحة تنسيب (قاعدة أخرى) لا يُقبل كفاتورة
  assert.equal((await A({ action: "get-invoice", invoiceId: (await A({ action: "list-placements" }, OPS)).placements[0].id }, OPS)).status, 404);
});

test("canaries: لا تكلفة ولا ربح ولا هامش ولا معاملات ولا مورّد ولا سعره ولا راتب مرجعي في أي ردّ لعميل", async () => {
  const fake = fakeNotion(); const A = api(fake);
  const pricing = clone(PRICING);
  Object.assign(pricing.package_rate.casual, { hourly_worker_multiplier: 5.4321, sale_multiplier: 2.3456, monthly_worker_multiplier: 1.0987 });
  pricing.package_rate.lump.overhead_monthly = 937.77;
  const REF = 2753.21;
  const p = await A(placeBody({ salary: REF, vendorId: CAN.vendor, costUnitHalalas: CAN.cost }), OPS, { pricing });
  const c = await A(placeBody({ employeeNo: "H9", engagementType: "casual", billingUnit: "hourly", salary: REF, vendorId: CAN.vendor, costUnitHalalas: CAN.cost, employeeName: "نادل مرن" }), OPS, { pricing });
  assert.equal(p.ok && c.ok, true, JSON.stringify([p, c]));
  assert.ok(JSON.stringify(p).includes(CAN.vendor) && JSON.stringify(p).includes(String(CAN.cost)), "ops يرى الداخلي فعلاً");
  const s1 = await A(sheetBody(p.placement.id, { overtimeHours: 3 }), OPS, { pricing });
  const s2 = await A(sheetBody(c.placement.id, { months: undefined, hours: 20 }), OPS, { pricing });
  const seen = [];
  const mineP = await A({ action: "list-placements" }, AUTH_A, { pricing }); seen.push(mineP);
  const mineT = await A({ action: "list-timesheets" }, AUTH_A, { pricing }); seen.push(mineT);
  for (const t of mineT.timesheets) seen.push(await A({ action: "approve-timesheet", timesheetId: t.id, version: t.version }, AUTH_A, { pricing }));
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS, { pricing });
  assert.ok(g.invoice.costHalalas === CAN.cost + CAN.cost && g.invoice.marginHalalas > 0 || g.invoice.costHalalas > 0, "ops يرى التكلفة والهامش");
  await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS, { pricing });
  seen.push(await A({ action: "list-invoices" }, AUTH_A, { pricing }), await A({ action: "get-invoice", invoiceId: g.invoice.id }, AUTH_A, { pricing }));
  seen.push(await A({ action: "list-invoices" }, AUTH_B, { pricing }), await A({ action: "get-invoice", invoiceId: g.invoice.id }, AUTH_B, { pricing }));
  const blob = JSON.stringify(seen);
  assert.ok(blob.length > 1500 && blob.includes("BP-INV-202610-0001") && blob.includes("خالد الحربي"), "الردود غير فارغة");
  const secrets = [CAN.vendor, String(CAN.cost), CAN.costSar, String(REF), "2753", "5.4321", "2.3456", "1.0987", "937.77", String(g.invoice.costHalalas), String(g.invoice.marginHalalas), String(g.invoice.costHalalas / 100)];
  for (const t of secrets) assert.equal(blob.includes(t), false, "تسرّب " + t);
  const KEYS = /cost|margin|profit|markup|vendor|supplier|multiplier|pricingInput|priceSource|internal|salary|reference|digest|clientId|workerType/i;
  const m = blob.match(KEYS);
  assert.equal(m, null, "مفتاح داخلي " + (m && m[0]));
  assert.equal(JSON.stringify(seen.filter((r) => r.invoices || r.invoice)).includes("placementId"), false, "الفاتورة بلا معرّف تنسيب");
});

/* ═════════════ الفشل المغلق مع Notion ═════════════ */
test("عمود أساسي مفقود في Notion ⇒ 502 schema_mismatch بلا اعتماد صامت؛ والاختياري يُسقَط ويكمل", async () => {
  const good = fakeNotion(); const G = api(good);
  const cols = (o) => Object.values(o);
  const tsAllowed = cols(B.TIMESHEET_PROPS).filter((n) => n !== B.TIMESHEET_PROPS.approvedAt);
  const strict = fakeNotion({ allowed: { [DB.p]: cols(B.PLACEMENT_PROPS), [DB.t]: tsAllowed, [DB.i]: cols(B.INVOICE_PROPS) } });
  const S = api(strict);
  const p2 = await seed(S);
  const s2 = await S(sheetBody(p2.id), OPS);
  assert.equal(s2.status, 502); assert.equal(s2.error, "schema_mismatch");
  assert.equal([...strict.pages.values()].filter((x) => x.parent.database_id === DB.t).length, 0, "لا ورقة نصف مكتوبة");
  // وكتابة الاعتماد نفسها تفشل مغلقة: العمود موجود عند التقديم ثم يختفي (نسخة Notion أُعيدت هيكلتها)
  const shrinking = fakeNotion();
  const SH = api(shrinking);
  const p3 = await seed(SH);
  const s3 = await SH(sheetBody(p3.id), OPS);
  const origFetch = shrinking.fetch;
  const wrapped = { ...shrinking, fetch: async (url, init) => {
    if (init.method === "PATCH" && init.body && init.body.includes(B.TIMESHEET_PROPS.approvedAt)) return { ok: false, status: 400, text: async () => `${B.TIMESHEET_PROPS.approvedAt} is not a property that exists.`, json: async () => ({}) };
    return origFetch(url, init);
  } };
  const ap = await api(wrapped)({ action: "approve-timesheet", timesheetId: s3.timesheet.id, version: s3.timesheet.version }, AUTH_A);
  assert.equal(ap.status, 502); assert.equal(ap.error, "schema_mismatch");
  assert.equal(shrinking.pages.get(s3.timesheet.id).properties[B.TIMESHEET_PROPS.status].select.name, "مقدَّمة", "لم يُعتمد");
  // عمود اختياري غائب (اسم العميل + المهنة + رقم الطلب) ⇒ يُسقَط
  const lax = fakeNotion({ allowed: { [DB.p]: cols(B.PLACEMENT_PROPS).filter((n) => ![B.PLACEMENT_PROPS.clientName, B.PLACEMENT_PROPS.occupation, B.PLACEMENT_PROPS.requestRef].includes(n)), [DB.t]: cols(B.TIMESHEET_PROPS), [DB.i]: cols(B.INVOICE_PROPS) } });
  const L = api(lax);
  const ok = await L(placeBody({ requestRef: "EOR-123456" }), OPS);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  // عمود السعر المثبّت غير اختياري
  const noPrice = fakeNotion({ allowed: { [DB.p]: cols(B.PLACEMENT_PROPS).filter((n) => n !== B.PLACEMENT_PROPS.unitPrice), [DB.t]: cols(B.TIMESHEET_PROPS), [DB.i]: cols(B.INVOICE_PROPS) } });
  const bad = await api(noPrice)(placeBody(), OPS);
  assert.equal(bad.error, "schema_mismatch");
  assert.equal([...noPrice.pages.values()].length, 0);
});

test("فشل Notion مغلق: قراءة فاشلة ⇒ 502 بلا كتابة؛ كتابة فاشلة ⇒ 502 بلا فاتورة؛ وتجاوز سقف المسح ⇒ 503", async () => {
  const f = fakeNotion({ failQuery: true }); const A = api(f);
  for (const b of [placeBody(), { action: "list-invoices" }, { action: "list-placements" }, { action: "generate-invoice", clientId: CL, month: "2026-10" }]) {
    const r = await A(b, OPS);
    assert.equal(r.status, 502, b.action); assert.equal(r.error, "notion_unavailable");
  }
  assert.equal(f.writes().length, 0);
  const w = fakeNotion(); const AW = api(w);
  const p = await seed(AW);
  const s = await AW(sheetBody(p.id), OPS);
  await AW({ action: "approve-timesheet", timesheetId: s.timesheet.id, version: s.timesheet.version }, AUTH_A);
  w.writes().length;
  const bad = fakeNotion({ failWrites: true });
  // نسخة كتابتها فاشلة لكن قراءتها من بيانات w
  for (const [k, v] of w.pages) bad.pages.set(k, v);
  const r = await api(bad)({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(r.status, 502);
  assert.equal([...bad.pages.values()].filter((x) => x.parent.database_id === DB.i).length, 0);
  // سقف المسح: صفحات من صف واحد، 6 تنسيبات ⇒ تجاوز 5 صفحات
  const big = fakeNotion({ forcePageSize: 1 });
  const AB = api(big);
  for (let i = 0; i < 6; i++) await AB(placeBody({ employeeNo: "N" + i }), OPS, { pricing: PRICING });
  const over = await AB({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  assert.equal(over.status, 503); assert.equal(over.error, "too_many_rows");
  const ok5 = fakeNotion({ forcePageSize: 1 });
  const A5 = api(ok5);
  for (let i = 0; i < 5; i++) await A5(placeBody({ employeeNo: "N" + i }), OPS);
  assert.equal((await A5({ action: "list-placements", clientId: CL }, OPS)).placements.length, 5);       // الترقيم يعمل حتى السقف
});

test("فاتورة تالفة في Notion (مجاميع لا تطابق الأسطر): العميل لا يراها ولا تُصدَر", async () => {
  const { fake, A, a, approve } = await scenario();
  await approve(a.id);
  const g = await A({ action: "generate-invoice", clientId: CL, month: "2026-10" }, OPS);
  await A({ action: "issue-invoice", invoiceId: g.invoice.id }, OPS);
  fake.pages.get(g.invoice.id).properties[B.INVOICE_PROPS.total] = { type: "number", number: 1 };               // عبث خارجي
  assert.deepEqual((await A({ action: "list-invoices" }, AUTH_A)).invoices, []);
  assert.equal((await A({ action: "get-invoice", invoiceId: g.invoice.id }, AUTH_A)).status, 404);
  const ops = await A({ action: "get-invoice", invoiceId: g.invoice.id }, OPS);
  assert.equal(ops.invoice.corrupt, true);
  assert.equal((await A({ action: "record-payment", invoiceId: g.invoice.id, paymentRef: "x" }, OPS)).error, "invoice_not_issued");
});

test("billingConfigFromPricing: الضريبة الافتراضية 0.15 معلَّمة، والمسار billing ثم العام، والاستحقاق فارغ", () => {
  const d = B.billingConfigFromPricing({});
  assert.deepEqual([d.vatRate, d.vatSource, d.pricesIncludeVat, d.proration, d.dueDays, d.hoursMax], [0.15, "default", false, "full_month", null, 744]);
  const shipped = B.billingConfigFromPricing(PRICING);
  assert.deepEqual([shipped.vatRate, shipped.vatSource, shipped.currency, shipped.dueDays], [0.15, "billing", "SAR", null]);
  assert.equal(B.billingConfigFromPricing({ vat_rate: 0.05 }).vatRate, 0.05);
  assert.equal(B.billingConfigFromPricing({ vat_rate: 0.05, billing: { vat_rate: 0.1 } }).vatRate, 0.1);
  assert.equal(B.billingConfigFromPricing({ billing: { vat_rate: 7, proration: "x", due_days: -1, timesheet_max_hours: 9999 } }).vatRate, 0.15);
  const w = B.billingConfigFromPricing({ billing: { proration: "calendar_days", due_days: 30, timesheet_max_hours: 600, prices_include_vat: true } });
  assert.deepEqual([w.proration, w.dueDays, w.hoursMax, w.pricesIncludeVat], ["calendar_days", 30, 600, true]);
  assert.match(PRICING.billing._vat_rate, /_owner_decision/);
  assert.ok(Object.keys(PRICING.billing).filter((k) => k.startsWith("_")).length >= 3);
});

test("الأعمدة الحرفية: مصدر واحد للأسماء، بلا تكرار داخل القاعدة، والحالات العربية", () => {
  for (const props of [B.PLACEMENT_PROPS, B.TIMESHEET_PROPS, B.INVOICE_PROPS]) { const v = Object.values(props); assert.equal(new Set(v).size, v.length); }
  assert.deepEqual(Object.values(B.INVOICE_STATUS_AR), ["مسودة", "صادرة", "مدفوعة", "ملغاة"]);
  assert.deepEqual(Object.values(B.TIMESHEET_STATUS_AR), ["مسودة", "مقدَّمة", "معتمدة من العميل", "مرفوضة"]);
  assert.deepEqual(B.BILLING_DB_ENVS, { placements: "EOR_PLACEMENTS_DB", timesheets: "EOR_TIMESHEETS_DB", invoices: "EOR_INVOICES_DB" });
});
