const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];const p=await b.newPage({viewport:{width:1200,height:2600}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess&ui=classic');await p.waitForTimeout(500);await p.evaluate(()=>bpGo('eos'));await p.waitForTimeout(300);
const setSel=async(id,v)=>{await p.evaluate(([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
const res=async()=>p.evaluate(()=>{const t=document.querySelectorAll('#main section.panel')[1].innerText;return (t.match(/المستحقة\s*\n?\s*([\d,]+)/)||[])[1]});
await p.fill('#e-sal','10000');await p.fill('#e-end','2026-10-01');
const cases=[['2025-10-01','1',0],['2024-10-02','1',3333.33],['2021-10-02','1',8333.33],['2020-10-03','1',9995.37],['2020-10-02','1',23333.33],['2016-10-03','1',49981.48],['2016-10-02','1',75000],['2021-10-01','3',25027.78],['2012-10-01','3',115027.78]];
for(const [st,rs,exp] of cases){await p.fill('#e-start',st);await setSel('e-reason',rs);console.log(st,rs,'got',await res(),'doc',exp);}
await setSel('e-reason','4');await p.fill('#e-start','2019-10-01');console.log('employer m80 (expect 0):',await res());
console.log(errs);await b.close();})();
