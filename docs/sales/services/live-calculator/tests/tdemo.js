const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:2400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
for(const tab of ['lump','cost']){await p.click(`[data-tab=${tab}]`);
 for(const d of ['10','11','00','01']){await p.click(`[data-demo="${d}"]`);await p.waitForTimeout(300);
  const t=await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText);
  const m=t.match(tab==='lump'?/السعر الشهري شامل الضريبة\s*\n?\s*([\d,]+)/:/إجمالي الفاتورة الشهرية\s*\n?\s*([\d,]+)/);
  console.log(tab,d,'price:',m&&m[1],'| loc fee:',(t.match(/رسوم التوطين( شهرياً)?\s*\n?\s*([\d,]+)/)||[])[2]);}}
console.log('client has demo:',await (async()=>{const q=await b.newPage();await q.goto('file://'+process.cwd()+'/index-client.html');return q.evaluate(()=>!!document.querySelector('.demo'))})());
console.log(errs);await b.close();})();
