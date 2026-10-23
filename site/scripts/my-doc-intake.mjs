// واجهة «ارفع كل ملفات شركتك مرة واحدة» في /my — يملكها client-portal.
//
// طلب المالك (2026-10-23): «أبغاك تضيف إيجنت لقراءة كل الملفات اللي ترفق مرة وحدة
// ويرتبها». هذا الملف هو الواجهة فقط؛ القراءة والتصنيف يقوم بهما المستشار الذكي
// للمستندات في الخادم (api/_doc-intake.js، يملكه document-ai) عبر إجراءين في
// POST /api/simple:
//   doc-intake          معاينة بلا حفظ: ملفٌّ أو أكثر ← ما قُرئ منها
//   doc-intake-confirm  حفظ ما أكّده العميل فقط (الملفات + بيانات الشركة)
// والعقد بينهما في tests/fixtures/doc-intake-contract.json.
//
// الرحلة: اختيار الملفات (أو سحبها) ← قراءةٌ لكل ملف بحالته ← مراجعةٌ (نوع وتصنيف
// وتاريخ انتهاء وحقول بعلامة ثقة وتحذيرات، وبطاقة بيانات الشركة قابلة للتعديل) ←
// «اعتمد ورتّب» ← نتيجة بملخّص. لا حفظ بلا ضغطة، والإلغاء متاح في كل لحظة.
//
// قواعد هذا الملف:
//  • نصٌّ واحد يُحقن داخل سكربت /my نفسه (يستعمل h وTX وstate وgo وrefreshMe وloadDocs)؛
//    لذلك كل ما فيه ES5 بلا قوالب نصّية ولا `${` ولا علامة اقتباس عكسية.
//  • المنطق الصافي في my-doc-intake-core.mjs (يُنسخ نصّ دالته إلى الصفحة وتختبره tests/).
//  • كل ملفٍ يُقرأ بطلبٍ مستقل (الدفعة الواحدة بثمانية ميجابايت تُسقط الطلب في المنصّات
//    التي تحدّ حجم الجسم)، وهذا يُعطي حالةً حقيقية لكل ملف: يُقرأ / جاهز / تعذّر.

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
.ix-ovl{position:fixed;inset:0;z-index:96;background:rgba(12,18,40,.55);display:flex;justify-content:center;align-items:stretch}
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
.ix-row.manual .st{background:#fff3e6;color:#b45309}
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
.ix-fld small.warn{color:#b45309}.ix-fld small.good{color:#118657}
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
function ixT(k,v){var s=TX[k]==null?k:TX[k];if(v)for(var p in v)s=s.split('{'+p+'}').join(String(v[p]));return s}
function ixToday(){return new Date().toISOString().slice(0,10)}
function ixOrg(){var o=(state.me&&state.me.organization)||{};return {name_ar:o.name_ar||'',name_en:o.name_en||'',cr_number:o.cr_number||'',vat_number:o.vat_number||'',city:o.city||''}}
function ixHasOrg(){return !!(state.me&&state.me.organization&&state.me.organization.id)}
function ixTypeName(t){return TX['ixT_'+t]||TX.ixT_other}
function ixFieldName(f){return ({name_ar:TX.company,name_en:TX.nameEn,cr_number:TX.cr,vat_number:TX.ixFVat,city:TX.ixFCity,crNumber:TX.cr,vatNumber:TX.ixFVat,companyNameAr:TX.company,expiryDate:TX.dExp})[f]||f}
function ixB64(f){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){var t=String(fr.result||'');var i=t.indexOf(',');i<0?rej(new Error('read')):res(t.slice(i+1))};fr.onerror=function(){rej(new Error('read'))};fr.readAsDataURL(f)})}
// طلبٌ إلى /api/simple مع إمكان الإلغاء. كل نهاية لها فرع: نجاح، أو ردّ خادم برمزه، أو انقطاع شبكة، أو إلغاء.
function ixApi(action,data,ac){
 return fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{})),signal:ac?ac.signal:undefined})
  .then(function(r){var st=r.status;return r.json().then(function(o){o=(o&&typeof o==='object')?o:{ok:false,error:'bad_response'};o._http=st;return o},function(){return {ok:false,error:'http_'+st,_http:st}})})
  .catch(function(e){var ab=!!(e&&e.name==='AbortError');return {ok:false,error:ab?'aborted':'network',_aborted:ab}})}
function ixSize(n){n=Number(n||0);return n>=1048576?((n/1048576).toFixed(1)+' MB'):(Math.max(1,Math.round(n/1024))+' KB')}

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
 IXS={step:'reading',from:from||'documents',entries:[],seq:0,running:0,cancelled:false,aborts:[],serviceDown:false,cedit:{},ctouched:{},cancelAsk:false,org:ixOrg(),orgKnown:{},notes:[],save:null,plan:null,result:null,advance:null,msg:''};
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
 var S=IXS;clearTimeout(S.advance);
 var room=IXC.MAX_FILES-S.entries.length;
 if(files.length>room){S.notes=[TX.ixEMany];files=files.slice(0,Math.max(room,0))}
 files.forEach(function(f){
  var e={id:'f'+(++S.seq),file:f,name:f.name||'file',size:f.size||0,mime:IXC.mimeOf(f)||f.type||'',status:'queued',error:'',msg:'',fields:null,fieldConfidence:{},docType:'other',title:IXC.baseName(f.name),category:'other',issueDate:'',expiryDate:'',confidence:'medium',serverWarnings:[],keep:true,warnings:[],dupOf:'',dupHandled:false};
  var bad=IXC.fileCheck(f);
  if(bad){e.status='failed';e.error=bad;e.msg=TX[IXC.errKey(bad)]}
  else if(S.serviceDown){ixToManual(e,'ixEService')}
  else if(f.size>IXC.MAX_READ){ixToManual(e,'ixEBigRead')}
  S.entries.push(e)});
 S.step='reading';ixDraw();ixPump()}
function ixToManual(e,key){e.status='manual';e.msg=TX[key]||'';e.fields=null;e.docType='other';e.category='other';e.title=IXC.baseName(e.name)}
function ixBusy(){return IXS.entries.some(function(e){return e.status==='queued'||e.status==='reading'})}
function ixPump(){
 var S=IXS;if(!S||S.cancelled||S.step!=='reading')return;
 for(var i=0;i<S.entries.length&&S.running<2;i++){if(S.entries[i].status==='queued')ixRead(S.entries[i])}
 if(!ixBusy()&&S.entries.length){
  var failed=S.entries.some(function(e){return e.status==='failed'});
  var usable=S.entries.some(function(e){return e.status==='ready'||e.status==='manual'});
  if(!failed&&usable){clearTimeout(S.advance);S.advance=setTimeout(function(){if(IXS===S&&S.step==='reading'&&!ixBusy())ixGoReview()},700)}}}
function ixRead(e){
 var S=IXS;e.status='reading';S.running++;ixDraw();
 var ac=window.AbortController?new AbortController():null;if(ac)S.aborts.push(ac);
 ixB64(e.file).then(function(b64){if(S.cancelled)return {_aborted:true};return ixApi('doc-intake',{files:[{id:e.id,name:e.name,mime:e.mime,base64:b64}]},ac)})
  .catch(function(){return {ok:false,error:'read_local'}})
  .then(function(o){S.running--;if(S.cancelled||IXS!==S||S.entries.indexOf(e)<0)return;ixOnRead(e,o);ixDraw();ixPump()})}
function ixServiceDown(){var S=IXS;S.serviceDown=true;S.entries.forEach(function(e){if(e.status==='queued')ixToManual(e,'ixEService')})}
function ixOnRead(e,o){
 if(o._aborted)return;
 if(o.error==='unauthorized'||o.error==='no_session'){ixSessionEnd();return}
 if(o.error==='read_local'){e.status='failed';e.error='read_local';e.msg=TX.eRead;return}
 if(o.company&&o.company.current){for(var k in o.company.current){IXS.org[k]=o.company.current[k]||'';IXS.orgKnown[k]=true}}
 var it=null,list=o.files||[];
 for(var i=0;i<list.length;i++)if(list[i]&&list[i].id===e.id)it=list[i];
 if(!it&&list.length===1)it=list[0];
 if(!it){
  var code=o.error||'failed';
  if(IXC.isServiceDown(code,o._http)){ixServiceDown();ixToManual(e,'ixEService');return}
  e.status='failed';e.error=code;e.msg=TX[IXC.errKey(code,o._http)]||TX.ixEGeneric;return}
 if(it.ok===false){
  var c2=it.error||'unreadable';
  if(IXC.isServiceDown(c2)){ixServiceDown();ixToManual(e,'ixEService');return}
  if(c2==='unreadable'||c2==='no_text'||c2==='read_failed'||c2==='file_too_large_to_read'){ixToManual(e,IXC.errKey(c2));return}
  e.status='failed';e.error=c2;e.msg=TX[IXC.errKey(c2)]||TX.ixEGeneric;return}
 var m=IXC.fromServer(it);
 e.docType=m.docType;e.category=m.category;e.issueDate=m.issueDate;e.expiryDate=m.expiryDate;e.confidence=m.confidence;e.fields=m.fields;e.fieldConfidence=m.fieldConfidence;e.serverWarnings=m.serverWarnings;
 e.title=m.docTitle||(m.docType!=='other'?ixTypeName(m.docType):IXC.baseName(e.name));
 if(IXC.hasReading(e)){e.status='ready';e.msg=''}else ixToManual(e,'ixEUnread')}

// ----- القراءة ← المراجعة
function ixRecompute(){
 var S=IXS;IXC.reconcile(S.entries,S.org,ixToday());
 var changed=false;
 S.entries.forEach(function(e){if(e.dupOf&&!e.dupHandled){e.keep=false;e.dupHandled=true;changed=true}});
 if(changed)IXC.reconcile(S.entries,S.org,ixToday());
 S.entries.forEach(function(e){
  if(e.status==='failed')return;
  var t=String(e.title||'').trim().toLowerCase();
  if((state.docs||[]).some(function(d){return d.category===e.category&&String(d.title||'').trim().toLowerCase()===t&&t}))e.warnings.push({code:'new_version',field:''})});
 S.sugg=IXC.suggestCompany(S.entries)}
function ixGoReview(){var S=IXS;clearTimeout(S.advance);S.step='review';S.cancelAsk=false;S.msg='';ixRecompute();ixDraw()}

// ----- الرسم
var IXSTEP={reading:0,review:1,saving:2,result:2};
function ixDraw(){
 var S=IXS;if(!S)return;
 var box=S.box,old=box.querySelector('.ix-body'),sc=old?old.scrollTop:0;
 box.innerHTML='';
 var title=S.step==='reading'?TX.ixReadingTitle:S.step==='review'?TX.ixReviewTitle:S.step==='saving'?TX.ixSavingTitle:((S.result&&(S.result.failed.length||S.result.stopped))?TX.ixPartialTitle:TX.ixDoneTitle);
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
 return e.status==='queued'?TX.ixQueued:e.status==='reading'?TX.ixReadingNow:e.status==='ready'?TX.ixReady:e.status==='manual'?TX.ixManual:TX.ixFailed}
function ixRowIcon(s){return s==='ready'||s==='done'?'✓':s==='failed'?'!':s==='manual'?'↓':s==='queued'?'…':''}
function ixDrawReading(body,ft){
 var S=IXS,total=S.entries.length,done=S.entries.filter(function(e){return e.status!=='queued'&&e.status!=='reading'}).length;
 body.appendChild(h('p',{class:'ix-lead'},[TX.ixReadingLead]));
 ixBanners(body);
 var bar=h('div',{class:'bar'},[h('i',{})]);bar.firstChild.style.width=(total?Math.round(done/total*100):0)+'%';
 body.appendChild(h('div',{class:'ix-count','aria-live':'polite','data-ix-count':'1'},[h('span',{},[ixT('ixCount',{n:done,t:total})]),bar]));
 S.entries.forEach(function(e){
  var side=[];
  if(e.status==='failed'){
   if(e.error!=='bad_type'&&e.error!=='empty'&&e.error!=='too_large')side.push(h('button',{class:'btn ghost sm',type:'button',onclick:function(){e.status='queued';e.msg='';e.error='';ixDraw();ixPump()}},[TX.ixRetry]));
   side.push(h('button',{class:'btn danger sm',type:'button',onclick:function(){S.entries.splice(S.entries.indexOf(e),1);ixDraw();ixPump()}},[TX.ixRemove]))}
  var tt=[h('b',{},[e.name]),h('small',{},[ixSize(e.size)+' · '+ixRowState(e)])];
  if(e.msg)tt.push(h('small',{class:e.status==='failed'?'bad':'warn'},[e.msg]));
  S.rowOf=S.rowOf||{};
  body.appendChild(h('div',{class:'ix-row '+e.status,'data-ix-row':e.id,'data-state':e.status},[h('span',{class:'st','aria-hidden':'true'},[ixRowIcon(e.status)]),h('div',{class:'tt'},tt),h('div',{class:'side'},side)]))});
 var usable=S.entries.some(function(e){return e.status==='ready'||e.status==='manual'});
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
function ixWarnText(w){var c=w.code;
 if(c==='expired')return TX.ixWExpired;
 if(c==='expiring')return ixT('ixWExpiring',{n:w.days});
 if(c==='duplicate')return TX.ixWDup;
 if(c==='conflict')return ixT('ixWConflict',{f:ixFieldName(w.field)});
 if(c==='conflict_saved')return ixT('ixWConflictSaved',{f:ixFieldName(w.field)});
 if(c==='low_confidence')return TX.ixWLow;
 if(c==='bad_vat')return TX.ixWBadVat;
 if(c==='bad_cr')return TX.ixWBadCr;
 if(c==='unreadable')return TX.ixWUnread;
 if(c==='new_version')return TX.ixWNewVer;
 return ''}
function ixWarnCls(c){return (c==='expired'||c==='conflict'||c==='conflict_saved')?'bad':c==='new_version'?'mut':'warn'}
function ixCatOptions(cur){var opts=DOC_CATS.map(function(c){return h('option',{value:c[0]},[c[1]])});
 if(!DOC_CATS.some(function(c){return c[0]===cur}))opts.push(h('option',{value:cur},[cur]));return opts}
function ixAddrText(f){return [f.buildingNo,f.street,f.district,f.city,f.postalCode].filter(function(x){return x}).join('، ')}
function ixReadRows(e){
 var f=e.fields||{},rows=[];
 function row(lbl,val,key){if(val)rows.push([lbl,val,(e.fieldConfidence&&e.fieldConfidence[key])||e.confidence])}
 row(TX.company,f.companyNameAr,'companyNameAr');row(TX.nameEn,f.companyNameEn,'companyNameEn');row(TX.cr,f.crNumber,'crNumber');row(TX.ixFVat,f.vatNumber,'vatNumber');
 row(TX.dIssued,e.issueDate,'issueDate');row(TX.ixAddr,ixAddrText(f),'address');row(TX.ixContact,f.contactName,'contactName');row(TX.ixPhone,f.contactPhone,'contactPhone');
 return rows}
function ixFileCard(e){
 var S=IXS,off=e.keep===false;
 var card=h('div',{class:'ix-file'+(off?' off':''),'data-ix-file':e.id,'data-keep':off?'0':'1'});
 var typeName=e.status==='ready'?ixTypeName(e.docType):TX.ixTypeUnknown;
 card.appendChild(h('div',{class:'hd'},[h('span',{class:'ico','aria-hidden':'true'},[/^image\//.test(e.mime)?'🖼️':'📄']),h('div',{class:'tt'},[h('b',{},[e.name]),h('small',{},[ixSize(e.size)])])]));
 var chips=h('div',{class:'ix-chips'});
 chips.appendChild(h('span',{class:'pill','data-ix-type':'1'},[typeName]));
 if(e.status==='ready')chips.appendChild(h('span',{class:'pill '+ixConfCls(e.confidence),'data-ix-conf':e.confidence},[ixConfLbl(e.confidence)]));
 (e.warnings||[]).forEach(function(w){var t=ixWarnText(w);if(t)chips.appendChild(h('span',{class:'pill '+ixWarnCls(w.code),'data-ix-warn':w.code},[t]))});
 if(off)chips.appendChild(h('span',{class:'pill mut'},[TX.ixIgnored]));
 card.appendChild(chips);
 if(e.status==='manual')card.appendChild(h('p',{class:'ix-note'},[TX.ixUnreadNote+(e.msg&&e.msg!==TX.ixEUnread?' '+e.msg:'')]));
 if(!off){
  var title=h('input',{class:'inp',maxlength:'200',dir:'auto','aria-label':TX.dName,value:e.title||''});
  title.addEventListener('input',function(){e.title=title.value});
  var cat=h('select',{class:'inp','aria-label':TX.ixCatLbl},ixCatOptions(e.category));cat.value=e.category||'other';
  cat.addEventListener('change',function(){e.category=cat.value;ixRecompute();ixDraw()});
  var exp=h('input',{class:'inp',type:'date','aria-label':TX.dExp,value:e.expiryDate||''});
  exp.addEventListener('change',function(){e.expiryDate=exp.value;ixRecompute();ixDraw()});
  card.appendChild(h('div',{class:'ix-grid'},[h('div',{},[h('label',{},[TX.dName]),title]),h('div',{},[h('label',{},[TX.ixCatLbl]),cat]),h('div',{},[h('label',{},[TX.dExp]),exp])]));
  var rows=ixReadRows(e);
  if(rows.length){var rd=h('div',{class:'ix-read'},[h('h4',{},[TX.ixReadLbl])]);
   rows.forEach(function(r){rd.appendChild(h('div',{},[h('span',{},[r[0]]),h('b',{dir:'auto'},[r[1]]),h('i',{class:'ix-dot '+(r[2]==='high'?'hi':r[2]==='low'?'lo':'md'),title:ixConfLbl(r[2]),role:'img','aria-label':ixConfLbl(r[2])})]))});
   card.appendChild(rd)}}
 card.appendChild(h('div',{class:'ix-act'},[h('button',{class:'btn ghost sm',type:'button','data-ix-toggle':e.id,onclick:function(){e.keep=off;e.dupHandled=true;ixRecompute();ixDraw()}},[off?TX.ixRestore:TX.ixIgnore])]));
 return card}
function ixFailedRow(e){
 return h('div',{class:'ix-row failed','data-ix-row':e.id},[h('span',{class:'st'},['!']),h('div',{class:'tt'},[h('b',{},[e.name]),h('small',{class:'bad'},[e.msg||TX.ixEGeneric])]),h('div',{class:'side'},[h('button',{class:'btn danger sm',type:'button',onclick:function(){IXS.entries.splice(IXS.entries.indexOf(e),1);ixRecompute();ixDraw()}},[TX.ixRemove])])])}
// بطاقة «بيانات شركتك» المقترحة. القيمة المعروضة: ما عدّله العميل، وإلا المقترح من الملفات، وإلا المسجَّل.
function ixCoValue(k){var S=IXS;if(S.ctouched[k])return S.cedit[k];var s=S.sugg&&S.sugg[k];return s?s.value:(S.org[k]||'')}
function ixCoKnown(k){return k==='name_ar'||k==='name_en'||k==='cr_number'||!!IXS.orgKnown[k]||!!IXS.org[k]}
function ixFileNameOf(id){var e=IXS.entries.filter(function(x){return x.id===id})[0];return e?e.name:''}
function ixCoStatus(k,el){
 var S=IXS,v=String(ixCoValue(k)||'').trim(),cur=String(S.org[k]||'').trim(),s=S.sugg&&S.sugg[k];
 el.innerHTML='';el.className='';
 if(!v){if(!s){el.className='';el.appendChild(document.createTextNode(TX.ixNotFound))}return}
 if(cur&&IXC.exactSame(k,cur,v)){el.className='good';el.appendChild(document.createTextNode(TX.ixSame));return}
 if(cur&&ixCoKnown(k)){el.className='warn';el.appendChild(document.createTextNode(ixT('ixCurrent',{v:cur})+(s&&s.value===v?' · '+TX.ixReplaces:'')));return}
 if(s&&s.value===v){el.className='good';el.appendChild(document.createTextNode((ixCoKnown(k)?TX.ixFresh+' · ':'')+ixT('ixFrom',{f:ixFileNameOf(s.from)})))}}
function ixCompanyCard(){
 var S=IXS,sg=S.sugg||{};
 var card=h('div',{class:'ix-co','data-ix-company':'1'});
 card.appendChild(h('h3',{},['🏢 '+TX.ixCompanyTitle]));card.appendChild(h('p',{class:'ix-lead'},[TX.ixCompanyLead]));
 var rows=[['name_ar',TX.company,'auto'],['name_en',TX.nameEn,'auto'],['cr_number',TX.cr,'auto'],['vat_number',TX.ixFVat,'auto']];
 if(sg.city||S.org.city)rows.push(['city',TX.ixFCity,'auto']);
 rows.forEach(function(r){
  var k=r[0],fld=h('div',{class:'ix-fld','data-ix-fld':k});
  var inp=h('input',{class:'inp',dir:'auto',value:ixCoValue(k)||'','aria-label':r[1],'data-ix-co':k,autocomplete:'off',inputmode:(k==='cr_number'||k==='vat_number')?'numeric':'text'});
  var st=h('small',{});
  inp.addEventListener('input',function(){S.cedit[k]=inp.value;S.ctouched[k]=true;ixCoStatus(k,st)});
  fld.appendChild(h('label',{},[r[1]]));fld.appendChild(inp);fld.appendChild(st);ixCoStatus(k,st);
  var alts=(sg[k]&&sg[k].alts)||[];
  alts.forEach(function(a){fld.appendChild(h('div',{class:'alt'},[h('span',{},[ixT('ixAlt',{v:a.value})]),h('button',{type:'button',onclick:function(){S.cedit[k]=a.value;S.ctouched[k]=true;inp.value=a.value;ixCoStatus(k,st)}},[TX.ixUseAlt])]))});
  card.appendChild(fld)});
 return card}
function ixCompanyEdited(){var S=IXS,o={};IXC.COMPANY_FIELDS.forEach(function(k){o[k]=ixCoValue(k)});return o}
function ixCounts(){var S=IXS,c={t:S.entries.length,r:0,u:0,d:0,f:0};
 S.entries.forEach(function(e){if(e.status==='failed')c.f++;else if(e.dupOf)c.d++;else if(e.status==='manual')c.u++;else c.r++});return c}
function ixKept(){return IXS.entries.filter(function(e){return e.keep!==false&&e.status!=='failed'&&e.status!=='queued'&&e.status!=='reading'})}
function ixDrawReview(body,ft){
 var S=IXS;
 body.appendChild(h('p',{class:'ix-lead'},[TX.ixReviewLead]));
 ixBanners(body);
 var c=ixCounts();
 body.appendChild(h('div',{class:'ix-sum','data-ix-sum':'1'},[ixT('ixSummary',c)]));
 body.appendChild(ixCompanyCard());
 S.entries.forEach(function(e){body.appendChild(e.status==='failed'?ixFailedRow(e):ixFileCard(e))});
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

// ----- الاعتماد: حفظ ما أكّده العميل فقط، ملفاً ملفاً
function ixSave(){
 var S=IXS,plan=IXC.confirmPlan(S.entries,ixCompanyEdited(),S.org),hasCo=Object.keys(plan.company).length>0;
 if(!ixHasOrg()&&!(plan.company.name_ar||plan.company.name_en)){S.msg=TX.ixNeedName;ixDraw();return}
 if(!plan.files.length&&!hasCo){S.msg=TX.ixNothing;ixDraw();return}
 S.msg='';S.step='saving';S.plan=plan;S.save={files:{},co:hasCo?'queued':'none',stopped:false,errors:{}};
 plan.files.forEach(function(f){S.save.files[f.id]='queued'});
 ixDraw();ixSaveNext()}
function ixSaveNext(){
 var S=IXS;if(!S||S.cancelled)return;var sv=S.save;
 var f=null;for(var i=0;i<S.plan.files.length;i++)if(sv.files[S.plan.files[i].id]==='queued'){f=S.plan.files[i];break}
 var needCo=sv.co==='queued';
 if(sv.stopped||(!f&&!needCo)){ixFinish();return}
 if(f)sv.files[f.id]='saving';if(needCo)sv.co='saving';
 ixDraw();
 var e=f?S.entries.filter(function(x){return x.id===f.id})[0]:null;
 var ac=window.AbortController?new AbortController():null;if(ac)S.aborts.push(ac);
 var prep=e?ixB64(e.file).then(function(b64){var pf={};for(var k in f)pf[k]=f[k];pf.base64=b64;return [pf]}):Promise.resolve([]);
 prep.then(function(files){var p={files:files};if(needCo)p.company=S.plan.company;return ixApi('doc-intake-confirm',p,ac)},function(){return {ok:false,error:'read_local'}})
  .then(function(o){
   if(S.cancelled||IXS!==S)return;
   if(o.error==='unauthorized'||o.error==='no_session'){ixSessionEnd();return}
   var failCode=null;
   if(o.ok!==true)failCode=o.error||'failed';
   else if(f){var errs=o.errors||[];for(var j=0;j<errs.length;j++)if(errs[j]&&errs[j].id===f.id)failCode=errs[j].error||'failed'}
   if(f){if(failCode){sv.files[f.id]='failed';sv.errors[f.id]=failCode}else sv.files[f.id]='done'}
   if(needCo){var coBad=(o.ok!==true)||(o.company&&o.company.saved===false);sv.co=coBad?'failed':'done';if(coBad&&!f)sv.errors.company=failCode||'failed';
    if(!coBad&&o.company&&o.company.organization&&state.me){state.me.organization=Object.assign(state.me.organization||{},o.company.organization)}}
   ixSaveNext()})}
function ixFinish(){
 var S=IXS,sv=S.save,plan=S.plan,saved=[],failed=[];
 plan.files.forEach(function(f){var e=S.entries.filter(function(x){return x.id===f.id})[0];
  if(sv.files[f.id]==='done')saved.push({id:f.id,name:f.name,title:f.title,category:f.category,docType:f.docType});
  else if(sv.files[f.id]==='failed')failed.push({id:f.id,name:f.name,code:sv.errors[f.id]})});
 var changes=[];
 if(sv.co==='done'){for(var k in plan.diff)changes.push({field:k,from:plan.diff[k].from,to:plan.diff[k].to});
  var org=(state.me&&(state.me.organization=state.me.organization||{}))||{};for(var k2 in plan.diff)org[k2]=plan.diff[k2].to}
 S.result={saved:saved,failed:failed,changes:changes,companyFailed:sv.co==='failed',stopped:sv.stopped&&plan.files.some(function(f){return sv.files[f.id]==='queued'})};
 S.step='result';ixDraw();
 refreshMe().then(function(){return loadDocs()}).then(function(){if(IXS===S)S.org=ixOrg()})}
function ixDrawSaving(body,ft){
 var S=IXS,sv=S.save;
 body.appendChild(h('p',{class:'ix-lead'},[TX.ixSavingLead]));
 var total=S.plan.files.length+(sv.co==='none'?0:1),done=S.plan.files.filter(function(f){return sv.files[f.id]==='done'||sv.files[f.id]==='failed'}).length+((sv.co==='done'||sv.co==='failed')?1:0);
 var bar=h('div',{class:'bar'},[h('i',{})]);bar.firstChild.style.width=(total?Math.round(done/total*100):0)+'%';
 body.appendChild(h('div',{class:'ix-count','aria-live':'polite'},[h('span',{},[ixT('ixCount',{n:done,t:total})]),bar]));
 if(sv.co!=='none')body.appendChild(ixSaveRow('co',TX.ixSavingCompany,sv.co,Object.keys(S.plan.company).map(function(k){return ixFieldName(k)}).join('، ')));
 S.plan.files.forEach(function(f){body.appendChild(ixSaveRow(f.id,f.name,sv.files[f.id],(f.title||'')+' · '+catName(f.category)))});
 ft.appendChild(h('span',{class:'grow'}));
 var stop=h('button',{class:'btn ghost',type:'button','data-ix-stop':'1',onclick:function(){ixCancel()}},[TX.ixStop]);
 if(sv.stopped)stop.setAttribute('disabled','disabled');ft.appendChild(stop)}
function ixSaveRow(id,name,state2,sub){
 var label=state2==='done'?TX.ixSaved:state2==='saving'?TX.ixSavingNow:state2==='failed'?TX.ixFailed:TX.ixQueued;
 return h('div',{class:'ix-row '+(state2==='saving'?'saving':state2==='done'?'done':state2==='failed'?'failed':'queued'),'data-ix-save':id,'data-state':state2},[h('span',{class:'st','aria-hidden':'true'},[state2==='done'?'✓':state2==='failed'?'!':state2==='queued'?'…':'']),h('div',{class:'tt'},[h('b',{},[name]),h('small',{},[label+(sub?' · '+sub:'')])])])}
function ixDrawResult(body,ft){
 var S=IXS,r=S.result,part=r.failed.length>0||r.companyFailed||r.stopped;
 body.appendChild(h('div',{class:'ix-done','data-ix-result':part?'partial':'ok'},[h('div',{class:'big'+(part?' part':''),'aria-hidden':'true'},[part?'!':'✓']),h('h3',{},[part?TX.ixPartialTitle:TX.ixDoneTitle]),
  h('p',{},[r.saved.length?ixT('ixDoneFiles',{n:r.saved.length}):''])]));
 if(r.stopped)body.appendChild(h('div',{class:'ix-banner'},[TX.ixStopped]));
 if(r.failed.length)body.appendChild(h('div',{class:'ix-banner'},[ixT('ixPartial',{n:r.failed.length})]));
 if(r.saved.length){var ul=h('ul',{});r.saved.forEach(function(s){ul.appendChild(h('li',{},[h('span',{class:'pill ok'},[catName(s.category)]),h('b',{},[s.title||s.name]),h('small',{},[s.name])]))});
  body.appendChild(h('div',{class:'ix-res','data-ix-saved':'1'},[h('h4',{},['📁 '+TX.navDocs]),ul]))}
 var cb=h('div',{class:'ix-res','data-ix-changes':'1'},[h('h4',{},['🏢 '+(r.changes.length?TX.ixDoneCompany:TX.ixDoneNoCompany)])]);
 if(r.changes.length){var cu=h('ul',{});r.changes.forEach(function(c){cu.appendChild(h('li',{},[h('span',{},[ixFieldName(c.field)+':']),(c.from?h('s',{dir:'auto'},[c.from]):null),(c.from?h('span',{class:'arrow'},['←']):null),h('b',{dir:'auto'},[c.to])]))});cb.appendChild(cu)}
 if(r.companyFailed)cb.appendChild(h('p',{class:'err'},[TX.ixECompany]));
 body.appendChild(cb);
 if(r.failed.length){var fu=h('ul',{});r.failed.forEach(function(f){fu.appendChild(h('li',{},[h('b',{},[f.name]),h('small',{class:'err'},[TX[IXC.errKey(f.code)]||TX.ixESave])]))});body.appendChild(h('div',{class:'ix-res'},[fu]))}
 ft.appendChild(h('button',{class:'btn ghost',type:'button','data-ix-close':'1',onclick:function(){ixClose(true)}},[TX.ixClose]));
 if(r.failed.length||r.companyFailed){ft.appendChild(h('button',{class:'btn ghost',type:'button','data-ix-retry':'1',onclick:function(){ixRetrySave()}},[TX.ixRetrySave]))}
 ft.appendChild(h('span',{class:'grow'}));
 var coFirst=r.changes.length>0;
 ft.appendChild(h('button',{class:'btn'+(coFirst?'':' ghost'),type:'button','data-ix-open':'company',onclick:function(){ixClose(false);go('company')}},[TX.ixOpenCompany]));
 ft.appendChild(h('button',{class:'btn'+(coFirst?' ghost':''),type:'button','data-ix-open':'documents',onclick:function(){ixClose(false);go('documents')}},[TX.ixOpenVault]))}
function ixRetrySave(){
 var S=IXS,sv=S.save;S.plan.files.forEach(function(f){if(sv.files[f.id]==='failed'||(sv.stopped&&sv.files[f.id]==='queued'))sv.files[f.id]='queued'});
 if(sv.co==='failed')sv.co='queued';sv.stopped=false;sv.errors={};S.step='saving';ixDraw();ixSaveNext()}
`;
