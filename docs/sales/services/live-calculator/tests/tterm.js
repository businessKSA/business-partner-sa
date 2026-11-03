const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
await p.evaluate(()=>{const q=bpT();q.CV.items=[{prof:+Object.keys(q.PROF)[5],qty:1,nat:'inside',sal:0,cands:[+Object.keys(q.PROF)[5]]}];q.hireTerm()});await p.waitForTimeout(400);
const chips=await p.$$eval('#cs-thread .chip',c=>c.map(x=>x.innerText));console.log(chips.join(' | '));
if(chips.some(c=>/بالساعة$|^باليوم|بالأسبوع|^بالشهر|^3 أشهر/.test(c.trim())&&!/توظيف/.test(c)))fail++;
if(!chips.some(c=>/6 أشهر/.test(c)))fail++;console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
