// «الاتصال المرئي — استشارة مجانية»: ساعات الجلسات ١٥:٠٠–٢٢:٠٠ بتوقيت الرياض،
// المدعوّون (العميل والمالك) في حدث التقويم، رفض ما خارج الساعات، حماية الحجز.
//
// بلا شبكة ولا تقويم حقيقي: CALENDAR_MODE=test يجعل api/_gcal.js يسجّل الأحداث
// في الذاكرة (testEvents)، وEMAIL_MODE=preview يسجّل البريد في صندوق الصادر.
// القاعدة ملف JSON مؤقّت (LOCAL_DB). الوضع الحيّ للتقويم في book-calendar-live.test.mjs.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-book-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [{ id: "u-client", email: "client@example.com", phone: "0551234567", full_name: "عميل مسجّل", locale: "ar" }],
  organizations: [],
  user_sessions: [
    { id: "s-ok", user_id: "u-client", organization_id: null, token_hash: sha("sid-client"), revoked_at: null, expires_at: future },
  ],
  requests: [],
  audit_logs: [],
}));

// تُضبط قبل الاستيراد: الوحدات تقرأ البيئة وقت التحميل.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.APP_ENV = "development";
process.env.CALENDAR_MODE = "test";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
process.env.OTP_SECRET = "test-otp-secret";
process.env.BOOKING_EMAIL = "team@example.com";
process.env.BOOKING_OWNER_EMAIL = "owner@example.com";
for (const k of ["BOOKING_START", "BOOKING_END", "BOOKING_SLOT_MIN", "BOOKING_DAYS", "BOOKING_LEAD_MIN", "BOOKING_OFF_DAYS",
  "GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "GOOGLE_CALENDAR_ID", "RESEND_API_KEY", "LEAD_WEBHOOK_URL"]) delete process.env[k];

import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../api/_booking.js");
const G = await import("../api/_gcal.js");
const { sb } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");

let ipN = 0;
const freshIp = () => `10.1.${Math.floor(++ipN / 200)}.${ipN % 200}`;

async function call(method, { body, url = "/api/book", headers = {}, ip } = {}) {
  const { default: handler } = await import("../api/book.js");
  let out = "";
  const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handler({ method, body, url, headers: { "x-forwarded-for": ip || freshIp(), ...headers } }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}
const post = (body, opts = {}) => call("POST", { body, ...opts });
const get = (url, opts = {}) => call("GET", { url, ...opts });

// أول يومٍ عمل بعد n يوماً (يتخطّى يوم العطلة) بتاريخ الرياض.
function workDay(n) {
  let d = B.riyadhToday(Date.now() + n * 86400000), i = 0;
  while (B.isOffDay(d) && i++ < 10) d = B.riyadhToday(new Date(`${d}T12:00:00+03:00`).getTime() + 86400000);
  return d;
}
const person = (n, extra = {}) => ({
  name: "عميل تجريبي " + n, phone: `05${String(60000000 + n * 137).slice(0, 8)}`, email: `guest${n}@example.org`,
  topic: "تأسيس شركة", notes: "", lang: "ar", ...extra,
});
const mails = async () => (await outboxList(200)).filter((m) => m.kind === "email");
const mailTo = async (to, subjPart) => (await mails()).find((m) => m.to === to && String(m.subject).includes(subjPart));

// ───────────────────────────── ١) الساعات الافتراضية ─────────────────────────────

test("الساعات الافتراضية ١٥:٠٠–٢٢:٠٠: أول جلسة ١٥:٠٠ وآخر جلسة ٢١:٣٠ (تنتهي ٢٢:٠٠)، نصف ساعة", () => {
  const c = B.bookingConfig();
  assert.equal(B.hhmm(c.fromMin), "15:00");
  assert.equal(B.hhmm(c.toMin), "22:00");
  assert.equal(c.slotMin, 30);
  const s = B.slotsOfDay();
  assert.equal(s[0], "15:00");
  assert.equal(s[s.length - 1], "21:30");
  assert.equal(s.length, 14);
  assert.ok(!s.includes("22:00") && !s.includes("14:30") && !s.includes("10:00"));
  assert.deepEqual(c.offDays, [5], "الجمعة وحدها عطلة — كما كان الكود القائم يحجب");
  assert.equal(c.leadMin, 60, "لا حجز بأقل من ساعة");
});

test("المتغيّرات تتجاوز الافتراضي: BOOKING_START/END/SLOT_MIN/OFF_DAYS (ساعة وساعة ونصف)", () => {
  const keep = { ...process.env };
  try {
    process.env.BOOKING_START = "16"; process.env.BOOKING_END = "20:00"; process.env.BOOKING_SLOT_MIN = "60"; process.env.BOOKING_OFF_DAYS = "5,6";
    assert.deepEqual(B.slotsOfDay(), ["16:00", "17:00", "18:00", "19:00"]);
    assert.deepEqual(B.bookingConfig().offDays, [5, 6]);
    process.env.BOOKING_START = "15:30"; process.env.BOOKING_END = "17"; process.env.BOOKING_SLOT_MIN = "45";
    assert.deepEqual(B.slotsOfDay(), ["15:30", "16:15"]);
    process.env.BOOKING_START = "قيمة فاسدة"; delete process.env.BOOKING_END; delete process.env.BOOKING_SLOT_MIN;
    assert.equal(B.slotsOfDay()[0], "15:00", "قيمة فاسدة ترجع إلى الافتراضي لا إلى NaN");
  } finally {
    for (const k of ["BOOKING_START", "BOOKING_END", "BOOKING_SLOT_MIN", "BOOKING_OFF_DAYS"]) delete process.env[k];
    Object.assign(process.env, { BOOKING_EMAIL: keep.BOOKING_EMAIL });
  }
  assert.equal(B.slotsOfDay().length, 14);
});

// ───────────────────────────── ٢) فحص الموعد في الخادم ─────────────────────────────

test("validateSlot: يقبل ضمن الساعات ويرفض خارجها والجمعة والماضي وما دون ساعة وما بعد المدى", () => {
  assert.equal(B.dayOfWeek("2026-10-23"), 5, "٢٣ أكتوبر ٢٠٢٦ جمعة");
  const now = Date.parse("2026-10-18T10:00:00+03:00");
  const err = (d, t, n = now) => { const v = B.validateSlot(d, t, n); return v.ok ? "ok" : v.error; };
  assert.equal(err("2026-10-19", "15:00"), "ok");
  assert.equal(err("2026-10-19", "21:30"), "ok");
  for (const t of ["10:00", "14:30", "22:00", "21:45", "15:10", "00:00"]) assert.equal(err("2026-10-19", t), "out_of_hours", t);
  assert.equal(err("2026-10-23", "15:00"), "off_day");
  assert.equal(err("2026-02-31", "15:00"), "bad_datetime");
  assert.equal(err("2026-10-19", "3pm"), "bad_datetime");
  assert.equal(err("", ""), "bad_datetime");
  const evening = Date.parse("2026-10-18T20:00:00+03:00");
  assert.equal(err("2026-10-18", "16:00", evening), "past");
  const soon = Date.parse("2026-10-18T15:20:00+03:00");
  assert.equal(err("2026-10-18", "15:30", soon), "too_soon");
  assert.equal(err("2026-10-18", "16:00", soon), "too_soon", "٤٠ دقيقة");
  assert.equal(err("2026-10-18", "16:30", soon), "ok", "٧٠ دقيقة");
  assert.equal(err("2027-03-01", "15:00"), "too_far");
});

// ───────────────────────────── ٣) ما تعرضه الصفحة: ?action=slots ─────────────────────────────

test("?action=slots: كل الفترات ضمن ١٥:٠٠–٢١:٣٠، بلا جمعة، والساعات الفعلية في الرد", async () => {
  const r = await get("/api/book?action=slots");
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.hours, { from: "15:00", to: "22:00", lastStart: "21:30" });
  assert.equal(r.json.slotMinutes, 30);
  assert.equal(r.json.tz, "Asia/Riyadh");
  assert.deepEqual(r.json.offDays, [5]);
  assert.equal(r.json.calendar, "test");
  assert.ok(r.json.days.length >= 10, "أيام كثيرة متاحة");
  const all = new Set();
  for (const d of r.json.days) {
    assert.notEqual(B.dayOfWeek(d.date), 5, d.date + " ليس جمعة");
    for (const t of d.slots) { all.add(t); assert.ok(t >= "15:00" && t <= "21:30", t); }
  }
  assert.ok(all.has("15:00") && all.has("21:30"));
  assert.ok(![...all].some((t) => t < "15:00" || t >= "22:00"));
});

// ───────────────────────────── ٤) الحجز: التقويم والمدعوّون ─────────────────────────────

test("حجزٌ ناجح: حدث Meet في التقويم، والعميل والمالك مدعوّان، وsendUpdates=all", async () => {
  const date = workDay(3);
  const p = person(1);
  const r = await post({ ...p, date, time: "15:00" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.equal(r.json.confirmed, true);
  assert.match(r.json.ref, /^BC-\d{6}$/);
  assert.match(r.json.meet, /^https:\/\/meet\.google\.com\//);
  assert.equal(r.json.invited, true);
  assert.deepEqual(r.json.when, { date, time: "15:00", tz: "Asia/Riyadh", minutes: 30 });

  const ev = G.testEvents.find((e) => e.id === r.json.eventId);
  assert.ok(ev, "الحدث وُضع في التقويم");
  assert.ok(ev.attendees.includes(p.email), "العميل مدعوّ");
  assert.ok(ev.attendees.includes("owner@example.com"), "المالك مدعوّ");
  // بريد الفريق هنا هو صاحب التقويم نفسه (CAL_ID ← BOOKING_EMAIL): منظِّم الحدث لا مدعوّ إليه.
  assert.ok(!ev.attendees.includes("team@example.com"), "صاحب التقويم لا يُدعى إلى حدث تقويمه");
  assert.equal(new Set(ev.attendees).size, ev.attendees.length, "بلا تكرار");
  assert.equal(ev.sendUpdates, "all", "الدعوات تُرسَل من جوجل");
  assert.equal(ev.startIso, `${date}T15:00:00+03:00`, "الوقت بالرياض صراحةً");
  assert.equal(new Date(ev.endIso) - new Date(ev.startIso), 30 * 60000);
  assert.equal(ev.meet, r.json.meet);

  const [row] = await sb(`requests?ref=eq.${r.json.ref}&select=*`);
  assert.equal(row.type, "CONSULTATION");
  assert.equal(row.client_email, p.email);
  assert.equal(row.appointment.status, "BOOKED");
  assert.equal(row.appointment.meet, r.json.meet);
  assert.equal(row.appointment.tz, "Asia/Riyadh");
});

test("بريد التأكيد بالعربية: الاتصال المرئي، الرابط، زرّ التقويم، تغيير/إلغاء، توقيت الرياض", async () => {
  const date = workDay(4);
  const p = person(2);
  const r = await post({ ...p, date, time: "16:30" });
  assert.equal(r.json.confirmed, true);
  const m = await mailTo(p.email, r.json.ref);
  assert.ok(m, "بريدٌ إلى العميل في صندوق الصادر");
  assert.match(m.subject, /الاتصال المرئي/);
  assert.match(m.body, /الاتصال المرئي — استشارة مجانية/);
  assert.ok(m.body.includes(r.json.meet), "رابط الاجتماع");
  assert.match(m.body, /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/, "زرّ أضف إلى التقويم");
  assert.match(m.body, /أضِف إلى تقويم Google/);
  assert.match(m.body, /بتوقيت الرياض/);
  assert.match(m.body, /GMT\+3/);
  assert.match(m.body, /4:30 م/, "الساعة بالنظام ١٢ إلى جانب ١٦:٣٠");
  assert.match(m.body, /consultation\?manage=BC-\d{6}&amp;t=|consultation\?manage=BC-\d{6}&t=/, "رابط تغيير الموعد");
  assert.match(m.body, /do=cancel/, "رابط الإلغاء");
  assert.match(m.body, /تغيير الموعد/);
  assert.match(m.body, /إلغاء الموعد/);
  assert.ok(!/لم يُؤكَّد/.test(m.body), "الموعد مؤكَّد فلا يُقال العكس");
  // إشعار الفريق
  const t = await mailTo("team@example.com", r.json.ref);
  assert.ok(t, "إشعار الفريق");
  assert.match(t.body, /دُعي العميل والمالك/);
});

test("بريد التأكيد بالإنجليزية: Riyadh time وروابط الإدارة والـMeet", async () => {
  const date = workDay(4);
  const p = person(3, { lang: "en", name: "Sara Test", topic: "Company formation" });
  const r = await post({ ...p, date, time: "18:00" });
  assert.equal(r.json.confirmed, true);
  const m = await mailTo(p.email, r.json.ref);
  assert.ok(m);
  assert.match(m.subject, /Your free video consultation is confirmed/);
  assert.match(m.body, /Video call — free consultation/);
  assert.match(m.body, /Riyadh time, GMT\+3/);
  assert.match(m.body, /6:00 PM/);
  assert.ok(m.body.includes(r.json.meet));
  assert.match(m.body, /Add to Google Calendar/);
  assert.match(m.body, /Change time/);
  assert.match(m.body, /Cancel session/);
  assert.match(m.body, /five minutes before/);
  assert.ok(!/[؀-ۿ]/.test(m.body), "لا عربية في بريد إنجليزي");
});

// ───────────────────────────── ٥) الرفض: خارج الساعات والماضي ─────────────────────────────

test("الخادم يرفض الحجز خارج ١٥:٠٠–٢٢:٠٠ برسالة عربية وإنجليزية، ولا ينشئ حدثاً", async () => {
  const before = G.testEvents.length;
  const date = workDay(5);
  for (const time of ["10:00", "14:30", "22:00", "15:10", "23:30"]) {
    const r = await post({ ...person(10), date, time });
    assert.equal(r.status, 400, time);
    assert.equal(r.json.error, "out_of_hours", time);
    assert.match(r.json.message, /خارج ساعات الجلسات/);
  }
  const en = await post({ ...person(10, { lang: "en" }), date, time: "09:00" });
  assert.equal(en.json.error, "out_of_hours");
  assert.match(en.json.message, /outside session hours/);
  assert.equal(G.testEvents.length, before, "لا حدث لموعدٍ مرفوض");
});

test("الخادم يرفض الجمعة والماضي وما دون ساعة وتاريخاً غير حقيقي", async () => {
  let fri = B.riyadhToday(Date.now() + 2 * 86400000);
  while (B.dayOfWeek(fri) !== 5) fri = B.riyadhToday(new Date(`${fri}T12:00:00+03:00`).getTime() + 86400000);
  const f = await post({ ...person(11), date: fri, time: "16:00" });
  assert.equal(f.json.error, "off_day"); assert.equal(f.status, 400);

  let past = B.riyadhToday(Date.now() - 2 * 86400000);
  while (B.isOffDay(past)) past = B.riyadhToday(new Date(`${past}T12:00:00+03:00`).getTime() - 86400000);
  const pr = await post({ ...person(11), date: past, time: "16:00" });
  assert.equal(pr.json.error, "past");
  assert.match(pr.json.message, /مضى/);

  const bad = await post({ ...person(11), date: "2026-02-31", time: "16:00" });
  assert.equal(bad.json.error, "bad_datetime");

  // أقل من ساعة: نقيس بالاستدعاء المباشر لأن «الآن» الحقيقي لا يُضبط
  const now = Date.now();
  const nextSlot = B.slotsOfDay().map((t) => ({ t, v: B.validateSlot(B.riyadhToday(now), t, now) })).find((x) => x.v.error === "too_soon");
  if (nextSlot) { // داخل ساعات الجلسات الآن فعلاً
    const soon = await post({ ...person(11), date: B.riyadhToday(now), time: nextSlot.t });
    assert.equal(soon.json.error, "too_soon");
    assert.match(soon.json.message, /ساعة/);
  }
});

test("حقول ناقصة: بلا اسم أو بريد صالح أو جوال لضيف ← invalid_fields", async () => {
  const date = workDay(5);
  for (const bad of [{ name: "" }, { email: "ليس-بريداً" }, { phone: "12" }]) {
    const r = await post({ ...person(12), ...bad, date, time: "17:00" });
    assert.equal(r.status, 400); assert.equal(r.json.error, "invalid_fields");
  }
});

// ───────────────────────────── ٦) الحماية ─────────────────────────────

test("لا حجزان في الفترة نفسها (slot_taken)، والفترة المحجوزة تختفي من المعروض", async () => {
  const date = workDay(6);
  const a = await post({ ...person(20), date, time: "19:00" });
  assert.equal(a.json.confirmed, true);
  const b = await post({ ...person(21), date, time: "19:00" });
  assert.equal(b.status, 409);
  assert.equal(b.json.error, "slot_taken");
  assert.match(b.json.message, /حُجزت هذه الفترة/);
  const s = await get("/api/book?action=slots");
  const day = s.json.days.find((d) => d.date === date);
  assert.ok(!day || !day.slots.includes("19:00"), "19:00 لم تعد معروضة");
  // نصف الساعة المجاورة غير محجوبة
  assert.ok(day && day.slots.includes("19:30"));
});

test("سقف المواعيد القادمة لكل بريد (اثنان) ثم حدّ الإكثار", async () => {
  const p = person(30);
  const d = workDay(7);
  const ok1 = await post({ ...p, date: d, time: "15:00" });
  const ok2 = await post({ ...p, date: d, time: "15:30" });
  assert.equal(ok1.json.confirmed && ok2.json.confirmed, true);
  const third = await post({ ...p, date: d, time: "16:00" });
  assert.equal(third.status, 409);
  assert.equal(third.json.error, "too_many_active");
  const fourth = await post({ ...p, date: d, time: "16:30" });
  assert.equal(fourth.status, 429);
  assert.equal(fourth.json.error, "rate_limited");
});

test("حدّ الإكثار لكل مصدر (IP): بعد ست محاولات في الساعة تُرفض السابعة", async () => {
  const ip = "203.0.113.77";
  const d = workDay(14);
  for (let i = 0; i < 6; i++) {
    const r = await post({ ...person(40 + i), date: d, time: B.slotsOfDay()[i] }, { ip });
    assert.equal(r.status, 200, "محاولة " + i + ": " + JSON.stringify(r.json));
  }
  const r7 = await post({ ...person(49), date: d, time: "21:30" }, { ip });
  assert.equal(r7.status, 429);
  assert.equal(r7.json.error, "rate_limited");
});

test("ضيفٌ لا يحجز ببريد أو جوال حسابٍ مسجّل؛ والمسجّل لا يحجز ببريد غيره", async () => {
  const date = workDay(9);
  const byMail = await post({ ...person(50), email: "client@example.com", date, time: "15:00" });
  assert.equal(byMail.status, 403); assert.equal(byMail.json.error, "signin_required");
  assert.match(byMail.json.message, /سجّل دخولك/);
  assert.ok(byMail.json.signin.endsWith("/my"));

  const byPhone = await post({ ...person(51), phone: "+966551234567", date, time: "15:00" });
  assert.equal(byPhone.status, 403, "الجوال نفسه بصيغةٍ أخرى");
  assert.equal(byPhone.json.error, "signin_required");

  const mismatch = await post({ ...person(52), date, time: "15:00" }, { headers: { cookie: "bp_sid=sid-client" } });
  assert.equal(mismatch.status, 403); assert.equal(mismatch.json.error, "email_mismatch");

  const own = await post({ name: "عميل مسجّل", email: "client@example.com", date, time: "15:00", lang: "ar" }, { headers: { cookie: "bp_sid=sid-client" } });
  assert.equal(own.status, 200, JSON.stringify(own.json));
  assert.equal(own.json.confirmed, true, "صاحب الحساب يحجز ببريده بلا جوال");
  const ev = G.testEvents.find((e) => e.id === own.json.eventId);
  assert.ok(ev.attendees.includes("client@example.com") && ev.attendees.includes("owner@example.com"));
});

// ───────────────────────────── ٧) تغيير الموعد وإلغاؤه ─────────────────────────────

test("رابط الإدارة: توقيعٌ خاطئ يُرفض، والصحيح يُلغي الحدث ويحرّر الفترة ويُعلم الفريق", async () => {
  const date = workDay(10);
  const p = person(60);
  const r = await post({ ...p, date, time: "20:00" });
  const ref = r.json.ref;
  const t = B.manageToken(ref, p.email);
  assert.ok(t && t.length === 32);
  assert.ok(r.json.manageUrl.includes(`manage=${ref}`) && r.json.manageUrl.includes(encodeURIComponent(t)));

  const bad = await get(`/api/book?action=manage&ref=${ref}&t=${"x".repeat(32)}`);
  assert.equal(bad.status, 404);
  const view = await get(`/api/book?action=manage&ref=${ref}&t=${t}`);
  assert.equal(view.status, 200);
  assert.equal(view.json.when.time, "20:00");
  assert.equal(view.json.canChange, true);
  assert.equal(view.json.meet, r.json.meet);

  const noTok = await post({ action: "cancel", ref, t: "nope" });
  assert.equal(noTok.status, 404);
  const other = await post({ action: "cancel", ref, t: B.manageToken(ref, "other@example.com") });
  assert.equal(other.status, 404, "توقيعُ بريدٍ آخر لا يصلح");

  const c = await post({ action: "cancel", ref, t });
  assert.equal(c.status, 200); assert.equal(c.json.status, "CANCELLED");
  const ev = G.testEvents.find((e) => e.id === r.json.eventId);
  assert.equal(ev.cancelled, true, "الحدث أُلغي في التقويم");
  const [row] = await sb(`requests?ref=eq.${ref}&select=status,appointment`);
  assert.equal(row.status, "CANCELLED");
  const s = await get("/api/book?action=slots");
  const day = s.json.days.find((d) => d.date === date);
  assert.ok(day && day.slots.includes("20:00"), "الفترة عادت متاحة");
  assert.ok(await mailTo("team@example.com", "إلغاء موعد"), "الفريق عُلم");
  const again = await post({ action: "cancel", ref, t });
  assert.equal(again.json.already, true, "الإلغاء مكرّراً لا يفشل");
});

test("تغيير الموعد: الحدث يتحرّك، والفترة القديمة تتحرّر، ولا نقل إلى وقتٍ خارج الساعات أو محجوز", async () => {
  const date = workDay(11);
  const p = person(70);
  const r = await post({ ...p, date, time: "15:00" });
  const ref = r.json.ref, t = B.manageToken(ref, p.email);

  const out = await post({ action: "reschedule", ref, t, date, time: "11:00" });
  assert.equal(out.json.error, "out_of_hours");
  const same = await post({ action: "reschedule", ref, t, date, time: "15:00" });
  assert.equal(same.json.error, "same_slot");
  const taken = await post({ ...person(71), date, time: "17:00" });
  assert.equal(taken.json.confirmed, true);
  const clash = await post({ action: "reschedule", ref, t, date, time: "17:00" });
  assert.equal(clash.status, 409); assert.equal(clash.json.error, "slot_taken");

  const mv = await post({ action: "reschedule", ref, t, date, time: "18:30" });
  assert.equal(mv.status, 200, JSON.stringify(mv.json));
  assert.deepEqual(mv.json.when, { date, time: "18:30", tz: "Asia/Riyadh", minutes: 30 });
  const ev = G.testEvents.find((e) => e.id === r.json.eventId);
  assert.equal(ev.startIso, `${date}T18:30:00+03:00`);
  const m = await mailTo(p.email, "تم تغيير موعدك");
  assert.ok(m && m.body.includes("6:30 م"));
});
