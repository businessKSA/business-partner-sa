const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const f of ['index-client','index-demo']){const p=await b.newPage({viewport:{width:1300,height:2600}});p.on('pageerror',e=>errs.push(f+': '+e.message));p.on('dialog',d=>{console.log('DIALOG',d.type());d.dismiss();});
await p.goto('file://'+process.cwd()+'/'+f+'.html');await p.waitForTimeout(600);
if(f==='index-demo'){await p.click('#co-demo');await p.waitForTimeout(300);}
else {await p.fill('#co-name','شركة اختبار');await p.fill('#co-foreign','5');await p.click('#co-add');await p.waitForTimeout(300);}
const before=await p.evaluate(()=>document.querySelectorAll('#main tbody tr').length);
await p.click('#bp-reset');await p.waitForTimeout(200);const lab=await p.evaluate(()=>document.getElementById('bp-reset').textContent);
await p.click('#bp-reset');await p.waitForTimeout(400);
const after=await p.evaluate(()=>[document.querySelectorAll('#main tbody tr').length,document.querySelector('[data-tab][aria-selected=true]').textContent]);
console.log(f,'rows before',before,'| label:',lab.slice(0,30),'| after',after);
await p.click('[data-tab=lump]');await p.waitForTimeout(200);console.log(' lump sal field:',await p.evaluate(()=>document.getElementById('l-sal')?.value));}
console.log(errs);await b.close();})();
