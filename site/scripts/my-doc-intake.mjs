// واجهة «ارفع كل ملفات شركتك مرة واحدة» في /my — يملكها client-portal.
//
// طلب المالك (2026-10-23): «أبغاك تضيف إيجنت لقراءة كل الملفات اللي ترفق مرة وحدة
// ويرتبها». هذا الملف هو الواجهة فقط؛ القراءة والتصنيف يقوم بهما المستشار الذكي
// للمستندات في الخادم (api/_doc-intake.js، يملكه document-ai) عبر إجراءين في
// POST /api/simple:
//   doc-intake          معاينة بلا حفظ: {files:[{name,mime,base64}], prior} ← files[] وcompanyFacts
//   doc-intake-confirm  حفظ ما أكّده العميل فقط: {files:[{id,name,mime,base64,title,category,expiry,docType,fields}], facts}
// والعقد الفعلي مقروءٌ من api/_doc-intake.js، وتحرسه tests/my-doc-intake.test.mjs باستدعائه نفسه.
//
// الرحلة: اختيار الملفات (أو سحبها) ← قراءةٌ لكل ملف بحالته ← مراجعةٌ (نوع وتصنيف
// وتاريخ انتهاء وحقول بعلامة ثقة وتحذيرات، وبطاقة بيانات الشركة قابلة للتعديل) ←
// «اعتمد ورتّب» ← نتيجة بملخّص. لا حفظ بلا ضغطة، والإلغاء متاح في كل لحظة.
//
// قواعد هذا الملف:
//  • نصٌّ واحد يُحقن داخل سكربت /my نفسه (يستعمل h وTX وstate وgo وrefreshMe وloadDocs)؛
//    لذلك كل ما فيه ES5 بلا قوالب نصّية ولا `${` ولا علامة اقتباس عكسية.
//  • المنطق الصافي في my-doc-intake-core.mjs (يُنسخ نصّ دالته إلى الصفحة وتختبره tests/).
//  • جسم الطلب لا يتّسع لأكثر من ٤٫٥MB (والـbase64 يزيده ثلثاً)، فالملفات تُرسل على نداءاتٍ صغيرة
//    (≤٣ ملفات و≤٣MB خاماً) تحمل نتائج ما سبقها، والاعتماد ملفاً ملفاً. وهذا يُعطي حالةً لكل ملف.

import { makeIntakeCore } from "./my-doc-intake-core.mjs";
export { INTAKE_P } from "./my-doc-intake-text.mjs";

export const INTAKE_CSS = String.raw`
/* ارفع كل ملفات شركتك مرة واحدة */
.ix-card{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border:2px dashed #b7c4e8;border-radius:18px;background:linear-gradient(180deg,#f7f9ff,#fff);padding:18px 20px;margin-bottom:16px;cursor:pointer;transition:border-color .15s,background .15s}
.ix-card:hover,.ix-card.over{border-color:var(--n);background:#f1f5ff}
.ix-card:focus-visible{outline:2px solid var(--n);outline-offset:2px}
.ix-ico{font-size:2rem;line-height:1;flex:none}
.ix-txt{flex:1 1 260px;min-width:0}
.ix-txt b{display:block;color:var(--ink);font-size:1.05rem;font-weight:600}
.ix-txt p{margin:4px 0 6px;color:#3b4561;font-size:.9rem;line-height:1.8}
.ix-txt small{display:block;color:var(--mut);font-size:.78rem;line-height:1.7}
.ix-card .btn{flex:0 0 auto}
.ix-lock{overflow:hidden}
/* النافذة تُضاف إلى <body> خارج .sv1 فلا ترث متغيّراته: نكتبها هنا صراحةً (وإلا اختفى زرّ كحليّ الخلفية) */
.ix-ovl{--n:#0B1B5A;--n2:#081345;--g:#F5F7FB;--line:#E5E9F0;--ink:#0B1B5A;--mut:#5A6478;--fm:"IBM Plex Mono",ui-monospace,SFMono-Regular,monospace;font-family:inherit;color:#232A3D;position:fixed;inset:0;z-index:96;background:rgba(12,18,40,.55);display:flex;justify-content:center;align-items:stretch}
.ix-box{background:var(--g,#f5f7fb);width:100%;max-width:920px;display:flex;flex-direction:column;min-height:0;outline:none}
.ix-hd{flex:none;display:flex;align-items:center;gap:12px;padding:14px 18px;background:#fff;border-bottom:1px solid var(--line)}
.ix-hd h2{margin:0;flex:1;min-width:0;font-size:1.1rem;font-weight:600;color:var(--ink)}
.ix-x{flex:none;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;width:38px;height:38px;font-size:1.05rem;cursor:pointer;line-height:1}
.ix-steps{flex:none;display:flex;gap:6px;padding:10px 18px;background:#fff;border-bottom:1px solid var(--line);list-style:none;margin:0}
.ix-steps li{flex:1 1 0;min-width:0;text-align:center;font-size:.78rem;font-weight:700;color:var(--mut);padding:6px 4px;border-radius:999px;background:#eef0f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ix-steps li.done{background:#eaf7ef;color:#118657}
.ix-steps li.on{background:var(--n);color:#fff}
.ix-body{flex:1;min-height:0;overflow:auto;padding:16px 18px}
.ix-ft{flex:none;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line)}
.ix-ft .grow{flex:1}
.ix-ft .btn{min-height:42px}
.ix-ft .msg{flex:1 1 100%;font-size:.84rem;color:#b91c1c;margin:0}
.ix-ft .ask{flex:1 1 100%;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ix-ft .ask span{flex:1 1 200px;font-size:.88rem;color:#7f1d1d;font-weight:600}
.ix-lead{margin:0 0 12px;color:#3b4561;font-size:.9rem;line-height:1.8}
.ix-banner{border:1px solid #f3d9a4;background:#fffaf0;color:#7c2d12;border-radius:12px;padding:11px 14px;font-size:.86rem;line-height:1.8;margin-bottom:12px}
.ix-count{display:flex;align-items:center;gap:10px;margin:0 0 6px;font-size:.88rem;color:var(--ink);font-weight:600}
.ix-count .bar{flex:1;margin-top:0}
.ix-row{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-bottom:8px}
.ix-row .st{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:.85rem;font-weight:800;box-sizing:border-box}
.ix-row.queued .st{background:#eef0f5;color:#5f6880}
.ix-row.reading .st,.ix-row.saving .st{border:3px solid #dbe3fb;border-top-color:var(--n);animation:ixspin .8s linear infinite}
.ix-row.ready .st,.ix-row.done .st{background:#eaf7ef;color:#118657}
.ix-row.failed .st{background:#fee2e2;color:#b91c1c}
.ix-row.manual .st,.ix-row.dup .st{background:#fff3e6;color:#b45309}
.ix-read em.rv{color:#b45309;font-style:normal;font-size:.72rem;font-weight:700}
@keyframes ixspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ix-row.reading .st,.ix-row.saving .st{animation:none}}
.ix-row .tt{flex:1;min-width:0}
.ix-row .tt b{display:block;color:var(--ink);font-weight:500;font-size:.92rem;overflow-wrap:anywhere}
.ix-row .tt small{display:block;color:var(--mut);font-size:.78rem;line-height:1.7;overflow-wrap:anywhere}
.ix-row .tt small.bad{color:#b91c1c}
.ix-row .tt small.warn{color:#b45309}
.ix-row .side{flex:none;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.ix-sum{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:.84rem;color:var(--mut)}
.ix-co{background:#fff;border:1px solid #b7c4e8;border-radius:16px;padding:16px;margin-bottom:14px}
.ix-co h3{margin:0 0 4px;color:var(--ink);font-size:1.02rem;font-weight:600}
.ix-co .ix-lead{margin-bottom:10px}
.ix-fld{margin-bottom:12px}
.ix-fld label{display:block;font-size:.82rem;color:var(--mut);margin-bottom:4px}
.ix-fld .inp{width:100%;box-sizing:border-box}
.ix-fld small{display:block;margin-top:4px;font-size:.78rem;line-height:1.7;color:var(--mut)}
.ix-fld small.warn{color:#b45309}.ix-fld small.good{color:#118657}.ix-fld small.bad{color:#b91c1c;font-weight:600}
.ix-fld .inp.bad{border-color:#b91c1c}
.ix-fld .alt{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;border:1px solid #f3d9a4;background:#fffaf0;border-radius:10px;padding:5px 8px;font-size:.78rem;color:#7c2d12}
.ix-fld .alt button{border:0;background:transparent;color:var(--n);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline;padding:0}
.ix-file{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 15px;margin-bottom:12px}
.ix-file.off{opacity:.6;background:#f7f8fb}
.ix-file .hd{display:flex;gap:10px;align-items:flex-start}
.ix-file .hd .ico{font-size:1.4rem;line-height:1;flex:none}
.ix-file .hd .tt{flex:1;min-width:0}
.ix-file .hd .tt b{display:block;color:var(--ink);font-weight:500;font-size:.93rem;overflow-wrap:anywhere}
.ix-file .hd .tt small{color:var(--mut);font-size:.76rem;font-family:var(--fm)}
.ix-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ix-note{margin:8px 0 0;font-size:.82rem;line-height:1.8;color:#7c2d12;background:#fff7ed;border-radius:10px;padding:8px 11px}
.ix-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:10px}
@media(min-width:760px){.ix-grid{grid-template-columns:1.4fr 1fr 1fr}}
.ix-grid label{display:block;font-size:.78rem;color:var(--mut);margin-bottom:3px}
.ix-grid .inp{width:100%;box-sizing:border-box}
.ix-read{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#f7f9ff;display:grid;grid-template-columns:minmax(0,1fr);gap:5px}
.ix-read h4{margin:0 0 2px;font-size:.78rem;color:var(--mut);font-weight:700}
.ix-read div{display:flex;gap:8px;align-items:baseline;font-size:.84rem;min-width:0}
.ix-read div span{color:var(--mut);flex:none;min-width:96px}
.ix-read div b{font-weight:500;color:var(--ink);overflow-wrap:anywhere;min-width:0}
.ix-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;margin-inline-start:auto;align-self:center}
.ix-dot.hi{background:#118657}.ix-dot.md{background:#f59e0b}.ix-dot.lo{background:#dc2626}
.ix-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ix-done{text-align:center;padding:6px 0 14px}
.ix-done .big{width:58px;height:58px;border-radius:50%;background:#eaf7ef;color:#118657;display:grid;place-items:center;margin:0 auto 10px;font-size:1.8rem;font-weight:800}
.ix-done .big.part{background:#fff3e6;color:#b45309}
.ix-done h3{margin:0 0 6px;font-size:1.2rem;font-weight:600;color:var(--ink)}
.ix-done p{margin:0;color:#3b4561;font-size:.92rem;line-height:1.8}
.ix-res{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:12px}
.ix-res h4{margin:0 0 8px;font-size:.92rem;color:var(--ink);font-weight:600}
.ix-res ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.ix-res li{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:.86rem;color:var(--ink);min-width:0}
.ix-res li small{color:var(--mut);overflow-wrap:anywhere}
.ix-res li .arrow{color:var(--mut)}
.ix-res li s{color:#b45309;text-decoration-thickness:1px}
.ix-res li b{font-weight:600}
@media(min-width:760px){.ix-ovl{padding:24px}.ix-box{border-radius:20px;box-shadow:0 24px 70px rgba(12,18,40,.4);overflow:hidden}}
@media(max-width:620px){.ix-card .btn{width:100%}.ix-ft .btn{flex:1 1 auto}.ix-row{flex-wrap:wrap}.ix-row .side{flex:1 1 100%;justify-content:flex-start}}
body:has(.ix-ovl) .bps-fab,body:has(.ix-ovl) .bpa-fab,body:has(.ix-ovl) .sv1-wa-fab{display:none!important}
`;

// نصّ الكود الذي يُحقن في سكربت /my. يُنتَج مرة واحدة عند البناء.
export function intakeClientScript() {
  return "var IXC=(" + makeIntakeCore.toString() + ")();\n" + CLIENT;
}

const CLIENT = String.raw`
// ---------- ارفع كل ملفات شركتك مرة واحدة (my-doc-intake.mjs)
var IXS=null;
function ixT(k,v){var s=TX[k]==null?k:TX[k];if(v)for(var p in v)s=s.split('{'+p+'}').join(String(v[p]==null?'':v[p]));return s}
function ixToday(){return new Date().toISOString().slice(0,10)}
function ixOrg(){var o=(state.me&&state.me.organization)||{};return {name_ar:o.name_ar||'',name_en:o.name_en||'',cr_number:o.cr_number||'',vat_number:o.vat_number||'',city:o.city||''}}
function ixHasOrg(){return !!(state.me&&state.me.organization&&state.me.organization.id)}
function ixTypeName(t){return TX['ixT_'+t]||TX.ixT_other}
function ixFieldName(f){return ({name_ar:TX.company,name_en:TX.nameEn,cr_number:TX.cr,vat_number:TX.ixFVat,city:TX.ixFCity,crNumber:TX.cr,vatNumber:TX.ixFVat,unifiedNumber:TX.ixFUnified,activity:TX.ixFActivity,companyNameAr:TX.company,companyNameEn:TX.nameEn,expiryDate:TX.dExp,issueDate:TX.dIssued})[f]||f}
function ixB64(f){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){var t=String(fr.result||'');var i=t.indexOf(',');i<0?rej(new Error('read')):res(t.slice(i+1))};fr.onerror=function(){rej(new Error('read'))};fr.readAsDataURL(f)})}
// طلبٌ مع إمكان الإلغاء. كل نهاية لها فرع: نجاح، أو ردّ خادم برمزه، أو انقطاع شبكة، أو إلغاء.
function ixPost(url,body,ac){
 return fetch(url,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:ac?ac.signal:undefined})
  .then(function(r){var st=r.status;return r.json().then(function(o){o=(o&&typeof o==='object')?o:{ok:false,error:'bad_response'};o._http=st;if(o.ok!==true&&!o.error)o.error='http_'+st;return o},function(){return {ok:false,error:'http_'+st,_http:st}})})
  .catch(function(e){var ab=!!(e&&e.name==='AbortError');return {ok:false,error:ab?'aborted':'network',_aborted:ab}})}
function ixApi(action,data,ac){return ixPost('/api/simple',Object.assign({action:action},data||{}),ac)}
function ixSize(n){n=Number(n||0);var t=n>=1048576?((n/1048576).toFixed(1)+' MB'):(Math.max(1,Math.round(n/1024))+' KB');return '\u2066'+t+'\u2069'}

// ----- بطاقة الدخول (في «مستنداتي» و«بيانات الشركة»)
function ixEntryCard(from){
 var inp=h('input',{type:'file',multiple:'multiple',accept:'application/pdf,image/jpeg,image/png,image/webp',style:'display:none','data-ix-input':from});
 var btn=h('button',{class:'btn',type:'button'},[TX.ixBtn]);
 var box=h('div',{class:'ix-card','data-ix-entry':from,tabindex:'0',role:'button','aria-label':TX.ixTitle},[h('span',{class:'ix-ico','aria-hidden':'true'},['🗂️']),h('div',{class:'ix-txt'},[h('b',{},[TX.ixTitle]),h('p',{},[TX.ixSub]),h('small',{},[TX.ixHint]),h('small',{},[TX.ixNoSave])]),btn,inp]);
 box.addEventListener('click',function(e){if(e.target===inp)return;inp.click()});
 box.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}});
 inp.addEventListener('click',function(e){e.stopPropagation()});
 inp.addEventListener('change',function(){var fs=Array.prototype.slice.call(inp.files||[]);inp.value='';if(fs.length)ixStart(fs,from)});
 ['dragenter','dragover'].forEach(function(n){box.addEventListener(n,function(e){e.preventDefault();box.classList.add('over')})});
 ['dragleave','drop'].forEach(function(n){box.addEventListener(n,function(e){e.preventDefault();box.classList.remove('over')})});
 box.addEventListener('drop',function(e){var fs=Array.prototype.slice.call((e.dataTransfer&&e.dataTransfer.files)||[]);if(fs.length)ixStart(fs,from)});
 return box}

// ----- الجلسة
function ixStart(files,from){
 if(IXS){ixAdd(files);return}
 IXS={step:'reading',from:from||'documents',entries:[],seq:0,inflight:false,cancelled:false,aborts:[],serviceDown:false,facts:null,cedit:{},ctouched:{},cancelAsk:false,org:ixOrg(),notes:[],save:null,plan:null,result:null,advance:null,msg:'',sugg:{}};
 document.documentElement.classList.add('ix-lock');
 ixMount();ixAdd(files)}
function ixMount(){
 var root=h('div',{class:'ix-ovl','data-ix':'1'});
 var box=h('div',{class:'ix-box',role:'dialog','aria-modal':'true',tabindex:'-1'});
 root.appendChild(box);document.body.appendChild(root);IXS.root=root;IXS.box=box;
 IXS.onkey=function(e){if(e.key==='Escape'){e.preventDefault();ixCancel()}};
 document.addEventListener('keydown',IXS.onkey);
 try{box.focus()}catch(x){}}
function ixClose(refresh){
 var S=IXS;if(!S)return;S.cancelled=true;clearTimeout(S.advance);
 S.aborts.forEach(function(a){try{a.abort()}catch(x){}});
 document.removeEventListener('keydown',S.onkey);
 if(S.root&&S.root.parentNode)S.root.parentNode.removeChild(S.root);
 document.documentElement.classList.remove('ix-lock');IXS=null;
 if(refresh&&state.me)render()}
function ixSessionEnd(){ixClose(false);sessionEnded()}
function ixAdd(files){
 var S=IXS;clearTimeout(S.advance);S.notes=[];
 var room=IXC.MAX_FILES-S.entries.length;
 if(files.length>room){S.notes=[TX.ixEMany];files=files.slice(0,Math.max(room,0))}
 files.forEach(function(f){
  var e={id:'c'+(++S.seq),file:f,name:f.name||'file',size:f.size||0,mime:IXC.mimeOf(f)||f.type||'',status:'queued',error:'',msg:'',srv:null,srvId:'',sha256:'',fields:{},docType:'unknown',category:'other',categoryDetail:'',title:IXC.baseName(f.name),issueDate:'',expiryDate:'',confidence:0,level:'low',warnings:[],keep:true,svcFail:false};
  var bad=IXC.fileCheck(f);
  if(bad){e.status='failed';e.error=bad;e.msg=TX[IXC.errKey(bad)]}
  S.entries.push(e)});
 S.step='reading';ixDraw();ixPump()}
function ixBusy(){return IXS.entries.some(function(e){return e.status==='queued'||e.status==='reading'})}
function ixById(id){return IXS.entries.filter(function(e){return e.id===id})[0]}
// نداءٌ واحد في الوقت: كل نداء يحمل نتائج ما سبقه (prior) فيدمج الخادم الحقائق ويكشف التكرار عبر النداءات.
function ixPump(){
 var S=IXS;if(!S||S.cancelled||S.step!=='reading'||S.inflight)return;
 var q=S.entries.filter(function(e){return e.status==='queued'});
 if(q.length){ixRunBatch(IXC.packBatches(q.map(function(e){return {id:e.id,size:e.size}}))[0]);return}
 if(S.entries.length){
  var failed=S.entries.some(function(e){return e.status==='failed'});
  var usable=S.entries.some(function(e){return e.status==='ready'||e.status==='manual'||e.status==='local'});
  if(!failed&&usable){clearTimeout(S.advance);S.advance=setTimeout(function(){if(IXS===S&&S.step==='reading'&&!ixBusy())ixGoReview()},700)}}}
function ixRunBatch(ids){
 var S=IXS,batch=ids.map(ixById);
 batch.forEach(function(e){e.status='reading';e.msg=''});S.inflight=true;ixDraw();
 var ac=window.AbortController?new AbortController():null;if(ac)S.aborts.push(ac);
 Promise.all(batch.map(function(e){return ixB64(e.file).then(function(b64){return {name:e.name,mime:e.mime,base64:b64}})}))
  .then(function(files){if(S.cancelled)return {_aborted:true};return ixApi('doc-intake',{files:files,prior:IXC.priorFrom(S.entries,ids)},ac)})
  .catch(function(){return {ok:false,error:'read_local'}})
  .then(function(o){S.inflight=false;if(S.cancelled||IXS!==S)return;ixOnBatch(batch,o);ixDraw();ixPump()})}
function ixFailWhole(batch,code,http){
 var svc=IXC.isServiceDown(code),key=code==='read_local'?'eRead':IXC.errKey(code);
 batch.forEach(function(e){e.status='failed';e.error=code;e.svcFail=svc||code==='network';e.msg=TX[key]||TX.ixEGeneric});
 if(code==='rate_limited'||code==='http_429'){IXS.entries.forEach(function(e){if(e.status==='queued'){e.status='failed';e.error=code;e.msg=TX.ixERate}})}}
function ixWarnMsg(w){var k='ixW_'+w.code;return TX[k]?ixT(k,{d:w.date,n:w.days,f:ixFieldName(w.field)}):(w.message||'')}
function ixOnBatch(batch,o){
 if(o._aborted)return;
 if(o.error==='unauthorized'||o.error==='no_session'){ixSessionEnd();return}
 if(o.ok!==true||!o.files){ixFailWhole(batch,o.error||'failed',o._http);return}
 if(o.companyFacts)IXS.facts=o.companyFacts;
 batch.forEach(function(e,i){
  var it=o.files[i];
  if(!it){e.status='failed';e.error='failed';e.msg=TX.ixEGeneric;return}
  var m=IXC.fromServer(it);
  e.status=m.status;e.srv=it;e.srvId=m.srvId;e.sha256=m.sha256;e.docType=m.docType;e.category=m.category;e.categoryDetail=m.categoryDetail;
  if(m.title){e.title=m.title;e.srvTitle=m.title}
  e.fields=m.fields;e.issueDate=m.issueDate;e.expiryDate=m.expiryDate;e.confidence=m.confidence;e.level=m.level;e.warnings=m.warnings;e.mime=m.mime||e.mime;
  e.keep=(m.status==='ready'||m.status==='manual');e.msg='';e.svcFail=false;
  if(m.warnings.some(function(w){return w.code==='reader_not_configured'}))IXS.serviceDown=true;
  if(m.status==='failed'){var w0=m.warnings.filter(function(w){return w.severity==='error'})[0]||m.warnings[0];e.error=w0?w0.code:'rejected';e.msg=w0?ixWarnMsg(w0):TX.ixEGeneric}})}

// ----- القراءة ← المراجعة
function ixRecompute(){
 var S=IXS;ixUniqTitles();S.sugg=IXC.adjustSuggestions(S.facts&&S.facts.suggested,S.entries)}
// الخزانة تُنسِّخ بالتصنيف والعنوان: ملفان بالعنوان نفسه يصيران «إصدارين» لمستند واحد (وقد يكون الثاني سجلَّ شركةٍ أخرى).
// الخادم يفرّق بينهما داخل النداء الواحد فقط، ونحن نرسل على نداءات، فيُفرَّق هنا: يُلحَق باسم الملف ما لم يعدّل العميل العنوان بنفسه.
function ixUniqTitles(){
 var seen={};
 IXS.entries.forEach(function(e){
  if((e.status!=='ready'&&e.status!=='manual'&&e.status!=='local')||e.keep===false)return;
  var base=e.srvTitle||e.title;
  if(!e.titleEdited){e.title=seen[e.category+'|'+String(base).trim().toLowerCase()]?(base+' — '+IXC.baseName(e.name)):base}
  seen[e.category+'|'+String(e.title).trim().toLowerCase()]=1})}
function ixGoReview(){var S=IXS;clearTimeout(S.advance);S.step='review';S.cancelAsk=false;S.msg='';ixRecompute();ixDraw()}

// ----- الرسم
var IXSTEP={reading:0,review:1,saving:2,result:2};
function ixDraw(){
 var S=IXS;if(!S)return;
 var box=S.box,old=box.querySelector('.ix-body'),sc=old?old.scrollTop:0;
 box.innerHTML='';
 var title=S.step==='reading'?TX.ixReadingTitle:S.step==='review'?TX.ixReviewTitle:S.step==='saving'?TX.ixSavingTitle:((S.result&&(S.result.failed.length||S.result.stopped||S.result.companyFailed))?TX.ixPartialTitle:TX.ixDoneTitle);
 box.setAttribute('aria-label',title);
 box.appendChild(h('div',{class:'ix-hd'},[h('h2',{},[title]),h('button',{class:'ix-x',type:'button','aria-label':TX.ixCancel,'data-ix-x':'1',onclick:function(){ixCancel()}},['✕'])]));
 var cur=IXSTEP[S.step],names=[TX.ixStep1,TX.ixStep2,TX.ixStep3];
 box.appendChild(h('ol',{class:'ix-steps'},names.map(function(n,i){return h('li',{class:i<cur||(S.step==='result'&&i===2)?'done':i===cur?'on':''},[(i+1)+' · '+n])})));
 var body=h('div',{class:'ix-body'}),ft=h('div',{class:'ix-ft'});
 box.appendChild(body);box.appendChild(ft);
 if(S.step==='reading')ixDrawReading(body,ft);
 else if(S.step==='review')ixDrawReview(body,ft);
 else if(S.step==='saving')ixDrawSaving(body,ft);
 else ixDrawResult(body,ft);
 body.scrollTop=sc}
function ixBanners(body){
 var S=IXS;
 if(S.serviceDown)body.appendChild(h('div',{class:'ix-banner',role:'status','data-ix-banner':'service'},[TX.ixEService]));
 S.notes.forEach(function(n){body.appendChild(h('div',{class:'ix-banner',role:'status'},[n]))})}
function ixRowState(e){
 return e.status==='queued'?TX.ixQueued:e.status==='reading'?TX.ixReadingNow:e.status==='ready'?TX.ixReady:(e.status==='manual'||e.status==='local')?TX.ixManual:e.status==='dup'?TX.ixDupWord:TX.ixFailed}
function ixRowIcon(s){return s==='ready'||s==='done'?'✓':s==='failed'?'!':(s==='manual'||s==='local'||s==='dup')?'↓':s==='queued'?'…':''}
// أزرار صفٍّ تعذّر: إعادة المحاولة حيث تفيد، والحفظ بلا قراءة حين تكون الخدمة نفسها هي المتعذّرة، والإزالة دائماً.
function ixFailBtns(e){
 var side=[],perm=(e.error==='bad_type'||e.error==='empty'||e.error==='too_large'||e.error==='corrupt'||e.error==='rejected');
 if(!perm)side.push(h('button',{class:'btn ghost sm',type:'button','data-ix-retry-file':e.id,onclick:function(){e.status='queued';e.msg='';e.error='';ixDraw();ixPump()}},[TX.ixRetry]));
 if(e.svcFail)side.push(h('button',{class:'btn ghost sm',type:'button','data-ix-raw':e.id,onclick:function(){e.status='local';e.keep=true;e.msg='';e.category='other';e.docType='unknown';e.fields={};e.warnings=[];ixDraw();ixPump()}},[TX.ixSaveRaw]));
 side.push(h('button',{class:'btn danger sm',type:'button',onclick:function(){IXS.entries.splice(IXS.entries.indexOf(e),1);ixRecompute();ixDraw();if(IXS.step==='reading')ixPump()}},[TX.ixRemove]));
 return side}
function ixDrawReading(body,ft){
 var S=IXS,total=S.entries.length,done=S.entries.filter(function(e){return e.status!=='queued'&&e.status!=='reading'}).length;
 body.appendChild(h('p',{class:'ix-lead'},[TX.ixReadingLead]));
 ixBanners(body);
 var bar=h('div',{class:'bar'},[h('i',{})]);bar.firstChild.style.width=(total?Math.round(done/total*100):0)+'%';
 body.appendChild(h('div',{class:'ix-count','aria-live':'polite','data-ix-count':'1'},[h('span',{},[ixT('ixCount',{n:done,t:total})]),bar]));
 S.entries.forEach(function(e){
  var tt=[h('b',{},[e.name]),h('small',{},[ixSize(e.size)+' · '+ixRowState(e)])];
  if(e.msg)tt.push(h('small',{class:'bad'},[e.msg]));
  body.appendChild(h('div',{class:'ix-row '+e.status,'data-ix-row':e.id,'data-state':e.status},[h('span',{class:'st','aria-hidden':'true'},[ixRowIcon(e.status)]),h('div',{class:'tt'},tt),h('div',{class:'side'},e.status==='failed'?ixFailBtns(e):[])]))});
 var usable=S.entries.some(function(e){return e.status==='ready'||e.status==='manual'||e.status==='local'});
 ft.appendChild(h('button',{class:'btn ghost',type:'button','data-ix-cancel':'1',onclick:function(){ixCancel()}},[TX.ixCancel]));
 ft.appendChild(ixAddBtn());ft.appendChild(h('span',{class:'grow'}));
 var go1=h('button',{class:'btn',type:'button','data-ix-continue':'1',onclick:function(){ixGoReview()}},[TX.ixContinue]);
 if(ixBusy()||!usable)go1.setAttribute('disabled','disabled');
 ft.appendChild(go1)}
function ixAddBtn(){
 var inp=h('input',{type:'file',multiple:'multiple',accept:'application/pdf,image/jpeg,image/png,image/webp',style:'display:none'});
 inp.addEventListener('change',function(){var fs=Array.prototype.slice.call(inp.files||[]);inp.value='';if(fs.length&&IXS)ixAdd(fs)});
 var b=h('button',{class:'btn ghost',type:'button','data-ix-add':'1',onclick:function(){inp.click()}},[TX.ixAddMore,inp]);
 inp.addEventListener('click',function(e){e.stopPropagation()});return b}

function ixConfLbl(c){return c==='high'?TX.ixConfHigh:c==='low'?TX.ixConfLow:TX.ixConfMed}
function ixConfCls(c){return c==='high'?'ok':c==='low'?'bad':'warn'}
function ixWarnCls(w){return w.severity==='error'?'bad':w.severity==='info'?'mut':'warn'}
function ixCatOptions(cur){var opts=DOC_CATS.map(function(c){return h('option',{value:c[0]},[c[1]])});
 if(!DOC_CATS.some(function(c){return c[0]===cur}))opts.push(h('option',{value:cur},[cur]));return opts}
function ixReadRows(e){
 var f=e.fields||{},rows=[];
 [['companyNameAr',TX.company],['companyNameEn',TX.nameEn],['crNumber',TX.cr],['unifiedNumber',TX.ixFUnified],['vatNumber',TX.ixFVat],['city',TX.ixFCity],['activity',TX.ixFActivity],['issueDate',TX.dIssued]].forEach(function(d){
  var x=f[d[0]];if(x&&x.value)rows.push([d[1],x.value,x.level,x.needsReview])});
 return rows}
function ixFileCard(e){
 var off=e.keep===false;
 var card=h('div',{class:'ix-file'+(off?' off':''),'data-ix-file':e.id,'data-keep':off?'0':'1'});
 var typeName=e.status==='ready'?ixTypeName(e.docType):TX.ixTypeUnknown;
 card.appendChild(h('div',{class:'hd'},[h('span',{class:'ico','aria-hidden':'true'},[/^image\//.test(e.mime)?'🖼️':'📄']),h('div',{class:'tt'},[h('b',{},[e.name]),h('small',{},[ixSize(e.size)])])]));
 var chips=h('div',{class:'ix-chips'});
 chips.appendChild(h('span',{class:'pill','data-ix-type':'1'},[typeName]));
 if(e.status==='ready')chips.appendChild(h('span',{class:'pill '+ixConfCls(e.level),'data-ix-conf':e.level},[ixConfLbl(e.level)]));
 IXC.displayWarnings(e,ixToday(),state.docs).forEach(function(w){var t=ixWarnMsg(w);if(t)chips.appendChild(h('span',{class:'pill '+ixWarnCls(w),'data-ix-warn':w.code},[t]))});
 if(off)chips.appendChild(h('span',{class:'pill mut'},[TX.ixIgnored]));
 card.appendChild(chips);
 if(e.status==='manual'||e.status==='local')card.appendChild(h('p',{class:'ix-note'},[TX.ixUnreadNote]));
 if(!off){
  var title=h('input',{class:'inp',maxlength:'200',dir:'auto','aria-label':TX.dName,'data-ix-title':e.id,value:e.title||''});
  title.addEventListener('input',function(){e.title=title.value;e.titleEdited=true});
  var cat=h('select',{class:'inp','aria-label':TX.ixCatLbl,'data-ix-cat':e.id},ixCatOptions(e.category));cat.value=e.category||'other';
  cat.addEventListener('change',function(){e.category=cat.value;ixRecompute();ixDraw()});
  var exp=h('input',{class:'inp',type:'date','aria-label':TX.dExp,'data-ix-exp':e.id,value:e.expiryDate||''});
  exp.addEventListener('change',function(){e.expiryDate=exp.value;ixDraw()});
  card.appendChild(h('div',{class:'ix-grid'},[h('div',{},[h('label',{},[TX.dName]),title]),h('div',{},[h('label',{},[TX.ixCatLbl]),cat]),h('div',{},[h('label',{},[TX.dExp]),exp])]));
  var rows=ixReadRows(e);
  if(rows.length){var rd=h('div',{class:'ix-read'},[h('h4',{},[TX.ixReadLbl])]);
   rows.forEach(function(r){rd.appendChild(h('div',{},[h('span',{},[r[0]]),h('b',{dir:'auto'},[r[1]]),r[3]?h('em',{class:'rv'},[TX.ixNeedReview]):null,h('i',{class:'ix-dot '+(r[2]==='high'?'hi':r[2]==='low'?'lo':'md'),title:ixConfLbl(r[2]),role:'img','aria-label':ixConfLbl(r[2])})]))});
   card.appendChild(rd)}}
 var act=h('div',{class:'ix-act'});
 act.appendChild(h('button',{class:'btn ghost sm',type:'button','data-ix-toggle':e.id,onclick:function(){e.keep=off;ixRecompute();ixDraw()}},[off?TX.ixRestore:TX.ixIgnore]));
 if(e.status==='manual'&&!IXS.serviceDown)act.appendChild(h('button',{class:'btn ghost sm',type:'button','data-ix-reread':e.id,onclick:function(){e.status='queued';e.warnings=[];IXS.step='reading';ixDraw();ixPump()}},[TX.ixRereads]));
 card.appendChild(act);
 return card}
function ixSideRow(e,cls,text){
 return h('div',{class:'ix-row '+cls,'data-ix-row':e.id},[h('span',{class:'st'},[cls==='failed'?'!':'↓']),h('div',{class:'tt'},[h('b',{},[e.name]),h('small',{class:cls==='failed'?'bad':'warn'},[text])]),h('div',{class:'side'},[h('button',{class:'btn danger sm',type:'button',onclick:function(){IXS.entries.splice(IXS.entries.indexOf(e),1);ixRecompute();ixDraw()}},[TX.ixRemove])])])}
function ixFailedRow(e){var r=ixSideRow(e,'failed',e.msg||TX.ixEGeneric);r.querySelector('.side').innerHTML='';ixFailBtns(e).forEach(function(b){r.querySelector('.side').appendChild(b)});return r}
function ixDupRow(e){var w=e.warnings.filter(function(x){return x.code==='duplicate'||x.code==='duplicate_in_vault'})[0];return ixSideRow(e,'dup',(w?ixWarnMsg(w):TX.ixDupNote))}
// بطاقة «بيانات شركتك» المقترحة. القيمة المعروضة: ما عدّله العميل، وإلا المقترح من الملفات، وإلا المسجَّل.
function ixCur(k){var s=IXS.sugg[k];return s?s.current:(IXS.org[k]||'')}
function ixCoValue(k){var S=IXS;if(S.ctouched[k])return S.cedit[k];var s=S.sugg[k];return s?s.value:(S.org[k]||'')}
function ixCoEdited(){var o={};IXC.COMPANY_FIELDS.forEach(function(k){o[k]=ixCoValue(k)});return o}
function ixCoCurrent(){var o={};IXC.COMPANY_FIELDS.forEach(function(k){o[k]=ixCur(k)});return o}
function ixCoPlan(){return IXC.companyDiff(ixCoCurrent(),ixCoEdited())}
function ixCoStatus(k,el){
 var S=IXS,v=String(ixCoValue(k)||'').trim(),cur=String(ixCur(k)||'').trim(),s=S.sugg[k];
 el.innerHTML='';el.className='';
 var bad=IXC.factIssues(ixCoPlan()).filter(function(i){return i.field===k})[0];
 var inpEl=el.previousSibling;if(inpEl&&inpEl.classList)inpEl.classList.toggle('bad',!!bad);
 if(bad){el.className='bad';el.appendChild(document.createTextNode(k==='cr_number'?TX.ixErrCr:TX.ixErrVat));return}
 if(!v){if(!s)el.appendChild(document.createTextNode(TX.ixNotFound));return}
 if(cur&&IXC.exactSame(k,cur,v)){el.className='good';el.appendChild(document.createTextNode(TX.ixSame));return}
 if(cur){el.className='warn';el.appendChild(document.createTextNode(ixT('ixCurrent',{v:cur})+(s&&s.value===v?' · '+TX.ixReplaces:'')));return}
 if(s&&s.value===v){el.className=s.needsReview?'warn':'good';el.appendChild(document.createTextNode((s.source&&s.source.fileName?ixT('ixFrom',{f:s.source.fileName}):TX.ixFresh)+(s.needsReview?' · '+TX.ixNeedReview:'')))}}
function ixCompanyCard(){
 var S=IXS,sg=S.sugg||{};
 var card=h('div',{class:'ix-co','data-ix-company':'1'});
 card.appendChild(h('h3',{},['🏢 '+TX.ixCompanyTitle]));card.appendChild(h('p',{class:'ix-lead'},[TX.ixCompanyLead]));
 var rows=[['name_ar',TX.company],['name_en',TX.nameEn],['cr_number',TX.cr],['vat_number',TX.ixFVat]];
 if(sg.city||S.org.city)rows.push(['city',TX.ixFCity]);
 rows.forEach(function(r){
  var k=r[0],fld=h('div',{class:'ix-fld','data-ix-fld':k});
  var inp=h('input',{class:'inp',dir:'auto',value:ixCoValue(k)||'','aria-label':r[1],'data-ix-co':k,autocomplete:'off',inputmode:(k==='cr_number'||k==='vat_number')?'numeric':'text'});
  var st=h('small',{});
  inp.addEventListener('input',function(){S.cedit[k]=inp.value;S.ctouched[k]=true;ixCoStatus(k,st)});
  fld.appendChild(h('label',{},[r[1]]));fld.appendChild(inp);fld.appendChild(st);ixCoStatus(k,st);
  ((sg[k]&&sg[k].alts)||[]).forEach(function(a){fld.appendChild(h('div',{class:'alt'},[h('span',{},[ixT('ixAlt',{v:a.value})+(a.source&&a.source.fileName?' ('+a.source.fileName+')':'')]),h('button',{type:'button','data-ix-alt':k,onclick:function(){S.cedit[k]=a.value;S.ctouched[k]=true;inp.value=a.value;ixCoStatus(k,st)}},[TX.ixUseAlt])]))});
  card.appendChild(fld)});
 return card}
function ixCounts(){var S=IXS,c={t:S.entries.length,r:0,u:0,d:0,f:0};
 S.entries.forEach(function(e){if(e.status==='failed')c.f++;else if(e.status==='dup')c.d++;else if(e.status==='manual'||e.status==='local')c.u++;else c.r++});return c}
function ixKept(){return IXS.entries.filter(IXC.savable)}
function ixDrawReview(body,ft){
 var S=IXS;
 body.appendChild(h('p',{class:'ix-lead'},[TX.ixReviewLead]));
 ixBanners(body);
 body.appendChild(h('div',{class:'ix-sum','data-ix-sum':'1'},[ixT('ixSummary',ixCounts())]));
 body.appendChild(ixCompanyCard());
 S.entries.forEach(function(e){body.appendChild(e.status==='failed'?ixFailedRow(e):e.status==='dup'?ixDupRow(e):ixFileCard(e))});
 var n=ixKept().length;
 if(S.cancelAsk){
  ft.appendChild(h('div',{class:'ask'},[h('span',{},[TX.ixCancelAsk]),h('button',{class:'btn solid-danger',type:'button','data-ix-cancel-yes':'1',onclick:function(){ixClose(false)}},[TX.ixCancelYes]),h('button',{class:'btn ghost',type:'button',onclick:function(){S.cancelAsk=false;ixDraw()}},[TX.ixCancelNo])]));return}
 if(S.msg)ft.appendChild(h('p',{class:'msg',role:'alert'},[S.msg]));
 ft.appendChild(h('button',{class:'btn ghost',type:'button','data-ix-cancel':'1',onclick:function(){ixCancel()}},[TX.ixCancel]));
 ft.appendChild(ixAddBtn());ft.appendChild(h('span',{class:'grow'}));
 ft.appendChild(h('button',{class:'btn',type:'button','data-ix-confirm':'1',onclick:function(){ixSave()}},[ixT('ixConfirmN',{n:n})]))}
function ixCancel(){
 var S=IXS;if(!S)return;
 if(S.step==='reading'||S.step==='result'){ixClose(S.step==='result');return}
 if(S.step==='review'){if(!S.cancelAsk){S.cancelAsk=true;ixDraw()}return}
 if(S.step==='saving'&&S.save){S.save.stopped=true;ixDraw()}}

// ----- الاعتماد: حفظ ما أكّده العميل فقط، ملفاً ملفاً (جسم الطلب لا يتّسع لأكثر من ٣٫٣MB خاماً)
// مهام الحفظ بالترتيب: ملفات الخادم (والحقائق تركب مع أولها)، ثم مهمة حقائق وحدها إن لم تكن ملفات،
// ثم ملفات «بلا قراءة» عبر مسار الخزانة القائم (ops-doc-upload) حين تكون خدمة القراءة نفسها متعذّرة.
function ixSave(){
 var S=IXS,plan=IXC.confirmPlan(S.entries,ixCoEdited(),ixCoCurrent()),hasCo=Object.keys(plan.facts).length>0;
 if(plan.issues.length){S.msg=TX.ixFixFirst;ixDraw();return}
 var all=plan.files.concat(plan.localFiles);
 if(all.some(function(f){return !String(f.title||'').trim()})){S.msg=TX.eName;ixDraw();return}
 if(!ixHasOrg()&&!(plan.facts.name_ar||plan.facts.name_en)){S.msg=TX.ixNeedName;ixDraw();return}
 if(!all.length&&!hasCo){S.msg=TX.ixNothing;ixDraw();return}
 var tasks=[];
 plan.files.forEach(function(f){tasks.push({id:f.id,kind:'srv',state:'queued',err:''})});
 if(!plan.files.length&&hasCo)tasks.push({id:'facts',kind:'facts',state:'queued',err:''});
 plan.localFiles.forEach(function(f){tasks.push({id:f.id,kind:'local',state:'queued',err:''})});
 S.msg='';S.step='saving';S.plan=plan;S.save={tasks:tasks,co:hasCo?'queued':'none',stopped:false,factErrors:[],applied:[],createdOrg:false};
 ixDraw();ixSaveNext()}
function ixTaskFile(t){var S=IXS;return t.kind==='local'?S.plan.localFiles.filter(function(f){return f.id===t.id})[0]:S.plan.files.filter(function(f){return f.id===t.id})[0]}
function ixEntryOfTask(t){var S=IXS;return S.entries.filter(function(e){return t.kind==='local'?e.id===t.id:e.srvId===t.id})[0]}
function ixSaveNext(){
 var S=IXS;if(!S||S.cancelled)return;var sv=S.save;
 var t=null;for(var i=0;i<sv.tasks.length;i++)if(sv.tasks[i].state==='queued'){t=sv.tasks[i];break}
 if(sv.stopped||!t){ixFinish();return}
 t.state='saving';
 var withFacts=sv.co==='queued'&&t.kind!=='local';if(withFacts)sv.co='saving';
 ixDraw();
 var ac=window.AbortController?new AbortController():null;if(ac)S.aborts.push(ac);
 var f=t.kind==='facts'?null:ixTaskFile(t),e=f?ixEntryOfTask(t):null;
 var prep=e?ixB64(e.file):Promise.resolve('');
 prep.then(function(b64){
  if(t.kind==='local')return ixPost('/api/requests',{action:'ops-doc-upload',title:f.title,category:f.category,expiry:f.expiry||'',fileName:f.name,mime:f.mime,base64:b64},ac);
  var p={files:f?[Object.assign({},f,{base64:b64})]:[]};if(withFacts)p.facts=S.plan.facts;
  return ixApi('doc-intake-confirm',p,ac)},function(){return {ok:false,error:'read_local'}})
  .then(function(o){
   if(S.cancelled||IXS!==S)return;
   if(o.error==='unauthorized'||o.error==='no_session'){ixSessionEnd();return}
   ixOnSaved(t,f,o,withFacts);ixSaveNext()})}
function ixOnSaved(t,f,o,withFacts){
 var S=IXS,sv=S.save;
 if(t.kind==='local'){if(o.ok===true)t.state='done';else{t.state='failed';t.err=o.error||'failed'}return}
 if(o.ok!==true){
  if(f){t.state='failed';t.err=o.error==='read_local'?'read_local':(o.error||'failed')}else t.state='failed';
  if(withFacts){sv.co='failed';sv.factErrors.push({field:'organization',error:'db_failed'})}
  return}
 if(f){
  var sk=(o.skipped||[]).filter(function(x){return x&&x.id===t.id})[0];
  if(sk){t.state=sk.reason==='duplicate'?'dup':'failed';t.err=sk.reason}else t.state='done'}
 else t.state='done';
 if(withFacts){
  var fe=o.factErrors||[],ap=o.factsApplied||[];
  fe.forEach(function(x){sv.factErrors.push(x)});ap.forEach(function(k){sv.applied.push(k)});
  sv.co=(ap.length||!fe.length)?'done':'failed';
  if(o.createdOrg)sv.createdOrg=true;
  if(o.organization&&state.me)state.me.organization=Object.assign(state.me.organization||{},o.organization)}}
function ixFinish(){
 var S=IXS,sv=S.save,plan=S.plan,saved=[],failed=[],dups=[];
 sv.tasks.forEach(function(t){
  var f=ixTaskFile(t);
  if(t.kind==='facts')return;
  if(t.state==='done')saved.push({id:t.id,name:f.name,title:f.title,category:f.category});
  else if(t.state==='dup')dups.push({id:t.id,name:f.name});
  else if(t.state==='failed')failed.push({id:t.id,name:f.name,code:t.err})});
 var changes=[];
 for(var k in plan.diff)if(sv.applied.indexOf(k)>=0)changes.push({field:k,from:plan.diff[k].from,to:plan.diff[k].to});
 if(changes.length&&state.me){var org=state.me.organization=state.me.organization||{};changes.forEach(function(c){org[c.field]=c.to})}
 S.result={saved:saved,failed:failed,dups:dups,changes:changes,factErrors:sv.factErrors,companyFailed:sv.co==='failed',stopped:sv.stopped&&sv.tasks.some(function(t){return t.state==='queued'})};
 S.step='result';ixDraw();
 refreshMe().then(function(){return loadDocs()}).then(function(){if(IXS===S)S.org=ixOrg()})}
function ixDrawSaving(body,ft){
 var S=IXS,sv=S.save;
 body.appendChild(h('p',{class:'ix-lead'},[TX.ixSavingLead]));
 var total=sv.tasks.filter(function(t){return t.kind!=='facts'}).length+(sv.co==='none'?0:1),
  done=sv.tasks.filter(function(t){return t.kind!=='facts'&&(t.state==='done'||t.state==='failed'||t.state==='dup')}).length+((sv.co==='done'||sv.co==='failed')?1:0);
 var bar=h('div',{class:'bar'},[h('i',{})]);bar.firstChild.style.width=(total?Math.round(done/total*100):0)+'%';
 body.appendChild(h('div',{class:'ix-count','aria-live':'polite','data-ix-count':'1'},[h('span',{},[ixT('ixCount',{n:done,t:total})]),bar]));
 if(sv.co!=='none')body.appendChild(ixSaveRow('co',TX.ixSavingCompany,sv.co,Object.keys(S.plan.facts).map(ixFieldName).join('، ')));
 sv.tasks.forEach(function(t){if(t.kind==='facts')return;var f=ixTaskFile(t);body.appendChild(ixSaveRow(t.id,f.name,t.state,(f.title||'')+' · '+catName(f.category)))});
 ft.appendChild(h('span',{class:'grow'}));
 var stop=h('button',{class:'btn ghost',type:'button','data-ix-stop':'1',onclick:function(){ixCancel()}},[TX.ixStop]);
 if(sv.stopped)stop.setAttribute('disabled','disabled');ft.appendChild(stop)}
function ixSaveRow(id,name,st,sub){
 var label=st==='done'?TX.ixSaved:st==='saving'?TX.ixSavingNow:st==='failed'?TX.ixFailed:st==='dup'?TX.ixDupWord:TX.ixQueued;
 return h('div',{class:'ix-row '+(st==='saving'?'saving':st==='done'?'done':st==='failed'?'failed':'queued'),'data-ix-save':id,'data-state':st},[h('span',{class:'st','aria-hidden':'true'},[st==='done'?'✓':st==='failed'?'!':st==='queued'?'…':st==='dup'?'↓':'']),h('div',{class:'tt'},[h('b',{},[name]),h('small',{},[label+(sub?' · '+sub:'')])])])}
function ixDrawResult(body,ft){
 var S=IXS,r=S.result,part=r.failed.length>0||r.companyFailed||r.stopped;
 body.appendChild(h('div',{class:'ix-done','data-ix-result':part?'partial':'ok'},[h('div',{class:'big'+(part?' part':''),'aria-hidden':'true'},[part?'!':'✓']),h('h3',{},[part?TX.ixPartialTitle:TX.ixDoneTitle]),
  h('p',{},[r.saved.length?ixT('ixDoneFiles',{n:r.saved.length}):''])]));
 if(r.stopped)body.appendChild(h('div',{class:'ix-banner'},[TX.ixStopped]));
 if(r.failed.length)body.appendChild(h('div',{class:'ix-banner'},[ixT('ixPartial',{n:r.failed.length})]));
 if(r.dups.length)body.appendChild(h('div',{class:'ix-banner'},[r.dups.map(function(d){return d.name}).join('، ')+' — '+TX.ixSkipDup]));
 if(r.saved.length){var ul=h('ul',{});r.saved.forEach(function(s){ul.appendChild(h('li',{},[h('span',{class:'pill ok'},[catName(s.category)]),h('b',{},[s.title||s.name]),h('small',{},[s.name])]))});
  body.appendChild(h('div',{class:'ix-res','data-ix-saved':'1'},[h('h4',{},['📁 '+TX.navDocs]),ul]))}
 var cb=h('div',{class:'ix-res','data-ix-changes':'1'},[h('h4',{},['🏢 '+(r.changes.length?TX.ixDoneCompany:TX.ixDoneNoCompany)])]);
 if(r.changes.length){var cu=h('ul',{});r.changes.forEach(function(c){cu.appendChild(h('li',{},[h('span',{},[ixFieldName(c.field)+':']),(c.from?h('s',{dir:'auto'},[c.from]):null),(c.from?h('span',{class:'arrow'},['←']):null),h('b',{dir:'auto'},[c.to])]))});cb.appendChild(cu)}
 r.factErrors.forEach(function(x){cb.appendChild(h('p',{class:'err'},[TX['ixEFact_'+x.error]||TX.ixECompany]))});
 body.appendChild(cb);
 if(r.failed.length){var fu=h('ul',{});r.failed.forEach(function(f){fu.appendChild(h('li',{},[h('b',{},[f.name]),h('small',{class:'err'},[TX[f.code==='read_local'?'eRead':IXC.errKey(f.code)]||TX.ixESave])]))});body.appendChild(h('div',{class:'ix-res'},[fu]))}
 ft.appendChild(h('button',{class:'btn ghost',type:'button','data-ix-close':'1',onclick:function(){ixClose(true)}},[TX.ixClose]));
 if(r.failed.length||r.companyFailed||r.stopped){ft.appendChild(h('button',{class:'btn ghost',type:'button','data-ix-retry':'1',onclick:function(){ixRetrySave()}},[TX.ixRetrySave]))}
 ft.appendChild(h('span',{class:'grow'}));
 var coFirst=r.changes.length>0;
 ft.appendChild(h('button',{class:'btn'+(coFirst?'':' ghost'),type:'button','data-ix-open':'company',onclick:function(){ixClose(false);go('company')}},[TX.ixOpenCompany]));
 ft.appendChild(h('button',{class:'btn'+(coFirst?' ghost':''),type:'button','data-ix-open':'documents',onclick:function(){ixClose(false);go('documents')}},[TX.ixOpenVault]))}
function ixRetrySave(){
 var S=IXS,sv=S.save;
 sv.tasks.forEach(function(t){if(t.state==='failed'||(sv.stopped&&t.state==='queued'))t.state='queued';t.err=''});
 if(sv.co==='failed'){sv.co='queued';var ft=sv.tasks.filter(function(t){return t.kind==='facts'})[0];if(ft)ft.state='queued';
  if(!ft&&!sv.tasks.some(function(t){return t.kind==='srv'&&t.state==='queued'})){sv.tasks.push({id:'facts',kind:'facts',state:'queued',err:''})}}
 sv.stopped=false;sv.factErrors=[];S.step='saving';ixDraw();ixSaveNext()}
`;
