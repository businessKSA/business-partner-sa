const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
const T=()=>p.evaluate(()=>document.querySelector('#main').innerText);
console.log('lump',(await T()).match(/القسط السنوي[^\n]*/)?.[0]);
await p.evaluate(()=>{const s=document.getElementById('i-cls');console.log;});
console.log(await p.evaluate(()=>[...document.querySelectorAll('#i-cls option')].map(o=>o.textContent).join('|')));
await p.evaluate(()=>{const s=document.getElementById('i-gender');s.value='female';s.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(150);for(const v of ['basic','C','B','A','VIP','VVIP']){await p.evaluate(v=>{const s=document.getElementById('i-cls');s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));},v);await p.waitForTimeout(150);console.log(v,(await T()).match(/القسط السنوي: ([\d,]+)/)?.[1]);}
console.log('ERR',errs);await b.close();})();
