import test from "node:test";
import assert from "node:assert/strict";
import { handleAiws, sanitizePlans, validateTrial, _resetAiwsState, aiwsSubscriptions, validateSetup, handleAiwsMy, handleAiwsReady, handleAiwsOps } from "../api/_aiws.js";

const upstream = { lang: "en", currency: "USD", plans: [
  { code: "trial", name: "Starter", base: 0, total: 0, amount: 0, credit_usd: 200, seats: 5, days: 30, models: ["bp-main"], features: ["chat", "files"] },
  { code: "enterprise", name: "Enterprise", base: 100, total: 128, credit_usd: 1000, seats: 100, days: 30, features: ["chat", "sso", "audit"] },
] };

test("الباقات تصل بلا أسعار ولا نماذج، بلا باقة التجربة، وتُحذف ميزة SSO غير الموجودة", () => {
  const p = sanitizePlans(upstream);
  assert.deepEqual(p.map((x) => x.code), ["enterprise"]);
  for (const x of p) for (const k of ["base", "total", "amount", "fees", "vat", "models"]) assert.ok(!(k in x), k);
  assert.deepEqual(p[0].features, ["chat", "audit"]);
});

test("plans: تُخزَّن عشر دقائق، والفشل يعيد 502", async () => {
  _resetAiwsState();
  let calls = 0;
  const f = async () => { calls++; return { ok: true, json: async () => upstream }; };
  const a = await handleAiws({ action: "plans", lang: "ar" }, { fetch: f, now: 1000 });
  const b = await handleAiws({ action: "plans", lang: "ar" }, { fetch: f, now: 2000 });
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(calls, 1);
  _resetAiwsState();
  const bad = await handleAiws({ action: "plans" }, { fetch: async () => ({ ok: false, status: 500 }), now: 1 });
  assert.equal(bad.status, 502);
});

test("طلب التجربة: بريد شخصي يُرفض، وبريد الشركة يُقبل ويصل إلى n8n بحمولته", async () => {
  _resetAiwsState();
  assert.deepEqual(validateTrial({ company: "ش", name: "", email: "a@gmail.com", phone: "1" }).errors, ["company", "name", "email_free", "phone"]);
  let sent = null;
  const f = async (url, opt) => { sent = { url, body: JSON.parse(opt.body) }; return { ok: true }; };
  const r = await handleAiws({ action: "trial", company: "شركة س", name: "سارة", email: "S@Co.sa", phone: "0500000000", team: "6-20" }, { fetch: f, ip: "1.1.1.1", now: Date.UTC(2026, 9, 16) });
  assert.equal(r.status, 200); assert.match(r.body.ref, /^AI-261016-/);
  assert.match(sent.url, /revenue-intake$/);
  assert.equal(sent.body.email, "s@co.sa");
  assert.equal(sent.body.source_channel, "website-ai");
  assert.equal(sent.body.event_id, r.body.ref);
});

test("طلب التجربة: المصيدة لا ترسل شيئاً، والحدّ أربعة طلبات في عشر دقائق", async () => {
  _resetAiwsState();
  let n = 0;
  const f = async () => { n++; return { ok: true }; };
  const ok = { action: "trial", company: "شركة س", name: "سارة", email: "s@co.sa", phone: "0500000000" };
  assert.equal((await handleAiws({ ...ok, hp: "x" }, { fetch: f, ip: "2.2.2.2" })).status, 200);
  assert.equal(n, 0);
  for (let i = 0; i < 4; i++) assert.equal((await handleAiws(ok, { fetch: f, ip: "3.3.3.3", now: 1000 + i })).status, 200);
  assert.equal((await handleAiws(ok, { fetch: f, ip: "3.3.3.3", now: 2000 })).status, 429);
});

test("محلياً: لا يصل شيء إلى n8n", async () => {
  _resetAiwsState();
  let n = 0, boxed = null;
  const r = await handleAiws({ action: "trial", company: "شركة س", name: "سارة", email: "s@co.sa", phone: "0500000000" },
    { fetch: async () => { n++; return { ok: true }; }, dev: true, outbox: async (e) => { boxed = e; } });
  assert.equal(r.status, 200); assert.equal(n, 0); assert.equal(boxed.kind, "n8n");
});

import { aiwsPlanOf, activateAiws } from "../api/_aiws.js";

test("aiwsPlanOf: معرّفات السلة ← رمز باقة المنصة، وغيرها فارغ", () => {
  assert.equal(aiwsPlanOf("svc-bp-aiws-bus"), "business");
  assert.equal(aiwsPlanOf("SVC-BP-AIWS-BPLUS"), "business_plus");
  assert.equal(aiwsPlanOf("bp-aiws-ent"), "enterprise");
  assert.equal(aiwsPlanOf("svc-bp-ai-03"), "");
  assert.equal(aiwsPlanOf("agent-compliance-agent"), "");
});

test("activateAiws: محلياً إلى الصندوق، وبلا إعداد لا يرسل، وحمولة ناقصة تُرفض", async () => {
  let boxed = null, sent = 0;
  const o = { ref: "BP-1", payId: "pay_1", plans: [{ sku: "BP-AIWS-BUS", plan: "business", qty: 1 }], company: "شركة", name: "س", email: "S@co.sa", phone: "05", total: 215.63 };
  const dev = await activateAiws(o, { dev: true, outbox: async (e) => { boxed = e; }, fetch: async () => { sent++; return { ok: true }; } });
  assert.equal(dev.ok, true); assert.equal(sent, 0);
  assert.equal(boxed.payload.event, "aiws.paid"); assert.equal(boxed.payload.email, "s@co.sa"); assert.equal(boxed.payload.plans[0].plan, "business");
  const off = await activateAiws(o, { fetch: async () => { sent++; return { ok: true }; } });
  assert.equal(off.ok, false); assert.equal(off.error, "not_configured"); assert.equal(sent, 0);
  assert.equal((await activateAiws({ ...o, payId: "" }, { dev: true })).ok, false);
});

/* ───── قسم /my ───── */
const ORG = "org-1";
const paidRow = (id, ref, at, items, extra = {}) => ({ id, ref, status: "PAID", created_at: at, payment: { status: "PAID", source: "cart", at, items, ...extra } });

function fakeDb(rows, events = []) {
  const ev = [...events], puts = [], calls = [];
  const sb = async (path, opts = {}) => {
    calls.push(path);
    if (opts.method === "POST" && path === "request_events") { ev.unshift({ ...opts.body, created_at: new Date().toISOString() }); return []; }
    if (path.startsWith("requests?organization_id=eq.")) return path.includes(ORG) ? rows : [];
    if (path.startsWith("requests?ref=eq.")) { const ref = path.slice(16).split("&")[0]; return rows.filter((r) => r.ref === ref).map((r) => ({ id: r.id, organization_id: ORG })); }
    if (path.startsWith("request_events?request_id=in.")) { const ids = path.slice(30).split(")")[0].split(","); return ev.filter((e) => ids.includes(e.request_id)); }
    if (path.startsWith("request_events?event=eq.aiws.setup")) return ev.filter((e) => e.event === "aiws.setup");
    return [];
  };
  return { sb, ev, puts, calls, storagePut: async (k, b, m) => { puts.push({ k, n: b.length, m }); return k; }, storageSign: async (k) => "https://signed/" + k };
}
const sess = (orgId = ORG) => ({ user: { id: "u1", email: "ceo@acme.sa" }, organization: orgId ? { id: orgId } : null });

test("aiwsSubscriptions: بنود svc-bp-aiws-* المدفوعة وحدها، والتجديد بعد ثلاثين يوماً", () => {
  const rows = [
    paidRow("r1", "BP-R-AAAA01", "2026-10-01T10:00:00Z", [{ id: "svc-bp-aiws-bus", code: "BP-AIWS-BUS", qty: 1, amount: 187.5 }, { id: "svc-cr-renew", qty: 1 }]),
    { id: "r2", ref: "BP-R-AAAA02", status: "NEW", payment: { status: "PENDING", items: [{ id: "svc-bp-aiws-ent" }] } },
  ];
  const s = aiwsSubscriptions(rows, Date.parse("2026-10-17T00:00:00Z"));
  assert.equal(s.length, 1);
  assert.equal(s[0].plan, "business"); assert.equal(s[0].sku, "BP-AIWS-BUS");
  assert.equal(s[0].renews_at, "2026-10-31"); assert.equal(s[0].state, "active");
  assert.equal(aiwsSubscriptions(rows, Date.parse("2026-11-05T00:00:00Z"))[0].state, "renewal_due");
});

test("validateSetup: الرابط بحروف صغيرة وغير محجوز، والبريد صحيح، والشعار صورة نقطية صغيرة", () => {
  const ok = validateSetup({ company: "أكمي", slug: "acme-co", color: "#112233", admins: "ceo@acme.sa, it@acme.sa" });
  assert.deepEqual(ok.errors, []); assert.deepEqual(ok.fields.admins, ["ceo@acme.sa", "it@acme.sa"]);
  for (const slug of ["ab", "acme_co", "-acme", "acme-", "a--b", "www", "admin", "x".repeat(31)]) assert.ok(validateSetup({ company: "x y", slug, admins: "a@b.sa" }).errors.includes("slug"), slug);
  assert.ok(validateSetup({ company: "x y", slug: "acme", admins: "nope" }).errors.includes("admins"));
  assert.ok(validateSetup({ company: "x y", slug: "acme", admins: "a@b.sa", logo: { mime: "image/svg+xml", b64: "PHN2Zz4=" } }).errors.includes("logo_type"));
  const big = Buffer.alloc(301 * 1024).toString("base64");
  assert.ok(validateSetup({ company: "x y", slug: "acme", admins: "a@b.sa", logo: { mime: "image/png", b64: big } }).errors.includes("logo_size"));
});

test("my: بلا جلسة 401، وبلا اشتراك قائمة فارغة، والمشترك يرى باقته ومساحته بانتظار بياناته", async () => {
  assert.equal((await handleAiwsMy("my", {}, { sess: null })).status, 401);
  const none = fakeDb([]);
  const r0 = await handleAiwsMy("my", {}, { sess: sess(), sb: none.sb });
  assert.deepEqual(r0.body.subscriptions, []);
  const db = fakeDb([paidRow("r1", "BP-R-AAAA01", "2026-10-16T10:00:00Z", [{ id: "svc-bp-aiws-bus", qty: 1 }])]);
  const f = async () => ({ ok: true, json: async () => ({ plans: [{ code: "business", seats: 5, credit_usd: 50 }] }) });
  _resetAiwsState();
  const r = await handleAiwsMy("my", { lang: "ar" }, { sess: sess(), sb: db.sb, fetch: f, storageSign: db.storageSign });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscriptions[0].plan, "business");
  assert.ok(!("request_id" in r.body.subscriptions[0]));
  assert.equal(r.body.workspace.status, "needs_setup");
  assert.deepEqual(r.body.plan, { seats: 5, credit_sar: 188 });
});

test("setup: يحفظ ويرسل للتجهيز، والرابط المأخوذ لمنشأة أخرى يُرفض، وبعد الجاهزية لا يتغيّر", async () => {
  const other = { request_id: "rX", event: "aiws.setup", details: { slug: "taken" }, created_at: "2026-10-10T00:00:00Z" };
  const db = fakeDb([paidRow("r1", "BP-R-AAAA01", "2026-10-16T10:00:00Z", [{ id: "svc-bp-aiws-bus", qty: 1 }])], [other]);
  const sent = [];
  const ctx = { sess: sess(), sb: db.sb, storagePut: db.storagePut, storageSign: db.storageSign, activate: async (p) => { sent.push(p); return { ok: true } } };
  const noSub = await handleAiwsMy("setup", { company: "أكمي", slug: "acme", admins: "ceo@acme.sa" }, { ...ctx, sb: fakeDb([]).sb });
  assert.equal(noSub.status, 403);
  assert.equal((await handleAiwsMy("setup", { company: "أكمي", slug: "taken", admins: "ceo@acme.sa" }, ctx)).body.error, "slug_taken");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
  const r = await handleAiwsMy("setup", { company: "أكمي", slug: "acme", color: "#0B1B5A", admins: "ceo@acme.sa", logo: { mime: "image/png", b64: png } }, ctx);
  assert.equal(r.status, 200); assert.equal(r.body.status, "provisioning"); assert.equal(r.body.queued, true);
  assert.equal(db.puts.length, 1); assert.ok(db.puts[0].k.startsWith("aiws/org-1/logo-"));
  assert.equal(sent[0].event, "aiws.setup"); assert.equal(sent[0].slug, "acme"); assert.equal(sent[0].ref, "BP-R-AAAA01");
  assert.ok(sent[0].logo_url.startsWith("https://signed/aiws/org-1/"));
  // the same org may re-save its own slug
  assert.equal((await handleAiwsMy("setup", { company: "أكمي", slug: "acme", admins: "ceo@acme.sa" }, ctx)).status, 200);
  const my = await handleAiwsMy("my", {}, { ...ctx, fetch: async () => ({ ok: false }) });
  assert.equal(my.body.workspace.status, "provisioning"); assert.equal(my.body.workspace.slug, "acme");
  assert.ok(!("logo_key" in my.body.workspace));
  // ready → slug locked
  db.ev.unshift({ request_id: "r1", event: "aiws.ready", details: { url: "https://acme.businesspartner.sa" }, created_at: new Date().toISOString() });
  assert.equal((await handleAiwsMy("setup", { company: "أكمي", slug: "acme2", admins: "ceo@acme.sa" }, ctx)).body.error, "slug_locked");
  const ready = await handleAiwsMy("my", {}, { ...ctx, fetch: async () => ({ ok: false }) });
  assert.equal(ready.body.workspace.status, "ready"); assert.equal(ready.body.workspace.url, "https://acme.businesspartner.sa");
});

test("ready: بمفتاح المفعّل وحده، ورابط على نطاق الموقع وحده", async () => {
  const db = fakeDb([paidRow("r1", "BP-R-AAAA01", "2026-10-16T10:00:00Z", [{ id: "svc-bp-aiws-bus", qty: 1 }])]);
  const notes = [];
  const ctx = { sb: db.sb, notify: async (n) => { notes.push(n) }, dev: true };
  assert.equal((await handleAiwsReady({ ref: "BP-R-AAAA01", url: "https://acme.businesspartner.sa" }, { ...ctx, key: "wrong" })).status, 403);
  assert.equal((await handleAiwsReady({ ref: "BP-R-AAAA01", url: "https://evil.example.com" }, { ...ctx, key: "dev-activator" })).status, 400);
  assert.equal((await handleAiwsReady({ ref: "BP-R-ZZZZ99", url: "https://acme.businesspartner.sa" }, { ...ctx, key: "dev-activator" })).status, 404);
  const ok = await handleAiwsReady({ ref: "BP-R-AAAA01", url: "https://acme.businesspartner.sa/" }, { ...ctx, key: "dev-activator" });
  assert.equal(ok.status, 200);
  assert.equal(db.ev[0].event, "aiws.ready"); assert.equal(db.ev[0].details.url, "https://acme.businesspartner.sa");
  assert.equal(notes.length, 1); assert.equal(notes[0].organization_id, ORG);
});

test("ops: أرقام المشتركين بلا محتوى، والتجريبي خارج الإيراد، والمالك يسجّل الجاهزية", async () => {
  const rows = [
    { ...paidRow("r1", "BP-R-AAAA01", "2026-10-16T10:00:00Z", [{ id: "svc-bp-aiws-bus", code: "BP-AIWS-BUS", qty: 1, amount: 187.5 }]), organization_id: ORG, client_email: "ceo@acme.sa", company_name: "أكمي" },
    { ...paidRow("r2", "BP-R-AAAA02", "2026-10-15T10:00:00Z", [{ id: "svc-bp-aiws-ent", code: "BP-AIWS-ENT", qty: 1, amount: 750 }], { test: true }), organization_id: "org-2", client_email: "t@test.local" },
    { ...paidRow("r3", "BP-R-AAAA03", "2026-10-15T10:00:00Z", [{ id: "svc-cr-renew", qty: 1, amount: 50 }]), organization_id: "org-3" },
  ];
  const setup = { request_id: "r1", event: "aiws.setup", details: { company: "أكمي للتقنية", slug: "acme", color: "#112233", admins: ["it@acme.sa"], logo_key: "aiws/org-1/logo.png" }, created_at: "2026-10-16T11:00:00Z" };
  const db = fakeDb(rows, [setup]);
  const allReqs = async (path, opts) => path.startsWith("requests?select=") ? rows : db.sb(path, opts);
  const f = async () => ({ ok: true, json: async () => ({ plans: [{ code: "business", seats: 5 }, { code: "enterprise", seats: 100 }] }) });
  _resetAiwsState();
  const r = await handleAiwsOps("ops", {}, { sb: allReqs, fetch: f, now: Date.parse("2026-10-20T00:00:00Z") });
  assert.equal(r.status, 200);
  assert.equal(r.body.rows.length, 2);
  const a = r.body.rows.find((x) => x.ref === "BP-R-AAAA01");
  assert.equal(a.company, "أكمي للتقنية"); assert.equal(a.ws_status, "provisioning"); assert.equal(a.slug, "acme"); assert.equal(a.seats, 5);
  assert.equal(a.users, null); assert.equal(r.body.usage_source, "pending");
  for (const k of ["admins", "logo_key", "logo_url", "color", "details"]) assert.ok(!(k in a), k);
  assert.deepEqual({ active: r.body.totals.active, mrr: r.body.totals.mrr, test: r.body.totals.test, provisioning: r.body.totals.provisioning, needs_setup: r.body.totals.needs_setup }, { active: 1, mrr: 187.5, test: 1, provisioning: 1, needs_setup: 1 });
  assert.equal((await handleAiwsOps("ops-ready", { ref: "BP-R-AAAA01", url: "https://evil.com" }, { sb: db.sb })).status, 400);
  const ok = await handleAiwsOps("ops-ready", { ref: "BP-R-AAAA01", url: "https://acme.businesspartner.sa" }, { sb: db.sb });
  assert.equal(ok.status, 200); assert.equal(db.ev[0].event, "aiws.ready"); assert.equal(db.ev[0].actor, "owner");
});
