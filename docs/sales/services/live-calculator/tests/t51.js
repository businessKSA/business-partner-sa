const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('rent'));await p.waitForTimeout(300);
const t=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log('prof field in rent:',!!(await p.$('#l-prof')),'| labor picker:',!!(await p.$('#lb-fam')),'|',t.match(/السعر\t[^\n]*/)?.[0],errs);await b.close();})();
