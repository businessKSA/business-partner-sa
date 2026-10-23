const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.addInitScript(()=>{window.__o=0;window.open=()=>{window.__o++;return null}});
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
const setup=async()=>{await p.evaluate(()=>{const q=bpT();q.CV.items=[{prof:+Object.keys(q.PROF).find(k=>String(q.EP(+k)[7]).endsWith('241101')),qty:2,nat:'inside',sal:0,cands:[]}];q.CV.term={u:'day',n:3};q.chPrice()});await p.waitForTimeout(800);};
await setup();
await p.click('.chip:has-text("اعتمد وأرسل")');await p.waitForTimeout(300);
let t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);
ok(/الناقص/.test(t),'gate lists missing company data');
ok(!(await p.$('.chip:has-text("أوافق")')),'no accept before data complete');
await p.click('.chip:has-text("معاينة عرض السعر")');await p.waitForTimeout(300);
await p.fill('[data-fk=name]','أحمد');await p.fill('[data-fk=phone]','0500000000');await p.fill('[data-fk=email]','a@b.co');await p.fill('[data-fk=company]','شركة تجربة');await p.click('#dk-ok');await p.waitForTimeout(600);
t=await p.evaluate(()=>document.getElementById('cs-thread').innerText);
ok(/عرض سعر BP-\d{6}/.test(t)||/BP-\d{6}-/.test(t),'quotation preview in chat');ok(/نزّل عرض السعر/.test(t)&&/اطبع/.test(t),'download + print');ok(/رحلتك بعد العرض/.test(t),'journey card');ok(await p.evaluate(()=>window.__o)===0,'no window.open');
// complete company -> accept path
await p.evaluate(()=>{const q=bpT();q.S.co.list.push({name:'شركة تجربة',no:'1-4636772',uno:'7001234567',tax:'300123456700003',gosi:'123456789',addr:'RRRD2929',act:q.S.co.list[0]&&1||1,grp:Object.keys(q.NIT||{})[0]||'x',full:1,part:0,foreign:2,docs:{files:[{name:'cr.pdf',kind:'pdf',status:'ok',msg:''}],sheets:[],texts:[],findings:[]}});q.S.co.cur=q.S.co.list.length-1;});
const miss=await p.evaluate(()=>{const q=bpT();return 0});
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
