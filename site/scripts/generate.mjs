// Business Partner — static site generator (no framework, plain Node)
// Reads data/*.json and emits static HTML pages into the site root.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
// Cache-busting fingerprints: assets are served with a 1-year immutable
// Cache-Control, so every content change must produce a new URL.
const assetV = (rel) => crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex").slice(0, 10);
const CSS_V = assetV("assets/css/styles.css");
const JS_V = assetV("assets/js/main.js");

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
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.5l.5-3h-3V8.6c0-.87.24-1.46 1.5-1.46H16.6V4.5c-.28-.04-1.23-.12-2.34-.12-2.31 0-3.9 1.41-3.9 4v2.12H7.9v3h2.46V21h3.14z"/></svg>',
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
// Localize an Arabic price label string for the English tree (numbers + ﷼ kept).
function localizeLabel(l) {
  l = l || "";
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
const priceLabel = (s) => localizeLabel((s.price && s.price.label) || "");
// ASCII-safe id from any string (keeps Arabic out of element ids / data-id).
const asciiId = (pfx, str) => pfx + "-" + String(str).split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) >>> 0, 5381).toString(36);
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

// Single add-to-cart button. Item carried in data-* attributes; cart lives in localStorage (see main.js).
function cartBtns({ id, nameEn, nameAr, amount, priceLabel, kind = "service", ghost = false }) {
  // Keep data-id ASCII (ids may be built from Arabic names) and localize the shown price label.
  const safeId = /[^\x00-\x7F]/.test(String(id)) ? asciiId(kind, id) : id;
  const data = `data-id="${esc(safeId)}" data-name-en="${esc(nameEn || nameAr)}" data-name-ar="${esc(nameAr)}" data-amount="${amount != null ? amount : ""}" data-price="${esc(localizeLabel(priceLabel || ""))}" data-kind="${esc(kind)}"`;
  return `<div class="buy-row">
    <button type="button" class="btn ${ghost ? "btn-ghost" : "btn-primary"} add-cart" ${data}>${I.cart}<span>${L("Add to cart", "أضف إلى السلة")}</span></button>
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
<meta name="generator" content="Business Partner 3.0 Website">
<link rel="alternate" hreflang="en" href="${enUrl}">
<link rel="alternate" hreflang="ar" href="${arUrl}">
<link rel="alternate" hreflang="x-default" href="${enUrl}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/styles.css?v=${CSS_V}">
</head>
<body>`;
}

const NAV_GROUPS = [
  { href: "/", en: "Home", ar: "الرئيسية" },
  {
    en: "Our services", ar: "خدماتنا",
    items: [
      { href: "/services", en: "All services (93)", ar: "كل الخدمات (93)" },
      { href: "/packages", en: "Packages", ar: "الباقات" },
      { href: "/ai-agents", en: "AI Agents", ar: "الوكلاء الأذكياء" },
      { href: "/calculator", en: "Cost calculator", ar: "حاسبة التكلفة" },
      { href: "/compliance-calculators", en: "Compliance tools", ar: "أدوات الامتثال" },
      { href: "/tourism", en: "Tourism & events", ar: "السياحة والفعاليات" },
    ],
  },
  {
    en: "Saudi Arabia", ar: "السعودية",
    items: [
      { href: "/saudi-arabia", en: "Invest in Saudi", ar: "الاستثمار في السعودية" },
      { href: "/news", en: "Insights & news", ar: "الرؤى والأخبار" },
    ],
  },
  {
    en: "Company", ar: "الشركة",
    items: [
      { href: "/about", en: "About us", ar: "من نحن" },
      { href: "/suppliers", en: "Suppliers portal", ar: "بوابة الموردين" },
      { href: "/careers", en: "Careers", ar: "الوظائف" },
      { href: "/contact", en: "Contact us", ar: "تواصل معنا" },
    ],
  },
];

function langToggle(path) {
  return `<a class="lang-toggle" href="${mirrorUrl(path)}" aria-label="Switch language / تبديل اللغة">
    ${saudiFlag}<span class="lang-label">${LANG === "ar" ? "English" : "العربية"}</span></a>`;
}

function header(active, path) {
  const links = NAV_GROUPS.map((g) => {
    if (g.href) {
      return `<a href="${u(g.href)}"${g.href === active ? ' class="active"' : ""}>${L(g.en, g.ar)}</a>`;
    }
    const isActive = g.items.some((it) => it.href === active);
    const menu = g.items
      .map((it) => `<a href="${u(it.href)}"${it.href === active ? ' class="active"' : ""}>${L(it.en, it.ar)}</a>`)
      .join("");
    return `<div class="nav-group${isActive ? " active" : ""}">
      <button type="button" class="nav-drop${isActive ? " active" : ""}" aria-expanded="false">${L(g.en, g.ar)} ${I.chevron}</button>
      <div class="nav-menu">${menu}</div>
    </div>`;
  }).join("");
  return `<header class="site-header"><div class="container header-inner">
  <a class="logo" href="${u("/")}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <nav class="nav" aria-label="Main navigation">${links}<a class="btn btn-primary nav-cta" href="${u("/consultation")}">${I.calendar}<span>${L("Book a consultation", "احجز استشارة")}</span></a></nav>
  <div class="header-cta">
    ${langToggle(path)}
    <a class="icon-btn" href="${u("/account")}" aria-label="${Lraw("Account", "حسابي")}">${I.user}</a>
    <a class="icon-btn cart-link" href="${u("/cart")}" aria-label="${Lraw("Cart", "السلة")}">${I.cart}<span class="cart-badge" id="cart-badge" hidden>0</span></a>
    <a class="btn btn-primary" href="${u("/consultation")}">${I.calendar}<span>${L("Book a consultation", "احجز استشارة")}</span></a>
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
      ${fl("/compliance-calculators", "Compliance calculators", "حاسبات الامتثال")}
      ${fl("/compliance-portal", "Compliance portal", "بوابة امتثال المنشأة")}
      ${fl("/account", "Client portal", "منصّة العملاء")}
      ${fl("/suppliers", "Suppliers portal", "بوابة الموردين")}
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
    </ul>
    ${site.social ? `<div class="footer-social" aria-label="${Lraw("Social media", "حساباتنا في التواصل الاجتماعي")}">
      ${site.social.linkedin ? `<a href="${site.social.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn">${I.linkedin}</a>` : ""}
      ${site.social.instagram ? `<a href="${site.social.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${I.instagram}</a>` : ""}
      ${site.social.facebook ? `<a href="${site.social.facebook}" target="_blank" rel="noopener" aria-label="Facebook">${I.facebook}</a>` : ""}
    </div>` : ""}</div>
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
    `<script src="/assets/js/main.js?v=${JS_V}"></script>${script}</body></html>`
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
        (s.price.amount != null ? `Business Partner's fee for this service is ${localizeLabel(s.price.label)}. ` : "This service is quoted individually based on your case. ") +
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
  // Parallel English content (index-aligned with the Arabic data in site.json).
  const EN = {
    heroTitle: "One operating partner for every business requirement in Saudi Arabia",
    heroSubtitle: "From company formation and foreign investment to licensing, HR and government compliance — we get it done clearly and quickly, and follow it through to issuance.",
    heroCta: "Start now", heroCtaSecondary: "Browse services",
    why: { title: "Why Business Partner", items: [
      { title: "Smart agent on WhatsApp", text: "Answers your questions 24/7, identifies the right service for your case, and starts preparing your document list automatically." },
      { title: "Fast execution", text: "Ready-made tracks and precise knowledge of the regulations save time — we start as soon as your documents are complete." },
      { title: "Full transparency", text: "Clear fees, with government fees separate and disclosed. You know what you pay and why before you begin." },
    ]},
    coreTitle: "Our core services", coreSubtitle: "90+ services classified per the official catalog — covering your business journey from formation to operation.",
    cards: [
      { title: "Company Formation", text: "CR registration, LLC formation, entity conversions, and more." },
      { title: "Foreign Investment", text: "MISA license, 100% foreign company, foreign branch, and partnerships." },
      { title: "Premium Residency", text: "Choosing the right product and managing the application to issuance — no sponsor." },
      { title: "Government Relations", text: "Qiwa, HR, Muqeem, GOSI, Balady, and sector licensing." },
      { title: "HR Services", text: "Managing Qiwa, GOSI and Mudad, contracts, sponsorship transfer and compliance." },
      { title: "Recruitment & Hiring", text: "Talent attraction and end-to-end recruitment procedures." },
    ],
    allServices: "All services", packagesDetails: "Package details",
    agentEyebrow: "The killer feature", agentTitle: "The killer feature: the smart agent on WhatsApp",
    agentText: "Instead of waiting for office hours, the smart agent replies instantly, any time — it understands your case, recognises your client type (individual/business, Saudi/Gulf/foreign), gives you the right requirements and documents, and starts preparing your request immediately. When a human decision is needed, it hands you to our team at once.",
    agentBullets: ["Instant reply 24/7, no waiting", "Identifies the right service and track for your case", "Prepares your document list automatically", "Hands you to a human expert when needed"],
    agentCta: "Try the smart agent now", agentLearn: "Meet the agents system",
    bubbleYou: "You", bubbleQ: "I want to set up a foreign company — what documents do I need?",
    bubbleAgent: "Smart agent · now", bubbleA: "Sure! I need the parent company's attested Commercial Registration, financial statements, and a board resolution. Shall I prepare the full list for you?",
    trustEyebrow: "Trust in numbers",
    stats: [
      { label: "Clients served" }, { label: "Years of experience in the Saudi market" },
      { label: "Services in the official catalog" }, { label: "Government authorities we deal with" },
    ],
    whyEyebrow: "Why us", servicesEyebrow: "Services", packagesEyebrow: "Packages", reviewsEyebrow: "Client reviews",
    reviewsItems: [
      { text: "They completed my company formation quickly and every step was clear from the start.", name: "Client — retail sector", role: "Company formation" },
      { text: "The agent on WhatsApp answered me at night and prepared my document list right away.", name: "Client — investor", role: "Foreign investment" },
      { text: "Clear fees with no surprises, and they followed through until the license was issued.", name: "Client — industrial sector", role: "Industrial license" },
    ],
    finalTitle: "Ready to start?", finalText: "Send us your enquiry on WhatsApp now — the smart agent replies instantly and sets your next step.", finalCta: "Start on WhatsApp",
  };

  const whyCards = h.why.items
    .map((it, i) => `<div class="card feature"><div class="card-icon">${I[it.icon] || I.check}</div>
      <h3>${L(EN.why.items[i].title, it.title)}</h3><p>${L(EN.why.items[i].text, it.text)}</p></div>`)
    .join("");
  const svcCards = h.coreServices.cards
    .map((c, i) => `<a class="card svc-card" href="${u("/services")}#${slugCat(c.category)}">
      <div class="card-icon">${I.building}</div>
      <h3>${L(EN.cards[i].title, c.title)}</h3><p class="desc">${L(EN.cards[i].text, c.text)}</p>
      <span class="card-link">${L("Browse services", "استعرض الخدمات")} ${I.arrow}</span></a>`)
    .join("");
  const pkgCards = site.packages.tiers
    .map((t) => `<div class="pkg${t.highlight ? " pop" : ""}">
      <div class="pk-name">${L(t.nameEn || t.nameAr, t.nameAr)}</div>
      ${t.price ? `<div class="pk-price">${esc(t.price)}</div>` : ""}
      <p class="pk-for">${L(t.forEn || t.for, t.for)}</p>
      <ul>${t.features.slice(0, 4).map((f, i) => `<li>${I.check}<span>${L((t.featuresEn && t.featuresEn[i]) || f, f)}</span></li>`).join("")}</ul>
      <a class="btn ${t.highlight ? "btn-primary" : "btn-ghost"}" href="${u("/packages")}">${L("Package details", "تفاصيل الباقة")}</a>
    </div>`)
    .join("");
  const agentBullets = h.agent.bullets.map((b, i) => `<li>${I.check}<span>${L(EN.agentBullets[i], b)}</span></li>`).join("");
  const stats = h.stats.items.map((s, i) => `<div class="stat"><div class="num">${esc(s.value)}</div><div class="lbl">${L(EN.stats[i].label, s.label)}</div></div>`).join("");
  const quotes = h.testimonials.items
    .map((q, i) => `<div class="quote"><p>${L(EN.reviewsItems[i].text, q.text)}</p><div class="who">${L(EN.reviewsItems[i].name, q.name)}</div><div class="role">${L(EN.reviewsItems[i].role, q.role)}</div></div>`)
    .join("");

  const body = `
  <section class="hero"><div class="container hero-inner">
    <p class="hero-tagline">${L("Partnering for your success", "شركاء نجاحك")}</p>
    <h1>${L(EN.heroTitle, h.heroTitle)}</h1>
    <p class="lead">${L(EN.heroSubtitle, h.heroSubtitle)}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="${u("/consultation")}">${I.calendar}<span>${L("Book a free consultation", "احجز استشارة مجانية")}</span></a><a class="btn btn-ghost btn-lg" href="${u("/services")}">${L(EN.heroCtaSecondary, h.heroCtaSecondary)}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Instant reply 24/7", "رد فوري 24/7")}</span>
      <span class="hero-badge">${I.check}${L("90+ government services", "+90 خدمة حكومية")}</span>
      <span class="hero-badge">${I.check}${L("Transparent fees", "أتعاب شفافة")}</span>
    </div>
  </div></section>

  <section class="section section--navy trust-band"><div class="container">
    <div class="section-head"><span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${L(EN.trustEyebrow, h.stats.eyebrow || "أرقام ثقة")}</span><h2 style="color:#fff">${L("Numbers we're proud of", h.stats.title)}</h2></div>
    <div class="stats">${stats}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(EN.whyEyebrow, "لماذا نحن")}</span><h2>${L(EN.why.title, h.why.title)}</h2></div>
    <div class="grid grid-3">${whyCards}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(EN.servicesEyebrow, "الخدمات")}</span><h2>${L(EN.coreTitle, h.coreServices.title)}</h2><p>${L(EN.coreSubtitle, h.coreServices.subtitle)}</p></div>
    <div class="grid grid-3">${svcCards}</div>
    <div class="center mt-32"><a class="btn btn-primary" href="${u("/services")}">${L(EN.allServices, "كل الخدمات")} ${I.arrow}</a></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(EN.packagesEyebrow, "الباقات")}</span><h2>${L(site.packages.titleEn || site.packages.title, site.packages.title)}</h2><p>${L(site.packages.subtitleEn || site.packages.subtitle, site.packages.subtitle)}</p></div>
    <div class="grid grid-3">${pkgCards}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="agent"><div class="agent-inner">
      <div>
        <span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${L(EN.agentEyebrow, "الميزة القاتلة")}</span>
        <h2>${L(EN.agentTitle, h.agent.title)}</h2>
        <p>${L(EN.agentText, h.agent.text)}</p>
        <ul class="agent-list">${agentBullets}</ul>
        <div class="hero-actions">${waBtn2(EN.agentCta, h.agent.cta, "btn-white", true)}<a class="btn btn-lg" href="${u("/ai-agents")}" style="border-color:rgba(255,255,255,.5);color:#fff">${L(EN.agentLearn, "تعرّف على منظومة الوكلاء")}</a></div>
      </div>
      <div class="agent-visual">
        <div class="bubble"><span>${L(EN.bubbleYou, "أنت")}</span>${L(EN.bubbleQ, "أبغى أأسس شركة أجنبية، وش المستندات؟")}</div>
        <div class="bubble me"><span>${L(EN.bubbleAgent, "الوكيل الذكي · الآن")}</span>${L(EN.bubbleA, "تمام! أحتاج السجل التجاري للشركة الأم مصدّق، القوائم المالية، وقرار مجلس الإدارة. أجهّز لك القائمة كاملة؟")}</div>
      </div>
    </div></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(EN.reviewsEyebrow, "آراء العملاء")}</span><h2>${L("Client reviews", h.testimonials.title)}</h2><p>${L("We'll add our clients' real stories here soon, once publishing is approved.", h.testimonials.note)}</p></div>
    <div class="grid grid-3">${quotes}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L(EN.finalTitle, h.finalCta.title)}</h2><p>${L(EN.finalText, h.finalCta.text)}</p><a class="btn btn-white btn-lg" href="${u("/consultation")}">${I.calendar}<span>${L("Book a consultation", "احجز استشارة")}</span></a></div>
  </div></section>`;

  return page({ title: Lraw("Business Partner — your business operating partner in Saudi Arabia", "بيزنس بارتنر — شريك تشغيل أعمالك في السعودية"), desc: Lraw(site.brand.shortBioEn || site.brand.shortBio, site.brand.shortBio), active: "/", body });
}

function buildAbout() {
  const a = site.about;
  const secs = a.sections.map((s) => `<div class="card"><h3>${L(s.titleEn || s.title, s.title)}</h3><p>${L(s.textEn || s.text, s.text)}</p></div>`).join("");
  const vals = a.values.map((v) => `<div class="card feature"><div class="card-icon">${I.check}</div><h3>${L(v.titleEn || v.title, v.title)}</h3><p>${L(v.textEn || v.text, v.text)}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("About", "من نحن")}</span>
    <h1>${L(a.titleEn || a.title, a.title)}</h1>
    <p class="lead">${L(a.leadEn || a.lead, a.lead)}</p>
    <div class="hero-actions">${waBtn2("Talk to us", "تحدث معنا", "btn-primary")}<a class="btn btn-ghost" href="${u("/services")}">${L("Browse services", "استعرض الخدمات")}</a></div>
  </div></section>
  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Our promise", "وعدنا")}</span><h2>${L(a.promiseEn || a.promise, a.promise)}</h2></div>
    <div class="grid grid-3">${secs}</div>
  </div></section>
  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Our values", "قيمنا")}</span><h2>${L(a.headingValuesEn || "ما الذي يوجّه عملنا", "ما الذي يوجّه عملنا")}</h2></div>
    <div class="grid grid-4">${vals}</div>
  </div></section>
  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Ready to start your journey?", "جاهز نبدأ رحلتك؟")}</h2><p>${L("The smart agent replies instantly on WhatsApp and sets your next step.", "الوكيل الذكي يرد فوراً على واتساب ويحدد لك الخطوة التالية.")}</p>${waBtn2("Start now", "ابدأ الآن", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("About — Business Partner", "من نحن — بيزنس بارتنر"), desc: Lraw(a.leadEn || a.lead, a.lead), active: "/about", body });
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
      (s) => `<div class="step"><div class="step-n">${esc(s.n)}</div><div><h3>${L(s.titleEn || s.title, s.title)}</h3><p>${L(s.textEn || s.text, s.text)}</p></div></div>`
    )
    .join("");
  const cards = a.agents
    .map(
      (g) => `<div class="pkg${g.highlight ? " pop" : ""}">
      <div class="pk-name">${L(g.nameEn || g.name, g.name)}<small>${L(g.taglineEn || g.tagline, g.tagline)}</small></div>
      <div class="pk-price">${esc(priceLabel({ price: { label: g.price } }))}</div>
      <p class="pk-for">${L(g.forEn || g.for, g.for)}</p>
      <ul>${g.features.map((f, i) => `<li>${I.check}<span>${L((g.featuresEn && g.featuresEn[i]) || f, f)}</span></li>`).join("")}</ul>
      ${cartBtns({ id: "agent-" + esc((g.nameEn || g.name)).replace(/\s+/g, "-"), nameEn: g.nameEn || g.name, nameAr: g.name, amount: parseAmount(g.price), priceLabel: g.price, kind: "agent", ghost: !g.highlight })}
      ${waBtn2("Order this agent on WhatsApp", "اطلب هذا الوكيل على واتساب", "btn-ghost")}
    </div>`
    )
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("AI Agents", "الوكلاء الأذكياء")}</span>
    <h1>${L(a.titleEn || a.title, a.title)}</h1>
    <p class="lead">${L(a.leadEn || a.lead, a.lead)}</p>
    <div class="hero-actions">${waBtn2(a.ctaEn || a.cta, a.cta, "btn-primary", true)}<a class="btn btn-ghost btn-lg" href="#agents">${L(a.learnEn || "استعرض الوكلاء", "استعرض الوكلاء")}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("24/7 monitoring", "مراقبة 24/7")}</span>
      <span class="hero-badge">${I.check}${L("Autonomous execution", "تنفيذ ذاتي")}</span>
      <span class="hero-badge">${I.check}${L("Approval & payment only", "موافقة ودفع فقط")}</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(a.how.eyebrowEn || a.how.eyebrow, a.how.eyebrow)}</span><h2>${L(a.how.titleEn || a.how.title, a.how.title)}</h2></div>
    <div class="steps-grid">${steps}</div>
  </div></section>

  <section class="section" id="agents"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("The system", "المنظومة")}</span><h2>${L(a.packagesTitleEn || a.packagesTitle, a.packagesTitle)}</h2><p>${L(a.packagesSubtitleEn || a.packagesSubtitle, a.packagesSubtitle)}</p></div>
    <div class="grid grid-3">${cards}</div>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${L(a.pricingNoteEn || a.pricingNote, a.pricingNote)}</p></div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="cta-band"><h2>${L("Ready to see the agents at work?", "جاهز تشوف الوكلاء يشتغلون؟")}</h2><p>${L("Book a demo with our team and we'll design the system to fit your entity.", "احجز عرضاً توضيحياً مع فريقنا، ونصمّم لك المنظومة على مقاس منشأتك.")}</p>${waBtn2(a.ctaEn || a.cta, a.cta, "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("AI Agents — Business Partner", "الوكلاء الأذكياء — بيزنس بارتنر"), desc: Lraw((a.leadEn || a.lead).slice(0, 155), a.lead.slice(0, 155)), active: "/ai-agents", body });
}

function buildPackages() {
  const p = site.packages;
  const tiers = p.tiers
    .map(
      (t) => `<div class="pkg${t.highlight ? " pop" : ""}">
      <div class="pk-name">${L(t.nameEn || t.name || t.nameAr, t.nameAr)}</div>
      ${t.price ? `<div class="pk-price">${esc(t.price)}</div>` : ""}
      <p class="pk-for">${L(t.forEn || t.for, t.for)}</p>
      <ul>${t.features.map((f, i) => `<li>${I.check}<span>${L((t.featuresEn && t.featuresEn[i]) || f, f)}</span></li>`).join("")}</ul>
      ${cartBtns({ id: "pkg-" + (t.key || t.name), nameEn: t.nameEn || t.name || t.nameAr, nameAr: t.nameAr, amount: t.amount != null ? t.amount : null, priceLabel: t.price || Lraw("Contact us for pricing", "تواصل معنا للتسعير"), kind: "package", ghost: !t.highlight })}
    </div>`
    )
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Packages", "الباقات")}</span>
    <h1>${L(p.titleEn || p.title, p.title)}</h1>
    <p class="lead">${L(p.subtitleEn || p.subtitle, p.subtitle)}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3">${tiers}</div>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${L(p.noteEn || p.note, p.note)}</p></div>
  </div></section>
  <section class="section section--gray"><div class="container">
    <div class="cta-band"><h2>${L("Not sure which package fits you?", "محتار أي باقة تناسبك؟")}</h2><p>${L("The smart agent asks a few questions and recommends the best package in minutes.", "الوكيل الذكي يسألك بضعة أسئلة ويرشّح لك الباقة الأنسب في دقائق.")}</p>${waBtn2("Help me choose", "ساعدني أختار", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("Packages — Business Partner", "الباقات — بيزنس بارتنر"), desc: Lraw(p.subtitleEn || p.subtitle, p.subtitle), active: "/packages", body });
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
    <p style="margin-top:14px"><a class="btn btn-ghost" href="${u("/compliance-calculators")}">🟢 ${L("Nitaqat & government cost calculators →", "حاسبات النطاقات والتكاليف الحكومية ←")}</a></p>
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
          <a class="btn btn-primary btn-lg" id="calc2-quote" href="${u("/checkout")}" style="width:100%">${L("Request an official quote", "اطلب عرضاً رسمياً")}</a>
          <a class="btn btn-wa" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L("Or discuss on WhatsApp", "أو ناقشنا على واتساب")}</span></a>
          <p class="calc-note">${L("Estimates from the official catalog; final pricing may vary by your case. Government fees are separate.", "تقديرات من الكتالوج الرسمي وقد تختلف حسب حالتك. الرسوم الحكومية منفصلة.")}</p>
        </div>
      </aside>
    </div>
  </div></section>
  <script>window.BP_CALC = ${JSON.stringify(groups)};window.BP_CALC_LANG = ${JSON.stringify(LANG)};</script>`;
  return page({ title: Lraw("Cost calculator — Business Partner", "حاسبة التكلفة — بيزنس بارتنر"), desc: Lraw("Build a basket of Business Partner services and see one-time and monthly fees from the official catalog.", "كوّن سلّة من خدمات بيزنس بارتنر واعرف الأتعاب لمرة واحدة والشهرية من الكتالوج الرسمي."), active: "/calculator", body });
}

function buildComplianceCalculators() {
  // Official activities dataset (codes + AR/EN names from the ISIC4 master reference in Notion).
  let ACT_V = "0";
  try { ACT_V = assetV("assets/data/activities.json"); } catch { /* file generated separately */ }
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Free compliance tools", "أدوات امتثال مجانية")}</span>
    <h1>${L("Nitaqat & government cost calculators", "حاسبات النطاقات والتكاليف الحكومية")}</h1>
    <p class="lead">${L("Estimate your Saudization (Nitaqat) band and per-worker government costs (work permit, iqama, medical insurance, fines) in seconds — before committing to anything.", "احسب نطاق السعودة المتوقع لمنشأتك وتكاليف العمالة الحكومية لكل عامل (رخصة العمل، الإقامة، التأمين الطبي، الغرامات) خلال ثوانٍ — وقبل أي التزام.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
    <div class="cc-agent">
      <div class="cc-agent-main">
        <div class="cc-agent-title">${I.shield}<div><strong>${L("The Compliance Agent — working for you right now", "وكيل الامتثال — يعمل لأجلك الآن")}</strong><span class="cc-agent-live">● ${L("LIVE", "نشط")}</span></div></div>
        <p>${L("An AI agent that monitors Qiwa, Muqeem, GOSI and Mudad daily: tracks every iqama, work permit and wage-protection deadline, classifies urgency (red ≤7 days · yellow ≤30), computes your Nitaqat band and estimated costs, and alerts you on WhatsApp and email before any violation — with human approval required before any government action.", "وكيل ذكاء اصطناعي يراقب قوى ومقيم والتأمينات ومدد يومياً: يتتبع كل إقامة ورخصة عمل ومهلة حماية أجور، يصنّف الخطورة (أحمر ≤ 7 أيام · أصفر ≤ 30)، يحسب نطاقك وتكاليفك التقديرية، وينبّهك واتساب وإيميل قبل أي مخالفة — وبموافقة بشرية قبل أي إجراء حكومي.")}</p>
        <div class="cc-agent-feats">
          <span>🛡️ ${L("Daily monitoring 07:00", "مراقبة يومية 07:00")}</span>
          <span>🔴🟡 ${L("Early red/yellow alerts", "تنبيه مبكر أحمر/أصفر")}</span>
          <span>📱 ${L("WhatsApp + email", "واتساب + إيميل")}</span>
          <span>⚖️ ${L("Your approval before any action", "موافقتك قبل أي إجراء")}</span>
        </div>
      </div>
      <div class="cc-agent-cta">
        <a href="#" class="btn btn-primary cc-goto-upload">📤 ${L("Activate monitoring — upload your files", "فعّل المراقبة — ارفع ملفاتك")}</a>
        <a class="btn btn-ghost" href="${u("/ai-agents")}">${L("About the AI agents →", "عن الوكلاء الأذكياء ←")}</a>
      </div>
    </div>
    <div class="cc-tabs" role="tablist">
      <button class="cc-tab active" data-tab="nitaqat" role="tab">🟢 ${L("Nitaqat calculator", "حاسبة النطاقات")}</button>
      <button class="cc-tab" data-tab="fees" role="tab">💰 ${L("Cost calculator", "حاسبة التكاليف")}</button>
      <button class="cc-tab" data-tab="prof" role="tab">🧑‍💼 ${L("Profession checker", "فاحص المهن")}</button>
      <button class="cc-tab" data-tab="upload" role="tab">📤 ${L("Upload your files", "ارفع ملفاتك")}</button>
    </div>

    <div class="cc-panel active" id="cc-panel-nitaqat">
      <div class="order-box">
        <h3>${L("Saudization (Nitaqat) calculator — official Developed-Nitaqat formula", "حاسبة نطاقات السعودة — بمعادلة نطاقات المطوّر الرسمية")}</h3>
        <p class="cc-sub">${L("Built on the official HRSD procedural guide (Developed Nitaqat 2026): band thresholds are computed per activity with the official formula ", "مبنية على الدليل الإجرائي الرسمي لوزارة الموارد البشرية (نطاقات المطوّر 2026): عتبات النطاقات تُحسب لكل نشاط بالمعادلة الرسمية ")}<code>ص = م × لوغ(س) + ث</code>${L(" — the same engine behind Qiwa's calculator.", " — نفس منهجية حاسبة قوى.")}</p>
        <div class="field cc-act-field">
          <label for="cc-activity">🔎 ${L("Find your exact CR activity — type the name or the 6-digit code", "ابحث عن نشاطك في السجل التجاري — اكتب الاسم أو الكود")}</label>
          <input type="text" id="cc-activity" autocomplete="off" placeholder="${Lraw("e.g. 471101, contracting, pharmacy…", "مثال: 471101، مقاولات، صيدلية…")}">
          <div class="cc-act-drop" id="cc-act-drop" hidden></div>
        </div>
        <div class="cc-act-chips" id="cc-act-chips" aria-label="${Lraw("Activity sectors", "قطاعات الأنشطة")}"></div>
        <div class="cc-act-info" id="cc-act-info" hidden></div>
        <div class="cc-grid">
          <div class="field" style="grid-column:1/-1"><label for="cc-act">${L("Economic activity (per Nitaqat classification)", "النشاط الاقتصادي (حسب تصنيف نطاقات)")}</label><select id="cc-act"></select></div>
          <div class="field"><label for="cc-year">${L("Calculation year", "سنة الاحتساب")}</label><select id="cc-year"><option value="y2026" selected>2026</option><option value="y2027">2027</option><option value="y2028">2028</option></select></div>
          <div class="field"><label for="cc-total">${L("Total workforce (entity)", "إجمالي العمالة (الكيان)")}</label><input type="number" id="cc-total" min="1" value="25"></div>
          <div class="field"><label for="cc-saudis">${L("Saudi employees (average)", "متوسط العمالة السعودية")}</label><input type="number" id="cc-saudis" min="0" value="3"></div>
        </div>
        <button class="btn btn-primary" id="cc-nit-calc">${L("Calculate", "احسب")}</button>
        <p class="form-note">💡 ${L("Don't know your exact numbers?", "ما تعرف أعدادك بدقة؟")} <a href="#" class="cc-goto-upload">${L("Upload your GOSI/Qiwa/Muqeem file and we'll extract them →", "ارفع ملف التأمينات/قوى/مقيم ونستخرجها عنك ←")}</a></p>
        <div class="cc-result" id="cc-nit-result" hidden>
          <div class="cc-tiles">
            <div class="cc-tile"><span>${L("Saudization rate", "نسبة التوطين")}</span><strong id="cc-pct">—</strong></div>
            <div class="cc-tile"><span>${L("Expected band", "النطاق المتوقع")}</span><strong id="cc-band">—</strong></div>
            <div class="cc-tile"><span>${L("Band floor (your activity & size)", "الحد الأدنى لنطاقك")}</span><strong id="cc-floor">—</strong></div>
          </div>
          <div class="cc-thresholds" id="cc-thresholds"></div>
          <div class="cc-advice" id="cc-advice"></div>
          <p class="form-note">📘 ${L("Source: HRSD Developed-Nitaqat procedural guide (2026). Verify officially on", "المصدر: الدليل الإجرائي لبرنامج نطاقات المطوّر (2026). للتحقق الرسمي استخدم")} <a href="https://www.qiwa.sa/ar/tools-and-calculators/nitaqat-calculator" target="_blank" rel="noopener">${L("Qiwa's Nitaqat calculator ↗", "حاسبة النطاقات في قوى ↗")}</a></p>
        </div>
      </div>
    </div>

    <div class="cc-panel" id="cc-panel-fees">
      <div class="order-box">
        <h3>${L("Government cost calculator", "حاسبة التكاليف الحكومية")}</h3>
        <p class="cc-sub">${L("Work permit (Qiwa) + iqama (Muqeem) + medical insurance + fines — per worker, quarterly and annually.", "رخصة العمل (قوى) + الإقامة (مقيم) + التأمين الطبي + الغرامات — لكل عامل، ربعياً وسنوياً.")}</p>
        <div id="cc-rows"></div>
        <button class="btn btn-ghost cc-btn-sm" id="cc-add">${L("+ Add another profession", "+ إضافة مهنة أخرى")}</button>
        <p class="form-note">💡 ${L("New worker: 3 free months on first entry + a one-time medical exam.", "العامل الجديد: 3 أشهر مجانية عند أول دخول + فحص طبي لمرة واحدة.")}</p>
        <details class="cc-rates"><summary>⚙️ ${L("Rate basis used (editable)", "الأسس السعرية المستخدمة (قابلة للتعديل)")}</summary>
          <div class="cc-grid">
            <div class="field"><label>${L("Work permit — annual", "رخصة العمل — سنوياً")}</label><input type="number" id="cc-rate-permit" value="9700"></div>
            <div class="field"><label>${L("Iqama — annual", "الإقامة — سنوياً")}</label><input type="number" id="cc-rate-iqama" value="650"></div>
            <div class="field"><label>${L("Medical insurance — annual", "التأمين الطبي — سنوياً")}</label><input type="number" id="cc-rate-medical" value="1000"></div>
            <div class="field"><label>${L("Medical exam (new)", "الفحص الطبي (للجديد)")}</label><input type="number" id="cc-rate-exam" value="300"></div>
          </div>
        </details>
        <button class="btn btn-primary" id="cc-fees-calc">${L("Calculate", "احسب")}</button>
        <div class="cc-result" id="cc-fees-result" hidden>
          <div class="cc-tiles">
            <div class="cc-tile"><span>${L("Workers", "عدد العمّال")}</span><strong id="cc-workers">—</strong></div>
            <div class="cc-tile"><span>${L("Quarterly total", "الإجمالي الربعي")}</span><strong id="cc-quarter">—</strong></div>
            <div class="cc-tile"><span>${L("Annual total", "الإجمالي السنوي")}</span><strong id="cc-annual">—</strong></div>
          </div>
          <div class="cc-table-wrap"><table class="cc-table"><thead><tr>
            <th>${L("Profession", "المهنة")}</th><th>${L("Status", "الحالة")}</th><th>${L("Count", "العدد")}</th>
            <th>${L("Quarterly / worker", "ربعي / عامل")}</th><th>${L("Annual / worker", "سنوي / عامل")}</th>
          </tr></thead><tbody id="cc-tbody"></tbody></table></div>
        </div>
      </div>
    </div>


    <div class="cc-panel" id="cc-panel-prof">
      <div class="order-box">
        <h3>${L("Saudized professions checker (HRSD)", "فاحص المهن المسعودة (قرارات التوطين)")}</h3>
        <p class="cc-sub">${L("Type a profession to see if it is Saudi-only or has a required Saudization ratio — with the decision number, minimum counted salary, and accrediting body. Source: official HRSD localization decisions.", "اكتب المهنة لتعرف هل هي مقصورة على السعوديين أو لها نسبة توطين مطلوبة — مع رقم القرار والحد الأدنى للراتب المحتسب وجهة الاعتماد. المصدر: قرارات التوطين الرسمية لوزارة الموارد البشرية.")}</p>
        <div class="field"><label for="cc-prof-q">${L("Profession or sector", "المهنة أو القطاع")}</label><input type="text" id="cc-prof-q" placeholder="${Lraw("e.g. accountant, secretary, engineer, dentist…", "مثال: محاسب، سكرتير، مهندس، طبيب أسنان…")}"></div>
        <div class="cc-prof-chips" id="cc-prof-chips"></div>
        <div id="cc-prof-results"></div>
      </div>
    </div>

    <div class="cc-panel" id="cc-panel-upload">
      <div class="order-box">
        <h3>${L("Let the agent read your official files", "خلّ الوكيل يقرأ ملفاتك الرسمية")}</h3>
        <p class="cc-sub">${L("Don't know your exact headcounts? Export one report from your government platforms and upload it — our AI agent extracts your employees (Saudis vs. expats, salaries, professions, iqama numbers), fills the calculators for you, and your dedicated file is updated automatically.", "ما تعرف أعدادك بدقة؟ صدّر تقريراً واحداً من منصاتك الحكومية وارفعه — الوكيل الذكي يستخرج موظفيك (سعوديون/وافدون، الرواتب، المهن، أرقام الإقامات)، يعبّي الحاسبات عنك، ويحدَّث ملفك الخاص تلقائياً.")}</p>

        <div class="cc-src-grid">
          <div class="cc-src cc-src-best">
            <div class="cc-src-head">🏦 ${L("GOSI (recommended — most accurate)", "التأمينات الاجتماعية GOSI (الأدق — موصى به)")}</div>
            <ul>
              <li>${L("Counts Saudis AND expats", "يحصر السعوديين والأجانب معاً")}</li>
              <li>${L("Salaries + professions", "الرواتب + المهن")}</li>
              <li>${L("National ID / iqama / border numbers", "أرقام الهوية والإقامة وأرقام الحدود")}</li>
            </ul>
            <div class="cc-src-how">${L("How: gosi.gov.sa → Establishment → Contributors report → Export Excel/PDF", "الطريقة: gosi.gov.sa ← حساب المنشأة ← تقرير المشتركين ← تصدير Excel أو PDF")}</div>
          </div>
          <div class="cc-src">
            <div class="cc-src-head">💼 ${L("Qiwa / Labor Office", "قوى / مكتب العمل")}</div>
            <ul>
              <li>${L("Expats and Saudis", "الأجانب والسعوديون")}</li>
              <li>${L("Establishment name & details", "اسم المنشأة وبياناتها")}</li>
            </ul>
            <div class="cc-src-how">${L("How: qiwa.sa → Employees → Export employee list (Excel)", "الطريقة: qiwa.sa ← الموظفون ← تصدير كشف الموظفين (Excel)")}</div>
          </div>
          <div class="cc-src">
            <div class="cc-src-head">🪪 ${L("Muqeem", "مقيم")}</div>
            <ul>
              <li>${L("Resident (expat) data only", "بيانات المقيمين (الوافدين) فقط")}</li>
              <li>${L("Iqama expiry dates & border numbers", "تواريخ انتهاء الإقامات وأرقام الحدود")}</li>
            </ul>
            <div class="cc-src-how">${L("How: muqeem.sa → Reports → Active residents → Export Excel/PDF", "الطريقة: muqeem.sa ← التقارير ← المقيمون النشطون ← تصدير Excel أو PDF")}</div>
          </div>
        </div>

        <div class="cc-upload-steps">
          <span>1️⃣ ${L("Export the report", "صدّر التقرير")}</span>
          <span>2️⃣ ${L("Upload it in the secure form", "ارفعه في النموذج الآمن")}</span>
          <span>3️⃣ ${L("The agent analyzes & your file is created", "الوكيل يحلل ويُنشأ ملفك")}</span>
          <span>4️⃣ ${L("We follow up on WhatsApp & email", "نتابع معك واتساب وإيميل")}</span>
        </div>

        <div class="cc-portal">
          <div class="cc-portal-head">🛡️ ${L("Compliance intake portal", "بوابة الامتثال — استقبال الملفات")}</div>
          <iframe id="cc-portal-frame" title="${Lraw("Compliance intake portal", "بوابة الامتثال")}" data-src="https://businesspartnerai.app.n8n.cloud/form/client-compliance-intake" loading="lazy" referrerpolicy="no-referrer"></iframe>
          <p class="form-note">${L("If the form doesn't load,", "إذا لم تظهر البوابة،")} <a href="https://businesspartnerai.app.n8n.cloud/form/client-compliance-intake" target="_blank" rel="noopener">${L("open it in a separate window ↗", "افتحها في نافذة مستقلة ↗")}</a> · 🔒 ${L("Files are stored in your private client folder and used only for compliance analysis. No government action is ever taken without your approval.", "تُحفظ الملفات في مجلد عميلك الخاص وتُستخدم لتحليل الامتثال فقط. لا يُنفَّذ أي إجراء حكومي دون موافقتك.")}</p>
        </div>
        <div class="cc-upload-cta" style="margin-top:14px;text-align:center">
          <a class="btn btn-ghost" href="${u("/compliance-portal")}">🛡️ ${L("Open the full compliance portal page →", "افتح صفحة بوابة امتثال المنشأة الكاملة ←")}</a>
        </div>
      </div>
    </div>
    <div class="cc-disclaimer">⚖️ ${L("All figures and ratios are estimates for illustration only. Official bands depend on your activity and size in Qiwa; official fees are confirmed via Qiwa / Muqeem / Passports. Contact us for a verified calculation.", "الأرقام والنسب المعروضة تقديرية للتوضيح فقط. النطاق الرسمي يعتمد على نشاط المنشأة وحجمها في منصة قوى، والرسوم الرسمية تُعتمد من قوى / مقيم / الجوازات. تواصل معنا لحساب دقيق ومعتمد.")}</div>
    <div class="order-box cc-cta">
      <h3>${L("Want a verified calculation and full compliance monitoring?", "تبغى حساباً معتمداً ومتابعة كاملة لامتثال منشأتك؟")}</h3>
      <div class="cc-cta-btns">
        <a class="btn btn-wa" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${L("Talk to us on WhatsApp", "تواصل معنا واتساب")}</span></a>
        <a class="btn btn-ghost" href="${u("/calculator")}">${L("Service fees calculator →", "حاسبة أتعاب الخدمات ←")}</a>
      </div>
    </div>
  </div></section>
  <style>
    .cc-tabs{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap}
    .cc-tab{flex:1;min-width:200px;padding:14px 18px;border-radius:var(--radius);border:2px solid var(--gray-line);background:var(--gray-bg);font-family:inherit;font-size:1.02rem;font-weight:700;color:var(--text-soft);cursor:pointer;transition:all .18s ease}
    .cc-tab.active{border-color:var(--navy);color:var(--navy);background:var(--white);box-shadow:var(--shadow-sm)}
    .cc-panel{display:none}.cc-panel.active{display:block}
    .cc-sub{color:var(--text-soft);margin-bottom:18px;font-size:.95rem}
    .cc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
    .cc-result{margin-top:22px}
    .cc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
    .cc-tile{background:var(--gray-bg);border:1px solid var(--gray-line);border-radius:var(--radius);padding:14px;text-align:center}
    .cc-tile span{display:block;font-size:.8rem;color:var(--text-soft);margin-bottom:5px}
    .cc-tile strong{font-size:1.25rem;color:var(--navy)}
    .cc-advice{border-radius:var(--radius);padding:13px 16px;font-weight:700}
    .cc-advice.ok{background:#f2fbf5;border:1px solid #bfe8cd;color:#14663a}
    .cc-advice.danger{background:#fdf1f1;border:1px solid #f2c4c4;color:#a02020}
    .cc-row{display:grid;grid-template-columns:2fr 1.6fr .8fr 1.6fr auto;gap:10px;align-items:end;padding:12px;border:1px dashed var(--gray-line);border-radius:var(--radius);margin-bottom:10px;background:var(--white)}
    .cc-row .field{margin-bottom:0}
    .cc-remove{border:0;background:#fdf1f1;color:#a02020;border-radius:10px;width:34px;height:44px;cursor:pointer;font-size:.9rem}
    .cc-btn-sm{padding:8px 16px;font-size:.9rem;margin-bottom:8px}
    .cc-rates{border:1px solid var(--gray-line);border-radius:var(--radius);padding:12px 16px;background:var(--gray-bg);margin:14px 0 18px}
    .cc-rates summary{cursor:pointer;font-weight:700;color:var(--navy)}
    .cc-rates .cc-grid{margin-top:14px}
    .cc-table-wrap{overflow-x:auto;border:1px solid var(--gray-line);border-radius:var(--radius)}
    .cc-table{width:100%;border-collapse:collapse;font-size:.9rem;background:var(--white)}
    .cc-table th{background:var(--navy);color:var(--white);padding:10px 9px;text-align:start;font-weight:600}
    .cc-table td{padding:10px 9px;border-bottom:1px solid var(--gray-line)}
    .cc-fine{color:#a02020;font-size:.75rem;font-weight:700}
    .cc-disclaimer{margin-top:20px;background:#fffbeb;border:1px solid #fde68a;color:#8a6d3b;border-radius:var(--radius);padding:14px 18px;font-size:.9rem;line-height:1.8}
    .cc-cta{margin-top:20px;text-align:center}
    .cc-cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:14px}
    @media(max-width:720px){.cc-row{grid-template-columns:1fr 1fr}.cc-remove{height:40px}}
    .cc-prof-chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 16px}
    .cc-chip{border:1px solid var(--gray-line);background:var(--gray-bg);border-radius:999px;padding:5px 13px;font-size:.82rem;font-weight:600;color:var(--text-soft);cursor:pointer;font-family:inherit}
    .cc-chip:hover{border-color:var(--navy);color:var(--navy)}
    .cc-dec{border:1px solid var(--gray-line);border-radius:var(--radius);padding:16px 18px;margin-bottom:12px;background:var(--white)}
    .cc-dec-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
    .cc-dec-head strong{color:var(--navy);font-size:1.02rem}
    .cc-badge{display:inline-block;padding:3px 11px;border-radius:999px;font-size:.78rem;font-weight:700;white-space:nowrap}
    .cc-badge.saudi{background:#fdf1f1;color:#a02020}
    .cc-badge.ratio{background:#fff7e8;color:#9a6a08}
    .cc-badge.sector{background:#eef2ff;color:#3742a0}
    .cc-dec-profs{font-size:.88rem;color:var(--text);line-height:1.8;margin-bottom:8px}
    .cc-dec-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:.8rem;color:var(--text-soft)}
    .cc-dec-meta b{color:var(--navy)}
    .cc-dec-note{margin-top:8px;font-size:.8rem;color:#9a6a08;background:#fffbeb;border-radius:8px;padding:6px 10px}
    .cc-prof-empty{color:var(--text-soft);font-size:.9rem;padding:10px 0}
    mark.cc-hit{background:#ffe9a8;color:inherit;border-radius:3px;padding:0 2px}
    .cc-act-field{position:relative;margin-bottom:10px}
    .cc-act-drop{position:absolute;top:100%;inset-inline:0;z-index:30;background:var(--white);border:1px solid var(--gray-line);border-radius:var(--radius);box-shadow:var(--shadow-sm);max-height:330px;overflow:auto}
    .cc-act-item{display:block;width:100%;text-align:start;background:none;border:0;border-bottom:1px solid var(--gray-line);padding:9px 13px;font-family:inherit;font-size:.88rem;line-height:1.6;cursor:pointer;color:var(--text)}
    .cc-act-item:last-child{border-bottom:0}
    .cc-act-item:hover{background:var(--gray-bg)}
    .cc-act-item b{color:var(--navy);font-variant-numeric:tabular-nums;margin-inline-end:8px}
    .cc-act-item .cc-act-sec{display:block;font-size:.72rem;color:var(--text-soft)}
    .cc-act-count{padding:7px 13px;font-size:.75rem;color:var(--text-soft);background:var(--gray-bg);position:sticky;top:0}
    .cc-act-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;scrollbar-width:thin}
    .cc-act-chips .cc-chip{white-space:nowrap;flex:0 0 auto}
    .cc-act-chips .cc-chip.on{border-color:var(--navy);color:var(--white);background:var(--navy)}
    .cc-act-info{border:1px solid var(--navy);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;background:#f5f7ff}
    .cc-act-info h4{color:var(--navy);margin:0 0 7px;font-size:1rem}
    .cc-act-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem;color:var(--text-soft)}
    .cc-act-meta b{color:var(--navy)}
    .cc-act-dec{margin-top:10px;padding-top:10px;border-top:1px dashed var(--gray-line);font-size:.85rem}
    .cc-act-dec-title{font-weight:700;color:var(--navy);margin-bottom:6px}
    .cc-act-dec-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px}
    .cc-act-clear{float:inline-end;border:0;background:none;color:var(--text-soft);cursor:pointer;font-size:.8rem;font-family:inherit;text-decoration:underline}
    .cc-src-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:6px 0 18px}
    .cc-src{border:1px solid var(--gray-line);border-radius:var(--radius);padding:16px;background:var(--white)}
    .cc-src-best{border-color:var(--navy);box-shadow:var(--shadow-sm)}
    .cc-src-head{font-weight:700;color:var(--navy);margin-bottom:10px}
    .cc-src ul{margin:0 0 10px;padding-inline-start:18px;font-size:.88rem;line-height:1.9}
    .cc-src-how{font-size:.78rem;color:var(--text-soft);background:var(--gray-bg);border-radius:8px;padding:7px 10px}
    .cc-upload-steps{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
    .cc-upload-steps span{background:var(--gray-bg);border:1px solid var(--gray-line);border-radius:999px;padding:6px 14px;font-size:.83rem;font-weight:600;color:var(--navy)}
    .cc-upload-cta{text-align:center}
    .cc-portal{border:1px solid var(--gray-line);border-radius:var(--radius-lg);overflow:hidden;background:var(--white)}
    .cc-portal-head{background:var(--navy);color:var(--white);padding:12px 18px;font-weight:700;font-size:.95rem}
    #cc-portal-frame{width:100%;height:960px;border:0;display:block;background:var(--gray-bg)}
    .cc-portal .form-note{padding:10px 16px}
    .cc-thresholds{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
    .cc-th-title{width:100%;font-size:.82rem;color:var(--text-soft);font-weight:600}
    .cc-th{border:1px solid var(--gray-line);border-radius:10px;padding:8px 14px;font-size:.82rem;background:var(--gray-bg);color:var(--text-soft)}
    .cc-th.on{border-color:#1d8a4e;background:#f2fbf5;color:#14663a}
    .cc-th b{display:block;font-size:.95rem}
    #cc-act{width:100%;font-family:inherit;font-size:1rem;padding:12px;border:1px solid var(--gray-line);border-radius:10px;background:var(--white)}
    .cc-agent{display:flex;gap:22px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--navy);color:var(--white);border-radius:var(--radius-lg);padding:24px 26px;margin-bottom:24px}
    .cc-agent-main{flex:1;min-width:280px}
    .cc-agent-title{display:flex;align-items:center;gap:12px;margin-bottom:10px}
    .cc-agent-title svg{width:34px;height:34px;flex-shrink:0}
    .cc-agent-title strong{font-size:1.15rem;display:block}
    .cc-agent-live{font-size:.72rem;font-weight:700;color:#7ef2a7;letter-spacing:1px}
    .cc-agent p{font-size:.92rem;line-height:1.9;opacity:.92;margin-bottom:12px}
    .cc-agent-feats{display:flex;flex-wrap:wrap;gap:8px}
    .cc-agent-feats span{background:rgba(255,255,255,.12);border-radius:999px;padding:5px 13px;font-size:.8rem;font-weight:600}
    .cc-agent-cta{display:flex;flex-direction:column;gap:10px;min-width:230px}
    .cc-agent-cta .btn-primary{background:var(--white);color:var(--navy)}
    .cc-agent-cta .btn-ghost{border-color:rgba(255,255,255,.5);color:var(--white)}
    .cc-agent-cta .btn-ghost:hover{background:var(--white);color:var(--navy)}
  </style>
  <script>window.BP_CC_LANG=${JSON.stringify(LANG)};window.BP_ACT_URL=${JSON.stringify("/assets/data/activities.json?v=" + ACT_V)};</script>
  <script>
  (function(){
    var isAr = window.BP_CC_LANG === "ar";
    var T = isAr ? {
      bands:{red:"أحمر",low:"أخضر منخفض",mid:"أخضر متوسط",high:"أخضر مرتفع",platinum:"بلاتيني",exempt:"معفاة (1–5 موظفين)"},
      sizes:{micro:"متناهية الصغر (1–5)",small:"صغيرة (6–49)",medium:"متوسطة (50–499)",large:"كبيرة (500–2999)",huge:"عملاقة (3000+)"},
      ok:"منشأتك ضمن النطاق الآمن ✅",need:"تحتاج توظيف {n} سعودي للخروج من النطاق الأحمر",next:"توظيف {n} سعودي إضافي يرفعك إلى: {b}",top:"أنت في أعلى نطاق — حافظ عليه 👏",
      microOk:"منشأة صغيرة جداً (1–5): معاملة مبسّطة — أخضر بوجود سعودي واحد على الأقل ✅",microNeed:"منشأة صغيرة جداً (1–5): وظّف سعودياً واحداً على الأقل للخروج من الأحمر",thTitle:"الحدود الدنيا الرسمية لنشاط «{act}» بحجم كيانك:",
      prof:"المهنة",profPh:"مثال: عامل، فني، مهندس…",status:"الحالة",sExisting:"قائم (على رأس العمل)",sNew:"جديد (أول دخول)",count:"العدد",late:"تأخير تجديد الإقامة",lNone:"لا يوجد",lFirst:"المرة الأولى (+500)",lSecond:"المرة الثانية (+1,000)",remove:"حذف",sar:"﷼"
    } : {
      bands:{red:"Red",low:"Low Green",mid:"Mid Green",high:"High Green",platinum:"Platinum",exempt:"Exempt (1–5 employees)"},
      sizes:{micro:"Micro (1–5)",small:"Small (6–49)",medium:"Medium (50–499)",large:"Large (500–2999)",huge:"Giant (3000+)"},
      ok:"Your establishment is in the safe zone ✅",need:"You need {n} more Saudi hire(s) to exit the red band",next:"Hiring {n} more Saudi(s) moves you up to: {b}",top:"You are in the top band — keep it up 👏",
      microOk:"Micro establishment (1–5): simplified treatment — green with at least one Saudi ✅",microNeed:"Micro establishment (1–5): hire at least one Saudi to exit red",thTitle:"Official band floors for '{act}' at your entity size:",
      prof:"Profession",profPh:"e.g. laborer, technician…",status:"Status",sExisting:"Existing (on the job)",sNew:"New (first entry)",count:"Count",late:"Iqama renewal delay",lNone:"None",lFirst:"First time (+500)",lSecond:"Second time (+1,000)",remove:"Remove",sar:"SAR"
    };
    var fmt=function(n){return Math.round(n).toLocaleString(isAr?"ar-SA":"en-US");};
    var $=function(id){return document.getElementById(id);};
    document.querySelectorAll(".cc-tab").forEach(function(tab){tab.addEventListener("click",function(){
      document.querySelectorAll(".cc-tab").forEach(function(x){x.classList.remove("active");});
      document.querySelectorAll(".cc-panel").forEach(function(x){x.classList.remove("active");});
      tab.classList.add("active");$("cc-panel-"+tab.dataset.tab).classList.add("active");});});
    var NIT_DATA=[{"name":"الإنتاج الزراعي والحيواني وخدماتها وأندية الفروسية","m":[0.19,0.58,0.58,0.58],"y2026":[4.38,5.13,9.38,14.38],"y2027":[4.38,5.13,9.38,14.38],"y2028":[4.38,5.13,9.38,14.38],"en":"Agricultural & livestock production, services and equestrian clubs"},{"name":"أنشطة الهيدروكربونات وعملياتها","m":[4.98,6.0,6.0,6.0],"y2026":[5.62,20.0,22.0,24.0],"y2027":[7.62,22.0,24.0,26.0],"y2028":[9.62,24.0,26.0,28.0],"en":"Hydrocarbon activities and operations"},{"name":"تعدين المعادن الفلزية والأحجار الكريمة","m":[1.68,1.87,2.08,6.0],"y2026":[16.0,19.0,28.0,23.0],"y2027":[16.0,19.0,28.0,23.0],"y2028":[16.0,19.0,28.0,23.0],"en":"Metallic minerals & gemstones mining"},{"name":"تعدين المعادن غير الفلزية والصناعية","m":[1.68,1.87,2.08,6.0],"y2026":[18.0,19.0,21.0,25.0],"y2027":[20.0,21.0,23.0,27.0],"y2028":[22.0,23.0,25.0,29.0],"en":"Non-metallic & industrial minerals mining"},{"name":"تعدين مواد البناء","m":[0.0,0.0,0.0,6.0],"y2026":[7.0,10.0,13.0,23.0],"y2027":[7.0,10.0,13.0,23.0],"y2028":[7.0,10.0,13.0,23.0],"en":"Construction-materials mining"},{"name":"الطاقة والمياه وخدماتها","m":[1.35,2.6,3.0,3.0],"y2026":[8.36,9.32,17.18,32.93],"y2027":[10.36,11.32,19.18,34.93],"y2028":[12.36,13.32,21.18,36.93],"en":"Energy, water and related services"},{"name":"الصناعات","m":[1.68,1.87,2.08,2.08],"y2026":[15.08,21.87,23.97,29.87],"y2027":[18.08,24.87,26.97,32.87],"y2028":[21.08,27.87,29.97,35.87],"en":"Manufacturing industries"},{"name":"مقاولات التشييد والبناء","m":[-0.37,-0.37,0.0,0.0],"y2026":[14.17,16.17,17.5,22.5],"y2027":[16.17,18.17,19.5,24.5],"y2028":[18.17,20.17,21.5,26.5],"en":"Construction & building contracting"},{"name":"التشغيل والصيانة","m":[0.14,0.14,0.48,0.76],"y2026":[17.12,21.12,24.96,29.09],"y2027":[18.12,22.12,25.96,30.09],"y2028":[19.12,23.12,26.96,31.09],"en":"Operation & maintenance"},{"name":"مقاولات النظافة والمغاسل","m":[-0.37,-0.37,0.0,0.0],"y2026":[12.17,14.17,17.0,22.0],"y2027":[12.17,14.17,17.0,22.0],"y2028":[12.17,14.17,17.0,22.0],"en":"Cleaning contracting & laundries"},{"name":"البيع بالجملة والتجزئة العامة","m":[2.47,2.47,2.67,2.84],"y2026":[23.25,27.72,30.41,38.91],"y2027":[26.25,30.72,33.41,41.91],"y2028":[29.25,33.72,36.41,44.91],"en":"General wholesale & retail trade"},{"name":"البيع بالتجزئة للعطور والساعات","m":[2.47,2.47,2.67,2.84],"y2026":[25.25,29.72,33.91,41.91],"y2027":[30.25,34.72,38.91,46.91],"y2028":[35.25,39.72,43.91,51.91],"en":"Retail of perfumes & watches"},{"name":"البيع بالتجزئة للأزياء والكماليات والسلع المتنوعة","m":[2.47,2.47,2.67,2.84],"y2026":[24.25,28.72,32.91,40.91],"y2027":[28.25,32.72,36.91,44.91],"y2028":[32.25,36.72,40.91,48.91],"en":"Retail of fashion, accessories & misc. goods"},{"name":"السلع النسائية وبيع الهواتف المحمولة وصيانتها","m":[0.0,0.0,0.0,0.27],"y2026":[82.0,85.0,89.0,93.42],"y2027":[82.0,85.0,89.0,93.42],"y2028":[82.0,85.0,89.0,93.42],"en":"Women's goods, mobile-phone sales & maintenance"},{"name":"حلول الاتصالات","m":[2.19,2.52,2.91,3.22],"y2026":[27.76,36.76,42.02,48.15],"y2027":[29.76,38.76,44.02,50.15],"y2028":[31.76,40.76,46.02,52.15],"en":"Telecom solutions"},{"name":"أنشطة البريد","m":[0.81,0.81,1.01,1.01],"y2026":[17.1,22.1,32.5,42.5],"y2027":[17.1,22.1,32.5,42.5],"y2028":[17.1,22.1,32.5,42.5],"en":"Postal activities"},{"name":"البنية التحتية لتقنية المعلومات","m":[3.61,3.61,3.61,3.61],"y2026":[17.77,24.64,40.0,50.0],"y2027":[19.77,26.64,42.0,52.0],"y2028":[21.77,28.64,44.0,54.0],"en":"IT infrastructure"},{"name":"البنية التحتية للاتصالات","m":[0.0,0.0,0.0,0.0],"y2026":[17.0,21.0,23.5,28.5],"y2027":[19.0,23.0,25.5,30.5],"y2028":[21.0,25.0,27.5,32.5],"en":"Telecom infrastructure"},{"name":"التشغيل والصيانة للاتصالات","m":[0.0,0.39,0.39,0.39],"y2026":[17.0,20.98,23.83,29.0],"y2027":[19.0,22.98,25.83,31.0],"y2028":[21.0,24.98,27.83,33.0],"en":"Telecom operation & maintenance"},{"name":"التشغيل والصيانة لتقنية المعلومات","m":[4.85,4.85,4.85,4.85],"y2026":[15.96,24.42,27.42,33.36],"y2027":[17.96,26.42,29.42,35.36],"y2028":[19.96,28.42,31.42,37.36],"en":"IT operation & maintenance"},{"name":"حلول تقنية المعلومات","m":[2.19,2.34,2.91,3.22],"y2026":[26.76,32.54,40.02,48.15],"y2027":[28.76,34.54,42.02,50.15],"y2028":[30.76,36.54,44.02,52.15],"en":"IT solutions"},{"name":"النقل البري والتخزين","m":[1.15,1.15,1.5,1.71],"y2026":[12.09,16.2,17.82,27.74],"y2027":[13.09,17.2,18.82,28.74],"y2028":[14.09,18.2,19.82,29.74],"en":"Land transport & warehousing"},{"name":"النقل البحري والجوي","m":[1.45,1.45,1.86,2.67],"y2026":[26.57,39.98,48.38,56.29],"y2027":[28.57,41.98,50.38,58.29],"y2028":[30.57,43.98,52.38,60.29],"en":"Maritime & air transport"},{"name":"مطاعم مع الخدمة (لا تشمل الوجبات السريعة)","m":[1.58,1.67,1.67,1.67],"y2026":[13.47,16.98,20.26,26.71],"y2027":[14.47,17.98,21.26,27.71],"y2028":[15.47,18.98,22.26,28.71],"en":"Full-service restaurants (excl. fast food)"},{"name":"مطاعم خدمة سريعة ومحلات الآيسكريم","m":[1.58,1.67,1.67,1.67],"y2026":[15.08,20.04,23.27,29.26],"y2027":[16.08,21.04,24.27,30.26],"y2028":[17.08,22.04,25.27,31.26],"en":"Fast-food restaurants & ice-cream shops"},{"name":"المقاهي ومحلات تقديم المشروبات","m":[1.58,1.67,1.67,1.67],"y2026":[16.98,20.49,31.42,35.52],"y2027":[17.98,21.49,32.42,36.52],"y2028":[18.98,22.49,33.42,37.52],"en":"Cafés & beverage outlets"},{"name":"التموين والإعاشة","m":[1.58,1.67,1.67,1.67],"y2026":[14.46,17.97,21.25,27.93],"y2027":[15.46,18.97,22.25,28.93],"y2028":[16.46,19.97,23.25,29.93],"en":"Catering & provisioning"},{"name":"حراسات أمنية ومكاتب التوظيف الأهلية","m":[0.34,0.34,0.34,0.34],"y2026":[74.5,77.5,80.5,84.5],"y2027":[74.5,77.5,80.5,84.5],"y2028":[74.5,77.5,80.5,84.5],"en":"Private security & private employment offices"},{"name":"المؤسسات المالية","m":[2.6,2.6,2.6,2.6],"y2026":[50.0,57.0,62.0,65.0],"y2027":[50.0,57.0,62.0,65.0],"y2028":[50.0,57.0,62.0,65.0],"en":"Financial institutions"},{"name":"خدمات الأعمال","m":[1.03,1.03,2.19,2.19],"y2026":[33.78,42.62,43.62,54.82],"y2027":[36.78,45.62,46.62,57.82],"y2028":[39.78,48.62,49.62,60.82],"en":"Business services"},{"name":"الخدمات الاجتماعية","m":[1.83,2.38,3.5,3.5],"y2026":[14.82,26.9,32.74,56.52],"y2027":[16.82,28.9,34.74,58.52],"y2028":[18.82,30.9,36.74,60.52],"en":"Social services"},{"name":"الخدمات الشخصية","m":[1.46,1.92,4.4,5.0],"y2026":[14.07,20.36,24.63,26.13],"y2027":[14.07,20.36,24.63,26.13],"y2028":[14.07,20.36,24.63,26.13],"en":"Personal services"},{"name":"التعليم العالي","m":[0.0,0.0,0.43,0.43],"y2026":[34.0,48.0,75.37,82.0],"y2027":[34.0,48.0,75.37,82.0],"y2028":[34.0,48.0,75.37,82.0],"en":"Higher education"},{"name":"التعليم العالي للتخصصات الصحية","m":[0.0,0.0,0.0,0.0],"y2026":[25.0,30.0,35.0,37.0],"y2027":[25.0,30.0,35.0,37.0],"y2028":[25.0,30.0,35.0,37.0],"en":"Higher education — health specialties"},{"name":"مدارس البنات ورياض الأطفال والحضانات","m":[0.0,0.0,0.0,0.0],"y2026":[51.0,66.0,89.56,95.0],"y2027":[51.0,66.0,89.56,95.0],"y2028":[51.0,66.0,89.56,95.0],"en":"Girls' schools, kindergartens & nurseries"},{"name":"المدارس الأجنبية","m":[2.3,2.3,2.3,2.3],"y2026":[4.95,14.19,19.99,28.77],"y2027":[4.95,14.19,19.99,28.77],"y2028":[4.95,14.19,19.99,28.77],"en":"Foreign schools"},{"name":"المختبرات والخدمات الصحية","m":[0.35,0.35,0.35,0.35],"y2026":[25.74,30.74,34.24,34.74],"y2027":[27.74,32.74,36.24,36.74],"y2028":[29.74,34.74,38.24,38.74],"en":"Laboratories & health services"},{"name":"الإيواء والترفيه والسياحة","m":[2.42,2.42,2.59,2.59],"y2026":[24.6,31.02,36.4,42.52],"y2027":[26.6,33.02,38.4,44.52],"y2028":[28.6,35.02,40.4,46.52],"en":"Accommodation, entertainment & tourism"},{"name":"السلع الأساسية والمحروقات","m":[0.17,0.56,0.56,1.19],"y2026":[9.86,12.22,22.59,26.09],"y2027":[10.86,13.22,23.59,27.09],"y2028":[11.86,14.22,24.59,28.09],"en":"Basic commodities & fuels"},{"name":"مدارس البنين ومجمعات البنين والبنات","m":[1.31,1.31,1.31,1.31],"y2026":[29.3,39.15,50.27,61.0],"y2027":[29.3,39.15,50.27,61.0],"y2028":[29.3,39.15,50.27,61.0],"en":"Boys' schools & mixed school complexes"},{"name":"الكيانات المجمعة","m":[2.23,2.23,2.23,2.23],"y2026":[10.99,22.4,33.81,44.0],"y2027":[10.99,22.4,33.81,44.0],"y2028":[10.99,22.4,33.81,44.0],"en":"Consolidated entities"}];
    var actSel=$("cc-act");
    NIT_DATA.forEach(function(a,i){var o=document.createElement("option");o.value=i;o.textContent=isAr?a.name:a.en;actSel.appendChild(o);});
    actSel.value=10;
    var clampPct=function(v){return Math.min(100,Math.max(0,v));};
    var floors=function(act,yearKey,total){var c=act[yearKey];return act.m.map(function(m,i){return clampPct(m*Math.log(total)+c[i]);});};
    var bandIdx=function(n,f){if(n<f[0])return -1;if(n<f[1])return 0;if(n<f[2])return 1;if(n<f[3])return 2;return 3;};
    var needFor=function(act,yearKey,total,saudis,idx){for(var k=1;k<=5000;k++){var t2=total+k,s2=saudis+k;var f=floors(act,yearKey,t2);if(s2/t2*100>=f[idx])return k;}return null;};
    var BAND_LABELS=function(){return [T.bands.low,T.bands.mid,T.bands.high,T.bands.platinum];};
    $("cc-nit-calc").addEventListener("click",function(){
      var act=NIT_DATA[Number(actSel.value)||0];
      var yearKey=$("cc-year").value;
      var total=Math.max(1,Number($("cc-total").value)||1);
      var saudis=Math.min(total,Math.max(0,Number($("cc-saudis").value)||0));
      var pct=saudis/total*100,pctR=Math.round(pct*100)/100;
      var f=floors(act,yearKey,total);
      var fR=f.map(function(x){return Math.round(x*100)/100;});
      var labels=BAND_LABELS();
      var band,color,idx;
      if(total<=5){idx=saudis>=1?0:-1;band=saudis>=1?T.microOk:T.bands.red;color=saudis>=1?"#1d8a4e":"#a02020";}
      else{idx=bandIdx(pct,f);
        if(idx===-1){band=T.bands.red;color="#a02020";}
        else if(idx===0){band=T.bands.low;color="#1d8a4e";}
        else if(idx===1){band=T.bands.mid;color="#14663a";}
        else if(idx===2){band=T.bands.high;color="#14663a";}
        else{band=T.bands.platinum;color="#b45309";}}
      $("cc-pct").textContent=pctR+"%";
      var b=$("cc-band");b.textContent=band;b.style.color=color;
      $("cc-floor").textContent=total<=5?"—":(fR[0]+"%");
      var th=$("cc-thresholds");
      if(total<=5){th.innerHTML="";}
      else{th.innerHTML='<div class="cc-th-title">'+T.thTitle.replace("{act}",isAr?act.name:act.en)+'</div>'+f.map(function(x,i){var on=idx>=i;return '<div class="cc-th'+(on?" on":"")+'"><span>'+labels[i]+'</span><b>≥ '+fR[i]+'%</b></div>';}).join("");}
      var adv=$("cc-advice");
      if(total<=5){adv.textContent=saudis>=1?T.microOk:T.microNeed;adv.className="cc-advice "+(saudis>=1?"ok":"danger");}
      else if(idx===-1){var k=needFor(act,yearKey,total,saudis,0);adv.textContent=T.need.replace("{n}",k==null?"—":k);adv.className="cc-advice danger";}
      else if(idx>=3){adv.textContent=T.ok+" — "+T.top;adv.className="cc-advice ok";}
      else{var k2=needFor(act,yearKey,total,saudis,idx+1);adv.textContent=T.ok+" — "+T.next.replace("{n}",k2==null?"—":k2).replace("{b}",labels[idx+1]);adv.className="cc-advice ok";}
      $("cc-nit-result").hidden=false;});
    var FINES={none:0,first:500,second:1000};
    function addRow(count){
      var d=document.createElement("div");d.className="cc-row";
      d.innerHTML='<div class="field"><label>'+T.prof+'</label><input type="text" class="cc-prof" placeholder="'+T.profPh+'"></div>'+
        '<div class="field"><label>'+T.status+'</label><select class="cc-status"><option value="existing">'+T.sExisting+'</option><option value="new">'+T.sNew+'</option></select></div>'+
        '<div class="field"><label>'+T.count+'</label><input type="number" class="cc-count" min="1" value="'+(count||1)+'"></div>'+
        '<div class="field"><label>'+T.late+'</label><select class="cc-late"><option value="none">'+T.lNone+'</option><option value="first">'+T.lFirst+'</option><option value="second">'+T.lSecond+'</option></select></div>'+
        '<button type="button" class="cc-remove" title="'+T.remove+'">✕</button>';
      d.querySelector(".cc-remove").addEventListener("click",function(){if(document.querySelectorAll(".cc-row").length>1)d.remove();});
      $("cc-rows").appendChild(d);}
    addRow(5);
    $("cc-add").addEventListener("click",function(){addRow();});
    $("cc-fees-calc").addEventListener("click",function(){
      var pA=Number($("cc-rate-permit").value)||0,iA=Number($("cc-rate-iqama").value)||0,mA=Number($("cc-rate-medical").value)||0,ex=Number($("cc-rate-exam").value)||0;
      var pQ=pA/4,iQ=iA/4,mQ=mA/4,workers=0,tQ=0,tA=0,tb=$("cc-tbody");tb.innerHTML="";
      document.querySelectorAll(".cc-row").forEach(function(row){
        var prof=row.querySelector(".cc-prof").value||"—";
        var isNew=row.querySelector(".cc-status").value==="new";
        var count=Math.max(1,Number(row.querySelector(".cc-count").value)||1);
        var fine=FINES[row.querySelector(".cc-late").value]||0;
        var qPer=pQ+iQ+mQ+fine,aPer=pA+iA+mA+(isNew?ex:0);
        workers+=count;tQ+=qPer*count;tA+=aPer*count;
        var tr=document.createElement("tr");
        tr.innerHTML="<td>"+prof.replace(/</g,"&lt;")+(fine?' <span class="cc-fine">+'+fmt(fine)+"</span>":"")+"</td><td>"+(isNew?T.sNew:T.sExisting)+"</td><td>"+count+"</td><td>"+fmt(qPer)+"</td><td>"+fmt(aPer)+"</td>";
        tb.appendChild(tr);});
      $("cc-workers").textContent=workers;
      $("cc-quarter").textContent=fmt(tQ)+" "+T.sar;
      $("cc-annual").textContent=fmt(tA)+" "+T.sar;
      $("cc-fees-result").hidden=false;});
    var PROF=[{"g":"مهن الطيران المرخصة","en":"Aviation","type":"قطاعي","pct":70,"prof":"مراقب جوي (100%)، ملاح جوي (100%)، منسق حركة أرضية (100%)، مساعد طيار (100%)، طيار جناح ثابت (70%)، مضيف طيران (60%)","minw":5,"body":"الهيئة العامة للطيران المدني (GACA)","dec":"#208818","note":"النسب تختلف حسب المهنة (60-100%)"},{"g":"إدارة المشاريع","en":"Project Management","type":"نسبة توطين","pct":40,"prof":"مدير إدارة مشاريع، أخصائي إدارة مشاريع، مهندس إدارة مشاريع، مدير اتصالات، مدير هندسة اتصالات","minw":3,"sal":6000,"dec":"#141749","note":"المرحلة الثانية 40%"},{"g":"مهن التسويق","en":"Marketing","type":"نسبة توطين","pct":60,"prof":"مدير تسويق، وكيل دعاية وإعلان، مدير دعاية وإعلان، مصمم جرافيك، مصور فوتوغرافي، أخصائي علاقات عامة، أخصائي دعاية وإعلان، أخصائي تسويق، مدير علاقات عامة، مصمم إعلان","minw":3,"sal":5500,"dec":"#101319"},{"g":"المادة 11 — مهن مقصورة على السعوديين","en":"Article 11 — Saudi-Only","type":"مقصورة على السعوديين","pct":100,"prof":"إداري موارد بشرية، مشرف موارد بشرية، مسؤول شؤون عمال، اختصاصي شؤون أفراد، كاتب شؤون أفراد، كاتب توظيف، كاتب شؤون موظفين، كاتب دوام، كاتب استقبال عام، استقبال فندقي، استقبال مرضى، كاتب شكاوى، أمين صندوق، حارس أمن خاص، معقب، ناسخ/مصلّح مفاتيح، مخلّص جمركي","minw":1,"dec":"اللائحة التنفيذية لنظام العمل","note":"لا يُسمح لغير السعوديين بالعمل فيها بموجب المادة 11"},{"g":"البصريات","en":"Optics","type":"قطاعي","pct":50,"prof":"فني بصريات طبية، فني نظارات","minw":4,"sal":5500,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#208837"},{"g":"الأجهزة الطبية","en":"Medical Devices","type":"قطاعي","pct":80,"prof":"أخصائي مبيعات مستلزمات طبية، مبيعات منتجات صيدلانية، فني أجهزة طبية، مُجمع أجهزة طبية، مهندس أجهزة طبية","minw":1,"sal":7000,"dec":"#48081","note":"المرحلة 2: 80% مبيعات، 50% هندسي/فني"},{"g":"مهن خدمة العملاء عن بعد","en":"Remote Customer Service","type":"مقصورة على السعوديين","pct":100,"prof":"جميع مهن خدمة العملاء عن بعد (هاتف، إيميل، شات، سوشال ميديا)","minw":1,"dec":"#112203"},{"g":"مهن المبيعات","en":"Sales","type":"نسبة توطين","pct":60,"prof":"مدير مبيعات، مدير مبيعات تجزئة، مدير مبيعات جملة، مندوب مبيعات، وسيط سلع مستقبلية، أخصائي مبيعات أجهزة تقنية المعلومات والاتصالات، أخصائي مبيعات، أخصائي تجاري، وسيط سلع","minw":3,"dec":"#101278"},{"g":"المختبرات الطبية","en":"Medical Labs","type":"قطاعي","pct":70,"prof":"مدير مختبر تحاليل طبية، أخصائي مختبرات طبية/سريرية، فني مختبر طبي، فني مختبرات","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51267"},{"g":"مهن المشتريات","en":"Procurement","type":"نسبة توطين","pct":70,"prof":"مدير مشتريات، أخصائي مناقصات، مندوب مشتريات، أخصائي مشتريات، مدير عقود، مدير خدمات لوجستية، مدير مستودع، أمين مستودع فني، أخصائي مستودعات، أخصائي تجارة إلكترونية، أخصائي أبحاث أسواق","minw":3,"dec":"#77050"},{"g":"طب الأسنان","en":"Dentistry","type":"قطاعي","pct":55,"prof":"طبيب أسنان عام، جراح فم ووجه وفكين، تقويم أسنان، أسنان أطفال، معالجة لبية، تخدير أسنان","minw":3,"sal":9000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#103107","note":"المرحلة الحالية 55% (من 27/01/2026م)"},{"g":"العلاج الطبيعي","en":"Physical Therapy","type":"قطاعي","pct":80,"prof":"أخصائي علاج طبيعي، فني علاج طبيعي","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51270","note":"7,000 للأخصائي / 5,000 للفني"},{"g":"الأنشطة والمهن العقارية","en":"Real Estate","type":"مقصورة على السعوديين","pct":100,"prof":"وسيط عقاري، وسيط بيع وتأجير عقارات، سمسار أراضي وعقارات، كاتب تسجيل أراضي وعقارات، مسّوق عقاري، مدير اتحاد ملاك، مهندس مستدام معتمد، مهندس مقيم معتمد، مهندس فاحص جودة، فاحص مباني جاهزة","minw":1,"dec":"#212535","note":"100% للمهن المحددة، 70% للنشاط العقاري العام"},{"g":"التخليص الجمركي","en":"Customs Clearance","type":"مقصورة على السعوديين","pct":100,"prof":"مخلص جمركي، مبند جمركي، مترجم، مدير عام، كاتب عام","minw":1,"sal":5000,"dec":"#212497","note":"100% للمهن المحددة، 70% للنشاط"},{"g":"الأشعة","en":"Radiology","type":"قطاعي","pct":65,"prof":"فني أشعة، أخصائي تقنية إشعاعية، فني أشعة علاجية، أخصائي وقاية إشعاعية، فني تصوير/قسطرة/تخطيط قلب","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51273"},{"g":"مشرف مسكن","en":"Housing Supervisor","type":"مقصورة على السعوديين","pct":100,"prof":"مشرف مسكن","minw":1,"dec":"#62298","note":"خاص بسكن العمال"},{"g":"المهن الإدارية المساندة","en":"Admin Support","type":"مقصورة على السعوديين","pct":100,"prof":"مترجم، سكرتير تنفيذي/سكرتير، مدخل بيانات، مخلص جمركي، استقبال فندق، أمين مخزن، كاتب موارد بشرية، حارس أمن، أمين صندوق + (م2) كل مهن الموارد البشرية (مدير/أخصائي توظيف/تعويضات/مواهب/تطوير)، العلاقات العامة، وكلاء الشحن/الجمارك","minw":1,"dec":"#132249","note":"م1 (19 مهنة) فورية من 05/04/2026؛ م2 (50 مهنة) مهلة حتى 04/10/2026"},{"g":"المهن القانونية","en":"Legal","type":"نسبة توطين","pct":70,"prof":"مدير شؤون قانونية، أخصائي قانوني، أخصائي عقود، سكرتير قانوني","minw":1,"sal":5500,"dec":"#212607"},{"g":"المهن المحاسبية","en":"Accounting","type":"قطاعي","pct":40,"prof":"مدير مالي، مدير حسابات/مراجعة، محاسب، محاسب تكاليف، مراقب مالي، مراجع داخلي، محاسب قانوني، كاتب حسابات، مساعد حسابات، مسؤول ضرائب","minw":3,"sal":6000,"body":"الهيئة السعودية للمراجعين والمحاسبين (SOCPA)","dec":"#103108","note":"تصاعدي 40→50→60→70% خلال 5 سنوات؛ متناهية الصغر (3-4 عمال) 30%"},{"g":"مدارس تعليم قيادة المركبات","en":"Driving Schools","type":"مقصورة على السعوديين","pct":100,"prof":"مراقب حركة مركبات، مدرب مهني، أخصائي وسائل تعليمية، مدرب القيادة","minw":1,"sal":5000,"dec":"#212519"},{"g":"المراكز والصالات الرياضية","en":"Sports Centers","type":"نسبة توطين","pct":15,"prof":"مدرب رياضي، مدرب لياقة بدنية، مدرب كرة قدم محترف، مدرب رياضة مضرب/مائية/جليدية/فروسية محترف، مشرف رياضي","minw":4,"dec":"#72002","note":"المنشآت المرخصة من وزارة الرياضة فقط"},{"g":"الصيدلة","en":"Pharmacy","type":"قطاعي","pct":35,"prof":"صيدلي، صيدلي رعاية صيدلانية، أخصائي علوم صيدلانية/أدوية، مدير صيدلة، أخصائي مبيعات منتجات صيدلانية","minw":5,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#103111","note":"صيدليات المجتمع 35% / المستشفيات 65% / شركات ومستودعات 55%"},{"g":"مراكز الاسترخاء والعناية الشخصية","en":"Relaxation & Personal Care","type":"مقصورة على السعوديين","pct":100,"prof":"مدير فرع/إداري/تسويق/خدمة عملاء/مبيعات/مشتريات، محاسب، مساعد إداري، سكرتير، مدخل بيانات، موظف استقبال، أمين مخزن، بائع، صندوق محاسبة","minw":1,"dec":"#68098","note":"100% للأدوار الإدارية والمساندة"},{"g":"التغذية العلاجية","en":"Clinical Nutrition","type":"قطاعي","pct":80,"prof":"أخصائي تغذية، أخصائي تغذية سريرية، فني تغذية، فني علوم أغذية","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51277"},{"g":"المهن الهندسية","en":"Engineering","type":"قطاعي","pct":30,"prof":"46 مهنة هندسية: مهندس مدني، معماري، ميكانيكي، كهربائي، صناعي، كيميائي، إلكترونيات، طيران، بحري، نووي، بيئي، نفط وغاز، تدفئة وتهوية وتكييف، إنشائي، توربينات، ميكاترونكس، وغيرها","minw":5,"sal":8000,"body":"الهيئة السعودية للمهندسين","dec":"#93483"},{"g":"مهن خدمة العملاء (حضوري)","en":"Customer Service In-Person","type":"نسبة توطين","pct":70,"prof":"مضيف أرضي للحجوزات، كاتب استعلامات سياحية، كاتب تذاكر سفر، كاتب مركز اتصالات، استعلامات خدمة عملاء، مأمور سنترال، مشغل مقسم هاتف، كاتب اتصال/استعلامات، كاتب إدخال/بيانات عملاء","minw":3,"dec":"#208892"},{"g":"المهن الفنية الهندسية","en":"Technical Engineering","type":"قطاعي","pct":30,"prof":"مساح (جيوديسي/أراضي/كميات)، رسام هندسي/معماري، فني هندسة مدنية/كهربائية/ميكانيكية/كيميائية، ميكانيكي طائرات، فني صيانة، مراقب جودة، مشرف موقع إنشائي، وغيرها","minw":5,"sal":5000,"body":"الهيئة السعودية للمهندسين","dec":"#103105"},{"g":"السينما","en":"Cinema","type":"مقصورة على السعوديين","pct":100,"prof":"مبيعات وإشرافي (100%)، فني (50%)","minw":1,"dec":"#212560","note":"المرحلة 1: 100% مبيعات وإشرافي | المرحلة 2: 50% فني"}];
    var PT=isAr?{saudi:"مقصورة على السعوديين",ratio:"نسبة توطين",sector:"قطاعي (بنشاطه)",pct:"نسبة التوطين",sal:"الحد الأدنى للراتب المحتسب",minw:"يُطبق من (عدد عمال)",body:"جهة الاعتماد",dec:"القرار",empty:"اكتب مهنة للبحث، أو اختر قطاعاً من الاقتراحات.",none:"لا يوجد قرار توطين مباشر لهذه المهنة في مرجعنا — الأرجح أنها تخضع لنسب نطاقات نشاطك العامة فقط. تواصل معنا للتأكد.",all:"عرض كل القرارات"}:{saudi:"Saudi-only",ratio:"Saudization ratio",sector:"Sector-based",pct:"Required ratio",sal:"Min. counted salary",minw:"Applies from (workers)",body:"Accrediting body",dec:"Decision",empty:"Type a profession to search, or pick a sector chip.",none:"No direct localization decision found for this profession in our reference — it is likely governed only by your activity's general Nitaqat ratios. Contact us to confirm.",all:"Show all decisions"};
    function badge(t){var c=t==="مقصورة على السعوديين"?"saudi":(t==="نسبة توطين"?"ratio":"sector");var lbl=isAr?t:(c==="saudi"?PT.saudi:(c==="ratio"?PT.ratio:PT.sector));return '<span class="cc-badge '+c+'">'+lbl+'</span>';}
    function esc2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
    function hi(text,q){var t=esc2(text);if(!q)return t;var eq=esc2(q);if(t.indexOf(eq)<0)return t;return t.split(eq).join('<mark class="cc-hit">'+eq+"</mark>");}
    function card(d,q){var meta='<span><b>'+PT.pct+':</b> '+d.pct+'%</span>'+(d.sal?'<span><b>'+PT.sal+':</b> '+fmt(d.sal)+' ﷼</span>':'')+(d.minw?'<span><b>'+PT.minw+':</b> '+d.minw+'</span>':'')+(d.body?'<span><b>'+PT.body+':</b> '+esc2(d.body)+'</span>':'')+'<span><b>'+PT.dec+':</b> '+esc2(d.dec)+'</span>';
      return '<div class="cc-dec"><div class="cc-dec-head"><strong>'+esc2(isAr?d.g:(d.en||d.g))+'</strong>'+badge(d.type)+'</div><div class="cc-dec-profs">'+hi(d.prof,q)+'</div><div class="cc-dec-meta">'+meta+'</div>'+(d.note?'<div class="cc-dec-note">📌 '+esc2(d.note)+'</div>':'')+'</div>';}
    function renderProf(q){var box=$("cc-prof-results");q=(q||"").trim();
      if(!q){box.innerHTML='<p class="cc-prof-empty">'+PT.empty+'</p>';return;}
      if(q==="*"){box.innerHTML=PROF.map(function(d){return card(d,"");}).join("");return;}
      var hits=PROF.filter(function(d){return (d.prof+" "+d.g+" "+(d.en||"")).indexOf(q)>=0||(d.en||"").toLowerCase().indexOf(q.toLowerCase())>=0;});
      box.innerHTML=hits.length?hits.map(function(d){return card(d,q);}).join(""):'<p class="cc-prof-empty">🔎 '+PT.none+'</p>';}
    var chipBox=$("cc-prof-chips");
    var chipList=isAr?["محاسب","سكرتير","مهندس","مبيعات","تسويق","مشتريات","صيدلي","طبيب أسنان","موارد بشرية","عقاري"]:["Accounting","Engineering","Sales","Marketing","Procurement","Pharmacy","Real Estate"];
    chipList.forEach(function(c){var b=document.createElement("button");b.type="button";b.className="cc-chip";b.textContent=c;b.addEventListener("click",function(){$("cc-prof-q").value=c;renderProf(c);});chipBox.appendChild(b);});
    var allBtn=document.createElement("button");allBtn.type="button";allBtn.className="cc-chip";allBtn.textContent="📋 "+PT.all;allBtn.addEventListener("click",function(){$("cc-prof-q").value="";renderProf("*");});chipBox.appendChild(allBtn);
    $("cc-prof-q").addEventListener("input",function(){renderProf(this.value);});
    renderProf("");
    var loadPortal=function(){var f=$("cc-portal-frame");if(f&&!f.src)f.src=f.getAttribute("data-src");};
    var upTab=document.querySelector('[data-tab="upload"]');if(upTab)upTab.addEventListener("click",loadPortal);
    document.querySelectorAll(".cc-goto-upload").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();var tb=document.querySelector('[data-tab="upload"]');if(tb)tb.click();loadPortal();window.scrollTo({top:0,behavior:"smooth"});});});

    /* — official CR activity finder: 2,700+ coded activities (ISIC4 master reference) — */
    var AT=isAr?{loading:"جارٍ تحميل قائمة الأنشطة الرسمية…",count:"{n} نشاط مطابق",none:"لا يوجد نشاط مطابق — جرّب كلمة أخرى أو اكتب الكود.",code:"الكود",sector:"القطاع",en:"الاسم الإنجليزي",nit:"نشاط نطاقات الأقرب (اختير تلقائياً — تأكد منه)",dec:"قرارات توطين قد تنطبق على نشاطك:",noDec:"لا توجد قرارات توطين خاصة مرتبطة مباشرة بهذا النشاط في مرجعنا — تسري عليه نسب نطاقات نشاطك أعلاه.",clear:"مسح النشاط",official:"النطاق الرسمي يُعتمد من منصة قوى.",prof:"افحص مهن نشاطك"}:{loading:"Loading the official activities list…",count:"{n} matching activities",none:"No matching activity — try another word or type the code.",code:"Code",sector:"Sector",en:"English name",nit:"Closest Nitaqat activity (auto-selected — please verify)",dec:"Localization decisions that may apply to your activity:",noDec:"No specific localization decision is directly linked to this activity in our reference — your activity's Nitaqat ratios above apply.",clear:"Clear activity",official:"Your official band is confirmed on the Qiwa platform.",prof:"Check your activity's professions"};
    var ACT=null,actSec="",actPick=null;
    var actIn=$("cc-activity"),actDrop=$("cc-act-drop"),actInfo=$("cc-act-info"),actChipsBox=$("cc-act-chips");
    function anorm(s){return String(s||"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[ً-ْـ]/g,"").toLowerCase();}
    function actLoad(cb){
      if(ACT){cb(ACT);return;}
      if(!window.BP_ACT_URL){cb(null);return;}
      fetch(window.BP_ACT_URL).then(function(r){return r.json();}).then(function(d){ACT=d;buildSecChips();cb(d);}).catch(function(){cb(null);});
    }
    function buildSecChips(){
      if(!ACT||!actChipsBox||actChipsBox.childNodes.length)return;
      Object.keys(ACT.sections).sort().forEach(function(code){
        var s=ACT.sections[code]||["",""];
        var b=document.createElement("button");b.type="button";b.className="cc-chip";
        b.textContent=code+" · "+(isAr?s[0]:(s[1]||s[0]));
        b.addEventListener("click",function(){
          actSec=actSec===code?"":code;
          Array.prototype.forEach.call(actChipsBox.children,function(x){x.classList.toggle("on",x===b&&!!actSec);});
          renderActDrop(actIn.value);actIn.focus();
        });
        actChipsBox.appendChild(b);
      });
    }
    function actMatches(q){
      var hits=[],list=ACT.activities,isCode=/^\d+$/.test(q),nq=anorm(q);
      for(var i=0;i<list.length&&hits.length<40;i++){
        var a=list[i];
        if(actSec&&a[3]!==actSec)continue;
        if(!q){hits.push(a);continue;}
        if(isCode){if(a[0].indexOf(q)===0)hits.push(a);}
        else if(anorm(a[1]).indexOf(nq)>=0||String(a[2]||"").toLowerCase().indexOf(nq)>=0)hits.push(a);
      }
      return hits;
    }
    function renderActDrop(q){
      if(!actDrop)return;
      if(!ACT){actDrop.innerHTML='<div class="cc-act-count">'+AT.loading+'</div>';actDrop.hidden=false;return;}
      q=(q||"").trim();
      if(!q&&!actSec){actDrop.hidden=true;return;}
      var hits=actMatches(q);
      var html=hits.length?'<div class="cc-act-count">'+AT.count.replace("{n}",hits.length>=40?"40+":hits.length)+'</div>':'<div class="cc-act-count">🔎 '+AT.none+'</div>';
      html+=hits.map(function(a){
        var sec=ACT.sections[a[3]]||["",""];
        return '<button type="button" class="cc-act-item" data-code="'+a[0]+'"><b>'+a[0]+'</b>'+esc2(isAr?a[1]:(a[2]||a[1]))+'<span class="cc-act-sec">'+a[3]+' · '+esc2(isAr?sec[0]:(sec[1]||sec[0]))+'</span></button>';
      }).join("");
      actDrop.innerHTML=html;actDrop.hidden=false;
    }
    function toks(s){return anorm(s).split(/[^ء-يa-z0-9]+/).map(function(w){return w.replace(/^ال/,"");}).filter(function(w){return w.length>=4;});}
    function tokOverlap(aToks,bToks){var c=0;aToks.forEach(function(x){bToks.forEach(function(y){if(x.slice(0,4)===y.slice(0,4))c++;});});return c;}
    function relatedDecisions(a){
      var atoks=toks(a[1]+" "+(a[2]||""));
      return PROF.filter(function(d){return tokOverlap(atoks,toks(d.g+" "+(d.en||"")))>0;});
    }
    function nitMap(a){
      var atoks=toks(a[1]+" "+(a[2]||""));var best=-1,bestN=0;
      NIT_DATA.forEach(function(n,i){var c=tokOverlap(atoks,toks(n.name+" "+(n.en||"")));if(c>bestN){bestN=c;best=i;}});
      return best;
    }
    function selectAct(code){
      var a=null;for(var i=0;i<ACT.activities.length;i++){if(ACT.activities[i][0]===code){a=ACT.activities[i];break;}}
      if(!a)return;
      actPick=a;actDrop.hidden=true;
      actIn.value=a[0]+" — "+(isAr?a[1]:(a[2]||a[1]));
      var sec=ACT.sections[a[3]]||["",""];
      var decs=relatedDecisions(a);
      var mi=nitMap(a);
      if(mi>=0)actSel.value=mi;
      var decHtml=decs.length
        ?'<div class="cc-act-dec"><div class="cc-act-dec-title">'+AT.dec+'</div>'+decs.map(function(d){return '<div class="cc-act-dec-row">'+badge(d.type)+'<span>'+esc2(isAr?d.g:(d.en||d.g))+' — '+d.pct+'%</span></div>';}).join("")+'<button type="button" class="cc-chip" id="cc-act-goprof">🧑‍💼 '+AT.prof+'</button></div>'
        :'<div class="cc-act-dec">'+AT.noDec+'</div>';
      actInfo.innerHTML='<button type="button" class="cc-act-clear" id="cc-act-clear">✕ '+AT.clear+'</button><h4>'+esc2(isAr?a[1]:(a[2]||a[1]))+'</h4><div class="cc-act-meta"><span><b>'+AT.code+':</b> '+a[0]+'</span><span><b>'+AT.sector+':</b> '+a[3]+' · '+esc2(isAr?sec[0]:(sec[1]||sec[0]))+'</span>'+(isAr&&a[2]?'<span><b>'+AT.en+':</b> '+esc2(a[2])+'</span>':'')+(mi>=0?'<span><b>'+AT.nit+':</b> '+esc2(isAr?NIT_DATA[mi].name:(NIT_DATA[mi].en||NIT_DATA[mi].name))+'</span>':'')+'</div>'+decHtml+'<div class="form-note" style="margin-top:8px">⚖️ '+AT.official+'</div>';
      actInfo.hidden=false;
      var gp=document.getElementById("cc-act-goprof");
      if(gp)gp.addEventListener("click",function(){
        var t=document.querySelector('[data-tab="prof"]');if(t)t.click();
        var q=$("cc-prof-q");
        if(q&&decs[0]){q.value=isAr?decs[0].g:(decs[0].en||decs[0].g);renderProf(q.value);}
      });
      var cl=document.getElementById("cc-act-clear");
      if(cl)cl.addEventListener("click",function(){actPick=null;actIn.value="";actInfo.hidden=true;});
    }
    if(actIn){
      actIn.addEventListener("focus",function(){actLoad(function(){renderActDrop(actIn.value);});});
      actIn.addEventListener("input",function(){actPick=null;actLoad(function(){renderActDrop(actIn.value);});});
      actDrop.addEventListener("click",function(e){var it=e.target.closest(".cc-act-item");if(it)selectAct(it.getAttribute("data-code"));});
      document.addEventListener("click",function(e){if(!e.target.closest(".cc-act-field"))actDrop.hidden=true;});
    }
  })();
  </script>`;
  return page({
    title: Lraw("Nitaqat & government cost calculators — Business Partner", "حاسبات النطاقات والتكاليف الحكومية — بيزنس بارتنر"),
    desc: Lraw("Estimate your Saudization (Nitaqat) band and per-worker government costs in seconds.", "احسب نطاق السعودة المتوقع وتكاليف العمالة الحكومية لكل عامل خلال ثوانٍ."),
    active: "/calculator",
    path: "/compliance-calculators",
    body,
  });
}

// Branded wrapper around the secure n8n intake form — clients never see a bare n8n URL.
const COMPLIANCE_FORM_URL = "https://businesspartnerai.app.n8n.cloud/form/client-compliance-intake";
function buildCompliancePortal() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Compliance Agent", "وكيل الامتثال")}</span>
    <h1>${L("Establishment Compliance Portal", "بوابة امتثال المنشأة")}</h1>
    <p class="lead">${L("Upload your official Qiwa, Muqeem, GOSI and Mudad reports once — the Compliance Agent reads them, builds your establishment file, tracks every iqama and work-permit deadline, and alerts you on WhatsApp and email before any violation.", "ارفع تقاريرك الرسمية من قوى ومقيم والتأمينات (GOSI) ومدد مرة واحدة — وكيل الامتثال يقرأها، يبني ملف منشأتك، يتتبع كل استحقاق إقامة ورخصة عمل، وينبّهك واتساب وإيميل قبل أي مخالفة.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="portal-wrap">
      <div class="portal-form">
        <iframe src="${COMPLIANCE_FORM_URL}" title="${Lraw("Establishment compliance intake form", "نموذج بوابة امتثال المنشأة")}" loading="lazy" referrerpolicy="no-referrer"></iframe>
        <p class="form-note portal-fallback">${L("Form not showing?", "النموذج ما ظهر؟")} <a href="${COMPLIANCE_FORM_URL}" target="_blank" rel="noopener">${L("Open it in a separate window →", "افتحه في نافذة مستقلة ←")}</a></p>
      </div>
      <aside class="portal-side">
        <div class="order-box">
          <h3>${L("What happens after you submit?", "وش يصير بعد الإرسال؟")}</h3>
          <ol class="portal-steps">
            <li><strong>${L("Your private folder is created", "يُنشأ مجلدك الخاص")}</strong><span>${L("Every file you upload is stored in a dedicated client folder.", "كل ملف ترفعه يُحفظ في مجلد عميل مخصص لمنشأتك.")}</span></li>
            <li><strong>${L("The agent reads your reports", "الوكيل يقرأ تقاريرك")}</strong><span>${L("Employees, salaries, professions, iqama and border numbers are extracted automatically.", "يستخرج الموظفين والرواتب والمهن وأرقام الإقامات والحدود تلقائياً.")}</span></li>
            <li><strong>${L("Your compliance file is built", "يُبنى ملف امتثالك")}</strong><span>${L("Nitaqat band, estimated government costs, and every upcoming deadline.", "نطاق السعودة، التكاليف الحكومية التقديرية، وكل استحقاق قادم.")}</span></li>
            <li><strong>${L("Daily monitoring starts", "تبدأ المراقبة اليومية")}</strong><span>${L("Red/yellow early alerts on WhatsApp and email — with your approval before any government action.", "تنبيهات مبكرة أحمر/أصفر واتساب وإيميل — وبموافقتك قبل أي إجراء حكومي.")}</span></li>
          </ol>
        </div>
        <div class="order-box portal-secure">
          <h3>🔒 ${L("Your data is protected", "بياناتك محمية")}</h3>
          <p>${L("Files are used for compliance analysis only, stored in your private client folder, and never shared. Concierge model: no action is ever taken on your establishment without written approval.", "الملفات تُستخدم لتحليل الامتثال فقط، وتُحفظ في مجلد عميلك الخاص، ولا تُشارك مع أي طرف. نموذج Concierge: لا يُنفَّذ أي إجراء على منشأتك دون موافقة خطية.")}</p>
        </div>
        <div class="order-box">
          <h3>${L("Prefer to talk first?", "تبغى تتكلم مع أحد أولاً؟")}</h3>
          <a class="btn btn-wa" href="${WA}" target="_blank" rel="noopener" style="width:100%">${I.wa}<span>${L("WhatsApp us", "كلّمنا واتساب")}</span></a>
          <a class="btn btn-ghost" href="${u("/compliance-calculators")}" style="width:100%;margin-top:10px">${L("Free compliance calculators →", "حاسبات الامتثال المجانية ←")}</a>
        </div>
      </aside>
    </div>
  </div></section>
  <style>
    .portal-wrap{display:grid;grid-template-columns:1.6fr 1fr;gap:22px;align-items:start}
    .portal-form iframe{width:100%;min-height:1250px;border:1px solid var(--gray-line);border-radius:var(--radius-lg);background:var(--white)}
    .portal-fallback{text-align:center;margin-top:10px}
    .portal-side{display:flex;flex-direction:column;gap:16px}
    .portal-side .order-box{margin:0}
    .portal-steps{list-style:none;counter-reset:ps;margin:0;padding:0}
    .portal-steps li{counter-increment:ps;position:relative;padding-inline-start:44px;margin-bottom:16px}
    .portal-steps li::before{content:counter(ps);position:absolute;inset-inline-start:0;top:2px;width:30px;height:30px;border-radius:50%;background:var(--navy);color:var(--white);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem}
    .portal-steps strong{display:block;color:var(--navy);margin-bottom:2px}
    .portal-steps span{font-size:.86rem;color:var(--text-soft);line-height:1.7}
    .portal-secure p{font-size:.88rem;color:var(--text-soft);line-height:1.8;margin:0}
    @media(max-width:940px){.portal-wrap{grid-template-columns:1fr}}
  </style>`;
  return page({
    title: Lraw("Establishment Compliance Portal — Business Partner", "بوابة امتثال المنشأة — بيزنس بارتنر"),
    desc: Lraw("Upload your Qiwa, Muqeem, GOSI and Mudad reports — the Compliance Agent builds your file and alerts you before any violation.", "ارفع تقاريرك من قوى ومقيم والتأمينات ومدد — وكيل الامتثال يبني ملفك وينبّهك قبل أي مخالفة."),
    active: "/calculator",
    path: "/compliance-portal",
    body,
  });
}

function buildTourism() {
  const t = site.tourism;
  const b = site.businessTourism;
  const ev = t.events;
  const evFeats = ev.features.map((f, i) => `<li>${I.check}<span>${L((ev.featuresEn && ev.featuresEn[i]) || f, f)}</span></li>`).join("");
  const items = b.includes.items
    .map((it) => `<div class="card feature"><div class="card-icon">${I.globe}</div><h3>${L(it.titleEn || it.title, it.title)}</h3><p>${L(it.textEn || it.text, it.text)}</p></div>`)
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Tourism & events", "السياحة والفعاليات")}</span>
    <h1>${L(t.titleEn || t.title, t.title)}</h1>
    <p class="lead">${L(t.leadEn || t.lead, t.lead)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="#events">${I.building}<span>${L("Staff events", "فعاليات الموظفين")}</span></a>
      <a class="btn btn-ghost btn-lg" href="#investor">${I.globe}<span>${L("Investor business tourism", "سياحة الأعمال للمستثمر")}</span></a>
    </div>
  </div></section>

  <section class="section" id="events"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(ev.eyebrowEn || ev.eyebrow, ev.eyebrow)}</span><h2>${L(ev.titleEn || ev.title, ev.title)}</h2><p>${L(ev.textEn || ev.text, ev.text)}</p></div>
    <div class="booking-wrap">
      <form class="calc-form" id="event-form" novalidate>
        <h2>${L("Request your event", "اطلب فعاليتك")}</h2>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="ev-company">${L("Company name", "اسم الشركة")}</label><input id="ev-company" type="text" required></div>
          <div class="field"><label for="ev-person">${L("Contact person", "الشخص المسؤول")}</label><input id="ev-person" type="text" required></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="ev-phone">${L("Mobile", "رقم الجوال")}</label><input id="ev-phone" type="tel" required placeholder="05xxxxxxxx"></div>
          <div class="field"><label for="ev-email">${L("Company email (no free email providers)", "إيميل الشركة (لا تُقبل الإيميلات المجانية)")}</label><input id="ev-email" type="email" required placeholder="name@company.com"></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="ev-date">${L("Preferred event date", "اليوم المناسب للفعالية")}</label><input id="ev-date" type="date" required></div>
          <div class="field"><label for="ev-count">${L("Number of attendees", "عدد الأفراد")}</label><input id="ev-count" type="number" min="1" required placeholder="50"></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="ev-class">${L("Experience level", "مستوى الرحلة")}</label>
            <select id="ev-class">
              <option value="standard">${L("Standard", "عادي")}</option>
              <option value="vip">VIP</option>
            </select></div>
          <div class="field"><label for="ev-venue">${L("Venue type", "نوع المكان")}</label>
            <select id="ev-venue">
              <option>${L("Inside company premises", "داخل مقر الشركة")}</option>
              <option>${L("Outdoor activity", "فعالية خارجية (أوت دور)")}</option>
              <option>${L("Events hall", "قاعة مناسبات")}</option>
              <option>${L("Workshop hall", "قاعة ورش عمل")}</option>
            </select></div>
        </div>
        <div class="field"><label for="ev-type">${L("Event type", "نوع الفعالية")}</label>
          <select id="ev-type">
            <option>${L("National Day celebration", "احتفال باليوم الوطني")}</option>
            <option>${L("Founding Day", "يوم التأسيس")}</option>
            <option>${L("Internal occasion", "مناسبة داخلية")}</option>
            <option>${L("Team building", "بناء فريق (Team Building)")}</option>
            <option>${L("Employee recognition", "تكريم موظفين")}</option>
            <option>${L("Product launch", "إطلاق منتج")}</option>
            <option>${L("Eid gathering", "معايدة العيد")}</option>
            <option>${L("Sports / wellness day", "يوم رياضي / صحي")}</option>
            <option>${L("Conference / forum", "مؤتمر / ملتقى")}</option>
            <option>${L("Training workshop", "ورشة تدريبية")}</option>
            <option>${L("Year-end celebration", "حفل نهاية العام")}</option>
            <option>${L("Ramadan Iftar", "إفطار رمضاني")}</option>
            <option>${L("Other", "أخرى")}</option>
          </select></div>
        <div class="field"><label for="ev-notes">${L("Extra details (optional)", "تفاصيل إضافية (اختياري)")}</label><textarea id="ev-notes" rows="3" placeholder="${Lraw("Theme, budget range, preferred city…", "الثيم، حدود الميزانية، المدينة المفضلة…")}"></textarea></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.calendar}<span>${L("Send event request", "أرسل طلب الفعالية")}</span></button>
        <p class="form-note">${L("Your request reaches our team, we collect the best 5 supplier offers, and you pick the winner.", "يصل طلبك لفريقنا، نجمع لك أفضل 5 عروض من المزوّدين، وتختار الأنسب.")}</p>
        <div class="form-success" id="event-success" hidden></div>
      </form>
      <aside class="booking-side">
        <div class="order-box">
          <h3>${L("How it works", "كيف تعمل")}</h3>
          <ul class="feat-list">${evFeats}</ul>
          <p class="mini">${L("Are you an events supplier?", "هل أنت مورّد فعاليات؟")}</p>
          <a class="btn btn-ghost" href="${u("/suppliers")}">${L("Join our suppliers portal", "سجّل في بوابة الموردين")}</a>
        </div>
      </aside>
    </div>
  </div></section>

  <section class="section section--gray" id="investor"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Type two · investor business tourism", "النوع الثاني · سياحة الأعمال للمستثمر")}</span><h2>${L(b.titleEn || b.title, b.title)}</h2><p>${L(b.leadEn || b.lead, b.lead)}</p></div>
    <div class="grid grid-3">${items}</div>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${L((b.noteEn || b.note) + " The price is set by program — contact us for pricing.", b.note + " السعر يُحدَّد حسب البرنامج — تواصل معنا للتسعير.")}</p></div>
    <div class="center mt-32">${waBtn2(b.ctaEn || b.cta, b.cta, "btn-primary", true)}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Ready for us to arrange it?", "جاهز نرتّب لك؟")}</h2><p>${L("Whether an event for your staff or an exploratory trip to the Saudi market — we tailor it to you.", "سواء فعالية لموظفيك أو رحلة استكشاف للسوق السعودي — نصمّمها على مقاسك.")}</p>${waBtn2("Contact us", "تواصل معنا", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("Tourism & events — Business Partner", "السياحة والفعاليات — بيزنس بارتنر"), desc: Lraw((t.leadEn || t.lead).slice(0, 155), t.lead.slice(0, 155)), active: "/tourism", body });
}

function buildSaudi() {
  const s = site.saudiArabia;
  const targets = s.vision.targets.map((t) => `<div class="stat"><div class="num">${esc(t.value)}</div><div class="lbl">${L(t.labelEn || t.label, t.label)}</div></div>`).join("");
  const sectors = s.sectors.items
    .map(
      (it) => `<a class="card svc-card" href="${u("/services")}#${slugCat(it.category)}">
      <div class="card-icon">${I.building}</div>
      <h3>${L(it.titleEn || it.title, it.title)}</h3><p class="desc">${L(it.textEn || it.text, it.text)}</p>
      <span class="card-link">${L("Browse services", "استعرض الخدمات")} ${I.arrow}</span></a>`
    )
    .join("");
  const articles = s.knowledge.articles
    .map(
      (a) => `<a class="card article-card" href="${u(a.link)}">
      <span class="tag">${I.doc}${L("Knowledge guide", "دليل معرفي")}</span>
      <h3>${L(a.titleEn || a.title, a.title)}</h3><p class="desc">${L(a.excerptEn || a.excerpt, a.excerpt)}</p>
      <span class="card-link">${L("Read more", "اقرأ المزيد")} ${I.arrow}</span></a>`
    )
    .join("");
  const entities = s.entities.items
    .map(
      (e) => `<a class="card entity-card" href="${u(e.link)}">
      <div class="entity-head"><h3>${L(e.nameEn || e.name, e.name)}</h3><span class="entity-gov">${L(e.govEn || e.gov, e.gov)}</span></div>
      <p class="desc"><strong>${L("What it does:", "ماذا تفعل؟")}</strong> ${L(e.whatEn || e.what, e.what)}</p>
      <p class="desc"><strong>${L("How we serve you:", "كيف نخدمك؟")}</strong> ${L(e.helpEn || e.help, e.help)}</p>
      <span class="card-link">${L("Related services", "الخدمات ذات العلاقة")} ${I.arrow}</span></a>`
    )
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Saudi Arabia", "السعودية")}</span>
    <h1>${L(s.titleEn || s.title, s.title)}</h1>
    <p class="lead">${L(s.leadEn || s.lead, s.lead)}</p>
    <div class="hero-actions">${waBtn2("Start your investment", "ابدأ استثمارك", "btn-primary")}<a class="btn btn-ghost" href="${u("/services")}">${L("Browse services", "استعرض الخدمات")}</a></div>
  </div></section>

  <section class="section section--navy"><div class="container">
    <div class="section-head"><span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${L(s.vision.eyebrowEn || s.vision.eyebrow, s.vision.eyebrow)}</span><h2 style="color:#fff">${L(s.vision.titleEn || s.vision.title, s.vision.title)}</h2></div>
    <div class="stats">${targets}</div>
    <p class="center" style="color:rgba(255,255,255,.6);font-size:.85rem;margin-top:26px">${L(s.vision.sourceEn || s.vision.source, s.vision.source)}</p>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(s.sectors.eyebrowEn || s.sectors.eyebrow, s.sectors.eyebrow)}</span><h2>${L(s.sectors.titleEn || s.sectors.title, s.sectors.title)}</h2><p>${L(s.sectors.subtitleEn || s.sectors.subtitle, s.sectors.subtitle)}</p></div>
    <div class="grid grid-3">${sectors}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(s.entities.eyebrowEn || s.entities.eyebrow, s.entities.eyebrow)}</span><h2>${L(s.entities.titleEn || s.entities.title, s.entities.title)}</h2><p>${L(s.entities.subtitleEn || s.entities.subtitle, s.entities.subtitle)}</p></div>
    <div class="grid grid-3">${entities}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(s.knowledge.eyebrowEn || s.knowledge.eyebrow, s.knowledge.eyebrow)}</span><h2>${L(s.knowledge.titleEn || s.knowledge.title, s.knowledge.title)}</h2><p>${L(s.knowledge.subtitleEn || s.knowledge.subtitle, s.knowledge.subtitle)}</p></div>
    <div class="grid grid-3">${articles}</div>
    <div class="cta-band" style="margin-top:40px"><h2>${L("Want a detailed guide for your case?", "تبي دليلاً مفصّلاً لحالتك؟")}</h2><p>${L("The smart agent prepares your service steps and requirements instantly on WhatsApp.", "الوكيل الذكي يجهّز لك خطوات خدمتك ومتطلباتها فوراً على واتساب.")}</p>${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("Saudi Arabia — investment data & guides | Business Partner", "السعودية — بيانات وأدلة الاستثمار | بيزنس بارتنر"), desc: Lraw((s.leadEn || s.lead).slice(0, 155), s.lead.slice(0, 155)), active: "/saudi-arabia", body });
}

function buildNews() {
  const n = site.news;
  const k = site.saudiArabia.knowledge;
  const guides = k.articles
    .map(
      (a) => `<a class="card article-card" href="${u(a.link)}">
      <span class="tag">${I.doc}${L("Practical guide", "دليل عملي")}</span>
      <h3>${L(a.titleEn || a.title, a.title)}</h3><p class="desc">${L(a.excerptEn || a.excerpt, a.excerpt)}</p>
      <span class="card-link">${L("Read more", "اقرأ المزيد")} ${I.arrow}</span></a>`
    )
    .join("");
  const updates = n.platformUpdates.items
    .map(
      (it) => `<div class="card"><div class="update-head"><span class="update-badge">${L(it.platformEn || it.platform, it.platform)}</span></div>
      <p>${L(it.textEn || it.text, it.text)}</p></div>`
    )
    .join("");
  const stories = n.successStories.items
    .map((q) => `<div class="quote"><p>${L(q.textEn || q.text, q.text)}</p><div class="role">${L(q.tagEn || q.tag, q.tag)}</div></div>`)
    .join("");
  const cats = [
    { id: "guides", en: "Practical guides", ar: "أدلة عملية" },
    { id: "platforms", en: "Platform updates", ar: "تحديثات المنصات" },
    { id: "stories", en: "Success stories", ar: "قصص نجاح" },
    { id: "partners", en: "Announcements & partnerships", ar: "إعلانات وشراكات" },
    { id: "weekly", en: "Weekly roundup", ar: "الملخص الأسبوعي" },
  ];
  const sideNav = cats.map((c2) => `<a href="#${c2.id}" data-hub="${c2.id}">${L(c2.en, c2.ar)}</a>`).join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Insights & news", "الرؤى والأخبار")}</span>
    <h1>${L("Insights & news", "الرؤى والأخبار")}</h1>
    <p class="lead">${L("Practical guides, government-platform updates, success stories and announcements — everything you need in one place.", "أدلة عملية، تحديثات المنصات الحكومية، قصص نجاح وإعلانات — كل ما تحتاجه في مكان واحد.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="hub">
      <aside class="hub-side"><nav class="hub-nav" id="hub-nav">${sideNav}</nav></aside>
      <div class="hub-main">
        <div class="hub-sec" id="guides">
          <h2>${L("Practical guides", "أدلة عملية")}</h2>
          <p class="hub-sub">${L(k.subtitleEn || k.subtitle, k.subtitle)}</p>
          <div class="grid grid-2">${guides}</div>
        </div>
        <div class="hub-sec" id="platforms">
          <h2>${L(n.platformUpdates.titleEn || n.platformUpdates.title, n.platformUpdates.title)}</h2>
          <p class="hub-sub">${L(n.platformUpdates.subtitleEn || n.platformUpdates.subtitle, n.platformUpdates.subtitle)}</p>
          <div class="grid grid-2">${updates}</div>
        </div>
        <div class="hub-sec" id="stories">
          <h2>${L(n.successStories.titleEn || n.successStories.title, n.successStories.title)}</h2>
          <p class="hub-sub">${L(n.successStories.noteEn || n.successStories.note, n.successStories.note)}</p>
          <div class="grid grid-2">${stories}</div>
        </div>
        <div class="hub-sec" id="partners">
          <h2>${L(n.partnerships.titleEn || n.partnerships.title, n.partnerships.title)}</h2>
          <p class="hub-sub">${L(n.partnerships.noteEn || n.partnerships.note, n.partnerships.note)}</p>
          <div class="callout"><span class="ico">🤝</span><p>${L("For collaboration or partnership, book a consultation or reach us via the smart agent.", "للتعاون أو الشراكة، احجز استشارة أو تواصل معنا عبر الوكيل الذكي.")}</p></div>
          <div style="margin-top:14px"><a class="btn btn-primary" href="${u("/consultation")}">${I.calendar}<span>${L("Book a consultation", "احجز استشارة")}</span></a></div>
        </div>
        <div class="hub-sec" id="weekly">
          <h2>${L("Weekly roundup", "الملخص الأسبوعي")}</h2>
          <div class="callout"><span class="ico">🗞️</span><p>${L(n.weeklyNoteEn || n.weeklyNote || "", n.weeklyNote || "")}</p></div>
          ${site.whatsappChannel ? `<div style="margin-top:14px"><a class="btn btn-wa" href="${site.whatsappChannel}" target="_blank" rel="noopener">${I.channel}<span>${L("Follow our WhatsApp channel", "تابع قناتنا في واتساب")}</span></a></div>` : ""}
        </div>
      </div>
    </div>
  </div></section>`;
  return page({ title: Lraw("Insights & news — Business Partner", "الرؤى والأخبار — بيزنس بارتنر"), desc: Lraw("Practical guides, platform updates, success stories and announcements from Business Partner.", "أدلة عملية وتحديثات المنصات وقصص نجاح وإعلانات من بيزنس بارتنر."), active: "/news", body });
}

function buildCareers() {
  const c = site.careers;
  const recs = services.filter((x) => x.category === "Recruitment");
  const recCards = recs
    .map(
      (x) => `<a class="card svc-card" href="${u("/services/" + x.slug)}">
      <span class="tag">${L(catEn(x.category), catAr(x.category))}</span>
      <h3>${esc(sName(x))}</h3>
      <div class="foot"><span class="price">${esc(priceLabel(x))}</span><span class="card-link">${L("Details", "التفاصيل")} ${I.arrow}</span></div></a>`
    )
    .join("");
  const f = c.seeker.fields;
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Careers", "الوظائف")}</span>
    <h1>${L("Careers & recruitment", c.title)}</h1>
    <p class="lead">${L("Whether you're an employer looking for talent or a job seeker looking for the right opportunity — Business Partner connects both sides.", c.lead)}</p>
    <div class="path-switch">
      <a class="btn btn-primary" href="#employers">${I.building}<span>${L("I'm an employer", "أنا صاحب عمل")}</span></a>
      <a class="btn btn-ghost" href="#seekers">${I.users}<span>${L("I'm looking for a job", "أبحث عن عمل")}</span></a>
    </div>
  </div></section>

  <section class="section" id="employers"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("For employers", c.employer.eyebrow)}</span><h2>${L("Recruit the right talent", c.employer.title)}</h2><p>${L("From executive search to local recruitment and bulk hiring — we manage the recruitment process end to end.", c.employer.text)}</p></div>
    <div class="grid grid-3">${recCards}</div>
    <div class="center mt-32">${waBtn2("Request recruitment", c.employer.cta, "btn-primary", true)}</div>
  </div></section>

  <section class="section section--gray" id="seekers"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("For job seekers", c.seeker.eyebrow)}</span><h2>${L("Submit your CV", c.seeker.title)}</h2><p>${L("Upload your CV and register your specialty to join our candidate pool. We match you to opportunities that fit your experience and reach out when a suitable role opens.", c.seeker.text)}</p></div>
    <div style="max-width:640px;margin:0 auto">
      <form class="calc-form cv-form" id="cv-form" novalidate>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-name">${L("Full name", f.name)}</label><input id="c-name" name="name" type="text" required></div>
          <div class="field"><label for="c-phone">${L("Mobile", f.phone)}</label><input id="c-phone" name="phone" type="tel" required></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-email">${L("Email", f.email)}</label><input id="c-email" name="email" type="email"></div>
          <div class="field"><label for="c-exp">${L("Years of experience", f.experience)}</label><input id="c-exp" name="experience" type="text" placeholder="${Lraw("e.g. 3 years", "مثال: 3 سنوات")}"></div>
        </div>
        <div class="field"><label for="c-field">${L("Field / specialty", f.field)}</label><input id="c-field" name="field" type="text" placeholder="${Lraw("e.g. accounting, marketing, engineering", "مثال: محاسبة، تسويق، هندسة")}"></div>
        <div class="field">
          <label>${L("CV (PDF)", f.cv)}</label>
          <label class="file-drop" for="c-cv" id="cv-drop">
            <span class="file-ico">${I.upload}</span>
            <span class="file-text" id="cv-filename">${L("Drag your CV here or click to choose — PDF or Word", "اسحب سيرتك هنا أو اضغط للاختيار — PDF أو Word")}</span>
          </label>
          <input id="c-cv" name="cv" type="file" accept=".pdf,.doc,.docx" required hidden>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.upload}<span>${L("Send your CV", c.seeker.cta || "أرسل سيرتك الذاتية")}</span></button>
        <p class="form-note" id="cv-note">${L("Upload your CV directly from the button (PDF/Word) to reach our team and join the candidate pool. (Automated pipeline — n8n & Notion — coming soon.)", c.seeker.note)}</p>
        <div class="form-success" id="cv-success" hidden>${L("✅ Your CV has been received. We'll review it and reach out when a suitable opportunity comes up. You can also follow us on WhatsApp.", "✅ تم استلام سيرتك الذاتية. سنراجعها ونتواصل معك عند توفّر فرصة مناسبة. يمكنك أيضاً متابعتنا على واتساب.")}</div>
      </form>
      <div class="center mt-16">${waBtn2("Or send it via WhatsApp", "أو أرسلها عبر واتساب", "btn-ghost")}</div>
    </div>
  </div></section>`;
  return page({ title: Lraw("Careers & recruitment — Business Partner", "الوظائف والتوظيف — بيزنس بارتنر"), desc: Lraw("Careers and recruitment with Business Partner — for employers and job seekers.", c.lead.slice(0, 155)), active: "/careers", body });
}

function buildContact() {
  const c = site.contact;
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Contact us", "تواصل معنا")}</span>
    <h1>${L("We reply instantly", "نجاوبك فوراً")}</h1>
    <p class="lead">${L("The fastest way to reach us is the smart agent on WhatsApp — it replies 24/7. Or fill in the form and we'll get back to you.", "أسرع طريقة للتواصل هي الوكيل الذكي على واتساب — يرد 24/7. أو املأ النموذج ونعاود التواصل معك.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="contact-grid">
      <div>
        <h2>${L("Contact information", "معلومات التواصل")}</h2>
        <ul class="info-list">
          <li><span class="ico">${I.wa}</span><div><div class="k">${L("WhatsApp — smart agent", "واتساب — الوكيل الذكي")}</div><a class="v" href="${WA}" target="_blank" rel="noopener">${esc(c.whatsappAgent)}</a></div></li>
          <li><span class="ico">${I.wa}</span><div><div class="k">${L("WhatsApp — human support", "واتساب — الدعم البشري")}</div><a class="v" href="${WA_SUPPORT}" target="_blank" rel="noopener">${esc(c.whatsappSupport)}</a></div></li>
          ${site.whatsappChannel ? `<li><span class="ico">${I.channel}</span><div><div class="k">${L("WhatsApp channel", "قناة واتساب")}</div><a class="v" href="${site.whatsappChannel}" target="_blank" rel="noopener">${L("Follow our WhatsApp channel", "تابع قناتنا في واتساب")}</a></div></li>` : ""}
          <li><span class="ico">${I.phone}</span><div><div class="k">${L("Phone", "التواصل الهاتفي")}</div><a class="v" href="tel:${esc(c.phoneIntl)}">${esc(c.phone)}</a></div></li>
          <li><span class="ico">${I.mail}</span><div><div class="k">${L("Email", "البريد الإلكتروني")}</div><a class="v" href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>
          <li><span class="ico">${I.pin}</span><div><div class="k">${L("Address", "العنوان")}</div><div class="v">${L(c.addressEn || c.address, c.address)}</div></div></li>
          <li><span class="ico">${I.clock}</span><div><div class="k">${L("Working hours", "أوقات العمل")}</div><div class="v">${L(c.hoursEn || c.hours, c.hours)}</div></div></li>
        </ul>
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${encodeURIComponent("حي الملقا الرياض")}&output=embed" loading="lazy" title="${Lraw("Business Partner location", "موقع بيزنس بارتنر")}"></iframe>
        </div>
      </div>
      <div>
        <h2>${L("Send your message", "أرسل رسالتك")}</h2>
        <form class="calc-form" action="${WA}" method="get" target="_blank" onsubmit="return true">
          <div class="field"><label for="f-name">${L("Name", "الاسم")}</label><input id="f-name" name="name" type="text" placeholder="${Lraw("Your full name", "اسمك الكامل")}" required></div>
          <div class="field"><label for="f-phone">${L("Mobile", "رقم الجوال")}</label><input id="f-phone" name="phone" type="tel" placeholder="05xxxxxxxx"></div>
          <div class="field"><label for="f-service">${L("Service needed", "الخدمة المطلوبة")}</label><input id="f-service" name="service" type="text" placeholder="${Lraw("e.g. company formation, premium residency", "مثال: تأسيس شركة، إقامة مميزة")}"></div>
          <div class="field"><label for="f-msg">${L("Your request details", "تفاصيل طلبك")}</label><textarea id="f-msg" name="message" rows="4" placeholder="${Lraw("Write your enquiry here", "اكتب استفسارك هنا")}"></textarea></div>
          ${waBtn2("Send via WhatsApp", "أرسل عبر واتساب", "btn-wa")}
          <p class="form-note">${L("Tapping the button opens WhatsApp to send your request straight to the smart agent.", "بالضغط على الزر يفتح واتساب لإكمال إرسال طلبك للوكيل الذكي مباشرة.")}</p>
        </form>
      </div>
    </div>
  </div></section>`;
  return page({ title: Lraw("Contact — Business Partner", "اتصل بنا — بيزنس بارتنر"), desc: Lraw("Contact Business Partner via WhatsApp, phone or email — instant reply from the smart agent 24/7.", "تواصل مع بيزنس بارتنر عبر واتساب أو الهاتف أو البريد — رد فوري من الوكيل الذكي 24/7."), active: "/contact", body });
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
          <a class="btn btn-primary" href="${u("/services")}">${L("Browse services", "تصفّح الخدمات")}</a></div>
      </div>
      <aside class="cart-aside">
        <div class="order-box">
          <h3>${L("Summary", "الملخص")}</h3>
          <div class="calc-line"><span class="k">${L("Subtotal (fees)", "المجموع (الأتعاب)")}</span><span class="v" id="cart-subtotal">—</span></div>
          <div class="calc-line"><span class="k">${L("VAT 15%", "ضريبة القيمة المضافة 15%")}</span><span class="v" id="cart-vat">—</span></div>
          <div class="calc-total"><span class="k">${L("Total", "الإجمالي")}</span><span class="v" id="cart-total">—</span></div>
          <a class="btn btn-primary btn-lg" id="cart-checkout" href="${u("/checkout")}" style="width:100%">${L("Checkout", "إتمام الطلب")}</a>
          <p class="mini">${L("Some items are quoted on review; the team confirms the final amount.", "بعض البنود تُسعّر عند المراجعة؛ يؤكد الفريق المبلغ النهائي.")}</p>
          <p class="calc-note">${L(cm.vatNoteEn || cm.vatNote, cm.vatNote)}</p>
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: Lraw("Cart — Business Partner", "السلة — بيزنس بارتنر"), desc: Lraw("Your cart of Business Partner services and packages.", "سلة طلباتك من خدمات وباقات بيزنس بارتنر."), active: "/cart", path: "/cart", body });
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
          <div id="epay-box" class="bank-box" hidden>
            <div class="bank-head">${I.shield}<strong>${L("Pay online (mada / Visa / Apple Pay)", "ادفع إلكترونياً (مدى / فيزا / أبل باي)")}</strong></div>
            <div id="epay-form"></div>
            <p class="calc-note">${L("Secure payment. Or transfer manually using the bank details below.", "دفع آمن. أو حوّل يدوياً باستخدام بيانات الحساب أدناه.")}</p>
          </div>
          <div class="bank-box">
            <div class="bank-head">${I.bank}<strong>${L("Bank transfer details", "بيانات التحويل البنكي")}</strong></div>
            <ul class="bank-list">
              <li><span class="k">${L("Beneficiary", "المستفيد")}</span><span class="v">${L(bank.beneficiaryEn || bank.beneficiary, bank.beneficiary)}</span></li>
              <li><span class="k">${L("Bank", "البنك")}</span><span class="v">${L(bank.bankNameEn || bank.bankName, bank.bankName)}</span></li>
              ${bank.account && bank.account !== "—" ? `<li><span class="k">${L("Account no.", "رقم الحساب")}</span><span class="v mono">${esc(bank.account)}</span><button type="button" class="copy-btn" data-copy="${esc(bank.account)}">📋 ${L("Copy", "نسخ")}</button></li>` : ""}
              <li><span class="k">IBAN</span><span class="v mono">${esc(bank.iban)}</span><button type="button" class="copy-btn" data-copy="${esc(bank.iban)}">📋 ${L("Copy", "نسخ")}</button></li>
            </ul>
            <p class="calc-note">${L(bank.noteEn || bank.note, bank.note)}</p>
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
          <a class="btn btn-ghost" href="${u("/cart")}" style="width:100%">${L("Edit cart", "تعديل السلة")}</a>
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: Lraw("Checkout — Business Partner", "إتمام الطلب — بيزنس بارتنر"), desc: Lraw("Complete your order by bank transfer and upload your documents and the transfer receipt.", "أكمل طلبك عبر التحويل البنكي وارفع مستنداتك وإيصال التحويل."), active: "/cart", path: "/checkout", body });
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
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Send verification code", "أرسل رمز التحقق")}</button>
      </form>

      <form class="calc-form auth-form" id="otp-form" hidden>
        <p class="otp-lead">${L("We sent a 6-digit code to", "أرسلنا رمزاً من 6 أرقام إلى")} <strong id="otp-target"></strong></p>
        <div class="field"><label for="otp-code">${L("Verification code", "رمز التحقق")}</label>
          <input id="otp-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="______" style="letter-spacing:8px;text-align:center;font-size:1.3rem"></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Verify & create account", "تحقّق وأنشئ الحساب")}</button>
        <div class="otp-actions">
          <button type="button" class="linkbtn" id="otp-resend">${L("Resend code", "إعادة إرسال الرمز")}</button>
          <button type="button" class="linkbtn" id="otp-back">${L("Change email", "تغيير البريد")}</button>
        </div>
        <div class="form-success" id="otp-error" hidden style="background:#fdecec;border-color:#f3b6b6;color:#8a1f2b"></div>
      </form>

      <div class="auth-divider"><span>${L("or", "أو")}</span></div>
      <button type="button" class="btn btn-ghost nafath-btn" id="nafath-btn" disabled>
        ${I.shield}<span>${L("Sign in with Nafath (soon)", "الدخول عبر نفاذ (قريباً)")}</span></button>

      <p class="form-note">${L("New accounts are verified by an email code. SMS (OTP) and Nafath national sign-in are being connected next.", "الحسابات الجديدة تُوثّق برمز عبر البريد. رسائل الجوال (OTP) والدخول الوطني عبر نفاذ قيد الربط قريباً.")}</p>
    </div>

    <div class="account-dash" id="account-dash" hidden>
      <div class="dash-head">
        <div><h2 id="dash-hello">${L("Welcome", "مرحباً")}</h2><p id="dash-email" class="text-soft"></p></div>
        <button type="button" class="btn btn-ghost" id="logout-btn">${L("Sign out", "تسجيل الخروج")}</button>
      </div>
      <div class="dash-grid">
        <div class="dash-card"><h3>${L("My orders", "طلباتي")}</h3><div id="dash-orders"><p class="text-soft">${L("No orders yet.", "لا توجد طلبات بعد.")}</p></div>
          <a class="btn btn-ghost" href="${u("/services")}">${L("Browse services", "تصفّح الخدمات")}</a></div>
        <div class="dash-card"><h3>${L("My documents", "مستنداتي")}</h3><div id="dash-uploads"><p class="text-soft">${L("No uploads yet.", "لا توجد ملفات بعد.")}</p></div>
          <a class="btn btn-ghost" href="${u("/checkout")}">${L("Upload via an order", "ارفع عبر طلب")}</a></div>
      </div>
      <div class="callout" style="margin-top:24px"><span class="ico">💡</span><p>${L("This is a front-end preview. Secure partner accounts (Notion CRM + verification) are being connected.", ac.demoNote)}</p></div>
    </div>
  </div></section>`;
  return page({ title: Lraw("Client portal — Business Partner", "منصّة العملاء — بيزنس بارتنر"), desc: Lraw("Sign in to track your orders and documents with Business Partner.", "سجّل دخولك لمتابعة طلباتك ومستنداتك مع بيزنس بارتنر."), active: "/account", path: "/account", body });
}

function buildConsultation() {
  const b = site.booking;
  const topics = b.topics
    .map((tp) => `<option value="${esc(tp.key)}">${L(tp.en, tp.ar)}</option>`)
    .join("");
  const times = b.times.map((tm) => `<option value="${tm}">${tm}</option>`).join("");
  const steps = b.steps
    .map((s2) => `<div class="step"><div class="step-n">${esc(s2.n)}</div><div><h3>${L(s2.en, s2.ar)}</h3><p>${L(s2.enText, s2.arText)}</p></div></div>`)
    .join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Consultation", "استشارة")}</span>
    <h1>${L(b.titleEn, b.title)}</h1>
    <p class="lead">${L(b.leadEn, b.lead)}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="steps-grid" style="margin-bottom:36px">${steps}</div>
    <div class="booking-wrap">
      <form class="calc-form" id="booking-form" novalidate
        data-topics="${esc(b.topics.map((tp) => tp.key + "=" + (LANG === "ar" ? tp.ar : tp.en)).join("|"))}">
        <h2>${L("Book your appointment", "احجز موعدك")}</h2>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="bk-name">${L("Full name", "الاسم الكامل")}</label><input id="bk-name" type="text" required></div>
          <div class="field"><label for="bk-phone">${L("Mobile", "رقم الجوال")}</label><input id="bk-phone" type="tel" required placeholder="05xxxxxxxx"></div>
        </div>
        <div class="field"><label for="bk-email">${L("Email", "البريد الإلكتروني")}</label><input id="bk-email" type="email" required placeholder="name@example.com"></div>
        <div class="field"><label for="bk-topic">${L("Consultation topic", "موضوع الاستشارة")}</label>
          <select id="bk-topic">${topics}</select></div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="bk-date">${L("Preferred date", "التاريخ المفضّل")}</label><input id="bk-date" type="date" required></div>
          <div class="field"><label for="bk-time">${L("Preferred time (Riyadh)", "الوقت المفضّل (بتوقيت الرياض)")}</label>
            <select id="bk-time">${times}</select></div>
        </div>
        <div class="field"><label for="bk-notes">${L("Notes (optional)", "ملاحظات (اختياري)")}</label><textarea id="bk-notes" rows="3" placeholder="${Lraw("Briefly describe your case", "اشرح حالتك باختصار")}"></textarea></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.calendar}<span>${L("Confirm booking", "أكّد الحجز")}</span></button>
        <p class="form-note">${L("You'll receive an email confirmation with a Google Calendar link, and our consultant will contact you at the scheduled time.", "يصلك تأكيد على بريدك مع رابط إضافة الموعد إلى تقويم Google، ويتواصل معك مستشارنا في الموعد المحدد.")}</p>
        <div class="form-success" id="booking-success" hidden></div>
      </form>
      <aside class="booking-side">
        <div class="order-box">
          <h3>${L("What you get", "وش تستفيد")}</h3>
          <ul class="feat-list">
            <li>${I.check}<span>${L("A specialist consultant for your case", "مستشار مختص حسب موضوعك")}</span></li>
            <li>${I.check}<span>${L("A clear action plan and requirements list", "خطة عمل واضحة وقائمة متطلبات")}</span></li>
            <li>${I.check}<span>${L("Transparent pricing before you commit", "تسعير شفاف قبل أي التزام")}</span></li>
            <li>${I.check}<span>${L("First consultation is free", "الاستشارة الأولى مجانية")}</span></li>
          </ul>
          <p class="mini">${L("Prefer chatting? The smart agent replies 24/7.", "تفضّل المحادثة؟ الوكيل الذكي يرد 24/7.")}</p>
          ${waBtn2("Chat on WhatsApp", "تحدث على واتساب", "btn-ghost")}
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: Lraw("Book a consultation — Business Partner", "احجز استشارة — بيزنس بارتنر"), desc: Lraw(b.leadEn, b.lead), active: "/consultation", path: "/consultation", body });
}

function buildSuppliers() {
  const cats = [
    { en: "Events & conferences", ar: "فعاليات ومؤتمرات" },
    { en: "Halls & venues", ar: "قاعات ومواقع" },
    { en: "Catering & hospitality", ar: "ضيافة وكيترينق" },
    { en: "Outdoor activities", ar: "أنشطة خارجية" },
    { en: "Transport & logistics", ar: "نقل ولوجستيات" },
    { en: "Photography & media", ar: "تصوير وإعلام" },
    { en: "Corporate trips", ar: "رحلات شركات" },
    { en: "Other", ar: "أخرى" },
  ];
  const catOpts = cats.map((c2) => `<option>${L(c2.en, c2.ar)}</option>`).join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Suppliers portal", "بوابة الموردين")}</span>
    <h1>${L("Become a Business Partner supplier", "انضم كمورّد لدى بيزنس بارتنر")}</h1>
    <p class="lead">${L("We send our clients' event and service requests to registered suppliers and collect competing offers. Register once — receive matching requests.", "نرسل طلبات عملائنا (فعاليات وخدمات) للموردين المسجّلين ونجمع العروض المنافسة. سجّل مرة واحدة — وتصلك الطلبات المناسبة لنشاطك.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="booking-wrap">
      <form class="calc-form" id="supplier-form" novalidate>
        <h2>${L("Supplier registration", "تسجيل مورّد")}</h2>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="sp-company">${L("Company name", "اسم الشركة")}</label><input id="sp-company" type="text" required></div>
          <div class="field"><label for="sp-person">${L("Contact person", "الشخص المسؤول")}</label><input id="sp-person" type="text" required></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="sp-phone">${L("Mobile", "رقم الجوال")}</label><input id="sp-phone" type="tel" required placeholder="05xxxxxxxx"></div>
          <div class="field"><label for="sp-email">${L("Email", "البريد الإلكتروني")}</label><input id="sp-email" type="email" required></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="sp-city">${L("City", "المدينة")}</label><input id="sp-city" type="text" placeholder="${Lraw("Riyadh", "الرياض")}"></div>
          <div class="field"><label for="sp-cr">${L("CR number (optional)", "رقم السجل التجاري (اختياري)")}</label><input id="sp-cr" type="text"></div>
        </div>
        <div class="field"><label for="sp-cat">${L("Service category", "تصنيف الخدمة")}</label>
          <select id="sp-cat">${catOpts}</select></div>
        <div class="field"><label for="sp-notes">${L("Describe your services briefly", "اوصف خدماتك باختصار")}</label><textarea id="sp-notes" rows="3"></textarea></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Register as a supplier", "سجّل كمورّد")}</button>
        <p class="form-note">${L("We review registrations and contact you to complete onboarding.", "نراجع التسجيلات ونتواصل معك لاستكمال الانضمام.")}</p>
        <div class="form-success" id="supplier-success" hidden></div>
      </form>
      <aside class="booking-side">
        <div class="order-box">
          <h3>${L("Why join?", "ليش تنضم؟")}</h3>
          <ul class="feat-list">
            <li>${I.check}<span>${L("Ready corporate demand from our clients", "طلبات جاهزة من عملائنا (شركات)")}</span></li>
            <li>${I.check}<span>${L("You compete on clear, scoped requests", "تنافس على طلبات واضحة ومحددة")}</span></li>
            <li>${I.check}<span>${L("No registration fees", "بدون رسوم تسجيل")}</span></li>
            <li>${I.check}<span>${L("Direct WhatsApp/email coordination", "تنسيق مباشر عبر واتساب والبريد")}</span></li>
          </ul>
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: Lraw("Suppliers portal — Business Partner", "بوابة الموردين — بيزنس بارتنر"), desc: Lraw("Register as a Business Partner supplier and receive matching client requests.", "سجّل كمورّد لدى بيزنس بارتنر وتصلك طلبات العملاء المناسبة لنشاطك."), active: "/suppliers", path: "/suppliers", body });
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
  write(`${pre}compliance-calculators.html`, buildComplianceCalculators());
  write(`${pre}compliance-portal.html`, buildCompliancePortal());
  write(`${pre}saudi-arabia.html`, buildSaudi());
  write(`${pre}news.html`, buildNews());
  write(`${pre}careers.html`, buildCareers());
  write(`${pre}contact.html`, buildContact());
  write(`${pre}cart.html`, buildCart());
  write(`${pre}checkout.html`, buildCheckout());
  write(`${pre}account.html`, buildAccount());
  write(`${pre}consultation.html`, buildConsultation());
  write(`${pre}suppliers.html`, buildSuppliers());
  services.forEach((s) => write(`${pre}services/${s.slug}.html`, buildServiceDetail(s)));
  pageCount += 14 + services.length;
}
LANG = "en";

// sitemap.xml — both language trees
const base = "https://businesspartner.sa";
const paths = ["/", "/about", "/services", "/ai-agents", "/tourism", "/packages", "/calculator", "/compliance-calculators", "/compliance-portal", "/saudi-arabia", "/news", "/careers", "/contact", "/cart", "/checkout", "/account", "/consultation", "/suppliers"]
  .concat(services.map((s) => `/services/${s.slug}`));
const urls = paths
  .flatMap((p) => [p, p === "/" ? "/ar/" : "/ar" + p])
  .map((p) => `  <url><loc>${base}${p}</loc></url>`)
  .join("\n");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);

console.log(`Generated ${pageCount} pages (en + ar) + sitemap.`);
