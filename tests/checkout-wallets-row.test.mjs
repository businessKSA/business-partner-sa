// صفّ المحافظ في /checkout (طلب المالك 2026-10-11: «ما في Apple Pay ولا Samsung Pay»).
//
// السبب كان أن الزرّ لا يُرسم إلا على جهازٍ جاهز، فمن فتح الصفحة من كروم أو أندرويد ظنّ
// أن الميزة غير موجودة. الآن الأسماء الثلاثة ظاهرة دائماً وبحالة صادقة:
//   ready = مفعّلة عندنا والجهاز جاهز · dev = مفعّلة والجهاز لا يدعمها · soon = غير مفعّلة بعد.
// ولا يكسر ذلك مسار البطاقة ولا تمارا ولا البوابة المحلية.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildSimpleCheckout } = await import(pathToFileURL(path.join(ROOT, "site", "scripts", "simple-v1-checkout.mjs")).href);

const SV1 = { header: () => "", footer: () => "", shell: (o) => o };
const mkCtx = (lang) => ({ lang: () => lang, esc: (s) => String(s) });
const scriptOf = (page) => String(page.script).replace(/^<script>/, "").replace(/<\/script>$/, "");
const LANGS = ["ar", "en", "fr", "zh"];
const SOON = { ar: "قريباً", en: "Coming soon", fr: "Bientôt", zh: "即将推出" };
const READY = { ar: "جاهز", en: "Ready", fr: "Prêt", zh: "可用" };
const DEV = { ar: "على الأجهزة المدعومة", en: "On supported devices", fr: "Appareils compatibles", zh: "支持的设备" };

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

const PRICED = [{ id: "svc-bp-sbc-31", nameAr: "خدمة", nameEn: "Svc", amount: 1000, price: "", qty: 1, kind: "service", pricePublic: 1 }];
const LIVE = { enabled: true, provider: "moyasar", publishableKey: "pk_test_unit", scriptUrl: "https://cdn.test/moyasar.js", cssUrl: null,
  currency: "SAR", methods: ["creditcard"], applePay: null, samsungPay: null, googlePay: null, bnpl: { tamara: true } };
const APPLE = { country: "SA", label: "Business Partner", validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate" };
const SAMSUNG = { service_id: "svc_unit", country: "SA", label: "Business Partner", environment: "PRODUCTION" };
const GOOGLE = { merchant_id: "BCR2DN_unit", country: "SA", label: "Business Partner", environment: "PRODUCTION" };

// device: { apple: bool, samsung: bool|"blocked", google: bool|"blocked" } — ما تقوله الأجهزة عن نفسها.
async function boot(lang, { cart = PRICED, cfg, device = {}, prices = true }) {
  const els = new Map();
  const store = (init) => { const m = new Map(Object.entries(init || {})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const ways = ["card", "tamara"].map((w) => { const e = makeEl("way-" + w); e.attrs["data-way"] = w; e.classes.add("sv1-co-way"); return e; });
  const inits = [];
  const sandbox = {
    localStorage: store({ bp_cart: JSON.stringify(cart) }), sessionStorage: store({}),
    location: { href: `https://x.test/${lang}/checkout`, pathname: `/${lang}/checkout`, origin: "https://x.test" },
    URL, console, Event: class {}, CustomEvent: class {}, addEventListener() {}, dispatchEvent() {},
    history: { replaceState() {} },
    setTimeout: (f, ms) => { const t = setTimeout(f, ms); t.unref(); return t; }, clearTimeout,
    Promise, JSON, Math, Number, String, Array, Object, Date, RegExp, encodeURIComponent,
    fetch: async (u, init = {}) => ({ ok: true, json: async () => ((init.method || "GET") === "GET" ? cfg : {}) }),
  };
  sandbox.window = sandbox;
  if ("apple" in device) sandbox.ApplePaySession = { canMakePayments: () => !!device.apple };
  const sdk = {
    samsung: () => { sandbox.SamsungPay = { PaymentClient: class { isReadyToPay() { return Promise.resolve({ result: device.samsung === true }); } } }; },
    google: () => { sandbox.google = { payments: { api: { PaymentsClient: class { isReadyToPay() { return Promise.resolve({ result: device.google === true }); } } } } }; },
  };
  sandbox.document = {
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    createElement: (tag) => { const e = makeEl(tag); e.tag = tag; return e; },
    querySelectorAll: (sel) => (sel === ".sv1-co-way" ? ways : []),
    documentElement: { getAttribute: () => (prices ? "on" : null), setAttribute() {} },
    head: {
      appendChild(el) {
        if (!el.src) return;
        queueMicrotask(() => {
          if (el.src === LIVE.scriptUrl) { sandbox.Moyasar = { init: (o) => inits.push(o) }; el.onload && el.onload(); }
          else if (/samsungpay/.test(el.src)) { if (device.samsung === "blocked") el.onerror && el.onerror(); else { sdk.samsung(); el.onload && el.onload(); } }
          else if (/pay\.google\.com/.test(el.src)) { if (device.google === "blocked") el.onerror && el.onerror(); else { sdk.google(); el.onload && el.onload(); } }
        });
      },
    },
    addEventListener() {}, dispatchEvent() {},
  };
  vm.runInNewContext(scriptOf(buildSimpleCheckout(SV1, mkCtx(lang))), sandbox);
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
  const g = (id) => sandbox.document.getElementById(id);
  const wallet = (k) => ({ st: g(`coW-${k}`).getAttribute("data-st"), pill: g(`coW-${k}-pill`).textContent, why: g(`coW-${k}-why`).textContent });
  return { g, wallet, inits, sandbox, ways };
}

// ---------- الصفحة نفسها: الصفّ موجود في الـHTML بلا سكربت

test("the three wallets are in the page markup in every language, as non-clickable list items", () => {
  const heading = { ar: "المحافظ الرقمية", en: "Digital wallets", fr: "Portefeuilles numériques", zh: "数字钱包" };
  for (const lang of LANGS) {
    const body = String(buildSimpleCheckout(SV1, mkCtx(lang)).body);
    const row = body.match(/<div class="sv1-co-wallets"[\s\S]*?<\/ul>/);
    assert.ok(row, `${lang}: wallet row present`);
    for (const n of ["Apple Pay", "Samsung Pay", "Google Pay"]) assert.ok(row[0].includes(n), `${lang}: ${n}`);
    assert.ok(row[0].includes(heading[lang]), `${lang}: heading`);
    assert.equal((row[0].match(/<li /g) || []).length, 3, `${lang}: three items`);
    assert.doesNotMatch(row[0], /<(button|a)[\s>]/, `${lang}: nothing in the row is a button or a link — no dead button`);
    assert.doesNotMatch(row[0], /onclick/i);
  }
});

test("the row does not displace the card or Tamara paths", () => {
  for (const lang of LANGS) {
    const body = String(buildSimpleCheckout(SV1, mkCtx(lang)).body);
    for (const frag of ['data-way="card"', 'data-way="tamara"', 'id="coPayMount"', 'id="coTamaraGo"', 'id="coPaneTamara"', 'id="coWayCardLabel"'])
      assert.ok(body.includes(frag), `${lang}: ${frag}`);
    assert.ok(body.indexOf('id="coWallets"') < body.indexOf('id="coPayMount"'), `${lang}: wallets sit above the payment mount`);
    assert.ok(body.indexOf('id="coWallets"') > body.indexOf('id="coPaneCard"'), `${lang}: wallets live in the card pane`);
  }
});

test("built pages carry the row in all four languages", () => {
  for (const f of ["checkout.html", "ar/checkout.html", "fr/checkout.html", "zh/checkout.html"]) {
    const p = path.join(ROOT, "site", f);
    assert.ok(fs.existsSync(p), f);
    const html = fs.readFileSync(p, "utf8");
    assert.match(html, /id="coWallets"/, f);
    for (const k of ["apple", "samsung", "google"]) assert.match(html, new RegExp(`id="coW-${k}"`), `${f} ${k}`);
    assert.match(html, /id="coPayMount"/, f);
  }
});

// ---------- الحالات الثلاث

test("production today: card + Apple Pay on, Samsung/Google not configured — Chrome desktop shows Apple as device-gated, others soon", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: {} });
  assert.deepEqual(w.wallet("apple"), { st: "dev", pill: DEV.ar, why: "يظهر زرّها تلقائياً على الأجهزة المدعومة (Safari على آبل)." });
  assert.equal(w.wallet("samsung").st, "soon");
  assert.equal(w.wallet("samsung").pill, SOON.ar);
  assert.equal(w.wallet("google").st, "soon");
  // مسار البطاقة سليم: النموذج رُكّب بالبطاقة وحدها، ولا apple_pay على جهازٍ لا يدعمها.
  assert.equal(w.inits.length, 1);
  assert.deepEqual(w.inits[0].methods, ["creditcard"]);
  assert.equal(w.inits[0].apple_pay, undefined);
  assert.equal(w.inits[0].samsung_pay, undefined);
  assert.equal(w.inits[0].google_pay, undefined);
  assert.equal(w.inits[0].amount, 115000);
  assert.equal(w.g("coWayCardLabel").textContent, "بطاقة");
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), false);
});

test("production today on Safari with a wallet: Apple Pay is ready and works as before", async () => {
  const w = await boot("en", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: true } });
  assert.equal(w.wallet("apple").st, "ready");
  assert.equal(w.wallet("apple").pill, READY.en);
  assert.deepEqual(w.inits[0].methods, ["creditcard", "applepay"]);
  assert.deepEqual(w.inits[0].apple_pay, APPLE);
  assert.equal(w.g("coWayCardLabel").textContent, "Card · Apple Pay");
});

test("Safari without a wallet configured on the device: Apple stays device-gated, never ready", async () => {
  const w = await boot("en", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: false } });
  assert.equal(w.wallet("apple").st, "dev");
  assert.equal(w.inits[0].apple_pay, undefined);
});

test("everything configured and every device ready: three ready wallets, three objects handed to the form", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay", "samsungpay", "googlepay"], applePay: APPLE, samsungPay: SAMSUNG, googlePay: GOOGLE };
  const w = await boot("ar", { cfg, device: { apple: true, samsung: true, google: true } });
  for (const k of ["apple", "samsung", "google"]) {
    assert.equal(w.wallet(k).st, "ready", k);
    assert.equal(w.wallet(k).pill, READY.ar);
    assert.equal(w.wallet(k).why, "اختر زرّها في نموذج الدفع أدناه.");
  }
  const o = w.inits[0];
  assert.deepEqual(o.methods.sort(), ["applepay", "creditcard", "googlepay", "samsungpay"]);
  assert.equal(o.samsung_pay.service_id, "svc_unit");
  assert.equal(o.google_pay.merchant_id, "BCR2DN_unit");
  assert.equal(w.g("coWayCardLabel").textContent, "بطاقة · Apple Pay · Google Pay · Samsung Pay");
});

test("everything configured but the device is not ready (or the SDK is blocked): all three device-gated, form falls back to card", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay", "samsungpay", "googlepay"], applePay: APPLE, samsungPay: SAMSUNG, googlePay: GOOGLE };
  for (const device of [{ apple: false, samsung: false, google: false }, { samsung: "blocked", google: "blocked" }]) {
    const w = await boot("fr", { cfg, device });
    for (const k of ["apple", "samsung", "google"]) {
      assert.equal(w.wallet(k).st, "dev", k);
      assert.equal(w.wallet(k).pill, DEV.fr);
      assert.match(w.wallet(k).why, /Son bouton apparaît automatiquement sur les appareils compatibles/);
    }
    assert.deepEqual(w.inits[0].methods, ["creditcard"]);
  }
});

test("each device-gated wallet names its own device", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay", "samsungpay", "googlepay"], applePay: APPLE, samsungPay: SAMSUNG, googlePay: GOOGLE };
  const w = await boot("ar", { cfg, device: { apple: false, samsung: false, google: false } });
  assert.match(w.wallet("apple").why, /Safari على آبل/);
  assert.match(w.wallet("samsung").why, /جوالات سامسونج/);
  assert.match(w.wallet("google").why, /كروم على أندرويد/);
});

test("a mix: Google ready, Samsung device-gated, Apple not configured", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "samsungpay", "googlepay"], samsungPay: SAMSUNG, googlePay: GOOGLE };
  const w = await boot("ar", { cfg, device: { samsung: false, google: true } });
  assert.equal(w.wallet("apple").st, "soon");
  assert.equal(w.wallet("samsung").st, "dev");
  assert.equal(w.wallet("google").st, "ready");
  assert.deepEqual(w.inits[0].methods.sort(), ["creditcard", "googlepay"]);
});

test("soon and ready labels are localised in all four languages", async () => {
  for (const lang of LANGS) {
    const soon = await boot(lang, { cfg: LIVE });
    assert.equal(soon.wallet("apple").st, "soon");
    assert.equal(soon.wallet("apple").pill, SOON[lang], lang);
    assert.ok(soon.wallet("apple").why.length > 10, lang);
    const ok = await boot(lang, { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: true } });
    assert.equal(ok.wallet("apple").pill, READY[lang], lang);
  }
});

test("a state is never reported in English on the Arabic page, nor Arabic on the English one", async () => {
  const ar = await boot("ar", { cfg: LIVE });
  assert.doesNotMatch(ar.wallet("google").why + ar.wallet("google").pill, /[A-Za-z]{4,}/);
  const en = await boot("en", { cfg: LIVE });
  assert.doesNotMatch(en.wallet("google").why + en.wallet("google").pill, /[؀-ۿ]/);
});

// ---------- لا وعد حيث لا نموذج دفع

test("local mock gateway: wallets read soon, the mock pay button is still drawn", async () => {
  const cfg = { enabled: true, mock: true, provider: "local-mock", formUrl: "/api/pay?action=mock-form", methods: ["creditcard"], applePay: null, samsungPay: null, googlePay: null, bnpl: { tamara: true } };
  const w = await boot("ar", { cfg });
  for (const k of ["apple", "samsung", "google"]) assert.equal(w.wallet(k).st, "soon", k);
  assert.ok(w.g("coPayMount").children.some((c) => c.id === "coMockPay"));
});

test("gateway down: the row is hidden, not left claiming wallets", async () => {
  const w = await boot("ar", { cfg: { enabled: false } });
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), true);
  assert.equal(w.inits.length, 0);
});

test("empty cart: the row is hidden", async () => {
  const w = await boot("ar", { cart: [], cfg: LIVE });
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), true);
});

test("guest on a priced item (sign-in required): the row is hidden, not left claiming wallets", async () => {
  const hiddenPrice = [{ id: "svc-x", nameAr: "خدمة", nameEn: "Svc", amount: 500, price: "", qty: 1, kind: "service" }];
  const w = await boot("ar", { cart: hiddenPrice, cfg: LIVE, prices: false });
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), true);
  assert.equal(w.inits.length, 0);
});

// ---------- تمارا والبطاقة لم تتأثرا

test("Tamara pane keeps working next to the row", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: {} });
  assert.equal(typeof w.g("coTamaraGo").onclick, "function");
  assert.equal(w.g("coWayTamara").disabled, false);
  assert.equal(typeof w.ways[0].onclick, "function");
});

// ---------- لغة نموذج مُيسّر: يعرف العربية والإنجليزية وحدهما (على /fr و/zh كان يرسم «Something went wrong»)

test("the Moyasar form is always given a language it supports", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE };
  const want = { ar: "ar", en: "en", fr: "en", zh: "en" };
  for (const lang of LANGS) {
    const w = await boot(lang, { cfg });
    assert.equal(w.inits[0].language, want[lang], lang);
  }
});
