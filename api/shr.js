// SHR-HR — لوحة تشغيل الفواز (المرحلة ٢). دالة واحدة بأسلوب action.
//
// محلية فقط: ترفض كل طلب خارج LOCAL_DB=1. بيانات وهمية. لا ربط حكومي ولا رسائل.
// كل وصول للبيانات عبر scoped(ctxFrom(user)) من _shr.js؛ والمستأجر يُشتق من
// الجلسة الموقَّعة لا من الطلب. الأدوار: الطاقم (tenant_owner/operator/compliance_officer) والمكتب والعميل.
//
// POST /api/shr { action: "session", slug, email }   -> دخول تجريبي (يضع كوكي)
// POST /api/shr { action: "session-end" }
// GET  /api/shr?action=session|dashboard|workers|requests|expiring[&days=60]
// POST /api/shr { action: "worker-create" | "worker-activate" | "worker-archive" | "request-state" }
// ATS: GET jobs|applications|candidates|candidate ؛ POST job-create|job-close|application-create|
//      application-stage|interview-request|interview-set|match (المنطق في _shr_ats.js و_shr_match.js).
// إعلانات الوظائف (المنطق في _shr_posts.js، داخل SHR وحدها): GET posts ؛ POST post-create|post-update|post-submit|
//      post-approve|post-publish|post-close|post-suggest|post-applicant-add. الطاقم tenant_owner/operator فقط؛ من يكتب لا يعتمد؛
//      قناة النشر shr_private وحدها (غيرها 409 channel_not_enabled). لا نشر عام ولا خارجي.
// بوابة المكاتب (المنطق في _shr_agency.js): المشغّل GET agencies|orders|order-employer-view|agency-submissions ؛
//      POST agency-create|agency-approve|agency-suspend|order-create|submission-state.
//      دور agency وحده: GET my-orders|my-submissions|my-interviews ؛ POST submit-candidate|bulk-submit.
//      كل دور يصل إلى ما يخصّه فقط؛ المكتب لا يصل لأي إجراء مشغّل (403) ولا المشغّل لإجراءات المكتب.
// الامتثال (المنطق في _shr_compliance.js، قاعدته المرجعية db/shr-ref): GET compliance-* ؛ POST violation-* ·
//      establishment-compliance-* · a33-* · transfer-* · import-* · checklist-tick · procedure-step-create · compliance-*.
//      الطاقم (tenant_owner/operator/compliance_officer) وحده؛ دور compliance_officer لا يصل لغير الامتثال.
//      حالة «تقديم» لا تتغير إلا بـcompliance_officer. العميل والعامل والمكتب: 403 (أو مُقنَّعاً بإعداد المستأجر).
// بوابة العميل (المنطق في _shr_client.js): دور client_admin/client_viewer وحده.
//      GET client-session|client-home|client-workers|client-worker|client-contracts|client-requests|client-invoices ؛
//      POST client-request-create (client_admin وحده). عميل الجلسة من shr_users.client_company_id لا من الطلب؛
//      عميل آخر أو مستأجر آخر 404؛ أي إجراء آخر 403؛ والمشغّل/المكتب لا يصلون لإجراءات client-* (403).
// بوابة العامل (المنطق في _shr_worker.js): دور worker وحده. هويته من shr_users.worker_id لا من الطلب، والعامل غير active لا يدخل (403).
//      GET worker-session|worker-profile|worker-contract|worker-documents|worker-salary|worker-requests ؛ POST worker-request-create.
//      tenant_id أو worker_id أو client_company_id في الطلب 400؛ معرّف عامل آخر (id) 404؛ أي إجراء آخر 403؛
//      والمشغّل/العميل/المكتب/الامتثال لا يصلون لإجراءات worker-* (403). لا قراءة لجداول الرواتب.
// الحذف مرفوض: action "worker-delete" (وأي *-delete) -> 403 archive_only.
import crypto from "node:crypto";
import { ctxFrom, scoped, assertLocal, tenantBySlug, tenantById, seedDemo, hashIdNo, ROLES, HttpError, audit } from "./_shr.js";
import * as ats from "./_shr_ats.js";
import * as agy from "./_shr_agency.js";
import * as cmp from "./_shr_compliance.js";
import * as cl from "./_shr_client.js";
import * as wk from "./_shr_worker.js";
import * as pst from "./_shr_posts.js";

const COOKIE = "shr_session";
const TTL_S = 8 * 3600;
const PHASE2_ROLES = new Set(["tenant_owner", "operator"]);      // طاقم التشغيل
const ALLOWED_ROLES = new Set(["tenant_owner", "operator", "agency", "compliance_officer", "client_admin", "client_viewer", "worker"]);
// ما يصل إليه دور agency وحده، مع الطريقة. أي شيء غيره يرد 403 لهذا الدور.
const AGENCY_GET = new Set(["my-orders", "my-submissions", "my-interviews"]);
const AGENCY_POST = new Set(["submit-candidate", "bulk-submit"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_STATES = ["new", "in_review", "waiting_client", "in_progress", "done", "rejected"];
const TERMINAL = new Set(["done", "rejected"]);
const WORKER_STATUSES = ["draft", "pending_docs", "active", "archived"];
const ID_KINDS = ["iqama", "national_id", "border_no"];

// سرّ التوقيع: محلي فقط، فلا حاجة لسرّ حقيقي. يمكن تثبيته بـSHR_SESSION_SECRET.
const SECRET = process.env.SHR_SESSION_SECRET || "shr-local-demo-secret-not-for-production";
const sign = (p) => crypto.createHmac("sha256", SECRET).update(p).digest("base64url");

function mintSession(payload) {
  const p = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TTL_S })).toString("base64url");
  return `${p}.${sign(p)}`;
}
function readSession(req) {
  const raw = (req.cookies && req.cookies[COOKIE]) || "";
  const [p, sig] = String(raw).split(".");
  if (!p || !sig) return null;
  const want = sign(p);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const o = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (!o.exp || o.exp < Date.now() / 1000) return null;
    return o;
  } catch { return null; }
}

const bad = (code, extra) => new HttpError(400, code, extra);
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const needId = (v) => { if (!UUID.test(String(v || ""))) throw bad("bad_id"); return String(v); };

// ------------------------------------------------------------- actions ----
async function dashboard(db) {
  const today = day(0), soon = day(60);
  const [workers, clients, requests, docs] = await Promise.all([
    db.get("shr_workers?select=id,status"),
    db.get("shr_client_companies?select=id,status"),
    db.get("shr_requests?select=id,state"),
    db.get("shr_worker_documents?select=worker_id,kind,expires_on"),
  ]);
  const live = new Set(workers.filter((w) => w.status !== "archived").map((w) => w.id));
  const d = docs.filter((x) => live.has(x.worker_id) && x.expires_on);
  return {
    workers: workers.filter((w) => w.status !== "archived").length,
    workers_active: workers.filter((w) => w.status === "active").length,
    workers_draft: workers.filter((w) => w.status === "draft" || w.status === "pending_docs").length,
    clients: clients.filter((c) => c.status === "active").length,
    open_requests: requests.filter((r) => !TERMINAL.has(r.state)).length,
    docs_expiring_60d: d.filter((x) => x.expires_on >= today && x.expires_on <= soon).length,
    docs_expired: d.filter((x) => x.expires_on < today).length,
  };
}

async function listWorkers(db, q) {
  const st = q.status ? String(q.status) : "";
  if (st && !WORKER_STATUSES.includes(st)) throw bad("bad_status");
  const rows = await db.get(`shr_workers?select=id,full_name,nationality,profession,id_kind,status,created_by,activated_by,created_at${st ? `&status=eq.${st}` : ""}&order=created_at.desc`);
  return rows;
}

async function createWorker(db, user, b) {
  const full_name = str(b.full_name, 120);
  if (full_name.length < 2) throw bad("full_name_required");
  // لا يُقبل من الجسم إلا مسودة؛ أي حالة أخرى محاولة تفعيل خلفي.
  if (b.status !== undefined && b.status !== "draft") throw bad("draft_only");
  const id_kind = b.id_kind ? String(b.id_kind) : null;
  if (id_kind && !ID_KINDS.includes(id_kind)) throw bad("bad_id_kind");
  const id_no = str(b.id_no, 40);
  const row = {
    full_name, nationality: str(b.nationality, 60) || null, profession: str(b.profession, 80) || null,
    id_kind, id_no_hash: id_no ? hashIdNo(db.ctx.tenantId, id_no) : null,
    status: "draft", created_by: user.sub, activated_by: null,
  };
  let est = null, cli = null;
  if (b.establishment_id || b.client_company_id) {
    est = (await db.get(`shr_establishments?id=eq.${needId(b.establishment_id)}&select=id`))[0];
    cli = (await db.get(`shr_client_companies?id=eq.${needId(b.client_company_id)}&select=id`))[0];
    if (!est || !cli) throw new HttpError(404, "not_found");
  }
  const w = (await db.post("shr_workers", row))[0];
  if (est && cli) await db.post("shr_assignments", { worker_id: w.id, establishment_id: est.id, client_company_id: cli.id, profession: row.profession || "—", status: "draft" });
  await audit(db, user, "worker.create_draft", "shr_workers", w.id);
  return { id: w.id, status: w.status, full_name: w.full_name };
}

async function activateWorker(db, user, b) {
  const id = needId(b.id);
  const w = (await db.get(`shr_workers?id=eq.${id}`))[0];
  if (!w) throw new HttpError(404, "not_found");
  if (w.status === "archived") throw new HttpError(409, "archived");
  if (w.status === "active") throw new HttpError(409, "already_active");
  // من يُدخل لا يعتمد.
  if (w.created_by && w.created_by === user.sub) throw new HttpError(403, "maker_checker");
  // عامل مرتبط بقائمة A33: محجوب حتى يُصنَّف كل اسم في قائمته ويعتمد مراجع ثانٍ (409 a33_blocked).
  await cmp.assertA33(db, id);
  const [docs, asg] = await Promise.all([
    db.get(`shr_worker_documents?worker_id=eq.${id}&select=kind,storage_key,expires_on`),
    db.get(`shr_assignments?worker_id=eq.${id}&select=establishment_id,client_company_id`),
  ]);
  const today = day(0), missing = [];
  if (!w.id_kind || !w.id_no_hash) missing.push("identity");
  const iq = docs.find((x) => x.kind === "iqama" && x.storage_key);
  if (!iq) missing.push("iqama"); else if (!iq.expires_on || iq.expires_on < today) missing.push("iqama_valid");
  if (!docs.find((x) => x.kind === "work_contract" && x.storage_key)) missing.push("work_contract");
  if (!asg.find((x) => x.establishment_id && x.client_company_id)) missing.push("establishment");
  if (missing.length) throw new HttpError(409, "activation_blocked", { missing });
  await db.patch(`shr_workers?id=eq.${id}`, { status: "active", activated_by: user.sub });
  await audit(db, user, "worker.activate", "shr_workers", id);
  return { id, status: "active" };
}

async function archiveWorker(db, user, b) {
  const id = needId(b.id);
  const w = (await db.get(`shr_workers?id=eq.${id}&select=id,status`))[0];
  if (!w) throw new HttpError(404, "not_found");
  if (w.status === "archived") return { id, status: "archived" };
  await db.patch(`shr_workers?id=eq.${id}`, { status: "archived", archived_at: new Date().toISOString() });
  await audit(db, user, "worker.archive", "shr_workers", id);
  return { id, status: "archived" };
}

async function listRequests(db, q) {
  const st = q.state ? String(q.state) : "";
  if (st && !REQUEST_STATES.includes(st)) throw bad("bad_state");
  const [reqs, clients, workers] = await Promise.all([
    db.get(`shr_requests?select=id,client_company_id,worker_id,kind,state,body,created_at${st ? `&state=eq.${st}` : ""}&order=created_at.desc`),
    db.get("shr_client_companies?select=id,name_ar"),
    db.get("shr_workers?select=id,full_name"),
  ]);
  const cn = Object.fromEntries(clients.map((c) => [c.id, c.name_ar]));
  const wn = Object.fromEntries(workers.map((w) => [w.id, w.full_name]));
  // طلب العامل (kind worker_*) بلا عميل: يظهر باسم العامل.
  return reqs.map((r) => ({ ...r, client: cn[r.client_company_id] || null, worker: wn[r.worker_id] || null }));
}

async function setRequestState(db, user, b) {
  const id = needId(b.id);
  const state = String(b.state || "");
  if (!REQUEST_STATES.includes(state)) throw bad("bad_state");
  const r = (await db.get(`shr_requests?id=eq.${id}&select=id,state`))[0];
  if (!r) throw new HttpError(404, "not_found");
  if (TERMINAL.has(r.state) && r.state !== state) throw new HttpError(409, "terminal_state");
  await db.patch(`shr_requests?id=eq.${id}`, { state });
  await audit(db, user, `request.state.${r.state}->${state}`, "shr_requests", id);
  return { id, state };
}

async function expiring(db, q) {
  const days = Math.min(365, Math.max(1, parseInt(q.days, 10) || 60));
  const today = day(0), until = day(days);
  const [docs, workers] = await Promise.all([
    db.get(`shr_worker_documents?select=id,worker_id,kind,expires_on&kind=in.(iqama,medical_insurance)&expires_on=lte.${until}&order=expires_on.asc`),
    db.get("shr_workers?select=id,full_name,status"),
  ]);
  const w = Object.fromEntries(workers.map((x) => [x.id, x]));
  return {
    days,
    items: docs.filter((d) => w[d.worker_id] && w[d.worker_id].status !== "archived").map((d) => ({
      id: d.id, worker_id: d.worker_id, worker: w[d.worker_id].full_name, kind: d.kind, expires_on: d.expires_on,
      expired: d.expires_on < today, days_left: Math.round((Date.parse(d.expires_on) - Date.parse(today)) / 86400000),
    })),
  };
}

// ----------------------------------------------------------- the handler ---
export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  const out = (status, o) => res.status(status).json({ demo: true, ...o });
  try {
    assertLocal();
    const isPost = req.method === "POST";
    if (!isPost && req.method !== "GET") return out(405, { ok: false, error: "method_not_allowed" });
    const b = isPost && req.body && typeof req.body === "object" ? req.body : {};
    const q = req.query || {};
    const src = isPost ? b : q;
    const action = String(src.action || q.action || "");
    // المستأجر من الجلسة وحدها.
    if ("tenant_id" in b || "tenant_id" in q) return out(400, { ok: false, error: "tenant_id_forbidden" });

    if (action === "session" && isPost) {
      await seedDemo();
      const t = await tenantBySlug(String(b.slug || "SHR"));
      const email = str(b.email, 120).toLowerCase();
      if (!t || !email) return out(401, { ok: false, error: "unauthorized" });
      const db = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
      const u = (await db.get(`shr_users?email=eq.${encodeURIComponent(email)}&limit=1`))[0];
      if (!u) return out(401, { ok: false, error: "unauthorized" });
      if (!ALLOWED_ROLES.has(u.role)) return out(403, { ok: false, error: "role_not_allowed" });
      // مكتب قيد الاعتماد أو موقوف لا يدخل ولا تُمنح له جلسة.
      if (u.role === "agency") await agy.agencyContext(db, { sub: u.id });
      // عميل غير مربوط بشركة أو شركته غير نشطة لا يدخل ولا تُمنح له جلسة.
      const cx = cl.CLIENT_ROLES.has(u.role) ? await cl.clientContext(db, { sub: u.id }) : null;
      // عامل غير مربوط بسجل عامل أو ليس active (مسودة/مؤرشف) لا يدخل ولا تُمنح له جلسة.
      const wx = wk.WORKER_ROLES.has(u.role) ? await wk.workerContext(db, { sub: u.id }) : null;
      res.setHeader("set-cookie", `${COOKIE}=${mintSession({ sub: u.id, tenant_id: u.tenant_id, role: u.role, email: u.email })}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_S}`);
      // المكتب لا يُعاد إليه مستأجر ولا علامته؛ يعرف مكتبه فقط.
      // العميل كالمكتب: لا يُعاد إليه مستأجر ولا علامته؛ يعرف شركته فقط.
      if (cx) return out(200, { ok: true, ...cl.session(cx) });
      if (wx) return out(200, { ok: true, ...wk.session(wx) });     // والعامل كذلك: يعرف نفسه فقط
      return out(200, { ok: true, user: { email: u.email, name: u.full_name, role: u.role }, tenant: u.role === "agency" ? null : { slug: t.slug, brand_ar: t.brand_ar } });
    }
    if (action === "session-end") {
      res.setHeader("set-cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
      return out(200, { ok: true });
    }

    const s = readSession(req);
    if (!s) return out(401, { ok: false, error: "unauthorized" });
    let ctx;
    try { ctx = ctxFrom({ tenant_id: s.tenant_id, role: s.role }); } catch { return out(401, { ok: false, error: "unauthorized" }); }
    if (!ALLOWED_ROLES.has(ctx.role) || !ROLES.includes(ctx.role)) return out(403, { ok: false, error: "role_not_allowed" });
    const db = scoped(ctx);
    const user = { sub: s.sub, email: s.email, role: s.role };

    // ---- دور المكتب: قائمة بيضاء ضيقة، والمكتب من القاعدة لا من الطلب ----
    if (ctx.role === "agency") {
      const allowed = isPost ? AGENCY_POST.has(action) : AGENCY_GET.has(action) || action === "session";
      if (!allowed) return out(403, { ok: false, error: "role_not_allowed" });
      const actx = await agy.agencyContext(db, s);          // مكتب موقوف أو مستخدم محذوف: 403 فوراً
      switch (action) {
        case "session": return out(200, { ok: true, user: { email: actx.user.email, role: "agency" }, agency: { ref: actx.agency.ref, name_ar: actx.agency.name_ar }, tenant: null });
        case "my-orders": return out(200, { ok: true, ...(await agy.myOrders(db, actx, q)) });
        case "my-submissions": return out(200, { ok: true, ...(await agy.mySubmissions(db, actx, q)) });
        case "my-interviews": return out(200, { ok: true, interviews: await agy.myInterviews(db, actx) });
        case "submit-candidate": return out(200, { ok: true, submission: await agy.submitCandidate(db, actx, b) });
        case "bulk-submit": return out(200, { ok: true, ...(await agy.bulkSubmit(db, actx, b)) });
      }
      return out(403, { ok: false, error: "role_not_allowed" });
    }
    // ---- دور العميل: قائمة بيضاء ضيقة، والعميل من القاعدة لا من الطلب ----
    if (cl.CLIENT_ROLES.has(ctx.role)) {
      if ("client_company_id" in b || "client_company_id" in q) return out(400, { ok: false, error: "client_company_id_forbidden" });
      const allowed = isPost ? cl.CLIENT_POST.has(action) : cl.CLIENT_GET.has(action) || action === "session";
      if (!allowed) return out(403, { ok: false, error: "role_not_allowed" });
      const cx = await cl.clientContext(db, s);            // عميل موقوف أو مستخدم محذوف: 403 فوراً
      return out(200, { ok: true, ...(await cl.dispatch(action, { db, cx, b, q })) });
    }
    // ---- دور العامل: قائمة بيضاء ضيقة، والعامل من القاعدة لا من الطلب ----
    if (wk.WORKER_ROLES.has(ctx.role)) {
      if ("worker_id" in b || "worker_id" in q) return out(400, { ok: false, error: "worker_id_forbidden" });
      if ("client_company_id" in b || "client_company_id" in q) return out(400, { ok: false, error: "client_company_id_forbidden" });
      const allowed = isPost ? wk.WORKER_POST.has(action) : wk.WORKER_GET.has(action) || action === "session";
      if (!allowed) return out(403, { ok: false, error: "role_not_allowed" });
      const wx = await wk.workerContext(db, s);            // عامل موقوف أو غير مربوط أو مستخدم محذوف: 403 فوراً
      return out(200, { ok: true, ...(await wk.dispatch(action, { db, wx, b, q })) });
    }
    // إجراءات العامل ليست لغيره.
    if (wk.WORKER_ACTIONS.has(action)) return out(403, { ok: false, error: "role_not_allowed" });
    // إجراءات العميل ليست للمشغّل ولا للمكتب ولا لمسؤول الامتثال.
    if (cl.CLIENT_ACTIONS.has(action)) return out(403, { ok: false, error: "role_not_allowed" });
    // إجراءات المكتب ليست للمشغّل.
    if (agy.AGENCY_ACTIONS.has(action)) return out(403, { ok: false, error: "role_not_allowed" });
    // دور مسؤول الامتثال: وحدة الامتثال وsession وحدهما.
    if (ctx.role === "compliance_officer" && action !== "session" && !cmp.isComplianceAction(action)) return out(403, { ok: false, error: "role_not_allowed" });
    if (cmp.isComplianceAction(action)) {
      const r = await cmp.dispatch(action, { db, ctx, user, b, q, isPost });
      return out(200, { ok: true, ...r });
    }

    // إعلانات الوظائف: طاقم التشغيل وحده (مسؤول الامتثال محجوب أعلاه، والعميل والمكتب لهما قوائمهما البيضاء).
    if (pst.isPostAction(action)) {
      if (isPost !== pst.POST_POST.has(action)) return out(404, { ok: false, error: "unknown_action" });
      return out(200, { ok: true, ...(await pst.dispatchPost(action, { db, user, b, q })) });
    }

    switch (action) {
      case "session": {
        const t = await tenantById(ctx.tenantId);
        return out(200, { ok: true, user, tenant: t ? { slug: t.slug, brand_ar: t.brand_ar } : null });
      }
      case "dashboard": return out(200, { ok: true, counts: await dashboard(db) });
      case "workers": return out(200, { ok: true, workers: await listWorkers(db, q) });
      case "requests": return out(200, { ok: true, requests: await listRequests(db, q) });
      case "expiring": return out(200, { ok: true, ...(await expiring(db, q)) });
      // ATS (المنطق في _shr_ats.js)
      case "jobs": return out(200, { ok: true, jobs: await ats.listJobs(db) });
      case "applications": return out(200, { ok: true, ...(await ats.listApplications(db, q)) });
      case "candidates": return out(200, { ok: true, candidates: await ats.listCandidates(db) });
      case "candidate": return out(200, { ok: true, ...(await ats.candidateDetail(db, q)) });
      // بوابة المكاتب (المشغّل)
      case "agencies": return out(200, { ok: true, agencies: await agy.listAgencies(db) });
      case "orders": return out(200, { ok: true, orders: await agy.listOrders(db) });
      case "order-employer-view": return out(200, { ok: true, ...(await agy.employerOrderView(db, q)) });
      case "agency-submissions": return out(200, { ok: true, submissions: await agy.listSubmissions(db, q) });
    }
    if (!isPost) return out(404, { ok: false, error: "unknown_action" });
    switch (action) {
      case "worker-create": return out(200, { ok: true, worker: await createWorker(db, user, b) });
      case "worker-activate": return out(200, { ok: true, worker: await activateWorker(db, user, b) });
      case "worker-archive": return out(200, { ok: true, worker: await archiveWorker(db, user, b) });
      case "request-state": return out(200, { ok: true, request: await setRequestState(db, user, b) });
      case "job-create": return out(200, { ok: true, job: await ats.createJob(db, user, b) });
      case "job-close": return out(200, { ok: true, job: await ats.closeJob(db, user, b) });
      case "application-create": return out(200, { ok: true, application: await ats.createApplication(db, user, b) });
      case "application-stage": return out(200, { ok: true, application: await ats.setStage(db, user, b) });
      case "interview-request": return out(200, { ok: true, interview: await ats.requestInterview(db, user, b) });
      case "interview-set": return out(200, { ok: true, interview: await ats.setInterview(db, user, b) });
      case "match": return out(200, { ok: true, ...(await ats.match(db, b)) });
      case "agency-create": return out(200, { ok: true, agency: await agy.createAgency(db, user, b) });
      case "agency-approve": return out(200, { ok: true, agency: await agy.approveAgency(db, user, b) });
      case "agency-suspend": return out(200, { ok: true, agency: await agy.suspendAgency(db, user, b) });
      case "order-create": return out(200, { ok: true, order: await agy.createOrder(db, user, b) });
      case "submission-state": return out(200, { ok: true, submission: await agy.setSubmissionState(db, user, b) });
      case "worker-delete": case "job-delete": case "post-delete": case "application-delete": case "candidate-delete": case "agency-delete": case "order-delete": case "submission-delete": case "delete": return out(403, { ok: false, error: "archive_only" });
      default:
        if (/(^|-)delete$/.test(action)) return out(403, { ok: false, error: "archive_only" });
        return out(404, { ok: false, error: "unknown_action" });
    }
  } catch (e) {
    if (e instanceof HttpError) return out(e.status, { ok: false, error: e.code, ...e.extra });
    if (e && e.code === "shr_local_only") return out(503, { ok: false, error: "shr_local_only" });
    console.error("shr error", String(e && e.message || e).slice(0, 200));
    return out(500, { ok: false, error: "server_error" });
  }
}
