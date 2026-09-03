# `erp/` — كعب انتظار لا مشروع

هذا المجلد لم يعد يحوي تطبيقاً. حُذف محتواه في 2026-09-04 (الكوميت
`21c5a6347`): كان صفحة تحويل واحدة إلى `businesspartner.sa` لا أكثر.

بقي `vercel.json` وحده لسبب واحد: مشروع Vercel **`bp-erp`**
(`prj_jRpTMKArauNZLe22qOZpDMj4GtJP`) ما زال قائماً وجذره مضبوط على `erp`.
وحين اختفى المجلد فشل المشروع على كل دفعة بالخطأ

    NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST
    The specified Root Directory "erp" does not exist.

والفشل يقع في `build-container-init` — أي **قبل** أن يُقرأ `ignoreCommand`
أصلاً، فلا ينفع شرط تجاهل في مجلد غير موجود.

## الترتيب الصحيح للتخلص منه

1. المالك يحذف مشروع `bp-erp` من لوحة Vercel: Project → Settings → Delete.
   (لا يحمل أي نطاق مخصّص، ولا شيء في الموقع يشير إليه.)
2. بعدها يُحذف هذا المجلد بالكامل من المستودع.

لا تحذف المجلد قبل الخطوة الأولى.
