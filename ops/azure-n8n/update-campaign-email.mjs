// يحدّث محتوى وتصميم بريد الحملة في «BP Campaign Sender (Companies Sales DB)» (gw9GOcav5vnlU29P) — طلب المالك 2026-10-14:
// قالب جذاب بقائمة الخدمات نقاطاً، ومحتوى عربي + إنجليزي (موضوع ثنائي اللغة، مقدمتان يكتبهما Azure، وقوائم ثابتة من الكتالوج).
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/update-campaign-email.mjs          # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… BACKUP_DIR=… node ops/azure-n8n/update-campaign-email.mjs --apply
// يبقى السير غير نشط. يقرأ ثم يعيد القراءة قبل الكتابة ويُلغي إن تغيّر `updatedAt` (جلسات متوازية).
import fs from "node:fs";
import path from "node:path";
import { renderEmail } from "./email-template.mjs";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply"), backupDir = process.env.BACKUP_DIR || ".";
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const ID = "gw9GOcav5vnlU29P";
const get = async () => (await fetch(`${B}/api/v1/workflows/${ID}`, { headers: H })).json();
const w = await get();
if (w.active) { console.error("السير نشط — لا يُعدَّل وهو يعمل"); process.exit(1); }
const at = (n) => w.nodes.find((x) => x.name === n) || (() => { throw new Error(`العقدة ${n} غير موجودة`); })();
const draft = at("صياغة الرسالة (Azure)"), prep = at("تجهيز الرسالة"), approve = at("موافقة المالك (إرسال وانتظار)"), limit = at("عميل واحد في الدورة");

const SYS = [
  "أنت مساعد Business Partner لصياغة مقدمة بريد تعريفية لمنشآت سعودية (B2B)، بالعربية وبالإنجليزية.",
  "اكتب لكل لغة مقدمة من جملتين إلى ثلاث فقط (حوالي 250 إلى 400 حرف)، مخصّصة لقطاع المنشأة ومدينتها، تعبّر عن أن Business Partner تتولى المعاملات الإدارية والحكومية لتتفرغ المنشأة لأعمالها.",
  "المقدمتان متطابقتان في المعنى. لا تعدّد الخدمات (قائمة الخدمات تأتي بعد المقدمة تلقائياً)، ولا تبدأ بتحية، ولا تختم بتوقيع.",
  "لا تذكر أي سعر ولا ضمان ولا خصم ولا وعد بنتيجة حكومية، ولا تختلق معلومة عن المنشأة غير الواردة.",
  "أعد JSON صالحاً فقط بأربعة مفاتيح: subject_ar (موضوع عربي جذاب حتى 45 حرفاً)، subject_en (موضوع إنجليزي حتى 55 حرفاً)، intro_ar، intro_en.",
].join("\n");
draft.parameters.jsonBody = "={{ JSON.stringify({ temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: " + JSON.stringify(SYS) + " }, { role: 'user', content: `بيانات العميل المحتمل (JSON):\\n${JSON.stringify((() => { const l = $('Get Ready-to-Send').all().find((i) => i.json.id === $json._pageId)?.json || {}; const o = { name: $json._company }; for (const k of Object.keys(l)) if (/^property_(sector|city|size|ownership|description|entity_type)$/.test(k) && l[k]) o[k.replace('property_', '')] = l[k]; return o; })())}\\n\\nاكتب المقدمتين المخصّصتين له.` }] }) }}";

prep.parameters.jsCode = [
  renderEmail.toString(),
  "let t = {};",
  "try { t = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) { t = {}; }",
  `const src = $('${limit.name}').item.json;`,
  "if (!t.subject_ar || !t.subject_en || !t.intro_ar || !t.intro_en) throw new Error('تعذّرت صياغة الرسالة بلغتيها لهذا العميل');",
  "const subject = String(t.subject_ar).trim() + ' | ' + String(t.subject_en).trim();",
  "return { json: { _pageId: src._pageId, _to: src._to, _company: src._company, _testMode: src._testMode, _subject: subject, _body: String(t.intro_ar) + '\\n\\n— English —\\n' + String(t.intro_en), _html: renderEmail(subject, String(t.intro_ar), src._company, String(t.intro_en)) } };",
].join("\n");
approve.parameters.message = "={{ 'المنشأة: ' + $json._company + '\\nإلى: ' + $json._to + ($json._testMode ? '  (وضع التجربة TEST_TO)' : '') + '\\n\\nالموضوع: ' + $json._subject + '\\n\\n' + $json._body + '\\n\\n— ستصل للعميل بقالب HTML بشعار Business Partner (مقدمة + قائمة الخدمات + نسخة إنجليزية).' }}";

console.log(`${apply ? "تطبيق" : "تجربة"}: ${w.name} — تحديث صياغة Azure وقالب HTML ثنائي اللغة ورسالة الموافقة؛ يبقى غير نشط`);
if (apply) {
  const fresh = await get();
  if (fresh.updatedAt !== w.updatedAt) throw new Error("السير تغيّر أثناء التحضير (جلسة أخرى؟) — أُلغي بلا كتابة");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `backup-campaign-email-${Date.now()}.json`), JSON.stringify(fresh));
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy"].includes(k)));
  const r = await fetch(`${B}/api/v1/workflows/${ID}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) throw new Error(`PUT ${ID}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  console.log("تم — active:", (await r.json()).active);
}
