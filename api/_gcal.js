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
//   GOOGLE_SA_IMPERSONATE  (اختياري لكنه لازم لإرسال الدعوات) بريد مستخدمٍ في
//                          Google Workspace يتقمّصه حساب الخدمة بتفويض النطاق
//                          الكامل (Domain-Wide Delegation). حساب الخدمة وحده
//                          لا يستطيع دعوة مدعوّين ولا إنشاء Google Meet؛ ترفضه
//                          جوجل بـ«forbiddenForServiceAccounts».
//
// الوضع: CALENDAR_MODE (api/_mode.js). محلياً ومعاينةً «test»: لا اتصال بجوجل
// أبداً، والأحداث تُسجَّل في الذاكرة وصندوق الصادر ويُعاد رابط Meet تجريبي —
// فيُختبر المسار كلّه بلا تقويمٍ حقيقي ولا دعوةٍ تصل أحداً.
// وبدونها لا يسقط الحجز: تبقى المواعيد تُحجز وتُخزَّن عندنا وتصل بالبريد،
// ويُقال في اللوحة إن التقويم غير مربوط — تعطّلٌ معلَنٌ خيرٌ من صمت.
import crypto from "node:crypto";
import { CALENDAR_MODE, outbox } from "./_mode.js";

const env = (n) => String(process.env[n] || "").trim();
export const CAL_ID = env("GOOGLE_CALENDAR_ID") || env("BOOKING_EMAIL") || "";
const SA_EMAIL = env("GOOGLE_SA_EMAIL");
// المفتاح يُلصق في Vercel بأسطرٍ حقيقية أو بـ\n مكتوبة — كلاهما مقبول.
const SA_KEY = env("GOOGLE_SA_PRIVATE_KEY").replace(/\\n/g, "\n");

const SA_SUBJECT = env("GOOGLE_SA_IMPERSONATE");

export const gcalTestMode = () => CALENDAR_MODE !== "live";
export const gcalConfigured = () => gcalTestMode() || !!(SA_EMAIL && SA_KEY && CAL_ID);
/** حالة التقويم كما تُعرض: linked (حيّ) · test (محاكى) · off (غير مضبوط). */
export const gcalState = () => (gcalTestMode() ? "test" : (SA_EMAIL && SA_KEY && CAL_ID) ? "linked" : "off");
/** هل الدعوات ممكنة؟ بلا تفويضٍ لا يدعو حساب الخدمة أحداً. */
export const gcalCanInvite = () => gcalTestMode() || !!SA_SUBJECT;

// الأحداث المحاكاة (وضع test) — للاختبارات ولقراءة «ما كان سيحدث».
export const testEvents = [];

const b64u = (b) => Buffer.from(b).toString("base64url");

let cached = { token: "", exp: 0 };
async function token() {
  if (gcalTestMode()) throw new Error("gcal_test_mode");
  if (!gcalConfigured()) throw new Error("gcal_not_configured");
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;
  const claim = {
    iss: SA_EMAIL,
    ...(SA_SUBJECT ? { sub: SA_SUBJECT } : {}),
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
  if (gcalTestMode()) {
    const a = new Date(fromIso).getTime(), b = new Date(toIso).getTime();
    return testEvents.filter((e) => !e.cancelled && new Date(e.startIso).getTime() < b && new Date(e.endIso).getTime() > a)
      .map((e) => ({ start: e.startIso, end: e.endIso }));
  }
  const d = await api("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, timeZone: "Asia/Riyadh", items: [{ id: CAL_ID }] }),
  });
  const cal = (d.calendars && d.calendars[CAL_ID]) || {};
  return (cal.busy || []).map((b) => ({ start: b.start, end: b.end }));
}

/**
 * يضع الموعد في تقويم الشركة ويدعو المدعوّين (العميل والمالك) ويطلب رابط
 * Google Meet. الدعوات تُرسَل من جوجل نفسها (sendUpdates=all).
 * @returns {{id:string, link:string, meet:string, invited:boolean}}
 *   invited=false حين رفضت جوجل الدعوات (حساب خدمة بلا تفويض): الحدث أُنشئ
 *   بلا مدعوّين، والمتصل يُخبر العميل بأن الرابط يصله بالبريد.
 */
export async function createEvent({ summary, description, startIso, endIso, attendees = [], location = "" }) {
  const list = [...new Set(attendees.filter(Boolean).map((e) => String(e).trim().toLowerCase()))];
  if (gcalTestMode()) {
    const id = "test_evt_" + crypto.randomBytes(4).toString("hex");
    const ev = { id, summary, description, startIso, endIso, attendees: list, location, sendUpdates: "all",
      meet: `https://meet.google.com/tst-${id.slice(-4)}-mock`, link: "https://calendar.google.com/calendar/event?eid=" + id };
    testEvents.push(ev);
    await outbox({ kind: "calendar", to: list.join(", "), subject: `[calendar:create] ${summary}`, body: `${startIso} → ${endIso} · ${ev.meet}` });
    return { id, link: ev.link, meet: ev.meet, invited: true };
  }
  const make = (withGuests) => api(`/calendars/${encodeURIComponent(CAL_ID)}/events?conferenceDataVersion=1&sendUpdates=${withGuests ? "all" : "none"}`, {
    method: "POST",
    body: JSON.stringify({
      summary, description, location,
      start: { dateTime: startIso, timeZone: "Asia/Riyadh" },
      end: { dateTime: endIso, timeZone: "Asia/Riyadh" },
      ...(withGuests ? { attendees: list.map((email) => ({ email })) } : {}),
      guestsCanModify: false, guestsCanInviteOthers: false,
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 1440 }, { method: "popup", minutes: 30 }] },
      conferenceData: { createRequest: { requestId: `bp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
  });
  let d, invited = list.length > 0;
  try { d = await make(list.length > 0); }
  catch (e) {
    // حساب خدمة بلا تفويض نطاق: لا يدعو أحداً. يُحفَظ الموعد بلا مدعوّين
    // بدل أن يسقط الحجز، ويُعلَن ذلك لا يُسكَت عنه.
    if (list.length && /forbiddenForServiceAccounts|Domain-Wide Delegation/i.test(String(e && e.message))) { d = await make(false); invited = false; }
    else throw e;
  }
  const meet = d.hangoutLink || ((d.conferenceData && d.conferenceData.entryPoints) || []).map((e) => e.uri).find((u) => /meet\./.test(u)) || "";
  return { id: d.id || "", link: d.htmlLink || "", meet, invited };
}

/** يغيّر وقت حدثٍ قائم ويُعلم المدعوّين. */
export async function moveEvent(id, { startIso, endIso }) {
  if (!id) return false;
  if (gcalTestMode()) {
    const ev = testEvents.find((e) => e.id === id);
    if (ev) { ev.startIso = startIso; ev.endIso = endIso; }
    await outbox({ kind: "calendar", to: ev ? ev.attendees.join(", ") : "", subject: "[calendar:move] " + id, body: `${startIso} → ${endIso}` });
    return true;
  }
  await api(`/calendars/${encodeURIComponent(CAL_ID)}/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({ start: { dateTime: startIso, timeZone: "Asia/Riyadh" }, end: { dateTime: endIso, timeZone: "Asia/Riyadh" } }),
  });
  return true;
}

export async function cancelEvent(id) {
  if (!id) return false;
  if (gcalTestMode()) {
    const ev = testEvents.find((e) => e.id === id);
    if (ev) ev.cancelled = true;
    await outbox({ kind: "calendar", to: ev ? ev.attendees.join(", ") : "", subject: "[calendar:cancel] " + id, body: "" });
    return true;
  }
  await api(`/calendars/${encodeURIComponent(CAL_ID)}/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" });
  return true;
}
