const fs=require('fs'); const acorn=require('/opt/node-tools/node_modules/acorn');
const f=process.argv[2]; let html=fs.readFileSync(f,'utf8');
const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop(); const src=m[1], start=m.index+'<script>'.length;
const ast=acorn.parse(src,{ecmaVersion:2022,sourceType:'script'});
const STUB={discAmounts:'null',lumpCalc:'null',costCalc:'null',schedCalc:'null',saudiCalc:'null',saudiInputs:"''",saudiResult:"''",viewSaudi:"''",groupBtns:"''",groupsBox:"''",groupLabel:"''",groupTotal:'0',discBox:"''",quoteBox:"''",cta:"''",feeFields:"''",quoteData:'null',quotePages:"''",quoteHtml:"''",tx0:"''",stagesOf:'[]',viewLump:'eorCta()',viewLumpInner:'eorCta()',viewCost:'eorCta()',viewCostInner:'eorCta()',viewRent:'eorCta()',viewOt:'eorCta()',simpleMode:"''",tierPrem:'0',discWire:'',quoteWire:''};
const hits=[]; (function walk(n){ if(!n||typeof n!=='object') return; if(Array.isArray(n)){n.forEach(walk);return;} if(n.type==='FunctionDeclaration'&&n.id&&STUB[n.id.name]!==undefined) hits.push([n.start,n.end,n.id.name,n.async]); for(const k in n) if(k!=='type'&&n[k]&&typeof n[k]==='object') walk(n[k]); })(ast);
hits.sort((a,b)=>b[0]-a[0]); let out=src; const done=[];
for(const [s,e,name] of hits){ out=out.slice(0,s)+`function ${name}(){return ${STUB[name]};}`+out.slice(e); done.push(name); }
fs.writeFileSync(f,html.slice(0,start)+out+html.slice(start+src.length));
const miss=Object.keys(STUB).filter(k=>!done.includes(k)); console.log('stripped',done.length,'missing',miss.join(','));
