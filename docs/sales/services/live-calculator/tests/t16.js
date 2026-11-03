const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
await p.click('button[data-for=g-full][data-st="1"]');await p.waitForTimeout(150);await p.click('button[data-for=g-full][data-st="1"]');await p.waitForTimeout(150);
console.log('full',await p.inputValue('#g-full'));
await p.click('button[data-for=g-foreign][data-st="-1"]');await p.waitForTimeout(150);console.log('foreign',await p.inputValue('#g-foreign'));
await p.click('button[data-for=l-sal][data-st="1"]');await p.waitForTimeout(150);console.log('sal',await p.inputValue('#l-sal'));
for(let i=0;i<3;i++){await p.click('button[data-for=g-foreign][data-st="-1"]');await p.waitForTimeout(100);}
console.log('fo',await p.inputValue('#g-foreign'));
await p.evaluate(()=>bpGo('team'));await p.waitForTimeout(200);await p.click('button[data-for=m-f-0][data-st="1"]');await p.waitForTimeout(150);console.log('team',await p.inputValue('#m-f-0'));
console.log('ERR',errs);await b.close();})();
