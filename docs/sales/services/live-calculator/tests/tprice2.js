const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
for(const [file,web] of [['index-client.html',false],['index-web.html',true]]){
const p=await b.newPage({viewport:{width:900,height:1400}});p.on('pageerror',e=>er.push(file+': '+e.message));
await p.goto('file://'+process.cwd()+'/'+file+'?lang=ar');await p.waitForTimeout(700);
await p.click('[data-chip=goal][data-arg=hire]');await p.waitForTimeout(300);
const terms=await p.evaluate(()=>{const q=bpT();q.CV.items=[];const P=q.PROF;const i=P.findIndex(x=>x[7]);q.CV.items.push({prof:i,qty:2,nat:'inside',sal:4500,cands:[i]},{prof:i,qty:1,nat:'saudi',sal:7000,cands:[i]});q.hireTerm();return [...document.querySelectorAll('#cs-thread .chip')].map(x=>x.innerText).slice(-10)});
console.log(file,'terms',terms.join(' | '));ok(!['بالساعة','باليوم','بالأسبوع'].some(x=>terms.some(t=>t.trim()===x))&&terms.some(t=>t.includes('9')),'term chips '+file);
for(const t of [12,{u:'day',n:3},6]){
 const r=await p.evaluate(t=>{const q=bpT();q.CV.term=t;q.CV.city='الرياض';q.hireVerdict();const hasBtn=[...document.querySelectorAll('#cs-thread .chip')].some(x=>x.innerText.includes('ابدأ التسعير'));const eorCard=!!document.querySelector('#cs-thread .card.eor');if(!window.__web) q.chPrice();const th=document.getElementById('cs-thread').innerText;return {hasBtn,eorCard,tbl:document.querySelectorAll('#cs-thread .ctb').length,vat:th.includes('15%')||th.includes('اختر شكل العقد')}},t);
 console.log(file,JSON.stringify(t),JSON.stringify(r));
 if(web){ok(!r.hasBtn&&r.eorCard,'web: no pricing, quote card');} else {ok(r.hasBtn&&!r.eorCard&&r.tbl>=1&&r.vat,'client: pricing in chat '+JSON.stringify(t));}
}
}
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
