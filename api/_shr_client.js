// SHR-HR — بوابة العميل: عمال العميل وعقوده وطلباته وفواتيره. محلية، بيانات وهمية.
// كل وصول للبيانات عبر db = scoped(ctx) من _shr.js. لا شبكة ولا رسائل.
//
// النمط نفسه كبوابة المكاتب:
//  * هوية العميل من client_company_id في صف shr_users تُقرأ من القاعدة في كل طلب، لا من
//    الكوكي ولا من الجسم؛ وإيقاف العميل أو فكّ ربط مستخدمه يسري فوراً. أي client_company_id
//    أو tenant_id في الطلب يُرفض في api/shr.js قبل الوصول إلى هنا.
//  * كل ما يخرج قائمة بيضاء حرفية (DTO تُبنى حقلاً حقلاً، لا SELECT * ولا نشر صف خام).
//    لا يخرج للعميل: بصمة الهوية، المنشأة المشغِّلة وحالة قيدها، المخالفات، أسماء م33،
//    أوامر الاستقدام ومكاتبه، سجل التدقيق، مفاتيح التخزين، أي عميل آخر.
//  * ما يخصّ عميلاً آخر (في المستأجر نفسه أو غيره) يرد 404 لا 403: لا يُعرف وجوده.
//  * client_admin يقدّم طلباً بحقول محدودة؛ client_viewer يقرأ. لا أحد منهما يغيّر حالة الطلب.
//  * الفواتير مسودات في المخطط ولا تخرج إلا عبر بدر: هذه الوحدة لا تقرأ shr_invoices أصلاً.
import { HttpError, audit } from "./_shr.js";
import { getSettings } from "./_shr_compliance.js";
import * as R from "./_shr_ref.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CLIENT_ROLES = new Set(["client_admin", "client_viewer"]);
export const CLIENT_GET = new Set(["client-session", "client-home", "client-workers", "client-worker", "client-contracts", "client-requests", "client-invoices"]);
export const CLIENT_POST = new Set(["client-request-create"]);
export const CLIENT_ACTIONS = new Set([...CLIENT_GET, ...CLIENT_POST]);

export const REQUEST_KINDS = ["new_hire", "termination", "transfer", "document", "other"];
const NEEDS_WORKER = new Set(["termination", "transfer"]);       // إنهاء/نقل يلزمهما عامل من عمال العميل
const TERMINAL = new Set(["done", "rejected"]);
const SHOWN_DOCS = ["work_contract", "iqama", "passport", "medical_insurance"];      // gosi مشتق من استيراد داخلي: لا يُعرض
const REQUIRED_DOCS = ["iqama", "work_contract", "medical_insurance"];               // غيابها يُعرض «غير مرفوعة»
const VISIBLE_WORKER_STATUS = new Set(["active", "pending_docs"]);                   // المسودة والمؤرشف داخليان
export const LIMITS = { note: 500, profession: 80, quantity: 200, maxOpen: 20, maxPerHour: 10 };
export const INVOICES_NOTE_AR = "تصدرها فرق Business Partner بعد الاعتماد";

const bad = (code, extra) => new HttpError(400, code, extra);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const needId = (v) => { if (!UUID.test(String(v || ""))) throw bad("bad_id"); return String(v); };
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

// ---------------------------------------------------------------- context --
// سياق العميل يُقرأ من القاعدة في كل طلب. العميل الموقوف أو غير المربوط: 403 فوراً.
export async function clientContext(db, session) {
  const sub = String(session.sub || "");
  if (!UUID.test(sub)) throw new HttpError(403, "role_not_allowed");
  const u = (await db.get(`shr_users?id=eq.${sub}&select=id,email,full_name,role,client_company_id`))[0];
  if (!u || !CLIENT_ROLES.has(u.role)) throw new HttpError(403, "role_not_allowed");
  if (!u.client_company_id) throw new HttpError(403, "client_not_linked");
  const c = (await db.get(`shr_client_companies?id=eq.${u.client_company_id}&select=id,name_ar,city,status`))[0];
  if (!c || c.status !== "active") throw new HttpError(403, "client_not_active");
  return {
    clientId: c.id, company: { name_ar: c.name_ar, city: c.city || null },
    user: { sub: u.id, email: u.email, name: u.full_name || null, role: u.role }, canWrite: u.role === "client_admin",
  };
}

// ------------------------------------------------------------ DTO builders --
// كل دالة تبني الكائن حقلاً حقلاً. إضافة حقل للخروج قرار صريح هنا لا أثر جانبي لعمود جديد.
function docState(rows, kind, t, soonDays) {
  const mine = rows.filter((d) => d.kind === kind && d.storage_key);
  if (!mine.length) return REQUIRED_DOCS.includes(kind) ? { kind, status: "missing", expires_on: null, days_left: null } : null;
  // أبعد انتهاءً يغلب (بلا تاريخ انتهاء = الأبعد).
  const best = mine.slice().sort((a, b) => String(b.expires_on || "9999-12-31").localeCompare(String(a.expires_on || "9999-12-31")))[0];
  if (!best.expires_on) return { kind, status: "no_expiry", expires_on: null, days_left: null };
  const left = daysBetween(best.expires_on, t);
  return { kind, status: left < 0 ? "expired" : left <= soonDays ? "expiring" : "valid", expires_on: best.expires_on, days_left: left };
}
const ATTENTION_RANK = ["expired", "missing", "expiring"];
const attentionOf = (docs) => ATTENTION_RANK.find((s) => docs.some((d) => d.status === s)) || "ok";

// عمال العميل: إسناد active لعميل الجلسة، والعامل غير مسودة ولا مؤرشف. بلا SELECT *.
async function myWorkers(db, cx) {
  const asg = await db.get(`shr_assignments?client_company_id=eq.${cx.clientId}&status=eq.active&select=worker_id,profession,starts_on,ends_on,contract_id`);
  if (!asg.length) return [];
  const ids = [...new Set(asg.map((a) => a.worker_id))];
  const ws = await db.get(`shr_workers?id=in.(${ids.join(",")})&select=id,full_name,nationality,profession,status`);
  const wm = Object.fromEntries(ws.filter((w) => VISIBLE_WORKER_STATUS.has(w.status)).map((w) => [w.id, w]));
  const seen = new Set();
  const out = [];
  for (const a of asg) {
    const w = wm[a.worker_id];
    if (!w || seen.has(w.id)) continue;
    seen.add(w.id);
    out.push({ w, a });
  }
  return out;
}

async function docsFor(db, ids) {
  if (!ids.length) return [];
  return db.get(`shr_worker_documents?worker_id=in.(${ids.join(",")})&select=worker_id,kind,expires_on,storage_key`);
}

function workerDto({ w, a }, docRows, t, soon) {
  const docs = SHOWN_DOCS.map((k) => docState(docRows.filter((d) => d.worker_id === w.id), k, t, soon)).filter(Boolean);
  return {
    id: w.id, full_name: w.full_name, profession: a.profession || w.profession || null, nationality: w.nationality || null, status: w.status,
    docs, attention: attentionOf(docs),
  };
}

// ---------------------------------------------------------------- actions ---
export function session(cx) {
  return { user: { email: cx.user.email, name: cx.user.name, role: cx.user.role }, client: { name_ar: cx.company.name_ar, city: cx.company.city }, can_request: cx.canWrite, tenant: null };
}

export async function home(db, cx) {
  const t = today(), soon = (await getSettings(db)).expiry_alert_days;
  const [ws, reqs, ks] = await Promise.all([
    myWorkers(db, cx),
    db.get(`shr_requests?client_company_id=eq.${cx.clientId}&select=state`),
    db.get(`shr_contracts?client_company_id=eq.${cx.clientId}&status=eq.active&select=id`),
  ]);
  const docs = await docsFor(db, ws.map((x) => x.w.id));
  const all = ws.flatMap((x) => workerDto(x, docs, t, soon).docs);
  return {
    counts: {
      workers: ws.length,
      docs_expiring: all.filter((d) => d.status === "expiring").length,
      docs_expired: all.filter((d) => d.status === "expired").length,
      contracts_active: ks.length,
      open_requests: reqs.filter((r) => !TERMINAL.has(r.state)).length,
    },
    expiry_alert_days: soon,
  };
}

export async function listWorkers(db, cx) {
  const t = today(), soon = (await getSettings(db)).expiry_alert_days;
  const ws = await myWorkers(db, cx);
  const docs = await docsFor(db, ws.map((x) => x.w.id));
  return { workers: ws.map((x) => workerDto(x, docs, t, soon)), expiry_alert_days: soon };
}

export async function workerDetail(db, cx, q) {
  const id = needId(q.id);
  const t = today(), soon = (await getSettings(db)).expiry_alert_days;
  const hit = (await myWorkers(db, cx)).find((x) => x.w.id === id);
  if (!hit) throw new HttpError(404, "not_found");                 // عامل عميل آخر أو مستأجر آخر = غير موجود
  const docs = await docsFor(db, [id]);
  const dto = workerDto(hit, docs, t, soon);
  dto.assignment = { profession: hit.a.profession || null, starts_on: hit.a.starts_on || null, ends_on: hit.a.ends_on || null };
  // قوائم تحقق موجّهة للعميل على العامل فقط (audience=client, scope=worker). بند مرجعه غير مؤكد لا يظهر لعميل أصلاً.
  const [tpls, items, ticks] = await Promise.all([
    db.get("shr_checklist_templates?active=eq.true&audience=eq.client&scope=eq.worker&select=id,title_ar&order=created_at.asc"),
    db.get("shr_checklist_items?select=id,template_id,position,text_ar,required,rule_id&order=position.asc"),
    db.get(`shr_checklist_ticks?subject_kind=eq.worker&subject_id=eq.${id}&select=item_id,done,ticked_at&order=ticked_at.asc`),
  ]);
  const last = new Map();
  for (const k of ticks) last.set(k.item_id, !!k.done);                 // الأحدث يغلب
  const checklists = tpls.map((tp) => {
    const its = items.filter((x) => x.template_id === tp.id && (!x.rule_id || R.ruleUsable(x.rule_id)))
      .map((x) => ({ text_ar: x.text_ar, required: !!x.required, done: last.get(x.id) === true }));
    return { title_ar: tp.title_ar, items: its, complete: its.filter((x) => x.required).every((x) => x.done) };
  });
  return { worker: dto, checklists };
}

export async function listContracts(db, cx) {
  const [ks, ws] = await Promise.all([
    db.get(`shr_contracts?client_company_id=eq.${cx.clientId}&status=eq.active&select=id,version,starts_on,ends_on,status&order=starts_on.asc`),
    myWorkers(db, cx),
  ]);
  const t = today();
  return {
    contracts: ks.map((k) => ({
      id: k.id, version: k.version, starts_on: k.starts_on || null, ends_on: k.ends_on || null, status: "active",
      days_left: k.ends_on ? daysBetween(k.ends_on, t) : null,
      workers: ws.filter((x) => x.a.contract_id === k.id).length,
    })),
  };
}

export async function listRequests(db, cx) {
  const [rows, ws] = await Promise.all([
    db.get(`shr_requests?client_company_id=eq.${cx.clientId}&select=id,kind,state,body,created_at&order=created_at.desc`),
    myWorkers(db, cx),
  ]);
  const wn = Object.fromEntries(ws.map((x) => [x.w.id, x.w.full_name]));
  return {
    requests: rows.map((r) => {
      const b = r.body && typeof r.body === "object" ? r.body : {};
      return {
        id: r.id, kind: r.kind, state: r.state, created_at: r.created_at,
        note: typeof b.note === "string" ? b.note.slice(0, LIMITS.note) : null,
        profession: typeof b.profession === "string" ? b.profession.slice(0, LIMITS.profession) : null,
        quantity: Number.isInteger(b.quantity) ? b.quantity : null,
        worker_name: typeof b.worker_id === "string" && wn[b.worker_id] ? wn[b.worker_id] : null,
      };
    }),
    kinds: REQUEST_KINDS, can_request: cx.canWrite,
  };
}

// طلب جديد من client_admin. لا حالة من الجسم (تبدأ new والمشغّل وحده يغيّرها)، ولا client_company_id.
export async function createRequest(db, cx, b) {
  if (!cx.canWrite) throw new HttpError(403, "read_only_role");
  const kind = String(b.kind || "");
  if (!REQUEST_KINDS.includes(kind)) throw bad("bad_kind");
  const note = str(b.note, LIMITS.note);
  if (note.length < 3) throw bad("note_required");
  const profession = str(b.profession, LIMITS.profession) || null;
  let quantity = null;
  if (kind === "new_hire" && b.quantity !== undefined && b.quantity !== null && b.quantity !== "") {
    quantity = Number(b.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > LIMITS.quantity) throw bad("bad_quantity");
  }
  let worker_id = null;
  if (["termination", "transfer", "document"].includes(kind) && b.worker_id) {
    worker_id = needId(b.worker_id);
    if (!(await myWorkers(db, cx)).some((x) => x.w.id === worker_id)) throw new HttpError(404, "not_found");
  } else if (NEEDS_WORKER.has(kind)) throw bad("worker_required");
  // حماية من الإغراق: سقف للطلبات المفتوحة ولما يُقدَّم في الساعة، لكل عميل.
  const mine = await db.get(`shr_requests?client_company_id=eq.${cx.clientId}&select=state,created_at`);
  if (mine.filter((r) => !TERMINAL.has(r.state)).length >= LIMITS.maxOpen) throw new HttpError(429, "too_many_open_requests", { max: LIMITS.maxOpen });
  const hourAgo = Date.now() - 3600000;
  if (mine.filter((r) => Date.parse(r.created_at) > hourAgo).length >= LIMITS.maxPerHour) throw new HttpError(429, "rate_limited", { max: LIMITS.maxPerHour });
  const row = (await db.post("shr_requests", {
    client_company_id: cx.clientId, kind, state: "new", created_by: cx.user.sub,
    body: { note, profession, quantity, worker_id, source: "client_portal", demo: true },
  }))[0];
  await audit(db, cx.user, `client_request.create.${kind}`, "shr_requests", row.id);
  return { id: row.id, kind: row.kind, state: row.state, created_at: row.created_at };
}

// لا قراءة لـshr_invoices: المسودات داخلية. قسم فارغ صريح حتى يصدرها بدر بعد الاعتماد.
export function invoices() {
  return { invoices: [], available: false, note_ar: INVOICES_NOTE_AR };
}

export async function dispatch(action, { db, cx, b, q }) {
  switch (action) {
    case "session": case "client-session": return session(cx);
    case "client-home": return home(db, cx);
    case "client-workers": return listWorkers(db, cx);
    case "client-worker": return workerDetail(db, cx, q);
    case "client-contracts": return listContracts(db, cx);
    case "client-requests": return listRequests(db, cx);
    case "client-invoices": return invoices();
    case "client-request-create": return { request: await createRequest(db, cx, b) };
  }
  throw new HttpError(403, "role_not_allowed");
}
