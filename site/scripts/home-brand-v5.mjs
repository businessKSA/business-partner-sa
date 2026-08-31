import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('site');
const files=[path.join(ROOT,'ar','index.html'),path.join(ROOT,'index.html')];

const css=String.raw`<style id="bp-home-brand-v5-css">
body.bp-home-clarity{background:#fff!important}
.bp-home-clarity .wa-fab{display:none!important}
.bp-home-clarity .bp-clarity{--bp-navy:#07163f;--bp-blue:#3159d8;--bp-cyan:#43d6f4;--bp-mint:#16b875;--bp-ink:#101a35;--bp-muted:#68748d;--bp-line:#e5e9f2;--bp-soft:#f7f9fd}
.bp-home-clarity .bp-clarity .hero{padding:54px 0 28px!important;background:radial-gradient(circle at 82% 6%,rgba(58,92,224,.10),transparent 24%),radial-gradient(circle at 14% 2%,rgba(67,214,244,.09),transparent 20%),#fff}
.bp-home-clarity .bp-clarity .hero .wrap{max-width:1180px}
.bp-home-clarity .bp-clarity .hero .pill{background:#fff!important;border-color:#dfe6f3!important;box-shadow:0 6px 22px rgba(21,42,96,.05)}
.bp-home-clarity .bp-clarity .hero h1{max-width:1040px!important;margin:16px auto 14px!important;font-size:clamp(3.15rem,6vw,5.8rem)!important;line-height:.98!important;letter-spacing:-.065em!important;color:var(--bp-navy)!important}
.bp-home-clarity .bp-clarity .hero p{max-width:900px!important;font-size:1.03rem!important;line-height:1.85!important;color:var(--bp-muted)!important}
.bp-brand-promise{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:22px auto 0;max-width:1020px}
.bp-brand-promise span{padding:8px 11px;border:1px solid #e2e7f0;border-radius:999px;background:#fff;color:#33466f;font-size:.72rem;font-weight:800}
.bp-brand-proof{display:flex;align-items:center;justify-content:center;gap:15px;flex-wrap:wrap;margin:17px auto 0;color:#7c879c;font-size:.69rem;font-weight:750}
.bp-brand-proof b{color:#1e4fc7}.bp-brand-proof i{width:4px;height:4px;background:#c7cfde;border-radius:50%}
.bp-home-clarity .bp-clarity .hero-actions{margin-top:21px!important}
.bp-home-clarity .bp-clarity .hero-actions .primary{background:linear-gradient(135deg,#07163f,#3159d8)!important;box-shadow:0 13px 30px rgba(36,75,184,.18)!important}
.bp-home-clarity .bp-clarity .chat-sec{padding:24px 0 54px!important;background:linear-gradient(180deg,#fff,#f7f9fd 65%,#fff)!important}
.bp-home-clarity .bp-clarity .chat-grid{max-width:980px!important;margin:auto!important;grid-template-columns:1fr!important}
.bp-home-clarity .bp-clarity .chat-copy{max-width:780px!important;text-align:center!important;margin:0 auto 15px!important}
.bp-home-clarity .bp-clarity .chat-copy .pill{display:none!important}
.bp-home-clarity .bp-clarity .chat-copy h2{font-size:clamp(2rem,3.4vw,3.15rem)!important;margin-bottom:8px!important;color:var(--bp-navy)!important}
.bp-home-clarity .bp-clarity .chat-copy p{font-size:.9rem!important;color:var(--bp-muted)!important}.bp-home-clarity .bp-clarity .chat-copy ul{display:none!important}
.bp-home-clarity .bp-chat-shell{max-width:930px!important;border-radius:29px!important;box-shadow:0 28px 80px rgba(26,61,157,.16)!important}
.bp-home-clarity .bp-chat-body{min-height:230px!important;max-height:310px!important}
.bp-home-clarity #bp-services{padding:58px 0 66px!important;background:#fff!important}
.bp-home-clarity #bp-services .head{max-width:820px!important;margin-bottom:24px!important}
.bp-home-clarity #bp-services .head h2{font-size:clamp(2.15rem,3.8vw,3.35rem)!important;color:var(--bp-navy)!important}
.bp-home-clarity #bp-services .head p{font-size:.86rem!important}
.bp-ai-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 18px}
.bp-ai-card{display:block;border-radius:20px;padding:17px 18px;border:1px solid #dfe5f0;background:linear-gradient(145deg,#fff,#f8faff);min-height:130px;transition:.2s;position:relative;overflow:hidden}
.bp-ai-card:hover{transform:translateY(-3px);box-shadow:0 14px 38px rgba(20,49,125,.09);border-color:#afc0f0}.bp-ai-card:after{content:'AI';position:absolute;left:13px;bottom:-13px;font-size:3.3rem;font-weight:950;color:rgba(40,83,198,.035)}
.bp-ai-card small{display:inline-flex;padding:5px 7px;border-radius:8px;background:#edf3ff;color:#2856c7;font-size:.58rem;font-weight:900;margin-bottom:17px}.bp-ai-card strong{display:block;color:#142653;font-size:.87rem;margin-bottom:6px}.bp-ai-card span{display:block;color:#778198;font-size:.68rem;line-height:1.65}
.bp-service-label{font-size:.7rem;font-weight:900;color:#6f7b92;margin:24px 2px 11px;text-transform:uppercase;letter-spacing:.04em}
.bp-home-clarity #bp-services .cap-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important}
.bp-home-clarity #bp-services .cap{display:block!important;min-height:152px!important;border-radius:20px!important;padding:17px!important;border:1px solid var(--bp-line)!important;background:#fff!important;position:relative;overflow:hidden}
.bp-home-clarity #bp-services .cap:hover{border-color:#b7c4e8!important;box-shadow:0 12px 34px rgba(15,39,103,.08)!important}
.bp-home-clarity #bp-services .cap i{width:38px!important;height:38px!important;border-radius:12px!important;margin-bottom:16px!important;background:#eef3ff!important;color:#2b56c3!important;font-size:.72rem!important}
.bp-home-clarity #bp-services .cap strong{font-size:.82rem!important;color:#172854!important}.bp-home-clarity #bp-services .cap span{font-size:.67rem!important;color:#778198!important}
.bp-home-clarity #bp-packages{padding:62px 0!important;background:#f7f9fd!important}
.bp-home-clarity #bp-packages .head h2{color:var(--bp-navy)!important}
.bp-home-clarity #bp-packages .pkg-grid{grid-template-columns:1.25fr repeat(3,1fr)!important;gap:11px!important}
.bp-home-clarity #bp-packages .pkgx{border-radius:22px!important;padding:20px!important}.bp-home-clarity #bp-packages .b10x-package{min-height:100%;background:radial-gradient(circle at 90% 5%,rgba(67,214,244,.18),transparent 28%),linear-gradient(145deg,#07163f,#153f96)!important}
.bp-home-clarity #bp-packages .b10x-package h3{font-size:1.45rem!important}
.bp-home-clarity .demo-card{border-radius:22px!important}
@media(max-width:980px){.bp-ai-row,.bp-home-clarity #bp-services .cap-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.bp-home-clarity #bp-packages .pkg-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:640px){.bp-home-clarity .bp-clarity .hero{padding:38px 0 20px!important}.bp-home-clarity .bp-clarity .hero h1{font-size:2.75rem!important}.bp-brand-promise{gap:6px}.bp-brand-promise span{font-size:.65rem}.bp-ai-row,.bp-home-clarity #bp-services .cap-grid,.bp-home-clarity #bp-packages .pkg-grid{grid-template-columns:1fr!important}}
</style>`;

const arServices=String.raw`
<a class="cap" href="/ar/services/category/company-formation"><i>01</i><strong>تأسيس الشركات والاستثمار</strong><span>تأسيس محلي وأجنبي، التراخيص، التسجيل وما بعد التأسيس.</span></a>
<a class="cap" href="/ar/services/category/government-relations"><i>02</i><strong>الخدمات الحكومية والتراخيص</strong><span>قوى، التأمينات، بلدي، الزكاة والضريبة وغيرها من منصات الأعمال.</span></a>
<a class="cap" href="/ar/services/category/hr-services"><i>03</i><strong>الموارد البشرية والقوى العاملة</strong><span>HR Operations، نقل خدمات، توظيف، استقدام وتشغيل القوى العاملة.</span></a>
<a class="cap" href="/ar/compliance-agent"><i>04</i><strong>الامتثال والمخالفات</strong><span>متابعة الالتزامات، التنبيهات، المخالفات ومسارات الاعتراض والمعالجة.</span></a>
<a class="cap" href="/ar/workspaces"><i>05</i><strong>المكاتب والعقار</strong><span>مكاتب، مساحات عمل، بحث عقاري وحلول تشغيل المكان.</span></a>
<a class="cap" href="/ar/worker-housing"><i>06</i><strong>السكن والانتقال</strong><span>سكن العمالة، السكن التنفيذي، Relocation والخدمات المساندة.</span></a>
<a class="cap" href="/ar/packages#pkg-legal"><i>07</i><strong>القانونية والعقود</strong><span>عقود واتفاقيات ومراجعات قانونية مرتبطة بتشغيل الشركة.</span></a>
<a class="cap" href="/ar/revenue-os"><i>08</i><strong>تطوير الأعمال</strong><span>عملاء، موردون، شركاء، Pipeline وفرص نمو في السوق السعودي.</span></a>`;

const enServices=String.raw`
<a class="cap" href="/services/category/company-formation"><i>01</i><strong>Company Setup & Investment</strong><span>Local and foreign setup, licensing, registration and post-formation.</span></a>
<a class="cap" href="/services/category/government-relations"><i>02</i><strong>Government Services</strong><span>Qiwa, GOSI, Balady, ZATCA and business platform operations.</span></a>
<a class="cap" href="/services/category/hr-services"><i>03</i><strong>HR & Workforce</strong><span>HR operations, employee transfers, recruitment and workforce solutions.</span></a>
<a class="cap" href="/compliance-agent"><i>04</i><strong>Compliance & Violations</strong><span>Obligations, alerts, violations, objections and remediation workflows.</span></a>
<a class="cap" href="/workspaces"><i>05</i><strong>Offices & Real Estate</strong><span>Offices, workspaces, real-estate search and workplace operations.</span></a>
<a class="cap" href="/worker-housing"><i>06</i><strong>Housing & Relocation</strong><span>Worker housing, executive housing, relocation and support services.</span></a>
<a class="cap" href="/packages#pkg-legal"><i>07</i><strong>Legal & Contracts</strong><span>Contracts, agreements and business legal support.</span></a>
<a class="cap" href="/revenue-os"><i>08</i><strong>Business Development</strong><span>Customers, suppliers, partners, pipeline and Saudi market opportunities.</span></a>`;

const arAi=String.raw`
<a class="bp-ai-card" href="#bp-consultant"><small>B10X</small><strong>المستشار الذكي</strong><span>متاح 24/7 لفهم المطلوب وتحديد الخدمة والخطوة التالية.</span></a>
<a class="bp-ai-card" href="/ar/compliance-agent"><small>AI</small><strong>مستشار الامتثال</strong><span>يراقب الالتزامات والمخالفات والمواعيد ومسارات المعالجة.</span></a>
<a class="bp-ai-card" href="/ar/ai-document-agent"><small>AI</small><strong>مستشار المستندات</strong><span>يقرأ الملفات ويستخرج البيانات ويتحقق من المتطلبات داخل حسابك.</span></a>
<a class="bp-ai-card" href="/ar/revenue-os"><small>AI</small><strong>مستشار تطوير الأعمال</strong><span>يساعد في العملاء والموردين والشركاء وبناء Pipeline للنمو.</span></a>`;
const enAi=String.raw`
<a class="bp-ai-card" href="#bp-consultant"><small>B10X</small><strong>Smart Advisor</strong><span>Available 24/7 to understand your goal and route the next action.</span></a>
<a class="bp-ai-card" href="/compliance-agent"><small>AI</small><strong>Compliance Advisor</strong><span>Tracks obligations, violations, deadlines and remediation paths.</span></a>
<a class="bp-ai-card" href="/ai-document-agent"><small>AI</small><strong>Document Advisor</strong><span>Reads files, extracts data and checks requirements securely.</span></a>
<a class="bp-ai-card" href="/revenue-os"><small>AI</small><strong>Business Development Advisor</strong><span>Supports customer, supplier, partner and pipeline growth.</span></a>`;

const js=(isAr)=>String.raw`<script id="bp-home-brand-v5-js">(function(){function run(){var root=document.querySelector('#bp-home-clarity');if(!root)return;var hero=root.querySelector('.hero'),chat=root.querySelector('#bp-consultant'),services=root.querySelector('#bp-services'),packages=root.querySelector('#bp-packages');if(hero&&chat)hero.insertAdjacentElement('afterend',chat);if(chat&&services)chat.insertAdjacentElement('afterend',services);if(services&&packages)services.insertAdjacentElement('afterend',packages);
var pill=hero&&hero.querySelector('.pill');if(pill)pill.innerHTML='<i></i> '+${JSON.stringify(isAr?'Business Partner · تأسيس وتشغيل الشركات في السعودية':'Business Partner · Company Setup & Operations in Saudi Arabia')};
var h1=hero&&hero.querySelector('h1');if(h1)h1.innerHTML=${JSON.stringify(isAr?'نؤسس شركتك. نشغّلها. <span>ونساعدك تنمو في السعودية.</span>':'Set up your company. Run it. <span>Grow in Saudi Arabia.</span>')};
var hp=hero&&hero.querySelector('p');if(hp)hp.textContent=${JSON.stringify(isAr?'Business Partner تجمع تأسيس الشركات، الخدمات الحكومية، الموارد البشرية، الامتثال، المكاتب والسكن وتطوير الأعمال في تجربة تشغيل واحدة مدعومة بالذكاء الاصطناعي وفريق تنفيذ متخصص.':'Business Partner brings company setup, government operations, HR, compliance, offices, housing and business development into one AI-powered operating experience.')};
if(hero&&!hero.querySelector('.bp-brand-promise')){var p=document.createElement('div');p.className='bp-brand-promise';p.innerHTML=${JSON.stringify(isAr?'<span>تأسيس الشركات</span><span>الخدمات الحكومية</span><span>الموارد البشرية</span><span>الامتثال والمخالفات</span><span>المكاتب والسكن</span><span>تطوير الأعمال</span>':'<span>Company Setup</span><span>Government Services</span><span>HR & Workforce</span><span>Compliance</span><span>Offices & Housing</span><span>Business Development</span>')};var acts=hero.querySelector('.hero-actions');if(acts)acts.insertAdjacentElement('beforebegin',p);var proof=document.createElement('div');proof.className='bp-brand-proof';proof.innerHTML=${JSON.stringify(isAr?'<b>B10X</b><i></i><span>مستشار ذكي 24/7</span><i></i><span>فريق تنفيذ بشري</span><i></i><span>Client Portal + SLA</span>':'<b>B10X</b><i></i><span>24/7 Smart Advisor</span><i></i><span>Human Operations Team</span><i></i><span>Client Portal + SLA</span>')};p.insertAdjacentElement('afterend',proof)}
var acts=hero&&hero.querySelector('.hero-actions');if(acts){acts.innerHTML=${JSON.stringify(isAr?'<a class="btnx primary" href="#bp-consultant">ابدأ مع المستشار الذكي</a><a class="btnx" href="#bp-services">استعرض خدماتنا</a>':'<a class="btnx primary" href="#bp-consultant">Start with the Smart Advisor</a><a class="btnx" href="#bp-services">Explore Services</a>')}}
var ch=chat&&chat.querySelector('.chat-copy h2');if(ch)ch.textContent=${JSON.stringify(isAr?'قل لنا ماذا تحتاج. B10X يحدد لك الطريق.':'Tell us what you need. B10X finds the path.')};var cp=chat&&chat.querySelector('.chat-copy p');if(cp)cp.textContent=${JSON.stringify(isAr?'لا تحتاج تعرف اسم الخدمة أو المنصة. اشرح النتيجة التي تريدها، والمستشار الذكي يوجّهك للخدمة والمتطلبات والتنفيذ.':'You do not need to know the service or platform name. Describe the outcome and the smart advisor routes the service, requirements and execution.')};
if(services){var head=services.querySelector('.head h2');if(head)head.textContent=${JSON.stringify(isAr?'كل ما تحتاجه شركتك في مكان واحد.':'Everything your company needs, in one place.')};var desc=services.querySelector('.head p');if(desc)desc.textContent=${JSON.stringify(isAr?'اختر المجال، أو استخدم أحد المستشارين الأذكياء للوصول مباشرة للمسار المناسب.':'Choose a business area, or use one of the AI advisors to reach the right workflow.')};var grid=services.querySelector('.cap-grid');if(grid){grid.innerHTML=${JSON.stringify(isAr?arServices:enServices)};if(!services.querySelector('.bp-ai-row')){var row=document.createElement('div');row.className='bp-ai-row';row.innerHTML=${JSON.stringify(isAr?arAi:enAi)};var wrap=grid.parentElement;wrap.insertBefore(row,grid);var lab=document.createElement('div');lab.className='bp-service-label';lab.textContent=${JSON.stringify(isAr?'مجالات خدمات Business Partner':'Business Partner service areas')};wrap.insertBefore(lab,grid)}}}
var ph=packages&&packages.querySelector('.head h2');if(ph)ph.textContent=${JSON.stringify(isAr?'اختر طريقة العمل المناسبة لشركتك.':'Choose how you want to work with us.')};var pp=packages&&packages.querySelector('.head p');if(pp)pp.textContent=${JSON.stringify(isAr?'ابدأ بـB10X أو اختر من باقات الخدمات والتأسيس والدعم القانوني.':'Start with B10X or choose service, formation and legal packages.')};var bl=packages&&packages.querySelector('.b10x-package a');if(bl)bl.href=${JSON.stringify(isAr?'/ar/b10x':'/b10x')};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();</script>`;

for(const file of files){if(!fs.existsSync(file))continue;let html=fs.readFileSync(file,'utf8');const isAr=file.includes(`${path.sep}ar${path.sep}`);html=html.replace(/<style id="bp-home-brand-v5-css">[\s\S]*?<\/style>/g,'').replace(/<script id="bp-home-brand-v5-js">[\s\S]*?<\/script>/g,'');html=html.replace('</head>',css+'\n</head>');html=html.replace('</body>',js(isAr)+'\n</body>');fs.writeFileSync(file,html)}
console.log('Homepage brand v5 applied');
