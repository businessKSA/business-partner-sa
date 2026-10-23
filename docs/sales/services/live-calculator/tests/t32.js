const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
const T=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log(T.match(/ما يشمله السعر شهرياً[\s\S]*?نفس الراتب/)[0]);console.log('ERR',errs);await b.close();})();
