const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(600);
const mine=await p.evaluate(()=>{const q=bpT();const o=[];Object.keys(q.PROF).forEach(i=>{const e=q.EP(+i);if(e[5]===8000)o.push(String(e[7]).slice(-6))});return o});
const off=fs.readFileSync('/tmp/off.txt','utf8').split('\n').filter(Boolean);
console.log('mine8000',mine.length,'official',off.length,'missingInMine',off.filter(x=>!mine.includes(x)),'extraInMine',mine.filter(x=>!off.includes(x)));await b.close()})();
