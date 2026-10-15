// أرشفة العروض والإشعارات القديمة من وارد Gmail (يُسحب INBOX فقط؛ الرسائل تبقى في «كل البريد» وتُبحث).
//
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/mail-archive.mjs personal [أيام=30]
//
// ما يُؤرشَف: رسائل الوارد الأقدم من N يوماً، غير المميّزة بنجمة، التي صنّفها «منظّم البريد» نشرات/عروض أو إشعارات آلية.
// فلا تُؤرشَف الرسائل الحكومية ولا المالية ولا الأدوات (تأخذ ليبلاً آخر قبلها بترتيب القواعد)، ولا ما لم يُصنَّف بعد.
// يأخذ ما يُؤرشَف الليبل «BP-Mail/مؤرشف» ليسهل التراجع:  label:BP-Mail/مؤرشف ← أضف INBOX.
// لا حذف. يعمل كل ٥ دقائق ويقفل نفسه عند الفراغ، ويبلّغ المالك بالعدد.
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
if (!A) { console.error("استعمل: personal [أيام]"); process.exit(1); }
const DAYS = Number(process.argv[3] || 30);
const CRED = { gmailOAuth2: A.cred };
const LABEL = "BP-Mail/مؤرشف";
const http = (id, name, pos, method, url, extra = {}, node = {}) => ({ id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: pos, credentials: CRED, onError: "continueRegularOutput", parameters: { method, url, authentication: "predefinedCredentialType", nodeCredentialType: "gmailOAuth2", options: {}, ...extra }, ...node });
const wire = (pairs) => { const c = {}; for (const [from, outs] of pairs) c[from] = { main: outs.map((o) => (Array.isArray(o) ? o : [o]).map((n) => ({ node: n, type: "main", index: 0 }))) }; return c; };

// ضمان الليبل
async function ensureLabel() {
  const path = "bp-mail-arch-" + crypto.randomBytes(6).toString("hex");
  const wf = { name: "TEMP — ليبل الأرشفة", settings: { executionOrder: "v1" },
    nodes: [
      { id: "wh", name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], webhookId: crypto.randomUUID(), parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: {} } },
      http("l1", "List1", [220, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/labels"),
      { id: "pl", name: "Plan", type: "n8n-nodes-base.code", typeVersion: 2, position: [440, 0], parameters: { jsCode: `const f = (($input.first().json.labels)||[]).find(l => l.name === ${JSON.stringify(LABEL)});\nreturn [{ json: { id: f ? f.id : null } }];` } },
      { id: "if", name: "Exists?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [660, 0], parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: "c", leftValue: "={{ !!$json.id }}", rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} } },
      http("cr", "Create", [880, 100], "POST", "https://gmail.googleapis.com/gmail/v1/users/me/labels", { sendBody: true, specifyBody: "json", jsonBody: JSON.stringify({ name: LABEL, labelListVisibility: "labelShow", messageListVisibility: "show" }) }),
      { id: "o1", name: "Out1", type: "n8n-nodes-base.code", typeVersion: 2, position: [880, -80], parameters: { jsCode: "return [{ json: { result: { id: $json.id } } }];" } },
      { id: "o2", name: "Out2", type: "n8n-nodes-base.code", typeVersion: 2, position: [1100, 100], parameters: { jsCode: "return [{ json: { result: { id: $json.id || null, err: $json.error ? String($json.error.message || $json.error).slice(0,120) : null } } }];" } },
      { id: "rs", name: "Respond", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1320, 0], parameters: { respondWith: "json", responseBody: "={{ $json.result }}", options: {} } },
    ],
    connections: wire([["Webhook", ["List1"]], ["List1", ["Plan"]], ["Plan", ["Exists?"]], ["Exists?", [["Out1"], ["Create"]]], ["Create", ["Out2"]], ["Out1", ["Respond"]], ["Out2", ["Respond"]]]) };
  const { id } = await api("POST", "/workflows", wf);
  try {
    await api("POST", `/workflows/${id}/activate`);
    await new Promise((r) => setTimeout(r, 3000));
    return await (await fetch(`${AZ}/webhook/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json();
  } finally {
    await fetch(`${AZ}/api/v1/workflows/${id}/deactivate`, { method: "POST", headers: H }).catch(() => {});
    await fetch(`${AZ}/api/v1/workflows/${id}`, { method: "DELETE", headers: H }).catch(() => {});
  }
}
const lab = await ensureLabel();
if (!lab.id) { console.error("تعذّر إنشاء الليبل", lab); process.exit(1); }
console.log("ليبل الأرشفة:", LABEL, lab.id);

const Q = `in:inbox older_than:${DAYS}d -is:starred (label:BP-Mail/نشرات-وعروض OR label:BP-Mail/إشعارات-آلية)`;
const wf = {
  name: `BP — منظّم بريد ${A.title}: أرشفة العروض والإشعارات القديمة (>${DAYS} يوماً)`,
  settings: { executionOrder: "v1", saveDataSuccessExecution: "all", saveDataErrorExecution: "all", executionTimeout: 1200 },
  nodes: [
    { id: "t", name: "⏱️ كل 5 دقائق", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 5 }] } } },
    http("list", "📥 المرشّح للأرشفة", [220, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/messages", { sendQuery: true, queryParameters: { parameters: [{ name: "q", value: Q }, { name: "maxResults", value: "500" }] } }),
    { id: "chk", name: "📋 فحص", type: "n8n-nodes-base.code", typeVersion: 2, position: [440, 0], parameters: { jsCode:
      `const s = $getWorkflowStaticData('global');\nconst ids = (($input.first().json.messages)||[]).map(m => m.id);\nif (!ids.length) {\n  if ((s.total||0) > 0 && !s.notified) { s.notified = true; return [{ json: { finished: true, total: s.total } }]; }\n  return [];\n}\ns.total = (s.total || 0) + ids.length; s.notified = false;\nreturn [{ json: { finished: false, ids, full: ids.length === 500 } }];` } },
    { id: "fin", name: "❓ انتهى؟", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [660, 0], parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: "f", leftValue: "={{ $json.finished === true }}", rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} } },
    http("note", "📣 إبلاغ المالك", [880, -100], "POST", `${AZ}/webhook/website-lead-notify`, { sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify({ source: "mail-archive", ref: "MAIL-ARCHIVE-${which.toUpperCase()}", name: "أرشفة بريد ${A.title}", transcript: "اكتملت أرشفة العروض والإشعارات الأقدم من ${DAYS} يوماً في بريد ${A.title}. عدد الرسائل: " + $json.total + ". للتراجع: label:BP-Mail/مؤرشف ثم أضف INBOX." }) }}` }),
    http("arc", "🗄️ أرشفة الدفعة", [880, 100], "POST", "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify", { sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify({ ids: $json.ids, addLabelIds: [${JSON.stringify(lab.id)}], removeLabelIds: ['INBOX'] }) }}` }),
    { id: "again", name: "🔁 صفحة أخرى؟", type: "n8n-nodes-base.code", typeVersion: 2, position: [1100, 100], parameters: { jsCode: "const c = $('📋 فحص').first().json;\nif (!c.full || $runIndex >= 7) return [];\nreturn [{ json: {} }];" } },
  ],
};
wf.connections = wire([["⏱️ كل 5 دقائق", ["📥 المرشّح للأرشفة"]], ["📥 المرشّح للأرشفة", ["📋 فحص"]], ["📋 فحص", ["❓ انتهى؟"]], ["❓ انتهى؟", [["📣 إبلاغ المالك"], ["🗄️ أرشفة الدفعة"]]], ["🗄️ أرشفة الدفعة", ["🔁 صفحة أخرى؟"]], ["🔁 صفحة أخرى؟", ["📥 المرشّح للأرشفة"]]]);
const list = (await api("GET", "/workflows?limit=250")).data;
const ex = list.find((w) => w.name === wf.name);
const id = ex ? (await api("PUT", `/workflows/${ex.id}`, wf), ex.id) : (await api("POST", "/workflows", wf)).id;
fs.mkdirSync(".azure-n8n-backups", { recursive: true });
fs.writeFileSync(`.azure-n8n-backups/mail-archive-${which}.json`, JSON.stringify({ id, labelId: lab.id, query: Q }));
console.log(ex ? "حُدِّث" : "أُنشئ", id, "(غير مفعّل)");
