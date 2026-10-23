// SHR-HR — بوابة العامل: بياناته وعقده ومستنداته وراتبه (قسم فارغ صريح) وطلباته. محلية، بيانات وهمية.
// كل وصول للبيانات عبر db = scoped(ctx) من _shr.js. لا شبكة ولا رسائل.
//
// النمط نفسه كبوابة العميل والمكاتب:
//  * هوية العامل من worker_id في صف shr_users تُقرأ من القاعدة في كل طلب، لا من الكوكي ولا من
//    الطلب؛ وفكّ الربط أو إيقاف العامل (غير active) يسري على الجلسة الحيّة فوراً. أي tenant_id أو
//    worker_id أو client_company_id في الطلب يُرفض في api/shr.js (400) قبل الوصول إلى هنا.
//  * العامل يرى نفسه فقط. كل ما يخرج قائمة بيضاء حرفية (DTO تُبنى حقلاً حقلاً، لا SELECT * ولا نشر
//    صف خام). لا يخرج: أي عامل آخر، المنشأة المشغِّلة وحالة قيدها، المخالفات وأسماء م33، أوامر
//    الاستقدام ومكاتبه، سجل التدقيق، بصمة الهوية ومفاتيح التخزين، العملاء الآخرون، أي سعر أو هامش.
//    يرى العميل المستفيد (اسم الشركة المسند إليها) والمهنة وتاريخ البدء فقط.
//  * معرّف عامل آخر في الطلب (id) = 404 لا 403: لا يُعرف وجوده.
//  * الراتب: لا راتب حقيقي ولا جداول رواتب في النظام. هذه الوحدة لا تقرأ جدول مسودات الرواتب
//    أصلاً (اختبار يمسح المصدر)، وتعرض قسماً فارغاً صريحاً حتى تصدر فرق Business Partner الكشف بعد الاعتماد.
//  * العقد: عقد العمل الموثَّق للعامل نفسه (مستند work_contract مرفوع + إسناد active) بملخص: النوع وتاريخ البدء.
//    عقد الإسناد بين المنشأة والعميل (يحمل المنشأة) لا يُقرأ هنا أصلاً: لا مسودات ولا ما يخص غيره.
//  * الطلبات: ثلاثة أنواع محدودة (مستند، تحديث بيان، استفسار) بنص مقصوص الطول وسقوف (مفتوح/ساعة)
//    وسجل تدقيق. العامل لا يغيّر الحالة؛ وطلبه يظهر للمشغّل في شاشة الطلبات (worker_id بلا client_company_id).
import { HttpError, audit } from "./_shr.js";
import { getSettings } from "./_shr_compliance.js";
import * as R from "./_shr_ref.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const WORKER_ROLES = new Set(["worker"]);
export const WORKER_GET = new Set(["worker-session", "worker-profile", "worker-contract", "worker-documents", "worker-salary", "worker-requests"]);
export const WORKER_POST = new Set(["worker-request-create"]);
export const WORKER_ACTIONS = new Set([...WORKER_GET, ...WORKER_POST]);

export const REQUEST_KINDS = ["worker_document", "worker_update", "worker_inquiry"];
// موضوع اختياري محدود بقائمة بيضاء لكل نوع (لا نص حرّ فيه).
export const TOPICS = {
  worker_document: ["work_contract", "iqama", "medical_insurance", "employment_letter", "other"],
  worker_update: ["personal_data", "contact", "other"],
  worker_inquiry: ["contract", "documents", "pay_statement", "other"],
};
const TERMINAL = new Set(["done", "rejected"]);
const SHOWN_DOCS = ["work_contract", "iqama", "medical_insurance"];     // العامل يرى ثلاثة مستندات: العقد والإقامة والتأمين الطبي
export const LIMITS = { note: 500, maxOpen: 5, maxPerHour: 5 };
export const SALARY_NOTE_AR = "يصدر كشف الراتب من فرق Business Partner بعد الاعتماد";

const bad = (code, extra) => new HttpError(400, code, extra);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

// ---------------------------------------------------------------- context --
// سياق العامل يُقرأ من القاعدة في كل طلب. غير مربوط، أو العامل ليس active (مسودة/بانتظار المستندات/مؤرشف): 403 فوراً.
export async function workerContext(db, session) {
  const sub = String(session.sub || "");
  if (!UUID.test(sub)) throw new HttpError(403, "role_not_allowed");
  const u = (await db.get(`shr_users?id=eq.${sub}&select=id,email,full_name,role,worker_id`))[0];
  if (!u || !WORKER_ROLES.has(u.role)) throw new HttpError(403, "role_not_allowed");
  if (!u.worker_id || !UUID.test(String(u.worker_id))) throw new HttpError(403, "worker_not_linked");
  const w = (await db.get(`shr_workers?id=eq.${u.worker_id}&select=id,full_name,nationality,profession,id_kind,status`))[0];
  if (!w || w.status !== "active") throw new HttpError(403, "worker_not_active");
  // الإسناد النشط: العميل المستفيد والمهنة وتاريخ البدء فقط (لا المنشأة ولا العقد).
  const asg = await db.get(`shr_assignments?worker_id=eq.${w.id}&status=eq.active&select=client_company_id,profession,starts_on&order=starts_on.desc`);
  const a = asg[0] || null;
  const c = a && a.client_company_id ? (await db.get(`shr_client_companies?id=eq.${a.client_company_id}&select=id,name_ar`))[0] : null;
  return {
    workerId: w.id, worker: w,
    assignment: a ? { client_name: c ? c.name_ar : null, profession: a.profession || null, starts_on: a.starts_on || null } : null,
    user: { sub: u.id, email: u.email, name: u.full_name || null, role: u.role },
  };
}

// معرّف اختياري في الطلب: يجب أن يكون معرّف العامل نفسه، وإلا 404 (عامل آخر أو مستأجر آخر لا يُعرف وجوده).
function ownId(wx, q) {
  if (q && q.id !== undefined && q.id !== "") {
    if (!UUID.test(String(q.id))) throw bad("bad_id");
    if (String(q.id) !== wx.workerId) throw new HttpError(404, "not_found");
  }
}

// ------------------------------------------------------------ DTO builders --
function docState(rows, kind, t, soonDays) {
  const mine = rows.filter((d) => d.kind === kind && d.storage_key);
  if (!mine.length) return { kind, status: "missing", expires_on: null, days_left: null };
  const best = mine.slice().sort((a, b) => String(b.expires_on || "9999-12-31").localeCompare(String(a.expires_on || "9999-12-31")))[0];
  if (!best.expires_on) return { kind, status: "no_expiry", expires_on: null, days_left: null };
  const left = daysBetween(best.expires_on, t);
  return { kind, status: left < 0 ? "expired" : left <= soonDays ? "expiring" : "valid", expires_on: best.expires_on, days_left: left };
}
const ATTENTION_RANK = ["expired", "missing", "expiring"];
const attentionOf = (docs) => ATTENTION_RANK.find((s) => docs.some((d) => d.status === s)) || "ok";

async function myDocs(db, wx) {
  const rows = await db.get(`shr_worker_documents?worker_id=eq.${wx.workerId}&select=kind,expires_on,storage_key`);
  return { rows, soon: (await getSettings(db)).expiry_alert_days };
}
const docsDto = (rows, soon) => SHOWN_DOCS.map((k) => docState(rows, k, today(), soon));

// ---------------------------------------------------------------- actions ---
export function session(wx) {
  return {
    user: { email: wx.user.email, name: wx.user.name, role: "worker" },
    worker: { full_name: wx.worker.full_name },
    can_request: true, tenant: null,
  };
}

export async function profile(db, wx, q) {
  ownId(wx, q);
  const { rows, soon } = await myDocs(db, wx);
  return {
    worker: { full_name: wx.worker.full_name, nationality: wx.worker.nationality || null, profession: wx.assignment && wx.assignment.profession || wx.worker.profession || null, id_kind: wx.worker.id_kind || null, status: wx.worker.status },
    assignment: wx.assignment ? { client_name: wx.assignment.client_name, profession: wx.assignment.profession, starts_on: wx.assignment.starts_on } : null,
    attention: attentionOf(docsDto(rows, soon)),
  };
}

export async function contract(db, wx, q) {
  ownId(wx, q);
  const { rows } = await myDocs(db, wx);
  const documented = rows.some((d) => d.kind === "work_contract" && d.storage_key);
  if (!wx.assignment || !documented) return { contract: null, available: false };
  return { contract: { type: "work_contract", status: "active", starts_on: wx.assignment.starts_on }, available: true };
}

export async function documents(db, wx, q) {
  ownId(wx, q);
  const { rows, soon } = await myDocs(db, wx);
  // قوائم التحقق الموجّهة للعامل (audience=worker, scope=worker). بند مرجعه غير مؤكد لا يظهر أصلاً.
  const [tpls, items, ticks] = await Promise.all([
    db.get("shr_checklist_templates?active=eq.true&audience=eq.worker&scope=eq.worker&select=id,title_ar&order=created_at.asc"),
    db.get("shr_checklist_items?select=id,template_id,position,text_ar,required,rule_id&order=position.asc"),
    db.get(`shr_checklist_ticks?subject_kind=eq.worker&subject_id=eq.${wx.workerId}&select=item_id,done,ticked_at&order=ticked_at.asc`),
  ]);
  const last = new Map();
  for (const k of ticks) last.set(k.item_id, !!k.done);
  const checklists = tpls.map((tp) => {
    const its = items.filter((x) => x.template_id === tp.id && (!x.rule_id || R.ruleUsable(x.rule_id)))
      .map((x) => ({ text_ar: x.text_ar, required: !!x.required, done: last.get(x.id) === true }));
    return { title_ar: tp.title_ar, items: its, complete: its.filter((x) => x.required).every((x) => x.done) };
  });
  return { documents: docsDto(rows, soon), expiry_alert_days: soon, checklists };
}

// لا قراءة لجداول الرواتب: قسم فارغ صريح حتى تصدر فرق Business Partner الكشف بعد الاعتماد. لا رقم يُخترع.
export function salary(wx, q) {
  ownId(wx, q);
  return { statements: [], available: false, note_ar: SALARY_NOTE_AR };
}

export async function listRequests(db, wx) {
  const rows = await db.get(`shr_requests?worker_id=eq.${wx.workerId}&select=id,kind,state,body,created_at&order=created_at.desc`);
  return {
    requests: rows.map((r) => {
      const b = r.body && typeof r.body === "object" ? r.body : {};
      const ok = TOPICS[r.kind] && TOPICS[r.kind].includes(b.topic);
      return { id: r.id, kind: r.kind, state: r.state, created_at: r.created_at, topic: ok ? b.topic : null, note: typeof b.note === "string" ? b.note.slice(0, LIMITS.note) : null };
    }),
    kinds: REQUEST_KINDS, topics: TOPICS, can_request: true,
  };
}

// طلب جديد من العامل. لا حالة من الجسم (تبدأ new والمشغّل وحده يغيّرها)، ولا worker_id ولا client_company_id.
export async function createRequest(db, wx, b) {
  const kind = String(b.kind || "");
  if (!REQUEST_KINDS.includes(kind)) throw bad("bad_kind");
  const note = str(b.note, LIMITS.note);
  if (note.length < 3) throw bad("note_required");
  let topic = null;
  if (b.topic !== undefined && b.topic !== null && b.topic !== "") {
    topic = String(b.topic);
    if (!TOPICS[kind].includes(topic)) throw bad("bad_topic");
  }
  // حماية من الإغراق: سقف للطلبات المفتوحة ولما يُقدَّم في الساعة، لكل عامل.
  const mine = await db.get(`shr_requests?worker_id=eq.${wx.workerId}&select=state,created_at`);
  if (mine.filter((r) => !TERMINAL.has(r.state)).length >= LIMITS.maxOpen) throw new HttpError(429, "too_many_open_requests", { max: LIMITS.maxOpen });
  const hourAgo = Date.now() - 3600000;
  if (mine.filter((r) => Date.parse(r.created_at) > hourAgo).length >= LIMITS.maxPerHour) throw new HttpError(429, "rate_limited", { max: LIMITS.maxPerHour });
  const row = (await db.post("shr_requests", {
    worker_id: wx.workerId, client_company_id: null, kind, state: "new", created_by: wx.user.sub,
    body: { note, topic, source: "worker_portal", demo: true },
  }))[0];
  await audit(db, wx.user, `worker_request.create.${kind}`, "shr_requests", row.id);
  return { id: row.id, kind: row.kind, state: row.state, created_at: row.created_at };
}

export async function dispatch(action, { db, wx, b, q }) {
  switch (action) {
    case "session": case "worker-session": return session(wx);
    case "worker-profile": return profile(db, wx, q);
    case "worker-contract": return contract(db, wx, q);
    case "worker-documents": return documents(db, wx, q);
    case "worker-salary": return salary(wx, q);
    case "worker-requests": return listRequests(db, wx);
    case "worker-request-create": return { request: await createRequest(db, wx, b) };
  }
  throw new HttpError(403, "role_not_allowed");
}
