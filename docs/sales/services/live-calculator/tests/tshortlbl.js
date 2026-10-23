const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
await p.evaluate(()=>{const q=bpT();const i=Object.keys(q.PROF).find(k=>q.EP(+k)[7]&&String(q.EP(+k)[7]).endsWith('513101'))||Object.keys(q.PROF)[3];q.CV.items=[{prof:+i,qty:1,nat:'inside',sal:0,cands:[+i]}];q.CV.term={u:'week',n:2};q.CV.city='جدة';q.hireVerdict();});
await p.waitForTimeout(500);
await p.click('.chip:has-text("ابدأ التسعير")');await p.waitForTimeout(1200);
const t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);
console.log(/نقل/.test(t)?'HAS نقل':'no نقل');console.log(t.slice(-700).replace(/\n+/g,' | '));
if(/نقل خدمات|نقل الكفالة|ما يشمله سعر|الراتب|بشفافية/.test(t))fail++;console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
