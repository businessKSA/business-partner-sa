// يبني سير «Email Marketing Network» على Azure (T7XUSox6eNNKLSZm) من هيكله الناقص — يبقى **غير نشط** للاختبار.
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/build-email-marketing.mjs          # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… BACKUP_DIR=… node ops/azure-n8n/build-email-marketing.mjs --apply
//
// القاعدة الفعلية: «BP — Companies Sales DB» (أعمدتها فُحصت): Email, Campaign Sent, Last Campaign Status, Campaign Date,
//   Suppressed, Suppress Reason, Duplicate, Stage (status), Sector, City, ICP Score, Notes.
// المسار ١ (يدوي + أيام العمل 9 صباحاً): عملاء لهم Email وليسوا Campaign Sent/Suppressed/Duplicate (عميل واحد في كل دورة — قرار المالك 2026-10-14: موافقة مستقلة لكل رسالة) →
//   صياغة Azure (bp-main) → موافقة المالك بالبريد (send-and-wait) → إرسال للعميل → Campaign Sent ✓ + Last Campaign Status=Sent + Campaign Date.
//   لا يخرج بريد بلا موافقة.
// المسار ٢ (Gmail كل ١٥ دقيقة): ردّ وارد → تصنيف Azure → إيجاد العميل بالبريد → Stage=In progress؛ وإن طلب إلغاء المراسلة
//   → Suppressed ✓ + Suppress Reason=Unsubscribed؛ وملخص الرد يُضاف في الصفحة.
// حُذفت: توليد الصور (OpenAI) وBannerbear — مدفوعان خارج Azure.
import fs from "node:fs";
import path from "node:path";
import { renderEmail } from "./email-template.mjs";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply");
const backupDir = process.env.BACKUP_DIR || ".";
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const ID = "T7XUSox6eNNKLSZm";
const LEADS_DB = "26faca27-6188-4b6a-b584-924c374f2d22"; // BP — Companies Sales DB (قاعدة الشركات)
const APPROVER = "dr.baher.magnas@gmail.com"; // المالك (CLAUDE.md) — يوافق على كل رسالة قبل خروجها
const CRED_AZ = { azureOpenAiApi: { id: "fI2SkJuYmB2v3zCo", name: "Azure Open AI account" } };
const AZ_URL = "https://bp-ai-ksa-2026.openai.azure.com/openai/deployments/bp-main/chat/completions?api-version=2025-03-01-preview";

const w = await (await fetch(`${B}/api/v1/workflows/${ID}`, { headers: H })).json();
if (w.active) { console.error("السير نشط — يُبنى وهو معطّل فقط"); process.exit(1); }
const credOf = (type) => w.nodes.find((n) => n.credentials?.[type])?.credentials[type];
// اعتماد Gmail الموجود فعلاً على Azure (الاعتماد القديم 1AQfIiEH6y5Zu61s لم يُنقل إلى Azure فيفشل أي إرسال).
const NOTION = { notionApi: credOf("notionApi") }, GMAIL = { gmailOAuth2: { id: "fKJNtBfZTsc3UkW9", name: "Gmail — Business Partner — Production" } };
if (!NOTION.notionApi) throw new Error("اعتماد Notion مفقود في السير");

const uid = () => crypto.randomUUID();
const node = (name, type, typeVersion, position, parameters, credentials) => ({ id: uid(), name, type, typeVersion, position, parameters, ...(credentials ? { credentials } : {}) });
const notionLeads = (name, pos, extra) => node(name, "n8n-nodes-base.notion", 2.2, pos, {
  authentication: "apiKey", resource: "databasePage", operation: "getAll",
  databaseId: { __rl: true, mode: "id", value: LEADS_DB }, ...extra,
}, NOTION);
const notionUpdate = (name, pos, pageExpr, props) => node(name, "n8n-nodes-base.notion", 2.2, pos, {
  authentication: "apiKey", resource: "databasePage", operation: "update",
  pageId: { __rl: true, mode: "id", value: pageExpr },
  propertiesUi: { propertyValues: props }, options: {},
}, NOTION);
const ai = (name, pos, system, userExpr, extraBody = "") => node(name, "n8n-nodes-base.httpRequest", 4.2, pos, {
  method: "POST", url: AZ_URL, authentication: "predefinedCredentialType", nodeCredentialType: "azureOpenAiApi",
  sendBody: true, specifyBody: "json",
  jsonBody: `={{ JSON.stringify({ ${extraBody} response_format: { type: 'json_object' }, messages: [{ role: 'system', content: ${JSON.stringify(system)} }, { role: 'user', content: ${userExpr} }] }) }}`,
  options: { timeout: 90000 },
}, CRED_AZ);
const ifNode = (name, pos, left, op) => node(name, "n8n-nodes-base.if", 2.2, pos, {
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: uid(), leftValue: left, rightValue: "", operator: op }], combinator: "and",
  }, options: {},
});
const NOT_EMPTY = { type: "string", operation: "notEmpty", singleValue: true };
const IS_TRUE = { type: "boolean", operation: "true", singleValue: true };

const SYS_DRAFT = [
  "أنت مساعد Business Partner لصياغة رسائل بريد تعريفية لشركات سعودية (B2B).",
  "الخدمات: تأسيس الشركات، الاستقدام والتوظيف، الخدمات الحكومية، الامتثال، المحاسبة، الدعم الإداري.",
  "اكتب بالعربية الفصحى المهنية المختصرة، بلا مبالغة ولا لغة دعائية، ولا تذكر أي سعر أو ضمان أو خصم أو وعد بنتيجة حكومية.",
  "اختم برسالة تدعو للرد إن رغب العميل بمعرفة المزيد، واذكر أن بإمكانه طلب عدم المراسلة.",
  "ابدأ بـ«السادة / اسم المنشأة المحترمين»، واختم بسطرين: «مع خالص التحية،» ثم «فريق Business Partner».",
  "أعد JSON صالحاً فقط بمفتاحين: subject (سطر الموضوع) وbody (نص الرسالة).",
].join("\n");
const SYS_CLASSIFY = [
  "صنّف ردّ عميل محتمل على رسالة تعريفية من Business Partner.",
  "أعد JSON صالحاً فقط بمفتاحين: intent وsummary_ar.",
  "قيم intent المسموحة فقط: interested أو question أو not_interested أو unsubscribe أو other.",
  "summary_ar جملة عربية واحدة تلخّص الرد. لا تختلق شيئاً غير وارد في النص.",
].join("\n");

const N = {
  manual: "تشغيل يدوي", sched: "جدولة — أيام العمل 9 صباحاً", leads: "جلب العملاء الجاهزين", hasMail: "عنده بريد؟",
  draft: "صياغة الرسالة (Azure)", parse: "تجهيز الرسالة", approve: "موافقة المالك (إرسال وانتظار)", ok: "تمت الموافقة؟",
  send: "إرسال للعميل", sent: "وسم: أُرسل",
  gmail: "ردود Gmail الواردة", classify: "تصنيف الرد (Azure)", reply: "تجهيز الرد", find: "إيجاد العميل بالبريد",
  found: "وُجد العميل؟", mark: "وسم: العميل ردّ", unsub: "طلب إلغاء المراسلة؟", suppress: "وسم: إيقاف المراسلة", note: "تسجيل ملخص الرد في الصفحة",
};
const nodes = [
  node(N.manual, "n8n-nodes-base.manualTrigger", 1, [0, 0], {}),
  node(N.sched, "n8n-nodes-base.scheduleTrigger", 1.3, [0, 220], { rule: { interval: [{ field: "cronExpression", expression: "0 9 * * 1-5" }] } }),
  notionLeads(N.leads, [260, 100], { limit: 1, filterType: "manual", matchType: "allFilters", filters: { conditions: [
    { key: "Email|email", condition: "is_not_empty" },
    { key: "Campaign Sent|checkbox", condition: "equals", checkboxValue: false },
    { key: "Suppressed|checkbox", condition: "equals", checkboxValue: false },
    { key: "Duplicate|checkbox", condition: "equals", checkboxValue: false },
  ] }, options: {} }),
  ifNode(N.hasMail, [500, 100], "={{ $json.property_email }}", NOT_EMPTY),
  ai(N.draft, [740, 80], SYS_DRAFT, "`بيانات العميل المحتمل (JSON):\\n${JSON.stringify($json)}\\n\\nاكتب رسالة تعريفية مخصصة له.`", "temperature: 0.4,"),
  node(N.parse, "n8n-nodes-base.code", 2, [980, 80], {
    mode: "runOnceForEachItem", language: "javaScript",
    jsCode: [
      renderEmail.toString(),
      "let t = {};",
      "try { t = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) { t = {}; }",
      `const lead = $('${N.leads}').item.json;`,
      "if (!t.subject || !t.body) throw new Error('تعذّرت صياغة الرسالة لهذا العميل');",
      "return { json: { subject: String(t.subject), body: String(t.body), html: renderEmail(String(t.subject), String(t.body)), leadId: lead.id, to: lead.property_email } };",
    ].join("\n"),
  }),
  node(N.approve, "n8n-nodes-base.gmail", 2.2, [1220, 80], {
    operation: "sendAndWait", sendTo: APPROVER,
    subject: "={{ '[مراجعة قبل الإرسال] ' + $json.subject }}",
    message: "={{ 'إلى: ' + $json.to + '\\n\\n' + $json.subject + '\\n\\n' + $json.body + '\\n\\n— سيصل للعميل بقالب HTML بشعار Business Partner.' }}",
    responseType: "approval", approvalOptions: { values: { approvalType: "double" } }, options: {},
  }, GMAIL),
  ifNode(N.ok, [1460, 80], "={{ $json.data?.approved }}", IS_TRUE),
  node(N.send, "n8n-nodes-base.gmail", 2.2, [1700, 40], {
    resource: "message", operation: "send", emailType: "html",
    sendTo: `={{ $('${N.parse}').item.json.to }}`,
    subject: `={{ $('${N.parse}').item.json.subject }}`,
    message: `={{ $('${N.parse}').item.json.html }}`,
    options: { appendAttribution: false },
  }, GMAIL),
  notionUpdate(N.sent, [1940, 40], `={{ $('${N.parse}').item.json.leadId }}`, [
    { key: "Campaign Sent|checkbox", type: "checkbox", checkboxValue: true },
    { key: "Last Campaign Status|select", type: "select", selectValue: "Sent" },
    { key: "Campaign Date|date", type: "date", includeTime: false, date: "={{ $now.toISODate() }}" },
  ]),

  node(N.gmail, "n8n-nodes-base.gmailTrigger", 1.4, [0, 560], {
    pollTimes: { item: [{ mode: "everyX", value: 15, unit: "minutes" }] }, simple: true,
    filters: { q: "in:inbox is:unread category:primary -from:me", readStatus: "unread" },
  }, GMAIL),
  ai(N.classify, [260, 560], SYS_CLASSIFY, "`من: ${$json.From || $json.from || ''}\\nالموضوع: ${$json.Subject || $json.subject || ''}\\n\\n${$json.snippet || $json.text || ''}`", "temperature: 0,"),
  node(N.reply, "n8n-nodes-base.code", 2, [500, 560], {
    mode: "runOnceForEachItem", language: "javaScript",
    jsCode: [
      "let t = {};",
      "try { t = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) { t = {}; }",
      `const m = $('${N.gmail}').item.json;`,
      "const from = String(m.From || m.from || '');",
      "const email = (from.match(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/) || [''])[0].toLowerCase();",
      "const intent = ['interested','question','not_interested','unsubscribe','other'].includes(t.intent) ? t.intent : 'other';",
      "return { json: { email, intent, summary: String(t.summary_ar || ''), unsub: intent === 'unsubscribe' } };",
    ].join("\n"),
  }),
  notionLeads(N.find, [740, 560], { limit: 1, filterType: "manual", matchType: "allFilters", filters: { conditions: [{ key: "Email|email", condition: "equals", emailValue: "={{ $json.email }}" }] }, options: {} }),
  ifNode(N.found, [980, 560], "={{ $json.id }}", NOT_EMPTY),
  notionUpdate(N.mark, [1220, 520], "={{ $json.id }}", [{ key: "Stage|status", type: "status", statusValue: "In progress" }]),
  ifNode(N.unsub, [1460, 520], `={{ $('${N.reply}').item.json.unsub }}`, IS_TRUE),
  notionUpdate(N.suppress, [1700, 480], "={{ $json.id }}", [
    { key: "Suppressed|checkbox", type: "checkbox", checkboxValue: true },
    { key: "Suppress Reason|select", type: "select", selectValue: "Unsubscribed" },
  ]),
  node(N.note, "n8n-nodes-base.notion", 2.2, [1940, 520], {
    authentication: "apiKey", resource: "block", operation: "append",
    blockId: { __rl: true, mode: "id", value: "={{ $json.id }}" },
    blockUi: { blockValues: [{ type: "paragraph", textContent: `={{ 'ردّ (' + $('${N.reply}').item.json.intent + '): ' + $('${N.reply}').item.json.summary }}` }] },
  }, NOTION),
];
const link = (...pairs) => Object.fromEntries(pairs.map(([a, outs]) => [a, { main: outs.map((o) => o.map((n) => ({ node: n, type: "main", index: 0 }))) }]));
const connections = link(
  [N.manual, [[N.leads]]], [N.sched, [[N.leads]]], [N.leads, [[N.hasMail]]],
  [N.hasMail, [[N.draft], []]], [N.draft, [[N.parse]]], [N.parse, [[N.approve]]], [N.approve, [[N.ok]]],
  [N.ok, [[N.send], []]], [N.send, [[N.sent]]],
  [N.gmail, [[N.classify]]], [N.classify, [[N.reply]]], [N.reply, [[N.find]]], [N.find, [[N.found]]],
  [N.found, [[N.mark], []]], [N.mark, [[N.unsub]]], [N.unsub, [[N.suppress], [N.note]]], [N.suppress, [[N.note]]],
);

fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, `backup-email-marketing-${Date.now()}.json`), JSON.stringify(w));
console.log(`${apply ? "تطبيق" : "تجربة"}: ${w.name} — ${w.nodes.length} → ${nodes.length} عقدة، يبقى غير نشط`);
if (apply) {
  const settings = { executionOrder: "v1", timezone: "Asia/Riyadh" };
  const r = await fetch(`${B}/api/v1/workflows/${ID}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes, connections, settings }) });
  if (!r.ok) throw new Error(`PUT ${ID}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  console.log("تم — active:", (await r.json()).active);
}
