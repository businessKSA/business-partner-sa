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
import { sb, DB_ON, getSession, audit, notify } from "./_db.js";
import { contractHtml } from "./_docusign.js";
import { loadCatalog } from "./_catalog.js";
import { daftraConfigured, daftraFindOrCreateClient, daftraCreateInvoice, daftraRecordPayment, daftraDocPdf, daftraVatRate } from "./_daftra.js";
import { ownerTicketOk, panelRequiresNafath } from "./_nafath.js";
import { DEV, EMAIL_LIVE, MODES, outbox, outboxList } from "./_mode.js";

export const SIMPLE_TEST_MODE = process.env.SIMPLE_TEST_MODE === "1" || process.env.VERCEL_ENV === "preview" || DEV;
// Live since 2026-09-04: a customer who approves a quotation must be told the
// contract is waiting, and operations must hear about a new request. This was
// opt-in (SIMPLE_NOTIFY=1) while the layer was in preview — unset in
// production it meant every notice went silently to the outbox instead of an
// inbox. It is opt-out now; the real safety gate is below and unchanged:
// nothing leaves the machine unless EMAIL_MODE is live AND this is not a test
// deployment, so previews and localhost still cannot e-mail a real customer.
const NOTIFY_ON = process.env.SIMPLE_NOTIFY !== "0";
const SELF_BASE = (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");
const RESEND_API_KEY = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || "").trim();
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
// Every operational notice goes to the company mailboxes. A list, not one
// address: the domain moved once already and a single missed inbox means a
// customer's request sits unread.
const OWNER_EMAIL = process.env.BP_OWNER_EMAIL || "business@businesspartner.sa,business@businesspartnerksa.com";

export const REQUEST_TYPES = ["CONSULTATION", "GOVERNMENT_SERVICE", "COMPANY_FORMATION"];
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
  if (pub.contract && pub.contract.html) pub.contract = { ...pub.contract, html: undefined, has_html: true };
  return { ...pub, events: (events || []).filter((e) => e.actor_kind !== "internal"), tasks: (tasks || []).filter((t) => t.assignee === "client") };
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
    lines: row.quote.items.map((l) => ({ name: l.title, qty: l.qty, amount: l.line })),
    net: row.quote.net, vat: row.quote.vat, total: row.quote.total, vatRate: 15,
    leadTime: str(opts.lead_time, 120), executor: str(opts.executor, 120) || "Business Partner", today,
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
  if (row.organization_id) await notify({ organization_id: row.organization_id, event: "simple_contract", title: `عقد بانتظار توقيعك — ${row.ref}`, body: contract.number, idempotency_key: `simple_contract_${contract.number}` });
  if (row.client_email) await sendEmail(row.client_email, `عقد ${contract.number} بانتظار توقيعك`, `<p><a href="${SELF_BASE}/ar/my?ref=${row.ref}">افتح العقد ووقّعه</a></p>`);
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
  if (send && row.organization_id) await notify({ organization_id: row.organization_id, event: "simple_quote", title: `عرض سعر جاهز — ${row.ref}`, body: `${quote.number} · ${quote.total} ر.س`, idempotency_key: `simple_quote_${quote.number}` });
  if (send && row.client_email) await sendEmail(row.client_email, `عرض سعر ${quote.number} — ${row.title}`, `<p>الإجمالي ${quote.total} ر.س شامل الضريبة.</p><p><a href="${SELF_BASE}/ar/my?ref=${row.ref}">راجع العرض واعتمده</a></p>`);
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
    return { code: str(it.code, 40), title: str(it.title, 200), description: str(it.description, 600), qty, price, line: round2(qty * price) };
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
  if (!DB_ON) return json(res, 503, { ok: false, error: "db_off", message: "قاعدة البيانات غير مضبوطة (SUPABASE_URL / SUPABASE_SERVICE_KEY)." });
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
      if (!opsOk({ key: body.key || qs.key, ticket: body.ticket || qs.ticket })) return json(res, 401, { ok: false, error: "unauthorized" });
      return opsAction(action, body, qs, req, res);
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
    if (role === "user") await logEvent(row.id, "customer", who, "message.customer", { preview: content.slice(0, 140) });
    return json(res, 200, { ok: true, conversation: upd.conversation, status: upd.status });
  }

  if (action === "scope-update") {
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
    if (!["NEW", "REVIEWING", "WAITING_CLIENT"].includes(row.status)) return json(res, 409, { ok: false, error: "scope_locked", message: "النطاق مقفل بعد إصدار عرض السعر." });
    const scope = normScope(b.scope && b.scope.length ? b.scope : row.scope);
    if (!scope.length) return json(res, 400, { ok: false, error: "no_items", message: "أضف بنداً واحداً على الأقل إلى نطاق الخدمات." });
    await patchRequest(row.id, { scope });
    await logEvent(row.id, "customer", who, "scope.confirmed", { items: scope.map((it) => it.title) });

    // Lines with no catalogue price are flagged for whoever prices the quote,
    // so /ops sees at a glance what still needs a decision.
    const priced = await priceItems(scope);
    const unpriced = priced.filter((l) => !(num(l.price) > 0)).map((l) => l.title);
    const upd = await patchRequest(row.id, { status: "REVIEWING" });
    await pricingTask(row, unpriced);
    await logEvent(row.id, "system", "النظام", "quote.pending", { unpriced });
    if (row.organization_id) await notify({ organization_id: row.organization_id, event: "simple_scope", title: `نطاق معتمد بانتظار التسعير — ${row.ref}`, body: scope.map((it) => it.title).join(" · ").slice(0, 200), idempotency_key: `simple_scope_${row.ref}` });
    return json(res, 200, { ok: true, stage: "PRICING", status: upd.status, scope, unpriced });
  }

  if (action === "attachment-add") {
    const att = { name: str(b.name, 160), url: str(b.url, 600), note: str(b.note, 300), at: nowIso(), by: "customer" };
    if (!att.name) return json(res, 400, { ok: false, error: "missing_name" });
    const attachments = [...(row.attachments || []), att].slice(-40);
    await patchRequest(row.id, { attachments });
    await logEvent(row.id, "customer", who, "attachment.added", { name: att.name });
    return json(res, 200, { ok: true, attachments });
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

  if (action === "contract-view") {
    if (!row.contract || !row.contract.html) return json(res, 404, { ok: false, error: "no_contract" });
    return json(res, 200, { ok: true, html: row.contract.html, contract: { ...row.contract, html: undefined } });
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
    await sendEmail(OWNER_EMAIL, `عقد موقّع ${contract.number} (${ref})`, `<p>${esc(signerName)} وقّع العقد إلكترونياً.</p>`);
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

  if (action === "request-cancel") {
    if (!["NEW", "REVIEWING", "WAITING_CLIENT", "QUOTE_SENT"].includes(row.status)) return json(res, 409, { ok: false, error: "cannot_cancel", message: "تعذّر الإلغاء بعد اعتماد العرض — افتح تذكرة ويتولاها الفريق." });
    await patchRequest(row.id, { status: "CANCELLED" });
    await logEvent(row.id, "customer", who, "request.cancelled", { note: str(b.note, 300) });
    return json(res, 200, { ok: true, status: "CANCELLED" });
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
});

function defaultTitle(type, lang) {
  const t = {
    CONSULTATION: { ar: "استشارة", en: "Consultation", fr: "Consultation", zh: "咨询" },
    GOVERNMENT_SERVICE: { ar: "طلب حكومي", en: "Government request", fr: "Demande gouvernementale", zh: "政府服务申请" },
    COMPANY_FORMATION: { ar: "تأسيس شركة", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" },
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
  await sendEmail(OWNER_EMAIL, `دفع مستلم ${row.ref} — ${invoice.total} ر.س`, `<p>${esc(actor || row.client_name || "")} · ${esc(provider)} · ${esc(payId)}</p>`);
  return upd;
}
export async function markRequestPaidByRef(ref, info) {
  const row = await getByRef(ref);
  if (!row || row.status === "PAID" || ["IN_PROGRESS", "COMPLETED"].includes(row.status)) return row;
  return markPaid(row, info);
}

// --------------------------------------------------------------- ops side --
async function opsAction(action, b, qs, req, res) {
  const actor = str(b.actor || qs.actor, 80) || "المالك";

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
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, counts, revenue, recent: all.slice(0, 12).map(summary) });
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

  // Everything below acts on one request.
  const ref = str(b.ref || qs.ref, 40);
  if (!ref) return json(res, 400, { ok: false, error: "missing_ref" });
  const row = await getByRef(ref);
  if (!row) return json(res, 404, { ok: false, error: "not_found" });

  if (action === "ops-request") {
    const [events, tasks] = await Promise.all([eventsFor(row.id, 200), tasksFor(row.id)]);
    return json(res, 200, { ok: true, testMode: SIMPLE_TEST_MODE, request: { ...row, contract: row.contract ? { ...row.contract, html: undefined, has_html: !!row.contract.html } : null, events, tasks } });
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
    if (!Object.keys(patch).length) return json(res, 400, { ok: false, error: "nothing_to_update" });
    const upd = await patchRequest(row.id, patch);
    await logEvent(row.id, "human", actor, patch.status ? `status.${patch.status.toLowerCase()}` : "request.updated", { fields: Object.keys(patch) });
    return json(res, 200, { ok: true, request: summary(upd) });
  }

  if (action === "ops-request-message") {
    const content = str(b.content, 4000);
    if (!content) return json(res, 400, { ok: false, error: "empty" });
    const conversation = normConversation([...(row.conversation || []), { role: "bp", content, at: nowIso() }]);
    const upd = await patchRequest(row.id, { conversation, status: row.status === "REVIEWING" || row.status === "NEW" ? "WAITING_CLIENT" : row.status });
    await logEvent(row.id, "human", actor, "message.bp", { preview: content.slice(0, 140) });
    if (row.organization_id) await notify({ organization_id: row.organization_id, event: "simple_message", title: `رد جديد على طلبك ${row.ref}`, body: content.slice(0, 200), idempotency_key: `simple_msg_${row.ref}_${Date.now()}` });
    if (row.client_email) await sendEmail(row.client_email, `رد على طلبك ${row.ref}`, `<p>${esc(content)}</p><p><a href="${SELF_BASE}/${row.lang === "en" ? "" : (row.lang || "ar") + "/"}my?ref=${row.ref}">فتح الطلب</a></p>`);
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
    return json(res, 200, { ok: true, html: row.contract.html });
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
    await patchRequest(row.id, { status: "IN_PROGRESS" });
    await logEvent(row.id, "human", actor, "execution.started", {});
    return json(res, 200, { ok: true, status: "IN_PROGRESS" });
  }

  if (action === "ops-appointment") {
    const appointment = { ...(row.appointment || {}), date: str(b.date, 10) || row.appointment?.date, time: str(b.time, 5) || row.appointment?.time, topic: str(b.topic, 200) || row.appointment?.topic || row.title, status: b.cancel ? "CANCELLED" : "BOOKED", by: actor, updated_at: nowIso() };
    await patchRequest(row.id, { appointment });
    await logEvent(row.id, "human", actor, b.cancel ? "appointment.cancelled" : "appointment.set", { date: appointment.date, time: appointment.time });
    return json(res, 200, { ok: true, appointment });
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
    return { code: it.code, title: it.title || (svc && (svc.nameAr || svc.name)) || "", description: it.description || it.why || "", qty: it.qty || 1, price: it.price != null && it.price !== "" ? num(it.price) : catPrice };
  });
}
function guessType(text) {
  const t = String(text || "");
  if (/تأسيس|فرع|رخصة استثمار|ريادة|MISA|سجل تجاري جديد|company|formation|branch/i.test(t)) return "COMPANY_FORMATION";
  if (/قوى|التأمينات|مدد|مقيم|أبشر|بلدي|زاتكا|الزكاة|تأشير|نطاقات|مهنة|رخصة|qiwa|gosi|mudad|muqeem|zatca|visa/i.test(t)) return "GOVERNMENT_SERVICE";
  return "CONSULTATION";
}
// tasks.organization_id is NOT NULL: manual intake for a not-yet-registered
// client parks its tasks on the owner's own organization.
let _fallbackOrg = null;
// One open pricing task per request — pressing «اعتمد النطاق» twice must not
// fill the operations queue with duplicates.
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
