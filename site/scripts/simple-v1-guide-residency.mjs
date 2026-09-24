// Business Partner — Simple V1: دليل الإقامة في السعودية (/guide/residency).
// نُقل من طبقة الموقع القديم إلى SV1.shell() تطبيقاً لقاعدة CLAUDE.md §2.6،
// على نمط site/scripts/simple-v1-guide-structure.mjs. المحتوى بلا تغيير —
// انظر التعليق التفصيلي في simple-v1-guide-saudi-market.mjs لمصدر البحث.

const T = {
  title: { ar: "خيارات الإقامة في السعودية", en: "Residency options in Saudi Arabia" },
  metaTitle: { ar: "الإقامة في السعودية", en: "Residency in Saudi Arabia" },
  desc: {
    ar: "الإقامة النظامية، والإقامة المميزة، وأنظمة نقل الكفالة — بما في ذلك الرسوم التي تمكّن بحثنا من تأكيدها والتي لم يتمكّن.",
    en: "Standard Iqama, Premium Residency and sponsorship-transfer rules — including the fee figures our research could and could not confirm.",
  },
  tag: { ar: "دليل السعودية", en: "Saudi Guide" },
  onPage: { ar: "في هذه الصفحة", en: "On this page" },
  consult: { ar: "احجز استشارة", en: "Book a consultation" },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  more: { ar: "تابع استكشاف الدليل", en: "Continue exploring the guide" },
  disclaimer: {
    ar: "الأنظمة والرسوم والبرامج الحكومية تتغيّر بشكل متكرر. هذا الدليل مرجع أولي — تأكد دائماً من الأرقام الحالية عبر البوابة الرسمية أو اسأل فريقنا قبل الاعتماد على رقم محدد.",
    en: "Government rules, fees and programs change often. This guide is a starting reference — always confirm current figures with the official portal or ask our team before relying on a specific number.",
  },
};

const SECTIONS = [
  {
    id: "iqama",
    nav: { ar: "الإقامة النظامية", en: "Standard Iqama" },
    h: { ar: "الإقامة (المسندة من صاحب العمل)", en: "Iqama (employer-sponsored residency)" },
    lead: { ar: "تصريح الإقامة النظامي للعمالة الوافدة، تصدره المديرية العامة للجوازات التابعة لوزارة الداخلية.", en: "The standard residence permit for foreign workers, issued by the Ministry of Interior's General Directorate of Passports (Jawazat)." },
    items: [
      { ar: "كانت تاريخياً مرتبطة بنظام الكفالة؛ وخفّفت مبادرة إصلاح سوق العمل (نافذة منذ 14 مارس 2021) هذا الارتباط بشكل كبير — راجع قسم أنظمة النقل أدناه.", en: "Historically tied to the kafala (sponsorship) relationship; the 2021 Labor Reform Initiative (LRI, effective 14 March 2021) loosened this considerably — see the Transfer Rules section below." },
      { ar: "الحالة القانونية للإقامة تُجدَّد دورياً (سنوياً عادة، وتُذكر مصادر إمكانية التجديد المرن كل 3/6/9/12 شهراً)؛ وبطاقة الإقامة الفعلية المُبلّغ عنها بصلاحية 5 سنوات (منذ نحو الربع الأول من 2026) لا تُغيّر التزام التجديد الأساسي — لا ينبغي الخلط بين الأمرين.", en: "Underlying legal residency status is renewed on a cycle (commonly annual, some sources report flexible 3/6/9/12-month increments); a separately-reported 5-year physical Resident ID card (since ~Q1 2026) does not change the underlying renewal obligation — the two should not be conflated." },
      { ar: "إقامات المرافقين (العائلة) يكفلها الموظف، بشروط دخل معينة؛ ويُذكر عادة رسم مرافقين قدره 400 ريال شهرياً لكل مرافق.", en: "Dependent (family) Iqamas are sponsored by the employee, subject to income conditions; a commonly cited dependent levy is SAR 400/month per dependent." },
      { ar: "الإقامة المنتهية تمنع إعادة الدخول ويجب تجديدها (مع رسوم التأخير) قبل استئناف السفر؛ ألغت السعودية حظر إعادة الدخول التلقائي لمدة 3 سنوات لحالات تجاوز مدة الإقامة، ويُذكر أن ذلك سرى اعتباراً من 16 يناير 2024 — وتبقى الغرامات الإدارية سارية.", en: "An expired Iqama blocks re-entry and must be renewed (with late fees) before travel resumes; Saudi Arabia lifted the automatic 3-year re-entry ban for overstays, reportedly effective 16 January 2024 — administrative fines still apply." },
      { ar: "مقيم هي البوابة الموجّهة لأصحاب العمل لإدارة معاملات إقامة وتأشيرات الموظفين؛ وأبشر هي المنصة الموجّهة للأفراد للخدمات الحكومية الشخصية.", en: "Muqeem is the employer-facing portal for managing employees' Iqama and visa transactions; Absher is the individual-facing platform for personal government services." },
    ],
    note: {
      ar: "المبالغ الدقيقة لغرامات تجاوز المدة والتجديد المتأخر، وكذلك بطاقة الخمس سنوات الفعلية، مصدرها ثانوي فقط في هذا البحث — تأكد من الأرقام الحالية مباشرة عبر أبشر أو الجوازات قبل النشر أو الاعتماد على رقم محدد.",
      en: "Exact overstay/late-renewal fine amounts and the 5-year physical-card claim come from secondary sources only in this research pass — confirm current figures directly via Absher/Jawazat before publishing or relying on a specific number.",
    },
  },
  {
    id: "premium-residency",
    nav: { ar: "الإقامة المميزة", en: "Premium Residency" },
    h: { ar: "نظام الإقامة المميزة", en: "Premium Residency (نظام الإقامة المميزة)" },
    lead: { ar: "وضع إقامة ذاتية الكفالة — دون حاجة لكفيل سعودي — يديره مركز الإقامة المميزة عبر بوابة pr.gov.sa.", en: "A self-sponsored residence status — no Saudi kafeel required — run by the Premium Residency Center via pr.gov.sa." },
    items: [
      { ar: "منتجان أساسيان أصليان: الإقامة الدائمة (غير محددة المدة) — برسم لمرة واحدة يُذكر عادة بـ800,000 ريال — والإقامة الخاصة (المتجددة) — برسم سنوي يُذكر عادة بـ100,000 ريال.", en: "Two original core products: Permanent (Unlimited Duration) Residency — a one-time fee commonly reported at SAR 800,000 — and Special (Renewable) Residency — an annual fee commonly reported at SAR 100,000." },
      { ar: "في 10 يناير 2024، أُدرجت خمسة منتجات فئوية إضافية برسم يُذكر بنحو 4,000 ريال سنوياً لكل منها: إقامة الكفاءات المتميزة، والموهوبين، والمستثمرين، ورواد الأعمال، وملّاك العقار — وهذه مسارات إضافية إلى جانب المنتجين الأصليين، وليست بديلاً عن رسومهما.", en: "On 10 January 2024, five additional category-specific products were introduced at a reported ~SAR 4,000/year fee each: Special Talent, Gifted, Investor, Entrepreneur, and Real Estate Owner residency — these are additional tracks alongside the original two products, not a replacement of their fees." },
      { ar: "إقامة ملّاك العقار: تتطلب تملّك عقار سكني خالٍ من الرهن بقيمة يُذكر أن حدها الأدنى 4 ملايين ريال.", en: "Real Estate Owner Residency: requires ownership of a mortgage-free residential property valued at a reported minimum of SAR 4 million." },
      { ar: "إقامة المستثمرين: حدود يُذكر أنها نحو 7 ملايين ريال استثمار (أو مستوى أعلى بـ15 مليون ريال مع شروط لخلق وظائف) — الأرقام تتفاوت قليلاً حسب المصدر.", en: "Investor Residency: reported thresholds around SAR 7 million investment (or a higher SAR 15 million tier with job-creation requirements) — figures vary somewhat by source." },
      { ar: "الأهلية العامة لكافة المنتجات: جواز سفر ساري (6 أشهر فأكثر)، إثبات ملاءة مالية، سجل جنائي نظيف، لياقة طبية، حد أدنى للعمر 21 عاماً.", en: "General eligibility across products: valid passport (6+ months), proof of financial solvency, clean criminal record, medical fitness, minimum age 21." },
    ],
    note: {
      ar: "تكرر رقما 800,000 و100,000 ريال بشكل متسق عبر مصادر عديدة مؤرخة 2025-2026، بما فيها مصدر أكد أنهما دون تغيير حتى أكتوبر 2025 — لكن لم نتمكن من تحميل صفحة الرسوم الرسمية مباشرة من pr.gov.sa لتأكيد ذلك بشكل كامل في هذا البحث. نظراً للأهمية التجارية، تأكد دائماً من الرسوم الحالية مباشرة مع مركز الإقامة المميزة (pr.gov.sa) أو فريقنا قبل اعتماد العميل على رقم محدد.",
      en: "The SAR 800,000 / SAR 100,000 figures were repeated consistently across many 2025–2026-dated sources including one reporting them as confirmed unchanged as of October 2025 — but no primary pr.gov.sa fee page could be directly loaded in this research to give 100% certainty. Given the commercial stakes, always confirm current fees directly with the Premium Residency Center (pr.gov.sa) or our team before a client relies on a specific figure.",
    },
  },
  {
    id: "transfer-rules",
    nav: { ar: "نقل الكفالة", en: "Transfer rules" },
    h: { ar: "أنظمة نقل الإقامة", en: "Iqama transfer rules" },
    lead: { ar: "تُدار عبر قوى منذ مبادرة إصلاح سوق العمل عام 2021، مع مزيد من التسهيل مُبلّغ عنه حتى 2025.", en: "Managed via Qiwa since the 2021 Labor Reform Initiative, with further easing reported through 2025." },
    items: [
      { ar: "منذ مبادرة 2021، يمكن للعامل عموماً نقل كفالته دون موافقة صاحب العمل الحالي عند انتهاء عقده، أو بعد إتمام 12 شهراً من الخدمة.", en: "Since the 2021 LRI, workers can generally transfer employers without the current employer's consent once their contract ends, or after completing 12 months of service." },
      { ar: "يُسمح أيضاً بالنقل دون موافقة في حال تأخر الرواتب 3 أشهر متتالية فأكثر، أو انتهاء تصريح العمل/الإقامة دون تجديد، أو في حالات النزاعات العمالية الموثقة.", en: "No-consent transfer is also allowed if wages go unpaid for 3+ consecutive months, the work permit/Iqama expires without renewal, or in cases of documented labor disputes." },
      { ar: "العمالة المنزلية والزراعية وعدد قليل من الفئات الأخرى مستثناة من نظام العمل العام وإطار النقل هذا — وتُدار بشكل منفصل عبر منصة مساند، التي تعتمد إجراء نقل بالتراضي بدلاً من ذلك.", en: "Domestic/household workers, agricultural workers, and a handful of other categories are excluded from the general Labor Law and this transfer framework — they're governed separately via the Musaned platform, which uses a mutual-consent transfer process instead." },
      { ar: "تصف تغطية صحفية لعام 2025 تحولاً إضافياً نحو نظام قائم بالكامل على العقد (وصفته عناوين كثيرة بـ\"إنهاء الكفالة\") — ويبدو أن هذا توسّع لإطار التنقل لعام 2021 بشروط أهلية مرحلية، وليس تغييراً فورياً غير مشروط؛ تعامل مع صياغة \"الإلغاء\" في العناوين بحذر.", en: "2025 press coverage describes a further shift toward a fully contract-based system (widely headlined as \"ending kafala\") — this appears to be an expansion of the 2021 mobility framework with phased eligibility conditions, not an instant unconditional change; treat headline \"abolition\" framing with caution." },
    ],
  },
];

const SAUDI_GUIDE_PAGES = [
  ["/saudi-arabia", { ar: "الاستثمار في السعودية", en: "Invest in Saudi" }],
  ["/guide/saudi-market", { ar: "السوق السعودي", en: "The Saudi Market" }],
  ["/guide/business-setup", { ar: "تأسيس الأعمال", en: "Business Setup" }],
  ["/guide/run-your-business", { ar: "تشغيل عملك", en: "Run Your Business" }],
  ["/guide/company-structure", { ar: "الهيكلة والرواتب", en: "Structure & Salaries" }],
  ["/guide/live-in-saudi", { ar: "الحياة في السعودية", en: "Live in Saudi" }],
];

export function buildSimpleGuideResidency(SV1, ctx) {
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

  const body = `${SV1.header("/guide/residency")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-gd-head">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("title"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
      <div class="sv1-gd-acts">
        <a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("consult"))}</a>
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
    path: "/guide/residency",
    body: CSS + body,
  });
}
