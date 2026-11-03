const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];const p=await b.newPage({viewport:{width:1200,height:3000}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-demo.html');await p.waitForTimeout(400);
for(const tab of ['lump','cost']){await p.click(`[data-tab=${tab}]`);await p.click('[data-demo="00"]');await p.waitForTimeout(300);
 const t=await p.evaluate(()=>document.getElementById('main').innerText);
 console.log(tab,(t.match(/مكافأة نهاية الخدمة \(نظام العمل[^\n]*/)||['NO HINT'])[0].slice(0,260));
 console.log(tab,(t.match(/استحقاق نهاية الخدمة[^\n]*\n?[^\n]*/)||['-'])[0].slice(0,160));}
console.log(await p.evaluate(()=>{return typeof eosAmt}).catch(()=>'n/a'),errs);await b.close();})();
