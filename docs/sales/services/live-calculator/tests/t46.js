const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1200}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
await p.click('#g-act');await p.fill('#g-act','561010');await p.waitForTimeout(350);
await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(500);
const T=await p.evaluate(()=>document.querySelector('#main').innerText);console.log(T.match(/تُعرض مهن مجال نشاطك[^\n]*/)?.[0]);
for(const q of ['مبرمج','طاه','عامل مطبخ','مضيّف']){await p.click('#l-prof');await p.fill('#l-prof',q);await p.waitForTimeout(350);console.log(q,'=>',(await p.evaluate(()=>document.querySelector('.dd')?.innerText.split('\n').slice(0,4).join(' | '))));await p.keyboard.press('Escape');}
console.log(errs);await b.close();})();
