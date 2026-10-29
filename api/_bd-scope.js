// نصّ «نطاق العمل الشهري» لباقات تطوير الأعمال (REV-*): مصدر واحد للصفحة والخادم.
// الصفحة (site/scripts/simple-v1-business-development.mjs) تُرسله مع البند، والخادم لا يقبل
// وصفاً مكتوباً على بند REV إلا إن طابق أحد هذين النصّين حرفاً (api/_simple.js: priceItems)؛
// فلا يصير ما يكتبه العميل بنداً تعاقدياً. أقلّ من 400 حرف لأن normScope يقصّ الوصف عندها.
export const BD_SCOPE = {
  ar: "نطاق العمل الشهري: ١) تحديد العميل المثالي والحسابات المستهدفة ٢) التواصل وحجز الاجتماعات ٣) تأهيل الفرص وبناء المسار ٤) تجهيز العروض ومساندة التفاوض ٥) البحث عن الشركاء والموردين والقنوات ٦) تقارير القياس ومتابعة التحصيل. لا ضمان لعدد صفقات.",
  en: "Monthly scope of work: 1) ideal customer and target accounts 2) outreach and booking meetings 3) qualifying opportunities and building the pipeline 4) preparing proposals and supporting negotiation 5) finding partners, suppliers and channels 6) measurement reports and collection follow-up. No number of deals is guaranteed.",
};
export const BD_SKU = /^REV-/i;
