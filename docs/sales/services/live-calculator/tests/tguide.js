const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:1600}});p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(500);
ok(await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].some(x=>x.innerText.includes('الأدلة الإجرائية'))||!!document.querySelector('[data-side=gd]')),'guides entry present');
const r=await p.evaluate(()=>{const q=bpT();const g=q.GUIDES.find(x=>x.id===5);const html=q.chCardGuide(g).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');const f=q.guideFile(g);q.chGuide(5);return {html:html.slice(0,500),fileOk:f.startsWith('<!doctype html>')&&f.includes('93483'),chips:[...document.querySelectorAll('#cs-thread .chip')].map(x=>x.innerText)}});
console.log(r.html);ok(/93483/.test(r.html)&&/8,000/.test(r.html)&&/30%/.test(r.html),'engineering guide data');ok(r.fileOk,'downloadable file html');ok(r.chips.some(x=>(x.includes('الدليل الرسمي')||x.includes('نزّل')||x.includes('ملخص'))),'download chip');
// profession checker shows guide chip for civil engineer
const c=await p.evaluate(()=>{const q=bpT();const i=q.PROF.findIndex(x=>x[7]==='214201');q.CV.items=[{prof:i,qty:1,nat:'saudi',sal:9000}];q.CV.term=12;q.CV.city='x';q.hireVerdict();return [...document.querySelectorAll('#cs-thread .chip')].map(x=>x.innerText)});
ok(c.some(x=>x.includes('الدليل الإجرائي')),'verdict has guide chip: '+c.join(' | '));
const html=await p.evaluate(()=>document.body.innerText);ok(!/(^|[^ء-ي])(ال)?رسم([^ء-ي]|$)/.test(html),'no singular fee word');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
