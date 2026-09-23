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

`api/_db.js` يتحدث إلى Supabase عبر PostgREST (HTTP). Azure Database for
PostgreSQL يحتاج مُشغّلاً حقيقياً (`pg`)، والمشروع يُبنى اليوم **بلا أي
اعتماديات** (`installCommand: echo "no dependencies"`). فالنقل يتطلب:

1. إضافة `pg` وتغيير أمر التثبيت — يمسّ بناء الموقع كله.
2. تجميع الاتصالات (PgBouncer أو Azure Connection Pooling)، لأن كل نداء
   serverless يفتح اتصالاً.
3. نسخ البيانات وتبديل مسار الكتابة ونافذة تحقّق.

وهذه ليست طبقة الوكيل وحده: Supabase يحمل **المستخدمين والجلسات والطلبات
والمدفوعات** لكل المنصة. تبديلها دفعة واحدة يوقف تسجيل الدخول والشراء على
الموقع الحي إن أخطأ شيء.

لذلك لم أُنفّذها في هذه الدفعة، ولم أدّعِ أنها تمّت. الخطة المقترحة للدفعة
التالية، بهذا الترتيب:

1. إنشاء المخطّط على Azure PostgreSQL من `db/schema.sql` كما هو.
2. `api/_azpg.js` يطبّق نفس واجهة `sb()` فوق `pg`، خلف `DB_DRIVER=azure`.
3. نسخ البيانات، ثم قراءة مزدوجة للتحقّق من التطابق قبل تبديل الكتابة.
4. التبديل بمتغيّر بيئة واحد، مع إبقاء Supabase قابلاً للرجوع أسبوعاً.

---

## 6) الأتمتة — من n8n إلى Logic Apps

سير عمل واتساب والمزامنة في `ops/n8n/` لم يعد جزءاً من المسار الأساسي: مزامنة
الخزنة صارت داخل الكود مباشرة إلى SharePoint، فلم تعد تمرّ بـn8n. تعريف Logic
App مكافئ لمدخل واتساب في `ops/azure/whatsapp-logic-app.json`.
