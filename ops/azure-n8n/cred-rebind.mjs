// ربط اعتمادات سير Azure بالاسم — لما بقي يحمل معرّفات Cloud.
//
//   N8N_AZURE_API_KEY=… N8N_CLOUD_API_KEY=… node ops/azure-n8n/cred-rebind.mjs            # تقرير فقط
//   … node ops/azure-n8n/cred-rebind.mjs --apply                                            # إعادة حفظ + تقرير
//
// الفكرة: حفظ السير عبر الواجهة العامة (PUT) يمرّ في n8n بـ replaceInvalidCredentials: كل اعتماد
// معرّفه غير موجود يُستبدل باعتماد من النوع نفسه والاسم نفسه إن كان وحيداً. فإعادة حفظ السير
// كما هو تُصلح الربط بلا تعديل في عقدة. ما يبقى بعدها بمعرّف Cloud معناه أن لا اعتماد بهذا
// الاسم والنوع على Azure (أو اسمين متطابقين) — يُنشأ/يُصحَّح يدوياً بالاسم المطبوع ثم يُعاد التشغيل.
// تنبيه: الحفظ عبر الـAPI قد يمسح البيانات المثبّتة (pinData) — نسخة احتياطية تُكتب قبل كل حفظ
// في .azure-n8n-backups/ (خارج git).
import fs from "node:fs";
const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const CLOUD = "https://businesspartnerai.app.n8n.cloud";
const azKey = process.env.N8N_AZURE_API_KEY, clKey = process.env.N8N_CLOUD_API_KEY;
if (!azKey || !clKey) { console.error("ينقص N8N_AZURE_API_KEY أو N8N_CLOUD_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply");
const H = (k) => ({ "X-N8N-API-KEY": k, "content-type": "application/json" });
const get = async (base, key, path) => { const r = await fetch(`${base}/api/v1${path}`, { headers: H(key) }); if (!r.ok) throw new Error(`GET ${path} ${r.status}`); return r.json(); };
async function all(base, key) { const out = []; let cur = ""; do { const r = await get(base, key, `/workflows?limit=100${cur ? "&cursor=" + cur : ""}`); out.push(...r.data); cur = r.nextCursor; } while (cur); return out; }
const sig = (w) => (w.nodes || []).map((n) => n.name).sort().join("|");
// عقدة HTTP تحتفظ بمراجع اعتمادات قديمة لأنواع لم تعد تستعملها؛ يُعتدّ بالنوع المختار فقط.
const nodeCreds = (n) => { const c = n.credentials || {}; const p = n.parameters || {}; if (!/httpRequest$/.test(n.type)) return c; const t = p.authentication === "predefinedCredentialType" ? p.nodeCredentialType : p.authentication === "genericCredentialType" ? p.genericAuthType : null; return t ? Object.fromEntries(Object.entries(c).filter(([k]) => k === t)) : {}; };
const credMap = (w) => { const m = new Map(); for (const n of w.nodes || []) if (!n.disabled) for (const [t, c] of Object.entries(nodeCreds(n))) m.set(`${n.name}|${t}`, c); return m; };
const unbound = (c, a) => { const cm = credMap(c), out = new Map(); for (const [k, cr] of credMap(a)) { const cc = cm.get(k); if (cc && cr.id && cc.id === cr.id) out.set(`${k.split("|")[1]}|${cr.name}`, cr.id); } return out; };

const [cloud, azure] = await Promise.all([all(CLOUD, clKey), all(AZ, azKey)]);
const byName = new Map(); for (const w of azure) (byName.get(w.name) || byName.set(w.name, []).get(w.name)).push(w);
const SKIP = /Mahfol|BP-Error-Handler/i;
const live = cloud.filter((w) => w.active && !SKIP.test(w.name));
const todo = [];
for (const c of live) { const g = byName.get(c.name) || []; const a = g.find((x) => sig(x) === sig(c)) || g[0]; if (!a) continue; const u = unbound(c, a); if (u.size) todo.push({ c, a, u }); }
console.log(`${apply ? "تطبيق" : "تقرير"}: ${todo.length} سيراً على Azure باعتمادات بمعرّف Cloud`);
const stillMissing = new Map();
for (const { c, a, u } of todo) {
  console.log(`- ${a.name} (${a.id}): ${[...u.keys()].join(", ")}`);
  if (!apply) { for (const k of u.keys()) stillMissing.set(k, (stillMissing.get(k) || 0) + 1); continue; }
  const w = await get(AZ, azKey, `/workflows/${a.id}`);
  fs.mkdirSync(".azure-n8n-backups", { recursive: true });
  fs.writeFileSync(`.azure-n8n-backups/${a.id}-${Date.now()}.json`, JSON.stringify(w));
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy"].includes(k)));
  const r = await fetch(`${AZ}/api/v1/workflows/${a.id}`, { method: "PUT", headers: H(azKey), body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) { console.error(`  فشل الحفظ ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
  const after = unbound(c, await get(AZ, azKey, `/workflows/${a.id}`));
  const fixed = [...u.keys()].filter((k) => !after.has(k));
  console.log(`  رُبط: ${fixed.length ? fixed.join(", ") : "—"}${after.size ? ` · بقي بلا اعتماد على Azure: ${[...after.keys()].join(", ")}` : ""}`);
  for (const k of after.keys()) stillMissing.set(k, (stillMissing.get(k) || 0) + 1);
}
if (stillMissing.size) { console.log(`\n${apply ? "اعتمادات يجب إنشاؤها على Azure بهذا النوع والاسم تماماً (ثم أعد التشغيل):" : "اعتمادات ستُربط بالاسم إن كانت موجودة على Azure، وإلا تُنشأ بهذا النوع والاسم تماماً:"}`); for (const [k, n] of stillMissing) console.log(`   ${k}  (${n} سيراً)`); }
