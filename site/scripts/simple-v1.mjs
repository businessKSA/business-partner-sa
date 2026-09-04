// Business Partner — Simple V1 (2026-09).
//
// The simplified customer-facing layer: one homepage that sells three things
// (consulting, government services, company formation) through ONE chat, a
// client portal (/my) and an operations dashboard (/ops). Built by
// generate.mjs alongside the classic site; nothing here removes a classic
// route. This homepage IS "/" as of the owner's approval on 2026-09-04; the
// classic homepage moved to /classic-home and still builds. SIMPLE_V1=0 puts
// the classic page back at "/" without touching any code.
//
// Layout follows the approved concept file business_partner_simple_v1_refined
// .html (2026-09-03): hero text beside three service doors, a three-step
// "you don't need to know the service name" band, one app panel with the
// conversation on one side and the editable scope always visible on the other,
// a six-step journey strip, and a preview of the two dashboards. The visible
// brand is "Business Partner" in every language, drawn with the official logo
// asset — the concept's temporary letter-mark is placeholder branding.
// No price appears here: the catalogue stays in the backend and the figure
// reaches the customer in the quotation for the scope they approved.
//
// Four languages (ar/en/fr/zh) from the dictionary below — the pages are
// authored once and rendered per language by generate.mjs' language loop.

// Owner approval 2026-09-04: Simple V1 is the site. The flag flipped from
// opt-in to opt-out, so the switch lives in the repository where it shows up
// in a diff, instead of a dashboard field nobody can review. Rollback stays
// one step — SIMPLE_V1=0 in the environment, or revert this line — and the
// classic homepage comes back untouched at "/".
export const SIMPLE_V1 = process.env.SIMPLE_V1 !== "0";
export const SIMPLE_LANGS = ["ar", "en", "fr", "zh"];

const D = {
  // The visible company name is "Business Partner" in every language — the
  // Arabic renderings («شريك الأعمال» / «شريك أعمالك») are not used as the brand.
  brand: { ar: "Business Partner", en: "Business Partner", fr: "Business Partner", zh: "Business Partner" },
  heroTag: { ar: "Business Partner", en: "Business Partner", fr: "Business Partner", zh: "Business Partner" },
  navServices: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  navHow: { ar: "كيف نبدأ", en: "How it works", fr: "Comment ça marche", zh: "如何开始" },
  navAccount: { ar: "حسابي", en: "My account", fr: "Mon compte", zh: "我的账户" },
  login: { ar: "دخول", en: "Sign in", fr: "Connexion", zh: "登录" },
  navStart: { ar: "ابدأ طلبك", en: "Start your request", fr: "Démarrer une demande", zh: "开始申请" },
  heroTitle: { ar: "قل لنا وش تحتاج،<br>ونبدأ معك من هنا.", en: "Tell us what you need,<br>and we start here with you.", fr: "Dites-nous ce qu'il vous faut,<br>et nous commençons ici.", zh: "告诉我们您的需求，<br>我们从这里开始。" },
  heroText: { ar: "اختر نوع الخدمة أو ابدأ المحادثة مباشرة. نفهم طلبك، ونجهّز لك الخطوات المناسبة، وبعدها تكمل كل شيء من حسابك.", en: "Pick a service or just start the conversation. We understand the request, prepare the right steps, and you finish everything from your account.", fr: "Choisissez un service ou lancez simplement la conversation. Nous comprenons votre demande, préparons les bonnes étapes, et vous finalisez tout depuis votre compte.", zh: "选择服务类型，或直接开始对话。我们理解您的需求、准备相应步骤，随后您在账户中完成全部流程。" },
  heroChat: { ar: "ابدأ محادثة", en: "Start a conversation", fr: "Démarrer la conversation", zh: "开始对话" },
  heroWa: { ar: "أكمل على واتساب", en: "Continue on WhatsApp", fr: "Continuer sur WhatsApp", zh: "在 WhatsApp 继续" },

  trust1: { ar: "الاستشارات", en: "Consulting", fr: "Conseil", zh: "咨询" },
  trust2: { ar: "الخدمات الحكومية", en: "Government services", fr: "Services gouvernementaux", zh: "政府服务" },
  trust3: { ar: "تأسيس الشركات", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" },

  noNameTitle: { ar: "ما تحتاج تعرف اسم الخدمة", en: "You don't need to know the name of the service", fr: "Vous n'avez pas besoin de connaître le nom du service", zh: "您无需知道服务的名称" },
  noNameSub: { ar: "اختر القسم المناسب أو اشرح طلبك مباشرة. نرتّب الطلب في الخلفية، وأنت تشوف فقط ما يخص احتياجك.", en: "Pick a section or just describe what you need. We organise the request in the background; you only see what relates to your need.", fr: "Choisissez une rubrique ou décrivez simplement votre besoin. Nous organisons la demande en arrière-plan ; vous ne voyez que ce qui vous concerne.", zh: "选择相应板块，或直接描述您的需求。我们在后台整理申请，您只看到与您相关的内容。" },
  nn1: { ar: "1. اشرح احتياجك", en: "1. Describe what you need", fr: "1. Décrivez votre besoin", zh: "1. 说明您的需求" },
  nn1s: { ar: "اكتب بالطريقة العادية، بلا نماذج طويلة.", en: "Write it normally — no long forms.", fr: "Écrivez normalement, sans formulaire interminable.", zh: "用平常的话写下来，无需冗长表单。" },
  nn2: { ar: "2. راجع طلبك", en: "2. Review your request", fr: "2. Revoyez votre demande", zh: "2. 检查您的申请" },
  nn2s: { ar: "نطاق الخدمات يظهر واضحاً وقابلاً للتعديل.", en: "The scope of work appears clearly, and you can edit it.", fr: "Le périmètre s'affiche clairement et reste modifiable.", zh: "服务范围清晰列出，且可自行修改。" },
  nn3: { ar: "3. كمّل من حسابك", en: "3. Finish from your account", fr: "3. Terminez depuis votre compte", zh: "3. 在账户中完成" },
  nn3s: { ar: "عرض سعر، عقد، دفع، فاتورة، ومتابعة.", en: "Quotation, contract, payment, invoice and follow-up.", fr: "Devis, contrat, paiement, facture et suivi.", zh: "报价、合同、付款、发票与跟进。" },

  ctxConsulting: { ar: "الاستشارات", en: "Consulting", fr: "Conseil", zh: "咨询" },
  ctxGovernment: { ar: "الخدمات الحكومية", en: "Government services", fr: "Services gouvernementaux", zh: "政府服务" },
  ctxFormation: { ar: "تأسيس الشركات", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" },
  doorConsulting: { ar: "سؤال، تحدٍّ، قرار أو موضوع يخص شركتك.", en: "A question, a challenge, a decision or any matter about your company.", fr: "Une question, un défi, une décision ou tout sujet concernant votre société.", zh: "关于贵公司的问题、挑战或决策。" },
  doorGovernment: { ar: "معاملة، مشكلة في منصة، أو إدارة منصاتك الحكومية.", en: "A transaction, a problem on a platform, or running your government platforms.", fr: "Une démarche, un problème sur une plateforme, ou la gestion de vos plateformes.", zh: "办理事务、平台问题，或代管您的政府平台。" },
  doorFormation: { ar: "فرع لشركة أجنبية أو شركة عبر مسار ريادة الأعمال.", en: "A branch of a foreign company, or a company via the entrepreneurship route.", fr: "Une succursale étrangère ou une société via le parcours entrepreneur.", zh: "外国公司分支机构，或通过创业路径设立公司。" },
  ctaConsulting: { ar: "ابدأ الاستشارة ←", en: "Start the consultation →", fr: "Démarrer le conseil →", zh: "开始咨询 →" },
  ctaGovernment: { ar: "ابدأ الطلب ←", en: "Start the request →", fr: "Démarrer la demande →", zh: "开始申请 →" },
  ctaFormation: { ar: "ابدأ التأسيس ←", en: "Start the formation →", fr: "Démarrer la création →", zh: "开始注册 →" },

  advisorTitle: { ar: "كل شيء يبدأ من المحادثة", en: "Everything starts with the conversation", fr: "Tout commence par la conversation", zh: "一切从对话开始" },
  advisorSub: { ar: "اشرح احتياجك بطريقتك، ونرتّب لك الطلب والخدمات المناسبة. راجع البنود بنفسك — احذف أو أضف أو عدّل — قبل عرض السعر.", en: "Explain your need in your own words and we organise the request and the right services. Review the items yourself — remove, add or edit — before the quotation.", fr: "Expliquez votre besoin avec vos mots ; nous organisons la demande et les services adaptés. Revoyez les éléments — supprimez, ajoutez, modifiez — avant le devis.", zh: "用您自己的话说明需求，我们整理申请与相应服务。在报价之前，您可自行删除、添加或修改条目。" },
  stepReq: { ar: "الطلب", en: "Request", fr: "Demande", zh: "申请" },
  stepQuote: { ar: "عرض السعر", en: "Quotation", fr: "Devis", zh: "报价" },
  stepContract: { ar: "العقد", en: "Contract", fr: "Contrat", zh: "合同" },
  stepPay: { ar: "الدفع", en: "Payment", fr: "Paiement", zh: "付款" },
  stepInvoice: { ar: "الفاتورة", en: "Invoice", fr: "Facture", zh: "发票" },
  chatPlaceholder: { ar: "اكتب طلبك هنا…", en: "Write your request here…", fr: "Écrivez votre demande ici…", zh: "在此写下您的需求…" },
  send: { ar: "إرسال", en: "Send", fr: "Envoyer", zh: "发送" },
  thinking: { ar: "نرتّب طلبك…", en: "Working on it…", fr: "Un instant…", zh: "正在处理…" },
  chatError: { ar: "تعذّر الرد الآن. جرّب مرة أخرى أو تواصل معنا عبر واتساب.", en: "We couldn't reply right now. Try again or reach us on WhatsApp.", fr: "Impossible de répondre pour le moment. Réessayez ou contactez-nous sur WhatsApp.", zh: "暂时无法回复，请重试或通过 WhatsApp 联系我们。" },
  welcomeConsulting: { ar: "حياك الله 👋 اشرح لي الموضوع اللي تحتاج تستشير فيه.", en: "Welcome 👋 Tell me the matter you'd like advice on.", fr: "Bienvenue 👋 Expliquez-moi le sujet sur lequel vous souhaitez un conseil.", zh: "欢迎 👋 请说明您想咨询的事项。" },
  welcomeGovernment: { ar: "حياك الله 👋 اشرح لي المعاملة أو المشكلة في المنصة.", en: "Welcome 👋 Tell me the transaction or the problem on the platform.", fr: "Bienvenue 👋 Décrivez la démarche ou le problème sur la plateforme.", zh: "欢迎 👋 请说明需要办理的事务或平台上的问题。" },
  welcomeFormation: { ar: "حياك الله 👋 قل لي عن الشركة اللي تبغى تؤسسها.", en: "Welcome 👋 Tell me about the company you want to set up.", fr: "Bienvenue 👋 Parlez-moi de la société que vous voulez créer.", zh: "欢迎 👋 请介绍您想设立的公司。" },

  scopeTag: { ar: "ملخص طلبك", en: "Your request", fr: "Votre demande", zh: "您的申请" },
  scopeHeading: { ar: "نطاق الخدمات", en: "Scope of Work", fr: "Périmètre des services", zh: "服务范围" },
  scopeNote: { ar: "هذا هو نطاق العمل الذي يقوم عليه عرض السعر. عدّله كما تشاء قبل أن ترسله.", en: "This is the scope of work the quotation is built on. Edit it as you like before sending.", fr: "C'est le périmètre sur lequel repose le devis. Modifiez-le avant de l'envoyer.", zh: "报价将以此服务范围为准，发送前可自行修改。" },
  scopeIn: { ar: "ضمن نطاق الطلب", en: "In scope", fr: "Dans le périmètre", zh: "在范围内" },
  docsHeading: { ar: "المستندات المطلوبة", en: "Documents required", fr: "Documents requis", zh: "所需文件" },
  docsNote: { ar: "لكل خدمة مستنداتها. جهّزها الآن أو أرفقها لاحقاً من حسابك.", en: "Every service has its own documents. Prepare them now, or attach them later from your account.", fr: "Chaque service a ses documents. Préparez-les maintenant ou joignez-les plus tard depuis votre compte.", zh: "每项服务都有其所需文件。现在准备，或稍后在账户中上传。" },
  docsEmpty: { ar: "تظهر هنا بعد أن يفهم المستشار طلبك.", en: "These appear once the advisor understands your request.", fr: "Ils apparaîtront une fois votre demande comprise.", zh: "顾问了解您的需求后将在此列出。" },
  docsAddPh: { ar: "أضف مستنداً…", en: "Add a document…", fr: "Ajouter un document…", zh: "添加文件…" },
  scopeAdd: { ar: "إضافة", en: "Add", fr: "Ajouter", zh: "添加" },
  scopeAddPh: { ar: "أضف بند…", en: "Add an item…", fr: "Ajouter un élément…", zh: "添加条目…" },
  typeLbl: { ar: "نوع الطلب", en: "Request type", fr: "Type de demande", zh: "申请类型" },
  stateLbl: { ar: "الحالة", en: "Status", fr: "Statut", zh: "状态" },
  stateReady: { ar: "جاهز للمراجعة", en: "Ready for review", fr: "Prêt pour révision", zh: "待审核" },
  sar: { ar: "ريال", en: "SAR", fr: "SAR", zh: "SAR" },
  createBtn: { ar: "إنشاء عرض السعر", en: "Create the quotation", fr: "Créer le devis", zh: "生成报价" },

  journeyTitle: { ar: "رحلة واحدة لكل الخدمات", en: "One journey for every service", fr: "Un seul parcours pour tous les services", zh: "所有服务，同一条流程" },
  journeySub: { ar: "ما يحتاج العميل يتعلم نظام جديد لكل خدمة.", en: "No customer has to learn a new system for each service.", fr: "Aucun client n'a à apprendre un nouveau système par service.", zh: "客户无需为每项服务学习新系统。" },
  j1: { ar: "محادثة", en: "Conversation", fr: "Conversation", zh: "对话" },
  j1s: { ar: "نفهم المطلوب", en: "We understand the need", fr: "Nous comprenons le besoin", zh: "了解需求" },
  j2: { ar: "نطاق الخدمات", en: "Scope of Work", fr: "Périmètre des services", zh: "服务范围" },
  j2s: { ar: "إضافة وحذف", en: "Add and remove", fr: "Ajouter et supprimer", zh: "增删条目" },
  j3: { ar: "عرض السعر", en: "Quotation", fr: "Devis", zh: "报价" },
  j3s: { ar: "موافقة العميل", en: "Customer approval", fr: "Accord du client", zh: "客户确认" },
  j4: { ar: "العقد", en: "Contract", fr: "Contrat", zh: "合同" },
  j4s: { ar: "توقيع إلكتروني", en: "Electronic signature", fr: "Signature électronique", zh: "电子签署" },
  j5: { ar: "الدفع", en: "Payment", fr: "Paiement", zh: "付款" },
  j5s: { ar: "دفع إلكتروني", en: "Online payment", fr: "Paiement en ligne", zh: "在线支付" },
  j6: { ar: "الفاتورة", en: "Invoice", fr: "Facture", zh: "发票" },
  j6s: { ar: "داخل الحساب", en: "Inside the account", fr: "Dans le compte", zh: "在账户中" },

  portalTitle: { ar: "حسابك: كل شيء في مكان واحد", en: "Your account: everything in one place", fr: "Votre compte : tout au même endroit", zh: "您的账户：一处掌握全部" },
  portalSub: { ar: "طلباتك وعروض أسعارك وعقودك ومواعيدك ومدفوعاتك وفواتيرك — تتابعها بنفسك في أي وقت.", en: "Your requests, quotations, contracts, appointments, payments and invoices — all followed by you, any time.", fr: "Vos demandes, devis, contrats, rendez-vous, paiements et factures — suivis par vous, à tout moment.", zh: "您的申请、报价、合同、预约、付款与发票 — 随时自行跟进。" },
  tabClient: { ar: "لوحة العميل", en: "Client portal", fr: "Espace client", zh: "客户面板" },
  tabAdmin: { ar: "لوحة الإدارة", en: "Operations dashboard", fr: "Tableau de bord", zh: "运营面板" },
  previewNote: { ar: "صورة توضيحية للواجهة — البيانات الحقيقية تظهر بعد تسجيل الدخول.", en: "Illustrative preview — real data appears after you sign in.", fr: "Aperçu illustratif — les données réelles apparaissent après connexion.", zh: "示意界面 — 登录后显示真实数据。" },
  openPortalBtn: { ar: "افتح حسابي", en: "Open my account", fr: "Ouvrir mon compte", zh: "打开我的账户" },
  openOpsBtn: { ar: "افتح لوحة الإدارة", en: "Open the dashboard", fr: "Ouvrir le tableau de bord", zh: "打开运营面板" },
  pClientHome: { ar: "الرئيسية", en: "Home", fr: "Accueil", zh: "首页" },
  pClientNew: { ar: "ابدأ طلب", en: "New request", fr: "Nouvelle demande", zh: "新申请" },
  pClientReqs: { ar: "طلباتي", en: "My requests", fr: "Mes demandes", zh: "我的申请" },
  pClientQuotes: { ar: "عروض الأسعار", en: "Quotations", fr: "Devis", zh: "报价" },
  pClientContracts: { ar: "العقود", en: "Contracts", fr: "Contrats", zh: "合同" },
  pClientAppts: { ar: "المواعيد", en: "Appointments", fr: "Rendez-vous", zh: "预约" },
  pClientPay: { ar: "السلة والدفع", en: "Cart & payment", fr: "Panier et paiement", zh: "购物车与付款" },
  pClientInv: { ar: "الفواتير", en: "Invoices", fr: "Factures", zh: "发票" },
  pClientChats: { ar: "المحادثات", en: "Conversations", fr: "Conversations", zh: "对话" },
  pAdminReqs: { ar: "الطلبات", en: "Requests", fr: "Demandes", zh: "申请" },
  pAdminPayments: { ar: "المدفوعات", en: "Payments", fr: "Paiements", zh: "付款" },
  pAdminWa: { ar: "واتساب", en: "WhatsApp", fr: "WhatsApp", zh: "WhatsApp" },
  pAdminCatalog: { ar: "الخدمات والأسعار", en: "Services & prices", fr: "Services et prix", zh: "服务与价格" },
  pAdminTasks: { ar: "المهام", en: "Tasks", fr: "Tâches", zh: "任务" },
  kActive: { ar: "طلبات نشطة", en: "Active requests", fr: "Demandes actives", zh: "进行中的申请" },
  kQuote: { ar: "عرض سعر", en: "Quotation", fr: "Devis", zh: "报价" },
  kSign: { ar: "عقد للتوقيع", en: "Contract to sign", fr: "Contrat à signer", zh: "待签合同" },
  kAppt: { ar: "موعد قادم", en: "Upcoming appointment", fr: "Prochain rendez-vous", zh: "即将预约" },
  kNew: { ar: "جديدة", en: "New", fr: "Nouvelles", zh: "新增" },
  kNeedQuote: { ar: "تحتاج عرضاً", en: "Need a quote", fr: "Devis à faire", zh: "待报价" },
  kWaitSign: { ar: "بانتظار التوقيع", en: "Awaiting signature", fr: "En attente de signature", zh: "待签署" },
  kPaid: { ar: "مدفوعة", en: "Paid", fr: "Payées", zh: "已付款" },
  todayReqs: { ar: "طلبات اليوم", en: "Today's requests", fr: "Demandes du jour", zh: "今日申请" },
  onlyAction: { ar: "فقط ما يحتاج منك إجراءً.", en: "Only what needs an action from you.", fr: "Uniquement ce qui demande une action.", zh: "只显示需要您处理的事项。" },
  goodMorning: { ar: "أهلاً بك 👋", en: "Welcome 👋", fr: "Bienvenue 👋", zh: "欢迎 👋" },
  topToday: { ar: "هذه أهم الأشياء في حسابك اليوم.", en: "The things that matter in your account today.", fr: "L'essentiel de votre compte aujourd'hui.", zh: "今天您账户中的要点。" },

  loginTitle: { ar: "آخر خطوة: بريدك الإلكتروني", en: "Last step: your email", fr: "Dernière étape : votre e-mail", zh: "最后一步：您的邮箱" },
  loginText: { ar: "نرسل لك رمز دخول لنحفظ الطلب في حسابك وتتابعه من مكان واحد.", en: "We'll send a sign-in code so the request is saved to your account.", fr: "Nous envoyons un code de connexion pour enregistrer la demande dans votre compte.", zh: "我们将发送登录验证码，将申请保存到您的账户。" },
  loginName: { ar: "الاسم", en: "Name", fr: "Nom", zh: "姓名" },
  loginPhone: { ar: "رقم الجوال", en: "Mobile number", fr: "Numéro de mobile", zh: "手机号码" },
  loginEmail: { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "邮箱" },
  loginSend: { ar: "أرسل الرمز", en: "Send code", fr: "Envoyer le code", zh: "发送验证码" },
  loginCode: { ar: "رمز الدخول (6 أرقام)", en: "Sign-in code (6 digits)", fr: "Code de connexion (6 chiffres)", zh: "登录验证码（6位）" },
  loginVerify: { ar: "تأكيد وإنشاء الطلب", en: "Confirm & create request", fr: "Confirmer et créer la demande", zh: "确认并创建申请" },
  loginErr: { ar: "تعذّر إرسال الرمز. تأكد من البريد أو جرّب لاحقاً.", en: "Couldn't send the code. Check the email or try later.", fr: "Impossible d'envoyer le code. Vérifiez l'e-mail ou réessayez.", zh: "无法发送验证码，请检查邮箱或稍后重试。" },
  codeErr: { ar: "الرمز غير صحيح.", en: "Wrong code.", fr: "Code incorrect.", zh: "验证码错误。" },
  creating: { ar: "ننشئ طلبك…", en: "Creating your request…", fr: "Création de votre demande…", zh: "正在创建申请…" },
  created: { ar: "تم إنشاء طلبك. رقم الطلب:", en: "Your request is created. Reference:", fr: "Votre demande est créée. Référence :", zh: "申请已创建。编号：" },
  openPortal: { ar: "افتح حسابي", en: "Open my account", fr: "Ouvrir mon compte", zh: "打开我的账户" },
  needScope: { ar: "أضف بنداً واحداً على الأقل قبل إنشاء الطلب.", en: "Add at least one item before creating the request.", fr: "Ajoutez au moins un élément avant de créer la demande.", zh: "请至少添加一个条目后再创建申请。" },
  testMode: { ar: "وضع الاختبار — لا مدفوعات حقيقية ولا رسائل للعملاء", en: "TEST MODE — no real payments, no customer messages", fr: "MODE TEST — aucun paiement réel, aucun message client", zh: "测试模式 — 无真实付款，不向客户发送消息" },
  footContact: { ar: "تواصل", en: "Contact", fr: "Contact", zh: "联系我们" },
  footLine: { ar: "الاستشارات، الخدمات الحكومية، وتأسيس الشركات.", en: "Consulting, government services and company formation.", fr: "Conseil, services gouvernementaux et création d'entreprise.", zh: "咨询、政府服务与公司注册。" },
  footClassic: { ar: "الموقع الكامل", en: "Full website", fr: "Site complet", zh: "完整网站" },
  footTerms: { ar: "الشروط والأحكام", en: "Terms", fr: "Conditions", zh: "条款" },
  footRights: { ar: "جميع الحقوق محفوظة", en: "All rights reserved", fr: "Tous droits réservés", zh: "版权所有" },

  // Quick chips shown before the first message.
  chipsConsulting: { ar: ["استشارة عن ترخيص", "مشكلة في الشركة", "تحديد الجهات ذات العلاقة", "فحص شامل للشركة"], en: ["A licensing question", "A problem in the company", "Which authorities are involved", "A full company review"], fr: ["Une question de licence", "Un problème dans la société", "Quelles autorités sont concernées", "Un examen complet"], zh: ["许可相关咨询", "公司内部问题", "涉及哪些主管机关", "公司全面检查"] },
  chipsGovernment: { ar: ["مشكلة في قوى", "تغيير مهنة", "نقل خدمات", "تأشيرات", "النطاقات والتوطين", "إدارة المنصات"], en: ["A problem on Qiwa", "Change a profession", "Transfer of services", "Visas", "Nitaqat & Saudisation", "Manage my platforms"], fr: ["Un problème sur Qiwa", "Changer une profession", "Transfert de services", "Visas", "Nitaqat et saoudisation", "Gérer mes plateformes"], zh: ["Qiwa 平台问题", "变更职业", "服务转移", "签证", "Nitaqat 与本地化", "代管平台"] },
  chipsFormation: { ar: ["فرع شركة أجنبية", "شركة ريادة أعمال", "التسجيل الاستثماري", "متطلبات التأسيس"], en: ["Branch of a foreign company", "Entrepreneurship licence", "Investment registration", "Formation requirements"], fr: ["Succursale étrangère", "Licence entrepreneur", "Enregistrement d'investissement", "Conditions de création"], zh: ["外国公司分支", "创业许可", "投资注册", "设立要求"] },

  // The scope the customer sees the moment they pick a door — the assistant
  // refines it during the conversation; it is never a price list.
  seedConsulting: { ar: ["فهم الموضوع والحالة الحالية", "تحديد الجهات والمتطلبات ذات العلاقة", "تحديد الخطوات والتوصيات المطلوبة"], en: ["Understand the matter and the current position", "Identify the authorities and requirements involved", "Define the steps and recommendations"], fr: ["Comprendre le sujet et la situation actuelle", "Identifier les autorités et exigences concernées", "Définir les étapes et recommandations"], zh: ["了解事项与现状", "确定涉及的机关与要求", "明确步骤与建议"] },
  seedGovernment: { ar: ["فحص المشكلة أو المعاملة", "تحديد الخدمات الحكومية المطلوبة", "تنفيذ أو متابعة الخدمات المتفق عليها"], en: ["Examine the problem or the transaction", "Identify the government services required", "Execute or follow up the agreed services"], fr: ["Examiner le problème ou la démarche", "Identifier les services gouvernementaux requis", "Exécuter ou suivre les services convenus"], zh: ["检查问题或事务", "确定所需政府服务", "执行或跟进约定的服务"] },
  seedFormation: { ar: ["تحديد مسار التأسيس", "إجراءات التأسيس والسجل وعقد التأسيس", "الاشتراك في المنصات الحكومية الأساسية", "تعيين المدير على الشركة", "دعم فتح الحساب البنكي"], en: ["Define the formation route", "Formation, commercial register and articles of association", "Registration on the core government platforms", "Appointing the company manager", "Support with opening the bank account"], fr: ["Définir la voie de création", "Création, registre de commerce et statuts", "Inscription aux plateformes gouvernementales essentielles", "Nomination du gérant", "Accompagnement à l'ouverture du compte bancaire"], zh: ["确定设立路径", "设立手续、商业登记与公司章程", "核心政府平台注册", "任命公司经理", "协助开立银行账户"] },
};

export function simpleV1(ctx) {
  const { lang, esc, site, head, pathInLang } = ctx;
  const t = (k) => { const e = D[k]; if (!e) return k; const l = lang(); return e[l] != null ? e[l] : e.en; };
  const arr = (k) => { const e = D[k]; const l = lang(); return Array.isArray(e[l]) ? e[l] : e.en; };
  const pre = () => (lang() === "en" ? "" : "/" + lang());
  const href = (p) => (p === "/" ? (lang() === "en" ? "/" : "/" + lang() + "/") : pre() + p);
  const LANG_NAMES = { ar: "العربية", en: "English", fr: "Français", zh: "中文" };
  const contact = site.contact || {};
  const WA_HUMAN = "https://wa.me/966" + String(contact.whatsappSupport || contact.phone || "0530540231").replace(/^0/, "");
  // No price is shown on the public homepage: the approved concept puts the
  // catalogue and its prices in the backend, and the figure reaches the
  // customer in the quotation for the scope they approved.

  const CSS = `<style id="sv1-css">
.sv1{--n:#0B1B5A;--n2:#081345;--g:#F5F6FA;--l:#E4E7F0;--t:#1F2430;--s:#4a4f5e;--ok:#16815A;--wa:#25D366;--sh:0 12px 34px rgba(11,27,90,.10);--line:#E4E7F0;--ink:#1F2430;--mut:#5f6880;--soft:#f7f9fd;font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--t);line-height:1.7;background:#fff;display:flex;flex-direction:column;min-height:100vh}
.sv1 *{box-sizing:border-box}
.sv1 a{color:inherit;text-decoration:none}
.sv1 .wrap{max-width:1160px;margin:auto;padding:0 22px;width:100%}
.sv1-ribbon{background:#b45309;color:#fff;text-align:center;padding:6px;font-size:12px;font-weight:700}
.sv1-hdr{border-bottom:1px solid var(--l);background:#fff;position:sticky;top:0;z-index:20}
.sv1-hdr .wrap{height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.sv1-hdr .logo img{height:34px;width:auto;display:block}
.sv1-nav{display:flex;gap:18px;font-size:13px;font-weight:600;color:#39405a}
.sv1-nav a{padding:6px 2px}
.sv1-nav a:hover{color:var(--n)}
.sv1-hdr .right{display:flex;align-items:center;gap:8px}
.sv1-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--l);background:#fff;color:var(--n);padding:10px 16px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;line-height:1.2;font-family:inherit}
.sv1-btn.primary{background:var(--n);border-color:var(--n);color:#fff}
.sv1-btn.primary:hover{background:#13246e}
.sv1-btn.wa{background:var(--wa);border-color:var(--wa);color:#073A17}
.sv1-btn.sm{padding:7px 12px;font-size:12px}
.sv1-btn[disabled]{opacity:.55;cursor:default}
.sv1-lang{position:relative}
.sv1-lang summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:6px 8px;border-radius:999px}
.sv1-lang summary::-webkit-details-marker{display:none}
.sv1-lang .menu{position:absolute;inset-inline-end:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--l);border-radius:12px;box-shadow:var(--sh);min-width:150px;padding:6px;display:grid;z-index:5}
.sv1-lang .menu a{padding:8px 10px;border-radius:8px;font-size:13px}
.sv1-lang .menu a.on{background:var(--g);font-weight:700}
.sv1-burger{display:none;border:1px solid var(--l);background:#fff;border-radius:10px;width:40px;height:40px;align-items:center;justify-content:center;cursor:pointer;font-size:18px}
.sv1 h1,.sv1 h2,.sv1 h3{color:var(--n);margin-top:0}
.sv1-hero{background:linear-gradient(180deg,#fff,var(--g));padding:72px 0}
.sv1-hero .grid{display:grid;grid-template-columns:1fr 1fr;gap:42px;align-items:center}
.sv1-tag{display:inline-block;background:#edf0f8;color:var(--n);padding:5px 11px;border-radius:999px;font-size:12px;font-weight:700}
.sv1-hero h1{font-size:clamp(34px,5vw,58px);line-height:1.18;margin:14px 0 17px;letter-spacing:-.01em}
.sv1-lead{font-size:17px;color:var(--s);margin:0}
.sv1-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}
.sv1-trust{display:flex;gap:8px 18px;flex-wrap:wrap;margin:18px 0 0;padding:0;list-style:none;font-size:12.5px;color:#667085}
.sv1-trust li::before{content:"✓";color:var(--ok);font-weight:700;margin-inline-end:6px}
.sv1-three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sv1-three .sv1-panel{padding:20px}
.sv1-three h4{font-size:15px;margin:0 0 6px}
.sv1-three p{margin:0;font-size:13px;line-height:1.7}
.sv1-doors{display:grid;gap:10px}
.sv1-door{background:#fff;border:1px solid var(--l);border-radius:15px;padding:18px;text-align:start;box-shadow:var(--sh);cursor:pointer;font-family:inherit;transition:.15s;display:block;width:100%}
.sv1-door:hover,.sv1-door.on{border-color:#99a7d4;transform:translateY(-2px)}
.sv1-door .ico{width:42px;height:42px;border-radius:11px;background:#edf0f8;display:grid;place-items:center;font-size:19px}
.sv1-door h3{font-size:18px;margin:13px 0 5px}
.sv1-door p{font-size:12.5px;color:var(--s);margin:0 0 10px;line-height:1.65}
.sv1-door span{font-size:12px;color:var(--n);font-weight:700}
.sv1-sec{padding:64px 0}
.sv1-gray{background:var(--g)}
.sv1-title{text-align:center;max-width:720px;margin:0 auto 30px}
.sv1-title h2{font-size:clamp(24px,3.4vw,34px);margin-bottom:8px}
.sv1-title p{color:var(--s);margin:0}
.sv1-app{border:1px solid var(--l);border-radius:20px;overflow:hidden;box-shadow:var(--sh);background:#fff}
.sv1-appbar{min-height:56px;border-bottom:1px solid var(--l);padding:8px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.sv1-appbar b{color:var(--n)}
.sv1-steps{display:flex;gap:5px;flex-wrap:wrap}
.sv1-steps span{font-size:10.5px;padding:5px 9px;background:#f1f2f5;border-radius:999px;color:#777;font-weight:700}
.sv1-steps .active{background:var(--n);color:#fff}
.sv1-appgrid{display:grid;grid-template-columns:1.05fr .95fr;min-height:540px}
.sv1-chat{display:flex;flex-direction:column;border-inline-end:1px solid var(--l)}
.sv1-chathead{padding:16px;border-bottom:1px solid var(--l)}
.sv1-chathead h3{font-size:18px;margin:0 0 1px}
.sv1-chathead p{font-size:11.5px;color:#777;margin:0}
.sv1-msgs{padding:16px;background:#fbfcfe;flex:1;overflow:auto;max-height:420px}
.sv1-msg{max-width:85%;padding:10px 13px;border-radius:13px;font-size:13px;margin-bottom:9px;white-space:pre-wrap;line-height:1.75}
.sv1-msg.a{background:#fff;border:1px solid var(--l)}
.sv1-msg.u{background:var(--n);color:#fff;margin-inline-start:auto}
.sv1-msg.s{background:#fff3e6;color:#8a4b00;font-size:12px;text-align:center;max-width:100%}
.sv1-chips{display:flex;flex-wrap:wrap;gap:6px}
.sv1-chips button{border:1px solid #d9dfeb;background:#fff;border-radius:999px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:inherit;color:#39405a}
.sv1-compose{border-top:1px solid var(--l);padding:10px;display:flex;gap:6px}
.sv1-compose textarea{height:46px;resize:none;flex:1;border:1px solid var(--l);border-radius:11px;padding:10px;font:inherit;font-size:13px;outline:none}
.sv1-compose textarea:focus{border-color:var(--n)}
.sv1-compose .send{width:46px;border:0;border-radius:11px;background:var(--n);color:#fff;font-size:17px;cursor:pointer}
.sv1-scope{padding:19px;display:flex;flex-direction:column}
.sv1-scope h3{font-size:19px;margin:9px 0 2px}
.sv1-scope>p{font-size:11.5px;color:#777;margin:0 0 12px}
.sv1-item{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--l);border-radius:11px;padding:10px;margin-bottom:7px}
.sv1-item b{font-size:12.5px;display:block;color:#32394a;outline:none;font-weight:600}
.sv1-item b:focus{background:#fffbe6;border-radius:4px}
.sv1-item small{font-size:10.5px;color:#888;display:block;margin-top:2px}
.sv1-item .del{border:0;width:27px;height:27px;border-radius:7px;background:#fff0ef;color:#b42318;cursor:pointer;flex:none;font-size:14px}
.sv1-addrow{display:flex;gap:6px;margin-top:2px}
.sv1-addrow input{flex:1;border:1px solid var(--l);border-radius:9px;padding:9px;font:inherit;font-size:12.5px;outline:none}
.sv1-docs{margin-top:16px;padding-top:14px;border-top:1px dashed #cfd6e6}
.sv1-docs h4{margin:0 0 2px;color:var(--n);font-size:15px}
.sv1-docs>p{margin:0 0 10px;font-size:11.5px;color:#777}
.sv1-doc{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#fbfcfe;border:1px solid var(--l);border-radius:10px;padding:8px 10px;margin-bottom:6px}
.sv1-doc span{font-size:12.5px;color:#32394a;display:flex;gap:7px;align-items:center}
.sv1-doc span::before{content:"📄";font-size:13px}
.sv1-doc .del{border:0;width:24px;height:24px;border-radius:6px;background:#fff0ef;color:#b42318;cursor:pointer;flex:none;font-size:13px}
.sv1-docs .empty{font-size:11.5px;color:#9aa0b0;padding:6px 2px;margin-bottom:6px}
.sv1-summary{background:#f3f5fb;border:1px solid #dfe4f2;border-radius:11px;padding:11px 13px;margin:14px 0;font-size:12px}
.sv1-summary div{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.sv1-summary strong{font-size:16px;color:var(--n)}
.sv1-login{border-top:1px solid var(--l);padding:16px 19px;background:#fff}
.sv1-login h4{margin:0 0 4px;color:var(--n);font-size:15px}
.sv1-login p{margin:0 0 10px;color:#777;font-size:12px}
.sv1-login .g{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.sv1-login input{border:1px solid var(--l);border-radius:10px;padding:10px 12px;font:inherit;font-size:13px;width:100%;outline:none}
.sv1-login .full{grid-column:1/-1}
.sv1-err{color:#b42318;font-size:12px;margin-top:6px}
.sv1-ok{color:var(--ok);font-weight:700;font-size:13px;margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sv1-flow{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}
.sv1-flow div{background:#fff;border:1px solid var(--l);border-radius:13px;padding:15px;text-align:center}
.sv1-flow i{font-style:normal;width:35px;height:35px;background:#edf0f8;color:var(--n);border-radius:50%;display:grid;place-items:center;margin:0 auto 8px;font-weight:700;font-size:13px}
.sv1-flow b{display:block;font-size:12.5px;color:var(--n)}
.sv1-flow small{font-size:10px;color:#888}
.sv1-tabs{text-align:center;margin-bottom:15px;display:flex;gap:8px;justify-content:center}
.sv1-tab{border:1px solid var(--l);background:#fff;border-radius:999px;padding:8px 16px;font-weight:700;color:#666;cursor:pointer;font-family:inherit;font-size:13px}
.sv1-tab.on{background:var(--n);color:#fff;border-color:var(--n)}
.sv1-portal{border:1px solid var(--l);border-radius:18px;overflow:hidden;box-shadow:var(--sh);background:#fff}
.sv1-pgrid{display:grid;grid-template-columns:205px 1fr;min-height:430px}
.sv1-side{background:var(--n2);color:#dce3fa;padding:17px}
.sv1-side strong{color:#fff;display:block;font-size:14px}
.sv1-side small{display:block;font-size:9px;opacity:.6;letter-spacing:.12em;margin-bottom:10px}
.sv1-mi{padding:8px 10px;border-radius:8px;font-size:11.5px;margin:3px 0}
.sv1-mi.on{background:#fff;color:var(--n);font-weight:700}
.sv1-pmain{padding:22px;background:#fbfcfe}
.sv1-pmain h3{font-size:21px;margin:0 0 2px}
.sv1-muted{color:#777;font-size:11.5px}
.sv1-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:15px 0}
.sv1-stat,.sv1-panel{background:#fff;border:1px solid var(--l);border-radius:11px;padding:13px}
.sv1-stat span{font-size:9.5px;color:#777;display:block}
.sv1-stat b{font-size:20px;color:var(--n)}
.sv1-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sv1-panel h4{color:var(--n);margin:0 0 8px;font-size:13px}
.sv1-prow{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #eee;font-size:11px}
.sv1-prow:last-child{border-bottom:0}
.sv1-status{font-size:9px;border-radius:999px;padding:3px 8px;background:#edf0f8;color:var(--n);white-space:nowrap}
.sv1-status.done{background:#e8f7ef;color:var(--ok)}
.sv1-pnote{text-align:center;color:#8b90a0;font-size:11px;margin-top:12px}
.sv1-foot{margin-top:auto;padding:28px 0;background:var(--n2);color:#ccd4ed;font-size:12px}
.sv1-foot .wrap{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center}
.sv1-foot b{color:#fff}
.sv1-foot a{color:#fff}
.sv1-foot .end{margin-inline-start:auto;color:rgba(255,255,255,.6)}
.sv1-wa-fab{position:fixed;left:18px;bottom:18px;z-index:30;width:52px;height:52px;border-radius:50%;background:var(--wa);color:#fff;display:grid;place-items:center;box-shadow:0 10px 26px rgba(37,211,102,.4)}
.sv1-hide{display:none!important}
@media(max-width:900px){
 .sv1-nav{display:none;position:absolute;inset-inline:0;top:72px;background:#fff;border-bottom:1px solid var(--l);flex-direction:column;padding:10px 22px 14px;gap:4px}
 .sv1-nav.open{display:flex}
 .sv1-burger{display:flex}
 .sv1-hdr .right .sv1-btn:not(.primary){display:none}
 .sv1-hero .grid,.sv1-appgrid,.sv1-pgrid,.sv1-cols{grid-template-columns:1fr}
 .sv1-chat{border-inline-end:0;border-bottom:1px solid var(--l)}
 .sv1-flow{grid-template-columns:repeat(3,1fr)}
 .sv1-three{grid-template-columns:1fr}
 .sv1-side{display:none}
 .sv1-stats{grid-template-columns:1fr 1fr}
}
@media(max-width:600px){.sv1-hero{padding:44px 0}.sv1-sec{padding:44px 0}.sv1-flow{grid-template-columns:1fr 1fr}.sv1-steps{display:none}.sv1-login .g{grid-template-columns:1fr}.sv1-foot .end{margin-inline-start:0}}
</style>`;

  function langSwitch(path) {
    const items = SIMPLE_LANGS.map((l) => `<a href="${pathInLang(path, l)}" data-lang="${l}"${l === lang() ? ' class="on"' : ""}>${LANG_NAMES[l]}</a>`).join("");
    return `<details class="sv1-lang"><summary>🌐 ${LANG_NAMES[lang()]}</summary><div class="menu">${items}</div></details>`;
  }
  function header(path, { cta = true } = {}) {
    return `<header class="sv1-hdr"><div class="wrap">
  <a class="logo" href="${href("/")}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <nav class="sv1-nav" id="sv1Nav">
    <a href="${href("/")}#doors">${t("navServices")}</a>
    <a href="${href("/")}#how">${t("navHow")}</a>
    <a href="${href("/my")}" id="sv1AccountLink">${t("navAccount")}</a>
    ${langSwitch(path)}
  </nav>
  <div class="right">
    <button class="sv1-burger" id="sv1Burger" aria-label="Menu" aria-expanded="false">☰</button>
    <a class="sv1-btn" href="${href("/my")}">${t("login")}</a>
    ${cta ? `<a class="sv1-btn primary" href="${href("/")}#advisor">${t("navStart")}</a>` : ""}
  </div>
</div></header>`;
  }
  function footer() {
    const year = new Date().getFullYear();
    return `<footer class="sv1-foot"><div class="wrap">
  <span><b>${t("brand")}</b> — ${t("footLine")}</span>
  <span>${t("footContact")}: ${esc(contact.phone || "")} · ${esc(contact.email || "")}</span>
  <a href="${href("/terms")}">${t("footTerms")}</a>
  ${SIMPLE_V1 ? `<a href="${href("/classic-home")}">${t("footClassic")}</a>` : ""}
  <span class="end">© ${year} Business Partner · ${t("footRights")}</span>
</div></footer>
<a class="sv1-wa-fab" href="${WA_HUMAN}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg></a>`;
  }
  const CHROME_JS = `<script>(function(){var b=document.getElementById('sv1Burger'),n=document.getElementById('sv1Nav');if(b&&n)b.onclick=function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false')};
fetch('/api/simple?action=config').then(function(r){return r.json()}).then(function(c){if(c&&c.testMode){var d=document.createElement('div');d.className='sv1-ribbon';d.textContent=document.documentElement.getAttribute('data-sv1-test')||'TEST MODE';var w=document.querySelector('.sv1');if(w)w.insertBefore(d,w.firstChild)}}).catch(function(){});
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"me"}'}).then(function(r){return r.json()}).then(function(o){if(o&&o.session&&o.session.user){window.SV1_SESSION=o.session;var a=document.getElementById('sv1AccountLink');if(a){var nm=(o.session.user.full_name||o.session.user.email||'').split(' ')[0];if(nm)a.textContent=nm}}}).catch(function(){});})();</script>`;

  function shell({ title, desc, path, body, script = "", noindex = false }) {
    const h = head(title, desc, path)
      .replace("</head>", CSS + "</head>")
      .replace("</head>", noindex ? '<meta name="robots" content="noindex, nofollow"></head>' : "</head>")
      .replace("<html ", `<html data-sv1-test="${esc(t("testMode"))}" `)
      .replace("<body>", '<body class="sv1-page">');
    return h + `<div class="sv1">${body}</div>` + CHROME_JS + script + "</body></html>";
  }

  // ------------------------------------------------------------ homepage --
  function buildHome(path = "/") {
    const l = lang();
    const doors = [
      ["consulting", "💬", t("ctxConsulting"), t("doorConsulting"), t("ctaConsulting")],
      ["government", "🏛️", t("ctxGovernment"), t("doorGovernment"), t("ctaGovernment")],
      ["formation", "🏢", t("ctxFormation"), t("doorFormation"), t("ctaFormation")],
    ].map(([k, ic, h3, p, cta]) => `<button type="button" class="sv1-door${k === "consulting" ? " on" : ""}" id="door-${k}" data-door="${k}"><div class="ico">${ic}</div><h3>${h3}</h3><p>${p}</p><span>${cta}</span></button>`).join("");

    const flow = [1, 2, 3, 4, 5, 6].map((n) => `<div><i>${n}</i><b>${t("j" + n)}</b><small>${t("j" + n + "s")}</small></div>`).join("");

    const clientMenu = ["pClientHome", "pClientNew", "pClientReqs", "pClientQuotes", "pClientContracts", "pClientAppts", "pClientPay", "pClientInv", "pClientChats"]
      .map((k, i) => `<div class="sv1-mi${i === 0 ? " on" : ""}">${t(k)}</div>`).join("");
    // Sample figures, exactly as the approved concept shows them; the caption
    // under the panel says so, and real numbers appear after signing in.
    const S = { cActive: "2", cQuote: "1", cSign: "1", cAppt: "1" };

    const TX = {
      thinking: t("thinking"), chatError: t("chatError"), scopeIn: t("scopeIn"), needScope: t("needScope"),
      loginErr: t("loginErr"), codeErr: t("codeErr"), creating: t("creating"), created: t("created"), openPortal: t("openPortal"),
      stateReady: t("stateReady"), docsEmpty: t("docsEmpty"),
      titles: { consulting: t("ctxConsulting"), government: t("ctxGovernment"), formation: t("ctxFormation") },
      welcome: { consulting: t("welcomeConsulting"), government: t("welcomeGovernment"), formation: t("welcomeFormation") },
      chips: { consulting: arr("chipsConsulting"), government: arr("chipsGovernment"), formation: arr("chipsFormation") },
      seed: { consulting: arr("seedConsulting"), government: arr("seedGovernment"), formation: arr("seedFormation") },
      types: { consulting: t("ctxConsulting"), government: t("ctxGovernment"), formation: t("ctxFormation") },
      doorSub: { consulting: t("doorConsulting"), government: t("doorGovernment"), formation: t("doorFormation") },
    };

    const body = `
${header(path)}
<main>
  <section class="sv1-hero"><div class="wrap grid">
    <div>
      <span class="sv1-tag">${t("heroTag")}</span>
      <h1>${t("heroTitle")}</h1>
      <p class="sv1-lead">${t("heroText")}</p>
      <div class="sv1-actions">
        <a class="sv1-btn primary" href="#advisor">${t("heroChat")}</a>
        <a class="sv1-btn wa" href="${WA_HUMAN}" target="_blank" rel="noopener">${t("heroWa")}</a>
      </div>
      <ul class="sv1-trust"><li>${t("trust1")}</li><li>${t("trust2")}</li><li>${t("trust3")}</li></ul>
    </div>
    <div class="sv1-doors" id="doors">${doors}</div>
  </div></section>

  <section class="sv1-sec" id="advisor"><div class="wrap">
    <div class="sv1-title"><h2>${t("advisorTitle")}</h2><p>${t("advisorSub")}</p></div>
    <div class="sv1-app">
      <div class="sv1-appbar"><b>${t("brand")}</b>
        <div class="sv1-steps"><span class="active">${t("stepReq")}</span><span>${t("stepQuote")}</span><span>${t("stepContract")}</span><span>${t("stepPay")}</span><span>${t("stepInvoice")}</span></div>
      </div>
      <div class="sv1-appgrid">
        <div class="sv1-chat">
          <div class="sv1-chathead"><h3 id="sv1ChatTitle">${t("ctxConsulting")}</h3><p id="sv1ChatSub">${t("doorConsulting")}</p></div>
          <div class="sv1-msgs" id="sv1Msgs" aria-live="polite"></div>
          <form class="sv1-compose" id="sv1Form">
            <textarea id="sv1In" placeholder="${esc(t("chatPlaceholder"))}" aria-label="${esc(t("chatPlaceholder"))}"></textarea>
            <button type="submit" class="send" id="sv1Send" aria-label="${esc(t("send"))}">↑</button>
          </form>
        </div>
        <div class="sv1-scope">
          <span class="sv1-tag">${t("scopeTag")}</span>
          <h3>${t("scopeHeading")}</h3>
          <p>${t("scopeNote")}</p>
          <div id="sv1Items"></div>
          <div class="sv1-addrow"><input id="sv1AddIn" placeholder="${esc(t("scopeAddPh"))}"><button type="button" class="sv1-btn sm" id="sv1Add">${t("scopeAdd")}</button></div>
          <div class="sv1-docs">
            <h4>${t("docsHeading")}</h4>
            <p>${t("docsNote")}</p>
            <div id="sv1Docs"></div>
            <div class="sv1-addrow"><input id="sv1DocIn" placeholder="${esc(t("docsAddPh"))}"><button type="button" class="sv1-btn sm" id="sv1DocAdd">${t("scopeAdd")}</button></div>
          </div>
          <div class="sv1-summary">
            <div><span>${t("typeLbl")}</span><b id="sv1Type">${t("ctxConsulting")}</b></div>
            <div><span>${t("stateLbl")}</span><strong id="sv1Price">${t("stateReady")}</strong></div>
          </div>
          <button type="button" class="sv1-btn primary" style="width:100%" id="sv1Create">${t("createBtn")}</button>
        </div>
      </div>
      <div class="sv1-login sv1-hide" id="sv1Login">
        <h4>${t("loginTitle")}</h4><p>${t("loginText")}</p>
        <div class="g" id="sv1LoginStep1">
          <input id="sv1Name" placeholder="${esc(t("loginName"))}" autocomplete="name">
          <input id="sv1Phone" placeholder="${esc(t("loginPhone"))}" inputmode="tel" autocomplete="tel">
          <input id="sv1Email" class="full" type="email" placeholder="${esc(t("loginEmail"))}" autocomplete="email">
          <button type="button" class="sv1-btn primary full" id="sv1SendCode">${t("loginSend")}</button>
        </div>
        <div class="g sv1-hide" id="sv1LoginStep2">
          <input id="sv1Code" class="full" inputmode="numeric" maxlength="6" placeholder="${esc(t("loginCode"))}">
          <button type="button" class="sv1-btn primary full" id="sv1Verify">${t("loginVerify")}</button>
        </div>
        <div class="sv1-err" id="sv1LoginErr"></div>
        <div class="sv1-ok sv1-hide" id="sv1LoginOk"></div>
      </div>
    </div>
  </div></section>

  <section class="sv1-sec" id="simple"><div class="wrap">
    <div class="sv1-title"><h2>${t("noNameTitle")}</h2><p>${t("noNameSub")}</p></div>
    <div class="sv1-three">
      <div class="sv1-panel"><h4>${t("nn1")}</h4><p class="sv1-muted">${t("nn1s")}</p></div>
      <div class="sv1-panel"><h4>${t("nn2")}</h4><p class="sv1-muted">${t("nn2s")}</p></div>
      <div class="sv1-panel"><h4>${t("nn3")}</h4><p class="sv1-muted">${t("nn3s")}</p></div>
    </div>
  </div></section>

  <section class="sv1-sec sv1-gray" id="how"><div class="wrap">
    <div class="sv1-title"><h2>${t("journeyTitle")}</h2><p>${t("journeySub")}</p></div>
    <div class="sv1-flow">${flow}</div>
  </div></section>

  <section class="sv1-sec" id="portal"><div class="wrap">
    <div class="sv1-title"><h2>${t("portalTitle")}</h2><p>${t("portalSub")}</p></div>
    <div class="sv1-portal">
      <div class="sv1-pgrid" id="sv1PC">
        <aside class="sv1-side"><strong>${t("brand")}</strong><small>BUSINESS PARTNER</small>${clientMenu}</aside>
        <main class="sv1-pmain">
          <h3>${t("goodMorning")}</h3><div class="sv1-muted">${t("topToday")}</div>
          <div class="sv1-stats">
            <div class="sv1-stat"><span>${t("kActive")}</span><b>${S.cActive}</b></div>
            <div class="sv1-stat"><span>${t("kQuote")}</span><b>${S.cQuote}</b></div>
            <div class="sv1-stat"><span>${t("kSign")}</span><b>${S.cSign}</b></div>
            <div class="sv1-stat"><span>${t("kAppt")}</span><b>${S.cAppt}</b></div>
          </div>
          <div class="sv1-cols">
            <div class="sv1-panel"><h4>${t("pClientReqs")}</h4>
              <div class="sv1-prow"><span>${t("ctxGovernment")}</span><span class="sv1-status">${t("stepReq")}</span></div>
              <div class="sv1-prow"><span>${t("ctxConsulting")}</span><span class="sv1-status">${t("stepQuote")}</span></div>
              <div class="sv1-prow"><span>${t("ctxFormation")}</span><span class="sv1-status done">${t("stepPay")}</span></div>
            </div>
            <div class="sv1-panel"><h4>${t("pClientAppts")}</h4>
              <p class="sv1-muted">${t("kAppt")}</p>
              <a class="sv1-btn primary sm" href="${href("/my")}">${t("openPortalBtn")}</a>
            </div>
          </div>
        </main>
      </div>
    </div>
    <p class="sv1-pnote">${t("previewNote")}</p>
  </div></section>
</main>
${footer()}`;

    const script = `<script>
(function(){
var LANG=${JSON.stringify(l)},TX=${JSON.stringify(TX)},PORTAL=${JSON.stringify(href("/my"))};
var TYPE={consulting:'CONSULTATION',government:'GOVERNMENT_SERVICE',formation:'COMPANY_FORMATION'};
var $=function(id){return document.getElementById(id)};
var msgs=$('sv1Msgs'),form=$('sv1Form'),input=$('sv1In'),send=$('sv1Send');
var state={ctx:'consulting',history:[],items:[],docs:[],summary:'',title:'',ready:false,busy:false};
try{var sv=JSON.parse(sessionStorage.getItem('sv1_chat')||'null');if(sv&&sv.lang===LANG&&sv.ctx){state.ctx=sv.ctx;state.history=sv.history||[];state.items=sv.items||[];state.docs=sv.docs||[];state.summary=sv.summary||'';state.title=sv.title||'';state.ready=!!sv.ready}}catch(e){}
function save(){try{sessionStorage.setItem('sv1_chat',JSON.stringify({lang:LANG,ctx:state.ctx,history:state.history,items:state.items,docs:state.docs,summary:state.summary,title:state.title,ready:state.ready}))}catch(e){}}
function add(text,role){var d=document.createElement('div');d.className='sv1-msg '+role;d.textContent=text;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d}
function drawChips(list){if(!list||!list.length)return;var w=document.createElement('div');w.className='sv1-chips';list.forEach(function(c){var b=document.createElement('button');b.type='button';b.textContent=c;b.onclick=function(){var box=b.parentNode;if(box&&box.parentNode)box.parentNode.removeChild(box);input.value=c;submit()};w.appendChild(b)});msgs.appendChild(w);msgs.scrollTop=msgs.scrollHeight}
function chips(){if(state.history.length)return;drawChips(TX.chips[state.ctx]||[])}
// The advisor asks ONE question a turn and may offer ready answers, so a
// customer on a phone taps instead of typing. The block is machine-only —
// same loose matching as the scope block, because a model that drops a
// bracket must not leave «OPTS>>» sitting in a chat bubble.
function parseOpts(text){var m=/<*\\s*OPTS\\s*>>/i.exec(text);if(!m)return{text:text,opts:null};var i=m.index,after=i+m[0].length;var e=/<*\\s*END\\s*>>/i.exec(text.slice(after));var raw=e?text.slice(after,after+e.index):text.slice(after);var list=null;
try{list=JSON.parse(raw)}catch(err){var b=raw.indexOf('['),d=raw.lastIndexOf(']');if(b>=0&&d>b){try{list=JSON.parse(raw.slice(b,d+1))}catch(e2){}}}
var clean=(text.slice(0,i)+(e?text.slice(after+e.index+e[0].length):'')).replace(/<*\\s*(?:OPTS|END)\\s*>>/gi,'').trim();
if(!Array.isArray(list))return{text:clean,opts:null};
list=list.map(function(x){return String(x==null?'':x).trim()}).filter(function(x){return x&&x.length<=60}).slice(0,4);
return{text:clean,opts:list.length?list:null}}
function drawItems(){var box=$('sv1Items');box.innerHTML='';state.items.forEach(function(it,i){var row=document.createElement('div');row.className='sv1-item';var tx=document.createElement('div');var b=document.createElement('b');b.textContent=it.title;b.setAttribute('contenteditable','true');b.setAttribute('spellcheck','false');b.addEventListener('input',function(){state.items[i].title=this.textContent.trim();save()});var s=document.createElement('small');s.textContent=it.why||TX.scopeIn;tx.appendChild(b);tx.appendChild(s);var del=document.createElement('button');del.className='del';del.type='button';del.textContent='×';del.onclick=function(){state.items.splice(i,1);drawItems();save()};row.appendChild(tx);row.appendChild(del);box.appendChild(row)})}
function drawDocs(){var box=$('sv1Docs');box.innerHTML='';if(!state.docs.length){var e=document.createElement('div');e.className='empty';e.textContent=TX.docsEmpty;box.appendChild(e);return}
state.docs.forEach(function(d,i){var row=document.createElement('div');row.className='sv1-doc';var t=document.createElement('span');t.textContent=d.title;var del=document.createElement('button');del.className='del';del.type='button';del.textContent='\u00d7';del.onclick=function(){state.docs.splice(i,1);drawDocs();save()};row.appendChild(t);row.appendChild(del);box.appendChild(row)})}
function setCtx(k,quiet){state.ctx=k;state.history=[];state.ready=false;state.summary='';state.title='';state.items=(TX.seed[k]||[]).map(function(x){return {code:'',title:x,why:''}});state.docs=[];
Array.prototype.forEach.call(document.querySelectorAll('.sv1-door'),function(d){d.classList.toggle('on',d.getAttribute('data-door')===k)});
$('sv1ChatTitle').textContent=TX.titles[k];$('sv1ChatSub').textContent=TX.doorSub[k];$('sv1Type').textContent=TX.types[k];$('sv1Price').textContent=TX.stateReady;
msgs.innerHTML='';add(TX.welcome[k],'a');chips();drawItems();drawDocs();save();
if(!quiet){var a=document.getElementById('advisor');if(a)a.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(function(){input.focus()},420)}}
document.addEventListener('click',function(e){var d=e.target.closest?e.target.closest('[data-door]'):null;if(d)setCtx(d.getAttribute('data-door'))});
function parseScope(text){var m=/<*\\s*SCOPE\\s*>>/i.exec(text);if(!m)return{text:text.trim(),scope:null};var i=m.index,after=i+m[0].length;var e=/<*\\s*END\\s*>>/i.exec(text.slice(after));var raw=e?text.slice(after,after+e.index):text.slice(after);var sc=null;try{sc=JSON.parse(raw)}catch(err){var b=raw.indexOf('{'),d=raw.lastIndexOf('}');if(b>=0&&d>b){try{sc=JSON.parse(raw.slice(b,d+1))}catch(e2){}}}
// Whatever the model did with the markers, the customer sees only prose.
var clean=(text.slice(0,i)+(e?text.slice(after+e.index+e[0].length):'')).replace(/<*\\s*(?:SCOPE|END)\\s*>>/gi,'').trim();return{text:clean,scope:sc&&sc.ready?sc:null}}
function applyScope(sc){if(sc.items&&sc.items.length)state.items=sc.items.map(function(x){return {code:x.code||'',title:x.title||'',why:x.why||''}}).filter(function(x){return x.title});if(sc.needs&&sc.needs.length)state.docs=sc.needs.map(function(n){return {title:(typeof n==='string'?n:(n&&n.title)||''),note:(n&&n.note)||''}}).filter(function(d){return d.title});
state.summary=sc.summary||'';state.title=sc.title||'';state.ready=true;drawItems();drawDocs();save();var box=document.querySelector('.sv1-scope');if(box)box.scrollIntoView({behavior:'smooth',block:'nearest'})}
function ask(){if(state.busy)return;state.busy=true;send.disabled=true;var th=add(TX.thinking,'a');th.style.opacity='.6';
fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'intake',context:state.ctx,lang:LANG,messages:state.history.slice(-12)})})
.then(function(r){return r.json()}).then(function(j){var reply=(j&&(j.reply||j.message))||'';if(!reply)throw new Error('empty');th.remove();var p=parseScope(reply);var o=parseOpts(p.text);if(o.text)add(o.text,'a');state.history.push({role:'assistant',content:reply});save();if(p.scope)applyScope(p.scope);else drawChips(o.opts)})
.catch(function(){th.remove();add(TX.chatError,'s')}).then(function(){state.busy=false;send.disabled=false})}
function submit(){var v=input.value.trim();if(!v||state.busy)return;var c=msgs.querySelector('.sv1-chips');if(c)c.remove();add(v,'u');state.history.push({role:'user',content:v});input.value='';save();ask()}
form.addEventListener('submit',function(e){e.preventDefault();submit()});
input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}});
$('sv1Add').onclick=function(){var v=$('sv1AddIn').value.trim();if(!v)return;state.items.push({code:'',title:v,why:''});$('sv1AddIn').value='';drawItems();save()};
$('sv1AddIn').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();$('sv1Add').click()}});
$('sv1DocAdd').onclick=function(){var v=$('sv1DocIn').value.trim();if(!v)return;state.docs.push({title:v,note:''});$('sv1DocIn').value='';drawDocs();save()};
$('sv1DocIn').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();$('sv1DocAdd').click()}});
var challenge='',email='';
$('sv1Create').onclick=function(){if(!state.items.length){$('sv1Login').classList.remove('sv1-hide');$('sv1LoginErr').textContent=TX.needScope;return}if(window.SV1_SESSION){createRequest();return}$('sv1Login').classList.remove('sv1-hide');$('sv1LoginErr').textContent='';$('sv1Login').scrollIntoView({behavior:'smooth',block:'nearest'});$('sv1Email').focus()};
$('sv1SendCode').onclick=function(){email=$('sv1Email').value.trim().toLowerCase();var err=$('sv1LoginErr');err.textContent='';if(email.indexOf('@')<1||email.indexOf('.')<0){err.textContent=TX.loginErr;return}var self=this;self.disabled=true;
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',email:email})}).then(function(r){return r.json()}).then(function(o){self.disabled=false;if(!o||!o.ok){err.textContent=(o&&o.message)||TX.loginErr;return}challenge=o.challenge;$('sv1LoginStep1').classList.add('sv1-hide');$('sv1LoginStep2').classList.remove('sv1-hide');if(o.testLogin)$('sv1Code').placeholder='TEST: 123456';$('sv1Code').focus()}).catch(function(){self.disabled=false;err.textContent=TX.loginErr})};
$('sv1Verify').onclick=function(){var self=this;self.disabled=true;$('sv1LoginErr').textContent='';
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'verify',email:email,code:$('sv1Code').value.trim(),challenge:challenge,name:$('sv1Name').value.trim()})}).then(function(r){return r.json()}).then(function(o){self.disabled=false;if(!o||!o.ok){$('sv1LoginErr').textContent=TX.codeErr;return}window.SV1_SESSION={user:{email:email}};try{localStorage.setItem('bp_session','1')}catch(e){}createRequest()}).catch(function(){self.disabled=false;$('sv1LoginErr').textContent=TX.codeErr})};
function createRequest(){var ok=$('sv1LoginOk');$('sv1Login').classList.remove('sv1-hide');$('sv1LoginStep1').classList.add('sv1-hide');$('sv1LoginStep2').classList.add('sv1-hide');ok.classList.remove('sv1-hide');ok.textContent=TX.creating;
fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request-create',type:TYPE[state.ctx],source:'WEBSITE',lang:LANG,title:state.title||TX.titles[state.ctx],summary:state.summary,scope:state.items,documents:state.docs,conversation:state.history,name:$('sv1Name').value.trim(),phone:$('sv1Phone').value.trim()})})
.then(function(r){return r.json()}).then(function(o){if(!o||!o.ok){ok.classList.add('sv1-hide');$('sv1LoginStep1').classList.remove('sv1-hide');$('sv1LoginErr').textContent=(o&&o.message)||TX.chatError;return}
ok.innerHTML='';ok.appendChild(document.createTextNode(TX.created+' '+o.ref));var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=PORTAL+'?ref='+encodeURIComponent(o.ref);a.textContent=TX.openPortal;ok.appendChild(a);
try{sessionStorage.removeItem('sv1_chat')}catch(e){}setTimeout(function(){location.href=a.href},1400)})
.catch(function(){ok.classList.add('sv1-hide');$('sv1LoginStep1').classList.remove('sv1-hide');$('sv1LoginErr').textContent=TX.chatError})}
// Handoff from the per-service assistant (site/scripts/service-advisor.mjs):
// the visitor already answered the short questions on a service page, so the
// chat opens in the right context with that service already in the scope.
var handoff=false;
try{var hx=JSON.parse(sessionStorage.getItem('bp_sva_request')||'null');
if(hx&&hx.name&&Date.now()-(hx.at||0)<36e5){sessionStorage.removeItem('bp_sva_request');
state.ctx=TYPE[hx.door]?hx.door:'consulting';state.history=[];state.summary=hx.text||'';state.title=hx.name;state.ready=false;
state.items=[{code:hx.code||'',title:hx.name,why:hx.platform||''}].concat((TX.seed[state.ctx]||[]).slice(0,2).map(function(x){return {code:'',title:x,why:''}}));
Array.prototype.forEach.call(document.querySelectorAll('.sv1-door'),function(d){d.classList.toggle('on',d.getAttribute('data-door')===state.ctx)});
$('sv1ChatTitle').textContent=TX.titles[state.ctx];$('sv1ChatSub').textContent=TX.doorSub[state.ctx];$('sv1Type').textContent=TX.types[state.ctx];$('sv1Price').textContent=TX.stateReady;
msgs.innerHTML='';add(hx.text||hx.name,'u');state.history.push({role:'user',content:hx.text||hx.name});drawItems();drawDocs();save();ask();
handoff=true;setTimeout(function(){var a=document.getElementById('advisor');if(a)a.scrollIntoView({behavior:'smooth',block:'start'})},200)}}catch(e){}
// boot
if(handoff){/* already rendered from the service-page handoff */}
else if(state.history.length){$('sv1ChatTitle').textContent=TX.titles[state.ctx];$('sv1ChatSub').textContent=TX.doorSub[state.ctx];$('sv1Type').textContent=TX.types[state.ctx];$('sv1Price').textContent=TX.stateReady;
Array.prototype.forEach.call(document.querySelectorAll('.sv1-door'),function(d){d.classList.toggle('on',d.getAttribute('data-door')===state.ctx)});
msgs.innerHTML='';state.history.forEach(function(m){var p=m.role==='assistant'?parseScope(m.content):{text:m.content};var t=m.role==='assistant'?parseOpts(p.text).text:p.text;if(t)add(t,m.role==='assistant'?'a':'u')});drawItems();drawDocs()}
else setCtx(state.ctx,true);
})();</script>`;
    return shell({
      title: { ar: "Business Partner — استشارات، خدمات حكومية، تأسيس شركات", en: "Business Partner — Consulting, government services, company formation", fr: "Business Partner — Conseil, services gouvernementaux, création d'entreprise", zh: "Business Partner — 咨询、政府服务、公司注册" }[l],
      desc: t("heroText"),
      path, body, script,
    });
  }

  return { buildHome, shell, header, footer, t, arr, href, CSS };
}
