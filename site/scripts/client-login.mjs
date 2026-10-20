// بابُ دخول العميل الموحَّد — «المتابعة بجوجل» و«رابط بالبريد» في كل مكان يدخل منه عميل.
// يملكه client-portal (docs/projects.md). يُستعمل في /my وفي نافذة الدخول داخل المحادثة.
//
// لماذا هذا الملف موجود (2026-10-11): قال المالك «فين الدخول بجوجل كتسجيل دخول؟».
// التشخيص بمتصفح حقيقي على الموقع الحيّ: زرّ Google **يظهر** في /my ويفتح نافذة
// Google بلا خطأ نطاق (النطاق مضاف في Google Cloud). أي أن المشكلة ليست إعداداً بل
// ثلاثة عيوب في الكود:
//   ١) زرّ «دخول» مخفيّ على الجوال (قائمة ☰ فيها «حسابي» فقط) — الشاشة التي ينظر
//      فيها المالك لا تقول «دخول» أصلاً.
//   ٢) نافذة الدخول داخل المحادثة (الرئيسية) برمز البريد وحده بلا Google.
//   ٣) في /my كان Google آخر عنصر تحت البريد وكلمة المرور، وإذا لم يُحمَّل سكربت
//      Google (شبكة تحجبه، أو متصفح داخل تطبيق) اختفى الزرّ **وعنوانه** بلا أثر —
//      فيظن الزائر أن لا دخول بجوجل.
// فصار Google أول خيار، وله حالةُ فشلٍ مكتوبة بدل الاختفاء الصامت.
//
// القواعد التي يحرسها الملف:
//  • لا يُكتب هنا شيءٌ بشرطة مائلة عكسية: النص كله داخل قالب نصّي والقالب يلتهمها
//    عند البناء (انظر التعليق قرب nextPath في simple-v1-my.mjs). لذلك لا تعابير نمطية.
//  • الاستجابة من الخادم هي مصدر الحقيقة: Google يُرسم فقط إن قال `methods` إنه مُفعَّل.
//  • لا سرّ في الصفحة: معرّف عميل OAuth عامٌّ بطبيعته ويأتي من الخادم.

const TEXT = {
  btn: { ar: "المتابعة بجوجل", en: "Continue with Google", fr: "Continuer avec Google", zh: "使用 Google 继续" },
  loading: { ar: "جارٍ تجهيز الدخول بجوجل…", en: "Getting Google sign-in ready…", fr: "Préparation de la connexion Google…", zh: "正在准备 Google 登录…" },
  fail: {
    ar: "تعذّر عرض الدخول بجوجل — قد تحجبه شبكتك أو إضافة في المتصفح، أو لا يعمل على هذا العنوان. ادخل برابط البريد أدناه.",
    en: "Google sign-in could not be shown — your network or a browser extension may be blocking it, or it is not enabled on this address. Use the e-mail link below.",
    fr: "La connexion Google n'a pas pu s'afficher — votre réseau ou une extension la bloque peut-être, ou elle n'est pas activée sur cette adresse. Utilisez le lien par e-mail ci-dessous.",
    zh: "无法显示 Google 登录——可能被网络或浏览器扩展拦截，或此网址未启用。请使用下方的邮件链接登录。",
  },
  err: {
    ar: "تعذّر الدخول بحساب Google. جرّب رابط البريد أدناه.",
    en: "Google sign-in did not go through. Try the e-mail link below.",
    fr: "La connexion Google a échoué. Essayez le lien par e-mail ci-dessous.",
    zh: "Google 登录未成功。请使用下方的邮件链接。",
  },
  inapp: {
    ar: "إن لم يعمل الزر: افتح هذه الصفحة في Safari أو Chrome — متصفحات التطبيقات (واتساب، إنستغرام…) تمنع Google.",
    en: "If the button does nothing, open this page in Safari or Chrome — in-app browsers (WhatsApp, Instagram…) block Google.",
    fr: "Si le bouton ne répond pas, ouvrez cette page dans Safari ou Chrome — les navigateurs intégrés (WhatsApp, Instagram…) bloquent Google.",
    zh: "如果按钮没有反应，请在 Safari 或 Chrome 中打开此页面——应用内浏览器（WhatsApp、Instagram 等）会拦截 Google。",
  },
  or: { ar: "أو بالبريد الإلكتروني", en: "Or with your e-mail", fr: "Ou avec votre e-mail", zh: "或使用邮箱" },
  orPlain: { ar: "أو", en: "or", fr: "ou", zh: "或" },

  // ---- Nafath (الباب الأول) --------------------------------------------------
  nfTitle: { ar: "الدخول عبر نفاذ", en: "Sign in with Nafath", fr: "Se connecter avec Nafath", zh: "使用 Nafath 登录" },
  nfSub: {
    ar: "الأسرع والأكثر أماناً. أول دخول ينشئ حسابك تلقائياً.",
    en: "The fastest, most secure way in. Your first sign-in creates your account automatically.",
    fr: "Le moyen le plus rapide et le plus sûr. Votre première connexion crée votre compte automatiquement.",
    zh: "最快、最安全的方式。首次登录将自动为您创建账户。",
  },
  nfLabel: { ar: "رقم الهوية الوطنية أو الإقامة", en: "National ID or Iqama number", fr: "N° d'identité nationale ou d'Iqama", zh: "身份证或居留证号码" },
  nfPh: { ar: "١٠ أرقام", en: "10 digits", fr: "10 chiffres", zh: "10 位数字" },
  nfBtn: { ar: "الدخول عبر نفاذ", en: "Continue with Nafath", fr: "Continuer avec Nafath", zh: "通过 Nafath 继续" },
  nfSending: { ar: "جارٍ إرسال الطلب إلى نفاذ…", en: "Sending the request to Nafath…", fr: "Envoi de la demande à Nafath…", zh: "正在向 Nafath 发送请求…" },
  nfWaitTitle: { ar: "افتح تطبيق نفاذ على جوالك", en: "Open the Nafath app on your phone", fr: "Ouvrez l'application Nafath sur votre téléphone", zh: "请在手机上打开 Nafath 应用" },
  nfWaitText: {
    ar: "اختر هذا الرقم من بين الأرقام الظاهرة في التطبيق لتأكيد دخولك:",
    en: "Pick this number among the numbers shown in the app to confirm your sign-in:",
    fr: "Choisissez ce numéro parmi ceux affichés dans l'application pour confirmer votre connexion :",
    zh: "请在应用显示的数字中选择此数字，以确认登录：",
  },
  nfWaiting: { ar: "بانتظار تأكيدك في التطبيق…", en: "Waiting for your confirmation in the app…", fr: "En attente de votre confirmation dans l'application…", zh: "正在等待您在应用中确认…" },
  nfHint: {
    ar: "لم يصلك إشعار؟ افتح تطبيق نفاذ يدوياً. لا تختر رقماً مختلفاً.",
    en: "No notification? Open the Nafath app yourself. Do not pick a different number.",
    fr: "Pas de notification ? Ouvrez vous-même l'application Nafath. Ne choisissez pas un autre numéro.",
    zh: "没有收到通知？请自行打开 Nafath 应用。切勿选择其他数字。",
  },
  nfDone: { ar: "تم التحقق من هويتك ✓", en: "Your identity is verified ✓", fr: "Votre identité est vérifiée ✓", zh: "身份验证成功 ✓" },
  nfDoneNext: { ar: "جارٍ فتح حسابك…", en: "Opening your account…", fr: "Ouverture de votre compte…", zh: "正在打开您的账户…" },
  nfRejected: { ar: "رُفض الطلب من تطبيق نفاذ.", en: "The request was rejected in the Nafath app.", fr: "La demande a été refusée dans l'application Nafath.", zh: "Nafath 应用已拒绝该请求。" },
  nfExpired: { ar: "انتهت صلاحية الطلب. ابدأ من جديد.", en: "The request expired. Start again.", fr: "La demande a expiré. Recommencez.", zh: "请求已过期，请重新开始。" },
  nfRetry: { ar: "حاول مرة أخرى", en: "Try again", fr: "Réessayer", zh: "重试" },
  nfCancel: { ar: "إلغاء", en: "Cancel", fr: "Annuler", zh: "取消" },
  nfFail: { ar: "تعذّر الوصول إلى نفاذ الآن. حاول بعد قليل أو ادخل بطريقة أخرى.", en: "Nafath could not be reached. Try again shortly, or use another way in.", fr: "Impossible de joindre Nafath. Réessayez dans un instant ou choisissez un autre moyen.", zh: "暂时无法连接 Nafath。请稍后重试或使用其他方式登录。" },
  nfMany: { ar: "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.", en: "Too many attempts. Wait a minute and try again.", fr: "Trop de tentatives. Patientez une minute puis réessayez.", zh: "尝试次数过多，请稍等一分钟再试。" },
  nfDaily: {
    ar: "بلغ الدخول عبر نفاذ حدّه اليومي. ادخل الآن بحساب Google أو بالبريد الإلكتروني، أو جرّب نفاذ غداً.",
    en: "Nafath sign-in has reached today's limit. Use Google or your e-mail now, or try Nafath tomorrow.",
    fr: "La connexion Nafath a atteint sa limite quotidienne. Utilisez Google ou votre e-mail, ou réessayez demain.",
    zh: "今日 Nafath 登录次数已达上限。请改用 Google 或邮箱登录，或明天再试。",
  },
  nfSoon: {
    ar: "الدخول عبر نفاذ سيتوفر قريباً. ادخل الآن بحساب Google أو بالبريد الإلكتروني.",
    en: "Nafath sign-in is coming soon. Use Google or your e-mail for now.",
    fr: "La connexion Nafath arrive bientôt. Utilisez Google ou votre e-mail pour l'instant.",
    zh: "Nafath 登录即将开通。目前请使用 Google 或邮箱登录。",
  },
  nfBad10: { ar: "رقم الهوية أو الإقامة عشرة أرقام.", en: "A national ID or Iqama number has 10 digits.", fr: "Un numéro d'identité ou d'Iqama comporte 10 chiffres.", zh: "身份证或居留证号码为 10 位数字。" },
  nfBadPrefix: { ar: "رقم الهوية غير صحيح. راجع الرقم وأعد المحاولة.", en: "That ID number is not valid. Check it and try again.", fr: "Ce numéro n'est pas valide. Vérifiez-le et réessayez.", zh: "号码无效，请检查后重试。" },
  nfPrefix9: { ar: "هذا الرقم لا تدعمه خدمة نفاذ للتحقق.", en: "Nafath cannot verify this number.", fr: "Nafath ne peut pas vérifier ce numéro.", zh: "Nafath 无法验证此号码。" },
};

// يُحقَن CSS هذا الملف داخل <style> الصفحة التي تستعمله. الألوان من رموز SV1 نفسها
// (--line · --mut · --ink) فيتّسق الشكل مع بقية الصفحة بلا لون جديد.
export const CLIENT_LOGIN_CSS = `
.bpg{margin:0 0 6px}
.bpg-host{display:flex;justify-content:center;min-height:44px}
.bpg-ph{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:44px;padding:0 14px;border:1px solid var(--line,#E5E9F0);border-radius:12px;background:#fff;color:#1f2937;font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:border-color .15s,background .15s}
.bpg-ph:hover{border-color:var(--acLine,#C3CDE6);background:var(--soft,#F5F7FB)}
.bpg-ph svg{width:18px;height:18px;flex:none}
.bpg-ph[disabled]{opacity:.6;cursor:progress}
.bpg-note{margin:8px 0 0;font-size:12.5px;line-height:1.7;color:var(--mut,#5A6478);text-align:center}
.bpg-note.err{color:#b91c1c}
.bpg-or{display:flex;align-items:center;gap:10px;margin:14px 0 10px;color:var(--faint,#8D97AE);font-size:12.5px}
.bpg-or:before,.bpg-or:after{content:"";flex:1;height:1px;background:var(--line,#E5E9F0)}
/* Nafath: the first door, so the largest. Tokens are SV1's own; nothing new. */
.nf{border:1.5px solid var(--acLine,#C3CDE6);border-radius:16px;padding:16px 16px 14px;background:linear-gradient(180deg,var(--acSoft,#EEF2FB),#fff 70%)}
.nf-h{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.nf-badge{flex:none;width:42px;height:42px;border-radius:12px;background:var(--n,#0B1B5A);color:#fff;display:grid;place-items:center}
.nf-badge svg{width:23px;height:23px}
.nf-h b{display:block;color:var(--ink,#0B1B5A);font-size:1.02rem;line-height:1.35}
.nf-sub{margin:2px 0 0!important;font-size:.82rem!important;line-height:1.6;color:var(--mut,#5A6478)}
.nf label{display:block;margin:0 0 5px;font-size:.84rem;font-weight:600;color:var(--ink,#0B1B5A)}
.nf .nf-in{width:100%;box-sizing:border-box;border:1px solid var(--line,#E5E9F0);border-radius:10px;padding:12px;font:inherit;font-size:16px;letter-spacing:.14em;text-align:center;direction:ltr;background:#fff;margin:0 0 10px}
.nf .nf-in:focus{outline:2px solid var(--ac,#0B1B5A);outline-offset:1px}
.nf .nf-btn{width:100%;min-height:46px;border-radius:12px;border:1px solid var(--n,#0B1B5A);background:var(--n,#0B1B5A);color:#fff;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer}
.nf .nf-btn[disabled]{opacity:.55;cursor:not-allowed}
.nf .nf-btn.ghost{background:#fff;color:var(--n,#0B1B5A)}
.nf-msg{margin:10px 0 0!important;font-size:.84rem!important;line-height:1.7;color:var(--mut,#5A6478)}
.nf-msg.err{color:#b91c1c}.nf-msg.ok{color:var(--ok,#047857);font-weight:700}
.nf-wait{text-align:center}
.nf-wait h4{margin:0 0 4px;font-size:1rem;color:var(--ink,#0B1B5A)}
.nf .nf-wait p{margin:0 0 10px;font-size:.86rem;line-height:1.7;color:var(--mut,#5A6478)}
.nf-num{width:92px;height:92px;margin:6px auto 12px;border-radius:50%;border:3px solid var(--n,#0B1B5A);display:grid;place-items:center;font-size:2.4rem;font-weight:700;color:var(--ink,#0B1B5A);font-variant-numeric:tabular-nums;direction:ltr;background:#fff}
.nf-dots{display:inline-flex;gap:5px;vertical-align:middle;margin-inline-end:8px}
.nf-dots i{width:7px;height:7px;border-radius:50%;background:var(--n,#0B1B5A);opacity:.25;animation:nfp 1.2s infinite}
.nf-dots i:nth-child(2){animation-delay:.2s}.nf-dots i:nth-child(3){animation-delay:.4s}
@keyframes nfp{0%,100%{opacity:.25}50%{opacity:1}}
@media(prefers-reduced-motion:reduce){.nf-dots i{animation:none;opacity:.6}}
.nf-link{display:inline-block;margin-top:8px;color:var(--n,#0B1B5A);text-decoration:underline;cursor:pointer;font-size:.84rem;background:none;border:0;font-family:inherit}
.nf-ok{width:62px;height:62px;margin:4px auto 10px;border-radius:50%;background:var(--okSoft,#E7F4EF);color:var(--ok,#047857);display:grid;place-items:center}
.nf-ok svg{width:32px;height:32px}
.nf-dev{margin:8px 0 0!important;font-size:.74rem!important;color:var(--faint,#8D97AE)!important;text-align:center;direction:ltr}
`;

// شعار Google الرسمي (أربعة ألوان) — يُرسم في الزرّ البديل فقط حتى يجهز زرّ Google نفسه.
const G_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.3-3.9 6.8-9.7 6.8-17z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;

// أيقونة درعٍ عامة بعلامة صح — ليست شعار نفاذ الرسمي ولا تقلّده.
const NF_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6l7-3z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>`;
const NF_OK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
// أول أرقام تقبلها خدمة الحالة عند نفاذ — مرآة NATIONAL_ID_FIRST_DIGITS في api/_nafath.js
// (يمسكهما اختبارٌ معاً). لا تُكتب هنا بتعبير نمطي: الشرطة المائلة العكسية يلتهمها القالب.
export const NATIONAL_ID_FIRST_DIGITS = "123456";

// السكربت المشترك. يعرّف window.SV1Login مرةً واحدة؛ كل صفحة تستدعي mountGoogle
// على عنصرٍ فارغ تملكه. اللغة تُحقَن عند البناء فلا ترجمة في المتصفح.
export function clientLoginScript(lang) { return `<script>${clientLoginJs(lang)}</script>`; }
// الجسم بلا وسم <script> — لصفحةٍ تحتفظ بسكربتٍ واحد (صفحة الدفع: اختباراتها تشغّل سكربتها
// في بيئة مصغَّرة وتتوقع وسماً واحداً). أسماء المتغيرات هنا بلا TX/LANG حتى لا تلتقطها
// تعابيرها النمطية (`var TX=`) من هذا الجسم بدل جسم الصفحة.
export function clientLoginJs(lang) {
  const l = ["ar", "en", "fr", "zh"].includes(lang) ? lang : "en";
  const tx = {};
  for (const k of Object.keys(TEXT)) tx[k] = TEXT[k][l] != null ? TEXT[k][l] : TEXT[k].en;
  return `(function(){"use strict";
if(window.SV1Login)return;
var LX=${JSON.stringify(tx)},LL=${JSON.stringify(l)},G=${JSON.stringify(G_SVG)},NF_SVG=${JSON.stringify(NF_SVG)},NF_OK=${JSON.stringify(NF_OK)},NF_FIRST=${JSON.stringify(NATIONAL_ID_FIRST_DIGITS)};
function otp(d){return fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json()})}
// ما تعرضه هذه النشرة من أبواب الدخول — طلبٌ واحد تتشاركه كل الأزرار في الصفحة.
var M=null;function methods(){if(!M)M=otp({action:'methods'}).catch(function(){return null});return M}
// متصفحات داخل التطبيقات تمنع Google (سياسة Google نفسها: disallowed_useragent).
var APPS=['FBAN','FBAV','FB_IAB','Instagram','Snapchat','MicroMessenger','TikTok','Twitter','WhatsApp','Line/','; wv)'];
var UA=String((typeof navigator!=='undefined'&&navigator.userAgent)||'');
var INAPP=APPS.some(function(s){return UA.indexOf(s)>=0});
var gsi=null;
function loadGsi(){
 if(gsi)return gsi;
 gsi=new Promise(function(ok,no){
  if(window.google&&window.google.accounts&&window.google.accounts.id)return ok();
  var sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;sc.defer=true;
  sc.onload=function(){ok()};sc.onerror=function(){no(new Error('gsi'))};
  document.head.appendChild(sc);
  setTimeout(function(){no(new Error('gsi-timeout'))},9000)});
 return gsi}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
// opt: {onSuccess(o), onError(msg)} — o هو ردّ otp {action:'google'} الناجح.
// يُرسَم زرٌّ بديل فوراً (لا فراغ ولا اختفاء)، ويحلّ محلّه زرّ Google الرسمي حين يجهز.
// فشل التحميل يُكتب للزائر بدل أن يختفي الزرّ.
function mountGoogle(slot,opt){
 opt=opt||{};slot.innerHTML='';slot.className=(slot.className+' bpg').trim();
 var host=el('div','bpg-host'),ph=el('button','bpg-ph');ph.type='button';ph.innerHTML=G;
 var lab=el('span',null,LX.btn);ph.appendChild(lab);host.appendChild(ph);slot.appendChild(host);
 var note=el('p','bpg-note');note.hidden=true;slot.appendChild(note);
 function say(t,err){note.hidden=!t;note.textContent=t||'';note.className='bpg-note'+(err?' err':'')}
 if(INAPP)say(LX.inapp,false);
 var state='wait';
 ph.onclick=function(){if(state==='fail')say(LX.fail,true);else say(LX.loading,false)};
 methods().then(function(m){
  if(!m||!m.ok||!m.google||!m.googleClientId){slot.hidden=true;if(opt.onHide)opt.onHide();return}
  return loadGsi().then(function(){
   var cb=function(resp){
    otp({action:'google',credential:resp&&resp.credential}).then(function(o){
     if(o&&o.ok&&o.db!==false){if(opt.onSuccess)opt.onSuccess(o);return}
     if(opt.onError)opt.onError(LX.err)}).catch(function(){if(opt.onError)opt.onError(LX.err)})};
   window.google.accounts.id.initialize({client_id:m.googleClientId,callback:cb,auto_select:false,itp_support:true});
   var w=Math.round(slot.getBoundingClientRect().width)||320;w=Math.max(200,Math.min(400,w));
   var real=el('div');real.style.cssText='position:absolute;visibility:hidden;pointer-events:none';host.appendChild(real);
   window.google.accounts.id.renderButton(real,{theme:'outline',size:'large',text:'continue_with',shape:'rectangular',logo_alignment:'left',width:w,locale:LL});
   // الزرّ الرسمي يُرسم داخل iframe بعد لحظات. لا يُستبدل البديل بمجرد ظهوره: حين ترفض Google
   // النطاق («The given origin is not allowed for the given client ID») أو المعرّف، يظهر
   // الـiframe لحظةً ثم ينهار إلى 0×0 ويختفي الزرّ بلا أثر — وهذا بالضبط ما يراه من يفتح
   // الصفحة على عنوانٍ لم يُضَف في Google Cloud (معاينة Vercel مثلاً). فلا نكشفه إلا إذا بقي
   // ظاهراً ثانيةً ونصفاً، وإن انهار بعد الكشف رجع البديل ومعه السبب مكتوباً.
   var tries=0,stable=0;
   // الزرّ المرئي (div) يبقى في الصفحة حتى حين ترفض Google النطاق، أما الـiframe الشفّاف فوقه
   // — وهو الذي يستقبل النقر — فينهار إلى 0×0. فالحكم على الـiframe حين يوجد.
   function seen(){var f=real.querySelector('iframe');if(f)return f.offsetHeight>0&&f.offsetWidth>0;var d=real.querySelector('div[role=button]');return !!(d&&d.offsetHeight>0)}
   function reveal(){real.style.cssText='';ph.hidden=true;state='ready';say('');if(INAPP)say(LX.inapp,false);
    var n=0;(function watch(){if(!seen()){hard();return}if(++n<12)setTimeout(watch,1000)})()}
   function soft(){state='fail';say(LX.fail,true)}
   function hard(){state='fail';ph.hidden=false;real.remove();say(LX.fail,true)}
   (function wait(){
    if(seen())stable++;else stable=0;
    if(stable>=8){reveal();return}
    tries++;
    if(tries===25)soft();      // بعد نحو ثلاث ثوانٍ ونصف: السبب مكتوب، والبديل ظاهر، والانتظار مستمر
    if(tries>70){hard();return}  // ثم يُترك
    setTimeout(wait,150)})()
  })}).catch(function(){state='fail';say(LX.fail,true)})}
// ---- Nafath ----------------------------------------------------------------
// The id is checked here with the same rule api/_nafath.js applies (a test keeps
// the two in step), so a mistyped number is caught before it rings anyone's
// phone. Arabic-Indic digits are converted first: a Saudi keyboard types them as
// readily as 0-9, and a check that only sees ASCII would call them "not digits".
function nfNorm(v){var s=String(v==null?'':v),o='',i,c;for(i=0;i<s.length;i++){c=s.charCodeAt(i);
 if(c>=48&&c<=57)o+=s.charAt(i);else if(c>=1632&&c<=1641)o+=String(c-1632);else if(c>=1776&&c<=1785)o+=String(c-1776)}return o}
function nfState(v){var d=nfNorm(v);if(d.length!==10)return{ok:false,reason:'must_be_10_digits'};
 if(NF_FIRST.indexOf(d.charAt(0))<0)return{ok:false,reason:d.charAt(0)==='9'?'unsupported_prefix_9':'bad_prefix'};
 return{ok:true,value:d}}
function nfWhy(r){return r==='must_be_10_digits'?LX.nfBad10:r==='unsupported_prefix_9'?LX.nfPrefix9:LX.nfBadPrefix}
// What a failed answer from the server means to this visitor, in this language.
function nfErr(o){var e=o&&o.error;
 if(e==='daily_limit')return LX.nfDaily;if(e==='too_many')return LX.nfMany;
 if(e==='must_be_10_digits'||e==='unsupported_prefix_9'||e==='bad_prefix')return nfWhy(e);
 if(e==='nafath_not_configured'||e==='nafath_service_not_configured'||e==='not_implemented'||e==='nafath_provider_unknown')return LX.nfSoon;
 return LX.nfFail}
// opt: {onSuccess(o), purpose}. o is the poll answer that opened the session; when
// o.needsContact is true the account was just created and still needs a real
// e-mail and mobile (the page asks for them next).
function mountNafath(slot,opt){
 opt=opt||{};slot.innerHTML='';slot.className=(slot.className+' nf').trim();
 var badge=el('div','nf-badge');badge.innerHTML=NF_SVG;
 var head=el('div','nf-h');var tt=el('div');tt.appendChild(el('b',null,LX.nfTitle));tt.appendChild(el('p','nf-sub',LX.nfSub));head.appendChild(badge);head.appendChild(tt);slot.appendChild(head);
 var form=el('div','nf-form');
 var lab=el('label',null,LX.nfLabel);var inp=el('input','nf-in');inp.type='text';inp.setAttribute('inputmode','numeric');inp.setAttribute('autocomplete','off');inp.maxLength=10;inp.placeholder=LX.nfPh;inp.id='nfId'+Math.floor(Math.random()*1e6);lab.setAttribute('for',inp.id);
 var btn=el('button','nf-btn',LX.nfBtn);btn.type='button';
 var msg=el('p','nf-msg');msg.hidden=true;msg.setAttribute('role','alert');
 form.appendChild(lab);form.appendChild(inp);form.appendChild(btn);form.appendChild(msg);slot.appendChild(form);
 var wait=el('div','nf-wait');wait.hidden=true;slot.appendChild(wait);
 var dev=el('p','nf-dev');dev.hidden=true;slot.appendChild(dev);
 var dead=false,timer=null,sid=0;
 function say(t,kind){msg.hidden=!t;msg.textContent=t||'';msg.className='nf-msg'+(kind?' '+kind:'')}
 function showForm(){dead=true;clearTimeout(timer);wait.hidden=true;wait.innerHTML='';form.hidden=false;btn.disabled=false;inp.disabled=false}
 var can=true;
 methods().then(function(m){var n=m&&m.nafath;
  if(n&&n.available===false){can=false;inp.disabled=true;btn.disabled=true;say(LX.nfSoon,'')}
  if(n&&n.provider==='mock'){dev.hidden=false;dev.textContent='DEV mock: ID ending 7 = rejected, 8 = expired, other = approved after ~6 s'}
 }).catch(function(){});
 function start(){
  var s=nfState(inp.value);if(!s.ok){say(nfWhy(s.reason),'err');inp.focus();return}
  btn.disabled=true;inp.disabled=true;say(LX.nfSending,'');
  otp({action:'nafath-start',nationalId:s.value,purpose:opt.purpose||'portal',locale:LL}).then(function(o){
   if(!o||!o.ok||!o.random||!o.challenge){btn.disabled=!can;inp.disabled=!can;say(nfErr(o),'err');return}
   inp.value='';wait_(String(o.random),o.challenge)
  }).catch(function(){btn.disabled=!can;inp.disabled=!can;say(LX.nfFail,'err')})}
 btn.onclick=start;inp.addEventListener('keydown',function(ev){if(ev.key==='Enter')start()});
 function wait_(random,ch){
  dead=false;form.hidden=true;say('');wait.hidden=false;wait.innerHTML='';
  wait.appendChild(el('h4',null,LX.nfWaitTitle));wait.appendChild(el('p',null,LX.nfWaitText));
  var num=el('div','nf-num',random);num.setAttribute('aria-label',random);wait.appendChild(num);
  var st=el('p','nf-msg');var dots=el('span','nf-dots');dots.innerHTML='<i></i><i></i><i></i>';st.appendChild(dots);st.appendChild(document.createTextNode(LX.nfWaiting));st.setAttribute('role','status');wait.appendChild(st);
  wait.appendChild(el('p','nf-sub',LX.nfHint));
  var cancel=el('button','nf-link',LX.nfCancel);cancel.type='button';cancel.onclick=function(){showForm()};wait.appendChild(cancel);
  var t0=Date.now(),fails=0,my=++sid;
  function end(text){dead=true;clearTimeout(timer);wait.innerHTML='';var m=el('p','nf-msg err',text);m.setAttribute('role','alert');wait.appendChild(m);
   var again=el('button','nf-btn ghost',LX.nfRetry);again.type='button';again.onclick=function(){showForm();inp.focus()};wait.appendChild(again)}
  function done(o){dead=true;clearTimeout(timer);wait.innerHTML='';var ok=el('div','nf-ok');ok.innerHTML=NF_OK;wait.appendChild(ok);
   var m=el('p','nf-msg ok',LX.nfDone);m.setAttribute('role','status');wait.appendChild(m);wait.appendChild(el('p','nf-sub',LX.nfDoneNext));
   setTimeout(function(){if(opt.onSuccess)opt.onSuccess(o)},opt.successDelay==null?900:opt.successDelay)}
  function next(){if(dead||my!==sid)return;if(Date.now()-t0>600000){end(LX.nfExpired);return}timer=setTimeout(poll,opt.pollMs||3000)}
  function poll(){if(dead||my!==sid)return;
   otp({action:'nafath-poll',challenge:ch}).then(function(o){if(dead||my!==sid)return;
    if(o&&o.ok&&o.status==='WAITING'){fails=0;next();return}
    if(o&&o.ok&&o.status==='COMPLETED'&&o.db!==false){done(o);return}
    if(o&&o.ok&&o.status==='REJECTED'){end(LX.nfRejected);return}
    if(o&&o.ok&&o.status==='EXPIRED'){end(LX.nfExpired);return}
    if(o&&o.error==='expired_challenge'){end(LX.nfExpired);return}
    if(o&&o.error==='bind_failed'){end(LX.nfFail);return}
    if(++fails>=4){end(LX.nfFail);return}next()
   }).catch(function(){if(dead||my!==sid)return;if(++fails>=4){end(LX.nfFail);return}next()})}
  timer=setTimeout(poll,opt.firstPollMs||2000)}
}
window.SV1Login={otp:otp,methods:methods,mountGoogle:mountGoogle,mountNafath:mountNafath,nid:nfState,inApp:INAPP,or:LX.or,orPlain:LX.orPlain,t:LX};
})();`;
}
