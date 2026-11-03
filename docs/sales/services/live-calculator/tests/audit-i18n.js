const {chromium}=require('playwright');
const lang=process.argv[2]||'en';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1600}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
if(lang==='en'){await p.click('#lang-en');await p.waitForTimeout(300);}
const bad=new Set();
const grab=async(tag)=>{const txt=await p.evaluate(()=>{const m=document.querySelector('#app')||document.body;const parts=[];m.querySelectorAll('*').forEach(e=>{if(e.children.length===0&&e.offsetParent!==null){parts.push(e.textContent)} ;['placeholder','title','aria-label'].forEach(a=>{const v=e.getAttribute&&e.getAttribute(a);if(v)parts.push(v);});});
 // select options
 document.querySelectorAll('select option').forEach(o=>parts.push(o.textContent));return parts;});
 for(const s of txt){const t=s.trim(); if(!t) continue; if(lang==='en'? /[؀-ۿ]/.test(t) : /[A-Za-z]{4,}/.test(t)) bad.add(tag+' :: '+t.slice(0,110));}};
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);if(!s)return;s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
const tabs=['lump','cost','nit','prof','hire','team','rent','ot','guides'];
for(const tab of tabs){await p.click('[data-tab='+tab+']');await p.waitForTimeout(300);await grab(tab);}
// variations in lump/cost
await p.click('[data-tab=lump]');await p.waitForTimeout(250);
for(const [id,v] of [['l-src','abroad'],['l-cty','PH'],['l-term','6'],['l-term','3'],['i-gender','female'],['i-mat','Yes'],['x-commOn','Yes'],['x-otOn','Yes'],['q-skill','yes'],['l-src','saudi'],['l-term','12'],['l-term','u:day']]){await sel(id,v);await grab('lump:'+id+'='+v);}
await p.check('#own').catch(()=>{});await p.waitForTimeout(300);await grab('lump-owner');
await sel('l-term','12');await sel('l-src','inside');
await p.click('[data-gact="save"]').catch(()=>{});await p.waitForTimeout(300);await grab('lump-saved');
await p.click('[data-tab=cost]');await p.waitForTimeout(300);
for(const [id,v] of [['c-src','abroad'],['c-src','inside'],['c-src','saudi'],['c-term','6']]){await sel(id,v);await grab('cost:'+id+'='+v);}
await p.click('[data-tab=rent]');await p.waitForTimeout(300);await grab('rent');
await p.click('[data-tab=nit]');await p.waitForTimeout(300);await grab('nit');
console.log([...bad].join('\n'));console.log('COUNT',bad.size,errs);await b.close();})();
