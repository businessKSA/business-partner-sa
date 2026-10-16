// بوابة مكاتب الاستقدام: لا نقطة عامة تعدّل سجلاً موجوداً أو تُرجع رمز وصول (2026-10-01).
// الثغرة: type:"register" كانت عامة بلا مصادقة، وعلى بريد مكتب موجود تعدّل سجلّه
// وتُرجع رمز وصوله في الاستجابة. تُختبر هنا مقابل «نوشن» وهمي في الذاكرة.
import test from "node:test";
import assert from "node:assert/strict";

process.env.NOTION_TOKEN = "test-notion";
process.env.RESEND_API_KEY = "test-resend";
process.env.OTP_SECRET = "test-otp-secret";
process.env.PANEL_KEY = "test-owner-key";
process.env.NOTION_AGENCIES_DB = "agdb";
process.env.NOTION_AGENCY_REQUESTS_DB = "rqdb";
delete process.env.GOOGLE_CLIENT_ID;

// ---- a tiny in-memory Notion + Resend --------------------------------------
const pages = new Map();          // id -> { id, db, properties(read shape), created_time }
const writes = [];                // every POST pages / PATCH pages
const mails = [];                 // every e-mail sent
let seq = 0;

function toRead(wprops) {
  const out = {};
  for (const [k, v] of Object.entries(wprops || {})) {
    if (v.title) out[k] = { type: "title", title: v.title.map((t) => ({ plain_text: t.text.content })) };
    else if (v.rich_text) out[k] = { type: "rich_text", rich_text: v.rich_text.map((t) => ({ plain_text: t.text.content })) };
    else if ("select" in v) out[k] = { type: "select", select: v.select };
    else if ("email" in v) out[k] = { type: "email", email: v.email };
    else if ("phone_number" in v) out[k] = { type: "phone_number", phone_number: v.phone_number };
    else if ("checkbox" in v) out[k] = { type: "checkbox", checkbox: v.checkbox };
    else if ("number" in v) out[k] = { type: "number", number: v.number };
    else if ("url" in v) out[k] = { type: "url", url: v.url };
    else out[k] = v;
  }
  return out;
}
function matches(page, f) {
  if (!f) return true;
  if (f.and) return f.and.every((x) => matches(page, x));
  if (f.or) return f.or.some((x) => matches(page, x));
  const p = page.properties[f.property];
  if (f.email) return !!p && p.email === f.email.equals;
  if (f.select) return !!p && !!p.select && p.select.name === f.select.equals;
  return true;
}
const fakeFetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : null;
  const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  if (u.startsWith("https://api.resend.com/emails")) { mails.push(body); return json({ id: "m" }); }
  if (!u.startsWith("https://api.notion.com/v1/")) throw new Error("unexpected fetch " + u);
  const path = u.slice("https://api.notion.com/v1/".length);
  let m;
  if ((m = path.match(/^databases\/([^/]+)\/query$/))) {
    const results = [...pages.values()].filter((p) => p.db === m[1] && matches(p, body && body.filter));
    return json({ results: results.slice(0, (body && body.page_size) || 100) });
  }
  if (path === "pages" && init.method === "POST") {
    const id = "pg" + ++seq;
    const pg = { id, db: body.parent.database_id, properties: toRead(body.properties), created_time: "2026-10-01T00:00:00Z" };
    pages.set(id, pg); writes.push({ method: "POST", id, body });
    return json(pg);
  }
  if ((m = path.match(/^pages\/([^/]+)$/))) {
    const pg = pages.get(m[1]);
    if (!pg) return json({}, 404);
    if (init.method === "PATCH") {
      Object.assign(pg.properties, toRead(body.properties)); writes.push({ method: "PATCH", id: pg.id, body });
    }
    return json(pg);
  }
  return json({}, 404);
};
globalThis.fetch = fakeFetch;

const { handleAgencies } = await import("../api/_agencies.js");

async function call(method, payload, query = "") {
  const req = { method, url: "/api/agencies" + query, body: payload };
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  await handleAgencies(req, res);
  return { status: res.statusCode, text: res.body, json: JSON.parse(res.body) };
}
const post = (payload) => call("POST", payload);
const reset = () => { pages.clear(); writes.length = 0; mails.length = 0; seq = 0; };
const snapshot = () => JSON.stringify([...pages.values()]);

async function seedOffice(email = "owner@office.example", password = "correct-horse-battery") {
  const r = await post({ type: "signup", name: "Al Amal Recruitment", email, password });
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.code, /^BP-AG-[A-Z0-9]{10}$/);
  return { email, password, code: r.json.code };
}

// ---- the vulnerability ------------------------------------------------------
test("register على بريد مكتب موجود: لا يعدّل السجل ولا يُرجع أي رمز", async () => {
  reset();
  const office = await seedOffice();
  const before = snapshot();
  const writesBefore = writes.length;
  const mailsBefore = mails.length;

  const r = await post({
    type: "register", name: "Attacker Ltd", email: office.email, country: "XX", phone: "+000",
    license: "FORGED", contact: "attacker", about: "pwned", password: "attacker-password-1",
  });

  assert.ok(!r.text.includes(office.code), "رمز الوصول ظهر في الاستجابة: " + r.text);
  assert.ok(!/BP-AG-/.test(r.text), "أي رمز وصول ممنوع: " + r.text);
  assert.ok(!("code" in r.json) && !("agency" in r.json), r.text);
  assert.equal(writes.length, writesBefore, "register كتب على نوشن");
  assert.equal(snapshot(), before, "سجل المكتب تغيّر");
  assert.equal(mails.length, mailsBefore, "register أرسل بريداً");
  // والرمز القديم ما زال يعمل لصاحبه وحده، وكلمة مرور المهاجم لا تدخل.
  const own = await post({ type: "login", email: office.email, code: office.code });
  assert.equal(own.status, 200);
  assert.equal(own.json.agency.name, "Al Amal Recruitment");
  const hijack = await post({ type: "login", email: office.email, password: "attacker-password-1" });
  assert.equal(hijack.status, 401);
});

test("register: الرد واحد لبريد موجود وغير موجود، ولا ينشئ حساباً", async () => {
  reset();
  const office = await seedOffice();
  const payload = { type: "register", name: "X", country: "XX", phone: "+000", password: "attacker-password-1" };
  const existing = await post({ ...payload, email: office.email });
  const fresh = await post({ ...payload, email: "nobody@else.example" });
  assert.equal(existing.status, fresh.status);
  assert.equal(existing.text, fresh.text, "الرد يفرّق بين الموجود وغير الموجود");
  assert.equal([...pages.values()].filter((p) => p.properties["البريد"].email === "nobody@else.example").length, 0);
});

// ---- the paths the UI uses must keep working --------------------------------
test("signup ثم login بكلمة المرور ثم بالرمز", async () => {
  reset();
  const office = await seedOffice();
  const byPw = await post({ type: "login", email: office.email, password: office.password });
  assert.equal(byPw.status, 200);
  assert.equal(byPw.json.code, office.code);
  const byCode = await post({ type: "login", email: office.email, code: office.code });
  assert.equal(byCode.status, 200);
  assert.equal(byCode.json.agency.email, office.email);
  assert.ok(!("code" in byCode.json), "login بالرمز لا يُعيد الرمز");
  const bad = await post({ type: "login", email: office.email, password: "wrong-password-1" });
  assert.equal(bad.status, 401);
  const badCode = await post({ type: "login", email: office.email, code: "BP-AG-AAAAAAAAAA" });
  assert.equal(badCode.status, 401);
});

test("signup على بريد موجود: بكلمة المرور الصحيحة يدخل، وبغيرها 409 بلا رمز", async () => {
  reset();
  const office = await seedOffice();
  const same = await post({ type: "signup", name: "Al Amal", email: office.email, password: office.password });
  assert.equal(same.status, 200);
  assert.equal(same.json.code, office.code);
  const other = await post({ type: "signup", name: "Other", email: office.email, password: "attacker-password-1" });
  assert.equal(other.status, 409);
  assert.ok(!other.text.includes(office.code) && !("code" in other.json));
});

test("المكتب الموقوف لا يدخل بأي طريق", async () => {
  reset();
  const office = await seedOffice();
  [...pages.values()][0].properties["الحالة"] = { type: "select", select: { name: "موقوف" } };
  assert.equal((await post({ type: "login", email: office.email, password: office.password })).status, 403);
  assert.equal((await post({ type: "login", email: office.email, code: office.code })).status, 403);
});

// ---- email-code: no existence oracle ---------------------------------------
test("email-code: شكل الرد واحد للمسجَّل وغيره، والبريد يُرسل للمسجَّل فقط", async () => {
  reset();
  const office = await seedOffice();
  const mailsBefore = mails.length;
  const known = await post({ type: "email-code", email: office.email });
  const sentToKnown = mails.slice(mailsBefore);
  const mailsMid = mails.length;
  const unknown = await post({ type: "email-code", email: "ghost@nowhere.example" });
  assert.equal(mails.length, mailsMid, "أُرسل بريد لعنوان غير مسجَّل");
  assert.equal(known.status, unknown.status);
  assert.deepEqual(Object.keys(known.json).sort(), Object.keys(unknown.json).sort());
  assert.equal(typeof unknown.json.t, "string");
  assert.equal(sentToKnown.length, 1);

  // الرمز المرسل للمسجَّل يفتح، والرمز المختوم لغير المسجَّل لا يفتح أبداً.
  const code = /letter-spacing:6px[^>]*>(\d{6})</.exec(sentToKnown[0].html)[1];
  const ok = await post({ type: "email-verify", email: office.email, code, t: known.json.t, exp: known.json.exp });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.code, office.code);
  for (let g = 100000; g < 100010; g++) {
    const bad = await post({ type: "email-verify", email: "ghost@nowhere.example", code: String(g), t: unknown.json.t, exp: unknown.json.exp });
    assert.equal(bad.status, 401);
  }
});

// ---- create-request: self-serve (مفعّل) offices are notified ------------------
test("create-request يبلّغ المكاتب المفعّلة والمعتمدة لا الموقوفة", async () => {
  reset();
  const a = await seedOffice("a@office.example");
  const b = await seedOffice("b@office.example");
  const c = await seedOffice("c@office.example");
  const set = (email, status) => { [...pages.values()].find((p) => p.properties["البريد"].email === email).properties["الحالة"] = { type: "select", select: { name: status } }; };
  set(b.email, "معتمد");
  set(c.email, "موقوف");
  mails.length = 0;
  const r = await post({ type: "create-request", key: "test-owner-key", title: "10 سائقين", profession: "سائق" });
  assert.equal(r.status, 200, r.text);
  const to = mails.map((m) => m.to[0]).sort();
  assert.deepEqual(to, [a.email, b.email].sort());
  // ومن دون مفتاح المالك لا شيء.
  assert.equal((await post({ type: "create-request", title: "x" })).status, 403);
});
