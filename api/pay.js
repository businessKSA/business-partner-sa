// Vercel Serverless Function — online payments (Moyasar) for Business Partner 3.0.
// ESM module (repo package.json has "type": "module").
//
// The site works with bank transfer by default. As soon as the Moyasar keys are
// added in Vercel, the checkout page automatically shows the online-payment
// form (mada / Visa / Mastercard / Apple Pay) — no code changes needed.
//
// Env vars:
//   MOYASAR_PUBLISHABLE_KEY  pk_live_... / pk_test_...  → enables the checkout form
//   MOYASAR_SECRET_KEY       sk_live_... / sk_test_...  → server-side payment verification
//   MOYASAR_WEBHOOK_SECRET   any long random string; paste the SAME value into
//                            Moyasar → Settings → Webhooks as the secret token.
//                            Without it webhooks are refused, not trusted.
//   MOYASAR_MPF_URL          optional override of the payment-form script URL
//   NOTION_TOKEN / ...       Notion integration secret (see envFrom below) — only
//                            needed for the compliance-activation path
//   RESEND_API_KEY           optional; sends the "service unlocked" email
//
// GET  /api/pay            → { enabled, publishableKey, scriptUrl, cssUrl }  (never exposes the secret)
// POST /api/pay {id}       → verifies the payment with Moyasar and returns { ok, status, amount, currency }
// POST /api/pay {id, context:"compliance", company, code}
//                          → same verification, and if paid, flips the client's
//                            Compliance Intake row to حالة الاشتراك=نشط and
//                            emails them that the service unlocked.

import crypto from "node:crypto";
import { daftraConfigured, daftraFindOrCreateClient, daftraCreateInvoice, daftraRecordPayment, daftraDocPdf, daftraVatRate, nationalAddressLine, daftraPayLink, daftraPublicInvoiceLink} from "./_daftra.js";
import { markOrderPaid, quotePriced } from "./_suppliers.js";
import { tamaraConfigured, createTamaraSession, verifyTamaraOrder } from "./_bnpl.js";
import { contactForRef } from "./_stage.js";
import { ownerTicketOk, panelRequiresNafath } from "./_nafath.js";

// Trimmed, like every other secret this project reads. A newline pasted into
// the Vercel env box is invisible in that UI and turns the verification call
// into "Invalid authorization credentials" — while the payment itself has
// already succeeded, because the publishable key travelled to the browser and
// worked. The buyer is charged and the site tells them it failed. This cost a
// live customer, and api/_moyasar.js trimmed while this file did not, so the
// admin panel reported the key as working at the same moment payments broke.
const PK = (process.env.MOYASAR_PUBLISHABLE_KEY || "").trim();
const SK = (process.env.MOYASAR_SECRET_KEY || "").trim();
// Moyasar posts every payment event here and includes this token in the body.
// Without it the endpoint refuses webhooks outright rather than trusting an
// unauthenticated POST that claims a payment succeeded.
const WEBHOOK_SECRET = (process.env.MOYASAR_WEBHOOK_SECRET || "").trim();

// Which wallets the form offers. Apple Pay and STC Pay each need enabling on
// the Moyasar side first — Apple Pay also needs the domain registered and the
// association file served — and a wallet button that fails when tapped is
// worse than one that was never shown. So this is a switch the owner flips
// once the other side is actually done, not a code change.
//   MOYASAR_METHODS=creditcard,applepay,stcpay
const ALLOWED_METHODS = new Set(["creditcard", "applepay", "stcpay"]);
const METHODS = (process.env.MOYASAR_METHODS || "creditcard")
  .split(",").map((m) => m.trim().toLowerCase()).filter((m) => ALLOWED_METHODS.has(m));
const PAY_METHODS = METHODS.length ? METHODS : ["creditcard"];
// The name the buyer sees in the Apple Pay sheet — theirs is the last screen
// before the money moves, so it says who is being paid.
const APPLE_PAY_LABEL = process.env.MOYASAR_APPLE_PAY_LABEL || "Business Partner";
const APPLE_PAY_VALIDATE_URL = process.env.MOYASAR_APPLE_PAY_VALIDATE_URL || "https://api.moyasar.com/v1/applepay/initiate";
// The form library is served from this site's own /assets — the pinned CDN
// copy (mpf 1.15) mounted an empty box with no exception on live checkouts,
// and the current 2.x build ships on npm under the MIT licence, so the exact
// bytes we tested are the exact bytes the buyer runs. MOYASAR_MPF_URL still
// overrides for experiments.
const MPF_JS = process.env.MOYASAR_MPF_URL || "/assets/vendor/moyasar-2.2.10.js";
const MPF_CSS = MPF_JS.replace(/\.js$/, ".css");

const envFrom = (names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
};
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion",
  "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
const COMPLIANCE_DB = process.env.NOTION_COMPLIANCE_DB || "5d570a75009b41019857060d0670642f";
const NOTION_VERSION = "2022-06-28";
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function sendMail(to, subject, html, attachments) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(attachments && attachments.length ? { attachments } : {}) }),
    });
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

// ---- automatic tax invoice on a confirmed payment ---------------------------
// The buyer's cart arrives from their browser, so its prices are re-read from
// the published catalogue and the re-priced total is checked against what
// Moyasar says was actually charged. Without that check a crafted page could
// pair a real payment id with an invented basket and mint a tax invoice.

const OWNER_EMAIL = (process.env.BP_OWNER_EMAIL || "business@businesspartner.sa").toLowerCase();
// Same owner gate the panel uses everywhere else.
const PANEL_KEYS = new Set([process.env.PANEL_KEY, process.env.LEADS_KEY, process.env.DASHBOARD_KEY]
  .map((k) => String(k || "").trim()).filter(Boolean));
const panelOk = (b) => {
  if (ownerTicketOk(b && b.ticket)) return true;
  if (panelRequiresNafath()) return false;
  return PANEL_KEYS.size > 0 && PANEL_KEYS.has(String((b && b.key) || "").trim());
};

// ---- confirmed payment → automatic activation (via api/requests) ------------
// A verified cart payment is handed to /api/requests {action:"paid-order"},
// sealed with OTP_SECRET so only this server — never a browser — can declare
// an order paid. That endpoint owns the CRM write and every activation email
// (agents portal, compliance, employer plans, shared services, data access),
// so paying online activates everything with no owner click. The seal format
// is ssSeal's, byte for byte, because ssUnseal on the other side is the lock.
const OTP_SECRET = process.env.OTP_SECRET || "";
const SELF_BASE = process.env.MKT_SITE_BASE || "https://www.businesspartner.sa";
const sealKey = () => crypto.createHash("sha256").update(OTP_SECRET).digest();
function seal(o) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", sealKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(o), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
// Server-side copy of the prices printed on the pages for gated SKUs that live
// outside catalog.json. Activation is amount-gated: what cannot be re-priced
// here falls back to owner review instead of activating on a client's word.
const FIXED_SKUS = {
  "agent-compliance-agent": 250,
  "agent-shared-services-team": 1500,
  "companies-data-access": 375,
  "lead-generation": 375,
  "employer-plan-basic-monthly": 500, "employer-plan-basic-yearly": 4200,
  "employer-plan-pro-monthly": 1000, "employer-plan-pro-yearly": 8400,
  "employer-plan-enterprise-monthly": 2500, "employer-plan-enterprise-yearly": 21000,
};
function skuAmount(rawId, priceMap) {
  const id = String(rawId || "").toLowerCase();
  if (FIXED_SKUS[id] != null) return FIXED_SKUS[id];
  if (id.indexOf("employee-") === 0) return 500;
  const hit = priceMap[catalogKey(id)];
  return hit && hit.amount > 0 ? hit.amount : null;
}
async function settlePaidOrder(order, p) {
  if (!OTP_SECRET) {
    console.error("pay: settle skipped — OTP_SECRET is not set, so the sealed paid-order call cannot be made");
    return { ok: false, skipped: "no_otp_secret" };
  }
  const ids = (Array.isArray(order.items) ? order.items : []).slice(0, 40)
    .map((it) => ({ id: String((it && it.id) || "").slice(0, 80), qty: Math.max(1, Math.min(99, Number(it && it.qty) || 1)) }))
    .filter((x) => x.id);
  if (!ids.length) {
    console.error("pay: settle skipped — no basket item carried an id; order.items was",
      JSON.stringify((Array.isArray(order.items) ? order.items : []).slice(0, 8)));
    return { ok: false, skipped: "no_items" };
  }
  let priceMap = {};
  try { priceMap = await catalogPrices(); } catch { priceMap = {}; }
  let net = 0, unknown = false;
  const names = [], lines = [];
  for (const x of ids) {
    const a = skuAmount(x.id, priceMap);
    if (a == null) { unknown = true; names.push(x.id + " ×" + x.qty); continue; }
    net += a * x.qty;
    lines.push({ id: x.id, line: a * x.qty });
    const cat = priceMap[catalogKey(String(x.id).toLowerCase())];
    names.push((cat ? cat.name : x.id) + " ×" + x.qty);
  }
  net += Number(order.surchargeFee) || 0;
  const disc = await catalogDiscount(order.discountCode);
  // A scoped code cuts only from its own lines (never from the surcharge);
  // an unscoped code cuts from the whole net, exactly as the checkout showed.
  const discBase = disc && disc.services.length
    ? lines.reduce((s, l) => s + (discAppliesTo(disc, l.id) ? l.line : 0), 0)
    : net;
  const cut = discountCut(Math.min(discBase, net), disc);
  net -= cut;
  // Two riyals of tolerance for the rounding the cart and the form each do.
  const verified = !unknown && net > 0 && Math.abs(Math.round(net * 1.15 * 100) - Number(p.amount || 0)) <= 200;
  const payload = {
    v: 1, at: Date.now(), payId: String(p.id || ""), verified,
    ref: String(order.ref || "").slice(0, 40) || ("BP-" + String(p.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()),
    name: String(order.name || "").slice(0, 160),
    email: String(order.email || "").toLowerCase().slice(0, 160),
    phone: String(order.phone || "").slice(0, 40),
    company: String(order.company || (order.taxProfile && order.taxProfile.nameAr) || "").slice(0, 200),
    total: Math.round(Number(p.amount || 0)) / 100,
    ...(disc ? { disc: disc.code } : {}),
    ids, items: names,
  };
  try {
    const r = await fetch(SELF_BASE + "/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "paid-order", t: seal(payload) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return { ok: false, error: j.error || ("http_" + r.status), verified };
    return { ok: true, already: !!j.already, verified, activated: j.activated || null };
  } catch (e) {
    console.error("pay: settle call failed", String(e.message || e).slice(0, 160));
    return { ok: false, error: "settle_unreachable", verified };
  }
}
// A verified wallet top-up is handed to /api/requests {action:"wallet-paid"}
// under the same seal the cart settle uses: the browser names an amount, the
// gateway confirms it, and only the sealed server call can credit the ledger.
// Idempotent on the payment id, so webhook + callback credit exactly once.
async function settleWalletTopup(p) {
  if (!OTP_SECRET) return { ok: false, skipped: "no_otp_secret" };
  const meta = p.metadata || {};
  const payload = {
    v: 1, at: Date.now(), payId: String(p.id || ""),
    email: String(meta.email || "").toLowerCase().slice(0, 160),
    name: String(meta.name || "").slice(0, 160),
    ref: String(meta.ref || "").slice(0, 40),
    org: String(meta.org || "").slice(0, 60),
    amount: Math.round(Number(p.amount || 0)) / 100,
  };
  if (!payload.email || !(payload.amount > 0)) return { ok: false, skipped: "no_email_or_amount" };
  try {
    const r = await fetch(SELF_BASE + "/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "wallet-paid", t: seal(payload) }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? { ok: true, already: !!j.already, credited: !!j.credited, balance: j.balance } : { ok: false, error: j.error || ("http_" + r.status) };
  } catch (e) {
    console.error("pay: wallet settle call failed", String(e.message || e).slice(0, 160));
    return { ok: false, error: "settle_unreachable" };
  }
}

const RAW_CATALOG_URL = process.env.CATALOG_URL ||
  "https://raw.githubusercontent.com/businessKSA/business-partner-sa/claude/bpic-marketing-site-jvrnga/site/assets/data/catalog.json";
let _catCache = null, _catAt = 0;
const catalogKey = (id) => {
  const k = String(id || "").toLowerCase();
  return k.startsWith("svc-") || k.startsWith("pkg-") ? k.slice(4) : k;
};
async function catalogPrices() {
  if (_catCache && Date.now() - _catAt < 10 * 60 * 1000) return _catCache;
  const r = await fetch(RAW_CATALOG_URL);
  if (!r.ok) throw new Error("catalog_fetch_failed");
  const c = await r.json();
  const map = {};
  for (const sv of c.services || []) if (sv.code) map[String(sv.code).toLowerCase()] = { amount: Number(sv.amount) || 0, name: sv.nameAr || sv.nameEn || sv.code, code: String(sv.code).toUpperCase() };
  for (const pk of c.packages || []) {
    // The cart names a package by its key ("pkg-silver") while the invoice
    // names it by code (BP-PKG-LAUNCH) — index both so either resolves.
    const codeK = String(pk.code || pk.key || "").toLowerCase();
    const entry = { amount: Number(pk.amount) || 0, name: pk.nameAr || pk.nameEn || codeK, code: codeK.toUpperCase() };
    for (const k of [pk.code, pk.key].map((x) => String(x || "").toLowerCase()).filter(Boolean)) {
      if (!map[k]) map[k] = entry;
    }
  }
  _catCache = map; _catAt = Date.now();
  _catDiscounts = Array.isArray(c.discounts) ? c.discounts : [];
  return map;
}
// The discount the checkout applied, re-read from the published catalog — the
// browser names the code, this names the numbers. Returns null for anything
// unknown, inactive or expired, so an invented code discounts nothing.
let _catDiscounts = [];
async function catalogDiscount(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  try { await catalogPrices(); } catch { return null; }
  const hit = _catDiscounts.find((d) => String(d.code || "").toUpperCase() === c);
  if (!hit) return null;
  if (hit.expires && new Date(hit.expires + "T23:59:59Z") < new Date()) return null;
  const percent = Number(hit.percent) > 0 ? Math.min(90, Number(hit.percent)) : 0;
  const amount = Number(hit.amount) > 0 ? Number(hit.amount) : 0;
  if (!percent && !amount) return null;
  const services = Array.isArray(hit.services)
    ? hit.services.map((s) => catalogKey(String(s).toLowerCase())).filter(Boolean).slice(0, 60)
    : [];
  return { code: c, percent, amount, services };
}
// Does this discount reach this basket line? A code published with a services
// list discounts only those codes; an unscoped code discounts everything.
function discAppliesTo(d, idOrCode) {
  if (!d) return false;
  if (!Array.isArray(d.services) || !d.services.length) return true;
  return d.services.includes(catalogKey(String(idOrCode || "").toLowerCase()));
}
function discountCut(net, d) {
  if (!d || !(net > 0)) return 0;
  const cut = d.percent ? (net * d.percent) / 100 : Math.min(net, d.amount);
  return Math.round(cut * 100) / 100;
}

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Who the invoice is made out to. A company invoice needs a 15-digit VAT
// number; anything short of that is a personal (simplified) invoice, because
// a standard tax invoice carrying a wrong number can only be voided.
function billTo(order) {
  const tp = (order && order.taxProfile) || {};
  const company = tp.kind === "company" && String(tp.vat || "").replace(/\D/g, "").length === 15;
  const addr = tp.address || {};
  return {
    name: company ? String(tp.nameAr || "").slice(0, 200) : String(order.name || "").slice(0, 200),
    email: String(order.email || "").toLowerCase(),
    phone: String(company ? (tp.contactPhone || order.phone) : order.phone || "").slice(0, 20),
    city: String(addr.city || "").slice(0, 60),
    taxNumber: company ? String(tp.vat).replace(/\D/g, "") : "",
    address: company ? addr : null,
    isCompany: company,
    contact: company ? String(tp.contact || "").slice(0, 120) : "",
  };
}

async function invoicePaidOrder(order, paidHalalas, payId = "") {
  if (!daftraConfigured()) return { invoiced: false, reason: "daftra_not_configured" };
  const items = [];
  let net = 0;
  // A bespoke quote is not in the published catalogue: its lines are the price
  // list. They are re-read from the order with the link's own token, so the
  // figure still comes from the server and never from the browser.
  if (order.quoteId && order.t) {
    const priced = await quotePriced(String(order.quoteId), String(order.t));
    if (!priced) return { invoiced: false, reason: "quote_not_found" };
    // The order reference belongs to the record, not to the page that posted:
    // a browser that could name the reference could invoice someone else's job.
    order = { ...order, ref: priced.order.clientRef || priced.order.ref || order.ref || "" };
    for (const l of priced.order.lines || []) {
      const qty = Math.max(1, Math.min(999, Number(l.qty) || 1));
      net += l.price * qty;
      items.push({ name: String(l.name).slice(0, 140), quantity: qty, unitPrice: l.price });
    }
    if (!items.length && priced.net > 0) {
      net = priced.net;
      items.push({ name: String(priced.order.service || "خدمة").slice(0, 140), quantity: 1, unitPrice: priced.net });
    }
  } else {
    const prices = await catalogPrices();
    const rows = (Array.isArray(order.items) ? order.items : []).slice(0, 40);
    for (const it of rows) {
      const hit = prices[catalogKey(it.id)];
      if (!hit || !(hit.amount > 0)) continue;
      const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
      net += hit.amount * qty;
      items.push({ code: hit.code, name: hit.name, quantity: qty, unitPrice: hit.amount });
    }
    // A discount the checkout applied scales every line, so the tax invoice
    // states the prices the buyer actually paid and its total matches the
    // charge to the halala — a negative "discount line" is what Daftra rejects.
    const invDisc = await catalogDiscount(order.discountCode);
    // A scoped code discounts only its own lines; the others keep list price.
    const eligNet = invDisc && invDisc.services.length
      ? items.reduce((s, it) => s + (discAppliesTo(invDisc, it.code) ? it.unitPrice * it.quantity : 0), 0)
      : net;
    const invCut = discountCut(Math.min(eligNet, net), invDisc);
    if (invCut > 0 && eligNet > 0) {
      const factor = (eligNet - invCut) / eligNet;
      net = 0;
      for (const it of items) {
        if (discAppliesTo(invDisc, it.code)) {
          it.unitPrice = Math.round(it.unitPrice * factor * 100) / 100;
          it.name = String(it.name).slice(0, 120) + ` (بعد خصم ${invDisc.code})`;
        }
        net += it.unitPrice * it.quantity;
      }
    }
  }
  if (!items.length) return { invoiced: false, reason: "no_priced_items" };

  const rate = Number(daftraVatRate()) || 15;
  const expected = Math.round(net * (1 + rate / 100) * 100);
  // Halalas, compared with a one-riyal tolerance for the rounding the cart and
  // the payment form each do on their own side.
  if (Math.abs(expected - Number(paidHalalas || 0)) > 100) {
    console.error("pay: basket does not match the charge", { expected, paid: paidHalalas, ref: order.ref });
    return { invoiced: false, reason: "amount_mismatch", expected, paid: Number(paidHalalas || 0) };
  }

  // Who the invoice belongs to. On the quote path the buyer is whoever the CRM
  // says owns that reference — the signing page never collects it again, and a
  // page that could name its own buyer could name someone else's.
  let buyer = order;
  if (order.quoteId && (!order.email || !order.name)) {
    const c = await contactForRef(String(order.ref || "")).catch(() => null);
    if (c) buyer = { ...order, name: order.name || c.name, email: order.email || c.email, phone: order.phone || c.phone };
  }
  const who = billTo(buyer);
  if (!who.name || !isEmail(who.email)) return { invoiced: false, reason: "missing_buyer" };
  const { client } = await daftraFindOrCreateClient(who);
  if (!client || !client.id) return { invoiced: false, reason: "client_failed" };
  const notes = [
    order.ref ? `مرجع الطلب: ${order.ref}` : "",
    "مدفوعة إلكترونياً عبر الموقع",
    who.isCompany ? `الرقم الضريبي: ${who.taxNumber}` : "",
    who.isCompany && who.address ? `العنوان الوطني: ${nationalAddressLine(who.address)}` : "",
    who.contact ? `الشخص المسؤول: ${who.contact}` : "",
  ].filter(Boolean).join("\n");
  const inv = await daftraCreateInvoice({ clientId: client.id, items, notes, ref: order.ref || "" });

  // Settle the invoice in the books with the money Moyasar took, under the
  // gateway's own transaction id — so the invoice reads «مدفوعة», not
  // «مستحقة», with no hand-recording. A failure here never voids the sale:
  // the invoice stands and the owner gets one email naming what to record.
  let paymentRecorded = false;
  try {
    await daftraRecordPayment({ invoiceId: inv.id, amount: inv.total, transactionId: payId, method: "Moyasar" });
    paymentRecorded = true;
  } catch (e) {
    console.error("pay: daftra payment record failed", String(e.message || e).slice(0, 160), String(e.detail || "").slice(0, 160));
    await sendMail(OWNER_EMAIL, `⚠️ فاتورة ${inv.number} صدرت والدفعة لم تُسجَّل في الدفترة`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right"><p>الفاتورة <b>${esc(inv.number)}</b> صدرت بنجاح بإجمالي <b>${inv.total} ﷼</b> بعد دفعة ميسر مؤكدة${payId ? ` (رقم العملية <b style="direction:ltr;display:inline-block">${esc(payId)}</b>)` : ""}، لكن تسجيل السداد على الفاتورة في الدفترة تعذّر آلياً.</p><p><b>المطلوب:</b> افتح الفاتورة في الدفترة وسجّل عليها دفعة بقيمة ${inv.total} ﷼ بطريقة «Moyasar».</p></div>`);
  }

  let pdf = null;
  try { pdf = await daftraDocPdf("invoice", inv.id); } catch { pdf = null; }
  // Already paid on this path, so no pay button — but the link is returned so
  // the owner can open the invoice the client received.
  let payUrl = "";
  try { payUrl = (await daftraPayLink(inv.id)).url; } catch { payUrl = ""; }

  if (pdf) {
    await sendMail(who.email, `فاتورة ${inv.number} — بيزنس بارتنر`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right">
        <h2 style="color:#0B1B5A">فاتورتك الضريبية من بيزنس بارتنر</h2>
        <p>شكراً لك — تم استلام دفعتك بنجاح.</p>
        <p>رقم الفاتورة: <b>${esc(inv.number)}</b>${order.ref ? ` · مرجع الطلب: <b style="direction:ltr;display:inline-block">${esc(order.ref)}</b>` : ""}</p>
        <p style="line-height:2">الإجمالي قبل الضريبة: <b>${inv.net} ﷼</b><br>ضريبة القيمة المضافة (${rate}%): <b>${inv.vat} ﷼</b><br>الإجمالي المدفوع: <b style="color:#0B1B5A;font-size:18px">${inv.total} ﷼</b></p>
        <p style="color:#0B1B5A">الفاتورة الضريبية بصيغة PDF مرفقة مع هذه الرسالة.</p>
        <p style="color:#94a3b8;font-size:12px">فاتورة ضريبية صادرة عبر نظام الدفترة ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك.</p></div>`,
      [{ filename: `TAX_Invoice-${String(inv.number).replace(/[^\w-]/g, "")}.pdf`, content: pdf.base64 }]);
  } else {
    // No PDF. Before falling back to a manual step, try Daftra's own page for
    // this invoice — same document, same numbering, same books, and nothing
    // issued by us. It is only used when a client can actually open it.
    let pub = null;
    try { pub = await daftraPublicInvoiceLink(inv.id, inv.publicUrl || inv.url || ""); } catch { pub = null; }
    if (pub && pub.url) {
      await sendMail(who.email, `فاتورة ${inv.number} — بيزنس بارتنر`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right">
          <h2 style="color:#0B1B5A">فاتورتك الضريبية من بيزنس بارتنر</h2>
          <p>شكراً لك — تم استلام دفعتك بنجاح.</p>
          <p>رقم الفاتورة: <b>${esc(inv.number)}</b>${order.ref ? ` · مرجع الطلب: <b style="direction:ltr;display:inline-block">${esc(order.ref)}</b>` : ""}</p>
          <p style="line-height:2">الإجمالي قبل الضريبة: <b>${inv.net} ﷼</b><br>ضريبة القيمة المضافة (${rate}%): <b>${inv.vat} ﷼</b><br>الإجمالي المدفوع: <b style="color:#0B1B5A;font-size:18px">${inv.total} ﷼</b></p>
          <p style="margin:18px 0"><a href="${esc(pub.url)}" style="background:#0B1B5A;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">افتح فاتورتك الضريبية</a></p>
          <p style="color:#94a3b8;font-size:12px">فاتورة ضريبية صادرة عبر نظام الدفترة ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك.</p></div>`);
      return { invoiced: true, number: inv.number, total: inv.total, pdfAttached: false, clientEmailed: true, deliveredBy: "daftra_link", payUrl };
    }
    // The client is not sent a message with no invoice in it. The owner is,
    // because they can attach the file from the panel in under a minute.
    await sendMail(OWNER_EMAIL, `⚠️ فاتورة ${inv.number} تحتاج إرفاق PDF يدوياً`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
        <p>دفع العميل <b>${esc(who.name)}</b> (${esc(who.email)}) وصدرت الفاتورة <b>${esc(inv.number)}</b> بإجمالي <b>${inv.total} ﷼</b>.</p>
        <p>الدفترة ما سلّمت الملف المطبوع، فما أُرسلت للعميل رسالة بلا فاتورة.</p>
        <p><b>المطلوب:</b> افتح لوحة التحكم ← الأدوات ← «تصحيح فاتورة صادرة»، ابحث عن ${esc(inv.number)}، أرفق ملف PDF من الدفترة واضغط أرسل.</p></div>`);
  }
  return { invoiced: true, number: inv.number, total: inv.total, paymentRecorded, pdfAttached: !!pdf, clientEmailed: !!pdf, payUrl };
}

async function notion(path, method, payload) {
  return fetch("https://api.notion.com/v1/" + path, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// Best-effort: find the client's intake row by company+code and flip it to
// active, then email them. Never throws — payment verification already
// succeeded by the time this runs, so a Notion/email hiccup shouldn't turn
// a successful payment into an error response.
async function activateCompliance(company, code) {
  if (!NOTION_TOKEN || !company || !code) return { activated: false };
  try {
    const q = await notion(`databases/${COMPLIANCE_DB}/query`, "POST", {
      filter: { property: "المنشأة", title: { equals: company } },
    });
    if (!q.ok) return { activated: false };
    const data = await q.json();
    const page = (data.results || [])[0];
    if (!page) return { activated: false };
    const codeProp = (page.properties || {})["رمز الدخول"] || {};
    const storedCode = (codeProp.rich_text && codeProp.rich_text[0] && codeProp.rich_text[0].plain_text) || "";
    if (!storedCode || storedCode !== code) return { activated: false };

    const patchRes = await notion(`pages/${page.id}`, "PATCH", {
      properties: { "حالة الاشتراك": { select: { name: "نشط" } } },
    });
    if (!patchRes.ok) return { activated: false };

    const emailProp = (page.properties || {})["البريد"] || {};
    const email = emailProp.email || "";
    const brand = "#0B1B5A";
    const html = `<div style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;color:#111">
      <h2 style="color:${brand}">✅ تم تفعيل خدمة وكيل الامتثال</h2>
      <p>مرحباً،</p>
      <p>تم تأكيد الدفع وتفعيل اشتراك <strong>${company}</strong> في وكيل الامتثال. لوحتك مفتوحة الآن.</p>
      <p><a href="https://businesspartner.sa/ar/portal" style="background:${brand};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">📊 دخول لوحة التحكم</a></p>
      <p style="color:#666">استخدم رمز الدخول الذي وصلك عند التسجيل.</p>
    </div>`;
    await sendMail(email, "تم تفعيل خدمة وكيل الامتثال — Business Partner", html);
    return { activated: true };
  } catch (e) {
    console.error("activateCompliance error", String(e).slice(0, 200));
    return { activated: false };
  }
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

// ---------------------------------------------------------------------------
// Companies data portal (merged here to stay under the Vercel Hobby 12-function
// cap). GET /api/pay?resource=leads[&code=&cursor=&q=&sector=&city=] serves the
// "BP — Companies Sales DB" Notion database (built by the n8n collectors) behind
// an access code, for the paid data-access portal at /data. Without a valid code
// only a non-PII teaser is returned.
const LEADS_DB = process.env.NOTION_LEADS_DB || "26faca2761884b6ab584924c374f2d22";
const leadsCodes = () => {
  // ENV-ONLY: this repo is public, so a hardcoded demo code here would be a
  // public key to a PII database (company contacts). Set LEADS_ACCESS_CODES
  // (comma-separated) in Vercel to grant access.
  const raw = process.env.LEADS_ACCESS_CODES || process.env.LEADS_KEY || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};
const leadsCodeOk = (code) => {
  const c = String(code || "").trim();
  return !!c && leadsCodes().some((k) => k.toLowerCase() === c.toLowerCase());
};
// Codes minted automatically on a confirmed online payment (BP-DATA-XXXXXX,
// written on the CRM row by /api/requests {action:"paid-order"}). Valid while
// the order's status stays confirmed — cancelling the row revokes the code.
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const CONFIRMED_STATUSES = new Set(["مؤكد - قيد التنفيذ", "مكتمل"]);
async function dataCodeOk(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^BP-DATA-[A-Z2-9]{6}$/.test(c) || !NOTION_TOKEN) return false;
  try {
    const r = await notion(`databases/${CRM_DB}/query`, "POST", {
      page_size: 1,
      filter: { property: "Notes", rich_text: { contains: "DATACODE:" + c } },
    });
    if (!r.ok) return false;
    const pg = (((await r.json()) || {}).results || [])[0];
    const st = pg && pg.properties && pg.properties["حالة الطلب"] && pg.properties["حالة الطلب"].select && pg.properties["حالة الطلب"].select.name;
    return CONFIRMED_STATUSES.has(st || "");
  } catch { return false; }
}
const lTitle = (p) => ((p && p.title) || []).map((t) => t.plain_text).join("").trim();
const lText = (p) => ((p && p.rich_text) || []).map((t) => t.plain_text).join("").trim();
const lSel = (p) => (p && p.select && p.select.name) || "";
async function leadsQuery(body) {
  const r = await fetch(`https://api.notion.com/v1/databases/${LEADS_DB}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "content-type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j && j.message ? j.message : `notion ${r.status}`);
  return j;
}
function leadsMap(page) {
  const pr = page.properties || {};
  return {
    name: lTitle(pr["Name"]),
    sector: lSel(pr["Sector"]),
    city: lSel(pr["City"]),
    ownership: lSel(pr["Ownership"]),
    phone: (pr["Phone"] && pr["Phone"].phone_number) || "",
    email: (pr["Email"] && pr["Email"].email) || "",
    website: (pr["Domain"] && pr["Domain"].url) || "",
    linkedin: (pr["LinkedIn"] && pr["LinkedIn"].url) || "",
    maps: (pr["Maps"] && pr["Maps"].url) || "",
    description: lText(pr["Description"]),
  };
}
async function handleLeads(req, res) {
  const q = req.query || {};
  const code = q.code;
  if (!code) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, unlocked: false,
      teaser: {
        sectors: ["Contracting & Construction", "Manufacturing & Industry", "Healthcare",
          "IT & Services", "Logistics & Transport", "Retail & Restaurants", "Real Estate",
          "Hospitality & Tourism", "Finance & Insurance", "Education", "Defense & Security"],
        cities: ["Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Tabuk", "Abha"],
      },
    }));
  }
  if (!leadsCodeOk(code) && !(await dataCodeOk(code))) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "invalid_code" })); }
  if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
  try {
    const and = [];
    if (q.sector) and.push({ property: "Sector", select: { equals: String(q.sector) } });
    if (q.city) and.push({ property: "City", select: { equals: String(q.city) } });
    const contact = { or: [
      { property: "Phone", phone_number: { is_not_empty: true } },
      { property: "Email", email: { is_not_empty: true } },
    ] };
    const notDup = { property: "Duplicate", checkbox: { equals: false } };
    const body = { page_size: 50, filter: { and: [...and, notDup, contact] },
      sorts: [{ property: "Sector", direction: "ascending" }] };
    if (q.cursor) body.start_cursor = String(q.cursor);
    const data = await leadsQuery(body);
    let rows = (data.results || []).map(leadsMap).filter((r) => r.name);
    const term = String(q.q || "").trim().toLowerCase();
    if (term) rows = rows.filter((r) => [r.name, r.sector, r.city, r.description].join(" ").toLowerCase().includes(term));
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, unlocked: true, rows, next_cursor: data.next_cursor || "", has_more: !!data.has_more }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Called cross-origin from the brand's own domains only (the compliance
  // product used to live on a separate origin). Wildcard CORS on a payment
  // endpoint invites hostile pages to drive it from users' browsers.
  const ALLOWED_ORIGINS = new Set([
    "https://www.businesspartner.sa",
    "https://businesspartner.sa",
  ]);
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  // Companies data portal endpoint (see handleLeads above).
  if ((req.query && (req.query.resource === "leads" || req.query.leads))) {
    return handleLeads(req, res);
  }

  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      enabled: !!PK,
      provider: "moyasar",
      // Whether this deployment can verify a payment at all. Booleans only —
      // no key, no prefix, no length. Without it, "the variable is not set in
      // production" and "the key is set but wrong" produce the identical 401
      // and are indistinguishable from outside, which is how a broken payment
      // path stayed broken across a fix that could never have addressed it.
      canVerify: !!SK,
      // Both keys must describe the same Moyasar environment: a live form
      // charging real cards while verification asks a test account is a 401
      // that looks like a bad key and is not one.
      modeMatch: !PK || !SK || /^pk_live_/.test(PK) === /^sk_live_/.test(SK),
      publishableKey: PK || null,
      scriptUrl: MPF_JS,
      cssUrl: MPF_CSS,
      currency: "SAR",
      methods: PAY_METHODS,
      applePay: PAY_METHODS.includes("applepay")
        ? { country: "SA", label: APPLE_PAY_LABEL, validate_merchant_url: APPLE_PAY_VALIDATE_URL }
        : null,
      // Installments (BNPL): Tamara flips on the day its key lands in Vercel —
      // until then the checkout shows its button as «قريباً».
      bnpl: { tamara: tamaraConfigured() },
    }));
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }

  if (!SK) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
  }

  const b = await readBody(req);

  /* ---- recover payments the site never recorded ---------------------------
   * While MOYASAR_SECRET_KEY was wrong, three things failed together for every
   * card payment: the browser could not confirm it, the webhook discarded the
   * event, and the webhook's 200 told Moyasar to stop retrying. So the money
   * moved, the orders sat at «قيد المراجعة», and nothing will ever arrive on
   * its own to fix that — the redelivery that would have has been cancelled.
   *
   * This asks Moyasar for its own record of what was paid and replays each one
   * through the exact path a live payment takes. Every step it calls is
   * idempotent on the order reference, so a payment already settled is
   * reported as such and touched no further: running this twice cannot double
   * an invoice or an activation.
   */
  if (b.action === "reconcile") {
    if (!panelOk(b)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!SK) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "no_secret_key" })); }
    const limit = Math.min(100, Math.max(1, Number(b.limit) || 50));
    // A dry run answers "what was actually bought?" without changing anything —
    // worth having separately, because the first question after an outage is
    // what happened, not what to do about it.
    const dry = b.apply !== true;

    let payments = [];
    try {
      const r = await fetch(`https://api.moyasar.com/v1/payments?limit=${limit}`, {
        headers: { Authorization: "Basic " + Buffer.from(SK + ":").toString("base64") },
      });
      const text = await r.text();
      if (!r.ok) {
        console.error("reconcile: moyasar list failed", r.status, text.slice(0, 200));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: `moyasar_http_${r.status}`, detail: text.slice(0, 200) }));
      }
      const data = JSON.parse(text);
      payments = Array.isArray(data.payments) ? data.payments : [];
    } catch (e) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "moyasar_unreachable", detail: String(e.message || e).slice(0, 140) }));
    }

    const rows = [];
    for (const p of payments) {
      const meta = p.metadata || {};
      const ref = String(meta.ref || "").trim();
      const itemsRaw = String(meta.items || "").trim();
      const row = {
        id: p.id,
        at: p.created_at || p.updated_at || "",
        amount: Math.round(Number(p.amount) || 0) / 100,
        currency: p.currency || "SAR",
        status: p.status,
        ref,
        buyer: String(meta.email || meta.name || "").slice(0, 80),
        description: String(p.description || "").slice(0, 120),
        items: itemsRaw ? itemsRaw.split(",").map((x) => String(x.split("~")[0] || "").trim()).filter(Boolean) : [],
      };
      if (p.status !== "paid") { row.action = "skipped_not_paid"; rows.push(row); continue; }
      if (!ref || !itemsRaw) {
        // A quote payment or a wallet top-up carries different metadata; those
        // are named rather than guessed at, so nothing is settled on a shape
        // this was not written for.
        row.action = meta.quoteId ? "quote_payment_not_handled_here"
          : String(meta.wallet || "") === "topup" ? "wallet_topup_not_handled_here"
          : "no_order_metadata";
        rows.push(row); continue;
      }
      if (dry) { row.action = "would_recover"; rows.push(row); continue; }

      const order = {
        ref,
        name: String(meta.name || ""), email: String(meta.email || ""), phone: String(meta.phone || ""),
        company: String(meta.co || ""), discountCode: String(meta.disc || ""),
        items: itemsRaw.split(",").map((x) => {
          const m = x.split("~");
          return { id: String(m[0] || "").trim(), qty: Math.max(1, Math.min(99, Number(m[1]) || 1)) };
        }).filter((x) => x.id),
      };
      try {
        const settle = await settlePaidOrder(order, p);
        row.settled = !!(settle && settle.ok);
        row.already = !!(settle && settle.already);
        if (settle && settle.ok && !settle.already) {
          try { await markOrderPaid(ref, { total: row.amount, method: "online" }); } catch (e) {
            console.error("reconcile: announce failed", ref, String(e.message || e).slice(0, 120));
          }
          try {
            const inv = await invoicePaidOrder(order, p.amount, p.id);
            row.invoice = inv && inv.number ? String(inv.number) : null;
            row.invoiced = !!(inv && inv.invoiced);
          } catch (e) {
            row.invoiced = false;
            row.invoiceError = String(e.message || e).slice(0, 120);
          }
        }
        row.action = row.already ? "already_settled" : (row.settled ? "recovered" : "settle_failed");
      } catch (e) {
        row.action = "failed";
        row.error = String(e.message || e).slice(0, 140);
      }
      rows.push(row);
    }

    const recovered = rows.filter((r) => r.action === "recovered").length;
    console.log("reconcile", dry ? "(dry)" : "(applied)", "checked", rows.length, "recovered", recovered);
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, dryRun: dry, checked: rows.length,
      paid: rows.filter((r) => r.status === "paid").length,
      pending: rows.filter((r) => r.action === "would_recover").length,
      recovered, rows,
    }));
  }

  // ---- Moyasar webhook ----------------------------------------------------
  // The browser callback is not a guarantee: a client who pays and closes the
  // tab before 3-D Secure returns has paid, and the site never hears about it.
  // The webhook is the same confirmation arriving over a channel the client
  // cannot interrupt.
  const isWebhook = typeof b.secret_token === "string" || (b.type && b.data && typeof b.data === "object");
  if (isWebhook) {
    if (!WEBHOOK_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "webhook_not_configured" })); }
    const got = Buffer.from(String(b.secret_token || ""));
    const want = Buffer.from(WEBHOOK_SECRET);
    const tokenOk = got.length === want.length && crypto.timingSafeEqual(got, want);
    if (!tokenOk) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "bad_token" })); }

    const d = b.data || {};
    const pid = String(d.id || "").trim();
    if (!/^[a-zA-Z0-9_-]{10,64}$/.test(pid)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_payment_id" })); }

    // The body says it was paid; Moyasar's API is asked whether it was. A
    // webhook body is still input, and money is the last thing to take on
    // trust from a request.
    let p = null, verifyFailed = "";
    try {
      const r = await fetch(`https://api.moyasar.com/v1/payments/${pid}`, {
        headers: { Authorization: "Basic " + Buffer.from(SK + ":").toString("base64") },
      });
      if (r.ok) p = await r.json();
      else verifyFailed = `http_${r.status}`;
    } catch (e) { verifyFailed = "unreachable"; }

    // "Moyasar says this was not paid" and "we could not ask Moyasar" were
    // sharing one branch, and both answered 200. A 200 tells Moyasar the event
    // was handled and it stops retrying — so a broken key did not merely make
    // the safety net fail, it destroyed the redelivery that would have caught
    // the payment once the key was fixed. This is the second half of the
    // outage that reached a live customer: the browser said the payment
    // failed, and the webhook that should have saved it threw it away.
    if (verifyFailed) {
      console.error("pay webhook: could not verify a paid event", pid, verifyFailed);
      // One alert per payment per instance — Moyasar's retries must not turn
      // into a mailbox full of the same warning.
      const seen = (globalThis.__bpWebhookAlerted ||= new Set());
      if (!seen.has(pid)) {
        seen.add(pid);
        try {
          await sendMail(OWNER_EMAIL, `🚨 إشعار دفعة من مُيسّر تعذّر التحقق منه — ${pid}`,
            `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;max-width:560px">
              <h2 style="color:#b91c1c">وصل إشعار دفعة ولم نتمكّن من تأكيده</h2>
              <p>مُيسّر أبلغنا بدفعة، وحين سألناه عنها رفض الطلب. لم نسجّل الطلب ولم نصدر فاتورة.</p>
              <table>
                <tr><td style="padding:4px 10px;color:#666">رقم الدفعة</td><td style="padding:4px 10px"><b style="direction:ltr;display:inline-block">${esc(pid)}</b></td></tr>
                <tr><td style="padding:4px 10px;color:#666">سبب الفشل</td><td style="padding:4px 10px"><b style="direction:ltr;display:inline-block">${esc(verifyFailed)}</b></td></tr>
              </table>
              <p><b>الأرجح:</b> ${verifyFailed === "http_401"
                ? "مفتاح <span style=\"direction:ltr;display:inline-block\">MOYASAR_SECRET_KEY</span> غير صحيح أو فيه فراغ زائد."
                : "تعذّر الوصول إلى مُيسّر مؤقتاً."}</p>
              <p style="color:#166534">طلبنا من مُيسّر إعادة إرسال الإشعار، فمتى صحّ المفتاح سيُلتقط تلقائياً.</p>
            </div>`);
        } catch (e) { console.error("pay webhook: alert email failed", String(e.message || e).slice(0, 120)); }
      }
      // Refuse the delivery on purpose: Moyasar retries a failed webhook, and
      // a retry after the key is fixed is the difference between a payment
      // that recovers itself and one lost for good.
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: "verify_unavailable", retry: true }));
    }

    if (p.status !== "paid") {
      // Acknowledge: a 200 stops Moyasar retrying an event we correctly ignored.
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, ignored: true, status: p.status }));
    }

    const meta = p.metadata || d.metadata || {};
    const quoteId = String(meta.quoteId || "").trim();
    const tok = String(meta.t || "").trim();
    const ref = String(meta.ref || "").trim();
    // Cart payments carry the basket in the payment's own metadata, so a
    // client who pays and closes the tab before 3-D Secure returns still gets
    // recorded, activated and (when the invoice can be issued safely) invoiced.
    // The paid-order endpoint is idempotent on the reference, so whichever of
    // the webhook and the browser callback arrives second is a no-op.
    // Wallet top-ups settle through their own sealed call — the money becomes
    // ledger balance, not an order.
    if (String(meta.wallet || "") === "topup") {
      const w = await settleWalletTopup(p);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, handled: true, wallet: true, credited: !!(w && w.credited), already: !!(w && w.already) }));
    }
    if (!quoteId || !tok) {
      const cartItems = String(meta.items || "").trim();
      if (ref && cartItems) {
        const order = {
          ref,
          name: String(meta.name || ""), email: String(meta.email || ""), phone: String(meta.phone || ""),
          company: String(meta.co || ""),
          discountCode: String(meta.disc || ""),
          items: cartItems.split(",").map((s) => {
            const m = s.split("~");
            return { id: String(m[0] || "").trim(), qty: Math.max(1, Math.min(99, Number(m[1]) || 1)) };
          }).filter((x) => x.id),
        };
        let cartSettle = null;
        try { cartSettle = await settlePaidOrder(order, p); }
        catch (e) { console.error("pay webhook: cart settle failed", String(e.message || e).slice(0, 160)); }
        let cartInvoice = null;
        if (cartSettle && cartSettle.ok && !cartSettle.already) {
          if (String(meta.tax || "") === "company") {
            // A standard (company) tax invoice needs the full tax profile,
            // which never fits in payment metadata — issuing a personal one
            // instead would mean a void and a reissue. The owner issues it
            // from the panel; the client's money and activation are not held.
            await sendMail(OWNER_EMAIL, `🧾 فاتورة منشأة تصدر يدوياً — ${ref}`,
              `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right"><p>دفعة إلكترونية مؤكدة (${Math.round(p.amount) / 100} ﷼) على الطلب <b style="direction:ltr;display:inline-block">${esc(ref)}</b> والعميل طلب فاتورة باسم منشأة، لكن الدفع اكتمل دون رجوع المتصفح فلم تصلنا بيانات المنشأة الضريبية كاملة.</p><p><b>المطلوب:</b> افتح لوحة التحكم ← الفواتير، وأصدر الفاتورة يدوياً ببيانات المنشأة من صف الطلب ${esc(ref)}.</p></div>`);
            cartInvoice = { invoiced: false, reason: "company_invoice_manual" };
          } else {
            try { cartInvoice = await invoicePaidOrder(order, p.amount, pid); }
            catch (e) {
              console.error("pay webhook: cart invoice failed", String(e.message || e).slice(0, 200));
              cartInvoice = { invoiced: false, reason: String(e.message || "invoice_failed") };
            }
          }
        }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, handled: true, cart: true, settled: !!(cartSettle && cartSettle.ok), already: !!(cartSettle && cartSettle.already), ...(cartInvoice ? { invoice: cartInvoice } : {}) }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, ignored: true, reason: "no_settle_metadata" }));
    }

    let marked = null, invoicing = null;
    try { marked = await markOrderPaid(ref, { total: Math.round(p.amount) / 100, method: "online" }); }
    catch (e) { console.error("pay webhook: mark failed", String(e.message || e).slice(0, 160)); }
    if (marked && marked.recorded) {
      try { invoicing = await invoicePaidOrder({ ref, quoteId, t: tok }, p.amount, pid); }
      catch (e) {
        console.error("pay webhook: invoice failed", String(e.message || e).slice(0, 200));
        invoicing = { invoiced: false, reason: String(e.message || "invoice_failed") };
      }
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, handled: true, recorded: !!(marked && marked.recorded), ...(invoicing ? { invoice: invoicing } : {}) }));
  }

  // ---- BNPL (Tamara): create a hosted-checkout session ---------------------
  // The basket is re-priced from the catalog server-side — the browser names
  // items, never amounts — and the buyer is redirected to Tamara's page.
  //
  // `provider` بقي في المسار والردّ رغم أن المزوّد واحد: الروابط العائدة
  // (`?bnpl=tamara`) قد تكون في يد عميل الآن، وتغيير شكلها يكسر عودته.
  if (b.action === "bnpl-checkout") {
    const provider = "tamara";
    if (!tamaraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    const order = (b.order && typeof b.order === "object") ? b.order : {};
    const rawItems = (Array.isArray(order.items) ? order.items : []).slice(0, 40)
      .map((it) => ({ id: String((it && it.id) || "").slice(0, 80), qty: Math.max(1, Math.min(99, Number(it && it.qty) || 1)) }))
      .filter((x) => x.id);
    if (!rawItems.length || !isEmail(String(order.email || ""))) {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_order" }));
    }
    let priceMap = {}; try { priceMap = await catalogPrices(); } catch {}
    let net = 0, unknown = false; const items = []; const lines = [];
    for (const x of rawItems) {
      const a = skuAmount(x.id, priceMap);
      if (a == null) { unknown = true; continue; }
      const cat = priceMap[catalogKey(String(x.id).toLowerCase())];
      net += a * x.qty;
      lines.push({ id: x.id, line: a * x.qty });
      items.push({ id: x.id, name: cat ? cat.name : x.id, qty: x.qty, unit: a });
    }
    net += Number(order.surchargeFee) || 0;
    if (unknown || !(net > 0)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "quote_only_items" })); }
    const disc = await catalogDiscount(order.discountCode);
    const discBase = disc && disc.services.length
      ? lines.reduce((s, l) => s + (discAppliesTo(disc, l.id) ? l.line : 0), 0)
      : net;
    const cut = discountCut(Math.min(discBase, net), disc);
    if (cut > 0 && net > 0) {
      // Scale the provider's line items too, so their page shows the same
      // numbers our invoice will carry.
      const factor = (net - cut) / net;
      for (const it of items) it.unit = Math.round(it.unit * factor * 100) / 100;
      net -= cut;
    }
    const totalSar = Math.round(net * 1.15 * 100) / 100;
    const ref = String(order.ref || "BP-" + Date.now().toString().slice(-6)).slice(0, 40);
    const back = `${SELF_BASE}/${String(b.lang || "") === "en" ? "" : "ar/"}checkout`;
    const urls = {
      success: `${back}?bnpl=${provider}&bnpl_status=success`,
      cancel: `${back}?bnpl=${provider}&bnpl_status=cancel`,
      failure: `${back}?bnpl=${provider}&bnpl_status=failure`,
      notification: `${SELF_BASE}/api/pay`,
    };
    try {
      const sess = await createTamaraSession({ order: { ...order, ref }, totalSar, items, urls });
      if (!sess.ok) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: sess.rejected ? "rejected" : (sess.error || "session_failed"), reason: sess.reason || "" }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, url: sess.url, ref, total: totalSar, provider }));
    } catch (e) {
      console.error("bnpl session failed", provider, String(e.message || e), String(e.detail || "").slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "session_failed" }));
    }
  }

  // ---- BNPL: the buyer is back — verify with the provider, capture, settle.
  // The verified amount feeds the exact same sealed pipeline the card path
  // uses, so activation + CRM + tax invoice all run with no owner click.
  if (b.action === "bnpl-verify") {
    const provider = "tamara";
    if (!tamaraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    let v = null;
    try {
      v = await verifyTamaraOrder(b.id);
    } catch (e) {
      console.error("bnpl verify failed", provider, String(e.message || e), String(e.detail || "").slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "verify_failed" }));
    }
    if (!v || !v.paid) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, status: (v && v.status) || "unpaid" })); }
    const p = { id: `${provider}_${v.id}`, amount: Math.round(v.amountSar * 100) };
    let settle = null, invoicing = null;
    const order = (b.order && typeof b.order === "object") ? b.order : null;
    if (order && Array.isArray(order.items) && order.items.length) {
      try { settle = await settlePaidOrder(order, p); }
      catch (e) { console.error("bnpl settle failed", String(e.message || e).slice(0, 160)); }
      // The snapshot carries the full tax profile (same as the card path), so
      // billTo decides company vs simplified invoice on its own.
      if (settle && settle.already) invoicing = { invoiced: false, reason: "already_settled" };
      else {
        try { invoicing = await invoicePaidOrder(order, p.amount, p.id); }
        catch (e) { invoicing = { invoiced: false, reason: String(e.message || "invoice_failed") }; }
      }
    }
    if (!v.captured) {
      await sendMail(OWNER_EMAIL, `⚠️ دفعة أقساط (${provider}) مؤكدة لكن لم تُقبض — أكمل القبض يدوياً`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right"><p>الموافقة تمت والعميل أنهى الدفع، لكن نداء القبض (capture) لم يكتمل. ادخل لوحة تمارا واقبض العملية يدوياً.</p><p>المعرف: <b style="direction:ltr;display:inline-block">${esc(String(v.id))}</b> · المبلغ: <b>${v.amountSar} ﷼</b>${v.captureError ? `<br>الخطأ: ${esc(v.captureError)}` : ""}</p></div>`).catch(() => {});
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, provider, amount: p.amount, captured: !!v.captured,
      ...(invoicing ? { invoice: invoicing } : {}),
      ...(settle ? { settle: { ok: settle.ok, already: !!settle.already, verified: !!settle.verified, activated: settle.activated || null } } : {}),
    }));
  }

  const id = String(b.id || "").trim();
  if (!/^[a-zA-Z0-9_-]{10,64}$/.test(id)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_payment_id" }));
  }

  try {
    const r = await fetch(`https://api.moyasar.com/v1/payments/${id}`, {
      headers: { Authorization: "Basic " + Buffer.from(SK + ":").toString("base64") },
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      console.error("Moyasar verify error", r.status, detail);
      // This is the one failure that takes the customer's money and tells
      // nobody: the charge went through at Moyasar, and our side could not
      // read it back. Silence here means the owner learns about it from the
      // customer, which is how this was found.
      try {
        await sendMail(OWNER_EMAIL, `🚨 دفعة لم نستطع التحقق منها — ${id}`,
          `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;max-width:560px">
            <h2 style="color:#b91c1c">دفعة تمّت عند مُيسّر ولم نتمكّن من قراءتها</h2>
            <p>العميل دُفع منه فعلاً، لكن مُيسّر رفض طلب التحقق من خادمنا. لم تصدر فاتورة ولم يُسجَّل الطلب.</p>
            <table>
              <tr><td style="padding:4px 10px;color:#666">رقم الدفعة</td><td style="padding:4px 10px"><b style="direction:ltr;display:inline-block">${esc(id)}</b></td></tr>
              <tr><td style="padding:4px 10px;color:#666">ردّ مُيسّر</td><td style="padding:4px 10px"><b style="direction:ltr;display:inline-block">HTTP ${r.status}</b></td></tr>
            </table>
            <p><b>الأرجح:</b> ${r.status === 401
              ? "مفتاح <span style=\"direction:ltr;display:inline-block\">MOYASAR_SECRET_KEY</span> غير صحيح أو فيه مسافة/سطر زائد. افتح /admin ← «افحص الاتصال بمُيسّر»."
              : "عطل مؤقت عند مُيسّر."}</p>
            <p style="color:#b45309"><b>افعل الآن:</b> افتح لوحة مُيسّر، تأكّد من الدفعة بالرقم أعلاه، وأصدر الفاتورة يدوياً — العميل دفع.</p>
          </div>`);
      } catch (e) { console.error("pay: verify-failure alert email failed", String(e.message || e).slice(0, 120)); }
      res.statusCode = 502;
      // Named apart from a declined card on purpose. The page must not tell a
      // buyer whose card was charged that the payment did not go through —
      // that invites a second charge for the same order.
      return res.end(JSON.stringify({ ok: false, error: "verify_unavailable", paymentId: id }));
    }
    const p = await r.json();
    const paid = p.status === "paid";

    let activation = { activated: false };
    if (paid && b.context === "compliance") {
      activation = await activateCompliance(String(b.company || "").trim(), String(b.code || "").trim());
    }

    // Wallet top-up verified from the browser callback. The metadata read from
    // Moyasar's own record (never the request body) names the payer; the
    // sealed settle is idempotent with the webhook's.
    if (paid && (b.context === "wallet" || String((p.metadata || {}).wallet || "") === "topup")) {
      const w = await settleWalletTopup(p);
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, status: p.status, amount: p.amount, currency: p.currency, wallet: true,
        credited: !!(w && w.credited), already: !!(w && w.already), balance: w && w.balance != null ? w.balance : null,
      }));
    }

    // A confirmed payment issues the tax invoice by itself. Failing to invoice
    // must not report the payment as unsuccessful — the money moved either way,
    // and the owner can issue from the panel — so this is reported alongside.
    // Settle in one order, for one reason: the work order is the record of
    // whether this payment has already been handled. Marking first and
    // invoicing only when THIS call did the marking is what stops the browser
    // callback and the webhook — both of which fire for the same payment —
    // from issuing the client two tax invoices for one charge.
    let announced = null, invoicing = null, settle = null;
    if (paid && b.order && typeof b.order === "object") {
      // On the quote path the reference is read from the order itself; the
      // page only ever hands over the link it was opened with.
      let ref = String(b.order.ref || "");
      try {
        if (b.order.quoteId && b.order.t) {
          const priced = await quotePriced(String(b.order.quoteId), String(b.order.t));
          if (priced) ref = priced.order.clientRef || priced.order.ref || ref;
        }
        if (ref) announced = await markOrderPaid(ref, { total: Math.round(p.amount) / 100, method: "online" });
      } catch (e) {
        console.error("pay: stage announce failed", String(e.message || e).slice(0, 160));
      }
      // A cart payment settles through /api/requests {action:"paid-order"}:
      // CRM row lands confirmed and every gated portal the basket contains is
      // activated automatically, with the client's codes emailed. Idempotent —
      // if the webhook already settled this payment, nothing repeats here.
      if (!b.order.quoteId && !(Array.isArray(b.order.items) && b.order.items.length)) {
        console.error("pay: settle not attempted — the order snapshot carried no items; keys were",
          JSON.stringify(Object.keys(b.order || {})));
      }
      if (!b.order.quoteId && Array.isArray(b.order.items) && b.order.items.length) {
        try { settle = await settlePaidOrder(b.order, p); }
        catch (e) { console.error("pay: settle failed", String(e.message || e).slice(0, 160)); }
      }
      const alreadySettled = (announced && announced.orderFound && !announced.recorded) || (settle && settle.already);
      if (alreadySettled) {
        invoicing = { invoiced: false, reason: "already_settled" };
      } else {
        try {
          invoicing = await invoicePaidOrder(b.order, p.amount, String(p.id || ""));
        } catch (e) {
          console.error("pay: automatic invoice failed", String(e.message || e).slice(0, 200), String(e.detail || "").slice(0, 200));
          invoicing = { invoiced: false, reason: String(e.message || "invoice_failed") };
        }
      }
    }

    // A paid order that recorded nothing must never pass in silence. The money
    // has moved; if the CRM row, the activation or the invoice did not happen,
    // the only acceptable outcome is that a person is told immediately, with
    // everything needed to finish it by hand.
    if (paid) {
      const settleMissing = !b.order || !settle || (!settle.ok && !settle.already);
      const invoiceMissing = !invoicing || (invoicing.invoiced === false && invoicing.reason !== "already_settled");
      if (settleMissing || invoiceMissing) {
        const why = [
          settleMissing ? `التسجيل في CRM: ${settle ? (settle.error || settle.skipped || "لم يكتمل") : "لم يُستدعَ"}` : "",
          invoiceMissing ? `الفاتورة: ${(invoicing && (invoicing.reason || invoicing.error)) || "لم تُصدر"}` : "",
        ].filter(Boolean).join(" · ");
        const o = b.order || {};
        console.error("pay: PAID BUT INCOMPLETE", String(p.id || ""), why);
        try {
          await sendMail(OWNER_EMAIL, `⚠️ دفعة وصلت ولم يكتمل تسجيلها — ${String(o.ref || p.id || "")}`,
            `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;max-width:560px">
              <h2 style="color:#b91c1c">دفعة مؤكدة لم يكتمل تسجيلها</h2>
              <p>المبلغ وصل فعلاً إلى مُيسّر، لكن خطوة أو أكثر بعده لم تكتمل. أكملها يدوياً من لوحة /admin.</p>
              <table>
                <tr><td style="padding:4px 10px;color:#666">رقم الدفعة</td><td style="padding:4px 10px"><b style="direction:ltr;display:inline-block">${esc(String(p.id || ""))}</b></td></tr>
                <tr><td style="padding:4px 10px;color:#666">المبلغ</td><td style="padding:4px 10px"><b>${Math.round(Number(p.amount || 0)) / 100} ﷼</b></td></tr>
                <tr><td style="padding:4px 10px;color:#666">المرجع</td><td style="padding:4px 10px"><b>${esc(String(o.ref || "—"))}</b></td></tr>
                <tr><td style="padding:4px 10px;color:#666">العميل</td><td style="padding:4px 10px">${esc(String(o.name || "—"))} · ${esc(String(o.email || "—"))} · ${esc(String(o.phone || "—"))}</td></tr>
                <tr><td style="padding:4px 10px;color:#666">ما الذي لم يكتمل</td><td style="padding:4px 10px"><b>${esc(why)}</b></td></tr>
              </table>
              <p style="color:#64748b;font-size:12px">هذه الرسالة تُرسل تلقائياً عند كل دفعة مؤكدة لم تُسجَّل بالكامل — حتى لا تمر دفعة دون أن يعلم بها أحد.</p>
            </div>`);
        } catch (e) { console.error("pay: incomplete-alert email failed", String(e.message || e).slice(0, 120)); }
      }
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: paid,
      status: p.status,
      amount: p.amount,           // in halalas
      currency: p.currency,
      description: p.description || "",
      ...(b.context === "compliance" ? { activated: activation.activated } : {}),
      ...(invoicing ? { invoice: invoicing } : {}),
      ...(announced ? { announced } : {}),
      ...(settle ? { settle: { ok: settle.ok, already: !!settle.already, verified: !!settle.verified, activated: settle.activated || null } } : {}),
    }));
  } catch (e) {
    console.error("pay handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
