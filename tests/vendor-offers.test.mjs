// بوابة المورّدين /vendor (الشريحة ٢): المورّد المؤسسي وعروضه على الطلبات المجهولة — api/_agencies.js + api/_vendor-offers.js
// مقابل Notion وهمي في الذاكرة. بلا شبكة. لا كتابة على أي قاعدة حيّة.
//
// ما يُثبته هذا الملف:
//   ١) المؤسسي لا يُفعَّل بالتسجيل: «قيد المراجعة» ولا يرى طلباً ولا عرضاً ولا مسارات المكاتب القديمة حتى يضع المالك «معتمد».
//   ٢) عزل بالمعرّف: عرض مورّد لا يقرؤه ولا يسحبه غيره ولو تطابق الاسم؛ والمعرّف يُحمَل في الصفّ لا الاسم.
//   ٣) ما يخرج للمورّد قائمة بيضاء: لا ملاحظة مالك ولا مكتب محدَّد ولا رسمه ولا سعر بيع ولا عروض غيره ولا اسم العميل (canaries بقيم فريدة).
//   ٤) يفشل مغلقاً بلا VENDOR_OFFERS_DB: لا قراءة ولا كتابة لتلك القاعدة.
//   ٥) حدود الأرقام، وعرض فعّال واحد لكل (مورّد، بند)، وحالات العرض.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-offers-test-"));
process.env.NOTION_TOKEN = "test-notion";
process.env.RESEND_API_KEY = "test-resend";
process.env.OTP_SECRET = "test-otp-secret";
process.env.PANEL_KEY = "test-owner-key";
process.env.NOTION_AGENCIES_DB = "agdb";
process.env.NOTION_AGENCY_REQUESTS_DB = "rqdb";
process.env.NOTION_ATS_DB = "atsdb";
process.env.NOTION_EOR_DB = "eordb";
const OFFERS = "0123456789abcdef0123456789abcdef";
process.env.VENDOR_OFFERS_DB = OFFERS;
delete process.env.GOOGLE_CLIENT_ID;

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const E = await import("../api/_eor.js");
const S = await import("../api/_sources.js");
const O = await import("../api/_vendor-offers.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) });

/* ───────────── Notion وهمي ───────────── */
const pages = new Map();   // id -> { id, db, parent, properties(read shape), created_time }
const mails = [];
const calls = [];          // كل نداء Notion: { method, path, db }
let seq = 0;
let eorRows = [];
let failOffers = false;    // يجعل كل نداء لقاعدة العروض يفشل

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
  : p.type === "select" ? (p.select ? p.select.name : "") : p.type === "email" ? (p.email || "") : p.type === "number" ? String(p.number) : "";
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
const newId = () => (++seq).toString(16).padStart(32, "0");
const stamp = () => new Date(Date.UTC(2026, 9, 8, 10, 0, seq)).toISOString();

const fakeFetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
  const method = init.method || "GET";
  if (u.startsWith("https://api.resend.com/emails")) { mails.push(body); return resp(200, { id: "m" }); }
  if (u.includes("n8n.cloud") || /webhook/.test(u)) return resp(200, {});
  if (!u.startsWith("https://api.notion.com/v1/")) throw new Error("unexpected fetch " + u);
  const p = u.slice("https://api.notion.com/v1/".length);
  let m;
  const note = (db) => calls.push({ method, path: p, db });
  if ((m = p.match(/^databases\/([^/]+)\/query$/))) {
    note(m[1]);
    if (m[1] === OFFERS && failOffers) return resp(500, "boom ZZSECRET");
    if (m[1] === "eordb") return resp(200, { results: eorRows.map((r) => r.page), has_more: false, next_cursor: null });
    const results = [...pages.values()].filter((x) => x.db === m[1] && matches(x, body && body.filter));
    return resp(200, { results: results.slice(0, (body && body.page_size) || 100), has_more: false });
  }
  if ((m = p.match(/^blocks\/([^/?]+)\/children/))) {
    const row = eorRows.find((r) => r.page.id === decodeURIComponent(m[1]));
    return resp(200, { results: ((row && row.children) || []).map((b) => ({ type: b.type, code: b.code })) });
  }
  if (p === "pages" && method === "POST") {
    const db = body.parent.database_id;
    note(db);
    if (db === OFFERS && failOffers) return resp(500, "boom ZZSECRET");
    const id = newId();
    const pg = { id, db, parent: { type: "database_id", database_id: db }, properties: toRead(body.properties), created_time: stamp(), url: "https://notion.so/" + id };
    pages.set(id, pg);
    return resp(200, pg);
  }
  if ((m = p.match(/^pages\/([^/]+)$/))) {
    const pg = pages.get(decodeURIComponent(m[1]));
    note(pg ? pg.db : "?");
    if (!pg) return resp(404, {});
    if (pg.db === OFFERS && failOffers) return resp(500, "boom ZZSECRET");
    if (method === "PATCH") Object.assign(pg.properties, toRead(body.properties));
    return resp(200, pg);
  }
  return resp(404, {});
};
globalThis.fetch = fakeFetch;

const { handleAgencies, _resetVendorDemandCache } = await import("../api/_agencies.js");

async function post(payload) {
  const req = { method: "POST", url: "/api/agencies", body: payload };
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  await handleAgencies(req, res);
  return { status: res.statusCode, text: res.body, json: JSON.parse(res.body) };
}
async function get(query) {
  const req = { method: "GET", url: "/api/agencies?" + query, body: undefined };
  const res = { headers: {}, statusCode: 200, setHeader() {}, end(x) { this.body = x; } };
  await handleAgencies(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}
function reset() {
  pages.clear(); mails.length = 0; calls.length = 0; seq = 0; eorRows = []; failOffers = false;
  process.env.VENDOR_OFFERS_DB = OFFERS;
  _resetVendorDemandCache();
}
const KIND = S.CORPORATE_KIND;
async function signup(name, email, extra = {}) {
  const r = await post({ type: "signup", name, email, password: "correct-horse-battery", ...extra });
  assert.equal(r.status, 200, r.text);
  return { id: r.json.agency.id, email, code: r.json.code, name, json: r.json };
}
const approve = async (o, decision = "معتمد") => {
  const r = await post({ type: "approve", key: "test-owner-key", id: o.id, decision });
  assert.equal(r.status, 200, r.text);
};
async function corp(name, email) { const o = await signup(name, email, { kind: KIND }); await approve(o); return o; }
const creds = (o) => ({ email: o.email, code: o.code });
const setProp = (id, prop, value) => { pages.get(id).properties[prop] = value; };
const offerRows = () => [...pages.values()].filter((x) => x.db === OFFERS);
const offersWrites = () => calls.filter((c) => c.db === OFFERS);
const P = O.OFFER_PROPS;

/* ───────────── طلبات EOR بقيم فريدة (كما في vendor-portal.test.mjs) ───────────── */
const NOW = Date.parse("2026-10-08T09:00:00Z");
const CANARY = { company: "ZZCOMPANY7Q1", contact: "ZZCONTACT8W2", email: "zzmail3k@canary.example", phone: "0559876543", notes: "ZZNOTES4R5", salary: 7771.25, quote: "ZZQUOTE9T6" };
const OWNER = { ownerNote: "ZZOWNERNOTE5K", designated: "ZZDESIGNATED6M", sale: "ZZSALE4242", awarded: 77881, margin: "ZZMARGIN31" };
const assertNone = (value, list, label = "") => {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  for (const c of list) assert.equal(s.includes(String(c)), false, `${label} تسرّب: ${c}`);
};
const CLIENT_CANARIES = [CANARY.company, CANARY.contact, CANARY.email, "canary.example", CANARY.phone.slice(1), CANARY.notes, "7771", CANARY.quote];
function plainOf(prop) {
  if (prop.title) return { title: prop.title.map((x) => ({ plain_text: x.text.content })) };
  if (prop.rich_text) return { rich_text: prop.rich_text.map((x) => ({ plain_text: x.text.content })) };
  return prop;
}
async function eorRow(ref, { open = true, status = "جديد" } = {}) {
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
    startDate: "2026-11-01", durationMonths: 12, notes: CANARY.notes, lang: "ar",
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
const ITEM1 = "EOR-TEST-1-1", ITEM2 = "EOR-TEST-1-2";
async function withDemand() { eorRows = [await eorRow("EOR-TEST-1")]; }
const offer = (o, over = {}) => post({ type: "vendor-offer-submit", ...creds(o), itemId: ITEM1, price: 2450.5, available: 12, prepDays: 21, note: "جاهزون", ...over });
const mine = (o) => post({ type: "vendor-my-offers", ...creds(o) });

/* ═════════════ ١) التسجيل والاعتماد ═════════════ */
test("المؤسسي: التسجيل «قيد المراجعة» ولا يرى شيئاً حتى يعتمده المالك", async () => {
  reset(); await withDemand();
  const c = await signup("Mahara Test Co", "c@corp.example", { kind: KIND });
  assert.equal(pages.get(c.id).properties["الحالة"].select.name, "قيد المراجعة");
  assert.equal(pages.get(c.id).properties["نوع الجهة"].select.name, KIND);
  assert.ok(mails.some((m) => /بانتظار الاعتماد/.test(m.subject)), "المالك يُنبَّه");

  // يدخل (كلمة المرور ثم الرمز) ليصل إلى لوحة «بانتظار الاعتماد» ... لكن لا شيء غير ذلك.
  const login = await post({ type: "login", email: c.email, password: "correct-horse-battery" });
  assert.equal(login.status, 200, login.text);
  assert.equal((await post({ type: "login", email: c.email, code: c.code })).status, 200);

  const me = await post({ type: "vendor-me", ...creds(c) });
  assert.equal(me.status, 200);
  assert.deepEqual(me.json, { ok: true, name: "Mahara Test Co", kind: "corporate", active: false });
  assert.equal(me.text.includes(c.code), false);
  assert.equal(me.text.includes(c.email), false);

  for (const type of ["vendor-demand", "vendor-candidates", "vendor-add-candidate", "vendor-my-offers", "vendor-offer-submit", "vendor-offer-withdraw"]) {
    const r = await post({ type, ...creds(c), name: "Ravi Kumar", nationality: "IN", role: "نادل", itemId: ITEM1, price: 100, available: 1, prepDays: 1, offerId: OFFERS });
    assert.equal(r.status, 403, type);
    assert.equal(r.json.error, "pending_approval", type);
    assert.equal(r.json.items, undefined);
  }
  // مسارات المكاتب القديمة (لوحة الوظائف بأسماء الشركات، صندوق المقابلات) مغلقة على المؤسسي مطلقاً.
  assert.equal((await get(`action=requests&email=${c.email}&code=${c.code}`)).status, 403);
  assert.equal((await post({ type: "submit-candidate", ...creds(c), candidateName: "Ravi", role: "نادل" })).status, 403);
  assert.equal(offersWrites().length, 0);
  assert.equal(offerRows().length, 0);

  // «مفعّل» وحده لا يكفي للمؤسسي — المطلوب «معتمد».
  await approve(c, "مفعّل");
  assert.equal((await post({ type: "vendor-me", ...creds(c) })).json.active, false);
  assert.equal((await post({ type: "vendor-demand", ...creds(c) })).status, 403);

  await approve(c, "معتمد");
  assert.equal((await post({ type: "vendor-me", ...creds(c) })).json.active, true);
  const d = await post({ type: "vendor-demand", ...creds(c) });
  assert.equal(d.status, 200, d.text);
  assert.ok(d.json.items.length >= 2);
  assert.ok(mails.some((m) => /اعتماد شركتكم/.test(m.subject)), "بريد اعتماد المؤسسي");
});

test("المؤسسي المعتمد: لا يصل إلى مسارات المكاتب القديمة ولا يتلقى بريد الطلبات العامة", async () => {
  reset();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const o = await signup("Al Amal Recruitment", "o@office.example");
  for (const r of [await get(`action=requests&email=${c.email}&code=${c.code}`), await get(`action=submissions&email=${c.email}&code=${c.code}`), await get(`action=interview-requests&email=${c.email}&code=${c.code}`)]) {
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "not_office");
  }
  for (const body of [{ type: "submit-candidate", candidateName: "x y", role: "نادل" }, { type: "bulk-import", rows: [{ name: "x y", role: "نادل" }] }, { type: "interview-schedule", candidateId: "a".repeat(32), date: "2026-11-01" }]) {
    const r = await post({ ...body, ...creds(c) });
    assert.equal(r.status, 403, body.type);
    assert.equal(r.json.error, "not_office");
  }
  // المكتب العادي ما زال يمرّ.
  assert.equal((await get(`action=requests&email=${o.email}&code=${o.code}`)).status, 200);

  // طلب مفتوح للشبكة يصل بريده للمكتب لا للمؤسسي.
  mails.length = 0;
  const cr = await post({ type: "create-request", key: "test-owner-key", title: "طلب تجريبي", profession: "نادل", count: 3 });
  assert.equal(cr.status, 200, cr.text);
  const to = mails.flatMap((m) => m.to || []);
  assert.ok(to.includes(o.email), "المكتب يُبلَّغ");
  assert.equal(to.includes(c.email), false, "المؤسسي لا يُبلَّغ");
});

test("المكتب لا يستطيع أن يصير مؤسسياً من ملفه، والمؤسسي لا يغيّر نوعه — النوع قرار المالك", async () => {
  reset();
  const o = await signup("Verified Office", "o@office.example");
  await approve(o);
  const r = await post({ type: "save-profile", ...creds(o), kind: KIND, about: "x" });
  assert.equal(r.status, 200, r.text);
  assert.notEqual(r.json.agency.kind, KIND);
  assert.equal((await offer(o)).status, 403);
  assert.equal((await offer(o)).json.error, "not_corporate");
  for (const type of ["vendor-my-offers", "vendor-offer-withdraw"]) assert.equal((await post({ type, ...creds(o), offerId: OFFERS })).json.error, "not_corporate");

  const c = await corp("Mahara Test Co", "c@corp.example");
  const s = await post({ type: "save-profile", ...creds(c), kind: "مكتب استقدام", about: "x" });
  assert.equal(s.status, 200, s.text);
  assert.equal(s.json.agency.kind, KIND);
  assert.equal(offersWrites().length, 0);
});

test("المؤسسي المعلَّق يحفظ ملفه ويبقى معلَّقاً", async () => {
  reset();
  const c = await signup("Mahara Test Co", "c@corp.example", { kind: KIND });
  const r = await post({ type: "save-profile", ...creds(c), about: "شركة قوى عاملة", city: "الرياض" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.agency.kind, KIND);
  assert.equal(pages.get(c.id).properties["الحالة"].select.name, "قيد المراجعة");
});

test("vendor-me: مكتب ومستقل ومنصة بنوعها، والموقوف يُرفض", async () => {
  reset();
  const o = await signup("Office", "o@x.example");
  const f = await signup("Free", "f@x.example", { kind: "مستقل" });
  const p = await signup("Board", "p@x.example", { kind: "منصة" });
  assert.deepEqual(await Promise.all([o, f, p].map(async (v) => { const r = await post({ type: "vendor-me", ...creds(v) }); return [r.json.kind, r.json.active]; })),
    [["office", true], ["freelancer", true], ["platform", true]]);
  await approve(o, "موقوف");
  assert.equal((await post({ type: "vendor-me", ...creds(o) })).status, 403);
  assert.equal((await post({ type: "vendor-me", email: o.email, code: "BP-AG-WRONG" })).status, 401);
  assert.equal((await post({ type: "vendor-me" })).status, 401);
});

/* ═════════════ ٢) تقديم العرض والاستبدال ═════════════ */
test("تقديم عرض: يُكتب بمعرّف المكتب لا اسمه، وعرض واحد فعّال لكل بند والتحديث يستبدله", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const r = await offer(c);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.replaced, false);
  assert.deepEqual(Object.keys(r.json.offer).sort(), [...O.VENDOR_OFFER_FIELDS].sort());
  assert.equal(r.json.offer.price, 2450.5);
  assert.equal(r.json.offer.available, 12);
  assert.equal(r.json.offer.prepDays, 21);
  assert.equal(r.json.offer.note, "جاهزون");
  assert.equal(r.json.offer.status, "submitted");
  assert.equal(r.json.offer.itemId, ITEM1);
  assert.equal(r.json.offer.ref, "EOR-TEST-1");
  assert.equal(r.json.offer.nameAr, "نادل");
  assert.equal(r.json.offer.count, 5);

  const rows = offerRows();
  assert.equal(rows.length, 1);
  const p = rows[0].properties;
  assert.equal(textOf(p[P.office]), c.id);
  assert.equal(textOf(p[P.item]), ITEM1);
  assert.equal(textOf(p[P.ref]), "EOR-TEST-1");
  assert.equal(textOf(p[P.occupationId]), "hosp.waiter");
  assert.equal(p[P.price].number, 2450.5);
  assert.equal(p[P.status].select.name, O.OFFER_STATUS.submitted);
  // الصفّ لا يحمل اسم المورّد ولا بريده ولا رمزه، ولا شيئاً من العميل.
  const raw = JSON.stringify(rows[0].properties);
  assertNone(raw, ["Mahara", c.email, c.code, ...CLIENT_CANARIES], "صف العرض");

  // التحديث يستبدل: صفّ واحد، قيم جديدة، replaced=true.
  const u = await offer(c, { price: "2,300", available: 8, prepDays: 14, note: "" });
  assert.equal(u.status, 200, u.text);
  assert.equal(u.json.replaced, true);
  assert.equal(offerRows().length, 1);
  assert.equal(offerRows()[0].properties[P.price].number, 2300);
  assert.equal(textOf(offerRows()[0].properties[P.note]), "");
  assert.equal(u.json.offer.id, r.json.offer.id);

  // بند آخر ⇒ صفّ آخر.
  assert.equal((await offer(c, { itemId: ITEM2 })).status, 200);
  assert.equal(offerRows().length, 2);
  const l = await mine(c);
  assert.deepEqual(l.json.offers.map((x) => x.itemId).sort(), [ITEM1, ITEM2]);
});

test("المورّد لا يضع الحالة ولا حقول المالك من جسم الطلب", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const r = await offer(c, { status: "مرسّى", الحالة: "مرسّى", awardedCount: 99, ownerNote: OWNER.ownerNote, designatedOffice: OWNER.designated, feePayer: "BP", [P.ownerNote]: OWNER.ownerNote, [P.designatedOffice]: OWNER.designated });
  assert.equal(r.status, 200, r.text);
  const p = offerRows()[0].properties;
  assert.equal(p[P.status].select.name, O.OFFER_STATUS.submitted);
  for (const k of [P.awardedCount, P.ownerNote, P.designatedOffice, P.feePayer]) assert.equal(k in p, false, k);
  assertNone(JSON.stringify(p), [OWNER.ownerNote, OWNER.designated]);
});

test("إشعار المالك بالعرض: يُهرَّب نصّ الملاحظة ويُرسَل للفريق وحده", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  mails.length = 0;
  await offer(c, { note: "<script>alert(1)</script> ZZNOTEHTML" });
  const m = mails.find((x) => /عرض جديد/.test(x.subject));
  assert.ok(m, "بريد العرض");
  assert.equal(m.html.includes("<script>"), false);
  assert.ok(m.html.includes("&lt;script&gt;"));
  assert.deepEqual(m.to, ["business@businesspartner.sa"]);
  await offer(c, { price: 2000 });
  assert.ok(mails.some((x) => /عرض محدَّث/.test(x.subject)));
});

/* ═════════════ ٣) العزل ═════════════ */
test("عزل بالمعرّف: كل مورّد يرى عروضه وحده ولو تطابق الاسم، ولا يسحب عرض غيره", async () => {
  reset(); await withDemand();
  const a = await corp("Same Name Corp", "a@corp.example");
  const b = await corp("Same Name Corp", "b@corp.example");   // الاسم نفسه، معرّف مختلف
  const z = await corp("Third Corp", "z@corp.example");
  const ra = await offer(a, { price: 1111.11, note: "ZZNOTE-A" });
  const rb = await offer(b, { price: 2222.22, note: "ZZNOTE-B" });
  assert.equal(offerRows().length, 2);

  const la = await mine(a), lb = await mine(b), lz = await mine(z);
  assert.deepEqual(la.json.offers.map((x) => x.price), [1111.11]);
  assert.deepEqual(lb.json.offers.map((x) => x.price), [2222.22]);
  assert.deepEqual(lz.json.offers, []);
  // لا يظهر لمورّد شيء من عرض غيره: لا سعره ولا ملاحظته ولا معرّف صفّه.
  assertNone(la.text, ["2222.22", "ZZNOTE-B", rb.json.offer.id, b.id, "b@corp.example"], "عروض A");
  assertNone(lb.text, ["1111.11", "ZZNOTE-A", ra.json.offer.id, a.id, "a@corp.example"], "عروض B");
  assertNone(ra.text, ["2222.22", "ZZNOTE-B", rb.json.offer.id, b.id], "رد تقديم A");

  // B لا يسحب عرض A: 404 بلا تمييز، والصف سليم.
  const before = JSON.stringify(pages.get(ra.json.offer.id).properties);
  const w = await post({ type: "vendor-offer-withdraw", ...creds(b), offerId: ra.json.offer.id });
  assert.equal(w.status, 404);
  assert.equal(w.json.error, "not_found");
  assert.equal(JSON.stringify(pages.get(ra.json.offer.id).properties), before);
  // ولا يستبدل عرض A بتقديمه: لكلٍّ صفّه.
  await offer(b, { price: 3333.33 });
  assert.equal(offerRows().length, 2);
  assert.equal(pages.get(ra.json.offer.id).properties[P.price].number, 1111.11);

  // رمز مكتب لا يفتح مسار آخر بلا بريده.
  assert.equal((await post({ type: "vendor-my-offers", email: b.email, code: a.code })).status, 401);
  assert.equal((await post({ type: "vendor-offer-submit", email: a.email, code: b.code, itemId: ITEM1, price: 1, available: 1, prepDays: 0 })).status, 401);
});

test("السحب: صفحة من قاعدة أخرى (حتى لو تحمل معرّف المكتب) أو معرّف مخرّب لا يُمسّان", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  // صفحة مرشّح في ATS تحمل معرّف المكتب نفسه — يجب ألا تُسحب كأنها عرض.
  const atsId = newId();
  pages.set(atsId, { id: atsId, db: "atsdb", parent: { type: "database_id", database_id: "atsdb" }, created_time: stamp(), properties: toRead({
    "Candidate Name": { title: [{ text: { content: "Some Candidate" } }] },
    [S.OFFICE_ID_PROP]: { rich_text: [{ text: { content: c.id } }] },
    [P.status]: { select: { name: O.OFFER_STATUS.submitted } },
  }) });
  const before = JSON.stringify(pages.get(atsId).properties);
  const r = await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: atsId });
  assert.equal(r.status, 404);
  assert.equal(JSON.stringify(pages.get(atsId).properties), before);

  for (const bad of ["", "../../x", "a/b", "zz", "1".repeat(100), null, { a: 1 }, ["x"]]) {
    const x = await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: bad });
    assert.equal(x.status, 400, JSON.stringify(bad));
    assert.equal(x.json.error, "invalid_offer");
  }
  assert.equal((await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: "f".repeat(32) })).status, 404);
  assert.equal(offersWrites().filter((x) => x.method !== "GET").length, 0);
});

/* ═════════════ ٤) ما يخرج للمورّد ═════════════ */
test("canaries: لا حقل داخلي ولا عرض مورّد آخر ولا اسم العميل في أي رد للمورّد", async () => {
  reset(); await withDemand();
  const a = await corp("Corp A", "a@corp.example");
  const b = await corp("Corp B", "b@corp.example");
  const ra = await offer(a);
  const rb = await offer(b, { price: 4242.42, note: "ZZOTHERVENDORNOTE" });
  // المالك يملأ أعمدته على صفّ A لاحقاً (إرساء/مكتب محدَّد/رسمه/ملاحظة/سعر بيع/هامش).
  const rowA = pages.get(ra.json.offer.id);
  rowA.properties[P.ownerNote] = { type: "rich_text", rich_text: [{ plain_text: OWNER.ownerNote }] };
  rowA.properties[P.designatedOffice] = { type: "rich_text", rich_text: [{ plain_text: OWNER.designated }] };
  rowA.properties[P.feePayer] = { type: "select", select: { name: "BP" } };
  rowA.properties[P.awardedCount] = { type: "number", number: OWNER.awarded };
  rowA.properties["سعر البيع"] = { type: "rich_text", rich_text: [{ plain_text: OWNER.sale }] };
  rowA.properties["الهامش"] = { type: "rich_text", rich_text: [{ plain_text: OWNER.margin }] };
  rowA.properties["العميل"] = { type: "rich_text", rich_text: [{ plain_text: CANARY.company }] };

  const outs = [
    ["demand", await post({ type: "vendor-demand", ...creds(a) })],
    ["my-offers", await mine(a)],
    ["submit", await offer(a, { price: 2500 })],
    ["me", await post({ type: "vendor-me", ...creds(a) })],
  ];
  const forbidden = [...CLIENT_CANARIES, OWNER.ownerNote, OWNER.designated, OWNER.sale, OWNER.margin, String(OWNER.awarded), "4242.42", "ZZOTHERVENDORNOTE", b.id, rb.json.offer.id, a.code, "feePayer", P.feePayer, P.designatedOffice, P.ownerNote, P.awardedCount, "BP-AG-"];
  for (const [label, r] of outs) {
    assert.equal(r.status, 200, label + " " + r.text);
    assertNone(r.text, forbidden, label);
  }
  // الشكل: قائمة بيضاء فقط.
  for (const x of outs[1][1].json.offers) assert.deepEqual(Object.keys(x).sort(), [...O.VENDOR_OFFER_FIELDS].sort());
  assert.equal(outs[1][1].json.offers.length, 1);
  assert.deepEqual(Object.keys(outs[1][1].json).sort(), ["more", "offers", "ok"]);
  assert.deepEqual(Object.keys(outs[2][1].json).sort(), ["offer", "ok", "replaced"]);
});

test("mapVendorOffer: يعيد القائمة البيضاء حتى لو حمل الصف أعمدة غريبة، ويبني اسم المهنة من التصنيف لا من النص المخزّن", () => {
  const pg = { id: "p1", created_time: "2026-10-08T10:00:00.000Z", properties: {
    [P.occupationId]: { type: "rich_text", rich_text: [{ plain_text: "hosp.waiter" }] },
    [P.occupation]: { type: "rich_text", rich_text: [{ plain_text: "ZZSTOREDNAME" }] },
    [P.item]: { type: "rich_text", rich_text: [{ plain_text: "EOR-TEST-1-1" }] },
    [P.price]: { type: "number", number: 100 }, [P.status]: { type: "select", select: { name: "مرسّى" } },
    [P.ownerNote]: { type: "rich_text", rich_text: [{ plain_text: OWNER.ownerNote }] },
    [P.office]: { type: "rich_text", rich_text: [{ plain_text: "office-id" }] },
  } };
  const m = O.mapVendorOffer(pg);
  assert.deepEqual(Object.keys(m).sort(), [...O.VENDOR_OFFER_FIELDS].sort());
  assert.equal(m.status, "awarded");
  assert.equal(m.nameAr, "نادل");
  assertNone(m, ["ZZSTOREDNAME", OWNER.ownerNote, "office-id"]);
  assert.equal(O.mapVendorOffer({ id: "p2", properties: { [P.status]: { type: "select", select: { name: "شيء آخر" } } } }).status, "");
});

/* ═════════════ ٥) يفشل مغلقاً ═════════════ */
test("بلا VENDOR_OFFERS_DB (أو بقيمة فاسدة): الثلاثة تردّ not_configured ولا نداء لتلك القاعدة", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  for (const value of [undefined, "", "   ", "not-a-notion-id", "../../x", "g".repeat(32)]) {
    if (value === undefined) delete process.env.VENDOR_OFFERS_DB; else process.env.VENDOR_OFFERS_DB = value;
    calls.length = 0;
    const s = await offer(c);
    const w = await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: "a".repeat(32) });
    const l = await mine(c);
    for (const r of [s, w, l]) {
      assert.equal(r.status, 503, `«${value}»`);
      assert.deepEqual(r.json, { ok: false, error: "not_configured" });
    }
    assert.equal(calls.filter((x) => x.db === OFFERS || x.db === value).length, 0, `«${value}» نداء لقاعدة العروض`);
    assert.equal(calls.filter((x) => x.method === "POST" && x.path === "pages" && x.db !== "agdb").length, 0);
  }
  assert.equal(offerRows().length, 0);
  assert.equal(O.offersDbId({}), "");
  assert.equal(O.offersDbId({ VENDOR_OFFERS_DB: OFFERS }), OFFERS);
  assert.equal(O.offersDbId({ VENDOR_OFFERS_DB: `${OFFERS.slice(0, 8)}-${OFFERS.slice(8, 12)}-${OFFERS.slice(12, 16)}-${OFFERS.slice(16, 20)}-${OFFERS.slice(20)}` }).length, 36);
  // الدوال نفسها ترفض بلا معرّف.
  const nope = async () => { throw new Error("no notion call"); };
  assert.deepEqual(await O.submitOffer({ notion: nope, dbId: "", agency: { id: "x" }, item: {}, value: {} }), { ok: false, status: 503, error: "not_configured" });
  assert.deepEqual(await O.withdrawOffer({ notion: nope, dbId: "", agency: { id: "x" }, offerId: "a".repeat(32) }), { ok: false, status: 503, error: "not_configured" });
  assert.deepEqual(await O.listOffers({ notion: nope, dbId: "", agency: { id: "x" } }), { ok: false, status: 503, error: "not_configured" });
});

test("تعذّر Notion: خطأ عام بلا تفاصيل، ولا يظهر نصّ الخطأ", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  failOffers = true;
  for (const r of [await offer(c), await mine(c), await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: "a".repeat(32) })]) {
    assert.ok([502, 404].includes(r.status), r.text);
    assert.equal(r.json.ok, false);
    assertNone(r.text, ["ZZSECRET", "boom"]);
  }
  assert.deepEqual((await mine(c)).json, { ok: false, error: "notion_failed" });
});

/* ═════════════ ٦) حدود الأرقام ═════════════ */
test("حدود الأرقام والنص: السعر والمتاح والتجهيز والملاحظة والبند", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const bad = async (over, err, field) => {
    const r = await offer(c, over);
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.equal(r.json.error, err, JSON.stringify(over));
    assert.equal(r.json.field, field);
  };
  for (const price of [0, -1, "abc", "", null, undefined, true, {}, [], "1e3", "0x10", "100000.01", 100001, "12.345", "1,2,3.456", NaN, Infinity, "0.00", "--5"]) await bad({ price }, "invalid_price", "price");
  for (const available of [0, -1, 1.5, "x", "", null, undefined, 5001, "5001", "1e2", true, [], {}]) await bad({ available }, "invalid_available", "available");
  for (const prepDays of [-1, 366, 1.5, "", null, undefined, "x", "1e1", true, [], {}]) await bad({ prepDays }, "invalid_prep_days", "prepDays");
  for (const note of [{}, [], 5, true, "x".repeat(301)]) await bad({ note }, "invalid_note", "note");
  for (const itemId of ["", "../x", "a b", "a", "ab", "x".repeat(80), null, undefined, 5, "EOR TEST", "EOR-TEST-1-1/../x"]) await bad({ itemId }, "invalid_item", "itemId");
  assert.equal(offersWrites().filter((x) => x.method !== "GET").length, 0, "لا كتابة عند الرفض");
  assert.equal(offerRows().length, 0);

  // الحدود المقبولة بالضبط.
  const okCases = [
    [{ price: 100000, available: 5000, prepDays: 365, note: "x".repeat(300) }, { price: 100000, available: 5000, prepDays: 365 }],
    [{ price: 0.01, available: 1, prepDays: 0, note: undefined }, { price: 0.01, available: 1, prepDays: 0 }],
    [{ price: "2,500.50", available: "٢٠", prepDays: "٣٠" }, { price: 2500.5, available: 20, prepDays: 30 }],
    [{ price: "٣٥٠٠", available: 3, prepDays: 7, note: null }, { price: 3500, available: 3, prepDays: 7 }],
    [{ price: "٢٤٥٠٫٥", available: 3, prepDays: 7 }, { price: 2450.5, available: 3, prepDays: 7 }],
    [{ price: "99.9", available: " 4 ", prepDays: 1 }, { price: 99.9, available: 4, prepDays: 1 }],
  ];
  for (const [over, want] of okCases) {
    const r = await offer(c, over);
    assert.equal(r.status, 200, JSON.stringify(over) + r.text);
    for (const [k, v] of Object.entries(want)) assert.equal(r.json.offer[k], v, k);
  }
  assert.equal(offerRows().length, 1, "كلها استبدلت العرض نفسه");
  // محارف التحكم تُنظَّف.
  const n = await offer(c, { note: "سطر\u0000 أول\n\tثانٍ\u0007" });
  assert.equal(n.json.offer.note, "سطر أول ثانٍ");
});

test("parseOfferInput: دالة صرفة، ولا تقبل غير رقم/نص", () => {
  assert.deepEqual(O.parseOfferInput({ price: "10", available: "2", prepDays: "0" }), { ok: true, value: { price: 10, available: 2, prepDays: 0, note: "" } });
  assert.equal(O.parseOfferInput(null).ok, false);
  assert.equal(O.parseOfferInput(undefined).ok, false);
  assert.equal(O.parseOfferInput({ price: 10, available: 2, prepDays: 0, note: " a  b " }).value.note, "a b");
  assert.equal(O.isItemId("EOR-TEST-1-1"), true);
  assert.equal(O.isItemId("a/b"), false);
  assert.equal(O.isPageId("a".repeat(32)), true);
  assert.equal(O.isPageId("a".repeat(31)), false);
});

/* ═════════════ ٧) الطلب المطلوب عليه ═════════════ */
test("لا عرض على بند غير موجود أو أُغلق، ولا يخرج الطلب المغلق", async () => {
  reset();
  eorRows = [await eorRow("EOR-TEST-1", { open: false }), await eorRow("EOR-TEST-2", { status: "مغلق" })];
  const c = await corp("Mahara Test Co", "c@corp.example");
  for (const itemId of [ITEM1, "EOR-TEST-2-1", "EOR-NOPE-9-1"]) {
    const r = await offer(c, { itemId });
    assert.equal(r.status, 404, itemId);
    assert.equal(r.json.error, "item_not_found");
  }
  assert.equal(offerRows().length, 0);
  // تعذّر قراءة الطلبات ⇒ لا عرض.
  eorRows = [await eorRow("EOR-TEST-1")]; _resetVendorDemandCache();
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes("/databases/eordb/query") ? resp(500, "boom") : prev(url, init));
  try {
    const r = await offer(c);
    assert.equal(r.status, 502);
    assert.deepEqual(r.json, { ok: false, error: "demand_unavailable" });
  } finally { globalThis.fetch = prev; }
  assert.equal(offerRows().length, 0);
});

/* ═════════════ ٨) حالات العرض ═════════════ */
test("سحب العرض: يبقى الصف «مسحوب»، والتقديم بعده صفٌّ جديد، والسحب مكرراً لا يضرّ", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const r1 = await offer(c);
  const w = await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: r1.json.offer.id });
  assert.equal(w.status, 200, w.text);
  assert.equal(w.json.offer.status, "withdrawn");
  assert.equal(pages.get(r1.json.offer.id).properties[P.status].select.name, O.OFFER_STATUS.withdrawn);
  assert.ok(mails.some((m) => /سحب عرض/.test(m.subject)));

  mails.length = 0;
  const again = await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: r1.json.offer.id });
  assert.equal(again.status, 200);
  assert.equal(again.json.offer.status, "withdrawn");
  assert.equal(mails.length, 0, "لا بريد على سحب مكرر");

  const r2 = await offer(c, { price: 999 });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.replaced, false, "لا فعّال ليُستبدل");
  assert.notEqual(r2.json.offer.id, r1.json.offer.id);
  assert.equal(offerRows().length, 2);
  const l = await mine(c);
  assert.deepEqual(l.json.offers.map((x) => x.status).sort(), ["submitted", "withdrawn"]);
});

test("مرسّى/مرفوض يضعهما المالك: المورّد لا يعدّلهما ولا يسحبهما، والمرسّى يمنع عرضاً جديداً", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const r1 = await offer(c);
  const r2 = await offer(c, { itemId: ITEM2, price: 800 });

  // المالك يرسّي الأول ويرفض الثاني (مباشرةً في Notion).
  setProp(r1.json.offer.id, P.status, { type: "select", select: { name: O.OFFER_STATUS.awarded } });
  setProp(r2.json.offer.id, P.status, { type: "select", select: { name: O.OFFER_STATUS.rejected } });

  for (const id of [r1.json.offer.id, r2.json.offer.id]) {
    const w = await post({ type: "vendor-offer-withdraw", ...creds(c), offerId: id });
    assert.equal(w.status, 409, w.text);
    assert.equal(w.json.error, "offer_locked");
  }
  const up = await offer(c, { price: 1 });
  assert.equal(up.status, 409);
  assert.equal(up.json.error, "already_awarded");
  assert.equal(pages.get(r1.json.offer.id).properties[P.price].number, 2450.5);
  assert.equal(offerRows().length, 2);

  // المرفوض يستطيع المورّد أن يقدّم بديلاً عنه (صفّ جديد).
  const re = await offer(c, { itemId: ITEM2, price: 700 });
  assert.equal(re.status, 200, re.text);
  assert.equal(re.json.replaced, false);
  const l = await mine(c);
  assert.deepEqual(l.json.offers.map((x) => x.status).sort(), ["awarded", "rejected", "submitted"]);
});

test("سباق طلبين متزامنين: صفّان فعّالان ⇒ يبقى الأحدث ويُسحب الباقي", async () => {
  reset(); await withDemand();
  const c = await corp("Mahara Test Co", "c@corp.example");
  const mk = (price) => {
    const id = newId();
    pages.set(id, { id, db: OFFERS, parent: { type: "database_id", database_id: OFFERS }, created_time: stamp(), properties: toRead({
      [P.office]: { rich_text: [{ text: { content: c.id } }] }, [P.item]: { rich_text: [{ text: { content: ITEM1 } }] },
      [P.price]: { number: price }, [P.status]: { select: { name: O.OFFER_STATUS.submitted } },
    }) });
    return id;
  };
  const older = mk(111), newer = mk(222);
  const r = await offer(c, { price: 333 });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.replaced, true);
  assert.equal(r.json.offer.id, newer);
  assert.equal(pages.get(newer).properties[P.price].number, 333);
  assert.equal(pages.get(older).properties[P.status].select.name, O.OFFER_STATUS.withdrawn);
  const active = offerRows().filter((x) => textOf(x.properties[P.status]) === O.OFFER_STATUS.submitted);
  assert.equal(active.length, 1);
});

/* ═════════════ ٩) وسم المصدر ═════════════ */
test("vendor:corporate: وسم معتمد في _sources.js، يُكتب لمرشّحي المؤسسي ولا يخرج في أي ناتج", async () => {
  reset();
  for (const ok of ["vendor:corporate", "vendor:office", "vendor:freelancer"]) assert.equal(S.isSource(ok), true, ok);
  assert.equal(S.normalizeSource(" Vendor:Corporate "), "vendor:corporate");
  assert.equal(S.sourceProp("vendor:corporate").select.name, "vendor:corporate");
  assert.equal(S.sourceForVendor({ kind: KIND, name: "A" }), "vendor:corporate");
  assert.equal(S.SOURCE_TAG_RE.test("خانة vendor:corporate هنا"), true);
  assert.ok(S.FIXED_SOURCES.includes("vendor:corporate"));

  const c = await corp("Mahara Test Co", "c@corp.example");
  const r = await post({ type: "vendor-add-candidate", ...creds(c), name: "Ravi Kumar", nationality: "IN", role: "hosp.waiter", experience: 3 });
  assert.equal(r.status, 200, r.text);
  const row = [...pages.values()].find((x) => x.db === "atsdb");
  assert.equal(textOf(row.properties[S.SOURCE_PROP]), "vendor:corporate");
  assert.equal(textOf(row.properties[S.OFFICE_ID_PROP]), c.id);
  assert.equal(S.SOURCE_TAG_RE.test(r.text), false);
  const l = await post({ type: "vendor-candidates", ...creds(c) });
  assert.deepEqual(l.json.candidates.map((x) => x.name), ["Ravi Kumar"]);
  assert.equal(S.SOURCE_TAG_RE.test(l.text), false);
});

/* ═════════════ ١٠) المخطط والمعمارية ═════════════ */
test("docs/hr-supplier-model.md يوثّق كل عمود يكتبه الكود في «مخطط عروض المورّدين»", () => {
  const doc = fs.readFileSync(path.join(ROOT, "docs/hr-supplier-model.md"), "utf8");
  const at = doc.indexOf("مخطط عروض المورّدين");
  assert.ok(at > 0, "القسم غير موجود");
  const section = doc.slice(at);
  for (const [k, col] of Object.entries(P)) assert.ok(section.includes(`\`${col}\``), `العمود «${col}» (${k}) غير موثّق`);
  for (const s of Object.values(O.OFFER_STATUS)) assert.ok(section.includes(s), s);
  assert.ok(section.includes("VENDOR_OFFERS_DB"));
  assert.ok(section.includes("BP Vendor Offers"));
  assert.ok(section.includes("من يتقاضى رسم المكتب"));
});

test("المعمارية: لا دالة جديدة، _vendor-offers.js مساعد لا يستورد _agencies.js، وملفات أصحاب العمل لا تعرفه", () => {
  const fns = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  assert.ok(fns.length <= 12, `الدوال ${fns.length}`);
  assert.ok(!fns.includes("vendor-offers.js"));
  const own = fs.readFileSync(path.join(ROOT, "api/_vendor-offers.js"), "utf8");
  assert.equal(/from\s+["']\.\/_agencies\.js["']/.test(own), false, "دورة استيراد");
  for (const f of ["api/candidates.js", "api/employer.js", "api/hire.js", "api/candidate.js", "api/_jobhunt.js", "api/requests.js", "api/workspace.js", "api/_eor.js"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.equal(/_vendor-offers/.test(src), false, `${f} يستورد عروض المورّدين`);
    for (const col of [P.price, P.designatedOffice, P.feePayer, P.ownerNote, "VENDOR_OFFERS_DB"]) assert.equal(src.includes(col), false, `${f} يذكر «${col}»`);
  }
});
