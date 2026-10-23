# SHR-HR — لوحة تشغيل الفواز (محلية)

بيانات وهمية فقط. لا ربط حكومي ولا رسائل. تعمل مع `LOCAL_DB=1` وحدها؛ أي بيئة
أخرى ترد `503 shr_local_only`.

## الملفات
- `api/_shr.js` — بوابة العزل `scoped`، البذرة الوهمية (مستأجران `SHR` و`OTHER`)، `HttpError` و`audit` المشتركان.
- `api/shr.js` — **دالة `api/` واحدة** (action). دوال `api/` الآن **11 من 12** (المتاح واحدة)؛ SHR لا يضيف شيئاً فوق هذه الدالة، والمنطق في وحدات تبدأ بـ`_` فلا تُحتسب.
- `api/_shr_match.js` — محرك المطابقة (نقي، بلا استيراد).
- `api/_shr_ats.js` — منطق ATS: وظائف، طلبات تقديم، مقابلات، مطابقة.
- `site/scripts/simple-v1-shr.mjs` (القشرة والعمال والطلبات) و`simple-v1-shr-ats.mjs` (شاشات ATS) — الصفحة `/SHR-HR`.
- `db/shr-schema.sql` — الجداول وRLS. الاختبارات: `tests/shr-tenant.test.mjs` · `tests/shr-api.test.mjs` · `tests/shr-match.test.mjs` · `tests/shr-ats.test.mjs`.

## الإجراءات
الجلسة كوكي موقَّع؛ المستأجر منه لا من الطلب (`tenant_id` في الطلب يُرفض). الأدوار: `tenant_owner` و`operator` فقط.

| النطاق | GET | POST |
|---|---|---|
| تشغيل | `session` `dashboard` `workers` `requests` `expiring` | `session` `session-end` `worker-create` `worker-activate` `worker-archive` `request-state` |
| ATS | `jobs` `applications` `candidates` `candidate` | `job-create` `job-close` `application-create` `application-stage` `interview-request` `interview-set` `match` |

لا حذف: `worker-delete` وكل `*-delete` يرد `403 archive_only`؛ الوظيفة تُغلق والعامل والمرشح يُؤرشفان.

## ATS
- **المراحل الثمانية:** `new` `review` `shortlist` `interview` `offer` `hired` `rejected` `future`. مرحلة غير معروفة تُرفض (400)؛ كل انتقال يكتب حدثاً في `shr_application_events` (لا تعديل ولا حذف) وسطراً في سجل التدقيق. `hired` نهائية.
- **من يُدخل لا يعتمد العرض:** التعيين (`offer → hired`) هو اعتماد العرض، ولا يعتمده من أدخل الطلب ولا من نقله إلى «عرض» (403 `maker_checker`)، ولا يُعيَّن أحد دون المرور بـ«عرض».
- **الموافقة:** `shr_candidate_consents` (صيغة النص، نصه، تاريخ المنح، المصدر، السحب). المرشح بلا موافقة سارية (لا سجل أو مسحوبة) لا يُقبل له طلب تقديم ولا يدخل المطابقة؛ يُعدّ فقط في `excluded`. لا إجراء لتسجيل الموافقة أو سحبها بعد؛ البذرة تثبت الفلترة.
- **المقابلات:** `interview-request` ثم `interview-set` سجلان داخليان؛ لا رسالة ولا دعوة تُرسل لأحد.
- **المطابقة:** سبعة مكوّنات بأوزان: المهنة 30، قابلية نقل الإقامة 20، الخبرة 15، الجنسية 10، الموقع 10، التوفر 10، المهارات 5. المكوّن المجهول (`UNKNOWN`) والمكوّن غير المطلوب (`NA`) يخرج وزنه من القسمة ولا يستبعد أحداً، ويُذكر باسمه. شروط `must_have` لا تحذف أحداً: من يفشل فيها يظهر في فئة `must_have_miss` منفصلة. كل نتيجة ترجع `explain` (وزن ودرجة ومساهمة وسبب لكل مكوّن) و`summary`.
- **المرشحون وهميون:** `shr_candidates` بلا حقول هوية أو هاتف أو بريد أصلاً، وكل صف موسوم `demo` وrefه `DEMO-C-…` واسمه «(وهمي)».

## ملاحظة: طبقة المرشحين الحقيقية لم تُربط
المرشحون هنا جدول وهمي داخل SHR. **قاعدة مرشحي BP الحقيقية لم تُربط بـSHR**، و`api/candidates.js` **لا يُستدعى من SHR أبداً**. ربطها مشروط بأمرين لم يتحققا:
1. عمود موافقة صريح على المرشح في قاعدة BP (اليوم لا عمود يثبت أن المرشح وافق على ظهور بياناته لجهة أخرى).
2. عرض مجهول المعرّف (اسم مخفي وبلا هوية أو هاتف أو بريد) يُعرض للمطابقة قبل الموافقة.
حتى يُقرَّر ذلك ويُنفَّذ بأمر المالك، لا قراءة ولا نسخ من قاعدة BP.

## الدخول التجريبي
`SHR` → `owner@shr.invalid` / `ops@shr.invalid`؛ `OTHER` → `owner@other.invalid` / `ops@other.invalid`. شغّل `LOCAL_DB=1 npm run dev` وافتح `/SHR-HR`.
البذرة تُرقّي قواعد `.localdb` القديمة تلقائياً (تضيف مرشحي ATS إن لم يوجدوا).
