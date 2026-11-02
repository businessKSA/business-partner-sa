// Business Partner — Simple V1: «من نحن» (/about) و«تواصل» (/contact).
//
// قرار المالك (2026-11-02): الصفحتان كانتا تُبنيان بقالب الموقع القديم (hero +
// cards + نموذج main.js) داخل قشرة جديدة فتظهران بنصف تصميم: هيرو فارغ، أزرار
// تقود إلى /services القديمة، وخريطة تشير إلى «حي الملقا» والعنوان المسجَّل
// الدرعية. هذا الملف يبنيهما بقشرة Simple V1 نفسها (`SV1.shell`) بأربع لغات:
// ar · en · fr · zh.
//
// المحتوى حقيقي من المستودع فقط:
//   · site/data/site.json: about (الوعد/كيف نعمل/الشخصية/القيم) وcontact والهوية
//     النظامية وحسابات التواصل — نفسها التي في التذييل.
//   · الوجهات في «ما نقدّمه» صفحات موجودة فعلاً في الموقع الجديد.
// لا أسعار، ولا رقم حكومي يُخترع (الهوية النظامية تمرّ بفحص الشكل نفسه الذي في
// تذييل القشرة: وحدٌ 10 أرقام يبدأ بـ7، وضريبي 15 رقماً يبدأ وينتهي بـ3).
// لا زر واتساب داخل المحتوى — الزر العائم في القشرة وحده.
//
// النموذج يرسل إلى /api/requests بعقد main.js نفسه (type: support-ticket،
// sid: contact-form)، فلا مسار جديد في الخادم ولا دالة جديدة في api/.

const T = {
  // ------- من نحن
  aboutTag: { ar: "من نحن", en: "About us", fr: "Qui sommes-nous", zh: "关于我们" },
  aboutH1: {
    ar: "شريك تشغيل للشركات في السعودية",
    en: "An operating partner for companies in Saudi Arabia",
    fr: "Un partenaire opérationnel pour les entreprises en Arabie saoudite",
    zh: "沙特企业的运营合作伙伴",
  },
  aboutLead: {
    ar: "Business Partner شريك تشغيل للشركات في السعودية. نتولّى عنك التعامل مع المنصات والجهات الحكومية، ونُنجز متطلبات أعمالك بوضوح وسرعة ومنهجية.",
    en: "Business Partner is an operating partner for companies in Saudi Arabia. We handle platforms and government authorities on your behalf and get your business requirements done clearly, quickly and methodically.",
    fr: "Business Partner est un partenaire opérationnel pour les entreprises en Arabie saoudite. Nous gérons les plateformes et les autorités à votre place et menons vos démarches avec clarté, rapidité et méthode.",
    zh: "Business Partner 是沙特企业的运营合作伙伴。我们代您对接各类平台与政府部门，以清晰、快速、有条理的方式完成您的业务事项。",
  },
  start: { ar: "ابدأ طلبك", en: "Start your request", fr: "Démarrer une demande", zh: "开始申请" },
  browse: { ar: "تصفّح الخدمات", en: "Browse services", fr: "Parcourir les services", zh: "浏览服务" },
  contactUs: { ar: "تواصل معنا", en: "Contact us", fr: "Nous contacter", zh: "联系我们" },
  howH: { ar: "كيف نعمل معك", en: "How we work with you", fr: "Comment nous travaillons", zh: "我们如何与您合作" },
  howSub: {
    ar: "ثلاث ركائز تلخّص التزامنا تجاه كل عميل.",
    en: "Three pillars that sum up our commitment to every client.",
    fr: "Trois piliers qui résument notre engagement envers chaque client.",
    zh: "三大支柱，概括我们对每位客户的承诺。",
  },
  secs: [
    {
      ar: ["وعدنا", "نختصر عليك الوقت والجهد في التعامل مع الأنظمة والجهات الحكومية، ونحوّل الإجراءات المعقّدة إلى خطوات واضحة نُنجزها نيابةً عنك."],
      en: ["Our promise", "We save you time and effort dealing with regulations and government authorities, turning complex procedures into clear steps we complete on your behalf."],
      fr: ["Notre promesse", "Nous vous faisons gagner du temps face à la réglementation et aux administrations, en transformant les procédures complexes en étapes claires que nous réalisons pour vous."],
      zh: ["我们的承诺", "我们为您节省与法规及政府部门打交道的时间和精力，把复杂的流程拆成清晰的步骤，由我们代为完成。"],
    },
    {
      ar: ["كيف نعمل", "نفهم حالتك، نحدد الخدمة والمسار الصحيح، نجهّز المستندات، نرفع الطلب على المنصة المختصة، ونتابع حتى الإصدار — مع تحديثك في كل مرحلة."],
      en: ["How we work", "We understand your case, identify the right service and track, prepare the documents, file the request with the relevant platform, and follow up to issuance — keeping you updated at every stage."],
      fr: ["Notre méthode", "Nous comprenons votre cas, identifions le bon service et le bon parcours, préparons les documents, déposons la demande sur la plateforme compétente et suivons jusqu'à l'émission — en vous tenant informé à chaque étape."],
      zh: ["我们的方式", "了解您的情况，确定合适的服务与路径，准备文件，在相应平台提交申请，并跟进到办结——每个阶段都会向您更新进展。"],
    },
    {
      ar: ["شخصيتنا", "احترافية، هادئة، موثوقة، ودقيقة. نركّز على النتائج ونتكلم بوضوح بلا مبالغة."],
      en: ["Our character", "Professional, calm, reliable and precise. We focus on results and speak clearly without exaggeration."],
      fr: ["Notre caractère", "Professionnels, sereins, fiables et précis. Nous nous concentrons sur les résultats et parlons clairement, sans exagération."],
      zh: ["我们的风格", "专业、沉稳、可靠、精确。我们专注结果，表达清晰，不夸大其词。"],
    },
  ],
  doH: { ar: "ما نقدّمه", en: "What we offer", fr: "Ce que nous proposons", zh: "我们提供什么" },
  doSub: {
    ar: "كل بابٍ يقودك إلى صفحته مباشرة.",
    en: "Each door takes you straight to its page.",
    fr: "Chaque porte vous mène directement à sa page.",
    zh: "每一项都可直接进入对应页面。",
  },
  open: { ar: "افتح", en: "Open", fr: "Ouvrir", zh: "打开" },
  offers: [
    {
      to: "/catalog",
      ar: ["الخدمات الحكومية وخدمات الشركات", "اختر من الكتالوج واطلب عرض سعر، أو اشترِ الجاهز مباشرة."],
      en: ["Government and company services", "Pick from the catalogue and request a quotation, or buy ready services directly."],
      fr: ["Services administratifs et d'entreprise", "Choisissez dans le catalogue et demandez un devis, ou achetez directement les services prêts."],
      zh: ["政务与企业服务", "从目录中选择并申请报价，或直接购买现成服务。"],
    },
    {
      to: "/packages",
      ar: ["الباقات", "باقات جاهزة تجمع الخدمات المتكررة في طلب واحد."],
      en: ["Packages", "Ready packages that bundle recurring services into one request."],
      fr: ["Forfaits", "Des forfaits prêts qui regroupent les services récurrents en une seule demande."],
      zh: ["套餐", "把常用的重复性服务打包成一次申请的现成套餐。"],
    },
    {
      to: "/eor",
      ar: ["موظفون على بند التعاقد (EOR)", "موظفوك يعملون عندك ونحن صاحب العمل الرسمي: التعاقد والرواتب والتأمينات والإجازات."],
      en: ["Employer of Record (EOR)", "Your staff work for you and we are the official employer: contracting, payroll, insurance and leave."],
      fr: ["Employeur officiel (EOR)", "Votre équipe travaille pour vous et nous sommes l'employeur officiel : contrats, paie, assurances et congés."],
      zh: ["名义雇主（EOR）", "员工为您工作，我们担任法定雇主：合同、薪资、保险与休假。"],
    },
    {
      to: "/hiring",
      ar: ["التوظيف", "ابحث عن مرشحين وأعلن عن وظائفك وتابع الطلبات من مكان واحد."],
      en: ["Hiring", "Search candidates, post your jobs and follow applications in one place."],
      fr: ["Recrutement", "Recherchez des candidats, publiez vos offres et suivez les candidatures au même endroit."],
      zh: ["招聘", "在一处搜索候选人、发布职位并跟进申请。"],
    },
    {
      to: "/ai-agents",
      ar: ["المستشارون الأذكياء", "مستشارون متخصصون يخدمونك على مدار الساعة."],
      en: ["Smart advisors", "Specialised advisors serving you around the clock."],
      fr: ["Conseillers intelligents", "Des conseillers spécialisés à votre service à toute heure."],
      zh: ["智能顾问", "全天候为您服务的专业顾问。"],
    },
    {
      to: "/trips",
      ar: ["محفول مكفول", "زيارة المستثمر والرحلات السياحية الداخلية وفعاليات الشركات."],
      en: ["Mahmool Makfol", "The investor visit, domestic tourism trips and corporate events."],
      fr: ["Mahmool Makfol", "La visite investisseur, les voyages touristiques intérieurs et les événements d'entreprise."],
      zh: ["Mahmool Makfol", "投资者考察、境内旅游行程与企业活动。"],
    },
  ],
  valH: { ar: "ما الذي يوجّه عملنا", en: "What guides our work", fr: "Ce qui guide notre travail", zh: "指引我们工作的价值" },
  vals: [
    {
      ar: ["الوضوح", "أتعاب ورسوم ومدد معلنة قبل أن تبدأ."],
      en: ["Clarity", "Fees, charges and timelines disclosed before you start."],
      fr: ["Clarté", "Honoraires, frais et délais annoncés avant de commencer."],
      zh: ["清晰", "费用、收费与时限在开始前明示。"],
    },
    {
      ar: ["السرعة", "مسارات جاهزة تختصر الوقت."],
      en: ["Speed", "Ready-made tracks that save time."],
      fr: ["Rapidité", "Des parcours prêts qui font gagner du temps."],
      zh: ["高效", "现成的路径，节省时间。"],
    },
    {
      ar: ["الموثوقية", "التزام بالأنظمة ومتابعة حتى الإصدار."],
      en: ["Reliability", "Compliance with regulations and follow-up to issuance."],
      fr: ["Fiabilité", "Respect de la réglementation et suivi jusqu'à l'émission."],
      zh: ["可靠", "遵守法规，并跟进到办结。"],
    },
    {
      ar: ["التقنية", "مستشار ذكي يخدمك على مدار الساعة."],
      en: ["Technology", "A smart advisor serving you around the clock."],
      fr: ["Technologie", "Un conseiller intelligent à votre service à toute heure."],
      zh: ["科技", "智能顾问全天候为您服务。"],
    },
  ],
  idH: { ar: "بياناتنا النظامية", en: "Our legal details", fr: "Nos informations légales", zh: "我们的法定信息" },
  idSub: {
    ar: "الجهة التي تتعاقد معك وتصدر فاتورتك الضريبية.",
    en: "The entity that contracts with you and issues your tax invoice.",
    fr: "L'entité qui contracte avec vous et émet votre facture fiscale.",
    zh: "与您签约并开具税务发票的主体。",
  },
  idName: { ar: "الاسم التجاري", en: "Company name", fr: "Raison sociale", zh: "公司名称" },
  idUnified: { ar: "الرقم الموحّد", en: "Unified number", fr: "Numéro unifié", zh: "统一编号" },
  idVat: { ar: "الرقم الضريبي", en: "VAT number", fr: "N° de TVA", zh: "税号" },
  idShort: { ar: "العنوان الوطني المختصر", en: "Short national address", fr: "Adresse nationale courte", zh: "国家简短地址" },
  endH: { ar: "جاهز نبدأ رحلتك؟", en: "Ready to start your journey?", fr: "Prêt à démarrer ?", zh: "准备好开始了吗？" },
  endP: {
    ar: "ابدأ بمحادثة مع المستشار الذكي، أو اختر خدمتك من الكتالوج.",
    en: "Start with a chat with the smart advisor, or pick your service from the catalogue.",
    fr: "Commencez par échanger avec le conseiller intelligent, ou choisissez votre service dans le catalogue.",
    zh: "先与智能顾问对话，或直接从目录中选择服务。",
  },

  // ------- تواصل
  ctTag: { ar: "تواصل معنا", en: "Contact us", fr: "Contactez-nous", zh: "联系我们" },
  ctH1: { ar: "نجاوبك فوراً", en: "We reply instantly", fr: "Nous répondons rapidement", zh: "我们会尽快回复" },
  ctLead: {
    ar: "املأ النموذج ونعاود التواصل معك، أو تواصل معنا هاتفياً أو بالبريد.",
    en: "Fill in the form and we'll get back to you, or reach us by phone or email.",
    fr: "Remplissez le formulaire et nous revenons vers vous, ou contactez-nous par téléphone ou par e-mail.",
    zh: "填写表单，我们会与您联系；也可以直接电话或邮件联系我们。",
  },
  infoH: { ar: "معلومات التواصل", en: "Contact information", fr: "Coordonnées", zh: "联系方式" },
  phone: { ar: "الهاتف", en: "Phone", fr: "Téléphone", zh: "电话" },
  email: { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "电子邮箱" },
  address: { ar: "العنوان", en: "Address", fr: "Adresse", zh: "地址" },
  hours: { ar: "أوقات العمل", en: "Working hours", fr: "Horaires", zh: "工作时间" },
  hoursVal: {
    ar: "الأحد – الخميس · 9 صباحاً – 6 مساءً · والمستشار الذكي على مدار الساعة",
    en: "Sun–Thu · 9 AM – 6 PM · and the smart advisor around the clock",
    fr: "Dim.–jeu. · 9 h – 18 h · et le conseiller intelligent à toute heure",
    zh: "周日至周四 · 上午9点至下午6点 · 智能顾问全天候在线",
  },
  map: { ar: "افتح الموقع على الخريطة", en: "Open the location on the map", fr: "Ouvrir sur la carte", zh: "在地图中打开" },
  follow: { ar: "تابعنا", en: "Follow us", fr: "Suivez-nous", zh: "关注我们" },
  pathsH: { ar: "تبحث عن شيء محدد؟", en: "Looking for something specific?", fr: "Vous cherchez quelque chose de précis ?", zh: "想找特定服务？" },
  paths: [
    { to: "/#advisor", ar: "ابدأ طلباً جديداً", en: "Start a new request", fr: "Démarrer une nouvelle demande", zh: "发起新申请" },
    { to: "/consultation", ar: "احجز استشارة", en: "Book a consultation", fr: "Réserver une consultation", zh: "预约咨询" },
    { to: "/my", ar: "تابع طلبك من حسابك", en: "Track your request in your account", fr: "Suivre votre demande dans votre compte", zh: "在账户中跟进申请" },
    { to: "/careers", ar: "الوظائف لدينا", en: "Careers with us", fr: "Carrières chez nous", zh: "加入我们" },
    { to: "/suppliers", ar: "الشركاء والموردون", en: "Partners and suppliers", fr: "Partenaires et fournisseurs", zh: "合作伙伴与供应商" },
  ],
  formH: { ar: "أرسل رسالتك", en: "Send your message", fr: "Envoyez votre message", zh: "发送留言" },
  fName: { ar: "الاسم", en: "Name", fr: "Nom", zh: "姓名" },
  fNameP: { ar: "اسمك الكامل", en: "Your full name", fr: "Votre nom complet", zh: "您的全名" },
  fPhone: { ar: "رقم الجوال", en: "Mobile", fr: "Mobile", zh: "手机号" },
  fEmail: { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "电子邮箱" },
  fService: { ar: "الخدمة المطلوبة", en: "Service needed", fr: "Service souhaité", zh: "所需服务" },
  fServiceP: { ar: "مثال: تأسيس شركة، إقامة مميزة", en: "e.g. company formation, premium residency", fr: "ex. création de société, résidence premium", zh: "例如：公司设立、尊享居留" },
  fMsg: { ar: "تفاصيل طلبك", en: "Your request details", fr: "Détails de votre demande", zh: "需求详情" },
  fMsgP: { ar: "اكتب استفسارك هنا", en: "Write your enquiry here", fr: "Écrivez votre demande ici", zh: "请在此填写您的问题" },
  fSend: { ar: "أرسل طلبك", en: "Send your request", fr: "Envoyer votre demande", zh: "提交" },
  fNote: {
    ar: "يصلنا طلبك ونعاود التواصل معك عبر البريد أو الجوال.",
    en: "We'll receive your request and get back to you by email or phone.",
    fr: "Nous recevons votre demande et revenons vers vous par e-mail ou téléphone.",
    zh: "我们收到后将通过邮件或电话与您联系。",
  },
  mMissing: {
    ar: "الرجاء إدخال اسمك وبريدك الإلكتروني حتى نتمكن من الرد عليك.",
    en: "Please enter your name and email address so we can reply to you.",
    fr: "Veuillez saisir votre nom et votre e-mail pour que nous puissions vous répondre.",
    zh: "请填写姓名和邮箱，以便我们回复您。",
  },
  mEmail: {
    ar: "البريد الإلكتروني غير صحيح — تحقّق منه من فضلك.",
    en: "This email address doesn't look right — please check it.",
    fr: "Cette adresse e-mail semble incorrecte — merci de la vérifier.",
    zh: "邮箱格式似乎不正确，请检查。",
  },
  mSending: { ar: "جارٍ الإرسال…", en: "Sending…", fr: "Envoi…", zh: "发送中…" },
  mOk: {
    ar: "شكراً لك — وصل طلبك لفريقنا وسنعاود التواصل معك قريباً.",
    en: "Thank you — your request has reached our team and we'll get back to you soon.",
    fr: "Merci — votre demande est parvenue à notre équipe et nous revenons vers vous rapidement.",
    zh: "谢谢——您的请求已送达团队，我们会尽快与您联系。",
  },
  mRef: { ar: "رقم المرجع", en: "Reference number", fr: "Numéro de référence", zh: "参考编号" },
  mInvalid: {
    ar: "لم يقبل الخادم البيانات — تحقّق من الاسم والبريد الإلكتروني ثم أعد المحاولة.",
    en: "The server didn't accept the details — please check your name and email and try again.",
    fr: "Le serveur n'a pas accepté les informations — vérifiez votre nom et votre e-mail puis réessayez.",
    zh: "服务器未接受这些信息，请检查姓名和邮箱后重试。",
  },
  mFail: {
    ar: "تعذّر إرسال طلبك الآن. حاول مرة أخرى بعد قليل، أو راسلنا على {email}.",
    en: "We couldn't send your request right now. Please try again in a moment, or email us at {email}.",
    fr: "Impossible d'envoyer votre demande pour le moment. Réessayez dans un instant, ou écrivez-nous à {email}.",
    zh: "暂时无法发送。请稍后重试，或发邮件至 {email}。",
  },
};

const ICONS = {
  phone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

const SOCIAL = [["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"]];

function helpers(ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e && (e[lang] != null ? e[lang] : e.en)) || "";
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const href = (p) => (p === "/" ? pre + "/" : p.startsWith("/#") ? pre + p : pre + p);
  const arrow = lang === "ar" ? "←" : "→";
  return { lang, pick, t, pre, href, arrow, esc };
}

const SHARED_CSS = `<style id="sv1-pub-css">
.sv1-pub-head{max-width:820px;margin:0 0 34px}
.sv1-pub-head h1{font-size:clamp(30px,4.4vw,52px);line-height:1.15;margin:16px 0 14px;letter-spacing:-.035em;font-weight:200;color:var(--ink)}
.sv1-pub-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}
.sv1-pub-sh{margin:0 0 18px}
.sv1-pub-head+.sv1-pub-sh{margin-top:52px}
.sv1-pub-sh h2{font-size:clamp(22px,2.6vw,30px);font-weight:300;color:var(--ink);margin:0 0 6px;letter-spacing:-.025em}
.sv1-pub-sh p{color:var(--mut);margin:0;font-size:14px}
.sv1-pub-grid{display:grid;gap:12px}
.sv1-pub-g3{grid-template-columns:repeat(3,1fr)}
.sv1-pub-g4{grid-template-columns:repeat(4,1fr)}
.sv1-pub-card{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:20px 18px;box-shadow:var(--sh);color:inherit;text-decoration:none}
.sv1-pub-card h3{font-size:16px;font-weight:600;color:var(--ink);margin:0;line-height:1.45}
.sv1-pub-card p{font-size:13.5px;color:var(--mut);margin:0;line-height:1.8}
a.sv1-pub-card{transition:transform .15s ease,border-color .2s ease,box-shadow .2s ease}
a.sv1-pub-card:hover,a.sv1-pub-card:focus-visible{transform:translateY(-2px);border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1-pub-go{margin-top:auto;padding-top:8px;font-size:13px;font-weight:600;color:var(--ac)}
.sv1-pub-n{font-style:normal;font-family:var(--fm);width:34px;height:34px;background:var(--acSoft);color:var(--ac);border-radius:10px;display:grid;place-items:center;font-weight:600;font-size:14px;margin-bottom:4px}
.sv1-pub-band{background:var(--n);color:#fff;border-radius:16px;padding:34px 28px;text-align:center}
.sv1-pub-band h2{font-size:clamp(22px,2.8vw,30px);font-weight:300;color:#fff;margin:0 0 8px}
.sv1-pub-band p{margin:0 auto 18px;color:rgba(255,255,255,.78);max-width:560px;line-height:1.8}
.sv1-pub-band .sv1-pub-acts{justify-content:center;margin-top:0}
.sv1-pub-band .sv1-btn{background:#fff;color:var(--n);border-color:#fff}
.sv1-pub-band .sv1-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}
.sv1-pub-id{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:20px;box-shadow:var(--sh)}
.sv1-pub-id div{display:flex;flex-direction:column;gap:3px;min-width:0}
.sv1-pub-id span{font-size:12px;color:var(--mut)}
.sv1-pub-id b{font-size:15px;color:var(--ink);font-weight:600;overflow-wrap:anywhere}
.sv1-pub-two{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}
.sv1-pub-info{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.sv1-pub-info li{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid var(--l);border-radius:14px;padding:14px 16px;box-shadow:var(--sh)}
.sv1-pub-ico{flex:none;width:42px;height:42px;border-radius:11px;background:var(--acSoft);color:var(--ac);display:grid;place-items:center}
.sv1-pub-info .k{font-size:12px;color:var(--mut);margin-bottom:2px}
.sv1-pub-info .v{font-size:15px;font-weight:600;color:var(--ink);line-height:1.7;overflow-wrap:anywhere}
.sv1-pub-info a.v{text-decoration:none}
.sv1-pub-info a.v:hover{color:var(--ac)}
.sv1-pub-maplink{display:inline-block;margin-top:4px;font-size:13px;font-weight:600;color:var(--ac);text-decoration:none}
.sv1-pub-social{display:flex;gap:8px;margin-top:16px;align-items:center;flex-wrap:wrap}
.sv1-pub-social>span{font-size:12.5px;color:var(--mut);margin-inline-end:4px}
.sv1-pub-social a{width:40px;height:40px;border-radius:11px;border:1px solid var(--l);background:#fff;display:grid;place-items:center;color:var(--ink)}
.sv1-pub-social a:hover{border-color:var(--ac);color:var(--ac)}
.sv1-pub-paths{margin-top:22px}
.sv1-pub-paths h3{font-size:14px;margin:0 0 10px;color:var(--ink)}
.sv1-pub-paths div{display:flex;gap:8px;flex-wrap:wrap}
.sv1-pub-paths a{font-size:13px;padding:7px 14px;border:1px solid var(--l);border-radius:999px;background:#fff;color:var(--ink);text-decoration:none}
.sv1-pub-paths a:hover{border-color:var(--ink)}
.sv1-pub-form{background:#fff;border:1px solid var(--l);border-radius:16px;padding:24px;box-shadow:var(--sh2)}
.sv1-pub-form h2{font-size:22px;font-weight:300;color:var(--ink);margin:0 0 16px}
.sv1-pub-form .f{margin:0 0 13px}
.sv1-pub-form label{display:block;font-size:12.5px;font-weight:600;color:var(--ink);margin-bottom:6px}
.sv1-pub-form input,.sv1-pub-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:16px;background:#fff;outline:none;color:var(--ink)}
.sv1-pub-form input:focus,.sv1-pub-form textarea:focus{border-color:var(--ac)}
.sv1-pub-form textarea{min-height:110px;resize:vertical}
.sv1-pub-form .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-pub-form button[type=submit]{width:100%;margin-top:4px;padding:13px;font-size:15px}
.sv1-pub-form .note{font-size:12px;color:var(--mut);margin:12px 0 0;line-height:1.7}
.sv1-pub-form .status{font-size:13.5px;margin:12px 0 0;line-height:1.7}
.sv1-pub-form .status.err{color:#b42318}
.sv1-pub-form .done{font-size:15px;color:var(--ink);line-height:1.9}
.sv1-pub-form .done b{color:var(--ok)}
@media(max-width:1000px){.sv1-pub-g4{grid-template-columns:repeat(2,1fr)}.sv1-pub-g3{grid-template-columns:1fr 1fr}.sv1-pub-two{grid-template-columns:1fr}}
@media(max-width:600px){.sv1-pub-g4,.sv1-pub-g3{grid-template-columns:1fr}.sv1-pub-form{padding:18px}.sv1-pub-form .row2{grid-template-columns:1fr}.sv1-pub-band{padding:26px 18px}}
</style>`;

// ------------------------------------------------------------------ about --
export function buildSimpleAbout(SV1, ctx, site) {
  const { lang, pick, t, href, arrow, esc } = helpers(ctx);
  const legal = (site && site.legal) || {};
  const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
  const unified = digits(legal.unified);
  const vat = digits(legal.vat);
  const idName = String((lang === "ar" ? legal.name : legal.nameEn) || legal.name || "").trim();
  const idRows = [
    idName && [t("idName"), `<b>${esc(idName)}</b>`],
    /^7\d{9}$/.test(unified) && [t("idUnified"), `<b><bdi dir="ltr">${esc(unified)}</bdi></b>`],
    /^3\d{13}3$/.test(vat) && [t("idVat"), `<b><bdi dir="ltr">${esc(vat)}</bdi></b>`],
    legal.shortAddress && [t("idShort"), `<b><bdi dir="ltr">${esc(legal.shortAddress)}</bdi></b>`],
  ].filter(Boolean);

  const pillars = T.secs.map((s, i) => {
    const [h, p] = pick(s);
    return `<div class="sv1-pub-card"><span class="sv1-pub-n">${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`;
  }).join("");
  const offers = T.offers.map((o) => {
    const [h, p] = pick(o);
    return `<a class="sv1-pub-card" href="${esc(href(o.to))}" data-track="من نحن: ${esc(o.to)}"><h3>${esc(h)}</h3><p>${esc(p)}</p><span class="sv1-pub-go">${esc(t("open"))} ${arrow}</span></a>`;
  }).join("");
  const vals = T.vals.map((v) => {
    const [h, p] = pick(v);
    return `<div class="sv1-pub-card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`;
  }).join("");

  const body = `${SV1.header("/about")}
<main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-pub-head">
      <span class="sv1-tag">${esc(t("aboutTag"))}</span>
      <h1>${esc(t("aboutH1"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("aboutLead"))}</p>
      <div class="sv1-pub-acts">
        <a class="sv1-btn primary" href="${esc(href("/#advisor"))}" data-track="من نحن: ابدأ طلبك">${esc(t("start"))}</a>
        <a class="sv1-btn" href="${esc(href("/catalog"))}" data-track="من نحن: الخدمات">${esc(t("browse"))}</a>
      </div>
    </div>
    <div class="sv1-pub-sh"><h2>${esc(t("howH"))}</h2><p>${esc(t("howSub"))}</p></div>
    <div class="sv1-pub-grid sv1-pub-g3">${pillars}</div>
  </div></section>

  <section class="sv1-sec sv1-gray"><div class="wrap">
    <div class="sv1-pub-sh"><h2>${esc(t("doH"))}</h2><p>${esc(t("doSub"))}</p></div>
    <div class="sv1-pub-grid sv1-pub-g3">${offers}</div>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-pub-sh"><h2>${esc(t("valH"))}</h2></div>
    <div class="sv1-pub-grid sv1-pub-g4">${vals}</div>
  </div></section>
${idRows.length ? `
  <section class="sv1-sec sv1-gray" style="padding-top:44px;padding-bottom:44px"><div class="wrap">
    <div class="sv1-pub-sh"><h2>${esc(t("idH"))}</h2><p>${esc(t("idSub"))}</p></div>
    <div class="sv1-pub-id">${idRows.map(([k, v]) => `<div><span>${esc(k)}</span>${v}</div>`).join("")}</div>
  </div></section>` : ""}

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-pub-band">
      <h2>${esc(t("endH"))}</h2>
      <p>${esc(t("endP"))}</p>
      <div class="sv1-pub-acts">
        <a class="sv1-btn" href="${esc(href("/#advisor"))}" data-track="من نحن: ابدأ الآن">${esc(t("start"))}</a>
        <a class="sv1-btn ghost" href="${esc(href("/contact"))}" data-track="من نحن: تواصل">${esc(t("contactUs"))}</a>
      </div>
    </div>
  </div></section>
</main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${t("aboutTag")} — Business Partner`,
    desc: t("aboutLead"),
    path: "/about",
    body: SHARED_CSS + body,
  });
}

// ---------------------------------------------------------------- contact --
export function buildSimpleContact(SV1, ctx, site) {
  const { lang, pick, t, href, esc } = helpers(ctx);
  const c = (site && site.contact) || {};
  const soc = (site && site.social) || {};
  const addr = lang === "ar" ? c.address : c.addressEn || c.address;
  // الساعات من site.json تحمل «smart agent» بالإنجليزية؛ التسمية المعتمدة «المستشار الذكي».
  const hours = c.hours ? t("hoursVal") : "";
  // الخريطة تبحث بعنوان الشركة المسجَّل نفسه (الدرعية) — الإطار القديم كان
  // يشير إلى «حي الملقا» فيعرض موقعاً غير موقعنا.
  const mapQuery = [c.addressEn || c.address, "Saudi Arabia"].filter(Boolean).join(", ");
  const mapHref = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapQuery);

  const icons = {
    linkedin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3zM9.75 9.75h3.8v1.54h.06c.53-1 1.82-2.05 3.75-2.05 4 0 4.74 2.63 4.74 6.05V21h-4v-4.9c0-1.17-.02-2.67-1.63-2.67-1.63 0-1.88 1.27-1.88 2.59V21h-4z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.6 3c.3 2.4 1.7 3.9 4 4v3.1c-1.4.1-2.7-.3-4-1.1v6.1c0 3.4-2.6 5.9-5.7 5.9A5.6 5.6 0 0 1 5.2 15.4c0-3.4 2.8-6 6.3-5.6v3.3a2.5 2.5 0 0 0-3.1 2.4 2.4 2.4 0 0 0 2.5 2.4c1.4 0 2.5-1 2.5-2.7V3z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.6V13h2.7v8z"/></svg>',
  };
  const social = SOCIAL.filter(([k]) => soc[k]).map(([k, label]) => `<a href="${esc(soc[k])}" target="_blank" rel="noopener" aria-label="${label}">${icons[k]}</a>`).join("");

  const info = [
    c.phone && ["phone", t("phone"), `<a class="v" href="tel:${esc(c.phoneIntl || c.phone)}"><bdi dir="ltr">${esc(c.phone)}</bdi></a>`],
    c.email && ["mail", t("email"), `<a class="v" href="mailto:${esc(c.email)}"><bdi dir="ltr">${esc(c.email)}</bdi></a>`],
    addr && ["pin", t("address"), `<div class="v">${esc(addr)}</div><a class="sv1-pub-maplink" href="${esc(mapHref)}" target="_blank" rel="noopener">${esc(t("map"))}</a>`],
    hours && ["clock", t("hours"), `<div class="v">${esc(hours)}</div>`],
  ].filter(Boolean).map(([ic, k, v]) => `<li><span class="sv1-pub-ico">${ICONS[ic]}</span><div><div class="k">${esc(k)}</div>${v}</div></li>`).join("");

  const paths = T.paths.map((p) => `<a href="${esc(href(p.to))}" data-track="تواصل: ${esc(p.to)}">${esc(pick(p))}</a>`).join("");

  const MSG = {
    missing: t("mMissing"), email: t("mEmail"), sending: t("mSending"), ok: t("mOk"), ref: t("mRef"),
    invalid: t("mInvalid"), fail: t("mFail"), to: c.email || "business@businesspartner.sa",
  };

  const body = `${SV1.header("/contact")}
<main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-pub-head" style="margin-bottom:28px">
      <span class="sv1-tag">${esc(t("ctTag"))}</span>
      <h1>${esc(t("ctH1"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("ctLead"))}</p>
    </div>
    <div class="sv1-pub-two">
      <div>
        <div class="sv1-pub-sh"><h2>${esc(t("infoH"))}</h2></div>
        <ul class="sv1-pub-info">${info}</ul>
        ${social ? `<div class="sv1-pub-social"><span>${esc(t("follow"))}</span>${social}</div>` : ""}
        <div class="sv1-pub-paths"><h3>${esc(t("pathsH"))}</h3><div>${paths}</div></div>
      </div>
      <div>
        <form class="sv1-pub-form" id="sv1ContactForm" novalidate>
          <h2>${esc(t("formH"))}</h2>
          <div class="f"><label for="cf-name">${esc(t("fName"))}</label><input id="cf-name" name="name" type="text" autocomplete="name" placeholder="${esc(t("fNameP"))}" required></div>
          <div class="row2">
            <div class="f"><label for="cf-phone">${esc(t("fPhone"))}</label><input id="cf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xxxxxxxx"></div>
            <div class="f"><label for="cf-email">${esc(t("fEmail"))}</label><input id="cf-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@company.com" dir="ltr" required></div>
          </div>
          <div class="f"><label for="cf-service">${esc(t("fService"))}</label><input id="cf-service" name="service" type="text" placeholder="${esc(t("fServiceP"))}"></div>
          <div class="f"><label for="cf-msg">${esc(t("fMsg"))}</label><textarea id="cf-msg" name="message" rows="4" placeholder="${esc(t("fMsgP"))}"></textarea></div>
          <button type="submit" class="sv1-btn primary" id="cf-send" data-track="تواصل: إرسال">${esc(t("fSend"))}</button>
          <p class="status err" id="cf-status" role="alert" aria-live="polite" hidden></p>
          <p class="note">${esc(t("fNote"))}</p>
        </form>
      </div>
    </div>
  </div></section>
</main>
${SV1.footer()}`;

  // عقد main.js حرفاً: type=support-ticket، sid=contact-form، والنجاح لا يُعلن
  // إلا بعد ok:true من الخادم. النصوص تُحقن من المولّد باللغة الحالية.
  const script = `<script>(function(){
var M=${JSON.stringify(MSG).replace(/</g, "\\u003c")};
var f=document.getElementById('sv1ContactForm');if(!f)return;
var st=document.getElementById('cf-status'),btn=document.getElementById('cf-send'),label=btn.textContent;
function v(id){var e=document.getElementById(id);return e?e.value.trim():''}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function err(h){st.hidden=false;st.innerHTML=h}
function failHtml(){return esc(M.fail).replace('{email}','<a href="mailto:'+esc(M.to)+'">'+esc(M.to)+'</a>')}
function busy(on){btn.disabled=on;btn.textContent=on?M.sending:label}
f.addEventListener('submit',function(e){e.preventDefault();
 var name=v('cf-name'),phone=v('cf-phone'),email=v('cf-email'),service=v('cf-service'),msg=v('cf-msg');
 if(!name||!email){err(esc(M.missing));document.getElementById(!name?'cf-name':'cf-email').focus();return}
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)){err(esc(M.email));document.getElementById('cf-email').focus();return}
 st.hidden=true;busy(true);
 fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'support-ticket',sid:'contact-form',contact:{name:name,phone:phone,email:email},service:{nameAr:service,categoryAr:'نموذج التواصل'},note:msg})})
 .then(function(r){return r.json().catch(function(){return{}}).then(function(d){return{s:r.status,d:d||{}}})})
 .then(function(res){
  if(res.s===200&&res.d.ok===true){var ref=res.d.ref?'<div style="margin-top:8px;font-size:13.5px">'+esc(M.ref)+': <b dir="ltr">'+esc(res.d.ref)+'</b></div>':'';f.innerHTML='<div class="done" role="status"><b>\\u2713</b> '+esc(M.ok)+ref+'</div>';return}
  busy(false);err(res.s===400?esc(M.invalid):failHtml())})
 .catch(function(){busy(false);err(failHtml())})});
})();</script>`;

  return SV1.shell({
    title: `${t("ctTag")} — Business Partner`,
    desc: t("ctLead"),
    path: "/contact",
    body: SHARED_CSS + body,
    script,
  });
}
