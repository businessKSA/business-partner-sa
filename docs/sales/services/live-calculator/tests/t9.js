const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.evaluate(()=>bpGo('guides'));await p.waitForTimeout(300);
let s=await p.evaluate(()=>document.querySelector('#main').innerText);console.log(s.includes('كل المهن (1,950)'),(s.match(/عدد المهن/g)||[]).length);
await p.fill('#g-oq','محاسب');await p.waitForTimeout(300);s=await p.evaluate(()=>document.querySelector('#main').innerText);console.log(s.includes('المهن المحاسبية'));
console.log('ERR',errs);await b.close();})();
