// SHR-HR — بوابة المكاتب: مكاتب الاستقدام، أوامر الاستقدام، ومرشحو المكاتب.
// كل وصول للبيانات عبر db = scoped(ctx) من _shr.js. لا شبكة ولا رسائل. بيانات وهمية.
//
// ما يُنقل من أيّ مرجع نموذجاً وسلوكاً لا شيفرة:
//  * المكتب يرى الأوامر الموجّهة إليه (أو المفتوحة للمكاتب المعتمدة) ومرشحيه هو فقط؛
//    ما ليس له يرد 404 لا 403 (لا يُعرف وجوده). بلا اسم عميل ولا سعر ولا مراحل صاحب العمل.
//  * صاحب العمل لا يعرف اسم المكتب: «عبر شريك» فقط (employerOrderView قائمة بيضاء).
//  * هوية المكتب من agency_id في shr_users لا من اسمه نصاً؛ لا بيانات دخول في الرابط.
//  * المكتب يُسجَّل pending ويعتمده مستخدم آخر؛ لا دخول ولا أمر قبل approved.
//  * مرشحو المكتب في shr_agency_candidates وحدها؛ بلا هوية/هاتف/بريد: بصمة فقط.
//  * كشف التكرار: داخل المكتب يُرفض، وبين المكاتب يراه المشغّل وحده ولا يعلمه المكتب.
//  * الاستيراد الجماعي: تقرير لكل صف، والصف الفاسد لا يُسقط الباقي.
import crypto from "node:crypto";
import { HttpError, audit, hashIdNo, nameKeyOf } from "./_shr.js";
import { getSettings, assertEstablishmentOpen } from "./_shr_compliance.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const AGENCY_ACTIONS = new Set(["my-orders", "submit-candidate", "bulk-submit", "my-submissions", "my-interviews"]);
export const OPERATOR_ACTIONS = new Set(["agencies", "agency-create", "agency-approve", "agency-suspend", "order-create", "orders", "order-employer-view", "agency-submissions", "submission-state"]);
export const SUBMISSION_STATES = ["submitted", "under_review", "shortlisted", "interview", "accepted", "rejected"];
// الانتقالات المسموحة للمشغّل. accepted وrejected نهائيتان.
const NEXT = {
  submitted: ["under_review", "rejected"],
  under_review: ["shortlisted", "rejected"],
  shortlisted: ["interview", "accepted", "rejected"],
  interview: ["accepted", "rejected"],
  accepted: [], rejected: [],
};
// ما يراه المكتب فقط: لا مراحل صاحب العمل (مراجعة/قائمة قصيرة تُطوى في «مستلم»).
const AGENCY_STATUS = { submitted: "received", under_review: "received", shortlisted: "received", interview: "interview", accepted: "accepted", rejected: "not_selected" };
const MODES = ["onsite", "video", "phone"];
const MAX_BULK = 60;
const FORBIDDEN_KEYS = ["phone", "mobile", "email", "iqama", "national_id", "passport", "contact"];

const bad = (code, extra) => new HttpError(400, code, extra);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const needId = (v) => { if (!UUID.test(String(v || ""))) throw bad("bad_id"); return String(v); };
const nowIso = () => new Date().toISOString();
const rid = (p) => `DEMO-${p}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const strList = (v, max = 20) => {
  if (v == null || v === "") return [];
  if (!Array.isArray(v)) throw bad("bad_list");
  return v.map((x) => str(x, 60)).filter(Boolean).slice(0, max);
};
const yearsOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 60) throw bad("bad_years_experience");
  return n;
};
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

// ================================================================ operator ==
export async function listAgencies(db) {
  const [ags, users, orders, subs] = await Promise.all([
    db.get("shr_agencies?select=id,ref,name_ar,country,status,created_by,approved_by,approved_at,suspended_at,suspended_reason,archived_at,created_at&order=created_at.asc"),
    db.get("shr_users?role=eq.agency&select=id,email,agency_id"),
    db.get("shr_recruitment_orders?select=id,agency_id,archived_at"),
    db.get("shr_agency_candidates?select=id,agency_id,archived_at"),
  ]);
  return ags.filter((a) => !a.archived_at).map((a) => ({
    ...a,
    login_emails: users.filter((u) => u.agency_id === a.id).map((u) => u.email),
    orders: orders.filter((o) => o.agency_id === a.id && !o.archived_at).length,
    submissions: subs.filter((s) => s.agency_id === a.id && !s.archived_at).length,
  }));
}

export async function createAgency(db, user, b) {
  const name_ar = str(b.name_ar, 120);
  if (name_ar.length < 2) throw bad("name_required");
  const email = str(b.contact_email, 120).toLowerCase();
  // مرحلة تجريبية: لا بريد حقيقي يدخل النظام. نطاق .invalid فقط.
  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.invalid$/.test(email)) throw bad("demo_email_only");
  if ((await db.get(`shr_users?email=eq.${encodeURIComponent(email)}&select=id`))[0]) throw new HttpError(409, "email_taken");
  const a = (await db.post("shr_agencies", {
    ref: rid("AG"), name_ar, country: str(b.country, 60) || null,
    status: "pending", created_by: user.sub, approved_by: null, approved_at: null,
    suspended_by: null, suspended_at: null, suspended_reason: null, archived_at: null, demo: true,
  }))[0];
  await db.post("shr_users", { email, full_name: `مستخدم ${name_ar}`, role: "agency", agency_id: a.id });
  await audit(db, user, "agency.create", "shr_agencies", a.id);
  return { id: a.id, ref: a.ref, status: "pending" };
}

export async function approveAgency(db, user, b) {
  const id = needId(b.id);
  const a = (await db.get(`shr_agencies?id=eq.${id}&select=id,status,created_by,archived_at`))[0];
  if (!a || a.archived_at) throw new HttpError(404, "not_found");
  if (a.status === "approved") throw new HttpError(409, "already_approved");
  // من أنشأ المكتب لا يعتمده.
  if (a.created_by === user.sub) throw new HttpError(403, "maker_checker");
  await db.patch(`shr_agencies?id=eq.${id}&status=eq.${a.status}`, {
    status: "approved", approved_by: user.sub, approved_at: nowIso(), suspended_by: null, suspended_at: null, suspended_reason: null,
  });
  await audit(db, user, `agency.approve.${a.status}->approved`, "shr_agencies", id);
  return { id, status: "approved" };
}

export async function suspendAgency(db, user, b) {
  const id = needId(b.id);
  const a = (await db.get(`shr_agencies?id=eq.${id}&select=id,status,archived_at`))[0];
  if (!a || a.archived_at) throw new HttpError(404, "not_found");
  if (a.status === "suspended") return { id, status: "suspended" };
  if (a.status !== "approved") throw new HttpError(409, "not_approved");   // pending لا يُوقَف: يُترك بلا اعتماد
  await db.patch(`shr_agencies?id=eq.${id}&status=eq.approved`, {
    status: "suspended", suspended_by: user.sub, suspended_at: nowIso(), suspended_reason: str(b.reason, 200) || null,
  });
  await audit(db, user, "agency.suspend", "shr_agencies", id);
  return { id, status: "suspended" };
}

export async function createOrder(db, user, b) {
  const profession = str(b.profession, 80);
  if (profession.length < 2) throw bad("profession_required");
  const qn = b.quantity === undefined ? 1 : Number(b.quantity);
  if (!Number.isInteger(qn) || qn < 1 || qn > 500) throw bad("bad_quantity");
  // الوجهة صريحة: مكتب بمعرّفه، أو الكلمة open. الغياب خطأ حتى لا يُبثّ أمر بالسهو.
  const dest = b.agency_id === undefined || b.agency_id === null || b.agency_id === "" ? "" : String(b.agency_id);
  if (!dest) throw bad("agency_or_open_required");
  let agency_id = null;
  if (dest !== "open") {
    agency_id = needId(dest);
    const ag = (await db.get(`shr_agencies?id=eq.${agency_id}&select=id,status,archived_at`))[0];
    if (!ag || ag.archived_at) throw new HttpError(404, "not_found");
    if (ag.status !== "approved") throw new HttpError(409, "agency_not_approved");   // pending/suspended لا يستلم أوامر
  }
  const opt = async (table, v) => {
    if (!v) return null;
    const id = needId(v);
    if (!(await db.get(`${table}?id=eq.${id}&select=id`))[0]) throw new HttpError(404, "not_found");
    return id;
  };
  const client_company_id = await opt("shr_client_companies", b.client_company_id);
  const request_id = await opt("shr_requests", b.request_id);
  const establishment_id = await opt("shr_establishments", b.establishment_id);
  const dueRaw = str(b.due_on, 10);
  if (dueRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) throw bad("bad_due_on");
  // حجب أوامر الاستقدام لمنشأة restricted/suspected (409 establishment_blocked مع السبب)؛ وunknown تحذير
  // ما لم يفعّل المستأجر unknown_blocks. الحالة من لقطات الامتثال المتحقَّق منها لا من حقل واحد.
  const warnings = establishment_id ? await assertEstablishmentOpen(db, establishment_id, await getSettings(db)) : [];
  const o = (await db.post("shr_recruitment_orders", {
    ref: rid("ORD"), request_id, client_company_id, establishment_id, agency_id, profession, quantity: qn,
    nationality_pref: strList(b.nationality_pref), agency_brief: str(b.agency_brief, 300) || null,
    due_on: dueRaw || null, state: "open", created_by: user.sub, archived_at: null, demo: true,
  }))[0];
  await audit(db, user, "order.create", "shr_recruitment_orders", o.id);
  return { id: o.id, ref: o.ref, state: o.state, scope: agency_id ? "directed" : "open", warnings };
}

export async function listOrders(db) {
  const [orders, ags, clients, subs] = await Promise.all([
    db.get("shr_recruitment_orders?select=id,ref,agency_id,client_company_id,profession,quantity,nationality_pref,agency_brief,due_on,state,created_at,archived_at&order=created_at.asc"),
    db.get("shr_agencies?select=id,name_ar"),
    db.get("shr_client_companies?select=id,name_ar"),
    db.get("shr_agency_candidates?select=order_id,state,archived_at"),
  ]);
  const am = byId(ags), cm = byId(clients);
  return orders.filter((o) => !o.archived_at).map((o) => {
    const mine = subs.filter((s) => s.order_id === o.id && !s.archived_at);
    return {
      ...o, scope: o.agency_id ? "directed" : "open",
      agency: o.agency_id && am[o.agency_id] ? am[o.agency_id].name_ar : null,
      client: o.client_company_id && cm[o.client_company_id] ? cm[o.client_company_id].name_ar : null,
      submissions: mine.length, accepted: mine.filter((s) => s.state === "accepted").length,
    };
  });
}

// ما يُعرض لصاحب العمل عن أمر استقدام. قائمة بيضاء حرفية: لا اسم مكتب ولا معرّفه ولا بلده،
// ولا أي حقل غير مذكور هنا. «عبر شريك» هو كل ما يُقال عن المصدر.
export const PARTNER_LABEL = "عبر شريك";
export async function employerOrderView(db, q) {
  const id = needId(q.id);
  const o = (await db.get(`shr_recruitment_orders?id=eq.${id}&select=id,ref,profession,quantity,state,due_on`))[0];
  if (!o) throw new HttpError(404, "not_found");
  const subs = await db.get(`shr_agency_candidates?order_id=eq.${id}&select=id,ref,full_name,profession,nationality,years_experience,state,archived_at&order=created_at.asc`);
  return {
    order: { ref: o.ref, profession: o.profession, quantity: o.quantity, state: o.state, due_on: o.due_on, source: PARTNER_LABEL },
    candidates: subs.filter((s) => !s.archived_at).map((s) => ({
      ref: s.ref, full_name: s.full_name, profession: s.profession, nationality: s.nationality,
      years_experience: s.years_experience, state: s.state, source: PARTNER_LABEL,
    })),
  };
}

// مراجعة المشغّل. التكرار بين المكاتب محسوب عند القراءة (لا يُخزَّن) ويراه المشغّل وحده.
export async function listSubmissions(db, q) {
  const state = q.state ? String(q.state) : "";
  if (state && !SUBMISSION_STATES.includes(state)) throw bad("bad_state");
  const filters = (q.order_id ? `&order_id=eq.${needId(q.order_id)}` : "") + (q.agency_id ? `&agency_id=eq.${needId(q.agency_id)}` : "");
  const [subs, ags, orders, ivs] = await Promise.all([
    db.get(`shr_agency_candidates?select=id,ref,order_id,agency_id,full_name,profession,nationality,years_experience,skills,id_no_hash,name_key,state,submitted_by,reviewed_by,reviewed_at,review_note,archived_at,created_at${filters}&order=created_at.asc`),
    db.get("shr_agencies?select=id,name_ar"),
    db.get("shr_recruitment_orders?select=id,ref,profession"),
    db.get("shr_agency_interviews?select=id,submission_id,state,mode,location,scheduled_at,agency_note"),
  ]);
  const am = byId(ags), om = byId(orders);
  const live = subs.filter((s) => !s.archived_at);
  // التكرار على أمر واحد: بصمة هوية أو بصمة اسم، من أي مكتب.
  const dupOf = (s) => live.filter((x) => x.id !== s.id && x.order_id === s.order_id
    && ((s.id_no_hash && x.id_no_hash === s.id_no_hash) || x.name_key === s.name_key));
  return live.filter((s) => !state || s.state === state).map((s) => {
    const dups = dupOf(s);
    const iv = ivs.filter((i) => i.submission_id === s.id && i.state !== "cancelled").pop() || null;
    const { id_no_hash, name_key, ...rest } = s;      // البصمات لا تخرج
    return {
      ...rest, agency: am[s.agency_id] ? am[s.agency_id].name_ar : null,
      order_ref: om[s.order_id] ? om[s.order_id].ref : null,
      duplicates: dups.map((d) => ({ ref: d.ref, agency: am[d.agency_id] ? am[d.agency_id].name_ar : null, same_agency: d.agency_id === s.agency_id })),
      cross_agency_duplicate: dups.some((d) => d.agency_id !== s.agency_id),
      interview: iv ? { state: iv.state, mode: iv.mode, scheduled_at: iv.scheduled_at } : null,
    };
  });
}

export async function setSubmissionState(db, user, b) {
  const id = needId(b.id);
  const to = String(b.state || "");
  if (!SUBMISSION_STATES.includes(to)) throw bad("bad_state");
  const s = (await db.get(`shr_agency_candidates?id=eq.${id}&select=id,state,agency_id,submitted_by,archived_at`))[0];
  if (!s) throw new HttpError(404, "not_found");
  if (s.archived_at) throw new HttpError(409, "archived");
  if (s.state === to) throw new HttpError(409, "same_state");
  if (!NEXT[s.state].includes(to)) throw new HttpError(409, "bad_transition", { from: s.state, allowed: NEXT[s.state] });
  // من قدّم لا يراجع (احتياط: من يحمل معرّف المقدِّم لا يعتمد ما قدّمه).
  if (s.submitted_by === user.sub) throw new HttpError(403, "maker_checker");
  let when = null, mode = null;
  if (to === "interview") {
    mode = b.mode ? String(b.mode) : null;
    if (mode && !MODES.includes(mode)) throw bad("bad_mode");
    if (b.scheduled_at !== undefined && b.scheduled_at !== null && b.scheduled_at !== "") {
      const t = Date.parse(String(b.scheduled_at));
      if (!Number.isFinite(t)) throw bad("bad_time");
      when = new Date(t).toISOString();
    }
  }
  await db.patch(`shr_agency_candidates?id=eq.${id}&state=eq.${s.state}`, { state: to, reviewed_by: user.sub, reviewed_at: nowIso(), review_note: str(b.note, 300) || null });
  await db.post("shr_agency_candidate_events", { submission_id: id, from_state: s.state, to_state: to, actor: user.sub, note: str(b.note, 300) || null, at: nowIso() });
  if (to === "interview") {
    await db.post("shr_agency_interviews", {
      submission_id: id, agency_id: s.agency_id, state: when ? "scheduled" : "requested", mode, location: str(b.location, 160) || null,
      scheduled_at: when, agency_note: str(b.agency_note, 300) || null, requested_by: user.sub, scheduled_by: when ? user.sub : null,
    });
  } else if (to === "accepted" || to === "rejected") {
    await db.patch(`shr_agency_interviews?submission_id=eq.${id}&state=in.(requested,scheduled)`, { state: to === "accepted" ? "done" : "cancelled" });
  }
  await audit(db, user, `agency_submission.state.${s.state}->${to}`, "shr_agency_candidates", id);
  return { id, state: to, from: s.state };
}

// ================================================================== agency ==
// سياق المكتب: يُقرأ من القاعدة في كل طلب، لا من الكوكي وحده. إيقاف المكتب أو
// حذف مستخدمه يسري فوراً. agency_id من صف shr_users لا من اسم المكتب ولا من الطلب.
export async function agencyContext(db, session) {
  const u = (await db.get(`shr_users?id=eq.${String(session.sub || "")}&select=id,email,role,agency_id`))[0];
  if (!u || u.role !== "agency" || !u.agency_id) throw new HttpError(403, "role_not_allowed");
  const ag = (await db.get(`shr_agencies?id=eq.${u.agency_id}&select=id,ref,name_ar,status,archived_at`))[0];
  if (!ag || ag.archived_at || ag.status !== "approved") throw new HttpError(403, "agency_not_approved");
  return { agencyId: ag.id, agency: ag, user: { sub: u.id, email: u.email, role: "agency" } };
}

// الأوامر المرئية للمكتب: الموجَّهة إليه + المفتوحة، غير المسودة وغير المؤرشفة.
async function visibleOrders(db, ag) {
  const [mine, open] = await Promise.all([
    db.get(`shr_recruitment_orders?agency_id=eq.${ag.agencyId}&select=id,ref,profession,quantity,nationality_pref,agency_brief,due_on,state,archived_at,created_at&order=created_at.asc`),
    db.get("shr_recruitment_orders?agency_id=is.null&select=id,ref,profession,quantity,nationality_pref,agency_brief,due_on,state,archived_at,created_at&order=created_at.asc"),
  ]);
  return [...mine.map((o) => ({ ...o, scope: "directed" })), ...open.map((o) => ({ ...o, scope: "open" }))]
    .filter((o) => !o.archived_at && o.state !== "draft");
}

export async function myOrders(db, ag, q) {
  const orders = await visibleOrders(db, ag);
  const subs = await db.get(`shr_agency_candidates?agency_id=eq.${ag.agencyId}&select=order_id,archived_at`);
  const shaped = orders.map((o) => ({
    id: o.id, ref: o.ref, profession: o.profession, quantity: o.quantity, nationality_pref: o.nationality_pref || [],
    brief: o.agency_brief || null, due_on: o.due_on, state: o.state, scope: o.scope,
    my_submissions: subs.filter((s) => s.order_id === o.id && !s.archived_at).length,
  }));
  if (q && q.id) {
    const one = shaped.find((o) => o.id === String(q.id));
    if (!one) throw new HttpError(404, "not_found");           // أمر مكتب آخر = غير موجود
    return { order: one };
  }
  return { orders: shaped };
}

// فحص صف مرشح من المكتب: مواصفات فقط. أي حقل اتصال أو هوية خام يُرفض.
function cleanRow(tenantId, row) {
  for (const k of FORBIDDEN_KEYS) if (k in row) throw bad("contact_fields_not_allowed");
  const full_name = str(row.full_name ?? row.name, 120);
  if (full_name.length < 2) throw bad("full_name_required");
  const id_no = str(row.id_no, 40);
  const profession = str(row.profession, 80) || null;
  const nationality = str(row.nationality, 60) || null;
  return {
    full_name, profession, nationality, years_experience: yearsOrNull(row.years_experience), skills: strList(row.skills),
    id_no_hash: id_no ? hashIdNo(tenantId, id_no) : null,
    name_key: nameKeyOf(tenantId, full_name, nationality, profession),
  };
}

// تكرار داخل المكتب نفسه على الأمر نفسه. لا يُكشف شيء عن مكاتب أخرى.
const isDupOwn = (existing, c) => existing.some((e) => !e.archived_at && ((c.id_no_hash && e.id_no_hash === c.id_no_hash) || e.name_key === c.name_key));

async function insertSubmission(db, ag, order, c) {
  const row = (await db.post("shr_agency_candidates", {
    ref: rid("A"), order_id: order.id, agency_id: ag.agencyId, ...c, state: "submitted",
    submitted_by: ag.user.sub, reviewed_by: null, reviewed_at: null, review_note: null, archived_at: null, demo: true,
  }))[0];
  await db.post("shr_agency_candidate_events", { submission_id: row.id, from_state: null, to_state: "submitted", actor: ag.user.sub, note: null, at: nowIso() });
  return row;
}

export async function submitCandidate(db, ag, b) {
  const orders = await visibleOrders(db, ag);
  const order = orders.find((o) => o.id === String(b.order_id || ""));
  if (!order) { if (b.order_id) needId(b.order_id); throw new HttpError(404, "not_found"); }
  if (order.state !== "open") throw new HttpError(409, "order_closed");
  const c = cleanRow(db.ctx.tenantId, b);
  const own = await db.get(`shr_agency_candidates?agency_id=eq.${ag.agencyId}&order_id=eq.${order.id}&select=id,ref,id_no_hash,name_key,archived_at`);
  if (isDupOwn(own, c)) throw new HttpError(409, "duplicate_candidate");
  const row = await insertSubmission(db, ag, order, c);
  await audit(db, ag.user, "agency_submission.create", "shr_agency_candidates", row.id);
  return { id: row.id, ref: row.ref, status: AGENCY_STATUS.submitted };
}

// استيراد جماعي: الصف الفاسد يُبلَّغ برقم سطره ولا يوقف الباقي. لا قصّ صامت: فوق السقف يُرفض الطلب كله.
export async function bulkSubmit(db, ag, b) {
  if (!Array.isArray(b.rows) || !b.rows.length) throw bad("no_rows");
  if (b.rows.length > MAX_BULK) throw bad("too_many_rows", { max: MAX_BULK });
  const orders = byId(await visibleOrders(db, ag));
  const own = await db.get(`shr_agency_candidates?agency_id=eq.${ag.agencyId}&select=id,order_id,id_no_hash,name_key,archived_at`);
  const seen = [];                                  // بصمات هذا الملف نفسه
  const errors = [];
  let created = 0;
  for (let i = 0; i < b.rows.length; i++) {
    const row = b.rows[i] && typeof b.rows[i] === "object" && !Array.isArray(b.rows[i]) ? b.rows[i] : {};
    const line = Number(row.line) || i + 1;
    const fail = (error) => errors.push({ line, error });
    try {
      const orderId = String(row.order_id || b.order_id || "");
      const order = orders[orderId];
      if (!order) { fail("order_not_found"); continue; }
      if (order.state !== "open") { fail("order_closed"); continue; }
      const c = cleanRow(db.ctx.tenantId, row);
      const pool = [...own.filter((e) => e.order_id === order.id), ...seen.filter((e) => e.order_id === order.id)];
      if (isDupOwn(pool, c)) { fail(seen.some((e) => e.order_id === order.id && (e.name_key === c.name_key || (c.id_no_hash && e.id_no_hash === c.id_no_hash))) ? "duplicate_in_file" : "duplicate_candidate"); continue; }
      await insertSubmission(db, ag, order, c);
      seen.push({ order_id: order.id, id_no_hash: c.id_no_hash, name_key: c.name_key });
      created++;
    } catch (e) {
      if (e instanceof HttpError) fail(e.code); else throw e;
    }
  }
  await audit(db, ag.user, `agency_submission.bulk.${created}of${b.rows.length}`, "shr_agencies", ag.agencyId);
  return { created, skipped: errors.length, errors };
}

export async function mySubmissions(db, ag, q) {
  const [subs, orders, ivs] = await Promise.all([
    db.get(`shr_agency_candidates?agency_id=eq.${ag.agencyId}&select=id,ref,order_id,full_name,profession,nationality,years_experience,state,archived_at,created_at&order=created_at.asc`),
    db.get(`shr_recruitment_orders?select=id,ref`),
    db.get(`shr_agency_interviews?agency_id=eq.${ag.agencyId}&select=submission_id,state,mode,scheduled_at`),
  ]);
  const om = byId(orders);
  let rows = subs.filter((s) => !s.archived_at).map((s) => {
    const iv = ivs.filter((i) => i.submission_id === s.id && i.state !== "cancelled").pop() || null;
    return {
      id: s.id, ref: s.ref, order_id: s.order_id, order_ref: om[s.order_id] ? om[s.order_id].ref : null,
      full_name: s.full_name, profession: s.profession, nationality: s.nationality, years_experience: s.years_experience,
      status: AGENCY_STATUS[s.state] || "received", submitted_at: s.created_at,
      interview: iv ? { state: iv.state, mode: iv.mode, scheduled_at: iv.scheduled_at } : null,
    };
  });
  if (q && q.id) {
    const one = rows.find((s) => s.id === String(q.id));
    if (!one) throw new HttpError(404, "not_found");
    return { submission: one };
  }
  if (q && q.order_id) {
    // أمر ليس للمكتب: 404 لا قائمة فارغة، فلا يُعرف وجوده.
    if (!(await visibleOrders(db, ag)).some((o) => o.id === String(q.order_id))) throw new HttpError(404, "not_found");
    rows = rows.filter((s) => s.order_id === String(q.order_id));
  }
  return { submissions: rows };
}

export async function myInterviews(db, ag) {
  const [ivs, subs] = await Promise.all([
    db.get(`shr_agency_interviews?agency_id=eq.${ag.agencyId}&select=id,submission_id,state,mode,location,scheduled_at,agency_note,created_at&order=created_at.asc`),
    db.get(`shr_agency_candidates?agency_id=eq.${ag.agencyId}&select=id,ref,full_name`),
  ]);
  const sm = byId(subs);
  return ivs.map((i) => ({
    id: i.id, state: i.state, mode: i.mode, location: i.location, scheduled_at: i.scheduled_at, note: i.agency_note || null,
    candidate: sm[i.submission_id] ? { ref: sm[i.submission_id].ref, full_name: sm[i.submission_id].full_name } : null,
  }));
}
