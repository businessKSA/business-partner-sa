// مزامنة جداول بيانات n8n من Cloud إلى Azure قبل التحويل (تزايدية، لا تحذف شيئاً).
//
//   N8N_AZURE_API_KEY=… N8N_CLOUD_API_KEY=… node ops/azure-n8n/tables-sync.mjs           # تقرير فقط
//   … node ops/azure-n8n/tables-sync.mjs --apply                                           # إدراج/تحديث
//
// المفتاح الطبيعي لكل جدول (أدناه) يحدّد الصف: ما غاب عن Azure يُدرَج، وما اختلف محتواه يُحدَّث.
// جدول بلا مفتاح معروف يُطابَق بمحتواه كاملاً (إدراج الناقص فقط). الأعمدة النظامية
// id/createdAt/updatedAt لا تُنقل. بعد المزامنة شغّل registry-ids.mjs --apply لأن
// الصفوف الجديدة في BP_Agent_Registry تأتي بلا workflow_id (العمود لا يُنقل) فيُكتب لها معرّف Azure.
const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const CLOUD = "https://businesspartnerai.app.n8n.cloud";
const azKey = process.env.N8N_AZURE_API_KEY, clKey = process.env.N8N_CLOUD_API_KEY;
if (!azKey || !clKey) { console.error("ينقص N8N_AZURE_API_KEY أو N8N_CLOUD_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply");
const KEYS = { BP_AI_Tasks: "task_id", BP_AI_Performance: "snapshot_id", BP_Agent_Registry: "agent_id", BP_AI_Departments: "department", BP_AI_Deals: "deal_id", BP_AI_Growth_Campaigns: "campaign_id", BP_News_Sources: "url", BP_News_Feed: "url", BP_AI_Integration_Readiness: "integration", BP_AI_Control_Commands: "command_id" };
const SYS = new Set(["id", "createdAt", "updatedAt"]);
// أعمدة لا تُنقل من Cloud لأن قيمتها على Azure مختلفة عن قصد (معرّفات السير بعد registry-ids.mjs).
const SKIPCOLS = { BP_Agent_Registry: new Set(["workflow_id"]) };
let skip = new Set();
const H = (k) => ({ "X-N8N-API-KEY": k, "content-type": "application/json" });
const req = async (base, key, path, init = {}) => { const r = await fetch(`${base}/api/v1${path}`, { headers: H(key), ...init }); const t = await r.text(); if (!r.ok) throw new Error(`${init.method || "GET"} ${path} ${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : {}; };
async function rowsOf(base, key, id) { const out = []; let cur = ""; for (let i = 0; i < 400; i++) { const r = await req(base, key, `/data-tables/${id}/rows?limit=250${cur ? "&cursor=" + cur : ""}`); out.push(...r.data); if (!r.nextCursor) break; cur = r.nextCursor; } return out; }
const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SYS.has(k) && !skip.has(k)));
const content = (r) => JSON.stringify(Object.entries(strip(r)).sort(([a], [b]) => a.localeCompare(b)));

const [ct, at] = await Promise.all([req(CLOUD, clKey, "/data-tables?limit=100"), req(AZ, azKey, "/data-tables?limit=100")]);
for (const t of ct.data) {
  const a = at.data.find((x) => x.name === t.name);
  if (!a) { console.log(`• ${t.name}: غير موجود على Azure — يُنشأ يدوياً بالأعمدة نفسها (أو يُهمل إن كان مؤقتاً)`); continue; }
  skip = SKIPCOLS[t.name] || new Set();
  const [cr, ar] = await Promise.all([rowsOf(CLOUD, clKey, t.id), rowsOf(AZ, azKey, a.id)]);
  const key = KEYS[t.name] && cr.some((r) => r[KEYS[t.name]] != null) ? KEYS[t.name] : null;
  const toInsert = [], toUpdate = [];
  if (key) {
    const azByKey = new Map(ar.map((r) => [String(r[key]), r]));
    for (const r of cr) { const k = String(r[key]); const ex = azByKey.get(k); if (!ex) toInsert.push(strip(r)); else if (content(ex) !== content(r)) toUpdate.push({ k, data: strip(r) }); }
  } else {
    const seen = new Set(ar.map(content)); for (const r of cr) if (!seen.has(content(r))) toInsert.push(strip(r));
  }
  console.log(`• ${t.name}: cloud=${cr.length} azure=${ar.length} · مفتاح=${key || "المحتوى"} · إدراج=${toInsert.length} تحديث=${toUpdate.length}`);
  if (!apply) continue;
  for (let i = 0; i < toInsert.length; i += 100) await req(AZ, azKey, `/data-tables/${a.id}/rows`, { method: "POST", body: JSON.stringify({ data: toInsert.slice(i, i + 100), returnType: "count" }) });
  for (const u of toUpdate) await req(AZ, azKey, `/data-tables/${a.id}/rows/update`, { method: "PATCH", body: JSON.stringify({ filter: { type: "and", filters: [{ columnName: key, condition: "eq", value: u.k }] }, data: u.data }) });
  if (toInsert.length || toUpdate.length) console.log(`   تمّ. ${t.name === "BP_Agent_Registry" ? "⚠ شغّل registry-ids.mjs --apply الآن." : ""}`);
}
