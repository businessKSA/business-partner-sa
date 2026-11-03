const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
await p.evaluate(()=>{const q=bpT();q.CH.cv=true;q.S.goal='assess';q.S.tab='team';q.render()});await p.waitForTimeout(400);
const t=await p.evaluate(()=>document.getElementById('main').innerText);
console.log(/التقرير غير دقيق/.test(t),/تعديل في «النطاقات/.test(t),/الخدمة 1 من/.test(t));
if(/التقرير غير دقيق|تعديل في «النطاقات|الخدمة 1 من/.test(t))fail++;console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
