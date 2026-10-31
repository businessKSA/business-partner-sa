const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const f of ['index','index-client','index-demo','index-fawaz']){const p=await b.newPage({viewport:{width:1200,height:2500}});p.on('pageerror',e=>errs.push(f+e.message));
await p.goto('file://'+process.cwd()+'/'+f+'.html?goal=assess&ui=classic');await p.waitForTimeout(400);
const n=await p.evaluate(()=>document.querySelectorAll('[data-case]').length);
if(n>0){await p.click('[data-case=m1]');await p.waitForTimeout(300);}
const t=await p.evaluate(()=>(document.querySelector('#main .res')||{innerText:'-'}).innerText.replace(/\n+/g,' | ').slice(0,200));
console.log(f,'cases',n,'|',t);}
console.log(errs);await b.close();})();
