// Business Partner 3.0 — workspace demand intake → Notion matching board (ESM).
// Writes a client "Demand - Client Request" record into the unified
// "Real Estate Demand & Supply Board" so the matchmaking engine can match it
// against available supply — and (like every other lead form on the site)
// notifies the team by email, confirms to the client by email, auto-subscribes
// the client to the newsletter, and optionally forwards the lead to an
// n8n/Make webhook for WhatsApp notification.
//
// Env vars:
//   NOTION_TOKEN / BusinessPartnerSiteNotion / …   Notion integration secret
//   NOTION_BOARD_DB      optional override of the demand/supply board id
//   RESEND_API_KEY       Resend API key (same one used across the site)
//   OTP_FROM_EMAIL       verified sender
//   BOOKING_EMAIL        where team notifications go (default business@businesspartner.sa)
//   NOTIFY_PHONE         business owner's WhatsApp number for lead alerts (default 966530540231)
//   NOTION_CRM_DB        optional override of the Sales Pipeline CRM database id
//   RESEND_AUDIENCE_ID   optional Resend audience id to auto-subscribe leads
//   LEAD_WEBHOOK_URL     optional n8n/Make webhook — every lead is POSTed here too
//
// GET  /api/workspace  -> { status, configured }
// POST /api/workspace  -> { ok, ref } | { ok:false, error }

const envFrom = (names) => {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return "";
};
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion", "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
const DB_ID = process.env.NOTION_BOARD_DB || "f416606b4fab4cbb80ced171f75e0a3b";
const NOTION_VERSION = "2022-06-28";

const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";
const NOTIFY_PHONE = process.env.NOTIFY_PHONE || "966530540231";
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const RESEND_AUDIENCE = process.env.RESEND_AUDIENCE_ID || "";
const LEAD_WEBHOOK = process.env.LEAD_WEBHOOK_URL || "";

const CITIES = ["Riyadh", "Jeddah", "Dammam", "Khobar", "Makkah", "Madinah", "Other"];
const CATEGORIES = ["Residential", "Commercial", "Office", "Co-working Space", "Retail", "Showroom", "Industrial", "Land", "Labor Camp", "Compound", "Mixed-use", "Hospitality", "Other"];

const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const numOr = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, "")); return isFinite(n) && n > 0 ? n : null; };

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) { console.error("Resend error", r.status, await r.text()); return { ok: false }; }
    return { ok: true };
  } catch (e) { console.error("email exception", String(e).slice(0, 150)); return { ok: false }; }
}

async function crmLead({ title, phone, email, notes, ref }) {
  if (!NOTION_TOKEN) return;
  const today = new Date().toISOString().slice(0, 10);
  const props = {
    "Opportunity Name": { title: [{ text: { content: `${title} (${ref})`.slice(0, 200) } }] },
    "Stage": { select: { name: "New" } },
    "Lead Source": { select: { name: "Website" } },
    "Human Required": { checkbox: true },
    "Notes": { rich_text: [{ text: { content: `الجوال: ${phone} · البريد: ${email}${notes ? " · " + notes : ""}`.slice(0, 1900) } }] },
    "Last Activity": { date: { start: today } },
  };
  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: CRM_DB }, properties: props }),
    });
    if (!r.ok) console.error("CRM lead error", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("CRM lead exception", String(e).slice(0, 150)); }
}

async function addToAudience(email, name) {
  if (!RESEND_API_KEY || !RESEND_AUDIENCE || !isEmail(email)) return;
  try {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email, first_name: p[0] || undefined, last_name: p.slice(1).join(" ") || undefined, unsubscribed: false }),
    });
  } catch {}
}

async function forwardLead(payload) {
  if (!LEAD_WEBHOOK) return;
  try { await fetch(LEAD_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); } catch {}
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

function makeRef(seed) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = ""; for (let i = 0; i < 4; i++) { out += abc[h % abc.length]; h = Math.floor(h / abc.length) + seed.length * (i + 5); }
  return "BP-WS-" + out;
}
const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);
const row = (k, v) => `<tr><td style="padding:4px 10px;color:#666">${k}</td><td style="padding:4px 10px"><b>${esc(v || "—")}</b></td></tr>`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const seenKeyNames = Object.keys(process.env).filter((k) => /notion/i.test(k));
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, emailConfigured: !!RESEND_API_KEY, seenKeyNames }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" })); }

  const b = await readBody(req);
  const contact = clip(b.contact, 160);
  const phone = clip(b.phone, 40);
  const email = clip(b.email, 160).toLowerCase();
  const city = CITIES.includes(b.city) ? b.city : "";
  const category = CATEGORIES.includes(b.category) ? b.category : "";
  const district = clip(b.district, 160);
  const size = numOr(b.size);
  const seats = numOr(b.seats);
  const budget = numOr(b.budget);
  const purpose = b.purpose === "buy" ? "شراء" : "إيجار";
  const notes = clip(b.notes, 800);

  if (!phone || (!city && !district)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }

  const ref = makeRef(contact + phone + (city || district));
  const cityLabel = city || district || "";
  const summaryNotes = [`نوع العملية: ${purpose}`, category, size ? `${size} م²` : "", seats ? `${seats} مقعد` : "", budget ? `ميزانية ${budget} ﷼/سنة` : "", notes].filter(Boolean).join(" · ");

  // Team + client emails, CRM lead, newsletter subscribe, webhook forward — all
  // best-effort in parallel; the client always gets back a reference either way.
  const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب مساحة عمل جديد — ${ref}</h2>
    <p style="color:#b45309;font-weight:bold">📲 أشعر صاحب العمل على واتساب: +${NOTIFY_PHONE}</p>
    <table>${row("جهة الاتصال", contact) + row("الجوال", phone) + row("البريد", email) + row("المدينة", cityLabel) + row("الحي", district) + row("نوع المساحة", category) + row("الغرض", purpose) + row("المساحة", size ? size + " م²" : "") + row("عدد المقاعد", seats ? String(seats) : "") + row("الميزانية السنوية", budget ? budget + " ﷼" : "") + row("ملاحظات", notes)}</table></div>`;
  const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#0B1B5A">تم استلام طلب مساحتك — ${ref}</h2>
    <p>مرحباً${contact ? " " + esc(contact) : ""}، استلمنا طلبك لمساحة عمل في <b>${esc(cityLabel)}</b>. محرّك المطابقة يبحث عن أفضل الخيارات، وسيتواصل معك فريقنا قريباً بالعروض المناسبة.</p>
    <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;

  const [teamSent] = await Promise.all([
    sendEmail(TEAM_EMAIL, `طلب مساحة عمل جديد ${ref} — ${cityLabel}`, teamHtml),
    isEmail(email) ? sendEmail(email, `تم استلام طلبك ${ref} — Business Partner`, clientHtml) : Promise.resolve({ ok: false }),
    crmLead({ title: `طلب مساحة عمل — ${cityLabel}`, phone, email, notes: summaryNotes, ref }),
    addToAudience(email, contact),
    forwardLead({ source: "workspace-request", ref, name: contact, phone, email, city: cityLabel, category, purpose, size, seats, budget, notes, notifyPhone: NOTIFY_PHONE }),
  ]);

  if (!NOTION_TOKEN) return res.end(JSON.stringify({ ok: true, ref, stored: false, emailSent: !!teamSent.ok }));

  const title = `طلب مساحة — ${cityLabel}${contact ? " — " + contact : ""} (${ref})`;
  const props = {
    "Name": { title: [{ text: { content: title } }] },
    "Record Type": { select: { name: "Demand - Client Request" } },
    "Status": { select: { name: "New" } },
    "Original Source": { rich_text: rt("Website — businesspartner.sa") },
  };
  if (city) props["City"] = { select: { name: city } };
  if (category) props["Property Category"] = { select: { name: category } };
  if (district) props["District"] = { rich_text: rt(district) };
  if (size != null) props["Size sqm"] = { number: size };
  if (seats != null) props["Seats / Capacity"] = { number: seats };
  if (budget != null) props["Budget / Price"] = { number: budget };
  if (contact) props["Contact Person"] = { rich_text: rt(contact) };
  if (phone) props["Phone"] = { phone_number: phone };
  if (isEmail(email)) props["Email"] = { email };
  props["AI Summary"] = { rich_text: rt(summaryNotes) };

  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties: props }),
    });
    if (!r.ok) {
      console.error("Notion workspace error", r.status, (await r.text()).slice(0, 400));
      res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error", ref }));
    }
    return res.end(JSON.stringify({ ok: true, ref, stored: true, emailSent: !!teamSent.ok }));
  } catch (e) {
    console.error("workspace handler error", String(e).slice(0, 200));
    res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "server_error", ref }));
  }
}
