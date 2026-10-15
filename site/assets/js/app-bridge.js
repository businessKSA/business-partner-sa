/* Business Partner — جسر التطبيق الأصلي (iOS / Android عبر Capacitor)
 *
 * يعمل **داخل التطبيق فقط**: إن لم يوجد window.Capacitor الأصلي ينتهي فوراً
 * ولا يغيّر شيئاً في الموقع العادي. يملكه وكيل `mobile-app`.
 * يُحمَّل من موضعين (قاعدة 2.6): SV1.shell() للموقع الجديد، وmain.js للقديم.
 *
 * ما يضيفه: شريط تبويب سفلي أصلي الشكل، اهتزاز لمسي، زر الرجوع في Android،
 * شريط «غير متصل»، ولافتة تفعيل الإشعارات (بعد تهيئة Firebase/APNs فقط).
 */
(function () {
  "use strict";
  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) return;
  if (window.__bpAppBridge) return;
  window.__bpAppBridge = true;

  var P = (cap.Plugins || {});
  var platform = (cap.getPlatform && cap.getPlatform()) || "native";
  var html = document.documentElement;
  html.classList.add("bp-native", "bp-" + platform);

  // ------------------------------------------------------------ لغة ومسار --
  var m = location.pathname.match(/^\/(ar|fr|zh)(\/|$)/);
  var prefix = m ? "/" + m[1] : "";
  var lang = m ? m[1] : (html.getAttribute("lang") || "ar").slice(0, 2);
  var rtl = (html.getAttribute("dir") || (lang === "ar" ? "rtl" : "ltr")) === "rtl";
  var path = location.pathname.replace(/^\/(ar|fr|zh)(?=\/|$)/, "") || "/";

  var L = {
    ar: { home: "الرئيسية", svc: "الخدمات", ask: "المستشار", cart: "السلة", me: "حسابي", off: "أنت غير متصل بالإنترنت", pushT: "فعّل الإشعارات لمتابعة طلباتك وعروضك", pushB: "تفعيل", pushX: "لاحقاً",
      abT: "عن التطبيق", abTerms: "الشروط والأحكام", abPriv: "سياسة الخصوصية", abContact: "تواصل معنا", abVer: "الإصدار", abDel: "طلب حذف الحساب",
      abDelQ: "سنفتح محادثة واتساب برسالة جاهزة لطلب حذف حسابك، ونتواصل معك لتأكيد الطلب. لا يُحذف شيء قبل تأكيدك.", abDelGo: "أرسل الطلب", abDelNo: "إلغاء",
      abDelMsg: "أرغب في حذف حسابي في تطبيق Business Partner." },
    en: { home: "Home", svc: "Services", ask: "Advisor", cart: "Cart", me: "Account", off: "You are offline", pushT: "Turn on notifications to follow your requests and quotes", pushB: "Enable", pushX: "Later",
      abT: "About the app", abTerms: "Terms and conditions", abPriv: "Privacy policy", abContact: "Contact us", abVer: "Version", abDel: "Request account deletion",
      abDelQ: "We will open a WhatsApp chat with a ready message asking to delete your account, then contact you to confirm. Nothing is deleted before you confirm.", abDelGo: "Send request", abDelNo: "Cancel",
      abDelMsg: "I would like to delete my account in the Business Partner app." },
    fr: { home: "Accueil", svc: "Services", ask: "Conseiller", cart: "Panier", me: "Compte", off: "Vous êtes hors ligne", pushT: "Activez les notifications pour suivre vos demandes", pushB: "Activer", pushX: "Plus tard" },
    zh: { home: "首页", svc: "服务", ask: "顾问", cart: "购物车", me: "我的", off: "您已离线", pushT: "开启通知以跟进您的请求", pushB: "开启", pushX: "稍后" },
  };
  var T = L[lang] || L.en;

  // ------------------------------------------------------------ أدوات --
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function tap(style) {
    if (P.Haptics && P.Haptics.impact) safe(function () { P.Haptics.impact({ style: style || "LIGHT" }); });
  }
  function ls(k, v) {
    return safe(function () { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); });
  }

  // ------------------------------------------------------------ نمط --
  var css = [
    ".bp-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:stretch;background:rgba(255,255,255,.96);",
    "-webkit-backdrop-filter:saturate(180%) blur(14px);backdrop-filter:saturate(180%) blur(14px);border-top:1px solid #E5E9F0;",
    "padding:6px 4px calc(6px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)));font-family:inherit}",
    ".bp-tab{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;",
    "color:#5A6478;text-decoration:none;font-size:11px;font-weight:600;line-height:1.1;-webkit-tap-highlight-color:transparent;position:relative}",
    ".bp-tab svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".bp-tab.on{color:#0B1B5A}.bp-tab.on svg{stroke-width:2.2}.bp-tab:active{opacity:.6}",
    ".bp-tab span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}",
    ".bp-tab i{position:absolute;top:2px;inset-inline-start:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;",
    "background:#0B1B5A;color:#fff;font:700 10px/16px inherit;font-style:normal;text-align:center}",
    "body.bp-has-tabbar{padding-bottom:calc(64px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))!important}",
    // الودجتان العائمان (واتساب .sv1-wa-fab والدعم #bpsFab/#bpsPanel) فوق الشريط لا خلفه.
    "body.bp-has-tabbar .sv1-wa-fab,body.bp-has-tabbar #bpsFab,body.bp-has-tabbar #bpsPanel{bottom:calc(76px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))!important}",
    ".bp-off{position:fixed;left:0;right:0;top:0;z-index:2147483001;background:#B45309;color:#fff;text-align:center;font:600 13px/1 inherit;",
    "padding:calc(8px + max(env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px))) 12px 8px;transform:translateY(-110%);transition:transform .2s}",
    ".bp-off.on{transform:none}",
    ".bp-push{position:fixed;left:12px;right:12px;bottom:calc(76px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)));z-index:2147482999;",
    "background:#0B1B5A;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;font:600 13.5px/1.5 inherit;",
    "box-shadow:0 12px 32px -8px rgba(11,27,90,.45)}.bp-push b{flex:1;font-weight:600}",
    ".bp-push button{border:0;border-radius:10px;min-height:36px;padding:0 14px;font:700 13px inherit;cursor:pointer}",
    ".bp-push .y{background:#fff;color:#0B1B5A}.bp-push .n{background:transparent;color:#C3CDE6}",
    ".bp-about{margin:24px 16px 96px;background:#fff;border:1px solid #E5E9F0;border-radius:16px;overflow:hidden;font-family:inherit;color:#232A3D}",
    ".bp-about h2{margin:0;padding:14px 16px 6px;font-size:13px;font-weight:600;color:#5A6478}",
    ".bp-about a,.bp-about button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:52px;padding:0 16px;border:0;border-top:1px solid #EBEFF7;background:none;",
    "color:inherit;font:600 15px inherit;text-decoration:none;text-align:start;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".bp-about a:active,.bp-about button:active{background:#F5F7FB}.bp-about .meta{display:block;padding:12px 16px 16px;border-top:1px solid #EBEFF7;font-size:12.5px;color:#8D97AE;line-height:1.7}",
    ".bp-about .del{color:#B42318}.bp-about svg{width:18px;height:18px;stroke:#8D97AE;fill:none;stroke-width:2;flex:none}",
    "[dir=rtl] .bp-about svg{transform:scaleX(-1)}",
    ".bp-sheet{position:fixed;inset:0;z-index:2147483002;background:rgba(11,27,90,.45);display:flex;align-items:flex-end}",
    ".bp-sheet>div{width:100%;background:#fff;border-radius:20px 20px 0 0;padding:20px 20px calc(20px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)));color:#232A3D;font-family:inherit}",
    ".bp-sheet p{margin:0 0 16px;font-size:15px;line-height:1.7}.bp-sheet .row{display:flex;gap:10px}",
    ".bp-sheet a,.bp-sheet button{flex:1;min-height:50px;border-radius:14px;border:0;font:700 15px inherit;display:grid;place-items:center;text-decoration:none;cursor:pointer}",
    ".bp-sheet .go{background:#B42318;color:#fff}.bp-sheet .no{background:#EEF2FB;color:#0B1B5A}",
    "html.bp-native{-webkit-touch-callout:none}html.bp-native body{-webkit-user-select:auto;overscroll-behavior-y:none}",
    // تطبيق لا موقع: لا فوتر (روابط الشركة والحقوق) داخل التطبيق؛ الشريط السفلي هو التنقل.
    "html.bp-native footer.sv1-foot,html.bp-native .sv1-foot{display:none!important}",
    "html.bp-native .bp-web-only,html.bp-native [data-web-only]{display:none!important}",
  ].join("");
  var st = document.createElement("style");
  st.id = "bp-app-style";
  st.textContent = css;
  (document.head || html).appendChild(st);

  // ------------------------------------------------------------ شريط التبويب --
  var ICON = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
    svc: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    ask: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.7-5.1A8.5 8.5 0 1 1 21 12Z"/>',
    cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    me: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c.8-3.8 3.9-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
  };
  var TABS = [
    ["home", "/", /^\/$/],
    ["svc", "/catalog", /^\/(catalog|services)(\/|$)/],
    ["ask", "/#advisor", /^$/],
    ["cart", "/cart", /^\/(cart|checkout)(\/|$)/],
    ["me", "/my", /^\/(my|account)(\/|$)/],
  ];

  function cartCount() {
    return safe(function () {
      var raw = JSON.parse(localStorage.getItem("bp_cart") || "null");
      var arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.items) ? raw.items : [];
      var n = 0;
      for (var i = 0; i < arr.length; i++) n += Number(arr[i] && (arr[i].qty || arr[i].q)) || 1;
      return n;
    }) || 0;
  }

  // لا شريط في الدفع (يغطي زر «ادفع») ولا في لوحة العمليات (سطح مكتب للفريق).
  var hide = /^\/(checkout|ops|admin)(\/|$)/.test(path);
  var bar;
  function buildBar() {
    if (hide || bar || !document.body) return;
    bar = document.createElement("nav");
    bar.className = "bp-tabbar";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Business Partner");
    var n = cartCount();
    bar.innerHTML = TABS.map(function (t) {
      var on = t[2].test(path) ? " on" : "";
      var badge = t[0] === "cart" && n ? "<i>" + (n > 9 ? "9+" : n) + "</i>" : "";
      return '<a class="bp-tab' + on + '" href="' + prefix + t[1] + '" data-t="' + t[0] + '"' + (on ? ' aria-current="page"' : "") + ">" +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[t[0]] + "</svg><span>" + T[t[0]] + "</span>" + badge + "</a>";
    }).join("");
    bar.addEventListener("click", function () { tap("LIGHT"); });
    document.body.appendChild(bar);
    document.body.classList.add("bp-has-tabbar");
  }

  // ------------------------------------------------------------ اهتزاز عام --
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("button,.sv1-btn,[role=button]");
    if (el && !el.disabled && !el.closest(".bp-tabbar")) tap("LIGHT");
  }, true);

  // ------------------------------------------------------------ زر الرجوع (Android) --
  if (P.App && P.App.addListener) {
    safe(function () {
      P.App.addListener("backButton", function () {
        if (history.length > 1 && path !== "/") history.back();
        else if (P.App.exitApp) P.App.exitApp();
      });
    });
  }

  // ------------------------------------------------------------ الشبكة --
  var off;
  function showOff(on) {
    if (!off && on) {
      off = document.createElement("div");
      off.className = "bp-off";
      off.setAttribute("role", "status");
      off.textContent = T.off;
      document.body.appendChild(off);
      void off.offsetWidth;
    }
    if (off) off.classList.toggle("on", !!on);
  }
  window.addEventListener("offline", function () { showOff(true); });
  window.addEventListener("online", function () { showOff(false); });
  if (navigator.onLine === false) showOff(true);

  // ------------------------------------------------------------ شريط الحالة --
  if (P.StatusBar && P.StatusBar.setStyle) safe(function () { P.StatusBar.setStyle({ style: "LIGHT" }); });

  // ------------------------------------------------------------ الإشعارات --
  // لا تُطلب عند أول فتح، ولا قبل تهيئة المتجرين (Firebase لـAndroid وAPNs لـiOS):
  // استدعاء register() بلا google-services.json يُسقط التطبيق. التفعيل بعلامة
  // `bp-push` في وكيل المستخدم (capacitor.config.json → appendUserAgent) بعد التهيئة.
  var pushReady = /\bbp-push\b/.test(navigator.userAgent) && P.PushNotifications;
  function enablePush() {
    var PN = P.PushNotifications;
    PN.requestPermissions().then(function (r) {
      if (r && r.receive === "granted") {
        PN.addListener("registration", function (tok) {
          ls("bp_push_token", tok && tok.value);
          window.dispatchEvent(new CustomEvent("bp:push-token", { detail: { token: tok && tok.value, platform: platform } }));
        });
        PN.register();
        tap("MEDIUM");
      }
    }).catch(function () {});
  }
  function pushBanner() {
    if (!pushReady || !/^\/(my|account)(\/|$)/.test(path)) return;
    var asked = Number(ls("bp_push_asked") || 0);
    if (ls("bp_push_token") || (asked && Date.now() - asked < 30 * 864e5)) return;
    var d = document.createElement("div");
    d.className = "bp-push";
    d.setAttribute("role", "dialog");
    d.innerHTML = "<b>" + T.pushT + '</b><button class="y" type="button">' + T.pushB + '</button><button class="n" type="button">' + T.pushX + "</button>";
    d.querySelector(".y").onclick = function () { ls("bp_push_asked", String(Date.now())); d.remove(); enablePush(); };
    d.querySelector(".n").onclick = function () { ls("bp_push_asked", String(Date.now())); d.remove(); };
    document.body.appendChild(d);
  }

  // ------------------------------------------------------------ عن التطبيق --
  // يظهر في «حسابي» فقط، بديلاً عن الفوتر. صفّ الخصوصية يبقى مخفياً حتى توجد صفحتها
  // (لا نص قانوني مخترع). حذف الحساب طلبٌ عبر واتساب إلى أن يُبنى مسار خادم له.
  var PRIVACY_PATH = null;
  var WA = "966530540231";
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  function aboutSection() {
    if (!/^\/(my|account)(\/|$)/.test(path) || document.querySelector(".bp-about")) return;
    var host = document.querySelector(".sv1") || document.body;
    var ver = (navigator.userAgent.match(/BusinessPartnerApp\/([0-9.]+)/) || [])[1] || "1.0";
    var s = document.createElement("section");
    s.className = "bp-about";
    s.setAttribute("aria-label", T.abT);
    var rows = '<h2>' + T.abT + "</h2>" +
      '<a href="' + prefix + '/terms">' + T.abTerms + CHEV + "</a>" +
      (PRIVACY_PATH ? '<a href="' + prefix + PRIVACY_PATH + '">' + T.abPriv + CHEV + "</a>" : "") +
      '<a href="' + prefix + '/contact">' + T.abContact + CHEV + "</a>" +
      '<button type="button" class="del" data-act="del">' + T.abDel + CHEV + "</button>" +
      '<span class="meta">Business Partner · ' + T.abVer + " " + ver + "</span>";
    s.innerHTML = rows;
    host.parentNode.insertBefore(s, host.nextSibling);
    s.querySelector('[data-act="del"]').addEventListener("click", delSheet);
  }
  function delSheet() {
    var d = document.createElement("div");
    d.className = "bp-sheet";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.innerHTML = "<div><p></p><div class=\"row\"><button type=\"button\" class=\"no\"></button><a class=\"go\" target=\"_blank\" rel=\"noopener\"></a></div></div>";
    d.querySelector("p").textContent = T.abDelQ;
    d.querySelector(".no").textContent = T.abDelNo;
    var go = d.querySelector(".go");
    go.textContent = T.abDelGo;
    go.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(T.abDelMsg);
    d.querySelector(".no").onclick = function () { d.remove(); };
    go.onclick = function () { tap("MEDIUM"); setTimeout(function () { d.remove(); }, 200); };
    d.addEventListener("click", function (e) { if (e.target === d) d.remove(); });
    document.body.appendChild(d);
  }

  // ------------------------------------------------------------ تشغيل --
  function boot() {
    buildBar();
    aboutSection();
    pushBanner();
    if (P.SplashScreen && P.SplashScreen.hide) safe(function () { P.SplashScreen.hide(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("storage", function () {
    if (!bar) return;
    var a = bar.querySelector('[data-t="cart"]');
    if (!a) return;
    var b = a.querySelector("i"), n = cartCount();
    if (!n && b) b.remove();
    else if (n) { if (!b) { b = document.createElement("i"); a.appendChild(b); } b.textContent = n > 9 ? "9+" : n; }
  });
})();
