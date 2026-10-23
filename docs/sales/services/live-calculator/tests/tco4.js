const {chromium}=require('playwright');
const addEst=async(p,name)=>{await p.fill('#co-name',name);await p.fill('#co-no','1-4636772');await p.fill('#co-uno','7001234567');await p.fill('#co-tax','300123456700003');await p.fill('#co-gosi','123456');await p.fill('#co-addr','RRRD2929');await p.fill('#co-act','7110');await p.waitForTimeout(200);await p.click('.dd .it');await p.waitForTimeout(300);await p.fill('#co-foreign','1');await p.click('#co-add');await p.waitForTimeout(300);};
(async()=>{const b=await chromium.launch();const errs=[];
for(const f of ['index','index-client','index-demo','index-fawaz']){const p=await b.newPage({viewport:{width:1200,height:2500}});p.on('pageerror',e=>errs.push(f+': '+e.message));
await p.goto('file://'+process.cwd()+'/'+f+'.html');await p.waitForTimeout(400);
const first=await p.evaluate(()=>document.querySelector('[data-tab][aria-selected=true]').textContent);
let rows=await p.evaluate(()=>document.querySelectorAll('#main tbody tr').length);
if(f==='index-demo'){await p.click('#co-demo');await p.waitForTimeout(300);}
if(f==='index'||f==='index-client'){await addEst(p,'شركة تجريبية');}
rows=await p.evaluate(()=>document.querySelectorAll('#main tbody tr').length);
const txt=await p.evaluate(()=>document.querySelector('#main tbody')?document.querySelector('#main tbody').innerText.replace(/\s+/g,' ').slice(0,260):'none');
console.log(f,'| first tab:',first,'| rows:',rows,'|',txt);
if(rows>0){await p.click('[data-co-open]');await p.waitForTimeout(200);await p.click('[data-tab=team]');await p.waitForTimeout(300);
 const tr=await p.evaluate(()=>document.querySelectorAll('#main table tbody tr').length);console.log('   team rows after open:',tr);
 await p.click('[data-tab=nit]');await p.waitForTimeout(200);console.log('   nit full/foreign:',await p.evaluate(()=>[document.getElementById('g-full')?.value||document.getElementById('n-full')?.value,document.getElementById('g-foreign')?.value||document.getElementById('n-foreign')?.value].join('/')));}
}
console.log(errs);await b.close();})();
