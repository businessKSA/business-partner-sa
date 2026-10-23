// SHR-HR — بوابة العزل. كل وصول لجداول shr_* يمرّ من هنا وحدها.
//
// الخادم يتحدث إلى القاعدة بمفتاح خدمة يتجاوز RLS، فالعزل الحقيقي هو هذا
// الملف: tenant_id يُشتق من الجلسة لا من الطلب، ويُلصق بكل قراءة، ويُفرض
// على كل كتابة. من يمرّر tenant_id آخر في الجسم أو الاستعلام يُرفض بصوت عالٍ.
// ما لا يُفهم يرمي: مرشّح مجهول يعني استعلاماً بلا شرط، أي بيانات مستأجر آخر.
import { sb } from "./_db.js";
import * as R from "./_shr_ref.js";

const TABLE = /^shr_[a-z0-9_]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ROLES = ["tenant_owner", "operator", "client_admin", "client_viewer", "worker", "agency", "compliance_officer"];

// من يرى كل شيء في المستأجر، ومن يُحصر بمعرّفه.
const STAFF = new Set(["tenant_owner", "operator", "compliance_officer"]);

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
// بصمة الاسم+الجنسية+المهنة لكشف تكرار مرشح المكتب بلا هوية: تطبيع بسيط ثم SHA-256.
const norm = (v) => String(v ?? "").normalize("NFKC").toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();
export const nameKeyOf = (tenantId, name, nat, prof) => crypto.createHash("sha256").update([tenantId, norm(name), norm(nat), norm(prof)].join("|")).digest("hex");
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export async function seedDemo() {
  assertLocal();
  if (await tenantBySlug("SHR")) { await seedAts(); await seedAgencies(); await seedCompliance(); await seedClients(); await seedPosts(); await seedWorkers(); return { seeded: false }; }
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
  await seedAgencies();
  await seedCompliance();
  await seedClients();
  await seedPosts();
  await seedWorkers();
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

// ------------------------------------------------------------ agency seed --
// بوابة المكاتب: ثلاثة مكاتب في SHR (واحد pending)، أربعة أوامر، ثمانية مرشحي مكاتب.
// أسماء «(وهمي)» وref يبدأ بـDEMO-. لا هوية حقيقية: أرقام DEMO-… تُخزَّن بصمةً فقط.
// المكتب المنشأ بيد مستخدم والمعتمد بيد آخر، فالبذرة تحترم من يُدخل لا يعتمد.
const AGENCY_PLAN = {
  SHR: {
    agencies: [   // [مفتاح، الاسم، البلد، المنشئ، المعتمد (null = pending)]
      ["a", "مكتب استقدام تجريبي أ (وهمي)", "الهند", "ops", "owner"],
      ["b", "مكتب استقدام تجريبي ب (وهمي)", "الفلبين", "owner", "ops"],
      ["c", "مكتب استقدام تجريبي ج — قيد الاعتماد (وهمي)", "بنغلاديش", "ops", null],
    ],
    // [مفتاح، المكتب (null = مفتوح)، المهنة، الكمية، تفضيل الجنسية، توجيه المكتب]
    orders: [
      ["o1", "a", "فني تكييف", 3, ["الهند"], "توجيه تجريبي: فنيون بخبرة تركيب سبليت"],
      ["o2", "b", "سائق", 2, [], "توجيه تجريبي: رخصة قيادة سارية"],
      ["o3", null, "لحّام", 1, [], "أمر مفتوح تجريبي لكل المكاتب المعتمدة"],
      ["o4", "a", "كهربائي", 2, [], "توجيه تجريبي: تمديدات منخفضة الجهد"],
    ],
    // [المكتب، الأمر، الاسم، المهنة، الجنسية، الخبرة، رقم وهمي للبصمة، الحالة]
    cands: [
      ["a", "o1", "مرشح مكتب ١ (وهمي)", "فني تكييف", "الهند", 6, "DEMO-AGC-1", "submitted"],
      ["a", "o1", "مرشح مكتب ٢ (وهمي)", "فني تكييف", "الهند", 4, "DEMO-AGC-2", "shortlisted"],
      ["a", "o4", "مرشح مكتب ٣ (وهمي)", "كهربائي", "مصر", 9, "DEMO-AGC-3", "interview"],
      ["a", "o3", "مرشح مكتب ٤ (وهمي)", "لحّام", "الهند", 8, "DEMO-DUP-1", "under_review"],
      ["b", "o2", "مرشح مكتب ٥ (وهمي)", "سائق", "الفلبين", 5, "DEMO-AGC-5", "accepted"],
      ["b", "o2", "مرشح مكتب ٦ (وهمي)", "سائق", "الفلبين", 2, "DEMO-AGC-6", "rejected"],
      ["b", "o2", "مرشح مكتب ٧ (وهمي)", "سائق", "إندونيسيا", 7, "DEMO-AGC-7", "submitted"],
      ["b", "o3", "مرشح مكتب ٨ (وهمي)", "لحّام", "الهند", 8, "DEMO-DUP-1", "submitted"],   // نفس بصمة ٤ من مكتب آخر: يراه المشغّل وحده
    ],
  },
  OTHER: {
    agencies: [["x", "مكتب وهمي لمستأجر آخر", "مصر", "ops", "owner"]],
    orders: [["ox", "x", "نجّار", 1, [], "توجيه تجريبي لمستأجر آخر"]],
    cands: [["x", "ox", "مرشح مكتب وهمي آخر (وهمي)", "نجّار", "مصر", 4, "DEMO-AGC-X1", "submitted"]],
  },
};

export async function seedAgencies() {
  assertLocal();
  for (const slug of ["SHR", "OTHER"]) {
    const t = await tenantBySlug(slug);
    if (!t) continue;
    const s = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
    if ((await s.get("shr_agencies?select=id&limit=1")).length) continue;     // مبذور سلفاً
    const plan = AGENCY_PLAN[slug];
    const users = await s.get("shr_users?select=id,email");
    const U = { ops: users.find((u) => u.email.startsWith("ops@")), owner: users.find((u) => u.email.startsWith("owner@")) };
    const clients = await s.get("shr_client_companies?select=id&order=created_at.asc");
    const tag = slug.toLowerCase();
    const AG = {}, ORD = {}, AU = {};
    let n = 0;
    for (const [k, name, country, by, appr] of plan.agencies) {
      n++;
      const a = (await s.post("shr_agencies", {
        ref: `DEMO-AG-${slug}-${n}`, name_ar: name, country,
        status: appr ? "approved" : "pending", created_by: U[by].id,
        approved_by: appr ? U[appr].id : null, approved_at: appr ? iso(-20) : null,
        suspended_by: null, suspended_at: null, suspended_reason: null, archived_at: null, demo: true,
      }))[0];
      AG[k] = a;
      AU[k] = (await s.post("shr_users", { email: `agency-${k}@${tag}.invalid`, full_name: `مستخدم ${name}`, role: "agency", agency_id: a.id }))[0];
    }
    n = 0;
    for (const [k, ag, prof, qty, nat, brief] of plan.orders) {
      n++;
      ORD[k] = (await s.post("shr_recruitment_orders", {
        ref: `DEMO-ORD-${slug}-${n}`, request_id: null, client_company_id: clients[0] ? clients[0].id : null, establishment_id: null,
        agency_id: ag ? AG[ag].id : null, profession: prof, quantity: qty, nationality_pref: nat, agency_brief: brief,
        due_on: day(30), state: "open", created_by: U.ops.id, archived_at: null, demo: true,
      }))[0];
    }
    n = 0;
    for (const [ag, ord, name, prof, nat, yrs, no, state] of plan.cands) {
      n++;
      const c = (await s.post("shr_agency_candidates", {
        ref: `DEMO-A-${slug}-${String(n).padStart(2, "0")}`, order_id: ORD[ord].id, agency_id: AG[ag].id, full_name: name,
        profession: prof, nationality: nat, years_experience: yrs, skills: [],
        id_no_hash: hashIdNo(t.id, no), name_key: nameKeyOf(t.id, name, nat, prof),
        state, submitted_by: AU[ag].id,
        reviewed_by: state === "submitted" ? null : U.ops.id, reviewed_at: state === "submitted" ? null : iso(-2), review_note: null,
        archived_at: null, demo: true,
      }))[0];
      await s.post("shr_agency_candidate_events", { submission_id: c.id, from_state: null, to_state: "submitted", actor: c.submitted_by, note: "تقديم تجريبي", at: iso(-5) });
      if (state !== "submitted") await s.post("shr_agency_candidate_events", { submission_id: c.id, from_state: "submitted", to_state: state, actor: U.ops.id, note: "بذرة تجريبية", at: iso(-2) });
      if (state === "interview") await s.post("shr_agency_interviews", { submission_id: c.id, agency_id: AG[ag].id, state: "scheduled", mode: "video", location: null, scheduled_at: iso(3), agency_note: "مقابلة مرئية تجريبية", requested_by: U.ops.id, scheduled_by: U.ops.id });
    }
  }
}

// -------------------------------------------------------- compliance seed --
// وحدة الامتثال: منشآت بحالات قيد مختلفة، لقطات تاريخية، مخالفات من rule_ids حقيقية في المرجع
// لكن ببيانات تجريبية، قوائم تحقق، قائمة A33 بأسماء «(وهمي)»، دفعة استيراد، وطلب نقل.
// كل رقم نظامي (مبلغ، موعد، نطاق) يُحسب من db/shr-ref عبر _shr_ref.js ولا يُكتب هنا.
// البذرة لا تُنشئ مخالفة بحالة تتجاوز «مراجعة» إلا بمراجع ثانٍ مختلف عن المُدخِل.
const COMPLIANCE_PLAN = {
  SHR: {
    extraEst: [["منشأة تجريبية SHR ٣ (مقيّدة — وهمي)", "restricted"], ["منشأة تجريبية SHR ٤ (اشتباه — وهمي)", "suspected"]],
    // [المنشأة، as_of، الحالة، السبب، المُدخِل، المتحقِّق|null، نطاق نطاقات، سعوديون، غير سعوديين، النطاق المعلن]
    snaps: [
      [0, -10, "unknown", null, "ops", null, null, null, null, null],
      [1, -90, "restricted", "سبب تجريبي (وهمي): قيد سابق مرفوع", "ops", "owner", null, null, null, null],
      [1, -30, "clear", null, "ops", "owner", "NIT-30", 14, 36, "green_mid"],
      [2, -12, "restricted", "سبب تجريبي (وهمي): قيد على طلبات الاستقدام", "ops", "owner", "NIT-08", 4, 46, "green_low"],
      [3, -5, "suspected", "اشتباه تجريبي (وهمي): بانتظار تأكيد من منصة الجهة", "owner", null, null, null, null, null],
    ],
    // [المنشأة، البند، الشريحة، العدد، تبليغ(يوم|null)، المُدخِل، المراجع|null، الحالة، السداد، رقم]
    violations: [
      [2, "A-33", "medium", 3, -20, "ops", "owner", "objection_eligibility_study", "unknown", "DEMO-V-1"],
      [1, "A-34", "small", 5, null, "owner", null, "review", "unknown", "DEMO-V-2"],
      [3, "A-40", "large", 1, -55, "owner", "ops", "preparation", "unpaid", "DEMO-V-3"],
      [2, "A-53", "medium", 2, -70, "ops", "compliance", "submission", "unpaid", "DEMO-V-4"],
      [0, "A-28", "small", 1, -62, "ops", "owner", "review", "unknown", "DEMO-V-5"],
    ],
  },
  OTHER: {
    extraEst: [["منشأة وهمية أخرى (مقيّدة — وهمي)", "restricted"]],
    snaps: [[2, -8, "restricted", "سبب وهمي لمستأجر آخر", "ops", "owner", null, null, null, null]],
    violations: [[2, "A-33", "small", 1, -10, "ops", "owner", "objection_eligibility_study", "unknown", "DEMO-V-OTHER-1"]],
  },
};

const CHECKLISTS = [
  { key: "est_readiness", title: "جاهزية المنشأة للاستقدام (تجريبية)", audience: "staff", scope: "establishment", items: [
    ["تحقق من حالة القيد في منصة الجهة وسجّلها بلقطة يتحقق منها مستخدم آخر", null],
    ["فتح ملف المنشأة وتحديث مواقعها وبياناتها", "A-28"],
    ["رفع ملف حماية الأجور للفترة الأخيرة", "A-40"],
    ["توثيق عقود العاملين إلكترونياً", "A-34"],
    ["التحقق من قناة تقديم الاعتراض الحالية في واجهة الخدمة", "CH-1"],
  ] },
  { key: "worker_activation", title: "جاهزية العامل للتفعيل (تجريبية)", audience: "staff", scope: "worker", items: [
    ["هوية وإقامة سارية ومستند مرفوع", null],
    ["عقد عمل موثّق إلكترونياً", "A-34"],
    ["عدم احتجاز جواز العامل أو إقامته", "A-31"],
    ["تحمّل الرسوم والتكاليف الملزمة على صاحب العمل", "A-32"],
  ] },
  { key: "violation_prep", title: "مراجعة مخالفة قبل التقديم (تجريبية)", audience: "staff", scope: "violation", items: [
    ["إدخال تاريخ التبليغ من الإشعار الرسمي", null],
    ["مراجعة ثانية من مستخدم غير من أدخل المخالفة", null],
    ["تجهيز المبررات والمرفقات", null],
    ["التقديم عبر بوابة الجهة مهمة بشرية بهوية العميل", null],
    ["إبلاغ العميل أنه لا ضمان لإلغاء المخالفة", null],
  ] },
  { key: "worker_docs_mine", title: "مستنداتي (قائمة العامل — تجريبية)", audience: "worker", scope: "worker", items: [
    ["الإقامة سارية", null], ["عقد العمل موقّع", null],
  ] },
];

export async function seedCompliance() {
  assertLocal();
  for (const slug of ["SHR", "OTHER"]) {
    const t = await tenantBySlug(slug);
    if (!t) continue;
    const s = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
    if ((await s.get("shr_establishment_compliance?select=id&limit=1")).length) continue;      // مبذور سلفاً
    const plan = COMPLIANCE_PLAN[slug], tag = slug.toLowerCase();
    const users = await s.get("shr_users?select=id,email,role");
    const U = { ops: users.find((u) => u.email.startsWith("ops@")), owner: users.find((u) => u.email.startsWith("owner@")) };
    U.compliance = users.find((u) => u.role === "compliance_officer")
      || (await s.post("shr_users", { email: `compliance@${tag}.invalid`, full_name: slug === "SHR" ? "مسؤول امتثال تجريبي" : "مسؤول امتثال وهمي آخر", role: "compliance_officer" }))[0];
    let ests = await s.get("shr_establishments?select=id,name_ar&order=created_at.asc");
    for (const [name, st] of plan.extraEst) ests.push((await s.post("shr_establishments", { name_ar: name, restriction_state: st }))[0]);
    const year = String(new Date().getFullYear());
    for (const [ei, d, st, reason, by, ver, act, sa, non, band] of plan.snaps) {
      const comp = act ? R.nitaqatEstimate({ activity_rule_id: act, saudi: sa, non_saudi: non, year }) : null;
      await s.post("shr_establishment_compliance", {
        establishment_id: ests[ei].id, as_of: day(d), activity_rule_id: act, declared_band: band, declared_saudization_pct: sa !== null && sa !== undefined ? Math.round((sa / (sa + non)) * 10000) / 100 : null,
        saudi_count: sa, non_saudi_count: non, computed_pct: comp && comp.ok ? comp.pct : null, computed_band: comp && comp.ok ? comp.band : null,
        computed_basis: comp && comp.ok ? { estimate: true, rule_id: comp.rule_id, source_ref: comp.source_ref, formula_source_ref: comp.formula_source_ref, caveats: comp.caveats } : null,
        restriction_state: st, restriction_reason: reason, source_note: "إدخال تجريبي (وهمي) من منصة الجهة", entered_by: U[by].id,
        verified_by: ver ? U[ver].id : null, verified_on: ver ? day(d + 1) : null, demo: true,
      });
    }
    for (const [ei, rule, tier, cnt, nd, by, rev, status, paid, refno] of plan.violations) {
      const notification = nd === null ? null : day(nd);
      const { row } = R.violationFields({ rule_id: rule, size_tier: tier, persons_count: cnt, notification_date: notification });
      await s.post("shr_violations", {
        establishment_id: ests[ei].id, authority: "جهة مصدِرة تجريبية (وهمي)", ref_no: refno, rule_id: rule, ...row, persons_count: cnt, size_tier: tier,
        notification_date: notification, notification_entered_by: notification ? U[by].id : null, status, paid_state: paid,
        entered_by: U[by].id, reviewed_by: rev ? U[rev].id : null, reviewed_at: rev ? iso(-2) : null, archived_at: null, demo: true, updated_at: null,
      });
    }
    // قائمة A33 (م33: سعوديون مسجّلون بلا علاقة عمل فعلية): أسماء وهمية، بصمة فقط.
    const workers = await s.get("shr_workers?select=id,full_name");
    const linked = workers.find((w) => /٥/.test(w.full_name)) || null;
    const a33Est = ests[2];
    const A = [["ops", "owner", "actual_worker"], ["ops", "owner", "not_a_worker"], ["owner", null, "works_for_other"], [null, null, null], [null, null, null], [null, null, null]];
    let i = 0;
    for (const [cls, appr, c] of A) {
      i++;
      await s.post("shr_a33_names", {
        establishment_id: a33Est.id, list_ref: "DEMO-A33-L1", alias: `${slug === "SHR" ? "اسم تجريبي" : "اسم وهمي آخر"} ${i} (وهمي)`, id_no_hash: hashIdNo(t.id, `DEMO-A33-${tag}-${i}`),
        worker_id: slug === "SHR" && i === 6 && linked ? linked.id : null, classification: c, classification_note: c ? "تصنيف تجريبي" : null,
        classified_by: cls ? U[cls].id : null, classified_at: cls ? iso(-3) : null, approved_by: appr ? U[appr].id : null, approved_at: appr ? iso(-2) : null,
        archived_at: null, demo: true, created_by: U.ops.id,
      });
    }
    for (const c of slug === "SHR" ? CHECKLISTS : CHECKLISTS.slice(0, 1)) {
      const tp = (await s.post("shr_checklist_templates", { key: c.key, title_ar: c.title, audience: c.audience, scope: c.scope, version: 1, active: true, demo: true, created_by: U.owner.id }))[0];
      let pos = 0;
      for (const [text, rule] of c.items) await s.post("shr_checklist_items", { template_id: tp.id, position: ++pos, text_ar: text, required: true, rule_id: rule });
    }
    if (slug === "SHR") {
      // دفعة تأمينات مرفوعة: أرقام وهمية تطابق عمال البذرة (تُخزَّن بصمةً فقط). تنتظر المطابقة والمراجعة.
      const period = new Date().toISOString().slice(0, 7);
      const b = (await s.post("shr_import_batches", { kind: "gosi", label: "دفعة تأمينات تجريبية (وهمي)", state: "uploaded", row_count: 6, matched_count: 0, uploaded_by: U.ops.id, matched_at: null, reviewed_by: null, reviewed_at: null, applied_by: null, applied_at: null, demo: true }))[0];
      const ids = ["DEMO-SHR-1", "DEMO-SHR-2", "DEMO-SHR-3", "DEMO-SHR-4", "DEMO-SHR-5", "DEMO-ZZ-9"];
      let line = 0;
      for (const no of ids) { line++; await s.post("shr_import_rows", { batch_id: b.id, line, id_no_hash: hashIdNo(t.id, no), period, status: no === "DEMO-SHR-5" ? "not_registered" : "registered", match_state: "unmatched", worker_id: null, applied_at: null }); }
      // طلب نقل معلّق: عامل ١ من المنشأة ١ إلى ٢، طلبه المشغّل فيوافق عليه غيره.
      const w1 = workers.find((w) => /١$/.test(w.full_name));
      const asg = w1 ? (await s.get(`shr_assignments?worker_id=eq.${w1.id}&select=establishment_id`))[0] : null;
      if (w1 && asg && asg.establishment_id !== ests[1].id) await s.post("shr_worker_transfers", { worker_id: w1.id, from_establishment_id: asg.establishment_id, to_establishment_id: ests[1].id, reason: "طلب نقل تجريبي (وهمي)", state: "requested", requested_by: U.ops.id, decided_by: null, decided_at: null, decision_note: null });
    }
  }
}

// ------------------------------------------------------------ client seed --
// بوابة العميل: عميلان في SHR (لإثبات العزل بين العملاء) وعميل في OTHER، لكل منهم عقود
// (active وdraft/pending_approval) وإسنادات وطلبات. مستخدمو العميل `*@client.invalid`:
// client_admin يقدّم طلباً، وclient_viewer يقرأ. عاملان من عمال SHR يُنقلان إلى العميل «ب».
// العقد النشط يُنشئه مستخدم ويعتمده آخر (قيد المخطط). مسودة فاتورة تُبذر عمداً لإثبات
// أن العميل لا يراها: الفواتير مسودات ولا تخرج إلا عبر بدر.
export async function seedClients() {
  assertLocal();
  for (const slug of ["SHR", "OTHER"]) {
    const t = await tenantBySlug(slug);
    if (!t) continue;
    const s = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
    if ((await s.get("shr_contracts?select=id&limit=1")).length) continue;       // مبذور سلفاً
    const users = await s.get("shr_users?select=id,email,role,client_company_id");
    const U = { ops: users.find((u) => u.email.startsWith("ops@")), owner: users.find((u) => u.email.startsWith("owner@")) };
    const clients = await s.get("shr_client_companies?select=id,name_ar&order=created_at.asc");
    const ests = await s.get("shr_establishments?select=id&order=created_at.asc");
    const [cA, cB] = clients;
    const contract = async (c, version, status, from, to) => (await s.post("shr_contracts", {
      establishment_id: ests[0].id, client_company_id: c.id, version, starts_on: day(from), ends_on: day(to), status,
      created_by: U.ops.id, approved_by: status === "active" || status === "ended" ? U.owner.id : null,
    }))[0];
    const KA = await contract(cA, 1, "active", -200, 165);
    let KB = null;
    if (slug === "SHR") {
      await contract(cA, 2, "draft", 166, 530);
      KB = await contract(cB, 1, "active", -120, 245);
      await contract(cB, 2, "pending_approval", 246, 610);
    }
    // عاملان من عمال العميل «أ» يُنقلان إلى «ب» (SHR فقط): عمال لكل عميل بلا إضافة عمال جدد.
    const workers = await s.get("shr_workers?select=id,full_name");
    const moveIds = new Set(slug === "SHR" ? workers.filter((w) => /(٣|٤)$/.test(w.full_name)).map((w) => w.id) : []);
    for (const a of await s.get("shr_assignments?select=id,worker_id,client_company_id,status")) {
      if (a.client_company_id !== cA.id) continue;
      const toB = moveIds.has(a.worker_id) && KB;
      await s.patch(`shr_assignments?id=eq.${a.id}`, { contract_id: toB ? KB.id : KA.id, client_company_id: toB ? cB.id : cA.id, starts_on: day(-150), ends_on: null });
    }
    // مستخدمو العميل. القديم client@shr.invalid يُربط بالعميل «أ» ليتّسق مع قيد المخطط.
    const legacy = users.find((u) => u.role === "client_admin" && !u.client_company_id);
    if (legacy) await s.patch(`shr_users?id=eq.${legacy.id}`, { client_company_id: cA.id });
    const mk = (email, name, role, c) => s.post("shr_users", { email, full_name: name, role, client_company_id: c.id });
    if (slug === "SHR") {
      await mk("a-admin@client.invalid", "مدير العميل أ (تجريبي)", "client_admin", cA);
      await mk("a-viewer@client.invalid", "مطّلع العميل أ (تجريبي)", "client_viewer", cA);
      await mk("b-admin@client.invalid", "مدير العميل ب (تجريبي)", "client_admin", cB);
    } else {
      await mk("x-admin@client.invalid", "مدير عميل المستأجر الآخر (وهمي)", "client_admin", cA);
    }
    // قائمة تحقق موجّهة للعميل (audience=client)، بلا بند مرجعي نظامي: بنودها تشغيلية وصفية.
    const tpl = (await s.post("shr_checklist_templates", { key: "client_worker_docs", title_ar: "جاهزية مستندات العامل (للعميل — تجريبية)", audience: "client", scope: "worker", version: 1, active: true, demo: true, created_by: U.owner.id }))[0];
    const items = [];
    let pos = 0;
    for (const text of ["الإقامة سارية", "عقد العمل موقّع", "التأمين الطبي ساري"]) items.push((await s.post("shr_checklist_items", { template_id: tpl.id, position: ++pos, text_ar: text, required: true, rule_id: null }))[0]);
    const w1 = workers.find((w) => /١$/.test(w.full_name));
    if (w1 && slug === "SHR") for (const it of items.slice(0, 2)) await s.post("shr_checklist_ticks", { item_id: it.id, subject_kind: "worker", subject_id: w1.id, done: true, note: null, ticked_by: U.ops.id, ticked_at: iso(-3) });
    // مسودة فاتورة وهمية: تُبذر لتثبت أن بوابة العميل لا تقرأها.
    await s.post("shr_invoices", { client_company_id: cA.id, status: "draft" });
  }
}

// ------------------------------------------------------------- posts seed --
// إعلانات الوظائف: أربعة في SHR بحالات مختلفة، منها واحد معتمد لكن منشأته مقيّدة (وهمية) فيظهر محجوباً،
// وواحد في OTHER لإثبات العزل. قنوات النشر غير الخاصة مسجّلة معطّلة. كل إعلان أنشأه مستخدم واعتمده آخر.
// الأرقام «قيم تجريبية» أدخلها «إنسان وهمي» (ops) لتظهر المعاينة؛ لا شيء يُولَّد. يجب أن تعمل بعد seedCompliance.
export async function seedPosts() {
  assertLocal();
  for (const slug of ["SHR", "OTHER"]) {
    const t = await tenantBySlug(slug);
    if (!t) continue;
    const s = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
    if ((await s.get("shr_job_posts?select=id&limit=1")).length) continue;       // مبذور سلفاً
    const users = await s.get("shr_users?select=id,email");
    const U = { ops: users.find((u) => u.email.startsWith("ops@")), owner: users.find((u) => u.email.startsWith("owner@")) };
    const ests = await s.get("shr_establishments?select=id,name_ar&order=created_at.asc");
    const jobs = await s.get("shr_jobs?select=id,title,city,headcount,status&order=created_at.asc");
    if (!U.ops || !U.owner || !jobs.length || ests.length < 2) continue;
    const mkEvent = (post, from, to, actor, note, d) => s.post("shr_job_post_events", { post_id: post.id, from_status: from, to_status: to, actor: actor.id, note, at: iso(d) });
    // [الحالة، الوظيفة، المنشأة، العنوان، الوصف، المتطلبات، نطاق الراتب|null]
    const plan = slug === "SHR" ? [
      ["draft", 0, 0, "مطلوب فني تكييف في الرياض (إعلان تجريبي)", "نبحث عن فني تكييف للعمل في الرياض. عدد المطلوبين: 3.\nتفاصيل العمل تُحدَّد عند المقابلة.", "• خبرة لا تقل عن 5 سنوات\n• إقامة قابلة لنقل الخدمات", null],
      ["pending_approval", 1, 1, "مطلوب سائق نقل خفيف (إعلان تجريبي)", "نبحث عن سائق للعمل في الرياض. عدد المطلوبين: 2.\nتفاصيل العمل تُحدَّد عند المقابلة.", "• رخصة قيادة سارية\n• خبرة لا تقل عن 3 سنوات", null],
      ["published", 0, 1, "فني تكييف — مشروع تجريبي (إعلان تجريبي منشور داخلياً)", "فرصة لفني تكييف في الرياض ضمن مشروع تجريبي. عدد المطلوبين: 3.\nيظهر هذا الإعلان داخل صفحة SHR الخاصة فقط.", "• خبرة لا تقل عن 5 سنوات\n• مهارة: تركيب سبليت", [2500, 3500]],
      ["approved", 1, 2, "مطلوب سائق — منشأة مقيّدة (إعلان تجريبي محجوب)", "إعلان تجريبي اعتُمد قبل أن تُقيَّد منشأته الوهمية، لإثبات الحجب عند النشر.", "• رخصة قيادة سارية", null],
    ] : [
      ["draft", 0, 0, "مطلوب لحّام (إعلان وهمي لمستأجر آخر)", "إعلان وهمي لمستأجر آخر لإثبات العزل.", null, null],
    ];
    const posts = [];
    for (const [status, ji, ei, title, description, requirements, sal] of plan) {
      const job = jobs[ji] || jobs[0], est = ests[ei] || ests[0];
      const approved = status === "approved" || status === "published";
      const post = (await s.post("shr_job_posts", {
        job_id: job.id, establishment_id: est.id, title, description, requirements, city: job.city || null, headcount: job.headcount,
        language: "ar", salary_min: sal ? sal[0] : null, salary_max: sal ? sal[1] : null, salary_entered_by: sal ? U.ops.id : null,
        status, channel: "shr_private", created_by: U.ops.id,
        submitted_by: status === "draft" ? null : U.ops.id, submitted_at: status === "draft" ? null : iso(-4),
        approved_by: approved ? U.owner.id : null, approved_at: approved ? iso(-3) : null,
        published_by: status === "published" ? U.owner.id : null, published_at: status === "published" ? iso(-2) : null,
        closed_by: null, closed_at: null, close_reason: null, demo: true, updated_at: null,
      }))[0];
      posts.push(post);
      await mkEvent(post, null, "draft", U.ops, "إنشاء مسودة", -5);
      if (status !== "draft") await mkEvent(post, "draft", "pending_approval", U.ops, null, -4);
      if (approved) await mkEvent(post, "pending_approval", "approved", U.owner, null, -3);
      if (status === "published") await mkEvent(post, "approved", "published", U.owner, null, -2);
    }
    for (const c of ["public_bp_jobs", "external"]) await s.post("shr_post_channels", { channel: c, channel_enabled: false, updated_by: null, updated_at: null });
    // طلبات التقديم الوهمية على وظيفة الإعلان المنشور تُنسب إليه ليظهر العدّاد.
    const pub = posts.find((p) => p.status === "published");
    if (pub) for (const a of await s.get(`shr_applications?job_id=eq.${pub.job_id}&select=id`)) await s.patch(`shr_applications?id=eq.${a.id}`, { post_id: pub.id });
  }
}

// ------------------------------------------------------------ worker seed --
// بوابة العامل: مستخدمو عمال `*@worker.invalid` لعاملين نشطين في عميلين مختلفين من SHR
// (عامل ١ مع العميل أ: إقامة قريبة الانتهاء · عامل ٣ مع العميل ب: تأمين منتهٍ) وآخر في OTHER.
// الربط بـshr_users.worker_id. طلبان وهميان لعامل ١ ليظهرا في شاشة طلبات المشغّل (worker_id بلا عميل).
// تعمل بعد seedClients (التي تنقل العاملين ٣ و٤ إلى العميل ب) وتُرقّي القواعد القديمة تلقائياً.
export async function seedWorkers() {
  assertLocal();
  for (const slug of ["SHR", "OTHER"]) {
    const t = await tenantBySlug(slug);
    if (!t) continue;
    const s = scoped(ctxFrom({ tenant_id: t.id, role: "tenant_owner" }));
    if ((await s.get("shr_users?role=eq.worker&select=id&limit=1")).length) continue;      // مبذور سلفاً
    const workers = await s.get("shr_workers?select=id,full_name,status&order=created_at.asc");
    const pick = (re) => workers.find((w) => w.status === "active" && re.test(w.full_name));
    const plan = slug === "SHR"
      ? [["a-worker@worker.invalid", "عامل تجريبي ١ — حساب العامل", pick(/١$/)], ["b-worker@worker.invalid", "عامل تجريبي ٣ — حساب العامل", pick(/٣$/)]]
      : [["x-worker@worker.invalid", "عامل وهمي آخر ١ — حساب العامل", pick(/١$/)]];
    const U = {};
    for (const [email, name, w] of plan) if (w) U[email] = (await s.post("shr_users", { email, full_name: name, role: "worker", worker_id: w.id }))[0];
    const first = U["a-worker@worker.invalid"];
    if (first) {
      for (const [kind, state, note, topic] of [["worker_document", "new", "طلب تجريبي: خطاب تعريف بالعمل", "employment_letter"], ["worker_inquiry", "in_review", "طلب تجريبي: استفسار عن موعد تجديد الإقامة", "documents"]]) {
        await s.post("shr_requests", { worker_id: first.worker_id, client_company_id: null, kind, state, created_by: first.id, body: { note, topic, source: "worker_portal", demo: true } });
      }
    }
  }
}
