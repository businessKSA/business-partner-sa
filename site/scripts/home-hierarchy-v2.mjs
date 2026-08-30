import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const langs = ['ar','en','fr','zh'];

const css = String.raw`<style id="bp-home-hierarchy-v2-css">
/* Homepage hierarchy v2: title -> chat -> B10X service tiles -> packages */
.bp-home-clarity .bp-clarity .who{display:none!important}
.bp-home-clarity .bp-clarity .hero{padding:54px 0 24px!important}
.bp-home-clarity .bp-clarity .hero h1{margin-top:13px!important;margin-bottom:12px!important}
.bp-home-clarity .bp-clarity .hero p{max-width:760px!important}
.bp-home-clarity .bp-clarity .hero-actions{margin-top:18px!important}
.bp-home-clarity .bp-clarity .chat-sec{padding:28px 0 58px!important;background:linear-gradient(180deg,#fff,#f8faff 70%,#fff)!important}
.bp-home-clarity .bp-clarity .chat-grid{grid-template-columns:1fr!important;max-width:940px;margin:auto!important}
.bp-home-clarity .bp-clarity .chat-copy{text-align:center;max-width:760px;margin:0 auto 10px!important}
.bp-home-clarity .bp-clarity .chat-copy h2{font-size:clamp(1.7rem,3.1vw,2.75rem)!important;margin-bottom:9px!important}
.bp-home-clarity .bp-clarity .chat-copy ul{display:none!important}
.bp-home-clarity .bp-chat-shell{max-width:900px;width:100%;margin:auto;box-shadow:0 24px 70px rgba(31,67,168,.18)!important}
.bp-home-clarity .bp-chat-body{min-height:250px!important;max-height:330px!important}
.bp-home-clarity #bp-services{padding:62px 0!important}
.bp-home-clarity #bp-services .head{margin-bottom:24px!important}
.bp-home-clarity #bp-services .cap-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}
.bp-home-clarity #bp-services .cap{min-height:150px!important}
.bp-home-clarity #bp-packages{padding:66px 0!important}
.bp-home-clarity #bp-packages .pkg-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:stretch}
.bp-home-clarity #bp-packages .pkgx.b10x-package{background:radial-gradient(circle at 90% 4%,rgba(66,215,246,.18),transparent 30%),linear-gradient(145deg,#07163f,#123b8e)!important;border:0!important;color:#fff!important;box-shadow:0 20px 55px rgba(24,57,145,.19)!important;position:relative;overflow:hidden}
.bp-home-clarity #bp-packages .pkgx.b10x-package:before{content:'B10X';position:absolute;inset:auto auto -25px -5px;font-size:5.5rem;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.045)}
.bp-home-clarity #bp-packages .pkgx.b10x-package h3{color:#fff!important;font-size:1.35rem!important}
.bp-home-clarity #bp-packages .pkgx.b10x-package p,.bp-home-clarity #bp-packages .pkgx.b10x-package li{color:rgba(255,255,255,.73)!important}
.bp-home-clarity #bp-packages .pkgx.b10x-package li:before{color:#56e2b0!important}
.bp-home-clarity #bp-packages .pkgx.b10x-package .btnx{background:#fff!important;color:#0b2d72!important;border:0!important;position:relative;z-index:1}
@media(max-width:980px){.bp-home-clarity #bp-services .cap-grid,.bp-home-clarity #bp-packages .pkg-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:640px){.bp-home-clarity .bp-clarity .hero{padding:38px 0 16px!important}.bp-home-clarity .bp-clarity .chat-sec{padding:20px 0 46px!important}.bp-home-clarity #bp-services .cap-grid,.bp-home-clarity #bp-packages .pkg-grid{grid-template-columns:1fr!important}}
</style>`;

const arPackages = String.raw`
<div class="pkgx b10x-package"><h3>B10X</h3><p>طبقة التشغيل الذكية التي تربطك بكل خدمات Business Partner من مكان واحد.</p><ul><li>المستشار الذكي 24/7</li><li>Client Portal ومتابعة الطلبات وSLA</li><li>Document AI وخزنة المستندات</li><li>Compliance & Violations Center</li><li>تنسيق التنفيذ مع فريق Business Partner</li></ul><a class="btnx" href="/ar/ai-agents">ابدأ مع B10X</a></div>
<div class="pkgx"><h3>باقات الخدمات</h3><p>تشغيل ومتابعة الخدمات الحكومية والتشغيلية حسب احتياج شركتك.</p><ul><li>طلبات وخدمات متعددة</li><li>متابعة وتنبيهات</li><li>لوحة عميل موحدة</li></ul><a class="btnx" href="/ar/packages#pkg-management">استعرض الباقات</a></div>
<div class="pkgx"><h3>تأسيس الشركات</h3><p>مسارات تأسيس وتجهيز الشركات المحلية والأجنبية وما بعد التأسيس.</p><ul><li>التأسيس والتراخيص</li><li>المستندات والمتطلبات</li><li>ما بعد التأسيس والتشغيل</li></ul><a class="btnx" href="/ar/packages#pkg-formation">استعرض الباقات</a></div>
<div class="pkgx"><h3>الباقات القانونية</h3><p>دعم قانوني وعقود ومراجعات مرتبطة بتشغيل ونمو الشركة.</p><ul><li>عقود واتفاقيات</li><li>مراجعات قانونية</li><li>دعم حسب نطاق الباقة</li></ul><a class="btnx" href="/ar/packages#pkg-legal">استعرض الباقات</a></div>`;

const enPackages = String.raw`
<div class="pkgx b10x-package"><h3>B10X</h3><p>Your AI operating layer across Business Partner services.</p><ul><li>24/7 Smart Advisor</li><li>Client Portal, requests and SLA tracking</li><li>Document AI and document vault</li><li>Compliance & Violations Center</li><li>Human execution when required</li></ul><a class="btnx" href="/ai-agents">Start with B10X</a></div>
<div class="pkgx"><h3>Service Packages</h3><p>Government and operational support bundled around your company.</p><ul><li>Multiple service requests</li><li>Tracking and alerts</li><li>Unified client workspace</li></ul><a class="btnx" href="/packages#pkg-management">Explore</a></div>
<div class="pkgx"><h3>Company Formation</h3><p>Formation, licensing and post-formation support.</p><ul><li>Formation and licensing</li><li>Requirements and documents</li><li>Post-formation operations</li></ul><a class="btnx" href="/packages#pkg-formation">Explore</a></div>
<div class="pkgx"><h3>Legal Packages</h3><p>Contracts, legal reviews and ongoing business legal support.</p><ul><li>Contracts and agreements</li><li>Legal reviews</li><li>Scope-based support</li></ul><a class="btnx" href="/packages#pkg-legal">Explore</a></div>`;

const js = (isAr) => String.raw`<script id="bp-home-hierarchy-v2-js">
(function(){
  function run(){
    var root=document.querySelector('#bp-home-clarity'); if(!root)return;
    var hero=root.querySelector('.hero');
    var chat=root.querySelector('#bp-consultant');
    var services=root.querySelector('#bp-services');
    var packages=root.querySelector('#bp-packages');
    if(hero&&chat) hero.insertAdjacentElement('afterend',chat);
    if(chat&&services) chat.insertAdjacentElement('afterend',services);
    if(services&&packages) services.insertAdjacentElement('afterend',packages);
    var b10x=root.querySelector('.b10x-box');
    if(b10x){var sec=b10x.closest('section'); if(sec&&packages) packages.insertAdjacentElement('afterend',sec);}
    var grid=packages&&packages.querySelector('.pkg-grid');
    if(grid) grid.innerHTML=${JSON.stringify(isAr ? arPackages : enPackages)};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
</script>`;

for (const lang of langs) {
  const file = path.join(ROOT, lang === 'en' ? 'index.html' : lang, 'index.html');
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file,'utf8');
  if (!html.includes('bp-home-clarity')) continue;
  html = html.replace(/<style id="bp-home-hierarchy-v2-css">[\s\S]*?<\/style>/g,'').replace(/<script id="bp-home-hierarchy-v2-js">[\s\S]*?<\/script>/g,'');
  html = html.replace('</head>', css + '\n</head>');
  html = html.replace('</body>', js(lang === 'ar') + '\n</body>');
  fs.writeFileSync(file,html);
}
console.log('Homepage hierarchy v2 applied');
