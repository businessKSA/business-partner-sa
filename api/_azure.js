// Azure OpenAI (AI Foundry) — the platform's only intelligence provider.
// Paid from the Microsoft for Startups credit, so it goes first everywhere.
//
// The site used to fan out across Gemini, Groq, Anthropic and OpenAI. That is
// what made "the agents stopped working" a recurring outage: one exhausted
// balance on one vendor took the whole team down. Resilience now stays inside
// Azure — a primary deployment and a secondary one in a different Azure region.
// No non-Azure provider is called from anywhere in api/.
//
// Env (values live in Vercel only, never in the repo):
//   AZURE_OPENAI_ENDPOINT         https://<resource>.openai.azure.com   (or AZURE_AI_ENDPOINT)
//   AZURE_OPENAI_KEY              the resource key                       (or AZURE_OPENAI_API_KEY / AZURE_AI_KEY)
//   AZURE_OPENAI_DEPLOYMENT       general deployment, e.g. gpt-4o-mini
//   AZURE_OPENAI_TEXT_DEPLOYMENT  optional cheaper text deployment; wins for prose
//   AZURE_OPENAI_VISION_DEPLOYMENT optional; falls back to the general deployment
//
//   AZURE_OPENAI_ENDPOINT_2 / _KEY_2 / _DEPLOYMENT_2   second region, same shape
//
// Wire format: the unified v1 route `{endpoint}/openai/v1/chat/completions`
// with the deployment name in `model`; key in both headers because the legacy
// route reads `api-key` and v1 accepts `Authorization`; `max_completion_tokens`,
// not `max_tokens`, because gpt-5 and o-series reject the latter.
//
// Entra ID (managed identity) is deliberately not used: these run as Vercel
// functions outside Azure, where there is no identity to federate from.

export const AZURE_KEYS = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_API_KEY", "AZURE_AI_KEY"];
const envFrom = (names) => { for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); } return ""; };
const clean = (u) => String(u || "").trim().replace(/\/+$/, "");

export const azureEndpoint = () => clean(process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_AI_ENDPOINT);
export const azureKey = () => envFrom(AZURE_KEYS);
export const azureConfigured = () => !!(azureEndpoint() && azureKey());
export const azureTextDeployment = () => String(process.env.AZURE_OPENAI_TEXT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini").trim();
export const azureVisionDeployment = () => String(process.env.AZURE_OPENAI_VISION_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || azureTextDeployment()).trim();

/**
 * Configured regions, primary first. A region is only real when it has an
 * endpoint and a key; a half-set second region is absent rather than a target
 * that fails at call time.
 */
export function azureRegions() {
  const out = [];
  if (azureEndpoint() && azureKey()) {
    out.push({ label: "azure-primary", endpoint: azureEndpoint(), key: azureKey(), text: azureTextDeployment(), vision: azureVisionDeployment() });
  }
  const e2 = clean(process.env.AZURE_OPENAI_ENDPOINT_2 || process.env.AZURE_AI_ENDPOINT_2);
  const k2 = envFrom(["AZURE_OPENAI_KEY_2", "AZURE_OPENAI_API_KEY_2", "AZURE_AI_KEY_2"]);
  if (e2 && k2) {
    const d2 = String(process.env.AZURE_OPENAI_DEPLOYMENT_2 || process.env.AZURE_OPENAI_TEXT_DEPLOYMENT_2 || azureTextDeployment()).trim();
    out.push({ label: "azure-secondary", endpoint: e2, key: k2, text: d2, vision: String(process.env.AZURE_OPENAI_VISION_DEPLOYMENT_2 || d2).trim() });
  }
  return out;
}

/** Names only — never a key value, so this is safe on a health route. */
export const azureHealth = () =>
  azureRegions().map((r) => ({ region: r.label, endpoint: r.endpoint, deployment: r.text, visionDeployment: r.vision }));

/**
 * A 429/408/5xx is the other region's cue. A 4xx is our own bug (wrong
 * deployment name, bad key, malformed body) and repeating it in the second
 * region only doubles the latency before the identical failure.
 */
const worthFailover = (status) => status === 429 || status === 408 || status >= 500;

async function callRegion(region, deployment, body, timeoutMs) {
  const r = await fetch(`${region.endpoint}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${region.key}`, "api-key": region.key, "content-type": "application/json" },
    body: JSON.stringify({ ...body, model: deployment }),
    signal: AbortSignal.timeout(timeoutMs || 45000),
  });
  if (!r.ok) {
    const err = new Error(`azure ${r.status}: ${(await r.text()).slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

/**
 * Plain chat. `messages` is [{role, content}] without the system turn.
 * Throws "no_key" when Azure is not configured — the string the existing
 * callers already branch on.
 */
export async function azureChat({ system, messages, maxTokens, temperature, timeoutMs, json, vision } = {}) {
  const regions = azureRegions();
  if (!regions.length) throw new Error("no_key");

  const body = {
    max_completion_tokens: maxTokens || 1200,
    messages: [...(system ? [{ role: "system", content: system }] : []), ...(messages || [])],
  };
  if (typeof temperature === "number") body.temperature = temperature;
  if (json) body.response_format = { type: "json_object" };

  const errors = [];
  for (const region of regions) {
    try {
      const text = await callRegion(region, vision ? region.vision : region.text, body, timeoutMs);
      if (text) return text;
      errors.push(`${region.label}: empty reply`);
    } catch (e) {
      errors.push(`${region.label} ${e.message || e}`.slice(0, 200));
      if (e.status && !worthFailover(e.status)) break;
    }
  }
  throw new Error(errors.join(" | ") || "azure: no answer");
}

/**
 * One image plus a prompt, in the shape Azure OpenAI shares with the OpenAI
 * chat-completions API. PDFs are not accepted here by Azure — they go through
 * Azure AI Document Intelligence in api/_docread.js.
 */
export function azureVision({ base64, mime, prompt, system, maxTokens, timeoutMs } = {}) {
  return azureChat({
    system,
    vision: true,
    maxTokens: maxTokens || 1500,
    timeoutMs: timeoutMs || 60000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  });
}
