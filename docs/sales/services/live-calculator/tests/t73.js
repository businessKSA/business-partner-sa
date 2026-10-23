const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1000,height:1400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.evaluate(()=>bpGo('lump'));await p.waitForTimeout(300);
const show=async(lang)=>{if(lang!=='ar'){await p.click('#lang-'+lang);await p.waitForTimeout(300);}
 await p.evaluate(()=>{const s=document.getElementById('l-src');s.value='abroad';s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(400);
 const o=await p.evaluate(()=>[...document.querySelectorAll('#l-cty option')].map(x=>x.textContent).filter(Boolean));console.log(lang,o.length,o.slice(0,6).join(' | '),'...',o.slice(-3).join(' | '));};
await show('ar');await show('en');await show('fr');await show('zh');console.log(errs);await b.close();})();
