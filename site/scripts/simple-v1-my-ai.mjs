// قسم «Business Partner AI» داخل لوحة العميل /my — يملك محتواه ومنطقه وكيل
// `ai-workspace`، ويملك `client-portal` القشرة التي تحمله (الجلسة والشريط الجانبي).
//
// يعرض للعميل المشترك: باقته وحالتها وتجديدها وعدد مستخدميها ورصيدها، وحالة مساحته
// (بانتظار بياناتك ← قيد التجهيز ← جاهزة برابطها)، ونموذج بيانات المساحة: اسم المنشأة،
// رابطها «اسم-العميل.businesspartner.sa» (قرار المالك 2026-10-16)، لونها، شعارها، ومديروها.
// الخلفية: GET/POST /api/requests?__route=ai (action my / setup) في api/_aiws.js.
//
// الناتج سكربتٌ يُحقن داخل سكربت /my نفسه فيستعمل أدواته (h, state, go, when, money).
// لا شرطة مائلة عكسية ولا «${» داخل النص أدناه: يُحقن في قالب نصّي آخر.

import { AI_TEXT } from "./simple-v1-ai.mjs";

const IDX = { ar: 0, en: 1, fr: 2, zh: 3 };

const T = {
  nav: ["Business Partner AI", "Business Partner AI", "Business Partner AI", "Business Partner AI"],
  subTitle: ["اشتراكك", "Your subscription", "Votre abonnement", "您的订阅"],
  plan: ["الباقة", "Plan", "Offre", "套餐"],
  active: ["نشط", "Active", "Actif", "有效"],
  renewalDue: ["مستحق التجديد", "Renewal due", "Renouvellement dû", "待续订"],
  test: ["دفع تجريبي", "Test payment", "Paiement test", "测试付款"],
  paidAt: ["تاريخ الشراء", "Purchased", "Acheté le", "购买日期"],
  renewsAt: ["التجديد", "Renews", "Renouvellement", "续订日期"],
  seats: ["المستخدمون في الباقة", "Users in plan", "Utilisateurs inclus", "套餐用户数"],
  credit: ["رصيد الاستخدام الشهري", "Monthly usage credit", "Crédit d'usage mensuel", "每月使用额度"],
  sar: ["ريال", "SAR", "SAR", "里亚尔"],
  wsTitle: ["مساحتك", "Your workspace", "Votre espace", "您的工作区"],
  st1: ["بياناتك", "Your details", "Vos informations", "您的信息"],
  st2: ["التجهيز", "Setup", "Préparation", "准备中"],
  st3: ["جاهزة", "Ready", "Prêt", "就绪"],
  needs: ["أكمل بيانات المساحة أدناه لنبدأ تجهيزها.", "Fill in your workspace details below so we can set it up.", "Complétez les informations ci-dessous pour que nous préparions votre espace.", "请填写下方工作区信息，以便我们开始准备。"],
  prov: ["وصلتنا بياناتك ونجهّز مساحتك الآن. يظهر رابطها هنا حين تجهز، ونرسله إلى بريدك.", "We have your details and are setting up your workspace. Its link will appear here when it is ready, and we will email it to you.", "Nous avons vos informations et préparons votre espace. Son lien apparaîtra ici et vous sera envoyé par e-mail.", "我们已收到您的信息，正在准备工作区。就绪后链接将显示在此处，并发送到您的邮箱。"],
  ready: ["مساحتك جاهزة.", "Your workspace is ready.", "Votre espace est prêt.", "您的工作区已就绪。"],
  open: ["افتح مساحتك", "Open your workspace", "Ouvrir votre espace", "打开工作区"],
  formTitle: ["بيانات المساحة", "Workspace details", "Informations de l'espace", "工作区信息"],
  company: ["اسم المنشأة كما يظهر في المساحة", "Company name as shown in the workspace", "Nom de l'entreprise affiché dans l'espace", "工作区中显示的公司名称"],
  slug: ["رابط مساحتك", "Your workspace link", "Lien de votre espace", "工作区链接"],
  slugNote: ["حروف إنجليزية صغيرة وأرقام وشرطة، من ٣ إلى ٣٠ حرفاً. لا يتغيّر بعد أن تجهز المساحة.", "Lowercase English letters, digits and hyphens, 3 to 30 characters. It cannot change once the workspace is ready.", "Lettres minuscules, chiffres et tirets, de 3 à 30 caractères. Il ne change plus une fois l'espace prêt.", "小写英文字母、数字和连字符，3 至 30 个字符。工作区就绪后不可更改。"],
  color: ["لون العلامة", "Brand colour", "Couleur de la marque", "品牌颜色"],
  logo: ["الشعار", "Logo", "Logo", "标志"],
  logoNote: ["PNG أو JPG أو WEBP، حتى ٣٠٠ كيلوبايت.", "PNG, JPG or WEBP, up to 300 KB.", "PNG, JPG ou WEBP, 300 Ko max.", "PNG、JPG 或 WEBP，不超过 300 KB。"],
  logoPick: ["اختر الشعار", "Choose logo", "Choisir le logo", "选择标志"],
  admins: ["بريد مدير المساحة", "Workspace admin email", "E-mail de l'administrateur", "工作区管理员邮箱"],
  adminsNote: ["بريد واحد أو أكثر، يفصل بينها فاصلة. يسجّل بقية فريقك في المساحة ببريد نطاق منشأتك.", "One or more emails, separated by commas. The rest of your team signs up in the workspace with your company domain email.", "Un ou plusieurs e-mails séparés par des virgules. Le reste de l'équipe s'inscrit avec l'e-mail du domaine de l'entreprise.", "一个或多个邮箱，用逗号分隔。团队其他成员使用公司域名邮箱在工作区注册。"],
  save: ["احفظ وأرسل للتجهيز", "Save and send for setup", "Enregistrer et envoyer", "保存并提交准备"],
  update: ["حدّث البيانات", "Update details", "Mettre à jour", "更新信息"],
  saving: ["جارٍ الحفظ…", "Saving…", "Enregistrement…", "正在保存…"],
  saved: ["حُفظت بياناتك وأُرسلت لفريق التجهيز.", "Saved and sent to the setup team.", "Enregistré et transmis à l'équipe.", "已保存并发送给准备团队。"],
  eCompany: ["اكتب اسم المنشأة.", "Enter the company name.", "Saisissez le nom de l'entreprise.", "请输入公司名称。"],
  eSlug: ["الرابط غير صالح أو محجوز.", "This link is not valid or is reserved.", "Ce lien n'est pas valide ou est réservé.", "该链接无效或已被保留。"],
  eTaken: ["هذا الرابط مأخوذ، اختر غيره.", "This link is taken, choose another.", "Ce lien est déjà pris.", "该链接已被占用，请另选。"],
  eLocked: ["لا يتغيّر الرابط بعد أن تجهز المساحة.", "The link cannot change once the workspace is ready.", "Le lien ne change plus une fois l'espace prêt.", "工作区就绪后链接不可更改。"],
  eAdmins: ["اكتب بريداً صحيحاً للمدير.", "Enter a valid admin email.", "Saisissez un e-mail valide.", "请输入有效的管理员邮箱。"],
  eLogo: ["الشعار يجب أن يكون PNG أو JPG أو WEBP وحتى ٣٠٠ كيلوبايت.", "The logo must be PNG, JPG or WEBP and up to 300 KB.", "Le logo doit être PNG, JPG ou WEBP, 300 Ko max.", "标志须为 PNG、JPG 或 WEBP，且不超过 300 KB。"],
  eGeneric: ["تعذّر الحفظ، حاول مرة أخرى.", "Could not save, please try again.", "Échec de l'enregistrement, réessayez.", "保存失败，请重试。"],
  none: ["لا يوجد اشتراك في Business Partner AI على حسابك.", "There is no Business Partner AI subscription on your account.", "Aucun abonnement Business Partner AI sur votre compte.", "您的账户没有 Business Partner AI 订阅。"],
  choose: ["اختر باقتك", "Choose your plan", "Choisir votre offre", "选择套餐"],
  loading: ["جارٍ التحميل…", "Loading…", "Chargement…", "正在加载…"],
};

export function myAiScript(lang, aiHref) {
  const i = IDX[lang] != null ? IDX[lang] : 1;
  const tx = {};
  for (const k of Object.keys(T)) tx[k] = T[k][i];
  const pn = {};
  for (const k of ["individual", "business", "business_plus", "enterprise"]) pn[k] = AI_TEXT["pn_" + k][i];
  return `
var AITX=${JSON.stringify(tx)},AIPN=${JSON.stringify(pn)},AIHREF=${JSON.stringify(aiHref)};
function aiGet(){return fetch('/api/requests?__route=ai&action=my&lang='+LANG,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).catch(function(){return null})}
function aiLoad(){return aiGet().then(function(o){state.aiws=o&&o.ok?o:{subscriptions:[]};return state.aiws})}
function aiHas(){return !!(state.aiws&&state.aiws.subscriptions&&state.aiws.subscriptions.length)}
function aiDay(s){if(!s)return '';var d=new Date(String(s).length===10?s+'T12:00:00Z':s);if(isNaN(d))return '';try{return d.toLocaleDateString(LANG==='ar'?'ar-SA-u-ca-gregory-nu-latn':LANG==='zh'?'zh-CN':LANG,{dateStyle:'medium',timeZone:'Asia/Riyadh'})}catch(e){return String(s).slice(0,10)}}
function aiKv(k,v){return h('div',{class:'ai-kv'},[h('small',{},[k]),h('b',{},[v])])}
function viewAi(m){m.appendChild(h('h1',{},[AITX.nav]));
 if(!state.aiws){m.appendChild(h('p',{class:'note'},[AITX.loading]));aiLoad().then(function(){if(state.view==='ai')render()});return}
 if(!aiHas()){m.appendChild(h('div',{class:'card'},[h('p',{},[AITX.none]),h('a',{class:'btn',href:AIHREF},[AITX.choose])]));return}
 var o=state.aiws,s=o.subscriptions[0],ws=o.workspace||{},pl=o.plan||{};
 var sc=h('div',{class:'card'},[h('h2',{},[AITX.subTitle])]);
 var pills=h('div',{class:'ai-pills'},[h('span',{class:'pill '+(s.state==='active'?'ok':'warn')},[s.state==='active'?AITX.active:AITX.renewalDue])]);
 if(s.test)pills.appendChild(h('span',{class:'pill mut'},[AITX.test]));sc.appendChild(pills);
 var g=h('div',{class:'ai-grid'},[aiKv(AITX.plan,AIPN[s.plan]||s.plan),aiKv(AITX.paidAt,aiDay(s.paid_at)),aiKv(AITX.renewsAt,aiDay(s.renews_at))]);
 if(pl.seats!=null)g.appendChild(aiKv(AITX.seats,String(pl.seats)));
 if(pl.credit_sar!=null)g.appendChild(aiKv(AITX.credit,pl.credit_sar+' '+AITX.sar));
 sc.appendChild(g);m.appendChild(sc);
 var st=ws.status||'needs_setup',n=st==='ready'?3:st==='provisioning'?2:1;
 var wc=h('div',{class:'card'},[h('h2',{},[AITX.wsTitle])]);
 wc.appendChild(h('ol',{class:'ai-steps'},[[AITX.st1,1],[AITX.st2,2],[AITX.st3,3]].map(function(x){return h('li',{class:x[1]<n?'done':x[1]===n?'on':''},[h('i',{},[x[1]<n?'✓':String(x[1])]),h('span',{},[x[0]])])})));
 if(st==='ready'){wc.appendChild(h('p',{class:'ok'},[AITX.ready]));if(ws.url)wc.appendChild(h('div',{class:'ai-link'},[h('code',{dir:'ltr'},[ws.url.replace('https://','')]),h('a',{class:'btn',href:ws.url,target:'_blank',rel:'noopener'},[AITX.open])]))}
 else wc.appendChild(h('p',{class:'note'},[st==='provisioning'?AITX.prov:AITX.needs]));
 m.appendChild(wc);m.appendChild(aiForm(ws));
}
function aiForm(ws){var org=state.me.organization||{};
 var f=h('div',{class:'card'},[h('h2',{},[AITX.formTitle])]);var box=h('div',{class:'form'});
 var co=h('input',{class:'inp',maxlength:'120',value:ws.company||org.name_ar||org.name_en||''});
 var sl=h('input',{class:'inp ai-slug',dir:'ltr',maxlength:'30',autocomplete:'off',spellcheck:'false',placeholder:'your-company',value:ws.slug||''});
 if(ws.status==='ready'&&ws.slug)sl.setAttribute('readonly','readonly');
 sl.addEventListener('input',function(){var v=sl.value.toLowerCase().replace(/[^a-z0-9-]/g,'');if(v!==sl.value)sl.value=v});
 var col=h('input',{class:'ai-color',type:'color',value:ws.color||'#0b1b5a'});
 var file=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp',hidden:'hidden'});
 var prev=h('div',{class:'ai-logo'});if(ws.logo_url)prev.appendChild(h('img',{src:ws.logo_url,alt:''}));
 var picked=null;
 file.addEventListener('change',function(){var x=file.files&&file.files[0];err.textContent='';if(!x)return;
  if(['image/png','image/jpeg','image/webp'].indexOf(x.type)<0||x.size>307200){err.textContent=AITX.eLogo;file.value='';return}
  var fr=new FileReader();fr.onload=function(){var d=String(fr.result||'');picked={mime:x.type,b64:d.slice(d.indexOf(',')+1)};prev.innerHTML='';prev.appendChild(h('img',{src:d,alt:''}))};fr.readAsDataURL(x)});
 var ad=h('textarea',{class:'inp',dir:'ltr',rows:'2'});ad.value=(ws.admins&&ws.admins.length?ws.admins:[state.me.user.email||'']).join(', ');
 var err=h('div',{class:'err'}),okm=h('div',{class:'ok'});
 box.appendChild(h('label',{},[AITX.company]));box.appendChild(co);
 box.appendChild(h('label',{},[AITX.slug]));box.appendChild(h('div',{class:'ai-slugrow',dir:'ltr'},[h('span',{},['https://']),sl,h('span',{},['.businesspartner.sa'])]));box.appendChild(h('p',{class:'note'},[AITX.slugNote]));
 box.appendChild(h('div',{class:'ai-brand'},[h('div',{},[h('label',{},[AITX.color]),col]),h('div',{},[h('label',{},[AITX.logo]),h('div',{class:'ai-logorow'},[prev,h('button',{class:'btn ghost sm',type:'button',onclick:function(){file.click()}},[AITX.logoPick])]),h('p',{class:'note'},[AITX.logoNote])])]));box.appendChild(file);
 box.appendChild(h('label',{},[AITX.admins]));box.appendChild(ad);box.appendChild(h('p',{class:'note'},[AITX.adminsNote]));
 var btn=h('button',{class:'btn',onclick:function(){err.textContent='';okm.textContent='';var old=btn.textContent;btn.disabled=true;btn.textContent=AITX.saving;
  var body={action:'setup',lang:LANG,company:co.value,slug:sl.value,color:col.value,admins:ad.value};if(picked)body.logo=picked;
  fetch('/api/requests?__route=ai',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(o){btn.disabled=false;btn.textContent=old;
   if(o&&o.ok){okm.textContent=AITX.saved;state.aiws=null;setTimeout(function(){if(state.view==='ai')render()},1200);return}
   var e=(o&&o.error)||'',fl=(o&&o.fields)||[];
   err.textContent=e==='slug_taken'?AITX.eTaken:e==='slug_locked'?AITX.eLocked:fl.indexOf('company')>=0?AITX.eCompany:fl.indexOf('slug')>=0?AITX.eSlug:fl.indexOf('admins')>=0?AITX.eAdmins:(fl.indexOf('logo_type')>=0||fl.indexOf('logo_size')>=0)?AITX.eLogo:AITX.eGeneric})
  .catch(function(){btn.disabled=false;btn.textContent=old;err.textContent=AITX.eGeneric})}},[ws.status&&ws.status!=='needs_setup'?AITX.update:AITX.save]);
 box.appendChild(h('div',{},[btn]));box.appendChild(err);box.appendChild(okm);f.appendChild(box);return f}
`;
}

export const MY_AI_CSS = `
.ai-pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.ai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.ai-kv{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fafbff}
.ai-kv small{display:block;color:#5f6880;font-size:.76rem;margin-bottom:3px}.ai-kv b{font-size:.98rem}
.ai-steps{list-style:none;display:flex;gap:8px;padding:0;margin:4px 0 12px;flex-wrap:wrap}
.ai-steps li{display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:#eef0f5;color:#5f6880;font-weight:700;font-size:.84rem}
.ai-steps li i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#fff;font-size:.72rem}
.ai-steps li.on{background:var(--n);color:#fff}.ai-steps li.on i{color:var(--n)}
.ai-steps li.done{background:#eaf7ef;color:#118657}
.ai-link{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
.ai-link .btn,.ai-link .btn:visited{color:#fff}
.ai-link code{background:#f4f6fb;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:.88rem;word-break:break-all}
.ai-slugrow{display:flex;align-items:stretch;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;max-width:100%}
.ai-slugrow span{display:flex;align-items:center;padding:0 10px;background:#f4f6fb;color:#5f6880;font-size:.85rem;white-space:nowrap}
.ai-slugrow .ai-slug{border:0;border-radius:0;flex:1;min-width:0;margin:0}
.ai-brand{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start;margin-top:6px}
.ai-color{width:56px;height:40px;border:1px solid var(--line);border-radius:10px;padding:2px;background:#fff;cursor:pointer}
.ai-logorow{display:flex;gap:10px;align-items:center}
.ai-logo{width:64px;height:64px;border:1px dashed #c7cfe2;border-radius:12px;display:grid;place-items:center;overflow:hidden;background:#fff;flex:none}
.ai-logo img{max-width:100%;max-height:100%;object-fit:contain}
@media(max-width:560px){.ai-brand{grid-template-columns:1fr}.ai-link{flex-direction:column;align-items:stretch}.ai-link .btn{width:100%}.ai-slugrow span{padding:0 6px;font-size:.78rem}}
`;
