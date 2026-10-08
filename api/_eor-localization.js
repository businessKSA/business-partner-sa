// Business Partner — مستشار التوطين لنموذج طلب الموظفين (EOR): يطابق المهنة المطلوبة مع فئات قرارات توطين المهن (وزارة الموارد البشرية)
// ويُخرج تنبيهاً معلوماتياً للعميل بنسبة التوطين وتاريخ سريانها.
//
// يملكه وكيل `eor`. ملف مساعد (يبدأ بـ_) فلا يُحتسب دالةً جديدة (السقف ١٢). وحدة صِرفة سوى قراءة api/_saudi-labor-data.json (عبر
// api/_eor-labor.js): النسب والتواريخ ومواضع verify كلها من الملف، لا رقم نظامي في الكود. جدول التطابق أدناه (أي مهنة من الفهرس تقع تحت أي فئة)
// هو وحده ما يُكتب هنا، وبتحفّظ: ما لا تتأكد منه لا يُطبَّق. لا يُمنع طلب (قرار المالك: منع أم تحويل — مفتوح) إلا بالمفتاح
// localization.mode = block، وحينئذٍ للمهن المقصورة على السعوديين 100% وحدها.
//
// ⚠ مراجعة قانونية قبل النشر الواسع: (١) نصوص التنبيه التي تعرضها الصفحة (ترجمات العميل في site/scripts/simple-v1-eor.mjs: مفاتيح loc*) حذرة وليست إفتاءً؛
// (٢) تطابق المهن مع فئات القرارات تقريبي بالأسماء (نوع التطابق exact = اسم المهنة يطابق مهنة مذكورة في القرار، close = قريبة منها بالمسمّى)؛
// (٣) القرارات تسري على مستوى الكيان لا الموظف الواحد وبعدد أدنى من العاملين (minWorkers)، فالتنبيه «قد يلزمك» لا «يلزمك»؛
// (٤) من هو «صاحب العمل» في EOR لأغراض التوطين (الكيان الذي يتعاقد أم العميل) مسألة مفتوحة (docs/saudi-labor-sources.md §8).
// لا يخرج للعميل: رقم القرار ولا رابط المصدر ولا حدّ الأجر ولا مسار الحساب — النسبة والتاريخ والفئة والعدد الأدنى فقط.

import { firstIsoDate, loadLaborData } from "./_eor-labor.js";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ═════════════ جدول تطابق المهن (معرّفات فهرس EOR) ═════════════
   exact: اسم المهنة الظاهر يطابق مهنة مذكورة في القرار. close: قريبة منها بالمسمّى (تُعلَّم close ويُصاغ تنبيهها بـ«قد»).
   sco (للمساندة 100% وحدها): رمز المهنة في القرار — منه يُقرأ تاريخ سريان مجموعتها من الملف (19 مهنة 2026-04-05، 50 مهنة 2026-10-04).
   لا يُطبَّق ما لا يتطابق: مثلاً مدير عام التسويق ومنسق التسويق ومحلل التسويق وأخصائي التسويق الرقمي لم تُذكر بأسمائها فلا تدخل،
   والتقنية والاتصالات (25% من خبر لا من صفحة الوزارة، verify) ليست مطبَّقة أصلاً. */
const E = (...ids) => ids.map((id) => ({ id, kind: "exact" }));
const CL = (...ids) => ids.map((id) => ({ id, kind: "close" }));
const S = (id, sco, kind = "exact") => ({ id, sco, kind });

export const LOCALIZATION_MAP = Object.freeze({
  marketing: [
    ...E("mkt.marketing-manager", "mkt.marketing-specialist", "media.graphic-designer", "media.photographer"),
    ...CL("mkt.advertising-manager"),
  ],
  sales: [
    ...E("sales.sales-manager", "sales.field-sales-representative", "sales.inside-sales-representative", "sales.telesales-agent"),
    ...CL("sales.regional-sales-manager", "sales.sales-executive"),
  ],
  accounting: [
    ...E("fin.finance-manager", "fin.accounting-manager", "fin.treasury-manager", "fin.audit-manager", "fin.accountant", "fin.cost-accountant",
      "fin.internal-auditor", "fin.financial-controller", "scm.inventory-controller"),
    ...CL("fin.chief-accountant", "fin.accounting-supervisor", "fin.assistant-accountant", "fin.general-ledger-accountant", "fin.accounts-payable-accountant",
      "fin.accounts-receivable-accountant", "fin.fixed-assets-accountant", "fin.budget-specialist"),
  ],
  procurement: [
    ...E("scm.procurement-manager", "scm.procurement-specialist", "scm.contracts-manager", "sales.tender-specialist", "sales.e-commerce-specialist", "log.storekeeper"),
    ...CL("log.warehouse-manager", "mkt.market-research-specialist"),
  ],
  project_management: [
    ...CL("pm.project-manager"),
  ],
  admin_support: [
    S("adm.translator", "264301"), S("adm.secretary", "412002"), S("adm.receptionist", "422601"), S("hosp.front-desk-agent", "422401"),
    S("adm.data-entry-clerk", "413201"), S("sec.security-guard", "541402"), S("sec.close-protection-officer", "541403"), S("ret.cashier", "241104"),
    S("log.customs-clearance-officer", "333103"), S("mkt.pr-manager", "122203"), S("mkt.pr-specialist", "243202"),
    S("hr.recruiter", "242304"), S("hr.compensation-benefits-specialist", "242305"),
    S("adm.executive-assistant", "334301", "close"), S("adm.administrative-assistant", "412001", "close"), S("adm.proofreader", "264303", "close"),
    S("hr.recruitment-manager", "121204", "close"), S("hr.compensation-benefits-manager", "121205", "close"), S("hr.hr-assistant", "441601", "close"),
    S("hr.istiqdam-officer", "242311", "close"), S("hr.hr-manager", "121201", "close"), S("hr.hr-specialist", "242302", "close"),
  ],
  pharmacy: [...E("health.pharmacist", "health.clinical-pharmacist"), ...CL("health.pharmacy-technician")],
  dental: [...E("health.dentist")],
});

// الهندسة: القرار يسرد 46 مهنة برموزها بلا أسماء في الملف؛ نطابق بمجموعة التصنيف الدولي للمهنة (ISCO 4 أرقام) في الفهرس بشرط أن يبدأ اسمها بـ«مهندس»
// وأن تكون من معرّفات eng.* — مجموعات 2141–2146 و2151–2152 و2161–2162 (لا 2149 «مهندسون آخرون» لأن الملف يسرد منها بعضاً فقط، ولا 2153 اتصالات).
const ENGINEERING_GROUPS = new Set(["2141", "2142", "2143", "2144", "2145", "2146", "2151", "2152", "2161", "2162"]);

// الحد الأدنى لعدد العاملين في المهن المستهدفة حتى ينطبق القرار (من applies_when في الملف؛ يتحقق منه الاختبار بالقراءة).
export const MIN_WORKERS = Object.freeze({ marketing: 3, sales: 3, accounting: 5, procurement: 3, engineering: 5, project_management: 3, admin_support: 1, pharmacy: 5, dental: 3 });

// مفاتيح الفئات المعروضة للصفحة (ترجمتها هناك).
export const LOCALIZATION_CATEGORIES = Object.freeze(["marketing", "sales", "accounting", "procurement", "engineering", "project_management", "admin_support", "pharmacy", "dental"]);

/* ═════════════ قراءة القرارات من الملف ═════════════ */
// → Map(id → { id, verify, phases:[{from, percent}]|[], range:[min,max]|null, scoDates:Map(sco → iso) })
export function decisionsFrom(raw) {
  const out = new Map();
  const list = isObj(raw) && isObj(raw.localization) && Array.isArray(raw.localization.profession_decisions) ? raw.localization.profession_decisions : [];
  for (const d of list) {
    if (!isObj(d) || typeof d.id !== "string") continue;
    const rec = { id: d.id, verify: d.verify !== false, phases: [], range: null, flatPercent: typeof d.percent === "number" && Number.isFinite(d.percent) ? d.percent : null, scoDates: new Map() };
    const eff = firstIsoDate(typeof d.effective_from === "string" ? d.effective_from : null);
    if (typeof d.percent === "number" && Number.isFinite(d.percent) && eff) rec.phases = [{ from: eff, percent: d.percent }];
    else if (Array.isArray(d.percent)) {
      // مراحل المنشآت الصغيرة (3–4 عاملين، مثل المرحلة الخامسة للمحاسبة 30%) لا تحلّ محل مراحل المنشآت الكبيرة فلا تدخل.
      rec.phases = d.percent.filter((p) => isObj(p) && typeof p.percent === "number" && ISO.test(String(p.from)) && !/3\s*[–-]\s*4/.test(String(p.applies_to || ""))).map((p) => ({ from: p.from, percent: p.percent }))
        .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    } else if (isObj(d.percent) && eff) {
      const vals = Object.values(d.percent).filter((x) => typeof x === "number" && Number.isFinite(x));
      if (vals.length) rec.range = [Math.min(...vals), Math.max(...vals)], rec.phases = [{ from: eff, percent: Math.min(...vals) }];
    }
    if (isObj(d.professions_groups)) {
      for (const [key, arr] of Object.entries(d.professions_groups)) {
        const m = key.match(/(\d{4})_(\d{2})_(\d{2})$/);
        if (!m || !Array.isArray(arr)) continue;
        const date = `${m[1]}-${m[2]}-${m[3]}`;
        for (const p of arr) if (isObj(p) && typeof p.sco_code === "string") rec.scoDates.set(p.sco_code, date);
      }
    }
    out.set(d.id, rec);
  }
  return out;
}

// النسبة السارية في ref (ISO): { percent, from, upcoming, next } — upcoming = لم يبدأ سريانها بعد (percent = أول مرحلة)، next = المرحلة التالية إن وُجدت.
function phaseAt(phases, ref) {
  if (!phases.length) return null;
  let cur = null, next = null;
  for (const p of phases) { if (p.from <= ref) cur = p; else if (!next) next = p; }
  if (!cur) return { percent: phases[0].percent, from: phases[0].from, upcoming: true, next: null };
  return { percent: cur.percent, from: cur.from, upcoming: false, next: next ? { percent: next.percent, from: next.from } : null };
}

/* ═════════════ التطابق ═════════════ */
// معرّفات الفهرس التي تقابل إدخال مهنة: معرّف فهرس ⇒ نفسه؛ معرّف قديم ⇒ مقابلاته (بشرط أن تتفق كلها في النتيجة، وإلا لا تنبيه).
function catalogIdsOf(occupationId, occupationCatalogId, lookup) {
  if (typeof occupationCatalogId === "string" && occupationCatalogId) return [occupationCatalogId];
  if (!lookup || typeof occupationId !== "string" || !occupationId) return [];
  if (lookup.isCatalogId(occupationId)) return [occupationId];
  return lookup.catalogIdsForOld(occupationId);
}

function categoriesOf(catalogId, lookup) {
  const hits = [];
  for (const [category, list] of Object.entries(LOCALIZATION_MAP)) {
    for (const e of list) if (e.id === catalogId) hits.push({ category, kind: e.kind, sco: e.sco || null });
  }
  if (typeof catalogId === "string" && catalogId.startsWith("eng.") && lookup && lookup.occupation) {
    const o = lookup.occupation(catalogId);
    if (o && ENGINEERING_GROUPS.has(String(o.group)) && String(o.ar || "").startsWith("مهندس")) hits.push({ category: "engineering", kind: "close", sco: null });
  }
  return hits;
}

// مطابقة فئة واحدة لمهنة ⇒ تنبيه أو null. decisions من decisionsFrom.
function noticeFor(hit, decisions, ref) {
  const dec = decisions.get(hit.category);
  if (!dec) return null;
  let ph = phaseAt(dec.phases, ref);
  if (hit.category === "admin_support") {
    const d = hit.sco ? dec.scoDates.get(hit.sco) : null;
    if (!d) return null;                                   // رمز غير موجود في الملف ⇒ لا يُطبَّق
    ph = { percent: 100, from: d, upcoming: d > ref, next: null };
    if (dec.flatPercent !== 100) return null;              // الملف لا يقول 100 ⇒ لا نفترض القصر
  }
  if (!ph) return null;
  const maxPct = dec.range ? dec.range[1] : ph.percent;
  return {
    category: hit.category,
    percent: ph.percent,
    ...(dec.range ? { percentMax: maxPct } : {}),
    from: ph.from,
    upcoming: ph.upcoming === true,
    saudiOnly: !dec.range && ph.percent === 100,
    close: hit.kind !== "exact",
    verify: dec.verify === true,
    minWorkers: MIN_WORKERS[hit.category] || null,
    ...(ph.next ? { next: ph.next } : {}),
  };
}

// أعلى نسبة تنتصر عند تعدد الفئات (نص الأدلة: تُطبَّق النسبة الأعلى)؛ والسارية قبل المقبلة.
const rank = (n) => (n.upcoming ? 0 : 1000) + (n.saudiOnly ? 100 : (n.percentMax || n.percent));

/* localizationNotices(items, { refDate, raw, lookup })
     items: [{ occupationId, occupationCatalogId?, nationalities? }]، refDate: تاريخ مرجعي ISO (تاريخ البدء أو اليوم).
     lookup (من المستدعي لأن هذا الملف لا يستورد الفهرس): { isCatalogId(id), catalogIdsForOld(id), occupation(catalogId) → { group, ar } }.
     → [{ index, notice|null }] ؛ notice = { category, percent, percentMax?, from, upcoming, saudiOnly, close, verify, minWorkers, next? } (آمن للعميل). */
export function localizationNotices(items, opts = {}) {
  const raw = opts.raw !== undefined ? opts.raw : loadLaborData();
  const ref = typeof opts.refDate === "string" && ISO.test(opts.refDate) ? opts.refDate : null;
  const decisions = decisionsFrom(raw);
  const list = Array.isArray(items) ? items : [];
  return list.map((it, index) => {
    if (!ref || !isObj(it)) return { index, notice: null };
    const ids = catalogIdsOf(it.occupationId, it.occupationCatalogId, opts.lookup);
    if (!ids.length) return { index, notice: null };
    // معرّفات قديمة متعددة المقابلات: لا تنبيه ما لم تتفق كلها على النتيجة نفسها (فئة ونسبة ونوع).
    const results = ids.map((id) => {
      const notes = categoriesOf(id, opts.lookup).map((h) => noticeFor(h, decisions, ref)).filter(Boolean);
      return notes.length ? notes.sort((a, b) => rank(b) - rank(a))[0] : null;
    });
    const first = results[0];
    if (!first || results.some((r) => !r || JSON.stringify(r) !== JSON.stringify(first))) return { index, notice: null };
    return { index, notice: first };
  });
}

// وضع التوطين من ملف التسعير: block وحدها تمنع؛ أي شيء آخر (غائب/فاسد) ⇒ advise (الافتراضي الآمن).
export function localizationModeFrom(pricing) {
  const l = isObj(pricing) && isObj(pricing.localization) ? pricing.localization : null;
  return l && l.mode === "block" ? "block" : "advise";
}
