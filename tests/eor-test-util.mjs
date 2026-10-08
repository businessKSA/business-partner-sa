// أدوات مشتركة لاختبارات صفحة /eor. ليس ملف اختبار (لا ينتهي بـ.test.mjs).
//
// كتلة إعداد الصفحة (CFG) تحمل الكتالوج المضغوط (cat): ٢٥٠ دولة و١٧٠ مدينة و١١٨ قطاعاً و١٠٠٦ مهن بأسمائها العامة. أسماء مهنٍ وقطاعاتٍ مثل
// «Non-profit Organisations» و«Internal Auditor» و«مراقب تكاليف» ليست تسعيراً، فاختبارات «لا معامل ولا تكلفة ولا هامش في الصفحة» تفحص الصفحة بعد
// إخراج الكتالوج منها (يُفحص هو بنفسه في tests/eor-request-form.test.mjs: بنيته وأنه بيانات الفهرس العامة وحدها).
export function cfgFromHtml(h) {
  const m = h.match(/\)\((\{"lang":.*\})\);<\/script>/s);
  return m ? JSON.parse(m[1]) : null;
}
export function stripCat(h) {
  const cfg = cfgFromHtml(h);
  return cfg && cfg.cat ? h.split(JSON.stringify(cfg.cat)).join("{}") : h;
}
