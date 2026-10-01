// Business Partner — Simple V1: «موظفون على بند التعاقد (EOR)» (/eor).
//
// صفحة شرحٍ ونموذج طلب على SV1.shell() بأربع لغات (ar/en/fr/zh). يملكها وكيل `eor`.
//
// ما خلف النموذج: POST /api/requests?__route=eor ← handleEor في api/_eor.js (يربطه owner-ops).
// بحث المهن: محلّي على قائمة مدمجة صغيرة (id + عربي + إنجليزي) تُولَّد وقت البناء من
// api/_occupations.js، وإن قلّت النتائج سُئل الخادم GET ?__route=eor&action=search&q= (يعرف
// المرادفات: CDP، chef de partie…). لا شيء من api/_occupation-map.json يدخل هذه الصفحة أبداً:
// مفاتيحها مسمّياتٌ حقيقية من سير مرشّحين، و`site/` يُنشر علناً.
//
// بلا main.js (قشرة SV1 وحدها) ولا localStorage. الأسعار: لا سعر في الصفحة — «يُحدَّد بعد مراجعة طلبك».
// لا زرّ واتساب داخل المحتوى (الزرّ العائم فقط). الاسم الظاهر «Business Partner».
//
// السكربت العميل دالةٌ عاديّة (eorClient) تُسلسَل بـtoString، فلا يُضاعَف فيها الـbackslash كما في قوالب النصوص.

import { OCCUPATIONS } from "../../api/_occupations.js";
import { NATIONALITIES, EOR_LIMITS } from "../../api/_eor.js";

// ar, en, fr, zh
const D = {
  title: ["موظفون على بند التعاقد (EOR)", "Staff on our contract (EOR)", "Personnel sous notre contrat (EOR)", "由我们签约的员工 (EOR)"],
  tag: ["خدمة EOR", "EOR service", "Service EOR", "EOR 服务"],
  sub: ["نحن صاحب العمل الرسمي لموظفيك", "We are the official employer of your staff", "Nous sommes l'employeur officiel de votre personnel", "我们是您员工的正式雇主"],
  lead: [
    "تحتاج موظفين لكن لا تريد أن تكون الجهة المتعاقدة معهم؟ نتعاقد نحن مع العاملين رسمياً ونتولى إدارتهم الوظيفية، وهم يعملون عندك ويتبعون توجيهك اليومي. سعوديون أو أجانب، مع الاستقدام عند الحاجة.",
    "Need staff but prefer not to be their contracting party? We hire the workers officially and handle their employment administration, while they work for you under your day-to-day direction. Saudi or foreign, with recruitment where needed.",
    "Besoin de personnel sans en être l'employeur contractuel ? Nous engageons officiellement les travailleurs et gérons leur administration, tandis qu'ils travaillent pour vous sous votre direction quotidienne. Saoudiens ou étrangers, avec recrutement si nécessaire.",
    "需要员工，却不想成为合同主体？由我们正式雇用员工并负责其用工管理，他们在您处工作、接受您的日常安排。沙特籍或外籍均可，必要时协助招聘。",
  ],
  desc: [
    "موظفوك يعملون عندك ونحن صاحب العمل الرسمي: التعاقد والرواتب والتأمينات والإجازات والمستحقات، مع الاستقدام عند الحاجة.",
    "Your staff work for you and we are their official employer: contracts, payroll, insurance, leave and entitlements, with recruitment where needed.",
    "Vos équipes travaillent pour vous et nous sommes leur employeur officiel : contrats, paie, assurances, congés et indemnités, avec recrutement si nécessaire.",
    "员工为您工作，我们作为其正式雇主：合同、薪资、保险、休假与应付款项，必要时协助招聘。",
  ],
  cta: ["اطلب عرضاً", "Request a quote", "Demander une offre", "申请报价"],
  how: ["كيف تعمل؟", "How it works", "Comment ça marche", "如何运作"],
  offerH: ["ماذا نقدّم بالتحديد", "What we provide", "Ce que nous fournissons", "我们具体提供什么"],
  offerP: ["خدمة واحدة تجمع ما يلزم لتوظيف رسمي دون أن تكون أنت الجهة المتعاقدة.", "One service covering what formal employment needs, without you being the contracting party.", "Un seul service qui couvre l'emploi formel, sans que vous soyez la partie contractante.", "一项服务涵盖正式用工所需，您无需成为合同主体。"],
  o1: ["التعاقد الرسمي بدلاً عنك", "Official contracting on your behalf", "Contrat officiel à votre place", "代您正式签约"],
  o1p: ["نُعدّ عقود العاملين ونكون الجهة المتعاقدة معهم بموجب اتفاقية بيننا وبينك.", "We prepare the workers' contracts and act as the contracting party, under an agreement between us and you.", "Nous préparons les contrats et agissons comme partie contractante, dans le cadre d'un accord entre vous et nous.", "我们拟定员工合同并作为合同主体，依据我们与您之间的协议。"],
  o2: ["الرواتب", "Payroll", "Paie", "薪资"],
  o2p: ["تشغيل الرواتب في موعدها بناءً على حضور تعتمده أنت.", "Payroll run on the agreed dates, based on attendance you approve.", "Paie exécutée aux dates convenues, sur la base des présences que vous validez.", "按约定日期发薪，依据您确认的考勤。"],
  o3: ["التأمينات والإجازات والمستحقات", "Insurance, leave and entitlements", "Assurances, congés et indemnités", "保险、休假与应付款项"],
  o3p: ["ترتيبها وفق الأنظمة المعمول بها وما تنصّ عليه الاتفاقية.", "Arranged in line with the regulations in force and the agreement.", "Organisés conformément à la réglementation en vigueur et à l'accord.", "依据现行法规及协议安排。"],
  o4: ["الاستقدام والتوطين حسب الحالة", "Recruitment and localization, case by case", "Recrutement et localisation, selon le cas", "视情况提供招聘与本地化"],
  o4p: ["نبحث عن المرشحين ونتابع إجراءات الاستقدام عبر القنوات الرسمية عند الحاجة، دون وعدٍ بنتيجة أو بمدة محددة.", "Where needed we source candidates and follow recruitment procedures through official channels, with no promise of an outcome or fixed timeline.", "Au besoin, nous recherchons des candidats et suivons les procédures par les voies officielles, sans promesse de résultat ni de délai.", "必要时我们寻找候选人并通过官方渠道跟进招聘流程，不承诺结果或具体时限。"],
  o5: ["ملفات العاملين", "Employee files", "Dossiers des employés", "员工档案"],
  o5p: ["نحتفظ بملف كل عامل ونتابع عقده ومستنداته.", "We keep each worker's file and follow their contract and documents.", "Nous tenons le dossier de chaque travailleur et suivons son contrat et ses documents.", "我们保管每位员工的档案，并跟进其合同与文件。"],
  o6: ["إنهاء التعاقد", "Termination", "Fin de contrat", "合同终止"],
  o6p: ["ننظّم الإنهاء والتسوية النهائية للمستحقات وفق الاتفاقية والأنظمة.", "We manage termination and the final settlement of entitlements under the agreement and regulations.", "Nous gérons la fin de contrat et le solde de tout compte selon l'accord et la réglementation.", "依据协议与法规办理终止及最终结算。"],
  whoH: ["من تناسبه هذه الخدمة", "Who it suits", "À qui s'adresse ce service", "适合谁"],
  w1: ["شركة تدخل السوق السعودي وتريد فريقاً يعمل بسرعة", "A company entering the Saudi market that wants a team working quickly", "Une entreprise qui entre sur le marché saoudien et veut une équipe rapidement", "进入沙特市场、希望团队尽快就位的公司"],
  w2: ["مشروع بمدة محددة يحتاج عمالة لفترة معلومة", "A fixed-term project that needs workers for a known period", "Un projet à durée déterminée qui nécessite de la main-d'œuvre pour une période connue", "需要在已知期限内用工的定期项目"],
  w3: ["منشأة تريد التركيز على نشاطها وترك الإدارة الوظيفية لنا", "A business that wants to focus on its activity and leave employment administration to us", "Une entreprise qui veut se concentrer sur son activité et nous confier l'administration du personnel", "希望专注主业、把用工管理交给我们的企业"],
  w4: ["جهة تحتاج مهناً وجنسيات متعددة في طلب واحد", "An organization that needs several occupations and nationalities in one request", "Une organisation qui a besoin de plusieurs métiers et nationalités dans une seule demande", "需要在一次申请中涵盖多个职业和国籍的机构"],
  howH: ["كيف تعمل الخدمة", "How the service works", "Comment le service fonctionne", "服务流程"],
  s1: ["تعبّئ الطلب: المهن والأعداد والجنسيات", "You fill in the request: occupations, numbers, nationalities", "Vous remplissez la demande : métiers, effectifs, nationalités", "您填写申请：职业、人数、国籍"],
  s2: ["يراجع فريقنا الطلب ويتواصل معك", "Our team reviews it and contacts you", "Notre équipe l'examine et vous contacte", "我们的团队审核并与您联系"],
  s3: ["نُعدّ لك عرض سعر ونطاق عمل واضحين لتوافق عليهما", "We prepare a clear quote and scope of work for your approval", "Nous préparons une offre et un périmètre clairs pour votre accord", "我们准备清晰的报价和工作范围供您确认"],
  s4: ["توقيع الاتفاقية وبدء إجراءات التعاقد (والاستقدام إن لزم)", "Sign the agreement and start contracting (and recruitment if needed)", "Signature de l'accord et début des démarches de contrat (et de recrutement si besoin)", "签署协议并启动签约流程（如需则含招聘）"],
  s5: ["يبدأ الموظفون العمل عندك ونتولى الإدارة الوظيفية", "Staff start working for you and we handle the employment administration", "Le personnel commence chez vous et nous gérons l'administration", "员工开始在您处工作，我们负责用工管理"],
  faqH: ["أسئلة شائعة", "Frequently asked questions", "Questions fréquentes", "常见问题"],
  q1: ["ما الفرق بين EOR والتوظيف المباشر؟", "How is EOR different from hiring directly?", "Quelle différence entre EOR et embauche directe ?", "EOR 与直接雇用有何区别？"],
  a1: ["في خدمة EOR نحن الجهة المتعاقدة رسمياً مع العامل، وهو يعمل عندك بتوجيهك. أما في التوظيف المباشر فأنت الجهة المتعاقدة.", "With EOR we are the worker's official contracting party and the worker works for you under your direction. With direct hiring, you are the contracting party.", "Avec l'EOR, nous sommes la partie contractante officielle du travailleur, qui travaille chez vous sous votre direction. En embauche directe, c'est vous.", "使用 EOR 时，我们是员工的正式合同主体，员工在您处工作并接受您的安排；直接雇用则由您作为合同主体。"],
  q2: ["هل أستطيع تحديد المهن والجنسيات؟", "Can I specify the occupations and nationalities?", "Puis-je préciser les métiers et les nationalités ?", "我可以指定职业和国籍吗？"],
  a2: ["نعم. تحدّد في النموذج المهن والأعداد والجنسيات المطلوبة، ويتواصل معك فريقنا لتأكيد ما يمكن تنفيذه.", "Yes. You list the occupations, numbers and nationalities in the form, and our team contacts you to confirm what can be done.", "Oui. Vous indiquez métiers, effectifs et nationalités dans le formulaire, et notre équipe vous contacte pour confirmer ce qui est faisable.", "可以。您在表单中填写职业、人数和国籍，我们的团队会联系您确认可行的安排。"],
  q3: ["كم السعر؟", "What does it cost?", "Quel est le prix ?", "费用是多少？"],
  a3: ["يُحدَّد السعر بعد مراجعة طلبك بحسب المهن والأعداد والمدة. لا نعرض سعراً قبل ذلك.", "The price is set after we review your request, depending on occupations, numbers and duration. We do not show a price before that.", "Le prix est fixé après examen de votre demande, selon métiers, effectifs et durée. Nous n'affichons pas de prix avant.", "价格在审核您的申请后，根据职业、人数和期限确定。在此之前我们不显示价格。"],
  q4: ["هل تشمل الخدمة الاستقدام؟", "Does the service include recruitment?", "Le service inclut-il le recrutement ?", "服务包含招聘吗？"],
  a4: ["عند الحاجة وبحسب الحالة. تحدّد في النموذج إن كان الاستقدام لازماً، ونناقش التفاصيل معك دون وعدٍ بنتيجة أو بمدة.", "Where needed and case by case. You tell us in the form whether recruitment is needed and we discuss the details with you, with no promise of an outcome or timeline.", "Au besoin et selon le cas. Vous indiquez dans le formulaire si le recrutement est nécessaire ; nous en discutons sans promesse de résultat ni de délai.", "视情况而定。您在表单中说明是否需要招聘，我们与您讨论细节，不承诺结果或时限。"],
  q5: ["ماذا يحدث بعد إرسال الطلب؟", "What happens after I send the request?", "Que se passe-t-il après l'envoi ?", "提交后会怎样？"],
  a5: ["تحصل على رقم مرجعي، ويراجع فريقنا الطلب ويعود إليك. لا يُلزمك الطلب بشيء قبل توقيع الاتفاقية.", "You get a reference number, and our team reviews the request and gets back to you. The request commits you to nothing before an agreement is signed.", "Vous recevez un numéro de référence, notre équipe examine la demande et revient vers vous. La demande ne vous engage à rien avant la signature d'un accord.", "您会收到参考编号，我们的团队审核后与您联系。在签署协议之前，该申请不对您构成任何约束。"],
  formH: ["اطلب عرضاً لموظفيك", "Request a quote for your staff", "Demandez une offre pour votre personnel", "为您的员工申请报价"],
  formP: ["عبّئ الطلب وسنعود إليك. لا نعرض سعراً فورياً: يُحدَّد بعد المراجعة.", "Fill in the request and we will get back to you. There is no instant price: it is set after review.", "Remplissez la demande et nous reviendrons vers vous. Pas de prix immédiat : il est fixé après examen.", "填写申请，我们会与您联系。不提供即时报价：价格在审核后确定。"],
  g1: ["بيانات المنشأة", "Your organization", "Votre organisation", "机构信息"],
  g2: ["العاملون المطلوبون", "Workers needed", "Travailleurs demandés", "所需员工"],
  g3: ["المدة والملاحظات", "Term and notes", "Durée et remarques", "期限与备注"],
  company: ["اسم المنشأة", "Company name", "Nom de l'entreprise", "公司名称"],
  contact: ["جهة التواصل", "Contact person", "Personne de contact", "联系人"],
  email: ["البريد الإلكتروني", "E-mail", "E-mail", "电子邮箱"],
  phone: ["الجوال", "Mobile", "Mobile", "手机号"],
  city: ["المدينة", "City", "Ville", "城市"],
  wtH: ["نوع العاملين", "Type of workers", "Type de travailleurs", "员工类型"],
  wtSaudi: ["سعوديون", "Saudi", "Saoudiens", "沙特籍"],
  wtForeign: ["أجانب", "Foreign", "Étrangers", "外籍"],
  wtBoth: ["الاثنان", "Both", "Les deux", "两者都有"],
  rcH: ["هل يلزم استقدام؟", "Is recruitment needed?", "Recrutement nécessaire ?", "是否需要招聘？"],
  rcYes: ["نعم", "Yes", "Oui", "需要"],
  rcNo: ["لا", "No", "Non", "不需要"],
  rcUnsure: ["لست متأكداً", "Not sure", "Pas sûr", "不确定"],
  itemsH: ["المهن المطلوبة", "Occupations needed", "Métiers demandés", "所需职业"],
  itemN: ["مهنة", "Occupation", "Métier", "职业"],
  occ: ["المهنة", "Occupation", "Métier", "职业"],
  occPh: ["اكتب للبحث: نادل، مهندس، Chef…", "Type to search: waiter, engineer, chef…", "Tapez pour chercher : serveur, ingénieur, chef…", "输入搜索：服务员、工程师、厨师…"],
  occNone: ["لا نتائج. جرّب كلمة أخرى.", "No results. Try another word.", "Aucun résultat. Essayez un autre mot.", "无结果，请换个词。"],
  count: ["العدد", "Number", "Nombre", "人数"],
  nats: ["الجنسيات", "Nationalities", "Nationalités", "国籍"],
  natAny: ["غير محدّدة", "Not specified", "Non précisées", "未指定"],
  salary: ["الراتب الشهري المتوقع (اختياري)", "Expected monthly salary, SAR (optional)", "Salaire mensuel prévu, SAR (facultatif)", "预期月薪，沙特里亚尔（可选）"],
  remove: ["حذف", "Remove", "Supprimer", "删除"],
  add: ["أضف مهنة", "Add an occupation", "Ajouter un métier", "添加职业"],
  total: ["إجمالي الموظفين", "Total employees", "Total des employés", "员工总数"],
  start: ["تاريخ البدء المتوقع (اختياري)", "Expected start date (optional)", "Date de début prévue (facultatif)", "预计开始日期（可选）"],
  months: ["مدة التعاقد (أشهر)", "Contract duration (months)", "Durée du contrat (mois)", "合同期限（月）"],
  notes: ["ملاحظات (اختياري)", "Notes (optional)", "Remarques (facultatif)", "备注（可选）"],
  submit: ["أرسل الطلب", "Send request", "Envoyer la demande", "提交申请"],
  sending: ["نرسل طلبك…", "Sending…", "Envoi…", "正在提交…"],
  honest: ["بإرسال الطلب لا تلتزم بشيء. نراجعه ونعود إليك بعرض سعر ونطاق عمل.", "Sending the request commits you to nothing. We review it and come back with a quote and scope of work.", "L'envoi ne vous engage à rien. Nous l'examinons et revenons avec une offre et un périmètre.", "提交申请不构成任何约束。我们审核后会提供报价和工作范围。"],
  eCompany: ["اكتب اسم المنشأة.", "Enter the company name.", "Saisissez le nom de l'entreprise.", "请填写公司名称。"],
  eContact: ["اكتب اسم جهة التواصل.", "Enter the contact person.", "Saisissez la personne de contact.", "请填写联系人。"],
  eEmail: ["اكتب بريداً إلكترونياً صحيحاً.", "Enter a valid e-mail.", "Saisissez un e-mail valide.", "请填写有效的邮箱。"],
  ePhone: ["اكتب رقم جوال صحيحاً (٨ إلى ١٥ رقماً).", "Enter a valid mobile number (8 to 15 digits).", "Saisissez un numéro valide (8 à 15 chiffres).", "请填写有效的手机号（8–15 位数字）。"],
  eCity: ["اكتب المدينة.", "Enter the city.", "Saisissez la ville.", "请填写城市。"],
  eWorker: ["اختر نوع العاملين.", "Choose the type of workers.", "Choisissez le type de travailleurs.", "请选择员工类型。"],
  eRecruit: ["حدّد إن كان الاستقدام لازماً.", "Say whether recruitment is needed.", "Indiquez si le recrutement est nécessaire.", "请说明是否需要招聘。"],
  eItems: ["أضف مهنة واحدة على الأقل.", "Add at least one occupation.", "Ajoutez au moins un métier.", "请至少添加一个职业。"],
  eOcc: ["اختر المهنة من القائمة في كل بند.", "Pick the occupation from the list in every row.", "Choisissez le métier dans la liste pour chaque ligne.", "请在每一项中从列表选择职业。"],
  eCount: ["العدد في كل بند من ١ إلى ٥٠٠.", "The number in each row must be 1 to 500.", "Le nombre de chaque ligne doit être de 1 à 500.", "每项人数需为 1 至 500。"],
  eTotal: ["إجمالي الموظفين لا يتجاوز ٥٠٠.", "Total employees cannot exceed 500.", "Le total ne peut pas dépasser 500.", "员工总数不能超过 500。"],
  eSalary: ["الراتب المتوقع رقم صحيح أو اتركه فارغاً.", "Expected salary must be a valid number, or leave it empty.", "Le salaire prévu doit être un nombre valide, ou laissez vide.", "预期月薪须为有效数字，或留空。"],
  eStart: ["تاريخ البدء غير صالح.", "The start date is not valid.", "La date de début n'est pas valide.", "开始日期无效。"],
  eMonths: ["مدة التعاقد من ١ إلى ٦٠ شهراً.", "Duration must be 1 to 60 months.", "La durée doit être de 1 à 60 mois.", "期限需为 1 至 60 个月。"],
  eNet: ["تعذّر إرسال الطلب. حاول مرة أخرى بعد قليل أو تواصل معنا.", "We could not send the request. Try again shortly or contact us.", "Envoi impossible. Réessayez bientôt ou contactez-nous.", "无法提交申请。请稍后重试或联系我们。"],
  eRate: ["محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", "Too many attempts. Wait a little and try again.", "Trop de tentatives. Patientez puis réessayez.", "尝试次数过多，请稍后再试。"],
  doneT: ["استلمنا طلبك", "We received your request", "Nous avons reçu votre demande", "我们已收到您的申请"],
  doneRef: ["رقمك المرجعي", "Your reference number", "Votre numéro de référence", "您的参考编号"],
  doneP: ["سيراجع فريقنا الطلب ونعود إليك. لم يُحدَّد سعر بعد؛ يصلك عرض السعر بعد المراجعة.", "Our team will review the request and get back to you. No price has been set yet; you will receive a quote after the review.", "Notre équipe examinera la demande et reviendra vers vous. Aucun prix n'est encore fixé ; vous recevrez une offre après l'examen.", "我们的团队会审核申请并与您联系。目前尚未确定价格；审核后您将收到报价。"],
  another: ["طلب جديد", "New request", "Nouvelle demande", "新申请"],
  itemCount: ["بنود", "rows", "lignes", "项"],
};

export function buildSimpleEor(sv1, ctx) {
  const { lang, esc } = ctx;
  const LI = { ar: 0, en: 1, fr: 2, zh: 3 };
  const l = lang();
  const idx = LI[l] != null ? LI[l] : 1;
  const t = (k) => { const e = D[k]; return e ? e[idx] : k; };

  // قوائم مدمجة صغيرة — id + اسمان فقط (لا مرادفات ولا قطاعات ولا الخريطة الخاصة).
  const OCC = OCCUPATIONS.map((o) => [o.id, o.nameAr, o.nameEn]);
  const NATS = NATIONALITIES.map((n) => [n.code, n.ar, n.en]);
  const TXKEYS = ["occPh", "occNone", "natAny", "remove", "itemN", "total", "itemCount", "sending", "submit",
    "eCompany", "eContact", "eEmail", "ePhone", "eCity", "eWorker", "eRecruit", "eItems", "eOcc", "eCount", "eTotal", "eSalary", "eStart", "eMonths", "eNet", "eRate",
    "doneT", "doneRef", "doneP", "another", "nats", "occ", "count", "salary"];
  const TX = {};
  for (const k of TXKEYS) TX[k] = t(k);
  const CFG = {
    lang: l, tx: TX, occ: OCC, nats: NATS,
    lim: { maxItems: EOR_LIMITS.maxItems, maxTotal: EOR_LIMITS.maxTotalCount, maxItemCount: EOR_LIMITS.maxItemCount, maxMonths: EOR_LIMITS.maxMonths, maxSalary: EOR_LIMITS.maxSalary, maxNats: EOR_LIMITS.maxNationalities },
  };

  const CSS = `<style id="sv1-eor-css">
.sv1-eor-hero{padding:56px 0 40px;text-align:center}
.sv1-eor-hero h1{font-size:clamp(28px,4.4vw,46px);margin:14px 0 10px}
.sv1-eor-hero .sub{font-size:clamp(17px,2.2vw,22px);color:var(--ac);font-weight:400;margin:0 0 14px}
.sv1-eor-hero .lead{max-width:720px;margin:0 auto 22px;color:var(--mut);line-height:1.95}
.sv1-eor-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.sv1-eor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:1000px;margin:0 auto}
.sv1-eor-grid>*{min-width:0}
.sv1-eor-card{background:#fff;border:1px solid var(--l);border-radius:13px;padding:20px;box-shadow:var(--sh)}
.sv1-eor-card h3{font-size:15px;font-weight:500;margin:0 0 8px}
.sv1-eor-card p{margin:0;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-eor-who{max-width:760px;margin:0 auto;display:grid;gap:10px;padding:0;list-style:none}
.sv1-eor-who li{background:var(--soft);border:1px solid var(--line2);border-radius:11px;padding:13px 16px;font-size:13.5px}
.sv1-eor-steps{max-width:760px;margin:0 auto;display:grid;gap:10px;padding:0;list-style:none;counter-reset:s}
.sv1-eor-steps li{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid var(--l);border-radius:11px;padding:13px 16px;font-size:13.5px}
.sv1-eor-steps li::before{counter-increment:s;content:counter(s);flex:none;width:28px;height:28px;border-radius:50%;background:var(--ac);color:#fff;display:grid;place-items:center;font-family:var(--fm);font-size:13px}
.sv1-eor-faq{max-width:760px;margin:0 auto;display:grid;gap:9px}
.sv1-eor-faq details{background:#fff;border:1px solid var(--l);border-radius:11px;padding:0 16px}
.sv1-eor-faq summary{cursor:pointer;padding:14px 0;font-weight:500;font-size:14px;color:var(--ink)}
.sv1-eor-faq p{margin:0 0 14px;color:var(--mut);font-size:13px;line-height:1.9}
.sv1-eor-form{max-width:860px;margin:0 auto;background:#fff;border:1px solid var(--l);border-radius:15px;padding:26px;box-shadow:var(--sh2)}
.sv1-eor-form fieldset{border:0;padding:0;margin:0 0 22px;min-width:0}
.sv1-eor-form legend{font-size:14px;font-weight:500;color:var(--ink);padding:0;margin-bottom:12px}
.sv1-eor-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-eor-cols>*{min-width:0}
.sv1-eor-form label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-eor-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:#fff;color:var(--t)}
.sv1-eor-in:focus{border-color:var(--ac)}
.sv1-eor-in[aria-invalid=true]{border-color:#b42318}
textarea.sv1-eor-in{min-height:84px;resize:vertical}
.sv1-eor-radios{display:flex;gap:8px;flex-wrap:wrap}
.sv1-eor-radios label{display:inline-flex;align-items:center;gap:7px;margin:0;border:1px solid var(--l);border-radius:999px;padding:8px 15px;font-size:13px;color:var(--t);cursor:pointer}
.sv1-eor-radios input{accent-color:var(--ac)}
.sv1-eor-hp{position:absolute!important;inset-inline-start:-9999px;width:1px;height:1px;overflow:hidden}
.sv1-eor-item{border:1px solid var(--l);border-radius:12px;padding:14px;margin-bottom:11px;background:var(--soft)}
.sv1-eor-ihead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;color:var(--mut)}
.sv1-eor-igrid{display:grid;grid-template-columns:2fr 1fr;gap:10px}
.sv1-eor-igrid>*{min-width:0}
.sv1-eor-igrid .full{grid-column:1/-1}
.sv1-eor-cb{position:relative}
.sv1-eor-list{position:absolute;inset-inline:0;top:100%;z-index:5;margin:3px 0 0;padding:4px;list-style:none;background:#fff;border:1px solid var(--acLine);border-radius:10px;box-shadow:var(--sh2);max-height:240px;overflow:auto}
.sv1-eor-list li{padding:8px 10px;border-radius:7px;font-size:13px;cursor:pointer}
.sv1-eor-list li.on,.sv1-eor-list li:hover{background:var(--acSoft)}
.sv1-eor-list li small{display:block;color:var(--faint);font-size:11px}
.sv1-eor-list li.none{cursor:default;color:var(--mut)}
.sv1-eor-nat summary{cursor:pointer;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font-size:13.5px;background:#fff;list-style:none;color:var(--t)}
.sv1-eor-nat summary::-webkit-details-marker{display:none}
.sv1-eor-nat[open] summary{border-color:var(--ac)}
.sv1-eor-nat .box{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px;max-height:220px;overflow:auto;border:1px solid var(--l);border-radius:10px;margin-top:5px;padding:8px;background:#fff}
.sv1-eor-nat .box label{display:flex;align-items:center;gap:7px;margin:0;padding:5px 3px;font-size:12.5px;color:var(--t);cursor:pointer}
.sv1-eor-rm{border:0;background:none;color:#b42318;cursor:pointer;font:inherit;font-size:12px;padding:2px 6px}
.sv1-eor-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:12.5px;color:var(--mut)}
.sv1-eor-bar b{font-family:var(--fm);font-weight:500;color:var(--ink)}
.sv1-eor-msg{font-size:12.5px;line-height:1.8;margin-top:10px;min-height:1em}
.sv1-eor-msg.err{color:#b42318}
.sv1-eor-note{font-size:11.5px;color:var(--faint);line-height:1.85;margin:12px 0 0}
.sv1-eor-done{max-width:560px;margin:0 auto;text-align:center;border:1px solid var(--l);border-radius:15px;background:#fff;padding:34px 26px;box-shadow:var(--sh2)}
.sv1-eor-done .ic{width:52px;height:52px;border-radius:50%;background:var(--okSoft);color:var(--ok);display:grid;place-items:center;font-size:24px;margin:0 auto 14px}
.sv1-eor-done h3{font-size:21px;font-weight:400;margin:0 0 8px}
.sv1-eor-done .ref{font-family:var(--fm);font-size:20px;color:var(--ac);margin:12px 0 8px;direction:ltr;unicode-bidi:isolate}
.sv1-eor-done p{font-size:13px;color:var(--mut);line-height:1.9;margin:0 0 16px}
@media(max-width:860px){.sv1-eor-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.sv1-eor-grid,.sv1-eor-cols,.sv1-eor-igrid{grid-template-columns:1fr}.sv1-eor-form{padding:18px}}
</style>`;

  const card = (a, b) => `<div class="sv1-eor-card"><h3>${esc(t(a))}</h3><p>${esc(t(b))}</p></div>`;
  const li = (k) => `<li>${esc(t(k))}</li>`;
  const radio = (name, val, key, id) => `<label><input type="radio" name="${name}" value="${val}" id="${id}"> ${esc(t(key))}</label>`;
  const faq = [1, 2, 3, 4, 5].map((n) => `<details><summary>${esc(t("q" + n))}</summary><p>${esc(t("a" + n))}</p></details>`).join("");

  const body = `${sv1.header("/eor", { cta: false })}
<main>
  <section class="sv1-eor-hero"><div class="wrap">
    <span class="sv1-tag">${esc(t("tag"))}</span>
    <h1>${esc(t("title"))}</h1>
    <p class="sub">${esc(t("sub"))}</p>
    <p class="lead">${esc(t("lead"))}</p>
    <div class="sv1-eor-acts">
      <a class="sv1-btn primary" href="#eor-form" data-track="EOR: اطلب عرضاً">${esc(t("cta"))}</a>
      <a class="sv1-btn" href="#eor-how">${esc(t("how"))}</a>
    </div>
  </div></section>

  <section class="sv1-sec" style="padding-top:20px"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("offerH"))}</h2><p>${esc(t("offerP"))}</p></div>
    <div class="sv1-eor-grid">${card("o1", "o1p")}${card("o2", "o2p")}${card("o3", "o3p")}${card("o4", "o4p")}${card("o5", "o5p")}${card("o6", "o6p")}</div>
  </div></section>

  <section class="sv1-sec" style="background:var(--soft)"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("whoH"))}</h2></div>
    <ul class="sv1-eor-who">${li("w1")}${li("w2")}${li("w3")}${li("w4")}</ul>
  </div></section>

  <section class="sv1-sec" id="eor-how"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("howH"))}</h2></div>
    <ol class="sv1-eor-steps">${li("s1")}${li("s2")}${li("s3")}${li("s4")}${li("s5")}</ol>
  </div></section>

  <section class="sv1-sec" style="background:var(--soft)"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("faqH"))}</h2></div>
    <div class="sv1-eor-faq">${faq}</div>
  </div></section>

  <section class="sv1-sec" id="eor-form"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("formH"))}</h2><p>${esc(t("formP"))}</p></div>
    <form class="sv1-eor-form" id="eorForm" novalidate autocomplete="off">
      <div class="sv1-eor-hp" aria-hidden="true"><label>Website<input type="text" name="website" id="eorWebsite" tabindex="-1" autocomplete="off"></label></div>
      <fieldset><legend>${esc(t("g1"))}</legend>
        <div class="sv1-eor-cols">
          <div><label for="eorCompany">${esc(t("company"))}</label><input class="sv1-eor-in" id="eorCompany" maxlength="${EOR_LIMITS.company}" autocomplete="organization"></div>
          <div><label for="eorContact">${esc(t("contact"))}</label><input class="sv1-eor-in" id="eorContact" maxlength="${EOR_LIMITS.contact}" autocomplete="name"></div>
          <div><label for="eorEmail">${esc(t("email"))}</label><input class="sv1-eor-in" id="eorEmail" type="email" maxlength="${EOR_LIMITS.email}" autocomplete="email" dir="ltr"></div>
          <div><label for="eorPhone">${esc(t("phone"))}</label><input class="sv1-eor-in" id="eorPhone" inputmode="tel" maxlength="24" autocomplete="tel" dir="ltr"></div>
          <div><label for="eorCity">${esc(t("city"))}</label><input class="sv1-eor-in" id="eorCity" maxlength="${EOR_LIMITS.city}" autocomplete="address-level2"></div>
        </div>
      </fieldset>
      <fieldset><legend>${esc(t("g2"))}</legend>
        <div class="sv1-eor-cols" style="margin-bottom:16px">
          <div role="radiogroup" aria-labelledby="eorWTH"><label id="eorWTH">${esc(t("wtH"))}</label><div class="sv1-eor-radios">${radio("eorWT", "saudi", "wtSaudi", "eorWT1")}${radio("eorWT", "foreign", "wtForeign", "eorWT2")}${radio("eorWT", "both", "wtBoth", "eorWT3")}</div></div>
          <div role="radiogroup" aria-labelledby="eorRCH"><label id="eorRCH">${esc(t("rcH"))}</label><div class="sv1-eor-radios">${radio("eorRC", "yes", "rcYes", "eorRC1")}${radio("eorRC", "no", "rcNo", "eorRC2")}${radio("eorRC", "unsure", "rcUnsure", "eorRC3")}</div></div>
        </div>
        <label>${esc(t("itemsH"))}</label>
        <div id="eorItems"></div>
        <button type="button" class="sv1-btn sm" id="eorAdd">+ ${esc(t("add"))}</button>
        <div class="sv1-eor-bar"><span>${esc(t("total"))}: <b id="eorTotal">0</b> / ${EOR_LIMITS.maxTotalCount}</span><span><b id="eorItemsN">0</b> / ${EOR_LIMITS.maxItems} ${esc(t("itemCount"))}</span></div>
      </fieldset>
      <fieldset><legend>${esc(t("g3"))}</legend>
        <div class="sv1-eor-cols">
          <div><label for="eorStart">${esc(t("start"))}</label><input class="sv1-eor-in" id="eorStart" type="date" dir="ltr"></div>
          <div><label for="eorMonths">${esc(t("months"))}</label><input class="sv1-eor-in" id="eorMonths" type="number" min="${EOR_LIMITS.minMonths}" max="${EOR_LIMITS.maxMonths}" step="1" inputmode="numeric" dir="ltr"></div>
        </div>
        <div style="margin-top:12px"><label for="eorNotes">${esc(t("notes"))}</label><textarea class="sv1-eor-in" id="eorNotes" maxlength="${EOR_LIMITS.notes}"></textarea></div>
      </fieldset>
      <button type="submit" class="sv1-btn primary" id="eorGo" style="width:100%">${esc(t("submit"))}</button>
      <div class="sv1-eor-msg" id="eorMsg" role="status" aria-live="polite"></div>
      <p class="sv1-eor-note">${esc(t("honest"))}</p>
    </form>
    <div class="sv1-eor-done sv1-hide" id="eorDone"></div>
  </div></section>
</main>
${sv1.footer()}`;

  function eorClient(C) {
    var TX = C.tx, OCC = C.occ, NATS = C.nats, LIM = C.lim, LANG = C.lang, AR = LANG === "ar";
    var API = "/api/requests?__route=eor";
    var $ = function (id) { return document.getElementById(id); };
    var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    var occName = function (o) { return AR ? o[1] : o[2]; };
    var natName = function (n) { return AR ? n[1] : n[2]; };
    function norm(s) {
      return String(s || "").toLowerCase().replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
    }
    var OCC_BY = {}, IDX = [];
    OCC.forEach(function (o) { OCC_BY[o[0]] = o; IDX.push({ o: o, k: norm(o[1] + " " + o[2]) }); });
    var NAT_BY = {}; NATS.forEach(function (n) { NAT_BY[n[0]] = n; });

    function localSearch(q) {
      var toks = norm(q).split(" ").filter(Boolean);
      if (!toks.length) return [];
      var out = [];
      IDX.forEach(function (e) {
        for (var i = 0; i < toks.length; i++) if (e.k.indexOf(toks[i]) < 0) return;
        // الأقرب أولاً: الاسم المعروض يطابق البحث تماماً، ثم يبدأ به، ثم تبدأ به إحدى كلماته.
        var nm = norm(occName(e.o)), q1 = toks.join(" ");
        out.push({ o: e.o, s: nm === q1 ? 0 : nm.indexOf(q1) === 0 ? 1 : (" " + nm).indexOf(" " + toks[0]) >= 0 ? 2 : 3 });
      });
      out.sort(function (a, b) { return a.s - b.s || occName(a.o).length - occName(b.o).length; });
      return out.slice(0, 8).map(function (x) { return x.o; });
    }

    var items = [];
    var host = $("eorItems");

    function digits(s) {
      return String(s || "").replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
        .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
    }
    function totalCount() {
      var t = 0;
      items.forEach(function (it) { var n = parseInt(digits(it.countIn.value), 10); if (n > 0) t += n; });
      return t;
    }
    function refresh() {
      $("eorTotal").textContent = String(totalCount());
      $("eorItemsN").textContent = String(items.length);
      $("eorAdd").disabled = items.length >= LIM.maxItems;
      items.forEach(function (it, i) { it.title.textContent = TX.itemN + " " + (i + 1); });
    }

    function addItem() {
      if (items.length >= LIM.maxItems) return;
      var it = { occId: "", nats: [] };
      var card = el("div", "sv1-eor-item");
      var head = el("div", "sv1-eor-ihead");
      it.title = el("span", "", "");
      var rm = el("button", "sv1-eor-rm", TX.remove); rm.type = "button";
      head.appendChild(it.title); head.appendChild(rm);
      var grid = el("div", "sv1-eor-igrid");

      // المهنة: حقل بحث + قائمة اقتراحات
      var occW = el("div", "sv1-eor-cb");
      var occL = el("label", "", TX.occ);
      var occIn = el("input", "sv1-eor-in"); occIn.type = "text"; occIn.setAttribute("role", "combobox");
      occIn.setAttribute("aria-autocomplete", "list"); occIn.setAttribute("aria-expanded", "false"); occIn.autocomplete = "off";
      occIn.placeholder = TX.occPh; occIn.maxLength = 80;
      var list = el("ul", "sv1-eor-list sv1-hide"); list.setAttribute("role", "listbox");
      occW.appendChild(occL); occW.appendChild(occIn); occW.appendChild(list);
      var active = -1, shown = [], timer = null, seq = 0;

      function close() { list.classList.add("sv1-hide"); occIn.setAttribute("aria-expanded", "false"); active = -1; }
      function choose(o) { it.occId = o[0]; occIn.value = occName(o); occIn.removeAttribute("aria-invalid"); close(); }
      function draw(res, q) {
        shown = res; list.textContent = ""; active = -1;
        if (!res.length) {
          if (norm(q).length < 2) { close(); return; }
          var none = el("li", "none", TX.occNone); list.appendChild(none);
        }
        res.forEach(function (o, i) {
          var row = el("li", "", occName(o)); row.setAttribute("role", "option");
          var alt = AR ? o[2] : o[1];
          if (alt && alt !== occName(o)) row.appendChild(el("small", "", alt));
          row.addEventListener("mousedown", function (ev) { ev.preventDefault(); choose(o); });
          list.appendChild(row);
        });
        list.classList.remove("sv1-hide"); occIn.setAttribute("aria-expanded", "true");
      }
      function mark() { Array.prototype.forEach.call(list.children, function (c, i) { c.classList.toggle("on", i === active); }); }
      occIn.addEventListener("input", function () {
        it.occId = "";
        var q = occIn.value, res = localSearch(q);
        draw(res, q);
        // قلّت النتائج المحلية: اسأل الخادم (يعرف المرادفات). فشله صامت.
        if (res.length < 3 && norm(q).length >= 2) {
          clearTimeout(timer);
          var my = ++seq;
          timer = setTimeout(function () {
            fetch(API + "&action=search&q=" + encodeURIComponent(q), { credentials: "same-origin", cache: "no-store" })
              .then(function (r) { return r.json(); }).then(function (o) {
                if (my !== seq || !o || !o.ok || !o.results || occIn.value !== q) return;
                var seen = {}; var merged = res.slice();
                merged.forEach(function (m) { seen[m[0]] = 1; });
                o.results.forEach(function (r) { var m = OCC_BY[r.id]; if (m && !seen[m[0]]) { seen[m[0]] = 1; merged.push(m); } });
                if (merged.length > res.length) draw(merged.slice(0, 8), q);
              }).catch(function () {});
          }, 250);
        }
      });
      occIn.addEventListener("keydown", function (e) {
        if (list.classList.contains("sv1-hide")) return;
        if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); mark(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
        else if (e.key === "Enter") { if (active >= 0 && shown[active]) { e.preventDefault(); choose(shown[active]); } }
        else if (e.key === "Escape") { close(); }
      });
      occIn.addEventListener("blur", function () {
        // نصٌّ يطابق اسماً واحداً تماماً يُعتمد، وإلا يبقى البند بلا مهنة حتى تُختار.
        if (!it.occId) {
          var q = norm(occIn.value), hit = null, n = 0;
          OCC.forEach(function (o) { if (norm(o[1]) === q || norm(o[2]) === q) { hit = o; n++; } });
          if (n === 1) choose(hit);
        }
        setTimeout(close, 120);
      });
      it.occIn = occIn;

      var countW = el("div", ""); countW.appendChild(el("label", "", TX.count));
      var countIn = el("input", "sv1-eor-in"); countIn.type = "number"; countIn.min = "1"; countIn.max = String(LIM.maxItemCount);
      countIn.step = "1"; countIn.inputMode = "numeric"; countIn.dir = "ltr";
      countIn.addEventListener("input", refresh); countW.appendChild(countIn); it.countIn = countIn;

      // الجنسيات: اختيار متعدد
      var natW = el("div", "full"); natW.appendChild(el("label", "", TX.nats));
      var det = el("details", "sv1-eor-nat"); var sum = el("summary", "", TX.natAny);
      var box = el("div", "box");
      NATS.forEach(function (n) {
        var lb = el("label", ""); var cb = el("input", ""); cb.type = "checkbox"; cb.value = n[0];
        cb.addEventListener("change", function () {
          if (cb.checked) {
            if (it.nats.length >= LIM.maxNats) { cb.checked = false; return; }
            it.nats.push(n[0]);
          } else it.nats = it.nats.filter(function (c) { return c !== n[0]; });
          var names = it.nats.map(function (c) { return natName(NAT_BY[c]); });
          sum.textContent = names.length ? names.slice(0, 3).join(AR ? "، " : ", ") + (names.length > 3 ? " +" + (names.length - 3) : "") : TX.natAny;
        });
        lb.appendChild(cb); lb.appendChild(document.createTextNode(natName(n))); box.appendChild(lb);
      });
      det.appendChild(sum); det.appendChild(box); natW.appendChild(det);

      var salW = el("div", "full"); salW.appendChild(el("label", "", TX.salary));
      var salIn = el("input", "sv1-eor-in"); salIn.type = "number"; salIn.min = "0"; salIn.max = String(LIM.maxSalary); salIn.step = "any"; salIn.inputMode = "decimal"; salIn.dir = "ltr";
      salW.appendChild(salIn); it.salIn = salIn;

      grid.appendChild(occW); grid.appendChild(countW); grid.appendChild(natW); grid.appendChild(salW);
      card.appendChild(head); card.appendChild(grid); host.appendChild(card);
      it.card = card;
      rm.addEventListener("click", function () {
        items = items.filter(function (x) { return x !== it; });
        host.removeChild(card); refresh();
      });
      items.push(it); refresh();
      return it;
    }
    $("eorAdd").addEventListener("click", function () { var it = addItem(); if (it) it.occIn.focus(); });
    addItem();

    // التاريخ: لا قبل اليوم
    try {
      var d = new Date(); var p = function (n) { return (n < 10 ? "0" : "") + n; };
      $("eorStart").min = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    } catch (e) {}

    var msg = $("eorMsg");
    function bad(key, node) {
      msg.className = "sv1-eor-msg err"; msg.textContent = TX[key];
      if (node) { node.setAttribute("aria-invalid", "true"); try { node.focus(); } catch (e) {} }
      return null;
    }
    function clearMarks() {
      ["eorCompany", "eorContact", "eorEmail", "eorPhone", "eorCity", "eorStart", "eorMonths"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
      items.forEach(function (it) { it.occIn.removeAttribute("aria-invalid"); it.countIn.removeAttribute("aria-invalid"); it.salIn.removeAttribute("aria-invalid"); });
    }
    function checked(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ""; }
    function collect() {
      clearMarks();
      var v = function (id) { return $(id).value.trim(); };
      if (!v("eorCompany")) return bad("eCompany", $("eorCompany"));
      if (!v("eorContact")) return bad("eContact", $("eorContact"));
      var email = v("eorEmail").toLowerCase();
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return bad("eEmail", $("eorEmail"));
      var phone = digits(v("eorPhone")).replace(/[\s().\-]/g, "");
      if (phone.indexOf("00") === 0) phone = "+" + phone.slice(2);
      if (!/^\+?\d{8,15}$/.test(phone)) return bad("ePhone", $("eorPhone"));
      if (!v("eorCity")) return bad("eCity", $("eorCity"));
      var wt = checked("eorWT"); if (!wt) return bad("eWorker", $("eorWT1"));
      var rc = checked("eorRC"); if (!rc) return bad("eRecruit", $("eorRC1"));
      if (!items.length) return bad("eItems", $("eorAdd"));
      var out = [], total = 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.occId) return bad("eOcc", it.occIn);
        var cs = digits(it.countIn.value).trim();
        var n = /^\d+$/.test(cs) ? parseInt(cs, 10) : 0;
        if (n < 1 || n > LIM.maxItemCount) return bad("eCount", it.countIn);
        total += n;
        if (total > LIM.maxTotal) return bad("eTotal", it.countIn);
        var sal = null, ss = digits(it.salIn.value).trim();
        if (ss !== "") { sal = Number(ss); if (!isFinite(sal) || sal < 0 || sal > LIM.maxSalary) return bad("eSalary", it.salIn); }
        out.push({ occupationId: it.occId, count: n, nationalities: it.nats.slice(), salary: sal });
      }
      var start = $("eorStart").value.trim();
      if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return bad("eStart", $("eorStart"));
      var ms = digits($("eorMonths").value).trim();
      var mo = /^\d+$/.test(ms) ? parseInt(ms, 10) : 0;
      if (mo < 1 || mo > LIM.maxMonths) return bad("eMonths", $("eorMonths"));
      return {
        company: v("eorCompany"), contactName: v("eorContact"), email: email, phone: phone, city: v("eorCity"),
        workerType: wt, recruitment: rc, items: out, startDate: start, durationMonths: mo,
        notes: $("eorNotes").value.trim(), lang: LANG, source: "site:/eor", website: $("eorWebsite").value
      };
    }

    function done(ref) {
      $("eorForm").classList.add("sv1-hide");
      var box = $("eorDone"); box.classList.remove("sv1-hide"); box.textContent = "";
      box.appendChild(el("div", "ic", "✓"));
      box.appendChild(el("h3", "", TX.doneT));
      box.appendChild(el("div", "", TX.doneRef));
      box.appendChild(el("div", "ref", ref));
      box.appendChild(el("p", "", TX.doneP));
      var again = el("button", "sv1-btn", TX.another); again.type = "button";
      again.addEventListener("click", function () { location.reload(); });
      box.appendChild(again);
      try { box.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
    }

    $("eorForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var payload = collect();
      if (!payload) return;
      var btn = $("eorGo"); btn.disabled = true; msg.className = "sv1-eor-msg"; msg.textContent = TX.sending;
      fetch(API, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (o) { return { s: r.status, o: o || {} }; }); })
        .then(function (x) {
          btn.disabled = false;
          if (x.o.ok && x.o.ref) { done(String(x.o.ref)); return; }
          msg.className = "sv1-eor-msg err";
          msg.textContent = x.s === 429 ? TX.eRate : TX.eNet;
        })
        .catch(function () { btn.disabled = false; msg.className = "sv1-eor-msg err"; msg.textContent = TX.eNet; });
    });
  }

  const safe = (s) => s.replace(/</g, "\\u003c");
  const script = `<script>(${eorClient.toString()})(${safe(JSON.stringify(CFG))});</script>`;

  return sv1.shell({ title: `${t("title")} — Business Partner`, desc: t("desc"), path: "/eor", body: CSS + body, script });
}

// عنوان الصفحة ووصفها بالأربع لغات — لبطاقة الرئيسية (public-site) ولكل من يحتاجها.
export const EOR_PAGE_TEXT = {
  ar: { title: D.title[0], desc: D.desc[0], sub: D.sub[0] },
  en: { title: D.title[1], desc: D.desc[1], sub: D.sub[1] },
  fr: { title: D.title[2], desc: D.desc[2], sub: D.sub[2] },
  zh: { title: D.title[3], desc: D.desc[3], sub: D.sub[3] },
};
