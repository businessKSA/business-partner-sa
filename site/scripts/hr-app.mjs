// HR Employer App (/hr/employer/* + /ar/hr/employer/*) — page builders.
// Standalone app chrome (sidebar + topbar), fully bilingual: buildHRAppPages("en")
// emits the English LTR tree at /hr/employer/* and buildHRAppPages("ar") the
// Arabic RTL tree (written under ar/ by the caller). Pages are static shells —
// all data rendering happens in /assets/js/hr-app.js against the HRStore
// adapter (mock now, API later); dynamic labels there follow window.HR_LANG.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, "..");

const hash = (p) => {
  try { return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex").slice(0, 10); }
  catch { return "0"; }
};
const CSS_V = hash(path.join(SITE, "assets/css/hr.css"));
const JS_V = hash(path.join(SITE, "assets/js/hr-app.js"));

// Language of the tree being built. L() picks a string; P() prefixes internal
// app links so the Arabic tree stays inside /ar/hr/… .
let LANG = "ar";
const L = (en, ar) => (LANG === "ar" ? ar : en);
const P = (href) => (LANG === "ar" ? "/ar" + href : href);

// Minimal Lucide-style icon set (24×24, stroke 2) — inlined, no CDN.
const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.6 14.6c2.5.3 4.3 1.9 4.9 4.4"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5"/><path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  filetext: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 12h6M9 16h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M21 20H3"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  shield: '<path d="M12 2 4.5 5v6c0 5 3.2 8.6 7.5 10 4.3-1.4 7.5-5 7.5-10V5z"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12l-1 5a5 5 0 0 1-10 0z"/><path d="M12 18v3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.3 3h-4l-.4 2.5a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.5h4l.3-2.5a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.6-2.5 2.2-2.5 3.7"/><path d="M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17z"/>',
  msg: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>',
};
const ic = (name, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ""}</svg>`;

const NAV = [
  { href: "/hr/employer", key: "home", icon: "home", en: "Home", ar: "الرئيسية" },
  { href: "/hr/employer/jobs", key: "jobs", icon: "briefcase", en: "Jobs", ar: "الوظائف" },
  { href: "/hr/employer/applicants", key: "applicants", icon: "users", en: "Applicants", ar: "المتقدمون" },
  { href: "/hr/employer/matching", key: "matching", icon: "spark", en: "Smart Matching", ar: "المطابقة الذكية" },
  { href: "/hr/employer/talent-pool", key: "talent", icon: "database", en: "Talent Pool", ar: "قاعدة المواهب" },
  { href: "/hr/employer/interviews", key: "interviews", icon: "calendar", en: "Interviews", ar: "المقابلات" },
  { href: "/hr/employer/messages", key: "messages", icon: "mail", en: "Messages", ar: "الرسائل" },
  { href: "/hr/employer/offers", key: "offers", icon: "filetext", en: "Offers & Hiring", ar: "العروض والتعيين" },
  { href: "/hr/employer/onboarding", key: "onboarding", icon: "shield", en: "Onboarding", ar: "التعيين والمباشرة" },
  { href: "/hr/employer/reports", key: "reports", icon: "chart", en: "Reports", ar: "التقارير" },
  { href: "/hr/employer/billing", key: "billing", icon: "card", en: "Billing & Plans", ar: "الفواتير والباقات" },
  { href: "/hr/employer/team", key: "team", icon: "shield", en: "Team & Permissions", ar: "فريق العمل والصلاحيات" },
  { href: "/hr/employer/company", key: "company", icon: "building", en: "Company Page", ar: "صفحة الشركة" },
  { href: "/hr/employer/integrations", key: "integrations", icon: "plug", en: "Integrations", ar: "التكاملات" },
  { href: "/hr/employer/automations", key: "automations", icon: "settings", en: "Automation Center", ar: "مركز الأتمتة" },
  { href: "/hr/employer/settings", key: "settings", icon: "settings", en: "Settings", ar: "الإعدادات" },
  { href: "/hr/employer/help", key: "help", icon: "help", en: "Help Center", ar: "مركز المساعدة" },
];

function shell({ title, active, page, body, wide, rel }) {
  const nav = NAV.map((n) =>
    `<a href="${P(n.href)}"${n.key === active ? ' class="active" aria-current="page"' : ""}>${ic(n.icon)}<span class="nv-txt">${L(n.en, n.ar)}</span>${n.key === "applicants" ? '<span class="nv-badge" id="nav-new-count" hidden></span>' : ""}</a>`
  ).join("\n        ");
  // Language toggle: the same page in the other tree. Clicking also stores the
  // preference so the auto-redirect below keeps the visitor in their language.
  const plainPath = "/" + rel.replace(/\.html$/, "");
  const otherHref = LANG === "ar" ? plainPath : "/ar" + plainPath;
  const otherLang = LANG === "ar" ? "en" : "ar";
  // Honor the stored site-wide language preference (shared with /account):
  // an English URL opened by an Arabic-preferring visitor bounces to /ar/…
  // and vice versa. The toggle writes the preference first, so it always wins.
  const langRedirect = LANG === "ar"
    ? '<script>try{if(localStorage.getItem("bp_lang")==="en"&&location.pathname.indexOf("/ar/")===0)location.replace(location.pathname.slice(3)+location.search)}catch(e){}</script>'
    : '<script>try{if(localStorage.getItem("bp_lang")==="ar"&&location.pathname.indexOf("/ar/")!==0)location.replace("/ar"+location.pathname+location.search)}catch(e){}</script>';
  return `<!DOCTYPE html>
<html lang="${LANG}" dir="${LANG === "ar" ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
${langRedirect}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${L("Hiring Platform", "منصة التوظيف")} | Business Partner</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0B1B5A">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/hr.css?v=${CSS_V}">
</head>
<body class="hr-body" data-hr-page="${page}">
<div class="hr-shell" id="hr-shell">
  <aside class="hr-side" id="hr-side" aria-label="${L("Main navigation", "التنقل الرئيسي")}">
    <div class="hr-brand">
      <span class="hr-brand-logo" id="hr-co-logo">BP</span>
      <span><b id="hr-co-name">${L("Hiring Platform", "منصة التوظيف")}</b><small>Business Partner HR</small></span>
    </div>
    <nav class="hr-nav">
      <span class="hr-nav-label">${L("Recruitment", "التوظيف")}</span>
        ${nav}
    </nav>
  </aside>
  <div class="hr-overlay" id="hr-overlay"></div>
  <div class="hr-main">
    <header class="hr-top">
      <button class="tb-btn hr-burger" id="hr-burger" aria-label="${L("Open menu", "فتح القائمة")}">${ic("menu", 20)}</button>
      <button class="tb-btn" id="hr-collapse" aria-label="${L("Collapse sidebar", "طي القائمة الجانبية")}" title="${L("Collapse/expand menu", "طي/فتح القائمة")}">${ic("chevL", 18)}</button>
      <div class="hr-search" role="search">
        ${ic("search", 16)}
        <input type="search" id="hr-global-q" placeholder="${L("Search candidates or jobs…", "ابحث عن مرشّح أو وظيفة…")}" aria-label="${L("Global search", "بحث عام")}">
      </div>
      <a class="tb-btn" id="hr-lang" href="${otherHref}" onclick="try{localStorage.setItem('bp_lang','${otherLang}')}catch(e){}" title="${LANG === "ar" ? "English" : "العربية"}" style="text-decoration:none;font-weight:700;font-size:.74rem">${LANG === "ar" ? "EN" : "ع"}</a>
      <button class="tb-btn" id="hr-notif" aria-label="${L("Notifications", "الإشعارات")}">${ic("bell", 19)}<span class="tb-dot" id="hr-notif-dot" hidden></span></button>
      <button class="tb-btn" id="hr-msgs" aria-label="${L("Messages", "الرسائل")}">${ic("msg", 19)}</button>
      <div class="hr-user">
        <span class="u-txt"><b id="hr-user-name">…</b><span id="hr-user-co">…</span></span>
        <span class="hr-avatar" id="hr-user-av">؟</span>
      </div>
    </header>
    <main class="hr-content${wide ? " hr-content-wide" : ""}" id="hr-content">
${body}
    </main>
  </div>
</div>
<div id="hr-toast-root"></div>
<div id="hr-modal-root"></div>
<script>window.HR_LANG="${LANG}";</script>
<script src="/assets/js/hr-app.js?v=${JS_V}" defer></script>
</body>
</html>`;
}

/* ---------- Pages ---------- */

const dashboardBody = () => `
      <div class="hr-page-head">
        <div><h1 id="dash-hello">${L("Welcome 👋", "مرحباً 👋")}</h1><p>${L("Here's an overview of your company's hiring performance today.", "إليك نظرة عامة على أداء التوظيف في شركتك اليوم.")}</p></div>
        <a class="hr-btn hr-btn-primary" href="${P("/hr/employer/jobs/new")}">${ic("plus", 16)} ${L("Post a new job", "نشر وظيفة جديدة")}</a>
      </div>
      <section class="hr-hero-ask">
        <h2>${L("Who do you want to hire today?", "من تريد توظيفه اليوم؟")}</h2>
        <div class="ask-row">
          <input type="text" id="dash-ask" placeholder="${L("Type the job title… e.g. HR Specialist", "اكتب المسمى الوظيفي… مثال: أخصائي موارد بشرية")}" aria-label="${L("Job title", "المسمى الوظيفي")}">
          <button class="hr-btn hr-btn-primary" id="dash-ask-go" style="padding:13px 22px">${L("Create the job", "أنشئ الوظيفة")}</button>
        </div>
        <div class="hr-chips" id="dash-ask-chips">
          <button class="hr-chip">${L("HR Specialist", "أخصائي موارد بشرية")}</button>
          <button class="hr-chip">${L("Accountant", "محاسب")}</button>
          <button class="hr-chip">${L("Sales Manager", "مدير مبيعات")}</button>
          <button class="hr-chip">${L("Customer Service Agent", "مسؤول خدمة عملاء")}</button>
          <button class="hr-chip">${L("Marketing Specialist", "أخصائي تسويق")}</button>
        </div>
      </section>
      <div class="hr-kpis" id="dash-kpis"><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        <section class="hr-card"><div class="hd"><h2>${L("Hiring funnel", "قمع التوظيف")}</h2><a href="${P("/hr/employer/applicants")}">${L("Details", "التفاصيل")}</a></div><div class="bd"><div class="hr-funnel" id="dash-funnel"></div></div></section>
        <section class="hr-card"><div class="hd"><h2>${L("Upcoming interviews", "المقابلات القادمة")}</h2><a href="${P("/hr/employer/interviews")}">${L("All", "الكل")}</a></div><div class="bd" id="dash-interviews"></div></section>
      </div>
      <section class="hr-card"><div class="hd"><h2>${L("Active jobs", "الوظائف النشطة")}</h2><a href="${P("/hr/employer/jobs")}">${L("All jobs", "كل الوظائف")}</a></div><div class="hr-tbl-wrap" id="dash-jobs"></section>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        <section class="hr-card"><div class="hd"><h2>${L("Recommended candidates", "مرشّحون موصى بهم")} <span class="hr-tag t-ai">${ic("spark", 12)} AI</span></h2><a href="${P("/hr/employer/applicants")}">${L("All", "الكل")}</a></div><div class="bd" id="dash-recommended"></div></section>
        <section class="hr-card"><div class="hd"><h2>${L("Recent activity", "آخر النشاطات")}</h2></div><div class="bd" id="dash-activity"></div></section>
      </div>`;

const jobsBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Jobs", "الوظائف")}</h1><p>${L("All your company's jobs — create, edit, share and track applicants.", "كل وظائف شركتك — أنشئ، عدّل، شارك وتابع المتقدمين.")}</p></div>
        <a class="hr-btn hr-btn-primary" href="${P("/hr/employer/jobs/new")}">${ic("plus", 16)} ${L("Post a new job", "نشر وظيفة جديدة")}</a>
      </div>
      <div class="hr-toolbar">
        <input type="search" id="jb-q" placeholder="${L("Search by title or department…", "ابحث بالمسمى أو القسم…")}" aria-label="${L("Search jobs", "بحث في الوظائف")}">
        <select id="jb-status" aria-label="${L("Filter by status", "فلترة بالحالة")}"><option value="">${L("All statuses", "كل الحالات")}</option><option value="منشورة">${L("Published", "منشورة")}</option><option value="مسودة">${L("Draft", "مسودة")}</option><option value="قيد المراجعة">${L("Under review", "قيد المراجعة")}</option><option value="متوقفة">${L("Paused", "متوقفة")}</option><option value="منتهية">${L("Expired", "منتهية")}</option><option value="مغلقة">${L("Closed", "مغلقة")}</option></select>
        <select id="jb-city" aria-label="${L("Filter by city", "فلترة بالمدينة")}"><option value="">${L("All cities", "كل المدن")}</option></select>
        <select id="jb-sort" aria-label="${L("Sort", "ترتيب")}"><option value="new">${L("Newest first", "الأحدث أولاً")}</option><option value="old">${L("Oldest first", "الأقدم أولاً")}</option><option value="apps">${L("Most applications", "الأكثر تقديمات")}</option></select>
        <span class="sp"></span>
        <div class="hr-views" role="tablist" aria-label="${L("View mode", "طريقة العرض")}">
          <button id="jb-view-table" class="active" aria-label="${L("Table view", "عرض جدول")}">${ic("list", 16)}</button>
          <button id="jb-view-cards" aria-label="${L("Card view", "عرض بطاقات")}">${ic("grid", 16)}</button>
        </div>
      </div>
      <section class="hr-card"><div id="jb-wrap"><div class="bd"><div class="hr-skel" style="height:180px"></div></div></div></section>
      <div class="hr-pgn" id="jb-pgn" hidden></div>`;

const jobNewBody = () => `
      <div class="hr-page-head">
        <div><h1 id="wiz-title">${L("Post a new job", "نشر وظيفة جديدة")}</h1><p id="jn-sub"></p></div>
        <a class="hr-btn hr-btn-ghost" href="${P("/hr/employer/jobs")}">${L("Back to jobs", "رجوع للوظائف")}</a>
      </div>

      <!-- State 1: one question -->
      <section class="hr-card hr-ask-card" id="qp-ask"><div class="bd" style="padding:34px 26px">
        <h2>${L("What role do you want to hire?", "ما المنصب الذي تريد توظيفه؟")}</h2>
        <p class="hint">${L("Just type the title — or ask in your own words: “I need 5 Saudi baristas in Riyadh”", "اكتب المسمى فقط — أو اطلبها بلغتك: «أحتاج 5 باريستا سعوديين بالرياض»")}</p>
        <input type="text" id="qp-title" placeholder="${L("HR Specialist", "أخصائي موارد بشرية")}" aria-label="${L("Target role", "المنصب المطلوب")}">
        <div class="hr-chips" id="qp-chips" style="justify-content:center">
          <button class="hr-chip">${L("HR Specialist", "أخصائي موارد بشرية")}</button>
          <button class="hr-chip">${L("Accountant", "محاسب")}</button>
          <button class="hr-chip">${L("Sales Manager", "مدير مبيعات")}</button>
          <button class="hr-chip">${L("Customer Service Agent", "مسؤول خدمة عملاء")}</button>
          <button class="hr-chip">${L("Marketing Specialist", "أخصائي تسويق")}</button>
        </div>
        <button class="hr-btn hr-btn-primary hr-btn-lg" id="qp-go" type="button" style="width:100%;margin-top:18px;padding:14px">${L("✨ Create the job with AI", "✨ إنشاء الوظيفة بالذكاء الاصطناعي")}</button>
        <p class="hr-hint" id="qp-status" style="min-height:18px;margin-top:10px"></p>
        <details style="margin-top:14px;text-align:center"><summary class="hr-hint" style="cursor:pointer">${L("Other options", "خيارات أخرى")}</summary>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">
            <button class="hr-chip" data-alt="upload">${L("Upload a job description (PDF/Word)", "رفع وصف وظيفي (PDF/Word)")}</button>
            <button class="hr-chip" data-alt="copy">${L("Duplicate a previous job", "نسخ وظيفة سابقة")}</button>
            <button class="hr-chip" data-alt="template">${L("Use a template", "استخدام قالب")}</button>
            <button class="hr-chip" id="jn-full">${L("Advanced manual creation", "إنشاء يدوي متقدم")}</button>
          </div>
        </details>
      </div></section>

      <!-- One necessary question, only when needed -->
      <div class="hr-qq" id="qp-city-q" hidden>
        <h3>${L("Where will the job be located?", "أين ستكون الوظيفة؟")}</h3>
        <div class="hr-chips" style="justify-content:center">
          <button class="hr-chip" data-city="الرياض">${L("Riyadh", "الرياض")}</button>
          <button class="hr-chip" data-city="جدة">${L("Jeddah", "جدة")}</button>
          <button class="hr-chip" data-city="الدمام">${L("Dammam", "الدمام")}</button>
          <button class="hr-chip" data-city="عن بعد">${L("Remote", "عن بعد")}</button>
        </div>
      </div>

      <!-- State 2: progress -->
      <div class="hr-gen-progress" id="qp-progress" hidden>
        <div class="hr-spin" aria-hidden="true"></div>
        <h3 style="color:var(--hr-navy);margin-bottom:14px">${L("Preparing your job ad…", "نجهز لك الإعلان الوظيفي…")}</h3>
        <div class="gp-step" data-gp="0">${L("📝 Writing the job description", "📝 نكتب الوصف الوظيفي")}</div>
        <div class="gp-step" data-gp="1">${L("🛠️ Defining skills & requirements", "🛠️ نحدد المهارات والمتطلبات")}</div>
        <div class="gp-step" data-gp="2">${L("❓ Preparing screening questions", "❓ نجهز أسئلة الفرز")}</div>
        <div class="gp-step" data-gp="3">${L("✨ Preparing matching against your talent pool", "✨ نجهز المطابقة مع قاعدة المواهب")}</div>
      </div>

      <!-- State 3: smart preview -->
      <div id="qp-preview" hidden>
        <section class="hr-card"><div class="bd">
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
            <div><span class="hr-quality">${L("✓ Your job is ready to publish", "✓ وظيفتك جاهزة للنشر")}</span> <span class="hr-tag" id="qp-quality"></span></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="hr-btn hr-btn-primary" id="qp-publish" type="button">${L("📢 Publish now", "📢 نشر الآن")}</button>
              <button class="hr-btn hr-btn-ghost" id="qp-edit-toggle" type="button">${L("Review & edit", "مراجعة وتعديل")}</button>
              <button class="hr-btn hr-btn-ghost" id="qp-regen" type="button">${L("✨ Regenerate", "✨ إعادة إنشاء")}</button>
            </div>
          </div>
          <div id="qp-understood" style="margin-top:12px"></div>
        </div></section>
        <section class="hr-card"><div class="bd" id="qp-doc"></div></section>
        <section class="hr-card"><div class="hd"><h2>${L("Screening questions", "أسئلة الفرز")} <span class="hr-tag t-ai">${L("AI-generated", "أنشأها الذكاء")}</span></h2><button class="hr-link" id="qp-q-off">${L("Disable screening questions", "تعطيل أسئلة الفرز")}</button></div><div class="bd" id="qp-questions"></div></section>
      </div>

      <div class="hr-wiz" id="wiz-wrap" hidden>
        <aside class="hr-wiz-steps" id="wiz-steps" aria-label="${L("Publishing steps", "خطوات النشر")}"></aside>
        <section class="hr-card"><div class="bd">
          <form id="wiz-form" novalidate></form>
          <div class="hr-wiz-foot">
            <button class="hr-btn hr-btn-ghost" id="wiz-prev" type="button">${L("Previous", "السابق")}</button>
            <span style="display:flex;gap:8px">
              <button class="hr-btn hr-btn-ghost" id="wiz-save" type="button">${L("Save as draft", "حفظ كمسودة")}</button>
              <button class="hr-btn hr-btn-primary" id="wiz-next" type="button">${L("Next", "التالي")}</button>
            </span>
          </div>
        </div></section>
      </div>`;

const jobViewBody = () => `
      <div id="jv-root"><div class="hr-skel" style="height:220px"></div></div>`;

const applicantsBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Applicants", "المتقدمون")}</h1><p>${L("ATS pipeline — drag candidates between stages or switch to table view.", "مسار ATS — اسحب المرشّح بين المراحل أو بدّل لعرض الجدول.")}</p></div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="hr-views" role="tablist" aria-label="${L("View mode", "طريقة العرض")}">
            <button id="ap-view-kanban" class="active" aria-label="${L("Kanban view", "عرض كانبان")}">${ic("grid", 16)}</button>
            <button id="ap-view-table" aria-label="${L("Table view", "عرض جدول")}">${ic("list", 16)}</button>
          </div>
        </div>
      </div>
      <div class="hr-toolbar">
        <select id="ap-job" aria-label="${L("Choose job", "اختيار الوظيفة")}" style="min-width:210px"><option value="">${L("All jobs", "كل الوظائف")}</option></select>
        <input type="search" id="ap-q" placeholder="${L("Search candidates…", "ابحث عن مرشّح…")}" aria-label="${L("Search candidates", "بحث عن مرشح")}">
        <select id="ap-nat" aria-label="${L("Nationality", "الجنسية")}"><option value="">${L("All nationalities", "كل الجنسيات")}</option><option value="سعودي">${L("Saudis", "سعوديون")}</option><option value="غير">${L("Non-Saudis", "غير سعوديين")}</option></select>
        <select id="ap-src" aria-label="${L("Source", "المصدر")}"><option value="">${L("All sources", "كل المصادر")}</option></select>
        <select id="ap-match" aria-label="${L("Match score", "نسبة المطابقة")}"><option value="">${L("Any match", "أي مطابقة")}</option><option value="85">85%+</option><option value="70">70%+</option></select>
        <span class="sp"></span>
        <span id="ap-bulk" hidden style="display:flex;gap:8px;align-items:center">
          <span class="hr-tag t-teal" id="ap-bulk-n"></span>
          <button class="hr-btn hr-btn-sm hr-btn-soft" id="ap-bulk-shortlist">${L("Move to shortlist", "نقل للقائمة المختصرة")}</button>
          <button class="hr-btn hr-btn-sm hr-btn-danger" id="ap-bulk-reject">${L("Reject", "استبعاد")}</button>
        </span>
      </div>
      <div id="ap-root"><div class="hr-skel" style="height:300px"></div></div>`;

const applicantBody = () => `
      <div id="cp-root"><div class="hr-skel" style="height:280px"></div></div>`;

const matchingBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Smart Matching", "المطابقة الذكية")}</h1><p>${L("Pick a job and run matching — tunable weighted scores with a clear explanation for every result.", "اختر وظيفة وشغّل المطابقة — درجات موزونة قابلة للضبط مع شرح واضح لكل نتيجة.")}</p></div>
        <button class="hr-btn hr-btn-primary" id="mt-run">${ic("spark", 16)} ${L("Run matching", "تشغيل المطابقة")}</button>
      </div>
      <div class="hr-toolbar">
        <select id="mt-job" aria-label="${L("Choose job", "اختيار الوظيفة")}" style="min-width:240px"></select>
        <select id="mt-cat" aria-label="${L("Filter by category", "فلترة بالفئة")}"><option value="">${L("All categories", "كل الفئات")}</option><option value="strong">${L("Strong match (85+)", "مطابقة قوية (85+)")}</option><option value="good">${L("Good match (70–84)", "مطابق جيد (70–84)")}</option><option value="review">${L("Needs review (50–69)", "يحتاج مراجعة (50–69)")}</option><option value="weak">${L("Weak match (&lt;50)", "مطابقة ضعيفة (&lt;50)")}</option></select>
        <span class="sp"></span>
        <button class="hr-btn hr-btn-ghost hr-btn-sm" id="mt-weights-toggle">${L("⚖️ Weight settings", "⚖️ إعدادات الأوزان")}</button>
        <span class="hr-hint" id="mt-last-run"></span>
      </div>
      <section class="hr-card" id="mt-weights" hidden><div class="hd"><h2>${L("Matching weights (total 100%)", "أوزان المطابقة (المجموع 100%)")}</h2><button class="hr-link" id="mt-weights-reset">${L("Restore defaults", "استعادة الافتراضي")}</button></div><div class="bd"><div id="mt-weights-grid" class="hr-kv"></div><p class="hr-hint" style="margin-top:10px">${L("Weights apply on the next run. Mandatory (MUST_HAVE) conditions act as a hard filter, and unknown information never excludes a candidate — it is flagged UNKNOWN and requested from them.", "تُطبق الأوزان في التشغيل التالي. الشروط الإلزامية (MUST_HAVE) تُعامل كفلتر صريح، والمعلومة غير المعروفة لا تستبعد المرشّح — تُعلَّم كـ UNKNOWN وتُطلب منه.")}</p></div></section>
      <div class="hr-kpis" id="mt-kpis" hidden></div>
      <section class="hr-card" id="mt-dist-card" hidden><div class="hd"><h2>${L("Score distribution", "توزيع الدرجات")}</h2></div><div class="bd" id="mt-dist"></div></section>
      <div id="mt-results"><div class="hr-empty"><div class="e-ic">✨</div><b>${L("Pick a job and run matching", "اختر وظيفة وشغّل المطابقة")}</b><p>${L("The engine analyzes every candidate in your pool and ranks them with a detailed score.", "يحلل المحرك كل المرشّحين في قاعدتك ويرتبهم بدرجة مفصّلة.")}</p></div></div>
      <section class="hr-card" id="mt-history-card" hidden><div class="hd"><h2>${L("Matching run history", "سجل عمليات المطابقة")}</h2></div><div class="bd" id="mt-history"></div></section>`;

const talentBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Talent Pool", "قاعدة المواهب")}</h1><p>${L("All your company's candidates in one place — search, tag, save lists, and invite to apply.", "كل مرشّحي شركتك في مكان واحد — ابحث، وسم، احفظ قوائم، وادعُ للتقديم.")}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="hr-btn hr-btn-ghost" id="tp-add">${L("Add candidate manually", "إضافة مرشّح يدوياً")}</button>
          <button class="hr-btn hr-btn-ghost" id="tp-import">${L("Import CSV / upload CVs", "استيراد CSV / رفع CV")}</button>
        </div>
      </div>
      <div class="hr-toolbar">
        <input type="search" id="tp-q" placeholder="${L("Search by name, title or skill…", "ابحث بالاسم أو المسمى أو المهارة…")}" aria-label="${L("Search", "بحث")}">
        <select id="tp-nat"><option value="">${L("All nationalities", "كل الجنسيات")}</option><option value="سعودي">${L("Saudis", "سعوديون")}</option><option value="غير">${L("Non-Saudis", "غير سعوديين")}</option></select>
        <select id="tp-city"><option value="">${L("All cities", "كل المدن")}</option></select>
        <select id="tp-list"><option value="">${L("All candidates", "كل المرشّحين")}</option><option value="future">${L("Saved for future roles", "محفوظون لفرص مستقبلية")}</option><option value="invited">${L("Invited to apply", "مدعوون للتقديم")}</option><option value="noapp">${L("Never applied to a job", "لم يتقدموا على وظيفة")}</option></select>
      </div>
      <div id="tp-add-form" hidden></div>
      <p class="hr-hint" id="tp-count"></p>
      <div class="hr-grid" id="tp-grid"></div>`;

const interviewsBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Interviews", "المقابلات")}</h1><p>${L("This week's interviews and beyond — linked to the job, the candidate and the panel.", "مقابلات هذا الأسبوع وما بعده — مربوطة بالوظيفة والمرشّح واللجنة.")}</p></div>
        <button class="hr-btn hr-btn-primary" id="iv-new">${L("＋ New interview", "＋ مقابلة جديدة")}</button>
      </div>
      <div id="iv-form-wrap" hidden></div>
      <div id="iv-list"><div class="hr-skel" style="height:200px"></div></div>`;

const messagesBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Messages", "الرسائل")}</h1><p>${L("Ready-made templates with auto variables — email via n8n is live; WhatsApp awaits Meta template approval.", "قوالب جاهزة بمتغيرات تلقائية — البريد عبر n8n متاح، وواتساب بانتظار اعتماد قالب Meta.")}</p></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        <section class="hr-card"><div class="hd"><h2>${L("Compose", "إنشاء رسالة")}</h2></div><div class="bd" id="ms-compose"></div></section>
        <section class="hr-card"><div class="hd"><h2>${L("Message log", "سجل الرسائل")}</h2></div><div class="bd" id="ms-log"></div></section>
      </div>
      <section class="hr-card"><div class="hd"><h2>${L("Templates", "القوالب")}</h2></div><div class="bd" id="ms-templates"></div></section>`;

const offersBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Offers & Hiring", "العروض والتعيين")}</h1><p>${L("Create the offer, route it for approval, and move accepted candidates into onboarding.", "أنشئ العرض، مرّره للاعتماد، وحوّل المقبولين إلى رحلة المباشرة.")}</p></div>
        <button class="hr-btn hr-btn-primary" id="of-new">${L("＋ New job offer", "＋ عرض وظيفي جديد")}</button>
      </div>
      <div id="of-form-wrap" hidden></div>
      <div id="of-list"><div class="hr-skel" style="height:180px"></div></div>`;

const billingBody = () => `
      <div class="hr-page-head"><div><h1>${L("Billing & Plans", "الفواتير والباقات")}</h1><p>${L("Your current plan and payment history.", "باقتك الحالية وسجل مدفوعاتك.")}</p></div></div>
      <div id="bl-root"><div class="hr-skel" style="height:200px"></div></div>`;

const teamBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Team & Permissions", "فريق العمل والصلاحيات")}</h1><p>${L("Clear roles and fine-grained permissions for every sensitive action.", "أدوار واضحة وصلاحيات دقيقة لكل إجراء حسّاس.")}</p></div>
        <button class="hr-btn hr-btn-primary" id="tm-invite">${L("＋ Invite member", "＋ دعوة عضو")}</button>
      </div>
      <div id="tm-form-wrap" hidden></div>
      <section class="hr-card"><div class="hd"><h2>${L("Members", "الأعضاء")}</h2></div><div class="bd" id="tm-members"></div></section>
      <section class="hr-card"><div class="hd"><h2>${L("Permission matrix", "مصفوفة الصلاحيات")}</h2></div><div class="hr-tbl-wrap" id="tm-matrix"></div></section>`;

const companyBody = () => `
      <div class="hr-page-head"><div><h1>${L("Company page & default hiring settings", "صفحة الشركة وإعدادات التوظيف الافتراضية")}</h1><p>${L("Filled in once and applied automatically to every new job — so we never ask you again.", "تُعبّأ مرة واحدة وتُستخدم تلقائياً في كل وظيفة جديدة — فلا نسألك عنها مجدداً.")}</p></div></div>
      <section class="hr-card"><div class="bd" id="co-form"></div></section>`;

const settingsBody = () => `
      <div class="hr-page-head"><div><h1>${L("Settings", "الإعدادات")}</h1></div></div>
      <div id="st-root"><div class="hr-skel" style="height:180px"></div></div>`;

const helpBody = () => `
      <div class="hr-page-head"><div><h1>${L("Help Center", "مركز المساعدة")}</h1><p>${L("Quick guides and direct contact with the Business Partner team.", "أدلة سريعة وتواصل مباشر مع فريق Business Partner.")}</p></div></div>
      <div id="hp-root"></div>`;

const reportsBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Reports — candidate sources", "التقارير — مصادر المرشّحين")}</h1><p>${L("Where your candidates really come from, and which source leads to interviews and hires.", "من أين يأتي مرشّحوك فعلاً، وأي مصدر يوصل للمقابلة والتوظيف.")}</p></div>
        <select id="rp-model" class="hr-btn hr-btn-ghost" style="font-size:.85rem" aria-label="${L("Attribution model", "نموذج الإسناد")}"><option value="first">${L("First-touch (first source)", "First-touch (أول مصدر)")}</option><option value="last">${L("Last-touch (last source)", "Last-touch (آخر مصدر)")}</option></select>
      </div>
      <div class="hr-kpis" id="rp-kpis"></div>
      <section class="hr-card"><div class="hd"><h2>${L("Performance by source", "الأداء حسب المصدر")}</h2></div><div class="hr-tbl-wrap" id="rp-table"></div></section>
      <p class="hr-hint">${L("Cost-per-applicant/hire and campaign reports activate once campaign tracking links are connected — see the Integrations hub.", "تقارير التكلفة لكل متقدم/تعيين وأداء الحملات تتفعّل مع ربط روابط التتبع والحملات (Campaign Tracking Links) — انظر مركز التكاملات.")}</p>`;

const integrationsBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Integrations Hub", "مركز التكاملات")}</h1><p>${L("Every channel with its true status — official channels only: APIs, webhooks, feeds and tracked links. No scraping, no password storage.", "كل قناة بحالتها الحقيقية — قنوات رسمية فقط: APIs وWebhooks وFeeds وروابط متتبعة. لا Scraping ولا تخزين كلمات مرور.")}</p></div>
      </div>
      <div class="hr-kpis" id="ig-kpis"></div>
      <div id="ig-list"><div class="hr-skel" style="height:220px"></div></div>`;

const automationsBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Automation Center", "مركز الأتمتة")}</h1><p>${L("What's happening now, what needs your input, and the next best action.", "ماذا يحدث الآن، ما الذي يحتاج تدخلك، وما الإجراء الأفضل التالي.")}</p></div>
      </div>
      <div id="am-inbox"><div class="hr-skel" style="height:200px"></div></div>
      <section class="hr-card"><div class="hd"><h2>${L("Hiring workflow templates", "قوالب مسارات التوظيف")}</h2></div><div class="bd" id="am-templates"></div></section>`;

const onboardingBody = () => `
      <div class="hr-page-head">
        <div><h1>${L("Onboarding", "التعيين والمباشرة (Onboarding)")}</h1><p>${L("Every new hire's journey from offer acceptance to passing probation — with the full Saudi track.", "رحلة كل موظف جديد من قبول العرض حتى اجتياز فترة التجربة — بالمسار السعودي الكامل.")}</p></div>
        <div class="hr-views" role="tablist" aria-label="${L("View mode", "طريقة العرض")}">
          <button id="ob-view-journey" class="active">${L("Employee journey", "رحلة الموظف")}</button>
          <button id="ob-view-depts">${L("Department tasks", "مهام الأقسام")}</button>
        </div>
      </div>
      <section class="hr-card"><div class="hr-tbl-wrap" id="ob-list"></section>
      <div id="ob-detail"></div>`;

export function buildHRAppPages(lang = "ar") {
  LANG = lang === "en" ? "en" : "ar";
  const defs = [
    ["hr/employer.html", { en: "Employer Dashboard", ar: "لوحة صاحب العمل", active: "home", page: "dashboard", body: dashboardBody }],
    ["hr/employer/jobs.html", { en: "Jobs", ar: "الوظائف", active: "jobs", page: "jobs", body: jobsBody }],
    ["hr/employer/jobs/new.html", { en: "Post a job", ar: "نشر وظيفة", active: "jobs", page: "job-new", body: jobNewBody }],
    ["hr/employer/job.html", { en: "Job details", ar: "تفاصيل الوظيفة", active: "jobs", page: "job-view", body: jobViewBody }],
    ["hr/employer/applicants.html", { en: "Applicants", ar: "المتقدمون", active: "applicants", page: "applicants", body: applicantsBody, wide: true }],
    ["hr/employer/applicant.html", { en: "Candidate file", ar: "ملف المرشّح", active: "applicants", page: "applicant", body: applicantBody }],
    ["hr/employer/matching.html", { en: "Smart Matching", ar: "المطابقة الذكية", active: "matching", page: "matching", body: matchingBody }],
    ["hr/employer/reports.html", { en: "Reports", ar: "التقارير", active: "reports", page: "reports", body: reportsBody }],
    ["hr/employer/integrations.html", { en: "Integrations Hub", ar: "مركز التكاملات", active: "integrations", page: "integrations", body: integrationsBody }],
    ["hr/employer/automations.html", { en: "Automation Center", ar: "مركز الأتمتة", active: "automations", page: "automations", body: automationsBody }],
    ["hr/employer/onboarding.html", { en: "Onboarding", ar: "التعيين والمباشرة", active: "onboarding", page: "onboarding", body: onboardingBody }],
    ["hr/employer/talent-pool.html", { en: "Talent Pool", ar: "قاعدة المواهب", active: "talent", page: "talent", body: talentBody }],
    ["hr/employer/interviews.html", { en: "Interviews", ar: "المقابلات", active: "interviews", page: "interviews", body: interviewsBody }],
    ["hr/employer/messages.html", { en: "Messages", ar: "الرسائل", active: "messages", page: "messages", body: messagesBody }],
    ["hr/employer/offers.html", { en: "Offers & Hiring", ar: "العروض والتعيين", active: "offers", page: "offers", body: offersBody }],
    ["hr/employer/billing.html", { en: "Billing & Plans", ar: "الفواتير والباقات", active: "billing", page: "billing", body: billingBody }],
    ["hr/employer/team.html", { en: "Team & Permissions", ar: "فريق العمل والصلاحيات", active: "team", page: "team", body: teamBody }],
    ["hr/employer/company.html", { en: "Company Page", ar: "صفحة الشركة", active: "company", page: "company", body: companyBody }],
    ["hr/employer/settings.html", { en: "Settings", ar: "الإعدادات", active: "settings", page: "settings", body: settingsBody }],
    ["hr/employer/help.html", { en: "Help Center", ar: "مركز المساعدة", active: "help", page: "help", body: helpBody }],
  ];
  return defs.map(([rel, d]) => [rel, shell({ title: L(d.en, d.ar), active: d.active, page: d.page, body: d.body(), wide: d.wide, rel })]);
}
