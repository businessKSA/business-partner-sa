const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:420,height:800}});p.on('pageerror',e=>er.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
const vis=await p.evaluate(()=>{const e=document.querySelector('#cs-top button[data-arg=fr]');return !!e&&e.offsetHeight>0});console.log('top bar visible on phone',vis);if(!vis)fail++;
await p.click('#cs-top button[data-arg=fr]');await p.waitForTimeout(300);
const t=await p.evaluate(()=>({lang:document.getElementById('app').lang,top:document.getElementById('cs-top').innerText.slice(0,30)}));console.log(JSON.stringify(t));if(t.lang!=='fr')fail++;
await p.screenshot({path:'langbar.png'});console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
