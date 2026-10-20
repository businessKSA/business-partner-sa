# دليل القطع النهائي إلى Azure — خطوة بخطوة (2026-10-16)

> قرار المالك 2026-10-16: «أنقل الموقع على Azure واستخدم n8n Azure بالكامل لأوقف Vercel وn8n تماماً».
> هذا الدليل يكمل `docs/azure-migration-2026-10-11.md` (الخطة والموارد الأساسية §9) ولا يكرّره.
> الأسرار لا تُكتب في هذا الملف ولا تُرسَل لأي أحد: تُكتب في Cloud Shell بلا صدى (`read -s`) أو تُلصق في بوابة Azure.

**حالة هذا الدليل:** مكتوب ومفحوص محلياً فقط. الأوامر مأخوذة من توثيق Microsoft الرسمي (مراجَع 2026-10-16)
ولم يُنفَّذ أي منها على اشتراكك. الأدوات التي كتبناها (`ops/azure/*`) اختُبرت على Postgres حقيقي محلي وعلى خادم Azure محلي.
أي أمر يرفضه Cloud Shell يقول لك السبب بوضوح — لا تحاول تجاوزه، أرسل لي رسالة الخطأ.

## 0) خريطة الزمن وما يلزمك قبل أن تبدأ

| متى | ماذا | أثره على الزوار |
|---|---|---|
| قبل القطع بأسبوعين | إنشاء الإضافات: لوحة العروض على Azure (أ)، Front Door والنطاق (ب١–ب٣)، خادم PostgreSQL (د١–د٢)، التنبيهات (و١) | لا شيء |
| قبل القطع بـ٤٨ ساعة | خفض TTL للنطاق إلى ٣٠٠ث (ب٠) | لا شيء |
| **يوم القطع (جمعة صباحاً)** | تجميد نشر Vercel → **(ج) تبديل المجدول** → **(ب) تحويل DNS** → فحص → نافذة المراقبة (و) | دقائق |
| بعد القطع بـ٢٤ ساعة وما بعدها | مراقبة (و)، Vercel يبقى حياً بلا حركة = طريق الرجوع | لا شيء |
| بعد ٤٨ ساعة على الأقل من القطع | **(د) نقل قاعدة البيانات** — نافذة تجميد كتابة قصيرة منفصلة | دقائق قراءة فقط |
| أي وقت بعد استقرار الأسبوع الأول | **(هـ) البريد إلى ACS** | لا شيء |
| بعد ٧ أيام استقرار + قائمة (ز) | **(ز) حذف مشروعَي Vercel** (أنت من اللوحة) | لا شيء |

**لماذا القاعدة بعد الاستضافة لا معها:** الاستضافة وحدها يُرجَع عنها بتغيير DNS فقط (الحالة المشتركة — Supabase وNotion وBlob — لا تتحرك).
لو نقلنا القاعدة في الليلة نفسها لصار الرجوع يحتاج مصالحة بيانات. فصلهما يجعل كل قطع قابلاً للتراجع منفرداً.

### قراراتك (اقرأها قبل أي أمر)

| # | القرار | توصيتي | إن لم تقرّر |
|---|---|---|---|
| ق١ | لوحة العروض `bp-quotes`: تُنقل **كما هي** إلى Azure (أ)، أم تُدمج في الموقع أولاً؟ | **تُنقل كما هي** الآن. الدمج (`docs/quotes-cutover.md`) عملٌ طويل لـ`quotes-contracts` ولا يجوز أن يؤخّر إيقاف Vercel | القطع يبقى على Vercel لـ`/quotes` فقط |
| ق٢ | ملفات العروض والعقود في لوحة العروض تُخزَّن في **S3 أو R2** (خارج Azure). تبقى مؤقتاً أم يُكتب لها سائق Azure Blob؟ | تبقى الآن (لا تكلفة نقل ولا مخاطرة)، ويُكلَّف `quotes-contracts` بسائق Blob ثم نسخ الملفات | تبقى |
| ق٣ | الطابور `Inngest` (سحابة خارجية) في لوحة العروض: يبقى أم يُحوَّل إلى `QUEUE_DRIVER=inline` (داخل الطلب بلا إعادة محاولة)؟ | يبقى الآن (لا يعتمد على مكان الاستضافة) | يبقى |
| ق٤ | نطاق الأبكس `businesspartner.sa`: سجلّ **A** إلى عنوان بيئة Container Apps (نافذة شهادة دقائق)، أم ALIAS/CNAME-flattening إلى Front Door إن كانت صحارى تدعمه؟ | اسأل صحارى. إن دعمت ALIAS فهو الأفضل (بلا نافذة) | A + نافذة بعد منتصف الليل |
| ق٥ | حجم PostgreSQL: **General Purpose** (يدعم PgBouncer المدمج) أم Burstable أرخص بلا PgBouncer؟ | General Purpose، أصغر حجم، ثم راقب | General Purpose |
| ق٦ | نطاق إرسال البريد: نطاق فرعي `mail.businesspartner.sa` (توصيتي: لا يلمس سجلات البريد الحالية) أم الجذر؟ | فرعي | فرعي |
| ق٧ | الوقت: أي جمعة؟ ومن يتواجد؟ لا تختر الأحد 06:00 ولا الاثنين 05:00 بتوقيت UTC (مهام النشرة وجمع الوظائف) | جمعة صباحاً | — |

### ما يجب أن يكون قد تمّ قبل يوم القطع (افحصه بهذه الأوامر)

```bash
# متغيّرات الجلسة — عدّل الأسماء إن اخترتَ غيرها في docs/azure-migration-2026-10-11.md §9
RG=rg-bp-web ; LOC=uaenorth ; CAE=cae-bp-web ; APP=bp-site ; QAPP=bp-quotes
AFD=afd-bp ; EP=bp ; LAW=log-bp-web ; ACR=<اسم سجل الحاويات>

az account show --query "{sub:name,tenant:tenantId}" -o table
az containerapp show -g $RG -n $APP --query "{state:properties.runningStatus,fqdn:properties.configuration.ingress.fqdn,min:properties.template.scale.minReplicas}" -o table
curl -s "https://$(az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv)/__health"
```
**المتوقع:** الاشتراك الصحيح، التطبيق `Running`، و`/__health` يعيد `{"ok":true,...,"rssMb":...}`.
**وإلا:** توقّف — الاستضافة الأساسية (§9 من خطة 2026-10-11) لم تكتمل.

ويجب أن يكون `node ops/azure/parity.mjs --a https://www.businesspartner.sa --b https://<fqdn-bp-site> --skip-api` قد نجح (staging).

أدوات المستودع تُشغَّل من Cloud Shell: استنسخ المستودع (سيطلب رمز وصول GitHub تُدخله بيدك) ثم:
```bash
git clone https://github.com/businessKSA/business-partner-sa.git && cd business-partner-sa
git checkout azure-migration            # أو الفرع الذي أخبرتك به
npm ci --omit=dev --no-audit --no-fund  # يثبّت pg فقط
node -v                                  # المتوقع: v20 أو أحدث
```

**قاعدة تنطبق على كل تغيير يمسّ `bp-site` أو `bp-quotes` (اقرأها مرة):** التطبيقان بوضع `multiple revisions`، فأي
`az containerapp update` ينشئ مراجعة جديدة **بلا حركة** — لا يُطبَّق التغيير حتى تُنقل الحركة إليها. استعمل هذه الدالة بعد كل تحديث:
```bash
promote() {  # promote <اسم-التطبيق> — ينقل ١٠٠٪ إلى أحدث مراجعة فعّالة
  REV=$(az containerapp revision list -g $RG -n "$1" --query "sort_by([?properties.active], &properties.createdTime)[-1].name" -o tsv)
  az containerapp ingress traffic set -g $RG -n "$1" --revision-weight "$REV=100" -o none && echo "الحركة على: $REV"
}
```
**المتوقع:** `الحركة على: bp-site--g…`. وللتحقق: `az containerapp revision list -g $RG -n $APP -o table` (عمود Traffic).

---

## (أ) نقل `bp-quotes` من Vercel إلى Azure — بحيث لا يبقى طلب إلى `*.vercel.app`

### أ٠) ما يشير إلى Vercel اليوم وكيف يُعالَج (جرد من الكود)

| # | الموضع | ما يحدث | العلاج (بلا تعديل أي ملف في `api/`) |
|---|---|---|---|
| ١ | `vercel.json` — ٣ rewrites: `/quotes` و`/quotes/:path*` و`/api/live-catalog` → `bp-quotes-three.vercel.app` | الخادم الجديد يمرّر إليه كما كان | `BP_ORIGIN_MAP` يحوّل الأصل إلى `http://bp-quotes` داخل البيئة؛ `vercel.json` يبقى المصدر الوحيد |
| ٢ | `api/requests.js:1413` — `QUOTES_PANEL_URL` افتراضه `https://bp-quotes-three.vercel.app/quotes` (جسر المستندات والكتالوج والمورّدين) | نداء خادم لخادم | نضبط المتغيّر `QUOTES_PANEL_URL=http://bp-quotes/quotes` |
| ٣ | `PORTAL_URL` وقت البناء | افتراضه `https://www.businesspartner.sa/quotes` — ليس vercel.app | اتركه كذلك؛ **لا تضبطه** على عنوان Vercel في متغيّرات GitHub |
| ٤ | `site/scripts/compare-prices.mjs` | أداة تطوير يدوية، لا تعمل في الإنتاج | لا شيء |
| ٥ | `ops/n8n/catalog-sync.workflow.js` — `PANEL` + **Vercel Deploy Hook** | سير n8n يستدعي Vercel | يُعدَّل في n8n (`automation-agents`): `PANEL` → `https://www.businesspartner.sa/quotes`، والخطّاف → `workflow_dispatch` على GitHub. **لا يُحذف Vercel قبله** (ز) |
| ٦ | تسجيلات خارجية قد تحمل عنوان Vercel: Tamara (إشعار)، DocuSign Connect، Inngest (عنوان المزامنة)، Moyasar | لا أعرف إن كانت مسجَّلة على `bp-quotes-three.vercel.app` | **افحصها في لوحاتها** وغيّرها إلى `https://www.businesspartner.sa/quotes/…` (أ٩) |

والضمان الصريح: علم `BP_BLOCK_VERCEL_ORIGINS=1` (أ٨) يجعل الخادم **يرفض ويسجّل** أي خروج إلى `*.vercel.app` — وكيلاً كان أو نداء من داخل دالة.

### أ١) إحضار متغيّرات لوحة العروض من Vercel

من جهازك أو Cloud Shell (تسجّل الدخول بيدك):
```bash
npx vercel@latest login
npx vercel@latest link            # اختر المشروع bp-quotes
npx vercel@latest env pull ~/quotes.env --environment=production
```
**المتوقع:** ملف `~/quotes.env`. المتغيّرات المعلَّمة Sensitive تأتي **فارغة**؛ املأها يدوياً (أسماؤها في ملف القالب الذي يكتبه `load-env.mjs --write-missing`).
**ملاحظتان:** `DATABASE_URL` و`DIRECT_DATABASE_URL` تُعامَلان الآن **سرّاً** في `load-env.mjs` (أصلحتُ `env-scan.mjs` — كانتا تُعدّان عاديتين). وقاعدة اللوحة **تبقى حيث هي في هذه الخطوة**؛ تنتقل في (د).

### أ٢) بناء الصورة

```bash
az acr build -r $ACR -t bp-quotes:$(git rev-parse --short HEAD) -f ops/azure/Dockerfile.quotes .
```
**المتوقع:** ينتهي بـ`Run ID: … was successful`. (بناء `next build` للوحة جُرّب محلياً بنجاح بلا قاعدة؛ الصورة نفسها لم تُبنَ هنا — أول بناء فعلي هنا.)

### أ٣) إنشاء التطبيق داخل البيئة نفسها بوصول داخلي فقط

```bash
TAG=$(git rev-parse --short HEAD)
az containerapp create -g $RG -n $QAPP --environment $CAE \
  --image $ACR.azurecr.io/bp-quotes:$TAG \
  --registry-server $ACR.azurecr.io --registry-identity system \
  --ingress internal --target-port 8080 \
  --cpu 1 --memory 2Gi --min-replicas 1 --max-replicas 3 \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 40 \
  --revisions-mode multiple \
  --env-vars NODE_OPTIONS=--max-old-space-size=1024 \
  -o table
az containerapp update -g $RG -n $QAPP --yaml ops/azure/probes.quotes.yaml -o none
```
**المتوقع:** يُنشأ التطبيق بعنوان داخلي `bp-quotes.internal.<…>.uaenorth.azurecontainerapps.io`، وباسم `bp-quotes` يُحَلّ داخل البيئة (`http://bp-quotes`).
**وإن رفض `--registry-identity system`:** امنح هوية التطبيق دور `AcrPull` على السجل من البوابة (IAM) ثم أعد الأمر.
**لماذا `internal`:** لا يصل إليه أحد من الإنترنت؛ الوصول الوحيد عبر `bp-site`. (قد تفتح بيئتك على نطاق واحد؛ لا يتغيّر شيء.)

### أ٤) نقل المتغيّرات (بلا طباعة قيم)

```bash
node ops/azure/load-env.mjs --file ~/quotes.env --file ~/quotes-missing.env --app $QAPP --rg $RG --dry-run
# راجع الأسماء وتصنيفها (أسرار/عادية). ثم بلا --dry-run:
node ops/azure/load-env.mjs --file ~/quotes.env --file ~/quotes-missing.env --app $QAPP --rg $RG
rm -f ~/quotes.env ~/quotes-missing.env
```
ثم **ثلاثة متغيّرات تُضبط صراحةً** (بعضها قد يحمل في Vercel عنوان vercel.app القديم):
```bash
az containerapp update -g $RG -n $QAPP -o none --set-env-vars \
  APP_URL=https://www.businesspartner.sa/quotes \
  SITE_API_URL=https://www.businesspartner.sa \
  PDF_DRIVER=local
promote $QAPP
```
**لماذا `SITE_API_URL` عام:** اللوحة تنادي الموقع، والموقع (بعد ب٤) يرفض النداء الداخلي بلا ترويسة Front Door، فتمرّ عبر النطاق العام.
**المتوقع:** `الحركة على: bp-quotes--…`.

### أ٥) فحص اللوحة وحدها

```bash
QFQDN=$(az containerapp show -g $RG -n $QAPP --query properties.configuration.ingress.fqdn -o tsv)
az containerapp logs show -g $RG -n $QAPP --tail 30
```
**المتوقع:** سطور إقلاع Next بلا أخطاء اتصال بالقاعدة. (الوصول الخارجي لا يتوفر — الفحص عبر الموقع في أ٦.)

### أ٦) توجيه الموقع إليها وفحص كل مسار

```bash
az containerapp update -g $RG -n $APP -o none --set-env-vars \
  BP_ORIGIN_MAP=https://bp-quotes-three.vercel.app=http://bp-quotes \
  QUOTES_PANEL_URL=http://bp-quotes/quotes
promote $APP

FQDN=$(az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv)
curl -s -o /dev/null -w "quotes health: %{http_code}\n"  https://$FQDN/quotes/api/health
curl -s -o /dev/null -w "live-catalog:  %{http_code}\n"  https://$FQDN/api/live-catalog
curl -s -o /dev/null -w "quotes page:   %{http_code}\n"  https://$FQDN/quotes
```
**المتوقع:** `200` للثلاثة. (جُرّب محلياً: خادم Azure → لوحة Next حقيقية عبر الخريطة، والرد جاء منها.)
**وإن جاء `502`:** الاسم الداخلي لم يُحَلّ — جرّب `BP_ORIGIN_MAP` بعنوان `https://<fqdn-الداخلي>` بدل `http://bp-quotes`.

ثم رابط مستند **حقيقي** أُرسل لعميل سابقاً: `https://$FQDN/quotes/d/<token>` يجب أن يفتح المستند. وتسجيل دخول المالك إلى `/quotes/admin`.

### أ٧) جسر المستندات من الموقع إلى اللوحة

سجّل دخولك بالرمز على `https://$FQDN/my` (أو `/account`) وافتح قسم «عروضي وعقودي».
**المتوقع:** تظهر مستنداتك. (هذا النداء `QUOTES_PANEL_URL`.)

### أ٨) إقفال الباب على Vercel

```bash
az containerapp update -g $RG -n $APP -o none --set-env-vars BP_BLOCK_VERCEL_ORIGINS=1
promote $APP
curl -s https://$FQDN/__health          # المتوقع: يظهر "egressBlocked":0
```
كرّر أ٦–أ٧ مرة. **المتوقع:** كلها ناجحة و`egressBlocked` يبقى `0`.
وأي نداء قادم إلى Vercel سيظهر في السجلات باسم `egress_blocked` (وفيه اسم المضيف) وينبّهك تنبيه `bp-log-egress` (و١).

### أ٩) تسجيلات الجهات الخارجية (يدوي، من لوحاتها)

ابحث عن `vercel.app` في: Tamara (رابط الإشعار)، DocuSign Connect (رابط الـwebhook)، Inngest (App URL / Sync)، Moyasar (webhooks).
كلّ ما وجدته غيّره إلى `https://www.businesspartner.sa/quotes/...` **بعد** تحويل DNS (ب)؛ وقبله يبقى كما هو (يعمل). سجّل ما غيّرته هنا في المحادثة.

**التراجع (أ):** `az containerapp update -g $RG -n $APP --remove-env-vars BP_ORIGIN_MAP QUOTES_PANEL_URL BP_BLOCK_VERCEL_ORIGINS` ثم `promote $APP` — يعود المرور إلى Vercel فوراً (ما دام مشروع bp-quotes حياً).

---

## (ب) النطاق: `www` والأبكس، الشهادة، وDNS في صحارى

### ب٠) قبل القطع بـ٤٨ ساعة: TTL وحفظ القيم القديمة

من لوحة DNS في صحارى (يدوي): **انسخ في ملف** كل سجلات النطاق كما هي (A وCNAME وMX وTXT وCAA وDKIM) — هذا مفتاح الرجوع.
ثم اخفض TTL لسجلّي `www` والأبكس (`@`) إلى **٣٠٠ ثانية**. لا تغيّر شيئاً آخر. لا تنقل خوادم الأسماء (NS) أبداً.
**المتوقع:** بعد ٤٨ ساعة: `dig +short www.businesspartner.sa` يعيد عنواني Vercel، و`dig www.businesspartner.sa | grep -i "^www"` يُظهر TTL ≤ ٣٠٠.

### ب١) Front Door (للـwww): الملف والأصل والمسارات

```bash
az afd profile create -g $RG --profile-name $AFD --sku Standard_AzureFrontDoor -o none
az afd endpoint create -g $RG --profile-name $AFD --endpoint-name $EP --enabled-state Enabled -o none

az afd origin-group create -g $RG --profile-name $AFD --origin-group-name og-site \
  --probe-request-type GET --probe-protocol Https --probe-interval-in-seconds 30 --probe-path /__health \
  --sample-size 4 --successful-samples-required 3 --additional-latency-in-milliseconds 50 -o none

APPFQDN=$(az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv)
az afd origin create -g $RG --profile-name $AFD --origin-group-name og-site --origin-name site \
  --host-name $APPFQDN --origin-host-header $APPFQDN --http-port 80 --https-port 443 \
  --priority 1 --weight 1000 --enabled-state Enabled -o none
```
ثم **ثلاثة مسارات** (الأكثر تحديداً يغلب): الـAPI واللوحة **بلا تخزين مؤقت** أبداً (جلسات ودفع)، والباقي بتخزين مؤقت وضغط:
```bash
az afd route create -g $RG --profile-name $AFD --endpoint-name $EP --route-name r-api \
  --origin-group og-site --patterns-to-match "/api/*" --supported-protocols Http Https \
  --https-redirect Enabled --forwarding-protocol HttpsOnly --link-to-default-domain Enabled -o none
az afd route create -g $RG --profile-name $AFD --endpoint-name $EP --route-name r-quotes \
  --origin-group og-site --patterns-to-match "/quotes" "/quotes/*" --supported-protocols Http Https \
  --https-redirect Enabled --forwarding-protocol HttpsOnly --link-to-default-domain Enabled -o none
az afd route create -g $RG --profile-name $AFD --endpoint-name $EP --route-name r-default \
  --origin-group og-site --patterns-to-match "/*" --supported-protocols Http Https \
  --https-redirect Enabled --forwarding-protocol HttpsOnly --link-to-default-domain Enabled \
  --query-string-caching-behavior UseQueryString --enable-compression true -o none
```
**المتوقع:** بلا أخطاء. وعنوان النقطة: `EPHOST=$(az afd endpoint show -g $RG --profile-name $AFD --endpoint-name $EP --query hostName -o tsv)`؛ ثم
`curl -s https://$EPHOST/__health` يعيد `{"ok":true,…}`.
**وإن لم يعرف الأمر `--query-string-caching-behavior`/`--enable-compression`:** افتح المسار `r-default` في البوابة (Front Door ← Routes) وفعّل Caching + Compression + «Use query string».

### ب٢) النطاق وشهادة Azure المُدارة (بلا أي أثر على الحركة)

```bash
az afd custom-domain create -g $RG --profile-name $AFD --custom-domain-name www-bp \
  --host-name www.businesspartner.sa --certificate-type ManagedCertificate --minimum-tls-version TLS12 -o none
az afd custom-domain show -g $RG --profile-name $AFD --custom-domain-name www-bp \
  --query "{state:domainValidationState,token:validationProperties.validationToken}" -o table
```
**المتوقع:** حالة `Pending` وقيمة `token`. أضف في DNS صحارى (يدوي، **لا يغيّر الحركة**):
| النوع | الاسم | القيمة |
|---|---|---|
| TXT | `_dnsauth.www` | قيمة `token` |

انتظر حتى تصبح الحالة `Approved` (حتى ~١٠ دقائق، وأحياناً أطول):
```bash
az afd custom-domain show -g $RG --profile-name $AFD --custom-domain-name www-bp --query domainValidationState -o tsv
```
ثم اربط النطاق بالمسارات الثلاثة:
```bash
for R in r-api r-quotes r-default; do
  az afd route update -g $RG --profile-name $AFD --endpoint-name $EP --route-name $R --custom-domains www-bp -o none
done
```
**المتوقع:** `Approved`، ثم شهادة تُصدَر خلال دقائق إلى ساعة. إن كان في DNS سجلّ `CAA` على النطاق فأضف `0 issue "digicert.com"`.
**وإن بقيت `Pending` بعد ساعة:** `az afd custom-domain regenerate-validation-token -g $RG --profile-name $AFD --custom-domain-name www-bp` وحدّث قيمة TXT.

### ب٣) اختبار بالاسم الحقيقي قبل أي تحويل

```bash
FDIP=$(nslookup $EPHOST | awk '/^Address: /{print $2}' | tail -1)
curl -s --resolve www.businesspartner.sa:443:$FDIP https://www.businesspartner.sa/__health
node ops/azure/parity.mjs --a https://www.businesspartner.sa --b https://www.businesspartner.sa --resolve-b $FDIP --body --sample 40
```
**المتوقع:** `{"ok":true,…}` والشهادة صحيحة لـ`www.businesspartner.sa`، وفاحص التكافؤ يخرج بـ٠ (الاختلافات المتوقعة: `/scripts/*` مغلق على Azure، و`dbDriver`).
**وإن فشلت الشهادة:** لا تكمل — الشهادة لم تُصدَر بعد.

### ب٤) قفل الباب المباشر وضبط عنوان الزائر الحقيقي

```bash
FDID=$(az afd profile show -g $RG --profile-name $AFD --query frontDoorId -o tsv)
az containerapp update -g $RG -n $APP -o none --set-env-vars \
  BP_FRONT_DOOR_ID=$FDID BP_TRUSTED_PROXY_HOPS=2 \
  BP_CANONICAL_HOST=www.businesspartner.sa BP_APEX_HOSTS=businesspartner.sa \
  NODE_OPTIONS=--max-old-space-size=1400
az containerapp update -g $RG -n $APP --yaml ops/azure/probes.site.yaml -o none
promote $APP
curl -s -o /dev/null -w "مباشر بلا FD: %{http_code}\n" https://$APPFQDN/about
curl -s -o /dev/null -w "عبر FD:        %{http_code}\n" --resolve www.businesspartner.sa:443:$FDIP https://www.businesspartner.sa/about
```
**المتوقع:** `مباشر بلا FD: 403` و`عبر FD: 200`.
**لماذا القفل والقفزتان معاً:** بلا قفل يستطيع أي زائر الوصول إلى `*.azurecontainerapps.io` مباشرة فيتجاوز الجدار ويُنتحل عنوانه؛ وبلا `BP_TRUSTED_PROXY_HOPS=2` يرى الموقع عنوان حافة Front Door لكل الزوار فتتشارك حدود المعدّل عناوين قليلة. (الخادم الآن يضبط ٢ تلقائياً عند وجود المعرّف، ويحذّر في السجل عند التعارض.)
**الذاكرة:** `NODE_OPTIONS=--max-old-space-size=1400` يترك ~٦٠٠MB للذاكرة خارج الكومة (ضغط وتخزين مؤقت) في الحاوية ٢GiB، و`/__health` يردّ ٥٠٣ تلقائياً عند ٩٠٪ من سقف الحاوية فتُعاد النسخة بلطف قبل أن يقتلها OOM.

### ب٥) يوم القطع: تحويل DNS (بعد ج مباشرة — الترتيب مفروض)

> **ممنوع تنفيذ هذه الخطوة قبل إتمام (ج).** ترتيب يوم القطع الكامل في آخر الدليل (ح).

في لوحة DNS صحارى (يدوي، TTL ٣٠٠ مسبقاً):
1. `www`: احذف سجلّ **A** (قيمته القديمة محفوظة من ب٠) وأضف مكانه **CNAME** → `$EPHOST` (اطبعه: `echo $EPHOST`). إن أتاحت اللوحة تعديل النوع فافعله في عملية واحدة.
2. **الأبكس** — حسب قرارك ق٤:
   * **A (الافتراضي):** أضف TXT واحصل على العنوان:
     ```bash
     az containerapp env show -g $RG -n $CAE --query properties.staticIp -o tsv                 # عنوان A
     az containerapp show -g $RG -n $APP --query properties.customDomainVerificationId -o tsv   # قيمة TXT
     ```
     سجلات الأبكس: `A  @  <staticIp>` و`TXT  asuid  <customDomainVerificationId>`. ثم:
     ```bash
     az containerapp hostname add  -g $RG -n $APP --hostname businesspartner.sa
     az containerapp hostname bind -g $RG -n $APP --hostname businesspartner.sa --environment $CAE --validation-method HTTP
     ```
     **المتوقع:** بعد دقائق تُصدَر شهادة مُدارة مجانية. **نافذة:** من يزور الأبكس وحده يرى خطأ شهادة حتى تُصدَر — لذلك اجعل هذه الخطوة **بعد منتصف الليل**، ولا يتأثر `www`.
   * **ALIAS إلى Front Door:** أضف النطاق `businesspartner.sa` إلى الملف `$AFD` مع TXT `_dnsauth` مسبقاً (كما ب٢) ثم ALIAS/CNAME-flattening إلى `$EPHOST` — بلا نافذة.

### ب٦) فحص ما بعد التحويل

```bash
dig +short www.businesspartner.sa CNAME          # المتوقع: $EPHOST
curl -sI https://www.businesspartner.sa/ | grep -i -E "^(HTTP|x-azure-ref|strict-transport)"
curl -sI https://businesspartner.sa/ar/about | grep -i -E "^(HTTP|location)"
node ops/azure/parity.mjs --a <لقطة-المرجع-إن-حفظتها> --b https://www.businesspartner.sa --body --apex
```
**المتوقع:** `HTTP/2 200` مع `x-azure-ref` (دليل أن الرد من Front Door)، والأبكس `308` مع `location: https://www.businesspartner.sa/ar/about`.
ثم افحص يدوياً: دخول بالرمز بحساب المالك، طلب اختبار في `/my`، وصفحة `/quotes/admin`، ودفعة اختبارية صغيرة إن وافقت (Moyasar + **Apple Pay** — قد تطلب Apple/Moyasar إعادة التحقق من النطاق).

**التراجع (ب):** أعد `www` إلى سجلّ A القديم (القيم محفوظة)، وكذلك الأبكس؛ TTL ٣٠٠ث = ٥–١٠ دقائق. ولا بيانات تُصالَح (الحالة مشتركة). راجع قسم (و) للترتيب الكامل مع المجدول.

---

## (ج) المجدول: Vercel Cron → Container Apps Jobs (مجدولٌ واحد فقط، بلا يوم تشغيل مزدوج)

قرارك: لا تشغيل مزدوج ولو يوماً. الترتيب **ثابت ومفروض في الأداة** `ops/azure/cron-switch.sh`: أوقف Vercel أولاً ثم تُنشأ مهام Azure (في الأمر نفسه)،
والتراجع بالعكس: تُحذف مهام Azure أولاً ثم يُفعَّل Vercel. **القديم يُطفأ قبل أن يُشغَّل الجديد دائماً** — نافذة بلا مجدول (تأخير) أهون من نافذة بمجدولين (نشرة بريدية مرتين).

> تصحيح لخطة 2026-10-11 §9: «اتركها Disabled» غير ممكن — مهام Container Apps ليس لها حالة معطَّلة (النوع Schedule أو Manual أو Event فقط). لذلك تُنشأ المهام **لحظة التبديل** لا قبلها.

### ج١) التبديل (خطوة واحدة)

```bash
IMAGE=$ACR.azurecr.io/bp-site:$(az containerapp show -g $RG -n $APP --query "properties.template.containers[0].image" -o tsv | sed 's/.*://')
export RG CAE IMAGE
bash ops/azure/cron-switch.sh on
```
الأداة تسألك أولاً: «هل أوقفتَ Vercel Cron فعلاً؟» — **قبل أن تجيب «نعم»** افعل (يدوياً من لوحة Vercel):
Project (الرئيسي) → Settings → **Cron Jobs** → **Disable** وتأكد أن الثلاث `Disabled`. ثم اكتب `نعم`. وتسألك عن `CRON_SECRET` بلا صدى (يجب أن يساوي سرّ `CRON_SECRET` في `bp-site`).
**المتوقع:** ثلاثة أسطر `→ bp-cron-…` ثم `✓ المجدول الفعّال الآن: Azure وحده.`
وإن أجبتَ بغير «نعم» لا يُنشأ شيء.

ما يُنشأ (من `vercel.json` نفسه عبر `cron.mjs` — لا نسخة ثانية للجدول): `bp-cron-0-newsletter` (الأحد 06:00 UTC)، `bp-cron-1-requests-jobhunt` (الاثنين 05:00)، `bp-cron-2-candidate-backfill` (يومياً 03:00)؛ بلا إعادة محاولة تلقائية (`--replica-retry-limit 0`): فشل مهمة لا يُكرَّر فيرسل نشرة ثانية.

### ج٢) التحقق

```bash
bash ops/azure/cron-switch.sh status
node ops/azure/cron.mjs 0 --dry-run          # يطبع الرابط الذي ستستدعيه النشرة ولا يستدعيه
az containerapp job start -g $RG -n bp-cron-2-candidate-backfill     # الوحيدة الآمنة للتشغيل اليدوي (تُكمل ما نقص ولا ترسل بريداً)
```
**المتوقع:** بعد ~دقيقة: `az containerapp job execution list -g $RG -n bp-cron-2-candidate-backfill -o table` يُظهر `Succeeded`.
**ممنوع تشغيل `bp-cron-0-newsletter` يدوياً** — يرسل بريداً حقيقياً لكل المشتركين. تُراقَب أول نشرة يوم الأحد (و).

### ج٣) التراجع (عكسي، بالترتيب نفسه المفروض)

```bash
bash ops/azure/cron-switch.sh off        # تُحذف مهام Azure الثلاث أولاً
# ثم يدوياً: Vercel → Settings → Cron Jobs → Enable
```

### ج٤) n8n: مجدولٌ واحد فعّال في كل وقت

القاعدة نفسها لسير n8n ذات المؤقّت (Schedule/Cron triggers): **لا نسخة مفعّلة في n8n Cloud ونسخة في n8n على Azure معاً.**
1. الحالة الآن غير مؤكَّدة في الجرد: `az containerapp list -g bp-ai -o table` — هل n8n يعمل على Azure؟
2. عند نقل أي سير فيه مؤقّت: **عطّله في Cloud أولاً** (Active=off)، ثم فعّله على Azure. والتراجع عكسه: عطّل نسخة Azure ثم فعّل Cloud.
3. سير الاستدعاء الوارد (Webhook) لا يتكرّر عند الازدواج لكنه يحتاج تحديث عنوان المستدعي، وسيرُ المؤقّتات هي الخطرة.
4. `ops/n8n/catalog-sync.workflow.js` يستدعي **Vercel Deploy Hook**: يُستبدل بـ`workflow_dispatch` على GitHub **قبل** (ز) (مهمة `automation-agents`).
5. يُسجَّل في المحادثة كل سير نُقل مع وقت التعطيل/التفعيل.

---

## (د) قاعدة البيانات: Supabase → Azure PostgreSQL (نافذة تجميد كتابة قصيرة)

**لا تبدأ إلا بعد ٤٨ ساعة على الأقل من القطع** وبعد أن يكون كل شيء مستقراً. يشمل النقل **قاعدتين**: قاعدة الموقع (Supabase) وقاعدة لوحة العروض (Postgres تابعة لـ`bp-quotes`). كلتاهما تُنسخان في النافذة نفسها.

### د١) إنشاء الخادم (قبل القطع بأسبوعين — لا أثر)

```bash
PG=bp-pg-$RANDOM                                  # الاسم فريد عالمياً؛ سجّله
read -s -p "كلمة سر مدير PostgreSQL: " PGPASS; echo
az postgres flexible-server create -g $RG -n $PG -l $LOC --version 16 \
  --tier GeneralPurpose --sku-name Standard_D2ds_v5 --storage-size 64 \
  --admin-user bpadmin --admin-password "$PGPASS" --public-access 0.0.0.0 --yes
az postgres flexible-server parameter set -g $RG -s $PG --name azure.extensions --value pgcrypto
az postgres flexible-server parameter set -g $RG -s $PG --name pgbouncer.enabled --value true
az postgres flexible-server db create -g $RG -s $PG -d bp
az postgres flexible-server db create -g $RG -s $PG -d bpquotes
```
**المتوقع:** يُنشأ الخادم (٥–١٠ دقائق) وقاعدتان. (`--public-access 0.0.0.0` = السماح لخدمات Azure؛ لاحقاً يُحسَّن بشبكة خاصة.)
**وإن لم تتوفر المنطقة `uaenorth` أو الـSKU:** `az postgres flexible-server list-skus -l $LOC -o table` واختر الأقرب، وأخبرني.
**التكلفة:** General Purpose أغلى من Burstable (قرار ق٥)؛ احسب في Azure Pricing Calculator. PgBouncer لا يعمل على Burstable — فيه `AZURE_PG_POOL_MAX=4` بلا مُجمِّع.
وأضف عنوان Cloud Shell مؤقتاً (يتغيّر كل جلسة) ثم احذفه بعد الانتهاء:
```bash
MYIP=$(curl -s ifconfig.me)
az postgres flexible-server firewall-rule create -g $RG -n $PG --rule-name cloudshell-tmp --start-ip-address $MYIP --end-ip-address $MYIP
```
روابط الاتصال (لا تُطبع في المحادثة):
```bash
HOST=$PG.postgres.database.azure.com
export AZURE_PG_URL="postgres://bpadmin:$PGPASS@$HOST:5432/bp?sslmode=require"           # مباشر للنسخ والمخطّط
QDIRECT="postgres://bpadmin:$PGPASS@$HOST:5432/bpquotes?sslmode=require"
```

### د٢) تطبيق المخطّطين (قبل القطع أيضاً)

```bash
psql "$AZURE_PG_URL" -v ON_ERROR_STOP=1 -f db/schema.sql                      # قاعدة الموقع: تُنشأ كلها بلا تعديل
( cd quotes && npm ci --no-audit --no-fund && DATABASE_URL="$QDIRECT" DIRECT_DATABASE_URL="$QDIRECT" npx prisma db push )   # قاعدة اللوحة (فارغة)
```
**المتوقع:** الأول ينتهي بلا أخطاء (ملف idempotent)، والثاني يطبع `Your database is now in sync with your Prisma schema`.
**وإن فشل أول سطر بـ`extension "pgcrypto" is not allowed`:** لم يُحفظ `azure.extensions` — أعد الأمر وانتظر دقيقة.

### د٣) بروفة (قبل القطع أو بعده، بلا أي تجميد — تقيس الزمن وتكشف المشاكل)

مصدر الموقع: من لوحة Supabase → Connect → **Session pooler** (المنفذ 5432؛ يعمل على IPv4 من Cloud Shell). ومصدر اللوحة: `DIRECT_DATABASE_URL` من `~/quotes.env`.
```bash
read -s -p "SOURCE_PG_URL (الموقع/Supabase): " SRC_SITE; echo
SOURCE_PG_URL="$SRC_SITE" node ops/azure/migrate-db.mjs --dry-run              # الخطة والأعداد بلا كتابة
SOURCE_PG_URL="$SRC_SITE" node ops/azure/migrate-db.mjs --skip-missing          # نسخ بروفة + تحقق
```
**المتوقع من `--dry-run`:** قائمة الجداول بترتيب النسخ وأعدادها، و«جداول المصدر غير الموجودة في الهدف» (مثل `violations` إن وُجد — تُضاف إلى `db/schema.sql` وتُعاد د٢ قبل النافذة، ولا تُتجاوز).
**المتوقع من النسخ:** `✓ تطابق تام.` (يقارن العدّ وبصمة كل جدول داخل Postgres؛ لا تُطبع قيم).
**إن لم يعمل الاتصال المباشر بـSupabase:** استعمل الأداة القديمة `node db/copy-to-azure.mjs --dry-run` (عبر PostgREST: تحتاج `SUPABASE_URL` و`SUPABASE_SERVICE_KEY`) — مواصفاتها في `ops/azure/README.md` §5. (غير مغطّاة باختبارات؛ أداة `migrate-db.mjs` مختبرة على Postgres حقيقي.)
وللوحة العروض:
```bash
read -s -p "SOURCE_PG_URL (لوحة العروض، DIRECT_DATABASE_URL): " SRC_Q; echo
SOURCE_PG_URL="$SRC_Q" AZURE_PG_URL="$QDIRECT" node ops/azure/migrate-db.mjs --dry-run
SOURCE_PG_URL="$SRC_Q" AZURE_PG_URL="$QDIRECT" node ops/azure/migrate-db.mjs --replace-nopk
```
(جداول Prisma النظامية `_prisma_migrations` تُتجاوز. جدول بلا مفتاح أساسي يُستبدل محتواه بـ`--replace-nopk`.)
سجّل مدة كل نسخة: هي مدة التجميد المتوقعة.

### د٤) نافذة التجميد (قصيرة، بإعلان مسبق)

اختر وقتاً ليس 03:00 UTC (مهمة backfill تكتب) ولا الأحد/الاثنين صباحاً. أعلن في المحادثة قبل ساعة.
```bash
az containerapp update -g $RG -n $APP -o none --set-env-vars BP_READ_ONLY=1
promote $APP
curl -s -X POST -o /dev/null -w "كتابة: %{http_code}\n" https://www.businesspartner.sa/api/otp -H "content-type: application/json" -d "{}"
curl -s https://www.businesspartner.sa/__health | head -c 200
```
**المتوقع:** `كتابة: 503` (مع `Retry-After: 120` ورسالة «الموقع في صيانة قصيرة»)، و`/__health` يُظهر `"readOnly":true`. القراءة (تصفّح الصفحات) تعمل.
ما يُرفض خلال النافذة: كل طلب غير GET/HEAD/OPTIONS إلى الموقع **وإلى لوحة العروض** (ويشمل webhooks الدفع والتوقيع — الجهات المرسِلة تعيد المحاولة؛ راجع لوحة Moyasar وTamara وDocuSign بعد الفك لأي إشعار فائت).

### د٥) النسخة الأخيرة: مرآة دقيقة ثم تحقق

```bash
SOURCE_PG_URL="$SRC_SITE" node ops/azure/migrate-db.mjs --clean --skip-missing
SOURCE_PG_URL="$SRC_Q" AZURE_PG_URL="$QDIRECT" node ops/azure/migrate-db.mjs --clean
SOURCE_PG_URL="$SRC_SITE" node ops/azure/migrate-db.mjs --verify --skip-missing
SOURCE_PG_URL="$SRC_Q" AZURE_PG_URL="$QDIRECT" node ops/azure/migrate-db.mjs --verify
```
`--clean` يُفرغ جداول الهدف ثم ينسخ، فيلتقط ما **حُذف** في المصدر منذ البروفة (وهو ما لا يلتقطه النسخ العادي). مسموح فقط لأن الهدف لم يستلم حركة بعد.
**المتوقع:** `✓ تطابق تام.` في الاثنين. **وإلا لا تكمل** — افتح الأمر في المحادثة (لن يُطبع إلا عدد الصفوف المختلفة وبصمة قصيرة لمفاتيحها).

### د٦) التبديل (والموقع ما زال في وضع القراءة)

روابط التشغيل تمرّ بمجمّع الاتصالات (المنفذ 6432):
```bash
read -s -p "AZURE_PG_URL المجمَّع (6432، قاعدة bp): " POOLED; echo
# مثال الصيغة: postgres://bpadmin:<كلمة-السر>@$HOST:6432/bp?sslmode=require
az containerapp secret set -g $RG -n $APP --secrets azure-pg-url="$POOLED" -o none
az containerapp update -g $RG -n $APP -o none --set-env-vars AZURE_PG_URL=secretref:azure-pg-url DB_DRIVER=azure AZURE_PG_POOL_MAX=8
promote $APP

read -s -p "DATABASE_URL المجمَّع للوحة (6432، bpquotes): " QPOOLED; echo
# صيغة Prisma خلف PgBouncer: ...:6432/bpquotes?sslmode=require&pgbouncer=true
az containerapp secret set -g $RG -n $QAPP --secrets database-url="$QPOOLED" direct-database-url="$QDIRECT" -o none
az containerapp update -g $RG -n $QAPP -o none --set-env-vars DATABASE_URL=secretref:database-url DIRECT_DATABASE_URL=secretref:direct-database-url
promote $QAPP
```
**المتوقع:** `الحركة على: …` للتطبيقين. افحص القراءة:
```bash
curl -s https://www.businesspartner.sa/api/otp          # المتوقع: "dbReachable":true و"dbDriver":"azure"
curl -s -o /dev/null -w "%{http_code}\n" https://www.businesspartner.sa/quotes/api/health
```
(النسخ الأقدم من `AZURE_PG_POOL_MAX=2` مصمّم لـserverless؛ هنا ٨ لكل نسخة × حتى ٦ نسخ = ٤٨ اتصالاً قبل المُجمِّع.)

### د٧) فكّ التجميد واختبار الكتابة

```bash
az containerapp update -g $RG -n $APP -o none --remove-env-vars BP_READ_ONLY
promote $APP
az postgres flexible-server firewall-rule delete -g $RG -n $PG --rule-name cloudshell-tmp --yes
```
ثم افحص: تسجيل دخول بالرمز بحساب حقيقي، إنشاء طلب واحد ورؤيته في `/my` وفي لوحة العمليات، وفتح مستند في `/quotes/d/<token>`.
**المتوقع:** كله ينجح. أي فشل → التراجع (د٨) فوراً.

### د٨) التراجع

```bash
az containerapp update -g $RG -n $APP -o none --remove-env-vars DB_DRIVER
promote $APP
# اللوحة: أعد DATABASE_URL / DIRECT_DATABASE_URL إلى قيمتَي Vercel القديمتين (محفوظتان في ~/quotes.env الذي حذفتَه؟ استعدهما من لوحة Vercel قبل حذف المشروع)
```
Supabase **لم تُمسّ** (النسخ قراءة منها فقط) وتبقى أسبوعاً. **ما كُتب على Azure بين د٧ والرجوع لا يعود وحده** — ولهذا نافذة الاختبار قصيرة. إن لزم نسخه عكسياً فهو قرار يُتخذ معاً (الأداة ترفض الكتابة في Supabase عمداً).

### د٩) بعد أسبوع

Supabase للقراءة فقط ثم إيقافها. **لا تُحذف قبل** نسخ الملفات القديمة من Supabase Storage إلى Blob (`ops/azure/README.md` §4) — القراءة ترجع إليها عند 404. وإزالة متغيّرات `SUPABASE_*` من `bp-site` بعدها.

---

## (هـ) البريد: Resend → Azure Communication Services (ACS)

**ما اكتشفتُه:** نداءات Resend في الكود ٢٣ موضعاً في ١٦ ملفاً، وACS مدعوم في موضعين فقط. بدل تعديل ١٦ ملفاً عند ١٦ مالكاً كتبتُ **جسراً** (`ops/azure/mail-bridge.mjs`): يعمل داخل خادم Azure ويحوّل كل `POST api.resend.com/emails` إلى ACS دون لمس `api/`. وجمهور النشرة (قائمة المشتركين) كان في Resend Audiences؛ الجسر يحفظه في Azure Blob.
وجسر لوحة العروض أبسط: تدعم `MAIL_PROVIDER=smtp` فنوجّهها إلى SMTP الخاص بـACS.

### هـ١) الموارد والنطاق (بوابة Azure — لا يُنصح بالأوامر هنا لاختلاف المناطق)

1. أنشئ **Email Communication Service** ثم **Communication Service** وصِل بينهما (Connect email domains). موقع البيانات: الأقرب (UAE إن ظهر).
2. أضف **نطاقاً مخصصاً** `mail.businesspartner.sa` (قرار ق٦) ← أضف في DNS صحارى سجلات: **TXT** للتحقق، **SPF** (TXT) بقيمة `v=spf1 include:spf.protection.outlook.com -all` (يجب `-all` لا `~all`)، و**DKIM** سجلّا CNAME (`selector1-azurecomm-prod-net._domainkey.mail` و`selector2-…`) بالقيم التي تعرضها البوابة. انتظر ١٥–٣٠ دقيقة حتى تصير الحالات **Verified**.
3. في النطاق ← **MailFrom addresses**: أضف `noreply` (العنوان `noreply@mail.businesspartner.sa`). ACS يرفض أي «From» غير مُدرَج.
4. **حدود الإرسال:** الحدود الافتراضية للبريد منخفضة (في الدقيقة والساعة) — راجع Service limits في بوابة ACS واطلب رفعها **قبل** أول نشرة أسبوعية. الجسر يعيد المحاولة تلقائياً عند 429 (٣ مرات) لكنه لا يصنع حصة.
5. **DMARC:** إن كان للجذر سجلّ `_dmarc` فاترك سياسته كما هي؛ النطاق الفرعي يرثها.

سلسلة الاتصال (سرّ):
```bash
ACS=<اسم مورد ACS>
ACS_CS=$(az communication list-key -g $RG -n $ACS --query primaryConnectionString -o tsv)   # لا تطبعها
```

### هـ٢) استيراد جمهور النشرة من Resend

1. Resend ← Audiences ← الجمهور ← **Export** (CSV) — يشمل حالة `unsubscribed` (لا تفقدها: من ألغى اشتراكه لا يجوز أن يستلم).
2. ارفع الملف إلى Cloud Shell (Upload) ثم:
```bash
export AZURE_STORAGE_ACCOUNT=<الحساب> ; read -s -p "AZURE_STORAGE_KEY: " AZURE_STORAGE_KEY; export AZURE_STORAGE_KEY; echo
AUD=<قيمة RESEND_AUDIENCE_ID كما في bp-site>
node ops/azure/mail-bridge.mjs import-audience $AUD ~/contacts.csv --dry-run
node ops/azure/mail-bridge.mjs import-audience $AUD ~/contacts.csv
rm -f ~/contacts.csv
```
**المتوقع:** `صفوف: N · صالحة: … · غير صالحة: … · ملغاة الاشتراك: … · مكرّرة: …` ثم `حُفظ الجمهور: M جهة اتصال.` (إحصاءات فقط، بلا عناوين).

### هـ٣) التفعيل على الموقع (يُعطّل Resend فعلياً)

```bash
read -s -p "ACS_CONNECTION_STRING: " ACS_CS; echo
az containerapp secret set -g $RG -n $APP --secrets acs-cs="$ACS_CS" -o none
az containerapp update -g $RG -n $APP -o none --set-env-vars \
  BP_MAIL_BRIDGE=acs ACS_CONNECTION_STRING=secretref:acs-cs \
  ACS_SENDER_ADDRESS=noreply@mail.businesspartner.sa RESEND_API_KEY=acs-bridge
promote $APP
```
**لماذا `RESEND_API_KEY=acs-bridge`:** ١٦ ملفاً لا ترسل إلا إذا كان المتغيّر غير فارغ؛ قيمته لم تعد مفتاحاً حقيقياً — الجسر يعترض النداء قبل أن يخرج. **أبقِ `RESEND_AUDIENCE_ID` كما هو** (هو اسم ملف الجمهور).
الجسر **يفشل مغلقاً**: لو كان ACS ناقصاً يردّ 503 ولا يمرّر شيئاً إلى Resend.
**الفحص:** اطلب رمز دخول لبريدك؛ يصل من `noreply@mail.businesspartner.sa`. افتح «Show original» في Gmail: `SPF: PASS` و`DKIM: PASS` و`DMARC: PASS`. وأجرِ طلباً ينتج **فاتورة بمرفق PDF** وتأكد أنها تصل بمرفقها. وفي السجل `mail_bridge ready:true`.

لوحة العروض:
```bash
az containerapp secret set -g $RG -n $QAPP --secrets smtp-pass="<سرّ تطبيق Entra>" -o none
az containerapp update -g $RG -n $QAPP -o none --set-env-vars \
  MAIL_PROVIDER=smtp SMTP_HOST=smtp.azurecomm.net SMTP_PORT=587 SMTP_SECURE=0 \
  SMTP_USER=<اسم SMTP Username من مورد ACS> SMTP_PASS=secretref:smtp-pass \
  "MAIL_FROM=Business Partner Solutions <noreply@mail.businesspartner.sa>"
promote $QAPP
```
(SMTP في ACS: منفذ 587 مع STARTTLS؛ اسم المستخدم هو «SMTP Username» الذي تنشئه في مورد ACS مربوطاً بتطبيق Entra (أو الصيغة `اسم-المورد.معرّف-التطبيق.معرّف-المستأجر`)، وكلمة السر سرّ التطبيق.)
**الفحص:** أرسل عرض سعر لنفسك من `/quotes/admin`.

### هـ٤) التراجع

```bash
az containerapp update -g $RG -n $APP -o none --remove-env-vars BP_MAIL_BRIDGE
az containerapp secret set -g $RG -n $APP --secrets resend-key="<مفتاح Resend الحقيقي من لوحته>" -o none
az containerapp update -g $RG -n $APP -o none --set-env-vars RESEND_API_KEY=secretref:resend-key
promote $APP
```
(لا تحذف حساب Resend قبل أسبوع استقرار.) وجمهور النشرة الذي أُضيف في الأثناء يبقى في Blob؛ صدّره قبل الرجوع إن لزم.

### هـ٥) بعد أسبوع

ألغِ اشتراك Resend. ونظّف سجلات DNS التي أضافها Resend وحدها (SPF include، DKIM، MX الفرعي) **بعد** أن تتأكد من أسمائها في لوحته — لا تحذف سجلاً لا تعرف صاحبه.

---

## (و) نافذة المراقبة والتراجع

### و١) التنبيهات (مرة واحدة، قبل القطع)

```bash
export RG APP QAPP OWNER_EMAIL=<بريد-المالك> FD_PROFILE=$AFD LAW
az extension add --name scheduled-query --upgrade
bash ops/azure/alerts.sh create
bash ops/azure/alerts.sh list
```
ينشئ: ٥xx عند Front Door (>٥٪)، صحة الأصل (<٩٠٪)، ٥xx من التطبيق، النسخ < ٢، الذاكرة > ٨٥٪، إعادات التشغيل، لوحة العروض (٥xx/توقف/ذاكرة)، وتنبيهات سجلات: أخطاء الخادم (>١٠/٥د)، `egress_blocked`، فشل المهام المجدولة، وبلوغ سقف السجل اليومي.
وسقف السجل: `az monitor log-analytics workspace update -g $RG -n $LAW --set workspaceCapping.dailyQuotaGb=1`.
**المتوقع:** أسطر `✓ bp-…`. (الأوامر من توثيق Azure Monitor ولم تُجرَّب على اشتراكك؛ إن رفض أحدها فاعرض الرسالة.)

### و٢) استعلامات السجلات (Log Analytics → Logs)

```kusto
// أخطاء الخادم الأخيرة
ContainerAppConsoleLogs_CL | where ContainerAppName_s == "bp-site" | where Log_s has '"level":"error"' | order by TimeGenerated desc | take 50
// نسبة ٥xx بالدقيقة (السجل JSON: s = رمز الحالة)
ContainerAppConsoleLogs_CL | where ContainerAppName_s == "bp-site" | extend j = parse_json(Log_s) | where isnotnull(j.s)
| summarize total = count(), e5xx = countif(toint(j.s) >= 500) by bin(TimeGenerated, 1m) | extend pct = 100.0 * e5xx / total | order by TimeGenerated desc
// أبطأ المسارات
ContainerAppConsoleLogs_CL | where ContainerAppName_s == "bp-site" | extend j = parse_json(Log_s) | where toint(j.ms) > 3000 | project TimeGenerated, m=j.m, p=j.p, s=j.s, ms=j.ms | order by ms desc | take 30
// مهام الجدولة
ContainerAppConsoleLogs_CL | where ContainerGroupName_s startswith "bp-cron" | project TimeGenerated, ContainerGroupName_s, Log_s | order by TimeGenerated desc | take 20
```
السجل لا يحمل الاستعلام ولا عنوان IP الزائر عمداً. (إن لم يوجد الجدول `ContainerAppConsoleLogs_CL` فجرّب `ContainerAppConsoleLogs` وعمود `Log`.)

### و٣) جدول المراقبة

| متى | ماذا تفحص | الأمر |
|---|---|---|
| أول ساعة (كل ٥ دقائق) | الصحة ونسبة ٥xx والدخول بالرمز | `curl -s https://www.businesspartner.sa/__health` · و٢ · دخول بالرمز |
| ٢٤ ساعة | الذاكرة (`rssMb` في `/__health`)، إعادات التشغيل، فواتير/دفعات، مهمة backfill الصباحية | `az containerapp revision list -g $RG -n $APP -o table` · `bash ops/azure/cron-switch.sh status` |
| أول أحد ٠٦:٠٠ UTC | **النشرة الأسبوعية وصلت مرة واحدة** (راجع صندوقك) | `bash ops/azure/cron-switch.sh status` |
| أول اثنين ٠٥:٠٠ UTC | مهمة جمع الوظائف | نفسه |
| ٧ أيام | لا حركة على Vercel، لا ٥xx، لا تنبيه فائت | لوحة Vercel (Requests ≈ ٠) |

### و٤) متى نتراجع؟

ارجع **فوراً** عند أي مما يلي (قرارك): ٥xx فوق ٢٪ لعشر دقائق، تعذّر الدخول بالرمز، دفعة تفشل أو تتكرر، رابط عرض/عقد قديم لا يفتح، أو أي شك.

### و٥) التراجع الكامل إلى Vercel (٥–١٠ دقائق) — بهذا الترتيب

1. **المجدول أولاً (القديم يُطفأ قبل الجديد):** `bash ops/azure/cron-switch.sh off` ثم فعّل Vercel Cron من اللوحة.
2. **DNS:** `www` → أعد سجلّ **A** القديم (محفوظ من ب٠) واحذف CNAME؛ الأبكس → A القديم. TTL ٣٠٠ث.
3. **تحقّق:** `dig +short www.businesspartner.sa` يعيد عنواني Vercel؛ `curl -sI https://www.businesspartner.sa/` بلا `x-azure-ref`.
4. لا يُحذف شيء في Azure (الموارد تبقى للتشخيص). **الحالة المشتركة (قاعدة/Notion/Blob) لا تُصالَح** — ما دمتَ لم تُجرِ (د) فهي واحدة للموقعين. وإن كنتَ أجريتَ (د) فاقرأ د٨ أولاً.
5. Vercel حيّ طوال الوقت: **لا يُحذف مشروعه ولا يُفصل نطاقه ولا يُحذف منه شيء قبل نهاية (ز).** ولا تُدفع دفعة بعلامة النشر خلال النافذة (يبقى الموقعان متطابقين).

---

## (ز) متى يحذف المالك مشروعَي Vercel

**الحذف قرارك ومن لوحتك** (Project → Settings → Delete). لا أحذفهما أنا. افعله فقط حين تكون كل البنود صحيحة:

- [ ] مرّت **٧ أيام** على تحويل DNS بلا تراجع ولا تنبيه حرج، و«Requests» على مشروع Vercel الرئيسي ≈ ٠ (لا زائر يصله).
- [ ] `bp-quotes` يعمل على Azure (أ) و`egressBlocked` = ٠ طوال الأسبوع، ومستند قديم من `/quotes/d/<token>` يفتح، وتسجيلات Tamara/DocuSign/Inngest/Moyasar لا تحمل `vercel.app` (أ٩).
- [ ] المهام الثلاث عملت على Azure مرة على الأقل بنجاح (النشرة مرة واحدة فقط)، وVercel Cron معطَّل.
- [ ] سير n8n `catalog-sync` لا يستدعي Vercel Deploy Hook (ج٤)، ولا سير آخر يشير إلى Vercel:
      `grep -rn "vercel" ops/n8n/ n8n/ .github/ vercel.json | grep -v ignoreCommand` (المتوقع: لا شيء سوى `vercel.json` نفسه).
- [ ] نسخت متغيّرات البيئة من المشروعين إلى مكان آمن إن أردت أرشيفاً (لن يمكن استرجاعها بعد الحذف).
- [ ] قاعدة البيانات: ليست شرطاً للحذف (Supabase مستقلة عن Vercel)، لكن لا تُحذف Supabase قبل (د٩).

**الترتيب عند الحذف:** ١) أزل النطاقين من مشروع Vercel الرئيسي (Settings → Domains) ٢) احذف `bp-quotes` ٣) احذف المشروع الرئيسي ٤) أزل سجلّ TXT الخاص بالتحقق من Vercel من DNS إن وُجد (`_vercel`) — بعد التأكد أنه لا يخصّ غيره.
وبعدها يأتي دوري: تحديث `CLAUDE.md` §1 (الهدف الواحد = Azure، ومسح مرجع Vercel والسقف ١٢ دالة) و`docs/azure-only-2026-10-16.md` — بأمرك.
ولا قيمة بعد الحذف لمشكلة «٩٥.٦GB من ١٠GB»: تزول بالحذف.

---

## (ح) تسلسل يوم القطع في مكان واحد

| # | الخطوة | القسم | ملاحظة |
|---|---|---|---|
| ١ | تأكّد أن (أ) تمّ و`egressBlocked` = ٠، و(ب١–ب٤) تمّ، والتنبيهات (و١) فعّالة، وTTL ≤ ٣٠٠ | أ، ب، و١ | قبل البدء |
| ٢ | جمّد نشر Vercel: لا كوميت بعلامة نشر ولا إعادة نشر | — | حتى نهاية النافذة |
| ٣ | **أوقف Vercel Cron ثم شغّل `cron-switch.sh on`** | ج١ | الترتيب مفروض |
| ٤ | حوّل `www` إلى CNAME (Front Door) | ب٥ | الدقيقة صفر |
| ٥ | فحوص ب٦ (الصفحات، الدخول، `/quotes`، دفعة اختبار) | ب٦ | أول ٣٠ دقيقة |
| ٦ | الأبكس (بعد منتصف الليل) | ب٥-٢ | |
| ٧ | نافذة المراقبة | و | ٧ أيام |
| ٨ | عند أي مشكلة | و٤–و٥ | ترتيب التراجع مكتوب |

## ما لم يُتحقَّق منه هنا (بصراحة)

- لا Docker ولا Azure في بيئة العمل: لم تُبنَ صورتا `bp-site` و`bp-quotes` ولم يُنفَّذ أي أمر `az`. أُثبت محلياً: `next build` للوحة العروض بنجاح، ومرور خادم Azure إلى لوحة Next حقيقية عبر `BP_ORIGIN_MAP`، وأدوات النقل والجسر والمجدول على Postgres حقيقي (١٨) وعلى `az` مُحاكى.
- أعلام `az afd route create` للتخزين المؤقت وأوامر `az monitor scheduled-query` تختلف بين إصدارات CLI — يرد عليك بخطأ واضح ويبقى الطريق عبر البوابة.
- اسم المورد الداخلي `http://bp-quotes` داخل البيئة: موثَّق في Container Apps لكنه لم يُجرَّب هنا (بديله في أ٦).
- هل Elm (نفاذ) واعتماد تشترطان قائمة IP ثابتة للمُرسِل — اسألهما قبل القطع (خطة 2026-10-11 §1.6).
- صحارى: لا أعرف قدرات لوحتها (ALIAS، تعديل نوع السجل) — ق٤.
- تكلفة PostgreSQL General Purpose وACS: تقدير يُعاد في Pricing Calculator.

## (و) متغيّرات الإنتاج التي لا يُصدّرها فيرسل (2026-10-17)

فيرسل يخفي قيم المتغيّرات المعلَّمة Sensitive فلا يُصدّرها `vercel env pull`. هذه ناقصة في حاوية الإنتاج `bp-site` وتُعبّأ يدوياً من مصدرها:

| المتغيّر | المصدر | ملاحظة |
|---|---|---|
| `DOCUSIGN_INTEGRATION_KEY` | DocuSign ← Settings ← Apps and Keys | معرّف التطبيق |
| `DOCUSIGN_USER_ID` | الصفحة نفسها «My Account Information» | `e85c6b78-9a07-439d-ab33-22117b31eade` |
| `DOCUSIGN_ACCOUNT_ID` | الصفحة نفسها «API Account ID» | `100e446c-4fc4-46a1-9acb-0e65add1e12a` |
| `DOCUSIGN_ENV` | `production` | الافتراضي في الكود `demo` |
| **`DOCUSIGN_BASE_URI`** | الصفحة نفسها «Account Base URI» | **`https://na4.docusign.net`**. الافتراضي في `api/_docusign.js` للإنتاج هو `na1`، وحساب المالك على `na4`، فبدونه يفشل التوقيع |
| `DOCUSIGN_PRIVATE_KEY` | زوج RSA في الصفحة نفسها (يظهر مرة واحدة عند الإنشاء) | سرّ. سطر واحد بفواصل `\n` |
| `GITHUB_TOKEN` | GitHub ← Fine-grained token على المستودع | سرّ |
| `EMPLOYER_CODES` | قائمة المالك لأكواد أصحاب العمل | سرّ |

تُكتب في ملف على Cloud Shell (لا في المحادثة) ثم:

```bash
node ops/azure/load-env.mjs --file ~/prod.env --app bp-site --rg rg-bp-web && rm -f ~/prod.env
```

أول استعمال لمفتاح تكامل جديد على حساب DocuSign يطلب **موافقة مرة واحدة** من المستخدم (رابط consent). إن ظهر `consent_required` عند أول توقيع فتُمنح الموافقة من الرابط الذي يُرجعه DocuSign.

مفاتيح الذكاء الخارجية (Groq وGemini وGrok وAnthropic وElevenLabs) لا تُنقل عن قصد (قرار المالك: Azure فقط).
`DATABASE_URL` و`DIRECT_DATABASE_URL` تخصّ لوحة العروض `bp-quotes` وتبقى على فيرسل حتى تُنقل.
