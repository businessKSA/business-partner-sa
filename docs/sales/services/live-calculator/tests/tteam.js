const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
const o=await b.newPage({viewport:{width:1200,height:3000}});o.on('pageerror',e=>errs.push(e.message));
await o.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await o.waitForTimeout(400);await o.evaluate(()=>bpGo('team'));
console.log('owner demo bar present:',await o.evaluate(()=>!!document.querySelector('.demo')));
const p=await b.newPage({viewport:{width:1200,height:3000}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-demo.html');await p.waitForTimeout(400);
console.log('reset btn in demo:',await p.evaluate(()=>!!document.getElementById('bp-reset')));
for(const k of ['s1','s2','m0','m1','m2']){await p.evaluate(()=>bpGo('co'));await p.waitForTimeout(150);await p.click(`[data-case=${k}]`);await p.waitForTimeout(300);
 const t=await p.evaluate(()=>{const r=document.querySelector('#main section.panel .res');return r?r.innerText.replace(/\n+/g,' | '):''});
 const rows=await p.evaluate(()=>[...document.querySelectorAll('#main section.panel tbody tr')].slice(0,8).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,200)));
 console.log('\n==',k,'\n',t);rows.forEach(x=>console.log('  ',x));
 if(k==='m2') await p.screenshot({path:'team-m2.png',fullPage:true});}
console.log('errors',errs);await b.close();})();
