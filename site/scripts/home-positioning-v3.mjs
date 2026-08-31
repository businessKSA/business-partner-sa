import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const files = [path.join(ROOT,'ar','index.html'), path.join(ROOT,'index.html')];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file,'utf8');
  if (html.includes('bp-positioning-v3')) continue;

  const isAr = file.includes(`${path.sep}ar${path.sep}`);
  const style = `\n<style id="bp-positioning-v3">
  .bp-clarity .hero{padding:64px 0 32px!important}
  .bp-clarity .hero h1{max-width:1040px!important;font-size:clamp(3rem,6vw,5.7rem)!important;line-height:1.02!important}
  .bp-clarity .hero p{max-width:900px!important;font-size:1.08rem!important}
  .bp-positioning-strip{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:24px auto 0;max-width:1020px}
  .bp-positioning-strip a{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border:1px solid #e1e6f0;border-radius:999px;background:#fff;color:#25355f;font-size:.76rem;font-weight:800;box-shadow:0 5px 16px rgba(9,30,78,.04)}
  .bp-positioning-strip a:hover{border-color:#9fb2ef;transform:translateY(-1px)}
  .bp-ai-proof{margin:18px auto 0;color:#657089;font-size:.75rem;font-weight:700}
  .bp-ai-proof b{color:#2455ca}
  .bp-clarity .who{display:none!important}
  @media(max-width:640px){.bp-clarity .hero{padding:40px 0 22px!important}.bp-clarity .hero h1{font-size:2.85rem!important}.bp-positioning-strip{gap:6px}.bp-positioning-strip a{font-size:.69rem;padding:8px 10px}}
  </style>`;

  html = html.replace('</head>', style+'\n</head>');

  if (isAr) {
    html = html.replace(/<h1>[^<]*(?:<span>.*?<\/span>)?[^<]*<\/h1>/, '<h1>نؤسس ونشغّل شركتك <span>في السعودية.</span></h1>');
    html = html.replace(/<section class="hero">([\s\S]*?)<div class="hero-actions">/, (m,inner) => {
      const cleaned = inner.replace(/<p>[\s\S]*?<\/p>/, '<p>من تأسيس الشركة ودخول المستثمر الأجنبي، إلى الخدمات الحكومية والموارد البشرية والامتثال والمكاتب والسكن وتطوير الأعمال — Business Partner تديرها معك من مكان واحد.</p>');
      return `<section class="hero">${cleaned}<div class="bp-positioning-strip">
        <a href="/ar/services/category/company-formation">تأسيس الشركات</a>
        <a href="/ar/services/category/government-relations">الخدمات الحكومية</a>
        <a href="/ar/services/category/hr-services">الموارد البشرية</a>
        <a href="/ar/compliance-agent">الامتثال والمخالفات</a>
        <a href="/ar/workspaces">المكاتب والسكن</a>
        <a href="/ar/revenue-os">تطوير الأعمال</a>
      </div><div class="bp-ai-proof">كل الخدمات مدعومة بـ <b>B10X</b> والمستشار الذكي 24/7 + فريق تنفيذ بشري.</div><div class="hero-actions">`;
    });
  } else {
    html = html.replace(/<h1>[^<]*(?:<span>.*?<\/span>)?[^<]*<\/h1>/, '<h1>Set up and run your company <span>in Saudi Arabia.</span></h1>');
    html = html.replace(/<section class="hero">([\s\S]*?)<div class="hero-actions">/, (m,inner) => {
      const cleaned = inner.replace(/<p>[\s\S]*?<\/p>/, '<p>From company formation and foreign investment to government operations, HR, compliance, offices, housing and business development — managed in one place by Business Partner.</p>');
      return `<section class="hero">${cleaned}<div class="bp-positioning-strip">
        <a href="/services/category/company-formation">Company Setup</a>
        <a href="/services/category/government-relations">Government Services</a>
        <a href="/services/category/hr-services">HR & Workforce</a>
        <a href="/compliance-agent">Compliance & Violations</a>
        <a href="/workspaces">Offices & Housing</a>
        <a href="/revenue-os">Business Development</a>
      </div><div class="bp-ai-proof">All services are powered by <b>B10X</b>, a 24/7 smart advisor and our human operations team.</div><div class="hero-actions">`;
    });
  }

  fs.writeFileSync(file, html);
}
