// SHR-HR — منطق ATS: وظائف، طلبات تقديم ومراحلها، مقابلات، مطابقة.
// كل وصول للبيانات عبر db = scoped(ctx) من _shr.js. لا شبكة ولا رسائل: الجدولة
// سجل داخلي فقط. بيانات وهمية. لا حذف: الإغلاق والأرشفة فقط.
import { HttpError, audit } from "./_shr.js";
import { runMatch, normalizeWeights, COMPONENT_KEYS } from "./_shr_match.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STAGES = ["new", "review", "shortlist", "interview", "offer", "hired", "rejected", "future"];
const FINAL = new Set(["hired"]);                 // لا يُنقل منه
const CLOSED_FOR_INTERVIEW = new Set(["hired", "rejected"]);
const MODES = ["onsite", "video", "phone"];
const RESIDENCY = ["transferable", "any"];

const bad = (code, extra) => new HttpError(400, code, extra);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const needId = (v) => { if (!UUID.test(String(v || ""))) throw bad("bad_id"); return String(v); };
const strList = (v, max = 20) => {
  if (v == null || v === "") return [];
  if (!Array.isArray(v)) throw bad("bad_list");
  return v.map((x) => str(x, 60)).filter(Boolean).slice(0, max);
};
const intOrNull = (v, name, max = 60) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) throw bad("bad_" + name);
  return n;
};
const nowIso = () => new Date().toISOString();

// الموافقة السارية: سجل بلا سحب. آخر سجل لكل مرشح يحسم.
function activeConsentSet(consents) {
  const latest = new Map();
  for (const c of consents) {
    const prev = latest.get(c.candidate_id);
    if (!prev || String(c.granted_at) > String(prev.granted_at)) latest.set(c.candidate_id, c);
  }
  const ok = new Set();
  for (const [id, c] of latest) if (c.granted_at && !c.withdrawn_at) ok.add(id);
  return ok;
}
const consentRows = (db, extra = "") => db.get(`shr_candidate_consents?select=id,candidate_id,text_version,granted_at,source,withdrawn_at,withdrawn_reason${extra}`);

const candidateCard = (c, consent) => ({
  id: c.id, ref: c.ref, full_name: c.full_name, profession: c.profession, nationality: c.nationality, city: c.city,
  years_experience: c.years_experience, residency_transferable: c.residency_transferable,
  willing_to_relocate: c.willing_to_relocate, notice_days: c.notice_days, skills: c.skills || [], demo: c.demo !== false,
  consent: consent || "none",
});

// ------------------------------------------------------------------- jobs --
export async function listJobs(db) {
  const [jobs, apps] = await Promise.all([
    db.get("shr_jobs?select=id,title,profession,city,experience_years,residency_required,nationality_pref,skills,must_have,headcount,status,closed_at,created_at&order=created_at.desc"),
    db.get("shr_applications?select=job_id,stage,archived_at"),
  ]);
  return jobs.map((j) => {
    const mine = apps.filter((a) => a.job_id === j.id && !a.archived_at);
    return { ...j, applications: mine.length, hired: mine.filter((a) => a.stage === "hired").length };
  });
}

export async function createJob(db, user, b) {
  const title = str(b.title, 120);
  if (title.length < 2) throw bad("title_required");
  const residency_required = b.residency_required === undefined ? "any" : String(b.residency_required);
  if (!RESIDENCY.includes(residency_required)) throw bad("bad_residency_required");
  const headcount = b.headcount === undefined ? 1 : intOrNull(b.headcount, "headcount", 500);
  if (!headcount) throw bad("bad_headcount");
  let client_company_id = null;
  if (b.client_company_id) {
    client_company_id = needId(b.client_company_id);
    if (!(await db.get(`shr_client_companies?id=eq.${client_company_id}&select=id`))[0]) throw new HttpError(404, "not_found");
  }
  const row = {
    client_company_id, title, profession: str(b.profession, 80) || null, city: str(b.city, 60) || null,
    experience_years: intOrNull(b.experience_years, "experience_years", 60), residency_required,
    nationality_pref: strList(b.nationality_pref), skills: strList(b.skills), must_have: strList(b.must_have),
    headcount, status: "open", closed_at: null, created_by: user.sub,
  };
  const j = (await db.post("shr_jobs", row))[0];
  await audit(db, user, "job.create", "shr_jobs", j.id);
  return { id: j.id, title: j.title, status: j.status };
}

export async function closeJob(db, user, b) {
  const id = needId(b.id);
  const j = (await db.get(`shr_jobs?id=eq.${id}&select=id,status`))[0];
  if (!j) throw new HttpError(404, "not_found");
  if (j.status === "closed") return { id, status: "closed" };
  await db.patch(`shr_jobs?id=eq.${id}`, { status: "closed", closed_at: nowIso() });
  await audit(db, user, "job.close", "shr_jobs", id);
  return { id, status: "closed" };
}

// ------------------------------------------------------------- candidates --
export async function listCandidates(db) {
  const [cands, consents] = await Promise.all([
    db.get("shr_candidates?select=*&order=created_at.asc"),
    consentRows(db),
  ]);
  const ok = activeConsentSet(consents);
  const hasAny = new Set(consents.map((c) => c.candidate_id));
  return cands.filter((c) => !c.archived_at).map((c) => candidateCard(c, ok.has(c.id) ? "active" : hasAny.has(c.id) ? "withdrawn" : "none"));
}

export async function candidateDetail(db, q) {
  const id = needId(q.id);
  const c = (await db.get(`shr_candidates?id=eq.${id}&select=*`))[0];
  if (!c) throw new HttpError(404, "not_found");
  const [consents, apps, jobs] = await Promise.all([
    consentRows(db, `&candidate_id=eq.${id}&order=granted_at.desc`),
    db.get(`shr_applications?candidate_id=eq.${id}&select=id,job_id,stage,created_at`),
    db.get("shr_jobs?select=id,title"),
  ]);
  const ok = activeConsentSet(consents);
  const ids = apps.map((a) => a.id);
  const [events, interviews] = ids.length ? await Promise.all([
    db.get(`shr_application_events?application_id=in.(${ids.join(",")})&select=application_id,from_stage,to_stage,note,at&order=at.asc`),
    db.get(`shr_interviews?application_id=in.(${ids.join(",")})&select=id,application_id,state,mode,location,scheduled_at,note&order=created_at.asc`),
  ]) : [[], []];
  const jt = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
  return {
    candidate: candidateCard(c, ok.has(id) ? "active" : consents.length ? "withdrawn" : "none"),
    consents,
    applications: apps.map((a) => ({
      ...a, job: jt[a.job_id] || null,
      events: events.filter((e) => e.application_id === a.id),
      interviews: interviews.filter((i) => i.application_id === a.id),
    })),
  };
}

// ----------------------------------------------------------- applications --
export async function listApplications(db, q) {
  const stage = q.stage ? String(q.stage) : "";
  if (stage && !STAGES.includes(stage)) throw bad("bad_stage");
  const jobFilter = q.job_id ? `&job_id=eq.${needId(q.job_id)}` : "";
  const [apps, cands, jobs, ivs] = await Promise.all([
    db.get(`shr_applications?select=id,job_id,candidate_id,stage,created_by,offer_proposed_by,offer_approved_by,archived_at,created_at,updated_at${stage ? `&stage=eq.${stage}` : ""}${jobFilter}&order=created_at.asc`),
    db.get("shr_candidates?select=id,ref,full_name,profession,nationality,city"),
    db.get("shr_jobs?select=id,title,status"),
    db.get("shr_interviews?select=application_id,state,scheduled_at"),
  ]);
  const cm = Object.fromEntries(cands.map((c) => [c.id, c]));
  const jm = Object.fromEntries(jobs.map((j) => [j.id, j]));
  return {
    stages: STAGES,
    applications: apps.filter((a) => !a.archived_at).map((a) => {
      const c = cm[a.candidate_id] || {}, j = jm[a.job_id] || {};
      const iv = ivs.filter((x) => x.application_id === a.id && x.state !== "cancelled").pop() || null;
      return {
        ...a, candidate: { id: a.candidate_id, ref: c.ref, full_name: c.full_name, profession: c.profession, nationality: c.nationality, city: c.city },
        job: { id: a.job_id, title: j.title, status: j.status }, interview: iv ? { state: iv.state, scheduled_at: iv.scheduled_at } : null,
      };
    }),
  };
}

// extra.post_id: الطلب أُدخل من إعلان وظيفة (api/_shr_posts.js)؛ بقية القواعد (موافقة سارية، وظيفة مفتوحة، لا تكرار) كما هي.
export async function createApplication(db, user, b, extra = {}) {
  const job_id = needId(b.job_id), candidate_id = needId(b.candidate_id);
  const [job, cand] = await Promise.all([
    db.get(`shr_jobs?id=eq.${job_id}&select=id,status`).then((r) => r[0]),
    db.get(`shr_candidates?id=eq.${candidate_id}&select=id,archived_at`).then((r) => r[0]),
  ]);
  if (!job || !cand) throw new HttpError(404, "not_found");
  if (job.status !== "open") throw new HttpError(409, "job_closed");
  if (cand.archived_at) throw new HttpError(409, "candidate_archived");
  // لا طلب تقديم لمن لا موافقة سارية له.
  if (!activeConsentSet(await consentRows(db, `&candidate_id=eq.${candidate_id}`)).has(candidate_id)) throw new HttpError(409, "no_consent");
  if ((await db.get(`shr_applications?job_id=eq.${job_id}&candidate_id=eq.${candidate_id}&select=id`))[0]) throw new HttpError(409, "duplicate_application");
  const a = (await db.post("shr_applications", {
    job_id, candidate_id, stage: "new", created_by: user.sub, offer_proposed_by: null, offer_approved_by: null, archived_at: null, updated_at: null,
    ...(extra.post_id ? { post_id: extra.post_id } : {}),
  }))[0];
  await db.post("shr_application_events", { application_id: a.id, from_stage: null, to_stage: "new", actor: user.sub, note: str(b.note, 300) || null, at: nowIso() });
  await audit(db, user, "application.create", "shr_applications", a.id);
  return { id: a.id, stage: "new" };
}

export async function setStage(db, user, b) {
  const id = needId(b.id);
  const to = String(b.stage || "");
  if (!STAGES.includes(to)) throw bad("bad_stage");
  const a = (await db.get(`shr_applications?id=eq.${id}&select=id,stage,created_by,offer_proposed_by,archived_at`))[0];
  if (!a) throw new HttpError(404, "not_found");
  if (a.archived_at) throw new HttpError(409, "archived");
  if (a.stage === to) throw new HttpError(409, "same_stage");
  if (FINAL.has(a.stage)) throw new HttpError(409, "terminal_stage");
  const patch = { stage: to, updated_at: nowIso() };
  if (to === "offer") { patch.offer_proposed_by = user.sub; patch.offer_approved_by = null; }
  if (to === "hired") {
    // التعيين = اعتماد العرض: يجب أن يمرّ بـ«عرض»، ولا يعتمده من أدخل الطلب ولا من اقترح العرض.
    if (a.stage !== "offer") throw new HttpError(409, "offer_required");
    if (a.created_by === user.sub || a.offer_proposed_by === user.sub) throw new HttpError(403, "maker_checker");
    patch.offer_approved_by = user.sub;
  }
  // الشرط على المرحلة الحالية يمنع سباقاً بين مستخدمين.
  await db.patch(`shr_applications?id=eq.${id}&stage=eq.${a.stage}`, patch);
  await db.post("shr_application_events", { application_id: id, from_stage: a.stage, to_stage: to, actor: user.sub, note: str(b.note, 300) || null, at: nowIso() });
  await audit(db, user, `application.stage.${a.stage}->${to}`, "shr_applications", id);
  return { id, stage: to, from: a.stage };
}

// -------------------------------------------------------------- interviews --
export async function requestInterview(db, user, b) {
  const application_id = needId(b.application_id);
  const a = (await db.get(`shr_applications?id=eq.${application_id}&select=id,stage,archived_at`))[0];
  if (!a) throw new HttpError(404, "not_found");
  if (a.archived_at || CLOSED_FOR_INTERVIEW.has(a.stage)) throw new HttpError(409, "application_closed");
  const mode = b.mode ? String(b.mode) : null;
  if (mode && !MODES.includes(mode)) throw bad("bad_mode");
  const iv = (await db.post("shr_interviews", {
    application_id, state: "requested", mode, location: null, scheduled_at: null, note: str(b.note, 300) || null,
    requested_by: user.sub, scheduled_by: null,
  }))[0];
  await audit(db, user, "interview.request", "shr_interviews", iv.id);
  return { id: iv.id, state: "requested" };
}

export async function setInterview(db, user, b) {
  const id = needId(b.id);
  const iv = (await db.get(`shr_interviews?id=eq.${id}&select=id,state,application_id`))[0];
  if (!iv) throw new HttpError(404, "not_found");
  if (iv.state === "done" || iv.state === "cancelled") throw new HttpError(409, "interview_closed");
  const when = Date.parse(String(b.scheduled_at || ""));
  if (!Number.isFinite(when)) throw bad("bad_time");
  const mode = b.mode ? String(b.mode) : null;
  if (mode && !MODES.includes(mode)) throw bad("bad_mode");
  await db.patch(`shr_interviews?id=eq.${id}`, {
    state: "scheduled", scheduled_at: new Date(when).toISOString(), ...(mode ? { mode } : {}),
    location: str(b.location, 160) || null, scheduled_by: user.sub,
  });
  await audit(db, user, "interview.schedule", "shr_interviews", id);
  return { id, state: "scheduled", scheduled_at: new Date(when).toISOString() };
}

// ------------------------------------------------------------------ match --
// يطابق مرشحي المستأجر الوهميين على وظيفة. الشرط: موافقة سارية وغير مؤرشف.
// من بلا موافقة لا يدخل المحرك أصلاً؛ يُعدّ فقط (excluded.no_consent).
export async function match(db, b) {
  const job_id = needId(b.job_id);
  const job = (await db.get(`shr_jobs?id=eq.${job_id}&select=*`))[0];
  if (!job) throw new HttpError(404, "not_found");
  let weights = null;
  if (b.weights !== undefined) {
    if (!b.weights || typeof b.weights !== "object" || Array.isArray(b.weights)) throw bad("bad_weights");
    try { normalizeWeights(b.weights); } catch { throw bad("bad_weights", { allowed: COMPONENT_KEYS }); }
    weights = b.weights;
  }
  const [cands, consents] = await Promise.all([db.get("shr_candidates?select=*"), consentRows(db)]);
  const live = cands.filter((c) => !c.archived_at);
  const ok = activeConsentSet(consents);
  const eligible = live.filter((c) => ok.has(c.id));
  const hasAny = new Set(consents.map((c) => c.candidate_id));
  const run = runMatch(job, eligible, weights);
  const byId = Object.fromEntries(eligible.map((c) => [c.id, c]));
  return {
    job: { id: job.id, title: job.title, status: job.status },
    version: run.version, weights: run.weights, buckets: run.buckets,
    results: run.results.map((r) => ({ ...r, candidate: candidateCard(byId[r.candidate_id], "active") })),
    excluded: {
      no_consent: live.filter((c) => !hasAny.has(c.id)).length,
      withdrawn: live.filter((c) => hasAny.has(c.id) && !ok.has(c.id)).length,
    },
  };
}
