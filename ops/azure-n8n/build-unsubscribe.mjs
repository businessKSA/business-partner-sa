// يبني على Azure سيرَي إلغاء الاشتراك لحملات البريد — طلب المالك 2026-10-14:
//   «لازم يكون في أنسبسكرايب ويقدر يوقفها والإيجنت ما يرسل تاني».
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/build-unsubscribe.mjs          # تجربة بلا كتابة
//   N8N_AZURE_API_KEY=… node ops/azure-n8n/build-unsubscribe.mjs --apply  # ينشئ السيرين (غير نشطين، والتفعيل بيد المنفِّذ)
//
// ١) «BP — Unsubscribe (رابط)»: GET /webhook/bp-unsubscribe?p=<معرّف صفحة العميل في Notion>
//    يتحقق أن الصفحة من «BP — Companies Sales DB» فقط، ثم يؤشّر Suppressed ✓ و Suppress Reason=Unsubscribed
//    ويعرض صفحة تأكيد ثنائية اللغة. `?preview=1` يعرض الصفحة بلا أي تغيير (لبريد التجربة).
// ٢) «BP — Unsubscribe (ردّ إيقاف/STOP)»: Gmail كل ١٥ دقيقة؛ ردّ يحوي «إيقاف/STOP/unsubscribe» من بريد موجود في القاعدة → نفس التأشير.
// الإرسال يستثني Suppressed تلقائياً (Get Ready-to-Send والحارس)، فلا تُرسل لهم رسالة ثانية.
import fs from "node:fs";

const B = process.env.N8N_AZURE_BASE || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const key = process.env.N8N_AZURE_API_KEY;
if (!key) { console.error("ينقص N8N_AZURE_API_KEY"); process.exit(1); }
const apply = process.argv.includes("--apply");
const H = { "X-N8N-API-KEY": key, "content-type": "application/json" };
const DB = "26faca27-6188-4b6a-b584-924c374f2d22", DS = "5e739c65-a1f9-4325-b493-b656c0565ac0";
const GMAIL = { gmailOAuth2: { id: "fKJNtBfZTsc3UkW9", name: "Gmail — Business Partner — Production" } };
const NAME1 = "BP — Unsubscribe (رابط إلغاء الاشتراك)", NAME2 = "BP — Unsubscribe (ردّ إيقاف/STOP)";

const sender = await (await fetch(`${B}/api/v1/workflows/gw9GOcav5vnlU29P`, { headers: H })).json();
const NOTION = { notionApi: sender.nodes.find((n) => n.credentials?.notionApi).credentials.notionApi };
let all = [], cur = "";
do { const r = await (await fetch(`${B}/api/v1/workflows?limit=100${cur ? "&cursor=" + cur : ""}`, { headers: H })).json(); all.push(...r.data); cur = r.nextCursor; } while (cur);
const exists = (n) => all.find((w) => w.name === n);

const uid = () => crypto.randomUUID();
const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: uid(), name, type, typeVersion, position, parameters, ...extra });
const code = (name, pos, jsCode, mode = "runOnceForEachItem") => node(name, "n8n-nodes-base.code", 2, pos, { mode, language: "javaScript", jsCode });
const ifNode = (name, pos, left, op) => node(name, "n8n-nodes-base.if", 2.2, pos, {
  conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: uid(), leftValue: left, rightValue: "", operator: op }], combinator: "and" }, options: {},
});
const IS_TRUE = { type: "boolean", operation: "true", singleValue: true }, NOT_EMPTY = { type: "string", operation: "notEmpty", singleValue: true };
const notionUpdate = (name, pos, pageExpr, props, extra) => node(name, "n8n-nodes-base.notion", 2.2, pos, {
  authentication: "apiKey", resource: "databasePage", operation: "update", pageId: { __rl: true, mode: "id", value: pageExpr }, propertiesUi: { propertyValues: props }, options: {},
}, { credentials: NOTION, ...extra });
const SUPPRESS = [{ key: "Suppressed|checkbox", type: "checkbox", checkboxValue: true }, { key: "Suppress Reason|select", type: "select", selectValue: "Unsubscribed" }];
const link = (c, a, b, i = 0) => { c[a] = c[a] || { main: [] }; c[a].main[i] = [...(c[a].main[i] || []), { node: b, type: "main", index: 0 }]; };

// صفحة الرد (ثنائية اللغة بالشعار) — دالة مستقلة تُحقن في عقدة Code.
function pageHtml(mode) {
  const M = {
    done: ["تم إيقاف الرسائل", "لن نراسلكم بعد الآن. نعتذر عن الإزعاج.", "You have been unsubscribed", "We will not email you again. We apologise for any inconvenience."],
    preview: ["معاينة فقط", "هذا بريد تجريبي: لم يتغيّر أي شيء.", "Preview only", "This is a test email: nothing was changed."],
    invalid: ["الرابط غير صالح", "تعذّر التحقق من الرابط. للمساعدة راسلونا على business@businesspartner.sa", "Invalid link", "We could not verify this link. For help email business@businesspartner.sa"],
    error: ["تعذّر تنفيذ الطلب", "حدث خطأ مؤقت. حاولوا مجدداً أو راسلونا على business@businesspartner.sa وسنوقف الرسائل يدوياً.", "We could not complete your request", "A temporary error occurred. Please try again or email business@businesspartner.sa and we will stop the emails manually."],
  }[mode] || [];
  const [ta, da, te, de] = M;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Business Partner</title></head>
<body style="margin:0;background:#f3f5fa;font-family:Tahoma,Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 12px;"><div style="background:#fff;border:1px solid #e5e9f0;border-radius:12px;overflow:hidden;">
<div style="height:5px;background:#0B1B5A;"></div>
<div style="text-align:center;padding:26px 24px 8px;"><img src="https://www.businesspartner.sa/assets/img/logo.png" width="220" alt="Business Partner" style="max-width:100%;height:auto;"></div>
<div style="padding:12px 32px 8px;text-align:right;direction:rtl;"><h1 style="font-size:22px;color:#0B1B5A;margin:8px 0;">${ta}</h1><p style="font-size:16px;line-height:1.9;color:#1f2937;margin:0 0 8px;">${da}</p></div>
<div style="padding:8px 32px 30px;text-align:left;direction:ltr;border-top:1px solid #eef0f6;margin-top:12px;font-family:'Segoe UI',Arial,sans-serif;"><h2 style="font-size:19px;color:#0B1B5A;margin:14px 0 6px;">${te}</h2><p style="font-size:15px;line-height:1.8;color:#1f2937;margin:0;">${de}</p></div>
</div></div></body></html>`;
}

function buildLink() {
  const nodes = [
    node("Webhook — إلغاء الاشتراك", "n8n-nodes-base.webhook", 2, [0, 200], { httpMethod: "GET", path: "bp-unsubscribe", responseMode: "responseNode", options: {} }, { webhookId: uid() }),
    code("تحقق من الطلب", [240, 200], [
      "const q = $json.query || {};",
      "const p = String(q.p || '').trim();",
      "const valid = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/.test(p);",
      "const mode = q.preview ? 'preview' : (valid ? 'act' : 'invalid');",
      "return { json: { p, mode } };",
    ].join("\n")),
    ifNode("تنفيذ؟", [480, 200], "={{ $json.mode === 'act' }}", IS_TRUE),
    node("جلب صفحة العميل", "n8n-nodes-base.notion", 2.2, [720, 120], { authentication: "apiKey", resource: "databasePage", operation: "get", pageId: { __rl: true, mode: "id", value: "={{ $json.p }}" }, simple: false }, { credentials: NOTION, onError: "continueRegularOutput" }),
    code("التحقق من القاعدة", [960, 120], [
      `const DB = '${DB.replace(/-/g, "")}', DS = '${DS.replace(/-/g, "")}';`,
      "const s = JSON.stringify($json.parent || {}).replace(/-/g, '');",
      "const ok = !$json.error && !!$json.id && (s.includes(DB) || s.includes(DS));",
      "return { json: { ok, pageId: $json.id, mode: ok ? 'act' : 'invalid' } };",
    ].join("\n")),
    ifNode("من قاعدة الشركات؟", [1200, 120], "={{ $json.ok }}", IS_TRUE),
    notionUpdate("إيقاف المراسلة", [1440, 60], "={{ $json.pageId }}", SUPPRESS, { onError: "continueRegularOutput" }),
    code("نتيجة الإيقاف", [1680, 60], "return { json: { mode: $json.error ? 'error' : 'done' } };"),
    code("الصفحة", [1920, 200], `${pageHtml.toString()}\nreturn { json: { html: pageHtml($json.mode) } };`),
    node("ردّ", "n8n-nodes-base.respondToWebhook", 1.1, [2160, 200], { respondWith: "text", responseBody: "={{ $json.html }}", options: { responseCode: 200, responseHeaders: { entries: [{ name: "Content-Type", value: "text/html; charset=utf-8" }] } } }),
  ];
  const c = {};
  link(c, nodes[0].name, nodes[1].name); link(c, nodes[1].name, nodes[2].name);
  link(c, nodes[2].name, nodes[3].name, 0); link(c, nodes[2].name, "الصفحة", 1);
  link(c, nodes[3].name, nodes[4].name); link(c, nodes[4].name, nodes[5].name);
  link(c, nodes[5].name, nodes[6].name, 0); link(c, nodes[5].name, "الصفحة", 1);
  link(c, nodes[6].name, nodes[7].name); link(c, nodes[7].name, "الصفحة"); link(c, "الصفحة", "ردّ");
  return { nodes, connections: c };
}

function buildReply() {
  const nodes = [
    node("ردود Gmail الواردة", "n8n-nodes-base.gmailTrigger", 1.4, [0, 0], { pollTimes: { item: [{ mode: "everyX", value: 15, unit: "minutes" }] }, simple: true, filters: { q: 'in:inbox newer_than:2d (إيقاف OR ايقاف OR "إلغاء الاشتراك" OR stop OR unsubscribe)', readStatus: "unread" } }, { credentials: GMAIL }),
    code("هل هو طلب إيقاف؟", [240, 0], [
      "const m = $json;",
      "const from = String(m.From || m.from || '');",
      "const email = (from.match(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/) || [''])[0].toLowerCase();",
      "const text = String((m.snippet || m.text || m.Subject || '')).slice(0, 240);",
      "const stop = /(^|[\\s.,!،؛:\"'«(])(إيقاف|ايقاف|أوقفوا|وقف|إلغاء الاشتراك|الغاء الاشتراك|stop|unsubscribe|remove me)($|[\\s.,!،؛:\"'»)])/i.test(text);",
      "return { json: { email, stop: !!(stop && email) } };",
    ].join("\n")),
    ifNode("طلب إيقاف؟", [480, 0], "={{ $json.stop }}", IS_TRUE),
    node("إيجاد العميل بالبريد", "n8n-nodes-base.notion", 2.2, [720, -40], { authentication: "apiKey", resource: "databasePage", operation: "getAll", databaseId: { __rl: true, mode: "id", value: DB }, limit: 1, filterType: "manual", matchType: "allFilters", filters: { conditions: [{ key: "Email|email", condition: "equals", emailValue: "={{ $json.email }}" }] }, options: {} }, { credentials: NOTION }),
    ifNode("وُجد العميل؟", [960, -40], "={{ $json.id }}", NOT_EMPTY),
    notionUpdate("إيقاف المراسلة (ردّ)", [1200, -80], "={{ $json.id }}", SUPPRESS),
  ];
  const c = {};
  link(c, nodes[0].name, nodes[1].name); link(c, nodes[1].name, nodes[2].name); link(c, nodes[2].name, nodes[3].name, 0);
  link(c, nodes[3].name, nodes[4].name); link(c, nodes[4].name, nodes[5].name, 0);
  return { nodes, connections: c };
}

for (const [name, build, note] of [[NAME1, buildLink, "رابط"], [NAME2, buildReply, "ردّ إيقاف"]]) {
  if (exists(name)) { console.log(`موجود من قبل: ${name} (${exists(name).id}) — تخطّي`); continue; }
  const { nodes, connections } = build();
  console.log(`${apply ? "إنشاء" : "تجربة"}: ${name} — ${nodes.length} عقدة (${note})، غير نشط`);
  if (!apply) continue;
  const r = await fetch(`${B}/api/v1/workflows`, { method: "POST", headers: H, body: JSON.stringify({ name, nodes, connections, settings: { executionOrder: "v1", timezone: "Asia/Riyadh" } }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`POST ${name}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  console.log("  id:", j.id, "active:", j.active);
}
