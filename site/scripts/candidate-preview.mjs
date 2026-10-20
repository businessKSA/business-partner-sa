// Business Partner — «معاينة الوظائف المطابقة لسيرتك» + التقديم اليدوي بموافقة (/job-search-service).
//
// يملكه `recruitment-candidate`. قرار المالك 2026/10/20: «ابدأ بالمعاينة والوضع اليدوي».
// يُركَّب في صفحة /job-search-service وحدها من `buildJobSearchService()` في generate.mjs
// (سطران هناك: الاستيراد وإدراج القسم). لا يُعدّل شيئاً في الرئيسية ولا في /careers.
//
// الرحلة (كلها في متصفّح المرشّح، والخادم بلا حالة — api/_jobpreview.js):
//   ١. يرفع سيرته ← «عدد الوظائف المفتوحة المطابقة الآن» وأعلى ٥ (عنوان · مدينة · نسبة).
//      السيرة تُقرأ في الذاكرة ولا تُحفظ في أي مكان قبل «قدّم».
//   ٢. يضغط «جهّز مسودة التقديم» ← ملخّص مهني + خطاب قصير (Azure OpenAI)، يعدّلهما
//      بيده أو بـ«أقصر» / «أرسمي».
//   ٣. «قدّم» ← أول مرة يُطلب اسمه وجواله وموافقته الصريحة، ثم يمرّ الطلب بمسار التقديم
//      الموجود (POST /api/candidate) — لا مسار ثانٍ. «تخطَّ» لا يرسل شيئاً.
//   ٤. سجلّ «طلباتي» بحالاته الخمس وتوقيته.
//
// لا وضع تلقائي. لا ضمان وظيفة ولا مقابلة في أي نص. الألوان من متغيّرات SV1 فقط.
// السكربت دالةٌ حقيقية (clientMain) تُحقن نصّاً، فيفحصها `node --check` ويختبرها الاختبار.

const T = {
  ar: {
    eyebrow: "ابدأ من سيرتك",
    h2: "كم وظيفة مفتوحة تناسب سيرتك الآن؟",
    sub: "ارفع سيرتك الذاتية فنعرض لك الوظائف المفتوحة المطابقة من إعلاناتنا، قبل أي تسجيل أو دفع.",
    upLabel: "سيرتك الذاتية (PDF أو صورة، حتى ٣ م.ب)",
    upBtn: "اعرض الوظائف المطابقة",
    rePrivacy: "🔒 نقرأ سيرتك لحساب المطابقة فقط، ولا نحفظها قبل موافقتك الصريحة",
    reFree: "المعاينة مجانية",
    reCancel: "يمكنك التوقف في أي وقت",
    reading: "نقرأ سيرتك…",
    resCount: "{n} وظيفة مفتوحة تطابق سيرتك الآن",
    resOf: "من أصل {m} وظيفة مفتوحة حالياً",
    resNone: "لا توجد وظيفة مفتوحة تطابق سيرتك الآن في إعلاناتنا الحالية. لا نعرض لك وظائف لا تناسبك.",
    estimate: "النسبة تقدير أوّلي من مطابقة المسمّى والكلمات، وليست حكماً بالقبول ولا ضماناً لمقابلة.",
    match: "مطابقة",
    prep: "جهّز مسودة التقديم",
    sumL: "الملخص المهني",
    letL: "خطاب التقديم",
    shorter: "أقصر",
    formal: "أرسمي",
    apply: "قدّم",
    skip: "تخطَّ",
    aiNote: "تُكتب المسودة بخدمة Azure OpenAI من نصّ سيرتك عند طلبك فقط. راجعها وعدّلها — لا يُرسل شيء لأي جهة قبل نقرتك على «قدّم».",
    drafting: "نجهّز المسودة…",
    consentH: "قبل الإرسال: بياناتك وموافقتك",
    fName: "اسمك الكامل",
    fPhone: "الجوال",
    fEmail: "البريد الإلكتروني (لتتابع حالة طلباتك)",
    consent: "أوافق على حفظ سيرتي وبياناتي لدى Business Partner وإرسال ملفي لصاحب هذه الوظيفة.",
    confirm: "أرسل طلبي",
    needFields: "أضف اسمك وجوالك ووافق على الحفظ والإرسال.",
    sending: "جارٍ الإرسال…",
    sent: "أُرسل طلبك. مرجعك: {ref}",
    dup: "سبق أن قدّمت على هذه الوظيفة — لم نرسل شيئاً مرة ثانية.",
    skipped: "تخطّيتَ هذه الوظيفة — لم يُرسل شيء.",
    ledH: "طلباتي",
    ledEmpty: "لا طلبات بعد.",
    refresh: "حدّث الحالة",
    ledNote: "الحالة تأتي من ملفك لدينا، ونحتفظ حالياً بآخر وظيفة قدّمت لها فقط.",
    st: { preparing: "جاري التجهيز", sent: "أُرسل", waiting: "بانتظار الرد", replied: "رُدّ عليه", interview: "مقابلة" },
    disclaim: "لا نضمن وظيفة ولا مقابلة؛ نعرض لك المطابقة ونساعدك على التقديم بموافقتك.",
    e: {
      unclear: "لم نستطع قراءة سيرتك بوضوح كافٍ لنعرض مطابقةً صادقة. ارفع نسخة أوضح (PDF نصّي أو صورة واضحة) وسنحاول مجدداً.",
      too_large: "الملف أكبر من ٣ م.ب. ارفع نسخة أصغر.",
      bad_type: "نوع الملف غير مدعوم. ارفع PDF أو صورة.",
      no_file: "اختر ملف سيرتك أولاً.",
      reader_off: "قارئ المستندات غير متاح الآن. حاول لاحقاً.",
      jobs_unavailable: "تعذّر تحميل الوظائف المفتوحة الآن. حاول بعد قليل.",
      rate_limited: "طلبات كثيرة في وقت قصير. حاول بعد قليل.",
      network: "خطأ في الاتصال. حاول مجدداً.",
      ai_unavailable: "كتابة المسودة غير متاحة الآن. يمكنك المحاولة لاحقاً.",
      draft_failed: "تعذّر تجهيز المسودة. حاول مجدداً.",
      job_not_open: "هذه الوظيفة لم تعد مفتوحة.",
      apply_failed: "تعذّر إرسال الطلب. لم يُرسل شيء، حاول مجدداً.",
    },
  },
  en: {
    eyebrow: "Start from your CV",
    h2: "How many open jobs fit your CV right now?",
    sub: "Upload your CV and we show the open jobs from our listings that match it — before any sign-up or payment.",
    upLabel: "Your CV (PDF or image, up to 3 MB)",
    upBtn: "Show matching jobs",
    rePrivacy: "🔒 We read your CV only to compute matches and do not store it before your explicit consent",
    reFree: "The preview is free",
    reCancel: "Stop any time",
    reading: "Reading your CV…",
    resCount: "{n} open jobs match your CV right now",
    resOf: "out of {m} jobs open at the moment",
    resNone: "No open job in our current listings matches your CV right now. We don't show you jobs that don't fit.",
    estimate: "The percentage is a first estimate from title and keyword matching — not a verdict of acceptance and not a guarantee of an interview.",
    match: "match",
    prep: "Prepare an application draft",
    sumL: "Professional summary",
    letL: "Cover letter",
    shorter: "Shorter",
    formal: "More formal",
    apply: "Apply",
    skip: "Skip",
    aiNote: "The draft is written by Azure OpenAI from your CV text, only when you ask. Review and edit it — nothing is sent to anyone before you click “Apply”.",
    drafting: "Preparing the draft…",
    consentH: "Before sending: your details and consent",
    fName: "Full name",
    fPhone: "Mobile",
    fEmail: "Email (so you can follow your applications)",
    consent: "I agree that Business Partner stores my CV and details and sends my file to this job's employer.",
    confirm: "Send my application",
    needFields: "Add your name and mobile, and agree to storing and sending.",
    sending: "Sending…",
    sent: "Application sent. Your reference: {ref}",
    dup: "You already applied to this job — nothing was sent a second time.",
    skipped: "You skipped this job — nothing was sent.",
    ledH: "My applications",
    ledEmpty: "No applications yet.",
    refresh: "Refresh status",
    ledNote: "Status comes from your file with us, and for now we keep only the last job you applied to.",
    st: { preparing: "Preparing", sent: "Sent", waiting: "Awaiting reply", replied: "Replied", interview: "Interview" },
    disclaim: "We don't guarantee a job or an interview; we show you the match and help you apply with your consent.",
    e: {
      unclear: "We couldn't read your CV clearly enough to show an honest match. Upload a clearer copy (a text PDF or a sharp image) and we'll try again.",
      too_large: "The file is over 3 MB. Upload a smaller copy.",
      bad_type: "Unsupported file type. Upload a PDF or an image.",
      no_file: "Choose your CV file first.",
      reader_off: "The document reader isn't available right now. Try again later.",
      jobs_unavailable: "Couldn't load the open jobs right now. Try again shortly.",
      rate_limited: "Too many requests in a short time. Try again shortly.",
      network: "Connection error. Please try again.",
      ai_unavailable: "Draft writing isn't available right now. Try again later.",
      draft_failed: "Couldn't prepare the draft. Please try again.",
      job_not_open: "This job is no longer open.",
      apply_failed: "Couldn't send the application. Nothing was sent — please try again.",
    },
  },
  fr: {
    eyebrow: "Partez de votre CV",
    h2: "Combien de postes ouverts correspondent à votre CV ?",
    sub: "Déposez votre CV : nous affichons les postes ouverts de nos annonces qui y correspondent, avant toute inscription ou paiement.",
    upLabel: "Votre CV (PDF ou image, 3 Mo maximum)",
    upBtn: "Voir les postes correspondants",
    rePrivacy: "🔒 Nous lisons votre CV uniquement pour calculer la correspondance et ne le conservons pas avant votre consentement explicite",
    reFree: "L'aperçu est gratuit",
    reCancel: "Arrêtez à tout moment",
    reading: "Lecture de votre CV…",
    resCount: "{n} postes ouverts correspondent à votre CV",
    resOf: "sur {m} postes ouverts actuellement",
    resNone: "Aucun poste ouvert de nos annonces actuelles ne correspond à votre CV. Nous ne vous montrons pas de postes inadaptés.",
    estimate: "Le pourcentage est une estimation initiale (intitulé et mots-clés) : ce n'est ni un verdict d'acceptation ni une garantie d'entretien.",
    match: "correspondance",
    prep: "Préparer un brouillon de candidature",
    sumL: "Résumé professionnel",
    letL: "Lettre de motivation",
    shorter: "Plus court",
    formal: "Plus formel",
    apply: "Postuler",
    skip: "Passer",
    aiNote: "Le brouillon est rédigé par Azure OpenAI à partir du texte de votre CV, uniquement à votre demande. Relisez-le et modifiez-le — rien n'est envoyé avant votre clic sur « Postuler ».",
    drafting: "Préparation du brouillon…",
    consentH: "Avant l'envoi : vos données et votre consentement",
    fName: "Nom complet",
    fPhone: "Mobile",
    fEmail: "E-mail (pour suivre vos candidatures)",
    consent: "J'accepte que Business Partner conserve mon CV et mes données et transmette mon dossier à l'employeur de ce poste.",
    confirm: "Envoyer ma candidature",
    needFields: "Indiquez votre nom et votre mobile, et acceptez l'enregistrement et l'envoi.",
    sending: "Envoi…",
    sent: "Candidature envoyée. Votre référence : {ref}",
    dup: "Vous avez déjà postulé à ce poste — rien n'a été renvoyé.",
    skipped: "Vous avez passé ce poste — rien n'a été envoyé.",
    ledH: "Mes candidatures",
    ledEmpty: "Aucune candidature pour l'instant.",
    refresh: "Actualiser le statut",
    ledNote: "Le statut provient de votre dossier chez nous ; pour l'instant nous ne conservons que le dernier poste auquel vous avez postulé.",
    st: { preparing: "En préparation", sent: "Envoyée", waiting: "En attente de réponse", replied: "Réponse reçue", interview: "Entretien" },
    disclaim: "Nous ne garantissons ni un emploi ni un entretien ; nous vous montrons la correspondance et vous aidons à postuler avec votre consentement.",
    e: {
      unclear: "Nous n'avons pas pu lire votre CV assez clairement pour afficher une correspondance honnête. Déposez une copie plus nette (PDF texte ou image claire) et nous réessaierons.",
      too_large: "Le fichier dépasse 3 Mo. Déposez une copie plus légère.",
      bad_type: "Type de fichier non pris en charge. Déposez un PDF ou une image.",
      no_file: "Choisissez d'abord votre fichier de CV.",
      reader_off: "Le lecteur de documents n'est pas disponible pour le moment. Réessayez plus tard.",
      jobs_unavailable: "Impossible de charger les postes ouverts pour le moment. Réessayez dans un instant.",
      rate_limited: "Trop de demandes en peu de temps. Réessayez dans un instant.",
      network: "Erreur de connexion. Veuillez réessayer.",
      ai_unavailable: "La rédaction du brouillon n'est pas disponible pour le moment. Réessayez plus tard.",
      draft_failed: "Impossible de préparer le brouillon. Veuillez réessayer.",
      job_not_open: "Ce poste n'est plus ouvert.",
      apply_failed: "Impossible d'envoyer la candidature. Rien n'a été envoyé — veuillez réessayer.",
    },
  },
  zh: {
    eyebrow: "从您的简历开始",
    h2: "现在有多少个开放职位适合您的简历？",
    sub: "上传简历，我们会从我们的招聘信息中展示与之匹配的开放职位——无需先注册或付款。",
    upLabel: "您的简历（PDF 或图片，最大 3 MB）",
    upBtn: "查看匹配职位",
    rePrivacy: "🔒 我们仅为计算匹配度而读取简历，在您明确同意之前不会保存",
    reFree: "预览免费",
    reCancel: "可随时停止",
    reading: "正在读取您的简历…",
    resCount: "目前有 {n} 个开放职位与您的简历匹配",
    resOf: "共 {m} 个当前开放职位",
    resNone: "目前我们的招聘信息中没有与您的简历匹配的开放职位。我们不会展示不适合您的职位。",
    estimate: "百分比是根据职位名称和关键词得出的初步估计，并非录用结论，也不保证获得面试。",
    match: "匹配",
    prep: "生成申请草稿",
    sumL: "职业简介",
    letL: "求职信",
    shorter: "更简短",
    formal: "更正式",
    apply: "申请",
    skip: "跳过",
    aiNote: "草稿仅在您要求时由 Azure OpenAI 根据您的简历文本撰写。请检查并修改——在您点击“申请”之前不会向任何方发送内容。",
    drafting: "正在生成草稿…",
    consentH: "发送前：您的信息与同意",
    fName: "姓名",
    fPhone: "手机",
    fEmail: "电子邮箱（用于跟踪申请状态）",
    consent: "我同意 Business Partner 保存我的简历和信息，并将我的资料发送给该职位的雇主。",
    confirm: "发送我的申请",
    needFields: "请填写姓名和手机，并同意保存与发送。",
    sending: "发送中…",
    sent: "申请已发送。您的编号：{ref}",
    dup: "您已申请过该职位——未再次发送。",
    skipped: "您已跳过该职位——未发送任何内容。",
    ledH: "我的申请",
    ledEmpty: "暂无申请。",
    refresh: "刷新状态",
    ledNote: "状态来自我们保存的您的档案，目前仅保留您最近申请的一个职位。",
    st: { preparing: "准备中", sent: "已发送", waiting: "等待回复", replied: "已回复", interview: "面试" },
    disclaim: "我们不保证工作或面试；我们为您展示匹配并在您同意后协助申请。",
    e: {
      unclear: "我们无法足够清晰地读取您的简历，因此无法给出可信的匹配。请上传更清晰的副本（文字版 PDF 或清晰图片），我们会再试一次。",
      too_large: "文件超过 3 MB。请上传较小的副本。",
      bad_type: "不支持的文件类型。请上传 PDF 或图片。",
      no_file: "请先选择您的简历文件。",
      reader_off: "文档读取服务暂不可用，请稍后再试。",
      jobs_unavailable: "暂时无法加载开放职位，请稍后再试。",
      rate_limited: "短时间内请求过多，请稍后再试。",
      network: "连接错误，请重试。",
      ai_unavailable: "草稿撰写暂不可用，请稍后再试。",
      draft_failed: "无法生成草稿，请重试。",
      job_not_open: "该职位已不再开放。",
      apply_failed: "申请发送失败，未发送任何内容，请重试。",
    },
  },
};

const strings = (lang) => T[lang] || T.en;

export const PREVIEW_CSS = `<style id="jss-preview-css">
#jss-preview .jp-card{border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh)}
#jss-preview .jp-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#jss-preview .jp-re{display:flex;gap:6px 16px;flex-wrap:wrap;margin:10px 0 0;padding:0;list-style:none;font-size:12px;color:var(--mut)}
#jss-preview .jp-re li{line-height:1.6}
#jss-preview .jp-msg{min-height:20px;margin:10px 0 0;font-size:13px;color:var(--mut)}
#jss-preview .jp-msg.is-err{color:var(--warn)}
#jss-preview .jp-count{font-size:clamp(20px,3vw,28px);font-weight:300;color:var(--ink);margin:0 0 4px}
#jss-preview .jp-of,#jss-preview .jp-est{font-size:12.5px;color:var(--mut);margin:0 0 6px}
#jss-preview .jp-job{border:1px solid var(--l);border-radius:12px;padding:14px 16px;margin-top:10px}
#jss-preview .jp-job.is-skipped{opacity:.55}
#jss-preview .jp-head{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
#jss-preview .jp-title{font-weight:500;color:var(--ink);margin:0}
#jss-preview .jp-meta{font-size:12.5px;color:var(--mut);margin:2px 0 0}
#jss-preview .jp-pct{font-family:var(--fm);font-size:13px;color:var(--ac);background:var(--acSoft);border:1px solid var(--acLine);border-radius:999px;padding:3px 10px;white-space:nowrap}
#jss-preview .jp-draft{margin-top:12px}
#jss-preview .jp-draft label{display:block;margin:10px 0 4px}
#jss-preview .jp-draft textarea{width:100%;min-height:96px;resize:vertical}
#jss-preview .jp-note{font-size:12px;color:var(--mut);margin:8px 0 0}
#jss-preview .jp-consent{background:var(--acSoft);border:1px solid var(--acLine);border-radius:12px;padding:14px;margin-top:12px}
#jss-preview .jp-consent .jp-chk{display:flex;gap:8px;align-items:flex-start;margin:10px 0}
#jss-preview .jp-consent .jp-chk input{width:auto;margin-top:4px}
#jss-preview .jp-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
@media(max-width:640px){#jss-preview .jp-grid{grid-template-columns:1fr}}
#jss-preview .jp-led{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
#jss-preview .jp-led th,#jss-preview .jp-led td{text-align:start;padding:8px 10px;border-bottom:1px solid var(--line2)}
#jss-preview .jp-chip{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;border:1px solid var(--acLine);background:var(--acSoft);color:var(--ink)}
#jss-preview .jp-chip.st-sent,#jss-preview .jp-chip.st-replied{background:var(--okSoft);border-color:var(--ok);color:var(--ok)}
#jss-preview .jp-chip.st-preparing{background:var(--g);border-color:var(--l);color:var(--mut)}
</style>`;

export function candidatePreviewSection(ctx) {
  const lang = ctx.lang();
  const S = strings(lang);
  const esc = ctx.esc;
  return `${PREVIEW_CSS}
  <section class="section" id="jss-preview"><div class="container" style="max-width:900px">
    <div class="section-head"><span class="eyebrow">${esc(S.eyebrow)}</span><h2>${esc(S.h2)}</h2><p>${esc(S.sub)}</p></div>
    <div class="jp-card">
      <form id="jp-form" novalidate>
        <div class="field"><label for="jp-file">${esc(S.upLabel)}</label><input id="jp-file" type="file" accept="application/pdf,image/png,image/jpeg"></div>
        <div class="jp-row"><button type="submit" class="btn btn-primary btn-lg" id="jp-go">${esc(S.upBtn)}</button></div>
        <ul class="jp-re"><li>${esc(S.rePrivacy)}</li><li>${esc(S.reFree)}</li><li>${esc(S.reCancel)}</li></ul>
        <p class="jp-msg" id="jp-msg" role="status" aria-live="polite"></p>
      </form>
    </div>
    <div id="jp-result" aria-live="polite" hidden>
      <p class="jp-count" id="jp-count"></p><p class="jp-of" id="jp-of"></p><p class="jp-est" id="jp-est"></p>
      <div id="jp-jobs"></div>
      <div class="jp-consent" id="jp-consent" hidden>
        <h3 style="margin:0 0 8px">${esc(S.consentH)}</h3>
        <div class="jp-grid">
          <div class="field"><label for="jp-name">${esc(S.fName)} *</label><input id="jp-name" type="text" autocomplete="name"></div>
          <div class="field"><label for="jp-phone">${esc(S.fPhone)} *</label><input id="jp-phone" type="tel" autocomplete="tel" placeholder="+9665XXXXXXXX"></div>
        </div>
        <div class="field"><label for="jp-email">${esc(S.fEmail)}</label><input id="jp-email" type="email" autocomplete="email"></div>
        <label class="jp-chk"><input type="checkbox" id="jp-agree"><span>${esc(S.consent)}</span></label>
        <button type="button" class="btn btn-primary" id="jp-confirm">${esc(S.confirm)}</button>
        <p class="jp-msg" id="jp-cmsg" role="status" aria-live="polite"></p>
      </div>
      <p class="jp-note">${esc(S.disclaim)}</p>
    </div>
    <div id="jp-ledger" hidden>
      <h3 style="margin:22px 0 0">${esc(S.ledH)}</h3>
      <table class="jp-led"><tbody id="jp-led-body"></tbody></table>
      <div class="jp-row" style="margin-top:10px"><button type="button" class="btn" id="jp-refresh">${esc(S.refresh)}</button></div>
      <p class="jp-note">${esc(S.ledNote)}</p>
    </div>
  </div></section>`;
}

// المنطق كله هنا. يُحقن نصّاً في الصفحة: لا يعتمد على شيءٍ خارج نفسه، ويستقبل `S` و`lang`
// و`env` (للاختبار: fetch و document و FileReader).
export function clientMain(S, lang, env) {
  "use strict";
  var doc = (env && env.document) || document;
  var doFetch = (env && env.fetch) || function () { return fetch.apply(null, arguments); };
  var $ = function (id) { return doc.getElementById(id); };
  var form = $("jp-form");
  if (!form) return;

  var MAX = 3 * 1024 * 1024;
  var OK_TYPES = /^(application\/pdf|image\/png|image\/jpeg)$/;
  var state = { file: null, cvText: "", jobs: {}, ident: null, email: "", ref: "", pending: null, busy: {}, ledger: [] };

  function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
  function say(el, key, isErr, vars) {
    var text = key && S.e[key] ? S.e[key] : (key || "");
    el.textContent = vars ? fmt(text, vars) : text;
    el.className = "jp-msg" + (isErr ? " is-err" : "");
  }
  function post(body) {
    return doFetch("/api/jobhunt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { status: r.status, d: d }; }); });
  }
  function mk(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toBase64(file) {
    return new Promise(function (resolve, reject) {
      var rd = new ((env && env.FileReader) || FileReader)();
      rd.onload = function () { var s = String(rd.result || ""); resolve(s.slice(s.indexOf(",") + 1)); };
      rd.onerror = function () { reject(new Error("read")); };
      rd.readAsDataURL(file);
    });
  }
  function failKey(res) {
    var d = res.d || {};
    if (res.status === 429) return "rate_limited";
    if (d.key && S.e[d.key]) return d.key;
    if (d.error && S.e[d.error]) return d.error;
    return "network";
  }

  /* ───────── ١. المعاينة ───────── */
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var msg = $("jp-msg"), btn = $("jp-go"), f = $("jp-file").files && $("jp-file").files[0];
    if (!f) return say(msg, "no_file", true);
    if (f.size > MAX) return say(msg, "too_large", true);
    if (!OK_TYPES.test(f.type || "")) return say(msg, "bad_type", true);
    btn.disabled = true; say(msg, S.reading, false);
    toBase64(f).then(function (b64) {
      state.file = { name: f.name, type: f.type, size: f.size, base64: b64 };
      return post({ type: "preview", cvFile: { name: f.name, type: f.type, base64: b64 } });
    }).then(function (res) {
      btn.disabled = false;
      var d = res.d;
      if (!d || !d.ok) { state.file = null; return say(msg, failKey(res), true); }
      say(msg, "", false);
      state.cvText = d.cvText || "";
      renderResult(d);
    }).catch(function () { btn.disabled = false; state.file = null; say(msg, "network", true); });
  });

  function renderResult(d) {
    $("jp-result").hidden = false;
    $("jp-count").textContent = d.matchedCount > 0 ? fmt(S.resCount, { n: d.matchedCount }) : S.resNone;
    $("jp-of").textContent = d.matchedCount > 0 ? fmt(S.resOf, { m: d.openTotal }) : "";
    $("jp-est").textContent = d.matchedCount > 0 ? S.estimate : "";
    var box = $("jp-jobs"); box.textContent = ""; state.jobs = {};
    (d.top || []).forEach(function (j) {
      state.jobs[j.id] = { id: j.id, title: j.title, city: j.city, score: j.score, status: "", skipped: false };
      box.appendChild(jobCard(state.jobs[j.id]));
    });
  }

  function jobCard(j) {
    var card = mk("div", "jp-job"); card.id = "jp-job-" + j.id;
    var head = mk("div", "jp-head"), left = mk("div");
    left.appendChild(mk("p", "jp-title", j.title));
    if (j.city) left.appendChild(mk("p", "jp-meta", j.city));
    head.appendChild(left);
    head.appendChild(mk("span", "jp-pct", j.score + "% " + S.match));
    card.appendChild(head);
    var row = mk("div", "jp-row"); row.style.marginTop = "10px";
    var prep = mk("button", "btn", S.prep); prep.type = "button";
    prep.addEventListener("click", function () { draft(j, card, "default"); });
    row.appendChild(prep); card.appendChild(row);
    j.prepBtn = prep;
    return card;
  }

  /* ───────── ٢. المسودة ───────── */
  function draft(j, card, tone) {
    if (state.busy[j.id]) return;
    var wrap = card.querySelector(".jp-draft");
    var prev = null;
    if (wrap) prev = { summary: wrap.querySelector(".jp-sum").value, letter: wrap.querySelector(".jp-let").value };
    state.busy[j.id] = true;
    var note = wrap ? wrap.querySelector(".jp-dmsg") : null;
    if (j.prepBtn) j.prepBtn.disabled = true;
    if (note) say(note, S.drafting, false);
    else { var tmp = mk("p", "jp-msg", S.drafting); tmp.className = "jp-msg jp-tmp"; card.appendChild(tmp); }
    post({ type: "draft", cvText: state.cvText, jobId: j.id, tone: tone, lang: lang, previous: prev || undefined }).then(function (res) {
      state.busy[j.id] = false;
      var t = card.querySelector(".jp-tmp"); if (t) t.remove();
      if (j.prepBtn) j.prepBtn.disabled = false;
      var d = res.d;
      if (!d || !d.ok) {
        var m = card.querySelector(".jp-dmsg") || card.appendChild(mk("p", "jp-msg"));
        if (!m.classList.contains("jp-dmsg")) m.classList.add("jp-dmsg");
        return say(m, failKey(res), true);
      }
      showDraft(j, card, d);
    }).catch(function () {
      state.busy[j.id] = false;
      var t = card.querySelector(".jp-tmp"); if (t) t.remove();
      if (j.prepBtn) j.prepBtn.disabled = false;
      var m = card.querySelector(".jp-dmsg") || card.appendChild(mk("p", "jp-msg jp-dmsg"));
      say(m, "network", true);
    });
  }

  function showDraft(j, card, d) {
    var old = card.querySelector(".jp-draft");
    if (old) {
      old.querySelector(".jp-sum").value = d.summary; old.querySelector(".jp-let").value = d.letter;
      say(old.querySelector(".jp-dmsg"), "", false);
      return;
    }
    if (j.prepBtn) j.prepBtn.hidden = true;
    setLedger(j, "preparing");
    var wrap = mk("div", "jp-draft");
    var l1 = mk("label", "", S.sumL), t1 = mk("textarea", "jp-sum"); t1.value = d.summary; t1.rows = 4;
    var l2 = mk("label", "", S.letL), t2 = mk("textarea", "jp-let"); t2.value = d.letter; t2.rows = 6;
    var row = mk("div", "jp-row"); row.style.marginTop = "10px";
    var bShort = mk("button", "btn", S.shorter), bFormal = mk("button", "btn", S.formal);
    var bApply = mk("button", "btn btn-primary", S.apply), bSkip = mk("button", "btn", S.skip);
    [bShort, bFormal, bApply, bSkip].forEach(function (b) { b.type = "button"; row.appendChild(b); });
    var msg = mk("p", "jp-msg jp-dmsg");
    wrap.appendChild(l1); wrap.appendChild(t1); wrap.appendChild(l2); wrap.appendChild(t2);
    wrap.appendChild(row); wrap.appendChild(mk("p", "jp-note", S.aiNote)); wrap.appendChild(msg);
    card.appendChild(wrap);
    bShort.addEventListener("click", function () { draft(j, card, "short"); });
    bFormal.addEventListener("click", function () { draft(j, card, "formal"); });
    bSkip.addEventListener("click", function () {
      j.skipped = true; card.classList.add("is-skipped"); wrap.hidden = true;
      removeLedger(j); var m = mk("p", "jp-msg", S.skipped); card.appendChild(m);
      if (state.pending === j.id) { state.pending = null; $("jp-consent").hidden = true; }
    });
    bApply.addEventListener("click", function () { apply(j, card, msg, bApply); });
  }

  /* ───────── ٣. «قدّم» (نقرةٌ صريحة، مرةً واحدة) ───────── */
  function apply(j, card, msg, btn) {
    if (j.status === "sent" || state.busy["apply:" + j.id]) return;
    var letter = card.querySelector(".jp-let").value.trim(), summary = card.querySelector(".jp-sum").value.trim();
    if (!letter) return;
    if (!state.ident) {
      state.pending = j.id;
      var c = $("jp-consent"); c.hidden = false; card.parentNode.insertBefore(c, card.nextSibling);
      $("jp-name").focus();
      return;
    }
    send(j, card, msg, btn, summary, letter);
  }

  $("jp-confirm").addEventListener("click", function () {
    var cm = $("jp-cmsg"), name = $("jp-name").value.trim(), phone = $("jp-phone").value.trim(), email = $("jp-email").value.trim();
    if (!name || !phone || !$("jp-agree").checked) return say(cm, S.needFields, true);
    state.ident = { name: name, phone: phone, email: email };
    $("jp-consent").hidden = true; say(cm, "", false);
    var j = state.jobs[state.pending]; if (!j) return;
    var card = $("jp-job-" + j.id);
    send(j, card, card.querySelector(".jp-dmsg"), card.querySelector(".btn-primary"), card.querySelector(".jp-sum").value.trim(), card.querySelector(".jp-let").value.trim());
  });

  function send(j, card, msg, btn, summary, letter) {
    var key = "apply:" + j.id;
    if (state.busy[key] || j.status === "sent") return;
    state.busy[key] = true; btn.disabled = true; say(msg, S.sending, false);
    // يمرّ بمسار التقديم الموجود نفسه. الموافقة تُرسَل صريحةً (consent) بعد أن علّمها المرشّح بيده.
    doFetch("/api/candidate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: state.ident.name, phone: state.ident.phone, email: state.ident.email,
        consent: true, jobId: j.id, jobTitle: j.title, lang: lang,
        cvFile: state.file,
        questions: { interest: letter.slice(0, 700), strengths: summary.slice(0, 700) },
      }),
    }).then(function (r) { return r.json().catch(function () { return null; }); }).then(function (d) {
      state.busy[key] = false;
      if (!d || !d.ok) { btn.disabled = false; return say(msg, "apply_failed", true); }
      j.status = "sent";
      card.querySelector(".jp-draft").querySelectorAll("button,textarea").forEach(function (e) { e.disabled = true; });
      if (d.duplicate) { say(msg, S.dup, false); return setLedger(j, "sent", d.ref); }
      state.ref = d.ref || state.ref; state.email = state.ident.email || state.email;
      say(msg, fmt(S.sent, { ref: d.ref || "" }), false);
      setLedger(j, "sent", d.ref);
    }).catch(function () { state.busy[key] = false; btn.disabled = false; say(msg, "apply_failed", true); });
  }

  /* ───────── ٤. سجلّ الحالات ───────── */
  function setLedger(j, status, ref) {
    var e = state.ledger.filter(function (x) { return x.jobId === j.id; })[0];
    if (!e) { e = { jobId: j.id, title: j.title }; state.ledger.push(e); }
    e.status = status; e.at = new Date().toISOString(); if (ref) e.ref = ref;
    renderLedger();
  }
  function removeLedger(j) { state.ledger = state.ledger.filter(function (x) { return x.jobId !== j.id; }); renderLedger(); }
  function renderLedger() {
    var body = $("jp-led-body"); body.textContent = "";
    $("jp-ledger").hidden = !state.ledger.length;
    $("jp-refresh").hidden = !(state.ref && state.email);
    state.ledger.forEach(function (e) {
      var tr = mk("tr"), t1 = mk("td", "", e.title), t2 = mk("td"), t3 = mk("td", "", fmtTime(e.at));
      t2.appendChild(mk("span", "jp-chip st-" + e.status, S.st[e.status] || e.status));
      tr.appendChild(t1); tr.appendChild(t2); tr.appendChild(t3); body.appendChild(tr);
    });
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString(lang === "zh" ? "zh-CN" : lang, { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso || ""; }
  }
  $("jp-refresh").addEventListener("click", function () {
    if (!state.ref || !state.email) return;
    post({ type: "my-applications", email: state.email, ref: state.ref }).then(function (res) {
      var d = res.d; if (!d || !d.ok || !d.found) return;
      (d.applications || []).forEach(function (a) {
        var e = state.ledger.filter(function (x) { return x.jobId === a.jobId; })[0];
        if (e) { e.status = a.status; if (a.updatedAt) e.at = a.updatedAt; }
      });
      renderLedger();
    });
  });
}

export function candidatePreviewScript(ctx) {
  const lang = ctx.lang();
  // `<` مهرَّبة كي لا ينهي نصٌّ يحوي `</script` الوسم، ولا يكسر ما فيه من فواصل علوية شيئاً.
  const json = JSON.stringify(strings(lang)).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, "");
  return `<script>(${clientMain.toString()})(${json},${JSON.stringify(lang)});</script>`;
}
