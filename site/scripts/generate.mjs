// Business Partner — static site generator (no framework, plain Node)
// Reads data/*.json and emits static HTML pages into the site root.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

// Copy brand image assets from the repo's committed public/ folder into the
// static output. Keeps binary assets out of the generated tree in git while
// still producing them at build time (Vercel checks out the whole repo).
function copyAsset(src, dest) {
  const from = path.join(ROOT, "..", "public", src);
  const to = path.join(ROOT, "assets/img", dest);
  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}
copyAsset("logo.png", "logo.png");
copyAsset("favicon.svg", "favicon.svg");
copyAsset("Facebook Cover Photo.png", "cover.png");

const site = read("data/site.json");
const services = read("data/services.json");
const categories = read("data/categories.json");

const WA = site.whatsapp;
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- SVG icons ---------- */
const I = {
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M2 13v3M22 13v3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M10 21v-4h4v4"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>',
};

const waBtn = (label, cls = "btn-wa", lg = false) =>
  `<a class="btn ${cls}${lg ? " btn-lg" : ""}" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${esc(label)}</span></a>`;

/* ---------- layout ---------- */
function head(title, desc) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/assets/img/cover.png">
<meta name="theme-color" content="#0B1B5A">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>`;
}

function header(active) {
  const links = site.nav
    .map((n) => `<a href="${n.href}"${n.href === active ? ' class="active"' : ""}>${esc(n.label)}</a>`)
    .join("");
  return `<header class="site-header"><div class="container header-inner">
  <a class="logo" href="/" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <nav class="nav" aria-label="التنقل الرئيسي">${links}<a class="btn btn-wa nav-cta" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>ابدأ على واتساب</span></a></nav>
  <div class="header-cta">
    <a class="btn btn-ghost" href="/contact">تواصل معنا</a>
    ${waBtn("ابدأ الآن", "btn-primary")}
    <button class="nav-toggle" aria-label="القائمة" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
  </div>
</div></header>`;
}

function footer() {
  const c = site.contact;
  const svcLinks = categories
    .slice(0, 6)
    .map((cat) => `<li><a href="/services#${slugCat(cat.key)}">${esc(cat.ar)}</a></li>`)
    .join("");
  return `<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div>
      <div class="footer-logo"><img src="/assets/img/logo.png" alt="Business Partner" width="160" height="30"></div>
      <p>${esc(site.brand.shortBio)}</p>
      <p class="footer-tag">${esc(site.brand.tagline)}</p>
    </div>
    <div class="footer-col"><h4>روابط</h4><ul>
      <li><a href="/about">من نحن</a></li>
      <li><a href="/services">الخدمات</a></li>
      <li><a href="/packages">الباقات</a></li>
      <li><a href="/saudi-arabia">السعودية</a></li>
      <li><a href="/news">الأخبار</a></li>
      <li><a href="/careers">الوظائف</a></li>
      <li><a href="/calculator">الحاسبة</a></li>
      <li><a href="/contact">اتصل بنا</a></li>
    </ul></div>
    <div class="footer-col"><h4>خدمات مختارة</h4><ul>${svcLinks}</ul></div>
    <div class="footer-col"><h4>تواصل</h4><ul class="footer-contact">
      <li>${I.phone}<span>${esc(c.phone)}</span></li>
      <li>${I.mail}<span>${esc(c.email)}</span></li>
      <li>${I.pin}<span>${esc(c.address)}</span></li>
      <li>${I.wa}<a href="${WA}" target="_blank" rel="noopener">الوكيل الذكي على واتساب</a></li>
    </ul></div>
  </div>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} Business Partner. جميع الحقوق محفوظة. · س.ت ${esc(c.cr)}</span>
    <span>${esc(c.hours)}</span>
  </div>
</div></footer>`;
}

function waFab() {
  return `<a class="wa-fab" href="${WA}" target="_blank" rel="noopener" aria-label="تواصل عبر واتساب">${I.wa}<span class="lbl">تحدث مع الوكيل الذكي</span></a>`;
}

function page({ title, desc, active, body, script = "" }) {
  return (
    head(title, desc) +
    header(active) +
    `<main>${body}</main>` +
    footer() +
    waFab() +
    `<script src="/assets/js/main.js"></script>${script}</body></html>`
  );
}

const slugCat = (key) => "cat-" + key.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

/* ---------- service helpers ---------- */
function audienceOf(s, ov) {
  if (ov && ov.audience) return ov.audience;
  if (s.targetClient) return s.targetClient;
  return "أفراد ومنشآت";
}
function documentsOf(s, ov) {
  if (ov && ov.documents) return ov.documents;
  const base = [
    "الوثائق الرسمية (سجل تجاري أو هوية حسب الحالة)",
    "المستندات الخاصة بنشاطك أو بطلب الخدمة",
    "سداد الرسوم المقررة للجهة المختصة",
  ];
  return base;
}
function featuresOf(s, ov) {
  if (ov && ov.features) return ov.features;
  const feats = [];
  if (s.deliverables && s.deliverables.length) feats.push(...s.deliverables.slice(0, 4));
  feats.push("ننجز الإجراء نيابةً عنك من البداية حتى الإصدار");
  feats.push("أتعاب واضحة والرسوم الحكومية منفصلة ومعلنة");
  feats.push("دعم الوكيل الذكي على واتساب 24/7");
  return feats.slice(0, 7);
}
function faqOf(s, ov) {
  if (ov && ov.faq) return ov.faq;
  const faq = [];
  faq.push({
    q: "كم تبلغ أتعاب هذه الخدمة؟",
    a:
      (s.price.amount != null ? `أتعاب Business Partner لهذه الخدمة ${s.price.label}. ` : "تُسعّر هذه الخدمة بعرض مخصّص حسب حالتك. ") +
      (s.govFeesSeparate ? "الرسوم الحكومية منفصلة عن الأتعاب وتُعلن قبل البدء." : "وتُضاف ضريبة القيمة المضافة."),
  });
  faq.push({ q: "لمن هذه الخدمة؟", a: `هذه الخدمة متاحة لـ${audienceOf(s, ov)}.` });
  if (s.govPlatform) faq.push({ q: "ما الجهة المختصة؟", a: `تُقدَّم الخدمة عبر ${s.govPlatform}، ونتولّى نحن التقديم والمتابعة معها.` });
  faq.push({
    q: "كيف أبدأ؟",
    a: "تواصل معنا على واتساب، والوكيل الذكي يحدد متطلباتك، يجهّز قائمة مستنداتك، ويبدأ تنفيذ طلبك فوراً.",
  });
  return faq;
}

function serviceQuickFacts(s, ov) {
  const facts = [];
  facts.push(`<span class="chip">${I.tag}${esc(s.categoryAr)}</span>`);
  if (ov && ov.duration) facts.push(`<span class="chip">${I.clock}${esc(ov.duration)}</span>`);
  facts.push(`<span class="chip">${I.users}${esc(audienceOf(s, ov))}</span>`);
  if (s.govPlatform) facts.push(`<span class="chip">${I.building}${esc(s.govPlatform)}</span>`);
  return facts.join("");
}

/* ---------- pages ---------- */
function buildHome() {
  const h = site.home;
  const whyCards = h.why.items
    .map(
      (it) => `<div class="card feature"><div class="card-icon">${I[it.icon] || I.check}</div>
      <h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div>`
    )
    .join("");
  const svcCards = h.coreServices.cards
    .map(
      (c) => `<a class="card svc-card" href="/services#${slugCat(c.category)}">
      <div class="card-icon">${I.building}</div>
      <h3>${esc(c.title)}</h3><p class="desc">${esc(c.text)}</p>
      <span class="card-link">استعرض الخدمات ${I.arrow}</span></a>`
    )
    .join("");
  const pkgCards = site.packages.tiers
    .map(
      (t) => `<div class="pkg${t.highlight ? " pop" : ""}">
      <div class="pk-name">${esc(t.nameAr)}<small>${esc(t.name)}</small></div>
      ${t.price ? `<div class="pk-price">${esc(t.price)}</div>` : ""}
      <p class="pk-for">${esc(t.for)}</p>
      <ul>${t.features.slice(0, 4).map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("")}</ul>
      <a class="btn ${t.highlight ? "btn-primary" : "btn-ghost"}" href="/packages">تفاصيل الباقة</a>
    </div>`
    )
    .join("");
  const agentBullets = h.agent.bullets.map((b) => `<li>${I.check}<span>${esc(b)}</span></li>`).join("");
  const stats = h.stats.items.map((s) => `<div class="stat"><div class="num">${esc(s.value)}</div><div class="lbl">${esc(s.label)}</div></div>`).join("");
  const quotes = h.testimonials.items
    .map((q) => `<div class="quote"><p>${esc(q.text)}</p><div class="who">${esc(q.name)}</div><div class="role">${esc(q.role)}</div></div>`)
    .join("");

  const body = `
  <section class="hero"><div class="container hero-inner">
    <p class="hero-tagline">${esc(site.brand.tagline)}</p>
    <h1>${esc(h.heroTitle)}</h1>
    <p class="lead">${esc(h.heroSubtitle)}</p>
    <div class="hero-actions">${waBtn(h.heroCta, "btn-primary", true)}<a class="btn btn-ghost btn-lg" href="/services">${esc(h.heroCtaSecondary)}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}رد فوري 24/7</span>
      <span class="hero-badge">${I.check}+90 خدمة حكومية</span>
      <span class="hero-badge">${I.check}أتعاب شفافة</span>
    </div>
  </div></section>

  <section class="section section--navy trust-band"><div class="container">
    <div class="section-head"><span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${esc(h.stats.eyebrow || "أرقام ثقة")}</span><h2 style="color:#fff">${esc(h.stats.title)}</h2></div>
    <div class="stats">${stats}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">لماذا نحن</span><h2>${esc(h.why.title)}</h2></div>
    <div class="grid grid-3">${whyCards}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">الخدمات</span><h2>${esc(h.coreServices.title)}</h2><p>${esc(h.coreServices.subtitle)}</p></div>
    <div class="grid grid-3">${svcCards}</div>
    <div class="center mt-32"><a class="btn btn-primary" href="/services">كل الخدمات ${I.arrow}</a></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">الباقات</span><h2>${esc(site.packages.title)}</h2><p>${esc(site.packages.subtitle)}</p></div>
    <div class="grid grid-3">${pkgCards}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="agent"><div class="agent-inner">
      <div>
        <span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">الميزة القاتلة</span>
        <h2>${esc(h.agent.title)}</h2>
        <p>${esc(h.agent.text)}</p>
        <ul class="agent-list">${agentBullets}</ul>
        ${waBtn(h.agent.cta, "btn-white", true)}
      </div>
      <div class="agent-visual">
        <div class="bubble"><span>أنت</span>أبغى أأسس شركة أجنبية، وش المستندات؟</div>
        <div class="bubble me"><span>الوكيل الذكي · الآن</span>تمام! أحتاج السجل التجاري للشركة الأم مصدّق، القوائم المالية، وقرار مجلس الإدارة. أجهّز لك القائمة كاملة؟</div>
      </div>
    </div></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">آراء العملاء</span><h2>${esc(h.testimonials.title)}</h2><p>${esc(h.testimonials.note)}</p></div>
    <div class="grid grid-3">${quotes}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>${esc(h.finalCta.title)}</h2><p>${esc(h.finalCta.text)}</p>${waBtn(h.finalCta.cta, "btn-white", true)}</div>
  </div></section>`;

  return page({ title: "Business Partner — شريك تشغيل أعمالك في السعودية", desc: esc(site.brand.shortBio), active: "/", body });
}

function buildAbout() {
  const a = site.about;
  const secs = a.sections.map((s) => `<div class="card"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("");
  const vals = a.values.map((v) => `<div class="card feature"><div class="card-icon">${I.check}</div><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">من نحن</span>
    <h1>${esc(a.title)}</h1>
    <p class="lead">${esc(a.lead)}</p>
    <div class="hero-actions">${waBtn("تحدث معنا", "btn-primary")}<a class="btn btn-ghost" href="/services">استعرض الخدمات</a></div>
  </div></section>
  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">وعدنا</span><h2>${esc(a.promise)}</h2></div>
    <div class="grid grid-3">${secs}</div>
  </div></section>
  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">قيمنا</span><h2>ما الذي يوجّه عملنا</h2></div>
    <div class="grid grid-4">${vals}</div>
  </div></section>
  <section class="section"><div class="container">
    <div class="cta-band"><h2>جاهز نبدأ رحلتك؟</h2><p>الوكيل الذكي يرد فوراً على واتساب ويحدد لك الخطوة التالية.</p>${waBtn("ابدأ الآن", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "من نحن — Business Partner", desc: esc(a.lead), active: "/about", body });
}

function buildServicesIndex() {
  const catNav = categories.map((c) => `<a href="#${slugCat(c.key)}">${esc(c.ar)}</a>`).join("");
  const blocks = categories
    .map((cat) => {
      const list = services.filter((s) => s.category === cat.key);
      const cards = list
        .map(
          (s) => `<a class="card svc-card" href="/services/${s.slug}">
        <span class="tag">${esc(s.categoryAr)}</span>
        <h3>${esc(s.name)}</h3>
        <p class="desc">${esc((s.description || "").slice(0, 120))}${(s.description || "").length > 120 ? "…" : ""}</p>
        <div class="foot"><span class="price">${esc(s.price.label)}</span><span class="card-link">التفاصيل ${I.arrow}</span></div>
      </a>`
        )
        .join("");
      return `<div class="cat-block" id="${slugCat(cat.key)}">
        <h2>${esc(cat.ar)} <span class="count">${cat.count} خدمة</span></h2>
        <p>خدمات ${esc(cat.ar)} — بأتعاب واضحة من الكتالوج الرسمي.</p>
        <div class="grid grid-3">${cards}</div>
      </div>`;
    })
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">الخدمات</span>
    <h1>كل خدماتنا في مكان واحد</h1>
    <p class="lead">${services.length} خدمة مصنّفة حسب الكتالوج الرسمي لـ Business Partner — لكل خدمة صفحة كاملة بالمستندات والمميزات والأسعار.</p>
  </div></section>
  <section class="section"><div class="container">
    <nav class="cat-nav">${catNav}</nav>
    ${blocks}
    <div class="cta-band" style="margin-top:20px"><h2>ما لقيت خدمتك؟</h2><p>أرسل لنا استفسارك، والوكيل الذكي يحدد الخدمة المناسبة لحالتك فوراً.</p>${waBtn("اسأل الوكيل الذكي", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "الخدمات — Business Partner", desc: `${services.length} خدمة حكومية وتجارية بأتعاب واضحة من الكتالوج الرسمي.`, active: "/services", body });
}

function buildServiceDetail(s) {
  const ov = site.overrides[s.slug];
  const docs = documentsOf(s, ov);
  const feats = featuresOf(s, ov);
  const faq = faqOf(s, ov);
  const genericDocsNote = !(ov && ov.documents)
    ? `<div class="callout" style="margin-top:16px"><span class="ico">💡</span><p>يحدد الوكيل الذكي قائمة المستندات الدقيقة لحالتك فور تواصلك على واتساب.</p></div>`
    : "";
  const docsHtml = docs.map((d) => `<li>${I.doc}<span>${esc(d)}</span></li>`).join("");
  const featsHtml = feats.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("");
  const faqHtml = faq
    .map(
      (f) => `<div class="faq-item"><button class="faq-q" aria-expanded="false">${esc(f.q)} ${I.chevron}</button>
    <div class="faq-a"><p>${esc(f.a)}</p></div></div>`
    )
    .join("");

  const facts = [];
  facts.push(`<li><span class="k">الفئة</span><span class="v">${esc(s.categoryAr)}</span></li>`);
  if (ov && ov.duration) facts.push(`<li><span class="k">المدة</span><span class="v">${esc(ov.duration)}</span></li>`);
  facts.push(`<li><span class="k">متاح لـ</span><span class="v">${esc(audienceOf(s, ov))}</span></li>`);
  if (s.govPlatform) facts.push(`<li><span class="k">الجهة</span><span class="v">${esc(s.govPlatform)}</span></li>`);
  facts.push(`<li><span class="k">الكود</span><span class="v">${esc(s.code)}</span></li>`);

  const priceNote = s.govFeesSeparate
    ? "الأتعاب لا تشمل الرسوم الحكومية وضريبة القيمة المضافة."
    : "الأتعاب لا تشمل ضريبة القيمة المضافة.";

  const body = `
  <section class="svc-hero"><div class="container">
    <div class="breadcrumb"><a href="/">الرئيسية</a> ← <a href="/services">الخدمات</a> ← <a href="/services#${slugCat(s.category)}">${esc(s.categoryAr)}</a></div>
    <h1>${esc(s.name)}</h1>
    <div class="svc-meta">${serviceQuickFacts(s, ov)}</div>
  </div></section>
  <div class="container"><div class="svc-layout">
    <div class="svc-main">
      <section><h2>وصف الخدمة</h2><p class="lead-p">${esc((ov && ov.description) || s.description || "نتولّى في Business Partner تنفيذ هذه الخدمة نيابةً عنك من البداية حتى الإصدار، بمعرفة دقيقة بالأنظمة والإجراءات.")}</p></section>
      <section><h2>المستندات المطلوبة</h2><ul class="doc-list">${docsHtml}</ul>${genericDocsNote}</section>
      <section><h2>مميزات الخدمة مع Business Partner</h2><ul class="feat-list">${featsHtml}</ul></section>
      <section><h2>الأسئلة الشائعة</h2>${faqHtml}</section>
      <section><div class="callout"><span class="ico">⚡</span><p><strong>ميزة Business Partner:</strong> الوكيل الذكي على واتساب يسحب متطلبات هذه الخدمة فوراً، يجهّز قائمة مستنداتك تلقائياً، ويبدأ طلبك على مدار الساعة.</p></div></section>
    </div>
    <aside class="svc-aside">
      <div class="order-box">
        <div class="price-big">${esc(s.price.label)}</div>
        <div class="price-note">${esc(priceNote)}</div>
        ${waBtn("اطلب هذه الخدمة", "btn-wa")}
        <a class="btn btn-ghost" href="/calculator?service=${encodeURIComponent(s.code)}">احسب التكلفة</a>
        <p class="mini">رد فوري من الوكيل الذكي 24/7</p>
        <ul class="order-facts">${facts.join("")}</ul>
      </div>
    </aside>
  </div></div>`;
  const desc = ((ov && ov.description) || s.description || s.name).slice(0, 155);
  return page({ title: `${s.name} — Business Partner`, desc: esc(desc), active: "/services", body });
}

function buildPackages() {
  const p = site.packages;
  const tiers = p.tiers
    .map(
      (t) => `<div class="pkg${t.highlight ? " pop" : ""}">
      <div class="pk-name">${esc(t.nameAr)}<small>${esc(t.name)}</small></div>
      ${t.price ? `<div class="pk-price">${esc(t.price)}</div>` : ""}
      <p class="pk-for">${esc(t.for)}</p>
      <ul>${t.features.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("")}</ul>
      ${waBtn("اطلب الباقة", t.highlight ? "btn-wa" : "btn-ghost")}
    </div>`
    )
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">الباقات</span>
    <h1>${esc(p.title)}</h1>
    <p class="lead">${esc(p.subtitle)}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3">${tiers}</div>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${esc(p.note)}</p></div>
  </div></section>
  <section class="section section--gray"><div class="container">
    <div class="cta-band"><h2>محتار أي باقة تناسبك؟</h2><p>الوكيل الذكي يسألك بضعة أسئلة ويرشّح لك الباقة الأنسب في دقائق.</p>${waBtn("ساعدني أختار", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "الباقات — Business Partner", desc: esc(p.subtitle), active: "/packages", body });
}

function buildCalculator() {
  const mini = services.map((s) => ({
    code: s.code,
    name: s.name,
    categoryAr: s.categoryAr,
    govFeesSeparate: s.govFeesSeparate,
    price: { amount: s.price.amount, label: s.price.label },
  }));
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">حاسبة التكلفة</span>
    <h1>احسب تكلفة خدمتك في ثوانٍ</h1>
    <p class="lead">اختر الخدمة ليظهر لك أتعاب Business Partner وضريبة القيمة المضافة تقديرياً. الرسوم الحكومية (إن وجدت) منفصلة وتُعلن قبل البدء.</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="calc-wrap" id="calc">
      <div class="calc-form">
        <div class="field"><label for="calc-service">الخدمة</label>
          <select id="calc-service"></select></div>
        <div class="field"><label for="calc-qty">العدد</label>
          <input id="calc-qty" type="number" min="1" value="1"></div>
        <p class="form-note">الأرقام تقديرية بناءً على الكتالوج الرسمي، وقد تختلف حسب تفاصيل حالتك. للسعر النهائي، تواصل مع الوكيل الذكي.</p>
      </div>
      <div class="calc-result">
        <h3>ملخص التقدير</h3>
        <div class="calc-line"><span class="k">أتعاب Business Partner</span><span class="v" id="calc-fee">—</span></div>
        <div class="calc-line"><span class="k">ضريبة القيمة المضافة (15%)</span><span class="v" id="calc-vat">—</span></div>
        <div class="calc-line" id="calc-gov" style="display:none"><span class="k">الرسوم الحكومية</span><span class="v">منفصلة — تُعلن قبل البدء</span></div>
        <div class="calc-total"><span class="k">الإجمالي التقديري</span><span class="v" id="calc-total">—</span></div>
        <p class="calc-note" id="calc-extra-note"></p>
        <a class="btn btn-wa" id="calc-wa" data-wa="${WA}" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>اطلب عرضاً دقيقاً</span></a>
      </div>
    </div>
  </div></section>
  <script>window.BP_SERVICES = ${JSON.stringify(mini)};</script>`;
  return page({ title: "حاسبة التكلفة — Business Partner", desc: "احسب تكلفة أي خدمة من خدمات Business Partner تقديرياً مع ضريبة القيمة المضافة.", active: "/calculator", body });
}

function buildSaudi() {
  const s = site.saudiArabia;
  const targets = s.vision.targets.map((t) => `<div class="stat"><div class="num">${esc(t.value)}</div><div class="lbl">${esc(t.label)}</div></div>`).join("");
  const sectors = s.sectors.items
    .map(
      (it) => `<a class="card svc-card" href="/services#${slugCat(it.category)}">
      <div class="card-icon">${I.building}</div>
      <h3>${esc(it.title)}</h3><p class="desc">${esc(it.text)}</p>
      <span class="card-link">استعرض الخدمات ${I.arrow}</span></a>`
    )
    .join("");
  const articles = s.knowledge.articles
    .map(
      (a) => `<a class="card article-card" href="${a.link}">
      <span class="tag">${I.doc}دليل معرفي</span>
      <h3>${esc(a.title)}</h3><p class="desc">${esc(a.excerpt)}</p>
      <span class="card-link">اقرأ المزيد ${I.arrow}</span></a>`
    )
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">السعودية</span>
    <h1>${esc(s.title)}</h1>
    <p class="lead">${esc(s.lead)}</p>
    <div class="hero-actions">${waBtn("ابدأ استثمارك", "btn-primary")}<a class="btn btn-ghost" href="/services">استعرض الخدمات</a></div>
  </div></section>

  <section class="section section--navy"><div class="container">
    <div class="section-head"><span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${esc(s.vision.eyebrow)}</span><h2 style="color:#fff">${esc(s.vision.title)}</h2></div>
    <div class="stats">${targets}</div>
    <p class="center" style="color:rgba(255,255,255,.6);font-size:.85rem;margin-top:26px">${esc(s.vision.source)}</p>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(s.sectors.eyebrow)}</span><h2>${esc(s.sectors.title)}</h2><p>${esc(s.sectors.subtitle)}</p></div>
    <div class="grid grid-3">${sectors}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(s.knowledge.eyebrow)}</span><h2>${esc(s.knowledge.title)}</h2><p>${esc(s.knowledge.subtitle)}</p></div>
    <div class="grid grid-3">${articles}</div>
    <div class="cta-band" style="margin-top:40px"><h2>تبي دليلاً مفصّلاً لحالتك؟</h2><p>الوكيل الذكي يجهّز لك خطوات خدمتك ومتطلباتها فوراً على واتساب.</p>${waBtn("اسأل الوكيل الذكي", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "السعودية — بيانات وأدلة الاستثمار | Business Partner", desc: esc(s.lead.slice(0, 155)), active: "/saudi-arabia", body });
}

function buildNews() {
  const n = site.news;
  const updates = n.platformUpdates.items
    .map(
      (u) => `<div class="card"><div class="update-head"><span class="update-badge">${esc(u.platform)}</span></div>
      <p>${esc(u.text)}</p></div>`
    )
    .join("");
  const stories = n.successStories.items
    .map((q) => `<div class="quote"><p>${esc(q.text)}</p><div class="role">${esc(q.tag)}</div></div>`)
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">الأخبار</span>
    <h1>${esc(n.title)}</h1>
    <p class="lead">${esc(n.lead)}</p>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(n.platformUpdates.eyebrow)}</span><h2>${esc(n.platformUpdates.title)}</h2><p>${esc(n.platformUpdates.subtitle)}</p></div>
    <div class="grid grid-3">${updates}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(n.successStories.eyebrow)}</span><h2>${esc(n.successStories.title)}</h2><p>${esc(n.successStories.note)}</p></div>
    <div class="grid grid-3">${stories}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${esc(n.partnerships.eyebrow)}</span><h2>${esc(n.partnerships.title)}</h2><p>${esc(n.partnerships.note)}</p>${waBtn("تواصل للشراكة", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "الأخبار والتحديثات — Business Partner", desc: esc(n.lead.slice(0, 155)), active: "/news", body });
}

function buildCareers() {
  const c = site.careers;
  const recs = services.filter((x) => x.category === "Recruitment");
  const recCards = recs
    .map(
      (x) => `<a class="card svc-card" href="/services/${x.slug}">
      <span class="tag">${esc(x.categoryAr)}</span>
      <h3>${esc(x.name)}</h3>
      <div class="foot"><span class="price">${esc(x.price.label)}</span><span class="card-link">التفاصيل ${I.arrow}</span></div></a>`
    )
    .join("");
  const f = c.seeker.fields;
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">الوظائف</span>
    <h1>${esc(c.title)}</h1>
    <p class="lead">${esc(c.lead)}</p>
    <div class="path-switch">
      <a class="btn btn-primary" href="#employers">${I.building}<span>أنا صاحب عمل</span></a>
      <a class="btn btn-ghost" href="#seekers">${I.users}<span>أبحث عن عمل</span></a>
    </div>
  </div></section>

  <section class="section" id="employers"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(c.employer.eyebrow)}</span><h2>${esc(c.employer.title)}</h2><p>${esc(c.employer.text)}</p></div>
    <div class="grid grid-3">${recCards}</div>
    <div class="center mt-32">${waBtn(c.employer.cta, "btn-primary", true)}</div>
  </div></section>

  <section class="section section--gray" id="seekers"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(c.seeker.eyebrow)}</span><h2>${esc(c.seeker.title)}</h2><p>${esc(c.seeker.text)}</p></div>
    <div style="max-width:640px;margin:0 auto">
      <form class="calc-form" action="${WA}" method="get" target="_blank">
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-name">${esc(f.name)}</label><input id="c-name" name="name" type="text" required></div>
          <div class="field"><label for="c-phone">${esc(f.phone)}</label><input id="c-phone" name="phone" type="tel"></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-email">${esc(f.email)}</label><input id="c-email" name="email" type="email"></div>
          <div class="field"><label for="c-exp">${esc(f.experience)}</label><input id="c-exp" name="experience" type="text" placeholder="مثال: 3 سنوات"></div>
        </div>
        <div class="field"><label for="c-field">${esc(f.field)}</label><input id="c-field" name="field" type="text" placeholder="مثال: محاسبة، تسويق، هندسة"></div>
        ${waBtn("أرسل طلبك عبر واتساب", "btn-wa")}
        <p class="form-note">${esc(c.seeker.note)}</p>
      </form>
    </div>
  </div></section>`;
  return page({ title: "الوظائف والتوظيف — Business Partner", desc: esc(c.lead.slice(0, 155)), active: "/careers", body });
}

function buildContact() {
  const c = site.contact;
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">تواصل معنا</span>
    <h1>نجاوبك فوراً</h1>
    <p class="lead">أسرع طريقة للتواصل هي الوكيل الذكي على واتساب — يرد 24/7. أو املأ النموذج ونعاود التواصل معك.</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="contact-grid">
      <div>
        <h2>معلومات التواصل</h2>
        <ul class="info-list">
          <li><span class="ico">${I.wa}</span><div><div class="k">واتساب — الوكيل الذكي</div><a class="v" href="${WA}" target="_blank" rel="noopener">تحدث الآن</a></div></li>
          <li><span class="ico">${I.phone}</span><div><div class="k">الهاتف</div><a class="v" href="tel:${esc(c.phoneIntl)}">${esc(c.phone)}</a></div></li>
          <li><span class="ico">${I.mail}</span><div><div class="k">البريد الإلكتروني</div><a class="v" href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>
          <li><span class="ico">${I.pin}</span><div><div class="k">العنوان</div><div class="v">${esc(c.address)}</div></div></li>
          <li><span class="ico">${I.clock}</span><div><div class="k">أوقات العمل</div><div class="v">${esc(c.hours)}</div></div></li>
        </ul>
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${encodeURIComponent("حي العارض الرياض")}&output=embed" loading="lazy" title="موقع Business Partner"></iframe>
        </div>
      </div>
      <div>
        <h2>أرسل رسالتك</h2>
        <form class="calc-form" action="${WA}" method="get" target="_blank" onsubmit="return true">
          <div class="field"><label for="f-name">الاسم</label><input id="f-name" name="name" type="text" placeholder="اسمك الكامل" required></div>
          <div class="field"><label for="f-phone">رقم الجوال</label><input id="f-phone" name="phone" type="tel" placeholder="05xxxxxxxx"></div>
          <div class="field"><label for="f-service">الخدمة المطلوبة</label><input id="f-service" name="service" type="text" placeholder="مثال: تأسيس شركة، إقامة مميزة"></div>
          <div class="field"><label for="f-msg">تفاصيل طلبك</label><textarea id="f-msg" name="message" rows="4" placeholder="اكتب استفسارك هنا"></textarea></div>
          ${waBtn("أرسل عبر واتساب", "btn-wa")}
          <p class="form-note">بالضغط على الزر يفتح واتساب لإكمال إرسال طلبك للوكيل الذكي مباشرة.</p>
        </form>
      </div>
    </div>
  </div></section>`;
  return page({ title: "اتصل بنا — Business Partner", desc: "تواصل مع Business Partner عبر واتساب أو الهاتف أو البريد — رد فوري من الوكيل الذكي 24/7.", active: "/contact", body });
}

/* ---------- write ---------- */
function write(rel, html) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

write("index.html", buildHome());
write("about.html", buildAbout());
write("services.html", buildServicesIndex());
write("packages.html", buildPackages());
write("calculator.html", buildCalculator());
write("saudi-arabia.html", buildSaudi());
write("news.html", buildNews());
write("careers.html", buildCareers());
write("contact.html", buildContact());
// Remove the retired blog page if a prior build produced it.
if (fs.existsSync(path.join(ROOT, "blog.html"))) fs.unlinkSync(path.join(ROOT, "blog.html"));
// Clean the services directory so removed catalog rows don't leave stale pages.
const svcDir = path.join(ROOT, "services");
if (fs.existsSync(svcDir)) {
  for (const f of fs.readdirSync(svcDir)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(svcDir, f));
  }
}
services.forEach((s) => write(`services/${s.slug}.html`, buildServiceDetail(s)));

// sitemap.xml
const base = "https://businesspartner.sa";
const urls = ["/", "/about", "/services", "/packages", "/calculator", "/saudi-arabia", "/news", "/careers", "/contact"]
  .concat(services.map((s) => `/services/${s.slug}`))
  .map((u) => `  <url><loc>${base}${u}</loc></url>`)
  .join("\n");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);

console.log(`Generated ${9 + services.length} pages + sitemap.`);
