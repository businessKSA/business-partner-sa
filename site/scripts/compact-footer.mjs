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
.bp-compact-footer,.bp-compact-footer *{writing-mode:horizontal-tb!important;text-orientation:mixed!important}
.bp-compact-footer{background:#081747;color:#fff;border-top:1px solid rgba(255,255,255,.08);min-height:44px}
.bp-compact-footer .bcf-wrap{max-width:1240px;min-height:44px;margin:auto;padding:0 22px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.bp-compact-footer .bcf-copy{font-size:.69rem;color:rgba(255,255,255,.58);white-space:nowrap;line-height:1.2}
.bp-compact-footer .bcf-links{display:flex;align-items:center;justify-content:flex-end;gap:16px;flex-wrap:nowrap;white-space:nowrap}
.bp-compact-footer .bcf-links a{color:rgba(255,255,255,.76);text-decoration:none;font-size:.72rem;font-weight:600;line-height:1.2}
.bp-compact-footer .bcf-links a:hover{color:#fff}
@media(max-width:640px){
 .bp-compact-footer{min-height:58px}
 .bp-compact-footer .bcf-wrap{min-height:58px;padding:7px 14px;flex-direction:column;justify-content:center;gap:5px;text-align:center}
 .bp-compact-footer .bcf-copy{font-size:.65rem;white-space:normal}
 .bp-compact-footer .bcf-links{gap:10px;justify-content:center;flex-wrap:wrap}
 .bp-compact-footer .bcf-links a{font-size:.68rem}
}
</style>`;

function footer(ar){
  const p = ar ? '/ar' : '';
  return `<footer class="bp-compact-footer">
  <div class="bcf-wrap">
    <span class="bcf-copy">© 2026 Business Partner · ${ar ? 'جميع الحقوق محفوظة' : 'All rights reserved'}</span>
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
console.log(`Ultra compact footer applied to ${changed} pages`);
