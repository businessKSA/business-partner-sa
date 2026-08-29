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
.bp-compact-footer .bcf-wrap{max-width:1180px;margin:auto;padding:28px 24px 18px}
.bp-compact-footer .bcf-top{display:grid;grid-template-columns:minmax(220px,1.1fr) minmax(0,2fr);gap:28px;align-items:center}
.bp-compact-footer .bcf-brand img{width:168px;height:auto;filter:brightness(0) invert(1);opacity:.96}
.bp-compact-footer .bcf-brand p{margin:10px 0 0;color:rgba(255,255,255,.72);font-size:.88rem;line-height:1.65;max-width:430px}
.bp-compact-footer .bcf-links{display:flex;justify-content:flex-end;gap:10px 22px;flex-wrap:wrap}
.bp-compact-footer .bcf-links a{color:#fff;text-decoration:none;font-size:.88rem;font-weight:600;opacity:.9}
.bp-compact-footer .bcf-links a:hover{opacity:1;text-decoration:underline}
.bp-compact-footer .bcf-bottom{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);font-size:.78rem;color:rgba(255,255,255,.62)}
.bp-compact-footer .bcf-bottom a{color:inherit;text-decoration:none}
@media(max-width:760px){
 .bp-compact-footer .bcf-wrap{padding:22px 18px 16px}
 .bp-compact-footer .bcf-top{grid-template-columns:1fr;gap:18px}
 .bp-compact-footer .bcf-brand{text-align:center}
 .bp-compact-footer .bcf-brand p{margin:8px auto 0}
 .bp-compact-footer .bcf-links{justify-content:center;gap:10px 16px}
 .bp-compact-footer .bcf-bottom{flex-direction:column;text-align:center;gap:7px;margin-top:18px}
}
</style>`;

function footer(ar){
  const p = ar ? '/ar' : '';
  return `<footer class="bp-compact-footer">
  <div class="bcf-wrap">
    <div class="bcf-top">
      <div class="bcf-brand">
        <a href="${p || '/'}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner"></a>
        <p>${ar ? 'خدمات أعمال وحلول حكومية وتشغيلية مدعومة بالتقنية والذكاء الاصطناعي.' : 'Business services, government operations and execution powered by technology and AI.'}</p>
      </div>
      <nav class="bcf-links" aria-label="${ar ? 'روابط الفوتر' : 'Footer links'}">
        <a href="${p}/services">${ar ? 'خدماتنا' : 'Services'}</a>
        <a href="${p}/about">${ar ? 'من نحن' : 'About'}</a>
        <a href="${p}/saudi-arabia">${ar ? 'مركز المعرفة' : 'Knowledge Center'}</a>
        <a href="${p}/contact">${ar ? 'تواصل معنا' : 'Contact'}</a>
        <a href="${p}/terms">${ar ? 'الشروط والأحكام' : 'Terms'}</a>
        <a href="${p}/privacy">${ar ? 'الخصوصية' : 'Privacy'}</a>
      </nav>
    </div>
    <div class="bcf-bottom">
      <span>© 2026 Business Partner · ${ar ? 'جميع الحقوق محفوظة' : 'All rights reserved'}</span>
      <a href="mailto:business@businesspartner.sa">business@businesspartner.sa</a>
    </div>
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
  if(!html.includes('bp-compact-footer-css')) html=html.replace('</head>',STYLE+'</head>');
  fs.writeFileSync(file,html); changed++;
}
console.log(`Compact footer applied to ${changed} pages`);
