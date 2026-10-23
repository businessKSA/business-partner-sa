const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:3000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess&ui=classic');await p.waitForTimeout(300);await p.evaluate(()=>bpGo('cost'));
const pick=async(id,text)=>{await p.click('#'+id+'-s');await p.waitForTimeout(200);await p.fill('#'+id+'-s',text);await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);};
await pick('c-term','سنتان');await p.click('#c-prof');await p.fill('#c-prof','نادل');await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);
await p.click('[data-go="1"]');await pick('c-src','استقدام');await pick('c-cty','فلبين');await p.fill('#c-qty','2');await pick('i-gender','ذكر');
await p.click('[data-go="1"]');await pick('c-freq','نصف');await p.waitForTimeout(200);
console.log('abroad fields step3:',await p.evaluate(()=>[...document.querySelectorAll('#main .grid>.panel:first-child .field label')].filter(l=>l.offsetParent).map(l=>l.textContent.trim().replace('*','')).join(' | ')));
await p.click('[data-go="1"]');await p.fill('#c-sal','5000');await p.waitForTimeout(400);
const t=await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].innerText);
console.log(t.replace(/\n\n/g,' | ').slice(0,900));
for(const L of ['en','fr','zh']){await p.click('#lang-'+L);await p.waitForTimeout(300);console.log(L,(await p.evaluate(()=>document.querySelectorAll('#main section.panel')[1].querySelector('h2').textContent)));}
console.log(errs);await b.close();})();
