// SHR-HR — وحدة الامتثال. ملف مساعد (لا يُحتسب دالة): يُستدعى من api/shr.js وحده.
//
// كل وصول للبيانات عبر db = scoped(ctx) من _shr.js. لا شبكة ولا رسائل ولا ربط حكومي.
// بيانات وهمية فقط. لا رقم نظامي هنا: الأرقام كلها من db/shr-ref/*.json عبر _shr_ref.js،
// وما verified فيه غير "confirmed" لا يُفعَّل في منع أو تنبيه ولا يصل عميلاً.
//
// ما لم يُوجد في المرجع (not_found.json) يبقى فارغاً بتعليق: انظر NOT_FOUND أدناه.
import { HttpError, audit, hashIdNo } from "./_shr.js";
import * as R from "./_shr_ref.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ------------------------------------------------------------ not_found ----
// عناصر طلب مشاري تركها فارغة لأن المصدر الرسمي لم يُوجد (db/shr-ref/not_found.json).
// لا تُملأ بتخمين: لا ثابت ولا شرط ولا مدة يُشتق منها شيء حتى يظهر مصدر.
export const NOT_FOUND = Object.freeze({
  suspicionRestriction: null,      // قيد الاشتباه ومدته وآلية رفعه — لم يُوجد؛ الحالة suspected تُدخَل بشرياً وتحجب فقط
  suspicionCriteria: null,         // معايير الاشتباه التفصيلية للتوطين الوهمي — غير منشورة
  transferConditions: [],          // شروط نقل العامل (نقل الخدمات) — لم تُوجد؛ لا فحص شروط، والنقل بطلب وموافقة وسجل فقط
  ajeerNoticeDefinition: null,     // تعريف «إشعار أجير» (A-53) — لم يُوجد؛ لا يُشرح من عندنا
  wageProtectionRatio: null,       // نسبة امتثال حماية الأجور المحددة (A-40) — بلا رقم
  dayCountBasis: null,             // تقويمي/هجري/عمل لمهل الاعتراض والسداد والتسوية — غير محسوم؛ المواعيد تقدير دائماً
});

// ---------------------------------------------------------- operational ----
// افتراضات تشغيلية لا نظامية، قابلة للتغيير بإعداد المستأجر (shr_compliance_settings).
const DEFAULTS = Object.freeze({
  unknown_blocks: false,
  expiry_alert_days: 60,     // operational-default
  deadline_alert_days: 14,   // operational-default
  client_visibility: false,
  a33_gate: true,
  block_steps: ["visa"],
});
const BOUNDS = Object.freeze({ expiry_alert_days: [1, 365], deadline_alert_days: [1, 180] });   // operational-default
// أطوال الحقول النصية (تشغيلية، ليست أرقاماً نظامية).
const LEN = Object.freeze({ id: 40, tier: 20, key: 60, name: 80, label: 120, note: 200, text: 300 });   // operational-default
const MAX_COUNT = 999;       // operational-default: أقصى عدد أشخاص/حالات في مخالفة واحدة
const MAX_ROWS = 200;        // operational-default: أقصى صفوف دفعة استيراد (أكثر يُرفض كله)
const STEP_KINDS = ["visa", "iqama", "medical", "insurance"];
const ROW_STATUS = { gosi: ["registered", "not_registered"], wps: ["paid", "not_paid"] };
const A33_CLASSES = ["actual_worker", "not_a_worker", "works_for_other"];
const PAID = ["unknown", "unpaid", "paid"];
const RESTRICTION = ["unknown", "clear", "restricted", "suspected"];
const SUBJECT_TABLE = { establishment: "shr_establishments", worker: "shr_workers", violation: "shr_violations" };
const ESTABLISHMENT_STATES_BLOCKING = new Set(["restricted", "suspected"]);

const STAFF_ROLES = new Set(["tenant_owner", "operator", "compliance_officer"]);
const CLIENT_ROLES = new Set(["client_admin", "client_viewer"]);
const OFFICER = "compliance_officer";

// حقول يُمنع أن تأتي من الطلب: أرقام نظامية (غرامة/مدة/نسبة/موعد) ومخرجات الحساب. تُحسب من المرجع وحده.
const REGULATORY_FIELDS = ["fine", "fine_sar", "fine_source", "amount", "amount_sar", "fine_estimate_sar", "penalty", "days", "objection_days",
  "settlement_days", "payment_days", "deadline", "objection_deadline", "estimated_objection_deadline", "objection_basis",
  "reduction_pct", "discount", "discount_pct", "percent", "pct", "multiplier", "rule_verified", "kind_ar", "severity"];
const COMPUTED_FIELDS = ["computed_pct", "computed_band", "computed_basis", "total", "thresholds"];
const CONTACT_KEYS = ["phone", "mobile", "email", "iqama", "national_id", "passport", "contact", "full_name", "name"];

const bad = (code, extra) => new HttpError(400, code, extra);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const needId = (v) => { if (!UUID.test(String(v || ""))) throw bad("bad_id"); return String(v); };
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split("T")[0];
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const intIn = (v, min, max, code) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw bad(code); return n; };
const dateOrNull = (v, code) => { if (v === undefined || v === null || v === "") return null; if (!R.isIsoDate(String(v))) throw bad(code); return String(v); };

function rejectFields(b, { regulatory = true, computed = true } = {}) {
  const forb = R.forbiddenDeadlineInputs();
  for (const k of Object.keys(b)) {
    if (forb.includes(k)) throw bad("forbidden_deadline_input", { field: k });              // موعد لا يُشتق من تاريخ المخالفة أو القرار
    if (regulatory && REGULATORY_FIELDS.includes(k)) throw bad("regulatory_figure_not_allowed", { field: k });
    if (computed && COMPUTED_FIELDS.includes(k)) throw bad("regulatory_figure_not_allowed", { field: k });
  }
}

// ---------------------------------------------------------------- policy ----
// ما يراه كل دور. العميل والعامل والمكتب لا يرون مخالفات ولا حالة القيد؛ والعميل يراها فقط
// إن فعّل المستأجر client_visibility، وعندها مُقنَّعةً: بند مؤكد وراجَعه ثانٍ، بلا معرّفات داخلية.
const CLIENT_ACTIONS = new Set(["compliance-violations"]);
export function policy(role, settings, action) {
  if (STAFF_ROLES.has(role)) return "full";
  if (CLIENT_ROLES.has(role) && settings && settings.client_visibility === true && CLIENT_ACTIONS.has(action)) return "client";
  return "deny";
}
export function redactViolationForClient(v) {
  if (!v || !v.rule || v.rule.usable !== true || !v.reviewed_by) return null;      // غير مؤكد أو غير مُراجَع: لا يظهر لعميل
  return {
    id: v.id, kind_ar: v.kind_ar, authority: v.authority, status: v.status, status_label_ar: v.status_label_ar, paid_state: v.paid_state,
    fine_estimate: v.fine_estimate && v.fine_estimate.estimate ? { amount_sar: v.fine_estimate.amount_sar, estimate: true, label_ar: R.ESTIMATE_LABEL_AR, source_ref: v.fine_estimate.source_ref } : null,
    disclaimer_ar: R.NO_GUARANTEE_AR,
  };
}
// قوائم التحقق: كل دور يرى قوائمه فقط؛ الطاقم يرى الكل.
export function checklistVisibleTo(role, tpl) {
  if (STAFF_ROLES.has(role)) return true;
  const mine = { client_admin: "client", client_viewer: "client", worker: "worker", agency: "agency" }[role];
  return !!mine && tpl.audience === mine;
}

// -------------------------------------------------------------- settings ----
function pickSettings(row) {
  const o = {};
  for (const k of Object.keys(DEFAULTS)) if (row[k] !== undefined && row[k] !== null) o[k] = row[k];
  if (o.block_steps && !Array.isArray(o.block_steps)) delete o.block_steps;
  return o;
}
export async function getSettings(db) {
  const row = (await db.get("shr_compliance_settings?limit=1"))[0];
  return { ...DEFAULTS, ...(row ? pickSettings(row) : {}) };
}
async function updateSettings(db, ctx, user, b) {
  if (ctx.role !== "tenant_owner") throw new HttpError(403, "owner_only");
  const patch = {};
  for (const [k, v] of Object.entries(b)) {
    if (k === "action") continue;
    if (!(k in DEFAULTS)) throw bad("unknown_setting", { field: k });
    if (typeof DEFAULTS[k] === "boolean") { if (typeof v !== "boolean") throw bad("bad_setting", { field: k }); patch[k] = v; }
    else if (k === "block_steps") {
      if (!Array.isArray(v) || !v.every((x) => STEP_KINDS.includes(x))) throw bad("bad_setting", { field: k });
      patch[k] = [...new Set(v)];
    } else patch[k] = intIn(v, BOUNDS[k][0], BOUNDS[k][1], "bad_setting");
  }
  if (!Object.keys(patch).length) throw bad("nothing_to_update");
  const row = (await db.get("shr_compliance_settings?limit=1"))[0];
  const meta = { updated_by: user.sub, updated_at: nowIso() };
  let id;
  if (row) { await db.patch(`shr_compliance_settings?id=eq.${row.id}`, { ...patch, ...meta }); id = row.id; }
  else id = (await db.post("shr_compliance_settings", { ...DEFAULTS, ...patch, ...meta }))[0].id;
  await audit(db, user, "compliance.settings:" + Object.keys(patch).join(","), "shr_compliance_settings", id);
  return { settings: await getSettings(db) };
}

// ------------------------------------------------------ establishment state ----
const sortSnaps = (snaps) => snaps.map((s, i) => [s, i]).sort((a, b) =>
  String(b[0].as_of || "").localeCompare(String(a[0].as_of || "")) || String(b[0].created_at || "").localeCompare(String(a[0].created_at || "")) || b[1] - a[1]).map((x) => x[0]);

// الحالة الفعلية للمنع: آخر لقطة. restricted/suspected تحجب ولو لم تُتحقَّق (اتجاه آمن).
// لقطة clear غير متحقَّق منها لا تُصدَّق (unknown)، ولا تَرفع قيداً متحقَّقاً سابقاً حتى تُتحقَّق.
export function effectiveState(snaps, legacy = "unknown") {
  const list = sortSnaps(snaps || []);
  const latest = list[0];
  if (!latest) {
    const st = ESTABLISHMENT_STATES_BLOCKING.has(legacy) ? legacy : "unknown";
    return { state: st, declared: legacy || "unknown", verified: false, reason: null, as_of: null, snapshot_id: null, verified_on: null, pending_clear_verification: false };
  }
  const verified = !!(latest.verified_by && latest.verified_on);
  let state = latest.restriction_state, reason = latest.restriction_reason || null, pending = false;
  // لقطة clear غير متحقَّق منها (أو unknown) لا تُصدَّق ولا ترفع قيداً: الحالة الفعلية آخر لقطة متحقَّق منها،
  // وإن لم توجد فclear غير المتحقَّق تُعامل unknown.
  const weak = (state === "clear" && !verified) || state === "unknown";
  if (weak) {
    const lastV = list.find((s) => s.verified_by && s.verified_on);
    if (lastV) { state = lastV.restriction_state; reason = lastV.restriction_reason || null; pending = lastV !== latest; }
    else if (state === "clear") state = "unknown";
  }
  return { state, declared: latest.restriction_state, verified, reason, as_of: latest.as_of, snapshot_id: latest.id, verified_on: latest.verified_on || null, pending_clear_verification: pending };
}

export async function establishmentState(db, estId) {
  const e = (await db.get(`shr_establishments?id=eq.${needId(estId)}&select=id,name_ar,restriction_state`))[0];
  if (!e) throw new HttpError(404, "not_found");
  const snaps = await db.get(`shr_establishment_compliance?establishment_id=eq.${e.id}`);
  return { establishment: e, snaps: sortSnaps(snaps), eff: effectiveState(snaps, e.restriction_state) };
}

// بوابة الحجب: restricted/suspected → 409 establishment_blocked مع السبب.
// unknown تحذير لا منع، إلا إن فعّل المستأجر unknown_blocks. تُرجع مصفوفة التحذيرات.
export async function assertEstablishmentOpen(db, estId, settings) {
  const { eff } = await establishmentState(db, estId);
  const extra = { state: eff.state, reason: eff.reason, verified: eff.verified, as_of: eff.as_of, pending_clear_verification: eff.pending_clear_verification };
  if (ESTABLISHMENT_STATES_BLOCKING.has(eff.state)) throw new HttpError(409, "establishment_blocked", extra);
  if (eff.state === "unknown") {
    if (settings && settings.unknown_blocks) throw new HttpError(409, "establishment_blocked", { ...extra, reason: "unknown_state_blocked_by_tenant_setting" });
    return ["establishment_state_unknown"];
  }
  return [];
}

async function recordSnapshot(db, user, b) {
  rejectFields(b, { regulatory: false });
  const est = (await db.get(`shr_establishments?id=eq.${needId(b.establishment_id)}&select=id`))[0];
  if (!est) throw new HttpError(404, "not_found");
  const state = String(b.restriction_state || "");
  if (!RESTRICTION.includes(state)) throw bad("bad_restriction_state");
  const reason = str(b.restriction_reason, LEN.text) || null;
  if ((state === "restricted" || state === "suspected") && !reason) throw bad("reason_required");
  const as_of = dateOrNull(b.as_of, "bad_as_of") || today();
  const band = b.declared_band ? String(b.declared_band) : null;
  if (band && !R.BAND_KEYS.includes(band)) throw bad("bad_band");
  let pct = null;
  if (b.declared_saudization_pct !== undefined && b.declared_saudization_pct !== null && b.declared_saudization_pct !== "") {
    pct = Number(b.declared_saudization_pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw bad("bad_declared_pct");
  }
  const cnt = (v, code) => (v === undefined || v === null || v === "" ? null : intIn(v, 0, 1e7, code));
  const saudi = cnt(b.saudi_count, "bad_count"), non = cnt(b.non_saudi_count, "bad_count");
  const act = b.activity_rule_id ? String(b.activity_rule_id) : null;
  if (act && !/^NIT-\d+$/.test(act)) throw bad("unknown_activity");
  let comp = null;
  if (act) {
    if (!R.getRef().nitaqat.get(act)) throw bad("unknown_activity");
    if (saudi !== null && non !== null) comp = R.nitaqatEstimate({ activity_rule_id: act, saudi, non_saudi: non, year: as_of.slice(0, 4) });
  }
  const row = {
    establishment_id: est.id, as_of, activity_rule_id: act, declared_band: band, declared_saudization_pct: pct,
    saudi_count: saudi, non_saudi_count: non,
    computed_pct: comp && comp.ok ? comp.pct : null, computed_band: comp && comp.ok ? comp.band : null,
    computed_basis: comp && comp.ok ? { estimate: true, rule_id: comp.rule_id, source_ref: comp.source_ref, formula_source_ref: comp.formula_source_ref, caveats: comp.caveats } : null,
    restriction_state: state, restriction_reason: reason, source_note: str(b.source_note, LEN.note) || null,
    entered_by: user.sub, verified_on: null, verified_by: null, demo: true,
  };
  const s = (await db.post("shr_establishment_compliance", row))[0];
  await db.patch(`shr_establishments?id=eq.${est.id}`, { restriction_state: state });       // مرآة للقراءات القديمة؛ المرجع هو اللقطة
  await audit(db, user, `establishment.compliance.record:${state}`, "shr_establishment_compliance", s.id);
  return { snapshot: { id: s.id, as_of, restriction_state: state, verified: false } };
}

async function verifySnapshot(db, user, b) {
  const id = needId(b.snapshot_id);
  const s = (await db.get(`shr_establishment_compliance?id=eq.${id}`))[0];
  if (!s) throw new HttpError(404, "not_found");
  if (s.verified_by) throw new HttpError(409, "already_verified");
  if (s.entered_by === user.sub) throw new HttpError(403, "maker_checker");          // من يُدخل لا يتحقق
  const on = dateOrNull(b.verified_on, "bad_verified_on") || today();
  if (on > today()) throw bad("verified_in_future");
  await db.patch(`shr_establishment_compliance?id=eq.${id}&verified_by=is.null`, { verified_by: user.sub, verified_on: on });
  await audit(db, user, `establishment.compliance.verify:${s.restriction_state}`, "shr_establishment_compliance", id);
  return { snapshot: { id, verified: true, verified_on: on } };
}

function viewSnapshot(s, names) {
  const comp = s.activity_rule_id && s.saudi_count !== null && s.non_saudi_count !== null
    ? R.nitaqatEstimate({ activity_rule_id: s.activity_rule_id, saudi: s.saudi_count, non_saudi: s.non_saudi_count, year: String(s.as_of).slice(0, 4) }) : null;
  return {
    id: s.id, as_of: s.as_of, restriction_state: s.restriction_state, restriction_reason: s.restriction_reason || null, source_note: s.source_note || null,
    verified: !!s.verified_by, verified_on: s.verified_on || null, entered_by: s.entered_by, verified_by: s.verified_by || null,
    activity_rule_id: s.activity_rule_id || null, declared_band: s.declared_band || null, declared_band_ar: s.declared_band ? R.bandLabelAr(s.declared_band) : null,
    declared_saudization_pct: s.declared_saudization_pct ?? null, saudi_count: s.saudi_count ?? null, non_saudi_count: s.non_saudi_count ?? null,
    computed: comp ? (comp.ok ? { estimate: true, label_ar: R.ESTIMATE_LABEL_AR, pct: comp.pct, band: comp.band, band_ar: comp.band_ar, thresholds: comp.thresholds, caveats: comp.caveats, source_ref: comp.source_ref, verified: comp.verified }
      : { unavailable: comp.reason, label_ar: comp.label_ar || null }) : null,
    entered_by_name: names && names[s.entered_by] ? names[s.entered_by] : null,
  };
}

// ------------------------------------------------------------ violations ----
function statusMap() { return Object.fromEntries(R.caseStatuses().map((s) => [s.key, s])); }

function viewViolation(v, estNames) {
  const rule = R.describeRule(v.rule_id);
  const calc = R.computeViolation({ rule_id: v.rule_id, size_tier: v.size_tier, persons_count: v.persons_count, notification_date: v.notification_date });
  const st = statusMap()[v.status] || null;
  const win = (r) => (r.ok ? { estimate: true, label_ar: r.label_ar, deadline: r.deadline, days: r.days, anchor: r.anchor, rule_id: r.rule_id, source_url: r.source_url, source_ref: r.source_ref, verified: r.verified, basis_note_ar: r.basis_note_ar }
    : { unavailable: r.reason, label_ar: r.label_ar || null });
  const f = calc.fine;
  return {
    id: v.id, establishment_id: v.establishment_id, establishment: estNames ? estNames[v.establishment_id] || null : null,
    authority: v.authority, ref_no: v.ref_no || null, rule_id: v.rule_id, kind_ar: v.kind_ar, severity: v.severity || null,
    persons_count: v.persons_count, size_tier: v.size_tier || null, rule,
    fine_estimate: f.ok ? { estimate: true, label_ar: R.ESTIMATE_LABEL_AR, amount_sar: f.amount_sar, unit_sar: f.unit_sar, count: f.count, tier: f.tier, multiplier: f.multiplier, rule_id: f.rule_id, source_url: f.source_url, source_ref: f.source_ref, verified: f.verified, caveats: f.caveats }
      : { unavailable: f.reason, label_ar: f.label_ar || null },
    notification_date: v.notification_date || null,
    objection: win(calc.objection), settlement: win(calc.settlement), payment: win(calc.payment),
    status: v.status, status_label_ar: st ? st.label_ar : null, human_task: !!(st && st.human_task),
    paid_state: v.paid_state, entered_by: v.entered_by, reviewed_by: v.reviewed_by || null, reviewed_at: v.reviewed_at || null,
    created_at: v.created_at,
  };
}

async function estNames(db) {
  return Object.fromEntries((await db.get("shr_establishments?select=id,name_ar")).map((e) => [e.id, e.name_ar]));
}

async function listViolations(db, ctx, settings, q) {
  const st = q.status ? String(q.status) : "";
  if (st && !R.caseStatusKeys().includes(st)) throw bad("bad_status");
  const est = q.establishment_id ? `&establishment_id=eq.${needId(q.establishment_id)}` : "";
  const rows = (await db.get(`shr_violations?archived_at=is.null${est}${st ? `&status=eq.${st}` : ""}&order=created_at.asc`));
  let out = rows.map((v) => viewViolation(v, null));
  const names = await estNames(db);
  out = out.map((v) => ({ ...v, establishment: names[v.establishment_id] || null }));
  if (policy(ctx.role, settings, "compliance-violations") === "client") out = out.map(redactViolationForClient).filter(Boolean);
  return { violations: out, statuses: R.caseStatuses(), disclaimer_ar: R.NO_GUARANTEE_AR };
}

async function createViolation(db, user, b) {
  rejectFields(b);
  const est = (await db.get(`shr_establishments?id=eq.${needId(b.establishment_id)}&select=id`))[0];
  if (!est) throw new HttpError(404, "not_found");
  const authority = str(b.authority, LEN.name);
  if (authority.length < 2) throw bad("authority_required");
  const ruleId = String(b.rule_id || "");
  if (!R.getRef().violations.has(ruleId)) throw bad("unknown_rule");              // بند غير موجود في المرجع لا يُسجَّل
  const rule = R.describeRule(ruleId);
  const persons = intIn(b.persons_count === undefined ? 1 : b.persons_count, 1, MAX_COUNT, "bad_persons_count");
  const tier = str(b.size_tier, LEN.tier) || null;
  if (tier && rule.tiers.length && !rule.tiers.includes(tier)) throw bad("tier_unknown", { tiers: rule.tiers });
  const notification = dateOrNull(b.notification_date, "bad_notification_date");
  if (notification && notification > today()) throw bad("notification_in_future");
  const first = R.caseStatusKeys()[0];
  if (!first) throw new HttpError(409, "statuses_unconfirmed");
  const ref_no = str(b.ref_no, LEN.key) || null;
  if (ref_no && (await db.get(`shr_violations?authority=eq.${encodeURIComponent(authority)}&ref_no=eq.${encodeURIComponent(ref_no)}&archived_at=is.null&select=id`))[0]) throw new HttpError(409, "duplicate_violation");
  const { row: calcRow } = R.violationFields({ rule_id: ruleId, size_tier: tier, persons_count: persons, notification_date: notification });
  const row = {
    establishment_id: est.id, authority, ref_no, rule_id: ruleId, ...calcRow,
    persons_count: persons, size_tier: tier,
    notification_date: notification, notification_entered_by: notification ? user.sub : null,
    status: first, paid_state: "unknown", entered_by: user.sub, reviewed_by: null, reviewed_at: null, archived_at: null, demo: true, updated_at: null,
  };
  const v = (await db.post("shr_violations", row))[0];
  await audit(db, user, `violation.create:${ruleId}`, "shr_violations", v.id);
  return { violation: viewViolation(v, null) };
}

async function getViolation(db, id) {
  const v = (await db.get(`shr_violations?id=eq.${needId(id)}`))[0];
  if (!v) throw new HttpError(404, "not_found");
  if (v.archived_at) throw new HttpError(409, "archived");
  return v;
}

async function setNotification(db, user, b) {
  rejectFields(b, { regulatory: true });
  const v = await getViolation(db, b.id);
  const date = dateOrNull(b.notification_date, "bad_notification_date");
  if (!date) throw bad("notification_date_required");
  if (date > today()) throw bad("notification_in_future");
  await db.patch(`shr_violations?id=eq.${v.id}`, {
    notification_date: date, notification_entered_by: user.sub, updated_at: nowIso(), ...R.objectionFields(R.objectionDeadline(date)),
  });
  await audit(db, user, `violation.notification_date:${v.notification_date || "none"}->${date}`, "shr_violations", v.id);
  return { violation: viewViolation({ ...v, notification_date: date }, null) };
}

async function reviewViolation(db, user, b) {
  const v = await getViolation(db, b.id);
  if (v.reviewed_by) throw new HttpError(409, "already_reviewed");
  if (v.entered_by === user.sub) throw new HttpError(403, "maker_checker");          // من يُدخل لا يراجع
  await db.patch(`shr_violations?id=eq.${v.id}&reviewed_by=is.null`, { reviewed_by: user.sub, reviewed_at: nowIso(), updated_at: nowIso() });
  await audit(db, user, "violation.review", "shr_violations", v.id);
  return { violation: { id: v.id, reviewed: true } };
}

async function setViolationStatus(db, ctx, user, b) {
  const v = await getViolation(db, b.id);
  const sts = R.caseStatuses(), keys = sts.map((s) => s.key);
  const to = String(b.status || "");
  if (!keys.includes(to)) throw bad("bad_status");
  const i = keys.indexOf(v.status), j = keys.indexOf(to);
  if (i < 0) throw new HttpError(409, "status_unknown");
  if (i === j) throw new HttpError(409, "same_status");
  if (Math.abs(i - j) !== 1) throw new HttpError(409, "bad_transition", { from: v.status, to, allowed: [keys[i - 1], keys[i + 1]].filter(Boolean) });
  // المهمة البشرية (التقديم عبر بوابة الجهة بهوية العميل) لا تتغير إلا بـcompliance_officer، دخولاً وخروجاً.
  const human = new Set(sts.filter((s) => s.human_task).map((s) => s.key));
  if ((human.has(v.status) || human.has(to)) && ctx.role !== OFFICER) throw new HttpError(403, "compliance_officer_required");
  if (j > 0 && !v.reviewed_by) throw new HttpError(409, "review_required");          // لا تقدّم بلا مراجعة ثانية
  await db.patch(`shr_violations?id=eq.${v.id}&status=eq.${v.status}`, { status: to, updated_at: nowIso() });
  await audit(db, user, `violation.status.${v.status}->${to}`, "shr_violations", v.id);
  return { violation: { id: v.id, status: to, from: v.status } };
}

async function setPaid(db, user, b) {
  const v = await getViolation(db, b.id);
  const to = String(b.paid_state || "");
  if (!PAID.includes(to)) throw bad("bad_paid_state");
  if (v.paid_state === to) throw new HttpError(409, "same_state");
  await db.patch(`shr_violations?id=eq.${v.id}`, { paid_state: to, updated_at: nowIso() });
  await audit(db, user, `violation.paid.${v.paid_state}->${to}`, "shr_violations", v.id);
  return { violation: { id: v.id, paid_state: to } };
}

async function archiveViolation(db, user, b) {
  const v = (await db.get(`shr_violations?id=eq.${needId(b.id)}&select=id,archived_at`))[0];
  if (!v) throw new HttpError(404, "not_found");
  if (!v.archived_at) {
    await db.patch(`shr_violations?id=eq.${v.id}`, { archived_at: nowIso(), updated_at: nowIso() });
    await audit(db, user, "violation.archive", "shr_violations", v.id);
  }
  return { violation: { id: v.id, archived: true } };
}

// ------------------------------------------------------------------ A33 ----
function a33Complete(r) { return !!r.classification && !!r.approved_by; }

// تفعيل العامل المرتبط بقائمة A33 محجوب حتى يُصنَّف كل اسم في قائمته ويعتمد مراجع ثانٍ.
export async function a33Gate(db, workerId, settings) {
  if (settings && settings.a33_gate === false) return { blocked: false, reasons: [] };
  const mine = (await db.get(`shr_a33_names?worker_id=eq.${needId(workerId)}&archived_at=is.null`));
  const reasons = [];
  for (const m of mine) {
    if (m.classification === "not_a_worker") reasons.push({ code: "a33_not_a_worker", list_ref: m.list_ref });
  }
  const lists = new Map(mine.map((m) => [m.establishment_id + "|" + m.list_ref, m]));
  for (const m of lists.values()) {
    const all = await db.get(`shr_a33_names?establishment_id=eq.${m.establishment_id}&list_ref=eq.${encodeURIComponent(m.list_ref)}&archived_at=is.null`);
    const pending = all.filter((r) => !a33Complete(r));
    if (pending.length) reasons.push({ code: "a33_unresolved", list_ref: m.list_ref, pending: pending.length, total: all.length });
  }
  return { blocked: reasons.length > 0, reasons };
}
export async function assertA33(db, workerId) {
  const g = await a33Gate(db, workerId, await getSettings(db));
  if (g.blocked) throw new HttpError(409, "a33_blocked", { reasons: g.reasons });
}

async function addA33(db, user, b) {
  for (const k of Object.keys(b)) if (CONTACT_KEYS.includes(k) || ["classification", "approved_by", "classified_by"].includes(k)) throw bad("field_not_allowed", { field: k });
  const est = (await db.get(`shr_establishments?id=eq.${needId(b.establishment_id)}&select=id`))[0];
  if (!est) throw new HttpError(404, "not_found");
  const list_ref = str(b.list_ref, LEN.key);
  if (list_ref.length < 2) throw bad("list_ref_required");
  const alias = str(b.alias, LEN.label);
  if (alias.length < 2) throw bad("alias_required");
  if (!alias.includes("(وهمي)")) throw bad("demo_alias_required");               // لا أسماء حقيقية في هذه المرحلة
  const id_no = str(b.id_no, LEN.id);
  if (id_no.length < 2) throw bad("id_no_required");
  let worker_id = null;
  if (b.worker_id) {
    worker_id = needId(b.worker_id);
    if (!(await db.get(`shr_workers?id=eq.${worker_id}&select=id`))[0]) throw new HttpError(404, "not_found");
  }
  const id_no_hash = hashIdNo(db.ctx.tenantId, id_no);                           // الرقم لا يُخزَّن
  if ((await db.get(`shr_a33_names?establishment_id=eq.${est.id}&list_ref=eq.${encodeURIComponent(list_ref)}&id_no_hash=eq.${id_no_hash}&archived_at=is.null&select=id`))[0]) throw new HttpError(409, "duplicate_name");
  const r = (await db.post("shr_a33_names", {
    establishment_id: est.id, list_ref, alias, id_no_hash, worker_id, classification: null, classification_note: null,
    classified_by: null, classified_at: null, approved_by: null, approved_at: null, archived_at: null, demo: true, created_by: user.sub,
  }))[0];
  await audit(db, user, "a33.add", "shr_a33_names", r.id);
  return { name: { id: r.id, list_ref, alias } };
}

async function classifyA33(db, user, b) {
  const r = (await db.get(`shr_a33_names?id=eq.${needId(b.id)}`))[0];
  if (!r || r.archived_at) throw new HttpError(404, "not_found");
  const cls = String(b.classification || "");
  if (!A33_CLASSES.includes(cls)) throw bad("bad_classification");
  if (r.approved_by) throw new HttpError(409, "already_approved");                // بعد الاعتماد لا يُعاد التصنيف
  await db.patch(`shr_a33_names?id=eq.${r.id}&approved_by=is.null`, { classification: cls, classification_note: str(b.note, LEN.text) || null, classified_by: user.sub, classified_at: nowIso() });
  await audit(db, user, `a33.classify:${cls}`, "shr_a33_names", r.id);
  return { name: { id: r.id, classification: cls } };
}

async function approveA33(db, user, b) {
  const r = (await db.get(`shr_a33_names?id=eq.${needId(b.id)}`))[0];
  if (!r || r.archived_at) throw new HttpError(404, "not_found");
  if (!r.classification) throw new HttpError(409, "not_classified");
  if (r.approved_by) throw new HttpError(409, "already_approved");
  if (r.classified_by === user.sub) throw new HttpError(403, "maker_checker");     // المصنِّف لا يعتمد
  await db.patch(`shr_a33_names?id=eq.${r.id}&approved_by=is.null`, { approved_by: user.sub, approved_at: nowIso() });
  await audit(db, user, "a33.approve", "shr_a33_names", r.id);
  return { name: { id: r.id, approved: true } };
}

async function listA33(db, q) {
  const f = (q.establishment_id ? `&establishment_id=eq.${needId(q.establishment_id)}` : "") + (q.list_ref ? `&list_ref=eq.${encodeURIComponent(String(q.list_ref))}` : "");
  const rows = await db.get(`shr_a33_names?archived_at=is.null${f}&order=created_at.asc`);
  const lists = {};
  for (const r of rows) {
    const k = r.establishment_id + "|" + r.list_ref;
    const l = lists[k] || (lists[k] = { establishment_id: r.establishment_id, list_ref: r.list_ref, total: 0, classified: 0, approved: 0 });
    l.total++; if (r.classification) l.classified++; if (r.approved_by) l.approved++;
  }
  const names = await estNames(db);
  return {
    names: rows.map((r) => ({ id: r.id, establishment_id: r.establishment_id, establishment: names[r.establishment_id] || null, list_ref: r.list_ref, alias: r.alias, worker_linked: !!r.worker_id,
      classification: r.classification || null, classification_note: r.classification_note || null, classified_by: r.classified_by || null, approved_by: r.approved_by || null, approved: !!r.approved_by })),
    lists: Object.values(lists).map((l) => ({ ...l, complete: l.total > 0 && l.approved === l.total, establishment: names[l.establishment_id] || null })),
    classes: A33_CLASSES,
  };
}

// -------------------------------------------------------------- transfers ----
async function requestTransfer(db, user, b) {
  const w = (await db.get(`shr_workers?id=eq.${needId(b.worker_id)}&select=id,status`))[0];
  if (!w) throw new HttpError(404, "not_found");
  if (w.status === "archived") throw new HttpError(409, "archived");
  const to = (await db.get(`shr_establishments?id=eq.${needId(b.to_establishment_id)}&select=id`))[0];
  if (!to) throw new HttpError(404, "not_found");
  const reason = str(b.reason, LEN.text);
  if (reason.length < 3) throw bad("reason_required");
  const asg = (await db.get(`shr_assignments?worker_id=eq.${w.id}&status=neq.ended&select=id,establishment_id`))[0];
  if (!asg) throw new HttpError(409, "no_assignment");
  if (asg.establishment_id === to.id) throw new HttpError(409, "same_establishment");
  if ((await db.get(`shr_worker_transfers?worker_id=eq.${w.id}&state=eq.requested&select=id`))[0]) throw new HttpError(409, "transfer_pending");
  const warnings = [];
  // شروط النقل لم تُوجد في المرجع (NOT_FOUND.transferConditions فارغة): لا فحص شروط ولا منع.
  // تنبيه معلوماتي فقط إن كانت وجهة النقل مقيّدة.
  const dest = await establishmentState(db, to.id);
  if (ESTABLISHMENT_STATES_BLOCKING.has(dest.eff.state)) warnings.push("destination_establishment_restricted");
  const t = (await db.post("shr_worker_transfers", {
    worker_id: w.id, from_establishment_id: asg.establishment_id, to_establishment_id: to.id, reason, state: "requested",
    requested_by: user.sub, decided_by: null, decided_at: null, decision_note: null,
  }))[0];
  await audit(db, user, "transfer.request", "shr_worker_transfers", t.id);
  return { transfer: { id: t.id, state: "requested", warnings } };
}

async function decideTransfer(db, user, b) {
  const t = (await db.get(`shr_worker_transfers?id=eq.${needId(b.id)}`))[0];
  if (!t) throw new HttpError(404, "not_found");
  if (t.state !== "requested") throw new HttpError(409, "already_decided");
  const d = String(b.decision || "");
  if (d !== "approve" && d !== "reject") throw bad("bad_decision");
  if (t.requested_by === user.sub) throw new HttpError(403, "maker_checker");      // من يطلب لا يوافق
  const state = d === "approve" ? "approved" : "rejected";
  await db.patch(`shr_worker_transfers?id=eq.${t.id}&state=eq.requested`, { state, decided_by: user.sub, decided_at: nowIso(), decision_note: str(b.note, LEN.text) || null });
  if (d === "approve") {
    await db.patch(`shr_assignments?worker_id=eq.${t.worker_id}&establishment_id=eq.${t.from_establishment_id}&status=neq.ended`, { establishment_id: t.to_establishment_id, transfer_approved_by: user.sub });
  }
  await audit(db, user, `transfer.${state}`, "shr_worker_transfers", t.id);
  return { transfer: { id: t.id, state } };
}

async function listTransfers(db) {
  const [rows, names, workers] = await Promise.all([db.get("shr_worker_transfers?order=created_at.desc"), estNames(db), db.get("shr_workers?select=id,full_name")]);
  const wn = Object.fromEntries(workers.map((w) => [w.id, w.full_name]));
  return { transfers: rows.map((t) => ({ id: t.id, worker: wn[t.worker_id] || null, from: names[t.from_establishment_id] || null, to: names[t.to_establishment_id] || null, reason: t.reason, state: t.state, requested_by: t.requested_by, decided_by: t.decided_by || null, created_at: t.created_at })) };
}

// ----------------------------------------------------------- procedure steps ----
async function createStep(db, user, b) {
  const step = String(b.step || "");
  if (!STEP_KINDS.includes(step)) throw bad("bad_step");
  if (!b.worker_id && !b.order_id) throw bad("worker_or_order_required");
  let establishment_id = null, worker_id = null, order_id = null;
  if (b.order_id) {
    const o = (await db.get(`shr_recruitment_orders?id=eq.${needId(b.order_id)}&select=id,establishment_id`))[0];
    if (!o) throw new HttpError(404, "not_found");
    order_id = o.id; establishment_id = o.establishment_id || null;
  }
  if (b.worker_id) {
    const w = (await db.get(`shr_workers?id=eq.${needId(b.worker_id)}&select=id`))[0];
    if (!w) throw new HttpError(404, "not_found");
    worker_id = w.id;
    if (!establishment_id) {
      const a = (await db.get(`shr_assignments?worker_id=eq.${w.id}&status=neq.ended&select=establishment_id`))[0];
      establishment_id = a ? a.establishment_id : null;
    }
  }
  const settings = await getSettings(db);
  const warnings = [];
  if (establishment_id) {
    if (settings.block_steps.includes(step)) warnings.push(...await assertEstablishmentOpen(db, establishment_id, settings));
  } else warnings.push("establishment_unknown");
  const due = dateOrNull(b.due_on, "bad_due_on");
  const s = (await db.post("shr_procedure_steps", { worker_id, order_id, establishment_id, step, state: "pending", due_on: due, created_by: user.sub }))[0];
  await audit(db, user, `step.create:${step}`, "shr_procedure_steps", s.id);
  return { step: { id: s.id, step, state: "pending", warnings } };
}

// ---------------------------------------------------------------- imports ----
async function createImport(db, user, b) {
  const kind = String(b.kind || "");
  if (!ROW_STATUS[kind]) throw bad("bad_kind");
  const rows = b.rows;
  if (!Array.isArray(rows) || !rows.length) throw bad("no_rows");
  if (rows.length > MAX_ROWS) throw bad("too_many_rows");                          // لا قصّ صامت: أكثر من الحد يُرفض كله
  const ok = [], errors = [], seen = new Set();
  rows.forEach((r, i) => {
    const line = Number.isInteger(r && r.line) ? r.line : i + 1;
    if (!r || typeof r !== "object") return errors.push({ line, error: "bad_row" });
    // صفوف مُبصَّمة فقط: أي حقل غير الأربعة (اسم، هاتف، بريد، هوية خام…) يُرفض الصف.
    const extra = Object.keys(r).filter((k) => !["line", "id_no", "period", "status"].includes(k));
    if (extra.length) return errors.push({ line, error: "row_field_not_allowed", field: extra[0] });
    const id_no = str(r.id_no, LEN.id);
    if (id_no.length < 2) return errors.push({ line, error: "id_no_required" });
    if (!/^\d{4}-\d{2}$/.test(String(r.period || ""))) return errors.push({ line, error: "bad_period" });
    if (!ROW_STATUS[kind].includes(String(r.status || ""))) return errors.push({ line, error: "bad_status" });
    const hash = hashIdNo(db.ctx.tenantId, id_no);                                 // الرقم الخام لا يُخزَّن ولا يُعاد
    const key = hash + "|" + r.period;
    if (seen.has(key)) return errors.push({ line, error: "duplicate_in_file" });
    seen.add(key);
    ok.push({ line, id_no_hash: hash, period: String(r.period), status: String(r.status) });
  });
  if (!ok.length) throw bad("no_valid_rows", { errors });
  const batch = (await db.post("shr_import_batches", {
    kind, label: str(b.label, LEN.name) || null, state: "uploaded", row_count: ok.length, matched_count: 0, uploaded_by: user.sub,
    matched_at: null, reviewed_by: null, reviewed_at: null, applied_by: null, applied_at: null, demo: true,
  }))[0];
  await db.post("shr_import_rows", ok.map((r) => ({ batch_id: batch.id, ...r, match_state: "unmatched", worker_id: null, applied_at: null })));
  await audit(db, user, `import.create:${kind}`, "shr_import_batches", batch.id);
  return { batch: { id: batch.id, kind, state: "uploaded", rows: ok.length }, errors };
}

async function getBatch(db, id) {
  const bt = (await db.get(`shr_import_batches?id=eq.${needId(id)}`))[0];
  if (!bt) throw new HttpError(404, "not_found");
  return bt;
}
const IMPORT_NEXT = { uploaded: "matched", matched: "reviewed", reviewed: "applied" };
function assertImportStep(bt, to) {
  if (IMPORT_NEXT[bt.state] !== to) throw new HttpError(409, "bad_transition", { from: bt.state, to, allowed: IMPORT_NEXT[bt.state] ? [IMPORT_NEXT[bt.state]] : [] });
}

async function matchImport(db, user, b) {
  const bt = await getBatch(db, b.id);
  assertImportStep(bt, "matched");
  const [rows, workers] = await Promise.all([db.get(`shr_import_rows?batch_id=eq.${bt.id}`), db.get("shr_workers?select=id,id_no_hash,status")]);
  const w = new Map(workers.filter((x) => x.id_no_hash && x.status !== "archived").map((x) => [x.id_no_hash, x.id]));
  let matched = 0;
  for (const r of rows) {
    const wid = w.get(r.id_no_hash) || null;
    if (wid) matched++;
    await db.patch(`shr_import_rows?id=eq.${r.id}`, { match_state: wid ? "matched" : "unmatched", worker_id: wid });
  }
  await db.patch(`shr_import_batches?id=eq.${bt.id}&state=eq.uploaded`, { state: "matched", matched_count: matched, matched_at: nowIso() });
  await audit(db, user, "import.state.uploaded->matched", "shr_import_batches", bt.id);
  return { batch: { id: bt.id, state: "matched", matched, unmatched: rows.length - matched } };
}

async function reviewImport(db, user, b) {
  const bt = await getBatch(db, b.id);
  assertImportStep(bt, "reviewed");
  if (bt.uploaded_by === user.sub) throw new HttpError(403, "maker_checker");      // من يرفع لا يراجع
  await db.patch(`shr_import_batches?id=eq.${bt.id}&state=eq.matched`, { state: "reviewed", reviewed_by: user.sub, reviewed_at: nowIso() });
  await audit(db, user, "import.state.matched->reviewed", "shr_import_batches", bt.id);
  return { batch: { id: bt.id, state: "reviewed" } };
}

async function applyImport(db, user, b) {
  const bt = await getBatch(db, b.id);
  assertImportStep(bt, "applied");
  if (bt.uploaded_by === user.sub) throw new HttpError(403, "maker_checker");      // من يرفع لا يطبّق
  const rows = (await db.get(`shr_import_rows?batch_id=eq.${bt.id}&match_state=eq.matched`));
  const okStatus = ROW_STATUS[bt.kind][0];
  let docs = 0, checks = 0;
  for (const r of rows) {
    const pass = r.status === okStatus;
    await db.post("shr_compliance_checks", {
      establishment_id: null, worker_id: r.worker_id, check_key: `${bt.kind}_period`, result: pass ? "pass" : "fail",
      detail: { period: r.period, status: r.status, batch_id: bt.id }, rule_ids: [], run_by: user.sub, run_at: nowIso(),
    });
    checks++;
    if (bt.kind === "gosi" && pass) {
      const has = (await db.get(`shr_worker_documents?worker_id=eq.${r.worker_id}&kind=eq.gosi&select=id`))[0];
      if (!has) { await db.post("shr_worker_documents", { worker_id: r.worker_id, kind: "gosi", storage_key: `import:${bt.id}`, expires_on: null, reviewed_by: user.sub, reviewed_at: nowIso() }); docs++; }
    }
  }
  await db.patch(`shr_import_rows?batch_id=eq.${bt.id}&match_state=eq.matched`, { applied_at: nowIso() });
  await db.patch(`shr_import_batches?id=eq.${bt.id}&state=eq.reviewed`, { state: "applied", applied_by: user.sub, applied_at: nowIso() });
  await audit(db, user, "import.state.reviewed->applied", "shr_import_batches", bt.id);
  return { batch: { id: bt.id, state: "applied", checks_written: checks, documents_added: docs, unmatched_skipped: bt.row_count - rows.length } };
}

async function listImports(db) {
  const rows = await db.get("shr_import_batches?order=created_at.desc");
  return { batches: rows.map((x) => ({ id: x.id, kind: x.kind, label: x.label, state: x.state, row_count: x.row_count, matched_count: x.matched_count, uploaded_by: x.uploaded_by, reviewed_by: x.reviewed_by || null, applied_by: x.applied_by || null, created_at: x.created_at })), kinds: Object.keys(ROW_STATUS), row_status: ROW_STATUS, max_rows: MAX_ROWS };
}
async function importDetail(db, q) {
  const bt = await getBatch(db, q.id);
  const [rows, workers] = await Promise.all([db.get(`shr_import_rows?batch_id=eq.${bt.id}&order=line.asc`), db.get("shr_workers?select=id,full_name")]);
  const wn = Object.fromEntries(workers.map((w) => [w.id, w.full_name]));
  return { batch: { id: bt.id, kind: bt.kind, state: bt.state, row_count: bt.row_count, matched_count: bt.matched_count },
    rows: rows.map((r) => ({ line: r.line, period: r.period, status: r.status, match_state: r.match_state, worker: r.worker_id ? wn[r.worker_id] || null : null, applied: !!r.applied_at })) };   // البصمة لا تخرج
}

// ------------------------------------------------------------- checklists ----
async function listChecklists(db, ctx, q) {
  const [tpls, items, ticks] = await Promise.all([
    db.get("shr_checklist_templates?active=eq.true&order=created_at.asc"), db.get("shr_checklist_items?order=position.asc"), db.get("shr_checklist_ticks?order=ticked_at.asc"),
  ]);
  const kind = q.subject_kind ? String(q.subject_kind) : "";
  if (kind && !SUBJECT_TABLE[kind]) throw bad("bad_subject_kind");
  const sid = q.subject_id ? needId(q.subject_id) : "";
  const last = new Map();
  if (kind && sid) ticks.forEach((t, i) => { if (t.subject_kind === kind && t.subject_id === sid) last.set(t.item_id, { t, i }); });   // الأحدث يغلب
  const out = tpls.filter((t) => checklistVisibleTo(ctx.role, t) && (!kind || t.scope === kind)).map((t) => {
    const its = items.filter((x) => x.template_id === t.id).sort((a, b) => a.position - b.position).map((x) => {
      const rule = x.rule_id ? R.describeRule(x.rule_id) : null;
      const active = !x.rule_id || (rule && rule.usable);          // بند مرجعه غير مؤكد لا يُفعَّل ولا يُعدّ مطلوباً
      const tk = last.get(x.id);
      return { id: x.id, position: x.position, text_ar: x.text_ar, required: !!x.required, rule_id: x.rule_id || null, rule, active, label_ar: active ? null : R.UNCONFIRMED_LABEL_AR,
        done: tk ? !!tk.t.done : false, ticked_by: tk ? tk.t.ticked_by : null, ticked_at: tk ? tk.t.ticked_at : null };
    });
    const need = its.filter((x) => x.active && x.required);
    return { id: t.id, key: t.key, title_ar: t.title_ar, audience: t.audience, scope: t.scope, version: t.version, items: its,
      required_remaining: kind && sid ? need.filter((x) => !x.done).length : null, complete: kind && sid ? need.every((x) => x.done) : null };
  });
  return { checklists: out };
}

async function tickChecklist(db, user, b) {
  const item = (await db.get(`shr_checklist_items?id=eq.${needId(b.item_id)}`))[0];
  if (!item) throw new HttpError(404, "not_found");
  const tpl = (await db.get(`shr_checklist_templates?id=eq.${item.template_id}`))[0];
  if (!tpl || !tpl.active) throw new HttpError(404, "not_found");
  const kind = String(b.subject_kind || "");
  if (!SUBJECT_TABLE[kind]) throw bad("bad_subject_kind");
  if (tpl.scope !== kind) throw new HttpError(409, "scope_mismatch");
  const sid = needId(b.subject_id);
  if (!(await db.get(`${SUBJECT_TABLE[kind]}?id=eq.${sid}&select=id`))[0]) throw new HttpError(404, "not_found");
  if (typeof b.done !== "boolean") throw bad("done_required");
  if (item.rule_id && !R.ruleUsable(item.rule_id)) throw new HttpError(409, "rule_unconfirmed", { label_ar: R.UNCONFIRMED_LABEL_AR });
  const t = (await db.post("shr_checklist_ticks", { item_id: item.id, subject_kind: kind, subject_id: sid, done: b.done, note: str(b.note, LEN.note) || null, ticked_by: user.sub, ticked_at: nowIso() }))[0];
  await audit(db, user, `checklist.tick:${b.done ? "done" : "undone"}`, "shr_checklist_ticks", t.id);
  return { tick: { id: t.id, done: b.done } };
}

// ----------------------------------------------------------------- alerts ----
async function buildAlerts(db, settings) {
  const t = today(), expUntil = R.addDays(t, settings.expiry_alert_days), dlUntil = R.addDays(t, settings.deadline_alert_days);
  const [docs, workers, viols, ests, a33, snaps] = await Promise.all([
    db.get("shr_worker_documents?select=id,worker_id,kind,expires_on"), db.get("shr_workers?select=id,full_name,status"),
    db.get("shr_violations?archived_at=is.null"), db.get("shr_establishments?select=id,name_ar,restriction_state"),
    db.get("shr_a33_names?archived_at=is.null"), db.get("shr_establishment_compliance?select=id,establishment_id,as_of,created_at,restriction_state,restriction_reason,verified_by,verified_on"),
  ]);
  const wm = byId(workers), em = byId(ests);
  const alerts = [];
  for (const d of docs) {
    const w = wm[d.worker_id];
    if (!w || w.status === "archived" || !d.expires_on || d.expires_on > expUntil) continue;
    const left = Math.round((Date.parse(d.expires_on) - Date.parse(t)) / 86400000);
    alerts.push({ kind: d.expires_on < t ? "document_expired" : "document_expiring", severity: d.expires_on < t ? "high" : left <= settings.deadline_alert_days ? "medium" : "low",
      subject: { type: "worker", id: w.id, name: w.full_name }, doc_kind: d.kind, due: d.expires_on, days_left: left, estimated: false });
  }
  for (const v of viols) {
    const view = viewViolation(v, null);
    if (!v.notification_date) { alerts.push({ kind: "notification_date_missing", severity: "low", subject: { type: "violation", id: v.id, name: v.kind_ar, establishment: em[v.establishment_id] ? em[v.establishment_id].name_ar : null }, estimated: false }); continue; }
    if (!view.objection.deadline) continue;                      // موعد غير متاح (بند غير مؤكد): لا تنبيه
    if (view.objection.deadline > dlUntil) continue;
    if (v.status === "follow_up" || v.status === "submission") continue;
    const left = Math.round((Date.parse(view.objection.deadline) - Date.parse(t)) / 86400000);
    alerts.push({ kind: left < 0 ? "objection_deadline_passed" : "objection_deadline_near", severity: left < 0 ? "high" : "medium", estimated: true, label_ar: view.objection.label_ar,
      subject: { type: "violation", id: v.id, name: v.kind_ar, establishment: em[v.establishment_id] ? em[v.establishment_id].name_ar : null }, due: view.objection.deadline, days_left: left, rule_id: view.objection.rule_id, reviewed: !!v.reviewed_by });
  }
  for (const e of ests) {
    const mine = snaps.filter((s) => s.establishment_id === e.id);
    const eff = effectiveState(mine, e.restriction_state);
    if (ESTABLISHMENT_STATES_BLOCKING.has(eff.state)) alerts.push({ kind: "establishment_blocked", severity: "high", subject: { type: "establishment", id: e.id, name: e.name_ar }, state: eff.state, reason: eff.reason, verified: eff.verified, estimated: false });
    else if (eff.state === "unknown") alerts.push({ kind: "establishment_state_unknown", severity: "low", subject: { type: "establishment", id: e.id, name: e.name_ar }, estimated: false });
    if (mine.length && !eff.verified) alerts.push({ kind: "snapshot_unverified", severity: "low", subject: { type: "establishment", id: e.id, name: e.name_ar }, estimated: false });
  }
  const lists = new Map();
  for (const r of a33) { const k = r.establishment_id + "|" + r.list_ref; const l = lists.get(k) || { est: r.establishment_id, list_ref: r.list_ref, pending: 0 }; if (!a33Complete(r)) l.pending++; lists.set(k, l); }
  for (const l of lists.values()) if (l.pending) alerts.push({ kind: "a33_unresolved", severity: "medium", subject: { type: "a33_list", id: l.list_ref, name: l.list_ref, establishment: em[l.est] ? em[l.est].name_ar : null }, pending: l.pending, estimated: false });
  const rank = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.due || "").localeCompare(String(b.due || "")));
  return alerts;
}

// ---------------------------------------------------------------- checks ----
async function runChecks(db, user, settings, b) {
  const f = b.establishment_id ? `&id=eq.${needId(b.establishment_id)}` : "";
  const ests = await db.get(`shr_establishments?select=id,name_ar,restriction_state${f}`);
  if (b.establishment_id && !ests.length) throw new HttpError(404, "not_found");
  const t = today(), until = R.addDays(t, settings.expiry_alert_days);
  const out = [];
  for (const e of ests) {
    const { eff, snaps } = await establishmentState(db, e.id);
    const latest = snaps[0] || null;
    const res = [];
    const restr = ESTABLISHMENT_STATES_BLOCKING.has(eff.state) ? "fail" : eff.state === "unknown" ? (settings.unknown_blocks ? "fail" : "warn") : "pass";
    res.push({ check_key: "restriction_state", result: restr, detail: { state: eff.state, verified: eff.verified, reason: eff.reason }, rule_ids: [] });
    res.push({ check_key: "snapshot_verified", result: latest ? (eff.verified ? "pass" : "warn") : "unknown", detail: { as_of: eff.as_of }, rule_ids: [] });
    // اتساق النطاق المعلن مع التقدير: لا يعمل إلا ببنود نطاقات مؤكدة.
    let band = { check_key: "band_consistency", result: "unknown", detail: { reason: "no_inputs" }, rule_ids: [] };
    if (latest && latest.activity_rule_id) {
      const comp = latest.saudi_count !== null && latest.non_saudi_count !== null ? R.nitaqatEstimate({ activity_rule_id: latest.activity_rule_id, saudi: latest.saudi_count, non_saudi: latest.non_saudi_count, year: String(latest.as_of).slice(0, 4) }) : null;
      band.rule_ids = [latest.activity_rule_id];
      if (!comp) band.detail = { reason: "counts_missing" };
      else if (!comp.ok) band.detail = { reason: comp.reason };
      else if (!latest.declared_band) band.detail = { reason: "declared_band_missing", computed_band: comp.band, estimate: true };
      else if (!comp.band) band.detail = { reason: "computed_band_unavailable", caveats: comp.caveats };
      else { band.result = comp.band === latest.declared_band ? "pass" : "warn"; band.detail = { declared: latest.declared_band, computed: comp.band, estimate: true, caveats: comp.caveats }; }
    }
    res.push(band);
    const a33 = await db.get(`shr_a33_names?establishment_id=eq.${e.id}&archived_at=is.null`);
    const pend = a33.filter((r) => !a33Complete(r)).length;
    res.push({ check_key: "a33_resolved", result: pend ? "warn" : "pass", detail: { pending: pend, total: a33.length }, rule_ids: ["A-33"] });
    const asg = await db.get(`shr_assignments?establishment_id=eq.${e.id}&status=neq.ended&select=worker_id`);
    const ids = new Set(asg.map((x) => x.worker_id));
    const docs = ids.size ? (await db.get("shr_worker_documents?select=worker_id,expires_on")).filter((d) => ids.has(d.worker_id) && d.expires_on && d.expires_on <= until) : [];
    res.push({ check_key: "documents_expiring", result: docs.length ? "warn" : "pass", detail: { count: docs.length, within_days: settings.expiry_alert_days }, rule_ids: [] });
    for (const r of res) await db.post("shr_compliance_checks", { establishment_id: e.id, worker_id: null, ...r, run_by: user.sub, run_at: nowIso() });
    await audit(db, user, "compliance.checks.run", "shr_establishments", e.id);
    out.push({ establishment_id: e.id, establishment: e.name_ar, results: res });
  }
  return { runs: out };
}

// -------------------------------------------------------------- dashboard ----
async function dashboard(db, settings) {
  const [ests, snaps, viols, a33, alerts] = await Promise.all([
    db.get("shr_establishments?select=id,name_ar,restriction_state&order=created_at.asc"), db.get("shr_establishment_compliance"),
    db.get("shr_violations?archived_at=is.null"), db.get("shr_a33_names?archived_at=is.null"), buildAlerts(db, settings),
  ]);
  const list = ests.map((e) => {
    const mine = snaps.filter((s) => s.establishment_id === e.id);
    const eff = effectiveState(mine, e.restriction_state);
    const latest = sortSnaps(mine)[0] || null;
    const snap = latest ? viewSnapshot(latest, null) : null;
    const vs = viols.filter((v) => v.establishment_id === e.id).map((v) => viewViolation(v, null));
    const open = vs.filter((v) => v.status !== "follow_up");
    const deadlines = open.map((v) => v.objection.deadline).filter(Boolean).sort();
    const pend = a33.filter((r) => r.establishment_id === e.id && !a33Complete(r)).length;
    return {
      id: e.id, name_ar: e.name_ar, state: eff.state, reason: eff.reason, verified: eff.verified, verified_on: eff.verified_on, as_of: eff.as_of, pending_clear_verification: eff.pending_clear_verification,
      declared_band: snap ? snap.declared_band : null, declared_band_ar: snap ? snap.declared_band_ar : null, declared_saudization_pct: snap ? snap.declared_saudization_pct : null,
      computed: snap ? snap.computed : null, violations_total: vs.length, violations_open: open.length, unconfirmed_rules: vs.filter((v) => !v.rule || !v.rule.usable).length,
      next_deadline_estimate: deadlines[0] || null, a33_pending: pend,
    };
  });
  const count = (k) => alerts.filter((a) => a.kind === k).length;
  return {
    establishments: list, settings, disclaimer_ar: R.NO_GUARANTEE_AR,
    totals: { establishments: list.length, blocked: list.filter((x) => ESTABLISHMENT_STATES_BLOCKING.has(x.state)).length, unknown: list.filter((x) => x.state === "unknown").length,
      violations_open: list.reduce((n, x) => n + x.violations_open, 0), alerts: alerts.length, high_alerts: alerts.filter((a) => a.severity === "high").length, documents_expiring: count("document_expiring"), documents_expired: count("document_expired") },
  };
}

async function establishmentDetail(db, settings, q) {
  const { establishment, snaps, eff } = await establishmentState(db, q.id);
  const users = await db.get("shr_users?select=id,full_name");
  const names = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
  const [viols, checks] = await Promise.all([db.get(`shr_violations?establishment_id=eq.${establishment.id}&archived_at=is.null&order=created_at.asc`), db.get(`shr_compliance_checks?establishment_id=eq.${establishment.id}&order=run_at.desc`)]);
  const latestByKey = {};
  checks.forEach((c) => { if (!latestByKey[c.check_key]) latestByKey[c.check_key] = { check_key: c.check_key, result: c.result, detail: c.detail, run_at: c.run_at }; });
  return { establishment: { id: establishment.id, name_ar: establishment.name_ar }, effective: eff, snapshots: snaps.map((s) => viewSnapshot(s, names)),
    violations: viols.map((v) => viewViolation(v, null)), checks: Object.values(latestByKey), settings };
}

// --------------------------------------------------------------- dispatch ----
export const COMPLIANCE_GET = new Set(["compliance-ref", "compliance-settings", "compliance-dashboard", "compliance-establishment", "compliance-violations", "compliance-checklists",
  "compliance-alerts", "compliance-imports", "compliance-import", "compliance-a33", "compliance-transfers"]);
export const COMPLIANCE_POST = new Set(["compliance-settings-update", "establishment-compliance-record", "establishment-compliance-verify", "compliance-run-checks",
  "violation-create", "violation-notify", "violation-review", "violation-status", "violation-paid", "violation-archive",
  "a33-add", "a33-classify", "a33-approve", "transfer-request", "transfer-decide", "procedure-step-create",
  "import-create", "import-match", "import-review", "import-apply", "checklist-tick"]);
export const isComplianceAction = (a) => COMPLIANCE_GET.has(a) || COMPLIANCE_POST.has(a);

// تُرجع حمولة الرد، أو undefined إن لم يكن الإجراء من هذه الوحدة. تتحقق من الدور والطريقة هنا.
export async function dispatch(action, { db, ctx, user, b, q, isPost }) {
  const g = COMPLIANCE_GET.has(action), p = COMPLIANCE_POST.has(action);
  if (!g && !p) return undefined;
  if (isPost ? !p : !g) throw new HttpError(404, "unknown_action");
  const settings = await getSettings(db);
  if (policy(ctx.role, settings, action) === "deny") throw new HttpError(403, "role_not_allowed");
  switch (action) {
    case "compliance-ref": return { reference: R.refSummary(), statuses: R.caseStatuses(), not_found_constants: Object.keys(NOT_FOUND) };
    case "compliance-settings": return { settings, defaults: DEFAULTS, step_kinds: STEP_KINDS };
    case "compliance-dashboard": return await dashboard(db, settings);
    case "compliance-establishment": return await establishmentDetail(db, settings, q);
    case "compliance-violations": return await listViolations(db, ctx, settings, q);
    case "compliance-checklists": return await listChecklists(db, ctx, q);
    case "compliance-alerts": return { alerts: await buildAlerts(db, settings), settings: { expiry_alert_days: settings.expiry_alert_days, deadline_alert_days: settings.deadline_alert_days }, disclaimer_ar: R.NO_GUARANTEE_AR };
    case "compliance-imports": return await listImports(db);
    case "compliance-import": return await importDetail(db, q);
    case "compliance-a33": return await listA33(db, q);
    case "compliance-transfers": return await listTransfers(db);
    case "compliance-settings-update": return await updateSettings(db, ctx, user, b);
    case "establishment-compliance-record": return await recordSnapshot(db, user, b);
    case "establishment-compliance-verify": return await verifySnapshot(db, user, b);
    case "compliance-run-checks": return await runChecks(db, user, settings, b);
    case "violation-create": return await createViolation(db, user, b);
    case "violation-notify": return await setNotification(db, user, b);
    case "violation-review": return await reviewViolation(db, user, b);
    case "violation-status": return await setViolationStatus(db, ctx, user, b);
    case "violation-paid": return await setPaid(db, user, b);
    case "violation-archive": return await archiveViolation(db, user, b);
    case "a33-add": return await addA33(db, user, b);
    case "a33-classify": return await classifyA33(db, user, b);
    case "a33-approve": return await approveA33(db, user, b);
    case "transfer-request": return await requestTransfer(db, user, b);
    case "transfer-decide": return await decideTransfer(db, user, b);
    case "procedure-step-create": return await createStep(db, user, b);
    case "import-create": return await createImport(db, user, b);
    case "import-match": return await matchImport(db, user, b);
    case "import-review": return await reviewImport(db, user, b);
    case "import-apply": return await applyImport(db, user, b);
    case "checklist-tick": return await tickChecklist(db, user, b);
  }
  return undefined;
}
