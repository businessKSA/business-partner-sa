// قسم «Business Partner AI» في لوحة المالك /ops — يملك محتواه ومنطقه وكيل `ai-workspace`،
// ويملك `owner-ops` القشرة التي تحمله (الباب، الشريط الجانبي).
//
// يعرض للمالك أرقاماً لا محتوى (قرار المالك 2026-10-16): من اشترك وبأي باقة والتجديد،
// وحالة المساحة ورابطها، والمستخدمين والاستخدام حين يُبنى مسارهما على خادم المنصة.
// ومنه يسجّل المالك أن مساحةً جهزت برابطها حين يجهّزها الفريق يدوياً.
// الخلفية: POST /api/requests?__route=ai {action:"ops"|"ops-ready"} في api/_aiws.js.
//
// الناتج سكربتٌ يُحقن داخل سكربت /ops فيستعمل أدواته (h, state, go, render, money, when).
// لا شرطة مائلة عكسية ولا «${» داخل النص أدناه: يُحقن في قالب نصّي آخر.

export const OPS_AI_SCRIPT = `
var AIPLAN={individual:'فرد',business:'أعمال',business_plus:'أعمال بلس',enterprise:'مؤسسات'};
var AIWS_ST={needs_setup:['بانتظار بيانات العميل','warn'],provisioning:['قيد التجهيز','src'],ready:['جاهزة','ok']};
function aiOps(action,data){return fetch('/api/requests?__route=ai',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action,key:state.key},data||{}))}).then(function(r){return r.json()})}
function aiDayO(s){if(!s)return '—';var d=new Date(String(s).length===10?s+'T12:00:00Z':s);if(isNaN(d))return '—';return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn',{dateStyle:'medium',timeZone:'Asia/Riyadh'})}
function vAiws(m){m.appendChild(h('h1',{},['Business Partner AI — المشتركون']));
 var box=h('div',{},[h('p',{class:'note'},['جارٍ التحميل…'])]);m.appendChild(box);
 aiOps('ops').then(function(o){box.innerHTML='';
  if(!o||!o.ok){box.appendChild(h('div',{class:'card'},[h('p',{class:'err'},['تعذّر تحميل المشتركين.'])]));return}
  var t=o.totals||{};
  box.appendChild(h('div',{class:'kpis'},[[t.active,'اشتراكات نشطة','ok'],[money(t.mrr),'الإيراد الشهري المتكرر (قبل الضريبة)',''],[t.needs_setup,'بانتظار بيانات العميل',t.needs_setup?'hot':''],[t.provisioning,'قيد التجهيز',t.provisioning?'hot':''],[t.ready,'مساحات جاهزة','ok']].map(function(k){return h('div',{class:'kpi'+(k[2]?' '+k[2]:'')},[h('b',{style:typeof k[0]==='string'?'font-size:1.15rem':''},[String(k[0]==null?0:k[0])]),h('span',{},[k[1]])])})));
  var notes=['أرقام فقط: لا ترى هذه اللوحة محادثات العملاء ولا ملفاتهم ولا ما داخل مساحاتهم.'];
  if(o.usage_source!=='platform')notes.push('عدد المستخدمين والاستخدام يظهران هنا حين يُبنى مسار الأرقام على خادم المنصة.');
  if(t.renewal_due)notes.push(t.renewal_due+' اشتراك مستحق التجديد.');
  if(t.test)notes.push(t.test+' اشتراك بدفع تجريبي لا يدخل في الأرقام أعلاه.');
  box.appendChild(h('div',{class:'card'},notes.map(function(x){return h('p',{class:'note',style:'margin:2px 0'},[x])})));
  var rows=o.rows||[];
  if(!rows.length){box.appendChild(h('div',{class:'card'},[h('p',{class:'note'},['لا مشتركين بعد.'])]));return}
  box.appendChild(h('div',{class:'list'},rows.map(aiRow)));
 }).catch(function(){box.innerHTML='';box.appendChild(h('p',{class:'err'},['تعذّر الاتصال']))})}
function aiRow(r){var st=AIWS_ST[r.ws_status]||[r.ws_status,'mut'];
 var users=(r.users==null?'—':String(r.users))+(r.seats!=null?' من '+r.seats:'');
 var card=h('div',{class:'card ai-op'},[
  h('div',{class:'ai-op-hd'},[h('div',{class:'tt'},[h('b',{},[r.company||'—']),h('small',{},[(r.email||'')+' · '+r.ref+(r.payments>1?' · الدفعات: '+r.payments:'')])]),
   h('div',{class:'ai-op-pills'},[h('span',{class:'pill'},['باقة '+(AIPLAN[r.plan]||r.plan)]),h('span',{class:'pill '+st[1]},[st[0]]),r.state==='renewal_due'?h('span',{class:'pill bad'},['مستحق التجديد']):null,r.test?h('span',{class:'pill mut'},['تجريبي']):null])]),
  h('div',{class:'ai-op-grid'},[['الشراء',aiDayO(r.paid_at)],['التجديد',aiDayO(r.renews_at)],['المبلغ الشهري',r.amount==null?'—':money(r.amount)],['المستخدمون',users],['الاستهلاك هذا الشهر',r.spent_sar==null?'—':money(r.spent_sar)],['آخر نشاط',r.last_active?aiDayO(r.last_active):'—']].map(function(k){return h('div',{},[h('small',{},[k[0]]),h('b',{},[k[1]])])}))]);
 if(r.url)card.appendChild(h('div',{class:'ai-op-link'},[h('code',{dir:'ltr'},[r.url.replace('https://','')]),h('a',{class:'btn ghost sm',href:r.url,target:'_blank',rel:'noopener'},['فتح الرابط'])]));
 if(r.ws_status==='provisioning'){var u=h('input',{class:'inp',dir:'ltr',value:r.slug?'https://'+r.slug+'.businesspartner.sa':'https://'});var e=h('div',{class:'err'});
  var b=h('button',{class:'btn sm',onclick:function(){e.textContent='';b.disabled=true;aiOps('ops-ready',{ref:r.ref,url:u.value.trim()}).then(function(x){b.disabled=false;if(x&&x.ok){state.flash='سُجّلت المساحة جاهزة، وظهر رابطها للعميل في لوحته.';render();return}e.textContent=x&&x.error==='invalid_fields'?'الرابط يجب أن يكون على businesspartner.sa وبـ https.':'تعذّر الحفظ.'}).catch(function(){b.disabled=false;e.textContent='تعذّر الاتصال'})}},['سجّل أن المساحة جاهزة']);
  card.appendChild(h('div',{class:'ai-op-ready'},[h('small',{},['جهّزها الفريق؟ سجّل رابطها فيظهر للعميل:']),h('div',{class:'ai-op-readyrow'},[u,b]),e]))}
 card.appendChild(h('div',{style:'margin-top:8px'},[h('a',{class:'btn ghost sm',onclick:function(){go('request',r.ref)}},['طلب الشراء'])]));
 return card}
`;

export const OPS_AI_CSS = `
.ai-op-hd{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.ai-op-hd .tt b{display:block;color:#0B1B5A;font-size:.98rem;font-weight:600}.ai-op-hd .tt small{color:#5f6880;font-size:.76rem}
.ai-op-pills{display:flex;gap:6px;flex-wrap:wrap}
.ai-op-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:12px}
.ai-op-grid div{background:#f7f8fc;border:1px solid #e4e8f1;border-radius:10px;padding:8px 10px}
.ai-op-grid small{display:block;color:#5f6880;font-size:.72rem}.ai-op-grid b{font-size:.9rem;color:#0B1B5A;font-weight:600}
.ai-op-link{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
.ai-op-link code{background:#f4f6fb;border:1px solid #e4e8f1;border-radius:8px;padding:5px 10px;font-size:.84rem}
.ai-op-ready{margin-top:10px;border-top:1px dashed #e4e8f1;padding-top:10px}.ai-op-ready small{color:#5f6880;font-size:.78rem}
.ai-op-readyrow{display:flex;gap:8px;margin-top:6px}.ai-op-readyrow .inp{flex:1;min-width:0;margin:0}
@media(max-width:900px){.ai-op-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-op-readyrow{flex-direction:column}}
`;
