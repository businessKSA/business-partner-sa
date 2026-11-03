const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
for(const [f,exp] of [['labour-other.xlsx','mismatch'],['labour-same.xlsx','match']]){
 const p=await b.newPage({viewport:{width:1000,height:1200}});p.on('pageerror',e=>er.push(e.message));
 await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
 const r=await p.evaluate(async()=>{const q=bpT();return true});
 await p.evaluate(()=>{const q=bpT();q.S.co.list=[{name:'مطعم النخيل',no:'1-123456',uno:'',tax:'',gosi:'',addr:'',act:'',grp:'الصناعات',year:2026,full:0,part:0,foreign:0,rows:[]}];q.S.co.cur=0;});
 await p.setInputFiles('#cs-f','tdata/'+f);await p.waitForTimeout(3500);
 const th=await p.evaluate(()=>document.getElementById('cs-thread').innerText);
 console.log(f,'=>',th.slice(-300).replace(/\n+/g,' | '));
 if(exp==='mismatch') ok(/لا يطابق|⛔|لم أطبّقه/.test(th),'mismatch warned'); else ok(!/لا يطابق/.test(th),'match not flagged');
}
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
