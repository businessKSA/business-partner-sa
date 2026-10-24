const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:900,height:1200}});p.on('pageerror',e=>er.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
await p.goto('file://'+process.cwd()+'/index-client.html');await p.waitForTimeout(600);
const nm=()=>p.evaluate(()=>document.querySelectorAll('#cs-thread .cm').length);
const dis=()=>p.evaluate(()=>document.getElementById('cs-back').disabled);
ok(await dis(),'back disabled at start');
const n0=await nm();
await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText==='العربية').click());await p.waitForTimeout(250);
ok(!(await dis()),'back enabled after language');
await p.click('[data-chip=goal][data-arg=assess]');await p.waitForTimeout(250);
const n1=await nm();
await p.click('#cs-back');await p.waitForTimeout(250);
const n2=await nm();ok(n2<n1,'back removed last answer: '+n1+'->'+n2);
ok(await p.evaluate(()=>!!document.querySelector('[data-chip=goal][data-arg=hire]')),'goal chips back');
// hire flow term step
await p.click('[data-chip=goal][data-arg=hire]');await p.waitForTimeout(250);
await p.evaluate(()=>{const q=bpT();q.CV.items=[{prof:q.PROF.findIndex(x=>x[7]),qty:1,nat:'inside',sal:4500}];q.hireTerm();});await p.waitForTimeout(200);
await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText.includes('سنة')).click());await p.waitForTimeout(250);
ok(await p.evaluate(()=>document.getElementById('cs-thread').innerText.includes('أين سيعمل')),'city question shown');
await p.click('#cs-back');await p.waitForTimeout(250);
ok(await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].some(x=>x.innerText.includes('6 أشهر'))),'term chips back after undo');
// dock restore: assess manual -> name dock
await p.click('#cs-back');await p.click('#cs-back').catch(()=>{});await p.waitForTimeout(250);
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
