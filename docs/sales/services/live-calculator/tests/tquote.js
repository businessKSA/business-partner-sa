const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true});const p=await ctx.newPage({viewport:{width:1100,height:2400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/'+(process.argv[2]||'index-demo.html'));await p.waitForTimeout(500);
for(const kind of ['lump','cost']){
 await p.click(`[data-tab=${kind}]`);await p.waitForTimeout(400);
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#qt-dl')]);
 await dl.saveAs(`quote-${kind}.html`);
 const q=await ctx.newPage();await q.goto('file://'+process.cwd()+`/quote-${kind}.html`);await q.waitForTimeout(1500);
 await q.pdf({path:`quote-${kind}.pdf`,preferCSSPageSize:true,printBackground:true});await q.close();console.log(kind,'ok',fs.statSync(`quote-${kind}.html`).size);}
console.log(errs);await b.close();})();
