// Business Partner — برنامج السماسرة والإحالات (brokers & referrals), ESM.
//
// A broker (سمسار / مُحيل) sends us a company they know. When that company
// becomes a paying client the broker earns a commission. Three surfaces sit
// on this one module:
//   /referral        public   — the referral form (works with or without an account)
//   /broker-portal   broker   — sign up, referral link, pipeline, commissions
//   /brokers-admin   owner    — approve, move stages, compute and pay commissions
//
// Storage is deliberately two-headed:
//   * Supabase is the SOURCE OF TRUTH (db/schema.sql: brokers, referrals,
//     referral_commissions, broker_payouts, referral_events, commission_plans).
//     Money must be a ledger with constraints, and Notion is neither.
//   * Notion is a best-effort MIRROR so the sales team keeps working where it
//     already works. A failed mirror never fails the request — the row is
//     already safe in Postgres and `notion_page_id` stays null for a retry.
// With Supabase off, the public form still captures the lead (e-mail + Notion)
// rather than dropping it; the broker portal is the only part that hard-fails,
// because an account and a ledger cannot be faked in an inbox.
//
// Routes (all under /api/referrals, rewritten to /api/requests?__route=referrals)
//   POST {type:"referral", ...}                    public — submit a referral
//   POST {type:"signup"|"login"|"email-code"|"email-verify"}  broker auth
//   POST {type:"save-profile", email, code, ...}   broker — payout + profile
//   GET  ?action=me&email=&code=                   broker — profile + totals
//   GET  ?action=referrals&email=&code=            broker — its pipeline + ledger
//   GET  ?action=plans                             public — the commission ladder
//   GET  ?action=admin&key=                        owner  — everything
//   POST {type:"referral-status", key, id, status, dealValue}   owner
//   POST {type:"commission-add", key, referralId, period}       owner
//   POST {type:"commission-decision", key, id, decision}        owner
//   POST {type:"payout", key, brokerId, ids, reference}         owner
//   POST {type:"plan-save"|"broker-status", key, ...}           owner
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_KEY (required for the portal),
//      RESEND_API_KEY, OTP_FROM_EMAIL, BP_NOTIFY_EMAIL, OTP_SECRET,
//      PANEL_KEY/LEADS_KEY (owner), NOTION_TOKEN, NOTION_BROKERS_DB,
//      NOTION_REFERRALS_DB.
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th serverless
// function — the plan caps at 12 and this repo is at the cap.

import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { DB_ON, sb } from "./_db.js";

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const NOTION_VERSION = "2022-06-28";
const BROKERS_DB = (process.env.NOTION_BROKERS_DB || "").trim();
const REFERRALS_DB = (process.env.NOTION_REFERRALS_DB || "").trim();
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const NOTIFY = process.env.BP_NOTIFY_EMAIL || "business@businesspartner.sa";
const OWNER_KEY = envFrom(["PANEL_KEY", "LEADS_KEY", "DASHBOARD_KEY"]);
const OTP_SECRET = (process.env.OTP_SECRET || "").trim();
const SITE = (process.env.SITE_URL || "https://businesspartner.sa").replace(/\/+$/, "");
const AGREEMENT_VERSION = "2026-08-broker-v1";

/* ------------------------------------------------------------- utilities -- */
const clip = (s, n = 400) => String(s == null ? "" : s).trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const digits = (s) => String(s || "").replace(/\D+/g, "");
const nowIso = () => new Date().toISOString();
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const enc = (v) => encodeURIComponent(String(v));

// Saudi mobiles arrive as 05…, 5…, 9665… or +9665… — store one shape so the
// same person is one person however they typed it.
export function normPhone(v) {
  let d = digits(v);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return d ? "966" + d : "";
}

// The company's identity for dedupe: its domain when we have a URL (two
// people referring "شركة الرياض" mean the same company only if the domain
// matches), otherwise the squashed name.
// Legal-form words that carry no identity: two people naming the same firm
// with and without "شركة" must land on the same key. Spelled as they come out
// of the normalisation inside dedupeKey (ة → ه).
const COMPANY_STOPWORDS = new Set([
  "شركه", "شركات", "مؤسسه", "موسسه", "مجموعه", "مكتب", "وشركاه",
  "company", "co", "llc", "ltd", "limited", "est", "group", "corp", "inc", "the",
]);

export function dedupeKey({ companyName, companyUrl, contactEmail }) {
  const host = (() => {
    const raw = clip(companyUrl, 300);
    if (!raw) return "";
    try { return new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw).hostname.replace(/^www\./i, "").toLowerCase(); } catch { return ""; }
  })();
  const mailHost = isEmail(contactEmail) ? String(contactEmail).trim().toLowerCase().split("@")[1] : "";
  const FREE = new Set(["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "aol.com"]);
  if (host) return "d:" + host;
  if (mailHost && !FREE.has(mailHost)) return "d:" + mailHost;
  // Tokenise BEFORE squashing: \b is an ASCII word boundary and matches
  // nothing useful inside Arabic, so the legal-form words have to be dropped
  // as whole tokens. They are also matched after the letter normalisation
  // below — by then "شركة" is already "شركه", which is why the stop list is
  // spelled in its normalised form.
  const name = String(companyName || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")   // Arabic diacritics + tatweel
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .split(/[^a-z0-9\u0600-\u06FF]+/)
    .filter((t) => t && !COMPANY_STOPWORDS.has(t))
    .join("");
  return name ? "n:" + name : "";
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — these get read aloud on the phone
function token(len, prefix) {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return prefix + out;
}
const makeBrokerCode = () => token(8, "BP-RF-");
const makeAccessCode = () => token(10, "BP-BK-");
const makeRef = () => "BP-R-" + String(randomBytes(3).readUIntBE(0, 3) % 1000000).padStart(6, "0");

// Salted scrypt, "salt:hash" — the same scheme the supplier and agency
// portals use. Readable by anyone with DB access and still not reversible.
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
function passwordOk(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  try {
    const want = Buffer.from(hash, "hex");
    const got = scryptSync(pw, salt, 64);
    return want.length === got.length && timingSafeEqual(want, got);
  } catch { return false; }
}
const eqConst = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

// Stateless e-mail sign-in: the code goes to the broker's inbox, an HMAC over
// (email, code, expiry) goes to their browser. Neither half alone opens the
// door, so no pending-code table is needed.
const sealCode = (email, code, exp) => createHmac("sha256", OTP_SECRET).update(`rf-verify|${email}|${code}|${exp}`).digest("hex");
function sealOk(email, code, tokenStr, exp) {
  if (!OTP_SECRET || !email || !code || !tokenStr || !exp) return false;
  if (Date.now() > Number(exp)) return false;
  const want = Buffer.from(sealCode(email, code, exp)), got = Buffer.from(String(tokenStr));
  return want.length === got.length && timingSafeEqual(want, got);
}

const ownerOk = (key) => !!OWNER_KEY && eqConst(String(key || "").trim(), OWNER_KEY);

async function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

/* --------------------------------------------------- the commission engine -- */
// Pure, dependency-free and exported so tests/referrals-commission.test.mjs
// can pin every model without a database. Everything the owner panel offers
// resolves to one of four models; a hybrid ("500 ريال + 5%") is the model
// plus `bonusFlat`, not a fifth model.

export const COMMISSION_MODELS = ["first_invoice_pct", "recurring_pct", "flat", "tiered"];
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

// The rate for a deal of this size. Tiers are read as "up to and including",
// and the last tier (upTo null) catches everything above the ladder.
export function tierRateFor(tiers, amount) {
  const list = (Array.isArray(tiers) ? tiers : [])
    .map((t) => ({ upTo: t && (t.upTo === null || t.upTo === undefined || t.upTo === "") ? Infinity : Number(t.upTo), rate: Number(t && t.rate) || 0 }))
    .filter((t) => !Number.isNaN(t.upTo))
    .sort((a, b) => a.upTo - b.upTo);
  if (!list.length) return 0;
  const v = Number(amount) || 0;
  for (const t of list) if (v <= t.upTo) return t.rate;
  return list[list.length - 1].rate;
}

// Normalise a plan row (DB, snapshot or hand-written) into the shape the
// engine reads, so a snapshot taken months ago still computes.
export function normalizePlan(p) {
  const src = p && typeof p === "object" ? p : {};
  const model = COMMISSION_MODELS.includes(src.model) ? src.model : "first_invoice_pct";
  return {
    key: src.key || "",
    nameAr: src.name_ar || src.nameAr || "",
    nameEn: src.name_en || src.nameEn || "",
    model,
    rate: Number(src.rate) || 0,
    flatAmount: Number(src.flat_amount != null ? src.flat_amount : src.flatAmount) || 0,
    bonusFlat: Number(src.bonus_flat != null ? src.bonus_flat : src.bonusFlat) || 0,
    tiers: Array.isArray(src.tiers) ? src.tiers : [],
    recurringMonths: Number(src.recurring_months != null ? src.recurring_months : src.recurringMonths) || 0,
    minDealValue: Number(src.min_deal_value != null ? src.min_deal_value : src.minDealValue) || 0,
    maxAmount: src.max_amount != null ? Number(src.max_amount) : (src.maxAmount != null ? Number(src.maxAmount) : null),
    currency: src.currency || "SAR",
    attributionDays: Number(src.attribution_days != null ? src.attribution_days : src.attributionDays) || 90,
  };
}

// What is owed for one payment event.
//   dealValue    — the amount actually paid in this event (the basis)
//   periodIndex  — 0 for the first payment, 1 for the second month, …
// Returns null when nothing is due (below the floor, or past the recurring
// window, or a one-off plan asked for a second time) rather than a zero row,
// so the ledger never fills with noise.
export function commissionFor(plan, { dealValue = 0, periodIndex = 0 } = {}) {
  const p = normalizePlan(plan);
  const basis = Number(dealValue) || 0;
  const i = Math.max(0, Number(periodIndex) || 0);
  if (basis <= 0 && p.model !== "flat") return null;
  if (basis < p.minDealValue) return null;

  let kind = "", rate = 0, amount = 0;
  if (p.model === "first_invoice_pct") {
    if (i > 0) return null;
    kind = "first_invoice"; rate = p.rate; amount = (basis * rate) / 100;
  } else if (p.model === "recurring_pct") {
    if (p.recurringMonths > 0 && i >= p.recurringMonths) return null;
    kind = i === 0 ? "first_invoice" : "recurring"; rate = p.rate; amount = (basis * rate) / 100;
  } else if (p.model === "flat") {
    if (i > 0) return null;
    kind = "flat"; rate = 0; amount = p.flatAmount;
  } else if (p.model === "tiered") {
    if (i > 0) return null;
    kind = "tier"; rate = tierRateFor(p.tiers, basis); amount = (basis * rate) / 100;
  }

  // The hybrid bonus rides on the first payment only.
  if (i === 0 && p.bonusFlat > 0) amount += p.bonusFlat;
  if (p.maxAmount != null && !Number.isNaN(p.maxAmount) && amount > p.maxAmount) amount = p.maxAmount;
  amount = roundMoney(amount);
  if (amount <= 0) return null;
  return { kind, rate, basis: roundMoney(basis), amount, currency: p.currency, bonusApplied: i === 0 && p.bonusFlat > 0 ? p.bonusFlat : 0 };
}

// A broker's money, split the way the portal shows it. Void rows are dropped
// and never counted — they exist only for the audit trail.
export function totalsFor(commissions) {
  const t = { pending: 0, approved: 0, paid: 0, total: 0, currency: "SAR" };
  for (const c of commissions || []) {
    const amt = Number(c.amount) || 0;
    if (c.currency) t.currency = c.currency;
    if (c.status === "pending") t.pending += amt;
    else if (c.status === "approved") t.approved += amt;
    else if (c.status === "paid") t.paid += amt;
  }
  t.pending = roundMoney(t.pending); t.approved = roundMoney(t.approved); t.paid = roundMoney(t.paid);
  t.total = roundMoney(t.pending + t.approved + t.paid);
  return t;
}

// A human sentence for the plan, used on the public page, in the welcome
// e-mail and in the portal — one description, not three that drift apart.
export function planSentence(plan, lang = "ar") {
  const p = normalizePlan(plan);
  const money = (n) => (lang === "ar" ? `${n} ريال` : `${n} ${p.currency}`);
  if (p.model === "first_invoice_pct") return lang === "ar" ? `${p.rate}% من قيمة أول فاتورة مدفوعة للعميل المُحال` : `${p.rate}% of the referred client's first paid invoice`;
  if (p.model === "recurring_pct") {
    const span = p.recurringMonths > 0
      ? (lang === "ar" ? `لمدة ${p.recurringMonths} شهراً` : `for ${p.recurringMonths} months`)
      : (lang === "ar" ? "طوال بقاء العميل مشتركاً" : "for as long as the client stays");
    return lang === "ar" ? `${p.rate}% من كل فاتورة مدفوعة ${span}` : `${p.rate}% of every paid invoice ${span}`;
  }
  if (p.model === "flat") return lang === "ar" ? `${money(p.flatAmount)} لكل صفقة تُغلق` : `${money(p.flatAmount)} per closed deal`;
  const rows = (p.tiers || []).map((t) => {
    const cap = t.upTo == null ? (lang === "ar" ? "وما فوق" : "and above") : (lang === "ar" ? `حتى ${t.upTo}` : `up to ${t.upTo}`);
    return `${cap}: ${t.rate}%`;
  });
  return (lang === "ar" ? "شرائح حسب حجم الصفقة — " : "Tiered by deal size — ") + rows.join(" · ");
}

/* ------------------------------------------------------------ integrations -- */
async function notion(path, method = "GET", body) {
  if (!NOTION_TOKEN) return { ok: false, status: 503, json: null };
  try {
    const r = await fetch("https://api.notion.com/v1/" + path, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) console.error("referrals notion", path, r.status, JSON.stringify(json).slice(0, 300));
    return { ok: r.ok, status: r.status, json };
  } catch (e) {
    console.error("referrals notion exception", String(e).slice(0, 200));
    return { ok: false, status: 500, json: null };
  }
}
const rt = (v) => (v ? [{ text: { content: clip(v, 1900) } }] : []);

// Mirror a referral into Notion. Best effort by design: the caller does not
// await a failure into the response, and a missing NOTION_REFERRALS_DB simply
// turns the mirror off rather than erroring on every submission.
async function mirrorReferral(row, brokerName) {
  if (!NOTION_TOKEN || !REFERRALS_DB) return "";
  const p = {
    "الشركة المُحالة": { title: rt(row.company_name) },
    "المرجع": { rich_text: rt(row.ref) },
    "المُحيل": { rich_text: rt(brokerName || row.referrer_name) },
    "بريد المُحيل": { email: isEmail(row.referrer_email) ? row.referrer_email : null },
    "جوال المُحيل": { phone_number: row.referrer_phone || null },
    "جهة الاتصال": { rich_text: rt(row.contact_name) },
    "بريد جهة الاتصال": { email: isEmail(row.contact_email) ? row.contact_email : null },
    "جوال جهة الاتصال": { phone_number: row.contact_phone || null },
    "المسمى الوظيفي": { rich_text: rt(row.contact_title) },
    "الموقع": { url: row.company_url || null },
    "حجم الشركة": { rich_text: rt(row.company_size) },
    "طبيعة العلاقة": { rich_text: rt(row.relationship) },
    "سبب الترشيح": { rich_text: rt(row.why_need) },
    "الحالة": { select: { name: STATUS_AR[row.status] || "جديدة" } },
  };
  const r = await notion("pages", "POST", { parent: { database_id: REFERRALS_DB }, properties: p });
  return r.ok && r.json ? r.json.id : "";
}

async function mirrorBroker(row) {
  if (!NOTION_TOKEN || !BROKERS_DB) return "";
  const r = await notion("pages", "POST", {
    parent: { database_id: BROKERS_DB },
    properties: {
      "الاسم": { title: rt(row.full_name) },
      "كود الإحالة": { rich_text: rt(row.code) },
      "البريد": { email: isEmail(row.email) ? row.email : null },
      "الجوال": { phone_number: row.phone || null },
      "المدينة": { rich_text: rt(row.city) },
      "الصفة": { select: { name: row.kind === "company" ? "منشأة" : "فرد" } },
      "الحالة": { select: { name: row.status === "suspended" ? "موقوف" : "نشط" } },
    },
  });
  return r.ok && r.json ? r.json.id : "";
}

async function updateMirrorStatus(pageId, status) {
  if (!NOTION_TOKEN || !pageId) return;
  await notion(`pages/${pageId}`, "PATCH", { properties: { "الحالة": { select: { name: STATUS_AR[status] || "جديدة" } } } });
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("referrals email", r.status, (await r.text()).slice(0, 200));
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

const wrap = (inner) => `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;line-height:1.8">${inner}
  <hr style="border:none;border-top:1px solid #E4E7F0;margin:22px 0">
  <p style="color:#6a7085;font-size:13px">Business Partner · بيزنس بارتنر — ${esc(SITE.replace(/^https?:\/\//, ""))}</p></div>`;

/* ------------------------------------------------------------------ status -- */
export const STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost", "duplicate", "expired"];
const STATUS_AR = {
  new: "جديدة", contacted: "تم التواصل", qualified: "مؤهلة", proposal: "عرض سعر",
  won: "صفقة مغلقة", lost: "خسارة", duplicate: "مكررة", expired: "منتهية",
};
export const statusLabel = (s) => STATUS_AR[s] || s;

/* -------------------------------------------------------------- data layer -- */
const need = (res) => { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_off", message: "قاعدة البيانات غير مهيأة — أضف SUPABASE_URL و SUPABASE_SERVICE_KEY." })); };

const PLAN_COLS = "id,key,name_ar,name_en,model,rate,flat_amount,bonus_flat,tiers,recurring_months,min_deal_value,max_amount,currency,attribution_days,active,is_default,notes";
const BROKER_PUBLIC = "id,code,full_name,email,phone,city,kind,company_name,status,plan_id,bank_name,payout_method,agreement_accepted_at,created_at,last_login_at";

async function defaultPlan() {
  const rows = await sb(`commission_plans?is_default=is.true&active=is.true&select=${PLAN_COLS}&limit=1`).catch(() => []);
  if (rows && rows.length) return rows[0];
  const any = await sb(`commission_plans?active=is.true&select=${PLAN_COLS}&order=created_at.asc&limit=1`).catch(() => []);
  return any && any.length ? any[0] : null;
}
async function planById(id) {
  if (!id) return null;
  const rows = await sb(`commission_plans?id=eq.${enc(id)}&select=${PLAN_COLS}&limit=1`).catch(() => []);
  return rows && rows.length ? rows[0] : null;
}
async function brokerByEmail(email) {
  if (!isEmail(email)) return null;
  const rows = await sb(`brokers?email=eq.${enc(String(email).trim().toLowerCase())}&select=*&limit=1`).catch(() => []);
  return rows && rows.length ? rows[0] : null;
}
async function brokerByCode(code) {
  const c = clip(code, 40).toUpperCase();
  if (!c) return null;
  const rows = await sb(`brokers?code=eq.${enc(c)}&select=*&limit=1`).catch(() => []);
  return rows && rows.length ? rows[0] : null;
}

// Every broker request carries (email, access code). The code is compared
// against its sha256 in the row, so the stored value is useless if read.
async function authBroker(email, code) {
  if (!DB_ON) return { ok: false, status: 503, error: "db_off" };
  const b = await brokerByEmail(email);
  if (!b) return { ok: false, status: 401, error: "bad_credentials" };
  if (!b.access_code_hash || !eqConst(sha(clip(code, 60).toUpperCase()), b.access_code_hash)) return { ok: false, status: 401, error: "bad_credentials" };
  if (b.status === "suspended") return { ok: false, status: 403, error: "suspended" };
  return { ok: true, broker: b };
}

async function logEvent(entry) {
  if (!DB_ON) return;
  try { await sb("referral_events", { method: "POST", body: [entry], prefer: "return=minimal" }); } catch {}
}

const publicBroker = (b, plan) => ({
  id: b.id, code: b.code, name: b.full_name, email: b.email, phone: b.phone || "", city: b.city || "",
  kind: b.kind, companyName: b.company_name || "", status: b.status,
  bankName: b.bank_name || "", ibanLast4: b.iban ? String(b.iban).replace(/\s+/g, "").slice(-4) : "",
  payoutMethod: b.payout_method || "bank",
  idNumber: b.id_number ? "•••" + String(b.id_number).slice(-3) : "",
  agreementAcceptedAt: b.agreement_accepted_at || null,
  link: `${SITE}/ar/referral?r=${encodeURIComponent(b.code)}`,
  plan: plan ? { key: plan.key, nameAr: plan.name_ar, nameEn: plan.name_en, model: plan.model, sentenceAr: planSentence(plan, "ar"), sentenceEn: planSentence(plan, "en") } : null,
});

const publicReferral = (r) => ({
  id: r.id, ref: r.ref, company: r.company_name, contact: r.contact_name || "", title: r.contact_title || "",
  size: r.company_size || "", url: r.company_url || "", status: r.status, statusAr: statusLabel(r.status),
  dealValue: Number(r.deal_value) || 0, currency: r.currency || "SAR",
  createdAt: r.created_at, closedAt: r.closed_at || null, expiresAt: r.expires_at || null,
  lostReason: r.lost_reason || "",
});

/* ------------------------------------------------------------ the handler -- */
export async function handleReferrals(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  /* ============================================================== GET ==== */
  if (req.method === "GET") {
    const action = (q.get("action") || "").trim();

    // The public commission ladder — what /brokers shows, straight from the
    // owner's own table so the marketing page can never quote a stale rate.
    if (action === "plans") {
      if (!DB_ON) return send(200, { ok: true, plans: [] });
      const rows = await sb(`commission_plans?active=is.true&select=${PLAN_COLS}&order=is_default.desc,created_at.asc`).catch(() => []);
      return send(200, {
        ok: true,
        plans: (rows || []).map((p) => ({
          key: p.key, nameAr: p.name_ar, nameEn: p.name_en, model: p.model, isDefault: !!p.is_default,
          sentenceAr: planSentence(p, "ar"), sentenceEn: planSentence(p, "en"),
          attributionDays: p.attribution_days, currency: p.currency,
        })),
      });
    }

    // Does this referral link belong to anyone? Used by the form to greet the
    // broker by name — it returns a name, never contact details.
    if (action === "broker-by-code") {
      if (!DB_ON) return send(200, { ok: false });
      const b = await brokerByCode(q.get("code"));
      if (!b || b.status === "suspended") return send(200, { ok: false });
      return send(200, { ok: true, name: b.full_name, code: b.code });
    }

    if (action === "me") {
      const auth = await authBroker(q.get("email"), q.get("code"));
      if (!auth.ok) return send(auth.status, { ok: false, error: auth.error });
      const plan = (await planById(auth.broker.plan_id)) || (await defaultPlan());
      const commissions = await sb(`referral_commissions?broker_id=eq.${enc(auth.broker.id)}&select=amount,currency,status`).catch(() => []);
      return send(200, { ok: true, broker: publicBroker(auth.broker, plan), totals: totalsFor(commissions) });
    }

    if (action === "referrals") {
      const auth = await authBroker(q.get("email"), q.get("code"));
      if (!auth.ok) return send(auth.status, { ok: false, error: auth.error });
      const [refs, commissions, payouts] = await Promise.all([
        sb(`referrals?broker_id=eq.${enc(auth.broker.id)}&select=*&order=created_at.desc&limit=300`).catch(() => []),
        sb(`referral_commissions?broker_id=eq.${enc(auth.broker.id)}&select=*&order=created_at.desc&limit=300`).catch(() => []),
        sb(`broker_payouts?broker_id=eq.${enc(auth.broker.id)}&select=*&order=created_at.desc&limit=50`).catch(() => []),
      ]);
      const byRef = new Map();
      for (const c of commissions || []) {
        if (!byRef.has(c.referral_id)) byRef.set(c.referral_id, []);
        byRef.get(c.referral_id).push({ id: c.id, kind: c.kind, period: c.period || "", amount: Number(c.amount) || 0, rate: Number(c.rate) || 0, basis: Number(c.basis_amount) || 0, status: c.status, currency: c.currency, paidAt: c.paid_at || null });
      }
      return send(200, {
        ok: true,
        referrals: (refs || []).map((r) => ({ ...publicReferral(r), commissions: byRef.get(r.id) || [] })),
        totals: totalsFor(commissions),
        payouts: (payouts || []).map((p) => ({ id: p.id, amount: Number(p.amount) || 0, currency: p.currency, status: p.status, reference: p.reference || "", createdAt: p.created_at, paidAt: p.paid_at || null })),
      });
    }

    // ---- owner: brokers, the whole pipeline, the ledger and the plans ----
    if (action === "admin") {
      if (!ownerOk(q.get("key"))) return send(403, { ok: false, error: "forbidden" });
      if (!DB_ON) return need(res);
      const [brokers, refs, commissions, payouts, plans] = await Promise.all([
        sb(`brokers?select=${BROKER_PUBLIC},iban,id_number,notes&order=created_at.desc&limit=500`).catch(() => []),
        sb("referrals?select=*&order=created_at.desc&limit=500").catch(() => []),
        sb("referral_commissions?select=*&order=created_at.desc&limit=500").catch(() => []),
        sb("broker_payouts?select=*&order=created_at.desc&limit=200").catch(() => []),
        sb(`commission_plans?select=${PLAN_COLS}&order=created_at.asc`).catch(() => []),
      ]);
      const nameById = new Map((brokers || []).map((b) => [b.id, b.full_name]));
      return send(200, {
        ok: true,
        brokers: (brokers || []).map((b) => ({
          id: b.id, code: b.code, name: b.full_name, email: b.email, phone: b.phone || "", city: b.city || "",
          kind: b.kind, companyName: b.company_name || "", status: b.status, planId: b.plan_id || "",
          bankName: b.bank_name || "", iban: b.iban || "", idNumber: b.id_number || "", notes: b.notes || "",
          createdAt: b.created_at, lastLoginAt: b.last_login_at || null,
        })),
        referrals: (refs || []).map((r) => ({
          ...publicReferral(r),
          brokerId: r.broker_id || "", brokerName: r.broker_id ? nameById.get(r.broker_id) || "" : r.referrer_name || "",
          referrerEmail: r.referrer_email || "", referrerPhone: r.referrer_phone || "",
          contactEmail: r.contact_email || "", contactPhone: r.contact_phone || "",
          relationship: r.relationship || "", whyNeed: r.why_need || "", orderRef: r.order_ref || "",
          planId: r.plan_id || "", source: r.source,
        })),
        commissions: (commissions || []).map((c) => ({
          id: c.id, referralId: c.referral_id, brokerId: c.broker_id || "", brokerName: c.broker_id ? nameById.get(c.broker_id) || "" : "",
          kind: c.kind, period: c.period || "", basis: Number(c.basis_amount) || 0, rate: Number(c.rate) || 0,
          amount: Number(c.amount) || 0, currency: c.currency, status: c.status, createdAt: c.created_at, paidAt: c.paid_at || null,
        })),
        payouts: (payouts || []).map((p) => ({ id: p.id, brokerId: p.broker_id, brokerName: nameById.get(p.broker_id) || "", amount: Number(p.amount) || 0, currency: p.currency, status: p.status, reference: p.reference || "", ibanLast4: p.iban_last4 || "", createdAt: p.created_at, paidAt: p.paid_at || null })),
        plans: (plans || []).map((p) => ({ ...p, sentenceAr: planSentence(p, "ar") })),
      });
    }

    return send(400, { ok: false, error: "unknown_action" });
  }

  if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
  const b = await readBody(req);
  const type = clip(b.type, 40);

  /* ====================================================== public: referral == */
  if (type === "referral") {
    const companyName = clip(b.companyName, 200);
    const referrerName = clip(b.referrerName, 120);
    const referrerEmail = clip(b.referrerEmail, 160).toLowerCase();
    if (!companyName) return send(400, { ok: false, error: "company_required", message: "اسم الشركة المُحال إليها مطلوب." });
    if (!referrerName || !isEmail(referrerEmail)) return send(400, { ok: false, error: "referrer_required", message: "اسمك وبريدك الإلكتروني مطلوبان." });

    const payload = {
      ref: makeRef(),
      referrer_name: referrerName,
      referrer_email: referrerEmail,
      referrer_phone: normPhone(b.referrerPhone),
      referrer_landline: normPhone(b.referrerLandline),
      referrer_city: clip(b.referrerCity, 80),
      company_name: companyName,
      company_url: clip(b.companyUrl, 300),
      contact_name: clip(b.contactName, 120),
      contact_email: clip(b.contactEmail, 160).toLowerCase(),
      contact_phone: normPhone(b.contactPhone),
      contact_landline: normPhone(b.contactLandline),
      contact_title: clip(b.contactTitle, 120),
      company_size: clip(b.companySize, 60),
      relationship: clip(b.relationship, 200),
      why_need: clip(b.whyNeed, 1500),
      services_interest: Array.isArray(b.services) ? b.services.slice(0, 12).map((s) => clip(s, 80)) : [],
      source: clip(b.source, 20) === "portal" ? "portal" : (clip(b.code, 40) ? "link" : "form"),
      status: "new",
    };
    payload.dedupe_key = dedupeKey({ companyName, companyUrl: payload.company_url, contactEmail: payload.contact_email });

    // Without a database the lead must still land somewhere a human reads.
    if (!DB_ON) {
      await Promise.all([
        sendEmail(NOTIFY, `إحالة جديدة — ${companyName}`, wrap(`<h2 style="color:#0B1B5A">إحالة جديدة (بدون قاعدة بيانات)</h2>
          <p><b>الشركة:</b> ${esc(companyName)} — ${esc(payload.company_url || "بدون رابط")}</p>
          <p><b>المُحيل:</b> ${esc(referrerName)} · ${esc(referrerEmail)} · ${esc(payload.referrer_phone)}</p>
          <p><b>جهة الاتصال:</b> ${esc(payload.contact_name)} (${esc(payload.contact_title)}) · ${esc(payload.contact_email)} · ${esc(payload.contact_phone)}</p>
          <p><b>العلاقة:</b> ${esc(payload.relationship)}</p><p><b>سبب الترشيح:</b> ${esc(payload.why_need)}</p>`)),
        mirrorReferral(payload, referrerName),
      ]);
      return send(200, { ok: true, ref: payload.ref, stored: false });
    }

    // Attribution: an explicit ?r= code wins; otherwise the referrer's own
    // e-mail claims the referral for their account if they have one.
    let broker = null;
    if (clip(b.code, 40)) broker = await brokerByCode(b.code);
    if (!broker) broker = await brokerByEmail(referrerEmail);
    if (broker && broker.status === "suspended") broker = null;
    if (broker) payload.broker_id = broker.id;

    // First valid referral of a company wins. A later one is kept (so the
    // second broker can see what happened) but marked duplicate and earns
    // nothing.
    if (payload.dedupe_key) {
      const clash = await sb(`referrals?dedupe_key=eq.${enc(payload.dedupe_key)}&status=neq.duplicate&select=id,ref,broker_id,created_at&limit=1`).catch(() => []);
      if (clash && clash.length) {
        payload.status = "duplicate";
        payload.dedupe_key = null; // the partial unique index only guards live rows
        payload.lost_reason = `مكررة — سبقتها الإحالة ${clash[0].ref}`;
      }
    }

    const plan = (broker && (await planById(broker.plan_id))) || (await defaultPlan());
    if (plan) {
      payload.plan_id = plan.id;
      payload.plan_snapshot = normalizePlan(plan);
      payload.currency = plan.currency || "SAR";
      const days = normalizePlan(plan).attributionDays;
      payload.expires_at = new Date(Date.now() + days * 86400000).toISOString();
    }

    let row;
    try {
      const ins = await sb("referrals", { method: "POST", body: [payload] });
      row = ins && ins[0];
    } catch {
      return send(500, { ok: false, error: "store_failed", message: "تعذّر حفظ الإحالة — حاول مرة أخرى." });
    }

    // Everything after the row exists is best-effort: the referral is already
    // safe, so a dead Notion token or mail provider must not fail the form.
    Promise.all([
      logEvent({ referral_id: row.id, broker_id: broker ? broker.id : null, kind: "created", to_value: row.status, actor: broker ? "broker" : "system", detail: { source: payload.source } }),
      mirrorReferral(row, broker ? broker.full_name : referrerName).then((pid) => (pid ? sb(`referrals?id=eq.${enc(row.id)}`, { method: "PATCH", body: { notion_page_id: pid }, prefer: "return=minimal" }) : null)),
      sendEmail(NOTIFY, `إحالة جديدة ${row.ref} — ${companyName}`, wrap(`<h2 style="color:#0B1B5A">إحالة جديدة</h2>
        <p><b>المرجع:</b> ${esc(row.ref)}${row.status === "duplicate" ? " — <span style=\"color:#b91c1c\">مكررة</span>" : ""}</p>
        <p><b>الشركة:</b> ${esc(companyName)} — ${esc(payload.company_url || "بدون رابط")} · ${esc(payload.company_size)}</p>
        <p><b>المُحيل:</b> ${esc(broker ? broker.full_name : referrerName)}${broker ? ` (كود ${esc(broker.code)})` : " — بدون حساب سمسار"} · ${esc(referrerEmail)} · ${esc(payload.referrer_phone)}</p>
        <p><b>جهة الاتصال:</b> ${esc(payload.contact_name)} (${esc(payload.contact_title)}) · ${esc(payload.contact_email)} · ${esc(payload.contact_phone)}</p>
        <p><b>العلاقة:</b> ${esc(payload.relationship)}</p><p><b>سبب الترشيح:</b> ${esc(payload.why_need)}</p>
        <p><a href="${SITE}/brokers-admin">افتح لوحة السماسرة</a></p>`)),
      sendEmail(referrerEmail, `استلمنا إحالتك ${row.ref}`, wrap(`<h2 style="color:#0B1B5A">شكراً لك 🌿</h2>
        <p>استلمنا إحالتك لشركة <b>${esc(companyName)}</b> برقم مرجعي <b>${esc(row.ref)}</b>.</p>
        ${row.status === "duplicate"
          ? `<p style="color:#b91c1c">لاحظنا أن هذه الشركة مُحالة إلينا مسبقاً، ولذلك لا تُحتسب عليها عمولة. أول إحالة صحيحة للشركة هي المعتمدة.</p>`
          : `<p>سنتواصل مع الشركة خلال يومي عمل، وتقدر تتابع مرحلة الإحالة وعمولتها من بوابة السماسرة.</p>
             ${plan ? `<p><b>عمولتك على هذه الإحالة:</b> ${esc(planSentence(plan, "ar"))}</p>` : ""}
             <p><a href="${SITE}/ar/broker-portal">افتح بوابة السماسرة</a>${broker ? "" : " — أنشئ حسابك لمتابعة إحالاتك وعمولاتك."}</p>`}`)),
    ]).catch(() => {});

    return send(200, { ok: true, ref: row.ref, stored: true, duplicate: row.status === "duplicate", plan: plan ? planSentence(plan, "ar") : "" });
  }

  /* ======================================================= broker: sign up == */
  if (type === "signup") {
    if (!DB_ON) return need(res);
    const name = clip(b.name, 120);
    const email = clip(b.email, 160).toLowerCase();
    const password = String(b.password || "");
    if (!name || !isEmail(email)) return send(400, { ok: false, error: "bad_input", message: "الاسم والبريد الإلكتروني مطلوبان." });
    if (password.length < 8) return send(400, { ok: false, error: "weak_password", message: "كلمة المرور ٨ أحرف على الأقل." });
    if (await brokerByEmail(email)) return send(409, { ok: false, error: "exists", message: "هذا البريد مسجّل — سجّل الدخول أو اطلب رمزاً على بريدك." });

    const plan = await defaultPlan();
    const accessCode = makeAccessCode();
    const row = {
      code: makeBrokerCode(), full_name: name, email,
      phone: normPhone(b.phone), city: clip(b.city, 80),
      kind: clip(b.kind, 20) === "company" ? "company" : "individual",
      company_name: clip(b.companyName, 200),
      password_hash: hashPassword(password),
      access_code_hash: sha(accessCode),
      plan_id: plan ? plan.id : null,
      status: "active",
      agreement_version: AGREEMENT_VERSION,
      agreement_accepted_at: b.agreement ? nowIso() : null,
      last_login_at: nowIso(),
    };
    let broker;
    try {
      const ins = await sb("brokers", { method: "POST", body: [row] });
      broker = ins && ins[0];
    } catch {
      return send(500, { ok: false, error: "store_failed", message: "تعذّر إنشاء الحساب — حاول مرة أخرى." });
    }

    // Any referral this person already sent by e-mail, before they had an
    // account, becomes theirs the moment the account exists.
    const claimed = await sb(`referrals?referrer_email=eq.${enc(email)}&broker_id=is.null&select=id`, { method: "GET" }).catch(() => []);
    if (claimed && claimed.length) {
      await sb(`referrals?referrer_email=eq.${enc(email)}&broker_id=is.null`, { method: "PATCH", body: { broker_id: broker.id }, prefer: "return=minimal" }).catch(() => {});
    }

    Promise.all([
      mirrorBroker(broker).then((pid) => (pid ? sb(`brokers?id=eq.${enc(broker.id)}`, { method: "PATCH", body: { notion_page_id: pid }, prefer: "return=minimal" }) : null)),
      sendEmail(email, "حسابك في برنامج السماسرة جاهز ✅", wrap(`<h2 style="color:#0B1B5A">أهلاً ${esc(name)} 👋</h2>
        <p>حسابك في برنامج السماسرة والإحالات جاهز الآن.</p>
        <p><b>كود الإحالة الخاص بك:</b></p>
        <p style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#0B1B5A">${esc(broker.code)}</p>
        <p><b>رابط الإحالة:</b> <a href="${SITE}/ar/referral?r=${esc(broker.code)}">${esc(SITE)}/ar/referral?r=${esc(broker.code)}</a></p>
        <p><b>رمز الدخول الاحتياطي للبوابة:</b> <span style="letter-spacing:2px">${esc(accessCode)}</span> — احتفظ به، لن نعرضه مرة أخرى.</p>
        ${plan ? `<p><b>عمولتك:</b> ${esc(planSentence(plan, "ar"))}</p>` : ""}
        ${claimed && claimed.length ? `<p>ربطنا بحسابك ${claimed.length} إحالة سبق أن أرسلتها بنفس بريدك.</p>` : ""}
        <p><a href="${SITE}/ar/broker-portal">افتح بوابتك</a></p>`)),
      sendEmail(NOTIFY, `سمسار جديد — ${name}`, wrap(`<p>انضم <b>${esc(name)}</b> (${esc(email)}) إلى برنامج السماسرة بكود ${esc(broker.code)}.</p>`)),
    ]).catch(() => {});

    return send(200, { ok: true, code: accessCode, broker: publicBroker(broker, plan), claimed: (claimed || []).length });
  }

  /* ========================================================= broker: log in == */
  if (type === "login") {
    if (!DB_ON) return need(res);
    const email = clip(b.email, 160).toLowerCase();
    const broker = await brokerByEmail(email);
    if (!broker) return send(401, { ok: false, error: "bad_credentials", message: "بيانات الدخول غير صحيحة." });
    if (broker.status === "suspended") return send(403, { ok: false, error: "suspended", message: "الحساب موقوف — تواصل معنا." });

    const givenCode = clip(b.code, 60).toUpperCase();
    const byCode = givenCode && broker.access_code_hash && eqConst(sha(givenCode), broker.access_code_hash);
    const byPass = b.password && passwordOk(String(b.password), broker.password_hash);
    if (!byCode && !byPass) return send(401, { ok: false, error: "bad_credentials", message: "بيانات الدخول غير صحيحة." });

    // A password sign-in has to hand back a working bearer code, and the old
    // one is a hash we cannot read — so issue a fresh one and store its hash.
    let code = givenCode;
    if (!byCode) {
      code = makeAccessCode();
      await sb(`brokers?id=eq.${enc(broker.id)}`, { method: "PATCH", body: { access_code_hash: sha(code), last_login_at: nowIso() }, prefer: "return=minimal" }).catch(() => {});
    } else {
      await sb(`brokers?id=eq.${enc(broker.id)}`, { method: "PATCH", body: { last_login_at: nowIso() }, prefer: "return=minimal" }).catch(() => {});
    }
    const plan = (await planById(broker.plan_id)) || (await defaultPlan());
    return send(200, { ok: true, code, broker: publicBroker(broker, plan) });
  }

  // Forgotten password: a six-digit code to the inbox, its HMAC to the browser.
  if (type === "email-code") {
    if (!DB_ON) return need(res);
    if (!OTP_SECRET) return send(503, { ok: false, error: "otp_off", message: "الدخول بالرمز غير مفعّل حالياً." });
    const email = clip(b.email, 160).toLowerCase();
    const broker = await brokerByEmail(email);
    // Same answer either way — the form must not reveal who has an account.
    if (broker && broker.status !== "suspended") {
      const code = String(randomBytes(3).readUIntBE(0, 3) % 1000000).padStart(6, "0");
      const exp = Date.now() + 15 * 60 * 1000;
      await sendEmail(email, `رمز الدخول: ${code}`, wrap(`<h2 style="color:#0B1B5A">رمز الدخول لبوابة السماسرة</h2>
        <p style="font-size:28px;font-weight:bold;letter-spacing:8px;color:#0B1B5A">${code}</p><p>صالح ١٥ دقيقة.</p>`));
      return send(200, { ok: true, exp, token: sealCode(email, code, exp) });
    }
    return send(200, { ok: true, exp: Date.now() + 15 * 60 * 1000, token: "" });
  }

  if (type === "email-verify") {
    if (!DB_ON) return need(res);
    const email = clip(b.email, 160).toLowerCase();
    if (!sealOk(email, clip(b.otp, 10), b.token, b.exp)) return send(401, { ok: false, error: "bad_code", message: "رمز غير صحيح أو منتهي." });
    const broker = await brokerByEmail(email);
    if (!broker) return send(401, { ok: false, error: "bad_credentials" });
    if (broker.status === "suspended") return send(403, { ok: false, error: "suspended" });
    const code = makeAccessCode();
    await sb(`brokers?id=eq.${enc(broker.id)}`, { method: "PATCH", body: { access_code_hash: sha(code), last_login_at: nowIso() }, prefer: "return=minimal" }).catch(() => {});
    const plan = (await planById(broker.plan_id)) || (await defaultPlan());
    return send(200, { ok: true, code, broker: publicBroker(broker, plan) });
  }

  /* ==================================================== broker: own profile == */
  if (type === "save-profile") {
    const auth = await authBroker(b.email, b.code);
    if (!auth.ok) return send(auth.status, { ok: false, error: auth.error });
    const patch = {
      full_name: clip(b.name, 120) || auth.broker.full_name,
      phone: normPhone(b.phone) || auth.broker.phone,
      landline: normPhone(b.landline),
      city: clip(b.city, 80),
      kind: clip(b.kind, 20) === "company" ? "company" : "individual",
      company_name: clip(b.companyName, 200),
      company_cr: digits(b.companyCr).slice(0, 20),
      id_number: digits(b.idNumber).slice(0, 20),
      bank_name: clip(b.bankName, 120),
      payout_method: ["bank", "wallet", "credit"].includes(clip(b.payoutMethod, 10)) ? clip(b.payoutMethod, 10) : "bank",
      updated_at: nowIso(),
    };
    // An IBAN is only overwritten when a new one is actually typed, so saving
    // the rest of the form never wipes the payout details.
    const iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase();
    if (iban) {
      if (!/^SA\d{22}$/.test(iban)) return send(400, { ok: false, error: "bad_iban", message: "الآيبان السعودي يبدأ بـ SA ويتكوّن من ٢٤ خانة." });
      patch.iban = iban;
    }
    if (b.agreement && !auth.broker.agreement_accepted_at) {
      patch.agreement_accepted_at = nowIso();
      patch.agreement_version = AGREEMENT_VERSION;
    }
    if (b.password) {
      if (String(b.password).length < 8) return send(400, { ok: false, error: "weak_password", message: "كلمة المرور ٨ أحرف على الأقل." });
      patch.password_hash = hashPassword(String(b.password));
    }
    const upd = await sb(`brokers?id=eq.${enc(auth.broker.id)}`, { method: "PATCH", body: patch }).catch(() => null);
    const broker = (upd && upd[0]) || { ...auth.broker, ...patch };
    const plan = (await planById(broker.plan_id)) || (await defaultPlan());
    return send(200, { ok: true, broker: publicBroker(broker, plan) });
  }

  /* ============================================================ owner: ops == */
  if (!ownerOk(b.key)) return send(403, { ok: false, error: "forbidden" });
  if (!DB_ON) return need(res);

  // Move a referral along the pipeline. Closing it as won with a deal value
  // is what mints the first commission row — one place, so a stage move can
  // never quietly skip the ledger.
  if (type === "referral-status") {
    const id = clip(b.id, 60);
    const status = clip(b.status, 20);
    if (!id || !STATUSES.includes(status)) return send(400, { ok: false, error: "bad_input" });
    const rows = await sb(`referrals?id=eq.${enc(id)}&select=*&limit=1`).catch(() => []);
    if (!rows || !rows.length) return send(404, { ok: false, error: "not_found" });
    const r = rows[0];

    const patch = { status, updated_at: nowIso() };
    if (b.dealValue != null && b.dealValue !== "") patch.deal_value = Math.max(0, Number(b.dealValue) || 0);
    if (b.orderRef != null) patch.order_ref = clip(b.orderRef, 60);
    if (b.lostReason != null) patch.lost_reason = clip(b.lostReason, 300);
    if (status === "contacted" && !r.first_contact_at) patch.first_contact_at = nowIso();
    if (status === "won" || status === "lost") patch.closed_at = nowIso();

    const upd = await sb(`referrals?id=eq.${enc(id)}`, { method: "PATCH", body: patch }).catch(() => null);
    const after = (upd && upd[0]) || { ...r, ...patch };

    let commission = null;
    if (status === "won" && after.broker_id) {
      const dealValue = Number(after.deal_value) || 0;
      const plan = (after.plan_snapshot && Object.keys(after.plan_snapshot).length ? after.plan_snapshot : null) || (await planById(after.plan_id)) || (await defaultPlan());
      const calc = commissionFor(plan, { dealValue, periodIndex: 0 });
      if (calc) {
        // The unique (referral_id, kind, period) constraint makes re-closing a
        // deal idempotent: the second attempt is rejected, not doubled.
        try {
          const ins = await sb("referral_commissions", { method: "POST", body: [{
            referral_id: after.id, broker_id: after.broker_id, kind: calc.kind, period: null,
            basis_amount: calc.basis, rate: calc.rate, amount: calc.amount, currency: calc.currency,
            status: "pending", invoice_ref: clip(b.orderRef, 60) || after.order_ref || null,
          }] });
          commission = ins && ins[0] ? { id: ins[0].id, amount: calc.amount, kind: calc.kind, rate: calc.rate } : null;
        } catch { commission = null; }
      }
    }

    logEvent({ referral_id: after.id, broker_id: after.broker_id || null, kind: "status", from_value: r.status, to_value: status, actor: "owner", detail: { dealValue: after.deal_value, commission } });
    updateMirrorStatus(r.notion_page_id, status).catch(() => {});

    // Tell the broker their own news — good or bad, in their own words.
    if (after.broker_id && ["contacted", "qualified", "won", "lost"].includes(status)) {
      const bro = await sb(`brokers?id=eq.${enc(after.broker_id)}&select=full_name,email&limit=1`).catch(() => []);
      const to = bro && bro[0] ? bro[0].email : "";
      if (to) {
        const body = status === "won"
          ? `<h2 style="color:#16a34a">مبروك 🎉</h2><p>أُغلقت صفقة <b>${esc(after.company_name)}</b> (${esc(after.ref)}).</p>${commission ? `<p><b>عمولتك:</b> ${commission.amount} ريال — بانتظار الاعتماد.</p>` : "<p>سنوافيك بتفاصيل العمولة قريباً.</p>"}`
          : status === "lost"
            ? `<h2 style="color:#0B1B5A">تحديث إحالتك</h2><p>لم تكتمل صفقة <b>${esc(after.company_name)}</b> (${esc(after.ref)}).</p><p>${esc(after.lost_reason || "")}</p>`
            : `<h2 style="color:#0B1B5A">تحديث إحالتك</h2><p>إحالتك <b>${esc(after.company_name)}</b> (${esc(after.ref)}) صارت: <b>${esc(statusLabel(status))}</b>.</p>`;
        sendEmail(to, `تحديث الإحالة ${after.ref} — ${statusLabel(status)}`, wrap(body + `<p><a href="${SITE}/ar/broker-portal">افتح بوابتك</a></p>`)).catch(() => {});
      }
    }
    return send(200, { ok: true, referral: publicReferral(after), commission });
  }

  // A recurring plan earns again every period. The owner (or a monthly job
  // calling this same route) adds the next period against the amount actually
  // paid that month.
  if (type === "commission-add") {
    const id = clip(b.referralId, 60);
    const rows = await sb(`referrals?id=eq.${enc(id)}&select=*&limit=1`).catch(() => []);
    if (!rows || !rows.length) return send(404, { ok: false, error: "not_found" });
    const r = rows[0];
    if (!r.broker_id) return send(400, { ok: false, error: "no_broker", message: "الإحالة غير مرتبطة بسمسار." });
    const period = clip(b.period, 7) || new Date().toISOString().slice(0, 7);
    const existing = await sb(`referral_commissions?referral_id=eq.${enc(r.id)}&select=id,period,kind`).catch(() => []);
    const periodIndex = (existing || []).length;
    const plan = (r.plan_snapshot && Object.keys(r.plan_snapshot).length ? r.plan_snapshot : null) || (await planById(r.plan_id)) || (await defaultPlan());
    const basis = b.amount != null && b.amount !== "" ? Number(b.amount) || 0 : Number(r.deal_value) || 0;
    const calc = commissionFor(plan, { dealValue: basis, periodIndex });
    if (!calc) return send(400, { ok: false, error: "nothing_due", message: "لا تستحق هذه الخطة عمولة إضافية لهذه الفترة." });
    try {
      const ins = await sb("referral_commissions", { method: "POST", body: [{
        referral_id: r.id, broker_id: r.broker_id, kind: calc.kind === "first_invoice" ? "recurring" : calc.kind, period,
        basis_amount: calc.basis, rate: calc.rate, amount: calc.amount, currency: calc.currency, status: "pending",
        invoice_ref: clip(b.invoiceRef, 60) || null,
      }] });
      logEvent({ referral_id: r.id, broker_id: r.broker_id, kind: "commission", to_value: String(calc.amount), actor: "owner", detail: { period } });
      return send(200, { ok: true, commission: ins && ins[0] });
    } catch {
      return send(409, { ok: false, error: "duplicate_period", message: "هذه الفترة مسجّلة مسبقاً لهذه الإحالة." });
    }
  }

  if (type === "commission-decision") {
    const id = clip(b.id, 60);
    const decision = clip(b.decision, 20);
    if (!["approve", "void", "reopen"].includes(decision)) return send(400, { ok: false, error: "bad_input" });
    const patch = decision === "approve"
      ? { status: "approved", approved_by: "owner", approved_at: nowIso() }
      : decision === "void"
        ? { status: "void", notes: clip(b.notes, 300) || null }
        : { status: "pending", approved_at: null, approved_by: null };
    const upd = await sb(`referral_commissions?id=eq.${enc(id)}&status=neq.paid`, { method: "PATCH", body: patch }).catch(() => null);
    if (!upd || !upd.length) return send(409, { ok: false, error: "not_updatable", message: "لا يمكن تعديل عمولة مدفوعة." });
    logEvent({ referral_id: upd[0].referral_id, broker_id: upd[0].broker_id, kind: "commission", to_value: patch.status, actor: "owner" });
    return send(200, { ok: true, commission: upd[0] });
  }

  // Pay a batch. Only approved rows are payable, and the payout amount is the
  // SUM OF THOSE ROWS — never a number typed into the panel — so the ledger
  // and the transfer can't disagree.
  if (type === "payout") {
    const brokerId = clip(b.brokerId, 60);
    const ids = Array.isArray(b.ids) ? b.ids.map((x) => clip(x, 60)).filter(Boolean) : [];
    if (!brokerId || !ids.length) return send(400, { ok: false, error: "bad_input" });
    const rows = await sb(`referral_commissions?broker_id=eq.${enc(brokerId)}&status=eq.approved&id=in.(${ids.map(enc).join(",")})&select=id,amount,currency`).catch(() => []);
    if (!rows || !rows.length) return send(400, { ok: false, error: "nothing_payable", message: "لا توجد عمولات معتمدة ضمن المحدد." });
    const amount = roundMoney(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    const bro = await sb(`brokers?id=eq.${enc(brokerId)}&select=full_name,email,iban&limit=1`).catch(() => []);
    const broker = bro && bro[0];
    const ins = await sb("broker_payouts", { method: "POST", body: [{
      broker_id: brokerId, amount, currency: rows[0].currency || "SAR",
      method: clip(b.method, 20) || "bank",
      iban_last4: broker && broker.iban ? String(broker.iban).slice(-4) : null,
      reference: clip(b.reference, 120), status: clip(b.status, 20) === "pending" ? "pending" : "paid",
      notes: clip(b.notes, 300), paid_at: clip(b.status, 20) === "pending" ? null : nowIso(),
    }] }).catch(() => null);
    const payout = ins && ins[0];
    if (!payout) return send(500, { ok: false, error: "store_failed" });
    await sb(`referral_commissions?id=in.(${rows.map((r) => enc(r.id)).join(",")})`, {
      method: "PATCH", body: { status: payout.status === "paid" ? "paid" : "approved", payout_id: payout.id, paid_at: payout.status === "paid" ? nowIso() : null }, prefer: "return=minimal",
    }).catch(() => {});
    logEvent({ broker_id: brokerId, kind: "payout", to_value: String(amount), actor: "owner", detail: { payoutId: payout.id, count: rows.length } });
    if (broker && broker.email && payout.status === "paid") {
      sendEmail(broker.email, `تم صرف عمولاتك — ${amount} ريال`, wrap(`<h2 style="color:#16a34a">تم الصرف ✅</h2>
        <p>حوّلنا <b>${amount} ريال</b> عن ${rows.length} عمولة معتمدة.</p>
        ${payout.reference ? `<p><b>مرجع التحويل:</b> ${esc(payout.reference)}</p>` : ""}
        <p><a href="${SITE}/ar/broker-portal">تفاصيل الصرف في بوابتك</a></p>`)).catch(() => {});
    }
    return send(200, { ok: true, payout, count: rows.length, amount });
  }

  if (type === "broker-status") {
    const id = clip(b.id, 60);
    const patch = {};
    if (b.status && ["active", "pending", "suspended"].includes(clip(b.status, 20))) patch.status = clip(b.status, 20);
    if (b.planId !== undefined) patch.plan_id = clip(b.planId, 60) || null;
    if (b.notes !== undefined) patch.notes = clip(b.notes, 500);
    if (!id || !Object.keys(patch).length) return send(400, { ok: false, error: "bad_input" });
    patch.updated_at = nowIso();
    const upd = await sb(`brokers?id=eq.${enc(id)}`, { method: "PATCH", body: patch }).catch(() => null);
    if (!upd || !upd.length) return send(404, { ok: false, error: "not_found" });
    logEvent({ broker_id: id, kind: "broker", to_value: patch.status || "updated", actor: "owner" });
    return send(200, { ok: true });
  }

  // Plans are data, not code: the owner edits the ladder and the next referral
  // snapshots the new numbers. Existing referrals keep the terms they were
  // sold under.
  if (type === "plan-save") {
    const key = clip(b.planKey, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    const model = clip(b.model, 30);
    if (!key || !COMMISSION_MODELS.includes(model)) return send(400, { ok: false, error: "bad_input", message: "المفتاح ونموذج العمولة مطلوبان." });
    let tiers = [];
    if (model === "tiered") {
      const raw = Array.isArray(b.tiers) ? b.tiers : [];
      tiers = raw.slice(0, 10).map((t) => ({ upTo: t.upTo === "" || t.upTo == null ? null : Number(t.upTo), rate: Number(t.rate) || 0 }))
        .filter((t) => t.upTo === null || !Number.isNaN(t.upTo));
      if (!tiers.length) return send(400, { ok: false, error: "bad_tiers", message: "أضف شريحة واحدة على الأقل." });
    }
    const row = {
      key, name_ar: clip(b.nameAr, 160) || key, name_en: clip(b.nameEn, 160),
      model, rate: Number(b.rate) || 0, flat_amount: Number(b.flatAmount) || 0, bonus_flat: Number(b.bonusFlat) || 0,
      tiers, recurring_months: Math.max(0, parseInt(b.recurringMonths, 10) || 0),
      min_deal_value: Number(b.minDealValue) || 0,
      max_amount: b.maxAmount === "" || b.maxAmount == null ? null : Number(b.maxAmount),
      currency: clip(b.currency, 8) || "SAR",
      attribution_days: Math.max(1, parseInt(b.attributionDays, 10) || 90),
      active: b.active !== false, notes: clip(b.notes, 500), updated_at: nowIso(),
    };
    const existing = await sb(`commission_plans?key=eq.${enc(key)}&select=id&limit=1`).catch(() => []);
    if (existing && existing.length) await sb(`commission_plans?id=eq.${enc(existing[0].id)}`, { method: "PATCH", body: row, prefer: "return=minimal" });
    else await sb("commission_plans", { method: "POST", body: [row], prefer: "return=minimal" });
    // Exactly one default, enforced here as well as by the partial index.
    if (b.isDefault) {
      await sb("commission_plans?is_default=is.true", { method: "PATCH", body: { is_default: false }, prefer: "return=minimal" }).catch(() => {});
      await sb(`commission_plans?key=eq.${enc(key)}`, { method: "PATCH", body: { is_default: true }, prefer: "return=minimal" }).catch(() => {});
    }
    return send(200, { ok: true });
  }

  return send(400, { ok: false, error: "unknown_type" });
}
