const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const out={};
for(const lang of ['fr','zh']){
const ctx=await b.newContext({viewport:{width:1300,height:3600}});
await ctx.addInitScript(()=>{window.claude={use:async n=>{if(n!=='sample')return null;const s=async()=>({text:''});s.limits=async()=>({images:{maxCount:4,mediaTypes:['image/png']}});s.json=async(inp)=>{const t=String(inp);if(t.includes('"plan"'))return {summary:'x',plan:[],target:''};return {platform:'q',text:'t',items:[{kind:'violation',title:'Violation',detail:'d',amount:5000,count:1,deadline:null}]}};return s;}};});
const p=await ctx.newPage();await p.goto('file://'+process.cwd()+'/index-demo.html');await p.waitForTimeout(600);
await p.click('#lang-'+lang);await p.waitForTimeout(300);
const tabs=await p.evaluate(()=>[...document.querySelectorAll('[data-tab]')].map(b=>b.dataset.tab));
const leaks=new Set(), latinOnlyEn=new Set();
const scan=async(tag)=>{const r=await p.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.getElementById('app'),NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;const t=n.nodeValue.trim();if(!t)continue;const pe=n.parentElement;if(pe&&/SCRIPT|STYLE/.test(pe.tagName))continue;o.push(t);}
 return [...document.querySelectorAll('input,select,textarea')].map(e=>e.placeholder||'').filter(Boolean).concat(o);});
 r.forEach(t=>{if(/[؀-ۿ]/.test(t)) leaks.add(tag+': '+t.slice(0,110));});};
await p.click('[data-tab=co]');await p.click('#co-demo');await p.waitForTimeout(300);
for(const tb of tabs){await p.click('[data-tab='+tb+']');await p.waitForTimeout(250);
 if(tb==='team'){await p.click('[data-tab=co]');await p.waitForTimeout(150);if(await p.$('[data-case=m2]')){await p.click('[data-case=m2]')}else{await p.click('[data-tab=team]')};await p.waitForTimeout(250);}
 if(tb==='lump'||tb==='cost'){const d=await p.$('[data-demo="10"]');if(d){await d.click();await p.waitForTimeout(300);}}
 await scan(tb);}
// compliance of complex company & docs panel
await p.click('[data-tab=co]');await p.waitForTimeout(200);await scan('co2');
fs.writeFileSync('leaks-'+lang+'.json',JSON.stringify([...leaks],null,1));console.log(lang,'leaks',leaks.size);
await ctx.close();}
await b.close();})();
