const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:3600}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-fawaz.html');await p.waitForTimeout(600);await p.click('[data-tab=comp]');await p.waitForTimeout(300);
let t=await p.evaluate(()=>[...document.querySelectorAll('#main section.panel')].map(x=>x.innerText.replace(/\n+/g,' | ').slice(0,700)).join('\n=====\n'));console.log(t.slice(0,4200));
await p.selectOption('#fz-sel','12');await p.waitForTimeout(400);
t=await p.evaluate(()=>[...document.querySelectorAll('#main section.panel')].slice(0,5).map(x=>x.innerText.replace(/\n+/g,' | ').slice(0,900)).join('\n=====\n'));console.log('\n#### 1-2397844\n'+t.slice(0,2600));
console.log(errs);await b.close();})();
