// Business Partner — Simple V1 request engine (2026-09).
//
// One transaction for every customer need:
//   conversation → request → scope → quotation → approval → contract →
//   signature → checkout → payment → invoice → ready for execution.
//
// This is a shared module (leading underscore), reached through
// /api/requests?__route=simple (rewritten from /api/simple in vercel.json), so
// it costs no serverless function on the 12-function plan. Data lives in the
// operational Postgres (db/schema.sql: `requests`, `request_events`, `tasks`).
// The Notion CRM is not written here — the owner's dashboard reads Postgres.
//
// TEST MODE: on Vercel previews (VERCEL_ENV=preview) or when SIMPLE_TEST_MODE=1
// the engine signs contracts with an in-portal e-signature, accepts a
// simulated payment and issues a test invoice. Nothing here ever charges a
// card, sends a real DocuSign envelope or emails a customer unless
// SIMPLE_NOTIFY=1 is set explicitly.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sb, DB_ON, DB_MISSING, getSession, audit, notify } from "./_db.js";
import { contractHtml, quoteHtml } from "./_docusign.js";
import { loadCatalog } from "./_catalog.js";
import { daftraConfigured, daftraFindOrCreateClient, daftraCreateInvoice, daftraRecordPayment, daftraDocPdf, daftraVatRate } from "./_daftra.js";
import { ownerTicketOk, panelRequiresNafath } from "./_nafath.js";
import { DEV, EMAIL_LIVE, MODES, outbox, outboxList, PAY_MOCK, TAMARA_MOCK } from "./_mode.js";
import { isOwnerEmail } from "./_trial.js";
import { waSend, waNumber } from "./_stage.js";
import { storagePut, storageSign, storageDelete } from "./_db.js";
import { readDocumentRaw, parseJson, DOC_MIME_OK, MAX_DOC_BYTES } from "./_docread.js";

export const SIMPLE_TEST_MODE = process.env.SIMPLE_TEST_MODE === "1" || process.env.VERCEL_ENV === "preview" || DEV;
// Live since 2026-09-04: a customer who approves a quotation must be told the
// contract is waiting, and operations must hear about a new request. This was
// opt-in (SIMPLE_NOTIFY=1) while the layer was in preview — unset in
// production it meant every notice went silently to the outbox instead of an
// inbox. It is opt-out now; the real safety gate is below and unchanged:
// nothing leaves the machine unless EMAIL_MODE is live AND this is not a test
// deployment, so previews and localhost still cannot e-mail a real customer.
const NOTIFY_ON = process.env.SIMPLE_NOTIFY !== "0";
// عرض السعر الآلي (قرار المالك 2026-09-04): يصدر فوراً حين يسعّر الكتالوج كل
// بند. `SIMPLE_AUTO_QUOTE=0` يعيده يدوياً من اللوحة بلا نشرة عكسية.
const AUTO_QUOTE = process.env.SIMPLE_AUTO_QUOTE !== "0";
const SELF_BASE = (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");
const RESEND_API_KEY = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || "").trim();
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
// Every operational notice goes to the company mailboxes. A list, not one
// address: the domain moved once already and a single missed inbox means a
// customer's request sits unread.
const OWNER_EMAIL = process.env.BP_OWNER_EMAIL || "business@businesspartner.sa,business@businesspartnerksa.com";

export const REQUEST_TYPES = ["CONSULTATION", "GOVERNMENT_SERVICE", "COMPANY_FORMATION", "BUSINESS_DEVELOPMENT"];
export const REQUEST_SOURCES = ["WEBSITE", "WHATSAPP", "EMAIL", "PHONE", "AI_ASSISTANT", "MANUAL", "REFERRAL"];
export const REQUEST_STATUSES = [
  "NEW", "REVIEWING", "WAITING_CLIENT", "QUOTE_SENT", "QUOTE_APPROVED", "CONTRACT_SENT", "SIGNED",
  "PAYMENT_PENDING", "PAID", "IN_PROGRESS", "WAITING_INTERNAL", "COMPLETED", "CANCELLED",
];
const TASK_STATUS = { TODO: "open", IN_PROGRESS: "in_progress", WAITING: "blocked", DONE: "done" };
const TASK_STATUS_BACK = { open: "TODO", in_progress: "IN_PROGRESS", blocked: "WAITING", done: "DONE", cancelled: "DONE" };
const VAT_RATE = 0.15;

// ---------------------------------------------------------------- helpers --
const json = (res, code, obj) => { res.statusCode = code; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); };
const str = (v, n = 400) => String(v == null ? "" : v).trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n) => Math.round(n * 100) / 100;
const nowIso = () => new Date().toISOString();
const q = (s) => encodeURIComponent(String(s));
const newRef = () => "BP-R-" + crypto.randomBytes(3).toString("hex").toUpperCase();
const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim().slice(0, 64);

// The owner's panel key, exactly as /api/requests and /api/chat accept it.
const PANEL_KEYS = new Set([(process.env.PANEL_KEY || "").trim(), (process.env.LEADS_KEY || process.env.DASHBOARD_KEY || "").trim()].filter(Boolean));
function opsOk(src) {
  const key = String((src && src.key) || "").trim();
  const ticket = String((src && src.ticket) || "").trim();
  if (ticket && ownerTicketOk(ticket)) return true;
  if (!panelRequiresNafath() && PANEL_KEYS.size && PANEL_KEYS.has(key)) return true;
  // Preview/test only: a throwaway key so the owner can test /ops without
  // exposing the production panel key on a preview URL.
  if (SIMPLE_TEST_MODE && key && key === (process.env.SIMPLE_OPS_KEY || "test-ops")) return true;
  // Local development only: the documented dashboard key from .env.local.
  if (DEV && key && key === (process.env.SIMPLE_OPS_KEY || "test-ops")) return true;
  return false;
}

async function sendEmail(to, subject, html) {
  // "to" may be a comma-separated list (the owner mailboxes): send to each so
  // one bad address cannot swallow the whole notice.
  const list = String(to || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (list.length > 1) {
    const out = await Promise.all(list.map((one) => sendEmail(one, subject, html)));
    return out.find((r) => r.ok) || out[0] || { ok: false, error: "no_recipient" };
  }
  to = list[0] || "";
  // Local, preview, or an explicitly muted deployment: record it in the outbox
  // instead of mailing a person. SIMPLE_TEST_MODE is named here as well as in
  // EMAIL_LIVE because a preview that someone points at production e-mail
  // settings must still not reach a customer.
  if (!EMAIL_LIVE || SIMPLE_TEST_MODE || !NOTIFY_ON) {
    await outbox({ kind: "email", to, subject, body: html });
    return { ok: false, skipped: !EMAIL_LIVE ? "email_mode_" + MODES().email : SIMPLE_TEST_MODE ? "test_mode" : "notify_off" };
  }
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false, error: "email_not_configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `http_${r.status}` };
  } catch (e) { return { ok: false, error: String(e.message || "email_failed").slice(0, 80) }; }
}

async function logEvent(requestId, actorKind, actor, event, details) {
  try {
    await sb("request_events", { method: "POST", prefer: "return=minimal", body: [{ request_id: requestId, actor_kind: actorKind, actor: str(actor, 120), event: str(event, 160), details: details || null }] });
  } catch {}
}

async function getByRef(ref) {
  const rows = await sb(`requests?ref=eq.${q(ref)}&select=*&limit=1`);
  return rows[0] || null;
}
async function patchRequest(id, patch) {
  const rows = await sb(`requests?id=eq.${id}`, { method: "PATCH", body: { ...patch, updated_at: nowIso() } });
  return rows[0] || null;
}
async function eventsFor(id, limit = 80) {
  return sb(`request_events?request_id=eq.${id}&select=actor_kind,actor,event,details,created_at&order=created_at.asc&limit=${limit}`);
}
async function tasksFor(id) {
  const rows = await sb(`tasks?request_id=eq.${id}&select=id,title,details,assignee,source,status,urgency,priority,human_action,assigned_to,due_at,created_at,completed_at&order=created_at.asc`);
  return rows.map(taskOut);
}
const taskOut = (t) => ({ ...t, status: TASK_STATUS_BACK[t.status] || "TODO" });

// A client owns a request when it belongs to their organization or was
// created for their exact e-mail (manual intake before they registered).
function ownedBy(row, sess) {
  const email = String(sess.user?.email || "").toLowerCase();
  const orgId = sess.organization?.id;
  return (orgId && row.organization_id === orgId) || (email && String(row.client_email || "").toLowerCase() === email);
}
// The public view of a request — no internal notes, no assignment.
function clientView(row, events, tasks) {
  const { internal_notes, assigned_to, ai_summary, ...pub } = row;
  if (pub.contract && pub.contract.html) pub.contract = { ...pub.contract, html: undefined, html_signed: undefined, has_html: true };
  // Machine bookkeeping («notify.paid», «followup.task») is for the panel: the
  // customer's timeline used to print those keys raw.
  const visible = (e) => e.actor_kind !== "internal" && !/^(notify\.|followup\.task)/.test(String(e.event || ""));
  return { ...pub, attachments: clientAttachments(row), events: (events || []).filter(visible), tasks: (tasks || []).filter((t) => t.assignee === "client") };
}

// ------------------------------------------------------------- the files --
// One list, three kinds of entry, all in `requests.attachments` (no new column):
//   kind "document"    — a file the customer uploaded, usually against one of
//                        the documents we asked for (`doc` = that title)
//   kind "deliverable" — finished work the team hands over (by "team")
//   anything else      — older rows: a receipt, or a bare {name,url,note}
// Bytes live in storage under `path`; the row never holds a long-lived link.
// A link is signed on demand, after the request's ownership is checked.
//
// Same rules as the document vault (api/requests.js `ops-doc-upload`): the type
// is refused rather than guessed, the size is measured on the text BEFORE any
// Buffer exists, and the file must really look like what it says it is.
const UPLOAD_MIME = /^(application\/pdf|image\/(jpeg|png|webp)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel)$/;
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const UPLOAD_EXT = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
};
const UPLOAD_CAP = 60;          // files per request, all kinds together
const CUSTOMER_UPLOAD_CAP = 30;
function uploadMime(rawMime, fileName) {
  const m = String(rawMime || "").trim().toLowerCase();
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg";
  if (m && m !== "application/octet-stream" && m !== "binary/octet-stream") return m;
  return UPLOAD_EXT[String(fileName || "").split(".").pop().toLowerCase()] || m;
}
function sniffOk(mime, buf) {
  const b = buf;
  if (mime === "application/pdf") return b.subarray(0, 1024).includes("%PDF");
  if (mime === "image/jpeg") return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  if (mime === "image/webp") return b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  if (mime === "application/vnd.ms-excel") return b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0;
  // docx / xlsx are zip containers
  return b[0] === 0x50 && b[1] === 0x4B;
}
// Validates and stores one uploaded file. Never throws; returns the record that
// goes into `attachments`, or {ok:false,status,error}.
async function storeUpload(row, b, { kind, by, note, doc }) {
  const base64 = typeof b.base64 === "string" ? b.base64.replace(/^data:[^;]+;base64,/, "") : "";
  if (!base64) return { ok: false, status: 400, error: "no_file" };
  const display = str(b.file_name || b.fileName || b.name, 160).replace(/[\r\n]+/g, " ") || "file";
  const mime = uploadMime(b.mime, display);
  if (!UPLOAD_MIME.test(mime)) return { ok: false, status: 400, error: "bad_type" };
  // measured on the text first: 8 MB of bytes is ~10.7 M characters of base64
  if (base64.length > Math.ceil(UPLOAD_MAX_BYTES * 4 / 3) + 8) return { ok: false, status: 413, error: "too_large", max: UPLOAD_MAX_BYTES };
  const bytes = Buffer.byteLength(base64, "base64");
  if (bytes > UPLOAD_MAX_BYTES) return { ok: false, status: 413, error: "too_large", max: UPLOAD_MAX_BYTES };
  if (!bytes) return { ok: false, status: 400, error: "empty" };
  const buf = Buffer.from(base64, "base64");
  if (!sniffOk(mime, buf)) return { ok: false, status: 400, error: "bad_type" };
  const id = crypto.randomBytes(6).toString("hex");
  const ext = (display.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `requests/${row.ref}/${Date.now()}-${id}${ext ? "." + ext : ""}`;
  try { await storagePut(path, buf, mime); }
  catch (e) { console.error("simple upload store", String(e.message || e).slice(0, 160)); return { ok: false, status: 502, error: "storage_failed" }; }
  return { ok: true, rec: { id, name: display, path, size: bytes, mime, kind, note: str(note, 300), doc: str(doc, 200) || undefined, at: nowIso(), by } };
}
// What the customer's browser may see of an attachment: no storage path, no
// internal files, and a link only for the old rows that carried one.
function clientAttachments(row) {
  return (Array.isArray(row.attachments) ? row.attachments : [])
    .filter((a) => a && a.visibility !== "internal")
    .map((a) => ({
      id: a.id || undefined, name: a.name, title: a.title || undefined, note: a.note || "", at: a.at, by: a.by, kind: a.kind || "", doc: a.doc || "",
      size: a.size || 0, mime: a.mime || "", file: !!a.path,
      url: !a.path && /^https?:\/\//i.test(String(a.url || "")) ? a.url : undefined,
    }));
}

function normScope(items) {
  return (Array.isArray(items) ? items : []).slice(0, 30).map((it) => ({
    code: str(it.code, 40),
    title: str(it.title, 200),
    why: str(it.why, 400),
    qty: Math.max(1, Math.min(99, Math.round(num(it.qty) || 1))),
  })).filter((it) => it.title);
}
// The documents we ask the customer for. Each service has its own list; the
// advisor emits it beside the scope and ops can edit it afterwards.
const DOC_STATES = ["requested", "received", "waived"];
// The contract is derived from the approved quotation — same scope, same
// figures — so approving the quote is enough to produce it. It used to wait
// for a human to press a button in /ops, which left the customer looking at
// «سيصلك العقد للتوقيع» with nothing arriving.
function buildContract(row, opts = {}) {
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });
  const html = contractHtml({
    ref: row.ref, clientName: row.company_name || row.client_name || row.client_email, service: row.title,
    lines: row.quote.items.map((l) => ({ name: l.title, nameEn: l.titleEn, qty: l.qty, price: l.price, line: l.line })),
    net: row.quote.net, vat: row.quote.vat, total: row.quote.total, vatRate: 15,
    leadTime: str(opts.lead_time, 120), executor: str(opts.executor, 120) || "Business Partner", today,
    // لغة العميل تُطبع مقابل العربية — والعربية هي المرجع في نص العقد نفسه.
    lang: row.lang || "ar",
  });
  return {
    number: "C-" + row.ref.replace(/^BP-R-/, ""), status: "SENT", html,
    created_at: nowIso(), sent_at: nowIso(), quote_number: row.quote.number,
    mode: SIMPLE_TEST_MODE ? "test-esign" : "portal-esign",
  };
}

async function issueContract(row, actorKind, actor, opts) {
  const contract = buildContract(row, opts);
  const upd = await patchRequest(row.id, { contract, status: "CONTRACT_SENT" });
  await logEvent(row.id, actorKind, actor, "contract.sent", { number: contract.number });
  await announce(row, "contract", {
    subject: `عقد ${contract.number} بانتظار توقيعك`,
    clientLine: "عقدك جاهز للتوقيع الإلكتروني من حسابك — بعد التوقيع تنتقل مباشرة إلى الدفع.",
    opsLine: `صدر العقد ${contract.number} وأُرسل للتوقيع.`,
    cta: "افتح العقد ووقّعه",
  });
  return { contract, status: upd.status };
}

// Issuing a quotation is one operation with two doors: the operations desk
// (ops-quote) and the customer confirming their own scope (scope-confirm).
// Both must produce the same numbering, the same notification and the same
// scope rewrite, so the whole thing lives here once.
async function issueQuote(row, rawItems, opts, actorKind, actor) {
  const priced = await priceItems(rawItems);
  const quote = { number: "Q-" + row.ref.replace(/^BP-R-/, "") + (row.quote && row.quote.status === "REJECTED" ? "-R" : ""), status: "DRAFT", created_at: nowIso(), ...computeQuote(priced, opts) };
  if (!quote.items.length) return { ok: false, error: "no_items" };
  const send = opts.send !== false;
  if (send) { quote.status = "SENT"; quote.sent_at = nowIso(); }
  const upd = await patchRequest(row.id, { quote, scope: quote.items.map((l) => ({ code: l.code, title: l.title, why: l.description, qty: l.qty })), status: send ? "QUOTE_SENT" : row.status });
  await logEvent(row.id, actorKind, actor, send ? "quote.sent" : "quote.drafted", { number: quote.number, total: quote.total });
  if (send) await announce(row, "quote", {
    subject: `عرض سعر ${quote.number} — ${row.title}`,
    clientLine: `عرض سعرك جاهز: ${quote.total} ر.س شامل ضريبة القيمة المضافة. راجعه واعتمده من حسابك.`,
    opsLine: `صدر عرض السعر ${quote.number} بإجمالي ${quote.total} ر.س.`,
    cta: "راجع العرض واعتمده",
  });
  return { ok: true, quote, status: upd.status };
}

function normDocuments(list) {
  return (Array.isArray(list) ? list : []).slice(0, 25).map((d) => {
    const it = typeof d === "string" ? { title: d } : (d || {});
    return {
      title: str(it.title, 200),
      note: str(it.note, 400),
      status: DOC_STATES.includes(it.status) ? it.status : "requested",
      at: str(it.at, 40) || nowIso(),
      ...(it.received_at ? { received_at: str(it.received_at, 40) } : {}),
    };
  }).filter((d) => d.title);
}

// The machine block is never shown to a human. Models do not always close it
// with <<END>>, and they sometimes drop a bracket, so match loosely — a leaked
// «SCOPE>>» in a customer's chat is worse than over-trimming one line.
function stripScopeBlock(text) {
  return String(text == null ? "" : text)
    .replace(/<*\s*SCOPE\s*>>[\s\S]*?(?:<*\s*END\s*>>|$)/gi, "")
    .replace(/<*\s*(?:SCOPE|END)\s*>>/gi, "")
    .trim();
}

function normConversation(msgs) {
  return (Array.isArray(msgs) ? msgs : []).slice(-60).map((m) => ({
    role: ["user", "assistant", "bp", "system"].includes(m.role) ? m.role : "user",
    content: str(stripScopeBlock(m.content), 4000),
    at: m.at && !Number.isNaN(Date.parse(m.at)) ? new Date(m.at).toISOString() : nowIso(),
  })).filter((m) => m.content);
}

function computeQuote(items, opts = {}) {
  const lines = (Array.isArray(items) ? items : []).slice(0, 30).map((it) => {
    const qty = Math.max(1, Math.min(99, Math.round(num(it.qty) || 1)));
    const price = round2(Math.max(0, num(it.price)));
    return { code: str(it.code, 40), title: str(it.title, 200), titleEn: str(it.titleEn, 200), description: str(it.description, 600), qty, price, line: round2(qty * price) };
  }).filter((l) => l.title);
  const net = round2(lines.reduce((s, l) => s + l.line, 0));
  const vat = round2(net * VAT_RATE);
  const validityDays = Math.max(1, Math.min(90, Math.round(num(opts.validity_days) || 14)));
  return {
    items: lines, net, vat, total: round2(net + vat), vat_rate: 15, currency: "SAR",
    validity_days: validityDays,
    valid_until: new Date(Date.now() + validityDays * 864e5).toISOString().slice(0, 10),
    payment_terms: str(opts.payment_terms, 600) || "الدفع مقدماً بعد توقيع العقد",
    notes: str(opts.notes, 1500),
  };
}

// ------------------------------------------------------------ the handler --
export async function handleSimple(req, res) {
  if (!DB_ON) return json(res, 503, { ok: false, error: "db_off", message: `قاعدة البيانات غير مضبوطة (${DB_MISSING}).` });
  let body = {};
  if (req.method === "POST") {
    try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch { return json(res, 400, { ok: false, error: "bad_json" }); }
  }
  const qs = req.query || {};
  const action = str(body.action || qs.action, 60);
  const isOps = action.startsWith("ops-");
  try {
    if (action === "config") {
      return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, notify: NOTIFY_ON, modes: MODES(), types: REQUEST_TYPES, statuses: REQUEST_STATUSES, sources: REQUEST_SOURCES });
    }
    if (isOps) {
      // Two doors into operations. The panel key is for automation (n8n) and
      // for staff who have no account. The owner's own session is the other:
      // he asked for the dashboard to open from his company e-mail, and a
      // secret string he has to carry between devices is not that.
      let opsUser = null;
      if (!opsOk({ key: body.key || qs.key, ticket: body.ticket || qs.ticket })) {
        const sess = await getSession(req);
        if (!isOwnerEmail(sess && sess.user && sess.user.email)) {
          return json(res, 401, { ok: false, error: "unauthorized", signin: `${SELF_BASE}/ar/my` });
        }
        opsUser = { email: String(sess.user.email).toLowerCase(), name: sess.user.full_name || "" };
      }
      return opsAction(action, body, qs, req, res, opsUser);
    }
    const sess = await getSession(req);
    if (!sess) return json(res, 401, { ok: false, error: "no_session", message: "سجّل دخولك أولاً." });
    return clientAction(action, body, qs, req, res, sess);
  } catch (e) {
    console.error("simple:", action, e && e.message);
    return json(res, 500, { ok: false, error: "server_error" });
  }
}

// ------------------------------------------------------------ client side --
async function clientAction(action, b, qs, req, res, sess) {
  const email = String(sess.user?.email || "").toLowerCase();
  const orgId = sess.organization?.id || null;
  const who = sess.user?.full_name || email;

  if (action === "me") {
    // Claim requests created for this e-mail before the client registered.
    if (orgId) { try { await sb(`requests?client_email=eq.${q(email)}&organization_id=is.null`, { method: "PATCH", prefer: "return=minimal", body: { organization_id: orgId, user_id: sess.user.id } }); } catch {} }
    const mine = await myRequests(sess);
    const counts = {
      active: mine.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status)).length,
      quotes: mine.filter((r) => r.status === "QUOTE_SENT").length,
      contracts: mine.filter((r) => r.status === "CONTRACT_SENT").length,
      payments: mine.filter((r) => ["SIGNED", "PAYMENT_PENDING"].includes(r.status)).length,
      appointments: mine.filter((r) => r.appointment && r.appointment.status !== "CANCELLED" && r.appointment.date >= nowIso().slice(0, 10)).length,
    };
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, user: { name: sess.user.full_name || "", email }, organization: sess.organization, counts, requests: mine.map(summary) });
  }

  if (action === "requests") {
    const mine = await myRequests(sess);
    return json(res, 200, { ok: true, requests: mine.map(summary) });
  }

  if (action === "request-create") {
    const type = REQUEST_TYPES.includes(b.type) ? b.type : "CONSULTATION";
    const source = REQUEST_SOURCES.includes(b.source) ? b.source : "WEBSITE";
    const conversation = normConversation(b.conversation);
    const scope = normScope(b.scope);
    const ref = newRef();
    const row = {
      ref, organization_id: orgId, user_id: sess.user.id, type, source, status: "NEW",
      lang: ["ar", "en", "fr", "zh"].includes(b.lang) ? b.lang : "ar",
      title: str(b.title, 200) || defaultTitle(type, b.lang),
      summary: str(b.summary, 2000),
      conversation, scope, documents: normDocuments(b.documents),
      client_name: str(b.name || sess.user.full_name, 160), client_email: email, client_phone: str(b.phone, 40),
      company_name: str(b.company || sess.organization?.name_ar || sess.organization?.name_en, 200),
    };
    const rows = await sb("requests", { method: "POST", body: [row] });
    const created = rows[0];
    await logEvent(created.id, "customer", who, "request.created", { type, source, items: scope.length });
    if (scope.length) await logEvent(created.id, "ai", "المستشار الذكي", "scope.proposed", { items: scope.map((s) => s.title) });
    if (row.documents.length) await logEvent(created.id, "ai", "المستشار الذكي", "documents.requested", { documents: row.documents.map((d) => d.title) });
    await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "simple.request.create", entity: "requests", entity_id: created.id, meta: { ref } });
    await sendEmail(OWNER_EMAIL, `طلب جديد ${ref} — ${row.title}`, `<p>${esc(row.client_name)} · ${esc(email)}</p><p>${esc(row.summary)}</p><p><a href="${SELF_BASE}/ops?ref=${ref}">فتح الطلب</a></p>`);
    return json(res, 200, { ok: true, ref, request: clientView(created, [], []) });
  }

  // Everything below is about one request the client owns.
  const ref = str(b.ref || qs.ref, 40);
  if (!ref) return json(res, 400, { ok: false, error: "missing_ref" });
  const row = await getByRef(ref);
  if (!row || !ownedBy(row, sess)) return json(res, 404, { ok: false, error: "not_found" });

  if (action === "request-get") {
    const [events, tasks] = await Promise.all([eventsFor(row.id), tasksFor(row.id)]);
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, request: clientView(row, events, tasks) });
  }

  if (action === "request-message") {
    const role = b.role === "assistant" ? "assistant" : "user";
    const content = str(b.content, 4000);
    if (!content) return json(res, 400, { ok: false, error: "empty" });
    const conversation = normConversation([...(row.conversation || []), { role, content, at: nowIso() }]);
    const patch = { conversation };
    if (role === "user" && row.status === "WAITING_CLIENT") patch.status = "REVIEWING";
    const upd = await patchRequest(row.id, patch);
    if (role === "user") {
      await logEvent(row.id, "customer", who, "message.customer", { preview: content.slice(0, 140) });
      // The customer wrote inside the request and nobody on the team was told:
      // the only sign was a badge on a panel no one had open. Now the team
      // gets the mail + WhatsApp and one open «reply» task per request.
      await alertOps({ ...row, ...upd }, "message-in", {
        subject: `رسالة جديدة من العميل — ${row.ref}`,
        line: `${row.client_name || who} كتب في الطلب «${row.title}»: ${content.slice(0, 220)}`,
        task: {
          source: "reply.customer", urgency: "high",
          title: `ردّ على رسالة العميل — ${row.ref}`,
          details: content.slice(0, 400),
        },
      });
    }
    return json(res, 200, { ok: true, conversation: upd.conversation, status: upd.status });
  }

  if (action === "scope-update") {
    if (isCartRow(row)) return json(res, 409, { ok: false, error: "scope_locked", message: "طلب الشراء المباشر نطاقه ما اشتريته — لا يُعدَّل." });
    if (!["NEW", "REVIEWING", "WAITING_CLIENT"].includes(row.status)) return json(res, 409, { ok: false, error: "scope_locked", message: "النطاق مقفل بعد إصدار عرض السعر." });
    const scope = normScope(b.scope);
    await patchRequest(row.id, { scope });
    await logEvent(row.id, "customer", who, "scope.edited", { items: scope.map((s) => s.title) });
    return json(res, 200, { ok: true, scope });
  }

  // Saving the scope used to end the journey: the customer pressed a button,
  // read «تم الحفظ» and nothing else happened until someone in operations
  // noticed. Confirming the scope now hands the request on — the customer sees
  // the next step, operations gets a pricing task and a notification. The
  // quotation itself is still issued by hand from /ops (owner's rule): the
  // price on a scope is a commercial decision, not a lookup.
  if (action === "scope-confirm") {
    if (isCartRow(row)) return json(res, 409, { ok: false, error: "scope_locked", message: "طلب الشراء المباشر مدفوع مسبقاً — لا عرض سعر له." });
    if (!["NEW", "REVIEWING", "WAITING_CLIENT"].includes(row.status)) return json(res, 409, { ok: false, error: "scope_locked", message: "النطاق مقفل بعد إصدار عرض السعر." });
    const scope = normScope(b.scope && b.scope.length ? b.scope : row.scope);
    if (!scope.length) return json(res, 400, { ok: false, error: "no_items", message: "أضف بنداً واحداً على الأقل إلى نطاق الخدمات." });
    await patchRequest(row.id, { scope });
    await logEvent(row.id, "customer", who, "scope.confirmed", { items: scope.map((it) => it.title) });

    const priced = await priceItems(scope);
    const unpriced = priced.filter((l) => !(num(l.price) > 0)).map((l) => l.title);

    // كل بند له سعر في الكتالوج ⇒ عرض السعر يصدر فوراً. الكتالوج هو القرار
    // الذي اتُّخذ مسبقاً؛ إعادة اتخاذه يدوياً في كل طلب تأخيرٌ بلا حكم مضاف،
    // والعميل ينتظره ساعات.
    //
    // وبندٌ واحد بلا سعر يُعيد الطلب إلى اللوحة كما كان: السعر يأتي من الرمز
    // في الكتالوج أو من إنسان، ولا يُخترع بينهما. هذا هو الشرط الذي جعل
    // الأتمتة ممكنة — «طالما في كاتالوج للأسعار والعروض واضحة».
    if (!unpriced.length && AUTO_QUOTE) {
      const issued = await issueQuote({ ...row, scope }, scope, {}, "system", "التسعير الآلي");
      if (issued.ok) {
        await logEvent(row.id, "system", "التسعير الآلي", "quote.auto", { number: issued.quote.number, total: issued.quote.total });
        return json(res, 200, { ok: true, stage: "QUOTE", status: issued.status, scope, quote: issued.quote, auto: true });
      }
    }

    // Lines with no catalogue price are flagged for whoever prices the quote,
    // so /ops sees at a glance what still needs a decision.
    const upd = await patchRequest(row.id, { status: "REVIEWING" });
    await pricingTask(row, unpriced);
    await logEvent(row.id, "system", "النظام", "quote.pending", { unpriced });
    await announce({ ...row, scope }, "scope", {
      subject: `نطاق معتمد بانتظار التسعير — ${row.ref}`,
      clientLine: "اعتمدنا نطاق خدماتك، والفريق يجهّز عرض السعر — بندٌ أو أكثر يحتاج تسعيراً بشرياً.",
      opsLine: `بنود بلا سعر في الكتالوج: ${unpriced.join(" · ") || "—"}`,
    });
    return json(res, 200, { ok: true, stage: "PRICING", status: upd.status, scope, unpriced });
  }

  // A document the customer sends inside the request. With `base64` it is a real
  // upload (the file is stored, and if `doc_title` / `doc_index` names one of
  // the documents we asked for, that line flips to «received»). Without it, the
  // old {name,url,note} shape still works — but only for an http(s) link: the
  // panel renders `url` as a link, and «javascript:» must never get there.
  if (action === "attachment-add") {
    if (row.status === "CANCELLED") return json(res, 409, { ok: false, error: "request_closed" });
    const all = Array.isArray(row.attachments) ? row.attachments : [];
    if (typeof b.base64 !== "string" || !b.base64) {
      const link = str(b.url, 600);
      const att = { name: str(b.name, 160), url: /^https?:\/\//i.test(link) ? link : "", note: str(b.note, 300), at: nowIso(), by: "customer" };
      if (!att.name) return json(res, 400, { ok: false, error: "missing_name" });
      const attachments = [...all, att].slice(-UPLOAD_CAP);
      await patchRequest(row.id, { attachments });
      await logEvent(row.id, "customer", who, "attachment.added", { name: att.name });
      return json(res, 200, { ok: true, attachments: clientAttachments({ attachments }) });
    }
    if (all.length >= UPLOAD_CAP || all.filter((a) => a && a.by === "customer" && a.kind === "document").length >= CUSTOMER_UPLOAD_CAP) {
      return json(res, 409, { ok: false, error: "too_many_files" });
    }
    const docs = normDocuments(row.documents);
    let at = -1;
    if (b.doc_index != null && b.doc_index !== "" && Number.isInteger(Number(b.doc_index)) && docs[Number(b.doc_index)]) at = Number(b.doc_index);
    if (at < 0 && b.doc_title) at = docs.findIndex((d) => d.title === str(b.doc_title, 200));
    const stored = await storeUpload(row, b, { kind: "document", by: "customer", note: b.note, doc: at >= 0 ? docs[at].title : "" });
    if (!stored.ok) return json(res, stored.status, { ok: false, error: stored.error, max: stored.max });
    const attachments = [...all, stored.rec].slice(-UPLOAD_CAP);
    const patch = { attachments };
    if (at >= 0 && docs[at].status !== "received") { docs[at] = { ...docs[at], status: "received", received_at: nowIso() }; patch.documents = docs; }
    const upd = await patchRequest(row.id, patch);
    await logEvent(row.id, "customer", who, "attachment.added", { name: stored.rec.name, doc: stored.rec.doc || undefined });
    if (patch.documents) await logEvent(row.id, "customer", who, "document.received", { title: docs[at].title });
    await alertOps({ ...row, ...upd }, "doc-in", {
      subject: `مستند جديد من العميل — ${row.ref}`,
      line: `${row.client_name || who} رفع ${stored.rec.doc ? "المستند المطلوب «" + stored.rec.doc + "»" : "ملفاً"} (${stored.rec.name}) على الطلب «${row.title}».`,
      windowMin: 2,
    });
    return json(res, 200, { ok: true, attachments: clientAttachments({ attachments }), documents: upd.documents || docs, received: at >= 0 ? docs[at].title : null });
  }

  // A short-lived link to one file on this request — the customer's own upload
  // or work the team delivered. The request was already matched to the signed-in
  // customer above; the id must belong to THAT request's list.
  if (action === "attachment-link") {
    const att = (row.attachments || []).find((a) => a && a.id && a.id === str(b.id || qs.id, 40) && a.visibility !== "internal");
    if (!att || !att.path) return json(res, 404, { ok: false, error: "not_found" });
    let url = "";
    try { url = (await storageSign(att.path, 300)) || ""; } catch (e) { console.error("simple link", String(e.message || e).slice(0, 120)); }
    if (!url) return json(res, 502, { ok: false, error: "link_failed" });
    return json(res, 200, { ok: true, url, name: att.name, mime: att.mime || "" });
  }

  // إيصال التحويل البنكي: العميل يرفعه هنا، فيقرأه المستشار ويقارن مبلغه
  // بإجمالي الطلب. القراءة ليست إثباتاً لوصول المال — ولذلك لا تُعلَّم الحالة
  // «مدفوعة» هنا أبداً؛ تُفتح مهمة تأكيد على لوحة العمليات بنتيجة المقارنة.
  //
  // منذ 2026-09-24 (أمر المالك: الدفع إلكتروني فقط) لا تعرض /checkout الجديدة
  // التحويل البنكي ولا تنادي هذا المسار. يبقى للطلبات التي بدأت تحويلاً قبل
  // القرار وما زالت بحالة PAYMENT_PENDING — حذفه يقطعها في منتصف الطريق.
  if (action === "receipt-upload") {
    const total = round2(num(row.quote?.total));
    if (!total) return json(res, 409, { ok: false, error: "no_quote" });
    const mime = str(b.mime, 80);
    const base64 = String(b.base64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!base64) return json(res, 400, { ok: false, error: "no_file" });
    if (!DOC_MIME_OK.test(mime)) return json(res, 400, { ok: false, error: "bad_type" });
    const bytes = Buffer.byteLength(base64, "base64");
    if (bytes > MAX_DOC_BYTES) return json(res, 413, { ok: false, error: "too_large", max: MAX_DOC_BYTES });

    const safe = (str(b.name, 90) || "receipt").replace(/[^\w.\-\u0600-\u06FF ]+/g, "_");
    const path = `receipts/${row.ref}/${Date.now()}-${safe}`;
    let url = "";
    try {
      await storagePut(path, Buffer.from(base64, "base64"), mime || "application/octet-stream");
      url = (await storageSign(path, 60 * 60 * 24 * 60)) || "";
    } catch (e) { console.error("receipt store", String(e.message || e).slice(0, 160)); }

    const prompt = [
      "هذا إيصال/إشعار تحويل بنكي. أعِد JSON فقط بلا أي نص آخر بالمفاتيح:",
      '{"amount":number|null,"currency":string|null,"date":string|null,"sender":string|null,',
      '"beneficiary":string|null,"bank":string|null,"reference":string|null,"is_receipt":boolean}',
      "amount هو المبلغ المحوَّل بالأرقام بلا فواصل. إن لم تجد قيمة ضعها null. لا تخمّن.",
    ].join(" ");
    let read = null, provider = "";
    try {
      const raw = await readDocumentRaw(base64, mime, prompt, 500);
      if (raw && raw.ok) { read = parseJson(String(raw.data || "")); provider = raw.provider || ""; }
    } catch (e) { console.error("receipt read", String(e.message || e).slice(0, 160)); }

    const amount = read && Number.isFinite(Number(read.amount)) ? round2(Number(read.amount)) : null;
    const diff = amount == null ? null : round2(amount - total);
    const verdict = amount == null ? "unreadable" : Math.abs(diff) <= 1 ? "match" : amount > total ? "over" : "short";

    const receipt = {
      name: safe, url, size: bytes, mime, at: nowIso(), provider,
      read: read ? { amount, currency: read.currency || null, date: read.date || null,
                     sender: read.sender || null, beneficiary: read.beneficiary || null,
                     bank: read.bank || null, reference: read.reference || null } : null,
      expected: total, diff, verdict,
    };
    const attachments = [...(row.attachments || []), { name: safe, url, note: "إيصال تحويل بنكي", kind: "receipt", at: receipt.at, by: "customer" }].slice(-40);
    const payment = { ...(row.payment || {}), status: "REVIEW", provider: "bank", amount, currency: "SAR", at: receipt.at, receipt };
    const upd = await patchRequest(row.id, { attachments, payment, status: "PAYMENT_PENDING" });
    await logEvent(row.id, "ai", "المستشار الذكي", "payment.receipt", { verdict, amount, expected: total });
    await sweepTask(upd, {
      source: "receipt.verify", urgency: "high", human: true,
      title: () => `تأكيد وصول تحويل بنكي — ${row.ref}`,
      details: () => `قراءة الإيصال: ${amount == null ? "تعذّرت" : amount + " ر.س"} · المطلوب: ${total} ر.س · النتيجة: ${verdict}. افتح الحساب البنكي وأكّد الوصول قبل التفعيل — قراءة الصورة ليست إثباتاً.`,
    }, "المستشار الذكي");

    const VER = { match: "مطابق للإجمالي", over: "أعلى من الإجمالي", short: "أقل من الإجمالي", unreadable: "تعذّرت قراءة المبلغ" };
    await announce(upd, "receipt", {
      subject: `إيصال تحويل مرفوع — ${row.ref}`,
      clientLine: amount == null
        ? "استلمنا إيصالك ويراجعه الفريق الآن. نبلغك فور تأكيد وصول المبلغ."
        : `استلمنا إيصالك: ${amount} ر.س (${VER[verdict]}). نؤكّد لك وصول المبلغ بعد التحقق من الحساب البنكي.`,
      opsLine: `${row.client_name} رفع إيصالاً. القراءة: ${amount == null ? "—" : amount + " ر.س"} · المطلوب: ${total} ر.س · ${VER[verdict]}${url ? ` · الملف: ${url}` : " · تعذّر حفظ الملف"}`,
      cta: "افتح الطلب في لوحة العمليات",
    });
    return json(res, 200, { ok: true, status: upd.status, receipt: { ...receipt, url: undefined }, verdict, amount, expected: total });
  }

  if (action === "quote-approve" || action === "quote-reject") {
    if (row.status !== "QUOTE_SENT" || !row.quote) return json(res, 409, { ok: false, error: "no_open_quote" });
    const approve = action === "quote-approve";
    const quote = { ...row.quote, status: approve ? "APPROVED" : "REJECTED", decided_at: nowIso(), decision_note: str(b.note, 500) };
    const upd = await patchRequest(row.id, { quote, status: approve ? "QUOTE_APPROVED" : "WAITING_CLIENT" });
    await logEvent(row.id, "customer", who, approve ? "quote.approved" : "quote.rejected", { number: quote.number, note: quote.decision_note });
    await sendEmail(OWNER_EMAIL, `${approve ? "اعتماد" : "رفض"} عرض السعر ${quote.number} (${ref})`, `<p>${esc(who)}: ${esc(quote.decision_note || "")}</p>`);
    if (approve) {
      // No waiting on a human: the approved quotation already contains
      // everything the contract states.
      const issued = await issueContract({ ...upd, quote }, "system", "النظام", {});
      return json(res, 200, { ok: true, status: issued.status, quote, contract: { ...issued.contract, html: undefined } });
    }
    return json(res, 200, { ok: true, status: upd.status, quote });
  }

  // العرض كمستند كامل بلغتين — نفس ورقة العقد، تُفتح بالحجم الكامل وتُطبع.
  if (action === "quote-view") {
    if (!row.quote) return json(res, 404, { ok: false, error: "no_quote" });
    const html = quoteHtml({
      ref: row.ref, number: row.quote.number,
      clientName: row.company_name || row.client_name || row.client_email,
      items: row.quote.items || [], net: row.quote.net, vat: row.quote.vat, total: row.quote.total,
      validUntil: row.quote.valid_until || "", paymentTerms: row.quote.payment_terms || "",
      notes: row.quote.notes || "", lang: row.lang || "ar",
      today: new Date(row.quote.created_at || Date.now()).toLocaleDateString("ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" }),
    });
    return json(res, 200, { ok: true, html, number: row.quote.number });
  }

  if (action === "contract-view") {
    if (!row.contract || !row.contract.html) return json(res, 404, { ok: false, error: "no_contract" });
    // العقد مشتقٌّ من عرض السعر، فيُعاد بناؤه من البيانات الحالية عند العرض.
    // هذا ما يُصلح عقوداً حُفظت قبل إصلاح خطأ «٠ ريال» في كل سطر.
    //
    // وإن كان موقَّعاً: تُحفظ البايتات الموقَّعة الأصلية في html_signed قبل أي
    // استبدال — بصمة SHA-256 في التوقيع مأخوذةٌ منها، ولا يجوز أن تختفي —
    // ويُسجَّل حدث contract.corrected. عرضُ نسخةٍ مصحَّحة لا يجعل التوقيع
    // ساريا عليها: عقدٌ صُحِّح بعد التوقيع يحتاج توقيعاً جديداً، ولوحة
    // العمليات تقولها للمالك صراحةً.
    let html = row.contract.html;
    let contract = row.contract;
    if (row.quote && Array.isArray(row.quote.items) && row.quote.items.length) {
      try {
        const rebuilt = buildContract(row, {});
        if (rebuilt.html && rebuilt.html !== row.contract.html) {
          const signed = !!row.contract.signature;
          contract = {
            ...row.contract, html: rebuilt.html,
            ...(signed && !row.contract.html_signed ? { html_signed: row.contract.html, corrected_at: nowIso() } : {}),
            ...(signed ? { needs_resign: true } : {}),
          };
          await patchRequest(row.id, { contract });
          html = rebuilt.html;
          if (signed) await logEvent(row.id, "system", "النظام", "contract.corrected", { number: row.contract.number, reason: "line_totals" });
        }
      } catch (e) { console.error("contract rebuild", String(e.message || e).slice(0, 140)); }
    }
    return json(res, 200, { ok: true, html, needsResign: !!contract.needs_resign, contract: { ...contract, html: undefined, html_signed: undefined } });
  }

  if (action === "contract-sign") {
    if (row.status !== "CONTRACT_SENT" || !row.contract) return json(res, 409, { ok: false, error: "no_open_contract" });
    if (!b.consent) return json(res, 400, { ok: false, error: "consent_required", message: "يلزم الموافقة على التوقيع الإلكتروني." });
    const signerName = str(b.name, 160) || who;
    const hash = crypto.createHash("sha256").update(String(row.contract.html || "")).digest("hex");
    const signature = {
      name: signerName, email, ip: clientIp(req), ua: str(req.headers["user-agent"], 200), at: nowIso(),
      contract_sha256: hash, image: typeof b.signature === "string" && b.signature.startsWith("data:image/") ? b.signature.slice(0, 60000) : null,
      mode: SIMPLE_TEST_MODE ? "test-esign" : "portal-esign",
    };
    const contract = { ...row.contract, status: "SIGNED", signed_at: signature.at, signature };
    const upd = await patchRequest(row.id, { contract, status: "SIGNED", payment: { status: "PENDING", amount: row.quote?.total || 0, currency: "SAR", provider: null } });
    await logEvent(row.id, "customer", who, "contract.signed", { number: contract.number, mode: signature.mode, sha256: hash.slice(0, 16) });
    await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "simple.contract.sign", entity: "requests", entity_id: row.id, meta: { ref, sha256: hash } });
    await announce(upd, "signed", {
      subject: `تم توقيع العقد ${contract.number} — الخطوة التالية الدفع`,
      clientLine: `شكراً لك، استلمنا توقيعك. يبقى الدفع لنبدأ التنفيذ: ${num(row.quote?.total) || 0} ر.س.`,
      opsLine: `${signerName} وقّع العقد إلكترونياً. بانتظار الدفع.`,
      cta: "ادفع الآن من حسابك",
    });
    return json(res, 200, { ok: true, status: upd.status, contract: { ...contract, html: undefined } });
  }

  if (action === "checkout-start") {
    if (!["SIGNED", "PAYMENT_PENDING"].includes(row.status) || !row.quote) return json(res, 409, { ok: false, error: "not_payable" });
    await patchRequest(row.id, { status: "PAYMENT_PENDING" });
    const item = {
      id: "sv1:" + row.ref, kind: "quote", qty: 1, amount: row.quote.net, price: row.quote.net + " ر.س", pricePublic: 1,
      nameAr: `${row.title} — عرض ${row.quote.number}`, nameEn: `${row.title} — Quote ${row.quote.number}`,
      surchargeAmount: 0, surchargeFreeCount: 0, billingPeriod: "", renewsAt: "", commissionPercent: 0,
    };
    return json(res, 200, { ok: true, item, testMode: SIMPLE_TEST_MODE, total: row.quote.total });
  }

  if (action === "pay-test") {
    if (!SIMPLE_TEST_MODE) return json(res, 403, { ok: false, error: "test_mode_off" });
    if (!["SIGNED", "PAYMENT_PENDING"].includes(row.status) || !row.quote) return json(res, 409, { ok: false, error: "not_payable" });
    const outcome = ["success", "failed", "cancelled", "pending"].includes(b.outcome) ? b.outcome : "success";
    const provider = b.provider === "tamara" ? "tamara" : "card";
    const payId = `test_${provider}_${crypto.randomBytes(4).toString("hex")}`;
    if (outcome !== "success") {
      const payment = { status: outcome.toUpperCase(), provider, ref: payId, amount: row.quote.total, currency: "SAR", at: nowIso(), test: true };
      await patchRequest(row.id, { payment, status: "PAYMENT_PENDING" });
      await logEvent(row.id, "system", "TEST MODE", `payment.${outcome}`, { provider, payId });
      return json(res, 200, { ok: true, status: "PAYMENT_PENDING", payment });
    }
    const upd = await markPaid(row, { provider, payId, amount: row.quote.total, test: true, actor: who });
    return json(res, 200, { ok: true, status: upd.status, payment: upd.payment, invoice: upd.invoice });
  }

  if (action === "appointment-book" || action === "appointment-reschedule") {
    const date = str(b.date, 10), time = str(b.time, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json(res, 400, { ok: false, error: "bad_datetime" });
    if (new Date(date + "T" + time + ":00+03:00") < new Date()) return json(res, 400, { ok: false, error: "past" });
    if (new Date(date + "T12:00:00+03:00").getUTCDay() === 5) return json(res, 400, { ok: false, error: "friday" });
    const prev = row.appointment;
    const appointment = {
      date, time, tz: "Asia/Riyadh", topic: str(b.topic, 200) || row.title, note: str(b.note, 500),
      status: prev && prev.status !== "CANCELLED" && action === "appointment-reschedule" ? "RESCHEDULED" : "BOOKED",
      booked_at: nowIso(), ref: (prev && prev.ref) || null, gcal: null, mode: "online",
    };
    // Reuse the consultation booking function: it e-mails the team, writes
    // the CRM lead and asks n8n to put the slot on the owner's calendar.
    try {
      const r = await fetch(SELF_BASE + "/api/book", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: row.client_name || who, email, phone: row.client_phone || "", company: row.company_name || "", topic: appointment.topic, date, time, notes: `${ref} · ${appointment.note}`, lang: row.lang || "ar", source: "simple-v1", test: SIMPLE_TEST_MODE }) });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok) { appointment.ref = j.ref || appointment.ref; appointment.gcal = j.gcal || j.calendar || null; }
    } catch {}
    await patchRequest(row.id, { appointment });
    await logEvent(row.id, "customer", who, action === "appointment-book" ? "appointment.booked" : "appointment.rescheduled", { date, time });
    return json(res, 200, { ok: true, appointment });
  }

  if (action === "appointment-cancel") {
    if (!row.appointment) return json(res, 404, { ok: false, error: "no_appointment" });
    const appointment = { ...row.appointment, status: "CANCELLED", cancelled_at: nowIso() };
    await patchRequest(row.id, { appointment });
    await logEvent(row.id, "customer", who, "appointment.cancelled", {});
    await sendEmail(OWNER_EMAIL, `إلغاء موعد ${ref}`, `<p>${esc(who)} ألغى موعد ${esc(row.appointment.date)} ${esc(row.appointment.time)}</p>`);
    return json(res, 200, { ok: true, appointment });
  }

  // الإلغاء من جهة العميل. قبل اعتماد العرض يُلغى فوراً — لا شيء يترتّب عليه.
  // بعده لا يُلغى بضغطة: هناك عقدٌ أو دفعةٌ أو تنفيذٌ جارٍ، فيُسجَّل طلب
  // إلغاء ويُفتح على الفريق ويُشعر الطرفان. رفضُ الطلب بـ409 كان يترك
  // العميل بلا مخرج، وهذا ليس إلغاءً «متاحاً».
  if (action === "request-cancel") {
    const note = str(b.note, 500);
    if (["CANCELLED", "COMPLETED"].includes(row.status)) return json(res, 409, { ok: false, error: "already_closed" });
    if (["NEW", "REVIEWING", "WAITING_CLIENT", "QUOTE_SENT", "PRICING"].includes(row.status)) {
      const upd = await patchRequest(row.id, { status: "CANCELLED", cancel: { at: nowIso(), by: "customer", actor: who, note, stage: row.status } });
      await logEvent(row.id, "customer", who, "request.cancelled", { note, stage: row.status });
      await announce(upd, "cancelled", {
        subject: `أُلغي الطلب ${row.ref}`,
        clientLine: "ألغينا طلبك كما طلبت. تقدر تبدأ طلباً جديداً في أي وقت.",
        opsLine: `${row.client_name || who} ألغى الطلب بنفسه قبل اعتماد العرض.${note ? ` السبب: ${note}` : ""}`,
      });
      return json(res, 200, { ok: true, status: "CANCELLED", cancelled: true });
    }
    const pending = { at: nowIso(), by: "customer", actor: who, note, stage: row.status };
    const upd = await patchRequest(row.id, { cancel_request: pending });
    await logEvent(row.id, "customer", who, "cancel.requested", { note, stage: row.status });
    await sweepTask(upd, {
      source: "cancel.request", urgency: "high", human: true,
      title: () => `طلب إلغاء — ${row.ref}`,
      details: () => `العميل طلب إلغاء الطلب وهو في مرحلة ${row.status}.${note ? ` السبب: ${note}` : ""} راجع ما ترتّب عليه (عقد موقّع / دفعة / تنفيذ) ثم ألغِه أو تواصل معه.`,
    }, "المستشار الذكي");
    await announce(upd, "cancel-request", {
      subject: `طلب إلغاء ${row.ref} بانتظار مراجعة الفريق`,
      clientLine: "استلمنا طلب الإلغاء. الطلب وصل مرحلةً يترتّب عليها التزامات، فيراجعه الفريق ويعود لك.",
      opsLine: `${row.client_name || who} طلب إلغاء الطلب في مرحلة ${row.status}.${note ? ` السبب: ${note}` : ""}`,
      cta: "افتح الطلب في لوحة العمليات",
    });
    return json(res, 200, { ok: true, status: row.status, requested: true });
  }

  return json(res, 400, { ok: false, error: "unknown_action" });
}

async function myRequests(sess) {
  const email = String(sess.user?.email || "").toLowerCase();
  const orgId = sess.organization?.id;
  const filter = orgId ? `or=(organization_id.eq.${orgId},client_email.eq.${q(email)})` : `client_email=eq.${q(email)}`;
  return sb(`requests?${filter}&select=*&order=created_at.desc&limit=100`);
}
const summary = (r) => ({
  ref: r.ref, type: r.type, source: r.source, status: r.status, title: r.title, lang: r.lang, created_at: r.created_at, updated_at: r.updated_at,
  scope_count: (r.scope || []).length,
  quote: r.quote ? { number: r.quote.number, total: r.quote.total, status: r.quote.status, valid_until: r.quote.valid_until } : null,
  contract: r.contract ? { number: r.contract.number, status: r.contract.status } : null,
  payment: r.payment ? { status: r.payment.status, amount: r.payment.amount, provider: r.payment.provider } : null,
  invoice: r.invoice ? { number: r.invoice.number, total: r.invoice.total } : null,
  appointment: r.appointment ? { date: r.appointment.date, time: r.appointment.time, status: r.appointment.status, topic: r.appointment.topic } : null,
  last_message: (r.conversation || []).slice(-1)[0] || null,
  client_name: r.client_name, client_email: r.client_email, client_phone: r.client_phone, company_name: r.company_name,
  assigned_to: r.assigned_to || null,
  // «شراء مباشر»: the request was opened by a paid cart, not by a conversation.
  origin: isCartRow(r) ? "cart" : "",
});

function defaultTitle(type, lang) {
  const t = {
    CONSULTATION: { ar: "استشارة", en: "Consultation", fr: "Consultation", zh: "咨询" },
    GOVERNMENT_SERVICE: { ar: "طلب حكومي", en: "Government request", fr: "Demande gouvernementale", zh: "政府服务申请" },
    COMPANY_FORMATION: { ar: "تأسيس شركة", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" },
    BUSINESS_DEVELOPMENT: { ar: "تطوير الأعمال", en: "Business development", fr: "Développement commercial", zh: "业务拓展" },
  }[type] || {};
  return t[lang] || t.ar || "طلب";
}
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Shared by the test payment and by the real gateway settle (api/pay.js
// calls markRequestPaid after Moyasar/Tamara confirm a `sv1:<ref>` line).
// The tax invoice belongs in the books, not only in our own row. A paid request
// issues it in Daftra under the client's record, with the payment recorded
// against it, and keeps the number + PDF on the request so the customer can
// open it from /my. Locally and in test mode nothing is sent: the internal
// TEST-INV- number stands in, and the reason is recorded so a missing invoice
// is never a mystery.
async function daftraInvoiceForRequest(row, payment) {
  if (!daftraConfigured()) return { ok: false, reason: "daftra_not_configured" };
  if (payment.test) return { ok: false, reason: "test_mode" };
  const items = (row.quote?.items || []).map((l) => ({
    name: str(l.title, 140) || "خدمة", quantity: Math.max(1, Math.min(999, num(l.qty) || 1)), unitPrice: round2(num(l.price)),
  })).filter((i) => i.unitPrice >= 0);
  if (!items.length) return { ok: false, reason: "no_priced_items" };
  const who = {
    name: str(row.company_name || row.client_name, 160),
    email: str(row.client_email, 160), phone: str(row.client_phone, 40),
  };
  if (!who.name || !isEmail(who.email)) return { ok: false, reason: "missing_buyer" };
  try {
    const { client } = await daftraFindOrCreateClient(who);
    if (!client || !client.id) return { ok: false, reason: "client_failed" };
    const notes = [`مرجع الطلب: ${row.ref}`, `عرض السعر: ${row.quote?.number || ""}`, "مدفوعة إلكترونياً عبر الموقع"].filter(Boolean).join("\n");
    const inv = await daftraCreateInvoice({ clientId: client.id, items, notes, ref: row.ref });
    let recorded = false;
    try {
      await daftraRecordPayment({ invoiceId: inv.id, amount: inv.total, transactionId: payment.ref || "", method: payment.provider === "tamara" ? "Tamara" : "Moyasar" });
      recorded = true;
    } catch (e) { console.error("simple: daftra payment record failed", String(e.message || e).slice(0, 160)); }
    let pdf = null;
    try { pdf = await daftraDocPdf("invoice", inv.id); } catch { pdf = null; }
    return { ok: true, id: inv.id, number: inv.number, net: inv.net, vat: inv.vat, total: inv.total,
      vat_rate: Number(daftraVatRate()) || 15, recorded, pdf_url: (pdf && pdf.url) || "" };
  } catch (e) {
    console.error("simple: daftra invoice failed", String(e.message || e).slice(0, 200));
    return { ok: false, reason: String(e.message || "daftra_failed").slice(0, 120) };
  }
}

export async function markPaid(row, { provider, payId, amount, test, actor }) {
  const suffix = row.ref.replace(/^BP-R-/, "");
  const payment = { status: "PAID", provider, ref: payId, amount: round2(num(amount)), currency: "SAR", at: nowIso(), test: !!test };
  let invoice = row.invoice || {
    number: (test ? "TEST-INV-" : "INV-") + suffix, issued_at: nowIso(), mode: test ? "test" : "pending-daftra",
    net: row.quote?.net || 0, vat: row.quote?.vat || 0, total: row.quote?.total || 0, currency: "SAR", vat_rate: 15,
    items: row.quote?.items || [], bill_to: { name: row.client_name, company: row.company_name, email: row.client_email },
  };
  if (!row.invoice) {
    const d = await daftraInvoiceForRequest(row, payment);
    invoice = d.ok
      ? { ...invoice, number: d.number, daftra_id: d.id, mode: "daftra", net: d.net, vat: d.vat, total: d.total,
          vat_rate: d.vat_rate, pdf_url: d.pdf_url, payment_recorded: d.recorded }
      : { ...invoice, daftra: { issued: false, reason: d.reason } };
  }
  const upd = await patchRequest(row.id, { payment, invoice, status: "PAID" });
  await logEvent(row.id, "system", test ? "TEST MODE" : provider, "payment.paid", { provider, payId, amount: payment.amount });
  await logEvent(row.id, "system", test ? "TEST MODE" : "invoicing", "invoice.issued", { number: invoice.number, total: invoice.total });
  if (row.organization_id) {
    await notify({ organization_id: row.organization_id, event: "simple_paid", title: `تم استلام الدفع — ${row.ref}`, body: `الفاتورة ${invoice.number}`, idempotency_key: `simple_paid_${row.ref}` });
  }
  await announce(upd, "paid", {
    subject: `تم استلام الدفع — فاتورتك ${invoice.number}`,
    clientLine: `استلمنا ${payment.amount} ر.س. فاتورتك الضريبية ${invoice.number} جاهزة في حسابك، وبدأنا التنفيذ.`,
    opsLine: `دفع مستلم ${payment.amount} ر.س عبر ${provider} (${payId}). الفاتورة ${invoice.number}${invoice.daftra && invoice.daftra.issued === false ? " — لم تصدر من الدفترة: " + (invoice.daftra.reason || "") : ""}.`,
    cta: "افتح فاتورتك",
  });
  return upd;
}
export async function markRequestPaidByRef(ref, info) {
  const row = await getByRef(ref);
  if (!row || row.status === "PAID" || ["IN_PROGRESS", "COMPLETED"].includes(row.status)) return row;
  return markPaid(row, info);
}

// ----------------------------------------- a paid cart becomes a real request --
// Until 2026-10 a cart purchase paid, wrote a Notion CRM row and sent an e-mail
// — and nothing else. The customer opened «طلباتي» and found no order; the
// owner opened /ops and found no revenue. /my and /ops read `requests`, so the
// purchase has to be a row there. api/requests.js {action:"paid-order"} (the
// sealed, server-only settle) calls this once the payment is confirmed.
//
// No migration: the three existing types and the existing statuses are enough,
// and the provenance lives in the JSON column that already holds money facts —
// `payment` {source:"cart", order_ref, pay_ref, items[], net, vat, total}.
// The row has no quotation and no contract on purpose: it was priced by the
// published catalogue and paid before it existed, so it starts at PAID (or at
// REVIEWING when the amount could not be matched, which is what we tell the
// customer — no promise the payment has not earned).
//
// Idempotent by construction: the reference is derived from the payment id, so
// the browser callback, the gateway webhook and a reconcile run all land on the
// same row. `ref` is UNIQUE in the schema, which settles a true race.
const CART_CYCLE_AR = { monthly: "شهري", yearly: "سنوي" };
function isCartRow(r) { return !!(r && r.payment && r.payment.source === "cart"); }

let _cartRefs = null;
async function readPublished(fsRel, urlPath) {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(fs.readFileSync(path.join(here, "..", fsRel), "utf8"));
  } catch { /* not bundled with the function — read the published copy */ }
  const r = await fetch(`${SELF_BASE}${urlPath}`);
  if (!r.ok) throw new Error("fetch_failed");
  return r.json();
}
// The published catalogue (service categories, billing model) and the per-service
// documents list (site.json overrides) — read once, shared for ten minutes.
async function cartRefs() {
  if (_cartRefs && Date.now() - _cartRefs.at < 10 * 60 * 1000) return _cartRefs;
  const [cat, site] = await Promise.all([
    readPublished("site/assets/data/catalog.json", "/assets/data/catalog.json").catch(() => null),
    readPublished("site/data/site.json", "/data/site.json").catch(() => null),
  ]);
  const services = new Map(), packages = new Map();
  for (const s of (cat && cat.services) || []) if (s.code) services.set(String(s.code).toLowerCase(), s);
  for (const p of (cat && cat.packages) || []) for (const k of [p.key, p.code]) if (k) packages.set(String(k).toLowerCase(), p);
  const refs = { at: Date.now(), services, packages, overrides: (site && site.overrides) || {} };
  if (cat || site) _cartRefs = refs;
  return refs;
}
// A cart id is not a catalogue code: pages prefix it (svc-, pkg-) and suffix the
// billing period (-monthly, -yearly). Same normalisation as api/pay.js, kept
// here because this only classifies — the amount was verified before this runs.
function resolveCartLine(rawId, refs) {
  const raw = String(rawId || "").toLowerCase();
  const sfx = /-(monthly|yearly)$/.exec(raw);
  let bare = sfx ? raw.slice(0, -sfx[0].length) : raw;
  bare = bare.replace(/^(svc|pkg)-/, "");
  const svc = refs.services.get(bare) || refs.services.get(raw) || null;
  const pkg = svc ? null : (refs.packages.get(bare) || refs.packages.get(raw) || null);
  const name = (svc && (svc.nameAr || svc.nameEn)) || (pkg && (pkg.nameAr || pkg.nameEn)) || "";
  let cycle = sfx ? sfx[1] : "";
  if (!cycle && svc && /monthly/i.test(String(svc.pricingModel || ""))) cycle = "monthly";
  if (!cycle && pkg && pkg.billingPeriod === "monthly") cycle = "monthly";
  if (!cycle && /^(agent-|employee-)/.test(raw)) cycle = "monthly";
  // «استشارة ما قبل التأسيس» تحت فئة التأسيس في الكتالوج، لكنها استشارة: سلةٌ
  // كلها استشارات تبقى CONSULTATION، ولا تجعل بنداً استشارياً الطلبَ تأسيساً.
  const consult = /استشار|consult/i.test(name);
  return {
    code: svc ? String(svc.code) : pkg ? String(pkg.code || pkg.key || "") : "",
    name, cycle, consult,
    formation: !consult && !!((svc && svc.category === "Company Formation") || (pkg && /form/i.test(String(pkg.group || "")))),
  };
}

export function cartRequestRef(key, salt = 0) {
  return "BP-R-" + crypto.createHash("sha256").update(`cart|${salt}|${key}`).digest("hex").slice(0, 6).toUpperCase();
}

const _cartInflight = new Map();
// d = the unsealed paid-order payload. Returns {ok, ref, created, status, documents}
// or {ok:true, skipped} when there is nothing to open a request for, or
// {ok:false, error} — the caller must tell the owner about that one.
export function createCartRequest(d) {
  const key = String((d && (d.payId || d.ref)) || "");
  if (!key) return Promise.resolve({ ok: false, error: "no_key" });
  if (_cartInflight.has(key)) return _cartInflight.get(key);
  const run = cartRequestOnce(d, key).catch((e) => {
    console.error("simple: cart request failed", String((e && e.message) || e).slice(0, 160));
    return { ok: false, error: "create_failed" };
  }).finally(() => _cartInflight.delete(key));
  _cartInflight.set(key, run);
  return run;
}

async function cartRequestOnce(d, key) {
  if (!DB_ON) return { ok: false, error: "db_off" };
  const all = (Array.isArray(d.lines) ? d.lines : []).slice(0, 40).filter((l) => l && l.id);
  // «sv1:BP-R-…» pays an EXISTING request (its own quote and contract); it is
  // settled by markRequestPaidByRef and must not open a second request.
  const lines = all.filter((l) => !/^sv1:/i.test(String(l.id)));
  if (!lines.length) return { ok: true, skipped: all.length ? "pays_existing_request" : "no_lines" };

  const payId = str(d.payId, 64), orderRef = str(d.ref, 40);
  const verified = !!d.verified;
  const email = String(d.email || "").trim().toLowerCase();
  const provider = /^tamara_/i.test(payId) ? "tamara" : "moyasar";

  // Idempotency: the same payment always maps to the same reference.
  let ref = "", existing = null;
  for (let salt = 0; salt < 3; salt++) {
    ref = cartRequestRef(key, salt);
    const hit = await getByRef(ref);
    if (!hit) break;
    const p = hit.payment || {};
    if (p.source === "cart" && (p.pay_ref || p.order_ref) === (payId || orderRef)) { existing = hit; break; }
    ref = ""; // a random BP-R- reference took this one — try the next salt
  }
  if (existing) return { ok: true, ref: existing.ref, created: false, status: existing.status, documents: (existing.documents || []).length };
  if (!ref) return { ok: false, error: "ref_collision" };

  const refs = await cartRefs();
  const items = lines.map((l) => {
    const r = resolveCartLine(l.id, refs);
    const qty = Math.max(1, Math.min(99, Math.round(num(l.qty) || 1)));
    const amount = l.amount == null || l.amount === "" ? null : round2(num(l.amount));
    return {
      id: str(l.id, 80), code: r.code, name: (l.name && l.name !== l.id ? str(l.name, 200) : "") || r.name || str(l.id, 80), qty,
      unit: amount == null ? null : round2(amount / qty), amount,
      cycle: str(l.cycle, 12) || r.cycle, formation: r.formation, consult: r.consult,
    };
  });
  // Money: what the gateway took is the truth. The pre-VAT figure is the
  // server's own re-pricing when it matched the catalogue, an estimate when not.
  const known = items.every((i) => i.amount != null);
  const itemsNet = known ? round2(items.reduce((s, i) => s + i.amount, 0)) : null;
  let paid, net;
  if (lines.length < all.length) { net = itemsNet != null ? itemsNet : round2(num(d.total) / (1 + VAT_RATE)); paid = round2(net * (1 + VAT_RATE)); }
  else { paid = round2(num(d.total)); net = verified && d.net != null ? round2(num(d.net)) : round2(paid / (1 + VAT_RATE)); }
  const vat = round2(paid - net);

  const type = items.some((i) => i.formation) ? "COMPANY_FORMATION" : items.every((i) => i.consult) ? "CONSULTATION" : "GOVERNMENT_SERVICE";
  const first = items[0].name;
  const title = str(items.length === 1 ? first : `${first} و${items.length - 1} ${items.length - 1 === 1 ? "بند آخر" : "بنود أخرى"}`, 200);
  const scope = normScope(items.map((i) => ({
    code: i.code, title: i.name, qty: i.qty,
    why: [`×${i.qty}`, i.amount != null ? `${i.amount} ر.س قبل الضريبة` : "", i.cycle ? CART_CYCLE_AR[i.cycle] || i.cycle : ""].filter(Boolean).join(" · "),
  })));

  // The documents we need from the buyer: the service's own list (the same one
  // its page prints). A package or an item with no list asks for nothing.
  const seen = new Set(), wanted = [];
  for (const i of items) {
    const ov = i.code && refs.overrides[i.code.toLowerCase()];
    for (const t of (ov && Array.isArray(ov.documents) ? ov.documents : [])) {
      const title2 = str(t, 200);
      if (title2 && !seen.has(title2)) { seen.add(title2); wanted.push({ title: title2, note: items.length > 1 ? `للخدمة: ${i.name}` : "", status: "requested" }); }
    }
  }
  const documents = normDocuments(wanted);

  // Attach to the buyer's account when the e-mail already has one. No account is
  // invented: otherwise the row waits on client_email and `me` claims it at the
  // first sign-in, exactly as a manually entered request does.
  let userId = null, orgId = null;
  if (isEmail(email)) {
    try {
      const u = await sb(`users?email=eq.${q(email)}&select=id&limit=1`);
      if (u && u[0]) {
        userId = u[0].id;
        const m = await sb(`organization_members?user_id=eq.${userId}&select=organization_id&limit=1`);
        orgId = (m && m[0] && m[0].organization_id) || null;
      }
    } catch { /* unlinked rows are claimed by e-mail */ }
  }

  const test = PAY_MOCK() || (provider === "tamara" && TAMARA_MOCK());
  const payment = {
    status: "PAID", provider, ref: payId, amount: paid, currency: "SAR", at: nowIso(), test,
    source: "cart", order_ref: orderRef, pay_ref: payId, verified,
    items: items.map(({ formation, consult, ...keep }) => keep), net, vat, total: paid, net_estimated: !(verified && d.net != null),
    ...(d.disc ? { discount_code: str(d.disc, 30) } : {}),
  };
  const at = nowIso();
  const row = {
    ref, organization_id: orgId, user_id: userId, type, source: "WEBSITE",
    status: verified ? "PAID" : "REVIEWING", lang: "ar", title,
    summary: `شراء مباشر بالسلة — رقم عملية الدفع ${payId || "—"} · الإجمالي ${paid} ر.س شامل الضريبة.`,
    conversation: [{ role: "bp", content: verified
      ? "تم الدفع واستُلم مبلغ طلبك. سنبدأ التنفيذ بعد استلام المستندات المطلوبة (إن وُجدت) ونبلغك بكل تحديث هنا."
      : "تم استلام دفعتك، لكن مبلغها لم يُطابَق آلياً مع الأسعار المعتمدة، فيراجعه فريقنا قبل بدء التنفيذ. لا حاجة لإعادة الدفع.", at }],
    scope, documents, payment,
    client_name: str(d.name, 160), client_email: email, client_phone: str(d.phone, 40), company_name: str(d.company, 200),
  };

  let created = null;
  try {
    const rows = await sb("requests", { method: "POST", body: [row] });
    created = rows && rows[0];
  } catch (e) {
    // A true race (webhook and browser at the same instant): the loser hits the
    // UNIQUE reference and simply reads the winner.
    const hit = await getByRef(ref);
    if (hit && isCartRow(hit)) return { ok: true, ref: hit.ref, created: false, status: hit.status, documents: (hit.documents || []).length };
    throw e;
  }
  if (!created) return { ok: false, error: "insert_empty" };

  await logEvent(created.id, "system", "السلة", "request.created.cart", { source: "cart", order_ref: orderRef, pay_ref: payId, items: items.length, verified });
  await logEvent(created.id, "system", provider, "payment.paid", { provider, payId, amount: paid, order_ref: orderRef });
  if (documents.length) await logEvent(created.id, "system", "النظام", "documents.requested", { documents: documents.map((x) => x.title) });
  await audit({ organization_id: orgId, actor_user_id: userId, action: "simple.request.cart", entity: "requests", entity_id: created.id, meta: { ref, order_ref: orderRef, pay_ref: payId } });

  // The team: one task, whichever way the money stands.
  try {
    await sweepTask(created, verified ? PLAY.PAID : {
      source: "cart-review", title: (r) => `راجع دفعة السلة — ${r.ref}`,
      details: () => `دفعة مؤكدة من البوابة (${paid} ر.س) لكن مبلغها لم يُطابَق مع الكتالوج. راجع البنود ثم غيّر الحالة إلى «مدفوع».`,
      human: true, urgency: "high",
    }, "النظام");
  } catch (e) { console.error("simple: cart task", String((e && e.message) || e).slice(0, 100)); }

  // Notices. The buyer's e-mail is the receipt api/requests.js sends right after
  // this (it carries the same /my link) — so only WhatsApp and the in-app bell
  // go from here; the owner already gets the settle e-mail, so only WhatsApp too.
  const needDocs = documents.length ? ` ارفع المستندات المطلوبة (${documents.length}) من صفحة الطلب ليبدأ الفريق.` : "";
  try {
    await announce(created, "cart-paid", {
      subject: verified ? `استلمنا دفعتك — طلبك ${ref}` : `استلمنا دفعتك وطلبك قيد المراجعة — ${ref}`,
      clientLine: verified
        ? `استلمنا دفعتك (${paid} ر.س شامل الضريبة) وسجّلنا طلبك «${title}».${needDocs || " نبلغك حين يبدأ التنفيذ."}`
        : `استلمنا دفعتك (${paid} ر.س) وسجّلنا طلبك «${title}». مبلغها لم يُطابَق آلياً مع الأسعار المعتمدة فيراجعه الفريق قبل التنفيذ — لا تدفع مرة أخرى.`,
      opsLine: `شراء مباشر بالسلة: ${title} — ${paid} ر.س عبر ${provider} (${payId || "—"})${verified ? "" : " ⚠️ المبلغ لم يُطابَق مع الكتالوج — راجعه"}.`,
      cta: "افتح طلبك", clientEmail: false, opsEmail: false,
    });
  } catch (e) { console.error("simple: cart announce", String((e && e.message) || e).slice(0, 100)); }

  return { ok: true, ref, created: true, status: created.status, documents: documents.length };
}

// ------------------------------------------------------- the follow-up sweep --
// A request that nobody touches dies quietly: the quotation goes out and the
// answer never comes, the contract sits unsigned, the paid job waits for
// someone to start it. Nobody notices, because nothing on a dashboard says
// «this one has been still for four days».
//
// The sweep is that noticing. It walks every open request, and for each stage
// that has been still too long it does exactly two things: it opens ONE task
// for the team, and — when the ball is in the customer's court — it sends ONE
// reminder per window. Both are idempotent: an open task of the same kind, or
// a reminder already logged inside the window, means it does nothing at all.
// It is meant to be run repeatedly (panel load, n8n schedule, cron) and to be
// boring when there is nothing to do.
//
// It never invents a fact: a reminder carries the request number, its stage
// and a link. Prices come from the quotation that was already issued, and the
// sweep issues no quotation, signs nothing and charges nothing.

const DAY = 864e5;
// How long a stage may sit still before the agent speaks up. Days.
const SLA = {
  NEW: 0,                 // a new request is looked at today
  REVIEWING: 1,           // scope in hand → price it
  WAITING_CLIENT: 2,
  QUOTE_SENT: 3,
  QUOTE_APPROVED: 1,      // approved → the contract is owed
  CONTRACT_SENT: 2,
  SIGNED: 2,
  PAYMENT_PENDING: 2,
  PAID: 1,                // paid → execution starts
  IN_PROGRESS: 7,
  WAITING_INTERNAL: 3,
};
// What the agent says and does at each stage. `client` marks the stages where
// the customer is the one we are waiting for — only those get a reminder.
const PLAY = {
  NEW:            { source: "sweep-new",      title: (r) => `راجع الطلب الجديد ${r.ref}`,        details: () => "اقرأ المحادثة، ثبّت النطاق، وجهّز التسعير.", human: true,  urgency: "high" },
  REVIEWING:      { source: "pricing",        title: (r) => `تسعير نطاق ${r.ref}`,               details: () => "النطاق جاهز — أصدر عرض السعر من اللوحة.", human: true,  urgency: "high" },
  WAITING_CLIENT: { source: "sweep-client",   title: (r) => `تابع العميل — ${r.ref}`,            details: () => "الطلب بانتظار رد العميل.", client: true, subject: (r) => `تذكير بطلبك ${r.ref}`, body: () => "طلبك بانتظار ردّك حتى نكمل الخطوة التالية." },
  QUOTE_SENT:     { source: "sweep-quote",    title: (r) => `عرض السعر بلا رد — ${r.ref}`,       details: (r) => `العرض ${r.quote && r.quote.number || ""} أُرسل ولم يُعتمد بعد.`, client: true, subject: (r) => `عرض السعر ${(r.quote && r.quote.number) || r.ref} بانتظار اعتمادك`, body: () => "عرض السعر جاهز في حسابك — اعتمده أو اطلب تعديله." },
  QUOTE_APPROVED: { source: "sweep-contract", title: (r) => `جهّز العقد — ${r.ref}`,              details: () => "العميل اعتمد العرض؛ أصدر العقد.", human: true, urgency: "high" },
  CONTRACT_SENT:  { source: "sweep-sign",     title: (r) => `عقد بلا توقيع — ${r.ref}`,          details: () => "العقد أُرسل ولم يُوقّع بعد.", client: true, subject: (r) => `العقد ${(r.contract && r.contract.number) || r.ref} بانتظار توقيعك`, body: () => "العقد جاهز للتوقيع الإلكتروني في حسابك." },
  SIGNED:         { source: "sweep-pay",      title: (r) => `بانتظار الدفع — ${r.ref}`,          details: () => "العقد موقّع ولم يصل الدفع.", client: true, subject: (r) => `بانتظار الدفع — ${r.ref}`, body: () => "العقد موقّع؛ يبقى الدفع لنبدأ التنفيذ." },
  PAYMENT_PENDING:{ source: "sweep-pay",      title: (r) => `دفع معلّق — ${r.ref}`,              details: () => "بدأ الدفع ولم يكتمل — تأكد من البوابة.", human: true, urgency: "high", client: true, subject: (r) => `دفعتك لم تكتمل — ${r.ref}`, body: () => "لم يكتمل الدفع. أعد المحاولة من حسابك، أو راسلنا." },
  PAID:           { source: "sweep-start",    title: (r) => `ابدأ تنفيذ ${r.ref}`,               details: () => "الدفع وصل — ابدأ التنفيذ وحدّث الحالة.", human: true, urgency: "high" },
  IN_PROGRESS:    { source: "sweep-progress", title: (r) => `حدّث العميل — ${r.ref}`,            details: () => "أسبوع بلا تحديث على طلب جارٍ.", human: true },
  WAITING_INTERNAL:{source: "sweep-internal", title: (r) => `عالق داخلياً — ${r.ref}`,           details: () => "الطلب بانتظار جهة داخلية منذ أيام — صعّد.", human: true, urgency: "high" },
};
const SWEEP_DONE = ["COMPLETED", "CANCELLED"];

// One open task per request per kind. The second run of the day must not add a
// second copy of yesterday's task — a queue that grows on a timer is noise,
// and noise is how a real task gets missed.
async function sweepTask(row, play, actor) {
  const open = await sb(`tasks?request_id=eq.${row.id}&source=eq.${q(play.source)}&status=in.(open,in_progress,blocked)&select=id&limit=1`);
  if (open && open[0]) return false;
  await sb("tasks", { method: "POST", prefer: "return=minimal", body: [{
    organization_id: row.organization_id || await fallbackOrg(),
    title: play.title(row), details: play.details(row),
    assignee: "bp", source: play.source, status: "open",
    urgency: play.urgency || "normal", priority: play.urgency === "high" ? "high" : "normal",
    human_action: !!play.human, assigned_to: row.assigned_to || null, request_id: row.id,
  }] });
  await logEvent(row.id, "ai", actor, "followup.task", { stage: row.status, title: play.title(row) });
  return true;
}

// One reminder per stage per window. The proof lives in request_events, so a
// restart, a second panel load or a duplicated schedule cannot turn a courteous
// nudge into three e-mails in a minute.
async function sweepRemind(row, play, windowDays, actor) {
  if (!row.client_email) return false;
  const since = new Date(Date.now() - windowDays * DAY).toISOString();
  const sent = await sb(`request_events?request_id=eq.${row.id}&event=eq.followup.reminded&created_at=gte.${since}&select=id&limit=1`);
  if (sent && sent[0]) return false;
  const link = `${SELF_BASE}/${row.lang === "en" ? "" : (row.lang || "ar") + "/"}my?ref=${row.ref}`;
  await sendEmail(row.client_email, play.subject(row),
    `<p>${esc(play.body(row))}</p><p><a href="${link}">فتح الطلب ${esc(row.ref)}</a></p>`);
  await logEvent(row.id, "ai", actor, "followup.reminded", { stage: row.status });
  if (row.organization_id) {
    await notify({ organization_id: row.organization_id, event: "simple_followup", title: play.subject(row), body: play.body(row), idempotency_key: `simple_follow_${row.ref}_${row.status}_${Math.floor(Date.now() / DAY)}` });
  }
  return true;
}

// The whole board in one pass. Returns what it did, so the panel can show it
// and a scheduler can log it.
async function runSweep({ actor = "المتابعة الذكية", limit = 400, dry = false } = {}) {
  const rows = await sb(`requests?status=not.in.(${SWEEP_DONE.join(",")})&select=id,ref,status,title,lang,quote,contract,payment,appointment,client_name,client_email,organization_id,assigned_to,created_at,updated_at&order=updated_at.asc&limit=${limit}`);
  const now = Date.now();
  const acted = [], skipped = [];
  for (const row of rows) {
    const play = PLAY[row.status];
    if (!play) continue;
    // A paid cart request held for review already has its own task; the
    // «pricing» play would tell the team to quote something already bought.
    if (row.status === "REVIEWING" && isCartRow(row)) continue;
    const idle = (now - new Date(row.updated_at || row.created_at).getTime()) / DAY;
    const due = SLA[row.status];
    if (!(idle >= due)) { skipped.push({ ref: row.ref, status: row.status, idle_days: round2(idle), due_in_days: round2(due - idle) }); continue; }
    const did = { ref: row.ref, status: row.status, idle_days: round2(idle), task: false, reminded: false };
    if (!dry) {
      // Failures are recorded, not swallowed. A sweep that quietly does nothing
      // looks exactly like a sweep with nothing to do — and that is how a whole
      // stage stops being followed up without anyone noticing.
      try { did.task = await sweepTask(row, play, actor); }
      catch (e) { did.error = "task: " + String(e && e.message || e).slice(0, 80); }
      // The reminder window is the SLA itself, never under two days: a stage
      // with a same-day SLA must not mean a same-day second e-mail.
      if (play.client) {
        try { did.reminded = await sweepRemind(row, play, Math.max(due, 2), actor); }
        catch (e) { did.error = (did.error ? did.error + " · " : "") + "remind: " + String(e && e.message || e).slice(0, 80); }
      }
    }
    acted.push(did);
  }
  return {
    ran_at: nowIso(), scanned: rows.length, dry: !!dry,
    tasks_opened: acted.filter((a) => a.task).length,
    reminders_sent: acted.filter((a) => a.reminded).length,
    errors: acted.filter((a) => a.error).map((a) => ({ ref: a.ref, error: a.error })),
    due: acted, waiting: skipped.slice(0, 60),
  };
}

// ------------------------------------------------- WhatsApp agent gate --
// Who answers this number — the machine or a person? No row means the agent
// answers; that is also what a missing table or a failed read means, so a
// fault here disables the control, never the service.
const WA_ALL = "*";
function waKey(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (s === WA_ALL) return WA_ALL;
  return waNumber(s) || "";
}
function waConfigured() {
  return !!((process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN || process.env.WA_TOKEN) &&
            (process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WA_PHONE_ID));
}
function waFailMessage(err) {
  if (err === "wa_not_configured") return "واتساب غير مربوط: ينقص WHATSAPP_TOKEN أو WHATSAPP_PHONE_ID.";
  if (err === "no_phone") return "رقم الجوال غير صالح.";
  if (/^wa_1310/.test(String(err))) return "مضت ٢٤ ساعة على آخر رسالة من العميل — واتساب لا يسمح إلا بقالب معتمد (WHATSAPP_TEMPLATE_NAME).";
  return "تعذّر الإرسال عبر واتساب.";
}
async function waGateRows() {
  try { return await sb("wa_agent_gate?select=*&order=updated_at.desc&limit=200"); } catch { return []; }
}
// A pause with an expiry that has passed is no pause: the operator who muted
// the agent for an hour must not have to remember to switch it back on.
function gateLive(r) {
  if (!r || !r.paused) return false;
  if (r.until && new Date(r.until).getTime() <= Date.now()) return false;
  return true;
}
async function waGateSet(phone, { paused, minutes, reason, actor }) {
  const key = waKey(phone);
  if (!key) return null;
  const mins = Math.min(Math.max(num(minutes), 0), 60 * 24 * 30);
  const row = {
    phone: key, paused: !!paused,
    reason: str(reason, 300) || null, actor: str(actor, 80) || null,
    until: paused && mins > 0 ? new Date(Date.now() + mins * 6e4).toISOString() : null,
    updated_at: nowIso(),
  };
  // on_conflict is spelled out rather than left to the primary key, because
  // the local JSON database matches on it literally and would otherwise append
  // a second row for the same number on every click.
  const out = await sb("wa_agent_gate?on_conflict=phone", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: [row] });
  return (Array.isArray(out) ? out[0] : out) || row;
}

// --------------------------------------------------------------- ops side --
async function opsAction(action, b, qs, req, res, opsUser) {
  // Who did this, in the audit trail. A named owner beats the generic
  // «المالك» that a shared panel key can only ever produce.
  const actor = (opsUser && (opsUser.name || opsUser.email)) || str(b.actor || qs.actor, 80) || "المالك";

  if (action === "ops-summary") {
    const all = await sb("requests?select=ref,type,source,status,title,created_at,updated_at,quote,payment,invoice,appointment,client_name,company_name,assigned_to&order=created_at.desc&limit=500");
    const today = nowIso().slice(0, 10);
    const month = today.slice(0, 7);
    const paid = all.filter((r) => r.payment && r.payment.status === "PAID");
    const sum = (rows) => round2(rows.reduce((s, r) => s + num(r.payment?.amount), 0));
    const [humanTasks, openTasks] = await Promise.all([
      sb("tasks?assignee=eq.bp&human_action=eq.true&status=in.(open,in_progress,blocked)&select=id"),
      sb("tasks?assignee=eq.bp&status=in.(open,in_progress,blocked)&select=id"),
    ]);
    const counts = {
      new: all.filter((r) => r.status === "NEW").length,
      reviewing: all.filter((r) => r.status === "REVIEWING").length,
      quotes_to_prepare: all.filter((r) => ["NEW", "REVIEWING"].includes(r.status) && !r.quote).length,
      quotes_waiting_customer: all.filter((r) => r.status === "QUOTE_SENT").length,
      contracts_waiting_signature: all.filter((r) => r.status === "CONTRACT_SENT").length,
      payments_due: all.filter((r) => ["SIGNED", "PAYMENT_PENDING"].includes(r.status)).length,
      ready_for_execution: all.filter((r) => r.status === "PAID").length,
      in_progress: all.filter((r) => ["IN_PROGRESS", "WAITING_INTERNAL"].includes(r.status)).length,
      human_actions: humanTasks.length,
      open_tasks: openTasks.length,
      appointments_today: all.filter((r) => r.appointment && r.appointment.status !== "CANCELLED" && r.appointment.date === today).length,
      unread_conversations: all.filter((r) => ["NEW", "REVIEWING"].includes(r.status)).length,
    };
    const revenue = {
      today: sum(paid.filter((r) => (r.payment.at || "").slice(0, 10) === today)),
      month: sum(paid.filter((r) => (r.payment.at || "").slice(0, 7) === month)),
      paid_orders: paid.length,
      new_clients_month: new Set(all.filter((r) => (r.created_at || "").slice(0, 7) === month).map((r) => r.client_name || r.ref)).size,
    };
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, counts, revenue, integrations: integrationStatus(), recent: all.slice(0, 12).map(summary) });
  }

  // Development only: what would have been emailed / sent on WhatsApp.
  if (action === "ops-outbox") {
    return json(res, 200, { ok: true, modes: MODES(), outbox: DEV ? await outboxList(60) : [] });
  }

  if (action === "ops-requests") {
    const status = str(b.status || qs.status, 30);
    const type = str(b.type || qs.type, 30);
    const search = str(b.q || qs.q, 80);
    let path = "requests?select=*&order=updated_at.desc&limit=300";
    if (status && REQUEST_STATUSES.includes(status)) path += `&status=eq.${status}`;
    if (type && REQUEST_TYPES.includes(type)) path += `&type=eq.${type}`;
    if (search) path += `&or=(ref.ilike.*${q(search)}*,title.ilike.*${q(search)}*,client_name.ilike.*${q(search)}*,company_name.ilike.*${q(search)}*,client_email.ilike.*${q(search)}*)`;
    const rows = await sb(path);
    return json(res, 200, { ok: true, requests: rows.map(summary) });
  }

  if (action === "ops-tasks") {
    const rows = await sb(`tasks?assignee=eq.bp&select=id,title,details,status,urgency,priority,human_action,assigned_to,source,due_at,created_at,completed_at,request_id,requests(ref,title,client_name)&order=created_at.desc&limit=300`);
    return json(res, 200, { ok: true, tasks: rows.map((t) => ({ ...taskOut(t), request: t.requests || null })) });
  }

  if (action === "ops-task-update") {
    const id = str(b.id, 60);
    if (!id) return json(res, 400, { ok: false, error: "missing_id" });
    const patch = {};
    if (b.status && TASK_STATUS[b.status]) { patch.status = TASK_STATUS[b.status]; patch.completed_at = b.status === "DONE" ? nowIso() : null; }
    if (b.assigned_to != null) patch.assigned_to = str(b.assigned_to, 80);
    if (b.priority) patch.priority = ["low", "normal", "high", "urgent"].includes(b.priority) ? b.priority : "normal";
    if (b.details != null) patch.details = str(b.details, 2000);
    if (b.due_at !== undefined) patch.due_at = b.due_at || null;
    const rows = await sb(`tasks?id=eq.${q(id)}`, { method: "PATCH", body: patch });
    const t = rows[0];
    if (t && t.request_id && patch.status) await logEvent(t.request_id, "human", actor, `task.${b.status.toLowerCase()}`, { title: t.title });
    return json(res, 200, { ok: true, task: t ? taskOut(t) : null });
  }

  if (action === "ops-inbox") {
    const [reqs, tickets] = await Promise.all([
      sb("requests?select=ref,title,status,source,type,conversation,client_name,client_email,client_phone,company_name,updated_at,assigned_to&order=updated_at.desc&limit=200"),
      sb("support_tickets?select=number,subject,status,category,created_at,organization_id,ticket_messages(body,author_kind,created_at)&order=created_at.desc&limit=60").catch(() => []),
    ]);
    const threads = reqs.map((r) => {
      const last = (r.conversation || []).slice(-1)[0] || null;
      return { kind: "request", channel: r.source, ref: r.ref, title: r.title, status: r.status, name: r.client_name, email: r.client_email, phone: r.client_phone, company: r.company_name, last: last ? { role: last.role, content: last.content.slice(0, 200), at: last.at } : null, at: (last && last.at) || r.updated_at, unread: ["NEW", "REVIEWING"].includes(r.status), assigned_to: r.assigned_to };
    });
    for (const t of tickets) {
      const msgs = (t.ticket_messages || []).sort((a, c) => a.created_at < c.created_at ? 1 : -1);
      const last = msgs[0] || null;
      threads.push({ kind: "ticket", channel: "PORTAL", ref: t.number, title: t.subject, status: t.status, last: last ? { role: last.author_kind, content: String(last.body || "").slice(0, 200), at: last.created_at } : null, at: (last && last.created_at) || t.created_at, unread: t.status === "new" || t.status === "waiting_bp" });
    }
    threads.sort((a, c) => (a.at < c.at ? 1 : -1));
    return json(res, 200, { ok: true, threads });
  }

  if (action === "ops-manual-intake") {
    // «شركة XYZ اتصلوا علي ويبغون تغيير مهنة لـ4 موظفين» — one box, one click.
    const text = str(b.text, 3000);
    if (!text && !b.title) return json(res, 400, { ok: false, error: "empty" });
    const type = REQUEST_TYPES.includes(b.type) ? b.type : guessType(text);
    const source = REQUEST_SOURCES.includes(b.source) ? b.source : "PHONE";
    const email = str(b.email, 160).toLowerCase();
    let orgId = null;
    if (isEmail(email)) {
      try { const u = await sb(`users?email=eq.${q(email)}&select=id&limit=1`); if (u[0]) { const m = await sb(`organization_members?user_id=eq.${u[0].id}&select=organization_id&limit=1`); orgId = m[0]?.organization_id || null; } } catch {}
    }
    const ref = newRef();
    const row = {
      ref, organization_id: orgId, type, source, status: "REVIEWING", lang: "ar",
      title: str(b.title, 200) || text.slice(0, 80) || defaultTitle(type, "ar"), summary: text,
      conversation: text ? [{ role: "bp", content: text, at: nowIso() }] : [], scope: normScope(b.scope),
      client_name: str(b.name, 160), client_email: isEmail(email) ? email : null, client_phone: str(b.phone, 40), company_name: str(b.company, 200),
      assigned_to: str(b.assigned_to, 80) || actor, internal_notes: str(b.notes, 2000),
    };
    const rows = await sb("requests", { method: "POST", body: [row] });
    const created = rows[0];
    await logEvent(created.id, "human", actor, "request.created.manual", { source, type });
    let task = null;
    if (b.task) {
      const t = await sb("tasks", { method: "POST", body: [{ organization_id: orgId || await fallbackOrg(), title: str(b.task, 200), assignee: "bp", source: "manual", status: "open", urgency: "normal", priority: "normal", human_action: !!b.human, assigned_to: row.assigned_to, request_id: created.id }] });
      task = t[0] ? taskOut(t[0]) : null;
    }
    return json(res, 200, { ok: true, ref, request: summary(created), task });
  }

  // --------------------------------------------------------- the follow-up --

  // Read-only: what is overdue right now, and what the agents did last. Safe
  // to call on every panel load, because it changes nothing.
  if (action === "ops-follow") {
    const [board, log] = await Promise.all([
      runSweep({ dry: true, limit: 400 }),
      sb("request_events?event=in.(followup.task,followup.reminded)&select=event,actor,details,created_at,requests(ref,title,status)&order=created_at.desc&limit=60").catch(() => []),
    ]);
    return json(res, 200, { ok: true, board, log });
  }

  // The run itself. Opens tasks and sends the reminders. Idempotent by design,
  // so a double click, a second panel and a scheduler firing together cannot
  // produce a second task or a second e-mail.
  if (action === "ops-sweep") {
    const out = await runSweep({ actor, limit: 400, dry: b.dry === true });
    return json(res, 200, { ok: true, ...out });
  }

  // ------------------------------------------------ WhatsApp agent control --
  // The bot on n8n answers every message. When a human takes a conversation
  // over, an automatic reply landing in the middle of it is worse than no
  // reply at all — so operations must be able to silence the agent for one
  // number, or for everyone, from the panel.

  if (action === "ops-wa-gate") {
    const rows = await waGateRows();
    const all = rows.find((r) => r.phone === WA_ALL) || null;
    return json(res, 200, {
      ok: true,
      agent: { paused: gateLive(all), row: all },
      paused: rows.filter((r) => r.phone !== WA_ALL && gateLive(r)),
      recent: rows.filter((r) => r.phone !== WA_ALL).slice(0, 40),
      canSend: waConfigured(),
    });
  }

  if (action === "ops-wa-pause") {
    const gate = await waGateSet(b.phone, { paused: b.paused !== false, minutes: b.minutes, reason: b.reason, actor });
    if (!gate) return json(res, 400, { ok: false, error: "bad_phone" });
    return json(res, 200, { ok: true, gate });
  }

  // n8n calls this before it answers: one number in, one boolean out. It is an
  // ops- action so it goes through the same panel key — no second door.
  if (action === "ops-wa-check") {
    const rows = await waGateRows();
    const key = waKey(b.phone || qs.phone);
    const all = rows.find((r) => r.phone === WA_ALL);
    const one = key && key !== WA_ALL ? rows.find((r) => r.phone === key) : null;
    const paused = gateLive(all) || gateLive(one);
    return json(res, 200, { ok: true, paused, scope: gateLive(all) ? "all" : paused ? "number" : null, reason: (gateLive(all) ? all.reason : one && one.reason) || null });
  }

  // A message typed in the panel and sent to the customer on WhatsApp. Sending
  // it means a human is in the conversation, so the agent is paused on that
  // number for an hour unless told otherwise — the operator should not have to
  // remember two clicks to avoid the bot talking over them.
  if (action === "ops-wa-send") {
    const text = str(b.text, 3000);
    if (!text) return json(res, 400, { ok: false, error: "empty" });
    let target = null, reqRow = null;
    const ref0 = str(b.ref || qs.ref, 40);
    if (ref0) { reqRow = await getByRef(ref0); if (!reqRow) return json(res, 404, { ok: false, error: "not_found" }); target = reqRow.client_phone; }
    if (b.phone) target = b.phone;
    const to = waKey(target);
    if (!to || to === WA_ALL) return json(res, 400, { ok: false, error: "no_phone", message: "لا يوجد رقم جوال لهذا الطلب." });
    const sent = await waSend(to, text);
    if (sent.ok && b.hold !== false) await waGateSet(to, { paused: true, minutes: num(b.minutes) > 0 ? b.minutes : 60, reason: "ردّ يدوي من اللوحة", actor });
    if (reqRow) {
      const conversation = normConversation([...(reqRow.conversation || []), { role: "bp", content: text, at: nowIso() }]);
      await patchRequest(reqRow.id, { conversation });
      await logEvent(reqRow.id, "human", actor, sent.ok ? "message.whatsapp" : "message.whatsapp.failed", { preview: text.slice(0, 140), error: sent.ok ? undefined : sent.error });
    }
    if (!sent.ok) return json(res, 502, { ok: false, error: sent.error || "wa_failed", message: waFailMessage(sent.error) });
    return json(res, 200, { ok: true, mode: sent.mode, held: b.hold !== false });
  }

  // Everything below acts on one request.
  const ref = str(b.ref || qs.ref, 40);
  if (!ref) return json(res, 400, { ok: false, error: "missing_ref" });
  const row = await getByRef(ref);
  if (!row) return json(res, 404, { ok: false, error: "not_found" });

  if (action === "ops-request") {
    const [events, tasks] = await Promise.all([eventsFor(row.id, 200), tasksFor(row.id)]);
    // Files stored by path get a fresh one-hour link each time the panel loads
    // the request, so the panel's existing «المستندات» list (name + url) shows
    // the customer's uploads and the team's deliverables with no new field.
    const attachments = await Promise.all((Array.isArray(row.attachments) ? row.attachments : []).map(async (a) => {
      if (!a || !a.path) return a;
      let url = "";
      try { url = (await storageSign(a.path, 3600)) || ""; } catch {}
      // the panel prints `note` beside the name, so say what the file IS there
      const label = [a.kind === "deliverable" ? "تسليم للعميل" : a.doc ? "مستند مطلوب: " + a.doc : "", a.title, a.note].filter(Boolean).join(" · ");
      return { ...a, note: label, url: url || undefined, path: undefined };
    }));
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, request: { ...row, attachments, contract: row.contract ? { ...row.contract, html: undefined, has_html: !!row.contract.html } : null, events, tasks } });
  }

  if (action === "ops-request-update") {
    const patch = {};
    if (b.status && REQUEST_STATUSES.includes(b.status)) patch.status = b.status;
    if (b.type && REQUEST_TYPES.includes(b.type)) patch.type = b.type;
    if (b.source && REQUEST_SOURCES.includes(b.source)) patch.source = b.source;
    if (b.title != null) patch.title = str(b.title, 200);
    if (b.summary != null) patch.summary = str(b.summary, 2000);
    if (b.ai_summary != null) patch.ai_summary = str(b.ai_summary, 3000);
    if (b.internal_notes != null) patch.internal_notes = str(b.internal_notes, 4000);
    if (b.assigned_to != null) patch.assigned_to = str(b.assigned_to, 80);
    if (b.scope) { if (row.quote && row.quote.status !== "REJECTED") return json(res, 409, { ok: false, error: "scope_locked" }); patch.scope = normScope(b.scope); }
    for (const k of ["client_name", "client_phone", "company_name"]) if (b[k] != null) patch[k] = str(b[k], 200);
    if (b.client_email != null && isEmail(String(b.client_email).toLowerCase())) patch.client_email = String(b.client_email).toLowerCase();
    // The list of documents we ask the customer for: the panel can add a line,
    // waive one, or mark one received by hand. A line that flips to
    // received/waived is stamped so the customer's page can say since when.
    if (Array.isArray(b.documents)) {
      const before = new Map(normDocuments(row.documents).map((d) => [d.title, d]));
      patch.documents = normDocuments(b.documents).map((d) => {
        const was = before.get(d.title);
        return d.status !== "requested" && !d.received_at && (!was || was.status === "requested") ? { ...d, received_at: nowIso() } : d;
      });
    }
    if (!Object.keys(patch).length) return json(res, 400, { ok: false, error: "nothing_to_update" });
    const upd = await patchRequest(row.id, patch);
    await logEvent(row.id, "human", actor, patch.status ? `status.${patch.status.toLowerCase()}` : "request.updated", { fields: Object.keys(patch) });
    // A change of stage on the team's side used to be silent: the customer saw
    // the badge change if and when they opened the page. Now they are told, by
    // the same channels as every other step — unless the panel says `notify:false`
    // (a correction that is not news to the customer).
    if (patch.status && patch.status !== row.status && b.notify !== false) {
      const n = statusNotice({ ...row, ...upd }, row.status, patch.status, str(b.client_note, 500));
      if (n) await announce({ ...row, ...upd }, n.step, { ...n, to: "client" });
    }
    return json(res, 200, { ok: true, request: summary(upd) });
  }

  if (action === "ops-request-message") {
    const content = str(b.content, 4000);
    if (!content) return json(res, 400, { ok: false, error: "empty" });
    const conversation = normConversation([...(row.conversation || []), { role: "bp", content, at: nowIso() }]);
    const upd = await patchRequest(row.id, { conversation, status: row.status === "REVIEWING" || row.status === "NEW" ? "WAITING_CLIENT" : row.status });
    await logEvent(row.id, "human", actor, "message.bp", { preview: content.slice(0, 140) });
    if (row.organization_id) await notify({ organization_id: row.organization_id, event: "simple_message", title: `رد جديد على طلبك ${row.ref}`, body: content.slice(0, 200), idempotency_key: `simple_msg_${row.ref}_${Date.now()}` });
    if (row.client_email) await sendEmail(row.client_email, `رد على طلبك ${row.ref}`, `<p>${esc(content)}</p><p><a href="${myUrl(row)}">فتح الطلب</a></p>`);
    // The team answered: the «reply to the customer» task opened by their
    // message is done. Best-effort — a task that stays open is only noise.
    try { await sb(`tasks?request_id=eq.${row.id}&source=eq.reply.customer&status=in.(open,in_progress,blocked)`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: nowIso() } }); } catch {}
    return json(res, 200, { ok: true, conversation: upd.conversation, status: upd.status });
  }

  if (action === "ops-quote") {
    if (["PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED", "SIGNED", "PAYMENT_PENDING"].includes(row.status)) return json(res, 409, { ok: false, error: "too_late" });
    const out = await issueQuote(row, b.items && b.items.length ? b.items : row.scope, b, "human", actor);
    if (!out.ok) return json(res, 400, out);
    return json(res, 200, { ok: true, status: out.status, quote: out.quote });
  }

  if (action === "ops-contract") {
    if (!row.quote || !["QUOTE_APPROVED", "CONTRACT_SENT"].includes(row.status)) return json(res, 409, { ok: false, error: "quote_not_approved" });
    const issued = await issueContract(row, "human", actor, b);
    return json(res, 200, { ok: true, status: issued.status, contract: { ...issued.contract, html: undefined } });
  }


  if (action === "ops-contract-html") {
    if (!row.contract || !row.contract.html) return json(res, 404, { ok: false, error: "no_contract" });
    // اللوحة تقرأ ما يقرأه العميل — بما فيه النسخة المصحَّحة — وتُنبَّه إن
    // كان العقد قد صُحِّح بعد التوقيع فيحتاج توقيعاً جديداً.
    return json(res, 200, { ok: true, html: row.contract.html, needsResign: !!row.contract.needs_resign, correctedAt: row.contract.corrected_at || "" });
  }

  // الإلغاء من لوحة العمليات: في أي مرحلة، بسببٍ مُدوَّن، وبإشعار الطرفين.
  // المال لا يُمَسّ هنا: طلبٌ مدفوع يُلغى ويبقى الاسترداد خطوةً منفصلة
  // يقرّرها المالك في البوابة — إلغاءٌ يحرّك مبلغاً بلا قرارٍ صريح أسوأ من
  // إلغاءٍ لا يحرّكه.
  if (action === "ops-cancel") {
    if (row.status === "CANCELLED") return json(res, 409, { ok: false, error: "already_cancelled" });
    const note = str(b.note, 500);
    const wasPaid = row.payment && row.payment.status === "PAID";
    const upd = await patchRequest(row.id, {
      status: "CANCELLED",
      cancel: { at: nowIso(), by: "ops", actor, note, stage: row.status, was_paid: !!wasPaid },
      cancel_request: null,
    });
    await logEvent(row.id, "ops", actor, "request.cancelled", { note, stage: row.status, by: "ops" });
    await audit({ organization_id: row.organization_id, action: "simple.request.cancel", entity: "requests", entity_id: row.id, meta: { ref: row.ref, note } });
    await announce(upd, "cancelled", {
      subject: `أُلغي الطلب ${row.ref}`,
      clientLine: `ألغينا الطلب.${note ? ` السبب: ${note}` : ""} إن كان لديك استفسار راسلنا وسنساعدك.`,
      opsLine: `${actor} ألغى الطلب من مرحلة ${row.status}.${wasPaid ? " ⚠️ الطلب مدفوع — الاسترداد قرارٌ منفصل لم يُنفَّذ." : ""}`,
    });
    return json(res, 200, { ok: true, status: "CANCELLED", wasPaid: !!wasPaid, refundPending: !!wasPaid });
  }

  // التراجع عن الإلغاء: الأخطاء تقع، وطلبٌ أُلغي بالخطأ يجب أن يعود بلا
  // إعادة إنشاء تفقد تاريخه كله.
  if (action === "ops-reopen") {
    if (row.status !== "CANCELLED") return json(res, 409, { ok: false, error: "not_cancelled" });
    const back = REQUEST_STATUSES.includes(str(b.status, 40)) ? str(b.status, 40)
      : (row.cancel && REQUEST_STATUSES.includes(row.cancel.stage) ? row.cancel.stage : "REVIEWING");
    const upd = await patchRequest(row.id, { status: back, cancel: null, cancel_request: null });
    await logEvent(row.id, "ops", actor, "request.reopened", { to: back });
    await announce(upd, "reopened", {
      subject: `أُعيد فتح الطلب ${row.ref}`,
      clientLine: "أعدنا فتح طلبك ونكمل من حيث توقّفنا.",
      opsLine: `${actor} أعاد فتح الطلب إلى ${back}.`,
    });
    return json(res, 200, { ok: true, status: back });
  }

  // إعادة إصدار العقد للتوقيع: تُستعمل حين صُحِّح عقدٌ بعد توقيعه. العقد
  // يُبنى من عرض السعر المعتمد، والحالة تعود CONTRACT_SENT فيُوقّع العميل
  // النسخة الصحيحة. سجلّ التوقيع القديم يبقى في الأحداث، ولا يُنسب إلى
  // النسخة الجديدة.
  if (action === "ops-contract-reissue") {
    if (!row.quote || !Array.isArray(row.quote.items) || !row.quote.items.length) return json(res, 409, { ok: false, error: "no_quote" });
    const built = buildContract(row, { lead_time: str(b.lead_time, 120), executor: str(b.executor, 120) });
    const contract = { ...built, number: row.contract?.number || built.number, reissued_at: nowIso(), reissue_of: row.contract?.number || "" };
    const upd = await patchRequest(row.id, { contract, status: "CONTRACT_SENT" });
    await logEvent(row.id, "ops", actor, "contract.reissued", { number: contract.number });
    await announce(upd, "contract", {
      subject: `نسخة مصحَّحة من العقد ${contract.number} بانتظار توقيعك`,
      clientLine: "صدرت نسخة مصحَّحة من العقد بنفس بنود عرض السعر المعتمد. راجعها ووقّعها لنكمل.",
      opsLine: `أُعيد إصدار العقد ${contract.number} وعادت الحالة إلى بانتظار التوقيع.`,
      cta: "افتح العقد ووقّعه",
    });
    return json(res, 200, { ok: true, status: upd.status, contract: { ...contract, html: undefined } });
  }

  if (action === "ops-mark-paid") {
    // Bank transfer or a payment confirmed outside the gateway.
    if (!row.quote) return json(res, 409, { ok: false, error: "no_quote" });
    const upd = await markPaid(row, { provider: str(b.provider, 40) || "bank_transfer", payId: str(b.reference, 80) || ("manual_" + Date.now()), amount: row.quote.total, test: SIMPLE_TEST_MODE && b.test !== false, actor });
    return json(res, 200, { ok: true, status: upd.status, payment: upd.payment, invoice: upd.invoice });
  }

  if (action === "ops-task-create") {
    const title = str(b.title, 200);
    if (!title) return json(res, 400, { ok: false, error: "missing_title" });
    const t = await sb("tasks", { method: "POST", body: [{
      organization_id: row.organization_id || await fallbackOrg(), request_id: row.id, title, details: str(b.details, 2000),
      assignee: b.assignee === "client" ? "client" : "bp", source: str(b.source, 40) || "manual", status: "open",
      urgency: ["urgent", "soon", "normal"].includes(b.urgency) ? b.urgency : "normal",
      priority: ["low", "normal", "high", "urgent"].includes(b.priority) ? b.priority : "normal",
      human_action: !!b.human_action, assigned_to: str(b.assigned_to, 80) || null, due_at: b.due_at || null,
    }] });
    await logEvent(row.id, b.by_ai ? "ai" : "human", b.by_ai ? "المستشار الذكي" : actor, b.human_action ? "task.human_required" : "task.created", { title });
    if (b.assignee === "client" && row.organization_id) await notify({ organization_id: row.organization_id, event: "simple_task", title: `مطلوب منك: ${title}`, body: row.ref, idempotency_key: `simple_task_${t[0].id}` });
    return json(res, 200, { ok: true, task: taskOut(t[0]) });
  }

  if (action === "ops-ready") {
    if (row.status !== "PAID") return json(res, 409, { ok: false, error: "not_paid" });
    const upd = await patchRequest(row.id, { status: "IN_PROGRESS" });
    await logEvent(row.id, "human", actor, "execution.started", {});
    // «بدء التنفيذ» is the moment the customer has been waiting for since the
    // payment; it used to land in the timeline and nowhere else.
    if (b.notify !== false) {
      const n = statusNotice({ ...row, ...upd }, row.status, "IN_PROGRESS", str(b.client_note, 500));
      if (n) await announce({ ...row, ...upd }, n.step, { ...n, to: "client" });
    }
    return json(res, 200, { ok: true, status: "IN_PROGRESS" });
  }

  if (action === "ops-appointment") {
    const prev = row.appointment || null;
    const appointment = { ...(row.appointment || {}), date: str(b.date, 10) || row.appointment?.date, time: str(b.time, 5) || row.appointment?.time, topic: str(b.topic, 200) || row.appointment?.topic || row.title, status: b.cancel ? "CANCELLED" : "BOOKED", by: actor, updated_at: nowIso() };
    const upd = await patchRequest(row.id, { appointment });
    await logEvent(row.id, "human", actor, b.cancel ? "appointment.cancelled" : "appointment.set", { date: appointment.date, time: appointment.time });
    // Moving or cancelling a customer's appointment without telling them is how
    // somebody turns up to a call nobody is on. Told only when something the
    // customer would notice changed.
    const moved = !prev || prev.status === "CANCELLED" || prev.date !== appointment.date || prev.time !== appointment.time;
    const live = { ...row, ...upd };
    if (b.notify !== false) {
      if (b.cancel && prev && prev.status !== "CANCELLED") {
        await announce(live, "appt-cancelled", {
          subject: `أُلغي موعدك — ${row.ref}`,
          clientLine: `ألغينا موعد ${prev.date} الساعة ${prev.time} (بتوقيت الرياض) الخاص بطلبك «${row.title}». إن احتجت موعداً بديلاً اكتب لنا من داخل الطلب.`,
          cta: "افتح الطلب", to: "client",
        });
      } else if (!b.cancel && appointment.date && appointment.time && moved) {
        await announce(live, "appt-set", {
          subject: `${prev && prev.status !== "CANCELLED" ? "تعديل موعدك" : "تم تثبيت موعدك"} — ${row.ref}`,
          clientLine: `${prev && prev.status !== "CANCELLED" ? "عدّلنا موعدك إلى" : "ثبّتنا موعدك يوم"} ${appointment.date} الساعة ${appointment.time} (بتوقيت الرياض) — ${appointment.topic}. إن لم يناسبك غيّره من داخل الطلب.`,
          cta: "افتح الطلب", to: "client",
        });
      }
    }
    return json(res, 200, { ok: true, appointment });
  }

  // Finished work handed to the customer: a file, a title, an optional note. It
  // lands in «مخرجات الطلب» inside the request in /my and the customer is told
  // by mail. `complete:true` also closes the request in the same step (one
  // message, not two). A delivery on a quoted request needs the payment first;
  // `force:true` is the panel's explicit «deliver anyway».
  if (action === "ops-deliverable-add") {
    if (row.status === "CANCELLED") return json(res, 409, { ok: false, error: "request_closed" });
    const title = str(b.title, 200);
    if (!title) return json(res, 400, { ok: false, error: "missing_title" });
    if (row.quote && !(row.payment && row.payment.status === "PAID") && b.force !== true) return json(res, 409, { ok: false, error: "not_paid", message: "الطلب غير مدفوع بعد — لا يُسلَّم العمل قبل الدفع إلا بتأكيد صريح." });
    const all = Array.isArray(row.attachments) ? row.attachments : [];
    if (all.length >= UPLOAD_CAP) return json(res, 409, { ok: false, error: "too_many_files" });
    const stored = await storeUpload(row, b, { kind: "deliverable", by: "team", note: b.note });
    if (!stored.ok) return json(res, stored.status, { ok: false, error: stored.error, max: stored.max });
    const rec = { ...stored.rec, title, by_name: actor };
    const patch = { attachments: [...all, rec] };
    const closing = b.complete === true && ["PAID", "IN_PROGRESS", "WAITING_INTERNAL"].includes(row.status);
    if (closing) patch.status = "COMPLETED";
    const upd = await patchRequest(row.id, patch);
    await logEvent(row.id, "human", actor, "deliverable.added", { title, name: rec.name });
    if (closing) await logEvent(row.id, "human", actor, "status.completed", { fields: ["status"] });
    if (b.notify !== false) {
      await announce({ ...row, ...upd }, "deliverable", {
        subject: `سلّمنا لك: ${title} — ${row.ref}`,
        clientLine: `${closing ? "اكتمل طلبك «" + row.title + "» وسلّمنا لك" : "سلّمنا لك"} «${title}»${rec.note ? " — " + rec.note : ""}. تجده في قسم «مخرجات الطلب» داخل طلبك، وتنزّله من هناك.`,
        cta: "افتح مخرجات الطلب", to: "client",
      });
    }
    return json(res, 200, { ok: true, status: upd.status, deliverable: { ...rec, path: undefined } });
  }

  if (action === "ops-deliverable-delete") {
    const id = str(b.id, 40);
    const att = (row.attachments || []).find((a) => a && a.id === id && a.kind === "deliverable");
    if (!att) return json(res, 404, { ok: false, error: "not_found" });
    await patchRequest(row.id, { attachments: row.attachments.filter((a) => a !== att && !(a && a.id === id)) });
    if (att.path) { try { await storageDelete(att.path); } catch {} }
    await logEvent(row.id, "human", actor, "deliverable.removed", { title: att.title || att.name });
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { ok: false, error: "unknown_action" });
}

// Price scope items from the catalog by SKU; anything unknown keeps the
// price the owner typed (or 0 so it visibly needs a decision).
async function priceItems(items) {
  let cat = null;
  try { cat = await loadCatalog(); } catch {}
  const byCode = new Map();
  for (const s of (cat && cat.services) || []) if (s.code) byCode.set(String(s.code).toUpperCase(), s);
  return (Array.isArray(items) ? items : []).map((it) => {
    const svc = it.code ? byCode.get(String(it.code).toUpperCase()) : null;
    // loadCatalog() flattens price to a number; the raw catalogue file keeps
    // it as {amount,label}. Reading only the object shape silently priced
    // every catalogue line at zero.
    const catPrice = svc ? num(svc.price && typeof svc.price === "object" ? svc.price.amount : (svc.price != null ? svc.price : svc.amount)) : 0;
    // الاسم الإنجليزي من الكتالوج يُحمل مع البند ليُطبع في العمود المقابل
    // بلغة العميل. ما لا اسم إنجليزي له يبقى بالعربية في العمودين — أفضل من
    // ترجمةٍ آلية لاسم خدمة حكومية داخل عقد.
    return { code: it.code, title: it.title || (svc && (svc.nameAr || svc.name)) || "",
      titleEn: str((svc && (svc.nameEn || svc.name)) || it.titleEn || "", 200),
      description: it.description || it.why || "", qty: it.qty || 1,
      price: it.price != null && it.price !== "" ? num(it.price) : catPrice };
  });
}
function guessType(text) {
  const t = String(text || "");
  if (/تأسيس|فرع|رخصة استثمار|ريادة|MISA|سجل تجاري جديد|company|formation|branch/i.test(t)) return "COMPANY_FORMATION";
  if (/قوى|أجير|مساند|التأمينات|مدد|مقيم|أبشر|بلدي|زاتكا|الزكاة|تأشير|نطاقات|مهنة|رخصة|تصعيد|شكوى|مخالفة|مديونية|تغيب|خروج نهائي|لائحة تنظيم العمل|qiwa|ajeer|musaned|gosi|mudad|muqeem|zatca|visa|escalation/i.test(t)) return "GOVERNMENT_SERVICE";
  return "CONSULTATION";
}
// tasks.organization_id is NOT NULL: manual intake for a not-yet-registered
// client parks its tasks on the owner's own organization.
let _fallbackOrg = null;
// One open pricing task per request — pressing «اعتمد النطاق» twice must not
// fill the operations queue with duplicates.
// "Is the payment connected? and Tamara? and the invoice?" — a question that
// used to have no answer but a guess, because every key is server-side with no
// surface. This reports whether each one is configured, never what it is: a
// boolean cannot be replayed, a key can. Behind the panel key, because telling
// the world which integrations are unset is itself a hint worth withholding.
function integrationStatus() {
  const on = (v) => !!String(v || "").trim();
  const pk = process.env.MOYASAR_PUBLISHABLE_KEY || "";
  const sk = process.env.MOYASAR_SECRET_KEY || "";
  const live = (k) => /^(pk|sk)_live_/.test(String(k).trim());
  return {
    card: { ready: on(pk) && on(sk), mode: live(pk) || live(sk) ? "live" : on(pk) ? "test" : "—",
      publishable: on(pk), secret: on(sk),
      // Without the webhook secret a payment is only confirmed by the browser
      // coming back. A customer who pays and closes the tab is then paid in the
      // gateway and unpaid here — worth naming, not hiding.
      webhook: on(process.env.MOYASAR_WEBHOOK_SECRET) },
    tamara: { ready: on(process.env.TAMARA_API_TOKEN), base: (process.env.TAMARA_API_BASE || "").includes("sandbox") ? "sandbox" : "live" },
    daftra: { ready: daftraConfigured(), subdomain: (process.env.DAFTRA_SUBDOMAIN || "businesspartner").trim() },
    email: { ready: on(process.env.RESEND_API_KEY) || on(process.env.RESEND_KEY), notify: NOTIFY_ON, from: on(process.env.OTP_FROM_EMAIL) },
    google: { ready: on(process.env.GOOGLE_CLIENT_ID) },
    database: { ready: DB_ON },
    modes: MODES(),
  };
}

// ------------------------------------------------------------ الإشعارات --
// كل خطوة في الرحلة يعلمها الطرفان: العميل بالبريد وواتساب، والشركة بالبريد
// وواتساب. صفقةٌ تتقدّم بلا أن يعلم أحد ليست تقدّماً — العميل ينتظر ما وصله،
// والفريق يكتشف الدفعة بعد يومين.
//
// كل قناة في محاولتها: فشل واتساب لا يمنع البريد، وفشل بريد العميل لا يمنع
// إشعار الفريق. وما نجح وما فشل يُسجَّل في أحداث الطلب، فتظهر في اللوحة —
// إشعارٌ يُظنّ أنه وصل وهو لم يصل أسوأ من إشعار لم يُرسل.
const OWNER_WA = String(process.env.CRM_OWNER_WHATSAPP || process.env.OWNER_WHATSAPP || "966530540231").replace(/\D/g, "");

// The request's own page in /my — the one link every message to the customer
// carries.
const myUrl = (row) => `${SELF_BASE}/${row.lang === "en" ? "" : (row.lang || "ar") + "/"}my?ref=${row.ref}`;

// What the customer is told when the TEAM moves their request. Only the stages
// that are the team's to move; the steps owned by the quotation / contract /
// payment flows announce themselves where they happen. The customer's own
// words for a stage (see ST in simple-v1-my.mjs) are kept: WAITING_INTERNAL
// reads «قيد التنفيذ» to them, so moving between the two is not news.
function statusNotice(row, from, to, note) {
  const same = (s) => (s === "WAITING_INTERNAL" ? "IN_PROGRESS" : s);
  if (same(from) === same(to)) return null;
  const tail = note ? ` ${note}` : "";
  const files = (Array.isArray(row.attachments) ? row.attachments : []).some((a) => a && a.kind === "deliverable");
  const t = {
    REVIEWING: { subject: `طلبك قيد المراجعة — ${row.ref}`, line: "بدأ فريقنا مراجعة طلبك. نعود إليك بالخطوة التالية من داخل الطلب." },
    WAITING_CLIENT: { subject: `طلبك بانتظار ردّك — ${row.ref}`, line: "نحتاج منك ردّاً أو معلومة لنكمل طلبك. افتح الطلب واكتب لنا." },
    IN_PROGRESS: { subject: `بدأ تنفيذ طلبك — ${row.ref}`, line: "بدأ فريقنا تنفيذ طلبك الآن. نبلغك بأي تحديث، وتجد كل جديد داخل طلبك." },
    WAITING_INTERNAL: { subject: `بدأ تنفيذ طلبك — ${row.ref}`, line: "بدأ فريقنا تنفيذ طلبك الآن. نبلغك بأي تحديث، وتجد كل جديد داخل طلبك." },
    COMPLETED: { subject: `اكتمل طلبك — ${row.ref}`, line: `اكتمل طلبك «${row.title}».${files ? " ملفات التسليم في قسم «مخرجات الطلب» داخل طلبك." : ""} شكراً لثقتك.` },
    CANCELLED: { subject: `أُلغي الطلب ${row.ref}`, line: "أُلغي طلبك. إن كان لديك استفسار راسلنا من داخل الحساب وسنساعدك." },
  }[to];
  if (!t) return null;
  return { step: "status-" + to.toLowerCase().replace(/_/g, "-"), subject: t.subject, clientLine: t.line + tail, cta: to === "WAITING_CLIENT" ? "افتح الطلب وردّ" : "افتح الطلب" };
}

// A notice to the TEAM about something the customer did. At most one per
// request per window (a customer typing five lines in a minute is one alert,
// not five), recorded as an internal event so the customer's timeline never
// shows it. `task` opens one — and only one — pending human task.
async function alertOps(row, step, { subject, line, windowMin = 10, task }) {
  try {
    if (task) { try { await sweepTask(row, { source: task.source, title: () => task.title, details: () => task.details || "", human: true, urgency: task.urgency || "high" }, "النظام"); } catch (e) { console.error("alertOps task", String(e.message || e).slice(0, 100)); } }
    const since = new Date(Date.now() - windowMin * 6e4).toISOString();
    const recent = await sb(`request_events?request_id=eq.${row.id}&event=eq.notify.${step}&created_at=gte.${since}&select=id&limit=1`);
    if (recent && recent[0]) return false;
    await announce(row, step, { subject, clientLine: line, opsLine: line, to: "ops" });
    return true;
  } catch (e) { console.error("alertOps", step, String(e.message || e).slice(0, 100)); return false; }
}

async function announce(row, step, { subject, clientLine, opsLine, cta, to = "both", clientEmail = true, opsEmail = true }) {
  const toClient = to !== "ops", toOps = to !== "client";
  const url = myUrl(row);
  // «لم يُرسل» و«أُرسل إلى صندوق المعاينة» و«رفضته البوابة» ثلاثة أشياء
  // مختلفة. تسجيلها كلها `false` يجعل اللوحة تقول «فشل» حيث لا فشل، ويخفي
  // الفشل الحقيقي بين مثله.
  const mark = (r) => (r && r.ok ? true : (r && (r.skipped || r.error)) || false);
  const out = { email: "—", wa: "—", ops_email: false, ops_wa: false };
  if (toClient && !clientEmail) out.email = "sent_separately";
  else if (toClient) try {
    if (row.client_email) {
      out.email = mark(await sendEmail(row.client_email, subject,
        `<p>${esc(clientLine)}</p><p><a href="${url}">${esc(cta || "فتح الطلب")} ${esc(row.ref)}</a></p>`));
    } else out.email = "no_email";
  } catch (e) { out.email = String(e.message || "failed").slice(0, 60); }
  if (toClient) try {
    if (row.client_phone) out.wa = mark(await waSend(row.client_phone, `${clientLine}\n${url}`));
    else out.wa = "no_phone";
  } catch (e) { out.wa = String(e.message || "failed").slice(0, 60); }
  const who = [row.client_name, row.company_name, row.client_email, row.client_phone].filter(Boolean).join(" · ");
  if (toOps && !opsEmail) out.ops_email = "sent_separately";
  if (toOps && opsEmail) try {
    const r = await sendEmail(OWNER_EMAIL, `[${row.ref}] ${subject}`,
      `<p>${esc(opsLine || clientLine)}</p><p>${esc(who)}</p><p><a href="${SELF_BASE}/ops?ref=${row.ref}">افتح الطلب في اللوحة</a></p>`);
    out.ops_email = mark(r);
  } catch {}
  if (toOps) try {
    if (OWNER_WA) {
      const r = await waSend(OWNER_WA, `${row.ref} — ${opsLine || clientLine}\n${SELF_BASE}/ops?ref=${row.ref}`);
      out.ops_wa = mark(r);
    }
  } catch {}
  if (toClient) try {
    if (row.organization_id) {
      await notify({ organization_id: row.organization_id, event: `simple_${step}`, title: subject, body: clientLine.slice(0, 200), idempotency_key: `simple_${step}_${row.ref}_${Math.floor(Date.now() / 6e4)}` });
    }
  } catch {}
  // a notice to the team is bookkeeping, not part of the customer's story
  await logEvent(row.id, toClient ? "system" : "internal", "الإشعارات", `notify.${step}`, out);
  return out;
}

async function pricingTask(row, unpriced) {
  try {
    const open = await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&status=in.(open,in_progress,blocked)&select=id&limit=1`);
    if (open && open[0]) return;
    await sb("tasks", { method: "POST", body: [{
      organization_id: row.organization_id || await fallbackOrg(),
      title: `تسعير نطاق ${row.ref}`,
      details: unpriced.length ? `بنود بلا سعر في الكتالوج: ${unpriced.join(" · ")}` : "راجع النطاق وأصدر عرض السعر.",
      assignee: "bp", source: "pricing", status: "open", urgency: "high", priority: "high",
      human_action: true, assigned_to: row.assigned_to || null, request_id: row.id,
    }] });
  } catch {}
}

async function fallbackOrg() {
  if (_fallbackOrg) return _fallbackOrg;
  const email = (process.env.OWNER_EMAILS || "dr.baher.magnas@gmail.com").split(",")[0].trim().toLowerCase();
  try {
    const u = await sb(`users?email=eq.${q(email)}&select=id&limit=1`);
    if (u[0]) { const m = await sb(`organization_members?user_id=eq.${u[0].id}&select=organization_id&limit=1`); if (m[0]) return (_fallbackOrg = m[0].organization_id); }
    const any = await sb("organizations?select=id&order=created_at.asc&limit=1");
    if (any[0]) return (_fallbackOrg = any[0].id);
  } catch {}
  return null;
}
