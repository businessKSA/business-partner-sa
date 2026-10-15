// تحويل n8n من Cloud إلى Azure — فحص مسبق (افتراضي، لا يكتب شيئاً) ثم مراحل.
//
//   N8N_AZURE_API_KEY=… N8N_CLOUD_API_KEY=… node ops/azure-n8n/cutover.mjs                 # فحص فقط
//   … node ops/azure-n8n/cutover.mjs --phase=schedulers --apply                               # نقل حصري
//   … node ops/azure-n8n/cutover.mjs --phase=webhooks --keep-cloud --apply                    # تفعيل Azure وإبقاء Cloud
//   … node ops/azure-n8n/cutover.mjs --phase=webhooks --retire-cloud --apply                  # تعطيل Cloud بعد تحويل الموقع
//   … node ops/azure-n8n/cutover.mjs --phase=schedulers --rollback --apply                    # رجوع
//
// المراحل بالترتيب (كل مرحلة تُنفَّذ بعد نجاح فحص الحية للتي قبلها):
//   schedulers : سير مجدولة/استطلاعية/داخلية — حصرية: تعطيل في Cloud ثم تفعيل في Azure
//   webhooks   : سير الويبهوك — يجوز تشغيلها على الطرفين معاً (--keep-cloud)، لأن المسار واحد
//                والمنادي يختار المضيف؛ ثم يُحوَّل الموقع (BP_N8N_BASE وBP_N8N_PUBLIC_BASE في بيئة
//                النشر وإعادة البناء) ثم --retire-cloud. سيرٌ فيها ويبهوك ومشغّلٌ استطلاعي معاً
//                («مختلطة») تُنقل حصرياً دائماً حتى لا يتكرّر الاستطلاع.
//   whatsapp   : BP-WhatsApp-Main وفرح معاً (تطبيق Meta واحد = Callback واحد) — بعد قرار المالك.
// الرجوع: --rollback يعكس المرحلة حصرياً (يفعّل Cloud ويعطّل Azure).
// لا يلمس سير Mahfol (واتساب غير مهيّأ) ولا معالج الأخطاء.
//
// البوابة تُغلق إن وُجد: سير ناقص في Azure، أو عقدة ذكاء خارج Azure، أو اعتمادٌ على Azure ما زال
// يحمل معرّف Cloud نفسه (لم يُربط بالاسم) — يُعالَج بـ cred-rebind.mjs --apply.
// وعند تكرار الاسم على Azure يُختار التوأم الذي تطابق عقدُه عقدَ Cloud، ثم الأحدث تعديلاً.

const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const CLOUD = "https://businesspartnerai.app.n8n.cloud";
const azKey = process.env.N8N_AZURE_API_KEY, clKey = process.env.N8N_CLOUD_API_KEY;
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const has = (f) => process.argv.includes(`--${f}`);
const apply = has("apply"), rollback = has("rollback"), keepCloud = has("keep-cloud"), retireCloud = has("retire-cloud");
const phase = arg("phase");
if (!azKey || !clKey) { console.error("ينقص N8N_AZURE_API_KEY أو N8N_CLOUD_API_KEY"); process.exit(1); }
if (keepCloud && retireCloud) { console.error("--keep-cloud و--retire-cloud لا يجتمعان"); process.exit(1); }

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
const sig = (w) => (w.nodes || []).map((n) => n.name).sort().join("|");
const SKIP = /Mahfol|BP-Error-Handler/i;

const [cloud, azure] = await Promise.all([all(CLOUD, clKey), all(AZ, azKey)]);
const byName = new Map(); for (const w of azure) (byName.get(w.name) || byName.set(w.name, []).get(w.name)).push(w);
const twin = (c) => {
  const g = byName.get(c.name) || []; if (g.length <= 1) return g[0];
  const same = g.filter((a) => sig(a) === sig(c)); const pool = same.length ? same : g;
  const pick = [...pool].sort((x, y) => String(y.updatedAt || "").localeCompare(String(x.updatedAt || "")))[0];
  console.log(`  ⚠ اسم مكرّر على Azure «${c.name}» ×${g.length} — اختير ${pick.id} (${same.length ? "عقده تطابق Cloud" : "لا توأم مطابقاً؛ الأحدث"})`);
  return pick;
};
const live = cloud.filter((w) => w.active && !SKIP.test(w.name));
const rows = live.map((c) => ({ c, a: twin(c) }));

const HOOK = /^(webhook|formTrigger|chatTrigger)$/;
const POLL = (t) => /Trigger$|^cron$/.test(t) && !HOOK.test(t) && !/^(executeWorkflowTrigger|manualTrigger|whatsAppTrigger|errorTrigger)$/.test(t);
const group = (r) => {
  const k = kinds(r.a || r.c);
  if (k.includes("whatsAppTrigger") || /Muin|فرح/.test(r.c.name)) return "whatsapp";
  const hook = k.some((t) => HOOK.test(t));
  if (hook && k.some(POLL)) return "mixed";
  if (hook) return "webhooks";
  return "schedulers";
};
// اعتمادٌ على عقدة Azure يحمل المعرّف نفسه الذي تحمله العقدة في Cloud = لم يُربط باعتماد Azure.
// عقدة HTTP تحتفظ بمراجع اعتمادات قديمة لأنواع لم تعد تستعملها؛ يُعتدّ بالنوع المختار فقط.
const nodeCreds = (n) => { const c = n.credentials || {}; const p = n.parameters || {}; if (!/httpRequest$/.test(n.type)) return c; const t = p.authentication === "predefinedCredentialType" ? p.nodeCredentialType : p.authentication === "genericCredentialType" ? p.genericAuthType : null; return t ? Object.fromEntries(Object.entries(c).filter(([k]) => k === t)) : {}; };
const credMap = (w) => { const m = new Map(); for (const n of w.nodes || []) if (!n.disabled) for (const [t, c] of Object.entries(nodeCreds(n))) m.set(`${n.name}|${t}`, c); return m; };
const unbound = (r) => { const cm = credMap(r.c), out = []; for (const [k, c] of credMap(r.a)) { const cc = cm.get(k); if (cc && c.id && cc.id === c.id) out.push(`${k.split("|")[1]}«${c.name}»`); } return [...new Set(out)]; };

console.log(`Cloud النشطة: ${live.length} · Azure: ${azure.length}`);
const missing = rows.filter((r) => !r.a);
const ai = rows.filter((r) => r.a && aiNodes(r.a).length);
const creds = rows.filter((r) => r.a && unbound(r).length);
if (missing.length) console.log("ناقصة في Azure:", missing.map((r) => r.c.name).join(" | "));
if (ai.length) console.log("عقد ذكاء خارج Azure (تُحوَّل قبل التحويل):", ai.map((r) => r.c.name).join(" | "));
if (creds.length) { console.log(`اعتمادات بمعرّف Cloud على Azure في ${creds.length} سيراً (شغّل cred-rebind.mjs --apply):`); for (const r of creds) console.log(`   ${r.c.name}: ${unbound(r).join(", ")}`); }
for (const p of ["schedulers", "webhooks", "mixed", "whatsapp"]) console.log(`  ${p}: ${rows.filter((r) => group(r) === p).length}${p === "mixed" ? "  (" + rows.filter((r) => group(r) === p).map((r) => r.c.name).join(" | ") + ")" : ""}`);

const gate = missing.length || ai.length || creds.length;
if (!phase) process.exit(gate ? 2 : 0);
if (gate) { console.error("البوابة مغلقة: عالج ما فوق أولاً."); process.exit(2); }
if (!["schedulers", "webhooks", "whatsapp"].includes(phase)) { console.error("المرحلة: schedulers | webhooks | whatsapp"); process.exit(1); }

for (const r of rows.filter((r) => group(r) === phase || (phase === "webhooks" && group(r) === "mixed"))) {
  const mixed = group(r) === "mixed";
  if (mixed && keepCloud) { console.log(`${r.c.name}: مختلطة — تُنقل حصرياً مع --retire-cloud بعد تحويل الموقع`); continue; }
  const exclusive = rollback || (!keepCloud && !retireCloud) || (mixed && retireCloud);
  const doDeact = exclusive || retireCloud, doAct = exclusive || keepCloud;
  const [from, to] = rollback ? [[AZ, azKey, r.a.id], [CLOUD, clKey, r.c.id]] : [[CLOUD, clKey, r.c.id], [AZ, azKey, r.a.id]];
  const label = rollback ? "Azure→Cloud" : doDeact && doAct ? "Cloud→Azure" : doAct ? "تفعيل Azure (Cloud يبقى)" : "تعطيل Cloud";
  console.log(`${apply ? "" : "[dry] "}${r.c.name}${mixed ? " [مختلطة: حصرية]" : ""}: ${label}  (azure ${r.a.id})`);
  if (!apply) continue;
  // يُعطَّل أولاً ثم يُفعَّل — لا يعمل الاثنان معاً على المشغّل نفسه.
  if (doDeact) { const d = await call(from[0], from[1], from[2], "deactivate"); if (!d.ok) console.error("  فشل التعطيل:", d.status, (await d.text()).slice(0, 160)); }
  if (doAct) {
    const res = await call(to[0], to[1], to[2], "activate");
    if (!res.ok) { console.error("  فشل التفعيل:", res.status, (await res.text()).slice(0, 200)); if (doDeact) { console.error("  أعيد تفعيل الأصل"); await call(from[0], from[1], from[2], "activate"); } }
  }
}
