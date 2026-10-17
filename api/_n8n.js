// عنوان n8n في مكان واحد (قرار المالك 2026-10-16: n8n على Azure).
//
// قبل هذا الملف كان العنوان `businesspartnerai.app.n8n.cloud` مكتوباً حرفياً في
// خمسة ملفات من api/ وفي مولّد الصفحات. يوم القطع من n8n Cloud إلى n8n على
// Azure Container Apps يكفي أن يُضبط متغيّر بيئة واحد:
//
//     N8N_BASE_URL=https://n8n.businesspartner.sa
//
// وبلا المتغيّر يبقى العنوان الحالي حرفياً، فلا ينكسر شيء قبل القطع ولا يتغيّر
// أي سلوك. المتغيّرات الأخصّ تغلب هذا الأساس كما كانت (OWNER_WA_WEBHOOK،
// N8N_ATS_WEBHOOK…): الأساس يحلّ محل **الافتراضي** وحده.
//
// ملف مساعد (يبدأ بـ_) فلا يُحتسب من سقف الدوال الاثنتي عشرة.
//
// ⚠ اتجاه واحد: هذا يوجّه ما **يرسله الموقع** إلى n8n. أما ما يرسله n8n إلى
// الموقع (الويبهوكات الواردة) فيُحدَّث من الجهة الأخرى — انظر
// docs/n8n-azure-cutover-2026-10-16.md.

export const N8N_LEGACY_BASE = "https://businesspartnerai.app.n8n.cloud";

// الأساس الفعّال بلا شرطة أخيرة. قيمة فارغة أو غير مطلقة تُهمَل وتُعاد القديمة
// (خطأ مطبعي في متغيّر بيئة يجب ألا يوقف الإرسال إلى n8n).
export function n8nBase(env = process.env) {
  const raw = String((env && env.N8N_BASE_URL) || "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/\s]+/i.test(raw) ? raw : N8N_LEGACY_BASE;
}

// مسار ويبهوك الإنتاج: n8nWebhookUrl("website-lead-notify")
export function n8nWebhookUrl(path, env = process.env) {
  return `${n8nBase(env)}/webhook/${String(path).replace(/^\/+/, "")}`;
}

// صفحة نموذج n8n (Form Trigger): n8nFormUrl("5b3298ae-…")
export function n8nFormUrl(id, env = process.env) {
  return `${n8nBase(env)}/form/${String(id).replace(/^\/+/, "")}`;
}
