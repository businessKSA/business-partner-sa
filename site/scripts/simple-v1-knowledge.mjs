// Business Partner — Simple V1: مركز المعرفة (/knowledge-center).
//
// قرار المالك (2026-09-24): الموقع الجديد نظيف، والمعرفة كلها خلف رابطٍ واحد في
// التذييل — «مركز المعرفة» — ومن يدخله يجد كل شيء مرتباً هنا.
//
// الأقسام وروابطها تُقرأ من مجموعة «Knowledge Center» في site/data/nav.json (تُمرَّر
// من generate.mjs)، فصفحةٌ تُضاف هناك تظهر هنا. الأوصاف القصيرة وحدها تعيش في
// هذا الملف (DESC)؛ رابطٌ بلا وصف يظهر بعنوانه فقط ولا يختفي.
//
// نمط البيع على طريقة AstroLabs: زرّان في الأعلى (استشارة + حاسبة)، وصندوق «فريقنا
// يتولّى التنفيذ» بين الأقسام لا في آخرها فقط.
//
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.

const T = {
  title: { ar: "مركز المعرفة", en: "Knowledge Center" },
  h1: { ar: "كل ما تحتاج معرفته عن الأعمال في السعودية", en: "Everything you need to know about doing business in Saudi Arabia" },
  desc: {
    ar: "أدلة موثّقة، وحاسبات مجانية، وأحدث القرارات والفرص — مرتبة في مكان واحد. وإن فضّلت أن نتولّى التنفيذ عنك، ففريقنا جاهز.",
    en: "Sourced guides, free calculators, and the latest decisions and opportunities — in one place. And if you'd rather we handle it for you, our team is ready.",
  },
  consult: { ar: "احجز استشارة مجانية", en: "Book a free consultation" },
  calc: { ar: "احسب تكاليفك الحكومية", en: "Calculate your government costs" },
  guideH: { ar: "دليل السعودية", en: "Saudi Guide" },
  guideP: { ar: "من دراسة السوق إلى التأسيس والتشغيل والإقامة — بالترتيب الذي ستحتاجه.", en: "From market research to setup, operations and residency — in the order you'll need it." },
  toolsH: { ar: "الأدوات والحاسبات", en: "Tools & calculators" },
  toolsP: { ar: "احسب قبل أن تقرر — مجاناً وبلا تسجيل.", en: "Calculate before you decide — free, no sign-up." },
  newsH: { ar: "القرارات والفرص", en: "Decisions & opportunities" },
  newsP: { ar: "ما يتغيّر في الأنظمة، والفرص التي نرصدها لعملائنا.", en: "What's changing in regulations, and the opportunities we track for clients." },
  read: { ar: "اقرأ", en: "Read" },
  open: { ar: "افتح", en: "Open" },
  midH: { ar: "قرأت ما يكفي؟ خلّ التنفيذ علينا", en: "Read enough? Let us handle the execution" },
  midP: {
    ar: "التأسيس، والتراخيص، والتأشيرات، والتوظيف، والامتثال الحكومي — فريقنا ينجزها من البداية للنهاية، وتتابع كل خطوة من حسابك.",
    en: "Company setup, licenses, visas, hiring and government compliance — our team handles them end to end, and you track every step from your account.",
  },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  services: { ar: "تصفّح الخدمات", en: "Browse services" },
  endH: { ar: "لم تجد جواب سؤالك؟", en: "Didn't find your answer?" },
  endP: { ar: "اسأل مستشاراً — ثلاثون دقيقة تخرج منها بخطوات واضحة لحالتك.", en: "Ask an advisor — thirty minutes and you leave with clear steps for your case." },
};

// أوصاف قصيرة لكل رابط. المفتاح هو href كما في nav.json.
const DESC = {
  "/saudi-arabia": { ar: "لماذا السعودية الآن: الاقتصاد ورؤية 2030 وبيئة الأعمال بالأرقام.", en: "Why Saudi now: the economy, Vision 2030 and the business climate in numbers." },
  "/guide/saudi-market": { ar: "حجم الاقتصاد، المشاريع العملاقة، وأعراف ثقافة العمل.", en: "Economy size, giga-projects, and business culture." },
  "/guide/business-setup": { ar: "خطوات التأسيس الفعلية، والتراخيص الثمانية، والمناطق الاقتصادية.", en: "Real setup steps, the 8 license types, and economic zones." },
  "/guide/run-your-business": { ar: "البوابات الحكومية، الضرائب، السعودة، والعلاقات الحكومية.", en: "Government portals, taxes, Saudization and PRO/GRO." },
  "/guide/company-structure": { ar: "الهيكل التنظيمي، سلم الرواتب، والتكلفة الفعلية للموظف.", en: "Org structure, pay scales and the true cost of an employee." },
  "/directory": { ar: "الحاضنات والمسرّعات والصناديق ومساحات العمل في السعودية.", en: "Incubators, accelerators, funds and coworking in Saudi Arabia." },
  "/guide/live-in-saudi": { ar: "السكن والتعليم والصحة والقيادة لفريقك المنتقل.", en: "Housing, schools, healthcare and driving for relocating staff." },
  "/guide/residency": { ar: "الإقامة النظامية والمميزة ونقل الكفالة.", en: "Iqama, Premium Residency and sponsorship transfer." },
  "/catalog": { ar: "اختر خدماتك من الكتالوج واطلب عرض سعر رسمي.", en: "Pick services from the catalogue and request an official quote." },
  "/calculators/government-cost": { ar: "رخصة العمل والإقامة والتأمين والغرامات لكل عامل.", en: "Work permit, iqama, insurance and fines per worker." },
  "/calculators/profession-checker": { ar: "هل المهنة موطّنة أو مقيّدة على نشاطك؟", en: "Is a profession localized or restricted for your activity?" },
  "/calculators/end-of-service": { ar: "مكافأة نهاية الخدمة وفق نظام العمل.", en: "End-of-service gratuity under the Labor Law." },
  "/calculators/annual-leave": { ar: "الاستحقاق وقيمة الأيام غير المستخدمة.", en: "Entitlement and value of unused days." },
  "/calculators/overtime": { ar: "أجر الساعات الإضافية بمعدل ١٫٥.", en: "Overtime pay at 1.5×." },
  "/calculators/gosi": { ar: "الاشتراكات الشهرية للسعودي وغير السعودي.", en: "Monthly contributions for Saudi and non-Saudi staff." },
  "/opportunities": { ar: "مشاريع عملاقة ومنافسات حكومية ندخلها معك.", en: "Giga-projects and tenders we help you enter." },
  "/news": { ar: "أدلة عملية وتحديثات المنصات الحكومية.", en: "Practical guides and government-platform updates." },
  "/newsletter": { ar: "ملخّص أسبوعي لما يتغيّر في الأنظمة.", en: "A weekly summary of regulatory changes." },
  "/magazine": { ar: "قرارات وتحديثات امتثال — تصفّح أو حمّل PDF.", en: "Decisions and compliance updates — browse or download the PDF." },
};

export function buildSimpleKnowledge(SV1, ctx, knowledge) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e && (e[lang] != null ? e[lang] : e.en)) || "";
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const arrow = lang === "ar" ? "←" : "→";

  const items = (knowledge && Array.isArray(knowledge.items)) ? knowledge.items : [];
  const guide = items.find((i) => i.href === "/saudi-arabia" && Array.isArray(i.sub));
  const tools = items.find((i) => i.href === "/tools-and-calculators" && Array.isArray(i.sub));
  // فهرس الأدوات القديم يكرّر هذا القسم، فلا يُعرض بطاقةً.
  const toolLinks = tools ? tools.sub.filter((s) => s.href !== "/tools-and-calculators") : [];
  const rest = items.filter((i) => i !== guide && i !== tools);

  const card = (it, verb, n) => `<a class="sv1-kc-card" href="${esc(u(it.href))}">
      ${n != null ? `<span class="sv1-kc-n sv1-mono">${String(n).padStart(2, "0")}</span>` : ""}
      <h3>${esc(pick(it))}</h3>
      ${DESC[it.href] ? `<p>${esc(pick(DESC[it.href]))}</p>` : ""}
      <span class="sv1-kc-go">${esc(verb)} ${arrow}</span>
    </a>`;

  const section = (id, h, p, cards, cls = "") => cards ? `<section class="sv1-kc-sec ${cls}" id="${id}">
      <div class="sv1-kc-sh"><h2>${esc(h)}</h2><p>${esc(p)}</p></div>
      <div class="sv1-kc-grid">${cards}</div>
    </section>` : "";

  const CSS = `<style id="sv1-kc-css">
.sv1-kc-head{max-width:820px;margin:0 0 34px}
.sv1-kc-head h1{font-size:clamp(30px,4.4vw,52px);line-height:1.12;margin:16px 0 14px;letter-spacing:-.035em;font-weight:200;color:var(--ink)}
.sv1-kc-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}
.sv1-kc-jump{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 38px;padding:12px 0;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2)}
.sv1-kc-jump a{font-size:12.5px;padding:6px 13px;border:1px solid var(--l);border-radius:999px;color:var(--ink);background:#fff}
.sv1-kc-jump a:hover{border-color:var(--ink)}
.sv1-kc-sec{margin:0 0 44px;scroll-margin-top:96px}
.sv1-kc-sh{margin:0 0 16px}
.sv1-kc-sh h2{font-size:clamp(22px,2.6vw,30px);font-weight:300;color:var(--ink);margin:0 0 6px;letter-spacing:-.025em}
.sv1-kc-sh p{color:var(--mut);margin:0;font-size:14px}
.sv1-kc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sv1-kc-card{position:relative;display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh);transition:transform .15s ease,border-color .2s ease,box-shadow .2s ease;min-height:150px}
.sv1-kc-card:hover{transform:translateY(-2px);border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1-kc-card h3{font-size:15.5px;font-weight:500;color:var(--ink);margin:0;line-height:1.45}
.sv1-kc-card p{font-size:12.5px;color:var(--mut);margin:0;line-height:1.7}
.sv1-kc-go{margin-top:auto;padding-top:8px;font-size:12px;color:var(--ac);font-weight:500}
.sv1-kc-n{font-size:11px;color:var(--faint)}
.sv1-kc-mid{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;background:var(--n);color:#fff;border-radius:16px;padding:26px 28px;margin:0 0 44px}
.sv1-kc-mid h2{font-size:22px;font-weight:300;color:#fff;margin:0 0 6px}
.sv1-kc-mid p{margin:0;color:rgba(255,255,255,.75);font-size:14px;max-width:620px;line-height:1.8}
.sv1-kc-mid .sv1-btn{background:#fff;color:var(--n);border-color:#fff}
.sv1-kc-mid .sv1-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}
.sv1-kc-end{text-align:center;border-top:1px solid var(--line2);padding-top:34px}
.sv1-kc-end h2{font-size:21px;font-weight:300;color:var(--ink);margin:0 0 6px}
.sv1-kc-end p{color:var(--mut);margin:0 0 16px}
@media(max-width:1000px){.sv1-kc-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.sv1-kc-grid{grid-template-columns:1fr}.sv1-kc-card{min-height:0}.sv1-kc-mid{padding:20px}}
</style>`;

  const guideCards = guide ? guide.sub.map((s, i) => card(s, t("read"), i + 1)).join("") : "";
  const toolCards = toolLinks.map((s) => card(s, t("open"))).join("");
  const restCards = rest.map((s) => card(s, t("open"))).join("");

  const jump = [
    guideCards && ["guides", t("guideH")],
    toolCards && ["tools", t("toolsH")],
    restCards && ["updates", t("newsH")],
  ].filter(Boolean).map(([id, l]) => `<a href="#${id}">${esc(l)}</a>`).join("");

  const body = `${SV1.header("/knowledge-center")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-kc-head">
      <span class="sv1-tag">${esc(t("title"))}</span>
      <h1>${esc(t("h1"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
      <div class="sv1-kc-acts">
        <a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("consult"))}</a>
        <a class="sv1-btn" href="${esc(u("/calculators/government-cost"))}">${esc(t("calc"))}</a>
      </div>
    </div>
    <nav class="sv1-kc-jump" aria-label="${esc(t("title"))}">${jump}</nav>
    ${section("guides", t("guideH"), t("guideP"), guideCards)}
    <div class="sv1-kc-mid">
      <div><h2>${esc(t("midH"))}</h2><p>${esc(t("midP"))}</p></div>
      <div class="sv1-kc-acts" style="margin:0">
        <a class="sv1-btn" href="${esc(u("/"))}">${esc(t("start"))}</a>
        <a class="sv1-btn ghost" href="${esc(u("/catalog"))}">${esc(t("services"))}</a>
      </div>
    </div>
    ${section("tools", t("toolsH"), t("toolsP"), toolCards)}
    ${section("updates", t("newsH"), t("newsP"), restCards)}
    <div class="sv1-kc-end">
      <h2>${esc(t("endH"))}</h2>
      <p>${esc(t("endP"))}</p>
      <a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("consult"))}</a>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/knowledge-center",
    body: CSS + body,
  });
}
