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

import { gcalConfigured, busy as gcalBusy, createEvent as gcalCreate } from "./_gcal.js";
import { sb, DB_ON } from "./_db.js";

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
    // Same ref column every other handler writes, so a consultation booking is
    // lookupable by its BC- reference (and by ?action=refs=) like any order.
    "رقم المرجع": { rich_text: [{ text: { content: String(ref || "").slice(0, 60) } }] },
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

// ‏رابط «أضِف إلى تقويمك» بطول الفترة نفسها. كان ساعةً ثابتة، فيحجز العميل
// نصف ساعة ويجد في تقويمه ساعة — وحسابُ `h + 1` يتجاوز الرابعة والعشرين في
// آخر فترة من اليوم فيخرج وقتٌ لا وجود له.
function gcalUrl({ topic, date, time, notes }) {
  const [h, m] = time.split(":").map(Number);
  const d = date.replace(/-/g, "");
  const pad = (n) => String(n).padStart(2, "0");
  const endMin = h * 60 + m + SLOT_MIN;
  const start = `${d}T${pad(h)}${pad(m)}00`;
  const end = `${d}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
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

// ---- المواعيد المتاحة ------------------------------------------------------
// أوقات العمل بتوقيت الرياض، والجمعة عطلة. القيم قابلة للضبط من المتغيّرات
// دون تعديل شيفرة: BOOKING_START, BOOKING_END, BOOKING_SLOT_MIN, BOOKING_DAYS.
const TZ_OFFSET = "+03:00";                        // الرياض بلا توقيت صيفي
const WORK_FROM = Number(process.env.BOOKING_START || 10);      // ١٠ صباحاً
const WORK_TO   = Number(process.env.BOOKING_END || 18);        // ٦ مساءً
const SLOT_MIN  = Number(process.env.BOOKING_SLOT_MIN || 30);   // نصف ساعة
const HORIZON   = Number(process.env.BOOKING_DAYS || 21);       // ثلاثة أسابيع
const LEAD_MIN  = Number(process.env.BOOKING_LEAD_MIN || 120);  // ساعتان مهلة

const iso = (date, hhmm) => `${date}T${hhmm}:00${TZ_OFFSET}`;
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (date) => new Date(`${date}T12:00:00${TZ_OFFSET}`).getUTCDay();   // 5 = الجمعة

function slotsOfDay(date) {
  const out = [];
  for (let m = WORK_FROM * 60; m + SLOT_MIN <= WORK_TO * 60; m += SLOT_MIN) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
}

// ‏سجلّ ما حُجز عندنا. تقويم جوجل ليس المصدر الوحيد: قبل ربطه — وهو غير
// مربوط حتى تُضبط مفاتيح حساب الخدمة — لا شيء يمنع أن يحجز اثنان الفترة
// نفسها. الحجوزات تُكتب صفوفَ `requests` من نوع CONSULTATION بموعدٍ في
// `appointment`، فتُطرح فتراتها من المعروض وتظهر في لوحة العمليات مع بقية
// الطلبات. أي عطل هنا لا يُسقط الحجز — يُسجَّل ويُمضى.
async function bookedSet() {
  if (!DB_ON) return new Set();
  try {
    const rows = await sb(
      "requests?select=appointment,status&type=eq.CONSULTATION&order=created_at.desc&limit=600",
    );
    const out = new Set();
    for (const r of rows || []) {
      const a = r && r.appointment;
      if (!a || !a.date || !a.time) continue;
      if (r.status === "CANCELLED" || a.status === "CANCELLED") continue;
      out.add(a.date + " " + a.time);
    }
    return out;
  } catch (e) {
    console.error("booked read", String(e.message || e).slice(0, 160));
    return new Set();
  }
}

// ‏الحجز يُحفظ طلباً كامل الأركان: مرجعه ونوعه وبيانات صاحبه وموعده. بلا هذا
// يبقى الحجز في البريد وحده — لا يراه الفريق في اللوحة ولا يمنع حجزاً ثانياً.
async function saveBooking({ ref, name, phone, email, topic, date, time, notes, lang, eventId }) {
  if (!DB_ON) return null;
  try {
    const rows = await sb("requests", {
      method: "POST",
      body: [{
        ref, type: "CONSULTATION", source: "WEBSITE", status: "NEW",
        lang: ["ar", "en", "fr", "zh"].includes(lang) ? lang : "ar",
        title: topic ? `استشارة — ${topic}`.slice(0, 200) : "حجز استشارة",
        summary: notes.slice(0, 2000),
        appointment: { date, time, tz: "Asia/Riyadh", topic, status: "BOOKED", ref, gcal: eventId || "" },
        client_name: name, client_email: email, client_phone: phone,
      }],
    });
    return (rows && rows[0]) || null;
  } catch (e) {
    console.error("booking save", String(e.message || e).slice(0, 160));
    return null;
  }
}

/**
 * الأيام المتاحة وفتراتها. تُحجب الجمعة، وما مضى، وما هو دون مهلة الحجز،
 * وما هو مشغول في تقويم الشركة حين يكون التقويم مربوطاً.
 */
async function availability(days) {
  const today = new Date();
  const list = [];
  for (let i = 0; i < Math.min(Math.max(days || HORIZON, 1), 60); i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    if (dayOf(date) === 5) continue;                      // الجمعة
    list.push({ date, slots: slotsOfDay(date) });
  }
  if (!list.length) return { days: [], calendar: gcalConfigured() ? "linked" : "off" };

  // حجب ما مضى وما هو دون المهلة، ثم ما حُجز عندنا
  const earliest = Date.now() + LEAD_MIN * 60000;
  for (const d of list) d.slots = d.slots.filter((t) => new Date(iso(d.date, t)).getTime() >= earliest);
  const mine = await bookedSet();
  if (mine.size) for (const d of list) d.slots = d.slots.filter((t) => !mine.has(d.date + " " + t));

  let calendar = "off";
  if (gcalConfigured()) {
    try {
      const from = iso(list[0].date, `${pad(WORK_FROM)}:00`);
      const to = iso(list[list.length - 1].date, `${pad(WORK_TO)}:00`);
      const taken = await gcalBusy(from, to);
      for (const d of list) {
        d.slots = d.slots.filter((t) => {
          const s = new Date(iso(d.date, t)).getTime();
          const e = s + SLOT_MIN * 60000;
          return !taken.some((b) => s < new Date(b.end).getTime() && e > new Date(b.start).getTime());
        });
      }
      calendar = "linked";
    } catch (e) {
      // تقويمٌ مربوطٌ ومتعذّر القراءة: تُعرض كل الفترات ويُقال إن التحقق
      // تعذّر — إخفاء اليوم كله أسوأ من احتمال تعارض يُعالجه الفريق.
      console.error("gcal busy", String(e.message || e).slice(0, 160));
      calendar = "error";
    }
  }
  return { days: list.filter((d) => d.slots.length), calendar, slotMinutes: SLOT_MIN, tz: "Asia/Riyadh" };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    res.statusCode = 200;
    // ?action=slots يعيد الأيام والفترات المتاحة؛ وبدونه فحص صحّة.
    const u = new URL(req.url, "http://x");
    if (u.searchParams.get("action") === "slots") {
      try {
        const a = await availability(Number(u.searchParams.get("days")) || HORIZON);
        return res.end(JSON.stringify({ ok: true, ...a }));
      } catch (e) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ ok: false, error: "slots_failed", detail: String(e.message || e).slice(0, 160) }));
      }
    }
    return res.end(JSON.stringify({
      status: "ok", emailConfigured: !!RESEND_API_KEY, teamEmail: !!TEAM_EMAIL,
      calendar: gcalConfigured() ? "linked" : "off",
      hours: { from: WORK_FROM, to: WORK_TO, slotMinutes: SLOT_MIN, tz: "Asia/Riyadh", horizonDays: HORIZON },
    }));
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

  // ‏الفترة قد تُحجز بين عرضها على الشاشة وضغط الزر، فتُفحص مرة أخرى — عندنا
  // أولاً، لأن هذا الفحص يعمل سواء رُبط التقويم أم لا.
  if ((await bookedSet()).has(date + " " + time)) {
    res.statusCode = 409;
    return res.end(JSON.stringify({ ok: false, error: "slot_taken",
      message: "حُجزت هذه الفترة قبل قليل. اختر فترة أخرى." }));
  }

  // ---- التقويم: الموعد يُوضع في تقويم الشركة ويُدعى إليه العميل -------------
  // ويُعاد التحقق من خلوّ الفترة قبل الإنشاء: بين عرض المواعيد على شاشة
  // العميل وضغطه قد يكون آخرُ حجزها، فالفحص عند العرض وحده يسمح بحجزين
  // على فترة واحدة.
  const startIso = `${date}T${time}:00${TZ_OFFSET}`;
  const endIso = new Date(new Date(startIso).getTime() + SLOT_MIN * 60000).toISOString();
  let event = null, calendarState = gcalConfigured() ? "linked" : "off";
  if (gcalConfigured()) {
    try {
      const clash = (await gcalBusy(startIso, endIso)).length > 0;
      if (clash) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "slot_taken",
          message: "حُجزت هذه الفترة قبل قليل. اختر فترة أخرى." }));
      }
      event = await gcalCreate({
        summary: `استشارة — ${name}`,
        description: [`الموضوع: ${topic || "—"}`, `الجوال: ${phone}`, `البريد: ${email}`,
                      notes ? `ملاحظات: ${notes}` : "", `المرجع: ${ref}`].filter(Boolean).join("\n"),
        startIso, endIso, attendees: [email, TEAM_EMAIL],
      });
    } catch (e) {
      // التقويم متعذّر: الحجز لا يسقط — يُسجَّل ويصل بالبريد، ويُقال إن
      // التقويم لم يُحدَّث كي يضعه الفريق يدوياً.
      console.error("gcal create", String(e.message || e).slice(0, 180));
      calendarState = "error";
    }
  }

  await saveBooking({ ref, name, phone, email, topic, date, time, notes,
                      lang: b.lang, eventId: (event && event.id) || "" });

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
    ${event && event.meet ? `<p>رابط الاجتماع: <a href="${event.meet}">${event.meet}</a></p>` : ""}
    <p><a href="${cal}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">أضِف الموعد إلى تقويم Google</a></p>
    <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;

  const [teamSent, clientSent] = await Promise.all([
    sendEmail(TEAM_EMAIL, `حجز استشارة جديد ${ref} — ${name}`, teamHtml),
    sendEmail(email, `تأكيد حجز استشارتك ${ref} — Business Partner`, clientHtml),
    // Register the lead in the CRM and add to the newsletter audience (best-effort).
    crmLead({ name, phone, email, topic, date, notes, ref }),
    addToAudience(email, name),
    forwardLead({ source: "consultation", ref, name, phone, email, topic, date, notes }),
    // n8n notify webhook: source=booking + date/time auto-creates the event
    // on the owner's Google Calendar (workflow bldhMv0BAGs41Xqo).
    fetch(process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "booking", ref, name, phone, email, date, time, topic, transcript: `📅 حجز استشارة (${topic || "عام"}): ${date} · ${time}` }),
    }).catch(() => {}),
  ]);

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true, ref, gcalUrl: cal,
    emailSent: !!(teamSent.ok && clientSent.ok),
    calendar: calendarState,
    meet: (event && event.meet) || "",
    eventId: (event && event.id) || "",
    when: { date, time, tz: "Asia/Riyadh", minutes: SLOT_MIN },
  }));
}
