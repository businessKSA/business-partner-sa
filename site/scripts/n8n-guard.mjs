// Business Partner — حارس n8n في المتصفح.
//
// عدّة صفحات مولَّدة ترسل **من المتصفح مباشرةً** إلى ويبهوكات n8n الإنتاجية
// (businesspartnerai.app.n8n.cloud/webhook/...): نموذج تسكين العمالة، ومحادثات
// فريق الوكلاء في /portal و/dashboard، وبوابة الخدمات المشتركة، ولوحة الامتثال.
// فكل من فتح الموقع على `localhost` أو على معاينة Vercel أو جرّب نموذجاً —
// بحسابٍ تجريبي أو بيانات وهمية — كان يُطلق عملية إنتاجية حقيقية: رسالة
// للمالك، وسجلّ عميل، وقد يصل إلى تنبيه واتساب. (رُصد في تدقيق رحلة العميل
// 2026-10-10: «تنبيه السلامة» البند ٣.)
//
// القاعدة: إن كان `location.hostname` هو `localhost` أو `127.0.0.1` أو `::1`
// أو نطاقاً ينتهي بـ`.vercel.app` فلا يخرج شيء إلى n8n. يُسجَّل في الكونسول
// ويُظهر النموذج/المحادثة «وضع اختبار — لم يُرسَل». والإنتاج على
// `businesspartner.sa` (وأي نطاق آخر) بلا أي تغيير في السلوك — الحارس يعود في
// أول سطر بعد حساب العلَم.
//
// طبقتان:
//  1) **شبكة أمان عامة**: يلفّ `fetch` و`XMLHttpRequest.open/send` و`sendBeacon`
//     فيرفض أي طلب إلى مضيفٍ ينتهي بـ`n8n.cloud`. تحمي صفحةً لم يعدّلها أحد
//     (لوحة الامتثال المكتوبة يدوياً، ومراقب المحادثات) ونداءً يُضاف غداً.
//  2) **علَمٌ وجملة**: `window.BP_TEST_MODE` و`window.bpTestNote(what)` تعيد
//     النص بلغة الصفحة وتكتب في الكونسول؛ تستعملها مواضع الإرسال الرئيسية لتعرض
//     الحالة الصادقة بدل «تعذّر الاتصال».
//
// عناوين الويبهوك لا تتغيّر. يُحقن الحارس في `write()` (generate.mjs) في كل صفحة
// تحوي `n8n.cloud/webhook`، مباشرةً بعد وسم الترميز وقبل أي سكربت آخر.

export const GUARD_ID = "bp-n8n-guard";

// ‏المضيفات التي تُعدّ اختباراً. دالة خالصة ليختبرها tests/n8n-guard.test.mjs
// بنفس المنطق الذي يُحقن في الصفحة (الحقن يطبع نص هذه الدالة نفسها).
export function isTestHost(h) {
  h = String(h == null ? "" : h).toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]" || /\.vercel\.app$/.test(h);
}

const NOTE = {
  ar: "وضع اختبار — لم يُرسَل",
  en: "Test mode — not sent",
  fr: "Mode test — non envoyé",
  zh: "测试模式 — 未发送",
};

export function n8nGuardScript() {
  return `<script id="${GUARD_ID}">(function(){
var isTestHost=${isTestHost.toString()};
var T=false;try{T=isTestHost(location.hostname)}catch(e){}
window.BP_TEST_MODE=T;
if(!T)return;
var NOTE=${JSON.stringify(NOTE)};
function lang(){var l=(document.documentElement.getAttribute('lang')||'ar').toLowerCase().slice(0,2);return NOTE[l]?l:'en'}
window.bpTestNote=function(what){var m=NOTE[lang()];try{console.info('[BP test mode] not sent to n8n'+(what?' ('+what+')':'')+' — '+location.hostname)}catch(e){}return m};
function n8n(u){try{var s=(u&&u.url)||u;return /(^|\\.)n8n\\.cloud$/i.test(new URL(String(s),location.href).hostname)}catch(e){return false}}
function block(u,how){try{console.info('[BP test mode] blocked '+how+' to n8n: '+String(u&&u.url||u))}catch(e){}}
var F=window.fetch;
if(F)window.fetch=function(u){if(n8n(u)){block(u,'fetch');var er=new Error('BP test mode: request to n8n blocked');er.bpTestMode=true;return Promise.reject(er)}return F.apply(this,arguments)};
var XO=window.XMLHttpRequest&&XMLHttpRequest.prototype.open,XS=window.XMLHttpRequest&&XMLHttpRequest.prototype.send;
if(XO&&XS){
XMLHttpRequest.prototype.open=function(m,u){this.__bpN8n=n8n(u);if(this.__bpN8n)block(u,'xhr');return XO.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(){if(this.__bpN8n){var x=this;setTimeout(function(){try{x.dispatchEvent(new Event('error'))}catch(e){}},0);return}return XS.apply(this,arguments)}}
var SB=navigator.sendBeacon;
if(SB)navigator.sendBeacon=function(u){if(n8n(u)){block(u,'beacon');return false}return SB.apply(navigator,arguments)};
})();</script>`;
}

// ‏يحقن الحارس في صفحةٍ تحوي ويبهوك n8n. مرّةً واحدة، وبعد وسم الترميز إن وُجد
// (الترميز يجب أن يقع في أول ١٠٢٤ بايتاً) وإلا بعد <head>.
export function injectN8nGuard(html) {
  if (!/n8n\.cloud\/webhook/.test(html) || html.includes(`id="${GUARD_ID}"`)) return html;
  const g = n8nGuardScript();
  const meta = html.match(/<meta[^>]+charset[^>]*>/i);
  if (meta) return html.replace(meta[0], () => meta[0] + g);
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.replace(head[0], () => head[0] + g);
  return g + html;
}
