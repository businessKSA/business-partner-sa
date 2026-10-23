const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const er=[];const ctx=await b.newContext({viewport:{width:1300,height:1000}});
await ctx.route('https://cdnjs.cloudflare.com/**',r=>{const u=r.request().url();const f=u.includes('xlsx')?'/tmp/xlsx.full.min.js':u.includes('worker')?'/tmp/pdf.worker.min.js':'/tmp/pdf.min.js';r.fulfill({status:200,contentType:'application/javascript',body:fs.existsSync(f)?fs.readFileSync(f,'utf8'):''});});
await ctx.addInitScript(()=>{ const sm=async(input,opts)=>({text:'تمّ'}); sm.limits=async()=>({images:{maxCount:4,mediaTypes:['image/png']}}); sm.json=async(prompt)=>{ if(String(prompt).includes('صنّف')) return {kind:'addr'}; return {document_type_matches:true,establishment_name:'شركة تجربة',short_address:'RRRD2929',building_number:'1234',city:'الرياض'}; }; window.claude={use:async n=>n==='sample'?sm:null}; });
const p=await ctx.newPage();p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/index-client.html');await p.waitForTimeout(900);
await p.setInputFiles('#cs-f',['tdata/shot.png','tdata/contracts.xlsx','tdata/labour-office.xlsx']);await p.waitForTimeout(4000);
console.log((await p.evaluate(()=>document.getElementById('cs-thread').innerText)).replace(/\n+/g,' | ').slice(-700));
console.log(er);await b.close()})();
