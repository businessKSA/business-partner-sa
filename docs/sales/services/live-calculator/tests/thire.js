const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
let opened=0;await p.addInitScript(()=>{window.__o=0;window.open=()=>{window.__o++;return null}});
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
await p.evaluate(()=>{bpT().hireFromGap(2)});await p.waitForTimeout(400);
let t=await p.evaluate(()=>document.body.innerText);console.log('asks prof:',/مهنة السعوديين/.test(t));if(!/مهنة السعوديين/.test(t))fail++;
await p.evaluate(()=>{const q=bpT();const i=Object.keys(q.PROF).find(k=>/محاسب/.test(q.EP(+k)[0]))||0;window.__i=+i});
await p.fill('.dk input[type=text], .dk input:not([type])','محاسب').catch(()=>{});await p.waitForTimeout(400);
const hit=await p.$('.dk .opt, .dk [data-i], .dk li');if(hit){await hit.click();await p.waitForTimeout(500)}
t=await p.evaluate(()=>document.body.innerText);console.log('basket:',/أضفتُ 2 سعودي/.test(t),'items',await p.evaluate(()=>bpT().CV.items.length));
const o=await p.evaluate(()=>window.__o);console.log('window.open',o);if(o)fail++;
await p.screenshot({path:'hire.png'});console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
