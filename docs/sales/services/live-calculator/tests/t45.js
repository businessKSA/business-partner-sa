const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1200}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
for(const q of ['المطاعم مع الخدمة','الوجبات السريعة','التعليم الابتدائي للطالبات بمنهج عالمي','التعليم الثانوي للطلاب بمنهج وطني','التعليم الابتدائي للطالبات بمنهج وطني','أنشطة البريد','حلول تقنية','تأسيس مباني','مغاسل']){
 await p.click('#g-act');await p.fill('#g-act',q);await p.waitForTimeout(350);
 const first=await p.evaluate(()=>document.querySelector('.dd .it')?.innerText.replace(/\n/g,' '));
 await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);
 const g=await p.evaluate(()=>{const e=document.getElementById('g-grp');return e?(e.value||'')+'|'+(e.tagName):'none'});
 console.log(q,'→',first?.slice(0,50),'=>',g);}
console.log(errs);await b.close();})();
