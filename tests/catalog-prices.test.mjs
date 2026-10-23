// الأسعار في الكتالوج وعرض السعر والعقد (شكوى المالك 2026-10-23):
//   «الكتالوج موجود والأسعار غير موجودة، وليش ما في ملحق بأسعار كل الخدمات يُرفق بعرض السعر والعقد».
//
// يُثبت هذا الملف:
//   ١) دفتر الأسعار (api/_catalog-prices.js): كل SKU في catalog.json — خدمات وباقات وباقات الذكاء
//      الاصطناعي والرحلات — يُحلّ بالاسمين وسعر قبل الضريبة وحالة من ثلاث؛ ولا «ثابت» بمبلغ صفر.
//   ٢) جدول الملحق (annexRows/annexHtml/unpricedTable): كل الخدمات والباقات، وعبارتا الضريبة
//      والرسوم الحكومية مطبوعتان، ولا «٠ ر.س» ولا undefined/NaN.
//   ٣) لا سطر بسعر صفر في عرضٍ صادر (api/_simple.js): ops-quote يرفض البند بلا سعر، والتسعير الآلي
//      يصدر بسعر الكتالوج لكل بندٍ ثابت، والباقة تُسعَّر مرجعاً في اللوحة بدل الصفر.
//   ٤) المسجَّل يرى السعر والزائر لا يراه: صفحة /catalog (كل سعر بصنف price-amt) وسكربت الإظهار
//      وسلة التسوق.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-prices-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));

// لا شبكة: الدفتر يُقرأ من الملف المضمَّن.
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const P = await import("../api/_catalog-prices.js");
const book = P.buildPriceBook(catalog);

// ───────────────────────────── ١) دفتر الأسعار ─────────────────────────────

test("الكتالوج: ١٩٥ خدمة بتسعة تصنيفات و١١ باقة و٤ باقات ذكاء — وكلها في الدفتر", () => {
  assert.equal(catalog.services.length, 195);
  assert.equal(new Set(catalog.services.map((s) => s.category)).size, 9);
  assert.equal(catalog.packages.length, 11);
  assert.equal(catalog.aiPlans.length, 4);
  const svc = book.list.filter((e) => e.kind === "service");
  assert.equal(svc.length, 195);
  assert.equal(book.list.filter((e) => e.kind === "package").length, 11);
  assert.equal(book.list.filter((e) => e.kind === "ai-plan").length, 4);
  assert.equal(book.list.filter((e) => e.kind === "trip").length, catalog.trips.length);
});

test("كل SKU في الكتالوج يُحلّ: اسمان، حالة من ثلاث، ولا «ثابت» بمبلغٍ صفر", () => {
  const all = [...catalog.services, ...catalog.packages, ...catalog.aiPlans, ...catalog.trips];
  assert.ok(all.length >= 264);
  for (const row of all) {
    const e = P.resolveSku(book, row.code);
    assert.equal(e.sku, row.code, row.code);
    assert.notEqual(e.kind, "unknown", row.code + " لم يُحلّ");
    assert.ok(e.nameAr, row.code + " بلا اسم عربي");
    assert.ok(e.nameEn, row.code + " بلا اسم إنجليزي");
    assert.ok(["fixed", "quote", "unavailable"].includes(e.status), row.code + " حالة " + e.status);
    assert.equal(e.status === "fixed", e.amount != null && e.amount > 0 && !e.isFloor, row.code);
    if (e.status === "fixed") assert.ok(e.amount > 0 && /\d/.test(e.priceTextAr) && /\d/.test(e.priceTextEn), row.code);
    // المبلغ في الدفتر هو مبلغ الكتالوج نفسه: لا نغيّر قيمة سعر.
    if (row.amount != null) assert.equal(e.amount, row.amount, row.code + " تغيّر مبلغه");
    else assert.equal(e.amount, null, row.code + " أُعطي مبلغاً لم يكن في الكتالوج");
    assert.ok(e.reasonAr || e.status === "fixed", row.code + " غير ثابت بلا سبب");
  }
});

test("تقسيم الحالات يطابق بيانات الكتالوج: ١٧٤ ثابتة و٢١ حسب العرض بين الخدمات", () => {
  const svc = book.list.filter((e) => e.kind === "service");
  const fixed = svc.filter((e) => e.status === "fixed");
  const quote = svc.filter((e) => e.status === "quote");
  assert.equal(fixed.length + quote.length, 195);
  assert.equal(svc.filter((e) => e.status === "unavailable").length, 0);
  // المستقل: مبلغٌ موجب ونموذجه ليس «يبدأ من».
  const expectFixed = catalog.services.filter((s) => s.amount > 0 && s.pricingModel !== "Starting From").length;
  assert.equal(fixed.length, expectFixed);
  assert.equal(quote.filter((e) => e.amount == null).length, catalog.services.filter((s) => s.amount == null).length);
  assert.equal(quote.filter((e) => e.isFloor).length, catalog.services.filter((s) => s.pricingModel === "Starting From").length);
});

test("معرّفات السلة والباقات تُحلّ: svc-/pkg- واللاحقة الشهرية والمفتاح القصير وحالة الأحرف", () => {
  assert.equal(P.resolveSku(book, "svc-bp-chamber-01").sku, "BP-CHAMBER-01");
  assert.equal(P.resolveSku(book, "bp-chamber-01").amount, 300);
  assert.equal(P.resolveSku(book, "pkg-bp-pkg-launch-monthly").sku, "BP-PKG-LAUNCH");
  assert.equal(P.resolveSku(book, "silver").sku, "BP-PKG-LAUNCH");
  assert.equal(P.resolveSku(book, "BP-PKG-LAUNCH").amount, 6000);
});

test("سكو مجهول أو فارغ: «غير متوفر» بسبب مكتوب — لا null ولا صفر", () => {
  for (const id of ["NOPE-1", "", null, undefined, "svc-"]) {
    const e = P.resolveSku(book, id);
    assert.equal(e.status, "unavailable");
    assert.equal(e.amount, null);
    assert.ok(e.reasonAr);
    assert.equal(P.quotablePrice(book, id), null);
  }
});

test("الحدّ الأدنى «يبدأ من» ليس سعراً: حالته حسب العرض بمبلغه، ولا يُكتب آلياً", () => {
  const re = P.resolveSku(book, "BP-RE-02");
  assert.equal(re.status, "quote");
  assert.equal(re.isFloor, true);
  assert.equal(re.amount, 800);
  assert.match(re.priceTextAr, /^يبدأ من 800/);
  assert.equal(re.autoQuotable, false);
  assert.equal(P.quotablePrice(book, "BP-RE-02"), null);
  assert.equal(P.referencePrice(book, "BP-RE-02"), 800);
  const form = P.resolveSku(book, "BP-PKG-FORM-FOREIGN");
  assert.equal(form.status, "quote");
  assert.match(form.priceTextAr, /^يبدأ من 30,000/);
});

test("الاشتراك الشهري ثابت لكنه ليس دفعة واحدة؛ والنسبة المئوية حسب العرض بلا مبلغ", () => {
  const m = P.resolveSku(book, "BP-AI-04");
  assert.equal(m.status, "fixed");
  assert.equal(m.period, "monthly");
  assert.equal(m.autoQuotable, false);
  assert.match(m.priceTextAr, /شهرياً/);
  const pct = P.resolveSku(book, "BP-REC-04");
  assert.equal(pct.status, "quote");
  assert.equal(pct.amount, null);
  assert.match(pct.reasonAr, /نسبة/);
});

// ───────────────────────────── ٢) جدول الملحق ─────────────────────────────

test("جدول الملحق: كل الخدمات والباقات، بعبارة الضريبة والرسوم الحكومية، بلا صفر ولا NaN", () => {
  for (const lang of ["ar", "en", "bi"]) {
    const html = P.annexHtml(book, { lang });
    for (const s of catalog.services) assert.ok(html.includes(s.code), `${lang}: ${s.code} غائب عن الملحق`);
    for (const pk of catalog.packages) assert.ok(html.includes(pk.code), `${lang}: ${pk.code} غائب عن الملحق`);
    assert.doesNotMatch(html, /undefined|NaN|\[object/, lang);
    assert.doesNotMatch(html, /(^|[^\d.,])0(\.00)? (ر\.س|SAR)|SAR 0(\.00)?(?!\d)/, lang + ": سعر صفر في الملحق");
    if (lang !== "en") {
      assert.match(html, /غير شاملة ضريبة القيمة المضافة 15٪/);
      assert.match(html, /الرسوم الحكومية مستثناة دائماً/);
      assert.match(html, /بالتكلفة الفعلية/);
    }
    if (lang !== "ar") {
      assert.match(html, /exclude 15% VAT/);
      assert.match(html, /Government fees are always excluded/);
    }
  }
  // أول تصنيف في الملحق هو أول تصنيف في الكتالوج، والباقات بعد الخدمات.
  const groups = P.annexGroups(book);
  assert.equal(groups[0].key, catalog.categories[0].key);
  assert.equal(groups.filter((g) => g.rows.some((r) => r.kind === "service")).length, 9);
  assert.ok(groups.findIndex((g) => g.rows[0].kind === "package") > 8);
});

test("جدول الملحق: صفوف الخدمات الثابتة تحمل رقماً، وغيرها تقول «حسب العرض» لا رقماً مخترَعاً", () => {
  for (const e of P.annexRows(book, { kinds: ["service", "package", "ai-plan"] })) {
    if (e.status === "fixed") assert.match(e.priceTextAr, /\d/, e.sku);
    if (e.status === "quote" && e.amount == null) assert.doesNotMatch(e.priceTextAr, /\d/, e.sku + " رقمٌ في خدمة بلا مبلغ");
  }
  const rows = P.annexRows(book);
  assert.equal(rows.length, 195 + 11 + 4);
});

test("جدول بلا سعر ثابت لوكيل التسعير: كل خدمة بلا مبلغ في الكتالوج مدرجة بسببها", () => {
  const t = P.unpricedTable(book);
  const noAmount = catalog.services.filter((s) => s.amount == null).map((s) => s.code);
  for (const code of noAmount) assert.ok(t.some((r) => r.sku === code), code + " غائبة عن الجدول");
  for (const r of t) { assert.ok(r.reasonAr, r.sku); assert.ok(["quote", "unavailable"].includes(r.status)); }
  assert.ok(!t.some((r) => r.sku === "BP-CHAMBER-01"), "ثابتة لا تُدرج");
  const st = P.priceStats(book);
  assert.equal(st.total, 210);
  assert.equal(st.fixed + st.quote + st.unavailable, 210);
});

// ───────────────────── ٣) لا سطر بسعر صفر في عرضٍ صادر ─────────────────────

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-catprices-aaaaaaaa" };
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({
    method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${CLIENT.token}` }, socket: {}, query: {},
    body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body },
  }, res);
  return out;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*`))[0];
async function newRequest(scope) {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "اختبار الأسعار", phone: "0501234567", name: "عميل تجريبي", scope });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  return r.body.ref;
}
const noZeroLine = (quote, label) => {
  assert.ok(quote.items.length > 0, label + ": لا بنود");
  for (const l of quote.items) {
    assert.ok(l.price > 0 && l.line > 0, `${label}: السطر ${l.code || l.title} بسعر ${l.price}`);
  }
  assert.ok(quote.net > 0 && quote.total > 0, label + ": إجمالي صفر");
};

test("ops-quote يرفض عرضاً فيه بند بلا سعر: لا يُحفظ عرض، والحالة لا تتحرك، والرسالة تسمّي البند", async () => {
  const ref = await newRequest([{ code: "BP-CHAMBER-01", title: "عضوية الغرفة", qty: 1 }, { code: "CF-GEN", title: "تأسيس الشركات — خدمة حسب الطلب", qty: 1 }]);
  const conf = await call("scope-confirm", { ref });
  assert.equal(conf.body.stage, "QUOTE", "المسعّر يصدر، والبند بلا السعر لا يصدر آلياً بل ينتظر (pending_items)");
  assert.deepEqual(conf.body.quote.pending_items.map((x) => x.title), ["تأسيس الشركات — خدمة حسب الطلب"]);
  const before = await rowOf(ref);

  const q = await call("ops-quote", { ref });
  assert.equal(q.status, 400);
  assert.equal(q.body.ok, false);
  assert.equal(q.body.error, "unpriced_items");
  assert.deepEqual(q.body.unpriced, ["تأسيس الشركات — خدمة حسب الطلب"]);
  assert.match(q.body.message, /لا يصدر عرض سعر ببند بلا سعر/);
  const after = await rowOf(ref);
  assert.equal(after.quote.number, before.quote.number, "العرض القائم لم يُستبدل بعرضٍ فيه بند بلا سعر");
  assert.equal(after.quote.net, before.quote.net);
  assert.equal(after.status, before.status, "الحالة لم تتحرك");
});

test("ops-quote: سعرٌ صفر مكتوب بيد الفريق يُرفض كذلك، وبندٌ حر بلا رمز ولا سعر يُرفض", async () => {
  const ref = await newRequest([{ code: "BP-CHAMBER-01", title: "عضوية الغرفة", qty: 1 }]);
  const z = await call("ops-quote", { ref, items: [{ title: "بند", price: 0, qty: 1 }] });
  assert.equal(z.status, 400);
  assert.equal(z.body.error, "unpriced_items");
  const free = await call("ops-quote", { ref, items: [{ title: "بند حر", qty: 1 }] });
  assert.equal(free.status, 400);
  assert.equal(free.body.error, "unpriced_items");
  assert.equal((await rowOf(ref)).quote || null, null);
});

test("ops-quote: يصدر حين يُسعَّر كل بند — بالكتالوج أو بيد الفريق — بلا أي سطر صفر", async () => {
  const ref = await newRequest([{ code: "BP-CHAMBER-01", title: "عضوية الغرفة", qty: 1 }, { code: "CF-GEN", title: "حسب الطلب", qty: 1 }]);
  await call("scope-confirm", { ref });
  const q = await call("ops-quote", { ref, items: [{ code: "BP-CHAMBER-01", title: "عضوية الغرفة", qty: 1 }, { code: "CF-GEN", title: "حسب الطلب", qty: 1, price: 1200 }] });
  assert.equal(q.body.ok, true, JSON.stringify(q.body));
  noZeroLine(q.body.quote, "ops-quote مسعَّر");
  assert.deepEqual(q.body.quote.items.map((l) => l.price), [300, 1200]);
  assert.equal(q.body.quote.net, 1500);
  assert.equal(q.body.quote.vat, 225);
  assert.equal(q.body.quote.total, 1725);
});

test("التسعير الآلي: كل خدمة ثابتة بدفعة واحدة تُصدَر بسعر الكتالوج نفسه وبلا سطر صفر", async () => {
  const auto = book.list.filter((e) => e.kind === "service" && e.autoQuotable);
  assert.ok(auto.length > 150, "عدد الثابتة المؤهَّلة: " + auto.length);
  for (let i = 0; i < auto.length; i += 25) {
    const chunk = auto.slice(i, i + 25);
    const ref = await newRequest(chunk.map((e) => ({ code: e.sku, title: e.nameAr, qty: 1 })));
    const conf = await call("scope-confirm", { ref });
    assert.equal(conf.body.ok, true, JSON.stringify(conf.body));
    assert.equal(conf.body.stage, "QUOTE", `الدفعة ${i}: لم يصدر العرض آلياً — بلا سعر: ${JSON.stringify(conf.body.unpriced)}`);
    noZeroLine(conf.body.quote, `الدفعة ${i}`);
    chunk.forEach((e, k) => assert.equal(conf.body.quote.items[k].price, e.amount, `${e.sku}: سعر العرض يخالف الكتالوج`));
    const sum = Math.round(chunk.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    assert.equal(conf.body.quote.net, sum);
  }
});

test("لا يصدر آلياً ما سعره ليس «السعر»: يبدأ من / شهري / حسب العرض يمرّ على إنسان", async () => {
  for (const sku of ["BP-RE-02", "BP-AI-04", "BP-REC-04", "CF-GEN"]) {
    const ref = await newRequest([{ code: sku, title: sku, qty: 1 }]);
    const conf = await call("scope-confirm", { ref });
    assert.equal(conf.body.stage, "PRICING", sku);
    assert.equal((await rowOf(ref)).quote || null, null, sku);
  }
});

test("الباقة في اللوحة: سعر الكتالوج مرجعاً في حقل السعر بدل الصفر الصامت، والإصدار بها بسعرها", async () => {
  const ref = await newRequest([{ code: "BP-PKG-LAUNCH", title: "باقة الانطلاق", qty: 1 }, { code: "BP-PKG-ENTERPRISE", title: "باقة الشراكة المؤسسية", qty: 1 }]);
  const conf = await call("scope-confirm", { ref });
  assert.equal(conf.body.stage, "PRICING", "الباقة الشهرية لا تصدر آلياً");
  const view = await call("ops-request", { ref });
  assert.equal(view.body.ok, true);
  const launch = view.body.request.scope.find((s) => s.code === "BP-PKG-LAUNCH");
  const ent = view.body.request.scope.find((s) => s.code === "BP-PKG-ENTERPRISE");
  assert.equal(launch.price, 6000, "سعر الباقة المرجعي");
  assert.equal(ent.price, undefined, "باقة بلا مبلغ تبقى بلا سعر");
  // الفريق يُصدر الباقة المسعّرة: سعرها لا صفر.
  const ok = await call("ops-quote", { ref, items: [{ code: "BP-PKG-LAUNCH", title: "باقة الانطلاق", qty: 1 }], confirm_prices: true });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  noZeroLine(ok.body.quote, "الباقة");
  assert.equal(ok.body.quote.items[0].price, 6000);
});

test("اللوحة: خدمة بسعر ثابت تأتي بسعرها مملوءاً في حقل السعر قبل الإصدار", async () => {
  const ref = await newRequest([{ code: "BP-CHAMBER-01", title: "عضوية الغرفة", qty: 1 }, { code: "CF-GEN", title: "حسب الطلب", qty: 1 }]);
  await call("scope-confirm", { ref });
  const view = await call("ops-request", { ref });
  const sc = view.body.request.scope;
  assert.equal(sc.find((s) => s.code === "BP-CHAMBER-01").price, 300);
  assert.equal(sc.find((s) => s.code === "CF-GEN").price, undefined);
});

// ───────────────── ٤) المسجَّل يرى السعر والزائر لا يراه ─────────────────

class FakeEl {
  constructor(tag, doc) { this.tag = tag; this.doc = doc; this.children = []; this.className = ""; this.attrs = {}; this._t = ""; this.value = ""; this.style = {}; this.listeners = {}; this._cl = new Set(); this.checked = false; }
  get classList() { const s = this; return { add: (c) => s._cl.add(c), remove: (c) => s._cl.delete(c), contains: (c) => s._cl.has(c) || s.className.split(/\s+/).includes(c), toggle: (c, on) => { (on === undefined ? !s._cl.has(c) : on) ? s._cl.add(c) : s._cl.delete(c); } }; }
  get cls() { return (this.className + " " + [...this._cl].join(" ")).trim().split(/\s+/); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(ev, fn) { this.listeners[ev] = fn; }
  set textContent(v) { this._t = String(v); this.children = []; }
  get textContent() { return this._t + this.children.map((c) => c.textContent).join(""); }
  set innerHTML(v) { this.children = []; this._t = ""; }
  get innerHTML() { return ""; }
  querySelectorAll(sel) {
    const want = sel.replace(/^\./, "");
    const out = [];
    (function walk(n) { for (const c of n.children) { if (c.cls.includes(want)) out.push(c); walk(c); } })(this);
    return out;
  }
  click() { if (this.onclick) this.onclick.call(this, { stopPropagation() {} }); }
}
function runCatalog(page, { search = "" } = {}) {
  const els = new Map();
  const doc = {
    body: new FakeEl("body"),
    documentElement: { attrs: {}, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); } },
    getElementById(id) { if (!els.has(id)) els.set(id, new FakeEl("div", doc)); const e = els.get(id); e.id = id; return e; },
    createElement(tag) { return new FakeEl(tag, doc); },
  };
  const store = new Map();
  const sandbox = {
    document: doc, console, URLSearchParams, JSON, Math, Number, String, Array, Object, Date, RegExp, Promise, setTimeout, clearTimeout,
    location: { search, href: "", pathname: "/ar/catalog" },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    sessionStorage: { setItem() {}, getItem() { return null; } },
    CustomEvent: class {}, fetch: async () => ({ json: async () => ({}) }),
  };
  sandbox.window = sandbox;
  doc.documentElement.attrs["data-prices"] = "off";
  const js = String(page.script).replace(/^<script>/, "").replace(/<\/script>$/, "");
  vm.runInNewContext(js, sandbox);
  return { doc, els };
}
const { buildSimpleCatalog } = await import(pathToFileURL(path.join(ROOT, "site/scripts/simple-v1-catalog.mjs")).href);
const SV1 = { header: () => "", footer: () => "", shell: (o) => o, t: (k) => k };
const mkCtx = (lang) => ({ lang: () => lang, esc: (s) => String(s), catLabel: (c) => c, govLabel: (g) => g });
const priceNodesOf = (els, cls) => els.get("svcList").querySelectorAll(cls);

test("/catalog: كل سعر خدمة يُرسَم بصنف price-amt (يخفيه الزائر ويراه المسجَّل) وبنص دفتر الأسعار", () => {
  const prev = process.cwd();
  process.chdir(ROOT);
  try {
    const { els } = runCatalog(buildSimpleCatalog(SV1, mkCtx("ar")));
    const rows = els.get("svcList").querySelectorAll("sv1-pick");
    assert.equal(rows.length, 195, "كل الخدمات مرسومة");
    const prices = priceNodesOf(els, "sv1-pick-price");
    const expected = catalog.services.filter((s) => s.amount > 0 && !["Real Estate", "Tourism"].includes(s.category));
    assert.equal(prices.length, expected.length, "سعرٌ لكل خدمة لها مبلغ");
    for (const n of prices) assert.ok(n.cls.includes("price-amt"), "سعر بلا price-amt: " + n.textContent);
    // نصّ السعر هو نصّ الدفتر (بنصفه «﷼»).
    const texts = new Set(prices.map((n) => n.textContent));
    for (const s of expected) assert.ok(texts.has(P.priceText(P.resolveSku(book, s.code), "ar", "﷼")), s.code + " نصّ سعره غير مرسوم");
    // الرقم غير المخفي الوحيد: لا عنصر بصنف غير price-amt يحمل رقماً بالريال.
    const leaked = els.get("svcList").querySelectorAll("sv1-pick-custom").filter((n) => /\d/.test(n.textContent));
    assert.equal(leaked.length, 0, "لافتة «بعرض سعر» بلا أرقام");
    // خدمة بلا مبلغ لا تحمل عنصر سعر.
    const noPrice = rows.filter((r) => r.querySelectorAll("sv1-pick-custom").length && !r.querySelectorAll("sv1-pick-price").length);
    assert.ok(noPrice.length >= catalog.services.filter((s) => s.amount == null).length);
  } finally { process.chdir(prev); }
});

test("/catalog: الباقات — سعر بصنف price-amt و«يبدأ من» لا تُسقط، وباقة بلا مبلغ تُكتب لافتتها", () => {
  const prev = process.cwd();
  process.chdir(ROOT);
  try {
    const { els } = runCatalog(buildSimpleCatalog(SV1, mkCtx("ar")));
    const cards = els.get("pkgList").querySelectorAll("sv1-pkg");
    assert.equal(cards.length, 11);
    const byName = Object.fromEntries(cards.map((c) => [c.children[0].textContent, c]));
    const foreign = byName["باقة تأسيس الشركات الأجنبية"];
    const amt = foreign.querySelectorAll("amt")[0];
    assert.match(amt.textContent, /^يبدأ من 30,000/);
    assert.ok(amt.cls.includes("price-amt"));
    const ent = byName["باقة الشراكة المؤسسية"].querySelectorAll("amt")[0];
    assert.equal(ent.textContent, "باقة حسب الطلب");
    assert.ok(!ent.cls.includes("price-amt"), "اللافتة ليست رقماً");
    for (const c of cards) for (const a of c.querySelectorAll("amt")) if (/\d/.test(a.textContent)) assert.ok(a.cls.includes("price-amt"), a.textContent);
  } finally { process.chdir(prev); }
});

test("/catalog المبنيّة: الزائر لا يرى price-amt، والمسجَّل يراها، وللزائر سطر يدلّه على التسجيل", () => {
  for (const lang of ["ar", "en", "fr", "zh"]) {
    const file = path.join(ROOT, "site", lang === "en" ? "" : lang, "catalog.html");
    assert.ok(fs.existsSync(file), file);
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /<html[^>]*data-prices="off"/, lang + ": الصفحة تُبنى بإخفاء الأسعار");
    assert.match(html, /html\[data-prices="off"\] \.price-amt[^{]*\{display:none!important\}/, lang + ": قاعدة الإخفاء");
    assert.match(html, /html\[data-prices="on"\] \[data-guest-note\]\{display:none!important\}/, lang + ": ملاحظة الزائر تختفي عند المسجَّل");
    assert.match(html, /class="sv1-cat-pricenote"><span class="price-amt">/, lang + ": ملاحظة الضريبة بصنف price-amt");
    assert.match(html, /<span data-guest-note>[^<]+<a href="[^"]*\/my\?next=/, lang + ": سطر الزائر");

    // سكربت الإظهار في رأس الصفحة: يقلب data-prices إلى on بوجود bp_session فقط.
    const m = /<script>\/\* Signed-in clients see prices[^]*?<\/script>/.exec(html);
    assert.ok(m, lang + ": سكربت إظهار الأسعار للمسجَّل");
    const run = (session) => {
      const attrs = { "data-prices": "off" };
      const sb = { document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] } }, localStorage: { getItem: (k) => (session && k === "bp_session" ? "1" : null) } };
      vm.runInNewContext(m[0].replace(/^<script>/, "").replace(/<\/script>$/, ""), sb);
      return attrs["data-prices"];
    };
    assert.equal(run(false), "off", lang + ": الزائر");
    assert.equal(run(true), "on", lang + ": المسجَّل");
  }
});

test("السلة: المسجَّل يرى سعر البند والمجموع بالضريبة، والزائر لا يرى رقماً", async () => {
  const { buildSimpleCart } = await import(pathToFileURL(path.join(ROOT, "site/scripts/simple-v1-cart.mjs")).href);
  const page = buildSimpleCart({ header: () => "", footer: () => "", shell: (o) => o }, { lang: () => "ar", esc: (s) => String(s) });
  const js = String(page.script).replace(/^<script>/, "").replace(/<\/script>$/, "");
  const cart = [{ id: "svc-bp-chamber-01", nameAr: "عضوية الغرفة", nameEn: "Chamber", amount: 300, price: "", qty: 1, kind: "service", pricePublic: 0 }];
  async function boot(prices) {
    const els = new Map();
    const mk = (id) => { const e = new FakeEl("div"); e.id = id; e.rows = []; return e; };
    const doc = {
      getElementById: (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
      createElement: (t) => new FakeEl(t),
      documentElement: { getAttribute: (k) => (k === "data-prices" ? prices : null), setAttribute() {} },
      addEventListener() {},
    };
    const sb = {
      document: doc, console, JSON, Math, Number, String, Array, Object, Date, RegExp, Promise, setTimeout, clearTimeout, encodeURIComponent,
      localStorage: { getItem: (k) => (k === "bp_cart" ? JSON.stringify(cart) : null), setItem() {} },
      CustomEvent: class {}, addEventListener() {},
      fetch: async () => ({ json: async () => ({}) }),
    };
    sb.window = sb;
    vm.runInNewContext(js, sb);
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    return els;
  }
  const reg = await boot("on");
  const regText = reg.get("cartItems").textContent;
  assert.match(regText, /300\.00/, "المسجَّل يرى سعر البند");
  assert.equal(reg.get("cartNet").textContent, "300.00 ﷼");
  assert.equal(reg.get("cartVat").textContent, "45.00 ﷼");
  assert.equal(reg.get("cartTotal").textContent, "345.00 ﷼");
  const guest = await boot("off");
  assert.doesNotMatch(guest.get("cartItems").textContent, /300|345/, "الزائر لا يرى سعراً في السلة");
  assert.match(guest.get("cartItems").textContent, /السعر يظهر بعد تسجيل الدخول/);
  assert.equal(guest.get("cartTotal").textContent, "—");
});

// ───────────────────────────── ٥) سعر الخدمة يظهر فور الفتح ─────────────────────────────

test("live-prices.js: سعر البناء هو السعر — تُنزع data-bp-pending فوراً فلا يبقى السعر مخفياً ثانيتين", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/assets/js/live-prices.js"), "utf8");
  const nodes = [{ removed: false, removeAttribute() { this.removed = true; } }, { removed: false, removeAttribute() { this.removed = true; } }];
  const sb = {
    document: { querySelectorAll: (sel) => (sel === "[data-bp-pending]" ? nodes : []), documentElement: { getAttribute: () => "ar" } },
    fetch: () => { throw new Error("بلا شبكة: LIVE_OVERRIDE مغلق"); },
    Intl, console,
  };
  vm.runInNewContext(src, sb);
  assert.ok(nodes.every((n) => n.removed), "كل data-bp-pending نُزعت");
});


// ───────────────────── جولة فاحص الكتالوج (2026-10-23): بنود ٤–٨ ─────────────────────

const ctxEsc = (lang) => ({ lang: () => lang, esc: (x) => String(x), catLabel: (k) => ({ Recruitment: "Recruitment &amp; Hiring", "AI Automation": "AI &amp; Automation" })[k] || k, govLabel: (g) => String(g).replace(/&/g, "&amp;") });

test("٤) /catalog الإنجليزي: عناوين المجموعات بلا هروب مزدوج («&amp;» حرفياً)", () => {
  const prev = process.cwd(); process.chdir(ROOT);
  try {
    const { els } = runCatalog(buildSimpleCatalog(SV1, ctxEsc("en")));
    const heads = els.get("svcList").querySelectorAll("sv1-grp").map((g) => g.children[0].textContent);
    const all = heads.join("|");
    assert.match(all, /Recruitment & Hiring/);
    assert.match(all, /AI & Automation/);
    assert.doesNotMatch(all, /&amp;|&lt;|&gt;/);
  } finally { process.chdir(prev); }
  for (const f of ["site/catalog.html", "site/fr/catalog.html"]) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(html, /&amp;amp;/, f);
    assert.doesNotMatch(html, /"cat":"[^"]*&amp;/, f + ": عنوان مجموعة مهرَّب في البيانات");
  }
});

test("٥) شارة العدد بحسب اللغة: «195 خدمة · 11 باقة» و«195 services · 11 packages»", () => {
  const prev = process.cwd(); process.chdir(ROOT);
  try {
    const tag = (lang) => /<span class="sv1-tag">([^<]+)<\/span>/.exec(String(buildSimpleCatalog(SV1, mkCtx(lang)).body))[1];
    assert.equal(tag("ar"), "195 خدمة · 11 باقة");
    assert.equal(tag("en"), "195 services · 11 packages");
    assert.match(tag("fr"), /^195 services · 11 forfaits$/);
    assert.match(tag("zh"), /^195 项服务 · 11 个套餐$/);
    assert.doesNotMatch(tag("ar"), /الباقات/);
    assert.doesNotMatch(tag("en"), /Packages/);
  } finally { process.chdir(prev); }
});

test("٦) العقار والسياحة: القائمة لا تعرض سعراً، كصفحة الخدمة والسلة — لا سعر في أحدهما دون الآخر", () => {
  const prev = process.cwd(); process.chdir(ROOT);
  try {
    const { els } = runCatalog(buildSimpleCatalog(SV1, mkCtx("ar")));
    const prices = els.get("svcList").querySelectorAll("sv1-pick-price").map((n) => n.textContent);
    const re = catalog.services.filter((s) => ["Real Estate", "Tourism"].includes(s.category));
    assert.ok(re.length >= 7);
    // لا نصّ سعر عقار في القائمة (3,000 / 800 / 1,500 / 5,000 «يبدأ من»).
    for (const s of re.filter((x) => x.amount > 0)) assert.ok(!prices.includes(P.priceText(P.resolveSku(book, s.code), "ar", "﷼")) || catalog.services.some((o) => o.code !== s.code && !["Real Estate", "Tourism"].includes(o.category) && o.amount === s.amount && o.pricingModel === s.pricingModel), s.code + " سعرٌ في القائمة");
    assert.equal(prices.length, catalog.services.filter((s) => s.amount > 0 && !["Real Estate", "Tourism"].includes(s.category)).length);
  } finally { process.chdir(prev); }
  // صفحة الخدمة المبنيّة: لا خانة سعر لأي عقار.
  for (const s of catalog.services.filter((x) => x.category === "Real Estate")) {
    const f = path.join(ROOT, "site/ar/services", s.code.toLowerCase() + ".html");
    if (!fs.existsSync(f)) continue;
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /sv1-svc-price price-amt/, s.code + " له سعر في صفحته");
  }
});

test("٧) نصّ السعر في القائمة هو نصّ صفحة الخدمة حرفاً بحرف (عربي: ﷼، إنجليزي وفرنسي وصيني: SAR)", () => {
  let checked = 0;
  for (const [dir, lang, cur] of [["site/ar", "ar", "﷼"], ["site", "en", "SAR"], ["site/fr", "en", "SAR"], ["site/zh", "en", "SAR"]]) {
    for (const s of catalog.services.filter((x) => x.amount > 0 && !["Real Estate", "Tourism"].includes(x.category))) {
      const f = path.join(ROOT, dir, "services", s.code.toLowerCase() + ".html");
      if (!fs.existsSync(f)) continue;
      const m = /sv1-svc-price price-amt"[^>]*>([^<]*)</.exec(fs.readFileSync(f, "utf8"));
      if (!m) continue;
      const e = P.resolveSku(book, s.code);
      if (e.isFloor) continue;
      const want = P.priceText(e, lang, cur, { site: true });
      assert.equal(m[1].trim(), want, `${dir}/${s.code}`);
      checked++;
    }
  }
  assert.ok(checked > 600, "عدد المقارنات: " + checked);
});

test("٨) الملحق يبيّن الدورة والحدّ الأدنى: BP-HR-03 «شهرياً» وBP-RE-01 «يبدأ من»", () => {
  const hr = P.resolveSku(book, "BP-HR-03");
  assert.match(hr.priceTextAr, /2,500 ر\.س \/ شهرياً/);
  assert.equal(hr.statusAr, "سعر ثابت · شهري");
  assert.equal(hr.cycleAr, "شهرياً");
  assert.equal(hr.cycleEn, "monthly");
  const re = P.resolveSku(book, "BP-RE-01");
  assert.match(re.priceTextAr, /^يبدأ من 3,000/);
  assert.match(re.statusAr, /حدّ أدنى/);
  for (const lang of ["ar", "en", "bi"]) {
    const html = P.annexHtml(book, { lang });
    const row = new RegExp("BP-HR-03[^]*?</tr>").exec(html)[0];
    assert.match(row, lang === "en" ? /monthly/ : /شهري/, lang + ": دورة BP-HR-03");
    const row2 = new RegExp("BP-RE-01[^]*?</tr>").exec(html)[0];
    assert.match(row2, lang === "en" ? /From|Minimum/ : /يبدأ من|حدّ أدنى/, lang + ": حدّ BP-RE-01");
  }
  assert.match(P.annexHtml(book, { lang: "ar" }), /السعر الشهري يتكرّر كل شهر/);
});

test("٨) ops-quote على بندٍ شهري أو «يبدأ من» بسعر الكتالوج: لا يُعتبر ثابتاً صامتاً — يطلب تأكيداً ثم يكتب النوع في السطر", async () => {
  for (const [code, price, tag] of [["BP-HR-03", 2500, /شهري/], ["BP-RE-02", 800, /حدّ أدنى/]]) {
    const ref = await newRequest([{ code, title: code, qty: 1 }]);
    await call("scope-confirm", { ref });
    const items = [{ code, title: code, qty: 1, price }];
    const no = await call("ops-quote", { ref, items });
    assert.equal(no.status, 400, code);
    assert.equal(no.body.error, "needs_confirmation");
    assert.equal(no.body.lines[0].code, code);
    assert.match(no.body.message, /أكّد/);
    assert.equal((await rowOf(ref)).quote || null, null, "لم يُصدر عرض");
    // بلا اسم الرمز وبسعر الكتالوج: نفس الشيء.
    const bare = await call("ops-quote", { ref, items: [{ code, title: code, qty: 1 }] });
    assert.equal(bare.body.error, "needs_confirmation", code + " بلا سعر مكتوب");
    const yes = await call("ops-quote", { ref, items, confirm_prices: true });
    assert.equal(yes.body.ok, true, JSON.stringify(yes.body));
    noZeroLine(yes.body.quote, code);
    assert.match(yes.body.quote.items[0].description, tag, "نوع السعر مكتوب في السطر");
  }
  // سعرٌ كتبه الإنسان بخلاف الكتالوج قرارٌ منه: لا يُطلب تأكيد.
  const ref2 = await newRequest([{ code: "BP-HR-03", title: "x", qty: 1 }]);
  await call("scope-confirm", { ref: ref2 });
  const own = await call("ops-quote", { ref: ref2, items: [{ code: "BP-HR-03", title: "x", qty: 1, price: 2000 }] });
  assert.equal(own.body.ok, true, JSON.stringify(own.body));
  // والثابت دفعة واحدة لا يطلب شيئاً.
  const ref3 = await newRequest([{ code: "BP-CHAMBER-01", title: "x", qty: 1 }]);
  await call("scope-confirm", { ref: ref3 });
  assert.equal((await call("ops-quote", { ref: ref3, items: [{ code: "BP-CHAMBER-01", title: "x", qty: 1, price: 300 }] })).body.ok, true);
});
