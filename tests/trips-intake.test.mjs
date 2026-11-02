// نموذج /trips (محفول مكفول) — ?__route=trips-intake في api/requests.js ← api/_tripsintake.js.
// بلا شبكة: APP_ENV=development يحوّل البريد إلى صندوق ملفّي، وLOCAL_DB يحوّل requests إلى ملف JSON.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "trips-intake-"));
delete process.env.TRIPS_INTAKE_EMAIL;

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { default: handler } = await import("../api/requests.js");
const { sb } = await import("../api/_db.js");
const { validate, rateLimited } = await import("../api/_tripsintake.js");

const outbox = () => { try { return JSON.parse(fs.readFileSync(path.join(process.env.LOCAL_DB_DIR, "outbox.json"), "utf8")); } catch { return []; } };
const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const good = (over = {}) => ({
  line: "corp", name: "سارة العتيبي", company: "شركة الأفق", phone: "+966 50 123 4567", email: "Sara@Example.com",
  country: "السعودية", city: "الرياض", people: 25, date: future, budget: "50000", notes: "ملاحظة",
  selections: ["اليوم الوطني"], details: [], consent: true, lang: "ar", website: "", ...over,
});
let ipN = 0;
function call(body, { method = "POST" } = {}) {
  const req = { method, query: { __route: "trips-intake" }, headers: { "x-forwarded-for": `10.9.0.${++ipN}` }, url: "/api/requests", body: body === undefined ? undefined : JSON.stringify(body) };
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(s) { let j = null; try { j = JSON.parse(s); } catch {} resolve({ status: this.statusCode, json: j }); } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

test("validate: طلب صالح لكل خط، والجوال يُنظَّف والبريد يُصغَّر", () => {
  const a = validate(good());
  assert.equal(a.ok, true);
  assert.equal(a.v.phone, "+966501234567");
  assert.equal(a.v.email, "sara@example.com");
  assert.equal(a.v.budget, 50000);
  assert.equal(validate(good({ line: "tour", company: "", selections: [] })).ok, true);
  assert.equal(validate(good({ line: "inv", company: "", selections: [], details: [["نوع النشاط", "تجاري"]] })).ok, true);
});

test("validate: أرقام عربية في الجوال وعدد الأفراد تُقبل", () => {
  const r = validate(good({ phone: "٠٥٠١٢٣٤٥٦٧", people: "٢٥", budget: "٥٠٠٠٠" }));
  assert.equal(r.ok, true);
  assert.equal(r.v.phone, "0501234567");
  assert.equal(r.v.people, 25);
});

test("validate: كل حقل إلزامي يُرفض بعينه", () => {
  const cases = [
    [{ line: "x" }, "line"], [{ name: "ا" }, "name"], [{ name: "12345" }, "name"],
    [{ phone: "123" }, "phone"], [{ phone: "abc12345678" }, "phone"], [{ phone: "1".repeat(16) }, "phone"],
    [{ email: "nope" }, "email"], [{ email: "a@b" }, "email"],
    [{ country: "" }, "country"], [{ company: "" }, "company"],
    [{ people: 0 }, "people"], [{ people: 5001 }, "people"], [{ people: 2.5 }, "people"], [{ people: "x" }, "people"],
    [{ date: "" }, "date"], [{ date: "2020-01-01" }, "date"], [{ date: "2099-01-01" }, "date"], [{ date: "غدا" }, "date"],
    [{ budget: "-5" }, "budget"], [{ budget: "كثير" }, "budget"], [{ budget: "1e12" }, "budget"],
    [{ selections: [] }, "selections"], [{ consent: false }, "consent"], [{ consent: "true" }, "consent"],
  ];
  for (const [over, field] of cases) {
    const r = validate(good(over));
    assert.equal(r.ok, false, field);
    assert.ok(r.errors[field], `${field} يجب أن يُرفض: ${JSON.stringify(over)}`);
  }
  assert.equal(validate(good({ line: "inv", company: "", selections: [], details: [] })).errors.details, "invalid");
});

test("validate: الميزانية اختيارية، وحقل الفخّ يمسك الآليّين، والنص يُنظَّف ويُقصّ", () => {
  assert.equal(validate(good({ budget: "" })).v.budget, null);
  assert.equal(validate(good({ website: "http://spam" })).errors.website, "bot");
  const r = validate(good({ notes: "a‮b\u0000c " + "x".repeat(5000), name: "  سارة   العتيبي  " }));
  assert.equal(r.v.notes.length, 1500);
  assert.ok(!/[‮\u0000]/.test(r.v.notes));
  assert.equal(r.v.name, "سارة العتيبي");
});

test("POST صالح → 200 + مرجع BP-R + سجل في requests + رسالتان في الصندوق (فريق وعميل) بلا شبكة", async () => {
  const before = outbox().length;
  const r = await call(good());
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.match(r.json.ref, /^BP-R-[0-9A-F]{6}$/);
  assert.equal(r.json.stored, true);
  const rows = outbox().slice(0, outbox().length - before);
  const team = rows.find((x) => x.to === "business@businesspartner.sa");
  const client = rows.find((x) => x.to === "sara@example.com");
  assert.ok(team && client, "رسالة للفريق ورسالة للعميل");
  assert.match(team.subject, new RegExp(r.json.ref));
  assert.match(team.subject, /corp/);
  assert.ok(team.body.includes("شركة الأفق") && team.body.includes("اليوم الوطني"));
  const saved = (await sb(`requests?ref=eq.${r.json.ref}&select=*&limit=1`))[0];
  assert.ok(saved, "الطلب مسجّل في requests");
  assert.equal(saved.status, "REVIEWING");
  assert.equal(saved.client_email, "sara@example.com");
});

test("TRIPS_INTAKE_EMAIL يغيّر عنوان الفريق", async () => {
  process.env.TRIPS_INTAKE_EMAIL = "intake@example.test";
  try {
    const r = await call(good({ line: "tour", company: "", selections: [] }));
    assert.equal(r.status, 200);
    assert.ok(outbox().some((x) => x.to === "intake@example.test" && x.subject.includes(r.json.ref)));
  } finally { delete process.env.TRIPS_INTAKE_EMAIL; }
});

test("POST غير صالح → 400 مع الحقول، ولا يُكتب شيء", async () => {
  const before = outbox().length;
  const r = await call(good({ phone: "1", consent: false }));
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "invalid_fields");
  assert.ok(r.json.fields.phone && r.json.fields.consent);
  assert.equal(outbox().length, before);
});

test("الفخّ: ردّ نجاح شكلي بلا تسجيل ولا بريد", async () => {
  const before = outbox().length;
  const r = await call(good({ website: "x" }));
  assert.equal(r.status, 200);
  assert.equal(r.json.stored, false);
  assert.equal(outbox().length, before);
});

test("GET → 405، وجسم غير كائن → 400، وتحديد المعدّل → 429", async () => {
  assert.equal((await call(undefined, { method: "GET" })).status, 405);
  assert.equal((await call([1, 2])).status, 400);
  assert.equal(rateLimited("9.9.9.9", 1000, 2), false);
  assert.equal(rateLimited("9.9.9.9", 1001, 2), false);
  assert.equal(rateLimited("9.9.9.9", 1002, 2), true);
  assert.equal(rateLimited("9.9.9.9", 1000 + 600001, 2), false);
});
