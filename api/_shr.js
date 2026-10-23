// SHR-HR — بوابة العزل. كل وصول لجداول shr_* يمرّ من هنا وحدها.
//
// الخادم يتحدث إلى القاعدة بمفتاح خدمة يتجاوز RLS، فالعزل الحقيقي هو هذا
// الملف: tenant_id يُشتق من الجلسة لا من الطلب، ويُلصق بكل قراءة، ويُفرض
// على كل كتابة. من يمرّر tenant_id آخر في الجسم أو الاستعلام يُرفض بصوت عالٍ.
// ما لا يُفهم يرمي: مرشّح مجهول يعني استعلاماً بلا شرط، أي بيانات مستأجر آخر.
import { sb } from "./_db.js";

const TABLE = /^shr_[a-z_]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ROLES = ["tenant_owner", "operator", "client_admin", "client_viewer", "worker", "agency"];

// من يرى كل شيء في المستأجر، ومن يُحصر بمعرّفه.
const STAFF = new Set(["tenant_owner", "operator"]);

export function ctxFrom(user) {
  if (!user || !UUID.test(String(user.tenant_id || ""))) throw new Error("shr: no tenant in session");
  if (!ROLES.includes(user.role)) throw new Error("shr: unknown role");
  return { tenantId: user.tenant_id, role: user.role, staff: STAFF.has(user.role), user };
}

function split(path) {
  const [table, qs = ""] = String(path).split("?");
  if (!TABLE.test(table)) throw new Error("shr: not an shr_ table: " + table);
  return { table, qs };
}

function assertNoTenantOverride(qs, body) {
  if (/(^|&)tenant_id=/.test(qs)) throw new Error("shr: tenant_id in query is forbidden");
  const rows = body == null ? [] : Array.isArray(body) ? body : [body];
  for (const r of rows) {
    if ("tenant_id" in r && r.tenant_id !== undefined) throw new Error("shr: tenant_id in body is forbidden");
  }
}

// scoped(ctx, send?) — send قابل للحقن للاختبار؛ الافتراضي sb.
export function scoped(ctx, send = sb) {
  if (!ctx || !UUID.test(ctx.tenantId || "")) throw new Error("shr: scoped() needs ctx from ctxFrom()");
  const t = ctx.tenantId;
  return {
    ctx,
    get(path) {
      const { table, qs } = split(path);
      assertNoTenantOverride(qs, null);
      return send(`${table}?tenant_id=eq.${t}${qs ? "&" + qs : ""}`);
    },
    post(path, body, opts = {}) {
      const { table, qs } = split(path);
      assertNoTenantOverride(qs, body);
      const stamp = (r) => ({ ...r, tenant_id: t });
      return send(`${table}${qs ? "?" + qs : ""}`, { ...opts, method: "POST", body: Array.isArray(body) ? body.map(stamp) : stamp(body) });
    },
    patch(path, body) {
      const { table, qs } = split(path);
      assertNoTenantOverride(qs, body);
      if (!qs) throw new Error("shr: PATCH without a filter is forbidden");
      return send(`${table}?tenant_id=eq.${t}&${qs}`, { method: "PATCH", body });
    },
    // الحذف أرشفة: لا DELETE على جداول shr_.
    del() { throw new Error("shr: delete is archive-only"); },
  };
}

// أخطاء الـAPI والتدقيق مشتركة بين api/shr.js والوحدات api/_shr_*.js.
export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
export async function audit(db, user, action, entity, entity_id) {
  await db.post("shr_audit_log", { actor: user.sub, action, entity, entity_id });
}

// ------------------------------------------------------------ local only --
// المرحلة ٢ محلية بالكامل: لا تعمل إلا مع LOCAL_DB=1 (قاعدة JSON تحت .localdb).
// أي بيئة أخرى ترفض قبل أي لمس للبيانات.
export const shrLocal = () => process.env.LOCAL_DB === "1";
export function assertLocal() {
  if (!shrLocal()) { const e = new Error("shr_local_only"); e.code = "shr_local_only"; throw e; }
}

// جدول shr_tenants لا يحمل tenant_id (هو نفسه الجذر) فلا يمرّ بـscoped؛ وهذه
// القراءة الوحيدة المباشرة، ومكانها هذا الملف.
export async function tenantBySlug(slug) {
  assertLocal();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(slug || ""))) return null;
  const r = await sb(`shr_tenants?slug=eq.${slug}&limit=1`);
  return r && r[0] ? r[0] : null;
}

export async function tenantById(id) {
  assertLocal();
  if (!UUID.test(String(id || ""))) return null;
  const r = await sb(`shr_tenants?id=eq.${id}&limit=1`);
  return r && r[0] ? r[0] : null;
}

// ------------------------------------------------------------- demo seed --
// بيانات وهمية صريحة: مستأجران (SHR التجريبي + مستأجر ثانٍ لإثبات العزل).
// لا هوية ولا رقم يشبه الحقيقي: الأرقام «DEMO-…» وتُخزَّن بصمةً فقط.
import crypto from "node:crypto";

export const hashIdNo = (tenantId, no) => crypto.createHash("sha256").update(tenantId + ":" + no).digest("hex");
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export async function seedDemo() {
  assertLocal();
  if (await tenantBySlug("SHR")) { await seedAts(); return { seeded: false }; }
  const mk = async (slug, brand_ar, brand_en) => (await sb("shr_tenants", { method: "POST", body: { slug, brand_ar, brand_en, demo: true } }))[0];
  const A = await mk("SHR", "مستأجر SHR التجريبي (بيانات وهمية)", "SHR demo tenant");
  const B = await mk("OTHER", "مستأجر وهمي آخر (بيانات وهمية)", "Other demo tenant");

  async function fill(T, tag, { users, workers, requests }) {
    const s = scoped(ctxFrom({ tenant_id: T.id, role: "tenant_owner" }));
    const U = {};
    for (const [k, role, name] of users) U[k] = (await s.post("shr_users", { email: `${k}@${tag.toLowerCase()}.invalid`, full_name: name, role }))[0];
    const est = (await s.post("shr_establishments", [
      { name_ar: `منشأة تجريبية ${tag} ١`, restriction_state: "unknown" },
      { name_ar: `منشأة تجريبية ${tag} ٢`, restriction_state: "clear" },
    ]));
    const cli = (await s.post("shr_client_companies", [
      { name_ar: `عميل تجريبي ${tag} أ`, city: "الرياض", status: "active" },
      { name_ar: `عميل تجريبي ${tag} ب`, city: "جدة", status: "active" },
    ]));
    let i = 0;
    for (const w of workers) {
      i++;
      const row = (await s.post("shr_workers", {
        full_name: w.name, nationality: w.nat, profession: w.prof, id_kind: "iqama",
        id_no_hash: hashIdNo(T.id, `DEMO-${tag}-${i}`), status: w.status, created_by: U[w.by].id,
        activated_by: w.status === "active" ? U[w.by === "owner" ? "ops" : "owner"].id : null,
      }))[0];
      if (w.assign !== false) await s.post("shr_assignments", { worker_id: row.id, establishment_id: est[0].id, client_company_id: cli[0].id, profession: w.prof, status: w.status === "active" ? "active" : "draft" });
      for (const [kind, exp] of Object.entries(w.docs || {})) {
        await s.post("shr_worker_documents", { worker_id: row.id, kind, storage_key: `demo/${tag}/${i}/${kind}.pdf`, expires_on: exp === null ? null : day(exp) });
      }
    }
    for (const r of requests) await s.post("shr_requests", { client_company_id: cli[r.c].id, kind: r.kind, state: r.state, body: { note: r.note, demo: true } });
  }

  await fill(A, "SHR", {
    users: [["owner", "tenant_owner", "مالك تجريبي"], ["ops", "operator", "مشغّل تجريبي"], ["client", "client_admin", "مدير عميل تجريبي"]],
    workers: [
      { name: "عامل تجريبي ١", nat: "الهند", prof: "فني تكييف", status: "active", by: "ops", docs: { work_contract: null, iqama: 20, medical_insurance: 200 } },
      { name: "عامل تجريبي ٢", nat: "باكستان", prof: "سائق", status: "active", by: "ops", docs: { work_contract: null, iqama: 45, medical_insurance: 40 } },
      { name: "عامل تجريبي ٣", nat: "مصر", prof: "محاسب", status: "active", by: "ops", docs: { work_contract: null, iqama: 300, medical_insurance: -5 } },
      { name: "عامل تجريبي ٤", nat: "الفلبين", prof: "ممرض", status: "active", by: "ops", docs: { work_contract: null, iqama: 80, medical_insurance: 55 } },
      { name: "عامل تجريبي ٥", nat: "بنغلاديش", prof: "عامل نظافة", status: "pending_docs", by: "ops", docs: { work_contract: null, iqama: 120 } },
      { name: "عامل تجريبي ٦ (جاهز للتفعيل)", nat: "السودان", prof: "فني كهرباء", status: "draft", by: "ops", docs: { work_contract: null, iqama: 365 } },
      { name: "عامل تجريبي ٧ (مسودة)", nat: "نيبال", prof: "حارس", status: "draft", by: "ops", assign: false },
      { name: "عامل تجريبي ٨ (مؤرشف)", nat: "سريلانكا", prof: "طباخ", status: "archived", by: "ops", docs: { iqama: -90 } },
    ],
    requests: [
      { c: 0, kind: "new_hire", state: "new", note: "طلب تجريبي: ٣ فنيين" },
      { c: 0, kind: "document", state: "in_review", note: "طلب تجريبي: شهادة عمل" },
      { c: 1, kind: "transfer", state: "waiting_client", note: "طلب تجريبي: نقل" },
      { c: 1, kind: "new_hire", state: "in_progress", note: "طلب تجريبي: سائقان" },
      { c: 0, kind: "termination", state: "done", note: "طلب تجريبي مكتمل" },
      { c: 1, kind: "other", state: "rejected", note: "طلب تجريبي مرفوض" },
    ],
  });
  await fill(B, "OTHER", {
    users: [["owner", "tenant_owner", "مالك وهمي آخر"], ["ops", "operator", "مشغّل وهمي آخر"]],
    workers: [
      { name: "عامل وهمي آخر ١", nat: "الهند", prof: "لحّام", status: "active", by: "ops", docs: { work_contract: null, iqama: 10, medical_insurance: 15 } },
      { name: "عامل وهمي آخر ٢", nat: "مصر", prof: "نجّار", status: "draft", by: "ops", docs: { iqama: 90 } },
      { name: "عامل وهمي آخر ٣", nat: "باكستان", prof: "سائق", status: "active", by: "ops", docs: { work_contract: null, iqama: 30, medical_insurance: 100 } },
    ],
    requests: [
      { c: 0, kind: "new_hire", state: "new", note: "طلب وهمي لمستأجر آخر" },
      { c: 1, kind: "other", state: "in_review", note: "طلب وهمي لمستأجر آخر" },
    ],
  });
  await seedAts();
  return { seeded: true };
}

// ---------------------------------------------------------------- ATS seed --
// مرشحون وهميون صريحو الوسم: «مرشح تجريبي N (وهمي)» وref يبدأ بـDEMO-C. لا هوية
// ولا هاتف ولا بريد: الجدول بلا حقول لها. الموافقة مسجّلة لبعضهم وغير مسجّلة
// أو مسحوبة لآخرين، لإثبات أن المطابقة تتجاهل من بلا موافقة سارية.
const CONSENT_V = "demo-consent-v1";
const CONSENT_TEXT = "نص موافقة تجريبي (وهمي): أوافق على معالجة بياناتي لأغراض الترشيح لوظائف بيانات تجريبية.";
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString();

// [الاسم، المهنة، الجنسية، المدينة، الخبرة، نقل الإقامة، يقبل الانتقال، الإشعار، المهارات، الموافقة]
// الموافقة: "ok" سارية · "withdrawn" مسحوبة · null لا سجل.
const DEMO_CANDIDATES = [
  ["فني تكييف", "الهند", "الرياض", 8, "yes", true, 15, ["تركيب سبليت", "صيانة مكيفات مركزية"], "ok"],
  ["فني تكييف", "باكستان", "جدة", 4, "yes", true, 30, ["تركيب سبليت"], "ok"],
  ["فني تكييف", "الهند", "الرياض", 6, "no", null, 20, ["صيانة مكيفات مركزية"], "ok"],
  ["فني تكييف", "بنغلاديش", "الدمام", null, null, null, null, [], "ok"],
  ["فني تكييف", "نيبال", "الرياض", 9, "yes", true, 7, ["تركيب سبليت", "تبريد تجاري"], null],
  ["فني تكييف", "الهند", "الرياض", 7, "yes", true, 10, ["تركيب سبليت"], "withdrawn"],
  ["سائق", "باكستان", "الرياض", 10, "yes", false, 15, [], "ok"],
  ["سائق", "مصر", "جدة", 5, "unknown", true, 45, [], "ok"],
  ["سائق", "الفلبين", "الرياض", 2, "yes", true, 60, [], "ok"],
  ["كهربائي", "السودان", "الدمام", 12, "yes", true, 30, ["تمديدات منخفضة الجهد", "لوحات توزيع"], "ok"],
  ["كهربائي", "مصر", "الرياض", 3, "no", false, 90, ["تمديدات منخفضة الجهد"], "ok"],
  ["لحّام", "الهند", "الدمام", 11, "yes", true, 20, ["لحام أرجون", "لحام قوس"], "ok"],
  ["سباك", "بنغلاديش", "الرياض", 6, "yes", true, 14, ["تمديدات صحية"], "ok"],
  ["نجّار", "سريلانكا", "جدة", 5, "yes", null, null, ["أعمال خشب"], null],
  ["عامل بناء", "نيبال", "الرياض", 2, "no", true, 5, [], "ok"],
  ["عامل نظافة", "بنغلاديش", "الرياض", 1, "yes", true, 0, [], "ok"],
  ["حارس أمن", "نيبال", "الرياض", 4, "yes", false, 30, [], "ok"],
  ["طباخ", "الهند", "جدة", 9, "yes", true, 25, ["مطبخ شرقي"], "withdrawn"],
  ["مشغّل رافعة", "الفلبين", "الدمام", 8, "yes", true, 21, ["رافعة برجية"], "ok"],
  ["ميكانيكي سيارات", "باكستان", "مكة", 7, "unknown", true, 15, ["صيانة محركات"], "ok"],
];

const DEMO_CANDIDATES_OTHER = [
  ["لحّام", "الهند", "الرياض", 6, "yes", true, 10, ["لحام أرجون"], "ok"],
  ["نجّار", "مصر", "جدة", 4, "yes", true, 20, [], "ok"],
  ["سائق", "باكستان", "الرياض", 3, "yes", true, 30, [], null],
];

export async function seedAts() {
  assertLocal();
  for (const [slug, tag, rows, jobs] of [
    ["SHR", "SHR", DEMO_CANDIDATES, [
      { title: "فني تكييف — مشروع تجريبي", profession: "فني تكييف", city: "الرياض", experience_years: 5, residency_required: "transferable", nationality_pref: [], skills: ["تركيب سبليت"], must_have: [], headcount: 3, status: "open" },
      { title: "سائق نقل خفيف — تجريبي", profession: "سائق", city: "الرياض", experience_years: 3, residency_required: "transferable", nationality_pref: ["باكستان", "مصر"], skills: [], must_have: ["residency"], headcount: 2, status: "open" },
      { title: "لحّام منشآت — تجريبي", profession: "لحّام", city: "الدمام", experience_years: 8, residency_required: "transferable", nationality_pref: [], skills: ["لحام أرجون"], must_have: ["لحام أرجون"], headcount: 1, status: "closed" },
    ]],
    ["OTHER", "OTHER", DEMO_CANDIDATES_OTHER, [
      { title: "لحّام — وظيفة وهمية لمستأجر آخر", profession: "لحّام", city: "الرياض", experience_years: 3, residency_required: "any", nationality_pref: [], skills: [], must_have: [], headcount: 1, status: "open" },
    ]],
  ]) {
    const t = await tenantBySlug(slug);
    if (!t) continue;
    const s = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
    if ((await s.get("shr_candidates?select=id&limit=1")).length) continue;   // مبذور سلفاً
    const users = await s.get("shr_users?select=id,email");
    const ops = users.find((u) => u.email.startsWith("ops@"));
    const cand = [];
    let i = 0;
    for (const [prof, nat, city, yrs, resid, reloc, notice, skills, consent] of rows) {
      i++;
      const n = String(i).padStart(2, "0");
      const c = (await s.post("shr_candidates", {
        ref: `DEMO-C-${tag}-${n}`, full_name: `مرشح تجريبي ${i} (وهمي)`, profession: prof, nationality: nat, city,
        years_experience: yrs, residency_transferable: resid, willing_to_relocate: reloc, notice_days: notice,
        skills, demo: true, archived_at: null, created_by: ops ? ops.id : null,
      }))[0];
      cand.push(c);
      if (consent) await s.post("shr_candidate_consents", {
        candidate_id: c.id, text_version: CONSENT_V, text_body: CONSENT_TEXT, granted_at: iso(-30), source: "demo_seed",
        withdrawn_at: consent === "withdrawn" ? iso(-3) : null, withdrawn_reason: consent === "withdrawn" ? "سحب تجريبي" : null,
        recorded_by: ops ? ops.id : null,
      });
    }
    const J = [];
    for (const j of jobs) J.push((await s.post("shr_jobs", { ...j, client_company_id: null, closed_at: j.status === "closed" ? iso(-5) : null, created_by: ops ? ops.id : null }))[0]);
    // طلبات تقديم وهمية (لمن موافقته سارية فقط) بمراحل مختلفة، أدخلها «ops».
    const plan = slug === "SHR"
      ? [[0, 0, "new"], [0, 1, "review"], [0, 2, "shortlist"], [0, 9, "rejected"], [1, 6, "interview"], [1, 7, "offer"], [1, 8, "future"]]
      : [[0, 0, "new"]];
    for (const [ji, ci, stage] of plan) {
      const a = (await s.post("shr_applications", {
        job_id: J[ji].id, candidate_id: cand[ci].id, stage, created_by: ops ? ops.id : null,
        offer_proposed_by: stage === "offer" && ops ? ops.id : null, offer_approved_by: null, archived_at: null, updated_at: null,
      }))[0];
      await s.post("shr_application_events", { application_id: a.id, from_stage: null, to_stage: "new", actor: ops ? ops.id : null, note: "إدخال تجريبي", at: iso(-10) });
      if (stage !== "new") await s.post("shr_application_events", { application_id: a.id, from_stage: "new", to_stage: stage, actor: ops ? ops.id : null, note: "بذرة تجريبية", at: iso(-9) });
    }
  }
}
