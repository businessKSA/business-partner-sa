const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:3200}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-demo.html');await p.waitForTimeout(300);
await p.click('[data-tab=team]');await p.click('#demo-co3');await p.waitForTimeout(600);
const t=await p.evaluate(()=>[...document.querySelectorAll('#main section.panel')].map(x=>x.innerText.replace(/\n+/g,' | ')).join('\n=====\n'));
console.log(t.slice(0,4500));
await p.click('#snap-save');await p.waitForTimeout(300);console.log('snapshots rows:',await p.evaluate(()=>document.querySelectorAll('#snap-save')?.length&&[...document.querySelectorAll('section.panel')].pop().querySelectorAll('tbody tr').length));
await p.screenshot({path:'co3.png',fullPage:true});console.log(errs);await b.close();})();
