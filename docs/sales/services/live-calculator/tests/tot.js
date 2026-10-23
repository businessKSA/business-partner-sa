const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];const p=await b.newPage({viewport:{width:1300,height:3000}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess');await p.waitForTimeout(500);await p.evaluate(()=>bpGo('ot'));await p.waitForTimeout(300);
console.log(await p.evaluate(()=>{const s=[...document.querySelectorAll('#main section.panel')].pop();return s.innerText.replace(/\n+/g,' | ').slice(-700)}));
console.log(errs);await b.close();})();
