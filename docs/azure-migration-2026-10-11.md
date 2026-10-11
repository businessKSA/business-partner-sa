# نقل الموقع والـAPI كاملين إلى Azure — حزمة الهجرة والخطة (2026-10-11)

> **الحالة:** خطة وأدوات جاهزة. **لا نقل فعلي حصل.** الموقع الحيّ على Vercel كما هو لم يتغيّر،
> ولم يُتَّصَل بأي خدمة Azure ولا بلوحة Vercel (الاستثناء الوحيد: طلبات GET عامة على
> `www.businesspartner.sa` لمطابقة سلوك التوجيه، مذكورة في §1.1).
>
> **القرار الذي تبني عليه:** أمر المالك 2026-10-11 — «أبغى أنقل الموقع على أزور والهوستنج كامل وأبغى
> أربط لك كل الـAPI من مساحة أزور». هذا يعدّل قاعدة «هدف واحد للنشر: Vercel» في `CLAUDE.md` §1؛
> تعديل `CLAUDE.md` يتم بعد هذه الخطة (قائمة ما يتغيّر فيه في §11).

---

## 0) الخلاصة في صفحة

**القرار المعماري المقترح:** حاوية واحدة على **Azure Container Apps** (منطقة **UAE North**، دبي)
تخدم الصفحات والـAPI معاً، أمامها **Azure Front Door Standard** للنطاق والشهادة وتخزين الأصول
مؤقتاً، وصورتها تُبنى في **Azure Container Registry** من GitHub Actions. المهام المجدولة الثلاث
تصير **Container Apps Jobs** بالصورة نفسها.

**لماذا ليس Static Web Apps** (الخيار الأول الذي يخطر): مهلة الـAPI فيه **٤٥ ثانية** كحدّ أقصى
(وعندنا `chat` و`requests` و`candidate` على ٦٠)، وملف إعداده **≤ ٢٠KB** مع wildcard في آخر
المسار فقط (عندنا ٤٠ تحويلاً بصيغة `:lang(ar|fr|zh)`)، ولا يوجّه حسب المضيف ولا يعمل وكيلاً إلى
أصل خارجي (عندنا `/quotes` → `bp-quotes`)، وقواعد المسارات لا تعمل على `/api` إلا تحويلاً.
الجدول الكامل في §2.

**ما يجعل النقل قليل المخاطرة:** الخادم الجديد (`ops/azure/server.mjs`) **يقرأ `vercel.json`
نفسه** ويشغّل `api/*.js` **كما هي بلا لمس سطر** — فلا نسخة ثانية من الإعداد تنحرف، ولا ملفات
وكلاء آخرين تتغيّر. وقد قارنتُه بالموقع الحيّ: **كل التحويلات الأربعين بحالتها ووجهتها، وكل مسارات الدوال، وعيّنة صفحات**
تعطي ما يعطيه Vercel (الفروق الوحيدة أسرارٌ غير موجودة في تجربتي المحلية) — §6.

**التكلفة التقريبية للاستضافة وحدها: نحو ١٠٠–١٧٠ دولاراً شهرياً** (نحو ٤٠–٥٠ دون Front Door وبنسخة
واحدة) — بلا قاعدة البيانات والذكاء والتخزين المتوفرة أصلاً. التفصيل في §4.

**المخاطر الثلاثة الأكبر** (التفصيل §7):
1. **مجدولان يعملان معاً = نشرة بريدية مرتين.** Vercel Cron ومهام Azure لا يجوز أن يتزامنا.
2. **`bp-quotes` يبقى على Vercel** — الموقع الجديد يمرّر `/quotes/*` و`/api/live-catalog` إليه. «كامل
   على Azure» لا يكتمل قبل نقل `quotes/` (مهمة `quotes-contracts`).
3. **سلوك الإنتاج يتغيّر لا الكود:** من دوال معزولة قصيرة العمر إلى **عملية Node طويلة العمر
   مشتركة** (تسريب ذاكرة، رفض غير معالَج يُسقط الجميع، IP العميل، حدود اتصالات القاعدة). عالجتُ
   ما يمكن في الخادم، والباقي يُراقَب بعد القطع.

**ما يلزم منك بالترتيب** (§9–§10): ١) اشتراك Azure وصلاحيته ٢) تأكيد المنطقة UAE North ٣) من
يدير DNS اليوم وتصدير سجلاته كاملة ٤) إنشاء الموارد بالخطوات المرقّمة ٥) ربط GitHub بهوية
OIDC ٦) لصق الأسرار في Azure (لا ترسلها لي) ٧) موعد القطع ونافذة المراقبة.

**ما بنيتُه** (§6): خادم الإنتاج، المترجم، غلاف توافق Vercel، المهام المجدولة، فاحص التكافؤ،
Dockerfile، جرد المتغيّرات، workflow معطّل بالافتراض، و٥٨ اختباراً.

---

## 1) الجرد بالأدلة

### 1.1 ما يرتبط بـVercel تحديداً

| # | ما هو | أين | ما يقابله على Azure |
|---|---|---|---|
| 1 | `outputDirectory: "site"`، `framework: null`، `cleanUrls: true`، `trailingSlash: false` | `vercel.json` | `server.mjs`: تقديم `site/`، و`/x.html`→`/x` و`/x/`→`/x` بـ308 (**تحققتُ من السلوك على الحيّ**) |
| 2 | **٤٠ redirect**: ٦ مُدارة بـ302 تكتبها `site/scripts/hidden.mjs` (`syncVercelRedirects`) + ٣٤ يدوية (308/307) | `vercel.json` | `routing.mjs` يقرأها كما هي؛ تغيير `hidden.json` ثم البناء يصل Azure بلا خطوة إضافية |
| 3 | **٢٥ rewrite**: ١٢ إلى دوال (`/api/simple`→`/api/requests?__route=simple` …)، ٣ إلى أصل خارجي `bp-quotes-three.vercel.app`، ٢ صفحات، ٨ بشرط المضيف `hr.businesspartner.sa` | `vercel.json` | نفسه (داخلية + وكيل عكسي). قواعد `hr.` تعمل على المضيف لكن **`hr.businesspartner.sa` لا يُحَلّ اليوم** (DNS) فهي خاملة — §12 |
| 4 | `functions[…].maxDuration`: ٦٠ث لـ`chat` و`requests` و`candidate` و`candidates` | `vercel.json` | يُقرأ من `vercel.json` (يغلب `config` داخل الملف كما عند Vercel). `candidates.js` يعلن ٣٠٠ داخل الملف لكن **٦٠ هي المعمول بها** اليوم. مدخل Container Apps يقطع عند **٢٤٠ث** كسقف لا يُتجاوز |
| 5 | **٣ مهام cron** (UTC): نشرة الأحد ٠٦:٠٠، `jobhunt` الاثنين ٠٥:٠٠، `candidate backfill` يومياً ٠٣:٠٠ — تصل بـ`Authorization: Bearer $CRON_SECRET` | `vercel.json`، `api/newsletter.js`، `api/candidate.js`، `api/_jobhunt.js` | `ops/azure/cron.mjs` + ٣ Container Apps Jobs بالصورة نفسها (يقرأ الجدول من `vercel.json`) |
| 6 | **headers**: `/assets/(.*)` ← `immutable` سنة، وملف Apple Pay ← `text/plain` | `vercel.json` | نفسه. وترويسات يضيفها Vercel وحدها وتحققتُ منها: `strict-transport-security: max-age=63072000` على كل شيء، `access-control-allow-origin: *` و`etag` للثابت، `cache-control: public, max-age=0, must-revalidate` افتراضياً — **يعيدها الخادم** |
| 7 | **الأبكس → www بـ308** | إعداد النطاق في لوحة Vercel (ليس في المستودع) | `BP_APEX_HOSTS` في الخادم (§8) |
| 8 | `ignoreCommand` + علامة النشر `deploy-preview-please` + قاعدة «فرع العمل هو الإنتاج» | `vercel.json`، `CLAUDE.md` §1 | `workflow_dispatch` فقط + متغيّر `AZURE_DEPLOY_ENABLED` + بيئة GitHub `production` بموافقة المالك. **لا علامة في الكوميت تنشر شيئاً على Azure** |
| 9 | `installCommand` (`npm install --omit=dev`) و`buildCommand` (`npm run build`) | `vercel.json` | `Dockerfile`: `npm ci --omit=dev` ثم `npm run build` نفسه (السلسلة بحارسيها دون تغيير) |
| 10 | متغيّرات `VERCEL` (١ موضع) و`VERCEL_ENV` (٤ مواضع: `_mode.js`، `_simple.js`، `otp.js`، `requests.js`) | الكود | `VERCEL_ENV=preview` يُفعّل أوضاع الاختبار الآمنة؛ **على Azure لا يُضبط في الإنتاج**، ويُضبط بمتغيّر `BP_ENV=preview` في بيئة staging. `VERCEL=1` يبقى **وقت البناء فقط** (يمنع `hidden.mjs` من إعادة كتابة `vercel.json`) |
| 11 | IP العميل: الدوال تقرأ **أول** عنصر من `X-Forwarded-For` (٦ مواضع) | `api/_suppliers.js`، `candidates.js`، `hire.js`، `requests.js`، `_simple.js` | Vercel يستبدل الترويسة؛ Container Apps **يُلحق** عنوان المتصل في النهاية فيستطيع الزائر انتحال عنوانه (حدود المعدّل، سجل توقيع العقد). **الغلاف يطبّع الترويسة** إلى عنوان واحد موثوق (`BP_TRUSTED_PROXY_HOPS`، افتراضياً ١، و٢ خلف Front Door) |
| 12 | حدّ جسم الدالة ٤.٥MB وتحليل الجسم حسب `Content-Type` | سلوك Vercel | نفسه في `vercel-compat.mjs` (مغطّى بالاختبارات) |
| 13 | **١٢ دالة كحدّ أقصى** وحارسها `verify-api.mjs` | Vercel Hobby/Pro | الحدّ يزول على Azure؛ **الحارس يبقى** ما دام Vercel حياً. اليوم **11/12** (لا 12/12 كما في الملخص: فرع `integration-2026-10-11` فيه ١١ دالة) |
| 14 | معاينة لكل فرع (`*.vercel.app`) | Vercel | مراجعات (revisions) بلا حركة + بيئة staging منفصلة |
| 15 | ما يشير إلى `bp-quotes-three.vercel.app`: ٣ rewrites، `QUOTES_PANEL_URL` الافتراضي (`api/requests.js:1413`)، `PORTAL_URL` وقت البناء، `site/scripts/compare-prices.mjs`، و**workflow n8n `ops/n8n/catalog-sync.workflow.js`** الذي يستدعي **Vercel Deploy Hook** (سطر ٢٨٩) | متعدد | الأربعة الأولى تبقى صالحة ما دام `bp-quotes` حياً. **الـDeploy Hook يجب استبداله** بـ`workflow_dispatch` على GitHub (أو إعادة نشر المراجعة) وإلا لن يؤدي أثراً بعد القطع — مهمة `automation-agents` |

ما **لا** يستعمل Vercel إطلاقاً (تحققتُ بالبحث في `site/` و`api/`): لا Vercel Blob، لا Edge Config،
لا KV/Postgres من Vercel، لا Analytics ولا Speed Insights في الصفحات، ولا عنوان `*.vercel.app`
مكتوب في الصفحات المبنيّة.

الطلبات العامة التي أجريتُها للمطابقة (GET فقط، نحو ٣٥٠ طلباً موزّعة على ثلاث دفعات، لا أجسام ولا كتابة):
`/`، `/about/`، `/about.html`، `/ar/`، `/Revenue-OS`، عيّنات من التحويلات، `/api/otp`، `/api/pay`،
`/scripts/verify-api.mjs`، `/quotes`. اكتشفتُ بها: المطابقة حسّاسة لحالة الأحرف؛ 308 للمنقول و307
للمؤقت؛ الاستعلام يُلحق بالوجهة؛ **`/scripts/*.mjs` (سكربتات البناء) تُخدَم علناً اليوم** (٢٠٠)؛
الـ404 نص عادي `NOT_FOUND`؛ ورؤوس الـ404 تحمل `immutable` على `/assets/` (خلل صغير لا يُنقل).

### 1.2 الموقع الثابت

- **١٤٩٠ صفحة HTML** (حارس الصفحات) في **١٦١٠ ملفاً**، **٨٤MB** كلها (`du -sh site`) — اللغات التسع
  (ar/en/es/fr/hi/ja/ko/ru/zh)، منها ar/fr/zh نحو ١٨MB لكل واحدة، `site/services` ٩.٧MB، `assets` ٢.٥MB.
- أكبر ملفات `site/`: `data/marketing-content.json` ٢.٧MB (يُضغط)، ثم سكربتا البناء `generate.mjs` و`i18n.mjs` (١.٢MB و٠.٩MB، ويُغلقان على Azure)، وأكبر صفحة `directory.html` ٠.٦MB. هذا الحجم يمرّ في Static Web Apps أيضاً (حدّه ٢٥٠MB للبيئة و١٥٠٠٠ ملف) —
  **الحجم ليس سبب رفض ذلك الخيار**، المهلة والتوجيه هما السبب.
- **«٩٥.٦GB من ١٠GB»:** ليست من الموقع. الموقع ٨٤MB لكل نشرة؛ الرقم تراكم نشرات Vercel وملفاتها
  عبر المشاريع (Hobby/Pro يحسب مخزون النشرات القديمة). **لا شيء منه ينتقل إلى Azure**: الصورة نحو
  ٣٠٠–٣٥٠MB (Node + الموقع)، وكل نسخة قديمة منها في ACR تُنظَّف بسياسة احتفاظ. النقل بحد ذاته
  يُنهي مشكلة السقف دون حذف مشاريع Vercel (قرار الحذف يبقى للمالك).
- ملاحظة أمنية خارج نطاقي: **مجلد `site/scripts/` (سكربتات البناء، ٤.٧MB) يُخدَم علناً على Vercel**
  اليوم. خادم Azure **يغلقه** (404) افتراضياً — لا صفحة تحمّل منه شيئاً (تحققتُ). ويعود بـ
  `BP_SERVE_BUILD_SCRIPTS=1` إن لزم.
- المتغيّرات التي **تُكتب في الصفحات وقت البناء** (فالبناء يجب أن يرثها من Vercel):
  `GOOGLE_CLIENT_ID`، `PORTAL_URL`، `SIMPLE_V1`، `COMPANY_LEGAL_NAME`، `COMPANY_CR_NUMBER`،
  `COMPANY_UNIFIED_NUMBER`، `COMPANY_VAT_NUMBER`، `CATALOG_FROM_PANEL`. (`PORTAL_URL`، و`CATALOG_FROM_PANEL`=1
  يجعل البناء يجلب الكتالوج من لوحة `bp-quotes` عبر الشبكة.) قيمها عامة وليست أسراراً؛ تُنسخ من
  Vercel إلى **GitHub Variables** (لا Secrets). **فحص التكافؤ بالجسم (`--body`) يكشف أي نسيان.**

### 1.3 دوال `api/` — ١١ دالة + ٥٠ ملفاً مساعداً

| الملف | سطور | ما يخدمه | يستدعي |
|---|---|---|---|
| `requests.js` | ٦٢٥٣ | **الحاوية الكبرى**: عبر `__route=` — `simple` (رحلة V1)، `suppliers`، `agencies`، `jobhunt`، `doc-agent`، `pr-intake`، `spaces`، `daftra-invoice`، تذاكر الدعم، EOR، العروض/العقود/الفاتورة | DB، Notion، Resend/ACS، Moyasar، Daftra، DocuSign، n8n، واتساب |
| `candidates.js` | ٢٣٦٦ | قاعدة المرشّحين وصفحة الوظائف وخلاصة XML (`/jobs-feed.xml`) | DB، Notion، Resend |
| `candidate.js` | ٢٠٠٣ | تقديم السيرة، backfill (cron)، استخراج السير | Notion، Azure OpenAI، n8n |
| `pay.js` | ١٥٠٠ | الدفع: Moyasar + Tamara + webhook + الفاتورة الضريبية | DB، Moyasar، Tamara، Daftra، Notion |
| `employer.js` | ٧٨٢ | لوحة صاحب العمل | DB، Notion، Resend |
| `chat.js` | ٧٧١ | المستشار الذكي (٦٠ث) | Azure OpenAI، n8n احتياطاً |
| `otp.js` | ٧٧٥ | الدخول بالرمز + Google Sign-In + الجلسات | DB، Resend/ACS |
| `hire.js` | ٧١٧ | مطابقة التوظيف | Notion، DB |
| `newsletter.js` | ٣٩٥ | النشرة (cron الأحد) | Notion، Resend |
| `book.js` | ٣٥٥ | حجز الاستشارات | Google Calendar، Notion، Resend، n8n |
| `workspace.js` | ٢٠٠ | مساحة العمل/اللوحة | Notion، Resend |

الملفات `_*.js` (٥٠ ملفاً، ٢١٬٢٥٣ سطراً) مساعِدات لا تُعدّ دوالاً: منها `_azure.js` و`_azblob.js`
و`_msgraph.js` و`_azpg.js` و`_azure_notify.js` (Azure جاهز)، و`_db.js`، و`_moyasar.js` و`_bnpl.js`
و`_daftra.js` و`_docusign.js` و`_nafath.js` و`_etimad.js`. تقرأ من القرص عند التشغيل:
`api/*.json`، و`../site/data/*.json`، و`../site/assets/data/*`، و`../lib/workshop-jds.js` — لذلك تحمل
الصورة `api/` و`lib/` و`site/`.

### 1.4 البيانات والتخزين

| الطبقة | اليوم | على Azure |
|---|---|---|
| **قاعدة البيانات** | **Supabase، المنطقة `ap-northeast-1` (طوكيو)** — تحققتُ من بيانات المشروع فقط، لا بيانات. جلسات Vercel للدوال تعمل من **`iad1` (شرق أمريكا)** (ترويسة `x-vercel-id`). فكل استعلام اليوم يقطع نحو نصف الكرة | مُشغّل **جاهز** `api/_azpg.js` (`DB_DRIVER=azure` + `AZURE_PG_URL`) + سكربت النسخ `db/copy-to-azure.mjs` + خطة تحويل من ٩ خطوات في `ops/azure/README.md` §5. **منفصل عن هذه الخطة** |
| ملفات العملاء | Azure Blob (جاهز) مع رجوع للقراءة من Supabase Storage عند 404 للملفات القديمة | كما هي |
| مجلدات العملاء | SharePoint عبر Graph | كما هي |
| بيانات تشغيلية كثيرة | **Notion** (٣٣ متغيّر قاعدة/صفحة) | كما هي — لا تتأثر بالاستضافة |
| الجلسات | جدول `user_sessions` (لا Supabase Auth) | تنتقل مع القاعدة |
| ملفات محلية | `.localdb/` للتطوير فقط | **الخادم يرفض الإقلاع في الإنتاج إن وجد `LOCAL_DB=1` أو `APP_ENV=development`** |

**نتيجة مهمة:** الاستضافة والقاعدة قراران مستقلان. الترتيب المقترح: **الاستضافة أولاً والقاعدة تبقى
على Supabase** (قطع يُرجَع عنه بتغيير DNS وحده لأن الحالة المشتركة واحدة)، ثم القاعدة لاحقاً بخطتها
الجاهزة. وبعد نقل القاعدة إلى UAE North تصير زمن الاستعلام ملّي ثوانٍ بدل ما يقارب ١٥٠ms+.

### 1.5 متغيّرات البيئة (٢٣٠ اسماً، ٦١ منها سرّاً)

الجرد الكامل مصنَّفاً في **الملحق (آخر الملف)** ومولَّد من الكود بـ`node ops/azure/env-scan.mjs --md`
(أسماء فقط، لا قيم). مجموعاتها: Notion ٣٣، Azure OpenAI ٢١، هوية الشركة والمالك ٢٠، واتساب ١٥،
Moyasar ١٣، أوضاع التشغيل ١٣، نفاذ ٩، Document Intelligence ٧، GitHub ٧، Azure PostgreSQL ٦، DocuSign ٦،
اعتماد ٦، Graph/SharePoint ٥، Blob ٥، n8n ٥، Daftra ٥، Resend ٥، ACS ٤، Tamara ٤، وغيرها.

قاعدة التوزيع في Azure:
- **السرّ** (`secret` في الجدول) → **Container Apps → Secrets** ثم يُشار إليه من متغيّر البيئة
  (`secretref:`)، وفي مرحلة لاحقة **Key Vault** بهوية مُدارة. لا يدخل الصورة ولا GitHub ولا المستودع.
- **العادي** → متغيّر بيئة عادي في التطبيق.
- **تُضاف جديدة لـAzure فقط:** `BP_ENV` (`production`|`preview`)، `BP_CANONICAL_HOST`،
  `BP_APEX_HOSTS`، `BP_TRUSTED_PROXY_HOPS`، `BP_FN_DEFAULT_TIMEOUT_S`، `BP_FRONT_DOOR_ID`،
  `BP_CRON_BASE` (للمهام)، `BP_BUILD_SHA` (تلقائي).
- **تُحذف بعد القطع:** `VERCEL`، `VERCEL_ENV`، وجرد `SUPABASE_*` بعد نقل القاعدة.
- **تُراجَع لأنها عناوين:** `MKT_SITE_BASE`، `SITE_BASE`، `SITE_ORIGIN`، `PORTAL_URL`،
  `QUOTES_PANEL_URL` — كلها تشير إلى `https://www.businesspartner.sa`، وتبقى كما هي لأن **النطاق لا
  يتغيّر**؛ تُغيَّر فقط إن اختُبر على نطاق مؤقت.

### 1.6 التكاملات الخارجية وعناوين الـwebhooks

لأن **النطاق نفسه لا يتغيّر** (`www.businesspartner.sa`)، لا يحتاج تكامل تغيير عنوانه بعد القطع.
الجدول للتحقق لا للتعديل — وما يحتاج فعلاً مراجعة أعلّمه ⚠:

| الخدمة | الاتجاه | العنوان/الارتباط | بعد القطع |
|---|---|---|---|
| **Moyasar** | وارد: webhook إلى `https://www.businesspartner.sa/api/pay` (السرّ `MOYASAR_WEBHOOK_SECRET`) | النطاق | لا تغيير. ⚠ **Apple Pay:** ملف `/.well-known/apple-developer-merchantid-domain-association` يجب أن يُخدَم بالمحتوى نفسه (يخدمه الخادم؛ يفحصه `parity`)، وقد تطلب Apple/Moyasar إعادة التحقق من النطاق — جرّب Apple Pay بعد القطع |
| Moyasar Samsung/Google Pay | مرتبط بالنطاق | `MOYASAR_SAMSUNG_SERVICE_ID` (النطاق = اسم الـcheckout) | لا تغيير |
| **Tamara** | صادر + عودة المتصفح `success/failure/cancel` تُبنى من `MKT_SITE_BASE` | النطاق | لا تغيير (لا webhook وارد؛ `verifyTamaraOrder` عند العودة) |
| **Daftra** | صادر | `DAFTRA_SUBDOMAIN` | لا تغيير. ⚠ تأكد أن الفاتورة لا تُقيَّد بعنوان IP |
| **DocuSign** | صادر + عودة المتصفح | `MKT_SITE_BASE` | لا تغيير. ⚠ `consentUrl` يستعمل redirect_uri = `…/admin`؛ يجب أن يبقى مسجَّلاً في DocuSign على النطاق نفسه |
| **Google Sign-In** | المتصفح | **Authorized JavaScript origins** في Google Cloud = `https://www.businesspartner.sa` (+ أي مضيف اختبار) | ⚠ **أضف مضيف staging** إن أردت اختبار الدخول بغوغل عليه |
| **Google Calendar** | صادر بحساب خدمة | — | لا تغيير |
| **Notion** | صادر | `api.notion.com` | لا تغيير |
| **n8n** (`businesspartnerai.app.n8n.cloud`) | صادر من الموقع (`website-lead-notify`، `bp-ats-application`، دردشة احتياطية) + **وارد** من n8n إلى `/api/doc-agent` (ترويسة `x-doc-agent-key`) و`DOC_AGENT_SYNC_URL` | النطاق | لا تغيير. ⚠ **`catalog-sync.workflow.js` يستدعي Vercel Deploy Hook** — استبدله (§1.1 رقم ١٥) |
| **Resend / ACS** | صادر | نطاق الإرسال (SPF/DKIM في DNS) | ⚠ **لا تُنقل خوادم الأسماء قبل نسخ كل السجلات** (هذا سبب توصيتي ببقاء DNS حيث هو، §8) |
| **واتساب Meta** | صادر عبر `WHATSAPP_*`؛ الوكيل نفسه في n8n/Logic App لا في الموقع | — | لا تغيير |
| **نفاذ (Elm)** / **اعتماد (Etimad)** | صادر إلى `nafath.api.elm.sa` و`sandboxapi.etimad.sa` | — | ⚠ **قد تشترط Elm/اعتماد قائمة IP ثابتة للمُرسِل.** Vercel لا يعطي IP ثابتاً، فالأرجح لا قيد قائم — **اسأل Elm/اعتماد قبل القطع**. إن وُجد قيد فعلى Container Apps بيئة VNet + NAT Gateway (نحو ٣٥ دولاراً/شهر إضافية) |
| **Azure OpenAI** | صادر | `AZURE_OPENAI_ENDPOINT*` | لا تغيير؛ خدمة في المنطقة نفسها أقرب |
| **bp-quotes** | صادر (وكيل) | `bp-quotes-three.vercel.app` | يبقى — §7 مخاطرة ٢ |
| **GitHub** (مزامنة محتوى `CONTENT_*`) | صادر | `api.github.com` | لا تغيير |

ملاحظات: ملفا `robots.txt` و`sitemap.xml` يشيران إلى الأبكس (`https://businesspartner.sa/sitemap.xml`)
وهو يحوّل 308 إلى www — لا مشكلة. ملف `sw.js` لا يخزّن شيئاً (fetch فارغ). ملف الكوكي `Domain=.businesspartner.sa`
مرتبط بالنطاق لا بالمضيف فتبقى الجلسات صالحة عبر القطع.

### 1.7 DNS اليوم (ما أمكن رؤيته علناً)

`businesspartner.sa` و`www.businesspartner.sa` سجلّا **A** إلى عناوين Vercel (`216.198.79.1` و`64.29.17.1`)،
لا CNAME. `ai.businesspartner.sa` سجلّ A إلى `135.225.115.159` (نطاق Microsoft — خادم المساحات، خارج هذا
النقل). `hr.businesspartner.sa` لا يُحَلّ. **لم يظهر لي من يستضيف خوادم الأسماء ولا سجلّات MX/TXT**
(المحلِّل المتاح لي لا يعيدها) — **لا يُفترض شيء هنا**؛ يؤكده المالك في §10.

---

## 2) مقارنة الخيارات والاختيار

| المعيار | **Static Web Apps** + Functions | **Functions (Flex)** + Blob static + Front Door | **App Service** (Linux) + Front Door | **Container Apps** + Front Door ⟵ المختار |
|---|---|---|---|---|
| مهلة `chat`/`requests`/`candidate` ٦٠ث | ❌ سقف **٤٥ث** للـAPI (موثّق) | ✅ (٢٣٠ث للـHTTP) | ✅ (٢٣٠ث) | ✅ (**٢٤٠ث** سقف المدخل) |
| ٤٠ تحويلاً بصيغة `:lang(a\|b)` + `has host` + وكيل خارجي | ❌ ملف ≤ **٢٠KB**، wildcard في الآخر فقط، لا مضيف ولا وكيل خارجي | ⚠ قواعد Front Door تُكتب يدوياً (عشرات القواعد بشروط regex، ولا صيغة `:lang`) | ✅ بمحرّك التوجيه نفسه | ✅ بمحرّك التوجيه نفسه |
| تشغيل `api/*.js` كما هي (`(req,res)`) | ❌ نموذج Functions الجديد (غلاف + مخاطرة) | ⚠ غلاف لكل دالة | ✅ | ✅ |
| ١٤٩٠ صفحة / ٨٤MB | ✅ (٢٥٠MB، ١٥٠٠٠ ملف) | ✅ | ✅ | ✅ |
| cron | ❌ لا (يحتاج Logic App/Function ثاني) | ✅ timer | ⚠ WebJobs/Logic App | ✅ **Jobs بجدول cron** |
| Rollback لحظي | ⚠ | ⚠ | ✅ slots | ✅ **مراجعات + وزن الحركة** |
| سقف التشغيل | ✅ | ✅ | ✅ | ✅ (تحتاج ACR) |
| تعقيد للمالك | منخفض | مرتفع | متوسط | متوسط |
| تكلفة شهرية تقريبية (تقدير خشن) | ~٠–٩ | ~٣٠–٥٠ + FD | ~٧٥–١٥٠ (P1v3) + FD | ~٤٥–٦٠ + FD |

القاتل لـSWA هو التوجيه والمهلة، لا الحجم. App Service بديل سليم (أبسط منطقياً: «نشر كود» بلا
صور) لكن أغلى ببدء ثابت ولا يملك Jobs ولا مراجعات بوزن حركة؛ وFunctions يفرض إعادة كتابة النموذج.
Container Apps يشغّل **الكود الحالي حرفاً** بأقل فرق، ويعطي الرجوع بثوانٍ.

**لماذا Front Door أمامه:** (١) **تحقق من النطاق قبل تحويل الحركة** (سجل TXT `_dnsauth.www` ثم CNAME)
فتُصدر الشهادة قبل القطع — بدونها يحتاج Container Apps أن يشير DNS إليه *قبل* أن يُصدر الشهادة، أي
نافذة بلا شهادة، وHSTS محفوظ في المتصفحات سنتين فلا مجال لأي نافذة (٢) ضغط وتخزين مؤقت قرب
المستخدم (المنشأ في دبي) (٣) WAF ومجالٌ لقواعد الحماية (٤) نقطة واحدة للنطاق. ثمنه ٣٥ دولاراً
أساساً. **يمكن البدء بلا Front Door** (CNAME مباشر إلى Container Apps) إن قبل المالك نافذة شهادة
قصيرة عند القطع — لكني لا أنصح به.

---

## 3) المنطقة وأثرها على البيانات

- **لا منطقة في السعودية متاحة للنشر اليوم.** ما قرأتُه في توثيق Microsoft: منطقة السعودية (المنطقة
  الشرقية) مبنيّة وتنتظر الإتاحة «في 2026»؛ ملاحظة نوشن المذكورة في `ops/azure/README.md` تقول
  نوفمبر 2026. **تحقّق من قائمة المناطق في بوابتك يوم الإنشاء.**
- **الأقرب: UAE North (دبي)** — ٣ مناطق توافر، وهي حيث تتوفر كل خدماتنا: Container Apps، Azure
  OpenAI (Global Standard)، PostgreSQL Flexible، Document Intelligence، Front Door. ثم **Qatar Central
  (الدوحة)** أقرب جغرافياً للرياض لكن خدماتها أقل (تحقق من Container Apps وOpenAI فيها قبل اختيارها).
- **الأثر على البيانات:** بيانات العملاء اليوم أصلاً خارج المملكة (Supabase في طوكيو، ودوال Vercel في
  أمريكا). النقل إلى دبي **لا يُسوّئ** الوضع القانوني ويُحسّن الزمن. إن كانت بيانات حكومية/حسّاسة
  تتطلّب البقاء في المملكة فالإجراء: **كل شيء في منطقة واحدة اليوم، ثم ننقل الصورة والقاعدة إلى
  منطقة السعودية عند إتاحتها** (الصورة تُنشر من ACR حيث نريد؛ القاعدة بسكربت النسخ نفسه).
  قرار PDPL القانوني للمالك والمستشار القانوني.
- ضع **كل الموارد الجديدة في منطقة واحدة** (Container Apps، ACR، Front Door يتصل بها، PostgreSQL،
  Blob) لتجنّب رسوم نقل وزمن بين المناطق. موارد Azure OpenAI الحالية تبقى حيث هي.

---

## 4) التكلفة التقريبية (شهرياً، دولار)

أسعار التجزئة العامة من واجهة Azure الرسمية يوم 2026-10-11 (UAE North). **تقدير لا فاتورة** — أعد
الحساب في Azure Pricing Calculator بعدد الزيارات الفعلي.

| البند | الافتراض | تقريبي |
|---|---|---|
| Container Apps (Consumption) | نسختان دائمتان، ١ vCPU + ٢GiB لكل واحدة، فاعلتان ١٠٪ من الوقت. vCPU فاعل ٠.٠٠٠٠٢٤/ث وخامل ٠.٠٠٠٠٠٣، الذاكرة ٠.٠٠٠٠٠٣/GiB·ث، الطلبات ٠.٤/مليون، **وفيها منح مجانية شهرية** | **٤٥–٦٠** (نسخة واحدة ≈ ٢٥–٣٠) |
| Container Apps Jobs (٣) | ثوانٍ في الأسبوع | < ١ |
| Front Door Standard | رسم ثابت ٣٥ + نقل بيانات (نحو ٧٥GB) + طلبات | **٥٠–٧٠** |
| Container Registry (Basic) | ٠.١٦٦/يوم + ٢GB | ٥ |
| Log Analytics | ٢–٥GB سجلات ×٣.٢٩ (ضع سقفاً يومياً) | ٨–١٦ |
| Key Vault (اختياري لاحقاً) | عمليات قليلة | < ١ |
| **المجموع (موصى به)** | | **≈ ١٠٠–١٧٠** |
| **أدنى (بلا Front Door، نسخة واحدة)** | | ≈ ٤٠–٥٠ |

لا يدخل: PostgreSQL المُدار (تقدير منفصل مع خطة القاعدة)، Blob، Azure OpenAI، ACS/SharePoint (قائمة أصلاً
أو مخططة). **بيئة Container Apps تُنشأ بملف «Consumption» وحده** (Workload profiles مع ملف Consumption فقط، أو «Consumption only» إن عرضتها
البوابة): ملفات «Dedicated» تضيف رسماً بالساعة ولا حاجة لها. مقابل Vercel: لا أعرف فاتورتك الحالية؛
مكسب الاستقرار (لا سقف مئة نشرة، لا سقف ١٢ دالة، لا مخزون ٩٥GB) غير مسعَّر.

---

## 5) البناء والصورة

- الصورة **تبني الموقع بنفسها** (`npm run build` الكامل بحارسيه) ثم تنسخ `api/` و`lib/` و`site/` و`vercel.json`
  و`ops/azure/` فقط. تشغّل بمستخدم `node` (لا جذر). `HEALTHCHECK` على `/__health`.
- `ENV VERCEL=1` في مرحلة البناء حصراً: يمنع `hidden.mjs` من إعادة كتابة `vercel.json` أثناء البناء
  (ناتجه يُلتزَم محلياً). هذا المتغيّر هو الأثر الوحيد لاسم Vercel في الصورة.
- بناء من غير Docker محلي: `az acr build` (يعمل في سحابة ACR) — هذا ما يفعله الـworkflow.
- **لم أستطع بناء الصورة هنا** (لا خدمة Docker في هذه البيئة). تحقّقتُ من أن **سياق الصورة المصغَّر**
  (`package*.json` + `api` + `lib` + `n8n` + `site` + `vercel.json` + `ops`) يبني `npm run build` كاملاً
  بنجاح (١٤٩٠ صفحة). أول بناء فعلي للصورة سيجري في ACR عند أول تشغيل للـworkflow.

---

## 6) ما بُني في هذه الدفعة (كله محلي، لا يُنشَر شيء)

| الملف | الوظيفة |
|---|---|
| `ops/azure/routing.mjs` | مترجم `vercel.json`: مصادر path-to-regexp (`:name`، `:name(a\|b)`، `(a\|b)`، `:path*`)، redirects/rewrites/headers/`has`/`functions`/`crons`. **يرمي خطأً صريحاً لصيغة لا يفهمها** |
| `ops/azure/server.mjs` | خادم الإنتاج: الترتيب المطابق لـVercel (§0)، ضغط br/gzip مع ETag/304، رؤوس Vercel الافتراضية، وكيل عكسي بلا متابعة تحويلات، مهلة لكل دالة، سجلّ بلا استعلام ولا IP، `/__health`، إغلاق لطيف عند SIGTERM، رفض الإقلاع على إعدادات تطوير في الإنتاج، قفل Front Door اختياري (`BP_FRONT_DOOR_ID`) |
| `ops/azure/vercel-compat.mjs` | **غلاف الدوال بدل «محوّل Azure Functions»**: `req.query/cookies/body`، `res.status/json/send/redirect`، سقف ٤.٥MB، **إعادة تقديم الجسم في stream** (دوال كثيرة تنتظر `req.on("end")` احتياطاً)، تطبيع `X-Forwarded-For`، حذف `x-vercel-*` المنتحَلة. لا سطر في `api/` تغيّر |
| `ops/azure/cron.mjs` | جدول المهام من `vercel.json`؛ `--list` و`--dry-run` والتشغيل بـ`Bearer $CRON_SECRET` |
| `ops/azure/parity.mjs` | **فاحص التكافؤ** (§6.1) |
| `ops/azure/env-scan.mjs` | جرد المتغيّرات (مصدر الملحق) |
| `ops/azure/Dockerfile` + `Dockerfile.dockerignore` | الصورة (§5) |
| `.github/workflows/azure-deploy.yml` | **معطّل بالافتراض بثلاث طبقات** (§8.5). *ملف خارج قائمة ملكيتي المكتوبة، أُنشئ لأن المهمة طلبته صراحةً* |
| `package.json` | ثلاثة سكربتات فقط: `azure:serve`، `azure:parity`، `azure:cron`. **سلسلة `build` لم تُمسّ** |
| `tests/azure-{routing,server,compat,parity,hosting}.test.mjs` | ٥٨ اختباراً |

**لماذا لا ملف `staticwebapp.config.json`؟** لأنه لا يستطيع التعبير عن إعدادنا (§2)، ولأن نسخةً ثانية
مولَّدة من `vercel.json` تتقادم. المحرّك يقرأ المصدر نفسه، **واختبار التكافؤ يفشل** إن أضاف أحدهم
صيغة لا يفهمها أو أصلاً خارجياً جديداً.

**وبدلاً من «محوّل Azure Functions»:** لا حاجة. الحاوية تشغّل الدوال بواجهتها الأصلية؛ لو اخترنا
Functions يوماً فالغلاف نفسه (`vercel-compat.mjs`) يُستعمل داخل مُشغِّل HTTP في نحو ٦٠ سطراً.

### 6.1 فاحص التكافؤ

```
node ops/azure/parity.mjs --a https://www.businesspartner.sa --b https://<مراجعة-azure>   # قبل القطع
node ops/azure/parity.mjs --a https://www.businesspartner.sa --b https://www.businesspartner.sa --resolve-b <IP حافة Front Door>
node ops/azure/parity.mjs --list                  # الفحوص بلا شبكة
خيارات: --body  --strict-body  --apex  --skip-api  --sample N  --json
```
يفحص بـGET فقط: كل redirect (عيّنة مولَّدة من مصدره، مع استعلام) والوجهة والحالة، كل rewrite، `cleanUrls`
والشرطة الأخيرة وحالة الأحرف و404، عيّنة صفحات (الحالة والنوع والتخزين المؤقت وبصمة الجسم)،
`/assets/` ← `immutable`، ملف Apple Pay، `robots.txt`، شكل JSON لـ`/api/otp` و`/api/pay` و`/api/simple`
(مفاتيح لا قيم)، وإغلاق `/scripts/` (اختلاف **متوقّع**). الخروج ١ عند أي فشل.

**نتيجة التحقق المقابل للحيّ اليوم** (خادم Azure محلي مقابل `www.businesspartner.sa`، ١١١ فحصاً): **كل
التحويلات والـrewrites والعناوين والصفحات متطابقة**؛ الاختلافات الخمس الوحيدة كانت من أسرار
غير موجودة محلياً (Notion/DB تعطي ٥٠٣ بدل ٢٠٠، ووضع الدفع المحاكى يغيّر مفاتيح `/api/pay`) — أي
تتبخّر مع الأسرار في Azure. وأجسام الصفحات تختلف بنحو ١٠KB لأن فرع التكامل أحدث من الحيّ (طبيعي).

---

## 7) المخاطر الأكبر

1. **مجدولان معاً.** `newsletter` يرسل بريداً لقائمة المشتركين. لو بقي Vercel Cron فعّالاً وجرت مهمة
   Azure فسيصل مرتين. **الإجراء:** مهام Azure تُنشأ **معطّلة**؛ يوم القطع: تعطيل Cron في Vercel
   (Settings → Cron Jobs → Disable) *ثم* تفعيل مهام Azure؛ وعند الرجوع العكس. الأمان الثاني: هذه
   المهام idempotent جزئياً فقط (`backfill`) — النشرة ليست.
2. **تبعية باقية على Vercel: `bp-quotes`.** `/quotes/*` و`/api/live-catalog` وروابط العقود
   `/quotes/d/<token>` المرسلة للعملاء تمرّ عبر وكيل إلى `bp-quotes-three.vercel.app`. حذف ذلك المشروع
   (المخطط في `docs/quotes-cutover.md`) قبل نقل `quotes/` يكسر العروض والعقود والفواتير. «Vercel
   صفر» ليس هدف هذه الدفعة. الوكيل زاد قفزة شبكية (دبي ← أمريكا ← قاعدة `bp-quotes`).
3. **من دوال معزولة إلى عملية طويلة العمر** — لا يظهر بالاختبار المحلي:
   - تسريب ذاكرة بطيء/ذاكرة مشتركة بين الطلبات (متغيّرات على مستوى الوحدة في `requests.js` ٦٠٠٠ سطر)؛
   - رفض Promise غير معالَج كان يقتل استدعاءً واحداً في Vercel ويقتل **الخدمة كلها** هنا → الخادم
     يسجّله ولا يسقط (تقرير في `/__health.errors`)؛
   - مهام «أطلق وانسَ» التي كان Vercel يجمّدها بعد الرد ستُكمل الآن (أفضل غالباً، لكنها تغيّر التوقيت)؛
   - اتصالات القاعدة: بعد تحويل القاعدة لـAzure PG ارفع `AZURE_PG_POOL_MAX` (افتراضيه ٢ مصمَّم
     لـserverless) إلى ٨–١٠ لكل نسخة وراقب سقف الاتصالات؛
   - حدّ الرد: لا مهلة افتراضية على Vercel لما لا يذكره `vercel.json` غير خطة المشروع؛ الخادم يضع
     **٣٠ث** (`BP_FN_DEFAULT_TIMEOUT_S`). **راجع أطول استدعاء فعلي** قبل القطع.

مخاطر أصغر: IP ثابت لنفاذ/اعتماد (§1.6)؛ إعادة تحقق Apple Pay؛ سلوك `has host` للـ`hr.` (§12)؛ تعارض
`Content-Length` مع ضغط من Front Door (يُختبر في `parity`)؛ سقف `candidates` ٣٠٠ث المعلَن
غير المعمول به؛ تكلفة سجلات Log Analytics بلا سقف يومي.

---

## 8) خطة القطع بلا انقطاع، والرجوع

**مبدأ يجعله آمناً:** الحالة المشتركة (القاعدة، Notion، Blob) **لا تتحرك** في هذه الخطة. الموقعان
القديم والجديد يقرآن ويكتبان المصدر نفسه، فالقطع = تغيير DNS وحده، والرجوع = تغييره ثانيةً، ولا
بيانات تُصالَح. القاعدة تنتقل لاحقاً بخطتها.

### 8.1 قبل القطع بأسبوعين → يوم (لا أثر على الزوار)

1. المالك: يصدّر **كل سجلات DNS** الحالية (ملفاً أو لقطات) ويحفظها — هي مفتاح الرجوع.
2. المالك: ينشئ الموارد (§9) ويضع الأسرار.
3. أنا/المالك: نشر على **staging** (`BP_ENV=preview`) و`parity --skip-api` ثم إلى **production** على عنوانه
   الافتراضي `*.azurecontainerapps.io` (أو عنوان مراجعة) و`parity` كامل مع `--body`.
4. Front Door: إضافة النطاق `www.businesspartner.sa` بشهادة Azure المُدارة، وإضافة سجل
   **TXT** `_dnsauth.www` في DNS (لا يغيّر الحركة). تنتظر حالة التحقق «Approved».
5. اختبار بالاسم الحقيقي *قبل* الحركة: `parity --a https://www.businesspartner.sa --b https://www.businesspartner.sa --resolve-b <IP حافة FD>`
   (أو `curl --resolve`). كل شيء متطابق.
6. **قبل القطع بـ٤٨ ساعة على الأقل:** خفض TTL لسجلات `www` والأبكس إلى **٣٠٠ ثانية**.
7. مهام Azure الثلاث موجودة **ومعطّلة**. `CRON_SECRET` موضوع.
8. اختيار الموعد: صباح جمعة (حركة أقل)، ومالك متاح، ولا نشرة بريدية وشيكة (ليس الأحد ٠٦:٠٠ UTC).

### 8.2 القطع (نحو ٣٠ دقيقة عمل، والحركة تنتقل خلال دقائق)

1. تجميد النشر على Vercel: **لا كوميت بعلامة نشر، لا إعادة نشر** حتى انتهاء النافذة (الموقع القديم
   يبقى الهدف الاحتياطي كما هو).
2. المالك: تعطيل **Cron في Vercel**، ثم تفعيل **مهام Azure** (`--dry-run` أولاً من سجل المهمة).
3. المالك: تغيير سجلّ `www` من A (Vercel) إلى **CNAME → نقطة Front Door**. (احتفظ بالقيمة القديمة.)
4. أنا: `parity --a <المرجع المحفوظ لقطةً> --b https://www.businesspartner.sa` بعد الانتشار، ومراقبة:
   `/__health.errors`، سجلات Container Apps، حالة `/api/otp` (`dbReachable`)، دخول بالرمز بحساب المالك،
   وطلب اختبار واحد في `/my`. **ودفعة اختبارية حقيقية صغيرة** إن وافق المالك (Moyasar/Apple Pay).
5. **الأبكس:** سجلّ A إلى **عنوان بيئة Container Apps الثابت** (لا Front Door) — الخادم يحوّله 308 إلى www.
   الشهادة تُصدَر بعد أن يشير السجل (نافذة من دقائق لمن يكتب الأبكس وحده؛ أقل أثراً من www). ملاحظة: Vercel أرسل HSTS على الأبكس أيضاً، فمن زاره من قبل يُمنَع من الدخول خلال النافذة — فاخترها بعد منتصف الليل. خياران آخران
   إن كان مزوّد DNS يدعم ALIAS/CNAME flattening: ألحقه بنقطة Front Door (تحقق TXT مسبق، بلا نافذة)،
   أو انقل DNS إلى Azure DNS **(لا أنصح بنقل خوادم الأسماء: يخسر MX/SPF/DKIM إن نُسي سجل)**.

### 8.3 بعد القطع

- ٢٤ ساعة: مراقبة، Vercel حيّ ولا حركة عليه (يبقى هو الرجوع).
- ٧ أيام: إن استقر كل شيء → إزالة النطاق من مشروع Vercel (لا حذف المشروع). حذف مشاريع Vercel قرار
  المالك المنفصل ويُنفَّذ من لوحته.
- بعدها: تحويل القاعدة (README §5)، ثم رفع `AZURE_PG_POOL_MAX`.

### 8.4 الرجوع إلى Vercel (rollback)

متى: خطأ ٥xx متزايد، دفع لا يكتمل، أو أي شك يقرّره المالك. كيف (≈ ٥–١٠ دقائق):
1. أعد سجلّ `www` (والأبكس) إلى قيمهما المحفوظة (A إلى Vercel). TTL ٣٠٠ث.
2. أعد تفعيل **Cron في Vercel** وعطّل مهام Azure (بهذا الترتيب).
3. لا بيانات تُصالَح (الحالة مشتركة). لا شيء يُحذف في Azure — الموارد تبقى للتشخيص.
حتى هذه اللحظة لم يُحذف ولم يُغيَّر شيء في Vercel، فهو جاهز.

داخل Azure نفسه: كل نشرة = **مراجعة جديدة بوزن صفر** تُفحص على عنوانها ثم يُنقل إليها الوزن؛
والرجوع لنشرة سابقة = إعادة الوزن للمراجعة السابقة (ثوانٍ) دون إعادة بناء.

### 8.5 أمان الـworkflow (لا نشر عرضي)

`azure-deploy.yml`: ١) `workflow_dispatch` فقط (لا push ولا جدولة) ٢) كل مهمة `if: vars.AZURE_DEPLOY_ENABLED == 'true'`
والمتغيّر غير موجود الآن ٣) بيئة GitHub `production` تشترط موافقتك. لا أسرار فيه: دخول Azure بـOIDC،
وكل قيمة `vars.*` عامة. لا يلمس Vercel ولا DNS. **النشر لا يستعمل علامة الكوميت أبداً**، فقاعدة
«لا نشر بلا إذن المالك» (`CLAUDE.md` §0) محفوظة بآلية أصلب: لا يحدث شيء إلا بضغطة زر منك.

---

## 9) ما يفعله المالك في بوابة Azure (بالترتيب)

كل خطوة قصيرة. **لا ترسل لي أسراراً ولا مفاتيح**؛ تُلصق مباشرة في Azure. أسماء الموارد اقتراح.

**أ) الأساس**
1. ادخل https://portal.azure.com بالاشتراك الذي فيه `bp-ai-server` وAzure OpenAI. تأكد أنك **Owner**.
2. أنشئ **Resource group** باسم `rg-bp-web` — المنطقة **UAE North**.
3. أنشئ **Log Analytics workspace** باسم `log-bp-web` (نفس المنطقة). بعد إنشائه: Usage and estimated costs ←
   **Daily cap** ضع ١ GB.
4. أنشئ **Container Registry**: الاسم `bpwebacr` + رقم عشوائي (فريد عالمياً)، SKU **Basic**.

**ب) التطبيق**
5. أنشئ **Container App** `bp-site`: Environment جديد في `log-bp-web` بملف **Consumption** وحده (لا تضف ملفات Dedicated).
   صورة مؤقتة: `mcr.microsoft.com/k8se/quickstart:latest` (نستبدلها بصورتنا). Ingress: **Enabled، Accepting
   traffic from anywhere، HTTP، Target port 8080**.
6. من Containers: CPU **1**، Memory **2Gi**. Scale: Min **2**، Max **6**، قاعدة HTTP concurrent requests **80**.
   Health probes: Startup + Liveness + Readiness على **`/__health`** (HTTP، المنفذ 8080).
7. Revision management ← **Multiple** (ضروري للرجوع الفوري). بعد أول مراجعة سليمة: Ingress ← Traffic ← اجعل 100% على **اسم المراجعة** (لا على «latest»)، وإلا انتقلت كل نشرة جديدة للحركة تلقائياً.
8. **Secrets:** افتح Vercel → المشروع → Settings → Environment Variables → Production. لكل متغيّر
   «سرّ» في الملحق انسخ القيمة إلى Container App ← Settings ← Secrets، ثم أضف متغير بيئة بنفس الاسم من نوع
   «Reference a secret». المتغيّرات العادية تُضاف كمتغيّر بيئة عادي. أضف أيضاً: `BP_ENV=production`،
   `MKT_SITE_BASE=https://www.businesspartner.sa`، `BP_TRUSTED_PROXY_HOPS=2` (بعد Front Door).
   **لا تضف `VERCEL_ENV`.** ابدأ بـ`DB_DRIVER` غير موجود (Supabase).
9. أنشئ **ثلاث Container App Jobs** (`bp-cron-0-newsletter`، `bp-cron-1-requests-jobhunt`، `bp-cron-2-candidate-backfill`):
   Trigger **Schedule**، الجدول من `node ops/azure/cron.mjs --list` (UTC)، الصورة نفسها (بعد أول نشر)،
   الأمر `node ops/azure/cron.mjs <0|1|2>`، متغيّر `CRON_SECRET` (سرّ) و`BP_CRON_BASE=https://www.businesspartner.sa`.
   **اتركها Disabled** حتى يوم القطع.

**ج) ربط GitHub (بلا كلمة سر)**
10. Microsoft Entra ID ← App registrations ← **New** باسم `bp-github-deploy`. افتحه ← Certificates & secrets ←
    **Federated credentials** ← Add ← «GitHub Actions deploying Azure resources»: المنظمة `businessKSA`،
    المستودع `business-partner-sa`، Entity: **Environment** = `production` (ثم أخرى = `staging`).
11. على `rg-bp-web`: Access control (IAM) ← امنح التطبيق دور **Contributor**؛ وعلى سجل ACR دور **AcrPush**.
12. في GitHub → المستودع → Settings → **Environments**: أنشئ `staging` و`production`؛ في `production` فعّل
    **Required reviewers** (أنت). Settings → Secrets and variables → Actions → **Variables** أضف:
    `AZURE_CLIENT_ID`، `AZURE_TENANT_ID`، `AZURE_SUBSCRIPTION_ID`، `AZURE_RESOURCE_GROUP=rg-bp-web`،
    `AZURE_ACR_NAME`، ومتغيّرات البناء العامة (`GOOGLE_CLIENT_ID`،
    `PORTAL_URL`، `COMPANY_*` … من Vercel). وفي **كل بيئة** (`staging` ثم `production`) أضف متغيّر البيئة `AZURE_CONTAINERAPP_NAME` (`bp-site-staging` / `bp-site`) كي لا ينشر staging فوق الإنتاج.
    **آخر شيء:** `AZURE_DEPLOY_ENABLED=true` (قبلها الـworkflow خامل).

**د) Front Door والنطاق**
13. أنشئ **Front Door and CDN profiles** ← **Azure Front Door**، SKU **Standard**، باسم `afd-bp`، Endpoint `bp`.
    Origin group: Origin type **Container Apps** → `bp-site`، Host header = عنوان التطبيق، Health probe path `/__health`.
    Route: Patterns `/*`، Redirect HTTP→HTTPS، **Caching مفعّل مع ضغط**، Query string behaviour
    **Use query string** — *لا تفعّل التخزين المؤقت على `/api/*`* (أنشئ route ثانياً `/api/*` بتخزين مؤقت معطّل).
14. Domains ← **Add** `www.businesspartner.sa` ← **Azure managed certificate**، DNS: «another DNS provider».
    أضف سجل **TXT** `_dnsauth.www` الذي يعرضه Azure في DNS الحالي *الآن* (لا يغيّر الحركة). انتظر «Approved».
    **توقّف هنا.** القطع (تغيير CNAME) لا يتم إلا مع Claude/الفريق وفق §8.
15. بعد القطع: انسخ **Front Door ID** (Overview) إلى متغيّر `BP_FRONT_DOOR_ID` في التطبيق ليُقفل المنفذ المباشر.

**هـ) اختبار الإقلاع**
16. `https://<عنوان-التطبيق>/__health` يعيد `{"ok":true,...}`. ثم أخبرني لأشغّل `parity` عليه.

---

## 10) ما أحتاجه منك (أجب فقط، بلا أسرار)

1. **رقم الاشتراك** (Subscription ID — ليس سراً) واسم المستأجر، وهل `bp-ai-server` وAzure OpenAI في الاشتراك نفسه؟
2. **المنطقة:** أوافق على **UAE North**؟ (البديل Qatar Central — أتحقق من خدماتها أولاً.)
3. **من يستضيف DNS لـ`businesspartner.sa` اليوم؟** (مسجّل النطاق، Vercel DNS، Cloudflare…) ومن يستطيع تعديله.
   وصدّر **كل السجلات** (MX وTXT وCAA وDKIM) قبل أي تغيير.
4. **Front Door نعم/لا؟** (توصيتي نعم: ٣٥ دولاراً + استخدام، مقابل صفر نافذة شهادة وضغط وحماية.)
5. أيّ **أسماء** تفضّلها للموارد؟ (الاقتراحات في §9.)
6. هل **لدى نفاذ/اعتماد قائمة IP مسموحة** لخادمنا؟ (اسأل Elm/اعتماد: يغيّر قرار شبكة Container Apps.)
7. **التوقيت:** أي جمعة؟ وهل توافق على دفعة اختبار حقيقية صغيرة بعد القطع؟
8. هل **أبقي `bp-quotes` على Vercel** مؤقتاً (توصيتي نعم) أم تريد تقديم نقله؟
9. موافقتك أن **تُعدَّل `CLAUDE.md`** (§11) بعد هذه الخطة.
10. **سقف ميزانية شهرية** مقبول للاستضافة؟

---

## 11) ما يتغيّر في `CLAUDE.md` بعد قرارك (للمدير — لا أعدّله أنا)

- §0 «لا ينشر إلا بإذن المالك»: يبقى. على Azure لا علامة كوميت؛ الإذن = ضغط **Run workflow** + موافقة بيئة `production`.
- §1 «هدف واحد للنشر: Vercel»: يُستبدل بـ«هدف واحد: Azure Container Apps `bp-site`»، ويبقى مشروع
  Vercel الرئيسي *احتياطاً للرجوع* ثم يُحذف بقرارك، و`bp-quotes` حتى النقل.
- فقرة «فرع العمل هو الإنتاج في Vercel / `ignoreCommand` / العلامة `deploy-preview-please`»: تبقى صالحة
  *ما دام Vercel الهدف*؛ بعد القطع لا أثر لها على Azure، وتُؤرشف.
- §3 البناء: حارس الـ١٢ دالة يبقى حتى يُغلق Vercel؛ ثم يُستبدل بحدّ منطقي أو يُحذف بقرار.
- إضافة خلاصة: «سلسلة النشر إلى Azure: `.github/workflows/azure-deploy.yml`، يدوي، موافقة المالك».
- `docs/projects.md`: صفّ للمنصة: «Azure hosting: `ops/azure/**`».
- `vercel.json` يبقى **مصدر الحقيقة للتوجيه** (يقرأه خادم Azure). إعادة تسميته مهمة لاحقة (تمس `hidden.mjs`
  و`tests/hidden.test.mjs` و`devserver.mjs`).

---

## 12) مفتوح / غير محلول (صراحةً)

1. **ترتيب `rewrites` ذات `has: host`:** في Vercel لا أعرف يقيناً هل تسبق الملفات الثابتة. اخترتُ أن
   تسبقها (قصد كاتبها واضح)، لكن `hr.businesspartner.sa` لا يُحَلّ اليوم فلا يمكن اختبار الحيّ. إن أُحيي
   النطاق يُختبر قبل الاعتماد.
2. **لم يُبنَ Dockerfile ولم يُشغَّل الـworkflow** (لا Docker/Azure هنا). يُختبران في أول تشغيل على staging.
3. **`az` أوامر الـworkflow** (`revision list/show`, `ingress traffic set`) مكتوبة من التوثيق ولم تُنفَّذ.
4. **الأسعار** أسعار تجزئة عامة، ليست عرضاً تعاقدياً.
5. **مواقع حدود الاتصال بقاعدة Supabase** من حاوية دبي (طوكيو ~ نفس الزمن الحالي من أمريكا): غير مقاسة.
6. **`candidates.js`** يعلن ٣٠٠ث؛ إن لزم فعلاً أكثر من ٦٠ فهذا قرار `recruitment`، والسقف هنا ٢٤٠.
7. **PDPL/الإقامة** قرار قانوني للمالك (§3).
8. **كسر الأمان الذي كشفه الجرد** وخارج نطاقي: `/scripts/*.mjs` عامة على Vercel اليوم؛ ومقارنة `Bearer` في
   `newsletter.js`/`candidate.js`/`_jobhunt.js` بـ`===` غير ثابتة الزمن (ملاحظة لمالكيها).

---

## الملحق: متغيّرات البيئة التي يقرؤها الكود (أسماء فقط) مصنَّفة بحسب الخدمة

> مولَّد بـ`node ops/azure/env-scan.mjs --md` يوم 2026-10-11. «سرّ» = يذهب إلى Container Apps Secrets.
> مسحٌ نصي للكود (قد يفوته اسم يُركَّب ديناميكياً). أعد توليده عند إضافة متغيّر جديد.

**Azure Blob Storage** (5)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `AZURE_STORAGE_ACCOUNT` | عادي | _azblob.js |
| `AZURE_STORAGE_ACCOUNT_KEY` | سرّ | _azblob.js |
| `AZURE_STORAGE_CONTAINER` | عادي | _azblob.js |
| `AZURE_STORAGE_KEY` | سرّ | _azblob.js |
| `AZURE_STORAGE_SUFFIX` | عادي | _azblob.js |

**Azure Communication Services (بريد)** (4)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `ACS_CONNECTION_STRING` | سرّ | _azure_notify.js |
| `ACS_SENDER_ADDRESS` | عادي | _azure_notify.js |
| `AZURE_ACS_SENDER` | عادي | _azure_notify.js |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | سرّ | _azure_notify.js |

**Azure Database for PostgreSQL** (6)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `AZURE_PG_POOL_MAX` | عادي | _azpg.js |
| `AZURE_PG_SSL` | عادي | _azpg.js، db/copy-to-azure.mjs |
| `AZURE_PG_SSL_REJECT_UNAUTHORIZED` | عادي | _azpg.js، db/copy-to-azure.mjs |
| `AZURE_PG_URL` | سرّ | _azpg.js، db/copy-to-azure.mjs |
| `AZURE_POSTGRES_URL` | سرّ | _azpg.js |
| `DB_DRIVER` | عادي | _db.js، requests.js |

**Azure Document Intelligence** (7)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `AZURE_DOCINTEL_API_KEY` | سرّ | _docread.js |
| `AZURE_DOCINTEL_API_VERSION` | عادي | _docread.js |
| `AZURE_DOCINTEL_ENDPOINT` | عادي | _docread.js |
| `AZURE_DOCINTEL_KEY` | سرّ | _docread.js |
| `AZURE_DOCINTEL_MODEL` | عادي | _docread.js |
| `AZURE_FORMRECOGNIZER_ENDPOINT` | عادي | _docread.js |
| `AZURE_FORMRECOGNIZER_KEY` | سرّ | _docread.js |

**Azure OpenAI** (21)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `AZURE_AI_ENDPOINT` | عادي | _azure.js، _docread.js |
| `AZURE_AI_ENDPOINT_2` | عادي | _azure.js |
| `AZURE_AI_KEY` | سرّ | _azure.js، _docread.js |
| `AZURE_AI_KEY_2` | سرّ | _azure.js |
| `AZURE_OPENAI_API_KEY` | سرّ | _azure.js، _docread.js |
| `AZURE_OPENAI_API_KEY_2` | سرّ | _azure.js |
| `AZURE_OPENAI_ASR_DEPLOYMENT` | عادي | _docread.js |
| `AZURE_OPENAI_DEPLOYMENT` | عادي | _azure.js |
| `AZURE_OPENAI_DEPLOYMENT_2` | عادي | _azure.js |
| `AZURE_OPENAI_ENDPOINT` | عادي | _azure.js، _docread.js |
| `AZURE_OPENAI_ENDPOINT_2` | عادي | _azure.js |
| `AZURE_OPENAI_KEY` | سرّ | _azure.js، _docread.js |
| `AZURE_OPENAI_KEY_2` | سرّ | _azure.js |
| `AZURE_OPENAI_TEXT_DEPLOYMENT` | عادي | _azure.js |
| `AZURE_OPENAI_TEXT_DEPLOYMENT_2` | عادي | _azure.js |
| `AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT` | عادي | _docread.js |
| `AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT_2` | عادي | _docread.js |
| `AZURE_OPENAI_VISION_DEPLOYMENT` | عادي | _azure.js |
| `AZURE_OPENAI_VISION_DEPLOYMENT_2` | عادي | _azure.js |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | عادي | _docread.js |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT_2` | عادي | _docread.js |

**Daftra (الفواتير)** (5)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `DAFTRA_ALLOW_NONLIVE` | عادي | _invoicing.js |
| `DAFTRA_API_KEY` | سرّ | _daftra.js |
| `DAFTRA_CURRENCY` | عادي | _daftra.js |
| `DAFTRA_SUBDOMAIN` | عادي | _daftra.js، _simple.js |
| `DAFTRA_VAT_RATE` | عادي | _daftra.js، _suppliers.js |

**DocuSign** (6)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `DOCUSIGN_ACCOUNT_ID` | عادي | _docusign.js |
| `DOCUSIGN_BASE_URI` | عادي | _docusign.js |
| `DOCUSIGN_ENV` | عادي | _docusign.js، requests.js |
| `DOCUSIGN_INTEGRATION_KEY` | عادي | _docusign.js |
| `DOCUSIGN_PRIVATE_KEY` | سرّ | _docusign.js |
| `DOCUSIGN_USER_ID` | عادي | _docusign.js |

**GitHub (مزامنة المحتوى)** (7)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `CONTENT_BRANCH` | عادي | requests.js |
| `CONTENT_GITHUB_TOKEN` | سرّ | requests.js |
| `CONTENT_REPO` | عادي | requests.js |
| `CONTENT_SYNC_BRANCH` | عادي | requests.js |
| `GH_TOKEN` | سرّ | requests.js |
| `GITHUB_PAT` | سرّ | requests.js |
| `GITHUB_TOKEN` | سرّ | requests.js |

**Google Calendar** (3)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `GOOGLE_CALENDAR_ID` | عادي | _gcal.js |
| `GOOGLE_SA_EMAIL` | عادي | _gcal.js |
| `GOOGLE_SA_PRIVATE_KEY` | سرّ | _gcal.js |

**Microsoft Graph / SharePoint** (5)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `AZURE_CLIENT_ID` | عادي | _msgraph.js |
| `AZURE_CLIENT_SECRET` | سرّ | _msgraph.js |
| `AZURE_GRAPH_DRIVE_ID` | عادي | _msgraph.js |
| `AZURE_GRAPH_ROOT_FOLDER` | عادي | _msgraph.js |
| `AZURE_TENANT_ID` | عادي | _msgraph.js |

**Moyasar (الدفع)** (13)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `MOYASAR_APPLE_PAY_LABEL` | عادي | pay.js |
| `MOYASAR_APPLE_PAY_VALIDATE_URL` | عادي | pay.js |
| `MOYASAR_GOOGLE_ENV` | عادي | pay.js |
| `MOYASAR_GOOGLE_MERCHANT_ID` | عادي | _moyasar.js، pay.js |
| `MOYASAR_GOOGLE_PAY_LABEL` | عادي | pay.js |
| `MOYASAR_METHODS` | عادي | _moyasar.js، pay.js |
| `MOYASAR_MPF_URL` | عادي | _moyasar.js، pay.js |
| `MOYASAR_PUBLISHABLE_KEY` | عادي | _mode.js، _moyasar.js، _simple.js +1 |
| `MOYASAR_SAMSUNG_ENV` | عادي | pay.js |
| `MOYASAR_SAMSUNG_PAY_LABEL` | عادي | pay.js |
| `MOYASAR_SAMSUNG_SERVICE_ID` | عادي | _moyasar.js، pay.js |
| `MOYASAR_SECRET_KEY` | سرّ | _mode.js، _moyasar.js، _simple.js +1 |
| `MOYASAR_WEBHOOK_SECRET` | سرّ | _moyasar.js، _simple.js، pay.js |

**n8n (الأتمتة)** (5)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `BP_ATS_WEBHOOK` | سرّ | candidate.js |
| `DOC_AGENT_SYNC_URL` | عادي | _docagent.js |
| `LEAD_WEBHOOK_URL` | سرّ | book.js، requests.js، workspace.js |
| `N8N_ATS_WEBHOOK` | سرّ | candidate.js |
| `N8N_CANDIDATE_WEBHOOK` | سرّ | candidate.js |

**Notion** (33)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `BUSINESS_PARTNER_SITE_NOTION` | عادي | _agencies.js، _jobhunt.js، _spaces.js +7 |
| `BusinessPartnerSiteNotion` | سرّ | _agencies.js، _eor-billing.js، _eor.js +14 |
| `NOTION_AGENCIES_DB` | عادي | _agencies.js |
| `NOTION_AGENCY_REQUESTS_DB` | عادي | _agencies.js |
| `NOTION_API_KEY` | سرّ | _agencies.js، _eor-billing.js، _eor.js +14 |
| `NOTION_ATS_DB` | عادي | _agencies.js، _jobhunt.js، candidate.js +1 |
| `NOTION_BOARD_DB` | عادي | workspace.js |
| `NOTION_COMPANIES_DB` | عادي | requests.js |
| `NOTION_COMPLIANCE_DB` | عادي | pay.js، requests.js |
| `NOTION_CONSULT_DB` | عادي | requests.js |
| `NOTION_CRM_DB` | عادي | _stage.js، book.js، pay.js +2 |
| `NOTION_DAILY_NEWS_PAGE` | عادي | newsletter.js |
| `NOTION_EMPLOYERS_DB` | عادي | candidate.js، candidates.js، employer.js +1 |
| `NOTION_EMPLOYERS_PARENT` | عادي | employer.js |
| `NOTION_EOR_DB` | عادي | _eor.js |
| `NOTION_FINANCE_DB` | عادي | requests.js |
| `NOTION_INTEGRATION_TOKEN` | سرّ | _agencies.js، _eor-billing.js، _eor.js +14 |
| `NOTION_JOBS_DB` | عادي | _agencies.js، _jobhunt.js، candidate.js +1 |
| `NOTION_KEY` | سرّ | _agencies.js، _eor-billing.js، _eor.js +14 |
| `NOTION_LEADS_DB` | عادي | _bdmatch.js، pay.js |
| `NOTION_METRICS_DB` | عادي | candidates.js |
| `NOTION_NEWSLETTER_DB` | عادي | newsletter.js |
| `NOTION_NEWSLETTER_DRAFT_PAGE` | عادي | newsletter.js |
| `NOTION_NEWSLETTER_PARENT` | عادي | newsletter.js |
| `NOTION_PR_INTAKE_DB` | عادي | _printake.js |
| `NOTION_SECRET` | سرّ | _agencies.js، _eor-billing.js، _eor.js +14 |
| `NOTION_SOURCING_SUPPLIERS_DB` | عادي | requests.js |
| `NOTION_SUPPLIER_ORDERS_DB` | عادي | _suppliers.js |
| `NOTION_SUPPLIERS_DB` | عادي | _suppliers.js |
| `NOTION_SUPPLY_DB` | عادي | _spaces.js |
| `NOTION_TOKEN` | سرّ | _agencies.js، _eor-billing.js، _eor.js +14 |
| `NOTION_WA_CRM_DB` | عادي | requests.js |
| `NOTION_WORKSHOP_DB` | عادي | candidates.js |

**Resend (البريد)** (5)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `OTP_FROM_EMAIL` | عادي | _agencies.js، _eor.js، _invoicing.js +13 |
| `RESEND` | عادي | _agencies.js، _invoicing.js، _jobhunt.js +6 |
| `RESEND_API_KEY` | سرّ | _agencies.js، _eor.js، _invoicing.js +13 |
| `RESEND_AUDIENCE_ID` | عادي | book.js، newsletter.js، requests.js +1 |
| `RESEND_KEY` | سرّ | _agencies.js، _invoicing.js، _jobhunt.js +7 |

**Supabase (قاعدة البيانات الحالية)** (3)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | سرّ | _db.js، db/copy-to-azure.mjs، site/scripts/devserver.mjs |
| `SUPABASE_SERVICE_ROLE_KEY` | سرّ | _db.js، db/copy-to-azure.mjs، site/scripts/devserver.mjs |
| `SUPABASE_URL` | عادي | _db.js، db/copy-to-azure.mjs |

**Tamara (التقسيط)** (4)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `TAMARA_API_BASE` | عادي | _bnpl.js، _simple.js |
| `TAMARA_API_TOKEN` | سرّ | _bnpl.js، _mode.js، _simple.js |
| `TAMARA_MODE` | عادي | site/scripts/devserver.mjs |
| `TAMARA_OFF` | عادي | _bnpl.js |

**Vercel (يزول بالنقل)** (2)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `VERCEL` | عادي | site/scripts/hidden.mjs |
| `VERCEL_ENV` | عادي | _mode.js، _simple.js، otp.js +1 |

**أخرى** (1)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `LEADS_ACCESS_CODES` | سرّ | pay.js |

**أوضاع التشغيل والتطوير** (13)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `APP_ENV` | عادي | _mode.js، chat.js، otp.js |
| `CONTRACT_MODE` | عادي | site/scripts/devserver.mjs |
| `EMAIL_MODE` | عادي | site/scripts/devserver.mjs |
| `LOCAL_ALLOW_REMOTE_DB` | عادي | site/scripts/devserver.mjs |
| `LOCAL_DB` | عادي | _localdb.js، site/scripts/devserver.mjs |
| `LOCAL_DB_DIR` | عادي | _localdb.js، _mode.js |
| `OTP_DEV_ECHO` | عادي | otp.js |
| `PAYMENTS_MODE` | عادي | site/scripts/devserver.mjs |
| `PORT` | عادي | site/scripts/devserver.mjs |
| `SIMPLE_OPS_KEY` | سرّ | _simple.js، requests.js، site/scripts/devserver.mjs |
| `SIMPLE_TEST_MODE` | عادي | _simple.js، otp.js، requests.js |
| `SIMPLE_TEST_OTP` | عادي | otp.js، site/scripts/devserver.mjs |
| `SIMPLE_V1` | عادي | site/scripts/simple-v1.mjs |

**إعدادات المنتجات (حدود وأرقام)** (16)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `DOC_AGENT_SERVICE_CODES` | عادي | _docagent.js |
| `DOC_AGENT_TRIAL_DAYS` | عادي | _docagent.js |
| `EMP_CODE_MISS_LIMIT` | عادي | candidates.js |
| `EMPLOYER_CODES` | سرّ | candidates.js |
| `ESCROW_AUTO_REFUND_DAYS` | عادي | requests.js |
| `ESCROW_AUTO_RELEASE_DAYS` | عادي | requests.js |
| `GRACE_DAYS` | عادي | candidates.js |
| `HIRE_SCORE_POOL` | عادي | hire.js |
| `JOBS_FEED_CITY` | عادي | candidates.js |
| `JOBS_FEED_COMPANY` | عادي | candidates.js |
| `JOBS_FEED_COUNTRY` | عادي | candidates.js |
| `JOBS_FEED_STATE` | عادي | candidates.js |
| `SIMPLE_AUTO_QUOTE` | عادي | _simple.js |
| `SIMPLE_NOTIFY` | عادي | _simple.js |
| `SS_TRIAL_DAYS` | عادي | requests.js |
| `SUPPLIER_COMMISSION_PCT` | عادي | _suppliers.js |

**اعتماد (Etimad)** (6)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `ETIMAD_BASE_URL` | عادي | _etimad.js |
| `ETIMAD_CLIENT_ID` | عادي | _etimad.js |
| `ETIMAD_CLIENT_SECRET` | سرّ | _etimad.js |
| `ETIMAD_ENV` | عادي | _etimad.js |
| `ETIMAD_SCOPE` | عادي | _etimad.js |
| `ETIMAD_TOKEN_URL` | سرّ | _etimad.js |

**المهام المجدولة** (2)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `CRON_SECRET` | سرّ | _jobhunt.js، candidate.js، newsletter.js |
| `CV_RUNNER_SECRET` | سرّ | candidate.js |

**دخول Google** (1)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `GOOGLE_CLIENT_ID` | عادي | _agencies.js، _simple.js، _suppliers.js +2 |

**عناوين الموقع (يتغيّر النطاق = تُراجع)** (7)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `CATALOG_FROM_PANEL` | عادي | site/scripts/generate.mjs |
| `CATALOG_URL` | عادي | pay.js، requests.js |
| `MKT_SITE_BASE` | عادي | _catalog.js، _docusign.js، _eor.js +6 |
| `PORTAL_URL` | عادي | site/scripts/compare-prices.mjs، site/scripts/generate.mjs |
| `QUOTES_PANEL_URL` | عادي | requests.js |
| `SITE_BASE` | عادي | requests.js |
| `SITE_ORIGIN` | عادي | _jobhunt.js |

**مفاتيح الدخول والتوقيع** (6)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `DASHBOARD_KEY` | سرّ | _docagent.js، _simple.js، _suppliers.js +3 |
| `DOC_AGENT_HOOK_KEY` | سرّ | _docagent.js |
| `LEADS_KEY` | سرّ | _agencies.js، _docagent.js، _jobhunt.js +6 |
| `OTP_SECRET` | سرّ | _agencies.js، _nafath.js، _suppliers.js +4 |
| `PANEL_BRIDGE_TOKEN` | سرّ | requests.js |
| `PANEL_KEY` | سرّ | _agencies.js، _docagent.js، _jobhunt.js +7 |

**نفاذ** (9)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `NAFATH_APP_ID` | عادي | _nafath.js |
| `NAFATH_APP_KEY` | سرّ | _nafath.js |
| `NAFATH_BASE_URL` | عادي | _nafath.js |
| `NAFATH_ENV` | عادي | _nafath.js |
| `NAFATH_HASH_SECRET` | سرّ | _nafath.js |
| `NAFATH_SERVICE` | عادي | _nafath.js |
| `OWNER_NATIONAL_IDS` | عادي | _nafath.js |
| `PANEL_REQUIRE_NAFATH` | عادي | _nafath.js، otp.js |
| `PANEL_TICKET_HOURS` | عادي | _nafath.js |

**هوية الشركة والمالك** (20)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `BOOKING_DAYS` | عادي | book.js |
| `BOOKING_EMAIL` | عادي | _eor.js، _gcal.js، _suppliers.js +4 |
| `BOOKING_END` | عادي | book.js |
| `BOOKING_LEAD_MIN` | عادي | book.js |
| `BOOKING_SLOT_MIN` | عادي | book.js |
| `BOOKING_START` | عادي | book.js |
| `BP_BANK_BENEFICIARY` | عادي | _identity.js |
| `BP_BANK_IBAN` | عادي | _identity.js |
| `BP_BANK_NAME` | عادي | _identity.js |
| `BP_HIDDEN_FILE` | عادي | chat.js، site/scripts/hidden.mjs |
| `BP_NOTIFY_EMAIL` | عادي | _agencies.js، _jobhunt.js، candidates.js +1 |
| `BP_OPEN_ACCESS` | عادي | _trial.js |
| `BP_OWNER_EMAIL` | عادي | _eor.js، _invoicing.js، _simple.js +2 |
| `COMPANY_CR_NUMBER` | عادي | _zatca.js، site/scripts/simple-v1.mjs |
| `COMPANY_LEGAL_NAME` | عادي | _identity.js، site/scripts/simple-v1.mjs |
| `COMPANY_UNIFIED_NUMBER` | عادي | _identity.js، site/scripts/simple-v1.mjs |
| `COMPANY_VAT_NUMBER` | عادي | _identity.js، site/scripts/simple-v1.mjs |
| `OWNER_DEMO_CODE` | سرّ | candidates.js |
| `OWNER_EMAIL` | عادي | candidates.js، employer.js |
| `OWNER_EMAILS` | عادي | _simple.js، _trial.js |

**واتساب (Meta)** (15)

| المتغيّر | النوع | أين يُقرأ |
|---|---|---|
| `CRM_OWNER_WHATSAPP` | عادي | _simple.js، requests.js |
| `META_WHATSAPP_TOKEN` | سرّ | _simple.js، _stage.js |
| `NOTIFY_PHONE` | عادي | workspace.js |
| `OWNER_WA_WEBHOOK` | سرّ | _eor.js، _stage.js، book.js +1 |
| `OWNER_WHATSAPP` | عادي | _simple.js، requests.js |
| `WA_PHONE_ID` | عادي | _simple.js، _stage.js |
| `WA_TOKEN` | سرّ | _simple.js، _stage.js |
| `WHATSAPP_ACCESS_TOKEN` | سرّ | _simple.js، _stage.js |
| `WHATSAPP_CHANNEL_URL` | عادي | newsletter.js |
| `WHATSAPP_MODE` | عادي | site/scripts/devserver.mjs |
| `WHATSAPP_PHONE_ID` | عادي | _simple.js، _stage.js |
| `WHATSAPP_PHONE_NUMBER_ID` | عادي | _simple.js، _stage.js |
| `WHATSAPP_TEMPLATE_LANG` | عادي | _stage.js |
| `WHATSAPP_TEMPLATE_NAME` | عادي | _stage.js |
| `WHATSAPP_TOKEN` | سرّ | _simple.js، _stage.js |
