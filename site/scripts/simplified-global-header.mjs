import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(p));
    else if(e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function prefixFor(file){
  const rel=path.relative(ROOT,file).replaceAll('\\','/');
  if(rel.startsWith('ar/')) return '/ar';
  if(rel.startsWith('fr/')) return '/fr';
  if(rel.startsWith('zh/')) return '/zh';
  return '';
}

function labels(prefix){
  if(prefix==='/ar') return {
    b10x:'B10X', services:'خدماتنا', packages:'الباقات', advisors:'المستشارون الأذكياء', about:'من نحن', contact:'تواصل معنا', login:'تسجيل الدخول', start:'ابدأ الآن', lang:'العربية',
    cols:[
      ['الشركات والتأسيس',[['تأسيس الشركات','/services/category/company-formation'],['الاستثمار الأجنبي','/services/category/foreign-investment'],['الإقامة المميزة','/services/category/premium-residency'],['القانونية والعقود','/packages#pkg-legal']]],
      ['التشغيل والامتثال',[['الخدمات الحكومية','/services/category/government-relations'],['الامتثال والمخالفات','/compliance-agent'],['الموارد البشرية','/services/category/hr-services'],['التوظيف والاستقدام','/services/category/recruitment']]],
      ['المكان والانتقال',[['مساحات الأعمال','/workspaces'],['سكن العمالة','/worker-housing'],['Relocation','/services'],['التموين والضيافة','/farina']]],
      ['النمو والذكاء الاصطناعي',[['B10X','/#bp-consultant'],['Document AI','/ai-document-agent'],['تطوير الأعمال','/revenue-os'],['كل الخدمات','/services']]]
    ]
  };
  return {
    b10x:'B10X', services:'Services', packages:'Packages', advisors:'AI Advisors', about:'About', contact:'Contact', login:'Sign in', start:'Get started', lang:prefix==='/fr'?'Français':prefix==='/zh'?'中文':'English',
    cols:[
      ['Company & Setup',[['Company Formation','/services/category/company-formation'],['Foreign Investment','/services/category/foreign-investment'],['Premium Residency','/services/category/premium-residency'],['Legal Packages','/packages#pkg-legal']]],
      ['Operations & Compliance',[['Government Services','/services/category/government-relations'],['Compliance & Violations','/compliance-agent'],['HR Services','/services/category/hr-services'],['Recruitment','/services/category/recruitment']]],
      ['Workplace & Relocation',[['Workspaces','/workspaces'],['Worker Housing','/worker-housing'],['Relocation','/services'],['Corporate Hospitality','/farina']]],
      ['Growth & AI',[['B10X','/#bp-consultant'],['Document AI','/ai-document-agent'],['Business Development','/revenue-os'],['All Services','/services']]]
    ]
  };
}

function href(prefix,p){ return `${prefix}${p}` || '/'; }

const css=String.raw`<style id="bp-simple-header-css">
.site-header.bp-simple-header{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(18px);border-bottom:1px solid #e9edf4!important;box-shadow:none!important}
.bp-simple-header .bp-hdr{width:min(1220px,calc(100% - 34px));height:76px;margin:auto;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:30px}
.bp-simple-header .bp-logo img{display:block;width:172px;height:auto}
.bp-simple-header .bp-nav{display:flex;align-items:center;justify-content:center;gap:26px;min-width:0}
.bp-simple-header .bp-nav>a,.bp-simple-header summary{font-size:13px;font-weight:750;color:#24314f;text-decoration:none;white-space:nowrap;cursor:pointer;list-style:none;padding:10px 0}
.bp-simple-header summary::-webkit-details-marker{display:none}.bp-simple-header summary:after{content:'⌄';font-size:10px;margin-inline-start:7px;color:#8993a6}
.bp-simple-header .bp-nav>a:hover,.bp-simple-header summary:hover{color:#2856d6}
.bp-simple-header .bp-dd{position:relative}.bp-simple-header .bp-dd[open] summary{color:#2856d6}
.bp-simple-header .bp-mega{position:absolute;top:48px;right:50%;transform:translateX(50%);width:min(880px,88vw);display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:#fff;border:1px solid #e4e9f2;border-radius:22px;padding:16px;box-shadow:0 28px 70px rgba(18,32,75,.16)}
.bp-simple-header .bp-mega-col{padding:8px}.bp-simple-header .bp-mega-col strong{display:block;font-size:11px;color:#8090aa;margin-bottom:9px}.bp-simple-header .bp-mega-col a{display:block;text-decoration:none;color:#17284e;font-size:12px;font-weight:700;padding:8px 9px;border-radius:9px}.bp-simple-header .bp-mega-col a:hover{background:#f4f7ff;color:#2856d6}
.bp-simple-header .bp-mini-menu{position:absolute;top:48px;right:0;width:230px;background:#fff;border:1px solid #e4e9f2;border-radius:16px;padding:8px;box-shadow:0 22px 60px rgba(18,32,75,.14)}.bp-simple-header .bp-mini-menu a{display:block;text-decoration:none;color:#17284e;padding:9px 10px;border-radius:9px;font-size:12px;font-weight:700}.bp-simple-header .bp-mini-menu a:hover{background:#f4f7ff;color:#2856d6}
.bp-simple-header .bp-actions{display:flex;align-items:center;gap:9px}.bp-simple-header .bp-login,.bp-simple-header .bp-start{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:12px;min-height:42px;padding:0 14px;font-size:12px;font-weight:850}.bp-simple-header .bp-login{border:1px solid #dce3ef;color:#17284e;background:#fff}.bp-simple-header .bp-start{background:linear-gradient(135deg,#183bc2,#7a47f5);color:#fff;box-shadow:0 8px 24px rgba(69,74,210,.2)}
.bp-simple-header .bp-lang{position:relative}.bp-simple-header .bp-lang summary{border:0;padding:10px 6px;font-size:12px}.bp-simple-header .bp-mobile-toggle{display:none}
@media(max-width:1050px){.bp-simple-header .bp-nav{gap:16px}.bp-simple-header .bp-nav>a:nth-of-type(4),.bp-simple-header .bp-nav>a:nth-of-type(5){display:none}.bp-simple-header .bp-hdr{gap:18px}}
@media(max-width:820px){.bp-simple-header .bp-hdr{height:auto;min-height:68px;grid-template-columns:1fr auto;padding:10px 0}.bp-simple-header .bp-logo img{width:150px}.bp-simple-header .bp-nav{grid-column:1/-1;order:3;justify-content:flex-start;overflow-x:auto;padding:2px 0 6px;gap:18px;scrollbar-width:none}.bp-simple-header .bp-nav::-webkit-scrollbar{display:none}.bp-simple-header .bp-actions{justify-self:end}.bp-simple-header .bp-login,.bp-simple-header .bp-lang{display:none}.bp-simple-header .bp-start{min-height:38px;padding:0 12px}.bp-simple-header .bp-mega{position:fixed;top:118px;right:16px;left:16px;transform:none;width:auto;grid-template-columns:repeat(2,1fr);max-height:70vh;overflow:auto}}
@media(max-width:540px){.bp-simple-header .bp-mega{grid-template-columns:1fr}.bp-simple-header .bp-nav>a,.bp-simple-header summary{font-size:12px}.bp-simple-header .bp-hdr{width:min(100% - 24px,1220px)}}
</style>`;

for(const file of walk(ROOT)){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('<header class="site-header"')) continue;
  const prefix=prefixFor(file), l=labels(prefix);
  const mega=l.cols.map(([title,items])=>`<div class="bp-mega-col"><strong>${title}</strong>${items.map(([n,p])=>`<a href="${href(prefix,p)}">${n}</a>`).join('')}</div>`).join('');
  const advisors=`<div class="bp-mini-menu"><a href="${href(prefix,'/ai-agents')}">${prefix==='/ar'?'كل المستشارين':'All AI Advisors'}</a><a href="${href(prefix,'/compliance-agent')}">${prefix==='/ar'?'مستشار الامتثال':'Compliance Advisor'}</a><a href="${href(prefix,'/ai-document-agent')}">Document AI</a><a href="${href(prefix,'/shared-services')}">${prefix==='/ar'?'الخدمات المشتركة':'Shared Services'}</a></div>`;
  const langMenu=`<div class="bp-mini-menu"><a href="/">English</a><a href="/ar/">العربية</a><a href="/fr/">Français</a><a href="/zh/">中文</a></div>`;
  const header=`<header class="site-header bp-simple-header"><div class="bp-hdr"><a class="bp-logo" href="${prefix||''}/"><img src="/assets/img/logo.png" alt="Business Partner"></a><nav class="bp-nav"><a href="${href(prefix,'/#bp-consultant')}">${l.b10x}</a><details class="bp-dd"><summary>${l.services}</summary><div class="bp-mega">${mega}</div></details><a href="${href(prefix,'/packages')}">${l.packages}</a><details class="bp-dd"><summary>${l.advisors}</summary>${advisors}</details><a href="${href(prefix,'/about')}">${l.about}</a><a href="${href(prefix,'/contact')}">${l.contact}</a></nav><div class="bp-actions"><details class="bp-dd bp-lang"><summary>${l.lang}</summary>${langMenu}</details><a class="bp-login" href="${href(prefix,'/account')}">${l.login}</a><a class="bp-start" href="${href(prefix,'/consultation')}">${l.start}</a></div></div></header>`;
  html=html.replace(/<header class="site-header">[\s\S]*?<\/header>/,header);
  if(!html.includes('bp-simple-header-css')) html=html.replace('</head>',css+'\n</head>');
  fs.writeFileSync(file,html);
}
console.log('Simplified global header applied');
