// يرقّي سير «BP Campaign Sender (Companies Sales DB)» (gw9GOcav5vnlU29P) على Azure — قرار المالك 2026-10-14 (الخيار الأول):
// يُضاف إليه موافقة المالك بالبريد + صياغة Azure + قالب HTML بشعار Business Partner، ويبقى كل ما فيه من حمايات
// (Guard، سقف 25، قائمة DEAD، فحص MX، استثناءات النطاقات) وتبقى حالته **غير نشط/متوقف** كما وصفه الـREADME.
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/upgrade-campaign-sender.mjs          # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… BACKUP_DIR=… node ops/azure-n8n/upgrade-campaign-sender.mjs --apply
//
// المسار بعد الترقية:
//   … Drop Domains Without MX → Build Emails (يُبقي الاستثناءات و TEST_TO) → عميل واحد في الدورة → صياغة Azure
//   → تجهيز الرسالة (HTML) → موافقة المالك (إرسال وانتظار) → تمت الموافقة؟ → Send via Gmail → Mark Sent
// حماية من تعارض الجلسات المتوازية: يقرأ ثم يعيد القراءة قبل الكتابة ويُلغي إن تغيّر `updatedAt` بينهما.
import fs from "node:fs";
import path from "node:path";
import { renderEmail } from "./email-template.mjs";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply"), backupDir = process.env.BACKUP_DIR || ".";
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const ID = "gw9GOcav5vnlU29P";
const APPROVER = "dr.baher.magnas@gmail.com";
const GMAIL = { gmailOAuth2: { id: "fKJNtBfZTsc3UkW9", name: "Gmail — Business Partner — Production" } };
const CRED_AZ = { azureOpenAiApi: { id: "fI2SkJuYmB2v3zCo", name: "Azure Open AI account" } };
const AZ_URL = "https://bp-ai-ksa-2026.openai.azure.com/openai/deployments/bp-main/chat/completions?api-version=2025-03-01-preview";

const get = async () => (await fetch(`${B}/api/v1/workflows/${ID}`, { headers: H })).json();
const w = await get();
if (w.active) { console.error("السير نشط — لا يُعدَّل وهو يعمل"); process.exit(1); }
if (w.nodes.some((n) => n.name === "تجهيز الرسالة")) { console.log("مُرقّى من قبل — لا شيء لفعله"); process.exit(0); }
const need = ["Drop Domains Without MX", "Build Emails", "Send via Gmail", "Mark Sent", "README", "Get Ready-to-Send"];
for (const n of need) if (!w.nodes.some((x) => x.name === n)) throw new Error(`العقدة ${n} غير موجودة — تغيّر السير، أوقفنا`);

const uid = () => crypto.randomUUID();
const N = { limit: "عميل واحد في الدورة", draft: "صياغة الرسالة (Azure)", prep: "تجهيز الرسالة", approve: "موافقة المالك (إرسال وانتظار)", ok: "تمت الموافقة؟" };
const at = (name) => w.nodes.find((n) => n.name === name);
const base = at("Build Emails").position;

const SYS = [
  "أنت مساعد Business Partner لصياغة رسائل بريد تعريفية لشركات سعودية (B2B).",
  "الخدمات: تأسيس الشركات، الاستقدام والتوظيف، الخدمات الحكومية، الامتثال، المحاسبة، الدعم الإداري.",
  "اكتب بالعربية الفصحى المهنية المختصرة، بلا مبالغة ولا لغة دعائية، ولا تذكر أي سعر أو ضمان أو خصم أو وعد بنتيجة حكومية.",
  "اختم برسالة تدعو للرد إن رغب العميل بمعرفة المزيد، واذكر أن بإمكانه طلب عدم المراسلة.",
  "ابدأ بـ«السادة / اسم المنشأة المحترمين»، واختم بسطرين: «مع خالص التحية،» ثم «فريق Business Partner».",
  "أعد JSON صالحاً فقط بمفتاحين: subject (سطر الموضوع) وbody (نص الرسالة).",
].join("\n");

const newNodes = [
  { id: uid(), name: N.limit, type: "n8n-nodes-base.limit", typeVersion: 1, position: [base[0] + 240, base[1]], parameters: { maxItems: 1 } },
  {
    id: uid(), name: N.draft, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [base[0] + 480, base[1]],
    parameters: {
      method: "POST", url: AZ_URL, authentication: "predefinedCredentialType", nodeCredentialType: "azureOpenAiApi", sendBody: true, specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: " + JSON.stringify(SYS) + " }, { role: 'user', content: `بيانات العميل المحتمل (JSON):\\n${JSON.stringify((() => { const l = $('Get Ready-to-Send').all().find((i) => i.json.id === $json._pageId)?.json || {}; const o = { name: $json._company }; for (const k of Object.keys(l)) if (/^property_(sector|city|size|ownership|description|entity_type)$/.test(k) && l[k]) o[k.replace('property_', '')] = l[k]; return o; })())}\\n\\nاكتب رسالة تعريفية مخصصة له.` }] }) }}",
      options: { timeout: 90000 },
    }, credentials: CRED_AZ,
  },
  {
    id: uid(), name: N.prep, type: "n8n-nodes-base.code", typeVersion: 2, position: [base[0] + 720, base[1]],
    parameters: {
      mode: "runOnceForEachItem", language: "javaScript",
      jsCode: [
        renderEmail.toString(),
        "let t = {};",
        "try { t = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) { t = {}; }",
        `const src = $('${N.limit}').item.json;`,
        "if (!t.subject || !t.body) throw new Error('تعذّرت صياغة الرسالة لهذا العميل');",
        "return { json: { _pageId: src._pageId, _to: src._to, _company: src._company, _testMode: src._testMode, _subject: String(t.subject), _body: String(t.body), _html: renderEmail(String(t.subject), String(t.body)) } };",
      ].join("\n"),
    },
  },
  {
    id: uid(), name: N.approve, type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [base[0] + 960, base[1]],
    parameters: {
      operation: "sendAndWait", sendTo: APPROVER,
      subject: "={{ '[موافقة إرسال] ' + $json._subject }}",
      message: "={{ 'المنشأة: ' + $json._company + '\\nإلى: ' + $json._to + ($json._testMode ? '  (وضع التجربة TEST_TO)' : '') + '\\n\\n' + $json._subject + '\\n\\n' + $json._body + '\\n\\n— ستصل للعميل بقالب HTML بشعار Business Partner.' }}",
      responseType: "approval", approvalOptions: { values: { approvalType: "double" } }, options: {},
    }, credentials: GMAIL,
  },
  {
    id: uid(), name: N.ok, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [base[0] + 1200, base[1]],
    parameters: {
      conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: uid(), leftValue: "={{ $json.data?.approved }}", rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" },
      options: {},
    },
  },
];

// تعديل Send via Gmail / Mark Sent ليقرآ من «تجهيز الرسالة» (بعد الموافقة يصبح $json بيانات الموافقة).
const send = at("Send via Gmail"), mark = at("Mark Sent");
const P = `$('${N.prep}').item.json`;
send.parameters.sendTo = `={{ ${P}._to }}`; send.parameters.subject = `={{ ${P}._subject }}`; send.parameters.message = `={{ ${P}._html }}`;
mark.parameters.pageId = { __rl: true, mode: "id", value: `={{ ${P}._pageId }}` };
send.position = [base[0] + 1440, base[1] - 40]; mark.position = [base[0] + 1680, base[1] - 40];

w.nodes.push(...newNodes);
const c = w.connections;
c["Build Emails"] = { main: [[{ node: N.limit, type: "main", index: 0 }]] };
const link = (a, b, i = 0) => { c[a] = c[a] || { main: [] }; c[a].main[i] = [{ node: b, type: "main", index: 0 }]; };
link(N.limit, N.draft); link(N.draft, N.prep); link(N.prep, N.approve); link(N.approve, N.ok);
c[N.ok] = { main: [[{ node: "Send via Gmail", type: "main", index: 0 }], []] };
// Send via Gmail → Mark Sent كما هو

const readme = at("README");
readme.parameters.content += "\n\n### ترقية 2026-10-14 (قرار المالك)\nأُضيف بعد `Build Emails`: عميل واحد في الدورة ← صياغة Azure ← قالب HTML بالشعار ← **موافقة المالك بالبريد** ← Send via Gmail ← Mark Sent. لا يخرج شيء بلا موافقة. الحمايات القديمة كلها باقية. **السير ما زال متوقفاً** (تفعيله قرار المالك بعد قراءة سياسة سلامة البريد وتجربة بصف تجريبي: ضع بريدك في `TEST_TO` داخل Build Emails).";

console.log(`${apply ? "تطبيق" : "تجربة"}: ${w.name} — ${w.nodes.length - newNodes.length} → ${w.nodes.length} عقدة، يبقى غير نشط`);
if (apply) {
  const fresh = await get();
  if (fresh.updatedAt !== w.updatedAt || fresh.nodes.length !== w.nodes.length - newNodes.length) {
    throw new Error("السير تغيّر أثناء التحضير (جلسة أخرى؟) — أُلغي بلا كتابة");
  }
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `backup-campaign-sender-${Date.now()}.json`), JSON.stringify(fresh));
  const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => ["executionOrder", "timezone", "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy"].includes(k)));
  const r = await fetch(`${B}/api/v1/workflows/${ID}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  if (!r.ok) throw new Error(`PUT ${ID}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  console.log("تم — active:", (await r.json()).active);
}
