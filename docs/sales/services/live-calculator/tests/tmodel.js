const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:1800}});p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(500);
const th=()=>p.evaluate(()=>document.getElementById('cs-thread').innerText);
await p.evaluate(()=>{const q=bpT();const ix=c=>q.PROF.findIndex(x=>x[7]===c);q.CV.term=12;q.CV.city='جدة';q.CV.items=[{prof:ix('332201'),qty:1,nat:'inside',sal:6000},{prof:ix('214910'),qty:1,nat:'saudi',sal:7000}];q.hireVerdict();q.CV.href='https://x/ar/eor?items=1#request';q.chPrice();});await p.waitForTimeout(200);
let t=await th();console.log(t.slice(t.indexOf('اختر شكل العقد'),t.indexOf('اختر شكل العقد')+900).replace(/\n+/g,' | '));
ok(/اختر شكل العقد/.test(t)&&/التكلفة الكاملة/.test(t)&&/التكلفة بشفافية/.test(t),'both options shown');
await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText.includes('أختار التكلفة بشفافية')).click());await p.waitForTimeout(300);
t=await th();ok(/الدفعة الأولى|المرحلة الثانية|الفاتورة الشهرية شاملة الضريبة/.test(t)&&/نهاية العقد/.test(t),'transparent card shown');
ok(await p.evaluate(()=>bpT().CV.href.includes('model=transparent')),'href carries model');
await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText.includes('بل التكلفة الكاملة')).click());await p.waitForTimeout(300);
t=await th();ok(/الفاتورة الشهرية شاملة الضريبة/.test(t)&&/model=full/.test(await p.evaluate(()=>bpT().CV.href)),'full card + model=full');
// no singular fee word anywhere in UI
const html=await p.evaluate(()=>document.body.innerText);ok(!/(^|[^\u0621-\u064A])(ال)?رسم([^\u0621-\u064A]|$)/.test(html),'no singular fee word in the visible chat');
// non-annual term: only full
await p.evaluate(()=>{const q=bpT();q.CV.term=6;q.chPrice();});await p.waitForTimeout(200);t=await th();ok(/للعقود السنوية فقط/.test(t),'non-annual: transparent unavailable note');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
