const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:400},deviceScaleFactor:3});
await p.goto('file://'+process.cwd()+'/index-client.html?goal=assess');await p.waitForTimeout(500);
const el=await p.$('.seg');await el.screenshot({path:'flags2.png'});await b.close();})();
