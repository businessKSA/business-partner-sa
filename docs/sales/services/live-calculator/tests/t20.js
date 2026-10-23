const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
const g=async re=>(await p.evaluate(()=>document.querySelector('#main').innerText)).match(re)?.[1];
const setSel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
await p.click('.chips button[data-v="saudi"]');await p.waitForTimeout(300);
for(const per of ['2024-07','2025-07','2026-07','2027-07','2028-07']){await setSel('s-period',per);console.log(per,await g(/التأمينات الاجتماعية — حصة صاحب العمل[^\n]*\s*([\d,]+)/),await g(/حصة صاحب العمل ([\d.]+)%/),await g(/السعر الشهري قبل الضريبة\s*([\d,]+)/));}
await setSel('s-regime','old');console.log('old',await g(/حصة صاحب العمل ([\d.]+)%/));
console.log('ERR',errs);await b.close();})();
