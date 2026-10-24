const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
await p.evaluate(()=>{const q=bpT();q.S.co.list.push({name:'x',draft:true,full:0,part:0,foreign:0,rows:[]});q.S.co.cur=q.S.co.list.length-1;q.idsDock()});await p.waitForTimeout(400);
await p.fill('#cs-t','رقم مكتب العمل 1-4636772 والرقم الموحد 7001234567 والرقم الضريبي 300123456700003 والعنوان RRRD2929');await p.press('#cs-t','Enter');await p.waitForTimeout(600);
ok((await p.inputValue('[data-fk=no]'))==='1-4636772','labour no filled from chat');ok((await p.inputValue('[data-fk=uno]'))==='7001234567','unified filled');ok((await p.inputValue('[data-fk=tax]'))==='300123456700003','tax filled');ok((await p.inputValue('[data-fk=addr]'))==='RRRD2929','address filled');
// text dock: typed answer is taken
await p.evaluate(()=>{const q=bpT();q.S.goal='hire';q.hireQuick()});await p.waitForTimeout(300);
await p.click('.chip:has-text("باليوم")');await p.waitForTimeout(200);
await p.fill('#cs-t','5');await p.press('#cs-t','Enter');await p.waitForTimeout(400);
ok(await p.evaluate(()=>{const t=bpT().CV.term;return t&&t.u==='day'}),'typed number accepted for numbers/text dock: '+await p.evaluate(()=>JSON.stringify(bpT().CV.term)));
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
