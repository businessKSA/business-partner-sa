const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const er=[];const p=await b.newPage({viewport:{width:1300,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-all.html');await p.waitForTimeout(800);
const st=async(l)=>console.log(l,'| chat',await p.evaluate(()=>!!document.getElementById('cs')),'| classic app visible',await p.evaluate(()=>getComputedStyle(document.getElementById('app')).display!=='none'),'| sel',await p.evaluate(()=>(document.querySelector('[data-mode]')||{}).value),'| tabs',await p.evaluate(()=>[...document.querySelectorAll('#tabs button')].length),'| rows',await p.evaluate(()=>document.querySelectorAll('#main table tbody tr').length));
await st('client');
for(const m of ['demo','fawaz','owner','client']){ await p.selectOption('[data-mode]',m);await p.waitForTimeout(700);await st(m); if(m==='fawaz') console.log((await p.evaluate(()=>document.getElementById('main').innerText)).slice(0,160).replace(/\n+/g,' | ')); if(m==='owner') console.log('owner btn',await p.evaluate(()=>!!document.getElementById('own'))); }
await p.click('[data-chip=goal][data-arg=assess]');await p.waitForTimeout(300);console.log('chips after goal',await p.evaluate(()=>document.querySelectorAll('#cs-thread .chip').length));
console.log(er);await b.close()})();
