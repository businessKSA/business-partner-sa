// Farah Command Space — async wrapper for the owner panel (ai-space).
//
// Why: Azure Static Web Apps cuts any /api request at 45s, and Farah sometimes
// needs longer. This builds ONE new workflow on n8n Azure with two webhooks that
// share the workflow's static data:
//   POST  Async In   -> replies 202 {job_id} at once, then calls Farah's real
//                       Command Space webhook (up to 170s) and stores the reply.
//   GET   Result     -> ?job=<id> -> {status:'pending'|'done'|'error', reply}
// Both use the SAME header-auth credential as Command Space, so one key
// (BP_FARAH_KEY in the SWA settings) opens everything.
//
// The workflow is created INACTIVE and never activated here. Dry-run by default;
// `--apply` writes. Webhook paths are generated at apply time and live only in
// n8n — never in git. Idempotent by workflow name (refuses to duplicate).
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

export const NAME = "⏱️ فرح — Command Space غير متزامن (Async + Result)";
const FARAH_ID = "g2Y2k2KbxYwmhSqu";
const FARAH_IN = "Command Space Direct In";
const CRED = { id: "MjN7xsnHCn0jyblZ", name: "Header Auth — فرح Command Space (v3)" };

export const CODE_MAKE_JOB = `
const sd = $getWorkflowStaticData('global');
sd.jobs = sd.jobs || {};
const now = Date.now();
for (const k of Object.keys(sd.jobs)) if (now - sd.jobs[k].t > 3600e3) delete sd.jobs[k];
const b = ($input.first().json.body) || {};
const job = 'j' + now.toString(36) + Math.random().toString(36).slice(2, 10);
sd.jobs[job] = { t: now, status: 'pending' };
return [{ json: { job_id: job, payload: {
  message: String(b.message || '').slice(0, 20000),
  target_agent: String(b.target_agent || ''),
  source: String(b.source || 'command_space')
} } }];`.trim();

export const CODE_STORE = `
const sd = $getWorkflowStaticData('global');
sd.jobs = sd.jobs || {};
const job = $('Make Job').first().json.job_id;
const r = $input.first().json || {};
const reply = r.reply || r.output || r.text || '';
const bad = r.error || !reply;
sd.jobs[job] = bad
  ? { t: Date.now(), status: 'error', error: String((r.error && (r.error.message || r.error)) || 'رد فارغ من فرح').slice(0, 300) }
  : { t: Date.now(), status: 'done', reply: String(reply) };
return [{ json: { job_id: job, status: sd.jobs[job].status } }];`.trim();

export const CODE_LOOKUP = `
const sd = $getWorkflowStaticData('global');
const q = ($input.first().json.query) || {};
const job = String(q.job || '');
if (!/^[A-Za-z0-9_-]{1,80}$/.test(job)) return [{ json: { status: 'error', error: 'معرّف مهمة غير صالح' } }];
const j = (sd.jobs || {})[job];
// A job not found yet is pending: static data is saved when the long run ends.
if (!j) return [{ json: { status: 'pending' } }];
return [{ json: j.status === 'done' ? { status: 'done', reply: j.reply } : j.status === 'error' ? { status: 'error', error: j.error } : { status: 'pending' } }];`.trim();

export function buildWorkflow({ farahWebhookUrl, pathIn, pathResult }) {
  const id = () => crypto.randomUUID();
  const wh = (name, method, path, y) => ({
    id: id(), name, type: "n8n-nodes-base.webhook", typeVersion: 2.1, position: [0, y], webhookId: id(),
    parameters: { httpMethod: method, path, authentication: "headerAuth", responseMode: "responseNode", options: { ignoreBots: true } },
    credentials: { httpHeaderAuth: CRED },
  });
  const code = (name, js, x, y) => ({ id: id(), name, type: "n8n-nodes-base.code", typeVersion: 2, position: [x, y], parameters: { jsCode: js, language: "javaScript", mode: "runOnceForAllItems" } });
  const respond = (name, body, code, x, y) => ({
    id: id(), name, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.5, position: [x, y],
    parameters: { respondWith: "json", responseBody: body, options: { responseCode: code, responseHeaders: { entries: [{ name: "Cache-Control", value: "no-store" }] } } },
  });
  const nodes = [
    wh("Async In", "POST", pathIn, 0),
    code("Make Job", CODE_MAKE_JOB, 224, 0),
    respond("Ack 202", "={{ JSON.stringify({ job_id: $json.job_id, status: 'pending' }) }}", 202, 448, 0),
    {
      id: id(), name: "Call Farah", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [672, 0], onError: "continueRegularOutput",
      parameters: {
        method: "POST", url: farahWebhookUrl, authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth",
        sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify($json.payload) }}", options: { timeout: 170000 },
      },
      credentials: { httpHeaderAuth: CRED },
    },
    code("Store Result", CODE_STORE, 896, 0),
    wh("Result In", "GET", pathResult, 260),
    code("Lookup", CODE_LOOKUP, 224, 260),
    respond("Reply Status", "={{ JSON.stringify($json) }}", 200, 448, 260),
  ];
  const link = (a, b) => [a, { main: [[{ node: b, type: "main", index: 0 }]] }];
  const connections = Object.fromEntries([
    link("Async In", "Make Job"), link("Make Job", "Ack 202"), link("Ack 202", "Call Farah"),
    link("Call Farah", "Store Result"), link("Result In", "Lookup"), link("Lookup", "Reply Status"),
  ]);
  return { name: NAME, nodes, connections, settings: { executionOrder: "v1", executionTimeout: 240 } };
}

// ---------- CLI ----------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const BASE = (process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io").replace(/\/$/, "");
  const KEY = (process.env.N8N_AZURE_API_KEY || "").trim();
  if (!KEY) { console.log("Set N8N_AZURE_API_KEY"); process.exit(1); }
  const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
  const APPLY = process.argv.includes("--apply");
  const api = async (p, o = {}) => { const r = await fetch(BASE + "/api/v1" + p, { headers: H, ...o }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { ok: r.ok, status: r.status, body: j }; };

  const all = (await api("/workflows?limit=250")).body.data;
  if (all.some((w) => w.name === NAME)) { console.log("exists already — nothing to do"); process.exit(0); }
  const farah = (await api(`/workflows/${FARAH_ID}`)).body;
  const hook = farah.nodes.find((n) => n.name === FARAH_IN);
  if (!hook?.parameters?.path) { console.log("Command Space Direct In not found"); process.exit(1); }
  const hex = () => crypto.randomBytes(8).toString("hex");
  const wf = buildWorkflow({ farahWebhookUrl: `${BASE}/webhook/${hook.parameters.path}`, pathIn: `farah-async-${hex()}`, pathResult: `farah-result-${hex()}` });
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: create INACTIVE "${NAME}" (${wf.nodes.length} nodes)`);
  if (!APPLY) process.exit(0);
  const r = await api("/workflows", { method: "POST", body: JSON.stringify(wf) });
  console.log(r.ok ? `created ${r.body.id} active=${r.body.active}` : `FAILED ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
}
