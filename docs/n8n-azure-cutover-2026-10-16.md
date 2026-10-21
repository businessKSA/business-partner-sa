# قطع n8n من n8n Cloud إلى Azure — عُدّة النقل (2026-10-16)

> قرار المالك 2026-10-16: «أوقف Vercel وn8n تماماً، وكل شيء على Azure».
> هذا الملف عُدّة تجهيز **لم يُنفَّذ منها شيء**: لا اتصال بـn8n Cloud ولا بـAzure، ولا نشر، ولا لمس لواتساب الحيّ.
> يُنفَّذ كله بأمر المالك وبيده في الخطوات التي تلمس الإنتاج.
>
> **تحديث 2026-10-21 (قرار المالك: n8n كله على Azure ولا شيء على Cloud، وإيقاف الاشتراكات لاحقاً):**
> قائمة القطع المعتمدة بالترتيب والتراجع هي [`n8n-cutover-checklist-2026-10-21.md`](n8n-cutover-checklist-2026-10-21.md) —
> **تحلّ محلّ §5 و§6 و§7 أدناه** (تبقى هنا للأسباب والتفاصيل). وأُضيف إلى الأداة: `webhooks` و`verify` و`probe-webhooks`
> وخريطة الاعتمادات، وإلى `deploy.sh`: `adopt-check` و`adopt-pin` و`adopt-harden` لتبنّي `bp-n8n` القائم.

## 0) ما جُهِّز

| الملف | وظيفته |
|---|---|
| `ops/n8n/azure/deploy.sh` | نشر n8n على Container App في **UAE North** (مجموعة `bp-ai`): نسخة مثبّتة، PostgreSQL، مفتاح التشفير في Key Vault، `min=max=1`. أوامر مرقّمة تُلصق في Cloud Shell، كل خطوة آمنة للإعادة، ولا تطبع سرّاً |
| `ops/n8n/migrate-workflows.mjs` | تصدير/استيراد السيناريوهات عبر REST، تقرير الاعتمادات والمتغيّرات وجداول البيانات، تفعيل/إيقاف **بحماية من التكرار**، وتراجع. المفاتيح من متغيّرات البيئة فقط. اختباره: `tests/n8n-migrate.test.mjs` (٢١ اختباراً بخادم n8n وهمي) |
| `api/_n8n.js` | عنوان n8n في مكان واحد: متغيّر البيئة `N8N_BASE_URL` (افتراضه العنوان الحالي حرفياً، فلا يتغيّر شيء قبل القطع) |
| `ops/n8n/catalog-sync.workflow.js` | عقدة جديدة «شغّل نشر الموقع على Azure» (GitHub `workflow_dispatch`) بجانب عقدة Vercel القديمة، وتبقى الاثنتان حتى القطع |

`N8N_BASE_URL` يُقرأ في موضعين، ويجب ضبطه في **كليهما** يوم القطع:
1. **وقت التشغيل** (`api/*`): `book.js` · `requests.js` · `_stage.js` · `candidate.js` · `_chat.js`. المتغيّرات الأخصّ تغلبه كما كانت (`OWNER_WA_WEBHOOK`، `N8N_ATS_WEBHOOK`…).
2. **وقت البناء** (`site/scripts/generate.mjs`): صفحات المتصفح التي تنادي n8n مباشرة (لوحات الفريق، المراقب، لوحة الامتثال، تسكين العمالة، الخدمات المشتركة) تحمل العنوان داخل HTML. تغيير المتغيّر لا يكفي بلا **إعادة بناء الموقع ونشره** — وهذا بأمر المالك (`CLAUDE.md` §0).

تحقّقتُ أن البناء بلا المتغيّر ينتج **١٥٤٤ ملفاً مطابقة بايتاً ببايت** للبناء قبل التعديل، وأن ضبطه يزيل `n8n.cloud` من كل صفحات `site/` (يبقى حرفياً مصدرٌ خام واحد هو `site/assets/data/compliance-dashboard.html`، والصفحة المولَّدة منه تُستبدل عند البناء).

## 1) حالة n8n على Azure اليوم — ما وُجد وما لم يُؤكَّد

**لم أتحقق من Azure نفسه** (ممنوع في هذه المهمة). ما في المستودع:

- **فرع العمل** (`f2412db72`، 2026-10-11): `azure/n8n/deploy.sh` و`.github/workflows/azure-n8n.yml` و`ops/n8n-migrate.mjs` — محاولة أولى لتشغيل n8n على Container Apps + PostgreSQL باسم `bp-n8n`. فروقها عمّا طلبه المالك اليوم: المنطقة `swedencentral` لا UAE North، والصورة `:latest` غير مثبّتة، وبيئة `bp-agents-env` المشتركة مع الوكلاء، وتنفيذات النجاح لا تُحفظ، والمفاتيح أسرار داخل التطبيق لا Key Vault، ولا تقرير اعتمادات ولا حماية تكرار في أداة النقل. الـworkflow يدوي (`workflow_dispatch` + كلمة تأكيد) ويحتاج السرّ `AZURE_CREDENTIALS`.
- **تأكيد المالك 2026-10-21:** التطبيق `bp-n8n` موجود فعلاً في المجموعة `bp-ai` (swedencentral) مع قاعدة `bp-n8n-pg` — أي أن محاولة 2026-10-11 نُفِّذت. (كان هذا الملف يقول «لا دليل أنه شُغِّل»؛ الدليل في الكود وحده كان ناقصاً.) ما لم يُعرف بعد: نسخته، وهل أُنشئ فيه حساب واعتمادات، وهل مفتاح التشفير سرٌّ مرجعي. يحسمها `bash deploy.sh adopt-check` (قراءة فقط).
- **فرع `azure-migration`** (`docs/azure-only-2026-10-16.md`): صفّ n8n Cloud فيه «**حالة النقل غير مؤكَّدة** — `az containerapp list -g bp-ai`».
- `agents/azure` (فريق الوكلاء على Container Apps Jobs) يستدعي n8n للإرسال فقط: `POST $BP_N8N_BASE/webhook/bp-agent-send`. فهو أحد من يجب أن يتبدّل عنوانه يوم القطع.
- **الفحص الأول قبل أي شيء** (دقيقة واحدة، من Cloud Shell): `az containerapp list -g bp-ai -o table`.
  - لا يوجد `bp-n8n` ← نفّذ العُدّة الجديدة كما هي.
  - يوجد `bp-n8n` من المحاولة الأولى (هذا هو الواقع المؤكَّد الآن) ← الخياران في قائمة القطع §0: **تبنٍّ** (`adopt-check` ثم `adopt-pin` و`adopt-harden`، ولا تُنفَّذ الخطوات 2–5 عليه لأنها تُنشئ مفتاح تشفير وقاعدة جديدين لا علاقة لهما بما في القاعدة) أو **إعادة بناء** في UAE North باسم جديد. التوصية بعد قراءة `adopt-check`.

## 2) جرد السيناريوهات

**الأرقام:** المالك (اليوم) ١١٩ سيناريو، نحو ٦٠ نشطاً. آخر قراءة موثّقة بالأداة في المستودع: ١٠١ سير و٧٠ مفعّلاً (`docs/org-chart-2026-09-24.md`، 2026-09-24) ثم أضيفت أربع إدارات و١٧ صفاً في السجل. الفرق بين الرقمين طبيعي لكنه **يُحسم بالأمر الحيّ لا بالتقدير**:

```bash
N8N_SRC_URL=https://businesspartnerai.app.n8n.cloud N8N_SRC_API_KEY=... \
  node ops/n8n/migrate-workflows.mjs export ./n8n-export --dry-run
```
يطبع: العدد وفعّالها، كل سيناريو مصنَّفاً، الاعتمادات بأسمائها، متغيّرات `$env`/`$vars`، جداول البيانات، النداءات إلى Vercel، وويبهوكات الفعّالة. (لا يكتب شيئاً.)

### التصنيف الذي يحكم ترتيب القطع

| الصنف | ما هو | متى يُفعَّل في Azure |
|---|---|---|
| `webhook` | يستجيب لنداءٍ على عنوانه (Webhook، Form، Chat) — والفرعي/معالج الأخطاء (`passive`) يُلحق به | **قبل القطع** بأمان: مساره مختلف في الموضعين ولا أحد يناديه بعد |
| `stateful` | مؤقّتات (Schedule/Cron) واستطلاع (Gmail، Notion، IMAP) وما **يسجّل ردّ نداء** عند التفعيل (WhatsApp Trigger عند Meta) | **بعد** إيقافه في Cloud، وبأمر `activate` الذي يرفض تلقائياً إن كان المصدر ما زال فعّالاً |

### المجموعات المعروفة (من السجلات — المصدر الحيّ هو أمر الجرد أعلاه)

| المجموعة | سيناريوهات (معرّفات موثّقة) | المشغّل | الصنف |
|---|---|---|---|
| واتساب الإنتاج | `BP-WhatsApp-Main` `tIb4wNOSYVTZQuox` · Sub-Menu/Advisor/Documents · `BP-Sub-AI-Conversation` `ETxqAM5VooDiDJDN` | WhatsApp Trigger/Webhook + فرعية | **stateful** (يسجّل ردّ نداء عند Meta) + فرعية |
| فريق المدراء (١٧ إدارة) | فرح `YgRwn40v1CqsscJw` · سلمان `8HL5NWvqi1SkTKqb` · بدر `nvrh0c3mUctb1EsG` · سارة `vWICtJIGL4Cu7NXy` · محمد `e9G9S6GG0j7lCiWt` · عبدالرحمن `HZ8W430gZovbVSSs` · مازن `WZE7oUzCzQGR1u0t` · ناصر `c7WRFI1UmoQ4noM5` · عبدالعزيز `SL1aYYS2UBsqHFPE` · مشاري `milR3qpw3c9Li5xN` · عبدالله `8PGiUitiRKDybt3l` · أحمد `BZlZ9irajglk4qpS` · ملاك `7CxR4ecw92hYHIfq` · باهر Front Desk `ZvPryyHTAVNqUtGF` · طارق `JOHZYShR1yVAUMsV` · بندر `3EaVnFEzwO5HxXMI` · آلاء `6PJLw2ABLXE2l6sF` · وسام `BFtwc8hCIaq6mbsB` | Webhook `<slug>-intake` / Chat Trigger (فرح: + واتساب) | **webhook** (فرح قد تكون stateful) |
| المشغّلات المشتركة | الموزّع `LZ5BqoVTwlYv3LOI` (كل ٥ د) · حلقة المراجعة `k5vtioWWKC2i1W0n` (١٠ د) · دورة الصفقة `WTBfUJKaeCJSIi3m` (٣٠ د) · النبض الذاتي `SIfHuijjdAcHuTWI` (ساعة) · متابعة فرح `gL1BTe7WAv5bG9ma` (٣٠ د) · رادار آلاء `RNz04io0y9Jw5y3d` (٣ س) · رقيب النقد `e8ki3rUFQCkWvqD7` · بطاقة الأداء `S3507deZMyxbCdZq` | Schedule | **stateful** — الأخطر تكراراً (مهام وواتساب) |
| مراقبة وأخطاء | `BP-Error-Handler` `DEEBmcadEhrncGo4` · مركز التحكم `6jgqpWlBRbyncwTC` · AI Space Data API `3B9PXV0YhcLOgMqi` · الاستقبال الموحّد `u8oFePZaV69YdjFn` | Error Trigger / Webhook | passive / webhook |
| البريد والتوظيف | مراقب Gmail `xwM48oL1X9IcWlVy` (١٥ د) · `fbvX49CeIosMLHpU` · Email→CRM `ess3HEXGMPnZnzLH` · Bounce `QXuY39TKC0FNQp9R` · الكنس اليومي `ol6DEU2baRYENYfB` · Newsletter `TAWrtYzs35JLfmDA` · Gov News `cZBWSMyOhfkIwRdL` | Gmail Trigger / Schedule | **stateful** |
| الموقع ← n8n | إشعار عميل الموقع `bldhMv0BAGs41Xqo` · ATS Intake · استقبال ملفات العميل · BP3 واجهة اللوحة | Webhook | webhook |
| BP Inbox | Chat-Monitor `eABgXmMQZcCTzatn` · Chat-Suggest `B0pF8xB7b4L3hxtd` · Chat-Send · Chat-Media | Webhook | webhook |
| عقارات/توظيف/عمالة | `JfiM4IBHrnLdJcmb` (قراءة بورد العقار، فرعي) · RE Intake/Matching/RFQ · Mahfol · Trip Designer · Sync Visa Tracker | متنوّع | حسب الجرد |
| الكتالوج | `vomoBu7MxIY8hTIP` مزامنة نوشن ⇄ اللوحة ⇄ الموقع | Schedule + Webhook | stateful (موقوف اليوم) |
| معطّلة | Google Places/OSM/Apollo/Email Finder/Campaign Sender · حاسبتا النطاقات والرسوم · Weekly Planner | — | لا تُفعَّل |

### ما لا ينتقل عبر الواجهة العامة (والأداة تُبلّغ عنه ولا تنقله)

| الشيء | لماذا يهمّ هنا | ما يُفعل |
|---|---|---|
| **الاعتمادات (Credentials)** | أسرارها لا تُصدَّر بتصميم n8n. بدونها لا يعمل أي سيناريو يلمس Notion/Gmail/واتساب/Azure | تُنشأ يدوياً في Azure **بالاسم والنوع نفسيهما** (الأسماء في تقرير الأداة). OAuth منها يحتاج تسجيل دخول من المتصفح. المعروف من السجلات: Azure OpenAI `bp-main` · Azure Speech — Jarvis · Azure Whisper (`bp-voice`) · Notion — Business Partner OS — Production · Gmail · Google Calendar/Drive · WhatsApp (Graph) · `BP — WhatsApp Bearer` · `BP — مفتاح وكيل المستندات` · `BP — مفتاح مزامنة الكتالوج` · `X-BP-Agent-Key` · LinkedIn · Outlook. **ElevenLabs ومفاتيح Gemini/Groq/OpenAI لا تُنشأ** (قاعدة Azure فقط) |
| **المتغيّرات `$vars`** | ميزة مدفوعة في Cloud، **غير موجودة في n8n المجتمعية** — أي سيناريو يستعملها ينكسر | تظهر في التقرير بعلامة ⛔. تُحوَّل إلى `$env.NAME` ويُضاف الاسم بخطوة 6 من `deploy.sh` |
| **متغيّرات `$env`** | المعروف: `BP_PANEL_KEY` (Agent Gate، Follow-up Sweep) · `DOC_AGENT_HOOK_KEY` | `bash deploy.sh 6 BP_PANEL_KEY DOC_AGENT_HOOK_KEY` (تُسأل بصمت وتُحفظ في Key Vault) |
| **جداول البيانات (Data tables)** | عقل الفريق: `BP_AI_Deals` `GQd4w5BQueKAGrZ0` · `BP_AI_Tasks` `rUmBnwqKvmafJGlE` · `BP_Agent_Registry` `Sn0q91vtdsBP5tJy` · `BP_News_Feed` `LGVbcQUqzy2sfyTm` · `BP_News_Sources` `ZQGssJU6NxF1Sl6V` … (٩ جداول). **صفوفها لا تنتقل مع السيناريوهات** ومعرّفاتها تتغيّر | تُنشأ بالأسماء نفسها في Azure وتُنسخ صفوفها (تصدير CSV من الواجهة ← استيراد)، ثم تُكتب خريطة `{قديم: جديد}` وتُمرَّر `--data-table-map=map.json` فتُصلَح المراجع داخل السيناريوهات |
| **`staticData`** (ذاكرة منع التكرار: متابعة فرح، تهدئة أخطاء ٦ ساعات) | بلا نقلها يعيد النظام إرسال ما سبق إرساله | تُنقل مع السيناريو (الأداة تفعل). إن رفضتها الوجهة تُبلَّغ بعبارة «الحد الأدنى» ويُقبَل تكرار واحد |
| **تنفيذات معلّقة (Wait)** وسجلّ التنفيذات والوسوم والمجلدات | لا تنتقل | ما كان منتظراً في Cloud يضيع عند الإيقاف: اختر لحظة هادئة |

## 3) ويبهوكات الإنتاج التي يستعملها الموقع

المسارات **تنتقل كما هي** (الأداة لا تمسّ `path` ولا `webhookId`)؛ يتغيّر المضيف وحده. تحقّق من أول ويبهوك أن الـProduction URL في Azure يطابق المسار القديم.

| المسار | من يناديه | كيف يتبدّل |
|---|---|---|
| `website-lead-notify` | `api/book.js` · `api/requests.js` · `api/_stage.js` (إشعار المالك + حجز تقويم `bldhMv0BAGs41Xqo`) | `N8N_BASE_URL` (أو `OWNER_WA_WEBHOOK` إن كان مضبوطاً بالعنوان القديم) |
| `bp-ats-application` | `api/candidate.js` | `N8N_BASE_URL` (أو `N8N_ATS_WEBHOOK` / `N8N_CANDIDATE_WEBHOOK` / `BP_ATS_WEBHOOK`) |
| `f08bf4a4-…/chat` (محادثة باهر) | `api/_chat.js` احتياطاً + لوحات الفريق في المتصفح | `N8N_BASE_URL` وقت التشغيل **والبناء** |
| `05804653-…/chat` · `client-intake-web` · `bp3-portal-9kq4z` | لوحة الامتثال وتسكين العمالة (المتصفح) | `N8N_BASE_URL` وقت البناء |
| `<slug>-intake` ×١٢ (`baher/badr/farah/mohammed/abdulrahman/mazen/nasser/abdulaziz/mishari/ahmed-procurement/strategy/malak`) | `/dashboard` و`/portal` (المتصفح) | وقت البناء |
| `ss-login` · `ss-stats` · `ss-chat` · `ss-knowledge` · `ss-names` | بوابة الخدمات المشتركة (المتصفح) | وقت البناء |
| `bp-chat-monitor/send/suggest/media-x7k2m9` | `/monitor` — BP Inbox (المتصفح) | وقت البناء |
| `/form/…` ×٣ (تسجيل مرشح، تقييم مقابلة، إعلان وظيفة) | `/dashboard` أدوات التوظيف | وقت البناء (روابط نماذج n8n تُنسخ ويتغيّر مضيفها) |
| `bp-agent-send` | `agents/azure` (مازن وفريق الوكلاء) | `BP_N8N_BASE` في Container Apps Job (+ مفتاح `BP_N8N_HOOK_KEY` يبقى) |
| `doc-agent-vault-sync` | `api/_docagent.js` | `DOC_AGENT_SYNC_URL` |
| `bp-catalog-changed` | اللوحة | `CATALOG_WEBHOOK_URL` (والسير موقوف اليوم) |
| `bp-ai-control-<سرّي>` · `muin-command-space-…` · `muin-health-…` | `ai-space` ولوحة التحكم | `AI_SPACE_CONFIG` (سرّ GitHub) — **مسار سرّي: لا يُكتب في المستودع** |

> ⚠ المتصفح يمنع أن ينادي موقعٌ على `businesspartner.sa` نطاقاً آخر إلا بإذن CORS. الويبهوكات تسمح بكل الأصول اليوم (خيار العقدة)، وهي تنتقل مع السيناريو؛ فلا يُتوقّع تغيير — لكنه أول ما يُفحص في الاختبار من المتصفح.

## 4) ما يجب تحديثه خارج المستودع

| أين | ما يتغيّر | ملاحظة |
|---|---|---|
| **Meta — WhatsApp** (رقم `0530540231` الرسمي؛ والرقم `0507034157` للوكيل) | Callback URL ورمز التحقق إلى مضيف Azure | عقدة WhatsApp Trigger **تسجّل الردّ بنفسها عند التفعيل** (وهذا بالذات ما يخطف الحركة)؛ فلا تُفعَّل في Azure إلا يوم القطع. انسخ الـProduction URL من العقدة وتحقّق في Meta بعد التفعيل |
| **مزوّدو OAuth** | أضف Redirect URI `https://<مضيف n8n>/rest/oauth2-credential/callback` | Google Cloud (Gmail/Calendar/Drive) · تكامل Notion · LinkedIn · Microsoft (Outlook) · تطبيق Meta. **قبل** إنشاء الاعتمادات وإلا يرفض المزوّد. تذكير: مشروع Google `Gmail N8N` معرّض للإيقاف لعدم وجود وسيلة دفع (سجل 2026-10-01) |
| **Notion** | أتمتة/أزرار في القواعد تُرسل «Webhook» إلى n8n (إن وُجدت) | غير مؤكَّد من الكود — يُفحص في قواعد: Tasks، Sales Pipeline، Content Calendar |
| **Resend** | Webhook الارتداد (Bounce Handler) إن كان موجَّهاً إلى n8n | يُفحص من لوحة Resend |
| **Vercel / Container App للموقع** | `N8N_BASE_URL` + أي من `OWNER_WA_WEBHOOK` · `N8N_ATS_WEBHOOK` · `N8N_CANDIDATE_WEBHOOK` · `BP_ATS_WEBHOOK` · `LEAD_WEBHOOK_URL` · `DOC_AGENT_SYNC_URL` · `CATALOG_WEBHOOK_URL` إن كانت مضبوطة بالعنوان القديم | اعرض القيم الحالية (أسماء لا أسرار) قبل التبديل |
| **GitHub Secrets** | `BP_N8N_BASE` (+ `AI_SPACE_CONFIG`) | سير `azure-agents.yml` و`azure-ai-space.yml` |
| **صفحة جارفس** (Artifact المالك + `jarvis-local.html`) | مسارات الويبهوك على نطاق Cloud | تُعاد توليدها بالعنوان الجديد |
| **DNS** | `n8n` CNAME ← FQDN التطبيق + TXT `asuid.n8n` | تطبعها الخطوة 7 من `deploy.sh`. **اختر النطاق قبل ربط أي شيء خارجي** — WEBHOOK_URL يتغيّر مع النطاق |
| **كل الاعتمادات المحفوظة** | تُنشأ من جديد | انظر §2 |

## 5) ترتيب القطع

> مبدأ حاكم: **لا مجدول في الموضعين** (واتساب/بريد/مهام مكرّرة). كل ما هو stateful يعمل في موضع واحد في كل لحظة؛ `activate` يرفض تلقائياً ما يخالف ذلك، وكل أمر يمسّ الإنتاج يحتاج `--apply`.

### أ) قبل يوم القطع — لا أثر على العملاء
1. `az containerapp list -g bp-ai -o table` (انظر §1) ثم قرار المالك في النطاق والنسخة.
2. من Cloud Shell: `export N8N_VERSION=<نسخة Cloud: Help → About n8n>` (نفس نسخة Cloud ثابتة، لا latest) ثم `bash deploy.sh check` ← `1` ← `2` ← `3` ← `4` ← `5`.
   شغّل الخطوة 5 بـ`OWNER_IP=<عنوانك>` فيُحصر الدخول بعنوانك فور الإنشاء (وإلا فأول زائر يصير مالك n8n). أنشئ حسابك ثم مفتاح API (Settings → n8n API)، وقبل ويبهوكات الاختبار: `bash deploy.sh 8 unlock`.
3. `bash deploy.sh 7` (النطاق + الشهادة) ثم `bash deploy.sh 6 <أسماء $env من التقرير>`.
4. على جهازك (المفاتيح في بيئتك فقط):
   ```bash
   export N8N_SRC_URL=https://businesspartnerai.app.n8n.cloud  N8N_SRC_API_KEY=...
   export N8N_DST_URL=https://n8n.businesspartner.sa           N8N_DST_API_KEY=...
   node ops/n8n/migrate-workflows.mjs export ./n8n-export --dry-run   # الجرد والتقرير
   node ops/n8n/migrate-workflows.mjs export ./n8n-export
   node ops/n8n/migrate-workflows.mjs import ./n8n-export --dry-run   # البروفة على الوجهة
   node ops/n8n/migrate-workflows.mjs import ./n8n-export             # ينشئها غير مفعّلة
   ```
   المجلد `n8n-export/` لا يُدفع إلى git (فيه `.gitignore` ذاتي) — السيناريوهات قد تحمل مفاتيح مكتوبة داخل عقد.
5. أصلح ما في التقرير: ⛔ `$vars` ← `$env`؛ النداءات إلى `*.vercel.app` (مثل لوحة العروض `bp-quotes-three.vercel.app` في الكتالوج) تُوجَّه إلى نطاق الموقع على Azure قبل إيقاف Vercel؛ انسخ صفوف جداول البيانات واكتب `map.json`.
6. أضف Redirect URIs عند المزوّدين، ثم أنشئ الاعتمادات في Azure بأسمائها. بعدها أعد الاستيراد لإعادة ربط الاعتمادات بالاسم:
   `node ops/n8n/migrate-workflows.mjs import ./n8n-export --on-exists=update --data-table-map=map.json`
   (n8n يطابق اعتماداً غير موجود بالمعرّف باسمه ونوعه؛ **تحقّق من هذا السلوك على أول سيناريو** — إن لم يرتبط يُربط يدوياً في الواجهة).
7. اختبار الويبهوكات في Azure: `node ops/n8n/migrate-workflows.mjs activate ./n8n-export --only=webhook --apply` ثم نداء تجريبي لكل مسار. **تنبيه:** بعض الويبهوكات (`website-lead-notify`) ترسل واتساب للمالك فعلاً؛ اختبرها بعلمه وبرقمه هو، لا بعميل.

### ب) يوم القطع — نافذة هادئة (خارج الذروة، ويفضّل ليلاً)
1. أعلن النافذة. أعد التصدير والاستيراد `--on-exists=update` ليلحق ما عُدِّل في Cloud منذ آخر مرة.
2. **أوقف مجدولات Cloud:** `node ops/n8n/migrate-workflows.mjs pause-source ./n8n-export --only=stateful --apply`
   (يترك ويبهوكات Cloud فعّالة عمداً: هي صمّام التراجع ولا يناديها أحد بعد الآن).
3. **فعّل في Azure:** `node ops/n8n/migrate-workflows.mjs activate ./n8n-export --only=stateful --apply`
   (يتحقّق من المصدر ويرفض ما بقي فعّالاً هناك). الفاشل = اعتماد ناقص: أنشئه وأعد الأمر.
4. **Meta:** تحقّق أن Callback URL صار مضيف Azure، وأرسل من هاتف المالك رسالة اختبار إلى الرقم الرسمي. (لا رسالة إلى عميل.)
5. **حوِّل من يناديه:** `N8N_BASE_URL=https://n8n.businesspartner.sa` في Vercel/Container App (وقت التشغيل)، و`BP_N8N_BASE` للوكلاء، و`AI_SPACE_CONFIG`، ثم **بناء الموقع ونشره** بالمتغيّر نفسه (وقت البناء) — بأمر المالك. إن كان الموقع ينتقل إلى Azure في اليوم نفسه، فيُضاف `N8N_BASE_URL` إلى أمر البناء في `azure-deploy.yml` و`ops/azure/Dockerfile` (انظر §9).
6. **الكتالوج:** احذف عقدة Vercel من `vomoBu7MxIY8hTIP`، أنشئ اعتماد GitHub (fine-grained، `Actions: write` على المستودع)، وأكّد اسم ملف سير النشر وفرعه في أعلى `catalog-sync.workflow.js`. تبقى `promote: 'false'`: المراجعة تُنشأ بلا حركة وبيئة `azure-production` تنتظر موافقتك.
7. **الفحص بعد القطع:** بلا نداء حقيقي للعميل — حجز استشارة اختباري برقم المالك (`website-lead-notify` + التقويم)، تقديم ATS تجريبي (`bp-ats-application`)، محادثة باهر من الموقع، لوحة `/monitor`، نبض الفريق (آخر تنفيذ للموزّع يظهر في Azure خلال ٥ دقائق)، وغياب أي تنفيذ جديد في Cloud (Executions).

## 6) خطة التراجع

نافذة القرار: **أول ٢٤ ساعة** (بعدها تتراكم بيانات في جداول Azure لا تُنسخ للخلف تلقائياً).

1. `node ops/n8n/migrate-workflows.mjs pause-target ./n8n-export --only=stateful --apply` — أوقف مجدولات Azure **أولاً**.
2. `node ops/n8n/migrate-workflows.mjs resume-source ./n8n-export --only=stateful --apply` — أعد مجدولات Cloud.
3. أعد Meta Callback إلى Cloud، وأعد `N8N_BASE_URL` (احذفه) و`BP_N8N_BASE` و`AI_SPACE_CONFIG`، وأعد نشر الموقع.
4. ما كُتب في جداول Azure أثناء النافذة يُصدَّر CSV ويُدمج في جداول Cloud يدوياً، أو يُقبل ضياعه إن كانت النافذة قصيرة.

الترتيب (٢ قبل ١ ممنوع) هو نفسه مبدأ «لا مجدول في الموضعين».

## 7) متى يُوقف n8n Cloud

**ليس يوم القطع.** يبقى مُوقَف المجدولات (لا محذوفاً) **١٤ يوماً** كاملة، ثم يُوقف عند تحقّق كل ما يلي:
- ١٤ يوماً بلا تراجع، وكل المجموعات في §2 عملت في Azure دورة كاملة (الأسبوعية: Newsletter، الشهرية إن وُجدت).
- نسخة احتياطية أخيرة: تصدير السيناريوهات + تصدير صفوف كل جداول البيانات، محفوظان في Azure Blob **خاص** (لا git).
- لا مرجع باقٍ للعنوان القديم: `grep -rn "n8n.cloud"` في المستودع، وقيم Vercel/Container App/GitHub Secrets، وMeta، والمزوّدون، ونوشن (§4).
- النسخة الاحتياطية من مفتاح تشفير n8n الجديد محفوظة خارج Azure.
ثم: `pause-source --only=all --apply`، ثم يُلغي المالك الاشتراك عند تاريخ التجديد من لوحة n8n Cloud (قرار مالي — لا يفعله Claude).

## 8) قيود ومخاطر معلنة

- **TLS إلى PostgreSQL:** `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` (التشفير قائم، التحقق من الشهادة لا). تحسينه بتثبيت شهادة الجذر في الحاوية بند لاحق. الوصول محصور بـ«خدمات Azure» وكلمة مرور من Key Vault.
- **تداخل مراجعتين عند الترقية** (ثوانٍ): قد يتكرّر مشغّلٌ واحد؛ لذلك `upgrade` خارج الذروة. لا تُغيَّر الإعدادات أثناء ساعات واتساب النشطة.
- **النسخة المثبّتة:** يجب ألا تكون أقدم من نسخة Cloud (تنفتح السيناريوهات بعقد أحدث ولا تعمل). وبعد القطع تُرقّى بنسخة مثبّتة لا latest.
- **سجلّ التنفيذات:** يُحفظ كل شيء ويُقصّ بعد ٧٢ ساعة / ٢٠ ألف تنفيذ (الاستهلاك ≈٥٫٨ ألف يومياً، وحمولة جارفس كبيرة). الغاية: لا انتفاخ للقاعدة مع بقاء ما يلزم للتشخيص. تُضبط من `EXECUTIONS_DATA_*`.
- **القاعدة الأمنية:** الأسرار (مفتاح التشفير، كلمة مرور القاعدة، مفاتيح `$env`) في Key Vault بمراجع هوية مُدارة؛ لا قيمة في إعدادات التطبيق ولا في السجلّ. `pg create` وحده يمرّر كلمة المرور في سطر أمر Azure CLI داخل Cloud Shell لثوانٍ (لا بديل في `az`).
- **N8N_BLOCK_ENV_ACCESS_IN_NODE=false** مضبوط عمداً لأن بعض العقد تقرأ `$env`. أي عقدة جديدة لا تحتاج أسراراً مباشرة يُفضَّل أن تستعمل الاعتمادات.
- **العدد الحقيقي لسيناريوهات `stateful`** يحسمه الجرد؛ إن وُجدت عقد مشغّل لم تعرفها الأداة (أنواع مجتمعية) فتُصنَّف `stateful` احتياطاً (الأحوط).

## 9) خارج نطاق هذا العمل — ينتظر مالكيه (لم أكتب فيها)

| الملف/الموضع | المالك | ما يلزم |
|---|---|---|
| `ops/azure/Dockerfile` و`.github/workflows/azure-deploy.yml` (فرع `azure-migration`) | `platform-engineer` | تمرير `N8N_BASE_URL` كـbuild-arg/متغيّر بناء، وإلا بُنيت صفحات المتصفح في صورة Azure بعنوان Cloud القديم |
| `site/scripts/n8n-guard.mjs` + حقنه في `write()` (فرع `azure-migration`) | `platform-engineer` | الحارس يمنع النداء إلى مضيفات تنتهي بـ`n8n.cloud` من `localhost`/`*.vercel.app`، ويُحقن في الصفحات التي تحوي `n8n.cloud/webhook`. بعد القطع يصير **بلا أثر** وتُطلق المعاينات إنتاجاً حقيقياً. يجب أن يطابق مضيف `N8N_BASE_URL` أيضاً |
| `api/_eor.js` و`api/chat.js` و`api/_aiws.js` | `eor` و`advisor` و`ai-workspace` | **أُنجز على هذا الفرع (azure-migration):** الثلاثة تستعمل `n8nWebhookUrl(...)` (فحصها `tests/n8n-migrate.test.mjs`). يبقى على فرع الإنتاج (فيرسل) بالعنوان الحرفي — لا قطع n8n قبل أن تصله هذه الكوميتات أو قبل أن يُقطع الموقع نفسه |
| `azure/n8n/deploy.sh` و`.github/workflows/azure-n8n.yml` و`ops/n8n-migrate.mjs` | `platform-engineer` | **تحلّ محلّها العُدّة الجديدة** (انظر §1). يُحذف القديم أو يُوسَم «مُستبدَل» بعد قرار المالك في حالة `bp-n8n` الموجود |
| `site/assets/data/compliance-dashboard.html` | `compliance` | مصدر خام فيه العنوان القديم حرفياً (تستبدله عملية البناء في الصفحة المولَّدة، لكن الملف نفسه يُخدَم من `/assets/data/` إن فُتح مباشرة) |
| سير `n8n/*` و`ops/n8n/*` الأخرى (`bp-agent-send`، `doc-agent-*`، `baher-intake-v2`) | هذا الوكيل | لا عنوان Cloud فيها حرفياً؛ لا تغيير |

## 10) قرارات المالك المطلوبة

١. **النطاق:** `n8n.businesspartner.sa` (موصى به: عنوان لا يتغيّر مع الاستضافة) أم عنوان `azurecontainerapps.io` الافتراضي؟
٢. **`bp-n8n` القائم (إن وُجد):** يُحذف ويُعاد في UAE North، أم يُنشأ جديد باسم آخر؟
٣. **نافذة القطع:** يوم وساعة، وموافقتك على تبديل Callback في Meta (يمسّ واتساب الحيّ).
٤. **جداول البيانات:** موافقتك على نسخ صفوفها (٩ جداول) — هي ذاكرة الفريق التشغيلية.
٥. **GitHub token** (fine-grained، `Actions: write` على هذا المستودع فقط) لعقدة نشر الكتالوج، وهل `promote` يبقى `false` (موصى به).
٦. **مدة الإبقاء قبل إيقاف Cloud:** ١٤ يوماً مقترحة، وتكلفتها اشتراك شهر إضافي.
٧. تنسيق القطع مع **قطع الموقع من Vercel**: n8n يمكن أن ينتقل أولاً (لا يحتاج الموقع على Azure)، والأفضل أن يسبق قطعَ الموقع بأيام لتُفصل المخاطر.
