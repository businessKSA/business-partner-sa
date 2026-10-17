// حارس الموقع 24/7 على n8n Azure (2026-10-17). سير جديد غير مفعّل:
//   مدخلان: (أ) جدول كل ١٠ دقائق: فحص HTTP لصفحات الموقع الحيّ + الإعدادات + الكتالوج (ops/site-guardian/checks.mjs)
//           (ب) ويبهوك بمفتاح: تقرير الرحلة الكاملة بالمتصفح من «وظيفة» Azure Container Apps (ops/site-guardian/run.mjs --mode full)
//   ← قرار التنبيه (عيب يظهر في فحصين متتاليين فقط، تبريد ٦ ساعات، إشعار تعافٍ) ← بوابة الإشعارات (origin=site) ← واتساب باهر ← تسجيل.
//   node ops/azure-n8n/build-site-guardian.mjs            جاف
//   node ops/azure-n8n/build-site-guardian.mjs --apply    ينشئ السير والاعتماد إن لم يوجدا (بالاسم الحرفي، لا يُكتب فوق شيء، لا يُفعَّل)
import crypto from "crypto";
import { PUBLIC_PAGES, contentFindings, configFindings, catalogFindings, summarize, alertDecision, ownerMessage, ownerOfFinding } from "../site-guardian/checks.mjs";

const BASE = process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const KEY = (process.env.N8N_AZURE_API_KEY || "").trim(); if (!KEY) { console.log("Set N8N_AZURE_API_KEY"); process.exit(1); }
const API = BASE + "/api/v1", H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const APPLY = process.argv.includes("--apply");
const SITE = process.env.GUARDIAN_SITE || "https://www.businesspartner.sa";
const uid = () => crypto.randomUUID(), hex = (n) => crypto.randomBytes(n).toString("hex");
const WA_PHONE_ID = "1112996661901731", OWNER_WA = "966530540231";
const CRED = { pg: { postgres: { id: "kfEnJK1iMVLmLm9G", name: "Farah Memory" } }, wa: { whatsAppApi: { id: "SSNPpraVFcKAyzpx", name: "WhatsApp account" } } };
const NAME = "🛡️ حارس الموقع — فحص HTTP كل ١٠ دقائق + تقرير الرحلة الكاملة";
const CRED_NAME = "Header Auth — حارس الموقع (تقرير الرحلة)";
const KEEP = ["executionOrder", "saveDataErrorExecution", "saveDataSuccessExecution", "timezone"];

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: uid(), name, type, typeVersion, position, parameters, ...extra });
const code = (name, position, jsCode) => node(name, "n8n-nodes-base.code", 2, position, { mode: "runOnceForAllItems", language: "javaScript", jsCode });
const link = (c, from, to, out = 0) => { c[from] = c[from] || { main: [] }; while (c[from].main.length <= out) c[from].main.push([]); c[from].main[out].push({ node: to, type: "main", index: 0 }); };
const fnSrc = (f) => f.toString();
const FUNCS = [contentFindings, configFindings, catalogFindings, summarize, alertDecision, ownerMessage, ownerOfFinding].map(fnSrc).join("\n");

function workflow(gateId, credId) {
  const urls = [...PUBLIC_PAGES.map((p) => ({ path: p === "/" ? "/ar" : "/ar" + p, kind: "page", orig: p })), { path: "/api/simple?action=config", kind: "config" }, { path: "/api/live-catalog", kind: "catalog" }];
  const nodes = [
    node("كل ١٠ دقائق", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 0], { rule: { interval: [{ field: "minutes", minutesInterval: 10 }] } }),
    code("الروابط", [240, 0], `return ${JSON.stringify(urls)}.map(u => ({ json: { ...u, url: ${JSON.stringify(SITE)} + u.path } }));`),
    node("اجلب", "n8n-nodes-base.httpRequest", 4.2, [480, 0], { method: "GET", url: "={{ $json.url }}", sendHeaders: true, headerParameters: { parameters: [{ name: "User-Agent", value: "BP-SiteGuardian/1.0" }] }, options: { timeout: 30000, redirect: { redirect: { followRedirects: false } }, response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } } } }, { onError: "continueRegularOutput" }),
    code("قيّم HTTP", [720, 0], `${FUNCS}
const urls = $('الروابط').all().map(i => i.json); const res = $input.all().map(i => i.json);
const sd = $getWorkflowStaticData('global'); const findings = [];
res.forEach((r, i) => {
  const u = urls[i] || {}; const status = Number(r.statusCode || r.status || 0); const body = typeof r.body === 'string' ? r.body : (r.data && String(r.data)) || '';
  if (r.error || !status) { findings.push({ severity: 'critical', code: 'page-unreachable', path: u.path, msg: 'لا يُفتح: ' + String((r.error && r.error.message) || '').slice(0, 80) }); return; }
  if (status >= 500) { findings.push({ severity: 'critical', code: 'http-5xx', path: u.path, msg: 'ترجع ' + status }); return; }
  if (status >= 400) { findings.push({ severity: u.orig === '/quote' ? 'minor' : 'major', code: 'http-4xx', path: u.path, msg: 'ترجع ' + status }); return; }
  if (status >= 300) return;
  if (u.kind === 'page') findings.push(...contentFindings(u.path, body, { allowNoindex: ['/my', '/checkout', '/cart', '/quote'].includes(u.orig) }));
  if (u.kind === 'config') { let j = null; try { j = JSON.parse(body); } catch (e) {} findings.push(...configFindings(j, 'production')); }
  if (u.kind === 'catalog') { let j = null; try { j = JSON.parse(body); } catch (e) {} findings.push(...catalogFindings(j, null)); }
});
const rep = summarize(findings); rep.findings.forEach(x => { x.owner = ownerOfFinding(x); });
const d = alertDecision(rep.findings, sd.http || null, Date.now(), { consecutive: 2, cooldownMin: 360 }); sd.http = d.state;
return [{ json: { source: 'http', status: rep.status, counts: rep.counts, alerts: d.alerts, recovered: d.recovered, text: (d.alerts.length || d.recovered.length) ? ownerMessage(d.alerts, d.recovered, ownerOfFinding) : '', at: new Date().toISOString() } }];`),
    node("تقرير الرحلة الكاملة", "n8n-nodes-base.webhook", 2, [0, 300], { httpMethod: "POST", path: "site-guardian-full-" + hex(8), authentication: "headerAuth", responseMode: "onReceived", options: {} }, { webhookId: uid(), credentials: { httpHeaderAuth: { id: credId, name: CRED_NAME } } }),
    code("قيّم التقرير", [240, 300], `${FUNCS}
const rep = ($input.first().json.body) || {}; const sd = $getWorkflowStaticData('global');
const findings = (Array.isArray(rep.findings) ? rep.findings : []).slice(0, 200).map(x => ({ severity: ['critical','major','minor'].includes(x.severity) ? x.severity : 'minor', code: String(x.code || '').slice(0, 60), path: String(x.path || '').slice(0, 120), msg: String(x.msg || '').slice(0, 240) }));
const d = alertDecision(findings, sd.full || null, Date.now(), { consecutive: 2, cooldownMin: 360 }); sd.full = d.state;
const s = summarize(findings);
return [{ json: { source: 'full', status: s.status, counts: s.counts, alerts: d.alerts, recovered: d.recovered, text: (d.alerts.length || d.recovered.length) ? ownerMessage(d.alerts, d.recovered, ownerOfFinding) : '', at: new Date().toISOString() } }];`),
    code("ملخص التشغيل", [960, 150], `const j = $input.first().json; return [{ json: j }];`),
    node("سجّل التشغيل", "n8n-nodes-base.postgres", 2.5, [1200, 0], { operation: "executeQuery", query: "INSERT INTO farah.messages(direction,source,wa_id,body,meta) VALUES('out','siteguard',NULL,$1::text,$2::jsonb)", options: { queryReplacement: "={{ [ 'حارس الموقع (' + $json.source + '): ' + $json.status + ' — حرج ' + $json.counts.critical + ' · مهم ' + $json.counts.major + ' · بسيط ' + $json.counts.minor, JSON.stringify({ source: $json.source, status: $json.status, counts: $json.counts, alerts: $json.alerts.length, recovered: $json.recovered.length }) ] }}" } }, { credentials: CRED.pg, onError: "continueRegularOutput" }),
    node("هل من تنبيه؟", "n8n-nodes-base.if", 2.2, [1200, 300], { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, combinator: "and", conditions: [{ id: uid(), leftValue: "={{ !!$('ملخص التشغيل').first().json.text }}", rightValue: true, operator: { type: "boolean", operation: "true" } }] }, options: {} }),
    node("بوابة الإشعارات", "n8n-nodes-base.executeWorkflow", 1.2, [1440, 300], { source: "database", workflowId: { __rl: true, mode: "id", value: gateId }, workflowInputs: { mappingMode: "defineBelow", matchingColumns: [], value: { text: "={{ $('ملخص التشغيل').first().json.text }}", subject: "", sender: "", origin: "site", test: "false" }, schema: ["text", "subject", "sender", "origin", "test"].map((id) => ({ id, displayName: id, required: false, display: true, type: "string", canBeUsedToMatch: false })) }, options: { waitForSubWorkflow: true } }, { onError: "continueRegularOutput" }),
    node("يمرّ؟", "n8n-nodes-base.if", 2.2, [1680, 300], { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, combinator: "and", conditions: [{ id: uid(), leftValue: "={{ $json.send !== false }}", rightValue: true, operator: { type: "boolean", operation: "true" } }] }, options: {} }),
    node("واتساب لباهر", "n8n-nodes-base.whatsApp", 1.1, [1920, 260], { operation: "send", phoneNumberId: WA_PHONE_ID, recipientPhoneNumber: OWNER_WA, textBody: "={{ $('ملخص التشغيل').first().json.text }}", additionalFields: {} }, { credentials: CRED.wa, onError: "continueRegularOutput" }),
    node("سجّل الإرسال (ليفهم الريبلاي)", "n8n-nodes-base.postgres", 2.5, [2160, 260], { operation: "executeQuery", query: "INSERT INTO farah.messages(direction,source,wa_id,body,meta) VALUES('out','proactive',$1::text,$2::text,'{\"kind\":\"site\"}'::jsonb)", options: { queryReplacement: "={{ [ $json.messages?.[0]?.id ?? null, String($('ملخص التشغيل').first().json.text || '').slice(0, 3500) ] }}" } }, { credentials: CRED.pg, onError: "continueRegularOutput" }),
  ];
  const c = {};
  link(c, "كل ١٠ دقائق", "الروابط"); link(c, "الروابط", "اجلب"); link(c, "اجلب", "قيّم HTTP"); link(c, "قيّم HTTP", "ملخص التشغيل");
  link(c, "تقرير الرحلة الكاملة", "قيّم التقرير"); link(c, "قيّم التقرير", "ملخص التشغيل");
  link(c, "ملخص التشغيل", "سجّل التشغيل"); link(c, "ملخص التشغيل", "هل من تنبيه؟");
  link(c, "هل من تنبيه؟", "بوابة الإشعارات", 0); link(c, "بوابة الإشعارات", "يمرّ؟"); link(c, "يمرّ؟", "واتساب لباهر", 0); link(c, "واتساب لباهر", "سجّل الإرسال (ليفهم الريبلاي)");
  return { name: NAME, nodes, connections: c, settings: { executionOrder: "v1", timezone: "Asia/Riyadh", saveDataSuccessExecution: "none", saveDataErrorExecution: "all" } };
}

async function api(path, opt = {}) { const r = await fetch(API + path, { headers: H, ...opt }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { ok: r.ok, status: r.status, body: j }; }
const wfs = (await api("/workflows?limit=250")).body.data;
const creds = (await api("/credentials?limit=250")).body?.data || [];
const gate = wfs.find((w) => /بوابة الإشعارات \(Notify Gate\)/.test(w.name));
if (!gate) { console.log("بوابة الإشعارات (build-farah-v2.mjs) غير موجودة"); process.exit(1); }
const log = [];
let credId = (creds.find((x) => x.name === CRED_NAME) || {}).id;
if (!credId) { log.push("+ credential: " + CRED_NAME); if (APPLY) { const r = await api("/credentials", { method: "POST", body: JSON.stringify({ name: CRED_NAME, type: "httpHeaderAuth", data: { name: "X-BP-Guardian-Key", value: hex(32) } }) }); credId = r.body.id; } else credId = "<new>"; } else log.push("= credential exists");
const def = workflow(gate.id, credId);
const ex = wfs.find((w) => w.name === NAME);
if (ex) log.push(`= workflow exists (not touched): ${ex.id} active=${ex.active}`);
else { log.push(`+ workflow (inactive): ${NAME} — ${def.nodes.length} nodes`); if (APPLY) { const r = await api("/workflows", { method: "POST", body: JSON.stringify(def) }); if (!r.ok) { console.log("failed", r.status, JSON.stringify(r.body).slice(0, 500)); process.exit(1); } log.push("  id " + r.body.id + " active=" + r.body.active); } }
console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN"); log.forEach((l) => console.log(l));
