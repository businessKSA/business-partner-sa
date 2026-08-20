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

import { daftraConfigured, daftraFindOrCreateClient, daftraCreateInvoice, daftraDocPdf, daftraVatRate, nationalAddressLine, daftraPayLink } from "./_daftra.js";
import { markOrderPaid, quotePriced } from "./_suppliers.js";
import { contactForRef } from "./_stage.js";

const PK = process.env.MOYASAR_PUBLISHABLE_KEY || "";
const SK = process.env.MOYASAR_SECRET_KEY || "";
const MPF_JS = process.env.MOYASAR_MPF_URL || "https://cdn.moyasar.com/mpf/1.15.0/moyasar.js";
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
    const k = String(pk.code || pk.key || "").toLowerCase();
    if (k) map[k] = { amount: Number(pk.amount) || 0, name: pk.nameAr || pk.nameEn || k, code: k.toUpperCase() };
  }
  _catCache = map; _catAt = Date.now();
  return map;
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

async function invoicePaidOrder(order, paidHalalas) {
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
    // The client is not sent a message with no invoice in it. The owner is,
    // because they can attach the file from the panel in under a minute.
    await sendMail(OWNER_EMAIL, `⚠️ فاتورة ${inv.number} تحتاج إرفاق PDF يدوياً`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
        <p>دفع العميل <b>${esc(who.name)}</b> (${esc(who.email)}) وصدرت الفاتورة <b>${esc(inv.number)}</b> بإجمالي <b>${inv.total} ﷼</b>.</p>
        <p>الدفترة ما سلّمت الملف المطبوع، فما أُرسلت للعميل رسالة بلا فاتورة.</p>
        <p><b>المطلوب:</b> افتح لوحة التحكم ← الأدوات ← «تصحيح فاتورة صادرة»، ابحث عن ${esc(inv.number)}، أرفق ملف PDF من الدفترة واضغط أرسل.</p></div>`);
  }
  return { invoiced: true, number: inv.number, total: inv.total, pdfAttached: !!pdf, clientEmailed: !!pdf, payUrl };
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
  if (!leadsCodeOk(code)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "invalid_code" })); }
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
    "https://new.businesspartner.sa",
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
      publishableKey: PK || null,
      scriptUrl: MPF_JS,
      cssUrl: MPF_CSS,
      currency: "SAR",
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
      console.error("Moyasar verify error", r.status, (await r.text()).slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "verify_failed" }));
    }
    const p = await r.json();
    const paid = p.status === "paid";

    let activation = { activated: false };
    if (paid && b.context === "compliance") {
      activation = await activateCompliance(String(b.company || "").trim(), String(b.code || "").trim());
    }

    // A confirmed payment issues the tax invoice by itself. Failing to invoice
    // must not report the payment as unsuccessful — the money moved either way,
    // and the owner can issue from the panel — so this is reported alongside.
    let invoicing = null;
    if (paid && b.order && typeof b.order === "object") {
      try {
        invoicing = await invoicePaidOrder(b.order, p.amount);
      } catch (e) {
        console.error("pay: automatic invoice failed", String(e.message || e).slice(0, 200), String(e.detail || "").slice(0, 200));
        invoicing = { invoiced: false, reason: String(e.message || "invoice_failed") };
      }
    }

    // …and the client is told, on every channel, that the money arrived and the
    // work has started. The tax invoice above is the document; this is the
    // sentence a person actually waits for.
    let announced = null;
    if (paid && b.order && typeof b.order === "object") {
      try {
        // On the quote path the reference is read from the order itself; the
        // page only ever hands over the link it was opened with.
        let ref = String(b.order.ref || "");
        if (b.order.quoteId && b.order.t) {
          const priced = await quotePriced(String(b.order.quoteId), String(b.order.t));
          if (priced) ref = priced.order.clientRef || priced.order.ref || ref;
        }
        if (ref) {
          announced = await markOrderPaid(ref, { total: Math.round(p.amount) / 100, method: "online" });
        }
      } catch (e) {
        console.error("pay: stage announce failed", String(e.message || e).slice(0, 160));
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
    }));
  } catch (e) {
    console.error("pay handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
