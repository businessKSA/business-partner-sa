// مركز التواصل (ودجت الدعم): التذكرة والتتبّع في api/_simple.js، وأصول الواجهة.
//
// ما يُثبته هذا الملف:
//   ١) التذكرة تُنشأ في جدول requests نفسه (لا جدول موازٍ) بمرجع BP-TKT-، وتصل المالك
//      (بريد + واتساب + مهمة ردّ واحدة)، ويصل العميل تأكيدها برقمها، وتظهر في «طلباتي».
//   ٢) التذكرة ليست طلب عرض سعر: لا تُحسب «طلباً نشطاً» ولا تفتح مهمة تسعير.
//   ٣) التتبّع لا يكشف بيانات غير صاحبها: بجلسة صاحبها يرى ملخّصه بلا مبالغ ولا اتصال؛ بلا جلسة
//      لا شيء إلا بمرجع + بريد مطابق، والخطأ في أيّ منهما يردّ بالجواب نفسه تماماً؛ وعميلٌ آخر
//      لا يرى ما ليس له. بريدٌ بلا مرجع وبلا جلسة لا يُعرض له شيء.
//   ٤) الحماية: خانة الفخّ، والمنع عند الإكثار، وشرط وسيلة تواصل للزائر.
//   ٥) الأرقام لا تُكتب في كود الواجهة (تأتي من site/data/site.json).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "support-hub-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("catalog.json")) return new Response(JSON.stringify({ services: [], packages: [], discounts: [] }), { status: 200 });
  throw new Error("a local run must not reach the network: " + u);
};

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-support-aaaaaaaaaa" };
const OTHER = { email: "other@test.local", org: "31c1fef8-8ead-4007-acb1-3044a6b9dd29", user: "11111111-2222-4333-8444-555555555555", token: "tok-other-support-bbbbbbbbbbb" };
const future = new Date(Date.now() + 864e5).toISOString();
await sb("users", { method: "POST", prefer: "return=minimal", body: [{ id: OTHER.user, email: OTHER.email, full_name: "عميل آخر", locale: "ar" }] });
for (const c of [CLIENT, OTHER]) {
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(c.token), user_id: c.user, organization_id: c.org, expires_at: future, revoked_at: null }] });
}

let ipN = 0;
// كل مكالمة بعنوان مختلف حتى لا يتداخل اختبار الإكثار مع غيره.
async function call(action, body = {}, who = null, ip = "10.1.0." + (++ipN)) {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({
    method: "POST", headers: { cookie: who ? `bp_sid=${who.token}` : "", "x-forwarded-for": ip }, socket: {}, query: {},
    body: { action, ...body },
  }, res);
  return out;
}
const ticketBody = (o = {}) => ({ subject: "تعذّر الدفع بالبطاقة", details: "حاولت مرتين وظهر خطأ.", category: "payment", lang: "ar", page: "/ar/cart", ...o });
const mails = async (ref) => (await outboxList(500)).filter((m) => JSON.stringify(m).includes(ref));

let signedRef = "", anonRef = "", anonMail = "";

test("a signed-in client opens a ticket: one row in requests, BP-TKT- number, owner told, client confirmed", async () => {
  const r = await call("support-ticket-create", ticketBody({ related_ref: "BP-R-DEMO01", convo: [{ role: "user", content: "كم سعر الخدمة؟" }] }), CLIENT);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.match(r.body.ref, /^BP-TKT-[0-9A-F]{6}$/);
  assert.equal(r.body.signedIn, true);
  signedRef = r.body.ref;
  const rows = await sb(`requests?ref=eq.${signedRef}&select=*`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organization_id, CLIENT.org, "tied to the client's organisation, so /my lists it");
  assert.equal(rows[0].status, "NEW");
  assert.equal(rows[0].client_email, CLIENT.email);
  assert.deepEqual(rows[0].scope, [], "a ticket has no scope to price");
  assert.match(rows[0].internal_notes, /BP-R-DEMO01/);
  assert.match(rows[0].internal_notes, /كم سعر الخدمة/);
  assert.equal(rows[0].conversation[0].role, "user");
  const out = await mails(signedRef);
  assert.ok(out.some((m) => m.kind === "email" && /businesspartner/.test(m.to)), "owner mailbox is mailed");
  assert.ok(out.some((m) => m.kind === "whatsapp"), "owner WhatsApp lead pipe is fired (mock locally)");
  assert.ok(out.some((m) => m.kind === "email" && m.to === CLIENT.email), "client gets the number by e-mail");
  const tasks = await sb(`tasks?request_id=eq.${rows[0].id}&select=source,human_action,title`);
  assert.equal(tasks.filter((t) => t.source === "support-ticket").length, 1, "exactly one open reply task");
  assert.equal(tasks.filter((t) => /pricing|sweep-new/.test(t.source)).length, 0, "no pricing / new-request task for a ticket");
});

test("the ticket lists in /my (requests) tagged as a ticket, and does not count as an active request", async () => {
  const mine = await call("requests", {}, CLIENT);
  const t = mine.body.requests.find((x) => x.ref === signedRef);
  assert.ok(t, "ticket is in the client's list");
  assert.equal(t.origin, "ticket");
  const me = await call("me", {}, CLIENT);
  const real = me.body.requests.filter((x) => x.origin !== "ticket" && !["COMPLETED", "CANCELLED"].includes(x.status)).length;
  assert.equal(me.body.counts.active, real, "tickets are not «active requests»");
  const detail = await call("request-get", { ref: signedRef }, CLIENT);
  assert.equal(detail.body.request.origin, "ticket");
  assert.equal(detail.body.request.internal_notes, undefined, "internal notes never reach the client");
  const reply = await call("request-message", { ref: signedRef, content: "أي جديد؟" }, CLIENT);
  assert.equal(reply.body.ok, true, "the client can write inside the ticket (existing request-message path)");
});

test("the follow-up sweep leaves a fresh ticket alone (no pricing task, no second task)", async () => {
  const r = await call("ops-sweep", { key: "test-ops", dry: true });
  const due = (r.body.due || []).map((d) => d.ref);
  assert.ok(!due.includes(signedRef), "a ticket is not swept as a new quotation request");
});

test("anonymous: a ticket needs a name and a way back; the trap field and the brake work", async () => {
  const bad = await call("support-ticket-create", ticketBody({ name: "", email: "", phone: "" }));
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "contact_required");
  const short = await call("support-ticket-create", ticketBody({ subject: "x", name: "زائر", email: "a@b.co" }));
  assert.equal(short.status, 400);
  const before = (await sb("requests?select=ref")).length;
  const trap = await call("support-ticket-create", ticketBody({ name: "bot", email: "bot@example.test", hp: "http://spam" }));
  assert.equal(trap.body.ok, true);
  assert.equal((await sb("requests?select=ref")).length, before, "the trap field creates nothing");
  const ip = "10.9.9.9";
  let last;
  for (let i = 0; i < 7; i++) last = await call("support-ticket-create", ticketBody({ name: "زائر " + i, phone: "0551234567" }), null, ip);
  assert.equal(last.status, 429, "the 7th ticket from one address in an hour is refused");
});

test("anonymous with an e-mail: the ticket is claimable by that e-mail in /my", async () => {
  anonMail = "visitor-" + Date.now() + "@example.test";
  const r = await call("support-ticket-create", ticketBody({ subject: "لا أجد فاتورتي", name: "زائر", email: anonMail }));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.signedIn, false);
  assert.equal(r.body.linked, true);
  anonRef = r.body.ref;
  const row = (await sb(`requests?ref=eq.${anonRef}&select=*`))[0];
  assert.equal(row.organization_id, null);
  assert.equal(row.client_email, anonMail);
});

test("track: the owner of a request sees a summary with no amounts and no contact data", async () => {
  const r = await call("support-track", { ref: "BP-R-DEMO02" }, CLIENT);
  assert.equal(r.body.found, true);
  assert.equal(r.body.verified, "session");
  const it = r.body.item;
  assert.equal(it.ref, "BP-R-DEMO02");
  assert.equal(it.status, "QUOTE_SENT");
  assert.equal(it.quote.number != null, true);
  const raw = JSON.stringify(it);
  assert.ok(!/client_phone|client_email|client_name|"total"|"amount"|"net"|"vat"|0500000000|internal_notes/.test(raw), "no contact data or money in the widget summary: " + raw);
});

test("track: another client cannot read it — the answer is identical to an unknown reference", async () => {
  const other = await call("support-track", { ref: "BP-R-DEMO02" }, OTHER);
  const unknown = await call("support-track", { ref: "BP-R-QQQQQQ" }, OTHER);
  assert.deepEqual(other.body, { ok: true, found: false });
  assert.deepEqual(other.body, unknown.body);
});

test("track without a session: reference + matching e-mail gives status only; anything else gives the same «not found»", async () => {
  const good = await call("support-track", { ref: anonRef, email: anonMail });
  assert.equal(good.body.found, true);
  assert.equal(good.body.verified, "email");
  assert.deepEqual(Object.keys(good.body.item).sort(), ["created_at", "kind", "ref", "status", "title", "updated_at"]);
  const wrongMail = await call("support-track", { ref: anonRef, email: "someone@else.test" });
  const noMail = await call("support-track", { ref: anonRef });
  const unknown = await call("support-track", { ref: "BP-TKT-ZZZZZZ", email: anonMail });
  const badShape = await call("support-track", { ref: "drop table", email: anonMail });
  for (const x of [wrongMail, noMail, unknown, badShape]) assert.deepEqual(x.body, { ok: true, found: false });
  // the signed-in client's ticket is not reachable by someone who only knows the number
  const peek = await call("support-track", { ref: signedRef, email: anonMail });
  assert.deepEqual(peek.body, { ok: true, found: false });
  // an e-mail alone, with no session, lists nothing
  const listOnly = await call("support-track", { email: CLIENT.email });
  assert.deepEqual(listOnly.body, { ok: true, needLogin: true });
});

test("track: a signed-in client lists only their own, newest first, and the ticket is among them", async () => {
  const r = await call("support-track", {}, CLIENT);
  const refs = r.body.mine.map((x) => x.ref);
  assert.ok(refs.includes(signedRef));
  assert.ok(!refs.includes(anonRef), "an unclaimed anonymous ticket is not shown to someone else");
  const o = await call("support-track", {}, OTHER);
  assert.ok(!o.body.mine.some((x) => x.ref === signedRef));
});

test("the widget code carries no phone number: both come from site/data/site.json", () => {
  const js = fs.readFileSync("site/assets/js/bp-support-hub.js", "utf8");
  assert.ok(!/966\d{9}|\b05\d{8}\b/.test(js), "no number written in bp-support-hub.js");
  const site = JSON.parse(fs.readFileSync("site/data/site.json", "utf8"));
  assert.ok(site.contact.whatsappAgent && site.contact.whatsappSupport && site.contact.whatsappAgent !== site.contact.whatsappSupport);
  const inj = fs.readFileSync("site/scripts/baher-support.mjs", "utf8");
  assert.ok(!/966\d{9}|\b05\d{8}\b/.test(inj), "no number written in the injector either");
  assert.ok(site.contact.hoursRule && Array.isArray(site.contact.hoursRule.days));
});

test("built pages: one hub, both numbers from site.json, and no second green WhatsApp button beside it", () => {
  const site = JSON.parse(fs.readFileSync("site/data/site.json", "utf8"));
  const intl = (n) => "966" + String(n).replace(/^0/, "");
  for (const p of ["site/ar/index.html", "site/index.html", "site/ar/cart.html", "site/ar/services/bp-ai-03.html"]) {
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, "utf8");
    assert.equal((html.match(/id="bpsCfg"/g) || []).length, 1, p + ": exactly one hub");
    assert.ok(html.includes(`"agent":"${intl(site.contact.whatsappAgent)}"`), p + ": smart-advisor number");
    assert.ok(html.includes(`"human":"${intl(site.contact.whatsappSupport)}"`), p + ": human-team number");
    assert.ok(!html.includes('class="sv1-wa-fab"'), p + ": the old floating button is folded into the hub");
    assert.ok(!html.includes('class="bps-fab" id="bpsFab"'), p + ": the old support widget markup is gone");
  }
});
