const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
const T=()=>p.evaluate(()=>document.querySelector('#main').innerText);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
const pr=async()=>(await T()).match(/السعر الشهري قبل التوطين\s*([\d,]+)/)[1];
for(const v of ['1','2','0']){await sel('l-trn',v);console.log(v,await pr(),(await T()).match(/نقل الكفالة أو التأشيرة[^\n]*\n[\d,]+/)?.[0],await p.evaluate(()=>document.getElementById('l-trn').value));}
console.log(errs);await b.close();})();
