const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
await p.evaluate(()=>{const q=bpT();q.S.attach=[{name:'cr.pdf',kind:'cr',label:'سجل تجاري',status:'ok',fields:{}}];q.S.co.list.push({name:'x',draft:true,full:0,part:0,foreign:0,rows:[]});q.S.co.cur=q.S.co.list.length-1;q.idsDock()});await p.waitForTimeout(400);
const t=await p.evaluate(()=>document.getElementById('cs-dock').innerText);
ok(/المستندات الرسمية/.test(t),'dock titled official documents');ok(/السجل التجاري[\s\S]*cr\.pdf/.test(t),'checklist shows uploaded CR');ok(/لم يُرفع/.test(t),'checklist shows missing');
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
