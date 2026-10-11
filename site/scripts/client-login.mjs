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
`;

// شعار Google الرسمي (أربعة ألوان) — يُرسم في الزرّ البديل فقط حتى يجهز زرّ Google نفسه.
const G_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.3-3.9 6.8-9.7 6.8-17z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;

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
var LX=${JSON.stringify(tx)},LL=${JSON.stringify(l)},G=${JSON.stringify(G_SVG)};
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
window.SV1Login={otp:otp,methods:methods,mountGoogle:mountGoogle,inApp:INAPP,or:LX.or,t:LX};
})();`;
}
