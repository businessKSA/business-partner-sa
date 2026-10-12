// After (re)copying data tables from n8n Cloud to Azure, the agent registry still holds CLOUD workflow ids.
// This maps Cloud ids -> Azure ids by workflow name and rewrites BP_Agent_Registry.workflow_id on Azure.
// Usage: N8N_CLOUD_API_KEY=… N8N_AZURE_API_KEY=… node ops/azure-n8n/registry-ids.mjs [--apply]
const AZ = (process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io") + "/api/v1";
const CL = (process.env.N8N_CLOUD_URL || "https://businesspartnerai.app.n8n.cloud") + "/api/v1";
const AZK = process.env.N8N_AZURE_API_KEY, CLK = process.env.N8N_CLOUD_API_KEY;
if (!AZK || !CLK) { console.log("Set N8N_AZURE_API_KEY and N8N_CLOUD_API_KEY"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const call = async (base, key, path, opt = {}) => { const r = await fetch(base + path, { headers: { "X-N8N-API-KEY": key, "Content-Type": "application/json" }, ...opt }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { ok: r.ok, status: r.status, body: j }; };
async function list(base, key) { let all = [], cur = ""; do { const r = await call(base, key, `/workflows?limit=100${cur ? `&cursor=${cur}` : ""}`); if (!r.ok) throw new Error("list " + r.status); all.push(...r.body.data); cur = r.body.nextCursor || ""; } while (cur); return all; }
const cloud = await list(CL, CLK), az = await list(AZ, AZK);
const byName = {}; for (const a of az) (byName[a.name] ??= []).push(a);
const map = {}; for (const c of cloud) if (byName[c.name]) map[c.id] = byName[c.name][0].id;
const T = (await call(AZ, AZK, "/data-tables?limit=100")).body.data.find(d => d.name === "BP_Agent_Registry");
if (!T) { console.log("BP_Agent_Registry not found on Azure"); process.exit(1); }
const rows = (await call(AZ, AZK, `/data-tables/${T.id}/rows?limit=250`)).body.data;
const need = [...new Set(rows.map(r => r.workflow_id).filter(id => id && map[id]))];
console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN", "| cloud ids to rewrite:", need.length);
if (APPLY) for (const o of need) { const r = await call(AZ, AZK, `/data-tables/${T.id}/rows/update`, { method: "PATCH", body: JSON.stringify({ filter: { type: "and", filters: [{ columnName: "workflow_id", condition: "eq", value: o }] }, data: { workflow_id: map[o] } }) }); console.log(o, "->", map[o], r.ok ? "ok" : r.status); }
