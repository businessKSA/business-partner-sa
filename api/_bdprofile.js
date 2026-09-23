// The Business Development client profile — what a client sells, who they want
// to sell it to, and their company profile document.
//
// This is the input side of matchmaking. Without it the service has nothing to
// match on: the companies database (Notion, "🏢 قاعدة الشركات — مبيعات", served
// by /api/pay?resource=leads) is keyed on a Sector select whose values are
// English strings, while every client-facing surface is Arabic. So the sector a
// client picks cannot be free text and cannot be an Arabic label alone — it has
// to be stored as the exact value the database filters on, or the match returns
// nothing and looks like an empty database rather than a mismatch.
//
// Underscore-prefixed on purpose: Vercel turns every other file in api/ into a
// serverless function and the plan caps a deployment at 12. See api/README.md.

// The canonical Sector/City values, copied from the leads teaser in api/pay.js
// (handleLeads). English value first — that is what Notion filters on — then the
// Arabic label the client actually sees. If the database's select values change,
// these change with them; a label drifting from its value is a silent no-match.
export const SECTORS = [
  ["Contracting & Construction", "المقاولات والإنشاءات"],
  ["Manufacturing & Industry", "التصنيع والصناعة"],
  ["Healthcare", "الرعاية الصحية"],
  ["IT & Services", "التقنية والخدمات"],
  ["Logistics & Transport", "اللوجستيات والنقل"],
  ["Retail & Restaurants", "التجزئة والمطاعم"],
  ["Real Estate", "العقار"],
  ["Hospitality & Tourism", "الضيافة والسياحة"],
  ["Finance & Insurance", "التمويل والتأمين"],
  ["Education", "التعليم"],
  ["Defense & Security", "الدفاع والأمن"],
];

export const CITIES = [
  ["Riyadh", "الرياض"],
  ["Jeddah", "جدة"],
  ["Makkah", "مكة المكرمة"],
  ["Madinah", "المدينة المنورة"],
  ["Dammam", "الدمام"],
  ["Tabuk", "تبوك"],
  ["Abha", "أبها"],
];

const SECTOR_VALUES = new Set(SECTORS.map(([v]) => v));
const CITY_VALUES = new Set(CITIES.map(([v]) => v));

// Accept either the canonical value or the Arabic label, and always store the
// canonical value. The browser sends what the client clicked; the server decides
// what it means. Anything unrecognised is dropped rather than stored, because a
// sector the database has never heard of is not a filter, it is a dead row.
function canonical(list, allowed) {
  const byLabel = new Map();
  for (const [value, label] of list) {
    byLabel.set(value.toLowerCase(), value);
    byLabel.set(label, value);
  }
  return (raw) => {
    const s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    if (allowed.has(s)) return s;
    return byLabel.get(s) || byLabel.get(s.toLowerCase()) || "";
  };
}
const toSector = canonical(SECTORS, SECTOR_VALUES);
const toCity = canonical(CITIES, CITY_VALUES);

export const MAX_SECTORS = 6;
export const MAX_CITIES = 7;
const MAX_TEXT = 4000;

const clean = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

function pickList(raw, map, max) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const v = map(item);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Normalise whatever the browser posted into a row we are willing to store.
 * @param {object} input
 * @returns {{servicesText:string,idealCustomer:string,targetSectors:string[],targetCities:string[]}}
 */
export function normalizeProfile(input) {
  const b = input || {};
  return {
    servicesText: clean(b.servicesText, MAX_TEXT),
    idealCustomer: clean(b.idealCustomer, MAX_TEXT),
    targetSectors: pickList(b.targetSectors, toSector, MAX_SECTORS),
    targetCities: pickList(b.targetCities, toCity, MAX_CITIES),
  };
}

/**
 * How much of the profile is usable, as a percentage. This is not decoration:
 * matching needs at least one sector and some description of what the client
 * sells, so the number tells the client what is still missing rather than
 * congratulating them for a blank form.
 */
export function profileCompleteness(p) {
  if (!p) return 0;
  let score = 0;
  if ((p.servicesText || "").length >= 40) score += 35;
  else if ((p.servicesText || "").length > 0) score += 15;
  if ((p.targetSectors || []).length) score += 30;
  if ((p.targetCities || []).length) score += 10;
  if ((p.idealCustomer || "").length >= 30) score += 10;
  if (p.profilePath) score += 15;
  return Math.min(100, score);
}

/** Matching can run at all only once we know what to look for. */
export function canMatch(p) {
  return !!(p && (p.targetSectors || []).length > 0);
}

// What we ask the model to pull out of the uploaded company profile. It fills
// gaps, it does not overrule the client: whatever they typed themselves wins in
// mergeExtracted below. A profile deck is marketing copy, and treating it as
// authoritative over the client's own words is how the sector list ends up
// describing the brochure instead of the business.
export const PROFILE_READ_PROMPT = [
  "You are reading a company profile for a Saudi B2B business-development service.",
  "Return ONLY a JSON object, no prose, with these keys:",
  '  "summaryAr": string  — 2-3 sentences in Arabic on what this company actually sells.',
  '  "servicesAr": string[] — up to 8 concrete services or products, in Arabic.',
  '  "sectorsServed": string[] — which of these exact values the company sells INTO:',
  "      " + SECTORS.map(([v]) => v).join(", "),
  '  "keywordsAr": string[] — up to 12 Arabic search terms a buyer would use.',
  "Use only what the document supports. Use an empty array when it says nothing.",
].join("\n");

/**
 * Fold model-extracted fields into the stored profile without letting them
 * overwrite anything the client wrote by hand.
 */
export function mergeExtracted(profile, extracted) {
  const p = { ...(profile || {}) };
  const x = extracted || {};
  const arr = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()) : []);

  if (!p.servicesText && typeof x.summaryAr === "string") p.servicesText = clean(x.summaryAr, MAX_TEXT);
  p.extractedServices = arr(x.servicesAr).map((s) => clean(s, 160)).slice(0, 8);
  p.extractedKeywords = arr(x.keywordsAr).map((s) => clean(s, 60)).slice(0, 12);

  // Sectors the deck claims are only a suggestion until the client has picked
  // none of their own — the target list drives real outreach.
  const suggested = pickList(arr(x.sectorsServed), toSector, MAX_SECTORS);
  p.suggestedSectors = suggested;
  if (!(p.targetSectors || []).length) p.targetSectors = suggested;
  return p;
}

/** The Arabic label for a stored canonical value, for display back to a client. */
export function sectorLabel(value) {
  const hit = SECTORS.find(([v]) => v === value);
  return hit ? hit[1] : value || "";
}
export function cityLabel(value) {
  const hit = CITIES.find(([v]) => v === value);
  return hit ? hit[1] : value || "";
}
