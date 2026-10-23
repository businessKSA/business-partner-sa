const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1200}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-demo.html');await p.waitForTimeout(400);await p.click('[data-tab=ctr]');
await p.setInputFiles('#ct-files','tdata/contracts.xlsx');await p.waitForTimeout(2500);
console.log((await p.evaluate(()=>document.getElementById('main').innerText)).replace(/\n+/g,' | ').slice(0,2600));
await p.screenshot({path:'ctr3.png',fullPage:true});console.log(er);await b.close()})();
