const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const er=[];
for(const f of ['index-client','index-demo']){const p=await b.newPage({viewport:{width:1200,height:1000}});p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.cwd()+'/'+f+'.html?goal=assess');await p.waitForTimeout(500);
if(f==='index-demo'){await p.click('#demo-co3').catch(()=>{});await p.waitForTimeout(300);}
for(const t of ['co','nit','team','comp','viol','ctr','gov','eos','prof','hire','guides','ot']){await p.evaluate(x=>bpGo(x),t);await p.waitForTimeout(250);
 const tx=await p.evaluate(()=>document.getElementById('main').innerText);
 const hits=tx.split('\n').filter(l=>/بزنس بارتنر|رسوم التوطين|رسوم شركة|سعرنا|Business Partner fee/.test(l));
 if(hits.length) console.log(f,t,hits.slice(0,4).map(h=>h.slice(0,110)));}
}console.log('errs',er);await b.close()})();
