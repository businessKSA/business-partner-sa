// منظّم البريد (Gmail): تصنيف القديم بقواعد رخيصة + فرز الجديد بالذكاء الاصطناعي مع إبلاغ المالك بالمهم.
//
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/mail-organizer.mjs company     # بريد الشركة
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/mail-organizer.mjs personal    # البريد الشخصي
//
// لا يحذف ولا يؤرشف ولا يرسل: يضيف ليبلات فقط (تُزال بلا أثر). ثلاثة أجزاء لكل حساب:
//  ١) «تصنيف القديم»: قواعد بحث Gmail مرتّبة (حكومي ← مالية ← أدوات ← نشرات ← اجتماعي ← إشعارات آلية ← مراسلات)،
//     كل رسالة تأخذ أول قاعدة تطابقها ثم الليبل الجامع BP-Mail فلا تُصنَّف مرتين. ٥٠٠ رسالة لكل صفحة، حتى ٨ صفحات لكل تشغيل.
//  ٢) «فرز الجديد»: كل ١٠ دقائق، رسائل الصندوق الجديدة غير المفروزة: bp-fast يصنّف ويقدّر الأهمية وهل تحتاج رداً،
//     والمهم (٣ من ٣) يأخذ «BP-Mail/مهم — يحتاج رد» ويُبلَّغ به المالك.
//  ٣) الليبلات تُنشأ مرة واحدة ومعرّفاتها تُكتب في الكود.
// الليبلات الموجودة عندك (Notes, ZATCA, Nadia…) لا تُمسّ.
import fs from "node:fs";
import crypto from "node:crypto";

const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const api = async (m, p, b) => { const r = await fetch(`${AZ}/api/v1${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; } if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 300)}`); return j; };

const ACCOUNTS = {
  company: { cred: { id: "fKJNtBfZTsc3UkW9", name: "Gmail — Business Partner — Production" }, title: "الشركة" },
  personal: { cred: { id: "Mam8ItBxusixERk1", name: "Gmail — Personal — Baher" }, title: "الشخصي" },
};
const which = process.argv[2]; const A = ACCOUNTS[which];
if (!A) { console.error("استعمل: company | personal"); process.exit(1); }
const CRED = { gmailOAuth2: A.cred };

// قواعد التصنيف القديم (الترتيب مهم)
const RULES = [
  { label: "BP-Mail/سير ذاتية", q: "label:BP-CV" },
  { label: "BP-Mail/حكومي", q: "from:(.gov.sa OR qiwa.sa OR absher.sa OR muqeem.sa OR gosi.gov.sa OR zatca.gov.sa OR balady.gov.sa OR mc.gov.sa OR misa.gov.sa)" },
  { label: "BP-Mail/مالية وفواتير", q: "from:(alrajhibank.com.sa OR alahli.com OR riyadbank.com OR bsf.sa OR stcpay.com.sa OR moyasar.com OR tamara.co OR daftra.com OR stripe.com OR paypal.com OR wise.com) OR subject:(فاتورة OR invoice OR receipt OR إيصال OR \"payment received\")" },
  { label: "BP-Mail/أدوات ومنصات", q: "from:(github.com OR vercel.com OR notion.so OR microsoft.com OR azure.com OR n8n.io OR supabase.com OR zoom.us OR slack.com OR figma.com OR cloudflare.com OR openai.com OR anthropic.com OR google.com OR linkedin.com OR canva.com)" },
  { label: "BP-Mail/نشرات وعروض", q: "category:promotions OR category:forums" },
  { label: "BP-Mail/اجتماعي", q: "category:social" },
  { label: "BP-Mail/إشعارات آلية", q: "category:updates" },
  { label: "BP-Mail/مراسلات", q: "in:inbox" },
];
const EXTRA = ["BP-Mail", "BP-Mail/مهم — يحتاج رد", "BP-Triaged"];
const ALL_LABELS = [...RULES.map((r) => r.label), ...EXTRA];

const http = (id, name, pos, method, url, extra = {}, node = {}) => ({ id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: pos, credentials: CRED, onError: "continueRegularOutput",
  parameters: { method, url, authentication: "predefinedCredentialType", nodeCredentialType: "gmailOAuth2", options: {}, ...extra }, ...node });
const code = (id, name, pos, jsCode) => ({ id, name, type: "n8n-nodes-base.code", typeVersion: 2, position: pos, parameters: { jsCode } });
const ifTrue = (id, name, pos, expr) => ({ id, name, type: "n8n-nodes-base.if", typeVersion: 2.2, position: pos, parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: id + "c", leftValue: expr, rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} } });
const wire = (pairs) => { const c = {}; for (const [from, outs] of pairs) c[from] = { main: outs.map((o) => (Array.isArray(o) ? o : [o]).map((n) => ({ node: n, type: "main", index: 0 }))) }; return c; };

// ───────── ضمان الليبلات ─────────
async function ensureLabels() {
  const path = "bp-mail-labels-" + crypto.randomBytes(6).toString("hex");
  const wf = { name: `TEMP — ليبلات المنظّم ${A.title}`, settings: { executionOrder: "v1" },
    nodes: [
      { id: "wh", name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], webhookId: crypto.randomUUID(), parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: {} } },
      http("l1", "List1", [220, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/labels"),
      code("plan", "Plan", [440, 0], `const have = new Set((($input.first().json.labels)||[]).map(l => l.name));\nconst need = ${JSON.stringify(ALL_LABELS)}.filter(n => !have.has(n));\nreturn need.length ? need.map(n => ({ json: { name: n } })) : [{ json: { skip: true } }];`),
      ifTrue("if", "Missing?", [660, 0], "={{ $json.skip !== true }}"),
      http("cr", "Create", [880, -80], "POST", "https://gmail.googleapis.com/gmail/v1/users/me/labels", { sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify({ name: $json.name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }) }}" }),
      http("l2", "List2", [1100, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/labels", {}, { executeOnce: true }),
      code("map", "Map", [1320, 0], `const labels = ($('List2').first().json.labels) || [];\nconst want = ${JSON.stringify(ALL_LABELS)};\nconst map = {}; for (const l of labels) if (want.includes(l.name)) map[l.name] = l.id;\nreturn [{ json: { result: { map, missing: want.filter(n => !map[n]) } } }];`),
      { id: "rs", name: "Respond", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1540, 0], parameters: { respondWith: "json", responseBody: "={{ $json.result }}", options: {} } },
    ],
    connections: wire([["Webhook", ["List1"]], ["List1", ["Plan"]], ["Plan", ["Missing?"]], ["Missing?", [["Create"], ["List2"]]], ["Create", ["List2"]], ["List2", ["Map"]], ["Map", ["Respond"]]]) };
  const { id } = await api("POST", "/workflows", wf);
  try {
    await api("POST", `/workflows/${id}/activate`);
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${AZ}/webhook/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return await r.json();
  } finally {
    await fetch(`${AZ}/api/v1/workflows/${id}/deactivate`, { method: "POST", headers: H }).catch(() => {});
    await fetch(`${AZ}/api/v1/workflows/${id}`, { method: "DELETE", headers: H }).catch(() => {});
  }
}
const labels = await ensureLabels();
if (labels.missing?.length) { console.error("ليبلات ناقصة:", labels.missing); process.exit(1); }
const L = labels.map;
console.log(`ليبلات المنظّم جاهزة (${Object.keys(L).length}) — ${A.title}`);
const RULE_LIST = RULES.map((r) => ({ q: r.q, id: L[r.label], name: r.label }));

// ───────── ١) تصنيف القديم ─────────
const backlog = {
  name: `BP — منظّم بريد ${A.title}: تصنيف القديم`,
  settings: { executionOrder: "v1", saveDataSuccessExecution: "all", saveDataErrorExecution: "all", executionTimeout: 1200 },
  nodes: [
    { id: "t", name: "⏱️ كل 5 دقائق", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 5 }] } } },
    code("st", "⚙️ القاعدة الحالية", [220, 0], `// ${RULE_LIST.length} قواعد مرتّبة؛ المؤشر في الحالة الثابتة.\nconst RULES = ${JSON.stringify(RULE_LIST)};\nconst PARENT = ${JSON.stringify(L["BP-Mail"])};\nconst s = $getWorkflowStaticData('global');\nif (s.i === undefined) { s.i = 0; s.classified = 0; s.notified = false; }\nif (s.i >= RULES.length) { if (!s.notified) { s.notified = true; return [{ json: { finished: true, classified: s.classified } }]; } return []; }\nconst r = RULES[s.i];\nreturn [{ json: { q: '(' + r.q + ') -label:BP-Mail -in:trash -in:spam', labelId: r.id, parent: PARENT, name: r.name, finished: false } }];`),
    ifTrue("fin", "❓ انتهى كله؟", [440, 0], "={{ $json.finished === true }}"),
    http("note", "📣 إبلاغ المالك", [660, -100], "POST", `${AZ}/webhook/website-lead-notify`, { sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify({ source: "mail-organizer", ref: "MAIL-${which.toUpperCase()}", name: "منظّم بريد ${A.title}", transcript: "اكتمل تصنيف القديم في بريد ${A.title}. عدد الرسائل المصنَّفة: " + $json.classified }) }}` }),
    http("list", "📥 رسائل القاعدة", [660, 100], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/messages", { sendQuery: true, queryParameters: { parameters: [{ name: "q", value: "={{ $json.q }}" }, { name: "maxResults", value: "500" }] } }),
    code("chk", "📋 فحص الصفحة", [880, 100], `const cur = $('⚙️ القاعدة الحالية').first().json;\nconst again = $('🔁 صفحة أخرى؟').isExecuted ? $('🔁 صفحة أخرى؟').last().json : null;\nconst ctx = again && again.q ? again : cur;\nconst ids = (($input.first().json.messages)||[]).map(m => m.id);\nconst s = $getWorkflowStaticData('global');\nif (ids.length < 500) s.i = (s.i || 0) + 1;   // القاعدة استُنفدت بعد هذه الصفحة\ns.classified = (s.classified || 0) + ids.length;\nif (!ids.length) return [];\nreturn [{ json: { ids, labelId: ctx.labelId, parent: ctx.parent, q: ctx.q, full: ids.length === 500 } }];`),
    http("bm", "🏷️ وسم الدفعة", [1100, 100], "POST", "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify", { sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify({ ids: $json.ids, addLabelIds: [$json.labelId, $json.parent] }) }}" }),
    code("again", "🔁 صفحة أخرى؟", [1320, 100], `const c = $('📋 فحص الصفحة').first().json;\nif (!c.full || $runIndex >= 7) return [];\nreturn [{ json: { q: c.q, labelId: c.labelId, parent: c.parent } }];`),
  ],
};
backlog.connections = wire([["⏱️ كل 5 دقائق", ["⚙️ القاعدة الحالية"]], ["⚙️ القاعدة الحالية", ["❓ انتهى كله؟"]], ["❓ انتهى كله؟", [["📣 إبلاغ المالك"], ["📥 رسائل القاعدة"]]], ["📥 رسائل القاعدة", ["📋 فحص الصفحة"]], ["📋 فحص الصفحة", ["🏷️ وسم الدفعة"]], ["🏷️ وسم الدفعة", ["🔁 صفحة أخرى؟"]], ["🔁 صفحة أخرى؟", ["📥 رسائل القاعدة"]]]);
// الحلقة: «📥 رسائل القاعدة» تأخذ q من $json؛ في الدورة الثانية يأتيها من «🔁 صفحة أخرى؟»

// ───────── ٢) فرز الجديد ─────────
const CATS = RULES.map((r) => r.label.replace("BP-Mail/", ""));
const triage = {
  name: `BP — منظّم بريد ${A.title}: فرز الجديد`,
  settings: { executionOrder: "v1", saveDataSuccessExecution: "none", saveDataErrorExecution: "all", executionTimeout: 900 },
  nodes: [
    { id: "t", name: "⏱️ كل 10 دقائق", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 10 }] } } },
    http("list", "📥 الجديد غير المفروز", [220, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/messages", { sendQuery: true, queryParameters: { parameters: [{ name: "q", value: "in:inbox newer_than:2d -label:BP-Triaged -label:BP-Mail" }, { name: "maxResults", value: "15" }] } }),
    code("sp", "تفكيك", [440, 0], "return (($input.first().json.messages)||[]).map(m => ({ json: { id: m.id } }));"),
    { id: "loop", name: "🔁 واحدة تلو الأخرى", type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [660, 0], parameters: { batchSize: 1, options: {} } },
    { id: "get", name: "📩 الرسالة", type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [880, 100], credentials: CRED, parameters: { resource: "message", operation: "get", messageId: "={{ $json.id }}", simple: true, options: {} } },
    { id: "llm", name: "🧠 فرز (Azure)", type: "@n8n/n8n-nodes-langchain.chainLlm", typeVersion: 1.9, position: [1100, 100], parameters: { promptType: "define",
      text: "=من: {{ JSON.stringify($json.From || $json.from || '') }}\nالموضوع: {{ $json.Subject || $json.subject || '' }}\nمقتطف: {{ ($json.snippet || '').slice(0, 500) }}",
      messages: { messageValues: [{ message: `أنت فرّاز بريد لمالك شركة سعودية صغيرة (Business Partner). صنّف الرسالة وأعد JSON صالحاً فقط بلا شرح: {"category": أحد [${CATS.map((c) => `"${c}"`).join(",")}], "importance": 1|2|3, "needs_reply": true|false, "summary_ar": "جملة قصيرة بالعربية"}. importance=3 فقط لرسالة من إنسان حقيقي أو جهة رسمية أو عميل أو مال يحتاج قراراً أو ردّاً قريباً (عميل، فاتورة مستحقة، تنبيه حكومي، موعد، مرشح مهم). الإشعارات الآلية والنشرات والعروض importance=1. لا تختلق معلومات.` }] } } },
    { id: "lm", name: "Azure OpenAI (bp-fast)", type: "@n8n/n8n-nodes-langchain.lmChatAzureOpenAi", typeVersion: 1, position: [1100, 300], credentials: { azureOpenAiApi: { id: "fI2SkJuYmB2v3zCo", name: "Azure Open AI account" } }, parameters: { model: "bp-fast", options: { temperature: 0.1, maxRetries: 2, maxTokens: 400, timeout: 60000 } } },
    code("parse", "📋 قرار الفرز", [1320, 100], `const raw = $json.text || $json.output || ($json.message && $json.message.content) || '';\nlet d = {}; try { d = JSON.parse(String(raw).replace(/\`\`\`json|\`\`\`/g, '').trim()); } catch (e) {}\nconst CATS = ${JSON.stringify(CATS)};\nconst L = ${JSON.stringify(L)};\nconst cat = CATS.includes(d.category) ? d.category : 'مراسلات';\nconst imp = Number(d.importance) || 1;\nconst ids = [L['BP-Mail'], L['BP-Triaged'], L['BP-Mail/' + cat]];\nif (imp >= 3 && L['BP-Mail/مهم — يحتاج رد']) ids.push(L['BP-Mail/مهم — يحتاج رد']);\nconst m = $('📩 الرسالة').item.json;\nreturn { json: { id: m.id, labelIds: ids.filter(Boolean), important: imp >= 3, cat, summary: String(d.summary_ar || '').slice(0, 200), from: JSON.stringify(m.From || m.from || '').slice(0, 120), subject: String(m.Subject || m.subject || '').slice(0, 120) } };`),
    http("bm", "🏷️ وسم", [1540, 100], "POST", "=https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ $json.id }}/modify", { sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify({ addLabelIds: $json.labelIds }) }}" }),
    ifTrue("imp", "❓ مهم؟", [1760, 100], "={{ $('📋 قرار الفرز').item.json.important === true }}"),
    http("note", "📣 إبلاغ المالك بالمهم", [1980, 0], "POST", `${AZ}/webhook/website-lead-notify`, { sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify({ source: "mail-important", ref: "MAIL-${which.toUpperCase()}", name: "بريد ${A.title} — مهم", transcript: "[" + $('📋 قرار الفرز').item.json.cat + "] " + $('📋 قرار الفرز').item.json.subject + " — " + $('📋 قرار الفرز').item.json.summary }) }}` }),
  ],
};
triage.connections = { ...wire([["⏱️ كل 10 دقائق", ["📥 الجديد غير المفروز"]], ["📥 الجديد غير المفروز", ["تفكيك"]], ["تفكيك", ["🔁 واحدة تلو الأخرى"]], ["🔁 واحدة تلو الأخرى", [[], ["📩 الرسالة"]]], ["📩 الرسالة", ["🧠 فرز (Azure)"]], ["🧠 فرز (Azure)", ["📋 قرار الفرز"]], ["📋 قرار الفرز", ["🏷️ وسم"]], ["🏷️ وسم", ["❓ مهم؟"]], ["❓ مهم؟", [["📣 إبلاغ المالك بالمهم"], ["🔁 واحدة تلو الأخرى"]]], ["📣 إبلاغ المالك بالمهم", ["🔁 واحدة تلو الأخرى"]]]),
  "Azure OpenAI (bp-fast)": { ai_languageModel: [[{ node: "🧠 فرز (Azure)", type: "ai_languageModel", index: 0 }]] } };
triage.connections["🔁 واحدة تلو الأخرى"] = { main: [[], [{ node: "📩 الرسالة", type: "main", index: 0 }]] };

const list = (await api("GET", "/workflows?limit=250")).data;
const out = {};
for (const [k, wf] of [["backlog", backlog], ["triage", triage]]) {
  const ex = list.find((w) => w.name === wf.name);
  const id = ex ? (await api("PUT", `/workflows/${ex.id}`, wf), ex.id) : (await api("POST", "/workflows", wf)).id;
  out[k] = { id, name: wf.name }; console.log(ex ? "حُدِّث" : "أُنشئ", k, id, "(غير مفعّل)");
}
fs.mkdirSync(".azure-n8n-backups", { recursive: true });
fs.writeFileSync(`.azure-n8n-backups/mail-organizer-${which}.json`, JSON.stringify({ ...out, labels: L }));
