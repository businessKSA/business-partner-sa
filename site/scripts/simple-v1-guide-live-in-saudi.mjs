// Business Partner — Simple V1: دليل الحياة في السعودية (/guide/live-in-saudi).
// نُقل من طبقة الموقع القديم إلى SV1.shell() تطبيقاً لقاعدة CLAUDE.md §2.6،
// على نمط site/scripts/simple-v1-guide-structure.mjs. المحتوى بلا تغيير —
// انظر التعليق التفصيلي في simple-v1-guide-saudi-market.mjs لمصدر البحث.

const T = {
  title: { ar: "نقل فريقك للعيش في السعودية", en: "Relocating your team to Saudi Arabia" },
  metaTitle: { ar: "الحياة في السعودية", en: "Live in Saudi Arabia" },
  desc: {
    ar: "ما يحتاج معرفته المسؤولون والموظفون المنتقلون مع شركتك — نمط الحياة، التعليم، الرعاية الصحية، والقيادة.",
    en: "What executives and staff relocating with your company need to know — lifestyle, schools, healthcare and driving.",
  },
  tag: { ar: "دليل السعودية", en: "Saudi Guide" },
  onPage: { ar: "في هذه الصفحة", en: "On this page" },
  consult: { ar: "احجز استشارة", en: "Book a consultation" },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  more: { ar: "تابع استكشاف الدليل", en: "Continue exploring the guide" },
  fullResidency: { ar: "اقرأ دليل الإقامة الكامل ←", en: "Read the full Residency guide →" },
  disclaimer: {
    ar: "الأنظمة والرسوم والبرامج الحكومية تتغيّر بشكل متكرر. هذا الدليل مرجع أولي — تأكد دائماً من الأرقام الحالية عبر البوابة الرسمية أو اسأل فريقنا قبل الاعتماد على رقم محدد.",
    en: "Government rules, fees and programs change often. This guide is a starting reference — always confirm current figures with the official portal or ask our team before relying on a specific number.",
  },
};

const SECTIONS = [
  {
    id: "lifestyle",
    nav: { ar: "نمط الحياة", en: "Lifestyle" },
    h: { ar: "نمط الحياة للمقيمين الأجانب", en: "Saudi lifestyle for expats" },
    lead: { ar: "تحرر اجتماعي وترفيهي كبير منذ 2016 أعاد تشكيل الحياة اليومية للمقيمين الأجانب.", en: "Significant social and entertainment liberalization since 2016 has reshaped daily life for foreign residents." },
    items: [
      { ar: "أُعيد افتتاح دور السينما في 2018 بعد حظر دام 35 عاماً؛ وتُرخّص الهيئة العامة للترفيه (تأسست 2016) الحفلات والمهرجانات والفعاليات الحية في أنحاء المملكة.", en: "Cinemas reopened in 2018 after a 35-year ban; the General Entertainment Authority (est. 2016) now licenses concerts, festivals and live events nationwide." },
      { ar: "أُطلقت تأشيرة السياحة الإلكترونية في سبتمبر 2019 — تأشيرة متعددة الدخول لمدة سنة لنحو 66 جنسية مؤهلة، مع تأشيرة عند الوصول لحاملي تأشيرات أمريكية/بريطانية/شنغن سارية.", en: "The tourist e-visa launched September 2019 — a one-year multiple-entry visa for ~66 eligible nationalities, plus visa-on-arrival for valid US/UK/Schengen visa holders." },
      { ar: "أُلغي إلزام العباءة وتغطية الرأس للنساء الأجنبيات في سبتمبر 2019؛ ويُتوقع \"الزي المحتشم\" عموماً بدلاً من ذلك.", en: "The abaya/headscarf requirement for foreign women was lifted in September 2019; \"modest dress\" is the general expectation instead." },
      { ar: "تكلفة المعيشة: صنّف مؤشر ميرسر لعام 2024 الرياض في المرتبة 90 وجدة في المرتبة 97 عالمياً (من أصل 226 مدينة) — وكلتاهما أرخص من دبي (المرتبة 15).", en: "Cost of living: Mercer's 2024 ranking placed Riyadh 90th and Jeddah 97th globally (out of 226 cities) — both cheaper than Dubai (15th)." },
      { ar: "أهم تجمعات المقيمين الأجانب: الرياض (العاصمة، أكبر تجمع للمقيمين)، جدة (بوابة تجارية على البحر الأحمر)، والمنطقة الشرقية (الدمام والخبر والظهران — مركز صناعة النفط وأقدم تجمع غربي مستقر في المملكة).", en: "Major expat hubs: Riyadh (capital, largest expat population), Jeddah (commercial/Red Sea gateway), and the Eastern Province (Dammam/Khobar/Dhahran — the oil-industry hub with the Kingdom's longest-established Western expat community)." },
    ],
  },
  {
    id: "education",
    nav: { ar: "التعليم", en: "Education" },
    h: { ar: "التعليم لعائلات المقيمين", en: "Schooling for expat families" },
    lead: { ar: "عادة ما تُلحق عائلات المقيمين أبناءها بمدارس دولية مدفوعة بدلاً من النظام الحكومي المجاني الناطق بالعربية.", en: "Expat families typically enroll children in fee-paying international schools rather than the free Arabic-medium public system." },
    items: [
      { ar: "وزارة التعليم تُرخّص وتُشرف على جميع المدارس الدولية والأهلية العاملة في المملكة.", en: "The Ministry of Education licenses and supervises all international and private schools operating in the Kingdom." },
      { ar: "تستضيف الرياض وجدة والخبر مدارس تقدّم مناهج بريطانية وأمريكية والبكالوريا الدولية ومناهج وطنية أخرى — نتجنب ذكر عدد دقيق للمدارس لعدم وجود رقم رسمي موثّق واحد.", en: "Riyadh, Jeddah and Al Khobar host schools offering British, American, IB and other national curricula — avoid citing a precise school count, as no single authoritative figure was found." },
      { ar: "يتطلب التسجيل المدرسي إقامة سارية لكل من الطالب وولي الأمر؛ ويؤهل المرافقون دون 18 عاماً للإقامة العائلية.", en: "School enrollment requires a valid Iqama for both the student and guardian; dependents under 18 qualify for family-sponsored residency." },
      { ar: "امتد العام الدراسي 2025-2026 من 24 أغسطس 2025 إلى 25 يونيو 2026 وفق نظام فصلين دراسيين (تحدد كثير من المدارس الدولية تواريخها الخاصة — تأكد دائماً مع المدرسة تحديداً).", en: "The 2025–2026 academic year ran 24 August 2025 – 25 June 2026 under a two-semester calendar (many international schools set their own dates — always confirm with the specific school)." },
    ],
  },
  {
    id: "healthcare",
    nav: { ar: "الرعاية الصحية", en: "Healthcare" },
    h: { ar: "الرعاية الصحية للمقيمين وأصحاب العمل", en: "Healthcare for expats & employers" },
    lead: { ar: "نظام مزدوج: رعاية عامة مدعومة للمواطنين، وتأمين خاص إلزامي من صاحب العمل للعمالة الوافدة.", en: "A dual system: subsidized public care for citizens, and mandatory employer-provided private insurance for expatriate workers." },
    items: [
      { ar: "مجلس الضمان الصحي التعاوني ينظّم التأمين الصحي ويحدد الحد الأدنى الإلزامي للتغطية.", en: "The Council of Cooperative Health Insurance (CCHI) regulates health insurance and sets the mandatory minimum benefits package." },
      { ar: "كل صاحب عمل في القطاع الخاص ملزم بتوفير تأمين صحي معتمد من مجلس الضمان الصحي للموظفين الوافدين، على نفقة صاحب العمل.", en: "Every private-sector employer must provide CCHI-approved health insurance for expatriate employees, at the employer's cost." },
      { ar: "التغطية تشمل عموماً المرافقين النظاميين (الزوجة، الأبناء دون 25 عاماً، البنات غير المتزوجات وغير العاملات).", en: "Coverage generally extends to legal dependents (spouse, sons under 25, unmarried/unemployed daughters)." },
      { ar: "منذ أواخر 2025، يُذكر أن التأمين الصحي بات مطلوباً قبل إصدار تأشيرة العمل، مع تحقق الجوازات من التغطية قبل إصدار أو تجديد الإقامة — تشديد إجرائي حديث نسبياً يستحق التأكد منه قرب موعد انتقالك.", en: "Since late 2025, health insurance reportedly must be secured before a work visa is issued, with Jawazat checking coverage before Iqama issuance/renewal — a relatively recent procedural tightening worth reconfirming close to your relocation date." },
      { ar: "لا يستطيع المقيمون الأجانب عموماً الوصول للرعاية الصحية الحكومية المدعومة إلا في الحالات الطارئة المهددة للحياة؛ وتمر رعايتهم الصحية عملياً عبر التأمين الخاص المموّل من صاحب العمل.", en: "Expats generally cannot access subsidized public healthcare except in life-threatening emergencies; virtually all expat healthcare runs through private, employer-sponsored insurance." },
    ],
  },
  {
    id: "driving",
    nav: { ar: "القيادة", en: "Driving" },
    h: { ar: "القيادة في السعودية", en: "Driving in Saudi Arabia" },
    lead: { ar: "تتطلب رخصة القيادة السعودية إقامة سارية؛ وتعتمد الإجراءات بشكل كبير على الدولة التي أصدرت رخصتك الحالية.", en: "A Saudi driving license requires a valid Iqama; the process depends heavily on which country issued your existing license." },
    items: [
      { ar: "الأهلية: إقامة سارية، حد أدنى للعمر 18 عاماً لرخصة المركبة الخاصة (21 فأكثر للقيادة المهنية/العامة)، إضافة لفحص طبي وبصري.", en: "Eligibility: valid Iqama, minimum age 18 for a private-vehicle license (21+ for professional/public driving), plus a medical/vision exam." },
      { ar: "يمكن عموماً تحويل رخص دول مجلس التعاون الخليجي مباشرة؛ ولدى عدد من الدول الأخرى اتفاقيات تبادل متبادلة — تتغيّر هذه القائمة المعتمدة بشكل دوري، لذا تأكد دائماً من الأهلية الحالية عبر أبشر قبل نقل الموظفين.", en: "GCC-country licenses can generally be converted directly; a number of other countries have reciprocal exchange agreements — this approved list changes periodically, so always verify current eligibility on Absher before relocating staff." },
      { ar: "أصبحت قيادة المرأة قانونية منذ 24 يونيو 2018، بعد مرسوم ملكي صدر في سبتمبر 2017 — دون الحاجة لإذن ولي أمر ذكر.", en: "Women driving has been legal since 24 June 2018, following a royal decree issued September 2017 — no male-guardian permission is required." },
      { ar: "أبشر (وزارة الداخلية) هي القناة لحجز مواعيد الاختبار، وإصدار وتجديد الرخصة، والتحقق من المخالفات المرورية القائمة.", en: "Absher (Ministry of Interior) is the channel for booking test appointments, license issuance/renewal, and checking outstanding traffic violations." },
    ],
  },
  {
    id: "residency-preview",
    nav: { ar: "الإقامة", en: "Residency" },
    h: { ar: "خيارات الإقامة — النسخة المختصرة", en: "Residency options — the short version" },
    lead: { ar: "الإقامة المسندة من صاحب العمل تغطي معظم الموظفين؛ والإقامة المميزة تتيح للأفراد المؤهلين العيش في السعودية دون كفيل. التفاصيل الكاملة — بما فيها الرسوم الحالية وإصلاحات تنقل العمالة لعام 2021 — في دليل الإقامة المخصص لدينا.", en: "Employer-sponsored Iqamas cover most staff; Premium Residency lets qualifying individuals live in Saudi Arabia without a sponsor. Full detail — including current fee figures and the 2021 labor-mobility reforms — is on our dedicated Residency guide." },
    items: [
      { ar: "الإقامة النظامية: تصريح الإقامة المسند من صاحب العمل، مرتبط بعقد العمل، وتُدار عبر مقيم وأبشر.", en: "Standard Iqama: the employer-sponsored residence permit, tied to your work contract, managed via Muqeem/Absher." },
      { ar: "الإقامة المميزة (pr.gov.sa): إقامة ذاتية الكفالة — دون الحاجة لكفيل سعودي — بمنتجات تتراوح بين المستويات الرئيسية الدائمة والمتجددة ومسارات فئوية أحدث (المواهب، المستثمرين، رواد الأعمال، ملّاك العقار).", en: "Premium Residency (pr.gov.sa): self-sponsored status — no Saudi kafeel required — with products ranging from the flagship permanent/renewable tiers to newer category-specific tracks (talent, investor, entrepreneur, real-estate owner)." },
    ],
  },
];

const SAUDI_GUIDE_PAGES = [
  ["/saudi-arabia", { ar: "الاستثمار في السعودية", en: "Invest in Saudi" }],
  ["/guide/saudi-market", { ar: "السوق السعودي", en: "The Saudi Market" }],
  ["/guide/business-setup", { ar: "تأسيس الأعمال", en: "Business Setup" }],
  ["/guide/run-your-business", { ar: "تشغيل عملك", en: "Run Your Business" }],
  ["/guide/company-structure", { ar: "الهيكلة والرواتب", en: "Structure & Salaries" }],
  ["/guide/residency", { ar: "الإقامة في السعودية", en: "Residency in KSA" }],
];

export function buildSimpleGuideLiveInSaudi(SV1, ctx) {
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

  const body = `${SV1.header("/guide/live-in-saudi")}
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
    <div style="text-align:center;margin:0 0 14px"><a class="sv1-btn primary" href="${esc(u("/guide/residency"))}">${esc(t("fullResidency"))}</a></div>
    <div class="sv1-gd-note" style="margin:8px 0 34px">${esc(t("disclaimer"))}</div>
    <h2 style="font-size:19px;font-weight:400;color:var(--ink);margin:0 0 12px">${esc(t("more"))}</h2>
    <div class="sv1-gd-more">${more}</div>
    <div style="text-align:center;margin-top:34px"><a class="sv1-btn primary" href="${esc(u("/"))}">${esc(t("start"))}</a></div>
  </div></section>
  </main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${t("metaTitle")} — Business Partner`,
    desc: t("desc"),
    path: "/guide/live-in-saudi",
    body: CSS + body,
  });
}
