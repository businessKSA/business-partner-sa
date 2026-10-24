const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(300);};
await sel('l-term','24');await p.click('[data-toorder]');await p.waitForTimeout(400);
await p.click('[data-osave="0"]');await p.waitForTimeout(300);await p.click('#o-add');await p.waitForTimeout(300);
console.log('row2 unit/n:',await p.evaluate(()=>document.getElementById('o-unit-1').value+'/'+document.getElementById('o-n-1').value),errs);await b.close();})();
