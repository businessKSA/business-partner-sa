const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
let t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);ok(/توظيف بالساعة/.test(t),'quick hire on welcome');
await p.click('.chip:has-text("توظيف بالساعة")');await p.waitForTimeout(300);
await p.fill('#dk-ta','أحتاج محاسبين اثنين لمدة 3 أيام في الرياض');await p.click('#dk-ok');await p.waitForTimeout(1500);
t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);console.log(t.slice(-300).replace(/\n+/g,' | '));
ok(await p.evaluate(()=>!!document.querySelector('#dk-ok')),'basket shown');
await p.click('#dk-ok');await p.waitForTimeout(500);
t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);ok(/3 يوم/.test(t)&&/وأين سيعمل/.test(t),'duration taken from text, goes to city');
// back never stuck
await p.evaluate(()=>{const q=bpT();q.CH.hist=[]});await p.evaluate(()=>bpT().render());
ok(await p.evaluate(()=>!document.getElementById('cs-back').disabled),'back enabled');
await p.click('#cs-back');await p.waitForTimeout(300);
ok(await p.evaluate(()=>!!document.querySelector('[data-side=new]')),'start over button present');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
