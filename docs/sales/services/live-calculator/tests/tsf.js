const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const er=[];const p=await b.newPage({viewport:{width:1200,height:1000}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess&ui=classic');await p.waitForTimeout(700);
console.log('upload box',await p.evaluate(()=>!!document.getElementById('sf-f')));console.log(er);await b.close()})();
