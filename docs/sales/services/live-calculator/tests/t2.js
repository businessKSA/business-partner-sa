const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.evaluate(()=>bpGo('team'));await p.waitForTimeout(200);
await p.fill('#m-q','مندوب');await p.waitForTimeout(200);
await p.click('[data-addp]');await p.waitForTimeout(200);
const s=await p.evaluate(()=>document.querySelector('#main').innerText);console.log(s.slice(0,900));
await p.click('#tabs [data-tab=lump]');await p.type('#l-sal','1');await p.waitForTimeout(100);console.log('SAL',await p.inputValue('#l-sal'));
console.log('ERR',errs);await p.evaluate(()=>bpGo('team'));await p.screenshot({path:'shot2.png'});await b.close();})();
