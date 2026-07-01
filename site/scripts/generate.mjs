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
const svcI18n = read("data/service-i18n.json");

// Apply catalog overrides (price/name/description) from site.json to the list,
// so cards, the calculator, and detail pages all reflect them.
for (const s of services) {
  const ov = site.overrides && site.overrides[s.slug];
  if (!ov) continue;
  if (ov.name) s.name = ov.name;
  if (ov.description) s.description = ov.description;
  if (ov.priceLabel) {
    s.price = { label: ov.priceLabel, amount: ov.priceAmount ?? null, note: ov.priceNote || null };
  }
}

const WA = site.whatsapp;
const WA_SUPPORT = site.whatsappSupport || site.whatsapp;
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
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12.3a2 2 0 0 0 2 1.7h8.2a2 2 0 0 0 2-1.6L23 7H6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M12 15V3M7 8l5-5 5 5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>',
  channel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6M4 10v8M20 10v8M8 10v8M16 10v8M3 21h18"/></svg>',
};

/* ---------- bilingual build-time engine ----------
   The whole site is generated twice: English (LANG='en') at root paths,
   and Arabic (LANG='ar') under the /ar/ prefix. L() picks the string for the
   current build language; u() prefixes internal links for the Arabic tree. */
let LANG = "en";
const L = (en, ar) => esc(LANG === "ar" ? ar : en);
// Raw (unescaped) variant for when the caller needs plain text (title/desc/attributes).
const Lraw = (en, ar) => (LANG === "ar" ? ar : en);
// Internal-link prefixer: keeps external/anchor/asset links untouched.
const u = (href) => {
  if (LANG !== "ar") return href;
  if (!href || href[0] !== "/" || href.startsWith("/assets") || href.startsWith("/api") || href.startsWith("/ar/") || href === "/ar") return href === "/" ? "/ar/" : href;
  return "/ar" + href;
};
// Service name in the current build language (bilingual map → override → catalog).
function sName(s) {
  const m = svcI18n[s.code] || {};
  const ov = site.overrides[s.slug];
  if (LANG === "ar") return m.ar || (ov && ov.name) || s.name;
  return m.en || (ov && ov.nameEn) || s.name;
}
// Arabic name regardless of current build language (for cart data attributes).
const sNameArOf = (s) => { const m = svcI18n[s.code] || {}; const ov = site.overrides[s.slug]; return m.ar || (ov && ov.name) || s.name; };
// Service description in the current language. Overrides win; otherwise a template
// is built from the localized name + category (catalog descriptions are Arabic-only).
function sDesc(s) {
  const ov = site.overrides[s.slug];
  if (LANG === "ar") {
    if (ov && ov.description) return ov.description;
    return `نتولّى في بيزنس بارتنر تنفيذ خدمة «${sName(s)}» نيابةً عنك ضمن ${catAr(s.category)} — من تجهيز المستندات والرفع على الجهة المختصة حتى الإصدار، بأتعاب واضحة ومتابعة كاملة.`;
  }
  if (ov && ov.descriptionEn) return ov.descriptionEn;
  return `Business Partner handles “${sName(s)}” on your behalf within ${catEn(s.category)} — from preparing the documents and filing with the relevant authority through to issuance, with clear fees and full follow-up.`;
}
const catEn = (key) => (CAT_META[key] ? CAT_META[key].en : key);
const catAr = (key) => { const c = categories.find((x) => x.key === key); return c ? c.ar : key; };
// Category label in current language.
const catLabel = (key) => (LANG === "ar" ? catAr(key) : catEn(key));
// Localize an Arabic price label for the English tree (numbers + ﷼ kept).
function priceLabel(s) {
  const l = (s.price && s.price.label) || "";
  if (LANG === "ar") return l;
  return l
    .replace("يبدأ من", "From")
    .replace("نسبة من قيمة الصفقة", "% of deal value")
    .replace("نصف الراتب الشهري", "Half the monthly salary")
    .replace("/ شهرياً", "/ monthly")
    .replace("/ لكل مرشّح", "/ per candidate")
    .replace("شهرياً", "monthly")
    .replace("لكل مرشّح", "per candidate");
}
const saudiFlag =
  '<svg viewBox="0 0 24 16" width="22" height="15" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#006C35"/><path d="M5 5.4h11v.9H5zM5 10.1h11v.9H5z" fill="#fff"/><rect x="5" y="6.9" width="11" height="2.3" fill="none" stroke="#fff" stroke-width=".6"/></svg>';

const waBtn = (label, cls = "btn-wa", lg = false) =>
  `<a class="btn ${cls}${lg ? " btn-lg" : ""}" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${esc(label)}</span></a>`;
// Bilingual WhatsApp button (English-primary label shown by default, Arabic on flag toggle).
const waBtn2 = (en, ar, cls = "btn-wa", lg = false) =>
  `<a class="btn ${cls}${lg ? " btn-lg" : ""}" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L(en, ar)}</span></a>`;

// Parse a leading numeric amount out of a price label like "1,500 ﷼ / شهرياً" or "يبدأ من 10,000 ﷼".
const parseAmount = (str) => {
  const m = String(str || "").replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

// Add-to-cart + Buy-now pair. Item carried in data-* attributes; cart lives in localStorage (see main.js).
function cartBtns({ id, nameEn, nameAr, amount, priceLabel, kind = "service", ghost = false }) {
  const data = `data-id="${esc(id)}" data-name-en="${esc(nameEn || nameAr)}" data-name-ar="${esc(nameAr)}" data-amount="${amount != null ? amount : ""}" data-price="${esc(priceLabel || "")}" data-kind="${esc(kind)}"`;
  return `<div class="buy-row">
    <button type="button" class="btn ${ghost ? "btn-ghost" : "btn-primary"} add-cart" ${data}>${I.cart}<span>${L("Add to cart", "أضف إلى السلة")}</span></button>
    <button type="button" class="btn btn-wa buy-now" ${data}>${L("Buy now", "اشترِ الآن")}</button>
  </div>`;
}

/* ---------- layout ---------- */
// Path of the same page in the other language.
function mirrorUrl(path) {
  const p = path || "/";
  if (LANG === "ar") return p; // Arabic → English root path
  return p === "/" ? "/ar/" : "/ar" + p; // English → Arabic prefixed path
}
function head(title, desc, path) {
  const enUrl = path || "/";
  const arUrl = enUrl === "/" ? "/ar/" : "/ar" + enUrl;
  return `<!DOCTYPE html>
<html lang="${LANG}" dir="${LANG === "ar" ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/assets/img/cover.png">
<meta property="og:locale" content="${LANG === "ar" ? "ar_SA" : "en_US"}">
<meta name="theme-color" content="#0B1B5A">
<link rel="alternate" hreflang="en" href="${enUrl}">
<link rel="alternate" hreflang="ar" href="${arUrl}">
<link rel="alternate" hreflang="x-default" href="${enUrl}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>`;
}

const NAV_EN = {
  "/": "Home",
  "/about": "About",
  "/services": "Services",
  "/ai-agents": "AI Agents",
  "/tourism": "Tourism",
  "/packages": "Packages",
  "/calculator": "Calculator",
  "/saudi-arabia": "Saudi Arabia",
  "/news": "News",
  "/careers": "Careers",
  "/contact": "Contact",
};

const NAV_AR = {
  "/": "الرئيسية", "/about": "من نحن", "/services": "الخدمات", "/ai-agents": "الوكلاء الأذكياء",
  "/tourism": "السياحة", "/packages": "الباقات", "/calculator": "الحاسبة", "/saudi-arabia": "السعودية",
  "/news": "الأخبار", "/careers": "الوظائف", "/contact": "تواصل معنا",
};

function langToggle(path) {
  return `<a class="lang-toggle" href="${mirrorUrl(path)}" aria-label="Switch language / تبديل اللغة">
    ${saudiFlag}<span class="lang-label">${LANG === "ar" ? "English" : "العربية"}</span></a>`;
}

function header(active, path) {
  const links = site.nav
    .map((n) => `<a href="${u(n.href)}"${n.href === active ? ' class="active"' : ""}>${L(NAV_EN[n.href] || n.label, NAV_AR[n.href] || n.label)}</a>`)
    .join("");
  return `<header class="site-header"><div class="container header-inner">
  <a class="logo" href="${u("/")}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <nav class="nav" aria-label="Main navigation">${links}<a class="btn btn-wa nav-cta" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L("Start on WhatsApp", "ابدأ على واتساب")}</span></a></nav>
  <div class="header-cta">
    ${langToggle(path)}
    <a class="icon-btn" href="${u("/account")}" aria-label="${Lraw("Account", "حسابي")}">${I.user}</a>
    <a class="icon-btn cart-link" href="${u("/cart")}" aria-label="${Lraw("Cart", "السلة")}">${I.cart}<span class="cart-badge" id="cart-badge" hidden>0</span></a>
    <a class="btn btn-wa btn-primary" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L("Start now", "ابدأ الآن")}</span></a>
    <button class="nav-toggle" aria-label="${Lraw("Menu", "القائمة")}" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
  </div>
</div></header>`;
}

function footer() {
  const c = site.contact;
  const svcLinks = categories
    .slice(0, 6)
    .map((cat) => `<li><a href="${u("/services")}#${slugCat(cat.key)}">${L(CAT_META[cat.key] ? CAT_META[cat.key].en : cat.key, cat.ar)}</a></li>`)
    .join("");
  const fl = (href, en, ar) => `<li><a href="${u(href)}">${L(en, ar)}</a></li>`;
  return `<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div>
      <div class="footer-logo"><img src="/assets/img/logo.png" alt="Business Partner" width="160" height="30"></div>
      <p>${L(site.brand.shortBioEn || site.brand.shortBio, site.brand.shortBio)}</p>
      <p class="footer-tag">${L("Partnering for your success", "شركاء نجاحك")}</p>
    </div>
    <div class="footer-col"><h4>${L("Links", "روابط")}</h4><ul>
      ${fl("/about", "About", "من نحن")}
      ${fl("/services", "Services", "الخدمات")}
      ${fl("/ai-agents", "AI Agents", "الوكلاء الأذكياء")}
      ${fl("/tourism", "Tourism & Events", "السياحة والفعاليات")}
      ${fl("/packages", "Packages", "الباقات")}
      ${fl("/saudi-arabia", "Saudi Arabia", "السعودية")}
      ${fl("/news", "News", "الأخبار")}
      ${fl("/careers", "Careers", "الوظائف")}
      ${fl("/calculator", "Calculator", "الحاسبة")}
      ${fl("/account", "Client portal", "منصّة العملاء")}
      ${fl("/cart", "Cart", "السلة")}
      ${fl("/contact", "Contact", "اتصل بنا")}
    </ul></div>
    <div class="footer-col"><h4>${L("Selected services", "خدمات مختارة")}</h4><ul>${svcLinks}</ul></div>
    <div class="footer-col"><h4>${L("Contact", "تواصل")}</h4><ul class="footer-contact">
      <li>${I.phone}<span>${esc(c.phone)}</span></li>
      <li>${I.mail}<span>${esc(c.email)}</span></li>
      <li>${I.pin}<span>${L(c.addressEn || c.address, c.address)}</span></li>
      <li>${I.wa}<a href="${WA}" target="_blank" rel="noopener">${L("Smart agent on WhatsApp", "الوكيل الذكي على واتساب")}</a></li>
      ${site.whatsappChannel ? `<li>${I.channel}<a href="${site.whatsappChannel}" target="_blank" rel="noopener">${L("Follow our WhatsApp channel", "تابع قناتنا في واتساب")}</a></li>` : ""}
    </ul></div>
  </div>
  <div class="footer-bottom">
    <span>${L("© " + new Date().getFullYear() + " Business Partner · All rights reserved", "© " + new Date().getFullYear() + " بيزنس بارتنر · جميع الحقوق محفوظة")}</span>
    <span>${L(c.hoursEn || c.hours, c.hours)}</span>
  </div>
</div></footer>`;
}

function waFab() {
  return `<a class="wa-fab" href="${WA}" target="_blank" rel="noopener" aria-label="${Lraw("Contact on WhatsApp", "تواصل عبر واتساب")}">${I.wa}<span class="lbl">${L("Chat with the smart agent", "تحدث مع الوكيل الذكي")}</span></a>`;
}

function advisorWidget() {
  return `<button class="advisor-fab" id="advisor-fab" aria-label="${Lraw("Open the smart advisor", "افتح المستشار الذكي")}">${I.robot}<span class="lbl">${L("Advisor", "المستشار")}</span></button>
  <section class="advisor-panel" id="advisor-panel" hidden aria-label="${Lraw("Smart advisor", "المستشار الذكي")}">
    <header class="advisor-head">
      <div class="advisor-title">${I.robot}<div><strong>${L("Smart Advisor", "المستشار الذكي")}</strong><span>${L("Answers about services & procedures", "يجاوبك عن الخدمات والإجراءات")}</span></div></div>
      <button class="advisor-close" id="advisor-close" aria-label="${Lraw("Close", "إغلاق")}">${I.close}</button>
    </header>
    <div class="advisor-msgs" id="advisor-msgs">
      <div class="advisor-msg bot">${L("Hi 👋 I'm the Business Partner smart advisor. Ask me about company formation, foreign investment, licensing, or any government procedure — and I'll point you to the right service.", "مرحباً 👋 أنا المستشار الذكي في بيزنس بارتنر. اسألني عن التأسيس، الاستثمار الأجنبي، التراخيص، أو أي إجراء حكومي — وأدلّك على الخدمة المناسبة.")}</div>
    </div>
    <form class="advisor-form" id="advisor-form">
      <input id="advisor-input" type="text" autocomplete="off" placeholder="${Lraw("Type your question here…", "اكتب سؤالك هنا…")}" aria-label="${Lraw("Type your question", "اكتب سؤالك")}">
      <button type="submit" aria-label="${Lraw("Send", "إرسال")}">${I.send}</button>
    </form>
    <a class="advisor-wa" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L("Prefer to chat with our team on WhatsApp?", "تفضّل التحدث مع فريقنا على واتساب؟")}</span></a>
  </section>`;
}

function page({ title, desc, active, path, body, script = "" }) {
  const p = path || active || "/";
  return (
    head(title, desc, p) +
    header(active, p) +
    `<main>${body}</main>` +
    footer() +
    waFab() +
    advisorWidget() +
    `<script src="/assets/js/main.js"></script>${script}</body></html>`
  );
}

const slugCat = (key) => "cat-" + key.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

/* ---------- service helpers ---------- */
// Government-platform names → English.
const GOV_EN = {
  "الغرفة التجارية": "Chamber of Commerce",
  "المركز السعودي للأعمال": "Saudi Business Center",
  "أبشر أعمال": "Absher Business",
  "متعدد الجهات": "Multiple authorities",
  "وزارة الاستثمار MISA": "Ministry of Investment (MISA)",
  "الإقامة المميزة": "Premium Residency Center",
  "بلدي": "Balady",
  "التأمينات GOSI": "GOSI",
  "الدفاع المدني": "Civil Defense",
  "مدد": "Mudad",
  "مقيم": "Muqeem",
  "قوى": "Qiwa",
  "الملكية الفكرية SAIP": "SAIP (Intellectual Property)",
  "سُبل": "Subul",
  "الزكاة والضريبة ZATCA": "ZATCA",
  "وزارة الموارد البشرية": "Ministry of Human Resources",
  "بدون جهة حكومية": "No government authority",
};
const govLabel = (g) => (LANG === "ar" ? g : (GOV_EN[g] || g));

function audienceOf(s, ov) {
  if (LANG === "ar") {
    if (ov && ov.audience) return ov.audience;
    if (s.targetClient) return s.targetClient;
    return "أفراد ومنشآت";
  }
  if (ov && ov.audienceEn) return ov.audienceEn;
  return "Individuals & businesses";
}
function documentsOf(s, ov) {
  if (LANG === "ar") {
    if (ov && ov.documents) return ov.documents;
    return [
      "الوثائق الرسمية (سجل تجاري أو هوية حسب الحالة)",
      "المستندات الخاصة بنشاطك أو بطلب الخدمة",
      "سداد الرسوم المقررة للجهة المختصة",
    ];
  }
  if (ov && ov.documentsEn) return ov.documentsEn;
  return [
    "Official documents (Commercial Registration or ID as applicable)",
    "Documents specific to your activity or request",
    "Payment of the fees due to the relevant authority",
  ];
}
function featuresOf(s, ov) {
  if (LANG === "ar") {
    if (ov && ov.features) return ov.features;
    const feats = [];
    if (s.deliverables && s.deliverables.length) feats.push(...s.deliverables.slice(0, 4));
    feats.push("ننجز الإجراء نيابةً عنك من البداية حتى الإصدار");
    feats.push("أتعاب واضحة والرسوم الحكومية منفصلة ومعلنة");
    feats.push("دعم الوكيل الذكي على واتساب 24/7");
    return feats.slice(0, 7);
  }
  if (ov && ov.featuresEn) return ov.featuresEn;
  return [
    "We complete the procedure on your behalf, from start to issuance",
    "Clear fees, with government fees separate and disclosed",
    "Smart-agent support on WhatsApp 24/7",
  ];
}
function faqOf(s, ov) {
  if (ov && ov.faq && LANG === "ar") return ov.faq;
  if (ov && ov.faqEn && LANG === "en") return ov.faqEn;
  const faq = [];
  if (LANG === "ar") {
    faq.push({
      q: "كم تبلغ أتعاب هذه الخدمة؟",
      a:
        (s.price.amount != null ? `أتعاب بيزنس بارتنر لهذه الخدمة ${s.price.label}. ` : "تُسعّر هذه الخدمة بعرض مخصّص حسب حالتك. ") +
        (s.govFeesSeparate ? "الرسوم الحكومية منفصلة عن الأتعاب وتُعلن قبل البدء." : "وتُضاف ضريبة القيمة المضافة."),
    });
    faq.push({ q: "لمن هذه الخدمة؟", a: `هذه الخدمة متاحة لـ${audienceOf(s, ov)}.` });
    if (s.govPlatform) faq.push({ q: "ما الجهة المختصة؟", a: `تُقدَّم الخدمة عبر ${govLabel(s.govPlatform)}، ونتولّى نحن التقديم والمتابعة معها.` });
    faq.push({ q: "كيف أبدأ؟", a: "تواصل معنا على واتساب، والوكيل الذكي يحدد متطلباتك، يجهّز قائمة مستنداتك، ويبدأ تنفيذ طلبك فوراً." });
  } else {
    faq.push({
      q: "How much are the fees for this service?",
      a:
        (s.price.amount != null ? `Business Partner's fee for this service is ${s.price.label}. ` : "This service is quoted individually based on your case. ") +
        (s.govFeesSeparate ? "Government fees are separate from our fees and are disclosed before we start." : "VAT is added."),
    });
    faq.push({ q: "Who is this service for?", a: `This service is available to ${audienceOf(s, ov)}.` });
    if (s.govPlatform) faq.push({ q: "Which authority handles it?", a: `The service is delivered through ${govLabel(s.govPlatform)}; we handle the filing and follow-up with it.` });
    faq.push({ q: "How do I start?", a: "Contact us on WhatsApp — the smart agent identifies your requirements, prepares your document list, and starts your request immediately." });
  }
  return faq;
}

function serviceQuickFacts(s, ov) {
  const facts = [];
  facts.push(`<span class="chip">${I.tag}${L(catEn(s.category), catAr(s.category))}</span>`);
  if (ov && ov.duration) facts.push(`<span class="chip">${I.clock}${L(ov.durationEn || ov.duration, ov.duration)}</span>`);
  facts.push(`<span class="chip">${I.users}${esc(audienceOf(s, ov))}</span>`);
  if (s.govPlatform) facts.push(`<span class="chip">${I.building}${esc(govLabel(s.govPlatform))}</span>`);
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
      <div class="pk-name">${esc(t.nameAr)}</div>
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
    <p class="hero-tagline">شركاء نجاحك</p>
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
        <div class="hero-actions">${waBtn(h.agent.cta, "btn-white", true)}<a class="btn btn-lg" href="/ai-agents" style="border-color:rgba(255,255,255,.5);color:#fff">تعرّف على منظومة الوكلاء</a></div>
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

  return page({ title: "بيزنس بارتنر — شريك تشغيل أعمالك في السعودية", desc: esc(site.brand.shortBio), active: "/", body });
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
  return page({ title: "من نحن — بيزنس بارتنر", desc: esc(a.lead), active: "/about", body });
}

function buildServicesIndex() {
  const catNav = categories.map((c) => `<a href="#${slugCat(c.key)}">${L(catEn(c.key), c.ar)}</a>`).join("");
  const blocks = categories
    .map((cat) => {
      const list = services.filter((s) => s.category === cat.key);
      const cards = list
        .map((s) => {
          const d = sDesc(s);
          return `<a class="card svc-card" href="${u("/services/" + s.slug)}">
        <span class="tag">${L(catEn(cat.key), cat.ar)}</span>
        <h3>${esc(sName(s))}</h3>
        <p class="desc">${esc(d.slice(0, 120))}${d.length > 120 ? "…" : ""}</p>
        <div class="foot"><span class="price">${esc(priceLabel(s))}</span><span class="card-link">${L("Details", "التفاصيل")} ${I.arrow}</span></div>
      </a>`;
        })
        .join("");
      return `<div class="cat-block" id="${slugCat(cat.key)}">
        <h2>${L(catEn(cat.key), cat.ar)} <span class="count">${cat.count} ${L("services", "خدمة")}</span></h2>
        <p>${L(catEn(cat.key) + " services — clear fees from the official catalog.", "خدمات " + cat.ar + " — بأتعاب واضحة من الكتالوج الرسمي.")}</p>
        <div class="grid grid-3">${cards}</div>
      </div>`;
    })
    .join("");
  const mf = site.misaFeatured;
  const misaTiers = mf.tiers
    .map(
      (t) => `<div class="pkg${t.highlight ? " pop" : ""}">
      <div class="pk-name">${L(t.nameEn || t.nameAr, t.nameAr)}</div>
      <div class="pk-price">${L(priceLabel({ price: { label: t.price } }), t.price)}<span class="pk-price-sub">${L("+ separate government fees", "+ رسوم حكومية منفصلة")}</span></div>
      <p class="pk-for">${L(t.forEn || t.for, t.for)}</p>
      <p style="color:var(--text-soft);font-size:.95rem;flex:1">${L(t.textEn || t.text, t.text)}</p>
      <div style="margin-top:20px">${cartBtns({ id: "misa-" + esc(t.nameAr).replace(/\s+/g, "-"), nameEn: t.nameEn || t.nameAr, nameAr: t.nameAr, amount: parseAmount(t.price), priceLabel: t.price, kind: "misa", ghost: !t.highlight })}</div>
    </div>`
    )
    .join("");
  const misaSection = `
  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(mf.eyebrowEn || mf.eyebrow, mf.eyebrow)}</span><h2>${L(mf.titleEn || mf.title, mf.title)}</h2><p>${L(mf.subtitleEn || mf.subtitle, mf.subtitle)}</p></div>
    <div class="grid grid-3">${misaTiers}</div>
    <div class="callout" style="max-width:720px;margin:32px auto 0"><span class="ico">💡</span><p>${L(mf.noteEn || mf.note, mf.note)}</p></div>
  </div></section>`;

  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Services", "الخدمات")}</span>
    <h1>${L("All our services in one place", "كل خدماتنا في مكان واحد")}</h1>
    <p class="lead">${L(services.length + " services classified per Business Partner's official catalog — each with a full page of documents, features and pricing.", services.length + " خدمة مصنّفة حسب الكتالوج الرسمي لـ بيزنس بارتنر — لكل خدمة صفحة كاملة بالمستندات والمميزات والأسعار.")}</p>
  </div></section>
  ${misaSection}
  <section class="section"><div class="container">
    <nav class="cat-nav">${catNav}</nav>
    ${blocks}
    <div class="cta-band" style="margin-top:20px"><h2>${L("Didn't find your service?", "ما لقيت خدمتك؟")}</h2><p>${L("Send us your enquiry and the smart agent finds the right service for your case instantly.", "أرسل لنا استفسارك، والوكيل الذكي يحدد الخدمة المناسبة لحالتك فوراً.")}</p>${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("Services — Business Partner", "الخدمات — بيزنس بارتنر"), desc: Lraw(services.length + " government and business services with clear fees from the official catalog.", services.length + " خدمة حكومية وتجارية بأتعاب واضحة من الكتالوج الرسمي."), active: "/services", body });
}

function buildServiceDetail(s) {
  const ov = site.overrides[s.slug];
  const docs = documentsOf(s, ov);
  const feats = featuresOf(s, ov);
  const faq = faqOf(s, ov);
  const genericDocsNote = !(ov && (ov.documents || ov.documentsEn))
    ? `<div class="callout" style="margin-top:16px"><span class="ico">💡</span><p>${L("The smart agent confirms the exact document list for your case as soon as you reach out on WhatsApp.", "يحدد الوكيل الذكي قائمة المستندات الدقيقة لحالتك فور تواصلك على واتساب.")}</p></div>`
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
  facts.push(`<li><span class="k">${L("Category", "الفئة")}</span><span class="v">${L(catEn(s.category), catAr(s.category))}</span></li>`);
  if (ov && ov.duration) facts.push(`<li><span class="k">${L("Duration", "المدة")}</span><span class="v">${L(ov.durationEn || ov.duration, ov.duration)}</span></li>`);
  facts.push(`<li><span class="k">${L("Available to", "متاح لـ")}</span><span class="v">${esc(audienceOf(s, ov))}</span></li>`);
  if (s.govPlatform) facts.push(`<li><span class="k">${L("Authority", "الجهة")}</span><span class="v">${esc(govLabel(s.govPlatform))}</span></li>`);
  facts.push(`<li><span class="k">${L("Code", "الكود")}</span><span class="v">${esc(s.code)}</span></li>`);

  const priceNote = (s.price && (LANG === "ar" ? s.price.note : s.price.noteEn))
    ? (LANG === "ar" ? s.price.note : s.price.noteEn)
    : L(
        s.govFeesSeparate ? "Fees exclude government fees and VAT." : "Fees exclude VAT.",
        s.govFeesSeparate ? "الأتعاب لا تشمل الرسوم الحكومية وضريبة القيمة المضافة." : "الأتعاب لا تشمل ضريبة القيمة المضافة."
      );
  const arrow = LANG === "ar" ? "←" : "→";

  const body = `
  <section class="svc-hero"><div class="container">
    <div class="breadcrumb"><a href="${u("/")}">${L("Home", "الرئيسية")}</a> ${arrow} <a href="${u("/services")}">${L("Services", "الخدمات")}</a> ${arrow} <a href="${u("/services")}#${slugCat(s.category)}">${L(catEn(s.category), catAr(s.category))}</a></div>
    <h1>${esc(sName(s))}</h1>
    <div class="svc-meta">${serviceQuickFacts(s, ov)}</div>
  </div></section>
  <div class="container"><div class="svc-layout">
    <div class="svc-main">
      <section><h2>${L("Service description", "وصف الخدمة")}</h2><p class="lead-p">${esc(sDesc(s))}</p></section>
      <section><h2>${L("Required documents", "المستندات المطلوبة")}</h2><ul class="doc-list">${docsHtml}</ul>${genericDocsNote}</section>
      <section><h2>${L("Service features with Business Partner", "مميزات الخدمة مع بيزنس بارتنر")}</h2><ul class="feat-list">${featsHtml}</ul></section>
      <section><h2>${L("Frequently asked questions", "الأسئلة الشائعة")}</h2>${faqHtml}</section>
      <section><div class="callout"><span class="ico">⚡</span><p><strong>${L("Business Partner advantage:", "ميزة بيزنس بارتنر:")}</strong> ${L("The WhatsApp smart agent pulls this service's requirements instantly, prepares your document list automatically, and starts your request around the clock.", "الوكيل الذكي على واتساب يسحب متطلبات هذه الخدمة فوراً، يجهّز قائمة مستنداتك تلقائياً، ويبدأ طلبك على مدار الساعة.")}</p></div></section>
    </div>
    <aside class="svc-aside">
      <div class="order-box">
        <div class="price-big">${esc(priceLabel(s))}</div>
        <div class="price-note">${esc(priceNote)}</div>
        ${cartBtns({ id: s.code || s.slug, nameEn: svcI18n[s.code] ? svcI18n[s.code].en : s.name, nameAr: sNameArOf(s), amount: s.price.amount, priceLabel: s.price.label, kind: "service" })}
        ${waBtn2("Order this service on WhatsApp", "اطلب هذه الخدمة على واتساب", "btn-ghost")}
        <a class="btn btn-ghost" href="${u("/calculator")}?service=${encodeURIComponent(s.code)}">${L("Calculate the cost", "احسب التكلفة")}</a>
        <p class="mini">${L("Instant reply from the smart agent 24/7", "رد فوري من الوكيل الذكي 24/7")}</p>
        <ul class="order-facts">${facts.join("")}</ul>
      </div>
    </aside>
  </div></div>`;
  const desc = sDesc(s).slice(0, 155);
  return page({ title: `${sName(s)} — ${Lraw("Business Partner", "بيزنس بارتنر")}`, desc: esc(desc), active: "/services", path: `/services/${s.slug}`, body });
}

function buildAiAgents() {
  const a = site.aiAgents;
  const steps = a.how.steps
    .map(
      (s) => `<div class="step"><div class="step-n">${esc(s.n)}</div><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></div>`
    )
    .join("");
  const cards = a.agents
    .map(
      (g) => `<div class="pkg${g.highlight ? " pop" : ""}">
      <div class="pk-name">${esc(g.name)}<small>${esc(g.tagline)}</small></div>
      <div class="pk-price">${esc(g.price)}</div>
      <p class="pk-for">${esc(g.for)}</p>
      <ul>${g.features.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("")}</ul>
      ${cartBtns({ id: "agent-" + esc(g.name).replace(/\s+/g, "-"), nameEn: g.name, nameAr: g.name, amount: parseAmount(g.price), priceLabel: g.price, kind: "agent", ghost: !g.highlight })}
      ${waBtn("اطلب هذا الوكيل على واتساب", "btn-ghost")}
    </div>`
    )
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">الوكلاء الأذكياء</span>
    <h1>${esc(a.title)}</h1>
    <p class="lead">${esc(a.lead)}</p>
    <div class="hero-actions">${waBtn(a.cta, "btn-primary", true)}<a class="btn btn-ghost btn-lg" href="#agents">استعرض الوكلاء</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}مراقبة 24/7</span>
      <span class="hero-badge">${I.check}تنفيذ ذاتي</span>
      <span class="hero-badge">${I.check}موافقة ودفع فقط</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(a.how.eyebrow)}</span><h2>${esc(a.how.title)}</h2></div>
    <div class="steps-grid">${steps}</div>
  </div></section>

  <section class="section" id="agents"><div class="container">
    <div class="section-head"><span class="eyebrow">المنظومة</span><h2>${esc(a.packagesTitle)}</h2><p>${esc(a.packagesSubtitle)}</p></div>
    <div class="grid grid-3">${cards}</div>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${esc(a.pricingNote)}</p></div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="cta-band"><h2>جاهز تشوف الوكلاء يشتغلون؟</h2><p>احجز عرضاً توضيحياً مع فريقنا، ونصمّم لك المنظومة على مقاس منشأتك.</p>${waBtn(a.cta, "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "الوكلاء الأذكياء — بيزنس بارتنر", desc: esc(a.lead.slice(0, 155)), active: "/ai-agents", body });
}

function buildPackages() {
  const p = site.packages;
  const tiers = p.tiers
    .map(
      (t) => `<div class="pkg${t.highlight ? " pop" : ""}">
      <div class="pk-name">${esc(t.nameAr)}</div>
      ${t.price ? `<div class="pk-price">${esc(t.price)}</div>` : ""}
      <p class="pk-for">${esc(t.for)}</p>
      <ul>${t.features.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("")}</ul>
      ${cartBtns({ id: "pkg-" + esc(t.nameAr).replace(/\s+/g, "-"), nameEn: t.nameEn || t.nameAr, nameAr: t.nameAr, amount: t.amount != null ? t.amount : null, priceLabel: t.price || "تواصل معنا للتسعير", kind: "package", ghost: !t.highlight })}
      ${waBtn("تواصل معنا للتسعير", "btn-ghost")}
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
  return page({ title: "الباقات — بيزنس بارتنر", desc: esc(p.subtitle), active: "/packages", body });
}

// Category display metadata (icon + English label) keyed by catalog category.
const CAT_META = {
  "Company Formation": { icon: "🏢", en: "Company Formation" },
  "Foreign Investment": { icon: "🌍", en: "Foreign Investment" },
  "Premium Residency": { icon: "🪪", en: "Premium Residency" },
  "Government Relations": { icon: "🏛️", en: "Government Relations" },
  "HR Services": { icon: "👥", en: "HR Services" },
  "Recruitment": { icon: "🧑‍💼", en: "Recruitment & Hiring" },
  "Business Support": { icon: "🧰", en: "Business Support" },
  "Real Estate": { icon: "🏗️", en: "Real Estate" },
  "AI Automation": { icon: "🤖", en: "AI & Automation" },
  "Tourism": { icon: "✈️", en: "Tourism" },
};

// Classify a catalog price into a calculator price type.
function priceType(s) {
  const pm = s.pricingModel || "";
  const label = (s.price && s.price.label) || "";
  if (s.price && s.price.amount == null) return "onrequest"; // Percent / proposal-only
  if (pm === "Percent" || /نسبة/.test(label)) return "onrequest";
  if (pm === "Monthly" || /شهري/.test(label)) return "monthly";
  if (pm === "Starting From" || /يبدأ من|starting/i.test(label)) return "from";
  if (pm === "Per Candidate" || /مرشّح|candidate/i.test(label)) return "percandidate";
  return "once";
}

function buildCalculator() {
  // Group live catalog services by category (source: official Notion catalog → services.json).
  const groups = categories.map((cat) => {
    const list = services.filter((s) => s.category === cat.key);
    const chips = [...new Set(list.map((s) => s.govPlatform).filter((g) => g && g !== "—" && g !== "بدون جهة حكومية"))].map(govLabel);
    const meta = CAT_META[cat.key] || { icon: "•", en: cat.key };
    return {
      key: cat.key,
      icon: meta.icon,
      nameEn: meta.en,
      nameAr: cat.ar,
      chips,
      items: list.map((s) => {
        const m = svcI18n[s.code] || {};
        const ov = site.overrides[s.slug];
        return {
          id: s.code,
          nameEn: m.en || (ov && ov.nameEn) || s.name,
          nameAr: m.ar || (ov && ov.name) || s.name,
          slug: s.slug,
          amount: s.price.amount,
          label: s.price.label,
          ptype: priceType(s),
          gov: s.govFeesSeparate,
        };
      }),
    };
  });

  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Cost calculator", "حاسبة التكلفة")}</span>
    <h1>${L("Build your service basket and see the cost", "كوّن سلّة خدماتك واعرف التكلفة")}</h1>
    <p class="lead">${L("Pick services from the official catalog by category. The basket totals your one-time and monthly Business Partner fees instantly. Government fees (where applicable) are separate and announced before starting.", "اختر خدماتك حسب التصنيف من الكتالوج الرسمي. تتحدّث السلّة تلقائياً بإجمالي أتعاب بيزنس بارتنر لمرة واحدة والشهرية. الرسوم الحكومية (إن وجدت) منفصلة وتُعلن قبل البدء.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="calc2" id="calc2">
      <div class="calc2-cats" id="calc2-cats"></div>
      <aside class="calc2-cart">
        <div class="order-box calc2-box">
          <h3>${L("Your basket", "سلّتك")}</h3>
          <div class="calc2-selected" id="calc2-selected">
            <p class="calc2-empty" id="calc2-empty">${L("No services selected yet. Tap a service to add it.", "لم تختر أي خدمة بعد. اضغط على أي خدمة لإضافتها.")}</p>
          </div>
          <div class="calc2-totals">
            <div class="calc-line"><span class="k">${L("One-time fees", "أتعاب لمرة واحدة")}</span><span class="v" id="calc2-once">0 ﷼</span></div>
            <div class="calc-line"><span class="k">${L("Monthly fees", "أتعاب شهرية")}</span><span class="v" id="calc2-monthly">0 ﷼</span></div>
            <div class="calc-line calc2-vat"><span class="k">${L("+ VAT 15% (on fees)", "+ ضريبة القيمة المضافة 15% (على الأتعاب)")}</span><span class="v" id="calc2-vat">—</span></div>
          </div>
          <div class="calc2-warn" id="calc2-warn" hidden>${I.doc}<span>${L("Some selected services are priced on request (a quote after review). They are not included in the totals.", "بعض الخدمات المختارة تُسعّر حسب الطلب (عرض بعد المراجعة) ولا تدخل في الإجمالي.")}</span></div>
          <a class="btn btn-primary btn-lg" id="calc2-quote" href="/checkout" style="width:100%">${L("Request an official quote", "اطلب عرضاً رسمياً")}</a>
          <a class="btn btn-wa" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L("Or discuss on WhatsApp", "أو ناقشنا على واتساب")}</span></a>
          <p class="calc-note">${L("Estimates from the official catalog; final pricing may vary by your case. Government fees are separate.", "تقديرات من الكتالوج الرسمي وقد تختلف حسب حالتك. الرسوم الحكومية منفصلة.")}</p>
        </div>
      </aside>
    </div>
  </div></section>
  <script>window.BP_CALC = ${JSON.stringify(groups)};window.BP_CALC_LANG = ${JSON.stringify(LANG)};</script>`;
  return page({ title: Lraw("Cost calculator — Business Partner", "حاسبة التكلفة — بيزنس بارتنر"), desc: Lraw("Build a basket of Business Partner services and see one-time and monthly fees from the official catalog.", "كوّن سلّة من خدمات بيزنس بارتنر واعرف الأتعاب لمرة واحدة والشهرية من الكتالوج الرسمي."), active: "/calculator", body });
}

function buildTourism() {
  const t = site.tourism;
  const b = site.businessTourism;
  const ev = t.events;
  const evFeats = ev.features.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("");
  const items = b.includes.items
    .map((it) => `<div class="card feature"><div class="card-icon">${I.globe}</div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div>`)
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">السياحة والفعاليات</span>
    <h1>${esc(t.title)}</h1>
    <p class="lead">${esc(t.lead)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="#events">${I.building}<span>فعاليات الموظفين</span></a>
      <a class="btn btn-ghost btn-lg" href="#investor">${I.globe}<span>سياحة الأعمال للمستثمر</span></a>
    </div>
  </div></section>

  <section class="section" id="events"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(ev.eyebrow)}</span><h2>${esc(ev.title)}</h2></div>
    <div class="svc-layout">
      <div class="svc-main">
        <p class="lead-p">${esc(ev.text)}</p>
        <ul class="feat-list" style="margin-top:22px">${evFeats}</ul>
      </div>
      <aside class="svc-aside"><div class="order-box">
        <div class="price-big">${esc(ev.price)}</div>
        <div class="price-note">${esc(ev.note)}</div>
        ${waBtn("اطلب فعالية", "btn-wa")}
        <a class="btn btn-ghost" href="/contact">تواصل معنا</a>
      </div></aside>
    </div>
  </div></section>

  <section class="section section--gray" id="investor"><div class="container">
    <div class="section-head"><span class="eyebrow">النوع الثاني · سياحة الأعمال للمستثمر</span><h2>${esc(b.title)}</h2><p>${esc(b.lead)}</p></div>
    <div class="grid grid-3">${items}</div>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${esc(b.note)} السعر يُحدَّد حسب البرنامج — تواصل معنا للتسعير.</p></div>
    <div class="center mt-32">${waBtn(b.cta, "btn-primary", true)}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>جاهز نرتّب لك؟</h2><p>سواء فعالية لموظفيك أو رحلة استكشاف للسوق السعودي — نصمّمها على مقاسك.</p>${waBtn("تواصل معنا", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "السياحة والفعاليات — بيزنس بارتنر", desc: esc(t.lead.slice(0, 155)), active: "/tourism", body });
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
  const entities = s.entities.items
    .map(
      (e) => `<a class="card entity-card" href="${e.link}">
      <div class="entity-head"><h3>${esc(e.name)}</h3><span class="entity-gov">${esc(e.gov)}</span></div>
      <p class="desc"><strong>ماذا تفعل؟</strong> ${esc(e.what)}</p>
      <p class="desc"><strong>كيف نخدمك؟</strong> ${esc(e.help)}</p>
      <span class="card-link">الخدمات ذات العلاقة ${I.arrow}</span></a>`
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
    <div class="section-head"><span class="eyebrow">${esc(s.entities.eyebrow)}</span><h2>${esc(s.entities.title)}</h2><p>${esc(s.entities.subtitle)}</p></div>
    <div class="grid grid-3">${entities}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(s.knowledge.eyebrow)}</span><h2>${esc(s.knowledge.title)}</h2><p>${esc(s.knowledge.subtitle)}</p></div>
    <div class="grid grid-3">${articles}</div>
    <div class="cta-band" style="margin-top:40px"><h2>تبي دليلاً مفصّلاً لحالتك؟</h2><p>الوكيل الذكي يجهّز لك خطوات خدمتك ومتطلباتها فوراً على واتساب.</p>${waBtn("اسأل الوكيل الذكي", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: "السعودية — بيانات وأدلة الاستثمار | بيزنس بارتنر", desc: esc(s.lead.slice(0, 155)), active: "/saudi-arabia", body });
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
  return page({ title: "الأخبار والتحديثات — بيزنس بارتنر", desc: esc(n.lead.slice(0, 155)), active: "/news", body });
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
    <div class="callout" style="max-width:760px;margin:32px auto 0"><span class="ico">💡</span><p><strong>التوظيف المحلي (السعودة):</strong> الأتعاب = نصف الراتب الشهري للموظف. مثال: راتب 4,000 ﷼ ← أتعابنا 2,000 ﷼.</p></div>
    <div class="center mt-32">${waBtn(c.employer.cta, "btn-primary", true)}</div>
  </div></section>

  <section class="section section--gray" id="seekers"><div class="container">
    <div class="section-head"><span class="eyebrow">${esc(c.seeker.eyebrow)}</span><h2>${esc(c.seeker.title)}</h2><p>${esc(c.seeker.text)}</p></div>
    <div style="max-width:640px;margin:0 auto">
      <form class="calc-form cv-form" id="cv-form" novalidate>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-name">${esc(f.name)}</label><input id="c-name" name="name" type="text" required></div>
          <div class="field"><label for="c-phone">${esc(f.phone)}</label><input id="c-phone" name="phone" type="tel" required></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-email">${esc(f.email)}</label><input id="c-email" name="email" type="email"></div>
          <div class="field"><label for="c-exp">${esc(f.experience)}</label><input id="c-exp" name="experience" type="text" placeholder="مثال: 3 سنوات"></div>
        </div>
        <div class="field"><label for="c-field">${esc(f.field)}</label><input id="c-field" name="field" type="text" placeholder="مثال: محاسبة، تسويق، هندسة"></div>
        <div class="field">
          <label>${esc(f.cv)}</label>
          <label class="file-drop" for="c-cv" id="cv-drop">
            <span class="file-ico">${I.upload}</span>
            <span class="file-text" id="cv-filename">اسحب سيرتك هنا أو اضغط للاختيار — PDF أو Word</span>
          </label>
          <input id="c-cv" name="cv" type="file" accept=".pdf,.doc,.docx" required hidden>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.upload}<span>${esc(c.seeker.cta || "أرسل سيرتك الذاتية")}</span></button>
        <p class="form-note" id="cv-note">${esc(c.seeker.note)}</p>
        <div class="form-success" id="cv-success" hidden>✅ تم استلام سيرتك الذاتية. سنراجعها ونتواصل معك عند توفّر فرصة مناسبة. يمكنك أيضاً متابعتنا على واتساب.</div>
      </form>
      <div class="center mt-16">${waBtn("أو أرسلها عبر واتساب", "btn-ghost")}</div>
    </div>
  </div></section>`;
  return page({ title: "الوظائف والتوظيف — بيزنس بارتنر", desc: esc(c.lead.slice(0, 155)), active: "/careers", body });
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
          <li><span class="ico">${I.wa}</span><div><div class="k">واتساب — الوكيل الذكي</div><a class="v" href="${WA}" target="_blank" rel="noopener">${esc(c.whatsappAgent)}</a></div></li>
          <li><span class="ico">${I.wa}</span><div><div class="k">واتساب — الدعم البشري</div><a class="v" href="${WA_SUPPORT}" target="_blank" rel="noopener">${esc(c.whatsappSupport)}</a></div></li>
          ${site.whatsappChannel ? `<li><span class="ico">${I.channel}</span><div><div class="k">قناة واتساب</div><a class="v" href="${site.whatsappChannel}" target="_blank" rel="noopener">تابع قناتنا في واتساب</a></div></li>` : ""}
          <li><span class="ico">${I.phone}</span><div><div class="k">التواصل الهاتفي</div><a class="v" href="tel:${esc(c.phoneIntl)}">${esc(c.phone)}</a></div></li>
          <li><span class="ico">${I.mail}</span><div><div class="k">البريد الإلكتروني</div><a class="v" href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>
          <li><span class="ico">${I.pin}</span><div><div class="k">العنوان</div><div class="v">${esc(c.address)}</div></div></li>
          <li><span class="ico">${I.clock}</span><div><div class="k">أوقات العمل</div><div class="v">${esc(c.hours)}</div></div></li>
        </ul>
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${encodeURIComponent("حي الملقا الرياض")}&output=embed" loading="lazy" title="موقع بيزنس بارتنر"></iframe>
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
  return page({ title: "اتصل بنا — بيزنس بارتنر", desc: "تواصل مع بيزنس بارتنر عبر واتساب أو الهاتف أو البريد — رد فوري من الوكيل الذكي 24/7.", active: "/contact", body });
}

function buildCart() {
  const cm = site.commerce;
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Your cart", "سلة الطلبات")}</span>
    <h1>${L("Your cart", cm.cartTitle)}</h1>
    <p class="lead">${L("Review your selected services and packages, then continue to bank-transfer checkout.", "راجع الخدمات والباقات المختارة، ثم أكمل الطلب عبر التحويل البنكي.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="cart-layout">
      <div class="cart-main">
        <div id="cart-items"></div>
        <div class="cart-empty" id="cart-empty" hidden><p>${L("Your cart is empty. Browse services and packages and add what suits you.", cm.cartEmpty)}</p>
          <a class="btn btn-primary" href="/services">${L("Browse services", "تصفّح الخدمات")}</a></div>
      </div>
      <aside class="cart-aside">
        <div class="order-box">
          <h3>${L("Summary", "الملخص")}</h3>
          <div class="calc-line"><span class="k">${L("Subtotal (fees)", "المجموع (الأتعاب)")}</span><span class="v" id="cart-subtotal">—</span></div>
          <div class="calc-line"><span class="k">${L("VAT 15%", "ضريبة القيمة المضافة 15%")}</span><span class="v" id="cart-vat">—</span></div>
          <div class="calc-total"><span class="k">${L("Total", "الإجمالي")}</span><span class="v" id="cart-total">—</span></div>
          <a class="btn btn-primary btn-lg" id="cart-checkout" href="/checkout" style="width:100%">${L("Checkout", "إتمام الطلب")}</a>
          <p class="mini">${L("Some items are quoted on review; the team confirms the final amount.", "بعض البنود تُسعّر عند المراجعة؛ يؤكد الفريق المبلغ النهائي.")}</p>
          <p class="calc-note">${esc(cm.vatNote)}</p>
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: "السلة — بيزنس بارتنر", desc: "سلة طلباتك من خدمات وباقات بيزنس بارتنر.", active: "/cart", body });
}

function buildCheckout() {
  const cm = site.commerce;
  const bank = site.bank;
  const steps = cm.steps
    .map((s) => `<div class="step"><div class="step-n">${esc(s.n)}</div><div><h3>${L(s.titleEn || s.title, s.title)}</h3><p>${L(s.textEn || s.text, s.text)}</p></div></div>`)
    .join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Checkout", "إتمام الطلب")}</span>
    <h1>${L("Checkout — bank transfer", cm.checkoutTitle)}</h1>
    <p class="lead">${L("Bank transfer for now. Enter your details, upload your documents, transfer the amount and upload the receipt to confirm your order. (Online payment coming soon.)", cm.checkoutIntro)}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="steps-grid" style="margin-bottom:36px">${steps}</div>
    <div class="cart-layout">
      <div class="cart-main">
        <form class="calc-form" id="checkout-form" novalidate>
          <h2>${L("Your details", "بياناتك")}</h2>
          <div class="grid grid-2" style="gap:0 20px">
            <div class="field"><label for="co-name">${L("Full name", "الاسم الكامل")}</label><input id="co-name" name="name" type="text" required></div>
            <div class="field"><label for="co-phone">${L("Mobile", "رقم الجوال")}</label><input id="co-phone" name="phone" type="tel" required></div>
          </div>
          <div class="grid grid-2" style="gap:0 20px">
            <div class="field"><label for="co-email">${L("Email", "البريد الإلكتروني")}</label><input id="co-email" name="email" type="email"></div>
            <div class="field"><label for="co-entity">${L("Company / entity (optional)", "المنشأة (اختياري)")}</label><input id="co-entity" name="entity" type="text"></div>
          </div>
          <h2>${L("Upload your documents", "ارفع مستنداتك")}</h2>
          <div class="field">
            <label class="file-drop" for="co-docs" id="docs-drop"><span class="file-ico">${I.upload}</span>
              <span class="file-text" id="docs-filename">${L("Required documents for your service (PDF/images) — optional now", "المستندات المطلوبة لخدمتك (PDF/صور) — اختياري الآن")}</span></label>
            <input id="co-docs" name="docs" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple hidden>
          </div>
          <div class="bank-box">
            <div class="bank-head">${I.bank}<strong>${L("Bank transfer details", "بيانات التحويل البنكي")}</strong></div>
            <ul class="bank-list">
              <li><span class="k">${L("Beneficiary", "المستفيد")}</span><span class="v">${esc(bank.beneficiary)}</span></li>
              <li><span class="k">${L("Bank", "البنك")}</span><span class="v">${esc(bank.bankName)}</span></li>
              <li><span class="k">IBAN</span><span class="v">${esc(bank.iban)}</span></li>
            </ul>
            <p class="calc-note">${esc(bank.note)}</p>
          </div>
          <h2>${L("Upload transfer receipt", "ارفع إيصال التحويل")}</h2>
          <div class="field">
            <label class="file-drop" for="co-receipt" id="receipt-drop"><span class="file-ico">${I.upload}</span>
              <span class="file-text" id="receipt-filename">${L("Bank transfer receipt (image/PDF)", "صورة إيصال التحويل (صورة/PDF)")}</span></label>
            <input id="co-receipt" name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" hidden>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Submit order", "أرسل الطلب")}</button>
          <p class="form-note">${L("On submit we save your order to your account on this device and open WhatsApp to notify our team. (Automated CRM/Drive link — Notion + n8n — coming soon.)", "عند الإرسال نحفظ طلبك في حسابك على هذا الجهاز ونفتح واتساب لإشعار فريقنا. (الربط الآلي مع CRM وDrive — Notion وn8n — قيد الإطلاق.)")}</p>
          <div class="form-success" id="checkout-success" hidden></div>
        </form>
      </div>
      <aside class="cart-aside">
        <div class="order-box">
          <h3>${L("Order summary", "ملخص الطلب")}</h3>
          <div id="checkout-items"></div>
          <div class="calc-line"><span class="k">${L("Subtotal (fees)", "المجموع (الأتعاب)")}</span><span class="v" id="co-subtotal">—</span></div>
          <div class="calc-line"><span class="k">${L("VAT 15%", "ضريبة القيمة المضافة 15%")}</span><span class="v" id="co-vat">—</span></div>
          <div class="calc-total"><span class="k">${L("Total", "الإجمالي")}</span><span class="v" id="co-total">—</span></div>
          <a class="btn btn-ghost" href="/cart" style="width:100%">${L("Edit cart", "تعديل السلة")}</a>
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: "إتمام الطلب — بيزنس بارتنر", desc: "أكمل طلبك عبر التحويل البنكي وارفع مستنداتك وإيصال التحويل.", active: "/cart", body });
}

function buildAccount() {
  const ac = site.account;
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Client portal", "منصّة العملاء")}</span>
    <h1>${L("Clients & Partners portal", ac.title)}</h1>
    <p class="lead">${L("Sign in to track your orders, upload documents, and follow your services with Business Partner.", ac.lead)}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="account-wrap" id="account-auth">
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" data-tab="login">${L("Sign in", ac.loginTitle)}</button>
        <button type="button" class="auth-tab" data-tab="register">${L("New account", ac.registerTitle)}</button>
      </div>
      <form class="calc-form auth-form" id="login-form">
        <div class="field"><label for="lg-email">${L("Email", "البريد الإلكتروني")}</label><input id="lg-email" type="email" required></div>
        <div class="field"><label for="lg-pass">${L("Password", "كلمة المرور")}</label><input id="lg-pass" type="password" required></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Sign in", "تسجيل الدخول")}</button>
      </form>
      <form class="calc-form auth-form" id="register-form" hidden>
        <div class="field"><label for="rg-name">${L("Full name", "الاسم الكامل")}</label><input id="rg-name" type="text" required></div>
        <div class="field"><label for="rg-email">${L("Email", "البريد الإلكتروني")}</label><input id="rg-email" type="email" required></div>
        <div class="field"><label for="rg-phone">${L("Mobile", "رقم الجوال")}</label><input id="rg-phone" type="tel"></div>
        <div class="field"><label for="rg-pass">${L("Password", "كلمة المرور")}</label><input id="rg-pass" type="password" required></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Create account", "إنشاء الحساب")}</button>
      </form>
      <p class="form-note">${esc(ac.demoNote)}</p>
    </div>

    <div class="account-dash" id="account-dash" hidden>
      <div class="dash-head">
        <div><h2 id="dash-hello">${L("Welcome", "مرحباً")}</h2><p id="dash-email" class="text-soft"></p></div>
        <button type="button" class="btn btn-ghost" id="logout-btn">${L("Sign out", "تسجيل الخروج")}</button>
      </div>
      <div class="dash-grid">
        <div class="dash-card"><h3>${L("My orders", "طلباتي")}</h3><div id="dash-orders"><p class="text-soft">${L("No orders yet.", "لا توجد طلبات بعد.")}</p></div>
          <a class="btn btn-ghost" href="/services">${L("Browse services", "تصفّح الخدمات")}</a></div>
        <div class="dash-card"><h3>${L("My documents", "مستنداتي")}</h3><div id="dash-uploads"><p class="text-soft">${L("No uploads yet.", "لا توجد ملفات بعد.")}</p></div>
          <a class="btn btn-ghost" href="/checkout">${L("Upload via an order", "ارفع عبر طلب")}</a></div>
      </div>
      <div class="callout" style="margin-top:24px"><span class="ico">💡</span><p>${L("This is a front-end preview. Secure partner accounts (Notion CRM + verification) are being connected.", ac.demoNote)}</p></div>
    </div>
  </div></section>`;
  return page({ title: "منصّة العملاء — بيزنس بارتنر", desc: "سجّل دخولك لمتابعة طلباتك ومستنداتك مع بيزنس بارتنر.", active: "/account", body });
}

/* ---------- write ---------- */
function write(rel, html) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

// Clean previously-generated pages (both trees) so stale files don't linger.
for (const dir of [ROOT, path.join(ROOT, "ar")]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(dir, f));
  }
  const sd = path.join(dir, "services");
  if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd)) if (f.endsWith(".html")) fs.unlinkSync(path.join(sd, f));
}
if (fs.existsSync(path.join(ROOT, "business-tourism.html"))) fs.unlinkSync(path.join(ROOT, "business-tourism.html"));
if (fs.existsSync(path.join(ROOT, "blog.html"))) fs.unlinkSync(path.join(ROOT, "blog.html"));

let pageCount = 0;
for (const lang of ["en", "ar"]) {
  LANG = lang;
  const pre = lang === "ar" ? "ar/" : "";
  write(`${pre}index.html`, buildHome());
  write(`${pre}about.html`, buildAbout());
  write(`${pre}services.html`, buildServicesIndex());
  write(`${pre}ai-agents.html`, buildAiAgents());
  write(`${pre}tourism.html`, buildTourism());
  write(`${pre}packages.html`, buildPackages());
  write(`${pre}calculator.html`, buildCalculator());
  write(`${pre}saudi-arabia.html`, buildSaudi());
  write(`${pre}news.html`, buildNews());
  write(`${pre}careers.html`, buildCareers());
  write(`${pre}contact.html`, buildContact());
  write(`${pre}cart.html`, buildCart());
  write(`${pre}checkout.html`, buildCheckout());
  write(`${pre}account.html`, buildAccount());
  services.forEach((s) => write(`${pre}services/${s.slug}.html`, buildServiceDetail(s)));
  pageCount += 14 + services.length;
}
LANG = "en";

// sitemap.xml — both language trees
const base = "https://businesspartner.sa";
const paths = ["/", "/about", "/services", "/ai-agents", "/tourism", "/packages", "/calculator", "/saudi-arabia", "/news", "/careers", "/contact", "/cart", "/checkout", "/account"]
  .concat(services.map((s) => `/services/${s.slug}`));
const urls = paths
  .flatMap((p) => [p, p === "/" ? "/ar/" : "/ar" + p])
  .map((p) => `  <url><loc>${base}${p}</loc></url>`)
  .join("\n");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);

console.log(`Generated ${pageCount} pages (en + ar) + sitemap.`);
