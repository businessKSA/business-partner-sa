const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:2600}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess');await p.waitForTimeout(300);
const pick=async(id,text)=>{await p.click('#'+id+'-s');await p.waitForTimeout(200);await p.fill('#'+id+'-s',text);await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);};
await pick('l-term','12 شهر');await p.click('#l-prof');await p.fill('#l-prof','مساح كميات');await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);
await p.click('[data-st="2"]');await pick('l-src','داخل');await p.fill('#l-qty','3');await pick('i-gender','ذكر');await p.click('[data-st="3"]');await pick('l-trn','الأولى');await p.click('[data-st="4"]');await p.fill('#l-sal','6000');await p.waitForTimeout(400);
const t=await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText);
const i=t.indexOf('كيف حُسبت');console.log(t.slice(i).replace(/\n\n/g,' | ').slice(0,700));
console.log('fee line:',t.match(/رسوم التوطين شهرياً\s*\n?\s*([\d,]+)/)?.[1]);
for(const q of ['1','5']){await p.click('[data-st="2"]');await p.fill('#l-qty',q);await p.waitForTimeout(300);const tt=await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText);console.log('qty',q,'fee',tt.match(/رسوم التوطين شهرياً\s*\n?\s*([\d,]+)/)?.[1],'saudis',tt.match(/السعوديون المطلوبون\s*\n?\s*(\d+)/)?.[1]);}
console.log(errs);await b.close();})();
