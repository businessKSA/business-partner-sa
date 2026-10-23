const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1100}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess');await p.evaluate(()=>bpGo('gov'));await p.waitForTimeout(400);
const g=async()=>(await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText)).replace(/\n+/g,' | ');
console.log(await g());await p.fill('#gv-sal','8000');await p.selectOption('#gv-nat','saudi').catch(async()=>{await p.click('#gv-nat-s').catch(()=>{});});await p.waitForTimeout(400);console.log(await g());
await p.screenshot({path:'gov.png'});console.log(errs);await b.close();})();
