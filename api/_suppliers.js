// Business Partner — supplier portal + supplier control panel (ESM).
//
// Replaces the mock partner dashboard, which authenticated nobody (any email
// was accepted) and whose "client requests" feed read the visitor's OWN
// localStorage orders — so a real supplier always saw an empty list and
// registrations landed in the customer CRM as untyped leads.
//
// Two Notion databases back this (under "Core Operating Databases"):
//   Suppliers      — the registry. A supplier can only sign in once the owner
//                    sets الحالة = معتمد, which emails them their access code.
//   SupplierOrders — one work order per assignment, carrying BOTH billing
//                    directions: قيمة أمر العمل is what the owner pays the
//                    supplier (they upload their invoice against it), and
//                    قيمة العمولة is what the owner invoices the supplier for.
//
// Routes
//   POST {type:"register"}                     public  — supplier signs up
//   POST {type:"login", email, code}           supplier
//   GET  ?action=orders&email=&code=           supplier — their work orders
//   POST {type:"order-update", ...}            supplier — status + invoice upload
//   GET  ?action=admin&key=                    owner   — registry + all orders
//   POST {type:"approve", key, ...}            owner   — approve/suspend + email code
//   POST {type:"assign", key, ...}             owner   — create a work order
//   POST {type:"invoice", key, ...}            owner   — issue the commission invoice
//
// Env: NOTION_TOKEN, RESEND_API_KEY, OTP_FROM_EMAIL, BOOKING_EMAIL,
//      LEADS_KEY/PANEL_KEY (owner actions), NOTION_SUPPLIERS_DB,
//      NOTION_SUPPLIER_ORDERS_DB.
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th serverless
// function — the plan caps at 12. /api/suppliers is rewritten to
// /api/requests?__route=suppliers, which delegates here.

import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomInt, createHash } from "crypto";
import { daftraConfigured, daftraFindOrCreateSupplier, daftraCreatePurchaseOrder, daftraCreateInvoice, daftraDocPdf } from "./_daftra.js";
import { docusignConfigured, docusignSendContract, docusignStatus, docusignPing, contractHtml } from "./_docusign.js";
import { announce, contactForRef, stageChannels, waSend } from "./_stage.js";
import { DB_ON, storagePut, storageSign } from "./_db.js";
import { ownerTicketOk, panelRequiresNafath } from "./_nafath.js";

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const NOTION_VERSION = "2022-06-28";
const SUPPLIERS_DB = process.env.NOTION_SUPPLIERS_DB || "d60933ed446e40ee8bcb8a640d5bcb52";
const ORDERS_DB = process.env.NOTION_SUPPLIER_ORDERS_DB || "fde498d5974c48f5a0ca9f21de4c0caf";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";
const SITE = process.env.MKT_SITE_BASE || "https://www.businesspartner.sa";
// Business Partner's cut of the site price on any service a supplier executes.
// Per-supplier overrides live in «نسبة العمولة %» on their registry row.
const DEFAULT_COMMISSION = Number(process.env.SUPPLIER_COMMISSION_PCT || 20);
// A verified registration opens the portal straight away: the supplier can see
// the catalogue and what each service pays them. Approval still gates being
// awarded work — «معتمد» is what the owner grants, and only an approved
// supplier appears in the assignment picker.
// Signs the stateless e-mail verification token. Reuses the same secret as the
// rest of the site so there is one secret to rotate, not two.
const OTP_SECRET = (process.env.OTP_SECRET || "").trim();
// Google Sign-In: the audience every ID token must be issued for.
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const CODE_TTL_MS = 15 * 60 * 1000;
// Same owner key that gates /monitor. ENV-ONLY: this repo is public, so a
// hardcoded fallback would be a public master key to the supplier registry.
const OWNER_KEYS = new Set([process.env.PANEL_KEY, process.env.LEADS_KEY, process.env.DASHBOARD_KEY].map((k) => String(k || "").trim()).filter(Boolean));
// Same gate as /api/requests: a Nafath ticket always opens it, the shared key
// only while PANEL_REQUIRE_NAFATH is off. Leaving this endpoint on the key
// alone would have made the identity requirement decorative — the supplier
// actions reach the same data by another route.
const ownerOk = (src) => {
  const s = src && typeof src === "object" ? src : { key: src };
  if (ownerTicketOk(s.ticket)) return true;
  if (panelRequiresNafath()) return false;
  return OWNER_KEYS.size > 0 && OWNER_KEYS.has(String(s.key || "").trim());
};

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const str = (v, n = 200) => String(v == null ? "" : v).trim().slice(0, n);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const row = (k, v) => `<tr><td style="padding:4px 10px;color:#666">${esc(k)}</td><td style="padding:4px 10px"><b>${esc(v || "—")}</b></td></tr>`;

// A short, unambiguous code: no O/0/I/1 so it survives being read over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(n) {
  let out = "";
  const bytes = randomBytes(n);
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Salted scrypt, stored as "salt:hash" in the "بيانات الدخول" property. Same
// scheme as api/employer.js — no npm dependency, and the stored value cannot
// be reversed into the password.
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
// Stateless e-mail verification: the code goes to the inbox, an HMAC over
// (email, code, expiry) goes to the browser. Neither alone is enough, so no
// pending-code table is needed.
const sealCode = (email, code, exp) => createHmac("sha256", OTP_SECRET).update(`sup-verify|${email}|${code}|${exp}`).digest("hex");
// A quote link is sent to one client's inbox, so holding the link is the
// authorisation — the same model DocuSign and Stripe use for a document sent
// by email. The token is derived from the order id, so it cannot be guessed
// and cannot be reused for another order.
const quoteToken = (orderId) => OTP_SECRET ? createHmac("sha256", OTP_SECRET).update(`quote|${orderId}`).digest("hex").slice(0, 32) : "";
function quoteTokenOk(orderId, t) {
  const want = quoteToken(orderId);
  if (!want || !t) return false;
  const a = Buffer.from(want), c = Buffer.from(String(t));
  return a.length === c.length && timingSafeEqual(a, c);
}
// Signing identity check. Same stateless model as the e-mail verification
// above: the code goes to the address on the CRM record, an HMAC over
// (order, code, expiry) goes to the browser. Holding one without the other
// proves nothing, so no pending-code table is needed — and the code can only
// ever sign the order it was issued for.
const sealSign = (orderId, code, exp) => createHmac("sha256", OTP_SECRET).update(`sign|${orderId}|${code}|${exp}`).digest("hex");
function signSealOk(orderId, code, token, exp) {
  if (!OTP_SECRET || !orderId || !code || !token || !exp) return false;
  if (Date.now() > Number(exp)) return false;
  const expected = Buffer.from(sealSign(orderId, String(code), String(exp)));
  const got = Buffer.from(String(token));
  return expected.length === got.length && timingSafeEqual(expected, got);
}
// The signature block appended to the contract. Kept in one place so the
// document the client sees, the document that is hashed and the document that
// is downloaded are the same bytes — a contract that renders differently on
// two screens is not evidence of anything.
const SIGN_MARK = "---BP-SIGNED---";
function signatureBlock(sig) {
  return `<hr style="margin:28px 0;border:0;border-top:1px solid #cbd5e1">
  <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right">
    <h3 style="color:#0B1B5A;margin:0 0 10px">التوقيع الإلكتروني</h3>
    <table style="border-collapse:collapse;font-size:13px">
      <tr><td style="padding:4px 10px;color:#64748b">الموقِّع</td><td style="padding:4px 10px"><b>${esc(sig.fullName)}</b></td></tr>
      ${sig.nationalId ? `<tr><td style="padding:4px 10px;color:#64748b">رقم الهوية / السجل</td><td style="padding:4px 10px"><b>${esc(sig.nationalId)}</b></td></tr>` : ""}
      <tr><td style="padding:4px 10px;color:#64748b">تاريخ التوقيع</td><td style="padding:4px 10px"><b>${esc(sig.at)}</b> (بتوقيت الرياض)</td></tr>
      <tr><td style="padding:4px 10px;color:#64748b">تحقُّق الهوية</td><td style="padding:4px 10px"><b>رمز لمرة واحدة أُرسل إلى ${esc(sig.emailMasked)}</b></td></tr>
      <tr><td style="padding:4px 10px;color:#64748b">بصمة المستند (SHA-256)</td><td style="padding:4px 10px;direction:ltr;text-align:left;font-family:monospace;font-size:11px">${esc(sig.hash)}</td></tr>
      ${sig.ip ? `<tr><td style="padding:4px 10px;color:#64748b">عنوان الشبكة</td><td style="padding:4px 10px;direction:ltr;text-align:left;font-family:monospace;font-size:11px">${esc(sig.ip)}</td></tr>` : ""}
    </table>
    ${sig.image ? `<div style="margin-top:12px"><div style="color:#64748b;font-size:12px;margin-bottom:4px">التوقيع:</div><img src="${esc(sig.image)}" alt="التوقيع" style="max-width:280px;border-bottom:1px solid #94a3b8"></div>` : ""}
    <p style="color:#64748b;font-size:11.5px;line-height:1.9;margin-top:14px">
      وُقِّع هذا المستند إلكترونياً وفق نظام التعاملات الإلكترونية السعودي. تحقُّق الهوية تمّ عبر رمز لمرة واحدة
      أُرسل إلى العنوان المسجَّل للعميل، وسُجِّلت بصمة المستند وتاريخ التوقيع وعنوان الشبكة لحظة التوقيع.
      أي تعديل لاحق على نص العقد يغيّر البصمة أعلاه ويكشف نفسه.
    </p>
  </div>`;
}
const VAT_PCT = Number(process.env.DAFTRA_VAT_RATE || 15);
function checkSealed(email, code, token, exp) {
  if (!OTP_SECRET || !code || !token || !exp) return false;
  if (Date.now() > Number(exp)) return false;
  const expected = Buffer.from(sealCode(email, code, exp));
  const got = Buffer.from(String(token));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// Verify a Google ID token against Google's published keys. Done by hand
// because google-auth-library is not a dependency and this repo deliberately
// adds none.
export async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) return null;
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch { return null; }
  if (header.alg !== "RS256") return null;
  let jwks;
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!r.ok) return null;
    jwks = await r.json();
  } catch { return null; }
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  let ok = false;
  try {
    const { createPublicKey, createVerify } = await import("crypto");
    const key = createPublicKey({ key: jwk, format: "jwk" });
    const v = createVerify("RSA-SHA256");
    v.update(parts[0] + "." + parts[1]);
    v.end();
    ok = v.verify(key, Buffer.from(parts[2], "base64url"));
  } catch { return null; }
  if (!ok) return null;
  const iss = payload.iss || "";
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
  if (payload.aud !== GOOGLE_CLIENT_ID) return null;
  if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
  if (payload.email_verified !== true && payload.email_verified !== "true") return null;
  if (!isEmail(payload.email)) return null;
  return { email: String(payload.email).toLowerCase(), name: payload.name || "", picture: payload.picture || "" };
}

async function notion(path, method = "GET", body) {
  if (!NOTION_TOKEN) return { ok: false, status: 503, json: null };
  try {
    const r = await fetch("https://api.notion.com/v1/" + path, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) console.error("notion", path, r.status, JSON.stringify(json).slice(0, 300));
    return { ok: r.ok, status: r.status, json };
  } catch (e) { console.error("notion exception", String(e).slice(0, 200)); return { ok: false, status: 500, json: null }; }
}

// attachments: [{ filename, content }] with content base64 — Resend's own shape.
async function sendEmail(to, subject, html, attachments) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(attachments && attachments.length ? { attachments } : {}) }),
    });
    if (!r.ok) console.error("Resend error", r.status, (await r.text()).slice(0, 200));
    return { ok: r.ok };
  } catch (e) { console.error("email exception", String(e).slice(0, 150)); return { ok: false }; }
}

async function uploadToNotion(base64, filename, contentType) {
  if (!NOTION_TOKEN || !base64) return null;
  try {
    const created = await notion("file_uploads", "POST", {});
    if (!created.ok || !created.json || !created.json.id) return null;
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(base64, "base64")], { type: contentType || "application/pdf" }), filename || "invoice.pdf");
    const send = await fetch(`https://api.notion.com/v1/file_uploads/${created.json.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION },
      body: form,
    });
    if (!send.ok) { console.error("notion upload send", send.status); return null; }
    return created.json.id;
  } catch (e) { console.error("upload exception", String(e).slice(0, 150)); return null; }
}

// ---- property readers (Notion page → plain object) ----
const txt = (p) => ((p && p.rich_text) || []).map((t) => t.plain_text).join("").trim();
const title = (p) => ((p && p.title) || []).map((t) => t.plain_text).join("").trim();
const sel = (p) => (p && p.select && p.select.name) || "";
const multi = (p) => ((p && p.multi_select) || []).map((o) => o.name);
const nnum = (p) => (p && typeof p.number === "number" ? p.number : null);

// The partner's own price list. It lives in the registry row's existing
// «الخدمات» text so no schema change is needed, appended after a marker so the
// free text they typed at registration is never overwritten by the builder.
const SVC_MARK = "---BP-SERVICES---";
function splitServices(raw) {
  const s = String(raw || "");
  const i = s.indexOf(SVC_MARK);
  if (i === -1) return { text: s.trim(), list: [] };
  let list = [];
  try { list = JSON.parse(s.slice(i + SVC_MARK.length).trim()) || []; } catch { list = []; }
  return { text: s.slice(0, i).trim(), list: Array.isArray(list) ? list : [] };
}
function joinServices(text, list) {
  const body = JSON.stringify((list || []).slice(0, 40));
  return `${String(text || "").trim()}\n${SVC_MARK}\n${body}`.trim();
}
// Notion caps a single rich_text object at 2000 characters, so a long list is
// written as several — one long string silently loses its tail.
function richChunks(v) {
  const s = String(v == null ? "" : v);
  const out = [];
  for (let i = 0; i < s.length && out.length < 24; i += 1900) out.push({ text: { content: s.slice(i, i + 1900) } });
  return out.length ? out : [{ text: { content: "" } }];
}

function supplierOf(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id,
    name: title(p["اسم المورّد"]),
    code: txt(p["كود المورّد"]),
    status: sel(p["الحالة"]),
    person: txt(p["المسؤول"]),
    phone: (p["الجوال"] && p["الجوال"].phone_number) || "",
    email: (p["البريد"] && p["البريد"].email) || "",
    city: txt(p["المدينة"]),
    cr: txt(p["السجل التجاري"]),
    vat: txt(p["الرقم الضريبي"]),
    categories: multi(p["التصنيف"]),
    services: splitServices(txt(p["الخدمات"])).text,
    priceList: splitServices(txt(p["الخدمات"])).list,
    iban: txt(p["الآيبان"]),
    terms: sel(p["شروط السداد"]),
    commission: nnum(p["نسبة العمولة %"]),
    notes: txt(p["ملاحظات"]),
    verified: !!(p["البريد موثّق"] && p["البريد موثّق"].checkbox),
    method: sel(p["طريقة الدخول"]),
    url: pg.url,
  };
}

// A quote's line items and the progress log ride in the order's notes after
// markers: the same trick as the price list, for the same reason — the schema
// is what it is, and the owner still reads plain text above the markers.
const LINE_MARK = "---BP-LINES---";
const LOG_MARK = "---BP-LOG---";
function splitLines(raw) {
  const s = String(raw || "");
  const iL = s.indexOf(LINE_MARK);
  const iG = s.indexOf(LOG_MARK);
  const cut = [iL, iG].filter((i) => i !== -1);
  const head = cut.length ? s.slice(0, Math.min(...cut)) : s;
  const grab = (mark) => {
    const i = s.indexOf(mark);
    if (i === -1) return [];
    const rest = s.slice(i + mark.length);
    const nextMarks = [rest.indexOf(LINE_MARK), rest.indexOf(LOG_MARK)].filter((x) => x !== -1);
    const body = nextMarks.length ? rest.slice(0, Math.min(...nextMarks)) : rest;
    try { const v = JSON.parse(body.trim()); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  return { text: head.trim(), lines: grab(LINE_MARK), log: grab(LOG_MARK) };
}
// One place that reassembles the field, so no writer can drop another's part.
function joinOrderNotes(text, lines, log) {
  return [
    String(text || "").trim(),
    (lines || []).length ? `${LINE_MARK}\n${JSON.stringify(lines)}` : "",
    (log || []).length ? `${LOG_MARK}\n${JSON.stringify((log || []).slice(-30))}` : "",
  ].filter(Boolean).join("\n");
}

function orderOf(pg) {
  const p = pg.properties || {};
  const n = splitLines(txt(p["ملاحظات"]));
  return {
    id: pg.id,
    ref: title(p["أمر العمل"]),
    supplierId: ((p["المورّد"] && p["المورّد"].relation) || []).map((r) => r.id)[0] || "",
    clientRef: txt(p["مرجع طلب العميل"]),
    client: txt(p["العميل"]),
    service: txt(p["الخدمة المطلوبة"]),
    details: txt(p["التفاصيل"]),
    city: txt(p["المدينة"]),
    status: sel(p["الحالة"]),
    due: (p["تاريخ التسليم"] && p["تاريخ التسليم"].date && p["تاريخ التسليم"].date.start) || "",
    amount: nnum(p["قيمة أمر العمل"]),
    supplierInvoiceStatus: sel(p["حالة فاتورة المورّد"]),
    commission: nnum(p["قيمة العمولة"]),
    commissionStatus: sel(p["حالة فاتورة العمولة"]),
    commissionRef: txt(p["رقم فاتورة العمولة"]),
    quote: nnum(p["قيمة العرض المقدّم"]),
    leadTime: txt(p["مدة التنفيذ المقترحة"]),
    quotedAt: (p["تاريخ تقديم العرض"] && p["تاريخ تقديم العرض"].date && p["تاريخ تقديم العرض"].date.start) || "",
    notes: n.text,
    lines: n.lines,
    log: n.log,
    url: pg.url,
  };
}

async function findSupplierByEmail(email) {
  const r = await notion(`databases/${SUPPLIERS_DB}/query`, "POST", {
    page_size: 1,
    filter: { property: "البريد", email: { equals: email } },
  });
  const pg = r.ok && r.json && r.json.results && r.json.results[0];
  return pg ? supplierOf(pg) : null;
}

// Supplier authentication. The account must exist, the password must match and
// the e-mail must be verified. Approval is NOT an access gate any more: an
// unapproved supplier can sign in and watch their own status, they just cannot
// receive work. Every failure returns one generic result so the endpoint can't
// be used to discover which e-mails are registered.
async function authSupplier(email, password) {
  const e = str(email, 160).toLowerCase();
  const pw = String(password == null ? "" : password);
  if (!isEmail(e) || !pw) return null;
  const s = await findSupplierByEmail(e);
  if (!s) return null;
  const r = await notion(`pages/${s.id}`);
  if (!r.ok || !r.json) return null;
  const stored = txt(r.json.properties["بيانات الدخول"]);
  if (!stored || !verifyPassword(pw, stored)) return null;
  return { ...s, verified: !!(r.json.properties["البريد موثّق"] && r.json.properties["البريد موثّق"].checkbox) };
}

async function ordersForSupplier(supplierId) {
  const r = await notion(`databases/${ORDERS_DB}/query`, "POST", {
    page_size: 100,
    filter: { property: "المورّد", relation: { contains: supplierId } },
    sorts: [{ property: "آخر تحديث", direction: "descending" }],
  });
  return r.ok && r.json ? (r.json.results || []).map(orderOf) : [];
}

// The client's journey, assembled for the refs their own portal already asks
// about. Read-only and keyed by the client's order reference, so a client sees
// progress on their own work and nothing else.
export async function progressForClientRefs(refs) {
  const list = (Array.isArray(refs) ? refs : []).filter(Boolean).slice(0, 20);
  if (!NOTION_TOKEN || !list.length) return {};
  const r = await notion(`databases/${ORDERS_DB}/query`, "POST", {
    page_size: 100,
    filter: { or: list.map((ref) => ({ property: "مرجع طلب العميل", rich_text: { equals: ref } })) },
  });
  if (!r.ok || !r.json) return {};
  const out = {};
  for (const pg of r.json.results || []) {
    const o = orderOf(pg);
    if (!o.clientRef) continue;
    const entries = (o.log || []).map((e) => ({ at: e.at, by: e.by, text: e.text }));
    if (!entries.length && !o.status) continue;
    // Several work orders can serve one client request; they merge into one
    // journey ordered by time, because that is how the client experienced it.
    out[o.clientRef] = (out[o.clientRef] || []).concat(entries);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return out;
}

// Quotes waiting on these clients' decision. The portal already asks about
// the refs it owns, so this rides on that question — a client sees decisions
// that belong to their own orders and nothing else.
//
// The token travels with the quote so the portal can act on it directly. It is
// the same token the emailed link carries, and it grants exactly one thing:
// deciding this one quote.
export async function quotesForClientRefs(refs) {
  const list = (Array.isArray(refs) ? refs : []).filter(Boolean).slice(0, 20);
  if (!NOTION_TOKEN || !list.length || !OTP_SECRET) return {};
  const r = await notion(`databases/${ORDERS_DB}/query`, "POST", {
    page_size: 100,
    filter: { or: list.map((ref) => ({ property: "مرجع طلب العميل", rich_text: { equals: ref } })) },
  });
  if (!r.ok || !r.json) return {};
  const out = {};
  for (const pg of r.json.results || []) {
    const o = orderOf(pg);
    if (!o.clientRef) continue;
    // Only a quote that has been put to the client and not yet answered.
    const pending = o.status === "عرض مُقدَّم" && (o.quote != null || (o.lines || []).length);
    if (!pending) continue;
    const net = (o.lines || []).length ? o.lines.reduce((t, l) => t + l.price * l.qty, 0) : (o.quote || 0);
    const vat = Math.round(net * (VAT_PCT / 100) * 100) / 100;
    (out[o.clientRef] = out[o.clientRef] || []).push({
      id: o.id, t: quoteToken(o.id), ref: o.ref, service: o.service,
      lines: o.lines || [], net: Math.round(net * 100) / 100, vatRate: VAT_PCT, vat,
      total: Math.round((net + vat) * 100) / 100, leadTime: o.leadTime, notes: publicNotes(o.notes),
    });
  }
  return out;
}

// Put the contract in front of the client. Extracted so the owner's button and
// the automatic path that follows an acceptance send the SAME document — a
// contract that differs depending on who triggered it is not one contract.
// The figures come off the order; nothing here reads a price from a browser.
async function sendContractFor(o, { email, clientName, clientCr, clientVat }) {
  const net = o.lines.length ? o.lines.reduce((t, l) => t + l.price * l.qty, 0) : (o.quote || 0);
  const vat = Math.round(net * (VAT_PCT / 100) * 100) / 100;
  let executor = "";
  if (o.supplierId) {
    const sp = await notion(`pages/${o.supplierId}`);
    if (sp.ok && sp.json) executor = supplierOf(sp.json).name;
  }
  const html = contractHtml({
    ref: o.clientRef || o.ref,
    clientName: str(clientName, 200) || o.client || "العميل",
    clientCr: str(clientCr, 40), clientVat: str(clientVat, 20),
    service: o.service, lines: o.lines,
    net: Math.round(net * 100) / 100, vat, total: Math.round((net + vat) * 100) / 100,
    vatRate: VAT_PCT, leadTime: o.leadTime, executor,
    today: new Date().toISOString().slice(0, 10),
  });
  const env = await docusignSendContract({
    ref: o.clientRef || o.ref, email,
    clientName: str(clientName, 200) || o.client || "العميل",
    subject: `عقد تقديم خدمات — ${o.clientRef || o.ref}`,
    html,
  });
  const log = (o.log || []).concat([{
    at: new Date().toISOString().slice(0, 16).replace("T", " "),
    by: "بيزنس بارتنر", text: `أُرسل العقد للتوقيع الإلكتروني إلى ${email}`,
  }]);
  await notion(`pages/${o.id}`, "PATCH", { properties: {
    "ملاحظات": { rich_text: richChunks(joinOrderNotes(`${o.notes}${o.notes ? "\n" : ""}DocuSign: ${env.envelopeId}`, o.lines, log)) },
  } });
  return { env, total: Math.round((net + vat) * 100) / 100 };
}

// Payment landed — online through the gateway, or a bank transfer the owner
// confirmed. Either way the client gets the same sentence, because from where
// they sit the money left and the work should start:
// «استلمنا المبلغ وجاري العمل على الخدمة».
//
// Exported so api/pay.js (gateway webhook) and the owner's panel both call one
// implementation; two implementations would eventually disagree about what
// "paid" means.
export async function markOrderPaid(clientRef, { total, method, note } = {}) {
  const ref = str(clientRef, 60);
  if (!ref || !NOTION_TOKEN) return { ok: false, error: "no_ref" };
  const r = await notion(`databases/${ORDERS_DB}/query`, "POST", {
    page_size: 1,
    filter: { property: "مرجع طلب العميل", rich_text: { equals: ref } },
  });
  const pg = r.ok && r.json && (r.json.results || [])[0];
  const how = method === "bank" ? "تحويل بنكي" : "دفع إلكتروني";
  let orderId = "", service = "", client = "";
  // Did THIS call record the payment? The gateway's browser callback and its
  // webhook both land here for the same payment, and the answer is what stops
  // the second one from invoicing the client twice.
  let recorded = false;
  if (pg) {
    const o = orderOf(pg);
    orderId = o.id; service = o.service; client = o.client;
    const already = (o.log || []).some((l) => /استلمنا المبلغ/.test(l.text || ""));
    if (!already) {
      recorded = true;
      const log = (o.log || []).concat([{
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        by: "بيزنس بارتنر",
        text: `استلمنا المبلغ (${how}${total != null ? ` — ${total} ﷼` : ""}) وجاري العمل على الخدمة${note ? " — " + note : ""}`,
      }]);
      const props = { "ملاحظات": { rich_text: richChunks(joinOrderNotes(o.notes, o.lines, log)) } };
      // Only move it forward — a delivered order does not go back to "in progress".
      if (o.status !== "تم التسليم" && o.status !== "مكتمل") props["الحالة"] = { select: { name: "قيد التنفيذ" } };
      await notion(`pages/${o.id}`, "PATCH", { properties: props });
    }
  }
  const notified = await announce({
    stage: "payment_received", clientRef: ref, orderId: orderId || undefined,
    name: client, service, total,
    extra: `طريقة السداد: ${how}`,
  }).catch(() => null);
  return { ok: true, orderFound: !!pg, recorded, notified };
}

// The client's decision on a quote, in one place. The portal's «الموافقات»
// card and the emailed link both land here, so approving in the portal and
// clicking the link do exactly the same thing to the same order.
//
// Nothing here can change money: the amount is read from the order, never from
// the browser that sent the decision.
export async function decideQuote({ id: rawId, t, decision, note: rawNote }) {
  const id = str(rawId, 60);
  if (!id || !quoteTokenOk(id, t)) return { error: "bad_link", status: 403 };
  const accept = decision === "accept" || decision === "approved";
  const pg = await notion(`pages/${id}`);
  if (!pg.ok || !pg.json) return { error: "not_found", status: 404 };
  const o = orderOf(pg.json);
  if (o.status === "مقبول من العميل" || o.status === "مرفوض من العميل") return { error: "already_decided", status: 409 };

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const note = str(rawNote, 300);
  const log = (o.log || []).concat([{
    at: stamp, by: "العميل",
    text: accept ? `قَبِل عرض السعر${note ? " — " + note : ""}` : `رفض عرض السعر${note ? " — " + note : ""}`,
  }]);
  const upd = await notion(`pages/${id}`, "PATCH", { properties: {
    "الحالة": { select: { name: accept ? "مقبول من العميل" : "مرفوض من العميل" } },
    "ملاحظات": { rich_text: richChunks(joinOrderNotes(o.notes, o.lines, log)) },
  } });
  if (!upd.ok) return { error: "save_failed", status: 502 };

  let supplierEmail = "";
  if (o.supplierId) {
    const sp = await notion(`pages/${o.supplierId}`);
    if (sp.ok && sp.json) supplierEmail = supplierOf(sp.json).email;
  }
  const subject = `${accept ? "✅ قُبل" : "❌ رُفض"} عرض السعر ${o.ref}`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
    <h2 style="color:#0B1B5A">${accept ? "العميل قَبِل عرض السعر" : "العميل رفض عرض السعر"}</h2>
    <table>${row("أمر العمل", o.ref) + row("الخدمة", o.service) + row("العميل", o.client) + row("طلب العميل", o.clientRef) + row("القيمة", (o.quote != null ? o.quote + " ﷼" : "—")) + (note ? row("ملاحظة العميل", note) : "")}</table>
    ${accept ? "<p><b>الخطوة التالية:</b> يُرسل للعميل العقد للتوقيع، ثم الفاتورة الضريبية للسداد.</p>" : ""}</div>`;
  await sendEmail(TEAM_EMAIL, subject, html);
  if (supplierEmail) await sendEmail(supplierEmail, subject, html);

  // The client is told their own decision landed — silence after clicking
  // «أوافق» is exactly what made this feel like a dead end.
  const net = o.lines.length ? o.lines.reduce((tt, l) => tt + l.price * l.qty, 0) : (o.quote || 0);
  const total = Math.round(net * (1 + VAT_PCT / 100) * 100) / 100;
  const contact = await contactForRef(o.clientRef).catch(() => ({ email: "", phone: "", name: "" }));
  const notified = await announce({
    stage: accept ? "quote_accepted" : "quote_declined",
    clientRef: o.clientRef, orderId: o.id, service: o.service, total,
    name: o.client, extra: note || "",
    // Straight back to the page they accepted on, which is where the signature
    // and the payment now live — not to a portal they have to navigate.
    url: accept && OTP_SECRET ? `${SITE}/ar/quote?id=${encodeURIComponent(o.id)}&t=${quoteToken(o.id)}` : undefined,
  }).catch(() => null);

  // Acceptance is the trigger, not a to-do list for the owner: the contract
  // goes out on its own the moment the client says yes. If DocuSign is not
  // reachable the acceptance still stands — the contract is retried from the
  // panel — because losing a "yes" over a signature service is unacceptable.
  let contract = null;
  if (accept && docusignConfigured() && isEmail(contact.email)) {
    try {
      const { env } = await sendContractFor(o, { email: contact.email, clientName: o.client });
      contract = { envelopeId: env.envelopeId, status: env.status, to: contact.email };
      await announce({
        stage: "contract_sent", clientRef: o.clientRef, orderId: o.id,
        email: contact.email, name: o.client, service: o.service, total,
      }).catch(() => null);
    } catch (e) {
      contract = { error: String(e.message || "docusign_failed") };
      await sendEmail(TEAM_EMAIL, `⚠️ تعذّر إرسال العقد تلقائياً — ${o.ref}`,
        `<div dir="rtl" style="font-family:Arial"><p>العميل قَبِل العرض لكن DocuSign رفض الإرسال: <b>${esc(contract.error)}</b>.</p><p>أرسله يدوياً من لوحة /admin ← بطاقة DocuSign.</p></div>`);
    }
  }
  return { ok: true, decision: accept ? "accepted" : "declined", notified, contract, clientRef: o.clientRef, ref: o.ref };
}

// One priced view of a quote, read from the order and nothing else. Used by
// the signing page, the contract document and the payment verification, so
// all three agree on the figure by construction rather than by luck.
export async function quotePriced(id, t) {
  if (!id || !quoteTokenOk(id, t)) return null;
  const pg = await notion(`pages/${id}`);
  if (!pg.ok || !pg.json) return null;
  const o = orderOf(pg.json);
  if (!o.lines.length && o.quote == null) return null;
  const net = o.lines.length ? o.lines.reduce((tt, l) => tt + l.price * l.qty, 0) : (o.quote || 0);
  const vat = Math.round(net * (VAT_PCT / 100) * 100) / 100;
  return {
    order: o,
    net: Math.round(net * 100) / 100, vatRate: VAT_PCT, vat,
    total: Math.round((net + vat) * 100) / 100,
  };
}

// What was signed, pulled back out. The frozen HTML is authoritative: it is
// the bytes that were hashed, so re-rendering from live data would be a
// different document with the same name.
function readSigned(notes) {
  const i = String(notes || "").indexOf(SIGN_MARK);
  if (i === -1) return null;
  try { return JSON.parse(String(notes).slice(i + SIGN_MARK.length).trim().split("\n")[0]); }
  catch { return null; }
}
function writeSigned(notes, rec) {
  const i = String(notes || "").indexOf(SIGN_MARK);
  const head = i === -1 ? String(notes || "") : String(notes).slice(0, i);
  return `${head}${head && !head.endsWith("\n") ? "\n" : ""}${SIGN_MARK}\n${JSON.stringify(rec)}`;
}

// The signature record rides in the notes field, so anything shown to a
// client is cut at the marker: a page that renders its own audit JSON back to
// the reader is leaking plumbing, and the record is not theirs to edit.
const publicNotes = (notes) => {
  const i = String(notes || "").indexOf(SIGN_MARK);
  return (i === -1 ? String(notes || "") : String(notes).slice(0, i)).trim();
};

const maskEmail = (e) => {
  const [u, d] = String(e || "").split("@");
  if (!d) return "";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
};
const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim().slice(0, 45);
const riyadhStamp = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");

export async function handleSuppliers(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  const url = new URL(req.url, "http://x");
  const q = Object.fromEntries(url.searchParams);
  const ok = (o) => { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, ...o })); };
  const bad = (error, status = 400, extra) => { res.statusCode = status; return res.end(JSON.stringify({ ok: false, error, ...(extra || {}) })); };

  if (!NOTION_TOKEN) return bad("not_configured", 503);

  // ---------------- GET ----------------
  if (req.method === "GET") {
    // Supplier: my work orders
    if (q.action === "orders") {
      const s = await authSupplier(q.email, q.pw);
      if (!s) return bad("unauthorized", 401);
      if (!s.verified) return bad("email_unverified", 403);
      const orders = await ordersForSupplier(s.id);
      return ok({
        supplier: {
          name: s.name, code: s.code, person: s.person, city: s.city,
          categories: s.categories, terms: s.terms, status: s.status,
          // The portal prices the whole catalogue off this, so it is sent even
          // when the row has no override — the supplier sees the same number
          // the owner bills against, never a guess.
          commission: s.commission != null ? s.commission : DEFAULT_COMMISSION,
          // Their own price list, so a quote is assembled by picking rather
          // than by retyping a price they already decided once.
          priceList: s.priceList || [],
        },
        orders,
      });
    }
    // Public: one quote, opened from the link mailed to the client. No session
    // — the token in the link is what authorises it, and it grants nothing but
    // this one document.
    if (q.action === "quote") {
      const id = str(q.id, 60);
      if (!id || !quoteTokenOk(id, q.t)) return bad("bad_link", 403);
      const pg = await notion(`pages/${id}`);
      if (!pg.ok || !pg.json) return bad("not_found", 404);
      const o = orderOf(pg.json);
      if (!o.lines.length && o.quote == null) return bad("no_quote", 404);
      let supplier = "";
      if (o.supplierId) {
        const sp = await notion(`pages/${o.supplierId}`);
        if (sp.ok && sp.json) supplier = supplierOf(sp.json).name;
      }
      const net = o.lines.length ? o.lines.reduce((t, l) => t + l.price * l.qty, 0) : (o.quote || 0);
      const vat = Math.round(net * (VAT_PCT / 100) * 100) / 100;
      return ok({
        quote: {
          id, ref: o.ref, service: o.service, client: o.client, clientRef: o.clientRef,
          lines: o.lines, net: Math.round(net * 100) / 100, vatRate: VAT_PCT, vat,
          total: Math.round((net + vat) * 100) / 100,
          leadTime: o.leadTime, notes: publicNotes(o.notes), status: o.status, supplier,
          // Business Partner is the counterparty on the client's paperwork; the
          // partner executes. Saying so on the quote keeps the invoice, the VAT
          // and the contract with the entity that actually issues them.
          decided: o.status === "مقبول من العميل" || o.status === "مرفوض من العميل" || o.status === "موقّع من العميل",
          accepted: o.status === "مقبول من العميل" || o.status === "موقّع من العميل",
          // Which step the client is actually on, decided by the record rather
          // than by what the browser remembers from last time.
          signed: (() => { const r = readSigned(o.notes); return r ? { at: r.at, by: r.fullName, hash: r.hash } : null; })(),
          paid: (o.log || []).some((l) => /استلمنا المبلغ/.test(l.text || "")),
        },
      });
    }

    // Public: the signed contract, for the client to read and save as PDF.
    // Serves the frozen bytes that were hashed — a contract re-rendered from
    // live data would carry the same name and a different meaning.
    if (q.action === "contract") {
      const id = str(q.id, 60);
      if (!id || !quoteTokenOk(id, q.t)) return bad("bad_link", 403);
      const priced = await quotePriced(id, q.t);
      if (!priced) return bad("not_found", 404);
      const o = priced.order;
      const rec = readSigned(o.notes);
      if (!rec) return bad("not_signed", 409);
      let html = "";
      if (rec.docKey && DB_ON) {
        try {
          const url = await storageSign(rec.docKey, 300);
          if (url) { const r = await fetch(url); if (r.ok) html = await r.text(); }
        } catch { html = ""; }
      }
      return ok({
        contract: {
          ref: o.clientRef || o.ref, service: o.service,
          total: priced.total, net: priced.net, vat: priced.vat, vatRate: priced.vatRate,
          signedAt: rec.at, signedBy: rec.fullName, hash: rec.hash,
          html: html || "",
          // No stored copy (storage off, or an older signature) — the page says
          // so rather than showing a document that was never the signed one.
          stored: !!html,
        },
      });
    }

    // Owner: the whole registry + every work order
    if (q.action === "admin") {
      if (!ownerOk(q)) return bad("unauthorized", 401);
      const [sr, or_] = await Promise.all([
        notion(`databases/${SUPPLIERS_DB}/query`, "POST", { page_size: 100, sorts: [{ property: "آخر نشاط", direction: "descending" }] }),
        notion(`databases/${ORDERS_DB}/query`, "POST", { page_size: 100, sorts: [{ property: "آخر تحديث", direction: "descending" }] }),
      ]);
      const suppliers = sr.ok && sr.json ? (sr.json.results || []).map(supplierOf) : [];
      const orders = or_.ok && or_.json ? (or_.json.results || []).map(orderOf) : [];
      return ok({ suppliers, orders });
    }
    return bad("unknown_action", 404);
  }

  if (req.method !== "POST") return bad("method_not_allowed", 405);

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (!b) b = await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });

  // ---------------- sign up: e-mail + password, code to the inbox ----------------
  if (b.type === "register" || b.type === "signup") {
    const name = str(b.company, 200);
    const person = str(b.person, 160);
    const phone = str(b.phone, 40);
    const email = str(b.email, 160).toLowerCase();
    const password = String(b.password == null ? "" : b.password);
    const city = str(b.city, 80);
    const cr = str(b.cr, 40);
    const vat = str(b.vat, 40);
    const services = str(b.services || b.notes, 900);
    const cats = (Array.isArray(b.categories) ? b.categories : [b.category]).map((c) => str(c, 60)).filter(Boolean).slice(0, 8);
    if (!name || !person || !phone || !isEmail(email)) return bad("invalid_fields");
    if (password.length < 8) return bad("weak_password");
    if (!OTP_SECRET) return bad("not_configured", 503);

    // A second sign-up on an existing e-mail must not overwrite the account or
    // reveal that it exists — it just re-sends a verification code.
    const existing = await findSupplierByEmail(email);
    const code = String(randomInt(100000, 1000000));
    const exp = Date.now() + CODE_TTL_MS;
    const token = sealCode(email, code, exp);

    if (!existing) {
      const supCode = "SUP-" + randomCode(6);
      const props = {
        "اسم المورّد": { title: [{ text: { content: name } }] },
        "كود المورّد": { rich_text: [{ text: { content: supCode } }] },
        "بيانات الدخول": { rich_text: [{ text: { content: hashPassword(password) } }] },
        "طريقة الدخول": { select: { name: "كلمة مرور" } },
        "البريد موثّق": { checkbox: false },
        "الحالة": { select: { name: "جديد" } },
        "المسؤول": { rich_text: [{ text: { content: person } }] },
        "الجوال": { phone_number: phone },
        "البريد": { email },
        "المدينة": { rich_text: [{ text: { content: city } }] },
        "السجل التجاري": { rich_text: [{ text: { content: cr } }] },
        "الرقم الضريبي": { rich_text: [{ text: { content: vat } }] },
        "الخدمات": { rich_text: [{ text: { content: services.slice(0, 1900) } }] },
        "تاريخ التسجيل": { date: { start: new Date().toISOString().slice(0, 10) } },
      };
      if (cats.length) props["التصنيف"] = { multi_select: cats.map((n) => ({ name: n })) };
      const created = await notion("pages", "POST", { parent: { database_id: SUPPLIERS_DB }, properties: props });
      if (!created.ok) return bad("save_failed", 502);
      await sendEmail(TEAM_EMAIL, `🏭 مورّد جديد ${supCode} — ${name}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">تسجيل مورّد جديد — ${esc(supCode)}</h2><table>${row("الشركة", name) + row("المسؤول", person) + row("الجوال", phone) + row("البريد", email) + row("المدينة", city) + row("السجل التجاري", cr) + row("التصنيف", cats.join("، ")) + row("الخدمات", services)}</table>
        <p>اعتمِده من <a href="${SITE}/suppliers-admin">لوحة تحكم الموردين</a> ليبدأ استلام طلبات عروض الأسعار.</p></div>`);
    }

    await sendEmail(email, `رمز تفعيل حسابك — ${code}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:center">
      <h2 style="color:#0B1B5A">تفعيل حساب المورّد</h2>
      <p>رمز التحقق الخاص بك:</p>
      <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0B1B5A;margin:18px 0">${code}</p>
      <p style="color:#666">صالح لمدة 15 دقيقة. إذا لم تطلب هذا الرمز فتجاهل الرسالة.</p></div>`);
    return ok({ token, exp, next: "verify" });
  }

  // ---------------- verify the e-mailed code ----------------
  if (b.type === "verify-email") {
    const email = str(b.email, 160).toLowerCase();
    const code = str(b.code, 10);
    if (!checkSealed(email, code, b.token, b.exp)) return bad("invalid_code", 400);
    const s = await findSupplierByEmail(email);
    if (!s) return bad("invalid_code", 400);
    const props = { "البريد موثّق": { checkbox: true } };
    // The code was emailed to this address and came back with a token sealed
    // over it, so the sender controls the inbox — which is exactly the proof a
    // password reset needs. Signing up again on an existing e-mail therefore
    // sets the new password here rather than at sign-up, where it would have
    // let anyone overwrite an account by typing someone else's address.
    //
    // Without this, two accounts could never be reached at all: one registered
    // before passwords existed (access code only, no hash to compare), and one
    // whose owner signed up a second time — both verified fine and then failed
    // every login with "bad credentials" and no way to recover.
    const password = String(b.password == null ? "" : b.password);
    if (password.length >= 8) {
      props["بيانات الدخول"] = { rich_text: [{ text: { content: hashPassword(password) } }] };
      props["طريقة الدخول"] = { select: { name: "كلمة مرور" } };
    }
    const upd = await notion(`pages/${s.id}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);
    return ok({ verified: true, passwordSet: password.length >= 8 });
  }

  // ---------------- resend the verification code ----------------
  if (b.type === "resend-code") {
    const email = str(b.email, 160).toLowerCase();
    if (!isEmail(email) || !OTP_SECRET) return bad("invalid_fields");
    const s = await findSupplierByEmail(email);
    const code = String(randomInt(100000, 1000000));
    const exp = Date.now() + CODE_TTL_MS;
    const token = sealCode(email, code, exp);
    // Always answer the same shape, whether or not the address is registered.
    if (s) {
      await sendEmail(email, `رمز تفعيل حسابك — ${code}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:center"><h2 style="color:#0B1B5A">رمز التحقق</h2>
        <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0B1B5A;margin:18px 0">${code}</p>
        <p style="color:#666">صالح لمدة 15 دقيقة.</p></div>`);
    }
    return ok({ token, exp });
  }

  // ---------------- sign in with Google ----------------
  if (b.type === "google") {
    if (!GOOGLE_CLIENT_ID) return bad("google_not_configured", 503);
    const g = await verifyGoogleIdToken(b.credential);
    if (!g) return bad("bad_google_token", 401);
    let s = await findSupplierByEmail(g.email);
    if (!s) {
      // First Google sign-in creates the account. Google already proved the
      // address, so it starts verified — but still unapproved.
      const supCode = "SUP-" + randomCode(6);
      const created = await notion("pages", "POST", {
        parent: { database_id: SUPPLIERS_DB },
        properties: {
          "اسم المورّد": { title: [{ text: { content: str(b.company, 200) || g.name || g.email } }] },
          "كود المورّد": { rich_text: [{ text: { content: supCode } }] },
          "طريقة الدخول": { select: { name: "Google" } },
          "البريد موثّق": { checkbox: true },
          "الحالة": { select: { name: "جديد" } },
          "المسؤول": { rich_text: [{ text: { content: str(b.person, 160) || g.name } }] },
          "البريد": { email: g.email },
          "تاريخ التسجيل": { date: { start: new Date().toISOString().slice(0, 10) } },
        },
      });
      if (!created.ok) return bad("save_failed", 502);
      await sendEmail(TEAM_EMAIL, `🏭 مورّد جديد عبر Google — ${g.name || g.email}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">تسجيل مورّد عبر Google</h2><table>${row("الاسم", g.name) + row("البريد", g.email) + row("كود المورّد", supCode)}</table>
        <p>اعتمِده من <a href="${SITE}/suppliers-admin">لوحة تحكم الموردين</a>.</p></div>`);
      s = await findSupplierByEmail(g.email);
      if (!s) return bad("save_failed", 502);
    } else if (!s.verified) {
      await notion(`pages/${s.id}`, "PATCH", { properties: { "البريد موثّق": { checkbox: true } } });
    }
    const orders = await ordersForSupplier(s.id);
    return ok({ google: true, supplier: { name: s.name, code: s.code, person: s.person, city: s.city, categories: s.categories, terms: s.terms, status: s.status }, orders });
  }

  // ---------------- sign in with e-mail + password ----------------
  if (b.type === "login") {
    const s = await authSupplier(b.email, b.password);
    if (!s) return bad("bad_credentials", 401);
    if (!s.verified) return bad("email_unverified", 403);
    const orders = await ordersForSupplier(s.id);
    return ok({ supplier: { name: s.name, code: s.code, person: s.person, city: s.city, categories: s.categories, terms: s.terms, status: s.status }, orders });
  }

  // ---------------- supplier updates a work order ----------------
  if (b.type === "order-update") {
    const s = await authSupplier(b.email, b.password);
    if (!s) return bad("unauthorized", 401);
    if (!s.verified) return bad("email_unverified", 403);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    // The order must belong to this supplier — never trust the id alone.
    const mine = await ordersForSupplier(s.id);
    const order = mine.find((o) => o.id === orderId);
    if (!order) return bad("not_found", 404);

    const props = {};
    // Suppliers may only move an order along their own lane. Approving,
    // rejecting and cancelling stay with the owner.
    const allowed = ["عرض مُقدَّم", "قبله المورّد", "قيد التنفيذ", "تم التسليم"];
    const status = str(b.status, 40);
    if (status && allowed.includes(status)) props["الحالة"] = { select: { name: status } };

    // A quote is line items, not one number: the owner needs to see what the
    // price is made of, and the invoice that follows is the same lines again.
    // The total is computed here — a client-sent total that disagrees with its
    // own lines is a quote nobody can reconcile.
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 25).map((l) => ({
      name: str(l && l.name, 140),
      qty: Math.max(1, Math.min(999, Number((l && l.qty) || 1) || 1)),
      price: num(l && l.price) || 0,
    })).filter((l) => l.name && l.price > 0);
    const lineTotal = lines.reduce((t, l) => t + l.price * l.qty, 0);
    const quote = lines.length ? Math.round(lineTotal * 100) / 100 : num(b.quote);
    if (quote != null) {
      props["قيمة العرض المقدّم"] = { number: quote };
      props["تاريخ تقديم العرض"] = { date: { start: new Date().toISOString().slice(0, 10) } };
      if (!status) props["الحالة"] = { select: { name: "عرض مُقدَّم" } };
    }
    if (b.leadTime) props["مدة التنفيذ المقترحة"] = { rich_text: [{ text: { content: str(b.leadTime, 200) } }] };
    // A progress update the client sees on their tracking page. Dated and
    // attributed, appended — never replacing what came before, because the
    // journey is the record.
    const progress = str(b.progress, 400);
    const log = (order.log || []).slice();
    if (progress) log.push({ at: new Date().toISOString().slice(0, 16).replace("T", " "), by: s.name || s.code, text: progress });

    // Notes, lines and log share one field, so writing one must not erase the others.
    if (b.notes != null || lines.length || progress) {
      const text = b.notes != null ? str(b.notes, 1500) : String(order.notes || "");
      const keep = lines.length ? lines : (order.lines || []);
      props["ملاحظات"] = { rich_text: richChunks(joinOrderNotes(text, keep, log)) };
    }

    let uploaded = null;
    if (b.invoiceBase64) {
      uploaded = await uploadToNotion(b.invoiceBase64, str(b.invoiceName, 120) || `فاتورة-${order.ref}.pdf`, str(b.invoiceType, 80));
      if (uploaded) {
        props["فاتورة المورّد"] = { files: [{ type: "file_upload", file_upload: { id: uploaded }, name: str(b.invoiceName, 100) || `فاتورة ${order.ref}` }] };
        props["حالة فاتورة المورّد"] = { select: { name: "مرفوعة" } };
      }
    }
    if (!Object.keys(props).length) return bad("nothing_to_update");
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    await sendEmail(TEAM_EMAIL, `📦 تحديث أمر عمل ${order.ref} — ${s.name}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">تحديث من المورّد</h2><table>${row("أمر العمل", order.ref) + row("المورّد", s.name) + row("الحالة الجديدة", status || order.status) + row("فاتورة مرفوعة", uploaded ? "نعم" : "لا") + row("ملاحظات", str(b.notes, 400))}</table></div>`);

    // The client is the reason any of this happened, so they are told too. A
    // quote that only the owner can see is the gap that started all of this.
    const newStatus = (props["الحالة"] && props["الحالة"].select.name) || order.status;
    const keptLines = lines.length ? lines : (order.lines || []);
    const netNow = keptLines.length ? keptLines.reduce((t, l) => t + l.price * l.qty, 0) : (quote != null ? quote : order.quote);
    const totalNow = netNow == null ? null : Math.round(netNow * (1 + VAT_PCT / 100) * 100) / 100;
    let notified = null;
    if (order.clientRef && OTP_SECRET) {
      const token = quoteToken(orderId);
      if (newStatus === "عرض مُقدَّم" && netNow != null) {
        notified = await announce({
          stage: "quote_sent", clientRef: order.clientRef, orderId, token,
          name: order.client, service: order.service, total: totalNow,
          url: `${SITE}/ar/quote?id=${encodeURIComponent(orderId)}&t=${token}`,
        }).catch(() => null);
      } else if (newStatus === "تم التسليم") {
        notified = await announce({
          stage: "delivered", clientRef: order.clientRef, orderId,
          name: order.client, service: order.service, extra: progress || "",
        }).catch(() => null);
      } else if (progress) {
        notified = await announce({
          stage: "work_update", clientRef: order.clientRef, orderId,
          name: order.client, service: order.service, extra: progress,
        }).catch(() => null);
      }
    }
    return ok({ invoiceUploaded: !!uploaded, quote, lines, notified });
  }

  // ---------------- owner: approve / suspend a supplier ----------------
  if (b.type === "approve") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const id = str(b.supplierId, 60);
    const status = str(b.status, 20);
    if (!id || !["معتمد", "موقوف", "مرفوض", "جديد"].includes(status)) return bad("invalid_fields");
    const pg = await notion(`pages/${id}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const s = supplierOf(pg.json);
    const props = { "الحالة": { select: { name: status } } };
    if (b.commission != null && num(b.commission) != null) props["نسبة العمولة %"] = { number: num(b.commission) };
    if (b.terms) props["شروط السداد"] = { select: { name: str(b.terms, 40) } };
    const upd = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    if (status === "معتمد" && s.email) {
      await sendEmail(s.email, `تم اعتمادك كمورّد — رمز دخول بوابة الموردين`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">تم اعتمادكم ✅</h2>
        <p>مرحباً ${esc(s.person || s.name)}، اعتمدنا <b>${esc(s.name)}</b> في شبكة موردي بيزنس بارتنر.</p>
        <table>${row("كود المورّد", s.code) + row("البريد", s.email)}</table>
        <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح بوابة الموردين</a></p>
        <p>ادخل ببريدك وكلمة المرور التي أنشأتها عند التسجيل. من البوابة تستقبل طلبات عروض الأسعار، تتابع أوامر العمل، وترفع فواتيرك.</p>
        <p style="color:#666">بيزنس بارتنر · الرياض</p></div>`);
    }
    if (status === "موقوف" && s.email) {
      await sendEmail(s.email, `إيقاف مؤقت لحساب المورّد — ${s.name}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><p>مرحباً ${esc(s.person || s.name)}، أُوقف وصولكم لبوابة الموردين مؤقتاً. للتواصل: ${esc(TEAM_EMAIL)}</p></div>`);
    }
    return ok({ status });
  }

  // ---------------- owner: assign a work order to a supplier ----------------
  if (b.type === "assign") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const supplierId = str(b.supplierId, 60);
    const service = str(b.service, 200);
    if (!supplierId || !service) return bad("invalid_fields");
    const pg = await notion(`pages/${supplierId}`);
    if (!pg.ok || !pg.json) return bad("supplier_not_found", 404);
    const s = supplierOf(pg.json);
    if (s.status !== "معتمد") return bad("supplier_not_approved", 409);

    const ref = "PO-" + Date.now().toString().slice(-6);
    const amount = num(b.amount);
    const commission = num(b.commission);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(str(b.due, 10)) ? str(b.due, 10) : null;
    const props = {
      "أمر العمل": { title: [{ text: { content: `${ref} — ${service}`.slice(0, 200) } }] },
      "المورّد": { relation: [{ id: supplierId }] },
      "مرجع طلب العميل": { rich_text: [{ text: { content: str(b.clientRef, 60) } }] },
      "العميل": { rich_text: [{ text: { content: str(b.client, 160) } }] },
      "الخدمة المطلوبة": { rich_text: [{ text: { content: service } }] },
      "التفاصيل": { rich_text: [{ text: { content: str(b.details, 1900) } }] },
      "المدينة": { rich_text: [{ text: { content: str(b.city, 80) } }] },
      "الحالة": { select: { name: "أُرسل للمورّد" } },
      "حالة فاتورة المورّد": { select: { name: "لم تُرفع" } },
      "حالة فاتورة العمولة": { select: { name: "لم تُصدر" } },
    };
    if (amount != null) props["قيمة أمر العمل"] = { number: amount };
    if (commission != null) props["قيمة العمولة"] = { number: commission };
    if (due) props["تاريخ التسليم"] = { date: { start: due } };
    const created = await notion("pages", "POST", { parent: { database_id: ORDERS_DB }, properties: props });
    if (!created.ok) return bad("save_failed", 502);

    await sendEmail(s.email, `📦 أمر عمل جديد ${ref} — ${service}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">أمر عمل جديد — ${esc(ref)}</h2>
      <table>${row("الخدمة", service) + row("المدينة", str(b.city, 80)) + row("موعد التسليم", due) + row("قيمة أمر العمل", amount != null ? amount + " ﷼" : "—") + row("التفاصيل", str(b.details, 600))}</table>
      <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح البوابة وأكّد الاستلام</a></p>
      <p>من البوابة تقبل أمر العمل، تحدّث حالته أثناء التنفيذ، وترفع فاتورتك بعد التسليم.</p></div>`);
    return ok({ ref, id: created.json && created.json.id });
  }

  // ---------------- owner: request quotations from several suppliers ----------------
  if (b.type === "rfq") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const ids = (Array.isArray(b.supplierIds) ? b.supplierIds : []).map((i) => str(i, 60)).filter(Boolean).slice(0, 20);
    const service = str(b.service, 200);
    if (!ids.length || !service) return bad("invalid_fields");
    const ref = "RFQ-" + Date.now().toString().slice(-6);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(str(b.due, 10)) ? str(b.due, 10) : null;
    const made = [];
    for (const id of ids) {
      const pg = await notion(`pages/${id}`);
      if (!pg.ok || !pg.json) continue;
      const s = supplierOf(pg.json);
      if (s.status !== "معتمد") continue;
      const props = {
        "أمر العمل": { title: [{ text: { content: `${ref} — ${service}`.slice(0, 200) } }] },
        "المورّد": { relation: [{ id }] },
        "مرجع طلب العميل": { rich_text: [{ text: { content: str(b.clientRef, 60) } }] },
        "العميل": { rich_text: [{ text: { content: str(b.client, 160) } }] },
        "الخدمة المطلوبة": { rich_text: [{ text: { content: service } }] },
        "التفاصيل": { rich_text: [{ text: { content: str(b.details, 1900) } }] },
        "المدينة": { rich_text: [{ text: { content: str(b.city, 80) } }] },
        "الحالة": { select: { name: "طلب عرض سعر" } },
        "حالة فاتورة المورّد": { select: { name: "لم تُرفع" } },
        "حالة فاتورة العمولة": { select: { name: "لم تُصدر" } },
      };
      if (due) props["تاريخ التسليم"] = { date: { start: due } };
      const created = await notion("pages", "POST", { parent: { database_id: ORDERS_DB }, properties: props });
      if (!created.ok) continue;
      made.push({ supplier: s.name, id: created.json && created.json.id });
      await sendEmail(s.email, `📝 طلب عرض سعر ${ref} — ${service}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">طلب عرض سعر — ${esc(ref)}</h2>
        <table>${row("الخدمة", service) + row("المدينة", str(b.city, 80)) + row("مطلوب التسليم", due) + row("التفاصيل", str(b.details, 600))}</table>
        <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">قدّم عرض سعرك</a></p>
        <p>ادخل البوابة وأدخل سعرك ومدة التنفيذ. نراجع العروض ونبلغك بالنتيجة.</p></div>`);
    }
    if (!made.length) return bad("no_approved_suppliers", 409);
    return ok({ ref, sent: made.length, suppliers: made });
  }

  // ---------------- owner: award an RFQ to one supplier ----------------
  if (b.type === "award") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const pg = await notion(`pages/${orderId}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const o = orderOf(pg.json);
    // The awarded value defaults to the price the supplier actually quoted.
    const amount = num(b.amount) != null ? num(b.amount) : (o.quote != null ? o.quote : o.amount);
    const props = { "الحالة": { select: { name: "أُرسل للمورّد" } } };
    if (amount != null) props["قيمة أمر العمل"] = { number: amount };
    if (num(b.commission) != null) props["قيمة العمولة"] = { number: num(b.commission) };
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    // Close the losing quotes on the same RFQ so the board stays truthful.
    let closed = 0;
    const rfq = (o.ref || "").split(" — ")[0];
    if (rfq && rfq.startsWith("RFQ-")) {
      const sib = await notion(`databases/${ORDERS_DB}/query`, "POST", {
        page_size: 50,
        filter: { and: [{ property: "أمر العمل", title: { starts_with: rfq } }, { property: "الحالة", select: { does_not_equal: "أُرسل للمورّد" } }] },
      });
      for (const pgx of (sib.ok && sib.json ? sib.json.results || [] : [])) {
        if (pgx.id === orderId) continue;
        await notion(`pages/${pgx.id}`, "PATCH", { properties: { "الحالة": { select: { name: "لم يُرسَ" } } } });
        closed++;
      }
    }

    let email = "";
    if (o.supplierId) { const sp = await notion(`pages/${o.supplierId}`); if (sp.ok && sp.json) email = supplierOf(sp.json).email; }
    if (email) {
      await sendEmail(email, `✅ تم ترسية أمر العمل ${o.ref}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">تمت الترسية عليكم ✅</h2>
        <table>${row("أمر العمل", o.ref) + row("الخدمة", o.service) + row("القيمة المعتمدة", amount != null ? amount + " ﷼" : "—")}</table>
        <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح البوابة وابدأ التنفيذ</a></p></div>`);
    }
    return ok({ amount, closedOthers: closed });
  }

  // ---------------- owner: issue the commission invoice on the supplier ----------------
  if (b.type === "invoice") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const pg = await notion(`pages/${orderId}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const o = orderOf(pg.json);
    const amount = num(b.amount) != null ? num(b.amount) : o.commission;
    if (amount == null) return bad("no_amount");
    const invRef = str(b.invoiceRef, 40) || "INV-" + Date.now().toString().slice(-6);
    const props = {
      "قيمة العمولة": { number: amount },
      "رقم فاتورة العمولة": { rich_text: [{ text: { content: invRef } }] },
      "حالة فاتورة العمولة": { select: { name: str(b.status, 20) || "صادرة" } },
    };
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    let supplierEmail = "";
    if (o.supplierId) {
      const sp = await notion(`pages/${o.supplierId}`);
      if (sp.ok && sp.json) supplierEmail = supplierOf(sp.json).email;
    }
    if (supplierEmail) {
      await sendEmail(supplierEmail, `فاتورة ${invRef} — ${o.ref}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">فاتورة من بيزنس بارتنر</h2>
        <table>${row("رقم الفاتورة", invRef) + row("أمر العمل", o.ref) + row("الخدمة", o.service) + row("المبلغ", amount + " ﷼")}</table>
        <p>تفاصيل الفاتورة وسدادها متاحة في <a href="${SITE}/partner-dashboard">بوابة الموردين</a>.</p></div>`);
    }
    return ok({ invoiceRef: invRef, amount });
  }

  // ---------------- public: the client accepts or declines the quote ----------------
  if (b.type === "quote-decision") {
    const r = await decideQuote({ id: b.id, t: b.t, decision: b.decision, note: b.note });
    if (r.error) return bad(r.error, r.status || 400);
    return ok({ decision: r.decision, notified: r.notified, contract: r.contract });
  }

  // ---------------- public: step 2 — prove it is you ----------------
  // The code goes to the address on the client's own CRM record, never to an
  // address typed into this page: otherwise anyone holding the link could sign
  // as the client, which is the one thing a signature has to rule out.
  if (b.type === "sign-start") {
    const id = str(b.id, 60);
    if (!id || !quoteTokenOk(id, b.t)) return bad("bad_link", 403);
    if (!OTP_SECRET) return bad("not_configured", 503);
    const priced = await quotePriced(id, b.t);
    if (!priced) return bad("not_found", 404);
    const o = priced.order;
    if (o.status === "مرفوض من العميل") return bad("declined", 409);
    const contact = await contactForRef(o.clientRef).catch(() => ({ email: "", phone: "" }));
    if (!isEmail(contact.email)) return bad("no_contact", 409);

    const code = String(randomInt(100000, 1000000));
    const exp = Date.now() + CODE_TTL_MS;
    const token = sealSign(id, code, exp);
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:center">
      <h2 style="color:#0B1B5A">رمز توقيع العقد</h2>
      <p style="color:#334155">استخدم هذا الرمز لإتمام توقيع عقد <b>${esc(o.service || o.ref)}</b> (${esc(o.clientRef || o.ref)}).</p>
      <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0B1B5A;margin:18px 0">${code}</p>
      <p style="color:#666">صالح ١٥ دقيقة. إن لم تكن أنت من طلب التوقيع، تجاهل هذه الرسالة ولا تشارك الرمز مع أحد.</p></div>`;
    await sendEmail(contact.email, `رمز توقيع العقد — ${code}`, html);
    if (contact.phone) {
      await waSend(contact.phone, `رمز توقيع عقدك مع بيزنس بارتنر: ${code}\nصالح ١٥ دقيقة. لا تشاركه مع أحد.`).catch(() => {});
    }
    return ok({ token, exp, sentTo: maskEmail(contact.email), phone: !!contact.phone });
  }

  // ---------------- public: step 2 — sign ----------------
  // The document is built here from the order, hashed, and stored exactly as
  // signed. Nothing about the figures comes from the browser; what the browser
  // contributes is the name, the drawn signature and the one-time code.
  if (b.type === "sign-submit") {
    const id = str(b.id, 60);
    if (!id || !quoteTokenOk(id, b.t)) return bad("bad_link", 403);
    if (!signSealOk(id, b.code, b.token, b.exp)) return bad("bad_code", 403);
    if (b.agree !== true) return bad("consent_required");
    const fullName = str(b.fullName, 120);
    if (fullName.length < 4) return bad("name_required");
    const nationalId = str(b.nationalId, 20).replace(/[^\d]/g, "");
    const priced = await quotePriced(id, b.t);
    if (!priced) return bad("not_found", 404);
    const o = priced.order;
    const already = readSigned(o.notes);
    if (already) return ok({ alreadySigned: true, at: already.at, hash: already.hash });

    let executor = "";
    if (o.supplierId) {
      const sp = await notion(`pages/${o.supplierId}`);
      if (sp.ok && sp.json) executor = supplierOf(sp.json).name;
    }
    const contact = await contactForRef(o.clientRef).catch(() => ({ email: "", phone: "" }));
    const body = contractHtml({
      ref: o.clientRef || o.ref, clientName: fullName,
      clientCr: str(b.clientCr, 40), clientVat: str(b.clientVat, 20),
      service: o.service, lines: o.lines,
      net: priced.net, vat: priced.vat, total: priced.total,
      vatRate: priced.vatRate, leadTime: o.leadTime, executor,
      today: new Date().toISOString().slice(0, 10),
    });
    // The hash covers the contract text, not the signature block that carries
    // the hash — otherwise it would have to contain itself.
    const hash = createHash("sha256").update(body, "utf8").digest("hex");
    const at = riyadhStamp();
    const ip = clientIp(req);
    // A drawn signature is optional: a typed name plus a verified one-time code
    // is already a valid electronic signature. The drawing is what makes the
    // document look like the thing people expect to see.
    const raw = String(b.signature || "");
    const dataUrl = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length < 400000 ? raw : "";

    let imageUrl = "";
    if (dataUrl && DB_ON) {
      try {
        const buf = Buffer.from(dataUrl.split(",")[1], "base64");
        const key = `signatures/${id}/${Date.now()}.png`;
        await storagePut(key, buf, "image/png");
        imageUrl = await storageSign(key, 60 * 60 * 24 * 365);
      } catch { imageUrl = ""; }
    }
    const signed = signatureBlock({
      fullName, nationalId, at, hash, ip,
      emailMasked: maskEmail(contact.email),
      image: imageUrl || dataUrl,
    });
    const full = body + signed;

    // The frozen document, kept where a year-old contract can still be fetched.
    let docKey = "";
    if (DB_ON) {
      try {
        docKey = `contracts/${id}/${hash.slice(0, 12)}.html`;
        await storagePut(docKey, Buffer.from(full, "utf8"), "text/html; charset=utf-8");
      } catch { docKey = ""; }
    }
    const rec = { at, hash, fullName, nationalId, ip, docKey, image: imageUrl, email: contact.email };

    const log = (o.log || []).concat([{ at, by: "العميل", text: `وقّع العميل العقد إلكترونياً — ${fullName} (بصمة ${hash.slice(0, 10)}…)` }]);
    const props = { "ملاحظات": { rich_text: richChunks(joinOrderNotes(writeSigned(o.notes, rec), o.lines, log)) } };
    let upd = await notion(`pages/${id}`, "PATCH", { properties: { ...props, "الحالة": { select: { name: "موقّع من العميل" } } } });
    // A Notion database that has never seen this option rejects it; the
    // signature is the record either way, so the status is not worth losing it.
    if (!upd.ok) upd = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    const contractUrl = `${SITE}/ar/contract?id=${encodeURIComponent(id)}&t=${quoteToken(id)}`;
    const notified = await announce({
      stage: "contract_signed", clientRef: o.clientRef, orderId: id,
      name: fullName, service: o.service, total: priced.total,
      url: contractUrl,
      // The fingerprint is the verification code: anyone can re-hash the
      // document they hold and check it against this, which is the whole
      // point of printing it on the notice.
      extra: `رمز التحقق من المستند: ${hash.slice(0, 32).toUpperCase()}`,
    }).catch(() => null);
    // Everyone with a stake sees the completion, not just the client: the
    // partner executing the work had no way to know their quote had been
    // signed, which is the same gap the acceptance had.
    const completionHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;max-width:560px">
      <h2 style="color:#0B1B5A">تم إكمال المستند ✓ — توقيع إلكتروني مكتمل</h2>
      <table>${row("أمر العمل", o.ref) + row("طلب العميل", o.clientRef) + row("الموقِّع", fullName) + row("التاريخ", at) + row("الإجمالي", priced.total + " ﷼")}</table>
      <p style="margin:18px 0"><a href="${contractUrl}" style="background:#0B1B5A;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">عرض المستند المكتمل</a></p>
      <p style="direction:ltr;font-family:monospace;font-size:11px;color:#64748b">SHA-256: ${esc(hash)}</p></div>`;
    await sendEmail(TEAM_EMAIL, `✍️ وقّع العميل العقد — ${o.ref}`, completionHtml);
    if (o.supplierId) {
      const sp = await notion(`pages/${o.supplierId}`);
      const se = sp.ok && sp.json ? supplierOf(sp.json).email : "";
      if (se) await sendEmail(se, `✍️ وقّع العميل العقد — ${o.ref}`, completionHtml);
    }

    return ok({ signed: true, at, hash, total: priced.total, notified });
  }

  // ---------------- owner: send the contract for signature ----------------
  // Only after the client accepted the quote: a contract for terms nobody
  // agreed to is not a contract, and sending one invites a dispute rather than
  // settling one. The figures come from the order, never from the browser.
  if (b.type === "contract-send") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    if (!docusignConfigured()) return bad("docusign_not_configured", 503);
    const id = str(b.orderId, 60);
    if (!id) return bad("invalid_fields");
    const pg = await notion(`pages/${id}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const o = orderOf(pg.json);
    if (o.status !== "مقبول من العميل" && !b.force) return bad("quote_not_accepted", 409, { status: o.status });
    const email = str(b.email, 160).toLowerCase();
    if (!isEmail(email)) return bad("bad_email");

    try {
      const { env, total } = await sendContractFor(o, {
        email, clientName: str(b.clientName, 200), clientCr: str(b.clientCr, 40), clientVat: str(b.clientVat, 20),
      });
      // The client hears about it on every channel they have — DocuSign's own
      // e-mail is one inbox, and one inbox is how a signature goes unnoticed.
      const notified = await announce({
        stage: "contract_sent", clientRef: o.clientRef, orderId: o.id, email,
        name: str(b.clientName, 200) || o.client, service: o.service, total,
      }).catch(() => null);
      return ok({ envelopeId: env.envelopeId, status: env.status, notified });
    } catch (e) {
      return bad(String(e.message || "docusign_failed"), 502, { detail: String(e.detail || "").slice(0, 400) });
    }
  }

  // ---------------- owner: where the signature has got to ----------------
  if (b.type === "contract-status") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    if (!docusignConfigured()) return bad("docusign_not_configured", 503);
    const envId = str(b.envelopeId, 80);
    if (!envId) return bad("invalid_fields");
    try {
      const envelope = await docusignStatus(envId);
      // Checking the signature is also how the signature gets acted on: a
      // completed envelope moves the order and tells the client, once.
      let notified = null;
      const id = str(b.orderId, 60);
      if (envelope && envelope.status === "completed" && id) {
        const pg = await notion(`pages/${id}`);
        if (pg.ok && pg.json) {
          const o = orderOf(pg.json);
          const already = (o.log || []).some((l) => /وقّع العميل العقد/.test(l.text || ""));
          if (!already) {
            const log = (o.log || []).concat([{
              at: new Date().toISOString().slice(0, 16).replace("T", " "),
              by: "العميل", text: "وقّع العميل العقد إلكترونياً عبر DocuSign",
            }]);
            await notion(`pages/${id}`, "PATCH", { properties: {
              "ملاحظات": { rich_text: richChunks(joinOrderNotes(o.notes, o.lines, log)) },
            } });
            const net = o.lines.length ? o.lines.reduce((t, l) => t + l.price * l.qty, 0) : (o.quote || 0);
            notified = await announce({
              stage: "contract_signed", clientRef: o.clientRef, orderId: id,
              name: o.client, service: o.service,
              total: Math.round(net * (1 + VAT_PCT / 100) * 100) / 100,
            }).catch(() => null);
          }
        }
      }
      return ok({ envelope, notified });
    } catch (e) { return bad(String(e.message || "docusign_failed"), 502, { detail: String(e.detail || "").slice(0, 400) }); }
  }

  // ---------------- owner: is DocuSign reachable, and which account ----------------
  if (b.type === "docusign-ping") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const out = await docusignPing();
    res.statusCode = out.ok ? 200 : 200; // a configuration answer is not a server error
    return res.end(JSON.stringify(out));
  }

  // ---------------- partner/owner: the link to send the client ----------------
  if (b.type === "quote-link") {
    const s = await authSupplier(b.email, b.pw || b.password);
    const owner = ownerOk(b);
    if (!s && !owner) return bad("unauthorized", 401);
    const id = str(b.orderId, 60);
    if (!id) return bad("invalid_fields");
    if (s) {
      const mine = await ordersForSupplier(s.id);
      if (!mine.find((o) => o.id === id)) return bad("not_found", 404);
    }
    if (!OTP_SECRET) return bad("not_configured", 503);
    return ok({ url: `${SITE}/ar/quote?id=${encodeURIComponent(id)}&t=${quoteToken(id)}` });
  }

  // ---------------- partner: their own price list ----------------
  // Built once, reused on every quote. Private to the partner — it is what
  // they charge us, not what the site publishes, so there is nothing here for
  // the owner to approve. Publishing to the public catalogue is a separate
  // request (propose-service below) precisely because that IS the owner's call.
  if (b.type === "my-services") {
    const s = await authSupplier(b.email, b.pw);
    if (!s) return bad("unauthorized", 401);
    if (!s.verified) return bad("email_unverified", 403);
    const clean = (Array.isArray(b.services) ? b.services : []).slice(0, 40).map((it) => ({
      name: str(it && it.name, 140),
      price: num(it && it.price),
      lead: str(it && it.lead, 60),
      note: str(it && it.note, 400),
    })).filter((it) => it.name && it.price != null && it.price >= 0);
    const pg = await notion(`pages/${s.id}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const current = splitServices(txt(pg.json.properties["الخدمات"]));
    const upd = await notion(`pages/${s.id}`, "PATCH", {
      properties: { "الخدمات": { rich_text: richChunks(joinServices(current.text, clean)) } },
    });
    if (!upd.ok) return bad("save_failed", 502);
    return ok({ priceList: clean });
  }

  // ---------------- partner: propose a service the catalogue does not carry ----------------
  // Deliberately not written into the catalogue: what we sell and what we
  // charge for it is the owner's decision, and a partner-set price appearing
  // on the public site would be one nobody approved. This carries the proposal
  // to the team and tells the partner exactly that.
  if (b.type === "propose-service") {
    const s = await authSupplier(b.email, b.pw);
    if (!s) return bad("unauthorized", 401);
    if (!s.verified) return bad("email_unverified", 403);
    const name = str(b.name, 140);
    const price = num(b.price);
    if (!name || price == null || price <= 0) return bad("invalid_fields");
    const category = str(b.category, 80);
    const lead = str(b.lead, 60);
    const notes = str(b.notes, 1200);
    const pct = s.commission != null ? s.commission : DEFAULT_COMMISSION;
    const listPrice = Math.round((price / (1 - pct / 100)) * 100) / 100;
    await sendEmail(TEAM_EMAIL, `➕ اقتراح خدمة من شريك: ${name} — ${s.name}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;text-align:right">
        <h2 style="color:#0B1B5A">اقتراح خدمة جديدة</h2>
        <table>${
          row("الشريك", `${s.name} (${s.code})`) +
          row("المسؤول", s.person) +
          row("البريد", s.email) +
          row("الخدمة المقترحة", name) +
          row("التصنيف", category) +
          row("سعر الشريك قبل الضريبة", `${price} ﷼`) +
          row(`سعر البيع المقترح بعمولة ${pct}٪`, `${listPrice} ﷼`) +
          row("مدة التنفيذ", lead)
        }</table>
        ${notes ? `<p style="white-space:pre-wrap;line-height:1.9">${esc(notes)}</p>` : ""}
        <p style="color:#64748b;font-size:12px">سعر البيع المقترح محسوب ليبقى نصيب الشريك كما طلبه بعد عمولتنا — رقم للاسترشاد، والتسعير قرارك.</p>
      </div>`);
    return ok({ proposed: true, suggestedListPrice: listPrice, commission: pct });
  }

  // ---------------- owner: raise the work order as a purchase order in Daftra ----------------
  // The work order already exists in Notion as the operational record; this
  // puts the matching purchase order in the books, so what is owed to the
  // supplier is an accounting entry rather than only a Notion row.
  if (b.type === "daftra-po" || b.type === "daftra-commission") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    if (!daftraConfigured()) return bad("daftra_not_configured", 503);
    const isPo = b.type === "daftra-po";
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const pg = await notion(`pages/${orderId}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const o = orderOf(pg.json);
    // A purchase order carries what we pay the supplier; the commission
    // invoice carries what we charge them. They are opposite directions and
    // must never be raised off the same figure.
    const amount = num(b.amount) != null ? num(b.amount) : (isPo ? o.amount : o.commission);
    if (amount == null || amount <= 0) return bad("no_amount");

    let sup = { name: "", email: "", phone: "", taxNumber: "", city: "" };
    if (o.supplierId) {
      const sp = await notion(`pages/${o.supplierId}`);
      if (sp.ok && sp.json) {
        const S = supplierOf(sp.json);
        sup = { name: S.name || "", email: S.email || "", phone: S.phone || "", taxNumber: S.vat || "", city: S.city || "" };
      }
    }
    if (!sup.name && !sup.email) return bad("supplier_unknown");

    try {
      const party = await daftraFindOrCreateSupplier({ ...sup, notes: `مورّد بيزنس بارتنر · ${o.ref}` });
      const items = [{ name: o.service || o.ref, code: "", quantity: 1, unitPrice: amount }];
      const doc = isPo
        ? await daftraCreatePurchaseOrder({ supplierId: party.id, items, ref: o.ref, notes: `أمر عمل ${o.ref}${o.client ? ` · العميل: ${o.client}` : ""}` })
        : await daftraCreateInvoice({ clientId: party.id, items: [{ name: `عمولة بيزنس بارتنر — ${o.service || o.ref}`, quantity: 1, unitPrice: amount }], ref: o.ref, notes: `عمولة على أمر العمل ${o.ref}` });

      const props = isPo
        ? { "قيمة أمر العمل": { number: amount }, "رقم أمر الشراء": { rich_text: [{ text: { content: String(doc.number) } }] } }
        : { "قيمة العمولة": { number: amount }, "رقم فاتورة العمولة": { rich_text: [{ text: { content: String(doc.number) } }] }, "حالة فاتورة العمولة": { select: { name: "صادرة" } } };
      // Best-effort: the document exists in the books either way, so a Notion
      // write-back failure must not read as a failed issuance.
      try { await notion(`pages/${orderId}`, "PATCH", { properties: props }); } catch {}

      let emailed = false;
      if (sup.email) {
        let pdf = null;
        try { pdf = await daftraDocPdf(isPo ? "po" : "invoice", doc.id); } catch {}
        const title = isPo ? "أمر شراء" : "فاتورة عمولة";
        const r = await sendEmail(sup.email, `${title} ${doc.number} — ${o.ref}`,
          `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">${title} من بيزنس بارتنر</h2>
          <table>${row("الرقم", String(doc.number)) + row("أمر العمل", o.ref) + row("الخدمة", o.service) + row("المبلغ قبل الضريبة", doc.net + " ﷼") + row("الضريبة", doc.vat + " ﷼") + row("الإجمالي", doc.total + " ﷼")}</table>
          ${pdf ? "<p>نسخة PDF مرفقة مع هذه الرسالة.</p>" : `<p><a href="${doc.url}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح المستند</a></p>`}
          <p>التفاصيل متاحة أيضاً في <a href="${SITE}/partner-dashboard">بوابة الموردين</a>.</p></div>`,
          pdf ? [{ filename: `${isPo ? "PO" : "Commission"}-${String(doc.number).replace(/[^\w-]/g, "")}.pdf`, content: pdf.base64 }] : undefined);
        emailed = !!(r && r.ok);
      }
      return ok({ number: doc.number, total: doc.total, url: doc.url, printUrl: doc.printUrl, emailed, supplierCreated: party.created });
    } catch (e) {
      console.error("daftra po/commission failed", String(e.message || e).slice(0, 200));
      return bad(String(e.message || "daftra_failed"), 502, { detail: String(e.detail || "").slice(0, 300) });
    }
  }

  // ---------------- owner: update a work order (status, payment) ----------------
  if (b.type === "order-admin") {
    if (!ownerOk(b)) return bad("unauthorized", 401);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const props = {};
    if (b.status) props["الحالة"] = { select: { name: str(b.status, 40) } };
    if (b.supplierInvoiceStatus) props["حالة فاتورة المورّد"] = { select: { name: str(b.supplierInvoiceStatus, 40) } };
    if (b.commissionStatus) props["حالة فاتورة العمولة"] = { select: { name: str(b.commissionStatus, 40) } };
    if (num(b.amount) != null) props["قيمة أمر العمل"] = { number: num(b.amount) };
    if (!Object.keys(props).length) return bad("nothing_to_update");
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);
    return ok({});
  }

  return bad("unknown_type", 404);
}
