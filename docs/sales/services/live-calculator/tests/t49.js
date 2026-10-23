const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(300);};
// change insurance/hours in lump tab, then go to rent: rent must ignore them and lump must keep them
await sel('i-cls','VIP');await p.evaluate(()=>bpGo('rent'));await p.waitForTimeout(300);
let t=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log('rent insurance field:',!!(await p.$('#i-cls')),'hours field:',!!(await p.$('#x-hours')),'| medical row',t.match(/التأمين الطبي \(حسب الفئة\)\t[^\n]*/)?.[0]);
await p.evaluate(()=>bpGo('lump'));await p.waitForTimeout(300);console.log('lump still VIP:',await p.evaluate(()=>document.getElementById('i-cls').value));
console.log(errs);await b.close();})();
