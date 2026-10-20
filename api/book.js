// Business Partner 3.0 — «الاتصال المرئي — استشارة مجانية»: خدمة الحجز (ESM).
//
// الزائر يختار فترة من /consultation (أو من «مواعيدي» في /my) فيُنشأ حدثٌ في
// تقويم الشركة على Google Calendar برابط Google Meet، ويُدعى إليه العميل
// والمالك (sendUpdates=all)، ويصل العميلَ بريدُ تأكيدٍ برابط الاجتماع وزرّ
// «أضف إلى التقويم» وروابط تغيير الموعد وإلغائه.
//
// الساعات والأيام والمدة في api/_booking.js (افتراضياً ١٥:٠٠–٢٢:٠٠ بتوقيت
// الرياض، ٣٠ دقيقة، الجمعة عطلة) وتُتجاوز بمتغيّرات BOOKING_*.
//
// Env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY        مفتاح Resend (نفسه المستعمل في api/otp.js)
//   OTP_FROM_EMAIL        مرسِلٌ موثَّق، مثل "Business Partner <noreply@businesspartner.sa>"
//   BOOKING_EMAIL         بريد الفريق لإشعارات الحجز (الافتراضي business@businesspartner.sa)
//   BOOKING_OWNER_EMAIL   بريد المالك المدعوّ إلى كل جلسة (الافتراضي: أول OWNER_EMAILS)
//   GOOGLE_SA_EMAIL · GOOGLE_SA_PRIVATE_KEY · GOOGLE_CALENDAR_ID · GOOGLE_SA_IMPERSONATE — api/_gcal.js
//   OTP_SECRET            يوقّع روابط تغيير/إلغاء الموعد (بلا قيمته لا تُنشأ الروابط)
//
// صدقٌ قبل كل شيء: لا يُقال «تم تأكيد موعدك» إلا إذا وُضع الحدث فعلاً في
// التقويم. تقويمٌ غير مضبوط أو متعذّر يُسجَّل الطلبُ معه «بانتظار التأكيد»
// ويُقال ذلك للعميل في الشاشة وفي البريد، ولا يصله رابط اجتماعٍ لا وجود له.

import crypto from "node:crypto";
import { gcalState, gcalCanInvite, busy as gcalBusy, createEvent as gcalCreate, moveEvent as gcalMove, cancelEvent as gcalCancel, CAL_ID } from "./_gcal.js";
import { sb, DB_ON, getSession } from "./_db.js";
import { WHATSAPP_LIVE, EMAIL_LIVE, outbox } from "./_mode.js";
import { n8nWebhookUrl } from "./_n8n.js";
import {
  TZ, bookingConfig, slotsOfDay, validateSlot, iso, riyadhToday, isOffDay, hhmm,
  bookingMessage, manageToken, checkManageToken,
} from "./_booking.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = (process.env.BOOKING_EMAIL || "business@businesspartner.sa").trim().toLowerCase();
const OWNER_EMAIL = String(process.env.BOOKING_OWNER_EMAIL || process.env.OWNER_EMAILS || "dr.baher.magnas@gmail.com")
  .split(",")[0].trim().toLowerCase();
const SELF_BASE = (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");
const WA = "wa.me/966507034157";
const MAX_ACTIVE = 2;                                  // مواعيد قادمة لكل بريد/جوال

// ---- CRM (Notion "Sales Pipeline") + newsletter audience ----
const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const RESEND_AUDIENCE = process.env.RESEND_AUDIENCE_ID || "";
const NOTION_VERSION = "2022-06-28";
// Optional: POST every lead to an n8n/Make webhook (→ WhatsApp notification, etc.)
const LEAD_WEBHOOK = process.env.LEAD_WEBHOOK_URL || "";
// محلياً/معاينةً (EMAIL_MODE != live) لا يغادر شيءٌ إلى Notion أو Resend أو n8n.
async function forwardLead(payload) {
  if (!LEAD_WEBHOOK || !EMAIL_LIVE) return;
  try { await fetch(LEAD_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); } catch {}
}

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

// Write a lead into the Sales Pipeline CRM (Stage=New, Source=Website). Best-effort.
async function crmLead({ name, phone, email, topic, date, notes, ref }) {
  if (!NOTION_TOKEN || !EMAIL_LIVE) return { ok: false };
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
  if (!RESEND_API_KEY || !RESEND_AUDIENCE || !isEmail(email) || !EMAIL_LIVE) return;
  try {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email, first_name: p[0] || undefined, last_name: p.slice(1).join(" ") || undefined, unsubscribed: false }),
    });
  } catch {}
}

// ‏رابط «أضِف إلى تقويمك» بطول الجلسة نفسها، وفيه رابط Meet إن وُجد. كان ساعةً
// ثابتة فيحجز العميل نصف ساعة ويجد في تقويمه ساعة، وحسابُ `h + 1` يتجاوز
// الرابعة والعشرين في آخر فترة من اليوم فيخرج وقتٌ لا وجود له.
function gcalUrl({ topic, date, time, notes, meet, lang }) {
  const [h, m] = time.split(":").map(Number);
  const d = date.replace(/-/g, "");
  const endMin = h * 60 + m + bookingConfig().slotMin;
  const start = `${d}T${pad(h)}${pad(m)}00`;
  const end = `${d}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
  const ar = lang === "ar" || !lang;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ar ? `الاتصال المرئي — استشارة مجانية مع Business Partner${topic ? " — " + topic : ""}` : `Video call — free consultation with Business Partner${topic ? " — " + topic : ""}`,
    dates: `${start}/${end}`,
    ctz: TZ,
    details: [ar ? "استشارة مجانية بالفيديو مع فريق Business Partner." : "Free video consultation with the Business Partner team.",
      meet ? (ar ? "رابط الاجتماع: " : "Meeting link: ") + meet : "", notes || "", WA].filter(Boolean).join("\n"),
    location: meet || "Google Meet",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function sendEmail(to, subject, html) {
  // محلياً/معاينةً: يُسجَّل في صندوق الصادر ولا يصل أحداً.
  if (!EMAIL_LIVE) { await outbox({ kind: "email", to, subject, body: html }); return { ok: false, skipped: "email_mode" }; }
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

// ---- حدّ الإكثار -----------------------------------------------------------
// في الذاكرة: يكفي لقطع الإغراق من مصدرٍ واحد على نسخةٍ واحدة، وسقف المواعيد
// القادمة لكل بريد/جوال (أدناه) هو الحارس الذي لا يضيع بإعادة تشغيل الدالة.
const hits = new Map();
function limited(key, max, windowMs, now = Date.now()) {
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}
const ipOf = (req) => String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim().slice(0, 64) || "local";

// ---- سجلّ ما حُجز عندنا -----------------------------------------------------
// ‏تقويم جوجل ليس المصدر الوحيد: قبل ربطه لا شيء يمنع أن يحجز اثنان الفترة
// نفسها. الحجوزات تُكتب صفوفَ `requests` من نوع CONSULTATION بموعدٍ في
// `appointment`، فتُطرح فتراتها من المعروض وتظهر في لوحة العمليات مع بقية
// الطلبات. أي عطل هنا لا يُسقط الحجز — يُسجَّل ويُمضى.
const liveAppt = (r) => {
  const a = r && r.appointment;
  if (!a || !a.date || !a.time) return null;
  if (r.status === "CANCELLED" || a.status === "CANCELLED") return null;
  return a;
};
async function bookedSet(exceptRef = "") {
  if (!DB_ON) return new Set();
  try {
    const rows = await sb("requests?select=ref,appointment,status&type=eq.CONSULTATION&order=created_at.desc&limit=600");
    const out = new Set();
    for (const r of rows || []) {
      const a = liveAppt(r);
      if (!a) continue;
      if (exceptRef && (r.ref === exceptRef || a.ref === exceptRef)) continue;
      out.add(a.date + " " + a.time);
    }
    return out;
  } catch (e) {
    console.error("booked read", String(e.message || e).slice(0, 160));
    return new Set();
  }
}

// ‏مواعيد هذا الشخص القادمة (بالبريد أو الجوال) — سقف الحجوزات الفعّالة.
async function activeFor(email, phone, now = Date.now()) {
  if (!DB_ON) return 0;
  try {
    // جوالٌ فارغ لا يدخل الشرط: «client_phone.eq.» يطابق كل صفٍّ بلا جوال، فيُحسب موعد غيرك عليك.
    const byPhone = phone.replace(/\D/g, "").length >= 8;
    const f = byPhone ? `or=(client_email.eq.${encodeURIComponent(email)},client_phone.eq.${encodeURIComponent(phone)})` : `client_email=eq.${encodeURIComponent(email)}`;
    const rows = await sb(`requests?select=ref,appointment,status&type=eq.CONSULTATION&${f}&order=created_at.desc&limit=60`);
    const seen = new Set();
    for (const r of rows || []) {
      const a = liveAppt(r);
      if (!a || new Date(iso(a.date, a.time)).getTime() <= now) continue;
      seen.add(a.date + " " + a.time);                 // صفّا /my و/consultation للموعد نفسه يُعدّان واحداً
    }
    return seen.size;
  } catch { return 0; }
}

// ‏ضيفٌ لا يحجز ببريدٍ أو جوالٍ يملكهما حسابٌ مسجّل: لا يُرسَل باسم غيره دعوةٌ
// ولا يُحجز في حسابه. صاحب الحساب يسجّل دخوله ويحجز من «مواعيدي».
function phoneVariants(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length < 8) return [];
  const core = d.slice(-9);
  return [...new Set([String(p).trim(), d, core, "0" + core, "966" + core, "+966" + core, "00966" + core])];
}
async function ownedByAccount(email, phone) {
  if (!DB_ON) return false;
  try {
    const byMail = await sb(`users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
    if (byMail && byMail.length) return true;
    const vs = phoneVariants(phone);
    if (vs.length) {
      const byPhone = await sb(`users?phone=in.(${vs.map((v) => `"${v.replace(/"/g, "")}"`).join(",")})&select=id,email&limit=3`);
      if ((byPhone || []).some((u) => String(u.email || "").toLowerCase() !== email)) return true;
    }
  } catch (e) { console.error("identity check", String(e.message || e).slice(0, 120)); }
  return false;
}

// ‏الحجز يُحفظ طلباً كامل الأركان: مرجعه ونوعه وبيانات صاحبه وموعده. بلا هذا
// يبقى الحجز في البريد وحده — لا يراه الفريق في اللوحة ولا يمنع حجزاً ثانياً.
async function saveBooking({ ref, name, phone, email, topic, date, time, notes, lang, eventId, meet, confirmed }) {
  if (!DB_ON) return null;
  try {
    const rows = await sb("requests", {
      method: "POST",
      body: [{
        ref, type: "CONSULTATION", source: "WEBSITE", status: "NEW",
        lang: ["ar", "en", "fr", "zh"].includes(lang) ? lang : "ar",
        title: topic ? `استشارة مجانية بالفيديو — ${topic}`.slice(0, 200) : "استشارة مجانية بالفيديو",
        summary: notes.slice(0, 2000),
        appointment: {
          date, time, tz: TZ, topic, mode: "video", minutes: bookingConfig().slotMin, ref,
          status: confirmed ? "BOOKED" : "PENDING", gcal: eventId || "", meet: meet || "",
        },
        client_name: name, client_email: email, client_phone: phone,
      }],
    });
    return (rows && rows[0]) || null;
  } catch (e) {
    console.error("booking save", String(e.message || e).slice(0, 160));
    return null;
  }
}

// ‏مرجعٌ عشوائيٌّ غير مستعمل: ٦ أرقام تتصادم بين ألفٍ من الحجوزات باحتمالٍ يقارب
// النصف (مفارقة أعياد الميلاد)، والرابط يُفتح بالمرجع، فيُتحقَّق من الفراغ.
async function freshRef() {
  for (let i = 0; i < 6; i++) {
    const ref = "BC-" + String(crypto.randomInt(100000, 1000000));
    if (!DB_ON) return ref;
    try { const hit = await sb(`requests?ref=eq.${ref}&select=id&limit=1`); if (!hit || !hit.length) return ref; }
    catch { return ref; }
  }
  return "BC-" + String(crypto.randomInt(100000, 1000000));
}

async function findBooking(ref, email) {
  if (!DB_ON || !/^BC-\d{6}$/.test(ref)) return null;
  const rows = await sb(`requests?ref=eq.${encodeURIComponent(ref)}&type=eq.CONSULTATION&select=id,ref,status,lang,title,client_name,client_email,client_phone,appointment&limit=5`);
  return (rows || []).find((r) => !email || String(r.client_email || "").toLowerCase() === email) || null;
}

/**
 * الأيام المتاحة وفتراتها. تُحجب أيام العطلة، وما مضى، وما هو دون مهلة الحجز،
 * وما حُجز عندنا، وما هو مشغول في تقويم الشركة حين يكون التقويم مربوطاً.
 */
async function availability(days, now = Date.now()) {
  const c = bookingConfig();
  const list = [];
  const n = Math.min(Math.max(days || c.horizon, 1), 60);
  for (let i = 0; i < n; i++) {
    const date = riyadhToday(now + i * 86400000);
    if (isOffDay(date)) continue;
    list.push({ date, slots: slotsOfDay() });
  }
  const cal = gcalState();
  const meta = {
    calendar: cal, invites: gcalCanInvite(), slotMinutes: c.slotMin, tz: TZ,
    hours: { from: hhmm(c.fromMin), to: hhmm(c.toMin), lastStart: hhmm(c.toMin - c.slotMin) },
    offDays: c.offDays, leadMinutes: c.leadMin,
  };
  if (!list.length) return { days: [], ...meta };

  // حجب ما مضى وما هو دون المهلة، ثم ما حُجز عندنا
  const earliest = now + c.leadMin * 60000;
  for (const d of list) d.slots = d.slots.filter((t) => new Date(iso(d.date, t)).getTime() >= earliest);
  const mine = await bookedSet();
  if (mine.size) for (const d of list) d.slots = d.slots.filter((t) => !mine.has(d.date + " " + t));

  let calendar = cal;
  if (cal === "linked" || cal === "test") {
    try {
      const taken = await gcalBusy(iso(list[0].date, "00:00"), iso(list[list.length - 1].date, "23:59"));
      for (const d of list) {
        d.slots = d.slots.filter((t) => {
          const s = new Date(iso(d.date, t)).getTime();
          const e = s + c.slotMin * 60000;
          return !taken.some((b) => s < new Date(b.end).getTime() && e > new Date(b.start).getTime());
        });
      }
    } catch (e) {
      // تقويمٌ مربوطٌ ومتعذّر القراءة: تُعرض كل الفترات ويُقال إن التحقق
      // تعذّر — إخفاء اليوم كله أسوأ من احتمال تعارض يُعالجه الفريق.
      console.error("gcal busy", String(e.message || e).slice(0, 160));
      calendar = "error";
    }
  }
  return { days: list.filter((d) => d.slots.length), ...meta, calendar };
}

// ---- النصوص (عربي وإنجليزي؛ الفرنسية والصينية تأخذ الإنجليزية) ---------------
const L = (lang) => (lang === "ar" || !lang ? "ar" : "en");
const prefix = (lang) => (lang === "en" ? "" : "/" + lang);
function whenText(date, time, lang) {
  const ar = L(lang) === "ar";
  let day = date;
  try {
    day = new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso(date, time)));
  } catch {}
  const [h, m] = time.split(":").map(Number);
  const h12 = ((h + 11) % 12) + 1;
  const clock = ar ? `${h12}:${pad(m)} ${h < 12 ? "ص" : "م"}` : `${h12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
  return ar ? `${day} · الساعة ${time} (${clock}) بتوقيت الرياض GMT+3` : `${day} · ${time} (${clock}) Riyadh time, GMT+3`;
}

const btn = (href, label, solid) => `<a href="${esc(href)}" style="display:inline-block;margin:4px 4px 4px 0;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;${solid ? "background:#0B1B5A;color:#fff" : "background:#eef1fb;color:#0B1B5A"}">${esc(label)}</a>`;

function clientMail({ ref, name, topic, date, time, lang, confirmed, invited, meet, add, manage }) {
  const ar = L(lang) === "ar";
  const dir = ar ? "rtl" : "ltr";
  const when = whenText(date, time, lang);
  const mins = bookingConfig().slotMin;
  const T = ar ? {
    title: confirmed ? "تم تأكيد موعدك" : "استلمنا طلب موعدك",
    product: "الاتصال المرئي — استشارة مجانية",
    hi: `مرحباً ${esc(name)}،`,
    body: confirmed
      ? "حجزنا لك جلسة استشارة مجانية بالفيديو مع فريق Business Partner عبر Google Meet."
      : "استلمنا طلب جلستك. <b>لم يُؤكَّد الموعد بعد</b> — سيثبّته الفريق ثم يصلك رابط الاجتماع ودعوة التقويم على هذا البريد.",
    whenL: "الموعد", durL: "المدة", dur: `${mins} دقيقة · فيديو عبر Google Meet · مجانية`,
    topicL: "الموضوع", refL: "رقم الحجز",
    inv: invited ? "أرسلنا لك أيضاً دعوة تقويم من Google على هذا البريد." : "أضِف الموعد إلى تقويمك بالزر أدناه.",
    join: "رابط الاجتماع", joinNote: "ينفتح الانضمام قبل الموعد بخمس دقائق.",
    addL: "أضِف إلى تقويم Google", changeL: "تغيير الموعد", cancelL: "إلغاء الموعد",
    foot: `Business Partner · الرياض · ${WA}`,
  } : {
    title: confirmed ? "Your session is confirmed" : "We received your request",
    product: "Video call — free consultation",
    hi: `Hello ${esc(name)},`,
    body: confirmed
      ? "Your free video consultation with the Business Partner team is booked on Google Meet."
      : "We received your request. <b>The time is not confirmed yet</b> — the team will confirm it and send the meeting link and calendar invitation to this address.",
    whenL: "When", durL: "Length", dur: `${mins} minutes · video on Google Meet · free`,
    topicL: "Topic", refL: "Booking no.",
    inv: invited ? "We also sent you a Google Calendar invitation at this address." : "Add the session to your calendar with the button below.",
    join: "Meeting link", joinNote: "You can join five minutes before the start.",
    addL: "Add to Google Calendar", changeL: "Change time", cancelL: "Cancel session",
    foot: `Business Partner · Riyadh · ${WA}`,
  };
  const row = (k, v) => `<tr><td style="padding:6px 0;color:#667;width:96px;vertical-align:top">${k}</td><td style="padding:6px 0"><b>${v}</b></td></tr>`;
  return `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;text-align:${ar ? "right" : "left"}">
    <p style="margin:0;color:#667;font-size:13px">${T.product}</p>
    <h2 style="color:#0B1B5A;margin:4px 0 12px">${T.title}</h2>
    <p>${T.hi}<br>${T.body}</p>
    <table style="border-collapse:collapse;font-size:14px">${row(T.whenL, esc(when))}${row(T.durL, T.dur)}${topic ? row(T.topicL, esc(topic)) : ""}${row(T.refL, `<span dir="ltr">${esc(ref)}</span>`)}</table>
    ${confirmed ? `<p style="margin:16px 0 4px">${meet ? btn(meet, T.join, true) : ""}${btn(add, T.addL, !meet)}</p>${meet ? `<p style="color:#667;font-size:12.5px;margin:4px 0">${T.joinNote} <span dir="ltr">${esc(meet)}</span></p>` : ""}<p style="font-size:13px">${T.inv}</p>` : `<p style="margin:16px 0 4px">${btn(add, T.addL, false)}</p>`}
    ${manage ? `<p style="margin:14px 0 0;font-size:13px"><a href="${esc(manage)}">${T.changeL}</a> · <a href="${esc(manage)}&do=cancel">${T.cancelL}</a></p>` : ""}
    <p style="color:#667;font-size:12.5px;margin-top:18px">${T.foot}</p></div>`;
}

function teamMail({ ref, name, phone, email, topic, date, time, notes, confirmed, invited, meet, add, kind }) {
  const head = kind === "cancel" ? "إلغاء موعد" : kind === "move" ? "تغيير موعد" : confirmed ? "حجز جديد — الاتصال المرئي (استشارة مجانية)" : "طلب موعد جديد بانتظار التأكيد — الاتصال المرئي";
  return `<div dir="rtl" style="font-family:Arial,sans-serif">
    <h2 style="color:#0B1B5A">${head} — ${esc(ref)}</h2>
    <p><b>الاسم:</b> ${esc(name)}<br><b>الجوال:</b> ${esc(phone)}<br><b>البريد:</b> ${esc(email)}<br>
    <b>الموضوع:</b> ${esc(topic) || "—"}<br><b>الموعد:</b> ${esc(date)} · ${esc(time)} (الرياض GMT+3)<br>
    <b>ملاحظات:</b> ${esc(notes) || "—"}</p>
    ${kind ? "" : confirmed
      ? `<p><b>التقويم:</b> أُنشئ الحدث${invited ? " ودُعي العميل والمالك" : " <b>بلا دعوات</b> (حساب الخدمة بلا تفويض نطاق — أضِف GOOGLE_SA_IMPERSONATE)"}.${meet ? ` <a href="${esc(meet)}">رابط الاجتماع</a>` : ""}</p>`
      : `<p style="color:#b42318"><b>لم يُنشأ حدثٌ في التقويم</b> (التقويم غير مضبوط أو تعذّر) — ثبّت الموعد يدوياً وأرسل الرابط للعميل.</p>`}
    ${add ? `<p><a href="${esc(add)}">إضافة إلى تقويم Google</a></p>` : ""}</div>`;
}

const jsonOut = (res, code, obj) => { res.statusCode = code; return res.end(JSON.stringify(obj)); };

function manageUrl(ref, email, lang) {
  const t = manageToken(ref, email);
  return t ? `${SELF_BASE}${prefix(lang)}/consultation?manage=${encodeURIComponent(ref)}&t=${encodeURIComponent(t)}` : "";
}

const inviteList = (clientEmail) => [...new Set([clientEmail, OWNER_EMAIL, TEAM_EMAIL].filter(isEmail).map((e) => e.toLowerCase()))]
  .filter((e) => e !== String(CAL_ID || "").toLowerCase() || e === clientEmail || e === OWNER_EMAIL);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const now = Date.now();

  if (req.method === "GET") {
    const u = new URL(req.url, "http://x");
    const action = u.searchParams.get("action");
    // ?action=slots يعيد الأيام والفترات المتاحة والساعات الفعلية.
    if (action === "slots") {
      try {
        const a = await availability(Number(u.searchParams.get("days")) || bookingConfig().horizon, now);
        return jsonOut(res, 200, { ok: true, ...a });
      } catch (e) {
        return jsonOut(res, 500, { ok: false, error: "slots_failed", detail: String(e.message || e).slice(0, 160) });
      }
    }
    // ?action=manage&ref=&t= — الموعد لصاحب رابط الإدارة.
    if (action === "manage") {
      const ref = String(u.searchParams.get("ref") || "").trim(), t = String(u.searchParams.get("t") || "");
      if (limited("m:" + ipOf(req), 40, 600000, now)) return jsonOut(res, 429, { ok: false, error: "rate_limited" });
      try {
        const row = await findBooking(ref, "");
        const ok = row && checkManageToken(ref, String(row.client_email || "").toLowerCase(), t);
        if (!ok) return jsonOut(res, 404, { ok: false, error: "not_found" });
        const a = row.appointment || {};
        const start = new Date(iso(a.date, a.time)).getTime();
        const cancelled = row.status === "CANCELLED" || a.status === "CANCELLED";
        return jsonOut(res, 200, {
          ok: true, ref, name: row.client_name, topic: a.topic || "", status: cancelled ? "CANCELLED" : a.status || "BOOKED",
          when: { date: a.date, time: a.time, tz: TZ, minutes: a.minutes || bookingConfig().slotMin },
          meet: cancelled ? "" : a.meet || "", canChange: !cancelled && start > now,
        });
      } catch { return jsonOut(res, 500, { ok: false, error: "server_error" }); }
    }
    const c = bookingConfig();
    return jsonOut(res, 200, {
      status: "ok", emailConfigured: !!RESEND_API_KEY, teamEmail: !!TEAM_EMAIL,
      calendar: gcalState(), invites: gcalCanInvite(),
      hours: { from: hhmm(c.fromMin), to: hhmm(c.toMin), slotMinutes: c.slotMin, tz: TZ, horizonDays: c.horizon, offDays: c.offDays, leadMinutes: c.leadMin },
    });
  }
  if (req.method !== "POST") return jsonOut(res, 405, { error: "method_not_allowed" });

  const b = await readBody(req);
  const lang = ["ar", "en", "fr", "zh"].includes(b.lang) ? b.lang : "ar";
  const fail = (code, status, extra = {}) => jsonOut(res, status, { ok: false, error: code, message: bookingMessage(code, lang), ...extra });
  const action = String(b.action || "book");
  const ip = ipOf(req);

  // =================== إلغاء / تغيير موعد قائم (برابط الإدارة) ===================
  if (action === "cancel" || action === "reschedule") {
    if (limited("m:" + ip, 20, 600000, now)) return fail("rate_limited", 429);
    const ref = String(b.ref || "").trim();
    let row;
    try { row = await findBooking(ref, ""); } catch { return fail("server_error", 500); }
    const rowEmail = row ? String(row.client_email || "").toLowerCase() : "";
    if (!row || !checkManageToken(ref, rowEmail, String(b.t || ""))) return fail("not_found", 404);
    const a = row.appointment || {};
    const cancelled = row.status === "CANCELLED" || a.status === "CANCELLED";
    const startMs = new Date(iso(a.date, a.time)).getTime();
    const rlang = lang === "ar" && row.lang ? row.lang : lang;

    if (action === "cancel") {
      if (cancelled) return jsonOut(res, 200, { ok: true, ref, status: "CANCELLED", already: true });
      if (startMs <= now) return fail("started", 409);
      try { if (a.gcal) await gcalCancel(a.gcal); } catch (e) { console.error("gcal cancel", String(e.message || e).slice(0, 160)); }
      try {
        await sb(`requests?id=eq.${row.id}`, { method: "PATCH", prefer: "return=minimal",
          body: { status: "CANCELLED", appointment: { ...a, status: "CANCELLED", cancelled_at: new Date().toISOString() } } });
      } catch (e) { console.error("booking cancel save", String(e.message || e).slice(0, 160)); return fail("server_error", 500); }
      await sendEmail(TEAM_EMAIL, `إلغاء موعد ${ref} — ${row.client_name}`, teamMail({ ref, name: row.client_name, phone: row.client_phone, email: rowEmail, topic: a.topic, date: a.date, time: a.time, notes: "", kind: "cancel" }));
      return jsonOut(res, 200, { ok: true, ref, status: "CANCELLED" });
    }

    // reschedule
    if (cancelled) return fail("already_cancelled", 409);
    if (startMs <= now) return fail("started", 409);
    const date = String(b.date || "").trim(), time = String(b.time || "").trim();
    const v = validateSlot(date, time, now);
    if (!v.ok) return fail(v.error, 400);
    if (date === a.date && time === a.time) return fail("same_slot", 409);
    if ((await bookedSet(ref)).has(date + " " + time)) return fail("slot_taken", 409);
    try {
      if (gcalState() !== "off" && (await gcalBusy(iso(date, time), new Date(v.endMs).toISOString())).length) return fail("slot_taken", 409);
    } catch (e) { console.error("gcal busy (move)", String(e.message || e).slice(0, 160)); }
    let moved = false;
    try { if (a.gcal) moved = await gcalMove(a.gcal, { startIso: iso(date, time), endIso: new Date(v.endMs).toISOString() }); }
    catch (e) { console.error("gcal move", String(e.message || e).slice(0, 160)); }
    const confirmed = !!a.gcal && moved;
    try {
      await sb(`requests?id=eq.${row.id}`, { method: "PATCH", prefer: "return=minimal",
        body: { appointment: { ...a, date, time, status: confirmed ? "BOOKED" : "PENDING", moved_at: new Date().toISOString() } } });
    } catch (e) { console.error("booking move save", String(e.message || e).slice(0, 160)); return fail("server_error", 500); }
    const add = gcalUrl({ topic: a.topic, date, time, meet: a.meet, lang: rlang });
    const manage = manageUrl(ref, rowEmail, rlang);
    await Promise.all([
      sendEmail(rowEmail, (L(rlang) === "ar" ? `تم تغيير موعدك ${ref} — الاتصال المرئي` : `Your session was rescheduled ${ref}`),
        clientMail({ ref, name: row.client_name, topic: a.topic, date, time, lang: rlang, confirmed, invited: confirmed, meet: a.meet, add, manage })),
      sendEmail(TEAM_EMAIL, `تغيير موعد ${ref} — ${row.client_name}`, teamMail({ ref, name: row.client_name, phone: row.client_phone, email: rowEmail, topic: a.topic, date, time, notes: "", kind: "move" })),
    ]);
    return jsonOut(res, 200, { ok: true, ref, confirmed, when: { date, time, tz: TZ, minutes: bookingConfig().slotMin }, meet: a.meet || "", gcalUrl: add });
  }

  // =============================== حجز جديد ===============================
  const name = String(b.name || "").trim().slice(0, 120);
  const phone = String(b.phone || "").trim().slice(0, 30);
  let email = String(b.email || "").trim().toLowerCase().slice(0, 160);
  const topic = String(b.topic || "").trim().slice(0, 120);
  const date = String(b.date || "").trim();
  const time = String(b.time || "").trim();
  const notes = String(b.notes || "").trim().slice(0, 1000);

  // الجلسة أولاً: من سجّل دخوله (حجزٌ من «مواعيدي») لا يُطلب منه جوالٌ ثانية.
  let sess = null;
  try { sess = await getSession(req); } catch {}
  const sessEmail = String((sess && sess.user && sess.user.email) || "").toLowerCase();
  if (name.length < 2 || !isEmail(email) || (!sessEmail && phone.replace(/\D/g, "").length < 8)) return fail("invalid_fields", 400);

  // الموعد يُفحص في الخادم: ساعات الجلسات، يوم العطلة، الماضي، مهلة الساعة.
  const v = validateSlot(date, time, now);
  if (!v.ok) return fail(v.error, 400);

  if (limited("b:" + ip, 6, 3600000, now) || limited("be:" + email, 3, 3600000, now)) return fail("rate_limited", 429);

  // الهوية: من سجّل دخوله يحجز ببريد حسابه وحده؛ والضيف لا يحجز ببريد/جوال حسابٍ مسجّل.
  if (sessEmail) { if (sessEmail !== email) return fail("email_mismatch", 403); }
  else if (await ownedByAccount(email, phone)) return fail("signin_required", 403, { signin: `${prefix(lang)}/my` });

  if ((await activeFor(email, phone, now)) >= MAX_ACTIVE) return fail("too_many_active", 409);

  const ref = await freshRef();
  // ‏الفترة قد تُحجز بين عرضها على الشاشة وضغط الزر، فتُفحص مرة أخرى — عندنا
  // أولاً، لأن هذا الفحص يعمل سواء رُبط التقويم أم لا.
  if ((await bookedSet()).has(date + " " + time)) return fail("slot_taken", 409);

  // ---- التقويم: الموعد يُوضع في تقويم الشركة ويُدعى إليه العميل والمالك ----
  // ويُعاد التحقق من خلوّ الفترة قبل الإنشاء: بين عرض المواعيد على شاشة
  // العميل وضغطه قد يكون آخرُ حجزها، فالفحص عند العرض وحده يسمح بحجزين
  // على فترة واحدة.
  const startIso = iso(date, time);
  const endIso = new Date(v.endMs).toISOString();
  const calState = gcalState();
  let event = null, calendarState = calState;
  if (calState !== "off") {
    try {
      if ((await gcalBusy(startIso, endIso)).length > 0) return fail("slot_taken", 409);
      event = await gcalCreate({
        summary: `الاتصال المرئي — استشارة مجانية — ${name}`,
        description: [`الاتصال المرئي — استشارة مجانية (${bookingConfig().slotMin} دقيقة، Google Meet)`, `الموضوع: ${topic || "—"}`,
                      `الجوال: ${phone}`, `البريد: ${email}`, notes ? `ملاحظات: ${notes}` : "", `المرجع: ${ref}`].filter(Boolean).join("\n"),
        startIso, endIso, attendees: inviteList(email), location: "Google Meet",
      });
    } catch (e) {
      // التقويم متعذّر: الطلب لا يسقط — يُسجَّل «بانتظار التأكيد» ويُقال ذلك
      // للعميل، ويضع الفريق الموعد يدوياً.
      console.error("gcal create", String(e.message || e).slice(0, 180));
      calendarState = "error";
    }
  }
  const confirmed = !!event;
  const meet = (event && event.meet) || "";
  const invited = !!(event && event.invited);
  const add = gcalUrl({ topic, date, time, notes, meet, lang });
  const manage = manageUrl(ref, email, lang);

  await saveBooking({ ref, name, phone, email, topic, date, time, notes, lang, eventId: (event && event.id) || "", meet, confirmed });

  // Notify the team + confirm to the client (best-effort; booking succeeds regardless).
  const teamTo = [TEAM_EMAIL, ...(!confirmed && OWNER_EMAIL !== TEAM_EMAIL ? [OWNER_EMAIL] : [])];
  const tHtml = teamMail({ ref, name, phone, email, topic, date, time, notes, confirmed, invited, meet, add });
  const subj = L(lang) === "ar"
    ? (confirmed ? `تأكيد موعدك — الاتصال المرئي (استشارة مجانية) ${ref}` : `استلمنا طلب موعدك ${ref} — Business Partner`)
    : (confirmed ? `Your free video consultation is confirmed ${ref}` : `We received your appointment request ${ref}`);
  const [, clientSent] = await Promise.all([
    Promise.all(teamTo.map((to) => sendEmail(to, `${confirmed ? "حجز جديد" : "طلب موعد بانتظار التأكيد"} ${ref} — ${name}`, tHtml))),
    sendEmail(email, subj, clientMail({ ref, name, topic, date, time, lang, confirmed, invited, meet, add, manage })),
    // Register the lead in the CRM and add to the newsletter audience (best-effort).
    crmLead({ name, phone, email, topic, date, notes, ref }),
    addToAudience(email, name),
    forwardLead({ source: "consultation", ref, name, phone, email, topic, date, notes }),
    // n8n notify webhook: source=booking + date/time auto-creates the event
    // on the owner's Google Calendar (workflow bldhMv0BAGs41Xqo).
    // محلياً/معاينة (WHATSAPP_MODE != live) لا يغادر شيءٌ إلى n8n الإنتاجي: تُسجَّل في صندوق الصادر.
    (WHATSAPP_LIVE
      ? fetch(process.env.OWNER_WA_WEBHOOK || n8nWebhookUrl("website-lead-notify"), {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "booking", ref, name, phone, email, date, time, topic, transcript: `📅 حجز استشارة (${topic || "عام"}): ${date} · ${time}` }),
        }).catch(() => {})
      : outbox({ channel: "n8n-booking", ref, name, date, time, topic })),
  ]);

  return jsonOut(res, 200, {
    ok: true, ref, gcalUrl: add,
    confirmed,                                  // false = طلب بانتظار تثبيت الفريق، لا حجزٌ مؤكَّد
    emailSent: !!clientSent.ok,
    calendar: calendarState, invited,
    meet, eventId: (event && event.id) || "",
    manageUrl: manage,
    when: { date, time, tz: TZ, minutes: bookingConfig().slotMin },
  });
}
