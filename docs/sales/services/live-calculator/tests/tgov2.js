const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1100}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess');await p.click('[data-jr=nit]');await p.evaluate(()=>bpGo('gov'));await p.waitForTimeout(300);
const ids=await p.evaluate(()=>[...document.querySelectorAll('#main [id^=gv-]')].map(e=>e.id+':'+e.tagName));console.log(ids.join(' '));
await p.click('#gv-nat-s');await p.waitForTimeout(200);await p.fill('#gv-nat-s','سعودي');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);
console.log((await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText)).replace(/\n+/g,' | ').slice(0,500));console.log(er);await b.close()})();
