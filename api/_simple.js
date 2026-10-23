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
import { contractHtml, quoteHtml, portalContractHtml } from "./_docusign.js";
import { templateForVersion, templateForLang } from "./_bp-docs.js";
import { loadCatalog, normalizeText } from "./_catalog.js";
import { isSeedTitle } from "./_scope-seeds.js";
import { loadPriceBook, resolveSku, referencePrice } from "./_catalog-prices.js";
import { daftraConfigured } from "./_daftra.js";
import { issuePaidInvoice, reportInvoiceBlocked, invoiceIsComplete, invoiceRetryDue, publicInvoice } from "./_invoicing.js";
import { ownerTicketOk, panelRequiresNafath, isNafathPlaceholderEmail } from "./_nafath.js";
import { DEV, EMAIL_LIVE, MODES, outbox, outboxList, PAY_MOCK, TAMARA_MOCK } from "./_mode.js";
import { isOwnerEmail } from "./_trial.js";
import { waSend, waNumber } from "./_stage.js";
import { storagePut, storageSign, storageDelete } from "./_db.js";
import { readDocumentRaw, parseJson, DOC_MIME_OK, MAX_DOC_BYTES } from "./_docread.js";
import { signBankToken } from "./_bank-transfer.js";
import { validateSlot, bookingMessage, bookingConfig, manageToken } from "./_booking.js";
import { normalizePhone } from "./_clientauth.js";

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
// ----------------------------------------------------- cancellation policy --
// What the customer may cancel on his own (owner's rule, 2026-10-16): anything
// where nothing has been paid and the work has not started. Beyond that the
// team has to look first — there is money, or an executed order, to account for.
//
// The money check reads the request's own payment record, not the status name:
// PAYMENT_PENDING means «the customer pressed pay», not «the customer paid».
// SIGNED is in the list (owner's decision, 2026-10-17: «ألغِ الاثنين فوراً»): a
// signed contract with nothing charged yet is cancelled at once, exactly like
// PAYMENT_PENDING; the moment a payment or an invoice exists it goes to the team.
const CANCEL_NOW = ["NEW", "REVIEWING", "WAITING_CLIENT", "QUOTE_SENT", "PRICING", "QUOTE_APPROVED", "CONTRACT_SENT", "SIGNED", "PAYMENT_PENDING"];
const PAID_STATES = ["PAID", "AUTHORIZED", "CAPTURED", "APPROVED", "COMPLETED", "SUCCEEDED", "SETTLED", "SUCCESS"];
function moneyReceived(row) {
  const p = row && row.payment;
  if (p && (PAID_STATES.includes(String(p.status || "").toUpperCase()) || p.paid_at)) return true;
  // حوالة بنكية رفع العميل إيصالها: المال في الغالب خرج منه، فلا يُلغى الطلب فوراً بلا نظر الفريق.
  if (p && p.provider === "bank" && p.receipt) return true;
  return !!(row && row.invoice && row.invoice.number);
}
// "now" | "ask" | "closed" — the one place that decides; the portal only words it.
export function cancelPolicy(row) {
  if (!row || ["CANCELLED", "COMPLETED"].includes(row.status)) return "closed";
  return CANCEL_NOW.includes(row.status) && !moneyReceived(row) ? "now" : "ask";
}
// The stage in the team's words, for the lines the engine writes itself (the
// panel and the e-mail both print them; a raw code like IN_PROGRESS is not a sentence).
const STAGE_AR = {
  NEW: "جديد", REVIEWING: "قيد المراجعة", WAITING_CLIENT: "بانتظار ردّ العميل", WAITING_INTERNAL: "بانتظار الفريق", PRICING: "قيد التسعير",
  QUOTE_SENT: "عرض سعر مُرسل", QUOTE_APPROVED: "العرض معتمد", CONTRACT_SENT: "عقد بانتظار التوقيع", SIGNED: "عقد موقّع بانتظار الدفع",
  PAYMENT_PENDING: "بانتظار الدفع", PAID: "مدفوع", IN_PROGRESS: "قيد التنفيذ", COMPLETED: "مكتمل", CANCELLED: "ملغي",
};
const stageAr = (s) => STAGE_AR[s] || String(s || "");
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

// ------------------------------------------------ who the client is (D3) --
// An account opened with an e-mail link or a password has no name: the first
// sign-in used the part of the address before the «@» as the person's name and
// as the organisation's name, and from there it travelled onto the quotation,
// the contract, the invoice and the operations board («journey1»,
// «العميل —», «لا رقم جوال»). A name that is only the address's own prefix is
// a placeholder, never a name — it is asked for once, in /my, and the real one
// replaces it everywhere the client is written down.
const emailLocal = (email) => String(email || "").split("@")[0].trim().toLowerCase();
export function isPlaceholderName(name, email) {
  const n = String(name == null ? "" : name).trim().toLowerCase();
  if (!n || n.includes("@")) return true;
  const lp = emailLocal(email);
  return !!lp && n === lp;
}
// The name printed on a quotation, contract or invoice: the company if the
// client named one, else the person; the address's prefix is never either.
export function partyName(row) {
  const email = row && row.client_email;
  const company = String((row && row.company_name) || "").trim(), person = String((row && row.client_name) || "").trim();
  if (company && !isPlaceholderName(company, email)) return company;
  if (person && !isPlaceholderName(person, email)) return person;
  return String(email || "") || company || person;
}
const cleanFullName = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 160);
// «الاسم الكامل»: at least two words, letters only — a single token is the
// address prefix again, and digits or markup are never part of a person's name.
export function fullNameOk(v) {
  const n = cleanFullName(v);
  return n.length >= 5 && !/[\d@<>{}\\/]/.test(n) && n.split(" ").filter((w) => w.length >= 2).length >= 2;
}
async function userPhone(sess) {
  try {
    const r = await sb(`users?id=eq.${q(sess.user.id)}&select=phone&limit=1`);
    return str(r && r[0] && r[0].phone, 40);
  } catch { return ""; }
}
// What /my needs to ask before it can serve this client properly.
async function profileOf(sess) {
  const email = String(sess.user?.email || "").toLowerCase();
  const name = isPlaceholderName(sess.user?.full_name, email) ? "" : cleanFullName(sess.user.full_name);
  const phone = await userPhone(sess);
  return { name, phone, needsName: !fullNameOk(name), needsPhone: !phone };
}

// The owner's panel key, exactly as /api/requests and /api/chat accept it.
const PANEL_KEYS = new Set([(process.env.PANEL_KEY || "").trim(), (process.env.LEADS_KEY || process.env.DASHBOARD_KEY || "").trim()].filter(Boolean));
function opsOk(src) {
  const key = String((src && src.key) || "").trim();
  const ticket = String((src && src.ticket) || "").trim();
  if (ticket && ownerTicketOk(ticket)) return true;
  // With PANEL_REQUIRE_NAFATH on, the ticket above is the ONLY way in: not the
  // panel key, and not the throwaway test keys below either. (The test keys used
  // to slip past this switch — harmless in production, where they do not exist,
  // but a preview with the switch on would still have opened to a known string.)
  if (panelRequiresNafath()) return false;
  if (PANEL_KEYS.size && PANEL_KEYS.has(key)) return true;
  // Preview/test only: a throwaway key so the owner can test /ops without
  // exposing the production panel key on a preview URL.
  if (SIMPLE_TEST_MODE && key && key === (process.env.SIMPLE_OPS_KEY || "test-ops")) return true;
  // Local development only: the documented dashboard key from .env.local.
  if (DEV && key && key === (process.env.SIMPLE_OPS_KEY || "test-ops")) return true;
  return false;
}

// ---------------------------------------------------------- the sales role --
// A narrow door beside the owner's, for the sales team (owner decision
// 2026-10-21): they keep their own clients' stages and published updates, and
// see nothing else in /ops — no payments, invoices, contracts, quotes, other
// clients, tasks or settings.
//
//   WHO    — a signed-in session whose e-mail is listed in SALES_TEAM_EMAILS (an
//            environment variable: comma / space separated). Unset or empty =
//            there is no sales role at all; nothing defaults to anything.
//   WHAT   — only the actions in SALES_ACTIONS. Every other ops-* action is 403.
//   WHOSE  — only requests the owner tagged for sales: `assigned_to` equals
//            «sales» (the whole team) or the member's own e-mail. A sales user
//            cannot change `assigned_to` (ops-request-update is not in the list),
//            so he cannot hand himself a client. Anything else is 403.
//
// The owner's own door is untouched: a valid panel key / Nafath ticket / owner
// e-mail session is resolved first, exactly as before, and PANEL_REQUIRE_NAFATH
// still closes the owner's session door. The sales door never opens an owner
// action, so it weakens nothing there.
const SALES_EMAIL_RE = /^[a-z0-9._+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i; // no comma / paren: the address is placed inside a PostgREST or=() filter
export function salesTeamEmails() {
  return String(process.env.SALES_TEAM_EMAILS || "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => SALES_EMAIL_RE.test(x));
}
export const isSalesEmail = (email) => { const e = String(email || "").trim().toLowerCase(); return !!e && salesTeamEmails().includes(e); };
export const SALES_ACTIONS = new Set(["ops-requests", "ops-request", "ops-stages-init", "ops-stage-set", "ops-update-add", "ops-update-edit", "ops-update-publish", "ops-update-unpublish", "ops-update-delete"]);
export const SALES_TAG = "sales";
export function inSalesScope(row, email) {
  const a = String((row && row.assigned_to) || "").trim().toLowerCase();
  return !!a && (a === SALES_TAG || a === String(email || "").trim().toLowerCase());
}
// What a sales user may read of a request: who the client is, where the work
// stands, the stages and the team's updates (drafts included — they are his).
// Nothing monetary or contractual, no conversation, no internal notes, no tasks.
function salesRequestView(row, events) {
  return {
    ref: row.ref, type: row.type, source: row.source, status: row.status, title: row.title, lang: row.lang,
    created_at: row.created_at, updated_at: row.updated_at,
    client_name: row.client_name, client_email: row.client_email, client_phone: row.client_phone, company_name: row.company_name,
    assigned_to: row.assigned_to || null,
    stages: Array.isArray(row.stages) ? row.stages : [],
    updates: Array.isArray(row.updates) ? row.updates : [],
    events: (events || []).filter((e) => /^(stages?|update)\./.test(String(e.event || ""))),
  };
}
function salesListRow(row) {
  const st = Array.isArray(row.stages) ? row.stages : [];
  return {
    ref: row.ref, type: row.type, source: row.source, status: row.status, title: row.title,
    created_at: row.created_at, updated_at: row.updated_at,
    client_name: row.client_name, client_email: row.client_email, client_phone: row.client_phone, company_name: row.company_name,
    assigned_to: row.assigned_to || null,
    stages_total: st.length, stages_done: st.filter((x) => x && x.status === "done").length,
  };
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
// The cancel and the hiding travel in one PATCH. If the database refuses the
// extra column (db/migrations/2026-10-requests-deleted-at.sql not applied yet)
// the cancellation must still go through — the row is then cancelled and visible,
// exactly as before this column existed, and the next cancel hides it once the
// column is there.
async function patchRequestHide(id, patch, deletedAt) {
  if (!deletedAt) return patchRequest(id, patch);
  try { return await patchRequest(id, { ...patch, deleted_at: deletedAt }); }
  catch (e) {
    console.error("simple: deleted_at not stored - apply db/migrations/2026-10-requests-deleted-at.sql", String(e && e.message || e).slice(0, 80));
    return patchRequest(id, patch);
  }
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
  // The invoice record carries the issuing state and the draft it was built from;
  // the customer sees it only once Daftra has numbered it, and without those.
  pub.invoice = publicInvoice(pub.invoice);
  // حوالة رُفع إيصالها وتنتظر التحقق: الصفحة تقول «إيصالك قيد المراجعة» ولا تعرض زر دفعٍ جديد.
  if (pub.payment && bankUnderReview(row)) pub.payment = { ...pub.payment, review: true };
  if (pub.contract && pub.contract.html) pub.contract = { ...pub.contract, html: undefined, html_signed: undefined, has_html: true };
  if (pub.nda && pub.nda.html) pub.nda = { ...pub.nda, html: undefined, has_html: true };
  if (pub.quote && pub.quote.payment_terms) pub.quote = { ...pub.quote, payment_terms: localTerms(pub.quote, row.lang) };
  // Machine bookkeeping («notify.paid», «followup.task») is for the panel: the
  // customer's timeline used to print those keys raw.
  const visible = (e) => e.actor_kind !== "internal" && !/^(notify\.|followup\.task)/.test(String(e.event || ""));
  // Stages and published updates only. A request with neither is returned
  // exactly as before (no new keys), so a customer who never had a progress line
  // sees nothing new; a draft update never leaves the server.
  delete pub.stages; delete pub.updates;
  const stages = publicStages(row), updates = publicUpdates(row);
  if (stages.length) pub.stages = stages;
  if (updates.length) pub.updates = updates;
  return { ...pub, cancel_policy: cancelPolicy(row), origin: isCartRow(row) ? "cart" : isTicketRow(row) ? "ticket" : "", attachments: clientAttachments(row), events: (events || []).filter(visible), tasks: (tasks || []).filter((t) => t.assignee === "client") };
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
// Type, size and signature checks — no storage, no side effect. The bank-transfer intake runs them
// BEFORE it opens an order, so a bad file never leaves a «waiting» order behind.
export function validateUpload(b) {
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
  return { ok: true, base64, display, mime, bytes, buf };
}
let _storeForTest = null;
export function __setStoreForTest(fn) { _storeForTest = fn || null; }
async function storeUpload(row, b, { kind, by, note, doc }) {
  const v = validateUpload(b);
  if (!v.ok) return v;
  const { display, mime, bytes, buf } = v;
  const id = crypto.randomBytes(6).toString("hex");
  const ext = (display.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `requests/${row.ref}/${Date.now()}-${id}${ext ? "." + ext : ""}`;
  try { await (_storeForTest || storagePut)(path, buf, mime); }
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
    // A structural line the page added so the scope has a shape the customer can
    // review (no code, no price of its own). It rides along with a priced line
    // instead of holding the whole quotation back for a human.
    ...(it.seed === true && !str(it.code, 40) ? { seed: true } : {}),
  })).filter((it) => it.title);
}
// The documents we ask the customer for. Each service has its own list; the
// advisor emits it beside the scope and ops can edit it afterwards.
const DOC_STATES = ["requested", "received", "waived"];
// The contract is derived from the approved quotation — same scope, same
// figures — so approving the quote is enough to produce it. It used to wait
// for a human to press a button in /ops, which left the customer looking at
// «سيصلك العقد للتوقيع» with nothing arriving.
//
// `opts.at` pins the date printed on the paper, and `build` (stored with the
// contract) remembers the lead time / executor that were typed at issue. The
// customer's view rebuilds the paper from the live quotation to repair old
// totals — if the rebuild used today's date and no lead time, EVERY rebuild
// differed from what was issued, so a contract signed yesterday was flagged
// «corrected after your signature — sign again» the next time anyone opened it.
// A signature is a name of at least three letters and a drawing — both, always.
// It used to be accepted with a one-letter name and no drawing at all (the page
// only warned); the server now refuses, with a sentence the customer can act on.
const SIG_IMG_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]{60,}$/;
export function signatureProblem(name, image) {
  if ([...String(name || "").replace(/\s+/g, "")].length < 3) return { ok: false, error: "name_too_short", message: "اكتب اسمك الكامل (٣ أحرف على الأقل) في خانة الاسم." };
  if (typeof image !== "string" || !SIG_IMG_OK.test(image) || image.length > 250000) return { ok: false, error: "signature_required", message: "ارسم توقيعك في المربع قبل التوقيع." };
  return null;
}

function buildContract(row, opts = {}) {
  const at = opts.at && !Number.isNaN(Date.parse(opts.at)) ? new Date(opts.at) : new Date();
  const today = at.toLocaleDateString("ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });
  // The party's name is remembered too (D3): a signed paper must rebuild with
  // the name it was signed under, not whatever the client's profile says today —
  // otherwise filling in a real name would flag every signed contract «sign again».
  // Contracts issued before this was stored fall back to the old rule they were built by.
  const party = opts.party != null ? str(opts.party, 200) : opts.legacyName ? str(row.company_name || row.client_name || row.client_email, 200) : str(partyName(row), 200);
  // Template version (api/_bp-docs.js): absent / "v1" = the original paper, forever; only a document
  // issued with "v2" (and its company snapshot) is built with the new one. Rebuilds pass the stored value.
  // عقدٌ بلا بنود لا يصدر بأي قالب (v1 كان يسقط من تلقاء نفسه؛ v2 يجب ألا يطبع ورقة فارغة).
  if (!row.quote || !Array.isArray(row.quote.items) || !row.quote.items.length) throw new Error("no_items");
  // The stored version names a FROZEN template (api/_bp-docs.js → templateForVersion); never "the newest".
  const tpl = templateForVersion(opts.template_version);
  const build = { lead_time: str(opts.lead_time, 120), executor: str(opts.executor, 120), party, ...(tpl ? { template_version: tpl.version, company: opts.company || tpl.companySnapshot() } : {}) };
  const html = tpl ? tpl.contract({
    ref: row.ref, number: "C-" + row.ref.replace(/^BP-R-/, ""), clientName: party, service: row.title, items: row.quote.items,
    net: row.quote.net, vat: row.quote.vat, total: row.quote.total, vatRate: 15, leadTime: build.lead_time,
    executor: build.executor || "Business Partner", issuedAt: at.toISOString(), lang: row.lang || "ar", company: build.company,
  }) : contractHtml({
    ref: row.ref, clientName: party, service: row.title,
    lines: row.quote.items.map((l) => ({ name: l.title, nameEn: l.titleEn, qty: l.qty, price: l.price, line: l.line })),
    net: row.quote.net, vat: row.quote.vat, total: row.quote.total, vatRate: 15,
    leadTime: build.lead_time, executor: build.executor || "Business Partner", today,
    // لغة العميل تُطبع مقابل العربية — والعربية هي المرجع في نص العقد نفسه.
    lang: row.lang || "ar",
  });
  return {
    number: "C-" + row.ref.replace(/^BP-R-/, ""), status: "SENT", html, build, ...(tpl ? { template_version: tpl.version } : {}),
    created_at: at.toISOString(), sent_at: nowIso(), quote_number: row.quote.number,
    mode: SIMPLE_TEST_MODE ? "test-esign" : "portal-esign",
  };
}

// An approved quotation with no contract yet: either the paper failed to build
// when the customer approved, or it was approved in the days when a human had to
// press «إصدار العقد». The customer must not wait for that — whoever opens the
// request issues it. Claimed with a conditional PATCH so two screens opening the
// same request issue one contract, not two.
async function ensureContract(row) {
  if (!row || row.status !== "QUOTE_APPROVED" || !row.quote || row.quote.status !== "APPROVED" || row.contract) return row;
  let claimed = [];
  try { claimed = await sb(`requests?id=eq.${row.id}&status=eq.QUOTE_APPROVED`, { method: "PATCH", body: { status: "CONTRACT_SENT", updated_at: nowIso() } }); }
  catch { return row; }
  if (!claimed || !claimed[0]) return (await getByRef(row.ref)) || row;   // somebody else got there first
  try {
    const issued = await issueContract(row, "system", "النظام", {});
    return { ...row, status: issued.status, contract: issued.contract };
  } catch (e) {
    console.error("ensureContract", row.ref, String(e && e.message || e).slice(0, 140));
    try { await patchRequest(row.id, { status: "QUOTE_APPROVED" }); } catch {}
    return row;
  }
}

// ------------------------------------------------ the mutual NDA (optional) --
// api/_bp-docs-v2.js ndaDocV2 was built and never reachable. It is issued on a
// request by the team (ops-nda) or, for the SKUs listed in NDA_REQUIRED_SERVICES
// (empty by default: nobody's journey changes), automatically before the quotation.
// It is NOT a gate: a request without an NDA, or with an unsigned one, moves on
// exactly as before — whether to require it is the owner's decision.
//
// Same rules as the contract: the paper is printed once with a FROZEN template
// (build.template_version + the company snapshot of that day), stored whole in
// `requests.nda`, and signed by the customer in /my (name + drawing + explicit consent);
// the SHA-256 of the stored bytes goes into the signature. It is never rebuilt from
// "the newest template", so a later wording or design change cannot void a signature.
export const NDA_TEMPLATE = "v2";
export function ndaRequiredSkus() {
  return new Set(String(process.env.NDA_REQUIRED_SERVICES || "").split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean));
}
export function buildNda(row, opts = {}) {
  const at = opts.at && !Number.isNaN(Date.parse(opts.at)) ? new Date(opts.at) : new Date();
  const tpl = templateForVersion(opts.template_version || NDA_TEMPLATE);
  if (!tpl || typeof tpl.nda !== "function") throw new Error("no_nda_template");
  const lang = opts.lang || (row.lang === "en" ? "en" : "ar");          // the template is Arabic + English
  const party = opts.party != null ? str(opts.party, 200) : str(partyName(row), 200);
  const sig = opts.signatory && opts.signatory.name ? { name: str(opts.signatory.name, 120), title: str(opts.signatory.title, 120) } : null;
  const build = {
    template_version: tpl.version, company: opts.company || tpl.companySnapshot(), party, lang,
    clientRegNo: str(opts.clientRegNo, 60), clientAddress: str(opts.clientAddress, 200), clientCountry: str(opts.clientCountry, 80),
    signatory: sig, service: str(opts.service != null ? opts.service : row.title, 200),
  };
  const number = "NDA-" + row.ref.replace(/^BP-R-/, "");
  const html = tpl.nda({
    ref: row.ref, number, clientName: party, clientRegNo: build.clientRegNo, clientAddress: build.clientAddress, clientCountry: build.clientCountry,
    signatory: sig, service: build.service, issuedAt: at.toISOString(), lang, company: build.company,
  });
  return { number, status: "SENT", html, build, template_version: tpl.version, created_at: at.toISOString(), sent_at: nowIso(), mode: SIMPLE_TEST_MODE ? "test-esign" : "portal-esign" };
}
async function issueNda(row, actorKind, actor, opts = {}) {
  if (row.nda && row.nda.status === "SIGNED") return { ok: false, error: "nda_signed" };
  const nda = buildNda(row, opts);
  let upd;
  try { upd = await patchRequest(row.id, { nda }); }
  catch (e) { console.error("simple: nda not stored - apply db/migrations/2026-10-requests-nda.sql", String(e && e.message || e).slice(0, 80)); return { ok: false, error: "nda_unavailable" }; }
  await logEvent(row.id, actorKind, actor, "nda.sent", { number: nda.number, template: nda.template_version });
  await announce(row, "nda", {
    subject: `اتفاقية عدم إفصاح ${nda.number} بانتظار توقيعك`,
    clientLine: "أُرسلت إليك اتفاقية عدم الإفصاح المتبادلة للتوقيع الإلكتروني من حسابك. لا يتوقف طلبك عليها.",
    opsLine: `صدرت اتفاقية عدم الإفصاح ${nda.number} وأُرسلت للتوقيع.`,
    cta: "افتح الاتفاقية ووقّعها",
  });
  return { ok: true, nda, upd };
}
// Before the quotation, for the services the owner listed — and only those.
async function autoNda(row, scope) {
  try {
    const want = ndaRequiredSkus();
    if (!want.size || row.nda) return;
    if (!(scope || []).some((it) => !it.seed && it.code && want.has(String(it.code).toUpperCase()))) return;
    await issueNda(row, "system", "النظام");
  } catch (e) { console.error("auto nda", String(e && e.message || e).slice(0, 100)); }
}

async function issueContract(row, actorKind, actor, opts) {
  const contract = buildContract(row, { ...opts, template_version: templateForLang(row.lang) });
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
  const priced = await priceItems(rawItems, { catalogueText: actorKind === "system" });
  // لا سطر بسعر صفر في عرضٍ صادر. «computeQuote» يُسقط السعر الناقص إلى صفر،
  // وكان «ops-quote» بلا بنودٍ مكتوبة (أو ببندٍ لا سعر له في الكتالوج: «خدمة حسب
  // الطلب»، نسبة، باقة) يُصدر ويُرسل عرضاً إجماليه «٠ ر.س» إلى العميل. السعر يأتي
  // من الكتالوج بالرمز أو من إنسانٍ يكتبه — وبعدها يصدر العرض، لا قبلها.
  const unpricedLines = priced.filter((l) => !(num(l.price) > 0));
  if (unpricedLines.length) {
    const titles = unpricedLines.map((l) => l.title || l.code || "—");
    return { ok: false, error: "unpriced_items", unpriced: titles,
      message: `لا يصدر عرض سعر ببند بلا سعر: ${titles.join(" · ")}. اكتب سعراً أكبر من صفر لكل بند، أو اختره بالرمز من الكتالوج.` };
  }
  // سعر الكتالوج لبندٍ ليس «السعر»: اشتراكٌ شهري أو حدٌّ أدنى «يبدأ من». كان يدخل
  // الإجمالي كأنه سعرٌ ثابت لدفعة واحدة، صامتاً، حين يضغط الفريق «توليد وإرسال» — فيرى
  // العميل «2,500 ر.س» بلا «شهرياً». الإنسان يؤكّد صراحةً (confirm_prices) أو يكتب سعراً
  // آخر بيده؛ وبعد التأكيد يُكتب نوع السعر في وصف السطر فيُطبع في العرض والعقد.
  if (actorKind === "human") {
    const catalogueLines = priced.filter((l) => num(l.price) > 0 && !AUTO_PRICE_MODELS.has(String(l.model || "")) && num(l.catPrice) > 0 && num(l.price) === num(l.catPrice));
    if (catalogueLines.length && opts.confirm_prices !== true) {
      const lines = catalogueLines.map((l) => { const reason = pricingReason(l); return { title: l.title, code: l.code || "", price: l.price, reason, reason_ar: HOLD_AR[reason] }; });
      return { ok: false, error: "needs_confirmation", lines,
        message: `بنود سعرها من الكتالوج ليس سعراً نهائياً لدفعة واحدة:\n${lines.map((x) => `• ${x.title} — ${x.price} ر.س: ${x.reason_ar}`).join("\n")}\nأكّد لإصدار العرض بهذا السعر مع كتابة نوعه في السطر، أو غيّر السعر.` };
    }
    for (const l of catalogueLines) {
      const tag = pricingReason(l) === "recurring" ? "السعر شهري (اشتراك دوري) لا دفعة واحدة" : pricingReason(l) === "from" ? "حدّ أدنى «يبدأ من» — السعر النهائي بحسب الحالة" : "";
      if (tag && !String(l.description || "").includes(tag)) l.description = (l.description ? l.description + " — " : "") + tag;
    }
  }
  const quote = { number: "Q-" + row.ref.replace(/^BP-R-/, "") + (row.quote && row.quote.status === "REJECTED" ? "-R" : ""), status: "DRAFT", created_at: nowIso(), template_version: templateForLang(row.lang), ...computeQuote(priced, opts) };
  if (!quote.items.length) return { ok: false, error: "no_items" };
  // What the customer typed beside catalogue lines: kept apart, short, and printed
  // as «ملاحظات العميل» — never as a line of the quotation or the contract.
  const cn = priced.map((l) => l.clientNote).filter(Boolean).join(" · ").slice(0, 500);
  if (cn) quote.client_notes = cn;
  const send = opts.send !== false;
  if (send) { quote.status = "SENT"; quote.sent_at = nowIso(); }
  // Lines no catalogue price can settle ride with the quotation as `pending_items`: they are NOT in
  // its items, its total or the contract. They wait for a person, with the reason, and are priced as
  // an addendum (ops-quote-addendum) — the approved quotation is never edited.
  const pending = (Array.isArray(opts.pending) ? opts.pending : []).slice(0, 30).map((h) => ({
    title: str(h.title, 200), code: str(h.code, 40), qty: Math.max(1, Math.min(99, Math.round(num(h.qty) || 1))), reason: str(h.reason, 30), reason_ar: str(h.reason_ar || HOLD_AR[h.reason], 200),
  })).filter((h) => h.title);
  if (pending.length) quote.pending_items = pending;
  const scopeAfter = [
    ...quote.items.map((l) => ({ code: l.code, title: l.title, why: l.description, qty: l.qty })),
    ...pending.map((h) => ({ code: h.code, title: h.title, why: "", qty: h.qty, hold: { reason: h.reason, reason_ar: h.reason_ar } })),
  ];
  const upd = await patchRequest(row.id, { quote, scope: scopeAfter, status: send ? "QUOTE_SENT" : row.status });
  await logEvent(row.id, actorKind, actor, send ? "quote.sent" : "quote.drafted", { number: quote.number, total: quote.total });
  // The quotation is out, so the «price this scope» task is done — whoever issued it.
  if (send && !pending.length) { try { await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&status=in.(open,in_progress,blocked)`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: nowIso() } }); } catch { /* a task left open is only noise */ } }
  if (send && pending.length) {
    await pricingTask(row, pending);
    await logEvent(row.id, "system", "النظام", "quote.pending", { unpriced: pending.map((h) => h.title), holds: pending, partial: true });
  }
  if (send) await announce(row, "quote", {
    subject: `عرض سعر ${quote.number} — ${row.title}`,
    clientLine: `عرض سعرك جاهز: ${quote.total} ر.س شامل ضريبة القيمة المضافة. راجعه واعتمده من حسابك.${pending.length ? ` وبنود بانتظار التسعير (يصلك لها عرض ملحق): ${holdsLine(pending)}.` : ""}`,
    opsLine: `صدر عرض السعر ${quote.number} بإجمالي ${quote.total} ر.س.${pending.length ? ` بنود لا تدخله وتنتظر تسعيرك: ${holdsLine(pending)}` : ""}`,
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

// The default «الدفع مقدماً بعد توقيع العقد» is stored as written; a client who reads English, French
// or Chinese was shown it in Arabic. It is localised wherever it is shown, never in what was stored.
const PAY_TERMS_DEFAULT = {
  ar: "الدفع مقدماً بعد توقيع العقد", en: "Payment in advance after the contract is signed",
  fr: "Paiement d'avance après la signature du contrat", zh: "合同签署后预付款",
};
export const localTerms = (q, lang) => (q && q.payment_terms === PAY_TERMS_DEFAULT.ar && PAY_TERMS_DEFAULT[lang] ? PAY_TERMS_DEFAULT[lang] : (q && q.payment_terms) || "");
const quoteNotes = (q) => [q.notes,
  Array.isArray(q.pending_items) && q.pending_items.length ? `بنود بانتظار التسعير (يصلك لها عرض ملحق ولا تدخل هذا العرض ولا العقد): ${q.pending_items.map((x) => `${x.title} (${x.reason_ar})`).join(" · ")}` : "", q.client_notes ? `ملاحظات العميل (للعلم، وليست بنداً تعاقدياً): ${q.client_notes}` : ""].filter(Boolean).join(" | ");
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
    payment_terms: str(opts.payment_terms, 600) || PAY_TERMS_DEFAULT.ar,
    notes: str(opts.notes, 1500),
  };
}

// A quotation that is still standing (sent, approved, signed, paid) fixes the
// scope. The status alone is not enough to know that: operations can move a
// paid request to WAITING_CLIENT («بانتظار ردك») to ask for a document, and the
// scope editor used to re-open with it — a customer could then re-confirm the
// scope, drop the request back to REVIEWING and overwrite the scope of a signed
// contract. Only a REJECTED quotation (the customer asked for changes) or an
// unsent DRAFT leaves it open.
export function scopeLockedByQuote(row) {
  return !!(row.quote && !["REJECTED", "DRAFT"].includes(row.quote.status));
}

// ------------------------------------------------- stages & team updates --
// A request can carry a progress line the team moves by hand (`stages`) and a
// written log of dated updates (`updates`). Both live on the request row like
// `quote` and `contract` (jsonb, db/migrations/2026-10-request-stages.sql), and
// a request that has neither looks exactly as it did before: nothing here is
// drawn, sent or returned to a customer who has no stages.
//
//   stages  [{key, title_ar, title_en?, status: pending|active|done, at, note}]
//   updates [{id, at, by, text_ar, text_en?, published, published_at}]
//
// An update is a draft until the team presses «publish». A draft is never part
// of what a customer is sent (clientView below filters it out), and publishing
// is the one human action that also tells them. Every change is recorded in
// the internal event log, which the customer's timeline never shows.
export const STAGE_STATUSES = ["pending", "active", "done"];
export const STAGE_TEMPLATES = {
  // The sales client's road (owner, 2026-10-21): editable per request afterwards.
  sales: [
    { key: "sign_quote", title_ar: "توقيع العرض", title_en: "Quote signed" },
    { key: "first_payment", title_ar: "الدفعة الأولى", title_en: "First payment" },
    { key: "investment_license", title_ar: "ترخيص الاستثمار", title_en: "Investment license" },
    { key: "commercial_register", title_ar: "السجل التجاري", title_en: "Commercial registration" },
    { key: "secondary_licenses", title_ar: "التراخيص الثانوية", title_en: "Secondary licenses" },
  ],
};
const MAX_STAGES = 12;
const MAX_UPDATES = 200;
const stageKey = (v) => String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export function normStages(list) {
  const seen = new Set();
  const out = [];
  for (const it of (Array.isArray(list) ? list : []).slice(0, MAX_STAGES)) {
    if (!it || typeof it !== "object") continue;
    const key = stageKey(it.key);
    const title_ar = str(it.title_ar, 120);
    if (!key || !title_ar || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key, title_ar, title_en: str(it.title_en, 120),
      status: STAGE_STATUSES.includes(it.status) ? it.status : "pending",
      at: str(it.at, 40), note: str(it.note, 300),
    });
  }
  return out;
}

// The first two steps of the sales road are facts the platform already knows:
// the contract was signed, the payment arrived. They are filled from those
// events (and never taken back), so the team only moves what is theirs. When
// that leaves nothing in progress, the next pending stage becomes the active
// one: work starts after payment, and a line with no active step looks stalled.
export function autoStages(row, over = {}) {
  const cur = Array.isArray(row && row.stages) ? row.stages : [];
  if (!cur.length) return null;
  const contract = over.contract || row.contract;
  const payment = over.payment || row.payment;
  const stages = cur.map((x) => ({ ...x }));
  let changed = false;
  const fill = (key, at) => {
    const st = stages.find((x) => x.key === key);
    if (st && st.status !== "done") { st.status = "done"; st.at = str(at, 40) || nowIso(); changed = true; }
  };
  if (contract && (contract.status === "SIGNED" || contract.signed_at)) fill("sign_quote", contract.signed_at);
  if (payment && payment.status === "PAID") fill("first_payment", payment.at);
  if (changed && !stages.some((x) => x.status === "active")) {
    const next = stages.find((x) => x.status === "pending");
    if (next) { next.status = "active"; next.at = nowIso(); }
  }
  return changed ? { stages } : null;
}

// What a customer is allowed to see. Stages as they are; updates only once
// published, newest first, without who wrote them or any draft flag.
function publicStages(row) {
  return Array.isArray(row.stages) ? normStages(row.stages) : [];
}
function publicUpdates(row) {
  return (Array.isArray(row.updates) ? row.updates : [])
    .filter((u) => u && u.published === true && (u.text_ar || u.text_en))
    .map((u) => ({ id: str(u.id, 40), at: str(u.published_at || u.at, 40), text_ar: str(u.text_ar, 2000), text_en: str(u.text_en, 2000) }))
    .sort((a, c) => (a.at < c.at ? 1 : -1));
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
        // PANEL_REQUIRE_NAFATH closes the owner's session door (owner decision
        // 2026-10-16: the owner's panel opens with Nafath only). A session proves a
        // mailbox, not a person standing at the phone. The sales role is a
        // different, narrower door (see above) and is the only thing a session may
        // still open while Nafath is required.
        const nafathOnly = panelRequiresNafath();
        const salesOn = salesTeamEmails().length > 0;
        if (nafathOnly && !salesOn) return json(res, 401, { ok: false, error: "unauthorized", nafath: true, signin: `${SELF_BASE}/ar/ops` });
        const sess = await getSession(req);
        const mail = sess && sess.user && sess.user.email;
        if (!nafathOnly && isOwnerEmail(mail)) {
          opsUser = { email: String(mail).toLowerCase(), name: sess.user.full_name || "" };
        } else if (salesOn && isSalesEmail(mail)) {
          opsUser = { email: String(mail).trim().toLowerCase(), name: sess.user.full_name || "", role: "sales" };
        } else if (nafathOnly) {
          return json(res, 401, { ok: false, error: "unauthorized", nafath: true, signin: `${SELF_BASE}/ar/ops` });
        } else {
          return json(res, 401, { ok: false, error: "unauthorized", signin: `${SELF_BASE}/ar/my` });
        }
      }
      return opsAction(action, body, qs, req, res, opsUser);
    }
    // مركز التواصل (ودجت الدعم): التتبّع والتذكرة يعملان بلا جلسة أيضاً —
    // الزائر الذي لم يدخل بعد هو أكثر من يحتاجهما. الجلسة إن وُجدت ترفع
    // ما يراه؛ وبلا جلسة لا يخرج شيء إلا بمرجعٍ + بريدٍ مطابقين (supportAction).
    if (action === "support-track" || action === "support-ticket-create") {
      let supportSess = null;
      try { supportSess = await getSession(req); } catch { supportSess = null; }
      return supportAction(action, body, qs, req, res, supportSess);
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

  // A first Nafath sign-in opens an account under a placeholder address; until
  // the client gives a real e-mail and mobile (api/otp.js nafath-contact-*), the
  // account may look at itself but not act — a request, a quote or an invoice
  // written against an address nobody can read is a request nobody can answer.
  const contactPending = isNafathPlaceholderEmail(email);
  if (contactPending && action !== "me") {
    return json(res, 403, { ok: false, error: "contact_required", message: "أكمل بريدك وجوالك أولاً لنتمكن من خدمتك." });
  }

  if (action === "me") {
    if (contactPending) {
      return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, user: { name: sess.user.full_name || "", email: "", contactPending: true }, organization: sess.organization, counts: {}, requests: [] });
    }
    // Claim requests created for this e-mail before the client registered.
    if (orgId) { try { await sb(`requests?client_email=eq.${q(email)}&organization_id=is.null`, { method: "PATCH", prefer: "return=minimal", body: { organization_id: orgId, user_id: sess.user.id } }); } catch {} }
    const mine = await myRequests(sess);
    const counts = {
      active: mine.filter((r) => !isTicketRow(r) && !["COMPLETED", "CANCELLED"].includes(r.status)).length,
      quotes: mine.filter((r) => r.status === "QUOTE_SENT").length,
      contracts: mine.filter((r) => r.status === "CONTRACT_SENT").length,
      payments: mine.filter((r) => ["SIGNED", "PAYMENT_PENDING"].includes(r.status) && !bankUnderReview(r)).length,
      appointments: new Set(mine.filter((r) => r.status !== "CANCELLED" && r.appointment && r.appointment.status !== "CANCELLED" && r.appointment.date >= nowIso().slice(0, 10)).map((r) => r.appointment.date + " " + r.appointment.time)).size,
    };
    // The address prefix is not the client's name (D3): /my asks for the real
    // name and mobile once, and the answer fills every open request below.
    const prof = await profileOf(sess);
    return json(res, 200, {
      ok: true, testMode: SIMPLE_TEST_MODE,
      user: { name: prof.name, email, phone: prof.phone, needsName: prof.needsName, needsPhone: prof.needsPhone, needsProfile: prof.needsName || prof.needsPhone },
      organization: sess.organization, counts, requests: mine.map(summary),
    });
  }

  // Name and mobile, asked once (D3). The mobile goes through the same
  // normaliser as the Nafath contact step, so a number is either a real Saudi
  // (or international) mobile or it is refused; nothing here weakens sign-in —
  // the account was already proven by its own door, this only says who it is.
  // The answer replaces the placeholder name on the user, the organisation and
  // every open request, so the quotation, the contract, the invoice and /ops
  // all carry the same person from now on. A request whose contract is already
  // signed or paid is left exactly as signed.
  if (action === "profile-set") {
    const name = cleanFullName(b.name);
    if (!fullNameOk(name)) return json(res, 400, { ok: false, error: "invalid_name" });
    const ph = normalizePhone(b.phone);
    if (!ph.ok) return json(res, 400, { ok: false, error: "invalid_phone", reason: ph.reason });
    await sb(`users?id=eq.${q(sess.user.id)}`, { method: "PATCH", prefer: "return=minimal", body: { full_name: name, phone: ph.value } });
    if (orgId && isPlaceholderName(sess.organization?.name_ar, email)) {
      try { await sb(`organizations?id=eq.${q(orgId)}`, { method: "PATCH", prefer: "return=minimal", body: { name_ar: name } }); } catch (e) { console.error("profile org", String(e.message || e).slice(0, 120)); }
    }
    let updated = 0;
    try {
      const mine = await myRequests(sess);
      for (const r of mine) {
        if (["CANCELLED", "COMPLETED"].includes(r.status) || (r.contract && r.contract.status === "SIGNED") || moneyReceived(r)) continue;
        const patch = {};
        if (isPlaceholderName(r.client_name, r.client_email)) patch.client_name = name;
        if (!str(r.client_phone, 40)) patch.client_phone = ph.value;
        if (isPlaceholderName(r.company_name, r.client_email)) patch.company_name = name;
        if (!Object.keys(patch).length) continue;
        await patchRequest(r.id, patch);
        updated++;
      }
    } catch (e) { console.error("profile requests", String(e.message || e).slice(0, 120)); }
    // The request that asked for a quotation from the chat was waiting only for
    // this name and mobile: issue it now (see request-create).
    let quoted = 0;
    try { quoted = await issueWaitingQuotes(sess); } catch (e) { console.error("profile auto quote", String(e && e.message || e).slice(0, 120)); }
    await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "simple.profile.set", entity: "users", entity_id: sess.user.id, meta: { requests: updated } });
    return json(res, 200, { ok: true, user: { name, email, phone: ph.value, needsName: false, needsPhone: false, needsProfile: false }, updated, quoted });
  }

  if (action === "requests") {
    const mine = await myRequests(sess);
    return json(res, 200, { ok: true, requests: mine.map(summary) });
  }

  if (action === "request-create") {
    const type = REQUEST_TYPES.includes(b.type) ? b.type : "CONSULTATION";
    const source = REQUEST_SOURCES.includes(b.source) ? b.source : "WEBSITE";
    const conversation = normConversation(b.conversation);
    const scope = await resolveScope(normScope(b.scope));
    const ref = newRef();
    // The person's own name and mobile (D3): what the form sent, else what the
    // account holds. The address prefix is never used as either.
    const prof = await profileOf(sess);
    const typed = cleanFullName(b.name);
    const cName = !isPlaceholderName(typed, email) ? typed : prof.name;
    const typedPhone = normalizePhone(b.phone);
    const cPhone = typedPhone.ok ? typedPhone.value : (prof.phone || str(b.phone, 40));
    const orgName = str(sess.organization?.name_ar || sess.organization?.name_en, 200);
    const row = {
      ref, organization_id: orgId, user_id: sess.user.id, type, source, status: "NEW",
      lang: ["ar", "en", "fr", "zh"].includes(b.lang) ? b.lang : "ar",
      title: str(b.title, 200) || defaultTitle(type, b.lang),
      summary: str(b.summary, 2000),
      conversation, scope, documents: normDocuments(b.documents),
      client_name: cName, client_email: email, client_phone: cPhone,
      company_name: str(b.company, 200) || (orgName && !isPlaceholderName(orgName, email) ? orgName : cName),
    };
    const rows = await sb("requests", { method: "POST", body: [row] });
    const created = rows[0];
    const wantsQuote = b.auto_quote === true;
    await logEvent(created.id, "customer", who, "request.created", { type, source, items: scope.length, ...(wantsQuote ? { auto_quote: true } : {}) });
    if (scope.length) await logEvent(created.id, "ai", "المستشار الذكي", "scope.proposed", { items: scope.map((s) => s.title) });
    if (row.documents.length) await logEvent(created.id, "ai", "المستشار الذكي", "documents.requested", { documents: row.documents.map((d) => d.title) });
    await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "simple.request.create", entity: "requests", entity_id: created.id, meta: { ref } });
    await sendEmail(OWNER_EMAIL, `طلب جديد ${ref} — ${row.title}`, `<p>${esc(row.client_name)} · ${esc(email)}</p><p>${esc(row.summary)}</p><p><a href="${SELF_BASE}/ops?ref=${ref}">فتح الطلب</a></p>`);
    // «إنشاء عرض سعر» من المحادثة: العميل راجع البنود بنفسه قبل أن يضغط، فإن كان
    // اسمه وجواله على الطلب وكل بند مسعَّر في الكتالوج صدر العرض قبل أن يصل إلى
    // لوحته. ناقصُ الاسم أو الجوال يُكمله في اللوحة (profile-set يُصدره بعدها).
    // وبندٌ لا يسعّره الكتالوج يذهب إلى الفريق فوراً ويُكتب بجانبه سبب الانتظار.
    if (wantsQuote && scope.some((it) => !it.seed) && fullNameOk(row.client_name) && str(row.client_phone, 40)) {
      try {
        await logEvent(created.id, "customer", who, "scope.confirmed", { items: scope.map((s) => s.title), auto: true });
        await quoteOrHold(created, scope);
      } catch (e) { console.error("auto quote at create", String(e && e.message || e).slice(0, 120)); }
    }
    const fresh = (await getByRef(ref)) || created;
    return json(res, 200, { ok: true, ref, request: clientView(fresh, [], []), ...(fresh.quote ? { quote_issued: true } : {}) });
  }

  // Everything below is about one request the client owns.
  const ref = str(b.ref || qs.ref, 40);
  if (!ref) return json(res, 400, { ok: false, error: "missing_ref" });
  const row = await getByRef(ref);
  if (!row || !ownedBy(row, sess) || row.deleted_at) return json(res, 404, { ok: false, error: "not_found" });

  if (action === "request-get") {
    const healed = await ensureContract(row);
    const [events, tasks] = await Promise.all([eventsFor(row.id), tasksFor(row.id)]);
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, request: clientView(healed, events, tasks) });
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
    if (!["NEW", "REVIEWING", "WAITING_CLIENT"].includes(row.status) || scopeLockedByQuote(row)) return json(res, 409, { ok: false, error: "scope_locked", message: "النطاق مقفل بعد إصدار عرض السعر." });
    const scope = await resolveScope(normScope(b.scope));
    await patchRequest(row.id, { scope });
    await logEvent(row.id, "customer", who, "scope.edited", { items: scope.map((s) => s.title) });
    return json(res, 200, { ok: true, scope });
  }

  // Saving the scope used to end the journey: the customer pressed a button,
  // read «تم الحفظ» and nothing else happened until someone in operations
  // noticed. Confirming the scope now hands the request on — and when the
  // catalogue prices every line the quotation is issued on the spot (below);
  // only a line the catalogue cannot price waits for a person, with the reason
  // printed beside it.
  if (action === "scope-confirm") {
    if (isCartRow(row)) return json(res, 409, { ok: false, error: "scope_locked", message: "طلب الشراء المباشر مدفوع مسبقاً — لا عرض سعر له." });
    if (!["NEW", "REVIEWING", "WAITING_CLIENT"].includes(row.status) || scopeLockedByQuote(row)) return json(res, 409, { ok: false, error: "scope_locked", message: "النطاق مقفل بعد إصدار عرض السعر." });
    const scope = await resolveScope(normScope(b.scope && b.scope.length ? b.scope : row.scope));
    if (!scope.length) return json(res, 400, { ok: false, error: "no_items", message: "أضف بنداً واحداً على الأقل إلى نطاق الخدمات." });
    // The quotation, the contract and the invoice carry this person's name, and
    // the team replies to this mobile (D3): neither is a guess from the address.
    const prof = await profileOf(sess);
    if (prof.needsName || (!prof.phone && !str(row.client_phone, 40))) {
      return json(res, 409, { ok: false, error: "profile_required", message: "أكمل اسمك الكامل ورقم جوالك أولاً — يظهران في عرض السعر والعقد والفاتورة." });
    }
    // Carry them onto this request now, so the paper issued next is already right.
    const carry = {};
    if (isPlaceholderName(row.client_name, row.client_email) && prof.name) carry.client_name = prof.name;
    if (!str(row.client_phone, 40) && prof.phone) carry.client_phone = prof.phone;
    if (isPlaceholderName(row.company_name, row.client_email) && prof.name) carry.company_name = prof.name;
    if (Object.keys(carry).length) { await patchRequest(row.id, carry); Object.assign(row, carry); }
    await patchRequest(row.id, { scope });
    await logEvent(row.id, "customer", who, "scope.confirmed", { items: scope.map((it) => it.title) });

    // Lines flagged `seed` are filler: with at least one real line beside them
    // they do not block (and are not printed on) the quotation.
    //
    // كل بند له سعر في الكتالوج ⇒ عرض السعر يصدر فوراً. الكتالوج هو القرار
    // الذي اتُّخذ مسبقاً؛ إعادة اتخاذه يدوياً في كل طلب تأخيرٌ بلا حكم مضاف،
    // والعميل ينتظره ساعات.
    //
    // وبندٌ واحد بلا سعر يُعيد الطلب إلى اللوحة كما كان: السعر يأتي من الرمز
    // في الكتالوج أو من إنسان، ولا يُخترع بينهما. هذا هو الشرط الذي جعل
    // الأتمتة ممكنة — «طالما في كاتالوج للأسعار والعروض واضحة». لكنّ الانتظار
    // لا يبقى صامتاً: البند وسببه يُكتبان بجانبه فيراهما العميل واللوحة.
    const out = await quoteOrHold(row, scope);
    if (out.issued) return json(res, 200, { ok: true, stage: "QUOTE", status: out.status, scope, quote: out.quote, auto: true });
    return json(res, 200, { ok: true, stage: "PRICING", status: out.upd.status, scope: out.upd.scope || scope, unpriced: out.holds.map((h) => h.title), holds: out.holds });
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

    const got = await readTransferReceipt(base64, mime);
    const read = got.ok ? got.read : null, provider = got.provider || "";

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
    // D4: a request to change the quotation says what to change — one line is
    // enough, but silence gives the team nothing to act on.
    if (!approve && str(b.note, 500).length < 3) return json(res, 400, { ok: false, error: "note_required" });
    // «صالح حتى …» is printed on the quotation; accepting it after that date
    // would bind us to a price the quotation itself says has lapsed. Declining
    // an expired quote stays open. The team renews it from /ops (ops-quote).
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
    if (approve && /^\d{4}-\d{2}-\d{2}$/.test(String(row.quote.valid_until || "")) && row.quote.valid_until < today) {
      return json(res, 409, { ok: false, error: "quote_expired", message: "انتهت صلاحية عرض السعر هذا. اكتب لنا من داخل الطلب ليُجدَّد لك بسعر اليوم.", valid_until: row.quote.valid_until });
    }
    const quote = { ...row.quote, status: approve ? "APPROVED" : "REJECTED", decided_at: nowIso(), decision_note: str(b.note, 500) };
    // «طلب تعديل» hands the ball to the TEAM. It used to set «بانتظار ردك»
    // (waiting for the customer) — the opposite of the truth — and the note the
    // customer typed went to one mailbox and nowhere else: not into the
    // conversation, not onto a task. Now it is a message in the request, the
    // status says the team is reviewing, and the team is alerted like any
    // other customer message.
    const patch = { quote, status: approve ? "QUOTE_APPROVED" : "REVIEWING" };
    if (!approve) patch.conversation = normConversation([...(row.conversation || []), { role: "user", content: `طلب تعديل على عرض السعر ${quote.number}${quote.decision_note ? ": " + quote.decision_note : "."}`, at: nowIso() }]);
    const upd = await patchRequest(row.id, patch);
    await logEvent(row.id, "customer", who, approve ? "quote.approved" : "quote.rejected", { number: quote.number, note: quote.decision_note });
    if (approve) await sendEmail(OWNER_EMAIL, `اعتماد عرض السعر ${quote.number} (${ref})`, `<p>${esc(who)}: ${esc(quote.decision_note || "")}</p>`);
    else await alertOps({ ...row, ...upd }, "quote-rejected", {
      subject: `العميل طلب تعديل عرض السعر ${quote.number} — ${row.ref}`,
      line: `${row.client_name || who} لم يعتمد العرض ${quote.number} (${quote.total} ر.س)${quote.decision_note ? ": " + quote.decision_note.slice(0, 220) : "."}`,
      windowMin: 1,
      task: { source: "reply.customer", urgency: "high", title: `عدّل عرض السعر أو ردّ على العميل — ${row.ref}`, details: quote.decision_note || "" },
    });
    if (approve) {
      // No waiting on a human: the approved quotation already contains
      // everything the contract states.
      const after = await ensureContract({ ...upd, quote });
      if (after.contract) return json(res, 200, { ok: true, status: after.status, quote, contract: { ...after.contract, html: undefined } });
      // The paper could not be built right now. The approval stands; the contract
      // is retried the next time the customer (or the panel) opens the request,
      // and the team is told — nobody has to press anything for it to continue.
      await alertOps({ ...row, ...upd }, "contract-failed", {
        subject: `العقد لم يصدر آلياً — ${row.ref}`,
        line: `اعتمد ${row.client_name || who} عرض السعر ${quote.number} لكن تعذّر إصدار العقد آلياً. يُعاد الإصدار تلقائياً عند فتح الطلب؛ وإن بقي معلّقاً فأصدره من اللوحة (ops-contract).`,
        windowMin: 1,
        task: { source: "contract.issue", urgency: "high", title: `العقد لم يصدر آلياً — ${row.ref}`, details: `عرض السعر ${quote.number} معتمد ولا عقد له بعد.` },
      });
      return json(res, 200, { ok: true, status: after.status, quote, contract_pending: true });
    }
    return json(res, 200, { ok: true, status: upd.status, quote });
  }

  // The addendum to an approved quotation (lines that had no fixed price): its own number,
  // total and validity. Approving it records the customer's consent and tells the team; the
  // approved quotation, its contract and its payment are never touched.
  if (action === "quote-addendum-approve" || action === "quote-addendum-reject") {
    const approve = action === "quote-addendum-approve";
    const list = row.quote && Array.isArray(row.quote.addenda) ? row.quote.addenda : [];
    const i = list.findIndex((a) => a.number === str(b.number, 60));
    if (i < 0 || list[i].status !== "SENT") return json(res, 409, { ok: false, error: "no_open_addendum" });
    if (!approve && str(b.note, 500).length < 3) return json(res, 400, { ok: false, error: "note_required" });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
    if (approve && /^\d{4}-\d{2}-\d{2}$/.test(String(list[i].valid_until || "")) && list[i].valid_until < today) {
      return json(res, 409, { ok: false, error: "quote_expired", message: "انتهت صلاحية هذا الملحق. اكتب لنا من داخل الطلب ليُجدَّد.", valid_until: list[i].valid_until });
    }
    const addenda = list.map((a, k) => (k === i ? { ...a, status: approve ? "APPROVED" : "REJECTED", decided_at: nowIso(), decision_note: str(b.note, 500) } : a));
    await patchRequest(row.id, { quote: { ...row.quote, addenda } });
    await logEvent(row.id, "customer", who, approve ? "addendum.approved" : "addendum.rejected", { number: list[i].number, total: list[i].total });
    await alertOps({ ...row }, approve ? "addendum-approved" : "addendum-rejected", {
      subject: `${approve ? "اعتُمد" : "رُفض"} ملحق عرض السعر ${list[i].number} — ${row.ref}`,
      line: `${row.client_name || who} ${approve ? "اعتمد" : "لم يعتمد"} الملحق ${list[i].number} (${list[i].total} ر.س شامل الضريبة)${approve ? "" : ": " + str(b.note, 220)}.`,
      windowMin: 1,
      task: { source: "quote.addendum", urgency: "high", title: approve ? `ملحق معتمد — أصدر ملحق العقد وحصّل المبلغ الإضافي — ${row.ref}` : `العميل لم يعتمد ملحق العرض — ${row.ref}`, details: approve ? `الملحق ${list[i].number} بإجمالي ${list[i].total} ر.س معتمد. العقد والدفع والفاتورة الأصلية لم تتغير: أصدر ملحق العقد وحصّل المبلغ الإضافي وفاتورته.` : (str(b.note, 500)) },
    });
    return json(res, 200, { ok: true, addendum: addenda[i] });
  }

  // العرض كمستند كامل بلغتين — نفس ورقة العقد، تُفتح بالحجم الكامل وتُطبع.
  if (action === "quote-view") {
    if (!row.quote) return json(res, 404, { ok: false, error: "no_quote" });
    const qtpl = templateForVersion(row.quote.template_version);
    if (qtpl) return json(res, 200, { ok: true, number: row.quote.number, html: qtpl.quote({
      ref: row.ref, number: row.quote.number, clientName: partyName(row), service: row.title, items: row.quote.items || [],
      net: row.quote.net, vat: row.quote.vat, total: row.quote.total, issuedAt: row.quote.created_at, validUntil: row.quote.valid_until || "",
      paymentTerms: localTerms(row.quote, row.lang), notes: quoteNotes(row.quote), documents: row.documents, lang: row.lang || "ar",
    }) });
    const html = quoteHtml({
      ref: row.ref, number: row.quote.number,
      clientName: partyName(row),
      items: row.quote.items || [], net: row.quote.net, vat: row.quote.vat, total: row.quote.total,
      validUntil: row.quote.valid_until || "", paymentTerms: localTerms(row.quote, row.lang),
      notes: quoteNotes(row.quote), lang: row.lang || "ar",
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
    // A signed contract issued before `build` was stored cannot be rebuilt
    // faithfully (its lead time is unknown), so a difference would prove
    // nothing — leave the signed paper alone rather than ask for a new signature.
    const rebuildable = !row.contract.signature || !!row.contract.build;
    if (rebuildable && row.quote && Array.isArray(row.quote.items) && row.quote.items.length) {
      try {
        // Same inputs as at issue: the date it was issued and the lead time /
        // executor typed then. Anything else rebuilds a different paper.
        const b0 = row.contract.build || {};
        const signedNow = !!row.contract.signature;
        const rebuilt = buildContract(row, signedNow
          ? { ...b0, at: row.contract.created_at, legacyName: b0.party == null, template_version: b0.template_version || "v1" }
          : { lead_time: b0.lead_time, executor: b0.executor, at: row.contract.created_at, template_version: b0.template_version || "v1", company: b0.company });
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
    // D1: the stored paper (and its SHA-256) never changes; only what is shown
    // is turned into a page a person can read — no DocuSign tags, and after
    // signing the signer's name, date, drawing and short fingerprint.
    return json(res, 200, { ok: true, html: portalContractHtml(html, { signature: contract.signature, signedAt: contract.signed_at, stale: !!contract.needs_resign }), needsResign: !!contract.needs_resign, contract: { ...contract, html: undefined, html_signed: undefined } });
  }

  // The NDA: shown as it was printed (the stored bytes, never rebuilt), signed once.
  if (action === "nda-view") {
    if (!row.nda || !row.nda.html) return json(res, 404, { ok: false, error: "no_nda" });
    return json(res, 200, { ok: true, html: portalContractHtml(row.nda.html, { signature: row.nda.signature, signedAt: row.nda.signed_at }), nda: { ...row.nda, html: undefined } });
  }
  if (action === "nda-sign") {
    if (!row.nda || !row.nda.html) return json(res, 409, { ok: false, error: "no_open_nda" });
    if (row.nda.status === "SIGNED") return json(res, 409, { ok: false, error: "already_signed" });
    if (row.status === "CANCELLED") return json(res, 409, { ok: false, error: "request_closed" });
    if (!b.consent) return json(res, 400, { ok: false, error: "consent_required", message: "يلزم الموافقة على التوقيع الإلكتروني." });
    const signerName = str(b.name, 160) || who;
    const bad = signatureProblem(signerName, b.signature);
    if (bad) return json(res, 400, bad);
    const hash = crypto.createHash("sha256").update(String(row.nda.html)).digest("hex");
    const signature = {
      name: signerName, email, ip: clientIp(req), ua: str(req.headers["user-agent"], 200), at: nowIso(),
      doc_sha256: hash, template_version: row.nda.template_version || (row.nda.build && row.nda.build.template_version) || NDA_TEMPLATE,
      image: typeof b.signature === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.signature) && b.signature.length <= 250000 ? b.signature : null,
      mode: SIMPLE_TEST_MODE ? "test-esign" : "portal-esign",
    };
    const nda = { ...row.nda, status: "SIGNED", signed_at: signature.at, signature };
    // conditional on the row not having moved: two screens signing at once record one signature
    const won = await sb(`requests?id=eq.${row.id}&updated_at=eq.${q(row.updated_at)}`, { method: "PATCH", body: { nda, updated_at: new Date(Math.max(Date.now(), Date.parse(row.updated_at || 0) + 1)).toISOString() } }).catch(() => null);
    if (!won || !won[0]) {
      const again = await getByRef(ref);
      if (again && again.nda && again.nda.status === "SIGNED") return json(res, 409, { ok: false, error: "already_signed" });
      return json(res, 500, { ok: false, error: "server_error" });
    }
    await logEvent(row.id, "customer", who, "nda.signed", { number: nda.number, mode: signature.mode, sha256: hash.slice(0, 16) });
    await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "simple.nda.sign", entity: "requests", entity_id: row.id, meta: { ref, sha256: hash } });
    await announce(won[0], "nda-signed", {
      subject: `تم توقيع اتفاقية عدم الإفصاح ${nda.number}`,
      clientLine: "شكراً لك، استلمنا توقيعك على اتفاقية عدم الإفصاح وحفظناها مع طلبك.",
      opsLine: `${signerName} وقّع اتفاقية عدم الإفصاح ${nda.number} إلكترونياً.`,
      cta: "افتح الطلب",
    });
    return json(res, 200, { ok: true, nda: { ...nda, html: undefined } });
  }

  if (action === "contract-sign") {
    if (row.status !== "CONTRACT_SENT" || !row.contract) return json(res, 409, { ok: false, error: "no_open_contract" });
    if (!b.consent) return json(res, 400, { ok: false, error: "consent_required", message: "يلزم الموافقة على التوقيع الإلكتروني." });
    const signerName = str(b.name, 160) || who;
    const bad = signatureProblem(signerName, b.signature);
    if (bad) return json(res, 400, bad);
    const hash = crypto.createHash("sha256").update(String(row.contract.html || "")).digest("hex");
    const signature = {
      name: signerName, email, ip: clientIp(req), ua: str(req.headers["user-agent"], 200), at: nowIso(),
      // A drawn signature is a PNG data URL. Cutting it at a length produced a
      // corrupt image (the 600×150 canvas of a busy scribble passes 60 000
      // characters), so it is kept whole or not at all — the name, time, IP and
      // document hash are the evidence; the picture is a courtesy.
      contract_sha256: hash, image: typeof b.signature === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.signature) && b.signature.length <= 250000 ? b.signature : null,
      mode: SIMPLE_TEST_MODE ? "test-esign" : "portal-esign",
    };
    const contract = { ...row.contract, status: "SIGNED", signed_at: signature.at, signature };
    const signedPayment = { status: "PENDING", amount: row.quote?.total || 0, currency: "SAR", provider: null };
    const auto = autoStages(row, { contract, payment: signedPayment });
    const upd = await patchRequest(row.id, { contract, status: "SIGNED", payment: signedPayment, ...(auto || {}) });
    if (auto) await logEvent(row.id, "internal", "النظام", "stage.auto", { from: "contract.signed" });
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
    // الموعد يُفحص بقواعد الحجز نفسها (api/_booking.js): ساعات الجلسات ويوم
    // العطلة والماضي ومهلة الساعة. كان هنا فحصٌ للجمعة وللماضي فقط، وصفحة
    // /consultation تقبل غير ما تقبله هذه.
    const v = validateSlot(date, time);
    if (!v.ok) return json(res, 400, { ok: false, error: v.error, message: bookingMessage(v.error, row.lang === "en" ? "en" : "ar") });
    const prev = row.appointment;
    const live = prev && prev.status !== "CANCELLED";
    const mlang = ["ar", "en", "fr", "zh"].includes(row.lang) ? row.lang : "ar";
    const topic = str(b.topic, 200) || row.title;
    const appointment = {
      date, time, tz: "Asia/Riyadh", topic, note: str(b.note, 500),
      status: live && action === "appointment-reschedule" ? "RESCHEDULED" : "BOOKED",
      booked_at: nowIso(), ref: (prev && prev.ref) || null, gcal: (prev && prev.gcal) || null, meet: (prev && prev.meet) || "", mode: "video", minutes: bookingConfig().slotMin,
    };
    // الحجز كلّه في api/book.js (الحدث في تقويم الشركة + Meet + دعوة العميل
    // والمالك + البريد). تُمرَّر كوكي الجلسة فيعرف أن الحاجز صاحب الحساب نفسه.
    // لا يُسجَّل موعدٌ فشل حجزُه: كان الخطأ يُبتلع فيرى العميل «تم» بلا حدث.
    const post = async (payload) => {
      const r = await fetch(SELF_BASE + "/api/book", { method: "POST", headers: { "content-type": "application/json", cookie: String(req.headers.cookie || ""), "x-forwarded-for": clientIp(req) }, body: JSON.stringify(payload) });
      return r.json().catch(() => ({}));
    };
    let j;
    try {
      if (live && action === "appointment-reschedule" && prev.ref && prev.gcal) {
        j = await post({ action: "reschedule", ref: prev.ref, t: manageToken(prev.ref, email), date, time, lang: mlang });
      } else {
        j = await post({ name: row.client_name || who, email, phone: row.client_phone || "", company: row.company_name || "", topic, date, time, notes: `${ref} · ${appointment.note}`, lang: mlang, source: "simple-v1" });
      }
    } catch { return json(res, 502, { ok: false, error: "book_unavailable", message: bookingMessage("server_error", mlang === "en" ? "en" : "ar") }); }
    if (!j || !j.ok) return json(res, j && j.error === "slot_taken" ? 409 : 400, { ok: false, error: (j && j.error) || "book_failed", message: (j && j.message) || bookingMessage("server_error", mlang === "en" ? "en" : "ar") });
    appointment.ref = j.ref || appointment.ref;
    appointment.gcal = j.eventId || appointment.gcal;
    appointment.meet = j.meet || appointment.meet || "";
    appointment.confirmed = j.confirmed !== false;
    if (!appointment.confirmed) appointment.status = "PENDING";
    await patchRequest(row.id, { appointment });
    await logEvent(row.id, "customer", who, action === "appointment-book" ? "appointment.booked" : "appointment.rescheduled", { date, time });
    return json(res, 200, { ok: true, appointment });
  }

  if (action === "appointment-cancel") {
    if (!row.appointment) return json(res, 404, { ok: false, error: "no_appointment" });
    // الحدث في تقويم الشركة يُلغى معه (فتصل العميلَ والمالكَ رسالةُ الإلغاء من جوجل)،
    // وإلا بقي الموعد في تقويم المالك بعد أن ألغاه العميل.
    let calendar = "none";
    if (row.appointment.ref && row.appointment.gcal) {
      try {
        const r = await fetch(SELF_BASE + "/api/book", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "cancel", ref: row.appointment.ref, t: manageToken(row.appointment.ref, email) }) });
        const j = await r.json().catch(() => ({}));
        calendar = j && j.ok ? "cancelled" : "failed";
      } catch { calendar = "failed"; }
    }
    const appointment = { ...row.appointment, status: "CANCELLED", cancelled_at: nowIso() };
    await patchRequest(row.id, { appointment });
    await logEvent(row.id, "customer", who, "appointment.cancelled", {});
    await sendEmail(OWNER_EMAIL, `إلغاء موعد ${ref}`, `<p>${esc(who)} ألغى موعد ${esc(row.appointment.date)} ${esc(row.appointment.time)}${calendar === "failed" ? " — <b>تعذّر إلغاء الحدث في التقويم، أزِله يدوياً</b>" : ""}</p>`);
    return json(res, 200, { ok: true, appointment, calendar });
  }

  // الإلغاء من جهة العميل. السياسة في cancelPolicy: ما لم يُدفع منه شيء ولم
  // يبدأ تنفيذه يُلغى فوراً — ويأخذ معه ما يتعلّق به (موعد الاستشارة، ومهام
  // المتابعة الآلية، وسطر السلة يموت وحده لأن sv1Line لا يقبل إلا SIGNED
  // وPAYMENT_PENDING). وما بعد ذلك يُسجَّل طلب إلغاء للفريق، مرةً واحدة، وتقرؤه
  // البوابة فتعرض «قيد المراجعة» بدل أن تعيد الزرّ كأن شيئاً لم يحدث.
  // الأخطاء أكواد ثابتة (already_closed · not_found · no_session…) والبوابة
  // تترجمها بلغة العميل؛ لا نصوص عربية من الخادم هنا.
  if (action === "request-cancel") {
    const note = str(b.note, 500);
    const policy = cancelPolicy(row);
    if (policy === "closed") return json(res, 409, { ok: false, error: "already_closed" });
    if (policy === "now") {
      const at = nowIso();
      const contractSigned = !!(row.contract && row.contract.status === "SIGNED");
      const apptLive = !!(row.appointment && row.appointment.status !== "CANCELLED");
      const patch = {
        status: "CANCELLED",
        cancel: { at, by: "customer", actor: who, note, stage: row.status, contract_signed: contractSigned },
        cancel_request: null,
      };
      if (apptLive) patch.appointment = { ...row.appointment, status: "CANCELLED", cancelled_at: at };
      // حدث التقويم يُلغى مع الموعد كما في appointment-cancel، وإلا بقي في تقويم المالك.
      let calendar = "none";
      if (apptLive && row.appointment.ref && row.appointment.gcal) {
        try {
          const r = await fetch(SELF_BASE + "/api/book", { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "cancel", ref: row.appointment.ref, t: manageToken(row.appointment.ref, email) }) });
          const j = await r.json().catch(() => ({}));
          calendar = j && j.ok ? "cancelled" : "failed";
        } catch { calendar = "failed"; }
      }
      // «والعميل يقدر يلغي وتنمسح»: a request with no signature and no money is
      // hidden from the customer at once (`deleted_at`) and listed for the owner
      // under «المحذوفة» in /ops, for audit only. Nothing is erased from the
      // database — final erasure is the owner's decision. A signed contract or a
      // payment is a record of an obligation: that row stays, cancelled and visible.
      const hide = !contractSigned && !moneyReceived(row);
      const upd = (await patchRequestHide(row.id, patch, hide ? at : null)) || { ...row, ...patch };
      const hidden = hide && !!upd.deleted_at;
      await logEvent(row.id, "customer", who, "request.cancelled", { note, stage: row.status, ...(hide ? { hidden } : {}) });
      if (apptLive) await logEvent(row.id, "customer", who, "appointment.cancelled", { date: row.appointment.date, time: row.appointment.time, with_request: true });
      await closeAutoTasks(row.id);
      const opsBits = [`${row.client_name || who} ألغى الطلب بنفسه من مرحلة «${stageAr(row.status)}».`,
        contractSigned ? "العقد كان موقَّعاً ولم يُدفع شيء." : "قبل أي توقيع أو دفع."];
      if (apptLive) opsBits.push(`أُلغي موعده ${row.appointment.date} ${row.appointment.time}${calendar === "cancelled" ? " وأُلغي حدثه في التقويم." : calendar === "failed" ? " — تعذّر إلغاء حدثه في التقويم، أزله يدوياً." : " — أزله من التقويم إن وُجد."}`);
      if (note) opsBits.push(`السبب: ${note}`);
      if (hidden) opsBits.push("أُخفي عن العميل ويظهر لك في «المحذوفة» (للتدقيق فقط).");
      await announce(upd, "cancelled", {
        subject: `أُلغي الطلب ${row.ref}`,
        clientLine: "ألغينا طلبك كما طلبت. تقدر تبدأ طلباً جديداً في أي وقت.",
        opsLine: opsBits.join(" "),
      });
      return json(res, 200, { ok: true, status: "CANCELLED", cancelled: true, hidden, appointment_cancelled: apptLive });
    }
    // يراجعه الفريق: مرةً واحدة. التكرار لا يضاعف المهمة ولا البريد.
    if (row.cancel_request) return json(res, 200, { ok: true, status: row.status, requested: true, already: true });
    const paid = moneyReceived(row);
    const pending = { at: nowIso(), by: "customer", actor: who, note, stage: row.status };
    const upd = (await patchRequest(row.id, { cancel_request: pending })) || { ...row, cancel_request: pending };
    await logEvent(row.id, "customer", who, "cancel.requested", { note, stage: row.status });
    await sweepTask(upd, {
      source: "cancel.request", urgency: "high", human: true,
      title: () => `طلب إلغاء — ${row.ref}`,
      details: () => `العميل طلب إلغاء الطلب وهو في مرحلة «${stageAr(row.status)}».${paid ? " ⚠️ الطلب مدفوع — الاسترداد قرارٌ منفصل." : ""}${note ? ` السبب: ${note}` : ""} راجع ما ترتّب عليه (عقد موقّع / دفعة / تنفيذ) ثم ألغِه من اللوحة أو تواصل معه.`,
    }, "المستشار الذكي");
    await announce(upd, "cancel-request", {
      subject: `طلب إلغاء ${row.ref} بانتظار مراجعة الفريق`,
      clientLine: paid
        ? "استلمنا طلب الإلغاء. الطلب مدفوع، فيراجع الفريق الدفعة وما ترتّب على الطلب ويعود لك بالقرار. لا نَعِد هنا بمبلغ أو بمدة قبل أن تكتمل المراجعة."
        : "استلمنا طلب الإلغاء. الطلب وصل مرحلةً يترتّب عليها التزامات، فيراجعه الفريق ويعود لك.",
      opsLine: `${row.client_name || who} طلب إلغاء الطلب في مرحلة «${stageAr(row.status)}».${paid ? " الطلب مدفوع — الاسترداد قرارٌ منفصل." : ""}${note ? ` السبب: ${note}` : ""}`,
      cta: "افتح الطلب في لوحة العمليات",
    });
    return json(res, 200, { ok: true, status: row.status, requested: true });
  }

  return json(res, 400, { ok: false, error: "unknown_action" });
}

// مهام المتابعة الآلية (مراجعة جديد، تسعير، تذكير بالدفع…) تفقد معناها بإلغاء
// الطلب. اليدوية تبقى: إنسانٌ كتبها وهو من يغلقها.
async function closeAutoTasks(requestId) {
  try {
    const open = await sb(`tasks?request_id=eq.${requestId}&status=in.(open,in_progress,blocked)&select=id,source`);
    for (const t of open || []) {
      if (/^(sweep-|pricing$)/.test(String(t.source || ""))) await sb(`tasks?id=eq.${t.id}`, { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled" } });
    }
  } catch (e) { console.error("simple: close tasks", String(e.message || e).slice(0, 120)); }
}

// Requests opened by «إنشاء عرض سعر» (event request.created {auto_quote:true})
// that stopped only because the client had no name or mobile yet. Fresh ones
// only (a day): an old abandoned NEW request is not revived by a profile form.
async function issueWaitingQuotes(sess) {
  const mine = await myRequests(sess);
  const since = Date.now() - 864e5;
  let n = 0;
  for (const r of mine) {
    if (r.status !== "NEW" || r.quote || isCartRow(r) || isTicketRow(r)) continue;
    if (!(Date.parse(r.created_at) >= since) || !Array.isArray(r.scope) || !r.scope.length) continue;
    const ev = await sb(`request_events?request_id=eq.${r.id}&event=eq.request.created&select=details&limit=1`);
    if (!(ev && ev[0] && ev[0].details && ev[0].details.auto_quote)) continue;
    const fresh = (await getByRef(r.ref)) || r;
    if (!fullNameOk(fresh.client_name) || !str(fresh.client_phone, 40)) continue;
    const scope = await resolveScope(normScope(fresh.scope));
    if (!scope.some((it) => !it.seed)) continue;
    await logEvent(r.id, "customer", sess.user?.full_name || r.client_email, "scope.confirmed", { auto: true });
    const out = await quoteOrHold(fresh, scope);
    if (out.issued) n++;
  }
  return n;
}

// Reads requests with the hidden ones (`deleted_at`) removed IN THE QUERY, before
// `limit` — filtered afterwards, hidden rows would eat the page. If the database
// has no such column yet the query is retried without it and filtered in code.
async function sbLive(path) {
  let rows;
  try { rows = await sb(path + "&deleted_at=is.null"); }
  catch { rows = await sb(path.replace(",deleted_at", "")); }
  return rows.filter((r) => !r.deleted_at);
}
async function myRequests(sess) {
  const email = String(sess.user?.email || "").toLowerCase();
  const orgId = sess.organization?.id;
  const filter = orgId ? `or=(organization_id.eq.${orgId},client_email.eq.${q(email)})` : `client_email=eq.${q(email)}`;
  const live = await sbLive(`requests?${filter}&select=*&order=created_at.desc&limit=100`);
  // A request the customer cancelled and that carried no signature and no money
  // is hidden from everything he reads (`deleted_at`, see request-cancel). The
  // filter is here, in code, so it also holds while the column is not yet on the
  // database — a row without it simply has nothing to hide.
  return Promise.all(live.map((r) => (r.status === "QUOTE_APPROVED" ? ensureContract(r) : r)));
}
// حوالة بنكية رُفع إيصالها وينتظر التحقق: المال خرج من العميل ولم يُعتمد بعد. لا تُعرض له «بانتظار الدفع»
// ولا زرُّ دفعٍ جديد (دفعٌ مزدوج)، ولا تُحسب «مدفوعات مستحقة» عنده. الحالتان معاً: REVIEW بإيصال، أو حجز التسوية.
export const bankUnderReview = (r) => {
  const p = r && r.payment;
  if (!p || String(p.provider || "") !== "bank") return false;
  if (String(p.status || "").toUpperCase() === "PAID") return false;
  return ["PAYMENT_PENDING", "WAITING_INTERNAL"].includes(r.status) && !!p.receipt;
};
// المبلغ الذي يراه العميل والفريق: إجمالي عرض السعر إن وُجد، وإلا ما سُجّل على الدفعة (طلب السلة لا عرض سعر له،
// ومبلغه الحقيقي محفوظ في payment.amount/total/expected_total — قراءته من r.quote وحدها كانت تعرض «0 ر.س»).
export const paymentAmount = (r) => {
  const p = (r && r.payment) || {};
  for (const v of [r && r.quote && r.quote.total, p.amount, p.total, p.expected_total]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return round2(n);
  }
  return 0;
};
const paymentView = (r) => ({
  status: r.payment.status, amount: paymentAmount(r) || r.payment.amount, provider: r.payment.provider,
  ...(bankUnderReview(r) ? { review: true } : {}),
});
const summary = (r) => ({
  ref: r.ref, type: r.type, source: r.source, status: r.status, title: r.title, lang: r.lang, created_at: r.created_at, updated_at: r.updated_at,
  scope_count: (r.scope || []).length,
  quote: r.quote ? { number: r.quote.number, total: r.quote.total, status: r.quote.status, valid_until: r.quote.valid_until } : null,
  contract: r.contract ? { number: r.contract.number, status: r.contract.status } : null,
  nda: r.nda ? { number: r.nda.number, status: r.nda.status } : null,
  payment: r.payment ? paymentView(r) : null,
  invoice: publicInvoice(r.invoice) ? { number: r.invoice.number, total: r.invoice.total } : null,
  appointment: r.appointment ? { date: r.appointment.date, time: r.appointment.time, status: r.appointment.status, topic: r.appointment.topic, ref: r.appointment.ref || null, meet: r.appointment.meet || "", minutes: r.appointment.minutes || null, mode: r.appointment.mode || "" } : null,
  last_message: (r.conversation || []).slice(-1)[0] || null,
  client_name: r.client_name, client_email: r.client_email, client_phone: r.client_phone, company_name: r.company_name,
  assigned_to: r.assigned_to || null,
  cancel_requested: r.cancel_request ? { at: r.cancel_request.at } : null,
  // «شراء مباشر»: the request was opened by a paid cart, not by a conversation.
  origin: isCartRow(r) ? "cart" : isTicketRow(r) ? "ticket" : "",
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

// قراءة إيصال حوالة بنكية: آلةٌ واحدة يستعملها «إيصال تحويل مرفوع» على طلبٍ بعرض سعر
// (action receipt-upload أدناه) وحوالة السلة (api/pay.js bank-receipt عبر
// api/_bank-transfer.js). تعيد ما كتبه المصرف على الإيصال، لا أكثر؛ المقارنة بالمبلغ
// والمستفيد والآيبان تجري عند المنادي. القراءة ليست إثباتاً لوصول المال.
export const RECEIPT_PROMPT = [
  "هذا إيصال/إشعار تحويل بنكي. أعِد JSON فقط بلا أي نص آخر بالمفاتيح:",
  '{"amount":number|null,"currency":string|null,"date":string|null,"sender":string|null,',
  '"beneficiary":string|null,"bank":string|null,"iban":string|null,"reference":string|null,',
  '"status":"executed"|"pending"|"failed"|"unknown","is_receipt":boolean}',
  "amount هو المبلغ المحوَّل بالأرقام بلا فواصل. beneficiary اسم المستفيد كما كُتب. iban آيبان المستفيد كاملاً كما ظهر (لا آيبان المُرسِل).",
  "reference رقم مرجع/عملية المصرف كما كُتب. status executed إن ذُكر نجاح التنفيذ، pending إن كانت معلّقة أو مجدولة، failed إن فشلت.",
  "إن لم تجد قيمة ضعها null. لا تخمّن ولا تُكمل رقماً ناقصاً.",
].join(" ");
export async function readTransferReceipt(base64, mime) {
  try {
    const raw = await readDocumentRaw(base64, mime, RECEIPT_PROMPT, 600);
    if (raw && raw.ok) {
      const read = parseJson(String(raw.data || ""));
      return read ? { ok: true, read, provider: raw.provider || "" } : { ok: false, error: "unparseable", provider: raw.provider || "" };
    }
    return { ok: false, error: raw && raw.error === "not_configured" ? "unavailable" : (raw && raw.error) || "unavailable" };
  } catch (e) {
    console.error("receipt read", String((e && e.message) || e).slice(0, 160));
    return { ok: false, error: "unavailable" };
  }
}

// Shared by the test payment and by the real gateway settle (api/pay.js
// calls markRequestPaidByRef after Moyasar/Tamara confirm a `sv1:<ref>` line).
//
// The tax invoice belongs in the books, not only in our own row. A paid request
// issues it in Daftra under the client's record, with the payment recorded
// against it, e-mails it to the client, and keeps the record on the request so
// «الفواتير» in /my shows it. All of that lives in api/_invoicing.js — the same
// engine the cart uses — so the claim, the retry and the alert are one thing.
//
// Locally and in test mode nothing reaches Daftra: the internal TEST-INV- number
// stands in, and the reason is recorded so a missing invoice is never a mystery.
// In production a request is never given a made-up number: either Daftra
// numbered it, or the customer sees nothing yet and the owner is told.
function invoiceDraftForRequest(row, payment) {
  const items = (row.quote?.items || []).map((l) => ({
    name: str(l.title, 140) || "خدمة", quantity: Math.max(1, Math.min(999, num(l.qty) || 1)), unitPrice: round2(num(l.price)),
  })).filter((i) => i.unitPrice >= 0);
  const buyer = {
    name: str(partyName(row), 160),
    email: str(row.client_email, 160), phone: str(row.client_phone, 40),
  };
  const bank = /^bank/i.test(String(payment.provider || ""));
  const notes = [`مرجع الطلب: ${row.ref}`, `عرض السعر: ${row.quote?.number || ""}`, bank ? "مدفوعة بحوالة بنكية" : "مدفوعة إلكترونياً عبر الموقع"].filter(Boolean).join("\n");
  return { ref: row.ref, payId: payment.ref || "", method: payment.provider === "tamara" ? "Tamara" : bank ? "Bank transfer" : "Moyasar", buyer, items, notes };
}

// What the invoice engine needs to know about a request row.
function invoiceHooks(row) {
  return {
    // «invoice.issued» has a customer-facing label; everything else is bookkeeping
    // for the panel and is hidden from the customer's timeline (actor_kind internal).
    event: async (name, details) => {
      await logEvent(row.id, name === "invoice.issued" ? "system" : "internal", "الفواتير", name, details);
      // The invoice reached the customer: the human task that said it had not is done.
      if (name === "invoice.emailed") {
        try { await sb(`tasks?request_id=eq.${row.id}&source=eq.invoice-failed&status=in.(open,in_progress,blocked)`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: nowIso() } }); } catch { /* the task stays open; harmless */ }
      }
    },
    failed: (rec, why) => sweepTask(row, {
      source: "invoice-failed", human: true, urgency: "high",
      title: (r) => `الفاتورة لم تكتمل — ${r.ref}`,
      details: () => `الدفع مؤكد لكن الفاتورة لم تصدر أو لم تصل العميل (${why}${rec && rec.last_error ? ": " + rec.last_error : ""}). تُعاد المحاولة تلقائياً؛ وإن بقيت عالقة أصدرها من الدفترة وأرسلها للعميل، أو أعد المحاولة من اللوحة (ops-invoice-retry).`,
    }, "الفواتير"),
  };
}
const invoiceTarget = (row) => ({ rowId: row.id, ref: row.ref, myUrl: myUrl(row), hooks: invoiceHooks(row) });

async function issueRequestInvoice(row, payment) {
  const draft = invoiceDraftForRequest(row, payment);
  const target = invoiceTarget(row);
  const key = payment.ref || row.ref;
  if (!draft.items.length) return reportInvoiceBlocked({ key, draft, target, reason: "no_priced_items", detail: "عرض السعر بلا بنود", total: payment.amount });
  if (!draft.buyer.name || !isEmail(draft.buyer.email)) return reportInvoiceBlocked({ key, draft, target, reason: "missing_buyer", detail: "اسم العميل أو بريده ناقص على الطلب", total: payment.amount });
  return issuePaidInvoice({ key, draft, target });
}

export async function markPaid(row, { provider, payId, amount, test, actor, extra }) {
  const suffix = row.ref.replace(/^BP-R-/, "");
  // `extra`: ما يُبقى على الدفعة من قبل (إيصال الحوالة ومن اعتمدها) — الدفعة تُبنى هنا من جديد فلا يضيع.
  const payment = { ...(extra && typeof extra === "object" ? extra : {}), status: "PAID", provider, ref: payId, amount: round2(num(amount)), currency: "SAR", at: nowIso(), test: !!test };
  const testInvoice = (why) => ({
    number: "TEST-INV-" + suffix, issued_at: nowIso(), mode: "test",
    net: row.quote?.net || 0, vat: row.quote?.vat || 0, total: row.quote?.total || 0, currency: "SAR", vat_rate: 15,
    items: row.quote?.items || [], bill_to: { name: row.client_name, company: row.company_name, email: row.client_email },
    daftra: { issued: false, reason: why },
  });
  let invoice = row.invoice, testIssued = false;
  if (invoiceIsComplete(invoice)) { /* already invoiced: never twice */ }
  else if (test) { invoice = testInvoice("test_mode"); testIssued = true; }
  else {
    const r = await issueRequestInvoice(row, payment);
    if (r.reason === "daftra_skipped_nonlive" || (r.reason === "daftra_not_configured" && SIMPLE_TEST_MODE)) { invoice = testInvoice(r.reason); testIssued = true; }
    // (A real payment with no Daftra key is not special-cased: the engine records the
    // failure, tells the owner once, and completes it when the key is set.)
    else if (r.record) invoice = r.record;
  }
  const autoSt = autoStages(row, { payment });
  const upd = await patchRequest(row.id, { payment, status: "PAID", ...(invoice ? { invoice } : {}), ...(autoSt || {}) });
  if (autoSt) await logEvent(row.id, "internal", "النظام", "stage.auto", { from: "payment.paid" });
  await logEvent(row.id, "system", test ? "TEST MODE" : provider, "payment.paid", { provider, payId, amount: payment.amount });
  // إيصال حوالة اعتُمد (آلياً أو بإنسان): مهمة «راجع الإيصال» انتهت.
  if (/^bank/i.test(String(provider || ""))) {
    try { await sb(`tasks?request_id=eq.${row.id}&source=in.(bank-review,receipt.verify)&status=in.(open,in_progress,blocked)`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: nowIso() } }); } catch { /* stays open; harmless */ }
  }
  if (testIssued) await logEvent(row.id, "system", "TEST MODE", "invoice.issued", { number: invoice.number, total: invoice.total });
  const invNo = invoice && invoice.number ? invoice.number : "";
  const sent = !!(invoice && invoice.delivery && invoice.delivery.sent_at);
  if (row.organization_id) {
    await notify({ organization_id: row.organization_id, event: "simple_paid", title: `تم استلام الدفع — ${row.ref}`, body: invNo ? `الفاتورة ${invNo}` : "الفاتورة قيد الإصدار", idempotency_key: `simple_paid_${row.ref}` });
  }
  await announce(upd, "paid", {
    subject: invNo ? `تم استلام الدفع — فاتورتك ${invNo}` : "تم استلام الدفع",
    clientLine: invNo
      ? `استلمنا ${payment.amount} ر.س. فاتورتك الضريبية ${invNo} ${sent ? "أُرسلت إلى بريدك وتجدها أيضاً" : "جاهزة"} في «الفواتير» داخل حسابك، وبدأنا التنفيذ.`
      : `استلمنا ${payment.amount} ر.س وبدأنا التنفيذ. فاتورتك الضريبية قيد الإصدار وتصلك على بريدك.`,
    opsLine: `دفع مستلم ${payment.amount} ر.س عبر ${provider} (${payId}). ${invNo ? `الفاتورة ${invNo}` : "الفاتورة لم تصدر بعد"}${invoice && invoice.daftra && invoice.daftra.issued === false ? " — لم تصدر من الدفترة: " + (invoice.daftra.reason || "") : ""}${invoice && invoice.status && invoice.status !== "issued" && invoice.last_error ? " — " + invoice.last_error : ""}.`,
    cta: "افتح فاتورتك",
  });
  return upd;
}
export async function markRequestPaidByRef(ref, info) {
  const row = await getByRef(ref);
  if (!row || row.status === "PAID" || ["IN_PROGRESS", "COMPLETED"].includes(row.status)) return row;
  if (row.status === "CANCELLED") return holdPaymentOnCancelled(row, info);
  return markPaid(row, info);
}
// The customer cancelled while a gateway page was still open and then paid on
// it. The money is real, so it is recorded — but the request is not revived and
// no tax invoice is issued on its own: reopening, refunding or invoicing is the
// team's call, and a task says so.
async function holdPaymentOnCancelled(row, { provider, payId, amount, test, actor }) {
  if (row.payment && row.payment.after_cancel && row.payment.ref === payId) return row; // webhook + callback
  const payment = { status: "PAID", provider, ref: payId, amount: round2(num(amount)), currency: "SAR", at: nowIso(), test: !!test, after_cancel: true };
  const upd = (await patchRequest(row.id, { payment })) || { ...row, payment };
  await logEvent(row.id, "system", test ? "TEST MODE" : provider, "payment.after_cancel", { provider, payId, amount: payment.amount });
  await sweepTask(upd, {
    source: "payment.after_cancel", urgency: "high", human: true,
    title: (r) => `دفعة وصلت بعد الإلغاء — ${r.ref}`,
    details: () => `وصلت دفعة ${payment.amount} ر.س عبر ${provider} (${payId}) على طلب ملغى. لم يُصدَر شيء تلقائياً: قرّر الاسترداد أو أعد فتح الطلب.`,
  }, "النظام");
  try { await sendEmail(OWNER_EMAIL, `[${row.ref}] دفعة وصلت بعد إلغاء الطلب`, `<p>وصلت دفعة ${esc(String(payment.amount))} ر.س (${esc(payId)}) على طلب ملغى. راجعه في اللوحة.</p><p><a href="${SELF_BASE}/ops?ref=${row.ref}">افتح الطلب</a></p>`); } catch {}
  return upd;
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
  // باقات Business Partner AI: تُصنَّف خدمةً شهرية باسمها (catalog.json → aiPlans).
  for (const ap of (cat && cat.aiPlans) || []) if (ap.code) services.set(String(ap.code).toLowerCase(), { code: ap.code, nameAr: ap.nameAr, nameEn: ap.nameEn, pricingModel: "Monthly", category: "AI Automation" });
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

// أول رسالة للعميل على طلب حوالة بانتظار التحقق. تُستبدل عند الاعتماد (settleBankRow) فلا تبقى فوق رسالة الاعتماد.
const BANK_PENDING_MSG = "استلمنا إيصال حوالتك وطلبك بانتظار التحقق. حين يتطابق المبلغ والمستفيد والآيبان نعتمد الدفع ونصدر فاتورتك الضريبية ونبدأ التنفيذ؛ وإن احتاج الإيصال نظراً بشرياً فنخبرك بالسبب هنا. لا حاجة لإعادة الدفع.";
const isBankPendingMsg = (m) => !!m && m.role === "bp" && String(m.content || "").startsWith("استلمنا إيصال حوالتك وطلبك بانتظار التحقق");

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
  // حوالة بنكية (2026-10-23): `d.bank.pending` = الطلب يُفتح الآن بانتظار التحقق من الإيصال ولم
  // يُعتمد دفعه؛ و`bank_<مرجع>` بلا pending = الاعتماد (آلي أو بإنسان) على طلبٍ فُتح قبلاً.
  const bankIn = d.bank && d.bank.pending ? d.bank : null;
  const provider = bankIn || /^bank_/i.test(payId) ? "bank" : /^tamara_/i.test(payId) ? "tamara" : "moyasar";

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
  if (existing) {
    // اعتماد حوالةٍ فُتح طلبها بانتظار التحقق: الصفّ نفسه يصير مدفوعاً، لا يُفتح ثانٍ.
    if (provider === "bank" && !bankIn) return settleBankRow(existing, d);
    return { ok: true, ref: existing.ref, created: false, status: existing.status, documents: (existing.documents || []).length };
  }
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

  const test = provider === "bank" ? false : PAY_MOCK() || (provider === "tamara" && TAMARA_MOCK());
  const payment = {
    status: bankIn ? "REVIEW" : "PAID", provider, ref: payId, amount: paid, currency: "SAR", at: nowIso(), test,
    source: "cart", order_ref: orderRef, pay_ref: payId, verified,
    items: items.map(({ formation, consult, ...keep }) => keep), net, vat, total: paid, net_estimated: !(verified && d.net != null),
    ...(d.disc ? { discount_code: str(d.disc, 30) } : {}),
    // لقطة الطلب كما أرسلتها الصفحة: بها وحدها يُعاد تسعير الطلب وتصدر الفاتورة إن اعتمده إنسان لاحقاً.
    ...(bankIn ? { expected_total: paid, bank_order: bankIn.order, cart_fp: String(bankIn.fp || "") } : {}),
  };
  const at = nowIso();
  const row = {
    ref, organization_id: orgId, user_id: userId, type, source: "WEBSITE",
    status: bankIn ? "PAYMENT_PENDING" : verified ? "PAID" : "REVIEWING", lang: "ar", title,
    summary: bankIn
      ? `حوالة بنكية من السلة — مرجع الطلب ${orderRef} · الإجمالي ${paid} ر.س شامل الضريبة · بانتظار التحقق من الإيصال.`
      : `شراء مباشر بالسلة — رقم عملية الدفع ${payId || "—"} · الإجمالي ${paid} ر.س شامل الضريبة.`,
    conversation: [{ role: "bp", content: bankIn
      ? BANK_PENDING_MSG
      : verified
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
  if (bankIn) await logEvent(created.id, "system", "حوالة بنكية", "payment.pending", { provider, payId, amount: paid, order_ref: orderRef });
  else await logEvent(created.id, "system", provider, "payment.paid", { provider, payId, amount: paid, order_ref: orderRef });
  if (documents.length) await logEvent(created.id, "system", "النظام", "documents.requested", { documents: documents.map((x) => x.title) });
  await audit({ organization_id: orgId, actor_user_id: userId, action: "simple.request.cart", entity: "requests", entity_id: created.id, meta: { ref, order_ref: orderRef, pay_ref: payId } });

  // حوالة بانتظار التحقق: لا مهمة «ابدأ التنفيذ» ولا «استلمنا دفعتك» قبل أن يُعتمد الدفع —
  // يفتح bankReceiptVerdict المهمة البشرية بسببها إن لزم، ويعلن settleBankRow الاعتماد.
  if (bankIn) return { ok: true, ref, created: true, status: created.status, documents: documents.length };

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

// ------------------------------------------------- حوالة بنكية من السلة (2026-10-23) --
// أمر المالك أعاد التحويل البنكي مع رفع الإيصال. الطلب يُفتح **بانتظار التحقق** حال رفع
// الإيصال (PAYMENT_PENDING · payment.status REVIEW · provider bank)، ثم:
//   • تطابق المبلغ والمستفيد والآيبان → api/pay.js يعتمد الدفع بالمسار نفسه الذي يسلكه دفع
//     البطاقة (settlePaidOrder ثم الفاتورة)، فيصل createCartRequest بمفتاح `bank_<مرجع>`
//     إلى الصفّ نفسه فيحوّله settleBankRow إلى مدفوع؛
//   • أي اختلاف → يبقى الصفّ بانتظار التحقق وتُفتح مهمة بشرية بالسبب (bankReceiptVerdict)،
//     ويعتمده الفريق من «تأكيد الدفع» في اللوحة (ops-mark-paid) فيُحوَّل إلى api/pay.js.
// ما يكتبه المنسّق (api/pay.js) هنا يمرّ بهذه الدوال وحدها.
export async function bankOrderRow(orderRef) {
  if (!DB_ON) return null;
  const want = "bank_" + str(orderRef, 40);
  try {
    for (let salt = 0; salt < 3; salt++) {
      const hit = await getByRef(cartRequestRef(want, salt));
      if (!hit) return null;
      const p = hit.payment || {};
      if (p.source === "cart" && p.pay_ref === want) return hit;
    }
  } catch { /* no row */ }
  return null;
}

// ما يُفحص قبل أي كتابة: صفٌّ قائم بهذا المرجع يجب أن يكون لهذا البريد، غير مدفوع ولا ملغى، وأن تكون سلة
// هذا الرفع هي السلة نفسها التي سُعِّر بها الصفّ أول مرة (البصمة: البنود والكميات والرسوم والخصم والمبلغ).
// صفٌّ له إيصال لا تتغيّر بنوده ولا مبلغه: التبديل كان يُنتج صفّاً مدفوعاً بعنوان 30,000 ومبلغ 115.
export async function bankOrderPrecheck({ ref, email, fp }) {
  if (!DB_ON) return { ok: false, status: 503, error: "db_off" };
  const row = await bankOrderRow(ref);
  if (!row) return { ok: true, row: null };
  const p = row.payment || {};
  const owner = String((p.bank_order && p.bank_order.email) || row.client_email || "").toLowerCase();
  if (owner && owner !== String(email || "").toLowerCase()) return { ok: false, status: 409, error: "ref_taken" };
  if (String(p.status || "").toUpperCase() === "PAID") return { ok: false, status: 409, error: "already_paid", row };
  if (row.status === "CANCELLED") return { ok: false, status: 409, error: "request_closed", row, message: "هذا الطلب أُلغي ولم يعد يقبل إيصالات. إن كنت حوّلت المبلغ فعلاً فراسلنا وسنراجعه معك، ولن يضيع تحويلك." };
  if (!p.cart_fp || p.cart_fp !== fp) return { ok: false, status: 409, error: "cart_changed", row };
  return { ok: true, row };
}

// حدّ دائم لا يزوّره العميل: عدد حوالات الحساب الواحد المفتوحة بانتظار التحقق.
export async function bankOpenCount(email) {
  if (!DB_ON || !email) return 0;
  try {
    const rows = await sb(`requests?client_email=eq.${q(String(email).toLowerCase())}&status=in.(PAYMENT_PENDING,WAITING_INTERNAL)&select=ref,payment&limit=40`);
    return (rows || []).filter((r) => r && r.payment && r.payment.provider === "bank" && r.payment.source === "cart" && String(r.payment.status || "").toUpperCase() !== "PAID").length;
  } catch { return 0; }
}

// سحب طلبٍ فُتح قبل لحظات ولم يُرفق به إيصال (فشل التخزين): يُحذف إن أمكن وإلا يُلغى ويُخفى — لا يبقى
// «بانتظار التحقق» بلا ملف بينما الصفحة تقول للعميل إن شيئاً لم يُسجَّل.
async function bankWithdraw(row) {
  try { await sb(`requests?id=eq.${row.id}`, { method: "DELETE", prefer: "return=minimal" }); return; }
  catch (e) { console.error("simple: bank withdraw delete", String((e && e.message) || e).slice(0, 80)); }
  try { await patchRequestHide(row.id, { status: "CANCELLED" }, nowIso()); } catch { /* the sweep never reminds a bank row */ }
}

// يفتح (أو يعيد) صفّ الحوالة ويُلحق به ملف الإيصال. ملف الإيصال صُدِّق عليه (validateUpload) وقُرئ وفُحص
// قبل هذه الدالة. لا يقرّر شيئاً. فشل التخزين بعد فتح طلبٍ جديد يسحبه.
export async function bankReceiptIntake({ payload, order, fp, file }) {
  if (!DB_ON) return { ok: false, status: 503, error: "db_off" };
  const ref = str(payload.ref, 40);
  let row = await bankOrderRow(ref), created = false;
  if (!row) {
    const out = await createCartRequest({ ...payload, payId: "bank_" + ref, bank: { pending: true, order, fp } });
    if (!out || !out.ok || !out.ref) return { ok: false, status: 502, error: (out && out.error) || "create_failed" };
    row = await getByRef(out.ref);
    created = !!out.created;
    if (!row) return { ok: false, status: 502, error: "create_failed" };
  }
  const all = Array.isArray(row.attachments) ? row.attachments : [];
  if (all.filter((a) => a && a.kind === "receipt").length >= 8) return { ok: false, status: 409, error: "too_many_files", row };
  const stored = await storeUpload(row, file, { kind: "receipt", by: "customer", note: "إيصال حوالة بنكية" });
  if (!stored.ok) {
    if (created) await bankWithdraw(row);
    return { ok: false, status: stored.status, error: stored.error, max: stored.max, created };
  }
  const upd = await patchRequest(row.id, { attachments: [...all, stored.rec].slice(-UPLOAD_CAP) });
  return { ok: true, row: upd || row, rec: stored.rec, created };
}

// مفاتيح تكرار الإيصال: جدول bank_receipt_keys (key نص أساسي: «f:» بصمة المحتوى · «t:» بصمة النص المستقل ·
// «r:» رقم مرجع المصرف). استعلام واحد بمفتاح أساسي، لا مسح لصفوف الطلبات. إن لم يكن الجدول موجوداً
// (الترحيل غير مطبَّق) أو فشل الاستعلام يُعاد {unavailable:true} فيفشل الفحص مغلقاً: مراجعة بشرية.
const KEY_OK = /^[ftr]:[A-Za-z0-9]{6,80}$/;
async function keyRows(keys) {
  const list = (keys || []).filter((k) => KEY_OK.test(String(k)));
  if (!list.length) return { list, rows: [] };
  return { list, rows: (await sb(`bank_receipt_keys?key=in.(${list.join(",")})&select=key,request_ref&limit=20`)) || [] };
}
export async function bankReceiptSeen({ keys, exceptRef }) {
  if (!DB_ON) return { duplicate: false, unavailable: true };
  try {
    const { rows } = await keyRows(keys);
    return { duplicate: rows.some((r) => r && r.request_ref !== exceptRef) };
  } catch { return { duplicate: false, unavailable: true }; }
}
export async function bankReceiptClaimKeys({ keys, requestRef, orderRef }) {
  if (!DB_ON) return { ok: false };
  try {
    const { list, rows } = await keyRows(keys);
    const have = new Set(rows.map((r) => r.key));
    const fresh = list.filter((k) => !have.has(k)).map((key) => ({ key, kind: key[0], request_ref: requestRef, order_ref: str(orderRef, 40), created_at: nowIso() }));
    if (fresh.length) await sb("bank_receipt_keys", { method: "POST", prefer: "return=minimal", body: fresh });
    return { ok: true };
  } catch (e) { console.error("simple: bank keys", String((e && e.message) || e).slice(0, 80)); return { ok: false }; }
}

const slimRead = (r) => (r ? {
  amount: r.amount == null ? null : round2(num(r.amount)), currency: r.currency || null, date: r.date || null,
  beneficiary: r.beneficiary ? str(r.beneficiary, 120) : null, bank: r.bank ? str(r.bank, 80) : null,
  iban: r.iban ? String(r.iban).replace(/\s/g, "").slice(0, 4) + "…" + String(r.iban).replace(/\s/g, "").slice(-4) : null,
  reference: r.reference ? str(r.reference, 60) : null, sender: r.sender ? str(r.sender, 80) : null, status: r.status ? str(r.status, 20) : null,
} : null);

// يحفظ نتيجة التحقق على الصفّ. `auto` = الوكيل الآلي وجد كل شيء مطابقاً (الاعتماد يتمّ بعدها
// في api/pay.js)؛ غير ذلك = يبقى بانتظار التحقق وتُفتح مهمة بشرية بالأسباب.
// الكتابة شرطية على أن الصفّ ما زال PAYMENT_PENDING: رفعةٌ متأخرة لا تُعيد صفّاً سُوِّي إلى REVIEW.
// وعطلٌ في مهمة الفريق أو التنبيه يُسجَّل ولا يُسقط الاستجابة بعد أن حُفظ الإيصال.
export async function bankReceiptVerdict(row, v) {
  const at = nowIso();
  const receipt = {
    at, att: v.att || "", hash: v.hash || "", text_hash: v.textHash || "", verdict: v.auto ? "match" : "review", reasons: v.reasons || [],
    checks: v.checks || {}, read: slimRead(v.read), provider: v.provider || "", source: v.source || "",
    expected: v.expected || null,
  };
  const fresh = (await getByRef(row.ref).catch(() => null)) || row;
  const payment = { ...(fresh.payment || {}), status: "REVIEW", provider: "bank", at, receipt };
  let upd = null;
  try { upd = (await sb(`requests?id=eq.${row.id}&status=eq.PAYMENT_PENDING`, { method: "PATCH", body: { payment, updated_at: nowIso() } }))[0] || null; }
  catch (e) { console.error("simple: bank verdict write", String((e && e.message) || e).slice(0, 100)); }
  if (!upd) return null;                       // settled or claimed by another request meanwhile
  await logEvent(row.id, "ai", "المستشار الذكي", "payment.receipt", { verdict: receipt.verdict, reasons: receipt.reasons, provider: receipt.provider });
  if (v.auto) return upd;
  const why = (v.reasonsAr || []).join(" · ") || "يحتاج نظراً بشرياً";
  const need = receipt.expected && receipt.expected.amount != null ? receipt.expected.amount : "—";
  const limitOnly = (v.reasons || []).length === 1 && v.reasons[0] === "above_auto_limit";
  try {
    await sweepTask(upd, {
      source: "bank-review", urgency: "high", human: true,
      title: (r) => `راجع إيصال حوالة بنكية — ${r.ref}`,
      details: () => limitOnly
        ? `الإيصال سليم وكل فحوصه نجحت، لكن المبلغ ${need} ر.س فوق حدّ الاعتماد الآلي. طابقه مع كشف الحساب البنكي، فإن وصل اضغط «تأكيد الدفع» (يصدر الفاتورة آلياً) وإلا ألغِ الطلب.`
        : `الوكيل الآلي لم يعتمد الإيصال: ${why}. المبلغ المطلوب ${need} ر.س. افتح الإيصال المرفق وتأكّد من وصول المال في كشف الحساب، ثم اضغط «تأكيد الدفع» (يصدر الفاتورة آلياً) أو ألغِ الطلب.`,
    }, "المستشار الذكي");
  } catch (e) { console.error("simple: bank review task", String((e && e.message) || e).slice(0, 100)); }
  try {
    await announce(upd, "bank-review", {
      subject: `استلمنا إيصال حوالتك — ${row.ref}`,
      clientLine: limitOnly
        ? `استلمنا إيصال حوالتك وطلبك ${row.ref} وبياناته مطابقة. ${why}. لا حاجة لإعادة التحويل، ونبلغك فور الاعتماد.`
        : `استلمنا إيصال حوالتك وطلبك ${row.ref} بانتظار التحقق. سبب المراجعة البشرية: ${why}. لا حاجة لإعادة التحويل، ونبلغك فور الاعتماد.`,
      opsLine: `إيصال حوالة بنكية يحتاج مراجعة بشرية (${why}) — المبلغ المطلوب ${need} ر.س.`,
      cta: "افتح طلبك",
    });
  } catch (e) { console.error("simple: bank review notice", String((e && e.message) || e).slice(0, 100)); }
  return upd;
}

// حجز التسوية: انتقالٌ ذرّي PAYMENT_PENDING ← WAITING_INTERNAL (تحديث شرطي على الحالة السابقة). من ربح الحجز
// وحده يسوّي ويرسل البريد؛ ستّ رفعات أو أربع ضغطات «تأكيد» متزامنة تنتج تسوية واحدة. حجزٌ عالق (انقطع
// المنفّذ) يُستردّ بعد عشر دقائق بقفل متفائل على updated_at.
export async function bankClaim(orderRef) {
  const row = await bankOrderRow(orderRef);
  if (!row) return { ok: false, error: "not_found" };
  return bankClaimRow(row);
}
export async function bankClaimRow(row) {
  const p = row.payment || {};
  if (String(p.status || "").toUpperCase() === "PAID") return { ok: true, already: true, row };
  const claimed_at = nowIso();
  const body = { status: "WAITING_INTERNAL", payment: { ...p, claimed_at }, updated_at: claimed_at };
  let rows = [];
  try {
    if (row.status === "PAYMENT_PENDING") rows = await sb(`requests?id=eq.${row.id}&status=eq.PAYMENT_PENDING`, { method: "PATCH", body });
    else if (row.status === "WAITING_INTERNAL" && p.claimed_at && Date.now() - new Date(p.claimed_at).getTime() > 10 * 60 * 1000) {
      rows = await sb(`requests?id=eq.${row.id}&status=eq.WAITING_INTERNAL&updated_at=eq.${encodeURIComponent(String(row.updated_at))}`, { method: "PATCH", body });
    }
  } catch (e) { console.error("simple: bank claim", String((e && e.message) || e).slice(0, 100)); return { ok: false, error: "claim_failed" }; }
  if (!rows || !rows[0]) return { ok: true, already: true, row };
  return { ok: true, claimed: true, row: rows[0] };
}
// تعذّرت التسوية بعد الحجز: يُعاد الصفّ إلى «بانتظار التحقق» ليعالجه إنسان أو إعادة المحاولة.
export async function bankRelease(row) {
  try { await sb(`requests?id=eq.${row.id}&status=eq.WAITING_INTERNAL`, { method: "PATCH", body: { status: "PAYMENT_PENDING", updated_at: nowIso() } }); } catch (e) { console.error("simple: bank release", String((e && e.message) || e).slice(0, 80)); }
}

// ------------------------------------------------- حوالة بنكية على عرضٍ موقّع (٤) --
// صاحب عرضٍ موقّع يدفع بحوالة من صفحة طلبه في /my بالآلية نفسها: الإيصال يُقرأ بالمدقّق نفسه (api/pay.js ←
// verifyTransfer) وبالسقف نفسه، فإن طابق كل شيء اعتُمد الدفع على الطلب نفسه بـmarkPaid (الفاتورة TEST محلياً
// والدفترة في الإنتاج)، وإلا يبقى «إيصالك قيد المراجعة» ويُفتح للفريق عمل بشري بالسبب. لا صفّ ثانٍ: الطلب نفسه.
// الملكية بالبريد وحده (بريد الجلسة = بريد الطلب)، والجواب عن «ليس لك» هو جواب «غير موجود».
export async function bankRequestPrecheck({ ref, email }) {
  if (!DB_ON) return { ok: false, status: 503, error: "db_off" };
  const row = await getByRef(str(ref, 40).toUpperCase());
  const mine = !!row && !row.deleted_at && String(row.client_email || "").toLowerCase() === String(email || "").trim().toLowerCase();
  if (!mine) return { ok: false, status: 404, error: "not_found" };
  const p = row.payment || {};
  if (String(p.status || "").toUpperCase() === "PAID" || ["PAID", "IN_PROGRESS", "COMPLETED"].includes(row.status)) return { ok: false, status: 409, error: "already_paid", row };
  if (row.status === "CANCELLED") return { ok: false, status: 409, error: "request_closed", row, message: "هذا الطلب أُلغي ولم يعد يقبل إيصالات. إن كنت حوّلت المبلغ فعلاً فراسلنا وسنراجعه معك، ولن يضيع تحويلك." };
  const total = row.quote ? round2(num(row.quote.total)) : 0;
  if (!(total > 0)) return { ok: false, status: 409, error: "no_quote", row };
  if (!["SIGNED", "PAYMENT_PENDING"].includes(row.status)) return { ok: false, status: 409, error: "not_payable", row };
  return { ok: true, row, total };
}

// يحفظ ملف الإيصال على الطلب ويضعه «بانتظار التحقق» (PAYMENT_PENDING · REVIEW · bank). لا يقرّر شيئاً.
export async function bankRequestIntake({ row, file, total }) {
  const all = Array.isArray(row.attachments) ? row.attachments : [];
  if (all.filter((a) => a && a.kind === "receipt").length >= 8) return { ok: false, status: 409, error: "too_many_files" };
  const stored = await storeUpload(row, file, { kind: "receipt", by: "customer", note: "إيصال حوالة بنكية" });
  if (!stored.ok) return { ok: false, status: stored.status, error: stored.error, max: stored.max };
  const at = nowIso();
  const payment = { ...(row.payment || {}), status: "REVIEW", provider: "bank", amount: total, expected_total: total, order_ref: row.ref, pay_ref: "bank_" + row.ref, at };
  const upd = await patchRequest(row.id, { attachments: [...all, stored.rec].slice(-UPLOAD_CAP), payment, status: "PAYMENT_PENDING" });
  return { ok: true, row: upd || row, rec: stored.rec };
}

// اعتماد الدفع على الطلب نفسه: حجزٌ ذرّي ثم markPaid (الفاتورة بمحرّك الفواتير نفسه). من ربح الحجز وحده يسوّي.
export async function bankRequestSettle(row, by) {
  // the row as it stands NOW (the verdict has just written the receipt reading onto it), not as the intake saw it
  const fresh = (await getByRef(row.ref).catch(() => null)) || row;
  const claim = await bankClaimRow(fresh);
  if (!claim.ok) return { ok: false, error: claim.error || "claim_failed" };
  if (claim.already) return { ok: true, already: true, row: claim.row || row };
  const r = claim.row, p = r.payment || {};
  const total = round2(num(r.quote && r.quote.total));
  try {
    const upd = await markPaid(r, {
      provider: "bank", payId: str(p.pay_ref, 64) || ("bank_" + r.ref), amount: total, test: false, actor: by,
      extra: { receipt: p.receipt, expected_total: total, order_ref: r.ref, pay_ref: str(p.pay_ref, 64) || ("bank_" + r.ref), confirmed_by: by },
    });
    return { ok: true, row: upd };
  } catch (e) {
    console.error("simple: bank request settle", String((e && e.message) || e).slice(0, 100));
    await bankRelease(r);
    return { ok: false, error: "settle_failed" };
  }
}

// اعتماد الدفع على صفّ فُتح بانتظار التحقق (يُستدعى من createCartRequest حين تصله دفعة bank_*).
// الانتقال إلى PAID/REVIEWING شرطيٌّ على أن الصفّ ما زال PAYMENT_PENDING أو محجوزاً (WAITING_INTERNAL):
// ما بعد الفائز لا يرسل بريداً ولا يفتح مهمة.
async function settleBankRow(row, d) {
  const payId = str(d.payId, 64);
  const p0 = row.payment || {};
  const same = () => ({ ok: true, ref: row.ref, created: false, status: row.status, documents: (row.documents || []).length });
  if (String(p0.status || "").toUpperCase() === "PAID") return same();
  const paid = round2(num(d.total)), verified = !!d.verified, at = nowIso();
  const by = str(d.bank_by || "المستشار الذكي", 80);
  const auto = by === "المستشار الذكي";
  const payment = { ...p0, status: "PAID", ref: payId, pay_ref: payId, amount: paid, total: paid, at, paid_at: at, verified, net_estimated: !(verified && d.net != null), confirmed_by: by };
  const content = verified
    ? `اعتُمد دفع حوالتك (${paid} ر.س شامل الضريبة) ${auto ? "بعد أن طابق المستشار الذكي المبلغ والمستفيد والآيبان في الإيصال" : "من فريقنا"}. تصلك فاتورتك الضريبية على بريدك، وسنبدأ التنفيذ بعد استلام المستندات المطلوبة (إن وُجدت).${auto ? " ويطابق فريقنا الحوالة مع كشف الحساب البنكي." : ""}`
    : "اعتُمد استلام حوالتك، لكن مبلغها لم يُطابَق آلياً مع الأسعار المعتمدة، فيراجعه فريقنا قبل بدء التنفيذ. لا حاجة لإعادة التحويل.";
  // «بانتظار التحقق» كانت أول ما قيل للعميل؛ بعد الاعتماد تبقى الحالة الأخيرة وحدها (لا رسالتان متناقضتان).
  const conversation = normConversation([...(row.conversation || []).filter((m) => !isBankPendingMsg(m)), { role: "bp", content, at }]);
  let upd = null;
  for (const from of ["PAYMENT_PENDING", "WAITING_INTERNAL"]) {
    const rows = await sb(`requests?id=eq.${row.id}&status=eq.${from}`, { method: "PATCH", body: { payment, status: verified ? "PAID" : "REVIEWING", conversation, updated_at: nowIso() } });
    if (rows && rows[0]) { upd = rows[0]; break; }
  }
  if (!upd) return same();                     // another request won the transition
  await logEvent(row.id, "system", auto ? "المستشار الذكي" : by, "payment.paid", { provider: "bank", payId, amount: paid, order_ref: p0.order_ref, by });
  try { await sb(`tasks?request_id=eq.${row.id}&source=eq.bank-review&status=in.(open,in_progress,blocked)`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: nowIso() } }); } catch { /* stays open; harmless */ }
  try {
    await sweepTask(upd, verified ? PLAY.PAID : {
      source: "cart-review", title: (r) => `راجع دفعة السلة — ${r.ref}`,
      details: () => `حوالة بنكية معتمدة (${paid} ر.س) لكن مبلغها لم يُطابَق مع الكتالوج. راجع البنود ثم غيّر الحالة إلى «مدفوع».`,
      human: true, urgency: "high",
    }, "النظام");
    // الإيصال مقروء بالذكاء الاصطناعي وليس إثباتاً لوصول المال: مهمة هادئة لمطابقتها بكشف الحساب.
    if (auto) await sweepTask(upd, {
      source: "bank-reconcile", urgency: "normal", human: true,
      title: (r) => `طابق الحوالة بكشف الحساب — ${r.ref}`,
      details: () => `اعتُمدت هذه الحوالة آلياً من قراءة الإيصال (${paid} ر.س). طابقها بكشف الحساب البنكي؛ فإن لم تصل فعلاً ألغِ الطلب وأوقف التنفيذ.`,
    }, "المستشار الذكي");
  } catch (e) { console.error("simple: bank settle task", String((e && e.message) || e).slice(0, 100)); }
  try {
    await announce(upd, "cart-paid", {
      subject: verified ? `اعتُمد دفعك — طلبك ${row.ref}` : `استلمنا حوالتك وطلبك قيد المراجعة — ${row.ref}`,
      clientLine: verified ? `اعتُمد دفع حوالتك (${paid} ر.س شامل الضريبة) وسجّلنا طلبك «${row.title}». نبلغك حين يبدأ التنفيذ.` : `استلمنا حوالتك (${paid} ر.س) وطلبك «${row.title}» قيد المراجعة قبل التنفيذ — لا تحوّل مرة أخرى.`,
      opsLine: `حوالة بنكية معتمدة${auto ? " آلياً" : ` (${by})`}: ${row.title} — ${paid} ر.س${verified ? "" : " ⚠️ المبلغ لم يُطابَق مع الكتالوج — راجعه"}.`,
      cta: "افتح طلبك", clientEmail: false, opsEmail: false,
    });
  } catch (e) { console.error("simple: bank announce", String((e && e.message) || e).slice(0, 100)); }
  return { ok: true, ref: row.ref, created: false, status: upd.status, documents: (row.documents || []).length };
}

// ------------------------------------------------------- support hub (widget) --
// مركز التواصل العائم (site/scripts/baher-support.mjs) يحتاج شيئين من الخادم:
//   support-track          أين طلبي؟ — بمرجعٍ BP-R-… أو BP-TKT-…
//   support-ticket-create  افتح تذكرة — برقمٍ يظهر في /my ويصل المالك إشعاره
//
// لا جدول جديد ولا نظام موازٍ: التذكرة صفٌّ في `requests` نفسه الذي تعرضه /my
// وتردّ عليه اللوحة (ops-request-message) وتنبّه عنه alertOps. علامتها بادئة
// المرجع `BP-TKT-` (كما أن علامة الشراء المباشر payment.source="cart")، فلا عمود
// ولا قيد جديد في db/schema.sql.
//
// من يرى ماذا (قاعدة المالك: لا كشف لبيانات غير صاحبها):
//   • بجلسة: طلبات حسابه هو فقط (ownedBy)، بملخّص بلا مبالغ ولا بيانات اتصال.
//   • بلا جلسة: لا شيء إلا بمرجعٍ **و** بريدٍ يطابق بريد الطلب، والخارج منه
//     حالةٌ وعنوان وتاريخ فقط. الخطأ في أيٍّ منهما يردّ بالجواب نفسه تماماً
//     (لا «المرجع موجود لكن البريد خطأ») فلا يُستعمل التتبّع لتخمين المراجع.
//   • بريدٌ وحده بلا جلسة: لا يُعرض شيء — يُدعى إلى الدخول.
const TICKET_PREFIX = "BP-TKT-";
const isTicketRow = (r) => !!(r && String(r.ref || "").startsWith(TICKET_PREFIX));
const TICKET_CATS = { order: "طلب قائم", payment: "الدفع والفواتير", account: "الحساب والدخول", info: "استفسار", other: "أخرى" };
const SUPPORT_REF_RE = /^BP-(?:R|TKT)-[0-9A-Z]{6}$/;
const ticketRef = () => TICKET_PREFIX + crypto.randomBytes(3).toString("hex").toUpperCase();

// A small in-process brake. Serverless instances do not share it, so it is a
// speed bump for a script hammering one instance, not a quota.
const _supportHits = new Map();
function supportThrottle(key, max, windowMs) {
  const now = Date.now();
  const arr = (_supportHits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { _supportHits.set(key, arr); return false; }
  arr.push(now); _supportHits.set(key, arr);
  if (_supportHits.size > 4000) for (const [k, v] of _supportHits) if (!v.length || now - v[v.length - 1] > windowMs) _supportHits.delete(k);
  return true;
}

function supportTrackView(r, full) {
  const view = { ref: r.ref, kind: isTicketRow(r) ? "ticket" : "request", title: r.title, status: r.status, created_at: r.created_at, updated_at: r.updated_at || r.created_at };
  if (!full) return view;
  const lastBp = [...(r.conversation || [])].reverse().find((m) => m && m.role === "bp");
  return {
    ...view,
    quote: r.quote ? { number: r.quote.number, status: r.quote.status } : null,
    contract: r.contract ? { number: r.contract.number, status: r.contract.status } : null,
    payment: r.payment ? { status: r.payment.status } : null,
    appointment: r.appointment && r.appointment.status !== "CANCELLED" ? { date: r.appointment.date, time: r.appointment.time } : null,
    last_team_message: lastBp ? { content: String(lastBp.content || "").slice(0, 200), at: lastBp.at } : null,
  };
}

async function supportAction(action, b, qs, req, res, sess) {
  const ip = clientIp(req) || "local";

  if (action === "support-track") {
    if (!supportThrottle("track:" + ip, 20, 10 * 60e3)) return json(res, 429, { ok: false, error: "slow_down" });
    const ref = str(b.ref, 40).toUpperCase().replace(/\s+/g, "");
    const email = str(b.email, 160).toLowerCase();
    if (!ref) {
      if (!sess) return json(res, 200, { ok: true, needLogin: true });
      const mine = await myRequests(sess);
      return json(res, 200, { ok: true, mine: mine.slice(0, 5).map((r) => supportTrackView(r, true)), total: mine.length });
    }
    // One shape for «no such reference» and «not yours»: see the header.
    const none = () => json(res, 200, { ok: true, found: false });
    if (!SUPPORT_REF_RE.test(ref)) return none();
    const row = await getByRef(ref);
    if (!row || row.deleted_at) return none();
    if (sess && ownedBy(row, sess)) return json(res, 200, { ok: true, found: true, verified: "session", item: supportTrackView(row, true) });
    if (isEmail(email) && String(row.client_email || "").toLowerCase() === email) {
      return json(res, 200, { ok: true, found: true, verified: "email", item: supportTrackView(row, false) });
    }
    return none();
  }

  if (action === "support-ticket-create") {
    // A bot fills every field it can see; a person never sees this one.
    if (str(b.hp, 20)) return json(res, 200, { ok: true, ref: ticketRef(), linked: false });
    if (!supportThrottle("ticket:" + ip, 6, 60 * 60e3)) return json(res, 429, { ok: false, error: "slow_down" });
    const subject = str(b.subject, 160);
    const details = str(b.details, 3000);
    if (subject.length < 3 || details.length < 5) return json(res, 400, { ok: false, error: "invalid_fields" });
    const lang = ["ar", "en", "fr", "zh"].includes(b.lang) ? b.lang : "ar";
    const category = TICKET_CATS[b.category] ? b.category : "other";
    const user = sess && sess.user ? sess.user : null;
    const name = str(user ? (user.full_name || user.email) : b.name, 160);
    const email = String(user ? user.email : str(b.email, 160)).toLowerCase();
    const phone = str(b.phone, 40);
    if (!user) {
      // Someone must be reachable: a name and at least one way back.
      if (name.length < 2 || !(isEmail(email) || /^(?:\+?966|0)?5\d{8}$/.test(phone.replace(/\s/g, "")))) return json(res, 400, { ok: false, error: "contact_required" });
      if (isEmail(email) && !supportThrottle("ticket-mail:" + email, 5, 24 * 3600e3)) return json(res, 429, { ok: false, error: "slow_down" });
    }
    const related = str(b.related_ref, 40).toUpperCase();
    const page = str(b.page, 200);
    const convo = (Array.isArray(b.convo) ? b.convo : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10).map((m) => `${m.role === "user" ? "الزائر" : "المستشار"}: ${m.content.slice(0, 300)}`).join("\n");

    let ref = ticketRef();
    for (let i = 0; i < 4 && (await getByRef(ref)); i++) ref = ticketRef();
    const now = nowIso();
    const row = {
      ref, organization_id: sess && sess.organization ? sess.organization.id : null, user_id: user ? user.id : null,
      type: "CONSULTATION", source: "WEBSITE", status: "NEW", lang,
      title: `تذكرة: ${subject}`.slice(0, 200),
      summary: details,
      conversation: [{ role: "user", content: details, at: now }],
      scope: [], documents: [],
      client_name: name, client_email: isEmail(email) ? email : null, client_phone: phone,
      company_name: str(sess && sess.organization ? (sess.organization.name_ar || sess.organization.name_en) : "", 200),
      internal_notes: [
        `تذكرة دعم من مركز التواصل · القسم: ${TICKET_CATS[category]}`,
        related && SUPPORT_REF_RE.test(related) ? `متعلّقة بالطلب: ${related}` : "",
        page ? `الصفحة: ${page}` : "",
        convo ? `المحادثة قبل التذكرة:\n${convo}` : "",
      ].filter(Boolean).join("\n").slice(0, 2000),
    };
    const rows = await sb("requests", { method: "POST", body: [row] });
    const created = rows[0];
    await logEvent(created.id, "customer", name || email || "زائر", "request.created", { kind: "support-ticket", category, related: related || undefined });
    // The team: mail + WhatsApp to the owner and one open «reply» task, deduped
    // by alertOps (the same door the customer's in-request messages use).
    await alertOps(created, "ticket-new", {
      subject: `تذكرة دعم جديدة ${ref}`,
      line: `${name || email || "زائر"} فتح تذكرة «${subject}» (${TICKET_CATS[category]}): ${details.slice(0, 160)}`,
      task: { source: "support-ticket", urgency: "high", title: `ردّ على تذكرة الدعم ${ref}`, details: `${TICKET_CATS[category]} — ${details.slice(0, 360)}` },
    });
    // The customer: the number, and where it lives. No promise of a time.
    const ar = lang === "ar";
    await announce(created, "ticket-open", {
      subject: ar ? `استلمنا تذكرتك ${ref}` : `We received your ticket ${ref}`,
      clientLine: ar ? `استلمنا تذكرتك ${ref} «${subject}». سيردّ عليك الفريق ضمن ساعات الدوام، وتجد الرد في حسابك.` : `We received your ticket ${ref} “${subject}”. The team will reply during working hours, and you will find the reply in your account.`,
      cta: ar ? "فتح التذكرة" : "Open the ticket", to: "client",
    });
    return json(res, 200, { ok: true, ref, signedIn: !!user, linked: !!created.client_email });
  }

  return json(res, 400, { ok: false, error: "unknown_action" });
}

// ---------------------------------------------- the cart's invoice, on its row --
// The request a paid cart opened is where its tax invoice lives (`invoice`), so
// «الفواتير» in /my lists it like any other. This finds that row from the payment
// — the same derivation createCartRequest uses — and hands the invoice engine
// what it needs. Null when there is no row (database off, or the request failed
// to open and the owner was already told): the engine then works in memory only.
export async function invoiceTargetFor(payId, orderRef) {
  if (!DB_ON) return null;
  const want = String(payId || orderRef || "");
  if (!want) return null;
  try {
    for (let salt = 0; salt < 3; salt++) {
      const hit = await getByRef(cartRequestRef(want, salt));
      if (!hit) return null;
      const p = hit.payment || {};
      if (p.source === "cart" && (p.pay_ref || p.order_ref) === want) return { ...invoiceTarget(hit), invoice: hit.invoice || null };
    }
  } catch { /* no row to attach to */ }
  return null;
}

// محلياً وفي وضع الاختبار بلا مفتاح الدفترة: دفعة السلة المعتمدة (حوالةً كانت أو بطاقة) تأخذ السجلّ الداخلي
// TEST-INV- نفسه الذي يأخذه الطلب المسعَّر في markPaid، بدل أن تبقى مدفوعةً بلا فاتورة (daftra_not_configured).
// في الإنتاج SIMPLE_TEST_MODE مطفأ فلا يُصنع رقمٌ مختلق: إما الدفترة أو لا شيء ويُنبَّه المالك (المحرّك).
export async function testInvoiceForPayment(payId, orderRef) {
  if (!DB_ON || !SIMPLE_TEST_MODE) return null;
  const want = String(payId || orderRef || "");
  if (!want) return null;
  let hit = null;
  try {
    for (let salt = 0; salt < 3; salt++) {
      const h = await getByRef(cartRequestRef(want, salt));
      if (!h) break;
      const hp = h.payment || {};
      if (hp.source === "cart" && (hp.pay_ref || hp.order_ref) === want) { hit = h; break; }
    }
  } catch { return null; }
  if (!hit) return null;
  if (invoiceIsComplete(hit.invoice)) return { invoiced: true, already: true, number: hit.invoice.number, total: hit.invoice.total };
  const p = hit.payment || {};
  if (String(p.status || "").toUpperCase() !== "PAID") return null;
  const total = round2(num(p.total || p.amount));
  const invoice = {
    number: "TEST-INV-" + hit.ref.replace(/^BP-R-/, ""), issued_at: nowIso(), mode: "test",
    net: round2(num(p.net)), vat: round2(num(p.vat)), total, currency: "SAR", vat_rate: 15,
    items: (Array.isArray(p.items) ? p.items : []).map((i) => ({ title: str(i.name, 140), qty: i.qty || 1, price: i.unit == null ? i.amount : i.unit, line: i.amount })),
    bill_to: { name: hit.client_name, company: hit.company_name, email: hit.client_email },
    daftra: { issued: false, reason: "daftra_not_configured" },
  };
  await patchRequest(hit.id, { invoice });
  await logEvent(hit.id, "system", "TEST MODE", "invoice.issued", { number: invoice.number, total });
  return { invoiced: true, test: true, number: invoice.number, total };
}

// Re-run every invoice that was left unfinished (Daftra was down, the mail was
// refused, the function died mid-way) once its back-off has passed. `ref` + `force`
// is the owner's «أعد المحاولة»: one request, now, whatever the back-off says.
export async function retryPendingInvoices({ limit = 200, force = false, ref = "" } = {}) {
  const rows = await sb(`requests?${ref ? `ref=eq.${q(ref)}` : "invoice=not.is.null"}&select=*&order=updated_at.desc&limit=${limit}`);
  const out = { scanned: rows.length, retried: 0, issued: 0, failed: 0, skipped: [], details: [] };
  for (const row of rows) {
    const rec = row.invoice;
    const forced = force && !!ref;
    // A paid request that never got a record at all (the owner forcing a retry).
    const orphan = forced && !rec && row.quote && row.payment && row.payment.status === "PAID" && !row.payment.test;
    if (!orphan && !invoiceRetryDue(rec, Date.now(), forced)) continue;
    const draft = (rec && rec.draft) || (row.quote ? invoiceDraftForRequest(row, row.payment || {}) : null);
    if (!draft) { out.skipped.push({ ref: row.ref, reason: "no_draft" }); continue; }
    out.retried++;
    const r = await issuePaidInvoice({ key: draft.payId || row.ref, draft, target: invoiceTarget(row), force: forced });
    if (r.invoiced) out.issued++; else if (r.reason !== "already_settled") out.failed++;
    out.details.push({ ref: row.ref, invoiced: !!r.invoiced, emailed: !!r.clientEmailed, reason: r.reason || null });
  }
  return out;
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
// db/schema.sql: tasks.urgency accepts urgent / soon / normal only, while this file's plays say «high»
// (and tasks.priority takes high). One translation here, so a check constraint can never turn a bank
// review into a 500 after the customer's receipt was already saved.
const taskUrgency = (u) => (u === "high" ? "urgent" : ["urgent", "soon", "normal"].includes(u) ? u : "normal");
async function sweepTask(row, play, actor) {
  const open = await sb(`tasks?request_id=eq.${row.id}&source=eq.${q(play.source)}&status=in.(open,in_progress,blocked)&select=id&limit=1`);
  if (open && open[0]) return false;
  await sb("tasks", { method: "POST", prefer: "return=minimal", body: [{
    organization_id: row.organization_id || await fallbackOrg(),
    title: play.title(row), details: play.details(row),
    assignee: "bp", source: play.source, status: "open",
    urgency: taskUrgency(play.urgency), priority: play.urgency === "high" || play.urgency === "urgent" ? "high" : "normal",
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
    // Approved, and still without its contract: the contract is automatic now, so
    // the sweep issues it instead of opening a «جهّز العقد» task for the owner.
    if (row.status === "QUOTE_APPROVED" && !row.contract && !isCartRow(row)) {
      if (!dry) { try { const full = await getByRef(row.ref); if (full && !full.deleted_at) await ensureContract(full); } catch (e) { console.error("sweep contract", String(e && e.message || e).slice(0, 100)); } }
      continue;
    }
    // A paid cart request held for review already has its own task; the
    // «pricing» play would tell the team to quote something already bought.
    if (row.status === "REVIEWING" && isCartRow(row)) continue;
    // حوالة السلة بانتظار التحقق ليست «دفعاً لم يكتمل»: العميل حوّل ورفع الإيصال، ولها مهمتها
    // البشرية (bank-review). التذكير «أعد المحاولة من حسابك» كان سيطلب منه التحويل مرة ثانية.
    if (row.status === "PAYMENT_PENDING" && isCartRow(row) && row.payment && row.payment.provider === "bank") continue;
    // A support ticket is not a quotation: the «pricing» play would tell the
    // team to price a scope that does not exist, and the «new request» play
    // would open a second task beside the one the ticket opened itself.
    if (isTicketRow(row) && (row.status === "NEW" || row.status === "REVIEWING")) continue;
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
  const isSales = !!(opsUser && opsUser.role === "sales");
  // The sales role is an allowlist, checked before anything else runs: an action
  // that is not listed is refused here, whatever it would have done below.
  if (isSales && !SALES_ACTIONS.has(action)) return json(res, 403, { ok: false, error: "forbidden_role", role: "sales" });
  // A sales member is named by e-mail in the audit trail (a display name can be
  // edited by its owner; the address is what was authenticated).
  const actor = isSales ? opsUser.email : (opsUser && (opsUser.name || opsUser.email)) || str(b.actor || qs.actor, 80) || "المالك";

  if (action === "ops-summary") {
    const SUMMARY_COLS = "ref,type,source,status,title,created_at,updated_at,quote,payment,invoice,appointment,client_name,company_name,assigned_to";
    const all = await sbLive(`requests?select=${SUMMARY_COLS},deleted_at&order=created_at.desc&limit=500`);
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

  if (action === "ops-requests" && isSales) {
    // Only the clients tagged for sales; the SQL narrows, the predicate decides.
    const rows = await sb(`requests?select=*&or=(assigned_to.ilike.${SALES_TAG},assigned_to.ilike.${q(opsUser.email)})&order=updated_at.desc&limit=300`);
    return json(res, 200, { ok: true, role: "sales", requests: rows.filter((r) => inSalesScope(r, opsUser.email)).map(salesListRow) });
  }

  if (action === "ops-requests") {
    const status = str(b.status || qs.status, 30);
    const type = str(b.type || qs.type, 30);
    const search = str(b.q || qs.q, 80);
    let path = "requests?select=*&order=updated_at.desc&limit=300";
    if (status && REQUEST_STATUSES.includes(status)) path += `&status=eq.${status}`;
    if (type && REQUEST_TYPES.includes(type)) path += `&type=eq.${type}`;
    if (search) path += `&or=(ref.ilike.*${q(search)}*,title.ilike.*${q(search)}*,client_name.ilike.*${q(search)}*,company_name.ilike.*${q(search)}*,client_email.ilike.*${q(search)}*)`;
    const rows = await sbLive(path);
    return json(res, 200, { ok: true, requests: rows.map(summary) });
  }

  // «المحذوفة»: requests the customer cancelled before any signature or payment
  // and that were hidden from him (request-cancel). For audit only — read-only,
  // nothing is erased and nothing here can be changed; the sales role never
  // reaches it (it is not in SALES_ACTIONS). If the column is not on the database
  // yet there is simply nothing hidden to list.
  if (action === "ops-deleted") {
    let rows = [];
    try {
      rows = await sb("requests?select=ref,type,source,status,title,client_name,client_email,client_phone,company_name,created_at,updated_at,deleted_at,cancel,quote,contract,payment,invoice&deleted_at=gte.2000-01-01&order=deleted_at.desc&limit=300");
    } catch { rows = []; }
    return json(res, 200, { ok: true, deleted: rows.filter((r) => r.deleted_at).map((r) => ({
      ref: r.ref, type: r.type, source: r.source, title: r.title, status: r.status,
      client_name: r.client_name, company_name: r.company_name, client_email: r.client_email, client_phone: r.client_phone,
      created_at: r.created_at, deleted_at: r.deleted_at,
      stage: (r.cancel && r.cancel.stage) || "", by: (r.cancel && r.cancel.by) || "", note: (r.cancel && r.cancel.note) || "",
      quote_total: r.quote ? r.quote.total : null,
      // a row that has either of these should never be here; shown so an audit would catch it
      signed: !!(r.contract && r.contract.status === "SIGNED"), paid: moneyReceived(r),
    })) });
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
      sbLive("requests?select=ref,title,status,source,type,conversation,client_name,client_email,client_phone,company_name,updated_at,assigned_to,deleted_at&order=updated_at.desc&limit=200"),
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
    // Paid but not yet invoiced (or invoiced but not delivered): try again now
    // that the back-off has passed. A scheduler hitting this endpoint is what
    // makes the retry automatic.
    let invoices = null;
    if (b.dry !== true) { try { invoices = await retryPendingInvoices({ limit: 200 }); } catch (e) { invoices = { error: String(e && e.message || e).slice(0, 80) }; } }
    return json(res, 200, { ok: true, ...out, ...(invoices ? { invoices } : {}) });
  }

  // The owner's «أعد محاولة الفاتورة» for one request: now, whatever the back-off
  // says. Safe to press twice — an invoice that already went out is reported, not
  // issued again.
  if (action === "ops-invoice-retry") {
    const ref = str(b.ref || qs.ref, 40);
    if (!ref) return json(res, 400, { ok: false, error: "bad_ref" });
    const out = await retryPendingInvoices({ ref, force: true, limit: 1 });
    const row = await getByRef(ref);
    return json(res, 200, { ok: true, ...out, invoice: row ? row.invoice || null : null });
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
  // For a sales member a missing request and somebody else's are the same
  // answer: 403 tells him nothing about which references exist.
  if (isSales && !(row && inSalesScope(row, opsUser.email))) return json(res, 403, { ok: false, error: "forbidden_scope" });
  if (!row) return json(res, 404, { ok: false, error: "not_found" });

  if (action === "ops-request" && isSales) {
    return json(res, 200, { ok: true, role: "sales", request: salesRequestView(row, await eventsFor(row.id, 200)) });
  }

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
    const rejectedItems = row.quote && row.quote.status === "REJECTED" && Array.isArray(row.quote.items) ? row.quote.items : [];
    // سعر الكتالوج بالرمز يُعرض للفريق في حقل السعر قبل الإصدار (كان الحقل فارغاً والمجموع
    // «٠» حتى لبندٍ سعره ثابت). هو المرجع لا القرار: يُعدَّل بيد الفريق، وبندٌ بلا سعر في
    // الكتالوج يبقى فارغاً (لا يصدر عرضٌ به — issueQuote).
    let priceBook = null;
    try { priceBook = await loadPriceBook(); } catch {}
    const scope = (row.scope || []).map((it) => {
      if (it.price != null) return it;
      const was = rejectedItems.length ? (rejectedItems.find((l) => it.code && l.code && String(l.code).toUpperCase() === String(it.code).toUpperCase()) || rejectedItems.find((l) => l.title === it.title)) : null;
      if (was && was.price != null) return { ...it, price: was.price };
      const ref = priceBook && it.code ? referencePrice(priceBook, it.code) : null;
      return ref != null ? { ...it, price: ref } : it;
    });
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, request: { ...row, scope, attachments, contract: row.contract ? { ...row.contract, html: undefined, has_html: !!row.contract.html } : null, nda: row.nda ? { ...row.nda, html: undefined, has_html: !!row.nda.html } : null, events, tasks } });
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

  // Lines that waited for a price are quoted as an ADDENDUM once the main quotation is approved:
  // a new number (Q-…-A1), its own total and validity; the approved quotation stays as it is.
  // While the quotation is still open (QUOTE_SENT) the team re-issues it whole with ops-quote.
  if (action === "ops-quote-addendum") {
    if (!row.quote || !["QUOTE_APPROVED", "CONTRACT_SENT", "SIGNED", "PAYMENT_PENDING", "PAID", "IN_PROGRESS", "WAITING_INTERNAL"].includes(row.status)) return json(res, 409, { ok: false, error: row.quote && row.status === "QUOTE_SENT" ? "use_ops_quote" : "no_approved_quote" });
    const pend = Array.isArray(row.quote.pending_items) ? row.quote.pending_items : [];
    if (!pend.length) return json(res, 409, { ok: false, error: "nothing_pending" });
    const given = Array.isArray(b.items) ? b.items : [];
    const lines = [], covered = new Set();
    for (const g of given) {
      const hit = pend.find((x) => !covered.has(x.title) && (x.title === str(g.pending_title || g.title, 200) || (g.code && x.code && String(x.code).toUpperCase() === String(g.code).toUpperCase())));
      if (!hit) return json(res, 400, { ok: false, error: "not_pending", message: `«${str(g.title, 80)}» ليس من البنود المنتظرة.` });
      if (!(num(g.price) > 0)) return json(res, 400, { ok: false, error: "unpriced_items", unpriced: [hit.title], message: `اكتب سعراً أكبر من صفر لـ«${hit.title}».` });
      covered.add(hit.title);
      lines.push({ code: hit.code, title: str(g.title, 200) || hit.title, description: str(g.description, 600), qty: g.qty || hit.qty, price: num(g.price) });
    }
    if (!lines.length) return json(res, 400, { ok: false, error: "no_items" });
    const prior = Array.isArray(row.quote.addenda) ? row.quote.addenda : [];
    const base = String(row.quote.number || "").replace(/-A\d+$/, "");
    const addendum = { number: `${base}-A${prior.length + 1}`, status: "SENT", created_at: nowIso(), sent_at: nowIso(), covers: [...covered], ...computeQuote(lines, b) };
    const left = pend.filter((x) => !covered.has(x.title));
    const quote = { ...row.quote, addenda: [...prior, addendum] };
    if (left.length) quote.pending_items = left; else delete quote.pending_items;
    const scope = (row.scope || []).map((it) => (covered.has(it.title) ? (({ hold, ...r }) => r)(it) : it));
    await patchRequest(row.id, { quote, scope });
    await logEvent(row.id, "human", actor, "addendum.sent", { number: addendum.number, total: addendum.total });
    if (!left.length) { try { await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&status=in.(open,in_progress,blocked)`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: nowIso() } }); } catch {} }
    await announce(row, "addendum", {
      subject: `ملحق عرض السعر ${addendum.number} — ${row.title}`,
      clientLine: `سُعّرت بنودٌ كانت بانتظار التسعير. ملحق عرضك ${addendum.number}: ${addendum.total} ر.س شامل الضريبة. عرضك الأصلي وعقده لم يتغيّرا. راجع الملحق واعتمده من حسابك.`,
      opsLine: `صدر ملحق العرض ${addendum.number} بإجمالي ${addendum.total} ر.س.`,
      cta: "راجع الملحق واعتمده",
    });
    return json(res, 200, { ok: true, addendum, pending_left: left.length });
  }

  if (action === "ops-contract") {
    if (!row.quote || !["QUOTE_APPROVED", "CONTRACT_SENT"].includes(row.status)) return json(res, 409, { ok: false, error: "quote_not_approved" });
    const issued = await issueContract(row, "human", actor, b);
    return json(res, 200, { ok: true, status: issued.status, contract: { ...issued.contract, html: undefined } });
  }


  // «إصدار اتفاقية عدم إفصاح»: optional, one request at a time. An unsigned one is replaced
  // (the party details may have been corrected); a signed one is final.
  if (action === "ops-nda") {
    if (["CANCELLED", "COMPLETED"].includes(row.status)) return json(res, 409, { ok: false, error: "request_closed" });
    let out;
    try {
      out = await issueNda(row, "human", actor, { clientRegNo: b.client_reg_no, clientAddress: b.client_address, clientCountry: b.client_country, signatory: { name: b.signatory_name, title: b.signatory_title }, ...(b.lang === "en" || b.lang === "ar" ? { lang: b.lang } : {}) });
    } catch (e) { return json(res, 500, { ok: false, error: "nda_build_failed" }); }
    if (!out.ok) return json(res, out.error === "nda_signed" ? 409 : 503, out);
    return json(res, 200, { ok: true, nda: { ...out.nda, html: undefined } });
  }

  if (action === "ops-nda-html") {
    if (!row.nda || !row.nda.html) return json(res, 404, { ok: false, error: "no_nda" });
    return json(res, 200, { ok: true, html: portalContractHtml(row.nda.html, { signature: row.nda.signature, signedAt: row.nda.signed_at }), nda: { ...row.nda, html: undefined } });
  }

  if (action === "ops-contract-html") {
    if (!row.contract || !row.contract.html) return json(res, 404, { ok: false, error: "no_contract" });
    // اللوحة تقرأ ما يقرأه العميل — بما فيه النسخة المصحَّحة — وتُنبَّه إن
    // كان العقد قد صُحِّح بعد التوقيع فيحتاج توقيعاً جديداً.
    return json(res, 200, { ok: true, html: portalContractHtml(row.contract.html, { signature: row.contract.signature, signedAt: row.contract.signed_at, stale: !!row.contract.needs_resign }), needsResign: !!row.contract.needs_resign, correctedAt: row.contract.corrected_at || "" });
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
      clientLine: `ألغينا الطلب.${note ? ` السبب: ${note}` : ""}${wasPaid ? " وبما أنّ الطلب كان مدفوعاً، يراجع الفريق الدفعة ويتواصل معك بشأنها؛ لا نَعِد هنا بمبلغ أو بمدة قبل اكتمال المراجعة." : ""} إن كان لديك استفسار راسلنا وسنساعدك.`,
      opsLine: `${actor} ألغى الطلب من مرحلة «${stageAr(row.status)}».${wasPaid ? " ⚠️ الطلب مدفوع — الاسترداد قرارٌ منفصل لم يُنفَّذ." : ""}`,
    });
    return json(res, 200, { ok: true, status: "CANCELLED", wasPaid: !!wasPaid, refundPending: !!wasPaid });
  }

  // التراجع عن الإلغاء: الأخطاء تقع، وطلبٌ أُلغي بالخطأ يجب أن يعود بلا
  // إعادة إنشاء تفقد تاريخه كله.
  if (action === "ops-reopen") {
    if (row.status !== "CANCELLED") return json(res, 409, { ok: false, error: "not_cancelled" });
    const back = REQUEST_STATUSES.includes(str(b.status, 40)) ? str(b.status, 40)
      : (row.cancel && REQUEST_STATUSES.includes(row.cancel.stage) ? row.cancel.stage : "REVIEWING");
    const reopen = { status: back, cancel: null, cancel_request: null };
    let upd;
    // a request that had been hidden from the customer comes back to him with it
    if (row.deleted_at) { try { upd = await patchRequest(row.id, { ...reopen, deleted_at: null }); } catch { upd = null; } }
    if (!upd) upd = await patchRequest(row.id, reopen);
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
    const built = buildContract(row, { lead_time: str(b.lead_time, 120), executor: str(b.executor, 120), template_version: (row.contract && row.contract.build && row.contract.build.template_version) || "v1", company: row.contract && row.contract.build && row.contract.build.company });
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
    // حوالة سلة بانتظار التحقق (لا عرض سعر لها): التسوية والفاتورة تعيشان في api/pay.js، فيُنادى
    // بالرمز الذي لا يوقّعه إلا هذا الخادم بعد مفتاح اللوحة. تؤدي المسار نفسه الذي يسلكه الاعتماد الآلي.
    if (!row.quote && isCartRow(row) && row.payment && row.payment.provider === "bank") {
      if (String(row.payment.status || "").toUpperCase() === "PAID") return json(res, 409, { ok: false, error: "already_paid" });
      const t = signBankToken({ ref: row.ref, orderRef: row.payment.order_ref, actor, amount: b.amount == null || b.amount === "" ? null : num(b.amount) });
      if (!t) return json(res, 503, { ok: false, error: "not_configured" });
      let j = {}, st = 0;
      try {
        const r = await fetch(`${SELF_BASE}/api/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "bank-approve", t }) });
        st = r.status; j = await r.json().catch(() => ({}));
      } catch (e) { console.error("simple: bank-approve call", String((e && e.message) || e).slice(0, 120)); }
      if (!j.ok) return json(res, st && st !== 200 ? st : 502, { ok: false, error: j.error || "approve_failed" });
      const after = (await getByRef(row.ref)) || row;
      if (j.already) return json(res, 200, { ok: true, already: true, status: after.status, payment: after.payment, invoice: after.invoice });
      await logEvent(row.id, "human", actor, "payment.confirmed.bank", { provider: "bank" });
      return json(res, 200, { ok: true, status: after.status, payment: after.payment, invoice: after.invoice });
    }
    if (!row.quote) return json(res, 409, { ok: false, error: "no_quote" });
    const upd = await markPaid(row, { provider: str(b.provider, 40) || (row.payment && row.payment.provider === "bank" ? "bank" : "bank_transfer"), payId: str(b.reference, 80) || ("manual_" + Date.now()), amount: row.quote.total, test: SIMPLE_TEST_MODE && b.test !== false, actor,
      ...(row.payment && row.payment.receipt ? { extra: { receipt: row.payment.receipt, expected_total: row.payment.expected_total, confirmed_by: actor } } : {}) });
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

  // ---- stages & team updates -------------------------------------------------
  // Guarded like every ops-* action (opsOk: the owner's session or the panel
  // key). Each change is written to the INTERNAL event log. Nothing here mails
  // or messages the customer except ops-update-publish, which is the human
  // «publish to the customer» press; stages move silently.
  if (/^ops-(stages-init|stage-set|update-(add|edit|publish|unpublish|delete))$/.test(action)) {
    if (row.status === "CANCELLED") return json(res, 409, { ok: false, error: "request_closed" });
    const curStages = Array.isArray(row.stages) ? row.stages : [];
    const curUpdates = Array.isArray(row.updates) ? row.updates : [];

    if (action === "ops-stages-init") {
      if (curStages.length && b.replace !== true) return json(res, 409, { ok: false, error: "already_has_stages", stages: curStages });
      const tpl = b.template == null || b.template === "" ? "sales" : str(b.template, 20);
      let base;
      if (Array.isArray(b.stages)) base = normStages(b.stages);
      else if (STAGE_TEMPLATES[tpl]) base = normStages(STAGE_TEMPLATES[tpl]);
      else if (tpl === "blank") base = [];
      else return json(res, 400, { ok: false, error: "unknown_template", templates: Object.keys(STAGE_TEMPLATES) });
      if (!base.length) return json(res, 400, { ok: false, error: "no_stages" });
      const derived = autoStages({ ...row, stages: base }) || { stages: base };
      await patchRequest(row.id, { stages: derived.stages });
      await logEvent(row.id, "internal", actor, "stages.init", { template: Array.isArray(b.stages) ? "custom" : tpl, count: derived.stages.length });
      return json(res, 200, { ok: true, stages: derived.stages });
    }

    if (action === "ops-stage-set") {
      const key = stageKey(b.stage);
      if (!key) return json(res, 400, { ok: false, error: "missing_stage" });
      const stages = curStages.map((x) => ({ ...x }));
      const i = stages.findIndex((x) => x.key === key);
      if (b.remove === true) {
        if (i < 0) return json(res, 404, { ok: false, error: "stage_not_found" });
        stages.splice(i, 1);
        await patchRequest(row.id, { stages });
        await logEvent(row.id, "internal", actor, "stage.removed", { key });
        return json(res, 200, { ok: true, stages });
      }
      if (b.status != null && !STAGE_STATUSES.includes(b.status)) return json(res, 400, { ok: false, error: "bad_status", statuses: STAGE_STATUSES });
      let st;
      if (i >= 0) st = stages[i];
      else {
        const title_ar = str(b.title_ar, 120);
        if (!title_ar) return json(res, 404, { ok: false, error: "stage_not_found", message: "مرحلة جديدة تحتاج title_ar." });
        if (stages.length >= MAX_STAGES) return json(res, 409, { ok: false, error: "too_many_stages" });
        st = { key, title_ar, title_en: "", status: "pending", at: "", note: "" };
        const after = stages.findIndex((x) => x.key === stageKey(b.after));
        stages.splice(after >= 0 ? after + 1 : stages.length, 0, st);
      }
      const before = st.status;
      if (b.title_ar != null && str(b.title_ar, 120)) st.title_ar = str(b.title_ar, 120);
      if (b.title_en != null) st.title_en = str(b.title_en, 120);
      if (b.note != null) st.note = str(b.note, 300);
      if (b.status != null && b.status !== before) { st.status = b.status; st.at = nowIso(); }
      await patchRequest(row.id, { stages });
      await logEvent(row.id, "internal", actor, "stage.set", { key, from: before, to: st.status });
      return json(res, 200, { ok: true, stages });
    }

    // ---- updates
    const textAr = str(b.text_ar, 2000), textEn = str(b.text_en, 2000);
    const find = () => curUpdates.findIndex((u) => u && u.id === str(b.id, 40));

    // One place publishes, so «add and publish» and «publish a draft» cannot
    // differ: flag + time, the internal log, then (unless the panel says
    // notify:false) the same customer notice every other step uses.
    const publish = async (updates, idx) => {
      const u = { ...updates[idx], published: true, published_at: nowIso() };
      updates[idx] = u;
      const upd = await patchRequest(row.id, { updates });
      await logEvent(row.id, "internal", actor, "update.published", { id: u.id });
      if (b.notify !== false) {
        const body = (row.lang === "ar" || !u.text_en ? u.text_ar : u.text_en) || u.text_ar || u.text_en;
        await announce({ ...row, ...upd }, "update", {
          subject: `تحديث على طلبك — ${row.ref}`,
          clientLine: String(body).slice(0, 300),
          cta: "افتح التحديثات", to: "client",
        });
      }
      return u;
    };

    if (action === "ops-update-add") {
      if (!textAr) return json(res, 400, { ok: false, error: "missing_text" });
      if (curUpdates.length >= MAX_UPDATES) return json(res, 409, { ok: false, error: "too_many_updates" });
      const u = { id: crypto.randomBytes(6).toString("hex"), at: nowIso(), by: str(actor, 80), text_ar: textAr, text_en: textEn, published: false, published_at: "" };
      const updates = [...curUpdates, u];
      await patchRequest(row.id, { updates });
      await logEvent(row.id, "internal", actor, "update.added", { id: u.id });
      const out = b.publish === true ? await publish(updates, updates.length - 1) : u;
      return json(res, 200, { ok: true, update: out });
    }

    const idx = find();
    if (idx < 0) return json(res, 404, { ok: false, error: "update_not_found" });
    const updates = curUpdates.map((u) => ({ ...u }));

    if (action === "ops-update-edit") {
      if (updates[idx].published) return json(res, 409, { ok: false, error: "already_published", message: "ألغِ نشر التحديث أولاً ثم عدّله." });
      if (b.text_ar != null) { if (!textAr) return json(res, 400, { ok: false, error: "missing_text" }); updates[idx].text_ar = textAr; }
      if (b.text_en != null) updates[idx].text_en = textEn;
      await patchRequest(row.id, { updates });
      await logEvent(row.id, "internal", actor, "update.edited", { id: updates[idx].id });
      return json(res, 200, { ok: true, update: updates[idx] });
    }
    if (action === "ops-update-publish") {
      // Idempotent: a second press (double click, two panels) changes nothing and tells no one twice.
      if (updates[idx].published) return json(res, 200, { ok: true, update: updates[idx], already: true });
      return json(res, 200, { ok: true, update: await publish(updates, idx) });
    }
    if (action === "ops-update-unpublish") {
      if (!updates[idx].published) return json(res, 200, { ok: true, update: updates[idx], already: true });
      updates[idx] = { ...updates[idx], published: false, published_at: "" };
      await patchRequest(row.id, { updates });
      await logEvent(row.id, "internal", actor, "update.unpublished", { id: updates[idx].id });
      return json(res, 200, { ok: true, update: updates[idx] });
    }
    // ops-update-delete: a draft only. A published update was read by the
    // customer; withdraw it first so the history shows it was.
    if (updates[idx].published) return json(res, 409, { ok: false, error: "unpublish_first" });
    updates.splice(idx, 1);
    await patchRequest(row.id, { updates });
    await logEvent(row.id, "internal", actor, "update.deleted", { id: str(b.id, 40) });
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { ok: false, error: "unknown_action" });
}

// Price scope items from the catalog by SKU; anything unknown keeps the
// price the owner typed (or 0 so it visibly needs a decision).
async function priceItems(items, { catalogueText = false } = {}) {
  let cat = null;
  try { cat = await loadCatalog(); } catch {}
  const byCode = new Map();
  for (const s of (cat && cat.services) || []) if (s.code) byCode.set(String(s.code).toUpperCase(), s);
  // الباقات وباقات الذكاء الاصطناعي ليست في `services.json`، فكان بندها بصفرٍ
  // صامت. دفتر الأسعار (api/_catalog-prices.js) يعرفها: يملأ السعر المرجعي للبند
  // في اللوحة، أما صدوره آلياً فيبقى لما سعره ثابتٌ ودفعةٌ واحدة فقط (نموذج التسعير
  // أدناه يحجب الباقي) — فالسعر المعروض هنا قرارٌ يعتمده إنسان لا الآلة.
  let book = null;
  try { book = await loadPriceBook(); } catch {}
  return (Array.isArray(items) ? items : []).map((it) => {
    let svc = it.code ? byCode.get(String(it.code).toUpperCase()) : null;
    if (!svc && it.code && book) {
      const e = resolveSku(book, it.code);
      if (e.kind === "package" || e.kind === "ai-plan") {
        svc = { code: e.sku, nameAr: e.nameAr, nameEn: e.nameEn, pricingModel: e.model, price: e.amount };
      }
    }
    // loadCatalog() flattens price to a number; the raw catalogue file keeps
    // it as {amount,label}. Reading only the object shape silently priced
    // every catalogue line at zero.
    const catPrice = svc ? num(svc.price && typeof svc.price === "object" ? svc.price.amount : (svc.price != null ? svc.price : svc.amount)) : 0;
    // الاسم الإنجليزي من الكتالوج يُحمل مع البند ليُطبع في العمود المقابل
    // بلغة العميل. ما لا اسم إنجليزي له يبقى بالعربية في العمودين — أفضل من
    // ترجمةٍ آلية لاسم خدمة حكومية داخل عقد.
    // A line that issues WITHOUT a person reading it (catalogueText: the automatic
    // quotation) takes its name and description from the catalogue by SKU — what the
    // customer typed never becomes a contractual line, whatever code it carries
    // («تضمن الشركة استرداد كامل المبلغ» typed over a real SKU reached the contract).
    // His words travel apart, as a short note (`clientNote`).
    const own = catalogueText && svc;
    const catName = svc ? str(svc.nameAr || svc.name, 200) : "";
    const typed = [it.title, it.why || it.description].map((x) => str(x, 400).replace(/\s+/g, " ")).filter(Boolean);
    const clientNote = own ? typed.filter((x) => x !== catName).join(" — ").slice(0, 160) : "";
    return { code: it.code, title: own ? catName : (it.title || (svc && (svc.nameAr || svc.name)) || ""),
      titleEn: str((svc && (svc.nameEn || svc.name)) || (own ? "" : it.titleEn) || "", 200),
      description: own ? str(svc.descAr || svc.description, 600) : (it.description || it.why || ""), qty: it.qty || 1,
      price: it.price != null && it.price !== "" ? num(it.price) : catPrice,
      model: svc ? String(svc.pricingModel || "") : "", found: !!svc, clientNote, catPrice };
  });
}
// A catalogue price is a decision only when it IS the price. «يبدأ من 800»
// is a floor, a monthly fee is not one payment, a percentage has no amount —
// quoting those automatically at the listed number put a binding figure on a
// number that was never the price. They go to a person.
const AUTO_PRICE_MODELS = new Set(["", "One Time", "Per Candidate"]);
const needsHumanPrice = (l) => !(num(l.price) > 0) || !AUTO_PRICE_MODELS.has(String(l.model || ""));

// ------------------------------------------------ why a line waits for a person --
// The rule above says WHETHER a line needs a human; this says WHY, in words the
// customer and the panel both print. Before this a request that stopped for
// pricing said only «بندٌ أو أكثر يحتاج تسعيراً بشرياً» — the customer could not
// tell which line, nor why, and the owner had to open the request to find out.
// The reason is written beside the line (`scope[i].hold`) so /my and /ops read
// the same thing; nothing here ever invents a price.
export const HOLD_AR = {
  custom: "بند كتبتَه بنفسك ولا سعر له في الكتالوج",
  unknown_code: "رمز الخدمة غير موجود في الكتالوج",
  proposal: "سعرها حسب دراسة حالتك وليس رقماً ثابتاً",
  from: "الكتالوج يذكر لها سعراً «يبدأ من» وليس سعراً نهائياً",
  recurring: "اشتراك دوري وليس دفعة واحدة",
  percent: "تُحتسب بنسبة وليس بمبلغ ثابت",
  no_price: "لا سعر لها في الكتالوج",
};
export function pricingReason(l) {
  if (!l.code) return "custom";
  if (l.found === false) return "unknown_code";
  const m = String(l.model || "");
  if (m === "Requires Proposal") return "proposal";
  if (m === "Percent") return "percent";
  if (m === "Monthly") return "recurring";
  if (m === "Starting From") return "from";
  return "no_price";
}
// The lines a quotation is built from (filler lines flagged `seed` never block
// it and are not printed on it) and, among them, the ones only a person can price.
async function assessScope(scope) {
  const real = scope.filter((it) => !it.seed);
  const basis = real.length ? real : scope;
  const priced = await priceItems(basis);
  const holds = priced.filter(needsHumanPrice).map((l) => { const reason = pricingReason(l); return { title: l.title, code: l.code || "", qty: l.qty, reason, reason_ar: HOLD_AR[reason] }; });
  return { basis, holds };
}
// The scope with the verdict written beside each waiting line (and any older
// verdict removed): this is what the customer's page and the panel render.
function markHolds(scope, holds) {
  const by = new Map(holds.map((h) => [h.title, h]));
  return scope.map(({ hold, ...it }) => { const h = by.get(it.title); return h ? { ...it, hold: { reason: h.reason, reason_ar: h.reason_ar } } : it; });
}
// The advisor's scope lines reach the server without a SKU (and the chat page's filler lines
// without the `seed` flag), so «خدمة من الكتالوج» typed by the model was read as «بند كتبتَه بنفسك»
// and held the whole request. Resolved here, by the one rule everything shares:
//   • a filler line of the page (by title, any language) is flagged `seed`;
//   • a line with a known SKU keeps it;
//   • otherwise a line whose title IS a catalogue service name (Arabic or English, one service only)
//     takes that service's SKU — the price, name and description then come from the catalogue;
//   • anything else stays as the customer wrote it and waits for a person as a pending item.
async function resolveScope(scope) {
  let cat = null;
  try { cat = await loadCatalog(); } catch {}
  const known = new Set(), byName = new Map();
  for (const sv of (cat && cat.services) || []) {
    if (!sv.code) continue;
    known.add(String(sv.code).toUpperCase());
    for (const n of [sv.nameAr, sv.nameEn]) { const k = normalizeText(n); if (k) { if (!byName.has(k)) byName.set(k, new Set()); byName.get(k).add(sv.code); } }
  }
  return (Array.isArray(scope) ? scope : []).map((it) => {
    if (it.seed) return it;
    if (!it.code && isSeedTitle(it.title)) return { ...it, seed: true };
    if (it.code && known.has(String(it.code).toUpperCase())) return it;
    const hit = byName.get(normalizeText(it.title));
    return hit && hit.size === 1 ? { ...it, code: [...hit][0] } : it;
  });
}
// A line no catalogue price can settle sends the request to the team — with the
// line and the reason written where the customer and the panel both read them,
// one pricing task, and one notice. Nothing waits silently.
async function holdForPricing(row, scope, holds) {
  const upd = await patchRequest(row.id, { status: "REVIEWING", scope: markHolds(scope, holds) });
  await pricingTask(row, holds);
  await logEvent(row.id, "system", "النظام", "quote.pending", { unpriced: holds.map((h) => h.title), holds });
  await announce({ ...row, scope }, "scope", {
    subject: `نطاق معتمد بانتظار التسعير — ${row.ref}`,
    clientLine: holds.length
      ? `اعتمدنا نطاق خدماتك. ${holds.length === 1 ? "بندٌ واحد" : "بعض البنود"} يحتاج تسعيراً من الفريق قبل إصدار العرض: ${holdsLine(holds)}. يصلك العرض هنا وعلى بريدك فور تسعيرها — لا يلزمك فعل شيء.`
      : "اعتمدنا نطاق خدماتك، والفريق يجهّز عرض السعر ويصلك هنا وعلى بريدك.",
    opsLine: holds.length ? `بنود بلا سعر نهائي في الكتالوج: ${holdsLine(holds)}` : "نطاق معتمد وكل بنوده مسعّرة، والتسعير الآلي مُطفأ — أصدر العرض من اللوحة.",
  });
  return upd;
}
// The one door a confirmed scope goes through: priced by the catalogue ⇒ the
// quotation now; otherwise ⇒ the team, with the reason.
async function quoteOrHold(row, scope0) {
  const scope = await resolveScope(scope0);
  await autoNda(row, scope);
  const auto = await tryAutoQuote(row, scope);
  if (auto.issued) return { issued: true, quote: auto.quote, status: auto.status, pending: auto.pending || [] };
  const holds = auto.holds.length ? auto.holds : (await assessScope(scope)).holds;
  return { issued: false, holds, upd: await holdForPricing(row, scope, holds) };
}
// Everything priced by the catalogue ⇒ the quotation is issued NOW and the
// customer finds it in his panel (owner, 2026-10-23: «عرض السعر مؤتمت فوري»).
// Returns {issued:true,quote,status} or {issued:false,holds} — never throws a
// half-state: when it cannot issue, the request is exactly as it was.
async function tryAutoQuote(row, scope) {
  if (!AUTO_QUOTE || !scope.length) return { issued: false, holds: [] };
  const { basis, holds } = await assessScope(scope);
  // A line without a fixed catalogue price used to hold the WHOLE quotation back, priced lines
  // included. Now the priced lines issue at once and the others travel as `pending_items`. Only a
  // quotation with no priced line at all stays with the team (nothing to quote yet).
  const waiting = new Set(holds.map((h) => h.title));
  const priced = basis.filter((it) => !waiting.has(it.title));
  if (holds.length && !priced.length) return { issued: false, holds };
  const out = await issueQuote({ ...row, scope }, priced, holds.length ? { pending: holds } : {}, "system", "التسعير الآلي");
  if (!out.ok) return { issued: false, holds: [] };
  await logEvent(row.id, "system", "التسعير الآلي", "quote.auto", { number: out.quote.number, total: out.quote.total, ...(holds.length ? { pending: holds.length } : {}) });
  return { issued: true, quote: out.quote, status: out.status, pending: holds };
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

const holdsLine = (holds) => (holds || []).map((h) => `${h.title} (${h.reason_ar})`).join(" · ");
async function pricingTask(row, holds) {
  try {
    const open = await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&status=in.(open,in_progress,blocked)&select=id&limit=1`);
    if (open && open[0]) return;
    await sb("tasks", { method: "POST", body: [{
      organization_id: row.organization_id || await fallbackOrg(),
      title: `تسعير نطاق ${row.ref}`,
      details: holds && holds.length ? `بنود تحتاج تسعيراً بشرياً: ${holdsLine(holds)}` : "راجع النطاق وأصدر عرض السعر.",
      assignee: "bp", source: "pricing", status: "open", urgency: "urgent", priority: "high",
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
