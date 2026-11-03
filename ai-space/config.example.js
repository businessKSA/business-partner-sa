/* BP AI Space — إعدادات التشغيل غير السرّية فقط.
 *
 * مسارات n8n ومفتاح فرح لم تعد هنا: تمرّ كل النداءات عبر /api/bp/* وتُقرأ
 * المسارات من إعدادات التطبيق في Azure (انظر UNIFIED.md). هذا الملف اختياري؛
 * لو غاب تعمل القيم الافتراضية. */
window.BP_SPACE_CONFIG = {
  // Browser aborts a chat request after this many ms.
  chatTimeoutMs: 150000,

  // Dashboard auto-refresh interval in ms (0 disables).
  refreshMs: 45000,

  // Team pulse interval in ms (0 disables).
  pulseMs: 30000
};
