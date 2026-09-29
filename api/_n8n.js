// Business Partner — one place for where n8n lives.
//
// docs/n8n-to-azure-migration.md step 2: the base moves from n8n Cloud to
// Azure by changing N8N_BASE_URL in Vercel, not by hunting literals across
// the API and the build. The default is today's n8n Cloud instance, so
// nothing changes until the variable is set. Build-time pages get the same
// value from N8N_BASE in site/scripts/generate.mjs.
export const N8N_BASE_URL = String(process.env.N8N_BASE_URL || "https://businesspartnerai.app.n8n.cloud").trim().replace(/\/+$/, "");
export function n8nWebhook(path) {
  return `${N8N_BASE_URL}/webhook/${String(path || "").replace(/^\/+/, "")}`;
}
