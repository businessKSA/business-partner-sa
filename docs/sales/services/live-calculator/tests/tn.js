const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');
for(const q of ['نادل','جرسون','waiter','كاشير','عامل نظافة','سواق']){
 await p.click('#l-prof');await p.fill('#l-prof',q);await p.waitForTimeout(250);
 console.log(q,'→',await p.evaluate(()=>[...document.querySelectorAll('.dd .it')].slice(0,3).map(x=>x.textContent.trim().slice(0,45)).join(' | ')||'لا نتائج'));}
console.log(errs);await b.close();})();
