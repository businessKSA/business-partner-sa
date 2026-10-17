// صفحة /checkout و/cart لاشتراك منصة التوظيف (BP-EMP-*): السكربت الحقيقي يُشغَّل على
// DOM مصغَّر مكتوب هنا، وfetch محاكى. المقاس:
//   • السعر يأتي من /api/pay?action=emp-offer لا مما كتبته الصفحة التي أضافت البند،
//     والكمية تُثبَّت على واحد؛
//   • الدفع يتوقف عند غياب اسم المنشأة، ولا يُفتح الصف المعلّق إلا مرة لكل (بريد · منشأة · باقة)،
//     ومرجعه يصير مرجع الطلب؛
//   • تمارا معطّلة للاشتراك الشهري؛
//   • بعد الدفع: «فُعِّل اشتراكك» ورابط إلى /employer، أو «جارٍ التفعيل» إن لم يُفعَّل،
//     وسلةٌ بلا اشتراك لا تستدعي emp-offer أصلاً.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildSimpleCheckout } = await import(pathToFileURL(path.join(ROOT, "site", "scripts", "simple-v1-checkout.mjs")).href);
const { buildSimpleCart } = await import(pathToFileURL(path.join(ROOT, "site", "scripts", "simple-v1-cart.mjs")).href);

const SV1 = { header: () => "", footer: () => "", shell: (o) => o };
const ctx = { lang: () => "ar", esc: (s) => String(s) };
const scriptOf = (page) => String(page.script).replace(/^<script>/, "").replace(/<\/script>$/, "");
const checkoutPage = buildSimpleCheckout(SV1, ctx);
const cartPage = buildSimpleCart(SV1, ctx);
const TXT = (k) => JSON.parse(/var TX=(\{.*?\});\nvar CART/s.exec(checkoutPage.script)[1])[k];

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

// يشغّل سكربت صفحة ويعيد عالمها بعد أن تهدأ الوعود.
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
    documentElement: { getAttribute: () => null },
    head: { appendChild() {} }, addEventListener() {}, dispatchEvent() {},
  };
  const location = { href: url, pathname: new URL(url).pathname, origin: new URL(url).origin };
  const sandbox = {
    document, localStorage: local, sessionStorage: session, location, URL, console,
    history: { replaceState: (_s, _t, u) => { location.href = new URL(u, location.href).href; } },
    Event: class {}, CustomEvent: class {}, addEventListener() {}, dispatchEvent() {}, window: {}, setTimeout, clearTimeout, Promise, JSON, Math, Number, String, Array, Object, Date, encodeURIComponent,
    fetch: async (u, init = {}) => {
      const rec = { url: String(u), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null };
      fetches.push(rec);
      const out = api(rec);
      return { ok: true, json: async () => out };
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(script, sandbox);
  for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r));
  return { els, local, session, fetches, location, document, ways };
}

const OFFER = {
  "BP-EMP-PRO-Y": { ok: true, sku: "BP-EMP-PRO-Y", plan: "pro", billing: "yearly", amountHalalas: 840000, amountSar: 8400, name: { ar: "اشتراك — الاحترافية (سنوي)", en: "Pro yearly" }, bnpl: true },
  "BP-EMP-PRO-M": { ok: true, sku: "BP-EMP-PRO-M", plan: "pro", billing: "monthly", amountHalalas: 100000, amountSar: 1000, name: { ar: "اشتراك — الاحترافية (شهري)", en: "Pro monthly" }, bnpl: false },
};
const MOCKCFG = { enabled: true, mock: true, provider: "local-mock", formUrl: "/api/pay?action=mock-form", bnpl: { tamara: true } };
function api(extra = {}) {
  return (rec) => {
    const u = new URL(rec.url, "https://x.test");
    if (u.pathname === "/api/otp") return {};
    if (u.searchParams.get("action") === "emp-offer") return OFFER[u.searchParams.get("sku").toUpperCase()] || { ok: false, error: "quote_only" };
    if (rec.method === "POST" && rec.body && rec.body.action === "emp-prepare") return extra.prepare ? extra.prepare(rec) : { ok: true, reference: "BP-EMPSUB-AAAAAAAAAAAA" };
    if (rec.method === "POST" && !rec.body.action) return extra.verify ? extra.verify(rec) : { ok: true };
    if (rec.method === "GET") return MOCKCFG;
    return {};
  };
}
const staleCart = (id) => [{ id, nameAr: "اشتراك", nameEn: "Plan", amount: 1, price: "1 ر.س", qty: 3, kind: "employer-plan", pricePublic: true }];
const fill = (w, co = "") => { w.document.getElementById("coName").value = "Ali"; w.document.getElementById("coPhone").value = "0500000000"; w.document.getElementById("coEmail").value = "HR@Acme.test"; w.document.getElementById("coCo").value = co; };
const mockPayBtn = (w) => w.document.getElementById("coPayMount").children.find((c) => c.id === "coMockPay") || w.document.getElementById("coPayMount").children.find((c) => c.tag === "button");
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

test("checkout: the cart's own amount and quantity are replaced by the server's offer", async () => {
  const w = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-PRO-Y"), api: api() });
  assert.ok(w.fetches.some((f) => f.url.includes("action=emp-offer") && f.url.includes("BP-EMP-PRO-Y")));
  assert.match(w.document.getElementById("coNet").textContent, /8,400\.00/);
  assert.match(w.document.getElementById("coVat").textContent, /1,260\.00/);
  assert.match(w.document.getElementById("coTotal").textContent, /9,660\.00/);
  const saved = JSON.parse(w.local.getItem("bp_cart"));
  assert.equal(saved[0].amount, 8400); assert.equal(saved[0].qty, 1);
});

test("checkout: no company → stops with the reason; with one → opens the pending row once and its reference becomes the order's", async () => {
  const w = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-PRO-Y"), api: api() });
  const btn = mockPayBtn(w), note = w.document.getElementById("coPayMount").children.find((c) => c.className === "sv1-co-fine");
  fill(w, "");
  btn.onclick(); await settle();
  assert.equal(note.textContent, TXT("needCo"));
  assert.equal(w.fetches.filter((f) => f.body && f.body.action === "emp-prepare").length, 0, "nothing opened without a company");
  assert.equal(w.location.href.includes("mock-form"), false);

  fill(w, "Acme");
  btn.onclick(); await settle();
  const prep = w.fetches.filter((f) => f.body && f.body.action === "emp-prepare");
  assert.equal(prep.length, 1);
  assert.deepEqual(prep[0].body, { action: "emp-prepare", sku: "BP-EMP-PRO-Y", email: "hr@acme.test", company: "Acme" });
  assert.equal(JSON.parse(w.session.getItem("bp_pay_order")).ref, "BP-EMPSUB-AAAAAAAAAAAA");
  assert.match(w.location.href, /^\/api\/pay\?action=mock-form&back=.*&amount=9660&/);

  // الضغط ثانيةً بالبيانات نفسها لا يفتح صفاً ثانياً.
  btn.disabled = false; btn.onclick(); await settle();
  assert.equal(w.fetches.filter((f) => f.body && f.body.action === "emp-prepare").length, 1);
});

test("checkout: a refused pending row blocks the payment with a clear message", async () => {
  const w = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-PRO-Y"), api: api({ prepare: () => ({ ok: false, error: "pending_failed" }) }) });
  const btn = mockPayBtn(w), note = w.document.getElementById("coPayMount").children.find((c) => c.className === "sv1-co-fine");
  fill(w, "Acme"); btn.onclick(); await settle();
  assert.equal(note.textContent, TXT("empFail"));
  assert.equal(w.location.href.includes("mock-form"), false, "no money moves");
  assert.equal(btn.disabled, false, "the buyer can retry");
});

test("checkout: not signed in / another e-mail → the buyer is told why, and no money moves", async () => {
  for (const [error, key] of [["not_signed_in", "empSignIn"], ["email_mismatch", "empMail"]]) {
    const w = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-PRO-Y"), api: api({ prepare: () => ({ ok: false, error }) }) });
    const btn = mockPayBtn(w), note = w.document.getElementById("coPayMount").children.find((c) => c.className === "sv1-co-fine");
    fill(w, "Acme"); btn.onclick(); await settle();
    assert.equal(note.textContent, TXT(key));
    assert.equal(w.location.href.includes("mock-form"), false);
  }
});

test("checkout: Tamara is disabled for a monthly plan and open for a yearly one", async () => {
  const m = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-PRO-M"), api: api() });
  const tw = m.document.getElementById("coWayTamara");
  assert.equal(tw.disabled, true);
  assert.equal(m.document.getElementById("coTamaraNote").textContent, TXT("tamaraYr"));
  const y = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-PRO-Y"), api: api() });
  assert.equal(y.document.getElementById("coWayTamara").disabled, false);
});

test("checkout: enterprise has no price here — it is quoted, and the form is blocked", async () => {
  const w = await boot(scriptOf(checkoutPage), { cart: staleCart("BP-EMP-ENTERPRISE-Y"), api: api() });
  assert.equal(w.document.getElementById("coTotal").textContent, TXT("quoted"));
  assert.equal(w.document.getElementById("coPayMount").children.some((c) => c.id === "coMockPay"), false);
  assert.equal(w.fetches.some((f) => f.body && f.body.action === "emp-prepare"), false);
});

test("checkout: two plans in one cart cannot be paid", async () => {
  const cart = [...staleCart("BP-EMP-PRO-Y"), ...staleCart("BP-EMP-PRO-M")];
  const w = await boot(scriptOf(checkoutPage), { cart, api: api() });
  assert.equal(w.document.getElementById("coPayMount").children.some((c) => c.id === "coMockPay"), false);
  assert.equal(w.document.getElementById("coPayMount").children[0].textContent, TXT("onePlan"));
});

test("return from the gateway: an activated subscription says so and links to /employer", async () => {
  const snap = { ref: "BP-EMPSUB-AAAAAAAAAAAA", email: "hr@acme.test", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] };
  const w = await boot(scriptOf(checkoutPage), {
    cart: staleCart("BP-EMP-PRO-Y"), snap, url: "https://x.test/ar/checkout?id=mock_card_a1b2c3d4e5f6&payment=paid&provider=card&amount=9660",
    api: api({ verify: () => ({ ok: true, employer: { activated: true }, invoice: { invoiced: true, number: "INV-7" } }) }),
  });
  const verify = w.fetches.find((f) => f.method === "POST" && f.body && f.body.id === "mock_card_a1b2c3d4e5f6");
  assert.ok(verify, "the standard verification call is made");
  assert.deepEqual(verify.body.order.items, [{ id: "BP-EMP-PRO-Y", qty: 1 }]);
  const box = w.document.getElementById("coResult");
  assert.equal(box.className, "sv1-co-result ok");
  assert.equal(box.children[0].textContent, TXT("empDone"));
  const link = box.children.find((c) => c.tag === "a");
  assert.equal(link.href, "/ar/employer");
  assert.equal(link.textContent, TXT("toEmployer"));
  assert.equal(w.local.getItem("bp_cart"), null, "the cart is emptied");
});

test("return from the gateway: paid but not activated says it is being activated and not to pay twice", async () => {
  const snap = { ref: "BP-EMPSUB-AAAAAAAAAAAA", email: "hr@acme.test", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] };
  const w = await boot(scriptOf(checkoutPage), {
    cart: staleCart("BP-EMP-PRO-Y"), snap, url: "https://x.test/ar/checkout?id=mock_card_a1b2c3d4e5f6&payment=paid&provider=card",
    api: api({ verify: () => ({ ok: true, employer: { activated: false } }) }),
  });
  const box = w.document.getElementById("coResult");
  assert.equal(box.className, "sv1-co-result warn");
  assert.equal(box.children[0].textContent, TXT("empHold"));
  assert.equal(box.children.some((c) => c.tag === "a"), false);
});

test("an ordinary cart is untouched: no offer lookup, the normal success message", async () => {
  const cart = [{ id: "svc-bp-absher-01", nameAr: "أبشر", amount: 300, price: "300 ر.س", qty: 2, pricePublic: true }];
  const w = await boot(scriptOf(checkoutPage), { cart, api: api() });
  assert.equal(w.fetches.some((f) => f.url.includes("emp-offer")), false);
  assert.match(w.document.getElementById("coNet").textContent, /600\.00/);

  const snap = { ref: "BP-100200", items: [{ id: "svc-bp-absher-01", qty: 2 }] };
  const r = await boot(scriptOf(checkoutPage), {
    cart, snap, url: "https://x.test/ar/checkout?id=mock_card_a1b2c3d4e5f6&payment=paid",
    api: api({ verify: () => ({ ok: true, amount: 69000, invoice: { invoiced: true, number: "INV-8" }, settle: { ok: true, verified: true, ref: "BP-100200", request: { ok: true, ref: "BP-R-A1B2C3", created: true, documents: 2 } } }) }),
  });
  const res = r.document.getElementById("coResult");
  assert.equal(res.children[0].textContent, TXT("okDone"));
  // the numbers the buyer keeps: order, amount, invoice — each from the server's answer
  const rows = res.children.find((c) => c.className === "sv1-co-rows").children.map((d) => [d.children[0].textContent, d.children[1].textContent]);
  assert.deepEqual(rows.map((x) => x[0]), [TXT("lblReq"), TXT("lblOrder"), TXT("lblPay"), TXT("lblAmt"), TXT("lblInv")]);
  assert.equal(rows[0][1], "BP-R-A1B2C3"); assert.equal(rows[1][1], "BP-100200"); assert.equal(rows[2][1], "mock_card_a1b2c3d4e5f6"); assert.match(rows[3][1], /690\.00/); assert.equal(rows[4][1], "INV-8");
  // the request the server opened is linked, and the buyer is told to upload the documents it asked for
  const link = res.children.find((c) => c.tag === "a");
  assert.equal(link.href, "/ar/my?ref=BP-R-A1B2C3");
  assert.equal(link.textContent, TXT("openReq"));
  assert.ok(res.children.some((c) => (c.textContent || "").startsWith(TXT("nextReqDocs"))));
});

test("after payment: paid and registered but the request could not be opened keeps the honest hold (no number, no link)", async () => {
  const cart = [{ id: "svc-bp-absher-01", nameAr: "أبشر", amount: 300, price: "", qty: 1, pricePublic: true }];
  const snap = { ref: "BP-700800", items: [{ id: "svc-bp-absher-01", qty: 1 }] };
  const r = await boot(scriptOf(checkoutPage), {
    cart, snap, url: "https://x.test/ar/checkout?id=mock_card_a1b2c3d4e5f6&payment=paid",
    api: api({ verify: () => ({ ok: true, amount: 34500, settle: { ok: true, verified: true, ref: "BP-700800", request: { ok: false, error: "create_failed" } } }) }),
  });
  const res = r.document.getElementById("coResult");
  assert.equal(res.className, "sv1-co-result warn");
  assert.equal(res.children[0].textContent, TXT("paidHold"));
  assert.equal(res.children.some((c) => c.tag === "a"), false);
  const rows = res.children.find((c) => c.className === "sv1-co-rows").children.map((d) => d.children[0].textContent);
  assert.ok(!rows.includes(TXT("lblReq")));
});

test("after payment: a payment the server could not match is said to be under review, not 'done'", async () => {
  const cart = [{ id: "pkg-starter-4-yearly", nameAr: "باقة", amount: 21000, price: "", qty: 1, pricePublic: true }];
  const snap = { ref: "BP-300400", items: [{ id: "pkg-starter-4-yearly", qty: 1 }] };
  const r = await boot(scriptOf(checkoutPage), {
    cart, snap, url: "https://x.test/ar/checkout?id=mock_card_a1b2c3d4e5f6&payment=paid",
    api: api({ verify: () => ({ ok: true, amount: 2415000, invoice: { invoiced: false, reason: "amount_mismatch" }, settle: { ok: true, verified: false, ref: "BP-300400", request: { ok: true, ref: "BP-R-D4E5F6", created: true, documents: 0 } } }) }),
  });
  const res = r.document.getElementById("coResult");
  assert.equal(res.className, "sv1-co-result warn");
  assert.equal(res.children[0].textContent, TXT("reviewT"));
  assert.ok(!res.children.some((c) => c.textContent === TXT("okDone")));
  assert.equal(res.children.find((c) => c.tag === "a").href, "/ar/my?ref=BP-R-D4E5F6", "the request under review is the one opened");
});

test("after payment: money taken but registration incomplete says so and never claims it is done", async () => {
  const cart = [{ id: "svc-bp-absher-01", nameAr: "أبشر", amount: 300, price: "", qty: 1, pricePublic: true }];
  const snap = { ref: "BP-500600", items: [{ id: "svc-bp-absher-01", qty: 1 }] };
  const r = await boot(scriptOf(checkoutPage), {
    cart, snap, url: "https://x.test/ar/checkout?id=mock_card_a1b2c3d4e5f6&payment=paid",
    api: api({ verify: () => ({ ok: true, amount: 34500, settle: { ok: false, verified: false } }) }),
  });
  const res = r.document.getElementById("coResult");
  assert.equal(res.className, "sv1-co-result warn");
  assert.equal(res.children[0].textContent, TXT("paidHold"));
});

test("cart: the subscription line has no quantity buttons and is corrected to the server's price", async () => {
  const w = await boot(scriptOf(cartPage), { cart: staleCart("BP-EMP-PRO-Y"), url: "https://x.test/ar/cart", api: api() });
  const saved = JSON.parse(w.local.getItem("bp_cart"));
  assert.equal(saved[0].amount, 8400); assert.equal(saved[0].qty, 1);
  const rows = w.document.getElementById("cartItems").children;
  assert.ok(rows.length >= 1);
  const row = rows[rows.length - 1];
  const qty = row.children.find((c) => c.className === "sv1-qty");
  assert.equal(qty.children.length, 0, "no −/+ for a subscription");
});
