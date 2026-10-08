// Business Partner — Simple V1: بوابة المورّدين (/vendor) — الشريحة الأولى.
//
// يملكها وكيل `recruitment-agencies`. المورّدون = مكاتب استقدام ومستقلّون ومنصات: يسجّلون أنفسهم فيدخلون لوحتهم بلا طابور موافقة.
// صفحة واحدة على SV1.shell() بأربع لغات (ar/en/fr/zh)، بنمط simple-v1-eor.mjs، بلا main.js ولا localStorage.
//
// الدخول والتسجيل: api/_agencies.js القائم نفسه (POST /api/agencies type:"signup" | "login") — لا مصادقة جديدة.
// الجلسة: البريد ورمز وصول المكتب في sessionStorage (يُمحى بإغلاق التبويب)، وكل نداء بيانات POST يحمل الاثنين.
// الدخول عبر Google ورمز البريد ورمز الوصول الدائم **ليست في هذه الشريحة** (موجودة في الخادم، ينقصها واجهة).
//
// لوحة بتبويبين (وثالثٍ للمؤسسي):
//   «الطلبات المفتوحة» ← POST type:"vendor-demand": بنود EOR مجهولة العميل. لا راتب ولا سعر ولا منشأة ولا تواصل.
//                         للمكتب والمستقل زرّ «رشّح لهذه المهنة»؛ وللمورّد المؤسسي زرّ «قدّم عرضاً» على كل بند.
//   «مرشحوك»          ← POST type:"vendor-candidates" / "vendor-add-candidate": مرشّحو هذا المورّد وحده، ونموذج إضافة بسيرة PDF اختيارية.
//   «عروضي»           ← (مؤسسي فقط) POST type:"vendor-my-offers" / "vendor-offer-submit" / "vendor-offer-withdraw": عروضه هو وحده.
//
// الشريحة ٢ — المورّد المؤسسي (شركة قوى عاملة كبرى): لا يُفعَّل بالتسجيل؛ يعتمده المالك. حتى يُعتمد تعرض الصفحة «بانتظار الاعتماد»
// بلا أي طلب (POST type:"vendor-me" يقول للصفحة: النوع وهل الحساب فعّال). الألوان كلها من متغيرات SV1 وأصنافه، لا لون حرفي.
//
// ما لا يظهر هنا أبداً: وسم مصدر المرشّح وربطه بالمكتب (عمودان داخليان في ATS) — داخليان يُكتبان في Notion ولا يُرجعهما الخادم.
// كل نصٍّ قادم من الخادم يدخل الصفحة بـtextContent لا innerHTML.
//
// السكربت العميل دالةٌ عاديّة (vendorClient) تُسلسَل بـtoString، فلا يُضاعَف فيها الـbackslash كما في قوالب النصوص.

import { OCCUPATIONS } from "../../api/_occupations.js";
import { NATIONALITIES } from "../../api/_eor.js";

// ar, en, fr, zh
const D = {
  title: ["بوابة المورّدين", "Vendor portal", "Espace fournisseurs", "供应商门户"],
  tag: ["للمورّدين", "For vendors", "Pour les fournisseurs", "供应商专区"],
  sub: ["مكاتب الاستقدام والمستقلّون والمنصات والمورّدون المؤسسيون", "Recruitment offices, freelancers, platforms and corporate vendors", "Bureaux de recrutement, indépendants, plateformes et fournisseurs corporatifs", "招聘机构、自由职业者、平台与企业供应商"],
  lead: [
    "اطّلع على طلبات التوظيف المفتوحة وارفع مرشّحيك. الطلبات لا تكشف هوية العميل، ولا يرى أحدٌ غيرك مرشّحيك.",
    "See the open hiring requests and submit your candidates. Requests never reveal the client, and nobody but you sees your candidates.",
    "Consultez les demandes de recrutement ouvertes et proposez vos candidats. Les demandes ne révèlent jamais le client, et personne d'autre que vous ne voit vos candidats.",
    "查看开放的招聘需求并提交您的候选人。需求不会透露客户身份，除您之外无人能看到您的候选人。",
  ],
  desc: [
    "بوابة لمكاتب الاستقدام والمستقلّين والمنصات والمورّدين المؤسسيين: طلبات التوظيف المفتوحة دون هوية العميل، ورفع المرشّحين أو تقديم عروض الأسعار.",
    "A portal for recruitment offices, freelancers, platforms and corporate vendors: open hiring requests without client identity, candidate submissions with a PDF CV, or price offers.",
    "Un espace pour bureaux de recrutement, indépendants, plateformes et fournisseurs corporatifs : demandes ouvertes sans identité du client, dépôt de candidats avec CV PDF ou offres de prix.",
    "面向招聘机构、自由职业者、平台和企业供应商的门户：查看不含客户身份的开放需求，提交附 PDF 简历的候选人或价格报价。",
  ],
  // الدخول
  tabSignup: ["حساب جديد", "New account", "Nouveau compte", "注册账户"],
  tabLogin: ["دخول", "Sign in", "Connexion", "登录"],
  authNote: ["التسجيل فوري، بلا طابور موافقة.", "Registration is instant, with no approval queue.", "L'inscription est immédiate, sans file d'approbation.", "注册即时生效，无需等待审批。"],
  fName: ["اسم الجهة", "Name of your organization", "Nom de votre organisation", "机构名称"],
  fKind: ["نوع المورّد", "Type of vendor", "Type de fournisseur", "供应商类型"],
  kOffice: ["مكتب استقدام", "Recruitment office", "Bureau de recrutement", "招聘机构"],
  kFree: ["مستقل", "Freelancer", "Indépendant", "自由职业者"],
  kPlat: ["منصة", "Platform", "Plateforme", "平台"],
  kCorp: ["مورّد مؤسسي (شركة قوى عاملة)", "Corporate vendor (workforce company)", "Fournisseur corporatif (entreprise de main-d'œuvre)", "企业供应商（劳务公司）"],
  authNoteCorp: [
    "المورّد المؤسسي يعتمده فريقنا قبل أن يرى أي طلب، ونراسلك بالبريد فور الاعتماد.",
    "A corporate vendor is approved by our team before it sees any request. We e-mail you as soon as it is approved.",
    "Un fournisseur corporatif est validé par notre équipe avant de voir la moindre demande. Nous vous écrivons dès la validation.",
    "企业供应商需先经我们团队审核，通过后才能查看需求。审核通过后我们会发送邮件通知您。",
  ],
  fCountry: ["الدولة (اختياري)", "Country (optional)", "Pays (facultatif)", "国家（可选）"],
  fEmail: ["البريد الإلكتروني", "E-mail", "E-mail", "电子邮箱"],
  fPass: ["كلمة المرور (٨ أحرف على الأقل)", "Password (at least 8 characters)", "Mot de passe (8 caractères minimum)", "密码（至少 8 位）"],
  btnSignup: ["أنشئ حسابي", "Create my account", "Créer mon compte", "创建账户"],
  btnLogin: ["ادخل", "Sign in", "Se connecter", "登录"],
  wait: ["لحظة…", "One moment…", "Un instant…", "请稍候…"],
  eName: ["اكتب اسم الجهة.", "Enter your organization's name.", "Saisissez le nom de votre organisation.", "请填写机构名称。"],
  eEmail: ["اكتب بريداً إلكترونياً صحيحاً.", "Enter a valid e-mail.", "Saisissez un e-mail valide.", "请填写有效的邮箱。"],
  ePass: ["كلمة المرور ٨ أحرف على الأقل.", "The password must be at least 8 characters.", "Le mot de passe doit comporter au moins 8 caractères.", "密码至少 8 位。"],
  eCreds: ["البريد أو كلمة المرور غير صحيحين.", "Wrong e-mail or password.", "E-mail ou mot de passe incorrect.", "邮箱或密码不正确。"],
  eExists: ["هذا البريد مسجّل. ادخل بكلمة مروره.", "This e-mail is already registered. Sign in with its password.", "Cet e-mail est déjà enregistré. Connectez-vous avec son mot de passe.", "该邮箱已注册，请使用密码登录。"],
  eSusp: ["الحساب موقوف. راسلنا لإعادة التفعيل.", "This account is suspended. Contact us to reinstate it.", "Ce compte est suspendu. Contactez-nous pour le réactiver.", "该账户已被暂停，请联系我们恢复。"],
  eNotActive: ["الحساب غير مفعّل بعد.", "This account is not active yet.", "Ce compte n'est pas encore actif.", "该账户尚未激活。"],
  eNet: ["تعذّر الاتصال. حاول مرة أخرى بعد قليل.", "We could not connect. Try again shortly.", "Connexion impossible. Réessayez bientôt.", "无法连接，请稍后重试。"],
  eSession: ["انتهت الجلسة. ادخل من جديد.", "Your session ended. Sign in again.", "Votre session a expiré. Reconnectez-vous.", "会话已结束，请重新登录。"],
  // اللوحة
  hello: ["مرحباً", "Welcome", "Bienvenue", "欢迎"],
  logout: ["خروج", "Sign out", "Déconnexion", "退出"],
  tDemand: ["الطلبات المفتوحة", "Open requests", "Demandes ouvertes", "开放需求"],
  tCands: ["مرشحوك", "Your candidates", "Vos candidats", "您的候选人"],
  dP: ["طلبات مجهولة العميل: ترى المهنة والعدد والجنسيات والموعد فقط.", "Client-anonymous requests: you see only the occupation, number, nationalities and timing.", "Demandes anonymes : vous ne voyez que le métier, l'effectif, les nationalités et le calendrier.", "客户匿名的需求：您只能看到职业、人数、国籍和时间安排。"],
  dLoad: ["نحمّل الطلبات…", "Loading requests…", "Chargement des demandes…", "正在加载需求…"],
  dNone: ["لا طلبات مفتوحة حالياً. نخبرك هنا حين تُفتح.", "No open requests right now. They will appear here when opened.", "Aucune demande ouverte pour le moment. Elles apparaîtront ici.", "目前没有开放需求，开放后会显示在这里。"],
  dErr: ["تعذّر تحميل الطلبات.", "We could not load the requests.", "Impossible de charger les demandes.", "无法加载需求。"],
  lCount: ["العدد", "Number", "Effectif", "人数"],
  lNats: ["الجنسيات", "Nationalities", "Nationalités", "国籍"],
  natAny: ["غير محدّدة", "Not specified", "Non précisées", "未指定"],
  lWhere: ["الموقع", "Location", "Lieu", "地点"],
  lSector: ["المجال", "Sector", "Secteur", "行业"],
  lStart: ["البدء", "Start", "Début", "开始"],
  lDur: ["المدة", "Term", "Durée", "期限"],
  months: ["أشهر", "months", "mois", "个月"],
  ksa: ["السعودية", "Saudi Arabia", "Arabie saoudite", "沙特阿拉伯"],
  propose: ["رشّح لهذه المهنة", "Propose a candidate", "Proposer un candidat", "为该职业推荐候选人"],
  // المورّد المؤسسي: بانتظار الاعتماد
  pendTitle: ["حسابك بانتظار الاعتماد", "Your account is awaiting approval", "Votre compte est en attente de validation", "您的账户正在等待审核"],
  pendText: [
    "سجّلت كمورّد مؤسسي وفريقنا يراجع طلبك. لن تظهر لك أي طلبات قبل الاعتماد، وسنراسلك بالبريد فور اعتماده.",
    "You registered as a corporate vendor and our team is reviewing it. No requests are shown before approval, and we will e-mail you as soon as it is approved.",
    "Vous êtes inscrit comme fournisseur corporatif et notre équipe examine votre demande. Aucune demande n'est visible avant la validation ; nous vous écrirons dès qu'elle aura lieu.",
    "您已注册为企业供应商，我们的团队正在审核。审核通过前不会显示任何需求，通过后我们会发送邮件通知您。",
  ],
  pendCheck: ["تحقّق من الحالة", "Check status", "Vérifier le statut", "查看状态"],
  // المورّد المؤسسي: العروض
  tOffers: ["عروضي", "My offers", "Mes offres", "我的报价"],
  oP: ["عروضك على الطلبات المفتوحة. لا يراها أحدٌ غيرك.", "Your offers on the open requests. Nobody else sees them.", "Vos offres sur les demandes ouvertes. Personne d'autre ne les voit.", "您对开放需求的报价，仅您自己可见。"],
  oNone: ["لم تقدّم عروضاً بعد. ابدأ من «الطلبات المفتوحة».", "You have not made any offers yet. Start from “Open requests”.", "Vous n'avez pas encore fait d'offre. Commencez par « Demandes ouvertes ».", "您还没有提交报价，请从“开放需求”开始。"],
  oErr: ["تعذّر تحميل عروضك.", "We could not load your offers.", "Impossible de charger vos offres.", "无法加载您的报价。"],
  oBtn: ["قدّم عرضاً", "Make an offer", "Faire une offre", "提交报价"],
  oBtnEdit: ["عدّل عرضك", "Edit your offer", "Modifier votre offre", "修改报价"],
  oMine: ["عرضك الحالي", "Your current offer", "Votre offre actuelle", "您当前的报价"],
  oPrice: ["السعر الشهري للعامل الواحد (ريال)", "Monthly price per worker (SAR)", "Prix mensuel par travailleur (SAR)", "每名工人月价（沙特里亚尔）"],
  oAvail: ["العدد المتاح", "Number available", "Effectif disponible", "可供人数"],
  oPrep: ["زمن التجهيز (بالأيام)", "Lead time (days)", "Délai de préparation (jours)", "准备时间（天）"],
  oNote: ["ملاحظة قصيرة (اختياري، حتى ٣٠٠ حرف)", "Short note (optional, up to 300 characters)", "Courte note (facultatif, jusqu'à 300 caractères)", "简短备注（可选，最多 300 字）"],
  oSend: ["أرسل العرض", "Send offer", "Envoyer l'offre", "发送报价"],
  oCancel: ["إلغاء", "Cancel", "Annuler", "取消"],
  oDone: ["وصل عرضك.", "Your offer was sent.", "Votre offre a été envoyée.", "报价已提交。"],
  oUpdated: ["حُدِّث عرضك واستبدل السابق.", "Your offer was updated and replaced the previous one.", "Votre offre a été mise à jour et remplace la précédente.", "报价已更新，并取代了之前的报价。"],
  oWithdraw: ["اسحب العرض", "Withdraw offer", "Retirer l'offre", "撤回报价"],
  oWithdrawn: ["سُحب العرض.", "The offer was withdrawn.", "L'offre a été retirée.", "报价已撤回。"],
  ePrice: ["السعر رقم أكبر من صفر وحتى ١٠٠٬٠٠٠ ريال، بخانتين عشريتين على الأكثر.", "The price must be a number above 0 and up to 100,000 SAR, with at most 2 decimals.", "Le prix doit être supérieur à 0 et au plus 100 000 SAR, avec 2 décimales maximum.", "价格需大于 0 且不超过 100,000 里亚尔，最多两位小数。"],
  eAvail: ["العدد المتاح رقم صحيح من ١ إلى ٥٠٠٠.", "The number available must be a whole number from 1 to 5000.", "L'effectif disponible doit être un entier de 1 à 5000.", "可供人数需为 1 至 5000 的整数。"],
  ePrep: ["زمن التجهيز عدد أيام صحيح من ٠ إلى ٣٦٥.", "The lead time must be a whole number of days from 0 to 365.", "Le délai doit être un nombre entier de jours de 0 à 365.", "准备时间需为 0 至 365 的整数天。"],
  eNote: ["الملاحظة أطول من ٣٠٠ حرف.", "The note is longer than 300 characters.", "La note dépasse 300 caractères.", "备注超过 300 字。"],
  eItemGone: ["هذا البند لم يعد مفتوحاً.", "This item is no longer open.", "Ce poste n'est plus ouvert.", "该条目已不再开放。"],
  eLocked: ["لا يمكن تغيير هذا العرض؛ فريقنا تعامل معه.", "This offer can no longer be changed; our team has acted on it.", "Cette offre ne peut plus être modifiée ; notre équipe l'a traitée.", "该报价已无法修改，我们的团队已处理。"],
  eOffCfg: ["العروض غير مفعّلة بعد. حاول لاحقاً.", "Offers are not enabled yet. Try again later.", "Les offres ne sont pas encore activées. Réessayez plus tard.", "报价功能尚未启用，请稍后再试。"],
  lPrice: ["السعر الشهري", "Monthly price", "Prix mensuel", "月价"],
  lAvail: ["المتاح", "Available", "Disponible", "可供"],
  lPrep: ["التجهيز", "Lead time", "Préparation", "准备"],
  lNeed: ["المطلوب", "Requested", "Demandé", "需求量"],
  lNote: ["ملاحظتك", "Your note", "Votre note", "您的备注"],
  days: ["يوماً", "days", "jours", "天"],
  sar: ["ريال", "SAR", "SAR", "里亚尔"],
  osSubmitted: ["مقدَّم", "Submitted", "Soumise", "已提交"],
  osWithdrawn: ["مسحوب", "Withdrawn", "Retirée", "已撤回"],
  osAwarded: ["مرسّى", "Awarded", "Attribuée", "已中标"],
  osRejected: ["مرفوض", "Rejected", "Refusée", "已拒绝"],
  // المرشحون
  cH: ["أضف مرشّحاً", "Add a candidate", "Ajouter un candidat", "添加候选人"],
  cName: ["اسم المرشّح", "Candidate name", "Nom du candidat", "候选人姓名"],
  cNat: ["الجنسية", "Nationality", "Nationalité", "国籍"],
  cRole: ["المهنة", "Occupation", "Métier", "职业"],
  cRolePh: ["اكتب أو اختر من القائمة", "Type or pick from the list", "Saisissez ou choisissez dans la liste", "输入或从列表选择"],
  cExp: ["سنوات الخبرة (اختياري)", "Years of experience (optional)", "Années d'expérience (facultatif)", "工作年限（可选）"],
  cSal: ["الراتب المتوقع بالريال (اختياري)", "Expected salary in SAR (optional)", "Salaire attendu en SAR (facultatif)", "期望薪资，沙特里亚尔（可选）"],
  cCv: ["السيرة الذاتية PDF (اختياري، حتى ٣ ميغابايت)", "CV as PDF (optional, up to 3 MB)", "CV au format PDF (facultatif, jusqu'à 3 Mo)", "PDF 简历（可选，最大 3 MB）"],
  cAdd: ["أضف المرشّح", "Add candidate", "Ajouter le candidat", "添加候选人"],
  cDone: ["أُضيف المرشّح.", "The candidate was added.", "Le candidat a été ajouté.", "候选人已添加。"],
  cDup: ["هذا المرشّح موجود لدينا مسبقاً، فلم يُضَف.", "We already have this candidate, so nothing was added.", "Ce candidat existe déjà chez nous : rien n'a été ajouté.", "该候选人已存在，未重复添加。"],
  cCvWarn: ["أُضيف المرشّح، لكن تعذّر حفظ السيرة. أعد رفعها لاحقاً.", "The candidate was added, but the CV could not be saved. Upload it again later.", "Le candidat a été ajouté, mais le CV n'a pas pu être enregistré. Renvoyez-le plus tard.", "候选人已添加，但简历未能保存，请稍后重新上传。"],
  eCName: ["اكتب اسم المرشّح.", "Enter the candidate's name.", "Saisissez le nom du candidat.", "请填写候选人姓名。"],
  eCRole: ["اكتب المهنة.", "Enter the occupation.", "Saisissez le métier.", "请填写职业。"],
  eExp: ["الخبرة رقم صحيح من ٠ إلى ٦٠.", "Experience must be a whole number from 0 to 60.", "L'expérience doit être un entier de 0 à 60.", "工作年限需为 0 至 60 的整数。"],
  eSal: ["الراتب رقم صحيح أو اتركه فارغاً.", "Salary must be a valid number, or leave it empty.", "Le salaire doit être un nombre valide, ou laissez vide.", "薪资需为有效数字，或留空。"],
  eCvType: ["السيرة يجب أن تكون ملف PDF.", "The CV must be a PDF file.", "Le CV doit être un fichier PDF.", "简历必须是 PDF 文件。"],
  eCvSize: ["حجم السيرة أكبر من ٣ ميغابايت.", "The CV is larger than 3 MB.", "Le CV dépasse 3 Mo.", "简历超过 3 MB。"],
  lH: ["مرشّحوك", "Your candidates", "Vos candidats", "您的候选人"],
  lNone: ["لم تُضِف مرشّحين بعد.", "You have not added candidates yet.", "Vous n'avez pas encore ajouté de candidats.", "您还没有添加候选人。"],
  lErr: ["تعذّر تحميل المرشّحين.", "We could not load your candidates.", "Impossible de charger vos candidats.", "无法加载您的候选人。"],
  lYears: ["سنة", "yrs", "ans", "年"],
  lStage: ["المرحلة", "Stage", "Étape", "阶段"],
  // مراحل المسار كما يكتبها الخادم (عربي) ← عرض بأربع لغات
  sNew: ["جديد", "New", "Nouveau", "新申请"],
  sReview: ["فرز", "Screening", "Présélection", "筛选中"],
  sShort: ["قائمة مختصرة", "Shortlist", "Présélectionné", "候选名单"],
  sSent: ["رُشّح لصاحب عمل", "Shortlist", "Présélectionné", "候选名单"],
  sInt: ["مقابلة", "Interview", "Entretien", "面试"],
  sOffer: ["عرض", "Offer", "Offre", "录用意向"],
  sHired: ["تم التوظيف", "Hired", "Recruté", "已录用"],
  sRej: ["مرفوض", "Rejected", "Refusé", "未通过"],
  sFuture: ["مؤجل", "On hold", "En attente", "暂缓"],
};
const STAGE_KEYS = ["sNew", "sReview", "sShort", "sSent", "sInt", "sOffer", "sHired", "sRej", "sFuture"];

export function buildSimpleVendor(sv1, ctx) {
  const { lang, esc } = ctx;
  const LI = { ar: 0, en: 1, fr: 2, zh: 3 };
  const l = lang();
  const idx = LI[l] != null ? LI[l] : 1;
  const t = (k) => { const e = D[k]; return e ? e[idx] : k; };

  const OCC = OCCUPATIONS.map((o) => [o.id, o.nameAr, o.nameEn]);
  const NATS = NATIONALITIES.map((n) => [n.code, n.ar, n.en]);
  const TXKEYS = ["wait", "eName", "eEmail", "ePass", "eCreds", "eExists", "eSusp", "eNotActive", "eNet", "eSession", "hello",
    "dLoad", "dNone", "dErr", "lCount", "lNats", "natAny", "lWhere", "lSector", "lStart", "lDur", "months", "ksa", "propose",
    "cDone", "cDup", "cCvWarn", "eCName", "eCRole", "eExp", "eSal", "eCvType", "eCvSize", "lNone", "lErr", "lYears", "lStage",
    "btnSignup", "btnLogin", "cAdd", "authNote", "authNoteCorp", "pendCheck", "oNone", "oErr", "oBtn", "oBtnEdit", "oMine", "oPrice", "oAvail", "oPrep",
    "oNote", "oSend", "oCancel", "oDone", "oUpdated", "oWithdraw", "oWithdrawn", "ePrice", "eAvail", "ePrep", "eNote", "eItemGone", "eLocked", "eOffCfg",
    "lPrice", "lAvail", "lPrep", "lNeed", "lNote", "days", "sar"];
  const TX = {};
  for (const k of TXKEYS) TX[k] = t(k);
  const STAGES = {};
  for (const k of STAGE_KEYS) STAGES[D[k][0]] = t(k);
  // حالات العرض كما يعيدها الخادم (رموز إنجليزية) ← عرض بأربع لغات.
  const OSTATUS = { submitted: t("osSubmitted"), withdrawn: t("osWithdrawn"), awarded: t("osAwarded"), rejected: t("osRejected") };
  const CFG = { lang: l, tx: TX, occ: OCC, nats: NATS, stages: STAGES, ostatus: OSTATUS, maxCv: 3 * 1024 * 1024 };

  const CSS = `<style id="sv1-vnd-css">
.sv1-vnd-hero{padding:48px 0 28px;text-align:center}
.sv1-vnd-hero h1{font-size:clamp(26px,4vw,40px);margin:14px 0 8px}
.sv1-vnd-hero .sub{font-size:clamp(16px,2vw,20px);color:var(--ac);font-weight:400;margin:0 0 12px}
.sv1-vnd-hero .lead{max-width:680px;margin:0 auto;color:var(--mut);line-height:1.95}
.sv1-vnd-box{max-width:860px;margin:0 auto;background:transparent;border:1px solid var(--l);border-radius:15px;padding:24px;box-shadow:var(--sh2)}
.sv1-vnd-auth{max-width:520px}
.sv1-vnd-tabs{display:flex;gap:6px;border-bottom:1px solid var(--l);margin:0 0 18px;flex-wrap:wrap}
.sv1-vnd-tabs button{border:0;background:none;font:inherit;font-size:14px;padding:10px 14px;cursor:pointer;color:var(--mut);border-bottom:2px solid transparent;margin-bottom:-1px}
.sv1-vnd-tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--ac)}
.sv1-vnd-form label{display:block;font-size:11.5px;color:var(--mut);margin:0 0 5px}
.sv1-vnd-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:transparent;color:var(--t)}
.sv1-vnd-in:focus{border-color:var(--ac)}
.sv1-vnd-in[aria-invalid=true]{border-color:var(--warn)}
textarea.sv1-vnd-in{min-height:76px;resize:vertical;line-height:1.7}
.sv1-vnd-f{margin-bottom:13px}
.sv1-vnd-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-vnd-cols>*,.sv1-vnd-cols3>*{min-width:0}
.sv1-vnd-cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.sv1-vnd-msg{font-size:12.5px;line-height:1.8;margin-top:10px;min-height:1em}
.sv1-vnd-msg.ok{color:var(--ok)}
.sv1-vnd-note{font-size:11.5px;color:var(--faint);line-height:1.85;margin:12px 0 0}
.sv1-vnd-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.sv1-vnd-bar b{font-weight:500;color:var(--ink)}
.sv1-vnd-pane h2{font-size:18px;font-weight:500;margin:0 0 6px}
.sv1-vnd-pane>p{margin:0 0 16px;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-vnd-list{display:grid;gap:11px;padding:0;margin:0;list-style:none}
.sv1-vnd-card{border:1px solid var(--l);border-radius:12px;padding:15px 16px;background:var(--soft)}
.sv1-vnd-card h3{font-size:15px;font-weight:500;margin:0 0 9px;display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.sv1-vnd-card h3 small{font-family:var(--fm);font-size:11px;color:var(--faint);font-weight:400;direction:ltr;unicode-bidi:isolate}
.sv1-vnd-dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px 16px;margin:0 0 11px}
.sv1-vnd-dl div{min-width:0}
.sv1-vnd-dl dt{font-size:11px;color:var(--faint);margin:0 0 2px}
.sv1-vnd-dl dd{margin:0;font-size:13px;color:var(--t);overflow-wrap:anywhere}
.sv1-vnd-row{display:grid;grid-template-columns:2fr 1.5fr 1fr 70px 1fr;gap:10px;align-items:center;padding:11px 14px;border:1px solid var(--l);border-radius:11px;background:transparent;font-size:13px}
.sv1-vnd-row>*{min-width:0;overflow-wrap:anywhere}
.sv1-vnd-row .st{display:inline-block;border-radius:999px;background:var(--acSoft);color:var(--ac);padding:3px 10px;font-size:11.5px;justify-self:start}
.sv1-vnd-hr{border:0;border-top:1px solid var(--l);margin:26px 0}
.sv1-vnd-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sv1-vnd-mine{display:inline-flex;gap:8px;flex-wrap:wrap;align-items:center;border-radius:9px;background:var(--acSoft);color:var(--ac);padding:5px 11px;font-size:12px;margin:0 0 11px}
.sv1-vnd-mine b{font-weight:500}
.sv1-vnd-ofrm{border:1px solid var(--acLine);border-radius:11px;padding:14px;margin:0 0 11px}
.sv1-vnd-ofrm .sv1-vnd-cols{margin-bottom:12px}
.sv1-vnd-pend{border:1px dashed var(--acLine);border-radius:12px;background:var(--soft);padding:22px;text-align:center}
.sv1-vnd-pend h2{font-size:18px;font-weight:500;margin:0 0 8px}
.sv1-vnd-pend p{margin:0 0 14px;color:var(--mut);font-size:13px;line-height:1.9}
.sv1-vnd-ost{display:inline-block;border-radius:999px;background:var(--acSoft);color:var(--ac);padding:3px 10px;font-size:11.5px}
.sv1-vnd-ost.awarded{background:var(--okSoft);color:var(--ok)}
.sv1-vnd-ost.withdrawn,.sv1-vnd-ost.rejected{background:var(--soft);color:var(--faint)}
@media(max-width:700px){.sv1-vnd-cols,.sv1-vnd-cols3{grid-template-columns:1fr}.sv1-vnd-row{grid-template-columns:1fr 1fr}.sv1-vnd-box{padding:18px}}
</style>`;

  const body = `${sv1.header("/vendor", { cta: false })}
<main>
  <section class="sv1-vnd-hero"><div class="wrap">
    <span class="sv1-tag">${esc(t("tag"))}</span>
    <h1>${esc(t("title"))}</h1>
    <p class="sub">${esc(t("sub"))}</p>
    <p class="lead">${esc(t("lead"))}</p>
  </div></section>

  <section class="sv1-sec" style="padding-top:8px"><div class="wrap">
    <div class="sv1-vnd-box sv1-vnd-auth" id="vAuth">
      <div class="sv1-vnd-tabs" role="tablist">
        <button type="button" role="tab" id="vTabSignup" aria-selected="true">${esc(t("tabSignup"))}</button>
        <button type="button" role="tab" id="vTabLogin" aria-selected="false">${esc(t("tabLogin"))}</button>
      </div>
      <form class="sv1-vnd-form" id="vAuthForm" novalidate autocomplete="off">
        <div id="vSignupOnly">
          <div class="sv1-vnd-f"><label for="vName">${esc(t("fName"))}</label><input class="sv1-vnd-in" id="vName" maxlength="200" autocomplete="organization"></div>
          <div class="sv1-vnd-cols sv1-vnd-f">
            <div><label for="vKind">${esc(t("fKind"))}</label><select class="sv1-vnd-in" id="vKind"><option value="مكتب استقدام">${esc(t("kOffice"))}</option><option value="مستقل">${esc(t("kFree"))}</option><option value="منصة">${esc(t("kPlat"))}</option><option value="مورّد مؤسسي">${esc(t("kCorp"))}</option></select></div>
            <div><label for="vCountry">${esc(t("fCountry"))}</label><input class="sv1-vnd-in" id="vCountry" maxlength="80" autocomplete="country-name"></div>
          </div>
        </div>
        <div class="sv1-vnd-f"><label for="vEmail">${esc(t("fEmail"))}</label><input class="sv1-vnd-in" id="vEmail" type="email" maxlength="160" autocomplete="email" dir="ltr"></div>
        <div class="sv1-vnd-f"><label for="vPass">${esc(t("fPass"))}</label><input class="sv1-vnd-in" id="vPass" type="password" maxlength="200" autocomplete="current-password" dir="ltr"></div>
        <button type="submit" class="sv1-btn primary" id="vAuthGo" style="width:100%">${esc(t("btnSignup"))}</button>
        <div class="sv1-vnd-msg" id="vAuthMsg" role="status" aria-live="polite"></div>
        <p class="sv1-vnd-note" id="vAuthNote">${esc(t("authNote"))}</p>
      </form>
    </div>

    <div class="sv1-vnd-box sv1-hide" id="vDash">
      <div class="sv1-vnd-bar"><span>${esc(t("hello"))} <b id="vWho"></b></span><button type="button" class="sv1-btn sm" id="vOut">${esc(t("logout"))}</button></div>
      <div class="sv1-vnd-tabs" role="tablist" id="vTabs">
        <button type="button" role="tab" id="vTabDemand" aria-selected="true">${esc(t("tDemand"))}</button>
        <button type="button" role="tab" id="vTabCands" aria-selected="false">${esc(t("tCands"))}</button>
        <button type="button" role="tab" id="vTabOffers" aria-selected="false" class="sv1-hide">${esc(t("tOffers"))}</button>
      </div>

      <div class="sv1-vnd-pend sv1-hide" id="vPend">
        <h2 id="vPendHead">${esc(t("pendTitle"))}</h2>
        <p id="vPendText">${esc(t("pendText"))}</p>
        <button type="button" class="sv1-btn sm" id="vPendGo">${esc(t("pendCheck"))}</button>
        <div class="sv1-vnd-msg" id="vPendMsg" role="status" aria-live="polite"></div>
      </div>

      <div class="sv1-vnd-pane" id="vPaneDemand">
        <p>${esc(t("dP"))}</p>
        <div class="sv1-vnd-msg" id="vDemandMsg" role="status" aria-live="polite"></div>
        <ul class="sv1-vnd-list" id="vDemand"></ul>
      </div>

      <div class="sv1-vnd-pane sv1-hide" id="vPaneCands">
        <h2>${esc(t("cH"))}</h2>
        <form class="sv1-vnd-form" id="vCandForm" novalidate autocomplete="off">
          <div class="sv1-vnd-cols sv1-vnd-f">
            <div><label for="cName">${esc(t("cName"))}</label><input class="sv1-vnd-in" id="cName" maxlength="120"></div>
            <div><label for="cNat">${esc(t("cNat"))}</label><input class="sv1-vnd-in" id="cNat" maxlength="60" list="vNatList"><datalist id="vNatList"></datalist></div>
          </div>
          <div class="sv1-vnd-cols sv1-vnd-f">
            <div><label for="cRole">${esc(t("cRole"))}</label><input class="sv1-vnd-in" id="cRole" maxlength="160" list="vRoleList" placeholder="${esc(t("cRolePh"))}"><datalist id="vRoleList"></datalist></div>
            <div><label for="cExp">${esc(t("cExp"))}</label><input class="sv1-vnd-in" id="cExp" type="number" min="0" max="60" step="1" inputmode="numeric" dir="ltr"></div>
          </div>
          <div class="sv1-vnd-cols sv1-vnd-f">
            <div><label for="cSal">${esc(t("cSal"))}</label><input class="sv1-vnd-in" id="cSal" inputmode="numeric" maxlength="9" dir="ltr"></div>
            <div><label for="cCv">${esc(t("cCv"))}</label><input class="sv1-vnd-in" id="cCv" type="file" accept="application/pdf,.pdf"></div>
          </div>
          <button type="submit" class="sv1-btn primary" id="cGo">${esc(t("cAdd"))}</button>
          <div class="sv1-vnd-msg" id="cMsg" role="status" aria-live="polite"></div>
        </form>
        <hr class="sv1-vnd-hr">
        <h2>${esc(t("lH"))}</h2>
        <div class="sv1-vnd-msg" id="lMsg" role="status" aria-live="polite"></div>
        <ul class="sv1-vnd-list" id="vCands"></ul>
      </div>

      <div class="sv1-vnd-pane sv1-hide" id="vPaneOffers">
        <p>${esc(t("oP"))}</p>
        <div class="sv1-vnd-msg" id="vOffersMsg" role="status" aria-live="polite"></div>
        <ul class="sv1-vnd-list" id="vOffers"></ul>
      </div>
    </div>
  </div></section>
</main>
${sv1.footer()}`;

  function vendorClient(C) {
    var TX = C.tx, OCC = C.occ, NATS = C.nats, STAGES = C.stages, OST = C.ostatus, LANG = C.lang, AR = LANG === "ar";
    var API = "/api/agencies", KEY = "bp_vendor", CORP = "مورّد مؤسسي";
    var $ = function (id) { return document.getElementById(id); };
    var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    var occName = function (o) { return AR ? o[1] : o[2]; };
    var natName = function (n) { return AR ? n[1] : n[2]; };
    var norm = function (s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); };
    var sess = null;

    function readSess() { try { var v = sessionStorage.getItem(KEY); var o = v ? JSON.parse(v) : null; return o && o.email && o.code ? o : null; } catch (e) { return null; } }
    function writeSess(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
    function dropSess() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

    function call(type, extra) {
      var body = { type: type, lang: LANG };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
      return fetch(API, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (o) { return { s: r.status, o: o || {} }; }); });
    }
    function authed(type, extra) {
      var e = {}; for (var k in extra) e[k] = extra[k];
      e.email = sess.email; e.code = sess.code;
      return call(type, e).then(function (x) {
        if (x.s === 401 || x.s === 403) { signOut(TX.eSession); }
        return x;
      });
    }
    function authErr(x) {
      var e = x.o.error;
      if (x.s === 429) return TX.eNet;
      if (e === "invalid_credentials") return TX.eCreds;
      if (e === "already_registered") return TX.eExists;
      if (e === "weak_password") return TX.ePass;
      if (e === "suspended") return TX.eSusp;
      if (e === "not_active") return TX.eNotActive;
      if (e === "invalid_fields") return TX.eEmail;
      return TX.eNet;
    }
    // الخطأ يأخذ صنف SV1 الجاهز (sv1-err) فلا لون في هذه الصفحة.
    function say(id, cls, text) { var m = $(id); m.className = "sv1-vnd-msg" + (cls === "err" ? " err sv1-err" : cls ? " " + cls : ""); m.textContent = text || ""; }
    function show(node, on) { node.classList[on ? "remove" : "add"]("sv1-hide"); }
    function ascii(s) {
      return String(s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
        .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); }).replace(/٫/g, ".").replace(/[\s,،٬]/g, "");
    }
    function money(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }

    /* ───── الدخول والتسجيل ───── */
    var mode = "signup";
    function syncNote() { $("vAuthNote").textContent = (mode === "signup" && $("vKind").value === CORP) ? TX.authNoteCorp : TX.authNote; }
    function setMode(m) {
      mode = m;
      $("vTabSignup").setAttribute("aria-selected", m === "signup" ? "true" : "false");
      $("vTabLogin").setAttribute("aria-selected", m === "login" ? "true" : "false");
      show($("vSignupOnly"), m === "signup");
      $("vAuthGo").textContent = m === "signup" ? TX.btnSignup : TX.btnLogin;
      $("vPass").setAttribute("autocomplete", m === "signup" ? "new-password" : "current-password");
      syncNote();
      say("vAuthMsg", "", "");
    }
    $("vTabSignup").addEventListener("click", function () { setMode("signup"); });
    $("vTabLogin").addEventListener("click", function () { setMode("login"); });
    $("vKind").addEventListener("change", syncNote);

    $("vAuthForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = $("vEmail").value.trim().toLowerCase(), pass = $("vPass").value, name = $("vName").value.trim();
      if (mode === "signup" && !name) return say("vAuthMsg", "err", TX.eName);
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return say("vAuthMsg", "err", TX.eEmail);
      if (mode === "signup" && pass.length < 8) return say("vAuthMsg", "err", TX.ePass);
      if (!pass) return say("vAuthMsg", "err", TX.eCreds);
      var btn = $("vAuthGo"); btn.disabled = true; say("vAuthMsg", "", TX.wait);
      var p = mode === "signup"
        ? call("signup", { name: name, email: email, password: pass, kind: $("vKind").value, country: $("vCountry").value.trim() })
        : call("login", { email: email, password: pass });
      p.then(function (x) {
        btn.disabled = false;
        if (x.o.ok && x.o.code) {
          $("vPass").value = "";
          sess = { email: x.o.email || email, code: x.o.code, name: (x.o.agency && x.o.agency.name) || name || email };
          writeSess(sess); enter(); return;
        }
        say("vAuthMsg", "err", authErr(x));
      }).catch(function () { btn.disabled = false; say("vAuthMsg", "err", TX.eNet); });
    });

    /* ───── اللوحة ───── */
    var loaded = { demand: false, cands: false, offers: false };
    var kind = "", demandItems = null, offersByItem = {}, openForm = "", formSeq = 0, flash = null;
    function tab(which) {
      var d = which === "demand", c = which === "cands", o = which === "offers";
      $("vTabDemand").setAttribute("aria-selected", d ? "true" : "false");
      $("vTabCands").setAttribute("aria-selected", c ? "true" : "false");
      $("vTabOffers").setAttribute("aria-selected", o ? "true" : "false");
      show($("vPaneDemand"), d); show($("vPaneCands"), c); show($("vPaneOffers"), o);
      if (d && !loaded.demand) loadDemand();
      if (c && !loaded.cands) loadCands();
      if (o && !loaded.offers) loadOffers();
    }
    $("vTabDemand").addEventListener("click", function () { tab("demand"); });
    $("vTabCands").addEventListener("click", function () { tab("cands"); });
    $("vTabOffers").addEventListener("click", function () { tab("offers"); });

    // حساب مؤسسي بانتظار المالك (أو تعذّر السؤال): لوحة واحدة بلا طلبات ولا تبويبات.
    function showPending(on, err) {
      show($("vPend"), on);
      show($("vPendHead"), on && !err); show($("vPendText"), on && !err);
      say("vPendMsg", err ? "err" : "", err || "");
    }
    function checkMe() {
      show($("vTabs"), false); show($("vPaneDemand"), false); show($("vPaneCands"), false); show($("vPaneOffers"), false);
      showPending(false);
      authed("vendor-me", {}).then(function (x) {
        if (!sess) return;
        if (!x.o.ok) { showPending(true, TX.eNet); return; }
        kind = x.o.kind;
        if (!x.o.active) { showPending(true, ""); return; }
        show($("vTabs"), true);
        show($("vTabOffers"), kind === "corporate");
        if (kind === "corporate") loadOffers();
        tab("demand");
      }).catch(function () { if (sess) showPending(true, TX.eNet); });
    }
    $("vPendGo").addEventListener("click", checkMe);

    function enter() {
      $("vWho").textContent = sess.name || sess.email;
      show($("vAuth"), false); show($("vDash"), true);
      loaded.demand = false; loaded.cands = false; loaded.offers = false;
      kind = ""; demandItems = null; offersByItem = {}; openForm = ""; flash = null;
      checkMe();
    }
    function signOut(msg) {
      sess = null; dropSess(); loaded.demand = false; loaded.cands = false; loaded.offers = false;
      kind = ""; demandItems = null; offersByItem = {}; openForm = "";
      $("vDemand").textContent = ""; $("vCands").textContent = ""; $("vOffers").textContent = "";
      show($("vDash"), false); show($("vAuth"), true);
      setMode("login"); say("vAuthMsg", msg ? "err" : "", msg || "");
    }
    $("vOut").addEventListener("click", function () { signOut(""); });

    /* الطلبات المفتوحة */
    function dd(label, value) {
      var d = el("div"); d.appendChild(el("dt", "", label)); d.appendChild(el("dd", "", value)); return d;
    }
    function mineLine(o) {
      var d = el("div", "sv1-vnd-mine");
      d.appendChild(el("span", "", TX.oMine + ":"));
      d.appendChild(el("b", "", money(o.price) + " " + TX.sar));
      d.appendChild(el("span", "", TX.lAvail + " " + o.available + " · " + TX.lPrep + " " + o.prepDays + " " + TX.days));
      d.appendChild(el("span", "sv1-vnd-ost " + o.status, OST[o.status] || ""));
      return d;
    }
    function offerField(label, input) {
      var w = el("div"), l = el("label", "", label);
      input.id = "ofld" + (++formSeq); l.htmlFor = input.id;
      w.appendChild(l); w.appendChild(input); return w;
    }
    function offerForm(it, mine) {
      var f = el("form", "sv1-vnd-ofrm sv1-vnd-form"); f.noValidate = true; f.setAttribute("autocomplete", "off");
      var price = el("input", "sv1-vnd-in"); price.maxLength = 9; price.setAttribute("inputmode", "decimal"); price.dir = "ltr";
      var avail = el("input", "sv1-vnd-in"); avail.type = "number"; avail.min = "1"; avail.max = "5000"; avail.step = "1"; avail.setAttribute("inputmode", "numeric"); avail.dir = "ltr";
      var prep = el("input", "sv1-vnd-in"); prep.type = "number"; prep.min = "0"; prep.max = "365"; prep.step = "1"; prep.setAttribute("inputmode", "numeric"); prep.dir = "ltr";
      var note = el("textarea", "sv1-vnd-in"); note.maxLength = 300; note.rows = 3;
      if (mine && mine.status === "submitted") { price.value = String(mine.price); avail.value = String(mine.available); prep.value = String(mine.prepDays); note.value = mine.note || ""; }
      var cols = el("div", "sv1-vnd-cols3");
      cols.appendChild(offerField(TX.oPrice, price)); cols.appendChild(offerField(TX.oAvail, avail)); cols.appendChild(offerField(TX.oPrep, prep));
      f.appendChild(cols);
      var nw = offerField(TX.oNote, note); nw.className = "sv1-vnd-f"; f.appendChild(nw);
      var acts = el("div", "sv1-vnd-acts");
      var go = el("button", "sv1-btn primary sm", TX.oSend); go.type = "submit";
      var cancel = el("button", "sv1-btn sm", TX.oCancel); cancel.type = "button";
      acts.appendChild(go); acts.appendChild(cancel); f.appendChild(acts);
      var msg = el("div", "sv1-vnd-msg"); msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite"); f.appendChild(msg);
      function oops(input, key) { input.setAttribute("aria-invalid", "true"); msg.className = "sv1-vnd-msg err sv1-err"; msg.textContent = TX[key]; input.focus(); }
      cancel.addEventListener("click", function () { openForm = ""; drawDemand(); });
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        [price, avail, prep, note].forEach(function (i) { i.removeAttribute("aria-invalid"); });
        var p = ascii(price.value), a = ascii(avail.value), d = ascii(prep.value), n = note.value.replace(/\s+/g, " ").trim();
        if (!/^\d{1,6}(\.\d{1,2})?$/.test(p) || !(+p > 0) || +p > 100000) return oops(price, "ePrice");
        if (!/^\d{1,5}$/.test(a) || +a < 1 || +a > 5000) return oops(avail, "eAvail");
        if (!/^\d{1,3}$/.test(d) || +d > 365) return oops(prep, "ePrep");
        if (n.length > 300) return oops(note, "eNote");
        go.disabled = true; msg.className = "sv1-vnd-msg"; msg.textContent = TX.wait;
        authed("vendor-offer-submit", { itemId: it.itemId, price: p, available: a, prepDays: d, note: n }).then(function (x) {
          go.disabled = false;
          if (!sess) return;
          if (x.o.ok && x.o.offer) {
            offersByItem[it.itemId] = x.o.offer; loaded.offers = false; openForm = "";
            flash = { cls: "ok", text: x.o.replaced ? TX.oUpdated : TX.oDone };
            drawDemand(); loadOffers();
            return;
          }
          var e = x.o.error;
          if (e === "invalid_price") return oops(price, "ePrice");
          if (e === "invalid_available") return oops(avail, "eAvail");
          if (e === "invalid_prep_days") return oops(prep, "ePrep");
          if (e === "invalid_note") return oops(note, "eNote");
          msg.className = "sv1-vnd-msg err sv1-err";
          msg.textContent = e === "item_not_found" || e === "invalid_item" ? TX.eItemGone : (e === "already_awarded" || e === "offer_locked") ? TX.eLocked : e === "not_configured" ? TX.eOffCfg : TX.eNet;
        }).catch(function () { go.disabled = false; msg.className = "sv1-vnd-msg err sv1-err"; msg.textContent = TX.eNet; });
      });
      return f;
    }
    function drawDemand() {
      var items = demandItems || [], ul = $("vDemand"); ul.textContent = "";
      if (!items.length) { say("vDemandMsg", "", TX.dNone); return; }
      // رسالة «وصل عرضك» تبقى عبر إعادة الرسم (تحميل العروض يعيد رسم البطاقات).
      say("vDemandMsg", flash ? flash.cls : "", flash ? flash.text : "");
      var corp = kind === "corporate";
      items.forEach(function (it) {
        var li = el("li", "sv1-vnd-card");
        var h = el("h3", "", AR ? it.nameAr : it.nameEn); h.appendChild(el("small", "", it.ref));
        li.appendChild(h);
        var dl = el("dl", "sv1-vnd-dl");
        dl.appendChild(dd(TX.lCount, String(it.count)));
        dl.appendChild(dd(TX.lNats, (it.nationalityNames && it.nationalityNames.length) ? it.nationalityNames.join(AR ? "، " : ", ") : TX.natAny));
        dl.appendChild(dd(TX.lWhere, it.region === "السعودية" ? TX.ksa : (it.region || TX.ksa)));
        if (it.sectorName) dl.appendChild(dd(TX.lSector, it.sectorName));
        if (it.startDate) dl.appendChild(dd(TX.lStart, it.startDate));
        if (it.durationMonths) dl.appendChild(dd(TX.lDur, it.durationMonths + " " + TX.months));
        li.appendChild(dl);
        if (corp) {
          var mine = offersByItem[it.itemId];
          if (mine) li.appendChild(mineLine(mine));
          if (openForm === it.itemId) li.appendChild(offerForm(it, mine));
          else if (!mine || mine.status === "submitted") {
            var ob = el("button", "sv1-btn sm", mine ? TX.oBtnEdit : TX.oBtn); ob.type = "button";
            ob.addEventListener("click", function () { openForm = it.itemId; flash = null; drawDemand(); });
            li.appendChild(ob);
          }
        } else {
          var b = el("button", "sv1-btn sm", TX.propose); b.type = "button";
          b.addEventListener("click", function () { tab("cands"); $("cRole").value = AR ? it.nameAr : it.nameEn; $("cName").focus(); });
          li.appendChild(b);
        }
        ul.appendChild(li);
      });
    }
    function loadDemand() {
      loaded.demand = true; flash = null; say("vDemandMsg", "", TX.dLoad);
      authed("vendor-demand", {}).then(function (x) {
        if (!sess) return;
        if (!x.o.ok) { loaded.demand = false; say("vDemandMsg", "err", TX.dErr); return; }
        demandItems = x.o.items || [];
        drawDemand();
      }).catch(function () { loaded.demand = false; say("vDemandMsg", "err", TX.dErr); });
    }

    /* عروضي (مؤسسي فقط) */
    function drawOffers(rows) {
      var ul = $("vOffers"); ul.textContent = "";
      if (!rows.length) { say("vOffersMsg", "", TX.oNone); return; }
      say("vOffersMsg", "", "");
      rows.forEach(function (o) {
        var li = el("li", "sv1-vnd-card");
        var h = el("h3", "", AR ? o.nameAr : o.nameEn); h.appendChild(el("small", "", o.itemId));
        li.appendChild(h);
        var dl = el("dl", "sv1-vnd-dl");
        dl.appendChild(dd(TX.lPrice, money(o.price) + " " + TX.sar));
        dl.appendChild(dd(TX.lAvail, String(o.available)));
        dl.appendChild(dd(TX.lPrep, o.prepDays + " " + TX.days));
        if (o.count != null) dl.appendChild(dd(TX.lNeed, String(o.count)));
        if (o.note) dl.appendChild(dd(TX.lNote, o.note));
        var sd = el("div"); sd.appendChild(el("dt", "", TX.lStage)); var sdd = el("dd"); sdd.appendChild(el("span", "sv1-vnd-ost " + o.status, OST[o.status] || "")); sd.appendChild(sdd); dl.appendChild(sd);
        li.appendChild(dl);
        if (o.status === "submitted") {
          var wb = el("button", "sv1-btn sm", TX.oWithdraw); wb.type = "button";
          wb.addEventListener("click", function () {
            wb.disabled = true;
            authed("vendor-offer-withdraw", { offerId: o.id }).then(function (x) {
              if (!sess) return;
              if (x.o.ok) { delete offersByItem[o.itemId]; loaded.offers = false; return loadOffers().then(function () { say("vOffersMsg", "ok", TX.oWithdrawn); }); }
              wb.disabled = false;
              say("vOffersMsg", "err", x.o.error === "offer_locked" ? TX.eLocked : TX.eNet);
            }).catch(function () { wb.disabled = false; say("vOffersMsg", "err", TX.eNet); });
          });
          li.appendChild(wb);
        }
        ul.appendChild(li);
      });
    }
    function loadOffers() {
      loaded.offers = true; say("vOffersMsg", "", TX.dLoad);
      return authed("vendor-my-offers", {}).then(function (x) {
        if (!sess) return;
        if (!x.o.ok) { loaded.offers = false; say("vOffersMsg", "err", x.o.error === "not_configured" ? TX.eOffCfg : TX.oErr); return; }
        var rows = x.o.offers || [];
        offersByItem = {};
        rows.forEach(function (o) { if ((o.status === "submitted" || o.status === "awarded") && !offersByItem[o.itemId]) offersByItem[o.itemId] = o; });
        drawOffers(rows);
        if (demandItems && !openForm) drawDemand();
      }).catch(function () { loaded.offers = false; say("vOffersMsg", "err", TX.oErr); });
    }

    /* المرشحون */
    var roleList = $("vRoleList"), natList = $("vNatList");
    OCC.forEach(function (o) { var op = document.createElement("option"); op.value = occName(o); roleList.appendChild(op); });
    NATS.forEach(function (n) { var op = document.createElement("option"); op.value = natName(n); natList.appendChild(op); });
    // ما يكتبه المورّد يُطابَق على القائمة (بالاسمين)، فيُرسَل المعرّف المعتمد؛ وما لا يطابق يُرسَل نصّاً حرّاً والخادم ينظّفه.
    function matchOcc(v) { var k = norm(v); for (var i = 0; i < OCC.length; i++) if (norm(OCC[i][1]) === k || norm(OCC[i][2]) === k) return OCC[i][0]; return v; }
    function matchNat(v) { var k = norm(v); for (var i = 0; i < NATS.length; i++) if (norm(NATS[i][1]) === k || norm(NATS[i][2]) === k) return NATS[i][0]; return v; }

    function drawCands(rows) {
      var ul = $("vCands"); ul.textContent = "";
      if (!rows.length) { say("lMsg", "", TX.lNone); return; }
      say("lMsg", "", "");
      rows.forEach(function (c) {
        var li = el("li", "sv1-vnd-row");
        li.appendChild(el("b", "", c.name));
        li.appendChild(el("span", "", c.role || ""));
        li.appendChild(el("span", "", c.nationality || ""));
        li.appendChild(el("span", "", c.years ? c.years + " " + TX.lYears : ""));
        var st = el("span", "st", STAGES[c.stage] || c.stage || ""); li.appendChild(st);
        ul.appendChild(li);
      });
    }
    function loadCands() {
      loaded.cands = true; say("lMsg", "", TX.dLoad);
      authed("vendor-candidates", {}).then(function (x) {
        if (!sess) return;
        if (!x.o.ok) { loaded.cands = false; say("lMsg", "err", TX.lErr); return; }
        drawCands(x.o.candidates || []);
      }).catch(function () { loaded.cands = false; say("lMsg", "err", TX.lErr); });
    }

    function readFile(f) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { var s = String(fr.result || ""); resolve(s.slice(s.indexOf(",") + 1)); };
        fr.onerror = function () { reject(new Error("read")); };
        fr.readAsDataURL(f);
      });
    }
    function flag(id, bad) { if (bad) $(id).setAttribute("aria-invalid", "true"); else $(id).removeAttribute("aria-invalid"); }
    function candErr(id, key) { flag(id, true); say("cMsg", "err", TX[key]); $(id).focus(); }

    $("vCandForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      ["cName", "cRole", "cExp", "cSal", "cCv"].forEach(function (i) { flag(i, false); });
      var name = $("cName").value.trim(), role = $("cRole").value.trim();
      if (name.length < 2) return candErr("cName", "eCName");
      if (!role) return candErr("cRole", "eCRole");
      var exp = $("cExp").value.trim();
      if (exp !== "" && !(/^\d{1,2}$/.test(exp) && +exp <= 60)) return candErr("cExp", "eExp");
      var sal = $("cSal").value.trim().replace(/[,\s]/g, "");
      if (sal !== "" && !(/^\d{1,7}$/.test(sal) && +sal > 0)) return candErr("cSal", "eSal");
      var f = $("cCv").files && $("cCv").files[0];
      if (f && !(/\.pdf$/i.test(f.name) || f.type === "application/pdf")) return candErr("cCv", "eCvType");
      if (f && f.size > C.maxCv) return candErr("cCv", "eCvSize");
      var btn = $("cGo"); btn.disabled = true; say("cMsg", "", TX.wait);
      (f ? readFile(f).then(function (b64) { return { name: f.name, type: "application/pdf", size: f.size, base64: b64 }; }) : Promise.resolve(null))
        .then(function (cv) {
          var payload = { name: name, nationality: matchNat($("cNat").value.trim()), role: matchOcc(role), experience: exp, salary: sal };
          if (cv) payload.cvFile = cv;
          return authed("vendor-add-candidate", payload);
        })
        .then(function (x) {
          btn.disabled = false;
          if (!sess) return;
          if (x.o.ok) {
            say("cMsg", "ok", x.o.duplicate ? TX.cDup : (x.o.cvStored === false ? TX.cCvWarn : TX.cDone));
            if (!x.o.duplicate) { $("vCandForm").reset(); loadCands(); }
            return;
          }
          var e = x.o.error;
          if (e === "cv_not_pdf" || e === "invalid_cv") return candErr("cCv", "eCvType");
          if (e === "cv_too_large") return candErr("cCv", "eCvSize");
          if (e === "invalid_experience") return candErr("cExp", "eExp");
          if (e === "invalid_salary") return candErr("cSal", "eSal");
          if (e === "invalid_fields") return candErr("cName", "eCName");
          say("cMsg", "err", TX.eNet);
        })
        .catch(function () { btn.disabled = false; say("cMsg", "err", TX.eNet); });
    });

    setMode("signup");
    sess = readSess();
    if (sess) enter();
  }

  const safe = (s) => s.replace(/</g, "\\u003c");
  const script = `<script>(${vendorClient.toString()})(${safe(JSON.stringify(CFG))});</script>`;

  // بوابة بيانات خاصة: لا فهرسة.
  return sv1.shell({ title: `${t("title")} — Business Partner`, desc: t("desc"), path: "/vendor", body: CSS + body, script, noindex: true });
}

export const VENDOR_PAGE_TEXT = {
  ar: { title: D.title[0], desc: D.desc[0], sub: D.sub[0] },
  en: { title: D.title[1], desc: D.desc[1], sub: D.sub[1] },
  fr: { title: D.title[2], desc: D.desc[2], sub: D.sub[2] },
  zh: { title: D.title[3], desc: D.desc[3], sub: D.sub[3] },
};

// للاختبارات: كل نصّ في الصفحة بأربع لغات.
export const VENDOR_TEXT = D;
