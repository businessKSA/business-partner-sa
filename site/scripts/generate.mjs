// build-marker: force production rebuild for BP-RE-06 + real-estate nav (deploy 2)
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

// Copy connector brand logos (open-source CC0 marks) into the static output so
// the /connect and /portal pages can show real service logos.
{
  const logosFrom = path.join(ROOT, "..", "public", "logos");
  if (fs.existsSync(logosFrom)) {
    const to = path.join(ROOT, "assets/img/logos");
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(logosFrom)) {
      if (f.endsWith(".svg")) fs.copyFileSync(path.join(logosFrom, f), path.join(to, f));
    }
  }
}

const site = read("data/site.json");
const services = read("data/services.json");
const categories = read("data/categories.json");
const svcI18n = read("data/service-i18n.json");
// Saudi entrepreneurship-ecosystem directory (incubators, accelerators, VCs,
// angel networks, coworking) + their programs — sourced from our verified
// Notion research databases. Powers /directory.
const ecosystem = read("data/ecosystem.json");

// Business Partner's own open roles — an ATS-style job board on /careers,
// each with a single job page and an application routed through the same
// candidate form (job context carried via ?job= and hidden fields).
const JOBS = [
  {
    slug: "hr-operations-specialist",
    field: "موارد بشرية",
    tag: { en: "Riyadh · HR", ar: "الرياض · موارد بشرية" },
    title: { en: "HR Operations & Government Relations Specialist", ar: "أخصائي عمليات موارد بشرية وعلاقات حكومية" },
    summary: { en: "Run Qiwa, GOSI, Mudad, Muqeem and day-to-day HR operations for Business Partner clients.", ar: "إدارة قوى، التأمينات، مدد، مقيم، وعمليات الموارد البشرية اليومية لعملاء بيزنس بارتنر." },
    meta: { en: "Full-time · Saudi market experience · Arabic/English", ar: "دوام كامل · خبرة سوق سعودي · عربي/إنجليزي" },
    location: { en: "Riyadh, Saudi Arabia", ar: "الرياض، السعودية" },
    type: { en: "Full-time", ar: "دوام كامل" },
    responsibilities: {
      en: ["Manage HR government platforms including Qiwa, GOSI, Mudad and Muqeem.", "Prepare employee files, contracts, onboarding checklists and HR operations trackers.", "Support clients with Saudization, WPS notes, employee data updates and practical HR compliance.", "Coordinate with candidates, employers and Business Partner internal teams through the ATS."],
      ar: ["إدارة منصات قوى، التأمينات، مدد، ومقيم.", "تجهيز ملفات الموظفين والعقود وقوائم الأونبوردينج.", "دعم العملاء في التوطين، ملاحظات حماية الأجور، وتحديث بيانات الموظفين.", "تنسيق الطلبات بين المرشحين وأصحاب العمل وفريق بيزنس بارتنر داخل الـ ATS."],
    },
    requirements: {
      en: ["Hands-on Saudi HR operations or government relations experience.", "Arabic fluency and working English.", "Comfort with digital platforms, spreadsheets, candidate tracking and client follow-up."],
      ar: ["خبرة عملية في عمليات الموارد البشرية أو العلاقات الحكومية في السعودية.", "إجادة العربية ومعرفة عملية بالإنجليزية.", "قدرة على استخدام المنصات الرقمية والجداول وأنظمة متابعة المرشحين."],
    },
  },
  {
    slug: "recruitment-coordinator",
    field: "موارد بشرية",
    tag: { en: "Riyadh / Hybrid · Recruitment", ar: "الرياض / هجين · توظيف" },
    title: { en: "Recruitment Coordinator", ar: "منسق توظيف" },
    summary: { en: "Coordinate candidate sourcing, screening, interviews, offer follow-up, and employer communication.", ar: "تنسيق الاستقطاب، فرز السير، المقابلات، المتابعة مع أصحاب العمل والمرشحين." },
    meta: { en: "Full-time · Hiring pipeline · Candidate care", ar: "دوام كامل · ATS · عناية بالمرشحين" },
    location: { en: "Riyadh, Saudi Arabia (hybrid)", ar: "الرياض، السعودية (هجين)" },
    type: { en: "Full-time", ar: "دوام كامل" },
    responsibilities: {
      en: ["Source and screen candidates against open roles across the ATS.", "Schedule and coordinate interviews between candidates and employers.", "Keep candidate pipeline stages and notes up to date.", "Follow up on offers and onboarding handoff."],
      ar: ["استقطاب وفرز المرشحين مقابل الوظائف المفتوحة عبر الـ ATS.", "جدولة وتنسيق المقابلات بين المرشحين وأصحاب العمل.", "تحديث مراحل وملاحظات المرشحين في المسار أولاً بأول.", "متابعة العروض الوظيفية وتسليم ملف الأونبوردينج."],
    },
    requirements: {
      en: ["Prior recruitment or talent acquisition coordination experience.", "Strong communication in Arabic and English.", "Detail-oriented, comfortable juggling multiple open roles at once."],
      ar: ["خبرة سابقة في تنسيق التوظيف أو استقطاب المواهب.", "تواصل قوي بالعربية والإنجليزية.", "دقة في التفاصيل والقدرة على متابعة أكثر من وظيفة مفتوحة في آن واحد."],
    },
  },
];

// Client hiring campaign — events fabrication workshop for an entertainment &
// events services provider (client kept anonymous on the public site; salaries
// are client-confidential and not published). Role content and openings live
// in data/workshop-jobs.json; every role gets its own /jobs/<slug> page with
// an application scoped to that posting (same ATS flow as JOBS above), plus a
// campaign hub page at /jobs/<campaign.slug> grouping roles by department.
const workshop = read("data/workshop-jobs.json");
const WORKSHOP_JOBS = workshop.jobs;
const WORKSHOP_CAMPAIGN = workshop.campaign;

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
// Compliance Agent subscribers sign in to this site's unified AI-employees
// portal (/portal) with the email + access code (رمز الدخول) they receive on
// activation — /api/requests resolves the code against the Compliance Intake
// DB and unlocks Mishari for them. (The legacy Astro dashboard that used to
// live at businesspartner.sa/ar/portal was removed when the domain moved to
// this site — a hardcoded absolute link here used to land compliance clients
// in the specialized-team portal with a code it didn't recognize.)
const COMPLIANCE_PORTAL_URL = "/ar/compliance-dashboard";
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
  cycle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M3 16v4h4M21 8V4h-4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.5l.5-3h-3V8.6c0-.87.24-1.46 1.5-1.46H16.6V4.5c-.28-.04-1.23-.12-2.34-.12-2.31 0-3.9 1.41-3.9 4v2.12H7.9v3h2.46V21h3.14z"/></svg>',
};

/* ---------- multilingual build-time engine ----------
   The whole site is generated once per language: English (LANG='en') at root
   paths, Arabic (LANG='ar') under /ar/, and 7 more world languages under
   their own prefix (/fr/, /es/, /zh/, /ru/, /hi/, /ko/, /ja/). L(en, ar)
   keeps working exactly as before for English/Arabic (zero behavior change
   there); for the extra languages it looks up the English string in
   TRANSLATIONS[LANG] and falls back to English when no translation exists
   yet — so pages never break or go blank, they just show English for
   anything not yet translated. Only a core set of pages (EXTRA_LANG_PATHS)
   is generated for the extra languages so far; u() routes any other link
   back to the English URL instead of a 404 in that language. */
let LANG = "en";
const EXTRA_LANGS = ["fr", "es", "zh", "ru", "hi", "ko", "ja"];
const ALL_LANGS = ["en", "ar", ...EXTRA_LANGS];
const LANG_NAMES = { en: "English", ar: "العربية", fr: "Français", es: "Español", zh: "中文", ru: "Русский", hi: "हिन्दी", ko: "한국어", ja: "日本語" };
const LANG_LOCALE = { en: "en_US", ar: "ar_SA", fr: "fr_FR", es: "es_ES", zh: "zh_CN", ru: "ru_RU", hi: "hi_IN", ko: "ko_KR", ja: "ja_JP" };
// Pages generated for the extra languages that AREN'T fully translated yet
// (site chrome + homepage + the main discovery pages). Everything else still
// exists only in en/ar for those languages; u() below sends visitors to the
// English URL instead of a 404. Languages in FULLY_READY_LANGS skip this
// restriction entirely and get every page, same as en/ar.
const EXTRA_LANG_PATHS = new Set(["/", "/about", "/services", "/packages", "/contact"]);
// Extra languages with a complete, reviewed translation of every page —
// added one at a time as each is finished. See docs/i18n-status.md.
const FULLY_READY_LANGS = ["fr"];
// A handful of pages (the internal AI-employee/portal tools) are hand-written
// once for ar/en only — they're never part of the per-language build loop,
// so even a "fully ready" language must not get a prefixed link to them.
const NEVER_EXTRA_LANG_PATHS = new Set(["/connect", "/portal"]);
const langPathReady = (lang, path) => !NEVER_EXTRA_LANG_PATHS.has(path) && (FULLY_READY_LANGS.includes(lang) || EXTRA_LANG_PATHS.has(path));
import { TRANSLATIONS } from "./i18n.mjs";
function T(en) {
  const dict = TRANSLATIONS[LANG];
  return (dict && dict[en]) || en;
}
const L = (en, ar) => {
  if (LANG === "ar") return esc(ar);
  if (LANG === "en") return esc(en);
  return esc(T(en));
};
// Raw (unescaped) variant for when the caller needs plain text (title/desc/attributes).
const Lraw = (en, ar) => {
  if (LANG === "ar") return ar;
  if (LANG === "en") return en;
  return T(en);
};
// Arabic numeral-noun agreement: 1 → singular ("خدمة"), 2 → dual ("خدمتان"),
// 3-10 → plural ("خدمات"), 11+ → singular again (classical counted-noun rule).
function arCount(n, singular, dual, plural) {
  if (n === 1) return singular;
  if (n === 2) return dual;
  if (n >= 3 && n <= 10) return plural;
  return singular;
}
// English count-noun agreement helper (1 → singular, else plural).
function enCount(n, singular, plural) {
  return n === 1 ? singular : plural;
}
// Internal-link prefixer: keeps external/anchor/asset links untouched, and
// (for the 7 extra languages) falls back to the English URL for any page
// not yet built in that language, instead of linking to a 404.
const u = (href) => {
  if (LANG === "en") return href;
  if (!href || href[0] !== "/" || href.startsWith("/assets") || href.startsWith("/api")) return href;
  if (ALL_LANGS.some((l) => l !== "en" && (href === "/" + l || href.startsWith("/" + l + "/")))) return href; // already prefixed
  const bare = href === "/" ? "/" : href.split("#")[0].split("?")[0];
  const hash = href.includes("#") ? "#" + href.split("#")[1] : "";
  if (LANG !== "ar" && !langPathReady(LANG, bare)) return href; // not built yet in this language
  return (bare === "/" ? `/${LANG}/` : `/${LANG}${bare}`) + hash;
};

// Standalone HR portal (hr.businesspartner.sa) — Arabic-first canonical paths
// ("/", "/join", "/dashboard", "/candidates"); English lives under "/en/...".
// Kept fully separate from the main site's nav/footer/services.
// Absolute (not root-relative) because these same pages are also reachable
// under the main site's /portal/... paths (e.g. linked from /account) — a
// root-relative "/join" would 404 there, since the vercel.json rewrite that
// makes "/join" resolve only applies on the hr.businesspartner.sa host.
const pu = (short) => "https://hr.businesspartner.sa" + (LANG === "ar" ? short : "/en" + (short === "/" ? "" : short));
const PORTAL_LINKS = [
  { href: "/", en: "Home", ar: "الرئيسية" },
  { href: "/join", en: "For Employers", ar: "لأصحاب الأعمال" },
  { href: "/dashboard", en: "Dashboard", ar: "لوحة التوظيف" },
  { href: "/candidates", en: "For Candidates", ar: "للباحثين عن عمل" },
];
function portalLangToggle(active) {
  // Absolute for the same reason as pu() above: these pages are also reachable
  // under the main site's /portal/... paths, where a root-relative "/join" 404s.
  const other = "https://hr.businesspartner.sa" + (LANG === "ar" ? "/en" + (active === "/" ? "" : active) : active);
  return `<a class="lang-toggle" href="${other}">${LANG === "ar" ? "English" : "العربية"}</a>`;
}
function portalHeader(active) {
  const nav = PORTAL_LINKS.map((l) => `<a href="${pu(l.href)}"${l.href === active ? ' class="active"' : ""}>${L(l.en, l.ar)}</a>`).join("");
  return `<header class="site-header portal-header"><div class="container header-inner">
  <a class="logo" href="${pu("/")}" aria-label="Business Partner HR" style="display:flex;align-items:center;gap:10px">
    <img src="/assets/img/logo.png" alt="Business Partner" width="150" height="28">
    <span style="font-size:.78rem;font-weight:700;color:var(--brand);background:var(--bg-soft);padding:3px 10px;border-radius:999px">${L("HR Portal", "بوابة الموارد البشرية")}</span>
  </a>
  <nav class="nav" aria-label="Portal navigation">${nav}</nav>
  <div class="header-cta">${portalLangToggle(active)}</div>
</div></header>`;
}
function portalFooter() {
  const c = site.contact;
  return `<footer class="site-footer portal-footer"><div class="container">
  <div class="footer-grid" style="grid-template-columns:1fr auto;gap:24px">
    <div>
      <div class="footer-logo"><img src="/assets/img/logo.png" alt="Business Partner" width="140" height="26"></div>
      <p>${L("HR by Business Partner — a standalone recruitment portal.", "الموارد البشرية من بزنس بارتنر — بوابة توظيف مستقلة.")}</p>
    </div>
    <div class="footer-col"><h4>${L("Contact", "تواصل")}</h4><ul>
      <li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
    </ul></div>
  </div>
  <div class="footer-bottom"><span>${L("© " + new Date().getFullYear() + " Business Partner · All rights reserved", "© " + new Date().getFullYear() + " بيزنس بارتنر · جميع الحقوق محفوظة")}</span></div>
</div></footer>`;
}
function portalPage({ title, desc, path, active, body }) {
  return head(title, desc, path) + portalHeader(active) + `<main>${body}</main>` + portalFooter() + waFab() + `<script src="/assets/js/main.js?v=${JS_V}"></script></body></html>`;
}
// Service name in the current build language (bilingual map → override → catalog).
function sName(s) {
  const m = svcI18n[s.code] || {};
  const ov = site.overrides[s.slug];
  if (LANG === "ar") return m.ar || (ov && ov.name) || s.name;
  if (LANG === "en") return m.en || (ov && ov.nameEn) || s.name;
  // Extra languages: their own translated name if service-i18n.json has one
  // yet, else the English name (never Arabic — this tree is non-Arabic).
  return m[LANG] || m.en || (ov && ov.nameEn) || s.name;
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
  return Lraw("Business Partner handles “{name}” on your behalf within {category} — from preparing the documents and filing with the relevant authority through to issuance, with clear fees and full follow-up.", "")
    .replace("{name}", sName(s))
    .replace("{category}", Lraw(catEn(s.category), catAr(s.category)));
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
    .replace("ابتداءً من", "From")
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

// Owner policy: no WhatsApp buttons in page content — only the floating
// bottom WhatsApp button (waFab) stays. These helpers now route to booking a
// consultation instead, with a calendar icon (no WhatsApp icon/link).
const waBtn = (label, cls = "btn-primary", lg = false) =>
  `<a class="btn ${cls === "btn-wa" ? "btn-primary" : cls}${lg ? " btn-lg" : ""}" href="${u("/consultation")}">${I.calendar}<span>${esc(label)}</span></a>`;
const waBtn2 = (en, ar, cls = "btn-primary", lg = false) =>
  `<a class="btn ${cls === "btn-wa" ? "btn-primary" : cls}${lg ? " btn-lg" : ""}" href="${u("/consultation")}">${I.calendar}<span>${L(en, ar)}</span></a>`;

// Parse a leading numeric amount out of a price label like "1,500 ﷼ / شهرياً" or "يبدأ من 10,000 ﷼".
const parseAmount = (str) => {
  const m = String(str || "").replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

// Map an item kind to the closest consultation topic (for price-less items).
const KIND_TOPIC = { package: "other", agent: "ai", misa: "misa", service: "other" };
// Priced items → "Add to cart". Price-less items → "Book a consultation" (there is
// no price to pay online, so we route the client to a booking + simple form).
function cartBtns({ id, nameEn, nameAr, amount, priceLabel, kind = "service", ghost = false, surchargeAmount, surchargeFreeCount }) {
  if (amount == null) {
    const topic = KIND_TOPIC[kind] || "other";
    const about = encodeURIComponent(LANG === "ar" ? nameAr : (nameEn || nameAr));
    return `<div class="buy-row">
    <a class="btn ${ghost ? "btn-ghost" : "btn-primary"}" href="${u("/consultation")}?topic=${topic}&about=${about}">${I.calendar}<span>${L("Book a consultation", "احجز استشارة")}</span></a>
  </div>`;
  }
  // Keep data-id ASCII (ids may be built from Arabic names) and localize the shown price label.
  const safeId = /[^\x00-\x7F]/.test(String(id)) ? asciiId(kind, id) : id;
  const surData = surchargeAmount != null ? ` data-surcharge-amount="${surchargeAmount}" data-surcharge-free="${surchargeFreeCount || 0}"` : "";
  const data = `data-id="${esc(safeId)}" data-name-en="${esc(nameEn || nameAr)}" data-name-ar="${esc(nameAr)}" data-amount="${amount}" data-price="${esc(localizeLabel(priceLabel || ""))}" data-kind="${esc(kind)}"${surData}`;
  return `<div class="buy-row">
    <button type="button" class="btn ${ghost ? "btn-ghost" : "btn-primary"} add-cart" ${data}>${I.cart}<span>${L("Add to cart", "أضف إلى السلة")}</span></button>
  </div>`;
}

/* ---------- layout ---------- */
// URL of the same page (by canonical/English path) in a given language.
function pathInLang(path, lang) {
  const p = path || "/";
  if (lang === "en") return p;
  return p === "/" ? `/${lang}/` : `/${lang}${p}`;
}
function head(title, desc, path) {
  const canonical = path || "/";
  const langsForPage = ["en", "ar", ...EXTRA_LANGS.filter((l) => langPathReady(l, canonical))];
  const hreflangs = langsForPage.map((l) => `<link rel="alternate" hreflang="${l}" href="${pathInLang(canonical, l)}">`).join("\n");
  return `<!DOCTYPE html>
<html lang="${LANG}" dir="${LANG === "ar" ? "rtl" : "ltr"}"${SHOW_PRICES ? "" : ' data-prices="off"'}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/assets/img/cover.png">
<meta property="og:locale" content="${LANG_LOCALE[LANG] || "en_US"}">
<meta name="theme-color" content="#0B1B5A">
<meta name="generator" content="Business Partner 3.0 Website">
${hreflangs}
<link rel="alternate" hreflang="x-default" href="${pathInLang(canonical, "en")}">
<script>/* language persistence: remember the visitor's chosen language and keep it across navigation (only changes when they pick another language) */(function(){try{document.addEventListener("click",function(e){var t=e.target;while(t&&t.nodeType===1){var dl=t.getAttribute&&t.getAttribute("data-lang");if(dl){try{localStorage.setItem("bp_lang",dl);}catch(_){}break;}t=t.parentNode;}},true);var s=localStorage.getItem("bp_lang");if(!s)return;var c=document.documentElement.getAttribute("lang")||"en";if(s===c)return;var a=document.querySelector('link[rel="alternate"][hreflang="'+s+'"]');if(a&&a.href){var to=a.href.split("#")[0].replace(/\\/$/,""),cur=location.href.split("#")[0].replace(/\\/$/,"");if(to!==cur)location.replace(a.href);}}catch(e){}})();</script>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/styles.css?v=${CSS_V}">
${SHOW_PRICES ? "" : '<style>/* Owner policy: never reveal any price. Safety net for pure-price elements incl. JS-populated ones. */.tr-price,.price-amt,.emp-price,.emp-price-m,.emp-price-y,.pk-per,.emp-billing-toggle,.cart-totals-block{display:none!important}</style>'}
</head>
<body>`;
}

const NAV_GROUPS = [
  { href: "/", en: "Home", ar: "الرئيسية" },
  { href: "/about", en: "About us", ar: "من نحن" },
  {
    en: "Our services", ar: "خدماتنا",
    items: [
      { href: "/services", en: "Government Consulting Services", ar: "خدمة الاستشارات الحكومية", megaCategories: true },
      { href: "/packages", en: "Packages", ar: "الباقات", megaPackages: true },
      {
        href: "/ai-agents", en: "AI Agents ⚡", ar: "الوكلاء الأذكياء ⚡",
        sub: [
          { href: "/ai-agents", en: "All AI Agents", ar: "كل الوكلاء الأذكياء" },
          { href: "/compliance-agent", en: "Compliance", ar: "الامتثال" },
          { href: "/portal", en: "Smart Employees", ar: "الموظفين الأذكياء" },
          { href: "/shared-services", en: "Shared Services Team", ar: "فريق الخدمات المشتركة" },
        ],
      },
      // Promoted out of the categories flyout to a top-level services item (owner request).
      { href: "/services/category/ai-automation", en: "AI & Automation ⚡", ar: "الأتمتة والذكاء الاصطناعي ⚡" },
      { href: "/task-force", en: "Task Force ⚡", ar: "تاسك فورس ⚡" },
      {
        href: "/hr", en: "Recruitment", ar: "التوظيف",
        sub: [
          { href: "/hr", en: "Recruitment services", ar: "خدمات التوظيف" },
          { href: "/employers", en: "For employers", ar: "لأصحاب العمل" },
          { href: "/careers", en: "Open jobs", ar: "الوظائف المتاحة" },
        ],
      },
      { href: "/deals", en: "Deals ⚡", ar: "الصفقات ⚡" },
      { href: "/estrdad", en: "Fee refunds (Estrdad) ⚡", ar: "استرداد الرسوم ⚡" },
      { href: "/bank-account", en: "Corporate bank account ⚡", ar: "فتح حساب بنكي ⚡" },
      { href: "/formation-contract", en: "Formation with partners ⚡", ar: "تأسيس بين شركاء ⚡" },
      {
        href: "/mahfol-makfol", en: "Business Tourism", ar: "سياحة الأعمال",
        sub: [
          { href: "/mahfol-makfol", en: "For investors", ar: "للمستثمر" },
          { href: "/mahfol-makfol/trips", en: "Trips & experiences", ar: "الرحلات والتجارب" },
          { href: "/tourism", en: "Corporate events", ar: "فعاليات الشركات" },
        ],
      },
      {
        href: "/workspaces", en: "Business Spaces", ar: "مساحات الأعمال",
        sub: [
          { href: "/workspaces", en: "Browse spaces", ar: "استعراض المساحات" },
          { href: "/workspace-request", en: "Request a workspace", ar: "اطلب مساحة عمل" },
          { href: "/services/bp-re-01", en: "Private office", ar: "مكتب خاص" },
          { href: "/services/bp-re-02", en: "Coworking space", ar: "مساحة عمل مشتركة" },
          { href: "/services/bp-re-03", en: "Virtual office + National Address", ar: "مكتب افتراضي مع عنوان وطني" },
          { href: "/services/bp-re-04", en: "Dedicated desk", ar: "مكتب ثابت في مساحة مشتركة" },
          { href: "/services/bp-re-05", en: "Office search service", ar: "خدمة البحث عن مكتب" },
          { href: "/services/bp-re-06", en: "Foreign property ownership", ar: "تملّك العقار للأجانب" },
        ],
      },
      {
        href: "/worker-housing", en: "Worker Housing ⚡", ar: "تسكين العمالة ⚡",
        sub: [
          { href: "/worker-housing", en: "Overview", ar: "نظرة عامة" },
          { href: "/worker-housing#wh-request", en: "Request housing", ar: "اطلب سكن لعمالتك" },
          { href: "/worker-housing#wh-fines", en: "Regulations & fines", ar: "الاشتراطات والغرامات" },
          { href: "/services/bp-housing-01", en: "Licensing service", ar: "خدمة الترخيص والتوثيق" },
          { href: "/services/bp-housing-02", en: "Worker transport", ar: "نقل العمالة" },
        ],
      },
    ],
  },
  {
    en: "Knowledge Center", ar: "مركز المعرفة",
    items: [
      {
        href: "/saudi-arabia", en: "Saudi Guide", ar: "دليل السعودية",
        sub: [
          { href: "/saudi-arabia", en: "Invest in Saudi", ar: "الاستثمار في السعودية" },
          { href: "/guide/saudi-market", en: "The Saudi Market", ar: "السوق السعودي" },
          { href: "/guide/business-setup", en: "Business Setup", ar: "تأسيس الأعمال" },
          { href: "/guide/run-your-business", en: "Run Your Business", ar: "تشغيل عملك" },
          { href: "/directory", en: "Entrepreneurship guide", ar: "دليل ريادة الأعمال" },
          { href: "/guide/live-in-saudi", en: "Live in Saudi", ar: "الحياة في السعودية" },
          { href: "/guide/residency", en: "Residency in KSA", ar: "الإقامة في السعودية" },
        ],
      },
      { href: "/opportunities", en: "Investment Opportunities", ar: "الفرص الاستثمارية" },
      { href: "/news", en: "Insights & news", ar: "الرؤى والأخبار" },
      { href: "/newsletter", en: "Newsletter", ar: "النشرة الإخبارية" },
    ],
  },
  { href: "/contact", en: "Contact us", ar: "تواصل معنا" },
];

// Only en/ar + FULLY_READY_LANGS are shown in the language switcher. The
// remaining extra languages are only partially translated — even the 5
// pages built for them mix in untranslated English strings — so offering
// them as a finished option in the UI does more harm than good. Their
// pages/routes still exist (reachable by direct URL) for whenever that work
// is finished; they're just not advertised in the switcher until then.
// Every language here must always be fully built for every path (true for
// en/ar, and true for FULLY_READY_LANGS by construction) — langMenu links
// straight to the same path in that language with no existence check.
const VISIBLE_LANGS = ["en", "ar", ...FULLY_READY_LANGS];
function langMenu(path) {
  const items = VISIBLE_LANGS.map((l) => `<a href="${pathInLang(path, l)}" data-lang="${l}"${l === LANG ? ' class="active"' : ""}>${LANG_NAMES[l]}</a>`).join("");
  return `<div class="nav-group lang-group">
    <button type="button" class="nav-drop lang-drop" aria-expanded="false" aria-label="Switch language / تبديل اللغة">${saudiFlag}<span class="lang-label">${LANG_NAMES[LANG]}</span>${I.chevron}</button>
    <div class="nav-menu">${items}</div>
  </div>`;
}

// Renders one entry inside a top-level nav-group's dropdown. Plain items are
// a link; items flagged megaCategories/megaPackages or carrying a static
// `sub` array become a second-level flyout (nav-group.nested) so the mobile
// accordion CSS — which already flattens any .nav-drop/.nav-menu pair once
// .nav.open is set, at any nesting depth — keeps working with no changes.
function navSubItem(it, active) {
  let sub = it.sub;
  if (it.megaCategories) {
    // AI Automation is promoted to its own top-level services item; Real Estate
    // is surfaced via the top-level "Business Spaces" item — both are excluded
    // here to avoid duplicate entries in the categories flyout (owner request).
    const NAV_HIDE_CATS = ["AI Automation", "Real Estate"];
    sub = [{ href: u("/services"), en: `All services (${services.length})`, ar: `كل الخدمات (${services.length})`, raw: true }]
      .concat(categories.filter((c) => !NAV_HIDE_CATS.includes(c.key)).map((c) => ({ href: catUrl(c.key), en: catEn(c.key), ar: c.ar, icon: CAT_ICON[c.key] || "📁", raw: true })));
  } else if (it.megaPackages) {
    sub = [{ href: u("/packages"), en: "All packages", ar: "كل الباقات", raw: true }]
      .concat((site.packages.groups || []).map((g) => ({ href: u("/packages") + "#pkg-" + g.key, en: g.en, ar: g.ar, raw: true })));
  }
  if (!sub) {
    return `<a href="${u(it.href)}"${it.href === active ? ' class="active"' : ""}>${L(it.en, it.ar)}</a>`;
  }
  const isActive = sub.some((s) => (s.raw ? false : s.href) === active) || it.href === active;
  const subLinks = sub.map((s) => {
    const href = s.raw ? s.href : u(s.href);
    return `<a href="${href}"${!s.raw && s.href === active ? ' class="active"' : ""}>${s.icon ? s.icon + " " : ""}${L(s.en, s.ar)}</a>`;
  }).join("");
  return `<div class="nav-group nested${isActive ? " active" : ""}">
    <button type="button" class="nav-drop${isActive ? " active" : ""}" aria-expanded="false">${L(it.en, it.ar)} ${I.chevron}</button>
    <div class="nav-menu">${subLinks}</div>
  </div>`;
}

function header(active, path) {
  const links = NAV_GROUPS.map((g) => {
    if (g.href) {
      return `<a href="${u(g.href)}"${g.href === active ? ' class="active"' : ""}>${L(g.en, g.ar)}</a>`;
    }
    const isActive = g.items.some((it) => it.href === active || (it.sub || []).some((s) => s.href === active));
    const menu = g.items.map((it) => navSubItem(it, active)).join("");
    return `<div class="nav-group${isActive ? " active" : ""}">
      <button type="button" class="nav-drop${isActive ? " active" : ""}" aria-expanded="false">${L(g.en, g.ar)} ${I.chevron}</button>
      <div class="nav-menu">${menu}</div>
    </div>`;
  }).join("");
  return `<header class="site-header"><div class="container header-inner">
  <a class="logo" href="${u("/")}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <nav class="nav" aria-label="Main navigation">${links}</nav>
  <div class="header-cta">
    ${langMenu(path)}
    <a class="hdr-btn" data-account-link href="${u("/account")}" aria-label="${Lraw("Sign in", "تسجيل الدخول")}">${I.user}<span class="hdr-btn-t" data-account-label>${L("Sign in", "تسجيل الدخول")}</span></a>
    <a class="hdr-btn hdr-btn--partners" href="${u("/suppliers")}" aria-label="${Lraw("Partners registration", "تسجيل الشركاء")}">${I.users}<span class="hdr-btn-t">${L("Partners", "تسجيل الشركاء")}</span></a>
    <a class="icon-btn cart-link" href="${u("/cart")}" aria-label="${Lraw("Cart", "السلة")}">${I.cart}<span class="cart-badge" id="cart-badge" hidden>0</span></a>
    <button class="nav-toggle" aria-label="${Lraw("Menu", "القائمة")}" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
  </div>
</div></header>`;
}

function footer() {
  const c = site.contact;
  const fl = (href, en, ar) => `<li><a href="${u(href)}">${L(en, ar)}</a></li>`;
  return `<footer class="site-footer"><div class="container">
  <div class="newsletter-band">
    <div class="nl-copy">
      <h3>${L("Subscribe to our newsletter", "اشترك في نشرتنا الإخبارية")}</h3>
      <p>${L("The latest business & regulatory news in Saudi Arabia — weekly, in both Arabic and English, straight to your inbox.", "آخر أخبار الأعمال والأنظمة في السعودية — أسبوعياً بالعربية والإنجليزية مباشرة إلى بريدك.")}</p>
    </div>
    <form class="newsletter-form" data-nl>
      <input type="email" placeholder="${Lraw("Your email", "بريدك الإلكتروني")}" aria-label="${Lraw("Email", "البريد الإلكتروني")}" data-nl-email required>
      <button type="submit" class="btn btn-white">${L("Subscribe now", "اشترك الآن")}</button>
    </form>
    <p class="nl-msg" data-nl-msg hidden></p>
  </div>
  <div class="footer-grid">
    <div>
      <div class="footer-logo"><img src="/assets/img/logo.png" alt="Business Partner" width="160" height="30"></div>
      <p>${L(site.brand.shortBioEn || site.brand.shortBio, site.brand.shortBio)}</p>
      <p class="footer-tag">${L("Partnering for your success", "شركاء نجاحك")}</p>
    </div>
    <div class="footer-col"><h4>${L("Our services", "خدماتنا")}</h4><ul>
      ${fl("/services", "All services", "كل الخدمات")}
      ${fl("/packages", "Packages", "الباقات")}
      ${fl("/ai-agents", "AI Agents", "الوكلاء الأذكياء")}
      ${fl("/task-force", "Task Force", "تاسك فورس")}
      ${fl("/hr", "Recruitment", "التوظيف")}
      ${fl("/deals", "Deals", "الصفقات")}
      ${fl("/mahfol-makfol", "Business Tourism", "سياحة الأعمال")}
      ${fl("/workspaces", "Business Spaces", "مساحات الأعمال")}
      ${fl("/worker-housing", "Worker Housing", "تسكين العمالة")}
    </ul></div>
    <div class="footer-col"><h4>${L("Platforms & portals", "المنصات والبوابات")}</h4><ul>
      ${fl("/account", "Client portal", "منصّة العملاء")}
      ${fl("/suppliers", "Partners portal", "بوابة الشركاء")}
      ${fl("/employer-join", "For employers", "لأصحاب العمل")}
      ${fl("/portal", "Smart employees portal", "بوابة الموظفين الأذكياء")}
    </ul></div>
    <div class="footer-col"><h4>${L("Knowledge Center", "مركز المعرفة")}</h4><ul>
      ${fl("/saudi-arabia", "Invest in Saudi", "الاستثمار في السعودية")}
      ${fl("/opportunities", "Investment Opportunities", "الفرص الاستثمارية")}
      ${fl("/directory", "Startup Ecosystem Directory", "دليل ريادة الأعمال")}
      ${fl("/tools-and-calculators", "Tools & calculators", "الأدوات والحاسبات")}
      ${fl("/news", "Insights & news", "الرؤى والأخبار")}
      ${fl("/magazine", "Magazine (PDF)", "المجلة (PDF)")}
      ${fl("/newsletter", "Newsletter", "النشرة الإخبارية")}
    </ul></div>
    <div class="footer-col"><h4>${L("Company", "الشركة")}</h4><ul>
      ${fl("/about", "About us", "من نحن")}
      ${fl("/careers", "Careers", "الوظائف")}
      ${fl("/terms", "Terms & Conditions", "الشروط والأحكام")}
      ${fl("/contact", "Contact us", "اتصل بنا")}
    </ul></div>
    <div class="footer-col"><h4>${L("Contact", "تواصل")}</h4><ul class="footer-contact">
      <li>${I.phone}<span>${esc(c.phone)}</span></li>
      <li>${I.mail}<span>${esc(c.email)}</span></li>
      <li>${I.pin}<span>${L(c.addressEn || c.address, c.address)}</span></li>
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

// باهر — صورة صاحب الموقع الحقيقية (بدل الرسمة). span بنفس كلاس kh-avatar حتى
// تنطبق مقاسات الودجت، مع موجات صوت تظهر أثناء نطق الرد (كلاس talking).
function khaledSvg() {
  return `<span class="kh-avatar kh-photo" aria-hidden="true"><img src="/assets/img/baher.jpg" alt="" loading="lazy"></span>`;
}

function advisorWidget() {
  return `<div class="advisor-teaser" id="advisor-teaser" hidden>
    <button class="advisor-teaser-close" id="advisor-teaser-close" aria-label="${Lraw("Close", "إغلاق")}">✕</button>
    <p>${L("Hi 👋 I'm Baher, your smart assistant. Questions about formation or government platforms?", "حياك الله 👋 أنا باهر، مساعدك الذكي. عندك سؤال عن التأسيس أو المنصات الحكومية؟")}</p>
  </div>
  <button class="advisor-fab" id="advisor-fab" aria-label="${Lraw("Open chat with Baher, the smart assistant", "افتح المحادثة مع باهر، المساعد الذكي")}">
    <span class="advisor-fab-avatar">${khaledSvg("fab")}<span class="advisor-dot" aria-hidden="true"></span></span>
    <span class="lbl">${L("Ask Baher", "اسأل باهر")}</span>
  </button>
  <section class="advisor-panel" id="advisor-panel" hidden role="dialog" aria-label="${Lraw("Ask Baher", "اسأل باهر")}">
    <header class="advisor-head">
      <button class="advisor-back" id="advisor-back" aria-label="${Lraw("Back", "رجوع")}" hidden>${I.arrow}</button>
      <div class="advisor-title"><span class="advisor-head-avatar">${khaledSvg("head")}</span><div><strong>${L("Baher", "باهر")}</strong><span><i class="advisor-online" aria-hidden="true"></i><span id="advisor-status">${L("Your smart partner — online now", "شريكك الذكي — متصل الآن")}</span></span></div></div>
      <button class="advisor-close" id="advisor-close" aria-label="${Lraw("Close", "إغلاق")}">${I.close}</button>
    </header>

    <!-- Step 1: contact intake (required first) -->
    <div class="advisor-view" id="advisor-intake">
      <div class="adv-intake-hd">${L("Welcome 👋 First, tell us about yourself so we can serve you and follow up on your request.", "أهلاً بك 👋 أولاً عرّفنا بنفسك حتى نخدمك ونتابع طلبك.")}</div>
      <input class="adv-in" id="adv-in-name" type="text" placeholder="${Lraw("Full name *", "الاسم الكامل *")}" autocomplete="name">
      <input class="adv-in" id="adv-in-phone" type="tel" placeholder="${Lraw("Mobile 05XXXXXXXX *", "الجوال 05XXXXXXXX *")}" autocomplete="tel">
      <input class="adv-in" id="adv-in-email" type="email" placeholder="${Lraw("Email *", "البريد الإلكتروني *")}" autocomplete="email">
      <button type="button" class="adv-primary" id="advisor-intake-go">${L("Start ›", "ابدأ ›")}</button>
      <div class="adv-err" id="adv-intake-err" hidden></div>
      <p class="adv-note">🔒 ${L("Your details are used only to serve you and follow up on your request.", "بياناتك تُستخدم فقط لخدمتك ومتابعة طلبك.")}</p>
    </div>

    <!-- Step 2: home — service windows (main → sub) -->
    <div class="advisor-view" id="advisor-home" hidden>
      <div class="adv-home-hd" id="advisor-hello"></div>
      <div class="adv-home-sub">${L("Pick the service you need:", "اختر الخدمة التي تحتاجها:")}</div>
      <div class="adv-cats" id="advisor-cats"><div class="adv-loading">${L("Loading services…", "جارٍ تحميل الخدمات…")}</div></div>
      <button type="button" class="adv-book-open" id="advisor-book-open">📅 ${L("Book a free consultation", "احجز استشارة مجانية")}</button>
      <button type="button" class="adv-chat-open" id="advisor-chat-open">💬 ${L("Or ask Baher directly", "أو اسأل باهر مباشرة")}</button>
    </div>

    <!-- Step 2c: book a consultation — pick a day + time within BP hours (9am–6pm, closed Friday) -->
    <div class="advisor-view" id="advisor-book" hidden>
      <div class="adv-book-hd">📅 ${L("Book a free consultation", "احجز استشارة مجانية")}</div>
      <div class="adv-book-sub">${L("Pick a day and time (Riyadh · 9am–6pm · closed Friday):", "اختر اليوم والوقت (الرياض · ٩ص–٦م · الجمعة إجازة):")}</div>
      <div class="adv-book-days" id="advisor-book-days"></div>
      <div class="adv-book-slots" id="advisor-book-slots"></div>
      <button type="button" class="adv-primary" id="advisor-book-go" hidden>✅ ${L("Confirm appointment", "أكّد الموعد")}</button>
      <div class="adv-ticket-done" id="advisor-book-done" hidden></div>
    </div>

    <!-- Step 2b: sub-services of a chosen category -->
    <div class="advisor-view" id="advisor-sub" hidden>
      <div class="adv-sub-hd" id="advisor-sub-hd"></div>
      <div class="adv-svcs" id="advisor-svcs"></div>
    </div>

    <!-- Step 3: open a support ticket for the chosen service -->
    <div class="advisor-view" id="advisor-ticket" hidden>
      <div class="adv-ticket-hd" id="advisor-ticket-hd"></div>
      <textarea class="adv-in" id="advisor-ticket-note" rows="3" placeholder="${Lraw("Describe your request (optional)", "اكتب تفاصيل طلبك (اختياري)")}"></textarea>
      <button type="button" class="adv-primary" id="advisor-ticket-go">💬 ${L("Request a price quote", "اطلب عرض السعر")}</button>
      <div class="adv-ticket-done" id="advisor-ticket-done" hidden></div>
    </div>

    <!-- Chat with Baher (available after intake) -->
    <div class="advisor-view advisor-chat-view" id="advisor-chat" hidden>
      <div class="advisor-msgs" id="advisor-msgs">
        <div class="advisor-msg bot">${L("Hi 👋 I'm Baher, your smart assistant at Business Partner. Ask me about company formation, foreign investment, licensing, or any government procedure — and I'll point you to the right service.", "حياك الله 👋 أنا باهر، مساعدك الذكي في بيزنس بارتنر. اسألني عن التأسيس، الاستثمار الأجنبي، التراخيص، أو أي إجراء حكومي — وأدلّك على الخدمة المناسبة.")}</div>
      </div>
      <div class="advisor-chips" id="advisor-chips">
        <button type="button" class="advisor-chip" data-q="${Lraw("Foreign investment company setup", "تأسيس شركة باستثمار أجنبي")}">🏢 ${L("Foreign investment setup", "تأسيس شركة باستثمار أجنبي")}</button>
        <button type="button" class="advisor-chip" data-q="${Lraw("Government platforms management", "إدارة المنصات الحكومية")}">💼 ${L("Government platforms", "إدارة المنصات الحكومية")}</button>
        <button type="button" class="advisor-chip" data-q="${Lraw("Packages & pricing", "الباقات والأسعار")}">💰 ${L("Packages & pricing", "الباقات والأسعار")}</button>
        <button type="button" class="advisor-chip" data-q="${Lraw("I want a free consultation", "أبغى استشارة مجانية")}">📞 ${L("Free consultation", "أبغى استشارة مجانية")}</button>
      </div>
      <form class="advisor-form" id="advisor-form">
        <input id="advisor-input" type="text" autocomplete="off" placeholder="${Lraw("Type your question here…", "اكتب سؤالك هنا…")}" aria-label="${Lraw("Type your question", "اكتب سؤالك")}">
        <button type="submit" aria-label="${Lraw("Send", "إرسال")}">${I.send}</button>
      </form>
    </div>
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

// Clean slug + URL for a category's own page (e.g. /services/category/company-formation).
const catSlugUrl = (key) => key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const catUrl = (key) => u("/services/category/" + catSlugUrl(key));
// Emoji icon per category (visual variety on the services hub).
const CAT_ICON = {
  "Company Formation": "🏢", "Foreign Investment": "🌍", "Premium Residency": "🪪",
  "Government Relations": "🏛️", "HR Services": "👥", "Recruitment": "🧑‍💼",
  "Business Support": "📊", "Real Estate": "🏗️", "AI Automation": "🤖", "Tourism": "✈️",
};

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
// g is always the Arabic authority name (from services.json); every call
// site applies esc() itself, so this returns raw text via Lraw()/T() (never
// L(), which double-escapes). T() already falls back to the English name
// for any language without its own translation of that string, so this
// covers every extra language automatically as translations are added to
// i18n.mjs.
const govLabel = (g) => Lraw(GOV_EN[g] || g, g);

// Note: these return raw (unescaped) text — every call site applies esc()
// itself — so use Lraw()/T() here, never L() (which double-escapes).
function audienceOf(s, ov) {
  if (LANG === "ar") {
    if (ov && ov.audience) return ov.audience;
    if (s.targetClient) return s.targetClient;
    return Lraw("Individuals & businesses", "أفراد ومنشآت");
  }
  if (ov && ov.audienceEn) return ov.audienceEn;
  return Lraw("Individuals & businesses", "أفراد ومنشآت");
}
function documentsOf(s, ov) {
  if (LANG === "ar") {
    if (ov && ov.documents) return ov.documents;
    return [
      Lraw("Official documents (Commercial Registration or ID as applicable)", "الوثائق الرسمية (سجل تجاري أو هوية حسب الحالة)"),
      Lraw("Documents specific to your activity or request", "المستندات الخاصة بنشاطك أو بطلب الخدمة"),
      Lraw("Payment of the fees due to the relevant authority", "سداد الرسوم المقررة للجهة المختصة"),
    ];
  }
  if (ov && ov.documentsEn) return ov.documentsEn;
  return [
    Lraw("Official documents (Commercial Registration or ID as applicable)", "الوثائق الرسمية (سجل تجاري أو هوية حسب الحالة)"),
    Lraw("Documents specific to your activity or request", "المستندات الخاصة بنشاطك أو بطلب الخدمة"),
    Lraw("Payment of the fees due to the relevant authority", "سداد الرسوم المقررة للجهة المختصة"),
  ];
}
// Arabic translations of the English-only deliverables in services.json (keyed by code),
// so nothing English leaks into the Arabic service pages.
const DELIV_AR = {
  "BP-PL-0001": ["السجل التجاري", "عقد التأسيس", "عضوية الغرفة التجارية"],
  "BP-SBC-01": ["حجز الاسم التجاري", "صياغة وتوثيق عقد التأسيس", "إصدار السجل التجاري", "عضوية الغرفة التجارية", "التسجيل المبدئي في الزكاة والضريبة (ZATCA)"],
  "BP-SBC-03": ["عقد تأسيس مُصاغ ومُوثّق"],
  "BP-SBC-08": ["إتمام التصفية", "شطب السجل التجاري", "شهادة إغلاق المنشأة"],
  "BP-SBC-16": ["الترخيص الصناعي", "السجل التجاري للمصنع", "موافقات مدن / وزارة الاستثمار ذات العلاقة"],
  "BP-FI-01": ["ترخيص وزارة الاستثمار (MISA)", "السجل التجاري", "عضوية الغرفة التجارية", "التسجيل في الزكاة والضريبة (ZATCA). (التراخيص الثانوية والخدمات المساندة كإضافات اختيارية.)"],
  "BP-FI-03": ["ترخيص وزارة الاستثمار (MISA)", "السجل التجاري", "عضوية الغرفة التجارية للكيان المملوك بالكامل"],
  "BP-FI-04": ["ترخيص وزارة الاستثمار (MISA)", "السجل التجاري", "عضوية الغرفة التجارية للمشروع المشترك"],
  "BP-FI-05": ["ترخيص رائد أعمال من وزارة الاستثمار", "السجل التجاري", "عضوية الغرفة التجارية"],
  "BP-PL-0067": ["ترخيص مستثمر من وزارة الاستثمار (MISA)"],
  "BP-PR-01": ["تجهيز المستندات", "تقديم الطلب والمتابعة مع الجهة المختصة"],
  "BP-PR-02": ["تقييم الأهلية", "المسار الموصى به للإقامة المميزة"],
  "BP-MOD-01": ["شهادة السلامة من الدفاع المدني للموقع"],
  "BP-HR-01": ["إصدار الشهادات الصحية للموظفين"],
  "BP-MUQEEM-02": ["إصدار إقامة جديدة للموظف"],
  "BP-AI-01": ["أتمتة متعددة المسارات بالذكاء الاصطناعي", "معالجة ذكية للمستندات", "لوحات تقارير ومؤشرات", "تحسين ودعم مستمر"],
  "BP-AI-02": ["إعداد وكيل واتساب ذكي", "ربط مع CRM والبريد والتقويم والمستندات", "تأهيل العملاء المحتملين وتسعير فوري ومتابعة آلية"],
};
function featuresOf(s, ov) {
  if (LANG === "ar") {
    if (ov && ov.features) return ov.features;
    const feats = [];
    // Prefer curated Arabic deliverables; otherwise keep only deliverables that are actually Arabic.
    const dv = DELIV_AR[s.code] || (s.deliverables || []).filter((x) => /[؀-ۿ]/.test(x));
    if (dv.length) feats.push(...dv.slice(0, 4));
    feats.push("ننجز الإجراء نيابةً عنك من البداية حتى الإصدار");
    feats.push("أتعاب واضحة والرسوم الحكومية منفصلة ومعلنة");
    feats.push("دعم الوكيل الذكي على مدار الساعة");
    return feats.slice(0, 7);
  }
  if (ov && ov.featuresEn) return ov.featuresEn;
  return [
    Lraw("We complete the procedure on your behalf, from start to issuance", "ننجز الإجراء نيابةً عنك من البداية حتى الإصدار"),
    Lraw("Clear fees, with government fees separate and disclosed", "أتعاب واضحة والرسوم الحكومية منفصلة ومعلنة"),
    Lraw("Smart-agent support around the clock", "دعم الوكيل الذكي على مدار الساعة"),
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
        (SHOW_SERVICE_PRICES && s.price.amount != null ? `أتعاب بيزنس بارتنر لهذه الخدمة ${s.price.label}. ` : "تُسعّر هذه الخدمة بعرض مخصّص حسب حالتك. ") +
        (s.govFeesSeparate ? "الرسوم الحكومية منفصلة عن الأتعاب وتُعلن قبل البدء." : "وتُضاف ضريبة القيمة المضافة."),
    });
    faq.push({ q: "لمن هذه الخدمة؟", a: `هذه الخدمة متاحة لـ${audienceOf(s, ov)}.` });
    if (s.govPlatform) faq.push({ q: "ما الجهة المختصة؟", a: `تُقدَّم الخدمة عبر ${govLabel(s.govPlatform)}، ونتولّى نحن التقديم والمتابعة معها.` });
    faq.push({ q: "كيف أبدأ؟", a: "تواصل معنا، والوكيل الذكي يحدد متطلباتك، يجهّز قائمة مستنداتك، ويبدأ تنفيذ طلبك فوراً." });
  } else {
    faq.push({
      q: Lraw("How much are the fees for this service?", ""),
      a:
        (SHOW_SERVICE_PRICES && s.price.amount != null
          ? Lraw("Business Partner's fee for this service is {price}. ", "").replace("{price}", localizeLabel(s.price.label))
          : Lraw("This service is quoted individually based on your case. ", "")) +
        (s.govFeesSeparate
          ? Lraw("Government fees are separate from our fees and are disclosed before we start.", "")
          : Lraw("VAT is added.", "")),
    });
    faq.push({ q: Lraw("Who is this service for?", ""), a: Lraw("This service is available to {audience}.", "").replace("{audience}", audienceOf(s, ov)) });
    if (s.govPlatform) faq.push({ q: Lraw("Which authority handles it?", ""), a: Lraw("The service is delivered through {authority}; we handle the filing and follow-up with it.", "").replace("{authority}", govLabel(s.govPlatform)) });
    faq.push({ q: Lraw("How do I start?", ""), a: Lraw("Contact us — the smart agent identifies your requirements, prepares your document list, and starts your request immediately.", "") });
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
      { title: "24/7 smart agent", text: "Answers your questions 24/7, identifies the right service for your case, and starts preparing your document list automatically." },
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
    agentEyebrow: "The killer feature", agentTitle: "The killer feature: the instant smart agent",
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
      { text: "The smart agent answered me at night and prepared my document list right away.", name: "Client — investor", role: "Foreign investment" },
      { text: "Clear fees with no surprises, and they followed through until the license was issued.", name: "Client — industrial sector", role: "Industrial license" },
    ],
    finalTitle: "Ready to start?", finalText: "Send us your enquiry now — the smart agent replies instantly and sets your next step.", finalCta: "Start now",
  };

  const whyCards = h.why.items
    .map((it, i) => `<div class="card feature"><div class="card-icon">${I[it.icon] || I.check}</div>
      <h3>${L(EN.why.items[i].title, it.title)}</h3><p>${L(EN.why.items[i].text, it.text)}</p></div>`)
    .join("");
  const svcQuickLinks = h.coreServices.cards
    .map((c, i) => `<a class="quick-link" href="${catUrl(c.category)}"><span class="q-icon">${I.building}</span><span>${L(EN.cards[i].title, c.title)}</span></a>`)
    .join("");
  const pkgQuickLinks = site.packages.tiers
    .map((t) => `<a class="quick-link" href="${u("/packages")}"><span class="q-icon">📦</span><span>${L(t.nameEn || t.nameAr, t.nameAr)}</span></a>`)
    .join("");
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
    <div class="section-head"><span class="eyebrow">${L("Who we are", "من نحن")}</span><h2>${L("Your operating partner in Saudi Arabia", "شريكك التشغيلي في السعودية")}</h2><p>${L("We handle your government procedures, extract your records and run your platforms — so you focus on growing your business, backed by 15+ years in the Saudi market.", "نتولّى إجراءاتك الحكومية، ونستخرج سجلاتك، وندير منصّاتك — لتتفرّغ لنمو أعمالك، بخبرة تتجاوز 15 عاماً في السوق السعودي.")}</p></div>
    <div class="grid grid-3">
      <div class="card feature"><div class="card-icon" style="font-size:1.6rem">🏛️</div><h3>${L("15+ authorities", "+15 جهة حكومية")}</h3><p>${L("We deal with the official authorities on your behalf.", "نتعامل مع الجهات الرسمية نيابةً عنك.")}</p></div>
      <div class="card feature"><div class="card-icon" style="font-size:1.6rem">🗂️</div><h3>${L("90+ services", "+90 خدمة")}</h3><p>${L("A full official catalog covering formation to daily operations.", "كتالوج رسمي شامل يغطي رحلتك من التأسيس للتشغيل.")}</p></div>
      <div class="card feature"><div class="card-icon" style="font-size:1.6rem">🖥️</div><h3>${L("Platform management", "إدارة المنصّات")}</h3><p>${L("Qiwa, GOSI, Muqeem, Mudad, Absher and more — managed for you.", "قوى، التأمينات، مقيم، مدد، أبشر وغيرها — نديرها عنك.")}</p></div>
      <div class="card feature"><div class="card-icon" style="font-size:1.6rem">🤖</div><h3>${L("Smart agent 24/7", "وكيل ذكي 24/7")}</h3><p>${L("Instant replies and automatic document prep any time.", "رد فوري وتجهيز مستنداتك تلقائياً في أي وقت.")}</p></div>
      <div class="card feature"><div class="card-icon" style="font-size:1.6rem">⚡</div><h3>${L("Fast execution", "تنفيذ سريع")}</h3><p>${L("Ready-made tracks and precise knowledge of the regulations.", "مسارات جاهزة ومعرفة دقيقة بالأنظمة.")}</p></div>
      <div class="card feature"><div class="card-icon" style="font-size:1.6rem">🛡️</div><h3>${L("Full transparency", "شفافية كاملة")}</h3><p>${L("Clear fees, with government fees disclosed separately.", "أتعاب واضحة والرسوم الحكومية منفصلة ومعلنة.")}</p></div>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف نعمل")}</span><h2>${L("How we get your records & licences done", "كيف نُنجز سجلاتك وتراخيصك")}</h2><p>${L("A clear path from your first message to issuance — we handle the paperwork and follow it through.", "مسار واضح من أول رسالة حتى الإصدار — نتولّى الإجراءات ونتابعها حتى تُنجز.")}</p></div>
    <div class="home-steps">
      <div class="hstep"><span class="hstep-n">1</span><h3>${L("Consult", "تواصل واستشارة")}</h3><p>${L("Tell us what you need — we identify the right service for your case.", "أخبرنا باحتياجك — نحدد الخدمة المناسبة لحالتك.")}</p></div>
      <div class="hstep"><span class="hstep-n">2</span><h3>${L("Prepare documents", "تجهيز المستندات")}</h3><p>${L("We prepare and review your document list with you.", "نجهّز قائمة مستنداتك ونراجعها معك.")}</p></div>
      <div class="hstep"><span class="hstep-n">3</span><h3>${L("Submit & follow up", "الرفع والمتابعة")}</h3><p>${L("We submit to the relevant authority and follow up until issuance.", "نرفع طلبك على الجهة المختصة ونتابعه حتى الإصدار.")}</p></div>
      <div class="hstep"><span class="hstep-n">4</span><h3>${L("Delivery & support", "التسليم والدعم")}</h3><p>${L("We hand over your record/licence ready, with ongoing support.", "نسلّمك سجلك/رخصتك جاهزة، مع دعم مستمر بعدها.")}</p></div>
    </div>
    <div class="center mt-32"><a class="btn btn-primary" href="${u("/consultation")}">${L("Start now", "ابدأ الآن")}</a></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(EN.whyEyebrow, "لماذا نحن")}</span><h2>${L(EN.why.title, h.why.title)}</h2></div>
    <div class="grid grid-3">${whyCards}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="quick-head">
      <div><span class="eyebrow">${L(EN.servicesEyebrow, "الخدمات")}</span><h2>${L(EN.coreTitle, h.coreServices.title)}</h2></div>
      <a class="btn btn-primary" href="${u("/services")}">${L(EN.allServices, "كل الخدمات")} ${I.arrow}</a>
    </div>
    <div class="quick-links">${svcQuickLinks}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="quick-head">
      <div><span class="eyebrow">${L(EN.packagesEyebrow, "الباقات")}</span><h2>${L(site.packages.titleEn || site.packages.title, site.packages.title)}</h2></div>
      <a class="btn btn-primary" href="${u("/packages")}">${L("View packages", "استعرض الباقات")} ${I.arrow}</a>
    </div>
    <div class="quick-links">${pkgQuickLinks}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L(EN.reviewsEyebrow, "آراء العملاء")}</span><h2>${L("Client reviews", h.testimonials.title)}</h2></div>
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
    <div class="hero-actions">${waBtn2("Book a consultation", "احجز استشارة", "btn-primary")}<a class="btn btn-ghost" href="${u("/services")}">${L("Browse services", "استعرض الخدمات")}</a></div>
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
    <div class="cta-band"><h2>${L("Ready to start your journey?", "جاهز نبدأ رحلتك؟")}</h2><p>${L("The smart agent replies instantly and sets your next step.", "الوكيل الذكي يرد فوراً ويحدد لك الخطوة التالية.")}</p>${waBtn2("Start now", "ابدأ الآن", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("About — Business Partner", "من نحن — بيزنس بارتنر"), desc: Lraw(a.leadEn || a.lead, a.lead), active: "/about", body });
}

/* ---------- Saudi entrepreneurship ecosystem directory (/directory) ---------- */
// Category metadata: label per language + an accent color drawn from the brand
// palette. Keys match ecosystem.json's `cat` field.
const ECO_CATS = {
  incubator:   { en: "Incubators",        ar: "حاضنات الأعمال",       c: "#0B1B5A" },
  accelerator: { en: "Accelerators",      ar: "مسرّعات الأعمال",      c: "#1E88C7" },
  vc:          { en: "Venture Capital",   ar: "صناديق استثمارية",     c: "#2E7D5B" },
  angel:       { en: "Angel Investors",   ar: "مستثمرون ملائكة",      c: "#B07A16" },
  coworking:   { en: "Coworking Spaces",  ar: "مساحات عمل مشتركة",    c: "#7A3FB0" },
  training:    { en: "Training Programs", ar: "برامج تدريب وتأهيل",   c: "#0E8B8B" },
};
const ecoCatLabel = (k) => (ECO_CATS[k] ? L(ECO_CATS[k].en, ECO_CATS[k].ar) : esc(k));

function buildDirectory() {
  const orgs = ecosystem.orgs || [];
  const programs = ecosystem.programs || [];

  // Counts per category (entities) for the hero stats.
  const catCount = (k) => orgs.filter((o) => o.cat === k).length;
  const cities = [...new Set(orgs.map((o) => o.city).filter((c) => c && c !== "Online"))]
    .sort((a, b) => a.localeCompare(b, "ar"));
  const openPrograms = programs.filter((p) => /مستمر|دائم/.test(p.status)).length;

  // ----- hero -----
  const stats = [
    { n: orgs.length, en: "Entities", ar: "جهة" },
    { n: catCount("incubator"), en: "Incubators", ar: "حاضنة" },
    { n: catCount("accelerator"), en: "Accelerators", ar: "مسرّعة" },
    { n: catCount("vc") + catCount("angel"), en: "Investors & funds", ar: "مستثمر وصندوق" },
    { n: programs.length, en: "Programs", ar: "برنامج" },
    { n: cities.length, en: "Cities", ar: "مدينة" },
  ].map((s) => `<div class="eco-stat"><strong>${s.n}</strong><span>${L(s.en, s.ar)}</span></div>`).join("");

  // ----- category filter chips (shared) -----
  const chip = (key, label) =>
    `<button type="button" class="eco-chip${key === "all" ? " active" : ""}" data-cat="${key}"${
      key !== "all" ? ` style="--bc:${ECO_CATS[key].c}"` : ""
    }>${label}</button>`;
  const chips =
    chip("all", L("All", "الكل")) +
    Object.keys(ECO_CATS).map((k) => chip(k, ecoCatLabel(k))).join("");

  // ----- city select -----
  const cityOpts =
    `<option value="all">${L("All cities", "كل المدن")}</option>` +
    cities.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");

  // ----- entity cards -----
  const contactLinks = (o) => {
    const parts = [];
    if (o.url) parts.push(`<a href="${esc(o.url)}" target="_blank" rel="noopener" title="${Lraw("Website", "الموقع")}">${I.globe}<span>${L("Website", "الموقع")}</span></a>`);
    if (o.email) parts.push(`<a href="mailto:${esc(o.email)}" title="${esc(o.email)}">${I.mail}<span>${L("Email", "البريد")}</span></a>`);
    if (o.phone) parts.push(`<a href="tel:${esc(o.phone)}" title="${esc(o.phone)}">${I.phone}<span>${L("Call", "اتصال")}</span></a>`);
    return parts.length ? `<div class="eco-links">${parts.join("")}</div>` : "";
  };
  const orgCards = orgs.map((o) => {
    const cat = ECO_CATS[o.cat] || ECO_CATS.incubator;
    const text = `${o.name} ${o.desc} ${o.type} ${o.city}`.toLowerCase();
    const d = o.desc || "";
    return `<article class="eco-card" data-kind="orgs" data-cat="${o.cat}" data-city="${esc(o.city)}" data-text="${esc(text)}">
      <div class="eco-card-top">
        <span class="eco-badge" style="--bc:${cat.c}">${ecoCatLabel(o.cat)}</span>
        ${o.city ? `<span class="eco-city">${I.pin}${esc(o.city)}</span>` : ""}
      </div>
      <h3>${esc(o.name)}</h3>
      ${o.type ? `<p class="eco-type">${esc(o.type)}</p>` : ""}
      ${d ? `<p class="eco-desc">${esc(d)}</p>` : ""}
      ${contactLinks(o)}
    </article>`;
  }).join("");

  // ----- program cards -----
  const statusMeta = (s) => {
    if (/مستمر|دائم/.test(s)) return { cls: "open", label: L("Open now", "تقديم مفتوح") };
    if (/مغلق/.test(s)) return { cls: "closed", label: L("Closed", "مغلق") };
    return { cls: "na", label: L("By schedule", "حسب الجدول") };
  };
  const progCards = programs.map((p) => {
    const cat = ECO_CATS[p.cat] || ECO_CATS.incubator;
    const st = statusMeta(p.status);
    const text = `${p.name} ${p.desc} ${(p.tags || []).join(" ")}`.toLowerCase();
    const details = [];
    if (p.eligibility) details.push(`<div class="eco-det"><h4>${L("Eligibility", "شروط الأهلية")}</h4><p>${esc(p.eligibility)}</p></div>`);
    if (p.benefits) details.push(`<div class="eco-det"><h4>${L("Support & benefits", "الدعم والمزايا")}</h4><p>${esc(p.benefits)}</p></div>`);
    if (p.contact) details.push(`<div class="eco-det"><h4>${L("How to reach", "قنوات التواصل")}</h4><p>${esc(p.contact)}</p></div>`);
    const more = details.length
      ? `<details class="eco-more"><summary>${L("Requirements & benefits", "المتطلبات والمزايا")}</summary>${details.join("")}</details>`
      : "";
    return `<article class="eco-card eco-prog" data-kind="programs" data-cat="${p.cat}" data-city="all" data-text="${esc(text)}">
      <div class="eco-card-top">
        <span class="eco-badge" style="--bc:${cat.c}">${ecoCatLabel(p.cat)}</span>
        <span class="eco-status ${st.cls}">${st.label}</span>
      </div>
      <h3>${esc(p.name)}</h3>
      ${p.desc ? `<p class="eco-desc">${esc(p.desc)}</p>` : ""}
      ${more}
      ${p.url ? `<div class="eco-links"><a href="${esc(p.url)}" target="_blank" rel="noopener">${I.arrow}<span>${L("Apply / details", "التقديم / التفاصيل")}</span></a></div>` : ""}
    </article>`;
  }).join("");

  const body = `
  <section class="hero hero--sm eco-hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Knowledge Center", "مركز المعرفة")}</span>
    <h1>${L("Saudi Startup Ecosystem Directory", "دليل منظومة ريادة الأعمال في السعودية")}</h1>
    <p class="lead">${L(
      "Every incubator, accelerator, venture-capital fund, angel network and coworking space we track across the Kingdom — plus their live programs, eligibility and how to apply. Verified from official sources.",
      "كل حاضنة ومسرّعة أعمال وصندوق استثماري وشبكة ملائكة ومساحة عمل مشتركة نرصدها في المملكة — مع برامجها القائمة وشروط الأهلية وطريقة التقديم. مُوثّقة من مصادر رسمية."
    )}</p>
    <div class="eco-stats">${stats}</div>
  </div></section>

  <section class="section eco-wrap"><div class="container" id="eco">
    <div class="eco-controls">
      <div class="eco-search-box">${I.doc}<input type="search" id="eco-search" placeholder="${Lraw("Search by name, city or focus…", "ابحث بالاسم أو المدينة أو المجال…")}" aria-label="${Lraw("Search the directory", "ابحث في الدليل")}"></div>
      <div class="eco-city-box" id="eco-city-box"><label for="eco-city" class="sr-only">${L("City", "المدينة")}</label>${I.pin}<select id="eco-city" aria-label="${Lraw("Filter by city", "تصفية حسب المدينة")}">${cityOpts}</select></div>
    </div>

    <div class="eco-tabs" role="tablist">
      <button type="button" class="eco-tab active" data-tab="orgs" role="tab">${L("Entities", "الجهات")} <span class="eco-tab-n">${orgs.length}</span></button>
      <button type="button" class="eco-tab" data-tab="programs" role="tab">${L("Programs", "البرامج")} <span class="eco-tab-n">${programs.length}</span></button>
    </div>

    <div class="eco-chips" aria-label="${Lraw("Filter by category", "تصفية حسب الفئة")}">${chips}</div>

    <p class="eco-resultline">${L("Showing", "عرض")} <span id="eco-count">${orgs.length}</span> ${L("of", "من")} <span id="eco-total">${orgs.length}</span></p>

    <div class="eco-grid" id="eco-grid">${orgCards}${progCards}</div>
    <p class="eco-empty" id="eco-empty" hidden>${L("No results match your filters. Try clearing the search or category.", "لا توجد نتائج مطابقة. جرّب مسح البحث أو الفئة.")}</p>

    <div class="cta-band eco-cta"><h2>${L("Building or backing a startup in Saudi Arabia?", "تؤسّس أو تدعم شركة ناشئة في السعودية؟")}</h2><p>${L("We help founders and funds with licensing, MISA foreign investment, formation and compliance. Talk to the smart agent to find the right path.", "نساعد المؤسسين والصناديق في التراخيص والاستثمار الأجنبي (MISA) والتأسيس والامتثال. تحدّث مع الوكيل الذكي لتحديد المسار المناسب.")}</p>${waBtn2("Talk to us", "تواصل معنا", "btn-white", true)}</div>
  </div></section>`;

  const script = `<script>
  (function(){
    var root=document.getElementById('eco'); if(!root)return;
    var search=root.querySelector('#eco-search');
    var citySel=root.querySelector('#eco-city');
    var cityBox=root.querySelector('#eco-city-box');
    var chips=root.querySelectorAll('.eco-chip');
    var tabs=root.querySelectorAll('.eco-tab');
    var cards=root.querySelectorAll('.eco-card');
    var countEl=root.querySelector('#eco-count');
    var totalEl=root.querySelector('#eco-total');
    var emptyEl=root.querySelector('#eco-empty');
    var state={cat:'all',city:'all',q:'',tab:'orgs'};
    var totals={orgs:0,programs:0};
    cards.forEach(function(c){ totals[c.getAttribute('data-kind')]++; });
    function apply(){
      var q=(state.q||'').trim().toLowerCase();
      var shown=0;
      cards.forEach(function(c){
        var inTab=c.getAttribute('data-kind')===state.tab;
        var okCat=state.cat==='all'||c.getAttribute('data-cat')===state.cat;
        var okCity=state.tab!=='orgs'||state.city==='all'||c.getAttribute('data-city')===state.city;
        var okQ=!q||c.getAttribute('data-text').indexOf(q)>-1;
        var show=inTab&&okCat&&okCity&&okQ;
        c.style.display=show?'':'none';
        if(show)shown++;
      });
      if(countEl)countEl.textContent=shown;
      if(totalEl)totalEl.textContent=totals[state.tab];
      if(emptyEl)emptyEl.hidden=shown!==0;
    }
    search&&search.addEventListener('input',function(){state.q=this.value;apply();});
    citySel&&citySel.addEventListener('change',function(){state.city=this.value;apply();});
    chips.forEach(function(ch){ch.addEventListener('click',function(){
      chips.forEach(function(x){x.classList.remove('active');});
      ch.classList.add('active');state.cat=ch.getAttribute('data-cat');apply();
    });});
    tabs.forEach(function(t){t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('active');});
      t.classList.add('active');state.tab=t.getAttribute('data-tab');
      if(cityBox)cityBox.style.display=state.tab==='orgs'?'':'none';
      apply();
    });});
    apply();
  })();
  </script>`;

  return page({
    title: Lraw("Saudi Startup Ecosystem Directory — Business Partner", "دليل منظومة ريادة الأعمال في السعودية — بيزنس بارتنر"),
    desc: Lraw(
      "Directory of Saudi incubators, accelerators, venture-capital funds, angel networks and coworking spaces, with their programs and how to apply.",
      "دليل الحاضنات والمسرّعات والصناديق الاستثمارية وشبكات الملائكة ومساحات العمل المشتركة في السعودية، مع برامجها وطريقة التقديم."
    ),
    active: "/directory",
    body,
    script,
  });
}


// One card per category on the services hub → links to that category's own page.
function categoryCards() {
  return categories
    .map((cat) => {
      const n = services.filter((s) => s.category === cat.key).length || cat.count;
      return `<a class="card cat-card" href="${catUrl(cat.key)}">
        <div class="cat-card-icon">${CAT_ICON[cat.key] || "📁"}</div>
        <h3>${L(catEn(cat.key), cat.ar)}</h3>
        <p class="desc">${L(`${n} ${enCount(n, "service", "services")} with clear fees from the official catalog.`, `${n} ${arCount(n, "خدمة", "خدمتان", "خدمات")} بأتعاب واضحة من الكتالوج الرسمي.`)}</p>
        <div class="foot"><span class="count-pill">${n} ${L(enCount(n, "service", "services"), arCount(n, "خدمة", "خدمتان", "خدمات"))}</span><span class="card-link">${L("Browse", "استعراض")} ${I.arrow}</span></div>
      </a>`;
    })
    .join("");
}

function buildServicesIndex() {
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Services", "الخدمات")}</span>
    <h1>${L("Choose a service category", "اختر تصنيف الخدمة")}</h1>
    <p class="lead">${L(services.length + " services organized into " + categories.length + " categories — pick a category to see its services, each with a full page of documents, requirements and a custom quote.", services.length + " خدمة موزّعة على " + categories.length + " تصنيفاً — اختر التصنيف لتشاهد خدماته، ولكل خدمة صفحة كاملة بالمستندات والمتطلبات وعرض سعر حسب حالتك.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3 cat-grid">${categoryCards()}</div>
    <div class="cta-band" style="margin-top:36px"><h2>${L("Looking for fixed-price bundles?", "تبحث عن باقات بأسعار واضحة؟")}</h2><p>${L("Our packages bundle related services at a clear starting price.", "باقاتنا تجمع الخدمات المترابطة بسعر ابتدائي واضح.")}</p><a class="btn btn-white" href="${u("/packages")}">${L("View packages", "استعرض الباقات")}</a></div>
  </div></section>`;
  return page({ title: Lraw("Services — Business Partner", "الخدمات — بيزنس بارتنر"), desc: Lraw(services.length + " government and business services — a custom quote for your case.", services.length + " خدمة حكومية وتجارية — عرض سعر حسب حالتك."), active: "/services", body });
}

// One page per category listing only that category's services.
// Owner's policy (updated): NO price is revealed anywhere on the site — not for
// services, packages, AI agents, smart-employees, trips or catering. Everything
// is quoted to the client's case. Flip SHOW_PRICES to true to re-enable every
// price display at once.
const SHOW_PRICES = false;
const SHOW_SERVICE_PRICES = SHOW_PRICES;

function buildServiceCategory(cat) {
  const list = services.filter((s) => s.category === cat.key);
  const cards = list
    .map((s) => {
      const d = sDesc(s);
      return `<a class="card svc-card" href="${u("/services/" + s.slug)}">
        <span class="tag">${L(catEn(cat.key), cat.ar)}</span>
        <h3>${esc(sName(s))}</h3>
        <p class="desc">${esc(d.slice(0, 120))}${d.length > 120 ? "…" : ""}</p>
        <div class="foot"><span class="price-soft">${SHOW_SERVICE_PRICES && s.price && s.price.amount != null ? esc(localizeLabel(s.price.label || s.price.amount + " ﷼")) : L("Custom quote", "سعر حسب حالتك")}</span><span class="card-link">${L("Details", "التفاصيل")} ${I.arrow}</span></div>
      </a>`;
    })
    .join("");
  const other = categories
    .filter((c) => c.key !== cat.key)
    .map((c) => `<a class="cc-chip" href="${catUrl(c.key)}">${CAT_ICON[c.key] || "📁"} ${L(catEn(c.key), c.ar)}</a>`)
    .join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/services")}">${I.arrow} ${L("All categories", "كل التصنيفات")}</a>
    <span class="eyebrow">${CAT_ICON[cat.key] || "📁"} ${L("Services", "الخدمات")}</span>
    <h1>${L(catEn(cat.key), cat.ar)}</h1>
    <p class="lead">${L(list.length + " " + enCount(list.length, "service", "services") + " in " + catEn(cat.key) + " — talk to us for a quote tailored to your case; government fees are always separate.", list.length + " " + arCount(list.length, "خدمة", "خدمتان", "خدمات") + " في " + cat.ar + " — تواصل معنا لعرض سعر حسب حالتك، والرسوم الحكومية منفصلة دائماً.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3">${cards}</div>
    <div class="cat-other"><h2>${L("Other categories", "تصنيفات أخرى")}</h2><div class="cc-prof-chips">${other}</div></div>
    <div class="cta-band" style="margin-top:28px"><h2>${L("Not sure which service you need?", "محتار أي خدمة تناسبك؟")}</h2><p>${L("Ask the smart agent and get the right service for your case instantly.", "اسأل الوكيل الذكي وتوصل للخدمة المناسبة لحالتك فوراً.")}</p>${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-white", true)}</div>
  </div></section>`;
  return page({
    title: `${Lraw(catEn(cat.key), cat.ar)} — ${Lraw("Business Partner", "بيزنس بارتنر")}`,
    desc: Lraw(`${list.length} ${catEn(cat.key)} services with clear fees.`, `${list.length} ${arCount(list.length, "خدمة", "خدمتان", "خدمات")} في ${cat.ar} بأتعاب واضحة.`),
    active: "/services",
    path: "/services/category/" + catSlugUrl(cat.key),
    body,
  });
}

function buildServiceDetail(s) {
  const ov = site.overrides[s.slug];
  const docs = documentsOf(s, ov);
  const feats = featuresOf(s, ov);
  const faq = faqOf(s, ov);
  const genericDocsNote = !(ov && (ov.documents || ov.documentsEn))
    ? `<div class="callout" style="margin-top:16px"><span class="ico">💡</span><p>${L("The smart agent confirms the exact document list for your case as soon as you reach out.", "يحدد الوكيل الذكي قائمة المستندات الدقيقة لحالتك فور تواصلك.")}</p></div>`
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
    <div class="breadcrumb"><a href="${u("/")}">${L("Home", "الرئيسية")}</a> ${arrow} <a href="${u("/services")}">${L("Services", "الخدمات")}</a> ${arrow} <a href="${catUrl(s.category)}">${L(catEn(s.category), catAr(s.category))}</a></div>
    <h1>${esc(sName(s))}</h1>
    <div class="svc-meta">${serviceQuickFacts(s, ov)}</div>
  </div></section>
  <div class="container"><div class="svc-layout">
    <div class="svc-main">
      <section><h2>${L("Service description", "وصف الخدمة")}</h2><p class="lead-p">${esc(sDesc(s))}</p></section>
      <section><h2>${L("Required documents", "المستندات المطلوبة")}</h2><ul class="doc-list">${docsHtml}</ul>${genericDocsNote}</section>
      <section><h2>${L("Service features with Business Partner", "مميزات الخدمة مع بيزنس بارتنر")}</h2><ul class="feat-list">${featsHtml}</ul></section>
      <section><h2>${L("Frequently asked questions", "الأسئلة الشائعة")}</h2>${faqHtml}</section>
      <section><div class="callout"><span class="ico">⚡</span><p><strong>${L("Business Partner advantage:", "ميزة بيزنس بارتنر:")}</strong> ${L("The smart agent pulls this service's requirements instantly, prepares your document list automatically, and starts your request around the clock.", "الوكيل الذكي يسحب متطلبات هذه الخدمة فوراً، يجهّز قائمة مستنداتك تلقائياً، ويبدأ طلبك على مدار الساعة.")}</p></div></section>
    </div>
    <aside class="svc-aside">
      <div class="order-box">
        ${SHOW_SERVICE_PRICES && s.price && s.price.amount != null && s.category !== "Real Estate" && s.category !== "Tourism"
          ? `<div class="price-tailored">${esc(localizeLabel(s.price.label || s.price.amount + " ﷼"))}</div>
        <div class="price-note">${esc(priceNote)}</div>
        ${cartBtns({ id: "svc-" + s.slug, nameEn: s.nameEn || s.name, nameAr: s.name, amount: s.price.amount, priceLabel: s.price.label || s.price.amount + " ﷼", kind: "service" })}
        <a class="btn btn-ghost" href="${u("/consultation")}?about=${encodeURIComponent(sName(s))}" style="width:100%">${I.calendar}<span>${L("Or book a free consultation", "أو احجز استشارة مجانية")}</span></a>`
          : `<div class="price-tailored">${L("Pricing tailored to your case", "السعر حسب حالتك")}</div>
        <div class="price-note">${L("Tell us what you need and we'll prepare a custom quote — the first consultation is free.", "أخبرنا بما تحتاجه ونجهّز لك عرضاً مخصّصاً — الاستشارة الأولى مجانية.")}</div>
        ${s.category === "Real Estate" && !s.ctaConsultation
          ? `<a class="btn btn-primary" href="${u("/workspace-request")}" style="width:100%">${I.calendar}<span>${L("Request a workspace", "اطلب مساحة عمل")}</span></a>`
          : s.category === "Tourism"
          ? `<a class="btn btn-primary" href="${u("/tourism")}" style="width:100%">${I.calendar}<span>${L("Explore tourism services", "استعرض خدمات السياحة")}</span></a>`
          : `<a class="btn btn-primary" href="${u("/consultation")}?about=${encodeURIComponent(sName(s))}" style="width:100%">${I.calendar}<span>${L("Request a quote / consultation", "اطلب عرضاً / استشارة")}</span></a>`}`}
        <p class="mini">${L("First consultation is free", "الاستشارة الأولى مجانية")}</p>
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
    .map((g) => {
      const name = L(g.nameEn || g.name, g.name);
      const external = /^https?:\/\//.test(g.link || "");
      const linkAttrs = external ? ` target="_blank" rel="noopener"` : "";
      const nameHtml = g.link ? `<a href="${u(g.link)}"${linkAttrs} style="color:inherit;text-decoration:none">${name}</a>` : name;
      // The smart-employees card must not sell a generic SKU: activation codes
      // unlock specific employee slugs, so a slug-less "agent-..." purchase can
      // never be fulfilled. Route that card to the employee picker instead.
      const isPicker = g.link === "/connect";
      // One SKU per product — the compliance page sells agent-Compliance-Agent,
      // so the hub must use the same id or the same subscription becomes two
      // different cart lines.
      const cartId = g.link === "/compliance-agent" ? "agent-Compliance-Agent" : "agent-" + (g.nameEn || g.name).replace(/\s+/g, "-");
      const btns = isPicker
        ? `<div class="buy-row"><a href="${u(g.link)}" class="btn btn-primary">${L("Pick your employee (12 specialties)", "اختر موظفك (12 تخصصاً)")}</a></div>`
        : cartBtns({ id: cartId, nameEn: g.nameEn || g.name, nameAr: g.name, amount: parseAmount(g.price), priceLabel: g.price, kind: "agent", ghost: !g.highlight });
      const tryBtn = g.link && !isPicker ? `<a href="${u(g.link)}"${linkAttrs} class="btn btn-ghost">${L("Details", "التفاصيل")}</a>` : "";
      const btnsWithTry = tryBtn ? btns.replace('<div class="buy-row">', `<div class="buy-row">${tryBtn}`) : btns;
      return `<div class="pkg${g.highlight ? " pop" : ""}">
      <div class="pk-name">${nameHtml}<small>${L(g.taglineEn || g.tagline, g.tagline)}</small></div>
      ${SHOW_PRICES ? `<div class="pk-price">${esc(priceLabel({ price: { label: g.price } }))}</div>` : ""}
      <p class="pk-for">${L(g.forEn || g.for, g.for)}</p>
      <ul>${g.features.map((f, i) => `<li>${I.check}<span>${L((g.featuresEn && g.featuresEn[i]) || f, f)}</span></li>`).join("")}</ul>
      ${btnsWithTry}
    </div>`;
    })
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("AI Agents", "الوكلاء الأذكياء")}</span>
    <h1>${L(a.titleEn || a.title, a.title)}</h1>
    <p class="lead">${L(a.leadEn || a.lead, a.lead)}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#agents">${L(a.learnEn || "استعرض الوكلاء", "استعرض الوكلاء")}</a></div>
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
    <div class="center mt-32" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a class="btn btn-primary" href="${u("/portal")}">🎁 ${L("Try the team free — 3 messages per employee", "جرّب الفريق مجاناً — 3 رسائل لكل موظف")}</a>
      <a class="btn btn-ghost" href="${u("/portal")}">🔐 ${L("Already subscribed? Enter the portal", "مشترك بالفعل؟ ادخل البوابة")}</a>
      <a class="btn btn-ghost" href="${LANG === "ar" ? "/ar/connect" : "/connect"}">${L("Connect your tools (Gmail, Calendar, Notion, Slack…)", "اربط أدواتك (Gmail، التقويم، Notion، Slack…)")}</a>
    </div>
  </div></section>`;
  return page({ title: Lraw("AI Agents — Business Partner", "الوكلاء الأذكياء — بيزنس بارتنر"), desc: Lraw((a.leadEn || a.lead).slice(0, 155), a.lead.slice(0, 155)), active: "/ai-agents", body });
}

function buildTaskForce() {
  const when = [
    ["🧩", L("The task spans multiple authorities or platforms", "عندما تكون المهمة مرتبطة بعدة جهات أو منصات"), ""],
    ["📂", L("The file is complex and needs organizing", "عندما يكون الملف معقداً ويحتاج ترتيباً وجمع معلومات"), ""],
    ["🔁", L("The project needs continuous, hands-on follow-up", "عندما يحتاج المشروع إلى متابعة تنفيذية مستمرة"), ""],
    ["🎯", L("One single service isn't enough to solve it", "عندما لا تكون خدمة واحدة كافية لحل المشكلة"), ""],
    ["🤝", L("You need a partner who organizes, gathers and executes", "عندما تحتاج شريكاً ينظّم ويجمع ويتابع وينفّذ"), ""],
  ].map((x) => `<div class="card feature"><div class="card-icon" style="font-size:1.5rem">${x[0]}</div><h3>${x[1]}</h3></div>`).join("");
  const steps = [
    [1, L("Understand the task", "فهم المهمة"), L("We understand the nature of the task or project, its goals, current obstacles and the parties involved.", "نفهم طبيعة المهمة أو المشروع، والأهداف المطلوبة، والعوائق الحالية، والأطراف المرتبطة.")],
    [2, L("Gather information & requirements", "جمع المعلومات والمتطلبات"), L("We collect the data, files and requirements to build a clearer picture of the current status and gaps.", "نجمع البيانات والملفات والمتطلبات لتجهيز صورة أوضح عن الوضع الحالي وما ينقصه.")],
    [3, L("Build the execution plan", "بناء خطة التنفيذ"), L("We split the task into steps, set priorities, identify the parties involved, and set a clear follow-up mechanism.", "نقسّم المهمة إلى خطوات، نحدّد الأولويات والأطراف، ونضع آلية متابعة واضحة.")],
    [4, L("Follow-up & execution", "المتابعة والتنفيذ"), L("We manage coordination, updates and follow-up with you and every party involved, with progress reports along the way.", "ندير التنسيق والمتابعة والتحديثات معك ومع الأطراف المرتبطة، مع رفع تقارير مرحلية.")],
  ].map((s) => `<div class="hstep"><span class="hstep-n">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join("");
  const who = [
    L("Companies with complex executive files", "الشركات التي لديها ملفات تنفيذية معقدة"),
    L("Entrepreneurs who need an execution & organizing partner", "رواد الأعمال الذين يحتاجون جهة تنفيذ وتنظيم"),
    L("Establishments running special or sensitive projects", "المنشآت التي تعمل على مشاريع خاصة أو حساسة"),
    L("Anyone who needs multi-party follow-up", "الجهات التي تحتاج إلى متابعة متعددة الأطراف"),
  ].map((t) => `<li>${I.check}<span>${t}</span></li>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Premium executive service", "خدمة تنفيذية Premium")}</span>
    <h1>${L("Task Force", "تاسك فورس")}</h1>
    <p class="lead">${L("A dedicated executive service for hard tasks, special projects and multi-party outcomes — we turn complexity into a clear plan, organized execution and continuous follow-up.", "خدمة تنفيذية متخصصة لإدارة المهمات الصعبة والمشاريع الخاصة والمخرجات متعددة الجهات، وتحويل التعقيد إلى خطة واضحة وتنفيذ منظم ومتابعة مستمرة.")}</p>
    <div class="hero-actions">${waBtn2("Talk to Task Force", "تحدث مع تاسك فورس", "btn-primary", true)}<a class="btn btn-ghost btn-lg" href="#tf-form">${L("Submit your task", "أرسل مهمتك")}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Multi-party coordination", "تنسيق بين جهات متعددة")}</span>
      <span class="hero-badge">${I.check}${L("One point of contact", "جهة تنفيذ واحدة")}</span>
      <span class="hero-badge">${I.check}${L("Continuous progress reports", "تقارير تقدّم مستمرة")}</span>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("When you need Task Force", "متى تحتاج تاسك فورس")}</span><h2>${L("More than a regular service can handle", "أكثر مما تقدّمه خدمة تقليدية")}</h2></div>
    <div class="grid grid-3">${when}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "آلية العمل")}</span><h2>${L("From a complex file to a managed plan", "من ملف معقّد إلى خطة تُدار")}</h2></div>
    <div class="home-steps">${steps}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Who it's for", "الفئة المستهدفة")}</span><h2>${L("Built for complex, multi-party work", "مصمّمة للأعمال المعقّدة متعددة الأطراف")}</h2></div>
    <ul class="feat-list" style="max-width:640px">${who}</ul>
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${L("Task Force is scoped per engagement — tell us about your task and we'll come back with the right execution track and a quote tailored to its complexity.", "تاسك فورس تُسعَّر حسب نطاق كل مهمة — أخبرنا بمهمتك ونعود لك بمسار التنفيذ المناسب وعرض سعر حسب تعقيدها.")}</p></div>
  </div></section>

  <section class="section section--gray" id="tf-form"><div class="container" style="max-width:760px">
    <div class="section-head"><span class="eyebrow">${L("Submit your task", "أرسل مهمتك")}</span><h2>${L("Tell us about your task or project", "أخبرنا عن مهمتك أو مشروعك")}</h2><p>${L("We'll review the scope and come back with the right execution track.", "نراجع النطاق ونعود لك بمسار التنفيذ المناسب.")}</p></div>
    <form id="tf-form-el" novalidate>
      <div class="join-grid">
        <div class="field"><label for="tf-company">${L("Company / entity name", "اسم الشركة / المنشأة")} *</label><input type="text" id="tf-company" required></div>
        <div class="field"><label for="tf-person">${L("Contact person", "اسم المسؤول")} *</label><input type="text" id="tf-person" required></div>
        <div class="field"><label for="tf-phone">${L("Mobile", "الجوال")} *</label><input type="tel" id="tf-phone" inputmode="tel" placeholder="05XXXXXXXX" required></div>
        <div class="field"><label for="tf-email">${L("Email", "البريد الإلكتروني")}</label><input type="email" id="tf-email"></div>
        <div class="field field-full"><label for="tf-notes">${L("Describe the task or project", "صف المهمة أو المشروع")} *</label><textarea id="tf-notes" rows="4" required placeholder="${Lraw("What needs to get done, which parties/platforms are involved, and by when?", "ما المطلوب إنجازه، ما الجهات/المنصات المرتبطة، وما الموعد المستهدف؟")}"></textarea></div>
      </div>
      <div class="join-actions">
        <button type="submit" class="btn btn-primary btn-lg" id="tf-submit">${L("Submit task", "أرسل المهمة")}</button>
      </div>
      <div class="form-success" hidden id="tf-result"></div>
    </form>
  </div></section>`;
  return page({ title: Lraw("Task Force — Business Partner", "تاسك فورس — بيزنس بارتنر"), desc: Lraw("A dedicated executive service for hard, multi-party tasks and special projects.", "خدمة تنفيذية متخصصة لإدارة المهمات الصعبة والمشاريع متعددة الجهات."), active: "/task-force", path: "/task-force", body });
}

/* ---------- Deals & matchmaking (/deals) ---------- */
const DEAL_SECTORS = [
  { key: "food", icon: "🍽️", en: "Restaurants & Food", ar: "مطاعم وأغذية" },
  { key: "retail", icon: "🛍️", en: "Retail", ar: "تجزئة" },
  { key: "tech", icon: "🛠️", en: "Tech", ar: "تقنية" },
  { key: "services", icon: "🧰", en: "Services", ar: "خدمات" },
  { key: "industry", icon: "🪑", en: "Industry", ar: "صناعة" },
  { key: "logistics", icon: "🚚", en: "Logistics", ar: "لوجستيات" },
  { key: "beauty", icon: "💇‍♀️", en: "Beauty", ar: "تجميل" },
  { key: "hr", icon: "👥", en: "HR", ar: "موارد بشرية" },
  { key: "other", icon: "🗂️", en: "Other", ar: "أخرى" },
];
const DEAL_CITIES = [
  { key: "riyadh", en: "Riyadh", ar: "الرياض" },
  { key: "jeddah", en: "Jeddah", ar: "جدة" },
  { key: "dammam", en: "Dammam", ar: "الدمام" },
  { key: "other", en: "Other city", ar: "مدينة أخرى" },
];
const DEAL_TYPE_META = {
  offer: { icon: "🤝", en: "Offering a deal", ar: "عرض صفقة" },
  seek: { icon: "🔎", en: "Seeking a partner", ar: "يبحث عن شريك" },
  idea: { icon: "💡", en: "Pitching an idea", ar: "فكرة مشروع" },
};
const DEAL_TICKETS = [
  { type: "seek", sector: "food", city: "riyadh", titleEn: "Saudi cuisine restaurant — Riyadh", titleAr: "مطعم مأكولات سعودية — الرياض",
    descEn: "A restaurant running for 3 years is looking for a funding partner to open a second branch in Jeddah, with an operating team ready to go.",
    descAr: "مطعم قائم منذ 3 سنوات يبحث عن شريك مموّل لافتتاح فرع ثانٍ في جدة، مع خبرة تشغيلية جاهزة.",
    statEn: "Stake offered", statAr: "الحصة المطروحة", valueEn: "30%", valueAr: "30%", postedEn: "Posted 2 days ago", postedAr: "نُشرت قبل يومين" },
  { type: "idea", sector: "tech", city: "jeddah", titleEn: "On-demand home maintenance booking app", titleAr: "تطبيق حجز صيانة منزلية عند الطلب",
    descEn: "A researched idea with initial market study — the founder is looking for a technical co-founder to build and launch the product.",
    descAr: "فكرة مدروسة بدراسة سوق أولية، صاحبها يبحث عن شريك مؤسس تقني لبناء المنتج وإطلاقه.",
    statEn: "Looking for", statAr: "المطلوب", valueEn: "Technical partner", valueAr: "شريك تقني", postedEn: "Posted yesterday", postedAr: "نُشرت أمس" },
  { type: "offer", sector: "logistics", city: "dammam", titleEn: "Exclusive food-product distribution — Eastern Province", titleAr: "توزيع حصري لمنتجات غذائية — المنطقة الشرقية",
    descEn: "An established distribution company offers an exclusive distribution agreement to retailers in the Eastern Province on preferential terms.",
    descAr: "شركة توزيع قائمة تعرض اتفاقية توزيع حصري لتجار التجزئة في المنطقة الشرقية بشروط تفضيلية.",
    statEn: "Minimum order", statAr: "الحد الأدنى للطلب", valueEn: "SAR 50,000", valueAr: "50 ألف ﷼", postedEn: "Posted 3 days ago", postedAr: "نُشرت قبل 3 أيام" },
  { type: "seek", sector: "beauty", city: "jeddah", titleEn: "Women's beauty salon — new branch", titleAr: "صالون تجميل نسائي — فرع جديد",
    descEn: "A successful 2-branch salon is looking for a partner to run and operate a third branch, with full training and a ready brand.",
    descAr: "صالون ناجح بفرعين يبحث عن شريكة لإدارة وتشغيل فرع ثالث، مع تدريب كامل وعلامة تجارية جاهزة.",
    statEn: "Capital required", statAr: "رأس المال المطلوب", valueEn: "SAR 180,000", valueAr: "180 ألف ﷼", postedEn: "Posted 4 days ago", postedAr: "نُشرت قبل 4 أيام" },
  { type: "offer", sector: "industry", city: "riyadh", titleEn: "Wholesale furniture manufacturing for retailers", titleAr: "تصنيع أثاث بالجملة لتجار التجزئة",
    descEn: "A local furniture factory offers wholesale manufacturing contracts at competitive prices for furniture and furnishing stores.",
    descAr: "مصنع أثاث محلي يعرض تعاقدات تصنيع بالجملة بأسعار تنافسية لمتاجر الأثاث والمفروشات.",
    statEn: "Lead time", statAr: "مدة التوريد", valueEn: "2–4 weeks", valueAr: "2–4 أسابيع", postedEn: "Posted a week ago", postedAr: "نُشرت قبل أسبوع" },
  { type: "idea", sector: "hr", city: "riyadh", titleEn: "Remote hiring platform for Saudi talent", titleAr: "منصة توظيف عن بُعد للمواهب السعودية",
    descEn: "An entrepreneur with 8 years of recruitment experience is looking for a technical co-founder to build a platform connecting companies with talent.",
    descAr: "رائد أعمال يملك خبرة توظيف 8 سنوات ويبحث عن شريك مؤسس مطوّر لبناء منصة ربط الشركات بالمواهب.",
    statEn: "Looking for", statAr: "المطلوب", valueEn: "Co-founder", valueAr: "شريك مؤسس", postedEn: "Posted a week ago", postedAr: "نُشرت قبل أسبوع" },
];

/* Curated, source-backed market opportunities Business Partner tracks (giga-projects
   + government tenders). Public-facing "knowledge → deal" showcase on /deals. Each item
   links to a public source; internal/unverified items are intentionally excluded. */
const MO_SECTORS = [
  { key: "realestate", icon: "🏗️", en: "Real estate", ar: "عقاري وتطوير" },
  { key: "hospitality", icon: "🏨", en: "Hospitality & tourism", ar: "ضيافة وسياحة" },
  { key: "infra", icon: "⚡", en: "Infrastructure & energy", ar: "بنية تحتية وطاقة" },
  { key: "digital", icon: "💻", en: "Digital & data", ar: "رقمنة وبيانات" },
  { key: "health", icon: "🏥", en: "Health & education", ar: "صحة وتعليم" },
  { key: "transport", icon: "🚆", en: "Transport & logistics", ar: "نقل ولوجستيات" },
  { key: "retail", icon: "🛍️", en: "Retail & entertainment", ar: "ترفيه وتجزئة" },
  { key: "services", icon: "🧰", en: "Services & facilities", ar: "خدمات ومرافق" },
];
// Editable market opportunities shown on /deals (source of truth: data/opportunities.json).
const MARKET_OPPORTUNITIES = read("data/opportunities.json").items;
function buildDeals() {
  const sectorOptions = DEAL_SECTORS.map((s) => `<option value="${s.key}">${L(s.en, s.ar)}</option>`).join("");
  const cityOptions = DEAL_CITIES.map((c) => `<option value="${c.key}">${L(c.en, c.ar)}</option>`).join("");
  const launcher = [
    ["offer", "🤝", L("I have a deal to offer", "عندي صفقة أعرضها"), L("Restaurant, shop, factory — offering a partnership, distribution or ready financing", "مطعم، محل، مصنع — تعرض شراكة أو توزيع أو تمويل جاهز")],
    ["seek", "🔎", L("I'm looking for a partner", "أبحث عن شريك"), L("For an existing project that needs a funding or operating partner", "لمشروع قائم يحتاج شريك مموّل أو شريك تشغيل")],
    ["idea", "💡", L("I have a project idea", "عندي فكرة مشروع"), L("Looking for a co-founder or funder to take on the idea with you", "تبحث عن شريك مؤسس أو ممول يتبنى الفكرة معك")],
  ].map((x) => `<button class="card deal-launcher" data-kind="${x[0]}" type="button"><span class="deal-launcher-ico ${x[0]}">${x[1]}</span><h3>${x[2]}</h3><p class="text-soft">${x[3]}</p></button>`).join("");
  const steps = [
    [1, L("Submit your file", "تقديم الملف"), L("Deal type, sector, city, and a short description — two minutes, no more.", "نوع الصفقة، القطاع، المدينة، ووصف مختصر — دقيقتين لا أكثر.")],
    [2, L("Match calculation", "حساب المطابقة"), L("We instantly compare your file against every open opportunity and rank the closest matches for you.", "نقارن ملفك فورًا بكل الفرص المتاحة ونرشّح أقرب النتائج لك.")],
    [3, L("Review & publish", "اعتماد ونشر"), L("Our team reviews seriousness and data before any deal appears publicly.", "فريقنا يراجع الجدية والبيانات قبل ظهور أي صفقة للعامة.")],
    [4, L("Mutual-consent introduction", "تعارف بموافقة الطرفين"), L("Your data is never revealed until the other party agrees to the introduction.", "بياناتك لا تُكشف أبدًا إلا بعد موافقة الطرف الآخر على التعارف.")],
  ].map((s) => `<div class="hstep"><span class="hstep-n">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join("");
  const chips = [["all", L("All", "الكل")], ["offer", L("Offering a deal", "عرض صفقة")], ["seek", L("Seeking a partner", "بحث عن شريك")], ["idea", L("Project idea", "فكرة مشروع")]]
    .map((c, i) => `<button class="deal-chip${i === 0 ? " active" : ""}" data-filter="${c[0]}" type="button">${c[1]}</button>`).join("");
  const tickets = DEAL_TICKETS.map((t) => {
    const sec = DEAL_SECTORS.find((s) => s.key === t.sector);
    const city = DEAL_CITIES.find((c) => c.key === t.city);
    const meta = DEAL_TYPE_META[t.type];
    return `<article class="card deal-ticket" data-type="${t.type}" data-sector="${t.sector}" data-city="${t.city}">
      <span class="deal-badge ${t.type}">${meta.icon} ${L(meta.en, meta.ar)}</span>
      <h3>${L(t.titleEn, t.titleAr)}</h3>
      <div class="deal-ticket-meta"><span>${I.pin} ${L(city.en, city.ar)}</span><span>${sec.icon} ${L(sec.en, sec.ar)}</span></div>
      <p class="text-soft">${L(t.descEn, t.descAr)}</p>
      <div class="deal-ticket-stat"><span>${L(t.statEn, t.statAr)}</span><b>${L(t.valueEn, t.valueAr)}</b></div>
      <div class="deal-ticket-foot"><span>${L(t.postedEn, t.postedAr)}</span><button class="deal-ticket-btn" type="button">${L("Request intro", "طلب تعارف")}</button></div>
    </article>`;
  }).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("New — smart matching + deals", "جديد — مطابقة ذكية + صفقات")}</span>
    <h1>${L("We don't just list deals — we match you with the right partner", "ما نعرض لك صفقات فقط — نطابقك مع الشريك الصح")}</h1>
    <p class="lead">${L("Submit your deal or file once, and we compare it instantly against every available opportunity by sector, city and deal type, then recommend the closest matches by name. Real introductions only happen with mutual consent.", "قدّم صفقتك أو ملفك مرة واحدة، ونقارنه فورًا بكل الفرص المتاحة حسب القطاع والمدينة ونوع الصفقة، ونرشّح لك أقرب النتائج بالاسم. التعارف الفعلي لا يتم إلا بعد موافقة الطرفين.")}</p>
    <div class="hero-actions">
      <button class="btn btn-primary btn-lg" id="deal-open-hero" type="button">${L("Submit your deal now", "قدّم صفقتك الآن")}</button>
      <a class="btn btn-ghost btn-lg" href="#deal-wall">${L("Browse published deals", "تصفح الصفقات المنشورة")}</a>
    </div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Manual review before publishing", "مراجعة يدوية قبل النشر")}</span>
      <span class="hero-badge">${I.check}${L("Automatic match score", "نسبة تطابق محسوبة تلقائيًا")}</span>
      <span class="hero-badge">${I.check}${L("Mutual-consent introductions only", "تعارف بموافقة الطرفين فقط")}</span>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><h2>${L("Choose what applies to your situation", "اختر ما ينطبق على وضعك")}</h2><p>${L("Every type goes through the same submission, matching and review journey.", "كل نوع يمر بنفس رحلة التقديم والمطابقة والمراجعة.")}</p></div>
    <div class="grid grid-3">${launcher}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><h2>${L("From submission to introduction", "من التقديم إلى التعارف")}</h2></div>
    <div class="home-steps">${steps}</div>
  </div></section>

  <section class="section" id="deal-wall"><div class="container">
    <div class="section-head"><h2>${L("Deals published this week", "الصفقات المنشورة هذا الأسبوع")}</h2><p>${L("Browse for free, or submit your file so the system calculates your closest matches automatically.", "تصفح مجانًا، أو قدّم ملفك ليحسب النظام أقرب المطابقات لك تلقائيًا.")}</p></div>
    <div class="deal-filters">${chips}<span class="deal-filters-count"><span id="deal-visible-count">0</span> ${L("deals visible", "صفقة ظاهرة")}</span></div>
    <div class="grid grid-3" id="deal-wall-grid">${tickets}</div>
    <div class="center mt-32"><button class="btn btn-primary" id="deal-open-bottom" type="button">${L("Add your deal to the wall", "أضف صفقتك للحائط")}</button></div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="deal-trust">
      <span>🔒 ${L("Manual review before publishing", "مراجعة يدوية قبل النشر")}</span>
      <span>🎯 ${L("Automatically calculated match score", "نسبة تطابق محسوبة تلقائيًا")}</span>
      <span>🤝 ${L("Mutual-consent introductions only", "تعارف بموافقة الطرفين فقط")}</span>
      <span>✉️ ${L("Instant email updates", "تحديثات فورية بالبريد")}</span>
    </div>
  </div></section>

  <div class="deal-scrim" id="deal-scrim"></div>
  <aside class="deal-drawer" id="deal-drawer" role="dialog" aria-label="${Lraw("Submit a deal", "تقديم صفقة")}">
    <div class="deal-drawer-head">
      <b>${L("Submit your file and get matches", "قدّم ملفك واحصل على مطابقات")}</b>
      <button class="deal-drawer-close" id="deal-drawer-close" type="button" aria-label="${Lraw("Close", "إغلاق")}">${I.close}</button>
    </div>
    <div class="deal-drawer-progress"><div class="deal-drawer-bar" id="deal-drawer-bar"></div></div>
    <div class="deal-drawer-body">
      <div class="deal-step active" data-step="1">
        <h4>${L("Step 1 — Deal type", "الخطوة 1 — نوع الصفقة")}</h4>
        <p class="hint">${L("Choose what applies to your current situation", "اختر ما ينطبق على وضعك الحالي")}</p>
        <div class="deal-type-pick">
          <label class="deal-type-opt" data-kind="offer"><input type="radio" name="dealType" value="offer" checked><span class="tico">🤝</span><span><b>${L("I have a deal to offer", "عندي صفقة أعرضها")}</b><span class="sub">${L("Partnership, distribution, ready financing", "شراكة، توزيع، تمويل جاهز")}</span></span></label>
          <label class="deal-type-opt" data-kind="seek"><input type="radio" name="dealType" value="seek"><span class="tico">🔎</span><span><b>${L("I'm looking for a partner", "أبحث عن شريك")}</b><span class="sub">${L("For an existing project that needs funding or operations", "لمشروع قائم يحتاج تمويل أو تشغيل")}</span></span></label>
          <label class="deal-type-opt" data-kind="idea"><input type="radio" name="dealType" value="idea"><span class="tico">💡</span><span><b>${L("I have a project idea", "عندي فكرة مشروع")}</b><span class="sub">${L("Looking for a co-founder or funder", "أبحث عن شريك مؤسس أو ممول")}</span></span></label>
        </div>
      </div>
      <div class="deal-step" data-step="2">
        <h4>${L("Step 2 — Deal details", "الخطوة 2 — تفاصيل الصفقة")}</h4>
        <p class="hint">${L("These fields are what the match calculation uses", "هذه الحقول هي ما يُستخدم لحساب المطابقة")}</p>
        <div class="field"><label for="deal-title">${L("Deal title", "عنوان الصفقة")}</label><input type="text" id="deal-title" placeholder="${Lraw("e.g. Restaurant looking for a funding partner", "مثال: مطعم يبحث عن شريك مموّل")}"></div>
        <div class="grid grid-2" style="gap:0 16px">
          <div class="field"><label for="deal-sector">${L("Sector", "القطاع")}</label><select id="deal-sector">${sectorOptions}</select></div>
          <div class="field"><label for="deal-city">${L("City", "المدينة")}</label><select id="deal-city">${cityOptions}</select></div>
        </div>
        <div class="field"><label for="deal-desc">${L("Deal description", "وصف الصفقة")}</label><textarea id="deal-desc" rows="4" placeholder="${Lraw("Briefly explain the idea or deal...", "اشرح الفكرة أو الصفقة بإيجاز...")}"></textarea></div>
      </div>
      <div class="deal-step" data-step="3">
        <h4>${L("Step 3 — Contact details", "الخطوة 3 — بيانات التواصل")}</h4>
        <p class="hint">${L("Your data is never shown publicly — only revealed after the other party agrees to the introduction", "لن تظهر بياناتك للعامة أبدًا — تُكشف فقط بعد موافقة الطرف الآخر على التعارف")}</p>
        <div class="grid grid-2" style="gap:0 16px">
          <div class="field"><label for="deal-name">${L("Name", "الاسم")}</label><input type="text" id="deal-name" placeholder="${Lraw("Your full name", "اسمك الكامل")}"></div>
          <div class="field"><label for="deal-phone">${L("Mobile", "الجوال")}</label><input type="tel" id="deal-phone" inputmode="tel" placeholder="05XXXXXXXX"></div>
        </div>
        <div class="field"><label for="deal-email">${L("Email", "البريد الإلكتروني")}</label><input type="email" id="deal-email" placeholder="name@email.com"></div>
        <label class="deal-consent"><input type="checkbox" id="deal-consent" checked><span>${L("I agree to have my file reviewed by the Business Partner team before publishing, and to receive email about any match or introduction request.", "أوافق على مراجعة ملفي من فريق بيزنس بارتنر قبل نشره، وعلى تلقّي بريد بأي مطابقة أو طلب تعارف.")}</span></label>
        <div id="deal-wiz-message" class="deal-wiz-message" hidden></div>
      </div>
      <div class="deal-step" data-step="4">
        <h4>${L("Step 4 — Your closest matches", "الخطوة 4 — أقرب المطابقات لك")}</h4>
        <p class="hint">${L("Calculated by sector, city and deal type — your data isn't shown to them unless they agree to the introduction request", "محسوبة حسب القطاع والمدينة ونوع الصفقة — لن تظهر بياناتك لهم إلا إذا وافقوا على طلب التعارف")}</p>
        <div class="deal-match-list" id="deal-match-results"></div>
      </div>
      <div class="deal-step" data-step="5">
        <div class="deal-wiz-success">
          <div class="deal-wiz-check">${I.check}</div>
          <h4>${L("Your file was received", "وصلنا ملفك بنجاح")}</h4>
          <p class="text-soft">${L("Saved in our system and will be reviewed by the team within 24 hours — we'll confirm by email once it's published and on every new match.", "حُفظ في نظامنا وسيراجعه الفريق خلال 24 ساعة، وسنرسل لك تأكيدًا بالبريد عند النشر وعند كل مطابقة جديدة.")}</p>
        </div>
      </div>
    </div>
    <div class="deal-drawer-foot" id="deal-drawer-foot">
      <button class="btn btn-ghost" id="deal-step-back" type="button">${L("Back", "السابق")}</button>
      <button class="btn btn-primary" id="deal-step-next" type="button">${L("Next", "التالي")}</button>
    </div>
  </aside>`;
  return page({ title: Lraw("Deals & Smart Matchmaking — Business Partner", "الصفقات والمطابقة الذكية — بيزنس بارتنر"), desc: Lraw("Offer a deal, look for a partner, or pitch an idea — we automatically match you with the closest opportunities by sector and city, and never reveal your data until both sides agree.", "اعرض صفقتك، ابحث عن شريك، أو اطرح فكرتك — نطابقك تلقائيًا مع أقرب الفرص حسب القطاع والمدينة، ولا نكشف بياناتك إلا بعد موافقة الطرفين."), active: "/deals", path: "/deals", body });
}

/* ---------- Investment opportunities / major Saudi projects (/opportunities) ---------- */
function buildOpportunities() {
  const chips = [["all", L("All", "الكل")], ...MO_SECTORS.map((s) => [s.key, `${s.icon} ${L(s.en, s.ar)}`])]
    .map((c, i) => `<button class="deal-chip mo-chip${i === 0 ? " active" : ""}" data-mo="${c[0]}" type="button">${c[1]}</button>`).join("");
  const cards = MARKET_OPPORTUNITIES.map((o) => {
    const sec = MO_SECTORS.find((s) => s.key === o.sector);
    return `<article class="card deal-ticket mo-card" data-sector="${o.sector}">
      <span class="deal-badge offer">${sec.icon} ${L(sec.en, sec.ar)}</span>
      <h3>${L(o.titleEn, o.titleAr)}</h3>
      <div class="deal-ticket-meta"><span>${I.pin} ${L(o.regEn, o.regAr)}</span><span>${esc(L(o.projEn, o.projAr))}</span></div>
      <p class="text-soft">${L(o.sumEn, o.sumAr)}</p>
      <div class="deal-ticket-stat"><span>${L("Est. value", "القيمة التقديرية")}</span><b>${L(o.valEn, o.valAr)}</b></div>
      <div class="mo-tags" style="margin-top:10px;font-size:13px;color:#0B1B5A;font-weight:600">${L(o.tagsEn, o.tagsAr)}</div>
      <div class="deal-ticket-foot"><a href="${o.src}" target="_blank" rel="noopener">${L("Source", "المصدر")}</a><a class="deal-ticket-btn" href="${u("/contact")}">${L("Register interest", "سجّل اهتمامك")}</a></div>
    </article>`;
  }).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Saudi giga-projects & tenders", "مشاريع المملكة الكبرى والمنافسات")}</span>
    <h1>${L("Investment opportunities & major projects in Saudi Arabia", "الفرص الاستثمارية والمشاريع الكبرى في المملكة")}</h1>
    <p class="lead">${L("We continuously track Saudi giga-projects and government tenders across every sector, then position our clients as vendors, subcontractors, operators or co-investors. Each opportunity links to its public source.", "نرصد باستمرار المشاريع العملاقة والمنافسات الحكومية في السعودية عبر كل القطاعات، ثم نُموضِع عملاءنا كموردين أو مقاولي باطن أو مشغّلين أو شركاء استثمار. كل فرصة مرتبطة بمصدرها العام.")}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${u("/contact")}">${L("Talk to us about an opportunity", "كلّمنا عن فرصة تناسبك")}</a>
      <a class="btn btn-ghost btn-lg" href="${u("/saudi-arabia")}">${L("Investment knowledge center", "مركز المعرفة الاستثمارية")}</a>
    </div>
  </div></section>

  <section class="section" id="market-opportunities"><div class="container">
    <div class="deal-filters">${chips}<span class="deal-filters-count"><span id="mo-count">0</span> ${L("opportunities", "فرصة")}</span></div>
    <div class="grid grid-3" id="mo-grid">${cards}</div>
    <p class="text-soft center mt-24" style="font-size:13px">${L("A curated sample of publicly sourced opportunities, updated periodically. Values are indicative. Not an offer or investment advice. Looking for a business partnership or deal for your SME? Visit the ", "نماذج مختارة من فرص عامة موثّقة المصادر، تُحدَّث دورياً. القيم تقديرية. هذا ليس عرضاً أو نصيحة استثمارية. تبحث عن شراكة أو صفقة لمنشأتك الصغيرة/المتوسطة؟ زُر ")}<a href="${u("/deals")}">${L("Deals page", "صفحة الصفقات")}</a>.</p>
  </div></section>
  <script>(function(){var g=document.getElementById('mo-grid');if(!g)return;var chips=document.querySelectorAll('.mo-chip');var cnt=document.getElementById('mo-count');function apply(f){var n=0;g.querySelectorAll('.mo-card').forEach(function(c){var show=f==='all'||c.getAttribute('data-sector')===f;c.style.display=show?'':'none';if(show)n++;});if(cnt)cnt.textContent=n;}chips.forEach(function(ch){ch.addEventListener('click',function(){chips.forEach(function(x){x.classList.remove('active');});ch.classList.add('active');apply(ch.getAttribute('data-mo'));});});apply('all');})();</script>`;
  return page({ title: Lraw("Investment Opportunities in Saudi Arabia — Business Partner", "الفرص الاستثمارية في المملكة — بيزنس بارتنر"), desc: Lraw("Major Saudi giga-projects and government tenders we track — enter as a vendor, subcontractor, operator or co-investor. Each links to its public source.", "أبرز المشاريع العملاقة والمنافسات الحكومية في السعودية التي نرصدها — ادخل كمورد أو مقاول باطن أو مشغّل أو شريك استثمار. كل فرصة مرتبطة بمصدرها."), active: "/opportunities", path: "/opportunities", body });
}

function buildPackages() {
  const p = site.packages;
  const groups = p.groups || [{ key: "business", ar: p.title, en: p.titleEn, descAr: p.subtitle, descEn: p.subtitleEn, tiers: p.tiers }];
  // Same annual-billing policy already established for employer packages
  // (site.employerPlans.yearlyDiscount, 30%) — reused here so the two billing
  // toggles on the site behave identically, not a new/invented number.
  const yearlyDiscount = (site.employerPlans && site.employerPlans.yearlyDiscount) || 0;
  const fmt = (n) => Number(n).toLocaleString(LANG === "ar" ? "ar-SA" : "en-US");
  const isMonthly = (t) => /شهري|monthly/i.test(t.priceEn || t.price || "");
  const tierCard = (t) => {
    const monthly = t.amount != null && isMonthly(t);
    const name = L(t.nameEn || t.name || t.nameAr, t.nameAr);
    const feats = `<ul>${t.features.map((f, i) => `<li>${I.check}<span>${L((t.featuresEn && t.featuresEn[i]) || f, f)}</span></li>`).join("")}</ul>`;
    const badgeAttr = t.highlight ? ` data-badge="${esc(L(t.badgeEn || "Most requested", t.badgeAr || "الأكثر طلباً"))}"` : "";
    if (monthly) {
      const yearly = employerYearly(t.amount, yearlyDiscount);
      const nameAr = `${t.nameAr} — اشتراك شهري`;
      const nameEn = `${t.nameEn || t.name} — Monthly subscription`;
      const priceLabelM = `${fmt(t.amount)} ${L("SAR / mo", "ريال / شهرياً")}`;
      const priceLabelY = `${fmt(yearly)} ${L("SAR / yr", "ريال / سنوياً")}`;
      return `<div class="pkg${t.highlight ? " pop" : ""}"${badgeAttr}>
        <div class="pk-name">${esc(name)}</div>
        ${SHOW_PRICES ? `<div class="pk-price"><span class="emp-price emp-price-m">${fmt(t.amount)} <span class="pk-per">${L("SAR / mo", "ريال / شهرياً")}</span></span><span class="emp-price emp-price-y" hidden>${fmt(yearly)} <span class="pk-per">${L("SAR / yr", "ريال / سنوياً")}</span></span></div>` : ""}
        <p class="pk-for">${L(t.forEn || t.for, t.for)}</p>
        ${feats}
        <button type="button" class="btn ${t.highlight ? "btn-primary" : "btn-ghost"} add-cart emp-plan-btn" style="width:100%"
          data-id="pkg-${esc(t.key)}-monthly" data-kind="package"
          data-name-ar="${esc(nameAr)}" data-name-en="${esc(nameEn)}"
          data-amount="${t.amount}" data-price="${esc(priceLabelM)}"
          data-id-monthly="pkg-${esc(t.key)}-monthly" data-id-yearly="pkg-${esc(t.key)}-yearly"
          data-amount-monthly="${t.amount}" data-amount-yearly="${yearly}"
          data-price-monthly="${esc(priceLabelM)}" data-price-yearly="${esc(priceLabelY)}"
        >🛒 ${L("Add to cart", "أضف إلى السلة")}</button>
      </div>`;
    }
    return `<div class="pkg${t.highlight ? " pop" : ""}"${badgeAttr}>
      <div class="pk-name">${esc(name)}</div>
      ${SHOW_PRICES && t.price ? `<div class="pk-price">${esc(localizeLabel(L(t.priceEn || t.price, t.price)))}</div>` : ""}
      <p class="pk-for">${L(t.forEn || t.for, t.for)}</p>
      ${feats}
      ${cartBtns({ id: "pkg-" + (t.key || t.name), nameEn: t.nameEn || t.name || t.nameAr, nameAr: t.nameAr, amount: t.amount != null ? t.amount : null, priceLabel: L(t.priceEn || t.price, t.price) || Lraw("Contact us for pricing", "تواصل معنا للتسعير"), kind: "package", ghost: !t.highlight, surchargeAmount: t.surchargeAmount, surchargeFreeCount: t.surchargeFreeCount })}
      ${SHOW_PRICES && (t.surcharge || t.surchargeEn) ? `<p class="pk-surcharge">${L(t.surchargeEn || t.surcharge, t.surcharge)}</p>` : ""}
    </div>`;
  };
  const tabs = groups
    .map((g, i) => `<button type="button" class="pk-tab${i === 0 ? " active" : ""}" data-group="${esc(g.key)}">${L(g.en, g.ar)}</button>`)
    .join("");
  const panels = groups
    .map((g, i) => {
      const hasMonthly = SHOW_PRICES && yearlyDiscount > 0 && g.tiers.some(isMonthly);
      const billingToggle = hasMonthly
        ? `<div class="emp-billing-toggle" role="tablist">
            <button type="button" class="emp-bill-btn active" data-bill="monthly">${L("Monthly", "شهري")}</button>
            <button type="button" class="emp-bill-btn" data-bill="yearly">${L("Yearly", "سنوي")} <span class="emp-save">${L(`Save ${Math.round(yearlyDiscount * 100)}%`, `وفّر ${Math.round(yearlyDiscount * 100)}٪`)}</span></button>
          </div>`
        : "";
      return `<div class="pk-panel${i === 0 ? " active" : ""}" id="pkg-${esc(g.key)}">
      ${g.descAr || g.descEn ? `<p class="pk-group-desc">${L(g.descEn || g.descAr, g.descAr || g.descEn)}</p>` : ""}
      ${billingToggle}
      <div class="grid grid-${g.tiers.length >= 4 ? 4 : g.tiers.length === 2 ? 2 : 3}">${g.tiers.map(tierCard).join("")}</div>
    </div>`;
    })
    .join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Packages", "الباقات")}</span>
    <h1>${L("Choose the package that fits your establishment", "اختر الباقة التي تناسب منشأتك")}</h1>
    <p class="lead">${L("Four annual service packages, plus one-time company-formation and investment services — all from our official catalog.", "أربع باقات خدمات سنوية، وخدمات تأسيس شركات واستثمار لمرة واحدة — كلها من الكتالوج الرسمي.")}</p>
    <p style="margin-top:14px"><a class="btn btn-ghost" href="${u("/calculator")}">🧮 ${L("Or design your own basket from the full catalog →", "أو صمّم سلّتك الخاصة من الكتالوج الكامل ←")}</a></p>
  </div></section>
  <section class="section"><div class="container">
    <div class="pk-tabs" role="tablist">${tabs}</div>
    ${panels}
    <div class="callout" style="max-width:760px;margin:36px auto 0"><span class="ico">💡</span><p>${L(p.noteEn || p.note, p.note)}</p></div>
  </div></section>
  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How to subscribe", "كيف تشترك؟")}</span><h2>${L("Four steps from registering to activation", "أربع خطوات من التسجيل إلى التفعيل")}</h2></div>
    <div class="steps-grid">${[
      [L("Register / log in", "سجّل أو سجّل دخولك"), L("Create your account on the site.", "أنشئ حسابك في الموقع.")],
      [L("Add the package to your cart", "أضف الباقة للسلة"), L("Then complete checkout by bank transfer.", "ثم أكمل الدفع عبر تحويل بنكي.")],
      [L("We confirm your transfer", "نتحقق من تحويلك"), L("Once confirmed, your subscription is activated and you're notified.", "بمجرد التأكيد، يُفعَّل اشتراكك ويصلك إشعار.")],
      [L("We start managing your account", "نبدأ إدارة حسابك"), L("Your dedicated team starts work on the platforms covered by your package.", "فريقك المخصّص يبدأ العمل على المنصات المشمولة بباقتك.")],
    ].map(([t, d], i) => `<div class="step"><div class="step-n">${i + 1}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join("")}</div>
    <div class="hero-actions" style="margin-top:1.4rem">
      <a class="btn btn-primary btn-lg" href="${u("/account")}">${L("Register / log in", "سجّل أو سجّل دخولك")}</a>
      <a class="btn btn-ghost btn-lg" href="${u("/account")}">🔐 ${L("Already subscribed? Open your dashboard", "مشترك بالفعل؟ افتح لوحتك")}</a>
    </div>
  </div></section>
  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Not sure which package fits you?", "محتار أي باقة تناسبك؟")}</h2><p>${L("The smart agent asks a few questions and recommends the best package in minutes.", "الوكيل الذكي يسألك بضعة أسئلة ويرشّح لك الباقة الأنسب في دقائق.")}</p>${waBtn2("Help me choose", "ساعدني أختار", "btn-white", true)}</div>
  </div></section>
  <script>window.BP_PKG_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var tabs=document.querySelectorAll(".pk-tab");
    function activate(group){
      tabs.forEach(function(x){x.classList.remove("active");});
      document.querySelectorAll(".pk-panel").forEach(function(x){x.classList.remove("active");});
      var tab=document.querySelector('.pk-tab[data-group="'+group+'"]');
      var panel=document.getElementById("pkg-"+group);
      if(tab)tab.classList.add("active");
      if(panel)panel.classList.add("active");
    }
    tabs.forEach(function(t){t.addEventListener("click",function(){activate(t.dataset.group);});});
    var hashGroup=(location.hash||"").replace("#pkg-","");
    if(hashGroup)activate(hashGroup);
  })();
  </script>`;
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
          // Request builder only — no prices embedded. Every service is
          // quoted to the client's case; the calculator just collects a basket.
          id: s.code,
          nameEn: m.en || (ov && ov.nameEn) || s.name,
          nameAr: m.ar || (ov && ov.name) || s.name,
          slug: s.slug,
        };
      }),
    };
  });

  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Build your request", "كوّن طلبك")}</span>
    <h1>${L("Build your service basket", "كوّن سلّة خدماتك")}</h1>
    <p class="lead">${L("Pick the services you need from the official catalog by category. When you're done, request an official quote for your case or book a free consultation — every service is priced to your situation.", "اختر الخدمات اللي تحتاجها حسب التصنيف من الكتالوج الرسمي. وبعد ما تخلّص، اطلب عرضاً رسمياً لحالتك أو احجز استشارة مجانية — كل خدمة تُسعّر حسب وضعك.")}</p>
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
          <a class="btn btn-primary btn-lg" id="calc2-quote" href="${u("/account")}?redirect=quote" style="width:100%" hidden>${L("Request an official quote by email", "اطلب عرضاً رسمياً بالبريد")}</a>
          <a class="btn btn-ghost btn-lg" href="${u("/consultation")}" style="width:100%">${I.calendar}<span>${L("Book a free consultation", "احجز استشارة مجانية")}</span></a>
          <p class="calc-note">${L("No prices shown — each service is quoted to your case. Pick what you need and we'll send you an official quote. Government fees are always separate.", "بدون أسعار معروضة — كل خدمة تُسعّر حسب حالتك. اختر ما تحتاجه ونرسل لك عرضاً رسمياً. الرسوم الحكومية منفصلة دائماً.")}</p>
        </div>
      </aside>
    </div>
  </div></section>
  <script>window.BP_CALC = ${JSON.stringify(groups)};window.BP_CALC_LANG = ${JSON.stringify(LANG)};</script>`;
  return page({ title: Lraw("Build your service request — Business Partner", "كوّن طلب خدماتك — بيزنس بارتنر"), desc: Lraw("Pick Business Partner services from the official catalog and request an official quote or book a consultation — each service is priced to your case.", "اختر خدمات بيزنس بارتنر من الكتالوج الرسمي واطلب عرضاً رسمياً أو احجز استشارة — كل خدمة تُسعّر حسب حالتك."), active: "/calculator", body });
}

// Qiwa-style tools directory: one clean grid of cards, each linking straight
// to its calculator/tool (deep-linked via #hash into the right tab).
function buildToolsHub() {
  const tools = [
    { icon: "🏆", title: L("End-of-service gratuity", "حاسبة مكافأة نهاية الخدمة"), desc: L("Calculate the end-of-service gratuity per the Saudi Labor Law.", "احسب مكافأة نهاية الخدمة وفق نظام العمل السعودي."), href: u("/calculators/end-of-service") },
    { icon: "🏖️", title: L("Annual leave", "حاسبة الإجازة السنوية"), desc: L("Leave entitlement and the cash value of unused days.", "استحقاق الإجازة والقيمة النقدية للأيام غير المستخدمة."), href: u("/calculators/annual-leave") },
    { icon: "⏱️", title: L("Overtime", "حاسبة العمل الإضافي"), desc: L("Overtime pay at the 1.5x rate per the Labor Law.", "أجر العمل الإضافي بمعدل 1.5× وفق نظام العمل."), href: u("/calculators/overtime") },
    { icon: "🏦", title: L("GOSI contributions", "حاسبة اشتراك التأمينات (GOSI)"), desc: L("Monthly social-insurance contributions, Saudi & non-Saudi.", "الاشتراكات الشهرية للتأمينات، للسعودي وغير السعودي."), href: u("/calculators/gosi") },
    { icon: "💰", title: L("Government cost calculator", "حاسبة التكاليف الحكومية"), desc: L("Estimate visa, Iqama and platform fees for your headcount.", "قدّر رسوم التأشيرات والإقامات والمنصات حسب عدد موظفيك."), href: u("/calculators/government-cost") },
    { icon: "🧑‍💼", title: L("Profession checker", "فاحص المهن"), desc: L("Check which professions are Saudized or restricted for your activity.", "تحقق من المهن المُوطّنة أو المقيّدة على نشاطك."), href: u("/calculators/profession-checker") },
  ];
  const cards = tools.map((t) => `<a class="card cat-card" href="${t.href}">
    <div class="cat-card-icon">${t.icon}</div>
    <h3>${t.title}</h3>
    <p class="desc">${t.desc}</p>
    <div class="foot"><span></span><span class="card-link">${L("Open", "فتح")} ${I.arrow}</span></div>
  </a>`).join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Knowledge Center", "مركز المعرفة")}</span>
    <h1>${L("Tools & calculators", "الأدوات والحاسبات")}</h1>
    <p class="lead">${L("Free, instant calculators for payroll, Saudization and compliance — plus the compliance portal for a fully managed file.", "حاسبات مجانية وفورية للرواتب والتوطين والامتثال — بالإضافة إلى بوابة الامتثال لملف مُدار بالكامل.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3 cat-grid">${cards}</div>
  </div></section>`;
  return page({ title: Lraw("Tools & calculators — Business Partner", "الأدوات والحاسبات — بيزنس بارتنر"), desc: Lraw("Free labor, payroll, Saudization and compliance calculators.", "حاسبات مجانية للعمل والرواتب والتوطين والامتثال."), active: "/tools-and-calculators", path: "/tools-and-calculators", body });
}

function buildNitaqatCalculator() {
  let ACT_V = "0";
  try { ACT_V = assetV("assets/data/activities.json"); } catch { /* file generated separately */ }
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free compliance tool", "أداة امتثال مجانية")}</span>
    <h1>${L("Nitaqat calculator", "حاسبة النطاقات")}</h1>
    <p class="lead">${L("Estimate your Saudization (Nitaqat) band in seconds, per the official Developed-Nitaqat formula.", "احسب نطاق السعودة المتوقع لمنشأتك خلال ثوانٍ، وفق معادلة نطاقات المطوّر الرسمية.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
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
      <p class="form-note">💡 ${L("Don't know your exact numbers?", "ما تعرف أعدادك بدقة؟")} <a href="${u("/compliance-agent")}">${L("Subscribe to the Compliance Agent — it reads your GOSI/Qiwa/Muqeem files and tracks them for you →", "اشترك في وكيل الامتثال — يقرأ ملفات التأمينات/قوى/مقيم ويتابعها عنك ←")}</a></p>
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
    <div class="cc-disclaimer">⚖️ ${L("Estimates are for illustration only. Official bands depend on your activity and size in Qiwa. Contact us for a verified calculation.", "الأرقام تقديرية للتوضيح فقط. النطاق الرسمي يعتمد على نشاط المنشأة وحجمها في منصة قوى. تواصل معنا لحساب دقيق ومعتمد.")}</div>
  </div></section>
  <script>window.BP_CC_LANG=${JSON.stringify(LANG)};window.BP_ACT_URL=${JSON.stringify("/assets/data/activities.json?v=" + ACT_V)};window.BP_PROF_URL=${JSON.stringify(u("/calculators/profession-checker"))};</script>
  <script>
  (function(){
    var isAr = window.BP_CC_LANG === "ar";
    var T = isAr ? {
      bands:{red:"أحمر",low:"أخضر منخفض",mid:"أخضر متوسط",high:"أخضر مرتفع",platinum:"بلاتيني",exempt:"معفاة (1–5 موظفين)"},
      ok:"منشأتك ضمن النطاق الآمن ✅",need:"تحتاج توظيف {n} سعودي للخروج من النطاق الأحمر",next:"توظيف {n} سعودي إضافي يرفعك إلى: {b}",top:"أنت في أعلى نطاق — حافظ عليه 👏",
      microOk:"منشأة صغيرة جداً (1–5): معاملة مبسّطة — أخضر بوجود سعودي واحد على الأقل ✅",microNeed:"منشأة صغيرة جداً (1–5): وظّف سعودياً واحداً على الأقل للخروج من الأحمر",thTitle:"الحدود الدنيا الرسمية لنشاط «{act}» بحجم كيانك:"
    } : {
      bands:{red:"Red",low:"Low Green",mid:"Mid Green",high:"High Green",platinum:"Platinum",exempt:"Exempt (1–5 employees)"},
      ok:"Your establishment is in the safe zone ✅",need:"You need {n} more Saudi hire(s) to exit the red band",next:"Hiring {n} more Saudi(s) moves you up to: {b}",top:"You are in the top band — keep it up 👏",
      microOk:"Micro establishment (1–5): simplified treatment — green with at least one Saudi ✅",microNeed:"Micro establishment (1–5): hire at least one Saudi to exit red",thTitle:"Official band floors for '{act}' at your entity size:"
    };
    var $=function(id){return document.getElementById(id);};
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

    var PROF=[{"g":"مهن الطيران المرخصة","en":"Aviation","type":"قطاعي","pct":70,"prof":"مراقب جوي (100%)، ملاح جوي (100%)، منسق حركة أرضية (100%)، مساعد طيار (100%)، طيار جناح ثابت (70%)، مضيف طيران (60%)","minw":5,"body":"الهيئة العامة للطيران المدني (GACA)","dec":"#208818","note":"النسب تختلف حسب المهنة (60-100%)"},{"g":"إدارة المشاريع","en":"Project Management","type":"نسبة توطين","pct":40,"prof":"مدير إدارة مشاريع، أخصائي إدارة مشاريع، مهندس إدارة مشاريع، مدير اتصالات، مدير هندسة اتصالات","minw":3,"sal":6000,"dec":"#141749","note":"المرحلة الثانية 40%"},{"g":"مهن التسويق","en":"Marketing","type":"نسبة توطين","pct":60,"prof":"مدير تسويق، وكيل دعاية وإعلان، مدير دعاية وإعلان، مصمم جرافيك، مصور فوتوغرافي، أخصائي علاقات عامة، أخصائي دعاية وإعلان، أخصائي تسويق، مدير علاقات عامة، مصمم إعلان","minw":3,"sal":5500,"dec":"#101319"},{"g":"المادة 11 — مهن مقصورة على السعوديين","en":"Article 11 — Saudi-Only","type":"مقصورة على السعوديين","pct":100,"prof":"إداري موارد بشرية، مشرف موارد بشرية، مسؤول شؤون عمال، اختصاصي شؤون أفراد، كاتب شؤون أفراد، كاتب توظيف، كاتب شؤون موظفين، كاتب دوام، كاتب استقبال عام، استقبال فندقي، استقبال مرضى، كاتب شكاوى، أمين صندوق، حارس أمن خاص، معقب، ناسخ/مصلّح مفاتيح، مخلّص جمركي","minw":1,"dec":"اللائحة التنفيذية لنظام العمل","note":"لا يُسمح لغير السعوديين بالعمل فيها بموجب المادة 11"},{"g":"البصريات","en":"Optics","type":"قطاعي","pct":50,"prof":"فني بصريات طبية، فني نظارات","minw":4,"sal":5500,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#208837"},{"g":"الأجهزة الطبية","en":"Medical Devices","type":"قطاعي","pct":80,"prof":"أخصائي مبيعات مستلزمات طبية، مبيعات منتجات صيدلانية، فني أجهزة طبية، مُجمع أجهزة طبية، مهندس أجهزة طبية","minw":1,"sal":7000,"dec":"#48081","note":"المرحلة 2: 80% مبيعات، 50% هندسي/فني"},{"g":"مهن خدمة العملاء عن بعد","en":"Remote Customer Service","type":"مقصورة على السعوديين","pct":100,"prof":"جميع مهن خدمة العملاء عن بعد (هاتف، إيميل، شات، سوشال ميديا)","minw":1,"dec":"#112203"},{"g":"مهن المبيعات","en":"Sales","type":"نسبة توطين","pct":60,"prof":"مدير مبيعات، مدير مبيعات تجزئة، مدير مبيعات جملة، مندوب مبيعات، وسيط سلع مستقبلية، أخصائي مبيعات أجهزة تقنية المعلومات والاتصالات، أخصائي مبيعات، أخصائي تجاري، وسيط سلع","minw":3,"dec":"#101278"},{"g":"المختبرات الطبية","en":"Medical Labs","type":"قطاعي","pct":70,"prof":"مدير مختبر تحاليل طبية، أخصائي مختبرات طبية/سريرية، فني مختبر طبي، فني مختبرات","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51267"},{"g":"مهن المشتريات","en":"Procurement","type":"نسبة توطين","pct":70,"prof":"مدير مشتريات، أخصائي مناقصات، مندوب مشتريات، أخصائي مشتريات، مدير عقود، مدير خدمات لوجستية، مدير مستودع، أمين مستودع فني، أخصائي مستودعات، أخصائي تجارة إلكترونية، أخصائي أبحاث أسواق","minw":3,"dec":"#77050"},{"g":"طب الأسنان","en":"Dentistry","type":"قطاعي","pct":55,"prof":"طبيب أسنان عام، جراح فم ووجه وفكين، تقويم أسنان، أسنان أطفال، معالجة لبية، تخدير أسنان","minw":3,"sal":9000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#103107","note":"المرحلة الحالية 55% (من 27/01/2026م)"},{"g":"العلاج الطبيعي","en":"Physical Therapy","type":"قطاعي","pct":80,"prof":"أخصائي علاج طبيعي، فني علاج طبيعي","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51270","note":"7,000 للأخصائي / 5,000 للفني"},{"g":"الأنشطة والمهن العقارية","en":"Real Estate","type":"مقصورة على السعوديين","pct":100,"prof":"وسيط عقاري، وسيط بيع وتأجير عقارات، سمسار أراضي وعقارات، كاتب تسجيل أراضي وعقارات، مسّوق عقاري، مدير اتحاد ملاك، مهندس مستدام معتمد، مهندس مقيم معتمد، مهندس فاحص جودة، فاحص مباني جاهزة","minw":1,"dec":"#212535","note":"100% للمهن المحددة، 70% للنشاط العقاري العام"},{"g":"التخليص الجمركي","en":"Customs Clearance","type":"مقصورة على السعوديين","pct":100,"prof":"مخلص جمركي، مبند جمركي، مترجم، مدير عام، كاتب عام","minw":1,"sal":5000,"dec":"#212497","note":"100% للمهن المحددة، 70% للنشاط"},{"g":"الأشعة","en":"Radiology","type":"قطاعي","pct":65,"prof":"فني أشعة، أخصائي تقنية إشعاعية، فني أشعة علاجية، أخصائي وقاية إشعاعية، فني تصوير/قسطرة/تخطيط قلب","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51273"},{"g":"مشرف مسكن","en":"Housing Supervisor","type":"مقصورة على السعوديين","pct":100,"prof":"مشرف مسكن","minw":1,"dec":"#62298","note":"خاص بسكن العمال"},{"g":"المهن الإدارية المساندة","en":"Admin Support","type":"مقصورة على السعوديين","pct":100,"prof":"مترجم، سكرتير تنفيذي/سكرتير، مدخل بيانات، مخلص جمركي، استقبال فندق، أمين مخزن، كاتب موارد بشرية، حارس أمن، أمين صندوق + (م2) كل مهن الموارد البشرية (مدير/أخصائي توظيف/تعويضات/مواهب/تطوير)، العلاقات العامة، وكلاء الشحن/الجمارك","minw":1,"dec":"#132249","note":"م1 (19 مهنة) فورية من 05/04/2026؛ م2 (50 مهنة) مهلة حتى 04/10/2026"},{"g":"المهن القانونية","en":"Legal","type":"نسبة توطين","pct":70,"prof":"مدير شؤون قانونية، أخصائي قانوني، أخصائي عقود، سكرتير قانوني","minw":1,"sal":5500,"dec":"#212607"},{"g":"المهن المحاسبية","en":"Accounting","type":"قطاعي","pct":40,"prof":"مدير مالي، مدير حسابات/مراجعة، محاسب، محاسب تكاليف، مراقب مالي، مراجع داخلي، محاسب قانوني، كاتب حسابات، مساعد حسابات، مسؤول ضرائب","minw":3,"sal":6000,"body":"الهيئة السعودية للمراجعين والمحاسبين (SOCPA)","dec":"#103108","note":"تصاعدي 40→50→60→70% خلال 5 سنوات؛ متناهية الصغر (3-4 عمال) 30%"},{"g":"مدارس تعليم قيادة المركبات","en":"Driving Schools","type":"مقصورة على السعوديين","pct":100,"prof":"مراقب حركة مركبات، مدرب مهني، أخصائي وسائل تعليمية، مدرب القيادة","minw":1,"sal":5000,"dec":"#212519"},{"g":"المراكز والصالات الرياضية","en":"Sports Centers","type":"نسبة توطين","pct":15,"prof":"مدرب رياضي، مدرب لياقة بدنية، مدرب كرة قدم محترف، مدرب رياضة مضرب/مائية/جليدية/فروسية محترف، مشرف رياضي","minw":4,"dec":"#72002","note":"المنشآت المرخصة من وزارة الرياضة فقط"},{"g":"الصيدلة","en":"Pharmacy","type":"قطاعي","pct":35,"prof":"صيدلي، صيدلي رعاية صيدلانية، أخصائي علوم صيدلانية/أدوية، مدير صيدلة، أخصائي مبيعات منتجات صيدلانية","minw":5,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#103111","note":"صيدليات المجتمع 35% / المستشفيات 65% / شركات ومستودعات 55%"},{"g":"مراكز الاسترخاء والعناية الشخصية","en":"Relaxation & Personal Care","type":"مقصورة على السعوديين","pct":100,"prof":"مدير فرع/إداري/تسويق/خدمة عملاء/مبيعات/مشتريات، محاسب، مساعد إداري، سكرتير، مدخل بيانات، موظف استقبال، أمين مخزن، بائع، صندوق محاسبة","minw":1,"dec":"#68098","note":"100% للأدوار الإدارية والمساندة"},{"g":"التغذية العلاجية","en":"Clinical Nutrition","type":"قطاعي","pct":80,"prof":"أخصائي تغذية، أخصائي تغذية سريرية، فني تغذية، فني علوم أغذية","minw":1,"sal":7000,"body":"الهيئة السعودية للتخصصات الصحية","dec":"#51277"},{"g":"المهن الهندسية","en":"Engineering","type":"قطاعي","pct":30,"prof":"46 مهنة هندسية: مهندس مدني، معماري، ميكانيكي، كهربائي، صناعي، كيميائي، إلكترونيات، طيران، بحري، نووي، بيئي، نفط وغاز، تدفئة وتهوية وتكييف، إنشائي، توربينات، ميكاترونكس، وغيرها","minw":5,"sal":8000,"body":"الهيئة السعودية للمهندسين","dec":"#93483"},{"g":"مهن خدمة العملاء (حضوري)","en":"Customer Service In-Person","type":"نسبة توطين","pct":70,"prof":"مضيف أرضي للحجوزات، كاتب استعلامات سياحية، كاتب تذاكر سفر، كاتب مركز اتصالات، استعلامات خدمة عملاء، مأمور سنترال، مشغل مقسم هاتف، كاتب اتصال/استعلامات، كاتب إدخال/بيانات عملاء","minw":3,"dec":"#208892"},{"g":"المهن الفنية الهندسية","en":"Technical Engineering","type":"قطاعي","pct":30,"prof":"مساح (جيوديسي/أراضي/كميات)، رسام هندسي/معماري، فني هندسة مدنية/كهربائية/ميكانيكية/كيميائية، ميكانيكي طائرات، فني صيانة، مراقب جودة، مشرف موقع إنشائي، وغيرها","minw":5,"sal":5000,"body":"الهيئة السعودية للمهندسين","dec":"#103105"},{"g":"السينما","en":"Cinema","type":"مقصورة على السعوديين","pct":100,"prof":"مبيعات وإشرافي (100%)، فني (50%)","minw":1,"dec":"#212560","note":"المرحلة 1: 100% مبيعات وإشرافي | المرحلة 2: 50% فني"}];
    var PT=isAr?{saudi:"مقصورة على السعوديين",ratio:"نسبة توطين",sector:"قطاعي (بنشاطه)"}:{saudi:"Saudi-only",ratio:"Saudization ratio",sector:"Sector-based"};
    function badge(t){var c=t==="مقصورة على السعوديين"?"saudi":(t==="نسبة توطين"?"ratio":"sector");var lbl=isAr?t:(c==="saudi"?PT.saudi:(c==="ratio"?PT.ratio:PT.sector));return '<span class="cc-badge '+c+'">'+lbl+'</span>';}
    function esc2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

    /* — official CR activity finder: 2,700+ coded activities (ISIC4 master reference) — */
    var AT=isAr?{loading:"جارٍ تحميل قائمة الأنشطة الرسمية…",count:"{n} نشاط مطابق",none:"لا يوجد نشاط مطابق — جرّب كلمة أخرى أو اكتب الكود.",code:"الكود",sector:"القطاع",en:"الاسم الإنجليزي",nit:"نشاط نطاقات الأقرب (اختير تلقائياً — تأكد منه)",dec:"قرارات توطين قد تنطبق على نشاطك:",noDec:"لا توجد قرارات توطين خاصة مرتبطة مباشرة بهذا النشاط في مرجعنا — تسري عليه نسب نطاقات نشاطك أعلاه.",clear:"مسح النشاط",official:"النطاق الرسمي يُعتمد من منصة قوى.",prof:"افحص مهن نشاطك (حاسبة مستقلة) ↗"}:{loading:"Loading the official activities list…",count:"{n} matching activities",none:"No matching activity — try another word or type the code.",code:"Code",sector:"Sector",en:"English name",nit:"Closest Nitaqat activity (auto-selected — please verify)",dec:"Localization decisions that may apply to your activity:",noDec:"No specific localization decision is directly linked to this activity in our reference — your activity's Nitaqat ratios above apply.",clear:"Clear activity",official:"Your official band is confirmed on the Qiwa platform.",prof:"Check professions (separate tool) ↗"};
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
        ?'<div class="cc-act-dec"><div class="cc-act-dec-title">'+AT.dec+'</div>'+decs.map(function(d){return '<div class="cc-act-dec-row">'+badge(d.type)+'<span>'+esc2(isAr?d.g:(d.en||d.g))+' — '+d.pct+'%</span></div>';}).join("")+'<a class="cc-chip" href="'+window.BP_PROF_URL+'" target="_blank" rel="noopener">🧑‍💼 '+AT.prof+'</a></div>'
        :'<div class="cc-act-dec">'+AT.noDec+'</div>';
      actInfo.innerHTML='<button type="button" class="cc-act-clear" id="cc-act-clear">✕ '+AT.clear+'</button><h4>'+esc2(isAr?a[1]:(a[2]||a[1]))+'</h4><div class="cc-act-meta"><span><b>'+AT.code+':</b> '+a[0]+'</span><span><b>'+AT.sector+':</b> '+a[3]+' · '+esc2(isAr?sec[0]:(sec[1]||sec[0]))+'</span>'+(isAr&&a[2]?'<span><b>'+AT.en+':</b> '+esc2(a[2])+'</span>':'')+(mi>=0?'<span><b>'+AT.nit+':</b> '+esc2(isAr?NIT_DATA[mi].name:(NIT_DATA[mi].en||NIT_DATA[mi].name))+'</span>':'')+'</div>'+decHtml+'<div class="form-note" style="margin-top:8px">⚖️ '+AT.official+'</div>';
      actInfo.hidden=false;
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
    title: Lraw("Nitaqat calculator — Business Partner", "حاسبة النطاقات — بيزنس بارتنر"),
    desc: Lraw("Estimate your Saudization (Nitaqat) band in seconds.", "احسب نطاق السعودة المتوقع خلال ثوانٍ."),
    active: "/tools-and-calculators",
    path: "/calculators/nitaqat",
    body,
  });
}

function buildGovernmentCostCalculator() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free compliance tool", "أداة امتثال مجانية")}</span>
    <h1>${L("Government cost calculator", "حاسبة التكاليف الحكومية")}</h1>
    <p class="lead">${L("Estimate per-worker government costs (work permit, iqama, medical insurance, fines) in seconds.", "قدّر تكاليف العمالة الحكومية لكل عامل (رخصة العمل، الإقامة، التأمين الطبي، الغرامات) خلال ثوانٍ.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
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
    <div class="cc-disclaimer">⚖️ ${L("Estimates are for illustration only. Official fees are confirmed via Qiwa / Muqeem / Passports. Contact us for a verified calculation.", "الأرقام تقديرية للتوضيح فقط. الرسوم الرسمية تُعتمد من قوى / مقيم / الجوازات. تواصل معنا لحساب دقيق ومعتمد.")}</div>
  </div></section>
  <script>window.BP_CC_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var isAr = window.BP_CC_LANG === "ar";
    var T = isAr ? {
      prof:"المهنة",profPh:"مثال: عامل، فني، مهندس…",status:"الحالة",sExisting:"قائم (على رأس العمل)",sNew:"جديد (أول دخول)",count:"العدد",late:"تأخير تجديد الإقامة",lNone:"لا يوجد",lFirst:"المرة الأولى (+500)",lSecond:"المرة الثانية (+1,000)",remove:"حذف",sar:"﷼"
    } : {
      prof:"Profession",profPh:"e.g. laborer, technician…",status:"Status",sExisting:"Existing (on the job)",sNew:"New (first entry)",count:"Count",late:"Iqama renewal delay",lNone:"None",lFirst:"First time (+500)",lSecond:"Second time (+1,000)",remove:"Remove",sar:"SAR"
    };
    var fmt=function(n){return Math.round(n).toLocaleString(isAr?"ar-SA":"en-US");};
    var $=function(id){return document.getElementById(id);};
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
  })();
  </script>`;
  return page({
    title: Lraw("Government cost calculator — Business Partner", "حاسبة التكاليف الحكومية — بيزنس بارتنر"),
    desc: Lraw("Estimate per-worker government costs in seconds.", "قدّر تكاليف العمالة الحكومية لكل عامل خلال ثوانٍ."),
    active: "/tools-and-calculators",
    path: "/calculators/government-cost",
    body,
  });
}

function buildProfessionChecker() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free compliance tool", "أداة امتثال مجانية")}</span>
    <h1>${L("Profession checker", "فاحص المهن")}</h1>
    <p class="lead">${L("Type a profession to see if it is Saudi-only or has a required Saudization ratio.", "اكتب المهنة لتعرف هل هي مقصورة على السعوديين أو لها نسبة توطين مطلوبة.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
    <div class="order-box">
      <h3>${L("Saudized professions checker (HRSD)", "فاحص المهن المسعودة (قرارات التوطين)")}</h3>
      <p class="cc-sub">${L("Type a profession to see if it is Saudi-only or has a required Saudization ratio — with the decision number, minimum counted salary, and accrediting body. Source: official HRSD localization decisions.", "اكتب المهنة لتعرف هل هي مقصورة على السعوديين أو لها نسبة توطين مطلوبة — مع رقم القرار والحد الأدنى للراتب المحتسب وجهة الاعتماد. المصدر: قرارات التوطين الرسمية لوزارة الموارد البشرية.")}</p>
      <div class="field"><label for="cc-prof-q">${L("Profession or sector", "المهنة أو القطاع")}</label><input type="text" id="cc-prof-q" placeholder="${Lraw("e.g. accountant, secretary, engineer, dentist…", "مثال: محاسب، سكرتير، مهندس، طبيب أسنان…")}"></div>
      <div class="cc-prof-chips" id="cc-prof-chips"></div>
      <div id="cc-prof-results"></div>
    </div>
    <div class="cc-disclaimer">⚖️ ${L("Estimates are for illustration only. Contact us for a verified calculation.", "الأرقام تقديرية للتوضيح فقط. تواصل معنا لحساب دقيق ومعتمد.")}</div>
  </div></section>
  <script>window.BP_CC_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var isAr = window.BP_CC_LANG === "ar";
    var fmt=function(n){return Math.round(n).toLocaleString(isAr?"ar-SA":"en-US");};
    var $=function(id){return document.getElementById(id);};
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
  })();
  </script>`;
  return page({
    title: Lraw("Profession checker — Business Partner", "فاحص المهن — بيزنس بارتنر"),
    desc: Lraw("Check which professions are Saudized or restricted for your activity.", "تحقق من المهن المُوطّنة أو المقيّدة على نشاطك."),
    active: "/tools-and-calculators",
    path: "/calculators/profession-checker",
    body,
  });
}


// The paid Compliance Agent subscription product — full landing + pricing +
// payment + intake, wrapped in the site's own header/footer/cart (unlike the
// Payment reuses api/pay.js same-origin.
function buildComplianceAgent() {
  const platforms = ["قوى","مقيم","GOSI","مدد","نطاقات","السجل التجاري","المركز السعودي للأعمال","ZATCA","الغرفة التجارية","العنوان الوطني","بلدي","الدفاع المدني","إيجار","MISA"];
  const platformsEn = ["Qiwa","Muqeem","GOSI","Mudad","Nitaqat","CR","Saudi Business Center","ZATCA","Chamber","National Address","Balady","Civil Defense","Ejar","MISA"];
  const chips = platforms.map((p, i) => `<span class="hero-badge">${L(platformsEn[i], p)}</span>`).join("");
  const steps = [
    ["1", L("Subscribe and register your establishment", "تشترك وتسجّل منشأتك"), L("CR, Qiwa, Muqeem, GOSI, Mudad, ZATCA, licenses — image, PDF or Excel.", "السجل، قوى، مقيم، التأمينات، مدد، ZATCA، الرخص… صورة أو PDF أو Excel.")],
    ["2", L("The agent reads and analyzes", "الوكيل يقرأ ويحلّل"), L("Extracts dates, numbers and statuses automatically and builds your compliance record.", "يستخرج التواريخ والأرقام والحالات تلقائياً ويبني سجل امتثال لمنشأتك.")],
    ["3", L("Daily monitoring", "مراقبة يومية"), L("Calculates days and risks, and alerts you before any expiry or violation via WhatsApp and email.", "يحسب الأيام والمخاطر، وينبّهك قبل أي انتهاء أو مخالفة عبر واتساب وإيميل.")],
    ["4", L("Every action needs your approval", "كل إجراء بموافقتك"), L("Prepares the renewal/action and shows it to you — nothing government-related runs without your approval.", "يجهّز التجديد/الإجراء ويعرضه عليك — لا يُنفَّذ أي شيء حكومي دون موافقتك.")],
  ];
  const stepsHtml = steps.map(([n, t, d]) => `<div class="step"><div class="step-n">${n}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join("");
  const valueItems = [
    [L("Certificates and their expiry dates", "الشهادات وتواريخ انتهائها"), L("Zakat, tax, chamber, GOSI, Saudization, wage protection, IBAN.", "الزكاة، الضريبة، الغرفة، التأمينات، التوطين، حماية الأجور، الآيبان.")],
    [L("Workforce and residencies", "العمالة والإقامات"), L("Work permits (Qiwa), residencies (Muqeem), wage protection (Mudad).", "رخص العمل (قوى)، الإقامات (مقيم)، حماية الأجور (مدد).")],
    [L("Nitaqat and Saudization", "النطاقات والسعودة"), L("Your expected band and how many Saudis you need to match or upgrade.", "نطاقك المتوقع وكم سعودي تحتاج للمطابقة أو الترقية.")],
    [L("Licenses and location", "الرخص والموقع"), L("Municipal license (Balady), Civil Defense, a certified lease contract.", "الرخصة البلدية (بلدي)، الدفاع المدني، عقد إيجار موثّق.")],
    [L("Foreign investors", "المستثمر الأجنبي"), L("Investment license (MISA) and its dates.", "رخصة الاستثمار (MISA) وتواريخها.")],
    [L("Alerts", "التنبيهات"), L("Daily report + an alert before violations and before any expiry.", "تقرير يومي + منبّه قبل نزول المخالفات وقبل كل انتهاء.")],
  ].map(([t, d]) => `<li>${I.check}<span><b>${t}:</b> ${d}</span></li>`).join("");

  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Compliance Agent", "وكيل الامتثال")}</span>
    <h1>${L("A government compliance & operations team that watches your establishment daily", "فريق امتثال وتشغيل حكومي يتابع منشأتك يومياً")}</h1>
    <p class="lead">${L("Subscribe and get a virtual compliance department monitoring your company, alerting you before violations and deadlines, and preparing every government action for your approval — without ever logging into a government portal yourself.", "اشترك، وخلّي عندك قسم امتثال افتراضي يراقب شركتك، ينبّهك قبل المخالفات والانتهاءات، ويرتّب لك كل إجراء حكومي — بموافقتك. بدون ما تدخل أي منصة حكومية بنفسك.")}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${u("/account")}">${L("Subscribe now", "اشترك الآن")}</a>
      <a class="btn btn-ghost btn-lg" href="${COMPLIANCE_PORTAL_URL}">🔐 ${L("Already subscribed? Sign in", "مشترك بالفعل؟ سجّل دخولك")}</a>
    </div>
    <div class="hero-badges">${chips}</div>
  </div></section>

  <section id="intake" class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How to subscribe", "كيف تشترك؟")}</span><h2>${L("Four steps from registering to opening your dashboard", "أربع خطوات من التسجيل إلى فتح لوحتك")}</h2></div>
    <div class="steps-grid">${[
      [L("Register / log in", "سجّل أو سجّل دخولك"), L("Create your account on the site — the same account you use for every other service.", "أنشئ حسابك في الموقع — نفس الحساب الذي تستخدمه لباقي الخدمات.")],
      [L("Add the subscription to your cart", "أضف الاشتراك للسلة"), L("Then complete checkout by bank transfer.", "ثم أكمل الدفع عبر تحويل بنكي.")],
      [L("We confirm your transfer", "نتحقق من تحويلك"), L("Once confirmed, we email you an access code.", "بمجرد التأكيد، يصلك بريد فيه رمز الدخول.")],
      [L("Open your dashboard", "افتح لوحتك"), L("Sign in to your compliance dashboard with your email and the access code — your establishment file, alerts and document upload are all there.", "ادخل لوحة الامتثال ببريدك ورمز الدخول — ملف منشأتك وتنبيهاتك ورفع مستنداتك كلها هناك.")],
    ].map(([t, d], i) => `<div class="step"><div class="step-n">${i + 1}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join("")}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف تشتغل الخدمة؟")}</span><h2>${L("Four steps — from registering your establishment to a daily alert and a ready action pending your approval", "أربع خطوات — من تسجيل منشأتك إلى تنبيه يومي وإجراء جاهز بموافقتك")}</h2></div>
    <div class="steps-grid">${stepsHtml}</div>
    <div class="callout" style="max-width:820px;margin:28px auto 0"><span class="ico">💰</span><p>${L("Compliance now literally pays back: Monsha'at's Estrdad initiative refunds SMEs their government fees through 2028 — but only while your CR, certificates, licenses and Nitaqat stay compliant. The agent keeps you inside the eligible band.", "امتثالك الآن يدفع لك حرفياً: مبادرة «استرداد» من منشآت تعيد للمنشآت رسومها الحكومية حتى 2028 — لكن فقط ما دام سجلك وشهاداتك وتراخيصك ونطاقاتك ممتثلة. الوكيل يبقيك داخل نطاق الاستحقاق.")} <a href="${u("/estrdad")}">${L("Learn about fee refunds ←", "اعرف عن استرداد الرسوم ←")}</a></p></div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="order-box">
      <h3 style="margin-bottom:1rem">${L("What does the agent track for you?", "وش يتابع لك الوكيل؟")}</h3>
      <ul class="value-list">${valueItems}</ul>
    </div>
  </div></section>

  <section id="pricing" class="section" style="padding-top:0"><div class="container">
    <div class="price-box">
      <div>${SHOW_PRICES ? `<div class="price-amt">${L("From 250", "يبدأ من 250")} <small>${L("SAR / monthly", "ريال / شهرياً")}</small></div>` : ""}
      <div class="text-soft">${L("Compliance subscription — daily monitoring and alerts. Government fees for actions are separate and only run with your approval.", "اشتراك خدمة الامتثال — مراقبة يومية وتنبيهات. الرسوم الحكومية للإجراءات منفصلة وتُنفَّذ بموافقتك.")}</div></div>
      ${cartBtns({ id: "agent-Compliance-Agent", nameEn: "Compliance & obligations agent", nameAr: "وكيل الامتثال والالتزام", amount: 250, priceLabel: L("From 250 ﷼ / monthly", "يبدأ من 250 ﷼ / شهرياً"), kind: "agent" })}
    </div>
  </div></section>

  <style>
    .text-soft{color:var(--text-soft)}
    .value-list{list-style:none;display:grid;gap:.7rem;margin:0;padding:0}
    .value-list li{display:flex;gap:.6rem;align-items:flex-start}
    .value-list li svg{width:20px;height:20px;flex-shrink:0;margin-top:3px;color:var(--wa)}
    .value-list b{color:var(--navy)}
    .price-box{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;background:var(--white);border:1px solid var(--gray-line);border-radius:18px;padding:1.3rem 1.5rem}
    .price-amt{font-size:2rem;font-weight:800;color:var(--navy)}
    .price-amt small{font-size:.95rem;color:var(--text-soft);font-weight:600}
    .price-box .buy-row{margin-inline-start:auto}
  </style>`;

  return page({
    title: Lraw("Compliance Agent — Business Partner", "وكيل الامتثال — بيزنس بارتنر"),
    desc: Lraw("Subscribe and get a virtual compliance team monitoring your company daily, alerting you before violations.", "اشترك واحصل على فريق امتثال افتراضي يراقب شركتك يومياً وينبّهك قبل المخالفات."),
    active: "/compliance-agent",
    path: "/compliance-agent",
    body,
  });
}

// Specialized-team AI employees — one dedicated feature page per agent
// (same pattern as the Compliance Agent page above), linked from both the
// /connect purchase grid and the /portal employee picker/chat switcher.
const TEAM_AGENTS = [
  {
    slug: "baher", emoji: "🎯",
    nameAr: "باهر", nameEn: "Baher",
    roleAr: "مستشار الأعمال", roleEn: "Business Advisor",
    taglineAr: "أول نقطة تواصل: يشخّص طلبك ويوجّهك للخدمة أو الموظف الصحيح.", taglineEn: "Your first point of contact — diagnoses what you need and routes you to the right service or employee.",
    caps: [
      ["Answers business questions and explains which Business Partner service fits your situation", "يجاوب على استفساراتك التجارية ويوضح لك أي خدمة من خدمات بزنس بارتنر تناسب حالتك"],
      ["Runs an initial diagnosis of your sector and request before recommending a paid service", "يسوي تشخيصاً أولياً لقطاعك وطلبك قبل ما يرشّح لك خدمة مدفوعة"],
      ["Routes you to the right specialist (legal, compliance, HR, sales…) instead of leaving you guessing", "يحوّلك للمتخصص الصحيح (قانوني، امتثال، موارد بشرية، مبيعات…) بدل ما تتوه بين الخدمات"],
      ["Escalates anything that needs a human decision instead of guessing an answer", "يصعّد أي شيء يحتاج قرار بشري بدل ما يخمّن إجابة"],
    ],
  },
  {
    slug: "mazen", emoji: "🧭",
    nameAr: "مازن", nameEn: "Mazen",
    roleAr: "مدير العمليات", roleEn: "Operations Manager",
    taglineAr: "يستقبل عملاءك ويوجّههم، ويتولى أي تصعيد يحتاج تدخلاً بشرياً.", taglineEn: "Receives and routes your customers, and owns every escalation that needs a human hand-off.",
    caps: [
      ["Greets incoming customer conversations and routes each one to the right place", "يستقبل محادثات عملائك الواردة ويوجّه كل واحدة للمكان الصحيح"],
      ["Owns escalations: a phone request, a complaint, a sensitive document, a proposal that needs sign-off, a customer ready to sign", "يستلم التصعيدات: طلب اتصال، شكوى، مستند حساس، عرض يحتاج اعتماد، عميل جاهز للتعاقد"],
      ["Never asks for sensitive documents or final pricing himself — flags them for your review instead", "لا يطلب مستندات حساسة ولا يعطي أسعاراً نهائية بنفسه — يرفعها لمراجعتك"],
      ["Keeps a clear handoff trail so nothing falls through the cracks between agents", "يحافظ على مسار تسليم واضح بين الموظفين حتى ما يضيع أي طلب"],
    ],
  },
  {
    slug: "nasser", emoji: "👥",
    nameAr: "ناصر", nameEn: "Nasser",
    roleAr: "الموارد البشرية", roleEn: "HR",
    taglineAr: "يدير التوظيف من نشر الوظيفة إلى قائمة مرشّحين جاهزة للمقابلة.", taglineEn: "Runs hiring end to end — from posting the role to a shortlist ready for interviews.",
    caps: [
      ["AI-powered matching against your candidate pool for any open role", "مطابقة ذكية بالذكاء الاصطناعي مع قاعدة المرشّحين لأي وظيفة مفتوحة"],
      ["Screens and scores candidates against the role's requirements", "يقيّم ويصنّف المرشّحين مقابل متطلبات الوظيفة"],
      ["Drafts interview questions tailored to the specific role", "يجهّز أسئلة مقابلة مخصّصة للوظيفة تحديداً"],
      ["Prepares outreach messages to shortlisted candidates for your approval", "يجهّز رسائل تواصل مع المرشّحين المختارين بانتظار موافقتك"],
      ["Tracks the hiring pipeline from posting to shortlist to offer", "يتابع مسار التوظيف من النشر إلى القائمة المختصرة إلى العرض"],
    ],
  },
  {
    slug: "mishari", emoji: "🛡️",
    nameAr: "مشاري", nameEn: "Mishari",
    roleAr: "الامتثال والالتزام", roleEn: "Compliance",
    taglineAr: "فريق امتثال افتراضي يراقب منشأتك يومياً وينبّهك قبل أي مخالفة.", taglineEn: "A virtual compliance team monitoring your establishment daily and alerting you before violations.",
    caps: [
      ["Reads your registrations (CR, Qiwa, Muqeem, GOSI, Mudad, ZATCA, licenses) and builds a live compliance record", "يقرأ تسجيلاتك (السجل، قوى، مقيم، التأمينات، مدد، ZATCA، الرخص) ويبني سجل امتثال حي لمنشأتك"],
      ["Tracks Nitaqat/Saudization band and flags what you need to match or upgrade", "يتابع نطاقك ونسبة التوطين ويوضح ما تحتاجه للمطابقة أو الترقية"],
      ["Daily monitoring with a WhatsApp/email alert before any expiry or violation", "مراقبة يومية مع تنبيه واتساب وإيميل قبل أي انتهاء أو مخالفة"],
      ["Prepares the renewal/action and shows it to you — nothing government-related runs without your approval", "يجهّز التجديد أو الإجراء ويعرضه عليك — لا يُنفَّذ أي شيء حكومي دون موافقتك"],
    ],
  },
  {
    slug: "abdulaziz", emoji: "⚖️",
    nameAr: "عبدالعزيز", nameEn: "Abdulaziz",
    roleAr: "قانوني", roleEn: "Legal",
    taglineAr: "أول رد آمن على أي استفسار قانوني، وتوضيح لما يحتاج مراجعة بشرية.", taglineEn: "A first, safe response to any legal question — and a clear flag for what needs human review.",
    caps: [
      ["Gives an initial, cautious answer to legal and compliance questions (contracts, licenses, residency eligibility)", "يعطي رداً أولياً حذراً على الاستفسارات القانونية والامتثالية (العقود، التراخيص، أهلية الإقامة)"],
      ["Clearly flags what needs a licensed human review before you rely on it", "يوضّح بشكل صريح ما يحتاج مراجعة بشرية مرخّصة قبل الاعتماد عليه"],
      ["Never gives final legal advice or confirms a government approval on his own", "لا يعطي استشارة قانونية نهائية ولا يؤكد موافقة حكومية بنفسه"],
      ["Never collects sensitive documents through chat — routes those to a secure channel", "لا يستقبل مستندات حساسة عبر المحادثة — يحوّلها لقناة آمنة"],
    ],
  },
  {
    slug: "badr", emoji: "💼",
    nameAr: "بدر", nameEn: "Badr",
    roleAr: "مبيعات وتطوير أعمال", roleEn: "Sales & Business Development",
    taglineAr: "يستلم أي طلب سعر أو عرض ويجهّز مسودة جاهزة لمراجعتك قبل الإرسال.", taglineEn: "Takes any pricing or proposal request and prepares a draft ready for your review before it goes out.",
    caps: [
      ["Explains the scope of every service commercially (company formation, HR, government relations, premium residency…)", "يوضح نطاق كل خدمة تجارياً (تأسيس الشركات، الموارد البشرية، العلاقات الحكومية، الإقامة المميزة…)"],
      ["Only quotes prices from the official, approved services catalog — never invents one", "يستخدم فقط الأسعار المعتمدة في الكتالوج الرسمي — لا يخترع سعراً أبداً"],
      ["Drafts a proposal and logs it as \"pending approval\" — nothing final goes out without your sign-off", "يجهّز مسودة عرض ويسجّلها «بانتظار الموافقة» — ولا يرسل أي عرض نهائي بدون اعتمادك"],
      ["Keeps your CRM and sales pipeline updated automatically as the conversation progresses", "يحدّث CRM ومسار المبيعات تلقائياً مع تقدّم المحادثة"],
      ["Never gives discounts, contracts, invoices, or payment links on his own", "لا يعطي خصومات ولا يرسل عقوداً أو فواتير أو روابط دفع بنفسه"],
    ],
  },
  {
    slug: "farah", emoji: "📣",
    nameAr: "فرح", nameEn: "Farah",
    roleAr: "تسويق ومحتوى", roleEn: "Marketing & Content",
    taglineAr: "تنشئ وتدير المحتوى التسويقي على كل قنواتك — كمسودات بانتظار اعتمادك.", taglineEn: "Creates and manages your marketing content across every channel — as drafts pending your approval.",
    caps: [
      ["Creates content and campaign drafts across LinkedIn, Instagram, Email, WhatsApp, TikTok, Snapchat, Facebook and X", "تنشئ محتوى وحملات على LinkedIn وInstagram والإيميل وواتساب وTikTok وSnapchat وFacebook وX"],
      ["Summarizes government decisions and platform updates relevant to your business", "تلخّص القرارات الحكومية وتحديثات المنصات المؤثرة على منشأتك"],
      ["Prepares WhatsApp/email/notification broadcasts for your approval before sending", "تجهّز برودكاست واتساب/إيميل/إشعارات بانتظار موافقتك قبل الإرسال"],
      ["Never publishes any content or broadcast without your sign-off", "لا تنشر أي محتوى أو برودكاست بدون اعتمادك"],
    ],
  },
  {
    slug: "malak", emoji: "🗂️",
    nameAr: "ملاك", nameEn: "Malak",
    roleAr: "مساعِدة تنفيذية", roleEn: "Executive Assistant",
    taglineAr: "ملخصك اليومي كل صباح، وتنظيم مهامك واجتماعاتك وبريدك.", taglineEn: "Your daily brief every morning — and organizes your tasks, meetings and inbox.",
    caps: [
      ["A daily brief every morning: urgent and overdue items first, with owner and due date", "ملخص يومي كل صباح: العاجل والمتأخر أولاً مع المسؤول وتاريخ الاستحقاق"],
      ["Reminders for upcoming meetings and deadlines for the week ahead", "تذكيرات بالمواعيد والمهام القادمة للأسبوع"],
      ["Sorts your inbox: urgent / needs action / for your information", "تفرز بريدك: عاجل / يحتاج إجراء / للاطلاع"],
      ["Summarizes meetings and long conversations into a decision-ready summary", "تلخّص الاجتماعات والمحادثات الطويلة في ملخص جاهز لاتخاذ القرار"],
      ["Never handles OTPs, verification codes or passwords, and never messages anyone externally on her own", "لا تتعامل مع رموز التحقق OTP أو كلمات المرور، ولا ترسل أي رسالة خارجية بنفسها"],
    ],
  },
  {
    slug: "mohammed", emoji: "💻",
    nameAr: "محمد", nameEn: "Mohammed",
    roleAr: "تقنية معلومات", roleEn: "IT",
    taglineAr: "يراقب صحة أنظمتك وتكاملاتك، ويشخّص الأعطال التقنية.", taglineEn: "Monitors your systems and integrations, and diagnoses technical issues.",
    caps: [
      ["Monitors the health of your connected agents, workflows and website", "يراقب صحة الموظفين المرتبطين والأنظمة الآلية والموقع"],
      ["Manages integrations (Notion, automation platforms, WhatsApp, third-party subscriptions)", "يدير التكاملات (نوشن، منصات الأتمتة، واتساب، اشتراكات الأطراف الثالثة)"],
      ["Diagnoses platform and connection failures before they affect your operations", "يشخّص أعطال المنصات والربط قبل ما تأثر على تشغيلك"],
      ["Never touches customer credentials or OTPs, and never gives legal opinions", "لا يمس بيانات اعتماد العملاء ولا رموز التحقق، ولا يفتي قانونياً"],
    ],
  },
  {
    slug: "strategy", emoji: "📈",
    nameAr: "أحمد", nameEn: "Ahmed",
    roleAr: "مدير التخطيط الاستراتيجي", roleEn: "Strategic Planning Manager",
    taglineAr: "يبني رؤيتك وخططك السنوية والربعية ويتابع تنفيذها بمؤشرات واضحة.", taglineEn: "Builds your vision, annual and quarterly plans, and tracks execution with clear metrics.",
    caps: [
      ["Shapes your company's vision and mission into an actionable direction", "يصيغ رؤية ورسالة شركتك في اتجاه قابل للتنفيذ"],
      ["Annual and quarterly plans broken into concrete initiatives", "خطط سنوية وربعية مقسّمة إلى مبادرات ملموسة"],
      ["Sets OKRs and KPIs so progress is measurable, not guesswork", "يحدد أهداف OKRs ومؤشرات KPIs حتى يكون التقدم قابلاً للقياس لا تخميناً"],
      ["Builds roadmaps and follows up on execution across the team", "يبني خرائط طريق ويتابع التنفيذ عبر الفريق"],
      ["Flags drift early — when actual progress diverges from the plan", "ينبّهك مبكراً عندما ينحرف التنفيذ الفعلي عن الخطة"],
    ],
  },
  {
    slug: "ahmed", emoji: "📦",
    nameAr: "عبدالله", nameEn: "Abdullah",
    roleAr: "مشتريات وتوريد", roleEn: "Procurement & Supply",
    taglineAr: "يقارن الموردين ويجهّز مسودة تفاوض جاهزة للاعتماد.", taglineEn: "Compares suppliers and prepares a negotiation draft ready for your sign-off.",
    caps: [
      ["A shortlist of up to 3 suppliers compared on price, scope, terms and readiness", "قائمة مختصرة بحد أقصى 3 موردين مقارَنين بالسعر والنطاق والشروط والجاهزية"],
      ["Prefers your existing approved suppliers before suggesting new ones", "يفضّل الموردين المعتمدين لديك قبل اقتراح موردين جدد"],
      ["Drafts an outreach or negotiation message ready for your approval", "يجهّز مسودة رسالة تواصل أو تفاوض جاهزة للاعتماد"],
      ["Never commits to a purchase, signs, or pays — and never messages a supplier without your sign-off", "لا يلتزم بأي شراء ولا يوقّع ولا يدفع، ولا يراسل مورداً بدون اعتمادك"],
    ],
  },
  {
    slug: "abdulrahman", emoji: "💰",
    nameAr: "عبدالرحمن", nameEn: "Abdulrahman",
    roleAr: "المدير المالي", roleEn: "CFO",
    taglineAr: "يدير ميزانياتك وتدفقك النقدي وفواتيرك، ويجهّز تقاريرك المالية بوضوح.", taglineEn: "Runs your budgets, cash flow and invoicing, and prepares your financial reports clearly.",
    caps: [
      ["Manages budgets and cash flow", "يدير الميزانيات والتدفق النقدي"],
      ["Prepares invoices, collections and payment plans", "يجهّز الفواتير والتحصيل وخطط الدفع"],
      ["Financial reports and KPIs explained clearly, not just numbers", "تقارير مالية ومؤشرات أداء موضّحة بوضوح، مو أرقام فقط"],
      ["Tracks Zakat and VAT (ZATCA) obligations", "يتابع التزامات الزكاة وضريبة القيمة المضافة (ZATCA)"],
      ["Bookkeeping via Qoyod", "محاسبة عبر منصة قيود"],
      ["Never executes a payment, transfer, or invoice on his own — always prepares it for your explicit approval first", "لا ينفّذ أي دفعة أو تحويل أو فاتورة بنفسه — يجهّزها دائماً وينتظر موافقتك الصريحة"],
    ],
  },
];

function buildTeamAgent(agent) {
  const capsHtml = agent.caps.map(([en, ar]) => `<li>${I.check}<span>${L(en, ar)}</span></li>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Smart Specialized Agent", "الموظف المتخصص")}</span>
    <h1>${agent.emoji} ${L(agent.nameEn, agent.nameAr)} — ${L(agent.roleEn, agent.roleAr)}</h1>
    <p class="lead">${L(agent.taglineEn, agent.taglineAr)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="#pricing">${L("🚀 Subscribe now", "🚀 اشترك الآن")}</a>
      <a class="btn btn-ghost btn-lg" href="${u("/portal")}">🔐 ${L("Already subscribed? Sign in", "مشترك بالفعل؟ سجّل دخولك")}</a>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="order-box">
      <h3 style="margin-bottom:1rem">${L("What does " + agent.nameEn + " do?", "وش يسوي " + agent.nameAr + "؟")}</h3>
      <ul class="value-list">${capsHtml}</ul>
    </div>
  </section></div>

  <section class="section" style="padding-top:0" id="pricing"><div class="container">
    <div class="price-box">
      <div>${SHOW_PRICES ? `<div class="price-amt">500 <small>${L("SAR / monthly", "ريال / شهرياً")}</small></div>` : ""}
      <div class="text-soft">${L("Part of the Smart Specialized Agents team — subscribe to one employee or several from the same cart.", "جزء من فريق الموظفين الأذكياء المتخصصين — اشترك بموظف واحد أو أكثر من نفس السلة.")}</div></div>
      <button type="button" class="btn btn-primary btn-lg add-cart" data-id="employee-${agent.slug}" data-name-en="${esc(agent.nameEn)} — ${esc(agent.roleEn)}" data-name-ar="${esc(agent.nameAr)} — ${esc(agent.roleAr)}" data-amount="500" data-price="500 ﷼ / ${Lraw("monthly", "شهرياً")}" data-kind="employee">${L(SHOW_PRICES ? "🛒 Add to cart — 500 SAR/mo" : "🛒 Add to cart", SHOW_PRICES ? "🛒 أضف للسلة — 500 ﷼/شهرياً" : "🛒 أضف للسلة")}</button>
      <a class="btn btn-ghost" href="${u("/connect")}">${L("Browse the full team", "استعرض الفريق كاملاً")}</a>
    </div>
  </div></section>

  <style>
    .text-soft{color:var(--text-soft)}
    .value-list{list-style:none;display:grid;gap:.7rem;margin:0;padding:0}
    .value-list li{display:flex;gap:.6rem;align-items:flex-start}
    .value-list li svg{width:20px;height:20px;flex-shrink:0;margin-top:3px;color:var(--wa)}
    .price-box{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;justify-content:space-between;background:var(--white);border:1px solid var(--gray-line);border-radius:18px;padding:1.3rem 1.5rem}
    .price-amt{font-size:2rem;font-weight:800;color:var(--navy)}
    .price-amt small{font-size:.95rem;color:var(--text-soft);font-weight:600}
  </style>`;

  return page({
    title: Lraw(`${agent.nameEn} — ${agent.roleEn} — Business Partner`, `${agent.nameAr} — ${agent.roleAr} — بيزنس بارتنر`),
    desc: Lraw(agent.taglineEn, agent.taglineAr),
    active: "/ai-agents",
    path: `/team/${agent.slug}`,
    body,
  });
}

function buildEndOfServiceCalculator() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free labor tool", "أداة عمل مجانية")}</span>
    <h1>${L("End-of-service gratuity calculator", "حاسبة مكافأة نهاية الخدمة")}</h1>
    <p class="lead">${L("Per Saudi Labor Law Art. 84–85: half a month's wage for each of the first 5 years, then a full month's wage for each following year — adjusted for resignation.", "وفق نظام العمل م.84–85: نصف شهر عن كل سنة من أول 5 سنوات، ثم شهر كامل عن كل سنة تالية — مع تعديل الاستقالة.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
    <div class="order-box">
      <div class="cc-grid">
        <div class="field"><label for="lc-wage">${L("Last monthly wage (SAR)", "آخر أجر شهري (ريال)")}</label><input type="number" id="lc-wage" min="0" value="8000"></div>
        <div class="field"><label for="lc-years">${L("Years of service", "سنوات الخدمة")}</label><input type="number" id="lc-years" min="0" value="6"></div>
        <div class="field"><label for="lc-months">${L("Extra months", "أشهر إضافية")}</label><input type="number" id="lc-months" min="0" max="11" value="0"></div>
        <div class="field"><label for="lc-reason">${L("Reason for leaving", "سبب انتهاء العلاقة")}</label><select id="lc-reason"><option value="terminated">${L("Contract ended / employer termination", "انتهاء العقد / إنهاء من صاحب العمل")}</option><option value="resign">${L("Worker resignation", "استقالة العامل")}</option></select></div>
      </div>
      <button class="btn btn-primary" id="lc-eos-calc">${L("Calculate", "احسب")}</button>
      <div class="cc-result" id="lc-eos-result" hidden>
        <div class="cc-tiles">
          <div class="cc-tile"><span>${L("Full award", "المكافأة الكاملة")}</span><strong id="lc-eos-full">—</strong></div>
          <div class="cc-tile tile-gold"><span>${L("Amount due", "المستحق")}</span><strong id="lc-eos-due">—</strong></div>
          <div class="cc-tile"><span>${L("Resignation factor", "نسبة الاستقالة")}</span><strong id="lc-eos-factor">—</strong></div>
        </div>
        <div class="cc-advice ok" id="lc-eos-note"></div>
      </div>
    </div>
    <div class="cc-disclaimer">⚖️ ${L("Estimates based on the Saudi Labor Law for general guidance. Individual cases may vary by contract terms. Contact us for a verified HR/payroll review.", "تقديرات مبنية على نظام العمل السعودي لأغراض إرشادية. قد تختلف الحالات حسب بنود العقد. تواصل معنا لمراجعة معتمدة للرواتب والموارد البشرية.")}</div>
  </div></section>
  <script>window.BP_LC_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var isAr=window.BP_LC_LANG==="ar";
    var fmt=function(n){return (Math.round(n*100)/100).toLocaleString(isAr?"ar-SA":"en-US")+" "+(isAr?"ريال":"SAR");};
    var $=function(id){return document.getElementById(id);};
    $("lc-eos-calc").addEventListener("click",function(){
      var w=Math.max(0,Number($("lc-wage").value)||0);
      var svc=Math.max(0,(Number($("lc-years").value)||0)+(Number($("lc-months").value)||0)/12);
      var first=Math.min(svc,5),rest=Math.max(0,svc-5);
      var full=first*0.5*w+rest*1*w;
      var reason=$("lc-reason").value,factor=1,ftxt=isAr?"لا ينطبق (إنهاء)":"n/a (termination)";
      if(reason==="resign"){if(svc<2){factor=0;ftxt="0 ("+(isAr?"أقل من سنتين":"under 2y")+")";}else if(svc<5){factor=1/3;ftxt=isAr?"الثلث (2–5 سنوات)":"one third (2–5y)";}else if(svc<10){factor=2/3;ftxt=isAr?"الثلثان (5–10 سنوات)":"two thirds (5–10y)";}else{factor=1;ftxt=isAr?"كاملة (10+ سنوات)":"full (10y+)";}}
      var due=full*factor;
      $("lc-eos-full").textContent=fmt(full);
      $("lc-eos-due").textContent=fmt(due);
      $("lc-eos-factor").textContent=ftxt;
      $("lc-eos-note").textContent=(isAr?"الأساس: نصف شهر عن أول 5 سنوات ("+fmt(first*0.5*w)+") + شهر عن "+((Math.round(rest*100)/100))+" سنة تالية ("+fmt(rest*w)+"). م.84–85 نظام العمل.":"Basis: half-month for first 5y ("+fmt(first*0.5*w)+") + full month for "+((Math.round(rest*100)/100))+" following years ("+fmt(rest*w)+"). Labor Law Art. 84–85.");
      $("lc-eos-result").hidden=false;});
  })();
  </script>`;
  return page({
    title: Lraw("End-of-service gratuity calculator — Business Partner", "حاسبة مكافأة نهاية الخدمة — بيزنس بارتنر"),
    desc: Lraw("Calculate the end-of-service gratuity per the Saudi Labor Law.", "احسب مكافأة نهاية الخدمة وفق نظام العمل السعودي."),
    active: "/tools-and-calculators",
    path: "/calculators/end-of-service",
    body,
  });
}

function buildAnnualLeaveCalculator() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free labor tool", "أداة عمل مجانية")}</span>
    <h1>${L("Annual leave calculator", "حاسبة الإجازة السنوية")}</h1>
    <p class="lead">${L("Per Art. 109: 21 days per year (30 days after 5 years of service). Shows entitlement and the cash value of unused days.", "وفق م.109: 21 يوماً سنوياً (30 يوماً بعد 5 سنوات خدمة). تعرض الاستحقاق والقيمة النقدية للأيام غير المستخدمة.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
    <div class="order-box">
      <div class="cc-grid">
        <div class="field"><label for="lv-wage">${L("Monthly wage (SAR)", "الأجر الشهري (ريال)")}</label><input type="number" id="lv-wage" min="0" value="8000"></div>
        <div class="field"><label for="lv-years">${L("Years of service", "سنوات الخدمة")}</label><input type="number" id="lv-years" min="0" value="3"></div>
        <div class="field"><label for="lv-unused">${L("Unused leave days", "أيام إجازة غير مستخدمة")}</label><input type="number" id="lv-unused" min="0" value="10"></div>
      </div>
      <button class="btn btn-primary" id="lv-calc">${L("Calculate", "احسب")}</button>
      <div class="cc-result" id="lv-result" hidden>
        <div class="cc-tiles">
          <div class="cc-tile"><span>${L("Annual entitlement", "الاستحقاق السنوي")}</span><strong id="lv-days">—</strong></div>
          <div class="cc-tile"><span>${L("Daily wage", "الأجر اليومي")}</span><strong id="lv-daily">—</strong></div>
          <div class="cc-tile tile-gold"><span>${L("Value of unused days", "قيمة الأيام غير المستخدمة")}</span><strong id="lv-value">—</strong></div>
        </div>
      </div>
    </div>
    <div class="cc-disclaimer">⚖️ ${L("Estimates based on the Saudi Labor Law for general guidance. Contact us for a verified HR/payroll review.", "تقديرات مبنية على نظام العمل السعودي لأغراض إرشادية. تواصل معنا لمراجعة معتمدة للرواتب والموارد البشرية.")}</div>
  </div></section>
  <script>window.BP_LC_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var isAr=window.BP_LC_LANG==="ar";
    var fmt=function(n){return (Math.round(n*100)/100).toLocaleString(isAr?"ar-SA":"en-US")+" "+(isAr?"ريال":"SAR");};
    var $=function(id){return document.getElementById(id);};
    $("lv-calc").addEventListener("click",function(){
      var w=Math.max(0,Number($("lv-wage").value)||0),y=Math.max(0,Number($("lv-years").value)||0),u=Math.max(0,Number($("lv-unused").value)||0);
      var days=y>=5?30:21,daily=w/30;
      $("lv-days").textContent=days+(isAr?" يوم":" days");
      $("lv-daily").textContent=fmt(daily);
      $("lv-value").textContent=fmt(daily*u);
      $("lv-result").hidden=false;});
  })();
  </script>`;
  return page({
    title: Lraw("Annual leave calculator — Business Partner", "حاسبة الإجازة السنوية — بيزنس بارتنر"),
    desc: Lraw("Leave entitlement and the cash value of unused days.", "استحقاق الإجازة والقيمة النقدية للأيام غير المستخدمة."),
    active: "/tools-and-calculators",
    path: "/calculators/annual-leave",
    body,
  });
}

function buildOvertimeCalculator() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free labor tool", "أداة عمل مجانية")}</span>
    <h1>${L("Overtime pay calculator", "حاسبة أجر العمل الإضافي")}</h1>
    <p class="lead">${L("Per Art. 107: overtime is paid at 150% of the hourly wage (hourly = monthly wage ÷ 240).", "وفق م.107: يُحتسب العمل الإضافي بـ150% من أجر الساعة (أجر الساعة = الأجر الشهري ÷ 240).")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
    <div class="order-box">
      <div class="cc-grid">
        <div class="field"><label for="ot-wage">${L("Monthly wage (SAR)", "الأجر الشهري (ريال)")}</label><input type="number" id="ot-wage" min="0" value="8000"></div>
        <div class="field"><label for="ot-hours">${L("Overtime hours", "ساعات العمل الإضافي")}</label><input type="number" id="ot-hours" min="0" value="20"></div>
      </div>
      <button class="btn btn-primary" id="ot-calc">${L("Calculate", "احسب")}</button>
      <div class="cc-result" id="ot-result" hidden>
        <div class="cc-tiles">
          <div class="cc-tile"><span>${L("Hourly wage", "أجر الساعة")}</span><strong id="ot-hourly">—</strong></div>
          <div class="cc-tile"><span>${L("Overtime hour rate (×1.5)", "أجر الساعة الإضافية (×1.5)")}</span><strong id="ot-rate">—</strong></div>
          <div class="cc-tile tile-gold"><span>${L("Total overtime pay", "إجمالي الأجر الإضافي")}</span><strong id="ot-total">—</strong></div>
        </div>
      </div>
    </div>
    <div class="cc-disclaimer">⚖️ ${L("Estimates based on the Saudi Labor Law for general guidance. Contact us for a verified HR/payroll review.", "تقديرات مبنية على نظام العمل السعودي لأغراض إرشادية. تواصل معنا لمراجعة معتمدة للرواتب والموارد البشرية.")}</div>
  </div></section>
  <script>window.BP_LC_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var isAr=window.BP_LC_LANG==="ar";
    var fmt=function(n){return (Math.round(n*100)/100).toLocaleString(isAr?"ar-SA":"en-US")+" "+(isAr?"ريال":"SAR");};
    var $=function(id){return document.getElementById(id);};
    $("ot-calc").addEventListener("click",function(){
      var w=Math.max(0,Number($("ot-wage").value)||0),h=Math.max(0,Number($("ot-hours").value)||0);
      var hourly=w/240,rate=hourly*1.5;
      $("ot-hourly").textContent=fmt(hourly);
      $("ot-rate").textContent=fmt(rate);
      $("ot-total").textContent=fmt(rate*h);
      $("ot-result").hidden=false;});
  })();
  </script>`;
  return page({
    title: Lraw("Overtime pay calculator — Business Partner", "حاسبة أجر العمل الإضافي — بيزنس بارتنر"),
    desc: Lraw("Overtime pay at the 1.5x rate per the Labor Law.", "أجر العمل الإضافي بمعدل 1.5× وفق نظام العمل."),
    active: "/tools-and-calculators",
    path: "/calculators/overtime",
    body,
  });
}

function buildGosiCalculator() {
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <a class="back-link" href="${u("/tools-and-calculators")}">${I.arrow} ${L("All tools & calculators", "كل الأدوات والحاسبات")}</a>
    <span class="eyebrow">${L("Free labor tool", "أداة عمل مجانية")}</span>
    <h1>${L("GOSI contributions calculator", "حاسبة اشتراك التأمينات (GOSI)")}</h1>
    <p class="lead">${L("Monthly social-insurance contributions on the contributory wage. Rates are editable; defaults follow the current GOSI schedule.", "الاشتراكات الشهرية على الأجر الخاضع. النسب قابلة للتعديل؛ الافتراضي يتبع جدول التأمينات الحالي.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:920px">
    <div class="order-box">
      <div class="cc-grid">
        <div class="field"><label for="gs-wage">${L("Contributory wage (SAR)", "الأجر الخاضع (ريال)")}</label><input type="number" id="gs-wage" min="0" value="8000"></div>
        <div class="field"><label for="gs-nat">${L("Nationality", "الجنسية")}</label><select id="gs-nat"><option value="saudi">${L("Saudi", "سعودي")}</option><option value="expat">${L("Non-Saudi", "غير سعودي")}</option></select></div>
      </div>
      <details class="cc-rates"><summary>⚙️ ${L("Contribution rates (editable)", "نسب الاشتراك (قابلة للتعديل)")}</summary>
        <div class="cc-grid">
          <div class="field"><label>${L("Saudi — employee %", "سعودي — العامل %")}</label><input type="number" step="0.01" id="gs-se" value="9.75"></div>
          <div class="field"><label>${L("Saudi — employer %", "سعودي — صاحب العمل %")}</label><input type="number" step="0.01" id="gs-sr" value="11.75"></div>
          <div class="field"><label>${L("Non-Saudi — employer % (occupational hazards)", "غير سعودي — صاحب العمل % (الأخطار المهنية)")}</label><input type="number" step="0.01" id="gs-xr" value="2"></div>
        </div>
      </details>
      <button class="btn btn-primary" id="gs-calc">${L("Calculate", "احسب")}</button>
      <div class="cc-result" id="gs-result" hidden>
        <div class="cc-tiles">
          <div class="cc-tile"><span>${L("Employee share", "حصة العامل")}</span><strong id="gs-emp">—</strong></div>
          <div class="cc-tile"><span>${L("Employer share", "حصة صاحب العمل")}</span><strong id="gs-er">—</strong></div>
          <div class="cc-tile tile-gold"><span>${L("Total monthly", "الإجمالي الشهري")}</span><strong id="gs-tot">—</strong></div>
        </div>
      </div>
    </div>
    <div class="cc-disclaimer">⚖️ ${L("Estimates based on GOSI regulations for general guidance. Contact us for a verified HR/payroll review.", "تقديرات مبنية على لوائح التأمينات لأغراض إرشادية. تواصل معنا لمراجعة معتمدة للرواتب والموارد البشرية.")}</div>
  </div></section>
  <script>window.BP_LC_LANG=${JSON.stringify(LANG)};</script>
  <script>
  (function(){
    var isAr=window.BP_LC_LANG==="ar";
    var fmt=function(n){return (Math.round(n*100)/100).toLocaleString(isAr?"ar-SA":"en-US")+" "+(isAr?"ريال":"SAR");};
    var $=function(id){return document.getElementById(id);};
    $("gs-calc").addEventListener("click",function(){
      var w=Math.max(0,Number($("gs-wage").value)||0),nat=$("gs-nat").value;
      var se=Number($("gs-se").value)||0,sr=Number($("gs-sr").value)||0,xr=Number($("gs-xr").value)||0;
      var emp,er;
      if(nat==="saudi"){emp=w*se/100;er=w*sr/100;}else{emp=0;er=w*xr/100;}
      $("gs-emp").textContent=fmt(emp);
      $("gs-er").textContent=fmt(er);
      $("gs-tot").textContent=fmt(emp+er);
      $("gs-result").hidden=false;});
  })();
  </script>`;
  return page({
    title: Lraw("GOSI contributions calculator — Business Partner", "حاسبة اشتراك التأمينات — بيزنس بارتنر"),
    desc: Lraw("Monthly social-insurance contributions, Saudi & non-Saudi.", "الاشتراكات الشهرية للتأمينات، للسعودي وغير السعودي."),
    active: "/tools-and-calculators",
    path: "/calculators/gosi",
    body,
  });
}

function buildTourism() {
  const t = site.tourism;
  const ev = t.events;
  const evFeats = ev.features.map((f, i) => `<li>${I.check}<span>${L((ev.featuresEn && ev.featuresEn[i]) || f, f)}</span></li>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Tourism & events", "السياحة والفعاليات")}</span>
    <h1>${L(t.titleEn || t.title, t.title)}</h1>
    <p class="lead">${L(t.leadEn || t.lead, t.lead)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="#events">${I.building}<span>${L("Staff events", "فعاليات الموظفين")}</span></a>
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
        <p class="form-note">${L("Your request reaches our team, we collect the best 5 supplier offers, and you pick the winner. You're registered as a client and your request is saved to your dashboard.", "يصل طلبك لفريقنا، نجمع لك أفضل 5 عروض من المزوّدين، وتختار الأنسب. ويتم تسجيلك كعميل وحفظ طلبك في لوحتك.")}</p>
        <div class="form-success" id="event-success" hidden></div>
      </form>
      <aside class="booking-side">
        <div class="order-box">
          <h3>${L("How it works", "كيف تعمل")}</h3>
          <ul class="feat-list">${evFeats}</ul>
          <p class="mini">${L("Are you an events supplier?", "هل أنت مورّد فعاليات؟")}</p>
          <a class="btn btn-ghost" href="${u("/suppliers")}">${L("Join our partners portal", "سجّل في بوابة الشركاء")}</a>
        </div>
      </aside>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Ready for us to arrange it?", "جاهز نرتّب لك؟")}</h2><p>${L("Tell us about your event and we'll tailor it to you.", "أخبرنا عن فعاليتك ونصمّمها على مقاسك.")}</p>${waBtn2("Contact us", "تواصل معنا", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("Tourism & events — Business Partner", "السياحة والفعاليات — بيزنس بارتنر"), desc: Lraw((t.leadEn || t.lead).slice(0, 155), t.lead.slice(0, 155)), active: "/tourism", body });
}

// Sub-brand landing page: "Mahfol Makfol by Business Partner" — the premium
// investor gateway. A multilingual, multiple-choice Investment Concierge up
// top (client-side, works regardless of any backend), investor services,
// city-by-city investor programs, target sectors, and the lead form that
// still feeds the /api/requests investor-tourism pipeline (email + CRM/Notion).
// Shared sub-nav for the two Mahfol Makfol tracks (investor + trips), so both
// pages read as one sub-brand under Business Partner and cross-link cleanly.
function mmSubnav(active) {
  const items = [
    { href: "/mahfol-makfol", en: "For investors", ar: "للمستثمر" },
    { href: "/mahfol-makfol/trips", en: "Trips & experiences", ar: "الرحلات والتجارب" },
    { href: "/tourism", en: "Corporate events", ar: "فعاليات الشركات" },
  ];
  return `<div class="mm-subnav"><a class="mm-subnav-brand" href="${u("/mahfol-makfol")}">${I.globe}<span>${L("Mahfol Makfol", "محفول مكفول")}</span></a><nav>` +
    items.map((it) => `<a href="${u(it.href)}"${it.href === active ? ' class="on"' : ""}>${L(it.en, it.ar)}</a>`).join("") +
    `</nav></div>`;
}

function buildMahfolMakfol() {
  const b = site.businessTourism;

  // Investor services (distinct from the generic tourism "includes").
  const SERVICES = [
    { ic: "🏛️", en: "MISA licensing & market entry", ar: "ترخيص وزارة الاستثمار ودخول السوق", de: "End-to-end MISA investor licensing, RHQ setup and the fastest compliant route into the Saudi market.", da: "ترخيص المستثمر من وزارة الاستثمار (MISA) وتأسيس المقر الإقليمي وأسرع مسار نظامي لدخول السوق." },
    { ic: "🤝", en: "Government & authority relations", ar: "العلاقات الحكومية والجهات التنظيمية", de: "Introductions and coordinated meetings with the ministries and regulators that matter to your sector.", da: "تعريف ولقاءات منسّقة مع الوزارات والجهات التنظيمية ذات الصلة بقطاعك." },
    { ic: "📅", en: "Curated executive meetings", ar: "لقاءات تنفيذية مُنسّقة", de: "One-on-one meetings with decision-makers, partners and potential clients — arranged around your agenda.", da: "لقاءات ثنائية مع صنّاع القرار والشركاء والعملاء المحتملين — مرتّبة حول جدول أعمالك." },
    { ic: "🎤", en: "Forums, workshops & events", ar: "المنتديات وورش العمل والفعاليات", de: "Access to sector forums, investment workshops and official occasions during your visit.", da: "حضور المنتديات القطاعية وورش العمل الاستثمارية والمناسبات الرسمية خلال زيارتك." },
    { ic: "🎯", en: "Investment opportunity sourcing", ar: "تحديد الفرص الاستثمارية", de: "A shortlist of vetted opportunities and promising sectors matched to your capital and appetite.", da: "قائمة مختصرة بفرص مدروسة وقطاعات واعدة تناسب رأس مالك وتوجّهك." },
    { ic: "🥂", en: "Executive hospitality & protocol", ar: "الضيافة التنفيذية والبروتوكول", de: "Luxury hotels, business lunches, private tours and protocol befitting a foreign investor.", da: "فنادق فاخرة وغداءات أعمال وجولات خاصة وبروتوكول يليق بمستثمر أجنبي." },
    { ic: "🕌", en: "Cultural immersion & lifestyle", ar: "الانغماس الثقافي ونمط الحياة", de: "Get to know Saudi culture, lifestyle and the way business is done — before you commit.", da: "تعرّف على الثقافة السعودية ونمط الحياة وطبيعة الأعمال — قبل أن تتخذ قرارك." },
    { ic: "⚖️", en: "Legal, tax & advisory", ar: "الاستشارات القانونية والضريبية", de: "Trusted legal, tax and structuring advisors to de-risk your entry and protect your investment.", da: "مستشارون قانونيون وضريبيون موثوقون لتقليل مخاطر دخولك وحماية استثمارك." },
  ];
  const serviceCards = SERVICES.map((s) =>
    `<div class="card feature"><div class="card-icon" style="font-size:26px">${s.ic}</div><h3>${L(s.en, s.ar)}</h3><p>${L(s.de, s.da)}</p></div>`).join("");

  // City-by-city investor programs.
  const CITIES = [
    { ic: "🏙️", en: "Riyadh", ar: "الرياض", mx: 576, my: 440, te: "Capital & decision-making center", ta: "العاصمة ومركز القرار", se: "Finance · Tech · Regional HQ (RHQ)", sa: "المال · التقنية · المقار الإقليمية", ee: "MISA · RHQ Program · Capital Market Authority · Riyadh Chamber", ea: "وزارة الاستثمار · برنامج المقار الإقليمية · هيئة السوق المالية · غرفة الرياض", ie: "Government briefings, RHQ consultation, C-level meetings, King Abdullah Financial District tour", ia: "إحاطات حكومية، استشارة المقر الإقليمي، لقاءات تنفيذية، جولة في مركز الملك عبدالله المالي" },
    { ic: "🌊", en: "Jeddah", ar: "جدة", mx: 238, my: 600, te: "Red Sea gateway & trade", ta: "بوابة البحر الأحمر والتجارة", se: "Logistics · Trade · Tourism", sa: "اللوجستيات · التجارة · السياحة", ee: "Jeddah Chamber · Islamic Development Bank · Ports Authority", ea: "غرفة جدة · البنك الإسلامي للتنمية · هيئة الموانئ", ie: "Port & logistics visits, family-business networking, Red Sea projects briefing", ia: "زيارات الموانئ واللوجستيات، تواصل مع الشركات العائلية، إحاطة عن مشاريع البحر الأحمر" },
    { ic: "🛢️", en: "Eastern Province", ar: "المنطقة الشرقية", mx: 735, my: 352, te: "Energy & industry heartland", ta: "قلب الطاقة والصناعة", se: "Energy · Industry · Petrochemicals", sa: "الطاقة · الصناعة · البتروكيماويات", ee: "Aramco ecosystem · Royal Commission (Jubail) · Dhahran Techno Valley", ea: "منظومة أرامكو · الهيئة الملكية بالجبيل · وادي الظهران للتقنية", ie: "Industrial-city visits, energy-sector meetings, supply-chain sourcing", ia: "زيارات المدن الصناعية، لقاءات قطاع الطاقة، سلاسل الإمداد" },
    { ic: "🕋", en: "Makkah", ar: "مكة المكرمة", mx: 300, my: 640, te: "Religious economy & hospitality", ta: "اقتصاد ديني وضيافة", se: "Hospitality · Retail · Services", sa: "الضيافة · التجزئة · الخدمات", ee: "Makkah Chamber · Hospitality operators · Religious-tourism authorities", ea: "غرفة مكة · مشغّلو الضيافة · جهات السياحة الدينية", ie: "Religious-tourism investment briefing, hospitality operator meetings", ia: "إحاطة استثمار السياحة الدينية، لقاءات مشغّلي الضيافة" },
    { ic: "🌱", en: "Madinah", ar: "المدينة المنورة", mx: 262, my: 452, te: "Knowledge economy & agriculture", ta: "اقتصاد المعرفة والزراعة", se: "Agriculture · Education · Tourism", sa: "الزراعة · التعليم · السياحة", ee: "Knowledge Economic City · Madinah Chamber · Agri authorities", ea: "مدينة المعرفة الاقتصادية · غرفة المدينة · الجهات الزراعية", ie: "Knowledge Economic City tour, agri-investment briefing", ia: "جولة في مدينة المعرفة الاقتصادية، إحاطة الاستثمار الزراعي" },
    { ic: "⛰️", en: "Asir", ar: "عسير", mx: 392, my: 780, te: "Highlands tourism & nature", ta: "سياحة المرتفعات والطبيعة", se: "Tourism · Agriculture · Entertainment", sa: "السياحة · الزراعة · الترفيه", ee: "Soudah Development · Asir Chamber · Tourism authorities", ea: "تطوير السودة · غرفة عسير · جهات السياحة", ie: "Soudah Peaks overview, mountain-tourism investment, agri-tourism", ia: "جولة قمم السودة، استثمار سياحة الجبال، السياحة الزراعية" },
    { ic: "🌐", en: "NEOM", ar: "نيوم", mx: 75, my: 272, te: "The future & innovation", ta: "المستقبل والابتكار", se: "Technology · Clean energy · Tourism", sa: "التقنية · الطاقة النظيفة · السياحة", ee: "NEOM · Oxagon · The Line · Investment office", ea: "نيوم · أوكساجون · ذا لاين · مكتب الاستثمار", ie: "NEOM briefing, The Line & Oxagon overview, clean-energy opportunities", ia: "إحاطة نيوم، نظرة على ذا لاين وأوكساجون، فرص الطاقة النظيفة" },
    { ic: "⚓", en: "Jazan", ar: "جازان", mx: 405, my: 838, te: "Emerging industry & ports", ta: "صناعة ناشئة وموانئ", se: "Industry · Logistics · Agriculture", sa: "الصناعة · اللوجستيات · الزراعة", ee: "Jazan Economic City · Port authority · Energy sector", ea: "مدينة جازان الاقتصادية · هيئة الميناء · قطاع الطاقة", ie: "Jazan Economic City tour, port & energy briefing, agri-industry", ia: "جولة مدينة جازان الاقتصادية، إحاطة الميناء والطاقة، الصناعات الزراعية" },
  ];
  const cityCards = CITIES.map((c) => `
    <div class="mm-city">
      <div class="mm-city-top"><span class="mm-city-ic">${c.ic}</span><div><h3>${L(c.en, c.ar)}</h3><span class="mm-city-tag">${L(c.te, c.ta)}</span></div></div>
      <div class="mm-city-row"><b>${L("Sectors", "القطاعات")}</b><span>${L(c.se, c.sa)}</span></div>
      <div class="mm-city-row"><b>${L("Key entities", "أبرز الجهات")}</b><span>${L(c.ee, c.ea)}</span></div>
      <div class="mm-city-row"><b>${L("Program includes", "يشمل البرنامج")}</b><span>${L(c.ie, c.ia)}</span></div>
      <a class="btn btn-ghost" style="width:100%;margin-top:4px" href="#mm-form" data-mm-city="${Lraw(c.en, c.en)}">${I.arrow}<span>${L("Request this program", "اطلب هذا البرنامج")}</span></a>
    </div>`).join("");

  // Interactive investment map — inline SVG of Saudi Arabia with clickable
  // region markers; each reveals that region's program (panels rendered below).
  // Recognizable Saudi Arabia outline. Points are projected from real
  // longitude/latitude with the SAME mapping used for the city markers
  // (x = (lon-34)/22*1000, y = (33-lat)/17*900), so borders and markers align:
  // NW (Gulf of Aqaba) → north (Jordan/Iraq) → east Gulf coast with the Qatar
  // notch → SE Empty Quarter → south (Yemen) → Jazan → up the Red Sea coast.
  const KSA_PATH = "M41 193 L92 201 L159 159 L214 64 L364 101 L486 191 L568 209 L659 238 L727 318 L760 400 L748 452 L792 470 L900 520 L982 560 L964 688 L862 712 L700 780 L560 812 L418 826 L389 852 L330 735 L236 614 L200 529 L146 413 L92 291 L50 238 Z";
  const mapMarkers = CITIES.map((c, i) => `
    <g class="mm-mk" data-idx="${i}" transform="translate(${c.mx},${c.my})" tabindex="0" role="button" aria-label="${Lraw(c.en, c.ar)}">
      <circle class="mm-mk-ring" r="16"></circle>
      <circle class="mm-mk-dot" r="8"></circle>
      <text class="mm-mk-lbl" y="-22" text-anchor="middle">${L(c.en, c.ar)}</text>
    </g>`).join("");
  const mapPanels = CITIES.map((c, i) => `
    <div class="mm-map-panel${i === 0 ? " on" : ""}" data-idx="${i}">
      <div class="mm-city-top"><span class="mm-city-ic">${c.ic}</span><div><h3>${L(c.en, c.ar)}</h3><span class="mm-city-tag">${L(c.te, c.ta)}</span></div></div>
      <div class="mm-city-row"><b>${L("Sectors", "القطاعات")}</b><span>${L(c.se, c.sa)}</span></div>
      <div class="mm-city-row"><b>${L("Key entities", "أبرز الجهات")}</b><span>${L(c.ee, c.ea)}</span></div>
      <div class="mm-city-row"><b>${L("Program includes", "يشمل البرنامج")}</b><span>${L(c.ie, c.ia)}</span></div>
      <a class="btn btn-primary" style="width:100%;margin-top:6px" href="#mm-form" data-mm-city="${Lraw(c.en, c.en)}">${I.calendar}<span>${L("Request this program", "اطلب هذا البرنامج")}</span></a>
    </div>`).join("");

  // Target sectors.
  const SECTORS = [
    { ic: "⚡", en: "Energy & Industry", ar: "الطاقة والصناعة", de: "Oil, gas, petrochemicals, mining and manufacturing.", da: "النفط والغاز والبتروكيماويات والتعدين والصناعة." },
    { ic: "💻", en: "Technology", ar: "التقنية", de: "Software, AI, data centers and digital infrastructure.", da: "البرمجيات والذكاء الاصطناعي ومراكز البيانات والبنية الرقمية." },
    { ic: "✈️", en: "Tourism", ar: "السياحة", de: "Giga-projects, hospitality, entertainment and events.", da: "المشاريع الكبرى والضيافة والترفيه والفعاليات." },
    { ic: "🏦", en: "Finance & Real Estate", ar: "المال والعقار", de: "Capital markets, fintech, funds and property development.", da: "أسواق المال والتقنية المالية والصناديق والتطوير العقاري." },
    { ic: "🚢", en: "Logistics & Trade", ar: "اللوجستيات والتجارة", de: "Ports, transport, warehousing and re-export hubs.", da: "الموانئ والنقل والتخزين ومراكز إعادة التصدير." },
    { ic: "🩺", en: "Healthcare", ar: "الرعاية الصحية", de: "Hospitals, biotech, medical devices and health services.", da: "المستشفيات والتقنية الحيوية والأجهزة الطبية والخدمات الصحية." },
    { ic: "🏟️", en: "Sports & Entertainment", ar: "الرياضة والترفيه", de: "Clubs, venues, gaming, media and live events.", da: "الأندية والمنشآت والألعاب والإعلام والفعاليات الحية." },
    { ic: "🌾", en: "Agriculture & Food", ar: "الزراعة والغذاء", de: "Agri-tech, food security, aquaculture and processing.", da: "التقنية الزراعية والأمن الغذائي والاستزراع والتصنيع." },
  ];
  const sectorCards = SECTORS.map((s) =>
    `<div class="mm-sector"><span class="mm-sector-ic">${s.ic}</span><h3>${L(s.en, s.ar)}</h3><p>${L(s.de, s.da)}</p></div>`).join("");

  // How it works.
  const STEPS = [
    { n: "1", en: "Share your interest", ar: "شاركنا اهتمامك", de: "Answer a few questions in the concierge above — purpose, sector, city and timeline.", da: "أجب عن أسئلة قليلة في المستشار أعلاه — الهدف والقطاع والمدينة والتوقيت." },
    { n: "2", en: "We design the program", ar: "نصمّم البرنامج", de: "We build a tailored itinerary of briefings, meetings, site visits and hospitality.", da: "نبني برنامجاً مخصّصاً من الإحاطات واللقاءات والزيارات الميدانية والضيافة." },
    { n: "3", en: "Meetings & visits arranged", ar: "ترتيب اللقاءات والزيارات", de: "We coordinate the authorities, partners and occasions and confirm your agenda.", da: "ننسّق مع الجهات والشركاء والمناسبات ونؤكّد جدول أعمالك." },
    { n: "4", en: "On-ground concierge", ar: "مرافقة ميدانية", de: "A dedicated team hosts you throughout the visit — protocol, transport and follow-up.", da: "فريق مخصّص يستضيفك طوال الزيارة — البروتوكول والتنقّل والمتابعة." },
  ];
  const stepCards = STEPS.map((s) =>
    `<div class="mm-step"><span class="mm-step-n">${s.n}</span><h3>${L(s.en, s.ar)}</h3><p>${L(s.de, s.da)}</p></div>`).join("");

  const body = `
  <style>
    .mm-hero{background:linear-gradient(160deg,var(--navy-900),var(--navy) 60%,var(--navy-700));color:#fff;padding:64px 0 72px;position:relative;overflow:hidden}
    .mm-hero .subbrand-badge{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff}
    .mm-hero .subbrand-badge small{color:rgba(255,255,255,.72)}
    .mm-hero h1{color:#fff;margin:18px 0 12px;font-size:clamp(30px,5vw,50px)}
    .mm-hero .lead{color:rgba(255,255,255,.86);max-width:760px}
    .mm-gold-line{width:64px;height:4px;border-radius:4px;background:rgba(255,255,255,.85);margin:0 0 18px}
    :root{--mm-gold:#0B1B5A;--mm-hi:#24409e}
    .mm-cc{background:#fff;color:var(--text);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);max-width:760px;margin:34px auto 0;padding:26px 26px 30px;text-align:start}
    .mm-cc-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px}
    .mm-cc-head .r{width:44px;height:44px;border-radius:12px;background:var(--navy);color:#fff;display:grid;place-items:center;flex:0 0 auto}
    .mm-cc-head h3{margin:0;font-size:20px}
    .mm-cc-head p{margin:2px 0 0;color:var(--text-soft);font-size:14px}
    .mm-cc-lang{margin-inline-start:auto}
    .mm-cc-lang select{border:1px solid var(--gray-line);border-radius:10px;padding:8px 10px;font:inherit;background:#fff;color:var(--text)}
    .mm-cc-bar{height:6px;border-radius:6px;background:var(--gray-line);margin:16px 0 20px;overflow:hidden}
    .mm-cc-bar>i{display:block;height:100%;background:var(--navy);width:20%;transition:width .3s ease}
    .mm-cc-q{font-size:18px;font-weight:700;margin:0 0 14px}
    .mm-cc-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .mm-cc-opt{border:1.5px solid var(--gray-line);background:#fff;border-radius:12px;padding:13px 15px;font:inherit;color:var(--text);cursor:pointer;text-align:start;transition:.15s;display:flex;align-items:center;gap:10px}
    .mm-cc-opt:hover{border-color:var(--navy);background:var(--gray-bg)}
    .mm-cc-opt.sel{border-color:var(--navy);background:var(--navy);color:#fff}
    .mm-cc-nav{display:flex;justify-content:space-between;gap:10px;margin-top:18px}
    .mm-cc-plan{border:1px solid var(--gray-line);border-radius:14px;background:var(--gray-bg);padding:18px 20px;margin-top:6px}
    .mm-cc-plan h4{margin:0 0 10px;color:var(--navy)}
    .mm-cc-plan .kv{display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed var(--gray-line);font-size:15px}
    .mm-cc-plan .kv:last-of-type{border-bottom:0}
    .mm-cc-plan .kv b{min-width:120px;color:var(--text-soft);font-weight:600}
    .mm-map-wrap{display:grid;grid-template-columns:1.15fr .85fr;gap:24px;align-items:center}
    .mm-map-svg{background:linear-gradient(160deg,#eef1fb,#f7f8fc);border:1px solid var(--gray-line);border-radius:var(--radius-lg);padding:14px}
    .mm-map-svg svg{width:100%;height:auto;display:block;max-height:520px}
    .mm-map-land{fill:#dfe4f5;stroke:var(--navy);stroke-width:3;stroke-linejoin:round}
    .mm-mk{cursor:pointer;outline:none}
    .mm-mk-ring{fill:var(--navy);opacity:.15;transform-box:fill-box;transform-origin:center;transition:.2s}
    .mm-mk-dot{fill:var(--navy);stroke:#fff;stroke-width:3;transition:.2s}
    .mm-mk-lbl{font-size:22px;font-weight:700;fill:var(--text);paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round;pointer-events:none;opacity:0;transition:.2s}
    .mm-mk:hover .mm-mk-lbl,.mm-mk.on .mm-mk-lbl{opacity:1}
    .mm-mk:hover .mm-mk-dot,.mm-mk:focus .mm-mk-dot{fill:var(--mm-hi)}
    .mm-mk.on .mm-mk-dot{fill:var(--mm-hi);r:11}
    .mm-mk.on .mm-mk-ring{fill:var(--mm-hi);opacity:.3;r:22}
    .mm-map-panel{display:none;border:1px solid var(--gray-line);border-radius:16px;background:#fff;box-shadow:var(--shadow-sm);padding:22px;flex-direction:column;gap:11px}
    .mm-map-panel.on{display:flex}
    @media(max-width:820px){.mm-map-wrap{grid-template-columns:1fr}}
    .mm-city-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}
    .mm-city{border:1px solid var(--gray-line);border-radius:16px;background:#fff;box-shadow:var(--shadow-sm);padding:20px;display:flex;flex-direction:column;gap:11px}
    .mm-city-top{display:flex;align-items:center;gap:12px}
    .mm-city-ic{font-size:30px}
    .mm-city-top h3{margin:0;font-size:20px}
    .mm-city-tag{color:var(--mm-gold);font-weight:700;font-size:13px}
    .mm-city-row{font-size:14px;line-height:1.5}
    .mm-city-row b{display:block;color:var(--navy);font-size:12px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:1px}
    .mm-sector-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
    .mm-sector{border:1px solid var(--gray-line);border-radius:14px;background:#fff;padding:18px;box-shadow:var(--shadow-sm)}
    .mm-sector-ic{font-size:26px}
    .mm-sector h3{margin:8px 0 5px;font-size:17px}
    .mm-sector p{margin:0;color:var(--text-soft);font-size:14px}
    .mm-step-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
    .mm-step{position:relative;border:1px solid var(--gray-line);border-radius:14px;background:#fff;padding:22px 18px 18px}
    .mm-step-n{position:absolute;top:-14px;inset-inline-start:18px;width:34px;height:34px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:800}
    .mm-step h3{margin:8px 0 6px;font-size:17px}
    .mm-step p{margin:0;color:var(--text-soft);font-size:14px}
    @media(max-width:560px){.mm-cc-opts{grid-template-columns:1fr}}
  </style>

  ${mmSubnav("/mahfol-makfol")}
  <section class="mm-hero"><div class="container hero-inner" style="max-width:1000px;text-align:start;align-items:flex-start">
    <div class="subbrand-badge">${I.globe}<span>${L("Mahfol Makfol", "محفول مكفول")}</span><small>${L("by Business Partner", "من بزنس بارتنر")}</small></div>
    <h1>${L("Your gateway to investing in Saudi Arabia", "بوابتك للاستثمار في السعودية")}</h1>
    <div class="mm-gold-line"></div>
    <p class="lead">${L("A concierge program for foreign investors — government relations, curated meetings, opportunity sourcing and executive hospitality across the Kingdom's key cities and sectors.", "برنامج استشاري للمستثمرين الأجانب — علاقات حكومية، لقاءات مُنسّقة، تحديد للفرص، وضيافة تنفيذية في أبرز مدن المملكة وقطاعاتها.")}</p>
    <div class="hero-actions" style="justify-content:flex-start"><a class="btn btn-primary btn-lg" href="#mm-concierge">${I.robot}<span>${L("Start with the Investment Concierge", "ابدأ مع مستشار الاستثمار")}</span></a>${waBtn2("Book a consultation", "احجز استشارة", "btn-ghost")}</div>

    <div class="mm-cc" id="mm-concierge">
      <div class="mm-cc-head">
        <span class="r">${I.robot}</span>
        <div><h3>${L("Investment Concierge", "مستشار الاستثمار الذكي")}</h3><p>${L("Answer a few questions — we'll shape your visit.", "أجب عن أسئلة قليلة — نُصمّم زيارتك.")}</p></div>
        <span class="mm-cc-lang"><select id="mmccLang" aria-label="Language">
          <option value="en">English</option><option value="ar">العربية</option><option value="zh">中文</option><option value="ru">Русский</option><option value="es">Español</option><option value="fr">Français</option><option value="ko">한국어</option><option value="ja">日本語</option>
        </select></span>
      </div>
      <div class="mm-cc-bar"><i id="mmccBar"></i></div>
      <div id="mmccBody"></div>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("What we do", "ماذا نقدّم")}</span><h2>${L("Investor concierge services", "خدمات استشارة المستثمر")}</h2><p>${L("Everything a foreign investor needs to explore, decide and enter the Saudi market — handled by one trusted partner.", "كل ما يحتاجه المستثمر الأجنبي ليستكشف ويقرّر ويدخل السوق السعودي — عبر شريك واحد موثوق.")}</p></div>
    <div class="grid grid-3">${serviceCards}</div>
  </div></section>

  <section class="section" id="mm-map"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Explore the map", "استكشف الخريطة")}</span><h2>${L("Interactive investment map", "خريطة الاستثمار التفاعلية")}</h2><p>${L("Tap a region to explore its sectors, key entities and investor program.", "اضغط على منطقة لاستكشاف قطاعاتها وأبرز جهاتها وبرنامج المستثمر فيها.")}</p></div>
    <div class="mm-map-wrap">
      <div class="mm-map-svg">
        <svg viewBox="0 0 1000 900" role="img" aria-label="${Lraw("Investment map of Saudi Arabia", "خريطة الاستثمار في السعودية")}" preserveAspectRatio="xMidYMid meet">
          <path class="mm-map-land" d="${KSA_PATH}"></path>
          ${mapMarkers}
        </svg>
      </div>
      <div class="mm-map-info" id="mmMapInfo">${mapPanels}</div>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Where you'll go", "إلى أين")}</span><h2>${L("Investor programs by city", "برامج المستثمر حسب المدينة")}</h2><p>${L("Each program maps your sector to the right authorities, entities and on-ground experiences.", "كل برنامج يربط قطاعك بالجهات والكيانات والتجارب الميدانية المناسبة.")}</p></div>
    <div class="mm-city-grid">${cityCards}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Target sectors", "القطاعات المستهدفة")}</span><h2>${L("Promising sectors we cover", "القطاعات الواعدة التي نغطّيها")}</h2></div>
    <div class="mm-sector-grid">${sectorCards}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف نعمل")}</span><h2>${L("From interest to on-ground visit", "من الاهتمام إلى الزيارة الميدانية")}</h2></div>
    <div class="mm-step-grid">${stepCards}</div>
  </div></section>

  <section class="section" id="mm-form"><div class="container" style="max-width:720px">
    <div class="section-head"><span class="eyebrow">${L("Plan your trip", "خطّط لرحلتك")}</span><h2>${L("Tell us about your visit", "أخبرنا عن زيارتك")}</h2><p>${L("We'll design a program around your activity and interests, and get back to you within a business day.", "نصمّم لك برنامجاً حسب نشاطك واهتمامك، ونعود إليك خلال يوم عمل.")}</p></div>
    <form class="calc-form" id="mm-form-el" novalidate>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="mm-company">${L("Company / entity", "الشركة / الجهة")}</label><input id="mm-company" type="text" required></div>
        <div class="field"><label for="mm-person">${L("Contact person", "الشخص المسؤول")}</label><input id="mm-person" type="text" required></div>
      </div>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="mm-phone">${L("Mobile", "رقم الجوال")}</label><input id="mm-phone" type="tel" required placeholder="05xxxxxxxx"></div>
        <div class="field"><label for="mm-email">${L("Email", "الإيميل")}</label><input id="mm-email" type="email" required placeholder="name@company.com"></div>
      </div>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="mm-country">${L("Country", "الدولة")}</label><input id="mm-country" type="text"></div>
        <div class="field"><label for="mm-count">${L("Delegation size", "عدد الوفد")}</label><input id="mm-count" type="number" min="1" placeholder="1"></div>
      </div>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="mm-date">${L("Preferred visit period", "الفترة المفضّلة للزيارة")}</label><input id="mm-date" type="text" placeholder="${Lraw("e.g. October 2026", "مثال: أكتوبر 2026")}"></div>
        <div class="field"><label for="mm-sector">${L("Sector / activity of interest", "مجال النشاط أو الاهتمام")}</label><input id="mm-sector" type="text"></div>
      </div>
      <div class="field"><label for="mm-notes">${L("Anything else we should know?", "أي تفاصيل إضافية؟")}</label><textarea id="mm-notes" rows="3"></textarea></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.calendar}<span>${L("Send request", "أرسل الطلب")}</span></button>
      <div class="form-success" id="mm-success" hidden></div>
    </form>
  </div></section>`;

  // Client-side multilingual Investment Concierge (multiple-choice, no backend
  // dependency). It shapes a plan and hands off to the lead form (which feeds
  // the /api/requests investor-tourism pipeline) or to WhatsApp.
  const mmScript = `<script>
(function(){
  var PAGE_LANG = ${JSON.stringify(LANG === "ar" ? "ar" : "en")};
  var WA = ${JSON.stringify(WA)};
  var SEC = [
    {en:"Energy & Industry",ar:"الطاقة والصناعة"},{en:"Technology",ar:"التقنية"},
    {en:"Tourism",ar:"السياحة"},{en:"Finance & Real Estate",ar:"المال والعقار"},
    {en:"Logistics & Trade",ar:"اللوجستيات والتجارة"},{en:"Healthcare",ar:"الرعاية الصحية"},
    {en:"Sports & Entertainment",ar:"الرياضة والترفيه"},{en:"Agriculture & Food",ar:"الزراعة والغذاء"}
  ];
  var CIT = [
    {en:"Riyadh",ar:"الرياض"},{en:"Jeddah",ar:"جدة"},{en:"Eastern Province",ar:"المنطقة الشرقية"},
    {en:"Makkah",ar:"مكة المكرمة"},{en:"Madinah",ar:"المدينة المنورة"},{en:"Asir",ar:"عسير"},
    {en:"NEOM",ar:"نيوم"},{en:"Jazan",ar:"جازان"},{en:"Not sure yet",ar:"لست متأكداً بعد"}
  ];
  var D = {
    en:{q:["What brings you to Saudi Arabia?","Which sector interests you most?","Which city or region?","What is your timeline?"],
      P:["Explore opportunities","Expand my business","Establish a regional HQ (RHQ)","Find a local partner","Attend an event or forum"],
      T:["Within a month","1–3 months","3–6 months","Just researching"],
      back:"Back",next:"Next",plan:"Get my plan",restart:"Start over",
      ptitle:"Your tailored visit",pintro:"Here is the shape of your program. Complete the form below and our team will finalize it within a business day.",
      kP:"Purpose",kS:"Sector",kC:"City / region",kT:"Timeline",wa:"Continue on WhatsApp",form:"Complete my request"},
    ar:{q:["ما الذي يقودك إلى السعودية؟","ما القطاع الذي يهمّك أكثر؟","أي مدينة أو منطقة؟","ما الإطار الزمني لديك؟"],
      P:["استكشاف الفرص","توسيع أعمالي","تأسيس مقر إقليمي (RHQ)","إيجاد شريك محلي","حضور فعالية أو منتدى"],
      T:["خلال شهر","١–٣ أشهر","٣–٦ أشهر","مجرد استكشاف"],
      back:"رجوع",next:"التالي",plan:"اعرض خطتي",restart:"ابدأ من جديد",
      ptitle:"زيارتك المصمّمة",pintro:"هذه ملامح برنامجك. أكمل النموذج أدناه وسيقوم فريقنا بإنهائه خلال يوم عمل.",
      kP:"الهدف",kS:"القطاع",kC:"المدينة / المنطقة",kT:"التوقيت",wa:"تابع عبر واتساب",form:"أكمل طلبي"},
    zh:{q:["您为何来沙特阿拉伯？","您最感兴趣的行业？","哪个城市或地区？","您的时间安排？"],
      P:["探索机会","拓展业务","设立地区总部 (RHQ)","寻找本地合作伙伴","参加活动或论坛"],
      T:["一个月内","1–3 个月","3–6 个月","仅在调研"],
      back:"返回",next:"下一步",plan:"获取方案",restart:"重新开始",
      ptitle:"为您定制的行程",pintro:"这是您行程的框架。请填写下方表单，我们团队将在一个工作日内完成。",
      kP:"目的",kS:"行业",kC:"城市 / 地区",kT:"时间",wa:"通过 WhatsApp 继续",form:"完成我的申请"},
    ru:{q:["Что привело вас в Саудовскую Аравию?","Какой сектор вам интересен?","Какой город или регион?","Каковы ваши сроки?"],
      P:["Изучить возможности","Расширить бизнес","Создать штаб-квартиру (RHQ)","Найти местного партнёра","Посетить мероприятие или форум"],
      T:["В течение месяца","1–3 месяца","3–6 месяцев","Просто изучаю"],
      back:"Назад",next:"Далее",plan:"Получить план",restart:"Начать заново",
      ptitle:"Ваш индивидуальный визит",pintro:"Вот структура вашей программы. Заполните форму ниже, и наша команда завершит её в течение рабочего дня.",
      kP:"Цель",kS:"Сектор",kC:"Город / регион",kT:"Сроки",wa:"Продолжить в WhatsApp",form:"Завершить заявку"},
    es:{q:["¿Qué le trae a Arabia Saudí?","¿Qué sector le interesa más?","¿Qué ciudad o región?","¿Cuál es su plazo?"],
      P:["Explorar oportunidades","Expandir mi negocio","Establecer una sede regional (RHQ)","Encontrar un socio local","Asistir a un evento o foro"],
      T:["En un mes","1–3 meses","3–6 meses","Solo investigando"],
      back:"Atrás",next:"Siguiente",plan:"Ver mi plan",restart:"Empezar de nuevo",
      ptitle:"Su visita personalizada",pintro:"Este es el esquema de su programa. Complete el formulario y nuestro equipo lo finalizará en un día hábil.",
      kP:"Objetivo",kS:"Sector",kC:"Ciudad / región",kT:"Plazo",wa:"Continuar en WhatsApp",form:"Completar mi solicitud"},
    fr:{q:["Qu’est-ce qui vous amène en Arabie saoudite ?","Quel secteur vous intéresse le plus ?","Quelle ville ou région ?","Quel est votre calendrier ?"],
      P:["Explorer les opportunités","Développer mon activité","Établir un siège régional (RHQ)","Trouver un partenaire local","Assister à un événement ou forum"],
      T:["Sous un mois","1–3 mois","3–6 mois","Simple recherche"],
      back:"Retour",next:"Suivant",plan:"Voir mon plan",restart:"Recommencer",
      ptitle:"Votre visite sur mesure",pintro:"Voici la structure de votre programme. Remplissez le formulaire ci-dessous et notre équipe le finalisera sous un jour ouvré.",
      kP:"Objectif",kS:"Secteur",kC:"Ville / région",kT:"Calendrier",wa:"Continuer sur WhatsApp",form:"Compléter ma demande"},
    ko:{q:["사우디아라비아를 찾으신 목적은?","가장 관심 있는 분야는?","어느 도시나 지역인가요?","일정은 어떻게 되나요?"],
      P:["기회 탐색","사업 확장","지역 본부(RHQ) 설립","현지 파트너 찾기","행사·포럼 참석"],
      T:["한 달 이내","1–3개월","3–6개월","조사 중"],
      back:"뒤로",next:"다음",plan:"내 계획 보기",restart:"다시 시작",
      ptitle:"맞춤 방문 일정",pintro:"프로그램의 개요입니다. 아래 양식을 작성해 주시면 영업일 기준 하루 이내에 완성해 드립니다.",
      kP:"목적",kS:"분야",kC:"도시/지역",kT:"일정",wa:"WhatsApp에서 계속",form:"요청 완료하기"},
    ja:{q:["サウジアラビアへの目的は？","最も関心のある分野は？","どの都市・地域ですか？","ご予定の時期は？"],
      P:["機会を探る","事業を拡大する","地域統括拠点(RHQ)を設立","現地パートナーを探す","イベント・フォーラムに参加"],
      T:["1か月以内","1〜3か月","3〜6か月","情報収集中"],
      back:"戻る",next:"次へ",plan:"プランを見る",restart:"最初から",
      ptitle:"あなた専用の訪問プラン",pintro:"プログラムの概要です。下のフォームにご記入いただければ、営業日1日以内に仕上げます。",
      kP:"目的",kS:"分野",kC:"都市・地域",kT:"時期",wa:"WhatsAppで続ける",form:"リクエストを完了"}
  };
  var body = document.getElementById("mmccBody");
  var bar = document.getElementById("mmccBar");
  var sel = document.getElementById("mmccLang");
  if(!body||!sel) return;
  var lang = D[PAGE_LANG] ? PAGE_LANG : "en";
  sel.value = lang;
  var st = {step:0, purpose:-1, sector:-1, city:-1, timeline:-1};
  function esc(s){var d=document.createElement("span");d.textContent=s;return d.innerHTML;}
  function lab(o){return lang==="ar"?o.ar:o.en;}
  function optsFor(step){
    var d=D[lang];
    if(step===0) return d.P.map(function(x){return {t:x};});
    if(step===1) return SEC.map(function(o){return {t:lab(o)};});
    if(step===2) return CIT.map(function(o){return {t:lab(o)};});
    return d.T.map(function(x){return {t:x};});
  }
  function curVal(step){return step===0?st.purpose:step===1?st.sector:step===2?st.city:st.timeline;}
  function setVal(step,i){if(step===0)st.purpose=i;else if(step===1)st.sector=i;else if(step===2)st.city=i;else st.timeline=i;}
  var root = document.getElementById("mm-concierge");
  function render(){
    if(root) root.dir = lang==="ar" ? "rtl" : "ltr";
    var d=D[lang];
    bar.style.width = (st.step>=4?100:((st.step+1)/5*100))+"%";
    if(st.step<4){
      var items=optsFor(st.step), sv=curVal(st.step), html="";
      html+='<div class="mm-cc-q">'+esc(d.q[st.step])+'</div><div class="mm-cc-opts">';
      for(var i=0;i<items.length;i++){html+='<button type="button" class="mm-cc-opt'+(sv===i?" sel":"")+'" data-i="'+i+'">'+esc(items[i].t)+'</button>';}
      html+='</div><div class="mm-cc-nav">';
      html+= st.step>0 ? '<button type="button" class="btn btn-ghost" data-nav="back">'+esc(d.back)+'</button>' : '<span></span>';
      html+= '<button type="button" class="btn btn-primary" data-nav="fwd"'+(sv<0?" disabled":"")+'>'+esc(st.step<3?d.next:d.plan)+'</button>';
      html+='</div>';
      body.innerHTML=html;
    } else {
      var m='<div class="mm-cc-plan"><h4>'+esc(d.ptitle)+'</h4>';
      m+='<div class="kv"><b>'+esc(d.kP)+'</b><span>'+esc(d.P[st.purpose])+'</span></div>';
      m+='<div class="kv"><b>'+esc(d.kS)+'</b><span>'+esc(lab(SEC[st.sector]))+'</span></div>';
      m+='<div class="kv"><b>'+esc(d.kC)+'</b><span>'+esc(lab(CIT[st.city]))+'</span></div>';
      m+='<div class="kv"><b>'+esc(d.kT)+'</b><span>'+esc(d.T[st.timeline])+'</span></div>';
      m+='<p style="margin:12px 0 0;color:var(--text-soft);font-size:14px">'+esc(d.pintro)+'</p></div>';
      m+='<div class="mm-cc-nav"><button type="button" class="btn btn-ghost" data-nav="back">'+esc(d.back)+'</button>';
      m+='<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-primary" data-nav="form">'+esc(d.form)+'</button></div></div>';
      body.innerHTML=m;
    }
  }
  body.addEventListener("click",function(e){
    var o=e.target.closest(".mm-cc-opt");
    if(o){setVal(st.step,parseInt(o.getAttribute("data-i"),10));if(st.step<3){st.step++;}else{st.step=4;}render();return;}
    var n=e.target.closest("[data-nav]");
    if(!n) return;
    var a=n.getAttribute("data-nav");
    if(a==="back"){st.step=Math.max(0,st.step-1);render();}
    else if(a==="fwd"){if(curVal(st.step)<0)return;if(st.step<3){st.step++;}else{st.step=4;}render();}
    else if(a==="form"){
      var setv=function(id,v){var el=document.getElementById(id);if(el&&v)el.value=v;};
      setv("mm-sector", SEC[st.sector].en);
      setv("mm-notes", "Investment Concierge — Purpose: "+D.en.P[st.purpose]+" | City: "+CIT[st.city].en+" | Timeline: "+D.en.T[st.timeline]);
      var f=document.getElementById("mm-form");
      if(f)f.scrollIntoView({behavior:"smooth",block:"start"});
    }
  });
  sel.addEventListener("change",function(){lang=D[sel.value]?sel.value:"en";render();});
  render();
})();
(function(){
  var marks = document.querySelectorAll(".mm-mk");
  var panels = document.querySelectorAll(".mm-map-panel");
  if(!marks.length) return;
  function pick(i){
    for(var a=0;a<marks.length;a++) marks[a].classList.toggle("on", a===i);
    for(var b=0;b<panels.length;b++) panels[b].classList.toggle("on", b===i);
  }
  for(var k=0;k<marks.length;k++){(function(m){
    var idx=parseInt(m.getAttribute("data-idx"),10);
    m.addEventListener("click",function(){pick(idx);});
    m.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();pick(idx);}});
  })(marks[k]);}
  pick(0);
})();
(function(){
  document.addEventListener("click",function(e){
    var a=e.target.closest("[data-mm-city]");
    if(!a) return;
    var city=a.getAttribute("data-mm-city");
    var n=document.getElementById("mm-notes");
    if(n && city){
      var prev=(n.value||"").replace(/^Program of interest:[^—]*(?: — )?/,"");
      n.value = "Program of interest: "+city + (prev?" — "+prev:"");
    }
  });
})();
</script>`;

  return page({
    title: Lraw("Mahfol Makfol by Business Partner — Invest in Saudi Arabia", "محفول مكفول من بزنس بارتنر — استثمر في السعودية"),
    desc: Lraw("A concierge program for foreign investors in Saudi Arabia: MISA licensing, government relations, curated meetings, opportunity sourcing and executive hospitality across the Kingdom's key cities.", "برنامج استشاري للمستثمرين الأجانب في السعودية: ترخيص وزارة الاستثمار، علاقات حكومية، لقاءات مُنسّقة، تحديد للفرص، وضيافة تنفيذية في أبرز مدن المملكة."),
    active: "/mahfol-makfol", path: "/mahfol-makfol", body, script: mmScript,
  });
}

// Mahfol Makfol — Trips & experiences track (leisure/experiential Saudi travel),
// sibling of the investor track. Real destinations, signature experiences,
// tourism-unit management (Gathern/Airbnb) and a trip-request form that feeds
// the same requests pipeline (Notion + WhatsApp + dashboards).
function buildMahfolTrips() {
  // Real Saudi tourism photos (the client's own brochure assets on Google Drive).
  const timg = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  const DEST = [
    { ic: "🏜️", k: "riyadh", price: 600, en: "Riyadh & around", ar: "الرياض وضواحيها", te: "Edge of the World, an hour from the capital", ta: "حافة العالم على بُعد ساعة من العاصمة", pe: "from 600 SAR / person", pa: "من 600 ر.س للشخص", img: "1rW3H3X3_VkPIZIrq8B6mAcfJpldLAhdN", mx: 576, my: 440,
      hlEn: ["Edge of the World cliffs & desert safari", "Diriyah — the UNESCO old town of Saudi Arabia", "Boulevard, dining & modern Riyadh by night"], hlAr: ["حافة العالم والسفاري الصحراوي", "الدرعية التاريخية — موقع اليونسكو", "بوليفارد ومطاعم والرياض ليلاً"] },
    { ic: "🏛️", k: "alula", price: 2029, en: "AlUla", ar: "العلا", te: "An open-air museum 200,000 years old", ta: "متحف مفتوح عمره 200,000 سنة", pe: "3-day packages from 2,029 SAR", pa: "باقات 3 أيام من 2,029 ر.س", img: "1Ja-GvMorEDtgsgPRN0Qb9kRggz48xwEb", mx: 177, my: 339,
      hlEn: ["Hegra — Saudi's first UNESCO site (Nabataean tombs)", "Elephant Rock & AlUla old town", "Maraya, Sharaan & desert stargazing"], hlAr: ["مدائن صالح (الحِجر) — أول موقع يونسكو", "جبل الفيل والبلدة القديمة", "مرايا وشرعان وتأمل النجوم"] },
    { ic: "🕌", k: "jeddah", price: 2290, en: "Jeddah & KAEC", ar: "جدة وكايك", te: "Bride of the Red Sea & gateway to history", ta: "عروس البحر الأحمر وبوابة التاريخ", pe: "from 2,290 SAR / person", pa: "من 2,290 ر.س للشخص", img: "1eQQc_8ZMlhQNxCDWbL0axc9r6Q7yfz5Y", mx: 238, my: 600,
      hlEn: ["Historic Al-Balad — UNESCO old Jeddah", "Corniche, the fountain & Red Sea sunsets", "KAEC, diving & island day-trips"], hlAr: ["جدة البلد التاريخية — موقع اليونسكو", "الكورنيش والنافورة وغروب البحر الأحمر", "كايك والغوص ورحلات الجزر"] },
    { ic: "🌊", k: "neom", price: 2065, en: "NEOM, Duba & Disah", ar: "نيوم وضباء وديسة", te: "Where the tourism of the future is written", ta: "حيث تُكتب سياحة المستقبل", pe: "from 2,065 SAR / person", pa: "من 2,065 ر.س للشخص", img: "1DXjFLZe0rvPURNa4wsGXwq9YWjtoIKs2", mx: 75, my: 272,
      hlEn: ["Wadi Disah — palm canyons & springs", "Red Sea diving off Duba coast", "Untouched mountains & future landmarks"], hlAr: ["وادي ديسة — الأخاديد والنخيل والينابيع", "الغوص في البحر الأحمر بساحل ضباء", "جبال بكر ومعالم المستقبل"] },
    { ic: "🐠", k: "yanbu", price: 2261, en: "Yanbu, Umluj & AlWajh", ar: "ينبع وأملج والوجه", te: "The Maldives of Saudi Arabia", ta: "مالديف السعودية على البحر الأحمر", pe: "from 2,261 SAR / person", pa: "من 2,261 ر.س للشخص", img: "1uY9IzbUEz7uI-HvY48DCrvjM3OG9GRKI", mx: 185, my: 471,
      hlEn: ["Umluj islands — the Saudi Maldives", "Snorkeling over vivid coral reefs", "Beach camps & boat trips"], hlAr: ["جزر أملج — مالديف السعودية", "سنوركل فوق الشعاب المرجانية", "مخيمات شاطئية ورحلات بحرية"] },
    { ic: "🌲", k: "asir", price: 1945, en: "Asir & Abha", ar: "عسير وأبها", te: "Bride of the mountain, above the clouds", ta: "عروس الجبل فوق السحاب", pe: "from 1,945 SAR / person", pa: "من 1,945 ر.س للشخص", img: "1QrvOGRZYQf0TF-9Cwwt03ZVeRUEorjBO", mx: 392, my: 780,
      hlEn: ["Abha & the Habala hanging cliffs", "Cable car above the clouds", "Rijal Almaa heritage village"], hlAr: ["أبها ومنحدرات الحبلة", "التلفريك فوق السحاب", "قرية رجال ألمع التراثية"] },
    { ic: "🏝️", k: "jazan", price: 1897, en: "Jazan & Farasan", ar: "جازان وجزر فرسان", te: "The south's paradise & UNESCO archipelago", ta: "جنة الجنوب وأرخبيل اليونسكو", pe: "from 1,897 SAR / person", pa: "من 1,897 ر.س للشخص", img: "1Gc0OASTIu_yukc0Zpdom6FfTzgasYJCX", mx: 405, my: 838,
      hlEn: ["Farasan Islands — coral & wildlife archipelago", "Fifa mountains & terraced farms", "Coast, boats & fresh seafood"], hlAr: ["جزر فرسان — أرخبيل المرجان والحياة الفطرية", "جبال فيفاء والمدرجات الزراعية", "الساحل والقوارب والمأكولات البحرية"] },
    { ic: "🌹", k: "taif", price: 1696, en: "Taif & AlBaha", ar: "الطائف والباحة", te: "City of roses & summer retreat", ta: "مدينة الورد ومصيف العرب", pe: "from 1,696 SAR / person", pa: "من 1,696 ر.س للشخص", img: "1bs1EA0iu73SUtSwKSWCuBQyB89qt_S2W", mx: 291, my: 619,
      hlEn: ["Rose farms & the old souq", "Al-Hada mountains & cable car", "Al-Shafa greenery & Al-Baha forests"], hlAr: ["مزارع الورد والسوق القديم", "جبال الهدا والتلفريك", "خضرة الشفا وغابات الباحة"] },
    { ic: "🐪", k: "hail", price: null, en: "Hail, AlAhsa & Madinah", ar: "حائل والأحساء والمدينة", te: "Treasures waiting to be discovered", ta: "كنوز تنتظر الاكتشاف", pe: "custom pricing", pa: "تسعيرة خاصة", img: "1bETpN7I-RohaZr2liGisd7nsOiye6AMh", mx: 350, my: 291,
      hlEn: ["Aja & Salma mountains and Hail heritage", "Jubbah rock art — UNESCO", "AlAhsa oasis & a Madinah add-on"], hlAr: ["جبال أجا وسلمى وتراث حائل", "نقوش جبة الصخرية — يونسكو", "واحة الأحساء وإضافة المدينة المنورة"] },
  ];
  // Purchasable trip card: priced → Add to cart (per-person; qty = travellers) →
  // existing checkout (requires sign-in, payment, order in Notion, shows in the
  // client portal). Price-less → request a custom quote via the form.
  const tripBuy = (d, ghost = false) => d.price != null && SHOW_PRICES
    ? cartBtns({ id: "trip-" + d.k, nameEn: "Trip — " + d.en, nameAr: "رحلة — " + d.ar, amount: d.price, priceLabel: L(d.pe, d.pa), kind: "trip", ghost })
    : `<div class="buy-row"><a class="btn ${ghost ? "btn-ghost" : "btn-primary"}" href="#trip-form" data-trip-dest="${Lraw(d.en, d.en)}">${I.calendar}<span>${L("Request a quote", "اطلب عرض سعر")}</span></a></div>`;
  const destCards = DEST.map((d) => `
    <div class="card feature tr-dest" data-trip-open="${d.k}">
      <div class="tr-dest-img" style="background-image:url('${timg(d.img)}')"></div>
      <div class="tr-dest-body">
        <h3><button type="button" class="tr-dest-name" data-trip-open="${d.k}">${L(d.en, d.ar)}</button></h3>
        <p class="tr-tag">${L(d.te, d.ta)}</p>
        ${SHOW_PRICES ? `<span class="tr-price">${L(d.pe, d.pa)}</span>` : ""}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
          ${tripBuy(d)}
          <a class="tr-inquire" href="#trip-form" data-trip-dest="${Lraw(d.en, d.en)}">${L("or ask a question", "أو استفسر أولاً")}</a>
        </div>
      </div>
    </div>`).join("");

  const ACT = [
    { ic: "🚙", en: "Safari & dune bashing", ar: "سفاري وتطعيس", de: "Wrangler jeeps, golden dunes, pro captains.", da: "جيب رانجلر وكثبان ذهبية وكباتن محترفون." },
    { ic: "🥾", en: "Hiking & trails", ar: "هايكنج ومسارات", de: "Edge of the World, the Maze, hidden valleys.", da: "حافة العالم، المتاهة، الوادي الخفي." },
    { ic: "🐎", en: "Horse & camel riding", ar: "ركوب الخيل والجمال", de: "Equestrian experiences in the countryside & beaches.", da: "تجارب فروسية في الريف والشواطئ." },
    { ic: "🤿", en: "Diving & snorkeling", ar: "غوص وسنوركل", de: "Legendary Red Sea reefs in full colour.", da: "شعاب البحر الأحمر بألوانها الأسطورية." },
    { ic: "🛥️", en: "Yacht trips", ar: "رحلات اليخوت", de: "Yacht or boat, 6–12 hours with snacks & seafood.", da: "يخت أو قارب 6-12 ساعة بسناكس وغداء بحري." },
    { ic: "🎈", en: "AlUla hot-air balloon", ar: "منطاد العلا", de: "Sunrise over Hegra from the sky.", da: "شروق الشمس فوق الحِجر من السماء." },
    { ic: "🏛️", en: "Heritage tours", ar: "جولات تراثية", de: "Jeddah Al-Balad, Diriyah, Shaqra & Ushaiqer.", da: "جدة البلد، الدرعية، شقراء وأوشيقر." },
    { ic: "⭐", en: "Stargazing", ar: "تأمل النجوم", de: "AlUla's Gharameel and Riyadh's clear deserts.", da: "الغراميل بالعلا وصحاري الرياض الصافية." },
  ];
  const actCards = ACT.map((a) =>
    `<div class="tr-act"><span class="tr-act-ic">${a.ic}</span><h3>${L(a.en, a.ar)}</h3><p>${L(a.de, a.da)}</p></div>`).join("");


  const KSA = "M41 193 L92 201 L159 159 L214 64 L364 101 L486 191 L568 209 L659 238 L727 318 L760 400 L748 452 L792 470 L900 520 L982 560 L964 688 L862 712 L700 780 L560 812 L418 826 L389 852 L330 735 L236 614 L200 529 L146 413 L92 291 L50 238 Z";
  const mapMarkers = DEST.map((d, i) => `
    <g class="trm" data-idx="${i}" transform="translate(${d.mx},${d.my})" tabindex="0" role="button" aria-label="${Lraw(d.en, d.ar)}">
      <circle class="trm-hit" r="24" fill="transparent"></circle>
      <circle class="trm-ring" r="15"></circle><circle class="trm-dot" r="7"></circle>
      <text class="trm-lbl" y="-20" text-anchor="middle">${L(d.en, d.ar)}</text></g>`).join("");
  const mapPanels = DEST.map((d, i) => `
    <div class="trm-panel${i === 0 ? " on" : ""}" data-idx="${i}">
      <div class="trm-panel-img" style="background-image:url('${timg(d.img)}')"></div>
      <div class="trm-panel-body"><h3>${L(d.en, d.ar)}</h3><p>${L(d.te, d.ta)}</p>${SHOW_PRICES ? `<span class="tr-price">${L(d.pe, d.pa)}</span>` : ""}
      ${tripBuy(d)}</div>
    </div>`).join("");

  const body = `
  <style>
    :root{--mm-gold:#0B1B5A;--mm-gold-2:#24409e}
    .tr-hero{position:relative;color:#fff;padding:62px 0 70px;overflow:hidden;background:var(--navy-900)}
    .tr-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 120% at 85% 0%,#1b2f80 0%,var(--navy) 45%,var(--navy-900) 100%);z-index:0}
    .tr-hero::after{content:"";position:absolute;inset:0;opacity:.5;z-index:0;background-image:radial-gradient(circle at 82% 30%,rgba(255,255,255,.10),transparent 40%);pointer-events:none}
    .tr-hero>.container{position:relative;z-index:1}
    .tr-hero .subbrand-badge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.26);color:#fff}
    .tr-hero .subbrand-badge small{color:rgba(255,255,255,.75)}
    .tr-hero h1{color:#fff;margin:16px 0 10px;font-size:clamp(28px,4.8vw,48px);text-shadow:0 2px 20px rgba(0,0,0,.25)}
    .tr-hero .lead{color:rgba(255,255,255,.9);max-width:720px}
    .tr-gold-line{width:64px;height:4px;border-radius:4px;background:rgba(255,255,255,.85);margin:0 0 16px}
    .tr-trust{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:22px;color:rgba(255,255,255,.92);font-size:.92rem}
    .tr-trust span{display:inline-flex;align-items:center;gap:8px}
    .tr-trust svg{width:18px;height:18px;flex:0 0 auto}
    .tr-agent-head .r svg{width:22px;height:22px}
    .tr-agent-cta .btn svg,.tr-opt svg{width:16px;height:16px}
    /* Smart trip agent (chat) */
    .tr-agent{background:#fff;border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);max-width:820px;margin:30px auto 0;overflow:hidden;text-align:start}
    .tr-agent-head{display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(135deg,var(--navy),var(--navy-700));color:#fff}
    .tr-agent-head .r{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.15);display:grid;place-items:center;flex:0 0 auto}
    .tr-agent-head h3{margin:0;font-size:18px}
    .tr-agent-head p{margin:1px 0 0;font-size:13px;color:rgba(255,255,255,.8)}
    .tr-agent{margin:0 auto}
    .tr-agent-msgs{padding:20px;display:flex;flex-direction:column;gap:12px;min-height:120px;max-height:360px;overflow-y:auto;background:#fff}
    .tr-b{max-width:86%;padding:11px 15px;border-radius:14px;font-size:15px;line-height:1.6}
    .tr-b.bot{background:var(--gray-bg);border:1px solid var(--gray-line);border-start-start-radius:4px;align-self:flex-start;color:var(--text)}
    .tr-b.me{background:var(--navy);color:#fff;border-start-end-radius:4px;align-self:flex-end}
    .tr-opts{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 20px}
    .tr-opt{border:1.5px solid var(--gray-line);background:#fff;border-radius:999px;padding:9px 16px;font:inherit;font-size:14px;color:var(--text);cursor:pointer;transition:.15s}
    .tr-opt:hover{border-color:var(--navy);background:var(--gray-bg)}
    .tr-opt.gold{border-color:var(--navy);color:var(--navy);font-weight:700}
    .tr-agent-cta{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 20px}
    /* Colored terrain map */
    .tr-map-wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:22px;align-items:center}
    .tr-map-svg{border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--gray-line)}
    .tr-map-svg svg{width:100%;height:auto;display:block;max-height:540px}
    .trm{cursor:pointer;outline:none}
    .trm-ring{fill:#fff;opacity:.5;transition:.2s}
    .trm-dot{fill:var(--navy);stroke:#fff;stroke-width:2.5;transition:.2s}
    .trm-lbl{font-size:21px;font-weight:800;fill:#0d1b3e;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round;pointer-events:none;opacity:0;transition:.2s}
    .trm:hover .trm-lbl,.trm.on .trm-lbl{opacity:1}
    .trm:hover .trm-dot,.trm:focus .trm-dot{fill:var(--mm-gold-2)}
    .trm.on .trm-dot{fill:var(--mm-gold-2);r:10}
    .trm.on .trm-ring{fill:var(--mm-gold-2);opacity:.55;r:20}
    .trm-panel{display:none;border:1px solid var(--gray-line);border-radius:16px;background:#fff;box-shadow:var(--shadow-sm);overflow:hidden}
    .trm-panel.on{display:block}
    .trm-panel-img{height:170px;background-size:cover;background-position:center}
    .trm-panel-body{padding:18px;display:flex;flex-direction:column;gap:8px}
    .trm-panel-body h3{margin:0;font-size:20px}
    .trm-panel-body p{margin:0;color:var(--text-soft);font-size:14px}
    @media(max-width:820px){.tr-map-wrap{grid-template-columns:1fr}}
    /* Destination cards with photos */
    .tr-dest{display:flex;flex-direction:column;padding:0;overflow:hidden}
    .tr-dest-img{height:172px;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-start;justify-content:flex-start}
    .tr-dest-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,27,90,0) 55%,rgba(11,27,90,.35))}
    .tr-dest-body{display:flex;flex-direction:column;gap:8px;padding:16px 18px 18px;flex:1}
    .tr-dest-body h3{margin:0;font-size:19px}
    .tr-tag{color:var(--text-soft);font-size:14px;margin:0}
    .tr-price{color:var(--navy);font-weight:800;font-size:14px}
    .tr-inquire{text-align:center;font-size:13px;color:var(--text-soft);text-decoration:none}
    .tr-inquire:hover{color:var(--navy);text-decoration:underline}
    .tr-buy-note{max-width:760px;margin:0 auto 22px;text-align:center;color:var(--text-soft);font-size:14px}
    .tr-dest{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
    .tr-dest:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
    .tr-dest:focus-visible{outline:2px solid var(--navy);outline-offset:2px}
    .tr-dest-name{background:none;border:0;padding:0;margin:0;font:inherit;color:var(--navy);cursor:pointer;text-align:start}
    .tr-dest-name:hover,.tr-dest-name:focus-visible{text-decoration:underline;outline:none}
    .tr-dest .buy-row,.tr-dest .tr-inquire,.tr-dest .add-cart{cursor:auto}
    .tr-modal[hidden]{display:none}
    .tr-modal{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px}
    .tr-modal-ov{position:absolute;inset:0;background:rgba(11,27,90,.55);backdrop-filter:blur(2px)}
    .tr-modal-card{position:relative;z-index:1;background:#fff;border-radius:var(--radius-lg);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);text-align:start}
    .tr-modal-x{position:absolute;z-index:2;top:10px;inset-inline-end:10px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.92);color:var(--navy);font-size:16px;cursor:pointer;box-shadow:var(--shadow-sm)}
    .tr-modal-img{height:200px;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-start}
    .tr-modal-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,27,90,0) 50%,rgba(11,27,90,.4))}
    .tr-modal-body{padding:18px 20px 22px;display:flex;flex-direction:column;gap:10px}
    .tr-modal-body h3{margin:0;font-size:22px;color:var(--navy)}
    .tr-modal-body h4{margin:8px 0 0;font-size:14px;color:var(--text-soft);text-transform:uppercase;letter-spacing:.02em}
    .tr-modal-hl,.tr-modal-inc{margin:0;padding-inline-start:20px;display:flex;flex-direction:column;gap:5px;font-size:15px}
    .tr-modal-hl li::marker{color:var(--navy)}
    .tr-modal-cta{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .tr-modal-cta .btn{flex:1 1 auto}
    .tr-modal-note{margin:4px 0 0;font-size:12.5px;color:var(--text-soft)}
    .tr-act-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
    .tr-act{border:1px solid var(--gray-line);border-radius:14px;background:#fff;padding:18px;box-shadow:var(--shadow-sm);border-top:3px solid var(--mm-gold)}
    .tr-act-ic{font-size:26px}
    .tr-act h3{margin:8px 0 5px;font-size:16px}
    .tr-act p{margin:0;color:var(--text-soft);font-size:13.5px}
    .tr-owner{background:linear-gradient(135deg,#101c4d,#1b2f80);color:#fff;border-radius:var(--radius-lg);padding:30px;text-align:center;margin-top:26px}
    .tr-owner h2{color:#fff;margin:0 0 8px}
    .tr-owner p{color:rgba(255,255,255,.85);max-width:640px;margin:0 auto 18px}
  </style>

  ${mmSubnav("/mahfol-makfol/trips")}
  <section class="tr-hero"><div class="container hero-inner" style="max-width:1000px;text-align:start;align-items:flex-start">
    <div class="subbrand-badge">${I.globe}<span>${L("Mahfol Makfol", "محفول مكفول")}</span><small>${L("by Business Partner", "من بزنس بارتنر")}</small></div>
    <h1>${L("Discover Saudi Arabia — trips & experiences", "استكشف السعودية — رحلات وتجارب")}</h1>
    <div class="tr-gold-line"></div>
    <p class="lead">${L("Curated trips, camps, stays and activities across every region — designed around you and delivered through our vetted local partners.", "رحلات ومخيمات وإقامات وأنشطة مصمّمة في كل مناطق المملكة — حسب رغبتك وعبر شركائنا المحليين المعتمدين.")}</p>
    <div class="hero-actions" style="justify-content:flex-start"><a class="btn btn-primary btn-lg" href="#trip-form">${I.calendar}<span>${L("Design my trip", "صمّم رحلتي")}</span></a>${waBtn2("Book a consultation", "احجز استشارة", "btn-ghost")}</div>
    <div class="tr-trust"><span>${I.check}${L("Vetted, audited suppliers", "موردون معتمدون ومدقّقون")}</span><span>${I.check}${L("Instant booking", "حجز فوري")}</span><span>${I.clock}${L("24/7 support", "دعم على مدار الساعة")}</span></div>
  </div></section>

  <section class="section"><div class="container" style="max-width:840px">
    <div class="section-head"><span class="eyebrow">${L("Smart agent", "الوكيل الذكي")}</span><h2>${L("Plan your trip in 30 seconds", "خطّط رحلتك في 30 ثانية")}</h2><p>${L("Chat with our agent — pick a few options and we'll shape your trip or find your flight.", "تحدّث مع وكيلنا — اختر بعض الخيارات ونصمّم رحلتك أو نبحث لك عن الطيران.")}</p></div>
    <div class="tr-agent" id="tr-agent">
      <div class="tr-agent-head"><span class="r">${I.robot}</span><div><h3>${L("Mahfol Makfol Agent", "وكيل محفول مكفول الذكي")}</h3><p>${L("Trips • Flights • Experiences", "رحلات • طيران • تجارب")}</p></div></div>
      <div class="tr-agent-msgs" id="tr-msgs"></div>
      <div class="tr-opts" id="tr-opts"></div>
      <div class="tr-agent-cta" id="tr-cta"></div>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Explore the map", "استكشف الخريطة")}</span><h2>${L("Where to go — interactive map", "إلى أين — خريطة تفاعلية")}</h2><p>${L("Tap a destination to see photos, highlights and pricing.", "اضغط على وجهة لرؤية الصور والمميزات والأسعار.")}</p></div>
    <div class="tr-map-wrap">
      <div class="tr-map-svg"><svg viewBox="0 0 1000 900" role="img" aria-label="${Lraw("Tourism map of Saudi Arabia", "خريطة السعودية السياحية")}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="mmsand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4e8ca"/><stop offset="1" stop-color="#e3cd9b"/></linearGradient>
          <clipPath id="mmksa"><path d="${KSA}"/></clipPath>
        </defs>
        <rect x="0" y="0" width="1000" height="900" fill="#bfe3ef"/>
        <path d="${KSA}" fill="url(#mmsand)" stroke="#0B1B5A" stroke-width="3" stroke-linejoin="round"/>
        <g clip-path="url(#mmksa)">
          <ellipse cx="380" cy="800" rx="150" ry="120" fill="#7fb27a" opacity=".45"></ellipse>
          <ellipse cx="620" cy="500" rx="270" ry="190" fill="#e9c46a" opacity=".33"></ellipse>
          <ellipse cx="840" cy="600" rx="180" ry="150" fill="#e7b56a" opacity=".38"></ellipse>
          <ellipse cx="250" cy="470" rx="120" ry="150" fill="#8ec9d6" opacity=".33"></ellipse>
          <g fill="#5c8f57" opacity=".85"><path d="M330 802 l28 -50 28 50 z"></path><path d="M372 814 l34 -60 34 60 z"></path><path d="M300 772 l24 -42 24 42 z"></path></g>
          <g fill="none" stroke="#c39f52" stroke-width="6" opacity=".65" stroke-linecap="round"><path d="M520 560 q40 -30 80 0 q40 30 80 0"></path><path d="M560 612 q40 -28 80 0 q40 28 80 0"></path></g>
          <g fill="#3f8f86" opacity=".7"><circle cx="235" cy="600" r="7"></circle><circle cx="250" cy="642" r="6"></circle><circle cx="220" cy="470" r="6"></circle></g>
        </g>
        ${mapMarkers}
      </svg></div>
      <div class="tr-map-info" id="tr-map-info">${mapPanels}</div>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Where to go", "إلى أين")}</span><h2>${L("Destinations across the Kingdom", "وجهات في كل المملكة")}</h2><p>${L("From the Edge of the World to AlUla, the Red Sea islands and the green south.", "من حافة العالم إلى العلا وجزر البحر الأحمر والجنوب الأخضر.")}</p></div>
    <p class="tr-buy-note">${L("Prices are per person — set the number of travellers in your cart. Checkout requires a free account, then pay online or by bank transfer; your booking then appears in your account under \"My orders\".", "الأسعار للشخص الواحد — حدّد عدد المسافرين في السلة. إتمام الحجز يتطلب حساباً مجانياً، ثم الدفع أونلاين أو بتحويل بنكي، ويظهر حجزك في حسابك ضمن «طلباتي».")}</p>
    <div class="grid grid-3">${destCards}</div>
  </div></section>

  <div class="tr-modal" id="tr-modal" hidden>
    <div class="tr-modal-ov" data-tr-close></div>
    <div class="tr-modal-card" role="dialog" aria-modal="true" aria-labelledby="trm-title">
      <button class="tr-modal-x" type="button" data-tr-close aria-label="${Lraw("Close", "إغلاق")}">✕</button>
      <div class="tr-modal-img" id="trm-img"></div>
      <div class="tr-modal-body">
        <h3 id="trm-title"></h3>
        <p class="tr-tag" id="trm-tag"></p>
        <span class="tr-price" id="trm-price"></span>
        <h4>${L("Trip highlights", "أبرز معالم الرحلة")}</h4>
        <ul class="tr-modal-hl" id="trm-hl"></ul>
        <h4>${L("What's included", "ماذا تشمل الرحلة")}</h4>
        <ul class="tr-modal-inc">
          <li>${L("Curated stays & camps", "إقامات ومخيمات مختارة")}</li>
          <li>${L("Private transport & transfers", "تنقّل خاص واستقبال")}</li>
          <li>${L("Expert local guide", "مرشد محلي خبير")}</li>
          <li>${L("Signature experiences & activities", "تجارب وأنشطة مميّزة")}</li>
        </ul>
        <div class="tr-modal-cta" id="trm-cta"></div>
        <p class="tr-modal-note">${L("Per-person price — set the number of travellers in your cart. Booking needs a free account.", "السعر للشخص — حدّد عدد المسافرين في السلة. الحجز يتطلب حساباً مجانياً.")}</p>
      </div>
    </div>
  </div>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Things to do", "الأنشطة")}</span><h2>${L("Signature experiences", "تجارب مميّزة")}</h2></div>
    <div class="tr-act-grid">${actCards}</div>
  </div></section>

  <section class="section section--gray" id="trip-form"><div class="container" style="max-width:720px">
    <div class="section-head"><span class="eyebrow">${L("Design your trip", "صمّم رحلتك")}</span><h2>${L("Tell us about your trip", "أخبرنا عن رحلتك")}</h2><p>${L("Share what you're after and we'll come back with a tailored program and pricing within a day.", "أخبرنا بما ترغب ونعود لك ببرنامج وتسعيرة مخصّصة خلال يوم.")}</p></div>
    <form class="calc-form" id="trip-form-el" novalidate>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="tr-name">${L("Your name", "الاسم")}</label><input id="tr-name" type="text" required></div>
        <div class="field"><label for="tr-phone">${L("Mobile", "رقم الجوال")}</label><input id="tr-phone" type="tel" required placeholder="05xxxxxxxx"></div>
      </div>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="tr-email">${L("Email", "الإيميل")}</label><input id="tr-email" type="email" required placeholder="name@email.com"></div>
        <div class="field"><label for="tr-dest">${L("Destination", "الوجهة")}</label><input id="tr-dest" type="text" placeholder="${Lraw("e.g. AlUla", "مثال: العلا")}"></div>
      </div>
      <div class="grid grid-2" style="gap:0 20px">
        <div class="field"><label for="tr-count">${L("Group size", "عدد الأشخاص")}</label><input id="tr-count" type="number" min="1" placeholder="1"></div>
        <div class="field"><label for="tr-dates">${L("Preferred dates", "التواريخ المفضّلة")}</label><input id="tr-dates" type="text" placeholder="${Lraw("e.g. October", "مثال: أكتوبر")}"></div>
      </div>
      <div class="field"><label for="tr-notes">${L("Anything else?", "أي تفاصيل إضافية؟")}</label><textarea id="tr-notes" rows="3"></textarea></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.calendar}<span>${L("Send request", "أرسل الطلب")}</span></button>
      <div class="form-success" id="trip-success" hidden></div>
    </form>
    <div class="callout" style="margin-top:22px"><span class="ico">🏛️</span><p>${L("Here for business, not leisure?", "زيارتك للأعمال وليست سياحية؟")} <a href="${u("/mahfol-makfol")}">${L("See the investor program →", "شاهد برنامج المستثمر ←")}</a></p></div>
  </div></section>`;

  const tripScript = `<script>
(function(){
  var LANG = ${JSON.stringify(LANG === "ar" ? "ar" : "en")};
  var WA = ${JSON.stringify(WA)};
  var CART = ${JSON.stringify(u("/cart"))};
  var DST = ${JSON.stringify(DEST.map((d) => ({ en: d.en, ar: d.ar, k: d.k, price: d.price, pe: d.pe, pa: d.pa })))};
  var DTL = ${JSON.stringify(DEST.map((d) => ({ k: d.k, ic: d.ic, en: d.en, ar: d.ar, te: d.te, ta: d.ta, pe: d.pe, pa: d.pa, price: d.price, img: timg(d.img), hlEn: d.hlEn || [], hlAr: d.hlAr || [] })))};
  function tr(ar,en){return LANG==="ar"?ar:en;}
  // ----- Smart trip/flight agent (chat, multiple-choice) -----
  var msgs=document.getElementById("tr-msgs"), optsBox=document.getElementById("tr-opts"), ctaBox=document.getElementById("tr-cta");
  if(msgs){
    var destOpts=DST.map(function(d){return {v:d.en,la:d.ar,le:d.en};});
    var KINDS=[{v:"adventure",la:"مغامرة وطبيعة",le:"Adventure & nature"},{v:"family",la:"عائلية",le:"Family"},{v:"luxury",la:"فاخرة VIP",le:"Luxury / VIP"},{v:"heritage",la:"تراث وثقافة",le:"Heritage & culture"},{v:"sea",la:"بحر وجزر",le:"Sea & islands"}];
    var GROUPS=[{v:"1-2",la:"1–2",le:"1–2"},{v:"3-5",la:"3–5",le:"3–5"},{v:"6-10",la:"6–10",le:"6–10"},{v:"10+",la:"+10",le:"10+"}];
    var WHENS=[{v:"month",la:"خلال شهر",le:"Within a month"},{v:"q",la:"1–3 أشهر",le:"1–3 months"},{v:"flex",la:"مرن",le:"Flexible"}];
    var CLASSES=[{v:"economy",la:"اقتصادية",le:"Economy"},{v:"business",la:"رجال أعمال",le:"Business"},{v:"first",la:"أولى",le:"First"}];
    var PAXES=[{v:"1",la:"1",le:"1"},{v:"2",la:"2",le:"2"},{v:"3-4",la:"3–4",le:"3–4"},{v:"5+",la:"+5",le:"5+"}];
    var NOTSURE={v:"notsure",la:"لست متأكداً",le:"Not sure"}, INTL={v:"intl",la:"وجهة دولية",le:"International"};
    var TRIP_STEPS=[
      {key:"dest",q:tr("أي وجهة تشدّك؟","Which destination?"),opts:destOpts.concat([NOTSURE])},
      {key:"kind",q:tr("نوع الرحلة؟","Trip style?"),opts:KINDS},
      {key:"group",q:tr("كم عدد الأشخاص؟","Group size?"),opts:GROUPS},
      {key:"when",q:tr("متى تنوي السفر؟","When?"),opts:WHENS}
    ];
    var FLIGHT_STEPS=[
      {key:"to",q:tr("وين تبي تسافر؟","Where to?"),opts:destOpts.concat([INTL])},
      {key:"cls",q:tr("درجة السفر؟","Cabin class?"),opts:CLASSES},
      {key:"pax",q:tr("كم مسافر؟","Passengers?"),opts:PAXES},
      {key:"when",q:tr("متى؟","When?"),opts:WHENS}
    ];
    var st={mode:null,step:0,data:{}}, steps=[];
    function bubble(text,who){var b=document.createElement("div");b.className="tr-b "+who;b.textContent=text;msgs.appendChild(b);msgs.scrollTop=msgs.scrollHeight;}
    function clearOpts(){optsBox.innerHTML="";ctaBox.innerHTML="";}
    function optBtn(label,cb,gold){var b=document.createElement("button");b.type="button";b.className="tr-opt"+(gold?" gold":"");b.textContent=label;b.addEventListener("click",cb);optsBox.appendChild(b);}
    function askMode(){
      clearOpts();bubble(tr("أهلاً 👋 أنا وكيل محفول مكفول. كيف أساعدك اليوم؟","Hi 👋 I'm the Mahfol Makfol agent. How can I help today?"),"bot");
      optBtn(tr("صمّم رحلة سياحية","Design a trip"),function(){start("trip");},true);
      optBtn(tr("استعلام وحجز طيران","Flights & destination"),function(){start("flight");},true);
    }
    function start(mode){st.mode=mode;st.step=0;st.data={};steps=mode==="trip"?TRIP_STEPS:FLIGHT_STEPS;
      bubble(mode==="trip"?tr("صمّم رحلة سياحية","Design a trip"):tr("استعلام وحجز طيران","Flights & destination"),"me");renderStep();}
    function renderStep(){
      clearOpts();
      if(st.step>=steps.length){plan();return;}
      var s=steps[st.step];bubble(s.q,"bot");
      s.opts.forEach(function(o){optBtn(LANG==="ar"?o.la:o.le,function(){st.data[s.key]={v:o.v,le:o.le,la:o.la};bubble(LANG==="ar"?o.la:o.le,"me");st.step++;renderStep();});});
    }
    function summaryEN(){
      var d=st.data;var parts=[];
      if(st.mode==="flight"){parts.push("FLIGHT");if(d.to)parts.push("To: "+d.to.le);if(d.cls)parts.push("Class: "+d.cls.le);if(d.pax)parts.push("Pax: "+d.pax.le);}
      else{parts.push("TRIP");if(d.dest)parts.push("Destination: "+d.dest.le);if(d.kind)parts.push("Style: "+d.kind.le);if(d.group)parts.push("Group: "+d.group.le);}
      if(d.when)parts.push("When: "+d.when.le);
      return parts.join(" | ");
    }
    function findDest(v){for(var i=0;i<DST.length;i++){if(DST[i].en===v)return DST[i];}return null;}
    var GQ={"1-2":2,"3-5":4,"6-10":8,"10+":10};
    function bookAndPay(qty){
      var sel=(st.data.dest||st.data.to);if(!sel)return;var dd=findDest(sel.v);if(!dd||dd.price==null)return;
      var item={id:"trip-"+dd.k,nameEn:"Trip — "+dd.en,nameAr:"رحلة — "+dd.ar,amount:dd.price,price:(LANG==="ar"?dd.pa:dd.pe),kind:"trip",qty:qty||1};
      try{if(window.BP&&BP.cart){var c=BP.cart.read();var ex=null;for(var i=0;i<c.length;i++){if(c[i].id===item.id){ex=c[i];break;}}if(ex)ex.qty=item.qty;else c.push(item);BP.cart.write(c);}}catch(e){}
      location.href=CART;
    }
    function plan(){
      clearOpts();
      var sel=(st.data.dest||st.data.to);var dd=sel?findDest(sel.v):null;
      var hasBook=st.mode==="trip"&&dd&&dd.price!=null;
      var q=(st.data.group&&GQ[st.data.group.v])||1;
      bubble(st.mode==="flight"?tr("تمام! سنبحث لك عن أفضل الرحلات ونؤكد الحجز. أكمل بياناتك أو تواصل واتساب الآن.","Done! We'll find the best flights and confirm your booking. Complete your details or chat on WhatsApp."):(hasBook?tr("تمام! وجهتك جاهزة للحجز الفوري 👇","Done! Your destination is ready to book instantly 👇"):tr("تمام! جهّزت ملخص رحلتك. أكمل بياناتك ونعود لك ببرنامج وتسعيرة خلال يوم — أو تواصل واتساب الآن.","Done! I've drafted your trip. Complete your details and we'll come back within a day — or chat on WhatsApp.")),"bot");
      var sum=summaryEN();
      if(hasBook){
        bubble(tr(dd.ar+" — "+dd.price+" ر.س للشخص × "+q+" مسافر (تقدر تعدّل العدد في السلة قبل الدفع).",dd.en+" — "+dd.price+" SAR/person × "+q+" travellers (adjust the number in your cart before paying)."),"bot");
        var bk=document.createElement("button");bk.type="button";bk.className="btn btn-primary";bk.textContent=tr("احجز وادفع الآن","Book & pay now");
        bk.addEventListener("click",function(){bookAndPay(q);});ctaBox.appendChild(bk);
      }
      var f=document.createElement("button");f.type="button";f.className=hasBook?"btn btn-ghost":"btn btn-primary";f.textContent=hasBook?tr("أو أكمل بياناتي","Or complete my details"):tr("أكمل بياناتي","Complete my details");
      f.addEventListener("click",function(){
        var dest=(st.data.dest||st.data.to);var destEl=document.getElementById("tr-dest");
        if(destEl&&dest)destEl.value=dest.le;
        var n=document.getElementById("tr-notes");if(n)n.value=sum;
        var form=document.getElementById("trip-form");if(form)form.scrollIntoView({behavior:"smooth",block:"start"});
      });ctaBox.appendChild(f);
      var rs=document.createElement("button");rs.type="button";rs.className="btn btn-ghost";rs.textContent=tr("من جديد","Start over");
      rs.addEventListener("click",function(){msgs.innerHTML="";askMode();});ctaBox.appendChild(rs);
    }
    askMode();
  }
  // ----- Colored map: destination markers <-> panels -----
  (function(){
    var marks=document.querySelectorAll(".trm"),panels=document.querySelectorAll(".trm-panel");
    if(!marks.length)return;
    function pick(i){for(var a=0;a<marks.length;a++)marks[a].classList.toggle("on",a===i);for(var b=0;b<panels.length;b++)panels[b].classList.toggle("on",b===i);}
    for(var k=0;k<marks.length;k++){(function(m){var idx=parseInt(m.getAttribute("data-idx"),10);
      m.addEventListener("click",function(){pick(idx);});
      m.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();pick(idx);}});})(marks[k]);}
    pick(0);
  })();
  // ----- Destination "request" buttons prefill the form -----
  document.addEventListener("click",function(e){
    var a=e.target.closest("[data-trip-dest]");
    if(!a) return;
    var d=document.getElementById("tr-dest");
    if(d) d.value=a.getAttribute("data-trip-dest");
  });
  // ----- Trip details modal (click a destination card to open it) -----
  (function(){
    var modal=document.getElementById("tr-modal");
    if(!modal) return;
    function findD(k){for(var i=0;i<DTL.length;i++){if(DTL[i].k===k)return DTL[i];}return null;}
    function addToCart(d,qty){
      var item={id:"trip-"+d.k,nameEn:"Trip — "+d.en,nameAr:"رحلة — "+d.ar,amount:d.price,price:(LANG==="ar"?d.pa:d.pe),kind:"trip",qty:qty||1};
      try{if(window.BP&&BP.cart){var c=BP.cart.read();var ex=null;for(var i=0;i<c.length;i++){if(c[i].id===item.id){ex=c[i];break;}}if(ex)ex.qty=item.qty;else c.push(item);BP.cart.write(c);}}catch(e){}
    }
    function gotoForm(d){
      close();
      var el=document.getElementById("tr-dest");if(el)el.value=(LANG==="ar"?d.en:d.en);
      var f=document.getElementById("trip-form");if(f)f.scrollIntoView({behavior:"smooth",block:"start"});
    }
    function open(k){
      var d=findD(k);if(!d)return;
      document.getElementById("trm-img").style.backgroundImage="url('"+d.img+"')";
      document.getElementById("trm-title").textContent=(LANG==="ar"?d.ar:d.en);
      document.getElementById("trm-tag").textContent=(LANG==="ar"?d.ta:d.te);
      document.getElementById("trm-price").textContent=(LANG==="ar"?d.pa:d.pe);
      var hl=(LANG==="ar"?d.hlAr:d.hlEn)||[];var ul=document.getElementById("trm-hl");ul.innerHTML="";
      hl.forEach(function(h){var li=document.createElement("li");li.textContent=h;ul.appendChild(li);});
      var cta=document.getElementById("trm-cta");cta.innerHTML="";
      if(d.price!=null){
        var bk=document.createElement("button");bk.type="button";bk.className="btn btn-primary";
        bk.textContent=(LANG==="ar"?"احجز وادفع الآن":"Book & pay now");
        bk.addEventListener("click",function(){addToCart(d,1);location.href=CART;});cta.appendChild(bk);
      }else{
        var rq=document.createElement("button");rq.type="button";rq.className="btn btn-primary";
        rq.textContent=(LANG==="ar"?"اطلب عرض سعر":"Request a quote");
        rq.addEventListener("click",function(){gotoForm(d);});cta.appendChild(rq);
      }
      var ask=document.createElement("button");ask.type="button";ask.className="btn btn-ghost";
      ask.textContent=(LANG==="ar"?"استفسر أولاً":"Ask a question");
      ask.addEventListener("click",function(){gotoForm(d);});cta.appendChild(ask);
      modal.hidden=false;document.body.style.overflow="hidden";
    }
    function close(){modal.hidden=true;document.body.style.overflow="";}
    document.addEventListener("click",function(e){
      if(e.target.closest("[data-tr-close]")){close();return;}
      if(e.target.closest(".add-cart,.buy-row,.tr-inquire")) return;
      var opener=e.target.closest("[data-trip-open]");
      if(opener) open(opener.getAttribute("data-trip-open"));
    });
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"&&!modal.hidden)close();
    });
  })();
})();
</script>`;

  return page({
    title: Lraw("Trips & experiences — Mahfol Makfol by Business Partner", "الرحلات والتجارب — محفول مكفول من بزنس بارتنر"),
    desc: Lraw("Curated Saudi trips, camps, stays and activities across every region — Mahfol Makfol by Business Partner.", "رحلات ومخيمات وإقامات وأنشطة سعودية مصمّمة في كل مناطق المملكة — محفول مكفول من بزنس بارتنر."),
    active: "/mahfol-makfol", path: "/mahfol-makfol/trips", body, script: tripScript,
  });
}

function buildSaudi() {
  const s = site.saudiArabia;
  const targets = s.vision.targets.map((t) => `<div class="stat"><div class="num">${esc(t.value)}</div><div class="lbl">${L(t.labelEn || t.label, t.label)}</div></div>`).join("");
  const sectors = s.sectors.items
    .map((it) => {
      // "Tourism" isn't a services category (it has its own dedicated page) —
      // every other sector here maps to a real category page.
      const href = it.category === "Tourism" ? u("/tourism") : catUrl(it.category);
      return `<a class="card svc-card" href="${href}">
      <div class="card-icon">${I.building}</div>
      <h3>${L(it.titleEn || it.title, it.title)}</h3><p class="desc">${L(it.textEn || it.text, it.text)}</p>
      <span class="card-link">${L("Browse services", "استعرض الخدمات")} ${I.arrow}</span></a>`;
    })
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
    <span class="eyebrow">${L("Invest in Saudi", "الاستثمار في السعودية")}</span>
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
    <div class="cta-band" style="margin-top:40px"><h2>${L("Want a detailed guide for your case?", "تبي دليلاً مفصّلاً لحالتك؟")}</h2><p>${L("The smart agent prepares your service steps and requirements instantly.", "الوكيل الذكي يجهّز لك خطوات خدمتك ومتطلباتها فوراً.")}</p>${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-white", true)}</div>
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
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn btn-primary" href="${u("/magazine")}">${I.doc}<span>${L("Browse the magazine & download PDF", "تصفّح المجلة وحمّلها PDF")}</span></a>
            ${false ? `<a class="btn btn-wa" href="${site.whatsappChannel}" target="_blank" rel="noopener">${I.channel}<span>${L("Follow our WhatsApp channel", "تابع قناتنا في واتساب")}</span></a>` : ""}
          </div>
        </div>
      </div>
    </div>
  </div></section>`;
  return page({ title: Lraw("Insights & news — Business Partner", "الرؤى والأخبار — بيزنس بارتنر"), desc: Lraw("Practical guides, platform updates, success stories and announcements from Business Partner.", "أدلة عملية وتحديثات المنصات وقصص نجاح وإعلانات من بيزنس بارتنر."), active: "/news", body });
}

// Browsable, branded news magazine — content is the same live Notion feed as
// /news, but the PDF issue (browser print-to-PDF, see /magazine/print) is
// gated behind a short registration so we capture the lead first.
function buildMagazine() {
  const today = new Date().toISOString().slice(0, 7);
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Magazine", "المجلة")}</span>
    <h1>${L("Business Partner Magazine", "مجلة بيزنس بارتنر")}</h1>
    <p class="lead">${L("Every government decision and compliance update that matters for your business — browse free, or register once to download the branded PDF issue.", "كل قرار حكومي وتحديث امتثال يهم أعمالك — تصفّح مجاناً، أو سجّل مرة واحدة لتحميل العدد بصيغة PDF بهوية الشركة.")}</p>
  </div></section>

  <section class="section"><div class="container">
    <div class="grid grid-2" data-live-news="20"></div>
  </div></section>

  <section class="section section--gray"><div class="container" style="max-width:560px">
    <div class="section-head"><span class="eyebrow">${L("PDF issue", "العدد بصيغة PDF")}</span><h2>${L("Download the branded PDF issue", "حمّل العدد بصيغة PDF بهوية الشركة")}</h2><p>${L("Register once and we'll open your printable, brand-designed issue — use your browser's “Save as PDF” to download it, and we'll also email you the link.", "سجّل مرة واحدة وسنفتح لك العدد الجاهز للطباعة بتصميم الشركة — استخدم خيار “حفظ كـ PDF” في متصفحك لتنزيله، وسنرسل لك الرابط على بريدك أيضاً.")}</p></div>
    <form class="calc-form" id="mag-form" novalidate>
      <div class="field"><label for="mag-name">${L("Full name", "الاسم الكامل")}</label><input id="mag-name" type="text" required></div>
      <div class="field"><label for="mag-phone">${L("Mobile", "رقم الجوال")}</label><input id="mag-phone" type="tel" required placeholder="05xxxxxxxx"></div>
      <div class="field"><label for="mag-email">${L("Email", "الإيميل")}</label><input id="mag-email" type="email" required></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.doc}<span>${L("Get my PDF issue", "احصل على عددي بصيغة PDF")}</span></button>
      <div class="form-success" id="mag-success" hidden></div>
    </form>
  </div></section>`;
  return page({ title: Lraw("Magazine — Business Partner", "المجلة — بيزنس بارتنر"), desc: Lraw("Government decisions and compliance updates for your business — browse the magazine or download the branded PDF issue.", "قرارات حكومية وتحديثات امتثال تهم أعمالك — تصفّح المجلة أو حمّل العدد بصيغة PDF."), active: "/magazine", path: "/magazine", body });
}

// Print-ready issue: same live news feed, styled for print with the site's
// header/footer/WhatsApp button hidden (see the @media print rules in
// styles.css) so the browser's "Save as PDF" produces a clean, branded PDF —
// no server-side PDF library needed, and Arabic text shapes correctly for
// free because the browser itself renders it.
function buildMagazinePrint() {
  const issue = new Date().toISOString().slice(0, 10);
  const body = `
  <section class="container mag-print"><div class="mag-print-cover">
    <img src="/assets/img/logo.png" alt="Business Partner" width="220" height="42">
    <h1>${L("Business Partner Magazine", "مجلة بيزنس بارتنر")}</h1>
    <p>${L("Issue", "العدد")} — ${esc(issue)}</p>
  </div>
  <div class="grid grid-2" data-live-news="30" data-auto-print="1"></div>
  <p class="mag-print-footer">${L("Business Partner · businesspartner.sa — sources: automated compilation of public news; verify with the official source before acting.", "بيزنس بارتنر · businesspartner.sa — المصادر: تجميع آلي من الأخبار العامة — يُرجى التحقق من المصدر الرسمي قبل أي إجراء.")}</p>
  </section>
  <p class="text-soft center mt-32 no-print">${L("Preparing your printable issue — your browser's print dialog will open automatically. Choose “Save as PDF” as the destination.", "جارٍ تجهيز عددك القابل للطباعة — سيفتح مربع الطباعة في متصفحك تلقائياً. اختر “حفظ كـ PDF” كوجهة الطباعة.")}</p>`;
  return page({ title: Lraw("Magazine — printable issue | Business Partner", "المجلة — نسخة للطباعة | بيزنس بارتنر"), desc: Lraw("Printable Business Partner magazine issue.", "نسخة قابلة للطباعة من مجلة بيزنس بارتنر."), path: "/magazine/print", body });
}

// Pilot: "HR by Business Partner" — a sub-brand landing page that pulls
// together everything HR-related already on the site (services catalog,
// employer recruitment platform, job-seeker intake) under one identity,
// without spinning up a separate site/domain.
function buildHR() {
  const entryCards = [
    ["🏢", L("For employers", "لأصحاب الأعمال"), L("Hire from our pre-screened, Saudization-checked candidate pool — we handle sourcing to onboarding.", "وظّف من قاعدة مرشّحين مُصنّفين ومفحوصين للتوطين — نتولّى من الاستقطاب حتى التعيين."), "/employers", L("Browse candidates", "تصفّح المرشّحين")],
    ["🧑‍🎓", L("For job seekers", "للباحثين عن عمل"), L("Browse open roles and apply — or join our candidate pool once and employers hiring through Business Partner reach you.", "تصفّح الوظائف المفتوحة وقدّم — أو سجّل مرة واحدة في قاعدة المرشّحين وأصحاب العمل الذين يوظّفون عبرنا يصلونك."), "/careers", L("Browse jobs", "تصفّح الوظائف")],
  ].map((p) => `<a class="card feature" href="${u(p[3])}">
    <div class="card-icon" style="font-size:1.6rem">${p[0]}</div>
    <h3>${p[1]}</h3><p>${p[2]}</p>
    <span class="card-link" style="margin-top:10px;display:inline-block">${p[4]} ${I.arrow}</span></a>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:900px">
    <div class="subbrand-badge">${I.building}<span>${L("HR", "الموارد البشرية")}</span><small>${L("by Business Partner", "من بزنس بارتنر")}</small></div>
    <h1>${L("HR by Business Partner", "الموارد البشرية من بزنس بارتنر")}</h1>
    <p class="lead">${L("A recruitment platform for employers and a candidate pool for job seekers — sourcing, screening, interviews, and hiring, managed for you.", "منصة توظيف لأصحاب الأعمال وقاعدة مرشّحين للباحثين عن عمل — استقطاب، فرز، مقابلات، وتوظيف، بندير لك كل شي.")}</p>
    <div class="hero-actions"><a class="btn btn-primary" href="${u("/careers")}#open-jobs">${L("Browse open jobs", "تصفّح الوظائف المفتوحة")}</a></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Two ways in", "طريقتان للبدء")}</span><h2>${L("Whichever side you're on, we've got you", "أياً كان موقعك، عندنا لك حل")}</h2></div>
    <div class="grid grid-2">${entryCards}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Ready to start?", "جاهز نبدأ؟")}</h2><p>${L("Tell us what you need — hiring or a job — and we'll point you to the right track.", "أخبرنا باحتياجك — توظيف أو وظيفة — ونوجّهك للمسار المناسب.")}</p>${waBtn2("Start now", "ابدأ الآن", "btn-white", true)}</div>
  </div></section>`;
  return page({ title: Lraw("HR by Business Partner", "الموارد البشرية من بزنس بارتنر"), desc: Lraw("A recruitment platform for employers and a candidate pool for job seekers.", "منصة توظيف لأصحاب الأعمال وقاعدة مرشّحين للباحثين عن عمل."), active: "/hr", path: "/hr", body });
}

function buildEmployers() {
  const value = [
    [I.users, L("A live pool of pre-screened candidates", "قاعدة حيّة من المرشّحين المُصنّفين"), L("Browse candidates by field, city, experience and availability — updated continuously.", "تصفّح المرشّحين حسب المجال والمدينة والخبرة والجاهزية — محدّثة باستمرار.") + ' <strong data-pool-count style="color:var(--brand)"></strong>'],
    [I.cycle, L("We manage hiring end to end", "ندير التوظيف من البداية للنهاية"), L("Sourcing, screening, interviews, offer and onboarding — handled for you.", "استقطاب، فرز، مقابلات، عرض وتعيين — نتولّاها عنك.")],
    [I.shield, L("Saudization-checked", "مفحوص للتوطين"), L("Each candidate is flagged against HRSD Saudization rules for your activity.", "كل مرشّح مفحوص وفق قواعد التوطين لنشاطك.")],
  ].map((x) => `<div class="card"><div class="card-icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:960px">
    <span class="eyebrow">${L("For employers", "لأصحاب الأعمال")}</span>
    <h1>${L("Hire from our candidate pool", "وظّف من قاعدة مرشّحينا")}</h1>
    <p class="lead">${L("Subscribe and get access to pre-screened, Saudization-checked candidates from our ATS — browse, shortlist, and we handle interviews to onboarding.", "اشترك واحصل على مرشّحين مُصنّفين ومفحوصين للتوطين من نظام التوظيف لدينا — تصفّح، رشّح، ونحن نتولّى من المقابلات حتى التعيين.")}</p>
    <div class="talent-actions" style="margin-top:26px">
      <a class="btn btn-primary" href="${u("/employer-join")}">${I.users}<span>${L("Subscribe now", "اشترك الآن")}</span></a>
    </div>
    <p class="emp-note" style="text-align:center">${L("Already have an account?", "عندك حساب من قبل؟")} <a href="${u("/employer-login")}">${L("Log in", "سجّل الدخول")}</a></p>
  </div></section>

  <section class="section"><div class="container">
    <div class="grid grid-3">${value}</div>
  </div></section>`;
  return page({ title: Lraw("Recruitment for employers — Business Partner", "التوظيف لأصحاب الأعمال — بيزنس بارتنر"), desc: Lraw("Browse pre-screened, Saudization-checked candidates and subscribe to hire.", "تصفّح مرشّحين مُصنّفين ومفحوصين للتوطين واشترك للتوظيف."), active: "/employers", path: "/employers", body });
}

function employerYearly(monthly, discount) {
  return Math.round((Number(monthly) * 12 * (1 - discount)) / 10) * 10;
}

function employerPlanCards({ selectable, standalone }) {
  const plans = (site.employerPlans && site.employerPlans.tiers) || [];
  const discount = (site.employerPlans && site.employerPlans.yearlyDiscount) || 0;
  const fmt = (n) => Number(n).toLocaleString(LANG === "ar" ? "ar-SA" : "en-US");
  const priceHtml = (t) => {
    if (!SHOW_PRICES) return "";
    if (t.price == null) return `<span class="pk-soon">${L("Pricing on request", "السعر عند الطلب")}</span>`;
    const yearly = employerYearly(t.price, discount);
    return `<span class="emp-price emp-price-m">${fmt(t.price)} <span class="pk-per">${L("SAR / mo", "ريال / شهرياً")}</span></span>
      <span class="emp-price emp-price-y" hidden>${fmt(yearly)} <span class="pk-per">${L("SAR / yr", "ريال / سنوياً")}</span></span>`;
  };
  const toggle = discount && SHOW_PRICES
    ? `<div class="emp-billing-toggle" role="tablist">
        <button type="button" class="emp-bill-btn active" data-bill="monthly">${L("Monthly", "شهري")}</button>
        <button type="button" class="emp-bill-btn" data-bill="yearly">${L("Yearly", "سنوي")} <span class="emp-save">${L(`Save ${Math.round(discount * 100)}%`, `وفّر ${Math.round(discount * 100)}٪`)}</span></button>
      </div>`
    : "";
  const cards = plans.map((t) => {
    const feats = (LANG === "ar" ? t.features : (t.featuresEn || t.features)) || [];
    const list = feats.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join("");
    const badge = t.popular ? `<span class="pk-badge">${L("Most popular", "الأكثر طلباً")}</span>` : "";
    const name = L(t.nameEn || t.name, t.name);
    if (standalone) {
      // Local single-select (no cart/checkout): used by /portal/join, which
      // registers directly against api/employer.js rather than routing
      // through the main site's cart+checkout flow.
      return `<div class="pkg emp-plan${t.popular ? " pop" : ""}">
        ${badge}<div class="pk-name">${esc(name)}</div>
        <div class="pk-price">${priceHtml(t)}</div>
        <ul>${list}</ul>
        <button type="button" class="pk-pick emp-plan-pick" data-plan-key="${esc(t.key)}">${L("Select this plan", "اختر هذه الباقة")}</button>
      </div>`;
    }
    if (selectable) {
      const yearly = t.price != null ? employerYearly(t.price, discount) : null;
      const nameAr = `${t.name} — اشتراك صاحب عمل`;
      const nameEn = `${t.nameEn || t.name} — Employer subscription`;
      const priceLabelM = t.price != null ? `${fmt(t.price)} ${L("SAR / mo", "ريال / شهرياً")}` : "";
      const priceLabelY = yearly != null ? `${fmt(yearly)} ${L("SAR / yr", "ريال / سنوياً")}` : "";
      return `<div class="pkg emp-plan${t.popular ? " pop" : ""}">
        ${badge}<div class="pk-name">${esc(name)}</div>
        <div class="pk-price">${priceHtml(t)}</div>
        <ul>${list}</ul>
        <button type="button" class="pk-pick add-cart emp-plan-btn"
          data-id="employer-plan-${esc(t.key)}-monthly" data-kind="package"
          data-name-ar="${esc(nameAr)}" data-name-en="${esc(nameEn)}"
          data-amount="${t.price != null ? t.price : ""}" data-price="${esc(priceLabelM)}"
          data-id-monthly="employer-plan-${esc(t.key)}-monthly" data-id-yearly="employer-plan-${esc(t.key)}-yearly"
          data-amount-monthly="${t.price != null ? t.price : ""}" data-amount-yearly="${yearly != null ? yearly : ""}"
          data-price-monthly="${esc(priceLabelM)}" data-price-yearly="${esc(priceLabelY)}"
        >${L("Select this plan", "اختر هذه الباقة")}</button>
      </div>`;
    }
    return `<div class="pkg${t.popular ? " pop" : ""}">
      ${badge}<div class="pk-name">${esc(name)}</div>
      <div class="pk-price">${priceHtml(t)}</div>
      <ul>${list}</ul>
      <a class="btn ${t.popular ? "btn-primary" : "btn-ghost"}" href="${u("/employer-join")}?plan=${esc(t.key)}">${L("Subscribe", "اشترك")}</a>
    </div>`;
  }).join("");
  return toggle + `<div class="grid grid-3 emp-plans">${cards}</div>`;
}

function buildEmployerJoin() {
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:1040px">
    <span class="eyebrow">${L("For employers", "لأصحاب الأعمال")}</span>
    <h1>${L("Subscribe to the recruitment platform", "اشترك في منصة التوظيف")}</h1>
    <p class="lead">${L("Pick a plan to add it to your cart, then complete registration and payment — full access to our pre-screened candidate pool unlocks right after: search, contacts, CVs, shortlist and hiring pipeline.", "اختر باقة لإضافتها إلى سلتك، ثم أكمل التسجيل والدفع — يفتح مباشرة الوصول الكامل لقاعدة مرشّحينا المُصنّفين: بحث، بيانات تواصل، سير ذاتية، قائمة مختصرة ومراحل توظيف.")}</p>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head" style="margin-bottom:22px"><h2>${L("Choose your plan", "اختر باقتك")}</h2></div>
    ${employerPlanCards({ selectable: true })}
    <p class="emp-note" style="text-align:center;margin-top:22px">${L("Selecting a plan adds it to your cart. Complete your company profile in your account, then pay by bank transfer at checkout — we activate your access right after.", "اختيار الباقة يضيفها إلى سلتك. أكمل ملف شركتك في حسابك، ثم ادفع بالتحويل البنكي عند إتمام الطلب — نفعّل وصولك مباشرة بعدها.")}</p>
  </div></section>`;
  return page({ title: Lraw("Subscribe — employer recruitment platform", "اشترك — منصة توظيف أصحاب العمل"), desc: Lraw("Subscribe to Business Partner's recruitment platform and access the candidate pool.", "اشترك في منصة توظيف بيزنس بارتنر واحصل على الوصول لقاعدة المرشّحين."), active: "/employers", path: "/employer-join", body });
}

function buildEmployerLogin() {
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:520px">
    <span class="eyebrow">${L("For employers", "لأصحاب الأعمال")}</span>
    <h1>${L("Log in to your account", "سجّل الدخول لحسابك")}</h1>
    <p class="lead">${L("Access your hiring dashboard — browse candidates, match with AI, and manage your pipeline.", "ادخل للوحة التوظيف — تصفّح المرشّحين، طابِق بالذكاء، وأدر مسارك.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:480px">
    <form id="el-form" novalidate>
      <div class="field"><label for="el-email">${L("Email", "البريد الإلكتروني")}</label><input type="email" id="el-email" required></div>
      <div class="field"><label for="el-password">${L("Password", "كلمة المرور")}</label><input type="password" id="el-password" required></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;margin-top:10px" id="el-submit">${L("Log in", "دخول")}</button>
      <p class="emp-note" id="el-error" style="color:#B91C1C;text-align:center;min-height:18px;margin-top:10px"></p>
    </form>
    <div style="display:flex;align-items:center;gap:12px;margin:20px 0"><hr style="flex:1;border:none;border-top:1px solid #E2E8F0"><span class="emp-note" style="margin:0">${L("or", "أو")}</span><hr style="flex:1;border:none;border-top:1px solid #E2E8F0"></div>
    <form id="el-code-form" novalidate>
      <div class="field"><label for="el-code">${L("Access code", "رمز الوصول")}</label><input type="text" id="el-code" placeholder="BP-EMP-XXXX" style="text-align:center;letter-spacing:1px" autocomplete="off"></div>
      <button type="submit" class="btn btn-ghost" style="width:100%" id="el-code-submit">${L("Enter with access code", "دخول برمز الوصول")}</button>
      <p class="emp-note" id="el-code-error" style="color:#B91C1C;text-align:center;min-height:18px;margin-top:10px"></p>
    </form>
    <p class="emp-note" style="text-align:center;margin-top:18px">${L("Don't have an account?", "ما عندك حساب؟")} <a href="${u("/employer-join")}">${L("Subscribe from our plans", "اشترك من باقاتنا")}</a></p>
  </div></section>`;
  return page({ title: Lraw("Employer log in — Business Partner", "تسجيل دخول أصحاب العمل — بيزنس بارتنر"), desc: Lraw("Log in to your Business Partner employer dashboard.", "سجّل الدخول للوحة التوظيف الخاصة بك في بيزنس بارتنر."), active: "/employers", path: "/employer-login", body });
}

// A dedicated, full page for one candidate (instead of the old in-modal
// preview) — content is filled client-side from /api/candidates?id=… by the
// #cp-app IIFE in main.js, laid out like a profile page (header, badges,
// skills, full CV) rather than a raw field dump.
function buildCandidateProfile() {
  const body = `
  <section class="section" style="padding-top:26px"><div class="container" style="max-width:780px">
    <a class="back-link" href="${u("/employer-dashboard")}">${I.arrow} ${L("Back to dashboard", "رجوع للوحة التوظيف")}</a>
    <div id="cp-app" style="margin-top:18px">
      <p class="emp-note" id="cp-status" style="text-align:center;padding:60px 0">${L("Loading candidate…", "جارٍ تحميل بيانات المرشّح…")}</p>
    </div>
  </div></section>
  <script>window.BP_EMP_LANG=${JSON.stringify(LANG)};</script>`;
  return page({ title: Lraw("Candidate profile — Business Partner", "الملف الشخصي للمرشّح — بيزنس بارتنر"), desc: Lraw("Full candidate profile — experience, education, skills and CV.", "الملف الشخصي الكامل للمرشّح — الخبرة والتعليم والمهارات والسيرة الذاتية."), active: "/employers", path: "/candidate-profile", body });
}

function buildNewsletter() {
  const perks = [
    ["🗞️", L("Weekly compliance & regulatory digest", "نشرة أسبوعية للامتثال والأنظمة"), L("Every Sunday: government decisions and regulatory news that matter for companies across every sector — MISA, HRSD, ZATCA, GOSI, Qiwa, Mudad and more.", "كل أحد: قرارات حكومية وأخبار تنظيمية تهم الشركات في جميع القطاعات — الاستثمار، الموارد البشرية، الزكاة والضريبة، التأمينات، قوى، مدد وغيرها.")],
    ["💡", L("Practical guides", "أدلة عملية"), L("Step-by-step guides for formation, licensing, Saudization and compliance.", "أدلة خطوة بخطوة للتأسيس والتراخيص والتوطين والامتثال.")],
    ["📊", L("Market insights", "قراءات السوق"), L("Opportunities and trends across Saudi sectors, tied to Vision 2030.", "فرص واتجاهات في القطاعات السعودية مرتبطة برؤية 2030.")],
    ["🎁", L("Subscriber-only offers", "عروض خاصة للمشتركين"), L("Occasional offers on our services and packages.", "عروض من حين لآخر على خدماتنا وباقاتنا.")],
  ].map((x) => `<div class="card"><div class="card-icon" style="font-size:1.5rem">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:820px">
    <span class="eyebrow">${L("Newsletter", "النشرة الإخبارية")}</span>
    <h1>${L("Stay ahead of Saudi business & regulations", "ابقَ في الصدارة بأخبار الأعمال والأنظمة السعودية")}</h1>
    <p class="lead">${L("Every Sunday morning — compliance decisions and business news that matter across every sector, summarized and actionable, delivered in both Arabic and English.", "كل أحد صباحاً — قرارات الامتثال وأخبار الأعمال المهمة في جميع القطاعات، مُلخّصة وقابلة للتطبيق، وتصلك بالعربية والإنجليزية.")}</p>
    <form class="newsletter-form newsletter-hero" data-nl>
      <input type="email" placeholder="${Lraw("Your email", "بريدك الإلكتروني")}" aria-label="${Lraw("Email", "البريد الإلكتروني")}" data-nl-email required>
      <button type="submit" class="btn btn-primary btn-lg">${L("Subscribe", "اشترك")}</button>
    </form>
    <p class="nl-msg" data-nl-msg hidden></p>
    <p class="emp-note">${L("Free. No spam. Unsubscribe anytime.", "مجاناً. بدون إزعاج. يمكنك إلغاء الاشتراك في أي وقت.")}</p>
    ${false ? `<div style="margin-top:14px"><a class="btn btn-wa" href="${site.whatsappChannel}" target="_blank" rel="noopener">${I.channel}<span>${L("Or follow our WhatsApp channel", "أو تابع قناتنا على واتساب")}</span></a></div>` : ""}
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("What you'll get", "ماذا ستحصل عليه")}</span><h2>${L("Every Sunday in your inbox", "كل أحد في بريدك")}</h2></div>
    <div class="grid grid-4">${perks}</div>
    <div class="center mt-32"><a class="btn btn-ghost" href="${u("/news")}">${L("Browse past insights", "تصفّح الأعداد السابقة")}</a></div>
  </div></section>`;
  return page({ title: Lraw("Newsletter — Business Partner", "النشرة الإخبارية — بيزنس بارتنر"), desc: Lraw("Subscribe to Business Partner's weekly newsletter on Saudi business and regulations.", "اشترك في النشرة الأسبوعية من بيزنس بارتنر عن الأعمال والأنظمة في السعودية."), active: "/newsletter", path: "/newsletter", body });
}

// Canonical Field taxonomy — shared by the employer job-posting form, the
// employer browse filter (populated client-side, see main.js fillFilters),
// api/candidates.js's FIELD_OPTIONS validation and api/candidate.js's
// guessField() classifier. Keep all four in sync when editing this list.
const FIELD_TAXONOMY = [
  ["هندسة", "Engineering"], ["تقنية معلومات", "IT & Software"], ["مبيعات وتسويق", "Sales & Marketing"],
  ["محاسبة ومالية", "Accounting & Finance"], ["إداري وسكرتارية", "Admin & Secretarial"], ["موارد بشرية", "Human Resources"],
  ["ضيافة وسياحة", "Hospitality & Tourism"], ["مقاولات وإنشاءات", "Construction"], ["عقارات", "Real Estate"],
  ["صحة وطب", "Health & Medical"], ["تعليم", "Education"], ["لوجستيات ونقل", "Logistics & Transportation"],
  ["قانون", "Legal"], ["تصنيع وصناعة", "Manufacturing & Industrial"], ["طاقة ونفط وغاز", "Energy, Oil & Gas"],
  ["إعلام وإبداع", "Media & Creative"], ["حكومي وقطاع عام", "Government & Public Sector"], ["زراعة وبيئة", "Agriculture & Environment"],
  ["تجزئة وتجارة إلكترونية", "Retail & E-commerce"], ["أمن وسلامة", "Security & Safety"], ["حرف مهنية وصيانة", "Skilled Trades & Maintenance"],
  ["علوم وأبحاث", "Science & Research"], ["طيران وبحري", "Aviation & Maritime"], ["تجميل وعناية", "Beauty & Wellness"],
  ["خدمات منزلية", "Domestic & Household Services"], ["أخرى", "Other"],
];
function fieldOptionsHtml() {
  return FIELD_TAXONOMY.map(([ar, en]) => `<option value="${esc(ar)}">${L(en, ar)}</option>`).join("");
}

function buildEmployerDashboard() {
  const nats = `<option value="">${L("Any nationality", "أي جنسية")}</option><option value="سعودي">${L("Saudi", "سعودي")}</option><option value="غير سعودي">${L("Non-Saudi", "غير سعودي")}</option>`;
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:1080px">
    <span class="eyebrow">${L("AI Hiring OS", "نظام التوظيف الذكي")}</span>
    <h1>${L("Your AI Hiring Operating System", "نظام التوظيف الذكي")}</h1>
    <p class="lead">${L("Browse our pre-screened candidate pool, match candidates to any role with AI, and run your whole hiring pipeline. Subscribe to unlock contact details and AI tools.", "تصفّح قاعدة مرشّحينا المُصنّفين، طابِق المرشّحين مع أي وظيفة بالذكاء، وأدر مسار التوظيف كامل. اشترك لفتح بيانات التواصل وأدوات الذكاء.")}</p>
  </div></section>

  <section class="section"><div class="container">
    <div id="empd-app">
      <div id="empd-locked" style="max-width:460px;margin:0 auto;text-align:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;padding:34px 26px">
        <div style="font-size:2rem" aria-hidden="true">🔐</div>
        <h3 style="margin:10px 0 6px">${L("Log in to your hiring dashboard", "سجّل الدخول للوحة التوظيف")}</h3>
        <p class="emp-note" style="margin:0 0 18px">${L("Your posted jobs, AI-matched candidates and hiring pipeline — all in one place.", "وظائفك المنشورة، والمرشّحون المطابقون بالذكاء، ومسار التوظيف — كلها في مكان واحد.")}</p>
        <a class="btn btn-primary" style="width:100%" href="${u("/employer-login")}">${L("Log in", "تسجيل الدخول")}</a>
        <a class="btn btn-ghost" style="width:100%;margin-top:10px" href="${u("/employer-join")}">${L("New here? Subscribe", "جديد؟ اشترك الآن")}</a>
        <p class="emp-note" style="margin:14px 0 0"><button type="button" class="linkbtn" id="empd-demo">${L("Try a demo", "جرّب نسخة تجريبية")}</button></p>
        <p id="empd-gate-msg" class="emp-note" style="min-height:18px;margin:6px 0 0"></p>
      </div>
      <div id="empd-main" hidden>
      <div class="empd-welcome" style="display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:space-between;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px 16px;margin-bottom:14px">
        <span id="empd-welcome-txt" style="font-weight:600"></span>
        <span class="emp-note" style="margin:0">${L("Candidate pool:", "قاعدة المرشّحين:")} <strong data-pool-count>…</strong></span>
      </div>
      <div class="empd-bar">
        <div class="empd-tabs">
          <button class="empd-tab active" data-tab="postings">📋 ${L("My jobs & matches", "وظائفي والمطابقات")}</button>
          <button class="empd-tab" data-tab="match">✨ ${L("AI Match", "مطابقة ذكية")}</button>
          <button class="empd-tab" data-tab="browse">${L("Browse candidates", "تصفّح المرشّحين")}</button>
          <button class="empd-tab" data-tab="shortlist">${L("Shortlist", "المفضّلة")} <span class="empd-count" id="empd-short-count">0</span></button>
          <button class="empd-tab" data-tab="pipeline">${L("Pipeline", "مسار التوظيف")}</button>
        </div>
        <button class="btn btn-ghost btn-sm" id="empd-logout">${L("Sign out", "خروج")}</button>
      </div>

      <div class="empd-panel" data-panel="match" hidden>
        <div class="empd-match-box">
          <h3>✨ ${L("Match candidates to a role with AI", "طابق المرشّحين مع وظيفة بالذكاء")}</h3>
          <p class="emp-note">${L("Describe the role, requirements or paste a job description — AI ranks your best-fit candidates and explains why.", "اكتب الوظيفة أو المتطلبات أو الصق وصفاً وظيفياً — الذكاء يرتّب أنسب المرشّحين ويشرح السبب.")}</p>
          <textarea id="empd-jd" rows="4" placeholder="${Lraw("e.g. Senior accountant, 5+ years, SOCPA, Riyadh, Saudi national preferred…", "مثال: محاسب أول، خبرة +5 سنوات، عضوية SOCPA، الرياض، يفضّل سعودي…")}"></textarea>
          <button class="btn btn-primary" id="empd-match-run">✨ ${L("Match with AI", "طابق بالذكاء")}</button>
        </div>
        <p class="emp-note" id="empd-match-status"></p>
        <div class="emp-grid" id="empd-match-grid"></div>
      </div>

      <div class="empd-panel" data-panel="postings">
        <h3 style="margin:0 0 4px">${L("Your posted jobs", "وظائفك المنشورة")}</h3>
        <p class="emp-note" style="margin:0 0 14px">${L("AI screens the pool for every job automatically — matched candidates appear under each job with contact buttons.", "الذكاء يفرز القاعدة لكل وظيفة تلقائياً — والمرشّحون المطابقون يظهرون تحت كل وظيفة مع أزرار التواصل.")}</p>
        <div id="empjob-list"></div>
        <div class="empd-match-box" style="margin-top:18px">
          <h3>📋 ${L("Post a new job", "انشر وظيفة جديدة")}</h3>
          <p class="emp-note">${L("Open as many job postings as you need. AI screens and shortlists candidates for each one automatically.", "افتح عدد الوظائف اللي تحتاجه. الذكاء يفلتر ويرشّح المرشّحين المناسبين لكل وظيفة تلقائياً.")}</p>
          <div class="grid grid-2" style="gap:0 14px">
            <div class="field"><label for="empjob-title">${L("Job title", "المسمى الوظيفي")}</label><input id="empjob-title" type="text" placeholder="${Lraw("Type or pick, e.g. Accountant", "اكتب أو اختر، مثال: محاسب")}"></div>
            <div class="field"><label for="empjob-city">${L("City", "المدينة")}</label><input id="empjob-city" type="text" placeholder="${Lraw("Type or pick, e.g. Saudi Arabia — Riyadh", "اكتب أو اختر، مثال: السعودية — الرياض")}"></div>
          </div>
          <div class="field"><label for="empjob-field">${L("Field", "المجال")}</label><select id="empjob-field"><option value="">${L("Auto-detect from title", "يُحدَّد تلقائياً من المسمى")}</option>${fieldOptionsHtml()}</select></div>
          <div class="field"><label for="empjob-desc" style="display:flex;justify-content:space-between;align-items:center;gap:8px">${L("Description & requirements", "الوصف والمتطلبات")}<button type="button" class="linkbtn" id="empjob-ai-write" style="font-size:.85rem;padding:0">✨ ${L("Write with AI", "اكتبها بالذكاء")}</button></label><textarea id="empjob-desc" rows="4" placeholder="${Lraw("Responsibilities, required experience, certifications, nationality preference…", "المهام، الخبرة المطلوبة، الشهادات، تفضيل الجنسية…")}"></textarea></div>
          <button class="btn btn-primary" id="empjob-publish">📋 ${L("Publish job posting", "انشر الوظيفة")}</button>
          <p class="emp-note" id="empjob-status"></p>
        </div>
      </div>

      <div class="empd-panel" data-panel="browse" hidden>
        <div class="emp-access"><div class="emp-filters">
          <input type="text" id="empd-q" placeholder="${Lraw("Search job title, skill…", "ابحث بالمسمى الوظيفي أو المهارة…")}">
          <input type="text" id="empd-field" placeholder="${Lraw("All fields", "كل المجالات")}">
          <input type="text" id="empd-country" placeholder="${Lraw("All countries", "كل الدول")}">
          <input type="text" id="empd-city" placeholder="${Lraw("All cities", "كل المدن")}">
          <select id="empd-nat">${nats}</select>
          <button type="button" class="btn btn-primary" id="empd-load">${L("Refresh", "تحديث")}</button>
        </div></div>
        <p class="emp-note" id="empd-status"></p>
        <div class="emp-grid" id="empd-grid"></div>
      </div>

      <div class="empd-panel" data-panel="shortlist" hidden>
        <p class="emp-note">${L("Candidates you saved. They stay on this device.", "المرشّحون اللي حفظتهم. محفوظون على هذا الجهاز.")}</p>
        <div class="emp-grid" id="empd-short-grid"></div>
      </div>

      <div class="empd-panel" data-panel="pipeline" hidden>
        <p class="emp-note">${L("Move candidates through your hiring stages using the buttons on each card.", "انقل المرشّحين عبر مراحل التوظيف من الأزرار على كل بطاقة.")}</p>
        <div class="empd-pipe" id="empd-pipe"></div>
      </div>
      </div>
    </div>
  </div></section>

  <div class="empd-modal" id="empd-modal" hidden><div class="empd-modal-in">
    <button class="empd-modal-x" id="empd-modal-x">✕</button>
    <h3 id="empd-modal-title"></h3>
    <div class="empd-modal-body" id="empd-modal-body"></div>
  </div></div>
  <script>window.BP_EMPD_LANG=${JSON.stringify(LANG)};</script>`;
  return page({ title: Lraw("AI Hiring OS — Business Partner", "نظام التوظيف الذكي — بيزنس بارتنر"), desc: Lraw("AI Hiring Operating System: match candidates with AI, assessments, interview questions, shortlist and pipeline.", "نظام التوظيف الذكي: مطابقة بالذكاء الاصطناعي، تقييمات، أسئلة مقابلة، قائمة مختصرة ومسار توظيف."), active: "/employers", path: "/employer-dashboard", body });
}

// ============ Standalone HR Portal (hr.businesspartner.sa) ============
// Fully separate identity: own header/footer, no site nav, no cart/services.
// Same backend (/api/employer, /api/candidates) and same main.js — the
// dashboard/join/candidates markup below reuses the exact element IDs the
// existing main.js already wires up, so no JS changes are needed.

function buildPortalHome() {
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:900px;text-align:center">
    <span class="eyebrow">${L("HR by Business Partner", "الموارد البشرية من بزنس بارتنر")}</span>
    <h1>${L("Hire smarter with AI", "وظّف بذكاء أكبر")}</h1>
    <p class="lead">${L("A recruitment portal for employers and job seekers — AI matching, a pre-screened candidate pool, and a full hiring pipeline.", "بوابة توظيف لأصحاب الأعمال والباحثين عن عمل — مطابقة بالذكاء، قاعدة مرشّحين مُصنّفة، ومسار توظيف كامل.")}</p>
    <div class="talent-actions" style="margin-top:24px;justify-content:center">
      <a class="btn btn-primary" href="${pu("/join")}">${L("For employers", "لأصحاب الأعمال")}</a>
      <a class="btn btn-ghost" href="${pu("/dashboard")}">${L("Employer dashboard", "لوحة التوظيف")}</a>
      <a class="btn btn-ghost" href="${pu("/candidates")}">${L("For job seekers", "للباحثين عن عمل")}</a>
    </div>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3">
      <a class="card feature" href="${pu("/join")}"><div class="card-icon">🏢</div><h3>${L("Subscribe", "اشترك")}</h3><p>${L("Pick a plan and register your company to unlock the candidate pool.", "اختر باقة وسجّل شركتك لفتح قاعدة المرشّحين.")}</p></a>
      <a class="card feature" href="${pu("/dashboard")}"><div class="card-icon">✨</div><h3>${L("AI Hiring Dashboard", "لوحة التوظيف الذكية")}</h3><p>${L("Browse, match with AI, shortlist and run your hiring pipeline.", "تصفّح، طابِق بالذكاء، رشّح، وأدر مسار التوظيف.")}</p></a>
      <a class="card feature" href="${pu("/candidates")}"><div class="card-icon">🧑‍🎓</div><h3>${L("Job Seekers", "الباحثون عن عمل")}</h3><p>${L("Join the pool once — employers hiring through us reach you.", "سجّل مرة واحدة — وأصحاب العمل يصلونك.")}</p></a>
    </div>
  </div></section>`;
  return portalPage({ title: Lraw("HR by Business Partner — recruitment portal", "الموارد البشرية من بزنس بارتنر — بوابة التوظيف"), desc: Lraw("A standalone recruitment portal: AI matching, candidate pool and hiring pipeline.", "بوابة توظيف مستقلة: مطابقة بالذكاء، قاعدة مرشّحين، ومسار توظيف."), path: "/portal/index", active: "/", body });
}

function buildPortalJoin() {
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:1040px">
    <span class="eyebrow">${L("For employers", "لأصحاب الأعمال")}</span>
    <h1>${L("Subscribe to the recruitment platform", "اشترك في منصة التوظيف")}</h1>
    <p class="lead">${L("Pick a plan, register your company, and unlock full access to our pre-screened candidate pool.", "اختر باقة، سجّل شركتك، وافتح الوصول الكامل لقاعدة مرشّحينا المُصنّفين.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <form id="emp-join" novalidate>
      <div class="section-head" style="margin-bottom:22px"><span class="eyebrow">${L("Step 1", "الخطوة 1")}</span><h2>${L("Choose your plan", "اختر باقتك")}</h2></div>
      ${employerPlanCards({ standalone: true })}
      <input type="hidden" id="ej-plan" required>
      <p class="emp-note" id="ej-plan-note" style="text-align:center;margin-top:8px"></p>
      <div class="section-head" style="margin:44px 0 22px"><span class="eyebrow">${L("Step 2", "الخطوة 2")}</span><h2>${L("Company details", "بيانات الشركة")}</h2></div>
      <div class="join-grid">
        <div class="field"><label for="ej-company">${L("Company name", "اسم الشركة")} *</label><input type="text" id="ej-company" required></div>
        <div class="field"><label for="ej-cr">${L("Commercial Registration (CR)", "رقم السجل التجاري")}</label><input type="text" id="ej-cr" inputmode="numeric" placeholder="${Lraw("Optional", "اختياري")}"></div>
        <div class="field"><label for="ej-contact">${L("Contact person", "اسم المسؤول")}</label><input type="text" id="ej-contact"></div>
        <div class="field"><label for="ej-phone">${L("Mobile", "رقم الجوال")} *</label><input type="tel" id="ej-phone" inputmode="tel" placeholder="05XXXXXXXX" required></div>
        <div class="field"><label for="ej-email">${L("Work email", "البريد الإلكتروني للعمل")} *</label><input type="email" id="ej-email" placeholder="name@company.com" required></div>
        <div class="field"><label for="ej-password">${L("Password", "كلمة المرور")} *</label><input type="password" id="ej-password" minlength="8" placeholder="${Lraw("At least 8 characters", "8 أحرف على الأقل")}" required></div>
        <div class="field field-full"><label for="ej-notes">${L("Notes (roles you're hiring for, etc.)", "ملاحظات (الوظائف المطلوبة، إلخ)")}</label><textarea id="ej-notes" rows="3"></textarea></div>
      </div>
      <div class="join-actions">
        <button type="submit" class="btn btn-primary btn-lg" id="ej-submit">${L("Create account & continue to subscribe", "أنشئ حسابك وتابع الاشتراك")}</button>
        <p class="emp-note">${L("After registering you'll complete payment (or bank transfer) and we activate your access. Use this email + password to log in any time.", "بعد التسجيل تُكمل الدفع (أو تحويل بنكي) ونفعّل وصولك. استخدم هذا البريد وكلمة المرور لتسجيل الدخول في أي وقت.")}</p>
        <p class="emp-note">${L("Already have an account?", "عندك حساب من قبل؟")} <a href="${u("/employer-login")}">${L("Log in", "سجّل الدخول")}</a></p>
      </div>
      <div class="form-success" hidden id="ej-result"></div>
    </form>
  </div></section>
  <script>window.BP_EMP_PLANS=${JSON.stringify((site.employerPlans && site.employerPlans.tiers || []).map((t) => ({ key: t.key, name: L(t.nameEn || t.name, t.name), price: t.price, yearlyPrice: t.price != null ? employerYearly(t.price, (site.employerPlans && site.employerPlans.yearlyDiscount) || 0) : null })))};window.BP_BANK=${JSON.stringify({ bank: L(site.bank.bankNameEn, site.bank.bankName), iban: site.bank.iban, beneficiary: L(site.bank.beneficiaryEn, site.bank.beneficiary) })};</script>`;
  return portalPage({ title: Lraw("Subscribe — HR portal", "اشترك — بوابة التوظيف"), desc: Lraw("Subscribe to the Business Partner HR portal and access the candidate pool.", "اشترك في بوابة التوظيف من بزنس بارتنر واحصل على الوصول لقاعدة المرشّحين."), path: "/portal/join", active: "/join", body });
}

function buildPortalDashboard() {
  const nats = `<option value="">${L("Any nationality", "أي جنسية")}</option><option value="سعودي">${L("Saudi", "سعودي")}</option><option value="غير سعودي">${L("Non-Saudi", "غير سعودي")}</option>`;
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:1080px">
    <span class="eyebrow">${L("AI Hiring OS", "نظام التوظيف الذكي")}</span>
    <h1>${L("Your AI Hiring Operating System", "نظام التوظيف الذكي")}</h1>
    <p class="lead">${L("Browse our pre-screened candidate pool, match candidates to any role with AI, and run your whole hiring pipeline. Subscribe to unlock contact details and AI tools.", "تصفّح قاعدة مرشّحينا المُصنّفين، طابِق المرشّحين مع أي وظيفة بالذكاء، وأدر مسار التوظيف كامل. اشترك لفتح بيانات التواصل وأدوات الذكاء.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div id="empd-app">
      <div class="empd-flow" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin:0 0 18px;font-size:.82rem;color:var(--text-soft)">
        <span>1️⃣ ${L("Describe the role → AI Match", "اكتب الوظيفة ← مطابقة")}</span><span>›</span>
        <span>2️⃣ ${L("Browse & filter", "تصفّح وفلترة")}</span><span>›</span>
        <span>3️⃣ ${L("Shortlist", "أضف للمفضّلة")}</span><span>›</span>
        <span>4️⃣ ${L("Assess / Interview", "تقييم / مقابلة")}</span><span>›</span>
        <span>5️⃣ ${L("Pipeline → Hire", "المسار ← توظيف")}</span>
      </div>
      <div id="empd-unlock" class="empd-unlock-bar" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:12px;padding:12px 16px;margin-bottom:14px">
        <span style="font-weight:600">🔒 ${L("Free browsing. Subscribe to unlock contacts + AI tools.", "تصفّح مجاني. اشترك لفتح بيانات التواصل وأدوات الذكاء.")}</span>
        <input type="text" id="empd-code" placeholder="${Lraw("BP-EMP-XXXX", "BP-EMP-XXXX")}" style="padding:8px 12px;border:1px solid #CBD5E1;border-radius:8px;text-align:center;letter-spacing:1px">
        <button class="btn btn-primary btn-sm" id="empd-enter">${L("Unlock", "فتح")}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="empd-demo">${L("Demo", "تجربة")}</button>
        <a href="${pu("/join")}" style="font-weight:700;color:var(--brand)">${L("Subscribe", "اشترك")}</a>
      </div>
      <p id="empd-gate-msg" class="emp-note" style="min-height:18px;text-align:center"></p>
      <div class="empd-bar">
        <div class="empd-tabs">
          <button class="empd-tab" data-tab="match">✨ ${L("AI Match", "مطابقة ذكية")}</button>
          <button class="empd-tab" data-tab="postings">📋 ${L("Job Postings", "الوظائف المنشورة")}</button>
          <button class="empd-tab active" data-tab="browse">${L("Browse", "تصفّح")}</button>
          <button class="empd-tab" data-tab="shortlist">${L("Shortlist", "المفضّلة")} <span class="empd-count" id="empd-short-count">0</span></button>
          <button class="empd-tab" data-tab="pipeline">${L("Pipeline", "مسار التوظيف")}</button>
        </div>
        <button class="btn btn-ghost btn-sm" id="empd-logout">${L("Sign out", "خروج")}</button>
      </div>

      <div class="empd-panel" data-panel="match" hidden>
        <div class="empd-match-box">
          <h3>✨ ${L("Match candidates to a role with AI", "طابق المرشّحين مع وظيفة بالذكاء")}</h3>
          <p class="emp-note">${L("Describe the role, requirements or paste a job description — AI ranks your best-fit candidates and explains why.", "اكتب الوظيفة أو المتطلبات أو الصق وصفاً وظيفياً — الذكاء يرتّب أنسب المرشّحين ويشرح السبب.")}</p>
          <textarea id="empd-jd" rows="4" placeholder="${Lraw("e.g. Senior accountant, 5+ years, SOCPA, Riyadh, Saudi national preferred…", "مثال: محاسب أول، خبرة +5 سنوات، عضوية SOCPA، الرياض، يفضّل سعودي…")}"></textarea>
          <button class="btn btn-primary" id="empd-match-run">✨ ${L("Match with AI", "طابق بالذكاء")}</button>
        </div>
        <p class="emp-note" id="empd-match-status"></p>
        <div class="emp-grid" id="empd-match-grid"></div>
      </div>

      <div class="empd-panel" data-panel="postings" hidden>
        <div class="empd-match-box">
          <h3>📋 ${L("Post a job", "انشر وظيفة")}</h3>
          <p class="emp-note">${L("Open as many job postings as you need. AI screens and shortlists candidates for each one automatically.", "افتح عدد الوظائف اللي تحتاجه. الذكاء يفلتر ويرشّح المرشّحين المناسبين لكل وظيفة تلقائياً.")}</p>
          <div class="grid grid-2" style="gap:0 14px">
            <div class="field"><label for="empjob-title">${L("Job title", "المسمى الوظيفي")}</label><input id="empjob-title" type="text" placeholder="${Lraw("Type or pick, e.g. Accountant", "اكتب أو اختر، مثال: محاسب")}"></div>
            <div class="field"><label for="empjob-city">${L("City", "المدينة")}</label><input id="empjob-city" type="text" placeholder="${Lraw("Type or pick, e.g. Saudi Arabia — Riyadh", "اكتب أو اختر، مثال: السعودية — الرياض")}"></div>
          </div>
          <div class="field"><label for="empjob-field">${L("Field", "المجال")}</label><select id="empjob-field"><option value="">${L("Auto-detect from title", "يُحدَّد تلقائياً من المسمى")}</option>${fieldOptionsHtml()}</select></div>
          <div class="field"><label for="empjob-desc" style="display:flex;justify-content:space-between;align-items:center;gap:8px">${L("Description & requirements", "الوصف والمتطلبات")}<button type="button" class="linkbtn" id="empjob-ai-write" style="font-size:.85rem;padding:0">✨ ${L("Write with AI", "اكتبها بالذكاء")}</button></label><textarea id="empjob-desc" rows="4" placeholder="${Lraw("Responsibilities, required experience, certifications, nationality preference…", "المهام، الخبرة المطلوبة، الشهادات، تفضيل الجنسية…")}"></textarea></div>
          <button class="btn btn-primary" id="empjob-publish">📋 ${L("Publish job posting", "انشر الوظيفة")}</button>
          <p class="emp-note" id="empjob-status"></p>
        </div>
        <div id="empjob-list"></div>
      </div>

      <div class="empd-panel" data-panel="browse">
        <div class="emp-access"><div class="emp-filters">
          <input type="text" id="empd-q" placeholder="${Lraw("Search job title, skill…", "ابحث بالمسمى الوظيفي أو المهارة…")}">
          <input type="text" id="empd-field" placeholder="${Lraw("All fields", "كل المجالات")}">
          <input type="text" id="empd-country" placeholder="${Lraw("All countries", "كل الدول")}">
          <input type="text" id="empd-city" placeholder="${Lraw("All cities", "كل المدن")}">
          <select id="empd-nat">${nats}</select>
          <button type="button" class="btn btn-primary" id="empd-load">${L("Refresh", "تحديث")}</button>
        </div></div>
        <p class="emp-note" id="empd-status"></p>
        <div class="emp-grid" id="empd-grid"></div>
      </div>

      <div class="empd-panel" data-panel="shortlist" hidden>
        <p class="emp-note">${L("Candidates you saved. They stay on this device.", "المرشّحون اللي حفظتهم. محفوظون على هذا الجهاز.")}</p>
        <div class="emp-grid" id="empd-short-grid"></div>
      </div>

      <div class="empd-panel" data-panel="pipeline" hidden>
        <p class="emp-note">${L("Move candidates through your hiring stages using the buttons on each card.", "انقل المرشّحين عبر مراحل التوظيف من الأزرار على كل بطاقة.")}</p>
        <div class="empd-pipe" id="empd-pipe"></div>
      </div>
    </div>
  </div></section>

  <div class="empd-modal" id="empd-modal" hidden><div class="empd-modal-in">
    <button class="empd-modal-x" id="empd-modal-x">✕</button>
    <h3 id="empd-modal-title"></h3>
    <div class="empd-modal-body" id="empd-modal-body"></div>
  </div></div>
  <script>window.BP_EMPD_LANG=${JSON.stringify(LANG)};</script>`;
  return portalPage({ title: Lraw("AI Hiring OS — HR portal", "نظام التوظيف الذكي — بوابة التوظيف"), desc: Lraw("AI Hiring Operating System: match candidates with AI, assessments, interview questions, shortlist and pipeline.", "نظام التوظيف الذكي: مطابقة بالذكاء الاصطناعي، تقييمات، أسئلة مقابلة، قائمة مختصرة ومسار توظيف."), path: "/portal/dashboard", active: "/dashboard", body });
}

// ---- Careers / ATS: job board cards, single job pages, application form extras ----
function jobCardsHtml() {
  const cards = JOBS.map((j) => `<article class="card ats-job-card">
        <span class="emp-tag">${L(j.tag.en, j.tag.ar)}</span>
        <h3>${L(j.title.en, j.title.ar)}</h3>
        <p>${L(j.summary.en, j.summary.ar)}</p>
        <div class="emp-meta">${L(j.meta.en, j.meta.ar)}</div>
        <div class="talent-actions"><a class="btn btn-primary btn-sm" href="${u("/jobs/" + j.slug)}">${L("View job", "عرض الوظيفة")}</a><a class="btn btn-ghost btn-sm" href="${u("/jobs/" + j.slug)}#apply-form">${L("Apply", "تقديم")}</a></div>
      </article>`).join("");
  const poolCard = `<article class="card ats-job-card">
        <span class="emp-tag">${L("Candidate pool", "قاعدة المرشحين")}</span>
        <h3>${L("General candidate pool", "قاعدة المرشحين العامة")}</h3>
        <p>${L("Not seeing the right role? Join the pool once and we'll match you with suitable employer requests.", "إذا لم تجد وظيفة مناسبة الآن، انضم للقاعدة ونطابقك مع طلبات أصحاب العمل.")}</p>
        <div class="emp-meta">${L("All fields · Saudi Arabia · Consent-based sharing", "كل المجالات · السعودية · مشاركة بموافقتك")}</div>
        <div class="talent-actions"><a class="btn btn-primary btn-sm ats-apply-link" href="#seeker-form" data-job-id="candidate-pool" data-job-title="${esc(L("General candidate pool", "قاعدة المرشحين العامة"))}">${L("Join pool", "انضم للقاعدة")}</a></div>
      </article>`;
  const wc = WORKSHOP_CAMPAIGN;
  const campaignBand = `<section class="section" id="workshop-campaign"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Client hiring campaign", "حملة توظيف لعميلنا")}</span><h2>${L(wc.title.en, wc.title.ar)}</h2><p>${L(wc.intro.en, wc.intro.ar)}</p></div>
    <div class="stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:28px">${wc.stats.map((s) => `<div class="stat"><div class="num">${esc(s.value)}</div><div class="lbl">${L(s.label.en, s.label.ar)}</div></div>`).join("")}</div>
    <div class="center"><a class="btn btn-primary btn-lg" href="${u("/jobs/" + wc.slug)}">${L("Browse all workshop roles", "تصفّح كل وظائف الورشة")}</a></div>
  </div></section>`;
  return `<section class="section section--gray" id="open-jobs"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Careers / Jobs", "الوظائف")}</span><h2>${L("Open roles at Business Partner", "الوظائف المفتوحة عبر بيزنس بارتنر")}</h2><p>${L("Every application is logged in the Business Partner ATS, screened, and routed to the right hiring stage.", "كل تقديم يُسجَّل في ATS بيزنس بارتنر، يُفرز، ويُوجَّه إلى مرحلة التوظيف المناسبة.")}</p></div>
    <div class="grid grid-3 ats-jobs">${cards}${poolCard}</div>
  </div></section>
  ${campaignBand}
  <section class="section section--gray" id="client-jobs"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Employer clients", "عملاء بيزنس بارتنر")}</span><h2>${L("Jobs from our employer clients", "وظائف من عملائنا أصحاب العمل")}</h2><p>${L("Companies hiring through the Business Partner platform. Apply directly — your application goes straight to their pipeline.", "شركات توظّف عبر منصة بيزنس بارتنر. قدّم مباشرة — طلبك يذهب مباشرة إلى مسار توظيفهم.")}</p></div>
    <p class="emp-note" id="client-jobs-status">${L("Loading…", "جارٍ التحميل…")}</p>
    <div class="grid grid-3 ats-jobs" id="client-jobs-grid"></div>
  </div></section>`;
}
function applicationExtraFieldsHtml() {
  return `
        <input id="c-job-id" name="jobId" type="hidden" value="candidate-pool">
        <input id="c-job-title" name="jobTitle" type="hidden" value="${esc(L("General candidate pool", "قاعدة المرشحين العامة"))}">
        <div class="ats-selected-job" id="ats-selected-job">${L("Applying for", "التقديم على")}: <strong>${L("General candidate pool", "قاعدة المرشحين العامة")}</strong></div>`;
}
function applicationQuestionsHtml() {
  return `
        <div class="field"><label for="c-q1">${L("Why are you interested in this role?", "لماذا ترغب بهذه الوظيفة؟")}</label><textarea id="c-q1" name="question1" rows="3" placeholder="${Lraw("Briefly explain your interest and fit.", "اكتب باختصار سبب اهتمامك ومدى ملاءمتك.")}"></textarea></div>
        <div class="field"><label for="c-q2">${L("What are your strongest relevant skills?", "ما أقوى مهاراتك المرتبطة بالوظيفة؟")}</label><textarea id="c-q2" name="question2" rows="3" placeholder="${Lraw("Systems, tools, sectors, or achievements.", "اذكر الأنظمة، الأدوات، القطاعات، أو الإنجازات.")}"></textarea></div>`;
}
// Shared application form — used standalone per job page (fixedJob set, so
// the application is scoped to that one posting) and on /careers + the
// candidate-pool portal page (fixedJob null, so the job stays whatever the
// visitor picked via an Apply link, defaulting to the general pool).
function seekerFormHtml(f, fixedJob) {
  const jobFieldsHtml = fixedJob
    ? `<input id="c-job-id" name="jobId" type="hidden" value="${esc(fixedJob.id)}"><input id="c-job-title" name="jobTitle" type="hidden" value="${esc(fixedJob.title)}">`
    : applicationExtraFieldsHtml();
  return `
      <form class="calc-form cv-form" id="cv-form" novalidate>
        ${jobFieldsHtml}
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-name">${L("Full name", f.name)}</label><input id="c-name" name="name" type="text" required></div>
          <div class="field"><label for="c-phone">${L("Mobile (with country code)", "الجوال (مع رمز الدولة)")}</label><input id="c-phone" name="phone" type="tel" required placeholder="+9665XXXXXXXX"></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-email">${L("Email", f.email)} *</label><input id="c-email" name="email" type="email" required></div>
          <div class="field"><label for="c-exp">${L("Years of experience", f.experience)} *</label><input id="c-exp" name="experience" type="text" required placeholder="${Lraw("Type or pick, e.g. 5+ years", "اكتب أو اختر، مثال: 5+ سنوات")}"></div>
        </div>
        <div class="field"><label for="c-field">${L("Field / target roles", "المجال / المسميات المستهدفة")} *</label><input id="c-field" name="field" type="text" required placeholder="${Lraw("Type or pick, e.g. Accountant", "اكتب أو اختر، مثال: محاسب")}"></div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-nationality">${L("Nationality", "الجنسية")} *</label><input id="c-nationality" name="nationality" type="text" required placeholder="${Lraw("Type or pick a country", "اكتب أو اختر دولة")}"></div>
          <div class="field"><label for="c-residence">${L("Residence status", "حالة الإقامة")} *</label>
            <select id="c-residence" name="residenceStatus" required>
              <option value="">${L("Choose…", "اختر…")}</option>
              <option value="مواطن سعودي">${L("Saudi national", "مواطن سعودي")}</option>
              <option value="مقيم بإقامة نظامية قابلة للنقل">${L("Resident in KSA — transferable iqama", "مقيم في السعودية — إقامة قابلة للنقل")}</option>
              <option value="مقيم بإقامة غير قابلة للنقل">${L("Resident in KSA — non-transferable iqama", "مقيم في السعودية — إقامة غير قابلة للنقل")}</option>
              <option value="خارج السعودية">${L("Outside Saudi Arabia", "خارج السعودية")}</option>
              <option value="أخرى">${L("Other", "أخرى")}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-country">${L("Country (current location)", "الدولة (موقعك الحالي)")} *</label><input id="c-country" name="country" type="text" required placeholder="${Lraw("Type or pick a country", "اكتب أو اختر دولة")}"></div>
          <div class="field"><label for="c-city">${L("City", "المدينة")} *</label><input id="c-city" name="city" type="text" required placeholder="${Lraw("Type or pick a city", "اكتب أو اختر مدينة")}"></div>
        </div>
        <div class="grid grid-2" style="gap:0 20px">
          <div class="field"><label for="c-salary">${L("Expected salary range", "نطاق الراتب المتوقع")} *</label><input id="c-salary" name="salary" type="text" required placeholder="${Lraw("e.g. 8,000–12,000", "مثال: 8,000–12,000")}"></div>
          <div class="field"><label for="c-notice">${L("Notice period", "فترة الإشعار")}</label>
            <select id="c-notice" name="notice">
              <option value="">${L("Choose…", "اختر…")}</option>
              <option value="فوري">${L("Immediate", "فوري")}</option>
              <option value="أسبوعين">${L("2 weeks", "أسبوعين")}</option>
              <option value="شهر">${L("1 month", "شهر")}</option>
              <option value="شهرين">${L("2 months", "شهرين")}</option>
              <option value="3 أشهر فأكثر">${L("3+ months", "3 أشهر فأكثر")}</option>
            </select>
          </div>
        </div>
        <div class="field"><label for="c-linkedin">${L("LinkedIn profile (optional)", "رابط لينكدإن (اختياري)")}</label><input id="c-linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/…"></div>
        ${applicationQuestionsHtml()}
        <div class="field">
          <label>${L("CV — PDF or Word", "السيرة الذاتية — PDF أو Word")}</label>
          <label class="file-drop" for="c-cv" id="cv-drop">
            <span class="file-ico">${I.upload}</span>
            <span class="file-text" id="cv-filename">${L("Drag your CV here or click to choose — PDF or Word", "اسحب سيرتك هنا أو اضغط للاختيار — PDF أو Word")}</span>
          </label>
          <input id="c-cv" name="cv" type="file" accept=".pdf,.doc,.docx" hidden>
        </div>
        <label class="consent-row"><input type="checkbox" id="c-consent"><span>${L("I agree that Business Partner may add me to its candidate pool and contact me about suitable roles.", "أوافق على إضافتي إلى قاعدة مرشّحي بيزنس بارتنر والتواصل معي بشأن الفرص المناسبة.")}</span></label>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${I.upload}<span>${L("Submit application", "أرسل الطلب")}</span></button>
        <p class="form-note" id="cv-note">${L("Upload your CV (PDF or Word) to reach our team securely.", "ارفع سيرتك (PDF أو Word) لتصل لفريقنا بأمان.")}</p>
        <div class="form-success" id="cv-success" hidden>${L("✅ Your application has been received. We'll review it and reach out when there's a suitable opportunity.", "✅ تم استلام طلبك. سنراجعه ونتواصل معك عند توفّر فرصة مناسبة.")}</div>
      </form>
      <div class="center mt-16">${waBtn2("Book a consultation", "احجز استشارة", "btn-ghost")}</div>`;
}
function buildJobPage(job) {
  const f = site.careers.seeker.fields;
  const title = L(job.title.en, job.title.ar);
  const resp = job.responsibilities[LANG === "ar" ? "ar" : "en"].map((r) => `<li>${esc(r)}</li>`).join("");
  const reqs = job.requirements[LANG === "ar" ? "ar" : "en"].map((r) => `<li>${esc(r)}</li>`).join("");
  // Workshop-campaign roles (job.group set) navigate back to the campaign hub
  // and show the openings count; Business Partner's own roles keep /careers.
  const backHref = job.group ? u("/jobs/" + WORKSHOP_CAMPAIGN.slug) : `${u("/careers")}#open-jobs`;
  const thirdCard = job.openings
    ? `<div class="card"><h3>${L("Openings", "عدد الشواغر")}</h3><p>${esc(String(job.openings))}</p></div>`
    : `<div class="card"><h3>${L("Pipeline", "المسار")}</h3><p>${L("New → Screening → Interview → Offer", "جديد ← فرز ← مقابلة ← عرض")}</p></div>`;
  // schema.org JobPosting structured data → Google for Jobs indexes the page
  // automatically (free syndication). Built per-language from the same content.
  const ldDesc =
    `<p>${esc(L(job.summary.en, job.summary.ar))}</p>` +
    `<p><b>${L("Responsibilities", "المهام")}:</b></p><ul>${resp}</ul>` +
    `<p><b>${L("Requirements", "المتطلبات")}:</b></p><ul>${reqs}</ul>`;
  const jobTypeLower = String(job.type.en || "").toLowerCase();
  const employmentType = jobTypeLower.includes("part") ? "PART_TIME" : jobTypeLower.includes("contract") ? "CONTRACTOR" : "FULL_TIME";
  const postedAt = new Date();
  const validThrough = new Date(postedAt.getTime() + 60 * 864e5);
  const jobLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: L(job.title.en, job.title.ar),
    description: ldDesc,
    identifier: { "@type": "PropertyValue", name: "Business Partner", value: job.slug },
    datePosted: postedAt.toISOString().slice(0, 10),
    validThrough: validThrough.toISOString().slice(0, 10),
    employmentType,
    hiringOrganization: { "@type": "Organization", name: "Business Partner", sameAs: "https://businesspartner.sa" },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "SA", addressLocality: L(job.location.en, job.location.ar) } },
    directApply: true,
  };
  const jobLdScript = `<script type="application/ld+json">${JSON.stringify(jobLd).replace(/</g, "\\u003c")}</script>`;
  // Each posted job carries its own embedded application form (not a shared
  // one across every job) — applying here is scoped to this posting only.
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:960px">
    <span class="eyebrow">${L("Open job", "وظيفة مفتوحة")}</span>
    <h1>${esc(title)}</h1>
    <p class="lead">${esc(L(job.summary.en, job.summary.ar))}</p>
    <div class="talent-actions"><a class="btn btn-primary" href="#apply-form">${L("Apply now", "قدّم الآن")}</a><a class="btn btn-ghost" href="${backHref}">${L("Back to jobs", "العودة للوظائف")}</a></div>
  </div></section>
  <section class="section"><div class="container" style="max-width:900px">
    <div class="grid grid-3" style="margin-bottom:28px">
      <div class="card"><h3>${L("Location", "الموقع")}</h3><p>${esc(L(job.location.en, job.location.ar))}</p></div>
      <div class="card"><h3>${L("Type", "النوع")}</h3><p>${esc(L(job.type.en, job.type.ar))}</p></div>
      ${thirdCard}
    </div>
    <h2>${L("What you will do", "المهام")}</h2>
    <ul class="check-list">${resp}</ul>
    <h2>${L("What we are looking for", "المتطلبات")}</h2>
    <ul class="check-list">${reqs}</ul>
    <div class="cta-band" style="margin-top:34px"><h2>${L("Ready to apply?", "جاهز للتقديم؟")}</h2><p>${L("Your application will be logged in the Business Partner ATS and routed for screening.", "سيتم تسجيل طلبك في ATS بيزنس بارتنر وتحويله للفرز.")}</p><a class="btn btn-white btn-lg" href="#apply-form">${L("Apply for this job", "قدّم على الوظيفة")}</a></div>
  </div></section>
  <section class="section" style="padding-top:0"><div class="container">
    <div style="max-width:640px;margin:0 auto" id="apply-form">
      <h2 class="center">${L("Apply for this role", "قدّم على هذه الوظيفة")}</h2>
      ${seekerFormHtml(f, { id: job.slug, title })}
    </div>
  </div></section>`;
  return page({ title: Lraw(`${title} — Business Partner`, `${title} — بيزنس بارتنر`), desc: Lraw(`Apply for ${title} through the Business Partner ATS.`, `قدّم على وظيفة ${title} عبر ATS بيزنس بارتنر.`), active: "/careers", path: "/jobs/" + job.slug, body: body + jobLdScript });
}

// Campaign hub: all events-workshop roles grouped by department. Lives under
// /jobs/ beside the single job pages; each card links to that role's own page
// where the embedded application is scoped to the posting.
function buildWorkshopCampaign() {
  const wc = WORKSHOP_CAMPAIGN;
  const statsHtml = wc.stats.map((s) => `<div class="stat"><div class="num">${esc(s.value)}</div><div class="lbl">${L(s.label.en, s.label.ar)}</div></div>`).join("");
  const groupsHtml = wc.groups.map((g) => {
    const jobs = WORKSHOP_JOBS.filter((j) => j.group === g.key);
    if (!jobs.length) return "";
    const cards = jobs.map((j) => `<article class="card ats-job-card">
        <span class="emp-tag">${L(j.tag.en, j.tag.ar)}</span>
        <h3>${L(j.title.en, j.title.ar)}</h3>
        <p>${L(j.summary.en, j.summary.ar)}</p>
        <div class="emp-meta">${L(j.meta.en, j.meta.ar)}</div>
        <div class="talent-actions"><a class="btn btn-primary btn-sm" href="${u("/jobs/" + j.slug)}">${L("View job", "عرض الوظيفة")}</a><a class="btn btn-ghost btn-sm" href="${u("/jobs/" + j.slug)}#apply-form">${L("Apply", "تقديم")}</a></div>
      </article>`).join("");
    return `<div class="section-head" style="margin-top:30px"><h2>${L(g.title.en, g.title.ar)}</h2></div>
    <div class="grid grid-3 ats-jobs">${cards}</div>`;
  }).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:960px">
    <span class="eyebrow">${L("Client hiring campaign", "حملة توظيف لعميلنا")}</span>
    <h1>${L(wc.title.en, wc.title.ar)}</h1>
    <p class="lead">${L(wc.intro.en, wc.intro.ar)}</p>
    <div class="talent-actions" style="margin-top:22px"><a class="btn btn-primary" href="#workshop-roles">${L("Browse roles", "تصفّح الوظائف")}</a><a class="btn btn-ghost" href="${u("/careers")}#open-jobs">${L("All open jobs", "كل الوظائف المفتوحة")}</a></div>
  </div></section>
  <section class="section section--navy trust-band"><div class="container">
    <div class="stats" style="grid-template-columns:repeat(3,1fr)">${statsHtml}</div>
  </div></section>
  <section class="section section--gray" id="workshop-roles"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Open roles", "الوظائف المفتوحة")}</span><h2>${L("Pick your department and apply", "اختر قسمك وقدّم الآن")}</h2><p>${L("Every application is logged in the Business Partner ATS, screened, and routed straight to the client's hiring pipeline.", "كل تقديم يُسجَّل في ATS بيزنس بارتنر، يُفرز، ويُوجَّه مباشرة إلى مسار توظيف العميل.")}</p></div>
    ${groupsHtml}
  </div></section>
  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Don't see your exact trade?", "لم تجد تخصصك؟")}</h2><p>${L("Hiring runs in waves through December 2026 and more roles open with each wave — join the general candidate pool and we'll match you.", "التوظيف يجري على دفعات حتى ديسمبر 2026 وتُفتح وظائف جديدة مع كل دفعة — انضم لقاعدة المرشحين العامة وسنطابقك مع المناسب.")}</p><a class="btn btn-white btn-lg" href="${u("/careers")}#seeker-form">${L("Join the candidate pool", "انضم لقاعدة المرشحين")}</a></div>
  </div></section>`;
  return page({ title: Lraw("Events Fabrication Workshop Hiring — Business Partner", "توظيف ورشة تصنيع الفعاليات — بيزنس بارتنر"), desc: Lraw("150+ openings at an events fabrication workshop in Saudi Arabia — managers, engineers, team leaders, technicians, and skilled trades. Apply through Business Partner.", "أكثر من 150 فرصة عمل في ورشة تصنيع فعاليات بالسعودية — مدراء ومهندسون وقادة فرق وفنيون وعمالة ماهرة. قدّم عبر بيزنس بارتنر."), active: "/careers", path: "/jobs/" + wc.slug, body });
}

function buildPortalCandidates() {
  const c = site.careers;
  const f = c.seeker.fields;
  const seekerValue = [
    ["📄", L("One CV, many opportunities", "سيرة واحدة، فرص كثيرة"), L("Join the pool once; we match you whenever a fitting role opens.", "سجّل مرة واحدة، ونطابقك مع الفرص المناسبة فور توفّرها.")],
    ["🤝", L("Employers reach you", "أصحاب العمل يوصلونك"), L("Companies hiring through us see your profile for suitable roles.", "الشركات التي توظّف عبرنا تشاهد ملفك للفرص المناسبة.")],
    ["🔒", L("Your data is protected", "بياناتك محمية"), L("We never share your CV without your consent (PDPL).", "لا نشارك سيرتك دون موافقتك (حماية البيانات).")],
  ].map((x) => `<div class="card"><div class="card-icon" style="font-size:1.5rem">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:960px">
    <span class="eyebrow">${L("For job seekers", "للباحثين عن عمل")}</span>
    <h1>${L("Find your next opportunity", "فرصتك القادمة تبدأ هنا")}</h1>
    <p class="lead">${L("Join our candidate pool once — employers hiring through Business Partner reach you when a suitable role opens.", "انضم لقاعدة مرشّحينا مرة واحدة — وأصحاب العمل الذين يوظّفون عبر بيزنس بارتنر يصلونك عند توفّر فرصة مناسبة.")}</p>
    <div class="talent-actions" style="margin-top:22px">
      <a class="btn btn-primary" href="#seeker-form">${I.upload}<span>${L("Submit your CV", "أرسل سيرتك الذاتية")}</span></a>
      <a class="btn btn-ghost" href="${pu("/join")}">${L("I'm an employer →", "أنا صاحب عمل ←")}</a>
    </div>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3" style="margin-bottom:36px">${seekerValue}</div>
    <div style="max-width:640px;margin:0 auto" id="seeker-form">
      ${seekerFormHtml(f, null)}
    </div>
  </div></section>

  ${trackApplicationHtml()}`;
  return portalPage({ title: Lraw("Jobs for job seekers — HR portal", "التوظيف للباحثين عن عمل — بوابة التوظيف"), desc: Lraw("Join Business Partner's candidate pool and get matched to suitable roles.", "انضم لقاعدة مرشّحي بيزنس بارتنر وتطابق مع الفرص المناسبة."), path: "/portal/candidates", active: "/candidates", body });
}

// Farina — corporate catering & hospitality (coffee breaks, executive lunch,
// VIP hospitality, workforce catering) offered by Business Partner under the
// Farina brand. A bespoke vertical landing page (like /workspaces or
// /mahfol-makfol), not part of the 92-item government-services catalog —
// pricing here is quote-based per headcount/frequency, not a fixed SKU.
function buildFarina() {
  const sectors = [
    ["🏥", L("Hospitals", "المستشفيات"), L("Daily meals for medical staff and coffee breaks for management, built around shift schedules.", "وجبات يومية للطواقم الطبية، وكوفي بريك للإدارات حسب مواعيد الورديات.")],
    ["🏨", L("Hotels", "الفنادق"), L("Overflow catering that supports your kitchen at peak times, plus full coverage for events.", "توريد يدعم مطبخكم الداخلي وقت الذروة، وتغطية كاملة للفعاليات.")],
    ["🏢", L("Companies", "الشركات"), L("Daily or weekly coffee breaks and executive lunch, on a flexible monthly contract.", "كوفي بريك يومي أو أسبوعي، وغداء تنفيذي، بعقد شهري مرن.")],
    ["🏛️", L("Government entities", "الجهات الحكومية"), L("Formal hospitality with traditional Saudi coffee service, and coffee breaks for meetings.", "ضيافة رسمية بمراسم القهوة السعودية التقليدية، وكوفي بريك للاجتماعات.")],
    ["🧳", L("Recruitment companies", "شركات الاستقدام"), L("Full board — breakfast, lunch and dinner — for workforce housing, on a rotating monthly menu.", "فطور وغداء وعشاء للعمالة في السكن الجماعي، بقائمة شهرية متجددة.")],
    ["🏗️", L("Contracting companies", "شركات المقاولات"), L("Site workforce catering with direct delivery, and coffee breaks for project offices.", "إعاشة عمالة المواقع مع توصيل مباشر، وكوفي بريك لمكاتب المشروع.")],
  ].map(([icon, title, desc]) => `<div class="card feature"><div class="card-icon" style="font-size:1.6rem">${icon}</div><h3>${title}</h3><p>${desc}</p></div>`).join("");

  const menuTier = (id, nameEn, nameAr, priceEn, priceAr, itemsEn, itemsAr) => {
    const items = itemsEn.map((e, i) => `<li>${I.check}<span>${L(e, itemsAr[i])}</span></li>`).join("");
    return `<div class="pkg" id="${id}" style="scroll-margin-top:calc(var(--header-h) + 20px)">
      <div class="pk-name">${L(nameEn, nameAr)}</div>
      <div class="pk-price">${L(priceEn, priceAr)}</div>
      <ul>${items}</ul>
      ${waBtn2("Request a quote", "اطلب عرض سعر", "btn-primary")}
    </div>`;
  };
  const menus = [
    menuTier("coffee-break", "Regular Coffee Break", "كوفي بريك عادي", "Custom quote", "حسب عدد الأفراد",
      ["Mini croissants & sandwiches", "Savory & sweet danish", "Dry cakes & sweets", "For daily team meetings"],
      ["ميني كرواسان وساندويتشات", "دانيش مالح وحلو", "كيك جاف وحلويات", "لاجتماعات الفريق اليومية"]),
    menuTier("vip-coffee", "VIP Coffee Break", "كوفي بريك VIP", "Custom quote", "حسب عدد الأفراد",
      ["Cheese platter & 4 croissant varieties", "Smoked salmon bruschetta", "Arabic coffee, served traditionally", "Premium chocolate selection"],
      ["تشيز بلاتر وكرواسان بأربعة أنواع", "بروشيتا سلمون مدخن", "قهوة عربية تُقدَّم بمراسم تقليدية", "تشكيلة شوكولاتة فاخرة"]),
    menuTier("executive-lunch", "Executive Lunch", "غداء تنفيذي", "Custom quote", "يوميًا لعدد أيام العمل المتفق عليها",
      ["4 rotating menus", "Beef tenderloin, grilled salmon, seasonal dishes", "Personally supervised by our head of kitchen", "Daily during working days"],
      ["4 قوائم متناوبة", "تندرلوين لحم، سلمون مشوي، وأطباق موسمية", "إشراف شخصي من مدير قسم الطهي", "يوميًا خلال أيام العمل"]),
    menuTier("sharing", "Cheese Platter & Finger Food", "تشيز بلاتر وفينجر فوود", "Custom quote", "حسب عدد الأفراد",
      ["Imported cheese & cold cuts", "Seasonal fruit", "Served with sparkling juices", "For private events and gatherings"],
      ["أجبان مستوردة ولحوم باردة", "فواكه موسمية", "تُقدَّم مع عصائر فوارة", "للفعاليات والتجمعات الخاصة"]),
    menuTier("vip-hospitality", "VIP Hospitality", "ضيافة كبار الشخصيات", "Custom quote", "حسب عدد الأفراد",
      ["Traditional Gahwaji coffee service", "Premium dates", "Crystal cups, white linen", "For up to 50 guests"],
      ["مراسم القهوجي التقليدية", "تمور فاخرة", "كؤوس كريستالية ومفارش بيضاء", "لما يصل إلى 50 ضيفًا"]),
    menuTier("workforce", "Monthly Workforce Catering", "إعاشة عمالة شهرية", "Custom quote", "حسب عدد الأفراد وأيام العمل",
      ["Breakfast, lunch and dinner", "Rotating 4-week menu, nationality-aware", "Organized daily delivery", "Licensed kitchen, SFDA-compliant"],
      ["فطور وغداء وعشاء", "منيو متجدد بدورة 4 أسابيع يراعي الجاليات", "توصيل يومي منظّم", "مطبخ مرخّص ومطابق لاشتراطات SFDA"]),
  ].join("");

  const clientChips = ["Ministry of Finance", "General Authority for Statistics", "Qiddiya Investment Company", "Capital Market Authority", "PIF", "GACA", "MODON", "Riyad Bank", "SAB", "Environment Fund"]
    .map((n) => `<span class="chip">${esc(n)}</span>`).join("");

  const steps = [
    [L("Contact us", "تواصل معنا"), L("WhatsApp or the site form, with your sector and headcount.", "واتساب أو نموذج الموقع، بذكر القطاع وعدد المستفيدين.")],
    [L("We build the menu", "نجهّز القائمة"), L("Choose the tier (regular or VIP) and customize items.", "اختيار المستوى (عادي أو VIP) وتخصيص الأصناف.")],
    [L("Quote within 24 hours", "عرض سعر خلال 24 ساعة"), L("Clear pricing covering headcount and delivery, no commitment.", "تسعير واضح يشمل الكمية والتوصيل، بدون التزام.")],
    [L("Delivery & monthly contract", "توريد وعقد شهري"), L("Organized daily service, tracked through the client portal.", "تشغيل يومي منظّم، ومتابعة عبر لوحة تحكم العميل.")],
  ].map(([t, d], i) => `<div class="step"><div class="step-n">${i + 1}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join("");

  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">Farina × Business Partner</span>
    <h1>${L("Catering & Hospitality for Companies", "التموين والضيافة للشركات")}</h1>
    <p class="lead">${L("Coffee breaks, staff meals and VIP hospitality for companies, government entities, hospitals, hotels, recruitment companies and contractors — under Farina, delivered by Business Partner, on one monthly invoice.", "كوفي بريك، وجبات موظفين، وضيافة كبار الزوار — للشركات والجهات الحكومية والمستشفيات والفنادق وشركات الاستقدام والمقاولات، تحت علامة فارينا وبتشغيل بيزنس بارتنر، بفاتورة شهرية واحدة.")}</p>
    <div class="hero-actions">${waBtn2("Request a quote", "اطلب عرض سعر", "btn-primary", true)}<a class="btn btn-ghost" href="#menus">${L("Browse menus", "تصفّح القوائم")}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("4.7★ Google rating — 1,649 reviews", "تقييم Google 4.7 — 1,649 تقييم")}</span>
      <span class="hero-badge">${I.check}${L("+500 client establishments", "+500 منشأة عميلة")}</span>
      <span class="hero-badge">${I.check}${L("Ongoing government client contract", "عميل حكومي بعقد مستمر")}</span>
      <span class="hero-badge">${I.check}${L("Licensed kitchen, SFDA-compliant", "مطبخ مرخّص ومطابق لاشتراطات SFDA")}</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Who we serve", "القطاعات")}</span><h2>${L("Six sectors, each with its own schedule", "ست قطاعات، لكل واحد جدول مختلف")}</h2><p>${L("We build the schedule and menu around how your establishment actually runs.", "نبني الجدول والقائمة حسب طبيعة عملكم، لا العكس.")}</p></div>
    <div class="grid grid-3">${sectors}</div>
  </div></section>

  <section class="section" id="menus"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Menus", "القوائم")}</span><h2>${L("From the daily coffee break to the executive lunch", "من الكوفي بريك اليومي إلى غداء المدير التنفيذي")}</h2><p>${L("Six ready menus, each customizable by headcount and hospitality level. Pricing is quoted per request.", "ست قوائم جاهزة، وكل واحدة قابلة للتعديل حسب العدد ومستوى الضيافة. التسعير حسب الطلب.")}</p></div>
    <div class="grid grid-3">${menus}</div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="grid grid-2" style="align-items:start;gap:44px">
      <div class="quote">
        <p>${L("We designed and delivered a complete hospitality program for the Center for National Health Insurance — from daily artisan coffee for executives to minister-level hospitality with traditional Gahwaji service.", "صممنا وسلّمنا برنامج ضيافة كامل لمركز التأمين الصحي الوطني — من القهوة اليومية للمديرين التنفيذيين إلى ضيافة الوزراء بمراسم القهوجي التقليدية.")}</p>
        <div class="who">Farina × CNHI</div>
        <div class="role">${L("Premium catering proposal, February 2026", "عرض ضيافة فاخرة، فبراير 2026")}</div>
      </div>
      <div>
        <div class="section-head" style="margin-bottom:16px"><span class="eyebrow">${L("Clients we've worked with", "جهات تعاملنا معها")}</span></div>
        <div class="svc-meta">${clientChips}</div>
      </div>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "خطوات العمل")}</span><h2>${L("Four steps from first contact to first delivery", "أربع خطوات من أول تواصل إلى أول توصيل")}</h2></div>
    <div class="steps-grid">${steps}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band" style="margin-bottom:26px"><h2>${L("Feeding workers in collective housing?", "عمالتك في سكن جماعي؟")}</h2><p>${L("Pair workforce catering with our Worker Housing solution: licensed housing, Balady license, Civil Defense, transport — one contract.", "اجمع إعاشة العمالة مع حل تسكين العمالة: سكن مرخّص، رخصة بلدي، الدفاع المدني، ونقل يومي — بعقد واحد.")}</p><a class="btn btn-white btn-lg" href="${u("/worker-housing")}">🏠 ${L("Explore Worker Housing", "استعرض تسكين العمالة")}</a></div>
    <div class="cta-band"><h2>${L("Ready to start your establishment's hospitality program?", "جاهزين نبدأ برنامج الضيافة في منشأتكم؟")}</h2><p>${L("The smart agent replies instantly and sets your next step.", "الوكيل الذكي يرد فوراً ويحدد لك الخطوة التالية.")}</p>${waBtn2("Request a quote", "اطلب عرض سعر", "btn-white", true)}</div>
  </div></section>`;
  return page({
    title: Lraw("Catering & Hospitality for Companies — Farina × Business Partner", "التموين والضيافة للشركات — فارينا × بيزنس بارتنر"),
    desc: Lraw("Coffee breaks, staff meals and VIP hospitality for companies, government entities, hospitals, hotels, recruitment companies and contractors — one monthly contract.", "كوفي بريك، وجبات موظفين، وضيافة كبار الزوار للشركات والجهات الحكومية والمستشفيات والفنادق وشركات الاستقدام والمقاولات — بعقد شهري واحد."),
    active: "/farina", path: "/farina", body,
  });
}

function buildWorkerHousing() {
  const services = [
    ["🏢", L("Ready licensed housing", "سكن جاهز ومرخّص"), L("Worker housing units compliant with MoMaH requirements, close to your project sites.", "وحدات سكن عمالة مطابقة لاشتراطات وزارة البلديات والإسكان، قريبة من مواقع مشاريعك.")],
    ["📋", L("Licensing & attestation", "الترخيص والتوثيق"), L("Balady collective-housing license, Ejar contract attestation, Civil Defense certificate, and Muqeem address updates.", "رخصة السكن الجماعي من بلدي، توثيق عقد الإيجار في إيجار، شهادة الدفاع المدني، وتحديث عناوين العمالة في مقيم."), "/services/bp-housing-01", L("Service details →", "تفاصيل الخدمة ←")],
    ["🛠️", L("Operations management", "إدارة وتشغيل السكن"), L("Housing supervisor, cleaning and maintenance, resident register, signage — everything inspection committees check.", "مشرف سكن، نظافة وصيانة دورية، سجل الساكنين، لوحات إرشادية، وكل متطلبات الجولات الرقابية.")],
    ["🍽️", L("Catering & meals", "الإعاشة والتغذية"), L("Breakfast, lunch and dinner from a licensed SFDA-compliant kitchen, with a rotating 4-week menu — priced to your headcount.", "فطور وغداء وعشاء من مطبخ مرخّص ومطابق لاشتراطات SFDA، بقائمة متجددة بدورة 4 أسابيع — بسعر حسب عدد العمالة.")],
    ["🚌", L("Worker transport", "نقل العمالة"), L("Daily transport between housing and work sites: licensed drivers, shift-based scheduling, one monthly contract.", "نقل يومي منظّم من السكن إلى مواقع العمل والعكس: سائقون مرخصون، جدولة حسب الورديات، وعقد شهري واحد."), "/services/bp-housing-02", L("Service details →", "تفاصيل الخدمة ←")],
    ["🔔", L("Compliance monitoring", "مراقبة امتثال وتنبيهات"), L("Always ready for the quarterly inspection rounds, with alerts before every license, contract or certificate expires.", "جاهزية دائمة للجولات الرقابية الربع سنوية، وتنبيهات قبل انتهاء الرخص والعقود والشهادات.")],
  ].map(([icon, title, desc, href, cta]) => `<div class="card feature"><div class="card-icon" style="font-size:1.6rem">${icon}</div><h3>${title}</h3><p>${desc}</p>${href ? `<a href="${u(href)}" style="display:inline-block;margin-top:10px;font-weight:600;color:var(--navy)">${cta}</a>` : ""}</div>`).join("");

  const fines = [
    [L("Operating collective housing without an operating license", "ممارسة نشاط السكن الجماعي دون ترخيص تشغيلي"), L("up to 10,000 SAR", "حتى 10,000 ريال"), L("Major — facility may be closed", "جسيمة — وقد تُغلق المنشأة")],
    [L("No clinic/nurse for capacity above 1,000 workers", "عدم توفير عيادة/ممرض للسعة فوق 1000 فرد"), L("up to 8,000 SAR", "حتى 8,000 ريال"), L("Major", "جسيمة")],
    [L("Violating the minimum area per worker in bedrooms", "عدم الالتزام بالمساحة المحددة للفرد في غرفة النوم"), L("up to 5,000 SAR", "حتى 5,000 ريال"), L("Major", "جسيمة")],
    [L("Bathrooms below minimum (toilet + sink + shower per 8 workers)", "دورات مياه أقل من الحد الأدنى (مرحاض + مغسلة + استحمام لكل 8 أفراد)"), L("up to 5,000 SAR", "حتى 5,000 ريال"), L("Major", "جسيمة")],
    [L("Exceeding licensed capacity", "تجاوز الطاقة الاستيعابية المحددة في الرخصة"), L("up to 5,000 SAR", "حتى 5,000 ريال"), L("Major", "جسيمة")],
    [L("No air conditioning and heating in bedrooms", "عدم توفر تكييف وتدفئة في غرف النوم"), L("up to 4,000 SAR", "حتى 4,000 ريال"), L("Major", "جسيمة")],
    [L("No resident register and medical insurance per resident", "عدم توفر سجل ساكنين وتأمين طبي لكل ساكن"), L("up to 4,000 SAR", "حتى 4,000 ريال"), L("Major", "جسيمة")],
    [L("Not separating women's housing from men's", "عدم فصل سكن النساء عن سكن الرجال"), L("up to 3,000 SAR", "حتى 3,000 ريال"), L("Major", "جسيمة")],
    [L("No equipped isolation room for sick residents", "عدم توفر غرفة عزل مجهزة للحالات المرضية"), L("up to 3,000 SAR", "حتى 3,000 ريال"), L("Major", "جسيمة")],
    [L("No bed and wardrobe per worker", "عدم توفير سرير وخزانة ملابس لكل فرد"), L("up to 2,000 SAR", "حتى 2,000 ريال"), L("Major", "جسيمة")],
  ].map(([v, a, c]) => `<tr><td style="padding:10px 14px;border-bottom:1px solid var(--gray-line)">${v}</td><td style="padding:10px 14px;border-bottom:1px solid var(--gray-line);font-weight:700;color:#b3261e;white-space:nowrap">${a}</td><td style="padding:10px 14px;border-bottom:1px solid var(--gray-line)">${c}</td></tr>`).join("");

  const facts = [
    [L("20+ workers", "20+ فرد"), L("counts as collective housing and requires an operating license", "يُصنَّف سكناً جماعياً ويلزمه ترخيص تشغيلي")],
    [L("4 ministries", "4 وزارات"), L("permanent committees inspect worker housing (MoMaH, Interior, Health, HR)", "لجان رقابية دائمة تفتش على سكن العمالة")],
    [L("Every quarter", "كل ربع سنة"), L("a scheduled inspection round for every housing license", "جولة رقابية مجدولة لكل رخصة سكن")],
    [L("Ewaa platform", "منصة إيفاء"), L("violations are logged electronically; fines double on repeat", "المخالفات تُسجل إلكترونياً وتتضاعف الغرامة عند التكرار")],
  ].map(([b, s]) => `<div class="card"><h3 style="color:var(--navy)">${b}</h3><p>${s}</p></div>`).join("");

  const steps = [
    [L("Send your request", "ترسل طلبك"), L("Fill the form with your city, worker count and needs — or message us on WhatsApp.", "تعبّئ النموذج: المدينة، عدد العمالة، ومتطلباتك — أو تكلمنا واتساب مباشرة.")],
    [L("We shortlist options", "نرشّح لك الخيارات"), L("Licensed, compliant units near your project, with a clear quote.", "وحدات سكن مرخصة ومطابقة قريبة من مشروعك، مع عرض سعر واضح.")],
    [L("We handle all paperwork", "نجهّز كل الأوراق"), L("Operating license, Ejar attestation, Civil Defense, and Muqeem address updates — all on us.", "الترخيص التشغيلي، توثيق إيجار، الدفاع المدني، وتحديث عناوين العمالة في مقيم — كلها علينا.")],
    [L("Move in & ongoing follow-up", "تسكين ومتابعة مستمرة"), L("Your workers move into ready housing; we track operations, compliance and renewals all year.", "عمالتك تنتقل لسكن جاهز، واحنا نتابع التشغيل والامتثال والتجديدات طول السنة.")],
  ].map(([t, d], i) => `<div class="step"><div class="step-n">${i + 1}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join("");

  const cities = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران", "بريدة", "أبها", "تبوك", "حائل", "جازان", "نجران", "الطائف", "الهفوف", "ينبع", "الجبيل"]
    .map((c) => `<span class="chip">📍 ${c}</span>`).join("");

  const reqTypes = [["Ready housing (rent)", "سكن جاهز (إيجار)"], ["License my existing housing", "ترخيص وتوثيق سكن حالي"], ["Housing + catering + transport", "سكن + إعاشة + نقل"], ["Operate an existing housing", "إدارة وتشغيل سكن قائم"], ["Consultation / not sure", "استشارة / غير محدد"]]
    .map((t) => `<option value="${t[1]}">${L(t[0], t[1])}</option>`).join("");

  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Worker Housing", "تسكين العمالة")}</span>
    <h1>${L("House your workers in ready, licensed housing — we handle every procedure", "سكّن عمالتك في سكن جاهز ومرخّص… من غير ما تشيل هم أي إجراء")}</h1>
    <p class="lead">${L("A complete worker-housing solution: units compliant with MoMaH requirements, plus the operating license, attestation, operations and catering — every government step on us.", "حل تسكين العمالة كاملاً: وحدات مطابقة لاشتراطات وزارة البلديات والإسكان، مع الترخيص التشغيلي والتوثيق والإدارة والإعاشة — وكل إجراء حكومي علينا.")}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#wh-request">${I.check}<span>${L("Request a quote", "اطلب عرض سعر")}</span></a>${waBtn2("Book a consultation", "احجز استشارة", "btn-primary", true)}</div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Licensed units across the Kingdom", "وحدات مرخصة في مدن المملكة")}</span>
      <span class="hero-badge">${I.check}${L("Balady + Ejar + Civil Defense + Muqeem", "بلدي + إيجار + الدفاع المدني + مقيم")}</span>
      <span class="hero-badge">${I.check}${L("Always inspection-ready", "جاهزية دائمة للجولات الرقابية")}</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("One place", "في مكان واحد")}</span><h2>${L("Everything worker housing needs", "كل احتياجات تسكين العمالة")}</h2><p>${L("Pick what you need — housing, licensing, operations, catering, transport — and we execute.", "تختار اللي تحتاجه — سكن، ترخيص، تشغيل، إعاشة، نقل — واحنا نتولى التنفيذ.")}</p></div>
    <div class="grid grid-3">${services}</div>
    <div class="cta-band" style="margin-top:34px"><h2>${L("Housing + Catering + Transport — one contract", "سكن + إعاشة + نقل — بعقد واحد")}</h2><p>${L("The full bundle: licensed housing, three daily meals from a licensed kitchen, and daily transport to your sites — one monthly invoice.", "الباقة الكاملة: سكن مرخّص، وثلاث وجبات يومياً من مطبخ مرخّص، ونقل يومي لمواقعك — بفاتورة شهرية واحدة.")}</p><a class="btn btn-white btn-lg" href="#wh-request">${L("Request the full bundle", "اطلب الباقة الكاملة")}</a></div>
  </div></section>

  <section class="section" id="wh-fines"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("The regulations", "وش يقول النظام؟")}</span><h2>${L("Why random housing became a real risk", "ليش السكن العشوائي صار مخاطرة")}</h2><p>${L("From MoMaH's supervision guide for collective housing (ministerial decision 4600218548/1 — 1446H / 2025):", "من الدليل الاسترشادي لإجراءات الرقابة على السكن الجماعي للأفراد (قرار وزاري 4600218548/1 — 1446هـ / 2025م):")}</p></div>
    <div class="grid grid-4" style="margin-bottom:28px">${facts}</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:640px;background:var(--white);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm)">
      <thead><tr>
        <th style="background:var(--navy);color:var(--white);padding:12px 14px;text-align:start">${L("Violation", "المخالفة")}</th>
        <th style="background:var(--navy);color:var(--white);padding:12px 14px;text-align:start">${L("Fine (Category-1 cities)", "الغرامة (الفئة الأولى)")}</th>
        <th style="background:var(--navy);color:var(--white);padding:12px 14px;text-align:start">${L("Class", "التصنيف")}</th>
      </tr></thead>
      <tbody>${fines}</tbody>
    </table></div>
    <p class="text-soft" style="font-size:.9rem;margin-top:10px">${L("Source: MoMaH supervision guide (momah.gov.sa). Fines scale by municipality category and double on repeat.", "المصدر: الدليل الاسترشادي — وزارة البلديات والإسكان (momah.gov.sa). الغرامات تتدرج حسب تصنيف الأمانة وتتضاعف عند التكرار.")}</p>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف نشتغل؟")}</span><h2>${L("Four steps to fully compliant housing", "أربع خطوات من الطلب إلى تسكين نظامي 100%")}</h2></div>
    <div class="steps-grid">${steps}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Coverage", "التغطية")}</span><h2>${L("We cover the Kingdom's cities", "نغطي مدن المملكة")}</h2></div>
    <div class="svc-meta">${cities}</div>
  </div></section>

  <section class="section section--gray" id="wh-request"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Request housing", "اطلب سكن لعمالتك")}</span><h2>${L("Send your request — quote within one working day", "أرسل طلبك — عرض سعر خلال يوم عمل")}</h2></div>
    <form id="wh-form" novalidate style="max-width:840px;margin:0 auto">
      <div class="join-grid">
        <div class="field"><label for="wh-company">${L("Company name", "اسم المنشأة")} *</label><input type="text" id="wh-company" required></div>
        <div class="field"><label for="wh-phone">${L("Mobile / WhatsApp", "الجوال / واتساب")} *</label><input type="tel" id="wh-phone" inputmode="tel" placeholder="05XXXXXXXX" required></div>
        <div class="field"><label for="wh-city">${L("City", "المدينة")} *</label><input type="text" id="wh-city" required placeholder="${Lraw("e.g. Riyadh", "مثال: الرياض")}"></div>
        <div class="field"><label for="wh-count">${L("Worker count", "عدد العمالة")} *</label><input type="number" id="wh-count" min="1" inputmode="numeric" placeholder="${Lraw("e.g. 50", "مثال: 50")}" required></div>
        <div class="field"><label for="wh-type">${L("Request type", "نوع الطلب")}</label><select id="wh-type">${reqTypes}</select></div>
        <div class="field"><label for="wh-email">${L("Email", "البريد الإلكتروني")}</label><input type="email" id="wh-email" placeholder="name@company.com"></div>
        <div class="field field-full"><label for="wh-notes">${L("Notes (duration, preferred district, special requirements…)", "ملاحظات (المدة، الموقع المفضل، متطلبات خاصة…)")}</label><textarea id="wh-notes" rows="3"></textarea></div>
      </div>
      <div class="join-actions">
        <button type="submit" class="btn btn-primary btn-lg" id="wh-submit">${L("Send request", "أرسل الطلب")}</button>
        <p class="emp-note">${L("Your data is protected and used only to prepare your quote. We never ask for passwords or OTP codes.", "بياناتك محمية وتُستخدم لتجهيز عرضك فقط. لا نطلب كلمات مرور أو رموز OTP.")}</p>
      </div>
      <div class="form-success" hidden id="wh-result"></div>
    </form>
  </div></section>

  <section class="section"><div class="container">
    <div class="cta-band"><h2>${L("Ready to house your workers the compliant way?", "جاهز تسكّن عمالتك بشكل نظامي؟")}</h2><p>${L("The smart agent replies instantly and sets your next step.", "الوكيل الذكي يرد فوراً ويحدد لك الخطوة التالية.")}</p>${waBtn2("Book a consultation", "احجز استشارة", "btn-white", true)}</div>
  </div></section>`;

  const script = `<script>(function(){var f=document.getElementById("wh-form");if(!f)return;f.addEventListener("submit",function(e){e.preventDefault();var g=function(id){var el=document.getElementById(id);return el?el.value.trim():""};var company=g("wh-company"),phone=g("wh-phone"),city=g("wh-city"),count=g("wh-count");var res=document.getElementById("wh-result");var show=function(t,ok){res.hidden=false;res.textContent=t;res.style.color=ok?"#137a3e":"#b3261e"};if(!company||!phone||!city||!count){show("${Lraw("Please fill company, mobile, city and worker count.", "يرجى تعبئة اسم المنشأة والجوال والمدينة وعدد العمالة.")}",false);return}var fd=new FormData();fd.append("company",company);fd.append("whatsapp",phone);fd.append("city",city);fd.append("workers_count",count);fd.append("request_type",g("wh-type"));fd.append("email",g("wh-email"));fd.append("notes",g("wh-notes"));fd.append("source","website-worker-housing");fd.append("service","worker-housing");var btn=document.getElementById("wh-submit");btn.disabled=true;fetch("https://businesspartnerai.app.n8n.cloud/webhook/client-intake-web",{method:"POST",body:fd}).then(function(r){if(!r.ok)throw 0;show("${Lraw("Request received! We reply with options and a quote within one working day.", "استلمنا طلبك! نرجع لك بخيارات السكن وعرض السعر خلال يوم عمل.")}",true);f.reset()}).catch(function(){show("${Lraw("Sending failed — try again or contact us on WhatsApp.", "تعذّر الإرسال. جرّب مرة أخرى أو تواصل معنا واتساب.")}",false)}).finally(function(){btn.disabled=false})})})();</script>`;

  return page({
    title: Lraw("Worker Housing — licensed housing, licensing & operations | Business Partner", "تسكين العمالة — سكن مرخّص وترخيص وتشغيل | بيزنس بارتنر"),
    desc: Lraw("Ready licensed worker housing + Balady license, Ejar attestation, Civil Defense, Muqeem updates, catering and transport — fully compliant with MoMaH's collective housing regulations.", "سكن عمالة جاهز ومرخّص + رخصة بلدي وتوثيق إيجار والدفاع المدني وتحديث مقيم وإعاشة ونقل — متوافق مع اشتراطات وزارة البلديات والإسكان للسكن الجماعي."),
    active: "/worker-housing", path: "/worker-housing", body, script,
  });
}

function buildWorkspaces() {
  const cities = [["Riyadh", "الرياض"], ["Jeddah", "جدة"], ["Dammam", "الدمام"], ["Khobar", "الخبر"], ["Makkah", "مكة"], ["Madinah", "المدينة"], ["Other", "أخرى"]];
  const types = [["Office", "مكتب"], ["Co-working Space", "مساحة مشتركة"], ["Serviced Office", "مكتب مخدوم"], ["Retail Shop", "محل تجاري"], ["Showroom", "معرض"], ["Warehouse", "مستودع"], ["Commercial Villa", "فيلا تجارية"]];
  const cityOpts = cities.map((c) => `<option value="${c[0]}">${L(c[0], c[1])}</option>`).join("");
  const typeOpts = types.map((t) => `<option value="${t[0]}">${L(t[0], t[1])}</option>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:1000px">
    <span class="eyebrow">${L("Office Spaces", "المكاتب ومساحات العمل")}</span>
    <h1>${L("Find your workspace in Saudi Arabia", "اعثر على مساحتك في السعودية")}</h1>
    <p class="lead">${L("Browse available offices, coworking and commercial spaces across the Kingdom. Tell us what you need and we match you — and handle the paperwork.", "تصفّح المكاتب والمساحات المشتركة والتجارية المتاحة في المملكة. أخبرنا باحتياجك ونطابقك — ونتولّى الإجراءات.")}</p>
    <div class="talent-actions" style="margin-top:24px">
      <a class="btn btn-primary" href="${u("/workspace-request")}">${I.check}<span>${L("Request a workspace", "اطلب مساحة عمل")}</span></a>
      <a class="btn btn-ghost" href="#ws-pool">${L("Browse spaces", "تصفّح المساحات")}</a>
    </div>
  </div></section>

  <section class="section" id="ws-pool"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Available now", "متاح الآن")}</span><h2>${L("Available spaces", "المساحات المتاحة")}</h2><p>${L("Live from our inventory. Enquire and our team arranges viewings, pricing and the lease.", "مباشرة من مخزوننا. استفسر ويرتّب فريقنا المعاينة والتسعير والعقد.")}</p></div>
    <div class="emp-access"><div class="emp-filters">
      <input type="text" id="ws-q" placeholder="${Lraw("Search district, use…", "ابحث بالحي أو الاستخدام…")}">
      <select id="ws-city"><option value="">${L("All cities", "كل المدن")}</option>${cityOpts}</select>
      <select id="ws-type"><option value="">${L("All types", "كل الأنواع")}</option>${typeOpts}</select>
      <button type="button" class="btn btn-primary" id="ws-load">${L("Show spaces", "اعرض المساحات")}</button>
    </div></div>
    <p class="emp-note" id="ws-status"></p>
    <div class="emp-grid" id="ws-grid"></div>
    <div class="cta-band" style="margin-top:34px"><h2>${L("Didn't find it? Tell us your requirements", "ما لقيت؟ أخبرنا بمتطلباتك")}</h2><p>${L("Send your requirements and our matching engine finds options across the Kingdom.", "أرسل متطلباتك ويجد محرّك المطابقة خيارات في كل المملكة.")}</p><a class="btn btn-white btn-lg" href="${u("/workspace-request")}">${L("Request a workspace", "اطلب مساحة عمل")}</a></div>
  </div></section>
  <script>window.BP_WS_LANG=${JSON.stringify(LANG)};</script>`;
  return page({ title: Lraw("Office spaces & workspaces in Saudi Arabia — Business Partner", "المكاتب ومساحات العمل في السعودية — بيزنس بارتنر"), desc: Lraw("Browse available offices, coworking and commercial spaces, or tell us your requirements and we match you.", "تصفّح المكاتب والمساحات المشتركة والتجارية المتاحة، أو أخبرنا بمتطلباتك ونطابقك."), active: "/workspaces", path: "/workspaces", body });
}

function buildWorkspaceRequest() {
  const cities = [["Riyadh", "الرياض"], ["Jeddah", "جدة"], ["Dammam", "الدمام"], ["Khobar", "الخبر"], ["Makkah", "مكة"], ["Madinah", "المدينة"], ["Other", "أخرى"]];
  const cats = [["Office", "مكتب"], ["Co-working Space", "مساحة عمل مشتركة"], ["Retail", "محل تجاري"], ["Showroom", "معرض"], ["Commercial", "تجاري"], ["Industrial", "صناعي / مستودع"], ["Land", "أرض"], ["Other", "أخرى"]];
  const cityOpts = cities.map((c) => `<option value="${c[0]}">${L(c[0], c[1])}</option>`).join("");
  const catOpts = cats.map((c) => `<option value="${c[0]}">${L(c[0], c[1])}</option>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:960px">
    <span class="eyebrow">${L("Office Spaces", "المكاتب ومساحات العمل")}</span>
    <h1>${L("Request a workspace", "اطلب مساحة عمل")}</h1>
    <p class="lead">${L("Tell us what you need — our matching engine finds the best options across the Kingdom and our team handles viewings, pricing and the lease.", "أخبرنا باحتياجك — محرّك المطابقة يجد أفضل الخيارات في المملكة، وفريقنا يتولّى المعاينة والتسعير والعقد.")}</p>
  </div></section>

  <section class="section"><div class="container">
    <form id="ws-req" novalidate>
      <div class="join-grid">
        <div class="field"><label for="wr-purpose">${L("Purpose", "الغرض")}</label><select id="wr-purpose"><option value="rent">${L("Rent", "إيجار")}</option><option value="buy">${L("Buy", "شراء")}</option></select></div>
        <div class="field"><label for="wr-category">${L("Space type", "نوع المساحة")}</label><select id="wr-category">${catOpts}</select></div>
        <div class="field"><label for="wr-city">${L("City", "المدينة")} *</label><select id="wr-city"><option value="">${L("Choose city", "اختر المدينة")}</option>${cityOpts}</select></div>
        <div class="field"><label for="wr-district">${L("Preferred district", "الحي المفضّل")}</label><input type="text" id="wr-district" placeholder="${Lraw("e.g. Al Olaya", "مثال: العليا")}"></div>
        <div class="field"><label for="wr-size">${L("Area (sqm)", "المساحة (م²)")}</label><input type="number" id="wr-size" min="0" inputmode="numeric" placeholder="${Lraw("Optional", "اختياري")}"></div>
        <div class="field"><label for="wr-seats">${L("Seats / people", "عدد المقاعد / الأشخاص")}</label><input type="number" id="wr-seats" min="0" inputmode="numeric" placeholder="${Lraw("Optional", "اختياري")}"></div>
        <div class="field"><label for="wr-budget">${L("Budget (SAR / year)", "الميزانية (ريال / سنوياً)")}</label><input type="number" id="wr-budget" min="0" inputmode="numeric" placeholder="${Lraw("Optional", "اختياري")}"></div>
        <div class="field"><label for="wr-contact">${L("Your name", "اسمك")}</label><input type="text" id="wr-contact"></div>
        <div class="field"><label for="wr-phone">${L("Mobile", "رقم الجوال")} *</label><input type="tel" id="wr-phone" inputmode="tel" placeholder="05XXXXXXXX" required></div>
        <div class="field"><label for="wr-email">${L("Email", "البريد الإلكتروني")}</label><input type="email" id="wr-email" placeholder="name@company.com"></div>
        <div class="field field-full"><label for="wr-notes">${L("Notes (requirements, timing…)", "ملاحظات (المتطلبات، التوقيت…)")}</label><textarea id="wr-notes" rows="3"></textarea></div>
      </div>
      <div class="join-actions">
        <button type="submit" class="btn btn-primary btn-lg" id="wr-submit">${L("Send request", "أرسل الطلب")}</button>
        <p class="emp-note">${L("We reply within working hours (Sun–Thu, 9am–6pm) and on WhatsApp 24/7.", "نرد خلال ساعات العمل (الأحد–الخميس 9ص–6م) وعلى واتساب 24/7.")}</p>
      </div>
      <div class="form-success" hidden id="wr-result"></div>
    </form>
  </div></section>`;
  return page({ title: Lraw("Request a workspace — Business Partner", "اطلب مساحة عمل — بيزنس بارتنر"), desc: Lraw("Tell us your workspace requirements and we match you with the best options in Saudi Arabia.", "أخبرنا بمتطلبات مساحتك ونطابقك مع أفضل الخيارات في السعودية."), active: "/workspaces", path: "/workspace-request", body });
}

// Lets a candidate see how their own profile looks (pipeline stage, CV
// links) using the same phone+email pair they applied with — no separate
// login system needed.
function trackApplicationHtml() {
  return `
  <section class="section section--gray"><div class="container">
    <div style="max-width:520px;margin:0 auto">
      <h2 class="center">${L("Track your application", "تابع طلبك")}</h2>
      <p class="center text-soft">${L("Enter the phone and email you applied with to see your current status.", "أدخل الجوال والبريد اللذين قدّمت بهما لمشاهدة حالتك الحالية.")}</p>
      <form id="track-form" novalidate class="grid grid-2" style="gap:0 20px;margin-top:16px">
        <div class="field"><label for="tr-phone">${L("Mobile", "الجوال")}</label><input id="tr-phone" type="tel" required></div>
        <div class="field"><label for="tr-email">${L("Email", "البريد الإلكتروني")}</label><input id="tr-email" type="email" required></div>
        <div class="field field-full"><button type="submit" class="btn btn-primary" style="width:100%">${L("Check status", "تحقّق من الحالة")}</button></div>
      </form>
      <div id="track-result" hidden style="margin-top:20px"></div>
    </div>
  </div></section>`;
}
function buildCareers() {
  const c = site.careers;
  const f = c.seeker.fields;
  const seekerValue = [
    ["📄", L("One CV, many opportunities", "سيرة واحدة، فرص كثيرة"), L("Join the pool once; we match you whenever a fitting role opens.", "سجّل مرة واحدة، ونطابقك مع الفرص المناسبة فور توفّرها.")],
    ["🤝", L("Employers reach you", "أصحاب العمل يوصلونك"), L("Companies hiring through us see your profile for suitable roles.", "الشركات التي توظّف عبرنا تشاهد ملفك للفرص المناسبة.")],
    ["🔒", L("Your data is protected", "بياناتك محمية"), L("We never share your CV without your consent (PDPL).", "لا نشارك سيرتك دون موافقتك (حماية البيانات).")],
  ].map((x) => `<div class="card"><div class="card-icon" style="font-size:1.5rem">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner" style="max-width:960px">
    <span class="eyebrow">${L("For job seekers", "للباحثين عن عمل")}</span>
    <h1>${L("Find your next opportunity", "فرصتك القادمة تبدأ هنا")}</h1>
    <p class="lead">${L("Browse open roles, apply once with your CV, and move through Business Partner's hiring flow with screening, shortlisting, interviews, and employer updates.", "تصفّح الوظائف المفتوحة، قدّم مرة واحدة بسيرتك الذاتية، وانتقل داخل مسار توظيف واضح: فرز، ترشيح، مقابلة، ثم عرض.")}</p>
    <div class="talent-actions" style="margin-top:22px">
      <a class="btn btn-primary" href="#open-jobs">${I.upload}<span>${L("Browse jobs", "تصفّح الوظائف")}</span></a>
      <a class="btn btn-ghost" href="${u("/employers")}">${L("I'm an employer →", "أنا صاحب عمل ←")}</a>
    </div>
  </div></section>

  ${jobCardsHtml()}

  <section class="section"><div class="container">
    <div class="grid grid-3" style="margin-bottom:36px">${seekerValue}</div>
    <div style="max-width:640px;margin:0 auto" id="seeker-form">
      <h2 class="center">${L("Join the general candidate pool", "انضم لقاعدة المرشحين العامة")}</h2>
      <p class="center text-soft" style="margin-top:-8px">${L("Not applying for a specific posting above? Submit here and we'll match you when a suitable role opens.", "لا تقدّم على وظيفة محددة أعلاه؟ قدّم هنا وسنطابقك عند توفّر فرصة مناسبة.")}</p>
      ${seekerFormHtml(f, null)}
    </div>
  </div></section>

  ${trackApplicationHtml()}`;
  return page({ title: Lraw("Careers — Business Partner", "الوظائف — بيزنس بارتنر"), desc: Lraw("Browse open roles and apply through Business Partner.", "تصفح الوظائف وقدّم عبر بيزنس بارتنر."), active: "/careers", body });
}

function buildContact() {
  const c = site.contact;
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Contact us", "تواصل معنا")}</span>
    <h1>${L("We reply instantly", "نجاوبك فوراً")}</h1>
    <p class="lead">${L("Fill in the form and we'll get back to you, or reach us by phone or email.", "املأ النموذج ونعاود التواصل معك، أو تواصل معنا هاتفياً أو بالبريد.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="contact-grid">
      <div>
        <h2>${L("Contact information", "معلومات التواصل")}</h2>
        <ul class="info-list">
          <li><span class="ico">${I.phone}</span><div><div class="k">${L("Phone", "التواصل الهاتفي")}</div><a class="v" href="tel:${esc(c.phoneIntl)}">${esc(c.phone)}</a></div></li>
          <li><span class="ico">${I.mail}</span><div><div class="k">${L("Email", "البريد الإلكتروني")}</div><a class="v" href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>
          <li><span class="ico">${I.pin}</span><div><div class="k">${L("Address", "العنوان")}</div><div class="v">${L(c.addressEn || c.address, c.address)}</div></div></li>
          <li><span class="ico">${I.clock}</span><div><div class="k">${L("Working hours", "أوقات العمل")}</div><div class="v">${L(c.hoursEn || c.hours, c.hours)}</div></div></li>
        </ul>
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${encodeURIComponent("حي الملقا الرياض")}&output=embed" loading="lazy" title="${Lraw("Business Partner location", "موقع بيزنس بارتنر")}"></iframe>
        </div>
        ${site.social ? `<div class="social-row-wrap">
          <div class="k" style="font-size:.82rem;color:var(--text-soft);margin-bottom:10px">${L("Follow us", "تابعنا")}</div>
          <div class="social-row">
            ${site.social.linkedin ? `<a href="${site.social.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn">${I.linkedin}</a>` : ""}
            ${site.social.instagram ? `<a href="${site.social.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${I.instagram}</a>` : ""}
            ${site.social.facebook ? `<a href="${site.social.facebook}" target="_blank" rel="noopener" aria-label="Facebook">${I.facebook}</a>` : ""}
          </div>
        </div>` : ""}
      </div>
      <div>
        <h2>${L("Send your message", "أرسل رسالتك")}</h2>
        <form class="calc-form" id="contact-form" novalidate>
          <div class="field"><label for="f-name">${L("Name", "الاسم")}</label><input id="f-name" name="name" type="text" placeholder="${Lraw("Your full name", "اسمك الكامل")}" required></div>
          <div class="field"><label for="f-phone">${L("Mobile", "رقم الجوال")}</label><input id="f-phone" name="phone" type="tel" placeholder="05xxxxxxxx"></div>
          <div class="field"><label for="f-service">${L("Service needed", "الخدمة المطلوبة")}</label><input id="f-service" name="service" type="text" placeholder="${Lraw("e.g. company formation, premium residency", "مثال: تأسيس شركة، إقامة مميزة")}"></div>
          <div class="field"><label for="f-msg">${L("Your request details", "تفاصيل طلبك")}</label><textarea id="f-msg" name="message" rows="4" placeholder="${Lraw("Write your enquiry here", "اكتب استفسارك هنا")}"></textarea></div>
          <button type="submit" class="btn btn-primary btn-lg">${I.mail}<span>${L("Send your request", "أرسل طلبك")}</span></button>
          <p class="form-note">${L("We'll receive your request and get back to you. You'll also be registered so your request is saved to your dashboard.", "يصلنا طلبك ونعاود التواصل معك، ويتم تسجيلك ليُحفظ طلبك في لوحتك.")}</p>
        </form>
      </div>
    </div>
  </div></section>`;
  return page({ title: Lraw("Contact — Business Partner", "اتصل بنا — بيزنس بارتنر"), desc: Lraw("Contact Business Partner by phone, email or the form — and we'll get back to you.", "تواصل مع بيزنس بارتنر عبر الهاتف أو البريد أو النموذج — ونعاود التواصل معك."), active: "/contact", body });
}

// Installments: we arrange financing for government-service fees through the
// client's bank, BNPL providers (Tabby/Tamara) or e-wallets. The page collects
// a structured request; the actual financing approval happens with the
// provider — we coordinate it. ?amount= prefills the calculator (checkout links here).
function buildInstallments() {
  const months = [3, 6, 12];
  const channels = [
    ["🏦", L("Your bank", "عن طريق بنكك"), L("Personal finance or installment POS through the major Saudi banks — we prepare the file and quotation your bank asks for.", "تمويل شخصي أو تقسيط نقاط بيع عبر البنوك السعودية الرئيسية — نجهّز لك الملف وعرض السعر الذي يطلبه بنكك.")],
    ["🟣", L("Tabby / Tamara", "تابي / تمارا"), L("Split the fees into 4+ payments through BNPL providers, subject to their approval and limits.", "قسّم الرسوم على 4 دفعات أو أكثر عبر مزودي الدفع الآجل، حسب موافقتهم وحدودهم.")],
    ["📱", L("E-wallets", "المحافظ الإلكترونية"), L("STC Pay and similar wallets for scheduled partial payments combined with your Business Partner wallet.", "STC Pay والمحافظ المشابهة لدفعات جزئية مجدولة بالتكامل مع محفظتك في بيزنس بارتنر.")],
  ].map((c) => `<div class="card feature"><div class="card-icon" style="font-size:1.6rem">${c[0]}</div><h3>${c[1]}</h3><p>${c[2]}</p></div>`).join("");
  const steps = [
    [1, L("Pick the service & amount", "حدد الخدمة والمبلغ"), L("Choose the government service or SADAD invoice you want to split.", "اختر الخدمة الحكومية أو فاتورة سداد التي تريد تقسيطها.")],
    [2, L("Pick the plan", "اختر خطة التقسيط"), L("3, 6 or 12 months — see the estimated monthly instalment instantly.", "3 أو 6 أو 12 شهراً — وشاهد القسط الشهري التقديري فوراً.")],
    [3, L("We arrange the financing", "نرتب لك التمويل"), L("We coordinate with your bank / Tabby / Tamara and prepare every document they need.", "ننسق مع بنكك / تابي / تمارا ونجهّز كل مستند يطلبونه.")],
    [4, L("Approve & we execute", "وافق وننفذ"), L("Once approved, we pay the fees on your behalf and follow the service through to issuance.", "بعد الموافقة نسدد الرسوم نيابة عنك ونتابع الخدمة حتى الإصدار.")],
  ].map((s) => `<div class="hstep"><span class="hstep-n">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Beta service · for establishments ⚡", "خدمة تحت التجربة · للمنشآت ⚡")}</span>
    <h1>${L("Pay government fees in instalments", "قسّط رسوم خدماتك الحكومية")}</h1>
    <p class="lead">${L("Don't let a big government fee block your growth — we split it through your bank, Tabby/Tamara or e-wallets, pay it for you, and follow the service to issuance.", "لا تدع رسوماً حكومية كبيرة توقف نموك — نقسّطها لك عبر بنكك أو تابي/تمارا أو المحافظ الإلكترونية، نسددها عنك، ونتابع خدمتك حتى الإصدار.")}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#inst-form">${L("Request an instalment plan", "اطلب خطة تقسيط")}</a>${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-ghost")}</div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("For SMEs — not individuals", "للمنشآت الصغيرة والمتوسطة — لا للأفراد")}</span>
      <span class="hero-badge">${I.check}${L("Banks, BNPL & wallets", "بنوك وتقسيط آجل ومحافظ")}</span>
      <span class="hero-badge">${I.check}${L("We pay & follow through", "نسدد ونتابع حتى الإصدار")}</span>
    </div>
  </div></section>

  <section class="section" style="padding-top:28px;padding-bottom:0"><div class="container">
    <div class="callout" style="max-width:900px;margin:0 auto;border:1px solid var(--gray-line);background:#fff8ec">
      <span class="ico">🧪</span>
      <p><strong>${L("This service is currently in trial (beta).", "هذه الخدمة حالياً تحت التجربة (نسخة تجريبية).")}</strong> ${L("It is offered to small and medium establishments (SMEs) only — not to individuals — for splitting government-service fees. Terms and availability may change while we pilot it; the final financing offer is set by the bank / provider.", "وهي موجّهة للمنشآت الصغيرة والمتوسطة فقط — وليست للأفراد — لتقسيط رسوم الخدمات الحكومية. قد تتغيّر الشروط والإتاحة أثناء فترة التجربة، والعرض التمويلي النهائي تحدده جهة التمويل / البنك.")}</p>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف تعمل")}</span><h2>${L("From fee to instalments in 4 steps", "من الرسوم إلى الأقساط في 4 خطوات")}</h2></div>
    <div class="home-steps">${steps}</div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Channels", "القنوات")}</span><h2>${L("Instalment channels we arrange", "قنوات التقسيط التي نرتبها لك")}</h2></div>
    <div class="grid grid-3">${channels}</div>
    <div class="callout" style="max-width:760px;margin:28px auto 0"><span class="ico">⚖️</span><p>${L("Business Partner arranges and coordinates the financing; final approval, terms and any financing cost are set by the bank / provider.", "بيزنس بارتنر يرتب وينسق التمويل؛ الموافقة النهائية والشروط وأي كلفة تمويل تحددها جهة التمويل نفسها.")}</p></div>
    <div class="callout" style="max-width:760px;margin:14px auto 0"><span class="ico">💰</span><p>${L("Split it today, reclaim it tomorrow: many of these same fees are refundable through Monsha'at's Estrdad initiative — as long as your establishment stays compliant.", "قسّطها اليوم واستردها غداً: كثير من هذه الرسوم نفسها قابلة للاسترداد عبر مبادرة «استرداد» من منشآت — ما دامت منشأتك ممتثلة.")} <a href="${u("/estrdad")}">${L("How refunds work ←", "كيف يعمل الاسترداد ←")}</a></p></div>
  </div></section>

  <section class="section section--gray" id="inst-form"><div class="container" style="max-width:920px">
    <div class="section-head"><h2>${L("Request your instalment plan", "اطلب خطة التقسيط")}</h2><p>${L("For registered establishments (with a CR) — fill it in a minute and we come back with the available offers.", "للمنشآت المسجّلة (بسجل تجاري) — عبّئه في دقيقة ونعود لك بالعروض المتاحة.")}</p></div>
    <div class="order-box">
      <form id="inst-form-el" novalidate>
        <div class="cc-grid">
          <div class="field"><label for="inst-company">${L("Establishment name", "اسم المنشأة")} *</label><input type="text" id="inst-company" required></div>
          <div class="field"><label for="inst-cr">${L("Commercial Registration (CR) number", "رقم السجل التجاري")}</label><input type="text" id="inst-cr" inputmode="numeric" placeholder="${Lraw("e.g. 1010xxxxxx", "مثال: 1010xxxxxx")}"></div>
          <div class="field"><label for="inst-name">${L("Contact name", "اسم المسؤول")} *</label><input type="text" id="inst-name" required></div>
          <div class="field"><label for="inst-phone">${L("Mobile", "الجوال")} *</label><input type="tel" id="inst-phone" placeholder="05XXXXXXXX" required></div>
          <div class="field"><label for="inst-email">${L("Email", "البريد الإلكتروني")} *</label><input type="email" id="inst-email" required></div>
          <div class="field"><label for="inst-service">${L("Service / invoice to split", "الخدمة / الفاتورة المراد تقسيطها")} *</label><input type="text" id="inst-service" placeholder="${Lraw("e.g. MISA license 62,000 SAR", "مثال: رخصة استثمار MISA بقيمة 62,000 ﷼")}"></div>
          <div class="field"><label for="inst-amount">${L("Amount (SAR)", "المبلغ (ريال)")} *</label><input type="number" id="inst-amount" min="500" placeholder="10000"></div>
          <div class="field"><label for="inst-months">${L("Duration", "مدة التقسيط")}</label><select id="inst-months">${months.map((m) => `<option value="${m}">${m} ${L("months", "أشهر")}</option>`).join("")}</select></div>
          <div class="field"><label for="inst-channel">${L("Preferred channel", "القناة المفضلة")}</label><select id="inst-channel">
            <option value="bank">${Lraw("My bank", "بنكي")}</option>
            <option value="bnpl">${Lraw("Tabby / Tamara", "تابي / تمارا")}</option>
            <option value="wallet">${Lraw("E-wallet", "محفظة إلكترونية")}</option>
            <option value="any">${Lraw("Best available offer", "أفضل عرض متاح")}</option>
          </select></div>
        </div>
        <div class="calc-line" style="border:0;padding-top:0"><span class="k" style="color:var(--text-soft)">${L("Estimated monthly instalment", "القسط الشهري التقديري")}</span><span class="v" id="inst-monthly" style="color:var(--navy);font-size:1.3rem">—</span></div>
        <p class="mini" style="margin-bottom:12px">${L("Estimate = amount ÷ months; the provider's final offer may add a financing cost.", "التقدير = المبلغ ÷ الأشهر؛ العرض النهائي من جهة التمويل قد يضيف كلفة تمويل.")}</p>
        <button type="submit" class="btn btn-primary btn-lg">${L("Send the request", "أرسل الطلب")}</button>
        <div class="form-success" id="inst-success" hidden></div>
      </form>
    </div>
  </div></section>`;
  return page({ title: Lraw("Instalments for government services — Business Partner", "تقسيط الخدمات الحكومية — بيزنس بارتنر"), desc: Lraw("Split Saudi government fees through banks, Tabby/Tamara or e-wallets — we arrange, pay and follow through.", "قسّط الرسوم الحكومية عبر البنوك أو تابي/تمارا أو المحافظ الإلكترونية — نرتب ونسدد ونتابع عنك."), active: "/installments", path: "/installments", body });
}

// Estrdad (استرداد) — Monsha'at's government-fee refund initiative
// (estrdad.monshaat.gov.sa). Facts below are from the official guides
// (الدليل التعريفي ن2 إصدار 3.0 + دليل المستخدم ن2): eligibility windows,
// covered fees, and the compliance conditions that keep a payout alive.
// Business Partner's pitch: refunds are compliance-conditional through 2028 —
// we are the operating partner that keeps you eligible.
function buildEstrdad() {
  const fees = [
    L("Publishing the incorporation contract (once)", "نشر عقد تأسيس الشركة (لمرة واحدة)"),
    L("CR issuance & renewal", "إصدار وتجديد السجل التجاري"),
    L("Converting an establishment into a company", "تحويل المؤسسة إلى شركة"),
    L("Chamber of Commerce subscription & renewal", "اشتراك الغرفة التجارية وتجديده"),
    L("Municipal licenses for the activity", "الرخص البلدية لممارسة النشاط"),
    L("Saudi Post subscription", "اشتراك البريد السعودي"),
    L("One trademark registration", "تسجيل علامة تجارية واحدة"),
    L("80% of the expat levy (المقابل المالي) per worker, yearly — per the quota criteria (15–30 workers by activity & entity)", "80% من رسوم المقابل المالي للعامل الأجنبي دون مرافقيه سنوياً — حسب معيار المفاضلة (15–30 عاملاً حسب النشاط والكيان)"),
    L("Economic-activity license issuance & renewal fees", "رسوم إصدار وتجديد تراخيص الأنشطة الاقتصادية"),
    L("One patent registration", "رسوم تسجيل براءة اختراع واحدة"),
  ].map((f) => `<li>${I.check}<span>${f}</span></li>`).join("");
  const conds = [
    ["🪪", L("Valid CR — suspended or struck CRs are disqualified", "سجل تجاري ساري — الموقوف أو المشطوب يُسقط الاستحقاق")],
    ["📜", L("Valid size certificate & activity licenses — an expiry DURING the refund period stops your payment", "شهادة حجم المنشأة والتراخيص سارية — انتهاء أي منها أثناء فترة الاسترداد يوقف دفعتك")],
    ["🇸🇦", L("Meeting the Saudization ratios of Nitaqat Developed", "تحقيق نسب التوطين المعتمدة في «نطاقات المطوّر»")],
    ["🏢", L("Started activity 2024–2026, within 3 years (first employee registration is the marker)", "بدء النشاط خلال 2024–2026 وبما لا يتجاوز 3 سنوات (تسجيل أول عامل هو المعيار)")],
    ["📊", L("Accurate data & complete documents — mismatches close the request", "بيانات دقيقة ومستندات مكتملة — أي تعارض يغلق الطلب")],
    ["🔔", L("Notifying the authority before changing your CR activity", "إشعار الهيئة قبل أي تغيير في نشاط السجل")],
  ].map((c) => `<div class="card feature"><div class="card-icon" style="font-size:1.5rem">${c[0]}</div><h3 style="font-size:1rem">${c[1]}</h3></div>`).join("");
  const helps = [
    [L("Continuous compliance watch", "مراقبة امتثال مستمرة"), L("The Compliance Agent tracks your CR, certificates, licenses and Nitaqat daily and alerts you BEFORE anything expires — so your refund never stops.", "وكيل الامتثال يراقب سجلك وشهاداتك وتراخيصك ونطاقاتك يومياً وينبهك قبل أي انتهاء — فلا تتوقف دفعاتك أبداً."), "/compliance-agent"],
    [L("Nitaqat before it hurts", "نطاقاتك قبل ما تتأثر"), L("HR management (Qiwa, GOSI, Mudad) and recruitment that keep your Saudization inside the eligible band.", "إدارة الموارد البشرية (قوى، التأمينات، مدد) والتوظيف بما يُبقي توطينك ضمن النطاق المؤهل."), "/hr"],
    [L("File preparation & submission", "تجهيز الملف والتقديم"), L("Size certificate, IBAN certificate, activity licenses, accurate data — we prepare the full Estrdad file and follow your request to disbursement, including objections within the 60-day window.", "شهادة حجم المنشأة، شهادة الآيبان، التراخيص، ودقة البيانات — نجهّز ملف استرداد كاملاً ونتابع طلبك حتى الصرف، بما فيه الاعتراض خلال مهلة الـ60 يوماً."), "/consultation"],
    [L("Renewals paid on time — from your wallet", "تجديداتك تُسدد في وقتها — من محفظتك"), L("Chamber, municipal and license renewals paid from your Business Partner wallet before they lapse — the same fees Estrdad refunds you.", "تجديدات الغرفة والبلدية والتراخيص تُسدد من محفظتك في بيزنس بارتنر قبل انتهائها — وهي نفسها الرسوم التي تستردها من المبادرة."), "/account"],
  ].map((h) => `<div class="card"><h3>${h[0]}</h3><p>${h[1]}</p><a class="card-link" href="${u(h[3] || h[2])}">${L("Learn more", "اعرف أكثر")} ${I.arrow}</a></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Monsha'at Estrdad initiative", "مبادرة استرداد من منشآت")}</span>
    <h1>${L("Reclaim your paid government fees — if you stay compliant", "استرد رسومك الحكومية المدفوعة — بشرط أن تبقى ممتثلاً")}</h1>
    <p class="lead">${L("Monsha'at refunds SMEs their paid government fees (registration until 31 Dec 2026, payouts through 2028). Eligibility isn't a one-time checkbox — it's continuous compliance: one expired certificate or a Nitaqat slip stops your payment. That's exactly why you need an operating partner.", "منشآت تعيد للمنشآت الصغيرة والمتوسطة رسومها الحكومية المدفوعة (التسجيل حتى 31 ديسمبر 2026 والصرف حتى 2028). الاستحقاق ليس شرطاً يتحقق مرة واحدة — بل امتثال مستمر: شهادة منتهية أو نزول في النطاقات يوقف دفعتك. وهذا بالضبط سبب حاجتك لشريك تشغيل.")}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#estrdad-form">${L("Assess my eligibility & prepare my file", "قيّم أهليتي وجهّز ملفي")}</a><a class="btn btn-ghost btn-lg" href="https://estrdad.monshaat.gov.sa/home" target="_blank" rel="noopener">${L("Official initiative page ↗", "صفحة المبادرة الرسمية ↗")}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Registration until 31 Dec 2026", "التسجيل حتى 31 ديسمبر 2026")}</span>
      <span class="hero-badge">${I.check}${L("Payouts through 2028", "الصرف مستمر حتى 2028")}</span>
      <span class="hero-badge">${I.check}${L("80% of the expat levy included", "تشمل 80% من المقابل المالي")}</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("What you get back", "ما الذي تسترده")}</span><h2>${L("Fees covered by the initiative", "الرسوم المشمولة بالمبادرة")}</h2><p>${L("Fees already waived under other government programs are excluded.", "لا تشمل المبادرة رسوماً أُعفيت منها منشأتك عبر برامج حكومية أخرى.")}</p></div>
    <ul class="feat-list" style="max-width:860px;margin:0 auto">${fees}</ul>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("The catch", "الشرط الحقيقي")}</span><h2>${L("Your refund lives and dies on compliance", "استردادك يعيش ويموت على امتثالك")}</h2><p>${L("These are the official conditions — and the most common reasons payments get cut off:", "هذه الاشتراطات الرسمية — وأكثر أسباب قطع الدفعات شيوعاً:")}</p></div>
    <div class="grid grid-3">${conds}</div>
  </div></section>

  <section class="section section--navy"><div class="container">
    <div class="section-head"><span class="eyebrow" style="background:rgba(255,255,255,.15);color:#fff">${L("Why Business Partner", "ليش بيزنس بارتنر")}</span><h2 style="color:#fff">${L("This is literally why we exist as your operating partner", "هذا حرفياً سبب وجودنا كشريك تشغيلك")}</h2><p style="color:rgba(255,255,255,.85)">${L("We don't just submit your Estrdad request — we keep your establishment refund-eligible every single day through 2028.", "نحن لا نقدّم طلب الاسترداد فقط — نحن نُبقي منشأتك مستحقة للاسترداد كل يوم حتى 2028.")}</p></div>
    <div class="grid grid-2">${helps}</div>
  </div></section>

  <section class="section" id="estrdad-form"><div class="container" style="max-width:920px">
    <div class="section-head"><h2>${L("Start: eligibility assessment + file preparation", "ابدأ: تقييم الأهلية + تجهيز الملف")}</h2><p>${L("Send your establishment's details — we assess your eligibility against the official conditions and come back with your compliance gaps and the full plan.", "أرسل بيانات منشأتك — نقيّم أهليتك وفق الاشتراطات الرسمية ونعود لك بفجوات الامتثال والخطة الكاملة.")}</p></div>
    <div class="order-box">
      <form id="estrdad-form-el" novalidate>
        <div class="cc-grid">
          <div class="field"><label for="es-company">${L("Establishment name", "اسم المنشأة")} *</label><input type="text" id="es-company" required></div>
          <div class="field"><label for="es-person">${L("Contact person", "اسم المسؤول")} *</label><input type="text" id="es-person" required></div>
          <div class="field"><label for="es-phone">${L("Mobile", "الجوال")} *</label><input type="tel" id="es-phone" placeholder="05XXXXXXXX" required></div>
          <div class="field"><label for="es-email">${L("Email", "البريد الإلكتروني")} *</label><input type="email" id="es-email" required></div>
          <div class="field"><label for="es-start">${L("Activity start year", "سنة بدء النشاط")}</label><select id="es-start"><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option><option value="before">${Lraw("Before 2024", "قبل 2024")}</option></select></div>
          <div class="field"><label for="es-workers">${L("Expat workers count (for the 80% levy refund)", "عدد العمالة الأجنبية (لاسترداد 80% من المقابل المالي)")}</label><input type="number" id="es-workers" min="0" placeholder="10"></div>
        </div>
        <div class="field"><label for="es-notes">${L("Notes (licenses, Nitaqat status…)", "ملاحظات (التراخيص، وضع النطاقات…)")}</label><textarea id="es-notes" rows="3"></textarea></div>
        <button type="submit" class="btn btn-primary btn-lg">${L("Assess my eligibility", "قيّم أهليتي")}</button>
        <div class="form-success" id="estrdad-success" hidden></div>
      </form>
    </div>
    <div class="callout" style="margin-top:20px"><span class="ico">⚖️</span><p>${L("Estrdad is a Monsha'at initiative and requests are submitted on its official portal; Business Partner prepares your file, keeps you compliant and follows your request — we are not the disbursing authority.", "«استرداد» مبادرة من هيئة منشآت والتقديم عبر بوابتها الرسمية؛ بيزنس بارتنر يجهّز ملفك ويحافظ على امتثالك ويتابع طلبك — ولسنا الجهة الصارفة.")}</p></div>
  </div></section>`;
  return page({ title: Lraw("Reclaim government fees (Estrdad) — Business Partner", "استرداد الرسوم الحكومية (مبادرة استرداد) — بيزنس بارتنر"), desc: Lraw("Monsha'at refunds SME government fees — if you stay compliant. We keep you eligible and handle the file.", "منشآت تعيد رسومك الحكومية — بشرط الامتثال المستمر. نُبقيك مستحقاً ونجهّز ملفك كاملاً."), active: "/estrdad", path: "/estrdad", body });
}

// ---------- دليل السعودية (Saudi Guide) — knowledge-hub pillars ----------
// Content sourced via multi-agent WebSearch research (July 2026). Direct
// WebFetch to .gov.sa domains is blocked in this build environment, so every
// fact below is WebSearch-snippet-derived from official sources or reputable
// secondary sources (Big-4/law-firm tax alerts, SPA, GASTAT, PIF, ZATCA,
// HRSD). Genuinely uncertain/conflicting figures carry an inline ⚠️ caveat
// instead of being stated as flat fact — never silently pick a side.
function guideBlock({ eyebrowEn, eyebrowAr, titleEn, titleAr, leadEn, leadAr, bullets, caveatEn, caveatAr, gray, id }) {
  const items = bullets.map((b) => `<li>${I.check}<span>${L(b[0], b[1])}</span></li>`).join("");
  return `<section class="section${gray ? " section--gray" : ""}"${id ? ` id="${id}"` : ""}><div class="container">
    <div class="section-head"><span class="eyebrow">${L(eyebrowEn, eyebrowAr)}</span><h2>${L(titleEn, titleAr)}</h2><p>${L(leadEn, leadAr)}</p></div>
    <ul class="feat-list" style="max-width:900px;margin:0 auto">${items}</ul>
    ${caveatEn ? `<div class="callout" style="max-width:900px;margin:24px auto 0"><span class="ico">⚠️</span><p>${L(caveatEn, caveatAr)}</p></div>` : ""}
  </div></section>`;
}
function guideHero({ eyebrowEn, eyebrowAr, titleEn, titleAr, leadEn, leadAr }) {
  return `<section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L(eyebrowEn, eyebrowAr)}</span>
    <h1>${L(titleEn, titleAr)}</h1>
    <p class="lead">${L(leadEn, leadAr)}</p>
    <div class="hero-actions">${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-primary")}<a class="btn btn-ghost" href="${u("/consultation")}">${L("Book a consultation", "احجز استشارة")}</a></div>
  </div></section>`;
}
const guideDisclaimer = () => `<div class="callout" style="max-width:900px;margin:32px auto 0"><span class="ico">📌</span><p>${L("Government rules, fees and programs change often. This guide is a starting reference — always confirm current figures with the official portal or ask our smart agent before relying on a specific number.", "الأنظمة والرسوم والبرامج الحكومية تتغيّر بشكل متكرر. هذا الدليل مرجع أولي — تأكد دائماً من الأرقام الحالية عبر البوابة الرسمية أو اسأل الوكيل الذكي قبل الاعتماد على رقم محدد.")}</p></div>`;
// Sticky in-page jump-nav for the long guide pages. `items` are [id, en, ar]
// tuples matching the `id` of each guideBlock section on the same page.
function guideNav(items) {
  const links = items.map(([id, en, ar]) => `<a href="#${id}" data-guide-link>${L(en, ar)}</a>`).join("");
  return `<nav class="guide-nav" aria-label="${Lraw("On this page", "في هذه الصفحة")}"><div class="container guide-nav-inner">${links}</div></nav>`;
}

// Related Business Partner service categories for a guide page. `cats` are
// category keys from data/categories.json — we link to each category's page so
// the guide's government-platform mentions map to services we actually offer.
function guideRelated(cats) {
  const cards = cats.map((key) => `<a class="card svc-card" href="${catUrl(key)}">
    <h3>${L(catEn(key), catAr(key))}</h3>
    <span class="card-link">${L("Explore services", "استعرض الخدمات")} ${I.arrow}</span></a>`).join("");
  return `<section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How we help", "كيف نساعدك")}</span><h2>${L("Business Partner services for this stage", "خدمات بزنس بارتنر لهذه المرحلة")}</h2><p>${L("We handle the government platforms and paperwork above — end to end.", "نتولّى المنصات الحكومية والإجراءات المذكورة أعلاه — من البداية للنهاية.")}</p></div>
    <div class="grid grid-3" style="max-width:980px;margin:0 auto">${cards}</div>
  </div></section>`;
}

// Cross-links between the Saudi-guide pages (and /saudi-arabia) so every guide
// points to its siblings.
const GUIDE_PAGES = [
  ["/saudi-arabia", "Invest in Saudi", "الاستثمار في السعودية"],
  ["/guide/saudi-market", "The Saudi Market", "السوق السعودي"],
  ["/guide/business-setup", "Business Setup", "تأسيس الأعمال"],
  ["/guide/run-your-business", "Run Your Business", "تشغيل عملك"],
  ["/guide/live-in-saudi", "Live in Saudi", "الحياة في السعودية"],
  ["/guide/residency", "Residency in KSA", "الإقامة في السعودية"],
];
function guideCrossLinks(currentPath) {
  const links = GUIDE_PAGES.filter(([p]) => p !== currentPath).map(([p, en, ar]) =>
    `<a class="card guide-xlink" href="${u(p)}"><span>${L(en, ar)}</span>${I.arrow}</a>`).join("");
  return `<section class="section"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("Saudi Guide", "دليل السعودية")}</span><h2>${L("Continue exploring the guide", "تابع استكشاف الدليل")}</h2></div>
    <div class="grid grid-3" style="max-width:980px;margin:0 auto">${links}</div>
  </div></section>`;
}

function buildGuideSaudiMarket() {
  const body =
    guideHero({
      eyebrowEn: "The Saudi Market", eyebrowAr: "السوق السعودي",
      titleEn: "Where the Saudi economy is heading", titleAr: "إلى أين يتجه الاقتصاد السعودي",
      leadEn: "GDP size, Vision 2030's giga-projects, and the practical culture-and-business norms every foreign company should plan around — sourced and updated regularly.",
      leadAr: "حجم الاقتصاد، مشاريع رؤية 2030 العملاقة، وأعراف ثقافة العمل العملية التي يحتاجها كل مستثمر أجنبي — بمصادر موثقة ومحدّثة دورياً.",
    }) +
    guideNav([
      ["economy", "The economy", "الاقتصاد"],
      ["giga-projects", "Giga-projects", "المشاريع العملاقة"],
      ["culture-business", "Culture & business", "الثقافة والأعمال"],
    ]) +
    guideBlock({
      id: "economy",
      eyebrowEn: "The economy", eyebrowAr: "الاقتصاد",
      titleEn: "The Saudi economy at a glance", titleAr: "الاقتصاد السعودي في لمحة",
      leadEn: "The largest economy in the Middle East and the G20's only Arab member — diversifying fast away from oil.", leadAr: "أكبر اقتصاد في الشرق الأوسط والعضو العربي الوحيد في مجموعة العشرين — يتنوّع بسرعة بعيداً عن النفط.",
      bullets: [
        ["Nominal GDP of roughly $1.24–1.25 trillion (2024) — World Bank / IMF.", "ناتج محلي إجمالي اسمي نحو 1.24–1.25 تريليون دولار (2024) — البنك الدولي / صندوق النقد الدولي."],
        ["GASTAT reported 4.5% real GDP growth for full-year 2025, driven by oil, non-oil and government activities.", "أعلنت الهيئة العامة للإحصاء نمواً حقيقياً بنسبة 4.5% للناتج المحلي في 2025، مدفوعاً بالأنشطة النفطية وغير النفطية والحكومية."],
        ["Non-oil activities reached roughly 55% of real GDP in 2025 per official Vision 2030 reporting.", "بلغت الأنشطة غير النفطية نحو 55% من الناتج المحلي الحقيقي في 2025 بحسب تقارير رؤية 2030 الرسمية."],
        ["Inflation has run low and stable, around 1.9%–2.3% through 2025 (GASTAT CPI).", "التضخم منخفض ومستقر، بين 1.9%–2.3% خلال 2025 (مؤشر أسعار المستهلك من الهيئة العامة للإحصاء)."],
        ["FDI inflows rose 24.2% year-on-year to about SAR 119.2 billion (~$31.7B) in 2024 — still below the government's $100B/year 2030 target.", "ارتفعت تدفقات الاستثمار الأجنبي المباشر 24.2% لتبلغ نحو 119.2 مليار ريال (~31.7 مليار دولار) في 2024 — لا تزال أقل من مستهدف 100 مليار دولار سنوياً بحلول 2030."],
        ["VAT introduced in 2018 at 5%, raised to 15% since 1 July 2020, administered by ZATCA with mandatory e-invoicing (FATOORA).", "طُبّقت ضريبة القيمة المضافة 2018 بنسبة 5% ورُفعت إلى 15% منذ 1 يوليو 2020، وتديرها هيئة الزكاة والضريبة والجمارك مع الفوترة الإلكترونية الإلزامية (فاتورة)."],
        ["The Public Investment Fund's assets reached roughly SAR 4.54 trillion (~$1.21 trillion) by end-2025 — the primary vehicle behind the giga-projects.", "بلغت أصول صندوق الاستثمارات العامة نحو 4.54 تريليون ريال (~1.21 تريليون دولار) بنهاية 2025 — وهو الذراع الرئيسية وراء المشاريع العملاقة."],
        ["Sovereign credit ratings as of 2025: S&P A+, Fitch A+, Moody's Aa3 — all stable/positive outlook.", "التصنيفات الائتمانية السيادية حتى 2025: S&P عند A+، وفيتش A+، وموديز Aa3 — بنظرة مستقبلية مستقرة."],
        ["Female labor-force participation rose from ~17% (2017) to ~36% (2024/2025), already exceeding the original 30%-by-2030 target.", "ارتفعت مشاركة المرأة في القوى العاملة من ~17% (2017) إلى ~36% (2024/2025)، متجاوزة المستهدف الأصلي البالغ 30% بحلول 2030."],
      ],
    }) +
    guideBlock({
      gray: true, id: "giga-projects",
      eyebrowEn: "Vision 2030", eyebrowAr: "رؤية 2030",
      titleEn: "The giga-projects", titleAr: "المشاريع العملاقة",
      leadEn: "PIF-backed developments reshaping tourism, real estate and urban life. Several have opened in phases through 2025–2026; some (especially NEOM) have seen publicly reported scope changes — treat headline figures as evolving.", leadAr: "مشاريع بدعم من صندوق الاستثمارات العامة تعيد تشكيل السياحة والعقار والحياة الحضرية. افتُتح بعضها على مراحل خلال 2025-2026؛ وشهد بعضها (خصوصاً نيوم) تغييرات مُعلنة في النطاق — تعامل مع الأرقام الرئيسية على أنها متطورة.",
      bullets: [
        ["NEOM: announced 2017 at $500B, covering THE LINE, Oxagon and Trojena. Recent press reports scope reductions and delays to THE LINE — treat specific revised figures as unconfirmed.", "نيوم: أُعلن 2017 بقيمة 500 مليار دولار، ويشمل ذا لاين وأوكساجون وتروجينا. تقارير صحفية حديثة تشير لتقليص نطاق \"ذا لاين\" وتأخيرات — تعامل مع الأرقام المُعدّلة المحددة كغير مؤكدة."],
        ["Qiddiya: PIF-owned entertainment/sports city near Riyadh. Six Flags Qiddiya City opened 31 December 2025 (28 rides). Official targets: 48 million visitors/year and 325,000 jobs by 2030.", "قدية: مدينة ترفيهية ورياضية بملكية صندوق الاستثمارات العامة قرب الرياض. افتتحت Six Flags قدية سيتي في 31 ديسمبر 2025 (28 لعبة). المستهدفات الرسمية: 48 مليون زائر سنوياً و325,000 وظيفة بحلول 2030."],
        ["The Red Sea Project / AMAALA (Red Sea Global): ultra-luxury coastal tourism, opened in phases through 2025. Official targets: up to 9 resorts, ~50,000 jobs, 100% renewable energy.", "مشروع البحر الأحمر / أمالا (ريد سي جلوبال): سياحة ساحلية فاخرة افتُتحت على مراحل خلال 2025. المستهدفات الرسمية: حتى 9 منتجعات، نحو 50,000 وظيفة، طاقة متجددة 100%."],
        ["Diriyah Gate: heritage/cultural megaproject around At-Turaif (UNESCO World Heritage Site). Officially cited masterplan value ~$63B; Bujairi Terrace dining district is operational.", "بوابة الدرعية: مشروع تراثي وثقافي حول حي الطريف (موقع يونسكو للتراث العالمي). القيمة المعلنة للمخطط الرئيسي نحو 63 مليار دولار؛ حي بجيري للمطاعم يعمل حالياً."],
        ["ROSHN: PIF's giga real-estate developer (est. 2020), land bank over 200 million m². Flagship SEDRA community in Riyadh is delivering homes; supports Vision 2030's 70% homeownership target.", "روشن: المطوّر العقاري العملاق لصندوق الاستثمارات العامة (تأسس 2020)، برصيد أراضٍ يتجاوز 200 مليون م². مجتمع سدرة الرائد في الرياض يسلّم الوحدات؛ يدعم مستهدف تملك المساكن 70% ضمن رؤية 2030."],
        ["King Salman Park: on the site of Riyadh's former domestic airport, aiming to be the world's largest urban park; targets Riyadh's green space rising from 1.5% to 9.1%, mostly by 2030.", "منتزه الملك سلمان: على موقع مطار الرياض المحلي السابق، ويهدف لأن يكون أكبر متنزه حضري في العالم؛ يستهدف رفع المساحات الخضراء في الرياض من 1.5% إلى 9.1%، ومعظمه بحلول 2030."],
        ["New Murabba: 19 km² downtown Riyadh development (incl. The Mukaab landmark). Officially stated plans: 104,000 residential units, 9,000 hotel rooms, ~400,000 residents.", "نيو مربع: مشروع بمساحة 19 كم² في وسط الرياض (يشمل معلم المكعب). الخطط المعلنة رسمياً: 104,000 وحدة سكنية، 9,000 غرفة فندقية، نحو 400,000 نسمة."],
      ],
      caveatEn: "Several cost/timeline figures reported in the press for New Murabba, King Salman Park and Qiddiya (and NEOM's leaked cost/timeline) are market estimates or unconfirmed press reports, not official PIF disclosures — we present only the officially stated targets above and flag the rest as unverified.",
      caveatAr: "بعض أرقام التكلفة والجداول الزمنية المتداولة صحفياً لنيو مربع ومنتزه الملك سلمان وقدية (وتقارير مُسرّبة عن نيوم) هي تقديرات سوقية أو تقارير صحفية غير مؤكدة، وليست إفصاحات رسمية من صندوق الاستثمارات العامة — نعرض هنا المستهدفات المعلنة رسمياً فقط ونشير لما عداها كغير مؤكد.",
    }) +
    guideBlock({
      id: "culture-business",
      eyebrowEn: "Culture & business", eyebrowAr: "الثقافة والأعمال",
      titleEn: "Business etiquette & the working week", titleAr: "أعراف العمل وأسبوع الدوام",
      leadEn: "Practical norms for a foreign company operating day-to-day in Saudi Arabia.", leadAr: "أعراف عملية لأي شركة أجنبية تدير عملها يومياً في السعودية.",
      bullets: [
        ["The working week is Sunday–Thursday, Friday–Saturday weekend — set by royal order since June 2013 to align with global markets.", "أسبوع العمل من الأحد إلى الخميس، وعطلة نهاية الأسبوع الجمعة والسبت — بموجب أمر ملكي منذ يونيو 2013 لمواءمة الأسواق العالمية."],
        ["Standard working hours are 8 hours/day or 48 hours/week under Saudi Labor Law.", "ساعات العمل النظامية 8 ساعات يومياً أو 48 ساعة أسبوعياً بموجب نظام العمل السعودي."],
        ["During Ramadan, working hours for fasting Muslim employees are legally capped at 6 hours/day (36 hours/week) — Labor Law Article 98.", "خلال رمضان، ساعات العمل للموظفين المسلمين الصائمين محددة نظاماً بـ6 ساعات يومياً (36 ساعة أسبوعياً) — المادة 98 من نظام العمل."],
        ["Key public holidays affecting business: Founding Day (22 Feb), Saudi National Day (23 Sep), and Eid al-Fitr / Eid al-Adha (dates set by the Hijri calendar).", "أهم الإجازات الرسمية المؤثرة على الأعمال: يوم التأسيس (22 فبراير)، اليوم الوطني السعودي (23 سبتمبر)، وعيدا الفطر والأضحى (بحسب التقويم الهجري)."],
        ["Gender-mixing restrictions in workplaces have relaxed considerably since 2017; 2024/2025 Labor Law amendments explicitly prohibit gender-based employment discrimination.", "قيود اختلاط الجنسين في أماكن العمل تراجعت بشكل ملحوظ منذ 2017؛ وتعديلات نظام العمل 2024/2025 تحظر صراحة التمييز الوظيفي القائم على الجنس."],
        ["Arabic is the official language and legally required in contracts and commercial dealings; English is very widely used in business settings.", "العربية هي اللغة الرسمية ومطلوبة نظاماً في العقود والتعاملات التجارية؛ والإنجليزية مستخدمة بشكل واسع جداً في بيئة الأعمال."],
      ],
    }) + guideRelated(["Foreign Investment", "Company Formation"]) + guideCrossLinks("/guide/saudi-market") + guideDisclaimer();
  return page({ title: Lraw("The Saudi Market — Business Partner", "السوق السعودي — بيزنس بارتنر"), desc: Lraw("The Saudi economy, Vision 2030 giga-projects, and business culture — sourced guide for foreign investors.", "الاقتصاد السعودي ومشاريع رؤية 2030 العملاقة وثقافة الأعمال — دليل موثق للمستثمرين الأجانب."), active: "/guide/saudi-market", path: "/guide/saudi-market", body });
}

function buildGuideBusinessSetup() {
  const body =
    guideHero({
      eyebrowEn: "Business Setup", eyebrowAr: "تأسيس الأعمال",
      titleEn: "How to set up a company in Saudi Arabia", titleAr: "كيف تؤسس شركة في السعودية",
      leadEn: "The real registration sequence, the 8 MISA license types, Special Economic Zones and the RHQ program — with every figure source-flagged.", leadAr: "تسلسل التسجيل الفعلي، وأنواع تراخيص وزارة الاستثمار الثمانية، والمناطق الاقتصادية الخاصة وبرنامج المقر الإقليمي — مع توثيق مصدر كل رقم.",
    }) +
    guideNav([
      ["process", "Setup process", "خطوات التأسيس"],
      ["licenses", "License types", "أنواع التراخيص"],
      ["sez", "Economic Zones", "المناطق الاقتصادية"],
      ["rhq", "RHQ program", "المقر الإقليمي"],
      ["national-address", "National address", "العنوان الوطني"],
      ["activities", "Activity codes", "تصنيف الأنشطة"],
    ]) +
    guideBlock({
      id: "process",
      eyebrowEn: "Step by step", eyebrowAr: "خطوة بخطوة",
      titleEn: "Company setup process", titleAr: "خطوات تأسيس الشركة",
      leadEn: "A foreign investor's registration chain — most steps are digital and several are auto-triggered once your CR is issued.", leadAr: "سلسلة تسجيل المستثمر الأجنبي — معظم الخطوات رقمية، وبعضها يُفعّل تلقائياً فور صدور السجل التجاري.",
      bullets: [
        ["1) Investment license from the Ministry of Investment (MISA) — select your ISIC-coded activity and legal structure (LLC most common).", "1) رخصة استثمار من وزارة الاستثمار (MISA) — اختيار النشاط المصنّف ISIC والشكل القانوني (الشركة ذات المسؤولية المحدودة الأكثر شيوعاً)."],
        ["2) Commercial Registration (CR) via the Saudi Business Center — this single step auto-registers you with HRSD/Qiwa, ZATCA, GOSI, Saudi Post and the Chamber of Commerce.", "2) السجل التجاري عبر المركز السعودي للأعمال — هذه الخطوة الواحدة تسجّلك تلقائياً لدى وزارة الموارد البشرية (قوى) والزكاة والضريبة والتأمينات الاجتماعية والبريد السعودي والغرفة التجارية."],
        ["3) National address registration (Saudi Post/SPL) — can be completed during CR issuance.", "3) تسجيل العنوان الوطني (البريد السعودي) — يمكن إتمامه أثناء إصدار السجل التجاري."],
        ["4) Municipal (Baladiya) license via the Balady platform, once you have a physical premises — requires an Ejar-registered lease.", "4) الرخصة البلدية عبر منصة بلدي، بعد توفر مقر فعلي — تتطلب عقد إيجار موثّقاً في إيجار."],
        ["5) GOSI activation and Qiwa/HRSD registration for employee social insurance and Saudization compliance.", "5) تفعيل التأمينات الاجتماعية والتسجيل في قوى/وزارة الموارد البشرية للتأمين على الموظفين وامتثال السعودة."],
        ["6) Bank account opening — typically the GM's personal account first, then the company account.", "6) فتح الحساب البنكي — عادة حساب المدير العام الشخصي أولاً ثم حساب الشركة."],
      ],
      caveatEn: "Under Saudi Arabia's new Investment Law (reported effective ~Feb 2025), MISA is reportedly replacing the traditional \"Foreign Investment License\" with a unified \"Investment Registration Certificate\" — a material terminology shift we're tracking. Realistic full setup timelines vary widely by activity (commonly reported 1–6 months in practice) and are not an official published SLA.", caveatAr: "بموجب نظام الاستثمار الجديد (المفعّل تقريباً منذ فبراير 2025)، تشير التقارير إلى أن وزارة الاستثمار تستبدل \"رخصة الاستثمار الأجنبي\" التقليدية بـ\"شهادة تسجيل الاستثمار\" الموحدة — وهو تغيير مصطلحات جوهري نتابعه. الجدول الزمني الفعلي للتأسيس الكامل يتفاوت بشدة حسب النشاط (يُذكر عادة 1-6 أشهر عملياً) وليس مدة معتمدة رسمياً منشورة.",
    }) +
    guideBlock({
      gray: true, id: "licenses",
      eyebrowEn: "License types", eyebrowAr: "أنواع التراخيص",
      titleEn: "The 8 MISA business license types", titleAr: "أنواع التراخيص التجارية الثمانية",
      leadEn: "Which license gates what a foreign-owned entity may legally do.", leadAr: "أي رخصة تحدد ما يحق للكيان المملوك أجنبياً القيام به قانونياً.",
      bullets: [
        ["Service License — the broadest category: IT/software, consulting, marketing, F&B and general professional services.", "الرخصة الخدمية — الأوسع انتشاراً: تقنية المعلومات، الاستشارات، التسويق، المطاعم والخدمات المهنية العامة."],
        ["Entrepreneurial License — for startups, requires an endorsement letter from a MISA-recognized incubator/accelerator.", "الرخصة الريادية — للشركات الناشئة، تتطلب خطاب تزكية من حاضنة أو مسرّعة معتمدة من وزارة الاستثمار."],
        ["Industrial License — for manufacturing, jointly regulated with the Ministry of Industry and Mineral Resources.", "الرخصة الصناعية — للتصنيع، تُنظّم بالاشتراك مع وزارة الصناعة والثروة المعدنية."],
        ["Agricultural License — for farming, cultivation and livestock activities.", "الرخصة الزراعية — لأنشطة الزراعة والمحاصيل والثروة الحيوانية."],
        ["Real Estate (Development) License — reported minimum project investment SAR 30 million, outside Mecca/Medina boundaries.", "الرخصة العقارية (التطوير) — الحد الأدنى المُبلّغ عنه لاستثمار المشروع 30 مليون ريال، خارج حدود مكة والمدينة."],
        ["Trading (Commercial) License — import/export and wholesale/retail; reported capital figures vary by source (SAR 26–30 million range).", "الرخصة التجارية — الاستيراد والتصدير والبيع بالجملة والتجزئة؛ الأرقام المُبلّغ عنها لرأس المال تتفاوت حسب المصدر (نطاق 26-30 مليون ريال)."],
        ["Mining License — for mining activities; applicant entity typically must be established abroad for at least 1 year.", "رخصة التعدين — لأنشطة التعدين؛ عادة يُشترط تأسيس الكيان المتقدم خارج المملكة لمدة سنة على الأقل."],
        ["Professional License — for specific consulting fields (engineering, marine, mining consulting); one of the only categories requiring a Saudi partner (≥25%).", "الرخصة المهنية — لمجالات استشارية محددة (هندسية، بحرية، استشارات تعدين)؛ من الفئات القليلة التي تتطلب شريكاً سعودياً (25% فأكثر)."],
      ],
      caveatEn: "Specific SAR capital-requirement figures above vary across secondary sources and could not be confirmed against a primary MISA page in this research pass — treat every number here as indicative and confirm current requirements directly with MISA or our team before budgeting your setup.", caveatAr: "أرقام رأس المال المذكورة أعلاه تتفاوت بين المصادر الثانوية ولم نتمكن من تأكيدها من صفحة رسمية مباشرة لوزارة الاستثمار في هذا البحث — تعامل مع كل رقم هنا كإرشادي، وتأكد من المتطلبات الحالية مباشرة مع الوزارة أو فريقنا قبل وضع ميزانية التأسيس.",
    }) +
    guideBlock({
      id: "sez",
      eyebrowEn: "Special Economic Zones", eyebrowAr: "المناطق الاقتصادية الخاصة",
      titleEn: "Saudi Arabia's Special Economic Zones", titleAr: "المناطق الاقتصادية الخاصة في السعودية",
      leadEn: "Four zones launched by ECZA on 13 April 2023, plus a fifth logistics zone governed by GACA — each with its own sector focus and tax incentives.", leadAr: "أربع مناطق أطلقتها هيئة المدن الاقتصادية والمناطق الخاصة في 13 أبريل 2023، بالإضافة لمنطقة لوجستية خامسة تُدار من الهيئة العامة للطيران المدني — لكل منها تركيز قطاعي وحوافز ضريبية.",
      bullets: [
        ["King Abdullah Economic City (KAEC) SEZ — advanced manufacturing, automotive, ICT, pharma/MedTech and logistics.", "منطقة مدينة الملك عبدالله الاقتصادية — التصنيع المتقدم، السيارات، تقنية المعلومات، الأدوية والتقنيات الطبية واللوجستيات."],
        ["Ras Al-Khair SEZ — maritime industries, shipbuilding, rig/platform maintenance.", "منطقة رأس الخير — الصناعات البحرية وبناء السفن وصيانة المنصات."],
        ["Jazan SEZ — a trade gateway to Africa; food processing, metals conversion, logistics.", "منطقة جازان — بوابة تجارية لأفريقيا؛ تصنيع الأغذية وتحويل المعادن واللوجستيات."],
        ["Cloud Computing SEZ — a \"virtual\" zone headquartered at KACST in Riyadh; data centers, AI and cybersecurity, 100% foreign ownership without a local partner.", "منطقة الحوسبة السحابية — منطقة \"افتراضية\" مقرها مدينة الملك عبدالعزيز للعلوم والتقنية بالرياض؛ مراكز بيانات وذكاء اصطناعي وأمن سيبراني، بتملك أجنبي كامل دون شريك محلي."],
        ["Special Integrated Logistics Zone (SILZ, Riyadh Airport) — warehousing, distribution and re-export logistics; governed by GACA, not ECZA.", "المنطقة اللوجستية المتكاملة الخاصة (مطار الرياض) — التخزين والتوزيع ولوجستيات إعادة التصدير؛ تُدار من الهيئة العامة للطيران المدني وليس هيئة المدن الاقتصادية."],
        ["ECZA-zone incentives commonly reported: 5% corporate income tax for up to 20 years, 0% withholding tax, and customs/VAT relief on qualifying goods.", "الحوافز المُبلّغ عنها للمناطق التابعة للهيئة: ضريبة دخل مؤسسي 5% لمدة تصل إلى 20 عاماً، ضريبة استقطاع 0%، وإعفاءات جمركية وضريبة قيمة مضافة على السلع المؤهلة."],
        ["SILZ incentive commonly reported: 0% income tax for up to 50 years on eligible zone-activity income.", "حافز المنطقة اللوجستية المُبلّغ عنه: ضريبة دخل 0% لمدة تصل إلى 50 عاماً على دخل الأنشطة المؤهلة داخل المنطقة."],
      ],
    }) +
    guideBlock({
      gray: true, id: "rhq",
      eyebrowEn: "Regional Headquarters", eyebrowAr: "المقر الإقليمي",
      titleEn: "The RHQ program", titleAr: "برنامج المقر الإقليمي (RHQ)",
      leadEn: "MISA's program to bring multinational regional headquarters to Riyadh — a real, officially announced 30-year tax incentive.", leadAr: "برنامج وزارة الاستثمار لجذب المقرات الإقليمية للشركات متعددة الجنسيات إلى الرياض — حافز ضريبي حقيقي ومُعلن رسمياً لمدة 30 عاماً.",
      bullets: [
        ["Eligibility: a multinational corporation with operations in at least two countries other than Saudi Arabia and its home country.", "الأهلية: شركة متعددة الجنسيات لديها عمليات في دولتين على الأقل غير السعودية ودولة المقر الأم."],
        ["Incentive: 0% corporate income tax and 0% withholding tax on RHQ-eligible activities for 30 years from license grant, renewable — officially announced by MISA/ZATCA/Ministry of Finance (5 Dec 2023).", "الحافز: ضريبة دخل مؤسسي 0% وضريبة استقطاع 0% على الأنشطة المؤهلة للمقر الإقليمي لمدة 30 عاماً من منح الترخيص، قابلة للتجديد — أُعلنت رسمياً من وزارة الاستثمار والزكاة والضريبة ووزارة المالية (5 ديسمبر 2023)."],
        ["Substance requirements: at least 3 executives within the first year, minimum 15 employees within one year, at least one Kingdom-resident executive.", "متطلبات الجوهر الاقتصادي: 3 مسؤولين تنفيذيين على الأقل خلال السنة الأولى، وحد أدنى 15 موظفاً خلال سنة، ومسؤول تنفيذي واحد مقيم في المملكة على الأقل."],
        ["Since 1 January 2024, multinationals eligible for RHQ status but without a licensed RHQ generally cannot contract with Saudi government entities (limited exemptions exist, e.g. contracts under SAR 1 million).", "منذ 1 يناير 2024، الشركات متعددة الجنسيات المؤهلة لبرنامج المقر الإقليمي ولكن دون ترخيص فعلي لا يمكنها عموماً التعاقد مع الجهات الحكومية السعودية (مع استثناءات محدودة، مثل العقود أقل من مليون ريال)."],
      ],
    }) +
    guideBlock({
      id: "national-address",
      eyebrowEn: "National address", eyebrowAr: "العنوان الوطني",
      titleEn: "National address for business", titleAr: "العنوان الوطني للمنشآت",
      leadEn: "Saudi Post's standardized addressing system — your establishment's official legal address of record.", leadAr: "نظام العنونة الموحد من البريد السعودي — العنوان القانوني الرسمي المسجّل لمنشأتك.",
      bullets: [
        ["Mandatory for businesses operating in the Kingdom — required for contracts, licenses and official correspondence.", "إلزامي للمنشآت العاملة في المملكة — مطلوب للعقود والتراخيص والمراسلات الرسمية."],
        ["Registered via the Saudi Business Center during CR issuance, or separately via the Saudi Post (SPL) portal using your CR number.", "يُسجَّل عبر المركز السعودي للأعمال أثناء إصدار السجل التجاري، أو منفصلاً عبر بوابة البريد السعودي باستخدام رقم السجل التجاري."],
        ["Renews annually; new companies are commonly reported as exempt from the subscription fee in the first year.", "يُجدَّد سنوياً؛ وتُعفى الشركات الجديدة عادةً من رسوم الاشتراك في السنة الأولى بحسب المصادر المتاحة."],
      ],
    }) +
    guideBlock({
      gray: true, id: "activities",
      eyebrowEn: "Activity classification", eyebrowAr: "تصنيف الأنشطة",
      titleEn: "Check your business activity code", titleAr: "تحقق من رمز نشاطك التجاري",
      leadEn: "Every Commercial Registration must specify one or more coded activities from Saudi Arabia's national classification, based on the UN's ISIC system.", leadAr: "كل سجل تجاري يجب أن يحدد نشاطاً واحداً أو أكثر مصنّفاً وفق التصنيف الوطني السعودي، المبني على نظام ISIC الأممي.",
      bullets: [
        ["The national classification covers 2,800+ distinct economic activities, coded per ISIC Revision 4.", "يغطي التصنيف الوطني أكثر من 2,800 نشاط اقتصادي مختلف، مصنّفة وفق المراجعة الرابعة لنظام ISIC."],
        ["The Saudi Business Center offers a public \"Assisted Inquiry\" e-service to search for the correct activity/code before or during CR registration.", "يوفّر المركز السعودي للأعمال خدمة \"الاستعلام المساعد\" الإلكترونية للبحث عن النشاط أو الرمز الصحيح قبل أو أثناء تسجيل السجل التجاري."],
        ["Foreign-ownership eligibility per activity is checked separately, against MISA's list of restricted/excluded activities — not shown inline in the activity lookup itself.", "أهلية التملك الأجنبي لكل نشاط تُفحص بشكل منفصل، وفق قائمة وزارة الاستثمار للأنشطة المقيّدة أو المستثناة — ولا تظهر ضمن أداة البحث عن النشاط نفسها."],
      ],
    }) + guideRelated(["Company Formation", "Foreign Investment", "Premium Residency"]) + guideCrossLinks("/guide/business-setup") + guideDisclaimer();
  return page({ title: Lraw("Business Setup in Saudi Arabia — Business Partner", "تأسيس الأعمال في السعودية — بيزنس بارتنر"), desc: Lraw("The real company-setup process, all 8 MISA license types, Special Economic Zones and the RHQ program.", "خطوات التأسيس الفعلية، وأنواع التراخيص الثمانية، والمناطق الاقتصادية الخاصة وبرنامج المقر الإقليمي."), active: "/guide/business-setup", path: "/guide/business-setup", body });
}

function buildGuideRunBusiness() {
  const body =
    guideHero({
      eyebrowEn: "Run Your Business", eyebrowAr: "تشغيل عملك",
      titleEn: "Operating a company in Saudi Arabia", titleAr: "تشغيل شركتك في السعودية",
      leadEn: "The government portals you'll live in, the real corporate tax rates, Saudization rules, and what PRO/GRO functions actually cover.", leadAr: "البوابات الحكومية التي ستتعامل معها يومياً، معدلات الضرائب المؤسسية الفعلية، أنظمة السعودة، وما تغطيه فعلياً وظائف العلاقات الحكومية.",
    }) +
    guideNav([
      ["portals", "Gov portals", "البوابات الحكومية"],
      ["taxation", "Taxation", "الضرائب"],
      ["saudization", "HR & Saudization", "السعودة"],
      ["pro-gro", "PRO & GRO", "العلاقات الحكومية"],
    ]) +
    guideBlock({
      id: "portals",
      eyebrowEn: "Digital government", eyebrowAr: "الحكومة الرقمية",
      titleEn: "The government portals you'll use", titleAr: "البوابات الحكومية التي ستستخدمها",
      leadEn: "Nine platforms, each run by a different ministry, covering labor, immigration, tax, commerce, municipal licensing, procurement and payroll.", leadAr: "تسع منصات، كل واحدة تديرها جهة مختلفة، تغطي العمل والهجرة والضرائب والتجارة والتراخيص البلدية والمشتريات والرواتب.",
      bullets: [
        ["Qiwa (qiwa.sa) — HRSD's unified labor platform: work permits, e-contracts, employee transfers, Saudization compliance.", "قوى (qiwa.sa) — منصة العمل الموحدة لوزارة الموارد البشرية: تصاريح العمل، العقود الإلكترونية، نقل الموظفين، امتثال السعودة."],
        ["Absher (absher.sa) — the Ministry of Interior's national e-government platform for passports, civil affairs, traffic and residency.", "أبشر (absher.sa) — منصة وزارة الداخلية الوطنية للحكومة الإلكترونية للجوازات والأحوال المدنية والمرور والإقامة."],
        ["Muqeem (muqeem.sa) — the employer-facing portal (under Jawazat) for managing employees' Iqama and visa transactions.", "مقيم (muqeem.sa) — بوابة موجّهة لأصحاب العمل (تابعة للجوازات) لإدارة معاملات الإقامة والتأشيرات للموظفين."],
        ["GOSI (gosi.gov.sa) — social insurance: pensions, occupational-hazard coverage and unemployment insurance (SANED).", "التأمينات الاجتماعية (gosi.gov.sa) — التأمين الاجتماعي: المعاشات، تغطية الأخطار المهنية، والتأمين ضد التعطل (ساند)."],
        ["ZATCA (zatca.gov.sa) — Zakat/tax registration, filing, payments and e-invoicing via the FATOORA platform.", "هيئة الزكاة والضريبة والجمارك (zatca.gov.sa) — تسجيل الزكاة والضرائب وتقديم الإقرارات والمدفوعات والفوترة الإلكترونية عبر منصة فاتورة."],
        ["Saudi Business Center — one-stop CR issuance/amendment; registering here auto-registers you with HRSD, ZATCA, GOSI and Saudi Post.", "المركز السعودي للأعمال — نافذة موحدة لإصدار وتعديل السجل التجاري؛ التسجيل هنا يسجّلك تلقائياً لدى الموارد البشرية والزكاة والتأمينات والبريد."],
        ["Balady (balady.gov.sa) — municipal permits and licenses, run by the Ministry of Municipal, Rural Affairs and Housing.", "بلدي (balady.gov.sa) — التراخيص والتصاريح البلدية، تديرها وزارة الشؤون البلدية والقروية والإسكان."],
        ["Etimad (portal.etimad.sa) — government tenders, e-procurement and supplier payments, run by the Ministry of Finance.", "اعتماد (portal.etimad.sa) — المنافسات الحكومية والمشتريات الإلكترونية ومدفوعات الموردين، تديرها وزارة المالية."],
        ["Mudad (mudad.com.sa) — Wage Protection System (WPS) compliance: monthly payroll submission mandated by HRSD.", "مدد (mudad.com.sa) — الامتثال لنظام حماية الأجور: تقديم بيانات الرواتب الشهرية بموجب إلزام وزارة الموارد البشرية."],
      ],
    }) +
    guideBlock({
      gray: true, id: "taxation",
      eyebrowEn: "Corporate taxation", eyebrowAr: "الضرائب المؤسسية",
      titleEn: "Corporate taxation in Saudi Arabia", titleAr: "الضرائب المؤسسية في السعودية",
      leadEn: "Tax liability splits by ownership: Zakat on the Saudi/GCC-owned share, income tax on the foreign-owned share — all administered by ZATCA.", leadAr: "الالتزام الضريبي ينقسم حسب الملكية: الزكاة على الحصة السعودية/الخليجية، وضريبة الدخل على الحصة الأجنبية — وتديرهما هيئة الزكاة والضريبة والجمارك.",
      bullets: [
        ["Zakat: 2.5% of the Zakat base, on the Saudi/GCC-owned share of a resident company.", "الزكاة: 2.5% من الوعاء الزكوي، على الحصة السعودية/الخليجية من الشركة المقيمة."],
        ["Corporate Income Tax: 20% flat, on the foreign-owned share of a resident company and on non-residents with a Saudi permanent establishment.", "ضريبة الدخل المؤسسي: 20% ثابتة، على الحصة الأجنبية من الشركة المقيمة وعلى غير المقيمين ذوي المنشأة الدائمة في السعودية."],
        ["VAT: 15% standard rate since 1 July 2020; mandatory registration above SAR 375,000 annual taxable supplies.", "ضريبة القيمة المضافة: 15% نسبة أساسية منذ 1 يوليو 2020؛ التسجيل إلزامي فوق 375,000 ريال من المبيعات الخاضعة سنوياً."],
        ["Withholding tax on payments to non-residents: commonly cited at 5% (dividends, interest, rent), 15% (royalties), 20% (management fees) — technical/consulting-service rates are reported inconsistently across sources.", "ضريبة الاستقطاع على المدفوعات لغير المقيمين: يُذكر عادة 5% (الأرباح، الفوائد، الإيجار)، 15% (الإتاوات)، 20% (رسوم الإدارة) — أما رسوم الخدمات الفنية والاستشارية فالنسب المُبلّغ عنها غير متسقة بين المصادر."],
        ["RHQ tax incentive: 0% corporate tax and 0% withholding tax for 30 years on eligible RHQ activities (see the Business Setup guide).", "حافز المقر الإقليمي: ضريبة مؤسسية 0% وضريبة استقطاع 0% لمدة 30 عاماً على أنشطة المقر الإقليمي المؤهلة (راجع دليل تأسيس الأعمال)."],
        ["Transfer pricing rules are OECD-aligned (Master File, Local File, Country-by-Country Report); the disclosure form is due within 120 days of fiscal year-end.", "قواعد تسعير التحويل متوافقة مع منظمة التعاون الاقتصادي (الملف الرئيسي، الملف المحلي، تقرير الدولة)؛ ونموذج الإفصاح مستحق خلال 120 يوماً من نهاية السنة المالية."],
        ["Annual Zakat/CIT return due within 120 days of fiscal year-end (e.g. 30 April for a standard calendar year).", "إقرار الزكاة/ضريبة الدخل السنوي مستحق خلال 120 يوماً من نهاية السنة المالية (مثلاً 30 أبريل للسنة المالية التقويمية القياسية)."],
      ],
      caveatEn: "The exact withholding-tax rate for technical/consulting services, oil-sector tax tiers, and transfer-pricing documentation thresholds are reported inconsistently across sources — confirm current figures with ZATCA or our team before relying on a specific rate.", caveatAr: "نسبة ضريبة الاستقطاع الدقيقة للخدمات الفنية والاستشارية، وشرائح الضريبة في قطاع النفط، وحدود توثيق تسعير التحويل، جميعها مُبلّغ عنها بشكل غير متسق بين المصادر — تأكد من الأرقام الحالية مع الهيئة أو فريقنا قبل الاعتماد على نسبة محددة.",
    }) +
    guideBlock({
      id: "saudization",
      eyebrowEn: "HR & localization", eyebrowAr: "الموارد البشرية والتوطين",
      titleEn: "HR & Saudization", titleAr: "الموارد البشرية والسعودة",
      leadEn: "The Nitaqat localization system, GOSI contributions, wage protection, and the labor-law basics every employer needs.", leadAr: "نظام التوطين نطاقات، اشتراكات التأمينات الاجتماعية، حماية الأجور، وأساسيات نظام العمل التي يحتاجها كل صاحب عمل.",
      bullets: [
        ["Nitaqat (run via Qiwa, HRSD) assigns private-sector employers to color bands — the current version is officially called \"Nitaqat Mutawar\" (evolved Nitaqat).", "نطاقات (تُدار عبر قوى، وزارة الموارد البشرية) تصنّف أصحاب العمل في القطاع الخاص إلى نطاقات لونية — النسخة الحالية تُسمى رسمياً \"نطاقات مطوّر\"."],
        ["There's no single flat Saudization percentage — requirements are sector- and size-specific; check your establishment's exact requirement via Qiwa's Nitaqat calculator.", "لا توجد نسبة سعودة موحدة — المتطلبات تختلف حسب القطاع وحجم المنشأة؛ تحقق من متطلب منشأتك الدقيق عبر حاسبة النطاقات في قوى."],
        ["GOSI: 2% Occupational Hazards (employer-paid, applies to Saudi and non-Saudi employees). Saudi nationals also pay Annuities/Pension and SANED (unemployment insurance) — rates are mid-transition under a new Social Insurance Law effective ~July 2025; confirm current rates directly with GOSI.", "التأمينات الاجتماعية: 2% أخطار مهنية (يدفعها صاحب العمل، تشمل السعوديين وغير السعوديين). السعوديون يدفعون أيضاً معاشات وساند (تأمين تعطل) — والنسب في مرحلة انتقالية بموجب نظام تأمينات اجتماعية جديد نافذ منذ يوليو 2025 تقريباً؛ تأكد من النسب الحالية مباشرة مع التأمينات."],
        ["Wage Protection System (WPS) via Mudad: mandatory bank-transferred salary payment and monthly payroll-data submission for private-sector employers.", "نظام حماية الأجور عبر مدد: إلزامية دفع الرواتب عبر تحويل بنكي وتقديم بيانات الرواتب الشهرية لأصحاب العمل في القطاع الخاص."],
        ["Probation period: 90 days by default, extendable to a maximum of 180 days by written agreement (Labor Law Article 53).", "فترة التجربة: 90 يوماً افتراضياً، قابلة للتمديد لحد أقصى 180 يوماً باتفاق كتابي (المادة 53 من نظام العمل)."],
        ["Notice period (post-probation, per Feb 2025 amendments): 30 days if the employee resigns, 60 days if the employer terminates.", "فترة الإشعار (بعد التجربة، وفق تعديلات فبراير 2025): 30 يوماً في حال استقالة الموظف، و60 يوماً في حال إنهاء صاحب العمل للعقد."],
        ["End-of-service gratuity (Article 84): commonly described as half a month's wage per year for the first 5 years, then a full month's wage per year beyond that, pro-rated for partial years.", "مكافأة نهاية الخدمة (المادة 84): تُوصف عادة بنصف شهر أجر عن كل سنة من السنوات الخمس الأولى، ثم شهر كامل عن كل سنة بعدها، وتُحتسب تناسبياً للكسور."],
      ],
    }) +
    guideBlock({
      gray: true, id: "pro-gro",
      eyebrowEn: "PRO & GRO", eyebrowAr: "PRO & GRO",
      titleEn: "What PRO & GRO services cover", titleAr: "ما الذي تغطيه خدمات PRO وGRO",
      leadEn: "\"PRO\" (Public Relations Officer) and \"GRO\" (Government Relations Officer) are industry-standard function labels across the Gulf — not legally defined titles — for the team that handles your ongoing government-facing admin.", leadAr: "\"PRO\" (مسؤول العلاقات العامة) و\"GRO\" (مسؤول العلاقات الحكومية) مسميات وظيفية معتادة في السوق الخليجي — وليست ألقاباً نظامية — للفريق الذي يتولى أعمالك الإدارية الحكومية المستمرة.",
      bullets: [
        ["Core functions: visa/Iqama processing and renewal, work-permit issuance, navigating Qiwa/Muqeem/Absher/GOSI/Mudad, and Nitaqat compliance monitoring.", "الوظائف الأساسية: معالجة وتجديد التأشيرات والإقامات، إصدار تصاريح العمل، التعامل مع قوى ومقيم وأبشر والتأمينات ومدد، ومتابعة امتثال النطاقات."],
        ["Also covers labor-office liaison, business/commercial licensing renewals, and acting as the daily point of contact with HRSD/MOI/municipal authorities.", "تشمل أيضاً التواصل مع مكتب العمل، وتجديد التراخيص التجارية، والعمل كجهة اتصال يومية مع وزارة الموارد البشرية والداخلية والجهات البلدية."],
        ["Commonly reported reference fees: Iqama renewal ~SAR 650/year; dependent levy ~SAR 400/month per dependent — both should be confirmed at time of transaction, as government fee schedules change.", "رسوم مرجعية مُبلّغ عنها: تجديد الإقامة نحو 650 ريال سنوياً؛ رسوم المرافقين نحو 400 ريال شهرياً لكل مرافق — يجب التأكد منها وقت المعاملة لأن الجداول الحكومية للرسوم تتغيّر."],
      ],
    }) + guideRelated(["Government Relations", "HR Services", "Recruitment"]) + guideCrossLinks("/guide/run-your-business") + guideDisclaimer();
  return page({ title: Lraw("Run Your Business in Saudi Arabia — Business Partner", "تشغيل عملك في السعودية — بيزنس بارتنر"), desc: Lraw("Government portals, corporate tax rates, Saudization rules and PRO/GRO services — a sourced operating guide.", "البوابات الحكومية ومعدلات الضرائب المؤسسية وأنظمة السعودة وخدمات العلاقات الحكومية — دليل تشغيلي موثق."), active: "/guide/run-your-business", path: "/guide/run-your-business", body });
}

function buildGuideLiveInSaudi() {
  const body =
    guideHero({
      eyebrowEn: "Live in Saudi", eyebrowAr: "الحياة في السعودية",
      titleEn: "Relocating your team to Saudi Arabia", titleAr: "نقل فريقك للعيش في السعودية",
      leadEn: "What executives and staff relocating with your company need to know — lifestyle, schools, healthcare and driving.", leadAr: "ما يحتاج معرفته المسؤولون والموظفون المنتقلون مع شركتك — نمط الحياة، التعليم، الرعاية الصحية، والقيادة.",
    }) +
    guideNav([
      ["lifestyle", "Lifestyle", "نمط الحياة"],
      ["education", "Education", "التعليم"],
      ["healthcare", "Healthcare", "الرعاية الصحية"],
      ["driving", "Driving", "القيادة"],
      ["residency-preview", "Residency", "الإقامة"],
    ]) +
    guideBlock({
      id: "lifestyle",
      eyebrowEn: "Lifestyle", eyebrowAr: "نمط الحياة",
      titleEn: "Saudi lifestyle for expats", titleAr: "نمط الحياة للمقيمين الأجانب",
      leadEn: "Significant social and entertainment liberalization since 2016 has reshaped daily life for foreign residents.", leadAr: "تحرر اجتماعي وترفيهي كبير منذ 2016 أعاد تشكيل الحياة اليومية للمقيمين الأجانب.",
      bullets: [
        ["Cinemas reopened in 2018 after a 35-year ban; the General Entertainment Authority (est. 2016) now licenses concerts, festivals and live events nationwide.", "أُعيد افتتاح دور السينما في 2018 بعد حظر دام 35 عاماً؛ وتُرخّص الهيئة العامة للترفيه (تأسست 2016) الحفلات والمهرجانات والفعاليات الحية في أنحاء المملكة."],
        ["The tourist e-visa launched September 2019 — a one-year multiple-entry visa for ~66 eligible nationalities, plus visa-on-arrival for valid US/UK/Schengen visa holders.", "أُطلقت تأشيرة السياحة الإلكترونية في سبتمبر 2019 — تأشيرة متعددة الدخول لمدة سنة لنحو 66 جنسية مؤهلة، مع تأشيرة عند الوصول لحاملي تأشيرات أمريكية/بريطانية/شنغن سارية."],
        ["The abaya/headscarf requirement for foreign women was lifted in September 2019; \"modest dress\" is the general expectation instead.", "أُلغي إلزام العباءة وتغطية الرأس للنساء الأجنبيات في سبتمبر 2019؛ ويُتوقع \"الزي المحتشم\" عموماً بدلاً من ذلك."],
        ["Cost of living: Mercer's 2024 ranking placed Riyadh 90th and Jeddah 97th globally (out of 226 cities) — both cheaper than Dubai (15th).", "تكلفة المعيشة: صنّف مؤشر ميرسر لعام 2024 الرياض في المرتبة 90 وجدة في المرتبة 97 عالمياً (من أصل 226 مدينة) — وكلتاهما أرخص من دبي (المرتبة 15)."],
        ["Major expat hubs: Riyadh (capital, largest expat population), Jeddah (commercial/Red Sea gateway), and the Eastern Province (Dammam/Khobar/Dhahran — the oil-industry hub with the Kingdom's longest-established Western expat community).", "أهم تجمعات المقيمين الأجانب: الرياض (العاصمة، أكبر تجمع للمقيمين)، جدة (بوابة تجارية على البحر الأحمر)، والمنطقة الشرقية (الدمام والخبر والظهران — مركز صناعة النفط وأقدم تجمع غربي مستقر في المملكة)."],
      ],
    }) +
    guideBlock({
      gray: true, id: "education",
      eyebrowEn: "Education", eyebrowAr: "التعليم",
      titleEn: "Schooling for expat families", titleAr: "التعليم لعائلات المقيمين",
      leadEn: "Expat families typically enroll children in fee-paying international schools rather than the free Arabic-medium public system.", leadAr: "عادة ما تُلحق عائلات المقيمين أبناءها بمدارس دولية مدفوعة بدلاً من النظام الحكومي المجاني الناطق بالعربية.",
      bullets: [
        ["The Ministry of Education licenses and supervises all international and private schools operating in the Kingdom.", "وزارة التعليم تُرخّص وتُشرف على جميع المدارس الدولية والأهلية العاملة في المملكة."],
        ["Riyadh, Jeddah and Al Khobar host schools offering British, American, IB and other national curricula — avoid citing a precise school count, as no single authoritative figure was found.", "تستضيف الرياض وجدة والخبر مدارس تقدّم مناهج بريطانية وأمريكية والبكالوريا الدولية ومناهج وطنية أخرى — نتجنب ذكر عدد دقيق للمدارس لعدم وجود رقم رسمي موثّق واحد."],
        ["School enrollment requires a valid Iqama for both the student and guardian; dependents under 18 qualify for family-sponsored residency.", "يتطلب التسجيل المدرسي إقامة سارية لكل من الطالب وولي الأمر؛ ويؤهل المرافقون دون 18 عاماً للإقامة العائلية."],
        ["The 2025–2026 academic year ran 24 August 2025 – 25 June 2026 under a two-semester calendar (many international schools set their own dates — always confirm with the specific school).", "امتد العام الدراسي 2025-2026 من 24 أغسطس 2025 إلى 25 يونيو 2026 وفق نظام فصلين دراسيين (تحدد كثير من المدارس الدولية تواريخها الخاصة — تأكد دائماً مع المدرسة تحديداً)."],
      ],
    }) +
    guideBlock({
      id: "healthcare",
      eyebrowEn: "Healthcare", eyebrowAr: "الرعاية الصحية",
      titleEn: "Healthcare for expats & employers", titleAr: "الرعاية الصحية للمقيمين وأصحاب العمل",
      leadEn: "A dual system: subsidized public care for citizens, and mandatory employer-provided private insurance for expatriate workers.", leadAr: "نظام مزدوج: رعاية عامة مدعومة للمواطنين، وتأمين خاص إلزامي من صاحب العمل للعمالة الوافدة.",
      bullets: [
        ["The Council of Cooperative Health Insurance (CCHI) regulates health insurance and sets the mandatory minimum benefits package.", "مجلس الضمان الصحي التعاوني ينظّم التأمين الصحي ويحدد الحد الأدنى الإلزامي للتغطية."],
        ["Every private-sector employer must provide CCHI-approved health insurance for expatriate employees, at the employer's cost.", "كل صاحب عمل في القطاع الخاص ملزم بتوفير تأمين صحي معتمد من مجلس الضمان الصحي للموظفين الوافدين، على نفقة صاحب العمل."],
        ["Coverage generally extends to legal dependents (spouse, sons under 25, unmarried/unemployed daughters).", "التغطية تشمل عموماً المرافقين النظاميين (الزوجة، الأبناء دون 25 عاماً، البنات غير المتزوجات وغير العاملات)."],
        ["Since late 2025, health insurance reportedly must be secured before a work visa is issued, with Jawazat checking coverage before Iqama issuance/renewal — a relatively recent procedural tightening worth reconfirming close to your relocation date.", "منذ أواخر 2025، يُذكر أن التأمين الصحي بات مطلوباً قبل إصدار تأشيرة العمل، مع تحقق الجوازات من التغطية قبل إصدار أو تجديد الإقامة — تشديد إجرائي حديث نسبياً يستحق التأكد منه قرب موعد انتقالك."],
        ["Expats generally cannot access subsidized public healthcare except in life-threatening emergencies; virtually all expat healthcare runs through private, employer-sponsored insurance.", "لا يستطيع المقيمون الأجانب عموماً الوصول للرعاية الصحية الحكومية المدعومة إلا في الحالات الطارئة المهددة للحياة؛ وتمر رعايتهم الصحية عملياً عبر التأمين الخاص المموّل من صاحب العمل."],
      ],
    }) +
    guideBlock({
      gray: true, id: "driving",
      eyebrowEn: "Driving", eyebrowAr: "القيادة",
      titleEn: "Driving in Saudi Arabia", titleAr: "القيادة في السعودية",
      leadEn: "A Saudi driving license requires a valid Iqama; the process depends heavily on which country issued your existing license.", leadAr: "تتطلب رخصة القيادة السعودية إقامة سارية؛ وتعتمد الإجراءات بشكل كبير على الدولة التي أصدرت رخصتك الحالية.",
      bullets: [
        ["Eligibility: valid Iqama, minimum age 18 for a private-vehicle license (21+ for professional/public driving), plus a medical/vision exam.", "الأهلية: إقامة سارية، حد أدنى للعمر 18 عاماً لرخصة المركبة الخاصة (21 فأكثر للقيادة المهنية/العامة)، إضافة لفحص طبي وبصري."],
        ["GCC-country licenses can generally be converted directly; a number of other countries have reciprocal exchange agreements — this approved list changes periodically, so always verify current eligibility on Absher before relocating staff.", "يمكن عموماً تحويل رخص دول مجلس التعاون الخليجي مباشرة؛ ولدى عدد من الدول الأخرى اتفاقيات تبادل متبادلة — تتغيّر هذه القائمة المعتمدة بشكل دوري، لذا تأكد دائماً من الأهلية الحالية عبر أبشر قبل نقل الموظفين."],
        ["Women driving has been legal since 24 June 2018, following a royal decree issued September 2017 — no male-guardian permission is required.", "أصبحت قيادة المرأة قانونية منذ 24 يونيو 2018، بعد مرسوم ملكي صدر في سبتمبر 2017 — دون الحاجة لإذن ولي أمر ذكر."],
        ["Absher (Ministry of Interior) is the channel for booking test appointments, license issuance/renewal, and checking outstanding traffic violations.", "أبشر (وزارة الداخلية) هي القناة لحجز مواعيد الاختبار، وإصدار وتجديد الرخصة، والتحقق من المخالفات المرورية القائمة."],
      ],
    }) +
    guideBlock({
      id: "residency-preview",
      eyebrowEn: "Residency", eyebrowAr: "الإقامة",
      titleEn: "Residency options — the short version", titleAr: "خيارات الإقامة — النسخة المختصرة",
      leadEn: "Employer-sponsored Iqamas cover most staff; Premium Residency lets qualifying individuals live in Saudi Arabia without a sponsor. Full detail — including current fee figures and the 2021 labor-mobility reforms — is on our dedicated Residency guide.", leadAr: "الإقامة المسندة من صاحب العمل تغطي معظم الموظفين؛ والإقامة المميزة تتيح للأفراد المؤهلين العيش في السعودية دون كفيل. التفاصيل الكاملة — بما فيها الرسوم الحالية وإصلاحات تنقل العمالة لعام 2021 — في دليل الإقامة المخصص لدينا.",
      bullets: [
        ["Standard Iqama: the employer-sponsored residence permit, tied to your work contract, managed via Muqeem/Absher.", "الإقامة النظامية: تصريح الإقامة المسند من صاحب العمل، مرتبط بعقد العمل، وتُدار عبر مقيم وأبشر."],
        ["Premium Residency (pr.gov.sa): self-sponsored status — no Saudi kafeel required — with products ranging from the flagship permanent/renewable tiers to newer category-specific tracks (talent, investor, entrepreneur, real-estate owner).", "الإقامة المميزة (pr.gov.sa): إقامة ذاتية الكفالة — دون الحاجة لكفيل سعودي — بمنتجات تتراوح بين المستويات الرئيسية الدائمة والمتجددة ومسارات فئوية أحدث (المواهب، المستثمرين، رواد الأعمال، ملّاك العقار)."],
      ],
    }) +
    `<section class="section section--gray"><div class="container" style="text-align:center"><a class="btn btn-primary btn-lg" href="${u("/guide/residency")}">${L("Read the full Residency guide →", "اقرأ دليل الإقامة الكامل ←")}</a></div></section>` +
    guideRelated(["Government Relations", "HR Services", "Real Estate"]) + guideCrossLinks("/guide/live-in-saudi") + guideDisclaimer();
  return page({ title: Lraw("Live in Saudi Arabia — Business Partner", "الحياة في السعودية — بيزنس بارتنر"), desc: Lraw("Lifestyle, education, healthcare and driving for expat staff and executives relocating to Saudi Arabia.", "نمط الحياة والتعليم والرعاية الصحية والقيادة للموظفين والمسؤولين المنتقلين للسعودية."), active: "/guide/live-in-saudi", path: "/guide/live-in-saudi", body });
}

function buildGuideResidency() {
  const body =
    guideHero({
      eyebrowEn: "Residency in KSA", eyebrowAr: "الإقامة في السعودية",
      titleEn: "Residency options in Saudi Arabia", titleAr: "خيارات الإقامة في السعودية",
      leadEn: "Standard Iqama, Premium Residency and sponsorship-transfer rules — including the fee figures our research could and could not confirm.", leadAr: "الإقامة النظامية، والإقامة المميزة، وأنظمة نقل الكفالة — بما في ذلك الرسوم التي تمكّن بحثنا من تأكيدها والتي لم يتمكّن.",
    }) +
    guideNav([
      ["iqama", "Standard Iqama", "الإقامة النظامية"],
      ["premium-residency", "Premium Residency", "الإقامة المميزة"],
      ["transfer-rules", "Transfer rules", "نقل الكفالة"],
    ]) +
    guideBlock({
      id: "iqama",
      eyebrowEn: "Standard residency", eyebrowAr: "الإقامة النظامية",
      titleEn: "Iqama (employer-sponsored residency)", titleAr: "الإقامة (المسندة من صاحب العمل)",
      leadEn: "The standard residence permit for foreign workers, issued by the Ministry of Interior's General Directorate of Passports (Jawazat).", leadAr: "تصريح الإقامة النظامي للعمالة الوافدة، تصدره المديرية العامة للجوازات التابعة لوزارة الداخلية.",
      bullets: [
        ["Historically tied to the kafala (sponsorship) relationship; the 2021 Labor Reform Initiative (LRI, effective 14 March 2021) loosened this considerably — see the Transfer Rules section below.", "كانت تاريخياً مرتبطة بنظام الكفالة؛ وخفّفت مبادرة إصلاح سوق العمل (نافذة منذ 14 مارس 2021) هذا الارتباط بشكل كبير — راجع قسم أنظمة النقل أدناه."],
        ["Underlying legal residency status is renewed on a cycle (commonly annual, some sources report flexible 3/6/9/12-month increments); a separately-reported 5-year physical Resident ID card (since ~Q1 2026) does not change the underlying renewal obligation — the two should not be conflated.", "الحالة القانونية للإقامة تُجدَّد دورياً (سنوياً عادة، وتُذكر مصادر إمكانية التجديد المرن كل 3/6/9/12 شهراً)؛ وبطاقة الإقامة الفعلية المُبلّغ عنها بصلاحية 5 سنوات (منذ نحو الربع الأول من 2026) لا تُغيّر التزام التجديد الأساسي — لا ينبغي الخلط بين الأمرين."],
        ["Dependent (family) Iqamas are sponsored by the employee, subject to income conditions; a commonly cited dependent levy is SAR 400/month per dependent.", "إقامات المرافقين (العائلة) يكفلها الموظف، بشروط دخل معينة؛ ويُذكر عادة رسم مرافقين قدره 400 ريال شهرياً لكل مرافق."],
        ["An expired Iqama blocks re-entry and must be renewed (with late fees) before travel resumes; Saudi Arabia lifted the automatic 3-year re-entry ban for overstays, reportedly effective 16 January 2024 — administrative fines still apply.", "الإقامة المنتهية تمنع إعادة الدخول ويجب تجديدها (مع رسوم التأخير) قبل استئناف السفر؛ ألغت السعودية حظر إعادة الدخول التلقائي لمدة 3 سنوات لحالات تجاوز مدة الإقامة، ويُذكر أن ذلك سرى اعتباراً من 16 يناير 2024 — وتبقى الغرامات الإدارية سارية."],
        ["Muqeem is the employer-facing portal for managing employees' Iqama and visa transactions; Absher is the individual-facing platform for personal government services.", "مقيم هي البوابة الموجّهة لأصحاب العمل لإدارة معاملات إقامة وتأشيرات الموظفين؛ وأبشر هي المنصة الموجّهة للأفراد للخدمات الحكومية الشخصية."],
      ],
      caveatEn: "Exact overstay/late-renewal fine amounts and the 5-year physical-card claim come from secondary sources only in this research pass — confirm current figures directly via Absher/Jawazat before publishing or relying on a specific number.", caveatAr: "المبالغ الدقيقة لغرامات تجاوز المدة والتجديد المتأخر، وكذلك بطاقة الخمس سنوات الفعلية، مصدرها ثانوي فقط في هذا البحث — تأكد من الأرقام الحالية مباشرة عبر أبشر أو الجوازات قبل النشر أو الاعتماد على رقم محدد.",
    }) +
    guideBlock({
      gray: true, id: "premium-residency",
      eyebrowEn: "Self-sponsored residency", eyebrowAr: "الإقامة ذاتية الكفالة",
      titleEn: "Premium Residency (نظام الإقامة المميزة)", titleAr: "نظام الإقامة المميزة",
      leadEn: "A self-sponsored residence status — no Saudi kafeel required — run by the Premium Residency Center via pr.gov.sa.", leadAr: "وضع إقامة ذاتية الكفالة — دون حاجة لكفيل سعودي — يديره مركز الإقامة المميزة عبر بوابة pr.gov.sa.",
      bullets: [
        ["Two original core products: Permanent (Unlimited Duration) Residency — a one-time fee commonly reported at SAR 800,000 — and Special (Renewable) Residency — an annual fee commonly reported at SAR 100,000.", "منتجان أساسيان أصليان: الإقامة الدائمة (غير محددة المدة) — برسم لمرة واحدة يُذكر عادة بـ800,000 ريال — والإقامة الخاصة (المتجددة) — برسم سنوي يُذكر عادة بـ100,000 ريال."],
        ["On 10 January 2024, five additional category-specific products were introduced at a reported ~SAR 4,000/year fee each: Special Talent, Gifted, Investor, Entrepreneur, and Real Estate Owner residency — these are additional tracks alongside the original two products, not a replacement of their fees.", "في 10 يناير 2024، أُدرجت خمسة منتجات فئوية إضافية برسم يُذكر بنحو 4,000 ريال سنوياً لكل منها: إقامة الكفاءات المتميزة، والموهوبين، والمستثمرين، ورواد الأعمال، وملّاك العقار — وهذه مسارات إضافية إلى جانب المنتجين الأصليين، وليست بديلاً عن رسومهما."],
        ["Real Estate Owner Residency: requires ownership of a mortgage-free residential property valued at a reported minimum of SAR 4 million.", "إقامة ملّاك العقار: تتطلب تملّك عقار سكني خالٍ من الرهن بقيمة يُذكر أن حدها الأدنى 4 ملايين ريال."],
        ["Investor Residency: reported thresholds around SAR 7 million investment (or a higher SAR 15 million tier with job-creation requirements) — figures vary somewhat by source.", "إقامة المستثمرين: حدود يُذكر أنها نحو 7 ملايين ريال استثمار (أو مستوى أعلى بـ15 مليون ريال مع شروط لخلق وظائف) — الأرقام تتفاوت قليلاً حسب المصدر."],
        ["General eligibility across products: valid passport (6+ months), proof of financial solvency, clean criminal record, medical fitness, minimum age 21.", "الأهلية العامة لكافة المنتجات: جواز سفر ساري (6 أشهر فأكثر)، إثبات ملاءة مالية، سجل جنائي نظيف، لياقة طبية، حد أدنى للعمر 21 عاماً."],
      ],
      caveatEn: "The SAR 800,000 / SAR 100,000 figures were repeated consistently across many 2025–2026-dated sources including one reporting them as confirmed unchanged as of October 2025 — but no primary pr.gov.sa fee page could be directly loaded in this research to give 100% certainty. Given the commercial stakes, always confirm current fees directly with the Premium Residency Center (pr.gov.sa) or our team before a client relies on a specific figure.", caveatAr: "تكرر رقما 800,000 و100,000 ريال بشكل متسق عبر مصادر عديدة مؤرخة 2025-2026، بما فيها مصدر أكد أنهما دون تغيير حتى أكتوبر 2025 — لكن لم نتمكن من تحميل صفحة الرسوم الرسمية مباشرة من pr.gov.sa لتأكيد ذلك بشكل كامل في هذا البحث. نظراً للأهمية التجارية، تأكد دائماً من الرسوم الحالية مباشرة مع مركز الإقامة المميزة (pr.gov.sa) أو فريقنا قبل اعتماد العميل على رقم محدد.",
    }) +
    guideBlock({
      id: "transfer-rules",
      eyebrowEn: "Sponsorship transfer", eyebrowAr: "نقل الكفالة",
      titleEn: "Iqama transfer rules", titleAr: "أنظمة نقل الإقامة",
      leadEn: "Managed via Qiwa since the 2021 Labor Reform Initiative, with further easing reported through 2025.", leadAr: "تُدار عبر قوى منذ مبادرة إصلاح سوق العمل عام 2021، مع مزيد من التسهيل مُبلّغ عنه حتى 2025.",
      bullets: [
        ["Since the 2021 LRI, workers can generally transfer employers without the current employer's consent once their contract ends, or after completing 12 months of service.", "منذ مبادرة 2021، يمكن للعامل عموماً نقل كفالته دون موافقة صاحب العمل الحالي عند انتهاء عقده، أو بعد إتمام 12 شهراً من الخدمة."],
        ["No-consent transfer is also allowed if wages go unpaid for 3+ consecutive months, the work permit/Iqama expires without renewal, or in cases of documented labor disputes.", "يُسمح أيضاً بالنقل دون موافقة في حال تأخر الرواتب 3 أشهر متتالية فأكثر، أو انتهاء تصريح العمل/الإقامة دون تجديد، أو في حالات النزاعات العمالية الموثقة."],
        ["Domestic/household workers, agricultural workers, and a handful of other categories are excluded from the general Labor Law and this transfer framework — they're governed separately via the Musaned platform, which uses a mutual-consent transfer process instead.", "العمالة المنزلية والزراعية وعدد قليل من الفئات الأخرى مستثناة من نظام العمل العام وإطار النقل هذا — وتُدار بشكل منفصل عبر منصة مساند، التي تعتمد إجراء نقل بالتراضي بدلاً من ذلك."],
        ["2025 press coverage describes a further shift toward a fully contract-based system (widely headlined as \"ending kafala\") — this appears to be an expansion of the 2021 mobility framework with phased eligibility conditions, not an instant unconditional change; treat headline \"abolition\" framing with caution.", "تصف تغطية صحفية لعام 2025 تحولاً إضافياً نحو نظام قائم بالكامل على العقد (وصفته عناوين كثيرة بـ\"إنهاء الكفالة\") — ويبدو أن هذا توسّع لإطار التنقل لعام 2021 بشروط أهلية مرحلية، وليس تغييراً فورياً غير مشروط؛ تعامل مع صياغة \"الإلغاء\" في العناوين بحذر."],
      ],
    }) + guideRelated(["Premium Residency", "Government Relations"]) + guideCrossLinks("/guide/residency") + guideDisclaimer();
  return page({ title: Lraw("Residency in Saudi Arabia — Business Partner", "الإقامة في السعودية — بيزنس بارتنر"), desc: Lraw("Iqama, Premium Residency and sponsorship-transfer rules — with source-flagged fee figures.", "الإقامة النظامية والإقامة المميزة وأنظمة نقل الكفالة — بأرقام رسوم موثقة المصدر."), active: "/guide/residency", path: "/guide/residency", body });
}

// Shared partners-repeater markup: rows of (name, mobile, email[, share%]).
// The client JS (main.js "partners repeater") wires add/remove and collects
// rows into the request payload; every partner gets notified by email.
function partnersBlock({ withShare = false } = {}) {
  return `
      <div class="field"><label>${L("Partners", "الشركاء")} ${withShare ? L("(name, mobile, email, share %)", "(الاسم، الجوال، البريد، نسبة الملكية)") : L("(name, mobile, email)", "(الاسم، الجوال، البريد)")}</label>
        <div class="partners-rows" data-partners${withShare ? ' data-with-share="1"' : ""}></div>
        <button type="button" class="btn btn-ghost btn-sm" data-add-partner>＋ ${L("Add partner", "أضف شريكاً")}</button>
        <p class="mini">${L("Every partner receives the updates and the appointment invitation by email.", "كل شريك يستلم التحديثات ودعوة الموعد على بريده.")}</p>
      </div>`;
}

// Corporate bank-account opening: we prepare the file from the client's
// company profile (completing بيانات المنشأة is a prerequisite), coordinate
// with the chosen bank, and set an ONLINE appointment with the bank officer —
// every partner + the manager get the appointment by email.
function buildBankAccount() {
  const banks = ["الراجحي", "SNB الأهلي", "الرياض", "الإنماء", "ساب SAB", "البلاد", "الجزيرة", "العربي anb", "STC Bank", "بنك آخر"];
  const steps = [
    [1, L("Complete your company profile", "أكمل بيانات منشأتك"), L("CR, activity, national address and contacts in your dashboard — this is the bank-file prerequisite.", "السجل والنشاط والعنوان الوطني وجهات الاتصال في لوحتك — هذا اشتراط ملف البنك.")],
    [2, L("Pick the bank & propose a time", "اختر البنك واقترح موعداً"), L("Choose your preferred bank and a time that suits all partners.", "اختر بنكك المفضل ووقتاً يناسب جميع الشركاء.")],
    [3, L("We prepare & book", "نجهّز ونحجز"), L("We prepare the account-opening file and coordinate an ONLINE meeting with the bank officer.", "نجهّز ملف فتح الحساب وننسق اجتماعاً أونلاين مع موظف البنك.")],
    [4, L("Partners get the invitation", "الشركاء يستلمون الدعوة"), L("Every partner and the manager receive the appointment by email — attend online and sign.", "كل شريك والمدير يستلمون الموعد على البريد — احضروا أونلاين ووقّعوا.")],
  ].map((s) => `<div class="hstep"><span class="hstep-n">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("New service ⚡", "خدمة جديدة ⚡")}</span>
    <h1>${L("Open your company's bank account — online, partners included", "افتح الحساب البنكي لشركتك — أونلاين وبحضور كل الشركاء")}</h1>
    <p class="lead">${L("We prepare the account-opening file from your company profile, coordinate with your chosen bank, and book an online meeting with the bank officer — every partner and the manager get the appointment on their email.", "نجهّز ملف فتح الحساب من بيانات منشأتك، ننسق مع البنك الذي تختاره، ونحجز اجتماعاً أونلاين مع موظف البنك — وكل شريك والمدير يستلمون الموعد على بريدهم.")}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#bank-form">${L("Request account opening", "اطلب فتح الحساب")}</a>${waBtn2("Ask the smart agent", "اسأل الوكيل الذكي", "btn-ghost")}</div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Online meeting with the bank", "اجتماع أونلاين مع البنك")}</span>
      <span class="hero-badge">${I.check}${L("All partners notified", "إشعار جميع الشركاء")}</span>
      <span class="hero-badge">${I.check}${L("File prepared from your profile", "الملف يُجهّز من بيانات منشأتك")}</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف تعمل")}</span><h2>${L("From profile to an open account in 4 steps", "من بيانات المنشأة إلى حساب مفتوح في 4 خطوات")}</h2></div>
    <div class="home-steps">${steps}</div>
  </div></section>

  <section class="section" id="bank-form"><div class="container" style="max-width:920px">
    <div class="section-head"><h2>${L("Request bank-account opening", "اطلب فتح الحساب البنكي")}</h2><p>${L("Sign in first — the request pulls your company profile from your dashboard.", "سجّل دخولك أولاً — الطلب يسحب بيانات منشأتك من لوحتك.")}</p></div>
    <div class="callout" id="bank-profile-gate" hidden style="margin-bottom:16px"><span class="ico">📋</span><p>${L("Company profile incomplete: fill in your establishment name and CR in the dashboard first — it's the bank-file prerequisite.", "بيانات المنشأة غير مكتملة: أكمل اسم المنشأة والسجل التجاري في لوحتك أولاً — فهي اشتراط ملف البنك.")} <a href="${u("/account")}">${L("Complete company profile ←", "أكمل بيانات المنشأة ←")}</a></p></div>
    <div class="order-box">
      <form id="bank-form-el" novalidate>
        <div class="cc-grid">
          <div class="field"><label for="bk2-company">${L("Company name", "اسم الشركة")} *</label><input type="text" id="bk2-company" required></div>
          <div class="field"><label for="bk2-cr">${L("CR number", "رقم السجل التجاري")} *</label><input type="text" id="bk2-cr" required></div>
          <div class="field"><label for="bk2-manager">${L("Manager name", "اسم المدير")} *</label><input type="text" id="bk2-manager" required></div>
          <div class="field"><label for="bk2-phone">${L("Manager mobile", "جوال المدير")} *</label><input type="tel" id="bk2-phone" placeholder="05XXXXXXXX" required></div>
          <div class="field"><label for="bk2-email">${L("Manager email", "بريد المدير")} *</label><input type="email" id="bk2-email" required></div>
          <div class="field"><label for="bk2-bank">${L("Preferred bank", "البنك المفضل")}</label><select id="bk2-bank">${banks.map((b) => `<option>${b}</option>`).join("")}</select></div>
          <div class="field"><label for="bk2-when">${L("Proposed appointment (online)", "الموعد المقترح (أونلاين)")}</label><input type="datetime-local" id="bk2-when"></div>
        </div>
        ${partnersBlock()}
        <button type="submit" class="btn btn-primary btn-lg">${L("Send the request", "أرسل الطلب")}</button>
        <div class="form-success" id="bank-success" hidden></div>
      </form>
    </div>
    <div class="callout" style="margin-top:20px"><span class="ico">⚖️</span><p>${L("Account opening and its requirements are the bank's decision; we prepare, coordinate and follow through.", "فتح الحساب ومتطلباته قرار البنك؛ نحن نجهّز وننسق ونتابع حتى الفتح.")}</p></div>
  </div></section>`;
  return page({ title: Lraw("Corporate bank account opening — Business Partner", "فتح حساب بنكي للشركات — بيزنس بارتنر"), desc: Lraw("We prepare the file, coordinate with your bank and book an online meeting — all partners notified.", "نجهّز الملف وننسق مع بنكك ونحجز اجتماعاً أونلاين — مع إشعار جميع الشركاء."), active: "/bank-account", path: "/bank-account", body });
}

// Manager powers in the formation form — the main→sub structure and wording
// mirror the actual Ministry of Commerce نظام أساس supplied by the owner
// (المادة الخامسة: إدارة الشركة): every granted power carries an exercise mode
// (يمارسها منفرداً / بموافقة كل المديرين) plus a يحق التوكيل flag.
const FC_PERMS = [
  { key: "cr", en: "Commercial registrations", ar: "السجلات التجارية", subs: [
    ["issue", "Issuing (main & branch CRs)", "الإصدار (الرئيسية والفرعية)"],
    ["confirm", "Annual confirmation", "التأكيد السنوي"],
    ["amend", "Amending, transferring & managing CRs", "تعديل السجلات ونقلها وإدارتها"],
    ["strike", "Striking off (شطب)", "الشطب"],
  ]},
  { key: "banking", en: "Banking", ar: "الصلاحيات البنكية", subs: [
    ["accounts", "Opening & closing bank accounts in the company's name", "فتح وقفل الحسابات لدى البنوك باسم الشركة"],
    ["credits", "Opening documentary credits", "فتح الاعتمادات"],
    ["operate", "Deposit, withdrawal & account updates", "الإيداع والسحب وتحديث الحسابات"],
    ["cheques", "Issuing cheques & obtaining statements", "إصدار الشيكات واستخراج كشوف الحسابات"],
    ["facilities", "Requesting facilities & guarantees", "طلب التسهيلات والضمانات"],
    ["loans", "Signing loan contracts, commercial papers & promissory notes", "توقيع عقود القروض والأوراق التجارية وسندات لأمر"],
  ]},
  { key: "assets", en: "Property management", ar: "إدارة الأملاك", subs: [
    ["realestate", "Buying, selling & conveying real estate and land", "شراء وبيع وإفراغ العقار والأراضي"],
    ["shares", "Buying & selling shares", "شراء وبيع الأسهم"],
    ["mortgage", "Mortgage, release & receipt", "حق الرهن وفك الرهن والقبض"],
    ["leases", "Signing, renewing & terminating lease contracts", "توقيع وتجديد وفسخ عقود الإيجار"],
  ]},
  { key: "companies", en: "Companies & participations", ar: "الشركات والمشاركات", subs: [
    ["contracts", "Signing companies' contracts & partners' resolutions", "توقيع عقود الشركات وقرارات الشركاء"],
    ["stakes", "Buying & selling stakes", "شراء وبيع الحصص"],
    ["represent", "Representing the company in companies it holds", "تمثيل الشركة في الشركات المساهم فيها"],
    ["incorporate", "Incorporating companies in the company's name (incl. before the notary)", "تأسيس الشركات باسم الشركة والتمثيل أمام كاتب العدل"],
  ]},
  { key: "judicial", en: "Judiciary & representation", ar: "القضاء والتمثيل", subs: [
    ["plead", "Pleading, defending, claiming & litigating", "المرافعة والمدافعة والمطالبة والمخاصمة"],
    ["settle", "Conciliation, accepting/refusing arbitration & settlement", "المصالحة ورفض وقبول التحكيم والصلح"],
    ["appoint", "Appointing arbitrators & lawyers", "تعيين المحكمين والمحامين"],
    ["notary", "Representation before notaries & MoJ e-services", "التمثيل أمام كتابات العدل وخدمات وزارة العدل الإلكترونية"],
  ]},
  { key: "gov", en: "Government bodies & platforms", ar: "الجهات والمنصات الحكومية", subs: [
    ["chamber", "Chamber of Commerce (subscription, signature approval, documents)", "الغرفة التجارية (الاشتراك واعتماد التوقيع والمستندات)"],
    ["zakat", "ZATCA, GOSI & Civil Defense", "الزكاة والدخل والتأمينات والدفاع المدني"],
    ["licenses", "Issuing, renewing, amending & transferring licenses", "استخراج وتجديد وتعديل ونقل التراخيص"],
    ["tenders", "Entering tenders & receiving forms", "دخول المناقصات واستلام الاستمارات"],
    ["etimad", "Etimad, HRSD & CITC e-services", "منصة اعتماد وخدمات الموارد البشرية وهيئة الاتصالات"],
  ]},
  { key: "labor", en: "Workforce & residency", ar: "العمالة والاستقدام والإقامات", subs: [
    ["visas", "Visas: issuance, cancellation & refunds", "التأشيرات: استخراجها وإلغاؤها واسترداد مبالغها"],
    ["recruit", "Recruitment & opening files", "الاستقدام وفتح الملفات"],
    ["iqama", "Iqamas: issuance, renewal, exit/re-entry & final exit", "الإقامات: إصدارها وتجديدها والخروج والعودة والخروج النهائي"],
    ["sponsorship", "Sponsorship transfer & profession amendment", "نقل الكفالات وتعديل المهن"],
  ]},
  { key: "fundamental", en: "Contract amendments & fundamental decisions", ar: "تعديل عقد التأسيس والقرارات الجوهرية", subs: [
    ["capital", "Increasing / decreasing capital", "زيادة أو تخفيض رأس المال"],
    ["partners", "Partners entering & exiting; accepting stake waivers", "دخول وخروج الشركاء وقبول التنازل عن الحصص"],
    ["entity", "Changing the legal entity & mergers", "تغيير الكيان القانوني والاندماج"],
    ["liquidate", "Liquidating the company / converting it to an establishment", "تصفية الشركة أو تحويلها إلى مؤسسة"],
  ]},
];

// Multi-partner company formation: incorporation contract (عقد التأسيس)
// prepared and submitted through the Saudi Business Center, partners e-sign,
// then CR issuance — every partner is kept in the loop by email.
function buildFormationContract() {
  // Everything the client-side form builder (main.js) needs: partner types
  // with their per-type ID label + required attachments, the two exercise
  // modes from the contract, and the Article-5 power groups (FC_PERMS).
  // Sensitive by design: the form only renders after a dashboard sign-in.
  const fcConfig = {
    types: [
      { key: "saudi", label: Lraw("Saudi partner", "شريك سعودي"), id: Lraw("National ID number", "رقم الهوية الوطنية"), dob: true, files: [{ key: "nid", label: Lraw("National ID copy", "صورة الهوية الوطنية") }] },
      { key: "resident", label: Lraw("Resident partner (iqama)", "شريك مقيم (إقامة)"), id: Lraw("Iqama number", "رقم الإقامة"), dob: true, files: [{ key: "iqama", label: Lraw("Iqama copy", "صورة الإقامة") }, { key: "passport", label: Lraw("Passport", "جواز السفر") }] },
      { key: "foreign", label: Lraw("Foreign investor (individual)", "مستثمر أجنبي (فرد)"), id: Lraw("Passport number", "رقم جواز السفر"), dob: true, files: [{ key: "passport", label: Lraw("Passport", "جواز السفر") }] },
      { key: "company", label: Lraw("Foreign company (corporate partner)", "شركة أجنبية (شريك اعتباري)"), id: Lraw("CR / trade-license number", "رقم السجل التجاري أو الرخصة التجارية"), dob: false, files: [{ key: "cr", label: Lraw("CR or trade license copy", "صورة السجل التجاري أو الرخصة التجارية") }] },
    ],
    modes: [
      { key: "solo", label: Lraw("Exercised solely", "يمارسها منفرداً") },
      { key: "joint", label: Lraw("With all managers' approval", "يمارسها بموافقة كل المديرين") },
    ],
    tawkeel: Lraw("May delegate (tawkeel)", "يحق له التوكيل"),
    perms: FC_PERMS.map((g) => ({ key: g.key, label: Lraw(g.en, g.ar), subs: g.subs.map(([k, en, ar]) => ({ key: k, label: Lraw(en, ar) })) })),
  };
  const steps = [
    [1, L("Company & partners details", "بيانات الشركة والشركاء"), L("Proposed name, entity type and capital; every partner with their identity documents and share; and the managers with their Article-5 powers — behind your dashboard sign-in.", "الاسم والكيان ورأس المال؛ وكل شريك بهويته ومستنداته ونسبته؛ والمديرون بصلاحيات المادة الخامسة — عبر تسجيل الدخول للوحتك.")],
    [2, L("We draft the incorporation contract", "نصيغ عقد التأسيس"), L("A compliant عقد تأسيس drafted per the Companies Law and your shares.", "عقد تأسيس متوافق مع نظام الشركات وحصصكم.")],
    [3, L("Submission via the Saudi Business Center", "التقديم عبر المركز السعودي للأعمال"), L("We submit and track the contract through the Saudi Business Center until approval.", "نقدّم العقد ونتابعه عبر المركز السعودي للأعمال حتى الاعتماد.")],
    [4, L("Partners e-sign & CR issued", "الشركاء يوقّعون ويصدر السجل"), L("Every partner gets the signing invitation by email; we finish with CR issuance and next steps (bank account, licenses).", "كل شريك يستلم دعوة التوقيع على بريده؛ ونُكمل بإصدار السجل والخطوات التالية (الحساب البنكي، التراخيص).")],
  ].map((s) => `<div class="hstep"><span class="hstep-n">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join("");
  const body = `
  <section class="hero"><div class="container hero-inner">
    <span class="eyebrow">${L("Saudi Business Center", "عبر المركز السعودي للأعمال")}</span>
    <h1>${L("Founding a company with partners? We draft & submit the incorporation contract", "مؤسسين شركة بين شركاء؟ نصيغ عقد التأسيس ونقدّمه عنكم")}</h1>
    <p class="lead">${L("From the proposed name to partners' shares: we draft the incorporation contract, submit it through the Saudi Business Center, get every partner to e-sign — and keep everyone updated by email until the CR is issued.", "من الاسم المقترح إلى حصص الشركاء: نصيغ عقد التأسيس، نقدّمه عبر المركز السعودي للأعمال، ونرتب توقيع كل شريك إلكترونياً — مع إبقاء الجميع على اطلاع بالبريد حتى صدور السجل.")}</p>
    <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#fc-form">${L("Start the formation", "ابدأ التأسيس")}</a><a class="btn btn-ghost btn-lg" href="${u("/services/category/company-formation")}">${L("All formation services", "كل خدمات التأسيس")}</a></div>
    <div class="hero-badges">
      <span class="hero-badge">${I.check}${L("Compliant contract drafting", "صياغة عقد متوافقة")}</span>
      <span class="hero-badge">${I.check}${L("All partners e-sign", "توقيع إلكتروني لكل الشركاء")}</span>
      <span class="hero-badge">${I.check}${L("Followed to CR issuance", "متابعة حتى صدور السجل")}</span>
    </div>
  </div></section>

  <section class="section section--gray"><div class="container">
    <div class="section-head"><span class="eyebrow">${L("How it works", "كيف تعمل")}</span><h2>${L("From partners' agreement to a registered company", "من اتفاق الشركاء إلى شركة مسجّلة")}</h2></div>
    <div class="home-steps">${steps}</div>
    <div class="callout" style="max-width:760px;margin:28px auto 0"><span class="ico">💰</span><p>${L("Good to know: incorporation-contract publication and CR fees are among the fees Monsha'at's Estrdad refunds to compliant SMEs.", "معلومة تهمك: رسوم نشر عقد التأسيس وإصدار السجل من الرسوم التي تعيدها مبادرة «استرداد» للمنشآت الممتثلة.")} <a href="${u("/estrdad")}">${L("Fee refunds ←", "استرداد الرسوم ←")}</a></p></div>
  </div></section>

  <section class="section" id="fc-form"><div class="container" style="max-width:980px">
    <div class="section-head"><h2>${L("Start your company formation", "ابدأ تأسيس شركتكم")}</h2><p>${L("The full formation form: every partner's identity, documents and share, plus the managers' powers exactly as in the Ministry of Commerce articles of association.", "نموذج التأسيس الكامل: هوية كل شريك ومستنداته ونسبته، وصلاحيات المديرين كما في نظام الأساس المعتمد من وزارة التجارة.")}</p></div>
    <div class="callout" id="fc-gate" style="margin-bottom:16px"><span class="ico">🔒</span><p><strong>${L("This form is available after signing in.", "هذا النموذج متاح بعد تسجيل الدخول.")}</strong> ${L("Formation data is sensitive (IDs, passports, powers) so it's collected inside your client dashboard only — sign in or create a free account and you'll return here automatically.", "بيانات التأسيس حسّاسة (هويات، جوازات، صلاحيات) لذلك تُعبأ عبر لوحة العميل فقط — سجّل الدخول أو أنشئ حساباً مجانياً وسنعيدك لهذه الصفحة تلقائياً.")} <a href="${u("/account")}?redirect=formation">${L("Sign in / create account ←", "سجّل الدخول / أنشئ حساباً ←")}</a></p></div>
    <div id="fc-form-wrap" hidden>
    <div class="order-box">
      <form id="fc-form-el" novalidate>
        <h3 class="fc-step">${L("1 · Company details", "١ · بيانات الشركة")}</h3>
        <div class="cc-grid">
          <div class="field"><label for="fc-name">${L("Proposed company name", "اسم الشركة المقترح")} *</label><input type="text" id="fc-name" required></div>
          <div class="field"><label for="fc-type">${L("Entity type", "الكيان")}</label><select id="fc-type">
            <option value="llc">${Lraw("LLC (ذ.م.م)", "شركة ذات مسؤولية محدودة (ذ.م.م)")}</option>
            <option value="sjsc">${Lraw("Simplified JSC", "شركة مساهمة مبسطة")}</option>
            <option value="other">${Lraw("Other / advise me", "أخرى / انصحوني")}</option>
          </select></div>
          <div class="field"><label for="fc-capital">${L("Capital (SAR)", "رأس المال (ريال)")}</label><input type="number" id="fc-capital" min="0" placeholder="100000"></div>
          <div class="field"><label for="fc-activity">${L("Main activity", "النشاط الرئيسي")} *</label><input type="text" id="fc-activity" placeholder="${Lraw("e.g. general contracting", "مثال: مقاولات عامة")}"></div>
          <div class="field"><label for="fc-person">${L("Requester name", "اسم مقدّم الطلب")} *</label><input type="text" id="fc-person" required></div>
          <div class="field"><label for="fc-phone">${L("Mobile", "الجوال")} *</label><input type="tel" id="fc-phone" placeholder="05XXXXXXXX" required></div>
          <div class="field"><label for="fc-email">${L("Email", "البريد الإلكتروني")} *</label><input type="email" id="fc-email" required></div>
        </div>
        <h3 class="fc-step">${L("2 · Partners & their documents", "٢ · الشركاء ومستنداتهم")}</h3>
        <p class="mini">${L("For each partner: type (Saudi / resident / foreign investor / foreign company), Gregorian date of birth, short national address, share % — and the required attachment per type (national ID, iqama + passport, passport, or CR/trade license).", "لكل شريك: النوع (سعودي / مقيم / مستثمر أجنبي / شركة أجنبية)، تاريخ الميلاد بالميلادي، العنوان الوطني المختصر، نسبة الملكية — والمرفق المطلوب حسب النوع (هوية وطنية، إقامة + جواز، جواز سفر، أو سجل تجاري/رخصة تجارية).")}</p>
        <div id="fc-partners" class="fc-cards"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="fc-add-partner">＋ ${L("Add partner", "أضف شريكاً")}</button>
        <div class="calc-line" style="border:0;padding-top:6px"><span class="k" style="color:var(--text-soft)">${L("Shares total", "مجموع النسب")}</span><span class="v" id="fc-share-total" style="color:var(--navy)">0%</span></div>
        <h3 class="fc-step">${L("3 · Managers & their powers (Article 5)", "٣ · المديرون وصلاحياتهم (المادة الخامسة)")}</h3>
        <p class="mini">${L("Pick the manager (a partner or external), then open each power bar and set: exercise mode (solely / with all managers' approval), delegation right, and the sub-powers — exactly as they appear in the articles of association.", "حدد المدير (من الشركاء أو خارجي)، ثم افتح شريط كل صلاحية أساسية وحدد: طريقة الممارسة (منفرداً / بموافقة كل المديرين)، حق التوكيل، والصلاحيات الفرعية — كما تُكتب حرفياً في نظام الأساس.")}</p>
        <div id="fc-managers" class="fc-cards"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="fc-add-manager">＋ ${L("Add manager", "أضف مديراً")}</button>
        <p class="mini" style="margin-top:14px">🔐 ${L("Attachments go encrypted over HTTPS straight to the formation team; nothing is stored in your browser. Max 2.5MB per file (PDF/JPG/PNG).", "المرفقات تُرسل مشفّرة عبر HTTPS مباشرة إلى فريق التأسيس ولا تُخزّن في متصفحك. الحد الأقصى 2.5 م.ب للملف (PDF/JPG/PNG).")}</p>
        <button type="submit" class="btn btn-primary btn-lg">${L("Send the formation request", "أرسل طلب التأسيس")}</button>
        <div class="form-success" id="fc-success" hidden></div>
      </form>
    </div>
    </div>
    <script>window.FC_CONFIG=${JSON.stringify(fcConfig).replace(/</g, "\\u003c")};</script>
  </div></section>`;
  return page({ title: Lraw("Company formation with partners (incorporation contract) — Business Partner", "تأسيس الشركات بين الشركاء (عقد التأسيس) — بيزنس بارتنر"), desc: Lraw("We draft the incorporation contract, submit via the Saudi Business Center, and get every partner to e-sign.", "نصيغ عقد التأسيس ونقدّمه عبر المركز السعودي للأعمال وننسق توقيع كل الشركاء إلكترونياً."), active: "/formation-contract", path: "/formation-contract", body });
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
          <div class="cart-totals-block">
          <div class="calc-line"><span class="k">${L("Subtotal (fees)", "المجموع (الأتعاب)")}</span><span class="v" id="cart-subtotal">—</span></div>
          <div class="calc-line"><span class="k">${L("VAT 15%", "ضريبة القيمة المضافة 15%")}</span><span class="v" id="cart-vat">—</span></div>
          <div class="calc-total"><span class="k">${L("Total", "الإجمالي")}</span><span class="v" id="cart-total">—</span></div>
          </div>
          <a class="btn btn-primary btn-lg" id="cart-checkout" href="${u("/checkout")}" style="width:100%">${L("Checkout", "إتمام الطلب")}</a>
          <p class="mini" id="cart-signin-note" hidden style="color:var(--navy)">${L("You'll create a free account (or sign in) to complete your purchase — every order is saved to your dashboard under \"My orders\".", "ستنشئ حساباً مجانياً (أو تسجّل الدخول) لإكمال الشراء — ويُحفظ كل طلب في لوحتك ضمن «طلباتي».")}</p>
          <p class="mini">${L("Payment is by bank transfer: you upload the transfer receipt at checkout and we activate right after confirming it.", "الدفع بالتحويل البنكي: ترفع إيصال التحويل عند إتمام الطلب ونفعّل خدمتك فور تأكيده.")}</p>
          <p class="mini">💳 <a href="${u("/account")}">${L("Pay from your wallet", "اسدد من محفظتك")}</a></p>
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
            <div class="field"><label for="co-email">${L("Email *", "البريد الإلكتروني *")}</label><input id="co-email" name="email" type="email" required></div>
            <div class="field"><label for="co-entity" id="co-entity-label">${L("Company / entity (optional)", "المنشأة (اختياري)")}</label><input id="co-entity" name="entity" type="text"></div>
          </div>
          <div id="pkg-details-box" class="field-group" hidden>
            <h2>${L("Establishment details", "بيانات المنشأة")}</h2>
            <div class="grid grid-2" style="gap:0 20px">
              <div class="field"><label for="co-cr">${L("Commercial Registration (unified) number", "رقم السجل التجاري (الموحد)")}</label><input id="co-cr" name="cr" type="text" inputmode="numeric"></div>
              <div class="field"><label for="co-headcount">${L("Number of employees", "عدد الموظفين")}</label><input id="co-headcount" name="headcount" type="number" min="1" value="1"></div>
            </div>
            <div class="field"><label for="co-address">${L("National address (optional)", "العنوان الوطني (اختياري)")}</label><input id="co-address" name="address" type="text"></div>
            <p class="calc-note" id="pkg-surcharge-note" hidden></p>
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
          <h2>${L("Upload transfer receipt", "ارفع إيصال التحويل")} <span class="req-star">*</span></h2>
          <div class="field">
            <label class="file-drop" for="co-receipt" id="receipt-drop"><span class="file-ico">${I.upload}</span>
              <span class="file-text" id="receipt-filename">${L("Bank transfer receipt — a screenshot/image is fastest (auto-verified), or PDF — same amount as your order total", "إيصال التحويل البنكي — صورة (لقطة شاشة) هي الأسرع (تحقق تلقائي)، أو PDF — بنفس قيمة إجمالي طلبك")}</span></label>
            <input id="co-receipt" name="receipt" type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/*" required hidden>
          </div>
          <p class="calc-note" id="receipt-required-note">${L("Required: a bank receipt (image or PDF) showing a transfer of the exact order total. An image (screenshot) is verified automatically in minutes; PDF may need a short manual check. Orders without a matching receipt won't be activated.", "إلزامي: إيصال تحويل بنكي (صورة أو PDF) يوضح تحويل مبلغ يطابق إجمالي الطلب تماماً. الصورة (لقطة الشاشة) يتم التحقق منها تلقائياً خلال دقائق، أما PDF فقد يحتاج مراجعة يدوية سريعة. الطلبات بدون إيصال مطابق لن تُفعّل.")}</p>
          <label class="req-checkbox"><input type="checkbox" id="co-terms" required><span>${L("I acknowledge and agree to the", "أقر وأوافق على")} <a href="${u("/terms")}" target="_blank" rel="noopener">${L("Terms & Conditions", "الشروط والأحكام")}</a></span></label>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Submit order", "أرسل الطلب")}</button>
          <p class="form-note">${L("On submit we save your order to your account on this device, upload your receipt to our team's system for verification, and open WhatsApp to notify our team.", "عند الإرسال نحفظ طلبك في حسابك على هذا الجهاز، ونرفع إيصالك لنظام فريقنا للتحقق، ونفتح واتساب لإشعار فريقنا.")}</p>
          <div class="form-success" id="checkout-success" hidden></div>
        </form>
      </div>
      <aside class="cart-aside">
        <div class="order-box">
          <h3>${L("Order summary", "ملخص الطلب")}</h3>
          <div id="checkout-items"></div>
          <div class="cart-totals-block">
          <div class="calc-line"><span class="k">${L("Subtotal (fees)", "المجموع (الأتعاب)")}</span><span class="v" id="co-subtotal">—</span></div>
          <div class="calc-line"><span class="k">${L("VAT 15%", "ضريبة القيمة المضافة 15%")}</span><span class="v" id="co-vat">—</span></div>
          <div class="calc-total"><span class="k">${L("Total", "الإجمالي")}</span><span class="v" id="co-total">—</span></div>
          </div>
          <a class="btn btn-ghost" href="${u("/cart")}" style="width:100%">${L("Edit cart", "تعديل السلة")}</a>
        </div>
      </aside>
    </div>
  </div></section>`;
  return page({ title: Lraw("Checkout — Business Partner", "إتمام الطلب — بيزنس بارتنر"), desc: Lraw("Complete your order by bank transfer and upload your documents and the transfer receipt.", "أكمل طلبك عبر التحويل البنكي وارفع مستنداتك وإيصال التحويل."), active: "/cart", path: "/checkout", body });
}

function buildTerms() {
  const tm = site.terms;
  const sections = tm.sections
    .map((s) => {
      let inner = "";
      if (s.body || s.bodyEn) inner = `<p>${L(s.bodyEn || s.body, s.body)}</p>`;
      else if (s.items) {
        inner = `<dl class="terms-defs">${s.items
          .map(([ar, arDesc, en, enDesc]) => `<div><dt>${L(en, ar)}</dt><dd>${L(enDesc, arDesc)}</dd></div>`)
          .join("")}</dl>`;
      } else if (s.list) {
        inner = `<ol class="terms-list">${s.list.map(([ar, en]) => `<li>${L(en, ar)}</li>`).join("")}</ol>`;
      }
      return `<div class="terms-section"><h2>${L(s.titleEn, s.title)}</h2>${inner}</div>`;
    })
    .join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Legal", "قانوني")}</span>
    <h1>${L(tm.titleEn, tm.title)}</h1>
    <p class="lead">${L(tm.introEn, tm.intro)}</p>
    <p class="mini text-soft">${L("Last updated", "آخر تحديث")}: ${L(tm.updatedEn, tm.updated)}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:860px">
    ${sections}
    <div class="callout" style="margin-top:20px"><span class="ico">💡</span><p>${L(tm.noteEn, tm.note)}</p></div>
  </div></section>
  <style>
    .terms-section{margin-bottom:32px}
    .terms-section h2{color:var(--navy);font-size:1.25rem;margin-bottom:14px}
    .terms-defs{display:grid;gap:16px}
    .terms-defs dt{font-weight:700;color:var(--navy);margin-bottom:4px}
    .terms-defs dd{margin:0;color:var(--text);line-height:1.8}
    .terms-list{padding-inline-start:22px;display:grid;gap:12px;color:var(--text);line-height:1.8}
    .terms-list li::marker{color:var(--navy);font-weight:700}
  </style>`;
  return page({
    title: Lraw("Terms & Conditions — Business Partner", "الشروط والأحكام — بيزنس بارتنر"),
    desc: Lraw("The terms and conditions governing subscriptions and purchases with Business Partner.", "الشروط والأحكام التي تحكم الاشتراكات والمشتريات مع بيزنس بارتنر."),
    active: "/terms",
    path: "/terms",
    body,
  });
}

// Company-documents vault shown in the client dashboard. A multi-step wizard
// (back/next) that lets the client attach every establishment document — all
// optional. Files are referenced by name (same as order attachments — the
// static site has no binary store); the checklist state + any links/notes are
// saved to localStorage (bp_docs) and can be sent to the team, who then
// collect the actual files via WhatsApp. Steps/items are bilingual data so the
// list stays easy to maintain.
const DOC_STEPS = [
  {
    ar: "السجل والتأسيس", en: "Registration & incorporation",
    items: [
      { k: "cr", ar: "السجل التجاري", en: "Commercial Registration (CR)", hAr: "سعودي أو أجنبي — أرفق الملف وألصق رابط الباركود إن وُجد", hEn: "Saudi or foreign — attach the file and paste the barcode link if any", link: true },
      { k: "aoa", ar: "عقد تأسيس الشركة", en: "Articles of Association", hAr: "عقد التأسيس الموثّق", hEn: "The notarised incorporation contract" },
      { k: "chamber", ar: "شهادة اشتراك الغرفة التجارية", en: "Chamber of Commerce membership" },
    ],
  },
  {
    ar: "الشهادات الحكومية", en: "Government certificates",
    items: [
      { k: "national-address", ar: "شهادة إثبات العنوان الوطني", en: "National Address certificate" },
      { k: "zakat", ar: "شهادة الزكاة", en: "Zakat certificate" },
      { k: "vat", ar: "شهادة الضريبة (القيمة المضافة)", en: "VAT certificate" },
      { k: "gosi-cert", ar: "شهادة التأمينات الاجتماعية", en: "GOSI certificate" },
    ],
  },
  {
    ar: "قوى والتأمينات", en: "Qiwa & GOSI files",
    items: [
      { k: "wps", ar: "شهادة حماية الأجور (قوى)", en: "Wage Protection certificate (Qiwa)" },
      { k: "qiwa-debts", ar: "شهادة المديونيات (قوى)", en: "Liabilities certificate (Qiwa)" },
      { k: "gosi-excel", ar: "ملف التأمينات الاجتماعية (Excel)", en: "GOSI file (Excel)", hAr: "ملف الموظفين المُصدَّر من التأمينات", hEn: "The employees file exported from GOSI" },
      { k: "employee-contracts", ar: "عقود الموظفين (قوى)", en: "Employee contracts (Qiwa)", multiple: true, hAr: "يمكن إرفاق أكثر من ملف", hEn: "You can attach more than one file" },
    ],
  },
  {
    ar: "هويات المدير والملاك", en: "Manager & owners IDs",
    items: [
      { k: "manager-id", ar: "هوية المدير", en: "Manager ID", idType: true },
    ],
    owners: true,
  },
];
function docFileRow(it) {
  const label = LANG === "ar" ? it.ar : it.en;
  const hint = LANG === "ar" ? it.hAr : it.hEn;
  const idSel = it.idType
    ? `<select class="doc-idtype" data-docidtype="${it.k}" aria-label="${Lraw("ID type", "نوع الهوية")}">
        <option value="">${Lraw("ID type", "نوع الهوية")}</option>
        <option value="national">${Lraw("Saudi national ID", "هوية وطنية سعودية")}</option>
        <option value="iqama">${Lraw("Residency (Iqama)", "إقامة")}</option>
        <option value="passport">${Lraw("Passport", "جواز سفر")}</option>
      </select>`
    : "";
  return `<div class="docrow" data-doc="${it.k}">
    <div class="docrow-info"><span class="docrow-title">${label}</span>${hint ? `<span class="docrow-hint">${hint}</span>` : ""}${idSel}</div>
    <div class="docrow-actions">
      <label class="doc-file"><input type="file" data-docfile="${it.k}"${it.multiple ? " multiple" : ""} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" hidden><span class="doc-file-btn">📎 <span data-docname="${it.k}">${L("Choose file", "اختر ملف")}</span></span></label>
      ${it.link ? `<input type="url" class="doc-link" data-doclink="${it.k}" placeholder="${Lraw("Barcode link (optional)", "رابط الباركود (اختياري)")}">` : ""}
      <span class="doc-clear" data-docclear="${it.k}" role="button" tabindex="0" hidden aria-label="${Lraw("Remove", "إزالة")}">✕</span>
    </div>
  </div>`;
}
function docsWizard() {
  const steps = DOC_STEPS.map((st, i) => {
    const rows = st.items.map(docFileRow).join("");
    const owners = st.owners
      ? `<div class="doc-owners-wrap">
          <div class="docrow-info" style="margin-bottom:8px"><span class="docrow-title">${L("Owners' IDs", "هويات الملّاك")}</span><span class="docrow-hint">${L("Add each owner — national ID, residency or passport.", "أضف كل مالك — هوية وطنية أو إقامة أو جواز سفر.")}</span></div>
          <div id="doc-owners"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="doc-add-owner">＋ ${L("Add owner", "أضف مالكاً")}</button>
        </div>`
      : "";
    return `<div class="docwiz-step" data-step="${i}"${i > 0 ? " hidden" : ""}>
      <h3 class="docwiz-step-title">${L(st.en, st.ar)}</h3>
      <div class="doc-rows">${rows}</div>
      ${owners}
    </div>`;
  }).join("");
  const dots = DOC_STEPS.map((st, i) => `<span class="docwiz-dot${i === 0 ? " active" : ""}" data-dot="${i}" title="${L(st.en, st.ar)}"></span>`).join("");
  return `<div id="docs-wizard" data-total="${DOC_STEPS.length}">
    <p class="calc-note" style="color:var(--text-soft);margin:0 0 14px">${L("All documents are optional. Your entries are saved on this device as you go — use Back/Next to move between sections.", "كل المستندات اختيارية. تُحفظ إدخالاتك على هذا الجهاز أولاً بأول — استخدم السابق/التالي للتنقل بين الأقسام.")}</p>
    <div class="docwiz-dots">${dots}</div>
    ${steps}
    <div class="docwiz-nav">
      <button type="button" class="btn btn-ghost" data-docwiz-back hidden>${L("← Back", "→ السابق")}</button>
      <span class="docwiz-progress">${L("Step", "الخطوة")} <b data-docwiz-cur>1</b> ${L("of", "من")} ${DOC_STEPS.length}</span>
      <button type="button" class="btn btn-primary" data-docwiz-next>${L("Next →", "التالي ←")}</button>
      <button type="button" class="btn btn-primary" data-docwiz-send hidden>${L("Save & send to team", "حفظ وإرسال للفريق")}</button>
    </div>
    <div class="form-success" id="docs-sent" hidden></div>
  </div>`;
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
    <div class="callout" id="checkout-redirect-note" style="max-width:640px;margin:0 auto 24px" hidden><span class="ico">🛒</span><p>${L("Sign in or create an account to continue with your purchase — this keeps every order tied to a real customer record.", "سجّل دخولك أو أنشئ حساباً لإكمال عملية الشراء — هذا يضمن ربط كل طلب بسجل عميل حقيقي.")}</p></div>
    <div class="callout" id="quote-redirect-note" style="max-width:640px;margin:0 auto 24px" hidden><span class="ico">📋</span><p>${L("Sign in or create an account to send your official quote request — it will appear in your dashboard and our team will get back to you with the offer.", "سجّل دخولك أو أنشئ حساباً لإرسال طلب العرض الرسمي — سيظهر الطلب في لوحتك وفريقنا يعود لك بالعرض.")}</p></div>
    <div class="callout" id="fc-redirect-note" style="max-width:640px;margin:0 auto 24px" hidden><span class="ico">🔒</span><p>${L("Formation data (IDs, passports, managers' powers) is sensitive, so the formation form opens after sign-in only — sign in or create a free account and we'll take you straight back to it.", "بيانات التأسيس (هويات، جوازات، صلاحيات المديرين) حسّاسة، لذلك نموذج التأسيس يفتح بعد تسجيل الدخول فقط — سجّل دخولك أو أنشئ حساباً مجانياً وسنعيدك إليه مباشرة.")}</p></div>
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

    <div class="dash" id="account-dash" hidden>
      <aside class="dash-side">
        <div class="dash-user">
          <div class="dash-avatar" id="dash-avatar">BP</div>
          <div><strong id="dash-hello">${L("Welcome", "مرحباً")}</strong><span id="dash-email" class="text-soft"></span></div>
        </div>
        <nav class="dash-nav">
          <button type="button" class="dash-navi active" data-panel="overview">${I.building}<span>${L("Overview", "الرئيسية")}</span></button>
          <button type="button" class="dash-navi" data-panel="orders">${I.cart}<span>${L("My orders", "طلباتي")}</span><span class="dash-badge" id="nav-orders-badge" hidden>0</span></button>
          <button type="button" class="dash-navi" data-panel="wallet">💳<span>${L("My wallet", "محفظتي")}</span></button>
          <button type="button" class="dash-navi" data-panel="package">${I.check}<span>${L("My package", "باقتي")}</span></button>
          <button type="button" class="dash-navi" data-panel="company">${I.doc}<span>${L("Company profile", "بيانات المنشأة")}</span></button>
          <button type="button" class="dash-navi" data-panel="documents">${I.upload}<span>${L("My documents", "مستنداتي")}</span></button>
          <button type="button" class="dash-navi" data-panel="support">${I.mail}<span>${L("Support", "الدعم")}</span></button>
        </nav>
        <button type="button" class="btn btn-ghost dash-logout" id="logout-btn">${L("Sign out", "تسجيل الخروج")}</button>
      </aside>

      <div class="dash-main">
        <!-- Overview -->
        <div class="dash-panel active" id="panel-overview">
          <div class="dash-panel-head"><h2>${L("Task centre", "مركز المهام")}</h2><p>${L("Track all your government obligations and orders for your establishment.", "تابع جميع التزاماتك الحكومية وطلبات منشأتك في مكان واحد.")}</p></div>
          <div class="dash-stats">
            <div class="dash-stat"><span class="ds-ico">🧾</span><strong id="stat-total">0</strong><span>${L("Total orders", "إجمالي الطلبات")}</span></div>
            <div class="dash-stat"><span class="ds-ico">⏳</span><strong id="stat-active">0</strong><span>${L("In progress", "قيد التنفيذ")}</span></div>
            <div class="dash-stat"><span class="ds-ico">✅</span><strong id="stat-done">0</strong><span>${L("Completed", "منتهية")}</span></div>
          </div>
          <div class="dash-quick">
            <a class="btn btn-primary" href="${u("/services")}">＋ ${L("Request a new service", "طلب خدمة جديدة")}</a>
            <a class="btn btn-ghost" href="${u("/consultation")}">${I.calendar}<span>${L("Book a consultation", "جدولة استشارة")}</span></a>
          </div>
          <div class="dash-card"><h3>${L("Your portals & services", "بواباتك وخدماتك")}</h3>
            <div class="portal-grid">
              <a class="portal-card" href="${u("/services")}"><span>🗂️</span><strong>${L("Request a service", "اطلب خدمة")}</strong></a>
              <a class="portal-card" href="${u("/packages")}"><span>📦</span><strong>${L("Packages", "الباقات")}</strong></a>
              <a class="portal-card" href="${u("/mahfol-makfol/trips")}"><span>🧳</span><strong>${L("Trips & experiences", "الرحلات والتجارب")}</strong></a>
              <a class="portal-card" href="${u("/mahfol-makfol")}"><span>🌍</span><strong>${L("Business tourism", "سياحة الأعمال")}</strong></a>
              <a class="portal-card" href="${u("/tourism")}"><span>🎉</span><strong>${L("Company events", "فعاليات الشركات")}</strong></a>
              <a class="portal-card" href="${u("/consultation")}"><span>📅</span><strong>${L("Book consultation", "احجز استشارة")}</strong></a>
              <a class="portal-card" href="${u(COMPLIANCE_PORTAL_URL)}"><span>🛡️</span><strong>${L("Compliance Agent", "وكيل الامتثال")}</strong></a>
              <a class="portal-card" href="${u("/employer-dashboard")}"><span>🧑‍💼</span><strong>${L("AI Recruitment", "التوظيف الذكي")}</strong></a>
              <a class="portal-card" href="${u("/workspaces")}"><span>🏢</span><strong>${L("Office spaces", "المكاتب ومساحات العمل")}</strong></a>
              <a class="portal-card" href="${u("/suppliers")}"><span>🚚</span><strong>${L("Partners portal", "بوابة الشركاء")}</strong></a>
              <a class="portal-card" id="ai-employees-link" href="${u("/portal")}"><span>🤖</span><strong>${L("Smart Specialized Agent", "الموظف المتخصص")}</strong></a>
              <a class="portal-card" href="${u("/shared-services")}"><span>🤝</span><strong>${L("Shared Services", "الخدمات المشتركة")}</strong></a>
              <a class="portal-card" href="${u("/bank-account")}"><span>🏦</span><strong>${L("Open a bank account", "فتح حساب بنكي")}</strong></a>
              <a class="portal-card" href="${u("/estrdad")}"><span>💰</span><strong>${L("Fee refunds (Estrdad)", "استرداد الرسوم")}</strong></a>
              <a class="portal-card" href="${u("/formation-contract")}#fc-form"><span>🖋️</span><strong>${L("Partners formation", "تأسيس بين شركاء")}</strong></a>
            </div>
          </div>
          <div class="dash-card"><h3>${L("Recent orders", "أحدث الطلبات")}</h3><div id="ov-orders"><p class="dash-empty">${L("No orders yet — browse the services to get started.", "لا توجد طلبات بعد — تصفّح الخدمات للبدء.")}</p></div></div>
        </div>

        <!-- Orders -->
        <div class="dash-panel" id="panel-orders">
          <div class="dash-panel-head"><h2>${L("My orders", "طلباتي")}</h2><p>${L("Every order you placed, with its bank-transfer reference and status.", "كل طلب قدّمته، مع رقمه المرجعي وحالته.")}</p></div>
          <div id="all-orders"><p class="dash-empty">${L("No orders yet.", "لا توجد طلبات بعد.")}</p></div>
        </div>

        <!-- Wallet: top up by bank transfer (team confirms the receipt, balance
             credits automatically via the same live-status sync as orders), then
             spend the balance on government-fee payments we execute for you. -->
        <div class="dash-panel" id="panel-wallet">
          <div class="dash-panel-head"><h2>${L("My wallet", "محفظتي")}</h2><p>${L("Top up your wallet and we pay your government fees from it — no transfer needed per transaction.", "اشحن محفظتك ونسدد عنك رسومك الحكومية منها — بدون تحويل جديد لكل عملية.")}</p></div>
          <div class="dash-stats">
            <div class="dash-stat"><span class="ds-ico">💰</span><strong id="wal-balance">0 ﷼</strong><span>${L("Available balance", "الرصيد المتاح")}</span></div>
            <div class="dash-stat"><span class="ds-ico">⏳</span><strong id="wal-pending">0 ﷼</strong><span>${L("Pending top-ups", "شحن قيد التأكيد")}</span></div>
            <div class="dash-stat"><span class="ds-ico">🏛️</span><strong id="wal-spent">0 ﷼</strong><span>${L("Fees paid for you", "رسوم سُددت عنك")}</span></div>
          </div>

          <div class="dash-card">
            <h3>💳 ${L("Top up the wallet", "اشحن المحفظة")}</h3>
            <p class="text-soft" style="margin-bottom:14px">${L("Transfer the amount to our account, upload the receipt, and the balance is credited as soon as the team confirms it (usually within minutes during work hours).", "حوّل المبلغ على حسابنا، ارفع الإيصال، ويُضاف الرصيد فور تأكيد الفريق (عادة خلال دقائق في أوقات الدوام).")}</p>
            <div class="bank-box" style="margin-bottom:14px">
              <div class="bank-head">${I.bank}<strong>${L("Bank transfer details", "بيانات التحويل البنكي")}</strong></div>
              <ul class="bank-list">
                <li><span class="k">${L("Beneficiary", "المستفيد")}</span><span class="v">${L(site.bank.beneficiaryEn || site.bank.beneficiary, site.bank.beneficiary)}</span></li>
                <li><span class="k">${L("Bank", "البنك")}</span><span class="v">${L(site.bank.bankNameEn || site.bank.bankName, site.bank.bankName)}</span></li>
                <li><span class="k">IBAN</span><span class="v mono">${esc(site.bank.iban)}</span><button type="button" class="copy-btn" data-copy="${esc(site.bank.iban)}">📋 ${L("Copy", "نسخ")}</button></li>
              </ul>
            </div>
            <form id="wal-topup-form" novalidate>
              <div class="cc-grid">
                <div class="field"><label for="wal-amount">${L("Top-up amount (SAR)", "مبلغ الشحن (ريال)")}</label><input type="number" id="wal-amount" min="50" step="50" placeholder="1000"></div>
                <div class="field"><label for="wal-receipt">${L("Transfer receipt (image or PDF)", "إيصال التحويل (صورة أو PDF)")}</label><input type="file" id="wal-receipt" accept=".pdf,image/*"></div>
              </div>
              <button type="submit" class="btn btn-primary">${L("Submit top-up request", "أرسل طلب الشحن")}</button>
              <div class="form-success" id="wal-topup-success" hidden></div>
            </form>
            <p class="mini" style="margin-top:10px">${L("Card / Apple Pay top-up is coming once the payment gateway goes live.", "الشحن بالبطاقة / أبل باي قادم فور تفعيل بوابة الدفع الإلكتروني.")}</p>
          </div>

          <!-- Government-fee payment ("سداد الخدمات الحكومية") removed at owner's request — to be re-added later. -->

          <div class="dash-card"><h3>${L("Wallet transactions", "حركات المحفظة")}</h3><div id="wal-list"><p class="dash-empty">${L("No wallet transactions yet.", "لا توجد حركات بعد.")}</p></div></div>
          <div class="callout"><span class="ico">💰</span><p>${L("Fees we pay for you (chamber, municipal, licenses…) may be refundable via Monsha'at's Estrdad initiative — if your establishment stays compliant.", "الرسوم التي نسددها عنك (الغرفة، البلدية، التراخيص…) قد تكون قابلة للاسترداد عبر مبادرة «استرداد» من منشآت — بشرط بقاء منشأتك ممتثلة.")} <a href="${u("/estrdad")}">${L("Check your eligibility ←", "تحقق من أهليتك ←")}</a></p></div>
        </div>

        <!-- Package -->
        <div class="dash-panel" id="panel-package">
          <div class="dash-panel-head"><h2>${L("My package", "باقتي")}</h2><p>${L("Your active package and what it includes.", "باقتك الحالية وما تشمله.")}</p></div>
          <div id="pkg-box"><div class="dash-card"><p class="dash-empty">${L("You have no active package yet.", "لا توجد لديك باقة مفعّلة بعد.")}</p><a class="btn btn-primary" href="${u("/packages")}">${L("View packages", "استعرض الباقات")}</a></div></div>
        </div>

        <!-- Company profile -->
        <div class="dash-panel" id="panel-company">
          <div class="dash-panel-head"><h2>${L("Company profile", "بيانات المنشأة")}</h2><p>${L("Complete your establishment file so our team has everything ready.", "أكمل ملف منشأتك ليكون لدى فريقنا كل ما يلزم.")}</p></div>
          <div class="dash-card">
            <div class="dash-progress"><span id="co-progress-bar"></span></div>
            <p class="dash-progress-label"><span id="co-progress-count">0/6</span> ${L("fields completed", "حقول مكتملة")}</p>
            <form id="company-form" class="calc-form">
              <div class="grid grid-2" style="gap:0 20px">
                <div class="field"><label for="co-name2">${L("Establishment name", "اسم المنشأة")}</label><input id="co-name2" data-k="name" type="text"></div>
                <div class="field"><label for="co-cr">${L("Commercial Registration (CR)", "رقم السجل التجاري")}</label><input id="co-cr" data-k="cr" type="text" inputmode="numeric"></div>
              </div>
              <div class="grid grid-2" style="gap:0 20px">
                <div class="field"><label for="co-city2">${L("City", "المدينة")}</label><input id="co-city2" data-k="city" type="text"></div>
                <div class="field"><label for="co-vat">${L("Tax (VAT) number", "الرقم الضريبي")}</label><input id="co-vat" data-k="vat" type="text" inputmode="numeric"></div>
              </div>
              <div class="grid grid-2" style="gap:0 20px">
                <div class="field"><label for="co-activity2">${L("Main activity", "النشاط الرئيسي")}</label><input id="co-activity2" data-k="activity" type="text"></div>
                <div class="field"><label for="co-size">${L("Employees", "عدد الموظفين")}</label><input id="co-size" data-k="size" type="number" min="0"></div>
              </div>
              <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Save profile", "حفظ البيانات")}</button>
              <div class="form-success" id="company-saved" hidden>${L("Saved on this device ✓", "حُفظت على هذا الجهاز ✓")}</div>
            </form>
          </div>
        </div>

        <!-- Documents -->
        <div class="dash-panel" id="panel-documents">
          <div class="dash-panel-head"><h2>${L("Company documents", "مستندات المنشأة")}</h2><p>${L("Attach your establishment's documents so our team has your full file ready. Everything here is optional — add what you have now and complete the rest later.", "أرفق مستندات منشأتك ليكون ملفك كاملاً لدى فريقنا. كل ما هنا اختياري — أضف ما لديك الآن وأكمل الباقي لاحقاً.")}</p></div>
          <div class="dash-card">
            ${docsWizard()}
          </div>
          <div class="dash-card" style="margin-top:16px">
            <h3 style="margin:0 0 6px">${L("Files attached to your orders", "الملفات المرفقة بطلباتك")}</h3>
            <div id="all-uploads"><p class="dash-empty">${L("No order attachments yet — you can also attach files when placing an order.", "لا توجد مرفقات طلبات بعد — يمكنك أيضاً إرفاق ملفات عند تقديم طلب.")}</p></div>
            <a class="btn btn-ghost" href="${u("/compliance-agent")}" style="margin-top:12px">🛡️ ${L("Subscribe to the Compliance Agent", "اشترك في وكيل الامتثال")}</a>
          </div>
        </div>

        <!-- Support -->
        <div class="dash-panel" id="panel-support">
          <div class="dash-panel-head"><h2>${L("Support", "مركز الدعم")}</h2><p>${L("We're here to help — reach us any time.", "نحن هنا لمساعدتك — تواصل معنا في أي وقت.")}</p></div>
          <div class="dash-card">
            <a class="btn btn-primary" href="${u("/consultation")}" style="width:100%">${I.calendar}<span>${L("Book a consultation", "احجز استشارة")}</span></a>
            <a class="btn btn-ghost" href="${u("/contact")}" style="width:100%;margin-top:10px">${L("Contact us", "اتصل بنا")}</a>
          </div>
        </div>

        <div class="callout" style="margin-top:20px"><span class="ico">💡</span><p>${L("Sign-in still lives on this device, but each order's status now syncs live from our team once payment is confirmed.", "الدخول للحساب لا يزال محفوظاً على جهازك، لكن حالة كل طلب تتزامن الآن مباشرة من فريقنا فور تأكيد الدفع.")}</p></div>
      </div>
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
        <p class="form-note">🕐 ${L(b.hoursNoteEn, b.hoursNote)}</p>
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
          <p class="mini">${L("Prefer chatting? Tap the assistant button at the bottom of the page — it replies 24/7.", "تفضّل المحادثة؟ اضغط زر المساعد أسفل الصفحة — يرد على مدار الساعة.")}</p>
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
    <span class="eyebrow">${L("Partners portal", "بوابة الشركاء")}</span>
    <h1>${L("Join the Business Partner network", "انضم كشريك لدى بيزنس بارتنر")}</h1>
    <p class="lead">${L("We send our clients' event and service requests to registered suppliers and collect competing offers. Register once — receive matching requests.", "نرسل طلبات عملائنا (فعاليات وخدمات) للموردين المسجّلين ونجمع العروض المنافسة. سجّل مرة واحدة — وتصلك الطلبات المناسبة لنشاطك.")}</p>
  </div></section>
  <section class="section"><div class="container">
    <div class="booking-wrap">
      <form class="calc-form" id="supplier-form" novalidate>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2 style="margin:0">${L("Partner registration", "تسجيل الشركاء")}</h2><a class="btn btn-ghost btn-sm" href="${u("/partner-dashboard")}">${L("Already a partner? Open dashboard →", "شريك بالفعل؟ افتح اللوحة ←")}</a></div>
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
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Register as a partner", "سجّل كشريك")}</button>
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
  return page({ title: Lraw("Partners portal — Business Partner", "بوابة الشركاء — بيزنس بارتنر"), desc: Lraw("Register as a Business Partner partner and receive matching client requests.", "سجّل كشريك لدى بيزنس بارتنر وتصلك طلبات العملاء المناسبة لنشاطك."), active: "/suppliers", path: "/suppliers", body });
}

// Partner dashboard — the operational side of the partners portal, wired to the
// client side: client orders/requests (bp_orders, the same store the client
// dashboard uses) surface here as opportunities the partner can bid on. A
// partner "logs in" with company + email (demo session in bp_partner, same
// device-local pattern as the client account); matched requests are also
// routed by the team/n8n once the partner is activated. Submitting an offer
// POSTs to /api/requests (type: partner-offer).
function buildPartnerDashboard() {
  const cats = ["فعاليات ومؤتمرات", "قاعات ومواقع", "ضيافة وكيترينق", "أنشطة خارجية", "نقل ولوجستيات", "تصوير وإعلام", "رحلات شركات", "أخرى"];
  const catOpts = cats.map((c) => `<option>${esc(c)}</option>`).join("");
  const body = `
  <section class="hero hero--sm"><div class="container hero-inner">
    <span class="eyebrow">${L("Partners portal", "بوابة الشركاء")}</span>
    <h1>${L("Partner dashboard", "لوحة الشركاء")}</h1>
    <p class="lead">${L("Your live feed of client requests. When a client places a request or buys on the site, matching opportunities show up here so you can send an offer.", "متابعتك المباشرة لطلبات العملاء. عندما يطلب عميل أو يشتري خدمة على الموقع، تظهر الفرص المطابقة هنا لتقدّم عرضك.")}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:1000px">

    <!-- Login gate (no partner session) -->
    <div id="partner-gate">
      <div class="dash-card" style="max-width:520px;margin:0 auto">
        <h2>${L("Partner sign in", "دخول الشركاء")}</h2>
        <p class="text-soft" style="margin-bottom:14px">${L("Enter your company and the email you registered with to open your dashboard.", "أدخل اسم شركتك والبريد الذي سجّلت به لفتح لوحتك.")}</p>
        <form id="partner-login-form" class="calc-form">
          <div class="field"><label for="pl-company">${L("Company name", "اسم الشركة")}</label><input id="pl-company" type="text" required></div>
          <div class="field"><label for="pl-email">${L("Email", "البريد الإلكتروني")}</label><input id="pl-email" type="email" required></div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Open my dashboard", "افتح لوحتي")}</button>
        </form>
        <p class="mini" style="margin-top:12px">${L("Not registered yet?", "لست مسجّلاً بعد؟")} <a href="${u("/suppliers")}">${L("Register as a partner", "سجّل كشريك")}</a></p>
      </div>
    </div>

    <!-- Dashboard (has session) -->
    <div id="partner-app" hidden>
      <div class="dash-stats" style="margin-bottom:20px">
        <div class="dash-stat"><div class="ds-ico">📥</div><div class="num" id="pt-stat-open">0</div><div class="lbl">${L("Open requests", "طلبات متاحة")}</div></div>
        <div class="dash-stat"><div class="ds-ico">📨</div><div class="num" id="pt-stat-offers">0</div><div class="lbl">${L("Offers sent", "عروض مُرسلة")}</div></div>
        <div class="dash-stat"><div class="ds-ico">🏷️</div><div class="num" id="pt-stat-cat" style="font-size:1rem">—</div><div class="lbl">${L("Your category", "تصنيفك")}</div></div>
      </div>

      <div class="dash-card" style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><h3 style="margin:0" id="pt-company">—</h3><p class="text-soft" style="margin:0" id="pt-contact">—</p></div>
          <button class="btn btn-ghost btn-sm" id="pt-logout">${L("Sign out", "خروج")}</button>
        </div>
      </div>

      <div class="dash-panel-head"><h2>${L("Available client requests", "طلبات العملاء المتاحة")}</h2><p>${L("Matched to your service category. Send an offer and we coordinate directly with the client.", "مطابقة لتصنيف خدمتك. قدّم عرضك وننسّق معك مباشرة مع العميل.")}</p></div>
      <div id="pt-feed"><p class="dash-empty">${L("No open requests right now — new client requests will appear here.", "لا توجد طلبات متاحة حالياً — ستظهر طلبات العملاء الجديدة هنا.")}</p></div>

      <div class="callout" style="margin-top:20px"><span class="ico">🔗</span><p>${L("This dashboard is linked to the client side: every request or purchase on the site is matched to partners. Live routing to your WhatsApp/email is activated by our team after onboarding.", "هذه اللوحة مربوطة بجانب العملاء: كل طلب أو عملية شراء على الموقع تُطابَق مع الشركاء. التوجيه المباشر لواتسابك/بريدك يُفعّله فريقنا بعد إتمام الانضمام.")}</p></div>
    </div>
  </div></section>

  <!-- Offer modal -->
  <div class="empd-modal" id="pt-modal" hidden><div class="empd-modal-in">
    <button class="empd-modal-x" id="pt-modal-x">✕</button>
    <h3>${L("Send your offer", "قدّم عرضك")}</h3>
    <div class="empd-modal-body">
      <form id="pt-offer-form" class="calc-form">
        <input type="hidden" id="pt-offer-ref">
        <div class="field"><label id="pt-offer-for" style="font-weight:600"></label></div>
        <div class="field"><label for="pt-offer-price">${L("Your price (SAR)", "سعرك (ريال)")}</label><input id="pt-offer-price" type="number" min="0"></div>
        <div class="field"><label for="pt-offer-notes">${L("Offer details", "تفاصيل العرض")}</label><textarea id="pt-offer-notes" rows="3" placeholder="${Lraw("What's included, timeline, terms…", "ما يشمله العرض، المدة، الشروط…")}"></textarea></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%">${L("Send offer", "أرسل العرض")}</button>
        <div class="form-success" id="pt-offer-sent" hidden></div>
      </form>
    </div>
  </div></div>
  <script>window.BP_PARTNER_CATS=${JSON.stringify(cats)};</script>`;
  return page({ title: Lraw("Partner dashboard — Business Partner", "لوحة الشركاء — بيزنس بارتنر"), desc: Lraw("Partner dashboard: see matched client requests and send offers.", "لوحة الشركاء: شاهد طلبات العملاء المطابقة وقدّم عروضك."), active: "/suppliers", path: "/partner-dashboard", body });
}

function buildMonitor() {
  // BP Inbox page is authored as a standalone raw HTML file (scripts/assets/monitor.page.html)
  // and emitted verbatim. Keeping it out of a JS template literal avoids escaping
  // hazards (backticks / ${} / backslashes) that previously broke the page script.
  return fs.readFileSync(path.join(__dirname, 'assets', 'monitor.page.html'), 'utf8');
}

/* ---------- owner dashboard: control + live-test the specialized-team agents ---------- */
// Standalone owner page (noindex, no site chrome). One card per BP Team agent.
// Calls the n8n intake webhooks DIRECTLY from the browser (webhooks allow all
// origins), so it works both on the live site and when opened as a local file.
function buildDashboard() {
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>لوحة تحكم فريق الإيجنتس — Business Partner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root{
      --navy:#0B1B5A; --navy-700:#13246e; --navy-900:#081345;
      --green:#16a34a; --green-soft:#dcfce7; --amber:#f59e0b;
      --bg:#F5F6FA; --surface:#fff; --line:#E4E7F0; --text:#1F2430; --muted:#6a7085;
      --radius:16px; --shadow:0 8px 30px rgba(11,27,90,.06);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
    button{font-family:inherit;cursor:pointer}
    .wrap{max-width:1200px;margin:0 auto;padding:1.5rem 1.1rem 4rem}
    .topbar{background:linear-gradient(135deg,var(--navy) 0%,var(--navy-900) 100%);color:#fff;border-radius:20px;padding:1.6rem 1.5rem;text-align:center;margin-bottom:1.4rem;box-shadow:var(--shadow)}
    .topbar .badge{display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:.3rem 1rem;font-size:.82rem;margin-bottom:.7rem}
    .topbar h1{font-size:1.6rem;margin-bottom:.4rem}
    .topbar p{opacity:.9;font-size:.95rem;max-width:760px;margin:0 auto}
    .modes{display:inline-flex;flex-wrap:wrap;gap:.5rem;align-items:center;background:rgba(255,255,255,.1);border-radius:12px;padding:.45rem .8rem;font-size:.88rem;margin-top:1rem}
    .modes label{cursor:pointer;display:inline-flex;gap:.35rem;align-items:center}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(345px,1fr));gap:1.15rem}
    .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.25rem;box-shadow:var(--shadow);display:flex;flex-direction:column}
    .card.locked{opacity:.5}
    .card-top{display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.85rem}
    .emoji{font-size:1.9rem;line-height:1}
    .title{flex:1}
    .title h2{font-size:1.2rem;margin-bottom:.05rem;color:var(--navy)}
    .title .en{color:var(--muted);font-size:.82rem;font-weight:400}
    .title .role{color:var(--green);font-weight:600;font-size:.85rem}
    .livebadge{font-size:.7rem;padding:.2rem .55rem;border-radius:999px;white-space:nowrap;font-weight:700;background:var(--green-soft);color:#065f46}
    .controls{display:flex;gap:1rem;flex-wrap:wrap;padding:.6rem 0;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);margin-bottom:.8rem}
    .toggle{display:inline-flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer}
    .chat{min-height:46px;max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem;font-size:.9rem;margin-bottom:.55rem}
    .msg{padding:.55rem .75rem;border-radius:12px;max-width:92%;white-space:pre-wrap;line-height:1.6}
    .msg.me{background:var(--navy);color:#fff;align-self:flex-start;border-start-start-radius:3px}
    .msg.bot{background:#f1f5f9;border:1px solid var(--line);align-self:flex-end;border-start-end-radius:3px}
    .msg.sys{background:#fffbeb;border:1px solid #fde68a;color:#92400e;align-self:center;font-size:.8rem}
    .inrow{display:flex;gap:.5rem}
    .input{flex:1;border:1px solid var(--line);border-radius:10px;padding:.55rem .7rem;font:inherit;outline:none}
    .input:focus{border-color:var(--navy)}
    .send{background:var(--green);color:#fff;border:0;border-radius:10px;padding:0 1.1rem;font-weight:600}
    .send:disabled{opacity:.5;cursor:not-allowed}
    .hint{font-size:.75rem;color:var(--muted);min-height:1em;margin-top:.35rem}
    .foot{margin-top:2.2rem;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:1rem 1.25rem;font-size:.86rem}
    .foot .note{margin-top:.5rem;color:#78716c}
    .tools{margin-top:1.4rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.25rem 1.4rem;box-shadow:var(--shadow)}
    .tools h2{font-size:1.05rem;color:var(--navy);margin-bottom:.3rem}
    .tools p{color:var(--muted);font-size:.88rem;margin-bottom:.9rem}
    .toolrow{display:flex;flex-wrap:wrap;gap:.6rem}
    .toolbtn{display:inline-flex;align-items:center;gap:.4rem;background:var(--navy);color:#fff;text-decoration:none;padding:.6rem 1rem;border-radius:10px;font-size:.88rem;font-weight:600}
    .toolbtn:hover{background:var(--navy-700)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="badge">🔒 لوحة داخلية للمالك — تحكم واختبار كل موظف</div>
      <h1>🎛️ لوحة تحكم فريق الإيجنتس</h1>
      <p>كل موظف = إيجنت ذكي مستقل متخصص في مجاله. جرّبه مباشرة هنا، وتحكم في <b>تشغيله/إيقافه</b> و<b>قفله حتى الدفع</b>. الإعدادات تُحفظ في هذا المتصفح.</p>
      <div class="modes">
        <span>وضع العرض:</span>
        <label><input type="radio" name="mode" value="owner" checked /> 🧑‍💼 مالك (اختبار كل شيء)</label>
        <label><input type="radio" name="mode" value="client" /> 👤 معاينة كعميل (يحترم القفل)</label>
      </div>
    </div>
    <div class="grid" id="grid"></div>

    <section class="tools">
      <h2>🎯 أدوات وكيل التوظيف — Sourcing &amp; Screening</h2>
      <p>استقبال طلبات التقديم من مواقع الوظائف تلقائي بالكامل (عبر مراقبة البريد الإلكتروني). الأدوات التالية يستخدمها فريق التوظيف يدوياً — كل ما بعدها (التقييم، حجز المقابلة، إشعار العميل) يتم تلقائياً.</p>
      <div class="toolrow">
        <a class="toolbtn" href="https://businesspartnerai.app.n8n.cloud/form/5b3298ae-2361-420b-9de3-b573837e44e6" target="_blank" rel="noopener">➕ تسجيل مرشح (Headhunting)</a>
        <a class="toolbtn" href="https://businesspartnerai.app.n8n.cloud/form/97fdba3a-a01d-46d1-821d-bfccc0334408" target="_blank" rel="noopener">📝 تقييم مقابلة الفرز</a>
        <a class="toolbtn" href="https://businesspartnerai.app.n8n.cloud/form/32932655-821b-47f8-b985-5821a293a76b" target="_blank" rel="noopener">📄 صياغة إعلان وظيفة بالذكاء الاصطناعي</a>
      </div>
    </section>

    <div class="foot">
      🔒 النموذج التشغيلي Concierge: الإيجنت يجهّز ويوصي — أي مخرج خارجي «بانتظار الموافقة» ولا يُرسل آلياً. لا OTP ولا كلمات مرور.
      <div class="note">حالة «مدفوع/مُفعّل» محفوظة في متصفحك للتحكم والاختبار. ربط الدفع الفعلي (بوابة دفع + قاعدة بيانات) خطوة تالية لفرض القفل على العملاء الحقيقيين.</div>
    </div>
  </div>

  <script>
    var N8N_BASE = 'https://businesspartnerai.app.n8n.cloud/webhook';
    var AGENTS = [
      { slug:'baher',     path:'baher-intake',      name:'باهر', en:'Baher', role:'مستشار الأعمال',          emoji:'🎯' },
      { slug:'mazen',     path:'mazen-intake',      name:'مازن',     en:'Mazen',     role:'مدير العمليات',           emoji:'🧭' },
      { slug:'nasser',    path:'nasser-intake',     name:'ناصر',     en:'Nasser',    role:'الموارد البشرية',         emoji:'👥' },
      { slug:'mishari',   path:'mishari-intake',    name:'مشاري',    en:'Mishari',   role:'الامتثال والالتزام',       emoji:'🛡️' },
      { slug:'abdulrahman',path:'abdulrahman-intake',name:'عبدالرحمن',en:'Abdulrahman',role:'المدير المالي',          emoji:'💰' },
      { slug:'abdulaziz', path:'abdulaziz-intake',  name:'عبدالعزيز',en:'Abdulaziz', role:'القانوني',                emoji:'⚖️' },
      { slug:'badr',      path:'badr-intake',       name:'بدر',      en:'Badr',      role:'المبيعات وتطوير الأعمال', emoji:'💼' },
      { slug:'farah',     path:'farah-intake',      name:'فرح',      en:'Farah',     role:'التسويق والمحتوى',        emoji:'📣' },
      { slug:'malak',     path:'malak-intake',      name:'ملاك',     en:'Malak',     role:'مساعِدة تنفيذية ذكية',    emoji:'🗂️' },
      { slug:'mohammed',  path:'mohammed-intake',   name:'محمد',     en:'Mohammed',  role:'تقنية المعلومات',         emoji:'💻' },
      { slug:'strategy',  path:'strategy-intake',   name:'أحمد',     en:'Ahmed',     role:'مدير التخطيط الاستراتيجي', emoji:'📈' },
      { slug:'ahmed',     path:'ahmed-procurement', name:'عبدالله',  en:'Abdullah',  role:'المشتريات والتوريد',      emoji:'📦' }
    ];

    var KEY = 'bp_agent_controls_v1';
    function load(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e){ return {}; } }
    function save(s){ localStorage.setItem(KEY, JSON.stringify(s)); }
    var state = load();
    var mode = 'owner';

    var grid = document.getElementById('grid');
    AGENTS.forEach(function(a){
      var card = document.createElement('section');
      card.className = 'card';
      card.dataset.slug = a.slug;
      card.innerHTML =
        '<div class="card-top">'+
          '<span class="emoji">'+a.emoji+'</span>'+
          '<div class="title"><h2>'+a.name+' <span class="en">'+a.en+'</span></h2><div class="role">'+a.role+'</div></div>'+
          '<span class="livebadge">🟢 نشط</span>'+
        '</div>'+
        '<div class="controls">'+
          '<label class="toggle"><input type="checkbox" class="ctl-active" checked /> <span>مُفعّل</span></label>'+
          '<label class="toggle"><input type="checkbox" class="ctl-paid" /> <span>مدفوع (مفتوح للعميل)</span></label>'+
        '</div>'+
        '<div class="chat" aria-live="polite"></div>'+
        '<div class="inrow"><input type="text" class="input" placeholder="اكتب رسالة تجريبية…" /><button class="send" type="button">إرسال</button></div>'+
        '<div class="hint"></div>';
      grid.appendChild(card);

      var active = card.querySelector('.ctl-active');
      var paid = card.querySelector('.ctl-paid');
      if (state[a.slug]) {
        if (typeof state[a.slug].active === 'boolean') active.checked = state[a.slug].active;
        if (typeof state[a.slug].paid === 'boolean') paid.checked = state[a.slug].paid;
      }
      function persist(patch){ state[a.slug] = Object.assign({}, state[a.slug], patch); save(state); }
      active.addEventListener('change', function(){ persist({active:active.checked}); applyLock(card); });
      paid.addEventListener('change', function(){ persist({paid:paid.checked}); applyLock(card); });
      card.querySelector('.send').addEventListener('click', function(){ send(card, a); });
      card.querySelector('.input').addEventListener('keydown', function(e){ if (e.key === 'Enter') send(card, a); });
      applyLock(card);
    });

    function applyLock(card){
      var paid = card.querySelector('.ctl-paid').checked;
      var active = card.querySelector('.ctl-active').checked;
      var blocked = mode === 'client' && (!paid || !active);
      card.classList.toggle('locked', blocked);
      card.querySelector('.send').disabled = blocked;
      var hint = card.querySelector('.hint');
      if (blocked) hint.textContent = !active ? 'موقوف — العميل لا يصله رد.' : '🔒 مقفول — يتطلب الدفع لتفعيله للعميل.';
      else hint.textContent = '';
    }

    function pushMsg(card, text, cls){
      var box = card.querySelector('.chat');
      var el = document.createElement('div');
      el.className = 'msg ' + cls;
      el.textContent = text;
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
      return el;
    }

    function send(card, a){
      var input = card.querySelector('.input');
      var msg = (input.value || '').trim();
      if (!msg) return;
      input.value = '';
      pushMsg(card, msg, 'me');
      var thinking = pushMsg(card, '…', 'bot');
      var btn = card.querySelector('.send'); btn.disabled = true;
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 60000);
      fetch(N8N_BASE + '/' + a.path, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ client_name:'', channel:'web-dashboard', message: msg }),
        signal: ctrl.signal
      })
      .then(function(r){ return r.text(); })
      .then(function(text){
        clearTimeout(timer);
        var data = {};
        try { data = JSON.parse(text); } catch(e){ data = { reply: text }; }
        thinking.textContent = data.reply || 'لا يوجد رد.';
        if (data.proposal_ready) pushMsg(card, '✅ أنشأ Draft Proposal بحالة «بانتظار الموافقة».', 'sys');
        if (data.engine_fallback) pushMsg(card, 'ℹ️ الخدمة مزدحمة لحظياً — حاول مرة أخرى بعد ثوانٍ.', 'sys');
      })
      .catch(function(e){
        clearTimeout(timer);
        thinking.textContent = (e && e.name === 'AbortError') ? 'انتهت المهلة — حاول مرة أخرى.' : 'تعذّر الاتصال مؤقتاً — حاول مرة أخرى بعد لحظات.';
      })
      .then(function(){ btn.disabled = false; applyLock(card); });
    }

    var radios = document.querySelectorAll('input[name="mode"]');
    for (var i=0;i<radios.length;i++){
      radios[i].addEventListener('change', function(e){
        mode = e.target.value;
        var cards = document.querySelectorAll('.card');
        for (var j=0;j<cards.length;j++) applyLock(cards[j]);
      });
    }
  </script>
</body>
</html>`;
}

/* ---------- client product page: AI employees + connectors + pricing ---------- */
// Standalone client-facing page (has its own chrome). Presents the AI employees
// as a subscription product, a Connectors hub (guided step-by-step per tool with
// cost/token transparency + a done-for-you option), and packages.
function buildConnect(pre = "/") {
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>موظفك الذكي — رحلة العميل ومركز الربط | Business Partner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root{
      --navy:#0B1B5A; --navy-700:#13246e; --navy-900:#081345;
      --green:#16a34a; --green-soft:#dcfce7; --amber:#b45309; --amber-soft:#fef3c7;
      --bg:#F5F6FA; --surface:#fff; --line:#E7EAF3; --text:#1F2430; --muted:#6a7085;
      --radius:16px; --shadow:0 10px 34px rgba(11,27,90,.07);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.7}
    button{font-family:inherit;cursor:pointer}
    .wrap{max-width:1150px;margin:0 auto;padding:0 1.1rem}
    .hero{background:radial-gradient(1100px 500px at 75% -10%,#17307f 0%,var(--navy) 48%,var(--navy-900) 100%);color:#fff;padding:3rem 0 3.4rem;border-radius:0 0 26px 26px}
    .hero .badge{display:inline-block;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:.32rem 1rem;font-size:.82rem;margin-bottom:1rem}
    .hero h1{font-size:2rem;line-height:1.35;margin-bottom:.7rem}
    .hero h1 .hi{color:#8fb4ff}
    .hero p{opacity:.92;max-width:720px;font-size:1.02rem}
    .hero .cta{margin-top:1.5rem;display:flex;gap:.7rem;flex-wrap:wrap}
    .btn{border:0;border-radius:12px;padding:.8rem 1.4rem;font-weight:700;font-size:.95rem;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem}
    .btn-g{background:var(--green);color:#fff}
    .btn-o{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.28)}
    .valuerow{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-top:2rem}
    .vitem{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:1rem 1.1rem}
    .vitem b{display:block;font-size:1rem;margin-bottom:.15rem}
    .vitem span{opacity:.85;font-size:.86rem}
    section{padding:2.6rem 0}
    .sec-head{text-align:center;max-width:720px;margin:0 auto 1.7rem}
    .sec-head h2{font-size:1.5rem;margin-bottom:.4rem;color:var(--navy)}
    .sec-head p{color:var(--muted)}
    .emps{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.8rem;padding:.3rem 0 .6rem}
    .emp{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:.85rem 1rem;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:.6rem}
    .emp-top{display:flex;gap:.55rem;align-items:center}
    .emp .e{font-size:1.4rem}
    .emp b{font-size:.95rem;color:var(--navy)}
    .emp span{display:block;font-size:.76rem;color:var(--green);font-weight:600}
    .emp-cart{background:var(--navy);color:#fff;border:0;border-radius:9px;padding:.55rem;font-weight:700;font-size:.82rem;cursor:pointer}
    .emp-details{font-size:.78rem;color:var(--green);font-weight:600;text-decoration:none}
    .emp-details:hover{text-decoration:underline}
    .emp-note{font-size:.85rem;color:var(--muted);margin-top:1rem;text-align:center}
    .emp-note a{color:var(--navy);font-weight:700;text-decoration:underline}
    .bp-toast{position:fixed;inset-inline-start:50%;bottom:90px;transform:translateX(-50%) translateY(12px);background:var(--navy);color:#fff;padding:12px 22px;border-radius:999px;box-shadow:var(--shadow);z-index:1200;opacity:0;transition:opacity .28s,transform .28s;font-weight:600;pointer-events:none}
    .bp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.1rem}
    .cc{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.2rem;box-shadow:var(--shadow);display:flex;flex-direction:column}
    .cc-top{display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.7rem}
    .cc-ic{width:44px;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;background:#f1f4fb}
    .cc-ic svg{width:26px;height:26px;display:block}
    .cc-ic .brand{width:28px;height:28px;display:block;object-fit:contain}
    a.cc-ic{text-decoration:none;transition:transform .12s,box-shadow .12s}
    a.cc-ic:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(11,27,90,.12)}
    .m-site{display:inline-block;margin-top:.4rem;color:var(--navy);font-weight:600;font-size:.82rem;text-decoration:none}
    .m-site:hover{text-decoration:underline}
    .cc-t{flex:1}
    .cc-t h3{font-size:1.08rem;color:var(--navy);margin-bottom:.1rem}
    .cc-t .u{font-size:.85rem;color:var(--muted)}
    .cc-t .uEn{font-size:.74rem;color:var(--muted);opacity:.85;direction:ltr;text-align:left;margin-top:2px}
    .cc-state{font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;background:#eef1f8;color:#64748b;white-space:nowrap}
    .cc-state.on{background:var(--green-soft);color:#065f46}
    .cc-tags{display:flex;gap:.4rem;flex-wrap:wrap;margin:.2rem 0 .8rem}
    .tag{font-size:.72rem;font-weight:600;padding:.22rem .6rem;border-radius:999px}
    .tag.easy{background:#e0f2fe;color:#075985}
    .tag.token{background:var(--amber-soft);color:var(--amber)}
    .tag.cost{background:#fee2e2;color:#991b1b}
    .cc-note{font-size:.8rem;color:var(--muted);background:#fafbff;border:1px dashed var(--line);border-radius:10px;padding:.5rem .65rem;margin-bottom:.8rem;min-height:2.2em}
    .cc-actions{display:flex;gap:.5rem;margin-top:auto}
    .cc-actions .btn{flex:1;justify-content:center;padding:.6rem .5rem;border-radius:10px;font-size:.85rem}
    .btn-connect{background:var(--navy);color:#fff}
    .btn-help{background:#fff;color:var(--navy);border:1px solid var(--line)}
    .pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;align-items:stretch}
    .pc{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:1.5rem 1.3rem;box-shadow:var(--shadow);display:flex;flex-direction:column}
    .pc.feat{border:2px solid var(--navy);position:relative}
    .pc.feat::before{content:"الأكثر طلباً";position:absolute;top:-11px;inset-inline-start:1.3rem;background:var(--navy);color:#fff;font-size:.72rem;font-weight:700;padding:.2rem .7rem;border-radius:999px}
    .pc h3{color:var(--navy);font-size:1.2rem;margin-bottom:.2rem}
    .pc .pr{font-size:1.7rem;font-weight:700;color:var(--text);margin:.5rem 0}
    .pc .pr small{font-size:.85rem;color:var(--muted);font-weight:500}
    .pc ul{list-style:none;margin:.6rem 0 1.1rem;display:flex;flex-direction:column;gap:.5rem}
    .pc li{font-size:.88rem;padding-inline-start:1.4rem;position:relative;color:#374151}
    .pc li::before{content:"\\2714";position:absolute;inset-inline-start:0;color:var(--green);font-weight:700}
    .pc .btn{justify-content:center;margin-top:auto}
    .addon{background:var(--amber-soft);border:1px solid #fde68a;color:#7a5b00;border-radius:14px;padding:1.1rem 1.3rem;margin-top:1.2rem;font-size:.9rem}
    .jgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:.9rem}
    .jstep{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:1.1rem 1rem;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:.4rem}
    .jstep .jn{width:30px;height:30px;border-radius:999px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.9rem}
    .jstep b{color:var(--navy);font-size:.95rem}
    .jstep span:not(.jn){font-size:.82rem;color:var(--muted);line-height:1.7}
    .jstep a{color:var(--green);font-weight:700}
    .org{display:flex;flex-direction:column;gap:1rem}
    .org-tier{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:1rem 1.2rem;box-shadow:var(--shadow)}
    .org-label{display:inline-block;background:var(--navy);color:#fff;border-radius:999px;padding:.25rem .9rem;font-size:.8rem;font-weight:700;margin-bottom:.7rem}
    .org-cards{display:flex;flex-wrap:wrap;gap:.5rem}
    .org-card{background:var(--bg);border:1px solid var(--line);border-radius:11px;padding:.5rem .8rem;font-size:.85rem;font-weight:600;color:var(--text)}
    .demo-box{max-width:720px;margin:0 auto}
    .demo-ph{background:var(--navy);color:#fff;border-radius:18px;padding:2.6rem 1.5rem;display:flex;flex-direction:column;align-items:center;gap:.4rem;text-align:center;font-size:2rem}
    .demo-ph b{font-size:1.15rem}
    .demo-ph span{font-size:.9rem;opacity:.85;max-width:420px;line-height:1.8}
    @media(max-width:900px){.jgrid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:560px){.jgrid{grid-template-columns:1fr}}
    .addon b{color:#5b4300}
    .foot{background:var(--navy-900);color:#cdd6f5;text-align:center;padding:1.6rem 1rem;font-size:.85rem;margin-top:1rem}
    .ov{position:fixed;inset:0;background:rgba(8,12,30,.55);display:none;align-items:center;justify-content:center;padding:1rem;z-index:50}
    .ov.on{display:flex}
    .modal{background:#fff;border-radius:18px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.4)}
    .m-head{padding:1.2rem 1.4rem;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:.7rem;position:sticky;top:0;background:#fff}
    .m-head .cc-ic{width:40px;height:40px;font-size:1.35rem}
    .m-head h3{flex:1;color:var(--navy);font-size:1.15rem}
    .m-close{background:#f1f4fb;border:0;width:32px;height:32px;border-radius:9px;font-size:1.1rem;color:#475569}
    .m-body{padding:1.2rem 1.4rem}
    .m-body .lead{font-size:.9rem;color:var(--muted);margin-bottom:1rem}
    .step{display:flex;gap:.75rem;margin-bottom:.9rem}
    .step .n{width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;font-size:.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .step .tx{font-size:.9rem}
    .paynote{background:#fee2e2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:.6rem .8rem;font-size:.82rem;margin:.2rem 0 .9rem;display:flex;gap:.5rem}
    .m-foot{padding:1rem 1.4rem 1.4rem;display:flex;gap:.6rem;flex-wrap:wrap}
    .m-foot .btn{flex:1;justify-content:center;border-radius:11px}
    .mininav{position:sticky;top:0;z-index:20;background:rgba(11,27,90,.96);backdrop-filter:blur(6px);color:#fff;display:flex;align-items:center;gap:1rem;padding:.6rem 1.1rem}
    .mininav .mn-logo{color:#fff;font-weight:700;text-decoration:none;font-size:.98rem}
    .mininav .mn-links{margin-inline-start:auto;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
    .mininav .mn-links a{color:#dfe6ff;text-decoration:none;font-size:.86rem;padding:.35rem .6rem;border-radius:8px}
    .mininav .mn-links a:hover{background:rgba(255,255,255,.1)}
    .mininav .mn-cta{background:var(--green);color:#fff !important;font-weight:700}
    @media(max-width:800px){.valuerow{grid-template-columns:1fr}.pgrid{grid-template-columns:1fr}.hero h1{font-size:1.6rem}}
  </style>
</head>
<body>
  <div class="mininav">
    <a class="mn-logo" href="/">Business Partner</a>
    <div class="mn-links">
      <a href="#connect">الأدوات</a>
      <a href="#journey">رحلة العميل</a>
      <a href="#structure">الهيكلة</a>
      <a href="#demo">الديمو</a>
      <a class="mn-cta" href="${pre}portal">🔐 دخول بوابتي</a>
    </div>
  </div>
  <div class="hero">
    <div class="wrap">
      <div class="badge">🤖 موظفك الذكي — خاص فيك، مربوط بأدواتك</div>
      <h1>وظّف <span class="hi">موظفاً ذكياً</span> متخصصاً، واربطه بأدوات شركتك<br/>فيشتغل فعلياً نيابةً عنك.</h1>
      <p>مو مجرد شات — موظف حقيقي في مجاله (مساعدة تنفيذية، مبيعات، تسويق، عمليات…). تربطه بجيميل ونوشن وواتساب وتيمس بضغطة، فيقرأ ويرسل وينظّم ويرد <b>داخل حساباتك أنت</b>. أسرع، أقوى، ومخرجات مباشرة.</p>
      <div class="cta">
        <a href="${pre}portal" class="btn btn-g">🚀 ابدأ الآن — دخول بوابتي</a>
        <a href="#connect" class="btn btn-o">🔌 شوف الأدوات</a>
      </div>
      <div class="valuerow">
        <div class="vitem"><b>⚡ أسرع</b><span>ينجز المهام المتكررة فوراً بدل ساعات عمل يدوي.</span></div>
        <div class="vitem"><b>💪 أقوى</b><span>خبير متخصص + مربوط بكل أدواتك في مكان واحد.</span></div>
        <div class="vitem"><b>🎯 مخرجات مباشرة</b><span>إيميل مُرسل، موعد مُجدول، مهمة مُنظّمة — لا كلام فقط.</span></div>
      </div>
    </div>
  </div>
  <section>
    <div class="wrap">
      <div class="sec-head"><h2>اختَر موظفك</h2><p>كل موظف خبير في مجاله — أضف اللي يناسبك للسلة (تقدر تختار أكثر من موظف).</p>
        <p style="margin-top:.6rem"><a href="${pre}portal" style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:999px;padding:.5rem 1rem;font-weight:700;text-decoration:none;display:inline-block">🎁 جرّب الفريق كامل مجاناً قبل الاشتراك (3 رسائل لكل موظف) ←</a></p>
      </div>
      <div class="emps" id="emps"></div>
      <p class="emp-note">بعد الدفع نتحقق من الإيصال ونفعّل الوصول — استخدم رقم طلبك كـ كود تفعيل في <a href="${pre}portal">بوابة الموظفين الأذكياء</a>.</p>
    </div>
  </section>
  <section id="connect" style="background:#eef1f8">
    <div class="wrap">
      <div class="sec-head">
        <h2>🔌 مركز الربط (Connectors)</h2>
        <p>اربط الموظف بأدواتك بضغطة. لو الأداة تحتاج توكن أو فيها تكلفة، نمشي معك <b>خطوة بخطوة</b> ونوضّح لك وين تدفع — أو اطلب منّا نركّبها لك.</p>
      </div>
      <div class="cgrid" id="cgrid"></div>
    </div>
  </section>
  <section id="journey">
    <div class="wrap">
      <div class="sec-head"><h2>🧭 رحلة العميل — من الاختيار إلى التشغيل</h2><p>خمس خطوات واضحة، كلها داخل الموقع — بدون واتساب وبدون انتظار.</p></div>
      <div class="jgrid">
        <div class="jstep"><span class="jn">1</span><b>اختر موظفيك</b><span>حدّد من هذه الصفحة موظفاً واحداً أو أكثر وأضفهم للسلة${SHOW_PRICES ? " (500 ﷼/شهرياً للموظف)" : ""}.</span></div>
        <div class="jstep"><span class="jn">2</span><b>ادفع وأرفق الإيصال</b><span>أكمل الطلب من السلة بالتحويل البنكي وأرفق إيصال PDF — يصلك رقم طلب مثل BP-506275.</span></div>
        <div class="jstep"><span class="jn">3</span><b>نتحقق ونفعّل</b><span>نطابق الإيصال مع طلبك ونعتمد الدفع — رقم طلبك نفسه يصير كود التفعيل.</span></div>
        <div class="jstep"><span class="jn">4</span><b>ادخل بوابتك</b><span>افتح <a href="${pre}portal">بوابة الموظفين الأذكياء</a> بنفس بريدك + كودك — يفتح لك بالضبط اللي اشتريته.</span></div>
        <div class="jstep"><span class="jn">5</span><b>اشتغل واربط أدواتك</b><span>حادث موظفك بلغتك العادية، واربط Gmail ونوشن وأدواتك من مركز الربط أعلاه.</span></div>
      </div>
    </div>
  </section>
  <section id="structure" style="background:#eef1f8">
    <div class="wrap">
      <div class="sec-head"><h2>🏛️ هيكلة الفريق</h2><p>12 موظفاً متخصصاً يعملون كفريق واحد — يتشاور الموظف مع زميله تلقائياً لما يحتاج خبرة خارج تخصصه، ويذكر لك مين استشار.</p></div>
      <div class="org">
        <div class="org-tier"><span class="org-label">الإدارة</span>
          <div class="org-cards">
            <span class="org-card">🧭 مازن — العمليات</span>
            <span class="org-card">💰 عبدالرحمن — المالية</span>
            <span class="org-card">📈 أحمد — الاستراتيجية والتخطيط</span>
          </div>
        </div>
        <div class="org-tier"><span class="org-label">المتخصصون</span>
          <div class="org-cards">
            <span class="org-card">🎯 باهر — مستشار الأعمال</span>
            <span class="org-card">👥 ناصر — الموارد البشرية</span>
            <span class="org-card">🛡️ مشاري — الامتثال</span>
            <span class="org-card">⚖️ عبدالعزيز — القانوني</span>
            <span class="org-card">💼 بدر — المبيعات</span>
            <span class="org-card">📣 فرح — التسويق</span>
            <span class="org-card">🗂️ ملاك — مساعِدة تنفيذية</span>
            <span class="org-card">💻 محمد — التقنية</span>
            <span class="org-card">📦 عبدالله — المشتريات</span>
          </div>
        </div>
      </div>
      <div class="addon" style="margin-top:1.2rem">
        <b>🔀 هيكلة على كيفك:</b> تبي علاقة مدير↔موظف معيّنة، أو فريق مصغّر يخدم قسماً محدداً عندك؟ الهيكلة مرنة — كلمنا ونرتبها لمنشأتك.<br/>
        <b>🔒 خصوصية تامة:</b> كل موظف يشتغل على أدواتك أنت (بريدك، نوشنك، واتسابك) — بياناتك ملكك وحدك، وكل اللي نعرفه أنك عميل مشترك.
      </div>
    </div>
  </section>
  <section id="demo">
    <div class="wrap">
      <div class="sec-head"><h2>🎬 شاهد الخدمة قبل ما تشترك</h2><p>ديمو سريع يوريك البوابة من الدخول إلى المحادثة وربط الأدوات.</p></div>
      <div class="demo-box">
        <div class="demo-ph">🎬<b>فيديو الديمو قريباً</b><span>نصوّر لك جولة كاملة في البوابة — وإلى حينها جرّبها بنفسك مجاناً.</span>
          <a href="${pre}portal" class="btn btn-g" style="margin-top:.8rem">🎁 جرّب الآن مجاناً — 3 رسائل مع كل موظف</a>
        </div>
      </div>
      <div class="addon" style="margin-top:1.2rem">
        <b>➕ رسوم الاشتراكات الإضافية (عشان الخدمة ما تتوقف):</b> بعض الأدوات لها تكاليف خارجية تُدفع لمزوّدها (مثل رسائل واتساب من Meta، أو اشتراك Microsoft 365، أو استهلاك الذكاء الاصطناعي عند التوسّع). نوضّحها لك بشفافية وتُضاف على الباقة.<br/>
        <b>🛠️ خدمة الإعداد (Done-for-you):</b> ما تبي تلمس شي؟ نأسّس لك كل التربيط الخاص فيك ونسلّمك الموظف جاهز — <b>رسوم إعداد لمرة واحدة</b>.
      </div>
    </div>
  </section>
  <div class="foot">
    🔒 كل ربط خاص بشركتك ومعزول تماماً. لا نطلب كلمات مرور أبداً — الربط عبر تسجيل دخول آمن (OAuth) أو مفتاح خاص بك. أي إجراء خارجي مهم يتم «بانتظار موافقتك».
  </div>
  <div class="ov" id="ov">
    <div class="modal">
      <div class="m-head">
        <span class="cc-ic" id="m-ic">🔌</span>
        <h3 id="m-title">ربط الأداة</h3>
        <button class="m-close" id="m-close">✕</button>
      </div>
      <div class="m-body">
        <p class="lead" id="m-lead"></p>
        <div id="m-steps"></div>
      </div>
      <div class="m-foot">
        <button class="btn btn-connect" id="m-do">🔗 ربط الآن</button>
        <button class="btn btn-help" id="m-help">🛠️ خلّونا نركّبها لك</button>
      </div>
    </div>
  </div>
  <script>
    var TOOLS = [
      { id:'gmail', ic:'📧', name:'Gmail', unlock:'يقرأ ويصنّف بريدك، يسوّد ويرسل الردود، يتابع الوارد.', type:'easy',
        lead:'ربط بضغطة عبر تسجيل الدخول بحساب قوقل — بدون أي توكن يدوي، ومجاناً.', note:'ربط بضغطة · مجاني', steps:[
        {t:'اضغط «ربط الآن» فتنفتح صفحة تسجيل قوقل.'},{t:'اختر حساب الشركة ووافق على الصلاحيات (قراءة/إرسال البريد).'},{t:'تم! يصير الموظف يشتغل داخل بريدك مباشرة.'}]},
      { id:'gcal', ic:'📅', name:'تقويم قوقل', unlock:'يجدول المواعيد، يرسل الدعوات، يذكّرك وينسّق الاجتماعات.', type:'easy',
        lead:'ربط بضغطة مع نفس حساب قوقل — مجاناً.', note:'ربط بضغطة · مجاني', steps:[
        {t:'اضغط «ربط الآن» وسجّل دخول قوقل.'},{t:'وافق على صلاحية التقويم.'},{t:'الموظف يقدر يجدول ويعدّل مواعيدك.'}]},
      { id:'notion', ic:'🗒️', name:'Notion', unlock:'ينظّم المهام وقواعد البيانات والتوثيق داخل مساحتك.', type:'easy',
        lead:'ربط بضغطة عبر Notion (OAuth) — مجاناً. تختار الصفحات المسموح بها.', note:'ربط بضغطة · مجاني', steps:[
        {t:'اضغط «ربط الآن» فتفتح موافقة Notion.'},{t:'اختر مساحة العمل والصفحات المشتركة.'},{t:'الموظف يقرأ ويكتب في نوشن حسب صلاحياتك.'}]},
      { id:'slack', ic:'💬', name:'Slack', unlock:'يرد وينبّه ويلخّص داخل قنوات فريقك.', type:'easy',
        lead:'ربط بضغطة عبر Slack (OAuth) — مجاناً.', note:'ربط بضغطة · مجاني', steps:[
        {t:'اضغط «ربط الآن» ووافق على تثبيت التطبيق في مساحة سلاك.'},{t:'اختر القنوات.'},{t:'الموظف يشتغل داخل سلاك.'}]},
      { id:'whatsapp', ic:'🟢', name:'WhatsApp Business', unlock:'يرد على عملائك على واتساب ٢٤/٧ ويتابع الطلبات.', type:'cost',
        lead:'يحتاج رقم أعمال + إعداد WhatsApp Cloud API من Meta. فيه تكلفة رسائل تُدفع لـ Meta حسب الاستخدام. نمشي معك خطوة بخطوة — أو نركّبها لك.', note:'يحتاج توكن Meta · فيه تكلفة رسائل على Meta', pay:'💳 تكلفة الرسائل تُدفع مباشرة لـ Meta حسب عدد المحادثات (أول ١٠٠٠ محادثة/شهر غالباً مجانية).', steps:[
        {t:'أنشئ حساب Meta Business + رقم واتساب أعمال.'},{t:'من Meta for Developers فعّل WhatsApp Cloud API واحصل على التوكن ورقم المُرسِل.'},{t:'الصق التوكن هنا (يُخزّن مشفّراً) — أو أرسله لنا لنركّبه.'},{t:'اربط، فيصير الموظف يرد على عملائك.'}]},
      { id:'ms', ic:'🟦', name:'Microsoft (Teams / Outlook)', unlock:'يدير بريد أوتلوك، تقويم، ورسائل تيمس.', type:'token',
        lead:'ربط عبر تسجيل دخول مايكروسوفت (OAuth). قد يحتاج اشتراك Microsoft 365 فعّال لدى شركتك.', note:'ربط عبر مايكروسوفت · قد يتطلب اشتراك 365', pay:'💳 إن لم يكن لديك Microsoft 365، يلزم اشتراك من مايكروسوفت (يُدفع لهم).', steps:[
        {t:'اضغط «ربط الآن» وسجّل دخول مايكروسوفت للعمل.'},{t:'وافق على صلاحيات البريد/التقويم/تيمس.'},{t:'الموظف يشتغل داخل بيئة مايكروسوفت.'}]},
      { id:'drive', ic:'📁', name:'Google Drive', unlock:'ينظّم ملفاتك ويلخّص المستندات ويجهّز التقارير.', type:'easy',
        lead:'ربط بضغطة مع حساب قوقل — مجاناً.', note:'ربط بضغطة · مجاني', steps:[
        {t:'اضغط «ربط الآن» وسجّل دخول قوقل.'},{t:'وافق على صلاحية Drive.'},{t:'الموظف يقرأ وينظّم ملفاتك.'}]},
      { id:'sheets', ic:'📊', name:'CRM / جداول', unlock:'يحدّث العملاء والصفقات في CRM أو Google Sheets.', type:'token',
        lead:'نربطه بـ Google Sheets (بضغطة) أو نظام CRM لديك (قد يحتاج مفتاح API خاص بك).', note:'حسب النظام · بعضها يحتاج مفتاح', pay:'', steps:[
        {t:'أخبرنا بنظامك (Sheets / HubSpot / Salesforce…).'},{t:'نجهّز الربط المناسب — بضغطة أو بمفتاح API خاص بك.'},{t:'الموظف يحدّث بياناتك تلقائياً.'}]},
      { id:'qoyod', ic:'🧾', name:'قيود (Qoyod)', unlock:'محاسبة وفوترة: يصدر فواتير ضريبية متوافقة ZATCA ويزامن العملاء والقيود.', type:'token',
        lead:'ربط بمفتاح API خاص من حساب قيود لديك — متوافق مع ZATCA وبياناته داخل السعودية. أي إصدار فاتورة يتم بموافقتك.', note:'مفتاح API · يتطلب اشتراك قيود', pay:'💳 يتطلب اشتراك قيود فعّال لدى شركتك (الـ API مجاني على الباقات المدفوعة).', steps:[
        {t:'من حساب قيود: الإعدادات ← API، أنشئ مفتاحاً خاصاً.'},{t:'الصق المفتاح هنا (يُخزّن مشفّراً) — أو أرسله لنا لنركّبه.'},{t:'يصير الموظف يصدر الفواتير ويزامن القيود — بموافقتك قبل أي إصدار.'}]}
    ];
    var ICONS={
      gmail:'<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#EA4335"/><path d="M2 7l10 7 10-7" stroke="#fff" stroke-width="2" fill="none"/></svg>',
      gcal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#4285F4"/><rect x="3" y="4" width="18" height="5" fill="#1a73e8"/><rect x="6" y="2" width="2" height="5" rx="1" fill="#1a73e8"/><rect x="16" y="2" width="2" height="5" rx="1" fill="#1a73e8"/><rect x="7" y="12" width="4" height="4" fill="#fff"/></svg>',
      notion:'<svg viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="2" fill="#111"/><path d="M8 16V8l8 8V8" stroke="#fff" stroke-width="1.7" fill="none"/></svg>',
      slack:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="#4A154B"/><path d="M8.5 8v8M13 8v8M7 10.5h9M7 14h9" stroke="#fff" stroke-width="1.4"/></svg>',
      whatsapp:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" fill="#25D366"/><path d="M9 8c-.2 0-.5.1-.7.4-.2.3-.7.8-.7 1.9s.8 2.2 1 2.4c.1.2 1.6 2.5 3.9 3.4 1.9.7 2.3.6 2.7.5.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.5-.3-.2-.2-1.3-.7-1.5-.8-.2 0-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.8-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.4 0-.1 0-.3 0-.4 0-.1-.5-1.2-.7-1.7-.2-.4-.3-.4-.5-.4z" fill="#fff"/></svg>',
      ms:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" fill="#F25022"/><rect x="13" y="3" width="8" height="8" fill="#7FBA00"/><rect x="3" y="13" width="8" height="8" fill="#00A4EF"/><rect x="13" y="13" width="8" height="8" fill="#FFB900"/></svg>',
      drive:'<svg viewBox="0 0 24 24"><path d="M9 3h6l6 11h-6z" fill="#FFCF63"/><path d="M3 20l3-5h13l-3 5z" fill="#4688F1"/><path d="M9 3L3 14l3 6 6-11z" fill="#0F9D58"/></svg>',
      sheets:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#0F9D58"/><rect x="7" y="8" width="10" height="1.8" fill="#fff"/><rect x="7" y="12" width="10" height="1.8" fill="#fff"/><rect x="7" y="16" width="10" height="1.8" fill="#fff"/></svg>',
      crm:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#0F9D58"/><rect x="7" y="8" width="10" height="1.8" fill="#fff"/><rect x="7" y="12" width="10" height="1.8" fill="#fff"/><rect x="7" y="16" width="10" height="1.8" fill="#fff"/></svg>'
    };
    var EN={
      gmail:'Gmail — reads, sorts, drafts & sends email',
      gcal:'Google Calendar — meetings, invites & reminders',
      notion:'Notion — tasks, databases & docs',
      slack:'Slack — replies, alerts & summaries',
      whatsapp:'WhatsApp Business — answers customers 24/7',
      ms:'Microsoft 365 — Outlook, Calendar & Teams',
      drive:'Google Drive — organizes files & summaries',
      sheets:'CRM / Sheets — updates customers & deals',
      crm:'CRM / Sheets — updates customers & deals',
      qoyod:'Qoyod — ZATCA invoicing & accounting sync'
    };
    var URLS={
      gmail:'https://mail.google.com',
      gcal:'https://calendar.google.com',
      notion:'https://www.notion.so',
      slack:'https://slack.com',
      whatsapp:'https://business.whatsapp.com',
      ms:'https://www.microsoft.com/microsoft-365',
      drive:'https://drive.google.com',
      sheets:'https://www.google.com/sheets/about',
      crm:'https://www.google.com/sheets/about',
      qoyod:'https://www.qoyod.com'
    };
    var LOGO={gmail:1,gcal:1,notion:1,whatsapp:1,drive:1,sheets:1,crm:1};
    function mark(t){ return LOGO[t.id] ? '<img class="brand" src="/assets/img/logos/'+t.id+'.svg" alt="'+t.name+'" loading="lazy">' : (ICONS[t.id]||t.ic); }
    var SKEY='bp_connect_demo_v1';
    var st={}; try{st=JSON.parse(localStorage.getItem(SKEY)||'{}')}catch(e){st={}}
    var grid=document.getElementById('cgrid');
    TOOLS.forEach(function(t){
      var on=!!st[t.id];
      var card=document.createElement('div');
      card.className='cc'; card.dataset.id=t.id;
      card.innerHTML=
        '<div class="cc-top"><a class="cc-ic" href="'+(URLS[t.id]||'#')+'" target="_blank" rel="noopener" title="'+t.name+' ↗">'+mark(t)+'</a>'+
          '<div class="cc-t"><h3>'+t.name+'</h3><div class="u">'+t.unlock+'</div><div class="uEn">'+(EN[t.id]||'')+'</div></div>'+
          '<span class="cc-state '+(on?'on':'')+'">'+(on?'✓ متصل':'غير متصل')+'</span></div>'+
        '<div class="cc-tags"><span class="tag '+(t.type==='easy'?'easy':(t.type==='cost'?'cost':'token'))+'">'+ (t.type==='easy'?'ربط بضغطة':(t.type==='cost'?'فيه تكلفة على الأداة':'يحتاج توكن')) +'</span></div>'+
        '<div class="cc-note">'+t.note+'</div>'+
        '<div class="cc-actions"><button class="btn btn-connect">'+(on?'إدارة':'🔗 اربط')+'</button><button class="btn btn-help">🛠️ نركّبها لك</button></div>';
      card.querySelector('.btn-connect').onclick=function(){ openModal(t); };
      card.querySelector('.btn-help').onclick=function(){ requestHelp(t); };
      grid.appendChild(card);
    });
    var ov=document.getElementById('ov'), cur=null;
    function openModal(t){
      cur=t;
      document.getElementById('m-ic').innerHTML=mark(t);
      document.getElementById('m-title').textContent='ربط '+t.name;
      document.getElementById('m-lead').innerHTML=t.lead.replace(/&/g,'&amp;').replace(/</g,'&lt;')+' <a class="m-site" href="'+(URLS[t.id]||'#')+'" target="_blank" rel="noopener">افتح موقع '+t.name+' ↗</a>';
      var s='';
      if(t.pay) s+='<div class="paynote"><span>💳</span><span>'+t.pay+'</span></div>';
      t.steps.forEach(function(step,i){ s+='<div class="step"><div class="n">'+(i+1)+'</div><div class="tx">'+step.t+'</div></div>'; });
      document.getElementById('m-steps').innerHTML=s;
      document.getElementById('m-do').textContent = st[t.id] ? '✓ متصل — إعادة الربط' : '🔗 ربط الآن';
      ov.classList.add('on');
    }
    function closeModal(){ ov.classList.remove('on'); }
    document.getElementById('m-close').onclick=closeModal;
    ov.onclick=function(e){ if(e.target===ov) closeModal(); };
    document.getElementById('m-do').onclick=function(){
      if(!cur) return;
      st[cur.id]=true; localStorage.setItem(SKEY,JSON.stringify(st));
      var card=document.querySelector('.cc[data-id="'+cur.id+'"]');
      var badge=card.querySelector('.cc-state'); badge.textContent='✓ متصل'; badge.classList.add('on');
      card.querySelector('.btn-connect').textContent='إدارة';
      closeModal();
      window.open(URLS[cur.id]||'#','_blank','noopener');
    };
    document.getElementById('m-help').onclick=function(){ if(cur) requestHelp(cur); };
    function requestHelp(t){
      alert('🛠️ طلب إعداد «'+t.name+'» — فريق Business Partner يركّب لك هذه الأداة ويسلّمك الموظف جاهز مقابل رسوم إعداد. (نموذج: في النسخة الحقيقية يفتح نموذج طلب وتُحتسب الرسوم.)');
    }
    var EMPLOYEES=[
      {slug:'malak',e:'🗂️',name:'ملاك',role:'مساعِدة تنفيذية',nameEn:'Malak — Executive Assistant'},
      {slug:'baher',e:'🎯',name:'باهر',role:'مستشار الأعمال',nameEn:'Baher — Business Advisor'},
      {slug:'mazen',e:'🧭',name:'مازن',role:'مدير العمليات',nameEn:'Mazen — Operations Manager'},
      {slug:'nasser',e:'👥',name:'ناصر',role:'الموارد البشرية',nameEn:'Nasser — HR'},
      {slug:'mishari',e:'🛡️',name:'مشاري',role:'الامتثال والالتزام',nameEn:'Mishari — Compliance'},
      {slug:'abdulrahman',e:'💰',name:'عبدالرحمن',role:'المدير المالي',nameEn:'Abdulrahman — CFO'},
      {slug:'abdulaziz',e:'⚖️',name:'عبدالعزيز',role:'قانوني',nameEn:'Abdulaziz — Legal'},
      {slug:'badr',e:'💼',name:'بدر',role:'مبيعات وتطوير أعمال',nameEn:'Badr — Sales & Business Development'},
      {slug:'farah',e:'📣',name:'فرح',role:'تسويق ومحتوى',nameEn:'Farah — Marketing & Content'},
      {slug:'strategy',e:'📈',name:'أحمد',role:'مدير التخطيط الاستراتيجي',nameEn:'Ahmed — Strategic Planning'},
      {slug:'ahmed',e:'📦',name:'عبدالله',role:'مشتريات وتوريد',nameEn:'Abdullah — Procurement & Supply'},
      {slug:'mohammed',e:'💻',name:'محمد',role:'تقنية معلومات',nameEn:'Mohammed — IT'}
    ];
    var empGrid=document.getElementById('emps');
    EMPLOYEES.forEach(function(m){
      var d=document.createElement('div'); d.className='emp';
      d.innerHTML='<div class="emp-top"><span class="e">'+m.e+'</span><div><b>'+m.name+'</b><span>'+m.role+'</span></div></div>'+
        '<a href="/ar/team/'+m.slug+'" target="_blank" rel="noopener" class="emp-details">ايش يقدم؟ التفاصيل الكاملة ←</a>'+
        '<button type="button" class="emp-cart add-cart" data-id="employee-'+m.slug+'" data-name-en="'+m.nameEn+'" data-name-ar="'+m.name+' — '+m.role+'" data-amount="500" data-price="500 ﷼ / شهرياً" data-kind="employee">${SHOW_PRICES ? "🛒 أضف للسلة — 500 ﷼/شهرياً" : "🛒 أضف للسلة"}</button>';
      empGrid.appendChild(d);
    });
  </script>
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

/* ---------- client portal: login -> subscription gate -> pick agent -> live chat ---------- */
// Full client-facing flow. Agents are the live n8n team webhooks (real chat).
// Subscription gate uses an access code (issued after payment) — swap for a real
// payment gateway + server-side check later.
function buildPortal(pre = "/") {
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>بوابة الموظفين الأذكياء | Business Partner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root{--navy:#0B1B5A;--navy-900:#081345;--green:#16a34a;--green-soft:#dcfce7;--bg:#F5F6FA;--surface:#fff;--line:#E7EAF3;--text:#1F2430;--muted:#6a7085;--shadow:0 10px 34px rgba(11,27,90,.07)}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.7;min-height:100dvh}
    button{font-family:inherit;cursor:pointer}
    .topbar{background:var(--navy);color:#fff;height:58px;display:flex;align-items:center;gap:12px;padding:0 16px}
    .topbar .brand{font-weight:700}
    .topbar .brand small{display:block;font-weight:400;font-size:11px;opacity:.8}
    .topbar .sp{flex:1}
    .topbar .who{font-size:13px;opacity:.9}
    .topbar button{background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:9px;padding:7px 12px;font-size:12.5px}
    .center{min-height:calc(100dvh - 58px);display:flex;align-items:center;justify-content:center;padding:1.2rem}
    .card{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);padding:2rem 1.8rem;width:100%;max-width:430px;text-align:center}
    .card h1{color:var(--navy);font-size:1.4rem;margin-bottom:.4rem}
    .card p.sub{color:var(--muted);font-size:.9rem;margin-bottom:1.3rem}
    .field{text-align:right;margin-bottom:.9rem}
    .field label{display:block;font-size:.82rem;color:var(--muted);margin-bottom:.3rem}
    .field input{width:100%;border:1.5px solid var(--line);border-radius:11px;padding:.7rem .8rem;font:inherit;outline:none}
    .field input:focus{border-color:var(--navy)}
    .bigbtn{width:100%;background:var(--navy);color:#fff;border:0;border-radius:12px;padding:.8rem;font-weight:700;font-size:1rem;margin-top:.3rem}
    .bigbtn.green{background:var(--green)}
    .bigbtn.trial{background:#fff;color:var(--navy);border:1.5px solid var(--navy)}
    .err{color:#dc2626;font-size:.82rem;min-height:1.1em;margin-top:.5rem}
    .muted{color:var(--muted);font-size:.82rem;margin-top:1rem;line-height:1.7}
    .hint-code{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:.55rem .7rem;font-size:.8rem;margin-top:.9rem}
    .linkbtn{background:none;border:0;color:var(--navy);font-weight:700;font-size:.85rem;text-decoration:underline;margin-top:.7rem}
    .card.wide{max-width:560px}
    .pickwrap{display:flex;flex-direction:column;gap:.5rem;margin-bottom:1rem}
    .pickrow{display:flex;align-items:center;gap:.55rem;border:1.5px solid var(--line);border-radius:11px;padding:.55rem .75rem;font-size:.85rem;cursor:pointer;text-align:right}
    .pickrow:hover{border-color:var(--navy)}
    .pickrow input{width:auto;margin:0}
    .pickrow .e{font-size:1.1rem}
    .pickrow b{color:var(--navy)}
    .pickrow .r{color:var(--muted);margin-inline-start:auto;font-size:.78rem}
    .pick-details{color:var(--green);font-weight:600;font-size:.76rem;text-decoration:none;flex-shrink:0}
    .pick-details:hover{text-decoration:underline}
    .ws{max-width:1050px;margin:0 auto;padding:1.3rem 1.1rem 3rem}
    .ws h2{color:var(--navy);font-size:1.25rem;margin-bottom:.2rem}
    .ws .lead{color:var(--muted);font-size:.9rem;margin-bottom:1.1rem}
    .agents{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.1rem}
    .ag{background:var(--surface);border:1.5px solid var(--line);border-radius:13px;padding:.6rem .85rem;display:flex;gap:.5rem;align-items:center;cursor:pointer;transition:.12s}
    .ag:hover{border-color:var(--navy)}
    .ag.sel{border-color:var(--navy);background:#eef1fb}
    .ag-details{margin-inline-start:auto;flex-shrink:0;text-decoration:none;font-size:.95rem;opacity:.7}
    .ag-details:hover{opacity:1}
    .ag .e{font-size:1.3rem}
    .ag b{font-size:.92rem;color:var(--navy)}
    .ag span{display:block;font-size:.72rem;color:var(--muted)}
    .panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;height:70vh;min-height:440px}
    .p-head{background:#f8fafc;border-bottom:1px solid var(--line);padding:.8rem 1rem;display:flex;gap:.6rem;align-items:center}
    .p-head .e{font-size:1.5rem}
    .p-head b{color:var(--navy)}
    .p-head span{display:block;font-size:.78rem;color:var(--green);font-weight:600}
    .p-head a{color:var(--green);font-weight:600;font-size:.78rem;text-decoration:none;flex-shrink:0}
    .p-head a:hover{text-decoration:underline}
    .ph-trial{background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:999px;padding:.2rem .6rem;font-size:.74rem;font-weight:700;flex-shrink:0}
    .chat{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.55rem;background:#fbfcfe}
    .msg{padding:.6rem .8rem;border-radius:13px;max-width:80%;white-space:pre-wrap;font-size:.92rem}
    .msg.me{background:var(--navy);color:#fff;align-self:flex-start;border-start-start-radius:3px}
    .msg.bot{background:#fff;border:1px solid var(--line);align-self:flex-end;border-start-end-radius:3px}
    .msg.upsell{background:#fffbeb;border:1px solid #fde68a;color:#92400e;align-self:center;max-width:95%;text-align:center;font-weight:600}
    .msg.empty{color:var(--muted);align-self:center;background:none;font-size:.85rem}
    .composer{display:flex;gap:.5rem;padding:.7rem;border-top:1px solid var(--line);background:#fff}
    .composer input{flex:1;border:1.5px solid var(--line);border-radius:11px;padding:.65rem .8rem;font:inherit;outline:none}
    .composer input:focus{border-color:var(--navy)}
    .composer button{background:var(--green);color:#fff;border:0;border-radius:11px;padding:0 1.3rem;font-weight:700}
    .composer button:disabled{opacity:.5}
    .topbar .tb-link{color:#dfe6ff;text-decoration:none;font-size:12.5px;padding:6px 8px;border-radius:8px}
    .topbar .tb-link:hover{background:rgba(255,255,255,.1)}
    .tabs{display:flex;gap:.6rem;border-bottom:1px solid var(--line);margin-bottom:1.1rem;flex-wrap:wrap;align-items:center}
    .tab{background:none;border:0;border-bottom:2.5px solid transparent;padding:.6rem .3rem;font-weight:700;color:var(--muted);font-size:.95rem}
    .tab.active{color:var(--navy);border-bottom-color:var(--navy)}
    .tab-link{margin-inline-start:auto;color:var(--navy);text-decoration:none;font-size:.85rem;font-weight:700}
    .cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
    .cc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1rem;box-shadow:var(--shadow);display:flex;flex-direction:column}
    .cc-top{display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.5rem}
    .cc-ic{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.35rem;background:#f1f4fb;flex-shrink:0}
    .cc-ic svg{width:24px;height:24px;display:block}
    .cc-ic .brand{width:26px;height:26px;display:block;object-fit:contain}
    a.cc-ic{text-decoration:none;transition:transform .12s,box-shadow .12s}
    a.cc-ic:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(11,27,90,.12)}
    .m-site{display:inline-block;margin-top:.4rem;color:var(--navy);font-weight:600;font-size:.82rem;text-decoration:none}
    .m-site:hover{text-decoration:underline}
    .cc-t{flex:1}
    .cc-t h3{font-size:1rem;color:var(--navy)}
    .cc-t .u{font-size:.8rem;color:var(--muted)}
    .cc-t .uEn{font-size:.72rem;color:var(--muted);opacity:.85;direction:ltr;text-align:left;margin-top:2px}
    .cc-state{font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;background:#eef1f8;color:#64748b;white-space:nowrap}
    .cc-state.on{background:var(--green-soft);color:#065f46}
    .cc-tag{font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;align-self:flex-start;margin-bottom:.6rem}
    .cc-tag.easy{background:#e0f2fe;color:#075985}
    .cc-tag.token{background:#fef3c7;color:#b45309}
    .cc-tag.cost{background:#fee2e2;color:#991b1b}
    .cc-actions{display:flex;gap:.4rem;margin-top:auto}
    .cc-actions button{flex:1;border-radius:9px;padding:.5rem;font-size:.82rem;font-weight:700;border:0;cursor:pointer}
    .cbtn{background:var(--navy);color:#fff}
    .hbtn{background:#fff;color:var(--navy);border:1px solid var(--line)}
    .ov{position:fixed;inset:0;background:rgba(8,12,30,.55);display:none;align-items:center;justify-content:center;padding:1rem;z-index:50}
    .ov.on{display:flex}
    .modal{background:#fff;border-radius:16px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto}
    .m-head{padding:1rem 1.2rem;border-bottom:1px solid var(--line);display:flex;gap:.6rem;align-items:center}
    .m-head h3{flex:1;color:var(--navy);font-size:1.1rem}
    .m-close{background:#f1f4fb;border:0;width:30px;height:30px;border-radius:8px;cursor:pointer}
    .m-body{padding:1.1rem 1.2rem}
    .lead2{font-size:.88rem;color:var(--muted);margin-bottom:.9rem}
    .stp{display:flex;gap:.6rem;margin-bottom:.7rem}
    .stp .n{width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;font-size:.78rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .stp .tx{font-size:.86rem}
    .pay{background:#fee2e2;border:1px solid #fecaca;color:#991b1b;border-radius:9px;padding:.5rem .7rem;font-size:.8rem;margin-bottom:.8rem}
    .m-foot{padding:.9rem 1.2rem 1.2rem;display:flex;gap:.5rem}
    .m-foot button{flex:1;border-radius:10px;padding:.6rem;font-weight:700;border:0;cursor:pointer}
    @media(max-width:560px){.panel{height:66vh}}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">Business Partner<small>بوابة الموظفين الأذكياء</small></div>
    <a class="tb-link" href="${pre}connect">الأدوات ورحلة العميل</a>
    <a class="tb-link" href="${pre}">الموقع</a>
    <div class="sp"></div>
    <a id="subscribeNow" href="${pre}connect" style="display:none;background:var(--green);color:#fff;border-radius:9px;padding:7px 12px;font-size:12.5px;font-weight:700;text-decoration:none;margin-inline-end:8px">🚀 اشترك الآن</a>
    <div class="who" id="who"></div>
    <button id="logout" style="display:none">خروج</button>
  </div>
  <div class="center" id="screen-login">
    <div class="card wide">
      <h1>تسجيل الدخول</h1>
      <p class="sub">ادخل نفس البريد اللي اشتريت فيه، مع كود التفعيل.</p>
      <div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" placeholder="you@company.com" /></div>
      <div class="field"><label>كود التفعيل</label><input id="code" type="text" placeholder="رقم طلبك (مثال BP-506275) أو كود التفعيل" style="text-align:center;letter-spacing:1px" /></div>
      <button class="bigbtn" id="loginBtn">دخول</button>
      <div class="err" id="loginErr"></div>
      <button type="button" class="bigbtn trial" id="trialBtn">🎁 جرّب الفريق كامل مجاناً (3 رسائل لكل موظف)</button>
      <div class="hint-code">💡 بعد ما نتأكد من الدفع، رقم طلبك نفسه يصير كود التفعيل ويفتح فقط الموظفين اللي اشتركت فيهم — على نفس البريد اللي اشتريت فيه.</div>
      <button class="linkbtn" id="noCodeBtn">ما اشتريت بعد؟ اختر موظفيك وابدأ الطلب</button>
      <p class="muted">بالدخول أنت توافق على الاستخدام الآمن. لا نطلب كلمات مرور حساسة ولا OTP.</p>
    </div>
  </div>
  <div class="center" id="screen-gate" style="display:none">
    <div class="card wide">
      <h1>اختر موظفيك</h1>
      <p class="sub">اختر الموظفين اللي تبي تشترك فيهم وأضفهم للسلة. بعد الدفع نرسل لك كود تفعيل يفتح فقط اللي اشتريته.</p>
      <div class="pickwrap" id="pickwrap"></div>
      <button class="bigbtn green" id="cartBtn">🛒 أضف المحدد للسلة وأكمل الشراء</button>
      <button class="linkbtn" id="backToLoginBtn">عندي كود بالفعل — رجوع لتسجيل الدخول</button>
    </div>
  </div>
  <div id="screen-ws" style="display:none">
    <div class="ws">
      <div class="tabs">
        <button class="tab active" data-tab="emp">👥 موظفوك</button>
        <button class="tab" data-tab="tools">🔌 أدواتك</button>
        <a class="tab-link" href="${pre}connect">الباقات ↗</a>
      </div>
      <div id="tab-emp">
        <h2>اختر موظفك</h2>
        <p class="lead">اختر موظفاً وابدأ التعامل معه مباشرة. كل موظف خبير في مجاله.</p>
        <div class="agents" id="agents"></div>
        <div class="panel">
          <div class="p-head"><span class="e" id="ph-e">🤖</span><div><b id="ph-n">اختر موظفاً</b><span id="ph-r"></span></div><span class="ph-trial" id="ph-trial" style="display:none"></span><a id="ph-details" href="#" target="_blank" rel="noopener" style="display:none;margin-inline-start:auto">ايش يقدم؟ التفاصيل ←</a></div>
          <div class="chat" id="chat"><div class="msg empty">اختر موظفاً من الأعلى وابدأ المحادثة.</div></div>
          <div class="composer"><input id="msg" type="text" placeholder="اكتب رسالتك…" disabled /><button id="send" disabled>إرسال</button></div>
        </div>
      </div>
      <div id="tab-tools" style="display:none">
        <h2>🔌 اربط أدواتك</h2>
        <p class="lead">اربط موظفك بأدواتك ليشتغل داخل حساباتك. لو الأداة تحتاج توكن أو فيها تكلفة نمشي معك خطوة بخطوة، أو اطلب منّا نركّبها لك.</p>
        <div class="cgrid" id="cgrid"></div>
      </div>
    </div>
  </div>
  <div class="ov" id="ov">
    <div class="modal">
      <div class="m-head"><span class="cc-ic" id="mo-ic">🔌</span><h3 id="mo-t">ربط</h3><button class="m-close" id="mo-x">✕</button></div>
      <div class="m-body"><p class="lead2" id="mo-l"></p><div id="mo-s"></div></div>
      <div class="m-foot"><button class="cbtn" id="mo-do">🔗 ربط الآن</button><button class="hbtn" id="mo-help">🛠️ نركّبها لك</button></div>
    </div>
  </div>
  <script>
    var N8N_BASE='https://businesspartnerai.app.n8n.cloud/webhook';
    var AGENTS=[
      {slug:'baher',path:'baher-intake',name:'باهر',role:'مستشار الأعمال',e:'🎯'},
      {slug:'mazen',path:'mazen-intake',name:'مازن',role:'مدير العمليات',e:'🧭'},
      {slug:'nasser',path:'nasser-intake',name:'ناصر',role:'الموارد البشرية',e:'👥'},
      {slug:'mishari',path:'mishari-intake',name:'مشاري',role:'الامتثال والالتزام',e:'🛡️'},
      {slug:'abdulrahman',path:'abdulrahman-intake',name:'عبدالرحمن',role:'المدير المالي',e:'💰'},
      {slug:'abdulaziz',path:'abdulaziz-intake',name:'عبدالعزيز',role:'قانوني',e:'⚖️'},
      {slug:'badr',path:'badr-intake',name:'بدر',role:'مبيعات وتطوير أعمال',e:'💼'},
      {slug:'farah',path:'farah-intake',name:'فرح',role:'تسويق ومحتوى',e:'📣'},
      {slug:'malak',path:'malak-intake',name:'ملاك',role:'مساعِدة تنفيذية',e:'🗂️'},
      {slug:'mohammed',path:'mohammed-intake',name:'محمد',role:'تقنية معلومات',e:'💻'},
      {slug:'strategy',path:'strategy-intake',name:'أحمد',role:'مدير التخطيط الاستراتيجي',e:'📈'},
      {slug:'ahmed',path:'ahmed-procurement',name:'عبدالله',role:'مشتريات وتوريد',e:'📦'}
    ];
    var TOOLS=[
      {id:'gmail',ic:'📧',name:'Gmail',u:'يقرأ ويصنّف بريدك، يسوّد ويرسل الردود.',type:'easy',lead:'ربط بضغطة عبر تسجيل دخول قوقل — بدون توكن، مجاناً.',steps:['اضغط ربط الآن فتفتح صفحة تسجيل قوقل.','اختر حساب الشركة ووافق على الصلاحيات.','يشتغل الموظف داخل بريدك مباشرة.']},
      {id:'gcal',ic:'📅',name:'تقويم قوقل',u:'يجدول المواعيد والدعوات والتذكيرات.',type:'easy',lead:'ربط بضغطة مع حساب قوقل — مجاناً.',steps:['سجّل دخول قوقل.','وافق على صلاحية التقويم.','يقدر يجدول ويعدّل مواعيدك.']},
      {id:'notion',ic:'🗒️',name:'Notion',u:'ينظّم المهام وقواعد البيانات والتوثيق.',type:'easy',lead:'ربط بضغطة عبر Notion — مجاناً.',steps:['وافق على Notion.','اختر الصفحات المشتركة.','يقرأ ويكتب في نوشن حسب صلاحياتك.']},
      {id:'slack',ic:'💬',name:'Slack',u:'يرد وينبّه ويلخّص داخل قنوات فريقك.',type:'easy',lead:'ربط بضغطة عبر Slack — مجاناً.',steps:['ثبّت التطبيق في مساحة سلاك.','اختر القنوات.','يشتغل داخل سلاك.']},
      {id:'whatsapp',ic:'🟢',name:'WhatsApp',u:'يرد على عملائك على واتساب ٢٤/٧.',type:'cost',lead:'يحتاج رقم أعمال + إعداد WhatsApp Cloud API من Meta. فيه تكلفة رسائل تُدفع لـ Meta.',pay:'تكلفة الرسائل تُدفع لـ Meta حسب عدد المحادثات.',steps:['أنشئ حساب Meta Business + رقم واتساب أعمال.','فعّل WhatsApp Cloud API واحصل على التوكن.','الصق التوكن (يُخزّن مشفّراً) أو أرسله لنا.','اربط فيرد الموظف على عملائك.']},
      {id:'ms',ic:'🟦',name:'Microsoft (Teams/Outlook)',u:'يدير أوتلوك وتقويم ورسائل تيمس.',type:'token',lead:'ربط عبر تسجيل دخول مايكروسوفت. قد يحتاج اشتراك Microsoft 365.',pay:'إن لم يكن لديك 365 يلزم اشتراك من مايكروسوفت.',steps:['سجّل دخول مايكروسوفت للعمل.','وافق على صلاحيات البريد/التقويم/تيمس.','يشتغل داخل بيئة مايكروسوفت.']},
      {id:'drive',ic:'📁',name:'Google Drive',u:'ينظّم ملفاتك ويلخّص المستندات.',type:'easy',lead:'ربط بضغطة مع حساب قوقل — مجاناً.',steps:['سجّل دخول قوقل.','وافق على صلاحية Drive.','يقرأ وينظّم ملفاتك.']},
      {id:'crm',ic:'📊',name:'CRM / جداول',u:'يحدّث العملاء والصفقات في CRM أو Sheets.',type:'token',lead:'نربطه بـ Google Sheets أو CRM لديك (قد يحتاج مفتاح API).',steps:['أخبرنا بنظامك.','نجهّز الربط المناسب.','يحدّث بياناتك تلقائياً.']},
      {id:'qoyod',ic:'🧾',name:'قيود (Qoyod)',u:'محاسبة وفوترة: فواتير ZATCA ومزامنة القيود.',type:'token',lead:'ربط بمفتاح API خاص من حساب قيود لديك — متوافق مع ZATCA. أي إصدار فاتورة بموافقتك.',pay:'يتطلب اشتراك قيود فعّال (الـ API مجاني على الباقات المدفوعة).',steps:['من قيود: الإعدادات ← API، أنشئ مفتاحاً.','الصق المفتاح (يُخزّن مشفّراً) أو أرسله لنا.','يصدر الفواتير ويزامن القيود — بموافقتك.']}
    ];
    var ICONS={
      gmail:'<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#EA4335"/><path d="M2 7l10 7 10-7" stroke="#fff" stroke-width="2" fill="none"/></svg>',
      gcal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#4285F4"/><rect x="3" y="4" width="18" height="5" fill="#1a73e8"/><rect x="6" y="2" width="2" height="5" rx="1" fill="#1a73e8"/><rect x="16" y="2" width="2" height="5" rx="1" fill="#1a73e8"/><rect x="7" y="12" width="4" height="4" fill="#fff"/></svg>',
      notion:'<svg viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="2" fill="#111"/><path d="M8 16V8l8 8V8" stroke="#fff" stroke-width="1.7" fill="none"/></svg>',
      slack:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="#4A154B"/><path d="M8.5 8v8M13 8v8M7 10.5h9M7 14h9" stroke="#fff" stroke-width="1.4"/></svg>',
      whatsapp:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" fill="#25D366"/><path d="M9 8c-.2 0-.5.1-.7.4-.2.3-.7.8-.7 1.9s.8 2.2 1 2.4c.1.2 1.6 2.5 3.9 3.4 1.9.7 2.3.6 2.7.5.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.5-.3-.2-.2-1.3-.7-1.5-.8-.2 0-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.8-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.4 0-.1 0-.3 0-.4 0-.1-.5-1.2-.7-1.7-.2-.4-.3-.4-.5-.4z" fill="#fff"/></svg>',
      ms:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" fill="#F25022"/><rect x="13" y="3" width="8" height="8" fill="#7FBA00"/><rect x="3" y="13" width="8" height="8" fill="#00A4EF"/><rect x="13" y="13" width="8" height="8" fill="#FFB900"/></svg>',
      drive:'<svg viewBox="0 0 24 24"><path d="M9 3h6l6 11h-6z" fill="#FFCF63"/><path d="M3 20l3-5h13l-3 5z" fill="#4688F1"/><path d="M9 3L3 14l3 6 6-11z" fill="#0F9D58"/></svg>',
      sheets:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#0F9D58"/><rect x="7" y="8" width="10" height="1.8" fill="#fff"/><rect x="7" y="12" width="10" height="1.8" fill="#fff"/><rect x="7" y="16" width="10" height="1.8" fill="#fff"/></svg>',
      crm:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#0F9D58"/><rect x="7" y="8" width="10" height="1.8" fill="#fff"/><rect x="7" y="12" width="10" height="1.8" fill="#fff"/><rect x="7" y="16" width="10" height="1.8" fill="#fff"/></svg>'
    };
    var EN={
      gmail:'Gmail — reads, sorts, drafts & sends email',
      gcal:'Google Calendar — meetings, invites & reminders',
      notion:'Notion — tasks, databases & docs',
      slack:'Slack — replies, alerts & summaries',
      whatsapp:'WhatsApp Business — answers customers 24/7',
      ms:'Microsoft 365 — Outlook, Calendar & Teams',
      drive:'Google Drive — organizes files & summaries',
      sheets:'CRM / Sheets — updates customers & deals',
      crm:'CRM / Sheets — updates customers & deals',
      qoyod:'Qoyod — ZATCA invoicing & accounting sync'
    };
    var URLS={
      gmail:'https://mail.google.com',
      gcal:'https://calendar.google.com',
      notion:'https://www.notion.so',
      slack:'https://slack.com',
      whatsapp:'https://business.whatsapp.com',
      ms:'https://www.microsoft.com/microsoft-365',
      drive:'https://drive.google.com',
      sheets:'https://www.google.com/sheets/about',
      crm:'https://www.google.com/sheets/about',
      qoyod:'https://www.qoyod.com'
    };
    var LOGO={gmail:1,gcal:1,notion:1,whatsapp:1,drive:1,sheets:1,crm:1};
    function mark(t){ return LOGO[t.id] ? '<img class="brand" src="/assets/img/logos/'+t.id+'.svg" alt="'+t.name+'" loading="lazy">' : (ICONS[t.id]||t.ic); }
    var TKEY='bp_connect_demo_v1'; var tst={}; try{tst=JSON.parse(localStorage.getItem(TKEY)||'{}')}catch(e){tst={}}
    var CONFIRMED=['مؤكد - قيد التنفيذ','مكتمل'];
    var OWNER_EMAIL='dr.baher.magnas@gmail.com';
    var LS={email:'bp_portal_email',company:'bp_portal_company',sub:'bp_portal_sub',agents:'bp_portal_agents',trial:'bp_portal_trial'};
    var CHAT_PREFIX='bp_portal_chat_';
    var TRIAL_LIMIT=3;
    function trialCountKey(slug){ return 'bp_portal_trialn_'+slug; }
    function trialCount(slug){ return parseInt(localStorage.getItem(trialCountKey(slug))||'0',10); }
    function trialInc(slug){ localStorage.setItem(trialCountKey(slug),String(trialCount(slug)+1)); }
    function $(id){return document.getElementById(id);}
    function show(id){['screen-login','screen-gate','screen-ws'].forEach(function(s){$(s).style.display=(s===id)?'':'none';});}
    var email=localStorage.getItem(LS.email)||'';
    var qEmail=new URLSearchParams(location.search).get('email');
    if(qEmail && !email){ email=qEmail; localStorage.setItem(LS.email,email); }
    var subbed=localStorage.getItem(LS.sub)==='1';
    var isTrial=localStorage.getItem(LS.trial)==='1';
    if(email && email.toLowerCase()===OWNER_EMAIL && (!subbed || localStorage.getItem(LS.agents)!=='"ALL"')){
      subbed=true; isTrial=false; localStorage.setItem(LS.sub,'1'); localStorage.setItem(LS.agents,JSON.stringify('ALL')); localStorage.removeItem(LS.trial);
    }
    var cur=null;
    var showGate=false;
    function route(){
      if(!subbed){ show(showGate?'screen-gate':'screen-login'); if(showGate) buildPicker(); $('who').textContent=email||''; $('logout').style.display=email?'':'none'; return; }
      $('who').textContent=email+(isTrial?' 🎁 (تجربة مجانية)':''); $('logout').style.display='';
      $('subscribeNow').style.display=isTrial?'':'none';
      show('screen-ws'); buildAgents();
    }
    function unlock(slugs,trialFlag){
      subbed=true; isTrial=!!trialFlag;
      localStorage.setItem(LS.sub,'1'); localStorage.setItem(LS.agents,JSON.stringify(slugs));
      if(isTrial) localStorage.setItem(LS.trial,'1'); else localStorage.removeItem(LS.trial);
      route();
    }
    $('loginBtn').onclick=function(){
      var e=($('email').value||'').trim();
      var c=($('code').value||'').trim().toUpperCase();
      if(!e || e.indexOf('@')<0){ $('loginErr').textContent='ادخل بريداً صحيحاً.'; return; }
      email=e; localStorage.setItem(LS.email,e);
      if(e.toLowerCase()===OWNER_EMAIL){ unlock('ALL'); return; }
      if(!c){ $('loginErr').textContent='ادخل كود التفعيل.'; return; }
      var btn=$('loginBtn'); btn.disabled=true; $('loginErr').textContent='جارٍ التحقق…';
      fetch('/api/requests?refs='+encodeURIComponent(c))
        .then(function(r){return r.json();})
        .then(function(d){
          var st=d && d.statuses && d.statuses[c];
          var ag=d && d.agents && d.agents[c];
          var orderEmail=d && d.emails && d.emails[c];
          var isDemo=d && d.demo && d.demo[c];
          var isTrialCode=d && d.trial && d.trial[c];
          if(st && CONFIRMED.indexOf(st)>=0 && ag && ag.length && (isDemo || (orderEmail && orderEmail.toLowerCase()===e.toLowerCase()))){ unlock(ag,isTrialCode); }
          else if(st && CONFIRMED.indexOf(st)>=0 && ag && ag.length){ $('loginErr').textContent='هذا الكود مسجّل على بريد مختلف — استخدم نفس البريد اللي اشتريت فيه.'; }
          else if(st){ $('loginErr').textContent='طلبك ('+c+') لسه قيد المراجعة — بيفتح تلقائياً بمجرد اعتماد الدفع.'; }
          else { $('loginErr').textContent='كود غير صحيح. تأكد من رقم الطلب أو اختر موظفيك وابدأ الطلب.'; }
        })
        .catch(function(){ $('loginErr').textContent='تعذّر التحقق الآن — حاول مرة أخرى.'; })
        .then(function(){ btn.disabled=false; });
    };
    $('email').addEventListener('keydown',function(ev){if(ev.key==='Enter')$('loginBtn').click();});
    $('code').addEventListener('keydown',function(ev){if(ev.key==='Enter')$('loginBtn').click();});
    $('noCodeBtn').onclick=function(){ showGate=true; route(); };
    $('backToLoginBtn').onclick=function(){ showGate=false; route(); };
    $('trialBtn').onclick=function(){
      var e=($('email').value||'').trim();
      if(!e || e.indexOf('@')<0){ $('loginErr').textContent='ادخل بريداً صحيحاً أولاً عشان تبدأ التجربة.'; return; }
      $('code').value='TRIAL'; $('loginBtn').click();
    };
    function buildPicker(){
      var box=$('pickwrap'); if(box.dataset.done) return; box.dataset.done='1';
      AGENTS.forEach(function(a){
        var lb=document.createElement('label'); lb.className='pickrow';
        lb.innerHTML='<input type="checkbox" value="'+a.slug+'"><span class="e">'+a.e+'</span><b>'+a.name+'</b><span class="r">'+a.role+'</span>'+
          '<a href="/ar/team/'+a.slug+'" target="_blank" rel="noopener" class="pick-details" onclick="event.stopPropagation()">ايش يقدم؟</a>';
        box.appendChild(lb);
      });
    }
    function pickedSlugs(){
      var boxes=document.querySelectorAll('#pickwrap input[type=checkbox]:checked');
      var out=[]; for(var i=0;i<boxes.length;i++) out.push(boxes[i].value);
      return out;
    }
    $('cartBtn').onclick=function(){
      var slugs=pickedSlugs();
      if(!slugs.length){ alert('اختر موظفاً واحداً على الأقل قبل الإضافة للسلة.'); return; }
      var cart=[]; try{ cart=JSON.parse(localStorage.getItem('bp_cart')||'[]'); }catch(e){ cart=[]; }
      slugs.forEach(function(slug){
        var a=AGENTS.filter(function(x){return x.slug===slug;})[0]; if(!a) return;
        var id='employee-'+slug;
        if(cart.some(function(i){return i.id===id;})) return;
        cart.push({id:id,nameEn:a.name+' — '+a.role,nameAr:a.name+' — '+a.role,amount:500,price:'500 ﷼ / شهرياً',kind:'employee',qty:1});
      });
      localStorage.setItem('bp_cart',JSON.stringify(cart));
      location.href='${pre}cart';
    };
    $('logout').onclick=function(){ localStorage.removeItem(LS.email); localStorage.removeItem(LS.sub); localStorage.removeItem(LS.agents); localStorage.removeItem(LS.trial); email=''; subbed=false; isTrial=false; showGate=false; route(); };
    function entitledSlugs(){
      var raw=localStorage.getItem(LS.agents);
      if(!raw) return [];
      try{ return JSON.parse(raw); }catch(e){ return []; }
    }
    function buildAgents(){
      var box=$('agents'); box.innerHTML='';
      var ent=entitledSlugs();
      var list=(ent==='ALL')?AGENTS:AGENTS.filter(function(a){return ent.indexOf(a.slug)>=0;});
      if(!list.length){ box.innerHTML='<p class="muted">لا يوجد موظفون مفعّلون على هذا الكود.</p>'; return; }
      list.forEach(function(a){
        var el=document.createElement('div'); el.className='ag'; el.dataset.slug=a.slug;
        el.innerHTML='<span class="e">'+a.e+'</span><div><b>'+a.name+'</b><span>'+a.role+'</span></div>'+
          '<a href="/ar/team/'+a.slug+'" target="_blank" rel="noopener" class="ag-details" onclick="event.stopPropagation()">ℹ️</a>';
        el.onclick=function(){ selectAgent(a,el); };
        box.appendChild(el);
      });
    }
    function loadChat(slug){ try{ return JSON.parse(localStorage.getItem(CHAT_PREFIX+slug)||'[]'); }catch(e){ return []; } }
    function saveChat(slug,hist){ try{ localStorage.setItem(CHAT_PREFIX+slug,JSON.stringify(hist.slice(-80))); }catch(e){} }
    var chatHist=[];
    function renderChat(){
      var c=$('chat'); c.innerHTML='';
      if(!chatHist.length){ c.innerHTML='<div class="msg empty">ابدأ محادثتك مع '+cur.name+' 👋</div>'; return; }
      chatHist.forEach(function(m){ var d=document.createElement('div'); d.className='msg '+m.cls; d.textContent=m.text; c.appendChild(d); });
      c.scrollTop=c.scrollHeight;
    }
    function updateTrialBadge(slug){
      var badge=$('ph-trial');
      if(!isTrial){ badge.style.display='none'; return; }
      var left=Math.max(0,TRIAL_LIMIT-trialCount(slug));
      badge.textContent='🎁 '+left+'/'+TRIAL_LIMIT+' رسائل تجريبية متبقية';
      badge.style.display='';
    }
    function selectAgent(a,el){
      cur=a;
      var chips=document.querySelectorAll('.ag'); for(var i=0;i<chips.length;i++) chips[i].classList.remove('sel');
      el.classList.add('sel');
      $('ph-e').textContent=a.e; $('ph-n').textContent=a.name; $('ph-r').textContent=a.role;
      $('ph-details').href='/ar/team/'+a.slug; $('ph-details').style.display='';
      updateTrialBadge(a.slug);
      chatHist=loadChat(a.slug);
      renderChat();
      $('msg').disabled=false; $('send').disabled=false; $('msg').focus();
    }
    function push(text,cls){
      var c=$('chat'); var em=c.querySelector('.empty'); if(em) em.remove();
      var d=document.createElement('div'); d.className='msg '+cls; d.textContent=text; c.appendChild(d); c.scrollTop=c.scrollHeight; return d;
    }
    function send(){
      if(!cur) return;
      if(isTrial && trialCount(cur.slug)>=TRIAL_LIMIT){
        push('🎁 خلصت رسائلك المجانية مع '+cur.name+' ('+TRIAL_LIMIT+' رسائل). اشترك الآن عشان تكمل المحادثة بلا حدود.','bot upsell');
        return;
      }
      var inp=$('msg'); var m=(inp.value||'').trim(); if(!m) return;
      var agentAtSend=cur, histRef=chatHist;
      if(isTrial){ trialInc(agentAtSend.slug); updateTrialBadge(agentAtSend.slug); }
      inp.value=''; push(m,'me');
      histRef.push({text:m,cls:'me'}); saveChat(agentAtSend.slug,histRef);
      var think=push('…','bot'); var btn=$('send'); btn.disabled=true;
      var ctrl=new AbortController(); var timer=setTimeout(function(){ctrl.abort();},60000);
      fetch(N8N_BASE+'/'+agentAtSend.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'',channel:'portal',message:m}),signal:ctrl.signal})
        .then(function(r){return r.text();})
        .then(function(t){ clearTimeout(timer); var d={}; try{d=JSON.parse(t);}catch(e){d={reply:t};} var reply=d.reply||'لا يوجد رد.'; think.textContent=reply; histRef.push({text:reply,cls:'bot'}); saveChat(agentAtSend.slug,histRef); })
        .catch(function(e){ clearTimeout(timer); var msg=(e&&e.name==='AbortError')?'انتهت المهلة — حاول مرة أخرى.':'تعذّر الاتصال مؤقتاً — حاول مرة أخرى.'; think.textContent=msg; histRef.push({text:msg,cls:'bot'}); saveChat(agentAtSend.slug,histRef); })
        .then(function(){ btn.disabled=false; });
    }
    $('send').onclick=send;
    $('msg').addEventListener('keydown',function(ev){if(ev.key==='Enter')send();});
    var toolsBuilt=false;
    function switchTab(t){
      var em=t==='emp';
      $('tab-emp').style.display=em?'':'none';
      $('tab-tools').style.display=em?'none':'';
      var tabs=document.querySelectorAll('.tab'); for(var i=0;i<tabs.length;i++) tabs[i].classList.toggle('active',tabs[i].getAttribute('data-tab')===t);
      if(t==='tools' && !toolsBuilt){ buildTools(); toolsBuilt=true; }
    }
    (function(){var tabs=document.querySelectorAll('.tab'); for(var i=0;i<tabs.length;i++){ (function(b){ b.onclick=function(){ switchTab(b.getAttribute('data-tab')); }; })(tabs[i]); }})();
    function buildTools(){
      var g=$('cgrid');
      TOOLS.forEach(function(t){
        var on=!!tst[t.id]; var tagtxt=t.type==='easy'?'ربط بضغطة':(t.type==='cost'?'فيه تكلفة':'يحتاج توكن');
        var d=document.createElement('div'); d.className='cc'; d.dataset.id=t.id;
        d.innerHTML='<div class="cc-top"><a class="cc-ic" href="'+(URLS[t.id]||'#')+'" target="_blank" rel="noopener" title="'+t.name+' ↗">'+mark(t)+'</a><div class="cc-t"><h3>'+t.name+'</h3><div class="u">'+t.u+'</div><div class="uEn">'+(EN[t.id]||'')+'</div></div><span class="cc-state '+(on?'on':'')+'">'+(on?'✓ متصل':'غير متصل')+'</span></div>'+
          '<span class="cc-tag '+t.type+'">'+tagtxt+'</span>'+
          '<div class="cc-actions"><button class="cbtn">'+(on?'إدارة':'🔗 اربط')+'</button><button class="hbtn">🛠️ نركّبها لك</button></div>';
        d.querySelector('.cbtn').onclick=function(){ openTool(t); };
        d.querySelector('.hbtn').onclick=function(){ helpTool(t); };
        g.appendChild(d);
      });
    }
    var ov=$('ov'), curTool=null;
    function openTool(t){
      curTool=t; $('mo-ic').innerHTML=mark(t); $('mo-t').textContent='ربط '+t.name; $('mo-l').innerHTML=t.lead.replace(/&/g,'&amp;').replace(/</g,'&lt;')+' <a class="m-site" href="'+(URLS[t.id]||'#')+'" target="_blank" rel="noopener">افتح موقع '+t.name+' ↗</a>';
      var s=''; if(t.pay) s+='<div class="pay">💳 '+t.pay+'</div>';
      t.steps.forEach(function(x,i){ s+='<div class="stp"><div class="n">'+(i+1)+'</div><div class="tx">'+x+'</div></div>'; });
      $('mo-s').innerHTML=s; $('mo-do').textContent=tst[t.id]?'✓ متصل — إعادة الربط':'🔗 ربط الآن'; ov.classList.add('on');
    }
    $('mo-x').onclick=function(){ov.classList.remove('on');};
    ov.onclick=function(e){ if(e.target===ov) ov.classList.remove('on'); };
    $('mo-do').onclick=function(){
      if(!curTool) return; tst[curTool.id]=true; localStorage.setItem(TKEY,JSON.stringify(tst));
      var c=document.querySelector('.cc[data-id="'+curTool.id+'"]'); if(c){ var b=c.querySelector('.cc-state'); b.textContent='✓ متصل'; b.classList.add('on'); c.querySelector('.cbtn').textContent='إدارة'; }
      ov.classList.remove('on'); window.open(URLS[curTool.id]||'#','_blank','noopener');
    };
    $('mo-help').onclick=function(){ if(curTool) helpTool(curTool); };
    function helpTool(t){ alert('🛠️ طلب إعداد «'+t.name+'» — نركّب لك الأداة ونسلّمك الموظف جاهز مقابل رسوم إعداد.'); }
    route();
  </script>
</body>
</html>`;
}

/* ---------- Shared Services landing (client-facing) ---------- */
// Dashboard → this page: explains the Shared Services executive team and lets the
// client open the service live (chat with Baher, who leads and routes the team).
// Chat calls Baher's public n8n chat webhook directly from the browser.
function buildSharedServices() {
  const shared = (site.aiAgents && site.aiAgents.agents || []).find((a) => a.key === "shared") || {};
  const feats = (LANG === "ar" ? shared.features : shared.featuresEn) || [];
  const team = [
    { e: "👑", en: "Baher — Business Advisor & Team Lead", ar: "باهر — مستشار الأعمال وقائد الفريق" },
    { e: "🧭", en: "Mazen — Operations Manager", ar: "مازن — مدير العمليات" },
    { e: "👥", en: "Nasser — HR", ar: "ناصر — الموارد البشرية" },
    { e: "🛡️", en: "Mishari — Compliance", ar: "مشاري — الامتثال والالتزام" },
    { e: "⚖️", en: "Abdulaziz — Legal", ar: "عبدالعزيز — القانوني" },
    { e: "💼", en: "Badr — Sales & BD", ar: "بدر — مبيعات وتطوير أعمال" },
    { e: "📣", en: "Farah — Marketing", ar: "فرح — تسويق ومحتوى" },
    { e: "🗂️", en: "Malak — Executive Assistant", ar: "ملاك — مساعِدة تنفيذية" },
    { e: "💻", en: "Mohammed — IT", ar: "محمد — تقنية المعلومات" },
    { e: "📈", en: "Ahmed — Strategic Planning", ar: "أحمد — مدير التخطيط الاستراتيجي" },
    { e: "🛒", en: "Abdullah — Procurement", ar: "عبدالله — مشتريات وتوريد" },
  ];
  const busyMsg = Lraw("The team is busy right now — please try again in a moment.", "الفريق مشغول الحين — جرّب بعد لحظات.");
  const errMsg = Lraw("Connection issue — please try again.", "تعذّر الاتصال — حاول مرة ثانية.");

  // Full roster for the dashboard — each specialist is chatted with individually.
  // Baher leads via his chat webhook (chatTrigger protocol); the rest use their
  // own `<slug>-intake` webhooks (client_name/channel/message → { reply }).
  const KHALED_EP = "https://businesspartnerai.app.n8n.cloud/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat";
  const agentData = [
    { slug: "khaled", e: "👑", ar: "باهر", arRole: "مستشار الأعمال", en: "Baher", enRole: "Business Advisor", mode: "chat", ep: KHALED_EP },
    { slug: "mazen", e: "🧭", ar: "مازن", arRole: "مدير العمليات", en: "Mazen", enRole: "Operations Manager", path: "mazen-intake" },
    { slug: "nasser", e: "👥", ar: "ناصر", arRole: "الموارد البشرية", en: "Nasser", enRole: "Human Resources", path: "nasser-intake" },
    { slug: "mishari", e: "🛡️", ar: "مشاري", arRole: "الامتثال والالتزام", en: "Mishari", enRole: "Compliance", path: "mishari-intake" },
    { slug: "abdulrahman", e: "💰", ar: "عبدالرحمن", arRole: "المدير المالي", en: "Abdulrahman", enRole: "Chief Financial Officer", path: "abdulrahman-intake" },
    { slug: "abdulaziz", e: "⚖️", ar: "عبدالعزيز", arRole: "القانوني", en: "Abdulaziz", enRole: "Legal", path: "abdulaziz-intake" },
    { slug: "badr", e: "💼", ar: "بدر", arRole: "مبيعات وتطوير أعمال", en: "Badr", enRole: "Sales & Business Development", path: "badr-intake" },
    { slug: "farah", e: "📣", ar: "فرح", arRole: "تسويق ومحتوى", en: "Farah", enRole: "Marketing & Content", path: "farah-intake" },
    { slug: "malak", e: "🗂️", ar: "ملاك", arRole: "مساعِدة تنفيذية", en: "Malak", enRole: "Executive Assistant", path: "malak-intake" },
    { slug: "mohammed", e: "💻", ar: "محمد", arRole: "تقنية المعلومات", en: "Mohammed", enRole: "IT", path: "mohammed-intake" },
    { slug: "strategy", e: "📈", ar: "أحمد", arRole: "مدير التخطيط الاستراتيجي", en: "Ahmed", enRole: "Strategic Planning Manager", path: "strategy-intake" },
    { slug: "ahmed", e: "🛒", ar: "عبدالله", arRole: "مشتريات وتوريد", en: "Abdullah", enRole: "Procurement & Supply", path: "ahmed-procurement" },
  ];
  const AGENTS_JS = JSON.stringify(
    agentData.map((a) => ({ slug: a.slug, e: a.e, name: LANG === "ar" ? a.ar : a.en, role: LANG === "ar" ? a.arRole : a.enRole, mode: a.mode || "intake", path: a.path || "", ep: a.ep || "" }))
  );

  // Connectors — same set as the specialized team's /connect hub.
  const toolData = [
    { id: "gmail", ic: "📧", name: "Gmail", type: "easy",
      uAr: "يقرأ ويصنّف بريدك، يسوّد ويرسل الردود.", uEn: "Reads, sorts, drafts & sends your email.",
      leadAr: "ربط بضغطة عبر تسجيل دخول قوقل — بدون توكن، مجاناً.", leadEn: "One-click via Google sign-in — no token, free.",
      stepsAr: ["اضغط ربط الآن فتفتح صفحة تسجيل قوقل.", "اختر حساب الشركة ووافق على الصلاحيات.", "يشتغل الموظف داخل بريدك مباشرة."],
      stepsEn: ["Click Connect — Google sign-in opens.", "Pick the company account and approve access.", "The agent works inside your inbox."] },
    { id: "gcal", ic: "📅", name: LANG === "ar" ? "تقويم قوقل" : "Google Calendar", type: "easy",
      uAr: "يجدول المواعيد والدعوات والتذكيرات.", uEn: "Schedules meetings, invites & reminders.",
      leadAr: "ربط بضغطة مع حساب قوقل — مجاناً.", leadEn: "One-click with your Google account — free.",
      stepsAr: ["سجّل دخول قوقل.", "وافق على صلاحية التقويم.", "يقدر يجدول ويعدّل مواعيدك."],
      stepsEn: ["Sign in with Google.", "Approve calendar access.", "It can schedule and edit your meetings."] },
    { id: "notion", ic: "🗒️", name: "Notion", type: "easy",
      uAr: "ينظّم المهام وقواعد البيانات والتوثيق.", uEn: "Organizes tasks, databases & docs.",
      leadAr: "ربط بضغطة عبر Notion — مجاناً.", leadEn: "One-click via Notion — free.",
      stepsAr: ["وافق على Notion.", "اختر الصفحات المشتركة.", "يقرأ ويكتب في نوشن حسب صلاحياتك."],
      stepsEn: ["Approve Notion.", "Pick the shared pages.", "It reads & writes per your permissions."] },
    { id: "slack", ic: "💬", name: "Slack", type: "easy",
      uAr: "يرد وينبّه ويلخّص داخل قنوات فريقك.", uEn: "Replies, alerts & summarizes in your channels.",
      leadAr: "ربط بضغطة عبر Slack — مجاناً.", leadEn: "One-click via Slack — free.",
      stepsAr: ["ثبّت التطبيق في مساحة سلاك.", "اختر القنوات.", "يشتغل داخل سلاك."],
      stepsEn: ["Install the app in your Slack.", "Pick channels.", "It works inside Slack."] },
    { id: "whatsapp", ic: "🟢", name: "WhatsApp", type: "cost",
      uAr: "يرد على عملائك على واتساب ٢٤/٧.", uEn: "Answers your customers on WhatsApp 24/7.",
      leadAr: "يحتاج رقم أعمال + إعداد WhatsApp Cloud API من Meta. فيه تكلفة رسائل تُدفع لـ Meta.", leadEn: "Needs a business number + WhatsApp Cloud API from Meta. Message cost is paid to Meta.",
      payAr: "تكلفة الرسائل تُدفع لـ Meta حسب عدد المحادثات.", payEn: "Message cost is paid to Meta per conversation.",
      stepsAr: ["أنشئ حساب Meta Business + رقم واتساب أعمال.", "فعّل WhatsApp Cloud API واحصل على التوكن.", "الصق التوكن (يُخزّن مشفّراً) أو أرسله لنا.", "اربط فيرد الموظف على عملائك."],
      stepsEn: ["Create Meta Business + a WhatsApp business number.", "Enable WhatsApp Cloud API and get the token.", "Paste the token (stored encrypted) or send it to us.", "Connect — the agent replies to your customers."] },
    { id: "ms", ic: "🟦", name: LANG === "ar" ? "مايكروسوفت (Teams/Outlook)" : "Microsoft (Teams/Outlook)", type: "token",
      uAr: "يدير أوتلوك وتقويم ورسائل تيمس.", uEn: "Runs Outlook, calendar & Teams messages.",
      leadAr: "ربط عبر تسجيل دخول مايكروسوفت. قد يحتاج اشتراك Microsoft 365.", leadEn: "Connect via Microsoft sign-in. May need a Microsoft 365 subscription.",
      payAr: "إن لم يكن لديك 365 يلزم اشتراك من مايكروسوفت.", payEn: "If you don't have 365, a Microsoft subscription is required.",
      stepsAr: ["سجّل دخول مايكروسوفت للعمل.", "وافق على صلاحيات البريد/التقويم/تيمس.", "يشتغل داخل بيئة مايكروسوفت."],
      stepsEn: ["Sign in with Microsoft for work.", "Approve mail/calendar/Teams access.", "It works inside Microsoft."] },
    { id: "drive", ic: "📁", name: "Google Drive", type: "easy",
      uAr: "ينظّم ملفاتك ويلخّص المستندات.", uEn: "Organizes files & summarizes documents.",
      leadAr: "ربط بضغطة مع حساب قوقل — مجاناً.", leadEn: "One-click with your Google account — free.",
      stepsAr: ["سجّل دخول قوقل.", "وافق على صلاحية Drive.", "يقرأ وينظّم ملفاتك."],
      stepsEn: ["Sign in with Google.", "Approve Drive access.", "It reads & organizes your files."] },
    { id: "crm", ic: "📊", name: LANG === "ar" ? "CRM / جداول" : "CRM / Sheets", type: "token",
      uAr: "يحدّث العملاء والصفقات في CRM أو Sheets.", uEn: "Updates customers & deals in CRM or Sheets.",
      leadAr: "نربطه بـ Google Sheets أو CRM لديك (قد يحتاج مفتاح API).", leadEn: "We connect Google Sheets or your CRM (may need an API key).",
      stepsAr: ["أخبرنا بنظامك.", "نجهّز الربط المناسب.", "يحدّث بياناتك تلقائياً."],
      stepsEn: ["Tell us your system.", "We set up the right link.", "It updates your data automatically."] },
    { id: "qoyod", ic: "🧾", name: LANG === "ar" ? "قيود (Qoyod)" : "Qoyod", type: "token",
      uAr: "محاسبة وفوترة: يصدر فواتير ضريبية متوافقة ZATCA ويزامن العملاء والقيود.", uEn: "Accounting & billing: issues ZATCA tax invoices and syncs customers & entries.",
      leadAr: "ربط بمفتاح API خاص من حساب قيود لديك — متوافق مع ZATCA وبياناته داخل السعودية. أي إصدار فاتورة يتم بموافقتك.", leadEn: "Connect with your Qoyod account API key — ZATCA-compliant, data hosted in Saudi Arabia. Any invoice issuance needs your approval.",
      payAr: "يتطلب اشتراك قيود فعّال لدى شركتك (الـ API مجاني على الباقات المدفوعة).", payEn: "Requires an active Qoyod subscription (the API is free on paid plans).",
      stepsAr: ["من حساب قيود: الإعدادات ← API، أنشئ مفتاحاً خاصاً.", "الصق المفتاح هنا (يُخزّن مشفّراً).", "يصير الوكيل يصدر الفواتير ويزامن القيود — بموافقتك قبل أي إصدار."],
      stepsEn: ["In Qoyod: Settings → API, create a private key.", "Paste the key here (stored encrypted).", "The agent issues invoices & syncs entries — with your approval before any issuance."] },
    { id: "salla", ic: "🛒", name: LANG === "ar" ? "سلة (Salla)" : "Salla", type: "token",
      uAr: "متجرك الإلكتروني: الطلبات والعملاء والمنتجات تصل لفريقك مباشرة.", uEn: "Your e-commerce store: orders, customers and products flow straight to your team.",
      leadAr: "نربط متجرك في سلة عبر مفتاح API خاص — الفريق يتابع الطلبات الجديدة، يجهّز ردود عملاء متجرك، ويبني تقارير المبيعات. أي إجراء يغيّر بيانات المتجر بموافقتك.", leadEn: "We connect your Salla store via a private API key — the team tracks new orders, drafts customer replies and builds sales reports. Any change to store data needs your approval.",
      payAr: "يتطلب متجراً فعّالاً على منصة سلة.", payEn: "Requires an active Salla store.",
      stepsAr: ["من لوحة سلة: التطبيقات ← مفاتيح API، أنشئ مفتاحاً خاصاً.", "الصق المفتاح هنا (يُخزّن مشفّراً).", "يبدأ الفريق بمتابعة طلباتك وتقاريرك — وأي تعديل على المتجر بموافقتك."],
      stepsEn: ["In Salla admin: Apps → API keys, create a private key.", "Paste the key here (stored encrypted).", "The team tracks orders & reports — store changes need your approval."] },
  ];
  const TOOLS_JS = JSON.stringify(
    toolData.map((t) => ({ id: t.id, ic: t.ic, name: t.name, type: t.type, u: LANG === "ar" ? t.uAr : t.uEn, lead: LANG === "ar" ? t.leadAr : t.leadEn, pay: (LANG === "ar" ? t.payAr : t.payEn) || "", steps: LANG === "ar" ? t.stepsAr : t.stepsEn }))
  );
  const compPlatforms = (LANG === "ar" ? ["قوى", "مقيم", "التأمينات", "مدد", "النطاقات", "ZATCA"] : ["Qiwa", "Muqeem", "GOSI", "Mudad", "Nitaqat", "ZATCA"])
    .map((p) => `<span class="ss-plat-chip"><span class="dot"></span>${esc(p)}</span>`).join("");

  // Detailed roster — services each agent delivers + how they work. Public info.
  const roster = [
    { e: "👑", ar: "باهر", arRole: "مستشار الأعمال", en: "Baher", enRole: "Business Advisor",
      svcAr: ["استقبال الطلبات", "التوجيه للمتخصص", "متابعة التنفيذ", "تسليم المخرجات"], svcEn: ["Request intake", "Routing", "Follow-through", "Delivery"],
      mAr: "الواجهة الواحدة — يفهم طلبك، يملكه، يوزّعه على المتخصص، يجمع النتيجة ويسلّمها جاهزة.", mEn: "Your single interface — understands the request, owns it, delegates, and delivers a finished result." },
    { e: "🧭", ar: "مازن", arRole: "مدير العمليات", en: "Mazen", enRole: "Operations Manager",
      svcAr: ["تنسيق التنفيذ", "تقسيم المهام", "إجراءات التشغيل (SOP)", "ضبط الجودة"], svcEn: ["Execution coordination", "Task breakdown", "SOPs", "Quality control"],
      mAr: "ينسّق الأعمال متعدّدة الخطوات داخلياً بين المتخصصين حتى التسليم.", mEn: "Coordinates multi-step work internally across specialists through to delivery." },
    { e: "👥", ar: "ناصر", arRole: "الموارد البشرية", en: "Nasser", enRole: "Human Resources",
      svcAr: ["التوظيف", "عقود العمل", "الرواتب", "السياسات والوصف الوظيفي"], svcEn: ["Hiring", "Contracts", "Payroll", "Policies & JDs"],
      mAr: "يدير دورة الموظف كاملة نيابةً عنك.", mEn: "Runs the full employee lifecycle on your behalf." },
    { e: "🛡️", ar: "مشاري", arRole: "الامتثال والالتزام", en: "Mishari", enRole: "Compliance",
      svcAr: ["قوى ومقيم", "التأمينات ومدد", "النطاقات", "ZATCA"], svcEn: ["Qiwa & Muqeem", "GOSI & Mudad", "Nitaqat", "ZATCA"],
      mAr: "مراقبة يومية وتنبيه قبل كل استحقاق — كل إجراء حكومي بموافقتك.", mEn: "Daily monitoring and alerts before every deadline — every government action needs your approval." },
    { e: "💰", ar: "عبدالرحمن", arRole: "المدير المالي", en: "Abdulrahman", enRole: "Chief Financial Officer",
      svcAr: ["الميزانيات والتدفّق النقدي", "الفوترة والتحصيل", "التقارير المالية", "الزكاة والضريبة (VAT)"], svcEn: ["Budgets & cash flow", "Invoicing & collections", "Financial reports", "Zakat & VAT"],
      mAr: "يدير ماليتك ويصدر الفواتير والتقارير عبر قيود — أي دفعة أو إصدار فاتورة بموافقتك.", mEn: "Runs your finances and issues invoices & reports via Qoyod — any payment or issuance needs your approval." },
    { e: "⚖️", ar: "عبدالعزيز", arRole: "القانوني", en: "Abdulaziz", enRole: "Legal",
      svcAr: ["العقود", "التأسيس", "التراخيص", "الهيكلة القانونية"], svcEn: ["Contracts", "Incorporation", "Licensing", "Legal structuring"],
      mAr: "يصيغ ويراجع المستندات القانونية — والتوقيع بموافقتك.", mEn: "Drafts and reviews legal documents — signing needs your approval." },
    { e: "💼", ar: "بدر", arRole: "مبيعات وتطوير أعمال", en: "Badr", enRole: "Sales & Business Development",
      svcAr: ["عروض الأسعار", "الباقات", "العروض التجارية", "نطاق الخدمة"], svcEn: ["Quotes", "Bundles", "Commercial proposals", "Scope of work"],
      mAr: "يجهّز العروض والمقترحات التجارية لعملائك.", mEn: "Prepares quotes and commercial proposals for your clients." },
    { e: "📣", ar: "فرح", arRole: "تسويق ومحتوى", en: "Farah", enRole: "Marketing & Content",
      svcAr: ["المحتوى", "الحملات", "السوشال", "SEO والهوية"], svcEn: ["Content", "Campaigns", "Social", "SEO & brand"],
      mAr: "تخطّط وتنتج المحتوى والحملات التسويقية.", mEn: "Plans and produces content and marketing campaigns." },
    { e: "🗂️", ar: "ملاك", arRole: "مساعِدة تنفيذية", en: "Malak", enRole: "Executive Assistant",
      svcAr: ["صياغة الإيميلات", "التلخيص", "تنظيم المهام", "التذكيرات"], svcEn: ["Email drafting", "Summaries", "Task organizing", "Reminders"],
      mAr: "تدير مهامك اليومية وتنظّم أعمالك.", mEn: "Runs your day-to-day tasks and keeps you organized." },
    { e: "💻", ar: "محمد", arRole: "تقنية المعلومات", en: "Mohammed", enRole: "IT",
      svcAr: ["المواقع والتطبيقات", "الأتمتة", "ربط الـAPIs", "الدعم التقني"], svcEn: ["Sites & apps", "Automation", "API integration", "Tech support"],
      mAr: "يبني ويشغّل حلولك التقنية ويربط أنظمتك.", mEn: "Builds and runs your tech and connects your systems." },
    { e: "📈", ar: "أحمد", arRole: "مدير التخطيط الاستراتيجي", en: "Ahmed", enRole: "Strategic Planning Manager",
      svcAr: ["الرؤية والخطط السنوية", "الأهداف وOKRs", "خرائط الطريق", "متابعة التنفيذ"], svcEn: ["Vision & annual plans", "OKRs & KPIs", "Roadmaps", "Execution tracking"],
      mAr: "يحوّل طموحك لخطة مكتوبة بأهداف ومؤشرات وخارطة طريق ربعية — ويتابع التنفيذ.", mEn: "Turns your ambition into a written plan with OKRs, KPIs and a quarterly roadmap — and tracks execution." },
    { e: "🛒", ar: "عبدالله", arRole: "مشتريات وتوريد", en: "Abdullah", enRole: "Procurement & Supply",
      svcAr: ["إيجاد الموردين", "مقارنة العروض", "طلبات عروض الأسعار (RFQ)", "التفاوض التمهيدي"], svcEn: ["Sourcing suppliers", "Comparing offers", "RFQs", "Initial negotiation"],
      mAr: "يجد الموردين ويجهّز طلبات الشراء — والإرسال الخارجي بموافقتك.", mEn: "Finds suppliers and prepares purchase requests — external sending needs your approval." },
  ];

  const body = `
  <section class="ss-hero">
    <div class="wrap">
      <span class="eyebrow">${L("Shared Services", "الخدمات المشتركة")}</span>
      <h1>${L("Your smart executive team", "فريقك التنفيذي الذكي")}</h1>
      <p class="lead">${L("Instead of hiring a whole office, get a full team of smart agents that work as your own staff: government & compliance, sales, marketing, IT, procurement, and an executive assistant — led by Baher, who understands your request, delegates to the right specialist, executes, and escalates only what needs your approval.", "بدل ما توظّف مكتباً كاملاً، احصل على فريق وكلاء أذكياء يعملون كموظفيك: حكومي وامتثال، مبيعات، تسويق، تقنية، مشتريات، ومساعِدة تنفيذية — بقيادة باهر الذي يفهم طلبك، يوزّعه على المتخصص المناسب، ينفّذ، ويصعّد فقط ما يحتاج موافقتك.")}</p>
      <div class="ss-cta">
        <a class="btn btn-primary" href="${u("/shared-services/dashboard")}">🔑 ${L("Service portal — sign in", "دخول بوابة الخدمة")}</a>
        <a class="btn btn-primary" style="background:#12b3ad;border-color:#12b3ad" href="#ss-subscribe">${L("Subscribe now", "اشترك الآن")}</a>
        <a class="btn btn-ghost" href="#ss-roster">${L("Meet the team", "تعرّف على الفريق")}</a>
      </div>
      <div class="ss-proof">
        <span>⚡ ${L("Picks up your request in seconds", "يستلم طلبك خلال ثوانٍ")}</span>
        <span>🕐 ${L("Works 24/7", "يعمل 24/7")}</span>
        <span>👥 ${L("12 specialists in one subscription — a full team, not a single bot", "12 متخصصاً باشتراك واحد — فريق كامل، لا وكيل واحد")}</span>
        <span>🔒 ${L("Anything binding waits for your approval", "أي التزام ينتظر موافقتك")}</span>
      </div>
      <style>
        .ss-proof{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin-top:20px}
        .ss-proof span{background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 15px;font-size:.84rem;font-weight:600;color:var(--brand,#0b1b5a);box-shadow:0 4px 12px rgba(11,27,90,.05)}
      </style>
    </div>
  </section>

  <section class="ss-sec">
    <div class="wrap">
      <div class="sec-head"><h2>${L("How the service works", "كيف تعمل الخدمة")}</h2><p>${L("One request in plain language — the team takes it from there.", "طلب واحد بلغتك العادية — والفريق يتكفّل بالباقي.")}</p></div>
      <div class="ss-how">
        <div class="ss-how-s"><span class="n">1</span><b>${L("Ask in plain words", "اطلب بلغتك")}</b><p>${L("Write your request in everyday Arabic or English.", "اكتب طلبك بالعربي أو الإنجليزي العادي.")}</p></div>
        <div class="ss-how-s"><span class="n">2</span><b>${L("Baher routes it", "باهر يوزّعه")}</b><p>${L("He understands the request and hands it to the right specialist.", "يفهم الطلب ويسلّمه للمتخصص المناسب.")}</p></div>
        <div class="ss-how-s"><span class="n">3</span><b>${L("The specialist executes", "المتخصص ينفّذ")}</b><p>${L("The work is done and logged in your isolated workspace.", "يُنفَّذ العمل ويُوثَّق في مساحتك المعزولة.")}</p></div>
        <div class="ss-how-s"><span class="n">4</span><b>${L("You approve what binds", "توافق على الملزم")}</b><p>${L("Any payment, signature or external send waits for your approval.", "أي دفع أو توقيع أو إرسال خارجي ينتظر موافقتك.")}</p></div>
      </div>
    </div>
  </section>

  <section class="ss-sec" id="ss-roster">
    <div class="wrap">
      <div class="sec-head"><h2>${L("Meet your team", "تعرّف على فريقك")}</h2><p>${L("The same specialists as the standalone team — here they work together as one coordinated team. Each with the services they deliver and how they work.", "نفس متخصّصي الفريق المستقل — هنا يعملون معاً كفريق واحد منسّق. لكل واحد خدماته وطريقة عمله.")}</p></div>
      <div class="ss-roster">
        ${roster.map((r) => `<article class="ss-rc">
          <div class="ss-rc-h"><span class="e">${r.e}</span><div><b>${L(r.en, r.ar)}</b><span>${L(r.enRole, r.arRole)}</span></div></div>
          <div class="ss-rc-svc">${(LANG === "ar" ? r.svcAr : r.svcEn).map((s) => `<span>${esc(s)}</span>`).join("")}</div>
          <p class="ss-rc-m"><b>${L("How they work", "طريقة العمل")}:</b> ${L(r.mEn, r.mAr)}</p>
        </article>`).join("")}
      </div>
      ${feats.length ? `<ul class="ss-feats">${feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    </div>
  </section>

  <section class="ss-sec ss-hier-sec" id="ss-structure">
    <div class="wrap">
      <div class="sec-head"><h2>${L("The internal structure — how they all work together", "الهيكل الداخلي — كيف يعمل الفريق معاً")}</h2><p>${L("Your request's journey step by step: one channel in, a full team executing behind the scenes, and your approval before anything binding.", "رحلة طلبك خطوة بخطوة: قناة واحدة تدخل منها، فريق كامل ينفّذ خلف الكواليس، وموافقتك قبل أي إجراء ملزم.")}</p></div>
      <div class="ss-org">
        <div class="ss-onode you"><span class="e">👤</span><div><b>${L("You — the client", "أنت — العميل")}</b><span>${L("Write your request in plain language — one channel only, no chasing anyone.", "تكتب طلبك بلغتك العادية — قناة واحدة فقط، وما تحتاج تلاحق أحداً.")}</span></div></div>
        <div class="ss-oconn"><i>1</i><em>${L("The request", "الطلب")}</em></div>
        <div class="ss-onode lead"><span class="e">👑</span><div><b>${L("Baher — Business Advisor & Team Lead", "باهر — مستشار الأعمال وقائد الفريق")}</b><span>${L("Receives your request, owns it end to end, assigns the right specialist, collects the work, and hands you a finished result.", "يستقبل طلبك، يملكه من أوله لآخره، يكلّف المتخصص المناسب، يجمع الشغل، ويسلّمك نتيجة جاهزة.")}</span></div></div>
        <div class="ss-oconn"><i>2</i><em>${L("Coordination", "التوزيع والتنسيق")}</em></div>
        <div class="ss-onode ops"><span class="e">🧭</span><div><b>${L("Mazen — Operations Manager", "مازن — مدير العمليات")}</b><span>${L("Coordinates multi-step execution across specialists and guards delivery quality — works behind the scenes.", "ينسّق التنفيذ متعدد الخطوات بين المتخصصين ويراقب جودة التسليم — يعمل خلف الكواليس.")}</span></div></div>
        <div class="ss-oconn"><i>3</i><em>${L("Specialist execution", "التنفيذ المتخصص")}</em></div>
        <div class="ss-ogroups">
          <div class="ss-ogroup"><b>🎯 ${L("Advisory & planning", "الاستشارة والتخطيط")}</b>
            <span class="ss-oa"><i>📈</i>${L("Ahmed — Strategic Planning", "أحمد — التخطيط الاستراتيجي")}</span></div>
          <div class="ss-ogroup"><b>⚖️ ${L("Finance, compliance & legal", "المال والامتثال والقانون")}</b>
            <span class="ss-oa"><i>💰</i>${L("Abdulrahman — CFO", "عبدالرحمن — المدير المالي")}</span>
            <span class="ss-oa"><i>🛡️</i>${L("Mishari — Compliance", "مشاري — الامتثال الحكومي")}</span>
            <span class="ss-oa"><i>📜</i>${L("Abdulaziz — Legal", "عبدالعزيز — القانوني")}</span></div>
          <div class="ss-ogroup"><b>📣 ${L("Growth", "النمو")}</b>
            <span class="ss-oa"><i>🤝</i>${L("Badr — Sales & BD", "بدر — المبيعات وتطوير الأعمال")}</span>
            <span class="ss-oa"><i>🎨</i>${L("Farah — Marketing", "فرح — التسويق والمحتوى")}</span></div>
          <div class="ss-ogroup"><b>🛠️ ${L("Operations & support", "التشغيل والدعم")}</b>
            <span class="ss-oa"><i>👥</i>${L("Nasser — HR", "ناصر — الموارد البشرية")}</span>
            <span class="ss-oa"><i>🛒</i>${L("Abdullah — Procurement", "عبدالله — المشتريات والتوريد")}</span>
            <span class="ss-oa"><i>💻</i>${L("Mohammed — IT", "محمد — التقنية")}</span>
            <span class="ss-oa"><i>📋</i>${L("Malak — Executive Assistant", "ملاك — مساعِدة تنفيذية")}</span></div>
        </div>
        <div class="ss-opeer">↔️ ${L("Peer consult: any specialist may consult one colleague when your request crosses fields — without bothering you with the details.", "استشارة الزملاء: أي متخصص يستشير زميلاً واحداً لو احتاج طلبك خبرة إضافية — بدون ما يشغلك بالتفاصيل.")}</div>
        <div class="ss-oconn gold"><i>4</i><em>${L("Governance gate", "بوابة الحوكمة")}</em></div>
        <div class="ss-onode gov"><span class="e">🔒</span><div><b>${L("Your mandatory approval", "موافقتك الإلزامية")}</b><span>${L("Any payment, signature, binding commitment, paid government submission or official external message is prepared ready-to-go — then WAITS for your approval.", "أي دفع أو توقيع أو التزام ملزم أو تقديم حكومي مدفوع أو رسالة رسمية خارجية — تتجهّز كاملة ثم تقف عند «بانتظار موافقتك».")}</span></div></div>
        <div class="ss-oconn green"><i>5</i><em>${L("Delivery", "التسليم")}</em></div>
        <div class="ss-onode done"><span class="e">✅</span><div><b>${L("Finished output + documentation", "مخرج جاهز + توثيق")}</b><span>${L("Baher hands you the result, and every task and conversation is logged in your own isolated workspace.", "باهر يسلّمك النتيجة، وكل مهمة ومحادثة تُوثَّق في مساحتك الخاصة المعزولة عن بقية العملاء.")}</span></div></div>
      </div>
      <div class="ss-hgrid">
        <div class="ss-hcard"><b>📲 ${L("Human escalation", "التصعيد البشري")}</b><span>${L("Field, financial and government work is escalated by WhatsApp to your own staff.", "الأعمال الميدانية والمالية والحكومية تُصعَّد بواتساب لموظفيك أنت.")}</span></div>
        <div class="ss-hcard"><b>🗄️ ${L("Isolated workspace per client", "مساحة معزولة لكل عميل")}</b><span>${L("Your tasks, conversations and approvals live in your own private space — zero overlap with other clients.", "مهامك ومحادثاتك وموافقاتك في مساحة خاصة بك — صفر تداخل مع أي عميل آخر.")}</span></div>
        <div class="ss-hcard gov"><b>🔐 ${L("Security", "الأمان")}</b><span>${L("We never ask for passwords or OTP. Your access code is secret and emailed only to your registered address.", "لا نطلب كلمات مرور أو OTP أبداً. رمز دخولك سرّي ويُرسل لبريدك المسجّل فقط.")}</span></div>
      </div>
    </div>
    <style>
      .ss-org{display:flex;flex-direction:column;align-items:center;max-width:860px;margin:0 auto}
      .ss-onode{display:flex;gap:14px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:16px 22px;box-shadow:0 8px 24px rgba(11,27,90,.07);max-width:600px;width:100%;text-align:start}
      .ss-onode .e{font-size:1.9rem;line-height:1}
      .ss-onode b{display:block;color:var(--brand,#0b1b5a);font-size:1.02rem;margin-bottom:3px}
      .ss-onode span{display:block;font-size:.84rem;color:var(--text-soft,#5b6b86);line-height:1.7}
      .ss-onode.you{border-color:#12b3ad;box-shadow:0 8px 24px rgba(18,179,173,.14)}
      .ss-onode.lead{border-color:var(--brand,#0b1b5a);border-width:2px}
      .ss-onode.gov{border-color:#e8c35a;background:#fffdf4}
      .ss-onode.done{border-color:#4caf7d;background:#f6fcf8}
      .ss-oconn{position:relative;width:2px;height:46px;background:var(--line);margin:2px 0}
      .ss-oconn::after{content:"";position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:var(--line);border-bottom:0}
      .ss-oconn i{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:var(--brand,#0b1b5a);color:#fff;font-style:normal;font-weight:800;font-size:.78rem;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px #f6f9fc}
      .ss-oconn em{position:absolute;top:50%;transform:translateY(-50%);inset-inline-start:calc(50% + 22px);white-space:nowrap;font-style:normal;font-size:.8rem;font-weight:700;color:var(--brand,#0b1b5a)}
      .ss-oconn.gold i{background:#c99617}
      .ss-oconn.green i{background:#2f9e64}
      .ss-ogroups{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%;margin:2px 0}
      .ss-ogroup{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 14px}
      .ss-ogroup>b{display:block;color:var(--brand,#0b1b5a);font-size:.88rem;margin-bottom:9px}
      .ss-oa{display:flex;align-items:center;gap:8px;font-size:.8rem;font-weight:600;color:#3d4a63;background:#f4f8fb;border:1px solid var(--line);border-radius:9px;padding:6px 9px;margin-top:6px}
      .ss-oa i{font-style:normal}
      .ss-opeer{margin:12px 0 2px;max-width:640px;text-align:center;font-size:.82rem;color:var(--text-soft,#5b6b86);border:1.5px dashed #b9c6dd;border-radius:12px;padding:10px 16px;background:#fbfdff;line-height:1.7}
      @media(max-width:900px){.ss-ogroups{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.ss-ogroups{grid-template-columns:1fr}.ss-oconn em{display:none}}
    </style>
  </section>

  <section class="ss-sec" id="ss-subscribe">
    <div class="wrap">
      <div class="sec-head"><h2>${L("How to subscribe & open your service", "كيف تشترك وتفتح خدمتك")}</h2><p>${L("A clear journey from subscription to opening your dashboard.", "رحلة واضحة من الاشتراك حتى فتح لوحتك.")}</p></div>
      <div class="ss-steps">
        <div class="ss-step"><span class="n">1</span><b>${L("Add to cart", "أضف للسلة")}</b><p>${L("Add the shared-services subscription to your cart from this page.", "أضف اشتراك الخدمات المشتركة لسلتك من هذه الصفحة.")}</p></div>
        <div class="ss-step"><span class="n">2</span><b>${L("Pay", "ادفع")}</b><p>${L("Complete checkout with a bank transfer and upload the receipt.", "أكمل الطلب بالتحويل البنكي وارفع الإيصال.")}</p></div>
        <div class="ss-step"><span class="n">3</span><b>${L("Get your code", "يوصلك رمزك")}</b><p>${L("Once payment is confirmed, your access code is emailed to your registered address.", "بعد تأكيد الدفع، يصلك رمز الدخول على بريدك المسجّل.")}</p></div>
        <div class="ss-step"><span class="n">4</span><b>${L("Open your dashboard", "افتح لوحتك")}</b><p>${L("Enter your code in the service portal and your team dashboard opens.", "أدخل رمزك في بوابة الخدمة فتفتح لوحة فريقك.")}</p></div>
      </div>
      <div class="ss-price-box">
        <div><div class="ss-price-amt">1,500 <small>${L("SAR / monthly — starting price", "﷼ / شهرياً — سعر البداية")}</small></div>
        <div class="ss-price-note">${L("A full executive team of 12 (11 specialists led by Baher) under one subscription.", "فريق تنفيذي كامل من 12 (11 متخصصاً بقيادة باهر) تحت اشتراك واحد.")}</div></div>
        <button type="button" class="btn btn-primary btn-lg add-cart" data-id="agent-Shared-services-team" data-name-en="Shared services team" data-name-ar="فريق الخدمات المشتركة" data-amount="1500" data-price="${Lraw("From 1,500 SAR / monthly", "يبدأ من 1,500 ﷼ / شهرياً")}" data-kind="agent">${L("🛒 Add to cart", "🛒 أضف للسلة")}</button>
      </div>
      <div class="ss-cta" style="justify-content:center;margin-top:26px">
        <a class="btn btn-ghost" href="${u("/consultation")}?topic=other&about=${encodeURIComponent(Lraw("Shared services team subscription", "اشتراك فريق الخدمات المشتركة"))}">${L("Prefer a tailored offer? Book a consultation", "تفضّل عرضاً مخصصاً؟ احجز استشارة")}</a>
        <a class="btn btn-ghost" href="${u("/account")}">${L("Client portal", "بوابة العميل")}</a>
      </div>

      <div class="ss-portal-entry">
        <div>
          <b>🔑 ${L("Service portal — sign in", "بوابة الخدمة — سجّل دخولك")}</b>
          <span>${L("Already subscribed? Enter the service portal and unlock your executive team dashboard with the code that was emailed to you after payment.", "مشترك؟ ادخل بوابة الخدمة وافتح لوحة فريقك التنفيذي برمز الدخول اللي وصلك على بريدك بعد الدفع.")}</span>
        </div>
        <a class="btn btn-primary btn-lg" href="${u("/shared-services/dashboard")}">${L("Enter the service portal →", "دخول بوابة الخدمة ←")}</a>
      </div>
    </div>
  </section>

  <style>
    .ss-hero{padding:52px 0 8px;text-align:center}
    .ss-hero h1{margin:8px 0 12px}
    .ss-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:20px}
    .ss-price-box{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;justify-content:space-between;background:var(--white,#fff);border:1px solid var(--gray-line,#E4E7F0);border-radius:18px;padding:1.3rem 1.5rem;max-width:760px;margin:26px auto 0}
    .ss-price-amt{font-size:2rem;font-weight:800;color:var(--navy,#0B1B5A)}
    .ss-price-amt small{font-size:.95rem;color:var(--text-soft,#4a4f5e);font-weight:600}
    .ss-price-note{color:var(--text-soft,#4a4f5e);font-size:.92rem}
    .ss-sec{padding:36px 0}
    .ss-team{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:8px 0 20px}
    .ss-chip{display:inline-flex;align-items:center;gap:8px;background:#f4f8fb;border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-weight:600;font-size:.92rem}
    .ss-feats{max-width:760px;margin:0 auto;display:grid;gap:10px;list-style:none;padding:0}
    .ss-feats li{position:relative;padding-inline-start:26px;line-height:1.7}
    .ss-feats li::before{content:'✓';position:absolute;inset-inline-start:0;color:#12b3ad;font-weight:800}
    .ss-log{display:flex;flex-direction:column;gap:10px;min-height:180px;max-height:440px;overflow-y:auto;padding:8px}
    .ss-msg{max-width:88%;padding:11px 14px;border-radius:14px;line-height:1.75;white-space:pre-wrap}
    .ss-msg.bot{align-self:flex-start;background:#f1f5f8;border:1px solid var(--line)}
    .ss-msg.me{align-self:flex-end;background:#0e5a55;color:#eafffb}
    .ss-msg.empty{align-self:center;background:none;border:0;color:var(--text-soft,#5b6b86);font-size:.9rem}
    .ss-form{display:flex;gap:8px;margin-top:12px}
    .ss-form input{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font:inherit}
    /* ---- dashboard ---- */
    .ss-dash-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .ss-dash-head>div{flex:1;min-width:260px}
    .ss-dash-head h2{margin:0 0 6px}
    .ss-dash-head p{color:var(--text-soft,#5b6b86);margin:0;line-height:1.8}
    .ss-logout{background:#f1f4fb;border:1px solid var(--line);border-radius:10px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;color:var(--brand,#0b1b5a)}
    .ss-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:20px}
    .ss-tab{background:none;border:0;border-bottom:2.5px solid transparent;padding:11px 14px;font:inherit;font-weight:700;color:var(--text-soft,#5b6b86);cursor:pointer}
    .ss-tab.active{color:var(--brand,#0b1b5a);border-bottom-color:var(--brand,#0b1b5a)}
    .ss-pane-lead{color:var(--text-soft,#5b6b86);margin:0 0 16px;line-height:1.8}
    .ss-agents{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:18px}
    .ss-ag{display:flex;gap:10px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:13px;padding:11px 13px;cursor:pointer;transition:.12s;text-align:start}
    .ss-ag:hover{border-color:var(--brand,#0b1b5a);transform:translateY(-1px)}
    .ss-ag.sel{border-color:var(--brand,#0b1b5a);background:#eef1fb}
    .ss-ag .e{font-size:1.5rem;line-height:1}
    .ss-ag b{display:block;color:var(--brand,#0b1b5a);font-size:.95rem}
    .ss-ag span{display:block;font-size:.75rem;color:var(--text-soft,#5b6b86)}
    .ss-panel{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(11,27,90,.06)}
    .ss-panel-head{display:flex;gap:11px;align-items:center;padding:13px 16px;background:#f8fafc;border-bottom:1px solid var(--line)}
    .ss-panel-head .e{font-size:1.7rem;line-height:1}
    .ss-panel-head b{color:var(--brand,#0b1b5a)}
    .ss-panel-head>div span{display:block;font-size:.78rem;color:var(--text-soft,#5b6b86)}
    .ss-live{margin-inline-start:auto;font-size:.74rem;font-weight:700;color:#12b3ad;white-space:nowrap}
    .ss-panel .ss-log{min-height:300px;max-height:480px}
    .ss-panel .ss-form{margin:0;padding:12px;border-top:1px solid var(--line);background:#fff}
    /* ---- connectors ---- */
    .ss-cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .ss-cc{background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;box-shadow:0 6px 18px rgba(11,27,90,.05)}
    .ss-cc-top{display:flex;gap:11px;align-items:flex-start;margin-bottom:8px}
    .ss-cc-ic{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:#f1f4fb;flex-shrink:0}
    .ss-cc-ic svg{width:25px;height:25px;display:block}
    .ss-cc-ic .brand{width:27px;height:27px;object-fit:contain}
    .ss-cc-t{flex:1}
    .ss-cc-t h3{font-size:1.02rem;color:var(--brand,#0b1b5a);margin:0}
    .ss-cc-t .u{font-size:.82rem;color:var(--text-soft,#5b6b86);line-height:1.6}
    .ss-cc-state{font-size:.7rem;font-weight:700;padding:.18rem .55rem;border-radius:999px;background:#eef1f8;color:#64748b;white-space:nowrap;align-self:flex-start}
    .ss-cc-state.on{background:#dcfce7;color:#065f46}
    .ss-cc-tag{font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;align-self:flex-start;margin-bottom:11px}
    .ss-cc-tag.easy{background:#e0f2fe;color:#075985}
    .ss-cc-tag.token{background:#fef3c7;color:#b45309}
    .ss-cc-tag.cost{background:#fee2e2;color:#991b1b}
    .ss-cc-actions{display:flex;gap:8px;margin-top:auto}
    .ss-cc-actions button{flex:1;border-radius:10px;padding:9px;font:inherit;font-size:.83rem;font-weight:700;border:0;cursor:pointer}
    .ss-cbtn{background:var(--brand,#0b1b5a);color:#fff}
    .ss-hbtn{background:#fff;color:var(--brand,#0b1b5a);border:1px solid var(--line)}
    .ss-secure{margin-top:18px;font-size:.86rem;color:var(--text-soft,#5b6b86);line-height:1.8;text-align:center}
    /* connector modal */
    .ss-ov{position:fixed;inset:0;background:rgba(8,12,30,.55);display:none;align-items:center;justify-content:center;padding:16px;z-index:1300}
    .ss-ov.on{display:flex}
    .ss-modal{background:#fff;border-radius:18px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;text-align:start}
    .ss-m-head{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;gap:11px;align-items:center}
    .ss-m-head .ss-cc-ic{width:40px;height:40px}
    .ss-m-head h3{flex:1;margin:0;color:var(--brand,#0b1b5a);font-size:1.12rem}
    .ss-m-x{background:#f1f4fb;border:0;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:1rem}
    .ss-m-body{padding:16px 18px}
    .ss-m-lead{font-size:.88rem;color:var(--text-soft,#5b6b86);margin:0 0 14px;line-height:1.7}
    .ss-stp{display:flex;gap:11px;margin-bottom:11px}
    .ss-stp .n{width:25px;height:25px;border-radius:50%;background:var(--brand,#0b1b5a);color:#fff;font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .ss-stp .tx{font-size:.86rem;line-height:1.6}
    .ss-pay{background:#fee2e2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:9px 12px;font-size:.82rem;margin-bottom:13px}
    .ss-m-foot{padding:14px 18px 18px;display:flex;gap:9px}
    .ss-m-foot button{flex:1;border-radius:11px;padding:11px;font:inherit;font-weight:700;border:0;cursor:pointer}
    /* ---- compliance ---- */
    .ss-comp{display:grid;grid-template-columns:1.5fr 1fr;gap:16px;align-items:start}
    .ss-comp-main{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 10px 30px rgba(11,27,90,.06)}
    .ss-comp-lead{display:flex;gap:13px;align-items:flex-start;flex-wrap:wrap}
    .ss-comp-lead .e{font-size:2rem;line-height:1}
    .ss-comp-lead>div{flex:1;min-width:200px}
    .ss-comp-lead b{color:var(--brand,#0b1b5a);font-size:1.05rem}
    .ss-comp-lead p{color:var(--text-soft,#5b6b86);margin:5px 0 0;line-height:1.8;font-size:.9rem}
    .ss-comp-lead .btn{white-space:nowrap}
    .ss-plat-head{margin:18px 0 9px;font-weight:700;color:var(--brand,#0b1b5a);font-size:.92rem}
    .ss-plat{display:flex;flex-wrap:wrap;gap:8px}
    .ss-plat-chip{display:inline-flex;align-items:center;gap:7px;background:#f4f8fb;border:1px solid var(--line);border-radius:999px;padding:6px 13px;font-weight:600;font-size:.85rem}
    .ss-plat-chip .dot{width:8px;height:8px;border-radius:50%;background:#12b3ad;box-shadow:0 0 0 3px rgba(18,179,173,.18)}
    .ss-comp-links{display:flex;flex-direction:column;gap:11px}
    .ss-comp-links a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;transition:.12s}
    .ss-comp-links a:hover{border-color:var(--brand,#0b1b5a);transform:translateY(-1px)}
    .ss-comp-links b{display:block;color:var(--brand,#0b1b5a);font-size:.95rem}
    .ss-comp-links span{display:block;font-size:.8rem;color:var(--text-soft,#5b6b86);margin-top:3px;line-height:1.6}
    @media(max-width:820px){.ss-comp{grid-template-columns:1fr}}
    .ss-access{max-width:560px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px 24px;text-align:center;box-shadow:0 10px 30px rgba(11,27,90,.06)}
    .ss-access h2{margin:0 0 8px}
    .ss-access>p{color:var(--text-soft,#5b6b86);margin:0 auto 18px;max-width:460px;line-height:1.8}
    .ss-access-form{display:flex;gap:8px;max-width:440px;margin:0 auto;flex-wrap:wrap;justify-content:center}
    .ss-access-form input{flex:1;min-width:200px;border:1px solid var(--line);border-radius:12px;padding:13px 15px;font:inherit;text-align:center;letter-spacing:1px}
    .ss-portal-link{display:inline-block;margin-top:16px;color:var(--brand,#0b1b5a);font-weight:600;text-decoration:none;font-size:.92rem}
    .ss-portal-link:hover{text-decoration:underline}
    .ss-note-box{margin:14px auto 0;max-width:440px;border-radius:12px;padding:12px 14px;font-size:.9rem;line-height:1.7}
    .ss-note-box.ok{background:#f2fbf5;border:1px solid #bfe8cd;color:#14663a}
    .ss-note-box.err{background:#fdf1f1;border:1px solid #f2c4c4;color:#a02020}
    /* ---- how it works ---- */
    .ss-how{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .ss-how-s{background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px 16px;box-shadow:0 6px 18px rgba(11,27,90,.05)}
    .ss-how-s .n{width:32px;height:32px;border-radius:50%;background:var(--brand,#0b1b5a);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:11px}
    .ss-how-s b{display:block;color:var(--brand,#0b1b5a);margin-bottom:5px}
    .ss-how-s p{margin:0;font-size:.85rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    @media(max-width:820px){.ss-how{grid-template-columns:1fr 1fr}}
    @media(max-width:520px){.ss-how{grid-template-columns:1fr}}
    /* ---- detailed roster ---- */
    .ss-roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:20px}
    .ss-rc{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 17px;box-shadow:0 6px 18px rgba(11,27,90,.05);display:flex;flex-direction:column}
    .ss-rc-h{display:flex;gap:12px;align-items:center;margin-bottom:12px}
    .ss-rc-h .e{font-size:1.9rem;line-height:1}
    .ss-rc-h b{display:block;color:var(--brand,#0b1b5a);font-size:1.02rem}
    .ss-rc-h span{display:block;font-size:.8rem;color:var(--text-soft,#5b6b86)}
    .ss-rc-svc{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}
    .ss-rc-svc span{background:#eef1fb;color:var(--brand,#0b1b5a);border-radius:999px;padding:4px 10px;font-size:.76rem;font-weight:600}
    .ss-rc-m{margin:auto 0 0;font-size:.84rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    .ss-rc-m b{color:var(--brand,#0b1b5a)}
    /* ---- hierarchy ---- */
    .ss-hier-sec{background:linear-gradient(180deg,#f6f9fc,transparent)}
    .ss-hier{display:flex;flex-direction:column;align-items:center;gap:0}
    .ss-tier{display:flex;gap:13px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:15px;padding:14px 20px;box-shadow:0 8px 24px rgba(11,27,90,.07);max-width:520px;width:100%;justify-content:center;text-align:start}
    .ss-tier .e{font-size:1.8rem;line-height:1}
    .ss-tier b{display:block;color:var(--brand,#0b1b5a);font-size:1.05rem}
    .ss-tier span{display:block;font-size:.82rem;color:var(--text-soft,#5b6b86)}
    .ss-t1{border-color:var(--brand,#0b1b5a)}
    .ss-hconn{width:2px;height:22px;background:var(--line)}
    .ss-tier-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:20px 0 8px;max-width:760px}
    .ss-mini{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 13px;font-size:.85rem;font-weight:600;color:var(--brand,#0b1b5a)}
    .ss-hgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px;width:100%}
    .ss-hcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
    .ss-hcard b{display:block;color:var(--brand,#0b1b5a);font-size:.92rem;margin-bottom:4px}
    .ss-hcard span{display:block;font-size:.82rem;color:var(--text-soft,#5b6b86);line-height:1.6}
    .ss-hcard.gov{border-color:#f0d38a;background:#fffdf5}
    @media(max-width:760px){.ss-hgrid{grid-template-columns:1fr}}
    /* ---- subscription steps ---- */
    .ss-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .ss-step{position:relative;background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px 16px;box-shadow:0 6px 18px rgba(11,27,90,.05)}
    .ss-step .n{width:30px;height:30px;border-radius:50%;background:#12b3ad;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
    .ss-step b{display:block;color:var(--brand,#0b1b5a);margin-bottom:5px}
    .ss-step p{margin:0;font-size:.84rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    @media(max-width:820px){.ss-steps{grid-template-columns:1fr 1fr}}
    @media(max-width:520px){.ss-steps{grid-template-columns:1fr}}
    .ss-access h3{margin:0 0 8px;color:var(--brand,#0b1b5a)}
    .ss-demo-hint{display:block;margin-top:14px;font-size:.82rem;color:var(--text-soft,#5b6b86)}
    .ss-demo-hint code{background:#eef1fb;border-radius:6px;padding:2px 7px;font-size:.82rem;color:var(--brand,#0b1b5a)}
    .ss-portal-entry{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;max-width:720px;margin:26px auto 0;background:linear-gradient(135deg,#0b1b5a,#13246e);color:#fff;border-radius:18px;padding:20px 24px;box-shadow:0 12px 30px rgba(11,27,90,.18)}
    .ss-portal-entry>div{flex:1;min-width:240px}
    .ss-portal-entry b{display:block;font-size:1.05rem;margin-bottom:4px}
    .ss-portal-entry span{display:block;font-size:.85rem;opacity:.85;line-height:1.7}
    .ss-portal-entry .btn{white-space:nowrap;background:#fff;color:var(--brand,#0b1b5a)}
    .ss-portal-hero{padding:48px 0 4px;text-align:center}
    .ss-portal-hero h1{margin:8px 0 12px}
    .ss-gate-links{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:16px}
    .ss-gate-links a{color:var(--brand,#0b1b5a);font-weight:600;text-decoration:none;font-size:.9rem}
    .ss-gate-links a:hover{text-decoration:underline}
  </style>`;
  const script = "";
  return page({
    title: Lraw("Shared Services — your smart executive team | Business Partner", "الخدمات المشتركة — فريقك التنفيذي الذكي | بيزنس بارتنر"),
    desc: Lraw("A full AI executive team that works as your own staff, led by Baher: government, compliance, sales, marketing, IT, procurement and admin — one subscription.", "فريق تنفيذي ذكي متكامل يعمل كموظفيك بقيادة باهر: حكومي، امتثال، مبيعات، تسويق، تقنية، مشتريات وإدارة — باشتراك واحد."),
    active: "/shared-services", path: "/shared-services", body, script,
  });
}

function buildSharedServicesPortal() {
  const shared = (site.aiAgents && site.aiAgents.agents || []).find((a) => a.key === "shared") || {};
  const feats = (LANG === "ar" ? shared.features : shared.featuresEn) || [];
  const team = [
    { e: "👑", en: "Baher — Business Advisor & Team Lead", ar: "باهر — مستشار الأعمال وقائد الفريق" },
    { e: "🧭", en: "Mazen — Operations Manager", ar: "مازن — مدير العمليات" },
    { e: "👥", en: "Nasser — HR", ar: "ناصر — الموارد البشرية" },
    { e: "🛡️", en: "Mishari — Compliance", ar: "مشاري — الامتثال والالتزام" },
    { e: "⚖️", en: "Abdulaziz — Legal", ar: "عبدالعزيز — القانوني" },
    { e: "💼", en: "Badr — Sales & BD", ar: "بدر — مبيعات وتطوير أعمال" },
    { e: "📣", en: "Farah — Marketing", ar: "فرح — تسويق ومحتوى" },
    { e: "🗂️", en: "Malak — Executive Assistant", ar: "ملاك — مساعِدة تنفيذية" },
    { e: "💻", en: "Mohammed — IT", ar: "محمد — تقنية المعلومات" },
    { e: "📈", en: "Ahmed — Strategic Planning", ar: "أحمد — مدير التخطيط الاستراتيجي" },
    { e: "🛒", en: "Abdullah — Procurement", ar: "عبدالله — مشتريات وتوريد" },
  ];
  const busyMsg = Lraw("The team is busy right now — please try again in a moment.", "الفريق مشغول الحين — جرّب بعد لحظات.");
  const errMsg = Lraw("Connection issue — please try again.", "تعذّر الاتصال — حاول مرة ثانية.");

  // Full roster for the dashboard — each specialist is chatted with individually.
  // Baher leads via his chat webhook (chatTrigger protocol); the rest use their
  // own `<slug>-intake` webhooks (client_name/channel/message → { reply }).
  const KHALED_EP = "https://businesspartnerai.app.n8n.cloud/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat";
  const agentData = [
    { slug: "khaled", e: "👑", ar: "باهر", arRole: "مستشار الأعمال", en: "Baher", enRole: "Business Advisor", mode: "chat", ep: KHALED_EP },
    { slug: "mazen", e: "🧭", ar: "مازن", arRole: "مدير العمليات", en: "Mazen", enRole: "Operations Manager", path: "mazen-intake" },
    { slug: "nasser", e: "👥", ar: "ناصر", arRole: "الموارد البشرية", en: "Nasser", enRole: "Human Resources", path: "nasser-intake" },
    { slug: "mishari", e: "🛡️", ar: "مشاري", arRole: "الامتثال والالتزام", en: "Mishari", enRole: "Compliance", path: "mishari-intake" },
    { slug: "abdulrahman", e: "💰", ar: "عبدالرحمن", arRole: "المدير المالي", en: "Abdulrahman", enRole: "Chief Financial Officer", path: "abdulrahman-intake" },
    { slug: "abdulaziz", e: "⚖️", ar: "عبدالعزيز", arRole: "القانوني", en: "Abdulaziz", enRole: "Legal", path: "abdulaziz-intake" },
    { slug: "badr", e: "💼", ar: "بدر", arRole: "مبيعات وتطوير أعمال", en: "Badr", enRole: "Sales & Business Development", path: "badr-intake" },
    { slug: "farah", e: "📣", ar: "فرح", arRole: "تسويق ومحتوى", en: "Farah", enRole: "Marketing & Content", path: "farah-intake" },
    { slug: "malak", e: "🗂️", ar: "ملاك", arRole: "مساعِدة تنفيذية", en: "Malak", enRole: "Executive Assistant", path: "malak-intake" },
    { slug: "mohammed", e: "💻", ar: "محمد", arRole: "تقنية المعلومات", en: "Mohammed", enRole: "IT", path: "mohammed-intake" },
    { slug: "strategy", e: "📈", ar: "أحمد", arRole: "مدير التخطيط الاستراتيجي", en: "Ahmed", enRole: "Strategic Planning Manager", path: "strategy-intake" },
    { slug: "ahmed", e: "🛒", ar: "عبدالله", arRole: "مشتريات وتوريد", en: "Abdullah", enRole: "Procurement & Supply", path: "ahmed-procurement" },
  ];
  const AGENTS_JS = JSON.stringify(
    agentData.map((a) => ({ slug: a.slug, e: a.e, name: LANG === "ar" ? a.ar : a.en, role: LANG === "ar" ? a.arRole : a.enRole, mode: a.mode || "intake", path: a.path || "", ep: a.ep || "" }))
  );

  // Connectors — same set as the specialized team's /connect hub.
  const toolData = [
    { id: "gmail", ic: "📧", name: "Gmail", type: "easy",
      uAr: "يقرأ ويصنّف بريدك، يسوّد ويرسل الردود.", uEn: "Reads, sorts, drafts & sends your email.",
      leadAr: "ربط بضغطة عبر تسجيل دخول قوقل — بدون توكن، مجاناً.", leadEn: "One-click via Google sign-in — no token, free.",
      stepsAr: ["اضغط ربط الآن فتفتح صفحة تسجيل قوقل.", "اختر حساب الشركة ووافق على الصلاحيات.", "يشتغل الموظف داخل بريدك مباشرة."],
      stepsEn: ["Click Connect — Google sign-in opens.", "Pick the company account and approve access.", "The agent works inside your inbox."] },
    { id: "gcal", ic: "📅", name: LANG === "ar" ? "تقويم قوقل" : "Google Calendar", type: "easy",
      uAr: "يجدول المواعيد والدعوات والتذكيرات.", uEn: "Schedules meetings, invites & reminders.",
      leadAr: "ربط بضغطة مع حساب قوقل — مجاناً.", leadEn: "One-click with your Google account — free.",
      stepsAr: ["سجّل دخول قوقل.", "وافق على صلاحية التقويم.", "يقدر يجدول ويعدّل مواعيدك."],
      stepsEn: ["Sign in with Google.", "Approve calendar access.", "It can schedule and edit your meetings."] },
    { id: "notion", ic: "🗒️", name: "Notion", type: "easy",
      uAr: "ينظّم المهام وقواعد البيانات والتوثيق.", uEn: "Organizes tasks, databases & docs.",
      leadAr: "ربط بضغطة عبر Notion — مجاناً.", leadEn: "One-click via Notion — free.",
      stepsAr: ["وافق على Notion.", "اختر الصفحات المشتركة.", "يقرأ ويكتب في نوشن حسب صلاحياتك."],
      stepsEn: ["Approve Notion.", "Pick the shared pages.", "It reads & writes per your permissions."] },
    { id: "slack", ic: "💬", name: "Slack", type: "easy",
      uAr: "يرد وينبّه ويلخّص داخل قنوات فريقك.", uEn: "Replies, alerts & summarizes in your channels.",
      leadAr: "ربط بضغطة عبر Slack — مجاناً.", leadEn: "One-click via Slack — free.",
      stepsAr: ["ثبّت التطبيق في مساحة سلاك.", "اختر القنوات.", "يشتغل داخل سلاك."],
      stepsEn: ["Install the app in your Slack.", "Pick channels.", "It works inside Slack."] },
    { id: "whatsapp", ic: "🟢", name: "WhatsApp", type: "cost",
      uAr: "يرد على عملائك على واتساب ٢٤/٧.", uEn: "Answers your customers on WhatsApp 24/7.",
      leadAr: "يحتاج رقم أعمال + إعداد WhatsApp Cloud API من Meta. فيه تكلفة رسائل تُدفع لـ Meta.", leadEn: "Needs a business number + WhatsApp Cloud API from Meta. Message cost is paid to Meta.",
      payAr: "تكلفة الرسائل تُدفع لـ Meta حسب عدد المحادثات.", payEn: "Message cost is paid to Meta per conversation.",
      stepsAr: ["أنشئ حساب Meta Business + رقم واتساب أعمال.", "فعّل WhatsApp Cloud API واحصل على التوكن.", "الصق التوكن (يُخزّن مشفّراً) أو أرسله لنا.", "اربط فيرد الموظف على عملائك."],
      stepsEn: ["Create Meta Business + a WhatsApp business number.", "Enable WhatsApp Cloud API and get the token.", "Paste the token (stored encrypted) or send it to us.", "Connect — the agent replies to your customers."] },
    { id: "ms", ic: "🟦", name: LANG === "ar" ? "مايكروسوفت (Teams/Outlook)" : "Microsoft (Teams/Outlook)", type: "token",
      uAr: "يدير أوتلوك وتقويم ورسائل تيمس.", uEn: "Runs Outlook, calendar & Teams messages.",
      leadAr: "ربط عبر تسجيل دخول مايكروسوفت. قد يحتاج اشتراك Microsoft 365.", leadEn: "Connect via Microsoft sign-in. May need a Microsoft 365 subscription.",
      payAr: "إن لم يكن لديك 365 يلزم اشتراك من مايكروسوفت.", payEn: "If you don't have 365, a Microsoft subscription is required.",
      stepsAr: ["سجّل دخول مايكروسوفت للعمل.", "وافق على صلاحيات البريد/التقويم/تيمس.", "يشتغل داخل بيئة مايكروسوفت."],
      stepsEn: ["Sign in with Microsoft for work.", "Approve mail/calendar/Teams access.", "It works inside Microsoft."] },
    { id: "drive", ic: "📁", name: "Google Drive", type: "easy",
      uAr: "ينظّم ملفاتك ويلخّص المستندات.", uEn: "Organizes files & summarizes documents.",
      leadAr: "ربط بضغطة مع حساب قوقل — مجاناً.", leadEn: "One-click with your Google account — free.",
      stepsAr: ["سجّل دخول قوقل.", "وافق على صلاحية Drive.", "يقرأ وينظّم ملفاتك."],
      stepsEn: ["Sign in with Google.", "Approve Drive access.", "It reads & organizes your files."] },
    { id: "crm", ic: "📊", name: LANG === "ar" ? "CRM / جداول" : "CRM / Sheets", type: "token",
      uAr: "يحدّث العملاء والصفقات في CRM أو Sheets.", uEn: "Updates customers & deals in CRM or Sheets.",
      leadAr: "نربطه بـ Google Sheets أو CRM لديك (قد يحتاج مفتاح API).", leadEn: "We connect Google Sheets or your CRM (may need an API key).",
      stepsAr: ["أخبرنا بنظامك.", "نجهّز الربط المناسب.", "يحدّث بياناتك تلقائياً."],
      stepsEn: ["Tell us your system.", "We set up the right link.", "It updates your data automatically."] },
    { id: "qoyod", ic: "🧾", name: LANG === "ar" ? "قيود (Qoyod)" : "Qoyod", type: "token",
      uAr: "محاسبة وفوترة: يصدر فواتير ضريبية متوافقة ZATCA ويزامن العملاء والقيود.", uEn: "Accounting & billing: issues ZATCA tax invoices and syncs customers & entries.",
      leadAr: "ربط بمفتاح API خاص من حساب قيود لديك — متوافق مع ZATCA وبياناته داخل السعودية. أي إصدار فاتورة يتم بموافقتك.", leadEn: "Connect with your Qoyod account API key — ZATCA-compliant, data hosted in Saudi Arabia. Any invoice issuance needs your approval.",
      payAr: "يتطلب اشتراك قيود فعّال لدى شركتك (الـ API مجاني على الباقات المدفوعة).", payEn: "Requires an active Qoyod subscription (the API is free on paid plans).",
      stepsAr: ["من حساب قيود: الإعدادات ← API، أنشئ مفتاحاً خاصاً.", "الصق المفتاح هنا (يُخزّن مشفّراً).", "يصير الوكيل يصدر الفواتير ويزامن القيود — بموافقتك قبل أي إصدار."],
      stepsEn: ["In Qoyod: Settings → API, create a private key.", "Paste the key here (stored encrypted).", "The agent issues invoices & syncs entries — with your approval before any issuance."] },
    { id: "salla", ic: "🛒", name: LANG === "ar" ? "سلة (Salla)" : "Salla", type: "token",
      uAr: "متجرك الإلكتروني: الطلبات والعملاء والمنتجات تصل لفريقك مباشرة.", uEn: "Your e-commerce store: orders, customers and products flow straight to your team.",
      leadAr: "نربط متجرك في سلة عبر مفتاح API خاص — الفريق يتابع الطلبات الجديدة، يجهّز ردود عملاء متجرك، ويبني تقارير المبيعات. أي إجراء يغيّر بيانات المتجر بموافقتك.", leadEn: "We connect your Salla store via a private API key — the team tracks new orders, drafts customer replies and builds sales reports. Any change to store data needs your approval.",
      payAr: "يتطلب متجراً فعّالاً على منصة سلة.", payEn: "Requires an active Salla store.",
      stepsAr: ["من لوحة سلة: التطبيقات ← مفاتيح API، أنشئ مفتاحاً خاصاً.", "الصق المفتاح هنا (يُخزّن مشفّراً).", "يبدأ الفريق بمتابعة طلباتك وتقاريرك — وأي تعديل على المتجر بموافقتك."],
      stepsEn: ["In Salla admin: Apps → API keys, create a private key.", "Paste the key here (stored encrypted).", "The team tracks orders & reports — store changes need your approval."] },
  ];
  const TOOLS_JS = JSON.stringify(
    toolData.map((t) => ({ id: t.id, ic: t.ic, name: t.name, type: t.type, u: LANG === "ar" ? t.uAr : t.uEn, lead: LANG === "ar" ? t.leadAr : t.leadEn, pay: (LANG === "ar" ? t.payAr : t.payEn) || "", steps: LANG === "ar" ? t.stepsAr : t.stepsEn }))
  );
  const compPlatforms = (LANG === "ar" ? ["قوى", "مقيم", "التأمينات", "مدد", "النطاقات", "ZATCA"] : ["Qiwa", "Muqeem", "GOSI", "Mudad", "Nitaqat", "ZATCA"])
    .map((p) => `<span class="ss-plat-chip"><span class="dot"></span>${esc(p)}</span>`).join("");

  // Detailed roster — services each agent delivers + how they work. Public info.
  const roster = [
    { e: "👑", ar: "باهر", arRole: "مستشار الأعمال", en: "Baher", enRole: "Business Advisor",
      svcAr: ["استقبال الطلبات", "التوجيه للمتخصص", "متابعة التنفيذ", "تسليم المخرجات"], svcEn: ["Request intake", "Routing", "Follow-through", "Delivery"],
      mAr: "الواجهة الواحدة — يفهم طلبك، يملكه، يوزّعه على المتخصص، يجمع النتيجة ويسلّمها جاهزة.", mEn: "Your single interface — understands the request, owns it, delegates, and delivers a finished result." },
    { e: "🧭", ar: "مازن", arRole: "مدير العمليات", en: "Mazen", enRole: "Operations Manager",
      svcAr: ["تنسيق التنفيذ", "تقسيم المهام", "إجراءات التشغيل (SOP)", "ضبط الجودة"], svcEn: ["Execution coordination", "Task breakdown", "SOPs", "Quality control"],
      mAr: "ينسّق الأعمال متعدّدة الخطوات داخلياً بين المتخصصين حتى التسليم.", mEn: "Coordinates multi-step work internally across specialists through to delivery." },
    { e: "👥", ar: "ناصر", arRole: "الموارد البشرية", en: "Nasser", enRole: "Human Resources",
      svcAr: ["التوظيف", "عقود العمل", "الرواتب", "السياسات والوصف الوظيفي"], svcEn: ["Hiring", "Contracts", "Payroll", "Policies & JDs"],
      mAr: "يدير دورة الموظف كاملة نيابةً عنك.", mEn: "Runs the full employee lifecycle on your behalf." },
    { e: "🛡️", ar: "مشاري", arRole: "الامتثال والالتزام", en: "Mishari", enRole: "Compliance",
      svcAr: ["قوى ومقيم", "التأمينات ومدد", "النطاقات", "ZATCA"], svcEn: ["Qiwa & Muqeem", "GOSI & Mudad", "Nitaqat", "ZATCA"],
      mAr: "مراقبة يومية وتنبيه قبل كل استحقاق — كل إجراء حكومي بموافقتك.", mEn: "Daily monitoring and alerts before every deadline — every government action needs your approval." },
    { e: "💰", ar: "عبدالرحمن", arRole: "المدير المالي", en: "Abdulrahman", enRole: "Chief Financial Officer",
      svcAr: ["الميزانيات والتدفّق النقدي", "الفوترة والتحصيل", "التقارير المالية", "الزكاة والضريبة (VAT)"], svcEn: ["Budgets & cash flow", "Invoicing & collections", "Financial reports", "Zakat & VAT"],
      mAr: "يدير ماليتك ويصدر الفواتير والتقارير عبر قيود — أي دفعة أو إصدار فاتورة بموافقتك.", mEn: "Runs your finances and issues invoices & reports via Qoyod — any payment or issuance needs your approval." },
    { e: "⚖️", ar: "عبدالعزيز", arRole: "القانوني", en: "Abdulaziz", enRole: "Legal",
      svcAr: ["العقود", "التأسيس", "التراخيص", "الهيكلة القانونية"], svcEn: ["Contracts", "Incorporation", "Licensing", "Legal structuring"],
      mAr: "يصيغ ويراجع المستندات القانونية — والتوقيع بموافقتك.", mEn: "Drafts and reviews legal documents — signing needs your approval." },
    { e: "💼", ar: "بدر", arRole: "مبيعات وتطوير أعمال", en: "Badr", enRole: "Sales & Business Development",
      svcAr: ["عروض الأسعار", "الباقات", "العروض التجارية", "نطاق الخدمة"], svcEn: ["Quotes", "Bundles", "Commercial proposals", "Scope of work"],
      mAr: "يجهّز العروض والمقترحات التجارية لعملائك.", mEn: "Prepares quotes and commercial proposals for your clients." },
    { e: "📣", ar: "فرح", arRole: "تسويق ومحتوى", en: "Farah", enRole: "Marketing & Content",
      svcAr: ["المحتوى", "الحملات", "السوشال", "SEO والهوية"], svcEn: ["Content", "Campaigns", "Social", "SEO & brand"],
      mAr: "تخطّط وتنتج المحتوى والحملات التسويقية.", mEn: "Plans and produces content and marketing campaigns." },
    { e: "🗂️", ar: "ملاك", arRole: "مساعِدة تنفيذية", en: "Malak", enRole: "Executive Assistant",
      svcAr: ["صياغة الإيميلات", "التلخيص", "تنظيم المهام", "التذكيرات"], svcEn: ["Email drafting", "Summaries", "Task organizing", "Reminders"],
      mAr: "تدير مهامك اليومية وتنظّم أعمالك.", mEn: "Runs your day-to-day tasks and keeps you organized." },
    { e: "💻", ar: "محمد", arRole: "تقنية المعلومات", en: "Mohammed", enRole: "IT",
      svcAr: ["المواقع والتطبيقات", "الأتمتة", "ربط الـAPIs", "الدعم التقني"], svcEn: ["Sites & apps", "Automation", "API integration", "Tech support"],
      mAr: "يبني ويشغّل حلولك التقنية ويربط أنظمتك.", mEn: "Builds and runs your tech and connects your systems." },
    { e: "📈", ar: "أحمد", arRole: "مدير التخطيط الاستراتيجي", en: "Ahmed", enRole: "Strategic Planning Manager",
      svcAr: ["الرؤية والخطط السنوية", "الأهداف وOKRs", "خرائط الطريق", "متابعة التنفيذ"], svcEn: ["Vision & annual plans", "OKRs & KPIs", "Roadmaps", "Execution tracking"],
      mAr: "يحوّل طموحك لخطة مكتوبة بأهداف ومؤشرات وخارطة طريق ربعية — ويتابع التنفيذ.", mEn: "Turns your ambition into a written plan with OKRs, KPIs and a quarterly roadmap — and tracks execution." },
    { e: "🛒", ar: "عبدالله", arRole: "مشتريات وتوريد", en: "Abdullah", enRole: "Procurement & Supply",
      svcAr: ["إيجاد الموردين", "مقارنة العروض", "طلبات عروض الأسعار (RFQ)", "التفاوض التمهيدي"], svcEn: ["Sourcing suppliers", "Comparing offers", "RFQs", "Initial negotiation"],
      mAr: "يجد الموردين ويجهّز طلبات الشراء — والإرسال الخارجي بموافقتك.", mEn: "Finds suppliers and prepares purchase requests — external sending needs your approval." },
  ];

  const body = `
  <section class="ss-portal-hero">
    <div class="wrap">
      <span class="eyebrow">${L("Shared Services", "الخدمات المشتركة")}</span>
      <h1>${L("Your executive team portal", "بوابة فريقك التنفيذي")}</h1>
      <p class="lead">${L("Sign in to your Shared Services portal — talk to each specialist, connect your tools, and run compliance.", "سجّل دخولك لبوابة الخدمات المشتركة — تعامل مع كل متخصص، اربط أدواتك، وأدر الامتثال.")}</p>
    </div>
  </section>
  <section class="ss-sec" id="ss-gate">
    <div class="wrap">
      <div class="ss-access">
        <h2>${L("Sign in to the service", "دخول الخدمة")}</h2>
        <p>${L("Enter the access code emailed to you after payment. Not subscribed yet? Register via the client portal.", "أدخل رمز الدخول اللي وصلك على بريدك بعد الدفع. لست مشتركاً؟ سجّل عبر بوابة العميل.")}</p>
        <form class="ss-access-form" id="ss-unlock">
          <input id="unl-code" type="text" autocomplete="off" placeholder="${Lraw('Access code', 'رمز الدخول')}" aria-label="${Lraw('Access code', 'رمز الدخول')}">
          <button class="btn btn-primary" type="submit">${L("Sign in", "دخول")}</button>
        </form>
        <div class="ss-note-box" id="unl-result" hidden></div>
        <div class="ss-gate-links">
          <a href="${u('/shared-services')}">${L("← Back to service info", "← عن الخدمة")}</a>
          <a href="${u('/shared-services')}#ss-subscribe">${L("Subscribe now", "اشترك الآن")}</a>
        </div>
        <span class="ss-demo-hint">${L("Preview with demo code: ", "معاينة برمز التجربة: ")}<code>demo123</code></span>
      </div>
    </div>
  </section>
  <section class="ss-sec" id="ss-dash" hidden>
    <div class="wrap">
      <div class="ss-dash-head">
        <div>
          <h2>${L("Your Shared Services dashboard", "لوحة الخدمات المشتركة")}</h2>
          <p>${L("Your full executive team in one place — talk to each specialist individually, connect your tools, and run compliance. No passwords or OTP; anything binding waits for your approval.", "فريقك التنفيذي كامل في مكان واحد — تعامل مع كل متخصص على حدة، اربط أدواتك، وأدر الامتثال. بدون كلمات مرور أو رموز تحقق؛ أي إجراء ملزم ينتظر موافقتك.")}</p>
        </div>
        <button class="ss-logout" id="ss-know" type="button">🧠 ${L("Teach the team your company", "عرّف الفريق على شركتك")}</button>
        <button class="ss-logout" id="ss-install" type="button" hidden>📱 ${L("Install as app", "ثبّت كتطبيق")}</button>
        <button class="ss-logout" id="ss-logout" type="button">${L("Sign out", "خروج")}</button>
      </div>

      <div class="ss-tabs" role="tablist">
        <button class="ss-tab active" data-tab="team" type="button">👥 ${L("The team", "الفريق")}</button>
        <button class="ss-tab" data-tab="svc" type="button">🧰 ${L("Services", "الخدمات")}</button>
        <button class="ss-tab" data-tab="stats" type="button">📊 ${L("Reports", "التقارير")}</button>
        <button class="ss-tab" data-tab="tools" type="button">🔌 ${L("Connectors", "الموصلات")}</button>
        <button class="ss-tab" data-tab="comp" type="button">🛡️ ${L("Compliance", "الامتثال")}</button>
      </div>

      <div class="ss-pane" id="pane-team">
        <p class="ss-pane-lead">${L("Pick a specialist and deal with them directly — each one is an expert in their field. ✏️ You can rename any of them to whatever you like — the new name sticks, and the agent itself adopts it.", "اختر متخصصاً وتعامل معه مباشرة — كل واحد خبير في مجاله. ✏️ وتقدر تغيّر اسم أي موظف لأي اسم يعجبك — الاسم الجديد يثبت لك، والموظف نفسه يتبنّاه ويتعامل به.")}</p>
        <div class="ss-agents" id="ss-agents"></div>
        <div class="ss-panel">
          <div class="ss-panel-head"><span class="e" id="ph-e">👑</span><div><b id="ph-n"></b><span id="ph-r"></span></div><button id="ss-rename" type="button" title="${Lraw("Rename this agent", "غيّر اسم الموظف")}" style="background:none;border:1px solid var(--line);border-radius:9px;cursor:pointer;font:inherit;font-size:.82rem;padding:5px 10px;margin-inline-start:10px;color:var(--brand,#0b1b5a)">✏️ ${L("Rename", "غيّر الاسم")}</button><span class="ss-live">● ${L("Live", "مباشر")}</span></div>
          <div class="ss-log" id="ss-log"></div>
          <form class="ss-form" id="ss-form">
            <input id="ss-input" type="text" autocomplete="off" placeholder="${Lraw("Type your request here…", "اكتب طلبك هنا…")}" aria-label="${Lraw("Type your request", "اكتب طلبك")}">
            <button class="btn btn-primary" type="submit">${L("Send", "إرسال")}</button>
          </form>
        </div>
      </div>

      <div class="ss-pane" id="pane-svc" hidden>
        <p class="ss-pane-lead">${L("All Business Partner services in one place — open any service directly, or just tell Baher in the Team tab and he executes and escalates for your approval.", "كل خدمات بزنس بارتنر في مكان واحد — افتح أي خدمة مباشرة، أو قل لباهر في تبويب الفريق «اطلب لي…» وهو ينفّذ ويصعّد لموافقتك.")}</p>
        <div class="ss-svc">
          <a href="${u("/services")}"><span class="e">🗂️</span><b>${L(`All services (${services.length})`, `كل الخدمات (${services.length})`)}</b><span>${L("Government & business services — request any with a custom quote.", "خدمات حكومية وتجارية — اطلب أي خدمة بعرض حسب حالتك.")}</span></a>
          <a href="${u("/packages")}"><span class="e">📦</span><b>${L("Packages", "الباقات")}</b><span>${L("Bundled services at a clear starting price.", "باقات جاهزة بسعر ابتدائي واضح.")}</span></a>
          <a href="${u("/calculator")}"><span class="e">🧮</span><b>${L("Cost calculator", "حاسبة التكلفة")}</b><span>${L("Build your basket and see one-time & monthly fees.", "كوّن سلّتك واعرف الأتعاب لمرة واحدة والشهرية.")}</span></a>
          <a href="${u("/tools-and-calculators")}"><span class="e">🧰</span><b>${L("Free calculators", "الحاسبات المجانية")}</b><span>${L("Nitaqat, government cost, end of service, GOSI and more.", "النطاقات، التكاليف الحكومية، نهاية الخدمة، GOSI والمزيد.")}</span></a>
          <a href="${u("/compliance-agent")}"><span class="e">🛡️</span><b>${L("Compliance subscription", "اشتراك الامتثال")}</b><span>${L("Daily monitoring & alerts before every deadline.", "مراقبة يومية وتنبيهات قبل كل استحقاق.")}</span></a>
          <a href="${u("/consultation")}"><span class="e">📅</span><b>${L("Book a consultation", "احجز استشارة")}</b><span>${L("A specialist calls you about your case.", "متخصص يتواصل معك بخصوص حالتك.")}</span></a>
          <a href="${u("/hr")}"><span class="e">👔</span><b>${L("Recruitment (HR)", "التوظيف")}</b><span>${L("Employer platform & pre-screened candidate pool.", "منصة أصحاب الأعمال وقاعدة مرشّحين مفحوصة.")}</span></a>
          <a href="${u("/workspaces")}"><span class="e">🏢</span><b>${L("Office spaces", "مساحات العمل")}</b><span>${L("Offices and registered addresses.", "مكاتب ومقرات وعناوين وطنية.")}</span></a>
          <a href="${u("/task-force")}"><span class="e">⚡</span><b>${L("Task Force", "تاسك فورس")}</b><span>${L("Executive service for hard multi-party missions.", "خدمة تنفيذية للمهمات الصعبة متعددة الجهات.")}</span></a>
          <a href="${u("/deals")}"><span class="e">🤝</span><b>${L("Deals & matchmaking", "الصفقات والمطابقة")}</b><span>${L("Offer a deal or find a partner — matched automatically.", "اعرض صفقة أو ابحث عن شريك — مطابقة تلقائية.")}</span></a>
          <a href="${u("/tourism")}"><span class="e">🧳</span><b>${L("Tourism & events", "السياحة والفعاليات")}</b><span>${L("Business tourism, trips and event logistics.", "سياحة أعمال ورحلات وتنظيم فعاليات.")}</span></a>
          <a href="${u("/connect")}"><span class="e">🧑‍💼</span><b>${L("Individual smart employee", "الموظف الذكي الفردي")}</b><span>${L("Hire one specialist agent on its own.", "وظّف متخصصاً ذكياً واحداً لحاله.")}</span></a>
          <a href="${u("/saudi-arabia")}"><span class="e">🇸🇦</span><b>${L("Invest in Saudi", "الاستثمار في السعودية")}</b><span>${L("Investor data, guides and sector insights.", "بيانات وأدلة المستثمر ورؤى القطاعات.")}</span></a>
          <a href="${u("/account")}"><span class="e">🧾</span><b>${L("My orders & account", "طلباتي وحسابي")}</b><span>${L("Track your orders, documents and payments.", "تابع طلباتك ومستنداتك ومدفوعاتك.")}</span></a>
        </div>
        <p class="ss-secure">💡 ${L("Tip: anything here can also be requested through Baher — he prepares it and anything binding waits for your approval.", "تلميح: أي خدمة هنا تقدر تطلبها عبر باهر مباشرة — يجهّزها لك وأي إجراء ملزم ينتظر موافقتك.")}</p>
      </div>

      <div class="ss-pane" id="pane-stats" hidden>
        <p class="ss-pane-lead">${L("Your team's performance in numbers — live from your documented tasks and conversations, in your own isolated workspace.", "أداء فريقك بالأرقام — مباشرة من مهامك ومحادثاتك الموثقة في مساحتك المعزولة.")}</p>
        <div class="ss-kpis" id="ss-kpis"></div>
        <div class="ss-kgrid">
          <div class="ss-kcard"><b>👥 ${L("Work distribution across the team", "توزيع العمل على الفريق")}</b><div id="ss-kagents" class="ss-krows"></div></div>
          <div class="ss-kcard"><b>🕓 ${L("Latest interactions", "آخر التفاعلات")}</b><div id="ss-krecent" class="ss-krows"></div></div>
        </div>
        <p class="ss-secure">📌 ${L("Every number here comes from your documented Notion workspace — ask Baher for a detailed report anytime.", "كل رقم هنا من مساحتك الموثقة — اطلب من باهر تقريراً تفصيلياً في أي وقت.")}</p>
        <style>
          .ss-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
          .ss-ktile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;text-align:center}
          .ss-ktile .n{font-size:1.7rem;font-weight:800;color:var(--brand,#0b1b5a);line-height:1.2}
          .ss-ktile .l{font-size:.8rem;color:var(--text-soft,#5b6b86);margin-top:4px}
          .ss-kgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .ss-kcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
          .ss-kcard>b{display:block;color:var(--brand,#0b1b5a);font-size:.92rem;margin-bottom:10px}
          .ss-krows>div{display:flex;justify-content:space-between;gap:10px;font-size:.84rem;color:#3d4a63;padding:7px 0;border-bottom:1px dashed var(--line)}
          .ss-krows>div:last-child{border-bottom:0}
          .ss-krows .c{font-weight:700;color:var(--brand,#0b1b5a);white-space:nowrap}
          .ss-kempty{color:var(--text-soft,#5b6b86);font-size:.85rem;padding:8px 0}
          @media(max-width:820px){.ss-kpis{grid-template-columns:1fr 1fr}.ss-kgrid{grid-template-columns:1fr}}
        </style>
      </div>

      <div class="ss-pane" id="pane-tools" hidden>
        <p class="ss-pane-lead">${L("Connect the team to your tools with one click — just like the specialized team. If a tool needs a token or has a cost, we walk you through it step by step.", "اربط الفريق بأدواتك بضغطة — تماماً كالفريق المتخصص. لو الأداة تحتاج توكن أو فيها تكلفة نمشي معك خطوة بخطوة.")}</p>
        <div class="ss-cgrid" id="ss-cgrid"></div>
        <p class="ss-secure">🔒 ${L("Every connection is private, isolated, and via secure sign-in (OAuth) or your own key. We never ask for passwords. Any important external action waits for your approval.", "كل ربط خاص بشركتك ومعزول، عبر تسجيل دخول آمن (OAuth) أو مفتاحك الخاص. لا نطلب كلمات مرور أبداً. أي إجراء خارجي مهم ينتظر موافقتك.")}</p>
      </div>

      <div class="ss-pane" id="pane-comp" hidden>
        <div class="ss-compdash">
          <iframe id="ss-compdash-frame" data-src="/ar/compliance-dashboard" loading="lazy" title="${Lraw("Compliance dashboard", "لوحة الامتثال")}"></iframe>
        </div>
        <style>
          .ss-compdash{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(11,27,90,.07)}
          #ss-compdash-frame{display:block;width:100%;height:calc(100vh - 180px);min-height:760px;border:0;background:#fff}
          @media(max-width:640px){#ss-compdash-frame{min-height:640px}}
        </style>
      </div>
    </div>
  </section>

  <div class="ss-ov" id="ss-ov">
    <div class="ss-modal">
      <div class="ss-m-head"><span class="ss-cc-ic" id="ssm-ic">🔌</span><h3 id="ssm-t">${L("Connect", "ربط")}</h3><button class="ss-m-x" id="ssm-x" type="button">✕</button></div>
      <div class="ss-m-body"><p class="ss-m-lead" id="ssm-l"></p><div id="ssm-s"></div></div>
      <div class="ss-m-foot"><button class="ss-cbtn" id="ssm-do" type="button">🔗 ${L("Connect now", "ربط الآن")}</button><button class="ss-hbtn" id="ssm-help" type="button">🛠️ ${L("Set it up for me", "نركّبها لك")}</button></div>
    </div>
  </div>
  <style>
    .ss-hero{padding:52px 0 8px;text-align:center}
    .ss-hero h1{margin:8px 0 12px}
    .ss-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:20px}
    .ss-sec{padding:36px 0}
    .ss-team{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:8px 0 20px}
    .ss-chip{display:inline-flex;align-items:center;gap:8px;background:#f4f8fb;border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-weight:600;font-size:.92rem}
    .ss-feats{max-width:760px;margin:0 auto;display:grid;gap:10px;list-style:none;padding:0}
    .ss-feats li{position:relative;padding-inline-start:26px;line-height:1.7}
    .ss-feats li::before{content:'✓';position:absolute;inset-inline-start:0;color:#12b3ad;font-weight:800}
    .ss-log{display:flex;flex-direction:column;gap:10px;min-height:180px;max-height:440px;overflow-y:auto;padding:8px}
    .ss-msg{max-width:88%;padding:11px 14px;border-radius:14px;line-height:1.75;white-space:pre-wrap}
    .ss-msg.bot{align-self:flex-start;background:#f1f5f8;border:1px solid var(--line)}
    .ss-msg.me{align-self:flex-end;background:#0e5a55;color:#eafffb}
    .ss-msg.empty{align-self:center;background:none;border:0;color:var(--text-soft,#5b6b86);font-size:.9rem}
    .ss-form{display:flex;gap:8px;margin-top:12px}
    .ss-form input{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font:inherit}
    /* ---- dashboard ---- */
    .ss-dash-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .ss-dash-head>div{flex:1;min-width:260px}
    .ss-dash-head h2{margin:0 0 6px}
    .ss-dash-head p{color:var(--text-soft,#5b6b86);margin:0;line-height:1.8}
    .ss-logout{background:#f1f4fb;border:1px solid var(--line);border-radius:10px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;color:var(--brand,#0b1b5a)}
    .ss-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:20px}
    .ss-tab{background:none;border:0;border-bottom:2.5px solid transparent;padding:11px 14px;font:inherit;font-weight:700;color:var(--text-soft,#5b6b86);cursor:pointer}
    .ss-tab.active{color:var(--brand,#0b1b5a);border-bottom-color:var(--brand,#0b1b5a)}
    .ss-pane-lead{color:var(--text-soft,#5b6b86);margin:0 0 16px;line-height:1.8}
    .ss-agents{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:18px}
    .ss-ag{display:flex;gap:10px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:13px;padding:11px 13px;cursor:pointer;transition:.12s;text-align:start}
    .ss-ag:hover{border-color:var(--brand,#0b1b5a);transform:translateY(-1px)}
    .ss-ag.sel{border-color:var(--brand,#0b1b5a);background:#eef1fb}
    .ss-ag .e{font-size:1.5rem;line-height:1}
    .ss-ag b{display:block;color:var(--brand,#0b1b5a);font-size:.95rem}
    .ss-ag span{display:block;font-size:.75rem;color:var(--text-soft,#5b6b86)}
    .ss-panel{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(11,27,90,.06)}
    .ss-panel-head{display:flex;gap:11px;align-items:center;padding:13px 16px;background:#f8fafc;border-bottom:1px solid var(--line)}
    .ss-panel-head .e{font-size:1.7rem;line-height:1}
    .ss-panel-head b{color:var(--brand,#0b1b5a)}
    .ss-panel-head>div span{display:block;font-size:.78rem;color:var(--text-soft,#5b6b86)}
    .ss-live{margin-inline-start:auto;font-size:.74rem;font-weight:700;color:#12b3ad;white-space:nowrap}
    .ss-panel .ss-log{min-height:300px;max-height:480px}
    .ss-panel .ss-form{margin:0;padding:12px;border-top:1px solid var(--line);background:#fff}
    /* ---- connectors ---- */
    .ss-cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .ss-cc{background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px;display:flex;flex-direction:column;box-shadow:0 6px 18px rgba(11,27,90,.05)}
    .ss-cc-top{display:flex;gap:11px;align-items:flex-start;margin-bottom:8px}
    .ss-cc-ic{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:#f1f4fb;flex-shrink:0}
    .ss-cc-ic svg{width:25px;height:25px;display:block}
    .ss-cc-ic .brand{width:27px;height:27px;object-fit:contain}
    .ss-cc-t{flex:1}
    .ss-cc-t h3{font-size:1.02rem;color:var(--brand,#0b1b5a);margin:0}
    .ss-cc-t .u{font-size:.82rem;color:var(--text-soft,#5b6b86);line-height:1.6}
    .ss-cc-state{font-size:.7rem;font-weight:700;padding:.18rem .55rem;border-radius:999px;background:#eef1f8;color:#64748b;white-space:nowrap;align-self:flex-start}
    .ss-cc-state.on{background:#dcfce7;color:#065f46}
    .ss-cc-tag{font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;align-self:flex-start;margin-bottom:11px}
    .ss-cc-tag.easy{background:#e0f2fe;color:#075985}
    .ss-cc-tag.token{background:#fef3c7;color:#b45309}
    .ss-cc-tag.cost{background:#fee2e2;color:#991b1b}
    .ss-cc-actions{display:flex;gap:8px;margin-top:auto}
    .ss-cc-actions button{flex:1;border-radius:10px;padding:9px;font:inherit;font-size:.83rem;font-weight:700;border:0;cursor:pointer}
    .ss-cbtn{background:var(--brand,#0b1b5a);color:#fff}
    .ss-hbtn{background:#fff;color:var(--brand,#0b1b5a);border:1px solid var(--line)}
    .ss-secure{margin-top:18px;font-size:.86rem;color:var(--text-soft,#5b6b86);line-height:1.8;text-align:center}
    /* connector modal */
    .ss-ov{position:fixed;inset:0;background:rgba(8,12,30,.55);display:none;align-items:center;justify-content:center;padding:16px;z-index:1300}
    .ss-ov.on{display:flex}
    .ss-modal{background:#fff;border-radius:18px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;text-align:start}
    .ss-m-head{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;gap:11px;align-items:center}
    .ss-m-head .ss-cc-ic{width:40px;height:40px}
    .ss-m-head h3{flex:1;margin:0;color:var(--brand,#0b1b5a);font-size:1.12rem}
    .ss-m-x{background:#f1f4fb;border:0;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:1rem}
    .ss-m-body{padding:16px 18px}
    .ss-m-lead{font-size:.88rem;color:var(--text-soft,#5b6b86);margin:0 0 14px;line-height:1.7}
    .ss-stp{display:flex;gap:11px;margin-bottom:11px}
    .ss-stp .n{width:25px;height:25px;border-radius:50%;background:var(--brand,#0b1b5a);color:#fff;font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .ss-stp .tx{font-size:.86rem;line-height:1.6}
    .ss-pay{background:#fee2e2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:9px 12px;font-size:.82rem;margin-bottom:13px}
    .ss-m-foot{padding:14px 18px 18px;display:flex;gap:9px}
    .ss-m-foot button{flex:1;border-radius:11px;padding:11px;font:inherit;font-weight:700;border:0;cursor:pointer}
    /* ---- compliance ---- */
    .ss-comp{display:grid;grid-template-columns:1.5fr 1fr;gap:16px;align-items:start}
    .ss-comp-main{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 10px 30px rgba(11,27,90,.06)}
    .ss-comp-lead{display:flex;gap:13px;align-items:flex-start;flex-wrap:wrap}
    .ss-comp-lead .e{font-size:2rem;line-height:1}
    .ss-comp-lead>div{flex:1;min-width:200px}
    .ss-comp-lead b{color:var(--brand,#0b1b5a);font-size:1.05rem}
    .ss-comp-lead p{color:var(--text-soft,#5b6b86);margin:5px 0 0;line-height:1.8;font-size:.9rem}
    .ss-comp-lead .btn{white-space:nowrap}
    .ss-plat-head{margin:18px 0 9px;font-weight:700;color:var(--brand,#0b1b5a);font-size:.92rem}
    .ss-plat{display:flex;flex-wrap:wrap;gap:8px}
    .ss-plat-chip{display:inline-flex;align-items:center;gap:7px;background:#f4f8fb;border:1px solid var(--line);border-radius:999px;padding:6px 13px;font-weight:600;font-size:.85rem}
    .ss-plat-chip .dot{width:8px;height:8px;border-radius:50%;background:#12b3ad;box-shadow:0 0 0 3px rgba(18,179,173,.18)}
    .ss-comp-links{display:flex;flex-direction:column;gap:11px}
    .ss-comp-links a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;transition:.12s}
    .ss-comp-links a:hover{border-color:var(--brand,#0b1b5a);transform:translateY(-1px)}
    .ss-comp-links b{display:block;color:var(--brand,#0b1b5a);font-size:.95rem}
    .ss-comp-links span{display:block;font-size:.8rem;color:var(--text-soft,#5b6b86);margin-top:3px;line-height:1.6}
    .ss-svc{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
    .ss-svc a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;text-decoration:none;transition:.12s;box-shadow:0 4px 14px rgba(11,27,90,.04)}
    .ss-svc a:hover{border-color:var(--brand,#0b1b5a);transform:translateY(-2px);box-shadow:0 10px 24px rgba(11,27,90,.08)}
    .ss-svc a span{display:block;font-size:.8rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    .ss-svc a .e{font-size:1.5rem;color:inherit;line-height:1;margin-bottom:9px}
    .ss-svc b{display:block;color:var(--brand,#0b1b5a);font-size:.95rem;margin-bottom:4px}
    @media(max-width:820px){.ss-comp{grid-template-columns:1fr}}
    .ss-access{max-width:560px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px 24px;text-align:center;box-shadow:0 10px 30px rgba(11,27,90,.06)}
    .ss-access h2{margin:0 0 8px}
    .ss-access>p{color:var(--text-soft,#5b6b86);margin:0 auto 18px;max-width:460px;line-height:1.8}
    .ss-access-form{display:flex;gap:8px;max-width:440px;margin:0 auto;flex-wrap:wrap;justify-content:center}
    .ss-access-form input{flex:1;min-width:200px;border:1px solid var(--line);border-radius:12px;padding:13px 15px;font:inherit;text-align:center;letter-spacing:1px}
    .ss-portal-link{display:inline-block;margin-top:16px;color:var(--brand,#0b1b5a);font-weight:600;text-decoration:none;font-size:.92rem}
    .ss-portal-link:hover{text-decoration:underline}
    .ss-note-box{margin:14px auto 0;max-width:440px;border-radius:12px;padding:12px 14px;font-size:.9rem;line-height:1.7}
    .ss-note-box.ok{background:#f2fbf5;border:1px solid #bfe8cd;color:#14663a}
    .ss-note-box.err{background:#fdf1f1;border:1px solid #f2c4c4;color:#a02020}
    /* ---- how it works ---- */
    .ss-how{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .ss-how-s{background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px 16px;box-shadow:0 6px 18px rgba(11,27,90,.05)}
    .ss-how-s .n{width:32px;height:32px;border-radius:50%;background:var(--brand,#0b1b5a);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:11px}
    .ss-how-s b{display:block;color:var(--brand,#0b1b5a);margin-bottom:5px}
    .ss-how-s p{margin:0;font-size:.85rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    @media(max-width:820px){.ss-how{grid-template-columns:1fr 1fr}}
    @media(max-width:520px){.ss-how{grid-template-columns:1fr}}
    /* ---- detailed roster ---- */
    .ss-roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:20px}
    .ss-rc{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 17px;box-shadow:0 6px 18px rgba(11,27,90,.05);display:flex;flex-direction:column}
    .ss-rc-h{display:flex;gap:12px;align-items:center;margin-bottom:12px}
    .ss-rc-h .e{font-size:1.9rem;line-height:1}
    .ss-rc-h b{display:block;color:var(--brand,#0b1b5a);font-size:1.02rem}
    .ss-rc-h span{display:block;font-size:.8rem;color:var(--text-soft,#5b6b86)}
    .ss-rc-svc{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}
    .ss-rc-svc span{background:#eef1fb;color:var(--brand,#0b1b5a);border-radius:999px;padding:4px 10px;font-size:.76rem;font-weight:600}
    .ss-rc-m{margin:auto 0 0;font-size:.84rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    .ss-rc-m b{color:var(--brand,#0b1b5a)}
    /* ---- hierarchy ---- */
    .ss-hier-sec{background:linear-gradient(180deg,#f6f9fc,transparent)}
    .ss-hier{display:flex;flex-direction:column;align-items:center;gap:0}
    .ss-tier{display:flex;gap:13px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:15px;padding:14px 20px;box-shadow:0 8px 24px rgba(11,27,90,.07);max-width:520px;width:100%;justify-content:center;text-align:start}
    .ss-tier .e{font-size:1.8rem;line-height:1}
    .ss-tier b{display:block;color:var(--brand,#0b1b5a);font-size:1.05rem}
    .ss-tier span{display:block;font-size:.82rem;color:var(--text-soft,#5b6b86)}
    .ss-t1{border-color:var(--brand,#0b1b5a)}
    .ss-hconn{width:2px;height:22px;background:var(--line)}
    .ss-tier-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:20px 0 8px;max-width:760px}
    .ss-mini{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 13px;font-size:.85rem;font-weight:600;color:var(--brand,#0b1b5a)}
    .ss-hgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px;width:100%}
    .ss-hcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
    .ss-hcard b{display:block;color:var(--brand,#0b1b5a);font-size:.92rem;margin-bottom:4px}
    .ss-hcard span{display:block;font-size:.82rem;color:var(--text-soft,#5b6b86);line-height:1.6}
    .ss-hcard.gov{border-color:#f0d38a;background:#fffdf5}
    @media(max-width:760px){.ss-hgrid{grid-template-columns:1fr}}
    /* ---- subscription steps ---- */
    .ss-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .ss-step{position:relative;background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px 16px;box-shadow:0 6px 18px rgba(11,27,90,.05)}
    .ss-step .n{width:30px;height:30px;border-radius:50%;background:#12b3ad;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
    .ss-step b{display:block;color:var(--brand,#0b1b5a);margin-bottom:5px}
    .ss-step p{margin:0;font-size:.84rem;color:var(--text-soft,#5b6b86);line-height:1.7}
    @media(max-width:820px){.ss-steps{grid-template-columns:1fr 1fr}}
    @media(max-width:520px){.ss-steps{grid-template-columns:1fr}}
    .ss-access h3{margin:0 0 8px;color:var(--brand,#0b1b5a)}
    .ss-demo-hint{display:block;margin-top:14px;font-size:.82rem;color:var(--text-soft,#5b6b86)}
    .ss-demo-hint code{background:#eef1fb;border-radius:6px;padding:2px 7px;font-size:.82rem;color:var(--brand,#0b1b5a)}
    .ss-portal-entry{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;max-width:720px;margin:26px auto 0;background:linear-gradient(135deg,#0b1b5a,#13246e);color:#fff;border-radius:18px;padding:20px 24px;box-shadow:0 12px 30px rgba(11,27,90,.18)}
    .ss-portal-entry>div{flex:1;min-width:240px}
    .ss-portal-entry b{display:block;font-size:1.05rem;margin-bottom:4px}
    .ss-portal-entry span{display:block;font-size:.85rem;opacity:.85;line-height:1.7}
    .ss-portal-entry .btn{white-space:nowrap;background:#fff;color:var(--brand,#0b1b5a)}
    .ss-portal-hero{padding:48px 0 4px;text-align:center}
    .ss-portal-hero h1{margin:8px 0 12px}
    .ss-gate-links{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:16px}
    .ss-gate-links a{color:var(--brand,#0b1b5a);font-weight:600;text-decoration:none;font-size:.9rem}
    .ss-gate-links a:hover{text-decoration:underline}
  </style>`;
  const script = `<script>(function(){
    var N8N='https://businesspartnerai.app.n8n.cloud/webhook';
    var AGENTS=${AGENTS_JS};
    var TOOLS=${TOOLS_JS};
    var BUSY=${JSON.stringify(busyMsg)}, ERRT=${JSON.stringify(errMsg)};
    var CHAT_PREFIX='bp_ss_chat_';
    var gate=document.getElementById('ss-gate'),dash=document.getElementById('ss-dash');
    function note(el,t,cls){el.hidden=false;el.textContent=t;el.className='ss-note-box '+cls;}

    // ---------- PWA: installable portal ----------
    (function(){
      var l=document.createElement('link');l.rel='manifest';l.href='/manifest.webmanifest';document.head.appendChild(l);
      var m=document.createElement('meta');m.name='theme-color';m.content='#0b1b5a';document.head.appendChild(m);
      if('serviceWorker' in navigator){try{navigator.serviceWorker.register('/sw.js').catch(function(){});}catch(e){}}
      var deferred=null,ib=document.getElementById('ss-install');
      window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;if(ib)ib.hidden=false;});
      if(ib)ib.onclick=function(){if(!deferred)return;deferred.prompt();deferred.userChoice.then(function(){deferred=null;ib.hidden=true;});};
    })();

    // ---------- access gate: real server-side login (ss-login) ----------
    var SKEY='bp_ss_client_v1';
    function getClient(){ try{ return JSON.parse(localStorage.getItem(SKEY)||'null'); }catch(e){ return null; } }
    function setClient(c){ try{ localStorage.setItem(SKEY,JSON.stringify(c)); }catch(e){} }
    function getNames(){ var c=getClient(); return (c&&c.names&&typeof c.names==='object')?c.names:{}; }
    function saveNames(nm){ var c=getClient(); if(!c)return; c.names=nm; setClient(c); }
    function dispName(a){ var n=getNames()[a.slug]; return (typeof n==='string'&&n.trim())?n.trim():a.name; }
    var inited=false;
    function openService(){ if(gate)gate.hidden=true; if(dash){dash.hidden=false; if(!inited){initDash();inited=true;} greet(); dash.scrollIntoView({behavior:'smooth',block:'start'});} }
    function greet(){ var c=getClient(); var h=document.querySelector('.ss-dash-head h2'); if(c&&h) h.textContent=${JSON.stringify(Lraw("Dashboard — ", "لوحة "))}+c.name; }
    var unl=document.getElementById('ss-unlock');
    if(unl) unl.addEventListener('submit',function(e){e.preventDefault();
      var code=(document.getElementById('unl-code').value||'').trim();
      var box=document.getElementById('unl-result');
      if(!code){note(box,${JSON.stringify(Lraw("Enter your access code.", "أدخل رمز الوصول."))},'err');return;}
      if(code.toLowerCase()==='demo123'){ setClient({code:'demo123',name:${JSON.stringify(Lraw("Demo preview", "معاينة تجريبية"))},demo:true}); note(box,${JSON.stringify(Lraw("Welcome — opening the preview…", "أهلاً بك — نفتح المعاينة…"))},'ok'); openService(); return; }
      note(box,${JSON.stringify(Lraw("Checking your code…", "نتحقق من رمزك…"))},'ok');
      fetch(N8N+'/ss-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code})})
        .then(function(r){return r.json();})
        .then(function(d){ if(d&&d.ok){ setClient({code:code.toUpperCase(),name:d.name||${JSON.stringify(Lraw("Client", "عميل"))},names:(d.names&&typeof d.names==='object')?d.names:{},kb:d.has_profile===true}); note(box,${JSON.stringify(Lraw("Welcome ", "أهلاً "))}+(d.name||'')+' 👋','ok'); openService(); }
          else if(d&&d.blocked){ note(box,${JSON.stringify(Lraw("This account is suspended — contact us to reactivate.", "هذا الحساب موقوف — تواصل معنا لإعادة التفعيل."))},'err'); }
          else { note(box,${JSON.stringify(Lraw("Incorrect code. Use the code emailed to you after payment.", "الرمز غير صحيح. استخدم الرمز الذي وصلك على بريدك بعد الدفع."))},'err'); } })
        .catch(function(){ note(box,${JSON.stringify(Lraw("Connection issue — try again.", "تعذّر الاتصال — حاول مرة ثانية."))},'err'); });
    });
    var lo=document.getElementById('ss-logout');
    if(lo) lo.onclick=function(){ localStorage.removeItem(SKEY); localStorage.removeItem('bp_ss_token'); if(dash)dash.hidden=true; if(gate){gate.hidden=false;gate.scrollIntoView({behavior:'smooth',block:'start'});} };

    // ---------- tabs ----------
    var toolsBuilt=false;
    function switchTab(t){
      ['team','svc','stats','tools','comp'].forEach(function(k){var p=document.getElementById('pane-'+k);if(p)p.hidden=(k!==t);});
      var tabs=document.querySelectorAll('.ss-tab');for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle('active',tabs[i].getAttribute('data-tab')===t);
      if(t==='tools'&&!toolsBuilt){buildTools();toolsBuilt=true;}
      if(t==='stats')loadStats();
      if(t==='comp'){var fr=document.getElementById('ss-compdash-frame');if(fr&&!fr.src)fr.src=fr.getAttribute('data-src');}
    }
    var statsLoaded=false;
    function agentLabel(slug){for(var i=0;i<AGENTS.length;i++)if(AGENTS[i].slug===slug)return dispName(AGENTS[i]);return slug;}
    function renderStats(d){
      var tiles=document.getElementById('ss-kpis');
      var inprog=(d.tasks_by_status&&(d.tasks_by_status[${JSON.stringify(Lraw("In progress", "قيد التنفيذ"))}]||d.tasks_by_status['قيد التنفيذ']))||0;
      var last=(d.last_activity||'').slice(0,10)||'—';
      tiles.innerHTML='<div class="ss-ktile"><div class="n">'+(d.conv_total||0)+'</div><div class="l">${Lraw("Conversations", "محادثة مع الفريق")}</div></div>'
        +'<div class="ss-ktile"><div class="n">'+(d.tasks_total||0)+'</div><div class="l">${Lraw("Documented tasks", "مهمة موثقة")}</div></div>'
        +'<div class="ss-ktile"><div class="n">'+inprog+'</div><div class="l">${Lraw("In progress", "قيد التنفيذ")}</div></div>'
        +'<div class="ss-ktile"><div class="n" style="font-size:1.05rem;padding-top:8px">'+last+'</div><div class="l">${Lraw("Last activity", "آخر نشاط")}</div></div>';
      var ag=document.getElementById('ss-kagents');ag.innerHTML='';
      var keys=Object.keys(d.agents||{}).sort(function(a,b){return d.agents[b]-d.agents[a];});
      if(!keys.length)ag.innerHTML='<div class="ss-kempty">${Lraw("No interactions yet — start from the Team tab.", "لا تفاعلات بعد — ابدأ من تبويب الفريق.")}</div>';
      keys.forEach(function(k){var r=document.createElement('div');r.innerHTML='<span>'+agentLabel(k)+'</span><span class="c">'+d.agents[k]+'</span>';ag.appendChild(r);});
      var rc=document.getElementById('ss-krecent');rc.innerHTML='';
      var recent=d.recent||[];
      if(!recent.length)rc.innerHTML='<div class="ss-kempty">${Lraw("Nothing yet.", "لا يوجد بعد.")}</div>';
      recent.forEach(function(m){var r=document.createElement('div');r.innerHTML='<span>'+(m.t||'')+'</span><span class="c">'+agentLabel(m.agent)+' · '+(m.date||'')+'</span>';rc.appendChild(r);});
    }
    function loadStats(){
      if(statsLoaded)return;statsLoaded=true;
      var c=getClient()||{};
      if(c.demo){renderStats({conv_total:12,tasks_total:5,tasks_by_status:{'قيد التنفيذ':2},agents:{khaled:5,mishari:3,farah:2,mohammed:2},recent:[{t:${JSON.stringify(Lraw("Quarterly marketing plan", "خطة تسويقية للربع"))},agent:'farah',date:'2026-07-15'},{t:${JSON.stringify(Lraw("Nitaqat check before hiring", "فحص النطاقات قبل توظيف عامل"))},agent:'mishari',date:'2026-07-14'}],last_activity:'2026-07-16'});return;}
      document.getElementById('ss-kpis').innerHTML='<div class="ss-kempty">${Lraw("Loading your numbers…", "نحمّل أرقامك…")}</div>';
      fetch(N8N+'/ss-stats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c.code})})
        .then(function(r){return r.json();})
        .then(function(d){if(d&&d.ok){renderStats(d);}else{document.getElementById('ss-kpis').innerHTML='<div class="ss-kempty">${Lraw("Could not load reports right now.", "تعذر تحميل التقارير حالياً.")}</div>';statsLoaded=false;}})
        .catch(function(){document.getElementById('ss-kpis').innerHTML='<div class="ss-kempty">${Lraw("Could not load reports right now.", "تعذر تحميل التقارير حالياً.")}</div>';statsLoaded=false;});
    }
    (function(){var tabs=document.querySelectorAll('.ss-tab');for(var i=0;i<tabs.length;i++){(function(b){b.onclick=function(){switchTab(b.getAttribute('data-tab'));};})(tabs[i]);}})();

    // ---------- team: per-agent individual chat ----------
    var cur=null, chatHist=[];
    var log=document.getElementById('ss-log'), input=document.getElementById('ss-input');
    function chatKey(s){ var c=getClient(); return CHAT_PREFIX+((c&&c.code)||'anon')+'_'+s; }
    function loadChat(s){try{return JSON.parse(localStorage.getItem(chatKey(s))||'[]');}catch(e){return[];}}
    function saveChat(s,h){try{localStorage.setItem(chatKey(s),JSON.stringify(h.slice(-80)));}catch(e){}}
    function renderChat(){log.innerHTML='';if(!chatHist.length){var em=document.createElement('div');em.className='ss-msg bot empty';em.textContent=${JSON.stringify(Lraw("Start your conversation with ", "ابدأ محادثتك مع "))}+dispName(cur)+' 👋';log.appendChild(em);return;}
      chatHist.forEach(function(m){var d=document.createElement('div');d.className='ss-msg '+m.cls;d.textContent=m.text;log.appendChild(d);});log.scrollTop=log.scrollHeight;}
    function selectAgent(a,el){cur=a;var chips=document.querySelectorAll('.ss-ag');for(var i=0;i<chips.length;i++)chips[i].classList.remove('sel');if(el)el.classList.add('sel');
      document.getElementById('ph-e').textContent=a.e;document.getElementById('ph-n').textContent=dispName(a);document.getElementById('ph-r').textContent=a.role;
      chatHist=loadChat(a.slug);renderChat();input.disabled=false;document.querySelector('#ss-form button').disabled=false;input.focus();}
    function buildAgents(){var box=document.getElementById('ss-agents');box.innerHTML='';
      AGENTS.forEach(function(a){var el=document.createElement('button');el.type='button';el.className='ss-ag';el.dataset.slug=a.slug;
        el.innerHTML='<span class="e">'+a.e+'</span><div><b>'+dispName(a)+'</b><span>'+a.role+'</span></div>';
        el.onclick=function(){selectAgent(a,el);};box.appendChild(el);});}
    var kb=document.getElementById('ss-know');
    function kbLabel(){ var c=getClient(); if(kb)kb.textContent=(c&&c.kb)?'🧠 '+${JSON.stringify(Lraw("Update your company file", "حدّث ملف شركتك"))}:'🧠 '+${JSON.stringify(Lraw("Teach the team your company", "عرّف الفريق على شركتك"))}; }
    kbLabel();
    if(kb) kb.onclick=function(){
      var c=getClient(); if(!c)return;
      if(c.demo){ alert(${JSON.stringify(Lraw("In the live account: paste your website link and the whole team learns your company — try it after subscribing.", "في الحساب الفعلي: تلصق رابط موقعك والفريق كله يتعلم شركتك — جرّبها بعد الاشتراك."))}); return; }
      var v=prompt(${JSON.stringify(Lraw("Paste your website link (or write a short brief about your company):", "الصق رابط موقعك (أو اكتب نبذة قصيرة عن شركتك):"))},'');
      if(v===null)return; v=v.trim(); if(!v)return;
      var isUrl=/^(https?:\\/\\/)?[\\w\\u0600-\\u06ff.-]+\\.[a-z\\u0600-\\u06ff]{2,}([\\/?#][^\\s]*)?$/i.test(v)&&v.indexOf(' ')===-1;
      var body={code:c.code}; if(isUrl)body.website=v; else body.about=v;
      kb.disabled=true; kb.textContent='🧠 '+${JSON.stringify(Lraw("Reading & learning…", "نقرأ ونتعلّم…"))};
      fetch(N8N+'/ss-knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json();})
        .then(function(d){ kb.disabled=false; if(d&&d.ok){ c.kb=true; setClient(c); kbLabel(); alert('✅ '+${JSON.stringify(Lraw("Done! Your whole team now knows your company — ask any agent about it.", "تم! فريقك كله الآن يعرف شركتك — اسأل أي موظف عنها."))}); } else { kbLabel(); alert(${JSON.stringify(Lraw("Could not read that — check the link and try again.", "تعذرت القراءة — تأكد من الرابط وحاول مرة ثانية."))}); } })
        .catch(function(){ kb.disabled=false; kbLabel(); alert(${JSON.stringify(Lraw("Connection issue — try again.", "تعذّر الاتصال — حاول مرة ثانية."))}); });
    };
    var rb=document.getElementById('ss-rename');
    if(rb) rb.onclick=function(){ if(!cur)return; var curName=dispName(cur);
      var v=prompt(${JSON.stringify(Lraw("New name for «", "اكتب الاسم الجديد لـ «"))}+cur.name+${JSON.stringify(Lraw("» (leave empty to restore the original name):", "» (اتركه فارغاً لاستعادة الاسم الأصلي):"))},curName===cur.name?'':curName);
      if(v===null)return; v=v.trim().slice(0,40);
      var nm=getNames(); if(v){nm[cur.slug]=v;} else {delete nm[cur.slug];}
      saveNames(nm); buildAgents(); var sel=document.querySelector('.ss-ag[data-slug="'+cur.slug+'"]'); selectAgent(cur,sel);
      var c=getClient();
      if(c&&!c.demo){ fetch(N8N+'/ss-names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c.code,names:nm})}).catch(function(){}); }
    };
    function sid(){var s=localStorage.getItem('bp_ss_sid');if(!s){s='ss-'+Date.now()+'-'+Math.random().toString(16).slice(2);localStorage.setItem('bp_ss_sid',s);}return s;}
    var busy=false;
    function push(text,cls){var em=log.querySelector('.empty');if(em)em.remove();var d=document.createElement('div');d.className='ss-msg '+cls;d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;return d;}
    var form=document.getElementById('ss-form');
    form.addEventListener('submit',function(e){e.preventDefault();if(!cur)return;var m=(input.value||'').trim();if(!m||busy)return;busy=true;
      var agent=cur,href=chatHist;input.value='';push(m,'me');href.push({text:m,cls:'me'});saveChat(agent.slug,href);
      var th=push('…','bot');var ctrl=new AbortController();var timer=setTimeout(function(){ctrl.abort();},110000);
      var c=getClient()||{code:'demo123'};
      var url=N8N+'/ss-chat', payload={code:c.code,agent:agent.slug,message:m};
      if(c.demo)payload.names=getNames();
      fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl.signal})
        .then(function(r){return r.text();}).then(function(raw){clearTimeout(timer);var rep='';try{var d=JSON.parse(raw);rep=d.reply||d.output||d.text||d.message||'';}catch(e){rep=raw;}rep=rep||BUSY;th.textContent=rep;href.push({text:rep,cls:'bot'});saveChat(agent.slug,href);})
        .catch(function(er){clearTimeout(timer);var msg=(er&&er.name==='AbortError')?BUSY:ERRT;th.textContent=msg;href.push({text:msg,cls:'bot'});saveChat(agent.slug,href);})
        .then(function(){busy=false;});
    });

    // ---------- compliance: jump to Mishari ----------
    var cc=document.getElementById('ss-comp-chat');
    if(cc) cc.onclick=function(){switchTab('team');var mi=null;for(var i=0;i<AGENTS.length;i++)if(AGENTS[i].slug==='mishari')mi=AGENTS[i];
      var el=document.querySelector('.ss-ag[data-slug="mishari"]');if(mi)selectAgent(mi,el);
      document.getElementById('pane-team').scrollIntoView({behavior:'smooth',block:'start'});};

    // ---------- connectors ----------
    var ICONS={
      gmail:'<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#EA4335"/><path d="M2 7l10 7 10-7" stroke="#fff" stroke-width="2" fill="none"/></svg>',
      gcal:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#4285F4"/><rect x="3" y="4" width="18" height="5" fill="#1a73e8"/><rect x="7" y="12" width="4" height="4" fill="#fff"/></svg>',
      notion:'<svg viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="2" fill="#111"/><path d="M8 16V8l8 8V8" stroke="#fff" stroke-width="1.7" fill="none"/></svg>',
      slack:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="#4A154B"/><path d="M8.5 8v8M13 8v8M7 10.5h9M7 14h9" stroke="#fff" stroke-width="1.4"/></svg>',
      whatsapp:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" fill="#25D366"/></svg>',
      ms:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" fill="#F25022"/><rect x="13" y="3" width="8" height="8" fill="#7FBA00"/><rect x="3" y="13" width="8" height="8" fill="#00A4EF"/><rect x="13" y="13" width="8" height="8" fill="#FFB900"/></svg>',
      drive:'<svg viewBox="0 0 24 24"><path d="M9 3h6l6 11h-6z" fill="#FFCF63"/><path d="M3 20l3-5h13l-3 5z" fill="#4688F1"/><path d="M9 3L3 14l3 6 6-11z" fill="#0F9D58"/></svg>',
      crm:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#0F9D58"/><rect x="7" y="8" width="10" height="1.8" fill="#fff"/><rect x="7" y="12" width="10" height="1.8" fill="#fff"/><rect x="7" y="16" width="10" height="1.8" fill="#fff"/></svg>'
    };
    var URLS={gmail:'https://mail.google.com',gcal:'https://calendar.google.com',notion:'https://www.notion.so',slack:'https://slack.com',whatsapp:'https://business.whatsapp.com',ms:'https://www.microsoft.com/microsoft-365',drive:'https://drive.google.com',crm:'https://www.google.com/sheets/about',qoyod:'https://www.qoyod.com'};
    var LOGO={gmail:1,gcal:1,notion:1,whatsapp:1,drive:1,crm:1};
    function mark(t){return LOGO[t.id]?'<img class="brand" src="/assets/img/logos/'+t.id+'.svg" alt="'+t.name+'" loading="lazy">':(ICONS[t.id]||t.ic);}
    var TAG={easy:${JSON.stringify(Lraw("One-click", "ربط بضغطة"))},cost:${JSON.stringify(Lraw("Has a cost", "فيه تكلفة"))},token:${JSON.stringify(Lraw("Needs a token", "يحتاج توكن"))}};
    var CONN_ON=${JSON.stringify(Lraw("✓ Connected", "✓ متصل"))},CONN_OFF=${JSON.stringify(Lraw("Not connected", "غير متصل"))},MANAGE=${JSON.stringify(Lraw("Manage", "إدارة"))},CONNECT=${JSON.stringify(Lraw("🔗 Connect", "🔗 اربط"))},HELPBTN=${JSON.stringify(Lraw("🛠️ Set up for me", "🛠️ نركّبها لك"))};
    var TKEY='bp_connect_demo_v1';var tst={};try{tst=JSON.parse(localStorage.getItem(TKEY)||'{}');}catch(e){tst={};}
    function buildTools(){var g=document.getElementById('ss-cgrid');
      TOOLS.forEach(function(t){var on=!!tst[t.id];var d=document.createElement('div');d.className='ss-cc';d.dataset.id=t.id;
        d.innerHTML='<div class="ss-cc-top"><span class="ss-cc-ic">'+mark(t)+'</span><div class="ss-cc-t"><h3>'+t.name+'</h3><div class="u">'+t.u+'</div></div><span class="ss-cc-state '+(on?'on':'')+'">'+(on?CONN_ON:CONN_OFF)+'</span></div>'+
          '<span class="ss-cc-tag '+t.type+'">'+TAG[t.type]+'</span>'+
          '<div class="ss-cc-actions"><button class="ss-cbtn" type="button">'+(on?MANAGE:CONNECT)+'</button><button class="ss-hbtn" type="button">'+HELPBTN+'</button></div>';
        d.querySelector('.ss-cbtn').onclick=function(){openTool(t);};
        d.querySelector('.ss-hbtn').onclick=function(){helpTool(t);};
        g.appendChild(d);});}
    var ov=document.getElementById('ss-ov'),curTool=null;
    function openTool(t){curTool=t;document.getElementById('ssm-ic').innerHTML=mark(t);document.getElementById('ssm-t').textContent=${JSON.stringify(Lraw("Connect ", "ربط "))}+t.name;
      document.getElementById('ssm-l').textContent=t.lead;
      var s='';if(t.pay)s+='<div class="ss-pay">💳 '+t.pay+'</div>';
      t.steps.forEach(function(x,i){s+='<div class="ss-stp"><div class="n">'+(i+1)+'</div><div class="tx">'+x+'</div></div>';});
      document.getElementById('ssm-s').innerHTML=s;
      document.getElementById('ssm-do').textContent=tst[t.id]?${JSON.stringify(Lraw("✓ Connected — reconnect", "✓ متصل — إعادة الربط"))}:${JSON.stringify(Lraw("🔗 Connect now", "🔗 ربط الآن"))};
      ov.classList.add('on');}
    document.getElementById('ssm-x').onclick=function(){ov.classList.remove('on');};
    ov.onclick=function(e){if(e.target===ov)ov.classList.remove('on');};
    document.getElementById('ssm-do').onclick=function(){if(!curTool)return;tst[curTool.id]=true;localStorage.setItem(TKEY,JSON.stringify(tst));
      var c=document.querySelector('.ss-cc[data-id="'+curTool.id+'"]');if(c){var b=c.querySelector('.ss-cc-state');b.textContent=CONN_ON;b.classList.add('on');c.querySelector('.ss-cbtn').textContent=MANAGE;}
      ov.classList.remove('on');window.open(URLS[curTool.id]||'#','_blank','noopener');};
    document.getElementById('ssm-help').onclick=function(){if(curTool)helpTool(curTool);};
    function helpTool(t){alert(${JSON.stringify(Lraw("Setup request for «", "طلب إعداد «"))}+t.name+${JSON.stringify(Lraw("» — we connect the tool and hand it over ready for a one-time setup fee.", "» — نركّب لك الأداة ونسلّمها جاهزة مقابل رسوم إعداد لمرة واحدة."))});}

    // ---------- init ----------
    function initDash(){buildAgents();var first=document.querySelector('.ss-ag');selectAgent(AGENTS[0],first);}
    if(getClient()) openService();
  })();</script>`;
  return page({
    title: Lraw("Service portal — Shared Services | Business Partner", "بوابة الخدمة — الخدمات المشتركة | بيزنس بارتنر"),
    desc: Lraw("Sign in to your Shared Services executive team portal.", "سجّل دخولك لبوابة فريقك التنفيذي في الخدمات المشتركة."),
    active: "/shared-services", path: "/shared-services/dashboard", body, script,
  });
}

/* ---------- write ---------- */
function write(rel, html) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

// Clean previously-generated pages (both trees, all subdirectories) so stale
// files don't linger when a route is removed or renamed (e.g. a deleted
// service/category, or a page moved out of a subfolder like services/category
// or magazine — a shallow top-level-only clean used to miss those).
function cleanHtml(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f === "assets") continue;
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) cleanHtml(full);
    else if (f.endsWith(".html")) fs.unlinkSync(full);
  }
}
for (const dir of [ROOT, ...ALL_LANGS.filter((l) => l !== "en").map((l) => path.join(ROOT, l))]) cleanHtml(dir);
if (fs.existsSync(path.join(ROOT, "business-tourism.html"))) fs.unlinkSync(path.join(ROOT, "business-tourism.html"));
if (fs.existsSync(path.join(ROOT, "blog.html"))) fs.unlinkSync(path.join(ROOT, "blog.html"));

let pageCount = 0;
// The full page set for one language tree — shared by en/ar (always full)
// and by any extra language once it's in FULLY_READY_LANGS.
function writeFullSite(pre) {
  write(`${pre}index.html`, buildHome());
  write(`${pre}about.html`, buildAbout());
  write(`${pre}services.html`, buildServicesIndex());
  write(`${pre}ai-agents.html`, buildAiAgents());
  write(`${pre}tourism.html`, buildTourism());
  write(`${pre}mahfol-makfol.html`, buildMahfolMakfol());
  write(`${pre}mahfol-makfol/trips.html`, buildMahfolTrips());
  write(`${pre}task-force.html`, buildTaskForce());
  write(`${pre}deals.html`, buildDeals());
  write(`${pre}opportunities.html`, buildOpportunities());
  write(`${pre}packages.html`, buildPackages());
  write(`${pre}calculator.html`, buildCalculator());
  write(`${pre}tools-and-calculators.html`, buildToolsHub());
  // /calculators/nitaqat removed at owner's request (2026-07-16) — kept as
  // unused dead code below, not linked or generated anywhere.
  write(`${pre}calculators/government-cost.html`, buildGovernmentCostCalculator());
  write(`${pre}calculators/profession-checker.html`, buildProfessionChecker());
  write(`${pre}calculators/end-of-service.html`, buildEndOfServiceCalculator());
  write(`${pre}calculators/annual-leave.html`, buildAnnualLeaveCalculator());
  write(`${pre}calculators/overtime.html`, buildOvertimeCalculator());
  write(`${pre}calculators/gosi.html`, buildGosiCalculator());
  write(`${pre}compliance-agent.html`, buildComplianceAgent());
  TEAM_AGENTS.forEach((a) => write(`${pre}team/${a.slug}.html`, buildTeamAgent(a)));
  write(`${pre}saudi-arabia.html`, buildSaudi());
  write(`${pre}directory.html`, buildDirectory());
  write(`${pre}guide/saudi-market.html`, buildGuideSaudiMarket());
  write(`${pre}guide/business-setup.html`, buildGuideBusinessSetup());
  write(`${pre}guide/run-your-business.html`, buildGuideRunBusiness());
  write(`${pre}guide/live-in-saudi.html`, buildGuideLiveInSaudi());
  write(`${pre}guide/residency.html`, buildGuideResidency());
  write(`${pre}news.html`, buildNews());
  write(`${pre}magazine.html`, buildMagazine());
  write(`${pre}magazine/print.html`, buildMagazinePrint());
  write(`${pre}careers.html`, buildCareers());
  write(`${pre}hr.html`, buildHR());
  write(`${pre}employers.html`, buildEmployers());
  write(`${pre}newsletter.html`, buildNewsletter());
  write(`${pre}employer-join.html`, buildEmployerJoin());
  write(`${pre}employer-login.html`, buildEmployerLogin());
  write(`${pre}candidate-profile.html`, buildCandidateProfile());
  write(`${pre}employer-dashboard.html`, buildEmployerDashboard());
  write(`${pre}portal/index.html`, buildPortalHome());
  write(`${pre}portal/join.html`, buildPortalJoin());
  write(`${pre}portal/dashboard.html`, buildPortalDashboard());
  write(`${pre}portal/candidates.html`, buildPortalCandidates());
  write(`${pre}workspaces.html`, buildWorkspaces());
  write(`${pre}workspace-request.html`, buildWorkspaceRequest());
  // /farina (Farina catering vertical) removed at owner's request — buildFarina() kept as dead code, not generated or linked.
  write(`${pre}worker-housing.html`, buildWorkerHousing());
  write(`${pre}contact.html`, buildContact());
  write(`${pre}cart.html`, buildCart());
  // /installments hidden at owner's request — buildInstallments() kept as dead code, not generated or linked.
  write(`${pre}estrdad.html`, buildEstrdad());
  write(`${pre}bank-account.html`, buildBankAccount());
  write(`${pre}formation-contract.html`, buildFormationContract());
  write(`${pre}checkout.html`, buildCheckout());
  write(`${pre}terms.html`, buildTerms());
  write(`${pre}account.html`, buildAccount());
  write(`${pre}shared-services.html`, buildSharedServices());
  write(`${pre}shared-services/dashboard.html`, buildSharedServicesPortal());
  write(`${pre}consultation.html`, buildConsultation());
  write(`${pre}suppliers.html`, buildSuppliers());
  write(`${pre}partner-dashboard.html`, buildPartnerDashboard());
  services.forEach((s) => write(`${pre}services/${s.slug}.html`, buildServiceDetail(s)));
  categories.forEach((cat) => write(`${pre}services/category/${catSlugUrl(cat.key)}.html`, buildServiceCategory(cat)));
  JOBS.forEach((j) => write(`${pre}jobs/${j.slug}.html`, buildJobPage(j)));
  write(`${pre}jobs/${WORKSHOP_CAMPAIGN.slug}.html`, buildWorkshopCampaign());
  WORKSHOP_JOBS.forEach((j) => write(`${pre}jobs/${j.slug}.html`, buildJobPage(j)));
  pageCount += 17 + TEAM_AGENTS.length + services.length + categories.length + JOBS.length + 1 + WORKSHOP_JOBS.length;
}

for (const lang of ["en", "ar"]) {
  LANG = lang;
  writeFullSite(lang === "ar" ? "ar/" : "");
}

// HR employer app (/hr/employer/*) — standalone Arabic-first app chrome,
// generated once (not per language tree). See site/scripts/hr-app.mjs.
{
  const { buildHRAppPages } = await import("./hr-app.mjs");
  const hrPages = buildHRAppPages();
  for (const [rel, html] of hrPages) write(rel, html);
  pageCount += hrPages.length;
}

// Extra world languages: languages fully translated (FULLY_READY_LANGS) get
// every page, same as en/ar. The rest still only get the core discovery
// pages (site chrome + homepage matter most for a first-touch international
// visitor) — u() routes any other internal link back to the English page
// instead of a 404 for those; see EXTRA_LANG_PATHS.
for (const lang of EXTRA_LANGS) {
  LANG = lang;
  const pre = `${lang}/`;
  if (FULLY_READY_LANGS.includes(lang)) {
    writeFullSite(pre);
    continue;
  }
  write(`${pre}index.html`, buildHome());
  write(`${pre}about.html`, buildAbout());
  write(`${pre}services.html`, buildServicesIndex());
  write(`${pre}packages.html`, buildPackages());
  write(`${pre}contact.html`, buildContact());
  pageCount += 5;
}
LANG = "en";

// Owner-only live chat monitor (standalone page, no site chrome, noindex)
write("monitor.html", buildMonitor());

// Owner-only control + live-test dashboard for the specialized-team agents (noindex)
write("dashboard.html", buildDashboard());

// Client product page: AI employees + connectors hub + pricing (noindex).
// Emit under both / and /ar/ so localized nav links (u("/connect") -> /ar/connect) resolve.
write("connect.html", buildConnect("/"));
write("ar/connect.html", buildConnect("/ar/"));

// Client portal: login -> subscription gate -> pick agent -> live chat (noindex)
write("portal.html", buildPortal("/"));
write("ar/portal.html", buildPortal("/ar/"));

// Compliance Agent client dashboard (email + access-code login, document
// upload wizard, alerts/costs) — a prebuilt self-contained page that talks
// only to n8n webhooks. Its source of truth lives under assets/data (which
// cleanHtml never touches) and is copied into the ar/ tree on every build;
// editing it in place under ar/ would be silently deleted by the next run.
write("ar/compliance-dashboard.html", fs.readFileSync(path.join(ROOT, "assets/data/compliance-dashboard.html"), "utf8"));

// sitemap.xml — both language trees
const base = "https://businesspartner.sa";
const paths = ["/", "/about", "/services", "/ai-agents", "/tourism", "/mahfol-makfol", "/mahfol-makfol/trips", "/task-force", "/magazine", "/magazine/print", "/packages", "/calculator", "/tools-and-calculators", "/calculators/government-cost", "/calculators/profession-checker", "/calculators/end-of-service", "/calculators/annual-leave", "/calculators/overtime", "/calculators/gosi", "/compliance-agent", "/saudi-arabia", "/opportunities", "/directory", "/guide/saudi-market", "/guide/business-setup", "/guide/run-your-business", "/guide/live-in-saudi", "/guide/residency", "/news", "/newsletter", "/careers", "/hr", "/employers", "/employer-join", "/employer-login", "/employer-dashboard", "/workspaces", "/workspace-request", "/worker-housing", "/estrdad", "/bank-account", "/formation-contract", "/contact", "/cart", "/checkout", "/terms", "/account", "/shared-services", "/consultation", "/suppliers", "/partner-dashboard"]
  .concat(TEAM_AGENTS.map((a) => `/team/${a.slug}`))
  .concat(categories.map((cat) => `/services/category/${catSlugUrl(cat.key)}`))
  .concat(services.map((s) => `/services/${s.slug}`))
  .concat(JOBS.map((j) => `/jobs/${j.slug}`))
  .concat([`/jobs/${WORKSHOP_CAMPAIGN.slug}`])
  .concat(WORKSHOP_JOBS.map((j) => `/jobs/${j.slug}`));
const urls = paths
  .flatMap((p) => [p, p === "/" ? "/ar/" : "/ar" + p].concat(EXTRA_LANG_PATHS.has(p) ? EXTRA_LANGS.map((l) => (p === "/" ? `/${l}/` : `/${l}${p}`)) : []))
  .map((p) => `  <url><loc>${base}${p}</loc></url>`)
  .join("\n");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);

// assets/data/catalog.json — public, no-auth, zero-serverless-cost quote data
// source for external integrations (the WhatsApp AI agent in n8n, the on-site
// smart advisor, or any future bot). Generated from the exact same services/
// categories/packages data that drives the website, so a quote given here can
// never drift from what a customer sees on the pages themselves. Static file,
// does not count against the Vercel Hobby 12-serverless-function cap.
const catalogJson = {
  updatedAt: new Date().toISOString(),
  currency: "SAR",
  services: services.map((s) => {
    const m = svcI18n[s.code] || {};
    const ov = site.overrides[s.slug];
    return {
      code: s.code,
      nameAr: sNameArOf(s),
      nameEn: m.en || (ov && ov.nameEn) || s.name,
      category: s.category,
      categoryAr: s.categoryAr,
      govPlatform: s.govPlatform,
      pricingModel: s.pricingModel,
      amount: s.price.amount,
      priceLabel: s.price.label,
      govFeesSeparate: !!s.govFeesSeparate,
      requiresProposal: !!s.requiresProposal,
      url: `${base}/services/${s.slug}`,
    };
  }),
  categories: categories.map((c) => ({ key: c.key, nameAr: c.ar, nameEn: (CAT_META[c.key] || {}).en || c.key, count: services.filter((s) => s.category === c.key).length })),
  packages: (site.packages.groups || []).flatMap((g) =>
    g.tiers.map((t) => ({
      group: g.key,
      groupNameAr: g.ar,
      groupNameEn: g.en,
      code: t.code || null,
      key: t.key,
      nameAr: t.nameAr,
      nameEn: t.nameEn || t.name,
      amount: t.amount != null ? t.amount : null,
      priceLabel: t.priceEn || t.price,
      billingPeriod: t.price && /شهري|monthly/i.test(t.priceEn || t.price) ? "monthly" : "one_time",
      featuresAr: t.features,
      featuresEn: t.featuresEn,
      url: `${base}/packages`,
    }))
  ),
};
write("assets/data/catalog.json", JSON.stringify(catalogJson, null, 2));

console.log(`Generated ${pageCount} pages (en + ar) + sitemap + catalog.json.`);
