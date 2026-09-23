import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
}

const CSS = `<style id="bp-public-v4-css">
:root{--v4-n:#07163f;--v4-b:#2856d6;--v4-ink:#101828;--v4-muted:#667085;--v4-line:#e5eaf2;--v4-soft:#f7f9fd;--v4-green:#12a66a}
body.bp-public-v4{background:radial-gradient(circle at 88% 0,rgba(40,86,214,.08),transparent 24%),#f8faff;color:var(--v4-ink)}
body.bp-public-v4 main{background:transparent}
body.bp-public-v4 .container{max-width:1180px}
body.bp-public-v4 .site-header{background:rgba(255,255,255,.92)!important;backdrop-filter:blur(16px);border-bottom:1px solid rgba(7,22,63,.07)}
body.bp-public-v4 .site-header .nav{gap:16px}
body.bp-public-v4 .site-header .nav>a,body.bp-public-v4 .nav-drop{font-size:13px!important}

/* Shared B10X mast */
.bp-v4-mast{max-width:1180px;margin:22px auto 0;padding:0 22px}.bp-v4-mast-in{border-radius:24px;padding:22px 24px;background:linear-gradient(135deg,#07163f,#123b8e);color:#fff;display:flex;justify-content:space-between;gap:20px;align-items:center;box-shadow:0 18px 50px rgba(20,51,125,.14)}
.bp-v4-mast small{display:block;font-size:10px;font-weight:900;letter-spacing:.11em;color:#bcd0ff;margin-bottom:6px}.bp-v4-mast strong{display:block;font-size:18px;line-height:1.4}.bp-v4-mast p{margin:4px 0 0;color:#d8e4ff;font-size:11px;line-height:1.65}.bp-v4-mast a{flex:0 0 auto;text-decoration:none;background:#fff;color:#123675;border-radius:12px;padding:10px 13px;font-size:11px;font-weight:900}

/* Service detail */
body.bp-v4-service .svc-hero{background:transparent!important;padding:54px 0 26px!important}
body.bp-v4-service .svc-hero .container{background:linear-gradient(145deg,#fff,#f2f6ff);border:1px solid var(--v4-line);border-radius:28px;padding:30px!important;box-shadow:0 16px 50px rgba(16,24,40,.06)}
body.bp-v4-service .svc-hero h1{font-size:clamp(30px,4.4vw,52px)!important;line-height:1.08!important;letter-spacing:-1.5px!important;color:var(--v4-n)!important;max-width:900px;margin:15px 0!important}
body.bp-v4-service .breadcrumb,body.bp-v4-category .back-link{font-size:11px!important;color:#74809a!important}
body.bp-v4-service .svc-meta{display:flex!important;gap:8px!important;flex-wrap:wrap!important}
body.bp-v4-service .svc-meta .chip{border:1px solid #dde5f4!important;background:#fff!important;border-radius:999px!important;color:#41506d!important;font-size:10.5px!important;padding:7px 10px!important}
body.bp-v4-service .svc-layout{display:grid!important;grid-template-columns:minmax(0,1fr) 330px!important;gap:22px!important;align-items:start!important;margin-top:20px!important}
body.bp-v4-service .svc-content>section,body.bp-v4-service .svc-main>section,body.bp-v4-service main section:not(.svc-hero){border-radius:20px}
body.bp-v4-service .svc-content>section,body.bp-v4-service .svc-main>section{background:#fff;border:1px solid var(--v4-line);padding:20px!important;margin-bottom:12px!important;box-shadow:0 7px 24px rgba(16,24,40,.035)}
body.bp-v4-service .svc-content h2,body.bp-v4-service .svc-main h2{color:var(--v4-n)!important;font-size:19px!important;margin:0 0 12px!important}
body.bp-v4-service .svc-content p,body.bp-v4-service .svc-main p,body.bp-v4-service .svc-content li{font-size:12.5px!important;line-height:1.9!important;color:#56627a!important}
body.bp-v4-service .svc-aside{position:sticky!important;top:92px!important}
body.bp-v4-service .order-box{border:1px solid #dce5f5!important;border-radius:22px!important;background:linear-gradient(180deg,#fff,#f7faff)!important;padding:20px!important;box-shadow:0 18px 48px rgba(16,49,120,.11)!important}
body.bp-v4-service .order-box:before{content:'B10X · SERVICE EXECUTION';display:block;font-size:9px;letter-spacing:.1em;font-weight:900;color:var(--v4-b);margin-bottom:12px}
body.bp-v4-service .order-box .btn{border-radius:12px!important;min-height:44px!important}
body.bp-v4-service .callout{background:linear-gradient(135deg,#eef4ff,#f9fbff)!important;border:1px solid #d5e1fb!important;border-radius:16px!important;padding:14px!important}
body.bp-v4-service .callout strong:before{content:'B10X · ';color:var(--v4-b)}

/* Category and services catalog */
body.bp-v4-category .hero--sm,body.bp-v4-catalog .page-hero{background:transparent!important;padding:44px 0 18px!important}
body.bp-v4-category .hero--sm .hero-inner{max-width:1180px!important;background:linear-gradient(145deg,#fff,#f2f6ff);border:1px solid var(--v4-line);border-radius:26px;padding:28px!important}
body.bp-v4-category .hero--sm h1{font-size:clamp(32px,4vw,48px)!important;color:var(--v4-n)!important;margin:10px 0!important}
body.bp-v4-category .hero--sm .lead{font-size:13px!important;line-height:1.8!important;color:var(--v4-muted)!important;max-width:760px!important}
body.bp-v4-category .grid,body.bp-v4-category .service-grid,body.bp-v4-category .services-grid,body.bp-v4-catalog .service-grid,body.bp-v4-catalog .services-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important}
body.bp-v4-category [class*="service-card"],body.bp-v4-catalog [class*="service-card"]{background:#fff!important;border:1px solid var(--v4-line)!important;border-radius:18px!important;padding:16px!important;box-shadow:0 7px 25px rgba(16,24,40,.035)!important;transition:.18s ease!important}
body.bp-v4-category [class*="service-card"]:hover,body.bp-v4-catalog [class*="service-card"]:hover{transform:translateY(-3px)!important;border-color:#b9caf2!important;box-shadow:0 14px 34px rgba(16,24,40,.075)!important}
body.bp-v4-category [class*="service-card"] h3,body.bp-v4-catalog [class*="service-card"] h3{font-size:14px!important;color:var(--v4-n)!important;line-height:1.45!important}
body.bp-v4-category [class*="service-card"] p,body.bp-v4-catalog [class*="service-card"] p{font-size:10.7px!important;line-height:1.65!important;color:var(--v4-muted)!important}

/* Packages */
body.bp-v4-packages main{background:transparent!important}
body.bp-v4-packages [id^="pkg-"]{scroll-margin-top:95px}
body.bp-v4-packages .pkg-card,body.bp-v4-packages [class*="package-card"]{border:1px solid var(--v4-line)!important;border-radius:22px!important;background:#fff!important;box-shadow:0 10px 32px rgba(16,24,40,.05)!important;padding:20px!important}
body.bp-v4-packages .pkg-card:hover,body.bp-v4-packages [class*="package-card"]:hover{transform:translateY(-3px)!important;box-shadow:0 17px 42px rgba(16,24,40,.085)!important}

/* AI pages */
body.bp-v4-ai main>section{border-radius:0}
body.bp-v4-ai main .hero,body.bp-v4-ai main [class*="hero"]{background:radial-gradient(circle at 78% 10%,rgba(66,215,246,.14),transparent 26%),linear-gradient(135deg,#07163f,#123b8e)!important;color:#fff!important}
body.bp-v4-ai main .hero h1,body.bp-v4-ai main [class*="hero"] h1{color:#fff!important}
body.bp-v4-ai main .hero p,body.bp-v4-ai main [class*="hero"] p{color:#dbe5ff!important}
body.bp-v4-ai .card,body.bp-v4-ai [class*="card"]{border-radius:20px!important;border-color:var(--v4-line)!important;box-shadow:0 8px 28px rgba(16,24,40,.04)!important}

/* Buttons + footer */
body.bp-public-v4 .btn-primary{background:linear-gradient(135deg,#07163f,#2856d6)!important;border-color:transparent!important;box-shadow:none!important}
body.bp-public-v4 .btn,body.bp-public-v4 button{border-radius:12px}
body.bp-public-v4 .site-footer{background:#07143b!important;padding:0!important;min-height:48px!important}
body.bp-public-v4 .site-footer .newsletter-band,body.bp-public-v4 .site-footer .footer-grid{display:none!important}
body.bp-public-v4 .site-footer>.container{padding-top:0!important;padding-bottom:0!important}
body.bp-public-v4 .site-footer .footer-bottom{min-height:48px!important;margin:0!important;padding:8px 0!important;border:0!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;color:rgba(255,255,255,.6)!important;font-size:10px!important}

@media(max-width:900px){body.bp-v4-service .svc-layout{grid-template-columns:1fr!important}body.bp-v4-service .svc-aside{position:static!important}body.bp-v4-category .grid,body.bp-v4-category .service-grid,body.bp-v4-category .services-grid,body.bp-v4-catalog .service-grid,body.bp-v4-catalog .services-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.bp-v4-mast-in{align-items:flex-start;flex-direction:column}}
@media(max-width:620px){.bp-v4-mast{padding:0 14px}.bp-v4-mast-in{padding:18px;border-radius:18px}body.bp-v4-service .svc-hero{padding-top:28px!important}body.bp-v4-service .svc-hero .container,body.bp-v4-category .hero--sm .hero-inner{border-radius:20px;padding:20px!important}body.bp-v4-category .grid,body.bp-v4-category .service-grid,body.bp-v4-category .services-grid,body.bp-v4-catalog .service-grid,body.bp-v4-catalog .services-grid{grid-template-columns:1fr!important}body.bp-public-v4 .site-footer .footer-bottom{flex-direction:column!important;justify-content:center!important;text-align:center!important}}
</style>`;

function classify(rel){
  const clean=rel.replaceAll('\\','/');
  if(/(^|\/)services\/category\/[^/]+\.html$/.test(clean)) return 'category';
  if(/(^|\/)services\/[^/]+\.html$/.test(clean) && !clean.endsWith('/services.html')) return 'service';
  if(clean.endsWith('/services.html') || clean==='services.html') return 'catalog';
  if(clean.endsWith('/packages.html') || clean==='packages.html') return 'packages';
  if(/(^|\/)(ai-agents|compliance-agent|ai-document-agent|shared-services|b10x)\.html$/.test(clean)) return 'ai';
  return null;
}

const mastAr=`<section class="bp-v4-mast"><div class="bp-v4-mast-in"><div><small>B10X · BUSINESS PARTNER</small><strong>كل خدمة جزء من B10X.</strong><p>المستشار الذكي يحدد الخدمة والمتطلبات، وفريقنا ينفذ ويتابع داخل حساب العميل.</p></div><a href="/ar/services">استعرض كل الخدمات</a></div></section>`;
const mastEn=`<section class="bp-v4-mast"><div class="bp-v4-mast-in"><div><small>B10X · BUSINESS PARTNER</small><strong>Every service is part of B10X.</strong><p>AI guidance, human execution and transparent tracking in one operating layer.</p></div><a href="/services">Browse services</a></div></section>`;

let count=0;
for(const file of walk(ROOT)){
  if(!file.endsWith('.html')) continue;
  const rel=path.relative(ROOT,file).replaceAll('\\','/');
  const type=classify(rel);
  if(!type) continue;
  let html=fs.readFileSync(file,'utf8');
  if(html.includes('id="bp-public-v4-css"')) continue;
  html=html.replace('</head>',CSS+'</head>');
  html=html.replace(/<body([^>]*)>/,m=>m.replace('<body','<body class="bp-public-v4 bp-v4-'+type+'"'));
  const isAr=rel.startsWith('ar/');
  if(type==='service'||type==='category'||type==='catalog'||type==='packages'){
    html=html.replace('<main>',(isAr?mastAr:mastEn)+'<main>');
  }
  if(isAr){
    html=html.replaceAll('الوكلاء الأذكياء','المستشارون الأذكياء').replaceAll('الوكيل الذكي','المستشار الذكي').replaceAll('كل الوكلاء الأذكياء','كل المستشارين الأذكياء');
  }
  fs.writeFileSync(file,html);
  count++;
}
console.log(`public-pages-redesign: ${count} pages styled`);
