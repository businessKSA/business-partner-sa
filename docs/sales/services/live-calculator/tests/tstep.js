const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;
const p=await b.newPage({viewport:{width:480,height:900}});p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
await p.evaluate(()=>{const q=bpT();q.govCost();});await p.waitForTimeout(300);
const v0=await p.inputValue('[data-nk=nw]');await p.click('[data-nk=nw] ~ .sb [data-dst="1"]');await p.click('[data-nk=nw] ~ .sb [data-dst="1"]');await p.click('[data-nk=nw] ~ .sb [data-dst="-1"]');
const v1=await p.inputValue('[data-nk=nw]');const s0=await p.inputValue('[data-nk=permit]');await p.click('[data-nk=permit] ~ .sb [data-dst="1"]');const s1=await p.inputValue('[data-nk=permit]');
console.log(v0,'->',v1,'| permit',s0,'->',s1);if(v1!=='1'||+s1!==+s0+100)fail++;
await p.screenshot({path:'step.png'});console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
