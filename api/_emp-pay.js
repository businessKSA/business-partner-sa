// Business Partner HR — شراء باقة صاحب العمل عبر السلة والدفع القائمين.
//
// هذه الوحدة هي الجسر الوحيد بين api/pay.js (المنسّق) ومنطق الاشتراك في
// api/employer.js. لا تحمل سعراً ولا حالة اشتراك: السعر يأتي من
// getPlanOffer في employer.js، والتفعيل يتمّ في activateSubscription هناك.
// وظيفتها أن تُحوّل «معرّف بند في السلة» إلى عرض مُسعَّر من الخادم، وأن تنقل
// دفعةً مؤكَّدة إلى التفعيل دون أن تثق بأي رقم جاء من المتصفح.
//
// العقد مع employer.js (مملوك لـrecruitment-employer — لا يُعدَّل من هنا):
//   getPlanOffer(plan, billing)
//       plan    "basic" | "pro" | "enterprise"
//       billing "monthly" | "yearly"
//       → { amountHalalas, currency, plan, billing, sku } | null
//       amountHalalas = سعر الباقة **قبل ضريبة القيمة المضافة** بالهللات، كما
//       تُخزَّن كل مبالغ الكتالوج؛ وpay.js هو من يضيف ١٥٪ عند الدفع.
//   createPendingSubscription({ email, company, plan, billing })
//       → { ok, reference }       صفّ «بانتظار الدفع»؛ reference يصير مرجع الطلب
//   activateSubscription({ reference, paymentRef, amountHalalas, billing })
//       → { ok, activated, code? }   idempotent على paymentRef: إعادة الدفعة نفسها
//       تعيد ok:true وactivated:true وcode:"already_processed". وفي الفشل ok:false
//       والسبب في `code` (وليس رمز وصول أبداً) — يُقرأ منه وحده.
//
// SKU: BP-EMP-BASIC-M · BP-EMP-BASIC-Y · BP-EMP-PRO-M · BP-EMP-PRO-Y.
// enterprise «عرض سعر» فلا يُدفع من السلة: يُرفض هنا قبل أي نداء.
//
// الاستيراد ديناميكي عمداً: صادرٌ مفقود في استيراد ثابت يُسقط pay.js كله
// (أي كل مدفوعات الموقع) لا مسار الاشتراك وحده. هنا الغياب يعني «الباقة غير
// متاحة للدفع الآن» وتبقى بقية السلة تعمل.
//
// بادئة _ فالملف وحدة مساعدة وليس الدالة الثالثة عشرة.

import { getSession } from "./_db.js";

const SKU_RE = /^BP-EMP-(BASIC|PRO|ENTERPRISE)-(M|Y)$/i;

const PLAN_LABEL = {
  basic: { ar: "الأساسية", en: "Basic" },
  pro: { ar: "الاحترافية", en: "Pro" },
};
const BILLING_LABEL = {
  monthly: { ar: "شهري", en: "monthly" },
  yearly: { ar: "سنوي", en: "yearly" },
};

// يعرف شكل المعرّف فقط. لا يقرّر سعراً ولا يكلّم أحداً.
export function parseEmpSku(id) {
  const m = SKU_RE.exec(String(id || "").trim());
  if (!m) return null;
  const plan = m[1].toLowerCase();
  const billing = m[2].toUpperCase() === "Y" ? "yearly" : "monthly";
  return { sku: `BP-EMP-${m[1].toUpperCase()}-${m[2].toUpperCase()}`, plan, billing, payable: plan !== "enterprise" };
}

let injected = null, sessionFn = null;
// للاختبار وحده: بريد الجلسة المُثبتة بدل قاعدة الجلسات.
export function __setSessionForTest(fn) { sessionFn = fn || null; }
// بريد الجلسة المُثبتة (OTP) وحده — لا بريد جاء في جسم الطلب.
export async function empSessionEmail(req) {
  try {
    const s = sessionFn ? await sessionFn(req) : await getSession(req);
    return String((s && s.user && s.user.email) || "").trim().toLowerCase();
  } catch { return ""; }
}
// للاختبار وحده: يحلّ محلّ employer.js بمحاكاة تلتزم العقد أعلاه.
export function __setEmployerForTest(impl) { injected = impl || null; }

async function employer() {
  const m = injected || (await import("./employer.js").catch(() => null));
  if (!m || typeof m.getPlanOffer !== "function" || typeof m.createPendingSubscription !== "function" || typeof m.activateSubscription !== "function") return null;
  return m;
}

// السعر كما يقوله الخادم لهذا الـSKU. كل مسار في pay.js يمرّ من هنا.
export async function empOffer(rawSku) {
  const p = parseEmpSku(rawSku);
  if (!p) return { ok: false, error: "not_employer_sku" };
  if (!p.payable) return { ok: false, error: "quote_only", plan: p.plan };
  const mod = await employer();
  if (!mod) return { ok: false, error: "employer_unavailable" };
  let o = null;
  try { o = await mod.getPlanOffer(p.plan, p.billing); } catch { o = null; }
  const halalas = o && Number(o.amountHalalas);
  if (!o || !Number.isInteger(halalas) || halalas <= 0) return { ok: false, error: "no_offer" };
  // عرضٌ لا يطابق ما طُلب (باقة أو دورة أو معرّف) يعني عقداً مكسوراً بين
  // الملفين — يُرفض بدل أن يُباع شيءٌ غير ما رآه العميل.
  if (String(o.currency || "SAR").toUpperCase() !== "SAR") return { ok: false, error: "bad_currency" };
  if (String(o.plan || p.plan).toLowerCase() !== p.plan || String(o.billing || p.billing).toLowerCase() !== p.billing) return { ok: false, error: "offer_mismatch" };
  if (o.sku && String(o.sku).toUpperCase() !== p.sku) return { ok: false, error: "offer_mismatch" };
  return {
    ok: true, payable: true,
    offer: { sku: p.sku, plan: p.plan, billing: p.billing, amountHalalas: halalas, amountSar: halalas / 100, currency: "SAR" },
    name: {
      ar: `اشتراك منصة التوظيف — الباقة ${PLAN_LABEL[p.plan].ar} (${BILLING_LABEL[p.billing].ar})`,
      en: `Recruitment platform subscription — ${PLAN_LABEL[p.plan].en} plan (${BILLING_LABEL[p.billing].en})`,
    },
  };
}

// سلةٌ فيها اشتراكان أو كمية أكثر من واحد ليست سلة اشتراك: كل اشتراك صفّ
// ومرجع، والطلب مرجعه واحد. تُرفض كلها بدل تخمين أيّهما يُفعَّل.
export function empBasketProblem(ids) {
  const lines = (ids || []).filter((x) => parseEmpSku(x && x.id));
  if (!lines.length) return null;
  if (lines.length > 1) return "one_plan_per_order";
  if ((Number(lines[0].qty) || 1) !== 1) return "plan_qty_must_be_one";
  return null;
}

// تمارا للسنوي وحده: الشهري مبلغٌ صغير لا يستحق تقسيطاً، وقرار الأهلية يبقى
// لتمارا نفسها عند فتح الجلسة. (pay.js يطبّقها على bnpl-checkout.)
export function empBnplAllowed(ids) {
  const lines = (ids || []).map((x) => parseEmpSku(x && x.id)).filter(Boolean);
  return lines.every((l) => l.billing === "yearly");
}

// قبل الدفع: يُنشئ الصفّ المعلّق ويعيد مرجعه، ومعه السعر الذي سيُحاسَب به.
// البريد يُؤخذ من الجلسة المُثبتة لا من خانة الدفع القابلة للتعديل: وإلا فتح أي
// زائرٍ صفوف «بانتظار الدفع» لبريد أي أحد. بريدٌ مختلف في الطلب يُرفض لا يُتجاهل.
export async function empPrepare({ sku, sessionEmail, email, company }) {
  const off = await empOffer(sku);
  if (!off.ok) return off;
  const mail = String(sessionEmail || "").trim().toLowerCase();
  if (!mail) return { ok: false, error: "not_signed_in" };
  const asked = String(email || "").trim().toLowerCase();
  if (asked && asked !== mail) return { ok: false, error: "email_mismatch" };
  const co = String(company || "").trim().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { ok: false, error: "bad_email" };
  if (!co) return { ok: false, error: "company_required" };
  const mod = await employer();
  if (!mod) return { ok: false, error: "employer_unavailable" };
  let r = null;
  try { r = await mod.createPendingSubscription({ email: mail, company: co, plan: off.offer.plan, billing: off.offer.billing }); }
  catch (e) { console.error("emp-prepare failed", String((e && e.message) || e).slice(0, 160)); r = null; }
  const ref = r && r.ok && String(r.reference || "").trim();
  if (!ref || !/^[A-Za-z0-9_-]{6,40}$/.test(ref)) return { ok: false, error: "pending_failed", reason: String((r && (r.code || r.error)) || "").slice(0, 60) };
  return { ok: true, reference: ref, offer: off.offer, name: off.name };
}

// بعد دفعةٍ مؤكَّدة ومطابقة: يُفعّل الاشتراك. المبلغ المُمرَّر هو سعر الباقة من
// الخادم (قبل الضريبة)، لا رقماً جاء من المتصفح. الفشل لا يرمي: الدفع حدث،
// والمنسّق هو من ينبّه المالك.
export async function empActivate({ reference, paymentRef, sku }) {
  const off = await empOffer(sku);
  if (!off.ok) return { ok: false, activated: false, error: off.error };
  const mod = await employer();
  if (!mod) return { ok: false, activated: false, error: "employer_unavailable" };
  const ref = String(reference || "").trim();
  const pay = String(paymentRef || "").trim();
  if (!ref || !pay) return { ok: false, activated: false, error: "missing_reference" };
  try {
    const r = await mod.activateSubscription({
      reference: ref, paymentRef: pay,
      amountHalalas: off.offer.amountHalalas, billing: off.offer.billing,
    });
    // ok:true وactivated:false (code "already_processed") = هذه الدفعة فُعِّلت من قبل:
    // الحساب مفتوح، فهو نجاحٌ للمشتري لا فشل. الفشل الحقيقي ok:false.
    const ok = !!(r && r.ok);
    return { ok, activated: ok, already: ok && r.activated === false, ...(ok ? {} : { error: String((r && (r.code || r.error)) || "not_activated").slice(0, 60) }) };
  } catch (e) {
    console.error("emp-activate failed", String((e && e.message) || e).slice(0, 160));
    return { ok: false, activated: false, error: "activate_threw" };
  }
}
