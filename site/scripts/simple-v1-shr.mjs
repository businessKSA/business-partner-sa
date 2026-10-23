// SHR-HR — لوحة التشغيل (المرحلة ٢). محلية، بيانات تجريبية فقط.
// تُعرض بقشرة SV1.shell() وتتكلم مع /api/shr وحده. وسم «بيانات تجريبية» ثابت
// في أعلى كل شاشة. لا شعار ولا ادعاء ترخيص أو امتثال.
//
// التسجيل: الصفحة لا تُولَّد حتى يضيف مالك generate.mjs سطراً
//   write("SHR-HR.html", buildShrOps(SV1, { lang: () => LANG }));
// ويضيف platform-engineer المسار /SHR-HR في vercel.json والخادم المحلي.

import { shrAtsClient, ATS_CSS } from "./simple-v1-shr-ats.mjs";

export function buildShrOps(sv1) {
  const CSS = `<style>
.shr{max-width:1100px;margin:0 auto;padding:18px 16px 60px;color:#1F2430}
.shr-demo{position:sticky;top:0;z-index:5;background:#fff3e6;border:1px solid #f59e0b;color:#92400e;border-radius:10px;padding:8px 12px;font-weight:800;font-size:.85rem;margin-bottom:14px;text-align:center}
.shr h1{margin:0 0 12px;color:#0B1B5A;font-size:1.35rem;font-weight:400}
.shr-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.shr-tabs button{border:1px solid #e4e8f1;background:#fff;border-radius:999px;padding:7px 14px;font-weight:700;font-size:.84rem;cursor:pointer;color:#2c3550}
.shr-tabs button.on{background:#0B1B5A;color:#fff;border-color:#0B1B5A}
.shr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.shr-kpi{background:#fff;border:1px solid #e4e8f1;border-radius:14px;padding:12px}
.shr-kpi b{display:block;font-size:1.7rem;color:#0B1B5A;line-height:1.1;font-weight:500}
.shr-kpi span{color:#5f6880;font-size:.8rem}
.shr-kpi.hot{border-color:#f59e0b;background:#fffbeb}
.shr-card{background:#fff;border:1px solid #e4e8f1;border-radius:14px;padding:14px;margin-bottom:12px}
.shr-card h2{margin:0 0 10px;color:#0B1B5A;font-size:1rem;font-weight:500}
.shr table{width:100%;border-collapse:collapse;font-size:.86rem}
.shr th,.shr td{padding:8px 6px;border-bottom:1px solid #e4e8f1;text-align:start;vertical-align:middle}
.shr .pill{display:inline-block;border-radius:999px;padding:3px 9px;font-size:.72rem;font-weight:700;background:#eef2ff;color:#2b56c3;white-space:nowrap}
.shr .pill.ok{background:#eaf7ef;color:#118657}.shr .pill.warn{background:#fff3e6;color:#b45309}.shr .pill.bad{background:#fee2e2;color:#b91c1c}.shr .pill.mut{background:#eef0f5;color:#5f6880}
.shr .btn{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;font-weight:700;font-size:.8rem;border:1px solid #0B1B5A;background:#0B1B5A;color:#fff;cursor:pointer}
.shr .btn.ghost{background:#fff;color:#0B1B5A}.shr .btn[disabled]{opacity:.5}
.shr .inp{border:1px solid #e4e8f1;border-radius:9px;padding:8px 10px;font:inherit;background:#fff;min-width:0}
.shr .frm{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.shr .note{font-size:.8rem;color:#5f6880}.shr .err{color:#b91c1c;font-size:.84rem}.shr .okm{color:#118657;font-weight:700;font-size:.84rem}
.shr .gate{max-width:420px;margin:30px auto;background:#fff;border:1px solid #e4e8f1;border-radius:16px;padding:22px}
.shr .scroll{overflow-x:auto}
${ATS_CSS}
</style>`;
  const body = `${sv1.header("/SHR-HR", { cta: false, oneLang: true })}<div class="shr"><div class="shr-demo">بيانات تجريبية — لا عمال حقيقيون ولا ربط حكومي ولا رسائل</div><div id="app"></div></div>`;
  const script = `<script>
(function(){
var app=document.getElementById('app');
var state={view:'dashboard',me:null,msg:'',err:''};
var WST={draft:'مسودة',pending_docs:'بانتظار المستندات',active:'نشط',archived:'مؤرشف'};
var RST={new:'جديد',in_review:'قيد المراجعة',waiting_client:'بانتظار العميل',in_progress:'قيد التنفيذ',done:'مكتمل',rejected:'مرفوض'};
var RKIND={new_hire:'توظيف جديد',termination:'إنهاء',transfer:'نقل',document:'مستند',other:'أخرى'};
var DOC={iqama:'الإقامة',medical_insurance:'التأمين الطبي'};
var MISS={identity:'الهوية',iqama:'مستند الإقامة',iqama_valid:'إقامة سارية',work_contract:'عقد العمل',establishment:'المنشأة والعميل'};
var ERR={unauthorized:'غير مصرّح',role_not_allowed:'الدور غير مسموح في هذه المرحلة',maker_checker:'من أدخل أو اقترح لا يعتمد — يعتمده مستخدم آخر',activation_blocked:'التفعيل مرفوض: ناقص',archived:'العامل مؤرشف',already_active:'العامل نشط أصلاً',terminal_state:'الطلب مغلق ولا يُعاد فتحه',shr_local_only:'النظام محلي فقط (LOCAL_DB=1)',not_found:'غير موجود',archive_only:'الحذف غير متاح — الأرشفة فقط',full_name_required:'الاسم مطلوب',bad_state:'حالة غير صالحة',bad_id_kind:'نوع الهوية غير صالح',no_consent:'لا موافقة سارية من المرشح',job_closed:'الوظيفة مغلقة',candidate_archived:'المرشح مؤرشف',duplicate_application:'للمرشح طلب على هذه الوظيفة أصلاً',same_stage:'الطلب في هذه المرحلة أصلاً',terminal_stage:'الطلب في مرحلة نهائية',offer_required:'التعيين يمرّ بمرحلة العرض أولاً',application_closed:'الطلب مغلق',bad_stage:'مرحلة غير معروفة',bad_time:'موعد غير صالح',bad_mode:'نوع المقابلة غير صالح',title_required:'العنوان مطلوب',bad_weights:'أوزان غير صالحة',interview_closed:'المقابلة منتهية',bad_residency_required:'شرط الإقامة غير صالح',bad_list:'القائمة غير صالحة'};
function h(tag,attrs,kids){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==='class')e.className=attrs[k];else if(k.indexOf('on')===0)e.addEventListener(k.slice(2),attrs[k]);else if(attrs[k]!=null)e.setAttribute(k,attrs[k])}(kids||[]).forEach(function(c){if(c==null)return;e.appendChild(typeof c==='string'?document.createTextNode(c):c)});return e}
function call(action,data,get){
  var o=get?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{}))};
  var u='/api/shr'+(get?'?'+new URLSearchParams(Object.assign({action:action},data||{})).toString():'');
  return fetch(u,o).then(function(r){return r.json()})}
function errText(o){var t=ERR[o&&o.error]||(o&&o.error)||'تعذّر الاتصال';if(o&&o.missing)t+=' '+o.missing.map(function(m){return MISS[m]||m}).join('، ');return t}
function flash(ok,t){state.msg=ok?t:'';state.err=ok?'':t}
function pill(t,c){return h('span',{class:'pill '+(c||'')},[t])}
var NAV=[['dashboard','اللوحة'],['workers','العمال'],['requests','الطلبات'],['expiring','الانتهاءات'],['jobs','الوظائف'],['board','المرشحون'],['match','المطابقة']];
function frame(title,content){app.innerHTML='';
  var tabs=h('div',{class:'shr-tabs'},NAV.map(function(n){return h('button',{class:(state.view===n[0]||(state.view==='candidate'&&n[0]==='board'))?'on':'',onclick:function(){state.view=n[0];state.msg='';state.err='';render()}},[n[1]])}).concat([h('button',{onclick:function(){call('session-end').then(function(){state.me=null;render()})}},['خروج'])]));
  app.appendChild(h('h1',{},[title+(state.me?' — '+state.me.tenant.brand_ar:'')]));
  app.appendChild(tabs);
  if(state.msg)app.appendChild(h('p',{class:'okm'},[state.msg]));
  if(state.err)app.appendChild(h('p',{class:'err'},[state.err]));
  app.appendChild(content)}
function gate(){app.innerHTML='';
  var slug=h('select',{class:'inp'},[h('option',{value:'SHR'},['مستأجر SHR التجريبي']),h('option',{value:'OTHER'},['مستأجر وهمي آخر'])]);
  var email=h('select',{class:'inp'},[h('option',{value:'owner@shr.invalid'},['مالك تجريبي (SHR)']),h('option',{value:'ops@shr.invalid'},['مشغّل تجريبي (SHR)']),h('option',{value:'owner@other.invalid'},['مالك وهمي (آخر)']),h('option',{value:'ops@other.invalid'},['مشغّل وهمي (آخر)'])]);
  var msg=h('p',{class:'err'});
  app.appendChild(h('div',{class:'gate'},[h('h1',{},['لوحة التشغيل — دخول تجريبي']),h('p',{class:'note'},['دخول محلي ببيانات وهمية. اختر مستأجراً ومستخدماً من نفس المستأجر.']),h('div',{class:'frm'},[slug,email]),h('div',{style:'margin-top:10px'},[h('button',{class:'btn',onclick:function(){call('session',{slug:slug.value,email:email.value}).then(function(o){if(o&&o.ok){state.me=o;state.view='dashboard';render()}else msg.textContent=errText(o)})}},['دخول'])]),msg]))}
function vDashboard(){return call('dashboard',null,true).then(function(o){var c=o.counts||{};
  var K=[['workers','عمال (غير مؤرشفين)',''],['clients','عملاء نشطون',''],['open_requests','طلبات مفتوحة',c.open_requests?'hot':''],['docs_expiring_60d','مستندات تنتهي خلال 60 يوماً',c.docs_expiring_60d?'hot':''],['docs_expired','مستندات منتهية',c.docs_expired?'hot':'']];
  frame('اللوحة',h('div',{},[h('div',{class:'shr-kpis'},K.map(function(k){return h('div',{class:'shr-kpi '+k[2]},[h('b',{},[String(c[k[0]]||0)]),h('span',{},[k[1]])])})),h('p',{class:'note'},['نشط: '+(c.workers_active||0)+' · مسودة أو بانتظار المستندات: '+(c.workers_draft||0)])]))})}
function vWorkers(){return call('workers',null,true).then(function(o){var rows=o.workers||[];
  var nm=h('input',{class:'inp',placeholder:'اسم العامل (وهمي)'}),pr=h('input',{class:'inp',placeholder:'المهنة'}),na=h('input',{class:'inp',placeholder:'الجنسية'});
  var add=h('div',{class:'shr-card'},[h('h2',{},['مسودة عامل جديد']),h('div',{class:'frm'},[nm,pr,na,h('button',{class:'btn',onclick:function(){call('worker-create',{full_name:nm.value,profession:pr.value,nationality:na.value}).then(function(r){flash(r.ok,r.ok?'أُنشئت مسودة — لا تفعيل بلا مستندات':errText(r));render()})}},['إنشاء مسودة'])]),h('p',{class:'note'},['المسودة لا تُفعَّل إلا بعد اكتمال الهوية والإقامة والعقد والمنشأة، ويعتمدها مستخدم غير من أدخلها.'])]);
  var tb=h('table',{},[h('thead',{},[h('tr',{},['الاسم','المهنة','الجنسية','الحالة',''].map(function(x){return h('th',{},[x])}))]),h('tbody',{},rows.map(function(w){
    var acts=[];
    if(w.status==='draft'||w.status==='pending_docs')acts.push(h('button',{class:'btn sm',onclick:function(){call('worker-activate',{id:w.id}).then(function(r){flash(r.ok,r.ok?'فُعّل العامل':errText(r));render()})}},['تفعيل']));
    if(w.status!=='archived')acts.push(h('button',{class:'btn ghost sm',onclick:function(){call('worker-archive',{id:w.id}).then(function(r){flash(r.ok,r.ok?'أُرشف':errText(r));render()})}},['أرشفة']));
    return h('tr',{},[h('td',{},[w.full_name]),h('td',{},[w.profession||'—']),h('td',{},[w.nationality||'—']),h('td',{},[pill(WST[w.status]||w.status,w.status==='active'?'ok':w.status==='archived'?'mut':'warn')]),h('td',{},[h('div',{class:'frm'},acts)])])}))]);
  frame('العمال',h('div',{},[add,h('div',{class:'shr-card scroll'},[tb])]))})}
function vRequests(){return call('requests',null,true).then(function(o){var rows=o.requests||[];
  var tb=h('table',{},[h('thead',{},[h('tr',{},['العميل','النوع','الملاحظة','الحالة'].map(function(x){return h('th',{},[x])}))]),h('tbody',{},rows.map(function(r){
    var sel=h('select',{class:'inp',onchange:function(){call('request-state',{id:r.id,state:sel.value}).then(function(x){flash(x.ok,x.ok?'تغيّرت الحالة':errText(x));render()})}},Object.keys(RST).map(function(s){var op=h('option',{value:s},[RST[s]]);if(s===r.state)op.selected=true;return op}));
    return h('tr',{},[h('td',{},[r.client||'—']),h('td',{},[RKIND[r.kind]||r.kind]),h('td',{},[(r.body&&r.body.note)||'—']),h('td',{},[sel])])}))]);
  frame('الطلبات',h('div',{class:'shr-card scroll'},[tb]))})}
function vExpiring(){return call('expiring',{days:90},true).then(function(o){var rows=o.items||[];
  var tb=h('table',{},[h('thead',{},[h('tr',{},['العامل','المستند','ينتهي','المتبقي'].map(function(x){return h('th',{},[x])}))]),h('tbody',{},rows.map(function(i){return h('tr',{},[h('td',{},[i.worker]),h('td',{},[DOC[i.kind]||i.kind]),h('td',{},[i.expires_on]),h('td',{},[pill(i.expired?'منتهٍ':i.days_left+' يوماً',i.expired?'bad':i.days_left<=30?'warn':'')])])}))]);
  frame('انتهاء الإقامة والتأمين (٩٠ يوماً)',h('div',{class:'shr-card scroll'},[rows.length?tb:h('p',{class:'note'},['لا شيء ينتهي في هذه المدة.'])]))})}
var ATS=(${shrAtsClient.toString()})({h:h,call:call,frame:frame,flash:flash,pill:pill,errText:errText,state:state,render:function(){render()}});
function render(){
  if(!state.me)return gate();
  var v={dashboard:vDashboard,workers:vWorkers,requests:vRequests,expiring:vExpiring,jobs:ATS.jobs,board:ATS.board,candidate:ATS.candidate,match:ATS.match}[state.view];
  v().catch(function(){state.me=null;gate()})}
call('session',null,true).then(function(o){if(o&&o.ok){state.me=o;render()}else gate()}).catch(function(){gate()});
})();</script>`;
  return sv1.shell({ title: "لوحة التشغيل التجريبية", desc: "لوحة تشغيل تجريبية ببيانات وهمية", path: "/SHR-HR", body: CSS + body, script, noindex: true, oneLang: true });
}
