const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:1800}});p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(500);
for(const n of [12,24,36]){
 await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(400);
 const r=await p.evaluate(n=>{const q=bpT();const ix=c=>q.PROF.findIndex(x=>x[7]===c);q.CV.term=n;q.CV.city='الرياض';q.CV.items=[{prof:ix('332201'),qty:1,nat:'inside',sal:6000},{prof:ix('214910'),qty:1,nat:'saudi',sal:7000},{prof:ix('241101'),qty:2,nat:'abroad',sal:5000}];
  q.chPrice();const t=document.getElementById('cs-thread').innerText;const row=t.match(/الإجمالي التقريبي\s+([\d,]+)\s+([\d,]+)/);
  // choose full then read monthly incl VAT & total
  [...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText.includes('أختار التكلفة الكاملة')).click();const t2=document.getElementById('cs-thread').innerText;const mi=t2.match(/الفاتورة الشهرية شاملة الضريبة\s+([\d,]+)/);
  return {cmp:row&&[row[1],row[2]],monthly:mi&&mi[1],n}},n);
 const a=+r.cmp[0].replace(/,/g,''),b2=+r.cmp[1].replace(/,/g,''),m=+r.monthly.replace(/,/g,'');
 console.log(n,JSON.stringify(r));ok(Math.abs(a-b2)/a<0.002,'totals equal for '+n+' months');ok(Math.abs(m*n-a)/a<0.003,'monthly × n = total for '+n);
}
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
