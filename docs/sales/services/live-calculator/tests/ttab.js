const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>[...document.querySelectorAll('#tabs button')].map(x=>x.textContent).slice(0,4).join(' | ')),'| selected:',await p.evaluate(()=>document.querySelector('#tabs [aria-selected=true]').textContent));console.log(errs);await b.close();})();
