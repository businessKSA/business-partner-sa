const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:2400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess&ui=classic');await p.evaluate(()=>bpGo('lump'));await p.waitForTimeout(300);
const pick=async(id,text)=>{await p.click('#'+id+'-s');await p.waitForTimeout(200);await p.fill('#'+id+'-s',text);await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);};
await pick('l-term','12 شهر');await p.click('#l-prof');await p.fill('#l-prof','نادل');await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);
await p.click('[data-go="1"]');await pick('l-src','داخل');await p.fill('#l-qty','1');await pick('i-gender','ذكر');await p.click('[data-go="1"]');await pick('l-trn','الأولى');await p.click('[data-go="1"]');await p.fill('#l-sal','6000');await p.waitForTimeout(400);
const t=await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText);
console.log(t.replace(/\n\n/g,'\n').split('\n').filter(l=>/^(السعر|رسوم|ضريبة|الإجمالي|شهرين|إجمالي|ما يشمله|نفس|عقد)/.test(l)||/^[\d,]+$/.test(l)).join(' | '));
console.log(errs);await p.screenshot({path:'price.png',fullPage:true});await b.close();})();
