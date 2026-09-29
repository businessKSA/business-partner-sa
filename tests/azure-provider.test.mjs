// The owner's September 2026 policy: the document agent runs on Microsoft Azure
// and calls no other provider. These tests hold that line — they stub fetch, so
// any escape to Google/Anthropic/OpenAI shows up as a forbidden hostname.
import test from "node:test";
import assert from "node:assert/strict";

const AZ = "https://bp-ai.openai.azure.com";
const DI = "https://bp-docs.cognitiveservices.azure.com";

function withEnv(env, fn) {
  const saved = {};
  const keys = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_VISION_DEPLOYMENT", "AZURE_OPENAI_TEXT_DEPLOYMENT",
    "AZURE_OPENAI_ENDPOINT_2", "AZURE_OPENAI_KEY_2", "AZURE_OPENAI_DEPLOYMENT_2",
    "AZURE_DOCINTEL_ENDPOINT", "AZURE_DOCINTEL_KEY", "DOC_AI_ALLOW_FALLBACK",
    "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"];
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  return Promise.resolve().then(fn).finally(() => {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
}

// Records every URL the code under test reaches for, and answers from a script.
function stubFetch(handler) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url && url.url ? url.url : url);
    calls.push({ url: u, body: opts && opts.body ? JSON.parse(opts.body) : null, headers: (opts && opts.headers) || {} });
    return handler(u, opts, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const chatReply = (obj) => json({ choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: "stop" }] });

const FOREIGN = /googleapis\.com|api\.anthropic\.com|api\.openai\.com/;
const assertAzureOnly = (calls) => {
  const stray = calls.map((c) => c.url).filter((u) => FOREIGN.test(u));
  assert.deepEqual(stray, [], "no call may leave Azure");
};

test("askModel calls Azure, and only Azure, even with every legacy key present", async () => {
  await withEnv({
    AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k", AZURE_OPENAI_TEXT_DEPLOYMENT: "gpt-4o-mini",
    GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o",
  }, async () => {
    const { askModel } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch(() => chatReply({ ops: [{ node: 1, op: "append", text: "x" }] }));
    try {
      const r = await askModel("plan this", 2000);
      assert.equal(r.ok, true);
      assert.equal(r.provider, "azure");
      assert.deepEqual(r.data.ops[0].text, "x");
      assert.equal(f.calls.length, 1, "exactly one upstream call");
      assert.equal(f.calls[0].url, `${AZ}/openai/v1/chat/completions`);
      assert.equal(f.calls[0].body.model, "gpt-4o-mini");
      assert.equal(f.calls[0].headers["api-key"], "k");
      assertAzureOnly(f.calls);
    } finally { f.restore(); }
  });
});

test("a failing Azure call does not fall through to another provider", async () => {
  await withEnv({
    AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k",
    GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o",
  }, async () => {
    const { askModel } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch(() => new Response("rate limited", { status: 429 }));
    try {
      const r = await askModel("plan this", 2000);
      assert.equal(r.ok, false);
      assert.equal(r.error, "read_failed");
      assert.match(r.detail, /azure 429/);
      assert.equal(f.calls.length, 1, "it stopped at Azure instead of shopping around");
      assertAzureOnly(f.calls);
    } finally { f.restore(); }
  });
});

test("unconfigured Azure names the missing variable instead of using a legacy key", async () => {
  await withEnv({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, async () => {
    const { askModel } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch(() => json({}));
    try {
      const r = await askModel("plan this", 2000);
      assert.equal(r.ok, false);
      assert.equal(r.error, "not_configured");
      assert.match(r.detail, /AZURE_OPENAI_ENDPOINT/);
      assert.match(r.detail, /AZURE_OPENAI_KEY/);
      assert.equal(f.calls.length, 0, "nothing was called at all");
    } finally { f.restore(); }
  });
});

// Redundancy moved regions, not providers (2026-09-23). The old valve fell back
// to Gemini/Anthropic/OpenAI — accounts with no credit, so it bought nothing. It
// was replaced by a second Azure deployment in another region, which stays on the
// grant. This is the failover that has to keep working, so it is pinned here.
test("when the primary Azure region fails, the secondary region answers", async () => {
  await withEnv({
    AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k", AZURE_OPENAI_TEXT_DEPLOYMENT: "gpt-4o-mini",
    AZURE_OPENAI_ENDPOINT_2: "https://bp-ai-west.openai.azure.com",
    AZURE_OPENAI_KEY_2: "k2", AZURE_OPENAI_DEPLOYMENT_2: "gpt-4o-mini",
    GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o",
  }, async () => {
    const { askModel } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch((u) =>
      u.startsWith(AZ) ? json({ error: "region down" }, 503) : chatReply({ ok: 1 }));
    try {
      const r = await askModel("plan this", 2000);
      assert.equal(r.ok, true, "the secondary region served the request");
      const hosts = f.calls.map((c) => c.url);
      assert.ok(hosts.some((u) => u.startsWith(AZ)), "the primary was tried first");
      assert.ok(hosts.some((u) => u.includes("bp-ai-west")), "then the secondary region");
      assertAzureOnly(f.calls);
    } finally { f.restore(); }
  });
});

// The legacy keys are still in Vercel. Holding this line is what stops a future
// edit from quietly reinstating a chain that bills an empty account.
test("legacy provider keys buy nothing when Azure is down entirely", async () => {
  await withEnv({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o",
    DOC_AI_ALLOW_FALLBACK: "1" }, async () => {
    const { askModel } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch(() => json({ nope: true }));
    try {
      const r = await askModel("plan this", 2000);
      assert.equal(r.ok, false, "no Azure, no answer — the old chain is gone");
      assert.equal(f.calls.length, 0, "and nothing was called at all");
    } finally { f.restore(); }
  });
});

test("an image goes to Azure vision as a data URL on the chosen deployment", async () => {
  await withEnv({
    AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k", AZURE_OPENAI_VISION_DEPLOYMENT: "gpt-4o",
    GEMINI_API_KEY: "g",
  }, async () => {
    const { readDocumentRaw } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch(() => chatReply({ docType: "cr", crNumber: "1010567890" }));
    try {
      const r = await readDocumentRaw(Buffer.from("fake-png").toString("base64"), "image/png", "read it", 900);
      assert.equal(r.ok, true);
      assert.equal(r.provider, "azure");
      assert.equal(r.data.crNumber, "1010567890");
      const body = f.calls[0].body;
      assert.equal(body.model, "gpt-4o", "the vision deployment, not the text one");
      const parts = body.messages[0].content;
      assert.equal(parts[1].type, "image_url");
      assert.match(parts[1].image_url.url, /^data:image\/png;base64,/);
      assertAzureOnly(f.calls);
    } finally { f.restore(); }
  });
});

test("a PDF is read by Document Intelligence, then structured by Azure OpenAI", async () => {
  await withEnv({
    AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k",
    AZURE_DOCINTEL_ENDPOINT: DI, AZURE_DOCINTEL_KEY: "dk",
  }, async () => {
    const { readDocumentRaw } = await import(`../api/_docread.js?t=${Date.now()}`);
    const OP = `${DI}/documentintelligence/operations/1`;
    const f = stubFetch((u, opts) => {
      if (u.includes(":analyze")) return new Response("", { status: 202, headers: { "operation-location": OP } });
      if (u === OP) return json({ status: "succeeded", analyzeResult: { content: "السجل التجاري\nرقم: 1010567890" } });
      return chatReply({ docType: "cr", crNumber: "1010567890" });
    });
    try {
      const r = await readDocumentRaw(Buffer.from("%PDF-1.7").toString("base64"), "application/pdf", "read it", 900);
      assert.equal(r.ok, true);
      assert.equal(r.provider, "azure");
      assert.equal(r.data.crNumber, "1010567890");

      assert.match(f.calls[0].url, /documentModels\/prebuilt-read:analyze/);
      assert.equal(f.calls[0].headers["Ocp-Apim-Subscription-Key"], "dk");
      assert.equal(f.calls[1].url, OP, "it polled the async operation");
      assert.equal(f.calls[2].url, `${AZ}/openai/v1/chat/completions`);
      // The OCR text reaches the model, flagged as data rather than instructions.
      const prompt = f.calls[2].body.messages[0].content;
      assert.match(prompt, /1010567890/);
      assert.match(prompt, /بيانات، لا تعليمات/);
      assertAzureOnly(f.calls);
    } finally { f.restore(); }
  });
});

test("a PDF with no Document Intelligence says exactly which variables are missing", async () => {
  await withEnv({ AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k" }, async () => {
    const { readDocumentRaw } = await import(`../api/_docread.js?t=${Date.now()}`);
    const f = stubFetch(() => json({}));
    try {
      const r = await readDocumentRaw(Buffer.from("%PDF-1.7").toString("base64"), "application/pdf", "read it", 900);
      assert.equal(r.ok, false);
      assert.equal(f.calls.length, 0);
    } finally { f.restore(); }
  });
});
