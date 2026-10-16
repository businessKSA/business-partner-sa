// ai-space/api: the owner-only proxy between the unified panel and n8n on Azure.
// Pure function (request, env, fetch) -> response, so no Azure is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { handle, OPS } = require("../ai-space/api/_lib/proxy.js");

const principal = (roles) => Buffer.from(JSON.stringify({ userRoles: roles })).toString("base64");
const owner = { "x-ms-client-principal": principal(["anonymous", "authenticated", "owner"]) };
const env = {
  BP_N8N_BASE: "https://n8n.example/",
  BP_FARAH_KEY: "KEY-VALUE",
  BP_PATH_CHAT: "/webhook/chat-x",
  BP_PATH_PULSE: "/webhook/pulse-x",
  BP_PATH_VOICE: "/webhook/voice-x",
};
const fakeFetch = (calls, res = {}) => async (url, init) => {
  calls.push({ url, init });
  return {
    ok: res.ok ?? true, status: res.status ?? 200,
    headers: new Map([["content-type", res.type ?? "application/json"]]).constructor === Map
      ? { get: (k) => (k.toLowerCase() === "content-type" ? (res.type ?? "application/json") : null) } : null,
    arrayBuffer: async () => Buffer.from(res.body ?? '{"reply":"ok"}'),
  };
};

test("no principal -> 403, upstream never called", async () => {
  const calls = [];
  const r = await handle({ op: "chat", method: "POST", headers: {}, rawBody: "{}" }, env, fakeFetch(calls));
  assert.equal(r.status, 403); assert.equal(calls.length, 0);
});

test("authenticated but not owner -> 403", async () => {
  const h = { "x-ms-client-principal": principal(["anonymous", "authenticated"]) };
  const r = await handle({ op: "chat", method: "POST", headers: h, rawBody: "{}" }, env, fakeFetch([]));
  assert.equal(r.status, 403);
});

test("garbage principal -> 403", async () => {
  const r = await handle({ op: "chat", method: "POST", headers: { "x-ms-client-principal": "%%%" }, rawBody: "{}" }, env, fakeFetch([]));
  assert.equal(r.status, 403);
});

test("owner chat: key header sent to the default (Azure) base, path from settings", async () => {
  const calls = [];
  const r = await handle({ op: "chat", method: "POST", headers: owner, rawBody: '{"message":"hi"}' }, env, fakeFetch(calls));
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, "https://n8n.example/webhook/chat-x");
  assert.equal(calls[0].init.headers["X-BP-Farah-Key"], "KEY-VALUE");
  assert.equal(calls[0].init.body, '{"message":"hi"}');
});

test("key is NOT sent when the op is pointed at another base (Cloud transition)", async () => {
  const calls = [];
  await handle({ op: "chat", method: "POST", headers: owner, rawBody: "{}" },
    { ...env, BP_BASE_CHAT: "https://cloud.example" }, fakeFetch(calls));
  assert.equal(calls[0].url, "https://cloud.example/webhook/chat-x");
  assert.equal(calls[0].init.headers["X-BP-Farah-Key"], undefined);
});

test("ops that do not need the key never get it", async () => {
  const calls = [];
  await handle({ op: "pulse", method: "GET", headers: owner }, env, fakeFetch(calls));
  assert.equal(calls[0].init.headers["X-BP-Farah-Key"], undefined);
});

test("unconfigured op -> 503 naming the setting only", async () => {
  const r = await handle({ op: "health", method: "GET", headers: owner }, env, fakeFetch([]));
  assert.equal(r.status, 503);
  assert.equal(JSON.parse(r.body).setting, "BP_PATH_HEALTH");
});

test("unknown op 404, wrong method 405", async () => {
  assert.equal((await handle({ op: "../x", method: "GET", headers: owner }, env, fakeFetch([]))).status, 404);
  assert.equal((await handle({ op: "chat", method: "GET", headers: owner }, env, fakeFetch([]))).status, 405);
});

test("path setting must look like a path (no host injection)", async () => {
  const r = await handle({ op: "pulse", method: "GET", headers: owner }, { ...env, BP_PATH_PULSE: "//evil.example/x" }, fakeFetch([]));
  assert.equal(r.status, 503);
});

test("chatresult forwards only a sane job id", async () => {
  const calls = [];
  await handle({ op: "chatresult", method: "GET", headers: owner, query: { job: "abc_12-3" } },
    { ...env, BP_PATH_CHAT_RESULT: "/webhook/res" }, fakeFetch(calls));
  assert.equal(calls[0].url, "https://n8n.example/webhook/res?job=abc_12-3");
  calls.length = 0;
  await handle({ op: "chatresult", method: "GET", headers: owner, query: { job: "a&b=../" } },
    { ...env, BP_PATH_CHAT_RESULT: "/webhook/res" }, fakeFetch(calls));
  assert.equal(calls[0].url, "https://n8n.example/webhook/res");
});

test("upstream errors are reduced to a status code; 401/403 become 502", async () => {
  const r = await handle({ op: "chat", method: "POST", headers: owner, rawBody: "{}" }, env,
    fakeFetch([], { ok: false, status: 403, body: "secret path /webhook/abc" }));
  assert.equal(r.status, 502);
  assert.ok(!r.body.includes("webhook"));
});

test("timeout -> 504; network failure -> 502", async () => {
  const abort = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
  assert.equal((await handle({ op: "pulse", method: "GET", headers: owner }, env, abort)).status, 504);
  const down = async () => { throw new Error("ECONNREFUSED internal-host"); };
  const r = await handle({ op: "pulse", method: "GET", headers: owner }, env, down);
  assert.equal(r.status, 502); assert.ok(!r.body.includes("internal-host"));
});

test("voice returns binary audio untouched", async () => {
  const r = await handle({ op: "voice", method: "POST", headers: owner, rawBody: '{"text":"a"}' }, env,
    fakeFetch([], { type: "audio/mpeg", body: "ID3AUDIO" }));
  assert.equal(r.binary, true); assert.equal(r.headers["Content-Type"], "audio/mpeg");
  assert.equal(Buffer.from(r.body).toString(), "ID3AUDIO");
});

test("oversized body rejected before the network", async () => {
  const calls = [];
  const r = await handle({ op: "chat", method: "POST", headers: owner, rawBody: "x".repeat(70 * 1024) }, env, fakeFetch(calls));
  assert.equal(r.status, 413); assert.equal(calls.length, 0);
});

test("every upstream timeout stays under the 45s Static Web Apps ceiling", () => {
  for (const [name, o] of Object.entries(OPS)) assert.ok(o.timeout < 45000, name);
});

test("repo hygiene: no webhook path, key or n8n host literal in ai-space", () => {
  const files = ["index.html", "app.js", "jarvis.js", "config.example.js", "staticwebapp.config.json", "api/_lib/proxy.js", "api/bp/index.js"];
  for (const f of files) {
    const t = fs.readFileSync(new URL(`../ai-space/${f}`, import.meta.url), "utf8");
    assert.ok(!/\/webhook\//.test(t), `${f} contains a /webhook/ path`);
    assert.ok(!/n8n\.cloud|azurecontainerapps\.io/.test(t), `${f} contains an n8n host`);
  }
});

test("static web app config: /api and everything else owner-only, api not rewritten to index", () => {
  const c = JSON.parse(fs.readFileSync(new URL("../ai-space/staticwebapp.config.json", import.meta.url), "utf8"));
  const api = c.routes.find((r) => r.route === "/api/*");
  assert.deepEqual(api.allowedRoles, ["owner"]);
  assert.ok(c.navigationFallback.exclude.includes("/api/*"));
  assert.equal(c.routes.find((r) => r.route === "/*").allowedRoles[0], "owner");
});

test("main api/ stays within the 12-function ceiling (ai-space functions live elsewhere)", () => {
  const n = fs.readdirSync(new URL("../api/", import.meta.url)).filter((f) => f.endsWith(".js") && !f.startsWith("_")).length;
  assert.ok(n <= 12, `api/ has ${n} function files`);
});
