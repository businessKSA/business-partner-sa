const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
const T=()=>p.evaluate(()=>document.querySelector('#main').innerText);
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
const order=await p.evaluate(()=>[...document.querySelectorAll('#main .panel:first-of-type label')].map(l=>l.textContent.trim()));
console.log('lump order:',order.join(' | '));
const price=async()=>(await T()).match(/السعر الشهري قبل التوطين\s*([\d,]+)/)?.[1];
for(const k of ['12','9','6','3','2']){await sel('l-term',k);console.log('term',k,await price());}
console.log('profession bar text:',JSON.stringify(await p.evaluate(()=>document.getElementById('l-prof').value)));
await sel('l-term','12');await p.click('#x-otOn')==null;
await p.click('[data-tab=cost]');await p.waitForTimeout(300);
console.log('cost order:',(await p.evaluate(()=>[...document.querySelectorAll('#main .panel:first-of-type label')].map(l=>l.textContent.trim()))).join(' | '));
console.log('cost total:',(await T()).match(/إجمالي الفاتورة الشهرية\n[\d,]+/)?.[0].replace(/\n/g,' '));
await sel('c-nat','saudi');console.log('saudi order:',(await p.evaluate(()=>[...document.querySelectorAll('#main .panel:first-of-type label')].map(l=>l.textContent.trim()))).slice(0,12).join(' | '));
console.log(errs);await b.close();})();
