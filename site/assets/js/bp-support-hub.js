/* Business Partner — مركز التواصل.
 *
 * زرٌّ عائم واحد يتوسّع إلى ثلاث قنوات:
 *   (أ) المستشار الذكي على واتساب  — رقم الوكيل الآلي (contact.whatsappAgent)
 *   (ب) فريقنا البشري على واتساب   — contact.whatsappSupport (يبقى ولا يُحذف)
 *   (ج) الدعم داخل الموقع          — أجوبة من الكتالوج، تتبّع الطلب، تذكرة، تحويل لإنسان
 *
 * الأرقام وساعات العمل تصل من الصفحة في window.BPS_CFG (يكتبها baher-support.mjs
 * من site/data/site.json عند البناء) — لا رقم مكتوب هنا.
 *
 * قواعد ثابتة:
 *  • الأسعار من site/assets/data/catalog.json حياً، لا من الذاكرة. وسياسة المالك
 *    (SHOW_PRICES=false): السعر للمسجَّل فقط ما لم يكن CFG.pricesPublic=true.
 *  • لا وعد بمواعيد ولا بنتائج حكومية. «المستشار الذكي» لا «الوكيل».
 *  • واتساب هنا (داخل الزر العائم) مسموح؛ داخل محتوى الصفحات لا.
 *  • كل نصٍّ يدخله الزائر يُكتب بـtextContent لا innerHTML.
 */
(function () {
  "use strict";
  if (window.__bpsHub) return;
  window.__bpsHub = 1;
  var CFG = window.BPS_CFG || {};
  var doc = document, root = doc.documentElement;
  var LANG = String(root.lang || "ar").slice(0, 2);
  var AR = LANG === "ar";
  var PRE = LANG === "en" ? "" : "/" + LANG;
  var T = function (a, e) { return AR ? a : e; };

  /* ------------------------------------------------------------ helpers -- */
  function h(tag, props, kids) {
    var el = doc.createElement(tag);
    props = props || {};
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v; // أيقونات ثابتة فقط
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? doc.createTextNode(c) : c); });
    return el;
  }
  var ICON = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.8c2 .7 3.2 2.4 3.2 5.2"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function ls(k, v) { return safe(function () { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); return v; }, null); }
  function post(url, body) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); });
  }
  // نفس طيّ الحروف العربية في api/_catalog.js حتى يطابق «الإقامة» و«اقامه».
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
      .replace(/[^ء-ي٠-٩a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  }
  var STOP = /^(كم|ما|ماذا|هو|هي|هل|عن|في|من|علي|الي|ابي|ابغي|اريد|اباء|سعر|اسعار|سعره|سعرها|تكلفه|تكلفة|تكاليف|خدمه|خدمات|خدمتكم|لو|سمحت|وش|ايش|شو|كيف|متي|how|much|what|is|the|a|an|of|for|price|prices|cost|service|services|do|you|have|about|me|my|i|need|want|and|or|to)$/;
  function tokens(q) {
    return norm(q).split(" ").map(function (w) { return w.length > 3 && w.indexOf("ال") === 0 ? w.slice(2) : w; })
      .filter(function (w) { return w.length >= 2 && !STOP.test(w); });
  }
  function fmtDate(iso) {
    return safe(function () { return new Date(iso).toLocaleDateString(AR ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" }); }, "");
  }
  function money(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function pageTitle() {
    var t = (doc.querySelector("h1") || {}).textContent || doc.title || "";
    return String(t).replace(/\s+/g, " ").replace(/\s*[—|-]\s*Business Partner.*$/i, "").trim().slice(0, 90);
  }
  function logicalPath() { return location.pathname.replace(/^\/(ar|fr|zh)(?=\/|$)/, "") || "/"; }
  function myHref(ref) { return PRE + "/my" + (ref ? "?ref=" + encodeURIComponent(ref) : ""); }

  /* ------------------------------------------------ ساعات الفريق البشري -- */
  var HR = CFG.hours || { tz: "Asia/Riyadh", days: [0, 1, 2, 3, 4], from: 9, to: 18 };
  var DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  var DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function riyadh() {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: HR.tz, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return { wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), h: Number(o.hour) % 24 };
  }
  function hh(n) { return AR ? (n > 12 ? n - 12 : n) + (n >= 12 ? " م" : " ص") : (n > 12 ? n - 12 : n) + (n >= 12 ? " PM" : " AM"); }
  function team() {
    var n = safe(riyadh, { wd: 0, h: 10 }), isOpen = HR.days.indexOf(n.wd) >= 0 && n.h >= HR.from && n.h < HR.to, next = "";
    if (!isOpen) {
      for (var d = 0; d < 8; d++) {
        var day = (n.wd + d) % 7;
        if (HR.days.indexOf(day) >= 0 && (d > 0 || n.h < HR.from)) {
          next = (d === 0 ? T("اليوم", "today") : d === 1 ? T("غداً", "tomorrow") : (AR ? DAYS_AR : DAYS_EN)[day]) + " " + hh(HR.from);
          break;
        }
      }
    }
    return { open: isOpen, next: next };
  }
  function hoursLine() {
    var first = (AR ? DAYS_AR : DAYS_EN)[HR.days[0]], last = (AR ? DAYS_AR : DAYS_EN)[HR.days[HR.days.length - 1]];
    return first + T(" – ", " – ") + last + " · " + hh(HR.from) + " – " + hh(HR.to);
  }

  /* --------------------------------------------------------- واتساب ----- */
  function wa(num, text) { return "https://wa.me/" + num + (text ? "?text=" + encodeURIComponent(text) : ""); }
  function ctxLine() { if (logicalPath() === "/") return T("الصفحة الرئيسية", "the home page"); var t = pageTitle(); return t ? t : location.pathname; }
  function agentText() { return T("مرحباً، أحتاج مساعدة بخصوص: «" + ctxLine() + "»", "Hi, I need help with: “" + ctxLine() + "”"); }
  function humanText(extra) {
    var l = [T("مرحباً فريق Business Partner، أحتاج التحدث مع موظف.", "Hello Business Partner team, I'd like to speak with a person.")];
    l.push(T("الصفحة: ", "Page: ") + ctxLine());
    l.push(location.origin + location.pathname);
    if (S.lastRef) l.push(T("رقم طلبي: ", "My reference: ") + S.lastRef);
    var qs = S.hist.filter(function (m) { return m.role === "user"; }).slice(-3).map(function (m) { return "- " + m.content.replace(/\s+/g, " ").slice(0, 110); });
    if (qs.length) { l.push(T("ما سألت عنه:", "What I asked:")); l = l.concat(qs); }
    if (extra) l.push(extra);
    return l.join("\n").slice(0, 900);
  }

  /* ----------------------------------------------------------- الحالة ---- */
  var S = { me: undefined, hist: [], busy: false, lastRef: "", sid: "", built: false, view: "home", prevFocus: null };
  S.sid = ls("bps_sid") || ("s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  ls("bps_sid", S.sid);
  var saved = safe(function () { return JSON.parse(ls("bps_hist") || "[]"); }, []);
  if (Array.isArray(saved)) S.hist = saved.filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"; }).slice(-14);
  S.lastRef = ls("bps_ref") || "";
  function persist() { ls("bps_hist", JSON.stringify(S.hist.slice(-14))); }
  function getMe() {
    if (S.me !== undefined) return Promise.resolve(S.me);
    if (S._mep) return S._mep;
    S._mep = post("/api/otp", { action: "me" }).then(function (o) {
      var u = o && o.session && o.session.user;
      S.me = u ? { name: u.full_name || "", email: u.email || "" } : null; return S.me;
    }).catch(function () { S.me = null; return null; });
    return S._mep;
  }
  function pricesOpen() { return !!(CFG.pricesPublic || S.me); }

  /* -------------------------------------------------------- الكتالوج ----- */
  var _cat, _svc;
  function getCatalog() {
    if (_cat) return _cat;
    _cat = fetch("/assets/data/catalog.json", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (c) {
      var items = [];
      (c.packages || []).forEach(function (p) {
        items.push({ kind: "pkg", code: p.code, ar: p.nameAr || "", en: p.nameEn || p.nameAr || "", cat: p.groupNameAr || "", catEn: p.groupNameEn || "", amount: p.amount, model: p.billingPeriod === "monthly" ? "Monthly" : "One Time", href: PRE + "/packages", gov: false, prop: p.amount == null });
      });
      (c.services || []).forEach(function (s) {
        var path = safe(function () { return new URL(s.url).pathname; }, "/services");
        items.push({ kind: "svc", code: s.code, ar: s.nameAr || "", en: s.nameEn || s.nameAr || "", cat: s.categoryAr || "", catEn: s.category || "", gov: !!s.govFeesSeparate, prop: !!s.requiresProposal, amount: s.amount, model: s.pricingModel, href: PRE + path, slug: path.split("/").pop(), plat: s.govPlatform || "" });
      });
      items.forEach(function (i) { i.n = norm([i.ar, i.en, i.cat, i.catEn, i.code, i.plat || ""].join(" ")); i.nn = norm(i.ar + " " + i.en); });
      return items;
    });
    return _cat;
  }
  function getServiceData() {
    if (_svc) return _svc;
    _svc = fetch("/data/services.json", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (j) {
      var m = {}; (Array.isArray(j) ? j : j.services || []).forEach(function (s) { m[s.code] = s; }); return m;
    }).catch(function () { return {}; });
    return _svc;
  }
  // مطابقة بالتغطية لا بوجود كلمة واحدة: «سوق» وحدها في «ما رأيكم في سوق الأسهم؟» لا
  // تكفي لعرض «استشارة دخول السوق». الكلمة التي تتكرر في أكثر من ٦٪ من الكتالوج
  // (سوق، شركة…) تزن ثلثاً، وتُقبل النتيجة إذا غطّت ٦٠٪ من وزن الاستعلام.
  function search(items, q, max) {
    var tk = tokens(q); if (!tk.length) return [];
    var cut = items.length * 0.06;
    var df = {}, w = {}, tot = 0;
    tk.forEach(function (t) {
      if (w[t] != null) return;
      df[t] = items.reduce(function (a, i) { return a + (i.n.indexOf(t) >= 0 ? 1 : 0); }, 0);
      w[t] = df[t] > cut ? 0.34 : 1; tot += w[t];
    });
    var res = items.map(function (i) {
      var got = 0, sc = 0;
      Object.keys(w).forEach(function (t) {
        if (i.nn.indexOf(t) >= 0) { got += w[t]; sc += 3 * w[t]; }
        else if (i.n.indexOf(t) >= 0) { got += w[t] * 0.5; sc += w[t]; }
      });
      if (i.code && norm(q).indexOf(norm(i.code)) >= 0) { got = tot; sc += 6; }
      return { i: i, s: sc, c: tot ? got / tot : 0 };
    }).filter(function (x) { return x.c >= 0.6 && x.s >= 0.9; }).sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, max || 4).map(function (x) { return x.i; });
  }
  function priceText(i) {
    if (i.amount == null || i.model === "Requires Proposal" || i.model === "Percent") return T("حسب عرض السعر", "Per quotation");
    var n = money(i.amount), base = AR ? n + " ﷼" : "SAR " + n;
    if (i.model === "Monthly") return base + T(" / شهرياً", " / month");
    if (i.model === "Starting From") return T("ابتداءً من ", "From ") + base;
    if (i.model === "Per Candidate") return base + T(" / مرشّح", " / candidate");
    return base;
  }
  function currentService(items) {
    var m = location.pathname.match(/\/services\/([^/?#]+)/);
    if (!m) return null;
    var slug = decodeURIComponent(m[1]).toLowerCase();
    for (var k = 0; k < items.length; k++) if (items[k].slug === slug) return items[k];
    return null;
  }

  /* ------------------------------------------------------ الحالات (طلب) -- */
  var ST = {
    NEW: ["جديد", "New", "", "استلمنا طلبك وهو بانتظار مراجعة الفريق.", "We received it and it is waiting for the team's review."],
    REVIEWING: ["قيد المراجعة", "Reviewing", "", "الفريق يراجع طلبك الآن.", "The team is reviewing it."],
    WAITING_CLIENT: ["بانتظار ردك", "Waiting for you", "w", "الفريق ينتظر ردّك — افتح الطلب وأجب.", "The team is waiting for your reply — open it and answer."],
    QUOTE_SENT: ["عرض سعر بانتظار اعتمادك", "Quote awaiting approval", "w", "عرض السعر جاهز وبانتظار اعتمادك في حسابك.", "Your quotation is ready and waiting for your approval."],
    QUOTE_APPROVED: ["العرض معتمد", "Quote approved", "g", "اعتمدت العرض؛ الخطوة التالية العقد.", "You approved it; the contract is next."],
    CONTRACT_SENT: ["عقد بانتظار توقيعك", "Contract awaiting signature", "w", "العقد جاهز وبانتظار توقيعك.", "The contract is ready for your signature."],
    SIGNED: ["موقّع — بانتظار الدفع", "Signed — payment due", "w", "وُقّع العقد؛ الخطوة التالية الدفع.", "Signed; payment is next."],
    PAYMENT_PENDING: ["بانتظار الدفع", "Payment pending", "w", "الدفع لم يكتمل بعد.", "Payment has not completed yet."],
    PAID: ["مدفوع", "Paid", "g", "وصل الدفع؛ ينتقل الطلب إلى التنفيذ.", "Payment received; the request moves to execution."],
    IN_PROGRESS: ["قيد التنفيذ", "In progress", "", "الطلب قيد التنفيذ.", "The request is being worked on."],
    WAITING_INTERNAL: ["قيد التنفيذ", "In progress", "", "الطلب قيد التنفيذ.", "The request is being worked on."],
    COMPLETED: ["مكتمل", "Completed", "g", "اكتمل الطلب.", "The request is complete."],
    CANCELLED: ["ملغي", "Cancelled", "r", "أُلغي الطلب.", "The request was cancelled."]
  };
  var TK = { NEW: ["استلمنا تذكرتك وسيردّ عليها الفريق ضمن ساعات الدوام.", "We received your ticket; the team will reply during working hours."], WAITING_CLIENT: ["ردّ الفريق وينتظر ردّك.", "The team replied and is waiting for you."], COMPLETED: ["أُغلقت التذكرة.", "The ticket is closed."] };
  function stInfo(item) {
    var s = ST[item.status] || ST.NEW;
    var next = item.kind === "ticket" && TK[item.status] ? TK[item.status][AR ? 0 : 1] : s[AR ? 3 : 4];
    return { label: s[AR ? 0 : 1], cls: s[2], next: next };
  }

  /* ----------------------------------------------------------- الواجهة --- */
  var wrap, fab, panel, scrim, msgsEl, toolsEl, inputEl, hdTitle, hdSub, views = {};
  function build() {
    if (S.built) return; S.built = true;
    var dir = AR ? "rtl" : "ltr";
    panel = h("section", { class: "bps-panel", id: "bpsPanel", role: "dialog", "aria-modal": "true", "aria-label": T("مركز التواصل", "Contact centre"), dir: dir });
    scrim = h("div", { class: "bps-scrim", dir: dir, onclick: function () { close(); } });
    hdTitle = h("b", { text: T("مركز التواصل", "Contact centre") });
    hdSub = h("small", {}, [h("i"), h("span", { text: T("المستشار الذكي متاح على مدار الساعة", "The smart advisor is available 24/7") })]);
    var hd = h("div", { class: "bps-hd" }, [
      h("button", { class: "bps-ib bps-back", type: "button", "aria-label": T("رجوع", "Back"), html: ICON.back, onclick: function () { show("home"); } }),
      h("img", { src: CFG.img || "/assets/img/baher.jpg", alt: "", width: "40", height: "40" }),
      h("div", { class: "bps-ht" }, [hdTitle, hdSub]),
      h("button", { class: "bps-ib", type: "button", "aria-label": T("إغلاق", "Close"), html: ICON.x, onclick: function () { close(); } })
    ]);
    views.home = buildHome();
    views.sent = h("div", { class: "bps-view" });
    views.chat = buildChat();
    panel.appendChild(hd);
    ["home", "sent", "chat"].forEach(function (k) { panel.appendChild(views[k]); });
    wrap.appendChild(scrim); wrap.appendChild(panel);
    panel.addEventListener("keydown", trap);
  }

  function channel(opts) {
    var el = h(opts.href ? "a" : "button", Object.assign({ class: "bps-ch", "data-ch": opts.key }, opts.href ? { href: opts.href, target: "_blank", rel: "noopener" } : { type: "button" }, { onclick: opts.onclick }), [
      h("span", { class: "bps-chi" + (opts.wa ? " bps-wa" : ""), html: opts.icon }),
      h("span", { class: "bps-cht" }, [h("span", { class: "bps-ctop" }, [h("b", { text: opts.title }), opts.tag ? opts.tag : null]), h("small", { text: opts.sub })]),
      h("span", { class: "bps-go", html: ICON.go })
    ]);
    return el;
  }

  var humanTag, humanSub, hoursNote;
  function buildHome() {
    humanTag = h("em", { class: "bps-tag" });
    humanSub = h("small");
    hoursNote = h("p", { class: "bps-note" });
    var A = channel({ key: "agent", href: wa(CFG.agent, agentText()), wa: true, icon: ICON.wa, title: T("المستشار الذكي على واتساب", "Smart advisor on WhatsApp"), sub: T("ردّ فوري على مدار الساعة — أسئلتك وبدء طلبك", "Instant replies around the clock — your questions and starting a request"), tag: h("em", { class: "bps-tag", text: "24/7" }), onclick: function () { sentView("agent"); } });
    var B = channel({ key: "human", href: wa(CFG.human, humanText()), wa: true, icon: ICON.team, title: T("تحدّث مع فريقنا على واتساب", "Chat with our team on WhatsApp"), sub: "", tag: humanTag, onclick: function () { sentView("human"); } });
    // أيقونة الفريق ليست واتساب: نزيل لون واتساب عنها حتى لا يتشابه (أ) و(ب).
    B.querySelector(".bps-chi").className = "bps-chi";
    B.querySelector(".bps-cht small").replaceWith(humanSub);
    var C = channel({ key: "site", icon: ICON.site, title: T("الدعم داخل الموقع", "Support on this site"), sub: T("أجوبة فورية · تتبّع طلبك · تذكرة دعم", "Instant answers · track your request · support ticket"), onclick: function () { show("chat"); } });
    return h("div", { class: "bps-view" }, [h("div", { class: "bps-home" }, [h("p", { class: "bps-lead", text: T("كيف تفضّل أن نخدمك؟", "How would you like us to help?") }), A, B, C, hoursNote])]);
  }
  function refreshTeam() {
    var t = team();
    humanTag.textContent = t.open ? T("متاح الآن", "Available now") : T("خارج الدوام", "Off hours");
    humanTag.className = "bps-tag" + (t.open ? "" : " bps-off");
    humanSub.textContent = T("فريق بشري · ", "Human team · ") + hoursLine();
    hoursNote.innerHTML = "";
    hoursNote.appendChild(doc.createTextNode(t.open
      ? T("فريقنا متاح الآن حتى " + hh(HR.to) + " (توقيت الرياض). ", "Our team is available now until " + hh(HR.to) + " (Riyadh time). ")
      : T("الفريق البشري خارج الدوام الآن ويعود " + t.next + " (توقيت الرياض). ", "The human team is off hours and returns " + t.next + " (Riyadh time). ")));
    hoursNote.appendChild(h("b", { text: T("المستشار الذكي متاح الآن على مدار الساعة.", "The smart advisor is available right now, around the clock.") }));
  }

  function sentView(which) {
    var t = team(), isAgent = which === "agent";
    var text = isAgent ? agentText() : humanText();
    var url = wa(isAgent ? CFG.agent : CFG.human, text);
    var v = views.sent; v.innerHTML = "";
    v.appendChild(h("div", { class: "bps-sent" }, [
      h("div", { class: "bps-ok", html: ICON.check }),
      h("h3", { text: isAgent ? T("فتحنا واتساب المستشار الذكي", "We opened the smart advisor on WhatsApp") : T("فتحنا واتساب فريقنا", "We opened our team's WhatsApp") }),
      h("p", { text: isAgent
        ? T("اكتب سؤالك هناك وسيردّ المستشار الذكي فوراً، في أي ساعة. إن لم تُفتح النافذة اضغط الزر أدناه.", "Ask your question there and the smart advisor replies instantly, at any hour. If nothing opened, tap the button below.")
        : (t.open ? T("رسالتك جاهزة — اضغط «إرسال» في واتساب. فريقنا متاح الآن.", "Your message is ready — tap Send in WhatsApp. Our team is available now.")
          : T("الفريق خارج الدوام الآن؛ تبقى رسالتك لديه ويقرؤها عند بدء الدوام (" + t.next + "). وتقدر تسأل المستشار الذكي الآن.", "The team is off hours; your message stays with them and they read it when hours start (" + t.next + "). You can ask the smart advisor now.")) }),
      h("p", { class: "bps-prevl", text: T("الرسالة الجاهزة", "Your ready message") }),
      h("div", { class: "bps-prev", text: text }),
      h("div", { class: "bps-acts" }, [
        h("a", { class: "bps-btn bps-wab", href: url, target: "_blank", rel: "noopener" }, [h("span", { html: ICON.wa }), h("span", { text: T("افتح واتساب مجدداً", "Open WhatsApp again") })]),
        isAgent || t.open ? null : h("a", { class: "bps-btn", href: wa(CFG.agent, agentText()), target: "_blank", rel: "noopener", text: T("اسأل المستشار الذكي الآن", "Ask the smart advisor now") }),
        h("button", { class: "bps-btn", type: "button", text: T("الدعم داخل الموقع بدلاً من ذلك", "Use on-site support instead"), onclick: function () { show("chat"); } }),
        h("button", { class: "bps-btn", type: "button", text: T("رجوع إلى القنوات", "Back to channels"), onclick: function () { show("home"); } })
      ])
    ]));
    show("sent");
  }

  function show(name) {
    S.view = name;
    Object.keys(views).forEach(function (k) { views[k].classList.toggle("bps-v", k === name); });
    panel.classList.toggle("bps-sub", name !== "home");
    panel.classList.toggle("bps-fit", name !== "chat");
    var sub = name === "chat" ? [T("الدعم داخل الموقع", "Support on this site"), T("إجابات فورية · بلا حاجة لتسجيل", "Instant answers · no sign-up needed")]
      : name === "sent" ? [T("تواصل عبر واتساب", "Contact on WhatsApp"), T("نافذة واتساب فُتحت في تبويب جديد", "WhatsApp opened in a new tab")]
      : [T("مركز التواصل", "Contact centre"), T("المستشار الذكي متاح على مدار الساعة", "The smart advisor is available 24/7")];
    hdTitle.textContent = sub[0]; hdSub.lastChild.textContent = sub[1];
    if (name === "home") refreshTeam();
    if (name === "chat") { startChat(); setTimeout(function () { inputEl && inputEl.focus(); }, 60); }
  }

  function open(view) {
    build();
    S.prevFocus = doc.activeElement;
    panel.classList.add("bps-on"); scrim.classList.add("bps-on"); fab.classList.add("bps-hide");
    fab.setAttribute("aria-expanded", "true");
    getMe();
    show(view || "home");
    var f = panel.querySelector(".bps-v a, .bps-v button, .bps-v input");
    if (f && S.view !== "chat") f.focus({ preventScroll: true });
  }
  function close() {
    if (!panel) return;
    panel.classList.remove("bps-on"); scrim.classList.remove("bps-on"); fab.classList.remove("bps-hide");
    fab.setAttribute("aria-expanded", "false");
    if (S.prevFocus && S.prevFocus.focus) S.prevFocus.focus({ preventScroll: true }); else fab.focus({ preventScroll: true });
  }
  function trap(e) {
    if (e.key !== "Tab") return;
    var f = [].slice.call(panel.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]):not(.bps-hp),textarea,select")).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------ الدعم داخل الموقع ---- */
  function buildChat() {
    msgsEl = h("div", { class: "bps-msgs", role: "log", "aria-live": "polite" });
    toolsEl = h("div", { class: "bps-tools" });
    inputEl = h("input", { type: "text", autocomplete: "off", placeholder: T("اكتب سؤالك…", "Type your question…"), "aria-label": T("رسالتك", "Your message"), maxlength: "500" });
    var form = h("form", { class: "bps-form", id: "bpsForm", onsubmit: function (e) { e.preventDefault(); var v = inputEl.value.trim(); if (!v || S.busy) return; inputEl.value = ""; ask(v); } }, [inputEl, h("button", { type: "submit", "aria-label": T("إرسال", "Send"), html: ICON.send })]);
    var foot = h("p", { class: "bps-foot", text: T("لا نَعِد بنتائج حكومية؛ السعر النهائي يؤكّده عرض السعر الرسمي. تُحفظ المحادثة لمتابعة طلبك.", "We do not promise government outcomes; the final price is confirmed by the official quotation. The conversation is kept to follow up your request.") });
    return h("div", { class: "bps-view" }, [msgsEl, toolsEl, form, foot]);
  }
  var started = false;
  function startChat() {
    if (started) { msgsEl.scrollTop = msgsEl.scrollHeight; return; }
    started = true;
    S.hist.forEach(function (m) { addMsg(m.content, m.role === "user" ? "bps-me" : "bps-bot"); });
    getMe().then(function (me) {
      var nm = me && me.name ? " " + me.name.split(" ")[0] : "";
      var g = addMsg(T("أهلاً بك" + nm + ". أنا المستشار الذكي من Business Partner. أجيب عن خدماتنا وأسعارها الحالية، وأتتبّع طلبك، وأفتح لك تذكرة، أو أحوّلك إلى فريقنا.", "Welcome" + (nm ? "," + nm : "") + ". I'm Business Partner's smart advisor. I answer about our services and current prices, track your request, open a ticket, or hand you to our team."), "bps-bot");
      suggestions(g);
    });
    drawTools();
  }
  function addMsg(text, cls) {
    var d = h("div", { class: "bps-m " + cls, text: text });
    msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d;
  }
  function addCard(node) {
    var d = h("div", { class: "bps-m bps-bot bps-card" }, [node]);
    msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d;
  }
  function down() { if (msgsEl) setTimeout(function () { msgsEl.scrollTop = msgsEl.scrollHeight; }, 30); }
  function chip(label, fn) { return h("button", { class: "bps-chip", type: "button", text: label, onclick: fn }); }
  function drawTools() {
    toolsEl.innerHTML = "";
    [["track", T("تتبّع طلبي", "Track my request")], ["ticket", T("افتح تذكرة", "Open a ticket")], ["human", T("حوّلني لإنسان", "Talk to a person")], ["hours", T("الدوام", "Hours")]].forEach(function (c) {
      toolsEl.appendChild(chip(c[1], function () { echo(c[1]); act(c[0]); }));
    });
  }

  // اقتراحات بحسب الصفحة — في صفحة الخدمة: ما المستندات؟ كم المدة؟
  function pageKind() {
    var p = logicalPath();
    if (/^\/services\/[^/]+/.test(p)) return "service";
    if (/^\/cart/.test(p)) return "cart";
    if (/^\/my(\/|$)/.test(p)) return "my";
    if (/^\/(catalog|services)\/?$/.test(p)) return "catalog";
    if (/^\/packages/.test(p)) return "packages";
    if (/^\/contact/.test(p)) return "contact";
    return p === "/" ? "home" : "other";
  }
  function suggestions(afterNode) {
    var k = pageKind(), list = [];
    if (k === "service") list = [[T("ما الذي تشمله هذه الخدمة؟", "What does this service include?"), "svc:include"], [T("كم سعرها؟", "How much is it?"), "svc:price"], [T("ما المستندات المطلوبة؟", "Which documents are needed?"), "svc:docs"], [T("كم تستغرق؟", "How long does it take?"), "svc:time"]];
    else if (k === "cart") list = [[T("كيف أُكمل الدفع؟", "How do I complete payment?"), "cart:pay"], [T("ملخّص سلتي", "My cart summary"), "cart:sum"], [T("واجهت مشكلة في الدفع", "I had a payment problem"), "ticket:payment"]];
    else if (k === "my") list = [[T("أين طلبي؟", "Where is my request?"), "track"], [T("ما معنى حالة طلبي؟", "What do the statuses mean?"), "status"], [T("لا أجد طلبي", "I can't find my request"), "ticket:order"]];
    else if (k === "packages") list = [[T("ما الفرق بين الباقات؟", "How do the packages differ?"), "text:الباقات"], [T("أي باقة تناسب شركتي؟", "Which package suits my company?"), "ticket:info"]];
    else if (k === "contact") list = [[T("أين مقرّكم؟", "Where are you based?"), "contact"], [T("ساعات العمل", "Working hours"), "hours"]];
    else list = [[T("ما الخدمات التي تقدّمونها؟", "What services do you offer?"), "cats"], [T("كم سعر تأسيس مؤسسة؟", "How much to register a sole proprietorship?"), "text:تأسيس مؤسسة فردية"], [T("أبحث عن خدمة", "I'm looking for a service"), "find"]];
    var box = h("div", { class: "bps-sugs" }, list.map(function (it) { return chip(it[0], function () { echo(it[0]); remember("user", it[0]); act(it[1]); }); }));
    afterNode.appendChild(box);
  }
  function echo(t) { addMsg(t, "bps-me"); }
  function bot(text) { var d = addMsg(text, "bps-bot"); return d; }
  function remember(role, content) { S.hist.push({ role: role, content: String(content).slice(0, 1500) }); S.hist = S.hist.slice(-14); persist(); }

  /* -------- توجيه ما يكتبه الزائر: النوايا القاطعة أولاً ثم الكتالوج ثم النموذج -------- */
  var REF_IN = /BP-(?:R|TKT)-[0-9A-Z]{6}/i;
  function ask(text) {
    echo(text); remember("user", text);
    var n = norm(text), rm = text.match(REF_IN);
    if (rm) return act("track:" + rm[0].toUpperCase());
    if (/تتبع|حاله (طلب|طلبي)|وين طلبي|اين طلبي|متابعه (طلب|طلبي)|track|where is my|my order status|request status/.test(n)) return act("track");
    if (/تذكره|شكوي|ابلاغ عن مشكله|ticket|complaint/.test(n)) return act("ticket");
    if (/موظف|انسان|شخص حقيقي|ممثل|اكلم|اتصل|مكالمه|human|real person|representative|speak (to|with)|call me|talk to/.test(n)) return act("human");
    if (/ساعات (العمل|الدوام)|الدوام|اوقات العمل|working hours|opening hours|business hours|are you open/.test(n)) return act("hours");
    if (/عنوان|مقركم|موقعكم|اين مقر|ايميل|بريدكم|address|where are you|your email/.test(n)) return act("contact");
    if (/سلتي|ملخص السله|اجمالي السله|my cart/.test(n)) return act("cart:sum");
    if (/معني حاله|ماذا تعني حاله|what does .* status/.test(n)) return act("status");
    act("text:" + text);
  }

  function act(a) {
    var parts = a.split(":"), k = parts[0], arg = parts.slice(1).join(":");
    if (k === "track") return trackFlow(arg);
    if (k === "ticket") return ticketFlow(arg);
    if (k === "human") return humanFlow();
    if (k === "hours") return hoursAnswer();
    if (k === "contact") return contactAnswer();
    if (k === "status") return statusAnswer();
    if (k === "find") { var b = bot(T("اكتب اسم الخدمة أو ما تريد إنجازه (مثل: تجديد إقامة، تأسيس شركة، قوى).", "Type the service or what you want done (e.g. residency renewal, company setup, Qiwa).")); inputEl.focus(); return b; }
    if (k === "cats") return catsAnswer();
    if (k === "cart") return cartAnswer(arg);
    if (k === "svc") return svcAnswer(arg);
    if (k === "text") return textAnswer(arg);
  }

  function hoursAnswer() {
    var t = team();
    var d = bot(T("الفريق البشري: " + hoursLine() + " (توقيت الرياض). " + (t.open ? "هو متاح الآن." : "هو خارج الدوام الآن ويعود " + t.next + ".") + "\nالمستشار الذكي متاح على مدار الساعة هنا وعلى واتساب.", "Human team: " + hoursLine() + " (Riyadh time). " + (t.open ? "Available now." : "Off hours now; back " + t.next + ".") + "\nThe smart advisor is available around the clock here and on WhatsApp."));
    d.appendChild(h("div", { class: "bps-sugs" }, [chip(T("حوّلني إلى إنسان", "Talk to a person"), function () { act("human"); })]));
  }
  function contactAnswer() {
    bot(T("العنوان: " + (CFG.address || "الدرعية، الرياض") + "\nالبريد: " + (CFG.email || "") + "\nواتساب الفريق: " + (CFG.humanLocal || ""), "Address: " + (CFG.addressEn || CFG.address || "Ad Diriyah, Riyadh") + "\nEmail: " + (CFG.email || "") + "\nTeam WhatsApp: " + (CFG.humanLocal || "")));
  }
  function statusAnswer() {
    var keys = ["NEW", "REVIEWING", "WAITING_CLIENT", "QUOTE_SENT", "CONTRACT_SENT", "PAID", "IN_PROGRESS", "COMPLETED"];
    var card = h("div", {}, [h("h4", { text: T("ماذا تعني حالة طلبك؟", "What your request status means") })].concat(keys.map(function (s) {
      var i = ST[s];
      return h("div", { class: "bps-row" }, [h("div", { class: "bps-rt" }, [h("b", { text: i[AR ? 0 : 1] }), h("small", { text: i[AR ? 3 : 4] })])]);
    })));
    addCard(card);
  }
  function catsAnswer() {
    getCatalog().then(function (items) {
      var seen = {}, cats = [];
      items.forEach(function (i) { if (i.kind === "svc" && i.cat && !seen[i.cat]) { seen[i.cat] = 1; cats.push(i); } });
      var d = bot(T("نغطّي " + cats.length + " مجالاً، منها: " + cats.slice(0, 8).map(function (c) { return c.cat; }).join("، ") + ". اكتب ما تحتاجه وأريك الخدمة وسعرها الحالي.", "We cover " + cats.length + " fields, including: " + cats.slice(0, 8).map(function (c) { return c.catEn; }).join(", ") + ". Tell me what you need and I'll show the service and its current price."));
      d.appendChild(h("div", { class: "bps-sugs" }, [h("a", { class: "bps-chip", href: PRE + "/catalog", text: T("تصفّح الكتالوج", "Browse the catalogue") })]));
    });
  }

  function loginChip() { return h("a", { class: "bps-chip", href: myHref(), text: T("سجّل الدخول لعرض الأسعار", "Sign in to see prices") }); }
  function serviceCard(list, query) {
    var open = pricesOpen();
    var rows = list.map(function (i) {
      var price = open ? h("span", { class: "bps-price", text: priceText(i) }) : h("span", { class: "bps-price bps-lock", text: T("السعر بعد الدخول", "Price after sign-in") });
      return h("div", { class: "bps-row" }, [
        h("div", { class: "bps-rt" }, [h("a", { href: i.href, style: "text-decoration:none" }, [h("b", { text: AR ? i.ar : i.en })]), h("small", { text: (AR ? i.cat : i.catEn) + (open && i.gov ? T(" · الرسوم الحكومية تُضاف", " · government fees extra") : "") })]),
        price
      ]);
    });
    var card = h("div", {}, [h("h4", { text: T("وجدت لك:", "Found for you:") })].concat(rows));
    var acts = h("div", { class: "bps-acts" }, []);
    if (!open) acts.appendChild(h("a", { class: "bps-btn", href: myHref(), text: T("سجّل الدخول لعرض السعر", "Sign in to see the price") }));
    acts.appendChild(h("a", { class: "bps-btn bps-pri", href: list[0].href, text: T("عرض الخدمة وابدأ الطلب", "View service & start a request") }));
    card.appendChild(acts);
    card.appendChild(h("p", { class: "bps-fine", text: open ? T("الأسعار من كتالوج الموقع الحالي. العرض الرسمي هو ما يُعتمد عند الطلب.", "Prices come from the current site catalogue. The official quotation is what applies once you order.") : T("أسعار الخدمات تظهر للمسجَّلين فقط. العرض الرسمي يصلك عند الطلب.", "Service prices are shown to signed-in clients only. You receive an official quotation when you order.") }));
    return card;
  }
  function textAnswer(q) {
    getCatalog().then(function (items) {
      var found = search(items, q, 4);
      if (found.length) { addCard(serviceCard(found, q)); remember("assistant", T("عرضت خدمات: ", "Showed services: ") + found.map(function (i) { return AR ? i.ar : i.en; }).join("، ")); return; }
      modelAnswer();
    }).catch(modelAnswer);
  }
  function svcAnswer(kind) {
    getCatalog().then(function (items) {
      var cur = currentService(items);
      if (!cur) return textAnswer(pageTitle());
      var name = AR ? cur.ar : cur.en;
      if (kind === "price") return addCard(serviceCard([cur], name));
      if (kind === "docs") return bot(T("المستندات تختلف بحسب حالتك (مثل السجل التجاري أو الهوية، ومستندات النشاط، وسداد الرسوم المقررة للجهة). عند بدء الطلب نؤكّد لك القائمة الدقيقة لحالتك.", "Documents depend on your case (for example the commercial register or ID, activity documents, and the government's prescribed fees). When you start the request we confirm the exact list for your case."));
      if (kind === "time") return bot(T("المدة تتوقف على الجهة الحكومية واكتمال مستنداتك، ولهذا لا نعطي موعداً ثابتاً مسبقاً. عند بدء الطلب يراجع المستشار حالتك ويوضّح لك الخطوات.", "Timing depends on the government entity and on your documents being complete, so we do not give a fixed date up front. When you start the request the advisor reviews your case and explains the steps."));
      return getServiceData().then(function (m) {
        var d = m[cur.code] || {}, dl = (d.deliverables || []).slice(0, 5);
        var card = h("div", {}, [h("h4", { text: name })]);
        if (d.description) card.appendChild(h("p", { text: String(d.description).slice(0, 260) + (String(d.description).length > 260 ? "…" : "") }));
        if (dl.length) { card.appendChild(h("p", { text: T("ما تحصل عليه:", "What you get:") })); card.appendChild(h("ul", { class: "bps-ul" }, dl.map(function (x) { return h("li", { text: x }); }))); }
        if (!d.description && !dl.length) card.appendChild(h("p", { text: T("تفاصيل هذه الخدمة في صفحتها أعلاه.", "This service's details are on its page above.") }));
        addCard(card);
      });
    });
  }
  function cartAnswer(kind) {
    if (kind === "pay") return bot(T("راجع بنود السلة ثم اضغط «أكمل إلى الدفع». تصلك فاتورتك الضريبية فور تأكيد الدفع. وإن تعثّر الدفع افتح تذكرة وسنتابعها معك.", "Review your cart and press “Continue to payment”. Your tax invoice arrives as soon as payment is confirmed. If payment fails, open a ticket and we will follow it up with you."));
    getMe().then(function (me) {
      var cart = safe(function () { return JSON.parse(localStorage.getItem("bp_cart")) || []; }, []);
      var n = cart.reduce(function (a, i) { return a + (Number(i.qty) || 1); }, 0);
      if (!n) return bot(T("سلتك فارغة الآن. تصفّح الكتالوج وأضف ما يناسبك.", "Your cart is empty. Browse the catalogue and add what suits you."));
      if (!me && !CFG.pricesPublic) {
        var d = bot(T("في سلتك " + n + " بند. الأسعار تظهر بعد تسجيل الدخول.", "Your cart has " + n + " item(s). Prices show after you sign in."));
        return d.appendChild(h("div", { class: "bps-sugs" }, [loginChip()]));
      }
      var sub = cart.reduce(function (a, i) { return a + (Number(i.amount) || 0) * (Number(i.qty) || 1); }, 0), vat = sub * 0.15;
      addCard(h("div", {}, [h("h4", { text: T("ملخّص سلتك", "Your cart summary") }),
        h("div", { class: "bps-row" }, [h("div", { class: "bps-rt" }, [h("b", { text: T("البنود", "Items") })]), h("span", { class: "bps-price", text: String(n) })]),
        h("div", { class: "bps-row" }, [h("div", { class: "bps-rt" }, [h("b", { text: T("المجموع (الأتعاب)", "Subtotal (fees)") })]), h("span", { class: "bps-price", text: money(sub) + (AR ? " ﷼" : " SAR") })]),
        h("div", { class: "bps-row" }, [h("div", { class: "bps-rt" }, [h("b", { text: T("ضريبة القيمة المضافة 15%", "VAT 15%") })]), h("span", { class: "bps-price", text: money(vat) + (AR ? " ﷼" : " SAR") })]),
        h("div", { class: "bps-row" }, [h("div", { class: "bps-rt" }, [h("b", { text: T("الإجمالي", "Total") })]), h("span", { class: "bps-price", text: money(sub + vat) + (AR ? " ﷼" : " SAR") })]),
        h("p", { class: "bps-fine", text: T("الرسوم الحكومية، إن وُجدت، منفصلة عن الأتعاب.", "Government fees, where they apply, are separate from our fees.") })]));
    });
  }

  /* ------------------------------------------------ النموذج (احتياطي) ---- */
  function modelAnswer() {
    var ty = addMsg(T("يكتب…", "Typing…"), "bps-bot bps-ty"); S.busy = true;
    var unavailable = function () {
      ty.remove();
      var d = bot(T("لم أجد جواباً مؤكّداً على هذا السؤال الآن. تقدر تفتح تذكرة ليردّ عليك الفريق، أو أحوّلك إلى إنسان.", "I couldn't find a confirmed answer to that right now. You can open a ticket for the team to answer, or I can connect you to a person."));
      d.appendChild(h("div", { class: "bps-sugs" }, [chip(T("افتح تذكرة", "Open a ticket"), function () { act("ticket"); }), chip(T("حوّلني إلى إنسان", "Talk to a person"), function () { act("human"); })]));
    };
    post("/api/chat", { messages: S.hist.slice(-12) }).then(function (d) {
      if (!d || !d.reply || d.error) return unavailable();
      ty.remove(); bot(d.reply); remember("assistant", d.reply); syncChat(false);
    }).catch(unavailable).then(function () { S.busy = false; });
  }
  // أرشفة المحادثة لفريق الدعم — كما كان الودجت القديم: صامتة، وتُشعر المالك فقط عند طلب إنسان وبوجود وسيلة تواصل.
  function syncChat(notify, contact) {
    var c = contact || (S.me ? { name: S.me.name, email: S.me.email } : null);
    if (!S.hist.length) return;
    post("/api/requests", { type: "advisor-chat", sid: S.sid, messages: S.hist.slice(-24), notify: !!(notify && c), contact: c }).catch(function () {});
  }

  /* ------------------------------------------------------ حوّلني لإنسان -- */
  function humanFlow() {
    var t = team();
    getMe().then(function (me) {
      var url = wa(CFG.human, humanText());
      var card = h("div", {}, [
        h("h4", { text: T("أحوّلك إلى فريقنا", "Connecting you to our team") }),
        h("p", { text: t.open ? T("فريقنا متاح الآن. جهّزتُ لك رسالة تلخّص ما سألت عنه وصفحتك الحالية.", "Our team is available now. I prepared a message summarising what you asked and your current page.") : T("الفريق خارج الدوام الآن ويعود " + t.next + ". رسالتك تبقى لديه، وتقدر أيضاً أن تفتح تذكرة هنا.", "The team is off hours now and returns " + t.next + ". Your message stays with them, and you can also open a ticket here.") }),
        h("div", { class: "bps-prev", text: humanText() }),
        h("div", { class: "bps-acts" }, [
          h("a", { class: "bps-btn bps-wab", href: url, target: "_blank", rel: "noopener", onclick: function () { syncChat(true); } }, [h("span", { html: ICON.wa }), h("span", { text: T("افتح واتساب الفريق", "Open the team's WhatsApp") })]),
          h("button", { class: "bps-btn", type: "button", text: T("أو افتح تذكرة", "Or open a ticket"), onclick: function () { act("ticket"); } })
        ])]);
      addCard(card);
    });
  }

  /* ---------------------------------------------------------- تتبّع طلبي -- */
  function itemCard(item, verified) {
    var si = stInfo(item), box = h("div", { class: "bps-trk" });
    box.appendChild(h("div", { class: "bps-row", style: "padding-top:0;border-top:0" }, [
      h("div", { class: "bps-rt" }, [h("small", {}, [h("span", { text: item.kind === "ticket" ? T("تذكرة", "Ticket") : T("طلب", "Request") }), doc.createTextNode(" · "), h("span", { class: "bps-ref", text: item.ref })]), h("b", { text: item.title })]),
      h("span", { class: "bps-pill " + (si.cls ? "bps-" + si.cls : ""), text: si.label })
    ]));
    box.appendChild(h("p", { text: si.next + (item.updated_at ? T(" · آخر تحديث ", " · Updated ") + fmtDate(item.updated_at) : "") }));
    if (item.appointment) box.appendChild(h("p", { text: T("الموعد: ", "Appointment: ") + item.appointment.date + " " + (item.appointment.time || "") }));
    if (item.last_team_message) box.appendChild(h("p", { text: T("آخر رد من الفريق: «", "Latest team reply: “") + item.last_team_message.content + "»" }));
    var acts = h("div", { class: "bps-acts" }, []);
    if (verified === "session") acts.appendChild(h("a", { class: "bps-btn bps-pri", href: myHref(item.ref), text: T("افتح التفاصيل", "Open details") }));
    else acts.appendChild(h("a", { class: "bps-btn bps-pri", href: myHref(item.ref), text: T("سجّل الدخول لرؤية التفاصيل والرد", "Sign in to see details and reply") }));
    acts.appendChild(h("button", { class: "bps-btn", type: "button", text: T("أحتاج مساعدة بخصوصه", "I need help with it"), onclick: function () { S.lastRef = item.ref; ls("bps_ref", item.ref); act("ticket:order:" + item.ref); } }));
    box.appendChild(acts);
    return box;
  }
  function trackFlow(prefRef) {
    getMe().then(function (me) {
      var res = h("div", { class: "bps-res" }), err = h("p", { class: "bps-err" });
      var refIn = h("input", { class: "bps-in", type: "text", placeholder: "BP-R-A1B2C3", dir: "ltr", autocomplete: "off", value: prefRef || "", "aria-label": T("رقم المرجع", "Reference number") });
      var emIn = me ? null : h("input", { class: "bps-in", type: "email", placeholder: T("البريد المسجَّل في الطلب", "The e-mail used on the request"), dir: "ltr", autocomplete: "email", "aria-label": T("البريد", "E-mail") });
      var go = h("button", { class: "bps-btn bps-pri", type: "submit", text: T("اعرض الحالة", "Show status") });
      function run(ref) {
        err.className = "bps-err"; res.innerHTML = ""; go.disabled = true;
        post("/api/simple", { action: "support-track", ref: ref || "", email: emIn ? emIn.value.trim() : "" }).then(function (o) {
          go.disabled = false; down();
          if (o.__status === 429) { err.textContent = T("محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.", "Too many attempts — wait a moment and try again."); err.className = "bps-err bps-show"; return; }
          if (o.needLogin) { err.textContent = T("لا أستطيع عرض طلباتك دون هويّتك. سجّل الدخول، أو أدخل رقم المرجع مع البريد المسجَّل.", "I can't list your requests without knowing who you are. Sign in, or enter a reference with the e-mail used on it."); err.className = "bps-err bps-show"; res.appendChild(h("div", { class: "bps-acts" }, [h("a", { class: "bps-btn", href: myHref(), text: T("تسجيل الدخول", "Sign in") })])); return; }
          if (o.mine) {
            if (!o.mine.length) { res.appendChild(h("p", { text: T("لا توجد طلبات على حسابك بعد.", "There are no requests on your account yet.") })); return; }
            S.lastRef = o.mine[0].ref; ls("bps_ref", S.lastRef);
            o.mine.forEach(function (it) { res.appendChild(itemCard(it, "session")); });
            if (o.total > o.mine.length) res.appendChild(h("p", { class: "bps-fine", text: T("عندك " + o.total + " طلباً؛ باقيها في حسابي.", "You have " + o.total + " requests; the rest are in your account.") }));
            return;
          }
          if (!o.found) { err.textContent = T("لم نجد طلباً بهذا الرقم مع هذا البريد. تأكد منهما، أو سجّل الدخول.", "We couldn't find a request with that number and e-mail. Check them, or sign in."); err.className = "bps-err bps-show"; return; }
          S.lastRef = o.item.ref; ls("bps_ref", S.lastRef); res.appendChild(itemCard(o.item, o.verified));
        }).catch(function () { go.disabled = false; err.textContent = T("تعذّر الاتصال الآن. جرّب لاحقاً أو تواصل مع الفريق.", "Couldn't connect right now. Try later or contact the team."); err.className = "bps-err bps-show"; });
      }
      var form = h("form", { onsubmit: function (e) { e.preventDefault(); var r = refIn.value.trim(); if (!r && !me) { err.textContent = T("أدخل رقم المرجع (BP-R-… أو BP-TKT-…).", "Enter the reference (BP-R-… or BP-TKT-…)."); err.className = "bps-err bps-show"; return; } run(r); } }, [
        h("p", { text: me ? T("أعرض لك آخر طلباتك، أو اكتب رقم مرجع محدّد.", "I'll show your latest requests, or type a specific reference.") : T("اكتب رقم المرجع والبريد المستخدم في الطلب. التفاصيل الكاملة تتطلب تسجيل الدخول.", "Enter the reference and the e-mail used on the request. Full details need sign-in.") }),
        h("label", { text: T("رقم المرجع", "Reference") }), refIn, emIn ? h("label", { text: T("البريد", "E-mail") }) : null, emIn, err, go
      ]);
      var card = h("div", {}, [h("h4", { text: T("تتبّع طلبك", "Track your request") }), form, res]);
      addCard(card);
      if (prefRef || me) run(prefRef || "");
      else setTimeout(function () { refIn.focus(); }, 50);
    });
  }

  /* ---------------------------------------------------------- افتح تذكرة -- */
  var CATS = [["order", "طلب قائم", "An existing request"], ["payment", "الدفع والفواتير", "Payment & invoices"], ["account", "الحساب والدخول", "Account & sign-in"], ["info", "استفسار", "A question"], ["other", "أخرى", "Other"]];
  function ticketFlow(arg) {
    var a = (arg || "").split(":"), cat = a[0] && a[0] !== "" ? a[0] : "", related = a[1] || S.lastRef || "";
    getMe().then(function (me) {
      var sel = h("select", { class: "bps-in", "aria-label": T("نوع التذكرة", "Ticket type") }, CATS.map(function (c) { return h("option", { value: c[0], text: c[AR ? 1 : 2] }); }));
      sel.value = cat || (pageKind() === "cart" ? "payment" : "info");
      var subj = h("input", { class: "bps-in", type: "text", maxlength: "160", placeholder: T("عنوان قصير للمشكلة", "A short title"), "aria-label": T("العنوان", "Title") });
      var det = h("textarea", { class: "bps-in", maxlength: "3000", placeholder: T("اشرح ما حدث وما تحتاجه…", "Describe what happened and what you need…"), "aria-label": T("التفاصيل", "Details") });
      var relIn = h("input", { class: "bps-in", type: "text", dir: "ltr", maxlength: "20", placeholder: T("رقم الطلب المتعلّق (اختياري) BP-R-…", "Related request (optional) BP-R-…"), value: related, "aria-label": T("الطلب المتعلّق", "Related request") });
      var nm = me ? null : h("input", { class: "bps-in", type: "text", maxlength: "120", placeholder: T("الاسم", "Name"), autocomplete: "name", "aria-label": T("الاسم", "Name") });
      var em = me ? null : h("input", { class: "bps-in", type: "email", dir: "ltr", maxlength: "160", placeholder: T("البريد (لتجد التذكرة في حسابك)", "E-mail (to find the ticket in your account)"), autocomplete: "email", "aria-label": T("البريد", "E-mail") });
      var ph = me ? null : h("input", { class: "bps-in", type: "tel", dir: "ltr", maxlength: "20", placeholder: T("الجوال 05XXXXXXXX (اختياري مع البريد)", "Mobile 05XXXXXXXX (optional with e-mail)"), autocomplete: "tel", "aria-label": T("الجوال", "Mobile") });
      var hp = h("input", { class: "bps-in bps-hp", type: "text", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", name: "website" });
      var err = h("p", { class: "bps-err" }), go = h("button", { class: "bps-btn bps-pri", type: "submit", text: T("أرسل التذكرة", "Send the ticket") });
      var box = h("div", {});
      var form = h("form", { onsubmit: function (e) {
        e.preventDefault(); err.className = "bps-err";
        var body = { action: "support-ticket-create", category: sel.value, subject: subj.value.trim(), details: det.value.trim(), related_ref: relIn.value.trim(), lang: LANG, page: location.pathname, sid: S.sid, convo: S.hist.slice(-10), hp: hp.value,
          name: nm ? nm.value.trim() : "", email: em ? em.value.trim() : "", phone: ph ? ph.value.trim() : "" };
        if (body.subject.length < 3 || body.details.length < 5) { err.textContent = T("اكتب عنواناً وتفاصيل قصيرة.", "Add a short title and some details."); err.className = "bps-err bps-show"; return; }
        if (!me && (body.name.length < 2 || !(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) || /^(?:\+?966|0)?5\d{8}$/.test(body.phone.replace(/\s/g, ""))))) { err.textContent = T("نحتاج اسمك وبريداً صحيحاً أو جوالاً سعودياً لنرد عليك.", "We need your name and a valid e-mail or Saudi mobile to reply."); err.className = "bps-err bps-show"; return; }
        go.disabled = true;
        post("/api/simple", body).then(function (o) {
          go.disabled = false;
          if (o.__status === 429) { err.textContent = T("أرسلت تذاكر كثيرة — انتظر قليلاً.", "Too many tickets — please wait a moment."); err.className = "bps-err bps-show"; return; }
          if (!o.ok) { err.textContent = T("تعذّر إرسال التذكرة الآن. تواصل مع الفريق على واتساب.", "Couldn't send the ticket right now. Contact the team on WhatsApp."); err.className = "bps-err bps-show"; return; }
          S.lastRef = o.ref; ls("bps_ref", o.ref); down();
          remember("assistant", T("فتحت لك التذكرة ", "Opened ticket ") + o.ref);
          var t = team();
          box.innerHTML = "";
          box.appendChild(h("h4", { text: T("وصلت تذكرتك ✓", "Your ticket is in ✓") }));
          box.appendChild(h("p", {}, [h("span", { class: "bps-big", text: o.ref })]));
          box.appendChild(h("p", { text: o.signedIn ? T("تجدها في حسابك: «طلباتي»، وتصلك الردود هناك وعلى بريدك.", "Find it in your account under “My requests”; replies arrive there and by e-mail.")
            : o.linked ? T("سجّل الدخول بالبريد " + body.email + " لتجدها في حسابك وتتابع الردود.", "Sign in with " + body.email + " to find it in your account and follow replies.")
            : T("سنتواصل معك على جوالك. احتفظ بالرقم لتتبّعها.", "We will contact you on your mobile. Keep the number to track it.") }));
          box.appendChild(h("p", { text: t.open ? T("الفريق متاح الآن وسيردّ عليها ضمن ساعات الدوام.", "The team is available now and replies within working hours.") : T("الفريق خارج الدوام ويعود " + t.next + ".", "The team is off hours and returns " + t.next + ".") }));
          box.appendChild(h("div", { class: "bps-acts" }, [h("a", { class: "bps-btn bps-pri", href: myHref(o.ref), text: o.signedIn ? T("افتح تذكرتي", "Open my ticket") : T("حسابي", "My account") }), h("button", { class: "bps-btn", type: "button", text: T("تتبّع هذه التذكرة", "Track this ticket"), onclick: function () { act("track:" + o.ref); } })]));
        }).catch(function () { go.disabled = false; err.textContent = T("تعذّر الاتصال الآن.", "Couldn't connect right now."); err.className = "bps-err bps-show"; });
      } }, [
        h("p", { text: T("سنفتح لك تذكرة برقم، يصل فريقنا إشعارها وتظهر في حسابك.", "We'll open a numbered ticket; the team is notified and it appears in your account.") }),
        h("label", { text: T("النوع", "Type") }), sel, subj, det, relIn, nm, em, ph, hp, err, go
      ]);
      box.appendChild(h("h4", { text: T("افتح تذكرة دعم", "Open a support ticket") })); box.appendChild(form);
      addCard(box); setTimeout(function () { subj.focus(); }, 50);
    });
  }

  /* ------------------------------------------------------------ الإقلاع -- */
  function init() {
    if (doc.getElementById("bpsFab")) return;
    wrap = h("div", { class: "bps-hub", dir: AR ? "rtl" : "ltr" });
    fab = h("button", { class: "bps-fab", id: "bpsFab", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "bpsPanel", "aria-label": T("افتح مركز التواصل", "Open the contact centre"), onclick: function () { open("home"); } }, [
      h("span", { class: "bps-av" }, [h("img", { src: CFG.img || "/assets/img/baher.jpg", alt: "", width: "38", height: "38" }), h("span", { class: "bps-dot" })]),
      h("span", { class: "bps-lbl", text: T("تواصل معنا", "Contact us") })
    ]);
    wrap.appendChild(fab);
    doc.body.appendChild(wrap);
    // ينكمش الزر إلى دائرة عند التمرير للأسفل، ويعود عند الصعود.
    var lastY = window.scrollY || 0, tick = false;
    window.addEventListener("scroll", function () {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0;
        fab.classList.toggle("bps-min", y > 90 && y > lastY);
        if (y < lastY - 6 || y < 90) fab.classList.remove("bps-min");
        lastY = y; tick = false;
      });
    }, { passive: true });
    // على الجوال يظهر الزر بعنوانه ست ثوانٍ (ليُعرف) ثم ينكمش إلى دائرة ويتركها صغيرة.
    if (window.innerWidth <= 560) setTimeout(function () { if (!panel || !panel.classList.contains("bps-on")) fab.classList.add("bps-min"); }, 6000);
    // أشرطة سفلية في الصفحات (صينية الكتالوج، صينية الرحلات، مرشّحات الوظائف على الجوال):
    // يرتفع الزر فوقها بدل أن يغطّي أزرارها. القياس من الشريط نفسه لا من رقمٍ ثابت.
    var BARS = [".sv1-tr-tray.on", ".sv1-tray", ".sv1-jbsel", "#coPayBar", ".bp-sticky-cta"];
    function lift() {
      var base = window.innerWidth <= 560 ? 14 : 18, up = 0;
      BARS.forEach(function (sel) {
        var el = doc.querySelector(sel); if (!el) return;
        var cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        var r = el.getBoundingClientRect();
        if (r.height > 0 && r.top < window.innerHeight && r.bottom >= window.innerHeight - 2) up = Math.max(up, window.innerHeight - r.top + 12);
      });
      fab.style.bottom = (base + up) + "px";
    }
    lift(); setInterval(lift, 800); window.addEventListener("resize", lift); window.addEventListener("scroll", lift, { passive: true });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && panel.classList.contains("bps-on")) close(); });
    // روابط الصفحة: #support أو ?support=1 تفتح المركز (للبريد والرسائل).
    if (/(^|[?&#])support(=1)?($|&)/.test(location.hash + location.search)) setTimeout(function () { open("home"); }, 300);
    window.BPSupport = { open: open, close: close, openChat: function () { open("chat"); } };
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})();
