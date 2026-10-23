const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
await p.check('#own');await p.waitForTimeout(250);console.log(await p.evaluate(()=>[...document.querySelectorAll('#o-short,#o-shortW,#o-month,#o-monthW')].map(e=>e.id+'='+e.value).join(' ')),errs);await b.close();})();
