// يستبدل اعتماد Gmail الميت (1AQfIiEH6y5Zu61s — لم يُنقل إلى Azure) بـ «Gmail — Business Partner — Production» في كل سير Azure.
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/fix-dead-gmail-cred.mjs                              # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… BACKUP_DIR=… node ops/azure-n8n/fix-dead-gmail-cred.mjs --apply        # نسخة احتياطية ثم PUT
// لا يُغيّر حالة التفعيل ولا أي شيء غير مرجع الاعتماد.
import fs from "node:fs";
import path from "node:path";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply"), backupDir = process.env.BACKUP_DIR || ".";
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const DEAD = "1AQfIiEH6y5Zu61s";
const GOOD = { id: "fKJNtBfZTsc3UkW9", name: "Gmail — Business Partner — Production" };

let all = [], cur = "";
do {
  const r = await (await fetch(`${B}/api/v1/workflows?limit=100${cur ? "&cursor=" + cur : ""}`, { headers: H })).json();
  all.push(...r.data); cur = r.nextCursor;
} while (cur);

let total = 0;
for (const w of all) {
  const hits = w.nodes.filter((n) => n.credentials?.gmailOAuth2?.id === DEAD);
  if (!hits.length) continue;
  total += hits.length;
  console.log(`${apply ? "تطبيق" : "تجربة"}: ${w.name} (${w.id}) ${w.active ? "[نشط]" : "[غير نشط]"} — ${hits.length} عقدة: ${hits.map((n) => n.name).join("، ")}`);
  if (!apply) continue;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `backup-gmailcred-${w.id}-${Date.now()}.json`), JSON.stringify(w));
  for (const n of hits) n.credentials.gmailOAuth2 = { ...GOOD };
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy"].includes(k)));
  const r = await fetch(`${B}/api/v1/workflows/${w.id}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) throw new Error(`PUT ${w.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}
console.log(`المجموع: ${total} عقدة`);
