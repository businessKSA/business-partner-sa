const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.evaluate(()=>bpGo('nit'));
await p.click('#g-act');await p.fill('#g-act','561010');await p.waitForTimeout(150);await p.keyboard.press('Enter');await p.waitForTimeout(300);
await p.evaluate(()=>bpGo('prof'));await p.waitForTimeout(300);
console.log('input present:',await p.evaluate(()=>{const i=document.querySelector('#p-prof');return i?{vis:!!i.offsetParent,w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height,val:i.value}:null}));
await p.click('#p-prof');await p.waitForTimeout(300);
console.log('dropdown:',await p.evaluate(()=>{const d=document.querySelector('.dd');return d?d.querySelector('.hd').textContent+' | '+[...d.querySelectorAll('.it')].slice(0,8).map(x=>x.textContent.trim().slice(0,30)).join(' ; '):'none'}));
await p.screenshot({path:'pa.png'});console.log(errs);await b.close();})();
