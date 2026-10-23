const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
const g=async re=>(await p.evaluate(()=>document.querySelector('#main').innerText)).match(re)?.[1];
const txt=await p.evaluate(()=>document.querySelector('#main').innerText);
console.log(txt.match(/تفصيل الراتب[\s\S]{0,420}/)?.[0].replace(/\n+/g,' | '));
console.log('lump',await g(/السعر الشهري قبل التوطين\s*([\d,]+)/));
await p.fill('#sb-transport','20');await p.waitForTimeout(250);console.log('over',(await p.evaluate(()=>document.querySelector('#main').innerText)).includes('يتجاوز 100%'));
await p.fill('#sb-transport','10');await p.waitForTimeout(250);
for(const tab of ['cost','hire']){await p.click('[data-tab='+tab+']');await p.waitForTimeout(250);console.log(tab,await p.evaluate(()=>!!document.getElementById('sb-basic')));}
await p.evaluate(()=>bpGo('lump'));await p.click('.chips button[data-v="saudi"]');await p.waitForTimeout(300);console.log('saudi sb',await p.evaluate(()=>!!document.getElementById('sb-basic')),await g(/الأساس: الراتب الأساسي \+ السكن = ([\d,]+)/));
console.log('ERR',errs);await b.close();})();
