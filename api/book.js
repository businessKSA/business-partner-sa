// Business Partner 3.0 — consultation booking serverless function (ESM).
// Receives the /consultation form, emails the team + a confirmation to the
// client (via Resend), and returns a Google-Calendar "add event" link.
//
// Env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   Resend API key (same one used by api/otp.js)
//   OTP_FROM_EMAIL   verified sender, e.g. "Business Partner <noreply@businesspartner.sa>"
//   BOOKING_EMAIL    where team notifications go (default business@businesspartner.sa)
// Without RESEND_API_KEY the endpoint still works: it returns ok + the
// calendar link, and the front-end offers WhatsApp notification as fallback.

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";

// ---- CRM (Notion "Sales Pipeline") + newsletter audience ----
const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const RESEND_AUDIENCE = process.env.RESEND_AUDIENCE_ID || "";
const NOTION_VERSION = "2022-06-28";
// Optional: POST every lead to an n8n/Make webhook (→ WhatsApp notification, etc.)
const LEAD_WEBHOOK = process.env.LEAD_WEBHOOK_URL || "";
async function forwardLead(payload) {
  if (!LEAD_WEBHOOK) return;
  try { await fetch(LEAD_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); } catch {}
}

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Write a lead into the Sales Pipeline CRM (Stage=New, Source=Website). Best-effort.
async function crmLead({ name, phone, email, topic, date, notes, ref }) {
  if (!NOTION_TOKEN) return { ok: false };
  const today = new Date().toISOString().slice(0, 10);
  const props = {
    "Opportunity Name": { title: [{ text: { content: `استشارة ${topic || ""} — ${name} (${ref})`.slice(0, 200) } }] },
    "Stage": { select: { name: "New" } },
    "Lead Source": { select: { name: "Website" } },
    "Human Required": { checkbox: true },
    "Notes": { rich_text: [{ text: { content: `الجوال: ${phone} · البريد: ${email}${notes ? " · ملاحظات: " + notes : ""}`.slice(0, 1900) } }] },
    "Last Activity": { date: { start: today } },
  };
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || "")) props["Meeting Date"] = { date: { start: date } };
  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: CRM_DB }, properties: props }),
    });
    if (!r.ok) console.error("CRM lead error", r.status, (await r.text()).slice(0, 300));
    return { ok: r.ok };
  } catch (e) { console.error("CRM lead exception", String(e).slice(0, 150)); return { ok: false }; }
}

// Auto-subscribe the lead's email to the Resend newsletter audience. Best-effort.
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

// Build a Google Calendar template URL for a 1-hour meeting (Riyadh time).
function gcalUrl({ topic, date, time, notes }) {
  const [h, m] = time.split(":").map(Number);
  const d = date.replace(/-/g, "");
  const pad = (n) => String(n).padStart(2, "0");
  const start = `${d}T${pad(h)}${pad(m)}00`;
  const end = `${d}T${pad(h + 1)}${pad(m)}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `استشارة Business Partner — ${topic}`,
    dates: `${start}/${end}`,
    ctz: "Asia/Riyadh",
    details: `استشارة مع فريق Business Partner.\n${notes || ""}\nwa.me/966507034157`,
    location: "Business Partner — Riyadh / Online",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return { ok: false, error: "email_not_configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) { console.error("Resend error", r.status, await r.text()); return { ok: false, error: "email_send_failed" }; }
    return { ok: true };
  } catch (e) { console.error("email exception", e); return { ok: false, error: "email_send_failed" }; }
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: "ok", emailConfigured: !!RESEND_API_KEY, teamEmail: !!TEAM_EMAIL }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }

  const b = await readBody(req);
  const name = String(b.name || "").trim().slice(0, 120);
  const phone = String(b.phone || "").trim().slice(0, 30);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
  const topic = String(b.topic || "").trim().slice(0, 120);
  const date = String(b.date || "").trim();
  const time = String(b.time || "").trim();
  const notes = String(b.notes || "").trim().slice(0, 1000);

  if (!name || !phone || !isEmail(email) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }

  const ref = "BC-" + Date.now().toString().slice(-6);
  const cal = gcalUrl({ topic, date, time, notes });

  // Notify the team + confirm to the client (best-effort; booking succeeds regardless).
  const teamHtml = `<div style="font-family:Arial,sans-serif">
    <h2 style="color:#0B1B5A">حجز استشارة جديد — ${ref}</h2>
    <p><b>الاسم:</b> ${esc(name)}<br><b>الجوال:</b> ${esc(phone)}<br><b>البريد:</b> ${esc(email)}<br>
    <b>الموضوع:</b> ${esc(topic)}<br><b>الموعد:</b> ${esc(date)} · ${esc(time)} (الرياض)<br>
    <b>ملاحظات:</b> ${esc(notes) || "—"}</p>
    <p><a href="${cal}">إضافة إلى تقويم Google</a></p></div>`;
  const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#0B1B5A">تم استلام حجزك — ${ref}</h2>
    <p>مرحباً ${esc(name)}، استلمنا طلب استشارتك (<b>${esc(topic)}</b>) بتاريخ <b>${esc(date)}</b> الساعة <b>${esc(time)}</b> بتوقيت الرياض، وسيتواصل معك مستشارنا لتأكيد الموعد.</p>
    <p><a href="${cal}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">أضِف الموعد إلى تقويم Google</a></p>
    <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;

  const [teamSent, clientSent] = await Promise.all([
    sendEmail(TEAM_EMAIL, `حجز استشارة جديد ${ref} — ${name}`, teamHtml),
    sendEmail(email, `تأكيد حجز استشارتك ${ref} — Business Partner`, clientHtml),
    // Register the lead in the CRM and add to the newsletter audience (best-effort).
    crmLead({ name, phone, email, topic, date, notes, ref }),
    addToAudience(email, name),
    forwardLead({ source: "consultation", ref, name, phone, email, topic, date, notes }),
  ]);

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true, ref, gcalUrl: cal,
    emailSent: !!(teamSent.ok && clientSent.ok),
  }));
}
