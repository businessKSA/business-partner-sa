// Azure OpenAI (AI Foundry) — prose chat for the hiring chain (api/hire.js,
// reused by api/candidate.js). Document reading, PDF OCR and speech live in
// api/_docread.js with their own JSON-shaped calls; this is the general one.
// Paid from the Microsoft for Startups credit, so it goes first everywhere.
//
// Env (values live in Vercel only, never in the repo):
//   AZURE_OPENAI_ENDPOINT         https://<resource>.openai.azure.com   (or AZURE_AI_ENDPOINT)
//   AZURE_OPENAI_KEY              the resource key                       (or AZURE_OPENAI_API_KEY / AZURE_AI_KEY)
//   AZURE_OPENAI_DEPLOYMENT       general deployment, e.g. gpt-4o-mini
//   AZURE_OPENAI_TEXT_DEPLOYMENT  optional cheaper text deployment; wins for prose
//
// Wire format: the unified v1 route `{endpoint}/openai/v1/chat/completions`
// with the deployment name in `model`; key in both headers because the legacy
// route reads `api-key` and v1 accepts `Authorization`; `max_completion_tokens`,
// not `max_tokens`, because gpt-5 and o-series reject the latter.

export const AZURE_KEYS = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_API_KEY", "AZURE_AI_KEY"];
const envFrom = (names) => { for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); } return ""; };

export const azureEndpoint = () => String(process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_AI_ENDPOINT || "").trim().replace(/\/+$/, "");
export const azureKey = () => envFrom(AZURE_KEYS);
export const azureConfigured = () => !!(azureEndpoint() && azureKey());
export const azureTextDeployment = () => String(process.env.AZURE_OPENAI_TEXT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini").trim();

/** Plain chat. `messages` is [{role, content}] without the system turn. Throws "no_key" when Azure is not configured. */
export async function azureChat({ system, messages, maxTokens, temperature, timeoutMs } = {}) {
  const endpoint = azureEndpoint();
  const key = azureKey();
  if (!endpoint || !key) throw new Error("no_key");
  const body = {
    model: azureTextDeployment(),
    max_completion_tokens: maxTokens || 1200,
    messages: [...(system ? [{ role: "system", content: system }] : []), ...(messages || [])],
  };
  if (typeof temperature === "number") body.temperature = temperature;
  const r = await fetch(`${endpoint}/openai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs || 45000),
  });
  if (!r.ok) throw new Error(`azure ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return String(data?.choices?.[0]?.message?.content || "").trim();
}
