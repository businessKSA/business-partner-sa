// بوابة المورّدين /vendor (الشريحة الأولى) — api/_agencies.js مقابل Notion وهمي في الذاكرة. بلا شبكة.
//
// ما يُثبته هذا الملف:
//   ١) «الطلبات المفتوحة» محمية بجلسة مورّد مفعّل، وناتجها قائمة بيضاء: لا راتب ولا سعر ولا اسم عميل ولا بريد/جوال
//      ولا ملاحظات — بقيم فريدة (canaries) تُفحص نصّياً على كل رد، كما في tests/eor-vendor.test.mjs.
//   ٢) «مرشحوك» لا تُرجع إلا مرشّحي المورّد نفسه، بمعرّف المكتب لا بالاسم، مع احتياط الاسم للصفوف القديمة بشرط فرادته.
//   ٣) وسم المصدر الداخلي يُكتب في Notion ولا يخرج في أي ناتج، وملفات أصحاب العمل لا تذكر أعمدته أصلاً.
//   ٤) السيرة PDF: تُفحص بتوقيعها وحجمها، وتُحفظ على صفحة المرشّح إن لم يأخذها خط n8n.
//   ٥) غياب العمودين الجديدين في Notion لا يُضيع مرشّحاً ولا يكسر القراءة.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-portal-test-"));
process.env.NOTION_TOKEN = "test-notion";
process.env.RESEND_API_KEY = "test-resend";
process.env.OTP_SECRET = "test-otp-secret";
process.env.PANEL_KEY = "test-owner-key";
process.env.NOTION_AGENCIES_DB = "agdb";
process.env.NOTION_AGENCY_REQUESTS_DB = "rqdb";
process.env.NOTION_ATS_DB = "atsdb";
process.env.NOTION_EOR_DB = "eordb";
delete process.env.GOOGLE_CLIENT_ID;

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const E = await import("../api/_eor.js");
const S = await import("../api/_sources.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) });

/* ───────────── Notion وهمي ───────────── */
const pages = new Map();       // id -> { id, db, properties(read shape), created_time }
const blocksPatched = [];      // PATCH blocks/<id>/children
const writes = [];
const mails = [];
let seq = 0;
const cols = { id: true, source: true };   // هل العمودان الجديدان موجودان في قاعدة ATS؟
let eorRows = [];              // صفوف قاعدة EOR (شكل القراءة) + أجسامها
let n8nMode = "empty";         // empty: يردّ بلا روابط Drive · down: يفشل
const uploads = [];

function toRead(w) {
  const out = {};
  for (const [k, v] of Object.entries(w || {})) {
    if (v.title) out[k] = { type: "title", title: v.title.map((t) => ({ plain_text: t.text.content })) };
    else if (v.rich_text) out[k] = { type: "rich_text", rich_text: v.rich_text.map((t) => ({ plain_text: t.text.content })) };
    else if ("select" in v) out[k] = { type: "select", select: v.select };
    else if ("email" in v) out[k] = { type: "email", email: v.email };
    else if ("phone_number" in v) out[k] = { type: "phone_number", phone_number: v.phone_number };
    else if ("checkbox" in v) out[k] = { type: "checkbox", checkbox: v.checkbox };
    else if ("number" in v) out[k] = { type: "number", number: v.number };
    else if ("url" in v) out[k] = { type: "url", url: v.url };
    else if (v.multi_select) out[k] = { type: "multi_select", multi_select: v.multi_select };
    else if ("date" in v) out[k] = { type: "date", date: v.date };
    else out[k] = v;
  }
  return out;
}
const textOf = (p) => !p ? "" : p.type === "title" ? p.title.map((x) => x.plain_text).join("") : p.type === "rich_text" ? p.rich_text.map((x) => x.plain_text).join("")
  : p.type === "select" ? (p.select ? p.select.name : "") : p.type === "email" ? (p.email || "") : "";
function matches(pg, f) {
  if (!f) return true;
  if (f.and) return f.and.every((x) => matches(pg, x));
  if (f.or) return f.or.some((x) => matches(pg, x));
  const p = pg.properties[f.property];
  if (f.email) return !!p && p.email === f.email.equals;
  if (f.title) return textOf(p) === f.title.equals;
  if (f.select) return textOf(p) === f.select.equals;
  if (f.rich_text) {
    if ("is_empty" in f.rich_text) return textOf(p) === "";
    if ("equals" in f.rich_text) return textOf(p) === f.rich_text.equals;
  }
  return true;
}
const mentionsMissingCol = (obj) => {
  const s = JSON.stringify(obj || {});
  return (!cols.id && s.includes(S.OFFICE_ID_PROP)) || (!cols.source && s.includes(S.SOURCE_PROP));
};

const fakeFetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
  const method = init.method || "GET";
  if (u.startsWith("https://api.resend.com/emails")) { mails.push(body); return resp(200, { id: "m" }); }
  if (u.includes("n8n.cloud") || /webhook/.test(u)) {
    if (n8nMode === "down") throw new Error("n8n down");
    return resp(200, {});
  }
  if (!u.startsWith("https://api.notion.com/v1/")) throw new Error("unexpected fetch " + u);
  const p = u.slice("https://api.notion.com/v1/".length);
  let m;
  if ((m = p.match(/^databases\/([^/]+)\/query$/))) {
    if (m[1] === "eordb") return resp(200, { results: eorRows.map((r) => r.page), has_more: false, next_cursor: null });
    if (m[1] === "atsdb" && mentionsMissingCol(body && body.filter)) return resp(400, { message: `${S.OFFICE_ID_PROP} is not a property that exists.` });
    const results = [...pages.values()].filter((x) => x.db === m[1] && matches(x, body && body.filter));
    return resp(200, { results: results.slice(0, (body && body.page_size) || 100), has_more: false });
  }
  if ((m = p.match(/^blocks\/([^/?]+)\/children/))) {
    if (method === "PATCH") { blocksPatched.push({ id: m[1], body }); return resp(200, { results: [] }); }
    const row = eorRows.find((r) => r.page.id === decodeURIComponent(m[1]));
    return resp(200, { results: ((row && row.children) || []).map((b) => ({ type: b.type, code: b.code })) });
  }
  if (p === "file_uploads" && method === "POST") { uploads.push("created"); return resp(200, { id: "up" + uploads.length }); }
  if ((m = p.match(/^file_uploads\/([^/]+)\/send$/))) return resp(200, {});
  if (p === "pages" && method === "POST") {
    if (body.parent.database_id === "atsdb" && mentionsMissingCol(body.properties)) return resp(400, { message: `${!cols.id ? S.OFFICE_ID_PROP : S.SOURCE_PROP} is not a property that exists.` });
    const id = "pg" + ++seq;
    const pg = { id, db: body.parent.database_id, properties: toRead(body.properties), created_time: new Date(Date.UTC(2026, 9, 8, 10, 0, seq)).toISOString(), url: "https://notion.so/" + id };
    pages.set(id, pg); writes.push({ method, id, db: pg.db, body });
    return resp(200, pg);
  }
  if ((m = p.match(/^pages\/([^/]+)$/))) {
    const pg = pages.get(m[1]);
    if (!pg) return resp(404, {});
    if (method === "PATCH") {
      if (pg.db === "atsdb" && mentionsMissingCol(body.properties)) return resp(400, { message: `${S.OFFICE_ID_PROP} is not a property that exists.` });
      Object.assign(pg.properties, toRead(body.properties)); writes.push({ method, id: pg.id, db: pg.db, body });
    }
    return resp(200, pg);
  }
  return resp(404, {});
};
globalThis.fetch = fakeFetch;

const { handleAgencies, rowOwnedBy, _resetVendorDemandCache } = await import("../api/_agencies.js");

async function post(payload) {
  const req = { method: "POST", url: "/api/agencies", body: payload };
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  await handleAgencies(req, res);
  return { status: res.statusCode, text: res.body, json: JSON.parse(res.body) };
}
function reset() {
  pages.clear(); writes.length = 0; mails.length = 0; blocksPatched.length = 0; uploads.length = 0; seq = 0;
  cols.id = true; cols.source = true; eorRows = []; n8nMode = "empty"; _resetVendorDemandCache();
}
async function signup(name, email, extra = {}) {
  const r = await post({ type: "signup", name, email, password: "correct-horse-battery", ...extra });
  assert.equal(r.status, 200, r.text);
  return { id: r.json.agency.id, email, code: r.json.code, name };
}
const setProp = (id, prop, value) => { pages.get(id).properties[prop] = value; };
const setStatus = (id, st) => setProp(id, "الحالة", { type: "select", select: st ? { name: st } : null });
const creds = (o) => ({ email: o.email, code: o.code });
const PDF_B64 = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");
const atsRows = () => [...pages.values()].filter((x) => x.db === "atsdb");

/* ───────────── طلبات EOR بقيم فريدة ───────────── */
const NOW = Date.parse("2026-10-08T09:00:00Z");
const CANARY = { company: "ZZCOMPANY7Q1", contact: "ZZCONTACT8W2", email: "zzmail3k@canary.example", phone: "0559876543", notes: "ZZNOTES4R5", salary: 7771.25, quote: "ZZQUOTE9T6" };
const CANARY_TEXT = [CANARY.company, CANARY.contact, CANARY.email, "canary.example", CANARY.phone.slice(1), CANARY.notes, "7771", CANARY.quote];
const assertNoCanary = (value, label = "") => {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  for (const c of CANARY_TEXT) assert.equal(s.includes(c), false, `${label} تسرّب: ${c}`);
};
function plainOf(prop) {
  if (prop.title) return { title: prop.title.map((x) => ({ plain_text: x.text.content })) };
  if (prop.rich_text) return { rich_text: prop.rich_text.map((x) => ({ plain_text: x.text.content })) };
  return prop;
}
async function eorRow(over = {}, { ref, open = true, status = "جديد" } = {}) {
  let captured = null;
  const ctx = {
    dev: false, notionToken: "t", dbId: "d", now: NOW, ip: "", pricing: null, refGen: () => ref,
    fetch: async (url, init) => { captured = JSON.parse(init.body); return resp(200, { id: "eor-" + ref }); },
    sendEmail: async () => ({ ok: true }), notify: async () => ({ ok: true }), teamEmail: "t@test.local", ownerEmail: "o@test.local",
  };
  const r = await E.handleEor({
    company: CANARY.company, contactName: CANARY.contact, email: CANARY.email, phone: CANARY.phone, city: "الرياض، حي الملقا، شارع ZZADDR2Y3",
    sector: "hospitality", workerType: "foreign", recruitment: "yes",
    items: [{ occupationId: "hosp.waiter", count: 5, nationalities: ["IN", "PK"], salary: CANARY.salary }, { occupationId: "hosp.chef-de-partie", count: 2, nationalities: [], salary: null }],
    startDate: "2026-11-01", durationMonths: 12, notes: CANARY.notes, lang: "ar", ...over,
  }, ctx);
  assert.equal(r.ok, true, JSON.stringify(r));
  const props = {};
  for (const [k, v] of Object.entries(captured.properties)) props[k] = plainOf(v);
  props["الحالة"] = { select: { name: status } };
  props["تقدير عرض السعر"] = { rich_text: [{ plain_text: CANARY.quote }] };
  props["مفتوح للمورّدين"] = { checkbox: open };
  props["تاريخ الإطلاق"] = { date: null };
  return { page: { id: "eor-" + ref, created_time: "2026-10-05T10:00:00.000Z", archived: false, properties: props }, children: captured.children };
}

/* ═════════════ ١) الطلبات المفتوحة: البوابة والقائمة البيضاء ═════════════ */
test("vendor-demand: بلا جلسة صالحة أو بجلسة غير مفعّلة يُرفض، والمفعّل والمعتمد يمرّان", async () => {
  reset();
  eorRows = [await eorRow({}, { ref: "EOR-TEST-1" })];
  const o = await signup("Al Amal Recruitment", "a@office.example");

  assert.equal((await post({ type: "vendor-demand" })).status, 401);
  assert.equal((await post({ type: "vendor-demand", email: o.email, code: "BP-AG-WRONGCODE1" })).status, 401);
  assert.equal((await post({ type: "vendor-demand", email: "nobody@office.example", code: o.code })).status, 401);

  for (const st of ["قيد المراجعة", "موقوف", "مرفوض", ""]) {
    setStatus(o.id, st);
    const r = await post({ type: "vendor-demand", ...creds(o) });
    assert.equal(r.status, 403, `حالة «${st}»`);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.items, undefined);
  }
  for (const st of ["مفعّل", "معتمد"]) {
    setStatus(o.id, st);
    const r = await post({ type: "vendor-demand", ...creds(o) });
    assert.equal(r.status, 200, `حالة «${st}»`);
    assert.equal(r.json.ok, true);
    assert.ok(r.json.items.length >= 2);
  }
});

test("vendor-demand: لا اسم منشأة ولا تواصل ولا راتب ولا سعر ولا ملاحظات ولا عنوان في أي رد (قيم فريدة)", async () => {
  reset();
  eorRows = [await eorRow({}, { ref: "EOR-TEST-2" })];
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-demand", ...creds(o), lang: "ar" });
  assert.equal(r.status, 200);
  assertNoCanary(r.text, "vendor-demand");
  assert.equal(r.text.includes("ZZADDR2Y3"), false);
  assert.equal(r.text.includes("الملقا"), false);
  // الحقول القائمة البيضاء فقط + اسما العرض.
  const allowed = new Set([...E.VENDOR_ITEM_FIELDS, "sectorName", "nationalityNames"]);
  for (const it of r.json.items) for (const k of Object.keys(it)) assert.ok(allowed.has(k), `حقل غير مسموح: ${k}`);
  assert.deepEqual(Object.keys(r.json).sort(), ["items", "ok"]);
  const waiter = r.json.items.find((x) => x.occupationId === "hosp.waiter");
  assert.equal(waiter.count, 5);
  assert.deepEqual(waiter.nationalityNames, ["الهند", "باكستان"]);
  assert.equal(waiter.region, "السعودية");
  assert.ok(waiter.sectorName);
  for (const key of ["salary", "price", "quote", "company", "contactName", "email", "phone", "notes", "client"]) assert.equal(key in waiter, false, key);
  // الردّ لا يعيد بيانات المكتب نفسه (بريده/رمزه) ولا بيانات مكاتب أخرى.
  assert.equal(r.text.includes(o.code), false);
  assert.equal(r.text.includes(o.email), false);
});

test("vendor-demand: طلب مغلق أو غير مفتوح للمورّدين لا يخرج، والعرض بالإنجليزية يعمل", async () => {
  reset();
  eorRows = [await eorRow({}, { ref: "EOR-TEST-3", open: false }), await eorRow({}, { ref: "EOR-TEST-4", status: "مغلق" }), await eorRow({}, { ref: "EOR-TEST-5" })];
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-demand", ...creds(o), lang: "en" });
  assert.equal(r.status, 200);
  assert.deepEqual([...new Set(r.json.items.map((x) => x.ref))], ["EOR-TEST-5"]);
  assert.deepEqual(r.json.items.find((x) => x.occupationId === "hosp.waiter").nationalityNames, ["India", "Pakistan"]);
  assertNoCanary(r.text);
});

test("vendor-demand: تعذّر Notion يعطي خطأً عاماً بلا تفاصيل", async () => {
  reset();
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes("/databases/eordb/query") ? resp(500, "boom ZZSECRET") : prev(url, init));
  try {
    const r = await post({ type: "vendor-demand", ...creds(o) });
    assert.equal(r.status, 502);
    assert.deepEqual(r.json, { ok: false, error: "demand_unavailable" });
  } finally { globalThis.fetch = prev; }
});

/* ═════════════ ٢) مرشحوك: العزل والربط بالمعرّف ═════════════ */
test("vendor-add-candidate: يكتب صفّ ATS بمعرّف المكتب ووسم المصدر، ولا يعيد الوسم", async () => {
  reset();
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "hosp.waiter", experience: 4, salary: "2500" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.ok, true);
  assert.equal(S.SOURCE_TAG_RE.test(r.text), false);
  const row = atsRows()[0];
  assert.equal(textOf(row.properties["Candidate Name"]), "Ravi Kumar");
  assert.equal(textOf(row.properties["Nationality"]), "الهند");
  assert.equal(textOf(row.properties["مهنة الترشيح"]), "نادل");
  assert.equal(row.properties["Experience Years"].number, 4);
  assert.equal(row.properties["Expected Salary"].number, 2500);
  assert.equal(textOf(row.properties[S.OFFICE_ID_PROP]), o.id);
  assert.equal(row.properties[S.SOURCE_PROP].select.name, "vendor:office");
  assert.equal(textOf(row.properties["مكتب الاستقدام"]), "Al Amal Recruitment");
  assert.equal(pages.get(o.id).properties["عدد المرشحين"].number, 1);
});

test("vendor-add-candidate: التحقق من المدخلات", async () => {
  reset();
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const bad = async (over, err) => {
    const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل", ...over });
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.equal(r.json.error, err);
  };
  await bad({ name: "x" }, "invalid_fields");
  await bad({ role: "  " }, "invalid_fields");
  await bad({ experience: "abc" }, "invalid_experience");
  await bad({ experience: -1 }, "invalid_experience");
  await bad({ experience: 61 }, "invalid_experience");
  await bad({ salary: "abc" }, "invalid_salary");
  await bad({ salary: -5 }, "invalid_salary");
  await bad({ salary: 2000000 }, "invalid_salary");
  assert.equal(atsRows().length, 0);
  // اختياريان: الراتب والخبرة
  const ok = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "جنسية حرة", role: "عامل نظافة" });
  assert.equal(ok.status, 200, ok.text);
  const row = atsRows()[0];
  assert.equal("Expected Salary" in row.properties, false);
  assert.equal("Experience Years" in row.properties, false);
  assert.equal(textOf(row.properties["Nationality"]), "جنسية حرة");
});

test("vendor-add-candidate: غير المفعّل لا يكتب شيئاً", async () => {
  reset();
  const o = await signup("Al Amal Recruitment", "a@office.example");
  setStatus(o.id, "قيد المراجعة");
  const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل" });
  assert.equal(r.status, 403);
  assert.equal(atsRows().length, 0);
  assert.equal((await post({ type: "vendor-candidates", ...creds(o) })).status, 403);
});

test("vendor-candidates: كل مورّد يرى مرشّحيه وحدهم (بالمعرّف) ولو تطابق الاسم", async () => {
  reset();
  const a = await signup("Same Name Office", "a@office.example");
  const b = await signup("Same Name Office", "b@office.example");   // الاسم نفسه، معرّف مختلف
  const c = await signup("Third Office", "c@office.example");
  await post({ type: "vendor-add-candidate", ...creds(a), name: "Candidate Of A", nationality: "IN", role: "نادل" });
  await post({ type: "vendor-add-candidate", ...creds(b), name: "Candidate Of B", nationality: "PK", role: "نادل" });

  const la = await post({ type: "vendor-candidates", ...creds(a) });
  const lb = await post({ type: "vendor-candidates", ...creds(b) });
  const lc = await post({ type: "vendor-candidates", ...creds(c) });
  assert.deepEqual(la.json.candidates.map((x) => x.name), ["Candidate Of A"]);
  assert.deepEqual(lb.json.candidates.map((x) => x.name), ["Candidate Of B"]);
  assert.deepEqual(lc.json.candidates, []);
  // شكل الصف: حقول محدودة، لا تواصل ولا رابط سيرة ولا وسم مصدر ولا معرّف مكتب.
  assert.deepEqual(Object.keys(la.json.candidates[0]).sort(), ["id", "name", "nationality", "role", "stage", "submitted", "years"]);
  for (const r of [la, lb, lc]) { assert.equal(S.SOURCE_TAG_RE.test(r.text), false); assert.equal(r.text.includes(S.OFFICE_ID_PROP), false); assert.equal(r.text.includes(S.SOURCE_PROP), false); }
});

test("احتياط الصفوف القديمة: بالاسم فقط حين يكون الاسم فريداً في السجلّ، ولا يتخطى معرّفاً مخالفاً", async () => {
  reset();
  const a = await signup("Legacy Office", "a@office.example");
  const mkLegacy = (name, office, extra = {}) => {
    const id = "pg" + ++seq;
    pages.set(id, { id, db: "atsdb", created_time: "2026-09-01T00:00:00Z", properties: toRead({
      "Candidate Name": { title: [{ text: { content: name } }] },
      "مكتب الاستقدام": { select: { name: office } }, ...extra,
    }) });
  };
  mkLegacy("Old Row No Id", "Legacy Office");
  mkLegacy("Old Row Other Office", "Elsewhere Office");
  mkLegacy("Row With Other Id", "Legacy Office", { [S.OFFICE_ID_PROP]: { rich_text: [{ text: { content: "someone-else-id" } }] } });

  let l = await post({ type: "vendor-candidates", ...creds(a) });
  assert.deepEqual(l.json.candidates.map((x) => x.name), ["Old Row No Id"]);

  // اسم ثانٍ مطابق في السجلّ ⇒ الاسم لم يعد دليلاً: الصف القديم يختفي عن الاثنين.
  const dup = await signup("Legacy Office", "dup@office.example");
  l = await post({ type: "vendor-candidates", ...creds(a) });
  assert.deepEqual(l.json.candidates, []);
  l = await post({ type: "vendor-candidates", ...creds(dup) });
  assert.deepEqual(l.json.candidates, []);

  // الدالة الصرفة
  const ag = { id: "abc-123", name: "Legacy Office" };
  assert.equal(rowOwnedBy({ [S.OFFICE_ID_PROP]: { type: "rich_text", rich_text: [{ plain_text: "ABC123" }] } }, ag, false), true, "المعرّف يُقارن بلا شرطات/حالة");
  assert.equal(rowOwnedBy({ [S.OFFICE_ID_PROP]: { type: "rich_text", rich_text: [{ plain_text: "zzz" }] }, "مكتب الاستقدام": { type: "select", select: { name: "Legacy Office" } } }, ag, true), false);
  assert.equal(rowOwnedBy({ "مكتب الاستقدام": { type: "select", select: { name: "Legacy Office" } } }, ag, false), false);
  assert.equal(rowOwnedBy({ "مكتب الاستقدام": { type: "select", select: { name: "Legacy Office" } } }, ag, true), true);
  assert.equal(rowOwnedBy({}, ag, true), false);
});

test("المسارات القديمة (submissions / interview) تتبع المعرّف أيضاً، وجدولة مقابلة مرشّح مكتب آخر ممنوعة", async () => {
  reset();
  const a = await signup("Same Name Office", "a@office.example");
  const b = await signup("Same Name Office", "b@office.example");
  await post({ type: "vendor-add-candidate", ...creds(a), name: "Candidate Of A", nationality: "IN", role: "نادل" });
  const rowA = atsRows()[0];

  const get = async (action, o) => {
    const req = { method: "GET", url: `/api/agencies?action=${action}&email=${encodeURIComponent(o.email)}&code=${o.code}`, body: undefined };
    const res = { headers: {}, statusCode: 200, setHeader() {}, end(x) { this.body = x; } };
    await handleAgencies(req, res);
    return JSON.parse(res.body);
  };
  assert.deepEqual((await get("submissions", a)).submissions.map((x) => x.name), ["Candidate Of A"]);
  assert.deepEqual((await get("submissions", b)).submissions, []);

  const sched = (o) => post({ type: "interview-schedule", ...creds(o), candidateId: rowA.id, date: "2026-11-01", time: "10:00" });
  assert.equal((await sched(b)).status, 403);
  assert.equal((await sched(a)).status, 200);
});

test("تطابق بريد مع مرشّح مكتب آخر: لا يُعاد كتابته ولا يُنسب للمكتب الجديد", async () => {
  reset();
  const a = await signup("Office A", "a@office.example");
  const b = await signup("Office B", "b@office.example");
  const first = await post({ type: "submit-candidate", ...creds(a), candidateName: "Shared Person", role: "نادل", candidateEmail: "shared@person.example" });
  assert.equal(first.status, 200, first.text);
  const before = JSON.stringify(atsRows()[0].properties);
  const second = await post({ type: "submit-candidate", ...creds(b), candidateName: "Shared Person", role: "طباخ", candidateEmail: "shared@person.example" });
  assert.equal(second.status, 200, second.text);
  assert.equal(second.json.duplicate, true);
  assert.equal(JSON.stringify(atsRows()[0].properties), before);
  assert.equal(atsRows().length, 1);
});

/* ═════════════ ٣) وسم المصدر ═════════════ */
test("وسم المصدر يتبع نوع الجهة: مستقل ← vendor:freelancer · منصة ← platform:<اسمها> · غير ذلك ← vendor:office", async () => {
  reset();
  const f = await signup("Free Lancer", "f@x.example");
  const p = await signup("Gulf Talent Board", "p@x.example");
  setProp(f.id, "نوع الجهة", { type: "select", select: { name: "مستقل" } });
  setProp(p.id, "نوع الجهة", { type: "select", select: { name: "منصة" } });
  await post({ type: "vendor-add-candidate", ...creds(f), name: "Cand F", nationality: "IN", role: "نادل" });
  await post({ type: "vendor-add-candidate", ...creds(p), name: "Cand P", nationality: "IN", role: "نادل" });
  const tag = (name) => atsRows().find((r) => textOf(r.properties["Candidate Name"]) === name).properties[S.SOURCE_PROP].select.name;
  assert.equal(tag("Cand F"), "vendor:freelancer");
  assert.equal(tag("Cand P"), "platform:gulf-talent-board");
});

test("save-profile يقبل نوعَي «مستقل» و«منصة» الجديدين ولا يقبل غيرهما", async () => {
  reset();
  const o = await signup("Kind Office", "k@x.example");
  const save = (kind) => post({ type: "save-profile", ...creds(o), kind });
  assert.equal((await save("مستقل")).json.agency.kind, "مستقل");
  assert.equal((await save("منصة")).json.agency.kind, "منصة");
  assert.equal((await save("شيء آخر")).json.agency.kind, "منصة", "قيمة مجهولة لا تغيّر النوع");
});

test("_sources.js: تصنيف مغلق، المجهول يعود فارغاً، والمنصة تُنظَّف", () => {
  for (const ok of ["vendor:office", "vendor:freelancer", "site", "linkedin", "indeed", "email", "platform:bayt", "platform:gulf-talent"]) assert.equal(S.isSource(ok), true, ok);
  for (const bad of ["", "vendor", "vendor:agency", "Platform:", "platform:", "platform:a b", "platform:../x", "facebook", null, undefined, "platform:" + "x".repeat(41)]) assert.equal(S.isSource(bad), false, String(bad));
  assert.equal(S.normalizeSource(" LinkedIn "), "linkedin");
  assert.equal(S.normalizeSource("Platform:Bayt"), "platform:bayt");
  assert.equal(S.normalizeSource("unknown"), "");
  assert.equal(S.platformSource("Gulf Talent!"), "platform:gulf-talent");
  assert.equal(S.platformSource("!!!"), "");
  assert.equal(S.sourceProp("indeed").select.name, "indeed");
  assert.equal(S.sourceProp("nope"), null);
  assert.equal(S.sourceForVendor({ kind: "مكتب استقدام", name: "A" }), "vendor:office");
  assert.equal(S.sourceForVendor({ kind: "", name: "A" }), "vendor:office");
  assert.equal(S.sourceForVendor({ kind: "منصة", name: "!!!" }), "vendor:office");
  const stripped = S.stripInternalSource({ [S.SOURCE_PROP]: 1, [S.OFFICE_ID_PROP]: 2, keep: 3 });
  assert.deepEqual(Object.keys(stripped), ["keep"]);
  assert.equal(S.SOURCE_TAG_RE.test("منصة platform:bayt هنا"), true);
  assert.equal(S.SOURCE_TAG_RE.test("a plain sentence about vendors"), false);
});

test("حارس الأعمدة الداخلية: لا ملف واجهة لأصحاب العمل أو المرشحين يذكر عمود الوسم أو معرّف المكتب", () => {
  // ملفات recruitment-employer / recruitment-candidate تبني ناتجها حقلاً حقلاً؛ فمجرّد ذكر اسم العمود فيها يعني أن أحداً بدأ يقرؤه.
  const files = ["api/candidates.js", "api/employer.js", "api/hire.js", "api/candidate.js", "api/_jobhunt.js", "api/requests.js", "api/workspace.js", "api/_eor.js"];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const col of S.INTERNAL_SOURCE_PROPS) assert.equal(src.includes(col), false, `${f} يذكر العمود الداخلي «${col}»`);
    assert.equal(/_sources\.js/.test(src), false, `${f} يستورد _sources.js`);
  }
  // وصفحات الموقع المولَّدة/المصدرية لا تحمل الوسم.
  for (const f of ["site/scripts/simple-v1-employer.mjs", "site/scripts/simple-v1-hiring.mjs", "site/scripts/simple-v1-vendor.mjs"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const col of S.INTERNAL_SOURCE_PROPS) assert.equal(src.includes(col), false, `${f} يذكر «${col}»`);
  }
});

/* ═════════════ ٤) السيرة PDF ═════════════ */
test("السيرة: ترفض غير PDF وغير المشفّر والكبير، وتقبل PDF صالحاً وتحفظه على الصفحة حين لا يأخذه n8n", async () => {
  reset();
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const base = { type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل" };
  const notPdf = await post({ ...base, cvFile: { name: "cv.pdf", type: "application/pdf", base64: Buffer.from("<html>not a pdf</html>").toString("base64") } });
  assert.equal(notPdf.status, 400); assert.equal(notPdf.json.error, "cv_not_pdf");
  const junk = await post({ ...base, cvFile: { name: "cv.pdf", base64: "***not base64***" } });
  assert.equal(junk.status, 400); assert.equal(junk.json.error, "invalid_cv");
  const big = await post({ ...base, cvFile: { name: "cv.pdf", base64: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(3 * 1024 * 1024 + 10, 65)]).toString("base64") } });
  assert.equal(big.status, 400); assert.equal(big.json.error, "cv_too_large");
  assert.equal(atsRows().length, 0);

  const ok = await post({ ...base, cvFile: { name: "../..\\evil/name.PDF", type: "text/plain", base64: PDF_B64 } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.cvStored, true);
  assert.equal(uploads.length, 1);
  assert.equal(blocksPatched.length, 1);
  assert.equal(blocksPatched[0].id, atsRows()[0].id);
  assert.equal(blocksPatched[0].body.children[0].type, "pdf");
});

test("السيرة: n8n متعطّل لا يُضيع المرشّح ولا السيرة", async () => {
  reset(); n8nMode = "down";
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل", cvFile: { name: "cv.pdf", base64: PDF_B64 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.cvStored, true);
  assert.equal(atsRows().length, 1);
});

test("بلا سيرة: cvStored يعود null ولا رفع", async () => {
  reset();
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل" });
  assert.equal(r.json.cvStored, null);
  assert.equal(uploads.length, 0);
});

/* ═════════════ ٥) غياب العمودين الجديدين في Notion ═════════════ */
test("العمودان غير موجودين بعد: المرشّح يُحفظ بلا الوسم والمعرّف، والقراءة تعمل بالاسم الفريد", async () => {
  reset(); cols.id = false; cols.source = false;
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل" });
  assert.equal(r.status, 200, r.text);
  const row = atsRows()[0];
  assert.equal(S.OFFICE_ID_PROP in row.properties, false);
  assert.equal(S.SOURCE_PROP in row.properties, false);
  assert.equal(textOf(row.properties["Candidate Name"]), "Ravi Kumar");
  const l = await post({ type: "vendor-candidates", ...creds(o) });
  assert.equal(l.status, 200, l.text);
  assert.deepEqual(l.json.candidates.map((x) => x.name), ["Ravi Kumar"]);
  // ... وإذا صار الاسم غير فريد، لا يرى أحدٌ صفّاً بلا معرّف.
  await signup("Al Amal Recruitment", "other@office.example");
  assert.deepEqual((await post({ type: "vendor-candidates", ...creds(o) })).json.candidates, []);
});

test("عمود واحد فقط موجود: يُكتب الموجود ويُسقط الناقص", async () => {
  reset(); cols.source = false;
  const o = await signup("Al Amal Recruitment", "a@office.example");
  const r = await post({ type: "vendor-add-candidate", ...creds(o), name: "Ravi Kumar", nationality: "IN", role: "نادل" });
  assert.equal(r.status, 200, r.text);
  const row = atsRows()[0];
  assert.equal(textOf(row.properties[S.OFFICE_ID_PROP]), o.id);
  assert.equal(S.SOURCE_PROP in row.properties, false);
});

/* ═════════════ ٦) حدود المعمارية ═════════════ */
test("لا دالة API جديدة: _agencies.js و_sources.js ملفان مساعدان، والسقف ١٢", () => {
  const fns = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  assert.ok(fns.length <= 12, `الدوال ${fns.length}`);
  assert.ok(!fns.includes("vendor.js"));
  assert.ok(fs.existsSync(path.join(ROOT, "api/_sources.js")));
});

test("قاعدة المكاتب لا تُخلط: رمز مكتب لا يفتح مسارات المورّد بلا بريده", async () => {
  reset();
  const a = await signup("Office A", "a@office.example");
  const b = await signup("Office B", "b@office.example");
  assert.equal((await post({ type: "vendor-candidates", email: b.email, code: a.code })).status, 401);
  assert.equal((await post({ type: "vendor-demand", email: a.email, code: b.code })).status, 401);
});
