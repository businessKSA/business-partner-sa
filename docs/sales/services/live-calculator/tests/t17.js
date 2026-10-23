const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:900}});
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
await p.locator('#g-foreign').scrollIntoViewIfNeeded();await p.screenshot({path:'shot5.png',clip:{x:0,y:100,width:1100,height:420}});await b.close();})();
