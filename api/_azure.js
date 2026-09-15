// Business Partner — Azure OpenAI as the single model provider (ESM helper).
//
// Owner decision (2026-09-15): the digital infrastructure is Microsoft Azure.
// Every model call — the site chat, the hiring console, the candidate agent,
// CV rewriting — goes to Azure OpenAI. The data itself stays in Notion.
//
// Azure's chat-completions endpoint is OpenAI-shaped with three differences
// that matter: the `model` field carries the DEPLOYMENT name rather than a
// public model id, the key is accepted in an `api-key` header as well as a
// bearer token, and the budget field is `max_completion_tokens`.
//
// Env (set in Vercel / .env.local — never in the repo, never in Notion):
//   AZURE_OPENAI_ENDPOINT     https://<resource>.openai.azure.com
//   AZURE_OPENAI_KEY          resource key, or AZURE_OPENAI_API_KEY
//   AZURE_OPENAI_DEPLOYMENT   deployment name you created (default gpt-4o-mini)
//   AZURE_ALLOW_FALLBACK=1    optional escape hatch — see azureOnly()
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th function.

const envFrom = (names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
};

const ENDPOINT_KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_AI_ENDPOINT", "AZURE_OPENAI_BASE_URL", "AZURE_OPENAI_URL"];
const API_KEYS = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_API_KEY", "AZURE_AI_KEY"];
const DEPLOYMENT_KEYS = ["AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_MODEL", "AZURE_OPENAI_DEPLOYMENT_NAME"];

// ‏مسار v1 الموحّد: `{endpoint}/openai/v1/chat/completions` واسم النشر
// (deployment) في خانة `model`. هذا ما جُرّب فعلياً على مورد المالك، وهو
// يُغني عن تثبيت api-version لأن Azure تتكفّل بذلك على المسار الموحّد.
const DEFAULT_DEPLOYMENT = "gpt-4o-mini";

export const azureEndpoint = () => envFrom(ENDPOINT_KEYS).replace(/\/+$/, "");
export const azureKey = () => envFrom(API_KEYS);
export const azureDeployment = () => envFrom(DEPLOYMENT_KEYS) || DEFAULT_DEPLOYMENT;

// Azure is usable when the endpoint and the key are both present. The
// deployment name has a working default, so it is not part of the test.
export const azureConfigured = () => !!(azureEndpoint() && azureKey());

// Once Azure is configured it is the ONLY provider: the owner asked for one
// infrastructure, and a silent fall back to Google or OpenAI would quietly
// undo that — data would leave Azure without anyone deciding it should.
// It is also the only funded provider (Microsoft for Startups credits), so a
// fallback is a call that fails on an unpaid account rather than a rescue.
// AZURE_ALLOW_FALLBACK=1 restores the old multi-provider chain, deliberately.
export const azureOnly = () => azureConfigured() && envFrom(["AZURE_ALLOW_FALLBACK"]) !== "1";

// What is missing, in words, for a startup log or a local dev message.
export function azureMissing() {
  const gaps = [];
  if (!azureEndpoint()) gaps.push("AZURE_OPENAI_ENDPOINT");
  if (!azureKey()) gaps.push("AZURE_OPENAI_KEY");
  return gaps;
}

// One chat-completions call. `messages` is the OpenAI shape; callers that only
// have a prompt can pass a system string and let this build the pair.
//
// The key travels in BOTH headers because the classic deployment path reads
// `api-key` while the unified v1 path accepts `Authorization` — sending both
// keeps this working whichever one the resource is serving. And the budget
// field is `max_completion_tokens`, not `max_tokens`: gpt-5 and the o-series
// reject the older name outright.
export async function azureChat(messages, maxTokens, system) {
  if (!azureConfigured()) throw new Error(`azure not configured (${azureMissing().join(", ")})`);
  const key = azureKey();
  const body = {
    model: azureDeployment(),
    max_completion_tokens: maxTokens || 1200,
    messages: system ? [{ role: "system", content: system }, ...messages] : messages,
  };
  const r = await fetch(`${azureEndpoint()}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    // Azure's own error text names the real cause (wrong deployment, quota,
    // content filter), and losing it turns every failure into "azure 400".
    const detail = await r.text().catch(() => "");
    throw new Error(`azure ${r.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const d = await r.json();
  return (d?.choices?.[0]?.message?.content || "").trim();
}

// Prompt-in, text-out — the shape the hiring console and CV rewriter use.
export async function azureText(prompt, maxTokens, system) {
  return azureChat([{ role: "user", content: String(prompt || "") }], maxTokens, system);
}
