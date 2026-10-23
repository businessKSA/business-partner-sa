const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:3000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(400);
for(const tab of ['lump','cost']){
 await p.click(`[data-tab=${tab}]`);await p.click('[data-demo="00"]');await p.waitForTimeout(300);
 const rd=async()=>{const t=await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText);return {tot:(t.match(tab==='lump'?/السعر الشهري شامل الضريبة\s*\n?\s*([\d,]+)/:/إجمالي الفاتورة الشهرية\s*\n?\s*([\d,]+)/)||[])[1],disc:(t.match(/خصم الكود[^\n]*\n\s*−?([\d,]+)/)||[])[1]};};
 console.log(tab,'no discount',await rd());
 await p.fill('#ds-pct','10');await p.click('#ds-toggle');await p.waitForTimeout(300);console.log(tab,'10% fee only',await rd());
 await p.check('#ds-loc');await p.check('#ds-ops');await p.waitForTimeout(300);console.log(tab,'10% fee+loc+ops',await rd());
 await p.click('#ds-toggle');await p.waitForTimeout(200);console.log(tab,'off',await rd());}
const q=await b.newPage();await q.goto('file://'+process.cwd()+'/index-demo.html');await q.waitForTimeout(400);await q.click('[data-tab=lump]');
await q.fill('#dc-in','DEMO10');await q.click('#dc-apply');await q.waitForTimeout(300);console.log('demo code msg:',await q.evaluate(()=>document.getElementById('dc-msg').textContent));
console.log(errs);await b.close();})();
