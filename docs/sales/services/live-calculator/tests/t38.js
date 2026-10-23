const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('rent'));await p.waitForTimeout(300);
const T=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log(T.match(/بطاقة الأسعار[\s\S]*?ساعات الشهر الفعلية/)[0].replace(/\n/g,' | ').slice(0,1800));console.log(errs);await b.close();})();
