/* bp-i18n — display-layer Arabic→English translation for the app-style pages
   (owner panels + the hiring console's dynamic content). It never touches the
   app's logic or data: it only rewrites what is shown — text nodes, common
   attributes and the document title — using an exact-phrase dictionary plus a
   few numeric composition rules, and keeps watching the DOM so content that
   JavaScript renders later gets translated too. Strings missing from the
   dictionary simply stay Arabic.

   Usage: <script src="/assets/js/bp-i18n.js" defer
            data-mode="auto|always"     auto = only when bp_lang==='en'
            data-toggle="1">            render a floating EN/ع toggle
          </script> */
(function () {
  "use strict";
  var me = document.currentScript;
  if (!me) return;
  var MODE = me.getAttribute("data-mode") || "auto";
  var WANT_TOGGLE = me.getAttribute("data-toggle") === "1";
  var LANG_KEY = "bp_lang";
  function pref() { try { return localStorage.getItem(LANG_KEY) || ""; } catch (e) { return ""; } }
  function setPref(v) { try { localStorage.setItem(LANG_KEY, v); } catch (e) {} }

  var active = MODE === "always" || pref() === "en";

  // Floating toggle for owner panels (the hiring console has its own).
  if (WANT_TOGGLE) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = active ? "ع" : "EN";
    b.title = active ? "العربية" : "English";
    b.setAttribute("style", "position:fixed;bottom:14px;inset-inline-start:14px;z-index:99999;width:40px;height:40px;border-radius:50%;border:1px solid #d6dbeb;background:#0B1B5A;color:#fff;font-weight:800;font-size:.8rem;cursor:pointer;box-shadow:0 4px 14px rgba(11,27,90,.25)");
    b.addEventListener("click", function () { setPref(active ? "ar" : "en"); location.reload(); });
    (document.body || document.documentElement).appendChild(b);
  }

  if (!active) return;

  var EXACT = null, RULES = [];
  var AR_RE = /[؀-ۿ]/;

  function tr(s) {
    if (!s || !AR_RE.test(s)) return null;
    var core = s.trim();
    if (!core) return null;
    var hit = EXACT[core];
    if (hit == null) {
      for (var i = 0; i < RULES.length; i++) {
        if (RULES[i][0].test(core)) { hit = core.replace(RULES[i][0], RULES[i][1]); break; }
      }
    }
    if (hit == null || hit === core) return null;
    // preserve surrounding whitespace
    var lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    return lead + hit + tail;
  }

  var ATTRS = ["placeholder", "title", "aria-label", "alt", "data-badge"];
  function elAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (v) { var t = tr(v); if (t != null) el.setAttribute(ATTRS[i], t); }
    }
    if ((el.tagName === "INPUT" && /^(button|submit)$/i.test(el.type || "")) && el.value) {
      var tv = tr(el.value); if (tv != null) el.value = tv;
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { var t = tr(root.nodeValue); if (t != null) root.nodeValue = t; return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      var tag = root.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return;
      elAttrs(root);
    }
    var w = document.createTreeWalker(root, 5 /* elements+text */, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        var p = n.parentNode && n.parentNode.tagName;
        if (p === "SCRIPT" || p === "STYLE" || p === "TEXTAREA") continue;
        var tt = tr(n.nodeValue);
        if (tt != null) n.nodeValue = tt;
      } else if (n.nodeType === 1) {
        if (n.tagName === "SCRIPT" || n.tagName === "STYLE") continue;
        // TEXTAREA: translate its attributes (placeholder…) but never its value.
        elAttrs(n);
      }
    }
  }

  function start() {
    var dt = tr(document.title); if (dt != null) document.title = dt;
    walk(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData") { var t = tr(m.target.nodeValue); if (t != null) m.target.nodeValue = t; }
        else if (m.type === "childList") { for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]); }
        else if (m.type === "attributes" && m.target.nodeType === 1) elAttrs(m.target);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  fetch("/assets/data/i18n-ar-en.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      EXACT = d.exact || {};
      RULES = (d.rules || []).map(function (r) { return [new RegExp(r[0]), r[1]]; });
      if (document.body) start();
      else document.addEventListener("DOMContentLoaded", start);
    })
    .catch(function () {});
})();
