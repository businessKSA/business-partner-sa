const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(200);
const tx=()=>p.evaluate(()=>document.querySelector('#main').innerText);
// choose agri activity (01xxx) -> real-estate profession not applicable
const lab=await p.evaluate(()=>[...document.querySelectorAll('#alist option')].find(o=>o.value.startsWith('11101'))?.value);
await p.fill('#g-act',lab);await p.dispatchEvent('#g-act','change');await p.waitForTimeout(300);
console.log('grp',await p.inputValue('#g-grp'));
await p.fill('#l-prof','وسيط عقاري · الأنشطة والمهن العقارية [5113063]');await p.dispatchEvent('#l-prof','change');await p.waitForTimeout(300);
let s=await tx();console.log('notapp',s.includes('لا قرار توطين يسري على نشاطك'),s.includes('لا سعر'));
await p.evaluate(()=>bpGo('nit'));await p.fill('#g-foreign','40');await p.waitForTimeout(300);s=await tx();console.log(s.includes('نسبة السعودة الحالية'),s.match(/إجمالي العاملين\s*(\d+)/)?.[1]);
await p.evaluate(()=>bpGo('hire'));await p.waitForTimeout(200);s=await tx();console.log('hire',s.includes('خانة «شركتك»'));
await p.evaluate(()=>bpGo('team'));await p.waitForTimeout(200);console.log('team ok');
console.log('ERR',errs);await p.screenshot({path:'shot3.png'});await b.close();})();
