// Business Partner — Simple V1: دليل تشغيل عملك (/guide/run-your-business).
// نُقل من طبقة الموقع القديم إلى SV1.shell() تطبيقاً لقاعدة CLAUDE.md §2.6،
// على نمط site/scripts/simple-v1-guide-structure.mjs. المحتوى بلا تغيير —
// انظر التعليق التفصيلي في simple-v1-guide-saudi-market.mjs لمصدر البحث.

import { sellKit } from "./sv1-guide-sell.mjs";

const T = {
  title: { ar: "تشغيل شركتك في السعودية", en: "Operating a company in Saudi Arabia" },
  metaTitle: { ar: "تشغيل عملك في السعودية", en: "Run Your Business in Saudi Arabia" },
  desc: {
    ar: "البوابات الحكومية التي ستتعامل معها يومياً، معدلات الضرائب المؤسسية الفعلية، أنظمة السعودة، وما تغطيه فعلياً وظائف العلاقات الحكومية.",
    en: "The government portals you'll live in, the real corporate tax rates, Saudization rules, and what PRO/GRO functions actually cover.",
  },
  tag: { ar: "دليل السعودية", en: "Saudi Guide" },
  onPage: { ar: "في هذه الصفحة", en: "On this page" },
  consult: { ar: "احجز استشارة", en: "Book a consultation" },
  calc: { ar: "احسب التأمينات الاجتماعية", en: "Calculate GOSI contributions" },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  more: { ar: "تابع استكشاف الدليل", en: "Continue exploring the guide" },
  disclaimer: {
    ar: "الأنظمة والرسوم والبرامج الحكومية تتغيّر بشكل متكرر. هذا الدليل مرجع أولي — تأكد دائماً من الأرقام الحالية عبر البوابة الرسمية أو اسأل فريقنا قبل الاعتماد على رقم محدد.",
    en: "Government rules, fees and programs change often. This guide is a starting reference — always confirm current figures with the official portal or ask our team before relying on a specific number.",
  },
};

const SECTIONS = [
  {
    id: "portals",
    nav: { ar: "البوابات الحكومية", en: "Gov portals" },
    h: { ar: "البوابات الحكومية التي ستستخدمها", en: "The government portals you'll use" },
    lead: { ar: "تسع منصات، كل واحدة تديرها جهة مختلفة، تغطي العمل والهجرة والضرائب والتجارة والتراخيص البلدية والمشتريات والرواتب.", en: "Nine platforms, each run by a different ministry, covering labor, immigration, tax, commerce, municipal licensing, procurement and payroll." },
    items: [
      { ar: "قوى (qiwa.sa) — منصة العمل الموحدة لوزارة الموارد البشرية: تصاريح العمل، العقود الإلكترونية، نقل الموظفين، امتثال السعودة.", en: "Qiwa (qiwa.sa) — HRSD's unified labor platform: work permits, e-contracts, employee transfers, Saudization compliance." },
      { ar: "أبشر (absher.sa) — منصة وزارة الداخلية الوطنية للحكومة الإلكترونية للجوازات والأحوال المدنية والمرور والإقامة.", en: "Absher (absher.sa) — the Ministry of Interior's national e-government platform for passports, civil affairs, traffic and residency." },
      { ar: "مقيم (muqeem.sa) — بوابة موجّهة لأصحاب العمل (تابعة للجوازات) لإدارة معاملات الإقامة والتأشيرات للموظفين.", en: "Muqeem (muqeem.sa) — the employer-facing portal (under Jawazat) for managing employees' Iqama and visa transactions." },
      { ar: "التأمينات الاجتماعية (gosi.gov.sa) — التأمين الاجتماعي: المعاشات، تغطية الأخطار المهنية، والتأمين ضد التعطل (ساند).", en: "GOSI (gosi.gov.sa) — social insurance: pensions, occupational-hazard coverage and unemployment insurance (SANED)." },
      { ar: "هيئة الزكاة والضريبة والجمارك (zatca.gov.sa) — تسجيل الزكاة والضرائب وتقديم الإقرارات والمدفوعات والفوترة الإلكترونية عبر منصة فاتورة.", en: "ZATCA (zatca.gov.sa) — Zakat/tax registration, filing, payments and e-invoicing via the FATOORA platform." },
      { ar: "المركز السعودي للأعمال — نافذة موحدة لإصدار وتعديل السجل التجاري؛ التسجيل هنا يسجّلك تلقائياً لدى الموارد البشرية والزكاة والتأمينات والبريد.", en: "Saudi Business Center — one-stop CR issuance/amendment; registering here auto-registers you with HRSD, ZATCA, GOSI and Saudi Post." },
      { ar: "بلدي (balady.gov.sa) — التراخيص والتصاريح البلدية، تديرها وزارة الشؤون البلدية والقروية والإسكان.", en: "Balady (balady.gov.sa) — municipal permits and licenses, run by the Ministry of Municipal, Rural Affairs and Housing." },
      { ar: "اعتماد (portal.etimad.sa) — المنافسات الحكومية والمشتريات الإلكترونية ومدفوعات الموردين، تديرها وزارة المالية.", en: "Etimad (portal.etimad.sa) — government tenders, e-procurement and supplier payments, run by the Ministry of Finance." },
      { ar: "مدد (mudad.com.sa) — الامتثال لنظام حماية الأجور: تقديم بيانات الرواتب الشهرية بموجب إلزام وزارة الموارد البشرية.", en: "Mudad (mudad.com.sa) — Wage Protection System (WPS) compliance: monthly payroll submission mandated by HRSD." },
    ],
  },
  {
    id: "taxation",
    nav: { ar: "الضرائب", en: "Taxation" },
    h: { ar: "الضرائب المؤسسية في السعودية", en: "Corporate taxation in Saudi Arabia" },
    lead: { ar: "الالتزام الضريبي ينقسم حسب الملكية: الزكاة على الحصة السعودية/الخليجية، وضريبة الدخل على الحصة الأجنبية — وتديرهما هيئة الزكاة والضريبة والجمارك.", en: "Tax liability splits by ownership: Zakat on the Saudi/GCC-owned share, income tax on the foreign-owned share — all administered by ZATCA." },
    items: [
      { ar: "الزكاة: 2.5% من الوعاء الزكوي، على الحصة السعودية/الخليجية من الشركة المقيمة.", en: "Zakat: 2.5% of the Zakat base, on the Saudi/GCC-owned share of a resident company." },
      { ar: "ضريبة الدخل المؤسسي: 20% ثابتة، على الحصة الأجنبية من الشركة المقيمة وعلى غير المقيمين ذوي المنشأة الدائمة في السعودية.", en: "Corporate Income Tax: 20% flat, on the foreign-owned share of a resident company and on non-residents with a Saudi permanent establishment." },
      { ar: "ضريبة القيمة المضافة: 15% نسبة أساسية منذ 1 يوليو 2020؛ التسجيل إلزامي فوق 375,000 ريال من المبيعات الخاضعة سنوياً.", en: "VAT: 15% standard rate since 1 July 2020; mandatory registration above SAR 375,000 annual taxable supplies." },
      { ar: "ضريبة الاستقطاع على المدفوعات لغير المقيمين: يُذكر عادة 5% (الأرباح، الفوائد، الإيجار)، 15% (الإتاوات)، 20% (رسوم الإدارة) — أما رسوم الخدمات الفنية والاستشارية فالنسب المُبلّغ عنها غير متسقة بين المصادر.", en: "Withholding tax on payments to non-residents: commonly cited at 5% (dividends, interest, rent), 15% (royalties), 20% (management fees) — technical/consulting-service rates are reported inconsistently across sources." },
      { ar: "حافز المقر الإقليمي: ضريبة مؤسسية 0% وضريبة استقطاع 0% لمدة 30 عاماً على أنشطة المقر الإقليمي المؤهلة (راجع دليل تأسيس الأعمال).", en: "RHQ tax incentive: 0% corporate tax and 0% withholding tax for 30 years on eligible RHQ activities (see the Business Setup guide)." },
      { ar: "قواعد تسعير التحويل متوافقة مع منظمة التعاون الاقتصادي (الملف الرئيسي، الملف المحلي، تقرير الدولة)؛ ونموذج الإفصاح مستحق خلال 120 يوماً من نهاية السنة المالية.", en: "Transfer pricing rules are OECD-aligned (Master File, Local File, Country-by-Country Report); the disclosure form is due within 120 days of fiscal year-end." },
      { ar: "إقرار الزكاة/ضريبة الدخل السنوي مستحق خلال 120 يوماً من نهاية السنة المالية (مثلاً 30 أبريل للسنة المالية التقويمية القياسية).", en: "Annual Zakat/CIT return due within 120 days of fiscal year-end (e.g. 30 April for a standard calendar year)." },
    ],
    note: {
      ar: "نسبة ضريبة الاستقطاع الدقيقة للخدمات الفنية والاستشارية، وشرائح الضريبة في قطاع النفط، وحدود توثيق تسعير التحويل، جميعها مُبلّغ عنها بشكل غير متسق بين المصادر — تأكد من الأرقام الحالية مع الهيئة أو فريقنا قبل الاعتماد على نسبة محددة.",
      en: "The exact withholding-tax rate for technical/consulting services, oil-sector tax tiers, and transfer-pricing documentation thresholds are reported inconsistently across sources — confirm current figures with ZATCA or our team before relying on a specific rate.",
    },
  },
  {
    id: "saudization",
    nav: { ar: "السعودة", en: "HR & Saudization" },
    h: { ar: "الموارد البشرية والسعودة", en: "HR & Saudization" },
    lead: { ar: "نظام التوطين نطاقات، اشتراكات التأمينات الاجتماعية، حماية الأجور، وأساسيات نظام العمل التي يحتاجها كل صاحب عمل.", en: "The Nitaqat localization system, GOSI contributions, wage protection, and the labor-law basics every employer needs." },
    items: [
      { ar: "نطاقات (تُدار عبر قوى، وزارة الموارد البشرية) تصنّف أصحاب العمل في القطاع الخاص إلى نطاقات لونية — النسخة الحالية تُسمى رسمياً \"نطاقات مطوّر\".", en: "Nitaqat (run via Qiwa, HRSD) assigns private-sector employers to color bands — the current version is officially called \"Nitaqat Mutawar\" (evolved Nitaqat)." },
      { ar: "لا توجد نسبة سعودة موحدة — المتطلبات تختلف حسب القطاع وحجم المنشأة؛ تحقق من متطلب منشأتك الدقيق عبر حاسبة النطاقات في قوى.", en: "There's no single flat Saudization percentage — requirements are sector- and size-specific; check your establishment's exact requirement via Qiwa's Nitaqat calculator." },
      { ar: "التأمينات الاجتماعية: 2% أخطار مهنية (يدفعها صاحب العمل، تشمل السعوديين وغير السعوديين). السعوديون يدفعون أيضاً معاشات وساند (تأمين تعطل) — والنسب في مرحلة انتقالية بموجب نظام تأمينات اجتماعية جديد نافذ منذ يوليو 2025 تقريباً؛ تأكد من النسب الحالية مباشرة مع التأمينات.", en: "GOSI: 2% Occupational Hazards (employer-paid, applies to Saudi and non-Saudi employees). Saudi nationals also pay Annuities/Pension and SANED (unemployment insurance) — rates are mid-transition under a new Social Insurance Law effective ~July 2025; confirm current rates directly with GOSI." },
      { ar: "نظام حماية الأجور عبر مدد: إلزامية دفع الرواتب عبر تحويل بنكي وتقديم بيانات الرواتب الشهرية لأصحاب العمل في القطاع الخاص.", en: "Wage Protection System (WPS) via Mudad: mandatory bank-transferred salary payment and monthly payroll-data submission for private-sector employers." },
      { ar: "فترة التجربة: 90 يوماً افتراضياً، قابلة للتمديد لحد أقصى 180 يوماً باتفاق كتابي (المادة 53 من نظام العمل).", en: "Probation period: 90 days by default, extendable to a maximum of 180 days by written agreement (Labor Law Article 53)." },
      { ar: "فترة الإشعار (بعد التجربة، وفق تعديلات فبراير 2025): 30 يوماً في حال استقالة الموظف، و60 يوماً في حال إنهاء صاحب العمل للعقد.", en: "Notice period (post-probation, per Feb 2025 amendments): 30 days if the employee resigns, 60 days if the employer terminates." },
      { ar: "مكافأة نهاية الخدمة (المادة 84): تُوصف عادة بنصف شهر أجر عن كل سنة من السنوات الخمس الأولى، ثم شهر كامل عن كل سنة بعدها، وتُحتسب تناسبياً للكسور.", en: "End-of-service gratuity (Article 84): commonly described as half a month's wage per year for the first 5 years, then a full month's wage per year beyond that, pro-rated for partial years." },
    ],
  },
  {
    id: "pro-gro",
    nav: { ar: "العلاقات الحكومية", en: "PRO & GRO" },
    h: { ar: "ما الذي تغطيه خدمات PRO وGRO", en: "What PRO & GRO services cover" },
    lead: { ar: "\"PRO\" (مسؤول العلاقات العامة) و\"GRO\" (مسؤول العلاقات الحكومية) مسميات وظيفية معتادة في السوق الخليجي — وليست ألقاباً نظامية — للفريق الذي يتولى أعمالك الإدارية الحكومية المستمرة.", en: "\"PRO\" (Public Relations Officer) and \"GRO\" (Government Relations Officer) are industry-standard function labels across the Gulf — not legally defined titles — for the team that handles your ongoing government-facing admin." },
    items: [
      { ar: "الوظائف الأساسية: معالجة وتجديد التأشيرات والإقامات، إصدار تصاريح العمل، التعامل مع قوى ومقيم وأبشر والتأمينات ومدد، ومتابعة امتثال النطاقات.", en: "Core functions: visa/Iqama processing and renewal, work-permit issuance, navigating Qiwa/Muqeem/Absher/GOSI/Mudad, and Nitaqat compliance monitoring." },
      { ar: "تشمل أيضاً التواصل مع مكتب العمل، وتجديد التراخيص التجارية، والعمل كجهة اتصال يومية مع وزارة الموارد البشرية والداخلية والجهات البلدية.", en: "Also covers labor-office liaison, business/commercial licensing renewals, and acting as the daily point of contact with HRSD/MOI/municipal authorities." },
      { ar: "رسوم مرجعية مُبلّغ عنها: تجديد الإقامة نحو 650 ريال سنوياً؛ رسوم المرافقين نحو 400 ريال شهرياً لكل مرافق — يجب التأكد منها وقت المعاملة لأن الجداول الحكومية للرسوم تتغيّر.", en: "Commonly reported reference fees: Iqama renewal ~SAR 650/year; dependent levy ~SAR 400/month per dependent — both should be confirmed at time of transaction, as government fee schedules change." },
    ],
  },
];

const SAUDI_GUIDE_PAGES = [
  ["/saudi-arabia", { ar: "الاستثمار في السعودية", en: "Invest in Saudi" }],
  ["/guide/saudi-market", { ar: "السوق السعودي", en: "The Saudi Market" }],
  ["/guide/business-setup", { ar: "تأسيس الأعمال", en: "Business Setup" }],
  ["/guide/company-structure", { ar: "الهيكلة والرواتب", en: "Structure & Salaries" }],
  ["/guide/live-in-saudi", { ar: "الحياة في السعودية", en: "Live in Saudi" }],
  ["/guide/residency", { ar: "الإقامة في السعودية", en: "Residency in KSA" }],
];

export function buildSimpleGuideRunBusiness(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e[lang] != null ? e[lang] : e.en);
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const sell = sellKit({ lang, u, esc });

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

  const sectionList = SECTIONS.map((s) => {
    const list = s.items ? `<ul>${s.items.map((i) => `<li>${sell.link(esc(pick(i)))}</li>`).join("")}</ul>` : "";
    const note = s.note ? `<div class="sv1-gd-note">${esc(pick(s.note))}</div>` : "";
    return `<section class="sv1-gd-sec" id="${s.id}"><h2>${esc(pick(s.h))}</h2><p>${sell.link(esc(pick(s.lead)))}</p>${list}${note}</section>`;
  });

  const more = SAUDI_GUIDE_PAGES.map(([p, l]) => `<a href="${esc(u(p))}">${esc(pick(l))} ${lang === "ar" ? "←" : "→"}</a>`).join("");

  const body = `${SV1.header("/guide/run-your-business")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-gd-head">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("title"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
      <div class="sv1-gd-acts">
        <a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("consult"))}</a>
        <a class="sv1-btn" href="${esc(u("/calculators/gosi"))}">${esc(t("calc"))}</a>
      </div>
    </div>
    <nav class="sv1-gd-nav" aria-label="${esc(t("onPage"))}">${nav}</nav>
    ${sell.withMid(sectionList)}
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
    path: "/guide/run-your-business",
    body: CSS + sell.css + body,
  });
}
