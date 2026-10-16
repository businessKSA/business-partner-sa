// إصلاحات السلة والدفع (تدقيق 2026-10-11): السكربتان الحقيقيان على DOM مصغَّر.
//   ① عودة من بوابة فشلت/أُلغيت: ما كتبه العميل (الجوال والمنشأة) يرجع إلى الحقول.
//   ② بند غير مسعّر: صفحة الدفع تردّ العميل إلى السلة (لا «سجّل دخولك»)، والسلة تُغلق زرّ المتابعة.
//   ③ بريد ناقص («a@b») لا يمرّ إلى البوابة — وإلا دُفعت الفاتورة بلا بريد تُرسَل إليه.
//   ④ وصف عملية مُيسّر يحمل مرجع الطلب.
//   ⑤ نصّ الضريبة في السلة بالفرنسية/الصينية ليس الإنجليزي المخزَّن.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildSimpleCheckout } = await import(pathToFileURL(path.join(ROOT, "site", "scripts", "simple-v1-checkout.mjs")).href);
const { buildSimpleCart } = await import(pathToFileURL(path.join(ROOT, "site", "scripts", "simple-v1-cart.mjs")).href);

const SV1 = { header: () => "", footer: () => "", shell: (o) => o };
const mkCtx = (lang) => ({ lang: () => lang, esc: (s) => String(s) });
const scriptOf = (page) => String(page.script).replace(/^<script>/, "").replace(/<\/script>$/, "");

function makeEl(id) {
  const el = {
    id, children: [], style: {}, attrs: {}, value: "", _t: "", className: "", disabled: false, onclick: null, href: "",
    classes: new Set(),
    classList: { toggle(c, on) { (on === undefined ? !el.classes.has(c) : on) ? el.classes.add(c) : el.classes.delete(c); }, add(c) { el.classes.add(c); }, remove(c) { el.classes.delete(c); }, contains: (c) => el.classes.has(c) },
    appendChild(c) { el.children.push(c); return c; },
    setAttribute(k, v) { el.attrs[k] = v; }, getAttribute: (k) => (k in el.attrs ? el.attrs[k] : null), removeAttribute(k) { delete el.attrs[k]; },
    querySelector: () => null, scrollIntoView() {},
    set innerHTML(v) { el.children = []; el._html = v; }, get innerHTML() { return el._html || ""; },
    set textContent(v) { el._t = String(v); el.children = []; }, get textContent() { return el._t; },
  };
  return el;
}

async function boot(script, { cart, snap, url = "https://x.test/ar/checkout", api }) {
  const els = new Map();
  const store = (init) => { const m = new Map(Object.entries(init || {})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  const local = store(cart ? { bp_cart: JSON.stringify(cart) } : {});
  const session = store(snap ? { bp_pay_order: JSON.stringify(snap) } : {});
  const fetches = [];
  const ways = ["card", "tamara"].map((w) => { const e = makeEl("way-" + w); e.attrs["data-way"] = w; e.classes.add("sv1-co-way"); return e; });
  const document = {
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    createElement: (tag) => { const e = makeEl(tag); e.tag = tag; return e; },
    querySelectorAll: (sel) => (sel === ".sv1-co-way" ? ways : []),
    documentElement: { getAttribute: () => "on" },
    head: { appendChild() {} }, addEventListener() {}, dispatchEvent() {},
  };
  const location = { href: url, pathname: new URL(url).pathname, origin: new URL(url).origin };
  const sandbox = {
    document, localStorage: local, sessionStorage: session, location, URL, console,
    history: { replaceState: (_s, _t, u) => { location.href = new URL(u, location.href).href; } },
    Event: class {}, CustomEvent: class {}, addEventListener() {}, dispatchEvent() {}, window: {}, setTimeout, clearTimeout, Promise, JSON, Math, Number, String, Array, Object, Date, RegExp, encodeURIComponent,
    fetch: async (u, init = {}) => {
      const rec = { url: String(u), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null };
      fetches.push(rec);
      return { ok: true, json: async () => api(rec) };
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(script, sandbox);
  for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r));
  return { els, local, session, fetches, location, document };
}

const MOCKCFG = { enabled: true, mock: true, provider: "local-mock", formUrl: "/api/pay?action=mock-form", bnpl: { tamara: true } };
const api = () => (rec) => (rec.method === "GET" ? MOCKCFG : {});
const priced = [{ id: "svc-bp-sbc-31", nameAr: "خدمة", nameEn: "Svc", amount: 1000, price: "", qty: 1, kind: "service", pricePublic: 1 }];
const unpriced = [{ id: "svc-x", nameAr: "بلا سعر", nameEn: "No price", amount: 0, price: "", qty: 1, kind: "service" }];
const mockBtn = (w) => w.document.getElementById("coPayMount").children.find((c) => c.id === "coMockPay");
const fieldsFill = (w, o) => { for (const [k, v] of Object.entries(o)) w.document.getElementById(k).value = v; };

test("checkout: after a failed or cancelled gateway the typed phone and company come back", async () => {
  const snap = { ref: "BP-123456", name: "Ali", email: "ali@acme.test", phone: "0555555555", company: "Acme", items: [{ id: "svc-bp-sbc-31", qty: 1 }] };
  const w = await boot(scriptOf(buildSimpleCheckout(SV1, mkCtx("ar"))), { cart: priced, snap, url: "https://x.test/ar/checkout?id=mock_abcdefghij&status=failed", api: api() });
  assert.equal(w.document.getElementById("coPhone").value, "0555555555");
  assert.equal(w.document.getElementById("coCo").value, "Acme");
  assert.equal(w.document.getElementById("coName").value, "Ali");
  assert.equal(w.document.getElementById("coEmail").value, "ali@acme.test");
});

test("checkout: a first visit with no snapshot leaves the fields empty", async () => {
  const w = await boot(scriptOf(buildSimpleCheckout(SV1, mkCtx("ar"))), { cart: priced, api: api() });
  assert.equal(w.document.getElementById("coPhone").value, "");
});

test("checkout: an unpriced item sends the buyer back to the cart, not to sign-in", async () => {
  const w = await boot(scriptOf(buildSimpleCheckout(SV1, mkCtx("ar"))), { cart: unpriced, api: api() });
  const link = w.document.getElementById("coPayMount").children.find((c) => c.href);
  assert.equal(link.href, "/ar/cart");
  const msg = w.document.getElementById("coPayMount").children[0].textContent;
  assert.doesNotMatch(msg, /سنرسل لك/, "no promise of a quotation that nothing sends");
});

test("checkout: a half-typed e-mail does not reach the gateway", async () => {
  const w = await boot(scriptOf(buildSimpleCheckout(SV1, mkCtx("ar"))), { cart: priced, api: api() });
  const btn = mockBtn(w);
  fieldsFill(w, { coName: "Ali", coPhone: "0500000000", coEmail: "ali@acme" });
  btn.onclick();
  assert.equal(w.location.href.includes("mock-form"), false);
  fieldsFill(w, { coEmail: "ali@acme.test" });
  btn.onclick();
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.match(w.location.href, /mock-form/);
});

test("checkout: the Moyasar description carries the order reference", () => {
  assert.match(String(buildSimpleCheckout(SV1, mkCtx("ar")).script), /description:'Business Partner order '\+m\.ref/);
});

test("cart: an unpriced item closes the continue button; a priced basket opens it", async () => {
  const page = scriptOf(buildSimpleCart(SV1, mkCtx("ar")));
  const a = await boot(page, { cart: unpriced, url: "https://x.test/ar/cart", api: api() });
  assert.equal(a.document.getElementById("cartGo").getAttribute("aria-disabled"), "true");
  assert.match(a.document.getElementById("cartHint").textContent, /احذفها/);
  const b = await boot(page, { cart: priced, url: "https://x.test/ar/cart", api: api() });
  assert.equal(b.document.getElementById("cartGo").getAttribute("aria-disabled"), null);
});

test("cart: the VAT note is not English on the French and Chinese pages", () => {
  for (const lang of ["fr", "zh"]) {
    const html = String(buildSimpleCart(SV1, mkCtx(lang)).body);
    assert.doesNotMatch(html, /Displayed prices are Business Partner fees/, lang);
  }
  assert.match(String(buildSimpleCart(SV1, mkCtx("en")).body), /Displayed prices are Business Partner fees/);
});
