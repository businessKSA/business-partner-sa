const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html');await p.click('[data-tab=gov]');await p.waitForTimeout(400);
await p.fill('#gv-f','10');await p.fill('#gv-s','5');await p.fill('#gv-r-ajeer','300');await p.waitForTimeout(400);
console.log((await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText)).replace(/\n+/g,' | '));
console.log(await p.evaluate(()=>document.getElementById('gv-f').value+'/'+document.getElementById('gv-s').value));
await p.screenshot({path:'gov.png'});console.log(errs);await b.close();})();
