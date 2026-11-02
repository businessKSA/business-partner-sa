/* قوائم نموذج التقديم على وظيفة — الدولة · المدينة (تتبع الدولة) · الجنسية · المهنة.
 *
 * يرقّي حقول #c-country و#c-city و#c-nationality و#c-field في #cv-form (نموذج /job و/careers)
 * من قوائم main.js القصيرة إلى قوائم كاملة: كل دول العالم، مدن كل دولة (بحث/إكمال تلقائي)،
 * كل الجنسيات، وأكثر من ألف مهنة مع «أخرى — اكتب مهنتك».
 *
 * الحقول تبقى نفس الحقول (نفس id/name) فيقرؤها معالج التقديم في main.js ويرسلها كما هي إلى
 * /api/candidate (country · city · nationality · field) بلا أي تعديل في الخادم. القيمة المُرسلة
 * نصٌّ بلغة الصفحة، والكتابة الحرّة مسموحة دائماً — القائمة اقتراحٌ لا قيد.
 *
 * البيانات ملفات JSON من النطاق نفسه تُحمَّل عند أول تركيز على الحقل (lazy) ثم تُخزَّن في
 * الذاكرة: countries.json (١٥ ك) · professions.json (٧١ ك) · cities/<ISO>.json لكل دولة وحدها.
 * لا شبكة خارجية. تُولَّد من site/scripts/gen-apply-lists.mjs.
 */
(function () {
  "use strict";
  var BASE = "/assets/data/apply-lists/", VER = "e0bebf1ef4";
  var lang = String((window.BP && window.BP.lang) || document.documentElement.lang || "ar").toLowerCase();
  var AR = lang.indexOf("ar") === 0;

  var T = {
    phCountry: AR ? "ابحث عن دولتك" : "Search your country",
    phCity: AR ? "ابحث عن مدينتك" : "Search your city",
    phCityFirst: AR ? "اختر الدولة أولاً" : "Choose the country first",
    phNat: AR ? "ابحث عن جنسيتك" : "Search your nationality",
    phProf: AR ? "ابحث عن مهنتك أو اكتبها" : "Search your profession or type it",
    otherCountry: AR ? "دولة أخرى — اكتبها" : "Other country — type it",
    otherCity: AR ? "مدينة أخرى — اكتب اسمها" : "Other city — type its name",
    otherNat: AR ? "جنسية أخرى — اكتبها" : "Other nationality — type it",
    otherProf: AR ? "أخرى — اكتب مهنتك" : "Other — type your profession",
    typeHere: AR ? "اكتب هنا" : "Type here",
    typeProf: AR ? "اكتب مهنتك هنا" : "Type your profession here",
    typeCity: AR ? "اكتب اسم مدينتك" : "Type your city name",
    typeNat: AR ? "اكتب جنسيتك" : "Type your nationality",
    typeCountry: AR ? "اكتب اسم دولتك" : "Type your country",
    none: AR ? "لا نتائج مطابقة — يمكنك كتابة القيمة بنفسك" : "No match — you can type the value yourself",
    needCountry: AR ? "اختر الدولة أولاً لتظهر مدنها — أو اكتب مدينتك مباشرة" : "Choose the country first to see its cities — or type your city",
    loading: AR ? "جارٍ التحميل…" : "Loading…",
    more: AR ? "اكتب للتضييق أو مرّر لرؤية المزيد" : "Type to narrow down or scroll for more"
  };

  /* ---------- التطبيع والبحث ---------- */
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    try { s = s.normalize("NFKD"); } catch (e) {}
    return s.replace(/[ً-ٰٟـ̀-ͯ]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[^a-z0-9؀-ۿ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var collator;
  try { collator = new Intl.Collator(AR ? "ar" : "en", { sensitivity: "base" }); } catch (e) { collator = null; }
  function cmp(a, b) { return collator ? collator.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- تحميل كسول مع تخزين بالذاكرة ---------- */
  var cache = {};
  function getJSON(file) {
    if (!cache[file]) {
      cache[file] = fetch(BASE + file + "?v=" + VER, { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .catch(function (e) { delete cache[file]; throw e; });
    }
    return cache[file];
  }
  function item(v, p, s, k) { return { v: v, p: p, s: s, k: norm(k), pk: norm(p) }; }

  var countriesP;
  function loadCountries() {
    if (!countriesP) {
      countriesP = getJSON("countries.json").then(function (d) {
        var pin = d.pin || [], byIso = {}, rows = d.c.map(function (c) {
          var o = { iso: c[0], en: c[1], ar: c[2], nEn: c[3], nAr: c[4] };
          byIso[o.iso] = o; return o;
        });
        return { rows: rows, pin: pin, byIso: byIso };
      });
      countriesP.catch(function () { countriesP = null; });
    }
    return countriesP;
  }
  function sortPinned(items, pinIso, isoOf) {
    var rank = {}; pinIso.forEach(function (c, i) { rank[c] = i; });
    var top = [], rest = [];
    items.forEach(function (it) { (rank[isoOf(it)] != null ? top : rest).push(it); });
    top.sort(function (a, b) { return rank[isoOf(a)] - rank[isoOf(b)]; });
    rest.sort(function (a, b) { return cmp(a.p, b.p); });
    return top.concat(rest);
  }
  var countryItemsP, natItemsP, profItemsP;
  function countryItems() {
    return countryItemsP || (countryItemsP = loadCountries().then(function (d) {
      return sortPinned(d.rows.map(function (c) {
        var it = item(AR ? c.ar : c.en, AR ? c.ar : c.en, AR ? c.en : c.ar, c.en + " " + c.ar + " " + c.iso); it.iso = c.iso; return it;
      }), d.pin, function (it) { return it.iso; });
    }).catch(function (e) { countryItemsP = null; throw e; }));
  }
  function natItems() {
    return natItemsP || (natItemsP = loadCountries().then(function (d) {
      var rows = d.rows.filter(function (c) { return c.nEn; });
      return sortPinned(rows.map(function (c) {
        var it = item(AR ? c.nAr : c.nEn, AR ? c.nAr : c.nEn, AR ? c.nEn : c.nAr, c.nEn + " " + c.nAr + " " + c.en + " " + c.ar); it.iso = c.iso; return it;
      }), d.pin, function (it) { return it.iso; });
    }).catch(function (e) { natItemsP = null; throw e; }));
  }
  function profItems() {
    return profItemsP || (profItemsP = getJSON("professions.json").then(function (d) {
      return d.p.map(function (r) { return item(AR ? r[1] : r[0], AR ? r[1] : r[0], AR ? r[0] : r[1], r[0] + " " + r[1]); })
        .sort(function (a, b) { return cmp(a.p, b.p); });
    }).catch(function (e) { profItemsP = null; throw e; }));
  }
  function cityItems(iso) {
    return getJSON("cities/" + iso + ".json").then(function (rows) {
      return rows.map(function (r) {
        var en = typeof r === "string" ? r : r[0], ar = typeof r === "string" ? "" : r[1];
        var p = AR ? (ar || en) : en, s = AR ? (ar ? en : "") : (ar || "");
        return item(p, p, s, en + " " + ar);
      });
    });
  }

  /* ---------- القائمة المنسدلة ---------- */
  var uid = 0;
  function coarse() { try { return window.matchMedia("(pointer:coarse)").matches; } catch (e) { return false; } }
  function makeCombo(input, cfg) {
    var id = "bpl" + (++uid);
    var wrap = document.createElement("div"); wrap.className = "bpl-wrap";
    var list = document.createElement("div"); list.className = "bpl-list"; list.id = id; list.setAttribute("role", "listbox"); list.hidden = true;
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input); wrap.appendChild(list);
    input.setAttribute("autocomplete", "off"); input.setAttribute("autocapitalize", "off"); input.setAttribute("spellcheck", "false");
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", id); input.setAttribute("aria-expanded", "false");
    input.setAttribute("enterkeyhint", "done");
    if (cfg.placeholder) input.placeholder = cfg.placeholder;

    var items = [], loaded = false, loading = false, failed = false, shown = [], limit = 80, active = -1, open = false, gen = 0;
    var api = { input: input, wrap: wrap, reset: reset, items: function () { return items; }, refresh: refresh };

    function reset() { gen++; items = []; loaded = false; loading = false; failed = false; }
    function ensure() {
      if (loaded || loading) return;
      var g = gen; loading = true; failed = false;
      render();
      Promise.resolve(cfg.load()).then(function (r) { if (g !== gen) return; items = r || []; loaded = true; loading = false; render(); },
        function () { if (g !== gen) return; loading = false; failed = true; items = []; loaded = true; render(); });
    }
    function matches(q) {
      var toks = norm(q).split(" ").filter(Boolean);
      if (!toks.length) return items;
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i], ok = true;
        for (var j = 0; j < toks.length; j++) if (it.k.indexOf(toks[j]) < 0) { ok = false; break; }
        if (!ok) continue;
        var sc = it.pk.indexOf(toks[0]) === 0 ? 0 : (it.k.indexOf(toks[0]) === 0 || it.k.indexOf(" " + toks[0]) >= 0 ? 1 : 2);
        out.push({ it: it, sc: sc, i: i });
      }
      out.sort(function (a, b) { return a.sc - b.sc || a.i - b.i; });
      return out.map(function (x) { return x.it; });
    }
    function place() {
      var r = input.getBoundingClientRect(), vv = window.visualViewport;
      var vh = vv ? vv.height : window.innerHeight, top0 = vv ? vv.offsetTop : 0;
      var below = top0 + vh - r.bottom - 10, above = r.top - top0 - 70;
      var up = below < 210 && above > below;
      var room = Math.max(150, Math.min(300, up ? above : below));
      list.style.maxHeight = room + "px";
      list.classList.toggle("bpl-up", up);
    }
    function render() {
      if (!open) return;
      var h = "";
      if (cfg.gate && cfg.gate()) {
        h = '<div class="bpl-note">' + esc(cfg.gate()) + "</div>";
        shown = [];
      } else if (loading || !loaded) {
        h = '<div class="bpl-note">' + esc(T.loading) + "</div>"; shown = [];
      } else {
        var all = matches(input.value);
        shown = all.slice(0, limit);
        if (active >= shown.length) active = shown.length - 1;
        shown.forEach(function (it, i) {
          h += '<div class="bpl-opt' + (i === active ? " on" : "") + '" role="option" id="' + id + "o" + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '">' +
            '<span class="p">' + esc(it.p) + "</span>" + (it.s ? '<span class="s">' + esc(it.s) + "</span>" : "") + "</div>";
        });
        if (!all.length) h += '<div class="bpl-note">' + esc(T.none) + "</div>";
        else if (all.length > shown.length) h += '<div class="bpl-note bpl-more">' + esc(T.more) + "</div>";
      }
      if (cfg.other) h += '<div class="bpl-opt bpl-other" role="option" data-other="1">' + esc(cfg.other) + "</div>";
      list.innerHTML = h;
      place();
    }
    function show() {
      if (open) return;
      open = true; limit = 80; active = -1; list.hidden = false; input.setAttribute("aria-expanded", "true");
      ensure(); render();
    }
    function hide() {
      if (!open) return;
      open = false; list.hidden = true; active = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant");
    }
    function pick(it) {
      input.value = it.v; hide();
      if (coarse()) input.blur();
      if (cfg.onPick) cfg.onPick(it);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function pickOther() {
      input.value = ""; hide();
      if (cfg.typePlaceholder) input.placeholder = cfg.typePlaceholder;
      if (cfg.onFree) cfg.onFree("");
      input.focus();
    }
    function refresh() { if (open) render(); }
    function move(d) {
      if (!open) { show(); return; }
      if (!shown.length) return;
      active = active < 0 ? (d > 0 ? 0 : shown.length - 1) : Math.max(0, Math.min(shown.length - 1, active + d));
      if (active >= shown.length - 3 && limit < 1e5) { limit += 80; render(); }
      var opts = list.querySelectorAll(".bpl-opt[data-i]");
      for (var i = 0; i < opts.length; i++) { var on = i === active; opts[i].classList.toggle("on", on); opts[i].setAttribute("aria-selected", on); }
      var el = opts[active]; if (el) { input.setAttribute("aria-activedescendant", el.id); if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); }
    }
    // يطابق ما كُتب مطابقةً تامة مع عنصر فيُثبَّت بصيغته المعيارية (دولة/جنسية/مدينة)
    function snap() {
      var q = norm(input.value);
      if (!q || !loaded) return null;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.pk === q || norm(it.s) === q) { if (input.value !== it.v) input.value = it.v; return it; }
      }
      return null;
    }
    api.snap = snap;

    input.addEventListener("focus", function () { show(); });
    input.addEventListener("click", function () { show(); });
    input.addEventListener("input", function () {
      limit = 80; active = -1; if (!open) show(); else { ensure(); render(); }
      list.scrollTop = 0;
      if (cfg.onFree) cfg.onFree(input.value);
    });
    input.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowDown") { e.preventDefault(); move(1); }
      else if (k === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (k === "Enter") { e.preventDefault(); if (open && active >= 0 && shown[active]) pick(shown[active]); else hide(); }
      else if (k === "Escape") { if (open) { e.preventDefault(); hide(); } }
      else if (k === "Tab") { hide(); }
    });
    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.activeElement === input) return;
        hide();
        var hit = snap();
        if (hit && cfg.onPick) cfg.onPick(hit);
        else if (cfg.onMiss) cfg.onMiss(input.value);
      }, 120);
    });
    // mousedown لا يسحب التركيز من الحقل؛ الاختيار على click فلا يلتقط التمرير باللمس خطأً
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });
    list.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest(".bpl-opt") : null;
      if (!el) return;
      if (el.getAttribute("data-other")) { pickOther(); return; }
      var it = shown[+el.getAttribute("data-i")]; if (it) pick(it);
    });
    list.addEventListener("scroll", function () {
      if (list.scrollTop + list.clientHeight > list.scrollHeight - 80 && shown.length >= limit) { limit += 80; render(); }
    });
    document.addEventListener("click", function (e) { if (open && !wrap.contains(e.target)) hide(); });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { if (open) place(); });
    window.addEventListener("resize", function () { if (open) place(); });
    return api;
  }

  /* ---------- التركيب على النموذج ---------- */
  function fresh(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var wrap = el.parentNode;
    // main.js يلفّ الحقل بقائمته القصيرة عند DOMContentLoaded — نستبدل اللفّ كله بحقلٍ نظيف
    if (wrap && wrap.classList && wrap.classList.contains("bp-combo-wrap")) {
      var clean = el.cloneNode(false);
      wrap.parentNode.replaceChild(clean, wrap);
      return clean;
    }
    return el;
  }

  function init() {
    var fCountry = fresh("c-country"), fCity = fresh("c-city"), fNat = fresh("c-nationality"), fProf = fresh("c-field");
    if (!fCountry && !fCity && !fNat && !fProf) return;
    injectCss();
    var iso = "", cityCombo = null;

    function setIso(next) {
      if (next === iso) return;
      var had = iso; iso = next || "";
      if (fCountry) fCountry.setAttribute("data-iso", iso);
      if (cityCombo) {
        cityCombo.reset();
        // مدينة اختيرت من دولةٍ سابقة لا تصحّ للدولة الجديدة — تُفرَّغ. أما من كتب مدينته قبل دولته فلا نمسحها.
        if (had && fCity && fCity.value) fCity.value = "";
        fCity.placeholder = iso ? T.phCity : T.phCityFirst;
        cityCombo.refresh();
      }
    }

    if (fCountry) {
      makeCombo(fCountry, {
        placeholder: T.phCountry, other: T.otherCountry, typePlaceholder: T.typeCountry, load: countryItems,
        onPick: function (it) { setIso(it.iso || ""); },
        onFree: function (v) { if (!v) setIso(""); },
        onMiss: function () { setIso(""); }
      });
      // الاسم مكتوب مسبقاً (مثلاً من حفظ المتصفح): حمّل الدول بصمتٍ لنعرف الرمز
      if (fCountry.value) countryItems().then(function (list) {
        var q = norm(fCountry.value);
        for (var i = 0; i < list.length; i++) if (list[i].pk === q || norm(list[i].s) === q) { fCountry.value = list[i].v; setIso(list[i].iso); break; }
      }, function () {});
    }
    if (fCity) {
      cityCombo = makeCombo(fCity, {
        placeholder: T.phCityFirst, other: T.otherCity, typePlaceholder: T.typeCity,
        gate: function () { return iso ? "" : T.needCountry; },
        load: function () { return iso ? cityItems(iso) : Promise.resolve([]); }
      });
    }
    if (fNat) makeCombo(fNat, { placeholder: T.phNat, other: T.otherNat, typePlaceholder: T.typeNat, load: natItems });
    if (fProf) makeCombo(fProf, { placeholder: T.phProf, other: T.otherProf, typePlaceholder: T.typeProf, load: profItems });
  }

  function injectCss() {
    if (document.getElementById("bpl-css")) return;
    var s = document.createElement("style"); s.id = "bpl-css";
    s.textContent =
      ".bpl-wrap{position:relative}" +
      ".bpl-list{scroll-padding-bottom:48px;position:absolute;z-index:60;top:calc(100% + 4px);inset-inline:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:var(--white,#fff);border:1px solid var(--gray-line,#E4E7F0);border-radius:14px;box-shadow:0 14px 36px rgba(11,27,90,.16);text-align:start}" +
      ".bpl-list.bpl-up{top:auto;bottom:calc(100% + 4px)}" +
      ".bpl-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:9px 14px;font-size:.95rem;line-height:1.45;color:var(--text,#1F2430);cursor:pointer;border-bottom:1px solid rgba(228,231,240,.6)}" +
      ".bpl-opt .p{min-width:0;overflow-wrap:anywhere}" +
      ".bpl-opt .s{flex:none;max-width:46%;font-size:.78rem;color:var(--text-soft,#4a4f5e);opacity:.78;direction:ltr;text-align:end;overflow-wrap:anywhere}" +
      "html[dir=ltr] .bpl-opt .s{direction:rtl}" +
      ".bpl-opt:hover,.bpl-opt.on{background:var(--gray-bg,#F5F6FA)}" +
      ".bpl-opt.on{box-shadow:inset 3px 0 0 var(--navy,#0B1B5A)}" +
      "[dir=rtl] .bpl-opt.on{box-shadow:inset -3px 0 0 var(--navy,#0B1B5A)}" +
      ".bpl-other{position:sticky;bottom:0;background:#fff;color:var(--navy,#0B1B5A);font-weight:600;border-top:1px solid var(--gray-line,#E4E7F0);border-bottom:0;border-radius:0 0 13px 13px}" +
      ".bpl-note{padding:12px 14px;font-size:.84rem;color:var(--text-soft,#4a4f5e);line-height:1.6}" +
      ".bpl-more{text-align:center;opacity:.8;padding:8px 14px}" +
      "@media (max-width:640px){.bpl-opt{min-height:48px;font-size:1rem}.bpl-opt .s{max-width:40%}}";
    document.head.appendChild(s);
  }

  // بعد معالجات DOMContentLoaded في main.js (سجّلت قبلنا) كي نستبدل قوائمها لا العكس.
  if (document.readyState === "complete") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
