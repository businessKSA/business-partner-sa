// تحويل n8n من Cloud إلى Azure — فحص مسبق (افتراضي، لا يكتب شيئاً) ثم مراحل.
//
//   N8N_AZURE_API_KEY=… N8N_CLOUD_API_KEY=… node ops/azure-n8n/cutover.mjs            # فحص فقط
//   … node ops/azure-n8n/cutover.mjs --phase=schedulers --apply                          # مرحلة واحدة
//
// المراحل بالترتيب (كل مرحلة تُنفَّذ بعد نجاح فحص الحية للتي قبلها):
//   schedulers : سير مجدولة/داخلية — تعطيل في Cloud ثم تفعيل في Azure
//   webhooks   : سير الويبهوك — بعد تحويل BP_N8N_BASE في بيئة الموقع إلى Azure
//   whatsapp   : BP-WhatsApp-Main وفرح معاً (تطبيق Meta واحد = Callback واحد)
// الرجوع: --rollback يعكس المرحلة (يفعّل Cloud ويعطّل Azure).
// لا يلمس سير Mahfol (واتساب غير مهيّأ) ولا معالج الأخطاء.

const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const CLOUD = "https://businesspartnerai.app.n8n.cloud";
const azKey = process.env.N8N_AZURE_API_KEY, clKey = process.env.N8N_CLOUD_API_KEY;
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const apply = process.argv.includes("--apply"), rollback = process.argv.includes("--rollback");
const phase = arg("phase");
if (!azKey || !clKey) { console.error("ينقص N8N_AZURE_API_KEY أو N8N_CLOUD_API_KEY"); process.exit(1); }

async function all(base, key) {
  const out = []; let cur = "";
  do {
    const r = await (await fetch(`${base}/api/v1/workflows?limit=100${cur ? "&cursor=" + cur : ""}`, { headers: { "X-N8N-API-KEY": key } })).json();
    out.push(...r.data); cur = r.nextCursor;
  } while (cur);
  return out;
}
const call = (base, key, id, verb) => fetch(`${base}/api/v1/workflows/${id}/${verb}`, { method: "POST", headers: { "X-N8N-API-KEY": key, "content-type": "application/json" }, body: "{}" });

const AI = /n8n-nodes-base\.openAi$|langchain\.openAi$|langchain\.anthropic$|lmChatOpenAi|lmChatAnthropic|lmChatGroq|lmChatGoogleGemini|embeddingsOpenAi/;
const aiNodes = (w) => (w.nodes || []).filter((n) => !n.disabled && (AI.test(n.type) || (n.type.endsWith("httpRequest") && /api\.(openai|anthropic)\.com|groq\.com|generativelanguage/.test(JSON.stringify(n.parameters)))));
const kinds = (w) => (w.nodes || []).filter((n) => !n.disabled).map((n) => n.type.split(".").pop());
const SKIP = /Mahfol|BP-Error-Handler/i;

const [cloud, azure] = await Promise.all([all(CLOUD, clKey), all(AZ, azKey)]);
const az = new Map(azure.map((w) => [w.name, w]));
const live = cloud.filter((w) => w.active && !SKIP.test(w.name));
const rows = live.map((c) => ({ c, a: az.get(c.name) }));

const group = (r) => {
  const k = kinds(r.a || r.c);
  if (/whatsAppTrigger/.test(k.join()) || /Muin|فرح/.test(r.c.name)) return "whatsapp";
  if (k.includes("webhook") || k.includes("formTrigger") || k.includes("chatTrigger")) return "webhooks";
  return "schedulers";
};

console.log(`Cloud النشطة: ${live.length} · Azure: ${azure.length}`);
const missing = rows.filter((r) => !r.a);
const ai = rows.filter((r) => r.a && aiNodes(r.a).length);
if (missing.length) console.log("ناقصة في Azure:", missing.map((r) => r.c.name).join(" | "));
if (ai.length) console.log("عقد ذكاء خارج Azure (تُحوَّل قبل التحويل):", ai.map((r) => r.c.name).join(" | "));
for (const p of ["schedulers", "webhooks", "whatsapp"]) console.log(`  ${p}: ${rows.filter((r) => group(r) === p).length}`);

if (!phase) process.exit(missing.length || ai.length ? 2 : 0);
if (missing.length || ai.length) { console.error("البوابة مغلقة: عالج ما فوق أولاً."); process.exit(2); }

for (const r of rows.filter((r) => group(r) === phase)) {
  const [from, to] = rollback ? [[AZ, azKey, r.a.id], [CLOUD, clKey, r.c.id]] : [[CLOUD, clKey, r.c.id], [AZ, azKey, r.a.id]];
  console.log(`${apply ? "" : "[dry] "}${r.c.name}: ${rollback ? "Azure→Cloud" : "Cloud→Azure"}`);
  if (!apply) continue;
  // يُعطَّل أولاً ثم يُفعَّل — لا يعمل الاثنان معاً على المشغّل نفسه.
  await call(from[0], from[1], from[2], "deactivate");
  const res = await call(to[0], to[1], to[2], "activate");
  if (!res.ok) { console.error("  فشل التفعيل — أعيد الأصل:", res.status); await call(from[0], from[1], from[2], "activate"); }
}
