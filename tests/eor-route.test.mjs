// مسار ?__route=eor في api/requests.js — يوصل النموذج بمعالج api/_eor.js. بلا شبكة:
// APP_ENV=development يحوّل البريد وواتساب وNotion إلى صندوق ملفّي (outbox) تحت LOCAL_DB_DIR.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-route-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { default: handler } = await import("../api/requests.js");
const { _resetEorRateLimit } = await import("../api/_eor.js");

const outboxFile = () => path.join(process.env.LOCAL_DB_DIR, "outbox.json");
const outbox = () => { try { return JSON.parse(fs.readFileSync(outboxFile(), "utf8")); } catch { return []; } };

function call({ method = "POST", query = { __route: "eor" }, body, headers = {} } = {}) {
  const req = { method, query, headers, url: "/api/requests", body: body === undefined ? undefined : JSON.stringify(body) };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(s) { let j = null; try { j = JSON.parse(s); } catch {} resolve({ status: this.statusCode, json: j, raw: s, headers: this.headers }); },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
const good = (over = {}) => ({
  company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض",
  workerType: "foreign", recruitment: "yes",
  items: [{ occupationId: "hosp.waiter", count: 5, nationalities: ["IN"], salary: 2500 }],
  startDate: "2027-01-01", durationMonths: 12, notes: "ملاحظة", lang: "ar", ...over,
});

test("POST صالح → 200 { ok, ref } ويكتب في الصندوق (CRM + بريد + واتساب) بلا شبكة", async () => {
  _resetEorRateLimit();
  const before = outbox().length;
  const r = await call({ body: good(), headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.match(r.json.ref, /^EOR-\d{6}$/);
  const added = outbox().slice(before);
  const kinds = added.map((e) => e.kind);
  assert.ok(kinds.includes("crm"), "سجلّ Notion المحاكى");
  assert.ok(kinds.includes("email"), "بريد");
  assert.ok(kinds.includes("whatsapp"), "تنبيه المالك");
  assert.ok(added.some((e) => e.kind === "email" && e.to === "sara@example.com"), "تأكيد للعميل");
});

test("حمولة غير صالحة → 400 ولا كتابة", async () => {
  _resetEorRateLimit();
  const before = outbox().length;
  const r = await call({ body: good({ email: "ليس-بريدا" }) });
  assert.equal(r.status, 400);
  assert.equal(r.json.ok, false);
  assert.equal(outbox().length, before);
  const r2 = await call({ body: [1, 2] });
  assert.equal(r2.status, 400);
});

test("honeypot → نجاح شكلي بلا كتابة", async () => {
  _resetEorRateLimit();
  const before = outbox().length;
  const r = await call({ body: good({ website: "http://spam.example" }) });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.match(r.json.ref, /^EOR-\d{6}$/);
  assert.equal(outbox().length, before);
});

test("GET search → نتائج {id,nameAr,nameEn}", async () => {
  const r = await call({ method: "GET", query: { __route: "eor", action: "search", q: "نادل" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(Array.isArray(r.json.results));
  if (r.json.results.length) assert.deepEqual(Object.keys(r.json.results[0]).sort(), ["id", "nameAr", "nameEn"]);
  const short = await call({ method: "GET", query: { __route: "eor", action: "search", q: "ن" } });
  assert.deepEqual(short.json.results, []);
});

test("GET بلا action=search وطرق أخرى → 405", async () => {
  assert.equal((await call({ method: "GET", query: { __route: "eor" } })).status, 405);
  assert.equal((await call({ method: "DELETE", query: { __route: "eor" } })).status, 405);
});

test("حدّ المعدل يُعاد كما هو (429)", async () => {
  _resetEorRateLimit();
  let last;
  for (let i = 0; i < 7; i++) last = await call({ body: good(), headers: { "x-forwarded-for": "9.9.9.9" } });
  assert.equal(last.status, 429);
  assert.equal(last.json.error, "rate_limited");
});

test("مسار غير معروف لا يتأثر: GET الصحّة العامة ما زال يعمل", async () => {
  const r = await call({ method: "GET", query: { __route: "no-such-route" }, headers: {} });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "ok");
});
