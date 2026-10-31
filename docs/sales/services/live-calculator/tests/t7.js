const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.evaluate(()=>bpGo('hire'));await p.waitForTimeout(200);
const lab=await p.evaluate(()=>[...document.querySelectorAll('#alist option')].find(o=>o.value.startsWith('47'))?.value);
await p.fill('#h-act',lab);await p.dispatchEvent('#h-act','change');await p.waitForTimeout(300);
const s=await p.evaluate(()=>document.querySelector('#main').innerText);console.log(s.match(/المهن الموطّنة\s*(\d+)/)?.[1]);
await p.fill('#h-q','مهندس');await p.waitForTimeout(300);console.log('ok');
console.log('ERR',errs);await b.close();})();
