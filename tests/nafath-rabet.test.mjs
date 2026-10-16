// «رابط»: الاتصال كما يصفه ملف OpenAPI الذي نزّله المالك (nafath-app.json، 2026-10-16).
// لا اتصال حقيقياً: fetch مستبدَل بمحاكٍ يسجّل ما يُرسَل.
import test from "node:test";
import assert from "node:assert/strict";
import rabet from "../api/_nafath-rabet.js";

const SET = { RABET_APP_ID: "test-id-123", RABET_APP_KEY: "test-key-456", RABET_BASE_URL: "https://rabet.example.test/nafath", RABET_SERVICE: "svc-test" };
const keep = {}; const realFetch = globalThis.fetch;
function env(o) { for (const k of Object.keys(SET)) { keep[k] = process.env[k]; delete process.env[k]; } Object.assign(process.env, o); }
function restore() { for (const k of Object.keys(SET)) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; } globalThis.fetch = realFetch; }
function stub(res, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return { ok: status < 400, status, text: async () => JSON.stringify(res) }; };
  return calls;
}

test("rabet: not configured until all four settings exist, and plain http is refused", () => {
  env({}); assert.equal(rabet.configured(), false); assert.deepEqual(rabet.missing().sort(), Object.keys(SET).sort()); restore();
  env({ ...SET, RABET_BASE_URL: "http://insecure.test" }); assert.equal(rabet.configured(), false); restore();
  env({ ...SET, RABET_BASE_URL: "rabet.example.test/nafath" }); assert.equal(rabet.configured(), true); restore(); // no scheme → https
  env(SET); assert.equal(rabet.configured(), true); restore();
});

test("rabet request: path, query (local, requestId), both header spellings, body per the document", async () => {
  env(SET);
  try {
    const calls = stub({ transId: "bb0fd95a-baa2-83ce-3f36-4ffc92fd49d0", random: "42" });
    const out = await rabet.request({ nationalId: "1000000001", locale: "en" });
    assert.equal(out.transId, "bb0fd95a-baa2-83ce-3f36-4ffc92fd49d0");
    assert.equal(out.random, "42");
    assert.match(out.requestId, /^[0-9a-f-]{36}$/);
    const c = calls[0]; const u = new URL(c.url);
    assert.equal(u.origin + u.pathname, "https://rabet.example.test/nafath/api/v1/mfa/request");
    assert.equal(u.searchParams.get("local"), "en");
    assert.equal(u.searchParams.get("requestId"), out.requestId);
    assert.equal(c.init.method, "POST");
    for (const [k, v] of [["APP-ID", "test-id-123"], ["APP-KEY", "test-key-456"], ["app_id", "test-id-123"], ["app_key", "test-key-456"]]) assert.equal(c.init.headers[k], v);
    assert.deepEqual(JSON.parse(c.init.body), { nationalId: "1000000001", service: "svc-test" });
    assert.ok(!c.url.includes("test-key-456"), "the key is never in the URL");
  } finally { restore(); }
});

test("rabet request: a response without a two-digit number is refused, never shown to the user", async () => {
  env(SET);
  try {
    stub({ transId: "t", random: "lorem ipsum" });
    await assert.rejects(() => rabet.request({ nationalId: "1000000001" }), /nafath_bad_response/);
    stub({ transId: "t" });
    await assert.rejects(() => rabet.request({ nationalId: "1000000001" }), /nafath_bad_response/);
  } finally { restore(); }
});

test("rabet status: body per the document, and only the four documented statuses pass", async () => {
  env(SET);
  try {
    for (const s of ["WAITING", "EXPIRED", "REJECTED", "COMPLETED"]) {
      const calls = stub({ status: s });
      const out = await rabet.status({ nationalId: "1000000001", transId: "t-1", random: "42" });
      assert.equal(out.status, s);
      assert.equal(new URL(calls[0].url).pathname, "/nafath/api/v1/mfa/request/status");
      assert.deepEqual(JSON.parse(calls[0].init.body), { nationalId: "1000000001", transId: "t-1", random: "42" });
    }
    stub({ status: "APPROVED" });
    await assert.rejects(() => rabet.status({ nationalId: "1000000001", transId: "t", random: "42" }), /nafath_bad_response/);
  } finally { restore(); }
});

test("rabet: 401/403 become nafath_unauthorized, and no error text carries the credentials", async () => {
  env(SET);
  const logged = []; const keepErr = console.error; console.error = (...a) => logged.push(a.join(" "));
  try {
    stub({ message: "bad key test-key-456" }, 403);
    await assert.rejects(() => rabet.request({ nationalId: "1000000001" }), (e) => e.message === "nafath_unauthorized" && !JSON.stringify([e.message, e.detail]).includes("test-key-456"));
    assert.ok(!logged.join("\n").includes("test-key-456"));
    stub({}, 500);
    await assert.rejects(() => rabet.request({ nationalId: "1000000001" }), /nafath_http_500/);
  } finally { console.error = keepErr; restore(); }
});

test("rabet: with no settings it throws before any network call", async () => {
  env({});
  try {
    let hit = 0; globalThis.fetch = async () => { hit++; return { ok: true, status: 200, text: async () => "{}" }; };
    await assert.rejects(() => rabet.request({ nationalId: "1000000001", service: "x" }), /nafath_not_configured/);
    await assert.rejects(() => rabet.status({ nationalId: "1000000001", transId: "t", random: "42" }), /nafath_not_configured/);
    assert.equal(hit, 0);
  } finally { restore(); }
});
