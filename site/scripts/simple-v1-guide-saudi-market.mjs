// Business Partner — Simple V1: دليل السوق السعودي (/guide/saudi-market).
//
// نُقل من طبقة الموقع القديم (guideHero/guideBlock في generate.mjs) إلى
// SV1.shell() تطبيقاً لقاعدة «التطوير في الجديد وحده» (CLAUDE.md §2.6)، على
// نمط أول دليل مُنقل (site/scripts/simple-v1-guide-structure.mjs). المحتوى
// نفسه بلا تغيير — بحث WebSearch متعدد الوكلاء (يوليو 2026)؛ الوصول المباشر
// لنطاقات .gov.sa كان محجوباً وقت البحث، فكل رقم مصدره مقتطف WebSearch من
// مصدر رسمي أو مصدر ثانوي موثوق (Big-4/تنبيهات ضريبية من مكاتب محاماة، واس،
// الهيئة العامة للإحصاء، صندوق الاستثمارات العامة، الزكاة والضريبة والجمارك،
// الموارد البشرية). الأرقام غير المؤكدة أو المتضاربة تحمل تنبيهاً صريحاً بدل
// إثباتها كحقيقة قاطعة.
//
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.

import { sellKit } from "./sv1-guide-sell.mjs";

const T = {
  title: { ar: "إلى أين يتجه الاقتصاد السعودي", en: "Where the Saudi economy is heading" },
  metaTitle: { ar: "السوق السعودي", en: "The Saudi Market" },
  desc: {
    ar: "حجم الاقتصاد، مشاريع رؤية 2030 العملاقة، وأعراف ثقافة العمل العملية التي يحتاجها كل مستثمر أجنبي — بمصادر موثقة ومحدّثة دورياً.",
    en: "GDP size, Vision 2030's giga-projects, and the practical culture-and-business norms every foreign company should plan around — sourced and updated regularly.",
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
    id: "economy",
    nav: { ar: "الاقتصاد", en: "The economy" },
    h: { ar: "الاقتصاد السعودي في لمحة", en: "The Saudi economy at a glance" },
    lead: { ar: "أكبر اقتصاد في الشرق الأوسط والعضو العربي الوحيد في مجموعة العشرين — يتنوّع بسرعة بعيداً عن النفط.", en: "The largest economy in the Middle East and the G20's only Arab member — diversifying fast away from oil." },
    items: [
      { ar: "ناتج محلي إجمالي اسمي نحو 1.24–1.25 تريليون دولار (2024) — البنك الدولي / صندوق النقد الدولي.", en: "Nominal GDP of roughly $1.24–1.25 trillion (2024) — World Bank / IMF." },
      { ar: "أعلنت الهيئة العامة للإحصاء نمواً حقيقياً بنسبة 4.5% للناتج المحلي في 2025، مدفوعاً بالأنشطة النفطية وغير النفطية والحكومية.", en: "GASTAT reported 4.5% real GDP growth for full-year 2025, driven by oil, non-oil and government activities." },
      { ar: "بلغت الأنشطة غير النفطية نحو 55% من الناتج المحلي الحقيقي في 2025 بحسب تقارير رؤية 2030 الرسمية.", en: "Non-oil activities reached roughly 55% of real GDP in 2025 per official Vision 2030 reporting." },
      { ar: "التضخم منخفض ومستقر، بين 1.9%–2.3% خلال 2025 (مؤشر أسعار المستهلك من الهيئة العامة للإحصاء).", en: "Inflation has run low and stable, around 1.9%–2.3% through 2025 (GASTAT CPI)." },
      { ar: "ارتفعت تدفقات الاستثمار الأجنبي المباشر 24.2% لتبلغ نحو 119.2 مليار ريال (~31.7 مليار دولار) في 2024 — لا تزال أقل من مستهدف 100 مليار دولار سنوياً بحلول 2030.", en: "FDI inflows rose 24.2% year-on-year to about SAR 119.2 billion (~$31.7B) in 2024 — still below the government's $100B/year 2030 target." },
      { ar: "طُبّقت ضريبة القيمة المضافة 2018 بنسبة 5% ورُفعت إلى 15% منذ 1 يوليو 2020، وتديرها هيئة الزكاة والضريبة والجمارك مع الفوترة الإلكترونية الإلزامية (فاتورة).", en: "VAT introduced in 2018 at 5%, raised to 15% since 1 July 2020, administered by ZATCA with mandatory e-invoicing (FATOORA)." },
      { ar: "بلغت أصول صندوق الاستثمارات العامة نحو 4.54 تريليون ريال (~1.21 تريليون دولار) بنهاية 2025 — وهو الذراع الرئيسية وراء المشاريع العملاقة.", en: "The Public Investment Fund's assets reached roughly SAR 4.54 trillion (~$1.21 trillion) by end-2025 — the primary vehicle behind the giga-projects." },
      { ar: "التصنيفات الائتمانية السيادية حتى 2025: S&P عند A+، وفيتش A+، وموديز Aa3 — بنظرة مستقبلية مستقرة.", en: "Sovereign credit ratings as of 2025: S&P A+, Fitch A+, Moody's Aa3 — all stable/positive outlook." },
      { ar: "ارتفعت مشاركة المرأة في القوى العاملة من ~17% (2017) إلى ~36% (2024/2025)، متجاوزة المستهدف الأصلي البالغ 30% بحلول 2030.", en: "Female labor-force participation rose from ~17% (2017) to ~36% (2024/2025), already exceeding the original 30%-by-2030 target." },
    ],
  },
  {
    id: "giga-projects",
    nav: { ar: "المشاريع العملاقة", en: "Giga-projects" },
    h: { ar: "المشاريع العملاقة", en: "The giga-projects" },
    lead: { ar: "مشاريع بدعم من صندوق الاستثمارات العامة تعيد تشكيل السياحة والعقار والحياة الحضرية. افتُتح بعضها على مراحل خلال 2025-2026؛ وشهد بعضها (خصوصاً نيوم) تغييرات مُعلنة في النطاق — تعامل مع الأرقام الرئيسية على أنها متطورة.", en: "PIF-backed developments reshaping tourism, real estate and urban life. Several have opened in phases through 2025–2026; some (especially NEOM) have seen publicly reported scope changes — treat headline figures as evolving." },
    items: [
      { ar: "نيوم: أُعلن 2017 بقيمة 500 مليار دولار، ويشمل ذا لاين وأوكساجون وتروجينا. تقارير صحفية حديثة تشير لتقليص نطاق \"ذا لاين\" وتأخيرات — تعامل مع الأرقام المُعدّلة المحددة كغير مؤكدة.", en: "NEOM: announced 2017 at $500B, covering THE LINE, Oxagon and Trojena. Recent press reports scope reductions and delays to THE LINE — treat specific revised figures as unconfirmed." },
      { ar: "قدية: مدينة ترفيهية ورياضية بملكية صندوق الاستثمارات العامة قرب الرياض. افتتحت Six Flags قدية سيتي في 31 ديسمبر 2025 (28 لعبة). المستهدفات الرسمية: 48 مليون زائر سنوياً و325,000 وظيفة بحلول 2030.", en: "Qiddiya: PIF-owned entertainment/sports city near Riyadh. Six Flags Qiddiya City opened 31 December 2025 (28 rides). Official targets: 48 million visitors/year and 325,000 jobs by 2030." },
      { ar: "مشروع البحر الأحمر / أمالا (ريد سي جلوبال): سياحة ساحلية فاخرة افتُتحت على مراحل خلال 2025. المستهدفات الرسمية: حتى 9 منتجعات، نحو 50,000 وظيفة، طاقة متجددة 100%.", en: "The Red Sea Project / AMAALA (Red Sea Global): ultra-luxury coastal tourism, opened in phases through 2025. Official targets: up to 9 resorts, ~50,000 jobs, 100% renewable energy." },
      { ar: "بوابة الدرعية: مشروع تراثي وثقافي حول حي الطريف (موقع يونسكو للتراث العالمي). القيمة المعلنة للمخطط الرئيسي نحو 63 مليار دولار؛ حي بجيري للمطاعم يعمل حالياً.", en: "Diriyah Gate: heritage/cultural megaproject around At-Turaif (UNESCO World Heritage Site). Officially cited masterplan value ~$63B; Bujairi Terrace dining district is operational." },
      { ar: "روشن: المطوّر العقاري العملاق لصندوق الاستثمارات العامة (تأسس 2020)، برصيد أراضٍ يتجاوز 200 مليون م². مجتمع سدرة الرائد في الرياض يسلّم الوحدات؛ يدعم مستهدف تملك المساكن 70% ضمن رؤية 2030.", en: "ROSHN: PIF's giga real-estate developer (est. 2020), land bank over 200 million m². Flagship SEDRA community in Riyadh is delivering homes; supports Vision 2030's 70% homeownership target." },
      { ar: "منتزه الملك سلمان: على موقع مطار الرياض المحلي السابق، ويهدف لأن يكون أكبر متنزه حضري في العالم؛ يستهدف رفع المساحات الخضراء في الرياض من 1.5% إلى 9.1%، ومعظمه بحلول 2030.", en: "King Salman Park: on the site of Riyadh's former domestic airport, aiming to be the world's largest urban park; targets Riyadh's green space rising from 1.5% to 9.1%, mostly by 2030." },
      { ar: "نيو مربع: مشروع بمساحة 19 كم² في وسط الرياض (يشمل معلم المكعب). الخطط المعلنة رسمياً: 104,000 وحدة سكنية، 9,000 غرفة فندقية، نحو 400,000 نسمة.", en: "New Murabba: 19 km² downtown Riyadh development (incl. The Mukaab landmark). Officially stated plans: 104,000 residential units, 9,000 hotel rooms, ~400,000 residents." },
    ],
    note: {
      ar: "بعض أرقام التكلفة والجداول الزمنية المتداولة صحفياً لنيو مربع ومنتزه الملك سلمان وقدية (وتقارير مُسرّبة عن نيوم) هي تقديرات سوقية أو تقارير صحفية غير مؤكدة، وليست إفصاحات رسمية من صندوق الاستثمارات العامة — نعرض هنا المستهدفات المعلنة رسمياً فقط ونشير لما عداها كغير مؤكد.",
      en: "Several cost/timeline figures reported in the press for New Murabba, King Salman Park and Qiddiya (and NEOM's leaked cost/timeline) are market estimates or unconfirmed press reports, not official PIF disclosures — we present only the officially stated targets above and flag the rest as unverified.",
    },
  },
  {
    id: "culture-business",
    nav: { ar: "الثقافة والأعمال", en: "Culture & business" },
    h: { ar: "أعراف العمل وأسبوع الدوام", en: "Business etiquette & the working week" },
    lead: { ar: "أعراف عملية لأي شركة أجنبية تدير عملها يومياً في السعودية.", en: "Practical norms for a foreign company operating day-to-day in Saudi Arabia." },
    items: [
      { ar: "أسبوع العمل من الأحد إلى الخميس، وعطلة نهاية الأسبوع الجمعة والسبت — بموجب أمر ملكي منذ يونيو 2013 لمواءمة الأسواق العالمية.", en: "The working week is Sunday–Thursday, Friday–Saturday weekend — set by royal order since June 2013 to align with global markets." },
      { ar: "ساعات العمل النظامية 8 ساعات يومياً أو 48 ساعة أسبوعياً بموجب نظام العمل السعودي.", en: "Standard working hours are 8 hours/day or 48 hours/week under Saudi Labor Law." },
      { ar: "خلال رمضان، ساعات العمل للموظفين المسلمين الصائمين محددة نظاماً بـ6 ساعات يومياً (36 ساعة أسبوعياً) — المادة 98 من نظام العمل.", en: "During Ramadan, working hours for fasting Muslim employees are legally capped at 6 hours/day (36 hours/week) — Labor Law Article 98." },
      { ar: "أهم الإجازات الرسمية المؤثرة على الأعمال: يوم التأسيس (22 فبراير)، اليوم الوطني السعودي (23 سبتمبر)، وعيدا الفطر والأضحى (بحسب التقويم الهجري).", en: "Key public holidays affecting business: Founding Day (22 Feb), Saudi National Day (23 Sep), and Eid al-Fitr / Eid al-Adha (dates set by the Hijri calendar)." },
      { ar: "قيود اختلاط الجنسين في أماكن العمل تراجعت بشكل ملحوظ منذ 2017؛ وتعديلات نظام العمل 2024/2025 تحظر صراحة التمييز الوظيفي القائم على الجنس.", en: "Gender-mixing restrictions in workplaces have relaxed considerably since 2017; 2024/2025 Labor Law amendments explicitly prohibit gender-based employment discrimination." },
      { ar: "العربية هي اللغة الرسمية ومطلوبة نظاماً في العقود والتعاملات التجارية؛ والإنجليزية مستخدمة بشكل واسع جداً في بيئة الأعمال.", en: "Arabic is the official language and legally required in contracts and commercial dealings; English is very widely used in business settings." },
    ],
  },
];

const SAUDI_GUIDE_PAGES = [
  ["/saudi-arabia", { ar: "الاستثمار في السعودية", en: "Invest in Saudi" }],
  ["/guide/business-setup", { ar: "تأسيس الأعمال", en: "Business Setup" }],
  ["/guide/run-your-business", { ar: "تشغيل عملك", en: "Run Your Business" }],
  ["/guide/company-structure", { ar: "الهيكلة والرواتب", en: "Structure & Salaries" }],
  ["/guide/live-in-saudi", { ar: "الحياة في السعودية", en: "Live in Saudi" }],
  ["/guide/residency", { ar: "الإقامة في السعودية", en: "Residency in KSA" }],
];

export function buildSimpleGuideSaudiMarket(SV1, ctx) {
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

  const body = `${SV1.header("/guide/saudi-market")}
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
    path: "/guide/saudi-market",
    body: CSS + sell.css + body,
  });
}
