import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const targets = [];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const name of fs.readdirSync(dir)){
    const p=path.join(dir,name), st=fs.statSync(p);
    if(st.isDirectory()) walk(p);
    else if(name==='account.html') targets.push(p);
  }
}
walk(ROOT);

const GUARD = `
<script id="bp-tenant-browser-guard">
(function(){
  if(window.__bpTenantGuard)return; window.__bpTenantGuard=1;
  function purge(){
    try{
      var keep={bp_lang:1,bp_cookie_consent:1};
      for(var i=localStorage.length-1;i>=0;i--){
        var k=localStorage.key(i); if(k&&/^bp_/i.test(k)&&!keep[k]) localStorage.removeItem(k);
      }
    }catch(e){}
    try{
      for(var j=sessionStorage.length-1;j>=0;j--){
        var s=sessionStorage.key(j); if(s&&/^bp_/i.test(s)) sessionStorage.removeItem(s);
      }
    }catch(e){}
  }
  ['logoutBtn','logoutBtnM'].forEach(function(id){
    var b=document.getElementById(id); if(b)b.addEventListener('click',purge,true);
  });
  window.__bpPurgeTenantState=purge;
})();
</script>`;

let n=0;
for(const file of targets){
  let html=fs.readFileSync(file,'utf8');
  if(html.includes('bp-tenant-browser-guard')) continue;
  html=html.replace('</body>',GUARD+'</body>');
  fs.writeFileSync(file,html); n++;
}
console.log(`Tenant browser guard applied to ${n} account page(s)`);
