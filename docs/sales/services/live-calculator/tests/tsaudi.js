const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(400);
const r=await p.evaluate(()=>{
 const {PROF,EP,profCalc}=bpT();const find=(fn)=>{for(let i=1;i<PROF.length;i++){const e=EP(i);if(fn(e))return i}};
 const tied=find(e=>e[1]!=='Saudi-only'&&e[1]!=='On request'&&e[3]>0&&e[3]<100);
 const flat=find(e=>e[1]==='Standard'&&(e[2]||0)>0);
 const t0=profCalc({prof:tied,saudi:0,spart:0,foreign:4,term:12}), t1=profCalc({prof:tied,saudi:0,sus:t0.need,spart:0,foreign:4,term:12}), t2=profCalc({prof:tied,saudi:0,sus:1,spart:0,foreign:4,term:12});
 const f0=profCalc({prof:flat,saudi:0,spart:0,foreign:3,term:12}), f1=profCalc({prof:flat,saudi:0,sus:1,spart:0,foreign:3,term:12}), f3=profCalc({prof:flat,saudi:0,sus:3,spart:0,foreign:3,term:12});
 return {need:t0.need,t0:t0.feeM,t1:t1.feeM,t2:t2.feeM,one:t0.one,f0:f0.feeM,f1:f1.feeM,f3:f3.feeM,flatFee:f0.fee};
});
console.log(r);
ok(r.t0>0,'tied: fee without Saudis');ok(r.t1===0,'tied: Saudis hired cover all → 0');ok(r.t2>0&&r.t2<r.t0,'tied: partial → less');
ok(r.f0>0&&r.f1===r.f0-r.flatFee&&r.f3===0,'flat: waived 1:1');
console.log('errors',errs);if(errs.length)fail++;await b.close();process.exit(fail?1:0)})();
