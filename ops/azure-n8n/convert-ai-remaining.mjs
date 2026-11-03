// يحوّل عقد الذكاء الخارجية المتبقية في سير Azure غير النشطة إلى Azure OpenAI (النشر bp-main).
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/convert-ai-remaining.mjs          # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… BACKUP_DIR=… node ops/azure-n8n/convert-ai-remaining.mjs --apply
//
// يُغيَّر في سير Azure فقط (كلها غير نشطة) ولا يُفعَّل شيء. النسخة الاحتياطية تُكتب قبل أي PUT.
// خارج النطاق عمداً (تبقى كما هي وتُذكر في المذكرة):
//   - mytupyHHG9EIyzjL: باهر v2 يفتح جلسة Claude Managed Agents — ليست استدعاء نموذج، والطبقة محذوفة بقرار 2026-09-17.
//   - T7XUSox6eNNKLSZm: Email Marketing Network — توليد صور لا يغطيه bp-main، وعقدتا الرسائل فارغتان غير مكتملتان.
import fs from "node:fs";
import path from "node:path";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply");
const backupDir = process.env.BACKUP_DIR || ".";
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const CRED = { azureOpenAiApi: { id: "fI2SkJuYmB2v3zCo", name: "Azure Open AI account" } };
const URL = "https://bp-ai-ksa-2026.openai.azure.com/openai/deployments/bp-main/chat/completions?api-version=2025-03-01-preview";

const get = async (id) => (await fetch(`${B}/api/v1/workflows/${id}`, { headers: H })).json();
const put = async (w) => {
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy"].includes(k)));
  const r = await fetch(`${B}/api/v1/workflows/${w.id}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) throw new Error(`PUT ${w.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
};

// نص عقدة n8n (ثابت أو تعبير "={{ … }}") → تعبير JS لقالب نصي داخل JSON.stringify.
function asJs(content) {
  const s = String(content ?? "");
  if (!s.startsWith("=")) return JSON.stringify(s);
  const parts = s.slice(1).split(/(\{\{[\s\S]*?\}\})/g);
  return "`" + parts.map((p) => /^\{\{[\s\S]*\}\}$/.test(p)
    ? "${" + p.slice(2, -2).trim() + "}"
    : p.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")).join("") + "`";
}

const azHttp = (name, position, bodyExpr) => ({
  id: crypto.randomUUID(), name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position,
  parameters: {
    method: "POST", url: URL, authentication: "predefinedCredentialType", nodeCredentialType: "azureOpenAiApi",
    sendBody: true, specifyBody: "json", jsonBody: bodyExpr, options: { timeout: 90000 },
  },
  credentials: CRED,
});
const setField = (name, position, field, value) => ({
  id: crypto.randomUUID(), name, type: "n8n-nodes-base.set", typeVersion: 3.4, position,
  parameters: { assignments: { assignments: [{ id: "c1", name: field, type: "string", value }] }, includeOtherFields: false, options: {} },
});
const MSG = "$json.choices?.[0]?.message?.content || ''";

// يستبدل عقدة بسلسلة [HTTP → عقدة تعيد الشكل الذي يقرؤه ما بعدها] ويحفظ الوصلات.
function chain(w, oldName, http, tail) {
  const old = w.nodes.find((n) => n.name === oldName);
  if (!old) throw new Error(`لا توجد العقدة ${oldName}`);
  http.position = old.position; tail.position = [old.position[0] + 220, old.position[1]];
  w.nodes = w.nodes.filter((n) => n !== old).concat([http, tail]);
  for (const v of Object.values(w.connections)) for (const br of v.main || []) for (const c of br || []) if (c.node === oldName) c.node = http.name;
  const out = w.connections[oldName]; delete w.connections[oldName];
  w.connections[http.name] = { main: [[{ node: tail.name, type: "main", index: 0 }]] };
  w.connections[tail.name] = out || { main: [[]] };
}

// رسائل عقدة openAi/anthropic → مصفوفة JS داخل التعبير.
const msgsOf = (vals, system) => [
  ...(system ? [`{role:"system",content:${asJs(system)}}`] : []),
  ...vals.map((m) => `{role:${JSON.stringify(m.role || "user")},content:${asJs(m.content)}}`),
].join(",");

const jobs = {
  // نداء OpenAI HTTP جاهز بصيغة الدردشة نفسها: يكفي تغيير الوجهة والاعتماد.
  Ao2FXaIgHUQAFE8e(w) {
    const n = w.nodes.find((x) => x.name === "تحليل الامتثال (OpenAI)");
    n.parameters.url = URL; n.parameters.nodeCredentialType = "azureOpenAiApi"; n.credentials = CRED;
    return "تحليل الامتثال (OpenAI): الوجهة والاعتماد → Azure";
  },
  // Claude HTTP: يُحوَّل claudeRequest إلى صيغة الدردشة، ويُوسَّع محلّل ما بعده ليقرأ choices.
  _claudeHttp(w) {
    const n = w.nodes.find((x) => x.name === "Claude — تحليل الامتثال");
    n.name = "Azure — تحليل الامتثال";
    n.parameters = {
      method: "POST", url: URL, authentication: "predefinedCredentialType", nodeCredentialType: "azureOpenAiApi",
      sendBody: true, specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ max_tokens: $json.claudeRequest.max_tokens, messages: [{ role: 'system', content: $json.claudeRequest.system }].concat($json.claudeRequest.messages) }) }}",
      options: { timeout: 90000 },
    };
    n.credentials = CRED;
    for (const v of Object.values(w.connections)) for (const br of v.main || []) for (const c of br || []) if (c.node === "Claude — تحليل الامتثال") c.node = n.name;
    w.connections[n.name] = w.connections["Claude — تحليل الامتثال"]; delete w.connections["Claude — تحليل الامتثال"];
    const down = w.nodes.find((x) => x.name === "بناء سجل التنبيه (Notion)");
    const before = "advice = ($json.content && $json.content[0] && $json.content[0].text) ? $json.content[0].text : '';";
    if (!down.parameters.jsCode.includes(before)) throw new Error("نص محلّل Claude تغيّر");
    down.parameters.jsCode = down.parameters.jsCode.replace(before, "advice = ($json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content) ? $json.choices[0].message.content : (($json.content && $json.content[0] && $json.content[0].text) ? $json.content[0].text : '');");
    return "Claude — تحليل الامتثال → Azure + توسيع المحلّل";
  },
  e7FmrFfBK0yrmMJz(w) {
    const n = w.nodes.find((x) => x.name === "🤖 التحليل (OpenAI)");
    const o = n.parameters.options || {};
    const body = `={{ JSON.stringify({ max_tokens: ${o.maxTokens || 5000}, temperature: ${o.temperature ?? 0.2}, messages: [${msgsOf(n.parameters.messages.values)}] }) }}`;
    chain(w, n.name, azHttp("Azure — التحليل", [0, 0], body), setField("Azure — المحتوى", [0, 0], "content", `={{ ${MSG} }}`));
    return "التحليل (OpenAI) → Azure HTTP + Set(content)";
  },
  "8ki6w3hoym6VK0n2"(w) {
    const n = w.nodes.find((x) => x.name === "🤖 Claude — تحليل + تصنيف + سيرة ATS");
    const body = `={{ JSON.stringify({ max_tokens: 4000, messages: [${msgsOf(n.parameters.messages.values, n.parameters.options?.system)}] }) }}`;
    chain(w, n.name, azHttp("Azure — تحليل + تصنيف + سيرة ATS", [0, 0], body), setField("Azure — المحتوى", [0, 0], "text", `={{ ${MSG} }}`));
    return "Claude تحليل + تصنيف → Azure HTTP + Set(text)";
  },
  "6CYU2UO8TilXzBqO"(w) {
    const n = w.nodes.find((x) => x.name === "Message a model");
    const body = `={{ JSON.stringify({ response_format: { type: 'json_object' }, messages: [${msgsOf(n.parameters.responses.values)}] }) }}`;
    const tail = {
      id: crypto.randomUUID(), name: "Azure — شكل الإخراج", type: "n8n-nodes-base.code", typeVersion: 2, position: [0, 0],
      parameters: { mode: "runOnceForEachItem", language: "javaScript", jsCode: "let t = {};\ntry { t = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) { t = {}; }\nreturn { json: { output: [{ content: [{ text: t }] }] } };" },
    };
    chain(w, n.name, azHttp("Azure — رسالة البريد", [0, 0], body), tail);
    return "Message a model → Azure HTTP + Code(output[0].content[0].text)";
  },
};
jobs.qVNwlYHUDpkY7dhk = jobs._claudeHttp;
jobs.rDQXYYplqelAQAmY = jobs._claudeHttp;
delete jobs._claudeHttp;

for (const [id, fn] of Object.entries(jobs)) {
  const w = await get(id);
  if (w.active) { console.log(`تخطّي ${w.name} (${id}): نشط — لا تحويل لسير نشط هنا`); continue; }
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `backup-convert-${id}-${Date.now()}.json`), JSON.stringify(w));
  const what = fn(w);
  console.log(`${apply ? "تطبيق" : "تجربة"}: ${w.name} (${id}) — ${what} — ${w.nodes.length} عقدة`);
  if (apply) await put(w);
}
