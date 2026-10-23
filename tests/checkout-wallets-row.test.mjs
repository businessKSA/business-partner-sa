// طرق الدفع في /checkout: المحافظ (Apple Pay · Samsung Pay · Google Pay) بحالةٍ صادقة، والحوالة البنكية مع الإيصال.
//
// شكوى المالك 2026-10-23: «Apple Pay وSamsung Pay غير فعّالة في الموقع… فقط كارت وإضافة بطاقة وتمارا.
// وكمان ما في تحويل، المفروض يكون في تحويل وإرفاق للإيصال». قبلها (2026-10-11): «ما في Apple Pay ولا Samsung Pay».
//
// السبب كان ثلاثة أشياء مختلطة: (أ) المحفظة لا تصل إلى النموذج إلا إن ذُكرت في إعداد البوابة، (ب) وزرّها
// لا يُرسم إلا على جهازٍ جاهز، (ج) والصفحة كانت تقول «قريباً» و«على الأجهزة المدعومة» دون أن تقول أيّ الثلاثة.
// الآن كل محفظة ظاهرة دائماً بإحدى ثلاث حالات صادقة، والمعطَّلة تقول سببها بالتحديد:
//   ready = مفعّلة عندنا والجهاز جاهز (زرّ حقيقي ينقر فيقود إلى نموذج الدفع)
//   dev   = مفعّلة عندنا لكن هذا الجهاز لا يدعمها — السبب: متصفح آخر · لا بطاقة في Wallet · SDK محجوب
//   off   = لم تُفعَّل على الموقع بعد
// والحوالة البنكية خيارٌ ثالث بجانب البطاقة وتمارا: بيانات الحساب مع زر نسخ، ثم رفع الإيصال.
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
const OFF = { ar: "غير مفعّل بعد", en: "Not enabled yet", fr: "Pas encore activé", zh: "尚未开通" };
const READY = { ar: "جاهز", en: "Ready", fr: "Prêt", zh: "可用" };
const DEV = { ar: "غير متاح على جهازك", en: "Not on this device", fr: "Indisponible ici", zh: "此设备不可用" };

function makeEl(id) {
  const el = {
    id, children: [], style: {}, attrs: {}, value: "", _t: "", className: "", disabled: false, onclick: null, href: "", files: [],
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
// حساب وهمي صريح: لا آيبان حقيقياً في الاختبارات.
const BANK = { enabled: true, beneficiary: "شركة اختبار وهمية للحلول", beneficiaryEn: "Fake Test Solutions Co", bank: "بنك وهمي", bankEn: "Fake Bank", iban: "SA00FAKE0000000000000000", currency: "SAR" };

// device: { apple: bool|undefined(=no ApplePaySession), samsung: bool|"blocked", google: bool|"blocked" } — ما تقوله الأجهزة عن نفسها.
async function boot(lang, { cart = PRICED, cfg, device = {}, prices = true, reply, file, protocol } = {}) {
  const els = new Map();
  const posts = [];
  const copied = [];
  const store = (init) => { const m = new Map(Object.entries(init || {})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
  const ways = ["card", "bank", "tamara"].map((w) => { const e = makeEl("way-" + w); e.attrs["data-way"] = w; e.classes.add("sv1-co-way"); if (w === "bank") els.set("coWayBank", e); if (w === "tamara") els.set("coWayTamara", e); return e; });
  const copyBtns = ["bene", "bank", "iban", "amount", "ref"].map((k) => { const e = makeEl("cp-" + k); e.attrs["data-copy"] = "coBk-" + k; return e; });
  const inits = [];
  const sandbox = {
    localStorage: store({ bp_cart: JSON.stringify(cart) }), sessionStorage: store({}),
    location: { href: `https://x.test/${lang}/checkout`, pathname: `/${lang}/checkout`, origin: "https://x.test", hostname: "x.test", ...(protocol ? { protocol } : {}) },
    URL, console, Event: class {}, CustomEvent: class {}, addEventListener() {}, dispatchEvent() {},
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async (t) => { copied.push(t); } } },
    FileReader: class { readAsDataURL(f) { setTimeout(() => { this.result = "data:" + f.type + ";base64," + (f.b64 || "QUJD"); this.onload && this.onload(); }, 0); } },
    setTimeout: (f, ms) => { const t = setTimeout(f, ms); t.unref(); return t; }, clearTimeout,
    Promise, JSON, Math, Number, String, Array, Object, Date, RegExp, Error, encodeURIComponent,
    fetch: async (u, init = {}) => {
      const method = init.method || "GET";
      if (method === "POST") { const body = JSON.parse(init.body); if (/\/api\/pay/.test(String(u))) posts.push(body); return { ok: true, json: async () => (body.action === "bank-receipt" ? (reply || { ok: false, error: "x" }) : {}) }; }
      return { ok: true, json: async () => cfg };
    },
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
    querySelectorAll: (sel) => (sel === ".sv1-co-way" ? ways : sel === "[data-copy]" ? copyBtns : []),
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
  const wallet = (k) => ({ st: g(`coW-${k}`).getAttribute("data-st"), pill: g(`coW-${k}-pill`).textContent, why: g(`coW-${k}-why`).textContent, disabled: g(`coWb-${k}`).disabled });
  return { g, wallet, inits, sandbox, ways, posts, copied, copyBtns, store: sandbox.sessionStorage };
}
const tick = async () => { for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 8)); for (let j = 0; j < 20; j++) await new Promise((r) => setImmediate(r)); } };

// ---------- الصفحة نفسها: الصفّ والحوالة موجودان في الـHTML بلا سكربت

test("the three wallets are in the page markup in every language, as buttons that start disabled", () => {
  const heading = { ar: "المحافظ الرقمية", en: "Digital wallets", fr: "Portefeuilles numériques", zh: "数字钱包" };
  for (const lang of LANGS) {
    const body = String(buildSimpleCheckout(SV1, mkCtx(lang)).body);
    const row = body.match(/<div class="sv1-co-wallets"[\s\S]*?<\/ul>/);
    assert.ok(row, `${lang}: wallet row present`);
    for (const n of ["Apple Pay", "Samsung Pay", "Google Pay"]) assert.ok(row[0].includes(n), `${lang}: ${n}`);
    assert.ok(row[0].includes(heading[lang]), `${lang}: heading`);
    assert.equal((row[0].match(/<li /g) || []).length, 3, `${lang}: three items`);
    assert.equal((row[0].match(/<button [^>]*disabled/g) || []).length, 3, `${lang}: every wallet button starts disabled — no dead button can be tapped`);
    assert.doesNotMatch(row[0], /<a[\s>]/);
    assert.doesNotMatch(row[0], /onclick/i);
  }
});

test("the bank-transfer option is in the page in every language: tile, steps, five copyable fields, file input, submit", () => {
  for (const lang of LANGS) {
    const body = String(buildSimpleCheckout(SV1, mkCtx(lang)).body);
    for (const frag of ['data-way="bank"', 'id="coWayBank"', 'id="coPaneBank"', 'id="coBankFile"', 'id="coBankGo"', 'id="coBankOff"', 'id="coBankOn"', 'type="file"'])
      assert.ok(body.includes(frag), `${lang}: ${frag}`);
    for (const f of ["bene", "bank", "iban", "amount", "ref"]) {
      assert.ok(body.includes(`id="coBk-${f}"`), `${lang}: field ${f}`);
      assert.ok(body.includes(`data-copy="coBk-${f}"`), `${lang}: copy button for ${f}`);
    }
    assert.match(body, /accept="image\/jpeg,image\/png,image\/webp,application\/pdf"/, `${lang}: image or PDF only`);
    assert.equal((body.match(/<ol class="sv1-co-steps">[\s\S]*?<\/ol>/) || [""])[0].match(/<li>/g).length, 3, `${lang}: three steps`);
    // لا آيبان ولا اسم حساب مكتوب في الصفحة: كلها تأتي من الخادم.
    assert.doesNotMatch(body, /SA\d{22}/, `${lang}: no IBAN baked into the page`);
  }
});

test("the card pane, Tamara and the bank pane coexist; wallets sit between the method tiles and the panes", () => {
  for (const lang of LANGS) {
    const body = String(buildSimpleCheckout(SV1, mkCtx(lang)).body);
    for (const frag of ['data-way="card"', 'data-way="tamara"', 'id="coPayMount"', 'id="coTamaraGo"', 'id="coPaneTamara"', 'id="coWayCardLabel"'])
      assert.ok(body.includes(frag), `${lang}: ${frag}`);
    const at = (s) => body.indexOf(s);
    assert.ok(at('id="coWays"') < at('id="coWallets"'), `${lang}: wallets under the tiles`);
    assert.ok(at('id="coWallets"') < at('id="coPaneCard"'), `${lang}: wallets above the panes`);
    assert.ok(at('id="coPaneCard"') < at('id="coPaneTamara"') && at('id="coPaneTamara"') < at('id="coPaneBank"'));
  }
});

test("built pages carry the wallets and the bank option in all four languages", () => {
  for (const f of ["checkout.html", "ar/checkout.html", "fr/checkout.html", "zh/checkout.html"]) {
    const p = path.join(ROOT, "site", f);
    assert.ok(fs.existsSync(p), f);
    const html = fs.readFileSync(p, "utf8");
    assert.match(html, /id="coWallets"/, f);
    for (const k of ["apple", "samsung", "google"]) assert.match(html, new RegExp(`id="coW-${k}"`), `${f} ${k}`);
    assert.match(html, /id="coPayMount"/, f);
    assert.match(html, /id="coPaneBank"/, f);
    assert.match(html, /id="coBankFile"/, f);
  }
});

// ---------- الحالات الثلاث للمحفظة

test("wallet not enabled on the site: «off» in every language, button disabled, says so plainly and points to what works", async () => {
  for (const lang of LANGS) {
    const w = await boot(lang, { cfg: LIVE });
    for (const k of ["apple", "samsung", "google"]) {
      const s = w.wallet(k);
      assert.equal(s.st, "off", `${lang} ${k}`);
      assert.equal(s.pill, OFF[lang]);
      assert.equal(s.disabled, true);
      assert.ok(s.why.length > 30, `${lang}: a sentence, not a hint`);
    }
  }
  const ar = await boot("ar", { cfg: LIVE });
  assert.match(ar.wallet("apple").why, /لم تُفعَّل على الموقع بعد/);
  assert.match(ar.wallet("apple").why, /البطاقة أو بالحوالة البنكية أو بتمارا/);
});

test("Apple Pay enabled but the visitor is not in Safari: the page says to open it in Safari (no wallet API)", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: {} });
  const s = w.wallet("apple");
  assert.equal(s.st, "dev");
  assert.equal(s.pill, DEV.ar);
  assert.equal(s.disabled, true);
  assert.match(s.why, /Safari/);
  assert.match(s.why, /افتح هذه الصفحة في Safari/);
  assert.equal(w.inits.length, 1);
  assert.deepEqual(w.inits[0].methods, ["creditcard"]);
  assert.equal(w.inits[0].apple_pay, undefined);
  assert.equal(w.g("coWayCardLabel").textContent, "بطاقة");
});

test("Safari with no card in Apple Wallet: says exactly that, and how to fix it", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: false } });
  assert.equal(w.wallet("apple").st, "dev");
  assert.match(w.wallet("apple").why, /لا توجد بطاقة جاهزة في محفظة آبل/);
  assert.match(w.wallet("apple").why, /Wallet/);
  assert.equal(w.inits[0].apple_pay, undefined);
});

test("Apple Pay over plain http (not localhost) is named as such", async () => {
  const w = await boot("en", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: true }, protocol: "http:" });
  assert.equal(w.wallet("apple").st, "dev");
  assert.match(w.wallet("apple").why, /secure \(https\)/);
});

test("Safari with a wallet: Apple Pay is ready, the button is enabled, and the form gets apple_pay", async () => {
  const w = await boot("en", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: true } });
  assert.equal(w.wallet("apple").st, "ready");
  assert.equal(w.wallet("apple").pill, READY.en);
  assert.equal(w.wallet("apple").disabled, false);
  assert.deepEqual(w.inits[0].methods, ["creditcard", "applepay"]);
  assert.deepEqual(w.inits[0].apple_pay, APPLE);
  assert.equal(w.g("coWayCardLabel").textContent, "Card · Apple Pay");
  // نقر الزرّ الجاهز يختار لوحة البطاقة ويعلّم المحفظة — ولا يكسر شيئاً.
  w.g("coWb-apple").onclick();
  assert.equal(w.g("coW-apple").classes.has("pick"), true);
  assert.equal(w.g("coPaneCard").classes.has("sv1-hide"), false);
  assert.equal(w.g("coPaneBank").classes.has("sv1-hide"), true);
});

test("a disabled wallet button does nothing when its handler is invoked", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: {} });
  w.g("coWayTamara").onclick && w.g("coWayTamara").onclick();
  w.ways[2].onclick();
  assert.equal(w.g("coPaneTamara").classes.has("sv1-hide"), false);
  w.g("coWb-apple").onclick();
  assert.equal(w.g("coW-apple").classes.has("pick"), false, "disabled → no pick");
  assert.equal(w.g("coPaneTamara").classes.has("sv1-hide"), false, "pane unchanged by a disabled wallet");
});

test("everything configured and every device ready: three ready wallets, three objects handed to the form", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay", "samsungpay", "googlepay"], applePay: APPLE, samsungPay: SAMSUNG, googlePay: GOOGLE };
  const w = await boot("ar", { cfg, device: { apple: true, samsung: true, google: true } });
  for (const k of ["apple", "samsung", "google"]) {
    assert.equal(w.wallet(k).st, "ready", k);
    assert.equal(w.wallet(k).pill, READY.ar);
    assert.equal(w.wallet(k).disabled, false);
    assert.match(w.wallet(k).why, /زرّها في نموذج الدفع/);
  }
  const o = w.inits[0];
  assert.deepEqual(o.methods.sort(), ["applepay", "creditcard", "googlepay", "samsungpay"]);
  assert.equal(o.samsung_pay.service_id, "svc_unit");
  assert.equal(o.google_pay.merchant_id, "BCR2DN_unit");
  assert.equal(w.g("coWayCardLabel").textContent, "بطاقة · Apple Pay · Google Pay · Samsung Pay");
});

test("Samsung / Google not ready on this device, or their SDK blocked: each says which, and the form falls back to card", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay", "samsungpay", "googlepay"], applePay: APPLE, samsungPay: SAMSUNG, googlePay: GOOGLE };
  const notReady = await boot("ar", { cfg, device: { apple: false, samsung: false, google: false } });
  for (const k of ["apple", "samsung", "google"]) { assert.equal(notReady.wallet(k).st, "dev", k); assert.equal(notReady.wallet(k).disabled, true); }
  assert.match(notReady.wallet("samsung").why, /جوالات سامسونج \(Galaxy\)/);
  assert.match(notReady.wallet("samsung").why, /Samsung Internet أو Chrome/);
  assert.match(notReady.wallet("google").why, /Chrome على أندرويد/);
  assert.deepEqual(notReady.inits[0].methods, ["creditcard"]);

  const blocked = await boot("ar", { cfg, device: { apple: true, samsung: "blocked", google: "blocked" } });
  assert.equal(blocked.wallet("apple").st, "ready");
  assert.match(blocked.wallet("samsung").why, /تعذّر الاتصال بخدمة Samsung Pay/, "an unreachable SDK is not reported as «your phone cannot»");
  assert.match(blocked.wallet("google").why, /تعذّر الاتصال بخدمة Google Pay/);
  assert.deepEqual(blocked.inits[0].methods.sort(), ["applepay", "creditcard"]);

  const fr = await boot("fr", { cfg, device: { apple: false, samsung: false, google: false } });
  assert.match(fr.wallet("samsung").why, /Samsung Galaxy/);
});

test("a mix: Google ready, Samsung not on this device, Apple not enabled", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "samsungpay", "googlepay"], samsungPay: SAMSUNG, googlePay: GOOGLE };
  const w = await boot("ar", { cfg, device: { samsung: false, google: true } });
  assert.equal(w.wallet("apple").st, "off");
  assert.equal(w.wallet("samsung").st, "dev");
  assert.equal(w.wallet("google").st, "ready");
  assert.deepEqual(w.inits[0].methods.sort(), ["creditcard", "googlepay"]);
});

test("state labels and reasons are localised in all four languages, never mixed", async () => {
  for (const lang of LANGS) {
    const off = await boot(lang, { cfg: LIVE });
    assert.equal(off.wallet("apple").pill, OFF[lang], lang);
    const dev = await boot(lang, { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: {} });
    assert.equal(dev.wallet("apple").pill, DEV[lang], lang);
    assert.match(dev.wallet("apple").why, /Safari/, lang);
    const ok = await boot(lang, { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE }, device: { apple: true } });
    assert.equal(ok.wallet("apple").pill, READY[lang], lang);
  }
  const ar = await boot("ar", { cfg: LIVE });
  assert.doesNotMatch(ar.wallet("google").why + ar.wallet("google").pill, /[A-Za-z]{4,}/);
  const en = await boot("en", { cfg: LIVE });
  assert.doesNotMatch(en.wallet("google").why + en.wallet("google").pill, /[؀-ۿ]/);
});

// ---------- لا وعد حيث لا نموذج دفع

test("local mock gateway: wallets read «not enabled», the mock pay button is still drawn", async () => {
  const cfg = { enabled: true, mock: true, provider: "local-mock", formUrl: "/api/pay?action=mock-form", methods: ["creditcard"], applePay: null, samsungPay: null, googlePay: null, bnpl: { tamara: true }, bank: BANK };
  const w = await boot("ar", { cfg });
  for (const k of ["apple", "samsung", "google"]) assert.equal(w.wallet(k).st, "off", k);
  assert.ok(w.g("coPayMount").children.some((c) => c.id === "coMockPay"));
});

test("gateway down: the wallet row is hidden, not left claiming wallets — but the bank option still works", async () => {
  const w = await boot("ar", { cfg: { enabled: false, bank: BANK } });
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), true);
  assert.equal(w.inits.length, 0);
  assert.equal(w.g("coWayBank").disabled, false);
  assert.equal(w.g("coBk-iban").textContent, "SA00 FAKE 0000 0000 0000 0000");
});

test("empty cart: the row is hidden", async () => {
  const w = await boot("ar", { cart: [], cfg: LIVE });
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), true);
});

test("guest on a priced item (sign-in required): wallets hidden, bank and Tamara disabled", async () => {
  const hiddenPrice = [{ id: "svc-x", nameAr: "خدمة", nameEn: "Svc", amount: 500, price: "", qty: 1, kind: "service" }];
  const w = await boot("ar", { cart: hiddenPrice, cfg: LIVE, prices: false });
  assert.equal(w.g("coWallets").classes.has("sv1-hide"), true);
  assert.equal(w.inits.length, 0);
  assert.equal(w.g("coWayBank").disabled, true);
  assert.equal(w.g("coTamaraGo").disabled, true);
});

// ---------- تمارا والبطاقة لم تتأثرا

test("Tamara pane keeps working next to the row and the bank option", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE, bank: BANK }, device: {} });
  assert.equal(typeof w.g("coTamaraGo").onclick, "function");
  assert.equal(w.g("coWayTamara").disabled, false);
  assert.equal(typeof w.ways[0].onclick, "function");
  w.ways[2].onclick();
  assert.equal(w.g("coPaneTamara").classes.has("sv1-hide"), false);
  assert.equal(w.g("coPaneCard").classes.has("sv1-hide"), true);
});

test("the Moyasar form is always given a language it supports", async () => {
  const cfg = { ...LIVE, methods: ["creditcard", "applepay"], applePay: APPLE };
  const want = { ar: "ar", en: "en", fr: "en", zh: "en" };
  for (const lang of LANGS) {
    const w = await boot(lang, { cfg });
    assert.equal(w.inits[0].language, want[lang], lang);
  }
});

// ---------- الحوالة البنكية

const fill = (w, email = "sara@example.com") => {
  w.g("coName").value = "سارة"; w.g("coPhone").value = "0500000000"; w.g("coEmail").value = email;
};
const pick = (w, f = { name: "receipt.png", type: "image/png", size: 5000, b64: "UE5H" }) => { w.g("coBankFile").files = [f]; };

test("bank option: account details from the server with copy buttons that copy the raw value", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, bank: BANK } });
  assert.equal(w.g("coWayBank").disabled, false);
  w.ways[1].onclick();
  assert.equal(w.g("coPaneBank").classes.has("sv1-hide"), false);
  assert.equal(w.g("coPaneCard").classes.has("sv1-hide"), true);
  assert.equal(w.g("coBk-bene").textContent, "شركة اختبار وهمية للحلول");
  assert.equal(w.g("coBk-bank").textContent, "بنك وهمي");
  assert.equal(w.g("coBk-iban").textContent, "SA00 FAKE 0000 0000 0000 0000", "grouped for reading");
  assert.equal(w.g("coBk-amount").getAttribute("data-raw"), "1150.00", "1000 + 15% VAT");
  assert.match(w.g("coBk-ref").textContent, /^BP-\d{6}$/, "the order reference to put in the notes");
  const ref = w.g("coBk-ref").textContent;
  assert.equal(JSON.parse(w.store.getItem("bp_pay_order")).ref, ref, "the same reference is the one sent on upload");
  // نسخ الآيبان ينسخ القيمة الخام بلا فراغات، والمبلغ بلا رمز العملة.
  const [, , ibanBtn, amountBtn] = w.copyBtns;
  ibanBtn.onclick(); amountBtn.onclick();
  await tick();
  assert.deepEqual(w.copied, ["SA00FAKE0000000000000000", "1150.00"]);
  assert.equal(ibanBtn.textContent, "تم النسخ");
});

test("English page uses the English beneficiary and bank names", async () => {
  const w = await boot("en", { cfg: { ...LIVE, bank: BANK } });
  assert.equal(w.g("coBk-bene").textContent, "Fake Test Solutions Co");
  assert.equal(w.g("coBk-bank").textContent, "Fake Bank");
});

test("bank not configured on the server: the tile is disabled with a plain reason, no account is drawn", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, bank: { enabled: false } } });
  assert.equal(w.g("coWayBank").disabled, true);
  assert.equal(w.g("coWayBankSub").textContent, "غير متاحة حالياً");
  assert.equal(w.g("coBankOff").classes.has("sv1-hide"), false);
  assert.equal(w.g("coBankOn").classes.has("sv1-hide"), true);
  assert.equal(w.g("coBk-iban").textContent, "", "no account text is drawn");
  const none = await boot("ar", { cfg: LIVE });
  assert.equal(none.g("coWayBank").disabled, true, "a config without a bank block is also «not available»");
});

test("an employer plan in the cart cannot be paid by transfer, and the page says why", async () => {
  const plan = [{ id: "BP-EMP-BASIC-M", nameAr: "باقة", nameEn: "Plan", amount: 500, price: "", qty: 1, kind: "service", pricePublic: 1 }];
  const w = await boot("ar", { cart: plan, cfg: { ...LIVE, bank: BANK, ok: true, amountSar: 500, name: { ar: "باقة", en: "Plan" }, bnpl: { tamara: true } } });
  assert.equal(w.g("coWayBank").disabled, true);
  assert.equal(w.g("coWayBankSub").textContent, "غير متاحة لاشتراك منصة التوظيف");
  assert.match(w.g("coBankOff").textContent, /البطاقة أو تمارا/);
});

test("upload: refuses to send without details, without a file, or with the wrong type — nothing is posted", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, bank: BANK } });
  w.ways[1].onclick();
  const go = w.g("coBankGo");
  go.onclick();                                                       // no details
  assert.match(w.g("coBankNote").textContent, /أكمل الاسم والجوال والبريد/);
  fill(w);
  go.onclick();                                                       // no file
  assert.match(w.g("coBankNote").textContent, /اختر صورة الإيصال أو ملف PDF/);
  pick(w, { name: "x.exe", type: "application/x-msdownload", size: 10 });
  go.onclick();
  assert.match(w.g("coBankNote").textContent, /صورة \(JPG أو PNG أو WebP\) أو PDF/);
  pick(w, { name: "big.pdf", type: "application/pdf", size: 4 * 1024 * 1024, b64: "AAAA" });
  go.onclick();
  await tick();
  assert.match(w.g("coBankNote").textContent, /أصغر من ٣ ميغابايت/);
  assert.equal(w.posts.length, 0);
});

test("upload: posts the order snapshot and the receipt to /api/pay bank-receipt", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, bank: BANK }, reply: { ok: true, state: "review", ref: "BP-R-AAAAAA", orderRef: "BP-111111", amount: 1150, reasons: ["amount_short"] } });
  w.ways[1].onclick();
  fill(w, "Sara@Example.com");
  pick(w);
  w.g("coBankGo").onclick();
  await tick();
  assert.equal(w.posts.length, 1);
  const p = w.posts[0];
  assert.equal(p.action, "bank-receipt");
  assert.equal(p.order.email, "sara@example.com", "lower-cased");
  assert.equal(p.order.name, "سارة");
  assert.deepEqual(p.order.items, [{ id: "svc-bp-sbc-31", qty: 1 }], "ids and quantities only — never a price");
  assert.equal(p.order.ref, w.g("coBk-ref").textContent);
  assert.deepEqual(Object.keys(p.file).sort(), ["base64", "mime", "name"]);
  assert.equal(p.file.mime, "image/png");
  assert.equal(p.file.base64, "UE5H");
  assert.doesNotMatch(JSON.stringify(p), /1150|amount/i, "no amount travels from the browser");
});

test("after verification: approved shows confirmation, status, invoice number and a link to the request; the cart is emptied", async () => {
  const reply = { ok: true, state: "approved", ref: "BP-R-AAAAAA", orderRef: "BP-111111", amount: 1150, reasons: [], invoice: { invoiced: true, number: "INV-42" } };
  const w = await boot("ar", { cfg: { ...LIVE, bank: BANK }, reply });
  w.ways[1].onclick(); fill(w); pick(w);
  w.g("coBankGo").onclick();
  await tick();
  const r = w.g("coResult");
  assert.equal(r.className, "sv1-co-result ok");
  const text = JSON.stringify(r.children.map((c) => [c._t, (c.children || []).map((d) => (d.children || []).map((e) => e._t))]));
  assert.match(text, /تحقق المستشار الذكي من إيصالك/);
  for (const frag of ["BP-111111", "BP-R-AAAAAA", "INV-42", "معتمد", "1,150.00"]) assert.ok(text.includes(frag), frag);
  const link = r.children[r.children.length - 1];
  assert.match(link.href, /my\?ref=BP-R-AAAAAA/);
  assert.equal(w.sandbox.localStorage.getItem("bp_cart"), null, "the order is recorded — the cart is cleared so it cannot be sent twice");
  assert.equal(w.g("coWays").classes.has("sv1-hide"), true);
  assert.equal(w.g("coPaneBank").classes.has("sv1-hide"), true);
});

test("after verification: a mismatch shows «awaiting verification» with the reasons in the buyer's language, and no promise of approval", async () => {
  const reasons = ["amount_short", "iban_mismatch", "duplicate_receipt"];
  for (const [lang, status, why] of [["ar", "بانتظار التحقق", "المبلغ في الإيصال أقل من إجمالي الطلب"], ["en", "Awaiting verification", "The receipt amount is lower than the order total"]]) {
    const w = await boot(lang, { cfg: { ...LIVE, bank: BANK }, reply: { ok: true, state: "review", ref: "BP-R-BBBBBB", orderRef: "BP-222222", amount: 1150, reasons } });
    w.ways[1].onclick(); fill(w); pick(w);
    w.g("coBankGo").onclick();
    await tick();
    const r = w.g("coResult");
    assert.equal(r.className, "sv1-co-result warn", lang);
    const text = JSON.stringify(r.children.map((c) => [c._t, (c.children || []).map((d) => (d.children || []).map((e) => e._t))]));
    assert.ok(text.includes(status), `${lang}: status`);
    assert.ok(text.includes(why), `${lang}: reason`);
    assert.ok(text.includes(lang === "ar" ? "الآيبان في الإيصال لا يطابق" : "does not match the company account"), `${lang}: second reason`);
    assert.doesNotMatch(text, /اعتُمد دفعك|payment is approved/);
    assert.equal(w.sandbox.localStorage.getItem("bp_cart"), null);
  }
});

test("server refusals are worded: slow down, reference taken, already paid, too large, not available, generic failure — and the form stays usable", async () => {
  const cases = [
    ["slow_down", /محاولات كثيرة/], ["ref_taken", /مرتبط ببريد آخر/], ["already_paid", /مدفوع بالفعل/], ["too_large", /أصغر من ٣ ميغابايت/],
    ["bank_not_configured", /غير متاحة في الوقت الحالي/], ["bank_not_for_plan", /البطاقة أو تمارا/], ["quote_only_items", /تُسعّر عند المراجعة/], ["whatever", /تعذّر رفع الإيصال/],
  ];
  for (const [error, re] of cases) {
    const w = await boot("ar", { cfg: { ...LIVE, bank: BANK }, reply: { ok: false, error } });
    w.ways[1].onclick(); fill(w); pick(w);
    w.g("coBankGo").onclick();
    await tick();
    assert.match(w.g("coBankNote").textContent, re, error);
    assert.equal(w.g("coBankGo").disabled, false, `${error}: the button is usable again`);
    assert.notEqual(w.sandbox.localStorage.getItem("bp_cart"), null, `${error}: the cart is kept`);
  }
});

test("a second tap while the upload is running sends nothing more", async () => {
  const w = await boot("ar", { cfg: { ...LIVE, bank: BANK }, reply: { ok: false, error: "x" } });
  w.ways[1].onclick(); fill(w); pick(w);
  w.g("coBankGo").onclick();
  w.g("coBankGo").onclick();
  w.g("coBankGo").onclick();
  await tick();
  assert.equal(w.posts.length, 1);
});

// ---------- عطل وُجد أثناء التشخيص (2026-10-23): نمط البريد داخل قالب JS فقد شرطاته المائلة

test("regression: the e-mail check in the generated script is a real pattern — an address containing the letter «s» is valid", async () => {
  // النمط كُتب `\s` داخل قالب نصّي فصار `s` عند التوليد، فرُفض كل بريدٍ فيه حرف s («sara@…») بدعوى «أكمل
  // الاسم والجوال والبريد» — على تمارا والحوالة والبوابة المحلية. الآن يُكتب `\\s` فيصل `\s` سليماً.
  for (const lang of LANGS) assert.ok(scriptOf(buildSimpleCheckout(SV1, mkCtx(lang))).includes("/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/"), lang);
  const w = await boot("ar", { cfg: { ...LIVE, bank: BANK }, reply: { ok: false, error: "x" } });
  w.ways[1].onclick();
  for (const email of ["sara@example.com", "business@mail.sa", "s@s.ss"]) {
    w.posts.length = 0;
    fill(w, email); pick(w);
    w.g("coBankGo").onclick();
    await tick();
    assert.equal(w.posts.length, 1, `${email} must be accepted`);
  }
  w.posts.length = 0;
  fill(w, "no-at-sign"); pick(w);
  w.g("coBankGo").onclick();
  await tick();
  assert.equal(w.posts.length, 0, "a malformed address is still refused");
});
