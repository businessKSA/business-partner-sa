// Business Partner — دورة حياة المرشّح في خدمة EOR التشغيلية: المراحل والانتقالات والأدوار وأقنعة الخصوصية.
//
// يملكه وكيل `eor`. وحدة صِرفة (ESM): لا شبكة ولا قاعدة بيانات ولا ملفات ولا ساعة — مدخلات ومخرجات فقط،
// فتُختبر بلا محاكاة. ملف مساعد يبدأ بـ`_` فلا يُحتسب دالةً جديدة (السقف ١٢). لا يوجد له مسار في api/requests.js بعد.
//
// ما فيها:
//   ١) STAGE_ORDER وSIDE_STAGES: المراحل بترتيبها. الانتقال الأمامي مرحلةً واحدةً فقط — لا قفز ولا رجوع.
//   ٢) canTransition / nextStages / rolesFor: من يملك أي انتقال (vendor / ops / client / candidate / system).
//   ٣) visaChecklist / onboardingChecklist: قوائم افتراضية بلا ادّعاء نظامي ولا أسماء جهات حكومية.
//   ٤) maskForRole: قناع الحقول بحسب الدور — قائمة بيضاء (حقل جديد مخفيّ حتى يُضاف عمداً) ثم تنظيف عميق
//      لأسماء المفاتيح الحسّاسة كخطّ دفاع ثانٍ، ويفشل مُغلقاً (null) إن لم يثبت الدور ملكيته للسجل.
//
// صيغة «السجل» (placement) التي يتوقعها القناع — يركّبها طبقة الـAPI من الجداول (camelCase):
//   { id, requestId, itemId, clientId, sourceVendorId, candidateKey, stage, heldFrom,
//     profile:{…}        // ملخّص مجهول الهوية آمن للعميل (مهنة، جنسية، سنوات خبرة…)
//     contact:{…}        // بيانات المرشّح الشخصية (الاسم، الجوال، البريد، الهوية…)
//     salePriceMonthlyHalalas, salaryHalalas, vendorFeeHalalas, currency,
//     margin/cost/…      // داخلي — لا يخرج إلا لـops وsystem
//   }
// «مفتاح المرشّح» candidateKey هو معرّف صفحة Notion فقط؛ لا بيانات شخصية في جداول القاعدة.
//
// كل الانتقالات المكتوبة هنا افتراضات تصميم تنتظر تأكيد المالك (انظر تقرير التسليم) — الجدول بيانات
// لا منطق، فتعديل أي صلاحية سطرٌ واحد وتُحدَّث اختباراته معه.

/* ═════════════ الثوابت ═════════════ */
export const STAGE_ORDER = Object.freeze([
  "sourced", "screened", "shortlisted", "client_interview", "client_selected", "offer", "contract_signed",
  "visa_processing", "visa_issued", "travelling", "onboarding_ksa", "ready", "deployed", "active",
  "offboarding", "closed",
]);
export const SIDE_STAGES = Object.freeze(["rejected", "withdrawn", "on_hold"]);
export const ALL_STAGES = Object.freeze([...STAGE_ORDER, ...SIDE_STAGES]);
// مراحل نهائية: لا يخرج منها شيء (إعادة فتح مرشّح مرفوض قرارٌ بشري خارج هذا الجدول).
export const TERMINAL_STAGES = Object.freeze(["closed", "rejected", "withdrawn"]);
export const ROLES = Object.freeze(["vendor", "ops", "client", "candidate", "system"]);
// مراحل يجوز فيها الفوترة الشهرية (يستعملها _eor-cost.js).
export const BILLABLE_STAGES = Object.freeze(["deployed", "active", "offboarding"]);
// أول مرحلة تنكشف فيها بيانات تواصل المرشّح للعميل.
export const CONTACT_RELEASE_STAGE = "client_selected";

const IDX = new Map(STAGE_ORDER.map((s, i) => [s, i]));
export const stageIndex = (s) => (IDX.has(s) ? IDX.get(s) : -1);
export const isStage = (s) => ALL_STAGES.includes(s);

const normRole = (r) => {
  const v = String(r == null ? "" : r).toLowerCase();
  if (v === "employee") return "candidate";            // الموظف بعد التعاقد هو المرشّح نفسه
  return ROLES.includes(v) ? v : null;
};

/* ═════════════ جدول الانتقالات ═════════════ */
// انتقال أمامي واحد من كل مرحلة، ومن يملكه.
const FORWARD = Object.freeze({
  sourced:          { to: "screened",         roles: ["ops", "system"] },            // الفرز والتقييم
  screened:         { to: "shortlisted",      roles: ["ops"] },                      // إدراج في القائمة المختصرة لعميل
  shortlisted:      { to: "client_interview", roles: ["client", "ops"] },            // طلب مقابلة
  client_interview: { to: "client_selected",  roles: ["client", "ops"] },            // اختيار العميل (ops تسجّله بتفويضه)
  client_selected:  { to: "offer",            roles: ["ops"] },                      // تجهيز العرض
  offer:            { to: "contract_signed",  roles: ["candidate", "ops", "system"] }, // قبول وتوقيع
  contract_signed:  { to: "visa_processing",  roles: ["ops"] },                      // فتح ملف التأشيرة
  visa_processing:  { to: "visa_issued",      roles: ["ops", "system"] },            // تأكيد صدورها (إثباتها مستند)
  visa_issued:      { to: "travelling",       roles: ["ops", "vendor"] },            // ترتيب السفر
  travelling:       { to: "onboarding_ksa",   roles: ["ops", "system"] },            // تأكيد الوصول
  onboarding_ksa:   { to: "ready",            roles: ["ops", "system"] },            // اكتمال قائمة الاستقبال
  ready:            { to: "deployed",         roles: ["ops"] },                      // تسليم للعميل
  deployed:         { to: "active",           roles: ["client", "ops", "system"] },  // مباشرة العمل
  active:           { to: "offboarding",      roles: ["ops", "client"] },            // بدء الإنهاء
  offboarding:      { to: "closed",           roles: ["ops"] },                      // إغلاق التسوية
});

const upTo = (last) => STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(last) + 1);
const PIPELINE = upTo("ready");                                                      // قبل التسليم للعميل
const REJECTABLE = upTo("offer");
const CLIENT_REJECTABLE = ["shortlisted", "client_interview", "client_selected"];
const SELF_WITHDRAWABLE = upTo("offer");                                             // قبل توقيع العقد

// الأدوار التي تملك الانتقال from→to. ctx.heldFrom مطلوب للعودة من on_hold.
export function rolesFor(from, to, ctx = {}) {
  if (!isStage(from) || !isStage(to) || from === to) return [];
  if (TERMINAL_STAGES.includes(from)) return [];

  if (from === "on_hold") {
    if (to === "rejected" || to === "withdrawn") return ["ops"];
    const back = ctx && ctx.heldFrom;
    return back && to === back && PIPELINE.includes(back) ? ["ops"] : [];             // العودة لما قبل التعليق فقط
  }
  if (STAGE_ORDER.includes(from) && FORWARD[from] && FORWARD[from].to === to) return [...FORWARD[from].roles];

  if (to === "rejected") {
    if (!REJECTABLE.includes(from)) return [];
    return CLIENT_REJECTABLE.includes(from) ? ["ops", "client"] : ["ops"];
  }
  if (to === "withdrawn") {
    if (!PIPELINE.includes(from)) return [];
    return SELF_WITHDRAWABLE.includes(from) ? ["ops", "vendor", "candidate"] : ["ops"];
  }
  if (to === "on_hold") return PIPELINE.includes(from) ? ["ops"] : [];
  return [];                                                                           // قفز أو رجوع
}

export function canTransition(from, to, role, ctx) {
  const r = normRole(role);
  return !!r && rolesFor(from, to, ctx).includes(r);
}

export function nextStages(stage, role, ctx) {
  const r = normRole(role);
  if (!r || !isStage(stage)) return [];
  return ALL_STAGES.filter((to) => rolesFor(stage, to, ctx).includes(r));
}

/* ═════════════ القوائم الافتراضية ═════════════ */
export const CHECKLIST_NOTICE = Object.freeze({
  ar: "قائمة افتراضية يضبطها المكتب المنفّذ؛ تطابقها مع المتطلبات الفعلية لكل بلد يحتاج مراجعة قانونية قبل الاعتماد.",
  en: "Default list set by the executing office; its match with each country's actual requirements needs legal review before sign-off.",
});

const VISA_STEPS = Object.freeze([
  { key: "criminal_check", titleAr: "الفحص الجنائي", titleEn: "Criminal record check" },
  { key: "medical_check", titleAr: "الفحص الطبي", titleEn: "Medical examination" },
  { key: "documents_certificates", titleAr: "الوثائق والشهادات", titleEn: "Documents and certificates" },
  { key: "application_submission", titleAr: "تقديم الطلب", titleEn: "Application submission" },
  { key: "visa_issuance", titleAr: "صدور التأشيرة", titleEn: "Visa issuance" },
]);

// خطوات ملف التأشيرة عند المكتب الخارجي. البلد لا يغيّر القائمة اليوم (لا قواعد خاصة ببلد بلا تأكيد المالك)،
// لكنه يُحفظ على كل خطوة ليفرّق المكتب لاحقاً. تُرجَع نسخٌ جديدة في كل استدعاء.
export function visaChecklist(country) {
  const c = String(country == null ? "" : country).trim().toUpperCase();
  const code = /^[A-Z]{2}$/.test(c) ? c : null;
  return VISA_STEPS.map((s, i) => ({ ...s, position: i + 1, country: code, executor: "office", requiresProof: true }));
}

const ONBOARDING_ITEMS = Object.freeze([
  { key: "residency", titleAr: "الإقامة", titleEn: "Residency", requiresProof: true, hasAmount: false },
  { key: "insurance", titleAr: "التأمين", titleEn: "Insurance", requiresProof: true, hasAmount: false },
  { key: "medical_check", titleAr: "الفحص الطبي", titleEn: "Medical examination", requiresProof: true, hasAmount: false },
  { key: "work_permit_fee", titleAr: "رسوم رخصة العمل", titleEn: "Work permit fees", requiresProof: true, hasAmount: true },
]);

export function onboardingChecklist() {
  return ONBOARDING_ITEMS.map((s, i) => ({ ...s, position: i + 1 }));
}

/* ═════════════ أقنعة الخصوصية ═════════════ */
const nk = (k) => String(k).replace(/[_\-\s]/g, "").toLowerCase();
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// نسخة عميقة تُسقط كل مفتاح تُرجع drop(اسمه المطبَّع) عنه true، على أي عمق (والمفاتيح الخطرة كـ__proto__ دائماً).
function scrub(v, drop) {
  if (Array.isArray(v)) return v.map((x) => scrub(x, drop));
  if (v instanceof Date) return new Date(v.getTime());
  if (isObj(v)) {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (UNSAFE_KEYS.has(k) || drop(nk(k))) continue;
      out[k] = scrub(x, drop);
    }
    return out;
  }
  return v;
}
const hasAny = (tokens) => (n) => tokens.some((t) => n.includes(t));

// هويات حكومية وتاريخ الميلاد والعنوان: لا تصل العميل أبداً عبر هذه الدالة، قبل الاختيار أو بعده.
const ID_DOCS = new Set(["nationalid", "idnumber", "passport", "passportno", "passportnumber", "iqama", "iqamano", "iqamanumber", "dob", "dateofbirth", "birthdate", "address"]);
// كل ما يعرّف الشخص: يُحجب عن العميل قبل الاختيار.
const PERSONAL = new Set([...ID_DOCS, "name", "fullname", "firstname", "lastname", "displayname", "phone", "mobile", "email", "whatsapp", "photo", "photourl", "linkedin", "cv", "cvurl", "resume", "contact", "contacts"]);

const DENY_CLIENT = hasAny(["margin", "markup", "cost", "vendor", "supplier", "salary", "commission", "payroll", "notion", "candidatekey", "source", "internal", "opsnote"]);
const DENY_VENDOR = hasAny(["client", "organization", "sale", "price", "margin", "markup", "cost", "invoice", "payroll", "timesheet", "internal", "opsnote"]);
const DENY_CANDIDATE = hasAny(["client", "organization", "sale", "price", "margin", "markup", "cost", "vendor", "supplier", "commission", "invoice", "source", "notion", "candidatekey", "internal", "opsnote"]);

const KEYS = Object.freeze({
  client: ["id", "requestId", "itemId", "stage", "heldFrom", "profile", "salePriceMonthlyHalalas", "currency", "plannedStartDate", "startDate", "endDate", "createdAt", "updatedAt"],
  vendor: ["id", "itemId", "occupationId", "candidateKey", "stage", "heldFrom", "profile", "contact", "vendorFeeHalalas", "currency", "createdAt", "updatedAt"],
  candidate: ["id", "itemId", "stage", "heldFrom", "profile", "contact", "salaryHalalas", "currency", "plannedStartDate", "startDate", "endDate", "visa", "onboarding", "createdAt", "updatedAt"],
});

function contactReleased(p) {
  const eff = p.stage === "on_hold" ? p.heldFrom : p.stage;       // رُفض/انسحب ⇒ stageIndex = -1 ⇒ لا انكشاف
  return stageIndex(eff) >= stageIndex(CONTACT_RELEASE_STAGE);
}

// maskForRole(placement, role, ctx) → نسخة مقنَّعة أو null.
//   ops/system: نسخة كاملة. client/vendor/candidate: قائمة بيضاء + تنظيف عميق.
//   ctx الإلزامي لهذه الأدوار الثلاثة (يفشل مُغلقاً بـnull إن غاب أو لم يطابق):
//     client → { clientId }  ·  vendor → { vendorId }  ·  candidate → { candidateKey }
//   الدالة قفلٌ ثانٍ فوق عزل الاستعلام نفسه، لا بديلٌ عنه.
export function maskForRole(placement, role, ctx = {}) {
  if (!isObj(placement)) return null;
  const r = normRole(role);
  if (!r) return null;
  if (r === "ops" || r === "system") return scrub(placement, () => false);
  const c = isObj(ctx) ? ctx : {};
  const same = (a, b) => a != null && b != null && String(a) !== "" && String(a) === String(b);

  if (r === "client") {
    if (!same(c.clientId, placement.clientId)) return null;
    const out = {};
    for (const k of KEYS.client) if (placement[k] !== undefined) out[k] = placement[k];
    const released = contactReleased(placement);
    const clean = scrub(out, (n) => DENY_CLIENT(n) || PERSONAL.has(n));
    if (released && isObj(placement.contact)) {
      clean.contact = scrub(placement.contact, (n) => DENY_CLIENT(n) || ID_DOCS.has(n));
    }
    return clean;
  }
  if (r === "vendor") {
    if (!same(c.vendorId, placement.sourceVendorId)) return null;
    const out = {};
    for (const k of KEYS.vendor) if (placement[k] !== undefined) out[k] = placement[k];
    return scrub(out, DENY_VENDOR);
  }
  // candidate
  if (!same(c.candidateKey, placement.candidateKey)) return null;
  const out = {};
  for (const k of KEYS.candidate) if (placement[k] !== undefined) out[k] = placement[k];
  return scrub(out, DENY_CANDIDATE);
}

export function maskListForRole(list, role, ctx) {
  return (Array.isArray(list) ? list : []).map((p) => maskForRole(p, role, ctx)).filter((x) => x !== null);
}
