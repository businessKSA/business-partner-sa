const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
const T=()=>p.evaluate(()=>document.querySelector('#main').innerText);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
await p.evaluate(()=>bpGo('rent'));await p.waitForTimeout(300);
for(const f of ['cons','rest','fact','ware','ret']){await sel('lb-fam',f);console.log(f,await p.evaluate(()=>document.getElementById('lb-code').options.length-1));}
await sel('lb-fam','cons');await sel('lb-code','931301');let t=await T();console.log('status',t.match(/عامل بناء[^\n]*/g)?.slice(0,2), /لا قرار توطين/.test(t));
await p.check('#own');await p.waitForTimeout(250);await p.fill('#lb-sal','1500');await p.waitForTimeout(300);
console.log('sal',await p.evaluate(()=>document.getElementById('l-sal').value));
t=await T();console.log(t.match(/السعر\t[^\n]*/)?.[0]);
await sel('l-nat','saudi');t=await T();console.log('saudi',t.match(/السعر\t[^\n]*/)?.[0],/بطاقة الأسعار/.test(t));
console.log(errs);await b.close();})();
