// «القارئ الشامل» — سير n8n على Azure يقرأ أي ملف ويرجع نصّه: PDF · صور · Word · Excel · PowerPoint · HTML · نصوص.
//
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/universal-reader.mjs            # إنشاء/تحديث السير وطباعة عنوانه
//
// المدخل (POST JSON): { filename, mimeType?, url? | mediaId? | base64?, maxChars? }
//   mediaId = معرّف وسيط واتساب (يُنزَّل بالاعتماد «WhatsApp account»)، url = رابط عام، base64 = محتوى الملف.
// المخرج: { ok, method, filename, pages, chars, truncated, text, note }
//
// القراءة بـ Azure AI Document Intelligence (prebuilt-read، النسخة 2024-11-30) عبر الاعتماد
// «Azure Document Intelligence — Production». مُتحقَّق بملفات حقيقية: PDF وصور PNG/JPEG وDOCX وXLSX وPPTX.
// غير مدعوم من الخدمة: الصيغ القديمة (.doc .xls .ppt) — لا تُرفَض بصمت، يرجع ok:false مع note تطلب تحويلها.
// الخدمة اقتصادية (قراءة فقط، تُخصم من رصيد Azure) ولا تمرّ بأي مزوّد خارجي.
import fs from "node:fs";
import crypto from "node:crypto";

const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };

const NAME = "BP — القارئ الشامل (PDF · صور · Word · Excel · PowerPoint)";
const DI_URL = "https://bp-ai-claude-eu.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30";
const CRED_DI = { httpHeaderAuth: { id: "23aoQi3OkX3TZyhy", name: "Azure Document Intelligence — Production" } };
const CRED_WA = { whatsAppApi: { id: "SSNPpraVFcKAyzpx", name: "WhatsApp account" } };

const PLAN = `
const b = $input.first().json.body || $input.first().json;
const filename = String(b.filename || b.name || '').trim();
const mimeIn = String(b.mimeType || b.mime || '').toLowerCase().split(';')[0];
const DI = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', bmp: 'image/bmp',
  tif: 'image/tiff', tiff: 'image/tiff', heif: 'image/heif', heic: 'image/heif',
  html: 'text/html', htm: 'text/html',
};
const TEXT = new Set(['txt', 'csv', 'tsv', 'json', 'md', 'xml', 'log', 'eml', 'vcf']);
const LEGACY = new Set(['doc', 'xls', 'ppt', 'rtf', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key']);
let ext = ((filename.match(/\\.([A-Za-z0-9]+)$/) || [])[1] || '').toLowerCase();
if (!ext && mimeIn) {
  const rev = Object.entries(DI).find(([, m]) => m === mimeIn);
  if (rev) ext = rev[0];
  else if (mimeIn.startsWith('text/')) ext = 'txt';
  else if (mimeIn === 'application/msword') ext = 'doc';
  else if (mimeIn === 'application/vnd.ms-excel') ext = 'xls';
  else if (mimeIn === 'application/vnd.ms-powerpoint') ext = 'ppt';
}
let kind = 'unknown', contentType = mimeIn || 'application/octet-stream';
if (DI[ext]) { kind = 'di'; contentType = DI[ext]; }
else if (TEXT.has(ext)) kind = 'text';
else if (LEGACY.has(ext)) kind = 'legacy';
return [{ json: {
  kind, ext, contentType, filename,
  mediaId: String(b.mediaId || '').trim(), url: String(b.url || '').trim(), base64: b.base64 || '',
  maxChars: Math.min(Math.max(Number(b.maxChars) || 60000, 1000), 200000),
} }];`;

const BINARY_READY = `
const plan = $('Plan').first().json;
const item = $input.first();
if (item.binary && item.binary.data) return [{ json: plan, binary: { data: item.binary.data } }];
if (plan.base64) {
  const bin = await this.helpers.prepareBinaryData(Buffer.from(String(plan.base64).replace(/^data:[^,]*,/, ''), 'base64'), plan.filename || 'file', plan.contentType);
  return [{ json: plan, binary: { data: bin } }];
}
return [{ json: { ...plan, kind: 'nofile' } }];`;

const TEXT_READ = `
const plan = $input.first().json;
const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
let text = buf.toString('utf8').replace(/\\u0000/g, '');
const truncated = text.length > plan.maxChars;
if (truncated) text = text.slice(0, plan.maxChars);
return [{ json: { result: { ok: true, method: 'text', filename: plan.filename, pages: 1, chars: text.length, truncated, text, note: '' } } }];`;

const UNREADABLE = `
const plan = $input.first().json;
const notes = {
  legacy: 'صيغة قديمة (.' + plan.ext + ') لا يقرؤها المحرّك — حوّلها إلى docx أو xlsx أو pptx أو pdf وأعد الإرسال.',
  unknown: 'صيغة غير معروفة' + (plan.ext ? ' (.' + plan.ext + ')' : '') + ' — أرسلها كـ PDF أو صورة أو Word أو Excel أو PowerPoint.',
  nofile: 'لم يصل الملف: أرسل mediaId أو url أو base64.',
};
return [{ json: { result: { ok: false, method: 'none', filename: plan.filename, pages: 0, chars: 0, truncated: false, text: '', note: notes[plan.kind] || notes.unknown } } }];`;

const SUBMIT_CHECK = `
const r = $input.first().json;
const h = r.headers || {};
const op = h['operation-location'] || h['Operation-Location'] || '';
const body = r.body;
const err = typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body || {}).slice(0, 300);
return [{ json: { state: op ? 'again' : 'rejected', op, err: op ? '' : 'HTTP ' + r.statusCode + ' ' + err } }];`;

const EVALUATE = `
const r = $input.first().json;
const body = r.body || r;
const op = $('Submit Check').first().json.op;
const st = body.status;
let state = 'again';
if (st === 'succeeded') state = 'done';
else if (st === 'failed') state = 'failed';
else if ($runIndex >= 40) state = 'timeout';
return [{ json: { state, op, body } }];`;

const DI_RESULT = `
const plan = $('Binary Ready').first().json;
const j = $input.first().json;
const out = { ok: false, method: 'document-intelligence', filename: plan.filename, pages: 0, chars: 0, truncated: false, text: '', note: '' };
if (j.state === 'done') {
  const a = (j.body && j.body.analyzeResult) || {};
  let text = String(a.content || '');
  out.pages = (a.pages || []).length;
  out.truncated = text.length > plan.maxChars;
  if (out.truncated) text = text.slice(0, plan.maxChars);
  out.text = text; out.chars = text.length;
  out.ok = text.trim().length > 0;
  if (!out.ok) out.note = 'قرأه المحرّك لكن لا نصّ فيه (صورة بلا كتابة أو ملف فارغ) — يحتاج مراجعة يدوية.';
} else if (j.state === 'failed') {
  const e = j.body && j.body.error;
  out.note = 'فشلت القراءة: ' + ((e && (e.message || e.code)) || 'سبب غير معروف');
} else if (j.state === 'timeout') {
  out.note = 'انتهت المهلة قبل اكتمال القراءة (ملف كبير).';
} else {
  out.note = 'رفض المحرّك الملف: ' + (j.err || 'سبب غير معروف');
}
return [{ json: { result: out } }];`;

const ifNode = (id, name, pos, left, op, right, ver = "2.2") => ({
  id, name, type: "n8n-nodes-base.if", typeVersion: Number(ver), position: pos,
  parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id + "-c", leftValue: left, rightValue: right, operator: op }], combinator: "and" }, options: {} },
});
const code = (id, name, pos, js) => ({ id, name, type: "n8n-nodes-base.code", typeVersion: 2, position: pos, parameters: { jsCode: js.trim() } });
const OP_NOT_EMPTY = { type: "string", operation: "notEmpty", singleValue: true };
const OP_EQ = { type: "string", operation: "equals" };

const webhookPath = process.env.READER_PATH || "bp-read-file-" + crypto.randomBytes(12).toString("hex");

function build(path) {
  const nodes = [
    { id: "wh", name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 300], webhookId: crypto.randomUUID(),
      parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: {} } },
    code("plan", "Plan", [220, 300], PLAN),
    ifNode("ismedia", "Media?", [440, 300], "={{ $json.mediaId }}", OP_NOT_EMPTY, ""),
    { id: "wameta", name: "WA Media Info", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [660, 140], credentials: CRED_WA,
      parameters: { method: "GET", url: "=https://graph.facebook.com/v21.0/{{ $json.mediaId }}", authentication: "predefinedCredentialType", nodeCredentialType: "whatsAppApi", options: {} } },
    { id: "wadl", name: "WA Download", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [880, 140], credentials: CRED_WA,
      parameters: { method: "GET", url: "={{ $json.url }}", authentication: "predefinedCredentialType", nodeCredentialType: "whatsAppApi", options: { response: { response: { responseFormat: "file", outputPropertyName: "data" } } } } },
    ifNode("isurl", "URL?", [660, 400], "={{ $('Plan').first().json.url }}", OP_NOT_EMPTY, ""),
    { id: "urldl", name: "URL Download", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [880, 360],
      parameters: { method: "GET", url: "={{ $('Plan').first().json.url }}", options: { timeout: 60000, response: { response: { responseFormat: "file", outputPropertyName: "data" } } } } },
    code("ready", "Binary Ready", [1100, 300], BINARY_READY),
    ifNode("isdi", "DI?", [1320, 300], "={{ $json.kind }}", OP_EQ, "di"),
    ifNode("istext", "Text?", [1320, 520], "={{ $json.kind }}", OP_EQ, "text"),
    code("textread", "Text Read", [1540, 440], TEXT_READ),
    code("unread", "Unreadable", [1540, 620], UNREADABLE),
    { id: "submit", name: "DI Submit", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1540, 160], credentials: CRED_DI,
      parameters: { method: "POST", url: DI_URL, authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth",
        sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "={{ $json.contentType }}" }] },
        sendBody: true, contentType: "binaryData", inputDataFieldName: "data",
        options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 } } },
    code("subchk", "Submit Check", [1760, 160], SUBMIT_CHECK),
    ifNode("again1", "Submitted?", [1980, 160], "={{ $json.state }}", OP_EQ, "again"),
    { id: "wait", name: "Wait", type: "n8n-nodes-base.wait", typeVersion: 1.1, position: [2200, 80],
      parameters: { amount: 3, unit: "seconds" }, webhookId: crypto.randomUUID() },
    { id: "poll", name: "DI Poll", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [2420, 80], credentials: CRED_DI,
      parameters: { method: "GET", url: "={{ $('Submit Check').first().json.op }}", authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth",
        options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 30000 } } },
    code("eval", "Evaluate", [2640, 80], EVALUATE),
    ifNode("again2", "Still running?", [2860, 80], "={{ $json.state }}", OP_EQ, "again"),
    code("dires", "DI Result", [3080, 260], DI_RESULT),
    { id: "resp", name: "Respond", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [3300, 300],
      parameters: { respondWith: "json", responseBody: "={{ $json.result }}", options: {} } },
  ];
  const link = (a, ...outs) => [a, outs];
  const c = {};
  const set = (from, outputs) => { c[from] = { main: outputs.map((o) => (Array.isArray(o) ? o : [o]).map((n) => ({ node: n, type: "main", index: 0 }))) }; };
  set("Webhook", [["Plan"]]);
  set("Plan", [["Media?"]]);
  set("Media?", [["WA Media Info"], ["URL?"]]);
  set("WA Media Info", [["WA Download"]]);
  set("WA Download", [["Binary Ready"]]);
  set("URL?", [["URL Download"], ["Binary Ready"]]);
  set("URL Download", [["Binary Ready"]]);
  set("Binary Ready", [["DI?"]]);
  set("DI?", [["DI Submit"], ["Text?"]]);
  set("Text?", [["Text Read"], ["Unreadable"]]);
  set("Text Read", [["Respond"]]);
  set("Unreadable", [["Respond"]]);
  set("DI Submit", [["Submit Check"]]);
  set("Submit Check", [["Submitted?"]]);
  set("Submitted?", [["Wait"], ["DI Result"]]);
  set("Wait", [["DI Poll"]]);
  set("DI Poll", [["Evaluate"]]);
  set("Evaluate", [["Still running?"]]);
  set("Still running?", [["Wait"], ["DI Result"]]);
  set("DI Result", [["Respond"]]);
  return { name: NAME, nodes, connections: c, settings: { executionOrder: "v1", saveDataSuccessExecution: "none", saveDataErrorExecution: "all" } };
}

const list = (await (await fetch(`${AZ}/api/v1/workflows?limit=250`, { headers: H })).json()).data;
const existing = list.find((w) => w.name === NAME);
let path = webhookPath;
if (existing) {
  const cur = await (await fetch(`${AZ}/api/v1/workflows/${existing.id}`, { headers: H })).json();
  const wh = cur.nodes.find((n) => n.type === "n8n-nodes-base.webhook");
  if (wh && !process.env.READER_PATH) path = wh.parameters.path; // نُبقي العنوان نفسه عند التحديث
}
const wf = build(path);
let id;
if (existing) {
  const r = await fetch(`${AZ}/api/v1/workflows/${existing.id}`, { method: "PUT", headers: H, body: JSON.stringify(wf) });
  if (!r.ok) { console.error("فشل التحديث", r.status, (await r.text()).slice(0, 400)); process.exit(1); }
  id = existing.id;
} else {
  const r = await fetch(`${AZ}/api/v1/workflows`, { method: "POST", headers: H, body: JSON.stringify(wf) });
  if (!r.ok) { console.error("فشل الإنشاء", r.status, (await r.text()).slice(0, 400)); process.exit(1); }
  id = (await r.json()).id;
}
const act = await fetch(`${AZ}/api/v1/workflows/${id}/activate`, { method: "POST", headers: H });
console.log(existing ? "حُدِّث" : "أُنشئ", id, "· تفعيل:", act.status);
console.log(`${AZ}/webhook/${path}`);
fs.mkdirSync(".azure-n8n-backups", { recursive: true });
fs.writeFileSync(".azure-n8n-backups/universal-reader.json", JSON.stringify({ id, url: `${AZ}/webhook/${path}` }));
