// Business Partner 3.0 — client requests serverless function (ESM).
// Handles two request types from the site:
//   type "event"    — corporate event request from /tourism (company email required)
//   type "supplier" — supplier registration from /suppliers
// Emails the team (+ a confirmation to the requester) via Resend and returns a
// reference number. Works without RESEND_API_KEY too (front-end then offers
// the WhatsApp fallback).
//
// Env vars: RESEND_API_KEY, OTP_FROM_EMAIL, BOOKING_EMAIL (same as api/book.js)

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Free/personal mailbox providers — event requests must come from a company domain.
const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "outlook.sa", "live.com", "msn.com",
  "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "zoho.com", "mail.com", "gmx.com", "gmx.net", "yandex.com", "yandex.ru", "inbox.com", "hey.com",
]);
const isCorporateEmail = (e) => isEmail(e) && !FREE_DOMAINS.has(e.split("@")[1].toLowerCase());

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

const row = (k, v) => `<tr><td style="padding:4px 10px;color:#666">${k}</td><td style="padding:4px 10px"><b>${esc(v || "—")}</b></td></tr>`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: "ok", emailConfigured: !!RESEND_API_KEY }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }

  const b = await readBody(req);
  const type = b.type === "supplier" ? "supplier" : "event";
  const f = {};
  for (const k of ["company", "person", "phone", "email", "date", "count", "klass", "venue", "eventType", "city", "cr", "category", "notes"]) {
    f[k] = String(b[k] || "").trim().slice(0, k === "notes" ? 1000 : 160);
  }
  f.email = f.email.toLowerCase();

  if (!f.company || !f.person || !f.phone || !isEmail(f.email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }
  if (type === "event" && !isCorporateEmail(f.email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "free_email", message: "الرجاء استخدام إيميل الشركة الرسمي — لا تُقبل الإيميلات المجانية (Gmail وغيرها)." }));
  }

  const ref = (type === "event" ? "EV-" : "SP-") + Date.now().toString().slice(-6);
  const title = type === "event" ? `طلب فعالية جديد — ${ref}` : `تسجيل مورّد جديد — ${ref}`;
  const rows = type === "event"
    ? row("الشركة", f.company) + row("المسؤول", f.person) + row("الجوال", f.phone) + row("الإيميل", f.email) +
      row("تاريخ الفعالية", f.date) + row("عدد الأفراد", f.count) + row("المستوى", f.klass) +
      row("نوع المكان", f.venue) + row("نوع الفعالية", f.eventType) + row("تفاصيل", f.notes)
    : row("الشركة", f.company) + row("المسؤول", f.person) + row("الجوال", f.phone) + row("الإيميل", f.email) +
      row("المدينة", f.city) + row("السجل التجاري", f.cr) + row("التصنيف", f.category) + row("الخدمات", f.notes);
  const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">${title}</h2><table>${rows}</table></div>`;
  const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#0B1B5A">${type === "event" ? "تم استلام طلب فعاليتك" : "تم استلام تسجيلك كمورّد"} — ${ref}</h2>
    <p>مرحباً ${esc(f.person)}، ${type === "event"
      ? "استلمنا طلب فعاليتكم وسنجمع لكم أفضل 5 عروض من المزوّدين ونعود إليكم قريباً."
      : "استلمنا تسجيلكم في بوابة الموردين وسنتواصل معكم لاستكمال الانضمام."}</p>
    <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;

  const [teamSent, clientSent] = await Promise.all([
    sendEmail(TEAM_EMAIL, `${title} — ${f.company}`, teamHtml),
    sendEmail(f.email, `${type === "event" ? "تأكيد طلب الفعالية" : "تأكيد تسجيل المورّد"} ${ref} — Business Partner`, clientHtml),
  ]);

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, ref, emailSent: !!(teamSent.ok && clientSent.ok) }));
}
