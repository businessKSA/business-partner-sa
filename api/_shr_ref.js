// SHR-HR — المرجع النظامي للامتثال: قراءة db/shr-ref/*.json وحسابات نقية فوقها.
//
// القاعدة الحاكمة: لا رقم نظامي في الشيفرة (غرامة، مدة، نسبة، معامل). كل رقم يُقرأ
// من صف في المرجع له rule_id وsource_url وverified. وما verified فيه غير "confirmed"
// حرفياً لا يُفعَّل في أي حساب ولا يظهر لعميل؛ يظهر للمشغّل بوسم «غير مؤكد من المصدر».
// ملف نقي: لا شبكة ولا قاعدة بيانات (يُستورد من _shr.js للبذرة ومن _shr_compliance.js).
//
// ما ورد في not_found.json (قيد الاشتباه ومدته، شروط نقل العامل، تعريف «إشعار أجير»،
// طريقة احتساب الأيام، …) لم يُملأ هنا في أي مكان: لا ثابت ولا افتراض.
import fs from "node:fs";

const DIR = new URL("../db/shr-ref/", import.meta.url);
const FILES = {
  violations: "violations_rules.json",
  settlement: "objection_settlement_rules.json",
  estimate: "objection_estimate_rule.json",
  nitaqat: "nitaqat_bands.json",
  statuses: "case_statuses.json",
  notFound: "not_found.json",
  matrix: "verification_matrix.json",
};

export const CONFIRMED = "confirmed";
export const UNCONFIRMED_LABEL_AR = "غير مؤكد من المصدر";
export const ESTIMATE_LABEL_AR = "تقديري";
export const NO_GUARANTEE_AR = "لا نضمن إلغاء المخالفة";

// أسماء نطاقات نطاقات المطور بالترتيب البنيوي (أدنى → أعلى). معرّفات لا أرقام.
export const BAND_KEYS = Object.freeze(["red", "green_low", "green_mid", "green_high", "platinum"]);
const ASC_BANDS = BAND_KEYS.slice(1);
const PCT = 100;                    // تحويل نسبة إلى مئوية (وحدة، لا قيمة نظامية)

export const isConfirmed = (row) => !!row && row.verified === CONFIRMED;

let RAW = null;
let IDX = null;

function readAll() {
  const out = {};
  for (const [k, f] of Object.entries(FILES)) out[k] = JSON.parse(fs.readFileSync(new URL(f, DIR), "utf8"));
  return out;
}

function index(raw) {
  const rows = (d) => (d && Array.isArray(d.rows) ? d.rows : []);
  const map = (arr) => new Map(arr.map((r) => [r.rule_id, r]));
  const statuses = rows(raw.statuses).slice().sort((a, b) => a.order - b.order);
  return Object.freeze({
    raw,
    violations: map(rows(raw.violations)),
    settlement: map(rows(raw.settlement)),
    statuses,
    statusDoc: raw.statuses,
    nitaqat: map(Array.isArray(raw.nitaqat.activities) ? raw.nitaqat.activities : []),
    estimate: raw.estimate && raw.estimate.rule ? raw.estimate.rule : null,
  });
}

export function getRef() {
  if (!IDX) { RAW = RAW || readAll(); IDX = index(RAW); }
  return IDX;
}
// نسخة عميقة من الخام: للاختبار (تعديل verified ثم __setRef). لا يُستعمل في الإنتاج.
export function rawRefClone() { getRef(); return JSON.parse(JSON.stringify(RAW)); }
export function __setRef(raw) { RAW = raw || null; IDX = raw ? index(raw) : null; }

// ------------------------------------------------------------------ rules --
// بحث موحّد بالـrule_id في كل جداول المرجع.
export function lookupRule(ruleId) {
  const r = getRef(), id = String(ruleId || "");
  return r.violations.get(id) || r.settlement.get(id) || r.nitaqat.get(id) || r.statuses.find((s) => s.rule_id === id) || null;
}
// يُفعَّل البند في قاعدة تمنع أو تنبّه بشرط واحد: confirmed.
export const ruleUsable = (ruleId) => isConfirmed(lookupRule(ruleId));

// وسم للمشغّل: null إن كان مؤكداً، وإلا العبارة الثابتة.
export const unconfirmedLabel = (row) => (isConfirmed(row) ? null : UNCONFIRMED_LABEL_AR);

export function describeRule(ruleId) {
  const row = lookupRule(ruleId);
  if (!row) return null;
  return {
    rule_id: row.rule_id, name_ar: row.name_ar || row.activity_ar || row.label_ar || null,
    category: row.category || null, severity: row.severity || null,
    tiers: row.fine_sar && typeof row.fine_sar === "object" ? Object.keys(row.fine_sar) : [],
    multiplier: row.multiplier || null, multiplier_ar: row.multiplier_ar || null, note_ar: row.note_ar || null,
    source_url: row.source_url || null, source_ref: row.source_ref || null,
    verified: row.verified || "unverified", usable: isConfirmed(row), label_ar: unconfirmedLabel(row),
  };
}

// ----------------------------------------------------------------- fines ---
// تقدير الغرامة: وحدة الغرامة من fine_sar[tier] في المرجع × عدد الوحدات حسب multiplier.
// الشريحة يُدخلها إنسان (إجمالي عمال الرقم الموحد لا نملكه فلا نشتقها). flat وby_occurrence
// لا يُضرب فيهما؛ كل per_* يُضرب بالعدد المُدخَل. ما سوى ذلك يُرفض بدل التخمين.
export function estimateFine(ruleId, tier, count) {
  const row = getRef().violations.get(String(ruleId || ""));
  if (!row) return { ok: false, reason: "unknown_rule" };
  if (!isConfirmed(row)) return { ok: false, reason: "rule_unconfirmed", label_ar: UNCONFIRMED_LABEL_AR };
  const tiers = row.fine_sar && typeof row.fine_sar === "object" ? row.fine_sar : null;
  if (!tiers) return { ok: false, reason: "no_fine_in_reference" };
  if (!tier) return { ok: false, reason: "tier_required", tiers: Object.keys(tiers) };
  if (!Object.prototype.hasOwnProperty.call(tiers, tier) || typeof tiers[tier] !== "number") return { ok: false, reason: "tier_unknown", tiers: Object.keys(tiers) };
  const unit = tiers[tier];
  const mult = String(row.multiplier || "");
  let units;
  const caveats = [];
  if (mult === "flat" || mult === "by_occurrence") units = 1;
  else if (mult.startsWith("per_")) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1) return { ok: false, reason: "count_required", multiplier: mult };
    units = n;
    if (/_or_|_and_/.test(mult)) caveats.push("ambiguous_multiplier");     // العدّ إدخال بشري
  } else return { ok: false, reason: "multiplier_unknown", multiplier: mult };
  if (row.note_ar) caveats.push(row.note_ar);
  return {
    ok: true, estimate: true, amount_sar: unit * units, unit_sar: unit, count: units, tier, multiplier: mult,
    rule_id: row.rule_id, source_url: row.source_url, source_ref: row.source_ref, verified: row.verified, caveats,
  };
}

// ------------------------------------------------------------- deadlines ---
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(v) {
  if (!ISO.test(String(v || ""))) return false;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().split("T")[0] === v;
}
export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  return new Date(d.getTime() + n * 86400000).toISOString().split("T")[0];
}

// مدخلات يُمنع أن يُشتق منها موعد: من المرجع نفسه (OBJ-EST-1.forbidden_inputs).
export function forbiddenDeadlineInputs() {
  const e = getRef().estimate;
  return e && Array.isArray(e.forbidden_inputs) ? e.forbidden_inputs.slice() : [];
}

// موعد تقديري = تاريخ التبليغ + days من بند المرجع. يلزمه: بند مؤكد، مرساة notification_date،
// وتاريخ تبليغ مُدخَل. احتساب الأيام (تقويمي/هجري/عمل) غير محسوم في النص، فالنتيجة تقدير دائماً.
export function deadlineEstimate(ruleId, notificationDate) {
  const row = getRef().settlement.get(String(ruleId || ""));
  if (!row) return { ok: false, reason: "unknown_rule" };
  if (!isConfirmed(row)) return { ok: false, reason: "rule_unconfirmed", label_ar: UNCONFIRMED_LABEL_AR };
  if (row.anchor !== "notification_date" || !Number.isInteger(row.days)) return { ok: false, reason: "rule_not_a_window" };
  if (!notificationDate) return { ok: false, reason: "notification_date_required" };
  if (!isIsoDate(notificationDate)) return { ok: false, reason: "bad_notification_date" };
  return {
    ok: true, estimate: true, deadline: addDays(notificationDate, row.days), days: row.days, anchor: "notification_date",
    rule_id: row.rule_id, source_url: row.source_url, source_ref: row.source_ref, verified: row.verified,
    label_ar: (getRef().estimate && getRef().estimate.output_label_ar) || ESTIMATE_LABEL_AR,
    basis_note_ar: (getRef().estimate && getRef().estimate.day_count_basis && getRef().estimate.day_count_basis.note_ar) || row.ambiguity_ar || null,
  };
}

// موعد الاعتراض: صيغة OBJ-EST-1 تُفعَّل فقط إن تحقق شرطها في المرجع (كل requires_rules مؤكدة،
// والصيغة نفسها مؤكدة ومفعّلة) ثم يُحسب من بند OBJ-1.
export function objectionDeadline(notificationDate) {
  const e = getRef().estimate;
  if (!e || e.enabled === false || !isConfirmed(e)) return { ok: false, reason: "rule_unconfirmed", label_ar: UNCONFIRMED_LABEL_AR };
  const req = Array.isArray(e.requires_rules) ? e.requires_rules : [];
  if (!req.length || !req.every((id) => ruleUsable(id))) return { ok: false, reason: "rule_unconfirmed", label_ar: UNCONFIRMED_LABEL_AR };
  const r = deadlineEstimate(req[0], notificationDate);
  return r.ok ? { ...r, estimate_rule_id: e.rule_id } : r;
}

// ما يُحسب لمخالفة عند التسجيل أو القراءة: غرامة تقديرية وموعد اعتراض وموعدا التسوية والسداد.
// هذه الدالة هي الوحيدة التي تمرّ منها الأرقام النظامية إلى سجل مخالفة.
export function computeViolation({ rule_id, size_tier, persons_count, notification_date }) {
  const fine = estimateFine(rule_id, size_tier, persons_count);
  const objection = notification_date ? objectionDeadline(notification_date) : { ok: false, reason: "notification_date_required" };
  const settlement = notification_date ? deadlineEstimate("SET-1", notification_date) : { ok: false, reason: "notification_date_required" };
  const payment = notification_date ? deadlineEstimate("PAY-1", notification_date) : { ok: false, reason: "notification_date_required" };
  return { fine, objection, settlement, payment };
}

// الحقول المخزَّنة لمخالفة، محسوبة من المرجع وحده (تمرّ منها البذرة وواجهة الإدخال).
export const objectionFields = (o) => ({
  estimated_objection_deadline: o && o.ok ? o.deadline : null,
  objection_basis: o && o.ok ? { rule_id: o.rule_id, estimate_rule_id: o.estimate_rule_id, days: o.days, anchor: o.anchor, source_url: o.source_url, source_ref: o.source_ref, verified: o.verified, estimate: true } : null,
});
export function violationFields({ rule_id, size_tier, persons_count, notification_date }) {
  const rule = describeRule(rule_id);
  const calc = computeViolation({ rule_id, size_tier, persons_count, notification_date });
  const f = calc.fine;
  return {
    rule, calc,
    row: {
      rule_verified: rule.verified, kind_ar: rule.name_ar, severity: rule.severity,
      fine_estimate_sar: f.ok ? f.amount_sar : null,
      fine_source: f.ok ? { rule_id: f.rule_id, source_url: f.source_url, source_ref: f.source_ref, verified: f.verified, tier: f.tier, unit_sar: f.unit_sar, count: f.count, multiplier: f.multiplier, estimate: true } : null,
      ...objectionFields(calc.objection),
    },
  };
}

// ----------------------------------------------------------------- states ---
export function caseStatuses() {
  const r = getRef();
  if (!isConfirmed(r.statusDoc)) return [];
  return r.statuses.map((s) => ({ key: s.key, label_ar: s.label_ar, order: s.order, meaning_ar: s.meaning_ar, human_task: !!s.human_task, rule_id: s.rule_id }));
}
export const caseStatusKeys = () => caseStatuses().map((s) => s.key);
export const forbiddenStatusLabels = () => { const d = getRef().statusDoc; return d && Array.isArray(d.forbidden_labels_ar) ? d.forbidden_labels_ar.slice() : []; };

// ---------------------------------------------------------------- nitaqat ---
// ص = م × ln(س) + ث ؛ س = إجمالي العمالة (عدّ بالرؤوس: أوزان الأجور معطّلة لعدم تأكيدها).
export function nitaqatActivities() {
  return [...getRef().nitaqat.values()].map((a) => ({ rule_id: a.rule_id, activity_ar: a.activity_ar, usable: isConfirmed(a), label_ar: unconfirmedLabel(a) }));
}
export function nitaqatEstimate({ activity_rule_id, saudi, non_saudi, year }) {
  const r = getRef();
  const doc = r.raw.nitaqat, meta = doc._meta || {};     // الصيغة وتعيين النطاق وأسماؤه داخل _meta في الملف
  const act = r.nitaqat.get(String(activity_rule_id || ""));
  if (!act) return { ok: false, reason: "unknown_activity" };
  if (!isConfirmed(act) || !isConfirmed(meta.formula) || !isConfirmed(meta.band_assignment)) return { ok: false, reason: "rule_unconfirmed", label_ar: UNCONFIRMED_LABEL_AR };
  const s = Number(saudi), n = Number(non_saudi);
  if (!Number.isInteger(s) || !Number.isInteger(n) || s < 0 || n < 0) return { ok: false, reason: "counts_required" };
  const total = s + n;
  if (total < 1) return { ok: false, reason: "no_workforce" };
  const pct = Math.round((s / total) * PCT * 100) / 100;
  const cKey = "c_" + String(year);
  const th = {};
  for (const b of ASC_BANDS) {
    const p = act.bands && act.bands[b];
    if (!p || typeof p.m !== "number" || typeof p[cKey] !== "number") return { ok: false, reason: "year_unknown", pct };
    th[b] = Math.round((p.m * Math.log(total) + p[cKey]) * 100) / 100;
  }
  const caveats = ["headcount_not_wage_weighted"];
  const cw = doc.counting_rules;
  if (!cw || cw.enabled !== true || !isConfirmed(cw)) caveats.push("wage_weights_disabled");   // NIT-CNT-1 معطّل: لا يدخل الحساب
  if (meta.band_assignment && meta.band_assignment.caution_ar) caveats.push("band_edge_check_on_source_image");
  const asc = ASC_BANDS.every((b, i) => i === 0 || th[b] >= th[ASC_BANDS[i - 1]]);
  let band = null;
  if (!asc) caveats.push("non_monotonic_thresholds");           // تسلسل غير تصاعدي كما في المصدر: لا نصنّف
  else {
    band = "red";
    for (const b of ASC_BANDS) if (pct >= th[b]) band = b;
  }
  const names = Array.isArray(meta.band_names_ar) && meta.band_names_verified === CONFIRMED ? meta.band_names_ar : null;
  return {
    ok: true, estimate: true, pct, total, thresholds: th, band, band_ar: band && names ? names[BAND_KEYS.indexOf(band)] : null,
    caveats, rule_id: act.rule_id, source_url: act.source_url, source_ref: act.source_ref, verified: act.verified,
    formula_source_ref: meta.formula && meta.formula.source_ref,
  };
}
export function bandLabelAr(key) {
  const meta = getRef().raw.nitaqat._meta || {};
  const i = BAND_KEYS.indexOf(key);
  return i >= 0 && Array.isArray(meta.band_names_ar) && meta.band_names_verified === CONFIRMED ? meta.band_names_ar[i] : key || null;
}

// ---------------------------------------------------------------- summary ---
// ما تعرضه الواجهة للمشغّل عن المرجع. بند التخفيض في التسوية (SET-2) لا يُعرض أبداً:
// لا يُقدَّم خصم كحق مضمون.
const SHOWN_WINDOWS = ["OBJ-1", "PAY-1", "SET-1"];
export function refSummary() {
  const r = getRef();
  const pick = (id) => {
    const x = r.settlement.get(id);
    if (!x) return null;
    return {
      rule_id: x.rule_id, name_ar: x.name_ar, days: Number.isInteger(x.days) ? x.days : null, anchor_ar: x.anchor_ar || null,
      text_ar: x.text_ar || null, conditions_ar: x.conditions_ar || null, ambiguity_ar: x.ambiguity_ar || null, warning_ar: x.warning_ar || null,
      note_ar: x.note_ar || null, source_url: x.source_url, source_ref: x.source_ref, verified: x.verified, usable: isConfirmed(x), label_ar: unconfirmedLabel(x),
    };
  };
  const nf = r.raw.notFound && Array.isArray(r.raw.notFound.items) ? r.raw.notFound.items : [];
  return {
    statuses: caseStatuses(),
    forbidden_labels_ar: forbiddenStatusLabels(),
    violation_rules: [...r.violations.values()].map((v) => describeRule(v.rule_id)),
    windows: SHOWN_WINDOWS.map(pick).filter(Boolean),
    activities: nitaqatActivities(),
    band_keys: BAND_KEYS.map((k) => ({ key: k, label_ar: bandLabelAr(k) })),
    not_found: nf.map((x) => ({ item_ar: x.item_ar, status: x.status })),
    disclaimer_ar: NO_GUARANTEE_AR,
  };
}
