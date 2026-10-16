/* Business Partner — جسر التطبيق الأصلي (iOS / Android عبر Capacitor)
 *
 * يعمل **داخل التطبيق فقط**: إن لم يوجد window.Capacitor الأصلي ينتهي فوراً
 * ولا يغيّر شيئاً في الموقع العادي. يملكه وكيل `mobile-app`.
 * يُحمَّل من موضعين (قاعدة 2.6): SV1.shell() للموقع الجديد، وmain.js للقديم.
 *
 * التطبيق = محادثة فقط (قرار المالك 2026-10-15):
 *  1) بوابة دخول إجبارية: كلمة مرور، أو رمز يصل البريد لأول مرة (ثم يضع كلمة مرور).
 *     دخول جوجل يظهر فقط حين يهيَّأ في الخادم ويوجد مكوّنه الأصلي (انظر docs/mobile-app.md).
 *  2) بعد الدخول: شاشة المحادثة وحدها — بلا ترويسة الموقع ولا الفوتر ولا شريط تبويب.
 *  3) قائمة صغيرة: طلباتي، الشروط، تواصل، حذف الحساب، خروج.
 * الاتصال الوحيد بالشبكة: POST إلى /api/otp من الأصل نفسه.
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
  html.classList.add("bp-native", "bp-" + platform, "bp-pending");

  // ------------------------------------------------------------ لغة ومسار --
  var m = location.pathname.match(/^\/(ar|fr|zh)(\/|$)/);
  var prefix = m ? "/" + m[1] : "";
  var lang = m ? m[1] : (html.getAttribute("lang") || "ar").slice(0, 2);
  var path = location.pathname.replace(/^\/(ar|fr|zh)(?=\/|$)/, "") || "/";
  var isHome = path === "/";
  var isPublic = /^\/(terms|contact|privacy)(\/|$)/.test(path);

  var L = {
    ar: {
      hello: "أهلاً بك في Business Partner", sub: "سجّل دخولك لتبدأ المحادثة مع مستشارك.",
      email: "البريد الإلكتروني", pass: "كلمة المرور", login: "دخول", wait: "لحظة…",
      or: "أو", noAcc: "ليس لديك حساب؟", signup: "إنشاء حساب", name: "الاسم", back: "لديك حساب؟ سجّل دخولك", googleOff: "دخول جوجل غير مفعّل بعد. استخدم البريد وكلمة المرور، أو أنشئ حساباً.",
      sendCode: "أرسل الرمز", code: "الرمز المكوّن من 6 أرقام", verify: "تأكيد", codeSent: "أرسلنا الرمز إلى بريدك",
      google: "المتابعة عبر جوجل", nafath: "الدخول عبر نفاذ", nafathOff: "الدخول عبر نفاذ غير مفعّل بعد. استخدم البريد وكلمة المرور.", nafathT: "الدخول عبر نفاذ", nafathS: "اكتب رقم هويتك الوطنية أو الإقامة (10 أرقام). سنرسل طلباً إلى تطبيق نفاذ على جوالك.", nid: "رقم الهوية أو الإقامة", nafathGo: "إرسال الطلب", nafathPick: "افتح تطبيق نفاذ واختر هذا الرقم", nafathWait: "بانتظار موافقتك في تطبيق نفاذ…", nafathBad: "رقم الهوية أو الإقامة عشرة أرقام.", nafathFail: "تعذّر الدخول عبر نفاذ. حاول مرة أخرى.", nafathLink: "تم التحقق من هويتك ✓ ادخل مرة واحدة بالبريد أو بجوجل لنربط هويتك بحسابك، وبعدها تدخل بنفاذ مباشرة.", apple: "المتابعة عبر Apple", appleErr: "تعذّر الدخول عبر Apple. حاول مرة أخرى أو استخدم البريد وكلمة المرور.",
      setT: "اختر كلمة مرور", setS: "تدخل بها دائماً، ولو نسيتها أنشئ حساباً بالبريد نفسه واختر كلمة جديدة. 8 أحرف على الأقل.", setGo: "حفظ ومتابعة",
      badEmail: "اكتب بريداً صحيحاً.", badCreds: "البريد أو كلمة المرور غير صحيحة.", netErr: "تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.",
      badCode: "الرمز غير صحيح أو انتهت صلاحيته.", terms: "الشروط والأحكام", contact: "تواصل معنا",
      chat: "المحادثة", svc: "الخدمات", cart: "السلة", me: "حسابي", menu: "القائمة", my: "طلباتي ومستنداتي", out: "تسجيل الخروج", ver: "الإصدار", signed: "مسجّل باسم",
      del: "طلب حذف الحساب", delQ: "سنفتح محادثة واتساب برسالة جاهزة لطلب حذف حسابك، ونتواصل معك لتأكيد الطلب. لا يُحذف شيء قبل تأكيدك.",
      delGo: "أرسل الطلب", delNo: "إلغاء", delMsg: "أرغب في حذف حسابي في تطبيق Business Partner.",
      off: "أنت غير متصل بالإنترنت", pushT: "فعّل الإشعارات لمتابعة طلباتك وعروضك", pushB: "تفعيل", pushX: "لاحقاً"
    },
    en: {
      hello: "Welcome to Business Partner", sub: "Sign in to start chatting with your advisor.",
      email: "Email", pass: "Password", login: "Sign in", wait: "One moment…",
      or: "or", noAcc: "No account yet?", signup: "Create account", name: "Name", back: "Already have an account? Sign in", googleOff: "Google sign-in is not enabled yet. Use your email and password, or create an account.",
      sendCode: "Send code", code: "6-digit code", verify: "Confirm", codeSent: "We emailed you a code",
      google: "Continue with Google", nafath: "Sign in with Nafath", nafathOff: "Nafath sign-in is not enabled yet. Use your email and password.", nafathT: "Sign in with Nafath", nafathS: "Enter your national ID or Iqama number (10 digits). We will send a request to your Nafath app.", nid: "National ID or Iqama", nafathGo: "Send request", nafathPick: "Open the Nafath app and choose this number", nafathWait: "Waiting for your approval in Nafath…", nafathBad: "National ID or Iqama is 10 digits.", nafathFail: "Could not sign in with Nafath. Try again.", nafathLink: "Identity verified ✓ Sign in once with email or Google so we can link it to your account; after that you sign in with Nafath directly.", apple: "Continue with Apple", appleErr: "Could not sign in with Apple. Try again or use your email and password.",
      setT: "Choose a password", setS: "You will use it to sign in. If you forget it, create an account with the same email and choose a new one. At least 8 characters.", setGo: "Save and continue",
      badEmail: "Enter a valid email.", badCreds: "Wrong email or password.", netErr: "Could not connect. Check your internet and try again.",
      badCode: "The code is wrong or has expired.", terms: "Terms and conditions", contact: "Contact us",
      chat: "Chat", svc: "Services", cart: "Cart", me: "Account", menu: "Menu", my: "My requests and documents", out: "Sign out", ver: "Version", signed: "Signed in as",
      del: "Request account deletion", delQ: "We will open a WhatsApp chat with a ready message asking to delete your account, then contact you to confirm. Nothing is deleted before you confirm.",
      delGo: "Send request", delNo: "Cancel", delMsg: "I would like to delete my account in the Business Partner app.",
      off: "You are offline", pushT: "Turn on notifications to follow your requests and quotes", pushB: "Enable", pushX: "Later"
    }
  };
  var T = L[lang] || L.en;

  // ------------------------------------------------------------ أدوات --
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function tap(style) { if (P.Haptics && P.Haptics.impact) safe(function () { P.Haptics.impact({ style: style || "LIGHT" }); }); }
  function ls(k, v) { return safe(function () { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function api(action, data) {
    var body = { action: action };
    for (var k in (data || {})) body[k] = data[k];
    return fetch("/api/otp", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; }); });
  }
  function goChat() { location.replace(prefix + "/"); }
  function hideSplash() { if (P.SplashScreen && P.SplashScreen.hide) safe(function () { P.SplashScreen.hide(); }); }

  // ------------------------------------------------------------ نمط --
  var SAFE_B = "max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px))";
  var SAFE_T = "max(env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px))";
  var css = [
    // مرحلة التحقق من الجلسة: لا يظهر الموقع قبل أن نعرف
    "html.bp-pending body{visibility:hidden}",
    // تطبيق لا موقع: لا ترويسة ولا شريط حالة ولا فوتر
    "html.bp-native .sv1-ribbon,html.bp-native .sv1-bar,html.bp-native header.sv1-hdr,html.bp-native footer.sv1-foot,html.bp-native .sv1-foot{display:none!important}",
    "html.bp-native .bp-web-only,html.bp-native [data-web-only]{display:none!important}",
    "html.bp-native{-webkit-touch-callout:none}html.bp-native body{overscroll-behavior-y:none}",
    // وضع المحادثة: كل شيء عدا قسم المحادثة مخفي
    "html.bp-chat main>section:not(#advisor),html.bp-chat #advisor .sv1-title,html.bp-chat .sv1-wa-fab,html.bp-chat #bpsFab,html.bp-chat #bpsPanel{display:none!important}",
    "html.bp-chat .sv1-sec{padding:0!important}html.bp-chat #advisor .wrap{padding:0!important;max-width:none}",
    "html.bp-chat .sv1-app{border:0;border-radius:0;box-shadow:none}",
    // الشاشة الأولى محادثة صرفة: بلا شريط مكرر، والمحادثة تملأ الشاشة وحقل الكتابة في أسفلها.
    // لوحة نطاق الطلب تحتها بالتمرير (هي طريق إنشاء الطلب).
    "html.bp-chat .sv1-appbar{display:none}",
    "html.bp-chat .sv1-chat{height:calc(100vh - 116px - " + SAFE_T + " - " + SAFE_B + ");height:calc(100dvh - 116px - " + SAFE_T + " - " + SAFE_B + ");min-height:0}",
    "html.bp-chat .sv1-chat .sv1-msgs{flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto}",
    // شريط التبويب السفلي للعميل: المحادثة · الخدمات · السلة · حسابي
    ".bp-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:stretch;background:rgba(255,255,255,.97);-webkit-backdrop-filter:saturate(180%) blur(14px);backdrop-filter:saturate(180%) blur(14px);border-top:1px solid #E5E9F0;padding:6px 4px calc(6px + " + SAFE_B + ");font-family:inherit}",
    ".bp-tab{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;color:#5A6478;text-decoration:none;font-size:11px;font-weight:600;line-height:1.1;-webkit-tap-highlight-color:transparent;position:relative}",
    ".bp-tab svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.bp-tab.on{color:#0B1B5A}.bp-tab.on svg{stroke-width:2.2}.bp-tab:active{opacity:.6}",
    ".bp-tab i{position:absolute;top:2px;inset-inline-start:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#0B1B5A;color:#fff;font:700 10px/16px inherit;font-style:normal;text-align:center}",
    "body.bp-has-tabbar{padding-bottom:calc(64px + " + SAFE_B + ")!important}",
    "body.bp-has-tabbar .sv1-wa-fab,body.bp-has-tabbar #bpsFab,body.bp-has-tabbar #bpsPanel{bottom:calc(76px + " + SAFE_B + ")!important}",
    // شريط علوي خاص بالتطبيق
    ".bp-top{position:sticky;top:0;z-index:2147482000;display:flex;align-items:center;gap:10px;min-height:52px;padding:0 12px;background:rgba(255,255,255,.97);",
    "-webkit-backdrop-filter:saturate(180%) blur(14px);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid #E5E9F0;font-family:inherit;color:#0B1B5A}",
    ".bp-top .t{flex:1;min-width:0;display:flex;align-items:center}.bp-top .t img{height:22px;width:auto;max-width:100%}",
    ".bp-top a,.bp-top button{display:inline-flex;align-items:center;gap:4px;min-height:44px;min-width:44px;justify-content:center;border:0;background:none;color:#0B1B5A;font:700 15px inherit;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".bp-top svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}[dir=rtl] .bp-top .bk svg{transform:scaleX(-1)}",
    // البوابة
    ".bp-login{position:fixed;inset:0;z-index:2147483003;overflow-y:auto;background:#F5F7FB;color:#232A3D;font-family:inherit;padding:calc(24px + " + SAFE_T + ") 20px calc(24px + " + SAFE_B + ");display:flex;flex-direction:column;align-items:center}",
    ".bp-login .c{width:100%;max-width:400px;margin:auto 0;display:flex;flex-direction:column;gap:14px}",
    ".bp-login img.lg{width:210px;max-width:70%;align-self:center;margin-bottom:6px}",
    ".bp-login h1{margin:0;font-size:22px;line-height:1.4;color:#0B1B5A;text-align:center}.bp-login p{margin:0;color:#5A6478;font-size:15px;line-height:1.7;text-align:center}",
    ".bp-login label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#5A6478}",
    ".bp-login input{min-height:52px;border:1px solid #DDE3EF;border-radius:14px;padding:0 14px;font:inherit;font-size:16px;background:#fff;color:#232A3D;direction:ltr;text-align:start;outline:none}",
    ".bp-login input:focus{border-color:#0B1B5A}",
    ".bp-login .pri{min-height:54px;border:0;border-radius:14px;background:#0B1B5A;color:#fff;font:700 16px inherit;cursor:pointer}.bp-login .pri[disabled]{opacity:.6}",
    ".bp-login .gg{min-height:54px;border:1px solid #DDE3EF;border-radius:14px;background:#fff;color:#232A3D;font:700 15px inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}",
    ".bp-login .gg svg{width:20px;height:20px;flex:none}",
    ".bp-login .nfnum{font:800 56px/1 inherit;text-align:center;letter-spacing:2px;padding:18px;border:2px solid #1B6B52;border-radius:16px;color:#1B6B52;font-variant-numeric:tabular-nums}",
    ".bp-login .ap{min-height:54px;border:0;border-radius:14px;background:#000;color:#fff;font:700 15px inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}",
    ".bp-login .ap svg{width:20px;height:20px;flex:none;fill:#fff}",
    ".bp-login .or{display:flex;align-items:center;gap:12px;color:#8D97AE;font-size:13px}.bp-login .or::before,.bp-login .or::after{content:\"\";flex:1;height:1px;background:#DDE3EF}",
    ".bp-login .alt{display:flex;gap:6px;justify-content:center;align-items:center;color:#5A6478;font-size:14px}",
    ".bp-login .lnk{background:none;border:0;color:#0B1B5A;font:600 14px/1.6 inherit;text-decoration:underline;cursor:pointer;padding:6px 0}",
    ".bp-login .err{min-height:1.4em;color:#B42318;font-size:14px;text-align:center}",
    ".bp-login .legal{display:flex;gap:16px;justify-content:center;font-size:13px}.bp-login .legal a{color:#5A6478}",
    // قائمة وأوراق سفلية
    ".bp-sheet{position:fixed;inset:0;z-index:2147483002;background:rgba(11,27,90,.45);display:flex;align-items:flex-end}",
    ".bp-sheet>div{width:100%;max-height:88%;overflow-y:auto;background:#fff;border-radius:20px 20px 0 0;padding:8px 0 calc(12px + " + SAFE_B + ");color:#232A3D;font-family:inherit}",
    ".bp-sheet p{margin:0;padding:16px 20px;font-size:15px;line-height:1.7}.bp-sheet .meta{display:block;padding:10px 20px;font-size:12.5px;color:#8D97AE;line-height:1.7}",
    ".bp-sheet a,.bp-sheet button.i{display:flex;align-items:center;width:100%;min-height:54px;padding:0 20px;border:0;border-top:1px solid #EBEFF7;background:none;color:inherit;font:600 16px inherit;text-decoration:none;text-align:start;cursor:pointer}",
    ".bp-sheet>div>a:first-child,.bp-sheet>div>button.i:first-child{border-top:0}.bp-sheet .dg{color:#B42318}",
    ".bp-sheet .row{display:flex;gap:10px;padding:0 20px 8px}.bp-sheet .row a,.bp-sheet .row button{flex:1;min-height:50px;border-radius:14px;border:0;justify-content:center;font:700 15px inherit;text-decoration:none;cursor:pointer}",
    ".bp-sheet .go{background:#B42318;color:#fff}.bp-sheet .no{background:#EEF2FB;color:#0B1B5A}",
    ".bp-off{position:fixed;left:0;right:0;top:0;z-index:2147483001;background:#B45309;color:#fff;text-align:center;font:600 13px/1 inherit;padding:calc(8px + " + SAFE_T + ") 12px 8px;transform:translateY(-110%);transition:transform .2s}.bp-off.on{transform:none}",
    ".bp-push{position:fixed;left:12px;right:12px;bottom:calc(76px + " + SAFE_B + ");z-index:2147482999;background:#0B1B5A;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;font:600 13.5px/1.5 inherit;box-shadow:0 12px 32px -8px rgba(11,27,90,.45)}.bp-push b{flex:1;font-weight:600}",
    ".bp-push button{border:0;border-radius:10px;min-height:36px;padding:0 14px;font:700 13px inherit;cursor:pointer}.bp-push .y{background:#fff;color:#0B1B5A}.bp-push .n{background:transparent;color:#C3CDE6}"
  ].join("");
  var st = document.createElement("style");
  st.id = "bp-app-style";
  st.textContent = css;
  (document.head || html).appendChild(st);

  // ------------------------------------------------------------ بوابة الدخول --
  var ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };
  var TABICON = {
    chat: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.7-5.1A8.5 8.5 0 1 1 21 12Z"/>',
    svc: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    me: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c.8-3.8 3.9-5.8 7.5-5.8s6.7 2 7.5 5.8"/>'
  };
  var TABS = [["chat", "/", /^\/$/], ["svc", "/catalog", /^\/(catalog|services)(\/|$)/], ["cart", "/cart", /^\/(cart|checkout)(\/|$)/], ["me", "/my", /^\/(my|account)(\/|$)/]];
  function cartCount() {
    return safe(function () {
      var raw = JSON.parse(localStorage.getItem("bp_cart") || "null");
      var arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.items) ? raw.items : [];
      var n = 0;
      for (var i = 0; i < arr.length; i++) n += Number(arr[i] && (arr[i].qty || arr[i].q)) || 1;
      return n;
    }) || 0;
  }
  // لا شريط في الدفع (يغطي زر «ادفع») ولا في لوحة العمليات.
  var noBar = /^\/(checkout|ops|admin)(\/|$)/.test(path);
  var bar;
  function tabBar() {
    if (noBar || bar || !document.body) return;
    bar = el("nav", "bp-tabbar");
    bar.setAttribute("role", "navigation"); bar.setAttribute("aria-label", "Business Partner");
    var n = cartCount();
    TABS.forEach(function (t) {
      var on = t[2].test(path);
      var a = el("a", "bp-tab" + (on ? " on" : ""));
      a.href = prefix + t[1]; a.dataset.t = t[0];
      if (on) a.setAttribute("aria-current", "page");
      a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + TABICON[t[0]] + "</svg>";
      a.appendChild(el("span", null, T[t[0]]));
      if (t[0] === "cart" && n) a.appendChild(el("i", null, n > 9 ? "9+" : String(n)));
      a.addEventListener("click", function () { tap("LIGHT"); });
      bar.appendChild(a);
    });
    document.body.appendChild(bar);
    document.body.classList.add("bp-has-tabbar");
  }
  window.addEventListener("storage", function () {
    if (!bar) return;
    var a = bar.querySelector('[data-t="cart"]'), b = a && a.querySelector("i"), n = cartCount();
    if (!a) return;
    if (!n && b) b.remove(); else if (n) { if (!b) { b = el("i"); a.appendChild(b); } b.textContent = n > 9 ? "9+" : String(n); }
  });

  var GLOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  var ALOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
  // معرّف عميل iOS من Google Cloud (ليس سرّاً). فارغ حتى يُنشأ — انظر docs/google-signin-setup.md.
  var GOOGLE_IOS_CLIENT_ID = null;
  var session = null, gate = null, methods = { google: false, googleClientId: null, apple: false, nafath: false };

  function field(label, type, name, auto) {
    var l = el("label", null, label), i = document.createElement("input");
    i.type = type; i.name = name; i.id = "bp-" + name; i.autocomplete = auto;
    i.setAttribute("autocapitalize", "off"); i.setAttribute("autocorrect", "off"); i.setAttribute("spellcheck", "false");
    if (type === "email") i.inputMode = "email";
    if (name === "code") i.inputMode = "numeric";
    l.appendChild(i);
    return { box: l, input: i };
  }
  function busy(btn, on) {
    btn.disabled = on;
    if (on) { btn.dataset.t = btn.textContent; btn.textContent = T.wait; } else if (btn.dataset.t) btn.textContent = btn.dataset.t;
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function form() { var f = document.createElement("form"); f.style.cssText = "display:flex;flex-direction:column;gap:14px"; f.noValidate = true; return f; }
  function errBox() { var e = el("div", "err"); e.setAttribute("role", "alert"); return e; }

  function showLogin() {
    if (gate) return;
    gate = el("div", "bp-login");
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    html.classList.remove("bp-pending");
    document.body.appendChild(gate);
    stepPassword();
    hideSplash();
  }
  function frame() {
    gate.textContent = "";
    var c = el("div", "c");
    var lg = document.createElement("img");
    lg.className = "lg"; lg.alt = "Business Partner"; lg.src = "/assets/img/logo.png";
    c.appendChild(lg);
    gate.appendChild(c);
    return c;
  }
  function legal(c) {
    var d = el("div", "legal");
    var a = el("a", null, T.terms); a.href = prefix + "/terms";
    var b = el("a", null, T.contact); b.href = prefix + "/contact";
    d.appendChild(a); d.appendChild(b); c.appendChild(d);
  }

  function stepPassword() {
    var c = frame();
    c.appendChild(el("h1", null, T.hello));
    c.appendChild(el("p", null, T.sub));
    var f = form();
    var e = field(T.email, "email", "email", "username"), p = field(T.pass, "password", "password", "current-password");
    var err = errBox();
    var go = el("button", "pri", T.login); go.type = "submit";
    f.appendChild(e.box); f.appendChild(p.box); f.appendChild(err); f.appendChild(go);
    c.appendChild(f);
    c.appendChild(el("div", "or", T.or));
    var g = el("button", "gg"); g.type = "button";
    g.innerHTML = GLOGO;
    g.appendChild(el("span", null, T.google));
    g.onclick = function () { googleLogin(err); };
    c.appendChild(g);
    var nf = el("button", "gg", T.nafath); nf.type = "button";
    nf.onclick = function () { if (!methods.nafath) { err.textContent = T.nafathOff; return; } stepNafath(); };
    c.appendChild(nf);
    if (platform === "ios") {
      var ap = el("button", "ap"); ap.type = "button";
      ap.innerHTML = ALOGO;
      ap.appendChild(el("span", null, T.apple));
      ap.onclick = function () { appleLogin(err); };
      c.appendChild(ap);
    }
    var alt = el("div", "alt", T.noAcc);
    var su = el("button", "lnk", T.signup); su.type = "button"; su.onclick = stepSignupEmail;
    alt.appendChild(su); c.appendChild(alt);
    legal(c);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var em = e.input.value.trim().toLowerCase(), pw = p.input.value;
      if (!isEmail(em)) { err.textContent = T.badEmail; return; }
      if (!pw) { err.textContent = T.badCreds; return; }
      err.textContent = ""; busy(go, true); tap("LIGHT");
      api("password-login", { email: em, password: pw }).then(function (r) {
        if (r.body.ok) { tap("MEDIUM"); goChat(); return; }
        busy(go, false); err.textContent = r.body.message || T.badCreds;
      }).catch(function () { busy(go, false); err.textContent = T.netErr; });
    });
  }

  // نفاذ: رقم الهوية ← الرقم الذي يظهر للمستخدم ← استطلاع الحالة. الخادم يحمل الهوية مختومة ولا تعود للمتصفح.
  var nafathTimer = null;
  function stepNafath() {
    var c = frame();
    c.appendChild(el("h1", null, T.nafathT));
    c.appendChild(el("p", null, T.nafathS));
    var f = form();
    var n = field(T.nid, "text", "nid", "off");
    n.input.maxLength = 10; n.input.inputMode = "numeric";
    var err = errBox();
    var go = el("button", "pri", T.nafathGo); go.type = "submit";
    f.appendChild(n.box); f.appendChild(err); f.appendChild(go); c.appendChild(f);
    var back = el("button", "lnk", T.back); back.type = "button"; back.onclick = function () { clearTimeout(nafathTimer); stepPassword(); }; c.appendChild(back);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var id = n.input.value.replace(/\D/g, "");
      if (id.length !== 10) { err.textContent = T.nafathBad; return; }
      err.textContent = ""; busy(go, true);
      api("nafath-start", { nationalId: id, purpose: "portal", locale: lang === "ar" ? "ar" : "en" }).then(function (r) {
        if (r.body.ok && r.body.challenge) { nafathWaiting(r.body.random, r.body.challenge); return; }
        busy(go, false); err.textContent = r.body.message || T.nafathFail;
      }).catch(function () { busy(go, false); err.textContent = T.netErr; });
    });
  }
  function nafathWaiting(random, challenge) {
    var c = frame();
    c.appendChild(el("h1", null, T.nafathPick));
    c.appendChild(el("div", "nfnum", String(random || "")));
    c.appendChild(el("p", null, T.nafathWait));
    var err = errBox(); c.appendChild(err);
    var back = el("button", "lnk", T.back); back.type = "button"; back.onclick = function () { clearTimeout(nafathTimer); stepPassword(); }; c.appendChild(back);
    var until = Date.now() + 120000;
    (function poll() {
      nafathTimer = setTimeout(function () {
        api("nafath-poll", { challenge: challenge }).then(function (r) {
          var b = r.body || {};
          if (b.ok && b.status === "WAITING") { if (Date.now() < until) poll(); else { stepNafath(); } return; }
          if (b.ok && b.status === "COMPLETED") { tap("MEDIUM"); goChat(); return; }
          if (b.error === "identity_not_linked" && b.link) { ls("bp_nafath_link", b.link); stepPassword(); var e2 = gate.querySelector(".err"); if (e2) e2.textContent = T.nafathLink; return; }
          err.textContent = b.message || T.nafathFail;
        }).catch(function () { err.textContent = T.netErr; });
      }, 3000);
    })();
  }
  // بعد دخول عادي: أكمل ربط هوية نفاذ التي تحقّقنا منها قبل الدخول.
  function finishNafathLink() {
    var link = ls("bp_nafath_link");
    if (!link) return;
    api("nafath-link", { link: link }).then(function () { safe(function () { localStorage.removeItem("bp_nafath_link"); }); }).catch(function () {});
  }

  var signupName = "";
  function stepSignupEmail() {
    var c = frame();
    c.appendChild(el("h1", null, T.signup));
    var f = form();
    var n = field(T.name, "text", "name", "name"), e = field(T.email, "email", "email", "username");
    n.input.style.direction = "inherit";
    var err = errBox();
    var go = el("button", "pri", T.sendCode); go.type = "submit";
    f.appendChild(n.box); f.appendChild(e.box); f.appendChild(err); f.appendChild(go); c.appendChild(f);
    var back = el("button", "lnk", T.back); back.type = "button"; back.onclick = stepPassword; c.appendChild(back);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var em = e.input.value.trim().toLowerCase();
      if (!isEmail(em)) { err.textContent = T.badEmail; return; }
      signupName = n.input.value.trim();
      err.textContent = ""; busy(go, true);
      api("start", { email: em }).then(function (r) {
        if (r.body.ok && r.body.challenge) { stepCode(em, r.body.challenge, r.body.devCode); return; }
        busy(go, false); err.textContent = r.body.message || T.netErr;
      }).catch(function () { busy(go, false); err.textContent = T.netErr; });
    });
  }

  function stepCode(email, challenge, devCode) {
    var c = frame();
    c.appendChild(el("h1", null, T.codeSent));
    var f = form();
    var k = field(T.code, "text", "code", "one-time-code");
    if (devCode) k.input.value = devCode; // يصل فقط في التطوير المحلي
    var err = errBox();
    var go = el("button", "pri", T.verify); go.type = "submit";
    f.appendChild(k.box); f.appendChild(err); f.appendChild(go); c.appendChild(f);
    var back = el("button", "lnk", T.back); back.type = "button"; back.onclick = stepPassword; c.appendChild(back);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      err.textContent = ""; busy(go, true);
      api("verify", { email: email, code: k.input.value.trim(), challenge: challenge, name: signupName }).then(function (r) {
        if (r.body.ok) { tap("MEDIUM"); stepSetPassword(); return; }
        busy(go, false); err.textContent = T.badCode;
      }).catch(function () { busy(go, false); err.textContent = T.netErr; });
    });
  }

  function stepSetPassword() {
    var c = frame();
    c.appendChild(el("h1", null, T.setT));
    c.appendChild(el("p", null, T.setS));
    var f = form();
    var p = field(T.pass, "password", "newpass", "new-password");
    var err = errBox();
    var go = el("button", "pri", T.setGo); go.type = "submit";
    f.appendChild(p.box); f.appendChild(err); f.appendChild(go); c.appendChild(f);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (p.input.value.length < 8) { err.textContent = T.setS; return; }
      err.textContent = ""; busy(go, true);
      api("password-set", { password: p.input.value }).then(function (r) {
        if (r.body.ok) { goChat(); return; }
        busy(go, false); err.textContent = r.body.message || T.netErr;
      }).catch(function () { busy(go, false); err.textContent = T.netErr; });
    });
  }

  // الدخول الاجتماعي عبر المكوّن الأصلي (جوجل يمنع الدخول داخل WebView). تُهيَّأ مرة واحدة.
  //  • جوجل: الزر ظاهر دائماً؛ يعمل حين يوجد معرّف الويب (من الخادم) ومعرّف iOS على iOS،
  //    وقبل ذلك يقول بصراحة إنه غير مفعّل بدل أن يفشل بصمت.
  //  • Apple: iOS فقط، ولا يحتاج معرّفات (يعتمد على معرّف الحزمة والصلاحية في Xcode).
  var socialReady = null;
  function initSocial() {
    var SL = P.SocialLogin;
    if (!SL || !SL.initialize) return Promise.reject(new Error("no_plugin"));
    if (socialReady) return socialReady;
    var cfg = {};
    var googleOk = !!methods.googleClientId && (platform !== "ios" || !!GOOGLE_IOS_CLIENT_ID);
    if (googleOk) cfg.google = { webClientId: methods.googleClientId, iOSClientId: GOOGLE_IOS_CLIENT_ID || undefined, iOSServerClientId: methods.googleClientId, mode: "online" };
    if (platform === "ios") cfg.apple = {};
    socialReady = Promise.resolve(SL.initialize(cfg)).then(function () { return { google: googleOk }; });
    socialReady.catch(function () { socialReady = null; });
    return socialReady;
  }
  function idTokenOf(res) { return res && res.result && (res.result.idToken || (res.result.accessToken && res.result.idToken)); }
  function googleLogin(err) {
    if (!methods.google || !P.SocialLogin) { err.textContent = T.googleOff; return; }
    err.textContent = "";
    initSocial().then(function (r) {
      if (!r.google) { err.textContent = T.googleOff; return; }
      return P.SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } }).then(function (res) {
        var tok = idTokenOf(res);
        if (!tok) { err.textContent = T.netErr; return; }
        return api("google", { credential: tok }).then(function (a) { if (a.body.ok) goChat(); else err.textContent = a.body.message || T.netErr; });
      });
    }).catch(function () { err.textContent = T.netErr; });
  }
  function appleLogin(err) {
    if (!P.SocialLogin) { err.textContent = T.appleErr; return; }
    err.textContent = "";
    initSocial().then(function () {
      return P.SocialLogin.login({ provider: "apple", options: { scopes: ["email", "name"] } }).then(function (res) {
        var tok = idTokenOf(res);
        var prof = (res && res.result && res.result.profile) || {};
        var nm = [prof.givenName, prof.familyName].filter(Boolean).join(" ");
        if (!tok) { err.textContent = T.appleErr; return; }
        return api("apple", { credential: tok, name: nm }).then(function (a) { if (a.body.ok) goChat(); else err.textContent = T.appleErr; });
      });
    }).catch(function () { err.textContent = T.appleErr; });
  }

  // ------------------------------------------------------------ شريط علوي وقائمة --
  function sheet(build) {
    var d = el("div", "bp-sheet");
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    var inner = el("div");
    build(inner, function () { d.remove(); });
    d.appendChild(inner);
    d.addEventListener("click", function (e) { if (e.target === d) d.remove(); });
    document.body.appendChild(d);
    return d;
  }
  var WA = "966530540231";
  var PRIVACY_PATH = null; // يُضبط حين توجد صفحة الخصوصية؛ لا نص قانونياً مخترعاً
  function link(inner, text, href) { var a = el("a", null, text); a.href = href; inner.appendChild(a); return a; }

  function openMenu() {
    tap("LIGHT");
    sheet(function (inner, close) {
      link(inner, T.my, prefix + "/my");
      link(inner, T.terms, prefix + "/terms");
      if (PRIVACY_PATH) link(inner, "Privacy", prefix + PRIVACY_PATH);
      link(inner, T.contact, prefix + "/contact");
      var del = el("button", "i dg", T.del); del.type = "button";
      del.onclick = function () { close(); deleteSheet(); };
      inner.appendChild(del);
      var out = el("button", "i", T.out); out.type = "button";
      out.onclick = function () { tap("MEDIUM"); api("logout").then(goChat).catch(goChat); };
      inner.appendChild(out);
      var ver = (navigator.userAgent.match(/BusinessPartnerApp\/([0-9.]+)/) || [])[1] || "1.0";
      var who = session && session.user && session.user.email;
      inner.appendChild(el("span", "meta", (who ? T.signed + " " + who + " · " : "") + T.ver + " " + ver));
    });
  }
  function deleteSheet() {
    sheet(function (inner, close) {
      inner.appendChild(el("p", null, T.delQ));
      var row = el("div", "row");
      var no = el("button", "no", T.delNo); no.type = "button"; no.onclick = close;
      var go = el("a", "go", T.delGo);
      go.target = "_blank"; go.rel = "noopener";
      go.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(T.delMsg);
      go.onclick = function () { tap("MEDIUM"); setTimeout(close, 200); };
      row.appendChild(no); row.appendChild(go); inner.appendChild(row);
    });
  }

  function topBar() {
    if (document.querySelector(".bp-top")) return;
    var bar = el("div", "bp-top");
    bar.setAttribute("role", "banner");
    var t = el("span", "t"), lg = document.createElement("img");
    lg.src = "/assets/img/logo.png"; lg.alt = "Business Partner"; t.appendChild(lg); bar.appendChild(t);
    if (session) {
      var mb = el("button"); mb.type = "button"; mb.setAttribute("aria-label", T.menu); mb.innerHTML = ICON.menu;
      mb.onclick = openMenu; bar.appendChild(mb);
    }
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // ------------------------------------------------------------ اهتزاز عام / رجوع / شبكة --
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("button,.sv1-btn,[role=button]");
    if (b && !b.disabled) tap("LIGHT");
  }, true);

  if (P.App && P.App.addListener) {
    safe(function () {
      P.App.addListener("backButton", function () {
        var open = document.querySelector(".bp-sheet");
        if (open) { open.remove(); return; }
        if (!isHome && history.length > 1) history.back();
        else if (!isHome) goChat();
        else if (P.App.exitApp) P.App.exitApp();
      });
    });
  }

  var off;
  function showOff(on) {
    if (!off && on) { off = el("div", "bp-off", T.off); off.setAttribute("role", "status"); document.body.appendChild(off); void off.offsetWidth; }
    if (off) off.classList.toggle("on", !!on);
  }
  window.addEventListener("offline", function () { showOff(true); });
  window.addEventListener("online", function () { showOff(false); });
  if (navigator.onLine === false) showOff(true);

  if (P.StatusBar && P.StatusBar.setStyle) safe(function () { P.StatusBar.setStyle({ style: "LIGHT" }); });

  // ------------------------------------------------------------ الإشعارات --
  // مطفأة حتى تُهيَّأ Firebase/APNs: register() بلا google-services.json يُسقط Android.
  // التفعيل بعلامة `bp-push` في appendUserAgent.
  var pushReady = /\bbp-push\b/.test(navigator.userAgent) && P.PushNotifications;
  function enablePush() {
    var PN = P.PushNotifications;
    PN.requestPermissions().then(function (r) {
      if (r && r.receive === "granted") {
        PN.addListener("registration", function (tok) {
          ls("bp_push_token", tok && tok.value);
          window.dispatchEvent(new CustomEvent("bp:push-token", { detail: { token: tok && tok.value, platform: platform } }));
        });
        PN.register(); tap("MEDIUM");
      }
    }).catch(function () {});
  }
  function pushBanner() {
    if (!pushReady || !isHome) return;
    var asked = Number(ls("bp_push_asked") || 0);
    if (ls("bp_push_token") || (asked && Date.now() - asked < 30 * 864e5)) return;
    var d = el("div", "bp-push"); d.setAttribute("role", "dialog");
    var b = el("b", null, T.pushT), y = el("button", "y", T.pushB), n = el("button", "n", T.pushX);
    y.type = n.type = "button";
    y.onclick = function () { ls("bp_push_asked", String(Date.now())); d.remove(); enablePush(); };
    n.onclick = function () { ls("bp_push_asked", String(Date.now())); d.remove(); };
    d.appendChild(b); d.appendChild(y); d.appendChild(n); document.body.appendChild(d);
  }

  // ------------------------------------------------------------ تشغيل --
  function enter() {
    html.classList.remove("bp-pending");
    finishNafathLink();
    if (isHome) html.classList.add("bp-chat");
    topBar();
    tabBar();
    pushBanner();
    hideSplash();
  }
  function boot() {
    var done = false;
    function resolve(s) {
      if (done) return;
      done = true;
      session = s || null;
      if (session) enter();
      else if (isPublic) { html.classList.remove("bp-pending"); topBar(); hideSplash(); }
      else showLogin();
    }
    var timer = setTimeout(function () { resolve(null); }, 6000);
    api("methods").then(function (r) { methods.google = !!(r.body && r.body.google); methods.googleClientId = (r.body && r.body.googleClientId) || null; methods.apple = !!(r.body && r.body.apple); methods.nafath = !!(r.body && r.body.nafath); }).catch(function () {})
      .then(function () { return api("me"); })
      .then(function (r) { clearTimeout(timer); resolve(r.body && r.body.session); })
      .catch(function () { clearTimeout(timer); resolve(null); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
