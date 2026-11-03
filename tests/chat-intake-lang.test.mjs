// Intake chat language: Azure answers first (it carries intakeInstructions in
// the visitor's language), n8n is the last resort and is told the language, and
// the deterministic fallback honours lang. fetch is stubbed — no real network.
import test from "node:test";
import assert from "node:assert/strict";

const N8N = "businesspartnerai.app.n8n.cloud";
const ENV = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT_2", "AZURE_OPENAI_KEY_2"];

async function run({ azure, lang, messages, azureStatus = 200, n8nReply = "مرحباً بك" }) {
  const saved = {};
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  if (azure) { process.env.AZURE_OPENAI_ENDPOINT = "https://az.test"; process.env.AZURE_OPENAI_KEY = "k"; }
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    calls.push({ u, body });
    if (u.startsWith("https://az.test")) {
      return azureStatus === 200
        ? new Response(JSON.stringify({ choices: [{ message: { content: "Azure English reply" } }] }), { status: 200 })
        : new Response("boom", { status: azureStatus });
    }
    if (u.includes(N8N)) return new Response(JSON.stringify({ output: n8nReply }), { status: 200 });
    return new Response("{}", { status: 404 });
  };
  try {
    const { default: handler } = await import("../api/_chat.js");
    const req = { method: "POST", body: { mode: "intake", context: "consulting", lang, messages } };
    let out = "";
    const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
    await handler(req, res);
    return { reply: JSON.parse(out), calls };
  } finally {
    globalThis.fetch = real;
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
const hosts = (calls) => calls.map((c) => (c.u.startsWith("https://az.test") ? "azure" : c.u.includes(N8N) ? "n8n" : "other")).filter((h) => h !== "other");
const u = (content) => ({ role: "user", content });

test("intake: Azure answers first and n8n is never reached", async () => {
  const { reply, calls } = await run({ azure: true, lang: "en", messages: [u("I need a consultation")] });
  assert.equal(reply.provider, "azure");
  assert.deepEqual(hosts(calls), ["azure"]);
  const sys = calls.find((c) => c.u.startsWith("https://az.test")).body.messages[0];
  assert.equal(sys.role, "system");
  assert.match(sys.content, /English دائماً/);
  assert.match(sys.content, /بلغة غير لغة الصفحة/);
});

test("intake: n8n is last resort, after Azure fails, and gets the language rule", async () => {
  const { reply, calls } = await run({ azure: true, azureStatus: 400, lang: "en", messages: [u("hello")] });
  assert.deepEqual(hosts(calls), ["azure", "n8n"]);
  assert.equal(reply.provider, "baher-n8n");
  const n8n = calls.find((c) => c.u.includes(N8N)).body;
  assert.match(n8n.chatInput, /^Reply in English only/);
});

test("intake: n8n language rule per lang; Arabic is unchanged", async () => {
  for (const [lang, re] of [["fr", /^Reply in French only/], ["zh", /^Reply in Simplified Chinese only/], ["de", /^Reply in the visitor's language/]]) {
    const { calls } = await run({ azure: false, lang, messages: [u("hi")] });
    assert.match(calls.find((c) => c.u.includes(N8N)).body.chatInput, re, lang);
  }
  const { calls } = await run({ azure: false, lang: "ar", messages: [u("مرحبا")] });
  assert.match(calls.find((c) => c.u.includes(N8N)).body.chatInput, /^زائر موقع/);
});

test("intake: n8n reply without SCOPE after two turns becomes the English fallback", async () => {
  const { reply } = await run({ azure: false, lang: "en", messages: [u("a"), { role: "assistant", content: "q" }, u("b")] });
  assert.match(reply.reply, /<<SCOPE>>/);
  assert.match(reply.reply, /initial scope/);
  assert.match(reply.reply, /Review the current situation/);
});

test("intake: deterministic fallback is English when lang=en and every provider fails", async () => {
  const saved = globalThis.fetch;
  const { reply } = await run({ azure: false, lang: "en", messages: [u("hello")], n8nReply: "" });
  assert.equal(reply.provider, "intake-fallback");
  assert.match(reply.reply, /Got it\. What does the company do/);
  assert.equal(globalThis.fetch, saved);
});
