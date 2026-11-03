# جرد القطع إلى Azure وتكافؤ `vercel.json` — 2026-11-03

> **قراءة فقط.** لم يُغيَّر DNS، ولم يُوقَف أو يُحذف مشروع Vercel، ولم يُمسّ متغيّر بيئة أو سرّ، ولم يُنشر شيء ولم يُدفع إلى
> `claude/bpic-marketing-site-jvrnga` أو `azure-migration` أو `master`. كل ما قيس هنا طلبات `GET` على صفحات وAPI عامة.
> المصدر: الفرع `claude/azure-parity-1103` المبني من `origin/azure-migration` (الكوميت `ec849942ac`، وهو نفسه بناء
> `azure.businesspartner.sa` كما يعلنه `/__health`). لا يحتوي هذا الملف سرّاً ولا قيمة متغيّر بيئة.

**ما لم أستطع رؤيته (يحتاج صاحب صلاحية):** قيم متغيّرات البيئة في لوحة Vercel وفي حاوية Azure، ولوحات الجهات الخارجية
(Moyasar · Tamara · DocuSign · Google Cloud · Nafath · Resend/ACS · Meta)، وسير n8n الحيّ (المستودع يحمل قوالبها لا نسختها
الحيّة)، وهل مهام Container Apps الثلاث منشأة. أيّ بند أدناه «يحتاج تحديثاً خارجياً» هو استنتاج من الكود لا فحصٌ للوحة.

## 0) الخلاصة في عشرة أسطر

1. **النطاق لا يتغيّر** (`www.businesspartner.sa`)، فأغلب الروابط المكتوبة في الكود (٢١٠ ذكراً لـ`www.businesspartner.sa` في المستودع) **لا تحتاج تعديلاً**. الذي يحتاج: ما يشير إلى عناوين `vercel.app`، وما بُني وقت البناء بقيم ناقصة، وتسجيلات الجهات الخارجية التي قد تحمل عنوان Vercel.
2. **اعتماد حيّ على Vercel لا يزال قائماً على نسخة Azure التجريبية:** `azure.businesspartner.sa/quotes` و`/api/live-catalog` يردّان بـ`server: Vercel` و`x-vercel-id` — أي الخادم يمرّر إلى `bp-quotes-three.vercel.app` فعلاً (`BP_ORIGIN_MAP` غير مضبوط على staging). يعني: حذف مشروع `bp-quotes` من Vercel يكسر `/quotes` على Azure أيضاً حتى تُنقل اللوحة (الدليل: `docs/azure-cutover-runbook-2026-10-16.md` (أ)).
3. **صورة staging مبنيّة بلا `GOOGLE_CLIENT_ID`:** صفحة `/account` على Azure فيها `window.BP_GOOGLE_CLIENT_ID=""` بينما على الحيّ قيمتها مضبوطة. الدخول بغوغل لن يعمل على Azure حتى يُمرَّر `GOOGLE_CLIENT_ID` كوسيط بناء (`ops/azure/Dockerfile:39`) وتُضاف `https://www.businesspartner.sa` إلى Authorized JavaScript origins (موجودة للحيّ أصلاً).
4. **فرعا الكود مختلفان:** `azure-migration` فيه **٢٠٦ كوميتاً** ليست على فرع الإنتاج، والإنتاج فيه كوميت واحد ليس على Azure (`3fb812a651`). فالقطع الآن = نشر ٢٠٦ كوميتاً للعملاء معاً. (انظر §«قرار المالك» في تقرير التكافؤ.)
5. **القواعد (`vercel.json`) تُترجَم بأمانة:** ٥٦ مساراً من قواعد التحويل والكتابة وحالات `cleanUrls` والشرطة الأخيرة والـ404 كلها **تطابقت حرفياً** مع الحيّ.
6. **فرق استضافة حقيقي وجدته: اثنان فقط** (نوع المحتوى لـ`sitemap.xml` و`favicon.ico`) — جُهِّز إصلاحهما في هذا الفرع (`ops/azure/server.mjs`، سطران، مع اختبار).
7. `hr.businesspartner.sa` **لا يُحَلّ في DNS** اليوم (تحقّقت)، فقواعده الثمانية في `vercel.json` ميتة على الحيّ، و١٥٣ رابطاً في صفحات `/portal/*` تشير إليه.
8. **الكرون:** المهام الثلاث تصادق بـ`Authorization: Bearer $CRON_SECRET` فقط (لا اعتماد على ترويسة `x-vercel-cron`) فيصلح `cron.mjs` كما هو.
9. `VERCEL_ENV=preview` يشغّل «وضع الاختبار» في أربعة ملفات؛ الخادم يضبطه عند `BP_ENV=preview` فقط. **لا يُضبط `BP_ENV=preview` على حاوية الإنتاج** أبداً.
10. لا أجد في الكود أي عنوان IP ثابت أو قائمة سماح IP — لكن Nafath/Etimad قد يشترطانها من جهتهما (اسألهما).

---

## 1) أدوات هذا الجرد

| الأداة | الأمر | ما تفعله |
|---|---|---|
| `ops/parity-check.mjs` (جديدة) | `npm run azure:parity-check` أو `node ops/parity-check.mjs --help` | تقارن ١٣٧٤ مساراً (sitemap الثلاثة: ملف المستودع وحيّ وأزور + قواعد `vercel.json` + حتى ٢٠ نقطة GET آمنة + ملفات متفرقة) بين الحيّ وAzure: الحالة، التحويلات، `cache-control`/`content-type`/`x-robots-tag`، بصمة المحتوى (بعد حذف مفتاح الكاش والأختام الزمنية)، وتنسب فرق المحتوى إلى الشيفرة أو الاستضافة بمقارنة البصمات مع `git show` لملفات الفرعين. تقرير JSON + ملخص عربي. زمنها ~١٠٥ ثوانٍ. |
| `ops/azure/parity.mjs` (قائمة) | `npm run azure:parity` | فحص أخفّ يستعمله `azure-deploy.yml` بعد كل نشر إلى staging. |

أمان `parity-check`: `GET` حصراً؛ بلا جسم ولا `Authorization` ولا كوكيز؛ قائمة بيضاء للـAPI (`API_GET_PROBES`) ومرشّح `FORBIDDEN` يرفض أي مسار فيه `action=run|backfill|mock-form|cancel…` أو `__route=jobhunt` أو مفتاحاً/رمزاً في الاستعلام، حتى مع `--extra-api`؛ تزامن ≤ ٦ لكل نطاق (الافتراضي ٤) ومهلة ٢٠ث وإعادة محاولة ≤ ٢ على المهلة و429/502/503/504؛ لا تُطبع قيم نصية من JSON (تُطبع القيم المنطقية والأرقام وكلمات الوضع القصيرة كـ`live`/`sandbox` تحت مفاتيح غير حسّاسة). نطاق لا يُوصَل = «تعذّر القياس» وخروج ٣ بلا أرقام. اختباراتها: `tests/azure-parity-check.test.mjs` (محلية، لا شبكة).

---

## 2) نتيجة القياس (2026-11-03 01:27–01:29 UTC، من حاوية العمل، لقطة لا حكم نهائي)

A = `https://www.businesspartner.sa` · B = `https://azure.businesspartner.sa` (بناء `ec849942ac88`) · ١٣٧٣ مساراً مقيساً + ١ متوقّع الاختلاف · ٠ أخطاء شبكة · ٠ إعادة محاولة. تكرّرت المقارنة مرتين بالأرقام نفسها.

| المقياس | القيمة |
|---|---|
| تطابق بنيوي (حالة + تحويل + `cache-control`/`content-type`/`x-robots-tag`) | **٩٧٫٧٪** (١٣٤٢ من ١٣٧٣) |
| تطابق كامل (البنية + المحتوى) | **٥٫٣٪** (٧٣ من ١٣٧٣) |
| — قواعد `vercel.json` (٥٦) | ١٠٠٪ كامل |
| — نقاط API (١٦) | ٦٨٫٨٪ كامل · ٩٣٫٨٪ بنيوي |
| — الصفحات (١٢٩٥) | ٠٫٢٪ كامل · ٩٧٫٨٪ بنيوي |
| زمن الاستجابة (من حاوية العمل، تقريبي) | A: وسيط ١٠٥ms · B: وسيط ٢٠٠ms (لا CDN أمام Azure بعد؛ Front Door في خطة (ب١)) |

**قراءة الرقمين:** رقم المحتوى المنخفض ليس عطلاً في Azure. من ١٢٦٩ صفحة محتواها يختلف، **١٢٤٧ (٩٨٪) أثبتُّ بالبصمة** أن A يطابق حرفياً ملف `site/` في فرع الإنتاج وB يطابق حرفياً ملف `site/` في `azure-migration` — أي فرق شيفرة بين فرعين. **صفر** صفحة يخالف فيها B ملف فرعه (فلا فساد في الاستضافة ولا في بناء الصورة). والثمانية عشرة الباقية يخالف فيها **A** ملف فرعه: اثنتان منها (`/account` و`/ar/account`) بسبب `GOOGLE_CLIENT_ID` المحقون وقت البناء على Vercel؛ والستة عشر الأخرى (`agency-portal` · `packages` · `partner-dashboard` · `recruitment-agencies` بالأربع لغات) لم أفسّرها — يلزم بناء فرع الإنتاج محلياً لمعرفة السبب (فرضيتي: ملفاتها المُلتزَمة قديمة عمّا يولّده البناء على Vercel).

**الواحد والثلاثون عدم تكافؤ بنيوي، مفكَّكة:**

| العدد | الفرق | السبب | استضافة أم شيفرة |
|---|---|---|---|
| ٢٤ | `/{,ar/,fr/,zh/}services/rev-{ent,growth,launch,pro,start,team}`: الحيّ يحوّل ٣٠٢ إلى `/catalog`، وAzure يعيد ٢٠٠ | `vercel.json` في فرع الإنتاج فيه **٦ قواعد إخفاء ٣٠٢** (`/business-development` وخدمات `REV-*`) غير موجودة في `azure-migration` (الصفحة ظاهرة فيه، `bdaas-launch-1029`) | شيفرة (مؤكَّد بـ`git diff vercel.json`) |
| ٤ | `/{,ar/,fr/,zh/}accessibility`: الحيّ ٤٠٤ وAzure ٢٠٠ | الصفحة موجودة في `azure-migration` فقط (`sitemap` أزور فيه ٢٨ مساراً زيادة) | شيفرة |
| ١ | `/api/book?action=slots`: `cache-control` الحيّ `public, max-age=0, must-revalidate` وAzure `no-store` | `api/book.js` تغيّر فيه ٥٤١ سطراً بين الفرعين؛ الحيّ لا يضبط الترويسة أصلاً | شيفرة |
| ١ | `/sitemap.xml`: `application/xml` ↔ `application/xml; charset=utf-8` | جدول MIME في `ops/azure/server.mjs` | **استضافة — مُصلَح في هذا الفرع** |
| ١ | `/favicon.ico`: `image/vnd.microsoft.icon` ↔ `image/x-icon` | جدول MIME نفسه | **استضافة — مُصلَح في هذا الفرع** |

فنسبة التكافؤ البنيوي **المنسوبة للاستضافة** وحدها: ١٣٧١ من ١٣٧٣ = **٩٩٫٨٥٪**، وتصير ١٠٠٪ بعد دمج إصلاح الـMIME.

**فروق لا تُحسب عدم تكافؤ لكن يجب أن تُعرف:**
- Vercel يضيف `accept-ranges: bytes` و`content-disposition: inline; filename="…"` و`server: Vercel` و`x-vercel-cache`، وAzure لا. لا وسائط في `site/` (فحصتُ: صفر mp4/pdf/mp3 وصفر `<video>`/`<audio>`) فلا أثر اليوم؛ لو أُضيف فيديو يلزم دعم `Range` في `serveStatic`.
- Vercel يستهلك `s-maxage` و`stale-while-revalidate` عند حافته ولا يُظهرهما للمتصفح؛ Azure يمرّرهما كما كتبتهما الدالة (`/jobs-feed.xml` و`/indeed.xml` و`/api/newsletter?feed=news`). الأداة تُسقطهما قبل المقارنة. لا أثر على العميل.
- صفحة الـ404: الحيّ يلحق معرّف طلب (`iad1::…`)، وAzure نصاً مطابقاً بلا المعرّف. تطبيع.
- `/api/otp` و`/api/chat` و`/api/pay` و`/api/simple?action=config`: القيم تختلف (مفاتيح `nafath.provider`/`wallets`/`bank` غائبة في A = شيفرة؛ وأوضاع `modes.tamara` كلمتها أطول في B = إعداد بيئة). الأداة تعدّها «بنية متطابقة والمحتوى يختلف» وتطبع الفرق بلا قيم سرّية.

---

## 3) الجرد: مواضع Vercel والنطاق الحيّ في المستودع

الأعمدة: **الموضع** (ملف:سطر) · **ما فيه** · **هل يلزم تحديث؟** · **الجهة الخارجية/من يحدّث**. «لا» = يعمل كما هو لأن اسم المضيف لا يتغيّر.

### 3.١) عناوين Vercel (`*.vercel.app` وواجهة Vercel)

| الموضع | ما فيه | يلزم؟ | من يحدّث |
|---|---|---|---|
| `vercel.json:101-103` | ٣ rewrites خارجية: `/quotes` · `/quotes/:path*` · `/api/live-catalog` → `bp-quotes-three.vercel.app` | **نعم قبل حذف `bp-quotes`** — لا تعديل ملف: يُضبط `BP_ORIGIN_MAP=https://bp-quotes-three.vercel.app=http://bp-quotes` على الحاوية | مدير Azure (الدليل أ٣–أ٦) + نقل بيانات اللوحة بيد المالك (`docs/quotes-cutover.md`) |
| `api/_quotes.js:23` · `api/requests.js:1455` | `QUOTES_PANEL_URL` الافتراضي `https://bp-quotes-three.vercel.app/quotes` (جسر المستندات والكتالوج والمورّدين) | **نعم** — يُضبط المتغيّر `QUOTES_PANEL_URL=http://bp-quotes/quotes` | مدير Azure |
| `ops/n8n/catalog-sync.workflow.js:3` و`:299` | `PANEL` على `bp-quotes-three.vercel.app` + `api.vercel.com/v1/integrations/deploy/REPLACE_WITH_VERCEL_DEPLOY_HOOK` | **نعم** (قالب؛ نسخة n8n الحيّة لم أقرأها) | `automation-agents` في n8n: `PANEL` → `https://www.businesspartner.sa/quotes` والخطّاف → `workflow_dispatch` على GitHub |
| `site/scripts/compare-prices.mjs:13` | أداة يدوية افتراضها اللوحة على vercel.app | لا (تطوير) | — |
| `quotes/next.config.mjs:15` · `quotes/src/lib/base.ts:9-18` | تعليقات ومنطق يردّ أي مضيف `vercel.app` إلى النطاق الرسمي `CANONICAL_BASE` | لا | — |
| `ai-space/README.md:34,41` · `ops/account-papers.md:53` | توثيق: `bp-ai-space.vercel.app` (مشروع رابع قائم بقرار المالك) و`bp-quotes-three` | لا | — |
| `ops/azure/server.mjs:126,412-420,482-487` · `egress-guard.mjs` · `alerts.sh:58` | **الضمان**: `BP_BLOCK_VERCEL_ORIGINS=1` يحجب أي خروج إلى `*.vercel.app` ويسجّله | يُفعَّل يوم القطع | مدير Azure |
| `api/_mode.js:13,15` · `api/otp.js:34` · `api/requests.js:99` · `api/_simple.js:45` | `process.env.VERCEL_ENV === "preview"` ⇒ وضع اختبار (دفع تجريبي، دخول بالرمز، لوحة بمفتاح اختبار) | **تحذير لا تحديث**: `server.mjs` يضبطه عند `BP_ENV=preview` فقط | مدير Azure: إنتاج بلا `BP_ENV=preview` |
| `site/scripts/generate.mjs:9159,10032,11363,11562,11968` · `site/scripts/n8n-guard.mjs:12` | حارس n8n: لا خروج إلى n8n من `localhost` أو `*.vercel.app` | لا | — |
| `vercel.json:3-9` (`installCommand` · `buildCommand` · `outputDirectory` · `ignoreCommand`) | إعدادات بناء Vercel | مقابلها في §4 | — |
| `.github/workflows/azure-deploy.yml:66` · `:147` | نصّ خطوة، ومقارنة `parity.mjs` ضد الحيّ بعد نشر staging | لا | — |

### 3.٢) النطاق الحيّ — روابط في رسائل وصفحات (لا تحتاج تغييراً ما دام `www` هو المضيف)

| الموضع | ما فيه |
|---|---|
| `MKT_SITE_BASE` الافتراضي `https://www.businesspartner.sa`: `api/_docusign.js:55` · `book.js:38` · `_catalog.js:17` · `_stage.js:40` · `_suppliers.js:49` · `_eor.js:47` · `_catalog-prices.js:350` · `_invoicing.js:57` · `_simple.js:57` · `pay.js:208` · `requests.js:995` | روابط العودة والرسائل. **تُراجَع قيمتها في بيئة Azure** (يجب أن تبقى `www` لا `azure.`) — `ops/azure/env-scan.mjs:49` يصنّفها |
| `SITE_BASE` / `SITE_ORIGIN` على الأبكس: `api/requests.js:981` · `api/_jobhunt.js:51` | `https://businesspartner.sa` — الأبكس يحوّل ٣٠٨ إلى www على Azure (`server.mjs:apexHosts`) ✔ |
| روابط مكتوبة في قوالب البريد: `api/employer.js:415,653,654,759` · `_quotes.js:231,250` · `candidates.js:1541,1640` · `_agencies.js:200,1323,1373,1380` · `candidate.js:947-954` · `_offer.js:193` · `_stage.js:289` · `chat.js:61,102` | `www`/أبكس + مسارات `/ar/…` |
| `api/pay.js:695` | رابط «دخول لوحة التحكم» في بريد المالك: `https://businesspartner.sa/ar/portal` — مسار قد لا يكون هو الحالي (راجع `automation-agents`/`owner-ops`؛ ليس من القطع) |
| `site/robots.txt:3` · `site/sitemap.xml` (١٢٩٢ رابطاً) · `generate.mjs:12391` (`base = https://businesspartner.sa`) · `generate.mjs:6655` (JSON-LD) | الأبكس نسخة كنسية؛ الحيّ يفعل الشيء نفسه اليوم |
| `site/scripts/generate.mjs:158` | `PORTAL_URL` الافتراضي `https://www.businesspartner.sa/quotes` — **لا يُضبط على عنوان Vercel** في متغيّرات GitHub |
| `quotes/src/lib/base.ts:18` · `quotes/src/lib/mailer.ts:29` · `mail-layout.ts:415` · `quotes/src/app/actions.ts:663` · `api/catalog/full/route.ts:29` · `admin/catalog/map/page.tsx:12` | لوحة العروض: `CANONICAL_BASE`، المُرسِل `no-reply@businesspartner.sa`، و`SITE_URL` افتراضها الأبكس |
| `site/data/site.json` (١٠ مواضع) · `main.js:5766` · `hr-app.js:1910,2129` | بريد `business@businesspartner.sa` ونص الموقع |

### 3.٣) مضيفات فرعية وأخرى

| المضيف | يُحَلّ اليوم؟ | أين يُستعمل | ملاحظة |
|---|---|---|---|
| `businesspartner.sa` / `www` | نعم → عناوين Vercel (`216.198.79.1` · `64.29.17.1`) | كل ما سبق | هدف القطع |
| `azure.businesspartner.sa` | نعم → `bp-site-staging…uaenorth.azurecontainerapps.io` (`40.120.123.34`) مباشرةً بلا Front Door | `docs/dual-run-ledger.md:9` · `docs/chat-eval.md:22` | تجريبي |
| `hr.businesspartner.sa` | **لا** | `vercel.json:116-123` (٨ rewrites بشرط المضيف) · `generate.mjs:415-432,6339` · ١٥٣ موضعاً في `site/**/portal/*.html` · `ops/azure/parity.mjs:90` | القواعد ميتة اليوم؛ إن أريد تفعيله يلزم سجلّ DNS (ولا يحتاج Vercel). يُسأل المالك: يُحذف أم يُفعَّل |
| `ai.businesspartner.sa` | نعم → `135.225.115.159` (Azure أصلاً) | `api/_aiws.js:18` (`AIWS_BASE`) · `generate.mjs:12126` | خارج هذا النقل |
| `n8n.businesspartner.sa` | **لا** | `api/_n8n.js:7` (تعليق) · `ops/n8n/azure/deploy.sh:54` | يتبع نقل n8n (`azure-n8n.yml`)، لا القطع |
| `mail.businesspartner.sa` | **لا** | الدليل (هـ١)، `ACS_SENDER_ADDRESS` | يُنشأ عند تفعيل ACS |
| `test.businesspartner.sa` | — | `api/otp.js:30-38` (`@test.businesspartner.sa` دخول اختبار) | — |
| `*.vercel.app` الأخرى | نعم | `bp-ai-space` (قرار المالك: يبقى) + ٣ مشاريع ساكنة | لا تُمسّ |

### 3.٤) كوكيز وCORS

| الموضع | ما فيه | الأثر عند القطع |
|---|---|---|
| `api/otp.js:49-54` · `api/_db.js:105` | الكوكي `Domain=.businesspartner.sa` لأي مضيف ينتهي بالنطاق | الجلسات تبقى صالحة عبر القطع، وتعمل على `azure.` أيضاً |
| `api/pay.js:1103-1106` | `ALLOWED_ORIGINS` = `www` + الأبكس فقط للدفع | نداء من `https://azure.businesspartner.sa` إلى `/api/pay` من **أصل آخر** لن يحمل `Access-Control-Allow-Origin`؛ من الأصل نفسه لا يهم. لا تغيير يوم القطع |
| `ops/azure/server.mjs:195` · `vercel.json:headers` | `access-control-allow-origin: *` على الملفات الثابتة | مطابق للحيّ (قيس) |

---

## 4) الجهات الخارجية: ما يحتاج تحديثاً وما لا

لأن اسم المضيف ثابت فالأصل **لا شيء يتغيّر في لوحات المزوّدين**، عدا ما يُعلَّم. الجدول أدق من `docs/azure-migration-2026-10-11.md` §1.6 في بندين (Tamara وGoogle) ويُكمله.

| الجهة | الاتجاه | في الكود | القطع يحتاج؟ | أين يُفعَل |
|---|---|---|---|---|
| **Moyasar** | وارد: webhook إلى `https://www.businesspartner.sa/api/pay` | `api/pay.js:79` (السرّ) · `:1341-1360` | لا. بعد القطع: دفعة اختبار صغيرة وتأكّد من وصول الـwebhook | لوحة Moyasar → Settings → Webhooks |
| **Apple Pay** | تحقق نطاق | `vercel.json:headers[0]` · ملف `/.well-known/apple-developer-merchantid-domain-association` | الملف **متطابق** على Azure (قيس: ١٠٠٪ كامل). قد تطلب Apple/Moyasar إعادة التحقق | لوحة Moyasar/Apple |
| **Samsung/Google Pay** | مرتبط بالنطاق | `pay.js:106,108` | لا | — |
| **Tamara** | **وارد**: كل طلب دفع يسجّل `notification = ${MKT_SITE_BASE}/api/pay` + عودة `success/cancel/failure` | `api/pay.js:1552-1555` | لا إن بقي `MKT_SITE_BASE=https://www.businesspartner.sa`. (الدليل يقول «لا webhook وارد» — غير دقيق؛ الإشعار يُرسل مع كل طلب) | تأكّد في لوحة Tamara أن رابط الإشعار العام لا يحمل `vercel.app` (للّوحة `bp-quotes`: الدليل أ٩) |
| **DocuSign** | OAuth consent `redirect_uri=${SITE}/admin` + عودة | `api/_docusign.js:131-135` | لا، بشرط أن `https://www.businesspartner.sa/admin` مسجَّل في Apps and Keys → Redirect URIs. وConnect webhook للّوحة: افحص ألا يحمل `vercel.app` | لوحة DocuSign |
| **Google Sign-In** | المتصفح، `GOOGLE_CLIENT_ID` وقت **البناء** | `generate.mjs:5871,6164,8728,12334` | **نعم**: يُضاف كوسيط بناء لصورة Azure (قيس: ناقص على staging). وAuthorized origins يجب أن تضم `https://www.businesspartner.sa` (+`azure.` لو اختُبر الدخول عليه) | GitHub Variables (`azure-deploy.yml`) + Google Cloud Console |
| **n8n** (سحابي) | صادر من الموقع: `n8nWebhookUrl(...)` | `api/_n8n.js:29` · `_eor.js:48` · `book.js:588` · `_stage.js:41` · `requests.js:128` · `candidate.js:45` · `chat.js:276` · `_aiws.js:21` | لا للقطع. (نقل n8n نفسه مسار منفصل) | — |
| **n8n → الموقع** | وارد: سير تستدعي `https://www.businesspartner.sa/api/...` | `n8n/followup-sweep.js:17` · `wa-agent-gate.js:19` · `ops/n8n/doc-agent-whatsapp.workflow.js:10` (أبكس) · `n8n/wa-build-menu-response.js:281` · `n8n/README.md:66` | لا (الاسم نفسه). افحص أي سير حيّ يذكر `vercel.app`: `ops/n8n/migrate-workflows.mjs` يعلّمها | n8n |
| **WhatsApp (Meta)** | webhook إلى n8n أو Logic App، لا إلى الموقع | `ops/azure/whatsapp-logic-app.json:7,54` (`siteUrl` أبكس → `/api/requests?__route=doc-agent`) | لا للموقع | Meta for Developers (إن تغيّر المستقبِل) |
| **Resend → ACS** | صادر | `ops/azure/mail-bridge.mjs` · مُرسِلات: `api/otp.js:11` · `book.js:13` · `quotes/src/lib/mailer.ts:29` | نعم **عند تفعيل ACS** (DNS: SPF/DKIM/تحقق `mail.` — الدليل هـ١) ولا علاقة له بتحويل `www` | DNS صحارى + بوابة Azure |
| **نفاذ (Elm) / اعتماد** | صادر | `api/_nafath.js` · `_etimad.js` | **اسأل** إن كانا يشترطان قائمة IP ثابتة للمُرسِل. لا أجد في الكود ما يدلّ على ذلك | Elm / اعتماد |
| **Indeed** | يسحب `https://www.businesspartner.sa/indeed.xml` | `vercel.json:rewrites` · `api/candidates.js:1640` | لا. (Azure يضيف `s-maxage` للعميل ولا أثر) | — |
| **محركات البحث** | `robots.txt:3` + `sitemap` على الأبكس | — | لا (نفس المضيف). لا تبدّل خوادم الأسماء قبل نسخ كل سجلات DNS | Search Console (المالك) |
| **Supabase / Notion / Daftra / Azure OpenAI / GitHub** | صادر | — | لا | — |

---

## 5) تقرير `vercel.json` ← ما يقابله في Azure (دون تنفيذ شيء على الحيّ)

عدّاد `vercel.json` في `azure-migration`: ٣٤ redirect · ٢٥ rewrite (منها ٨ بشرط مضيف) · ٢ headers · ٤ functions · ٣ crons. المترجم: `ops/azure/routing.mjs` (يقرأ `vercel.json` نفسه فلا نسخة ثانية تنحرف) + `ops/azure/server.mjs`.

| عنصر `vercel.json` | على Vercel | على Azure | المقيس | ينقص / المقترح |
|---|---|---|---|---|
| `installCommand` `--omit=dev` · `buildCommand` `npm run build` · `outputDirectory: site` · `framework: null` | بناء عند كل نشرة | `ops/azure/Dockerfile`: `npm ci --omit=dev` ثم `npm run build` داخل الصورة، والخادم يخدم `site/` | B يطابق ملفات فرعه حرفياً (صفر انحراف) | **وسائط البناء** `GOOGLE_CLIENT_ID` · `PORTAL_URL` · `COMPANY_*` · `CATALOG_FROM_PANEL` ناقصة في صورة staging (قيس على `/account`). تُضاف من Variables في GitHub قبل بناء صورة الإنتاج |
| `ignoreCommand` (بوابة علامة النشر) | يمنع بناء الفروع بلا علامة | `azure-deploy.yml`: يدوي فقط + `AZURE_DEPLOY_ENABLED` + بيئة `azure-production` بموافقة مراجع | — | لا شيء. ⚠ الدفع إلى `azure-migration` ينشر staging تلقائياً حين `AZURE_DEPLOY_ENABLED=true` (`azure-deploy.yml:34`)؛ إنتاج Azure لا ينشر إلا يدوياً |
| `cleanUrls: true` | `/x.html` → ٣٠٨ `/x` | `server.mjs` (٣٠٨) | `/about.html` · `/index.html` متطابقان | — |
| `trailingSlash: false` | `/x/` → ٣٠٨ `/x` | `server.mjs` (٣٠٨) | `/about/` · `/ar/` متطابقان | — |
| `redirects` ×٣٤ | ٣٠٨ للدائم و٣٠٧ للمؤقت، الاستعلام يُلحَق، المطابقة حسّاسة للحالة | `routing.mjs` بالدلالات نفسها | ٣٤ عيّنة + `/Revenue-OS` (٤٠٤ في الاثنين): **كلها متطابقة** | **٦ قواعد ٣٠٢ في فرع الإنتاج غير موجودة في `azure-migration`** (إخفاء `/business-development` وخدمات `REV-*`). قرار ظهور هذه الصفحات للمالك — انظر §6. لا تُنسَخ آلياً: `hidden.mjs` يكتبها من `site/data/hidden.json` |
| `rewrites` الخارجية ×٣ (`/quotes`، `/quotes/:path*`، `/api/live-catalog`) | وكيل إلى `bp-quotes-three.vercel.app` | وكيل بـ`BP_ORIGIN_MAP` إلى `http://bp-quotes` داخل البيئة؛ `BP_BLOCK_VERCEL_ORIGINS=1` يمنع التسرّب | الحالة والمحتوى متطابقان — **لكن لأن B ما زال يمرّ إلى Vercel فعلاً** (`server: Vercel`) | **غير منفَّذ على staging.** الخطوات: (١) نشر `bp-quotes` كحاوية (`Dockerfile.quotes` جاهز، `probes.quotes.yaml`)، (٢) `BP_ORIGIN_MAP` و`QUOTES_PANEL_URL`، (٣) `BP_BLOCK_VERCEL_ORIGINS=1`، (٤) نقل تاريخ اللوحة بسكربتَي المالك (يحتاجان `DATABASE_URL` اللوحة). لا يُحذف `bp-quotes` قبل (٤) |
| `rewrites` الداخلية للـAPI ×١٠ (`daftra-invoice` · `supplier-quote-read` · `notion-suppliers` · `suppliers` · `agencies` · `jobhunt` · `doc-agent` · `simple` · `pr-intake` · `spaces`) | → `/api/requests?__route=…` | `routing.mjs` + `server.mjs` | الحالة وشكل JSON متطابقة (`GET` بلا action = ٤٠٥/٤٠١ كما الحيّ) | — |
| `rewrites` لوحة الإيرادات ×٢ → `/assets/data/revenue-command-center` | ملف ثابت | نفسه | متطابقان | — |
| `rewrites` الخلاصات ×٢ (`/jobs-feed.xml` · `/indeed.xml`) | → `/api/candidates?feed=jobs` | نفسه | المحتوى متطابق | الفرق الوحيد `s-maxage` الظاهر للعميل (بلا أثر) |
| `rewrites` بشرط المضيف ×٨ (`hr.businesspartner.sa`) | تُطبَّق لو وصل الطلب بذلك المضيف | `server.mjs` يدعمها (`hostRouting`) وتغطيها `tests/azure-routing.test.mjs` | **لا يمكن قياسها حياً**: المضيف لا يُحَلّ | قرار: تُحذف القواعد والروابط (١٥٣) أم يُضاف سجلّ DNS للمضيف. لا شيء يلزم للقطع |
| `headers` ×٢ (ملف Apple Pay · `/assets/(.*)` immutable) | ترويسات مخصصة | `findHeaders` → `applyHeaders` | الاثنان متطابقان حرفياً | — |
| ترويسات ضمنية لا تظهر في `vercel.json` | HSTS `max-age=63072000` · `access-control-allow-origin: *` للثابت | `server.mjs` يضيفهما (`HSTS` · `serveStatic`) | متطابقان | `accept-ranges`/`content-disposition`/`x-vercel-*` غير موجودة على Azure — بلا أثر الآن (لا وسائط) |
| MIME للملفات الثابتة | جدول Vercel | `MIME` في `server.mjs` | **اثنان يختلفان**: `.xml` و`.ico` (بقية الأنواع الاثنا عشر المقيسة متطابقة) | **جاهز في هذا الفرع**: `.xml`→`application/xml` و`.ico`→`image/vnd.microsoft.icon` |
| `functions[…].maxDuration` ×٤ (`candidate` · `chat` · `requests` · `candidates` = ٦٠ث) | سقف تنفيذ الدالة | `maxDurationFor` (`vercel.json` يغلب `export const config`، فـ`candidates.js` يبقى ٦٠ لا ٣٠٠) | غير مقيس (يحتاج طلب بطيء) | الدوال بلا مدخل (`newsletter` · `book` · `pay`…) تأخذ `BP_FN_DEFAULT_TIMEOUT_S` (٣٠ث)؛ سقف مدخل Container Apps ٢٤٠ث. النشرة الأسبوعية قد تتجاوز ٣٠ث ⇒ مهمة الكرون تسجّل ٥٠٤ بينما الإرسال يستمر؛ إن ظهر ذلك أضف `functions["api/newsletter.js"]` في `vercel.json` (يخدم المنصتين) |
| `crons` ×٣ | استدعاء `GET` بـ`Authorization: Bearer $CRON_SECRET` | `cron.mjs` + `cron-switch.sh`: Container Apps Job لكل مهمة، الأمر `node ops/azure/cron.mjs <رقم>`، جدول UTC من `vercel.json` نفسه، بلا إعادة محاولة | الدوال الثلاث (`newsletter` · `_jobhunt.js:71` · `candidate.js:1081`) تصادق بـ`Bearer CRON_SECRET` وحده ⇒ تتوافق | **غير مؤكَّد** أن المهام منشأة (لا وصول لـAzure). التشغيل: `cron-switch.sh on` **بعد** تعطيل Vercel Cron يدوياً — مجدول واحد فقط. اختبار آمن: `BP_CRON_BASE=https://azure.businesspartner.sa node ops/azure/cron.mjs 0 --dry-run` |
| ما لا يوجد في `vercel.json` ويفعله Vercel | CDN عالمي · الأبكس→www ٣٠٨ · http→https · WAF/تحدّي الهجمات · Analytics | الأبكس وhttp→https في `server.mjs`؛ CDN وWAF = Front Door (الدليل ب١)، وقت الاستجابة اليوم ضعف الحيّ (٢٠٠ مقابل ١٠٥ms وسيطاً) لغياب CDN | الأبكس/https متطابقان بالاختبار المحلي | Front Door قبل القطع؛ لا قياس لـWAF هنا |

---

## 6) قرار المالك الوحيد

**هل يُقطع إلى Azure بما في `azure-migration` (٢٠٦ كوميتاً لم تُنشر للعملاء بعد)، أم نُوفِّق Azure مع فرع الإنتاج الحيّ أولاً؟**

القياس يقول إن الاستضافة سليمة (٩٩٫٨٥٪ بنيوياً، صفر فساد محتوى)، لكن الموقعين اليوم **ليسا النسخة نفسها**: صفحات ظاهرة على Azure ومخفية على الحيّ (`/business-development` وخدمات `REV-*` الست، `/accessibility`)، وتغييرات شراء وعقود وحجز ودخول (نفاذ/غوغل/بريد) ولوحة `/ops` الجديدة. القطع من `azure-migration` يعني أن العملاء يرون كل ذلك في لحظة تحويل DNS.
- **الخيار أ (موصى به):** نبني صورة Azure من فرع الإنتاج الحيّ (`3fb812a651`) فتصبح المقارنة صفراً فرقاً شيفرة، نقطع، ثم ندخل ما في `azure-migration` على دفعات بقول «انشر».
- **الخيار ب:** نقطع من `azure-migration` كما هو بعد أن يراجع المالك قائمة ما سيظهر.

(بقية القرارات — حذف `hr.businesspartner.sa` أو تفعيله، ظهور صفحات `REV-*` — تتبع هذا القرار.)

---

## 7) ما أُنجز في هذا الفرع (`claude/azure-parity-1103`)

- `ops/parity-check.mjs` + `tests/azure-parity-check.test.mjs` (١٦ اختباراً محلياً) + `package.json` → `azure:parity-check`.
- `ops/azure/server.mjs`: `.xml` و`.ico` بنوع المحتوى الذي يخدمه Vercel.
- هذا الملف.
- لم يُدفع شيء إلى `azure-migration` أو `claude/bpic-marketing-site-jvrnga` أو `master`، وبلا علامة نشر في أي كوميت.
