// Farah v2 on Azure n8n (2026-10-17, owner request): conversation context + running topics, drafts in Baher's voice,
// and a money/customers-only notification gate. Everything created here is a NEW, INACTIVE workflow.
//   node ops/azure-n8n/build-farah-v2.mjs                 -> dry run (prints what would be created)
//   node ops/azure-n8n/build-farah-v2.mjs --apply         -> creates the missing workflows/credentials (matched by exact name, never overwritten)
//   node ops/azure-n8n/build-farah-v2.mjs --apply --test --key-file=PATH   -> also creates the TEST harness + Farah-v2 test key (key goes to PATH, never printed)
//   node ops/azure-n8n/build-farah-v2.mjs --cleanup       -> deletes the TEST harness and test credentials
// It NEVER modifies, activates or deactivates an existing workflow. Cutover is a separate, documented owner decision
// (docs/farah-v2-handoff.md). Secrets: random keys are generated in memory; nothing is printed or written to the repo.
import fs from "fs";
import crypto from "crypto";
import { classifyNotification, gateProactiveText, buildGatePrompt, parseGateAnswer } from "./farah-notify-gate.mjs";
import { buildContext, parseTopicUpdates, buildTopicPrompt, buildDailyPrompt, cleanSummary } from "./farah-context.mjs";
import { buildUnderstandPrompt, parseUnderstanding, buildComposePrompt, draftGuard, pendingForDraft } from "./farah-draft.mjs";

const BASE = process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const KEY = (process.env.N8N_AZURE_API_KEY || "").trim();
if (!KEY) { console.log("Set N8N_AZURE_API_KEY"); process.exit(1); }
const API = BASE + "/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const APPLY = process.argv.includes("--apply");
const TEST = process.argv.includes("--test");
const CLEANUP = process.argv.includes("--cleanup");
const REBUILD = process.argv.includes("--rebuild"); // overwrite ONLY our own v2/GATED workflows, and only while they are inactive
const KEY_FILE = (process.argv.find((a) => a.startsWith("--key-file=")) || "").slice(11);
const uid = () => crypto.randomUUID();
const hex = (n) => crypto.randomBytes(n).toString("hex");
const OWNER_WA = "966530540231", WA_PHONE_ID = "1112996661901731";
const AOAI_URL = "https://bp-ai-ksa-2026.openai.azure.com/openai/deployments/bp-main/chat/completions?api-version=2025-03-01-preview";
const CRED = {
  pg: { postgres: { id: "kfEnJK1iMVLmLm9G", name: "Farah Memory" } },
  aoai: { azureOpenAiApi: { id: "fI2SkJuYmB2v3zCo", name: "Azure Open AI account" } },
};
const NAMES = {
  gate: "🚦 فرح v2 — بوابة الإشعارات (Notify Gate)",
  ctx: "🧩 فرح v2 — بناء السياق (Context Builder)",
  topics: "🗂️ فرح v2 — تحديث المواضيع (Topic Updater)",
  compact: "🗓️ فرح v2 — ملخص يومي وتنظيف المواضيع (Daily Compaction)",
  draft: "✍️ فرح v2 — صياغة رد بأسلوب باهر (Draft Reply)",
  farah: "🧠 فرح v2 — سياق ومواضيع وأسلوب (نسخة اختبار)",
  proactive: "📣 فرح v2 — متابعة استباقية مفلترة (مال/عملاء)",
  cash: "⏱️ BP AI — Cash & Execution Watchdog [GATED v2]",
  errors: "BP-Error-Handler [GATED v2]",
  news: "📰 آلاء — رادار الجهات الحكومية [GATED v2]",
  harness: "🧪 TEST — اختبار فرح v2 (يُحذف بعد الاختبار)",
  testCred: "TEST Header Auth — فرح v2 harness",
  farahCred: "Header Auth — فرح v2 (X-BP-Farah-V2-Key)",
};
const KEEP = ["executionOrder", "saveManualExecutions", "saveExecutionProgress", "saveDataErrorExecution", "saveDataSuccessExecution", "executionTimeout", "errorWorkflow", "timezone", "callerPolicy"];

async function api(path, opt = {}) {
  const r = await fetch(API + path, { headers: H, ...opt });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { ok: r.ok, status: r.status, body: j };
}
async function listAll(path) {
  let all = [], cur = "";
  do { const r = await api(`${path}?limit=100${cur ? `&cursor=${cur}` : ""}`); if (!r.ok) throw new Error(path + " " + r.status); all.push(...r.body.data); cur = r.body.nextCursor || ""; } while (cur);
  return all;
}

// ---------- node helpers ----------
const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: uid(), name, type, typeVersion, position, parameters, ...extra });
const pg = (name, query, repl, position, extra = {}) => node(name, "n8n-nodes-base.postgres", 2.5, position, { operation: "executeQuery", query, options: repl ? { queryReplacement: repl } : {} }, { credentials: CRED.pg, onError: "continueRegularOutput", ...extra });
const code = (name, position, jsCode) => node(name, "n8n-nodes-base.code", 2, position, { mode: "runOnceForAllItems", language: "javaScript", jsCode });
const ifNode = (name, position, left, op = { type: "boolean", operation: "true" }, right = true) => node(name, "n8n-nodes-base.if", 2.2, position, { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, combinator: "and", conditions: [{ id: uid(), leftValue: left, rightValue: right, operator: op }] }, options: {} });
const setNode = (name, position, fields, keep = false) => node(name, "n8n-nodes-base.set", 3.4, position, { mode: "manual", assignments: { assignments: fields.map(([n, v, t = "string"]) => ({ id: uid(), name: n, value: v, type: t })) }, includeOtherFields: keep, options: {} });
const link = (conns, from, to, out = 0) => { conns[from] = conns[from] || { main: [] }; while (conns[from].main.length <= out) conns[from].main.push([]); conns[from].main[out].push({ node: to, type: "main", index: 0 }); };
const trigger = (inputs) => node("Trigger", "n8n-nodes-base.executeWorkflowTrigger", 1.2, [0, 0], inputs ? { inputSource: "workflowInputs", workflowInputs: { values: inputs.map((name) => ({ name, type: "string" })) } } : { inputSource: "passthrough" });
const fnSrc = (fn) => fn.toString();
// Azure OpenAI bp-main through HTTP (same pattern as the minutes workflow). messagesExpr is a JS expression yielding the array.
const aoai = (name, position, messagesExpr, { json = false, temperature = 0.2, max = 900 } = {}) => node(name, "n8n-nodes-base.httpRequest", 4.2, position, {
  method: "POST", url: AOAI_URL, authentication: "predefinedCredentialType", nodeCredentialType: "azureOpenAiApi", sendBody: true, specifyBody: "json",
  jsonBody: `={{ JSON.stringify({ messages: ${messagesExpr}, ${json ? "response_format: { type: 'json_object' }, " : ""}temperature: ${temperature}, max_tokens: ${max} }) }}`,
  options: { timeout: 90000, response: { response: { neverError: true } } } }, { credentials: CRED.aoai, onError: "continueRegularOutput" });
const modelText = (n) => `(($('${n}').first().json.choices || [])[0] || {}).message?.content || ''`;
const wfSettings = { executionOrder: "v1", timezone: "Asia/Riyadh", saveDataSuccessExecution: "all", saveDataErrorExecution: "all" };
const execWf = (name, position, id, wait = true) => node(name, "n8n-nodes-base.executeWorkflow", 1.2, position, { source: "database", workflowId: { __rl: true, mode: "id", value: id }, options: { waitForSubWorkflow: wait } });

// ======================================================================================
// A) Notify Gate (sub-workflow). input: text, subject, sender, origin, test
// ======================================================================================
function gateWorkflow() {
  const nodes = [
    trigger(["text", "subject", "sender", "origin", "test"]),
    code("Rules", [240, 0], `${fnSrc(classifyNotification)}\nconst j = $input.first().json;\nconst r = classifyNotification({ text: j.text, subject: j.subject, sender: j.sender, origin: j.origin });\nreturn [{ json: { ...r, duplicate: false, preview: String(j.subject || j.text || '').replace(/\\s+/g, ' ').slice(0, 300), test: String(j.test || '') === 'true' } }];`),
    pg("Duplicate Lookup", `SELECT count(*)::int AS n FROM farah.messages WHERE source='gate' AND meta->>'hash'=$1::text AND meta->>'decision'='send' AND coalesce(meta->>'test','false')=$2::text AND ts > now() - interval '24 hours'`,
      "={{ [ $json.hash, String($json.test) ] }}", [480, 0], { alwaysOutputData: true }),
    code("Apply Dedupe", [720, 0], `const r = $('Rules').first().json; const n = Number(($input.first() || { json: {} }).json.n || 0);
if (r.decision === 'send' && r.label !== 'requested' && n > 0) return [{ json: { ...r, decision: 'log', label: 'other', duplicate: true, reasons: [...r.reasons, 'مكرر خلال ٢٤ ساعة'] } }];
return [{ json: r }];`),
    ifNode("Ambiguous?", [960, 0], "={{ $json.ambiguous === true && $json.duplicate !== true }}"),
    aoai("Ask Model (bp-main)", [1200, -120], `[ { role: 'user', content: (${fnSrc(buildGatePrompt)})({ text: $('Trigger').first().json.text, subject: $('Trigger').first().json.subject, sender: $('Trigger').first().json.sender, origin: $('Trigger').first().json.origin }) } ]`, { json: true, temperature: 0, max: 200 }),
    code("Parse Model", [1440, -120], `${fnSrc(parseGateAnswer)}\nconst r = $('Apply Dedupe').first().json;\nconst a = parseGateAnswer(((($input.first().json.choices || [])[0] || {}).message || {}).content || '');\nreturn [{ json: { ...r, label: a.label, decision: a.decision, reasons: [...r.reasons, 'النموذج: ' + (a.reason || a.by)], by: a.by } }];`),
    code("Finalize", [1680, 0], `const r = $input.first().json;\nreturn [{ json: { send: r.decision === 'send', label: r.label, decision: r.decision, reason: (r.reasons || []).join('، '), hash: r.hash, origin: r.origin, duplicate: !!r.duplicate, by: r.by || 'rules', preview: r.preview, test: !!r.test } }];`),
    pg("Log Decision", `INSERT INTO farah.messages(direction,source,wa_id,body,meta) VALUES('out','gate',NULL,$1::text,$2::jsonb) RETURNING id`,
      "={{ [ String($json.preview || '').slice(0, 500), JSON.stringify({ label: $json.label, decision: $json.decision, reason: $json.reason, hash: $json.hash, origin: $json.origin, by: $json.by, duplicate: $json.duplicate, test: String($json.test) }) ] }}", [1920, 0]),
    setNode("Out", [2160, 0], [["send", "={{ $('Finalize').first().json.send }}", "boolean"], ["label", "={{ $('Finalize').first().json.label }}"], ["decision", "={{ $('Finalize').first().json.decision }}"], ["reason", "={{ $('Finalize').first().json.reason }}"], ["duplicate", "={{ $('Finalize').first().json.duplicate }}", "boolean"], ["by", "={{ $('Finalize').first().json.by }}"]]),
  ];
  const c = {};
  link(c, "Trigger", "Rules"); link(c, "Rules", "Duplicate Lookup"); link(c, "Duplicate Lookup", "Apply Dedupe"); link(c, "Apply Dedupe", "Ambiguous?");
  link(c, "Ambiguous?", "Ask Model (bp-main)", 0); link(c, "Ambiguous?", "Finalize", 1);
  link(c, "Ask Model (bp-main)", "Parse Model"); link(c, "Parse Model", "Finalize"); link(c, "Finalize", "Log Decision"); link(c, "Log Decision", "Out");
  return { name: NAMES.gate, nodes, connections: c, settings: wfSettings };
}

// ======================================================================================
// B) Context Builder (sub-workflow, accepts the whole Normalize item and returns it + ctx)
// ======================================================================================
function ctxWorkflow() {
  const nodes = [
    trigger(null),
    pg("Recent 20", `SELECT id, to_char(ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS t, direction, source, left(body,700) AS body
FROM farah.messages
WHERE ( ($1::text = 'owner' AND source IN ('conversation','proactive')) OR ($1::text <> 'owner' AND wa_id = $1::text) )
ORDER BY ts DESC, id DESC LIMIT 20`, "={{ [ String($('Trigger').first().json.party || 'owner') ] }}", [240, 0], { alwaysOutputData: true }),
    pg("Replied Message + Neighbours", `WITH t AS (SELECT id FROM farah.messages WHERE wa_id = $1::text AND $1::text <> '' ORDER BY id DESC LIMIT 1)
SELECT * FROM (
  (SELECT 'before' AS pos, m.id, to_char(m.ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS t, m.direction, m.source, left(m.body,1500) AS body, NULL::json AS items FROM farah.messages m, t WHERE m.id < t.id AND m.source IN ('conversation','proactive') ORDER BY m.id DESC LIMIT 3)
  UNION ALL
  (SELECT 'target', m.id, to_char(m.ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI'), m.direction, m.source, left(m.body,3000),
     (SELECT json_agg(json_build_object('no',p.digest_no,'id',p.id,'kind',p.kind,'title',p.title,'status',p.status)) FROM farah.pending p WHERE p.msg_id = m.id)
   FROM farah.messages m, t WHERE m.id = t.id)
  UNION ALL
  (SELECT 'after', m.id, to_char(m.ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI'), m.direction, m.source, left(m.body,1500), NULL::json FROM farah.messages m, t WHERE m.id > t.id AND m.source IN ('conversation','proactive') ORDER BY m.id ASC LIMIT 3)
) x ORDER BY id`, "={{ [ String($('Trigger').first().json.replyToId || '') ] }}", [480, 0], { alwaysOutputData: true }),
    pg("Running Topics", `SELECT subject, content, source, to_char(updated_at AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS u FROM farah.memories WHERE active AND kind='topic' ORDER BY updated_at DESC LIMIT 12`, null, [720, 0], { alwaysOutputData: true }),
    pg("Pending + Prefs + Summaries", `SELECT
 (SELECT json_agg(x) FROM (SELECT id, kind, title, digest_no FROM farah.pending WHERE status='open' AND kind <> 'reply_draft' ORDER BY created_at DESC LIMIT 8) x) AS pending,
 (SELECT json_agg(y) FROM (SELECT kind, subject, left(content,300) AS content FROM farah.memories WHERE active AND kind IN ('preference','rule','decision') ORDER BY updated_at DESC LIMIT 10) y) AS prefs,
 (SELECT json_agg(z) FROM (SELECT day::text AS d, left(summary,900) AS s FROM farah.daily_summaries ORDER BY day DESC LIMIT 2) z) AS summaries`, null, [960, 0], { alwaysOutputData: true }),
    code("Assemble", [1200, 0], `${fnSrc(buildContext)}
const t = $('Trigger').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && Object.keys(r).length); } catch (e) { return []; } };
const misc = (all('Pending + Prefs + Summaries')[0]) || {};
const built = buildContext({ recent: all('Recent 20'), replied: all('Replied Message + Neighbours'), topics: all('Running Topics'), misc, replyToId: String(t.replyToId || '') });
return [{ json: { ...t, ctx: built.ctx, ctx_stats: built.stats } }];`),
  ];
  const c = {};
  link(c, "Trigger", "Recent 20"); link(c, "Recent 20", "Replied Message + Neighbours"); link(c, "Replied Message + Neighbours", "Running Topics"); link(c, "Running Topics", "Pending + Prefs + Summaries"); link(c, "Pending + Prefs + Summaries", "Assemble");
  return { name: NAMES.ctx, nodes, connections: c, settings: wfSettings };
}

// ======================================================================================
// C) Topic Updater (sub-workflow). input: user, reply, party, test
// ======================================================================================
function topicsWorkflow() {
  const nodes = [
    trigger(["user", "reply", "party", "test"]),
    code("Worth It?", [240, 0], `const j = $input.first().json; const u = String(j.user || '').trim(), r = String(j.reply || '').trim();
if (u.length < 12 && r.length < 60) return [];
return [{ json: j }];`),
    pg("Existing Topics", `SELECT subject FROM farah.memories WHERE active AND kind='topic' ORDER BY updated_at DESC LIMIT 15`, null, [480, 0], { alwaysOutputData: true }),
    aoai("Topics (bp-main)", [720, 0], `[ { role: 'user', content: (${fnSrc(buildTopicPrompt)})({ existing: $('Existing Topics').all().map(i => i.json.subject).filter(Boolean), user: $('Trigger').first().json.user, reply: $('Trigger').first().json.reply }) } ]`, { json: true, temperature: 0.1, max: 900 }),
    code("Parse Topics", [960, 0], `${fnSrc(parseTopicUpdates)}\nconst t = $('Trigger').first().json;\nconst ex = $('Existing Topics').all().map(i => i.json.subject).filter(Boolean);\nconst r = parseTopicUpdates(((($input.first().json.choices || [])[0] || {}).message || {}).content || '', ex);\nconst party = String(t.party || 'owner').slice(0, 60);\nreturn r.updates.map(u => ({ json: { ...u, src: 'topic:' + party } }));`),
    pg("Upsert Topic", `WITH u AS (UPDATE farah.memories SET content=$3::text, updated_at=now(), active=($4::text <> 'done') WHERE kind='topic' AND subject=$1::text AND source=$2::text RETURNING id)
INSERT INTO farah.memories(kind,subject,content,source,active) SELECT 'topic',$1::text,$3::text,$2::text,($4::text <> 'done') WHERE NOT EXISTS (SELECT 1 FROM u) RETURNING id`,
      "={{ [ $json.title, $json.src, $json.content, $json.status ] }}", [1200, 0]),
  ];
  const c = {};
  link(c, "Trigger", "Worth It?"); link(c, "Worth It?", "Existing Topics"); link(c, "Existing Topics", "Topics (bp-main)"); link(c, "Topics (bp-main)", "Parse Topics"); link(c, "Parse Topics", "Upsert Topic");
  return { name: NAMES.topics, nodes, connections: c, settings: wfSettings };
}

// ======================================================================================
// D) Daily compaction (schedule 23:30 Riyadh + on-demand trigger with `day`)
// ======================================================================================
function compactWorkflow() {
  const nodes = [
    node("Daily 23:30 Riyadh", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 200], { rule: { interval: [{ field: "cronExpression", expression: "30 23 * * *" }] } }),
    trigger(["day"]),
    code("Pick Day", [240, 100], `const j = $input.first().json || {};\nconst riyadh = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);\nreturn [{ json: { day: /^\\d{4}-\\d{2}-\\d{2}$/.test(String(j.day || '')) ? j.day : riyadh, scheduled: !j.day } }];`),
    pg("Read Day", `SELECT to_char(ts AT TIME ZONE 'Asia/Riyadh','HH24:MI') AS t, direction, left(body,500) AS body FROM farah.messages WHERE (ts AT TIME ZONE 'Asia/Riyadh')::date = $1::date AND source IN ('conversation','proactive') ORDER BY ts LIMIT 200`, "={{ [ $json.day ] }}", [480, 100], { alwaysOutputData: true }),
    code("Enough?", [720, 100], `const rows = $input.all().map(i => i.json).filter(r => r && r.body);\nconst day = $('Pick Day').first().json.day;\nif (rows.length < 6) return [];\nreturn [{ json: { day, count: rows.length, prompt: (${fnSrc(buildDailyPrompt)})(day, rows) } }];`),
    aoai("Summarize (bp-main)", [960, 100], `[ { role: 'user', content: $json.prompt } ]`, { temperature: 0.2, max: 900 }),
    code("Clean Summary", [1200, 100], `${fnSrc(cleanSummary)}\nconst e = $('Enough?').first().json;\nconst s = cleanSummary(((($input.first().json.choices || [])[0] || {}).message || {}).content || '');\nif (!s) return [];\nreturn [{ json: { day: e.day, summary: s, count: e.count } }];`),
    pg("Save Summary", `INSERT INTO farah.daily_summaries(day, summary) VALUES($1::date, $2::text) ON CONFLICT (day) DO UPDATE SET summary = EXCLUDED.summary RETURNING day`, "={{ [ $json.day, $json.summary ] }}", [1440, 100]),
    // topic hygiene runs only on the nightly schedule, never on the on-demand trigger
    ifNode("Nightly Run?", [480, 300], "={{ $json.scheduled === true }}"),
    pg("Retire Stale Topics", `UPDATE farah.memories SET active=false WHERE kind='topic' AND active AND ( (content::text LIKE '%"status":"done"%' AND updated_at < now() - interval '3 days') OR updated_at < now() - interval '30 days' ) RETURNING id`, null, [720, 300], { alwaysOutputData: true }),
  ];
  const c = {};
  link(c, "Daily 23:30 Riyadh", "Pick Day"); link(c, "Trigger", "Pick Day"); link(c, "Pick Day", "Read Day"); link(c, "Pick Day", "Nightly Run?");
  link(c, "Read Day", "Enough?"); link(c, "Enough?", "Summarize (bp-main)"); link(c, "Summarize (bp-main)", "Clean Summary"); link(c, "Clean Summary", "Save Summary");
  link(c, "Nightly Run?", "Retire Stale Topics", 0);
  return { name: NAMES.compact, nodes, connections: c, settings: wfSettings };
}

// ======================================================================================
// E) Draft Reply in Baher's style (sub-workflow = tool of Farah v2). Never sends.
// ======================================================================================
const STYLE_DOC = fs.readFileSync(new URL("../../docs/baher-style-guide.md", import.meta.url), "utf8");
const STYLE_PROMPT = (STYLE_DOC.match(/<!-- PROMPT:START -->([\s\S]*?)<!-- PROMPT:END -->/) || [, ""])[1].trim();
if (!STYLE_PROMPT) { console.log("style guide block missing in docs/baher-style-guide.md"); process.exit(1); }
const DRAFT_INPUTS = ["who", "channel", "customer_message", "instruction"];
function draftWorkflow() {
  const nodes = [
    trigger(DRAFT_INPUTS),
    pg("Thread With Party", `SELECT direction, left(body,500) AS body, to_char(ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS t, meta->>'name' AS name
FROM farah.messages WHERE source IN ('website','whatsapp','reply','conversation') AND wa_id IS NOT NULL
 AND (wa_id = $1::text OR meta->>'name' ILIKE '%'||$1::text||'%' OR meta->>'email' ILIKE $1::text)
ORDER BY ts DESC LIMIT 14`, "={{ [ String($json.who || '').slice(0, 120) ] }}", [240, 0], { alwaysOutputData: true }),
    pg("What We Know", `SELECT kind, subject, left(content,300) AS content FROM farah.memories WHERE active AND kind IN ('person','company','decision','fact')
 AND (tsv @@ plainto_tsquery('simple', $1::text) OR subject ILIKE '%'||$1::text||'%') ORDER BY updated_at DESC LIMIT 6`, "={{ [ String($('Trigger').first().json.who || '').slice(0, 120) ] }}", [480, 0], { alwaysOutputData: true }),
    pg("Style Samples", `SELECT content FROM farah.memories WHERE active AND kind='style_sample' ORDER BY updated_at DESC LIMIT 6`, null, [720, 0], { alwaysOutputData: true }),
    code("Build Understand Prompt", [960, 0], `${fnSrc(buildUnderstandPrompt)}
const t = $('Trigger').first().json;
const rows = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && Object.keys(r).length); } catch (e) { return []; } };
const thread = rows('Thread With Party').reverse();
let msg = String(t.customer_message || '').trim();
if (!msg) { const lastIn = thread.filter(m => m.direction === 'in').pop(); msg = lastIn ? lastIn.body : ''; }
const name = (thread.find(m => m.name) || {}).name || '';
return [{ json: { prompt: buildUnderstandPrompt({ who: t.who, channel: t.channel, customer_message: msg, thread, memory: rows('What We Know'), instruction: t.instruction }), msg, name } }];`),
    aoai("Understand (bp-main)", [1200, 0], `[ { role: 'user', content: $json.prompt } ]`, { json: true, temperature: 0, max: 700 }),
    code("Build Compose Prompt", [1440, 0], `${fnSrc(parseUnderstanding)}\n${fnSrc(buildComposePrompt)}
const t = $('Trigger').first().json; const p = $('Build Understand Prompt').first().json;
const u = parseUnderstanding(((($input.first().json.choices || [])[0] || {}).message || {}).content || '');
const samples = (() => { try { return $('Style Samples').all().map(i => i.json).filter(r => r && r.content); } catch (e) { return []; } })();
const style = ${JSON.stringify(STYLE_PROMPT)};
return [{ json: { u, name: p.name, msg: p.msg, prompt: buildComposePrompt({ style, samples, understanding: u, who: t.who, name: p.name, channel: t.channel || 'whatsapp', instruction: t.instruction }) } }];`),
    aoai("Compose In Baher Style (bp-main)", [1680, 0], `[ { role: 'user', content: $json.prompt } ]`, { temperature: 0.5, max: 700 }),
    code("Guard + Finalize", [1920, 0], `${fnSrc(draftGuard)}\n${fnSrc(pendingForDraft)}
const t = $('Trigger').first().json; const b = $('Build Compose Prompt').first().json;
let draft = String(((($input.first().json.choices || [])[0] || {}).message || {}).content || '').trim().replace(/^["«]+|["»]+$/g, '').trim();
const g = draftGuard(draft, String(t.channel || 'whatsapp'));
const pend = pendingForDraft({ who: t.who, channel: t.channel, draft, asked: b.u.asked, flags: g });
return [{ json: { draft, understanding: b.u, flags: g, pend } }];`),
    pg("Save Draft Pending", `INSERT INTO farah.pending(kind,title,detail,source,source_ref) VALUES($1::text,$2::text,$3::text,'draft',md5($3::text)) ON CONFLICT DO NOTHING RETURNING id`,
      "={{ [ $json.pend.kind, $json.pend.title, $json.pend.detail ] }}", [2160, 0], { alwaysOutputData: true }),
    setNode("Result", [2400, 0], [
      ["ok", "={{ !!$('Guard + Finalize').first().json.draft }}", "boolean"],
      ["sent", false, "boolean"],
      ["draft", "={{ $('Guard + Finalize').first().json.draft }}"],
      ["understood", "={{ $('Guard + Finalize').first().json.understanding.asked }}"],
      ["intent", "={{ $('Guard + Finalize').first().json.understanding.intent }}"],
      ["needs_approval", "={{ $('Guard + Finalize').first().json.flags.needs_approval }}", "boolean"],
      ["hard_flags", "={{ $('Guard + Finalize').first().json.flags.hard.join(' | ') }}"],
      ["soft_flags", "={{ $('Guard + Finalize').first().json.flags.soft.join(' | ') }}"],
      ["pending_id", "={{ $json.id || '' }}"],
      ["next_step", "اعرضي المسودة على باهر مع «فهمت أنه يسأل عن…». لا ترسلي. إن قال «أرسلي» فاستعملي Reply To Client (Safe) (lookup ثم send) بنصها، مع approved_by_baher=true فقط إن وافق صراحةً على ما فيها من سعر/خصم/ضمان. وإن عدّل النص فاحفظي (قبل | بعد) بـ Save Memory kind=style_sample."],
    ]),
  ];
  const c = {};
  link(c, "Trigger", "Thread With Party"); link(c, "Thread With Party", "What We Know"); link(c, "What We Know", "Style Samples"); link(c, "Style Samples", "Build Understand Prompt");
  link(c, "Build Understand Prompt", "Understand (bp-main)"); link(c, "Understand (bp-main)", "Build Compose Prompt"); link(c, "Build Compose Prompt", "Compose In Baher Style (bp-main)");
  link(c, "Compose In Baher Style (bp-main)", "Guard + Finalize"); link(c, "Guard + Finalize", "Save Draft Pending"); link(c, "Save Draft Pending", "Result");
  return { name: NAMES.draft, nodes, connections: c, settings: wfSettings };
}
const DRAFT_TOOL_DESC = "تصوغ مسودة ردّ على عميل بأسلوب باهر: تفهم سؤاله من سجل المحادثة والذاكرة، تجهّز الجواب، تكتبه بأسلوب باهر، وتمرّه على حارس الالتزامات (سعر/خصم/ضمان/التزام حكومي أو قانوني). لا ترسل شيئاً أبداً. استعمليها حين يقول باهر «ردّي على فلان» أو حين تريدين اقتراح ردّ، ثم اعرضي المسودة عليه. who=الاسم أو الجوال أو البريد أو WEB-…، channel=whatsapp أو email، customer_message=آخر رسالة من العميل إن عرفتِها (وإلا فارغ فتؤخذ من السجل)، instruction=توجيه باهر لهذا الرد إن وُجد.";
function draftToolNode(subId) {
  const ai = (k, d, def) => `={{ $fromAI('${k}', '${d}', 'string'${def !== undefined ? `, '${def}'` : ""}) }}`;
  return node("Draft Reply In Baher Style", "@n8n/n8n-nodes-langchain.toolWorkflow", 2.2, [2200, 1400], {
    description: DRAFT_TOOL_DESC, source: "database", workflowId: { __rl: true, mode: "id", value: subId, cachedResultName: NAMES.draft },
    workflowInputs: { mappingMode: "defineBelow", matchingColumns: [], value: {
      who: ai("who", "الاسم أو الجوال أو البريد أو معرّف WEB-… للعميل"), channel: ai("channel", "whatsapp أو email", "whatsapp"),
      customer_message: ai("customer_message", "آخر رسالة من العميل إن عرفتِها، وإلا فارغ", ""), instruction: ai("instruction", "توجيه باهر لهذا الرد إن وُجد", "") },
      schema: DRAFT_INPUTS.map((id) => ({ id, displayName: id, required: false, display: true, type: "string", canBeUsedToMatch: false })) } });
}

// ======================================================================================
// F) Farah v2 = copy of the LIVE Farah with: context injection, topic updater, draft tool, held-notifications tool, rules, test-only webhook path
// ======================================================================================
const V2_RULES = `

قاعدة السياق (النسخة 2 — تعلو على قاعدة الذاكرة أعلاه حيث تتعارض، قرار المالك 2026-10-17):
١) يصلك أعلى كل رسالة كتلة «سياق جاهز» حُمّلت تلقائياً: آخر ٢٠ رسالة، المواضيع الجارية، البنود المعلّقة، تفضيلات باهر، وملخص الأيام السابقة. اقرئيها أولاً. ممنوع أن تسألي «على ماذا؟» أو «أي رسالة؟» أو تقولي «ما أذكر» قبل أن تتأكدي أنها غير موجودة فيها.
٢) إن كانت رسالته ردّاً على رسالة سابقة فالكتلة تقول لك صراحةً «باهر يردّ الآن على هذه الرسالة بالذات» مع نصها وما قبلها وما بعدها. فسّري كلامه عليها هي (موافق/لا/أجّل/نفّذ/أرسلي/رقم) ونفّذي، ولا تسألي أي رسالة يقصد. وإن قالت الكتلة إن الرسالة غير محفوظة فاعتمدي على آخر رسالة منك وصرّحي بذلك في جملة.
٣) Recent Conversation وSearch Memory وRecent Summaries تبقى للأقدم مما في الكتلة فقط.
٤) المواضيع الجارية تُحدَّث تلقائياً بعد كل جولة؛ لا تحاولي كتابتها بيدك. إن صحّح باهر معلومة فيها فاحفظي التصحيح بـ Save Memory (kind=decision).

قاعدة الإشعارات (قرار المالك 2026-10-17): باهر لا يريد في واتساب إلا ما له علاقة بالمال والعملاء (دفعات، فواتير، عروض أسعار، تحصيل، عميل جديد أو استفسار عميل، صفقة تتحرك أو تتعثر، شكوى عميل، موعد مع عميل). غير ذلك (أخبار تنظيمية، حالة النظام، مهام الفريق الداخلية، متابعات روتينية، تقارير غير مالية) تحجبه «بوابة الإشعارات» تلقائياً وتسجّله. لا تعديه بوضع هدوء من عندك ولا تخترعي آلية؛ إن سأل «وش المكتوم؟» فاستعملي Read Held Notifications. وفي ردودك أنتِ على باهر: لا تضيفي «أرشفت/سويت» لما لا يخص المال والعملاء ما لم يسأل.

قاعدة الرد على العملاء بأسلوب باهر (النسخة 2): حين يقول «ردّي على فلان» (أو تقترحين ردّاً): (١) Reply To Client (Safe) action=lookup لتحديد الطرف. (٢) Draft Reply In Baher Style لصياغة المسودة؛ اعرضيها عليه مع جملة «فهمت أنه يسأل عن…». (٣) لا ترسلي حتى يقول «أرسلي». وإن عدّل النص أو قال «لا، قوليها كذا» فاحفظي (قبل | بعد) بـ Save Memory kind=style_sample بعد استبدال الاسم والرقم بـ«فلان» و«X». أي سعر أو خصم أو ضمان أو التزام حكومي/قانوني يبقى «[بانتظار تأكيد باهر]» ولا يُرسل إلا بموافقته الصريحة على النص نفسه.

${STYLE_PROMPT}`;

function farahV2(live, ids, testCredId) {
  const w = JSON.parse(JSON.stringify(live));
  const find = (n) => w.nodes.find((x) => x.name === n);
  const agent = find("Muin — Personal Assistant");
  // never listen on WhatsApp / the live Command Space URL
  const waIn = find("Baher WhatsApp In"); if (waIn) waIn.disabled = true;
  const cs = find("Command Space Direct In");
  cs.parameters = { ...cs.parameters, path: "farah-v2-test-" + hex(8) };
  cs.credentials = { httpHeaderAuth: { id: testCredId, name: NAMES.farahCred } };
  cs.webhookId = uid();
  // let a test simulate a quoted WhatsApp reply
  const env = find("Prepare Command Space Envelope");
  const cs4 = env.parameters.assignments.assignments.find((a) => a.name === "messages");
  cs4.value = cs4.value.replace("type: 'text', text: {", "type: 'text', ...($json.body?.reply_to_id ? { context: { id: String($json.body.reply_to_id) } } : {}), text: {");
  // context builder between Owner Only and its children
  const ctxNode = execWf("Build Farah Context", [-600, 400], ids.ctx);
  w.nodes.push(ctxNode);
  const ownerOut = w.connections["Owner Only (Baher)"].main[0];
  w.connections["Build Farah Context"] = { main: [ownerOut.map((x) => ({ ...x }))] };
  w.connections["Owner Only (Baher)"].main[0] = [{ node: "Build Farah Context", type: "main", index: 0 }];
  // agent text: context first
  agent.parameters.text = agent.parameters.text.replace("=رسالة من باهر", "={{ (() => { try { return $('Build Farah Context').first().json.ctx + '\\n\\n'; } catch (e) { return ''; } })() }}رسالة من باهر");
  if (!agent.parameters.text.includes("Build Farah Context")) throw new Error("agent text patch failed");
  // rules
  const sm = agent.parameters.options.systemMessage;
  agent.parameters.options.systemMessage = sm + V2_RULES;
  // topic updater after the agent (parallel, do not wait)
  const upd = execWf("Update Topics", [1400, 1500], ids.topics, false);
  upd.parameters.source = "database";
  upd.parameters.workflowInputs = { mappingMode: "defineBelow", matchingColumns: [], value: {
    user: "={{ $('Normalize').first().json.userText }}", reply: "={{ String($json.output || '') }}", party: "owner", test: "={{ /\\[TEST-V2\\]/.test($('Normalize').first().json.userText || '') ? 'true' : 'false' }}" },
    schema: ["user", "reply", "party", "test"].map((id) => ({ id, displayName: id, required: false, display: true, type: "string", canBeUsedToMatch: false })) };
  upd.onError = "continueRegularOutput";
  w.nodes.push(upd);
  w.connections["Muin — Personal Assistant"].main[0].push({ node: "Update Topics", type: "main", index: 0 });
  // tools
  w.nodes.push(draftToolNode(ids.draft));
  w.connections["Draft Reply In Baher Style"] = { ai_tool: [[{ node: agent.name, type: "ai_tool", index: 0 }]] };
  const held = pg("Read Held Notifications", `SELECT to_char(ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS t, meta->>'label' AS label, meta->>'origin' AS origin, meta->>'reason' AS reason, left(body,240) AS body FROM farah.messages WHERE source='gate' AND meta->>'decision'='log' AND coalesce(meta->>'test','false')<>'true' AND ts > now() - interval '24 hours' ORDER BY ts DESC LIMIT 25`, null, [2420, 1400], { onError: undefined });
  held.type = "n8n-nodes-base.postgresTool"; held.parameters.descriptionType = "manual";
  held.parameters.toolDescription = "الإشعارات التي حجبتها بوابة الإشعارات آخر ٢٤ ساعة لأنها ليست مالاً ولا عملاء (أخبار، حالة نظام، مهام داخلية، بريد آلي…). استعمليها حين يسأل باهر «وش المكتوم؟» أو «وش فاتني؟».";
  delete held.onError;
  w.nodes.push(held);
  w.connections["Read Held Notifications"] = { ai_tool: [[{ node: agent.name, type: "ai_tool", index: 0 }]] };
  // Recent Conversation: the gate log must not pollute the dialogue
  const rc = find("Recent Conversation");
  rc.parameters.query = rc.parameters.query.replace("FROM farah.messages ORDER BY", "FROM farah.messages WHERE source <> 'gate' ORDER BY");
  const settings = {}; for (const k of KEEP) if (w.settings?.[k] !== undefined) settings[k] = w.settings[k];
  return { name: NAMES.farah, nodes: w.nodes, connections: w.connections, settings };
}

// ======================================================================================
// G) Proactive follow-up v2: item-level gate + morning brief limited to money/customers
// ======================================================================================
const BRIEF_OLD_STRUCT = /البنية \(كل قسم[\s\S]*?\\n\\nالبيانات \(JSON\):/;
function proactiveV2(live) {
  const w = JSON.parse(JSON.stringify(live));
  const find = (n) => w.nodes.find((x) => x.name === n);
  // 1) gate items between Decide and Number Items
  const gateItems = code("Gate Items (money/customers only)", [1400, -240], `${fnSrc(classifyNotification)}\n${fnSrc(gateProactiveText)}
const g = gateProactiveText($input.first().json.text, classifyNotification);
return [{ json: { text: g.text, kept: g.kept, dropped: g.dropped, decisions: g.decisions } }];`);
  const hasText = ifNode("Anything Worth Sending?", [1640, -240], "={{ !!$json.text }}");
  const logGate = pg("Log Gate Decisions", `INSERT INTO farah.messages(direction,source,wa_id,body,meta)
SELECT 'out','gate',NULL, x.preview, jsonb_build_object('label',x.label,'decision',x.decision,'reason',array_to_string(x.reasons,'، '),'hash',x.hash,'origin',x.origin,'by','rules','test','false')
FROM jsonb_to_recordset($1::jsonb) AS x(preview text,label text,decision text,reasons text[],hash text,origin text) RETURNING id`,
    "={{ [ JSON.stringify(($json.decisions || []).map(d => ({ preview: d.preview, label: d.label, decision: d.decision, reasons: d.reasons || [], hash: d.hash, origin: d.origin }))) ] }}", [1640, -40], { alwaysOutputData: true });
  w.nodes.push(gateItems, hasText, logGate);
  w.connections["Decide What To Tell Baher"] = { main: [[{ node: "Gate Items (money/customers only)", type: "main", index: 0 }]] };
  w.connections["Gate Items (money/customers only)"] = { main: [[{ node: "Anything Worth Sending?", type: "main", index: 0 }, { node: "Log Gate Decisions", type: "main", index: 0 }]] };
  w.connections["Anything Worth Sending?"] = { main: [[{ node: "Number Items", type: "main", index: 0 }], []] };
  // 2) morning brief: money + customers only, plus a one-line count of what was held
  const held = pg("Read Held Yesterday", `SELECT count(*)::int AS n FROM farah.messages WHERE source='gate' AND meta->>'decision'='log' AND coalesce(meta->>'test','false')<>'true' AND ts > now() - interval '24 hours'`, null, [680, 560], { alwaysOutputData: true });
  w.nodes.push(held);
  w.connections["Read KPIs"] = { main: [[{ node: "Read Held Yesterday", type: "main", index: 0 }]] };
  w.connections["Read Held Yesterday"] = { main: [[{ node: "Compose Facts", type: "main", index: 0 }]] };
  const cf = find("Compose Facts");
  let src = cf.parameters.jsCode;
  const pre = src;
  src = src.replace("const deals = g('Read All Deals'), tasks = g('Read All Tasks'), kpis = g('Read KPIs');", "const deals = g('Read All Deals'), tasks = g('Read All Tasks'), kpis = g('Read KPIs'); const heldN = (g('Read Held Yesterday')[0] || {}).n || 0;");
  src = src.replace(/  kpis: kpis\.slice\(0, 25\)\n\};/, "  money_kpis: kpis.filter(k => /revenue|cash|collect|invoice|paid|pipeline|deal|مبيع|تحصيل|إيراد|فاتور|دفع|نقد/i.test(JSON.stringify(k))).slice(0, 12),\n  held_yesterday: heldN\n};");
  src = src.replace(/    completed_last_24h: tasks\.filter[\s\S]*?\.slice\(0, 10\)\n/, "    completed_last_24h: []\n");
  const NEW_STRUCT = "البنية (كل قسم سطران إلى أربعة، بلا عناوين ماركداون، الإيموجي هو العنوان). باهر يريد المال والعملاء فقط، فلا تذكري أخبار تنظيمية ولا حالة النظام ولا مهام داخلية للفريق ولا مؤشرات غير مالية:\\n☀️ صباح الخير + جملة واحدة عن حال المال والعملاء\\n💰 المال: دفعات، فواتير، عروض أسعار، تحصيل — ما تحرّك وما تأخر، بالاسم والمبلغ\\n👥 العملاء: صفقات جديدة أو متعثرة وعملاء ينتظرون ردّه، بالاسم\\n🫵 عليك اليوم: ما ينتظر باهر شخصياً من مال أو عملاء فقط، مرتباً حسب الأثر على الكاش\\n🔕 إن كان held_yesterday أكبر من صفر فاختمي بسطر واحد: «كتمتُ N إشعاراً غير مالي — قل وش المكتوم إن أردت».\\n\\nالبيانات (JSON):";
  src = src.replace(BRIEF_OLD_STRUCT, NEW_STRUCT);
  if (src === pre || !src.includes("held_yesterday") || !src.includes("المال والعملاء فقط")) throw new Error("brief patch did not apply");
  cf.parameters.jsCode = src;
  w.name = NAMES.proactive;
  const settings = {}; for (const k of KEEP) if (w.settings?.[k] !== undefined) settings[k] = w.settings[k];
  return { name: NAMES.proactive, nodes: w.nodes, connections: w.connections, settings, staticData: w.staticData || undefined };
}

// ======================================================================================
// H) Generic gated copy of a workflow that pushes to the owner's WhatsApp: [Gate Text] -> Gate sub-workflow -> [Restore] -> IF send -> original send node
// ======================================================================================
function gatedCopy(live, newName, gateId, specs) {
  const w = JSON.parse(JSON.stringify(live));
  let i = 0;
  for (const s of specs) {
    const send = w.nodes.find((n) => n.name === s.send);
    if (!send) throw new Error("send node missing: " + s.send);
    const rawText = String(send.parameters.textBody || "");
    // textBody is an n8n expression "={{ … }}" (or a plain string): reduce it to a bare JS expression for the Set node
    const textExpr = rawText.startsWith("=") ? rawText.replace(/^=\s*\{\{\s*/, "").replace(/\s*\}\}\s*$/, "") : JSON.stringify(rawText);
    const [x, y] = send.position; i++;
    const prep = setNode(`Gate Text ${i}`, [x - 720, y], [["__gate_text", `={{ String(${textExpr}) }}`], ["__gate_origin", s.origin]], true);
    const call = node(`Notify Gate ${i}`, "n8n-nodes-base.executeWorkflow", 1.2, [x - 480, y], { source: "database", workflowId: { __rl: true, mode: "id", value: gateId }, workflowInputs: { mappingMode: "defineBelow", matchingColumns: [], value: { text: "={{ $json.__gate_text }}", subject: "", sender: "", origin: "={{ $json.__gate_origin }}", test: "false" }, schema: ["text", "subject", "sender", "origin", "test"].map((id) => ({ id, displayName: id, required: false, display: true, type: "string", canBeUsedToMatch: false })) }, options: { waitForSubWorkflow: true } }, { onError: "continueRegularOutput" });
    const restore = code(`Gate Restore ${i}`, [x - 240, y], `const src = $('Gate Text ${i}').all();\nconst out = $input.all();\nreturn src.map((it, k) => ({ json: { ...it.json, gate: (out[k] || out[0] || { json: {} }).json }, pairedItem: { item: k } }));`);
    const ok = ifNode(`Gate Allows ${i}`, [x - 80, y], "={{ $json.gate?.send !== false }}"); // fail-open: if the gate sub-workflow itself errors, behaviour stays as today
    w.nodes.push(prep, call, restore, ok);
    // rewire parents of the send node
    for (const [from, c] of Object.entries(w.connections)) for (const arr of Object.values(c)) for (const grp of arr) for (const t of grp || []) if (t.node === s.send) t.node = prep.name;
    w.connections[prep.name] = { main: [[{ node: call.name, type: "main", index: 0 }]] };
    w.connections[call.name] = { main: [[{ node: restore.name, type: "main", index: 0 }]] };
    w.connections[restore.name] = { main: [[{ node: ok.name, type: "main", index: 0 }]] };
    w.connections[ok.name] = { main: [[{ node: s.send, type: "main", index: 0 }], []] };
    // root cause of "Farah does not know what I replied to": most senders never wrote their message (and its WhatsApp id) to farah.messages.
    // After a gated send we log it, so a quoted reply to it can be resolved by Build Farah Context.
    const logSent = pg(`Log Sent ${i}`, `INSERT INTO farah.messages(direction,source,wa_id,body,meta) VALUES('out','proactive',$1::text,$2::text,$3::jsonb)`,
      `={{ [ $json.messages?.[0]?.id ?? null, String($('Gate Restore ${i}').first().json.__gate_text || '').slice(0, 3500), JSON.stringify({ kind: '${s.origin}', gated: true }) ] }}`, [x + 240, y + 140]);
    w.nodes.push(logSent);
    link(w.connections, s.send, logSent.name);
  }
  const settings = {}; for (const k of KEEP) if (w.settings?.[k] !== undefined) settings[k] = w.settings[k];
  return { name: newName, nodes: w.nodes, connections: w.connections, settings };
}

// ======================================================================================
// I) TEST harness (webhook with its own key). Deleted by --cleanup.
// ======================================================================================
function harness(testCredId, path, ids) {
  const nodes = [
    node("Harness In", "n8n-nodes-base.webhook", 2, [0, 0], { httpMethod: "POST", path, authentication: "headerAuth", responseMode: "responseNode", options: {} }, { webhookId: uid(), credentials: { httpHeaderAuth: { id: testCredId, name: NAMES.testCred } } }),
    code("Unpack", [240, 0], `const b = $input.first().json.body || {};\nreturn [{ json: { op: String(b.op || ''), ...(b.args || {}) } }];`),
    node("Route", "n8n-nodes-base.switch", 3.2, [480, 0], { rules: { values: ["seed", "ctx", "gate", "draft", "topics", "compact", "read", "cleanup"].map((op, k) => ({ conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, combinator: "and", conditions: [{ leftValue: "={{ $json.op }}", rightValue: op, operator: { type: "string", operation: "equals" } }] }, renameOutput: true, outputKey: op })) }, options: {} }),
    pg("Seed", `INSERT INTO farah.messages(ts,direction,source,wa_id,ref_wa_id,body,meta)
SELECT x.ts::timestamptz, x.direction, x.source, x.wa_id, x.ref, x.body, coalesce(x.meta::jsonb,'{}'::jsonb) || '{"test":true}'::jsonb
FROM jsonb_to_recordset($1::jsonb) AS x(ts text,direction text,source text,wa_id text,ref text,body text,meta text) RETURNING id, wa_id`, "={{ [ JSON.stringify($json.rows || []) ] }}", [760, -600]),
    execWf("Run Context Builder", [760, -420], ids.ctx),
    execWf("Run Gate", [760, -240], ids.gate),
    execWf("Run Draft", [760, -60], ids.draft),
    execWf("Run Topics", [760, 120], ids.topics),
    execWf("Run Compaction", [760, 300], ids.compact),
    pg("Read Back", `SELECT 'topics' AS what, json_agg(t) AS data FROM (SELECT subject, content, source, active FROM farah.memories WHERE kind='topic' AND source LIKE 'topic:TEST%' ORDER BY id) t
UNION ALL SELECT 'gate', json_agg(g) FROM (SELECT body, meta FROM farah.messages WHERE source='gate' AND meta->>'test'='true' ORDER BY id DESC LIMIT 20) g
UNION ALL SELECT 'summary', json_agg(s) FROM (SELECT day::text, summary FROM farah.daily_summaries WHERE day='2000-01-01') s
UNION ALL SELECT 'drafts', json_agg(d) FROM (SELECT id, kind, title, left(detail,1200) AS detail, status FROM farah.pending WHERE kind='reply_draft' AND detail LIKE '%TEST-WEB%' ORDER BY id DESC LIMIT 5) d
UNION ALL SELECT 'v2_inbound', json_agg(m) FROM (SELECT id, left(body,160) AS body FROM farah.messages WHERE body LIKE '%[TEST-V2]%' ORDER BY id DESC LIMIT 10) m`, null, [760, 480]),
    pg("Cleanup", `WITH a AS (DELETE FROM farah.messages WHERE meta->>'test'='true' OR body LIKE '%[TEST-V2]%' OR wa_id LIKE 'TEST-%' RETURNING 1),
 b AS (DELETE FROM farah.memories WHERE source LIKE 'topic:TEST%' OR source LIKE 'test:%' RETURNING 1),
 c AS (DELETE FROM farah.pending WHERE detail LIKE '%TEST-WEB%' OR title LIKE '%[TEST-V2]%' RETURNING 1),
 d AS (DELETE FROM farah.daily_summaries WHERE day='2000-01-01' RETURNING 1)
SELECT (SELECT count(*) FROM a) AS messages, (SELECT count(*) FROM b) AS memories, (SELECT count(*) FROM c) AS pending, (SELECT count(*) FROM d) AS summaries`, null, [760, 660]),
    node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, [1100, 0], { respondWith: "allIncomingItems", options: { responseCode: 200 } }),
  ];
  const c = {};
  link(c, "Harness In", "Unpack"); link(c, "Unpack", "Route");
  ["Seed", "Run Context Builder", "Run Gate", "Run Draft", "Run Topics", "Run Compaction", "Read Back", "Cleanup"].forEach((n, k) => { link(c, "Route", n, k); link(c, n, "Respond"); });
  return { name: NAMES.harness, nodes, connections: c, settings: { executionOrder: "v1", timezone: "Asia/Riyadh", saveDataSuccessExecution: "all", saveDataErrorExecution: "all" } };
}

// ======================================================================================
// main
// ======================================================================================
const log = [];
const wfs = await listAll("/workflows");
const creds = (await api("/credentials?limit=250")).body?.data || [];
const out = { workflows: {}, credentials: {} };
const wfByName = (n) => wfs.find((w) => w.name === n);
const credByName = (n) => creds.find((c) => c.name === n);
const liveByName = (re) => wfs.find((w) => re.test(w.name) && !/v2|GATED|TEST/.test(w.name));
async function full(id) { const r = await api("/workflows/" + id); if (!r.ok) throw new Error("get " + id + " " + r.status); return r.body; }

if (CLEANUP) {
  for (const n of [NAMES.harness]) { const ex = wfByName(n); if (ex) { if (ex.active) await api(`/workflows/${ex.id}/deactivate`, { method: "POST" }); const r = await api("/workflows/" + ex.id, { method: "DELETE" }); log.push(`- workflow deleted: ${n} (${r.status})`); } else log.push(`= not found: ${n}`); }
  for (const n of [NAMES.testCred]) { const ex = credByName(n); if (ex) { const r = await api("/credentials/" + ex.id, { method: "DELETE" }); log.push(`- credential deleted: ${n} (${r.status})`); } }
  console.log(log.join("\n")); process.exit(0);
}

async function ensureCred(name, type, data, label) {
  const ex = credByName(name);
  if (ex) { log.push(`= credential exists: ${name} (${ex.id})`); out.credentials[label] = ex.id; return ex.id; }
  log.push(`+ credential: ${name} [${type}]`);
  if (!APPLY) return "<new>";
  const r = await api("/credentials", { method: "POST", body: JSON.stringify({ name, type, data }) });
  if (!r.ok) { console.log("credential failed", name, r.status, JSON.stringify(r.body).slice(0, 300)); process.exit(1); }
  out.credentials[label] = r.body.id; return r.body.id;
}
async function ensureWf(def, label) {
  const ex = wfByName(def.name);
  if (ex && REBUILD && !ex.active && Object.values(NAMES).includes(def.name)) {
    log.push(`~ workflow rebuilt in place (own copy, inactive): ${def.name} (${ex.id})`);
    if (APPLY) { const r = await api("/workflows/" + ex.id, { method: "PUT", body: JSON.stringify({ name: def.name, nodes: def.nodes, connections: def.connections, settings: def.settings }) }); if (!r.ok) { console.log("rebuild failed", def.name, r.status, JSON.stringify(r.body).slice(0, 400)); process.exit(1); } }
    out.workflows[label] = ex.id; return ex.id;
  }
  if (ex) { log.push(`= workflow exists (not touched): ${def.name} (${ex.id}) active=${ex.active}`); out.workflows[label] = ex.id; return ex.id; }
  log.push(`+ workflow (inactive): ${def.name} — ${def.nodes.length} nodes`);
  if (!APPLY) return "<new>";
  const r = await api("/workflows", { method: "POST", body: JSON.stringify({ name: def.name, nodes: def.nodes, connections: def.connections, settings: def.settings, ...(def.staticData ? { staticData: def.staticData } : {}) }) });
  if (!r.ok) { console.log("workflow failed", def.name, r.status, JSON.stringify(r.body).slice(0, 600)); process.exit(1); }
  out.workflows[label] = r.body.id; return r.body.id;
}

const ids = {};
ids.gate = await ensureWf(gateWorkflow(), "gate");
ids.ctx = await ensureWf(ctxWorkflow(), "ctx");
ids.topics = await ensureWf(topicsWorkflow(), "topics");
ids.compact = await ensureWf(compactWorkflow(), "compact");
ids.draft = await ensureWf(draftWorkflow(), "draft");

const liveFarah = liveByName(/فرح — رئيسة المكتب التنفيذي/);
const liveProactive = liveByName(/فرح — متابعة استباقية/);
const liveCash = liveByName(/Cash & Execution Watchdog/);
const liveErr = wfs.find((w) => w.name === "BP-Error-Handler");
const liveNews = liveByName(/رادار الجهات الحكومية/);
const farahCred = await ensureCred(NAMES.farahCred, "httpHeaderAuth", { name: "X-BP-Farah-V2-Key", value: hex(32) }, "farahV2");
if (liveFarah) ids.farah = await ensureWf(farahV2(await full(liveFarah.id), ids, farahCred), "farah");
if (liveProactive) ids.proactive = await ensureWf(proactiveV2(await full(liveProactive.id)), "proactive");
if (liveCash) ids.cash = await ensureWf(gatedCopy(await full(liveCash.id), NAMES.cash, ids.gate, [{ send: "WhatsApp Baher Focus Alert", origin: "watchdog" }]), "cash");
if (liveErr) ids.errors = await ensureWf(gatedCopy(await full(liveErr.id), NAMES.errors, ids.gate, [{ send: "WA Owner - Error Alert", origin: "error" }]), "errors");
if (liveNews) ids.news = await ensureWf(gatedCopy(await full(liveNews.id), NAMES.news, ids.gate, [{ send: "WhatsApp Baher (urgent)", origin: "news" }, { send: "WhatsApp Baher (digest)", origin: "news" }]), "news");

if (TEST) {
  const testKey = hex(32), path = "farah-v2-harness-" + hex(8);
  const testCred = await ensureCred(NAMES.testCred, "httpHeaderAuth", { name: "X-BP-Test-Key", value: testKey }, "test");
  await ensureWf(harness(testCred, path, ids), "harness");
  if (APPLY && KEY_FILE) fs.writeFileSync(KEY_FILE, JSON.stringify({ harness_path: "/webhook/" + path, harness_key: testKey, harness_wf: out.workflows.harness, farah_v2_wf: ids.farah, ids }), { mode: 0o600 });
  log.push("  (test key written to --key-file only; not printed)");
}

console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN (no writes)");
log.forEach((l) => console.log(l));
if (APPLY) {
  console.log("IDs:", JSON.stringify(out));
  const v = await listAll("/workflows");
  console.log("active flags (all must be false):", JSON.stringify(Object.fromEntries(Object.entries(out.workflows).map(([k, id]) => [k, v.find((w) => w.id === id)?.active]))));
}
