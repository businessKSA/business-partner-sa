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
// بلا main.js (قشرة SV1 وحدها) ولا localStorage. الأسعار: لا رقم في الصفحة نفسها ولا في كتلة الإعداد. حين يُدخل العميل راتب
// الموظف يسأل السكربت الخادم (POST ?__route=eor {action:"price"}) فيعود السعر الشهري وساعة الإضافي فقط؛ التكلفة والهامش
// وإعداد التسعير يُحسبون على الخادم وحده ولا يصلون هذه الصفحة بأي شكل. هذا الملف لا يستورد الحاسبة ولا ملف التسعير.
// لا زرّ واتساب داخل المحتوى (الزرّ العائم فقط). الاسم الظاهر «Business Partner».
//
// السكربت العميل دالةٌ عاديّة (eorClient) تُسلسَل بـtoString، فلا يُضاعَف فيها الـbackslash كما في قوالب النصوص.

import { OCCUPATIONS } from "../../api/_occupations.js";
import { NATIONALITIES, EOR_LIMITS, SECTORS, INSURANCE_CLASSES, INSURANCE_AGE_BANDS, INSURANCE_GENDERS, BILLING_UNITS, UNIT_QUANTITY_MAX, CASUAL_HOURS, DURATION_MAX } from "../../api/_eor.js";

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
  a3: ["إن أدخلت الراتب الشهري المتوقع للموظف في النموذج ظهر لك فوراً سعره الشهري وساعة الإضافي كتقدير أولي. السعر النهائي يُحدَّد في عرض السعر بعد مراجعة طلبك بحسب المهن والأعداد. وللعمالة المرنة تختار التسعير بالساعة أو باليوم أو بالشهر وتدخل الكمية لترى الإجمالي.", "If you enter the employee's expected monthly salary in the form, you instantly see their monthly price and overtime hour as a preliminary estimate. The final price is set in the quote after we review your request, depending on occupations and numbers. For flexible staffing you choose hourly, daily or monthly pricing and enter a quantity to see the total.", "Si vous saisissez le salaire mensuel prévu dans le formulaire, vous voyez aussitôt le prix mensuel et l'heure supplémentaire à titre d'estimation. Le prix final est fixé dans l'offre après examen de votre demande, selon métiers et effectifs. Pour le personnel flexible, vous choisissez une tarification à l'heure, à la journée ou au mois et saisissez une quantité pour voir le total.", "如果您在表单中填写员工的预期月薪，会立即看到其月度价格和加班每小时价格作为初步估算。最终价格在审核您的申请后，根据职业和人数在报价中确定。灵活用工可选择按小时、按天或按月计价，并输入数量查看总额。"],
  q4: ["هل تشمل الخدمة الاستقدام؟", "Does the service include recruitment?", "Le service inclut-il le recrutement ?", "服务包含招聘吗？"],
  a4: ["عند الحاجة وبحسب الحالة. تحدّد في النموذج إن كان الاستقدام لازماً، ونناقش التفاصيل معك دون وعدٍ بنتيجة أو بمدة.", "Where needed and case by case. You tell us in the form whether recruitment is needed and we discuss the details with you, with no promise of an outcome or timeline.", "Au besoin et selon le cas. Vous indiquez dans le formulaire si le recrutement est nécessaire ; nous en discutons sans promesse de résultat ni de délai.", "视情况而定。您在表单中说明是否需要招聘，我们与您讨论细节，不承诺结果或时限。"],
  q5: ["ماذا يحدث بعد إرسال الطلب؟", "What happens after I send the request?", "Que se passe-t-il après l'envoi ?", "提交后会怎样？"],
  a5: ["تحصل على رقم مرجعي، ويراجع فريقنا الطلب ويعود إليك. لا يُلزمك الطلب بشيء قبل توقيع الاتفاقية.", "You get a reference number, and our team reviews the request and gets back to you. The request commits you to nothing before an agreement is signed.", "Vous recevez un numéro de référence, notre équipe examine la demande et revient vers vous. La demande ne vous engage à rien avant la signature d'un accord.", "您会收到参考编号，我们的团队审核后与您联系。在签署协议之前，该申请不对您构成任何约束。"],
  formH: ["اطلب عرضاً لموظفيك", "Request a quote for your staff", "Demandez une offre pour votre personnel", "为您的员工申请报价"],
  formP: ["عبّئ الطلب وسنعود إليك. إن عرفت راتب الموظف أدخله ليظهر لك السعر الشهري التقديري فوراً، والسعر النهائي في عرض السعر بعد المراجعة.", "Fill in the request and we will get back to you. If you know the employee's salary, enter it to see the estimated monthly price instantly; the final price is in the quote after review.", "Remplissez la demande et nous reviendrons vers vous. Si vous connaissez le salaire, saisissez-le pour voir aussitôt le prix mensuel estimé ; le prix final figure dans l'offre après examen.", "填写申请，我们会与您联系。如果知道员工薪资，请填写，即可立即看到估算的月度价格；最终价格在审核后的报价中确定。"],
  g1: ["بيانات المنشأة", "Your organization", "Votre organisation", "机构信息"],
  g2: ["العاملون المطلوبون", "Workers needed", "Travailleurs demandés", "所需员工"],
  g3: ["المدة والملاحظات", "Term and notes", "Durée et remarques", "期限与备注"],
  company: ["اسم المنشأة", "Company name", "Nom de l'entreprise", "公司名称"],
  contact: ["جهة التواصل", "Contact person", "Personne de contact", "联系人"],
  email: ["البريد الإلكتروني", "E-mail", "E-mail", "电子邮箱"],
  phone: ["الجوال", "Mobile", "Mobile", "手机号"],
  city: ["المدينة", "City", "Ville", "城市"],
  sectorH: ["مجال نشاط المنشأة (اختياري)", "Your organization's business sector (optional)", "Secteur d'activité de votre organisation (facultatif)", "机构所属行业（可选）"],
  sectorNone: ["غير محدد", "Not specified", "Non précisé", "未指定"],
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
  salary: ["الراتب الشهري المتوقع (اختياري، يظهر لك السعر فوراً)", "Expected monthly salary, SAR (optional; shows your price instantly)", "Salaire mensuel prévu, SAR (facultatif ; affiche le prix aussitôt)", "预期月薪，沙特里亚尔（可选；立即显示价格）"],
  pMonthly: ["السعر الشهري للموظف", "Monthly price per employee", "Prix mensuel par employé", "每位员工月度价格"],
  pOt: ["ساعة الإضافي", "Overtime hour", "Heure supplémentaire", "加班每小时"],
  pTotal: ["إجمالي شهري تقديري", "Estimated monthly total", "Total mensuel estimé", "预计月度总额"],
  pReview: ["السعر يُحدَّد بعد مراجعة طلبك.", "The price is set after we review your request.", "Le prix est fixé après examen de votre demande.", "价格在审核您的申请后确定。"],
  pNote: ["تقدير أولي غير ملزم. السعر النهائي في عرض السعر، ومدة العقد معلومة فقط ولا تدخل الحساب.", "Preliminary, non-binding estimate. The final price is in the quote, and the contract term is informational only and is not part of the calculation.", "Estimation préliminaire non contraignante. Le prix final figure dans l'offre ; la durée du contrat est indicative et n'entre pas dans le calcul.", "初步估算，不具约束力。最终价格以报价为准；合同期限仅供参考，不计入计算。"],
  engH: ["نوع التعاقد", "Engagement type", "Type d'engagement", "用工方式"],
  etContract: ["تعاقد (كفالة، شهري/سنوي)", "Contract (sponsored, monthly/annual)", "Contrat (parrainé, mensuel/annuel)", "合同制（担保，按月/按年）"],
  etCasual: ["عمالة مرنة (بالساعة/اليوم/الشهر)", "Flexible staffing (hourly/daily/monthly)", "Personnel flexible (à l'heure/jour/mois)", "灵活用工（按小时/天/月）"],
  etHint: ["العمالة المرنة: عمل مؤقت بحسب الطلب، يُسعَّر بالساعة أو اليوم أو الشهر بدل العقد السنوي.", "Flexible staffing: temporary on-demand work priced per hour, day or month instead of an annual contract.", "Personnel flexible : travail temporaire à la demande, tarifé à l'heure, à la journée ou au mois au lieu d'un contrat annuel.", "灵活用工：按需临时用工，按小时、天或月计价，而非年度合同。"],
  salaryRef: ["الراتب المرجعي الشهري، ريال (اختياري، يظهر لك السعر فوراً)", "Reference monthly salary, SAR (optional; shows your price instantly)", "Salaire mensuel de référence, SAR (facultatif ; affiche le prix aussitôt)", "参考月薪，沙特里亚尔（可选；立即显示价格）"],
  hpdH: ["ساعات اليوم", "Hours per day", "Heures par jour", "每天小时数"],
  hrs: ["ساعات", "hours", "heures", "小时"],
  unitH: ["وحدة التسعير", "Pricing unit", "Unité de tarification", "计价单位"],
  uMonthly: ["بالشهر", "Monthly", "Au mois", "按月"],
  uDaily: ["باليوم", "Daily", "À la journée", "按天"],
  uHourly: ["بالساعة", "Hourly", "À l'heure", "按小时"],
  qtyMonthly: ["عدد الأشهر لكل موظف (اختياري)", "Months per employee (optional)", "Mois par employé (facultatif)", "每位员工月数（可选）"],
  qtyDaily: ["عدد الأيام لكل موظف (اختياري)", "Days per employee (optional)", "Jours par employé (facultatif)", "每位员工天数（可选）"],
  qtyHourly: ["عدد الساعات لكل موظف (اختياري)", "Hours per employee (optional)", "Heures par employé (facultatif)", "每位员工小时数（可选）"],
  pUMonthly: ["سعر الشهر", "Price per month", "Prix au mois", "每月价格"],
  pUDaily: ["سعر اليوم", "Price per day", "Prix à la journée", "每天价格"],
  pUHourly: ["سعر الساعة", "Price per hour", "Prix à l'heure", "每小时价格"],
  pUTotal: ["إجمالي الكمية", "Quantity total", "Total pour la quantité", "数量总额"],
  pUSum: ["إجمالي الكميات المختارة", "Total of the chosen quantities", "Total des quantités choisies", "所选数量总额"],
  eQty: ["الكمية عدد صحيح موجب ضمن الحد المسموح للوحدة المختارة.", "The quantity must be a positive whole number within the limit for the chosen unit.", "La quantité doit être un entier positif dans la limite de l'unité choisie.", "数量须为所选单位限额内的正整数。"],
  cur: ["ريال", "SAR", "SAR", "SAR"],
  insH: ["التأمين الطبي (اختياري، يظهر أثره على السعر عند إدخال الراتب)", "Medical insurance (optional; its effect on the price shows once you enter the salary)", "Assurance médicale (facultatif ; son effet sur le prix apparaît une fois le salaire saisi)", "医疗保险（可选；填写薪资后会体现在价格中）"],
  gender: ["الجنس", "Gender", "Genre", "性别"],
  gU: ["غير محدد", "Not specified", "Non précisé", "未指定"],
  gM: ["ذكر", "Male", "Homme", "男"],
  gF: ["أنثى", "Female", "Femme", "女"],
  age: ["الفئة العمرية", "Age band", "Tranche d'âge", "年龄段"],
  ageNone: ["غير محددة", "Not specified", "Non précisée", "未指定"],
  yrs: ["سنة", "yrs", "ans", "岁"],
  insClass: ["فئة التأمين", "Insurance class", "Classe d'assurance", "保险等级"],
  icBasic: ["الأساسي (الافتراضي)", "Basic (default)", "De base (par défaut)", "基础（默认）"],
  icC: ["الفئة C", "Class C", "Classe C", "C 级"],
  icB: ["الفئة B", "Class B", "Classe B", "B 级"],
  icA: ["الفئة A", "Class A", "Classe A", "A 级"],
  icQ: ["فئة أعلى (VIP) — بعرض سعر الشركة", "Higher tier (VIP) — by insurer quote", "Niveau supérieur (VIP) — sur devis de l'assureur", "更高等级（VIP）— 以保险公司报价为准"],
  mat: ["إضافة الأمومة (للمتزوجات)", "Maternity add-on (married women)", "Option maternité (femmes mariées)", "生育附加险（已婚女性）"],
  chr: ["تغطية الأمراض المزمنة", "Chronic conditions cover", "Couverture des maladies chroniques", "慢性病保障"],
  pDelta: ["الفرق عن الأساسي", "Difference from Basic", "Écart avec le niveau de base", "与基础等级的差额"],
  perMonth: ["ريال/شهر", "SAR/month", "SAR/mois", "SAR/月"],
  pQuoteOnly: ["الفئة العليا تُسعَّر بعرض من شركة التأمين؛ السعر أعلاه يشمل التأمين الأساسي.", "The higher tier is priced by an insurer quote; the price above includes Basic insurance.", "Le niveau supérieur est chiffré sur devis de l'assureur ; le prix ci-dessus inclut l'assurance de base.", "更高等级以保险公司报价定价；上方价格包含基础保险。"],
  pNeedAge: ["اختر الفئة العمرية ليُحسب سعر الفئة المختارة؛ السعر أعلاه يشمل التأمين الأساسي.", "Pick the age band to price the selected class; the price above includes Basic insurance.", "Choisissez la tranche d'âge pour chiffrer la classe choisie ; le prix ci-dessus inclut l'assurance de base.", "请选择年龄段以计算所选等级；上方价格包含基础保险。"],
  pNoMat: ["لم تُطبَّق إضافة الأمومة لهذه الفئة العمرية.", "The maternity add-on was not applied for this age band.", "L'option maternité n'a pas été appliquée pour cette tranche d'âge.", "该年龄段未适用生育附加险。"],
  insEst: ["السعر تقديري ويُثبَّت بعرض الشركة.", "The price is an estimate and is confirmed by the insurer's quote.", "Le prix est une estimation, confirmée par le devis de l'assureur.", "价格为估算，以保险公司报价确认为准。"],
  infoH: ["ما فئات التأمين الطبي؟", "What are the medical insurance classes?", "Quelles sont les classes d'assurance médicale ?", "医疗保险有哪些等级？"],
  infoBasic: ["الأساسي: التغطية الأساسية المعتمدة في تسعيرنا للعمالة، وهي الخيار الافتراضي.", "Basic: the basic cover used in our worker pricing; it is the default choice.", "De base : la couverture de base retenue dans notre tarification, choix par défaut.", "基础：我们用工定价中采用的基础保障，为默认选项。"],
  infoC: ["الفئة C: الأدنى بين الفئات الثلاث تغطيةً وسعراً.", "Class C: the lowest of the three classes in cover and price.", "Classe C : la plus basse des trois classes en couverture et en prix.", "C 级：三个等级中保障和价格最低。"],
  infoB: ["الفئة B: وسط بين C وA في التغطية والسعر.", "Class B: between C and A in cover and price.", "Classe B : entre C et A en couverture et en prix.", "B 级：保障和价格介于 C 与 A 之间。"],
  infoA: ["الفئة A: الأوسع تغطيةً والأعلى سعراً بين الثلاث.", "Class A: the widest cover and highest price of the three.", "Classe A : la couverture la plus large et le prix le plus élevé des trois.", "A 级：三个等级中保障最广、价格最高。"],
  infoQ: ["الفئة العليا (VIP): حدودها وشبكتها بعرض شركة التأمين، ولا سعر لها هنا.", "Higher tier (VIP): its limits and network come with the insurer's quote; no price is shown here.", "Niveau supérieur (VIP) : limites et réseau selon le devis de l'assureur ; aucun prix affiché ici.", "更高等级（VIP）：限额与网络以保险公司报价为准，此处不显示价格。"],
  infoNote: ["يتغيّر السعر بالعمر والجنس. تفاصيل التغطية وحدودها وشبكة المستشفيات تثبَّت في وثيقة شركة التأمين. السعر تقديري ويُثبَّت بعرض الشركة.", "The price varies with age and gender. Coverage details, limits and the hospital network are fixed in the insurer's policy. The price is an estimate and is confirmed by the insurer's quote.", "Le prix varie selon l'âge et le genre. Le détail des garanties, les plafonds et le réseau hospitalier sont fixés dans la police de l'assureur. Le prix est une estimation, confirmée par le devis de l'assureur.", "价格随年龄和性别而变化。保障细节、限额和医院网络以保险公司保单为准。价格为估算，以保险公司报价确认为准。"],
  hrH: ["بعد أن عرفت الخدمة", "Once you know the service", "Une fois le service compris", "了解服务之后"],
  hrP: ["ادخل بوابة Business Partner HR: أصحاب العمل والمرشحون والمكاتب والموظفون كلٌّ يدخل من بابه.", "Enter the Business Partner HR portal: employers, candidates, offices and employees each enter through their own door.", "Accédez au portail Business Partner HR : employeurs, candidats, bureaux et employés entrent chacun par leur porte.", "进入 Business Partner HR 门户：雇主、候选人、机构和员工各走各的入口。"],
  hrBtn: ["ادخل بوابة Business Partner HR", "Enter the Business Partner HR portal", "Accéder au portail Business Partner HR", "进入 Business Partner HR 门户"],
  remove: ["حذف", "Remove", "Supprimer", "删除"],
  add: ["أضف مهنة", "Add an occupation", "Ajouter un métier", "添加职业"],
  total: ["إجمالي الموظفين", "Total employees", "Total des employés", "员工总数"],
  start: ["تاريخ البدء المتوقع (اختياري)", "Expected start date (optional)", "Date de début prévue (facultatif)", "预计开始日期（可选）"],
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
  eNet: ["تعذّر إرسال الطلب. حاول مرة أخرى بعد قليل أو تواصل معنا.", "We could not send the request. Try again shortly or contact us.", "Envoi impossible. Réessayez bientôt ou contactez-nous.", "无法提交申请。请稍后重试或联系我们。"],
  eRate: ["محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", "Too many attempts. Wait a little and try again.", "Trop de tentatives. Patientez puis réessayez.", "尝试次数过多，请稍后再试。"],
  doneT: ["استلمنا طلبك", "We received your request", "Nous avons reçu votre demande", "我们已收到您的申请"],
  doneRef: ["رقمك المرجعي", "Your reference number", "Votre numéro de référence", "您的参考编号"],
  doneP: ["سيراجع فريقنا الطلب ونعود إليك. لم يُحدَّد سعر بعد؛ يصلك عرض السعر بعد المراجعة.", "Our team will review the request and get back to you. No price has been set yet; you will receive a quote after the review.", "Notre équipe examinera la demande et reviendra vers vous. Aucun prix n'est encore fixé ; vous recevrez une offre après l'examen.", "我们的团队会审核申请并与您联系。目前尚未确定价格；审核后您将收到报价。"],
  another: ["طلب جديد", "New request", "Nouvelle demande", "新申请"],
  itemCount: ["بنود", "rows", "lignes", "项"],

  // ───── مدة التعاقد: وحدة + قيمة (الحساب كله على الخادم) ─────
  durUnitL: ["وحدة المدة", "Term unit", "Unité de durée", "期限单位"],
  durValL: ["قيمة المدة", "Term value", "Valeur de la durée", "期限数值"],
  dHour: ["ساعة", "Hour", "Heure", "小时"],
  dDay: ["يوم", "Day", "Jour", "天"],
  dMonth: ["شهر", "Month", "Mois", "月"],
  dYear: ["سنة", "Year", "An", "年"],
  eDur: ["قيمة المدة عدد صحيح موجب ضمن الحد المسموح للوحدة المختارة.", "The term value must be a positive whole number within the limit for the chosen unit.", "La valeur de la durée doit être un entier positif dans la limite de l'unité choisie.", "期限数值须为所选单位限额内的正整数。"],
  pDurTotal: ["الإجمالي التقديري للمدة", "Estimated total for the term", "Total estimé pour la durée", "期限内预计总额"],
  pDurNote: ["تقدير أولي غير ملزم يعتمد على المدة التي اخترتها. السعر النهائي في عرض السعر.", "Preliminary, non-binding estimate based on the term you chose. The final price is in the quote.", "Estimation préliminaire non contraignante, fondée sur la durée choisie. Le prix final figure dans l'offre.", "初步估算，不具约束力，依据您选择的期限。最终价格以报价为准。"],

  // ───── شركة التأمين (تفضيل يُرسَل مع الطلب، بلا أسعار ولا فروق بين الشركات) ─────
  insurerL: ["شركة التأمين", "Insurance company", "Compagnie d'assurance", "保险公司"],
  insAny: ["أي شركة معتمدة، نختار لك الأنسب", "Any approved company; we choose the best fit for you", "Toute compagnie agréée ; nous choisissons la plus adaptée", "任一认可公司，由我们为您选择最合适的"],
  insurerNote: ["الشركة المختارة تفضيلٌ يُؤكَّد في عرض السعر ولا يُعدّ التزاماً قبل توقيع الاتفاقية.", "The company you pick is a preference, confirmed in the quote; it is not a commitment before an agreement is signed.", "La compagnie choisie est une préférence, confirmée dans l'offre ; ce n'est pas un engagement avant la signature d'un accord.", "所选公司仅为偏好，以报价确认为准；在签署协议前不构成承诺。"],
  insClassesH: ["فئات التأمين الطبي", "Medical insurance classes", "Classes d'assurance médicale", "医疗保险等级"],

  // ───── دورة حياة الموظف معنا ─────
  lifeH: ["دورة حياة الموظف معنا", "The employee lifecycle with us", "Le cycle de vie de l'employé avec nous", "员工在我们这里的全周期"],
  lifeP: ["من الطلب إلى التسوية النهائية في ثماني خطوات. تفاصيل كل خطوة تختلف بحسب نوع الحالة.", "From request to final settlement in eight steps. The details of each step depend on the type of case.", "De la demande au solde de tout compte en huit étapes. Le détail de chaque étape dépend du type de cas.", "从申请到最终结算共八步。每一步的细节视具体情况而定。"],
  l1: ["الطلب والسعر الفوري", "Request and instant price", "Demande et prix immédiat", "申请与即时报价"],
  l1p: ["تحدّد المهن والأعداد والجنسيات، وإن أدخلت الراتب ظهر لك السعر الشهري التقديري في الحال.", "You set the occupations, numbers and nationalities, and if you enter the salary you see the estimated monthly price right away.", "Vous indiquez métiers, effectifs et nationalités ; si vous saisissez le salaire, le prix mensuel estimé s'affiche aussitôt.", "您填写职业、人数和国籍；如填写薪资，即可立即看到估算的月度价格。"],
  l2: ["عرض مرشحين مطابقين", "Matching candidates presented", "Présentation de candidats correspondants", "展示匹配的候选人"],
  l2p: ["نعرض عليك مرشحين مطابقين لما طلبت بحسب ما يتوافر، دون وعدٍ بعدد أو بمدة.", "We present candidates matching your request as available, with no promise of a number or a timeline.", "Nous vous présentons des candidats correspondant à votre demande selon les disponibilités, sans promesse de nombre ni de délai.", "我们按实际可得情况向您展示符合要求的候选人，不承诺数量或时限。"],
  l3: ["اختيار وتأكيد", "Selection and confirmation", "Choix et confirmation", "选择与确认"],
  l3p: ["تختار من تراه مناسباً وتؤكد، ثم نُعدّ عرض السعر ونطاق العمل لتوافق عليهما.", "You choose who fits and confirm, then we prepare the quote and scope of work for your approval.", "Vous choisissez et confirmez, puis nous préparons l'offre et le périmètre pour votre accord.", "您选择合适人选并确认，随后我们准备报价和工作范围供您确认。"],
  l4: ["التعاقد والتأشيرة", "Contracting and visa", "Contrat et visa", "签约与签证"],
  l4p: ["نتعاقد مع العامل، ونتابع إجراءات القدوم من الخارج أو نقل الخدمات، حسب نوع الحالة.", "We contract the worker and follow the procedures for arrival from abroad or transfer of services, depending on the type of case.", "Nous engageons le travailleur et suivons les démarches d'arrivée de l'étranger ou de transfert de services, selon le type de cas.", "我们与员工签约，并视具体情况跟进境外入境或转移服务的相关流程。"],
  l5: ["الوصول والتسكين والمباشرة", "Arrival, housing and start", "Arrivée, logement et prise de poste", "抵达、住宿与上岗"],
  l5p: ["نرتّب وصول العامل وتسكينه ومباشرته العمل لديك، حسب نوع الحالة وما يُتفق عليه.", "We arrange the worker's arrival, housing and start at your site, depending on the type of case and what is agreed.", "Nous organisons l'arrivée, le logement et la prise de poste chez vous, selon le type de cas et ce qui est convenu.", "我们安排员工抵达、住宿并到您处上岗，视具体情况及双方约定而定。"],
  l6: ["الدوام", "Day-to-day work", "Travail au quotidien", "日常工作"],
  l6p: ["يعمل لديك بتوجيهك اليومي، وتعتمد أنت الحضور الذي تُبنى عليه الرواتب.", "The worker works for you under your day-to-day direction, and you approve the attendance on which payroll is based.", "Le travailleur travaille chez vous sous votre direction quotidienne, et vous validez les présences sur lesquelles la paie est fondée.", "员工在您处工作并接受您的日常安排，您确认作为薪资依据的考勤。"],
  l7: ["فاتورة شهرية واحدة", "One monthly invoice", "Une facture mensuelle unique", "每月一张发票"],
  l7p: ["تصلك فاتورة شهرية واحدة بدل متابعة الرواتب والتأمين والمستحقات كلٍّ على حدة.", "You receive one monthly invoice instead of following payroll, insurance and entitlements separately.", "Vous recevez une seule facture mensuelle au lieu de suivre séparément paie, assurance et indemnités.", "您每月收到一张发票，无需分别跟进薪资、保险和应付款项。"],
  l8: ["الإنهاء والتسوية", "Termination and settlement", "Fin de contrat et solde de tout compte", "终止与结算"],
  l8p: ["عند انتهاء التعاقد ننظّم الإنهاء والتسوية النهائية للمستحقات وفق الاتفاقية والأنظمة.", "When the engagement ends we manage termination and the final settlement of entitlements under the agreement and regulations.", "À la fin de l'engagement, nous gérons la fin de contrat et le solde de tout compte selon l'accord et la réglementation.", "合同结束时，我们依据协议与法规办理终止及最终结算。"],

  // ───── لماذا Business Partner (حقائق موجودة في الخدمة فقط) ─────
  whyH: ["لماذا Business Partner", "Why Business Partner", "Pourquoi Business Partner", "为什么选择 Business Partner"],
  y1: ["حاسبة سعر فورية", "Instant price calculator", "Calculateur de prix immédiat", "即时价格计算器"],
  y1p: ["أدخل راتب الموظف فيظهر لك السعر الشهري التقديري في الحال، قبل أن تتواصل معنا.", "Enter the employee's salary and see the estimated monthly price right away, before you contact us.", "Saisissez le salaire et voyez aussitôt le prix mensuel estimé, avant de nous contacter.", "填写员工薪资，即可在联系我们之前立即看到估算的月度价格。"],
  y2: ["فاتورة شهرية واحدة", "One monthly invoice", "Une facture mensuelle unique", "每月一张发票"],
  y2p: ["بدل متابعة الرواتب والتأمين والمستحقات كلٍّ على حدة، تصلك فاتورة واحدة كل شهر.", "Instead of following payroll, insurance and entitlements separately, you get one invoice each month.", "Au lieu de suivre séparément paie, assurance et indemnités, vous recevez une facture par mois.", "无需分别跟进薪资、保险和应付款项，每月只收到一张发票。"],
  y3: ["عمالة مرنة بالساعة", "Flexible staffing by the hour", "Personnel flexible à l'heure", "按小时的灵活用工"],
  y3p: ["للعمل المؤقت بحسب الطلب، تختار التسعير بالساعة أو اليوم أو الشهر وتدخل الكمية لترى الإجمالي.", "For temporary on-demand work, choose hourly, daily or monthly pricing and enter a quantity to see the total.", "Pour le travail temporaire à la demande, choisissez une tarification à l'heure, à la journée ou au mois et saisissez une quantité pour voir le total.", "对于按需临时用工，可选择按小时、天或月计价，并输入数量查看总额。"],
  y4: ["تأمين طبي بفئات", "Medical insurance in classes", "Assurance médicale par classes", "分等级的医疗保险"],
  y4p: ["تختار فئة التأمين وشركته في الحاسبة، وتُثبَّت التفاصيل في وثيقة شركة التأمين.", "You choose the insurance class and company in the calculator, and the details are fixed in the insurer's policy.", "Vous choisissez classe et compagnie dans le calculateur ; le détail est fixé dans la police de l'assureur.", "您在计算器中选择保险等级和公司，细节以保险公司保单为准。"],

  // ───── أسئلة شائعة إضافية ─────
  // (صياغات قانونية حذرة — يراجَع قانونياً قبل أي توسّع؛ لا ادعاء ترخيص ولا وعد بنتيجة)
  q6: ["ما هو EOR؟", "What is EOR?", "Qu'est-ce que l'EOR ?", "什么是 EOR？"],
  a6: ["EOR اختصار «صاحب العمل الرسمي»: نتعاقد نحن رسمياً مع العامل ونتولى إدارته الوظيفية، بينما يعمل لديك ويتبع توجيهك اليومي.", "EOR stands for «employer of record»: we contract the worker officially and handle their employment administration, while the worker works for you under your day-to-day direction.", "EOR signifie « employeur officiel » : nous engageons officiellement le travailleur et gérons son administration, tandis qu'il travaille chez vous sous votre direction quotidienne.", "EOR 即「名义雇主」：由我们正式与员工签约并负责其用工管理，员工则在您处工作并接受您的日常安排。"],
  q7: ["من صاحب العمل نظاماً؟", "Who is the employer in law?", "Qui est l'employeur au sens juridique ?", "法律上谁是雇主？"],
  a7: ["نحن الجهة المتعاقدة مع العامل بموجب اتفاقية بيننا وبينك، وأنت توجّه عمله اليومي. توزيع المسؤوليات بين الطرفين يُحدَّد صراحةً في الاتفاقية قبل التوقيع.", "We are the contracting party with the worker under an agreement between us and you, and you direct the day-to-day work. How responsibilities are split between the parties is set out expressly in the agreement before signing.", "Nous sommes la partie contractante avec le travailleur dans le cadre d'un accord entre vous et nous, et vous dirigez son travail quotidien. La répartition des responsabilités entre les parties est précisée dans l'accord avant la signature.", "我们依据与您之间的协议作为员工的合同主体，您负责安排其日常工作。双方责任如何划分，将在签约前于协议中明确列出。"],
  q8: ["ماذا يشمل السعر؟", "What does the price include?", "Que comprend le prix ?", "价格包含什么？"],
  a8: ["السعر تقدير أولي لما نتولاه بصفتنا صاحب العمل. البنود المشمولة وغير المشمولة تُفصَّل في عرض السعر ونطاق العمل، ولا يُعتمد إلا ما تتفق عليه معنا.", "The price is a preliminary estimate of what we handle as the employer. The items included and not included are detailed in the quote and scope of work, and only what you agree with us applies.", "Le prix est une estimation préliminaire de ce que nous prenons en charge en tant qu'employeur. Les éléments inclus et exclus sont détaillés dans l'offre et le périmètre ; seul ce dont vous convenez avec nous s'applique.", "价格是对我们作为雇主所承担事项的初步估算。包含与不包含的项目会在报价和工作范围中详列，只有经您与我们确认的内容才有效。"],
  q9: ["ماذا عن نهاية الخدمة والإنهاء؟", "What about end of service and termination?", "Qu'en est-il de l'indemnité de fin de service et de la fin de contrat ?", "服务终止与解除如何处理？"],
  a9: ["ننظّم الإنهاء والتسوية النهائية للمستحقات وفق الاتفاقية والأنظمة المعمول بها. تفاصيل الإشعار والمستحقات تُحدَّد في الاتفاقية وعقد العامل.", "We manage termination and the final settlement of entitlements under the agreement and the regulations in force. Notice and entitlement details are set in the agreement and the worker's contract.", "Nous gérons la fin de contrat et le solde de tout compte selon l'accord et la réglementation en vigueur. Les détails du préavis et des indemnités figurent dans l'accord et le contrat du travailleur.", "我们依据协议及现行法规办理终止和最终结算。通知期与应付款项的细节在协议及员工合同中确定。"],
  q10: ["ماذا عن الملكية الفكرية وسرية العمل؟", "What about intellectual property and confidentiality?", "Qu'en est-il de la propriété intellectuelle et de la confidentialité ?", "知识产权与工作保密如何处理？"],
  a10: ["تُنظَّم الملكية الفكرية وسرية المعلومات بنصوص صريحة في الاتفاقية بيننا وبينك وفي عقد العامل، وتراجعها قبل التوقيع.", "Intellectual property and confidentiality are covered by express terms in the agreement between us and you and in the worker's contract, which you review before signing.", "La propriété intellectuelle et la confidentialité sont régies par des clauses expresses de l'accord entre vous et nous et du contrat du travailleur, que vous examinez avant la signature.", "知识产权和信息保密由我们与您之间的协议及员工合同中的明确条款规范，您可在签署前审阅。"],
  q11: ["ماذا عن المزايا والتأمين؟", "What about benefits and insurance?", "Qu'en est-il des avantages et de l'assurance ?", "福利与保险如何安排？"],
  a11: ["التأمين الطبي بفئات تختارها في الحاسبة، ويظهر أثرها على السعر عند إدخال الراتب. تفاصيل التغطية تثبَّت في وثيقة شركة التأمين، وبقية المزايا والإجازات كما تنص عليه الاتفاقية والأنظمة.", "Medical insurance comes in classes you choose in the calculator, and their effect on the price shows once you enter the salary. Coverage details are fixed in the insurer's policy, and other benefits and leave follow the agreement and regulations.", "L'assurance médicale se décline en classes que vous choisissez dans le calculateur ; leur effet sur le prix apparaît une fois le salaire saisi. Le détail des garanties est fixé dans la police de l'assureur, et les autres avantages et congés suivent l'accord et la réglementation.", "医疗保险分等级，您在计算器中选择，填写薪资后会体现在价格中。保障细节以保险公司保单为准，其他福利和休假依据协议及法规。"],
  q12: ["هل يمكن استبدال الموظف؟", "Can the employee be replaced?", "Le salarié peut-il être remplacé ?", "员工可以更换吗？"],
  a12: ["يُحدَّد في العقد.", "This is set in the contract.", "Cela est précisé dans le contrat.", "以合同约定为准。"],
  q13: ["ما الفرق بين التعاقد والعمالة المرنة؟", "What is the difference between contract and flexible staffing?", "Quelle différence entre contrat et personnel flexible ?", "合同制与灵活用工有何区别？"],
  a13: ["التعاقد هو عقد بكفالة شهري أو سنوي للعاملين على المدى الأطول. العمالة المرنة عمل مؤقت بحسب الطلب، يُسعَّر بالساعة أو اليوم أو الشهر بدل العقد السنوي.", "Contract is a sponsored monthly or annual engagement for longer-term workers. Flexible staffing is temporary on-demand work priced per hour, day or month instead of an annual contract.", "Le contrat est un engagement parrainé, mensuel ou annuel, pour les travailleurs à plus long terme. Le personnel flexible est un travail temporaire à la demande, tarifé à l'heure, à la journée ou au mois au lieu d'un contrat annuel.", "合同制是按月或按年、带担保的用工，适合较长期员工；灵活用工是按需临时用工，按小时、天或月计价，而非年度合同。"],
  q14: ["كيف تُحسب الفاتورة؟", "How is the invoice calculated?", "Comment la facture est-elle calculée ?", "发票如何计算？"],
  a14: ["تصلك فاتورة شهرية واحدة مبنية على ما اتُّفق عليه في عرض السعر المقبول وعلى الحضور الذي تعتمده.", "You receive one monthly invoice based on what was agreed in the accepted quote and the attendance you approve.", "Vous recevez une facture mensuelle unique, fondée sur ce qui a été convenu dans l'offre acceptée et sur les présences que vous validez.", "您每月收到一张发票，依据已接受的报价中的约定以及您确认的考勤。"],
};

// شركات التأمين: معرّفات تطابق ما يقبله الخادم (`insurer`) وأسماء معتمدة بالأربع لغات — لا أسعار ولا فروق بين الشركات.
// ar, en, fr, zh
const INSURERS = [
  ["bupa", ["بوبا العربية", "Bupa Arabia", "Bupa Arabia", "Bupa Arabia"]],
  ["tawuniya", ["التعاونية", "Tawuniya", "Tawuniya", "Tawuniya"]],
  ["medgulf", ["ميدغلف", "MedGulf", "MedGulf", "MedGulf"]],
  ["malath", ["ملاذ للتأمين", "Malath", "Malath", "Malath"]],
  ["walaa", ["ولاء للتأمين", "Walaa", "Walaa", "Walaa"]],
  ["rajhi_takaful", ["الراجحي تكافل", "Al Rajhi Takaful", "Al Rajhi Takaful", "Al Rajhi Takaful"]],
  ["arabian_shield", ["الدرع العربي", "Arabian Shield", "Arabian Shield", "Arabian Shield"]],
  ["allianz_sf", ["أليانز السعودي الفرنسي", "Allianz Saudi Fransi", "Allianz Saudi Fransi", "Allianz Saudi Fransi"]],
];

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
    "eCompany", "eContact", "eEmail", "ePhone", "eCity", "eWorker", "eRecruit", "eItems", "eOcc", "eCount", "eTotal", "eSalary", "eStart", "eDur", "eNet", "eRate",
    "doneT", "doneRef", "doneP", "another", "nats", "occ", "count", "salary",
    "pMonthly", "pOt", "pTotal", "pReview", "pNote", "cur",
    "engH", "etContract", "etCasual", "etHint", "salaryRef", "hpdH", "hrs", "unitH", "uMonthly", "uDaily", "uHourly", "qtyMonthly", "qtyDaily", "qtyHourly", "pUMonthly", "pUDaily", "pUHourly", "pUTotal", "pUSum", "eQty",
    "insH", "gender", "age", "insClass", "mat", "chr", "pDelta", "perMonth", "pQuoteOnly", "pNeedAge", "pNoMat", "insEst",
    "durUnitL", "durValL", "dHour", "dDay", "dMonth", "dYear", "pDurTotal", "pDurNote", "insurerL", "insAny"];
  const TX = {};
  for (const k of TXKEYS) TX[k] = t(k);
  // اختيار التأمين: معرّفات وعناوين فقط (لا رقم ولا سعر) — الحساب كله على الخادم.
  const CLASS_KEY = { basic: "icBasic", C: "icC", B: "icB", A: "icA", quote: "icQ" };
  const GENDER_KEY = { unspecified: "gU", male: "gM", female: "gF" };
  const INS = {
    classes: INSURANCE_CLASSES.map((k) => [k, t(CLASS_KEY[k])]),
    ages: INSURANCE_AGE_BANDS.map((k) => [k, k.replace("-", "–") + " " + t("yrs")]),
    genders: INSURANCE_GENDERS.map((k) => [k, t(GENDER_KEY[k])]),
    ageNone: t("ageNone"),
    insurers: [["any", t("insAny")]].concat(INSURERS.map(([id, nm]) => [id, nm[idx]])),
  };
  // وحدات التسعير: معرّفات وعناوين وسقوف الكمية فقط (لا أرقام أسعار) — الحساب كله على الخادم.
  const UNIT_KEY = { monthly: ["uMonthly", "qtyMonthly", "pUMonthly"], daily: ["uDaily", "qtyDaily", "pUDaily"], hourly: ["uHourly", "qtyHourly", "pUHourly"] };
  const UNITS = BILLING_UNITS.map((k) => ({ id: k, name: t(UNIT_KEY[k][0]), qty: t(UNIT_KEY[k][1]), price: t(UNIT_KEY[k][2]), max: UNIT_QUANTITY_MAX[k] }));
  const CFG = {
    lang: l, tx: TX, occ: OCC, nats: NATS, ins: INS, units: UNITS,
    lim: { maxItems: EOR_LIMITS.maxItems, maxTotal: EOR_LIMITS.maxTotalCount, maxItemCount: EOR_LIMITS.maxItemCount, maxMonths: EOR_LIMITS.maxMonths, maxSalary: EOR_LIMITS.maxSalary, maxNats: EOR_LIMITS.maxNationalities, hMin: CASUAL_HOURS.min, hMax: CASUAL_HOURS.max, hDef: CASUAL_HOURS.default },
  };

  // وحدات مدة التعاقد وسقوفها من DURATION_MAX في الخادم (فحص مدخلات فقط؛ الخادم يعيد التحقق ويحسب). التعاقد: شهر/سنة. العمالة المرنة: ساعة/يوم/شهر.
  // تُحمَل في سمة data-dur على قائمة الوحدة لا في كتلة CFG: مفاتيح الكتلة مثبّتة في اختبار canaries (tests/eor-package-rate.test.mjs).
  const DUR = {
    contract: [["month", t("dMonth"), DURATION_MAX.month], ["year", t("dYear"), DURATION_MAX.year]],
    casual: [["hour", t("dHour"), DURATION_MAX.hour], ["day", t("dDay"), DURATION_MAX.day], ["month", t("dMonth"), DURATION_MAX.month]],
  };

  const CSS = `<style id="sv1-eor-css">
.sv1-eor-hero{padding:56px 0 40px;text-align:center}
.sv1-eor-hero h1{font-size:clamp(28px,4.4vw,46px);margin:14px 0 10px}
.sv1-eor-hero .sub{font-size:clamp(17px,2.2vw,22px);color:var(--ac);font-weight:400;margin:0 0 14px}
.sv1-eor-hero .lead{max-width:720px;margin:0 auto 22px;color:var(--mut);line-height:1.95}
.sv1-eor-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.sv1-eor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:1000px;margin:0 auto}
.sv1-eor-grid>*{min-width:0}
.sv1-eor-card{background:Canvas;border:1px solid var(--l);border-radius:13px;padding:20px;box-shadow:var(--sh)}
.sv1-eor-card h3{font-size:15px;font-weight:500;margin:0 0 8px}
.sv1-eor-card p{margin:0;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-eor-who{max-width:760px;margin:0 auto;display:grid;gap:10px;padding:0;list-style:none}
.sv1-eor-who li{background:var(--soft);border:1px solid var(--line2);border-radius:11px;padding:13px 16px;font-size:13.5px}
.sv1-eor-steps{max-width:760px;margin:0 auto;display:grid;gap:10px;padding:0;list-style:none;counter-reset:s}
.sv1-eor-steps li{display:flex;gap:14px;align-items:flex-start;background:Canvas;border:1px solid var(--l);border-radius:11px;padding:13px 16px;font-size:13.5px}
.sv1-eor-steps li::before{counter-increment:s;content:counter(s);flex:none;width:28px;height:28px;border-radius:50%;background:var(--ac);color:Canvas;display:grid;place-items:center;font-family:var(--fm);font-size:13px}
.sv1-eor-faq{max-width:760px;margin:0 auto;display:grid;gap:9px}
.sv1-eor-faq details{background:Canvas;border:1px solid var(--l);border-radius:11px;padding:0 16px}
.sv1-eor-faq summary{cursor:pointer;padding:14px 0;font-weight:500;font-size:14px;color:var(--ink)}
.sv1-eor-faq p{margin:0 0 14px;color:var(--mut);font-size:13px;line-height:1.9}
.sv1-eor-form{max-width:860px;margin:0 auto;background:Canvas;border:1px solid var(--l);border-radius:15px;padding:26px;box-shadow:var(--sh2)}
.sv1-eor-form fieldset{border:0;padding:0;margin:0 0 22px;min-width:0}
.sv1-eor-form legend{font-size:14px;font-weight:500;color:var(--ink);padding:0;margin-bottom:12px}
.sv1-eor-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-eor-cols>*{min-width:0}
.sv1-eor-form label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-eor-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:Canvas;color:var(--t)}
.sv1-eor-in:focus{border-color:var(--ac)}
.sv1-eor-in[aria-invalid=true]{border-color:var(--warn)}
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
.sv1-eor-list{position:absolute;inset-inline:0;top:100%;z-index:5;margin:3px 0 0;padding:4px;list-style:none;background:Canvas;border:1px solid var(--acLine);border-radius:10px;box-shadow:var(--sh2);max-height:240px;overflow:auto}
.sv1-eor-list li{padding:8px 10px;border-radius:7px;font-size:13px;cursor:pointer}
.sv1-eor-list li.on,.sv1-eor-list li:hover{background:var(--acSoft)}
.sv1-eor-list li small{display:block;color:var(--faint);font-size:11px}
.sv1-eor-list li.none{cursor:default;color:var(--mut)}
.sv1-eor-nat summary{cursor:pointer;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font-size:13.5px;background:Canvas;list-style:none;color:var(--t)}
.sv1-eor-nat summary::-webkit-details-marker{display:none}
.sv1-eor-nat[open] summary{border-color:var(--ac)}
.sv1-eor-nat .box{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px;max-height:220px;overflow:auto;border:1px solid var(--l);border-radius:10px;margin-top:5px;padding:8px;background:Canvas}
.sv1-eor-nat .box label{display:flex;align-items:center;gap:7px;margin:0;padding:5px 3px;font-size:12.5px;color:var(--t);cursor:pointer}
.sv1-eor-rm{border:0;background:none;color:var(--warn);cursor:pointer;font:inherit;font-size:12px;padding:2px 6px}
.sv1-eor-price{margin-top:10px;border:1px solid var(--acLine);background:var(--acSoft);border-radius:10px;padding:10px 13px;font-size:12.5px;color:var(--ink);line-height:1.8}
.sv1-eor-price b{font-family:var(--fm);font-weight:500;font-size:15px;color:var(--ac)}
.sv1-eor-price.hold{border-color:var(--l);background:var(--soft);color:var(--mut)}
.sv1-eor-ins{border-top:1px dashed var(--l);padding-top:10px}
.sv1-eor-ins>label{font-size:11.5px;color:var(--mut)}
.sv1-eor-insg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.sv1-eor-insg>*{min-width:0}
.sv1-eor-insx{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
.sv1-eor-insx label{display:inline-flex;align-items:center;gap:7px;margin:0;font-size:12.5px;color:var(--t);cursor:pointer}
.sv1-eor-insx input{accent-color:var(--ac)}
.sv1-eor-insnote{margin-top:6px;font-size:11.5px;color:var(--mut);line-height:1.8}
.sv1-eor-insinfo{margin-top:12px;border:1px solid var(--l);border-radius:11px;background:var(--soft);padding:0 15px}
.sv1-eor-insinfo summary{cursor:pointer;padding:11px 0;font-size:13px;font-weight:500;color:var(--ink)}
.sv1-eor-insinfo ul{margin:0 0 8px;padding-inline-start:18px;color:var(--t);font-size:12.5px;line-height:1.9}
.sv1-eor-insinfo p{margin:0 0 12px;color:var(--mut);font-size:11.5px;line-height:1.85}
.sv1-eor-unit{border-top:1px dashed var(--l);padding-top:10px}
.sv1-eor-unitg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sv1-eor-unitg>*{min-width:0}
.sv1-eor-sum{margin-top:12px;border:1px solid var(--acLine);background:var(--acSoft);border-radius:11px;padding:12px 15px;font-size:13px;color:var(--ink)}
.sv1-eor-sum b{font-family:var(--fm);font-weight:500;font-size:17px;color:var(--ac)}
.sv1-eor-sum small{display:block;margin-top:4px;color:var(--mut);font-size:11.5px;line-height:1.8}
.sv1-eor-hr{max-width:760px;margin:0 auto;text-align:center}
.sv1-eor-hr p{margin:0 0 16px;color:var(--mut);font-size:13.5px;line-height:1.9}
.sv1-eor-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:12.5px;color:var(--mut)}
.sv1-eor-bar b{font-family:var(--fm);font-weight:500;color:var(--ink)}
.sv1-eor-msg{font-size:12.5px;line-height:1.8;margin-top:10px;min-height:1em}
.sv1-eor-msg.err{color:var(--warn)}
.sv1-eor-note{font-size:11.5px;color:var(--faint);line-height:1.85;margin:12px 0 0}
.sv1-eor-done{max-width:560px;margin:0 auto;text-align:center;border:1px solid var(--l);border-radius:15px;background:Canvas;padding:34px 26px;box-shadow:var(--sh2)}
.sv1-eor-done .ic{width:52px;height:52px;border-radius:50%;background:var(--okSoft);color:var(--ok);display:grid;place-items:center;font-size:24px;margin:0 auto 14px}
.sv1-eor-done h3{font-size:21px;font-weight:400;margin:0 0 8px}
.sv1-eor-done .ref{font-family:var(--fm);font-size:20px;color:var(--ac);margin:12px 0 8px;direction:ltr;unicode-bidi:isolate}
.sv1-eor-done p{font-size:13px;color:var(--mut);line-height:1.9;margin:0 0 16px}
.sv1-eor-life{max-width:760px;margin:0 auto;display:grid;gap:10px;padding:0;list-style:none;counter-reset:lf}
.sv1-eor-life li{display:flex;gap:14px;align-items:flex-start;background:Canvas;border:1px solid var(--l);border-radius:11px;padding:14px 16px}
.sv1-eor-life li::before{counter-increment:lf;content:counter(lf);flex:none;width:28px;height:28px;border-radius:50%;background:var(--ac);color:Canvas;display:grid;place-items:center;font-family:var(--fm);font-size:13px}
.sv1-eor-life li>div{min-width:0}
.sv1-eor-life b{display:block;font-weight:500;font-size:14px;color:var(--ink);margin-bottom:3px}
.sv1-eor-life span{display:block;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-eor-whyg{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:1000px;margin:0 auto}
.sv1-eor-whyg>*{min-width:0}
.sv1-eor-why{background:Canvas;border:1px solid var(--l);border-radius:13px;padding:20px;box-shadow:var(--sh)}
.sv1-eor-why h3{font-size:15px;font-weight:500;margin:0 0 8px;color:var(--ink)}
.sv1-eor-why p{margin:0;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-eor-dur{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-eor-dur>*{min-width:0}
.sv1-eor-insinfo li b{font-weight:500;color:var(--ink)}
@media(max-width:860px){.sv1-eor-grid,.sv1-eor-whyg{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.sv1-eor-grid,.sv1-eor-whyg,.sv1-eor-dur,.sv1-eor-cols,.sv1-eor-igrid,.sv1-eor-insg,.sv1-eor-unitg{grid-template-columns:1fr}.sv1-eor-form{padding:18px}}
</style>`;

  const card = (a, b) => `<div class="sv1-eor-card"><h3>${esc(t(a))}</h3><p>${esc(t(b))}</p></div>`;
  const li = (k) => `<li>${esc(t(k))}</li>`;
  const radio = (name, val, key, id) => `<label><input type="radio" name="${name}" value="${val}" id="${id}"> ${esc(t(key))}</label>`;
  const lifeLi = (n) => `<li><div><b>${esc(t("l" + n))}</b><span>${esc(t("l" + n + "p"))}</span></div></li>`;
  const life = [1, 2, 3, 4, 5, 6, 7, 8].map(lifeLi).join("");
  const why = (n) => `<div class="sv1-eor-why"><h3>${esc(t("y" + n))}</h3><p>${esc(t("y" + n + "p"))}</p></div>`;
  // ترتيب الأسئلة: التعريف ثم صاحب العمل ثم السعر ثم الدورة ثم التفاصيل (٦–١٤ أضيفت لاحقاً فرقمها أعلى من ترتيبها).
  const faq = [6, 7, 1, 8, 3, 13, 11, 9, 10, 12, 14, 4, 2, 5].map((n) => `<details><summary>${esc(t("q" + n))}</summary><p>${esc(t("a" + n))}</p></details>`).join("");

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

  <section class="sv1-sec" id="eor-life" style="background:var(--soft)"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("lifeH"))}</h2><p>${esc(t("lifeP"))}</p></div>
    <ol class="sv1-eor-life">${life}</ol>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("whyH"))}</h2></div>
    <div class="sv1-eor-whyg">${why(1)}${why(2)}${why(3)}${why(4)}</div>
  </div></section>

  <section class="sv1-sec" style="background:var(--soft)"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("faqH"))}</h2></div>
    <div class="sv1-eor-faq">${faq}</div>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-eor-hr">
      <div class="sv1-title"><h2>${esc(t("hrH"))}</h2></div>
      <p>${esc(t("hrP"))}</p>
      <a class="sv1-btn primary" id="eorHrGate" href="${sv1.href("/hr-portal")}" data-track="EOR: بوابة HR">${esc(t("hrBtn"))}</a>
    </div>
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
          <div><label for="eorSector">${esc(t("sectorH"))}</label><select class="sv1-eor-in" id="eorSector"><option value="">${esc(t("sectorNone"))}</option>${SECTORS.map((x) => `<option value="${esc(x.id)}">${esc(x[l] || x.en)}</option>`).join("")}</select></div>
        </div>
      </fieldset>
      <fieldset><legend>${esc(t("g2"))}</legend>
        <div style="margin-bottom:16px" role="radiogroup" aria-labelledby="eorETH"><label id="eorETH">${esc(t("engH"))}</label><div class="sv1-eor-radios">${radio("eorET", "contract", "etContract", "eorET1")}${radio("eorET", "casual", "etCasual", "eorET2")}</div><p class="sv1-eor-insnote">${esc(t("etHint"))}</p></div>
        <div class="sv1-eor-cols" style="margin-bottom:16px">
          <div role="radiogroup" aria-labelledby="eorWTH"><label id="eorWTH">${esc(t("wtH"))}</label><div class="sv1-eor-radios">${radio("eorWT", "saudi", "wtSaudi", "eorWT1")}${radio("eorWT", "foreign", "wtForeign", "eorWT2")}${radio("eorWT", "both", "wtBoth", "eorWT3")}</div></div>
          <div role="radiogroup" aria-labelledby="eorRCH" id="eorRCW"><label id="eorRCH">${esc(t("rcH"))}</label><div class="sv1-eor-radios">${radio("eorRC", "yes", "rcYes", "eorRC1")}${radio("eorRC", "no", "rcNo", "eorRC2")}${radio("eorRC", "unsure", "rcUnsure", "eorRC3")}</div></div>
        </div>
        <label>${esc(t("itemsH"))}</label>
        <div id="eorItems"></div>
        <button type="button" class="sv1-btn sm" id="eorAdd">+ ${esc(t("add"))}</button>
        <div class="sv1-eor-bar"><span>${esc(t("total"))}: <b id="eorTotal">0</b> / ${EOR_LIMITS.maxTotalCount}</span><span><b id="eorItemsN">0</b> / ${EOR_LIMITS.maxItems} ${esc(t("itemCount"))}</span></div>
        <div class="sv1-eor-sum sv1-hide" id="eorPriceSum" role="status" aria-live="polite"></div>
        <details class="sv1-eor-insinfo" id="eorInsInfo"><summary>${esc(t("infoH"))}</summary>
          <ul id="eorInsClasses"><li data-cls="basic">${esc(t("infoBasic"))}</li><li data-cls="C">${esc(t("infoC"))}</li><li data-cls="B">${esc(t("infoB"))}</li><li data-cls="A">${esc(t("infoA"))}</li><li data-cls="quote">${esc(t("infoQ"))}</li></ul>
          <p>${esc(t("insurerNote"))}</p>
          <p>${esc(t("infoNote"))}</p>
        </details>
      </fieldset>
      <fieldset><legend>${esc(t("g3"))}</legend>
        <div class="sv1-eor-cols">
          <div><label for="eorStart">${esc(t("start"))}</label><input class="sv1-eor-in" id="eorStart" type="date" dir="ltr"></div>
          <div class="sv1-eor-dur"><div><label for="eorDurUnit">${esc(t("durUnitL"))}</label><select class="sv1-eor-in" id="eorDurUnit" data-dur="${esc(JSON.stringify(DUR))}"></select></div><div><label for="eorDurValue">${esc(t("durValL"))}</label><input class="sv1-eor-in" id="eorDurValue" type="number" min="1" step="1" inputmode="numeric" dir="ltr"></div></div>
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
    var TX = C.tx, OCC = C.occ, NATS = C.nats, LIM = C.lim, INS = C.ins, UNITS = C.units, LANG = C.lang, AR = LANG === "ar";
    var UNIT_BY = {}; UNITS.forEach(function (u) { UNIT_BY[u.id] = u; });
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

    // السعر الشهري الفوري: السؤال للخادم وحده (يحسب التكلفة والهامش هناك ويعيد السعر وساعة الإضافي فقط).
    var priceTimer = null, priceSeq = 0;
    function fmtNum(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
    function showPrice(it, line) {
      var box = it.priceEl; box.textContent = ""; box.className = "sv1-eor-price sv1-hide";
      if (!line || line.status === "needs_salary") return;
      box.classList.remove("sv1-hide");
      if (line.status !== "priced") { box.className = "sv1-eor-price hold"; box.textContent = TX.pReview; return; }
      var cur = " " + TX.cur;
      if (line.monthlyPerEmployee === undefined) {
        // العمالة المرنة: سعر الوحدة وإجمالي الكمية كما أعادهما الخادم (لا حساب هنا).
        var cu = line.unit;
        if (!cu || !UNIT_BY[cu.billingUnit] || cu.status !== "ok") { box.className = "sv1-eor-price hold"; box.textContent = TX.pReview; return; }
        box.appendChild(document.createTextNode(UNIT_BY[cu.billingUnit].price + ": ")); box.appendChild(el("b", "", fmtNum(cu.unitPrice))); box.appendChild(document.createTextNode(cur));
        if (cu.hoursPerDay) box.appendChild(document.createTextNode(" · " + cu.hoursPerDay + " " + TX.hrs));
        if (cu.total != null) { box.appendChild(el("br", "")); box.appendChild(document.createTextNode(TX.pUTotal + ": ")); box.appendChild(el("b", "", fmtNum(cu.total))); box.appendChild(document.createTextNode(cur)); }
        return;
      }
      box.appendChild(document.createTextNode(TX.pMonthly + ": "));
      box.appendChild(el("b", "", fmtNum(line.monthlyPerEmployee))); box.appendChild(document.createTextNode(cur + " · " + TX.pOt + ": "));
      box.appendChild(el("b", "", fmtNum(line.otHour))); box.appendChild(document.createTextNode(cur));
      var ins = line.insurance;
      if (!ins) return;
      function note(text, strong) { box.appendChild(el("br", "")); if (strong) { box.appendChild(document.createTextNode(TX.pDelta + ": ")); box.appendChild(el("b", "", strong)); box.appendChild(document.createTextNode(" " + TX.perMonth)); } else box.appendChild(document.createTextNode(text)); }
      if (ins.status === "applied") {
        if (ins.deltaMonthly) note("", (ins.deltaMonthly > 0 ? "+" : "") + fmtNum(ins.deltaMonthly));
        if (it.mCb.checked && it.gIn.value === "female" && !ins.maternity) note(TX.pNoMat);
        note(TX.insEst);
      } else if (ins.status === "quote_only") { note(TX.pQuoteOnly); note(TX.insEst); }
      else if (ins.status === "needs_age") note(TX.pNeedAge);
    }
    // أعلام الواجهة من الخادم (منطقية فقط): هل يُعرض اختيار التأمين وإضافتاه؟ تُستعمل لإخفاء الحقول لا لحساب شيء.
    var UIF = { selectable: true, addons: true };
    function isCasual() { var r = document.querySelector('input[name="eorET"]:checked'); return !!r && r.value === "casual"; }
    function syncIns(it) {
      var medical = it.cIn.value === "C" || it.cIn.value === "B" || it.cIn.value === "A";
      it.insW.classList.toggle("sv1-hide", !UIF.selectable || isCasual());
      it.mW.classList.toggle("sv1-hide", !(UIF.addons && medical && it.gIn.value === "female"));
      it.chW.classList.toggle("sv1-hide", !(UIF.addons && medical));
      it.xW.classList.toggle("sv1-hide", it.mW.classList.contains("sv1-hide") && it.chW.classList.contains("sv1-hide"));
    }
    function insOf(it) {
      var on = UIF.selectable;
      return { gender: on ? it.gIn.value : "unspecified", ageBand: on ? it.aIn.value : "", insuranceClass: on ? it.cIn.value : "basic", insurer: on ? it.rIn.value : "any",
        maternity: on && UIF.addons && it.mCb.checked && !it.mW.classList.contains("sv1-hide"), chronic: on && UIF.addons && it.chCb.checked && !it.chW.classList.contains("sv1-hide") };
    }
    // الكمية المكتوبة: فارغة ⇒ null، عدد صحيح موجب ضمن سقف الوحدة ⇒ ok. (فحص مدخلات فقط؛ الخادم يعيد التحقق ويحسب.)
    function qtyOf(it) {
      var s = digits(it.qIn.value).trim();
      if (s === "") return { ok: true, value: null };
      var n = /^\d+$/.test(s) ? parseInt(s, 10) : 0;
      return n >= 1 && n <= UNIT_BY[it.uIn.value].max ? { ok: true, value: n } : { ok: false, value: null };
    }
    function syncUnit(it) {
      var u = UNIT_BY[it.uIn.value]; it.qLb.textContent = u.qty; it.qIn.max = String(u.max);
      it.uW.classList.toggle("sv1-hide", !isCasual()); it.hW.classList.toggle("sv1-hide", !(isCasual() && it.uIn.value === "daily"));
    }
    // مدة التعاقد: وحدة + قيمة. التعاقد: شهر/سنة؛ العمالة المرنة: ساعة/يوم/شهر. فحص مدخلات فقط، والإجمالي يعيده الخادم.
    var DUR = JSON.parse($("eorDurUnit").getAttribute("data-dur"));
    function durList() { return isCasual() ? DUR.casual : DUR.contract; }
    function durCap(unit) { var l = durList(); for (var i = 0; i < l.length; i++) if (l[i][0] === unit) return l[i][2]; return 0; }
    function syncDur() {
      var sel = $("eorDurUnit"), prev = sel.value; sel.textContent = "";
      durList().forEach(function (d) { var o = el("option", "", d[1]); o.value = d[0]; sel.appendChild(o); });
      if (prev && durCap(prev)) sel.value = prev;
      $("eorDurValue").max = String(durCap(sel.value));
    }
    function durOf() {
      var unit = $("eorDurUnit").value, s = digits($("eorDurValue").value).trim();
      if (s === "") return { ok: true, unit: unit, value: null };
      var n = /^\d+$/.test(s) ? parseInt(s, 10) : 0;
      return n >= 1 && n <= durCap(unit) ? { ok: true, unit: unit, value: n } : { ok: false, unit: unit, value: null };
    }
    // توافق مع الحقل القديم durationMonths: يُرسَل للشهر والسنة فقط (تحويل وحدة لا حساب سعر).
    function durMonths(d) { return d.value == null ? null : d.unit === "month" ? d.value : d.unit === "year" ? d.value * 12 : null; }
    // أوصاف فئات التأمين من الخادم (insuranceUi.classes) إن وُجدت؛ وإلا تبقى النصوص المدمجة. textContent فقط.
    function pickTx(v) { if (v == null) return ""; if (typeof v === "string") return v; if (typeof v === "object") return String(v[LANG] || v.en || v.ar || ""); return ""; }
    function applyClassInfo(list) {
      var ul = $("eorInsClasses"); if (!ul || !Array.isArray(list)) return;
      var names = {}; INS.classes.forEach(function (c) { names[c[0]] = c[1]; });
      list.forEach(function (c) {
        if (!c || typeof c.id !== "string") return;
        // الخادم يعيد descAr/descEn فقط: العربية والإنجليزية منه، وfr/zh تبقى نصوصها المدمجة (لا إنجليزية في صفحة فرنسية).
        var id = /^vip$/i.test(c.id) ? "quote" : c.id, d = pickTx(c.description != null ? c.description : c.desc);
        if (!d) d = LANG === "ar" ? pickTx(c.descAr) : LANG === "en" ? pickTx(c.descEn) : "";
        if (!d) return;
        for (var i = 0; i < ul.children.length; i++) {
          var li = ul.children[i];
          if (li.getAttribute("data-cls") !== id) continue;
          li.textContent = ""; li.appendChild(el("b", "", pickTx(c.name) || names[id] || id)); li.appendChild(document.createTextNode(": " + d));
        }
      });
    }
    // نوع التعاقد: التعاقد (EOR) كما هو؛ العمالة المرنة تُظهر الوحدة والكمية وساعات اليوم وتُخفي التأمين والاستقدام.
    function applyEngagement() {
      var c = isCasual();
      $("eorRCW").classList.toggle("sv1-hide", c); $("eorInsInfo").classList.toggle("sv1-hide", c);
      syncDur();
      items.forEach(function (it) { syncUnit(it); syncIns(it); it.salLb.textContent = c ? TX.salaryRef : TX.salary; });
      clearPrices(); priceSoon();
    }
    function clearPrices() {
      items.forEach(function (it) { showPrice(it, null); });
      var sum = $("eorPriceSum"); sum.classList.add("sv1-hide"); sum.textContent = "";
    }
    function runPrice() {
      var wt = document.querySelector('input[name="eorWT"]:checked');
      var rows = [], owners = [], anySalary = false, casual = isCasual();
      items.forEach(function (it) {
        var n = parseInt(digits(it.countIn.value), 10);
        if (!(n >= 1 && n <= LIM.maxItemCount)) return;
        var ss = digits(it.salIn.value).trim(), sal = null;
        if (ss !== "") { sal = Number(ss); if (!isFinite(sal) || sal < 0 || sal > LIM.maxSalary) sal = null; }
        if (sal !== null && sal > 0) anySalary = true;
        var io = insOf(it), uq = qtyOf(it);
        rows.push(casual ? { count: n, nationalities: it.nats.slice(), salary: sal, billingUnit: it.uIn.value, quantity: uq.ok ? uq.value : null, hoursPerDay: it.uIn.value === "daily" ? parseInt(it.hIn.value, 10) : null }
          : { count: n, nationalities: it.nats.slice(), salary: sal, gender: io.gender, ageBand: io.ageBand, insuranceClass: io.insuranceClass, insurer: io.insurer, maternity: io.maternity, chronic: io.chronic }); owners.push(it);
      });
      if (!wt || !rows.length || !anySalary) { clearPrices(); return; }
      var dr = durOf(), dm = durMonths(dr);
      var my = ++priceSeq;
      fetch(API, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "price", engagementType: casual ? "casual" : "contract", workerType: wt.value, durationMonths: dm, durationUnit: dr.value ? dr.unit : null, durationValue: dr.value, items: rows }) })
        .then(function (r) { return r.json(); }).then(function (o) {
          if (my !== priceSeq || casual !== isCasual()) return;
          var q = o && o.ok && o.quote;
          if (!q || (q.status !== "ok" && q.status !== "partial" && q.status !== "none")) { clearPrices(); return; }
          if (q.insuranceUi) { UIF.selectable = q.insuranceUi.selectable === true; UIF.addons = q.insuranceUi.addons === true; items.forEach(syncIns); applyClassInfo(q.insuranceUi.classes); }
          items.forEach(function (it) { showPrice(it, null); });
          q.lines.forEach(function (ln, j) { if (owners[j]) showPrice(owners[j], ln); });
          var sum = $("eorPriceSum"); sum.textContent = "";
          // الإجمالي الشهري/الكمّي كما أعاده الخادم، ثم الإجمالي التقديري للمدة إن أعاده (لا ضرب ولا جمع هنا).
          var dt = q.termTotal != null ? q.termTotal : (q.durationTotal != null ? q.durationTotal : (q.duration && q.duration.total != null ? q.duration.total : null));
          var hasDt = dt != null && dt !== "" && isFinite(Number(dt));
          var main = q.monthlyTotal != null ? [TX.pTotal, q.monthlyTotal] : q.unitTotal != null ? [TX.pUSum, q.unitTotal] : null;
          if (!main && !hasDt) { sum.classList.add("sv1-hide"); return; }
          if (main) { sum.appendChild(document.createTextNode(main[0] + ": ")); sum.appendChild(el("b", "", fmtNum(main[1]))); sum.appendChild(document.createTextNode(" " + TX.cur)); }
          if (hasDt) { if (main) sum.appendChild(el("br", "")); sum.appendChild(document.createTextNode(TX.pDurTotal + ": ")); sum.appendChild(el("b", "", fmtNum(dt))); sum.appendChild(document.createTextNode(" " + TX.cur)); }
          sum.appendChild(el("small", "", hasDt ? TX.pDurNote : TX.pNote)); sum.classList.remove("sv1-hide");
        }).catch(function () {});
    }
    function priceSoon() { clearTimeout(priceTimer); priceTimer = setTimeout(runPrice, 350); }
    Array.prototype.forEach.call(document.querySelectorAll('input[name="eorWT"]'), function (r) { r.addEventListener("change", priceSoon); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="eorET"]'), function (r) { r.addEventListener("change", applyEngagement); });
    $("eorET1").checked = true;
    syncDur();
    $("eorDurUnit").addEventListener("change", function () { $("eorDurValue").max = String(durCap($("eorDurUnit").value)); priceSoon(); });
    $("eorDurValue").addEventListener("input", priceSoon);

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
      countIn.addEventListener("input", function () { refresh(); priceSoon(); }); countW.appendChild(countIn); it.countIn = countIn;

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
          priceSoon();
        });
        lb.appendChild(cb); lb.appendChild(document.createTextNode(natName(n))); box.appendChild(lb);
      });
      det.appendChild(sum); det.appendChild(box); natW.appendChild(det);

      var salW = el("div", "full"); it.salLb = el("label", "", isCasual() ? TX.salaryRef : TX.salary); salW.appendChild(it.salLb);
      var salIn = el("input", "sv1-eor-in"); salIn.type = "number"; salIn.min = "0"; salIn.max = String(LIM.maxSalary); salIn.step = "any"; salIn.inputMode = "decimal"; salIn.dir = "ltr";
      salIn.addEventListener("input", priceSoon);
      var priceEl = el("div", "sv1-eor-price sv1-hide"); priceEl.setAttribute("role", "status"); priceEl.setAttribute("aria-live", "polite");
      salW.appendChild(salIn); salW.appendChild(priceEl); it.salIn = salIn; it.priceEl = priceEl;

      // العمالة المرنة: وحدة التسعير (ساعة/يوم/شهر) وكميتها لكل موظف وساعات اليوم للوحدة اليومية. العرض والإجمالي من الخادم.
      var unW = el("div", "full sv1-eor-unit");
      var unG = el("div", "sv1-eor-unitg");
      var uW = el("div", ""); uW.appendChild(el("label", "", TX.unitH));
      var uIn = el("select", "sv1-eor-in");
      UNITS.forEach(function (u) { var o = el("option", "", u.name); o.value = u.id; uIn.appendChild(o); });
      uIn.value = "hourly";
      uW.appendChild(uIn);
      var qW = el("div", ""); var qLb = el("label", "", ""); qW.appendChild(qLb);
      var qIn = el("input", "sv1-eor-in"); qIn.type = "number"; qIn.min = "1"; qIn.step = "1"; qIn.inputMode = "numeric"; qIn.dir = "ltr";
      qW.appendChild(qIn);
      var hW = el("div", ""); hW.appendChild(el("label", "", TX.hpdH));
      var hIn = el("select", "sv1-eor-in");
      for (var hh = LIM.hMin; hh <= LIM.hMax; hh++) { var ho = el("option", "", hh + " " + TX.hrs); ho.value = String(hh); hIn.appendChild(ho); }
      hIn.value = String(LIM.hDef); hW.appendChild(hIn);
      unG.appendChild(uW); unG.appendChild(qW); unG.appendChild(hW); unW.appendChild(unG);
      it.uIn = uIn; it.qIn = qIn; it.qLb = qLb; it.hIn = hIn; it.hW = hW; it.uW = unW;
      uIn.addEventListener("change", function () { syncUnit(it); priceSoon(); });
      qIn.addEventListener("input", priceSoon);
      hIn.addEventListener("change", priceSoon);
      syncUnit(it);

      // التأمين الطبي: الجنس والفئة العمرية وفئة التأمين (+ إضافتا الأمومة والمزمن عند الاقتضاء). الحساب على الخادم.
      var insW = el("div", "full sv1-eor-ins"); insW.appendChild(el("label", "", TX.insH));
      var insG = el("div", "sv1-eor-insg");
      function sel(label, pairs, dflt) {
        var w = el("div", ""); w.appendChild(el("label", "", label));
        var s = el("select", "sv1-eor-in");
        pairs.forEach(function (pr) { var o = el("option", "", pr[1]); o.value = pr[0]; s.appendChild(o); });
        s.value = dflt; s.addEventListener("change", function () { syncIns(it); priceSoon(); });
        w.appendChild(s); insG.appendChild(w); return s;
      }
      it.gIn = sel(TX.gender, INS.genders, "unspecified");
      it.aIn = sel(TX.age, [["", INS.ageNone]].concat(INS.ages), "");
      it.cIn = sel(TX.insClass, INS.classes, "basic");
      it.rIn = sel(TX.insurerL, INS.insurers, "any");
      function chk(label) {
        var lb = el("label", ""); var cb = el("input", ""); cb.type = "checkbox";
        cb.addEventListener("change", function () { priceSoon(); });
        lb.appendChild(cb); lb.appendChild(document.createTextNode(label)); lb.classList.add("sv1-hide"); return { lb: lb, cb: cb };
      }
      var m = chk(TX.mat), ch = chk(TX.chr);
      it.mW = m.lb; it.mCb = m.cb; it.chW = ch.lb; it.chCb = ch.cb;
      it.xW = el("div", "sv1-eor-insx sv1-hide"); it.xW.appendChild(m.lb); it.xW.appendChild(ch.lb);
      insW.appendChild(insG); insW.appendChild(it.xW); it.insW = insW;

      grid.appendChild(occW); grid.appendChild(countW); grid.appendChild(natW); grid.appendChild(salW); grid.appendChild(unW); grid.appendChild(insW);
      card.appendChild(head); card.appendChild(grid); host.appendChild(card);
      it.card = card;
      rm.addEventListener("click", function () {
        items = items.filter(function (x) { return x !== it; });
        host.removeChild(card); refresh(); priceSoon();
      });
      items.push(it); syncIns(it); refresh();
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
      ["eorCompany", "eorContact", "eorEmail", "eorPhone", "eorCity", "eorStart", "eorDurValue"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
      items.forEach(function (it) { it.occIn.removeAttribute("aria-invalid"); it.countIn.removeAttribute("aria-invalid"); it.salIn.removeAttribute("aria-invalid"); it.qIn.removeAttribute("aria-invalid"); });
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
      var casual = isCasual();
      var rc = casual ? "no" : checked("eorRC"); if (!rc) return bad("eRecruit", $("eorRC1"));
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
        var io = insOf(it), uq = qtyOf(it);
        if (casual && !uq.ok) return bad("eQty", it.qIn);
        out.push(casual ? { occupationId: it.occId, count: n, nationalities: it.nats.slice(), salary: sal, billingUnit: it.uIn.value, quantity: uq.value, hoursPerDay: it.uIn.value === "daily" ? parseInt(it.hIn.value, 10) : null }
          : { occupationId: it.occId, count: n, nationalities: it.nats.slice(), salary: sal, gender: io.gender, ageBand: io.ageBand, insuranceClass: io.insuranceClass, insurer: io.insurer, maternity: io.maternity, chronic: io.chronic });
      }
      var start = $("eorStart").value.trim();
      if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return bad("eStart", $("eorStart"));
      var dr = durOf();
      if (!dr.ok || dr.value == null) return bad("eDur", $("eorDurValue"));
      return {
        company: v("eorCompany"), contactName: v("eorContact"), email: email, phone: phone, city: v("eorCity"), sector: $("eorSector").value,
        engagementType: casual ? "casual" : "contract", workerType: wt, recruitment: rc, items: out, startDate: start, durationUnit: dr.unit, durationValue: dr.value, durationMonths: durMonths(dr),
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
