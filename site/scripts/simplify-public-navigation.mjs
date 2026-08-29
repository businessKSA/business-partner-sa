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

const CLEANUP = `
<script id="bp-public-nav-cleanup">
(function(){
  function text(el){return (el&&el.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase()}
  function hideClosest(el){
    if(!el)return;
    var box=el.closest('.nav-group,.footer-col,.footer-column,.footer-links-group,li')||el;
    box.style.display='none'; box.setAttribute('aria-hidden','true');
  }
  function clean(){
    document.querySelectorAll('button,a,h4,h3,strong').forEach(function(el){
      var t=text(el);
      if(t==='platforms & portals'||t==='platforms and portals'||t==='المنصات والبوابات'||t==='المنصات و البوابات') hideClosest(el);
      if(t==='revenue os ⚡'||t==='revenue os'||t==='revenue os dashboard') hideClosest(el);
    });
    document.querySelectorAll('a[href="/revenue-dashboard"],a[href="/revenue-os"],a[href="/ar/revenue-dashboard"],a[href="/ar/revenue-os"]').forEach(function(a){
      var box=a.closest('.nav-group.nested,li')||a; box.style.display='none';
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',clean); else clean();
  setTimeout(clean,500);
})();
</script>`;

for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('bp-public-nav-cleanup')) html=html.replace('</body>',CLEANUP+'</body>');
  fs.writeFileSync(file,html);
}
console.log(`Public navigation simplified in ${files.length} pages`);
