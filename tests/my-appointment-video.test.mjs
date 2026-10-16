// «مواعيدي» في /my (api/_simple.js) على خدمة الحجز نفسها (api/book.js):
//  • الموعد يُفحص بقواعد الساعات نفسها (١٥:٠٠–٢٢:٠٠، بلا جمعة، بلا ماضٍ/أقل من ساعة)؛
//  • الحجز يضع حدثاً في التقويم (محاكى) ويُدعى إليه العميل والمالك، ويعود رابط Meet؛
//  • فشل الحجز لا يُسجَّل «موعداً» (كان الخطأ يُبتلع فيرى العميل «تم» بلا حدث)؛
//  • الإعادة والإلغاء يحرّكان الحدث ويلغيانه، والملخّص يحمل رابط الاجتماع.
// fetch المحلي يُوجَّه إلى معالج book.js في الذاكرة — لا شبكة.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-myappt-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
const row = (id, ref) => ({ id, ref, type: "CONSULTATION", source: "WEBSITE", status: "NEW", title: "استشارة تأسيس", lang: "ar",
  client_email: "client@example.com", client_name: "عميل مسجّل", client_phone: "0551234567", organization_id: null, conversation: [], created_at: new Date().toISOString() });
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [{ id: "u-client", email: "client@example.com", phone: "0551234567", full_name: "عميل مسجّل", locale: "ar" }],
  organizations: [],
  user_sessions: [{ id: "s-ok", user_id: "u-client", organization_id: null, token_hash: sha("sid-client"), revoked_at: null, expires_at: future }],
  requests: [row("r1", "BP-APPT1"), row("r2", "BP-APPT2")],
  request_events: [], audit_logs: [],
}));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.APP_ENV = "development";
process.env.CALENDAR_MODE = "test";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
process.env.SIMPLE_TEST_MODE = "1";
process.env.OTP_SECRET = "test-otp-secret";
process.env.MKT_SITE_BASE = "http://localhost:3999";
process.env.BOOKING_EMAIL = "team@example.com";
process.env.BOOKING_OWNER_EMAIL = "owner@example.com";
for (const k of ["BOOKING_START", "BOOKING_END", "BOOKING_SLOT_MIN", "BOOKING_DAYS", "BOOKING_LEAD_MIN", "BOOKING_OFF_DAYS", "GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "GOOGLE_CALENDAR_ID", "RESEND_API_KEY"]) delete process.env[k];

import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../api/_booking.js");
const G = await import("../api/_gcal.js");
const { sb } = await import("../api/_db.js");
const { handleSimple } = await import("../api/_simple.js");
const { default: bookHandler } = await import("../api/book.js");

// ‏/api/book داخل العملية: نداءات _simple.js إلى SELF_BASE تصل المعالج مباشرةً.
const realFetch = globalThis.fetch;
const bookCalls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u === "http://localhost:3999/api/book") {
    const body = JSON.parse(opts.body || "{}");
    bookCalls.push({ body, cookie: (opts.headers || {}).cookie || "" });
    let out = ""; const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
    await bookHandler({ method: "POST", body, url: "/api/book", headers: { cookie: (opts.headers || {}).cookie || "", "x-forwarded-for": "10.7.0." + (bookCalls.length % 200) } }, res);
    return new Response(out, { status: res.statusCode });
  }
  throw new Error("نداءٌ غير متوقَّع: " + u);
};
test.after(() => { globalThis.fetch = realFetch; });

async function act(action, body) {
  let out = ""; const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handleSimple({ method: "POST", body: { action, ...body }, headers: { cookie: "bp_sid=sid-client", "x-forwarded-for": "10.6.0.1" }, query: {}, url: "/api/simple" }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}
function workDay(n) {
  let d = B.riyadhToday(Date.now() + n * 86400000), i = 0;
  while (B.isOffDay(d) && i++ < 10) d = B.riyadhToday(new Date(`${d}T12:00:00+03:00`).getTime() + 86400000);
  return d;
}

test("حجز من «مواعيدي»: حدث Meet والعميل والمالك مدعوّان، والموعد يُحفظ برابط الاجتماع", async () => {
  const date = workDay(3);
  const r = await act("appointment-book", { ref: "BP-APPT1", date, time: "15:00", topic: "تأسيس شركة" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const a = r.json.appointment;
  assert.equal(a.status, "BOOKED");
  assert.match(a.meet, /^https:\/\/meet\.google\.com\//);
  assert.match(a.ref, /^BC-\d{6}$/);
  assert.equal(a.mode, "video");
  assert.notEqual(a.gcal, "linked", "كان يُحفظ اسم حالة التقويم مكان الرابط");
  const ev = G.testEvents.find((e) => e.id === a.gcal);
  assert.ok(ev, "الحدث في التقويم");
  assert.ok(ev.attendees.includes("client@example.com") && ev.attendees.includes("owner@example.com"));
  assert.equal(ev.startIso, `${date}T15:00:00+03:00`);
  assert.ok(bookCalls[0].cookie.includes("bp_sid=sid-client"), "الجلسة تُمرَّر فيعرف book.js صاحب الحساب");
  const [saved] = await sb("requests?ref=eq.BP-APPT1&select=appointment");
  assert.equal(saved.appointment.meet, a.meet);

  // الملخّص الذي تقرؤه الواجهة يحمل الرابط والمرجع (للموعد القادم وزرّ الانضمام)
  const me = await act("me", {});
  const mine = me.json.requests.find((x) => x.ref === "BP-APPT1");
  assert.equal(mine.appointment.meet, a.meet);
  assert.equal(mine.appointment.ref, a.ref);
  assert.equal(mine.appointment.status, "BOOKED");
  assert.equal(me.json.counts.appointments, 1, "صفّا الموعد (طلب العميل وصفّ الحجز) يُعدّان موعداً واحداً");
});

test("«مواعيدي» ترفض خارج الساعات والجمعة والماضي برمزٍ ورسالة، ولا تسجّل موعداً", async () => {
  const date = workDay(4);
  for (const [time, code] of [["10:00", "out_of_hours"], ["22:00", "out_of_hours"], ["14:30", "out_of_hours"]]) {
    const r = await act("appointment-book", { ref: "BP-APPT2", date, time });
    assert.equal(r.status, 400, time); assert.equal(r.json.error, code);
    assert.match(r.json.message, /خارج ساعات الجلسات/);
  }
  let fri = B.riyadhToday(Date.now() + 2 * 86400000);
  while (B.dayOfWeek(fri) !== 5) fri = B.riyadhToday(new Date(`${fri}T12:00:00+03:00`).getTime() + 86400000);
  assert.equal((await act("appointment-book", { ref: "BP-APPT2", date: fri, time: "16:00" })).json.error, "off_day");
  assert.equal((await act("appointment-book", { ref: "BP-APPT2", date: "2020-01-06", time: "16:00" })).json.error, "past");
  assert.equal((await act("appointment-book", { ref: "BP-APPT2", date: "غير", time: "x" })).json.error, "bad_datetime");
  const [saved] = await sb("requests?ref=eq.BP-APPT2&select=appointment");
  assert.ok(!saved.appointment, "لا موعد سُجِّل");
});

test("فترة محجوزة: الخادم يردّ slot_taken ولا يُسجَّل الموعد (لا «تم» وهمية)", async () => {
  const date = workDay(3);          // 15:00 محجوزة من الاختبار الأول
  const before = G.testEvents.length;
  const r = await act("appointment-book", { ref: "BP-APPT2", date, time: "15:00" });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, "slot_taken");
  const [saved] = await sb("requests?ref=eq.BP-APPT2&select=appointment");
  assert.ok(!saved.appointment);
  assert.equal(G.testEvents.length, before);
});

test("إعادة الجدولة تُحرّك الحدث نفسه، والإلغاء يُلغيه في التقويم", async () => {
  const date = workDay(3);
  const [cur] = await sb("requests?ref=eq.BP-APPT1&select=appointment");
  const evId = cur.appointment.gcal;
  const mv = await act("appointment-reschedule", { ref: "BP-APPT1", date, time: "19:30" });
  assert.equal(mv.status, 200, JSON.stringify(mv.json));
  assert.equal(mv.json.appointment.status, "RESCHEDULED");
  assert.equal(mv.json.appointment.time, "19:30");
  const ev = G.testEvents.find((e) => e.id === evId);
  assert.equal(ev.startIso, `${date}T19:30:00+03:00`, "الحدث نفسه تحرّك — لا حدثٌ ثانٍ يبقى القديم");
  assert.equal(G.testEvents.filter((e) => !e.cancelled && e.attendees.includes("client@example.com")).length, 1);
  assert.equal(bookCalls.at(-1).body.action, "reschedule");

  const bad = await act("appointment-reschedule", { ref: "BP-APPT1", date, time: "09:00" });
  assert.equal(bad.json.error, "out_of_hours");

  const c = await act("appointment-cancel", { ref: "BP-APPT1" });
  assert.equal(c.status, 200);
  assert.equal(c.json.appointment.status, "CANCELLED");
  assert.equal(c.json.calendar, "cancelled");
  assert.equal(ev.cancelled, true, "الحدث أُلغي في تقويم الشركة");
  const s = await act("me", {});
  assert.equal(s.json.counts.appointments, 0);
});
