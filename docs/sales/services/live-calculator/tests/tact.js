const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.evaluate(()=>bpGo('nit'));
for(const q of ['811002','زراعة الحبوب','مطاعم','تعليم']){
 await p.click('#g-act');await p.fill('#g-act',q);await p.waitForTimeout(150);await p.keyboard.press('Enter');await p.waitForTimeout(300);
 const av=await p.evaluate(()=>document.querySelector('#g-act').value);console.log('picked',av.slice(0,50));await p.evaluate(()=>bpGo('prof'));await p.waitForTimeout(200);
 console.log(q,'actval=',await p.evaluate(()=>document.querySelector('#g-act')?.value),'|',await p.evaluate(()=>document.querySelector('#main').innerText.match(/تُعرض[^\n]*/)?.[0]));
 await p.evaluate(()=>bpGo('nit'));}
console.log(errs);await b.close();})();
