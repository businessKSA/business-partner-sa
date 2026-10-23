const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const er=[];const p=await b.newPage({viewport:{width:1200,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-web.html');await p.waitForTimeout(500);
console.log('chooser',await p.evaluate(()=>!!document.getElementById('goalov')));
await p.click('[data-goal=assess]');await p.waitForTimeout(300);
for(const t of ['co','nit','team','comp','viol','ctr','gov','eos','prof','hire','guides','lump','rent','cost','ot']){await p.evaluate(x=>bpGo(x),t);await p.waitForTimeout(200);}
await p.evaluate(()=>bpGo('lump'));await p.waitForTimeout(200);
console.log((await p.evaluate(()=>document.getElementById('main').innerText)).replace(/\n+/g,' | ').slice(0,500));
console.log(await p.evaluate(()=>document.querySelector('#main a.btn.primary')?.href));
const html=await p.content();console.log('secrets',['lumpCalc(','S.fee','overhead:500','pS:100','Business Partner monthly fee'].map(k=>k+':'+html.split(k).length));
console.log(er);await b.close()})();
