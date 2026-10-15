// تنظيف مجلدات المرشحين اليتيمة في Drive (مجلد «BP CV Folder»).
//
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/drive-orphans.mjs dry     # تقرير فقط: كم مجلداً يتيماً (لا يُحذف شيء)
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/drive-orphans.mjs apply   # ينقلها إلى سلة Drive (قابلة للاسترجاع 30 يوماً)
//
// «يتيم» = مجلد أُنشئ داخل النافذة (FROM..TO) ولا يشير إليه أي سجل حيّ في قاعدة ATS
// (خاصية «مجلد المرشح (Drive)»). النافذة تغطي ما خلّفته دفعات الفشل واليتيم بعد أرشفة المكرّرات (2026-10-14).
// أمان: يتوقف إن عادت Notion بصفحة ثانية أو Drive بصفحة ثانية (قد يغيب مرجع فيُحذف مجلد حيّ)،
// ولا يلمس إلا مجلدات داخل النافذة ومباشرةً تحت «BP CV Folder». السلة لا الحذف النهائي.
import crypto from "node:crypto";

const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const mode = process.argv[2];
if (!["dry", "apply"].includes(mode)) { console.error("استعمل: dry | apply"); process.exit(1); }
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const api = async (m, p, b) => { const r = await fetch(`${AZ}/api/v1${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 300)}`); return JSON.parse(t); };

const PARENT = "1OqgBzZfjgehmmMaaf4St3kelsBGGALWJ"; // BP CV Folder
const ATS_DB = "71792742873e4de398135c7855542b95";
const FROM = "2026-10-14T01:15:00Z", TO = "2026-10-14T02:50:00Z";       // نافذة إنشاء المجلدات
const ROWS_FROM = "2026-10-14T01:10:00Z", ROWS_TO = "2026-10-14T03:00:00Z"; // نافذة سجلات ATS المرجعية
const DRIVE = { googleDriveOAuth2Api: { id: "bEWlfh76B9vZvZhg", name: "Google Drive OAuth2 API" } };
const NOTION = { notionApi: { id: "wNps81RIPkpeMTOF", name: "Notion — Business Partner OS — Production" } };
const path = "bp-drive-orphans-" + crypto.randomBytes(6).toString("hex");

const wf = {
  name: `TEMP — يتامى Drive (${mode})`,
  nodes: [
    { id: "wh", name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], webhookId: crypto.randomUUID(), parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: {} } },
    { id: "dl", name: "Drive List", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [220, 0], credentials: DRIVE, parameters: { method: "GET", url: "https://www.googleapis.com/drive/v3/files", authentication: "predefinedCredentialType", nodeCredentialType: "googleDriveOAuth2Api", sendQuery: true,
      queryParameters: { parameters: [
        { name: "q", value: `'${PARENT}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and createdTime >= '${FROM}' and createdTime < '${TO}'` },
        { name: "fields", value: "nextPageToken,files(id,name,createdTime)" }, { name: "pageSize", value: "1000" }, { name: "supportsAllDrives", value: "true" }] }, options: {} } },
    { id: "nq", name: "Notion Rows", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [440, 0], credentials: NOTION, parameters: { method: "POST", url: `https://api.notion.com/v1/databases/${ATS_DB}/query`, authentication: "predefinedCredentialType", nodeCredentialType: "notionApi", sendHeaders: true, headerParameters: { parameters: [{ name: "Notion-Version", value: "2022-06-28" }] }, sendBody: true, specifyBody: "json",
      jsonBody: JSON.stringify({ page_size: 100, filter: { and: [{ timestamp: "created_time", created_time: { on_or_after: ROWS_FROM } }, { timestamp: "created_time", created_time: { before: ROWS_TO } }] } }), options: {} } },
    { id: "calc", name: "Compute", type: "n8n-nodes-base.code", typeVersion: 2, position: [660, 0], parameters: { jsCode:
      `const drive = $('Drive List').first().json; const nt = $('Notion Rows').first().json;
const out = { mode: ${JSON.stringify(mode)}, abort: null, folders: 0, referenced: 0, orphans: [] };
if (drive.error || !Array.isArray(drive.files)) out.abort = 'Drive: ' + JSON.stringify(drive.error || drive).slice(0, 200);
else if (drive.nextPageToken) out.abort = 'Drive أعاد أكثر من صفحة';
else if (nt.object === 'error' || !Array.isArray(nt.results)) out.abort = 'Notion: ' + JSON.stringify(nt).slice(0, 200);
else if (nt.has_more) out.abort = 'Notion أعاد أكثر من صفحة (قد يغيب مرجع)';
if (out.abort) return [{ json: { result: out } }];
const ref = new Set();
for (const r of nt.results) { const u = (r.properties && r.properties['مجلد المرشح (Drive)'] && r.properties['مجلد المرشح (Drive)'].url) || ''; const m = u.match(/folders\\/([A-Za-z0-9_-]+)/); if (m) ref.add(m[1]); }
out.folders = drive.files.length; out.referenced = ref.size;
out.orphans = drive.files.filter(f => !ref.has(f.id)).map(f => ({ id: f.id, createdTime: f.createdTime }));
// حارس: إن كان اليتامى أكثر من نصف المجلدات فالمرجعية مشكوك فيها
if (out.orphans.length > Math.max(5, Math.floor(drive.files.length * 0.7))) { out.abort = 'نسبة اليتامى مريبة (' + out.orphans.length + ' من ' + drive.files.length + ')'; out.orphans = []; }
return [{ json: { result: out, ids: out.orphans.map(o => o.id) } }];` } },
    { id: "ap", name: "Apply?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [880, 0], parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: "a", leftValue: `={{ ${JSON.stringify(mode)} === 'apply' && !$json.result.abort && $json.ids.length > 0 }}`, rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} } },
    { id: "sp", name: "Split", type: "n8n-nodes-base.code", typeVersion: 2, position: [1100, -80], parameters: { jsCode: "return $input.first().json.ids.map(id => ({ json: { id } }));" } },
    { id: "tr", name: "Trash", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1320, -80], credentials: DRIVE, onError: "continueRegularOutput", parameters: { method: "PATCH", url: "=https://www.googleapis.com/drive/v3/files/{{ $json.id }}?supportsAllDrives=true", authentication: "predefinedCredentialType", nodeCredentialType: "googleDriveOAuth2Api", sendBody: true, specifyBody: "json", jsonBody: JSON.stringify({ trashed: true }), options: {} } },
    { id: "sum", name: "Summary", type: "n8n-nodes-base.code", typeVersion: 2, position: [1540, -80], parameters: { jsCode: "const items = $input.all(); const base = $('Compute').first().json.result; const ok = items.filter(i => i.json.id && !i.json.error).length; return [{ json: { result: { ...base, trashed: ok, failed: items.length - ok } } }];" } },
    { id: "rs", name: "Respond", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1760, 0], parameters: { respondWith: "json", responseBody: "={{ $json.result }}", options: {} } },
  ],
  connections: {
    Webhook: { main: [[{ node: "Drive List", type: "main", index: 0 }]] },
    "Drive List": { main: [[{ node: "Notion Rows", type: "main", index: 0 }]] },
    "Notion Rows": { main: [[{ node: "Compute", type: "main", index: 0 }]] },
    Compute: { main: [[{ node: "Apply?", type: "main", index: 0 }]] },
    "Apply?": { main: [[{ node: "Split", type: "main", index: 0 }], [{ node: "Respond", type: "main", index: 0 }]] },
    Split: { main: [[{ node: "Trash", type: "main", index: 0 }]] },
    Trash: { main: [[{ node: "Summary", type: "main", index: 0 }]] },
    Summary: { main: [[{ node: "Respond", type: "main", index: 0 }]] },
  },
  settings: { executionOrder: "v1" },
};

const { id } = await api("POST", "/workflows", wf);
try {
  await api("POST", `/workflows/${id}/activate`);
  await new Promise((r) => setTimeout(r, 3000));
  const r = await fetch(`${AZ}/webhook/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const out = await r.json();
  const { orphans, ...rest } = out;
  console.log(JSON.stringify({ ...rest, orphanCount: (orphans || []).length }, null, 1));
} finally {
  await fetch(`${AZ}/api/v1/workflows/${id}/deactivate`, { method: "POST", headers: H }).catch(() => {});
  await fetch(`${AZ}/api/v1/workflows/${id}`, { method: "DELETE", headers: H }).catch(() => {});
}
