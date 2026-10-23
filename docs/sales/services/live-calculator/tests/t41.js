const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('cost'));await p.waitForTimeout(300);
const T=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log(T.match(/رسوم شركة بزنس بارتنر \([^\n]*\n[\d,]+/)?.[0],'|',T.match(/إجمالي الفاتورة الشهرية\n[\d,]+/)?.[0],errs);await b.close();})();
