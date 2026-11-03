const {chromium}=require('playwright');const fs=require('fs');
const lang=process.argv[2]||'fr';
const EN=new Set(Object.keys(JSON.parse(fs.readFileSync('i18n-strings-en-ar.json','utf8'))));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1100,height:1600}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(300);
await p.click('#lang-'+lang);await p.waitForTimeout(300);
const ar=new Set(),en=new Set();
const grab=async(tag)=>{const parts=await p.evaluate(()=>{const parts=[];document.querySelectorAll('#app *').forEach(e=>{if(e.children.length===0&&e.offsetParent!==null)parts.push(e.textContent);['placeholder','title'].forEach(a=>{const v=e.getAttribute&&e.getAttribute(a);if(v)parts.push(v);});});document.querySelectorAll('select option').forEach(o=>parts.push(o.textContent));return parts;});
 for(const s of parts){const x=s.trim();if(!x)continue; if(/[؀-ۿ]/.test(x)) ar.add(tag+' :: '+x.slice(0,90)); else if(EN.has(x)) en.add(tag+' :: '+x.slice(0,90));}};
const sel=async(id,v)=>{await p.evaluate(([id,v])=>{const s=document.getElementById(id);if(!s)return;s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await p.waitForTimeout(250);};
for(const tab of ['lump','cost','nit','prof','hire','team','rent','ot','guides']){await p.click('[data-tab='+tab+']');await p.waitForTimeout(300);await grab(tab);}
await p.click('[data-tab=lump]');await p.waitForTimeout(250);
for(const [id,v] of [['l-term','12'],['l-src','inside'],['l-qty','1'],['i-gender','male'],['l-trn','1']]) await sel(id,v);
await p.fill('#l-sal','6000');await p.waitForTimeout(300);await grab('lump-ready');
for(const [id,v] of [['l-src','abroad'],['l-cty','PH'],['l-term','6'],['i-gender','female'],['x-commOn','Yes'],['x-otOn','Yes'],['l-src','saudi']]){await sel(id,v);await grab('lump:'+id+'='+v);}
await p.click('[data-gact="save"]').catch(()=>{});await p.waitForTimeout(300);await grab('saved');
await p.click('[data-tab=cost]');await p.waitForTimeout(300);for(const [id,v] of [['c-term','12'],['c-src','inside'],['c-qty','1'],['i-gender','male'],['c-trn','1']]) await sel(id,v);await p.fill('#c-sal','6000');await p.waitForTimeout(300);await grab('cost-ready');
console.log('ARABIC LEFT ('+ar.size+'):');console.log([...ar].slice(0,40).join('\n'));
console.log('UNTRANSLATED ENGLISH KEYS ('+en.size+'):');console.log([...en].slice(0,40).join('\n'));console.log(errs);await b.close();})();
