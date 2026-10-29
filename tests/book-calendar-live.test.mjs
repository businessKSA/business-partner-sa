// التقويم الحيّ (CALENDAR_MODE=live) بطلبات جوجل مُقلَّدة على مستوى fetch:
//  • الدعوة تحمل العميل والمالك وsendUpdates=all؛
//  • حساب خدمة بلا تفويض نطاق ترفضه جوجل ← الحدث يُنشأ بلا مدعوّين ويُقال ذلك؛
//  • تعذّر التقويم كلّه ← «طلب بانتظار التأكيد» لا «تم التأكيد»، ولا رابط اجتماعٍ وهمي؛
//  • GOOGLE_SA_IMPERSONATE يدخل في توقيع الرمز (sub).
// أيّ نداء خارج googleapis يُفشل الاختبار: لا شبكة حقيقية.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-book-live-"));
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({ users: [], organizations: [], user_sessions: [], requests: [], audit_logs: [] }));
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.APP_ENV = "development";            // يفعّل صندوق الصادر؛ والتقويم يُرغَم حيّاً أدناه
process.env.CALENDAR_MODE = "live";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
process.env.OTP_SECRET = "test-otp-secret";
process.env.BOOKING_EMAIL = "team@example.com";
process.env.BOOKING_OWNER_EMAIL = "owner@example.com";
process.env.GOOGLE_SA_EMAIL = "bp-sa@proj.iam.gserviceaccount.com";
process.env.GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
process.env.GOOGLE_CALENDAR_ID = "company-cal@example.com";
delete process.env.GOOGLE_SA_IMPERSONATE;
for (const k of ["BOOKING_START", "BOOKING_END", "BOOKING_SLOT_MIN", "BOOKING_DAYS", "BOOKING_LEAD_MIN", "BOOKING_OFF_DAYS", "RESEND_API_KEY", "LEAD_WEBHOOK_URL"]) delete process.env[k];

import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../api/_booking.js");
const { sb } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");

// ‏«الآن» الحقيقي: التقويم الحيّ لا يُحاكى في _gcal، فنقلّد fetch.
const realFetch = globalThis.fetch;
let google = { events: [], busy: [], eventsMode: "ok", busyMode: "ok", tokens: [] };
const reset = (over = {}) => { google = { events: [], busy: [], eventsMode: "ok", busyMode: "ok", tokens: [], ...over }; };
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const body = opts.body ? (typeof opts.body === "string" ? opts.body : String(opts.body)) : "";
  if (u === "https://oauth2.googleapis.com/token") {
    google.tokens.push(new URLSearchParams(body).get("assertion"));
    return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
  }
  if (u.endsWith("/freeBusy")) {
    if (google.busyMode === "fail") return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ calendars: { "company-cal@example.com": { busy: google.busy } } }), { status: 200 });
  }
  if (u.includes("googleapis.com/calendar/v3/calendars/") && u.includes("/events")) {
    const parsed = body ? JSON.parse(body) : {};
    google.events.push({ url: u, method: opts.method || "GET", body: parsed });
    if (google.eventsMode === "fail") return new Response("server error", { status: 500 });
    if (parsed.attendees && google.eventsMode === "forbid-guests") {
      return new Response(JSON.stringify({ error: { message: "Service accounts cannot invite attendees without Domain-Wide Delegation of Authority.", errors: [{ reason: "forbiddenForServiceAccounts" }] } }), { status: 403 });
    }
    return new Response(JSON.stringify({ id: "evt_" + google.events.length, htmlLink: "https://calendar.google.com/x", hangoutLink: "https://meet.google.com/abc-defg-hij" }), { status: 200 });
  }
  throw new Error("نداءٌ غير متوقَّع إلى الشبكة: " + u);
};
test.after(() => { globalThis.fetch = realFetch; });

let ipN = 0;
async function call(method, { body, url = "/api/book" } = {}) {
  const { default: handler } = await import("../api/book.js");
  let out = "";
  const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handler({ method, body, url, headers: { "x-forwarded-for": `10.9.0.${++ipN}` } }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}
function workDay(n) {
  let d = B.riyadhToday(Date.now() + n * 86400000), i = 0;
  while (B.isOffDay(d) && i++ < 10) d = B.riyadhToday(new Date(`${d}T12:00:00+03:00`).getTime() + 86400000);
  return d;
}
const guest = (n, extra = {}) => ({ name: "Guest " + n, phone: `05${70000000 + n * 211}`, email: `live${n}@example.org`, topic: "Company formation", lang: "en", ...extra });
const mailTo = async (to) => (await outboxList(200)).find((m) => m.kind === "email" && m.to === to);

test("التقويم حيّ: الحالة linked، وحساب الخدمة بلا تفويض ← الحدث بلا مدعوّين والرد يقول ذلك", async () => {
  reset({ eventsMode: "forbid-guests" });
  const date = workDay(3), p = guest(1);
  const r = await call("POST", { body: { ...p, date, time: "15:00" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.calendar, "linked");
  assert.equal(r.json.confirmed, true, "الحدث أُنشئ بـMeet");
  assert.equal(r.json.invited, false, "لم تُرسَل دعوات: جوجل رفضت");
  assert.equal(r.json.meet, "https://meet.google.com/abc-defg-hij");

  // أول محاولة: بالمدعوّين (العميل والمالك) وبإرسال التحديثات
  const first = google.events[0];
  assert.equal(first.method, "POST");
  assert.ok(first.url.includes("sendUpdates=all"), first.url);
  assert.ok(first.url.includes("conferenceDataVersion=1"), "طلب Meet");
  const emails = first.body.attendees.map((a) => a.email);
  assert.ok(emails.includes(p.email), "العميل مدعوّ");
  assert.ok(emails.includes("owner@example.com"), "المالك مدعوّ");
  assert.equal(first.body.start.timeZone, "Asia/Riyadh");
  assert.equal(first.body.start.dateTime, `${date}T15:00:00+03:00`);
  assert.equal(first.body.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
  assert.equal(first.body.guestsCanInviteOthers, false);
  // الثانية: بلا مدعوّين
  const second = google.events[1];
  assert.equal(second.body.attendees, undefined);
  assert.ok(second.url.includes("sendUpdates=none"));

  const team = await mailTo("team@example.com");
  assert.match(team.body, /بلا دعوات/, "الفريق يعلم أن الدعوات لم تصل ويعرف العلاج");
  assert.match(team.body, /GOOGLE_SA_IMPERSONATE/);
  const client = await mailTo(p.email);
  assert.match(client.body, /Add the session to your calendar/, "العميل يُدلّ على زرّ التقويم لا على دعوةٍ لم تصل");
  assert.ok(!/calendar invitation at this address/.test(client.body));
});

test("تقويمٌ حيّ ومدعوّون مقبولون: invited=true", async () => {
  reset();
  const r = await call("POST", { body: { ...guest(2), date: workDay(3), time: "16:00" } });
  assert.equal(r.json.confirmed, true);
  assert.equal(r.json.invited, true);
  assert.equal(google.events.length, 1);
});

test("تعذّر إنشاء الحدث (500): الطلب يُسجَّل «بانتظار التأكيد» ولا يُقال «تم» ولا يُعطى رابط", async () => {
  reset({ eventsMode: "fail" });
  const p = guest(3, { lang: "ar", topic: "تأسيس" });
  const date = workDay(4);
  const r = await call("POST", { body: { ...p, date, time: "17:00" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.calendar, "error");
  assert.equal(r.json.confirmed, false);
  assert.equal(r.json.meet, "");
  assert.equal(r.json.invited, false);
  const [row] = await sb(`requests?ref=eq.${r.json.ref}&select=appointment,status`);
  assert.equal(row.appointment.status, "PENDING");
  assert.equal(row.appointment.meet, "");
  const m = await mailTo(p.email);
  assert.match(m.subject, /استلمنا طلب موعدك/);
  assert.match(m.body, /لم يُؤكَّد الموعد بعد/);
  assert.ok(!/تم تأكيد موعدك/.test(m.body) && !/meet\.google/.test(m.body));
  const team = await mailTo("team@example.com");
  assert.match(team.body, /لم يُنشأ حدثٌ في التقويم/);
  // الفترة تبقى محجوزة عندنا حتى لا يأخذها غيره
  const dup = await call("POST", { body: { ...guest(4), date, time: "17:00" } });
  assert.equal(dup.json.error, "slot_taken");
});

test("فترة مشغولة في تقويم الشركة: تُحجب من المعروض وتُرفض عند الحجز (slot_taken)", async () => {
  const date = workDay(5);
  reset({ busy: [{ start: `${date}T15:00:00+03:00`, end: `${date}T15:30:00+03:00` }] });
  const s = await call("GET", { url: "/api/book?action=slots" });
  assert.equal(s.json.calendar, "linked");
  const day = s.json.days.find((d) => d.date === date);
  assert.ok(day && !day.slots.includes("15:00") && day.slots.includes("15:30"));
  const r = await call("POST", { body: { ...guest(5), date, time: "15:00" } });
  assert.equal(r.status, 409); assert.equal(r.json.error, "slot_taken");
  assert.equal(google.events.length, 0, "لا حدث على فترةٍ مشغولة");
});

test("الساعات الافتراضية ١٣:٠٠–٢١:٠٠ (قرار المالك 2026-10-29): أول فترة ١٣:٠٠ وآخر ٢٠:٣٠، لا ١٢:٣٠ ولا ٢١:٠٠، والجمعة عطلة، وحدث التقويم بالتوقيت الصحيح", async () => {
  reset();
  const s = await call("GET", { url: "/api/book?action=slots" });
  assert.deepEqual(s.json.hours, { from: "13:00", to: "21:00", lastStart: "20:30" });
  assert.deepEqual(s.json.offDays, [5]);
  for (const d of s.json.days) {
    assert.notEqual(B.dayOfWeek(d.date), 5, d.date + " ليس جمعة");
    assert.equal(d.slots[0], "13:00", d.date); assert.equal(d.slots.at(-1), "20:30", d.date);
    assert.ok(!d.slots.includes("12:30") && !d.slots.includes("21:00"), d.date);
  }
  const date = workDay(8);
  for (const time of ["12:30", "21:00"]) {
    const r = await call("POST", { body: { ...guest(20), date, time } });
    assert.equal(r.status, 400, time); assert.equal(r.json.error, "out_of_hours", time);
  }
  let fri = B.riyadhToday(Date.now() + 2 * 86400000);
  while (B.dayOfWeek(fri) !== 5) fri = B.riyadhToday(new Date(`${fri}T12:00:00+03:00`).getTime() + 86400000);
  assert.equal((await call("POST", { body: { ...guest(20), date: fri, time: "13:00" } })).json.error, "off_day");
  assert.equal(google.events.length, 0, "لا حدث لموعدٍ مرفوض");
  const ok = await call("POST", { body: { ...guest(21), date, time: "20:30" } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(google.events.at(-1).body.start.dateTime, `${date}T20:30:00+03:00`);
  assert.equal(Date.parse(google.events.at(-1).body.end.dateTime), Date.parse(`${date}T21:00:00+03:00`), "تنتهي ٢١:٠٠ لا بعدها");
});

test("تعذّر قراءة التقويم: كل الفترات تُعرض ويُقال calendar=error", async () => {
  reset({ busyMode: "fail" });
  const s = await call("GET", { url: "/api/book?action=slots" });
  assert.equal(s.json.calendar, "error");
  assert.ok(s.json.days.length > 5);
});

test("GOOGLE_SA_IMPERSONATE يدخل في توقيع الرمز (sub) ليُسمح بالدعوات بتفويض النطاق", async () => {
  process.env.GOOGLE_SA_IMPERSONATE = "owner@company.example";
  reset();
  const G = await import("../api/_gcal.js?impersonate=1");
  assert.equal(G.gcalCanInvite(), true);
  await G.busy("2026-10-20T00:00:00+03:00", "2026-10-21T00:00:00+03:00");
  const claim = JSON.parse(Buffer.from(google.tokens[0].split(".")[1], "base64url").toString());
  assert.equal(claim.sub, "owner@company.example");
  assert.equal(claim.iss, "bp-sa@proj.iam.gserviceaccount.com");
  delete process.env.GOOGLE_SA_IMPERSONATE;
});
