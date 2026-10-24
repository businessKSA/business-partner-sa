const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
await p.evaluate(()=>{const q=bpT();q.CV.items=[{prof:+Object.keys(q.PROF)[5],qty:1,nat:'abroad',sal:0,cands:[+Object.keys(q.PROF)[5]]}];q.CV.term={u:'day',n:3}});
ok(await p.evaluate(()=>{const q=bpT();return true}),'setup');
await p.evaluate(()=>{});
// hire from term choice: long term keeps abroad option
await p.evaluate(()=>{const q=bpT();q.CV.term=12});
await p.click('.chip:has-text("توظيف بالساعة")');await p.waitForTimeout(300);
await p.click('.chip:has-text("باليوم")');await p.waitForTimeout(200);
await p.click('#dk-ok');await p.waitForTimeout(300);
await p.fill('#dk-q','محاسب');await p.waitForTimeout(300);await p.click('#dk-sg [data-pick]');await p.waitForTimeout(300);
ok(await p.evaluate(()=>!document.querySelector('[data-bs]')),'no salary field for short term');
const opts=await p.$$eval('select[data-bn] option',o=>o.map(x=>x.value));ok(!opts.includes('abroad')&&opts.length===2,'no abroad for short term: '+opts);
await p.click('[data-bqd="0"][data-dst="1"]');await p.click('[data-bqd="0"][data-dst="1"]');
await p.fill('[data-bq="0"]','3');await p.click('#dk-ok');await p.waitForTimeout(400);
ok(await p.evaluate(()=>bpT().CV.items[0].qty)===3,'qty 3 kept');
const t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);ok(/3 × /.test(t),'qty shown in thread');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
