import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('site/ar/compliance-dashboard.html');
if (!fs.existsSync(file)) process.exit(0);
let html = fs.readFileSync(file,'utf8');

const css = String.raw`<style id="bp-compliance-v6-css">
:root{--c6-navy:#07163f;--c6-blue:#3159d8;--c6-soft:#f6f8fc;--c6-line:#e4e9f2;--c6-ink:#111b35;--c6-muted:#6d7890}
body{background:var(--c6-soft)!important;color:var(--c6-ink)!important}.hero{background:#fff!important;color:var(--c6-ink)!important;padding:0 0 26px!important;border-bottom:1px solid var(--c6-line)!important}.topbar{padding:14px 20px!important;max-width:1280px!important}.brand{color:var(--c6-navy)!important}.brand img{filter:none!important}.top-actions{gap:7px!important}.chip-btn{background:#fff!important;color:var(--c6-navy)!important;border:1px solid var(--c6-line)!important}.chip-btn.gold{background:linear-gradient(135deg,#0b275f,#3159d8)!important;color:#fff!important;border:0!important}.hero-grid{max-width:1280px!important;margin:10px auto 0!important;grid-template-columns:1fr!important;gap:16px!important}.gauge-wrap{display:none!important}.hero-copy{background:linear-gradient(145deg,#07163f,#123c91)!important;color:#fff!important;border-radius:24px!important;padding:24px 26px!important;box-shadow:0 20px 50px rgba(17,49,132,.14)!important}.hero-copy .eyebrow{color:#8adff4!important}.hero-copy h1{font-size:clamp(1.8rem,3vw,2.7rem)!important;max-width:850px!important}.hero-copy .lede{color:rgba(255,255,255,.75)!important;max-width:850px!important}.kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important;max-width:none!important}.kpi{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.12)!important}.snav{background:rgba(246,248,252,.92)!important}.snav-in{max-width:1280px!important}.snav a.on{background:var(--c6-navy)!important}.wrap{max-width:1280px!important}.card{border-color:var(--c6-line)!important;border-radius:18px!important;box-shadow:0 8px 28px rgba(12,35,92,.05)!important}.tl-row{grid-template-columns:minmax(240px,1.2fr) minmax(260px,2fr) 110px!important}.tl-track{height:16px!important;border-radius:999px!important}.tl-bar{top:3px!important;bottom:3px!important;border-radius:999px!important}.ent{border-color:var(--c6-line)!important;border-radius:16px!important}.bp6-portalbar{max-width:1280px;margin:14px auto 0;padding:0 1.4rem}.bp6-portalbox{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;background:#eef3ff;border:1px solid #d8e3ff;border-radius:18px;padding:15px 18px}.bp6-portalbox strong{display:block;color:var(--c6-navy);font-size:14px}.bp6-portalbox span{display:block;color:#61708e;font-size:11.5px;margin-top:2px}.bp6-portalbox a{display:inline-flex;text-decoration:none;background:linear-gradient(135deg,#0b275f,#3159d8);color:#fff;padding:9px 13px;border-radius:10px;font-weight:800;font-size:12px}.bp6-renew{border:0;background:#eef3ff;color:#2149aa;border-radius:9px;padding:7px 10px;font-family:inherit;font-weight:800;cursor:pointer}.bp6-note{margin-top:8px;font-size:11px;color:var(--c6-muted)}
a[href*="wa.me"],a[href*="whatsapp"]{display:none!important}
@media(max-width:760px){.kpis{grid-template-columns:1fr 1fr!important}.bp6-portalbox{grid-template-columns:1fr}.tl-row{grid-template-columns:1fr!important}.tl-track{display:none!important}}
</style>`;

const js = String.raw`<script id="bp-compliance-v6-js">(function(){
function addPortalBar(){if(document.getElementById('bp6PortalBar'))return;var hero=document.querySelector('.hero');if(!hero)return;var d=document.createElement('div');d.id='bp6PortalBar';d.className='bp6-portalbar';d.innerHTML='<div class="bp6-portalbox"><div><strong>التنفيذ والتجديدات من بوابة العميل</strong><span>أي تجديد، اعتراض، رفع مستند أو طلب خدمة يتم على الشركة الصحيحة داخل حسابك ويظهر كـ Request قابل للمتابعة.</span></div><a href="/ar/account?view=compliance">افتح بوابة العميل</a></div>';hero.insertAdjacentElement('afterend',d)}
function rerouteActions(){document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"]').forEach(function(a){a.href='/ar/account?view=compliance';a.removeAttribute('target')});document.querySelectorAll('button').forEach(function(b){var t=(b.textContent||'').trim();if(/تجديد|اطلب التجديد|طلب تجديد/.test(t)){b.onclick=function(e){e.preventDefault();location.href='/ar/account?view=store'}}});var float=document.querySelectorAll('a,button');float.forEach(function(el){var t=(el.textContent||'').trim();if(/رفع الملفات/.test(t)){el.onclick=function(e){e.preventDefault();location.href='/ar/account?view=documents'}}})}
function addRenewButtons(){document.querySelectorAll('.tl-row').forEach(function(row){if(row.querySelector('.bp6-renew'))return;var name=row.querySelector('.tl-name');var days=row.querySelector('.tl-days');if(!name||!days)return;var text=(days.textContent||'');if(/-|منتهي|يوم/.test(text)){var b=document.createElement('button');b.className='bp6-renew';b.textContent='طلب تجديد';b.onclick=function(){location.href='/ar/account?view=store'};days.insertAdjacentElement('afterend',b)}})}
function relabel(){var h=document.querySelector('.hero-copy h1');if(h)h.textContent='لوحة الامتثال — ما يحتاج إجراء الآن، وما القادم بعده.';var lede=document.querySelector('.hero-copy .lede');if(lede)lede.textContent='تابع الاستحقاقات والمستندات والمخالفات للشركة، ونفّذ أي تجديد أو معالجة من بوابة العميل بدون واتساب.'}
function boot(){addPortalBar();rerouteActions();addRenewButtons();relabel()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>`;


const embedHead = String.raw`<script id="bp-compliance-embed-flag">(function(){try{var e=/[?&]embed=1/.test(location.search)||window.self!==window.top;if(e)document.documentElement.classList.add('bp6-embed')}catch(x){document.documentElement.classList.add('bp6-embed')}})();</script>`;

const embedCss = String.raw`<style id="bp-compliance-embed-css">
/* ===== Embedded mode =====
   The dashboard is a standalone page, but the shared-services portal loads it
   inside a tab. Everything the portal already provides — the site bar, the
   brand lockup, the account chips, the "open the client portal" card and the
   footer — is duplicate chrome in that context, so it is dropped and only the
   compliance content remains, on the portal's own light canvas. */
.bp6-embed .site-bar,
.bp6-embed .topbar,
.bp6-embed .bp6-portalbar,
.bp6-embed .fab,
.bp6-embed .foot{display:none!important}
.bp6-embed body{background:#FAFBFE!important}
.bp6-embed .hero{padding:0 0 20px!important;background:transparent!important;border-bottom:0!important}
.bp6-embed .hero-grid{margin-top:0!important;padding-top:18px!important}
.bp6-embed .hero-copy{border-radius:20px!important;padding:22px 24px!important}
.bp6-embed .hero-copy h1{font-size:clamp(1.35rem,2.3vw,1.9rem)!important}
.bp6-embed .snav{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--c6-line)!important}
.bp6-embed .wrap,.bp6-embed .snav-in,.bp6-embed .hero-grid{padding-inline:18px!important}
/* the two real actions the hidden topbar carried, kept inside the content */
.bp6-embed .bp6-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.bp6-embed .bp6-acts button{border:0;font-family:inherit;font-weight:800;font-size:12.5px;
  border-radius:11px;padding:9px 13px;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}
.bp6-embed .bp6-acts button.pri{background:#fff;color:#0b275f}
/* wide tables scroll inside their own box instead of pushing the frame sideways */
.bp6-embed .bp6-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
.bp6-embed .bp6-scroll>table{min-width:100%}
@media(max-width:640px){.bp6-embed .hero-copy{padding:18px!important}
  /* a nowrap CTA is wider than a phone frame — let it wrap instead of pushing the page */
  .bp6-embed .btn-navy{white-space:normal!important;max-width:100%}
  .bp6-embed .wrap,.bp6-embed .snav-in,.bp6-embed .hero-grid{padding-inline:12px!important}}
</style>`;

const embedJs = String.raw`<script id="bp-compliance-embed-js">(function(){
if(!document.documentElement.classList.contains('bp6-embed'))return;
function acts(){if(document.getElementById('bp6Acts'))return;var copy=document.querySelector('.hero-copy');if(!copy)return;
  var d=document.createElement('div');d.id='bp6Acts';d.className='bp6-acts';
  var up=document.createElement('button');up.className='pri';up.textContent='\ud83d\udce4 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062a';
  up.onclick=function(){top.location.href='/ar/account?view=documents'};
  var rf=document.createElement('button');rf.textContent='\u21bb \u062a\u062d\u062f\u064a\u062b';
  rf.onclick=function(){location.reload()};
  d.appendChild(up);d.appendChild(rf);copy.appendChild(d)}
// any link out of the dashboard has to leave the frame, not load inside it
function breakout(){document.querySelectorAll('a[href^="/"],a[href^="http"]').forEach(function(a){a.target='_top'})}
function scrollTables(){document.querySelectorAll('table').forEach(function(t){
  if(t.parentNode&&t.parentNode.classList&&t.parentNode.classList.contains('bp6-scroll'))return;
  var w=document.createElement('div');w.className='bp6-scroll';t.parentNode.insertBefore(w,t);w.appendChild(t)})}
function boot(){acts();breakout();scrollTables()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
new MutationObserver(function(){breakout();scrollTables()}).observe(document.body,{childList:true,subtree:true});
})();</script>`;

html = html.replace(/<style id="bp-compliance-v6-css">[\s\S]*?<\/style>/g,'').replace(/<script id="bp-compliance-v6-js">[\s\S]*?<\/script>/g,'')
  .replace(/<script id="bp-compliance-embed-flag">[\s\S]*?<\/script>/g,'').replace(/<style id="bp-compliance-embed-css">[\s\S]*?<\/style>/g,'')
  .replace(/<script id="bp-compliance-embed-js">[\s\S]*?<\/script>/g,'');
html = html.replace('</head>',embedHead+'\n'+css+'\n'+embedCss+'\n</head>').replace('</body>',js+'\n'+embedJs+'\n</body>');
fs.writeFileSync(file,html);
console.log('Compliance dashboard v6 applied');
