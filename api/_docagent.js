// الوكيل الذكي للمستندات — AI Document Agent engine.
//
// The client uploads documents that CONTAIN information (CR, AOA, VAT, bank,
// IDs…) and documents that NEED information (vendor forms, AML, KYC, NDA…).
// This module classifies every upload, extracts facts with provenance
// (document, page, date, confidence, status), reconciles across documents,
// maps target-form fields, asks the client only for what is missing, fills
// DOCX forms in place (agent-added data in blue, original layout untouched),
// runs a text-level QA pass and packages the deliverables as one ZIP.
//
// Routed via /api/requests?__route=doc-agent (the 12-function Vercel cap —
// see api/_db.js). All client actions are session-scoped like the rest of the
// portal; WhatsApp intake comes through n8n with a shared hook key.
//
// Hard rules encoded here, not left to the model:
//   * Legal declarations (PEP, sanctions, conflict of interest, source of
//     funds…) are NEVER auto-filled — only CLIENT_CONFIRMED via an explicit
//     client message, stamped with channel + time.
//   * Conflicting values across documents become CONFLICT and a question to
//     the client — never a silent pick.
//   * Filling never redesigns the form: we only append colored runs next to
//     existing text nodes and flip existing checkbox glyphs.
import crypto from "node:crypto";
import {
  sb, DB_ON, getSession, audit, notify,
  storagePut, storageGet, storageSign, sha256,
} from "./_db.js";
import { readDocumentRaw, askModel, MAX_DOC_BYTES, DOC_MIME_OK } from "./_docread.js";
import { ownerTicketOk, panelRequiresNafath } from "./_nafath.js";
import { zip, unzip } from "./_zip.js";
import { xlsxCells, xlsxApply, xlsxBlanks } from "./_xlsx.js";
import { pdfFields, pdfFill } from "./_pdfform.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const AGENT_MIME_OK = new RegExp(
  "^(image\\/(jpeg|jpg|png|webp|heic|heif)|application\\/pdf|" +
  DOCX_MIME.replace(/[./]/g, "\\$&") + "|" +
  XLSX_MIME.replace(/[./]/g, "\\$&") + ")$", "i"
);
// Vercel caps a serverless request body at 4.5 MB, and base64 inflates a file
// by 4/3 — so anything over ~3 MB never reaches this code at all: the platform
// rejects it and the client sees an opaque failure. The cap belongs here, with
// a message that says what to do.
const MAX_UPLOAD = 3 * 1024 * 1024;
const FILL_HEX = { blue: "1F4ED8", black: "000000", original: "" };
// Fact keys that are legal/sensitive declarations: the model may PROPOSE them,
// the code refuses to store them as anything but CLIENT_CONFIRMED.
const SENSITIVE_KEY = /(pep|sanction|conflict_of_interest|bribery|criminal|tax_enforcement|consent|source_of_funds|source_of_wealth|declaration)/i;
const STATUSES = ["NEW","UPLOADING","ANALYZING","EXTRACTING","MAPPING","WAITING_FOR_CLIENT","READY_TO_GENERATE","GENERATING","QA","READY","DELIVERED","REVISION","COMPLETED"];
const FILE_ROLES = ["source","target_form","supporting","signature_asset","stamp_asset","requirement","unknown"];

// Owner/consultant access for the /doc-agent-admin panel: the same key or
// نفاذ ticket the rest of the admin surface uses (see api/requests.js).
const PANEL_KEYS = new Set(
  [(process.env.PANEL_KEY || "").trim(), (process.env.LEADS_KEY || process.env.DASHBOARD_KEY || "").trim()].filter(Boolean)
);
const adminOk = (src) => {
  const key = String((src && src.key) || "").trim();
  const ticket = String((src && src.ticket) || "").trim();
  if (ownerTicketOk(ticket)) return true;
  return !panelRequiresNafath() && PANEL_KEYS.size > 0 && PANEL_KEYS.has(key);
};

/* ----------------------------------------------------------- tiny helpers */
const j = (res, code, obj) => { res.statusCode = code; return res.end(JSON.stringify(obj)); };
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  let raw = ""; for await (const c of req) raw += c;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}
const newRef = () => "DOC-" + String(crypto.randomInt(0, 1e6)).padStart(6, "0");
const escXml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : null);
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

function expiryStatus(expiry) {
  const d = isoDate(expiry);
  if (!d) return "UNKNOWN";
  const days = Math.floor((new Date(d) - Date.now()) / 86400000);
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "VALID";
}

/* -------------------------------------------------------------- DOCX ops */
// Every <w:t> in document.xml, in order, with byte offsets — the addressable
// units both for showing the form to the model and for applying fill ops.
export function docxNodes(xml) {
  const nodes = [];
  const re = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml))) nodes.push({ start: m.index, end: m.index + m[0].length, tag: m[0], text: m[1] });
  return nodes;
}
const CHECKBOX_EMPTY = /[☐□◻❏⬜]/;
const PLACEHOLDER = /_{3,}|\.{4,}|-{5,}|\u2026{2,}/;
// Apply fill ops from last node to first so earlier offsets stay valid.
// op: {node, op:"append"|"replace"|"check", text}
export function docxApply(xml, ops, colorHex) {
  const nodes = docxNodes(xml);
  const colored = (text) => colorHex
    ? `<w:r><w:rPr><w:color w:val="${colorHex}"/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`
    : `<w:r><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
  const applied = [];
  const sorted = [...ops].filter((o) => nodes[o.node]).sort((a, b) => b.node - a.node);
  for (const o of sorted) {
    const n = nodes[o.node];
    if (o.op === "check") {
      if (!CHECKBOX_EMPTY.test(n.text)) continue;
      const newTag = n.tag.replace(n.text, n.text.replace(CHECKBOX_EMPTY, "☒"));
      xml = xml.slice(0, n.start) + newTag + xml.slice(n.end);
      applied.push(o);
      continue;
    }
    // append/replace: keep the original node (emptied for replace), then a new
    // run right after the enclosing </w:r> so the value carries its own color.
    const runEnd = xml.indexOf("</w:r>", n.end);
    if (runEnd === -1) continue;
    const insertAt = runEnd + "</w:r>".length;
    const emptied = o.op === "replace" ? n.tag.replace(n.text, "") : n.tag;
    xml = xml.slice(0, n.start) + emptied + xml.slice(n.end, insertAt) +
      colored((o.op === "append" && n.text && !/\s$/.test(n.text) ? " " : "") + clip(o.text, 500)) +
      xml.slice(insertAt);
    applied.push(o);
  }
  return { xml, applied };
}
const docxText = (buf) => {
  const entries = unzip(buf);
  const doc = entries.get("word/document.xml");
  if (!doc) throw new Error("not_docx");
  return { entries, xml: doc.toString("utf8") };
};
// A numbered view of the form's text nodes for the model (empty nodes skipped).
function numberedNodes(xml, max = 900) {
  const nodes = docxNodes(xml);
  const lines = [];
  nodes.forEach((n, i) => { if (n.text.trim() || CHECKBOX_EMPTY.test(n.text)) lines.push(`[${i}] ${n.text}`); });
  return lines.slice(0, max).join("\n");
}
// A from-scratch minimal DOCX (fill sheets for non-DOCX targets).
function makeDocx(title, rows) {
  const body = rows.map(([k, v]) =>
    `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(k)}: </w:t></w:r>` +
    `<w:r><w:rPr><w:color w:val="1F4ED8"/></w:rPr><w:t xml:space="preserve">${escXml(v)}</w:t></w:r></w:p>`).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${escXml(title)}</w:t></w:r></w:p>${body}
</w:body></w:document>`;
  return zip(new Map([
    ["[Content_Types].xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)],
    ["_rels/.rels", Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)],
    ["word/document.xml", Buffer.from(doc)],
  ]));
}

/* ---------------------------------------------------------------- prompts */
// Classification + extraction in one multilingual pass. The model answers in
// JSON; official names are kept exactly as written, never translated.
const CLASSIFY_PROMPT = `You are the document-intake agent of Business Partner (Saudi Arabia). Read the attached document (any language — Arabic, English, French, Urdu, Hindi, Chinese, Turkish…) and return ONLY JSON, no prose:
{
 "role": "source" | "target_form" | "supporting" | "signature_asset" | "stamp_asset" | "requirement" | "unknown",
 "doc_kind": short slug e.g. "cr","aoa","vat_certificate","bank_letter","iban","national_id","iqama","passport","national_address","license","gosi","zakat","contract","employment_certificate","form","aml_form","kyc_form","nda","vendor_form","email","screenshot","other",
 "language": dominant language code ("ar","en",…),
 "doc_date": "YYYY-MM-DD" issue date if visible else "",
 "expiry_date": "YYYY-MM-DD" if visible else "",
 "summary": one sentence, in the document's own language,
 "facts": [ // ONLY when role="source": every useful value that another form could need
   {"group":"company|people|ownership|banking|addresses|licenses|tax|employment|other",
    "key":"dotted snake_case, e.g. company.name_ar, company.name_en, company.cr_number, company.unified_number, company.legal_type, tax.vat_number, banking.iban, banking.bank_name, people[0].name_ar, people[0].name_en, people[0].id_number, people[0].dob, people[0].nationality, ownership[0].owner_name, ownership[0].share_pct, addresses[0].city …",
    "value":"exactly as written — NEVER translate names, numbers or legal text",
    "value_lang":"ar|en|…","page":1,"confidence":"HIGH|MEDIUM|LOW"}
 ],
 "fields": [ // ONLY when role="target_form": every blank the form asks to fill
   {"id":"f1","label":"the field's own label text","kind":"text|date|checkbox|yesno|table|signature|stamp|initials","section":"section heading if any","required":true|false,"sensitive":true|false}
   // sensitive=true for legal declarations: PEP, sanctions, conflict of interest, bribery, criminal, tax enforcement, consent, source of funds/wealth
 ],
 "checklist": [ // ONLY when role="requirement" (an email/screenshot listing required documents)
   "each required item exactly as named"
 ]
}
Classification guide: a document that mostly STATES information about an entity/person = "source". A document with blanks, questions, checkboxes or underscores awaiting answers = "target_form". A picture of a stamp = "stamp_asset"; of a handwritten signature = "signature_asset". An email/screenshot listing what must be submitted = "requirement". Extract only what is actually visible; never guess. Ownership percentages: if a capital and per-owner amounts are visible, include ownership[i].share_pct computed from them with confidence "MEDIUM".`;

const chatSystem = (state) => `أنت «الوكيل الذكي للمستندات» في Business Partner — مساعد يقرأ مستندات العميل ويعبّئ نماذجه.
أجب دائماً بلغة آخر رسالة من العميل (عربي، إنجليزي، أو أي لغة أخرى).
قواعد صارمة:
- الإقرارات القانونية (PEP، عقوبات، تضارب مصالح، رشوة، ملاحقة ضريبية، مصدر أموال، موافقات) لا تُفترض أبداً: اطلب تأكيداً صريحاً، وعند تأكيد العميل أعِد action من نوع confirm_declaration.
- عند تعارض قيمة بين مستندين اعرض القيمتين ومصدريهما واسأل أيّهما يُعتمد.
- لا تسأل عن معلومة موجودة أصلاً في الحقائق أدناه. اسأل فقط عن الناقص، مجمّعاً في رسالة واحدة قصيرة.
- أوامر التحرير الطبيعية ("خلي كل الإجابات Yes"، "Section 9 كله No"، "حط تاريخ اليوم"، "غيّر الإيميل"، "النسبة 39.5%") حوّلها إلى actions.
- "تاريخ اليوم" يعني تاريخ تعبئة/توقيع النموذج فقط — لا تغيّر تواريخ إصدار المستندات الرسمية.
- المستند المنتهي: نبّه العميل وأكمل الطلب، واطلب نسخة محدثة قبل التقديم النهائي.
- اختصر: رد قصير مباشر، لا تكرر ما قلته في رسائل سابقة، ولا تعد سرد الحقائق أو النسب إذا سبق ذكرها. اجمع كل الناقص في رسالة واحدة.
- لا تَعِد أبداً بأن ملفاً "سيصلك خلال لحظات" أو أنك "سترسله" — أنت لا ترسل ملفات من الرد. عندما يطلب العميل التعبئة أو الملف: أعد action من نوع ready_to_generate، وقل جملة واحدة مثل «بدأت التعبئة الآن — روابط التحميل ستظهر هنا خلال أقل من دقيقة».
- انتبه لعدد النماذج في gap.forms: إذا كان صفراً فلا يمكن توليد شيء — لا تَعِد بالتعبئة، بل اعرض أسماء الملفات المرفوعة واسأل: «أي ملف تريدني أعبيه؟»، وعندما يحدده العميل أعد action من نوع set_target_form باسم الملف (يعيد تصنيفه نموذجاً للتعبئة).

أعد JSON فقط:
{"reply":"نص ردك للعميل بلغته",
 "actions":[
  {"type":"set_fact","key":"…","value":"…"} // معلومة إدارية أعطاك إياها العميل الآن
  ,{"type":"confirm_declaration","key":"declarations.…","value":"…"} // فقط عندما يؤكد العميل إقراراً قانونياً صراحةً في رسالته
  ,{"type":"resolve_conflict","key":"…","value":"القيمة المعتمدة"}
  ,{"type":"set_fill_color","color":"blue|black|original"}
  ,{"type":"set_signature_mode","mode":"leave_blank|typed_electronic|external_esign"}
  ,{"type":"set_target_form","file":"اسم الملف (أو جزء مميز منه) كما في files"} // العميل حدد أن هذا الملف هو النموذج المطلوب تعبئته
  ,{"type":"ready_to_generate"} // عندما يطلب العميل التعبئة/التوليد وكل الضروري مكتمل ويوجد نموذج واحد على الأقل
 ]}

حالة الطلب الحالية:
${state}`;

const fillPrompt = (formName, nodesList, factsList, mapping) => `You fill a form WITHOUT redesigning it. Below are the numbered text nodes of the DOCX form "${formName}", then the verified client facts.
Return ONLY JSON: {"ops":[{"node":N,"op":"append|replace|check","text":"value"}], "unfilled":[{"label":"…","reason":"missing|needs_confirmation"}]}
Rules:
- "append": write the value right after node N (use for "Label:" nodes followed by empty space).
- "replace": node N is a placeholder (underscores, dots, "___") — clear it and write the value.
- "check": node N contains an empty checkbox glyph (☐ □ ◻) to tick. Only tick what the facts/mapping justify.
- Dates: fields meaning completion/signature/declaration date get today's date ${new Date().toISOString().slice(0, 10)}; NEVER touch document issue/expiry dates printed in the form.
- Never invent values. A field with no matching fact goes to "unfilled".
- Legal declarations may only be filled when the mapping marks them CLIENT_CONFIRMED.
- Keep official names exactly as the facts state them (Arabic name in Arabic fields, English name in English fields when both exist).

FORM NODES:
${nodesList}

FACTS (key = value [status]):
${factsList}

FIELD MAPPING HINTS:
${mapping}`;

const xlsxFillPrompt = (formName, cellsList, factsList, mapping) => `You fill an Excel form WITHOUT redesigning it. Below are the non-empty cells of the workbook "${formName}" addressed as [Sheet!Ref], then the verified client facts.
Return ONLY JSON: {"ops":[{"sheet":"Sheet name","ref":"C7","text":"value"}], "unfilled":[{"label":"…","reason":"missing|needs_confirmation"}]}
Rules:
- A label cell like "[Vendor Form!B7] CR Number:" is answered in the empty cell BESIDE or BELOW it — usually the next column (C7) in LTR sheets, the previous column in Arabic RTL sheets, or the row under a heading. Choose the ref accordingly; never overwrite a label.
- Overwrite a cell only when it clearly holds a stale placeholder value for the same field.
- Yes/No or checkbox-style cells: write the exact expected token the sheet uses (Yes, No, ✓, ×…).
- Dates: completion/signature/declaration dates get today ${new Date().toISOString().slice(0, 10)}; NEVER touch document issue/expiry dates.
- Never invent values. A field with no matching fact goes to "unfilled".
- Legal declarations may only be filled when the mapping marks them CLIENT_CONFIRMED.
- Keep official names exactly as the facts state them.

WORKBOOK CELLS:
${cellsList}

FACTS (key = value [status]):
${factsList}

FIELD MAPPING HINTS:
${mapping}`;

const pdfFillPrompt = (formName, fieldsList, factsList, mapping) => `You fill a PDF form's named AcroForm fields. Below are the fields of "${formName}", then the verified client facts.
Return ONLY JSON: {"values":[{"field":"exact field name","text":"value"} or {"field":"exact field name","check":true|false}], "unfilled":[{"label":"…","reason":"missing|needs_confirmation"}]}
Rules:
- "text" for text/choice fields, "check" for checkboxes. Use each field's name EXACTLY as listed.
- Dates: completion/signature/declaration dates get today ${new Date().toISOString().slice(0, 10)}; NEVER invent document issue/expiry dates.
- Never invent values. A field with no matching fact goes to "unfilled".
- Legal declarations may only be filled when the mapping marks them CLIENT_CONFIRMED.
- Keep official names exactly as the facts state them (Arabic stays Arabic, English stays English).

PDF FIELDS:
${fieldsList}

FACTS (key = value [status]):
${factsList}

FIELD MAPPING HINTS:
${mapping}`;

const qaPrompt = (formName, beforeAfter) => `You are the QA agent. A form "${formName}" was auto-filled. Compare the fill plan with the final text and answer ONLY JSON:
{"pass":true|false,"findings":[{"severity":"error|warn","issue":"…"}]}
Check: every planned value actually appears; no placeholder/underscore runs remain where a value was planned; checkbox intents applied; dates are ${new Date().toISOString().slice(0, 10)} only where completion/signature dates were intended; names and numbers copied exactly (no truncation/translation).
${beforeAfter}`;

/* ------------------------------------------------------------- vault sync */
// Mirror every stored file to the ops vault (n8n → per-client Google Drive
// folder + per-client Notion page with one row per file). Best-effort with a
// hard timeout: a sync failure never touches the client's own flow — the
// Supabase vault stays the source of truth, Notion/Drive are the ops mirror.
async function vaultSync(request, kind, file, storageKey) {
  const url = (process.env.DOC_AGENT_SYNC_URL || "").trim();
  if (!url) return;
  try {
    let orgName = null;
    if (request.organization_id) {
      const orgs = await sb(`organizations?id=eq.${request.organization_id}&select=name_ar,name_en&limit=1`);
      orgName = orgs[0] ? (orgs[0].name_ar || orgs[0].name_en) : null;
    }
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-doc-agent-key": (process.env.DOC_AGENT_HOOK_KEY || "").trim() },
      body: JSON.stringify({
        kind,                                    // upload | output | package
        org_id: request.organization_id || null,
        org_name: orgName,
        contact: request.contact || null,
        channel: request.channel,
        ref: request.ref,
        file,                                    // {name, mime, role, doc_kind, size}
        download_url: await storageSign(storageKey, 3600),
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { console.error("doc-agent vault-sync", String(e.message || e).slice(0, 160)); }
}

/* ------------------------------------------------------------ data access */
const reqByRef = async (ref, orgId) =>
  (await sb(`doc_agent_requests?ref=eq.${encodeURIComponent(ref)}&organization_id=eq.${orgId}&limit=1`))[0] || null;
const setReq = (id, patch) =>
  sb(`doc_agent_requests?id=eq.${id}`, { method: "PATCH", body: { ...patch, updated_at: new Date().toISOString() }, prefer: "return=minimal" });
const addMsg = (request_id, author, channel, body, extra) =>
  sb("doc_agent_messages", { method: "POST", prefer: "return=minimal", body: [{ request_id, author, channel, body: clip(body, 8000), ...(extra || {}) }] });

// Merge freshly extracted facts into the request's unified profile.
// Newest official source wins; disagreements become CONFLICT, never a pick.
async function mergeFacts(request, fileRow, rawFacts) {
  if (!Array.isArray(rawFacts) || !rawFacts.length) return { added: 0, conflicts: [] };
  const existing = await sb(`doc_agent_facts?request_id=eq.${request.id}&select=id,fact_key,value,status,source_document_date`);
  const byKey = new Map(existing.map((f) => [f.fact_key, f]));
  const docDate = isoDate(fileRow.extracted && fileRow.extracted.doc_date) || null;
  let added = 0; const conflicts = [];
  for (const f of rawFacts.slice(0, 80)) {
    const key = clip(f.key, 120); const value = clip(f.value, 500);
    if (!key || !value) continue;
    const sensitive = SENSITIVE_KEY.test(key) || String(f.group) === "declarations";
    const status = sensitive ? "INFERRED" : "VERIFIED"; // declarations never auto-verify
    const prev = byKey.get(key);
    const row = {
      request_id: request.id, organization_id: request.organization_id,
      fact_group: clip(f.group, 40) || "other", fact_key: key, value,
      value_lang: clip(f.value_lang, 8) || null,
      source_file_id: fileRow.id, source_page: Number(f.page) || null,
      source_document_date: docDate,
      confidence: ["HIGH","MEDIUM","LOW"].includes(f.confidence) ? f.confidence : "MEDIUM",
      status,
    };
    if (!prev) { await sb("doc_agent_facts", { method: "POST", prefer: "return=minimal", body: [row] }); byKey.set(key, { ...row, id: "new" }); added++; continue; }
    if (prev.value === value || prev.status === "CLIENT_CONFIRMED") continue;
    // Different value for the same key → conflict; keep the newer as the
    // stored value only when it is strictly newer AND official, still flagged.
    const newer = docDate && (!prev.source_document_date || docDate > prev.source_document_date);
    await sb(`doc_agent_facts?id=eq.${prev.id}`, {
      method: "PATCH", prefer: "return=minimal",
      body: {
        ...(newer ? { value, source_file_id: fileRow.id, source_document_date: docDate } : {}),
        status: "CONFLICT",
        conflict_with: [{ value: newer ? prev.value : value, source_file_id: newer ? null : fileRow.id, document_date: newer ? prev.source_document_date : docDate }],
        updated_at: new Date().toISOString(),
      },
    });
    conflicts.push({ key, kept: newer ? value : prev.value, other: newer ? prev.value : value });
  }
  return { added, conflicts };
}

// What is still missing across every target form — drives "ask only the gap".
async function gapSummary(requestId) {
  const files = await sb(`doc_agent_files?request_id=eq.${requestId}&select=id,role,file_name,field_map`);
  const facts = await sb(`doc_agent_facts?request_id=eq.${requestId}&select=fact_key,value,status,confidence`);
  const forms = files.filter((f) => f.role === "target_form");
  const fields = forms.flatMap((f) => ((f.field_map && f.field_map.fields) || []).map((x) => ({ ...x, form: f.file_name })));
  const conflicts = facts.filter((f) => f.status === "CONFLICT");
  const sensitivePending = fields.filter((x) => x.sensitive);
  const confirmed = new Set(facts.filter((f) => f.status === "CLIENT_CONFIRMED").map((f) => f.fact_key));
  return {
    forms: forms.length,
    sources: files.filter((f) => f.role === "source").length,
    fields: fields.length,
    facts: facts.length,
    conflicts: conflicts.map((c) => c.fact_key),
    sensitive_fields: sensitivePending.map((x) => ({ form: x.form, label: x.label })),
    confirmed_declarations: [...confirmed].filter((k) => SENSITIVE_KEY.test(k)),
  };
}

const stateBlock = (request, gap, facts, msgs, files) => JSON.stringify({
  ref: request.ref, status: request.status, fill_color: request.fill_color,
  signature_mode: request.signature_mode, checklist: request.checklist,
  gap,
  files: (files || []).map((f) => `${f.file_name} [${f.role}/${f.doc_kind || "?"}]`),
  facts: facts.map((f) => `${f.fact_key} = ${f.value} [${f.status}/${f.confidence}]`),
  recent: msgs.map((m) => `${m.author}: ${clip(m.body, 300)}`),
}, null, 1);

// Chat asked to reclassify an uploaded file as the form to fill: match by
// (partial, case-insensitive) name within THIS request only.
async function setTargetForm(request, namePart) {
  const files = await sb(`doc_agent_files?request_id=eq.${request.id}&select=id,file_name,role`);
  const needle = String(namePart || "").trim().toLowerCase();
  if (!needle) return null;
  const hit = files.find((f) => f.file_name.toLowerCase() === needle) ||
    files.find((f) => f.file_name.toLowerCase().includes(needle));
  if (!hit) return null;
  await sb(`doc_agent_files?id=eq.${hit.id}`, { method: "PATCH", prefer: "return=minimal", body: { role: "target_form" } });
  return hit.file_name;
}

/* ------------------------------------------------------------- the phases */
/* ------------------------------------------------- structure signals ---- */
// What the language model CANNOT see. An empty spreadsheet cell does not exist
// in the file at all, and an empty Word run carries no text — so a blank form
// reaching the model looked like a short list of labels, i.e. a "source
// document". That one blind spot is why uploaded forms came back classified as
// sources and the request sat at "0 forms to fill". These signals are computed
// from the file's own structure, never guessed, and they outrank the model.
export function formSignals(buf, mime) {
  try {
    if (mime === XLSX_MIME) {
      const blanks = xlsxBlanks(buf);
      return { kind: "xlsx", score: blanks.length, fields: 0, blanks,
        lines: blanks.map((b) => `${b.sheet}!${b.ref} "${b.label}" → اكتب في: ${[b.next, b.prev, b.below].filter(Boolean).join(" أو ")}`) };
    }
    if (/pdf$/i.test(mime)) {
      const f = pdfFields(buf);
      return { kind: "pdf", score: f.length ? 99 : 0, fields: f.length, blanks: [],
        lines: f.map((x) => `field "${x.name}" (${x.type})`) };
    }
    if (mime === DOCX_MIME) {
      const nodes = docxNodes(docxText(buf).xml);
      const lines = [];
      nodes.forEach((n, i) => {
        const t = n.text;
        const labelNoAnswer = /[:：؟?]\s*$/.test(t) && !(nodes[i + 1] && nodes[i + 1].text.trim());
        if (PLACEHOLDER.test(t) || CHECKBOX_EMPTY.test(t) || labelNoAnswer) lines.push(`[${i}] ${clip(t, 60)}`);
      });
      return { kind: "docx", score: lines.length, fields: 0, blanks: [], lines: lines.slice(0, 300) };
    }
  } catch (e) { console.error("formSignals", String(e.message || e).slice(0, 120)); }
  return { kind: "other", score: 0, fields: 0, blanks: [], lines: [] };
}
const signalBlock = (sig) => !sig.lines.length ? "(none detected)" :
  `${sig.fields ? `${sig.fields} fillable PDF form fields` : `${sig.score} blanks awaiting an answer`}:\n${sig.lines.slice(0, 120).join("\n")}`;

// Addressed cell view of a workbook for the model: "[Sheet!B7] label text".
const xlsxCellList = (buf, max = 900) =>
  xlsxCells(buf).slice(0, max).map((c) => `[${c.sheet}!${c.ref}] ${c.text}`).join("\n");

async function classifyUpload(request, buf, base64, mime, fileName, uploadedBy) {
  // Structure first, model second: the blanks are read from the file itself,
  // then handed to the model so it judges with them in view.
  const sig = formSignals(buf, mime);
  const hint = `\n\nSTRUCTURE SIGNALS — read from the file itself, not guessed. TRUST THEM:\n${signalBlock(sig)}\n` +
    `If blanks or fillable fields are listed above, this document IS a "target_form" no matter how much information it also carries. FILE NAME: ${fileName}`;
  let cls = null, why = "";
  if (mime === DOCX_MIME || mime === XLSX_MIME) {
    let text = "";
    try { text = mime === DOCX_MIME ? numberedNodes(docxText(buf).xml, 1200) : xlsxCellList(buf, 1200); } catch { text = ""; }
    const label = mime === DOCX_MIME ? "DOCX text nodes, numbered" : "XLSX non-empty cells, addressed as [Sheet!Ref] (EMPTY CELLS ARE NOT LISTED)";
    const r = await askModel(`${CLASSIFY_PROMPT}${hint}\n\nDOCUMENT (${label}):\n${clip(text, 60000)}`, 6000);
    cls = r.ok ? r.data : null; why = r.ok ? "" : (r.detail || r.error || "model_failed");
  } else if (DOC_MIME_OK.test(mime) && buf.length <= MAX_DOC_BYTES) {
    const r = await readDocumentRaw(base64, mime, CLASSIFY_PROMPT + hint, 6000);
    cls = r.ok ? r.data : null; why = r.ok ? "" : (r.error || "model_failed");
  } else if (!DOC_MIME_OK.test(mime)) {
    why = "unsupported_type";
  }
  cls = cls || {};
  let role = FILE_ROLES.includes(cls.role) ? cls.role : "unknown";
  // The signals outrank the model's guess: a file with real blanks is a form.
  const structural = sig.fields > 0 || sig.score >= 3;
  if (structural && (role === "source" || role === "unknown" || role === "supporting")) role = "target_form";

  const key = `${request.organization_id}/doc-agent/${request.id}/${Date.now()}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
  await storagePut(key, buf, mime);
  const modelFields = Array.isArray(cls.fields) ? cls.fields.slice(0, 200).map((f, i) => ({
    id: clip(f.id, 12) || `f${i + 1}`, label: clip(f.label, 200), kind: clip(f.kind, 20) || "text",
    section: clip(f.section, 120), required: !!f.required,
    sensitive: !!f.sensitive || SENSITIVE_KEY.test(String(f.label)),
  })) : [];
  // A form's blanks travel with it: the fill step then writes into known cells
  // and known PDF fields instead of re-deriving them from prose.
  const fieldMap = role === "target_form"
    ? { fields: modelFields, blanks: sig.blanks, signal_lines: sig.lines.slice(0, 300), signal_kind: sig.kind }
    : null;
  const note = why
    ? `تعذّر تحليل الملف بالنموذج (${clip(why, 120)})${structural ? " — صُنّف نموذجاً للتعبئة من بنية الملف." : ""}`
    : clip(cls.summary, 300) || null;
  const rows = await sb("doc_agent_files", {
    method: "POST",
    body: [{
      request_id: request.id, role, doc_kind: clip(cls.doc_kind, 40) || (structural ? "form" : null),
      file_name: clip(fileName, 200), mime, size_bytes: buf.length, storage_key: key,
      language: clip(cls.language, 8) || null,
      expiry_status: expiryStatus(cls.expiry_date), expiry_date: isoDate(cls.expiry_date),
      field_map: fieldMap,
      extracted: { doc_date: isoDate(cls.doc_date), summary: clip(cls.summary, 300), model_error: why || undefined, blanks: sig.score },
      analysis_note: note,
    }],
  });
  const fileRow = rows[0];
  let merge = { added: 0, conflicts: [] };
  if (role === "source" && Array.isArray(cls.facts)) merge = await mergeFacts(request, fileRow, cls.facts);
  if (role === "requirement" && Array.isArray(cls.checklist) && cls.checklist.length) {
    const list = [...new Set([...(request.checklist || []), ...cls.checklist.map((c) => clip(c, 160))])].slice(0, 40);
    await setReq(request.id, { checklist: list });
  }
  await audit({ organization_id: request.organization_id, actor_user_id: uploadedBy || null, action: "doc_agent.file_classified", entity_type: "doc_agent_file", entity_id: fileRow.id, after: { role, doc_kind: fileRow.doc_kind, facts_added: merge.added } });
  await vaultSync(request, "upload", { name: fileRow.file_name, mime, role, doc_kind: fileRow.doc_kind, size: buf.length }, key);
  return { fileRow, cls, merge, role };
}

// Fills ONE form per call by default. Two model calls per form (plan + QA)
// against a 60-second function ceiling means a request that fills four forms
// times out and the client sees nothing — so the caller loops instead, and
// every request stays comfortably inside the limit.
async function generateOutputs(request, channel, onlyFormId) {
  await setReq(request.id, { status: "GENERATING" });
  const files = await sb(`doc_agent_files?request_id=eq.${request.id}&select=id,role,doc_kind,file_name,mime,storage_key,field_map`);
  const facts = await sb(`doc_agent_facts?request_id=eq.${request.id}&select=fact_key,value,status,confidence&order=fact_key`);
  const usable = facts.filter((f) => f.status === "VERIFIED" || f.status === "CLIENT_CONFIRMED");
  const factsList = usable.map((f) => `${f.fact_key} = ${f.value} [${f.status}]`).join("\n") || "(none)";
  const colorHex = FILL_HEX[request.fill_color] ?? FILL_HEX.blue;
  const allForms = files.filter((f) => f.role === "target_form");
  const forms = onlyFormId ? allForms.filter((f) => f.id === onlyFormId) : allForms.slice(0, 1);
  const remaining = allForms.filter((f) => !forms.some((x) => x.id === f.id)).map((f) => ({ id: f.id, name: f.file_name }));
  const outputs = [];
  const existing = await sb(`doc_agent_outputs?request_id=eq.${request.id}&select=delivery_name,version_no`);
  const nextVersion = (name) => existing.filter((o) => o.delivery_name === name).reduce((m, o) => Math.max(m, o.version_no), 0) + 1;
  // Sensitive ops require a confirmed declaration backing them — same guard
  // for every format: the model may plan them, the code drops them.
  const confirmedDecl = new Set(usable.filter((f) => f.status === "CLIENT_CONFIRMED").map((f) => f.fact_key));
  const sensitiveOk = (form, fieldId, text) => {
    const field = ((form.field_map && form.field_map.fields) || []).find((x) => fieldId && x.id === fieldId);
    const sensitiveTouch = (field && field.sensitive) || SENSITIVE_KEY.test(String(text || ""));
    return !sensitiveTouch || confirmedDecl.size > 0;
  };
  const saveOutput = async (form, deliveryName, outBuf, mime, fillSummary, qa) => {
    const vno = nextVersion(deliveryName);
    const outKey = `${request.organization_id}/doc-agent/${request.id}/out/v${vno}-${deliveryName.replace(/[^\w.\-]+/g, "_")}`;
    await storagePut(outKey, outBuf, mime);
    const orows = await sb("doc_agent_outputs", {
      method: "POST",
      body: [{
        request_id: request.id, source_form_file_id: form.id, kind: "filled_form",
        delivery_name: deliveryName, storage_key: outKey, mime, size_bytes: outBuf.length,
        version_no: vno, fill_summary: fillSummary,
        qa_status: qa ? (qa.pass ? "passed" : "failed") : "waived", qa_findings: qa ? (qa.findings || []) : undefined,
      }],
    });
    await vaultSync(request, "output", { name: deliveryName, mime, role: "filled_output", doc_kind: form.doc_kind || "form", size: outBuf.length }, outKey);
    return orows[0];
  };

  for (const form of forms) {
    const deliveryName = clip(form.file_name.replace(/\.(docx|pdf|xlsx|png|jpe?g|webp)$/i, ""), 120) || "Form";
    const fm = form.field_map || {};
    const mappingHints = JSON.stringify(fm.fields || []) +
      ((fm.signal_lines && fm.signal_lines.length)
        ? `\n\nBLANKS FOUND IN THE FILE ITSELF (deterministic — fill exactly these):\n${fm.signal_lines.slice(0, 200).join("\n")}`
        : "");
    let fillablePdf = null;
    if (form.mime === DOCX_MIME) {
      const buf = await storageGet(form.storage_key);
      const { entries, xml } = docxText(buf);
      const plan = await askModel(fillPrompt(form.file_name, numberedNodes(xml), factsList, mappingHints), 8000);
      if (!plan.ok || !Array.isArray(plan.data.ops)) { outputs.push({ form: form.file_name, ok: false, error: "fill_plan_failed", detail: plan.detail || plan.error }); continue; }
      // A salvaged (truncated) plan can end in an operation that lost its text;
      // writing an empty run would silently blank a field, so it is dropped.
      const ops = plan.data.ops.filter((o) => Number.isInteger(o.node) && ["append","replace","check"].includes(o.op))
        .filter((o) => o.op === "check" || String(o.text == null ? "" : o.text).trim())
        .filter((o) => sensitiveOk(form, o.field_id, o.text));
      const { xml: filledXml, applied } = docxApply(xml, ops, colorHex);
      entries.set("word/document.xml", Buffer.from(filledXml, "utf8"));
      const outBuf = zip(entries);
      // QA: the plan vs the final text, judged by a second pass.
      let qa = { pass: true, findings: [] };
      try {
        const after = docxNodes(filledXml).map((n) => n.text).filter(Boolean).join(" ");
        const q = await askModel(qaPrompt(form.file_name, `PLANNED OPS:\n${JSON.stringify(applied).slice(0, 8000)}\n\nFINAL TEXT:\n${clip(after, 30000)}`), 2000);
        if (q.ok && typeof q.data.pass === "boolean") qa = q.data;
      } catch {}
      const saved = await saveOutput(form, `${deliveryName}.docx`, outBuf, DOCX_MIME,
        { applied: applied.length, planned: plan.data.ops.length, unfilled: plan.data.unfilled || [] }, qa);
      outputs.push({ form: form.file_name, ok: true, output_id: saved.id, applied: applied.length, unfilled: (plan.data.unfilled || []).length, qa: qa.pass ? "passed" : "failed" });
    } else if (form.mime === XLSX_MIME) {
      // Excel forms: values go into the sheet itself as inline strings in the
      // agent's ink; layout, formulas and every untouched cell stay identical.
      const buf = await storageGet(form.storage_key);
      let cellsList = "";
      try { cellsList = xlsxCellList(buf); } catch { outputs.push({ form: form.file_name, ok: false, error: "bad_xlsx" }); continue; }
      const plan = await askModel(xlsxFillPrompt(form.file_name, cellsList, factsList, mappingHints), 8000);
      if (!plan.ok || !Array.isArray(plan.data.ops)) { outputs.push({ form: form.file_name, ok: false, error: "fill_plan_failed", detail: plan.detail || plan.error }); continue; }
      const ops = plan.data.ops
        .filter((o) => o && o.ref && o.text != null)
        .slice(0, 300)
        .filter((o) => sensitiveOk(form, o.field_id, o.text));
      const { buf: outBuf, applied } = xlsxApply(buf, ops, colorHex);
      // Deterministic QA: every applied value must read back from its cell.
      let qa = { pass: true, findings: [] };
      try {
        const after = xlsxCells(outBuf);
        const missing = applied.filter((o) => !after.some((c) => c.ref === String(o.ref).toUpperCase() && c.text === clip(o.text, 500)));
        qa = { pass: missing.length === 0, findings: missing.map((o) => ({ severity: "error", issue: `cell ${o.ref} did not take the value` })) };
      } catch {}
      const saved = await saveOutput(form, `${deliveryName}.xlsx`, outBuf, XLSX_MIME,
        { applied: applied.length, planned: plan.data.ops.length, unfilled: plan.data.unfilled || [] }, qa);
      outputs.push({ form: form.file_name, ok: true, output_id: saved.id, applied: applied.length, unfilled: (plan.data.unfilled || []).length, qa: qa.pass ? "passed" : "failed" });
    } else if (/pdf$/i.test(form.mime) && (fillablePdf = await (async () => {
      try { const b = await storageGet(form.storage_key); const f = pdfFields(b); return f.length ? { buf: b, fields: f } : null; } catch { return null; }
    })())) {
      // Fillable PDFs (AcroForm): write /V natively as an incremental update —
      // the original bytes stay untouched underneath.
      const { buf, fields } = fillablePdf;
      const fieldsList = fields.map((f) => `- "${f.name}" (${f.type})`).join("\n");
      const plan = await askModel(pdfFillPrompt(form.file_name, fieldsList, factsList, mappingHints), 8000);
      if (!plan.ok || !Array.isArray(plan.data.values)) { outputs.push({ form: form.file_name, ok: false, error: "fill_plan_failed", detail: plan.detail || plan.error }); continue; }
      const values = {};
      for (const v of plan.data.values.slice(0, 300)) {
        if (!v || !v.field || !fields.some((f) => f.name === v.field)) continue;
        if (!sensitiveOk(form, v.field_id, v.text != null ? v.text : v.field)) continue;
        if (v.text != null) values[v.field] = { text: clip(v.text, 500) };
        else if (typeof v.check === "boolean") values[v.field] = { check: v.check };
      }
      let outBuf, applied;
      try { ({ buf: outBuf, applied } = pdfFill(buf, values, colorHex)); }
      catch (e) { outputs.push({ form: form.file_name, ok: false, error: "pdf_fill_failed" }); continue; }
      // Deterministic QA: every planned field must have been applied.
      const planned = Object.keys(values);
      const missed = planned.filter((n) => !applied.includes(n));
      const qa = { pass: missed.length === 0 && planned.length > 0, findings: missed.map((n) => ({ severity: "error", issue: `field "${n}" was not filled` })) };
      const saved = await saveOutput(form, `${deliveryName}.pdf`, outBuf, "application/pdf",
        { applied: applied.length, planned: plan.data.values.length, unfilled: plan.data.unfilled || [] }, qa);
      outputs.push({ form: form.file_name, ok: true, output_id: saved.id, applied: applied.length, unfilled: (plan.data.unfilled || []).length, qa: qa.pass ? "passed" : "failed" });
    } else {
      // Scanned forms, images, and PDFs without AcroForm fields: the client
      // gets a fill sheet with every answer laid out in form order — nothing
      // is silently skipped, and nothing is drawn blindly onto a scan.
      const fields = (form.field_map && form.field_map.fields) || [];
      const map = await askModel(
        `Match form fields to facts. Return ONLY JSON {"rows":[["field label","value or —"]]}. Fields:\n${JSON.stringify(fields).slice(0, 20000)}\nFacts:\n${factsList}\nRules: never invent; sensitive/legal fields get the fact only if [CLIENT_CONFIRMED]; else "—".`,
        4000);
      const rows = map.ok && Array.isArray(map.data.rows) ? map.data.rows.slice(0, 200).map((r) => [clip(r[0], 200), clip(r[1], 500)]) : [];
      const outBuf = makeDocx(`Fill Sheet — ${form.file_name}`, rows);
      const saved = await saveOutput(form, `${deliveryName} — Fill Sheet.docx`, outBuf, DOCX_MIME, { rows: rows.length, mode: "fill_sheet" }, null);
      outputs.push({ form: form.file_name, ok: true, output_id: saved.id, mode: "fill_sheet", rows: rows.length });
    }
  }

  // Ownership chart when the facts carry ownership rows (last pass only).
  const owners = remaining.length ? [] : usable.filter((f) => /^ownership\[\d+\]\.owner_name/.test(f.fact_key));
  if (owners.length) {
    const shares = usable.filter((f) => /^ownership\[\d+\]\.share_pct/.test(f.fact_key));
    const company = (usable.find((f) => f.fact_key === "company.name_en") || usable.find((f) => f.fact_key === "company.name_ar") || {}).value || "Company";
    const rows = owners.map((o) => {
      const idx = (o.fact_key.match(/\[(\d+)\]/) || [])[1];
      const s = shares.find((x) => x.fact_key.includes(`[${idx}]`));
      return [o.value, s ? `${s.value}%` : ""];
    });
    const outBuf = makeDocx(`Ownership Structure — ${company}`, rows);
    const vno = nextVersion("Ownership Structure");
    const outKey = `${request.organization_id}/doc-agent/${request.id}/out/v${vno}-ownership.docx`;
    await storagePut(outKey, outBuf, DOCX_MIME);
    await sb("doc_agent_outputs", { method: "POST", prefer: "return=minimal", body: [{ request_id: request.id, kind: "ownership_chart", delivery_name: "Ownership Structure.docx", storage_key: outKey, mime: DOCX_MIME, size_bytes: outBuf.length, version_no: vno, qa_status: "waived" }] });
  }

  const anyFailed = outputs.some((o) => o.ok && o.qa === "failed");
  await setReq(request.id, { status: remaining.length ? "GENERATING" : (anyFailed ? "QA" : "READY") });
  await audit({ organization_id: request.organization_id, action: "doc_agent.generated", entity_type: "doc_agent_request", entity_id: request.id, after: { outputs: outputs.length, qa_failed: anyFailed } });
  await notify({ organization_id: request.organization_id, event: "doc_agent_ready", channel: "inapp", title: "الوكيل الذكي للمستندات: نماذجك جاهزة", body: `الطلب ${request.ref}`, idempotency_key: `doc_agent_ready:${request.id}:${Date.now()}` });
  return { outputs, remaining };
}

async function packageOutputs(request) {
  const outs = await sb(`doc_agent_outputs?request_id=eq.${request.id}&select=id,delivery_name,storage_key,version_no,kind&order=created_at.desc`);
  // newest version of each delivery name only
  const seen = new Set(); const chosen = [];
  for (const o of outs) { if (!seen.has(o.delivery_name)) { seen.add(o.delivery_name); chosen.push(o); } }
  if (!chosen.length) return { ok: false, error: "no_outputs" };
  const files = await sb(`doc_agent_files?request_id=eq.${request.id}&role=eq.source&select=file_name,storage_key`);
  const entries = [];
  for (const o of chosen) entries.push([`Client Submission Package/Required Documents/${o.delivery_name}`, await storageGet(o.storage_key)]);
  for (const f of files.slice(0, 30)) entries.push([`Client Submission Package/Supporting Documents/${f.file_name}`, await storageGet(f.storage_key)]);
  const buf = zip(entries);
  const key = `${request.organization_id}/doc-agent/${request.id}/package-${Date.now()}.zip`;
  await storagePut(key, buf, "application/zip");
  await setReq(request.id, { package_storage_key: key, status: "DELIVERED", delivered_at: new Date().toISOString() });
  await sb("doc_agent_outputs", { method: "POST", prefer: "return=minimal", body: [{ request_id: request.id, kind: "package_zip", delivery_name: "Client Submission Package.zip", storage_key: key, mime: "application/zip", size_bytes: buf.length, version_no: 1 + outs.filter((o) => o.kind === "package_zip").length, qa_status: "waived" }] });
  await vaultSync(request, "package", { name: `Client Submission Package — ${request.ref}.zip`, mime: "application/zip", role: "package", doc_kind: "package", size: buf.length }, key);
  return { ok: true, key, files: entries.length };
}

/* ---------------------------------------------------------------- handler */
export async function handleDocAgent(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!DB_ON) return j(res, 503, { ok: false, error: "db_not_configured" });

  // n8n WhatsApp intake: hook-key guarded, no browser session. n8n identifies
  // the client (phone → org via its own lookup) and forwards messages/files.
  if (req.method === "POST" && (req.headers["x-doc-agent-key"] || "")) {
    return whatsappIntake(req, res);
  }

  // ---- owner/consultant panel (/doc-agent-admin) --------------------------
  // Same key/نفاذ ticket as the rest of /admin. Read-and-repair surface:
  // see every request, its files/facts/outputs, message the client as the
  // consultant, fix a misclassified file, and re-run generation.
  const q0 = req.query || {};
  const preBody = req.method === "POST" ? await readBody(req) : null;
  const adminAction = String((req.method === "GET" ? q0.action : preBody && preBody.action) || "");
  if (adminAction.startsWith("admin-")) {
    if (!adminOk(req.method === "GET" ? q0 : preBody)) return j(res, 401, { ok: false, error: "unauthorized" });
    try {
      if (adminAction === "admin-list") {
        const rows = await sb(
          "doc_agent_requests?select=ref,status,channel,contact,locale,created_at,updated_at,organization_id," +
          "organizations(name_ar,name_en)&order=updated_at.desc&limit=40"
        );
        return j(res, 200, { ok: true, requests: rows.map((r) => ({
          ref: r.ref, status: r.status, channel: r.channel, contact: r.contact,
          org: r.organizations ? (r.organizations.name_ar || r.organizations.name_en) : null,
          organization_id: r.organization_id, created_at: r.created_at, updated_at: r.updated_at,
        })) });
      }
      const request = adminAction === "admin-link" ? null :
        (await sb(`doc_agent_requests?ref=eq.${encodeURIComponent(String((req.method === "GET" ? q0.ref : preBody.ref) || ""))}&limit=1`))[0];
      if (adminAction !== "admin-link" && !request) return j(res, 404, { ok: false, error: "not_found" });
      if (adminAction === "admin-state") {
        const [files, facts, msgs, outs, gap] = await Promise.all([
          sb(`doc_agent_files?request_id=eq.${request.id}&select=id,role,doc_kind,file_name,mime,language,expiry_status,expiry_date,analysis_note,created_at&order=created_at`),
          sb(`doc_agent_facts?request_id=eq.${request.id}&select=fact_group,fact_key,value,status,confidence&order=fact_key&limit=250`),
          sb(`doc_agent_messages?request_id=eq.${request.id}&select=author,channel,body,created_at&order=created_at.desc&limit=100`),
          sb(`doc_agent_outputs?request_id=eq.${request.id}&select=id,kind,delivery_name,version_no,qa_status,qa_findings,fill_summary,created_at&order=created_at`),
          gapSummary(request.id),
        ]);
        return j(res, 200, { ok: true, request: { ref: request.ref, status: request.status, channel: request.channel, organization_id: request.organization_id, fill_color: request.fill_color, signature_mode: request.signature_mode, checklist: request.checklist }, files, facts, messages: msgs.reverse(), outputs: outs, gap });
      }
      if (adminAction === "admin-link") {
        const table = String(q0.table) === "files" ? "doc_agent_files" : "doc_agent_outputs";
        const rows = await sb(`${table}?id=eq.${encodeURIComponent(String(q0.id || ""))}&select=storage_key`);
        if (!rows.length) return j(res, 404, { ok: false, error: "not_found" });
        return j(res, 200, { ok: true, url: await storageSign(rows[0].storage_key, 600) });
      }
      if (adminAction === "admin-message") {
        const text = clip(preBody.message, 4000);
        if (!text) return j(res, 400, { ok: false, error: "no_message" });
        await addMsg(request.id, "consultant", "consultant", text);
        await audit({ organization_id: request.organization_id, actor_label: "consultant", action: "doc_agent.consultant_message", entity_type: "doc_agent_request", entity_id: request.id });
        return j(res, 200, { ok: true });
      }
      if (adminAction === "admin-set-role") {
        if (!FILE_ROLES.includes(String(preBody.role))) return j(res, 400, { ok: false, error: "invalid_fields" });
        await sb(`doc_agent_files?id=eq.${encodeURIComponent(String(preBody.file_id || ""))}&request_id=eq.${request.id}`, {
          method: "PATCH", prefer: "return=minimal", body: { role: String(preBody.role) },
        });
        return j(res, 200, { ok: true });
      }
      if (adminAction === "admin-generate") {
        const r = await generateOutputs(request, "consultant", clip(preBody.form_id, 60) || null);
        return j(res, 200, { ok: true, outputs: r.outputs, remaining: r.remaining });
      }
      return j(res, 400, { ok: false, error: "bad_action" });
    } catch (e) {
      console.error("doc-agent admin", String(e.message || e).slice(0, 200));
      return j(res, 502, { ok: false, error: "internal" });
    }
  }

  let sess = null;
  try { sess = await getSession(req); } catch { return j(res, 502, { ok: false, error: "db_failed" }); }
  if (!sess) return j(res, 401, { ok: false, error: "unauthorized" });
  const orgId = sess.organization && sess.organization.id;
  if (!orgId) return j(res, 400, { ok: false, error: "no_org" });
  const userId = sess.user && sess.user.id;

  try {
    if (req.method === "GET") {
      const q = req.query || {};
      if (q.action === "state") {
        const request = await reqByRef(String(q.ref || ""), orgId);
        if (!request) return j(res, 404, { ok: false, error: "not_found" });
        const [files, facts, msgs, outs, gap] = await Promise.all([
          sb(`doc_agent_files?request_id=eq.${request.id}&select=id,role,doc_kind,file_name,language,expiry_status,expiry_date,analysis_note,created_at&order=created_at`),
          sb(`doc_agent_facts?request_id=eq.${request.id}&select=id,fact_group,fact_key,value,status,confidence,source_page,confirmed_via&order=fact_key`),
          sb(`doc_agent_messages?request_id=eq.${request.id}&select=author,channel,body,created_at&order=created_at.desc&limit=50`),
          sb(`doc_agent_outputs?request_id=eq.${request.id}&select=id,kind,delivery_name,version_no,qa_status,fill_summary,created_at&order=created_at`),
          gapSummary(request.id),
        ]);
        return j(res, 200, { ok: true, request: { ref: request.ref, status: request.status, fill_color: request.fill_color, signature_mode: request.signature_mode, checklist: request.checklist, created_at: request.created_at }, files, facts, messages: msgs.reverse(), outputs: outs, gap });
      }
      if (q.action === "list") {
        const rows = await sb(`doc_agent_requests?organization_id=eq.${orgId}&select=ref,status,title,created_at,updated_at&order=updated_at.desc&limit=20`);
        return j(res, 200, { ok: true, requests: rows });
      }
      if (q.action === "output-link" || q.action === "file-link") {
        const table = q.action === "output-link" ? "doc_agent_outputs" : "doc_agent_files";
        const rows = await sb(`${table}?id=eq.${encodeURIComponent(String(q.id || ""))}&select=storage_key,request_id`);
        if (!rows.length) return j(res, 404, { ok: false, error: "not_found" });
        const owner = await sb(`doc_agent_requests?id=eq.${rows[0].request_id}&organization_id=eq.${orgId}&select=id&limit=1`);
        if (!owner.length) return j(res, 404, { ok: false, error: "not_found" });
        return j(res, 200, { ok: true, url: await storageSign(rows[0].storage_key, 600) });
      }
      return j(res, 400, { ok: false, error: "bad_action" });
    }

    if (req.method !== "POST") return j(res, 405, { ok: false, error: "method_not_allowed" });
    const b = preBody || {};
    const action = String(b.action || "");

    if (action === "start") {
      const ref = newRef();
      const rows = await sb("doc_agent_requests", {
        method: "POST",
        body: [{ ref, organization_id: orgId, user_id: userId, channel: "web", locale: clip(b.locale, 8) || "ar", title: clip(b.title, 160) || null }],
      });
      const request = rows[0];
      const hello = (request.locale === "en")
        ? "Upload the documents that contain your data, and the forms you need filled. I will read everything, use what is there, and ask you only for what is missing."
        : "ارفع المستندات التي تحتوي على البيانات، وارفع الملفات التي تريد تعبئتها. سأراجع كل شيء وأستخدم المعلومات المتوفرة وأطلب منك فقط ما هو ناقص.";
      await addMsg(request.id, "agent", "web", hello);
      await audit({ organization_id: orgId, actor_user_id: userId, action: "doc_agent.request_created", entity_type: "doc_agent_request", entity_id: request.id });
      return j(res, 200, { ok: true, ref, status: request.status });
    }

    const request = await reqByRef(String(b.ref || ""), orgId);
    if (!request) return j(res, 404, { ok: false, error: "not_found" });

    if (action === "upload") {
      const base64 = String(b.fileBase64 || "").slice(0, 11_000_000);
      const mime = String(b.fileType || "");
      const fileName = clip(b.fileName, 200) || "upload";
      if (!AGENT_MIME_OK.test(mime)) return j(res, 400, { ok: false, error: "bad_type" });
      const buf = Buffer.from(base64, "base64");
      if (!buf.length) return j(res, 400, { ok: false, error: "no_file" });
      if (buf.length > MAX_UPLOAD) return j(res, 413, { ok: false, error: "too_large", limit_mb: 3 });
      await setReq(request.id, { status: "ANALYZING" });
      const { fileRow, merge, role } = await classifyUpload(request, buf, base64, mime, fileName, userId);
      const gap = await gapSummary(request.id);
      await setReq(request.id, { status: gap.forms > 0 ? "MAPPING" : "EXTRACTING" });
      // One short agent message narrating what it understood.
      const ar = request.locale !== "en";
      const roleName = {
        source: ar ? "مستند مصدر" : "source document", target_form: ar ? "نموذج للتعبئة" : "form to fill",
        supporting: ar ? "مستند داعم" : "supporting document", stamp_asset: ar ? "ختم" : "stamp",
        signature_asset: ar ? "توقيع" : "signature", requirement: ar ? "قائمة متطلبات" : "requirements list",
        unknown: ar ? "بحاجة لتوضيح" : "needs clarification",
      }[role];
      let note = ar ? `استلمت «${fileName}» وصنّفته: ${roleName}.` : `Received "${fileName}" — classified as: ${roleName}.`;
      if (merge.added) note += ar ? ` أضفت ${merge.added} معلومة إلى ملفك.` : ` Added ${merge.added} facts to your profile.`;
      if (merge.conflicts.length) note += ar ? ` لاحظت تعارضاً في: ${merge.conflicts.map((c) => c.key).join("، ")} — سأسألك عنه.` : ` Found conflicts in: ${merge.conflicts.map((c) => c.key).join(", ")}.`;
      if (fileRow.expiry_status === "EXPIRED") note += ar ? " هذا المستند منتهي الصلاحية — سأكمل الطلب، والرجاء رفع نسخة محدثة قبل التقديم النهائي." : " This document is expired — I will continue, please upload a current copy before final submission.";
      await addMsg(request.id, "agent", "web", note);
      return j(res, 200, { ok: true, file: { id: fileRow.id, role, doc_kind: fileRow.doc_kind, expiry_status: fileRow.expiry_status }, facts_added: merge.added, conflicts: merge.conflicts, gap, note });
    }

    if (action === "chat") {
      const text = clip(b.message, 4000);
      if (!text) return j(res, 400, { ok: false, error: "no_message" });
      await addMsg(request.id, "client", "web", text);
      const [facts, msgs, gap, reqFiles] = await Promise.all([
        sb(`doc_agent_facts?request_id=eq.${request.id}&select=fact_key,value,status,confidence&order=fact_key&limit=150`),
        sb(`doc_agent_messages?request_id=eq.${request.id}&select=author,body&order=created_at.desc&limit=12`),
        gapSummary(request.id),
        sb(`doc_agent_files?request_id=eq.${request.id}&select=file_name,role,doc_kind&order=created_at`),
      ]);
      const sys = chatSystem(stateBlock(request, gap, facts, msgs.reverse(), reqFiles));
      const r = await askModel(`${sys}\n\nرسالة العميل الآن:\n${text}`, 3000);
      if (!r.ok) return j(res, 502, { ok: false, error: "upstream_error" });
      const reply = clip(r.data.reply, 6000) || "…";
      const actions = Array.isArray(r.data.actions) ? r.data.actions.slice(0, 30) : [];
      const applied = [];
      for (const a of actions) {
        try {
          if (a.type === "set_fact" && a.key && a.value != null) {
            if (SENSITIVE_KEY.test(String(a.key))) continue; // never via set_fact
            await upsertClientFact(request, String(a.key), String(a.value), "CLIENT_CONFIRMED", "web");
            applied.push(a);
          } else if (a.type === "confirm_declaration" && a.key && a.value != null) {
            await upsertClientFact(request, String(a.key), String(a.value), "CLIENT_CONFIRMED", "web", true);
            applied.push(a);
          } else if (a.type === "resolve_conflict" && a.key && a.value != null) {
            await sb(`doc_agent_facts?request_id=eq.${request.id}&fact_key=eq.${encodeURIComponent(String(a.key))}`, {
              method: "PATCH", prefer: "return=minimal",
              body: { value: clip(a.value, 500), status: "CLIENT_CONFIRMED", confirmed_via: "web", confirmed_at: new Date().toISOString(), conflict_with: null, updated_at: new Date().toISOString() },
            });
            applied.push(a);
          } else if (a.type === "set_fill_color" && FILL_HEX[a.color] !== undefined) {
            await setReq(request.id, { fill_color: a.color }); applied.push(a);
          } else if (a.type === "set_signature_mode" && ["leave_blank","typed_electronic","external_esign"].includes(a.mode)) {
            await setReq(request.id, { signature_mode: a.mode }); applied.push(a);
          } else if (a.type === "set_target_form" && a.file) {
            const hit = await setTargetForm(request, String(a.file));
            if (hit) applied.push({ ...a, file: hit });
          } else if (a.type === "ready_to_generate") {
            await setReq(request.id, { status: "READY_TO_GENERATE" }); applied.push(a);
          }
        } catch (e) { console.error("doc-agent action", a.type, String(e.message || e).slice(0, 120)); }
      }
      await addMsg(request.id, "agent", "web", reply, { actions: applied });
      // The promise is kept by the machine, not the model: when the model says
      // "generate", the page immediately runs the generate call and renders
      // download links in the chat — generate_now is that signal.
      const wantsGenerate = applied.some((a) => a.type === "ready_to_generate");
      const generateNow = wantsGenerate && (gap.forms > 0 || applied.some((a) => a.type === "set_target_form"));
      return j(res, 200, { ok: true, reply, actions: applied, generate_now: generateNow, ...(wantsGenerate ? { status: "READY_TO_GENERATE" } : {}) });
    }

    if (action === "set-option") {
      const patch = {};
      if (FILL_HEX[b.fill_color] !== undefined) patch.fill_color = b.fill_color;
      if (["leave_blank","typed_electronic","external_esign"].includes(b.signature_mode)) patch.signature_mode = b.signature_mode;
      if (!Object.keys(patch).length) return j(res, 400, { ok: false, error: "invalid_fields" });
      await setReq(request.id, patch);
      return j(res, 200, { ok: true });
    }

    if (action === "generate") {
      const formsCount = (await sb(`doc_agent_files?request_id=eq.${request.id}&role=eq.target_form&select=id&limit=1`)).length;
      if (!formsCount) return j(res, 400, { ok: false, error: "no_target_forms" });
      const r = await generateOutputs(request, "web", clip(b.form_id, 60) || null);
      return j(res, 200, { ok: true, outputs: r.outputs, remaining: r.remaining });
    }

    if (action === "package") {
      const r = await packageOutputs(request);
      if (!r.ok) return j(res, 400, r);
      return j(res, 200, { ok: true, files: r.files, url: await storageSign(r.key, 600) });
    }

    return j(res, 400, { ok: false, error: "bad_action" });
  } catch (e) {
    console.error("doc-agent", String(e.message || e).slice(0, 300));
    return j(res, 502, { ok: false, error: e.message === "db_failed" ? "db_failed" : "internal" });
  }
}

async function upsertClientFact(request, key, value, status, channel, isDeclaration) {
  const k = clip(key, 120); const v = clip(value, 500);
  const rows = await sb(`doc_agent_facts?request_id=eq.${request.id}&fact_key=eq.${encodeURIComponent(k)}&select=id&limit=1`);
  const body = {
    status, value: v, confirmed_via: channel, confirmed_at: new Date().toISOString(),
    confidence: "HIGH", updated_at: new Date().toISOString(),
  };
  if (rows.length) await sb(`doc_agent_facts?id=eq.${rows[0].id}`, { method: "PATCH", prefer: "return=minimal", body });
  else await sb("doc_agent_facts", { method: "POST", prefer: "return=minimal", body: [{ request_id: request.id, organization_id: request.organization_id, fact_group: isDeclaration ? "declarations" : (k.split(/[.[]/)[0] || "other"), fact_key: k, ...body }] });
  await audit({ organization_id: request.organization_id, action: isDeclaration ? "doc_agent.declaration_confirmed" : "doc_agent.fact_set", entity_type: "doc_agent_request", entity_id: request.id, after: { key: k, channel } });
}

// WhatsApp channel (via n8n): DOC_AGENT_HOOK_KEY authenticates the workflow;
// n8n resolves the phone number to contact/org and relays messages + files.
async function whatsappIntake(req, res) {
  const want = (process.env.DOC_AGENT_HOOK_KEY || "").trim();
  const got = String(req.headers["x-doc-agent-key"] || "");
  if (!want || got !== want) return j(res, 401, { ok: false, error: "unauthorized" });
  try {
    const b = await readBody(req);
    const contact = clip(b.contact, 60);
    if (!contact) return j(res, 400, { ok: false, error: "invalid_fields" });
    let orgId = null;
    if (b.organization_id && /^[0-9a-f-]{36}$/i.test(String(b.organization_id))) orgId = String(b.organization_id);
    let rows = await sb(`doc_agent_requests?contact=eq.${encodeURIComponent(contact)}&status=not.in.(COMPLETED,DELIVERED)&order=updated_at.desc&limit=1`);
    let request = rows[0];
    if (!request) {
      rows = await sb("doc_agent_requests", { method: "POST", body: [{ ref: newRef(), organization_id: orgId, contact, channel: "whatsapp", locale: clip(b.locale, 8) || "ar" }] });
      request = rows[0];
    }
    if (b.message) await addMsg(request.id, "client", "whatsapp", clip(b.message, 4000));
    let uploaded = null;
    if (b.fileBase64 && request.organization_id) {
      const mime = String(b.fileType || "");
      if (AGENT_MIME_OK.test(mime)) {
        const buf = Buffer.from(String(b.fileBase64).slice(0, 11_000_000), "base64");
        if (buf.length && buf.length <= MAX_UPLOAD) {
          const r = await classifyUpload(request, buf, String(b.fileBase64), mime, clip(b.fileName, 200) || "whatsapp-upload", null);
          uploaded = { role: r.role, facts_added: r.merge.added };
        }
      }
    }
    // Reply through the same orchestrator when there is a message to answer.
    let reply = null;
    if (b.message) {
      const [facts, msgs, gap, reqFiles] = await Promise.all([
        sb(`doc_agent_facts?request_id=eq.${request.id}&select=fact_key,value,status,confidence&limit=150`),
        sb(`doc_agent_messages?request_id=eq.${request.id}&select=author,body&order=created_at.desc&limit=12`),
        gapSummary(request.id),
        sb(`doc_agent_files?request_id=eq.${request.id}&select=file_name,role,doc_kind&order=created_at`),
      ]);
      const r = await askModel(`${chatSystem(stateBlock(request, gap, facts, msgs.reverse(), reqFiles))}\n\nرسالة العميل الآن (واتساب):\n${clip(b.message, 4000)}`, 3000);
      if (r.ok) { reply = clip(r.data.reply, 4000); await addMsg(request.id, "agent", "whatsapp", reply); }
    }
    return j(res, 200, { ok: true, ref: request.ref, uploaded, reply });
  } catch (e) {
    console.error("doc-agent whatsapp", String(e.message || e).slice(0, 200));
    return j(res, 502, { ok: false, error: "internal" });
  }
}
