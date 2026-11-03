// Farah on Azure n8n — expanded tools (email via guarded sub-workflow, calendar, Drive/Sheets/Docs/Slides).
// Dry-run by default. `--apply` writes (backs up first). Reads N8N_AZURE_API_KEY (or N8N_AZURE_KEY_FILE).
// Never activates anything. Safe to re-run (idempotent by node name).
import fs from "fs";
import crypto from "crypto";

const BASE = process.env.N8N_AZURE_URL || "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
const KEY = (process.env.N8N_AZURE_API_KEY || (process.env.N8N_AZURE_KEY_FILE ? fs.readFileSync(process.env.N8N_AZURE_KEY_FILE, "utf8") : "")).trim();
if (!KEY) { console.log("Set N8N_AZURE_API_KEY (or N8N_AZURE_KEY_FILE)"); process.exit(1); }
const API = BASE + "/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const APPLY = process.argv.includes("--apply");
const uid = () => crypto.randomUUID();
const KEEP = ["executionOrder", "saveManualExecutions", "saveExecutionProgress", "saveDataErrorExecution", "saveDataSuccessExecution", "executionTimeout", "errorWorkflow", "timezone", "callerPolicy"];

async function api(path, opt = {}) {
  const r = await fetch(API + path, { headers: H, ...opt });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { ok: r.ok, status: r.status, body: j };
}
async function listWf() {
  let all = [], cur = "";
  do {
    const r = await api(`/workflows?limit=100${cur ? `&cursor=${cur}` : ""}`);
    if (!r.ok) throw new Error("list " + r.status);
    all.push(...r.body.data); cur = r.body.nextCursor || "";
  } while (cur);
  return all;
}
const pickSettings = (s) => { const o = {}; for (const k of KEEP) if (s?.[k] !== undefined) o[k] = s[k]; return o; };

const CRED = {
  gmail: { gmailOAuth2: { id: "0", name: "Gmail OAuth2 API" } },
  cal: { googleCalendarOAuth2Api: { id: "0", name: "Google Calendar — Business Partner — Production" } },
};
const CAL = { __rl: true, mode: "list", value: "primary", cachedResultName: "Primary" };
const AI = (k, d, t = "string", def) => `$fromAI('${k}', '${d.replace(/'/g, "")}', '${t}'${def !== undefined ? `, ${typeof def === "string" ? `'${def}'` : def}` : ""})`;

// ---------- 1) guarded email sub-workflow ----------
const SUB_NAME = "🛡️ فرح — إرسال بريد آمن (Safe Send)";
const GUARD = String.raw`const j = $input.first().json;
const to = String(j.to || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
const text = String(j.subject || '') + '\n' + String(j.body || '');
const approved = String(j.approved_by_baher || '').toLowerCase() === 'true';
const mode = String(j.mode || 'new');
const reasons = [];
if (mode !== 'reply' && !to.length) reasons.push('لا يوجد مستلم');
const bad = to.filter(a => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
if (bad.length) reasons.push('عنوان غير صالح: ' + bad.join(', '));
if (mode === 'reply' && !j.message_id) reasons.push('message_id مطلوب للردّ');
if (!String(j.body || '').trim()) reasons.push('نص الرسالة فارغ');
if (!approved) {
  if (to.length > 5) reasons.push('أكثر من 5 مستلمين يحتاج موافقة باهر');
  if (/(\d[\d,.،]*\s*(ريال|SAR|﷼|دولار|USD|\$))|خصم|تخفيض|نضمن|ضمان|عرض سعر|\bprice\b|\bdiscount\b|\bguarantee/i.test(text)) reasons.push('فيها سعر أو خصم أو ضمان — يحتاج موافقة باهر');
  if (/(وزارة|قوى|مقيم|زاتكا|الزكاة|التأمينات|GOSI|أبشر|مدد)/.test(text) && /(سنقدّم|سنقدم|نلتزم|نتعهد|نضمن)/.test(text)) reasons.push('التزام حكومي — يحتاج موافقة باهر');
}
return [{ json: { ...j, to: to.join(', '), blocked: reasons.length > 0, reasons: reasons.join(' | ') } }];`;

function subWorkflow() {
  const n = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: uid(), name, type, typeVersion, position, parameters, ...extra });
  const ifNode = (name, position, left, op = { type: "boolean", operation: "true" }, right = true) => n(name, "n8n-nodes-base.if", 2.2, position, {
    conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, combinator: "and", conditions: [{ id: uid(), leftValue: left, rightValue: right, operator: op }] }, options: {} });
  const nodes = [
    n("Trigger", "n8n-nodes-base.executeWorkflowTrigger", 1.2, [0, 0], { inputSource: "workflowInputs", workflowInputs: { values: ["mode", "to", "subject", "body", "message_id", "approved_by_baher"].map(name => ({ name, type: "string" })) } }),
    n("Guard", "n8n-nodes-base.code", 2, [240, 0], { mode: "runOnceForAllItems", language: "javaScript", jsCode: GUARD }),
    ifNode("Blocked?", [480, 0], "={{ $json.blocked }}"),
    n("Blocked Result", "n8n-nodes-base.set", 3.4, [720, -120], { mode: "manual", assignments: { assignments: [
      { id: uid(), name: "sent", value: false, type: "boolean" },
      { id: uid(), name: "reason", value: "={{ $json.reasons }}", type: "string" },
      { id: uid(), name: "next_step", value: "لم يُرسل شيء. اعرضي الرسالة كاملة على باهر وسجّلي بنداً بـ Create Pending، فإن وافق صراحةً أعيدي الاستدعاء مع approved_by_baher=true.", type: "string" }] }, includeOtherFields: false, options: {} }),
    ifNode("Is Reply?", [720, 120], "={{ $json.mode }}", { type: "string", operation: "equals" }, "reply"),
    n("Send Reply", "n8n-nodes-base.gmail", 2.2, [960, 40], { resource: "message", operation: "reply", messageId: "={{ $json.message_id }}", emailType: "text", message: "={{ $json.body }}", options: { appendAttribution: false } }, { credentials: CRED.gmail }),
    n("Send New", "n8n-nodes-base.gmail", 2.2, [960, 220], { resource: "message", operation: "send", sendTo: "={{ $json.to }}", subject: "={{ $json.subject }}", emailType: "text", message: "={{ $json.body }}", options: { appendAttribution: false } }, { credentials: CRED.gmail }),
    n("Sent Result", "n8n-nodes-base.set", 3.4, [1200, 130], { mode: "manual", assignments: { assignments: [
      { id: uid(), name: "sent", value: true, type: "boolean" },
      { id: uid(), name: "id", value: "={{ $json.id }}", type: "string" },
      { id: uid(), name: "threadId", value: "={{ $json.threadId }}", type: "string" }] }, includeOtherFields: false, options: {} }),
  ];
  const c = (from, to, idx = 0) => ({ node: to, type: "main", index: idx });
  const connections = {
    Trigger: { main: [[c("", "Guard")]] }, Guard: { main: [[c("", "Blocked?")]] },
    "Blocked?": { main: [[c("", "Blocked Result")], [c("", "Is Reply?")]] },
    "Is Reply?": { main: [[c("", "Send Reply")], [c("", "Send New")]] },
    "Send Reply": { main: [[c("", "Sent Result")]] }, "Send New": { main: [[c("", "Sent Result")]] },
  };
  return { name: SUB_NAME, nodes, connections, settings: { executionOrder: "v1" } };
}

// ---------- 2) Farah tool nodes ----------
let X = 0; const nextPos = () => [(X += 220), 1250];
const toolDesc = (s) => s;
function calUpdate() {
  return { id: uid(), name: "Update Calendar Event", type: "n8n-nodes-base.googleCalendarTool", typeVersion: 1.3, position: nextPos(), credentials: CRED.cal, parameters: {
    resource: "event", operation: "update", calendar: CAL, eventId: `={{ ${AI("event_id", "معرّف الحدث id من نتيجة List Calendar Events")} }}`, useDefaultReminders: true,
    updateFields: {
      summary: `={{ ${AI("summary", "العنوان الجديد أو فارغ إن لم يتغير", "string", "")} || undefined }}`,
      description: `={{ ${AI("description", "الوصف الجديد أو فارغ", "string", "")} || undefined }}`,
      location: `={{ ${AI("location", "المكان الجديد أو فارغ", "string", "")} || undefined }}`,
      start: `={{ ${AI("start", "بداية جديدة ISO 8601 بتوقيت الرياض أو فارغ", "string", "")} || undefined }}`,
      end: `={{ ${AI("end", "نهاية جديدة ISO 8601 أو فارغ", "string", "")} || undefined }}`,
      attendees: `={{ String(${AI("attendees", "إيميلات مدعوّين جدد مفصولة بفاصلة كما وردت حرفياً، أو فارغ. ممنوع اختراع إيميل", "string", "")} || '').split(/[,;\\s،]+/).map(s => s.trim().toLowerCase()).filter(s => /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(s)) }}`,
      sendUpdates: "all" },
    toolDescription: toolDesc("يعدّل موعداً موجوداً في تقويم الشركة (وقت أو عنوان أو مكان أو إضافة مدعوّين) ويرسل التحديث للمدعوّين. احصلي على event_id من List Calendar Events أولاً ولا تخمّنيه.") } };
}
function calDelete() {
  return { id: uid(), name: "Delete Calendar Event", type: "n8n-nodes-base.googleCalendarTool", typeVersion: 1.3, position: nextPos(), credentials: CRED.cal, parameters: {
    resource: "event", operation: "delete", calendar: CAL, eventId: `={{ ${AI("event_id", "معرّف الحدث id من List Calendar Events")} }}`, options: { sendUpdates: "all" },
    toolDescription: toolDesc("يحذف موعداً من التقويم ويُخطر المدعوّين. إن كان فيه مدعوّون من خارج الشركة فاسألي باهر أولاً (Create Pending).") } };
}
function calList() {
  return { id: uid(), name: "List Calendar Events", type: "n8n-nodes-base.googleCalendarTool", typeVersion: 1.3, position: nextPos(), credentials: CRED.cal, parameters: {
    resource: "event", operation: "getAll", calendar: CAL, returnAll: false, limit: `={{ ${AI("limit", "أقصى عدد أحداث", "number", 20)} }}`,
    timeMin: `={{ ${AI("from", "بداية المدى ISO 8601 بتوقيت الرياض")} }}`, timeMax: `={{ ${AI("to", "نهاية المدى ISO 8601")} }}`, options: { singleEvents: true, orderBy: "startTime" },
    toolDescription: toolDesc("يسرد أحداث تقويم الشركة في مدى زمني، مع id وhtmlLink والمدعوّين. استعمليه قبل أي تعديل أو حذف.") } };
}
function ht(name, desc, method, url, cred, credName, body) {
  return { id: uid(), name, type: "n8n-nodes-base.httpRequestTool", typeVersion: 4.5, position: nextPos(), credentials: { [cred]: { id: "0", name: credName } }, parameters: {
    toolDescription: desc, method, url, authentication: "predefinedCredentialType", nodeCredentialType: cred,
    ...(body ? { sendBody: true, specifyBody: "json", jsonBody: body } : {}),
    options: { response: { response: { neverError: true } }, timeout: 30000 } } };
}
const DR = ["googleDriveOAuth2Api", "Google Drive OAuth2 API"], SH = ["googleSheetsOAuth2Api", "Google Sheets OAuth2 API"], DC = ["googleDocsOAuth2Api", "Google Docs OAuth2 API"], SL = ["googleSlidesOAuth2Api", "Google Slides OAuth2 API"];
const G = "https://www.googleapis.com/drive/v3/files";
const enc = (e) => `{{ encodeURIComponent(${e}) }}`;
function googleTools() {
  return [
    ht("Drive Search", "يبحث في Google Drive. المدخل q بصيغة Drive، مثل: name contains 'عقد' and trashed=false (أو mimeType='application/vnd.google-apps.spreadsheet'). يعيد id واسم الملف ونوعه والرابط والمجلدات الأب.", "GET",
      `=${G}?pageSize=25&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink,parents,modifiedTime)&q=${enc(AI("q", "استعلام Drive"))}`, ...DR),
    ht("Drive Create Folder", "ينشئ مجلداً في Drive (اختيارياً داخل مجلد أب).", "POST", `=${G}?supportsAllDrives=true`, ...DR,
      `={{ JSON.stringify({ name: ${AI("name", "اسم المجلد")}, mimeType: 'application/vnd.google-apps.folder', parents: ${AI("parent_id", "معرّف المجلد الأب أو فارغ", "string", "")} ? [${AI("parent_id", "معرّف المجلد الأب أو فارغ", "string", "")}] : undefined }) }}`),
    ht("Drive Move File", "ينقل ملفاً إلى مجلد آخر. أعطي add_parent (المجلد الجديد)، وremove_parent (المجلد الحالي من نتيجة Drive Search).", "PATCH",
      `=${G}/{{ ${AI("file_id", "معرّف الملف")} }}?supportsAllDrives=true&fields=id,name,parents&addParents={{ ${AI("add_parent", "معرّف المجلد الجديد")} }}&removeParents={{ ${AI("remove_parent", "معرّف المجلد الحالي أو فارغ", "string", "")} }}`, ...DR, `={{ JSON.stringify({}) }}`),
    ht("Drive Trash File", "ينقل ملفاً أو مجلداً إلى سلة المحذوفات (يمكن استرجاعه). الحذف النهائي ممنوع. اسألي باهر قبل حذف شيء لم يطلبه صراحةً.", "PATCH",
      `=${G}/{{ ${AI("file_id", "معرّف الملف")} }}?supportsAllDrives=true&fields=id,name,trashed`, ...DR, `={{ JSON.stringify({ trashed: true }) }}`),
    ht("Drive Read Text", "يقرأ نص مستند Google Docs أو عرض Slides (mime=text/plain) أو جدول (mime=text/csv). لا يعمل مع ملفات PDF أو صور.", "GET",
      `=${G}/{{ ${AI("file_id", "معرّف الملف")} }}/export?mimeType={{ ${AI("mime", "text/plain للمستند والعرض، text/csv للجدول", "string", "text/plain")} }}`, ...DR),
    ht("Sheets Create", "ينشئ جدول Google Sheets جديداً بعنوان. يعيد spreadsheetId والرابط spreadsheetUrl.", "POST", "=https://sheets.googleapis.com/v4/spreadsheets", ...SH,
      `={{ JSON.stringify({ properties: { title: ${AI("title", "عنوان الجدول")} } }) }}`),
    ht("Sheets Read Range", "يقرأ نطاقاً من جدول. spreadsheet_id من رابط الجدول، وrange بصيغة A1 مثل Sheet1!A1:F50.", "GET",
      `=https://sheets.googleapis.com/v4/spreadsheets/{{ ${AI("spreadsheet_id", "معرّف الجدول")} }}/values/${enc(AI("range", "النطاق بصيغة A1"))}`, ...SH),
    ht("Sheets Write Range", "يكتب قيماً في نطاق (يستبدل ما فيه). values مصفوفة صفوف مثل [[\"اسم\",\"رقم\"],[\"أ\",1]]. الصيغ تبدأ بـ =.", "PUT",
      `=https://sheets.googleapis.com/v4/spreadsheets/{{ ${AI("spreadsheet_id", "معرّف الجدول")} }}/values/${enc(AI("range", "النطاق بصيغة A1"))}?valueInputOption=USER_ENTERED`, ...SH,
      `={{ JSON.stringify({ majorDimension: 'ROWS', values: ${AI("values", "مصفوفة صفوف", "json")} }) }}`),
    ht("Sheets Append Rows", "يضيف صفوفاً في آخر الجدول بعد البيانات الموجودة. values مصفوفة صفوف.", "POST",
      `=https://sheets.googleapis.com/v4/spreadsheets/{{ ${AI("spreadsheet_id", "معرّف الجدول")} }}/values/${enc(AI("range", "اسم الورقة أو نطاقها مثل Sheet1!A1"))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, ...SH,
      `={{ JSON.stringify({ majorDimension: 'ROWS', values: ${AI("values", "مصفوفة صفوف", "json")} }) }}`),
    ht("Doc Create", "ينشئ مستند Google Docs فارغاً بعنوان. يعيد documentId. أضيفي المحتوى بعده بـ Doc Edit.", "POST", "=https://docs.googleapis.com/v1/documents", ...DC,
      `={{ JSON.stringify({ title: ${AI("title", "عنوان المستند")} }) }}`),
    ht("Doc Edit", "يعدّل مستند Docs عبر طلبات Docs API batchUpdate. مثال إضافة نص في النهاية: [{\"insertText\":{\"endOfSegmentLocation\":{\"segmentId\":\"\"},\"text\":\"النص\"}}]. مثال استبدال: [{\"replaceAllText\":{\"containsText\":{\"text\":\"قديم\",\"matchCase\":true},\"replaceText\":\"جديد\"}}].", "POST",
      `=https://docs.googleapis.com/v1/documents/{{ ${AI("document_id", "معرّف المستند")} }}:batchUpdate`, ...DC,
      `={{ JSON.stringify({ requests: ${AI("requests", "مصفوفة طلبات Docs API", "json")} }) }}`),
    ht("Slides Create", "ينشئ عرض Google Slides بعنوان. يعيد presentationId.", "POST", "=https://slides.googleapis.com/v1/presentations", ...SL,
      `={{ JSON.stringify({ title: ${AI("title", "عنوان العرض")} }) }}`),
    ht("Slides Read", "يقرأ بنية عرض Slides (الشرائح وعناصرها ومعرّفاتها) لتعديلها.", "GET",
      `=https://slides.googleapis.com/v1/presentations/{{ ${AI("presentation_id", "معرّف العرض")} }}`, ...SL),
    ht("Slides Edit", "يعدّل عرض Slides عبر طلبات Slides API batchUpdate (createSlide وinsertText وreplaceAllText وغيرها). اقرئي العرض بـ Slides Read قبل التعديل لمعرفة المعرّفات.", "POST",
      `=https://slides.googleapis.com/v1/presentations/{{ ${AI("presentation_id", "معرّف العرض")} }}:batchUpdate`, ...SL,
      `={{ JSON.stringify({ requests: ${AI("requests", "مصفوفة طلبات Slides API", "json")} }) }}`),
  ];
}
function emailTool(subId) {
  const sv = (k, d, t = "string", def) => `={{ ${AI(k, d, t, def)} }}`;
  return { id: uid(), name: "Send Email (Safe)", type: "@n8n/n8n-nodes-langchain.toolWorkflow", typeVersion: 2.2, position: nextPos(), parameters: {
    description: "يرسل بريداً فعلياً من بريد الشركة (جديداً أو رداً على رسالة). حارس في الكود يمنع الإرسال تلقائياً إن كان فيه سعر أو خصم أو ضمان أو التزام حكومي أو أكثر من 5 مستلمين، فيرجع sent=false مع السبب: حينها اعرضي النص على باهر وسجّلي Create Pending ولا تعيدي المحاولة إلا بعد موافقته الصريحة (approved_by_baher=true). mode=new للجديد وreply للردّ (مع message_id من Read Gmail). لا تخترعي عناوين.",
    source: "database", workflowId: { __rl: true, mode: "id", value: subId, cachedResultName: SUB_NAME },
    workflowInputs: { mappingMode: "defineBelow", matchingColumns: [], value: {
      mode: sv("mode", "new أو reply", "string", "new"), to: sv("to", "عنوان أو عدة عناوين مفصولة بفاصلة (للجديد فقط)", "string", ""),
      subject: sv("subject", "عنوان الرسالة", "string", ""), body: sv("body", "نص الرسالة كاملاً جاهزاً للإرسال"),
      message_id: sv("message_id", "معرّف الرسالة المردود عليها (للرد فقط)", "string", ""),
      approved_by_baher: sv("approved_by_baher", "true فقط إن وافق باهر صراحةً على هذه الرسالة بعينها وإلا false", "string", "false") },
      schema: ["mode", "to", "subject", "body", "message_id", "approved_by_baher"].map(id => ({ id, displayName: id, required: false, display: true, type: "string", canBeUsedToMatch: false })) } } };
}
const RULES2 = `

قاعدة الصلاحيات الموسعة (قرار المالك 2026-10-12: «تحكم كامل»):
عندك الآن أدوات تنفيذ حقيقية: بريد (Send Email (Safe) + Read Gmail + Create Gmail Draft)، تقويم (Create/Update/Delete/List Calendar Event)، Drive (Search/Create Folder/Move/Trash/Read Text)، Sheets (Create/Read/Write/Append)، Docs (Create/Edit)، Slides (Create/Read/Edit).
١) نفّذي بنفسك ثم أخبري باهر بما تمّ ومعرّفاته وروابطه. لا تطلبي إذناً على الأعمال الروتينية (ردود الاستقبال، جدولة المواعيد، إنشاء المستندات والجداول، ترتيب الملفات).
٢) الإرسال يمر حتماً بـ Send Email (Safe). إن رجع sent=false فلا تحاولي الالتفاف: اعرضي النص على باهر وسجّلي Create Pending، ولا تعيدي الإرسال إلا بعد موافقته الصريحة على تلك الرسالة (approved_by_baher=true). السعر والخصم والضمان والالتزام الحكومي لا يُرسل دون موافقته مطلقاً.
٣) الحذف: Drive Trash File فقط (سلة المحذوفات)، ولا حذف نهائي أبداً. احذفي ما طلبه باهر صراحةً فقط. وحذف موعد فيه مدعوّون من خارج الشركة يحتاج موافقته.
٤) لا تخترعي إيميلاً ولا معرّفاً ولا رابطاً: اقرئيه من أداة. وإن لم تجديه فقولي ذلك.
٥) لا تضعي في مستند أو جدول أسراراً أو كلمات مرور أو أرقام بطاقات.`;

// ---------- run ----------
const log = [];
const wfs = await listWf();
const farah = wfs.find(w => /فرح — رئيسة المكتب التنفيذي/.test(w.name));
if (!farah) { console.log("Farah workflow not found"); process.exit(1); }
if (APPLY) fs.writeFileSync(`backup-tools-${Date.now()}.json`, JSON.stringify({ farah: wfs.find(w => w.id === farah.id), sub: wfs.find(w => w.name === SUB_NAME) || null }));

let sub = wfs.find(w => w.name === SUB_NAME);
let subId = sub?.id;
if (!sub) {
  log.push("+ sub-workflow: " + SUB_NAME);
  if (APPLY) {
    const r = await api("/workflows", { method: "POST", body: JSON.stringify(subWorkflow()) });
    if (!r.ok) { console.log("create sub failed", r.status, JSON.stringify(r.body).slice(0, 400)); process.exit(1); }
    subId = r.body.id; console.log("sub-workflow created:", subId);
  } else subId = "<new>";
} else log.push("= sub-workflow exists: " + subId);

const agent = farah.nodes.find(n => n.name === "Muin — Personal Assistant");
if (!agent) { console.log("agent not found"); process.exit(1); }
const add = (node) => { if (farah.nodes.some(n => n.name === node.name)) return; farah.nodes.push(node); farah.connections[node.name] = { ai_tool: [[{ node: agent.name, type: "ai_tool", index: 0 }]] }; log.push("+ tool: " + node.name); };
[calList(), calUpdate(), calDelete(), ...googleTools(), emailTool(subId)].forEach(add);
if (!String(agent.parameters.options.systemMessage).includes("قاعدة الصلاحيات الموسعة")) { agent.parameters.options.systemMessage += RULES2; log.push("~ system message: extended authority rules"); }
if ((agent.parameters.options.maxIterations || 0) < 14) { agent.parameters.options.maxIterations = 14; log.push("~ maxIterations -> 14"); }

console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN (no writes)");
log.forEach(l => console.log(l));
if (APPLY) {
  const r = await api(`/workflows/${farah.id}`, { method: "PUT", body: JSON.stringify({ name: farah.name, nodes: farah.nodes, connections: farah.connections, settings: pickSettings(farah.settings) }) });
  console.log("Farah:", r.ok ? "ok" : `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  const v = await api(`/workflows/${farah.id}`);
  const unresolved = (v.body.nodes || []).filter(n => Object.values(n.credentials || {}).some(c => String(c.id) === "0")).map(n => n.name);
  console.log("nodes whose credential did not resolve by name:", unresolved.length ? unresolved.join(", ") : "none");
}
