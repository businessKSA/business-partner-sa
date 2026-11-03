// يحوّل آخر أربعة سير فيها ذكاء خارج Azure إلى Azure OpenAI (النشر bp-main).
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/convert-ai.mjs          # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/convert-ai.mjs --apply  # تطبيق + نسخة احتياطية
//
// - BP-Chat-Suggest وOutlook CVs: عقدة Azure موجودة أصلاً والقديمة يتيمة بلا وصلات → تُعطَّل فقط.
// - إيصالات الدفع وبوابة المرشحين: تُستبدل العقدة بنداء HTTP إلى Azure + عقدة Set تعيد
//   الشكل الذي يقرأه ما بعدها ({content}) فلا يُمسّ كود المقارنة ولا بناء صفحة Notion.
import fs from "node:fs";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY || (process.env.N8N_AZURE_KEY_FILE && fs.readFileSync(process.env.N8N_AZURE_KEY_FILE, "utf8").trim());
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply");
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const CRED = { azureOpenAiApi: { id: "fI2SkJuYmB2v3zCo", name: "Azure Open AI account" } };
const URL = "https://bp-ai-ksa-2026.openai.azure.com/openai/deployments/bp-main/chat/completions?api-version=2025-03-01-preview";

const get = async (id) => (await fetch(`${B}/api/v1/workflows/${id}`, { headers: H })).json();
const put = async (w) => {
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy"].includes(k)));
  const r = await fetch(`${B}/api/v1/workflows/${w.id}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) throw new Error(`PUT ${w.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
};

const httpNode = (name, position, bodyExpr) => ({
  id: crypto.randomUUID(), name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position,
  parameters: {
    method: "POST", url: URL, authentication: "predefinedCredentialType", nodeCredentialType: "azureOpenAiApi",
    sendBody: true, specifyBody: "json", jsonBody: bodyExpr, options: { timeout: 90000 },
  },
  credentials: CRED,
});
const setContent = (name, position) => ({
  id: crypto.randomUUID(), name, type: "n8n-nodes-base.set", typeVersion: 3.4, position,
  parameters: { assignments: { assignments: [{ id: "c1", name: "content", type: "string", value: "={{ $json.choices?.[0]?.message?.content || '' }}" }] }, includeOtherFields: false, options: {} },
});

// يستبدل عقدة بسلسلة [HTTP → Set] محافظاً على الوصلات الداخلة والخارجة.
function replace(w, oldName, http, set) {
  const old = w.nodes.find((n) => n.name === oldName);
  if (!old) throw new Error(`لا توجد العقدة ${oldName}`);
  http.position = old.position; set.position = [old.position[0] + 220, old.position[1]];
  w.nodes = w.nodes.filter((n) => n !== old).concat([http, set]);
  for (const v of Object.values(w.connections)) for (const branch of v.main || []) for (const c of branch || []) if (c.node === oldName) c.node = http.name;
  const out = w.connections[oldName]; delete w.connections[oldName];
  w.connections[http.name] = { main: [[{ node: set.name, type: "main", index: 0 }]] };
  w.connections[set.name] = out || { main: [[]] };
}

const jobs = {
  "17j4TxO2UIE1ra9H": (w) => orphans(w, ["Claude Draft Reply", "OpenAI Draft Reply"]),
  "KDka4AWWoOsUerSa": (w) => orphans(w, ["🤖 التحليل (OpenAI)"]),
  "miKAS8TnwJasYFh8": (w) => {
    const old = w.nodes.find((n) => n.name === "قراءة الإيصال (احتياطي OpenAI)");
    const prompt = JSON.stringify(old.parameters.text);
    replace(w, old.name,
      httpNode("قراءة الإيصال (Azure)", [0, 0], `={{ JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: ${prompt} }, { type: "image_url", image_url: { url: $json.fileUrl, detail: "high" } }] }], max_tokens: 400, temperature: 0 }) }}`),
      setContent("قراءة الإيصال (مخرج)", [0, 0]));
  },
  "KAF405gOPjZFKGQB": (w) => {
    const old = w.nodes.find((n) => n.name === "Claude — استخراج الملف");
    const sys = JSON.stringify(old.parameters.options.system);
    const http = httpNode("Azure — استخراج الملف", [0, 0], `={{ JSON.stringify({ messages: [{ role: "system", content: ${sys} }, { role: "user", content: String($json.story || "") }], max_tokens: 2000, temperature: 0 }) }}`);
    const set = setContent("Azure — مخرج الاستخراج", [0, 0]);
    set.parameters.assignments.assignments = [{ id: "c1", name: "content", type: "array", value: "={{ [{ text: $json.choices?.[0]?.message?.content || '' }] }}" }];
    replace(w, old.name, http, set);
  },
};

// عقدة يتيمة (لا وصلة داخلة ولا خارجة) تُعطَّل بدل أن تُحذف.
function orphans(w, names) {
  for (const nm of names) {
    const n = w.nodes.find((x) => x.name === nm);
    const wired = w.connections[nm] || Object.values(w.connections).some((v) => JSON.stringify(v).includes(JSON.stringify(nm)));
    if (!n) continue;
    if (wired) throw new Error(`${nm} موصولة — لا تُعطَّل تلقائياً`);
    n.disabled = true;
  }
}

for (const [id, fn] of Object.entries(jobs)) {
  const w = await get(id);
  fs.writeFileSync(`backup-convert-${id}-${Date.now()}.json`, JSON.stringify(w));
  fn(w);
  console.log(`${apply ? "تطبيق" : "تجربة"}: ${w.name} — ${w.nodes.length} عقدة`);
  if (apply) await put(w);
}
