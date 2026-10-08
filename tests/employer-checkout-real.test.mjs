// المسار الكامل على api/employer.js الحقيقي (لا محاكاة له): pay.js ← _emp-pay.js ←
// getPlanOffer · createPendingSubscription · activateSubscription، ونوشن وحده مُحاكى.
// يُثبت أن العقد الذي بُني عليه tests/employer-checkout.test.mjs هو ما يفعله الملف
// الحقيقي: المبلغ قبل الضريبة، المرجع BP-EMPSUB-، وإعادة الدفعة ok:true بلا تمديد ثانٍ.
//
// ما يُقاس: صفّ نوشن ينتقل «بانتظار الدفع» → «مفعّل» مرة واحدة، ومرة واحدة فقط لكل
// دفعة، ولا يتحرّك عند مبلغ مختلف أو دفعة فاشلة أو enterprise. ورمز الوصول لا يظهر
// في أي ردٍّ من /api/pay.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OTP_SECRET = "unit-otp-secret-real-0123456789";
const WEBHOOK = "unit-webhook-secret-real";
Object.assign(process.env, {
  APP_ENV: "production", VERCEL_ENV: "production",
  MOYASAR_PUBLISHABLE_KEY: "pk_test_unit00000000000000000000000000000000",
  MOYASAR_SECRET_KEY: "sk_test_unit00000000000000000000000000000000",
  MOYASAR_WEBHOOK_SECRET: WEBHOOK, OTP_SECRET, TAMARA_API_TOKEN: "tamara-unit-token",
  NOTION_TOKEN: "test-token-never-leaves-this-process",
});
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "RESEND", "DAFTRA_API_KEY", "LOCAL_DB"]) delete process.env[k];

// ------------------------------------------------------------ نوشن مُحاكى --
const EMP_DB = "f1104f8bcc3d4beb84accdbda0aa8322";
const ROWS = [];
let seq = 0, patches = 0;
const plain = (v) => (v || []).map((x) => (x.text ? x.text.content : x.plain_text || "")).join("");
function toRead(prop) {
  if (prop.title) return { type: "title", title: [{ plain_text: plain(prop.title) }] };
  if (prop.rich_text) return { type: "rich_text", rich_text: prop.rich_text.length ? [{ plain_text: plain(prop.rich_text) }] : [] };
  if ("select" in prop) return { type: "select", select: prop.select };
  if ("email" in prop) return { type: "email", email: prop.email };
  if ("date" in prop) return { type: "date", date: prop.date };
  if ("phone_number" in prop) return { type: "phone_number", phone_number: prop.phone_number };
  throw new Error("unknown property " + JSON.stringify(prop));
}
const textOf = (p) => (!p ? "" : p.rich_text ? p.rich_text.map((x) => x.plain_text).join("") : p.title ? p.title.map((x) => x.plain_text).join("") : p.email || "");
function matches(row, f) {
  if (!f) return true;
  if (f.and) return f.and.every((x) => matches(row, x));
  const p = row.properties[f.property];
  if (f.email) {
    const v = String((p && p.email) || "").toLowerCase();
    return "equals" in f.email ? v === f.email.equals : v.includes(String(f.email.contains).toLowerCase());
  }
  if (f.select) return ((p && p.select && p.select.name) || null) === f.select.equals;
  if (f.rich_text) {
    const v = textOf(p);
    return "equals" in f.rich_text ? v === f.rich_text.equals : v.toLowerCase().includes(String(f.rich_text.contains).toLowerCase());
  }
  throw new Error("unknown filter " + JSON.stringify(f));
}

// ----------------------------------------------------- مُيسّر · تمارا · /api/requests --
const gw = { moyasar: new Map(), tamara: new Map(), paidOrders: [], seenPay: new Set(), unexpected: [] };
function unseal(t) {
  const raw = Buffer.from(String(t), "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(OTP_SECRET).digest(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
}
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const method = (init.method || "GET").toUpperCase();
  if (u.startsWith("https://api.notion.com/")) {
    const body = init.body ? JSON.parse(init.body) : {};
    const q = /databases\/([a-z0-9]+)\/query/.exec(u);
    if (q) return json({ results: q[1] === EMP_DB ? ROWS.filter((r) => matches(r, body.filter)).slice(0, body.page_size || 100) : [], has_more: false });
    if (u.endsWith("/v1/pages") && method === "POST") {
      const props = {};
      for (const [k, v] of Object.entries(body.properties)) props[k] = toRead(v);
      const row = { id: "row-" + (++seq), created_time: new Date(Date.UTC(2026, 0, 1, 0, seq)).toISOString(), properties: props };
      ROWS.push(row);
      return json(row);
    }
    const pm = /\/pages\/([^/?]+)$/.exec(u);
    if (pm && method === "PATCH") {
      patches++;
      const row = ROWS.find((r) => r.id === pm[1]);
      if (!row) return json({}, 404);
      for (const [k, v] of Object.entries(body.properties)) row.properties[k] = toRead(v);
      return json(row);
    }
    return json({}, 404);
  }
  if (u.includes("raw.githubusercontent.com") && u.endsWith("catalog.json")) return json({ services: [], packages: [], discounts: [] });
  let m = u.match(/api\.moyasar\.com\/v1\/payments\/([\w-]+)$/);
  if (m) { const p = gw.moyasar.get(m[1]); return p ? json(p) : json({}, 404); }
  if (u.endsWith("/api/requests")) {
    const d = unseal(JSON.parse(init.body).t);
    gw.paidOrders.push(d);
    const already = gw.seenPay.has(d.payId); gw.seenPay.add(d.payId);
    return json({ ok: true, already, verified: !!d.verified, activated: {} });
  }
  m = u.match(/tamara\.co\/orders\/([\w-]+)$/);
  if (m) { const o = gw.tamara.get(m[1]); return o ? json(o) : json({}, 404); }
  // مسار التحقق القديم في pay.js (markOrderPaid) يطرق خطّاف المالك عند وجود NOTION_TOKEN:
  // موجود قبل هذا العمل، ويُبتلع هنا بدل أن يخرج من الجهاز.
  if (u.includes("n8n.cloud/webhook/")) return json({ ok: true });
  gw.unexpected.push(u);
  throw new Error("unexpected fetch " + u);
};

const { __setSessionForTest } = await import(path.join(ROOT, "api", "_emp-pay.js"));
__setSessionForTest(async () => ({ user: { email: "hr@acme.test" } }));
const { default: pay } = await import(path.join(ROOT, "api", "pay.js"));
async function call(method, { query, body } = {}) {
  const out = { status: 200, body: null, raw: "" };
  const res = { setHeader() {}, statusCode: 200, end(b) { out.status = this.statusCode; out.raw = String(b); try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await pay({ method, headers: {}, query: query || {}, body: body || {}, url: "/api/pay" }, res);
  return out;
}
const everything = [];                 // كل ردٍّ، لفحص أن رمز الوصول لا يخرج
const track = (r) => { everything.push(r.raw); return r; };
let n = 0;
const put = ({ status = "paid", amount, ref, items }) => {
  const id = `pay_real_${String(++n).padStart(6, "0")}`;
  gw.moyasar.set(id, { id, status, amount, currency: "SAR", metadata: { ref, items, email: "hr@acme.test", name: "Ali", phone: "0500000000", co: "Acme" } });
  return id;
};
const hook = (id) => call("POST", { body: { type: "payment_paid", secret_token: WEBHOOK, data: { id } } }).then(track);
const prepare = (sku, extra = {}) => call("POST", { body: { action: "emp-prepare", sku, email: "hr@acme.test", company: "Acme Co", ...extra } }).then(track);
const reset = () => { ROWS.length = 0; seq = 0; patches = 0; gw.paidOrders.length = 0; gw.seenPay.clear(); gw.unexpected.length = 0; };
const row = () => ROWS.find((r) => r.properties["البريد"].email === "hr@acme.test");
const status = () => row().properties["الحالة"].select.name;
const notes = () => textOf(row().properties["ملاحظات"]);
const payLines = () => notes().split("\n").filter((l) => l.startsWith("دفعة |"));
const vat = (sar) => Math.round(sar * 1.15 * 100);

test("real module: prepare → paid webhook activates the row once; replays and the browser callback add nothing", async () => {
  reset();
  const p = await prepare("BP-EMP-PRO-Y");
  assert.equal(p.status, 200);
  assert.match(p.body.reference, /^BP-EMPSUB-[A-HJ-NP-Z2-9]{12}$/);
  assert.equal(p.body.amountHalalas, 840000, "the price is site.json's, taken from getPlanOffer");
  assert.equal(status(), "بانتظار الدفع");
  assert.equal(row().properties["الباقة"].select.name, "احترافية");

  const id = put({ amount: vat(8400), ref: p.body.reference, items: "BP-EMP-PRO-Y~1" });
  const a = await hook(id);
  assert.equal(a.body.employer.activated, true);
  assert.equal(status(), "مفعّل");
  assert.equal(row().properties["الفوترة"].select.name, "سنوي");
  assert.equal(payLines().length, 1);
  const firstEnd = row().properties["تاريخ التفعيل"].date.end;

  const patchesAfterFirst = patches;
  const b = await hook(id);                                  // Moyasar أعاد الإشعار
  assert.equal(b.body.employer.activated, true, "the account is active — the page may say so");
  const order = { ref: p.body.reference, name: "Ali", email: "hr@acme.test", company: "Acme Co", items: [{ id: "BP-EMP-PRO-Y", qty: 1 }] };
  const c = track(await call("POST", { body: { id, order } }));       // وعاد المتصفح
  assert.equal(c.body.employer.activated, true);
  assert.equal(payLines().length, 1, "one payment line");
  assert.equal(row().properties["تاريخ التفعيل"].date.end, firstEnd, "the period is not extended twice");
  assert.equal(patches, patchesAfterFirst, "replays write nothing");
  assert.deepEqual(gw.unexpected, []);

  // CRM: الاشتراك يصل اسماً لا معرّفاً، فلا يُسجَّل «خدمة عادية» في /api/requests.
  assert.deepEqual(gw.paidOrders[0].ids, []);
  assert.match(gw.paidOrders[0].items[0], /اشتراك منصة التوظيف/);
});

test("real module: a wrong amount, a failed payment, enterprise — the row stays pending", async () => {
  reset();
  const p = await prepare("BP-EMP-BASIC-Y");
  const ref = p.body.reference;
  const order = { ref, email: "hr@acme.test", company: "Acme Co", items: [{ id: "BP-EMP-BASIC-Y", qty: 1 }] };

  const low = put({ amount: vat(500), ref, items: "BP-EMP-BASIC-Y~1" });          // سعر الشهري لباقة سنوية
  assert.equal((await hook(low)).body.employer.activated, false);
  assert.equal(status(), "بانتظار الدفع");

  const failed = put({ status: "failed", amount: vat(4200), ref, items: "BP-EMP-BASIC-Y~1" });
  assert.equal((await hook(failed)).body.ignored, true);
  assert.equal((await call("POST", { body: { id: failed, order } })).body.ok, false);
  assert.equal(status(), "بانتظار الدفع");

  const ent = await prepare("BP-EMP-ENTERPRISE-Y");
  assert.equal(ent.body.error, "quote_only");
  assert.equal(payLines().length, 0);
  assert.equal(ROWS.length, 1, "no second row was opened");
});

test("real module: the same plan prepared twice reuses one pending reference", async () => {
  reset();
  const a = await prepare("BP-EMP-BASIC-M");
  const b = await prepare("BP-EMP-BASIC-M");
  assert.equal(a.body.reference, b.body.reference);
  assert.equal(ROWS.length, 1);
});

test("real module: tamara — monthly refused, a captured yearly order activates", async () => {
  reset();
  const m = await call("POST", { body: { action: "bnpl-checkout", order: { ref: "BP-EMPSUB-AAAAAAAAAAAA", email: "hr@acme.test", items: [{ id: "BP-EMP-BASIC-M", qty: 1 }] } } });
  assert.equal(m.body.error, "bnpl_yearly_only");
  const p = await prepare("BP-EMP-BASIC-Y");
  gw.tamara.set("t-real-1", { status: "fully_captured", total_amount: { amount: String(vat(4200) / 100) } });
  const r = track(await call("POST", { body: { action: "bnpl-verify", id: "t-real-1", order: { ref: p.body.reference, email: "hr@acme.test", company: "Acme Co", items: [{ id: "BP-EMP-BASIC-Y", qty: 1 }] } } }));
  assert.equal(r.body.employer.activated, true);
  assert.equal(status(), "مفعّل");
  assert.match(notes(), /دفعة \| tamara_t-real-1 \|/);
});

test("the access code never appears in any /api/pay response", () => {
  const all = everything.join("\n");
  assert.ok(all.length > 0);
  assert.doesNotMatch(all, /BP-EMP-[A-HJ-NP-Z2-9]{12}\b/);
});
