const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(500);
const txt=async()=>await p.evaluate(()=>document.querySelector('#main').innerText);
let s=await txt();console.log('LUMP',s.match(/السعر الشهري قبل التوطين\s*([\d,]+)/)?.[1], s.match(/شامل رسم التوطين\s*([\d,]+)/)?.[1], s.match(/الإجمالي.*?\n/g)?.slice(0,2));
for(const tab of ['cost','nit','prof','hire']){await p.click(`[data-tab=${tab}]`);await p.waitForTimeout(150);s=await txt();console.log(tab,s.slice(0,0),s.length);
 if(tab==='nit')console.log(s.match(/[\d.]+%/g)?.slice(0,6));
 if(tab==='cost'){console.log(s.match(/إجمالي الفاتورة الشهرية\s*([\d,]+)/)?.[1], s.match(/الدفعة المقدمة المطلوبة[^\d]*([\d,]+)/)?.[1]);}}
console.log('ERR',errs);await p.screenshot({path:'shot.png',fullPage:false});await b.close();})();
