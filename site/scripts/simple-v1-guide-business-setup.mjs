// Business Partner — Simple V1: دليل تأسيس الأعمال (/guide/business-setup).
// نُقل من طبقة الموقع القديم إلى SV1.shell() تطبيقاً لقاعدة CLAUDE.md §2.6،
// على نمط site/scripts/simple-v1-guide-structure.mjs. المحتوى بلا تغيير —
// انظر التعليق التفصيلي في simple-v1-guide-saudi-market.mjs لمصدر البحث
// ومنهجية التحفّظ على الأرقام غير المؤكدة.

const T = {
  title: { ar: "كيف تؤسس شركة في السعودية", en: "How to set up a company in Saudi Arabia" },
  metaTitle: { ar: "تأسيس الأعمال في السعودية", en: "Business Setup in Saudi Arabia" },
  desc: {
    ar: "تسلسل التسجيل الفعلي، وأنواع تراخيص وزارة الاستثمار الثمانية، والمناطق الاقتصادية الخاصة وبرنامج المقر الإقليمي — مع توثيق مصدر كل رقم.",
    en: "The real registration sequence, the 8 MISA license types, Special Economic Zones and the RHQ program — with every figure source-flagged.",
  },
  tag: { ar: "دليل السعودية", en: "Saudi Guide" },
  onPage: { ar: "في هذه الصفحة", en: "On this page" },
  consult: { ar: "احجز استشارة", en: "Book a consultation" },
  calc: { ar: "احسب تكاليفك الحكومية", en: "Calculate your government costs" },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  more: { ar: "تابع استكشاف الدليل", en: "Continue exploring the guide" },
  disclaimer: {
    ar: "الأنظمة والرسوم والبرامج الحكومية تتغيّر بشكل متكرر. هذا الدليل مرجع أولي — تأكد دائماً من الأرقام الحالية عبر البوابة الرسمية أو اسأل فريقنا قبل الاعتماد على رقم محدد.",
    en: "Government rules, fees and programs change often. This guide is a starting reference — always confirm current figures with the official portal or ask our team before relying on a specific number.",
  },
};

const SECTIONS = [
  {
    id: "process",
    nav: { ar: "خطوات التأسيس", en: "Setup process" },
    h: { ar: "خطوات تأسيس الشركة", en: "Company setup process" },
    lead: { ar: "سلسلة تسجيل المستثمر الأجنبي — معظم الخطوات رقمية، وبعضها يُفعّل تلقائياً فور صدور السجل التجاري.", en: "A foreign investor's registration chain — most steps are digital and several are auto-triggered once your CR is issued." },
    items: [
      { ar: "1) رخصة استثمار من وزارة الاستثمار (MISA) — اختيار النشاط المصنّف ISIC والشكل القانوني (الشركة ذات المسؤولية المحدودة الأكثر شيوعاً).", en: "1) Investment license from the Ministry of Investment (MISA) — select your ISIC-coded activity and legal structure (LLC most common)." },
      { ar: "2) السجل التجاري عبر المركز السعودي للأعمال — هذه الخطوة الواحدة تسجّلك تلقائياً لدى وزارة الموارد البشرية (قوى) والزكاة والضريبة والتأمينات الاجتماعية والبريد السعودي والغرفة التجارية.", en: "2) Commercial Registration (CR) via the Saudi Business Center — this single step auto-registers you with HRSD/Qiwa, ZATCA, GOSI, Saudi Post and the Chamber of Commerce." },
      { ar: "3) تسجيل العنوان الوطني (البريد السعودي) — يمكن إتمامه أثناء إصدار السجل التجاري.", en: "3) National address registration (Saudi Post/SPL) — can be completed during CR issuance." },
      { ar: "4) الرخصة البلدية عبر منصة بلدي، بعد توفر مقر فعلي — تتطلب عقد إيجار موثّقاً في إيجار.", en: "4) Municipal (Baladiya) license via the Balady platform, once you have a physical premises — requires an Ejar-registered lease." },
      { ar: "5) تفعيل التأمينات الاجتماعية والتسجيل في قوى/وزارة الموارد البشرية للتأمين على الموظفين وامتثال السعودة.", en: "5) GOSI activation and Qiwa/HRSD registration for employee social insurance and Saudization compliance." },
      { ar: "6) فتح الحساب البنكي — عادة حساب المدير العام الشخصي أولاً ثم حساب الشركة.", en: "6) Bank account opening — typically the GM's personal account first, then the company account." },
    ],
    note: {
      ar: "بموجب نظام الاستثمار الجديد (المفعّل تقريباً منذ فبراير 2025)، تشير التقارير إلى أن وزارة الاستثمار تستبدل \"رخصة الاستثمار الأجنبي\" التقليدية بـ\"شهادة تسجيل الاستثمار\" الموحدة — وهو تغيير مصطلحات جوهري نتابعه. الجدول الزمني الفعلي للتأسيس الكامل يتفاوت بشدة حسب النشاط (يُذكر عادة 1-6 أشهر عملياً) وليس مدة معتمدة رسمياً منشورة.",
      en: "Under Saudi Arabia's new Investment Law (reported effective ~Feb 2025), MISA is reportedly replacing the traditional \"Foreign Investment License\" with a unified \"Investment Registration Certificate\" — a material terminology shift we're tracking. Realistic full setup timelines vary widely by activity (commonly reported 1–6 months in practice) and are not an official published SLA.",
    },
  },
  {
    id: "licenses",
    nav: { ar: "أنواع التراخيص", en: "License types" },
    h: { ar: "أنواع التراخيص التجارية الثمانية", en: "The 8 MISA business license types" },
    lead: { ar: "أي رخصة تحدد ما يحق للكيان المملوك أجنبياً القيام به قانونياً.", en: "Which license gates what a foreign-owned entity may legally do." },
    items: [
      { ar: "الرخصة الخدمية — الأوسع انتشاراً: تقنية المعلومات، الاستشارات، التسويق، المطاعم والخدمات المهنية العامة.", en: "Service License — the broadest category: IT/software, consulting, marketing, F&B and general professional services." },
      { ar: "الرخصة الريادية — للشركات الناشئة، تتطلب خطاب تزكية من حاضنة أو مسرّعة معتمدة من وزارة الاستثمار.", en: "Entrepreneurial License — for startups, requires an endorsement letter from a MISA-recognized incubator/accelerator." },
      { ar: "الرخصة الصناعية — للتصنيع، تُنظّم بالاشتراك مع وزارة الصناعة والثروة المعدنية.", en: "Industrial License — for manufacturing, jointly regulated with the Ministry of Industry and Mineral Resources." },
      { ar: "الرخصة الزراعية — لأنشطة الزراعة والمحاصيل والثروة الحيوانية.", en: "Agricultural License — for farming, cultivation and livestock activities." },
      { ar: "الرخصة العقارية (التطوير) — الحد الأدنى المُبلّغ عنه لاستثمار المشروع 30 مليون ريال، خارج حدود مكة والمدينة.", en: "Real Estate (Development) License — reported minimum project investment SAR 30 million, outside Mecca/Medina boundaries." },
      { ar: "الرخصة التجارية — الاستيراد والتصدير والبيع بالجملة والتجزئة؛ الأرقام المُبلّغ عنها لرأس المال تتفاوت حسب المصدر (نطاق 26-30 مليون ريال).", en: "Trading (Commercial) License — import/export and wholesale/retail; reported capital figures vary by source (SAR 26–30 million range)." },
      { ar: "رخصة التعدين — لأنشطة التعدين؛ عادة يُشترط تأسيس الكيان المتقدم خارج المملكة لمدة سنة على الأقل.", en: "Mining License — for mining activities; applicant entity typically must be established abroad for at least 1 year." },
      { ar: "الرخصة المهنية — لمجالات استشارية محددة (هندسية، بحرية، استشارات تعدين)؛ من الفئات القليلة التي تتطلب شريكاً سعودياً (25% فأكثر).", en: "Professional License — for specific consulting fields (engineering, marine, mining consulting); one of the only categories requiring a Saudi partner (≥25%)." },
    ],
    note: {
      ar: "أرقام رأس المال المذكورة أعلاه تتفاوت بين المصادر الثانوية ولم نتمكن من تأكيدها من صفحة رسمية مباشرة لوزارة الاستثمار في هذا البحث — تعامل مع كل رقم هنا كإرشادي، وتأكد من المتطلبات الحالية مباشرة مع الوزارة أو فريقنا قبل وضع ميزانية التأسيس.",
      en: "Specific SAR capital-requirement figures above vary across secondary sources and could not be confirmed against a primary MISA page in this research pass — treat every number here as indicative and confirm current requirements directly with MISA or our team before budgeting your setup.",
    },
  },
  {
    id: "sez",
    nav: { ar: "المناطق الاقتصادية", en: "Economic Zones" },
    h: { ar: "المناطق الاقتصادية الخاصة في السعودية", en: "Saudi Arabia's Special Economic Zones" },
    lead: { ar: "أربع مناطق أطلقتها هيئة المدن الاقتصادية والمناطق الخاصة في 13 أبريل 2023، بالإضافة لمنطقة لوجستية خامسة تُدار من الهيئة العامة للطيران المدني — لكل منها تركيز قطاعي وحوافز ضريبية.", en: "Four zones launched by ECZA on 13 April 2023, plus a fifth logistics zone governed by GACA — each with its own sector focus and tax incentives." },
    items: [
      { ar: "منطقة مدينة الملك عبدالله الاقتصادية — التصنيع المتقدم، السيارات، تقنية المعلومات، الأدوية والتقنيات الطبية واللوجستيات.", en: "King Abdullah Economic City (KAEC) SEZ — advanced manufacturing, automotive, ICT, pharma/MedTech and logistics." },
      { ar: "منطقة رأس الخير — الصناعات البحرية وبناء السفن وصيانة المنصات.", en: "Ras Al-Khair SEZ — maritime industries, shipbuilding, rig/platform maintenance." },
      { ar: "منطقة جازان — بوابة تجارية لأفريقيا؛ تصنيع الأغذية وتحويل المعادن واللوجستيات.", en: "Jazan SEZ — a trade gateway to Africa; food processing, metals conversion, logistics." },
      { ar: "منطقة الحوسبة السحابية — منطقة \"افتراضية\" مقرها مدينة الملك عبدالعزيز للعلوم والتقنية بالرياض؛ مراكز بيانات وذكاء اصطناعي وأمن سيبراني، بتملك أجنبي كامل دون شريك محلي.", en: "Cloud Computing SEZ — a \"virtual\" zone headquartered at KACST in Riyadh; data centers, AI and cybersecurity, 100% foreign ownership without a local partner." },
      { ar: "المنطقة اللوجستية المتكاملة الخاصة (مطار الرياض) — التخزين والتوزيع ولوجستيات إعادة التصدير؛ تُدار من الهيئة العامة للطيران المدني وليس هيئة المدن الاقتصادية.", en: "Special Integrated Logistics Zone (SILZ, Riyadh Airport) — warehousing, distribution and re-export logistics; governed by GACA, not ECZA." },
      { ar: "الحوافز المُبلّغ عنها للمناطق التابعة للهيئة: ضريبة دخل مؤسسي 5% لمدة تصل إلى 20 عاماً، ضريبة استقطاع 0%، وإعفاءات جمركية وضريبة قيمة مضافة على السلع المؤهلة.", en: "ECZA-zone incentives commonly reported: 5% corporate income tax for up to 20 years, 0% withholding tax, and customs/VAT relief on qualifying goods." },
      { ar: "حافز المنطقة اللوجستية المُبلّغ عنه: ضريبة دخل 0% لمدة تصل إلى 50 عاماً على دخل الأنشطة المؤهلة داخل المنطقة.", en: "SILZ incentive commonly reported: 0% income tax for up to 50 years on eligible zone-activity income." },
    ],
  },
  {
    id: "rhq",
    nav: { ar: "المقر الإقليمي", en: "RHQ program" },
    h: { ar: "برنامج المقر الإقليمي (RHQ)", en: "The RHQ program" },
    lead: { ar: "برنامج وزارة الاستثمار لجذب المقرات الإقليمية للشركات متعددة الجنسيات إلى الرياض — حافز ضريبي حقيقي ومُعلن رسمياً لمدة 30 عاماً.", en: "MISA's program to bring multinational regional headquarters to Riyadh — a real, officially announced 30-year tax incentive." },
    items: [
      { ar: "الأهلية: شركة متعددة الجنسيات لديها عمليات في دولتين على الأقل غير السعودية ودولة المقر الأم.", en: "Eligibility: a multinational corporation with operations in at least two countries other than Saudi Arabia and its home country." },
      { ar: "الحافز: ضريبة دخل مؤسسي 0% وضريبة استقطاع 0% على الأنشطة المؤهلة للمقر الإقليمي لمدة 30 عاماً من منح الترخيص، قابلة للتجديد — أُعلنت رسمياً من وزارة الاستثمار والزكاة والضريبة ووزارة المالية (5 ديسمبر 2023).", en: "Incentive: 0% corporate income tax and 0% withholding tax on RHQ-eligible activities for 30 years from license grant, renewable — officially announced by MISA/ZATCA/Ministry of Finance (5 Dec 2023)." },
      { ar: "متطلبات الجوهر الاقتصادي: 3 مسؤولين تنفيذيين على الأقل خلال السنة الأولى، وحد أدنى 15 موظفاً خلال سنة، ومسؤول تنفيذي واحد مقيم في المملكة على الأقل.", en: "Substance requirements: at least 3 executives within the first year, minimum 15 employees within one year, at least one Kingdom-resident executive." },
      { ar: "منذ 1 يناير 2024، الشركات متعددة الجنسيات المؤهلة لبرنامج المقر الإقليمي ولكن دون ترخيص فعلي لا يمكنها عموماً التعاقد مع الجهات الحكومية السعودية (مع استثناءات محدودة، مثل العقود أقل من مليون ريال).", en: "Since 1 January 2024, multinationals eligible for RHQ status but without a licensed RHQ generally cannot contract with Saudi government entities (limited exemptions exist, e.g. contracts under SAR 1 million)." },
    ],
  },
  {
    id: "national-address",
    nav: { ar: "العنوان الوطني", en: "National address" },
    h: { ar: "العنوان الوطني للمنشآت", en: "National address for business" },
    lead: { ar: "نظام العنونة الموحد من البريد السعودي — العنوان القانوني الرسمي المسجّل لمنشأتك.", en: "Saudi Post's standardized addressing system — your establishment's official legal address of record." },
    items: [
      { ar: "إلزامي للمنشآت العاملة في المملكة — مطلوب للعقود والتراخيص والمراسلات الرسمية.", en: "Mandatory for businesses operating in the Kingdom — required for contracts, licenses and official correspondence." },
      { ar: "يُسجَّل عبر المركز السعودي للأعمال أثناء إصدار السجل التجاري، أو منفصلاً عبر بوابة البريد السعودي باستخدام رقم السجل التجاري.", en: "Registered via the Saudi Business Center during CR issuance, or separately via the Saudi Post (SPL) portal using your CR number." },
      { ar: "يُجدَّد سنوياً؛ وتُعفى الشركات الجديدة عادةً من رسوم الاشتراك في السنة الأولى بحسب المصادر المتاحة.", en: "Renews annually; new companies are commonly reported as exempt from the subscription fee in the first year." },
    ],
  },
  {
    id: "activities",
    nav: { ar: "تصنيف الأنشطة", en: "Activity codes" },
    h: { ar: "تحقق من رمز نشاطك التجاري", en: "Check your business activity code" },
    lead: { ar: "كل سجل تجاري يجب أن يحدد نشاطاً واحداً أو أكثر مصنّفاً وفق التصنيف الوطني السعودي، المبني على نظام ISIC الأممي.", en: "Every Commercial Registration must specify one or more coded activities from Saudi Arabia's national classification, based on the UN's ISIC system." },
    items: [
      { ar: "يغطي التصنيف الوطني أكثر من 2,800 نشاط اقتصادي مختلف، مصنّفة وفق المراجعة الرابعة لنظام ISIC.", en: "The national classification covers 2,800+ distinct economic activities, coded per ISIC Revision 4." },
      { ar: "يوفّر المركز السعودي للأعمال خدمة \"الاستعلام المساعد\" الإلكترونية للبحث عن النشاط أو الرمز الصحيح قبل أو أثناء تسجيل السجل التجاري.", en: "The Saudi Business Center offers a public \"Assisted Inquiry\" e-service to search for the correct activity/code before or during CR registration." },
      { ar: "أهلية التملك الأجنبي لكل نشاط تُفحص بشكل منفصل، وفق قائمة وزارة الاستثمار للأنشطة المقيّدة أو المستثناة — ولا تظهر ضمن أداة البحث عن النشاط نفسها.", en: "Foreign-ownership eligibility per activity is checked separately, against MISA's list of restricted/excluded activities — not shown inline in the activity lookup itself." },
    ],
  },
];

const SAUDI_GUIDE_PAGES = [
  ["/saudi-arabia", { ar: "الاستثمار في السعودية", en: "Invest in Saudi" }],
  ["/guide/saudi-market", { ar: "السوق السعودي", en: "The Saudi Market" }],
  ["/guide/run-your-business", { ar: "تشغيل عملك", en: "Run Your Business" }],
  ["/guide/company-structure", { ar: "الهيكلة والرواتب", en: "Structure & Salaries" }],
  ["/guide/live-in-saudi", { ar: "الحياة في السعودية", en: "Live in Saudi" }],
  ["/guide/residency", { ar: "الإقامة في السعودية", en: "Residency in KSA" }],
];

export function buildSimpleGuideBusinessSetup(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e[lang] != null ? e[lang] : e.en);
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  const CSS = `<style id="sv1-gd-css">
.sv1-gd-head{text-align:start;max-width:820px;margin:0 0 26px}
.sv1-gd-head h1{font-size:clamp(28px,4vw,46px);line-height:1.15;margin:16px 0 12px;letter-spacing:-.03em;font-weight:200;color:var(--ink)}
.sv1-gd-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}
.sv1-gd-nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 30px;padding:12px 0;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2)}
.sv1-gd-nav a{font-size:12.5px;padding:6px 12px;border:1px solid var(--l);border-radius:999px;color:var(--ink);background:#fff;white-space:nowrap}
.sv1-gd-nav a:hover{border-color:var(--ink)}
.sv1-gd-sec{background:#fff;border:1px solid var(--l);border-radius:14px;padding:24px;margin:0 0 14px;box-shadow:var(--sh);scroll-margin-top:96px}
.sv1-gd-sec h2{font-size:21px;font-weight:400;color:var(--ink);margin:0 0 6px;letter-spacing:-.02em}
.sv1-gd-sec>p{color:var(--mut);margin:0 0 14px;font-size:14px;line-height:1.85}
.sv1-gd-sec ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.sv1-gd-sec li{position:relative;padding-inline-start:20px;font-size:14px;line-height:1.85;color:var(--t)}
.sv1-gd-sec li::before{content:"";position:absolute;inset-inline-start:0;top:.8em;width:7px;height:7px;border-radius:50%;background:var(--ac)}
.sv1-gd-note{margin-top:14px;background:var(--acSoft);border:1px solid var(--acLine);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.8;color:var(--t)}
.sv1-gd-more{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sv1-gd-more a{background:#fff;border:1px solid var(--l);border-radius:12px;padding:14px;font-size:13.5px;color:var(--ink);box-shadow:var(--sh)}
.sv1-gd-more a:hover{border-color:var(--acLine)}
@media(max-width:860px){.sv1-gd-more{grid-template-columns:1fr 1fr}.sv1-gd-sec{padding:18px}}
</style>`;

  const nav = SECTIONS.map((s) => `<a href="#${s.id}">${esc(pick(s.nav))}</a>`).join("");

  const sections = SECTIONS.map((s) => {
    const list = s.items ? `<ul>${s.items.map((i) => `<li>${esc(pick(i))}</li>`).join("")}</ul>` : "";
    const note = s.note ? `<div class="sv1-gd-note">${esc(pick(s.note))}</div>` : "";
    return `<section class="sv1-gd-sec" id="${s.id}"><h2>${esc(pick(s.h))}</h2><p>${esc(pick(s.lead))}</p>${list}${note}</section>`;
  }).join("");

  const more = SAUDI_GUIDE_PAGES.map(([p, l]) => `<a href="${esc(u(p))}">${esc(pick(l))} ${lang === "ar" ? "←" : "→"}</a>`).join("");

  const body = `${SV1.header("/guide/business-setup")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-gd-head">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("title"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
      <div class="sv1-gd-acts">
        <a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("consult"))}</a>
        <a class="sv1-btn" href="${esc(u("/calculators/government-cost"))}">${esc(t("calc"))}</a>
      </div>
    </div>
    <nav class="sv1-gd-nav" aria-label="${esc(t("onPage"))}">${nav}</nav>
    ${sections}
    <div class="sv1-gd-note" style="margin:22px 0 34px">${esc(t("disclaimer"))}</div>
    <h2 style="font-size:19px;font-weight:400;color:var(--ink);margin:0 0 12px">${esc(t("more"))}</h2>
    <div class="sv1-gd-more">${more}</div>
    <div style="text-align:center;margin-top:34px"><a class="sv1-btn primary" href="${esc(u("/"))}">${esc(t("start"))}</a></div>
  </div></section>
  </main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${t("metaTitle")} — Business Partner`,
    desc: t("desc"),
    path: "/guide/business-setup",
    body: CSS + body,
  });
}
