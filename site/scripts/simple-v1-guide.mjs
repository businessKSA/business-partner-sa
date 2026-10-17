// Business Partner — Simple V1: دليل المستثمر (/guide) ومدخله في الرئيسية.
//
// على نسق scbc.gov.sa/ar/guidelines بهوية SV1 وصياغتنا. أمر المالك 2026-10-16:
// صفحة /guide كاملة، ويحلّ مدخلها محلّ شريط «رحلة واحدة لكل الخدمات» في الرئيسية
// (تحت المحادثة، والمحادثة لم تُمسّ).
//
// المصدر: بيانات المستودع الموثّقة فقط —
//   • الكتالوج site/assets/data/catalog.json (الخدمات بجهاتها وفئاتها وأسعارها بالـSKU)،
//   • site/data/sbc/*.json (القطاعات والجهات والمراحل والمخالفات والروابط الرسمية الواردة
//     في مرجع api/_saudi-labor-data.json بتاريخ جلبها)،
//   • مركز المخالفات الموجود ومنظومة الحجز /consultation.
// لا يُنسخ نصٌّ من موقع حكومي، ولا يُكتب رقمٌ حكومي من الذاكرة. ما ليس في بياناتنا
// (ترتيب الإجراءات الرسمي، رسومها ومددها ومستنداتها، قائمة المكاتب المعتمدة، مهل
// الاعتراض، أنظمة الأعمال العامة) يُوسَم «نموذج — بحاجة تحقق» ولا يُعرض كحقيقة.
// الأسعار للمسجّلين فقط: الرقم بصنف `price-amt` فتخفيه القاعدة العامة عن الزائر
// (SHOW_PRICES=false)، ومن الكتالوج بالـSKU فقط.
//
// تملكه: sbc-guide. مخطط البيانات: docs/sbc-guide/schema.md. الاختبارات: tests/sbc-guide-*.test.mjs.
// أربع لغات (ar/en/fr/zh)؛ أسماء الخدمات والجهات في fr وzh إنجليزية كما في /catalog.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visibleCatalogRows } from "./hidden.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "data", "sbc");
const CATALOG = path.join(HERE, "..", "assets", "data", "catalog.json");
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

export const GUIDE_TABS = ["journey", "procedures", "regulations", "offices", "appeals", "violations", "video"];
// الفئات التي لا تُباع بالسلة (كما في simple-v1-catalog.mjs).
const NO_CART = new Set(["Real Estate", "Tourism"]);
const PAGE = 24;

export const GUIDE_TEXT = {
  title: { ar: "دليل المستثمر: ابدأ عملك في المملكة", en: "Investor guide: start your business in Saudi Arabia", fr: "Guide de l'investisseur : lancez votre activité en Arabie saoudite", zh: "投资者指南：在沙特开展业务" },
  metaTitle: { ar: "دليل المستثمر — الإجراءات والجهات", en: "Investor guide — procedures and authorities", fr: "Guide de l'investisseur — procédures et autorités", zh: "投资者指南 — 流程与机构" },
  desc: {
    ar: "ما تحتاجه لتبدأ عملك في المملكة وأي جهة تخدمك: رحلة حسب القطاع، وإجراءات حسب الجهة، والأنظمة، والمخالفات، واستشارة مرئية مجانية.",
    en: "What you need to start your business in the Kingdom and which authority serves you: a journey by sector, procedures by authority, regulations, violations and a free video consultation.",
    fr: "Ce qu'il faut pour lancer votre activité dans le Royaume et quelle autorité vous sert : parcours par secteur, procédures par autorité, réglementation, infractions et consultation vidéo gratuite.",
    zh: "在沙特开展业务所需的一切及对应机构：按领域的流程、按机构的办事指南、法规、违规处理与免费视频咨询。",
  },
  tag: { ar: "دليل المستثمر", en: "Investor guide", fr: "Guide de l'investisseur", zh: "投资者指南" },
  nSectors: { ar: "{n} قطاعات", en: "{n} sectors", fr: "{n} secteurs", zh: "{n} 个领域" },
  nEntities: { ar: "{n} جهة", en: "{n} authorities", fr: "{n} autorités", zh: "{n} 个机构" },
  nServices: { ar: "{n} خدمة", en: "{n} services", fr: "{n} services", zh: "{n} 项服务" },
  banner: {
    ar: "الخدمات والجهات والتصنيفات في هذا الدليل مأخوذة من كتالوج Business Partner. رسوم الإجراءات الرسمية ومددها ومستنداتها وتسلسلها النظامي تُعرض بعد اعتمادها من مصدرها الرسمي؛ وما لم يُعتمد بعد موسوم «نموذج — بحاجة تحقق».",
    en: "The services, authorities and categories in this guide come from the Business Partner catalogue. Official fees, durations, documents and legal sequence of each procedure are shown once confirmed against the official source; anything not yet confirmed is labelled “Sample — needs verification”.",
    fr: "Les services, autorités et catégories de ce guide proviennent du catalogue Business Partner. Les frais, délais, documents et séquences officiels de chaque procédure s'affichent une fois confirmés auprès de la source officielle ; ce qui ne l'est pas encore porte la mention « Modèle — à vérifier ».",
    zh: "本指南中的服务、机构与分类均来自 Business Partner 目录。各项流程的官方费用、时限、材料与法定顺序，将在核对官方来源后展示；尚未核对的内容标注为“示例 — 待核实”。",
  },
  needsVer: { ar: "نموذج — بحاجة تحقق", en: "Sample — needs verification", fr: "Modèle — à vérifier", zh: "示例 — 待核实" },
  tabsLabel: { ar: "أقسام الدليل", en: "Guide sections", fr: "Sections du guide", zh: "指南板块" },
  tab: {
    journey: { ar: "رحلة المستثمر", en: "Investor journey", fr: "Parcours de l'investisseur", zh: "投资者旅程" },
    procedures: { ar: "إجراءات الخدمات", en: "Service procedures", fr: "Procédures des services", zh: "服务流程" },
    regulations: { ar: "الأنظمة والتشريعات", en: "Regulations", fr: "Réglementation", zh: "法规与制度" },
    offices: { ar: "دليل المكاتب المعتمدة", en: "Approved offices", fr: "Bureaux agréés", zh: "认可机构名录" },
    appeals: { ar: "خدمات الاعتراضات", en: "Appeals", fr: "Recours", zh: "异议服务" },
    violations: { ar: "دليل المخالفات", en: "Violations guide", fr: "Guide des infractions", zh: "违规指南" },
    video: { ar: "الاتصال المرئي", en: "Video call", fr: "Appel vidéo", zh: "视频通话" },
  },
  // — الرحلة
  jIntro: { ar: "اختر قطاعك لترى المراحل المقترحة وخدماتنا المرتبطة بكل مرحلة.", en: "Pick your sector to see the suggested stages and our services for each one.", fr: "Choisissez votre secteur pour voir les étapes suggérées et nos services pour chacune.", zh: "选择您的领域，查看建议的阶段及每个阶段对应的服务。" },
  sectorsLabel: { ar: "القطاعات", en: "Sectors", fr: "Secteurs", zh: "领域" },
  bundleLbl: { ar: "الباقة المتكاملة", en: "End-to-end package", fr: "Forfait complet", zh: "一站式套餐" },
  stageWord: { ar: "المرحلة", en: "Stage", fr: "Étape", zh: "阶段" },
  orderNote: { ar: "ترتيب المراحل اقتراحٌ من فريقنا. التسلسل الرسمي للإجراءات في هذا القطاع:", en: "The stage order is our team's suggestion. The official sequence of procedures in this sector:", fr: "L'ordre des étapes est une suggestion de notre équipe. La séquence officielle des procédures de ce secteur :", zh: "阶段顺序为我们团队的建议。该领域流程的官方顺序：" },
  allInSector: { ar: "كل خدمات القطاع ({n})", en: "All {n} services in this sector", fr: "Tous les {n} services du secteur", zh: "该领域全部 {n} 项服务" },
  byEntity: { ar: "الإجراءات حسب الجهة", en: "Procedures by authority", fr: "Procédures par autorité", zh: "按机构查看流程" },
  entInvolved: { ar: "الجهات المعنية", en: "Authorities involved", fr: "Autorités concernées", zh: "涉及机构" },
  // — الإجراءات
  search: { ar: "ابحث باسم الخدمة أو الجهة", en: "Search by service or authority name", fr: "Rechercher un service ou une autorité", zh: "按服务或机构名称搜索" },
  entFilter: { ar: "تصنيف حسب الجهة", en: "Filter by authority", fr: "Filtrer par autorité", zh: "按机构筛选" },
  allEnt: { ar: "كل الجهات", en: "All authorities", fr: "Toutes les autorités", zh: "全部机构" },
  showing: { ar: "يعرض {a} من {b}", en: "Showing {a} of {b}", fr: "{a} sur {b}", zh: "显示 {a} / {b}" },
  more: { ar: "عرض المزيد", en: "Show more", fr: "Afficher plus", zh: "显示更多" },
  noResults: { ar: "لا نتائج مطابقة. جرّب كلمة أعمّ أو تحدّث مع المستشار الذكي.", en: "No matching results. Try a broader word or talk to the smart advisor.", fr: "Aucun résultat. Essayez un terme plus large ou parlez au conseiller intelligent.", zh: "没有匹配项。请尝试更宽泛的词，或咨询智能顾问。" },
  procNote: {
    ar: "كل إجراء مربوط بخدمتنا، وتجد نطاق عملنا ومستنداتنا في صفحة الخدمة. الرسم الحكومي والمدة الرسمية والخطوات الرسمية لكل إجراء:",
    en: "Every procedure is linked to our service, and our scope of work and documents are on the service page. The official government fee, duration and steps of each procedure:",
    fr: "Chaque procédure est liée à notre service ; notre périmètre et nos documents figurent sur la page du service. Frais officiels, délai et étapes officielles de chaque procédure :",
    zh: "每项流程都对应我们的服务，服务范围与所需材料见服务页面。各流程的官方规费、时限与官方步骤：",
  },
  // — بطاقة الخدمة
  details: { ar: "التفاصيل ←", en: "Details →", fr: "Détails →", zh: "详情 →" },
  addCart: { ar: "أضف للسلة", en: "Add to cart", fr: "Ajouter au panier", zh: "加入购物车" },
  added: { ar: "أُضيف ✓", en: "Added ✓", fr: "Ajouté ✓", zh: "已加入 ✓" },
  addedToast: { ar: "أُضيفت الخدمة إلى السلة", en: "Added to your cart", fr: "Ajouté à votre panier", zh: "已加入购物车" },
  viewCart: { ar: "عرض السلة ←", en: "View cart →", fr: "Voir le panier →", zh: "查看购物车 →" },
  cartFail: { ar: "تعذّر حفظ السلة في هذا المتصفح. تحدّث مع المستشار الذكي بدلاً من ذلك.", en: "Your browser could not save the cart. Talk to the smart advisor instead.", fr: "Ce navigateur n'a pas pu enregistrer le panier. Parlez plutôt au conseiller intelligent.", zh: "此浏览器无法保存购物车。请改为咨询智能顾问。" },
  ask: { ar: "تحدّث مع المستشار الذكي", en: "Talk to the smart advisor", fr: "Parler au conseiller intelligent", zh: "咨询智能顾问" },
  fee: { ar: "أتعاب الخدمة", en: "Service fee", fr: "Honoraires", zh: "服务费" },
  guest: { ar: "سجّل الدخول لعرض الأتعاب", en: "Sign in to see the fee", fr: "Connectez-vous pour voir les honoraires", zh: "登录后查看服务费" },
  needQuote: { ar: "تحتاج عرض سعر", en: "Needs a quotation", fr: "Sur devis", zh: "需报价" },
  from: { ar: "يبدأ من", en: "From", fr: "À partir de", zh: "起价" },
  perMonth: { ar: "/ شهرياً", en: "/ month", fr: "/ mois", zh: "/ 月" },
  perCand: { ar: "/ لكل مرشّح", en: "/ per candidate", fr: "/ par candidat", zh: "/ 每位候选人" },
  perCv: { ar: "/ سيرة ذاتية", en: "/ per CV", fr: "/ par CV", zh: "/ 每份简历" },
  perEntity: { ar: "/ كيان", en: "/ per entity", fr: "/ par entité", zh: "/ 每个主体" },
  perEst: { ar: "/ منشأة", en: "/ per establishment", fr: "/ par établissement", zh: "/ 每家企业" },
  govFees: { ar: "الرسوم الحكومية، إن وُجدت، منفصلة عن أتعابنا وتُسدَّد للجهة بتكلفتها الفعلية.", en: "Government fees, where they apply, are separate from our fees and paid to the authority at actual cost.", fr: "Les frais gouvernementaux, le cas échéant, sont distincts de nos honoraires et réglés à l'autorité au coût réel.", zh: "政府规费（如有）与我们的服务费分开，并按实际费用向相关机构缴纳。" },
  officialBox: { ar: "التفاصيل الرسمية", en: "Official details", fr: "Détails officiels", zh: "官方详情" },
  oSteps: { ar: "الخطوات", en: "Steps", fr: "Étapes", zh: "步骤" },
  oDocs: { ar: "المستندات", en: "Documents", fr: "Documents", zh: "材料" },
  oFee: { ar: "الرسم الحكومي", en: "Government fee", fr: "Frais officiels", zh: "政府规费" },
  oDur: { ar: "المدة", en: "Duration", fr: "Délai", zh: "时限" },
  oSrc: { ar: "المصدر الرسمي", en: "Official source", fr: "Source officielle", zh: "官方来源" },
  oChecked: { ar: "تاريخ التحقق", en: "Verified on", fr: "Vérifié le", zh: "核实日期" },
  // — الأنظمة
  regIntro: {
    ar: "روابط للمصادر الرسمية فقط، كما وردت في مرجع بياناتنا مع تاريخ جلبها. لا نلخّص نصوص الأنظمة ولا نكتب أرقامها هنا؛ افتح المصدر الرسمي.",
    en: "Links to official sources only, as recorded in our reference data with the date they were retrieved. We do not summarise legal texts or quote figures here — open the official source.",
    fr: "Uniquement des liens vers les sources officielles, tels qu'enregistrés dans nos données de référence avec leur date de consultation. Nous ne résumons pas les textes ni ne citons de chiffres ici : ouvrez la source officielle.",
    zh: "仅提供官方来源链接，按我们参考数据中的记录并附获取日期。此处不概述法规文本，也不引用数字，请打开官方来源查阅。",
  },
  grp: {
    hrsd: { ar: "وزارة الموارد البشرية", en: "Ministry of Human Resources", fr: "Ministère des Ressources humaines", zh: "人力资源部" },
    gosi: { ar: "التأمينات الاجتماعية (GOSI)", en: "Social insurance (GOSI)", fr: "Assurances sociales (GOSI)", zh: "社会保险（GOSI）" },
    general: { ar: "أنظمة الأعمال العامة", en: "General business laws", fr: "Lois générales des affaires", zh: "一般商业法律" },
  },
  kind: {
    law: { ar: "نظام", en: "Law", fr: "Loi", zh: "法律" },
    decision: { ar: "قرار", en: "Decision", fr: "Décision", zh: "决定" },
    guide: { ar: "دليل", en: "Guide", fr: "Guide", zh: "指南" },
    tool: { ar: "أداة", en: "Tool", fr: "Outil", zh: "工具" },
  },
  officialLink: { ar: "افتح المصدر الرسمي ↗", en: "Open the official source ↗", fr: "Ouvrir la source officielle ↗", zh: "打开官方来源 ↗" },
  retrieved: { ar: "جُلب في", en: "Retrieved on", fr: "Consulté le", zh: "获取于" },
  pendingLink: { ar: "بانتظار الرابط الرسمي", en: "Awaiting the official link", fr: "En attente du lien officiel", zh: "等待官方链接" },
  regPendingNote: { ar: "عناوين بلا روابط بعد: تُضاف حين يُقرأ مصدرها الرسمي.", en: "Titles without links yet: added once their official source is read.", fr: "Titres sans lien pour l'instant : ajoutés une fois la source officielle lue.", zh: "目前仅有标题而无链接：待读取官方来源后补充。" },
  // — المكاتب
  offPending: {
    ar: "قائمة المكاتب المعتمدة وأصنافها تُعرض بعد قراءتها من مصدرها الرسمي.",
    en: "The list of approved offices and their categories will be shown once read from the official source.",
    fr: "La liste des bureaux agréés et de leurs catégories s'affichera une fois lue à la source officielle.",
    zh: "认可机构名录及其类别将在读取官方来源后展示。",
  },
  offOurs: { ar: "في الأثناء: نوفّر لك مكتباً أو مساحة عمل", en: "Meanwhile: we provide an office or workspace", fr: "En attendant : nous vous fournissons un bureau ou un espace de travail", zh: "同时：我们为您提供办公室或共享空间" },
  allOffices: { ar: "كل المكاتب ومساحات العمل ←", en: "All offices and workspaces →", fr: "Tous les bureaux et espaces →", zh: "全部办公室与共享空间 →" },
  // — الاعتراضات والمخالفات
  apLead: {
    ar: "اعتراض على مخالفة، تسوية، أو تصعيد: نراجع حالتك أولاً ثم نجهّز ملفك ونتابعه. لا نعد بنتيجة.",
    en: "An objection, a settlement or an escalation: we review your case first, then prepare and follow your file. We promise no outcome.",
    fr: "Opposition, règlement ou escalade : nous étudions d'abord votre cas, puis préparons et suivons votre dossier. Nous ne promettons aucun résultat.",
    zh: "异议、和解或升级处理：我们先审阅您的情况，再准备并跟进材料。不承诺任何结果。",
  },
  apServices: { ar: "خدماتنا في الاعتراضات", en: "Our appeal services", fr: "Nos services de recours", zh: "我们的异议服务" },
  apWindows: { ar: "المهلة النظامية للاعتراض تختلف بحسب الجهة ونوع المخالفة، ولا نذكرها هنا قبل التحقق من مصدرها:", en: "The statutory objection window differs by authority and violation type; we do not state it here before it is verified at source:", fr: "Le délai légal d'opposition varie selon l'autorité et le type d'infraction ; nous ne l'indiquons pas ici avant vérification à la source :", zh: "法定异议期限因机构与违规类型而异；在核实来源之前，我们不在此列出：" },
  apOther: { ar: "نوع آخر من الاعتراضات؟ اشرح حالتك للمستشار الذكي.", en: "A different kind of appeal? Describe your case to the smart advisor.", fr: "Un autre type de recours ? Décrivez votre cas au conseiller intelligent.", zh: "其他类型的异议？请向智能顾问说明您的情况。" },
  vLead: { ar: "من المخالفة إلى الإجراء الصحيح في خمس مراحل واضحة.", en: "From the violation to the right action in five clear stages.", fr: "De l'infraction à la bonne démarche en cinq étapes claires.", zh: "从违规到正确处理，共五个清晰阶段。" },
  vTypes: { ar: "الأصناف التي نتعامل معها", en: "The kinds we handle", fr: "Les types que nous traitons", zh: "我们处理的类型" },
  vOpen: { ar: "افتح مركز المخالفات", en: "Open the violations center", fr: "Ouvrir le centre des infractions", zh: "打开违规中心" },
  vAnalyze: { ar: "حلّل مستند المخالفة", en: "Analyse a violation document", fr: "Analyser un document d'infraction", zh: "分析违规文件" },
  guarantee: { ar: "لا وعد بالنتيجة", en: "No promised outcome", fr: "Aucun résultat promis", zh: "不承诺结果" },
  // — الاتصال المرئي
  videoH: { ar: "الاتصال المرئي: استشارة مجانية", en: "Video call: free consultation", fr: "Appel vidéo : consultation gratuite", zh: "视频通话：免费咨询" },
  videoP: { ar: "جلسة بالفيديو مع مختص: تشرح حالتك وتخرج بخطوات واضحة.", en: "A video session with a specialist: explain your case and leave with clear steps.", fr: "Une séance vidéo avec un spécialiste : exposez votre cas et repartez avec des étapes claires.", zh: "与专员视频会谈：说明您的情况，获得清晰的后续步骤。" },
  videoHours: { ar: "من ٣ عصراً إلى ١٠ مساءً بتوقيت الرياض (GMT+3). الأيام والأوقات المتاحة تظهر عند الحجز.", en: "3 PM to 10 PM Riyadh time (GMT+3). Available days and times appear when you book.", fr: "De 15 h à 22 h, heure de Riyad (GMT+3). Les jours et horaires disponibles s'affichent à la réservation.", zh: "利雅得时间下午 3 点至晚上 10 点（GMT+3）。可预约的日期与时间在预约时显示。" },
  videoFree: { ar: "مجانية بالكامل — بلا التزام", en: "Completely free — no commitment", fr: "Entièrement gratuite — sans engagement", zh: "完全免费 — 无任何义务" },
  videoMeet: { ar: "اجتماع بالفيديو عبر Google Meet", en: "Video meeting on Google Meet", fr: "Réunion vidéo sur Google Meet", zh: "通过 Google Meet 进行视频会议" },
  videoLink: { ar: "الرابط يصلك على بريدك وبدعوة في تقويمك", en: "The link reaches you by e-mail and as a calendar invitation", fr: "Le lien vous parvient par e-mail et en invitation d'agenda", zh: "会议链接将通过邮件和日历邀请发送给您" },
  book: { ar: "احجز استشارة مجانية", en: "Book a free consultation", fr: "Réserver une consultation gratuite", zh: "预约免费咨询" },
  disclaimer: {
    ar: "الأنظمة والرسوم الحكومية تتغيّر؛ ارجع دائماً إلى المصدر الرسمي قبل الاعتماد على أي رقم أو إجراء.",
    en: "Government rules and fees change; always check the official source before relying on any figure or procedure.",
    fr: "Les règles et frais gouvernementaux évoluent ; vérifiez toujours la source officielle avant de vous fier à un chiffre ou une procédure.",
    zh: "政府规则与规费会变动；采用任何数字或流程前，请务必核对官方来源。",
  },
  // — مدخل الرئيسية
  hTitle: { ar: "دليل المستثمر: ابدأ عملك في المملكة", en: "Investor guide: start your business in the Kingdom", fr: "Guide de l'investisseur : lancez votre activité dans le Royaume", zh: "投资者指南：在沙特开展业务" },
  hSub: { ar: "اختر قطاعك لترى الخطوات والجهات والخدمات المرتبطة بها.", en: "Pick your sector to see the steps, the authorities and the services linked to it.", fr: "Choisissez votre secteur pour voir les étapes, les autorités et les services associés.", zh: "选择您的领域，查看相关步骤、机构与服务。" },
  hOpen: { ar: "افتح الدليل", en: "Open the guide", fr: "Ouvrir le guide", zh: "打开指南" },
  hLinks: { ar: "اختصارات", en: "Shortcuts", fr: "Raccourcis", zh: "快捷入口" },
  hVideo: { ar: "اتصال مرئي مجاني", en: "Free video call", fr: "Appel vidéo gratuit", zh: "免费视频通话" },
};

// ---------------------------------------------------------------- البيانات --
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// تطبيع خفيف يطابق بحث /catalog: حروف صغيرة، وهمزات وتاء مربوطة وألف مقصورة وتشكيل.
const norm = (s) => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

function loadCatalog() {
  let raw = { services: [], categories: [] };
  try { raw = JSON.parse(fs.readFileSync(CATALOG, "utf8")); } catch {}
  return { services: visibleCatalogRows(raw.services || []), categories: raw.categories || [] };
}

const pickL = (e, lang) => (e && e[lang] != null ? e[lang] : e && (e.en != null ? e.en : e.ar)) || "";

/** نموذج بيانات الصفحة بلغة معيّنة (بلا HTML) — يُستعمل في البناء والاختبارات. */
export function guideModel(lang = "ar") {
  const ar = lang === "ar";
  const sectors = load("sectors.json");
  const stages = load("stages.json");
  const entList = load("entities.json");
  const overlay = load("procedures.json");
  const { services: rows, categories } = loadCatalog();

  const entByName = new Map(entList.map((e) => [e.catalog_name, e]));
  const sectorByCat = new Map(sectors.map((s) => [s.category, s]));
  const catLabel = (key) => { const c = categories.find((x) => x.key === key); return c ? (ar ? c.nameAr : c.nameEn) : key; };
  const ov = new Map(overlay.filter((o) => o.status === "verified").map((o) => [o.code, o]));

  const entityOf = (govPlatform) => {
    const raw = String(govPlatform == null ? "" : govPlatform).trim();
    const key = raw === "-" ? "" : raw;
    const known = entByName.get(key);
    if (known) return known;
    // جهة جديدة في الكتالوج لم تُسجَّل في entities.json: تُعرض باسمها الخام حتى تُضاف.
    return { id: "x-" + slug(key), catalog_name: key, kind: "gov", name: { ar: key, en: key }, unknown: true };
  };

  const svc = (s) => {
    const sec = sectorByCat.get(s.category);
    const ent = entityOf(s.govPlatform);
    const o = ov.get(s.code);
    return {
      code: s.code, slug: String(s.code).toLowerCase(),
      name: (ar ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn || "",
      nameAr: s.nameAr || s.nameEn || "", nameEn: s.nameEn || s.nameAr || "",
      category: s.category, catLabel: catLabel(s.category),
      sector: sec ? sec.id : "", door: sec ? sec.door : "consulting",
      entity: ent.id, entityName: pickL(ent.name, lang), entityKind: ent.kind, _ent: ent,
      amount: s.amount != null && Number(s.amount) > 0 ? Number(s.amount) : null,
      priceLabel: String(s.priceLabel || ""),
      buy: s.amount != null && Number(s.amount) > 0 && !NO_CART.has(s.category),
      official: o || null,
    };
  };

  const all = rows.filter((s) => s.code && (s.nameAr || s.nameEn)).map(svc);
  const byCode = new Map(all.map((s) => [s.code, s]));
  const find = (c) => byCode.get(c) || null;

  // عدّاد الجهات: الجهات الحكومية فالمتعدد فالباقي، بترتيب الكثرة.
  const entMap = new Map();
  for (const s of all) {
    const cur = entMap.get(s.entity) || { id: s.entity, kind: s._ent.kind, name: pickL(s._ent.name, lang), count: 0 };
    cur.count++;
    entMap.set(s.entity, cur);
  }
  const rank = { gov: 0, multi: 1, none: 2, unspecified: 3 };
  const entities = [...entMap.values()].sort((a, b) => (rank[a.kind] - rank[b.kind]) || (b.count - a.count));

  const secs = sectors.map((sec) => {
    const mine = all.filter((s) => s.category === sec.category);
    const involved = [...new Set(mine.filter((s) => s.entityKind === "gov").map((s) => s.entity))]
      .map((id) => entities.find((e) => e.id === id)).filter(Boolean).sort((a, b) => b.count - a.count);
    return {
      id: sec.id, slug: sec.slug, door: sec.door, icon: sec.icon,
      name: pickL(sec.name, lang), summary: pickL(sec.summary, lang),
      count: mine.length, involved,
      bundle: (sec.bundle || []).map(find).filter(Boolean),
      steps: (sec.steps || []).map((st) => ({ stage: st.stage, title: pickL(stages[st.stage], lang), items: st.skus.map(find).filter(Boolean) })).filter((st) => st.items.length),
      orderStatus: sec.official_order_status,
    };
  }).filter((s) => s.count > 0);

  return { lang, sectors: secs, entities, services: all, find, ov };
}

/** ما يحتاج مادة حكومية بعد — أرقام فعلية من البيانات الحالية (للتقرير والاختبارات). */
export function guideGaps() {
  const sectors = load("sectors.json");
  const regs = load("regulations.json");
  const offices = load("offices.json");
  const appeals = load("appeals.json");
  const viol = load("violations.json");
  const m = guideModel("ar");
  const govSvc = m.services.filter((s) => s.entityKind === "gov" || s.entityKind === "multi");
  const verified = m.services.filter((s) => s.official);
  return {
    services_total: m.services.length,
    services_with_government_entity: govSvc.length,
    services_without_verified_official_details: m.services.length - verified.length,
    government_services_without_verified_official_details: govSvc.filter((s) => !s.official).length,
    entities_total: m.entities.filter((e) => e.kind === "gov").length,
    entities_without_official_url: load("entities.json").filter((e) => e.kind === "gov" && !e.official_url).length,
    sectors_with_unverified_official_order: sectors.filter((s) => s.official_order_status === "needs_verification").length,
    regulations_titles_pending_link_or_verification: regs.filter((r) => r.status === "needs_verification").length,
    regulations_sourced_links: regs.filter((r) => r.status === "sourced").length,
    offices_directory_pending: offices.directory_status === "needs_verification" ? 1 : 0,
    appeal_windows_pending: appeals.windows_status === "needs_verification" ? viol.types.length : 0,
  };
}

// ---------------------------------------------------------------- الصفحة --
export function buildSimpleGuide(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const ar = lang === "ar";
  const t = (k) => pickL(GUIDE_TEXT[k], lang);
  const tn = (k, n) => t(k).replace("{n}", String(n));
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const home = lang === "en" ? "/" : "/" + lang + "/";

  const meta = load("meta.json");
  const regs = load("regulations.json");
  const offices = load("offices.json");
  const appeals = load("appeals.json");
  const viol = load("violations.json");
  const model = guideModel(lang);
  const { sectors, entities, services, find } = model;

  const badge = `<span class="sv1-gd-badge">${esc(t("needsVer"))}</span>`;
  const entGov = entities.filter((e) => e.kind === "gov");

  // ---- السعر: للمسجّلين فقط (price-amt تخفيه القاعدة العامة عن الزائر) ----
  const UNIT = { "/ شهرياً": "perMonth", "/ لكل مرشّح": "perCand", "/ سيرة ذاتية": "perCv", "/ كيان": "perEntity", "/ منشأة": "perEst" };
  const priceText = (s) => {
    if (s.amount == null) return "";
    const unit = Object.keys(UNIT).find((k) => s.priceLabel.includes(k));
    const pf = /يبدأ من|ابتداءً من/.test(s.priceLabel) ? t("from") + " " : "";
    return pf + s.amount.toLocaleString("en-US") + " ﷼" + (unit ? " " + t(UNIT[unit]) : "");
  };

  const officialBox = (s) => {
    const o = s.official;
    if (!o) return "";
    const list = (arr) => (arr || []).map((x) => `<li>${esc(pickL(x, lang))}</li>`).join("");
    return `<details class="sv1-gd-off"><summary>${esc(t("officialBox"))}</summary>
      ${o.steps && o.steps.length ? `<h4>${esc(t("oSteps"))}</h4><ol>${list(o.steps)}</ol>` : ""}
      ${o.documents && o.documents.length ? `<h4>${esc(t("oDocs"))}</h4><ul>${list(o.documents)}</ul>` : ""}
      ${o.gov_fee != null ? `<p><b>${esc(t("oFee"))}:</b> ${esc(Number(o.gov_fee).toLocaleString("en-US"))} ﷼</p>` : ""}
      ${o.duration ? `<p><b>${esc(t("oDur"))}:</b> ${esc(pickL(o.duration, lang))}</p>` : ""}
      <p class="sv1-gd-src"><a href="${esc(o.source_url)}" target="_blank" rel="noopener noreferrer">${esc(t("oSrc"))} ↗</a> · ${esc(t("oChecked"))} ${esc(o.verified_at)}</p>
    </details>`;
  };

  // بطاقة خدمة: رابط صفحة الخدمة + السلة (للمسعّر) أو المستشار الذكي (لما بلا سعر).
  const card = (s, { cat = false, filter = false } = {}) => {
    const pt = priceText(s);
    const priceHtml = pt
      ? `<span class="sv1-gd-lbl">${esc(t("fee"))}</span> <span class="sv1-gd-amt price-amt">${esc(pt)}</span><span class="sv1-gd-guest" data-guest-note>${esc(t("guest"))}</span>`
      : `<span class="sv1-gd-need">${esc(t("needQuote"))}</span>`;
    const act = s.buy
      ? `<button type="button" class="sv1-btn primary sm" data-add data-id="svc-${esc(s.slug)}" data-name-ar="${esc(s.nameAr)}" data-name-en="${esc(s.nameEn)}" data-amount="${esc(String(s.amount))}">${esc(t("addCart"))}</button>`
      : `<button type="button" class="sv1-btn primary sm" data-ask data-code="${esc(s.code)}" data-title="${esc(s.name)}" data-why="${esc(s.entityKind === "gov" ? s.entityName : "")}" data-door="${esc(s.door)}">${esc(t("ask"))}</button>`;
    const q = filter ? ` data-entity="${esc(s.entity)}" data-q="${esc(norm(s.name + " " + s.nameAr + " " + s.nameEn + " " + s.code + " " + s.entityName + " " + s.catLabel))}"` : "";
    return `<article class="sv1-gd-svc"${q}>
      <a class="sv1-gd-name" href="${esc(u("/services/" + s.slug))}">${esc(s.name)}</a>
      ${s.entityKind === "gov" || s.entityKind === "multi" ? `<div class="sv1-gd-ent">${esc(s.entityName)}</div>` : ""}
      ${cat ? `<div class="sv1-gd-cat">${esc(s.catLabel)}</div>` : ""}
      <div class="sv1-gd-price">${priceHtml}</div>
      <div class="sv1-gd-acts">${act}<a class="sv1-gd-more" href="${esc(u("/services/" + s.slug))}">${esc(t("details"))}</a></div>
      ${officialBox(s)}
    </article>`;
  };
  const grid = (items, opt) => `<div class="sv1-gd-cards">${items.map((s) => card(s, opt)).join("")}</div>`;
  const askBtn = (label, cls = "sv1-btn primary") => `<a class="${cls}" href="${esc(home)}#advisor">${esc(label)}</a>`;

  // ---- ١) رحلة المستثمر ----
  const secTabs = sectors.map((s, i) =>
    `<button type="button" role="tab" id="sbc-sec-${esc(s.id)}" aria-controls="sbc-secp-${esc(s.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span aria-hidden="true">${s.icon}</span> ${esc(s.name)}</button>`).join("");
  const secPanels = sectors.map((s, i) => {
    const steps = s.steps.map((st, n) => `<li class="sv1-gd-step"><div class="sv1-gd-stephead"><i aria-hidden="true">${n + 1}</i><div><small>${esc(t("stageWord"))} ${n + 1}</small><h4>${esc(st.title)}</h4></div></div>${grid(st.items)}</li>`).join("");
    const bundle = s.bundle.length ? `<div class="sv1-gd-bundle"><b>${esc(t("bundleLbl"))}</b>${grid(s.bundle)}</div>` : "";
    const involved = s.involved.length ? `<div class="sv1-gd-side-b"><b>${esc(t("entInvolved"))}</b><ul class="sv1-gd-chips">${s.involved.slice(0, 10).map((e) => `<li>${esc(e.name)}</li>`).join("")}</ul></div>` : "";
    const order = s.orderStatus === "needs_verification" ? `<p class="sv1-gd-order">${esc(t("orderNote"))} ${badge}</p>` : "";
    return `<div role="tabpanel" id="sbc-secp-${esc(s.id)}" aria-labelledby="sbc-sec-${esc(s.id)}" tabindex="0"${i === 0 ? "" : " hidden"} class="sv1-gd-secp">
      <div class="sv1-gd-jgrid">
        <aside class="sv1-gd-side">
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.summary)}</p>
          <p class="sv1-gd-count">${esc(tn("nServices", s.count))}</p>
          ${involved}
          <a class="sv1-btn sm" href="${esc(u("/services/category/" + s.slug))}">${esc(tn("allInSector", s.count))}</a>
          <button type="button" class="sv1-btn sm" data-goto="procedures">${esc(t("byEntity"))}</button>
        </aside>
        <div class="sv1-gd-stages">${bundle}<ol class="sv1-gd-steps">${steps}</ol>${order}</div>
      </div>
    </div>`;
  }).join("");

  // ---- ٢) الإجراءات حسب الجهة ----
  const chips = `<button type="button" class="sv1-gd-chip" data-ent="" aria-pressed="true">${esc(t("allEnt"))} <span>${services.length}</span></button>` +
    entities.map((e) => `<button type="button" class="sv1-gd-chip" data-ent="${esc(e.id)}" aria-pressed="false">${esc(e.name)} <span>${e.count}</span></button>`).join("");

  // ---- ٣) الأنظمة ----
  const regCard = (r) => {
    const link = r.status === "sourced" && r.source_url
      ? `<a class="sv1-btn sm" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">${esc(t("officialLink"))}</a><small>${esc(t("retrieved"))} ${esc(r.fetched_at)}</small>`
      : `${badge}<small>${esc(t("pendingLink"))}</small>`;
    const note = r.note ? `<p class="sv1-gd-note-s">${esc(pickL(r.note, lang))}</p>` : "";
    return `<article class="sv1-gd-card"><span class="sv1-gd-kind">${esc(pickL(GUIDE_TEXT.kind[r.kind], lang))}</span><h4>${esc(pickL(r.title, lang))}</h4>${note}<div class="sv1-gd-reglink">${link}</div></article>`;
  };
  const regGroups = ["hrsd", "gosi", "general"].map((g) => {
    const list = regs.filter((r) => r.group === g);
    if (!list.length) return "";
    return `<section class="sv1-gd-group"><h3>${esc(pickL(GUIDE_TEXT.grp[g], lang))}</h3><div class="sv1-gd-cards">${list.map(regCard).join("")}</div></section>`;
  }).join("");

  // ---- ٤) المكاتب ----
  const officeSvc = offices.our_services.map(find).filter(Boolean);
  const officesBody = `<div class="sv1-gd-card sv1-gd-wide"><h3>${esc(pickL(GUIDE_TEXT.tab.offices, lang))}</h3><p>${esc(t("offPending"))}</p>${badge}</div>
    <section class="sv1-gd-group"><h3>${esc(t("offOurs"))}</h3>${grid(officeSvc)}<p><a class="sv1-gd-more" href="${esc(u("/services/category/real-estate"))}">${esc(t("allOffices"))}</a></p></section>`;

  // ---- ٥) الاعتراضات ----
  const appealSvc = appeals.services.map(find).filter(Boolean);
  const types = `<ul class="sv1-gd-chips">${viol.types.map((x) => `<li>${esc(pickL(x.name, lang))}</li>`).join("")}</ul>`;
  const appealsBody = `<p class="sv1-gd-lead">${esc(t("apLead"))}</p>
    <section class="sv1-gd-group"><h3>${esc(t("apServices"))}</h3>${grid(appealSvc)}</section>
    <section class="sv1-gd-group"><h3>${esc(t("vTypes"))}</h3>${types}</section>
    <p class="sv1-gd-order">${esc(t("apWindows"))} ${badge}</p>
    <p>${askBtn(t("apOther"), "sv1-btn")}</p>`;

  // ---- ٦) المخالفات ----
  const stagesHtml = `<ol class="sv1-gd-vflow">${viol.stages.map((s, i) => `<li><i aria-hidden="true">${i + 1}</i><b>${esc(pickL(s.title, lang))}</b><span>${esc(pickL(s.text, lang))}</span></li>`).join("")}</ol>`;
  const violationsBody = `<p class="sv1-gd-lead">${esc(t("vLead"))}</p>${stagesHtml}
    <div class="sv1-gd-guarantee" role="note"><b>${esc(t("guarantee"))}.</b> ${esc(pickL(viol.no_guarantee, lang))}</div>
    <section class="sv1-gd-group"><h3>${esc(t("vTypes"))}</h3>${types}</section>
    <div class="sv1-gd-cta"><a class="sv1-btn primary" href="${esc(u("/compliance-agent"))}">${esc(t("vOpen"))}</a><a class="sv1-btn" href="${esc(u("/ai-document-agent"))}">${esc(t("vAnalyze"))}</a>${askBtn(t("ask"), "sv1-btn")}</div>`;

  // ---- ٧) الاتصال المرئي ----
  const videoBody = `<div class="sv1-gd-card sv1-gd-wide"><h3>${esc(t("videoH"))}</h3><p>${esc(t("videoP"))}</p>
    <ul class="sv1-gd-ticks"><li>${esc(t("videoFree"))}</li><li>${esc(t("videoMeet"))}</li><li>${esc(t("videoLink"))}</li><li>${esc(t("videoHours"))}</li></ul>
    <a class="sv1-btn primary" href="${esc(u(load("video.json").path))}">${esc(t("book"))}</a></div>`;

  const panelBody = {
    journey: `<p class="sv1-gd-lead">${esc(t("jIntro"))}</p>
      <div class="sv1-gd-sectabs" role="tablist" aria-label="${esc(t("sectorsLabel"))}">${secTabs}</div>${secPanels}`,
    procedures: `<p class="sv1-gd-lead">${esc(t("procNote"))} ${badge}</p>
      <div class="sv1-gd-bar"><label class="sv1-vh" for="sbcQ">${esc(t("search"))}</label><input id="sbcQ" type="search" placeholder="${esc(t("search"))}" autocomplete="off"></div>
      <div class="sv1-gd-chipsrow" role="group" aria-label="${esc(t("entFilter"))}" id="sbcChips">${chips}</div>
      <p class="sv1-gd-meta" id="sbcCount" role="status" aria-live="polite"></p>
      <div class="sv1-gd-cards" id="sbcGrid">${services.map((s) => card(s, { cat: true, filter: true })).join("")}</div>
      <p class="sv1-gd-empty" id="sbcNone" hidden>${esc(t("noResults"))}</p>
      <p class="sv1-gd-moreb"><button type="button" class="sv1-btn" id="sbcMore">${esc(t("more"))}</button></p>
      <p class="sv1-gd-note-s">${esc(t("govFees"))}</p>`,
    regulations: `<p class="sv1-gd-lead">${esc(t("regIntro"))}</p>${regGroups}<p class="sv1-gd-note-s">${esc(t("regPendingNote"))}</p>`,
    offices: officesBody,
    appeals: appealsBody,
    violations: violationsBody,
    video: videoBody,
  };

  const tabsHtml = GUIDE_TABS.map((k, i) =>
    `<button type="button" role="tab" id="sbc-tab-${k}" aria-controls="sbc-panel-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(pickL(GUIDE_TEXT.tab[k], lang))}</button>`).join("");
  const panels = GUIDE_TABS.map((k, i) =>
    `<div role="tabpanel" id="sbc-panel-${k}" aria-labelledby="sbc-tab-${k}" tabindex="0"${i === 0 ? "" : " hidden"}>${panelBody[k]}</div>`).join("");

  const CSS = `<style id="sv1-sbc-css">
.sv1-gd-head{max-width:880px;margin:0 0 20px}
.sv1-gd-head h1{font-size:clamp(28px,4vw,46px);line-height:1.2;margin:16px 0 12px;letter-spacing:-.03em;font-weight:200;color:var(--ink)}
.sv1-gd-stats{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0;padding:0;list-style:none}
.sv1-gd-stats li{background:#fff;border:1px solid var(--l);border-radius:999px;padding:7px 14px;font-size:13px;color:var(--ink)}
.sv1-gd-banner{background:var(--acSoft);border:1px solid var(--acLine);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.85;margin:0 0 20px;color:var(--t)}
.sv1-gd-tabs{display:flex;gap:7px;overflow-x:auto;padding:0 0 12px;margin:0 0 18px;border-bottom:1px solid var(--line2);scrollbar-width:thin}
.sv1-gd-tabs [role=tab],.sv1-gd-sectabs [role=tab]{font:inherit;font-size:13.5px;min-height:40px;padding:8px 14px;border:1px solid var(--l);border-radius:999px;background:#fff;color:var(--ink);white-space:nowrap;cursor:pointer}
.sv1-gd-tabs [role=tab][aria-selected=true],.sv1-gd-sectabs [role=tab][aria-selected=true]{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-gd-tabs [role=tab]:focus-visible,.sv1-gd-sectabs [role=tab]:focus-visible,.sv1-gd-chip:focus-visible,.sv1-gd-card:focus-visible,[role=tabpanel]:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.sv1-gd-sectabs{display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;margin:0 0 14px;scrollbar-width:thin}
@media(min-width:981px){.sv1-gd-sectabs{flex-wrap:wrap;overflow:visible}}
.sv1-gd-lead{margin:0 0 16px;font-size:14.5px;line-height:1.9;color:var(--s);max-width:840px}
.sv1-gd-badge{display:inline-block;font-size:12px;line-height:1.5;padding:2px 9px;border-radius:999px;background:var(--acSoft);border:1px solid var(--acLine);color:var(--ink);vertical-align:middle}
.sv1-gd-jgrid{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}
.sv1-gd-side{background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:10px;position:sticky;top:90px}
.sv1-gd-side h3{margin:0;font-size:20px;font-weight:400}
.sv1-gd-side p{margin:0;font-size:13.5px;line-height:1.85;color:var(--s)}
.sv1-gd-count{font-weight:600;color:var(--ink)!important}
.sv1-gd-side-b b{display:block;font-size:12.5px;margin:0 0 6px;color:var(--ink)}
.sv1-gd-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0;padding:0;list-style:none}
.sv1-gd-chips li{font-size:12px;padding:4px 10px;border-radius:999px;background:#f1f2f5;color:var(--t)}
.sv1-gd-steps{list-style:none;margin:0;padding:0;display:grid;gap:18px}
.sv1-gd-step{position:relative}
.sv1-gd-stephead{display:flex;align-items:center;gap:12px;margin:0 0 10px}
.sv1-gd-stephead i{font-style:normal;font-family:var(--fm);flex:0 0 36px;height:36px;border-radius:10px;background:var(--acSoft);color:var(--ac);display:grid;place-items:center;font-weight:600;font-size:14px}
.sv1-gd-stephead small{display:block;font-size:12px;color:var(--mut)}
.sv1-gd-stephead h4{margin:0;font-size:16.5px;font-weight:500;color:var(--ink)}
.sv1-gd-bundle{background:linear-gradient(180deg,var(--acSoft),#fff);border:1px solid var(--acLine);border-radius:14px;padding:14px;margin:0 0 18px}
.sv1-gd-bundle>b{display:block;margin:0 0 10px;font-size:13.5px;color:var(--ink)}
.sv1-gd-order{margin:16px 0 0;font-size:13px;line-height:1.9;color:var(--s)}
.sv1-gd-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.sv1-gd-svc,.sv1-gd-card{background:#fff;border:1px solid var(--l);border-radius:14px;padding:16px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:8px;min-width:0}
.sv1-gd-svc[hidden]{display:none}
.sv1-gd-name{font-size:15px;font-weight:500;line-height:1.55;color:var(--ink)}
.sv1-gd-name:hover{color:var(--ac)}
.sv1-gd-ent{font-size:12.5px;color:var(--ac)}
.sv1-gd-cat{font-size:12px;color:var(--mut)}
.sv1-gd-price{font-size:13px;color:var(--s);line-height:1.7}
.sv1-gd-lbl{color:var(--mut);font-size:12px}
.sv1-gd-amt{font-weight:600;color:var(--ink)}
.sv1-gd-guest{font-size:12px;color:var(--mut)}
.sv1-gd-need{font-size:12.5px;color:var(--mut)}
.sv1-gd-acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:auto;padding-top:4px}
.sv1-gd-more{font-size:12.5px;color:var(--ac);font-weight:500}
.sv1-gd-off{margin-top:4px;border-top:1px solid var(--line2);padding-top:8px;font-size:13px}
.sv1-gd-off h4{margin:8px 0 4px;font-size:12.5px}
.sv1-gd-card h3,.sv1-gd-card h4{margin:0;color:var(--ink);font-weight:500}
.sv1-gd-card h4{font-size:15px;line-height:1.6}
.sv1-gd-card p{margin:0;font-size:13.5px;line-height:1.85;color:var(--s)}
.sv1-gd-kind{align-self:flex-start;font-size:12px;padding:2px 9px;border-radius:6px;background:#f1f2f5;color:var(--t)}
.sv1-gd-reglink{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:auto}
.sv1-gd-reglink small{font-size:12px;color:var(--mut)}
.sv1-gd-wide{max-width:640px}
.sv1-gd-group{margin:0 0 24px}
.sv1-gd-group>h3{font-size:17px;font-weight:500;margin:0 0 12px;color:var(--ink)}
.sv1-gd-bar{margin:0 0 12px}
.sv1-gd-bar input{width:100%;font:inherit;font-size:15px;padding:12px 14px;border:1.5px solid var(--acLine);border-radius:12px;background:#fff;color:var(--ink);box-shadow:var(--sh)}
.sv1-gd-bar input:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.sv1-gd-chipsrow{display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:thin}
.sv1-gd-chip{font:inherit;font-size:13px;min-height:38px;padding:6px 12px;border:1px solid var(--l);border-radius:999px;background:#fff;color:var(--ink);white-space:nowrap;cursor:pointer}
.sv1-gd-chip span{color:var(--mut);font-size:12px;margin-inline-start:4px}
.sv1-gd-chip[aria-pressed=true]{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-gd-chip[aria-pressed=true] span{color:#dfe5ff}
.sv1-gd-meta{margin:0 0 10px;font-size:12.5px;color:var(--mut)}
.sv1-gd-empty{background:#fff;border:1px dashed var(--l);border-radius:12px;padding:20px;color:var(--mut);font-size:14px}
.sv1-gd-moreb{text-align:center;margin:18px 0}
.sv1-gd-note-s{margin:14px 0 0;font-size:12.5px;line-height:1.85;color:var(--mut)}
.sv1-gd-vflow{list-style:none;margin:0 0 18px;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.sv1-gd-vflow li{background:#fff;border:1px solid var(--l);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:6px}
.sv1-gd-vflow i{font-style:normal;font-family:var(--fm);width:30px;height:30px;border-radius:9px;background:var(--acSoft);color:var(--ac);display:grid;place-items:center;font-weight:600;font-size:13px}
.sv1-gd-vflow b{font-size:14.5px;font-weight:500;color:var(--ink)}
.sv1-gd-vflow span{font-size:13px;line-height:1.8;color:var(--s)}
.sv1-gd-guarantee{background:#fff7ec;border:1px solid #f2d3a3;border-radius:10px;padding:12px 14px;font-size:13.5px;line-height:1.85;color:#5a3a06;margin:0 0 20px}
.sv1-gd-cta{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 0}
.sv1-gd-ticks{margin:4px 0 14px;padding:0;list-style:none;display:grid;gap:8px;font-size:14px;color:var(--t)}
.sv1-gd-ticks li::before{content:"✓";color:var(--ok);font-weight:700;margin-inline-end:8px}
.sv1-gd-toast{position:fixed;inset-inline:16px;bottom:16px;z-index:40;max-width:420px;margin-inline:auto;background:var(--ink);color:#fff;border-radius:12px;padding:12px 16px;font-size:13.5px;display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:var(--sh2)}
.sv1-gd-toast[hidden]{display:none}
.sv1-gd-toast.err{background:#8a1c1c}
.sv1-gd-toast a{color:#cfe0ff;font-weight:600;white-space:nowrap}
.sv1-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sv1-gd-end{margin:26px 0 0;font-size:13px;line-height:1.85;color:var(--mut)}
@media(max-width:980px){.sv1-gd-jgrid{grid-template-columns:1fr}.sv1-gd-side{position:static}.sv1-gd-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.sv1-gd-vflow{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.sv1-gd-cards,.sv1-gd-vflow{grid-template-columns:1fr}.sv1-gd-head h1{font-size:28px}}
</style>`;

  const body = `${SV1.header("/guide")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-gd-head">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("title"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
      <ul class="sv1-gd-stats"><li>${esc(tn("nSectors", sectors.length))}</li><li>${esc(tn("nEntities", entGov.length))}</li><li>${esc(tn("nServices", services.length))}</li></ul>
    </div>
    <div class="sv1-gd-banner" role="note">${esc(t("banner"))}</div>
    <div class="sv1-gd-tabs" role="tablist" aria-label="${esc(t("tabsLabel"))}" id="sbcTabs">${tabsHtml}</div>
    ${panels}
    <p class="sv1-gd-end">${esc(t("disclaimer"))}</p>
  </div></section>
  </main>
  <div class="sv1-gd-toast" id="sbcToast" role="status" aria-live="polite" hidden><span id="sbcToastTx"></span><a id="sbcToastCart" href="${esc(u("/cart"))}">${esc(t("viewCart"))}</a></div>
${SV1.footer()}`;

  const TX = { showing: t("showing"), added: t("added"), addCart: t("addCart"), addedToast: t("addedToast"), cartFail: t("cartFail") };
  const script = `<script>(function(){
var TX=${JSON.stringify(TX)},HOME=${JSON.stringify(home)},LIM=${PAGE};
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
function norm(s){return String(s||'').toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')}
// ألسنة بأدوار ARIA: أسهم/Home/End بحسب اتجاه الصفحة.
function tabset(list,onSel){
 function sel(t,f){list.forEach(function(x){var on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;var p=document.getElementById(x.getAttribute('aria-controls'));if(p)p.hidden=!on});if(f)t.focus();if(onSel)onSel(t)}
 list.forEach(function(t,i){t.addEventListener('click',function(){sel(t)});
  t.addEventListener('keydown',function(e){var rtl=getComputedStyle(document.documentElement).direction==='rtl';var k=e.key,n=-1;
   if(k==='ArrowRight')n=i+(rtl?-1:1);else if(k==='ArrowLeft')n=i+(rtl?1:-1);else if(k==='Home')n=0;else if(k==='End')n=list.length-1;
   if(n<0)return;e.preventDefault();sel(list[(n+list.length)%list.length],true)})});
 return sel}
var main=$$('#sbcTabs [role=tab]'),secs=$$('.sv1-gd-sectabs [role=tab]');
function setHash(){try{var m=$('#sbcTabs [aria-selected=true]'),id=m.id.replace('sbc-tab-','');
 if(id==='journey'){var s=$('.sv1-gd-sectabs [aria-selected=true]');if(s)id='journey-'+s.id.replace('sbc-sec-','')}
 history.replaceState(null,'','#'+id)}catch(e){}}
var selMain=tabset(main,setHash),selSec=tabset(secs,setHash);
function fromHash(){var h=(location.hash||'').slice(1);if(!h)return;
 if(h.indexOf('journey-')===0){var s=document.getElementById('sbc-sec-'+h.slice(8));if(s){selMain(document.getElementById('sbc-tab-journey'));selSec(s)}return}
 var t=document.getElementById('sbc-tab-'+h);if(t)selMain(t)}
fromHash();window.addEventListener('hashchange',fromHash);
$$('[data-goto]').forEach(function(b){b.addEventListener('click',function(){var t=document.getElementById('sbc-tab-'+b.getAttribute('data-goto'));if(t){selMain(t);t.scrollIntoView({block:'nearest'})}})});
// تصفية الإجراءات: بحث + الجهة، وعرض ${PAGE} ثم المزيد.
var cards=$$('#sbcGrid .sv1-gd-svc'),q=$('#sbcQ'),chips=$$('#sbcChips [data-ent]'),more=$('#sbcMore'),cnt=$('#sbcCount'),none=$('#sbcNone'),st={ent:'',lim:LIM};
function draw(){var s=norm(q.value).trim(),n=0,tot=0;
 cards.forEach(function(c){var ok=(!st.ent||c.dataset.entity===st.ent)&&(!s||c.dataset.q.indexOf(s)>-1);
  if(ok){tot++;c.hidden=n>=st.lim;if(!c.hidden)n++}else c.hidden=true});
 cnt.textContent=TX.showing.replace('{a}',n).replace('{b}',tot);more.hidden=n>=tot;none.hidden=tot>0}
if(q){q.addEventListener('input',function(){st.lim=LIM;draw()});
 chips.forEach(function(c){c.addEventListener('click',function(){chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)});st.ent=c.getAttribute('data-ent');st.lim=LIM;draw()})});
 more.addEventListener('click',function(){st.lim+=LIM;draw()});draw()}
// السلة: عقد /catalog نفسه (bp_cart، qty يزيد، حدث bp:cart).
function cartAdd(b){var c;try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
 var ex=c.filter(function(x){return x.id===b.id})[0];
 if(ex)ex.qty=(ex.qty||1)+1;else c.push({id:b.id,nameEn:b.nameEn||'',nameAr:b.nameAr||'',amount:b.amount?Number(b.amount):null,price:'',kind:'service',qty:1,surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0});
 try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}return true}
var tt=0;function toast(msg,err,link){var b=$('#sbcToast');$('#sbcToastTx').textContent=msg;$('#sbcToastCart').style.display=link?'':'none';b.classList.toggle('err',!!err);b.hidden=false;clearTimeout(tt);tt=setTimeout(function(){b.hidden=true},4200)}
document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;
 var a=t.closest('[data-add]');
 if(a){var ok=cartAdd({id:a.dataset.id,nameAr:a.dataset.nameAr,nameEn:a.dataset.nameEn,amount:a.dataset.amount});
  if(!ok){toast(TX.cartFail,true,false);return}
  var old=a.textContent;a.textContent=TX.added;setTimeout(function(){a.textContent=old},1600);toast(TX.addedToast,false,true);return}
 var k=t.closest('[data-ask]');
 if(k){try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:[{code:k.dataset.code,title:k.dataset.title,why:k.dataset.why}],door:k.dataset.door,text:k.dataset.title,name:k.dataset.title,code:k.dataset.code,at:Date.now()}))}catch(x){}
  location.href=HOME+'#advisor'}});
})();</script>`;

  return SV1.shell({
    title: `${t("metaTitle")} — Business Partner`,
    desc: t("desc"),
    path: "/guide",
    body: CSS + body,
    script,
    noindex: meta.noindex === true,
  });
}

// ------------------------------------------------- مدخل الرئيسية (تحت المحادثة) --
// يحلّ محلّ شريط «رحلة واحدة لكل الخدمات». بطاقات القطاعات + زر «افتح الدليل».
// المعرّف #how باقٍ كما كان لأن «كيف نبدأ» في الترويسة يرسو عليه.
export function guideEntrance({ esc, href, lang }) {
  const l = lang();
  const t = (k) => pickL(GUIDE_TEXT[k], l);
  const arrow = l === "ar" ? "←" : "→";
  const { sectors } = guideModel(l);
  const g = href("/guide");
  const cards = sectors.map((s) =>
    `<a class="sv1-gh-card" href="${esc(g)}#journey-${esc(s.id)}" data-track="دليل المستثمر: ${esc(s.id)}"><i aria-hidden="true">${s.icon}</i><b>${esc(s.name)}</b><small>${esc(t("nServices").replace("{n}", String(s.count)))}</small></a>`).join("");
  const links = [["procedures", pickL(GUIDE_TEXT.tab.procedures, l)], ["regulations", pickL(GUIDE_TEXT.tab.regulations, l)], ["violations", pickL(GUIDE_TEXT.tab.violations, l)], ["video", t("hVideo")]]
    .map(([k, label]) => `<a href="${esc(g)}#${k}">${esc(label)}</a>`).join("");
  const css = `<style id="sv1-gd-home-css">
.sv1-gh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:980px;margin:0 auto}
.sv1-gh-card{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;background:#fff;border:1px solid var(--l);border-radius:12px;padding:14px 16px;min-height:64px;color:var(--ink);transition:border-color .15s,box-shadow .15s}
.sv1-gh-card:hover{border-color:var(--ac);box-shadow:var(--sh)}
.sv1-gh-card:focus-visible,.sv1-gh-links a:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.sv1-gh-card i{grid-row:1/3;font-style:normal;font-size:22px;width:40px;height:40px;border-radius:10px;background:var(--acSoft);display:grid;place-items:center}
.sv1-gh-card b{font-size:14.5px;font-weight:500;line-height:1.4}
.sv1-gh-card small{font-size:12px;color:var(--mut)}
.sv1-gh-cta{display:flex;flex-direction:column;align-items:center;gap:14px;margin:22px 0 0}
.sv1-gh-links{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;font-size:13.5px}
.sv1-gh-links a{color:var(--ac);font-weight:500;min-height:24px;display:inline-block}
@media(max-width:860px){.sv1-gh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.sv1-gh-card{padding:12px;column-gap:10px}.sv1-gh-card i{width:34px;height:34px;font-size:18px}.sv1-gh-card b{font-size:13.5px}}
</style>`;
  const html = `<section class="sv1-sec sv1-gray" id="how"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("hTitle"))}</h2><p>${esc(t("hSub"))}</p></div>
    <div class="sv1-gh-grid">${cards}</div>
    <div class="sv1-gh-cta"><a class="sv1-btn primary" href="${esc(g)}" data-track="افتح دليل المستثمر">${esc(t("hOpen"))} ${arrow}</a>
      <nav class="sv1-gh-links" aria-label="${esc(t("hLinks"))}">${links}</nav></div>
  </div></section>`;
  return { html, css };
}
