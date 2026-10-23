const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
await p.click('#l-prof');await p.waitForTimeout(150);console.log('focus with value:',await p.evaluate(()=>document.querySelector('.dd .hd')?.innerText));
await p.keyboard.type('مهندس');await p.waitForTimeout(150);console.log('typed:',await p.evaluate(()=>document.querySelector('.dd .hd')?.innerText));
await p.keyboard.press('Escape');await p.click('#l-prof');await p.waitForTimeout(100);console.log('reopen:',await p.evaluate(()=>document.querySelector('.dd .hd')?.innerText));
console.log('ERR',errs);await b.close();})();
