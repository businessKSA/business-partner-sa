const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const f of ['index-demo','index-fawaz']){const p=await b.newPage({viewport:{width:1300,height:2600}});p.on('pageerror',e=>errs.push(f+': '+e.message));
await p.goto('file://'+process.cwd()+'/'+f+'.html?goal=assess');await p.waitForTimeout(600);
if(f==='index-demo'){await p.click('#co-demo');await p.waitForTimeout(300);}
console.log('==',f);console.log(await p.evaluate(()=>{const s=document.querySelectorAll('#main section.panel');return s[0].innerText.replace(/\n+/g,' | ').slice(0,420)+'\n'+[...s[1].querySelectorAll('tbody tr')].slice(0,4).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,220)).join('\n')}));
await p.screenshot({path:f+'-first.png'});}
console.log(errs);await b.close();})();
