// تقويمٌ غير مضبوط (الإنتاج قبل ربط حساب الخدمة): رسالةٌ صادقة لا حجزٌ وهمي.
// لا «تم تأكيد موعدك»، لا رابط Meet، والطلب يُسجَّل بانتظار تثبيت الفريق،
// والصفحة تعرف ذلك من calendar=off. ولا نداء إلى الشبكة إطلاقاً.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-book-off-"));
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({ users: [], organizations: [], user_sessions: [], requests: [], audit_logs: [] }));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.APP_ENV = "development";
process.env.CALENDAR_MODE = "live";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
process.env.OTP_SECRET = "test-otp-secret";
process.env.BOOKING_EMAIL = "team@example.com";
process.env.BOOKING_OWNER_EMAIL = "owner@example.com";
for (const k of ["GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "GOOGLE_CALENDAR_ID", "GOOGLE_SA_IMPERSONATE", "BOOKING_START", "BOOKING_END",
  "BOOKING_SLOT_MIN", "BOOKING_DAYS", "BOOKING_LEAD_MIN", "BOOKING_OFF_DAYS", "RESEND_API_KEY", "LEAD_WEBHOOK_URL"]) delete process.env[k];

import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../api/_booking.js");
const { sb } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");

const realFetch = globalThis.fetch;
const netCalls = [];
globalThis.fetch = async (url) => { netCalls.push(String(url)); throw new Error("لا شبكة في هذا الاختبار: " + url); };
test.after(() => { globalThis.fetch = realFetch; });

let ipN = 0;
async function call(method, { body, url = "/api/book" } = {}) {
  const { default: handler } = await import("../api/book.js");
  let out = "";
  const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handler({ method, body, url, headers: { "x-forwarded-for": `10.8.0.${++ipN}` } }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}
function workDay(n) {
  let d = B.riyadhToday(Date.now() + n * 86400000), i = 0;
  while (B.isOffDay(d) && i++ < 10) d = B.riyadhToday(new Date(`${d}T12:00:00+03:00`).getTime() + 86400000);
  return d;
}

test("التقويم غير مضبوط: ?action=slots يقول off (فتعرض الصفحة «الفريق يؤكّد»)", async () => {
  const s = await call("GET", { url: "/api/book?action=slots" });
  assert.equal(s.json.calendar, "off");
  assert.equal(s.json.invites, false);
  assert.ok(s.json.days.length > 5, "الفترات تُعرض والطلب يُسجَّل");
  const h = await call("GET", { url: "/api/book" });
  assert.equal(h.json.calendar, "off");
});

test("حجزٌ والتقويم غير مضبوط: ok لكن confirmed=false بلا Meet، والبريد صادقٌ بلغتين", async () => {
  const date = workDay(3);
  const ar = await call("POST", { body: { name: "عميل", phone: "0561234500", email: "off1@example.org", topic: "ترخيص", date, time: "15:00", lang: "ar" } });
  assert.equal(ar.status, 200, JSON.stringify(ar.json));
  assert.equal(ar.json.ok, true);
  assert.equal(ar.json.confirmed, false);
  assert.equal(ar.json.calendar, "off");
  assert.equal(ar.json.meet, "");
  assert.equal(ar.json.eventId, "");
  const [row] = await sb(`requests?ref=eq.${ar.json.ref}&select=appointment`);
  assert.equal(row.appointment.status, "PENDING", "لا BOOKED بلا حدثٍ في التقويم");

  const mails = (await outboxList(100)).filter((m) => m.kind === "email");
  const c = mails.find((m) => m.to === "off1@example.org");
  assert.match(c.subject, /استلمنا طلب موعدك/);
  assert.match(c.body, /استلمنا طلب موعدك/);
  assert.match(c.body, /لم يُؤكَّد الموعد بعد/);
  assert.ok(!/تم تأكيد موعدك/.test(c.body));
  assert.ok(!/meet\.google/.test(c.body), "لا رابط اجتماعٍ لا نملكه");
  const t = mails.find((m) => m.to === "team@example.com");
  assert.match(t.body, /لم يُنشأ حدثٌ في التقويم/);
  const o = mails.find((m) => m.to === "owner@example.com");
  assert.ok(o, "المالك يُخبَر بالبريد حين لا دعوة تقويم تصله");

  const en = await call("POST", { body: { name: "Client", phone: "0561234501", email: "off2@example.org", topic: "Licence", date, time: "15:30", lang: "en" } });
  assert.equal(en.json.confirmed, false);
  const ce = (await outboxList(100)).find((m) => m.kind === "email" && m.to === "off2@example.org");
  assert.match(ce.subject, /We received your appointment request/);
  assert.match(ce.body, /not confirmed yet/);
  assert.ok(!/is confirmed|is booked/.test(ce.body));
});

test("بلا تقويم: الفترة المحجوزة تبقى محجوزةً عندنا (لا حجزان)", async () => {
  const date = workDay(3);
  const dup = await call("POST", { body: { name: "آخر", phone: "0561234502", email: "off3@example.org", date, time: "15:00", lang: "ar" } });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error, "slot_taken");
});

test("لم يخرج أي نداءٍ إلى الشبكة (لا جوجل ولا Resend ولا n8n ولا Notion)", () => {
  assert.deepEqual(netCalls, []);
});
