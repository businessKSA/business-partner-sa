# نقل لوحة العروض والعقود إلى Azure

قرار المالك (2026-10-16): اللوحة لا تُحذف ولا تُدمج. تنتقل كما هي إلى
**Azure Container Apps**، وتبقى تحت `businesspartner.sa/quotes`، وقاعدتها تنتقل
إلى **Azure Database for PostgreSQL Flexible Server**.

> هذا الملف مسودة للمراجعة. لم يُشغَّل فيه أي أمر `az` أو `docker push`.
> كل ما هو «مقروء» قُرئ من الشيفرة فعلاً، وما هو «استنتاج» موسوم بذلك.

> **تعارض مع التعليمات القائمة:** `../CLAUDE.md` (البند 1) و`quotes/CLAUDE.md` و
> `quotes/AGENTS.md` و`../docs/quotes-cutover.md` كلها تقول إن اللوحة «تُدمج
> وتُحذف». هذا القرار يلغيها. تحتاج تحديثاً بعد موافقتك، ولم أعدّلها (خارج نطاقي أو
> تخص غيري).

---

## (أ) ما يلزم في الصورة

الملف: `quotes/Dockerfile` (+ `.dockerignore`). البناء من داخل `quotes/`:
`docker build -t bp-quotes quotes/`.

| الحاجة | كيف تُلبّى |
|---|---|
| Next.js 16 بـ `basePath: '/quotes'` على المنفذ 3000 | `next start -p 3000 -H 0.0.0.0` — الروابط كلها تحت `/quotes` |
| Prisma | `npm run build` = `prisma generate && next build` (لا يلمس القاعدة). المحرك يحتاج `openssl` وهو مثبّت |
| توليد PDF | Chromium من النظام (`apt chromium`) مع `PDF_DRIVER=local` و`CHROMIUM_PATH=/usr/bin/chromium`. `pdf.ts` يمرّر `--no-sandbox` و`--disable-dev-shm-usage` أصلاً. حزمة `@sparticuz/chromium` تبقى في `node_modules` ولا تُستعمل (وضع `serverless` لـVercel/Lambda) |
| رابط الطباعة الداخلي | `INTERNAL_URL=http://localhost:3000/quotes` — **يجب أن يحمل `/quotes`** لأن `printUrl()` تلحق به `/d/<token>/print` |
| الخط العربي | Tajawal موجود في `public/fonts` (محلي، لا شبكة) |
| التخزين | `/data/storage` ويُركَّب عليه Azure Files (انظر الفقرة التالية) |
| المنفِّذ | مستخدم `node` (uid 1000)، و`tini` كمدير عمليات، و`HEALTHCHECK` على `/quotes/api/health` |
| الأسرار | لا شيء في الصورة. الأسرار من Container Apps secrets (يفضّل ربطها بـKey Vault) |

التوصية لحجم الحاوية (استنتاج): 1 vCPU و2 GiB على الأقل، وأقل عدد نسخ = 1 حتى لا يبدأ
Chromium من الصفر عند كل طلب PDF.

الطابور: `QUEUE_DRIVER=inline` (الافتراضي في الصورة). الحاوية تعمل باستمرار فلا حاجة
إلى Inngest. `maxDuration` في `d/[token]/pdf` و`docx` يتجاهلها `next start`؛ مهلة
الدخول في Container Apps (نحو 240 ثانية) تكفي.

### ما لم أغيّره عمداً
- `next.config.mjs`: إضافة `output: 'standalone'` تصغّر الصورة، لكنها تعديل في شيفرة
  التطبيق فتركتها. الصورة تعمل بدونها.
- `package.json` فيه `@anthropic-ai/sdk` ولم يعد مستعملاً (انظر «د»). حذفه يغيّر
  `package-lock.json` ويحتاج `npm install`، فلم ألمسه. ينظّفه من يملك صلاحية التثبيت.

---

## ما الذي يجري عند أول إقلاع (قراءة `prisma/provision.ts`)

`vercel-build` = `prisma generate && tsx prisma/provision.ts && next build`.
**الصورة لا تشغّل `provision.ts` إطلاقاً، لا عند البناء ولا عند الإقلاع.**

ما يفعله `provision.ts` (مقروء)، وما فيه من خطر:

1. **حارس البيئة معكوس خارج Vercel.** الشرط: `if (env && env !== 'production') return`.
   حيث `env = process.env.VERCEL_ENV`. خارج Vercel المتغير غير موجود فيُعامَل التشغيل
   كإنتاج ويمضي إلى القاعدة. تشغيله من حاوية أو جهاز ضد `DATABASE_URL` حقيقي = لمس
   قاعدة الإنتاج دون سؤال.
2. **`prisma db push` على قاعدة فيها بيانات.** بلا `--accept-data-loss` يتوقف عند التغيير
   الهدّام للأعمدة غير الفارغة (جيد)، لكنه يزامن القاعدة مع `schema.prisma` كاملاً:
   أي جدول أو عمود أو فهرس موجود في القاعدة وغير موجود في المخطط يُعدّ فائضاً ويُزال إن
   كان فارغاً (سلوك Prisma المعروف — استنتاج لا اختبار). ولا يُكتب سجل بما غُيّر.
3. **`prepareConstraints`**: `ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS
   "notionPageId"` ثم `CREATE UNIQUE INDEX IF NOT EXISTS`. مُعاد التشغيل بأمان، لكن لو
   وُجد تكرار في `notionPageId` يفشل ويُسقط العملية. العمود موجود في المخطط (سطر 550)
   فالنسخة المستعادة من الإنتاج ستحمله أصلاً.
4. **البذرة**: تعمل إن كان `Service.count() == 0`. **الخطر هنا:** لو أقلعت اللوحة على
   قاعدة Azure الفارغة قبل `pg_restore` لزُرعت بيانات أولية، ثم تتصادم مع الاستعادة. والبذرة
   تستعمل `upsert` فتعيد أسعار الكتالوج إلى قيمها الأصلية لو شُغّلت على قاعدة فيها تعديلات.
5. **استيراد كتالوج الموقع**: يقرأ `../site/assets/data/catalog.json` (سطر 73 من
   `catalog-import.ts`). هذا الملف **خارج سياق الصورة**، فلا يعمل داخلها. ينشئ الناقص ولا
   يكتب فوق الأسعار، لكنه لن يعمل في Azure على أي حال.

**القرار المقترح لأول إقلاع في Azure: لا شيء يلمس القاعدة.**
- المخطط والبيانات يأتيان من `pg_restore` (الفقرة ج)، لا من `db push` ولا بذرة.
- لا يُنشأ الحاوية قبل اكتمال الاستعادة والتحقق.
- أي تغيير مخطط لاحق: `npx prisma migrate diff --from-url "$NEW_DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script`
  يُقرأ بالعين أولاً، ثم يُطبَّق عمداً (مهمة Container Apps Job منفصلة)، لا تلقائياً مع كل نشرة.
- استيراد الكتالوج من الموقع يبقى عبر المسار القائم داخل اللوحة نفسها
  (`/admin/catalog` ونقطة `src/app/actions.ts:663` التي تجلب `catalog.json` من
  `SITE_URL` عبر الشبكة)، لا عبر `provision.ts`.

---

## ما هو خاص بـVercel ويلزم حسمه

| الاستعمال | الموضع | ما يلزم في Azure |
|---|---|---|
| `process.env.VERCEL` | `src/lib/storage.ts:42` (جذر التخزين الافتراضي `/tmp/storage`) | **لا يُضبط `VERCEL`.** الصورة تضبط `STORAGE_ROOT=/data/storage` صراحةً |
| `process.env.VERCEL_ENV` | `prisma/provision.ts:52` | لا يُستعمل في Azure (انظر أعلاه) |
| `PDF_DRIVER=serverless` | `src/lib/pdf.ts` | لا يُستعمل؛ `local` |
| `QUEUE_DRIVER=inngest` + `/api/inngest` | `src/lib/queue`, `src/app/api/inngest` | `inline`. المسار يبقى لكنه خامل |
| `vercel.json` (`vercel-build`, `ignoreCommand`) | `quotes/vercel.json` | لا أثر في Azure. يبقى ما دام مشروع Vercel القديم قائماً (حذف جذر مشروع حيّ يكسر البناء) |
| `*.vercel.app` | `src/lib/base.ts` (`normalize`) | مضيف Azure (`*.azurecontainerapps.io`) **لا** يُقوَّم إلى النطاق الرسمي كما يُقوَّم vercel.app، لذا **`APP_URL` إلزامي**: `https://www.businesspartner.sa/quotes` |

التخزين: السائقان `local` و`s3` فقط. لا سائق Azure Blob، و`s3` يتطلب خدمة متوافقة مع S3
(Blob لا يتحدث S3). **الخيار الأقل تعديلاً: `STORAGE_DRIVER=local` على قرص Azure Files
مركَّب في `/data/storage`** (خيارات التركيب `uid=1000,gid=1000,file_mode=0770,dir_mode=0770`).
المفاتيح (`key`) محفوظة في جدول `FileAsset`، فنسخ الملفات بالمسارات نفسها يكفي.
سؤال مفتوح: ماذا يستعمل الإنتاج اليوم؟ (انظر الأسئلة).

---

## (ب) متغيرات البيئة التي يستعملها التطبيق

مستخرجة بـ`grep process.env` من `src/` و`scripts/` و`prisma/` و`next.config.mjs`. بلا قيم.

### أسرار (تذهب إلى Container Apps secrets / Key Vault)
`DATABASE_URL` · `DIRECT_DATABASE_URL` · `SESSION_SECRET` · `AZURE_OPENAI_API_KEY` ·
`SMTP_USER` · `SMTP_PASS` · `RESEND_API_KEY` · `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` ·
`INNGEST_EVENT_KEY` · `INNGEST_SIGNING_KEY` · `DOCUSIGN_INTEGRATION_KEY` ·
`DOCUSIGN_PRIVATE_KEY` · `DOCUSIGN_CONNECT_HMAC_KEY` · `MOYASAR_SECRET_KEY` ·
`MOYASAR_WEBHOOK_SECRET` · `TAMARA_API_TOKEN` · `TAMARA_NOTIFICATION_TOKEN` ·
`WHATSAPP_TOKEN` · `PANEL_BRIDGE_TOKEN` · `CATALOG_SYNC_TOKEN` · `CATALOG_WEBHOOK_TOKEN`

### إعدادات (غير سرية)
- **الأساس:** `APP_URL` · `NODE_ENV` · `ADMIN_EMAIL` · `SITE_URL` · `SITE_API_URL`
- **البريد:** `MAIL_PROVIDER` · `MAIL_FROM` · `NOTIFY_EMAIL` · `SMTP_HOST` · `SMTP_PORT` · `SMTP_SECURE`
- **التخزين:** `STORAGE_DRIVER` · `STORAGE_ROOT` · `S3_BUCKET` · `S3_REGION` · `S3_ENDPOINT` · `S3_SIGNED_URL_TTL`
- **الطابور:** `QUEUE_DRIVER` · `QUEUE_CONCURRENCY`
- **PDF:** `PDF_DRIVER` · `CHROMIUM_PATH` · `PLAYWRIGHT_BROWSERS_PATH` · `INTERNAL_URL`
- **الوكيل الذكي:** `AZURE_OPENAI_ENDPOINT` · `AZURE_OPENAI_DEPLOYMENT`
- **DocuSign:** `DOCUSIGN_MODE` · `DOCUSIGN_USER_ID` · `DOCUSIGN_ACCOUNT_ID` · `DOCUSIGN_AUTH_BASE` · `DOCUSIGN_API_BASE` · `DOCUSIGN_PRIVATE_KEY_PATH`
- **الدفع:** `PAYMENT_PROVIDER` · `MOYASAR_PUBLISHABLE_KEY` · `MOYASAR_FORM_VERSION` · `MOYASAR_APPLE_PAY` · `MOYASAR_STC_PAY` · `PAY_TAMARA` · `TAMARA_MODE` · `TAMARA_MIN_AMOUNT` · `TAMARA_MAX_AMOUNT` · `TAMARA_INSTALMENTS`
- **واتساب / دفترة / الكتالوج:** `WHATSAPP_MODE` · `WHATSAPP_PHONE_ID` · `DAFTRA_MODE` · `CATALOG_WEBHOOK_URL`

### لا تُضبط في Azure إطلاقاً
`VERCEL` · `VERCEL_ENV` · **`DEV_SHOW_MAGIC_LINK`** (إن كانت `1` تعرض الشاشةُ رابط
دخول المدير بدل إرساله بالبريد — `actions.ts:245,290` — أي استيلاء على لوحة الإدارة).
`ANTHROPIC_API_KEY` و`AGENT_MODEL` أُزيلا من الشيفرة (انظر «د»).

### أفخاخ القيم الافتراضية (مقروءة)
- `DOCUSIGN_MODE` غير مضبوط ⇒ **`mock`** (`docusign/jwt.ts:40`): تواقيع محاكاة. اضبطه صراحةً.
- `PAYMENT_PROVIDER` غير مضبوط ⇒ `mock` (`payments/index.ts:43`).
- `MAIL_PROVIDER` غير مضبوط ⇒ `log`: لا رسالة تصل أحداً (`mailer.ts:84`).
- `WHATSAPP_MODE` ≠ `api` ⇒ روابط فقط. `DAFTRA_MODE` ≠ `live` ⇒ صامت.
- `SESSION_SECRET` أقصر من 16 حرفاً ⇒ يرمي خطأ عند أول استعمال. **يجب أن يبقى القيمة نفسها**
  التي في الإنتاج الحالي وإلا بطلت كل الجلسات الجارية (قرار تشغيلي).
- متغيرات في `.env.example` ولا يقرؤها الكود: `DAFTRA_API_KEY` و`DAFTRA_SUBDOMAIN` و`DAFTRA_API_*`
  و`DAFTRA_VAT_TAX_ID` (الدفترة تمرّ عبر جسر الموقع: `SITE_API_URL` + `PANEL_BRIDGE_TOKEN`).

---

## (ج) نقل قاعدة البيانات (يشغّله المالك بنفسه)

**قاعدة الأمان:** رابط القاعدة القديمة يُمرَّر كمتغير بيئة في طرفية المالك، ولا يُطبع ولا
يُلصق في محادثة ولا في ملف. الأوامر تستعمل `"$OLD_DIRECT_URL"` فقط.

### قبل البدء
1. أنشئ Flexible Server بالإصدار الرئيسي نفسه للقديمة (`SHOW server_version;` على القديمة)،
   بمنطقة قريبة (Saudi/UAE/Sweden حسب سياسة البيانات)، وTLS مفعّل، وجدار حماية يسمح لجهازك
   ولشبكة Container Apps فقط.
2. تحقق من الإضافات: `\dx` على القديمة، وفعّلها في Azure (allow-list) إن وُجدت أي واحدة.
3. استعمل **الرابط المباشر** للقديمة (`DIRECT_DATABASE_URL`) لا المجمِّع (pgbouncer)، فـ`pg_dump` لا يعمل خلفه.
4. جهّز مساراً مشفّراً للتفريغ: الملف يحوي بيانات عملاء (هويات وهواتف وعقود).

### تجميد الكتابة
اللوحة تكتب عند كل دخول (روابط سحرية وجلسات) وكل فتح مستند، وتستقبل webhooks (مُيسّر وتمارا
وDocuSign). أثناء النافذة:
1. أعلن نافذة قصيرة (ويفضّل خارج ساعات الدوام).
2. اجعل القديمة للقراءة فقط (يمكن عكسه بأمر):
   ```sql
   ALTER DATABASE <db> SET default_transaction_read_only = on;
   -- ثم أنهِ الاتصالات القائمة ليسري المفعول:
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE datname = '<db>' AND pid <> pg_backend_pid();
   ```
   عندها تفشل أي كتابة بخطأ صريح بدل أن تضيع بصمت. مزوّدو webhooks يعيدون المحاولة؛ تحقق من
   سياسة إعادة المحاولة لكل منهم قبل النافذة (استنتاج، لم يُفحص).
3. للرؤية الأنظف: يُحوَّل `rewrite` على الموقع إلى صفحة صيانة خلال النافذة
   (`vercel.json` في الجذر — خارج نطاقي، يتولاه مالك المنصة).

### التفريغ والعدّ
```bash
# يُضبط في طرفيتك فقط. لا تُطبع. (read -s يخفي الإدخال)
read -rs OLD_DIRECT_URL; export OLD_DIRECT_URL
read -rs NEW_URL;        export NEW_URL     # رابط Azure مع sslmode=require

# أعداد الصفوف الفعلية لكل جدول (ليست التقديرية)
cat > counts.sql <<'SQL'
SELECT table_name,
       (xpath('/row/c/text()',
          query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                       false, true, '')))[1]::text::bigint AS rows
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
SQL

psql "$OLD_DIRECT_URL" -At -F $'\t' -f counts.sql > counts.before.tsv
wc -l counts.before.tsv         # يُتوقع 25 جدولاً (عدد model في schema.prisma)

pg_dump "$OLD_DIRECT_URL" --format=custom --no-owner --no-acl --file=bpq.dump
pg_restore --list bpq.dump | head   # فحص سريع أن الملف سليم
```

### الاستعادة والتحقق
```bash
# على قاعدة Azure الفارغة. single-transaction: إما كل شيء أو لا شيء.
pg_restore --dbname="$NEW_URL" --no-owner --no-acl --single-transaction --exit-on-error bpq.dump

psql "$NEW_URL" -At -F $'\t' -f counts.sql > counts.after.tsv
diff counts.before.tsv counts.after.tsv && echo "الأعداد متطابقة"

# انحراف المخطط (قراءة فقط — لا يغيّر شيئاً). يجب أن يكون الناتج فارغاً:
cd quotes && DIRECT_DATABASE_URL="$NEW_URL" DATABASE_URL="$NEW_URL" \
  npx prisma migrate diff --from-url "$NEW_URL" --to-schema-datamodel prisma/schema.prisma --script
```
وراجع أيضاً: آخر `Counter` (ترقيم المستندات)، وآخر 3 مستندات وفواتير بالعين، وفتح رابط
`/d/<token>` واحد قديم.

بعد النجاح: احذف `bpq.dump` وملفات العدّ من جهازك بعد أن يتأكد المالك (بيانات عملاء).

### التحويل (cutover)
1. انشر الصورة على Container Apps بمتغيرات الفقرة (ب) و`DATABASE_URL` الجديد.
   **اختبر على الرابط الداخلي لـContainer Apps قبل أي تحويل:** `/quotes/api/health`، دخول المدير،
   وتوليد PDF لمستند (يختبر Chromium)، وتنزيل ملف مرفوع (يختبر التخزين).
2. حوّل مصدر الـrewrite لـ`/quotes/*` (و`/quotes/d/:token`) في `vercel.json` الجذر من
   `bp-quotes-three.vercel.app` إلى مضيف Azure. (خارج نطاقي.) وراجع أن الموقع لا يضبط
   `QUOTES_PANEL_RETIRED=1` — اللوحة لم تعد متقاعدة.
3. أعد توجيه عناوين webhooks في لوحات مُيسّر وتمارا وDocuSign Connect **فقط إن** كانت تشير مباشرة
   لمضيف Vercel القديم؛ إن كانت تشير إلى `businesspartner.sa/quotes/...` فلا تغيير.
4. افحص `SITE_API_URL` و`PANEL_BRIDGE_TOKEN` على الطرفين (الموقع ينادي `/api/bridge/*` على اللوحة،
   واللوحة تنادي الموقع).

### خطة التراجع
- **لا تحذف ولا تعدّل القاعدة القديمة** ولا مشروع Vercel القديم خلال فترة مراقبة (اقتراح: 14 يوماً).
  القديمة لم تُمسّ إلا بوسم القراءة فقط.
- التراجع قبل أول كتابة على Azure: أعد `rewrite` إلى Vercel، ثم
  `ALTER DATABASE <db> SET default_transaction_read_only = off;`. لا فقد.
- التراجع بعد كتابات على Azure: أي مستند أو توقيع أو دفعة سُجّلت هناك **ليست** في القديمة. الخيار:
  `pg_dump` من Azure ثم استعادتها فوق القديمة بعد مقارنة، أو الاستمرار على Azure وإصلاح الخلل
  أماميّاً. اقتراح: قرّر قبل التحويل ما إذا كانت نافذة التراجع بعد الكتابة مقبولة.
- لقطة (backup) على Azure قبل التحويل وبعده؛ فعّل PITR على الخادم.

---

## (د) ما يتعارض مع CLAUDE.md (استعمال مدفوع خارج Azure)

الترتيب الإلزامي في `../CLAUDE.md` §2.6: Azure أولاً، ثم مجاني حقيقي، والمدفوع خارج Azure ممنوع.

### 1) نُفِّذ استبداله: `ANTHROPIC_API_KEY` ← Azure OpenAI (قرار المالك 2026-10-16)

الاستدعاء الوحيد لـAnthropic في `quotes/`:

| الموضع | قبل | بعد |
|---|---|---|
| `src/lib/agent.ts:6` | `import Anthropic from '@anthropic-ai/sdk'` | حُذف (يُستعمل `fetch` المدمج، فلا تبعية جديدة ولا تثبيت) |
| `src/lib/agent.ts:62` `agentReady()` | `ANTHROPIC_API_KEY` | الثلاثة معاً: `AZURE_OPENAI_ENDPOINT` و`AZURE_OPENAI_API_KEY` و`AZURE_OPENAI_DEPLOYMENT` |
| `src/lib/agent.ts:66` `agentModel()` | `AGENT_MODEL` (افتراضي `claude-opus-5`) | `AZURE_OPENAI_DEPLOYMENT` (اسم النشر، مثل `bp-main`) |
| `src/lib/agent.ts:112-121` | `client.messages.create({ model, max_tokens: 16000, system, messages })` | `POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=2025-03-01-preview` برأس `api-key`، والنظام رسالة `role: system`، والسقف `max_tokens: 16000` |
| `src/lib/agent.ts:~125` | `res.stop_reason === 'max_tokens'` | `choices[0].finish_reason === 'length'` |
| `src/lib/agent.ts:~131` | تجميع كتل `text` من `res.content` | `choices[0].message.content` |
| `src/app/admin/agent/page.tsx:21` و`src/app/admin/page.tsx:76` | رسالة تذكر `ANTHROPIC_API_KEY` | تذكر `AZURE_OPENAI_*` |
| `.env.example` · `README.md:161-163` · `scripts/agent-check.ts:4` | `ANTHROPIC_API_KEY`/`AGENT_MODEL` | `AZURE_OPENAI_*` |

السلوك الآمن: إن نقص أي من المتغيرات الثلاثة يرمي `AgentUnavailable` وتظهر الشاشة «غير مفعّل»؛
بقية النظام لا يتأثر (كما كان). القيم المحسومة: المورد `bp-ai-ksa-2026` (Sweden Central)،
النشر `bp-main` (gpt-4.1)، والإصدار `2025-03-01-preview` — الأولان قيمتان للبيئة لا للملفات.
`AZURE_OPENAI_ENDPOINT` يُتوقع بصيغة `https://bp-ai-ksa-2026.openai.azure.com`.

**لم يُختبر:** لا استدعاء حيّ (لا مفتاح ولا شبكة) ولا `tsc` ولا `next build` (لا `node_modules`).
الاختلافات المحتملة بين نموذجين: التزام gpt-4.1 بإخراج JSON فقط (الاستخراج `extractJson` يتسامح مع
```json```)، وجودة العربية والطول (سقف 16000 رمز ضمن حد gpt-4.1)، وقد يلزم لاحقاً
`response_format: { type: 'json_object' }`. يُنصح بتشغيل نموذج تجريبي من `/admin/agent` قبل التحويل.

### 2) مدفوع أو خارج Azure — للإبلاغ فقط (لم أحذف شيئاً)
| الاستعمال | الموضع | ملاحظة |
|---|---|---|
| **Resend** (`RESEND_API_KEY`, `MAIL_PROVIDER=resend`) | `src/lib/mailer.ts` | بديل Azure: Azure Communication Services Email عبر SMTP (`MAIL_PROVIDER=smtp`) — **بلا تعديل كود** |
| **AWS S3 / متوافق** (`S3_*`) | `src/lib/storage.ts` | إن كان الإنتاج على S3 فهو مزوّد خارج Azure. البديل: `local` على Azure Files (بلا كود) |
| **Inngest** (`INNGEST_*`, `QUEUE_DRIVER=inngest`) | `src/lib/queue/inngest.ts`, `src/app/api/inngest/route.ts` | الصورة تستعمل `inline`. الحزمة `inngest` باقية في `package.json` |
| `@anthropic-ai/sdk` | `package.json` | لم تعد مستعملة؛ تُحذف من التبعيات لاحقاً |
| **مُيسّر وتمارا ودفترة وDocuSign وواتساب Business API** | `src/lib/payments`, `daftra.ts`, `docusign`, `whatsapp.ts` | تكاملات عمل مع عملاء وليست محركات ذكاء؛ ليس لها مقابل Azure. أذكرها لإدراكك لا لتغييرها |
| **Notion** (عبر جسر الموقع) | `src/lib/notion-suppliers.ts` | عبر `SITE_API_URL` |

مراقبة التكلفة: `../CLAUDE.md` يوجب Budget Alert في Azure Cost Management؛ أضف Container Apps
وPostgreSQL وAzure Files وAzure OpenAI إليه.

---

## أسئلة تنتظر قرار المالك
1. أين تُخزَّن ملفات العملاء اليوم على الإنتاج (`STORAGE_DRIVER`)؟ إن كان `local` على Vercel فهي في
   `/tmp` وممحوّة أصلاً — تحقق أن سجلات `FileAsset` لا تشير لملفات مفقودة.
2. الإنتاج على S3 (AWS)؟ ننقل الملفات إلى Azure Files أم نُبقي S3 مؤقتاً؟
3. `DOCUSIGN_MODE`: `demo` أم `production`؟ (قرار قانوني/تكلفة؛ جاء في `CLAUDE.md` أن التواقيع غير ملزمة حالياً.)
4. هل يبقى البريد على Resend أم ينتقل إلى Azure Communication Services (SMTP)؟
5. نافذة التجميد: هل نقبل أن تفشل الكتابة وwebhooks دقائق، أم نضع صفحة صيانة على الموقع؟
6. تحديث `CLAUDE.md` الجذر و`quotes/CLAUDE.md` و`AGENTS.md` و`docs/quotes-cutover.md`، فهي تقول «يُحذف».
