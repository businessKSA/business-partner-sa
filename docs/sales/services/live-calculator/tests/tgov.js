const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html');await p.click('[data-tab=gov]');await p.waitForTimeout(400);
await p.fill('#gv-wage','5000');await p.waitForTimeout(300);
console.log((await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText)).replace(/\n+/g,' | '));
await p.screenshot({path:'gov.png'});await p.click('[data-tab=viol]');console.log(await p.evaluate(()=>document.querySelector('.svcban')?.innerText));
console.log(await p.evaluate(()=>[...document.querySelectorAll('#tabs button')].map(x=>x.className).join(',')));
console.log(errs);await b.close();})();
