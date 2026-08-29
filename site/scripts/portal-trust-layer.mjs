import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

// -------------------------------------------------------------------------
// 1) Document AI privacy hardening.
// Sensitive content already lives server-side and is organization-scoped.
// The only browser-persisted item was the current request ref. Keep that ref
// tab/session scoped so it cannot survive for days or bleed into a later
// browser session. The server remains the source of truth and validates every
// ref against the signed-in organization before returning any data.
// -------------------------------------------------------------------------
let docPatched = 0;
for (const file of files.filter((f) => /(^|[\\/])ai-document-agent\.html$/.test(f))) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html
    .replace(/localStorage\.getItem\(['"]bp_da_ref['"]\)/g, "sessionStorage.getItem('bp_da_ref')")
    .replace(/localStorage\.setItem\(['"]bp_da_ref['"]\s*,\s*ref\)/g, "sessionStorage.setItem('bp_da_ref',ref)")
    .replace(/localStorage\.removeItem\(['"]bp_da_ref['"]\)/g, "sessionStorage.removeItem('bp_da_ref')");
  if (html !== before) {
    fs.writeFileSync(file, html);
    docPatched++;
  }
}

// -------------------------------------------------------------------------
// 2) Client Portal trust layer: transparent request journey + onboarding tour.
// This is deliberately educational/demo UI until every live operational
// request exposes the same fields from the backend. It never fabricates a live
// status: the example is visibly labelled as a demo.
// -------------------------------------------------------------------------
const CSS = `
<style id="bp-portal-trust-css">
.bp-request-demo{margin:0 0 16px;background:linear-gradient(135deg,#fff,#f7f9ff);border:1px solid #cfd9f2;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(11,27,90,.06)}
.bp-rd-head{padding:14px 16px;border-bottom:1px solid #e7ebf4;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bp-rd-demo{font-size:9px;font-weight:800;border-radius:99px;padding:3px 8px;background:#eef3ff;color:#0B1B5A}
.bp-rd-head strong{font-size:13px;color:#0B1B5A}.bp-rd-head .bp-rd-ministry{font-size:11px;color:#737b91}.bp-rd-head .bp-rd-status{margin-inline-start:auto;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:99px;padding:4px 9px;font-size:10px;font-weight:800}
.bp-rd-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#e9edf5;border-bottom:1px solid #e7ebf4}.bp-rd-kv{background:#fff;padding:12px 14px;min-width:0}.bp-rd-kv span{display:block;color:#8b92a6;font-size:9.5px;margin-bottom:3px}.bp-rd-kv b{display:block;font-size:11.5px;color:#27324a;overflow-wrap:anywhere}
.bp-rd-body{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;padding:15px}.bp-rd-box{background:#fff;border:1px solid #e6e9f1;border-radius:13px;padding:13px}.bp-rd-box h5{font-size:11px;color:#0B1B5A;margin:0 0 10px}.bp-rd-steps{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}.bp-rd-step{position:relative;text-align:center;font-size:8.5px;color:#9aa0b4;padding-top:24px;line-height:1.35}.bp-rd-step:before{content:'';position:absolute;top:6px;left:50%;width:10px;height:10px;border-radius:50%;background:#d8dce6;transform:translateX(-50%);z-index:2}.bp-rd-step:after{content:'';position:absolute;top:10px;right:50%;width:100%;height:2px;background:#e3e6ed;z-index:1}.bp-rd-step:last-child:after{display:none}.bp-rd-step.done{color:#166534}.bp-rd-step.done:before{background:#16a34a}.bp-rd-step.done:after{background:#86efac}.bp-rd-step.cur{font-weight:800;color:#92400e}.bp-rd-step.cur:before{background:#f59e0b;box-shadow:0 0 0 4px #fef3c7}
.bp-rd-doc{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f2f6;font-size:10.5px}.bp-rd-doc:last-of-type{border-bottom:0}.bp-rd-doc .state{margin-inline-start:auto;font-size:9px;border-radius:99px;padding:2px 7px}.bp-rd-doc .ok{background:#dcfce7;color:#166534}.bp-rd-doc .need{background:#fef3c7;color:#92400e}.bp-rd-upload{margin-top:10px;width:100%;border:0;border-radius:9px;padding:8px 10px;background:#0B1B5A;color:#fff;font-size:10.5px;font-weight:800;cursor:pointer}.bp-rd-foot{padding:9px 15px;border-top:1px solid #eef0f5;background:#fbfcff;color:#7b8295;font-size:9.5px;line-height:1.7}
#bpPortalTourBtn{border:1px solid #dce1ec;background:#fff;color:#0B1B5A;border-radius:9px;height:30px;padding:0 10px;font:700 10.5px inherit;cursor:pointer;white-space:nowrap}
.bp-tour-backdrop{position:fixed;inset:0;background:rgba(4,12,38,.48);z-index:9997}.bp-tour-target{position:relative!important;z-index:9999!important;outline:3px solid #7aa2ff!important;outline-offset:4px!important;box-shadow:0 0 0 7px rgba(122,162,255,.18)!important}.bp-tour-card{position:fixed;z-index:10000;width:min(330px,calc(100vw - 28px));background:#fff;border-radius:15px;border:1px solid #e1e5ef;box-shadow:0 22px 60px rgba(4,12,38,.28);padding:15px;color:#1f2937}.bp-tour-card .n{font-size:9px;color:#7d8498;font-weight:800;margin-bottom:5px}.bp-tour-card h3{margin:0 0 6px;font-size:14px;color:#0B1B5A}.bp-tour-card p{margin:0;color:#667085;font-size:11px;line-height:1.75}.bp-tour-actions{display:flex;align-items:center;gap:7px;margin-top:13px}.bp-tour-actions button{border:1px solid #dce1ec;background:#fff;color:#0B1B5A;border-radius:8px;padding:6px 10px;font:700 10.5px inherit;cursor:pointer}.bp-tour-actions .next{background:#0B1B5A;color:#fff;border-color:#0B1B5A;margin-inline-start:auto}.bp-tour-actions .skip{border:0;color:#7d8498;background:transparent;padding-inline:3px}
.bp-tour-toast{position:fixed;z-index:10010;left:50%;bottom:22px;transform:translateX(-50%);background:#101828;color:#fff;padding:9px 13px;border-radius:10px;font-size:10.5px;box-shadow:0 12px 32px rgba(0,0,0,.18)}
@media(max-width:850px){.bp-rd-grid{grid-template-columns:repeat(2,1fr)}.bp-rd-body{grid-template-columns:1fr}.bp-rd-steps{grid-template-columns:repeat(3,1fr)}.bp-rd-step:after{display:none}}
</style>`;

const SCRIPT = `
<script id="bp-portal-trust-js">
(function(){
  if(window.__bpPortalTrust)return; window.__bpPortalTrust=1;
  var ar=(document.documentElement.lang||'ar').toLowerCase().indexOf('ar')===0;
  var tx=ar?{
    demo:'مثال توضيحي',title:'كيف تظهر المعاملة للعميل',ministry:'وزارة الاستثمار',status:'مراجعة المستندات',
    next:'الإجراء التالي',nextv:'رفع القوائم المالية المدققة',assigned:'المسؤول',assignedv:'فريق العلاقات الحكومية',sla:'مدة الخدمة',slav:'يومان عمل',updated:'آخر تحديث',updatedv:'اليوم · 2:15 م',
    journey:'رحلة الطلب',docs:'مستندات هذا الطلب',upload:'ارفع المستند المطلوب',foot:'هذا مثال تعريفي فقط. الطلب الحقيقي يعرض بياناته الفعلية، الخطوات، المسؤول، SLA والمستندات الخاصة به.',
    steps:['تم الاستلام','المراجعة الأولية','مراجعة المستندات','التقديم','معالجة الجهة','مكتمل'],
    d1:'السجل التجاري',d2:'القوائم المالية المدققة',d3:'قرار الشركاء',ok:'مرفوع',need:'مطلوب',
    tour:'جولة سريعة',t1:'هذه مساحة عملك',p1:'من هنا تتابع كل شيء يخص منشأتك: الطلبات، المستندات، الموافقات، الفواتير والتنبيهات.',
    t2:'طلباتك ومعاملاتك',p2:'كل طلب له رقم مرجعي، حالة واضحة، خطوات تنفيذ، مسؤول، SLA وإجراء تالٍ.',
    t3:'المستندات الخاصة بك',p3:'ترفع ملفاتك داخل خزنة حسابك. المستندات لا تُعرض لعميل آخر وتُستخدم مع الطلب أو الوكيل المرتبط بها.',
    t4:'الموافقات',p4:'أي قرار يحتاج موافقتك يظهر هنا بدل الرسائل المتفرقة، مع سجل واضح للقرار.',
    t5:'الدعم والتذاكر',p5:'إذا احتجت تدخل بشري، افتح تذكرة مرتبطة بحسابك وطلبك؛ فريق العمليات يرد من نفس المسار.',
    nextb:'التالي',prev:'السابق',done:'إنهاء',skip:'تخطي',toast:'في الطلب الحقيقي سيُربط الملف مباشرة بالمعاملة.'
  }:{
    demo:'Demo example',title:'How a request appears to the client',ministry:'Ministry of Investment',status:'Document Review',next:'Next Action',nextv:'Upload audited financial statements',assigned:'Assigned',assignedv:'GR Operations',sla:'SLA',slav:'2 business days',updated:'Last update',updatedv:'Today · 2:15 PM',
    journey:'Request journey',docs:'Request documents',upload:'Upload required document',foot:'Demo only. A real request shows its actual status, steps, owner, SLA and documents.',steps:['Received','Initial review','Document review','Submission','Authority processing','Completed'],d1:'Commercial Registration',d2:'Audited financial statements',d3:'Partners resolution',ok:'Uploaded',need:'Required',
    tour:'Quick tour',t1:'Your workspace',p1:'Track everything for your company here: requests, documents, approvals, billing and alerts.',t2:'Your requests',p2:'Every request has a reference, clear status, execution steps, owner, SLA and next action.',t3:'Your private documents',p3:'Files live in your account vault and are used only with the request or agent they belong to.',t4:'Approvals',p4:'Any decision requiring you appears here with a clear audit trail.',t5:'Support',p5:'Open a ticket linked to your account and request whenever human help is needed.',nextb:'Next',prev:'Back',done:'Finish',skip:'Skip',toast:'In a live request the file is attached directly to that request.'
  };

  function demo(){
    var view=document.getElementById('view-orders'); if(!view||view.querySelector('.bp-request-demo'))return;
    var ph=view.querySelector('.pagehead'); if(!ph)return;
    var el=document.createElement('div'); el.className='bp-request-demo';
    el.innerHTML='<div class="bp-rd-head"><span class="bp-rd-demo">'+tx.demo+'</span><strong>#BP-12392 · '+tx.title+'</strong><span class="bp-rd-ministry">'+tx.ministry+'</span><span class="bp-rd-status">'+tx.status+'</span></div>'+
      '<div class="bp-rd-grid"><div class="bp-rd-kv"><span>'+tx.next+'</span><b>'+tx.nextv+'</b></div><div class="bp-rd-kv"><span>'+tx.assigned+'</span><b>'+tx.assignedv+'</b></div><div class="bp-rd-kv"><span>'+tx.sla+'</span><b>'+tx.slav+'</b></div><div class="bp-rd-kv"><span>'+tx.updated+'</span><b>'+tx.updatedv+'</b></div></div>'+
      '<div class="bp-rd-body"><div class="bp-rd-box"><h5>'+tx.journey+'</h5><div class="bp-rd-steps">'+tx.steps.map(function(s,i){return '<div class="bp-rd-step '+(i<2?'done':i===2?'cur':'')+'">'+s+'</div>'}).join('')+'</div></div>'+
      '<div class="bp-rd-box"><h5>'+tx.docs+'</h5><div class="bp-rd-doc"><span>✓</span><span>'+tx.d1+'</span><span class="state ok">'+tx.ok+'</span></div><div class="bp-rd-doc"><span>!</span><span>'+tx.d2+'</span><span class="state need">'+tx.need+'</span></div><div class="bp-rd-doc"><span>✓</span><span>'+tx.d3+'</span><span class="state ok">'+tx.ok+'</span></div><button type="button" class="bp-rd-upload">'+tx.upload+'</button></div></div><div class="bp-rd-foot">'+tx.foot+'</div>';
    ph.insertAdjacentElement('afterend',el);
    var ub=el.querySelector('.bp-rd-upload'); if(ub)ub.addEventListener('click',function(){var b=document.querySelector('.side nav button[data-v="documents"]'); if(b)b.click(); toast(tx.toast);});
  }

  function toast(s){var old=document.querySelector('.bp-tour-toast');if(old)old.remove();var d=document.createElement('div');d.className='bp-tour-toast';d.textContent=s;document.body.appendChild(d);setTimeout(function(){d.remove()},2600)}

  var steps=[
    {sel:'.topbar',title:tx.t1,p:tx.p1},
    {sel:'.side nav button[data-v="orders"]',title:tx.t2,p:tx.p2},
    {sel:'.side nav button[data-v="documents"]',title:tx.t3,p:tx.p3},
    {sel:'.side nav button[data-v="approvals"]',title:tx.t4,p:tx.p4},
    {sel:'.side nav button[data-v="tickets"]',title:tx.t5,p:tx.p5}
  ];
  var idx=0,back=null,card=null,target=null;
  function closeTour(mark){if(target)target.classList.remove('bp-tour-target');target=null;if(back)back.remove();if(card)card.remove();back=card=null;if(mark)try{sessionStorage.setItem('bp_portal_tour_seen','1')}catch(e){}}
  function place(){if(!target||!card)return;var r=target.getBoundingClientRect(),w=card.offsetWidth||320,h=card.offsetHeight||180,g=14;var top=r.bottom+g,left=Math.max(g,Math.min(innerWidth-w-g,r.left));if(top+h>innerHeight-g)top=Math.max(g,r.top-h-g);card.style.top=top+'px';card.style.left=left+'px'}
  function showStep(n){closeTour(false);idx=n;var st=steps[idx];target=document.querySelector(st.sel);if(!target){if(idx<steps.length-1)return showStep(idx+1);return closeTour(true)}target.classList.add('bp-tour-target');back=document.createElement('div');back.className='bp-tour-backdrop';document.body.appendChild(back);card=document.createElement('div');card.className='bp-tour-card';card.innerHTML='<div class="n">'+(idx+1)+' / '+steps.length+'</div><h3>'+st.title+'</h3><p>'+st.p+'</p><div class="bp-tour-actions"><button type="button" class="skip">'+tx.skip+'</button>'+(idx?'<button type="button" class="prev">'+tx.prev+'</button>':'')+'<button type="button" class="next">'+(idx===steps.length-1?tx.done:tx.nextb)+'</button></div>';document.body.appendChild(card);card.querySelector('.skip').onclick=function(){closeTour(true)};var pr=card.querySelector('.prev');if(pr)pr.onclick=function(){showStep(idx-1)};card.querySelector('.next').onclick=function(){if(idx===steps.length-1)closeTour(true);else showStep(idx+1)};place()}
  addEventListener('resize',place,{passive:true});addEventListener('scroll',place,{passive:true,capture:true});
  function addHelp(){var tb=document.querySelector('.topbar');if(!tb||document.getElementById('bpPortalTourBtn'))return;var b=document.createElement('button');b.type='button';b.id='bpPortalTourBtn';b.textContent='? '+tx.tour;b.onclick=function(){showStep(0)};tb.appendChild(b)}
  function ready(){demo();addHelp();var app=document.getElementById('app');if(!app||!app.classList.contains('on'))return;var seen='';try{seen=sessionStorage.getItem('bp_portal_tour_seen')||''}catch(e){}if(!seen)setTimeout(function(){showStep(0)},700)}
  var app=document.getElementById('app');if(app)new MutationObserver(ready).observe(app,{attributes:true,attributeFilter:['class']});setTimeout(ready,300);
})();
</script>`;

let portalPatched = 0;
for (const file of files.filter((f) => /(^|[\\/])account\.html$/.test(f))) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('bp-portal-trust-css')) html = html.replace('</head>', CSS + '</head>');
  if (!html.includes('bp-portal-trust-js')) html = html.replace('</body>', SCRIPT + '</body>');
  fs.writeFileSync(file, html);
  portalPatched++;
}

console.log(`Portal trust layer: ${portalPatched} account page(s), ${docPatched} Document AI page(s)`);
