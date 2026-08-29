import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const files = [];
function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir,name);
    const st = fs.statSync(p);
    if(st.isDirectory()) walk(p);
    else if(name.endsWith('.html')) files.push(p);
  }
}
walk(ROOT);

const STYLE = `
<style id="bp-compact-footer-css">
.bp-compact-footer{background:#081747;color:#fff;border-top:1px solid rgba(255,255,255,.08)}
.bp-compact-footer .bcf-wrap{max-width:1180px;margin:auto;padding:13px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.bp-compact-footer .bcf-brand{display:flex;align-items:center;gap:14px;min-width:0}
.bp-compact-footer .bcf-brand img{width:126px;height:auto;filter:brightness(0) invert(1);opacity:.96;display:block}
.bp-compact-footer .bcf-copy{font-size:.72rem;color:rgba(255,255,255,.58);white-space:nowrap}
.bp-compact-footer .bcf-links{display:flex;align-items:center;justify-content:flex-end;gap:16px;flex-wrap:wrap}
.bp-compact-footer .bcf-links a{color:rgba(255,255,255,.78);text-decoration:none;font-size:.76rem;font-weight:600}
.bp-compact-footer .bcf-links a:hover{color:#fff}
@media(max-width:760px){
 .bp-compact-footer .bcf-wrap{padding:12px 16px;flex-direction:column;gap:9px;text-align:center}
 .bp-compact-footer .bcf-brand{flex-direction:column;gap:6px}
 .bp-compact-footer .bcf-brand img{width:112px}
 .bp-compact-footer .bcf-copy{white-space:normal;font-size:.68rem}
 .bp-compact-footer .bcf-links{justify-content:center;gap:11px 14px}
 .bp-compact-footer .bcf-links a{font-size:.72rem}
}
</style>`;

function footer(ar){
  const p = ar ? '/ar' : '';
  const home = p || '/';
  return `<footer class="bp-compact-footer">
  <div class="bcf-wrap">
    <div class="bcf-brand">
      <a href="${home}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner"></a>
      <span class="bcf-copy">© 2026 Business Partner · ${ar ? 'خدمات أعمال وحلول حكومية مدعومة بالذكاء الاصطناعي' : 'AI-powered business & government services'}</span>
    </div>
    <nav class="bcf-links" aria-label="${ar ? 'روابط الفوتر' : 'Footer links'}">
      <a href="${p}/services">${ar ? 'الخدمات' : 'Services'}</a>
      <a href="${p}/about">${ar ? 'من نحن' : 'About'}</a>
      <a href="${p}/terms">${ar ? 'الشروط' : 'Terms'}</a>
      <a href="${p}/privacy">${ar ? 'الخصوصية' : 'Privacy'}</a>
    </nav>
  </div>
</footer>`;
}

let changed=0;
for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  const rel=path.relative(ROOT,file).replaceAll('\\','/');
  const ar=rel==='ar/index.html'||rel.startsWith('ar/');
  if(!html.includes('<footer')) continue;
  html=html.replace(/<footer\b[\s\S]*?<\/footer>/i, footer(ar));
  html=html.replace(/<style id="bp-compact-footer-css">[\s\S]*?<\/style>/, STYLE.replace(/^\n|\n$/g,''));
  if(!html.includes('bp-compact-footer-css')) html=html.replace('</head>',STYLE+'</head>');
  fs.writeFileSync(file,html); changed++;
}
console.log(`Minimal footer applied to ${changed} pages`);
