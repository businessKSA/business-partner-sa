// Business Partner — «مشخّص الخدمة» on every service page (2026-09).
//
// A short guided assistant injected into each /services/<sku> page: it asks
// three or four quick questions with tappable answers, then shows the customer
// what they asked for, where it stands, and one clear next step — send the
// written request on WhatsApp, start it on the site, or call.
//
// WHY a post-build layer and not generate.mjs: the questions are derived from
// the catalogue row (category + government platform), so one file covers all
// 140 services × 4 languages without touching the 12,500-line generator.
//
// Content rules this file obeys (CLAUDE.md):
//   · no invented prices and no invented government facts — the widget never
//     states a fee, a duration or an eligibility rule, only what the customer
//     told it and which step comes next;
//   · violations wording stays «مراجعة / دراسة الأهلية / تجهيز / تقديم /
//     متابعة» — no promise that anything gets cancelled;
//   · the in-page WhatsApp button is the owner's explicit instruction of
//     2026-09-04 for this assistant; the floating-button-only rule still
//     applies to the rest of the page content.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/site.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const BY_CODE = new Map((catalog.services || []).map((s) => [String(s.code || "").toUpperCase(), s]));

const WA = String(site.whatsappSupport || site.whatsapp || "https://wa.me/966530540231").replace(/\/+$/, "");
const TEL = String((site.contact && site.contact.phone) || "0530540231").replace(/\s/g, "");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------- wording --
// Four languages; the pages exist in ar/en/fr/zh only.
const L = {
  title: {
    ar: "مشخّص الخدمة الذكي", en: "Smart service check",
    fr: "Diagnostic intelligent du service", zh: "智能服务诊断",
  },
  intro: {
    ar: "أجب عن أسئلة قصيرة تحدّد حالتك، ونجهّز لك ملخّص الطلب وخطوته التالية — ثم أرسله لنا على واتساب أو ابدأه من الموقع. بلا تسجيل.",
    en: "Answer a few short questions. We prepare a summary of your request and its next step — then send it on WhatsApp or start it on the site. No sign-up.",
    fr: "Répondez à quelques questions courtes. Nous préparons le résumé de votre demande et l'étape suivante — envoyez-le sur WhatsApp ou démarrez sur le site. Sans inscription.",
    zh: "回答几个简短问题，我们为您整理申请摘要与下一步 — 然后通过 WhatsApp 发送，或直接在网站开始。无需注册。",
  },
  yourRequest: { ar: "طلبك", en: "Your request", fr: "Votre demande", zh: "您的申请" },
  authority: { ar: "الجهة / المنصة", en: "Authority / platform", fr: "Autorité / plateforme", zh: "机构 / 平台" },
  nextStep: { ar: "الخطوة التالية", en: "Next step", fr: "Étape suivante", zh: "下一步" },
  waBtn: { ar: "أرسل طلبي على واتساب", en: "Send my request on WhatsApp", fr: "Envoyer ma demande sur WhatsApp", zh: "通过 WhatsApp 发送申请" },
  siteBtn: { ar: "ابدأ الطلب في الموقع", en: "Start the request on the site", fr: "Démarrer la demande sur le site", zh: "在网站开始申请" },
  callBtn: { ar: "اتصال مباشر", en: "Call us", fr: "Appelez-nous", zh: "直接致电" },
  restart: { ar: "ابدأ من جديد", en: "Start over", fr: "Recommencer", zh: "重新开始" },
  hi: {
    ar: "أهلاً 👋 هذي خدمة «{name}». وش وضعك معها الآن؟",
    en: "Hello 👋 This is “{name}”. Where do you stand with it right now?",
    fr: "Bonjour 👋 Il s'agit de « {name} ». Où en êtes-vous ?",
    zh: "您好 👋 这是「{name}」。您目前的情况是？",
  },
  qUrgency: { ar: "كم الاستعجال؟", en: "How urgent is it?", fr: "Quel est le degré d'urgence ?", zh: "紧急程度如何？" },
  aUrgent: { ar: "عاجل — اليوم", en: "Urgent — today", fr: "Urgent — aujourd'hui", zh: "紧急 — 今天" },
  aWeek: { ar: "خلال أسبوع", en: "Within a week", fr: "Sous une semaine", zh: "一周内" },
  aPlanning: { ar: "أخطط فقط", en: "Just planning", fr: "Je planifie seulement", zh: "只是在规划" },
  qEntity: { ar: "هل عندك سجل تجاري أو منشأة قائمة؟", en: "Do you already have a commercial register or an established entity?", fr: "Avez-vous déjà un registre de commerce ou une entité ?", zh: "您是否已有商业登记或已设立实体？" },
  aYes: { ar: "نعم", en: "Yes", fr: "Oui", zh: "是" },
  aNo: { ar: "لا", en: "No", fr: "Non", zh: "否" },
  aNotSure: { ar: "ما أدري", en: "Not sure", fr: "Je ne sais pas", zh: "不确定" },
  qNotes: { ar: "أي تفصيل تحب تضيفه؟ (اختياري)", en: "Anything you'd like to add? (optional)", fr: "Souhaitez-vous ajouter un détail ? (facultatif)", zh: "还想补充什么吗？（可选）" },
  notesPh: { ar: "اكتب تفاصيل حالتك…", en: "Describe your situation…", fr: "Décrivez votre situation…", zh: "描述您的情况…" },
  skip: { ar: "تخطّي", en: "Skip", fr: "Passer", zh: "跳过" },
  ready: { ar: "ملخّص طلبك جاهز", en: "Your request summary is ready", fr: "Le résumé de votre demande est prêt", zh: "您的申请摘要已就绪" },
  waIntro: { ar: "السلام عليكم، أحتاج مساعدتكم في الخدمة التالية:", en: "Hello, I need your help with the following service:", fr: "Bonjour, j'ai besoin de votre aide pour le service suivant :", zh: "您好，我需要以下服务的协助：" },
  waState: { ar: "الحالة", en: "Situation", fr: "Situation", zh: "情况" },
  waUrgency: { ar: "الاستعجال", en: "Urgency", fr: "Urgence", zh: "紧急程度" },
  waEntity: { ar: "منشأة قائمة", en: "Existing entity", fr: "Entité existante", zh: "已有实体" },
  waNotes: { ar: "تفاصيل", en: "Details", fr: "Détails", zh: "详情" },
  waEnd: { ar: "أرجو التواصل معي لتقديم الطلب ومتابعته عبر القنوات الرسمية. شكراً.", en: "Please contact me to submit and follow up the request through the official channels. Thank you.", fr: "Merci de me contacter pour déposer et suivre la demande par les voies officielles.", zh: "请与我联系，通过官方渠道提交并跟进申请。谢谢。" },
};

// The first question and its answers depend on what kind of service this is.
// Every branch keeps the same shape: a state label, and the step that follows.
const FLOWS = {
  government: {
    match: ["العلاقات الحكومية", "الموارد البشرية", "التوظيف والاستقدام"],
    options: [
      { k: "blocked", ar: "الخدمة متوقفة أو ظهرت مشكلة", en: "The service is stopped or a problem appeared", fr: "Le service est bloqué ou un problème est apparu", zh: "服务已停止或出现问题",
        nAr: "نراجع حالة المنشأة على المنصة، ونحدّد سبب التوقّف والخطوات الرسمية لمعالجته، ثم نقدّم ونتابع.", nEn: "We review the establishment's status on the platform, identify what is blocking it and the official steps to resolve it, then submit and follow up." },
      { k: "execute", ar: "محتاج أنفّذ المعاملة", en: "I need the transaction done", fr: "Je dois effectuer la démarche", zh: "我需要办理该事务",
        nAr: "نتحقق من متطلبات المعاملة ومستنداتها، ثم نجهّزها ونقدّمها ونتابعها حتى الإغلاق.", nEn: "We check the requirements and documents, then prepare, submit and follow the transaction to closure." },
      { k: "requirements", ar: "أبغى أعرف المتطلبات أولاً", en: "I want to know the requirements first", fr: "Je veux d'abord connaître les exigences", zh: "我想先了解所需条件",
        nAr: "نراجع حالتك ونرسل لك المتطلبات والمستندات المطلوبة قبل أي التزام.", nEn: "We review your case and send you the requirements and documents before any commitment." },
      { k: "managed", ar: "أبغى إدارة مستمرة للمنصة", en: "I want the platform managed for me", fr: "Je veux une gestion continue de la plateforme", zh: "我希望持续代管该平台",
        nAr: "نحدّد نطاق الإدارة الشهرية للمنصة والمهام المشمولة، ثم يصلك عرض السعر.", nEn: "We define the monthly scope of managing the platform and the tasks it covers, then a quotation reaches you." },
    ],
    entity: true,
  },
  formation: {
    match: ["تأسيس الشركات", "الاستثمار الأجنبي", "الإقامة المميزة"],
    options: [
      { k: "new", ar: "ما بدأت بعد", en: "I haven't started yet", fr: "Je n'ai pas encore commencé", zh: "尚未开始",
        nAr: "نحدّد المسار المناسب للتأسيس ومتطلباته، ثم نبدأ الإجراءات خطوة بخطوة.", nEn: "We define the right formation route and its requirements, then start the procedures step by step." },
      { k: "stuck", ar: "بدأت ووقفت عند خطوة", en: "I started and got stuck", fr: "J'ai commencé et je suis bloqué", zh: "已开始但卡住了",
        nAr: "نراجع الملف من حيث وقف، ونحدّد الخطوة الناقصة ونكملها.", nEn: "We review the file where it stopped, identify the missing step and complete it." },
      { k: "expand", ar: "عندي كيان وأبغى أضيف أو أعدّل", en: "I have an entity and want to add or amend", fr: "J'ai une entité et je veux ajouter ou modifier", zh: "已有实体，想新增或变更",
        nAr: "نراجع بيانات الكيان الحالي والتعديل المطلوب، ونجهّز الإجراء ونقدّمه.", nEn: "We review the current entity and the amendment needed, then prepare and submit the procedure." },
      { k: "ask", ar: "عندي سؤال قبل ما أقرر", en: "I have a question before deciding", fr: "J'ai une question avant de décider", zh: "决定前有疑问",
        nAr: "نجيب على سؤالك ونوضّح الخيارات المتاحة قبل أي التزام.", nEn: "We answer your question and set out the options before any commitment." },
    ],
    entity: true,
  },
  support: {
    match: ["دعم الأعمال", "العقارات", "الأتمتة والذكاء الاصطناعي", "المكاتب ومساحات العمل"],
    options: [
      { k: "execute", ar: "أبغى أنفّذها الآن", en: "I want it done now", fr: "Je veux la réaliser maintenant", zh: "我想现在办理",
        nAr: "نحدّد نطاق العمل والمخرجات، ثم يصلك عرض السعر والعقد ونبدأ التنفيذ.", nEn: "We define the scope and deliverables, then the quotation and contract reach you and we start." },
      { k: "quote", ar: "أبغى عرض سعر", en: "I want a quotation", fr: "Je veux un devis", zh: "我想要报价",
        nAr: "نجهّز عرض السعر على نطاق العمل الذي تعتمده أنت — بلا مفاجآت.", nEn: "We prepare the quotation on the scope you approve — no surprises." },
      { k: "ask", ar: "استفسار فقط", en: "Just a question", fr: "Simple question", zh: "只是咨询",
        nAr: "نجيب على استفسارك ونوضّح ما تحتاجه فعلاً قبل أي التزام.", nEn: "We answer your question and clarify what you actually need before any commitment." },
    ],
    entity: false,
  },
};

// The catalogue names the platform in Arabic only; these are the official
// Latin names, used on the non-Arabic pages.
const PLATFORM_LATIN = {
  "الغرفة التجارية": "Chamber of Commerce",
  "المركز السعودي للأعمال": "Saudi Business Center",
  "أبشر أعمال": "Absher Business",
  "متعدد الجهات": "Multiple authorities",
  "وزارة الاستثمار MISA": "MISA",
  "الإقامة المميزة": "Premium Residency",
  "بلدي": "Balady",
  "التأمينات GOSI": "GOSI",
  "الدفاع المدني": "Civil Defence",
  "مدد": "Mudad",
  "مقيم": "Muqeem",
  "قوى": "Qiwa",
  "الملكية الفكرية SAIP": "SAIP",
  "سُبل": "Subol",
  "الزكاة والضريبة ZATCA": "ZATCA",
  "وزارة الموارد البشرية": "Ministry of Human Resources",
  "وزارة التجارة": "Ministry of Commerce",
  "الهيئة العامة للعقار (REGA) · منصة عقارات السعودية": "REGA · Saudi Real Estate",
};

function flowFor(svc) {
  const cat = String(svc.categoryAr || svc.category || "");
  for (const [key, f] of Object.entries(FLOWS)) if (f.match.includes(cat)) return { ...f, key };
  return { ...FLOWS.support, key: "support" };
}
// Which of the three Simple V1 doors this service belongs to, so the handoff
// to /simple-v1 opens the right context instead of asking again.
const DOOR = { government: "government", formation: "formation", support: "consulting" };

const tr = (k, lang) => (L[k] && (L[k][lang] != null ? L[k][lang] : L[k].en)) || "";

// ------------------------------------------------------------------ markup --
const CSS = `<style id="bp-sva-css">
.bp-sva{border:1px solid #E4E7F0;border-radius:16px;background:#fff;box-shadow:0 12px 34px rgba(11,27,90,.08);overflow:hidden;margin:26px 0;font-family:inherit}
.bp-sva-hd{padding:18px 20px;border-bottom:1px solid #E4E7F0}
.bp-sva-hd h3{margin:0 0 6px;color:#0B1B5A;font-size:19px;display:flex;align-items:center;gap:8px}
.bp-sva-hd p{margin:0;color:#4a4f5e;font-size:13px;line-height:1.7}
.bp-sva-body{padding:16px 20px;background:#fbfcfe;min-height:150px}
.bp-sva-q{background:#fff;border:1px solid #E4E7F0;border-radius:12px;padding:11px 14px;font-size:13.5px;color:#1F2430;margin-bottom:10px;max-width:92%;line-height:1.7}
.bp-sva-a{background:#0B1B5A;color:#fff;border-radius:12px;padding:9px 13px;font-size:13px;margin:0 0 10px auto;max-width:88%;width:fit-content}
.bp-sva-opts{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}
.bp-sva-opts button{border:1px solid #cfd6e6;background:#fff;color:#25304d;border-radius:999px;padding:8px 13px;font:inherit;font-size:12.5px;cursor:pointer;line-height:1.4}
.bp-sva-opts button:hover{border-color:#0B1B5A;color:#0B1B5A}
.bp-sva-note{display:flex;gap:7px;margin-bottom:12px}
.bp-sva-note input{flex:1;min-width:0;border:1px solid #E4E7F0;border-radius:10px;padding:10px 12px;font:inherit;font-size:13px;outline:none}
.bp-sva-note input:focus{border-color:#0B1B5A}
.bp-sva-sum{background:#f3f5fb;border:1px solid #dfe4f2;border-radius:12px;padding:14px 16px;margin-bottom:12px}
.bp-sva-sum dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}
.bp-sva-sum dt{color:#6b7280;font-size:11.5px;white-space:nowrap}
.bp-sva-sum dd{margin:0;color:#1F2430;font-weight:600}
.bp-sva-next{margin:12px 0 0;padding-top:12px;border-top:1px dashed #cfd6e6;font-size:13px;color:#25304d;line-height:1.75}
.bp-sva-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 20px 18px}
.bp-sva-acts a,.bp-sva-acts button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;padding:12px 16px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;text-decoration:none;border:1px solid #E4E7F0;background:#fff;color:#0B1B5A;line-height:1.3;text-align:center}
.bp-sva-acts .wa{background:#128C4A;border-color:#128C4A;color:#fff;grid-column:1/-1}
.bp-sva-acts .site{background:#0B1B5A;border-color:#0B1B5A;color:#fff}
.bp-sva-restart{background:none;border:0;color:#6b7280;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;padding:0 20px 16px}
.bp-sva-hide{display:none!important}
@media(max-width:560px){.bp-sva-acts{grid-template-columns:1fr}}
</style>`;

function widget(svc, lang) {
  const flow = flowFor(svc);
  const name = lang === "ar" ? (svc.nameAr || svc.nameEn) : (svc.nameEn || svc.nameAr);
  const rawPlatform = svc.govPlatform && !/بدون جهة/.test(svc.govPlatform) ? svc.govPlatform : "";
  const platform = rawPlatform && lang !== "ar" ? (PLATFORM_LATIN[rawPlatform] || rawPlatform) : rawPlatform;
  const cfg = {
    lang, code: svc.code, name, platform,
    category: lang === "ar" ? (svc.categoryAr || svc.category) : (svc.category || svc.categoryAr),
    entity: !!flow.entity,
    door: DOOR[flow.key] || "consulting",
    options: flow.options.map((o) => ({
      k: o.k,
      label: lang === "ar" ? o.ar : lang === "en" ? o.en : (o[lang] || o.en),
      next: lang === "ar" ? o.nAr : o.nEn,
    })),
    wa: WA, tel: TEL,
    start: (lang === "en" ? "" : "/" + lang) + "/simple-v1#advisor",
    t: {
      hi: tr("hi", lang).replace("{name}", name),
      yourRequest: tr("yourRequest", lang), authority: tr("authority", lang), nextStep: tr("nextStep", lang),
      qUrgency: tr("qUrgency", lang), aUrgent: tr("aUrgent", lang), aWeek: tr("aWeek", lang), aPlanning: tr("aPlanning", lang),
      qEntity: tr("qEntity", lang), aYes: tr("aYes", lang), aNo: tr("aNo", lang), aNotSure: tr("aNotSure", lang),
      qNotes: tr("qNotes", lang), notesPh: tr("notesPh", lang), skip: tr("skip", lang), ready: tr("ready", lang),
      waIntro: tr("waIntro", lang), waState: tr("waState", lang), waUrgency: tr("waUrgency", lang),
      waEntity: tr("waEntity", lang), waNotes: tr("waNotes", lang), waEnd: tr("waEnd", lang),
    },
  };
  return `<section class="bp-sva" id="bp-sva" data-code="${esc(svc.code)}">
  <div class="bp-sva-hd"><h3>🤖 ${esc(tr("title", lang))}</h3><p>${esc(tr("intro", lang))}</p></div>
  <div class="bp-sva-body" id="bp-sva-body" aria-live="polite"></div>
  <div class="bp-sva-acts bp-sva-hide" id="bp-sva-acts">
    <a class="wa" id="bp-sva-wa" href="${esc(WA)}" target="_blank" rel="noopener">💬 ${esc(tr("waBtn", lang))}</a>
    <a class="site" id="bp-sva-start" href="${esc(cfg.start)}">${esc(tr("siteBtn", lang))}</a>
    <a href="tel:${esc(TEL)}">📞 ${esc(tr("callBtn", lang))}</a>
  </div>
  <button type="button" class="bp-sva-restart bp-sva-hide" id="bp-sva-restart">${esc(tr("restart", lang))}</button>
</section>
<script>(function(){
var C=${JSON.stringify(cfg)};
var box=document.getElementById('bp-sva-body'),acts=document.getElementById('bp-sva-acts'),rst=document.getElementById('bp-sva-restart');
if(!box)return;
var A={};
function el(tag,cls,txt){var d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d}
function ask(text){box.appendChild(el('div','bp-sva-q',text))}
function said(text){box.appendChild(el('div','bp-sva-a',text))}
function opts(list,cb){var w=el('div','bp-sva-opts');list.forEach(function(o){var b=el('button',null,o.label);b.type='button';b.onclick=function(){w.remove();said(o.label);cb(o)};w.appendChild(b)});box.appendChild(w);box.scrollTop=box.scrollHeight}
function step1(){ask(C.t.hi);opts(C.options,function(o){A.state=o.label;A.next=o.next;step2()})}
function step2(){ask(C.t.qUrgency);opts([{label:C.t.aUrgent},{label:C.t.aWeek},{label:C.t.aPlanning}],function(o){A.urgency=o.label;C.entity?step3():step4()})}
function step3(){ask(C.t.qEntity);opts([{label:C.t.aYes},{label:C.t.aNo},{label:C.t.aNotSure}],function(o){A.entity=o.label;step4()})}
function step4(){ask(C.t.qNotes);var w=el('div','bp-sva-note');var i=document.createElement('input');i.type='text';i.placeholder=C.t.notesPh;
var ok=el('button',null,'✓');ok.type='button';ok.className='';var sk=el('button',null,C.t.skip);sk.type='button';
var wrap=el('div','bp-sva-opts');wrap.appendChild(ok);wrap.appendChild(sk);
function done(){A.notes=i.value.trim();w.remove();wrap.remove();if(A.notes)said(A.notes);summary()}
ok.onclick=done;sk.onclick=function(){i.value='';done()};
i.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();done()}});
w.appendChild(i);box.appendChild(w);box.appendChild(wrap);i.focus()}
function row(dl,k,v){if(!v)return;var dt=el('dt',null,k),dd=el('dd',null,v);dl.appendChild(dt);dl.appendChild(dd)}
function summary(){
var s=el('div','bp-sva-sum');var dl=document.createElement('dl');
row(dl,C.t.yourRequest,C.name);row(dl,C.t.authority,C.platform||C.category);row(dl,C.t.waState,A.state);row(dl,C.t.waUrgency,A.urgency);
if(A.entity)row(dl,C.t.waEntity,A.entity);if(A.notes)row(dl,C.t.waNotes,A.notes);
s.appendChild(dl);var n=el('div','bp-sva-next');n.innerHTML='<b>'+C.t.nextStep+':</b> '+A.next.replace(/[<>]/g,'');s.appendChild(n);
box.appendChild(s);ask(C.t.ready);
var lines=[C.t.waIntro,'',C.t.yourRequest+': '+C.name+(C.code?' ('+C.code+')':'')];
if(C.platform)lines.push(C.t.authority+': '+C.platform);
lines.push(C.t.waState+': '+A.state);lines.push(C.t.waUrgency+': '+A.urgency);
if(A.entity)lines.push(C.t.waEntity+': '+A.entity);
if(A.notes)lines.push(C.t.waNotes+': '+A.notes);
lines.push('',C.t.waEnd);
var wa=document.getElementById('bp-sva-wa');
var base=C.wa.indexOf('?')>0?C.wa.split('?')[0]:C.wa;
wa.href=base+'?text='+encodeURIComponent(lines.join('\\n'));
var st=document.getElementById('bp-sva-start');
try{sessionStorage.setItem('bp_sva_request',JSON.stringify({code:C.code,name:C.name,platform:C.platform,door:C.door,lang:C.lang,answers:A,text:lines.join('\\n'),at:Date.now()}))}catch(e){}
st.href=C.start;
acts.classList.remove('bp-sva-hide');rst.classList.remove('bp-sva-hide')}
rst.onclick=function(){box.innerHTML='';acts.classList.add('bp-sva-hide');rst.classList.add('bp-sva-hide');A={};step1()};
step1();
})();</script>`;
}

// ------------------------------------------------------------------- apply --
const LANG_DIRS = [["en", "site/services"], ["ar", "site/ar/services"], ["fr", "site/fr/services"], ["zh", "site/zh/services"]];
let injected = 0, skipped = 0;

for (const [lang, dir] of LANG_DIRS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of fs.readdirSync(full)) {
    if (!file.endsWith(".html")) continue;
    const code = file.replace(/\.html$/, "").toUpperCase();
    const svc = BY_CODE.get(code);
    const p = path.join(full, file);
    let html = fs.readFileSync(p, "utf8");
    if (!svc || html.includes('id="bp-sva"')) { skipped++; continue; }
    const anchor = '<div class="svc-main">';
    const i = html.indexOf(anchor);
    if (i < 0) { skipped++; continue; }
    const at = i + anchor.length;
    html = html.slice(0, at) + widget(svc, lang) + html.slice(at);
    if (!html.includes('id="bp-sva-css"')) html = html.replace("</head>", CSS + "</head>");
    fs.writeFileSync(p, html);
    injected++;
  }
}

console.log(`Service advisor injected on ${injected} page(s)${skipped ? ` (${skipped} skipped)` : ""}`);
