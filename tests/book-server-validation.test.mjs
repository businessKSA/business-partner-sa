// تحقق الخادم من موعد حجز الاستشارة (api/book.js + api/_booking.js).
//
// القرار (المالك 2026-10-29): الجلسات من ١٣:٠٠ إلى ٢١:٠٠ بتوقيت الرياض عدا الجمعة،
// نصف ساعة للجلسة، آخر جلسة ٢٠:٣٠، مهلة ساعة، مدى ٢١ يوماً. كان الخادم يقبل أي
// (تاريخ، وقت) بصيغةٍ صحيحة — الواجهة وحدها تعرض الفترات الصالحة، فطلبٌ مرسلٌ
// مباشرةً يحجز الجمعة أو الثالثة فجراً. هذا الملف يُثبت أن الرفض في الخادم.
//
// الوقت مثبّت بتبديل Date.now حتى لا يتغيّر الاختبار بتغيّر اليوم.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "book-validate-"));
for (const k of ["RESEND_API_KEY", "NOTION_TOKEN", "LEAD_WEBHOOK_URL", "BOOKING_START", "BOOKING_END", "BOOKING_OFF_DAYS",
  "BOOKING_SLOT_MIN", "BOOKING_DAYS", "BOOKING_LEAD_MIN"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const { default: book } = await import("../api/book.js");
const { slotsOfDay, validateSlot, bookingConfig } = await import("../api/_booking.js");

// الأحد 2026-11-01 الساعة 09:00 بتوقيت الرياض = 06:00 UTC.
const SUN_0900 = Date.parse("2026-11-01T06:00:00Z");
const realNow = Date.now;
const at = async (ms, fn) => { Date.now = () => ms; try { return await fn(); } finally { Date.now = realNow; } };

async function call(method, { body, url = "/api/book" } = {}) {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await book({ method, url, headers: {}, socket: {}, body }, res);
  return out;
}
let n = 0;
const person = () => ({ name: "عميل تجريبي", phone: "0501234567", email: `t${++n}@test.local`, topic: "اختبار", lang: "ar" });
const post = (date, time, extra = {}) => call("POST", { body: { ...person(), date, time, ...extra } });

test("الساعات الافتراضية ١٣:٠٠–٢١:٠٠ ونصف ساعة وآخر جلسة ٢٠:٣٠", () => {
  const s = slotsOfDay();
  assert.equal(s[0], "13:00");
  assert.equal(s[s.length - 1], "20:30");
  assert.equal(s.length, 16);
  const c = bookingConfig();
  assert.deepEqual([c.slotMin, c.horizon, c.leadMin, c.offDays], [30, 21, 60, [5]]);
});

// ملاحظة: اختبارا الفترات والصحة قبل أي حجز، لأن الحجوزات تُكتب في القاعدة المحلية وتُطرح من المعروض.
test("?action=slots: بلا جمعة، أول فترة ١٣:٠٠ وآخرها ٢٠:٣٠، وتاريخ الرياض لا UTC", async () => {
  await at(SUN_0900, async () => {
    const r = await call("GET", { url: "/api/book?action=slots" });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    const dates = r.body.days.map((d) => d.date);
    assert.ok(dates.length > 10);
    for (const d of dates) assert.notEqual(new Date(d + "T12:00:00+03:00").getUTCDay(), 5, d + " جمعة");
    assert.ok(!dates.includes("2026-11-06"));
    for (const d of r.body.days) {
      assert.equal(d.slots[d.slots.length - 1], "20:30", d.date);
      assert.equal(d.slots[0], "13:00", d.date);
    }
    // اليوم نفسه (الأحد ٠٩:٠٠): أول فترة ١٣:٠٠ لأنها بعد المهلة
    assert.equal(r.body.days[0].date, "2026-11-01");
    assert.equal(r.body.slotMinutes, 30);
  });
  // الأربعاء ٢٢:٣٠ UTC = الخميس ٠١:٣٠ الرياض: «اليوم» عند الرياض الخميس ٢٠٢٦-١١-٠٥
  // وآخر يوم في المدى ٢٠٢٦-١١-٢٥. حسابٌ بـUTC يُخرج ١١-٢٤ آخرَ يومٍ.
  await at(Date.parse("2026-11-04T22:30:00Z"), async () => {
    const r = await call("GET", { url: "/api/book?action=slots" });
    const dates = r.body.days.map((d) => d.date);
    assert.equal(dates[0], "2026-11-05");
    assert.equal(dates[dates.length - 1], "2026-11-25");
  });
});

test("فحص الصحة: hours نصوص ومعها offDays وleadMinutes", async () => {
  const r = await call("GET", { url: "/api/book" });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "ok");
  assert.equal(r.body.hours.from, "13:00");
  assert.equal(r.body.hours.to, "21:00");
  assert.equal(r.body.hours.slotMinutes, 30);
  assert.deepEqual(r.body.hours.offDays, [5]);
  assert.equal(r.body.hours.leadMinutes, 60);
});

test("الجمعة ١٤:٠٠ ← ٤٠٠ off_day مع رسالة", async () => {
  await at(SUN_0900, async () => {
    const r = await post("2026-11-06", "14:00");           // الجمعة
    assert.equal(r.status, 400);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error, "off_day");
    assert.ok(r.body.message && r.body.message.length > 5);
  });
});

test("خارج الساعات ١٢:٣٠ و٢١:٠٠ و١٠:٠٠ ← ٤٠٠ out_of_hours", async () => {
  await at(SUN_0900, async () => {
    for (const t of ["12:30", "21:00", "10:00", "03:00", "20:45"]) {
      const r = await post("2026-11-02", t);
      assert.equal(r.status, 400, t);
      assert.equal(r.body.error, "out_of_hours", t);
    }
  });
});

test("١٣:٠٠ و٢٠:٣٠ مقبولان ← ٢٠٠ والسبت مفتوح", async () => {
  await at(SUN_0900, async () => {
    for (const [d, t] of [["2026-11-02", "13:00"], ["2026-11-02", "20:30"], ["2026-11-07", "13:00"]]) {
      const r = await post(d, t);
      assert.equal(r.status, 200, `${d} ${t} ${JSON.stringify(r.body)}`);
      assert.equal(r.body.ok, true);
      assert.deepEqual([r.body.when.date, r.body.when.time], [d, t]);
    }
  });
});

test("الماضي ← past، ودون المهلة ← too_soon، وعند ٦٠ دقيقة بالضبط مقبول", async () => {
  await at(SUN_0900, async () => {
    assert.equal((await post("2026-10-29", "14:00")).body.error, "past");
  });
  // الأحد ١٢:٣٠ الرياض: فترة ١٣:٠٠ بعد نصف ساعة فقط
  await at(Date.parse("2026-11-01T09:30:00Z"), async () => {
    const r = await post("2026-11-01", "13:00");
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "too_soon");
  });
  // ١٢:٠٠ الرياض: ١٣:٠٠ بعد ٦٠ دقيقة بالضبط ← مقبول
  await at(Date.parse("2026-11-01T09:00:00Z"), async () => {
    assert.equal((await post("2026-11-01", "13:00")).status, 200);
  });
  // ١٢:٠١: ١٣:٠٠ بعد ٥٩ دقيقة ← مرفوض، و١٣:٣٠ مقبول
  await at(Date.parse("2026-11-01T09:01:00Z"), async () => {
    assert.equal((await post("2026-11-01", "13:00")).body.error, "too_soon");
    assert.equal((await post("2026-11-01", "13:30")).status, 200);
    assert.equal(validateSlot("2026-11-01", "13:00", Date.now()).error, "too_soon");
  });
});

test("أبعد من المدى ← too_far، وآخر يوم في المدى مقبول", async () => {
  await at(SUN_0900, async () => {
    assert.equal((await post("2026-11-23", "14:00")).body.error, "too_far");   // اليوم ٢٢
    assert.equal((await post("2026-11-22", "14:00")).status, 200);             // اليوم ٢١
  });
});

test("تاريخٌ مستحيل أو وقتٌ فاسد ← ٤٠٠ ولا يمرّ", async () => {
  await at(SUN_0900, async () => {
    const r = await post("2026-02-31", "14:00");
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "bad_datetime");
    assert.equal((await post("2026-13-01", "14:00")).status, 400);
    assert.equal((await post("2026-11-02", "25:61")).status, 400);
  });
});

test("المتغيّرات BOOKING_START/END/OFF_DAYS تتجاوز الافتراضي دون تعديل شيفرة", async () => {
  process.env.BOOKING_START = "10";
  process.env.BOOKING_END = "18";
  process.env.BOOKING_OFF_DAYS = "5,6";
  try {
    await at(SUN_0900, async () => {
      assert.equal((await post("2026-11-04", "10:00")).status, 200);
      assert.equal((await post("2026-11-04", "17:30")).status, 200);
      assert.equal((await post("2026-11-04", "18:00")).body.error, "out_of_hours");
      assert.equal((await post("2026-11-04", "13:00")).status, 200);
      assert.equal((await post("2026-11-07", "14:00")).body.error, "off_day");   // السبت صار عطلة
      assert.equal((await post("2026-11-06", "14:00")).body.error, "off_day");
    });
  } finally { for (const k of ["BOOKING_START", "BOOKING_END", "BOOKING_OFF_DAYS"]) delete process.env[k]; }
});

test("invalid_fields يبقى ٤٠٠، وslot_taken يبقى ٤٠٩", async () => {
  await at(SUN_0900, async () => {
    const bad = await call("POST", { body: { name: "", phone: "", email: "x", date: "2026-11-03", time: "14:00" } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "invalid_fields");

    const first = await post("2026-11-03", "15:00");
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await post("2026-11-03", "15:00");
    assert.equal(second.status, 409);
    assert.equal(second.body.error, "slot_taken");
  });
});
