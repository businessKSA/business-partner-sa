const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
console.log('chips',await p.evaluate(()=>document.querySelectorAll('.chips button').length));
await p.click('.chips button[data-v="Mexico"]');await p.waitForTimeout(300);
console.log('nat',await p.inputValue('#l-nat'),(await p.evaluate(()=>document.querySelector('#main').innerText)).match(/الوصول المتوقع: [^\n]*/)?.[0]);
await p.locator('#l-nat-s').scrollIntoViewIfNeeded();await p.screenshot({path:'shot6.png'});
console.log('ERR',errs);await b.close();})();
