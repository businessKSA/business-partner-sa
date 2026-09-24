// Business Partner — Simple V1: دليل الهيكلة والرواتب (/guide/company-structure).
//
// أول دليل على الموقع الجديد. نُشر أولاً (a38373b0) عبر guideBlock في
// generate.mjs — أي على طبقة الموقع القديم (main.js والترويسة القديمة) — وهو ما
// تمنعه قاعدة «التطوير في الجديد وحده» (CLAUDE.md §2.6). فنُقل هنا إلى
// SV1.shell() بترويسة الموقع الجديد وتذييله.
//
// المحتوى يحمل ما لا يغطيه دليل آخر فقط؛ أنواع الكيانات وخطوات التأسيس
// وأساسيات نظام العمل في business-setup و run-your-business ويُحال إليها.
// الرواتب تقديرات إرشادية لا مسح، وكل رقم حكومي يحيل إلى تنبيهات
// run-your-business بدل أن يثبّت نسبة انتقالية (قاعدة CLAUDE.md §4).
//
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.

const T = {
  title: { ar: "هيكلة فريقك ورواتبه في السعودية", en: "Structuring your team and payroll in Saudi Arabia" },
  metaTitle: { ar: "الهيكلة التنظيمية والرواتب وتكلفة الموظف في السعودية", en: "Team Structure, Salaries & Employee Cost in Saudi Arabia" },
  desc: {
    ar: "كيف تصمم هيكلاً تنظيمياً يكبر مع شركتك، وتبني سلم رواتب بالممارسة العالمية، وتقرأ نطاقات الرواتب الإرشادية حسب القطاع، وتحسب التكلفة الحقيقية للموظف.",
    en: "How to design an org chart that scales, build a pay scale by international practice, read indicative salary ranges by sector, and calculate what an employee really costs you.",
  },
  tag: { ar: "دليل السعودية", en: "Saudi Guide" },
  onPage: { ar: "في هذه الصفحة", en: "On this page" },
  consult: { ar: "احجز استشارة", en: "Book a consultation" },
  calc: { ar: "احسب تكاليفك الحكومية", en: "Calculate your government costs" },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  sector: { ar: "القطاع — الدور", en: "Sector — role" },
  entry: { ar: "مبتدئ", en: "Entry" },
  mid: { ar: "متوسط الخبرة", en: "Mid-level" },
  senior: { ar: "خبير / قيادي", en: "Senior / lead" },
  sar: { ar: "ريال شهرياً، إجمالي", en: "SAR per month, gross" },
  more: { ar: "تابع استكشاف الدليل", en: "Continue exploring the guide" },
  disclaimer: {
    ar: "الأنظمة والرسوم والبرامج الحكومية تتغيّر بشكل متكرر. هذا الدليل مرجع أولي — تأكد دائماً من الأرقام الحالية عبر البوابة الرسمية أو اسأل فريقنا قبل الاعتماد على رقم محدد.",
    en: "Government rules, fees and programs change often. This guide is a starting reference — always confirm current figures with the official portal or ask our team before relying on a specific number.",
  },
};

const SECTIONS = [
  {
    id: "org-structure",
    nav: { ar: "الهيكل التنظيمي", en: "Org structure" },
    h: { ar: "الهرم الإداري القياسي — وأي هيكل يناسبك", en: "The standard corporate hierarchy — and which structure fits you" },
    lead: { ar: "أغلب الشركات تتبع سلسلة الصلاحيات نفسها؛ ما يختلف هو طريقة تجميع الإدارات تحتها.", en: "Most companies follow the same chain of authority; what differs is how departments are grouped underneath it." },
    items: [
      { ar: "السلسلة: الشركاء / الجمعية العامة ← مجلس الإدارة (مع لجنتي المراجعة والمكافآت) ← الرئيس التنفيذي ← الإدارة التنفيذية (المالية، العمليات، التقنية، الموارد البشرية، التسويق) ← مديرو الإدارات ← رؤساء الأقسام ← المشرفون ← الموظفون.", en: "The chain: shareholders / general assembly → board of directors (with audit and remuneration committees) → CEO → C-suite (CFO, COO, CTO, CHRO, CMO) → directors → managers → supervisors → staff." },
      { ar: "الهيكل الوظيفي (إدارات حسب التخصص): الأنسب للشركات الصغيرة والمتوسطة ذات منتج أو خدمة رئيسية واحدة.", en: "Functional (departments by specialty): best for small and mid-size companies with one main product or service." },
      { ar: "الهيكل القطاعي (وحدات مستقلة حسب المنتج أو المنطقة): يناسب الشركات متعددة المنتجات أو الفروع في أكثر من مدينة.", en: "Divisional (self-contained units by product or region): suits companies with several product lines or branches in several cities." },
      { ar: "الهيكل المصفوفي (الموظف يتبع مديراً وظيفياً ومدير مشروع معاً): شائع في المقاولات والاستشارات — حدّد الأولويات كتابياً لتفادي تعارض التبعية.", en: "Matrix (staff report to a functional and a project manager): common in contracting and consulting — put priorities in writing to avoid dual-reporting conflicts." },
      { ar: "الهيكل المسطّح (طبقات قليلة وصلاحيات واسعة): يصلح للشركات الناشئة حتى نحو 50 موظفاً — أضف طبقة إشراف قبل أن ينهار.", en: "Flat (few layers, wide autonomy): works for startups up to roughly 50 people — add a supervisory layer before it breaks." },
      { ar: "قواعد تصميم عملية: 5–8 مرؤوسين مباشرين لكل مدير، ولا تزيد الطبقات بين الرئيس التنفيذي والموظف التنفيذي عن 4–5 في الشركة المتوسطة، ووصف وظيفي ومصفوفة صلاحيات (RACI) لكل دور.", en: "Rules of thumb: 5–8 direct reports per manager, no more than 4–5 layers from CEO to front line in a mid-size company, and a job description plus a RACI matrix for every role." },
    ],
  },
  {
    id: "team-by-stage",
    nav: { ar: "الفريق حسب المرحلة", en: "Team by stage" },
    h: { ar: "شكل فريقك في كل مرحلة نمو", en: "What your team should look like at each stage" },
    lead: { ar: "عيّن الوظائف المساندة بالترتيب الذي يحمي تراخيصك ونطاقك في نطاقات أولاً.", en: "Hire support functions in the order that protects your licenses and your Nitaqat band first." },
    items: [
      { ar: "1–10 موظفين: هيكل مسطّح يرفع للمؤسس؛ مسؤول عمليات ومسؤول مبيعات؛ والمحاسبة والموارد البشرية والعلاقات الحكومية بالإسناد الخارجي.", en: "1–10 people: flat, reporting to the founder; one operations lead, one sales lead; outsource accounting, HR and government relations." },
      { ar: "10–49 موظفاً: أول طبقة إشرافية؛ عيّن محاسباً داخلياً وأخصائي موارد بشرية سعودياً مبكراً — يغطيان وظائف خاضعة للتوطين ويرفعان نطاقك معاً.", en: "10–49: first supervisory layer; hire an in-house accountant and a Saudi HR specialist early — both cover localized roles and lift your band at once." },
      { ar: "50–249 موظفاً: هيكل وظيفي كامل بثلاث طبقات ولائحة تنظيم عمل داخلية معتمدة من وزارة الموارد البشرية.", en: "50–249: a full three-layer functional structure and internal work regulations approved by HRSD." },
      { ar: "250 فأكثر: مجلس إدارة بلجنتي مراجعة ومكافآت، وإدارة تنفيذية كاملة، ومراجعة داخلية وامتثال مستقلان، ووحدات أعمال حسب المنتج أو المنطقة.", en: "250+: a board with audit and remuneration committees, a full C-suite, independent internal audit and compliance, and business units by product or region." },
    ],
  },
  {
    id: "pay-scale",
    nav: { ar: "سلم الرواتب", en: "Pay scale" },
    h: { ar: "بناء سلم رواتب بالطريقة المعتمدة عالمياً", en: "Building a pay scale the way international companies do" },
    lead: { ar: "سلم الرواتب يحوّل قرارات الأجور من تفاوض إلى سياسة — ويجعل توظيف السعوديين قابلاً للتخطيط.", en: "A pay scale turns salary decisions from negotiation into policy — and makes Saudization hiring predictable." },
    items: [
      { ar: "من 10 إلى 15 درجة، لكل درجة حد أدنى ووسط وحد أعلى (عادة ±20% حول الوسط) وتداخل 20–30% بين الدرجات المتتالية.", en: "10–15 grades, each with a minimum, midpoint and maximum (typically ±20% around the midpoint) and 20–30% overlap between neighboring grades." },
      { ar: "قيّم الوظيفة قبل تسعيرها: زن كل دور بالمعرفة وحل المشكلات والمسؤولية (منهجيات النقاط مثل Hay/Korn Ferry أو Mercer IPE).", en: "Evaluate before you price: weight each role by knowledge, problem-solving and accountability (point-factor methods such as Hay/Korn Ferry or Mercer IPE)." },
      { ar: "استهدف الوسيط السوقي (P50) لأغلب الوظائف، والشريحة 75 (P75) للوظائف النادرة الحرجة.", en: "Target the market median (P50) for most roles and the 75th percentile (P75) for scarce, critical roles." },
      { ar: "مؤشر Compa-Ratio (الراتب ÷ وسط الدرجة): أبقه بين 0.80 و1.20 — أقل من 0.80 خطر تسرّب، وأعلى من 1.20 تضخّم أجري.", en: "Compa-ratio (salary ÷ grade midpoint): keep it between 0.80 and 1.20 — below is a flight risk, above is pay inflation." },
      { ar: "تُرصد الزيادات السنوية عادة بين 3–6%، والترقية تعني غالباً درجة جديدة وزيادة 10–15%.", en: "Annual increases are commonly budgeted at 3–6%; a promotion usually means a new grade and a 10–15% raise." },
      { ar: "للموظفين السعوديين اجعل أدنى الدرجات 4,000 ريال فأكثر: دون ذلك لا يُحتسب الموظف موظفاً كاملاً في نطاقات.", en: "For Saudi hires, set the grade floor at SAR 4,000 or above: below that a Saudi employee is not counted as a full employee in Nitaqat." },
    ],
    note: { ar: "حدود الاحتساب في نطاقات تحددها وزارة الموارد البشرية وقد تتغيّر — تحقق من القاعدة الحالية لنشاطك في قوى قبل تثبيت أدنى الدرجات.", en: "Nitaqat counting thresholds are set by HRSD and can change — confirm the current rule for your activity in Qiwa before fixing your grade floor." },
  },
  {
    id: "salaries",
    nav: { ar: "الرواتب حسب القطاع", en: "Salaries by sector" },
    h: { ar: "نطاقات الرواتب الشهرية الإرشادية حسب القطاع", en: "Indicative monthly salary ranges by sector" },
    lead: { ar: "استخدمها لاختبار منطقية الميزانية، لا لتحديد عرض وظيفي بعينه.", en: "Use them to sanity-check a budget, not to set a specific offer." },
    rows: [
      [{ ar: "التقنية — مطور برمجيات", en: "Technology — software developer" }, "7,000–12,000", "13,000–20,000", "22,000–35,000"],
      [{ ar: "المالية — محاسب", en: "Finance — accountant" }, "6,000–9,000", "10,000–16,000", "17,000–25,000"],
      [{ ar: "الموارد البشرية — أخصائي", en: "HR — specialist" }, "5,500–8,500", "9,000–14,000", "15,000–22,000"],
      [{ ar: "المبيعات — تنفيذي مبيعات (مع عمولة)", en: "Sales — executive (plus commission)" }, "5,000–8,000", "9,000–14,000", "15,000–22,000"],
      [{ ar: "التجزئة — بائع ← مدير فرع", en: "Retail — associate → branch manager" }, "4,000–6,000", "6,000–9,000", "10,000–20,000"],
      [{ ar: "المطاعم — خدمة ← مدير مطعم", en: "F&B — service → restaurant manager" }, "4,000–5,500", "5,000–13,000", "10,000–22,000"],
      [{ ar: "الإنشاءات — مهندس موقع", en: "Construction — site engineer" }, "8,000–12,000", "12,000–18,000", "18,000–28,000"],
      [{ ar: "الرعاية الصحية — ممرض", en: "Healthcare — nurse" }, "7,000–11,000", "11,000–16,000", "16,000–22,000"],
      [{ ar: "اللوجستيات — مشتريات وسلاسل إمداد", en: "Logistics — procurement / supply chain" }, "7,000–10,000", "11,000–17,000", "18,000–26,000"],
      [{ ar: "الإدارة — استقبال ← مدير مكتب", en: "Administration — reception → office manager" }, "4,000–6,500", "6,000–13,000", "12,000–35,000"],
    ],
    note: { ar: "هذه النطاقات تقديرات إرشادية وليست نتائج مسح رواتب. الأجور تختلف حسب المدينة والجنسية وحجم الشركة وندرة المهارة — قارن بمسح رواتب حديث قبل تقديم أي عرض.", en: "These ranges are indicative estimates, not results of a salary survey. Pay varies by city, nationality, company size and scarcity of the skill — benchmark against a current salary survey before making an offer." },
  },
  {
    id: "employee-cost",
    nav: { ar: "التكلفة الفعلية", en: "True employee cost" },
    h: { ar: "كم يكلّفك الموظف فعلاً", en: "What an employee really costs you" },
    lead: { ar: "الراتب هو البداية فقط: الراتب الإجمالي + التأمينات + التأمين الطبي + الرسوم الحكومية (للوافدين) + مخصص نهاية الخدمة + مخصص الإجازات.", en: "Salary is only the start: gross salary + social insurance + medical insurance + government fees (for expats) + end-of-service accrual + leave accrual." },
    items: [
      { ar: "التأمينات الاجتماعية: 2% أخطار مهنية لكل موظف؛ وللموظف السعودي يدفع صاحب العمل أيضاً حصته من المعاشات وساند على الأساسي وبدل السكن — راجع دليل «تشغيل عملك» للمرحلة الانتقالية الحالية.", en: "GOSI: 2% occupational hazards for every employee; for Saudi employees the employer also pays its share of annuities and SANED on basic plus housing — see the Run Your Business guide for the current transition." },
      { ar: "التأمين الطبي إلزامي لكل موظف في القطاع الخاص ولمرافقي الوافد المقيمين، بموجب نظام مجلس الضمان الصحي.", en: "Medical insurance is mandatory for every private-sector employee and for expats' resident dependents, under the Council of Health Insurance." },
      { ar: "الوافد يضيف: المقابل المالي الشهري، ورخصة العمل وتجديد الإقامة سنوياً، وتكاليف الاستقدام التي لا يجوز تحميلها على العامل.", en: "Expats add the monthly levy, the annual work permit and Iqama renewal, and recruitment costs that cannot be charged to the worker." },
      { ar: "مخصص نهاية الخدمة: نصف شهر عن كل سنة من الخمس الأولى، وشهر كامل عن كل سنة بعدها — ادّخره شهرياً بدل أن تدفعه مفاجأة.", en: "End-of-service accrual: half a month per year for the first five years, a full month per year after — set it aside monthly." },
      { ar: "قاعدة سريعة: الموظف السعودي يكلّف نحو 1.15–1.20 من راتبه الإجمالي، والوافد نحو 1.30–1.50 — وكلما انخفض راتب الوافد زادت نسبة الرسوم الثابتة من تكلفته.", en: "Rule of thumb: a Saudi employee costs about 1.15–1.20× gross salary, an expat about 1.30–1.50× — the lower the expat salary, the larger the share of fixed fees." },
    ],
    note: { ar: "قيمة المقابل المالي ورسوم رخصة العمل ونسب التأمينات تحددها قرارات حكومية وتتغيّر — تحقق من كل رقم وقت التوظيف.", en: "Levy amounts, work-permit fees and GOSI rates are set by government decisions and change — confirm each figure at the time of hiring." },
  },
];

const MORE = [
  ["/guide/business-setup", { ar: "تأسيس الأعمال", en: "Business Setup" }],
  ["/guide/run-your-business", { ar: "تشغيل عملك", en: "Run Your Business" }],
  ["/guide/residency", { ar: "الإقامة في السعودية", en: "Residency in KSA" }],
  ["/calculators/government-cost", { ar: "حاسبة التكاليف الحكومية", en: "Government cost calculator" }],
];

export function buildSimpleGuideStructure(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e[lang] != null ? e[lang] : e.en);
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  const CSS = `<style id="sv1-guide-css">
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
.sv1-gd-tbl{overflow-x:auto;border:1px solid var(--l);border-radius:10px}
.sv1-gd-tbl table{width:100%;border-collapse:collapse;min-width:560px;font-size:13.5px}
.sv1-gd-tbl th,.sv1-gd-tbl td{padding:10px 12px;text-align:start;border-bottom:1px solid var(--line2);white-space:nowrap}
.sv1-gd-tbl th{background:var(--g);color:var(--ink);font-weight:500;font-size:12.5px}
.sv1-gd-tbl td:first-child{white-space:normal;color:var(--ink)}
.sv1-gd-tbl tr:last-child td{border-bottom:0}
.sv1-gd-more{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sv1-gd-more a{background:#fff;border:1px solid var(--l);border-radius:12px;padding:14px;font-size:13.5px;color:var(--ink);box-shadow:var(--sh)}
.sv1-gd-more a:hover{border-color:var(--acLine)}
@media(max-width:860px){.sv1-gd-more{grid-template-columns:1fr 1fr}.sv1-gd-sec{padding:18px}}
</style>`;

  const nav = SECTIONS.map((s) => `<a href="#${s.id}">${esc(pick(s.nav))}</a>`).join("");

  const sections = SECTIONS.map((s) => {
    const list = s.items
      ? `<ul>${s.items.map((i) => `<li>${esc(pick(i))}</li>`).join("")}</ul>`
      : "";
    const table = s.rows
      ? `<div class="sv1-gd-tbl"><table><thead><tr><th>${esc(t("sector"))}</th><th>${esc(t("entry"))}</th><th>${esc(t("mid"))}</th><th>${esc(t("senior"))}</th></tr></thead><tbody>${
          s.rows.map(([role, a, b, c]) => `<tr><td>${esc(pick(role))}</td><td><span class="sv1-mono en">${a}</span></td><td><span class="sv1-mono en">${b}</span></td><td><span class="sv1-mono en">${c}</span></td></tr>`).join("")
        }</tbody></table></div><p class="sv1-muted" style="margin:8px 0 0">${esc(t("sar"))}</p>`
      : "";
    const note = s.note ? `<div class="sv1-gd-note">${esc(pick(s.note))}</div>` : "";
    return `<section class="sv1-gd-sec" id="${s.id}"><h2>${esc(pick(s.h))}</h2><p>${esc(pick(s.lead))}</p>${list}${table}${note}</section>`;
  }).join("");

  const more = MORE.map(([p, l]) => `<a href="${esc(u(p))}">${esc(pick(l))} ${lang === "ar" ? "←" : "→"}</a>`).join("");

  const body = `${SV1.header("/guide/company-structure")}
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
    path: "/guide/company-structure",
    body: CSS + body,
  });
}
