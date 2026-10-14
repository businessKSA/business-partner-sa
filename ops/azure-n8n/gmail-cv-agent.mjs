// وكيل Gmail للسير الذاتية → ATS (يُنشئ سيراً واحداً لكل حساب Gmail).
//
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/gmail-cv-agent.mjs company    # حساب الشركة
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/gmail-cv-agent.mjs personal   # الحساب الشخصي
//
// المنطق (نفس خط أنابيب Hotmail المُجرَّب `Ws1zQQ6YezxAOMSN`، يُستنسخ منه حيّاً):
//   قائمة رسائل Gmail بمرفقات وكلمات سيرة ذاتية ولا تحمل الليبل BP-CV ← تنزيل الرسالة ← القارئ الشامل
//   ← تحليل (Azure) ← Drive + سجل ATS في Notion ← ليبل «BP-CV/<المجال>» + «BP-CV».
// ما يُفحَص يأخذ BP-CV دائماً (مرشحاً كان أم لا) فيتقلّص الاستعلام وحده ولا حاجة لمؤشر تاريخ.
// فشل الكتابة في Notion لا يضيع: يأخذ «BP-CV/فشل — راجع» ويُترك في Gmail لقرارك.
// الليبلات تُنشأ مرة واحدة وتُكتب معرّفاتها في الكود (المعرّفات ثابتة لكل صندوق).
// يبدأ بحدّ تجربة LIMIT=10 ثم يُرفع بالتعديل في عقدة «حالة الدفعة».
import fs from "node:fs";
import crypto from "node:crypto";

const AZ = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const api = async (m, p, b) => { const r = await fetch(`${AZ}/api/v1${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; } if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 300)}`); return j; };

const ACCOUNTS = {
  company: { cred: { id: "fKJNtBfZTsc3UkW9", name: "Gmail — Business Partner — Production" }, title: "الشركة", tag: "Gmail الشركة", extraQ: "" },
  personal: { cred: { id: "Mam8ItBxusixERk1", name: "Gmail — Personal — Baher" }, title: "الشخصي", tag: "Gmail شخصي", extraQ: "" },
};
const which = process.argv[2];
const A = ACCOUNTS[which];
if (!A) { console.error("استعمل: company | personal"); process.exit(1); }

const FIELDS = ["هندسة", "تقنية معلومات", "مبيعات وتسويق", "محاسبة ومالية", "إداري وسكرتارية", "موارد بشرية", "ضيافة ومطاعم", "مقاولات وإنشاءات", "صحة وطب", "تعليم", "لوجستيات ونقل"];
const LABEL_NAMES = ["BP-CV", ...FIELDS.map((f) => `BP-CV/${f}`), "BP-CV/غير مرشح", "BP-CV/فشل — راجع", "BP-CV/غير مقروء"];
const CRED = { gmailOAuth2: A.cred };
const gmailHttp = (id, name, pos, method, url, extra = {}) => ({ id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: pos, credentials: CRED, onError: "continueRegularOutput",
  parameters: { method, url, authentication: "predefinedCredentialType", nodeCredentialType: "gmailOAuth2", options: {}, ...extra } });

// ───────── ١) ضمان الليبلات وإرجاع خريطة الأسماء ← المعرّفات ─────────
async function ensureLabels() {
  const path = "bp-gmail-labels-" + crypto.randomBytes(6).toString("hex");
  const wf = {
    name: `TEMP — إنشاء ليبلات ${A.title}`,
    nodes: [
      { id: "wh", name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], webhookId: crypto.randomUUID(), parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: {} } },
      gmailHttp("l1", "List1", [220, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/labels"),
      { id: "plan", name: "Plan", type: "n8n-nodes-base.code", typeVersion: 2, position: [440, 0], parameters: { jsCode:
        `const have = new Set((($input.first().json.labels)||[]).map(l => l.name));\nconst need = ${JSON.stringify(LABEL_NAMES)}.filter(n => !have.has(n));\nreturn need.length ? need.map(n => ({ json: { name: n } })) : [{ json: { skip: true } }];` } },
      { id: "if", name: "Missing?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [660, 0], parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: "c", leftValue: "={{ $json.skip === true }}", rightValue: "", operator: { type: "boolean", operation: "false", singleValue: true } }], combinator: "and" }, options: {} } },
      gmailHttp("cr", "Create", [880, -80], "POST", "https://gmail.googleapis.com/gmail/v1/users/me/labels", { sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify({ name: $json.name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }) }}" }),
      { ...gmailHttp("l2", "List2", [1100, 0], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/labels"), executeOnce: true },
      { id: "map", name: "Map", type: "n8n-nodes-base.code", typeVersion: 2, position: [1320, 0], parameters: { jsCode:
        `const labels = ($('List2').first().json.labels) || [];\nconst want = ${JSON.stringify(LABEL_NAMES)};\nconst map = {}; for (const l of labels) if (want.includes(l.name)) map[l.name] = l.id;\nlet created = []; try { created = $('Create').all().map(i => i.json.error ? String(i.json.error.message || i.json.error).slice(0,120) : null).filter(Boolean); } catch (e) {}\nreturn [{ json: { result: { map, missing: want.filter(n => !map[n]), createErrors: created } } }];` } },
      { id: "rs", name: "Respond", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1540, 0], parameters: { respondWith: "json", responseBody: "={{ $json.result }}", options: {} } },
    ],
    connections: {
      Webhook: { main: [[{ node: "List1", type: "main", index: 0 }]] },
      List1: { main: [[{ node: "Plan", type: "main", index: 0 }]] },
      Plan: { main: [[{ node: "Missing?", type: "main", index: 0 }]] },
      "Missing?": { main: [[{ node: "Create", type: "main", index: 0 }], [{ node: "List2", type: "main", index: 0 }]] },
      Create: { main: [[{ node: "List2", type: "main", index: 0 }]] },
      List2: { main: [[{ node: "Map", type: "main", index: 0 }]] },
      Map: { main: [[{ node: "Respond", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
  const { id } = await api("POST", "/workflows", wf);
  try {
    await api("POST", `/workflows/${id}/activate`);
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${AZ}/webhook/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const out = await r.json();
    return out;
  } finally {
    await fetch(`${AZ}/api/v1/workflows/${id}/deactivate`, { method: "POST", headers: H }).catch(() => {});
    await fetch(`${AZ}/api/v1/workflows/${id}`, { method: "DELETE", headers: H }).catch(() => {});
  }
}

// ───────── ٢) بناء السير من سير Hotmail الحيّ ─────────
const SRC_ID = "Ws1zQQ6YezxAOMSN";
const KEEP = ["🧹 توحيد + انتقاء CV", "❓ فيه مرفق سيرة؟", "🔄 تجهيز للقارئ", "📖 القارئ الشامل", "📄 استخراج نص PDF", "Azure OpenAI (bp-main)", "🧠 التحليل (Azure)", "🏗️ بناء السجل + السيرة", "❓ مرشح فعلي؟", "📁 مجلد المرشح", "🔗 إعادة إرفاق الملف الأصلي", "⬆️ رفع السيرة الأصلية", "📝 إنشاء سيرة ATS", "🗂️ سجل المرشح في ATS", "❓ كُتب في ATS؟", "🔁 واحدة تلو الأخرى", "✅ انتهت الدفعة"];

const labels = await ensureLabels();
if (labels.missing?.length) { console.error("ليبلات ناقصة:", labels.missing, labels.createErrors); process.exit(1); }
console.log(`الليبلات جاهزة (${Object.keys(labels.map).length}) لحساب ${A.title}`);
const L = labels.map;

const src = await api("GET", `/workflows/${SRC_ID}`);
const N = Object.fromEntries(src.nodes.map((n) => [n.name, n]));
const nodes = KEEP.map((k) => { if (!N[k]) throw new Error("عقدة مفقودة في السير المصدر: " + k); return JSON.parse(JSON.stringify(N[k])); });
const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));

// المصدر في «ملاحظات» السجل
byName["🏗️ بناء السجل + السيرة"].parameters.jsCode = byName["🏗️ بناء السجل + السيرة"].parameters.jsCode.replace("'استيراد من Outlook | '", `'استيراد من ${A.tag} | '`);
if (!byName["🏗️ بناء السجل + السيرة"].parameters.jsCode.includes(A.tag)) throw new Error("لم يُبدَّل نص المصدر");
// أرخص نشرة تكفي للوكلاء (قرار المالك)
const lm = byName["Azure OpenAI (bp-main)"]; lm.parameters = JSON.parse(JSON.stringify(lm.parameters).split('"bp-main"').join('"bp-fast"')); lm.name = "Azure OpenAI (bp-fast)";
const dest = { "Azure OpenAI (bp-main)": "Azure OpenAI (bp-fast)" };

const QUERY = `has:attachment -label:BP-CV (cv OR resume OR "سيرة ذاتية" OR سيرة OR curriculum OR application OR وظيفة OR توظيف OR "طلب توظيف") ${A.extraQ}`.trim();
const LABELS_JS = JSON.stringify(L);

const extra = [
  { id: "tick", name: "⏱️ كل 15 دقيقة", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 300], parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 15 }] } } },
  { id: "state", name: "⚙️ حالة الدفعة", type: "n8n-nodes-base.code", typeVersion: 2, position: [220, 300], parameters: { jsCode:
    `// وكيل Gmail ${A.title}: LIMIT = أقصى ما يُفحص في كل التشغيل (يُرفع هنا بعد نجاح التجربة).\nconst LIMIT = 10, BATCH = 10;\nconst s = $getWorkflowStaticData("global");\nif (!s.init) { s.init = true; s.total = 0; s.emptyRuns = 0; s.done = false; s.notified = false; }\nif (s.done || (s.total || 0) >= LIMIT) return [];\nreturn [{ json: { take: Math.min(BATCH, LIMIT - (s.total || 0)) } }];` } },
  gmailHttp("list", "📥 قائمة رسائل السير (Gmail)", [440, 300], "GET", "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    { sendQuery: true, queryParameters: { parameters: [{ name: "q", value: QUERY }, { name: "maxResults", value: "={{ $json.take }}" }] } }),
  { id: "adv", name: "📌 تقدّم العدّاد", type: "n8n-nodes-base.code", typeVersion: 2, position: [660, 300], parameters: { jsCode:
    `const s = $getWorkflowStaticData("global");\nconst rows = ($input.first().json.messages) || [];\nif (!rows.length) {\n  s.emptyRuns = (s.emptyRuns || 0) + 1;\n  if (s.emptyRuns >= 3) { s.done = true; if (!s.notified) { s.notified = true; return [{ json: { finished: true, total: s.total || 0 } }]; } }\n  return [];\n}\ns.emptyRuns = 0;\ns.total = (s.total || 0) + rows.length;\nreturn rows.map(r => ({ json: { id: r.id } }));` } },
  { id: "fin", name: "❓ انتهت المهمة؟", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [880, 300], parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose" }, conditions: [{ id: "fin", leftValue: "={{ $json.finished === true }}", rightValue: "true", operator: { type: "string", operation: "equals" } }], combinator: "and" }, options: {} } },
  { id: "notify", name: "📣 إبلاغ المالك (اكتمل)", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1100, 220], onError: "continueRegularOutput", parameters: { method: "POST", url: `${AZ}/webhook/website-lead-notify`, sendBody: true, specifyBody: "json", jsonBody: `={{ JSON.stringify({ source: "cv-gmail", ref: "CV-GMAIL", name: "سحب سير ${A.tag}", transcript: "اكتمل سحب سير ${A.tag}. عدد الرسائل المفحوصة: " + $json.total }) }}`, options: {} } },
  { id: "get", name: "📩 جلب الرسالة + المرفق", type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [1100, 380], credentials: CRED, parameters: { resource: "message", operation: "get", messageId: "={{ $json.id }}", simple: false, options: { downloadAttachments: true, dataPropertyAttachmentsPrefixName: "attachment_" } } },
  // ليبلات بعد الكتابة
  { id: "lbl-ok", name: "🏷️ ليبل المجال", type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [2700, 300], credentials: CRED, onError: "continueRegularOutput", parameters: { resource: "message", operation: "addLabels", messageId: "={{ $('📩 جلب الرسالة + المرفق').item.json.id }}", labelIds: `={{ (() => { const L = ${LABELS_JS}; const b = $('🏗️ بناء السجل + السيرة').item.json; const ids = [L['BP-CV']]; const f = b.hidden ? 'BP-CV/غير مقروء' : ('BP-CV/' + b.field); if (L[f]) ids.push(L[f]); return ids; })() }}` } },
  { id: "lbl-no", name: "🏷️ ليبل غير مرشح", type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [1760, 560], credentials: CRED, onError: "continueRegularOutput", parameters: { resource: "message", operation: "addLabels", messageId: "={{ $('📩 جلب الرسالة + المرفق').item.json.id }}", labelIds: `={{ [${JSON.stringify(L["BP-CV"])}, ${JSON.stringify(L["BP-CV/غير مرشح"])}] }}` } },
  { id: "lbl-nocv", name: "🏷️ ليبل بدون سيرة", type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [1760, 700], credentials: CRED, onError: "continueRegularOutput", parameters: { resource: "message", operation: "addLabels", messageId: "={{ $('📩 جلب الرسالة + المرفق').item.json.id }}", labelIds: `={{ [${JSON.stringify(L["BP-CV"])}, ${JSON.stringify(L["BP-CV/غير مرشح"])}] }}` } },
  { id: "lbl-fail", name: "🏷️ ليبل فشل — راجع", type: "n8n-nodes-base.gmail", typeVersion: 2.2, position: [2700, 520], credentials: CRED, onError: "continueRegularOutput", parameters: { resource: "message", operation: "addLabels", messageId: "={{ $('📩 جلب الرسالة + المرفق').item.json.id }}", labelIds: `={{ [${JSON.stringify(L["BP-CV"])}, ${JSON.stringify(L["BP-CV/فشل — راجع"])}] }}` } },
];
const all = [...nodes, ...extra];

const C = {};
const set = (from, outs) => { C[from] = { main: outs.map((o) => (Array.isArray(o) ? o : [o]).map((n) => ({ node: n, type: "main", index: 0 }))) }; };
set("⏱️ كل 15 دقيقة", ["⚙️ حالة الدفعة"]);
set("⚙️ حالة الدفعة", ["📥 قائمة رسائل السير (Gmail)"]);
set("📥 قائمة رسائل السير (Gmail)", ["📌 تقدّم العدّاد"]);
set("📌 تقدّم العدّاد", ["❓ انتهت المهمة؟"]);
set("❓ انتهت المهمة؟", [["📣 إبلاغ المالك (اكتمل)"], ["🔁 واحدة تلو الأخرى"]]);
set("🔁 واحدة تلو الأخرى", [["✅ انتهت الدفعة"], ["📩 جلب الرسالة + المرفق"]]);
set("📩 جلب الرسالة + المرفق", ["🧹 توحيد + انتقاء CV"]);
set("🧹 توحيد + انتقاء CV", ["❓ فيه مرفق سيرة؟"]);
set("❓ فيه مرفق سيرة؟", [["🔄 تجهيز للقارئ"], ["🏷️ ليبل بدون سيرة"]]);
set("🏷️ ليبل بدون سيرة", ["🔁 واحدة تلو الأخرى"]);
set("🔄 تجهيز للقارئ", ["📖 القارئ الشامل"]);
set("📖 القارئ الشامل", ["📄 استخراج نص PDF"]);
set("📄 استخراج نص PDF", ["🧠 التحليل (Azure)"]);
set("🧠 التحليل (Azure)", ["🏗️ بناء السجل + السيرة"]);
set("🏗️ بناء السجل + السيرة", ["❓ مرشح فعلي؟"]);
set("❓ مرشح فعلي؟", [["📁 مجلد المرشح"], ["🏷️ ليبل غير مرشح"]]);
set("🏷️ ليبل غير مرشح", ["🔁 واحدة تلو الأخرى"]);
set("📁 مجلد المرشح", ["🔗 إعادة إرفاق الملف الأصلي"]);
set("🔗 إعادة إرفاق الملف الأصلي", ["⬆️ رفع السيرة الأصلية"]);
set("⬆️ رفع السيرة الأصلية", ["📝 إنشاء سيرة ATS"]);
set("📝 إنشاء سيرة ATS", ["🗂️ سجل المرشح في ATS"]);
set("🗂️ سجل المرشح في ATS", ["❓ كُتب في ATS؟"]);
set("❓ كُتب في ATS؟", [["🏷️ ليبل المجال"], ["🏷️ ليبل فشل — راجع"]]);
set("🏷️ ليبل المجال", ["🔁 واحدة تلو الأخرى"]);
set("🏷️ ليبل فشل — راجع", ["🔁 واحدة تلو الأخرى"]);
C["Azure OpenAI (bp-fast)"] = { ai_languageModel: [[{ node: "🧠 التحليل (Azure)", type: "ai_languageModel", index: 0 }]] };
// الاحتياطي (Gemini) إن وُجد في المصدر
for (const [k, v] of Object.entries(src.connections)) if (v.ai_languageModel && !C[k] && nodes.some((n) => n.name === k)) C[k] = v;

const NAME = `BP — وكيل Gmail ${A.title}: السير الذاتية → ATS`;
const body = { name: NAME, nodes: all, connections: C, settings: { executionOrder: "v1", saveDataSuccessExecution: "all", saveDataErrorExecution: "all", executionTimeout: 2400 } };
const list = (await api("GET", "/workflows?limit=250")).data;
const ex = list.find((w) => w.name === NAME);
let id;
if (ex) { await api("PUT", `/workflows/${ex.id}`, body); id = ex.id; } else { id = (await api("POST", "/workflows", body)).id; }
fs.mkdirSync(".azure-n8n-backups", { recursive: true });
fs.writeFileSync(`.azure-n8n-backups/gmail-cv-${which}.json`, JSON.stringify({ id, name: NAME, labels: L }));
console.log(ex ? "حُدِّث" : "أُنشئ", id, "(غير مفعّل — فعِّله بعد المراجعة)");
