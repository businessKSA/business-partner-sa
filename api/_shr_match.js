// SHR-HR — محرك المطابقة لعمالة EOR. وحدة نقية: بلا استيراد ولا شبكة ولا قاعدة.
//
// أصلها منطق matchComponents/runMatch في site/assets/js/hr-app.js وcmpOne في
// simple-v1-employer.mjs (يملكهما recruitment-employer)، منسوخاً لا مستورداً،
// بأوزان وحقول عمالة EOR بدل الموظفين المكتبيين.
//
// القواعد:
//  - لكل مكوّن: { score 0..100 | null, status, note }.
//    status: MATCH · PARTIAL_MATCH · NO_MATCH · UNKNOWN · NA.
//  - UNKNOWN (البيانات ناقصة عند المرشح أو الوظيفة) لا يستبعد أحداً أبداً:
//    يخرج وزنه من القسمة ويُذكر باسمه بدل أن يُملأ بدرجة مفترضة.
//  - NA (الوظيفة لا تطلب هذا الشرط) يخرج وزنه كذلك ولا يُعدّ ناقصاً.
//  - MUST_HAVE لا يحذف مرشحاً: من يفشل فيها يُعرض في فئة منفصلة
//    (must_have_miss) تحت الباقين، ومن بياناته ناقصة فيها يُعرض ملاحظةً لا استبعاداً.
//  - لكل درجة شرح: مساهمة كل مكوّن في الدرجة النهائية.

export const SCORING_VERSION = "shr-eor-v1";

// [المفتاح, الاسم, الوزن]
export const WEIGHT_DEFS = [
  ["profession", "المهنة", 30],
  ["residency", "قابلية نقل الإقامة", 20],
  ["experience", "الخبرة", 15],
  ["nationality", "الجنسية", 10],
  ["location", "الموقع", 10],
  ["availability", "التوفر", 10],
  ["skills", "المهارات", 5],
];
export const COMPONENT_KEYS = WEIGHT_DEFS.map((w) => w[0]);
export const CATEGORIES = ["strong", "good", "review", "weak", "unscored", "must_have_miss"];

// تسوية عربية خفيفة (التشكيل والتطويل وأشكال الألف والتاء المربوطة والألف المقصورة).
export function nz(s) {
  return String(s == null ? "" : s).toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}
const toks = (s) => nz(s).split(/[^0-9a-z؀-ۿ]+/).filter((w) => w.length > 2);
const list = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]).map((x) => String(x).trim()).filter(Boolean);
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function mk(score, status, note, extra) {
  return { score: score == null ? null : clamp(score), status, note, ...(extra || {}) };
}
const unknownJob = (note) => mk(null, "UNKNOWN", note);
const na = (note) => mk(null, "NA", note);

// ------------------------------------------------------------ components --
export function matchComponents(job, c) {
  job = job || {}; c = c || {};
  const out = {};

  // المهنة: مطابقة حرفية بعد التسوية، وإلا تشابه كلمات.
  if (!nz(job.profession)) out.profession = unknownJob("الوظيفة بلا مهنة محددة");
  else if (!nz(c.profession)) out.profession = mk(null, "UNKNOWN", "مهنة المرشح غير مسجّلة");
  else if (nz(job.profession) === nz(c.profession)) out.profession = mk(100, "MATCH", "نفس المهنة: " + c.profession);
  else {
    const jt = toks(job.profession), ct = nz(c.profession);
    const hit = jt.filter((w) => ct.indexOf(w) >= 0);
    out.profession = hit.length
      ? mk(55 + Math.min(30, hit.length * 15), "PARTIAL_MATCH", "مهنة قريبة: " + c.profession + " (المطلوب " + job.profession + ")")
      : mk(0, "NO_MATCH", "مهنة مختلفة: " + c.profession + " (المطلوب " + job.profession + ")");
  }

  // قابلية نقل الإقامة (نقل الخدمات): الوظيفة 'transferable' تتطلبها، 'any' لا تطلب شيئاً.
  if (job.residency_required !== "transferable") out.residency = na("الوظيفة لا تشترط نقل إقامة");
  else if (c.residency_transferable === "yes") out.residency = mk(100, "MATCH", "إقامة قابلة للنقل");
  else if (c.residency_transferable === "no") out.residency = mk(0, "NO_MATCH", "إقامة غير قابلة للنقل");
  else out.residency = mk(null, "UNKNOWN", "قابلية نقل الإقامة غير معروفة — اطلب التحقق");

  // الخبرة
  const req = num(job.experience_years), yrs = num(c.years_experience);
  if (req == null || req === 0) out.experience = na("الوظيفة لا تحدد خبرة دنيا");
  else if (yrs == null) out.experience = mk(null, "UNKNOWN", "سنوات الخبرة غير مسجّلة");
  else if (yrs >= req) out.experience = mk(100 - Math.min(15, Math.max(0, yrs - req - 6) * 3), "MATCH", yrs + " سنة (المطلوب " + req + ")");
  else out.experience = mk(Math.max(30, 100 - (req - yrs) * 22), yrs >= req - 2 ? "PARTIAL_MATCH" : "NO_MATCH", yrs + " سنة والمطلوب " + req);

  // الجنسية: فارغ عند الوظيفة = لا تفضيل.
  const pref = list(job.nationality_pref);
  if (!pref.length) out.nationality = na("لا تفضيل للجنسية");
  else if (!nz(c.nationality)) out.nationality = mk(null, "UNKNOWN", "جنسية المرشح غير مسجّلة");
  else if (pref.some((p) => nz(p) === nz(c.nationality))) out.nationality = mk(100, "MATCH", "ضمن المفضّل: " + c.nationality);
  else out.nationality = mk(0, "NO_MATCH", c.nationality + " خارج المفضّل (" + pref.join("، ") + ")");

  // الموقع
  if (!nz(job.city)) out.location = na("الوظيفة بلا مدينة محددة");
  else if (!nz(c.city)) out.location = mk(null, "UNKNOWN", "مدينة المرشح غير مسجّلة");
  else if (nz(job.city) === nz(c.city)) out.location = mk(100, "MATCH", "نفس المدينة (" + c.city + ")");
  else if (c.willing_to_relocate === true) out.location = mk(75, "PARTIAL_MATCH", c.city + " — مستعد للانتقال إلى " + job.city);
  else if (c.willing_to_relocate === false) out.location = mk(0, "NO_MATCH", c.city + " — غير مستعد للانتقال إلى " + job.city);
  else out.location = mk(40, "PARTIAL_MATCH", c.city + " — الانتقال إلى " + job.city + " يحتاج تأكيداً");

  // التوفر
  const nd = num(c.notice_days), within = num(job.start_within_days);
  if (nd == null) out.availability = mk(null, "UNKNOWN", "مدة الإشعار غير معروفة");
  else if (within != null) out.availability = nd <= within
    ? mk(100, "MATCH", "متاح خلال " + nd + " يوماً (المطلوب خلال " + within + ")")
    : mk(Math.max(30, 100 - (nd - within) * 2), "PARTIAL_MATCH", "متاح خلال " + nd + " يوماً والمطلوب خلال " + within);
  else out.availability = mk(nd <= 15 ? 100 : nd <= 30 ? 88 : nd <= 60 ? 62 : 45, nd <= 30 ? "MATCH" : "PARTIAL_MATCH", "إشعار " + nd + " يوماً");

  // المهارات
  const js = list(job.skills), cs = list(c.skills);
  if (!js.length) out.skills = na("الوظيفة بلا مهارات مطلوبة");
  else if (!cs.length) out.skills = mk(null, "UNKNOWN", "مهارات المرشح غير مسجّلة");
  else {
    const has = (s) => cs.some((x) => nz(x).indexOf(nz(s)) >= 0 || nz(s).indexOf(nz(x)) >= 0);
    const hit = js.filter(has), miss = js.filter((s) => !has(s));
    out.skills = mk((hit.length / js.length) * 100, hit.length === js.length ? "MATCH" : hit.length ? "PARTIAL_MATCH" : "NO_MATCH",
      "تطابق " + hit.length + " من " + js.length + (hit.length ? ": " + hit.join("، ") : ""), { hit, miss });
  }
  return out;
}

// -------------------------------------------------------------- must-have --
// عنصر MUST_HAVE إما مفتاح مكوّن (profession/residency/…) فيفشل بـNO_MATCH فقط،
// وإما مهارة نصية فيفشل إن سُجّلت مهارات المرشح وخلت منها. المجهول لا يُفشل.
function evalMustHave(job, c, comps) {
  const miss = [], unknown = [];
  for (const m of list(job.must_have)) {
    if (COMPONENT_KEYS.includes(m)) {
      const x = comps[m];
      const label = WEIGHT_DEFS.find((w) => w[0] === m)[1];
      if (x.status === "NO_MATCH") miss.push(label);
      else if (x.status === "UNKNOWN") unknown.push(label);
    } else {
      const cs = list(c.skills);
      if (!cs.length) unknown.push(m);
      else if (!cs.some((x) => nz(x).indexOf(nz(m)) >= 0 || nz(m).indexOf(nz(x)) >= 0)) miss.push(m);
    }
  }
  return { miss, unknown };
}

// ----------------------------------------------------------------- scoring --
export function normalizeWeights(weights) {
  const w = {};
  for (const [k, , d] of WEIGHT_DEFS) w[k] = d;
  if (weights && typeof weights === "object") {
    for (const k of Object.keys(weights)) {
      if (!COMPONENT_KEYS.includes(k)) throw new Error("shr_match: unknown weight " + k);
      const v = Number(weights[k]);
      if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error("shr_match: bad weight for " + k);
      w[k] = v;
    }
  }
  return w;
}

export function matchCategory(overall, mustMiss) {
  if (mustMiss && mustMiss.length) return "must_have_miss";
  if (overall == null) return "unscored";
  return overall >= 85 ? "strong" : overall >= 70 ? "good" : overall >= 50 ? "review" : "weak";
}

export function scoreOne(job, c, weights) {
  const w = normalizeWeights(weights);
  const comps = matchComponents(job, c);
  let total = 0, wsum = 0;
  for (const [k] of WEIGHT_DEFS) {
    const x = comps[k];
    if (x.score != null && w[k] > 0) { total += x.score * w[k]; wsum += w[k]; }
  }
  const allW = WEIGHT_DEFS.reduce((a, [k]) => a + w[k], 0);
  const overall = wsum ? Math.round(total / wsum) : null;
  const must = evalMustHave(job, c, comps);
  const unknown = WEIGHT_DEFS.filter(([k]) => comps[k].status === "UNKNOWN" && w[k] > 0).map(([, label]) => label);
  const explain = WEIGHT_DEFS.map(([k, label]) => {
    const x = comps[k];
    const counted = x.score != null && w[k] > 0 && wsum > 0;
    return {
      key: k, label, weight: w[k], status: x.status, score: x.score, note: x.note,
      counted, contribution: counted ? Math.round((x.score * w[k] / wsum) * 10) / 10 : 0,
    };
  });
  const coverage = allW ? Math.round((wsum / allW) * 100) : 0;
  const parts = [];
  parts.push(overall == null ? "لا درجة: كل المكوّنات ناقصة أو غير مطلوبة" : "الدرجة " + overall + " من 100 مبنية على " + coverage + "% من الأوزان");
  if (unknown.length) parts.push("غير معروف (لم يُحسب ولم يُستبعد به): " + unknown.join("، "));
  if (must.miss.length) parts.push("ينقصه شرط إلزامي: " + must.miss.join("، "));
  if (must.unknown.length) parts.push("شرط إلزامي بيانه ناقص: " + must.unknown.join("، "));
  return {
    overall, coverage, category: matchCategory(overall, must.miss),
    must_have_missing: must.miss, must_have_unknown: must.unknown, unknown,
    components: comps, explain, summary: parts.join(" — "),
  };
}

// runMatch(job, pool, weights?) → { version, results, buckets }
// results مرتبة: الفئات العادية أولاً بالدرجة تنازلياً، ثم «unscored»، ثم must_have_miss.
export function runMatch(job, pool, weights) {
  const w = normalizeWeights(weights);
  const rows = (pool || []).map((c) => ({ candidate_id: c.id, ...scoreOne(job, c, w) }));
  const rank = { strong: 0, good: 0, review: 0, weak: 0, unscored: 1, must_have_miss: 2 };
  rows.sort((a, b) => rank[a.category] - rank[b.category] || (b.overall ?? -1) - (a.overall ?? -1));
  const buckets = {};
  for (const k of CATEGORIES) buckets[k] = [];
  for (const r of rows) buckets[r.category].push(r.candidate_id);
  return { version: SCORING_VERSION, weights: w, results: rows, buckets };
}
