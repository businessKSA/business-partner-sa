import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
// Homepage excluded on purpose: the «B10X هو كل خدمات Business Partner»
// umbrella used to land above the hero. The homepage owns its own B10X
// section, built in order by generate.mjs.
const targets = ['ar/services.html','services.html'];

const CSS = `<style id="bp-b10x-catalog-v2-css">
:root{--b10x-navy:#071a4d;--b10x-blue:#155eef;--b10x-line:#e3e8f2;--b10x-muted:#667085;--b10x-bg:#f8faff}
.bp-b10x-umbrella{background:linear-gradient(135deg,#061847 0%,#0b2e73 58%,#155eef 100%);color:#fff;border-radius:24px;padding:26px;display:grid;grid-template-columns:1.15fr .85fr;gap:20px;align-items:center;margin:22px auto 18px;max-width:1180px;box-shadow:0 20px 60px rgba(7,26,77,.17)}
.bp-b10x-umbrella .k{font-size:10px;font-weight:900;letter-spacing:.13em;color:#cbd8ff;text-transform:uppercase}.bp-b10x-umbrella h2{font-size:clamp(28px,4vw,46px);line-height:1.08;margin:7px 0 10px;color:#fff}.bp-b10x-umbrella p{margin:0;color:#d9e4ff;font-size:14px;line-height:1.85;max-width:720px}.bp-b10x-umbrella .micro{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.bp-b10x-umbrella .micro span{font-size:10.5px;padding:6px 9px;border-radius:99px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16)}
.bp-b10x-orbit{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.bp-b10x-orbit a{display:block;text-decoration:none;color:#fff;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px;min-height:82px}.bp-b10x-orbit a:hover{background:rgba(255,255,255,.14)}.bp-b10x-orbit b{font-size:12px;display:block;margin-bottom:4px}.bp-b10x-orbit small{font-size:9.5px;line-height:1.55;color:#cddaff}
.bp-b10x-catalog{max-width:1180px;margin:0 auto;padding:6px 22px 24px}.bp-b10x-cat-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:16px 0 10px}.bp-b10x-cat-head h2{margin:0;color:var(--b10x-navy);font-size:24px}.bp-b10x-cat-head p{margin:0;color:var(--b10x-muted);font-size:11.5px;line-height:1.65;max-width:580px}
.bp-b10x-filters{display:flex;gap:7px;overflow:auto;padding:4px 0 10px;scrollbar-width:none}.bp-b10x-filters::-webkit-scrollbar{display:none}.bp-b10x-filter{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border-radius:12px;border:1px solid var(--b10x-line);background:#fff;text-decoration:none;color:#344054;font-size:11px;font-weight:800;white-space:nowrap}.bp-b10x-filter:hover{border-color:#a9c0f6;color:var(--b10x-blue);background:#fbfdff}.bp-b10x-filter strong{font-size:12px;color:var(--b10x-navy)}
.bp-b10x-ai-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:4px 0 18px}.bp-b10x-ai-card{background:#fff;border:1px solid var(--b10x-line);border-radius:16px;padding:14px;text-decoration:none;color:inherit;box-shadow:0 7px 24px rgba(16,24,40,.035);transition:.18s ease}.bp-b10x-ai-card:hover{transform:translateY(-2px);border-color:#bfd0f8}.bp-b10x-ai-card .tag{display:inline-block;font-size:8.5px;color:var(--b10x-blue);font-weight:900;background:#eef4ff;border-radius:99px;padding:4px 7px;margin-bottom:8px}.bp-b10x-ai-card b{display:block;color:var(--b10x-navy);font-size:12.5px;margin-bottom:4px}.bp-b10x-ai-card span{display:block;color:var(--b10x-muted);font-size:9.7px;line-height:1.55}
body.bp-b10x-service-catalog .bp-ux-services .bp-ux-hero,body.bp-b10x-service-catalog section.bp-ux-hero{display:none!important}
body.bp-b10x-service-catalog .services-grid,body.bp-b10x-service-catalog .service-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
body.bp-b10x-service-catalog [class*="service-card"]{min-height:0!important;padding:14px!important;border-radius:15px!important;box-shadow:0 6px 20px rgba(16,24,40,.035)!important}
body.bp-b10x-service-catalog [class*="service-card"] h3,body.bp-b10x-service-catalog [class*="service-card"] h4{font-size:13px!important;line-height:1.4!important;margin-bottom:5px!important}body.bp-b10x-service-catalog [class*="service-card"] p{font-size:10.5px!important;line-height:1.55!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media(max-width:900px){.bp-b10x-umbrella{grid-template-columns:1fr}.bp-b10x-ai-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.bp-b10x-umbrella{margin:14px;border-radius:18px;padding:18px}.bp-b10x-catalog{padding:4px 14px 20px}.bp-b10x-cat-head{display:block}.bp-b10x-cat-head p{margin-top:5px}.bp-b10x-ai-row{grid-template-columns:1fr 1fr}.bp-b10x-orbit{grid-template-columns:1fr 1fr}body.bp-b10x-service-catalog .services-grid,body.bp-b10x-service-catalog .service-grid{grid-template-columns:1fr 1fr!important}}
</style>`;

const arUmbrella = `<section class="bp-b10x-umbrella" id="b10x-all-services"><div><div class="k">B10X · ALL BUSINESS PARTNER SERVICES</div><h2>B10X هو كل خدمات Business Partner.</h2><p>من تأسيس الشركة إلى تشغيلها ونموها: كل خدمة في الموقع جزء من B10X. أنت لا تحتاج تعرف اسم الإجراء أو المنصة — اشرح النتيجة التي تريدها، والمستشار الذكي يحدد الخدمة والمتطلبات ويقودك للتنفيذ.</p><div class="micro"><span>متاح 24/7</span><span>AI + فريق تنفيذ</span><span>طلبات موثقة</span><span>SLA ومتابعة</span><span>مستندات داخل حسابك</span></div></div><div class="bp-b10x-orbit"><a href="/ar/ai-agents"><b>مستشار B10X الذكي</b><small>يفهم احتياجك ويوجهك لأي خدمة في الموقع.</small></a><a href="/ar/compliance-agent"><b>مستشار الامتثال</b><small>التزامات، مخالفات، تنبيهات واعتراضات.</small></a><a href="/ar/ai-document-agent"><b>مستشار المستندات</b><small>قراءة الملفات وتجهيز المتطلبات آليًا.</small></a><a href="/ar/business-development"><b>مستشار تطوير الأعمال</b><small>عملاء، موردون، فرص وPipeline.</small></a></div></section>`;

const enUmbrella = `<section class="bp-b10x-umbrella" id="b10x-all-services"><div><div class="k">B10X · ALL BUSINESS PARTNER SERVICES</div><h2>B10X is every Business Partner service.</h2><p>From formation to operations and growth, every service on the site sits inside B10X. Tell the intelligent advisor the outcome you need; it identifies the service, requirements and next execution step.</p><div class="micro"><span>24/7 access</span><span>AI + operations team</span><span>Tracked requests</span><span>SLA visibility</span><span>Private documents</span></div></div><div class="bp-b10x-orbit"><a href="/ai-agents"><b>B10X Intelligent Advisor</b><small>Routes any need to the right service.</small></a><a href="/compliance-agent"><b>Compliance Advisor</b><small>Compliance, violations, alerts and objections.</small></a><a href="/ai-document-agent"><b>Document Advisor</b><small>Reads documents and prepares requirements.</small></a><a href="/business-development"><b>Business Development Advisor</b><small>Customers, suppliers, opportunities and pipeline.</small></a></div></section>`;

const arCatalog = `<section class="bp-b10x-catalog"><div class="bp-b10x-cat-head"><div><h2>استكشف B10X حسب احتياجك</h2></div><p>اختر المجال فقط. كل بطاقة تقودك للخدمات التفصيلية، بينما المستشار الذكي يقدر يختار لك الخدمة إذا ما كنت تعرف اسمها.</p></div><div class="bp-b10x-filters"><a class="bp-b10x-filter" href="/ar/services/category/company-formation"><strong>🏢</strong> الشركات والتأسيس</a><a class="bp-b10x-filter" href="/ar/services/category/foreign-investment"><strong>🌍</strong> المستثمر الأجنبي</a><a class="bp-b10x-filter" href="/ar/services/category/government-relations"><strong>🏛️</strong> الحكومية والتراخيص</a><a class="bp-b10x-filter" href="/ar/compliance-agent"><strong>✓</strong> الامتثال والمخالفات</a><a class="bp-b10x-filter" href="/ar/services/category/hr-services"><strong>👥</strong> الموظفين والموارد البشرية</a><a class="bp-b10x-filter" href="/ar/worker-housing"><strong>⌂</strong> سكن العمالة</a><a class="bp-b10x-filter" href="/ar/workspaces"><strong>▦</strong> المكاتب والتأجير</a><a class="bp-b10x-filter" href="/ar/mahfol-makfol"><strong>↗</strong> Relocation ودخول السوق</a><a class="bp-b10x-filter" href="/ar/business-development"><strong>◎</strong> تطوير الأعمال</a><a class="bp-b10x-filter" href="/ar/packages#pkg-legal"><strong>§</strong> القانونية والعقود</a><a class="bp-b10x-filter" href="/ar/ai-agents"><strong>AI</strong> الذكاء الاصطناعي</a><a class="bp-b10x-filter" href="/ar/packages"><strong>◫</strong> الباقات</a></div><div class="bp-b10x-ai-row"><a class="bp-b10x-ai-card" href="/ar/ai-agents"><span class="tag">AI CORE</span><b>مستشار B10X الذكي</b><span>متاح 24/7 ويعرف خدمات Business Partner ويربط السؤال بالتنفيذ.</span></a><a class="bp-b10x-ai-card" href="/ar/compliance-agent"><span class="tag">COMPLIANCE</span><b>مستشار الامتثال</b><span>يراقب الالتزامات والمخالفات ويقترح الإجراء التالي.</span></a><a class="bp-b10x-ai-card" href="/ar/ai-document-agent"><span class="tag">DOCUMENT AI</span><b>مستشار المستندات</b><span>يقرأ المستندات ويستخرج البيانات ويتحقق من المتطلبات.</span></a><a class="bp-b10x-ai-card" href="/ar/business-development"><span class="tag">GROWTH</span><b>مستشار تطوير الأعمال</b><span>يساعد في العملاء والموردين والفرص والاجتماعات.</span></a></div></section>`;

const enCatalog = `<section class="bp-b10x-catalog"><div class="bp-b10x-cat-head"><div><h2>Explore B10X by need</h2></div><p>Choose a category, or let the intelligent advisor identify the exact service for you.</p></div><div class="bp-b10x-filters"><a class="bp-b10x-filter" href="/services/category/company-formation">Companies & formation</a><a class="bp-b10x-filter" href="/services/category/foreign-investment">Foreign investment</a><a class="bp-b10x-filter" href="/services/category/government-relations">Government & licensing</a><a class="bp-b10x-filter" href="/compliance-agent">Compliance & violations</a><a class="bp-b10x-filter" href="/services/category/hr-services">HR & workforce</a><a class="bp-b10x-filter" href="/worker-housing">Worker housing</a><a class="bp-b10x-filter" href="/workspaces">Offices & leasing</a><a class="bp-b10x-filter" href="/mahfol-makfol">Relocation</a><a class="bp-b10x-filter" href="/business-development">Business development</a><a class="bp-b10x-filter" href="/ai-agents">AI services</a></div><div class="bp-b10x-ai-row"><a class="bp-b10x-ai-card" href="/ai-agents"><span class="tag">AI CORE</span><b>B10X Intelligent Advisor</b><span>24/7 access to the full Business Partner service layer.</span></a><a class="bp-b10x-ai-card" href="/compliance-agent"><span class="tag">COMPLIANCE</span><b>Compliance Advisor</b><span>Compliance, violations and next actions.</span></a><a class="bp-b10x-ai-card" href="/ai-document-agent"><span class="tag">DOCUMENT AI</span><b>Document Advisor</b><span>Reads and validates business documents.</span></a><a class="bp-b10x-ai-card" href="/business-development"><span class="tag">GROWTH</span><b>Business Development Advisor</b><span>Customers, suppliers, opportunities and meetings.</span></a></div></section>`;

function replaceAdvisorLanguage(html, lang){
  if(lang==='ar') return html
    .replaceAll('الوكيل الذكي','المستشار الذكي')
    .replaceAll('الوكلاء الأذكياء','المستشارون الأذكياء')
    .replaceAll('الوكلاء الذكيون','المستشارون الأذكياء')
    .replaceAll('وكيل الامتثال','مستشار الامتثال')
    .replaceAll('وكيل المستندات','مستشار المستندات');
  return html.replaceAll('AI Agent','Intelligent Advisor').replaceAll('AI Agents','Intelligent Advisors');
}

let changed=0;
for(const [rel,lang] of targets.map(x=>[x,x.startsWith('ar/')?'ar':'en'])){
  const file=path.join(ROOT,rel); if(!fs.existsSync(file)) continue;
  let html=fs.readFileSync(file,'utf8');
  html=replaceAdvisorLanguage(html,lang);
  if(!html.includes('bp-b10x-catalog-v2-css')) html=html.replace('</head>',CSS+'\n</head>');
  const isServices=/^ar\/services\.html$|^services\.html$/.test(rel);
  const isHome=/^ar\/index\.html$|^index\.html$/.test(rel);
  if(isServices){
    html=html.replace('<body','<body class="bp-b10x-service-catalog"');
    const headerEnd=html.indexOf('</header>');
    if(headerEnd>-1 && !html.includes('id="b10x-all-services"')){
      const block=(lang==='ar'?arUmbrella+arCatalog:enUmbrella+enCatalog);
      html=html.slice(0,headerEnd+9)+block+html.slice(headerEnd+9);
    }
  }
  if(isHome){
    const marker='id="bp-capabilities"';
    if(!html.includes('id="b10x-all-services"')){
      const block=(lang==='ar'?arUmbrella:enUmbrella);
      const p=html.indexOf('<section',html.indexOf('</header>')+9);
      if(p>-1) html=html.slice(0,p)+block+html.slice(p);
    }
  }
  fs.writeFileSync(file,html);changed++;
}
console.log(`B10X services catalog v2 applied to ${changed} pages`);
