const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1000,height:1400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
await p.click('#l-src-s');await p.waitForTimeout(150);await p.keyboard.press('Escape');
await p.evaluate(()=>{const s=document.getElementById('l-src');s.value='abroad';s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(400);
await p.click('#l-cty-s');await p.waitForTimeout(300);
const r=await p.evaluate(()=>{const d=document.querySelector('.dd');const i=document.getElementById('l-cty-s').getBoundingClientRect();const q=d.getBoundingClientRect();return {dir:d.dir,ddRight:Math.round(q.right),inputRight:Math.round(i.right),first:d.innerText.split('\n').slice(0,5).join(' | '),hasGhairha:/غيرها/.test(d.innerText)};});console.log(JSON.stringify(r));console.log(errs);await b.close();})();
