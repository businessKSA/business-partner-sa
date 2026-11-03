const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
const T=()=>p.evaluate(()=>document.querySelector('#main').innerText);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
const pr=async()=>(await T()).match(/السعر الشهري قبل التوطين\s*([\d,]+)/)[1];
for(const k of ['12','6','3']){await sel('l-term',k);console.log(k,await pr());}
console.log((await T()).match(/نفس الراتب بحسب المدة[\s\S]*/)[0].slice(0,300));
console.log('premium word visible:',/علاوة/.test(await T()));
await p.evaluate(()=>bpGo('rent'));await p.waitForTimeout(250);console.log((await T()).match(/ساعة\t[\d.]+\t[\d,]+/)?.[0]);
console.log(errs);await b.close();})();
