// Business Partner — Simple V1: «اشترك في منصة التوظيف» (/employer-join).
//
// يملكها وكيل `recruitment-employer`. كانت الصفحة القديمة (sv1LegacyApp) بطاقاتٍ بلا شرح ولا أسعار
// (SHOW_PRICES=false تُخفيها في الطبقة القديمة) وبمعرّفات سلة قديمة (`employer-plan-*`) لا يعرفها الدفع
// الجديد. هذه الصفحة على SV1.shell() بأربع لغات (ar/en/fr/zh)، بلا main.js، وتربط الشراء بالسلة بالـSKU.
//
// ما خلف الأزرار — كله قائمٌ ولا شيء مبنيٌّ هنا من جديد:
//   اشترك (أساسية/احترافية) → يكتب بند BP-EMP-<PLAN>-<M|Y> في bp_cart (عقد السلة نفسه، kind:"subscription")
//                              ويُبدَّل أي بند اشتراكٍ سابق (اشتراك واحد في كل طلب) ثم يذهب إلى /cart.
//                              السعر الذي في البند تلميحٌ للعرض: الخادم يعيد تسعيره من الـSKU عند الدفع
//                              (/api/pay?action=emp-offer ← getPlanOffer في api/employer.js) ولا يثق بالمتصفّح.
//   المؤسسية                 → عرض سعر، لا تُباع من السلة (api/_emp-pay.js يرفض BP-EMP-ENTERPRISE-*) ← /consultation.
//   خدمات التوظيف عند الطلب  → من الكتالوج بكودها: CV-10 · BP-REC-06 (تدخل السلة بمعرّف `svc-<slug>` كأي صفحة خدمة)،
//                              و BP-REC-05 · BP-REC-04 عرض سعر ← صفحة الخدمة نفسها.
//   بعد الدفع                → /checkout يقول «ادخل بوابة صاحب العمل» ← /employer (البوابة الجديدة، لا /hr/employer القديمة).
//
// الأسعار: الشهري من site.json (employerPlans) — المرجع نفسه الذي يقرؤه الخادم عند الدفع — والسنوي بالقاعدة نفسها
// (loadEmployerPlans في simple-v1-employer.mjs، يطابقها اختبارٌ). أسعار الخدمات تصل جاهزةً من generate.mjs من
// الكتالوج. لا رقم مكتوبٌ بيدٍ هنا، ولا لونٌ حرفي (متغيّرات SV1 فقط).
//
// ?plan=basic|pro|enterprise (الروابط القديمة من /employers) يُبرز البطاقة المطلوبة ويمرّر إليها.

import { loadEmployerPlans, T as EMP_T } from "./simple-v1-employer.mjs";

const LI = { ar: 0, en: 1, fr: 2, zh: 3 };

// ar, en, fr, zh
const J = {
  title: ["اشترك في منصة التوظيف", "Subscribe to the recruitment platform", "Abonnez-vous à la plateforme de recrutement", "订阅招聘平台"],
  desc: [
    "انشر إعلانات الوظائف، وتصفّح مرشّحين مفحوصين للتوطين، ودع مساعد التوظيف الذكي يطابقهم بوظائفك. اشترك شهرياً أو سنوياً وتُفتح بوابتك فور تأكيد الدفع.",
    "Post vacancies, browse Saudization-checked candidates and let the AI hiring assistant match them to your roles. Subscribe monthly or yearly — your portal opens as soon as payment is confirmed.",
    "Publiez vos offres, parcourez des candidats vérifiés pour la saoudisation et laissez l'assistant de recrutement IA les associer à vos postes. Abonnement mensuel ou annuel — votre portail s'ouvre dès la confirmation du paiement.",
    "发布职位、浏览已做本地化（沙特化）核查的候选人，让 AI 招聘助手为您的岗位匹配人选。按月或按年订阅，付款确认后门户立即开通。",
  ],
  tag: ["لأصحاب الأعمال", "For employers", "Pour les employeurs", "面向雇主"],
  h1: ["وظّف أسرع، من بوابة واحدة", "Hire faster, from one portal", "Recrutez plus vite, depuis un seul portail", "在一个门户里更快招到人"],
  lead: [
    "انشر إعلانات وظائفك، وتصفّح مرشّحين مُصنّفين ومفحوصين للتوطين، ودع مساعد التوظيف الذكي يطابقهم بوظائفك ويلخّص سِيَرهم. تشترك، وتُفتح بوابتك فور تأكيد الدفع.",
    "Post your vacancies, browse classified, Saudization-checked candidates, and let the AI hiring assistant match them to your roles and summarise their CVs. You subscribe, and your portal opens as soon as payment is confirmed.",
    "Publiez vos offres, parcourez des candidats classés et vérifiés pour la saoudisation, et laissez l'assistant de recrutement IA les associer à vos postes et résumer leurs CV. Vous vous abonnez, et votre portail s'ouvre dès la confirmation du paiement.",
    "发布职位，浏览已分类并做沙特化核查的候选人，让 AI 招聘助手为您的岗位匹配人选并概括简历。订阅后，付款确认即开通门户。",
  ],
  ctaPlans: ["اختر باقتك", "Choose a plan", "Choisir un forfait", "选择套餐"],
  ctaPortal: ["عندي اشتراك — ادخل بوابتي", "I already subscribe — open my portal", "J'ai un abonnement — ouvrir mon portail", "我已订阅——进入我的门户"],
  stat: ["مرشّحاً في قاعدتنا", "candidates in our pool", "candidats dans notre vivier", "位候选人在我们的人才库"],
  unlockH: ["يُفتح لك فور الدفع", "Unlocked as soon as you pay", "Disponible dès le paiement", "付款后立即开通"],
  unlock1: ["بوابة صاحب العمل بحسابك", "Your employer portal", "Votre portail employeur", "您的雇主门户"],
  unlock2: ["نشر الإعلانات وإدارة المتقدمين", "Posting vacancies and managing applicants", "Publication d'offres et suivi des candidatures", "发布职位并管理申请人"],
  unlock3: ["بيانات تواصل المرشّحين وسِيَرهم الذاتية", "Candidate contact details and CVs", "Coordonnées et CV des candidats", "候选人联系方式与简历"],
  unlock4: ["مطابقة المرشّحين بالذكاء الاصطناعي (من الاحترافية)", "AI candidate matching (from Professional)", "Mise en correspondance par IA (dès Professionnel)", "AI 候选人匹配（专业版起）"],

  whatH: ["ماذا تقدّم لك المنصة", "What the platform gives you", "Ce que la plateforme vous apporte", "平台为您提供什么"],
  whatP: [
    "ثلاث أدوات في مكان واحد: تنشر، وتبحث، ويساعدك المساعد الذكي على الاختيار.",
    "Three tools in one place: you post, you search, and the AI assistant helps you choose.",
    "Trois outils au même endroit : vous publiez, vous cherchez, et l'assistant IA vous aide à choisir.",
    "三项工具集于一处：发布、搜索，再由 AI 助手帮您挑选。",
  ],
  w1H: ["نشر إعلانات الوظائف", "Post vacancies", "Publier des offres", "发布职位"],
  w1P: [
    "انشر وظيفتك فتظهر للباحثين عن عمل في صفحة الوظائف، وتصلك الطلبات في لوحتك وتنقل كل متقدّم بين مراحل الفرز حتى العرض الوظيفي.",
    "Publish a vacancy and it appears to job seekers on the jobs page. Applications land in your board, and you move each applicant through screening to the offer.",
    "Publiez un poste : il apparaît aux candidats sur la page des offres. Les candidatures arrivent dans votre tableau et vous les faites avancer du tri jusqu'à l'offre.",
    "发布职位后，求职者可在职位页看到它。申请会进入您的看板，您可把每位申请人从筛选一路推进到录用。",
  ],
  w2H: ["تصفّح المرشّحين", "Browse candidates", "Parcourir les candidats", "浏览候选人"],
  w2P: [
    "قاعدة مرشّحين تصفّيها بالمجال والمدينة والخبرة، مع فحص التوطين. بيانات التواصل والسير الذاتية تُفتح للمشتركين وحدهم.",
    "A candidate pool you filter by field, city and experience, with Saudization checks. Contact details and CVs are open to subscribers only.",
    "Un vivier filtrable par métier, ville et expérience, avec vérification de saoudisation. Coordonnées et CV réservés aux abonnés.",
    "可按领域、城市和经验筛选的候选人库，并含沙特化核查。联系方式与简历仅对订阅用户开放。",
  ],
  w3H: ["مساعد التوظيف الذكي", "AI hiring assistant", "Assistant de recrutement IA", "AI 招聘助手"],
  w3P: [
    "يطابق المرشّحين بوظيفتك ويرتّبهم بدرجة وسببٍ مكتوب، ويلخّص السيرة الذاتية، ويقترح أسئلة المقابلة لكل مرشّح.",
    "Matches candidates to your role and ranks them with a score and a written reason, summarises each CV and suggests interview questions per candidate.",
    "Associe les candidats à votre poste et les classe avec une note et une explication, résume chaque CV et propose des questions d'entretien.",
    "为您的岗位匹配候选人并给出评分与文字理由，概括每份简历，并为每位候选人建议面试问题。",
  ],

  stepsH: ["كيف تبدأ", "How to start", "Comment démarrer", "如何开始"],
  s1H: ["اختر باقتك", "Pick a plan", "Choisissez un forfait", "选择套餐"],
  s1P: ["شهرية أو سنوية — والسنوية أوفر.", "Monthly or yearly — yearly saves more.", "Mensuel ou annuel — l'annuel est plus économique.", "按月或按年——按年更划算。"],
  s2H: ["أضفها للسلة وادفع", "Add to cart and pay", "Ajoutez au panier et payez", "加入购物车并付款"],
  s2P: ["بالبطاقة، وبتمارا للاشتراك السنوي.", "By card, or Tamara for the yearly plan.", "Par carte, ou Tamara pour l'abonnement annuel.", "银行卡支付；年度订阅可用 Tamara。"],
  s3H: ["يُفعَّل حسابك تلقائياً", "Your account activates automatically", "Votre compte s'active automatiquement", "账户自动激活"],
  s3P: ["فور تأكيد الدفع، بالبريد الذي سجّلت به.", "As soon as payment is confirmed, on the e-mail you signed in with.", "Dès la confirmation du paiement, sur l'e-mail utilisé.", "付款确认后，即刻开通在您登录所用的邮箱上。"],
  s4H: ["ادخل بوابتك وانشر", "Open your portal and post", "Ouvrez votre portail et publiez", "进入门户并发布"],
  s4P: ["برمز يصل بريدك لمرة واحدة — لا كلمة مرور تُنسى.", "With a one-time code sent to your e-mail — no password to forget.", "Avec un code à usage unique envoyé par e-mail — pas de mot de passe à retenir.", "凭发送到邮箱的一次性验证码登录——无需记密码。"],

  plansH: ["الباقات والأسعار", "Plans and pricing", "Forfaits et tarifs", "套餐与价格"],
  entName: ["مؤسسية", "Enterprise", "Entreprise", "企业版"],
  entPrice: ["عرض سعر مخصّص", "Custom quote", "Devis sur mesure", "定制报价"],
  entCta: ["اطلب عرضاً", "Request a quote", "Demander un devis", "申请报价"],
  entAbout: ["باقة التوظيف المؤسسية", "Enterprise recruitment plan", "Forfait recrutement entreprise", "企业招聘套餐"],
  fBase: ["كل مزايا الأساسية", "Everything in Basic", "Tout ce qu'inclut Essentiel", "包含基础版全部功能"],
  fCv: ["تحميل السير الذاتية (PDF)", "Download CVs (PDF)", "Téléchargement des CV (PDF)", "下载简历（PDF）"],
  fPipe: ["قائمة مختصرة ومراحل توظيف", "Shortlist & hiring pipeline", "Présélection et étapes de recrutement", "候选人短名单与招聘流程"],
  fTeam: ["ترشيح مطابق من فريقنا", "Matched shortlisting by our team", "Présélection par notre équipe", "由我们团队提供匹配推荐"],
  fPrio: ["أولوية في الدعم", "Priority support", "Support prioritaire", "优先支持"],
  fEBase: ["كل مزايا الاحترافية", "Everything in Professional", "Tout ce qu'inclut Professionnel", "包含专业版全部功能"],
  fEUnl: ["فتح تواصل غير محدود", "Unlimited candidate contacts", "Coordonnées illimitées", "不限量解锁联系方式"],
  fEJobs: ["إعلانات وظائف غير محدودة", "Unlimited job postings", "Offres illimitées", "不限量发布职位"],
  fEAi: ["رسائل تواصل وأسئلة مقابلة بالذكاء الاصطناعي لكل مرشّح", "AI outreach messages & interview questions per candidate", "Messages d'approche et questions d'entretien par IA pour chaque candidat", "为每位候选人生成 AI 联系话术与面试问题"],
  fEMgr: ["مدير حساب مخصّص", "Dedicated account manager", "Gestionnaire de compte dédié", "专属客户经理"],
  fEEnd: ["إدارة التوظيف من البداية للنهاية", "End-to-end hiring managed for you", "Recrutement géré de bout en bout", "全流程招聘代管"],
  fESaud: ["تقارير توطين ودعم أولوية قصوى", "Saudization reports & top-priority support", "Rapports de saoudisation et support prioritaire", "沙特化报告与最高优先级支持"],
  perMonthYr: ["يعادل {m} ر.س شهرياً", "Equals {m} SAR a month", "Soit {m} SAR par mois", "折合每月 {m} 沙特里亚尔"],

  svcH: ["تفضّل أن نوظّف عنك؟", "Prefer that we recruit for you?", "Vous préférez que nous recrutions pour vous ?", "更希望由我们代为招聘？"],
  svcP: [
    "خدمات التوظيف عند الطلب من كتالوج Business Partner — تُطلب منفردةً وتدخل السلة بكودها.",
    "On-demand recruitment services from the Business Partner catalogue — ordered one by one, added to your cart by their code.",
    "Services de recrutement à la demande du catalogue Business Partner — commandés à l'unité, ajoutés au panier par leur code.",
    "来自 Business Partner 目录的按需招聘服务——可单独下单，并按服务代码加入购物车。",
  ],
  svcAdd: ["أضف إلى السلة", "Add to cart", "Ajouter au panier", "加入购物车"],
  svcInCart: ["أُضيفت — اذهب إلى السلة", "Added — go to cart", "Ajouté — voir le panier", "已加入——前往购物车"],
  svcQuote: ["اطلب عرض سعر", "Request a quote", "Demander un devis", "申请报价"],
  svcMore: ["التفاصيل", "Details", "Détails", "详情"],
  svcCode: ["الكود", "Code", "Code", "代码"],
  svcFail: ["تعذّر تجهيز السلة في هذا المتصفح.", "Couldn't prepare the cart in this browser.", "Impossible de préparer le panier dans ce navigateur.", "无法在此浏览器中准备购物车。"],

  faqH: ["أسئلة شائعة", "Common questions", "Questions fréquentes", "常见问题"],
  q1: ["هل الأسعار تشمل ضريبة القيمة المضافة؟", "Do prices include VAT?", "Les prix incluent-ils la TVA ?", "价格含增值税吗？"],
  a1: [
    "لا. الأسعار المعروضة قبل ضريبة القيمة المضافة (١٥٪)، وتُضاف عند الدفع.",
    "No. Prices shown exclude 15% VAT, which is added at checkout.",
    "Non. Les prix affichés sont hors TVA (15 %), ajoutée au paiement.",
    "不含。所示价格不含 15% 增值税，结账时加收。",
  ],
  q2: ["ما الفرق بين الشهري والسنوي؟", "Monthly or yearly — what changes?", "Mensuel ou annuel : quelle différence ?", "按月与按年有何区别？"],
  a2: [
    "المزايا نفسها. السنوي يغطي اثني عشر شهراً بخصم {p}٪ عن سعر الشهري، ويقبل التقسيط عبر تمارا.",
    "Same features. Yearly covers twelve months at {p}% off the monthly price, and can be split with Tamara.",
    "Mêmes fonctionnalités. L'annuel couvre douze mois avec {p} % de remise sur le tarif mensuel, et peut être fractionné avec Tamara.",
    "功能相同。按年订阅覆盖十二个月，比月费优惠 {p}%，并支持 Tamara 分期。",
  ],
  q3: ["متى يُفتح حسابي؟", "When does my account open?", "Quand mon compte s'ouvre-t-il ?", "我的账户何时开通？"],
  a3: [
    "تلقائياً فور تأكيد الدفع، على البريد الذي سجّلت دخولك به عند الدفع. ثم تدخل بوابتك برمز يصلك على البريد.",
    "Automatically as soon as payment is confirmed, on the e-mail you signed in with at checkout. Then you open your portal with a code sent to that e-mail.",
    "Automatiquement dès la confirmation du paiement, sur l'e-mail utilisé au paiement. Vous ouvrez ensuite votre portail avec un code envoyé à cet e-mail.",
    "付款确认后自动开通，开通在您结账时登录所用的邮箱上。随后用发送到该邮箱的验证码进入门户。",
  ],
  q4: ["من يرى بيانات المرشّحين؟", "Who sees candidate data?", "Qui voit les données des candidats ?", "谁能看到候选人数据？"],
  a4: [
    "المشتركون وحدهم. غير المشترك لا يرى بيانات التواصل ولا السير الذاتية، وتظهر له الأسماء مُقنَّعة.",
    "Subscribers only. Without a subscription, contact details and CVs stay hidden and names are masked.",
    "Les abonnés uniquement. Sans abonnement, coordonnées et CV restent masqués et les noms sont tronqués.",
    "仅订阅用户可见。未订阅者看不到联系方式和简历，姓名会被遮蔽。",
  ],
  q5: ["أحتاج أكثر من الاحترافية؟", "Need more than Professional?", "Besoin de plus que Professionnel ?", "需要比专业版更多？"],
  a5: [
    "الباقة المؤسسية بعرض سعر مخصّص: تواصل غير محدود وإعلانات غير محدودة ومدير حساب مخصّص. اطلب عرضاً من بطاقتها أعلاه.",
    "The Enterprise plan is quoted individually: unlimited contacts and postings and a dedicated account manager. Request a quote from its card above.",
    "Le forfait Entreprise est chiffré sur mesure : coordonnées et offres illimitées, gestionnaire de compte dédié. Demandez un devis depuis sa carte ci-dessus.",
    "企业版按需报价：不限量联系方式与职位发布，并配专属客户经理。请在上方企业版卡片申请报价。",
  ],

  endH: ["عندك اشتراك مفعّل؟", "Already subscribed?", "Déjà abonné ?", "已经订阅？"],
  endP: [
    "ادخل بوابتك بالبريد الذي اشتركت به، وسيصلك رمز لمرة واحدة.",
    "Open your portal with the e-mail you subscribed with — we send you a one-time code.",
    "Ouvrez votre portail avec l'e-mail utilisé pour vous abonner — un code à usage unique vous est envoyé.",
    "用订阅时的邮箱进入门户——我们会发送一次性验证码。",
  ],
  endCta: ["افتح بوابة صاحب العمل", "Open the employer portal", "Ouvrir le portail employeur", "打开雇主门户"],
};

// أيقونات خطّية بـcurrentColor: تأخذ لون النص وحالته فلا ألوان حرفية.
const sv = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  post: sv('<rect x="3.2" y="3.6" width="17.6" height="16.8" rx="2.4"/><path d="M7.6 8.6h8.8M7.6 12.4h8.8M7.6 16.2h5"/>'),
  people: sv('<circle cx="9" cy="8.2" r="3.2"/><path d="M3.4 20c0-3.1 2.5-5.4 5.6-5.4s5.6 2.3 5.6 5.4"/><path d="M16.4 5.4a3.2 3.2 0 0 1 0 6"/><path d="M17.8 14.9c1.8.7 3 2.4 3 4.4"/>'),
  spark: sv('<path d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9z"/><path d="M18.4 15.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
  check: sv('<path d="M5 12.6l4.4 4.4L19 7.4"/>'),
};

export function buildSimpleEmployerJoin(sv1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const idx = LI[lang] != null ? LI[lang] : 1;
  const t = (k) => J[k][idx];
  const et = (k) => { const e = EMP_T[k]; return e && e[lang] != null ? e[lang] : (e ? e.en : k); };
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? String(o[k]) : ""));
  const href = (p) => sv1.href(p);
  const services = Array.isArray(ctx.services) ? ctx.services : [];

  const EMP = loadEmployerPlans();
  const byKey = Object.fromEntries(EMP.plans.map((p) => [p.key, p]));
  const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

  // ── البطاقات: أساسية واحترافية تُباعان من السلة؛ المؤسسية عرض سعر ───────────────
  const ck = ICON.check;
  const li = (txt) => `<li>${ck}<span>${esc(txt)}</span></li>`;
  const featuresOf = (key) => {
    const p = byKey[key];
    if (key === "basic") {
      return [fill(et("fUnlock"), { n: p.unlock }), fill(et("fJobs"), { n: p.jobs }), et("fSearch"), t("fCv")];
    }
    return [t("fBase"), fill(et("fUnlock"), { n: p.unlock }), fill(et("fJobs"), { n: p.jobs }), et("fAi"), t("fPipe"), t("fTeam"), t("fPrio")];
  };
  const entFeatures = [t("fEBase"), t("fEUnl"), t("fEJobs"), t("fEAi"), t("fEMgr"), t("fEEnd"), t("fESaud")];

  const planCard = (key) => {
    const p = byKey[key];
    const m = p.offers.monthly, y = p.offers.yearly;
    const name = et(key === "pro" ? "plPro" : "plBasic");
    // كلا السعرين مبنيّان في الصفحة، والتبديل بينهما يغيّر النصّ فقط: لا حساب في المتصفّح.
    return `<article class="sv1-ej-plan${p.popular ? " pop" : ""}" id="plan-${esc(key)}" data-plan="${esc(key)}">
      ${p.popular ? `<span class="sv1-ej-badge">${esc(et("plPopular"))}</span>` : ""}
      <h3>${esc(name)}</h3>
      <div class="sv1-ej-price" data-m="${esc(fmt(m.amount))}" data-y="${esc(fmt(y.amount))}">
        <b class="sv1-mono" data-amt>${esc(fmt(m.amount))}</b>
        <span><span data-cur>${esc(et("plCur"))}</span> <span data-per>${esc(et("plPerM"))}</span></span>
      </div>
      <p class="sv1-ej-eq" data-eq data-y-month="${esc(fmt(y.amount / 12))}" hidden></p>
      <ul>${featuresOf(key).map(li).join("")}</ul>
      <button type="button" class="sv1-btn ${p.popular ? "primary" : ""}" data-subscribe="${esc(key)}" data-sku-m="${esc(m.sku)}" data-sku-y="${esc(y.sku)}"
        data-name-ar="${esc("اشتراك منصة التوظيف — " + p.nameAr)}" data-name-en="${esc("Recruitment platform — " + p.nameEn)}"
        data-amt-m="${esc(String(m.amount))}" data-amt-y="${esc(String(y.amount))}" data-track="employer-join: ${esc(key)}">${esc(et("plPick"))}</button>
    </article>`;
  };
  const entCard = `<article class="sv1-ej-plan" id="plan-enterprise" data-plan="enterprise">
      <h3>${esc(t("entName"))}</h3>
      <div class="sv1-ej-price ask"><span>${esc(t("entPrice"))}</span></div>
      <ul>${entFeatures.map(li).join("")}</ul>
      <a class="sv1-btn" href="${esc(href("/consultation") + "?about=" + encodeURIComponent(t("entAbout")))}" data-track="employer-join: enterprise">${esc(t("entCta"))}</a>
    </article>`;

  // ── خدمات الكتالوج ───────────────────────────────────────────────────────────
  const svcCard = (s) => {
    const buy = s.priced
      ? `<button type="button" class="sv1-btn primary" data-svc-add data-id="${esc(s.cartId)}" data-code="${esc(s.code)}" data-name-en="${esc(s.nameEn)}" data-name-ar="${esc(s.nameAr)}" data-amount="${esc(String(s.amount))}" data-track="employer-join svc: ${esc(s.code)}">${esc(t("svcAdd"))}</button>`
      : `<a class="sv1-btn primary" href="${esc(s.href)}" data-track="employer-join svc: ${esc(s.code)}">${esc(t("svcQuote"))}</a>`;
    return `<article class="sv1-ej-svc">
      <span class="sv1-ej-code sv1-mono">${esc(s.code)}</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.desc)}</p>
      <div class="sv1-ej-svc-pr" data-bp-price="${esc(s.code)}" data-bp-pending>${esc(s.priceLabel)}</div>
      <div class="sv1-ej-svc-act">${buy}<a class="sv1-btn" href="${esc(s.href)}">${esc(t("svcMore"))}</a></div>
    </article>`;
  };
  const svcSection = services.length
    ? `<section class="sv1-sec sv1-ej-alt" id="services"><div class="wrap">
      <div class="sv1-ej-head"><h2>${esc(t("svcH"))}</h2><p>${esc(t("svcP"))}</p></div>
      <div class="sv1-ej-svcs">${services.map(svcCard).join("")}</div>
      <p class="sv1-ej-msg sv1-hide" id="ejSvcMsg" role="status" aria-live="polite"><span id="ejSvcTx"></span> <a href="${esc(href("/cart"))}">${esc(t("svcInCart"))}</a></p>
    </div></section>`
    : "";

  const faq = [1, 2, 3, 4, 5].map((n) =>
    `<details class="sv1-ej-q"><summary>${esc(t("q" + n))}</summary><p>${esc(fill(t("a" + n), { p: EMP.savePct }))}</p></details>`).join("");

  const step = (n) => `<li><i class="sv1-mono">${n}</i><h3>${esc(t("s" + n + "H"))}</h3><p>${esc(t("s" + n + "P"))}</p></li>`;
  const what = (ico, h, p) => `<div class="sv1-ej-what"><div class="ico">${ico}</div><h3>${esc(t(h))}</h3><p>${esc(t(p))}</p></div>`;

  const CSS = `<style id="sv1-ej-css">
.sv1-ej-hero{padding:62px 0 56px}
.sv1-ej-hero .grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.9fr);gap:44px;align-items:center}
.sv1-ej-hero h1{font-size:clamp(32px,4.6vw,54px);line-height:1.15;margin:16px 0 14px;font-weight:300;letter-spacing:-.02em}
.sv1-ej-hero .sv1-lead{max-width:56ch}
.sv1-ej-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.sv1-ej-cta .sv1-btn{padding:13px 22px;font-size:14px}
.sv1-ej-stat{margin:18px 0 0;font-size:13px;color:var(--mut)}
.sv1-ej-stat b{font-family:var(--fm);font-weight:500;color:var(--ink);font-size:15px}
.sv1-ej-open{background:#fff;border:1px solid var(--acLine);border-radius:16px;box-shadow:var(--sh2);padding:22px 24px}
.sv1-ej-open h2{font-size:15px;font-weight:600;margin:0 0 12px;color:var(--ink)}
.sv1-ej-open ul{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.sv1-ej-open li,.sv1-ej-plan li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.7;color:var(--t)}
.sv1-ej-open li svg,.sv1-ej-plan li svg{width:17px;height:17px;flex:none;margin-top:4px;color:var(--ok)}
.sv1-ej-head{max-width:720px;margin:0 0 28px}
.sv1-ej-head h2{font-size:clamp(24px,3vw,32px);font-weight:300;margin:0 0 8px;letter-spacing:-.01em}
.sv1-ej-head p{margin:0;color:var(--mut);line-height:1.9;font-size:15px}
.sv1-ej-alt{background:var(--soft);border-top:1px solid var(--l);border-bottom:1px solid var(--l)}
.sv1-ej-whats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.sv1-ej-what{background:#fff;border:1px solid var(--l);border-radius:14px;padding:22px;box-shadow:var(--sh)}
.sv1-ej-what .ico{width:42px;height:42px;border-radius:11px;background:var(--acSoft);color:var(--ac);display:grid;place-items:center;margin-bottom:14px}
.sv1-ej-what .ico svg{width:22px;height:22px}
.sv1-ej-what h3{font-size:17px;margin:0 0 8px;font-weight:500}
.sv1-ej-what p{margin:0;color:var(--mut);font-size:14px;line-height:1.9}
.sv1-ej-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.sv1-ej-steps li{background:#fff;border:1px solid var(--l);border-radius:12px;padding:18px}
.sv1-ej-steps i{font-style:normal;width:32px;height:32px;border-radius:9px;background:var(--acSoft);color:var(--ac);display:grid;place-items:center;font-size:13px;font-weight:500;margin-bottom:12px}
.sv1-ej-steps h3{font-size:15px;margin:0 0 5px;font-weight:500}
.sv1-ej-steps p{margin:0;font-size:13px;line-height:1.8;color:var(--mut)}
.sv1-ej-tog{display:inline-flex;gap:4px;border:1px solid var(--l);border-radius:999px;padding:3px;margin:0 0 20px;background:#fff}
.sv1-ej-tog button{border:0;background:transparent;border-radius:999px;padding:8px 18px;font:inherit;font-size:13px;color:var(--mut);cursor:pointer}
.sv1-ej-tog button[aria-pressed="true"]{background:var(--ac);color:#fff}
.sv1-ej-tog i{font-style:normal;font-size:11px;margin-inline-start:7px;color:var(--ok)}
.sv1-ej-tog button[aria-pressed="true"] i{color:var(--acLine)}
.sv1-ej-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}
.sv1-ej-plan{position:relative;background:#fff;border:1px solid var(--l);border-radius:16px;padding:26px 24px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:12px}
.sv1-ej-plan.pop{border-color:var(--ac);box-shadow:var(--sh2)}
.sv1-ej-plan.sel{outline:2px solid var(--ac);outline-offset:3px}
.sv1-ej-plan h3{font-size:20px;margin:0;font-weight:500}
.sv1-ej-badge{position:absolute;top:-12px;inset-inline-start:22px;background:var(--ac);color:#fff;border-radius:999px;font-size:11.5px;padding:3px 13px;font-weight:500}
.sv1-ej-price{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;color:var(--ink)}
.sv1-ej-price b{font-size:38px;font-weight:500;line-height:1.1}
.sv1-ej-price span{font-size:13px;color:var(--mut)}
.sv1-ej-price.ask span{font-size:20px;font-weight:300;color:var(--ink)}
.sv1-ej-eq{margin:-6px 0 0;font-size:12px;color:var(--ok)}
.sv1-ej-plan ul{list-style:none;margin:6px 0 10px;padding:0;display:grid;gap:9px;flex:1;align-content:start}
.sv1-ej-plan .sv1-btn{width:100%;padding:13px 19px;font-size:14px}
.sv1-ej-note{margin:18px 2px 0;font-size:12.5px;line-height:1.9;color:var(--mut)}
.sv1-ej-err{margin:12px 0 0;font-size:13px;color:var(--warn)}
.sv1-ej-svcs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.sv1-ej-svc{background:#fff;border:1px solid var(--l);border-radius:14px;padding:20px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:8px}
.sv1-ej-svc h3{font-size:16px;margin:0;font-weight:500}
.sv1-ej-svc p{margin:0;font-size:13px;line-height:1.85;color:var(--mut);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sv1-ej-code{font-size:11px;color:var(--faint);letter-spacing:.04em}
.sv1-ej-svc-pr{font-family:var(--fm);font-size:18px;font-weight:500;color:var(--ink);margin-top:auto;padding-top:6px;font-variant-numeric:tabular-nums}
.sv1-ej-svc-pr[data-bp-pending]{visibility:hidden;animation:sv1ejshow .01s linear 2.2s forwards}
@keyframes sv1ejshow{to{visibility:visible}}
.sv1-ej-svc-act{display:grid;gap:8px}
.sv1-ej-svc-act .sv1-btn{width:100%;font-size:13px;padding:10px 14px}
.sv1-ej-msg{margin:16px 2px 0;font-size:13.5px;color:var(--ok);font-weight:500}
.sv1-ej-msg a{text-decoration:underline;margin-inline-start:8px}
.sv1-ej-faq{max-width:820px}
.sv1-ej-q{border:1px solid var(--l);border-radius:12px;background:#fff;margin-bottom:8px}
.sv1-ej-q summary{cursor:pointer;list-style:none;padding:14px 16px;font-size:14.5px;font-weight:500;color:var(--ink);display:flex;justify-content:space-between;gap:12px;align-items:center}
.sv1-ej-q summary::-webkit-details-marker{display:none}
.sv1-ej-q summary::after{content:"\\2304";color:var(--mut);transition:transform .2s;flex:none}
.sv1-ej-q[open] summary::after{transform:rotate(180deg)}
.sv1-ej-q p{margin:0;padding:0 16px 15px;font-size:13.8px;color:var(--s);line-height:1.9}
.sv1-ej-end{background:var(--ac);color:#fff;border-radius:18px;padding:34px 30px;display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.sv1-ej-end h2{font-size:24px;margin:0 0 6px;font-weight:400;color:#fff}
.sv1-ej-end p{margin:0;color:var(--acLine);font-size:14.5px;line-height:1.8;max-width:56ch}
.sv1-ej-end .sv1-btn{background:#fff;color:var(--ink);border-color:#fff;padding:13px 24px;font-size:14px}
@media(max-width:1000px){.sv1-ej-svcs{grid-template-columns:repeat(2,minmax(0,1fr))}.sv1-ej-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.sv1-ej-hero .grid{grid-template-columns:1fr;gap:26px}.sv1-ej-whats,.sv1-ej-plans{grid-template-columns:1fr}.sv1-ej-hero{padding:34px 0 36px}}
@media(max-width:560px){.sv1-ej-svcs,.sv1-ej-steps{grid-template-columns:1fr}.sv1-ej-cta .sv1-btn{width:100%}.sv1-ej-end{padding:26px 20px}.sv1-ej-end .sv1-btn{width:100%}.sv1-ej-price b{font-size:34px}}
</style>`;

  const body = `${sv1.header("/employer-join")}
<main>
  <section class="sv1-hero sv1-ej-hero"><div class="wrap"><div class="grid">
    <div>
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("h1"))}</h1>
      <p class="sv1-lead">${esc(t("lead"))}</p>
      <div class="sv1-ej-cta">
        <a class="sv1-btn primary" href="#plans" data-track="employer-join: choose-plan">${esc(t("ctaPlans"))}</a>
        <a class="sv1-btn" href="${esc(href("/employer"))}" data-track="employer-join: portal">${esc(t("ctaPortal"))}</a>
      </div>
      <p class="sv1-ej-stat sv1-hide" id="ejStat"></p>
    </div>
    <aside class="sv1-ej-open" aria-label="${esc(t("unlockH"))}">
      <h2>${esc(t("unlockH"))}</h2>
      <ul>${[1, 2, 3, 4].map((n) => li(t("unlock" + n))).join("")}</ul>
    </aside>
  </div></div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-ej-head"><h2>${esc(t("whatH"))}</h2><p>${esc(t("whatP"))}</p></div>
    <div class="sv1-ej-whats">
      ${what(ICON.post, "w1H", "w1P")}
      ${what(ICON.people, "w2H", "w2P")}
      ${what(ICON.spark, "w3H", "w3P")}
    </div>
  </div></section>

  <section class="sv1-sec sv1-ej-alt" id="plans"><div class="wrap">
    <div class="sv1-ej-head"><h2>${esc(t("plansH"))}</h2><p>${esc(et("plVat"))}</p></div>
    <div class="sv1-ej-tog" role="group" aria-label="${esc(et("plMonthly") + " / " + et("plYearly"))}">
      <button type="button" id="ejM" aria-pressed="true">${esc(et("plMonthly"))}</button><button type="button" id="ejY" aria-pressed="false">${esc(et("plYearly"))}${EMP.savePct ? `<i>${esc(fill(et("plSave"), { p: EMP.savePct }))}</i>` : ""}</button>
    </div>
    <div class="sv1-ej-plans">${planCard("basic")}${planCard("pro")}${entCard}</div>
    <p class="sv1-ej-err sv1-hide" id="ejErr" role="alert"></p>
    <p class="sv1-ej-note">${esc(et("plSub"))}</p>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-ej-head"><h2>${esc(t("stepsH"))}</h2></div>
    <ol class="sv1-ej-steps">${[1, 2, 3, 4].map(step).join("")}</ol>
  </div></section>

  ${svcSection}

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-ej-head"><h2>${esc(t("faqH"))}</h2></div>
    <div class="sv1-ej-faq">${faq}</div>
  </div></section>

  <section class="sv1-sec" style="padding-top:0"><div class="wrap">
    <div class="sv1-ej-end">
      <div><h2>${esc(t("endH"))}</h2><p>${esc(t("endP"))}</p></div>
      <a class="sv1-btn" href="${esc(href("/employer"))}" data-track="employer-join: portal-end">${esc(t("endCta"))}</a>
    </div>
  </div></section>
</main>
${sv1.footer()}`;

  const cfg = {
    cart: href("/cart"),
    per: { m: et("plPerM"), y: et("plPerY") },
    eq: t("perMonthYr"),
    stat: t("stat"),
    cartErr: et("plCartE"),
    svcAdded: t("svcInCart"),
    svcFail: t("svcFail"),
  };

  // السكربت نصٌّ ثابت بلا backslash، فلا يتضاعف شيء داخل قالب النصوص.
  const script = `<script src="/assets/js/live-prices.js${ctx.liveV ? "?v=" + ctx.liveV : ""}" defer></script><script>(function(){
var C=${JSON.stringify(cfg).replace(/</g, "\\u003c")};
var bill='monthly';
function $(i){return document.getElementById(i)}
function all(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
function readCart(){var c;try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}return c}
function writeCart(c){try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}return true}
function err(m){var e=$('ejErr');if(!e)return;e.textContent=m||'';e.classList.toggle('sv1-hide',!m)}

// ── التبديل شهري/سنوي: يبدّل النصّ المبنيّ سلفاً فقط ───────────────────────────
function draw(){
 $('ejM').setAttribute('aria-pressed',bill==='monthly'?'true':'false');
 $('ejY').setAttribute('aria-pressed',bill==='yearly'?'true':'false');
 all('.sv1-ej-price[data-m]').forEach(function(p){
  p.querySelector('[data-amt]').textContent=bill==='yearly'?p.getAttribute('data-y'):p.getAttribute('data-m');
  p.querySelector('[data-per]').textContent=bill==='yearly'?C.per.y:C.per.m});
 all('[data-eq]').forEach(function(e){
  if(bill==='yearly'){e.textContent=C.eq.replace('{m}',e.getAttribute('data-y-month'));e.hidden=false}else{e.hidden=true}});
 err('')}
$('ejM').onclick=function(){bill='monthly';draw()};
$('ejY').onclick=function(){bill='yearly';draw()};

// ── اشتراك: بند BP-EMP-* في السلة بعقد bp_cart نفسه، ثم /cart ────────────────────
all('[data-subscribe]').forEach(function(b){b.onclick=function(){
 var y=bill==='yearly',sku=b.getAttribute(y?'data-sku-y':'data-sku-m'),amt=Number(b.getAttribute(y?'data-amt-y':'data-amt-m'));
 var c=readCart().filter(function(x){return !/^BP-EMP-/i.test(String(x&&x.id||''))});
 c.push({id:sku,nameEn:b.getAttribute('data-name-en'),nameAr:b.getAttribute('data-name-ar'),amount:amt,price:'',kind:'subscription',qty:1,
  surchargeAmount:null,surchargeFreeCount:null,pricePublic:1,billingPeriod:bill,renewsAt:null,commissionPercent:0});
 if(!writeCart(c)){err(C.cartErr);return}
 location.href=C.cart}});

// ── خدمات الكتالوج: معرّف svc-<slug> كما في صفحات الخدمات ──────────────────────
all('[data-svc-add]').forEach(function(b){b.onclick=function(){
 var id=b.getAttribute('data-id'),c=readCart(),hit=null;
 c.forEach(function(x){if(x&&x.id===id)hit=x});
 if(hit){hit.qty=(Number(hit.qty)||1)}else{
  var a=b.getAttribute('data-amount');
  c.push({id:id,nameEn:b.getAttribute('data-name-en'),nameAr:b.getAttribute('data-name-ar'),amount:a?Number(a):null,price:'',kind:'service',qty:1,
   surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0})}
 var m=$('ejSvcMsg');
 if(!writeCart(c)){if(m){$('ejSvcTx').textContent=C.svcFail;m.classList.remove('sv1-hide')}return}
 if(m){$('ejSvcTx').textContent=b.getAttribute('data-name-'+(document.documentElement.lang==='ar'?'ar':'en'));m.classList.remove('sv1-hide')}}});

// ── ?plan=… من الروابط القديمة: يُبرز البطاقة ويمرّر إليها ────────────────────────
try{var q=new URLSearchParams(location.search),pl=q.get('plan'),bl=q.get('billing');
 if(bl==='yearly'){bill='yearly';draw()}
 var card=pl&&$('plan-'+pl);
 if(card){card.classList.add('sel');setTimeout(function(){try{card.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}},150)}}catch(e){}

// ── سطر الإحصاء: رقمٌ حيّ أو لا شيء (done:true برقمٍ حقيقي) ─────────────────────
fetch('/api/candidates?count=1').then(function(r){return r.json()}).then(function(d){
 if(!d||!d.ok||!d.done||!(d.total>0))return;
 var el=$('ejStat');if(!el)return;
 el.innerHTML='<b>'+Number(d.total).toLocaleString('en-US')+'</b> '+C.stat;el.classList.remove('sv1-hide')}).catch(function(){});
})();</script>`;

  return sv1.shell({ title: `${t("title")} — Business Partner`, desc: t("desc"), path: "/employer-join", body: CSS + body, script });
}
