// Creates the "Farah Memory" Postgres credential on Azure n8n (password from env FP, never printed).
// Usage:  FP='…' N8N_AZURE_API_KEY='…' node ops/azure-n8n/farah-cred.mjs
const BASE = process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const KEY = process.env.N8N_AZURE_API_KEY || process.env.AZ_KEY;
if (!KEY || !process.env.FP) { console.log("Set N8N_AZURE_API_KEY and FP"); process.exit(1); }
const body = { name: "Farah Memory", type: "postgres", data: { host: "bp-n8n-pg.postgres.database.azure.com", port: 5432, database: "n8n", user: "farah_app", password: process.env.FP, ssl: "require", allowUnauthorizedCerts: false, maxConnections: 100, sshTunnel: false } };
const r = await fetch(`${BASE}/api/v1/credentials`, { method: "POST", headers: { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const t = await r.text();
console.log("create credential:", r.status, r.ok ? "ok" : t.slice(0, 300));
process.exit(r.ok ? 0 : 1);
