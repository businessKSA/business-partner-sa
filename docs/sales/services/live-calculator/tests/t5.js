const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.evaluate(()=>bpGo('nit'));await p.waitForTimeout(200);
const lab=await p.evaluate(()=>[...document.querySelectorAll('#alist option')].find(o=>o.value.startsWith('55101')||o.value.startsWith('2'))?.value);
console.log('opt',lab, await p.evaluate(()=>document.querySelectorAll('#alist option').length));
await p.fill('#n-act',lab);await p.dispatchEvent('#n-act','change');await p.waitForTimeout(200);
console.log('grp',await p.inputValue('#n-grp'),(await p.evaluate(()=>document.querySelector('#main').innerText)).includes('مقترحة'));
console.log('ERR',errs);await b.close();})();
