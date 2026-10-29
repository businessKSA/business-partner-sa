// Business Partner — the quotation paper (template v3): what goes INTO it.
//
// api/_bp-docs-v3.js (frozen) only draws; it prices nothing and reads nothing but what it is given.
// This module is the other half, and it is NOT frozen: it decides what a given request puts on the
// paper, from sources that already exist —
//   • the order's lines: priced from the catalogue by SKU when the quotation was issued (issueQuote)
//   • each service's own page data (site/data/site.json overrides: scope, duration, documents — bilingual)
//   • the REV business-development packages: monthly fee FROM the catalogue (services.json), the rest
//     from the sales team's approved template (REV_MODEL below)
//   • the company (site/data/site.json → legal / contact / bank), the same place the site footer reads
//
// Everything the paper needs beyond the lines is written ONCE, when the quotation is issued, into
// `quote.doc` (a snapshot). Opening the quotation later renders from the stored lines + that snapshot,
// so a later change of a service page, the catalogue or the company address never rewrites a quotation
// the client already holds.
//
// Underscore-prefixed: a module, not a serverless function.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";
import { templateForVersion } from "./_bp-docs.js";
import { DEV } from "./_mode.js";

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (name) => { try { return JSON.parse(readFileSync(join(here, "..", "site", "data", name), "utf8")); } catch { return null; } };
let _sv = null, _site = null, _docMap = null;
const servicesFile = () => { if (!_sv) { const j = readJson("services.json"); _sv = Array.isArray(j) ? j : ((j && j.services) || []); } return _sv; };
const overrides = () => { if (!_site) _site = (readJson("site.json") || {}).overrides || {}; return _site; };
const norm = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
const clip = (t, n) => norm(t).slice(0, n);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The Arabic title of a document → its English title, from every service page's own list. */
function documentTranslations() {
  if (_docMap) return _docMap;
  _docMap = new Map();
  for (const o of Object.values(overrides())) {
    const ar = Array.isArray(o.documents) ? o.documents : [], en = Array.isArray(o.documentsEn) ? o.documentsEn : [];
    ar.forEach((a, i) => { const k = norm(a); if (k && en[i] && !_docMap.has(k)) _docMap.set(k, norm(en[i])); });
  }
  return _docMap;
}

// ───────────────────────────── REV packages ──────────────────────────────────
// The sales team's approved quotation (REV-quote-template-bilingual.html, 2026-10-29): which package
// gives what, and the revenue model. The MONTHLY FEE is not here — it is read from the catalogue.
// ⚠ The catalogue's own description of each package (services.json: «عمولات 10% + 2.5% …») differs
// from this revenue model (a tier by closed-deal value, not by package): see the report to the owner.
export const REV_CODES = ["REV-LAUNCH", "REV-GROWTH", "REV-PRO"];
export const REV_MODEL = {
  packages: [
    { code: "REV-LAUNCH", key: "LAUNCH", en: "Launch", ar: "الانطلاق", projectEn: "Up to 500,000", projectAr: "حتى 500,000", leads: 4, vendors: 4, meetings: 4, features: [1, 1, 0, 1, 0, 0, 0, 1, 1] },
    { code: "REV-GROWTH", key: "GROWTH", en: "Growth", ar: "النمو", projectEn: "1,000,000 to 5,000,000", projectAr: "من 1,000,000 إلى 5,000,000", leads: 8, vendors: 8, meetings: 8, features: [1, 1, 1, 1, 1, 0, 0, 1, 1] },
    { code: "REV-PRO", key: "PRO", en: "Pro", ar: "الاحترافية", projectEn: "5,000,000 to 10,000,000", projectAr: "من 5,000,000 إلى 10,000,000", leads: 16, vendors: 16, meetings: 16, features: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  ],
  tiers: [
    { en: "Up to 1,000,000", ar: "حتى 1,000,000", handover: "10%", closing: "12.5%" },
    { en: "1,000,000 to 5,000,000", ar: "من 1,000,000 إلى 5,000,000", handover: "5%", closing: "7.5%" },
    { en: "Above 5,000,000", ar: "أكثر من 5,000,000", handover: "2.5%", closing: "5%" },
  ],
};
function revSnapshot(lines) {
  const hit = lines.find((l) => REV_CODES.includes(String(l.code || "").toUpperCase()));
  if (!hit) return null;
  const fee = new Map(servicesFile().map((s) => [String(s.code || "").toUpperCase(), num(s.price && typeof s.price === "object" ? s.price.amount : s.price)]));
  // a package whose catalogue price is missing is NOT printed with an invented one: no REV pages at all
  const packages = REV_MODEL.packages.map((p) => ({ ...p, monthly: fee.get(p.code) || 0 }));
  if (packages.some((p) => !(p.monthly > 0))) return null;
  return { selected: String(hit.code).toUpperCase(), packages, tiers: REV_MODEL.tiers.map((t) => ({ ...t })) };
}

// ───────────────────────────── the snapshot ──────────────────────────────────
/**
 * What the quotation paper needs besides its lines, written when the quotation is issued.
 * @param {Array} lines  the quotation's priced lines ({code,title,…})
 * @param {{documents?: Array, company?: object, companySnapshot?: Function}} [opts] the request's documents list
 */
export function quoteDocSnapshot(lines, opts = {}) {
  const ov = overrides();
  const services = {}, docs = [], seen = new Set();
  const pushDoc = (ar, en) => { const k = norm(ar || en); if (!k || seen.has(k)) return; seen.add(k); docs.push({ ar: clip(ar || en, 200), en: clip(en || ar, 200) }); };
  for (const l of (Array.isArray(lines) ? lines : []).slice(0, 30)) {
    const code = String(l.code || "");
    const o = code ? ov[code.toLowerCase()] : null;
    if (!o) continue;
    services[code] = {
      featuresAr: (Array.isArray(o.features) ? o.features : []).slice(0, 8).map((x) => clip(x, 160)),
      featuresEn: (Array.isArray(o.featuresEn) ? o.featuresEn : []).slice(0, 8).map((x) => clip(x, 160)),
      durationAr: clip(o.duration, 120), durationEn: clip(o.durationEn, 120),
    };
    const ar = Array.isArray(o.documents) ? o.documents : [], en = Array.isArray(o.documentsEn) ? o.documentsEn : [];
    ar.forEach((a, i) => pushDoc(a, en[i]));
  }
  // what the request itself asks the client for (the advisor's list, edited by the team): kept after the
  // service pages' own lists, with the English title when a service page already has the same document
  const tr = documentTranslations();
  for (const d of (Array.isArray(opts.documents) ? opts.documents : []).slice(0, 25)) {
    const t = norm(d && (d.title || d)); if (t) pushDoc(t, tr.get(t) || "");
  }
  const snap = { v: 1, services, documents: docs.slice(0, 25), pending: pendingForDoc(opts.pending), hasNda: !!opts.hasNda };
  const rev = revSnapshot(lines || []);
  if (rev) snap.rev = rev;
  const tpl = templateForVersion("v3");
  snap.company = opts.company || (tpl && tpl.companySnapshot()) || undefined;
  return snap;
}

// ───────────────────────────── the input of the paper ────────────────────────
const REASON_EN = {
  custom: "a line written by the customer, no catalogue price", unknown_code: "service code not in the catalogue", proposal: "priced after studying the case",
  from: "catalogue lists a «starting from» price only", recurring: "recurring subscription", percent: "calculated as a percentage", no_price: "no catalogue price",
};
export const pendingForDoc = (list) => (Array.isArray(list) ? list : []).map((h) => ({ title: String(h.title || ""), reasonAr: String(h.reason_ar || ""), reasonEn: REASON_EN[h.reason] || REASON_EN.no_price })).filter((h) => h.title);

/**
 * The argument of quoteDocV3 for a request's quotation (or for one of its addenda).
 * @param {object} row the request row  @param {string} clientName partyName(row)
 * @param {{addendum?: object}} [opts]
 */
export function quoteDocInput(row, clientName, opts = {}) {
  const base = row.quote || {};
  const ad = opts.addendum || null;
  const src = ad || base;
  return {
    kind: ad ? "addendum" : "quote", ref: row.ref, number: src.number, baseNumber: ad ? base.number : "",
    clientName, issuedAt: src.created_at, validityDays: src.validity_days, validUntil: src.valid_until || "",
    items: src.items, net: src.net, vat: src.vat, total: src.total,
    paymentTerms: src.payment_terms || base.payment_terms || "", notes: src.notes || "", clientNotes: ad ? "" : (base.client_notes || ""),
    // as issued: the lines that were waiting and whether an NDA existed then (older snapshots fall back to today's state)
    pending: ad ? [] : (base.doc && Array.isArray(base.doc.pending) ? base.doc.pending : pendingForDoc(base.pending_items)),
    hasNda: base.doc && "hasNda" in base.doc ? !!base.doc.hasNda : !!row.nda,
    doc: ad ? { ...(ad.doc || {}), company: (ad.doc && ad.doc.company) || (base.doc && base.doc.company) } : (base.doc || {}),
  };
}

// ───────────────────────────── the public link ───────────────────────────────
// A link the CLIENT can open without signing in again (from a phone, forwarded to a colleague, printed
// to PDF at the accountant's), for READING the quotation paper only: approving, signing and paying still
// need the account. The same idea as the booking link (api/_booking.js manageToken):
//   • the link IS the key — an HMAC over (request ref, quotation number) with the server secret
//     (OTP_SECRET), 192 bits; without the secret no link exists, so nothing guessable is ever handed out
//   • it is bound to the quotation NUMBER, so re-issuing the quotation (a revision: Q-…-R) retires the old link
//   • it dies 30 days after the quotation's own validity ends, and with a cancelled request
//   • every failure answers the same 404 — a stranger cannot learn which references exist
//   • read-only, no cookies, no-store, noindex, no framing; throttled per address
//   • it is shown to the signed-in client inside /my; it is not e-mailed unless the owner decides so
// QUOTE_PUBLIC_LINK=0 switches the whole door off.
const secret = () => String(process.env.OTP_SECRET || "").trim() || (DEV ? "dev-quote-secret" : "");
export const quoteLinkEnabled = () => process.env.QUOTE_PUBLIC_LINK !== "0" && !!secret();
export function quoteLinkToken(ref, number) {
  const s = secret();
  if (!s || !ref || !number) return "";
  return crypto.createHmac("sha256", s).update(`quote-public|${ref}|${number}`).digest("base64url").slice(0, 32);
}
/** Is `token` the key of this request's CURRENT quotation, and is the door still open? */
export function quoteLinkOk(row, token, now = Date.now()) {
  if (process.env.QUOTE_PUBLIC_LINK === "0") return false;
  const q = row && row.quote;
  if (!q || !q.number || q.status === "DRAFT" || row.status === "CANCELLED") return false;
  const want = quoteLinkToken(row.ref, q.number), got = String(token || "");
  if (!want || want.length !== got.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got))) return false;
  const until = Date.parse(`${q.valid_until || ""}T23:59:59+03:00`);
  return !Number.isFinite(until) || now <= until + 30 * 864e5;
}
export function quotePublicUrl(row, base) {
  if (!quoteLinkEnabled() || !row || !row.quote || !row.quote.number || row.quote.status === "DRAFT") return "";
  const t = quoteLinkToken(row.ref, row.quote.number);
  return t ? `${String(base || "").replace(/\/+$/, "")}/api/simple?action=quote-public&ref=${encodeURIComponent(row.ref)}&t=${t}` : "";
}
const hits = new Map();
/** 30 openings per 10 minutes per address (in memory: a brake on guessing, not an accounting). */
export function quoteLinkThrottle(key, now = Date.now()) {
  const arr = (hits.get(key) || []).filter((t) => now - t < 600e3);
  if (arr.length >= 30) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 600e3) hits.delete(k);
  return true;
}
export const _resetQuoteLinkThrottle = () => hits.clear();
