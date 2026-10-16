# نقل لوحة العروض (bp-quotes) إلى Azure

القرار: المالك 2026-10-16. اللوحة تصير تطبيقاً مستقلاً على Azure Container Apps
(المنفذ 3000، المسار `/quotes`) وقاعدتها على Azure PostgreSQL. الموقع الرئيسي على
Vercel يبقى يمرّر `/quotes` إليها.

## الترتيب (لا تقفز خطوة)

1. **جهّز الأسرار** في GitHub (Settings ← Secrets): `AZURE_CREDENTIALS` إلزامي.
   مفاتيح الدفع والبريد وDocuSign اختيارية، وما ينقص يُتخطّى مع تحذير.
2. **تجربة بلا أثر:** شغّل `bash azure/quotes/deploy.sh` (أو الـworkflow بـ`apply=false`).
   يطبع الخطة فقط ولا يلمس Azure.
3. **بناء الصورة والنشر:** الـworkflow `Deploy bp-quotes to Azure` بـ`apply=true`
   وتأكيد `deploy-quotes`، أو محلياً `bash azure/quotes/deploy.sh --apply`.
   يبني الصورة من `quotes/Dockerfile` داخل Azure (لا docker على جهازك)، وينشئ
   القاعدة والتطبيق. يحتاج أن يكون `quotes/Dockerfile` موجوداً.
4. **نقل القاعدة (بإشراف المالك):** القاعدة الجديدة فارغة. المالك يشغّل بنفسه
   تصدير القاعدة القديمة واستيرادها إلى `bp-quotes-pg` حسب
   `docs/quotes-cutover.md` و`quotes/docs/azure-migration.md`، ثم `prisma migrate deploy`.
   لا يُطلب `DATABASE_URL` القديم في أي محادثة.
5. **فحص:** افتح `https://<عنوان التطبيق>/quotes` (العنوان يُطبع آخر السكربت).
   جرّب الدخول، عرض سعر، توليد PDF، وويبهوك تجريبي من مُيسّر.
6. **تحويل رسالتي `/quotes` في `vercel.json`** إلى عنوان التطبيق (بعد نجاح 5 فقط).
   ثم يحذف المالك مشروع `bp-quotes` من لوحة Vercel.

## الرسالة الجديدة المقترحة (غير مطبّقة)

في `vercel.json`، المقطعان الحاليان يشيران إلى `https://bp-quotes-three.vercel.app`.
يصيران:

```json
{ "source": "/quotes",         "destination": "https://<FQDN>/quotes" },
{ "source": "/quotes/:path*",  "destination": "https://<FQDN>/quotes/:path*" }
```

حيث `<FQDN>` هو عنوان التطبيق، مثل `bp-quotes.<اسم-البيئة>.swedencentral.azurecontainerapps.io`.
رسالة `/quotes/d/:token` تبقى كما هي (تمرّ بالموقع أولاً).

## ملاحظات

- التراجع قبل الخطوة 6 بلا كلفة: Vercel ما زالت تخدم. بعد 6، أعد العنوان القديم.
- أول نسخة تبقى دائمة (min=1) لأن ويبهوكات الدفع والتوقيع تنتظر رداً سريعاً.
  لتقليل الكلفة: `BP_QUOTES_MIN=0` (أول طلب يتأخر ثوانٍ).
- التشغيل المتكرر آمن: لا يبدّل كلمة القاعدة ولا مفتاح الجلسة.
- الكلفة الشهرية التقريبية (تقدير، تُحتسب من المنحة): نحو 40 إلى 75 دولاراً.
