// Business Partner — قارئ بيانات أنظمة العمل السعودية لخدمة EOR (api/_saudi-labor-data.json).
//
// يملكه وكيل `eor`. ملف مساعد (يبدأ بـ_) فلا يُحتسب دالةً جديدة (السقف ١٢). الملف المقروء بيانات موثّقة بمصادرها الرسمية
// (docs/saudi-labor-sources.md) ولا يُعدَّل من هنا: نقرأ ونُطبِّع ونُعلِّم ما يحمل verify. لا رقم نظامي يُكتب في الكود —
// كل رقم يخرج من الملف، وما غاب عنه أو فسد يخرج null فيرجع المسعِّر «بعد المراجعة» بلا رقم مخترع (CLAUDE.md §4).
//
// المبدأ: verify ≠ false (true أو غائب) ⇒ غير معتمد ⇒ قرار مفتوح يُعلَّم ولا يُعامَل كحقيقة مؤكدة.
// القراءة الأولى تُخزَّن (ملف ثابت)؛ والاختبارات تمرّر نسخة معدَّلة إلى normalizeLabor مباشرة.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let RAW;
export function loadLaborData() {
  if (RAW !== undefined) return RAW;
  try { RAW = JSON.parse(readFileSync(join(__dirname, "_saudi-labor-data.json"), "utf8")); } catch { RAW = null; }
  return RAW;
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoOrNull = (v) => (typeof v === "string" && ISO.test(v) ? v : null);
// verify غير الصريح false ⇒ غير مؤكد.
const unverified = (node) => !(isObj(node) && node.verify === false);

// أول تاريخ ISO داخل نص («2025-10-27 (المرحلة الأولى)») أو null.
export function firstIsoDate(v) {
  const m = typeof v === "string" ? v.match(/\d{4}-\d{2}-\d{2}/) : null;
  return m ? m[0] : null;
}

/* ═════════════ التأمينات الاجتماعية (حصة صاحب العمل) ═════════════
   new  = النظام الجديد للمشترك الجديد (سعودي بلا مدد اشتراك سابقة قبل بداية الجدول): جدول زيادة سنوية، كل صف { from, employerPct }.
   legacy = المشترك القديم: نسبة ثابتة.
   wageCap = الحد الأعلى للأجر الخاضع. الحد الأدنى للأجر الخاضع في النظام الجديد لا مصدر له في الملف (null) فلا يُطبَّق هنا. */
function gosiFrom(g) {
  const out = { newSystem: { startsOn: null, verify: true, schedule: [] }, legacy: { employerPct: null, verify: true }, wageCap: null, wageCapVerify: true };
  if (!isObj(g)) return out;
  const reg = isObj(g.regimes) ? g.regimes : {};
  const ns = isObj(reg.new_system_saudi) ? reg.new_system_saudi : null;
  if (ns && Array.isArray(ns.schedule_by_year)) {
    const rows = ns.schedule_by_year
      .map((r) => (isObj(r) ? { from: isoOrNull(r.effective_from), employerPct: num(r.employer_total) } : null))
      .filter((r) => r && r.from && r.employerPct !== null)
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    out.newSystem = { startsOn: rows.length ? rows[0].from : null, verify: unverified(ns), schedule: rows };
  }
  const lg = isObj(reg.legacy_saudi) ? reg.legacy_saudi : null;
  if (lg) out.legacy = { employerPct: num(lg.employer_total), verify: unverified(lg) };
  const cap = isObj(g.contributory_wage) && isObj(g.contributory_wage.maximum) ? g.contributory_wage.maximum : null;
  if (cap) { out.wageCap = num(cap.value) > 0 ? cap.value : null; out.wageCapVerify = unverified(cap); }
  return out;
}

// → { gosi, eosb:{monthsPerYearFirst5, monthsPerYearAfter5, verify}, leave:{days, verify} }
export function normalizeLabor(raw) {
  const d = isObj(raw) ? raw : {};
  const eo = isObj(d.eosb) && isObj(d.eosb.accrual) ? d.eosb.accrual : null;
  const f = eo && isObj(eo.formula) ? eo.formula : {};
  const lv = isObj(d.leave_tickets) && isObj(d.leave_tickets.annual_leave) ? d.leave_tickets.annual_leave : null;
  return {
    gosi: gosiFrom(d.gosi),
    eosb: { monthsPerYearFirst5: num(f.months_per_year_first_5), monthsPerYearAfter5: num(f.months_per_year_after_5), verify: unverified(eo) },
    leave: { days: lv && num(lv.days_default) > 0 ? lv.days_default : null, verify: unverified(lv) },
  };
}

let NORM;
export function saudiLabor() {
  if (NORM === undefined) NORM = normalizeLabor(loadLaborData());
  return NORM;
}

// نسبة حصة صاحب العمل (٪) للمشترك: regime = "new" | "legacy"، ولتاريخ date (ISO) للجديد.
//   peakUntil (اختياري، ISO): أعلى نسبة سارية في المدى [date, peakUntil] — للتسعير بأسوأ الحالات في عقد يمتد عبر زيادة 1 يوليو.
//   → { pct, verify } | null (لا مصدر أو تاريخ قبل بداية الجدول).
export function gosiEmployerPct(gosi, regime, date, peakUntil) {
  const g = isObj(gosi) ? gosi : null;
  if (!g) return null;
  if (regime === "legacy") return g.legacy && g.legacy.employerPct !== null ? { pct: g.legacy.employerPct, verify: g.legacy.verify } : null;
  const sch = g.newSystem && Array.isArray(g.newSystem.schedule) ? g.newSystem.schedule : [];
  if (!sch.length || !isoOrNull(date) || date < sch[0].from) return null;
  let cur = sch[0];
  for (const r of sch) if (r.from <= date) cur = r;
  let pct = cur.employerPct;
  if (isoOrNull(peakUntil) && peakUntil > date) for (const r of sch) if (r.from > date && r.from <= peakUntil && r.employerPct > pct) pct = r.employerPct;
  return { pct, verify: g.newSystem.verify };
}

// أي نظام ينطبق على مشترك أول تاريخ اشتراك له firstDate (ISO أو فارغ): الفارغ/المجهول ⇒ جديد (الافتراضي)، وقبل بداية الجدول ⇒ قديم.
export function gosiRegimeFor(gosi, firstDate) {
  const start = gosi && gosi.newSystem ? gosi.newSystem.startsOn : null;
  if (isoOrNull(firstDate) && start && firstDate < start) return "legacy";
  return "new";
}
