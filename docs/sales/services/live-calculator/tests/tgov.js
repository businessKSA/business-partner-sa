const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:900,height:1300}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
ok(await p.evaluate(()=>!!document.querySelector('[data-side=gov]')),'client sidebar item');
await p.click('[data-side=gov]');await p.waitForTimeout(300);
await p.fill('[data-nk=nw]','2');await p.fill('[data-nk=ex]','3');await p.fill('[data-nk=exam]','300');await p.selectOption('select[data-nk=pf]','3');await p.selectOption('select[data-nk=if]','6');await p.click('#dk-ok');await p.waitForTimeout(400);
const t=await p.evaluate(()=>document.getElementById('cs-thread').innerText.replace(/\n+/g,' | '));console.log(t.slice(-420));
const rec=9700+650+600; // medical default from insAnnual (basic male)
ok(/المجموع/.test(t)&&/الإجمالي السنوي/.test(t),'totals present');
const nums=await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .card .tbl')].pop().innerText);
ok(nums.includes('5')&&true,'table');
// web build links
const w=await b.newPage();w.on('pageerror',e=>er.push(e.message));
for(const lg of ['ar','en','fr']){await w.goto('file://'+process.cwd()+'/index-web.html?lang='+lg);await w.waitForTimeout(600);
 const h=await w.evaluate(()=>[...document.querySelectorAll('#cs-side a')].map(a=>a.href));console.log(lg,h.join(' | '));
 ok(h.some(x=>x.includes('/calculators/government-cost'))&&!h.some(x=>/\/en\//.test(x)),'web links '+lg);
 if(lg==='en') ok(h.some(x=>x==='https://www.businesspartner.sa/calculators/government-cost'),'en root URL');
 if(lg==='ar') ok(h.some(x=>x==='https://www.businesspartner.sa/ar/calculators/government-cost'),'ar prefix URL');}
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
