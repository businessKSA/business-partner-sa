// ترويسة واحدة للموقع كله (قرار المالك 2026-09-24).
//
// كان في الموقع نظاما ترويسة: صفحات Simple V1 الست تبنيها `SV1.shell()`
// بترويسة `sv1-hdr` (شريط حالة + أربعة روابط)، وكل الباقي — أكثر من ١٣٠٠
// صفحة — كان يأخذ من هنا ترويسةً أخرى بقائمة ضخمة وسبعة مداخل. هذا وحده ما
// كان يجعل الموقع يبدو موقعين. هذا السكربت الآن يضع **ترويسة SV1 نفسها** على
// الصفحات القديمة: نفس الأصناف، نفس النصوص، نفس المعرّفات.
//
// من أين تأتي؟ من `simple-v1.mjs` مباشرة: `SV1_CSS` و`SV1_TEXT`. لا نسخة
// ثانية تُكتب بيدٍ هنا فتفترق عن الأصل بعد شهر. ما يُكتب هنا هو الفرق
// الحقيقي بين الحالتين فقط:
//
//  1) الصفحة القديمة بلا غلاف `<div class="sv1">`، والمتغيّرات (--l، --ac…)
//     و`.wrap` معرَّفة على ذلك الغلاف. فالترويسة تُلفّ بـ
//     `<div class="sv1 sv1-chrome">` و`display:contents` يشيل صندوق الغلاف
//     فيبقى `position:sticky` مسنداً إلى الصفحة لا إلى الغلاف.
//  2) الصفحة القديمة لا تحمل `CHROME_JS` الخاص بـ`SV1.shell()`، ومن غيره
//     يبقى `#sv1CartN` صفراً و`#sv1CartBtn` مخفياً بـ`sv1-hide` إلى الأبد.
//     فيُحقن هنا نظيرٌ مختصر له — والأهم فيه: الصفحة القديمة **تبيع فعلاً**
//     عبر `.add-cart` في `main.js`، و`main.js` يحدّث `#cart-badge` (لم يعد
//     موجوداً) ولا يطلق أي حدث. لذلك نعيد المزامنة بعد كل ضغطة على
//     `.add-cart` — بلا لمس `main.js`، ومفتاح السلة `bp_cart` نفسه وصيغته
//     نفسها في الموقعين.
//  3) الصفحة القديمة ليست جزءاً من تنقّل SV1، فروابط اللغة تُحسب من مسار
//     الملف نفسه ويُتحقّق من وجود النسخة قبل الربط — وإلا فرابطٌ ميت.
//
// والتذييل كذلك (المالك رآه بعينه 2026-09-24): بعد توحيد الترويسة بقي أسفل
// الصفحة القديمة تذييلُ `generate.mjs` بستة أعمدة ونشرة بريدية، وأسفل
// الجديدة تذييلُ SV1 — فبدا الموقع موقعين من الأسفل. هنا يُستبدل
// `<footer class="site-footer">` ومعه زرّ واتساب العائم القديم `.wa-fab`
// الذي يليه بـ`SV1.footer()` **نفسه**: لا نسخة تُكتب هنا، بل يُنشأ `simpleV1`
// لكل لغة بالسياق ذاته الذي يمرّره `generate.mjs` (site.json، ومجموعة
// «مركز المعرفة» من nav.json) ويُستدعى تذييله. زرّ واتساب جزءٌ من ذلك
// التذييل (`.sv1-wa-fab`)، فيسقط القديم حتى لا يظهر زرّان.
// ما لا يُلمس: تذييل بوابة الموارد البشرية (`site-footer portal-footer`)
// وصفحات SV1 نفسها (تذييلها من `SV1.shell()` ولا `site-footer` فيها).
import fs from 'node:fs';
import path from 'node:path';
import { simpleV1, SV1_CSS, SV1_TEXT, SIMPLE_LANGS, SV1_SESSION_JS, SV1_SESSION_SYNC_JS } from './simple-v1.mjs';

const ROOT = path.resolve('site');
const LANG_NAMES = { ar: 'العربية', en: 'English', fr: 'Français', zh: '中文' };

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(p));
    else if(e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// ------------------------------------------------------------------ CSS --
// قصّ قواعد الترويسة من `SV1_CSS` وقت البناء بدل نسخها: الصفحة القديمة لا
// تحتاج ١٩ كيلوبايت من قواعد الرئيسية واللوحات، وأي تعديل في `simple-v1.mjs`
// يصل إلى هنا وحده لأن القصّ يجري على النص الحيّ لا على نسخة.
function splitRules(css){
  const out=[]; let i=0;
  while(i<css.length){
    const open=css.indexOf('{',i);
    if(open<0) break;
    const sel=css.slice(i,open).trim();
    let d=1,j=open+1;
    while(j<css.length && d>0){ const c=css[j]; if(c==='{')d++; else if(c==='}')d--; j++; }
    out.push({sel, body: css.slice(open+1, j-1)});
    i=j;
  }
  return out;
}

// الأصناف التي تستعملها ترويسة SV1 وتذييله فعلاً، ومعها `.sv1` نفسه لأن
// المتغيّرات تُعرَّف عليه. ما عداها (الرئيسية، اللوحات) يسقط.
const CHROME_PART = /^(\.sv1(?=[\s:.>#[]|$)|\.sv1-(?:ribbon|bar|bar-l|bar-r|bar-langs|pulse|hdr|nav|btn|lang|burger|cart|hide|chrome|foot(?:-[a-z]+)?|wa-fab)(?=[\s:.>#[]|$))/;
const keepSel = (sel) => sel.split(',').some((s) => CHROME_PART.test(s.trim()));

function chromeRules(css){
  const out=[];
  for(const r of splitRules(css)){
    if(r.sel.startsWith('@keyframes')){
      if(/sv1pulse/.test(r.sel)) out.push(`${r.sel}{${r.body}}`);
      continue;
    }
    if(r.sel.startsWith('@')){
      const inner=chromeRules(r.body);
      if(inner) out.push(`${r.sel}{${inner}}`);
      continue;
    }
    if(keepSel(r.sel)) out.push(`${r.sel}{${r.body.trim()}}`);
  }
  return out.join('\n');
}

const CHROME_RULES = chromeRules(
  SV1_CSS.replace(/^<style[^>]*>/, '').replace(/<\/style>$/, '').replace(/\/\*[\s\S]*?\*\//g, '')
);

const css = `<style id="sv1-chrome-css">
${CHROME_RULES}
/* الفرق الوحيد عن صفحات SV1: هناك «.sv1» غلافُ الصفحة كلها، وهنا غلافُ
   الترويسة وحدها. «display:contents» يلغي صندوقه فيبقى «sticky» مسنداً إلى
   الصفحة، وتبقى المتغيّرات و«.sv1 .wrap» نافذةً في الداخل. */
.sv1.sv1-chrome{display:contents}
@media print{.sv1-bar,.sv1-hdr,.sv1-wa-fab{display:none!important}}
/* وضع التضمين (?embed=1) كان يخفي .site-header و.wa-fab؛ لم يعودا موجودين. */
html.bp-embed .sv1-bar,html.bp-embed .sv1-hdr,html.bp-embed .sv1-wa-fab{display:none!important}
</style>`;

// ---------------------------------------------------------------- footer --
// التذييل لا يُكتب هنا: `simpleV1` يُنشأ لكل لغة بالسياق نفسه الذي يمرّره
// `generate.mjs` (لا `head` — لا يلزم إلا لـ`shell()`)، ويُستدعى `footer()`
// الحقيقي. نصّه لا يعتمد على المسار، فيُحسب مرة واحدة لكل لغة.
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
const navData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/nav.json'), 'utf8'));
const knowledge = (Array.isArray(navData.groups) ? navData.groups : []).find((g) => g.en === 'Knowledge Center') || null;
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pathInLang=(p,l)=> (l==='en' ? p : (p==='/' ? `/${l}/` : `/${l}${p}`));
const FOOTER = Object.fromEntries(SIMPLE_LANGS.map((l) => [
  l,
  `<div class="sv1 sv1-chrome">${simpleV1({ lang: () => l, esc, site, head: null, pathInLang, knowledge }).footer()}</div>`,
]));
// التذييل القديم وزرّ واتساب العائم الذي يليه مباشرة في `page()` من generate.mjs.
const OLD_FOOTER = /<footer class="site-footer">[\s\S]*?<\/footer>(?:\s*<a class="wa-fab"[\s\S]*?<\/a>)?/;

// ------------------------------------------------------------------- JS --
// نظير `CHROME_JS` من `SV1.shell()`: زرّ الجوال، عدّاد السلة، وحالة الدخول.
// ما لا يُنسخ: شريط وضع الاختبار (يُدخَل في `.sv1` غلافِ الصفحة، ولا غلاف
// هنا)، و`#sv1SiteBtn` (لا يظهر إلا في /my و/ops، وليست من هذه الصفحات).
const CHROME_JS = `<script>(function(){"use strict";
var $=function(id){return document.getElementById(id)};
var b=$('sv1Burger'),n=$('sv1Nav');
if(b&&n)b.onclick=function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false')};
var cb=$('sv1CartBtn'),cn=$('sv1CartN');
function sync(){var c=[];try{c=JSON.parse(localStorage.getItem('bp_cart'))||[]}catch(e){}
 var k=c.reduce(function(a,i){return a+(Number(i&&i.qty)||1)},0);
 if(cn)cn.textContent=String(k);
 if(cb)cb.classList.toggle('sv1-hide',!k)}
sync();
addEventListener('storage',sync);addEventListener('pageshow',sync);addEventListener('bp:cart',sync);
document.addEventListener('bp:cart',sync);
/* main.js يكتب bp_cart ثم يحدّث #cart-badge وحده، ولا يطلق حدثاً. فبعد كل
   ضغطة على زر شراء في الصفحة القديمة نعيد القراءة — وإلا جمد العدّاد. */
document.addEventListener('click',function(e){
 if(e.target&&e.target.closest&&e.target.closest('.add-cart,[data-cart],.cart-remove,.cart-qty'))setTimeout(sync,0)},true);
var ob=$('sv1OutBtn');
if(ob)ob.onclick=function(){ob.disabled=true;
 fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"logout"}'})
 .catch(function(){}).then(function(){try{localStorage.removeItem('bp_session')}catch(e){}location.reload()})};
/* حالة الدخول: الرسم الفوري من التلميح جرى بعد «</header>» مباشرة
   (SV1_SESSION_JS)، وهذا هو التصحيح من الخادم — والمنطق نفسه حرفاً بحرف في
   صفحات SV1، من simple-v1.mjs لا من نسخةٍ ثانية تفترق عنها بعد شهر. */
${SV1_SESSION_SYNC_JS}
})();</script>`;

// ------------------------------------------------------------ languages --
// خمس صفحات لكل واحدة من هذه اللغات، وهي خارج اللغات الأربع المعتمدة
// (SIMPLE_LANGS). تُقشَّر من المسار حتى يجد مبدّل اللغة شقيقاتها الحقيقية،
// لكن ترويستها تبقى إنجليزية كما كانت — لا يوجد نصٌّ لها في SV1_TEXT، ولا
// `/ja/catalog` مبنيّة ليُربط إليها. لا تُضاف `hr` هنا: `site/hr/` قسمُ
// الموارد البشرية لا لغةٌ كرواتية.
const PATH_LANGS = new Set([...SIMPLE_LANGS.filter((l)=>l!=='en'), 'es','hi','ja','ko','ru']);
// مسار الصفحة بلا لغتها ولا `.html`، كما يراه `pathInLang` في generate.mjs.
function pageOf(file){
  let rel=path.relative(ROOT,file).replaceAll('\\','/').replace(/\.html$/,'');
  let lang='en';
  const m=/^([a-z]{2})(?:\/|$)/.exec(rel);
  if(m && PATH_LANGS.has(m[1])){
    if(SIMPLE_LANGS.includes(m[1])) lang=m[1];
    rel=rel.slice(m[1].length).replace(/^\//,'');
  }
  rel=rel.replace(/(^|\/)index$/,'');
  return { lang, base: rel ? '/'+rel : '/' };
}

const FILES=walk(ROOT);
// أي (لغة، مسار) موجودٌ فعلاً على القرص — فلا يُربط رابط لغةٍ إلى صفحة غير
// مبنيّة. الصفحات العربية/الإنجليزية وحدها تُبنى لكثيرٍ من المسارات.
const BUILT=new Set();
for(const f of FILES){ const {lang,base}=pageOf(f); BUILT.add(lang+' '+base); }

function headerFor(file){
  const { lang, base } = pageOf(file);
  const t=(k)=>{ const e=SV1_TEXT[k]; if(!e) return k; return e[lang]!=null?e[lang]:e.en; };
  const href=(p)=> (p==='/' ? (lang==='en'?'/':'/'+lang+'/') : (lang==='en'?'':'/'+lang)+p);
  const home=href('/');
  // رابط اللغة يفتح **الصفحة نفسها** بلغتها متى كانت مبنيّة، وإلا رئيسيتها.
  const to=(l)=> BUILT.has(l+' '+base) ? pathInLang(base,l) : pathInLang('/',l);
  const codes=SIMPLE_LANGS.map((l)=>
    `<a href="${to(l)}" data-lang="${l}"${l===lang?' class="on"':''}>${l.toUpperCase()}</a>`).join('');
  const langItems=SIMPLE_LANGS.map((l)=>
    `<a href="${to(l)}" data-lang="${l}"${l===lang?' class="on"':''}>${LANG_NAMES[l]}</a>`).join('');

  return `<div class="sv1 sv1-chrome"><div class="sv1-bar"><div class="wrap">
  <div class="sv1-bar-l">
    <span><span class="sv1-pulse"></span><b>${t('barStatus')}</b></span>
    <span class="hide-s">${t('barCity')}</span>
  </div>
  <div class="sv1-bar-r">
    <span class="hide-s">${t('barLangs')}</span>
    <span class="sv1-bar-langs">${codes}</span>
  </div>
</div></div><header class="sv1-hdr"><div class="wrap">
  <a class="logo" href="${home}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <nav class="sv1-nav" id="sv1Nav">
    <a href="${href('/catalog')}">${t('navServices')}</a>
    <a href="${href('/consultation')}">${t('navBook')}</a>
    <a href="${home}#how">${t('navHow')}</a>
    <a href="${href('/my')}" id="sv1AccountLink">${t('navAccount')}</a>
    <details class="sv1-lang"><summary>🌐 ${LANG_NAMES[lang]}</summary><div class="menu">${langItems}</div></details>
  </nav>
  <div class="right">
    <button class="sv1-burger" id="sv1Burger" aria-label="Menu" aria-expanded="false">☰</button>
    <a class="sv1-btn sm sv1-cart sv1-hide" id="sv1CartBtn" href="${href('/cart')}" aria-label="${t('navCart')}">
      <span>${t('navCart')}</span><b id="sv1CartN">0</b></a>
    <a class="sv1-btn" id="sv1LoginBtn" href="${href('/my')}">${t('login')}</a>
    <button type="button" class="sv1-btn sm sv1-hide" id="sv1OutBtn">${t('logout')}</button>
    <a class="sv1-btn primary" href="${home}#advisor">${t('navStart')}</a>
  </div>
</div></header>${SV1_SESSION_JS}${CHROME_JS}</div>`;
}

let done=0, feet=0;
for(const file of FILES){
  let html=fs.readFileSync(file,'utf8');
  // صفحات SV1 تحمل ترويستها وتذييلها من `SV1.shell()` ولا `site-header` ولا
  // `site-footer` فيها أصلاً — هذا الشرط هو ما يبقيها خارج هذا السكربت.
  // ولوحات `site-header portal-header` / `site-footer portal-footer` لا
  // تُلمس (ليست من هذا النطاق): المطابقة نصية على الصنف وحده.
  const hasHeader=html.includes('<header class="site-header">');
  const hasFooter=html.includes('<footer class="site-footer">');
  if(!hasHeader && !hasFooter) continue;
  if(hasHeader) html=html.replace(/<header class="site-header">[\s\S]*?<\/header>/, headerFor(file));
  if(hasFooter){ html=html.replace(OLD_FOOTER, FOOTER[pageOf(file).lang]); feet++; }
  // كتلة CSS تُستبدل إن وُجدت من بناءٍ سابق، لا تُتخطّى — فإعادة تشغيل
  // السكربت وحده على موقعٍ مبنيّ تصل إلى النتيجة نفسها التي يصلها البناء الكامل.
  html=html.includes('id="sv1-chrome-css"')
    ? html.replace(/<style id="sv1-chrome-css">[\s\S]*?<\/style>/, css)
    : html.replace('</head>', css+'\n</head>');
  fs.writeFileSync(file,html);
  done++;
}
console.log(`ترويسة Simple V1 على ${done} صفحة قديمة، وتذييله على ${feet} — نظام ترويسة وتذييل واحد للموقع.`);
