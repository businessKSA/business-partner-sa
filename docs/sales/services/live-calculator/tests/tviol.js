const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const f of ['index','index-client','index-demo','index-fawaz']){const p=await b.newPage({viewport:{width:1300,height:3500}});p.on('pageerror',e=>errs.push(f+': '+e.message));
await p.goto('file://'+process.cwd()+'/'+f+'.html?goal=assess&ui=classic');await p.waitForTimeout(500);
if(f==='index'){await p.click('[data-case=m2]');await p.waitForTimeout(300);}
await p.evaluate(()=>bpGo('viol'));await p.waitForTimeout(400);
const t=await p.evaluate(()=>{const m=document.getElementById('main');return [m.querySelectorAll('section.panel')[0].innerText.replace(/\n+/g,' | ').slice(0,700), m.querySelectorAll('tbody tr').length]});
console.log('==',f,t[1],'rows\n',t[0]);}
console.log(errs);await b.close();})();
