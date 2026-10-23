// SHR-HR — لوحة التشغيل (المرحلة ٢). محلية، بيانات تجريبية فقط.
// تُعرض بقشرة SV1.shell() وتتكلم مع /api/shr وحده. وسم «بيانات تجريبية» ثابت
// في أعلى كل شاشة. لا شعار ولا ادعاء ترخيص أو امتثال.
//
// اللغات: العربية (الافتراضية، RTL) · English · Français · 中文 داخل الصفحة نفسها بلا مسارات جديدة. المحدد في شريط
// الترويسة، والاختيار يُحفظ في localStorage، ويضبط lang/dir على الجذر. كل النصوص تمرّ عبر
// simple-v1-shr-i18n.mjs (tr): الخادم يرجع أكواداً والواجهة تترجمها، وردود الـAPI لم تتغيّر.
//
// التسجيل: الصفحة لا تُولَّد حتى يضيف مالك generate.mjs سطراً
//   write("SHR-HR.html", buildShrOps(SV1, { lang: () => LANG }));
// ويضيف platform-engineer المسار /SHR-HR في vercel.json والخادم المحلي.

import { shrAtsClient, ATS_CSS } from "./simple-v1-shr-ats.mjs";
import { shrAgencyOpsClient, shrAgencyPortalClient, AGENCY_CSS, AGENCY_ERR } from "./simple-v1-shr-agency.mjs";
import { shrComplianceClient, COMPLIANCE_CSS, COMPLIANCE_ERR } from "./simple-v1-shr-compliance.mjs";
import { shrClientPortalClient, CLIENT_CSS, CLIENT_ERR } from "./simple-v1-shr-client.mjs";
import { shrPostsClient, POSTS_CSS, POSTS_ERR } from "./simple-v1-shr-posts.mjs";
import { shrI18nClient, DICT, I18N_CSS, langSwitcherHtml } from "./simple-v1-shr-i18n.mjs";

const BASE_CSS = `
.shr{--bad:#b42318;--badSoft:#fff0ef;--warnSoft:color-mix(in srgb,var(--warn) 9%,#fff);--hdr:72px;max-width:1240px;margin:0 auto;padding:16px 22px 64px;width:100%;flex:1;color:var(--t)}
.shr-demo{position:sticky;top:var(--hdr);z-index:6;background:var(--warnSoft);border:1px solid color-mix(in srgb,var(--warn) 45%,#fff);color:var(--warn);border-radius:10px;padding:7px 12px;font-weight:600;font-size:13px;margin-bottom:16px;text-align:center}
.shr-lay{display:grid;grid-template-columns:236px minmax(0,1fr);gap:28px;align-items:start}
.shr-side{position:sticky;top:calc(var(--hdr) + 64px);max-height:calc(100vh - var(--hdr) - 80px);overflow-y:auto;background:#fff;border:1px solid var(--l);border-radius:13px;box-shadow:var(--sh);padding:8px}
.shr-navtoggle{display:none;width:100%;align-items:center;justify-content:space-between;gap:10px;border:0;background:transparent;font:inherit;font-weight:500;font-size:14px;color:var(--ink);padding:10px 12px;cursor:pointer;border-radius:9px;min-height:44px}
.shr-navtoggle small{color:var(--mut);font-weight:400;font-size:12.5px}
.shr-tabs{display:flex;flex-direction:column;gap:2px}
.shr-grp-h{font-size:12px;color:var(--mut);font-weight:600;padding:10px 10px 3px}
.shr-grp-h:first-child{padding-top:6px}
.shr-tabs .shr-nav{display:block;width:100%;text-align:start;border:0;border-inline-start:3px solid transparent;background:transparent;border-radius:8px;padding:6px 10px;font:inherit;font-size:13.5px;color:var(--t);cursor:pointer;min-height:34px}
.shr-tabs .shr-nav:hover{background:var(--soft)}
.shr-tabs .shr-nav.on{background:var(--acSoft);color:var(--ink);font-weight:600;border-inline-start-color:var(--ac)}
.shr-who{border-top:1px solid var(--line2);margin-top:8px;padding:10px 6px 4px;font-size:12px;color:var(--mut);display:grid;gap:8px}
.shr-who b{display:block;color:var(--ink);font-weight:600;font-size:13px}
.shr-main{min-width:0}
.shr-crumb{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12.5px;color:var(--mut);margin-bottom:6px}
.shr-crumb i{font-style:normal;color:var(--faint)}
.shr h1{margin:0 0 4px;color:var(--ink);font-size:24px;font-weight:400;line-height:1.4}
.shr-sub{margin:0 0 18px;color:var(--mut);font-size:14px}
.shr-alert{border-radius:10px;padding:9px 12px;margin:0 0 14px;font-size:13.5px;border:1px solid}
.shr-alert.ok{background:var(--okSoft);color:var(--ok);border-color:color-mix(in srgb,var(--ok) 30%,#fff)}
.shr-alert.err{background:var(--badSoft);color:var(--bad);border-color:color-mix(in srgb,var(--bad) 30%,#fff)}
.shr-loading{display:flex;align-items:center;gap:10px;padding:26px 18px;color:var(--mut);border:1px dashed var(--acLine);border-radius:13px;background:var(--soft);font-size:14px}
.shr-spin{width:16px;height:16px;border:2px solid var(--acLine);border-top-color:var(--ac);border-radius:50%;animation:shrspin .8s linear infinite;flex:none}
@keyframes shrspin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.shr-spin{animation:none}}
.shr-empty{background:var(--soft);border:1px dashed var(--acLine);border-radius:13px;padding:22px 16px;text-align:center;color:var(--mut);font-size:13.5px}
.shr-empty b{display:block;color:var(--ink);font-size:15px;font-weight:500;margin-bottom:4px}
.shr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.shr-kpi{background:#fff;border:1px solid var(--l);border-radius:13px;padding:14px 16px;box-shadow:var(--sh)}
.shr-kpi b{display:block;font-family:var(--fm);font-size:27px;font-weight:400;color:var(--ink);line-height:1.3}
.shr-kpi span{color:var(--mut);font-size:13px}
.shr-kpi.hot{border-color:var(--warn);background:var(--warnSoft)}
.shr-card{background:#fff;border:1px solid var(--l);border-radius:13px;box-shadow:var(--sh);padding:16px 18px;margin-bottom:14px;overflow-x:auto}
.shr-card h2{margin:0 0 10px;color:var(--ink);font-size:15.5px;font-weight:500}
.shr h2{color:var(--ink);font-size:15.5px;font-weight:500}
.shr table{width:100%;border-collapse:collapse;font-size:13.5px}
.shr th,.shr td{padding:9px 10px;border-bottom:1px solid var(--line2);text-align:start;vertical-align:middle}
.shr th{font-size:12px;font-weight:500;color:var(--mut);background:var(--soft);white-space:nowrap}
.shr tbody tr:hover td,.shr tbody tr:hover th{background:var(--soft)}
.shr tbody tr:last-child td{border-bottom:0}
.shr .scroll{overflow-x:auto}
.shr .scroll table{min-width:680px}
.shr .scroll td:first-child{min-width:110px}
.shr table.wide{min-width:1120px}
.shr table.wide td{vertical-align:top}
.shr table.wide td:first-child{min-width:210px}
.shr table.wide td:nth-child(3){min-width:150px}
.shr table.wide td:nth-child(5){min-width:220px}
.shr .pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:500;background:var(--acSoft);color:var(--ac2);white-space:nowrap;line-height:1.7}
.shr .pill.ok{background:var(--okSoft);color:var(--ok)}.shr .pill.warn{background:var(--warnSoft);color:var(--warn)}.shr .pill.bad{background:var(--badSoft);color:var(--bad)}.shr .pill.mut{background:var(--soft);color:var(--mut)}
.shr .persp{display:inline-block;background:var(--acSoft);color:var(--ac2);border-radius:999px;padding:2px 12px;font-size:12px;font-weight:600;line-height:1.7}
.shr .persp.cl{background:var(--okSoft);color:var(--ok)}
.shr .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 14px;min-height:34px;border-radius:9px;font:inherit;font-weight:500;font-size:13px;border:1px solid var(--ac);background:var(--ac);color:#fff;cursor:pointer;line-height:1.2}
.shr .btn:hover{background:var(--ac2);border-color:var(--ac2)}
.shr .btn.ghost{background:#fff;color:var(--ink);border-color:var(--l)}
.shr .btn.ghost:hover{background:var(--soft)}
.shr .btn.sm{padding:4px 10px;min-height:28px;font-size:12px}
.shr .btn[disabled]{opacity:.5;cursor:not-allowed}
.shr .inp{border:1px solid var(--l);border-radius:9px;padding:8px 11px;font:inherit;font-size:13.5px;background:#fff;color:var(--t);min-width:0;min-height:38px}
.shr .inp:focus{border-color:var(--ac)}
.shr .inp.sm{padding:4px 8px;font-size:12.5px;min-height:30px}
.shr .frm{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.shr .frm .inp{flex:1 1 150px}
.shr .frm .inp[style*="width"]{flex:0 0 auto}
.shr .note{font-size:13px;color:var(--mut);margin:8px 0 0}
.shr .err{color:var(--bad);font-size:13.5px}.shr .okm{color:var(--ok);font-weight:600;font-size:13.5px}
.shr .gate{max-width:440px;margin:24px auto;background:#fff;border:1px solid var(--l);border-radius:15px;box-shadow:var(--sh2);padding:24px}
.shr .gate h1{font-size:20px}
.shr .modes{display:flex;gap:6px;margin-bottom:14px}
.shr .modes button{flex:1;border:1px solid var(--l);background:#fff;border-radius:9px;padding:8px 6px;font:inherit;font-weight:500;font-size:13px;cursor:pointer;color:var(--t);min-height:40px}
.shr .modes button.on{background:var(--ac);color:#fff;border-color:var(--ac)}
.shr .gate .frm .inp{flex:1 1 100%}
@media(max-width:860px){
.shr-side{max-height:none;overflow:visible}
.shr{padding:12px 16px 112px;--hdr:64px}  /* الهامش السفلي يترك زر الدعم العائم (من القشرة المشتركة) فوق آخر الصفحة لا فوق محتواها */
.shr-lay{grid-template-columns:minmax(0,1fr);gap:14px}
.shr-side{position:static;padding:4px}
.shr-navtoggle{display:flex}
.shr-side .shr-navbody{display:none}
.shr-side.open .shr-navbody{display:block}
.shr h1{font-size:21px}
.shr-card{padding:14px}
.shr .btn{min-height:40px}.shr .btn.sm{min-height:34px}
.shr .inp{min-height:42px}
.shr .modes{flex-direction:column}
}
.shr-crumb .cur{color:var(--ink);font-weight:500}
.shr .tl{margin:6px 0 0;padding:0;padding-inline-start:18px;font-size:13px;color:var(--t)}
`;

export function buildShrOps(sv1) {
  const CSS = `<style>
${BASE_CSS}
${ATS_CSS}
${AGENCY_CSS}
${COMPLIANCE_CSS}
${CLIENT_CSS}
${POSTS_CSS}
${I18N_CSS}
</style>`;
  // المحدد داخل شريط الحالة العلوي من الترويسة المشتركة؛ وإن تغيّر شكل الترويسة يسقط إلى سطر فوق المحتوى.
  const hdr = String(sv1.header("/SHR-HR", { cta: false, oneLang: true }));
  const barRe = /(<div class="sv1-bar-r">)([\s\S]*?)(<\/div>)/;
  const hdrLang = barRe.test(hdr) ? hdr.replace(barRe, (m, a, b, c) => a + b + langSwitcherHtml() + c) : hdr;
  const langBar = barRe.test(hdr) ? "" : `<div class="shr-langbar">${langSwitcherHtml()}</div>`;
  const body = `${hdrLang}<div class="shr">${langBar}<div class="shr-demo" role="note">بيانات تجريبية — لا عمال حقيقيون ولا ربط حكومي ولا رسائل</div><div id="app"><div class="shr-loading" role="status"><span class="shr-spin"></span>جارٍ التحميل…</div></div></div>`;
  const script = `<script>
(function(){
var app=document.getElementById('app');
var I=(${shrI18nClient.toString()})({dict:${JSON.stringify(DICT)},doc:document,win:window,app:app});
window.SHR_I18N=I;
var state={view:'dashboard',me:null,msg:'',err:''};
var WST={draft:'مسودة',pending_docs:'بانتظار المستندات',active:'نشط',archived:'مؤرشف'};
var RST={new:'جديد',in_review:'قيد المراجعة',waiting_client:'بانتظار العميل',in_progress:'قيد التنفيذ',done:'مكتمل',rejected:'مرفوض'};
var RKIND={new_hire:'توظيف جديد',termination:'إنهاء',transfer:'نقل',document:'مستند',other:'أخرى'};
var DOC={iqama:'الإقامة',medical_insurance:'التأمين الطبي'};
var MISS={identity:'الهوية',iqama:'مستند الإقامة',iqama_valid:'إقامة سارية',work_contract:'عقد العمل',establishment:'المنشأة والعميل'};
var ERR={unauthorized:'غير مصرّح',role_not_allowed:'الدور غير مسموح في هذه المرحلة',maker_checker:'من أدخل أو اقترح لا يعتمد — يعتمده مستخدم آخر',activation_blocked:'التفعيل مرفوض: ناقص',archived:'العامل مؤرشف',already_active:'العامل نشط أصلاً',terminal_state:'الطلب مغلق ولا يُعاد فتحه',shr_local_only:'النظام محلي فقط (LOCAL_DB=1)',not_found:'غير موجود',archive_only:'الحذف غير متاح — الأرشفة فقط',full_name_required:'الاسم مطلوب',bad_state:'حالة غير صالحة',bad_id_kind:'نوع الهوية غير صالح',no_consent:'لا موافقة سارية من المرشح',job_closed:'الوظيفة مغلقة',candidate_archived:'المرشح مؤرشف',duplicate_application:'للمرشح طلب على هذه الوظيفة أصلاً',same_stage:'الطلب في هذه المرحلة أصلاً',terminal_stage:'الطلب في مرحلة نهائية',offer_required:'التعيين يمرّ بمرحلة العرض أولاً',application_closed:'الطلب مغلق',bad_stage:'مرحلة غير معروفة',bad_time:'موعد غير صالح',bad_mode:'نوع المقابلة غير صالح',title_required:'العنوان مطلوب',bad_weights:'أوزان غير صالحة',interview_closed:'المقابلة منتهية',bad_residency_required:'شرط الإقامة غير صالح',bad_list:'القائمة غير صالحة'};
// النص يمرّ بـI.text (يُترجَم ويُحفظ أصله العربي لإعادة الترجمة عند تبديل اللغة بلا إعادة جلب)؛ و'data-raw' لمحتوى
// المستخدم (معاينة الإعلان بلغته هو لا بلغة الواجهة).
function h(tag,attrs,kids){var e=document.createElement(tag),raw=attrs&&attrs['data-raw'];if(attrs)for(var k in attrs){if(k==='data-raw')continue;if(k==='class')e.className=attrs[k];else if(k.indexOf('on')===0)e.addEventListener(k.slice(2),attrs[k]);else if(attrs[k]!=null)I.attr(e,k,attrs[k])}(kids||[]).forEach(function(c){if(c==null)return;e.appendChild(typeof c==='string'?(raw?document.createTextNode(c):I.text(c,tag)):c)});return e}
function call(action,data,get){
  var o=get?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{}))};
  var u='/api/shr'+(get?'?'+new URLSearchParams(Object.assign({action:action},data||{})).toString():'');
  return fetch(u,o).then(function(r){return r.json()})}
function errText(o){var t=ERR[o&&o.error]||(o&&o.error)||'تعذّر الاتصال';if(o&&o.missing)t+=' '+o.missing.map(function(m){return MISS[m]||m}).join('، ');return t}
function flash(ok,t){state.msg=ok?t:'';state.err=ok?'':t}
function pill(t,c){return h('span',{class:'pill '+(c||'')},[t])}
Object.assign(ERR,${JSON.stringify(AGENCY_ERR)});
Object.assign(ERR,${JSON.stringify(COMPLIANCE_ERR)});
Object.assign(ERR,${JSON.stringify(CLIENT_ERR)});
Object.assign(ERR,${JSON.stringify(POSTS_ERR)});
var GROUPS_OPS=[
 {t:'التشغيل',i:[['dashboard','اللوحة'],['workers','العمال'],['requests','الطلبات'],['expiring','الانتهاءات']]},
 {t:'التوظيف',i:[['jobs','الوظائف'],['posts','إعلانات الوظائف'],['board','المرشحون'],['match','المطابقة']]},
 {t:'مكاتب الاستقدام',i:[['agencies','المكاتب'],['orders','أوامر الاستقدام'],['subs','المرشحون المقدَّمون']]}];
var GROUP_CMP={t:'الامتثال',i:[['c_dash','لوحة الامتثال'],['c_viol','المخالفات'],['c_check','قوائم التحقق'],['c_alerts','التنبيهات'],['c_import','استيراد الملفات'],['c_a33','أسماء A33']]};
// صفحات فرعية تُضيء تبويب أمّها.
var ALIAS={candidate:'board',order_view:'orders',c_est:'c_dash'};
var DESC={dashboard:'أرقام سريعة عن العمال والطلبات والمستندات القريبة من الانتهاء.',
 workers:'أنشئ مسودة عامل وفعّلها بعد اكتمال الهوية والإقامة والعقد والمنشأة. الحذف أرشفة فقط.',
 requests:'طلبات العملاء الواردة. غيّر حالة الطلب مع تقدّم العمل عليه.',
 expiring:'الإقامات والتأمينات التي تنتهي خلال ٩٠ يوماً أو انتهت فعلاً.',
 jobs:'أنشئ وظيفة وحدّد شروطها الإلزامية، ثم شغّل المطابقة لها.',
 posts:'اكتب إعلان وظيفة وعاينه، ثم أرسله للاعتماد (يعتمده غيرك) فالنشر داخل صفحة SHR الخاصة. النشر العام قرار المالك ولم يُفعَّل.',
 board:'تابع المرشحين مرحلة بمرحلة، من «جديد» حتى «تعيين».',
 candidate:'بيانات المرشح وسجل موافقته وطلبات تقديمه ومقابلاته.',
 match:'اختر وظيفة لترى المرشحين مرتّبين بدرجة مشروحة لكل شرط.',
 agencies:'سجّل مكاتب الاستقدام واعتمدها. لا يدخل المكتب قبل الاعتماد.',
 orders:'أوامر استقدام لمكتب محدد أو مفتوحة لكل المكاتب المعتمدة.',
 order_view:'هذا ما يراه صاحب العمل عن الأمر. اسم المكتب لا يظهر له.',
 subs:'مرشحو المكاتب بالمواصفات فقط. راجعهم وحدّد مقابلاتهم.',
 c_dash:'حالة قيد المنشآت والتنبيهات الأهم في مكان واحد.',
 c_est:'حالة القيد واللقطات التاريخية والفحوص لهذه المنشأة.',
 c_viol:'سجّل المخالفات وتابع مواعيد الاعتراض التقديرية.',
 c_check:'قوائم الجاهزية بنداً بنداً، مع بيان ما لم يُؤكَّد من مصدره.',
 c_alerts:'مواعيد تقديرية وبيانات ناقصة ومنشآت محجوبة تحتاج انتباهك.',
 c_import:'ارفع دفعات التأمينات أو حماية الأجور؛ تُبصَّم الهوية وتُراجَع قبل التطبيق.',
 c_a33:'صنّف الأسماء الواردة في قوائم A33 ثم يعتمدها مستخدم آخر.'};
// مسؤول الامتثال لا يرى غير قسم الامتثال (الخادم يرفض ما سواه أصلاً).
function navGroups(){return state.me&&state.me.user&&state.me.user.role==='compliance_officer'?[GROUP_CMP]:GROUPS_OPS.concat([GROUP_CMP])}
// القشرة المشتركة لكل المنظورات: قائمة جانبية مجمّعة (تنطوي أعلى الصفحة في الجوال)، فتات خبز، عنوان، تعليمة، رسائل.
function layout(o){app.innerHTML='';
  var cur='';o.groups.forEach(function(g){g.i.forEach(function(n){if(n[0]===o.active)cur=n[1]})});
  var side=h('div',{class:'shr-side'+(state.navOpen?' open':'')});
  var tog=h('button',{class:'shr-navtoggle',type:'button','aria-expanded':state.navOpen?'true':'false',onclick:function(){state.navOpen=!state.navOpen;side.className='shr-side'+(state.navOpen?' open':'');tog.setAttribute('aria-expanded',state.navOpen?'true':'false')}},[h('span',{},['☰ القائمة']),h('small',{},[cur])]);
  var items=[];
  o.groups.forEach(function(g){items.push(h('div',{class:'shr-grp-h'},[g.t]));g.i.forEach(function(n){var on=n[0]===o.active;
    items.push(h('button',{class:'shr-nav'+(on?' on':''),type:'button','aria-current':on?'page':null,onclick:function(){state.view=n[0];state.msg='';state.err='';state.navOpen=false;render()}},[n[1]]))})});
  var tabs=h('div',{class:'shr-tabs',role:'navigation','aria-label':'التنقل بين الصفحات'},items);
  var who=h('div',{class:'shr-who'},[h('div',{},[h('b',{},[(o.who&&o.who[0])||'']),(o.who&&o.who[1])||'']),h('button',{class:'btn ghost sm',type:'button',onclick:function(){call('session-end').then(function(){state.me=null;state.navOpen=false;render()})}},['خروج'])]);
  side.appendChild(tog);side.appendChild(h('div',{class:'shr-navbody'},[tabs,who]));
  var cr=[];(o.crumbs||[]).forEach(function(c,i,a){if(i)cr.push(h('i',{'aria-hidden':'true'},['‹']));cr.push(h('span',{class:i===a.length-1?'cur':''},[c]))});
  if(o.chip)cr.push(h('span',{class:'persp '+(o.chipClass||''),style:'margin-inline-start:8px'},[o.chip]));
  var main=h('div',{class:'shr-main'},[h('div',{class:'shr-crumb'},cr),h('h1',{},[o.title]),o.sub?h('p',{class:'shr-sub'},[o.sub]):null]);
  if(state.msg)main.appendChild(h('div',{class:'shr-alert ok',role:'status'},[state.msg]));
  if(state.err)main.appendChild(h('div',{class:'shr-alert err',role:'alert'},[state.err]));
  main.appendChild(o.content);
  app.appendChild(h('div',{class:'shr-lay'},[side,main]))}
function empty(t,hint){return h('div',{class:'shr-empty'},[h('b',{},[t]),hint?hint:null])}
function loading(){return h('div',{class:'shr-loading',role:'status'},[h('span',{class:'shr-spin'}),'جارٍ التحميل…'])}
function opsMeta(){var a=ALIAS[state.view]||state.view,grp=null,lab='';navGroups().forEach(function(g){g.i.forEach(function(n){if(n[0]===a){grp=g;lab=n[1]}})});return {a:a,grp:grp,lab:lab}}
function frame(title,content){var m=opsMeta(),u=(state.me&&state.me.user)||{};
  layout({groups:navGroups(),active:m.a,title:title,sub:DESC[state.view]||'',crumbs:(m.grp?[m.grp.t,m.lab]:[]).concat(ALIAS[state.view]?[title]:[]),who:[u.name||'',(state.me&&state.me.tenant&&state.me.tenant.brand_ar)||''],content:content})}
function gate(first){app.innerHTML='';
  var mode=(state.gateMode||(/[?&]as=agency/.test(location.search)?'agency':/[?&]as=client/.test(location.search)?'client':'staff'));
  var msg=h('p',{class:'err',role:'alert'},[first||'']);
  var modes=h('div',{class:'modes'},[['staff','دخول المشغّل'],['agency','دخول مكتب استقدام'],['client','دخول عميل']].map(function(m){return h('button',{type:'button',class:mode===m[0]?'on':'',onclick:function(){state.gateMode=m[0];gate()}},[m[1]])}));
  var slug,email;
  if(mode==='client'){
    slug=h('select',{class:'inp'},[h('option',{value:'SHR'},['مستأجر SHR التجريبي']),h('option',{value:'OTHER'},['مستأجر وهمي آخر'])]);
    email=h('select',{class:'inp'},[h('option',{value:'a-admin@client.invalid'},['العميل أ — مدير (يقدّم طلبات)']),h('option',{value:'a-viewer@client.invalid'},['العميل أ — مطّلع (قراءة فقط)']),h('option',{value:'b-admin@client.invalid'},['العميل ب — مدير']),h('option',{value:'x-admin@client.invalid'},['عميل المستأجر الآخر — مدير (اختر المستأجر الآخر)'])]);
  } else if(mode==='agency'){
    slug=h('select',{class:'inp'},[h('option',{value:'SHR'},['مستأجر SHR التجريبي']),h('option',{value:'OTHER'},['مستأجر وهمي آخر'])]);
    email=h('select',{class:'inp'},[h('option',{value:'agency-a@shr.invalid'},['مكتب أ (معتمد)']),h('option',{value:'agency-b@shr.invalid'},['مكتب ب (معتمد)']),h('option',{value:'agency-c@shr.invalid'},['مكتب ج (قيد الاعتماد — يُرفض)']),h('option',{value:'agency-x@other.invalid'},['مكتب المستأجر الآخر (معتمد)'])]);
  } else {
    slug=h('select',{class:'inp'},[h('option',{value:'SHR'},['مستأجر SHR التجريبي']),h('option',{value:'OTHER'},['مستأجر وهمي آخر'])]);
    email=h('select',{class:'inp'},[h('option',{value:'owner@shr.invalid'},['مالك تجريبي (SHR)']),h('option',{value:'ops@shr.invalid'},['مشغّل تجريبي (SHR)']),h('option',{value:'compliance@shr.invalid'},['مسؤول امتثال تجريبي (SHR)']),h('option',{value:'owner@other.invalid'},['مالك وهمي (آخر)']),h('option',{value:'ops@other.invalid'},['مشغّل وهمي (آخر)']),h('option',{value:'compliance@other.invalid'},['مسؤول امتثال وهمي (آخر)'])]);
  }
  app.appendChild(h('div',{class:'gate'},[h('h1',{},[mode==='client'?'بوابة العميل — دخول تجريبي':mode==='agency'?'بوابة المكاتب — دخول تجريبي':'لوحة التشغيل — دخول تجريبي']),modes,h('p',{class:'note'},[mode==='client'?'دخول محلي ببيانات وهمية بدور عميل. العميل يرى عماله وعقوده وطلباته فقط.':mode==='agency'?'دخول محلي ببيانات وهمية بدور مكتب. المكتب لا يدخل قبل اعتماده.':'دخول محلي ببيانات وهمية. اختر مستأجراً ومستخدماً من نفس المستأجر.']),h('div',{class:'frm'},[slug,email]),h('div',{style:'margin-top:10px'},[h('button',{class:'btn',onclick:function(){call('session',{slug:slug.value,email:email.value}).then(function(o){if(o&&o.ok){state.me=o;state.view=o.user.role==='agency'?'a_orders':(o.user.role==='client_admin'||o.user.role==='client_viewer')?'cl_home':o.user.role==='compliance_officer'?'c_dash':'dashboard';render()}else I.put(msg,errText(o))})}},['دخول'])]),msg]))}
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
  frame('العمال',h('div',{},[add,rows.length?h('div',{class:'shr-card scroll'},[tb]):empty('لا عمال بعد','أنشئ مسودة من النموذج أعلاه.')]))})}
function vRequests(){return call('requests',null,true).then(function(o){var rows=o.requests||[];
  var tb=h('table',{},[h('thead',{},[h('tr',{},['العميل','النوع','الملاحظة','الحالة'].map(function(x){return h('th',{},[x])}))]),h('tbody',{},rows.map(function(r){
    var sel=h('select',{class:'inp',onchange:function(){call('request-state',{id:r.id,state:sel.value}).then(function(x){flash(x.ok,x.ok?'تغيّرت الحالة':errText(x));render()})}},Object.keys(RST).map(function(s){var op=h('option',{value:s},[RST[s]]);if(s===r.state)op.selected=true;return op}));
    return h('tr',{},[h('td',{},[r.client||'—']),h('td',{},[RKIND[r.kind]||r.kind]),h('td',{},[(r.body&&r.body.note)||'—']),h('td',{},[sel])])}))]);
  frame('الطلبات',rows.length?h('div',{class:'shr-card scroll'},[tb]):empty('لا طلبات من العملاء بعد','تظهر هنا طلبات العملاء فور إرسالها.'))})}
function vExpiring(){return call('expiring',{days:90},true).then(function(o){var rows=o.items||[];
  var tb=h('table',{},[h('thead',{},[h('tr',{},['العامل','المستند','ينتهي','المتبقي'].map(function(x){return h('th',{},[x])}))]),h('tbody',{},rows.map(function(i){return h('tr',{},[h('td',{},[i.worker]),h('td',{},[DOC[i.kind]||i.kind]),h('td',{},[i.expires_on]),h('td',{},[pill(i.expired?'منتهٍ':i.days_left+' يوماً',i.expired?'bad':i.days_left<=30?'warn':'')])])}))]);
  frame('انتهاء الإقامة والتأمين (٩٠ يوماً)',h('div',{class:'shr-card scroll'},[rows.length?tb:empty('لا شيء ينتهي في هذه المدة')]))})}
var ATS=(${shrAtsClient.toString()})({h:h,call:call,frame:frame,flash:flash,pill:pill,errText:errText,state:state,empty:empty,render:function(){render()},put:I.put,attr:I.attr});
var AGO=(${shrAgencyOpsClient.toString()})({h:h,call:call,frame:frame,flash:flash,pill:pill,errText:errText,state:state,empty:empty,render:function(){render()},put:I.put,attr:I.attr});
var POSTS=(${shrPostsClient.toString()})({h:h,call:call,frame:frame,flash:flash,pill:pill,errText:errText,state:state,empty:empty,render:function(){render()},put:I.put,attr:I.attr});
var CMP=(${shrComplianceClient.toString()})({h:h,call:call,frame:frame,flash:flash,pill:pill,errText:errText,state:state,empty:empty,render:function(){render()},put:I.put,attr:I.attr});
var CLP=(${shrClientPortalClient.toString()})({h:h,call:call,flash:flash,pill:pill,errText:errText,state:state,app:app,layout:layout,empty:empty,loading:loading,render:function(){render()}});
var AGP=(${shrAgencyPortalClient.toString()})({h:h,call:call,flash:flash,pill:pill,errText:errText,state:state,app:app,layout:layout,empty:empty,loading:loading,render:function(){render()}});
function role(){return state.me&&state.me.user&&state.me.user.role}
function isCl(){var r=role();return r==='client_admin'||r==='client_viewer'}
function isAg(){return role()==='agency'}
// يرسم الإطار بحسب منظور الجلسة (مشغّل/عميل/مكتب) لتظهر حالتا التحميل والخطأ بالهوية نفسها.
function paint(title,content){if(isCl())CLP._paint(title,content);else if(isAg())AGP._paint(title,content);else frame(title,content)}
function titleNow(){return isCl()?CLP._title():isAg()?AGP._title():opsMeta().lab}
function failed(){
  // جلسة منتهية ← الدخول. أي سبب آخر ← رسالة وزر إعادة المحاولة دون إخراج المستخدم.
  call('session',null,true).then(function(o){
    if(o&&o.ok){paint(titleNow(),h('div',{class:'shr-card'},[h('p',{class:'err',role:'alert'},['تعذّر تحميل هذه الصفحة. تحقق من الاتصال ثم أعد المحاولة.']),h('button',{class:'btn',type:'button',onclick:function(){render()}},['إعادة المحاولة'])]))}
    else{state.me=null;gate('انتهت الجلسة. سجّل الدخول من جديد.')}
  }).catch(function(){paint(titleNow(),h('div',{class:'shr-card'},[h('p',{class:'err',role:'alert'},['تعذّر الاتصال بالخادم.']),h('button',{class:'btn',type:'button',onclick:function(){render()}},['إعادة المحاولة'])]))})}
function render(){
  if(!state.me)return gate();
  // منظور المكتب والعميل مستقلان: لا وصول إلى شاشات المشغّل ولو عُدّلت state.view من الكونسول (الخادم يرفض أصلاً).
  var v=isCl()?(CLP[state.view]||CLP.cl_home):isAg()?(AGP[state.view]||AGP.a_orders):{dashboard:vDashboard,workers:vWorkers,requests:vRequests,expiring:vExpiring,jobs:ATS.jobs,posts:POSTS.posts,board:ATS.board,candidate:ATS.candidate,match:ATS.match,agencies:AGO.agencies,orders:AGO.orders,order_view:AGO.order_view,subs:AGO.subs,c_dash:CMP.c_dash,c_est:CMP.c_est,c_viol:CMP.c_viol,c_check:CMP.c_check,c_alerts:CMP.c_alerts,c_import:CMP.c_import,c_a33:CMP.c_a33}[state.view]||vDashboard;
  paint(titleNow(),loading());
  var p;try{p=v()}catch(e){p=Promise.reject(e)}
  p.catch(failed)}
I.init();
call('session',null,true).then(function(o){if(o&&o.ok){state.me=o;if(o.user&&o.user.role==='compliance_officer')state.view='c_dash';if(o.user&&(o.user.role==='client_admin'||o.user.role==='client_viewer'))state.view='cl_home';render()}else gate()}).catch(function(){gate()});
})();</script>`;
  return sv1.shell({ title: "لوحة التشغيل التجريبية", desc: "لوحة تشغيل تجريبية ببيانات وهمية", path: "/SHR-HR", body: CSS + body, script, noindex: true, oneLang: true });
}
