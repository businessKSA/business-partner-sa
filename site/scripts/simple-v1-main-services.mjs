// Business Partner — «خدماتنا الرئيسية» (طلب المالك 2026-10-29).
//
// ست بطاقات: تأسيس الشركات · إدارة الخدمات الحكومية · EOR · الامتثال وتقييم الشركات ·
// تطوير الأعمال · الخدمات المشتركة. لكل بطاقة شرح قصير وثلاثة بنود «تشمل» وأربعة أزرار:
//   «اسأل المستشار» (يفتح محادثة الرئيسية بالباب المناسب) · «تفاصيل الخدمة» ·
//   «الباقات والأسعار» · «ابدأ الطلب».
//
// أين تظهر: في الرئيسية **تحت المحادثة** (بعد قسم #advisor مباشرة — لا شيء فوقها ولا بين
// الأبواب) وفي صفحة /services. المفتاح في site/data/features.json:
//   "mainServices": { "home": true, "services": true }   // false أو حذفه = يختفي القسم عند البناء
//
// القواعد (CLAUDE.md §4 وقرار المالك 2026-10-11):
//   • لا سعر ولا رقم في أي بطاقة (SHOW_PRICES=false) — زر «الباقات والأسعار» يذهب إلى صفحةٍ
//     تعرض ما يحق عرضه؛ لا معلومة حكومية مخترعة: كل بند «تشمل» مأخوذ من اسم خدمة في الكتالوج
//     أو من صفحة الخدمة نفسها.
//   • «المستشار الذكي» لا «الوكيل». لا واتساب في المحتوى. الاسم «Business Partner».
//   • المخالفات: مراجعة / دراسة أهلية الاعتراض / تجهيز / تقديم / متابعة — لا وعد بالإلغاء.
//   • تطوير الأعمال صفحته مخفية في site/data/hidden.json: بطاقته تظهر بلا روابط إلى صفحة
//     مخفية (زر المستشار وحده + وسم «قريباً») إلى أن يرفع المالك الإخفاء.
//
// لا يمسّ هذا الملف المحادثة ولا أبوابها: زر «اسأل المستشار» ينقر الباب الموجود أصلاً
// (#door-consulting / #door-formation / #door-government) فتعمل آلية الرئيسية كما هي.
import fs from "node:fs";
import { pageVisible } from "./hidden.mjs";
import { EOR_PAGE_TEXT } from "./simple-v1-eor.mjs";

export const MAIN_SERVICE_KEYS = ["formation", "government", "eor", "compliance", "bizdev", "shared"];

const T = {
  title: { ar: "خدماتنا الرئيسية", en: "Our main services", fr: "Nos services principaux", zh: "我们的主要服务" },
  sub: {
    ar: "اختر الخدمة، واقرأ ما تشمله، ثم اسأل المستشار أو ابدأ طلبك مباشرة.",
    en: "Pick a service, read what it covers, then ask the advisor or start your request directly.",
    fr: "Choisissez un service, lisez ce qu'il couvre, puis interrogez le conseiller ou démarrez votre demande.",
    zh: "选择服务，了解其内容，然后咨询顾问或直接开始申请。",
  },
  incl: { ar: "تشمل", en: "Includes", fr: "Comprend", zh: "包含" },
  ask: { ar: "اسأل المستشار", en: "Ask the advisor", fr: "Demander au conseiller", zh: "咨询顾问" },
  details: { ar: "تفاصيل الخدمة", en: "Service details", fr: "Détails du service", zh: "服务详情" },
  plans: { ar: "الباقات والأسعار", en: "Packages & pricing", fr: "Forfaits et tarifs", zh: "套餐与价格" },
  start: { ar: "ابدأ الطلب", en: "Start the request", fr: "Démarrer la demande", zh: "开始申请" },
  soon: { ar: "قريباً", en: "Coming soon", fr: "Bientôt", zh: "即将推出" },
  note: {
    ar: "الأسعار تظهر للمسجّلين بعد الدخول وهي قبل الضريبة. الرسوم الحكومية، إن وُجدت، منفصلة وتُعلن قبل البدء.",
    en: "Prices appear after you sign in and are before VAT. Government fees, where they apply, are separate and announced before work starts.",
    fr: "Les prix s'affichent après connexion et sont hors TVA. Les frais gouvernementaux, le cas échéant, sont distincts et annoncés avant le début.",
    zh: "登录后显示价格，且不含增值税。政府规费（如有）单独列示，并在开始前告知。",
  },
  // ما يُكتب في صندوق المحادثة (لا يُرسل — العميل يراجعه ويضغط إرسال).
  seedCompliance: {
    ar: "أريد معرفة خدمة الامتثال وتقييم شركتي.",
    en: "I would like to know about the compliance and company assessment service.",
    fr: "Je souhaite en savoir plus sur le service de conformité et d'évaluation de mon entreprise.",
    zh: "我想了解合规与公司评估服务。",
  },
  seedShared: {
    ar: "أريد معرفة خدمة الخدمات المشتركة (فريقي التنفيذي الذكي).",
    en: "I would like to know about the Shared Services team (my smart executive team).",
    fr: "Je souhaite en savoir plus sur l'équipe de services partagés (mon équipe exécutive intelligente).",
    zh: "我想了解共享服务团队（我的智能执行团队）。",
  },
  seedBizdev: {
    ar: "أريد تطوير أعمال شركتي: عملاء أو موردين أو شريك جديد.",
    en: "I want to develop my company's business: customers, suppliers or a new partner.",
    fr: "Je souhaite développer l'activité de mon entreprise : clients, fournisseurs ou nouveau partenaire.",
    zh: "我想拓展公司业务：客户、供应商或新的合作伙伴。",
  },
};

// الشرح والبنود: كل سطر مأخوذ من اسم خدمة في الكتالوج أو من صفحة الخدمة نفسها (انظر الرأس).
const SERVICES = {
  formation: {
    icon: "🏢",
    title: { ar: "تأسيس الشركات", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" },
    desc: {
      ar: "نؤسس شركتك السعودية أو فرع شركتك الأجنبية، من حجز الاسم وعقد التأسيس إلى السجل التجاري والتسجيل في الجهات، وتتابع كل خطوة من حسابك.",
      en: "We set up your Saudi company or the branch of your foreign company, from name reservation and the articles of association to the commercial registration and agency registrations, and you follow every step from your account.",
      fr: "Nous créons votre société saoudienne ou la succursale de votre société étrangère, de la réservation du nom et des statuts au registre de commerce et aux inscriptions, et vous suivez chaque étape depuis votre compte.",
      zh: "我们为您设立沙特公司或外国公司分支机构：从名称预留、章程到商业登记及各机构注册，您可在账户中跟进每一步。",
    },
    inc: [
      { ar: "حجز الاسم وإعداد عقد التأسيس وتوثيقه", en: "Name reservation, drafting and notarizing the articles", fr: "Réservation du nom, rédaction et légalisation des statuts", zh: "名称预留、起草并公证章程" },
      { ar: "إصدار السجل التجاري", en: "Commercial registration issuance", fr: "Délivrance du registre de commerce", zh: "办理商业登记" },
      { ar: "التسجيل في الزكاة والضريبة والتأمينات وقوى ومدد ومقيم", en: "Registration in Zakat/tax, GOSI, Qiwa, Mudad and Muqeem", fr: "Inscription Zakat/fiscalité, GOSI, Qiwa, Mudad et Muqeem", zh: "天课/税务、GOSI、Qiwa、Mudad 与 Muqeem 注册" },
    ],
    ask: { door: "formation" },
    details: "/services/category/company-formation",
    plans: "/packages#pkg-formation",
    start: "/catalog?door=formation",
  },
  government: {
    icon: "🏛️",
    title: { ar: "إدارة الخدمات الحكومية", en: "Government services management", fr: "Gestion des services gouvernementaux", zh: "政府服务管理" },
    desc: {
      ar: "ندير منصاتك الحكومية ومعاملاتك نيابةً عنك، من التسجيل والتجديد إلى المتابعة والتصعيد، فلا تضيع عليك مهلة.",
      en: "We run your government platforms and transactions on your behalf, from registration and renewal to follow-up and escalation, so no deadline is missed.",
      fr: "Nous gérons vos plateformes et démarches gouvernementales pour vous, de l'inscription et du renouvellement au suivi et à l'escalade, afin qu'aucun délai ne vous échappe.",
      zh: "我们代您管理政府平台与办事流程：从注册、续期到跟进与升级处理，不错过任何期限。",
    },
    inc: [
      { ar: "تفعيل منصاتك والتسجيل فيها: قوى، مدد، التأمينات، الزكاة والضريبة", en: "Activating and registering on your platforms: Qiwa, Mudad, GOSI, Zakat and tax", fr: "Activation et inscription sur vos plateformes : Qiwa, Mudad, GOSI, Zakat et fiscalité", zh: "开通并注册各平台：Qiwa、Mudad、GOSI、天课与税务" },
      { ar: "التجديدات وإصدار التصاريح والرخص", en: "Renewals and issuing permits and licences", fr: "Renouvellements et délivrance de permis et licences", zh: "续期及办理许可证与执照" },
      { ar: "متابعة المعاملات والتصعيد على منصات الوزارة", en: "Following transactions and escalating on the ministry's platforms", fr: "Suivi des démarches et escalade sur les plateformes du ministère", zh: "跟进办理事项并在部委平台上升级处理" },
    ],
    ask: { door: "government" },
    details: "/services/category/government-relations",
    plans: "/packages#pkg-management",
    start: "/catalog?door=government",
  },
  eor: {
    icon: "👥",
    // العنوان والوصف من مصدر صفحة /eor نفسها فلا يتباعد النصّان.
    title: null,
    desc: null,
    inc: [
      { ar: "التعاقد وإدارة ملفات الموظفين، سعوديين أو أجانب", en: "Employment contracts and employee files, Saudi or foreign staff", fr: "Contrats de travail et dossiers du personnel, saoudien ou étranger", zh: "劳动合同与员工档案管理（沙特或外籍员工）" },
      { ar: "الرواتب في مواعيدها بحسب الحضور الذي تعتمده", en: "Payroll on the agreed dates, based on the attendance you approve", fr: "Paie aux dates convenues, selon les présences que vous validez", zh: "按约定日期、依据您确认的考勤发放薪资" },
      { ar: "إنهاء التعاقد وتسوية المستحقات وفق الاتفاقية", en: "Contract termination and settlement of entitlements under the agreement", fr: "Fin de contrat et règlement des droits selon l'accord", zh: "依协议办理合同终止及应付款项结算" },
    ],
    ask: { href: "/eor#eorAssist" },
    details: "/eor",
    plans: "/eor#eor-form",
    start: "/eor#eor-form",
  },
  compliance: {
    icon: "🛡️",
    title: { ar: "الامتثال وتقييم الشركات", en: "Compliance & company assessment", fr: "Conformité et évaluation des entreprises", zh: "合规与公司评估" },
    desc: {
      ar: "نقيّم وضع شركتك قبل التفتيش ونصحّح المخالفات، ثم نراقب منصاتك الحكومية وننبّهك قبل المهل والتجديدات.",
      en: "We assess your company before inspection and correct violations, then monitor your government platforms and warn you before deadlines and renewals.",
      fr: "Nous évaluons votre entreprise avant l'inspection et corrigeons les infractions, puis surveillons vos plateformes et vous alertons avant les échéances et renouvellements.",
      zh: "我们在检查前评估您的公司并纠正违规，随后持续监控政府平台，并在期限与续期前提醒您。",
    },
    inc: [
      { ar: "تقييم ذاتي للامتثال وتصحيح المخالفات قبل التفتيش", en: "Self-assessment of compliance and correcting violations before inspection", fr: "Auto-évaluation de la conformité et correction des infractions avant inspection", zh: "合规自评并在检查前纠正违规" },
      { ar: "مراقبة مستمرة لقوى ومقيم والتأمينات ومدد، وتنبيهات المهل والتجديدات", en: "Continuous monitoring of Qiwa, Muqeem, GOSI and Mudad, with deadline and renewal alerts", fr: "Surveillance continue de Qiwa, Muqeem, GOSI et Mudad, avec alertes d'échéances et de renouvellements", zh: "持续监控 Qiwa、Muqeem、GOSI 与 Mudad，并提醒期限与续期" },
      { ar: "المخالفات: مراجعة ودراسة أهلية الاعتراض ثم التجهيز والتقديم والمتابعة", en: "Violations: review, study of objection eligibility, then preparation, submission and follow-up", fr: "Infractions : examen, étude de l'éligibilité à l'opposition, puis préparation, dépôt et suivi", zh: "违规处理：审核、评估是否具备异议资格，然后准备、提交并跟进" },
    ],
    ask: { door: "consulting", seed: "seedCompliance" },
    details: "/compliance-agent",
    plans: "/compliance-agent#subscribe",
    start: "/services/bp-self-01",
  },
  bizdev: {
    icon: "📈",
    title: { ar: "تطوير الأعمال للشركات", en: "Business development for companies", fr: "Développement commercial pour les entreprises", zh: "企业业务拓展" },
    desc: {
      ar: "عملاء أو موردون أو شريك جديد؟ نحدّد معك مسار النمو المناسب، ونطابق شركتك مع الجهات التي تناسبها.",
      en: "New customers, suppliers or a partner? We map the right growth route with you and match your company with suitable counterparts.",
      fr: "De nouveaux clients, fournisseurs ou un partenaire ? Nous définissons avec vous la bonne voie de croissance et mettons votre entreprise en relation avec des interlocuteurs adaptés.",
      zh: "新客户、供应商或合作伙伴？我们与您确定合适的增长路径，并为您的公司匹配合适的对象。",
    },
    inc: [
      { ar: "ملف تطوير أعمال لشركتك", en: "A business development profile for your company", fr: "Un profil de développement commercial pour votre entreprise", zh: "为您公司建立业务拓展档案" },
      { ar: "مطابقة مع شركات مناسبة: عملاء أو موردون أو شركاء", en: "Matching with suitable companies: customers, suppliers or partners", fr: "Mise en relation avec des entreprises adaptées : clients, fournisseurs ou partenaires", zh: "匹配合适的公司：客户、供应商或合作伙伴" },
      { ar: "مساحة متابعة داخل حسابك", en: "A follow-up workspace inside your account", fr: "Un espace de suivi dans votre compte", zh: "账户内的跟进工作区" },
    ],
    ask: { door: "bizdev", fallbackDoor: "consulting", seed: "seedBizdev" },
    details: "/business-development",
    plans: "/business-development#pricing",
    start: "/business-development",
    page: "business-development",
  },
  shared: {
    icon: "🧩",
    title: { ar: "الخدمات المشتركة", en: "Shared services", fr: "Services partagés", zh: "共享服务" },
    desc: {
      ar: "فريقك التنفيذي الذكي: محادثة واحدة وخلفها فريق متخصص في الشؤون الحكومية والامتثال والموارد البشرية والمالية والقانونية والتسويق والمشتريات.",
      en: "Your smart executive team: one conversation with a specialist team behind it across government affairs, compliance, HR, finance, legal, marketing and procurement.",
      fr: "Votre équipe exécutive intelligente : une seule conversation, avec derrière elle une équipe spécialisée en affaires gouvernementales, conformité, RH, finance, juridique, marketing et achats.",
      zh: "您的智能执行团队：一次对话，背后是涵盖政府事务、合规、人力资源、财务、法务、营销与采购的专业团队。",
    },
    inc: [
      { ar: "محادثة واحدة مع فريق تنفيذي متخصص", en: "One conversation with a specialist executive team", fr: "Une seule conversation avec une équipe exécutive spécialisée", zh: "与专业执行团队的统一对话" },
      { ar: "بوابة خاصة لمتابعة عمل الفريق", en: "A dedicated portal to follow the team's work", fr: "Un portail dédié pour suivre le travail de l'équipe", zh: "专属门户，跟进团队工作" },
      { ar: "اشتراك واحد بدل توظيف كل تخصص", en: "One subscription instead of hiring for each specialty", fr: "Un seul abonnement au lieu d'embaucher pour chaque spécialité", zh: "一份订阅，无需为每个专业单独招聘" },
    ],
    ask: { door: "consulting", seed: "seedShared" },
    details: "/shared-services",
    plans: "/shared-services#ss-subscribe",
    start: "/shared-services#ss-subscribe",
  },
};

function bizdevDoorOn() {
  try { return pageVisible("business-development") && JSON.parse(fs.readFileSync(new URL("../data/features.json", import.meta.url), "utf8")).bizdevDoor === true; }
  catch { return false; }
}

// مفتاح الميزة: where = "home" | "services". غيابه أو خلله = لا قسم.
export function mainServicesOn(where) {
  try {
    const f = JSON.parse(fs.readFileSync(new URL("../data/features.json", import.meta.url), "utf8")).mainServices || {};
    return f[where] === true;
  } catch { return false; }
}

// ask → { door, seed } يُستعمل في الرئيسية وحدها: خريطة المفتاح إلى باب المحادثة ونصّ يُكتب في صندوقها.
export function askMap(lang) {
  const l = ["ar", "en", "fr", "zh"].includes(lang) ? lang : "en";
  const out = {};
  for (const k of MAIN_SERVICE_KEYS) {
    const a = SERVICES[k].ask;
    if (!a.door) continue;
    const door = a.door === "bizdev" ? (bizdevDoorOn() ? "bizdev" : a.fallbackDoor) : a.door;
    out[k] = { door, text: a.seed ? T[a.seed][l] : "" };
  }
  return out;
}

const CSS = `<style id="msv-css">
.msv{padding:64px 0 24px}
.msv-in{max-width:1160px;margin:0 auto;padding:0 22px;width:100%;box-sizing:border-box}
.msv-head{text-align:center;max-width:720px;margin:0 auto 28px}
.msv-head h2{margin:0 0 8px;font-size:clamp(24px,3.4vw,34px);line-height:1.25;color:#0B1B5A;letter-spacing:-.02em}
.msv-head p{margin:0;color:#5A6478;font-size:15px;line-height:1.8}
.msv-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.msv-card{display:flex;flex-direction:column;background:#fff;border:1px solid #DFE4EF;border-radius:14px;padding:20px;box-shadow:0 1px 2px rgba(11,27,90,.04),0 8px 24px -16px rgba(11,27,90,.18);min-width:0;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}
.msv-card:hover{border-color:#C3CDE6;box-shadow:0 1px 2px rgba(11,27,90,.05),0 14px 30px -16px rgba(11,27,90,.28)}
.msv-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.msv-ico{flex:none;width:42px;height:42px;border-radius:11px;background:#EEF2FB;color:#0B1B5A;display:grid;place-items:center;font-size:20px;line-height:1}
.msv-card h3{margin:0;font-size:18px;line-height:1.35;color:#0B1B5A;font-weight:600;letter-spacing:-.01em}
.msv-soon{display:inline-block;margin-inline-start:8px;vertical-align:middle;font-size:11px;font-weight:600;color:#7A5A00;background:#FFF4D6;border:1px solid #F0DCA0;border-radius:999px;padding:2px 9px}
.msv-desc{margin:0 0 12px;color:#5A6478;font-size:14px;line-height:1.85}
.msv-incl{margin:0 0 16px;padding:0;list-style:none;display:grid;gap:7px;font-size:13px;line-height:1.7;color:#232A3D}
.msv-incl li{position:relative;padding-inline-start:20px}
.msv-incl li::before{content:"✓";position:absolute;inset-inline-start:0;top:0;color:#1B7F4B;font-weight:700}
.msv-incl-t{font-size:12px;font-weight:600;color:#66708a;margin:0 0 7px}
.msv-acts{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.msv-btn{display:inline-flex;align-items:center;justify-content:center;text-align:center;gap:6px;border:1px solid #DFE4EF;background:#fff;color:#0B1B5A;padding:10px 12px;border-radius:9px;font:inherit;font-weight:500;font-size:13.5px;line-height:1.3;cursor:pointer;text-decoration:none;box-sizing:border-box;min-height:42px;transition:background .15s,border-color .15s,transform .12s}
.msv-btn:hover{border-color:#0B1B5A}
.msv-btn.primary{background:#0B1B5A;border-color:#0B1B5A;color:#fff}
.msv-btn.primary:hover{background:#16307F;border-color:#16307F;transform:translateY(-1px)}
.msv-btn:focus-visible,.msv-link:focus-visible{outline:3px solid #7C9BFF;outline-offset:2px}
.msv-links{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:center;padding-top:4px;font-size:13px}
.msv-link{color:#0B1B5A;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#C3CDE6}
.msv-link:hover{text-decoration-color:#0B1B5A}
.msv-foot{max-width:760px;margin:18px auto 0;text-align:center;color:#66708a;font-size:12.5px;line-height:1.8}
@media(max-width:980px){.msv-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){
 .msv{padding:44px 0 12px}
 .msv-in{padding:0 16px}
 .msv-grid{grid-template-columns:1fr}
 .msv-card{padding:18px}
}
</style>`;

// Returns { html, css, script }. `href` يقبل مساراً بلا لغة ويعيد الرابط باللغة (الاستعلام والتجزئة تُحفظ هنا).
// where: "home" (يضيف السكربت) | "services".
export function buildMainServices({ esc, href, lang, where = "home" }) {
  const l0 = lang();
  const l = ["ar", "en", "fr", "zh"].includes(l0) ? l0 : "en";
  const tx = (o) => (o && (o[l] != null ? o[l] : o.en)) || "";
  const link = (p) => {
    const i = p.search(/[?#]/);
    return i < 0 ? href(p) : href(p.slice(0, i)) + p.slice(i);
  };
  const home = href("/");
  const askMapNow = askMap(l);
  const eor = EOR_PAGE_TEXT[l] || EOR_PAGE_TEXT.en;

  const cards = MAIN_SERVICE_KEYS.map((k) => {
    const s = SERVICES[k];
    const hidden = s.page && !pageVisible(s.page);
    const title = k === "eor" ? eor.title : tx(s.title);
    const desc = k === "eor" ? eor.desc : tx(s.desc);
    // «اسأل المستشار»: على الرئيسية يُنقر الباب فتعمل المحادثة كما هي؛ في غيرها رابطٌ إلى الرئيسية بمعامل ask.
    let askHref;
    if (s.ask.href) askHref = link(s.ask.href);
    else askHref = home + "?ask=" + k + "#advisor";
    const askAttr = s.ask.href ? "" : ` data-msv-ask="${k}"`;
    const incl = s.inc.map((x) => `<li>${esc(tx(x))}</li>`).join("");
    const btns = hidden
      ? `<a class="msv-btn primary" href="${esc(askHref)}"${askAttr} data-track="خدماتنا الرئيسية: اسأل المستشار — ${esc(tx(s.title))}" style="grid-column:1/-1">${esc(T.ask[l])}</a>`
      : `<a class="msv-btn primary" href="${esc(link(s.start))}" data-track="خدماتنا الرئيسية: ابدأ الطلب — ${esc(title)}">${esc(T.start[l])}</a>
        <a class="msv-btn" href="${esc(askHref)}"${askAttr} data-track="خدماتنا الرئيسية: اسأل المستشار — ${esc(title)}">${esc(T.ask[l])}</a>
        <div class="msv-links"><a class="msv-link" href="${esc(link(s.details))}">${esc(T.details[l])}</a><a class="msv-link" href="${esc(link(s.plans))}">${esc(T.plans[l])}</a></div>`;
    return `<article class="msv-card" data-msv="${k}">
      <div class="msv-top"><span class="msv-ico" aria-hidden="true">${s.icon}</span><h3>${esc(title)}${hidden ? `<span class="msv-soon">${esc(T.soon[l])}</span>` : ""}</h3></div>
      <p class="msv-desc">${esc(desc)}</p>
      <p class="msv-incl-t">${esc(T.incl[l])}</p>
      <ul class="msv-incl">${incl}</ul>
      <div class="msv-acts">${btns}</div>
    </article>`;
  }).join("");

  const inner = `<div class="msv-in">
    <div class="msv-head"><h2>${esc(T.title[l])}</h2><p>${esc(T.sub[l])}</p></div>
    <div class="msv-grid">${cards}</div>
    <p class="msv-foot">${esc(T.note[l])}</p>
  </div>`;
  const html = `
  <section class="msv msv-${where}" id="main-services" data-home-extra="main-services" aria-labelledby="msv-h">${inner.replace("<h2>", '<h2 id="msv-h">')}</section>`;

  // الرئيسية وحدها: «اسأل المستشار» ينقر باب المحادثة الموجود ويكتب النص في صندوقها دون إرساله.
  // الرابط العادي (بلا JS أو من /services) ينقل إلى الرئيسية ?ask=… فيُشغَّل الشيء نفسه عند التحميل.
  const script = where !== "home" ? "" : `<script>
(function(){
var MAP=${JSON.stringify(askMapNow)};
function run(k){var m=MAP[k];if(!m)return false;var d=document.getElementById('door-'+m.door);if(!d)return false;
 d.click();
 if(m.text){var i=document.getElementById('sv1In');if(i){i.value=m.text;try{i.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}}}
 return true}
document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('[data-msv-ask]'):null;if(!a)return;
 if(run(a.getAttribute('data-msv-ask')))e.preventDefault()});
try{var k=new URLSearchParams(location.search).get('ask');if(k&&MAP[k])run(k)}catch(e){}
})();</script>`;

  return { html, css: CSS, script };
}
