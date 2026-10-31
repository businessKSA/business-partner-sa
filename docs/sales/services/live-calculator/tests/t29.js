const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('ot'));await p.waitForTimeout(300);
console.log(await p.evaluate(()=>document.querySelector('#main').innerText));
console.log('ERR',errs);await b.close();})();
