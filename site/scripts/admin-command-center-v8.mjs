import fs from 'node:fs';
import path from 'node:path';

const file=path.resolve('site/admin.html');
if(!fs.existsSync(file)){ console.log('admin.html missing'); process.exit(0); }
let html=fs.readFileSync(file,'utf8');

const css=String.raw`<style id="bp-admin-v8-css">
:root{--navy:#07163f!important;--navy-700:#112c71!important;--navy-900:#05102f!important;--bg:#f6f8fc!important;--surface:#fff!important;--line:#e5eaf3!important;--text:#14203e!important;--soft:#68758f!important;--muted:#94a0b5!important;--radius:18px!important;--shadow:0 10px 32px rgba(18,38,85,.055)!important}
body{background:linear-gradient(180deg,#f8faff 0,#f4f7fc 100%)!important}
/* align-items must stay "stretch": flex-start used to shrink the sticky
   sidebar to its content height, leaving a floating navy block mid-page. */
#app.on{align-items:stretch}
.side{width:228px!important;min-height:100dvh;padding:18px 12px!important;background:linear-gradient(180deg,#07163f 0%,#0a245e 100%)!important;border-inline-end:1px solid rgba(255,255,255,.08)}
/* The top header reads as one solid bar the content scrolls under — not a
   floating island overlapping the cards. */
.admin-topbar{top:0!important;margin:-22px -28px 18px!important;border-top:0!important;border-inline:0!important;border-radius:0 0 16px 16px!important;padding:12px 26px!important;z-index:40!important;box-shadow:0 10px 24px rgba(18,38,85,.08)!important}
.side .logo{padding:0 8px 18px!important;margin-bottom:12px!important}.side .logo img{max-width:142px!important;filter:brightness(0) invert(1)}.side .logo .t{font-size:13px!important}.side .logo .t small{font-size:9.5px!important;opacity:.6!important}
.nav{gap:2px!important}.nav:before{content:'COMMAND CENTER';display:block;font-size:9px;font-weight:900;letter-spacing:.16em;color:rgba(255,255,255,.38);padding:4px 12px 8px}
.nav button{padding:9px 10px!important;font-size:12.5px!important;border-radius:9px!important}.nav button.active{background:#fff!important;color:#07163f!important;box-shadow:0 8px 20px rgba(0,0,0,.13)}
.nav .sub button,.nav .sub a{font-size:11.5px!important;padding:6px 9px!important}.nav .filter{margin:8px 0 10px!important}
.side .foot a,.side .foot button{font-size:11.5px!important;padding:7px 10px!important}
.main{max-width:none!important;width:calc(100% - 228px)!important;padding:22px 28px 64px!important}
.view{max-width:1460px;margin:0 auto}.pagehead{margin-bottom:16px!important;padding:0 2px}.pagehead h2{font-size:1.18rem!important;letter-spacing:-.02em}.pagehead .sub{font-size:.76rem!important;max-width:820px}.refresh{border-radius:9px!important;padding:7px 11px!important;font-size:11.5px!important}
.panel{border-radius:18px!important;box-shadow:0 8px 26px rgba(18,38,85,.045)!important;margin-bottom:14px!important}.panel-head{padding:12px 15px!important}.panel-head h3{font-size:.9rem!important}
.tiles{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:9px!important;margin-bottom:14px!important}.tile{border-radius:15px!important;padding:13px 14px!important;box-shadow:none!important;background:linear-gradient(180deg,#fff,#fbfcff)!important}.tile .k{font-size:10.5px!important}.tile .v{font-size:1.55rem!important}.tile .d{font-size:9.8px!important}
#view-overview{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,.7fr);gap:14px;align-items:start}
#view-overview>.pagehead,#view-overview>.bp-admin-command,#view-overview>.tiles{grid-column:1/-1}
#view-overview>#fupPanel{grid-column:1/2;grid-row:auto;min-width:0}
#view-overview>#anaPanel{grid-column:2/3;grid-row:auto;min-width:0;position:sticky;top:18px}
#view-overview>#anaPanel .tiles{grid-template-columns:1fr 1fr!important;padding:10px 12px 0!important}
#view-overview>#anaPanel>div:last-child{grid-template-columns:1fr!important;padding:10px 14px 14px!important;gap:10px!important}
#view-overview>#anaPanel>div:last-child>div:nth-child(n+3){display:none}
#view-overview>.panel:not(#fupPanel):not(#anaPanel){grid-column:1/2}
.bp-admin-command{background:linear-gradient(135deg,#07163f 0%,#123f99 70%,#3159d8 100%);color:#fff;border-radius:22px;padding:20px 22px;display:grid;grid-template-columns:1.25fr .75fr;gap:18px;align-items:center;box-shadow:0 20px 50px rgba(15,47,125,.16);position:relative;overflow:hidden}
.bp-admin-command:after{content:'B10X';position:absolute;left:-20px;bottom:-45px;font-size:8rem;font-weight:950;color:rgba(255,255,255,.035);letter-spacing:-.08em}.bp-admin-command .ey{font-size:9px;letter-spacing:.14em;font-weight:900;color:#aeeaff}.bp-admin-command h1{font-size:clamp(1.6rem,2.5vw,2.35rem);line-height:1.1;margin:7px 0 8px;letter-spacing:-.04em}.bp-admin-command p{font-size:.76rem;color:rgba(255,255,255,.68);max-width:760px}.bp-admin-command .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;position:relative;z-index:2}.bp-admin-command .actions button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.09);color:#fff;border-radius:12px;padding:11px;font-size:11.5px;font-weight:800;text-align:right}.bp-admin-command .actions button.primary{background:#fff;color:#0a286c}.bp-admin-command .actions button:hover{transform:translateY(-1px);background:rgba(255,255,255,.14)}.bp-admin-command .actions button.primary:hover{background:#fff}
.bp-admin-section-title{grid-column:1/-1;display:flex;align-items:center;gap:8px;margin:5px 2px -2px;color:#52627f;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.bp-admin-section-title:after{content:'';height:1px;background:#e3e8f1;flex:1}
#fupPanel{border:1px solid #dde5f2!important}#fupPanel .panel-head{background:#fbfcff}.fuptab{font-size:11px!important;padding:4px 10px!important}.actbtn{border-radius:9px!important;font-size:11px!important}
.tbl-wrap{border-radius:0 0 16px 16px}.filters{padding:10px 14px!important}.filters input[type="search"]{font-size:12px!important;padding:8px 11px!important}table{font-size:12px!important}th{font-size:10.5px!important;padding:8px!important}td{padding:9px 8px!important}
.mobilebar{background:#fff!important;border-bottom:1px solid var(--line)!important}
#aiFab{background:linear-gradient(135deg,#07163f,#3159d8)!important;box-shadow:0 12px 30px rgba(36,75,184,.25)!important}
@media(max-width:1180px){#view-overview{grid-template-columns:1fr}.bp-admin-command{grid-template-columns:1fr}#view-overview>#fupPanel,#view-overview>#anaPanel,#view-overview>.panel:not(#fupPanel):not(#anaPanel){grid-column:1!important}.tiles{grid-template-columns:repeat(3,minmax(0,1fr))!important}#view-overview>#anaPanel{position:static!important}}
@media(max-width:860px){.main{width:100%!important;padding:14px 12px 60px!important}.bp-admin-command{border-radius:17px;padding:17px}.bp-admin-command .actions{grid-template-columns:1fr 1fr}.tiles{grid-template-columns:repeat(2,minmax(0,1fr))!important}.panel{border-radius:15px!important}}
</style>`;

const js=String.raw`<script id="bp-admin-v8-js">(function(){
function el(t,c,h){var x=document.createElement(t);if(c)x.className=c;if(h!=null)x.innerHTML=h;return x}
function goto(v){var b=document.querySelector('[data-v="'+v+'"]');if(b)b.click()}
function run(){
 var ov=document.getElementById('view-overview'); if(!ov)return;
 document.body.classList.add('bp-admin-v8');
 if(!document.querySelector('.bp-admin-command')){
   var cmd=el('section','bp-admin-command','<div><div class="ey">BUSINESS PARTNER · OPERATIONS COMMAND CENTER</div><h1>وش يحتاج قرارك اليوم؟</h1><p>ابدأ بالعملاء والطلبات التي تحتاج إجراء، ثم المالية والتشغيل. الإحصائيات والتقارير صارت ثانوية بدل ما تأخذ أول الشاشة.</p></div><div class="actions"><button class="primary" data-go="leads">📥 الطلبات والموافقات</button><button data-go="finance">💰 المالية</button><button data-go="suppliers">🤝 الشركاء</button><button data-go="notion">📇 CRM / Notion</button></div>');
   var ph=ov.querySelector('.pagehead'); if(ph)ph.insertAdjacentElement('afterend',cmd); else ov.prepend(cmd);
   cmd.querySelectorAll('[data-go]').forEach(function(b){b.addEventListener('click',function(){goto(b.dataset.go)})});
 }
 var ph=ov.querySelector('.pagehead'); if(ph){var h=ph.querySelector('h2');if(h)h.textContent='مركز التشغيل';var s=ph.querySelector('.sub');if(s)s.textContent='ملخص تنفيذي لما يحتاج متابعة أو قرار الآن.'}
 var ana=document.getElementById('anaPanel'),fup=document.getElementById('fupPanel');
 if(fup){var h=fup.querySelector('.panel-head h3');if(h)h.textContent='العملاء والمتابعات التي تحتاج إجراء';}
 if(ana){var h2=ana.querySelector('.panel-head h3');if(h2)h2.textContent='نبض الموقع';}
 var firstTiles=Array.from(ov.children).find(function(x){return x.classList&&x.classList.contains('tiles')});
 if(firstTiles && !firstTiles.previousElementSibling?.classList.contains('bp-admin-section-title')) firstTiles.insertAdjacentElement('beforebegin',el('div','bp-admin-section-title','مؤشرات اليوم'));
 if(fup && !fup.previousElementSibling?.classList.contains('bp-admin-section-title')) fup.insertAdjacentElement('beforebegin',el('div','bp-admin-section-title','العملاء والطلبات'));
 if(ana && !ana.previousElementSibling?.classList.contains('bp-admin-section-title')) ana.insertAdjacentElement('beforebegin',el('div','bp-admin-section-title','الموقع والأداء'));
 // Rename nav into operational language without changing data-v hooks.
 var map={overview:'◉ مركز التشغيل',leads:'طلبات العملاء',notion:'CRM والبيانات',finance:'المالية',suppliers:'الشركاء والموردون'};
 document.querySelectorAll('#navDesk [data-v]').forEach(function(b){var v=b.dataset.v;if(map[v])b.textContent=map[v]});
 var g1=document.getElementById('grpContent');if(g1){var ss=g1.querySelectorAll('span');if(ss[1])ss[1].textContent='الموقع والمحتوى'}
 var g2=document.getElementById('grpPages');if(g2){var ss2=g2.querySelectorAll('span');if(ss2[1])ss2[1].textContent='صفحات الموقع'}
 var gt=document.getElementById('grpTools');if(gt){var s3=gt.querySelectorAll('span');if(s3[1])s3[1].textContent='الأدوات التشغيلية'}
 var gb=document.getElementById('grpBoards');if(gb){var s4=gb.querySelectorAll('span');if(s4[1])s4[1].textContent='الأنظمة والبوابات'}
 var gs=document.getElementById('grpSvc');if(gs){var s5=gs.querySelectorAll('span');if(s5[1])s5[1].textContent='حالة التكاملات'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();window.addEventListener('load',run,{once:true});setTimeout(run,300);
})();</script>`;

html=html.replace(/<style id="bp-admin-v8-css">[\s\S]*?<\/style>/g,'').replace(/<script id="bp-admin-v8-js">[\s\S]*?<\/script>/g,'');
html=html.replace('</head>',css+'\n</head>').replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Admin command center v8 applied');
