/* Business Partner — وضع الإتاحة (Accessibility). يُحمَّل `defer` في كل صفحة عامة.
 *
 * ما يفعله:
 *  1) زرّ «إتاحة» ثابت + لوحة (حوار غير مُقيِّد: لا فخّ تركيز، Esc يغلق).
 *  2) يحفظ الاختيارات في localStorage (مفتاح bp_a11y) داخل try/catch، ويطبّقها بسماتٍ
 *     data-bpa-* على <html> (بنفس أسماء السكربت المضمَّن في <head> الذي يسبق الرسم).
 *  3) قراءة الصفحة/المحدَّد بصوتٍ عالٍ عبر Web Speech (speechSynthesis).
 *  4) «الصوت أولاً»: يعيد استعمال ميكروفون المستشار الذكي الموجود في الرئيسية
 *     (#sv1Mic) — لا تسجيل ولا تفريغ ثانٍ هنا — فيرسل الكلام بعد تفريغه ويقرأ الرد.
 *  5) شبكة أمان للإتاحة: يسمّي الحقول التي بلا اسم، ويجهّز مناطق الأخطاء للإعلان،
 *     ويُغلق القائمة المنسدلة بـEsc. هذه ترقيعٌ وقت التشغيل؛ الإصلاح الأصيل في
 *     ملف كل صفحة عند صاحبها.
 * لا يعتمد على أي مكتبة، ولا يرسل أي بيانات إلى أي خادم. */
(function () {
  "use strict";
  if (window.__bpa) return;
  window.__bpa = 1;
  var D = document, H = D.documentElement, KEY = "bp_a11y";
  var AR = /^ar/i.test(H.getAttribute("lang") || "");

  /* ------------------------------------------------------------------ النصوص */
  // [عربي, English] — fr/zh تعرض الإنجليزية.
  var T = {
    fab: ["إتاحة", "Accessibility"],
    fabHint: ["قائمة الإتاحة (Alt+Shift+A)", "Accessibility menu (Alt+Shift+A)"],
    title: ["أدوات الإتاحة", "Accessibility tools"],
    close: ["إغلاق", "Close"],
    intro: ["اضبط الموقع ليناسبك. تُحفظ اختياراتك على جهازك فقط.", "Adjust the site to suit you. Your choices are saved on this device only."],
    gText: ["النص", "Text"],
    size: ["حجم النص", "Text size"],
    s0: ["عادي", "Normal"], s1: ["كبير", "Large"], s2: ["كبير جداً", "Extra large"],
    spacing: ["تباعد أكبر بين الأسطر والكلمات", "More space between lines and words"],
    font: ["خط سهل القراءة (يساعد مع عسر القراءة)", "Easy-to-read font (helps with dyslexia)"],
    gDisplay: ["الألوان والعرض", "Colours and display"],
    contrast: ["تباين عالٍ", "High contrast"],
    dark: ["الوضع الداكن", "Dark mode"],
    links: ["تمييز الروابط والحالات (بلا اعتماد على اللون وحده)", "Underline links and mark states (not by colour alone)"],
    cursor: ["مؤشر كبير", "Large cursor"],
    focus: ["تمييز واضح للعنصر المُركَّز عليه", "Strong focus outline"],
    gMotion: ["الحركة والصور", "Motion and images"],
    motion: ["إيقاف الحركة والتمرير التلقائي", "Stop animations and automatic scrolling"],
    imgs: ["إخفاء الصور الزخرفية", "Hide decorative images"],
    gRead: ["القراءة بصوتٍ عالٍ", "Read aloud"],
    readPage: ["اقرأ الصفحة", "Read the page"],
    readSel: ["اقرأ النص المحدَّد", "Read selected text"],
    pause: ["إيقاف مؤقت", "Pause"], resume: ["متابعة", "Resume"], stop: ["إيقاف", "Stop"],
    speed: ["سرعة القراءة", "Reading speed"],
    r0: ["بطيئة", "Slow"], r1: ["عادية", "Normal"], r2: ["سريعة", "Fast"],
    readNote: ["تعمل بأصوات جهازك. إن كنت تستخدم قارئ شاشة فلا حاجة لها.", "Uses your device's voices. If you use a screen reader you don't need this."],
    noTTS: ["متصفحك لا يدعم القراءة الصوتية.", "Your browser does not support speech."],
    noVoice: ["لا يوجد صوت لهذه اللغة على جهازك؛ ثبّت صوتاً من إعدادات النظام.", "No voice for this language was found on your device; install one in system settings."],
    reading: ["جارٍ القراءة…", "Reading…"],
    paused: ["متوقّفة مؤقتاً", "Paused"],
    done: ["انتهت القراءة", "Finished reading"],
    nothing: ["لا يوجد نص للقراءة.", "There is no text to read."],
    selFirst: ["حدّد نصاً في الصفحة أولاً ثم اضغط الزر.", "Select some text on the page first, then press the button."],
    gVoice: ["الصوت أولاً", "Voice first"],
    voice: ["وضع الصوت أولاً", "Voice-first mode"],
    voiceHelp: ["يرسل كلامك إلى المستشار الذكي تلقائياً بعد تفريغه، ويقرأ لك رده بصوتٍ عالٍ.", "Sends what you say to the smart advisor automatically once it is transcribed, and reads its reply aloud."],
    voiceGo: ["تحدّث مع المستشار الذكي الآن", "Talk to the smart advisor now"],
    voiceReady: ["اضغط زر الميكروفون وتحدّث، ثم اضغط عليه ثانيةً لإنهاء التسجيل.", "Press the microphone button and speak, then press it again to finish."],
    voiceOpen: ["فُتح المستشار الذكي. اضغط الميكروفون وتحدّث.", "The smart advisor is open. Press the microphone and speak."],
    keys: ["اختصارات", "Shortcuts"],
    kOpen: ["فتح القائمة", "open menu"], kRead: ["قراءة الصفحة", "read page"], kVoice: ["التحدث مع المستشار", "talk to the advisor"], kEsc: ["إغلاق أو إيقاف القراءة", "close, or stop reading"],
    reset: ["إعادة الضبط", "Reset all"],
    statement: ["بيان الإتاحة", "Accessibility statement"],
    on: ["مفعّل", "On"], off: ["متوقف", "Off"],
    nowOn: ["تم التفعيل: ", "Turned on: "], nowOff: ["تم الإيقاف: ", "Turned off: "],
    resetDone: ["أُعيدت كل الإعدادات إلى الوضع الافتراضي.", "All settings were reset to default."],
    skip: ["تخطَّ إلى المحتوى", "Skip to content"],
    remove: ["حذف", "Remove"],
    editable: ["بند قابل للتعديل", "Editable item"],
    chat: ["محادثة المستشار الذكي", "Smart advisor conversation"],
    sent: ["أُرسل: ", "Sent: "]
  };
  function tx(k) { var e = T[k]; return e ? (AR ? e[0] : e[1]) : k; }

  /* ------------------------------------------------------------------- الحالة */
  var DEF = { zoom: 0, spacing: 0, font: 0, contrast: 0, theme: "", links: 0, cursor: 0, focus: 0, motion: 0, imgs: 0, voice: 0, rate: 1 };
  var FLAGS = ["zoom", "spacing", "font", "contrast", "theme", "links", "cursor", "focus", "motion", "imgs", "voice"];
  var S = load();
  function load() {
    var o = {}, k;
    for (k in DEF) o[k] = DEF[k];
    try {
      var r = JSON.parse(localStorage.getItem(KEY) || "null");
      if (r && typeof r === "object") {
        for (k in DEF) if (r[k] != null && typeof r[k] === typeof DEF[k]) o[k] = r[k];
      }
    } catch (e) {}
    if (o.theme !== "dark") o.theme = "";
    if (!(o.zoom >= 0 && o.zoom <= 2)) o.zoom = 0;
    if ([0.85, 1, 1.2].indexOf(o.rate) < 0) o.rate = 1;
    return o;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  var fontLoaded = false;
  function loadFonts() {
    if (fontLoaded) return;
    fontLoaded = true;
    try {
      var l = D.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Readex+Pro:wght@300..700&display=swap";
      D.head.appendChild(l);
    } catch (e) {}
  }
  function apply() {
    FLAGS.forEach(function (k) {
      var v = S[k];
      if (v) H.setAttribute("data-bpa-" + k, String(v)); else H.removeAttribute("data-bpa-" + k);
    });
    if (S.font) loadFonts();
    syncUI();
  }

  /* ------------------------------------------------------------ أدوات صغيرة */
  function el(tag, attrs, kids) {
    var n = D.createElement(tag), k;
    if (attrs) for (k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(typeof c === "string" ? D.createTextNode(c) : c); });
    return n;
  }
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="7.2" r="1.3" fill="currentColor" stroke="none"/><path d="M6.8 10.2l5.2.9 5.2-.9"/><path d="M12 11.1v3.4"/><path d="M12 14.5l-2.4 4.2M12 14.5l2.4 4.2"/></svg>';

  var root, fab, panel, live, toast, toastT, titleEl, statEl, pauseBtn, readBtn, selBtn, stopBtn;
  var ctl = []; // {node, kind:'sw'|'seg', key, val}

  function announce(msg) {
    if (!live) return;
    live.textContent = "";
    setTimeout(function () { live.textContent = msg; }, 30);
  }
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.hidden = true; }, 7000);
  }
  function stat(msg) { if (statEl) statEl.textContent = msg || ""; }

  function curVal(key) { return key === "dark" ? (S.theme === "dark" ? 1 : 0) : S[key]; }
  function setVal(key, v, label) {
    if (key === "dark") S.theme = v ? "dark" : ""; else S[key] = v;
    save(); apply();
    if (label) announce((v ? tx("nowOn") : tx("nowOff")) + label);
  }
  function syncUI() {
    ctl.forEach(function (c) {
      if (c.kind === "sw") {
        var on = !!curVal(c.key);
        c.node.setAttribute("aria-checked", on ? "true" : "false");
        c.st.textContent = on ? tx("on") : tx("off");
      } else {
        c.node.setAttribute("aria-pressed", String(curVal(c.key)) === String(c.val) ? "true" : "false");
      }
    });
  }

  /* --------------------------------------------------------------- بناء اللوحة */
  function sw(key, label, helpId, helpText) {
    var st = el("span", { class: "bpa-st", "aria-hidden": "true" }, [tx("off")]);
    var b = el("button", { type: "button", class: "bpa-sw", role: "switch", "aria-checked": "false" }, [el("span", null, [label]), st]);
    if (helpId) b.setAttribute("aria-describedby", helpId);
    b.addEventListener("click", function () { setVal(key, curVal(key) ? 0 : 1, label); });
    ctl.push({ node: b, st: st, kind: "sw", key: key });
    var wrap = D.createDocumentFragment();
    wrap.appendChild(b);
    if (helpId && helpText) wrap.appendChild(el("p", { class: "bpa-help", id: helpId }, [helpText]));
    return wrap;
  }
  function seg(key, labelId, opts) {
    var g = el("div", { class: "bpa-seg", role: "group", "aria-labelledby": labelId });
    opts.forEach(function (o) {
      var b = el("button", { type: "button", "aria-pressed": "false", "aria-label": o[2] || o[1] }, [o[1]]);
      b.addEventListener("click", function () {
        S[key] = o[0]; save(); apply();
        if (key === "zoom") announce(tx("size") + ": " + (o[2] || o[1]));
        if (key === "rate") announce(tx("speed") + ": " + (o[2] || o[1]));
      });
      ctl.push({ node: b, kind: "seg", key: key, val: o[0] });
      g.appendChild(b);
    });
    return g;
  }
  function act(label, cls, fn) {
    var b = el("button", { type: "button", class: "bpa-act" + (cls ? " " + cls : "") }, [label]);
    b.addEventListener("click", fn);
    return b;
  }
  function group(title, children) {
    var f = el("fieldset", { class: "bpa-g" }, [el("legend", null, [title])]);
    children.forEach(function (c) { f.appendChild(c); });
    return f;
  }

  function build() {
    root = el("div", { class: "bpa-ui", id: "bpaRoot" });
    fab = el("button", { type: "button", class: "bpa-fab", id: "bpaFab", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "bpaPanel", title: tx("fabHint") });
    fab.innerHTML = ICON;
    fab.appendChild(el("span", { class: "bpa-fab-t" }, [tx("fab")]));
    fab.setAttribute("aria-label", tx("fab"));
    fab.addEventListener("click", function () { panel.hidden ? openPanel() : closePanel(true); });

    panel = el("section", { class: "bpa-panel", id: "bpaPanel", role: "dialog", "aria-modal": "false", "aria-labelledby": "bpaTitle", hidden: "" });
    titleEl = el("h2", { id: "bpaTitle", tabindex: "-1" }, [tx("title")]);
    var x = el("button", { type: "button", class: "bpa-x", "aria-label": tx("close") }, ["×"]);
    x.addEventListener("click", function () { closePanel(true); });
    panel.appendChild(el("div", { class: "bpa-hd" }, [titleEl, x]));

    var body = el("div", { class: "bpa-body" });
    body.appendChild(el("p", { class: "bpa-intro" }, [tx("intro")]));

    // النص
    var sizeLbl = el("span", { id: "bpaSizeL", class: "bpa-gt" }, [tx("size")]);
    body.appendChild(group(tx("gText"), [
      sizeLbl,
      seg("zoom", "bpaSizeL", [[0, "A", tx("s0")], [1, "A+", tx("s1")], [2, "A++", tx("s2")]]),
      el("div", { style: "height:8px" }),
      sw("spacing", tx("spacing")),
      sw("font", tx("font"))
    ]));
    // الألوان
    body.appendChild(group(tx("gDisplay"), [
      sw("contrast", tx("contrast")), sw("dark", tx("dark")), sw("links", tx("links")),
      sw("cursor", tx("cursor")), sw("focus", tx("focus"))
    ]));
    // الحركة والصور
    body.appendChild(group(tx("gMotion"), [sw("motion", tx("motion")), sw("imgs", tx("imgs"))]));
    // القراءة بصوتٍ عالٍ
    readBtn = act(tx("readPage"), "pri", function () { readPage(); });
    selBtn = act(tx("readSel"), "", function () { readSelection(); });
    pauseBtn = act(tx("pause"), "", function () { togglePause(); });
    stopBtn = act(tx("stop"), "", function () { stopSpeech(true); });
    pauseBtn.disabled = true; stopBtn.disabled = true;
    var rateL = el("span", { id: "bpaRateL", class: "bpa-gt", style: "margin-top:10px" }, [tx("speed")]);
    statEl = el("p", { class: "bpa-stat", role: "status", "aria-live": "polite" });
    var rd = [
      el("p", { class: "bpa-help" }, [tx("readNote")]),
      el("div", { class: "bpa-row" }, [readBtn, selBtn]),
      el("div", { class: "bpa-row", style: "margin-top:8px" }, [pauseBtn, stopBtn]),
      rateL,
      seg("rate", "bpaRateL", [[0.85, tx("r0")], [1, tx("r1")], [1.2, tx("r2")]]),
      statEl
    ];
    if (!SPEAK) { readBtn.disabled = selBtn.disabled = true; stat(tx("noTTS")); }
    body.appendChild(group(tx("gRead"), rd));
    // الصوت أولاً
    var goBtn = act(tx("voiceGo"), "pri", function () { goVoice(); });
    goBtn.style.width = "100%";
    body.appendChild(group(tx("gVoice"), [sw("voice", tx("voice"), "bpaVoiceH", tx("voiceHelp")), goBtn]));
    // الاختصارات
    var keys = el("p", { class: "bpa-keys" });
    keys.innerHTML = "<strong>" + tx("keys") + ":</strong><br><kbd>Alt+Shift+A</kbd> " + tx("kOpen") + " · <kbd>Alt+Shift+R</kbd> " + tx("kRead") + " · <kbd>Alt+Shift+V</kbd> " + tx("kVoice") + " · <kbd>Esc</kbd> " + tx("kEsc");
    body.appendChild(keys);
    panel.appendChild(body);

    var pre = prefix();
    var ft = el("div", { class: "bpa-ft" }, [
      act(tx("reset"), "", function () {
        stopSpeech(false);
        for (var k in DEF) S[k] = DEF[k];
        save(); apply(); announce(tx("resetDone"));
      }),
      el("a", { href: (pre ? pre : "") + "/accessibility" }, [tx("statement")])
    ]);
    panel.appendChild(ft);

    live = el("div", { class: "bpa-live", role: "status", "aria-live": "polite", "aria-atomic": "true" });
    toast = el("div", { class: "bpa-toast", role: "status", hidden: "" });
    root.appendChild(fab); root.appendChild(panel); root.appendChild(live); root.appendChild(toast);
    // مبكراً في الـDOM: يصله مستخدم الكيبورد وقارئ الشاشة بعد رابط التخطّي مباشرةً.
    var skip = D.querySelector(".bpa-skip");
    if (skip && skip.parentNode === D.body) skip.insertAdjacentElement("afterend", root); else D.body.insertBefore(root, D.body.firstChild);
    syncUI();
  }
  function prefix() {
    var m = /^\/(ar|fr|zh)(\/|$)/.exec(location.pathname);
    return m ? "/" + m[1] : "";
  }

  function openPanel() {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    setTimeout(function () { try { titleEl.focus({ preventScroll: true }); } catch (e) {} }, 0);
  }
  function closePanel(refocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    if (refocus) { try { fab.focus(); } catch (e) {} }
  }

  /* -------------------------------------------------- القراءة بصوتٍ عالٍ (TTS) */
  var synth = window.speechSynthesis;
  var SPEAK = !!(synth && window.SpeechSynthesisUtterance);
  var voices = [], Q = [], qi = 0, token = 0, speaking = false, isPaused = false, mark = null, lastSel = "";
  function loadVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  if (SPEAK) {
    loadVoices();
    try { synth.addEventListener("voiceschanged", loadVoices); } catch (e) { synth.onvoiceschanged = loadVoices; }
  }
  var TAGS = { ar: "ar-SA", en: "en-US", fr: "fr-FR", zh: "zh-CN" };
  function pageTag() { return TAGS[(H.getAttribute("lang") || "en").slice(0, 2).toLowerCase()] || "en-US"; }
  function guessTag(text) {
    var a = (text.match(/[؀-ۿ]/g) || []).length, c = (text.match(/[一-鿿]/g) || []).length, n = text.length || 1;
    if (a / n > 0.25) return "ar-SA";
    if (c / n > 0.25) return "zh-CN";
    var p = pageTag();
    return p === "ar-SA" ? "en-US" : p;
  }
  function voiceFor(tag) {
    var want = tag.toLowerCase(), pri = want.slice(0, 2), exact = null, loose = null;
    voices.forEach(function (v) {
      var l = String(v.lang || "").replace("_", "-").toLowerCase();
      if (l === want && !exact) exact = v; else if (l.slice(0, 2) === pri && !loose) loose = v;
    });
    return exact || loose || null;
  }
  function clearMark() { if (mark) { mark.classList.remove("bpa-reading"); mark = null; } }
  function setMark(n) {
    clearMark();
    if (!n || !n.classList) return;
    mark = n; n.classList.add("bpa-reading");
    try {
      var r = n.getBoundingClientRect();
      if (r.top < 70 || r.bottom > (window.innerHeight || 800) - 90) n.scrollIntoView({ block: "center", behavior: "auto" });
    } catch (e) {}
  }
  function setBusy(on) {
    speaking = on;
    if (pauseBtn) { pauseBtn.disabled = !on; stopBtn.disabled = !on; }
    if (!on) { isPaused = false; if (pauseBtn) pauseBtn.textContent = tx("pause"); }
  }
  function stopSpeech(say) {
    token++;
    try { if (SPEAK) synth.cancel(); } catch (e) {}
    Q = []; qi = 0; clearMark(); setBusy(false);
    if (say) stat("");
  }
  function splitText(text) {
    text = String(text).replace(/\s+/g, " ").trim();
    if (!text) return [];
    if (text.length <= 220) return [text];
    var parts = text.match(/[^.!?؟…؛;]+[.!?؟…؛;]*\s*/g) || [text], out = [], cur = "";
    parts.forEach(function (p) {
      if ((cur + p).length > 220 && cur) { out.push(cur.trim()); cur = p; } else cur += p;
    });
    if (cur.trim()) out.push(cur.trim());
    var fin = [];
    out.forEach(function (o) {
      while (o.length > 260) { var i = o.lastIndexOf(" ", 240); if (i < 80) i = 240; fin.push(o.slice(0, i)); o = o.slice(i).trim(); }
      if (o) fin.push(o);
    });
    return fin;
  }
  function runQueue(my) {
    if (my !== token) return;
    if (qi >= Q.length) { clearMark(); setBusy(false); stat(tx("done")); return; }
    var c = Q[qi];
    setMark(c.el);
    var u = new SpeechSynthesisUtterance(c.text), tag = c.tag || guessTag(c.text), v = voiceFor(tag);
    u.lang = tag; if (v) u.voice = v;
    u.rate = S.rate || 1;
    u.onend = function () { if (my !== token) return; qi++; runQueue(my); };
    u.onerror = function (e) { if (my !== token) return; if (e && (e.error === "canceled" || e.error === "interrupted")) return; qi++; runQueue(my); };
    if (voices.length && !v) stat(tx("noVoice")); else stat(tx("reading"));
    try { synth.speak(u); } catch (e) { setBusy(false); }
  }
  function startQueue(items) {
    if (!SPEAK) { stat(tx("noTTS")); return; }
    if (!items.length) { stat(tx("nothing")); announce(tx("nothing")); return; }
    stopSpeech(false);
    var my = token;
    Q = items; qi = 0; setBusy(true);
    // Chrome يُسقط speak() الذي يلي cancel() مباشرةً.
    setTimeout(function () { runQueue(my); }, 60);
  }
  function speakText(text, tagHint) {
    var items = splitText(text).map(function (t) { return { text: t, el: null, tag: tagHint || null }; });
    startQueue(items);
  }
  function visible(n) {
    try { if (n.checkVisibility) return n.checkVisibility({ visibilityProperty: true }); } catch (e) {}
    return !!(n.getClientRects && n.getClientRects().length);
  }
  function blockOf(n, rootEl) {
    var e = n;
    while (e && e !== rootEl) {
      var d = getComputedStyle(e).display;
      if (d.indexOf("inline") !== 0 && d !== "contents") break;
      e = e.parentElement;
    }
    return e || rootEl;
  }
  function pageBlocks(rootEl) {
    var out = [], map = new Map();
    var w = D.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest('script,style,noscript,template,svg,[aria-hidden="true"],.bpa-ui,[hidden],.sv1-hide')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      var b = blockOf(n.parentElement, rootEl);
      if (!visible(b)) continue;
      var rec = map.get(b);
      if (!rec) { rec = { el: b, text: "" }; map.set(b, rec); out.push(rec); }
      rec.text += " " + n.nodeValue;
    }
    var items = [];
    out.forEach(function (r) {
      splitText(r.text).forEach(function (t) { items.push({ text: t, el: r.el, tag: null }); });
    });
    return items;
  }
  function readPage() {
    var m = D.querySelector("main,[role=main]") || D.body;
    var items = pageBlocks(m);
    items.forEach(function (i) { i.tag = guessTag(i.text); });
    startQueue(items);
  }
  function readSelection() {
    var s = ""; try { s = String(window.getSelection() || "").trim(); } catch (e) {}
    if (!s) s = lastSel;
    if (!s) { stat(tx("selFirst")); announce(tx("selFirst")); return; }
    speakText(s);
  }
  function togglePause() {
    if (!SPEAK || !speaking) return;
    try {
      if (isPaused) { synth.resume(); isPaused = false; pauseBtn.textContent = tx("pause"); stat(tx("reading")); }
      else { synth.pause(); isPaused = true; pauseBtn.textContent = tx("resume"); stat(tx("paused")); }
    } catch (e) {}
  }
  D.addEventListener("selectionchange", function () {
    try {
      var s = window.getSelection(), t = String(s || "").trim();
      if (!t) return;
      var a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      if (a && a.closest && a.closest(".bpa-ui")) return;
      lastSel = t.slice(0, 4000);
    } catch (e) {}
  });
  window.addEventListener("pagehide", function () { try { if (SPEAK) synth.cancel(); } catch (e) {} });

  /* ------------------------------------------- الصوت أولاً + المستشار الذكي */
  function homeHref() { var p = prefix(); return p ? p + "/" : "/"; }
  function goVoice() {
    S.voice = 1; save(); apply();
    var mic = D.getElementById("sv1Mic");
    if (mic) {
      closePanel(false);
      var a = D.getElementById("advisor");
      try { if (a) a.scrollIntoView({ block: "start", behavior: "auto" }); } catch (e) {}
      try { mic.focus({ preventScroll: true }); } catch (e) {}
      announce(tx("voiceOpen"));
      // النقرة من ضغطة المستخدم نفسها، فيأذن المتصفح بالميكروفون.
      if (!mic.disabled && !mic.classList.contains("rec") && !mic.classList.contains("busy")) mic.click();
      return;
    }
    try { sessionStorage.setItem("bpa_go", "1"); } catch (e) {}
    location.href = homeHref() + "#advisor";
  }
  function watchAdvisor() {
    var box = D.getElementById("sv1Msgs");
    if (!box) return;
    // سماتٌ ودلالات للمحادثة نفسها.
    box.setAttribute("role", "log");
    box.setAttribute("aria-label", tx("chat"));
    box.setAttribute("aria-relevant", "additions");
    if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "0");
    var hint = D.querySelector(".sv1-composehint"), ta = D.getElementById("sv1In");
    if (hint && ta) { if (!hint.id) hint.id = "sv1ComposeHint"; ta.setAttribute("aria-describedby", hint.id); }
    var userSent = false;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1 || !n.classList || !n.classList.contains("sv1-msg")) return;
          if (n.classList.contains("u")) { userSent = true; return; }
          if (!userSent || !S.voice || !SPEAK) return;
          setTimeout(function () {
            if (!n.isConnected) return;
            var op = n.style && n.style.opacity;
            if (op && parseFloat(op) < 1) return; // «نرتّب طلبك…» مؤقتة
            speakText(n.textContent || "");
          }, 90);
        });
      });
    }).observe(box, { childList: true });

    // إرسال تلقائي بعد تفريغ الصوت (وضع الصوت أولاً). التفريغ نفسه في simple-v1.mjs.
    var mic = D.getElementById("sv1Mic"), form = D.getElementById("sv1Form");
    if (mic && ta && form) {
      var sawRec = false, sawBusy = false, before = "";
      new MutationObserver(function () {
        var r = mic.classList.contains("rec"), b = mic.classList.contains("busy");
        if (r) { if (!sawRec) before = ta.value; sawRec = true; try { if (SPEAK) synth.cancel(); } catch (e) {} stopSpeech(false); return; }
        if (b) { sawBusy = true; return; }
        if (sawRec && sawBusy) {
          sawRec = sawBusy = false;
          if (!S.voice) return;
          var tries = 0, ref = before;
          (function poll() {
            if (ta.value && ta.value !== ref) {
              var said = ta.value.slice(ref.length).trim() || ta.value;
              announce(tx("sent") + said);
              try { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); } catch (e) {}
              return;
            }
            if (++tries < 16) setTimeout(poll, 100);
          })();
          return;
        }
        sawRec = sawBusy = false;
      }).observe(mic, { attributes: true, attributeFilter: ["class"] });
    }
    // وصلتَ من صفحةٍ أخرى بزرّ «تحدّث مع المستشار».
    var go = null; try { go = sessionStorage.getItem("bpa_go"); sessionStorage.removeItem("bpa_go"); } catch (e) {}
    if (go && mic) {
      var a = D.getElementById("advisor");
      setTimeout(function () {
        try { if (a) a.scrollIntoView({ block: "start", behavior: "auto" }); mic.focus({ preventScroll: true }); } catch (e) {}
        announce(tx("voiceReady")); showToast(tx("voiceReady"));
      }, 350);
    }
  }

  /* ----------------------------------------------- شبكة أمان للأسماء والإعلان */
  var repairT = 0;
  function repair(scope) {
    scope = scope && scope.querySelectorAll ? scope : D;
    var q = function (s) { return scope.querySelectorAll(s); };
    // حقول بلا اسم: يُستعمل نص الـplaceholder أو العنوان.
    Array.prototype.forEach.call(q('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]),select,textarea'), function (i) {
      if (i.closest(".bpa-ui")) return;
      if (i.hasAttribute("aria-label") || i.hasAttribute("aria-labelledby")) return;
      if (i.labels && i.labels.length) return;
      var nm = i.getAttribute("placeholder") || i.getAttribute("title");
      if (nm) i.setAttribute("aria-label", nm);
    });
    // أزرار الحذف «×» بلا اسم.
    Array.prototype.forEach.call(q("button.del"), function (b) {
      if (!b.hasAttribute("aria-label") && !b.hasAttribute("title")) b.setAttribute("aria-label", tx("remove"));
    });
    // بنود النطاق القابلة للتحرير (div/b contenteditable).
    Array.prototype.forEach.call(q('[contenteditable="true"]:not([role])'), function (n) {
      n.setAttribute("role", "textbox");
      if (!n.hasAttribute("aria-label")) n.setAttribute("aria-label", tx("editable"));
    });
    // رموز الإيموجي الزخرفية.
    Array.prototype.forEach.call(q(".ico:not([aria-hidden])"), function (n) { n.setAttribute("aria-hidden", "true"); });
    // مناطق الأخطاء والحالات: تُجهَّز فارغةً ليُعلَن ما يُكتب فيها لاحقاً.
    Array.prototype.forEach.call(q('.sv1-err,.err,[id$="Err"],[id$="Error"]'), function (n) {
      if (n.hasAttribute("role") || n.hasAttribute("aria-live") || n.closest(".bpa-ui")) return;
      if (n.textContent.trim()) return;
      n.setAttribute("role", "alert");
    });
    Array.prototype.forEach.call(q(".sv1-ok,.ok"), function (n) {
      if (n.hasAttribute("role") || n.hasAttribute("aria-live") || n.closest(".bpa-ui")) return;
      if (n.textContent.trim()) return;
      n.setAttribute("role", "status");
    });
  }
  function scheduleRepair() {
    if (repairT) return;
    repairT = setTimeout(function () { repairT = 0; try { repair(D); } catch (e) {} }, 250);
  }

  /* ------------------------------------------- الحركة: التمرير السلس والفيديو */
  function reduced() {
    if (S.motion) return true;
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  (function patchScroll() {
    try {
      var si = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (a) {
        if (reduced() && a && typeof a === "object") { a = { block: a.block, inline: a.inline, behavior: "auto" }; }
        return si.call(this, a);
      };
      ["scrollTo", "scroll", "scrollBy"].forEach(function (m) {
        var f = window[m];
        if (typeof f !== "function") return;
        window[m] = function (a, b) {
          if (reduced() && a && typeof a === "object") { a = Object.assign({}, a, { behavior: "auto" }); }
          return f.call(window, a, b);
        };
      });
    } catch (e) {}
  })();
  function pauseMedia() {
    if (!reduced()) return;
    Array.prototype.forEach.call(D.querySelectorAll("video[autoplay]"), function (v) { try { v.removeAttribute("autoplay"); v.pause(); } catch (e) {} });
  }

  /* -------------------------------------------------------- لوحة المفاتيح */
  D.addEventListener("keydown", function (e) {
    var k = e.key;
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      var c = String(k).toLowerCase(), code = e.code;
      if (c === "a" || code === "KeyA") { e.preventDefault(); if (panel.hidden) { openPanel(); } else { closePanel(true); } return; }
      if (c === "r" || code === "KeyR") { e.preventDefault(); if (speaking) stopSpeech(true); else readPage(); return; }
      if (c === "v" || code === "KeyV") { e.preventDefault(); goVoice(); return; }
    }
    if (k !== "Escape" || e.defaultPrevented) return;
    if (!panel.hidden) { e.preventDefault(); closePanel(true); return; }
    if (speaking) { e.preventDefault(); stopSpeech(true); return; }
    var burger = D.getElementById("sv1Burger");
    if (burger && burger.getAttribute("aria-expanded") === "true") { burger.click(); try { burger.focus(); } catch (x) {} return; }
    var dt = D.querySelector("details.sv1-lang[open]");
    if (dt) { dt.removeAttribute("open"); var sm = dt.querySelector("summary"); if (sm) try { sm.focus(); } catch (x) {} }
  });
  // تُغلَق قائمة اللغة عند الخروج منها بالـTab أو النقر خارجها.
  D.addEventListener("click", function (e) {
    var dt = D.querySelector("details.sv1-lang[open]");
    if (dt && !dt.contains(e.target)) dt.removeAttribute("open");
  });

  /* ------------------------------------------------------------ رابط التخطّي */
  function wireSkip() {
    var skip = D.querySelector(".bpa-skip");
    if (!skip) return;
    var m = D.getElementById("bp-main");
    if (!m) {
      m = D.querySelector("main,[role=main]");
      if (m) { if (!m.id) m.id = "bp-main"; skip.setAttribute("href", "#" + m.id); }
    }
    if (!m) { skip.parentNode.removeChild(skip); return; }
    if (!m.hasAttribute("tabindex")) m.setAttribute("tabindex", "-1");
    skip.addEventListener("click", function (e) {
      e.preventDefault();
      try { m.focus({ preventScroll: true }); m.scrollIntoView({ block: "start", behavior: "auto" }); } catch (x) {}
    });
  }

  /* ---------------------------------------------------------------- الإقلاع */
  function init() {
    if (!D.body) return;
    build();
    apply();
    wireSkip();
    watchAdvisor();
    repair(D);
    pauseMedia();
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { scheduleRepair(); break; }
        }
      }).observe(D.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
})();
