const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:900,height:1400}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
ok(await p.evaluate(()=>!!document.querySelector('[data-side=sau]')),'sidebar');
// echo dedupe: click welcome chip, count user bubbles
await p.evaluate(()=>{const q=bpT();q.saudiChat();});await p.waitForTimeout(200);
for(const [nm,fn] of [['pro',P=>P.findIndex(x=>x[3]>0&&x[3]<100&&x[1]!=='Saudi-only')],['non',P=>P.findIndex(x=>x[1]==='Standard')],['only',P=>P.findIndex(x=>x[1]==='Saudi-only')]]){
 const out=await p.evaluate(async([nm,src])=>{const q=bpT();const P=q.PROF;const i=eval('('+src+')')(P);q.CV.items=[];const k=q.saudiKind(i);return {i,k}},[nm,fn.toString()]);
 console.log(nm,JSON.stringify(out));ok(out.k===nm,'kind '+nm);
}
// full flow via dock UI
await p.evaluate(()=>{const q=bpT();q.saudiChat();});await p.waitForTimeout(200);
await p.fill('#dk-q, .dkr input, #cs-dock input[type=search], #cs-dock input','محاسب');await p.waitForTimeout(400);
const first=await p.$('#cs-dock .dkp button, #cs-dock [data-pick], #cs-dock li, #cs-dock .opt');
if(first){await first.click();await p.waitForTimeout(300);await p.fill('[data-nk=q]','2');await p.click('#dk-ok');await p.waitForTimeout(500);
 const t=await p.evaluate(()=>document.getElementById('cs-thread').innerText.replace(/\n+/g,' | '));console.log(t.slice(-600));
 ok(/لا رسم/.test(t)&&/الإجمالي/.test(t)&&/مهني/.test(t),'saudi calc card');}
else console.log('no pick button; skipping UI flow');
// echo: click a fn chip and make sure no duplicate user bubble
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
await p.evaluate(()=>{const q=bpT();q.CV.items=[{prof:q.PROF.findIndex(x=>x[7]),qty:1,nat:'inside',sal:4500}];q.CV.term=12;q.CV.city='الرياض';q.hireVerdict();});await p.waitForTimeout(200);
const before=await p.evaluate(()=>document.querySelectorAll('#cs-thread .cm.user').length);
await p.evaluate(()=>{[...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText.includes('أضف شركتي')).click();});await p.waitForTimeout(300);
const after=await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .cm.user')].map(x=>x.innerText.trim()));
console.log(after.slice(before));ok(after.length-before===1,'single user echo');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
