// Farah on Azure n8n — persistent memory layer (Postgres schema `farah` in bp-n8n-pg).
// Adds: 8 memory tools, inbound/outbound message logging, reply-context, numbered proactive digests, memory rules.
// Dry-run by default; `--apply` writes (backs up first). Needs the Postgres credential "Farah Memory" (see farah-cred.mjs).
// Usage: N8N_AZURE_API_KEY=… node ops/azure-n8n/farah-memory.mjs [--apply]
import fs from "fs";
import crypto from "crypto";

const AZ = (process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io") + "/api/v1";
const KEY = process.env.N8N_AZURE_API_KEY || process.env.AZ_KEY;
if (!KEY) { console.log("Set N8N_AZURE_API_KEY"); process.exit(1); }
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const APPLY = process.argv.includes("--apply");
const CRED = { postgres: { id: "0", name: "Farah Memory" } };
const KEEP = ["executionOrder", "saveManualExecutions", "saveExecutionProgress", "saveDataErrorExecution", "saveDataSuccessExecution", "executionTimeout", "errorWorkflow", "timezone", "callerPolicy"];
const uid = () => crypto.randomUUID();
async function list() {
  let all = [], cur = "";
  do {
    const r = await fetch(`${AZ}/workflows?limit=100${cur ? `&cursor=${cur}` : ""}`, { headers: H });
    if (!r.ok) { console.log("HTTP", r.status); process.exit(1); }
    const j = await r.json(); all.push(...j.data); cur = j.nextCursor || "";
  } while (cur);
  return all;
}
async function put(w) {
  const settings = {};
  for (const k of KEEP) if (w.settings?.[k] !== undefined) settings[k] = w.settings[k];
  const r = await fetch(`${AZ}/workflows/${w.id}`, { method: "PUT", headers: H, body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }) });
  return r.ok ? "ok" : `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
}
const PG = (name, query, repl, desc, x, y, tool) => ({
  id: uid(), name, type: tool ? "n8n-nodes-base.postgresTool" : "n8n-nodes-base.postgres", typeVersion: 2.5, position: [x, y],
  parameters: { operation: "executeQuery", query, options: repl ? { queryReplacement: repl } : {}, ...(tool ? { descriptionType: "manual", toolDescription: desc } : {}) },
  credentials: { ...CRED }, ...(tool ? {} : { onError: "continueRegularOutput" })
});
const TOOLS = [
  PG("Recent Conversation", `SELECT to_char(ts AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS t, direction, source, wa_id, left(body,700) AS body FROM farah.messages ORDER BY ts DESC LIMIT 30`, null, "آخر 30 رسالة بين فرح وباهر مرتبة من الأحدث، بما فيها تحديثات فرح الاستباقية. استعمليها أول كل جولة.", 0, 900, true),
  PG("Find Message", `SELECT m.id, m.direction, m.source, left(m.body,1500) AS body, (SELECT json_agg(json_build_object('no',p.digest_no,'id',p.id,'kind',p.kind,'title',p.title,'status',p.status)) FROM farah.pending p WHERE p.msg_id=m.id) AS items FROM farah.messages m WHERE m.wa_id = $1 LIMIT 1`, "={{ [ $fromAI('wa_id','معرّف رسالة واتساب المقتبسة، يبدأ بـ wamid') ] }}", "يجلب رسالة محفوظة بمعرّف واتساب (الرسالة التي ردّ عليها باهر بالاقتباس) مع البنود المرقّمة فيها.", 220, 900, true),
  PG("Open Pending", `SELECT id, kind, title, left(detail,500) AS detail, source, digest_no, msg_id, to_char(created_at AT TIME ZONE 'Asia/Riyadh','MM-DD HH24:MI') AS created FROM farah.pending WHERE status='open' ORDER BY created_at DESC LIMIT 25`, null, "كل ما ينتظر قرار باهر الآن (موافقات وردود وقرارات). اقرئيها أول كل جولة.", 440, 900, true),
  PG("Resolve Pending", `UPDATE farah.pending SET status=$2, decided_at=now(), decision_note=$3 WHERE id=$1::bigint AND status='open' RETURNING id, title, status`, "={{ [ $fromAI('id','رقم البند id من Open Pending','number'), $fromAI('status','approved أو rejected أو snoozed أو done','string'), $fromAI('note','ملاحظة باهر الحرفية أو فارغ','string','') ] }}", "يسجّل قرار باهر على بند مفتوح بعد تنفيذه.", 660, 900, true),
  PG("Create Pending", `INSERT INTO farah.pending(kind,title,detail,source,source_ref) VALUES($1,$2,$3,'farah',md5($2)) ON CONFLICT DO NOTHING RETURNING id`, "={{ [ $fromAI('kind','approval أو reply أو decision أو task','string'), $fromAI('title','عنوان قصير','string'), $fromAI('detail','التفاصيل التي يحتاجها باهر ليقرر','string','') ] }}", "ينشئ بنداً ينتظر قرار باهر. اذكري رقمه له.", 880, 900, true),
  PG("Save Memory", `INSERT INTO farah.memories(kind,subject,content,source) VALUES($1,$2,$3,'farah') RETURNING id`, "={{ [ $fromAI('kind','person أو company أو preference أو decision أو fact أو rule','string'), $fromAI('subject','الاسم أو الموضوع','string'), $fromAI('content','ما يجب تذكره، بلا أسرار أو كلمات مرور','string') ] }}", "يحفظ في الذاكرة الدائمة شخصاً أو عميلاً أو تفضيلاً أو قراراً.", 1100, 900, true),
  PG("Search Memory", `SELECT id, kind, subject, left(content,600) AS content, to_char(updated_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS d FROM farah.memories WHERE active AND (tsv @@ plainto_tsquery('simple',$1) OR subject ILIKE '%'||$1||'%' OR content ILIKE '%'||$1||'%') ORDER BY updated_at DESC LIMIT 8`, "={{ [ $fromAI('q','اسم أو كلمة أو رقم للبحث عنه في الذاكرة') ] }}", "يبحث في الذاكرة الدائمة عن شخص أو عميل أو قرار سابق.", 1320, 900, true),
  PG("Recent Summaries", `SELECT day, summary FROM farah.daily_summaries ORDER BY day DESC LIMIT 7`, null, "ملخصات آخر 7 أيام عند الحاجة لسياق أقدم.", 1540, 900, true)
];
const RULES = `

قاعدة الذاكرة والربط (تعلو على ما بعدها — قرار المالك 2026-10-12):
عندك ذاكرة دائمة في قاعدة بيانات، وهي ما يجعلك تفهمين باهر دون أن يكرّر نفسه.
١) في كل رسالة تبدئين بـ Recent Conversation (آخر المحادثة بما فيها تحديثاتك الاستباقية) وOpen Pending (ما ينتظر قراره) قبل أي ردّ أو سؤال.
٢) ممنوع أن تسألي «على ماذا؟» أو «أي مهمة؟» قبل البحث. إن كتب «موافق/يس/لا/أجّل/نفّذ/أرسلي» فاربطيها بالأقرب من: الرسالة المقتبسة (معرّفها يصلك في الرسالة، استعملي Find Message)، ثم الرقم الذي ذكره («موافق ٢» = digest_no 2 في آخر تحديث لك)، ثم آخر طلب موافقة طلبتِه أنتِ، ثم Open Pending. إن وُجد بند واحد مناسب نفّذيه الآن ثم سجّلي القرار بـ Resolve Pending. وإن تعدد المحتمل اعرضيها مرقّمة بسطر لكل واحد واسأليه أيها.
٣) كل ما تنتظرين فيه قراراً من باهر سجّليه بـ Create Pending واذكري رقمه له.
٤) Save Memory عند «تذكّري» أو حين يتخذ قراراً دائماً أو يذكر تفضيلاً أو شخصاً/عميلاً مهماً (kind: person|company|preference|decision|fact|rule). وSearch Memory كلما ذكر اسماً أو عميلاً أو موضوعاً قد يكون محفوظاً. ولا تخزّني أسراراً أو كلمات مرور أو أرقام بطاقات.
٥) Recent Summaries لسياق أيام سابقة عند الحاجة.`;
const NUMBER_CODE = String.raw`const t = String($json.text || '');
const blocks = t.split('\n\n');
const circ = ['①','②','③','④','⑤','⑥','⑦','⑧'];
const kinds = { '🟠': 'task', '📧': 'reply', '🟢': 'deal' };
const items = []; let n = 0;
const out = blocks.map(b => {
  const k = kinds[[...b][0]];
  if (!k || n >= circ.length) return b;
  const title = b.split('\n')[0].replace(/^\S+\s*/, '').slice(0, 140);
  items.push({ n: n + 1, kind: k, title, detail: b.slice(0, 900) });
  return circ[n++] + ' ' + b;
});
let text = out.join('\n\n');
if (items.length) text = text.replace('ردّ عليّ هنا وأكمل معك.', 'ردّ برقم البند: «موافق ①» أو «لا ②»، أو اكتب ما تريد.');
return [{ json: { text, items } }];`;

const wfs = await list();
const farah = wfs.find(w => /فرح — رئيسة المكتب التنفيذي/.test(w.name));
const pro = wfs.find(w => /فرح — متابعة استباقية/.test(w.name));
if (!farah) { console.log("Farah workflow not found"); process.exit(1); }
const log = [];
const has = (w, n) => w.nodes.some(x => x.name === n);
const add = (w, node, why) => { if (has(w, node.name)) return; w.nodes.push(node); log.push("+ " + w.name.slice(0, 30) + " :: " + node.name + (why ? " (" + why + ")" : "")); };
const link = (w, from, to, type = "main", out = 0) => {
  w.connections[from] = w.connections[from] || {};
  const c = (w.connections[from][type] = w.connections[from][type] || []);
  while (c.length <= out) c.push([]);
  if (!c[out].some(t => t.node === to)) c[out].push({ node: to, type, index: 0 });
};
const AG = "Muin — Personal Assistant";
const agent = farah.nodes.find(n => n.name === AG);
if (!agent) { console.log("agent node not found"); process.exit(1); }
const norm = farah.nodes.find(n => n.name === "Normalize");
if (norm) { const a = norm.parameters.assignments.assignments; if (!a.some(x => x.name === "replyToId")) { a.push({ id: "f5", name: "replyToId", value: "={{ $json.messages?.[0]?.context?.id || '' }}", type: "string" }); log.push("~ Normalize: replyToId"); } }
if (!String(agent.parameters.text).includes("replyToId")) { agent.parameters.text += "{{ $json.replyToId ? '\\n\\n[هذه الرسالة ردٌّ على رسالة سابقة، معرّفها: ' + $json.replyToId + ' — استعملي Find Message]' : '' }}"; log.push("~ agent prompt: reply context"); }
if (!String(agent.parameters.options.systemMessage).includes("قاعدة الذاكرة والربط")) { agent.parameters.options.systemMessage += RULES; log.push("~ agent system message: memory rules"); }
const mem = farah.nodes.find(n => n.name === "Conversation Memory");
if (mem && mem.parameters.contextWindowLength < 10) { mem.parameters.contextWindowLength = 10; log.push("~ Conversation Memory window -> 10"); }
for (const t of TOOLS) { add(farah, t, "tool"); link(farah, t.name, AG, "ai_tool"); }
add(farah, PG("Log Inbound", `INSERT INTO farah.messages(direction,source,wa_id,ref_wa_id,body,meta) VALUES('in','conversation',$1,$2,$3,$4::jsonb)`, "={{ [ $json.messages?.[0]?.id ?? null, $json.messages?.[0]?.context?.id ?? null, String($json.userText || ('[' + $json.msgType + ']')).slice(0,3500), JSON.stringify({type:$json.msgType,from:$json.fromNumber}) ] }}", null, -300, -200, false));
link(farah, "Owner Only (Baher)", "Log Inbound", "main", 0);
add(farah, PG("Log Outbound", `INSERT INTO farah.messages(direction,source,wa_id,body,meta) VALUES('out','conversation',$1,$2,'{}'::jsonb)`, "={{ [ $json.messages?.[0]?.id ?? null, String($('Muin — Personal Assistant').first().json.output ?? '').slice(0,3500) ] }}", null, 1800, -200, false));
link(farah, "Reply to Baher", "Log Outbound", "main", 0);
if (pro) {
  add(pro, { id: uid(), name: "Number Items", type: "n8n-nodes-base.code", typeVersion: 2, position: [1330, 0], parameters: { mode: "runOnceForAllItems", language: "javaScript", jsCode: NUMBER_CODE } });
  add(pro, PG("Log Digest", `WITH m AS (INSERT INTO farah.messages(direction,source,wa_id,body,meta) VALUES('out','proactive',$1,$2,'{}'::jsonb) RETURNING id) INSERT INTO farah.pending(kind,title,detail,source,source_ref,msg_id,digest_no) SELECT x.kind, x.title, x.detail, 'digest', md5(x.title), m.id, x.n FROM m, jsonb_to_recordset($3::jsonb) AS x(kind text,title text,detail text,n int) ON CONFLICT DO NOTHING RETURNING id`, "={{ [ $json.messages?.[0]?.id ?? null, (() => { try { return $('Number Items').first().json.text } catch (e) { try { return $('Write Morning Brief').first().json.text } catch (e2) { return '' } } })(), JSON.stringify((() => { try { return $('Number Items').first().json.items || [] } catch (e) { return [] } })()) ] }}", null, 1700, 144, false));
  if (has(pro, "Number Items") && !pro.connections["Number Items"]) {
    pro.connections["Decide What To Tell Baher"] = { main: [[{ node: "Number Items", type: "main", index: 0 }]] };
    pro.connections["Number Items"] = { main: [[{ node: "WhatsApp to Baher", type: "main", index: 0 }]] };
    log.push("~ proactive: Decide -> Number Items -> WhatsApp");
  }
  link(pro, "WhatsApp to Baher", "Log Digest", "main", 0);
} else log.push("! proactive workflow not found (skipped)");
console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN (no writes)");
for (const l of log) console.log(l);
if (APPLY) {
  fs.writeFileSync(`backup-memory-${Date.now()}.json`, JSON.stringify({ farah: wfs.find(w => w.id === farah.id), pro }));
  console.log("Farah:", await put(farah));
  if (pro) console.log("Proactive:", await put(pro));
}
