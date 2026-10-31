const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];const p=await b.newPage({viewport:{width:1200,height:2600}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess&ui=classic');await p.waitForTimeout(500);await p.evaluate(()=>bpGo('eos'));await p.waitForTimeout(300);
await p.fill('#e-sal','10000');await p.fill('#e-start','2019-10-01');await p.fill('#e-end','2026-10-01');await p.waitForTimeout(300);
const run=async()=>p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText.split('\n').filter(x=>x.trim()).slice(1,9).join(' | '));
console.log('resign 7y:',await run()); 
await p.selectOption('#e-reason','3');await p.waitForTimeout(250);console.log('agreement:',(await run()).match(/المستحقة.*?\|?\s*([\d,\.]+)/)?.[1]);
await p.fill('#e-start','2024-10-02');await p.selectOption('#e-reason','1');await p.waitForTimeout(250);console.log('resign 2y:',(await run()).slice(0,200));
console.log(errs);await b.close();})();
