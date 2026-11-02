// Business Partner — بوابة الموافقة على الشروط (Terms gate).
//
// أمر المالك (2026-11-02، البند 8): شروط لكل الخدمات لا للباقات وحدها. هذا
// الملف هو الواجهة المشتركة التي يستعملها من يحتاج أن يعرف، لأي بند في سلة
// أو طلب أو صفحة: «ما فئة شروطه؟ وأين نصّها؟ وما جملة الموافقة؟». المصدر
// الوحيد للنص والربط: site/assets/data/terms.json (يملكه وكيل الشروط، لا
// تُحرَّر نسخ منه).
//
// ── الاستعمال في البناء أو الخادم (Node) ──────────────────────────────────
//   import { loadTermsData, termsForSku, termsForCart } from "./terms-gate.mjs";
//   const data = loadTermsData();                    // terms.json كاملاً
//   termsForSku(data, "svc-bp-sbc-01", "ar")
//     → { matched:true, sku:"BP-SBC-01", category:"formation",
//         categoryTitle:"تأسيس الشركات والسجلات التجارية",
//         url:"/ar/terms#cat-formation", generalUrl:"/ar/terms#general",
//         consentText:"أقرّ بأنني اطّلعت على الشروط العامة وشروط فئة «…» وأوافق عليها.",
//         version:"2026-11-02" }
//   termsForCart(data, cartItems, "ar")
//     → { categories:[{id,title,url,skus:[…]}], unmatched:[…], consentText,
//         generalUrl, version }       // جملة موافقة واحدة تسمّي كل الفئات
//
// ── الاستعمال في المتصفح (صفحة السلة/الدفع) ───────────────────────────────
//   const gate = termsGateClientSource();            // نصّ سكربت جاهز للحقن
//   // يُحقن مرة في الصفحة (<script>${gate}</script>) فيعرّف window.BPTermsGate،
//   // ثم:
//   BPTermsGate.load("/assets/data/terms-index.json").then(function (idx) {
//     var r = BPTermsGate.termsForCart(idx, JSON.parse(localStorage.bp_cart || "[]"), "ar");
//     // r.consentText → نصّ خانة الإقرار؛ r.categories[i].url → رابط «اقرأ الشروط»
//   });
//   terms-index.json خفيف (بلا النصوص الطويلة) ويولّده البناء من terms.json.
//
// ── ما يقبله كمدخل ────────────────────────────────────────────────────────
//   نصّ (رمز SKU أو معرّف سلة) أو كائن بند سلة { id, code, sku, kind }.
//   يفهم معرّفات السلة الفعلية: svc-<sku> · pkg-<مفتاح الباقة> · رمز الرحلة ·
//   employee-* · agent-compliance · agent-shared-services · employer-plan-* ·
//   companies-data-access · revos-* . ما لا يعرفه يرجع matched:false (يحمل
//   الشروط العامة وحدها) ولا يرمي خطأ — الدفع لا يتوقف لأن رمزاً جديداً لم
//   يُربط بعد؛ اختبار tests/terms-coverage.test.mjs هو ما يكشف الفجوة.
//
// ── ما لا يفعله ───────────────────────────────────────────────────────────
//   لا يعدّل السلة ولا الدفع (يملكهما cart-checkout)، ولا يخزّن موافقة؛ تخزين
//   الإقرار مع الطلب (النسخة version + الفئات) مسؤولية من يستدعيه.
//
// الدوال كلها نقية وبلا استيراد داخل makeGate، لأن makeGate.toString() هو
// نفسه ما يُحقن في المتصفح — مصدر واحد للخادم والعميل.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function makeGate() {
  var LANGS = ["ar", "en", "fr", "zh"];
  var cache = typeof WeakMap === "function" ? new WeakMap() : null;

  function lang(l) { return LANGS.indexOf(l) >= 0 ? l : "en"; }
  function pick(obj, l) {
    if (!obj) return "";
    return obj[lang(l)] != null && obj[lang(l)] !== "" ? obj[lang(l)] : (obj.en || obj.ar || "");
  }

  // خريطة صغيرة الحروف لمطابقة لا تعتمد على حالة الأحرف.
  function lower(data) {
    var c = cache && cache.get(data);
    if (c) return c;
    var skus = {}, keys = {}, cats = {};
    Object.keys(data.skus || {}).forEach(function (k) { skus[k.toLowerCase()] = { sku: k, category: data.skus[k] }; });
    Object.keys(data.keys || {}).forEach(function (k) { keys[k.toLowerCase()] = data.keys[k]; });
    (data.categories || []).forEach(function (cat) { cats[cat.id] = cat; });
    c = { skus: skus, keys: keys, cats: cats };
    if (cache) cache.set(data, c);
    return c;
  }

  function strip(id) {
    return String(id == null ? "" : id).trim().replace(/^(svc|pkg)-/i, "");
  }

  function byAlias(data, id) {
    var L = lower(data), a = data.aliases || [], i, x;
    for (i = 0; i < a.length; i++) {
      x = a[i];
      var hit = (x.exact && id === x.exact.toLowerCase()) || (x.prefix && id.indexOf(x.prefix.toLowerCase()) === 0);
      if (!hit) continue;
      if (x.sku && L.skus[x.sku.toLowerCase()]) return L.skus[x.sku.toLowerCase()];
      if (x.category) return { sku: "", category: x.category };
    }
    return null;
  }

  function byPrefix(data, id) {
    var r = data.prefixRules || [], i;
    for (i = 0; i < r.length; i++) if (id.toUpperCase().indexOf(r[i][0].toUpperCase()) === 0) return { sku: "", category: r[i][1] };
    return null;
  }

  // يرجع { matched, sku, category } لمدخل واحد.
  function resolveSku(data, input) {
    var L = lower(data);
    var cand = [];
    if (input && typeof input === "object") { cand.push(input.sku, input.code, input.id); }
    else cand.push(input);
    var kind = input && typeof input === "object" ? String(input.kind || "").toLowerCase() : "";
    var i, raw, id, hit;
    for (i = 0; i < cand.length; i++) {
      raw = cand[i];
      if (raw == null || String(raw).trim() === "") continue;
      id = strip(raw).toLowerCase();
      if (!id) continue;
      hit = L.skus[id];
      if (!hit && L.keys[id]) hit = L.skus[String(L.keys[id]).toLowerCase()];
      if (!hit) hit = byAlias(data, id);
      if (!hit) hit = byPrefix(data, id);
      if (hit) return { matched: true, sku: hit.sku || "", category: hit.category };
    }
    if (kind === "trip") return { matched: true, sku: "", category: "trips" };
    return { matched: false, sku: "", category: null };
  }

  function termsUrl(l, catId) {
    var pre = lang(l) === "en" ? "" : "/" + lang(l);
    return pre + "/terms#" + (catId ? "cat-" + catId : "general");
  }

  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ""; });
  }

  // جملة الموافقة: بلا فئة → العامة؛ فئة واحدة → «…فئة X»؛ أكثر → قائمة الفئات.
  function consentText(data, catIds, l) {
    var L = lower(data), c = data.consent || {};
    var ids = (catIds || []).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (!ids.length) return pick(c.general, l);
    var titles = ids.map(function (id) { return L.cats[id] ? pick(L.cats[id].title, l) : id; });
    if (ids.length === 1) return fill(pick(c.single, l), { category: titles[0] });
    return fill(pick(c.multi, l), { categories: titles.join(pick(c.joiner, l) || ", ") });
  }

  function termsForSku(data, input, l) {
    var L = lower(data), r = resolveSku(data, input);
    var cat = r.category && L.cats[r.category] ? L.cats[r.category] : null;
    return {
      matched: r.matched && !!cat,
      sku: r.sku,
      category: cat ? cat.id : null,
      categoryTitle: cat ? pick(cat.title, l) : "",
      url: termsUrl(l, cat ? cat.id : null),
      generalUrl: termsUrl(l, null),
      consentText: consentText(data, cat ? [cat.id] : [], l),
      version: data.version || "",
    };
  }

  function termsForCart(data, items, l) {
    var L = lower(data), by = {}, order = [], unmatched = [];
    (items || []).forEach(function (it) {
      var r = resolveSku(data, it);
      if (r.matched && L.cats[r.category]) {
        if (!by[r.category]) { by[r.category] = []; order.push(r.category); }
        by[r.category].push(r.sku || (it && typeof it === "object" ? (it.code || it.id) : it));
      } else {
        unmatched.push(it && typeof it === "object" ? (it.code || it.id || "") : String(it));
      }
    });
    order.sort(function (a, b) { return L.cats[a].order - L.cats[b].order; });
    return {
      categories: order.map(function (id) {
        return { id: id, title: pick(L.cats[id].title, l), url: termsUrl(l, id), skus: by[id] };
      }),
      unmatched: unmatched,
      consentText: consentText(data, order, l),
      generalUrl: termsUrl(l, null),
      version: data.version || "",
    };
  }

  // الصفحات التي لا بند كتالوج لها (فارينا، تسكين…) → فئتها.
  function termsForPage(data, pagePath, l) {
    var L = lower(data), p = String(pagePath || "").replace(/^\/(ar|fr|zh)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    var id = (data.pages || {})[p];
    var cat = id && L.cats[id] ? L.cats[id] : null;
    return {
      matched: !!cat, category: cat ? cat.id : null, categoryTitle: cat ? pick(cat.title, l) : "",
      url: termsUrl(l, cat ? cat.id : null), generalUrl: termsUrl(l, null),
      consentText: consentText(data, cat ? [cat.id] : [], l), version: data.version || "",
    };
  }

  function load(url) {
    return fetch(url || "/assets/data/terms-index.json").then(function (r) { return r.json(); });
  }

  return { resolveSku: resolveSku, termsForSku: termsForSku, termsForCart: termsForCart, termsForPage: termsForPage, consentText: consentText, termsUrl: termsUrl, load: load };
}

const gate = makeGate();
export const { resolveSku, termsForSku, termsForCart, termsForPage, consentText, termsUrl } = gate;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TERMS_DATA_FILE = path.resolve(HERE, "..", "assets", "data", "terms.json");

// يقرأ terms.json كاملاً (للبناء والخادم). لا يُستدعى في المتصفح.
export function loadTermsData(file = TERMS_DATA_FILE) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// الفهرس الخفيف الذي يحمّله المتصفح: ربط SKU + عناوين الفئات + جمل الموافقة.
// بلا نصوص البنود (≈ 224KB في terms.json) حتى لا تثقل السلة.
export function buildTermsIndex(data) {
  return {
    version: data.version,
    langs: data.langs,
    consent: data.consent,
    categories: data.categories.map((c) => ({ id: c.id, order: c.order, title: c.title })),
    skus: data.skus,
    keys: data.keys,
    aliases: data.aliases,
    prefixRules: data.prefixRules,
    pages: data.pages,
  };
}

// نصّ سكربت جاهز للحقن في صفحة (يعرّف window.BPTermsGate). مصدره makeGate نفسها.
export function termsGateClientSource() {
  return `(function(){var make=${makeGate.toString()};window.BPTermsGate=make();})();`;
}
