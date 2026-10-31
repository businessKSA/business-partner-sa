// موعد الاستشارة من بوابة العميل /my (api/_simple.js: appointment-book / appointment-reschedule).
//
// كان الإجراءان يقبلان أي وقتٍ عدا الجمعة (الثالثة فجراً مثلاً)، فيُحفظ موعدٌ
// يرفضه /api/book بعدها والخطأ يُبتلع. الآن يمرّان بـvalidateSlot نفسه الذي
// يحرس /api/book: ١٣:٠٠–٢١:٠٠ بتوقيت الرياض عدا الجمعة، مهلة ساعة، مدى ٢١ يوماً.
// والواجهة: الوقت الافتراضي ضمن الساعات، وتُعرض رسالة الخادم لا رمز الخطأ.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "my-appt-hours-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "BOOKING_START", "BOOKING_END",
  "BOOKING_OFF_DAYS", "BOOKING_SLOT_MIN", "BOOKING_DAYS", "BOOKING_LEAD_MIN"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

// لا شبكة. نداءات /api/book تُسجَّل: موعدٌ مرفوض لا يجوز أن يصل إليه أصلاً.
const bookCalls = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("catalog.json")) return new Response(JSON.stringify({ services: [], packages: [], discounts: [] }), { status: 200 });
  if (u.endsWith("/api/book")) { bookCalls.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, ref: "BC-TEST" }), { status: 200 }); }
  throw new Error("a local run must not reach the network: " + u);
};

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-appt-aaaaaaaaaaaa" };
const future = new Date(Date.now() + 864e5).toISOString();
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: future, revoked_at: null }] });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: `bp_sid=${CLIENT.token}` }, socket: {}, query: {}, body: { action, ...body } }, res);
  return out;
}

// الأحد 2026-11-01 الساعة 09:00 بتوقيت الرياض. (الجمعة التالية 2026-11-06.)
const SUN_0900 = Date.parse("2026-11-01T06:00:00Z");
const realNow = Date.now;
const at = async (ms, fn) => { Date.now = () => ms; try { return await fn(); } finally { Date.now = realNow; } };

async function newConsultation(title) {
  const r = await call("request-create", { type: "CONSULTATION", title, phone: "0501234567", name: "عميل تجريبي" });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  return r.body.ref;
}
const stored = async (ref) => (await sb(`requests?ref=eq.${ref}&select=appointment`))[0].appointment;

test("الجمعة ← ٤٠٠ off_day برسالة عربية، ولا يُحفظ موعد ولا يُنادى /api/book", async () => {
  const ref = await newConsultation("استشارة الجمعة");
  bookCalls.length = 0;
  await at(SUN_0900, async () => {
    const r = await call("appointment-book", { ref, date: "2026-11-06", time: "14:00" });
    assert.equal(r.status, 400);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error, "off_day");
    assert.match(r.body.message, /[؀-ۿ]/);
  });
  assert.ok(!(await stored(ref)));
  assert.equal(bookCalls.length, 0);
});

test("خارج ١٣:٠٠–٢١:٠٠ ← out_of_hours (١٠:٠٠ كان مقبولاً)", async () => {
  const ref = await newConsultation("استشارة خارج الساعات");
  bookCalls.length = 0;
  await at(SUN_0900, async () => {
    for (const t of ["10:00", "12:30", "21:00", "03:00"]) {
      const r = await call("appointment-book", { ref, date: "2026-11-02", time: t });
      assert.equal(r.status, 400, t);
      assert.equal(r.body.error, "out_of_hours", t);
      assert.ok(r.body.message && !/^[a-z_]+$/.test(r.body.message), "الرسالة نصٌّ لا رمز: " + t);
    }
  });
  assert.ok(!(await stored(ref)));
  assert.equal(bookCalls.length, 0);
});

test("١٣:٠٠ يُقبل ويُحفظ ويُنادى /api/book، ثم إعادة الجدولة ٢٠:٣٠ تعمل", async () => {
  const ref = await newConsultation("استشارة مقبولة");
  bookCalls.length = 0;
  await at(SUN_0900, async () => {
    const a = await call("appointment-book", { ref, date: "2026-11-02", time: "13:00" });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.appointment.status, "BOOKED");
    assert.deepEqual([a.body.appointment.date, a.body.appointment.time], ["2026-11-02", "13:00"]);

    // إعادة الجدولة إلى الجمعة ← مرفوضة والموعد القديم باقٍ
    const bad = await call("appointment-reschedule", { ref, date: "2026-11-06", time: "15:00" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "off_day");
    assert.equal((await stored(ref)).time, "13:00");

    const ok = await call("appointment-reschedule", { ref, date: "2026-11-03", time: "20:30" });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.appointment.status, "RESCHEDULED");
    assert.deepEqual([(await stored(ref)).date, (await stored(ref)).time], ["2026-11-03", "20:30"]);
  });
  assert.deepEqual(bookCalls.map((c) => c.date + " " + c.time), ["2026-11-02 13:00", "2026-11-03 20:30"]);
});

test("الماضي ومهلة الساعة والمدى وتاريخٌ مستحيل", async () => {
  const ref = await newConsultation("استشارة حدود");
  await at(SUN_0900, async () => {
    const cases = [["2026-10-29", "14:00", "past"], ["2026-11-23", "14:00", "too_far"], ["2026-02-31", "14:00", "bad_datetime"], ["nope", "x", "bad_datetime"]];
    for (const [d, t, err] of cases) {
      const r = await call("appointment-book", { ref, date: d, time: t });
      assert.equal(r.status, 400, d);
      assert.equal(r.body.error, err, d);
    }
  });
  // الأحد ١٢:٣٠: فترة ١٣:٠٠ بعد نصف ساعة فقط
  await at(Date.parse("2026-11-01T09:30:00Z"), async () => {
    const r = await call("appointment-book", { ref, date: "2026-11-01", time: "13:00" });
    assert.equal(r.body.error, "too_soon");
  });
  assert.ok(!(await stored(ref)));
});

test("الواجهة: الوقت الافتراضي ضمن الساعات، وتُعرض رسالة الخادم، والملاحظة تطابق الواقع", () => {
  const src = fs.readFileSync(new URL("../site/scripts/simple-v1-my.mjs", import.meta.url), "utf8");
  assert.ok(!src.includes("value:'10:00'"), "الوقت الافتراضي ١٠:٠٠ خارج الساعات");
  assert.ok(src.includes("value:'13:00'"));
  assert.ok(src.includes("o.message||o.error"), "تُعرض رسالة الخادم لا رمز الخطأ");
  assert.ok(!src.includes("من الأحد إلى الخميس"), "الملاحظة تقول أحد–خميس والخادم يقبل السبت");
  assert.ok(src.includes("13:00") && src.includes("21:00"));
});
