const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
await p.click('.chip:has-text("تقييم المخالفات مباشرة")');await p.waitForTimeout(500);
const t=await p.evaluate(()=>document.getElementById('main').innerText);console.log(t.slice(0,300).replace(/\n+/g,' | '));
if(!/مخالف/.test(t))fail++;console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
