// HR Employer App (/hr/employer/*) — page builders.
// Standalone app chrome (sidebar + topbar), Arabic RTL first; English tree
// comes later. Pages are static shells — all data rendering happens in
// /assets/js/hr-app.js against the HRStore adapter (mock now, API later).
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
  { href: "/hr/employer", key: "home", icon: "home", label: "الرئيسية" },
  { href: "/hr/employer/jobs", key: "jobs", icon: "briefcase", label: "الوظائف" },
  { href: "/hr/employer/applicants", key: "applicants", icon: "users", label: "المتقدمون" },
  { href: "/hr/employer/matching", key: "matching", icon: "spark", label: "المطابقة الذكية" },
  { href: "/hr/employer/talent-pool", key: "talent", icon: "database", label: "قاعدة المواهب" },
  { href: "/hr/employer/interviews", key: "interviews", icon: "calendar", label: "المقابلات" },
  { href: "/hr/employer/messages", key: "messages", icon: "mail", label: "الرسائل" },
  { href: "/hr/employer/offers", key: "offers", icon: "filetext", label: "العروض والتعيين" },
  { href: "/hr/employer/reports", key: "reports", icon: "chart", label: "التقارير" },
  { href: "/hr/employer/billing", key: "billing", icon: "card", label: "الفواتير والباقات" },
  { href: "/hr/employer/team", key: "team", icon: "shield", label: "فريق العمل والصلاحيات" },
  { href: "/hr/employer/company", key: "company", icon: "building", label: "صفحة الشركة" },
  { href: "/hr/employer/integrations", key: "integrations", icon: "plug", label: "التكاملات" },
  { href: "/hr/employer/settings", key: "settings", icon: "settings", label: "الإعدادات" },
  { href: "/hr/employer/help", key: "help", icon: "help", label: "مركز المساعدة" },
];

function shell({ title, active, page, body, wide }) {
  const nav = NAV.map((n) =>
    `<a href="${n.href}"${n.key === active ? ' class="active" aria-current="page"' : ""}>${ic(n.icon)}<span class="nv-txt">${n.label}</span>${n.key === "applicants" ? '<span class="nv-badge" id="nav-new-count" hidden></span>' : ""}</a>`
  ).join("\n        ");
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — منصة التوظيف | Business Partner</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0F766E">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/hr.css?v=${CSS_V}">
</head>
<body class="hr-body" data-hr-page="${page}">
<div class="hr-shell" id="hr-shell">
  <aside class="hr-side" id="hr-side" aria-label="التنقل الرئيسي">
    <div class="hr-brand">
      <span class="hr-brand-logo" id="hr-co-logo">BP</span>
      <span><b id="hr-co-name">منصة التوظيف</b><small>Business Partner HR</small></span>
    </div>
    <nav class="hr-nav">
      <span class="hr-nav-label">التوظيف</span>
        ${nav}
    </nav>
  </aside>
  <div class="hr-overlay" id="hr-overlay"></div>
  <div class="hr-main">
    <header class="hr-top">
      <button class="tb-btn hr-burger" id="hr-burger" aria-label="فتح القائمة">${ic("menu", 20)}</button>
      <button class="tb-btn" id="hr-collapse" aria-label="طي القائمة الجانبية" title="طي/فتح القائمة">${ic("chevL", 18)}</button>
      <div class="hr-search" role="search">
        ${ic("search", 16)}
        <input type="search" id="hr-global-q" placeholder="ابحث عن مرشّح أو وظيفة…" aria-label="بحث عام">
      </div>
      <button class="tb-btn" id="hr-notif" aria-label="الإشعارات">${ic("bell", 19)}<span class="tb-dot" id="hr-notif-dot" hidden></span></button>
      <button class="tb-btn" id="hr-msgs" aria-label="الرسائل">${ic("msg", 19)}</button>
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
<script>window.HR_LANG="ar";</script>
<script src="/assets/js/hr-app.js?v=${JS_V}" defer></script>
</body>
</html>`;
}

/* ---------- Pages ---------- */

const dashboardBody = `
      <div class="hr-page-head">
        <div><h1 id="dash-hello">مرحباً 👋</h1><p>إليك نظرة عامة على أداء التوظيف في شركتك اليوم.</p></div>
        <a class="hr-btn hr-btn-primary" href="/hr/employer/jobs/new">${ic("plus", 16)} نشر وظيفة جديدة</a>
      </div>
      <div class="hr-kpis" id="dash-kpis"><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div><div class="hr-skel" style="height:96px"></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        <section class="hr-card"><div class="hd"><h2>قمع التوظيف</h2><a href="/hr/employer/applicants">التفاصيل</a></div><div class="bd"><div class="hr-funnel" id="dash-funnel"></div></div></section>
        <section class="hr-card"><div class="hd"><h2>المقابلات القادمة</h2><a href="/hr/employer/interviews">الكل</a></div><div class="bd" id="dash-interviews"></div></section>
      </div>
      <section class="hr-card"><div class="hd"><h2>الوظائف النشطة</h2><a href="/hr/employer/jobs">كل الوظائف</a></div><div class="hr-tbl-wrap" id="dash-jobs"></div></section>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        <section class="hr-card"><div class="hd"><h2>مرشّحون موصى بهم <span class="hr-tag t-ai">${ic("spark", 12)} AI</span></h2><a href="/hr/employer/applicants">الكل</a></div><div class="bd" id="dash-recommended"></div></section>
        <section class="hr-card"><div class="hd"><h2>آخر النشاطات</h2></div><div class="bd" id="dash-activity"></div></section>
      </div>`;

const jobsBody = `
      <div class="hr-page-head">
        <div><h1>الوظائف</h1><p>كل وظائف شركتك — أنشئ، عدّل، شارك وتابع المتقدمين.</p></div>
        <a class="hr-btn hr-btn-primary" href="/hr/employer/jobs/new">${ic("plus", 16)} نشر وظيفة جديدة</a>
      </div>
      <div class="hr-toolbar">
        <input type="search" id="jb-q" placeholder="ابحث بالمسمى أو القسم…" aria-label="بحث في الوظائف">
        <select id="jb-status" aria-label="فلترة بالحالة"><option value="">كل الحالات</option><option>منشورة</option><option>مسودة</option><option>قيد المراجعة</option><option>متوقفة</option><option>منتهية</option><option>مغلقة</option></select>
        <select id="jb-city" aria-label="فلترة بالمدينة"><option value="">كل المدن</option></select>
        <select id="jb-sort" aria-label="ترتيب"><option value="new">الأحدث أولاً</option><option value="old">الأقدم أولاً</option><option value="apps">الأكثر تقديمات</option></select>
        <span class="sp"></span>
        <div class="hr-views" role="tablist" aria-label="طريقة العرض">
          <button id="jb-view-table" class="active" aria-label="عرض جدول">${ic("list", 16)}</button>
          <button id="jb-view-cards" aria-label="عرض بطاقات">${ic("grid", 16)}</button>
        </div>
      </div>
      <section class="hr-card"><div id="jb-wrap"><div class="bd"><div class="hr-skel" style="height:180px"></div></div></div></section>
      <div class="hr-pgn" id="jb-pgn" hidden></div>`;

const jobNewBody = `
      <div class="hr-page-head">
        <div><h1 id="wiz-title">نشر وظيفة جديدة</h1><p>أكمل الخطوات — تُحفظ المسودة تلقائياً في كل خطوة.</p></div>
        <a class="hr-btn hr-btn-ghost" href="/hr/employer/jobs">رجوع للوظائف</a>
      </div>
      <div class="hr-wiz">
        <aside class="hr-wiz-steps" id="wiz-steps" aria-label="خطوات النشر"></aside>
        <section class="hr-card"><div class="bd">
          <form id="wiz-form" novalidate></form>
          <div class="hr-wiz-foot">
            <button class="hr-btn hr-btn-ghost" id="wiz-prev" type="button">السابق</button>
            <span style="display:flex;gap:8px">
              <button class="hr-btn hr-btn-ghost" id="wiz-save" type="button">حفظ كمسودة</button>
              <button class="hr-btn hr-btn-primary" id="wiz-next" type="button">التالي</button>
            </span>
          </div>
        </div></section>
      </div>`;

const jobViewBody = `
      <div id="jv-root"><div class="hr-skel" style="height:220px"></div></div>`;

const applicantsBody = `
      <div class="hr-page-head">
        <div><h1>المتقدمون</h1><p>مسار ATS — اسحب المرشّح بين المراحل أو بدّل لعرض الجدول.</p></div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="hr-views" role="tablist" aria-label="طريقة العرض">
            <button id="ap-view-kanban" class="active" aria-label="عرض كانبان">${ic("grid", 16)}</button>
            <button id="ap-view-table" aria-label="عرض جدول">${ic("list", 16)}</button>
          </div>
        </div>
      </div>
      <div class="hr-toolbar">
        <select id="ap-job" aria-label="اختيار الوظيفة" style="min-width:210px"><option value="">كل الوظائف</option></select>
        <input type="search" id="ap-q" placeholder="ابحث عن مرشّح…" aria-label="بحث عن مرشح">
        <select id="ap-nat" aria-label="الجنسية"><option value="">كل الجنسيات</option><option value="سعودي">سعوديون</option><option value="غير">غير سعوديين</option></select>
        <select id="ap-src" aria-label="المصدر"><option value="">كل المصادر</option></select>
        <select id="ap-match" aria-label="نسبة المطابقة"><option value="">أي مطابقة</option><option value="85">85%+</option><option value="70">70%+</option></select>
        <span class="sp"></span>
        <span id="ap-bulk" hidden style="display:flex;gap:8px;align-items:center">
          <span class="hr-tag t-teal" id="ap-bulk-n"></span>
          <button class="hr-btn hr-btn-sm hr-btn-soft" id="ap-bulk-shortlist">نقل للقائمة المختصرة</button>
          <button class="hr-btn hr-btn-sm hr-btn-danger" id="ap-bulk-reject">استبعاد</button>
        </span>
      </div>
      <div id="ap-root"><div class="hr-skel" style="height:300px"></div></div>`;

const applicantBody = `
      <div id="cp-root"><div class="hr-skel" style="height:280px"></div></div>`;

const matchingBody = `
      <div class="hr-page-head">
        <div><h1>المطابقة الذكية</h1><p>اختر وظيفة وشغّل المطابقة — درجات موزونة قابلة للضبط مع شرح واضح لكل نتيجة.</p></div>
        <button class="hr-btn hr-btn-primary" id="mt-run">${ic("spark", 16)} تشغيل المطابقة</button>
      </div>
      <div class="hr-toolbar">
        <select id="mt-job" aria-label="اختيار الوظيفة" style="min-width:240px"></select>
        <select id="mt-cat" aria-label="فلترة بالفئة"><option value="">كل الفئات</option><option value="strong">مطابقة قوية (85+)</option><option value="good">مطابق جيد (70–84)</option><option value="review">يحتاج مراجعة (50–69)</option><option value="weak">مطابقة ضعيفة (&lt;50)</option></select>
        <span class="sp"></span>
        <button class="hr-btn hr-btn-ghost hr-btn-sm" id="mt-weights-toggle">⚖️ إعدادات الأوزان</button>
        <span class="hr-hint" id="mt-last-run"></span>
      </div>
      <section class="hr-card" id="mt-weights" hidden><div class="hd"><h2>أوزان المطابقة (المجموع 100%)</h2><button class="hr-link" id="mt-weights-reset">استعادة الافتراضي</button></div><div class="bd"><div id="mt-weights-grid" class="hr-kv"></div><p class="hr-hint" style="margin-top:10px">تُطبق الأوزان في التشغيل التالي. الشروط الإلزامية (MUST_HAVE) تُعامل كفلتر صريح، والمعلومة غير المعروفة لا تستبعد المرشّح — تُعلَّم كـ UNKNOWN وتُطلب منه.</p></div></section>
      <div class="hr-kpis" id="mt-kpis" hidden></div>
      <section class="hr-card" id="mt-dist-card" hidden><div class="hd"><h2>توزيع الدرجات</h2></div><div class="bd" id="mt-dist"></div></section>
      <div id="mt-results"><div class="hr-empty"><div class="e-ic">✨</div><b>اختر وظيفة وشغّل المطابقة</b><p>يحلل المحرك كل المرشّحين في قاعدتك ويرتبهم بدرجة مفصّلة.</p></div></div>
      <section class="hr-card" id="mt-history-card" hidden><div class="hd"><h2>سجل عمليات المطابقة</h2></div><div class="bd" id="mt-history"></div></section>`;

// Sections not yet built get a real page with the shared layout, a clear
// "under construction" state and an honest scope note — nav never dead-ends.
const STUBS = [
  ["talent-pool", "talent", "قاعدة المواهب", "بحث موحّد في كل مرشّحي شركتك، قوائم محفوظة، وسوم، استيراد CSV ورفع سير ذاتية — مع كشف التكرار.", "database"],
  ["interviews", "interviews", "المقابلات", "تقويم يومي وأسبوعي وشهري، ربط المقابلة بالوظيفة والمرشّح، لجان تقييم وتذكيرات.", "calendar"],
  ["messages", "messages", "الرسائل", "صندوق موحّد للبريد ورسائل المنصة مع قوالب ومتغيرات تلقائية وجدولة إرسال.", "mail"],
  ["offers", "offers", "العروض والتعيين", "إنشاء عرض وظيفي بالراتب والبدلات والمزايا، موافقات داخلية، وتحويل المقبولين إلى Onboarding.", "filetext"],
  ["reports", "reports", "التقارير", "زمن التوظيف، مصادر المرشّحين، معدلات التحويل بين المراحل وأداء كل وظيفة.", "chart"],
  ["billing", "billing", "الفواتير والباقات", "باقتك الحالية وفواتيرك وسجل المدفوعات.", "card"],
  ["team", "team", "فريق العمل والصلاحيات", "أدوار (مالك، مدير موارد بشرية، مسؤول توظيف، مدير قسم، محاور، مشاهدة فقط) بصلاحيات دقيقة لكل إجراء.", "shield"],
  ["company", "company", "صفحة الشركة", "ملف شركتك العام الذي يراه المتقدمون: النبذة والفروع والصور.", "building"],
  ["integrations", "integrations", "التكاملات", "الربط مع البريد وGoogle Calendar وواتساب Business وقنوات النشر.", "plug"],
  ["settings", "settings", "الإعدادات", "إعدادات الحساب والشركة ومراحل التوظيف الافتراضية.", "settings"],
  ["help", "help", "مركز المساعدة", "أدلة الاستخدام والتواصل مع فريق Business Partner.", "help"],
];

const stubBody = (title, desc, icon) => `
      <div class="hr-page-head"><div><h1>${title}</h1></div></div>
      <section class="hr-card"><div class="bd">
        <div class="hr-empty">
          <div class="e-ic">${ic(icon, 34)}</div>
          <b>هذه الوحدة قيد البناء</b>
          <p style="max-width:480px;margin:0 auto 14px">${desc}</p>
          <span class="hr-tag t-orange">قادمة في المرحلة التالية</span>
          <p style="margin-top:16px"><a class="hr-btn hr-btn-ghost" href="/hr/employer">رجوع للوحة الرئيسية</a></p>
        </div>
      </div></section>`;

export function buildHRAppPages() {
  const pages = [
    ["hr/employer.html", shell({ title: "لوحة صاحب العمل", active: "home", page: "dashboard", body: dashboardBody })],
    ["hr/employer/jobs.html", shell({ title: "الوظائف", active: "jobs", page: "jobs", body: jobsBody })],
    ["hr/employer/jobs/new.html", shell({ title: "نشر وظيفة", active: "jobs", page: "job-new", body: jobNewBody })],
    ["hr/employer/job.html", shell({ title: "تفاصيل الوظيفة", active: "jobs", page: "job-view", body: jobViewBody })],
    ["hr/employer/applicants.html", shell({ title: "المتقدمون", active: "applicants", page: "applicants", body: applicantsBody, wide: true })],
    ["hr/employer/applicant.html", shell({ title: "ملف المرشّح", active: "applicants", page: "applicant", body: applicantBody })],
    ["hr/employer/matching.html", shell({ title: "المطابقة الذكية", active: "matching", page: "matching", body: matchingBody })],
  ];
  for (const [slug, key, title, desc, icon] of STUBS) {
    pages.push([`hr/employer/${slug}.html`, shell({ title, active: key, page: `stub-${key}`, body: stubBody(title, desc, icon) })]);
  }
  return pages;
}
