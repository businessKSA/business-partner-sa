const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:1100}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess&ui=classic');
const stars=()=>p.evaluate(()=>[...document.querySelectorAll('.req-star')].filter(e=>e.offsetParent).map(e=>e.parentElement.textContent.replace('*','').trim()));
console.log('step1',await stars());
await p.click('#l-term-s');await p.fill('#l-term-s','12 شهر');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(300);
await p.click('[data-go="1"]');await p.waitForTimeout(200);console.log('step2',await stars());
await p.screenshot({path:'star.png'});console.log(errs);await b.close();})();
