// بند المالك 17 (2026-11-02): بعد «اطلب العرض» يرى العميل أين هو ويتتبّع طلبه، ويصدر العرض بورقة بدر.
//   ١) request-status: خفيف (حالة وأرقام مستندات فقط) ويتغيّر حين يصدر العرض، ولا يفتح طلب غيرك.
//   ٢) العرض الآلي يصدر بقالب v3 مع لقطة، وquote-view يرسمه أفقياً بغلاف وغلاف خلفي.
//   ٣) صفحة /my تحمل شريط «الخطوة التالية» وتتبّعاً تلقائياً.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quote-next-step-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const catalog = JSON.parse(fs.readFileSync(new URL("../site/assets/data/catalog.json", import.meta.url), "utf8"));
globalThis.fetch = async (url) => {
  if (String(url).includes("catalog.json")) return new Response(JSON.stringify(catalog), { status: 200 });
  throw new Error("a local run must not reach the network: " + url);
};

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-aaaaaaaaaaaaaaaa" };
const OTHER = { email: "other@test.local", org: "31c1fef8-8ead-4007-acb1-3044a6b9dd29", user: "11111111-2222-4333-8444-555555555555", token: "tok-other-bbbbbbbbbbbbbbbbb" };
const future = new Date(Date.now() + 864e5).toISOString();
await sb("users", { method: "POST", prefer: "return=minimal", body: [{ id: OTHER.user, email: OTHER.email, full_name: "عميل آخر", locale: "ar" }] });
for (const c of [CLIENT, OTHER]) {
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(c.token), user_id: c.user, organization_id: c.org, expires_at: future, revoked: false }] }).catch(() => {});
}

async function call(action, body = {}, who = CLIENT) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${who.token}` }, socket: {}, query: {}, body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body } }, res);
  return out;
}

test("request-status: حالة خفيفة تتغيّر حين يصدر العرض، ولا تُفتح لغير صاحب الطلب", async () => {
  const c = await call("request-create", { type: "COMPANY_FORMATION", title: "تتبّع", scope: [{ code: "BP-SBC-01", title: "تأسيس شركة سعودية", qty: 1 }, { code: "BP-REC-03", title: "موظفون على بند التعاقد (EOR)", qty: 1 }] });
  assert.equal(c.body.ok, true, JSON.stringify(c.body));
  const ref = c.body.ref;
  const s0 = await call("request-status", { ref });
  assert.equal(s0.body.ok, true);
  assert.equal(s0.body.status, "NEW");
  assert.equal(s0.body.quote, null);
  assert.deepEqual(Object.keys(s0.body).sort(), ["contract", "invoice", "ok", "payment", "quote", "ref", "status", "updated_at"]);
  // بند بلا سعر ⇒ تسعير بشري: الحالة REVIEWING والعرض لم يصدر بعد
  const conf = await call("scope-confirm", { ref });
  assert.equal(conf.body.stage, "PRICING");
  const s1 = await call("request-status", { ref });
  assert.equal(s1.body.status, "REVIEWING");
  assert.equal(s1.body.quote, null);
  // الفريق يسعّر ⇒ تتغيّر البصمة التي تقارنها الصفحة
  const q = await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "تأسيس شركة سعودية", qty: 1, price: 7500 }, { code: "BP-REC-03", title: "EOR", qty: 1, price: 3000 }] });
  assert.equal(q.body.ok, true, JSON.stringify(q.body));
  const s2 = await call("request-status", { ref });
  assert.equal(s2.body.status, "QUOTE_SENT");
  assert.equal(s2.body.quote.status, "SENT");
  assert.ok(s2.body.quote.number);
  // غير صاحب الطلب لا يراه
  const other = await call("request-status", { ref }, OTHER);
  assert.equal(other.status, 404);
});

test("العرض الآلي يصدر بقالب v3 (أفقي، غلاف، غلاف خلفي) ويُرسم من لقطة الإصدار", async () => {
  const c = await call("request-create", { type: "COMPANY_FORMATION", title: "عرض فوري", scope: [{ code: "BP-SBC-01", title: "تأسيس شركة سعودية", qty: 1 }] });
  const ref = c.body.ref;
  const conf = await call("scope-confirm", { ref });
  assert.equal(conf.body.stage, "QUOTE");
  assert.equal(conf.body.quote.template_version, "v3");
  assert.ok(conf.body.quote.doc && conf.body.quote.doc.company, "لقطة الورقة تُكتب عند الإصدار");
  const v = await call("quote-view", { ref });
  assert.equal(v.body.ok, true);
  const html = v.body.html;
  assert.match(html, /data-bp-doc="v3"/);
  assert.match(html, /@page\s*\{[^}]*A4 landscape/i, "الورقة أفقية");
  assert.match(html, /Thank you for your trust|شكراً لثقتكم/, "غلاف خلفي");
  assert.ok(html.includes(conf.body.quote.number));
});

test("صفحة /my تحمل شريط الخطوة التالية والتتبّع التلقائي", async () => {
  const src = fs.readFileSync(new URL("../site/scripts/simple-v1-my.mjs", import.meta.url), "utf8");
  for (const needle of ["function nextBanner", "function schedulePoll", "request-status", "sv1Next", "nxPriceT", "nxQuoteT", "nxContractT", "nxPayT"]) {
    assert.ok(src.includes(needle), needle);
  }
});
