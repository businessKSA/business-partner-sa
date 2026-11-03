const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:1000}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html');await p.waitForTimeout(800);
await p.click('[data-chip=goal][data-arg=assess]');await p.waitForTimeout(300);
for(const t of ['nit','team','viol','ctr']){
 await p.evaluate(x=>{const q=bpT();q.CH.cv=true;q.S.tab=x;q.render();q.chRender();},t);await p.waitForTimeout(300);
 const v=await p.evaluate(()=>{const vis=id=>{const e=document.querySelector(id);return !!e&&getComputedStyle(e).display!=='none'&&e.offsetHeight>0};return {tabs:vis('#app #tabs'),reset:vis('#bp-reset'),close:vis('#cv-x'),main:vis('#main')}});
 console.log(t,JSON.stringify(v)); if(v.tabs||v.reset||!v.close||!v.main) fail++;
 if(t==='nit') await p.screenshot({path:'det-nit.png'});
}
console.log('errors',er);await b.close();process.exit(fail||er.length?1:0)})();
