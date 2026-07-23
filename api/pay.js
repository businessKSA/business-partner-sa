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

async function sendMail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    return { ok: r.ok };
  } catch { return { ok: false }; }
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
  const raw = process.env.LEADS_ACCESS_CODES || process.env.LEADS_KEY || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  list.push("BP-DEMO-2026"); // built-in demo code so the portal works out of the box
  return list;
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
    const body = { page_size: 50, filter: and.length ? { and: [...and, contact] } : contact,
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
  // Called cross-origin from businesspartner.sa (the compliance product's own
  // domain), which has no payment backend of its own.
  res.setHeader("Access-Control-Allow-Origin", "*");
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

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: paid,
      status: p.status,
      amount: p.amount,           // in halalas
      currency: p.currency,
      description: p.description || "",
      ...(b.context === "compliance" ? { activated: activation.activated } : {}),
    }));
  } catch (e) {
    console.error("pay handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
