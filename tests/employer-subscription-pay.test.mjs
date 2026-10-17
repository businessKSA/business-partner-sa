// الاشتراك بالدفع الإلكتروني: api/employer.js (getPlanOffer · createPendingSubscription ·
// activateSubscription) وبوابة البيانات في api/candidates.js
//
// شغّله: npm test
//
// قرار المالك: يُدفع اشتراك صاحب العمل إلكترونياً (مُيسّر + تمارا عبر السلة) ويُفعَّل الحساب
// آلياً بعد نجاح الدفع. والفعل الأخطر هنا هو التفعيل: صفٌّ «مفعّل» = رمزُ وصولٍ يفتح بيانات
// كل المرشحين الشخصية. فالمقاس هو ما يمنع تفعيلاً لا يستحقّه أحد:
//   ① لا تفعيل بلا paymentRef · ولا بمبلغٍ لا يطابق سعر site.json · ولا لـenterprise.
//   ② idempotent: نفس الدفعة مرّتين لا تفعّل ولا تمدّد مرّتين.
//   ③ نوشن يفشل ⇒ ok:false وصفٌّ لم يُمسّ (يُغلق ولا يُفتح).
//   ④ البيانات لا تُفتح (sub) قبل التفعيل، وتُفتح بعده — على handler الحقيقي.
//   ⑤ لا حقل داخلي في أي ردّ (رمز الوصول ومعرّف الصف)، ولا فعلَ HTTP يفعّل.
//
// نوشن مُحاكى بحالة (صفوف تُنشأ وتُعدَّل)، والجلسة تُقرأ من api/_db.js فعلاً (LOCAL_DB=1).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------- الجلسة --
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-employer-pay-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
const NOW = new Date().toISOString();
const BUYER = "buyer@example.com";
const SID = "sid-buyer";
const ACC = {
  user: { id: "u-buyer", email: BUYER, full_name: "buyer", locale: "ar" },
  org: { id: "org-buyer", name_ar: "شركة المشتري", created_at: NOW },
  sess: { id: "s-buyer", user_id: "u-buyer", organization_id: "org-buyer", token_hash: sha(SID), revoked_at: null, expires_at: future },
};
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [ACC.user], organizations: [ACC.org], user_sessions: [ACC.sess], audit_logs: [],
}, null, 2));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.OWNER_EMAIL = "dr.baher.magnas@gmail.com";
delete process.env.RESEND_API_KEY; delete process.env.RESEND_KEY; delete process.env.RESEND;
delete process.env.OWNER_DEMO_CODE; delete process.env.EMPLOYER_CODES; delete process.env.OWNER_EMAILS;
delete process.env.BP_OPEN_ACCESS;

// ------------------------------------------------------------ نوشن مُحاكى --
const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";
const ROWS = [];                 // صفوف أصحاب العمل بصيغة القراءة (plain_text)
let seq = 0, notionDown = false, patchFails = false, networkCalls = 0;
const writes = [];               // كل كتابةٍ على نوشن: { method, path, body }

const plain = (v) => (v || []).map((x) => (x.text ? x.text.content : x.plain_text || "")).join("");
function toRead(prop) {
  if (prop.title) return { type: "title", title: [{ plain_text: plain(prop.title) }] };
  if (prop.rich_text) return { type: "rich_text", rich_text: prop.rich_text.length ? [{ plain_text: plain(prop.rich_text) }] : [] };
  if ("select" in prop) return { type: "select", select: prop.select };
  if ("email" in prop) return { type: "email", email: prop.email };
  if ("date" in prop) return { type: "date", date: prop.date };
  if ("phone_number" in prop) return { type: "phone_number", phone_number: prop.phone_number };
  throw new Error("المُحاكي لا يعرف هذه الخاصية: " + JSON.stringify(prop));
}
const textOf = (p) => (!p ? "" : p.rich_text ? p.rich_text.map((x) => x.plain_text).join("") : p.title ? p.title.map((x) => x.plain_text).join("") : p.email || "");
function matches(row, f) {
  if (!f) return true;
  if (f.and) return f.and.every((x) => matches(row, x));
  const p = row.properties[f.property];
  if (f.email) {
    const v = String((p && p.email) || "").toLowerCase();
    return "equals" in f.email ? v === f.email.equals : v.includes(String(f.email.contains).toLowerCase());
  }
  if (f.select) return ((p && p.select && p.select.name) || null) === f.select.equals;
  if (f.rich_text) {
    const v = textOf(p);
    return "equals" in f.rich_text ? v === f.rich_text.equals : v.toLowerCase().includes(String(f.rich_text.contains).toLowerCase());
  }
  throw new Error("المُحاكي لا يعرف هذا الفلتر: " + JSON.stringify(f));
}

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  assert.ok(u.startsWith("https://api.notion.com/"), "no network in tests: " + u);
  networkCalls++;
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (notionDown) return json({ message: "simulated outage" }, 500);
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : {};
  const q = /databases\/([a-z0-9]+)\/query/.exec(u);
  if (q) {
    assert.equal(q[1], EMP_DB, "هذا الملف لا يلمس إلا قاعدة أصحاب العمل");
    return json({ results: ROWS.filter((r) => matches(r, body.filter)).slice(0, body.page_size || 100), has_more: false });
  }
  if (u.endsWith("/v1/pages") && method === "POST") {
    writes.push({ method, path: "pages", body });
    const props = {};
    for (const [k, v] of Object.entries(body.properties)) props[k] = toRead(v);
    const row = { id: "row-" + (++seq), created_time: new Date(Date.UTC(2026, 0, 1, 0, seq)).toISOString(), properties: props };
    ROWS.push(row);
    return json(row);
  }
  const pm = /\/pages\/([^/?]+)$/.exec(u);
  if (pm && method === "PATCH") {
    writes.push({ method, path: "pages/" + pm[1], body });
    if (patchFails) return json({ message: "simulated patch failure" }, 500);
    const row = ROWS.find((r) => r.id === pm[1]);
    if (!row) return json({ message: "not found" }, 404);
    for (const [k, v] of Object.entries(body.properties)) row.properties[k] = toRead(v);
    return json(row);
  }
  return json({}, 404);
};

const EMP = await import("../api/employer.js");
const { createPendingSubscription: createPending, activateSubscription: activate, getPlanOffer, parseEmployerSku } = EMP;
const { default: candidates } = await import("../api/candidates.js");

// ---------------------------------------------------------------- أدوات --
const resetStore = () => { ROWS.length = 0; writes.length = 0; notionDown = false; patchFails = false; seq = 0; };
const rowFor = (email) => ROWS.find((r) => (r.properties["البريد"].email || "") === email);
const val = (row, k) => textOf(row.properties[k]);
const sel = (row, k) => (row.properties[k] && row.properties[k].select && row.properties[k].select.name) || "";
const dates = (row) => (row.properties["تاريخ التفعيل"] && row.properties["تاريخ التفعيل"].date) || null;
const day = (y, m, d) => Date.UTC(y, m - 1, d, 12);
const PAY = (n) => "pay_" + String(n).padStart(8, "0");

function call(h, method, url, { sid = "", body } = {}) {
  let out = "", status = 0;
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
  const req = { method, url, body, headers: { "x-forwarded-for": "203.0.113.9", ...(sid ? { cookie: `bp_sid=${sid}` } : {}) }, on() {} };
  return h(req, res).then(() => ({ status: status || 200, raw: out, data: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
}
const validate = () => call(candidates, "GET", "/api/candidates?validate=1&code=self", { sid: SID });

// السعر كما في site.json، يُقرأ هنا بيدٍ مستقلة عن الكود المقيس.
const SITE = JSON.parse(fs.readFileSync(new URL("../site/data/site.json", import.meta.url), "utf8")).employerPlans;
const monthlyOf = (k) => SITE.tiers.find((t) => t.key === k).price;

// ═══════════════════════ ① العرض: السعر من site.json وحده ═══════════════════════
test("getPlanOffer: الشهري والسنوي (×12×0.7) بالهللات من site.json، وSKU ثابت", () => {
  assert.equal(SITE.yearlyDiscount, 0.3, "افتراض الاختبار: الخصم السنوي ٣٠٪");
  const exp = {
    "basic/monthly": [Math.round(monthlyOf("basic") * 100), "BP-EMP-BASIC-M"],
    "basic/yearly": [Math.round(monthlyOf("basic") * 12 * 0.7 * 100), "BP-EMP-BASIC-Y"],
    "pro/monthly": [Math.round(monthlyOf("pro") * 100), "BP-EMP-PRO-M"],
    "pro/yearly": [Math.round(monthlyOf("pro") * 12 * 0.7 * 100), "BP-EMP-PRO-Y"],
  };
  for (const [k, [halalas, sku]] of Object.entries(exp)) {
    const [plan, billing] = k.split("/");
    assert.deepEqual(getPlanOffer(plan, billing), { amountHalalas: halalas, currency: "SAR", plan, billing, sku }, k);
    assert.deepEqual(parseEmployerSku(sku), { plan, billing }, "SKU ← → باقة");
  }
  assert.equal(getPlanOffer("basic", "monthly").amountHalalas, 50000);
  assert.equal(getPlanOffer("pro", "yearly").amountHalalas, 840000);
});

test("getPlanOffer: enterprise وما لا يُباع بالدفع ⇒ null (لا سعرَ يُخترع)", () => {
  for (const [p, b] of [["enterprise", "monthly"], ["enterprise", "yearly"], ["gold", "monthly"], ["basic", "weekly"], ["basic", ""], [undefined, undefined]]) {
    assert.equal(getPlanOffer(p, b), null, `${p}/${b}`);
  }
  assert.equal(parseEmployerSku("BP-EMP-ENT-M"), null);
  assert.equal(parseEmployerSku("svc-anything"), null);
});

// ═══════════════════════ ② إنشاء الاشتراك المعلّق ═══════════════════════
test("createPending: صفٌّ «بانتظار الدفع» بلا تفعيل، والمرجع ليس رمز الوصول", async () => {
  resetStore();
  const r = await createPending({ email: "New@Example.com ", company: "شركة جديدة", plan: "pro", billing: "monthly" });
  assert.equal(r.ok, true);
  assert.match(r.reference, /^BP-EMPSUB-[A-HJ-NP-Z2-9]{12}$/);
  const row = rowFor("new@example.com");
  assert.ok(row, "البريد يُكتب بحروفٍ صغيرة مقصوصاً");
  assert.equal(sel(row, "الحالة"), "بانتظار الدفع");
  assert.equal(sel(row, "الباقة"), "احترافية");
  assert.equal(sel(row, "الفوترة"), "شهري");
  assert.equal(dates(row), null, "لا تاريخ تفعيل قبل الدفع");
  const code = val(row, "رمز الوصول");
  assert.match(code, /^BP-EMP-[A-HJ-NP-Z2-9]{12}$/, "رمز وصول عشوائي بصيغة makeRef");
  assert.notEqual(code, r.reference);
  assert.ok(!r.reference.includes(code) && !JSON.stringify(r).includes(code), "رمز الوصول لا يخرج في الردّ");
  assert.ok(!JSON.stringify(r).includes("row-"), "معرّف الصف لا يخرج");
  assert.deepEqual(Object.keys(r).sort(), ["ok", "reference", "renewal"]);
});

test("createPending: idempotent لنفس email+plan+billing، ومرجعٌ مختلف لفوترة مختلفة على الصف نفسه", async () => {
  resetStore();
  const a = await createPending({ email: BUYER, company: "ش", plan: "basic", billing: "monthly" });
  const b = await createPending({ email: BUYER.toUpperCase(), company: "ش", plan: "basic", billing: "monthly" });
  assert.equal(a.reference, b.reference);
  assert.equal(ROWS.length, 1, "صفٌّ واحد لا اثنان");
  const writesAfterFirst = writes.length;
  await createPending({ email: BUYER, company: "ش", plan: "basic", billing: "monthly" });
  assert.equal(writes.length, writesAfterFirst, "التكرار لا يكتب شيئاً");
  const y = await createPending({ email: BUYER, company: "ش", plan: "basic", billing: "yearly" });
  assert.notEqual(y.reference, a.reference);
  assert.equal(ROWS.length, 1);
  assert.equal(sel(ROWS[0], "الفوترة"), "سنوي", "الصف غير المدفوع يعرض آخر نيّة");
  // ونيّة الشهري الأولى ما زالت قابلةً للدفع بمرجعها
  const a2 = await createPending({ email: BUYER, company: "ش", plan: "basic", billing: "monthly" });
  assert.equal(a2.reference, a.reference);
});

test("createPending: enterprise والمدخلات الفاسدة تُرفض قبل أي اتصال بنوشن", async () => {
  resetStore();
  const calls0 = networkCalls;
  assert.deepEqual(await createPending({ email: BUYER, company: "ش", plan: "enterprise", billing: "monthly" }), { ok: false, code: "enterprise_quote_only" });
  assert.equal((await createPending({ email: BUYER, company: "ش", plan: "gold", billing: "monthly" })).code, "invalid_plan");
  assert.equal((await createPending({ email: BUYER, company: "ش", plan: "pro", billing: "daily" })).code, "invalid_billing");
  assert.equal((await createPending({ email: "not-an-email", company: "ش", plan: "pro", billing: "monthly" })).code, "invalid_email");
  assert.equal((await createPending()).ok, false);
  assert.equal(networkCalls, calls0, "لا نداء إلى نوشن");
  assert.equal(ROWS.length, 0);
});

test("createPending: صاحب اشتراك مفعّل لا يُنزَل إلى «بانتظار الدفع»، وباقته لا تتغيّر قبل الدفع", async () => {
  resetStore();
  const p = await createPending({ email: BUYER, company: "ش", plan: "basic", billing: "monthly" });
  await activate({ reference: p.reference, paymentRef: PAY(1), amountHalalas: 50000, billing: "monthly", now: day(2026, 10, 8) });
  assert.equal(sel(ROWS[0], "الحالة"), "مفعّل");
  const up = await createPending({ email: BUYER, company: "ش", plan: "pro", billing: "yearly" });
  assert.equal(up.ok, true);
  assert.equal(up.renewal, true);
  assert.equal(sel(ROWS[0], "الحالة"), "مفعّل", "ما زال مفعّلاً");
  assert.equal(sel(ROWS[0], "الباقة"), "أساسية", "الترقية لا تُكتب قبل الدفع");
  assert.equal(ROWS.length, 1);
});

test("createPending: بريدٌ لصفّه «موقوف» ⇒ suspended ولا صفّ جديد يتجاوز الإيقاف", async () => {
  resetStore();
  const p = await createPending({ email: BUYER, company: "ش", plan: "basic", billing: "monthly" });
  ROWS[0].properties["الحالة"] = { type: "select", select: { name: "موقوف" } };
  const r = await createPending({ email: BUYER, company: "ش", plan: "pro", billing: "monthly" });
  assert.deepEqual(r, { ok: false, code: "suspended" });
  assert.equal(ROWS.length, 1);
  // والتفعيل على مرجعٍ سابق لصفٍّ موقوف يُرفض كذلك
  const a = await activate({ reference: p.reference, paymentRef: PAY(2), amountHalalas: 50000, billing: "monthly" });
  assert.deepEqual(a, { ok: false, activated: false, code: "suspended" });
  assert.equal(sel(ROWS[0], "الحالة"), "موقوف");
});

// ═══════════════════════ ③ التفعيل: ما لا يُفعِّل ═══════════════════════
async function pending(plan = "basic", billing = "monthly", email = BUYER) {
  const r = await createPending({ email, company: "شركة", plan, billing });
  assert.equal(r.ok, true);
  return r.reference;
}
const stillPending = (email = BUYER) => {
  const row = rowFor(email);
  assert.equal(sel(row, "الحالة"), "بانتظار الدفع", "الصف لم يُفعَّل");
  assert.equal(dates(row), null);
  assert.ok(!writes.slice(1).some((w) => w.body.properties && w.body.properties["الحالة"] && w.body.properties["الحالة"].select.name === "مفعّل"), "لم تُكتب «مفعّل»");
};

test("activate: بلا paymentRef صالح لا تفعيل، ولا اتصال بنوشن أصلاً", async () => {
  resetStore();
  const ref = await pending();
  const n0 = networkCalls;
  for (const paymentRef of [undefined, null, "", "   ", 12345678, {}, "short", "has space inside", "x|y|z-1234", "line\nbreak123"]) {
    const r = await activate({ reference: ref, paymentRef, amountHalalas: 50000, billing: "monthly" });
    assert.equal(r.ok, false, String(paymentRef));
    assert.equal(r.activated, false);
    assert.match(r.code, /^(payment_ref_required|invalid_payment_ref)$/);
  }
  assert.equal(networkCalls, n0, "الرفض قبل أي نداء");
  stillPending();
});

test("activate: المبلغ لا يطابق سعر الباقة ⇒ amount_mismatch والصف كما هو", async () => {
  resetStore();
  const ref = await pending("pro", "monthly");           // 100000 هللة
  for (const amt of [99999, 100001, 0, -100000, 50000, 840000, 1000, "100000", 100000.5, NaN, null, undefined]) {
    const r = await activate({ reference: ref, paymentRef: PAY(3), amountHalalas: amt, billing: "monthly" });
    assert.deepEqual(r, { ok: false, activated: false, code: "amount_mismatch" }, String(amt));
  }
  stillPending();
});

test("activate: فوترة المنادي لا تطابق نيّة المرجع ⇒ billing_mismatch (لا يُدفع شهري ويُفعَّل سنوي)", async () => {
  resetStore();
  const ref = await pending("basic", "monthly");
  const r = await activate({ reference: ref, paymentRef: PAY(4), amountHalalas: getPlanOffer("basic", "yearly").amountHalalas, billing: "yearly" });
  assert.equal(r.code, "billing_mismatch");
  assert.equal((await activate({ reference: ref, paymentRef: PAY(4), amountHalalas: 50000, billing: "weekly" })).code, "invalid_billing");
  stillPending();
});

test("activate: مرجعٌ مجهول أو مشوَّه، وenterprise لا يُفعَّل ولو زُوِّرت نيّته", async () => {
  resetStore();
  await pending();
  assert.equal((await activate({ reference: "BP-EMPSUB-AAAAAAAAAAAA", paymentRef: PAY(5), amountHalalas: 50000, billing: "monthly" })).code, "unknown_reference");
  for (const reference of [undefined, "", "BP-EMP-AAAAAAAAAAAA", "BP-EMPSUB-short", ROWS[0].properties["رمز الوصول"].rich_text[0].plain_text]) {
    assert.equal((await activate({ reference, paymentRef: PAY(5), amountHalalas: 50000, billing: "monthly" })).code, "invalid_reference");
  }
  // نيّة enterprise مكتوبةٌ بيدٍ في الملاحظات لا تُقبل أصلاً (تُقرأ نصاً حرّاً لا نيّة)
  ROWS[0].properties["ملاحظات"] = { type: "rich_text", rich_text: [{ plain_text: "اشتراك إلكتروني | BP-EMPSUB-ENTERPRSEE22 | enterprise | monthly" }] };
  assert.equal((await activate({ reference: "BP-EMPSUB-ENTERPRSEE22", paymentRef: PAY(5), amountHalalas: 250000, billing: "monthly" })).ok, false);
  stillPending();
});

// ═══════════════════════ ④ التفعيل الناجح و idempotency ═══════════════════════
test("activate: يفعّل بالمبلغ الصحيح مرّة واحدة — الحالة والباقة والفوترة وشهرٌ واحد وpaymentRef محفوظ", async () => {
  resetStore();
  const ref = await pending("pro", "monthly");
  const codeBefore = val(ROWS[0], "رمز الوصول");
  const r = await activate({ reference: ref, paymentRef: PAY(10), amountHalalas: 100000, billing: "monthly", now: day(2026, 10, 8) });
  assert.deepEqual(r, { ok: true, activated: true });
  const row = ROWS[0];
  assert.equal(sel(row, "الحالة"), "مفعّل");
  assert.equal(sel(row, "الباقة"), "احترافية");
  assert.equal(sel(row, "الفوترة"), "شهري");
  assert.deepEqual(dates(row), { start: "2026-10-08", end: "2026-11-08" });
  assert.equal(val(row, "رمز الوصول"), codeBefore, "رمز الوصول لا يتغيّر ولا يُشتقّ");
  assert.ok(val(row, "ملاحظات").includes(`دفعة | ${PAY(10)} | ${ref} |`), "paymentRef محفوظ");
  assert.ok(!val(row, "ملاحظات").includes("اشتراك إلكتروني | " + ref), "النيّة استُهلكت");
  assert.ok(!JSON.stringify(r).includes(codeBefore));
});

test("activate: نفس paymentRef مرّتين لا يفعّل ولا يمدّد مرّتين (ولو بعد أيام)", async () => {
  resetStore();
  const ref = await pending();
  await activate({ reference: ref, paymentRef: PAY(11), amountHalalas: 50000, billing: "monthly", now: day(2026, 10, 8) });
  const snapshot = JSON.stringify(ROWS[0]);
  const w0 = writes.length;
  for (const now of [day(2026, 10, 8), day(2026, 10, 15)]) {
    const again = await activate({ reference: ref, paymentRef: PAY(11), amountHalalas: 50000, billing: "monthly", now });
    assert.deepEqual(again, { ok: true, activated: true, code: "already_processed" });
  }
  assert.equal(writes.length, w0, "لا كتابة على نوشن");
  assert.equal(JSON.stringify(ROWS[0]), snapshot);
});

test("activate: ردّان متزامنان بالدفعة نفسها ⇒ تمديدٌ واحد", async () => {
  resetStore();
  const ref = await pending();
  const args = { reference: ref, paymentRef: PAY(12), amountHalalas: 50000, billing: "monthly", now: day(2026, 10, 8) };
  const [a, b] = await Promise.all([activate(args), activate(args)]);
  assert.ok(a.ok && b.ok);
  assert.deepEqual(dates(ROWS[0]), { start: "2026-10-08", end: "2026-11-08" }, "ولو كتب الاثنان، كتبا القيمة نفسها لا مدّتين");
});

test("activate: دفعةٌ استُعملت لمرجعٍ آخر ⇒ payment_ref_reused، ودفعةٌ ثانية على مرجعٍ مدفوع ⇒ reference_already_paid", async () => {
  resetStore();
  const r1 = await pending("basic", "monthly", BUYER);
  const r2 = await pending("basic", "monthly", "other@example.com");
  await activate({ reference: r1, paymentRef: PAY(13), amountHalalas: 50000, billing: "monthly" });
  const stolen = await activate({ reference: r2, paymentRef: PAY(13), amountHalalas: 50000, billing: "monthly" });
  assert.deepEqual(stolen, { ok: false, activated: false, code: "payment_ref_reused" });
  assert.equal(sel(rowFor("other@example.com"), "الحالة"), "بانتظار الدفع", "دفعة واحدة لا تفعّل حسابين");
  const second = await activate({ reference: r1, paymentRef: PAY(14), amountHalalas: 50000, billing: "monthly" });
  assert.deepEqual(second, { ok: false, activated: false, code: "reference_already_paid" });
});

test("activate: السنوي يمدّد اثني عشر شهراً بسعر ×12×0.7", async () => {
  resetStore();
  const ref = await pending("pro", "yearly");
  assert.equal((await activate({ reference: ref, paymentRef: PAY(15), amountHalalas: 100000, billing: "yearly" })).code, "amount_mismatch", "ثمن الشهر لا يشتري سنة");
  const r = await activate({ reference: ref, paymentRef: PAY(15), amountHalalas: 840000, billing: "yearly", now: day(2026, 1, 31) });
  assert.equal(r.activated, true);
  assert.deepEqual(dates(ROWS[0]), { start: "2026-01-31", end: "2027-01-31" });
  assert.equal(sel(ROWS[0], "الفوترة"), "سنوي");
});

test("activate: نهاية الشهر (٣١ يناير + شهر = ٢٨ فبراير)", async () => {
  resetStore();
  const ref = await pending();
  await activate({ reference: ref, paymentRef: PAY(16), amountHalalas: 50000, billing: "monthly", now: day(2027, 1, 31) });
  assert.deepEqual(dates(ROWS[0]), { start: "2027-01-31", end: "2027-02-28" });
});

test("التجديد: نفس الباقة يمتدّ من نهاية المدّة الجارية، والمنقضي يبدأ من اليوم، وتغيير الباقة يبدأ من اليوم", async () => {
  resetStore();
  const first = await pending("basic", "monthly");
  await activate({ reference: first, paymentRef: PAY(20), amountHalalas: 50000, billing: "monthly", now: day(2026, 10, 8) });
  // تجديدٌ مبكر: يمتدّ من 2026-11-08
  const second = await pending("basic", "monthly");
  assert.notEqual(second, first, "دورةٌ جديدة = مرجعٌ جديد");
  await activate({ reference: second, paymentRef: PAY(21), amountHalalas: 50000, billing: "monthly", now: day(2026, 10, 20) });
  assert.deepEqual(dates(ROWS[0]), { start: "2026-10-08", end: "2026-12-08" });
  // بعد الانقضاء: من اليوم
  const third = await pending("basic", "monthly");
  await activate({ reference: third, paymentRef: PAY(22), amountHalalas: 50000, billing: "monthly", now: day(2027, 3, 1) });
  assert.deepEqual(dates(ROWS[0]), { start: "2027-03-01", end: "2027-04-01" });
  // ترقية: من اليوم لا من نهاية الباقة الأدنى
  const up = await pending("pro", "yearly");
  await activate({ reference: up, paymentRef: PAY(23), amountHalalas: 840000, billing: "yearly", now: day(2027, 3, 10) });
  assert.equal(sel(ROWS[0], "الباقة"), "احترافية");
  assert.deepEqual(dates(ROWS[0]), { start: "2027-03-10", end: "2028-03-10" });
  assert.equal(ROWS.length, 1, "كل ذلك على صفٍّ واحد");
});

test("activate: صفٌّ بلا رمز وصول يُمنح رمزاً عشوائياً عند التفعيل (لا لوحةً تُفتح على لا شيء)", async () => {
  resetStore();
  const ref = await pending();
  ROWS[0].properties["رمز الوصول"] = { type: "rich_text", rich_text: [] };
  await activate({ reference: ref, paymentRef: PAY(24), amountHalalas: 50000, billing: "monthly" });
  assert.match(val(ROWS[0], "رمز الوصول"), /^BP-EMP-[A-HJ-NP-Z2-9]{12}$/);
});

test("سجلّ الدفعات: ملاحظات المستخدم الحرّة تبقى، والسجلّ لا يتجاوز ١٨٠٠ حرف ولا يفقد أحدث دفعة", async () => {
  resetStore();
  let ref = await pending();
  ROWS[0].properties["ملاحظات"] = { type: "rich_text", rich_text: [{ plain_text: "ملاحظة بشرية مهمة\n" + "ب".repeat(1500) + `\n${"اشتراك إلكتروني | " + ref + " | basic | monthly"}` }] };
  for (let i = 0; i < 20; i++) {
    if (i > 0) ref = await pending();
    const r = await activate({ reference: ref, paymentRef: PAY(100 + i), amountHalalas: 50000, billing: "monthly", now: day(2026, 10, 8) + i * 86400000 });
    assert.equal(r.activated, true, "الدفعة " + i);
  }
  const notes = val(ROWS[0], "ملاحظات");
  assert.ok(notes.length <= 1800, "طول الملاحظات " + notes.length);
  assert.ok(notes.includes(PAY(119)), "أحدث دفعة محفوظة");
  assert.equal((await activate({ reference: ref, paymentRef: PAY(119), amountHalalas: 50000, billing: "monthly" })).code, "already_processed");
});

// ═══════════════════════ ⑤ نوشن يفشل ⇒ يُغلق ═══════════════════════
test("نوشن معطّل: createPending وactivate يعيدان ok:false ولا يرميان", async () => {
  resetStore();
  const ref = await pending();
  notionDown = true;
  const c = await createPending({ email: "x@example.com", company: "ش", plan: "basic", billing: "monthly" });
  assert.deepEqual(c, { ok: false, code: "notion_error" });
  const a = await activate({ reference: ref, paymentRef: PAY(30), amountHalalas: 50000, billing: "monthly" });
  assert.deepEqual(a, { ok: false, activated: false, code: "notion_error" });
  notionDown = false;
  stillPending();
  assert.equal(ROWS.length, 1);
});

test("نوشن يردّ على الاستعلام ويفشل في الكتابة: لا تفعيل، والصف كما هو، وتنجح إعادة المحاولة بالدفعة نفسها", async () => {
  resetStore();
  const ref = await pending();
  patchFails = true;
  const a = await activate({ reference: ref, paymentRef: PAY(31), amountHalalas: 50000, billing: "monthly" });
  assert.deepEqual(a, { ok: false, activated: false, code: "notion_error" });
  assert.equal(sel(ROWS[0], "الحالة"), "بانتظار الدفع");
  assert.ok(!val(ROWS[0], "ملاحظات").includes(PAY(31)), "الدفعة لم تُسجَّل ما دام التفعيل لم يقع");
  patchFails = false;
  const retry = await activate({ reference: ref, paymentRef: PAY(31), amountHalalas: 50000, billing: "monthly" });
  assert.deepEqual(retry, { ok: true, activated: true });
  patchFails = true;
  const c = await createPending({ email: BUYER, company: "ش", plan: "pro", billing: "monthly" });
  assert.equal(c.ok, false);
  patchFails = false;
});

test("بلا مفتاح نوشن: not_configured ولا تفعيل", async () => {
  // الوحدة تقرأ المفتاح عند التحميل؛ نُحمّل نسخة ثانية بلا مفتاح.
  const saved = process.env.NOTION_TOKEN;
  delete process.env.NOTION_TOKEN;
  try {
    const bare = await import("../api/employer.js?no-token");
    assert.deepEqual(await bare.createPendingSubscription({ email: BUYER, company: "ش", plan: "basic", billing: "monthly" }), { ok: false, code: "not_configured" });
    assert.deepEqual(await bare.activateSubscription({ reference: "BP-EMPSUB-AAAAAAAAAAAA", paymentRef: PAY(40), amountHalalas: 50000, billing: "monthly" }), { ok: false, activated: false, code: "not_configured" });
  } finally { process.env.NOTION_TOKEN = saved; }
});

// ═══════════════════════ ⑥ التكامل مع بوابة البيانات (sub) ═══════════════════════
test("البيانات لا تُفتح قبل التفعيل، وتُفتح بعده — على handler الحقيقي", async () => {
  resetStore();
  // لا صفّ: لا اشتراك
  let v = await validate();
  assert.equal(v.data.sub, false);
  const ref = await pending("pro", "monthly");
  const accessCode = val(ROWS[0], "رمز الوصول");

  v = await validate();
  assert.equal(v.data.sub, false, "بانتظار الدفع لا يفتح البيانات");
  assert.equal(v.data.emp, "pending");
  const byCode = await call(candidates, "GET", "/api/candidates?validate=1&code=" + encodeURIComponent(accessCode));
  assert.equal(byCode.data.sub, false, "ولا رمز الوصول يفتحها قبل التفعيل");
  assert.equal(byCode.data.unlocked, false);

  // محاولات تفعيلٍ مرفوضة لا تفتح شيئاً
  await activate({ reference: ref, paymentRef: PAY(50), amountHalalas: 1, billing: "monthly" });
  await activate({ reference: ref, amountHalalas: 100000, billing: "monthly" });
  v = await validate();
  assert.equal(v.data.sub, false);

  assert.equal((await activate({ reference: ref, paymentRef: PAY(51), amountHalalas: 100000, billing: "monthly" })).activated, true);
  v = await validate();
  assert.equal(v.data.sub, true, "بعد الدفع المُتحقَّق منه تُفتح");
  assert.equal(v.data.plan, "احترافية");
  assert.equal(v.data.unlocked, true);
  assert.ok(!v.raw.includes(accessCode), "رمز الوصول لا يصل المتصفّح");
  assert.ok(!v.raw.includes("row-"), "ولا معرّف الصف");
  const byCode2 = await call(candidates, "GET", "/api/candidates?validate=1&code=" + encodeURIComponent(accessCode));
  assert.equal(byCode2.data.sub, true);

  // وإيقاف الصف في نوشن يُغلقها فوراً (التحكّم اليدوي باقٍ للمالك)
  ROWS[0].properties["الحالة"] = { type: "select", select: { name: "موقوف" } };
  v = await validate();
  assert.equal(v.data.sub, false);
});

// ═══════════════════════ ⑦ لا فعلَ HTTP يفعّل، والتسجيل العام لم يتغيّر ═══════════════════════
test("POST /api/employer لا يفعّل بأي اسم فعل: يسقط إلى مسار التسجيل (400) والصف كما هو", async () => {
  resetStore();
  const ref = await pending();
  for (const action of ["activate", "activate-subscription", "activateSubscription", "pay", "confirm-payment"]) {
    const r = await call(EMP.default, "POST", "/api/employer", {
      body: { action, reference: ref, paymentRef: PAY(60), amountHalalas: 50000, billing: "monthly" },
    });
    assert.equal(r.status, 400, action);
    assert.equal(r.data.error, "invalid_fields");
  }
  stillPending();
});

test("التسجيل العام ما زال «بانتظار الدفع» دائماً، وملاحظاته سطرٌ واحد لا يحاكي سجلّ الدفع", async () => {
  resetStore();
  const forged = `x\nدفعة | ${PAY(70)} | BP-EMPSUB-AAAAAAAAAAAA | 2026-01-01\nاشتراك إلكتروني | BP-EMPSUB-BBBBBBBBBBBB | pro | monthly`;
  const r = await call(EMP.default, "POST", "/api/employer", {
    body: { company: "شركة التسجيل", phone: "0551234567", email: "reg@example.com", plan: "pro", billing: "monthly", notes: forged },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  const row = rowFor("reg@example.com");
  assert.equal(sel(row, "الحالة"), "بانتظار الدفع");
  assert.ok(!val(row, "ملاحظات").includes("\n"), "لا أسطر");
  // ولا يستطيع المسجِّل استهلاك دفعةِ غيره بتزوير سطرها
  const victim = await pending("basic", "monthly", BUYER);
  const a = await activate({ reference: victim, paymentRef: PAY(70), amountHalalas: 50000, billing: "monthly" });
  assert.equal(a.activated, true, "السطر المزوَّر لم يُحسب دفعةً");
});

// ═══════════════════════ ⑧ الواجهة: الأرقام المولَّدة = أرقام الخادم ═══════════════════════
test("الواجهة: أسعار /employer المولَّدة وSKU السلة تطابق getPlanOffer في الأربع لغات", async () => {
  const { buildSimpleEmployer } = await import("../site/scripts/simple-v1-employer.mjs");
  const SV1 = { header: () => "", footer: () => "", shell: ({ body, script }) => body + script };
  for (const lang of ["ar", "en", "fr", "zh"]) {
    const html = buildSimpleEmployer(SV1, { lang: () => lang, esc: (s) => String(s) });
    const m = /var PLANS=(\[.*?\]);\n/s.exec(html);
    assert.ok(m, `[${lang}] لم يُجد جدول الباقات المولَّد`);
    const plans = JSON.parse(m[1]);
    assert.deepEqual(plans.map((p) => p.key), ["basic", "pro"], "الباقتان القابلتان للدفع فقط، لا enterprise");
    for (const p of plans) {
      for (const billing of ["monthly", "yearly"]) {
        const offer = getPlanOffer(p.key, billing);
        const o = p.offers[billing];
        assert.equal(o.sku, offer.sku, `[${lang}] ${p.key}/${billing} sku`);
        assert.equal(Math.round(o.amount * 100), offer.amountHalalas, `[${lang}] ${p.key}/${billing} amount`);
      }
    }
    assert.ok(!/enterprise/i.test(m[1]), "enterprise لا يظهر في جدول الدفع");
  }
});

// ═══════════════════════ ⑨ الواجهة: «اشترك» ← السلة ← /checkout ═══════════════════════
// نُشغّل مقطع الاشتراك من السكربت المولَّد نفسه في سياقٍ معزول بدمى DOM ضئيلة: نقيس العقد مع
// السلة (المعرّف = SKU، كمية ١، استبدال بند اشتراكٍ سابق، بقاء غيره) والوجهة، لا شكل الصفحة.
import vm from "node:vm";
async function planUi(lang = "ar", { storage } = {}) {
  const { buildSimpleEmployer } = await import("../site/scripts/simple-v1-employer.mjs");
  const SV1 = { header: () => "", footer: () => "", shell: ({ body, script }) => ({ body, script }) };
  const { body, script } = buildSimpleEmployer(SV1, { lang: () => lang, esc: (s) => String(s) });
  const from = script.indexOf("var plBill=");
  const to = script.indexOf("$('plY').onclick=");
  const section = script.slice(from, script.indexOf("\n", to));
  const plansJson = /var PLANS=(\[.*?\]);\n/s.exec(script)[1];
  const els = {};
  const el = (id) => (els[id] ||= { id, attrs: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = v; }, querySelectorAll: () => [], textContent: "", innerHTML: "" });
  const store = storage || new Map();
  const ctx = {
    $: el, show() {}, esc: (s) => String(s), TX: JSON.parse(/var TX=(\{.*?\}),HOME=/s.exec(script)[1]),
    PLANS: JSON.parse(plansJson), CHECKOUT: lang === "en" ? "/checkout" : `/${lang}/checkout`,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { if (store.fail) throw new Error("denied"); store.set(k, v); } },
    document: { dispatchEvent() {} }, CustomEvent: class {}, location: { href: "" }, Array, JSON, String, Number, RegExp,
  };
  vm.createContext(ctx);
  vm.runInContext(section + "\nthis.__subscribe = subscribe; this.__draw = drawPlans; this.__setBill = function(b){plBill=b};", ctx);
  return { ctx, store, els, body };
}

test("الواجهة: اشترك يضع SKU الباقة في السلة بكمية ١ ويذهب إلى /checkout بلغة الصفحة", async () => {
  for (const lang of ["ar", "en", "fr", "zh"]) {
    const { ctx, store } = await planUi(lang);
    ctx.__subscribe("pro");
    const cart = JSON.parse(store.get("bp_cart"));
    assert.equal(cart.length, 1);
    assert.equal(cart[0].id, "BP-EMP-PRO-M", lang);
    assert.equal(cart[0].qty, 1);
    assert.equal(cart[0].amount, getPlanOffer("pro", "monthly").amountHalalas / 100);
    assert.equal(ctx.location.href, lang === "en" ? "/checkout" : `/${lang}/checkout`);
    ctx.__setBill("yearly");
    ctx.__subscribe("basic");
    const c2 = JSON.parse(store.get("bp_cart"));
    assert.deepEqual(c2.map((x) => x.id), ["BP-EMP-BASIC-Y"], "اشتراكٌ واحد: الجديد يحلّ محلّ القديم");
    assert.equal(c2[0].amount, getPlanOffer("basic", "yearly").amountHalalas / 100);
  }
});

test("الواجهة: بنود السلة الأخرى تبقى، والمتصفّح الذي يمنع التخزين لا يذهب إلى الدفع بسلةٍ فارغة", async () => {
  const keep = new Map([["bp_cart", JSON.stringify([{ id: "svc-x", qty: 2 }, { id: "BP-EMP-PRO-Y", qty: 3 }])]]);
  const a = await planUi("ar", { storage: keep });
  a.ctx.__subscribe("basic");
  const cart = JSON.parse(keep.get("bp_cart"));
  assert.deepEqual(cart.map((x) => [x.id, x.qty]), [["svc-x", 2], ["BP-EMP-BASIC-M", 1]]);

  const blocked = new Map(); blocked.fail = true;
  const b = await planUi("ar", { storage: blocked });
  b.ctx.__subscribe("pro");
  assert.equal(b.ctx.location.href, "", "لا انتقال");
  assert.ok(b.els.plMsg && b.els.plMsg.textContent.length > 0, "رسالة خطأ ظاهرة");
});

test("الواجهة: لا لون حرفي في أنماط الباقات، وزرّ التسجيل القديم باقٍ على /employer-join، والتحكّم ببيانات المرشحين لم يُمسّ", async () => {
  const { body } = await planUi("ar");
  const css = body.slice(body.indexOf(".sv1-pl-tog{"), body.indexOf(".sv1-lockbar{"));
  assert.ok(css.length > 200);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), "لون حرفي في CSS الباقات");
  assert.ok(body.includes('/employer-join'), "رابط «سجّل شركتك» القديم باقٍ");
  assert.ok(body.includes('href="#/plans"'), "زر الاشتراك في الإعدادات");
});
