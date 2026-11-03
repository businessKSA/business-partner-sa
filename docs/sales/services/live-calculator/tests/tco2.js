const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:3000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-demo.html');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('team'));await p.click('#demo-co2');await p.waitForTimeout(500);
const t=await p.evaluate(()=>[...document.querySelectorAll('#main section.panel')].map(x=>x.innerText.replace(/\n+/g,' | ')).join('\n=====\n'));
console.log(t.slice(0,3800));
await p.screenshot({path:'co2.png',fullPage:true});console.log(errs);await b.close();})();
