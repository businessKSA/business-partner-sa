// Per-service copy for every channel. One service per pack — never a service list.
import fs from "node:fs";
import path from "node:path";
import { BRAND, playbookFor } from "./playbooks.mjs";
import { toArabicDeliverable } from "./deliverables-ar.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
// The catalogue keeps names in English; the Arabic name lives in service-i18n.json,
// keyed by service code. Arabic copy must never fall back to the English label.
const I18N = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/service-i18n.json"), "utf8"));

// "" is a deliberate blank line; null means "omit this line entirely".
const keep = (l) => l !== null && l !== undefined;
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// The catalogue stores names in English for most rows; the Arabic category is
// always present, so the Arabic line leads and the English name stays as a label.
export function serviceTitle(service) {
  const ar = I18N[service.code]?.ar;
  return clean(ar || service.nameAr || service.name);
}

export function serviceTitleEn(service) {
  return clean(I18N[service.code]?.en || service.name);
}

export function checklist(service) {
  const own = (service.deliverables ?? []).map(clean).filter(Boolean).map(toArabicDeliverable);
  return own.length ? own.slice(0, 5) : playbookFor(service).steps;
}

// U+FDFC (﷼) is missing from the Noto Arabic faces used for rendering and comes out
// as a broken glyph on the social cards, so the amount is always spelled out.
const riyals = (amount) => `${Number(amount).toLocaleString("en-US")} ريال`;

export function priceLine(service) {
  const p = service.price ?? {};
  if (!p.amount) return service.requiresProposal ? "بعرض سعر مخصّص" : "";
  const fees = service.govFeesSeparate ? " · الرسوم الحكومية منفصلة" : "";
  return `تبدأ من ${riyals(p.amount)}${fees}`;
}

// The social card pill has room for the number, not the caveat.
export function priceShort(service) {
  const p = service.price ?? {};
  return p.amount ? `تبدأ من ${riyals(p.amount)}` : "اطلب عرض سعر";
}

export function landingUrl(service) {
  return `${BRAND.site}/service/${service.slug}`;
}

function waLink(service) {
  const msg = `مرحباً، أرغب بالاستفسار عن: ${serviceTitle(service)}`;
  return `${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`;
}

const HASHTAG_BASE = ["#بزنس_بارتنر", "#السعودية", "#أعمال"];
const HASHTAGS_BY_CATEGORY = {
  "تأسيس الشركات": ["#تأسيس_شركات", "#سجل_تجاري", "#ريادة_أعمال"],
  "العلاقات الحكومية": ["#قوى", "#مقيم", "#التأمينات_الاجتماعية", "#امتثال"],
  "دعم الأعمال": ["#خدمات_الأعمال", "#إجراءات_حكومية"],
  "الموارد البشرية": ["#موارد_بشرية", "#نظام_العمل", "#توطين"],
  "الاستثمار الأجنبي": ["#الاستثمار_الأجنبي", "#وزارة_الاستثمار", "#دخول_السوق_السعودي"],
  "التوظيف والاستقدام": ["#توظيف", "#استقدام", "#وظائف"],
  "العقارات": ["#عقارات_تجارية", "#مقر_الشركة"],
  "الإقامة المميزة": ["#الإقامة_المميزة", "#بريميوم_ريزيدنسي"],
  "الأتمتة والذكاء الاصطناعي": ["#أتمتة", "#ذكاء_اصطناعي", "#كفاءة_تشغيلية"],
};

export function hashtags(service) {
  const extra = HASHTAGS_BY_CATEGORY[service.categoryAr] ?? [];
  return [...extra, ...HASHTAG_BASE].slice(0, 6);
}

export function buildCopy(service) {
  const pb = playbookFor(service);
  const title = serviceTitle(service);
  const steps = checklist(service);
  const price = priceLine(service);
  const priceTag = priceShort(service);
  const url = landingUrl(service);
  const wa = waLink(service);
  const govRaw = clean(service.govPlatform);
  // "عضوية الغرفة التجارية (الغرفة التجارية)" reads as a mistake — drop the
  // platform whenever the service name already contains it.
  const gov = govRaw && !title.includes(govRaw) ? govRaw : "";

  return {
    code: service.code,
    slug: service.slug,
    title,
    category: service.categoryAr ?? service.category,
    govPlatform: gov,
    audience: pb.audience,
    headline: pb.outcome,
    pain: pb.pain,
    steps,
    price,
    priceTag,
    proof: pb.proof,
    url,
    whatsappLink: wa,

    // ── Email ───────────────────────────────────────────────────────────────
    email: {
      subject: `${title} — ${pb.outcome}`,
      preheader: clean(pb.pain).slice(0, 110),
    },

    // ── WhatsApp channel: short, scannable, one link ────────────────────────
    whatsapp: [
      `*${pb.outcome}*`,
      "",
      pb.pain,
      "",
      `*${title}*${gov ? ` — عبر ${gov}` : ""}`,
      ...steps.map((s) => `✅ ${s}`),
      "",
      price ? `💠 ${price}` : null,
      `للاستفسار: ${wa}`,
      url,
    ].filter(keep).join("\n"),

    // ── LinkedIn: problem-led, professional, no hashtag spam ────────────────
    linkedin: [
      pb.pain,
      "",
      `${title}${gov ? ` (${gov})` : ""} — ما ننجزه:`,
      ...steps.map((s) => `• ${s}`),
      "",
      price ? `${price}.` : null,
      `${pb.proof}`,
      url,
      "",
      hashtags(service).slice(0, 3).join(" "),
    ].filter(keep).join("\n"),

    // ── Instagram caption ───────────────────────────────────────────────────
    instagram: [
      `${pb.outcome} ✨`,
      "",
      pb.pain,
      "",
      ...steps.map((s) => `✔︎ ${s}`),
      "",
      price ? `${price}` : null,
      `الرابط في البايو أو واتساب ${BRAND.phone}`,
      "",
      hashtags(service).join(" "),
    ].filter(keep).join("\n"),

    // ── TikTok / Reels script: hook, body, CTA ──────────────────────────────
    tiktok: {
      hook: pb.pain,
      body: [`${title}:`, ...steps.map((s) => `— ${s}`)].join("\n"),
      cta: `${pb.proof} اكتب لنا على واتساب.`,
      onScreen: pb.outcome,
      caption: `${pb.outcome} | ${title}\n${hashtags(service).join(" ")}`,
    },

    // ── X: one line ─────────────────────────────────────────────────────────
    x: `${pb.outcome}.\n${title}${price ? ` — ${price}` : ""}.\n${url}`,
  };
}
