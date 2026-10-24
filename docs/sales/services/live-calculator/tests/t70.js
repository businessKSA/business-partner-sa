const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('cost'));await p.waitForTimeout(300);
const t=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log('old Saudi block gone:',!/توظيف سعودي/.test(t)&&!(await p.$('#c-saudi'))&&!(await p.$('#c-sgosi')),'| total:',t.match(/إجمالي الفاتورة الشهرية\n[\d,]+/)?.[0].replace(/\n/g,' '),errs);await b.close();})();
