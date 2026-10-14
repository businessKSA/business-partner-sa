// تبديل نشرة نموذج Azure OpenAI في سير n8n على Azure — تجربة جافة افتراضياً، وتراجع بالمعاملات نفسها معكوسة.
//
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/switch-model.mjs --from=bp-main --to=bp-fast                 # تقرير فقط
//   … node ops/azure-n8n/switch-model.mjs --from=bp-main --to=bp-fast --apply                            # تطبيق
//   … node ops/azure-n8n/switch-model.mjs --from=bp-fast --to=bp-main --apply --only-file=.azure-n8n-backups/models-switched.json   # تراجع
//
// القاعدة (قرار المالك 2026-10-14): كل الوكلاء على أرخص نشرة تكفي، وفرح وحدها على نشرة قوية.
// فاستثناءات فرح تُحدَّد بالاسم (--exclude-name) وبالمعرّف (--exclude-id).
// عقدة lmChatAzureOpenAi: يُبدَّل نص اسم النشرة في معاملاتها. عقدة HTTP: يُبدَّل المقطع /deployments/<from>/ في الرابط.
// تحذير: الحفظ عبر الواجهة قد يمسح pinData/staticData — لذلك تُستثنى السير التي تحفظ حالة في staticData
// (--exclude-id) وتُكتب نسخة احتياطية من كل سير قبل حفظه في .azure-n8n-backups/ (خارج git).
import fs from "node:fs";
const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=");
const from = arg("from"), to = arg("to");
if (!from || !to || from === to) { console.error("استعمل --from=<نشرة> --to=<نشرة>"); process.exit(1); }
const apply = process.argv.includes("--apply");
const excludeName = arg("exclude-name") ? new RegExp(arg("exclude-name"), "i") : null;
const excludeIds = new Set((arg("exclude-id") || "").split(",").filter(Boolean));
const onlyFile = arg("only-file");
const only = onlyFile ? new Set(JSON.parse(fs.readFileSync(onlyFile, "utf8")).map((x) => x.id)) : null;
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const get = async (p) => { const r = await fetch(`${AZ}/api/v1${p}`, { headers: H }); if (!r.ok) throw new Error(`GET ${p} ${r.status}`); return r.json(); };
const KEEP = ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy", "saveDataSuccessExecution", "saveDataErrorExecution"];
const swapLm = (n) => { const s = JSON.stringify(n.parameters); if (!s.includes(`"${from}"`)) return false; n.parameters = JSON.parse(s.split(`"${from}"`).join(`"${to}"`)); return true; };
const swapHttp = (n) => { const u = String(n.parameters?.url || ""); if (!u.includes(`/deployments/${from}/`)) return false; n.parameters.url = u.split(`/deployments/${from}/`).join(`/deployments/${to}/`); return true; };

const list = []; let cur = "";
do { const r = await get(`/workflows?limit=100${cur ? "&cursor=" + cur : ""}`); list.push(...r.data); cur = r.nextCursor; } while (cur);

const changed = []; let nodesTotal = 0, fail = 0;
fs.mkdirSync(".azure-n8n-backups", { recursive: true });
for (const meta of list) {
  if (only && !only.has(meta.id)) continue;
  if (excludeIds.has(meta.id) || (excludeName && excludeName.test(meta.name))) continue;
  const w = meta.nodes ? meta : await get(`/workflows/${meta.id}`);
  let n = 0;
  for (const node of w.nodes || []) {
    if (/lmChatAzureOpenAi|azureOpenAi$/i.test(node.type) && swapLm(node)) n++;
    else if (/httpRequest$/.test(node.type) && swapHttp(node)) n++;
  }
  if (!n) continue;
  nodesTotal += n;
  console.log(`${apply ? "تبديل" : "[جاف]"} ${w.active ? "●" : "○"} ${w.name.slice(0, 62)} — ${n} عقدة`);
  if (!apply) { changed.push({ id: w.id, name: w.name, nodes: n }); continue; }
  fs.writeFileSync(`.azure-n8n-backups/models-${w.id}-${Date.now()}.json`, JSON.stringify(w));
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => KEEP.includes(k)));
  const r = await fetch(`${AZ}/api/v1/workflows/${w.id}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) { fail++; console.error(`  فشل ${r.status}: ${(await r.text()).slice(0, 160)}`); continue; }
  changed.push({ id: w.id, name: w.name, nodes: n });
}
console.log(`\n${apply ? "حُوِّل" : "سيُحوَّل"}: ${changed.length} سيراً · ${nodesTotal} عقدة · فشل ${fail}`);
if (apply) fs.writeFileSync(".azure-n8n-backups/models-switched.json", JSON.stringify(changed, null, 1));
