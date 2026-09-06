// Business Partner — ربط تقويم جوجل (Google Calendar API v3).
//
// ملفٌ مساعد ببادئة «_» فلا يستهلك دالة من سقف الاثنتي عشرة على Vercel.
//
// الهوية: حساب خدمة (Service Account) يشارك المالكُ تقويمَه معه بصلاحية
// «إجراء تغييرات على الأحداث». لا OAuth ولا شاشة موافقة ولا رمزٌ ينتهي —
// وهذا ما يناسب تقويماً واحداً للشركة.
//
// المتغيّرات المطلوبة في Vercel:
//   GOOGLE_SA_EMAIL        بريد حساب الخدمة (…@….iam.gserviceaccount.com)
//   GOOGLE_SA_PRIVATE_KEY  المفتاح الخاص كاملاً بصيغة PEM
//   GOOGLE_CALENDAR_ID     معرّف التقويم (بريد المالك أو معرّف تقويم مشترك)
//
// وبدونها لا يسقط الحجز: تبقى المواعيد تُحجز وتُخزَّن عندنا وتصل بالبريد،
// ويُقال في اللوحة إن التقويم غير مربوط — تعطّلٌ معلَنٌ خيرٌ من صمت.
import crypto from "node:crypto";

const env = (n) => String(process.env[n] || "").trim();
export const CAL_ID = env("GOOGLE_CALENDAR_ID") || env("BOOKING_EMAIL") || "";
const SA_EMAIL = env("GOOGLE_SA_EMAIL");
// المفتاح يُلصق في Vercel بأسطرٍ حقيقية أو بـ\n مكتوبة — كلاهما مقبول.
const SA_KEY = env("GOOGLE_SA_PRIVATE_KEY").replace(/\\n/g, "\n");

export const gcalConfigured = () => !!(SA_EMAIL && SA_KEY && CAL_ID);

const b64u = (b) => Buffer.from(b).toString("base64url");

let cached = { token: "", exp: 0 };
async function token() {
  if (!gcalConfigured()) throw new Error("gcal_not_configured");
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;
  const claim = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(claim));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(SA_KEY).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`gcal token ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  cached = { token: d.access_token, exp: now + (Number(d.expires_in) || 3600) };
  return cached.token;
}

async function api(path, init = {}) {
  const t = await token();
  const r = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { authorization: `Bearer ${t}`, "content-type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`gcal ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** الفترات المشغولة بين وقتين — لحجب المواعيد المحجوزة أصلاً. */
export async function busy(fromIso, toIso) {
  const d = await api("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, timeZone: "Asia/Riyadh", items: [{ id: CAL_ID }] }),
  });
  const cal = (d.calendars && d.calendars[CAL_ID]) || {};
  return (cal.busy || []).map((b) => ({ start: b.start, end: b.end }));
}

/**
 * يضع الموعد في تقويم الشركة ويدعو العميل، ويطلب رابط Google Meet.
 * @returns {{id:string, link:string, meet:string}}
 */
export async function createEvent({ summary, description, startIso, endIso, attendees = [], location = "" }) {
  const d = await api(`/calendars/${encodeURIComponent(CAL_ID)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    body: JSON.stringify({
      summary, description, location,
      start: { dateTime: startIso, timeZone: "Asia/Riyadh" },
      end: { dateTime: endIso, timeZone: "Asia/Riyadh" },
      attendees: attendees.filter(Boolean).map((email) => ({ email })),
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 1440 }, { method: "popup", minutes: 30 }] },
      conferenceData: { createRequest: { requestId: `bp-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
  });
  const meet = d.hangoutLink || ((d.conferenceData && d.conferenceData.entryPoints) || []).map((e) => e.uri).find((u) => /meet\./.test(u)) || "";
  return { id: d.id || "", link: d.htmlLink || "", meet };
}

export async function cancelEvent(id) {
  if (!id) return false;
  await api(`/calendars/${encodeURIComponent(CAL_ID)}/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" });
  return true;
}
