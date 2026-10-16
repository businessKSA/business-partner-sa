import test from "node:test";
import assert from "node:assert/strict";
import { handleAiws, sanitizePlans, validateTrial, _resetAiwsState } from "../api/_aiws.js";

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
