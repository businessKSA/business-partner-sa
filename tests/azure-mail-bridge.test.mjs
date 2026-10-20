// جسر البريد (ops/azure/mail-bridge.mjs): ترجمة Resend → ACS، التوقيع، إعادة المحاولة عند 429،
// الفشل المغلق (لا نداء إلى Resend أبداً)، جمهور النشرة، واستيراد CSV. لا شبكة: fetch مُحاكى.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  parseAddress, resendToAcs, acsConfig, acsHeaders, handleResendCall, installMailBridge, upsertContact,
  parseCsv, contactsFromCsv,
} from "../ops/azure/mail-bridge.mjs";

const KEY = Buffer.from("test-key-bytes").toString("base64");
const ENV = { ACS_CONNECTION_STRING: `endpoint=https://bp-acs.uae.communication.azure.com/;accesskey=${KEY}`, ACS_SENDER_ADDRESS: "DoNotReply@mail.example.test" };
const quiet = () => {};
const memStore = (ready = true) => {
  const data = new Map();
  return { data, async ready() { return ready; }, async load(id) { return JSON.parse(JSON.stringify(data.get(id) || [])); }, async save(id, v) { data.set(id, JSON.parse(JSON.stringify(v))); } };
};
const acsOk = (id = "op-1") => new Response(JSON.stringify({ id, status: "Running" }), { status: 202, headers: { "content-type": "application/json" } });
const call = (body, deps, method = "POST", path = "/emails") =>
  handleResendCall(`https://api.resend.com${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }, { log: quiet, store: memStore(), sleepImpl: async () => {}, ...deps });

test("parseAddress: plain, named, quoted, junk", () => {
  assert.deepEqual(parseAddress("a@b.co"), { name: "", address: "a@b.co" });
  assert.deepEqual(parseAddress("Business Partner <noreply@x.sa>"), { name: "Business Partner", address: "noreply@x.sa" });
  assert.deepEqual(parseAddress('"باهر" <b@x.sa>'), { name: "باهر", address: "b@x.sa" });
  assert.equal(parseAddress("not an email"), null);
  assert.equal(parseAddress(""), null);
});

test("resendToAcs: maps recipients, html/text, reply_to, cc/bcc, attachments; sender is the ACS one", () => {
  const out = resendToAcs({
    from: "Business Partner <noreply@businesspartner.sa>", to: ["a@x.sa", "Ali <ali@x.sa>"], cc: "c@x.sa", bcc: ["d@x.sa"],
    subject: "موضوع", html: "<p>س</p>", text: "نص", reply_to: "r@x.sa",
    attachments: [{ filename: "inv.pdf", content: "QUJD" }, { filename: "x.bin", content: "AA==", content_type: "application/x-foo" }],
  }, "DoNotReply@mail.example.test");
  assert.equal(out.senderAddress, "DoNotReply@mail.example.test");
  assert.deepEqual(out.recipients.to, [{ address: "a@x.sa" }, { address: "ali@x.sa", displayName: "Ali" }]);
  assert.deepEqual(out.recipients.cc, [{ address: "c@x.sa" }]);
  assert.deepEqual(out.recipients.bcc, [{ address: "d@x.sa" }]);
  assert.deepEqual(out.replyTo, [{ address: "r@x.sa" }]);
  assert.deepEqual(out.content, { subject: "موضوع", html: "<p>س</p>", plainText: "نص" });
  assert.deepEqual(out.attachments, [
    { name: "inv.pdf", contentType: "application/pdf", contentInBase64: "QUJD" },
    { name: "x.bin", contentType: "application/x-foo", contentInBase64: "AA==" },
  ]);
  assert.equal(out.userEngagementTrackingDisabled, true);
});

test("resendToAcs: rejects what Resend would reject (422) instead of sending a broken mail", () => {
  for (const bad of [{ subject: "s", html: "h" }, { to: "a@x.sa", html: "h" }, { to: "a@x.sa", subject: "s" },
    { to: "a@x.sa", subject: "s", html: "h", attachments: [{ filename: "a.pdf", path: "https://x/y.pdf" }] }]) {
    assert.throws(() => resendToAcs(bad, "s@x"), (e) => e.status === 422, JSON.stringify(Object.keys(bad)));
  }
});

test("acsHeaders: HMAC-SHA256 over method, path, date;host;content-hash (same recipe as api/_azure_notify.js)", () => {
  const cfg = acsConfig(ENV);
  const now = new Date("2026-10-16T10:00:00Z");
  const h = acsHeaders(cfg, "POST", "/emails:send?api-version=2023-03-31", "{}", now);
  const hash = crypto.createHash("sha256").update("{}").digest("base64");
  const sig = crypto.createHmac("sha256", Buffer.from(KEY, "base64"))
    .update(`POST\n/emails:send?api-version=2023-03-31\n${now.toUTCString()};bp-acs.uae.communication.azure.com;${hash}`).digest("base64");
  assert.equal(h["x-ms-content-sha256"], hash);
  assert.equal(h.Authorization, `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${sig}`);
});

test("POST /emails → one signed ACS call; the caller gets Resend's shape (200 + id)", async () => {
  const seen = [];
  const realFetch = async (url, init) => { seen.push({ url, init }); return acsOk("op-77"); };
  const r = await call({ from: "x <n@x.sa>", to: ["a@x.sa"], subject: "s", html: "<b>h</b>" }, { cfg: acsConfig(ENV), realFetch });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { id: "op-77" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://bp-acs.uae.communication.azure.com/emails:send?api-version=2023-03-31");
  assert.match(seen[0].init.headers.Authorization, /^HMAC-SHA256 SignedHeaders=/);
  assert.equal(JSON.parse(seen[0].init.body).senderAddress, "DoNotReply@mail.example.test");
});

test("429 from ACS is retried with Retry-After (max 3), then succeeds; a hard 4xx is passed through without retry", async () => {
  let n = 0; const waits = [];
  const throttled = async () => (++n <= 2 ? new Response("slow down", { status: 429, headers: { "retry-after": "3" } }) : acsOk());
  const r = await call({ to: "a@x.sa", subject: "s", html: "h" }, { cfg: acsConfig(ENV), realFetch: throttled, sleepImpl: async (ms) => { waits.push(ms); } });
  assert.equal(r.status, 200);
  assert.deepEqual(waits, [3000, 3000]);
  let m = 0;
  const refused = await call({ to: "a@x.sa", subject: "s", html: "h" }, { cfg: acsConfig(ENV), realFetch: async () => { m++; return new Response('{"error":{"code":"InvalidSender"}}', { status: 400 }); } });
  assert.equal(refused.status, 400);
  assert.equal(m, 1);
  let k = 0;
  const forever = await call({ to: "a@x.sa", subject: "s", html: "h" }, { cfg: acsConfig(ENV), realFetch: async () => { k++; return new Response("", { status: 429 }); } });
  assert.equal(forever.status, 429);
  assert.equal(k, 4, "المحاولة الأولى + ٣ إعادات");
});

test("failure bodies never echo the message content or recipients", async () => {
  const logs = [];
  const r = await call({ to: "secret-person@x.sa", subject: "TOP-SECRET-SUBJECT", html: "BODY-SECRET" },
    { cfg: acsConfig(ENV), log: (o) => logs.push(o), realFetch: async () => new Response("denied", { status: 403 }) });
  const text = JSON.stringify(await r.json()) + JSON.stringify(logs);
  assert.doesNotMatch(text, /secret-person|TOP-SECRET|BODY-SECRET|accesskey|test-key/);
});

test("fail closed: ACS not configured → 503 and no outbound call at all", async () => {
  let calls = 0;
  const r = await call({ to: "a@x.sa", subject: "s", html: "h" }, { cfg: acsConfig({}), realFetch: async () => { calls++; return acsOk(); } });
  assert.equal(r.status, 503);
  assert.equal(calls, 0);
  assert.deepEqual(acsConfig({ ACS_CONNECTION_STRING: ENV.ACS_CONNECTION_STRING }).missing, ["ACS_SENDER_ADDRESS"]);
});

test("unsupported Resend endpoints answer 501 and never leave the process", async () => {
  let calls = 0;
  const r = await call(undefined, { cfg: acsConfig(ENV), realFetch: async () => { calls++; return acsOk(); } }, "GET", "/domains");
  assert.equal(r.status, 501);
  assert.equal(calls, 0);
});

test("audience: add contact (upsert by email, case-insensitive), list in Resend shape, unsubscribed kept", async () => {
  const store = memStore();
  const deps = { cfg: acsConfig(ENV), store, realFetch: async () => { throw new Error("no network"); } };
  assert.equal((await call({ email: "A@X.sa", first_name: "Ali", unsubscribed: false }, deps, "POST", "/audiences/aud1/contacts")).status, 200);
  assert.equal((await call({ email: "a@x.sa", last_name: "Saad" }, deps, "POST", "/audiences/aud1/contacts")).status, 200);
  assert.equal((await call({ email: "b@x.sa", unsubscribed: true }, deps, "POST", "/audiences/aud1/contacts")).status, 200);
  assert.equal((await call({ email: "nope" }, deps, "POST", "/audiences/aud1/contacts")).status, 422);
  const list = await (await call(undefined, deps, "GET", "/audiences/aud1/contacts")).json();
  assert.equal(list.object, "list");
  assert.equal(list.data.length, 2);
  const a = list.data.find((c) => c.email === "a@x.sa");
  assert.equal(a.first_name, "Ali");
  assert.equal(a.last_name, "Saad", "التحديث يدمج ولا يمسح");
  assert.equal(list.data.find((c) => c.email === "b@x.sa").unsubscribed, true);
  // هذا ما تقرؤه newsletter.js: !c.unsubscribed → c.email
  assert.deepEqual(list.data.filter((c) => !c.unsubscribed).map((c) => c.email), ["a@x.sa"]);
  const down = await call(undefined, { ...deps, store: memStore(false) }, "GET", "/audiences/aud1/contacts");
  assert.equal(down.status, 503);
});

test("installMailBridge wraps fetch: Resend calls are intercepted, every other host passes through untouched, restore() undoes it", async () => {
  const seen = [];
  const target = { fetch: async (u) => { seen.push(String(u)); return acsOk("x"); } };
  const b = installMailBridge({ env: ENV, target, store: memStore(), log: quiet });
  assert.equal(b.ready, true);
  await target.fetch("https://api.notion.com/v1/pages");
  const r = await target.fetch("https://api.resend.com/emails", { method: "POST", body: JSON.stringify({ to: "a@x.sa", subject: "s", html: "h" }) });
  assert.equal(r.status, 200);
  assert.ok(seen.includes("https://api.notion.com/v1/pages"));
  assert.ok(seen.some((u) => u.startsWith("https://bp-acs.uae.communication.azure.com/emails:send")));
  assert.ok(!seen.some((u) => u.includes("resend.com")), "لا نداء إلى Resend");
  b.restore();
  await target.fetch("https://api.resend.com/emails", { method: "POST", body: "{}" });
  assert.ok(seen.some((u) => u.includes("resend.com")), "بعد restore يعود السلوك الأصلي");
  const closed = { fetch: async (u) => { seen.push("LEAK " + u); return acsOk(); } };
  const c = installMailBridge({ env: {}, target: closed, log: quiet });
  assert.equal(c.ready, false);
  const res = await closed.fetch("https://api.resend.com/emails", { method: "POST", body: "{}" });
  assert.equal(res.status, 503);
  assert.ok(!seen.some((u) => u.startsWith("LEAK")));
});

test("CSV import: quoted fields, unsubscribed, duplicates, invalid rows — stats only, no values", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\n'), [["a", "b"], ["x, y", 'he said "hi"']]);
  const csv = 'email,first_name,last_name,unsubscribed,created_at\n' +
    'Ali@X.sa,Ali,"Saad, Jr",false,2026-01-02T00:00:00Z\n' +
    'bad-email,x,y,false,\n' +
    'zed@x.sa,,,true,\n' +
    'ali@x.sa,Ali,,false,\n';
  const { contacts, stats } = contactsFromCsv(csv);
  assert.deepEqual(stats, { rows: 4, valid: 2, invalid: 1, unsubscribed: 1, duplicates: 1 });
  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].last_name, "Saad, Jr");
  assert.equal(contacts.find((c) => c.email === "zed@x.sa").unsubscribed, true);
  assert.throws(() => contactsFromCsv("name\nx"), /email/);
  const l = []; upsertContact(l, { email: "k@x.sa" }); upsertContact(l, { email: "K@x.sa", unsubscribed: true });
  assert.equal(l.length, 1);
  assert.equal(l[0].unsubscribed, true);
});
