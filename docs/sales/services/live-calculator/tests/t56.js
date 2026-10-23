const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(300);};
const has=async()=>!!(await p.$('[data-toorder]'));
for(const term of ['6','12','24','36']){await sel('l-term',term);console.log('lump',term,await has());}
await sel('l-nat','saudi');for(const term of ['6','12']){await sel('l-term',term);console.log('lump saudi',term,await has());}
await p.evaluate(()=>bpGo('cost'));await p.waitForTimeout(300);
for(const term of ['6','12','24']){await sel('c-term',term);console.log('cost',term,await has());}
console.log(errs);await b.close();})();
