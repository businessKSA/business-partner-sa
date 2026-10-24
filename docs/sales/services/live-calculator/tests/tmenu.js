const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:1000}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
await p.evaluate(()=>{const q=bpT();q.CH.cv=false;});
await p.fill('#cs-t','عامل');await p.keyboard.press('Enter');await p.waitForTimeout(800);
const chips=()=>p.evaluate(()=>[...document.querySelectorAll('#cs-thread .cm:last-child .chip')].map(x=>x.innerText));
let c=await chips();console.log(c.join(' | '));ok(c.length>=3&&c.some(x=>x.includes('فاحص المهن')),'menu chips under free-typed reply');
await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .cm:last-child .chip')].find(x=>x.innerText.includes('فاحص المهن')).click());await p.waitForTimeout(300);
ok(await p.evaluate(()=>!!document.getElementById('dk-tx')||!!document.querySelector('#cs-dock input')),'profession checker opens from menu');
// fr/zh translations present
await p.click('#cs-top button[data-arg=fr]');await p.waitForTimeout(300);
const bar=await p.evaluate(()=>document.getElementById('cs-back').title);console.log(bar);ok(/Annuler/.test(bar),'fr title translated');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
