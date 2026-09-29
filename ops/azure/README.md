# البنية التحتية على Microsoft Azure — المستشار الذكي للمستندات

قرار المالك (2026-09-15): **كل شيء على Azure**. هذا الملف يحصر ما نُقل، وما
يجب ضبطه في Vercel، وما بقي.

---

## 1) ما انتقل فعلاً في هذه الدفعة

| الطبقة | قبل | بعد |
|---|---|---|
| قراءة المستندات (صور) | Gemini → Anthropic → OpenAI | **Azure OpenAI** (vision) |
| قراءة الـPDF | Gemini/Anthropic | **Azure AI Document Intelligence** ثم Azure OpenAI |
| التخطيط والمطابقة والمراجعة | Gemini → Anthropic | **Azure OpenAI** (text) |
| المحادثة والصوت | Azure (سابقاً) | Azure — بلا تغيير |
| خزنة الملفات | Supabase Storage | **Azure Blob Storage** + روابط SAS |
| مجلدات العملاء | Notion + Google Drive | **SharePoint** عبر Microsoft Graph |

المزوّدون الآخرون لم يعودوا يُستدعون. الكود باقٍ في مكانه لكنه **معطّل**، ولا
يعمل إلا بـ`DOC_AI_ALLOW_FALLBACK=1` — صمّام أمانٍ لانقطاعٍ في Azure، لا مسار
افتراضي. الاختبارات تمنع أي تسرّب: `tests/azure-provider.test.mjs` يرصد أي نداء
يخرج إلى googleapis أو anthropic أو openai ويُسقط الاختبار.

---

## 2) المتغيّرات المطلوبة في Vercel

### الذكاء — Azure OpenAI (مضبوط سابقاً للمحادثة)
```
AZURE_OPENAI_ENDPOINT        https://<اسم-المورد>.openai.azure.com
AZURE_OPENAI_KEY             <المفتاح>
AZURE_OPENAI_DEPLOYMENT      <اسم النشر العام، مثل gpt-4o-mini>
```
واختيارياً، نشرٌ مختلف لكل مهمة (الأرخص للنص، والبصري للمستندات):
```
AZURE_OPENAI_VISION_DEPLOYMENT   gpt-4o
AZURE_OPENAI_TEXT_DEPLOYMENT     gpt-4o-mini
```

### قراءة الـPDF — Document Intelligence (**مطلوب**)
بدونه لا يُقرأ أي PDF، وأكثر مستندات العملاء PDF.
```
AZURE_DOCINTEL_ENDPOINT      https://<المورد>.cognitiveservices.azure.com
AZURE_DOCINTEL_KEY           <المفتاح>
AZURE_DOCINTEL_MODEL         prebuilt-read        (اختياري)
AZURE_DOCINTEL_API_VERSION   2024-11-30           (اختياري)
```

### الخزنة — Blob Storage
```
AZURE_STORAGE_ACCOUNT        <اسم حساب التخزين>
AZURE_STORAGE_KEY            <مفتاح الحساب، Access keys>
AZURE_STORAGE_CONTAINER      client-documents     (اختياري)
```
الحاوية يجب أن تكون **خاصة** (Private، بلا وصول مجهول): الوصول كله عبر روابط
SAS موقّعة بعشر دقائق، وقراءةٍ فقط، ولملف واحد بعينه.

### مجلدات العملاء — SharePoint عبر Graph
تطبيق في Entra ID بصلاحيات **Application** وموافقة المسؤول:
`Files.ReadWrite.All` و`Sites.ReadWrite.All`.
```
AZURE_TENANT_ID              <معرّف المستأجر>
AZURE_CLIENT_ID              <معرّف التطبيق>
AZURE_CLIENT_SECRET          <السر>
AZURE_GRAPH_DRIVE_ID         <معرّف مكتبة المستندات>
AZURE_GRAPH_ROOT_FOLDER      Client Documents     (اختياري)
```
معرّف المكتبة:
`GET https://graph.microsoft.com/v1.0/sites/<host>:/sites/<اسم-الموقع>:/drives`

### قاعدة البيانات — Azure Database for PostgreSQL
تُضبط على مرحلتين (انظر §5): الرابط أولاً، والمُشغّل عند التبديل فقط.
```
AZURE_PG_URL                 postgres://<user>:<pass>@<host>:5432/<db>?sslmode=require
DB_DRIVER                    azure                (خطوة التبديل فقط — لا قبلها)
AZURE_PG_POOL_MAX            2                    (اختياري)
AZURE_PG_SSL                 0                    (لخادم اختبار محلي فقط)
AZURE_PG_SSL_REJECT_UNAUTHORIZED   0              (لشهادة ذاتية التوقيع فقط)
```
- بلا `DB_DRIVER=azure` لا يتغيّر شيء، ولا يُحمَّل `pg` أصلاً — فوجود
  `AZURE_PG_URL` وحده لا كلفة له على نشرات Supabase القائمة.
- `DB_DRIVER=azure` بلا `AZURE_PG_URL` يجعل الـAPI يُبلّغ عن المتغيّر الناقص،
  ولا يرجع إلى Supabase بصمت.
- `AZURE_PG_POOL_MAX` منخفض عمداً: كل نسخة serverless لها تجمّعها الخاص، وسقف
  اتصالات Azure يُستهلك بعدد النسخ لا بعدد الاستعلامات.
- **الرابط الذي يُعطى لـVercel** يمرّ بمجمّع الاتصالات المدمج في Azure
  (PgBouncer، المنفذ `6432`، وضع transaction). `api/_azpg.js` يضبط
  `SET timezone` على كل اتصال لا على كل معاملة، فوضع transaction آمن.
  أمّا سكربت النسخ فيستعمل المنفذ المباشر `5432`.

---

## 3) بنية المجلدات في SharePoint

```
Client Documents/
  اسم المنشأة (a1b2c3d4)/
    المستندات المرفوعة/DOC-000123/
    المخرجات/DOC-000123/
    الحزم/DOC-000123/
```
اسم المجلد يحمل اسم المنشأة ومقدّمة معرّفها، فلا يلتبس اسمان متشابهان. والمحارف
التي يرفضها SharePoint (`" * : < > ? / \ |`) تُنظَّف، والعربية تبقى كما هي.

---

## 4) ترحيل الملفات القديمة

الكتابة تذهب إلى Azure من أول نشرة. أمّا القراءة فتجرّب Azure، وعند **404 فقط**
ترجع إلى Supabase Storage — لأن ملفات العملاء المرفوعة قبل النقل ما زالت هناك،
وعميلٌ يفتح مستنده القديم يجب أن يجده. أي خطأ آخر من Azure يُرفع كما هو ولا
يُخفى خلف الخزنة القديمة.

بعد نسخ الملفات القديمة إلى Blob يسقط هذا الرجوع من تلقاء نفسه بلا تغيير كود.

---

## 5) ما لم يُنقل بعد — قاعدة البيانات

الحالة (2026-09-29): **الكود جاهز، والبيانات لم تُنقل.** الموقع الحي ما زال
على Supabase، وهذا هو الجزء الوحيد من قرار «كل شيء على Azure» الذي لم يكتمل.

ما تحقّق في هذه الدفعة:

- `db/schema.sql` طُبّق **كما هو، بلا تعديل** على PostgreSQL 16 عادي: ٤٥
  جدولاً ومنظوران (view) أُنشئت نظيفةً، بما فيها امتداد `pgcrypto` وسياسات
  RLS ودالة `current_org_ids()`. الملف كُتب لـSupabase لكنه لا يحمل شيئاً
  خاصاً بها.
- `api/_azpg.js` هو المُشغّل: يأخذ مسار PostgREST نفسه الذي تصدره كل وحدات
  الخادم عبر `sb()` ويحوّله إلى SQL مُعاملي فوق `pg`. القيم تعود **بصيغة
  PostgREST** (الأوقات نصوص ISO بلاحقة `+00:00`، والأرقام أرقاماً)، فلا يتغيّر
  سطرٌ واحد في بقية الـAPI. يُختار بـ`DB_DRIVER=azure` مع `AZURE_PG_URL`
  (المتغيّرات في §2).
- `tests/azpg.test.mjs` يمرّر كل أشكال استعلامات PostgREST التي يصدرها
  المستودع على Postgres حقيقي (`AZPG_TEST_URL`)، ويتخطّى نفسه إن لم يجد
  خادماً. التشغيل المحلي في `docs/local-development.md`.
- `db/copy-to-azure.mjs` سكربت النسخ (تفاصيله في الخطوة ٤).
- `pg` صار اعتمادية معلنة في `package.json`، وأمر التثبيت في `vercel.json`
  يثبّتها — فلم يعد البناء «بلا اعتماديات».

ما لم يتغيّر: Supabase يحمل **المستخدمين والجلسات والطلبات والمدفوعات** لكل
المنصة. تبديلها دفعة واحدة يوقف تسجيل الدخول والشراء على الموقع الحي إن أخطأ
شيء. لذلك التحويل خطوات مرتّبة، وكل خطوة تُتحقّق قبل التي بعدها.

### خطة التحويل — خطوة بخطوة

**من يفعل ماذا:** Claude لا يصل إلى Azure من هذه الجلسات — لا لوحة ولا
`az` ولا شبكة إلى الخادم. فكل ما يلمس Azure أو متغيّرات Vercel **يفعله
المالك**، وكل ما يعمل على الكود أو على الجهاز المحلي أو بسكربت يُشغَّل بمتغيّر
بيئة يعطيه المالك **يفعله Claude**. الخطوات مُعلَّمة بذلك.

1. **إنشاء الخادم — المالك.** Azure Database for PostgreSQL Flexible Server،
   الإصدار 16. منطقة «السعودية الشرقية» غير متاحة بعد (المدوَّن في نوشن:
   نوفمبر 2026)، فتُختار الآن أقرب منطقة ويُخطَّط للنقل لاحقاً. ثم:
   - إضافة `pgcrypto` إلى القائمة المسموحة في معلمة الخادم
     `azure.extensions` (Server parameters → azure.extensions) **قبل** تشغيل
     ملف المخطّط، وإلا فشل أول سطر فيه (`create extension`).
   - إنشاء قاعدة البيانات والمستخدم، وتفعيل مجمّع الاتصالات المدمج
     (PgBouncer) ليتوفّر المنفذ `6432`.
   - أخذ رابطين: المباشر (`5432`) للسكربتات، والمجمَّع (`6432`) لـVercel.
2. **تطبيق المخطّط — المالك** (أو Claude إن أُعطي الرابط المباشر مؤقتاً):
   ```
   psql "$AZURE_PG_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
   ```
   `ON_ERROR_STOP` يوقف عند أول خطأ بدل أن يُكمل على مخطّط ناقص. الملف
   idempotent (`create … if not exists`)، فإعادة تشغيله آمنة.
3. **الرابط في Vercel — المالك.** `AZURE_PG_URL` (رابط `6432`) في بيئتَي
   Preview وProduction، **بلا `DB_DRIVER` بعد**. الموقع لا يتأثر: بلا المُشغّل
   لا يُقرأ الرابط ولا يُحمَّل `pg`.
4. **النسخ — Claude**، بالمتغيّرات `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
   (المصدر) و`AZURE_PG_URL` (الهدف، رابط `5432` المباشر):
   ```
   node db/copy-to-azure.mjs --dry-run      # يعدّ ولا يكتب
   node db/copy-to-azure.mjs                # النسخ الكامل
   node db/copy-to-azure.mjs --verify       # قراءة مزدوجة
   ```
   السكربت **يرفض** هدفاً يحمل `supabase` في اسم مضيفه، فلا يُكتب على المصدر
   بالخطأ. ينسخ بترتيب المفاتيح الخارجية بإدراجٍ idempotent (upsert)، ثم
   يعيد ضبط التسلسلات. `--verify` يقارن العدّ وبصمة كل صف ويخرج بـ`1` عند أي
   اختلاف. الأعلام الأخرى: `--tables=a,b` لجداول بعينها، `--batch=N` لحجم
   الدفعة، `--since=<ISO>` للفرق فقط.
   وأول ما يطبعه `--dry-run`: الجداول الموجودة في Supabase وليست في
   `db/schema.sql`. هذه **تُضاف إلى الملف أولاً** ثم يُعاد تشغيل الخطوة ٢، وإلا
   لم تُنسخ. معروفٌ منها ستة يستدعيها الـAPI ولا يعرفها الملف:
   `violations` و`site_errors` و`analytics_daily` و`analytics_top_clicks`
   و`analytics_top_pages` و`analytics_top_refs` — تُفحص على Supabase، وتُضاف
   إن حملت بيانات (وإلا رمى المترجم «الجدول غير موجود» عند أول استدعاء).
5. **نافذة التجميد — المالك يعلنها، Claude ينفّذها.** بعد إعلان التجميد (لا
   كتابة على الموقع)، يُعاد النسخ للفرق منذ آخر نسخة ثم يُتحقّق مجدداً:
   ```
   node db/copy-to-azure.mjs --since=<وقت آخر نسخة بصيغة ISO>
   node db/copy-to-azure.mjs --verify
   ```
   لا تبديل قبل `--verify` نظيف.
6. **التبديل — المالك.** `DB_DRIVER=azure` في Vercel (Preview وProduction)،
   ثم نشرة **متعمَّدة**: إمّا بإعادة نشر من لوحة Vercel بعد تغيير المتغيّر،
   وإمّا بكوميت يحمل علامة النشر المتفق عليها في `CLAUDE.md`. لا شيء يُنشر
   من تلقاء نفسه.
7. **فحص الدخان — Claude** على الصفحة الحية بعد أن تكون النشرة `READY`:
   - `GET /api/otp` يُعيد `dbReachable: true`.
   - تسجيل دخول بالرمز على حساب حقيقي.
   - إنشاء طلب واحد ورؤيته في `/my` وفي لوحة العمليات.
   أي فشل هنا ينقل مباشرةً إلى الخطوة ٨.
8. **الرجوع — المالك.** حذف `DB_DRIVER` من Vercel وإعادة النشر. Supabase لم
   تُمسّ خلال كل ما سبق (النسخ قراءة فقط منها)، وتبقى قائمةً **أسبوعاً**
   بعد التبديل. الكتابات التي وصلت Azure في تلك الفترة لا تعود إليها من
   تلقاء نفسها.
9. **بعد أسبوع — المالك.** Supabase للقراءة فقط، ثم إيقافها. لا تُحذف قبل
   نسخ الملفات القديمة من Storage (انظر §4).

### ما زال غير محلول

- **Supabase Auth ليست مستخدمة** — تُحقِّق منه في `api/otp.js`: الرمز يُنشئ
  صفاً في جدولنا `user_sessions` ويضع الكوكي، ولا نداء إلى `auth/v1`. فلا
  حسابات تُنقل من Auth؛ ما في `users` و`user_sessions` هو كل شيء.
- **الرجوع إلى Supabase Storage** للملفات القديمة (§4) يبقى يقرأ منها حتى
  تُنسخ إلى Blob. إيقاف مشروع Supabase قبل ذلك يُخفي مستندات العملاء القديمة.
- **ستة جداول يستدعيها الـAPI وليست في `db/schema.sql`**: `violations`،
  `site_errors`، `analytics_daily`، `analytics_top_clicks`، `analytics_top_pages`،
  `analytics_top_refs`. يجب أن يُعرَف قبل النسخ هل توجد على Supabase وهل
  تحمل صفوفاً، وتُضاف تعريفاتها إلى الملف قبل الخطوة ٢.
- **n8n / Logic Apps** (§6): ما زال تعريف Logic App بلا نشر، وسير عمل n8n
  القديم يشير إلى Supabase إن كان أيٌّ منه لا يزال يعمل.

---

## 6) الأتمتة — من n8n إلى Logic Apps

سير عمل واتساب والمزامنة في `ops/n8n/` لم يعد جزءاً من المسار الأساسي: مزامنة
الخزنة صارت داخل الكود مباشرة إلى SharePoint، فلم تعد تمرّ بـn8n. تعريف Logic
App مكافئ لمدخل واتساب في `ops/azure/whatsapp-logic-app.json`.
