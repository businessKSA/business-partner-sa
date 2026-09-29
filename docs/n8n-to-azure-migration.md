# نقل n8n إلى Azure — الجرد والخيارات والخطة

جرد ما يعمل فعلاً على n8n Cloud (2026-09-29)، وما يربطه بالموقع في الاتجاهين،
وخطة نقل لا تُسقط واتساب الإنتاج ولا نموذجاً بيد عميل.

قرار المالك (2026-09-15): **كل شيء على Azure**. الذكاء والخزنة ومجلدات العملاء
انتقلت (`ops/azure/README.md` §1)، وقاعدة البيانات كودها جاهز وبياناتها في
انتظار التبديل (§5 هناك). بقي شيئان خارج Azure: Supabase حتى تُنقل القاعدة،
و**n8n Cloud** — وهو موضوع هذا الملف.

---

## 1) ما هو قائم فعلاً على n8n Cloud

المثيل: `businesspartnerai.app.n8n.cloud`. جُرد عبر MCP في 2026-09-29:

| | العدد |
|---|---|
| سيناريوهات (workflows) | **١١١** |
| منها **نشط** (active) | **٨١** |
| بيانات اعتماد (credentials) | **٣٥** |

`docs/projects.md` يقول «١٠١ سيناريو» — الرقم قديم؛ أُنشئت عشرة منذ ذلك
التدوين، سبعة منها يوم الجرد نفسه (فريق المدراء وJarvis).

### الأسر الوظيفية للنشط منها

| الأسرة | أمثلة (المعرّف) | المشغّل |
|---|---|---|
| **واتساب الإنتاج** | `BP-WhatsApp-Main` (`tIb4wNOSYVTZQuox`) وفروعه الخمسة: `BP-Sub-Advisor` · `BP-Sub-Menu` · `BP-Sub-AI-Conversation` · `BP-Sub-Documents` · فرح (`YgRwn40v1CqsscJw`) | WhatsApp Trigger (Meta) |
| **لوحة المحادثات** | `BP-Chat-Monitor-API` · `BP-Chat-Suggest` · `BP-Chat-Media` · إشعار عميل الموقع | Webhook تناديه `/monitor` |
| **فريق المدراء الذكي** | ١٧ سيناريو `BP Team — *` (باهر، مازن، بدر، عبدالرحمن، عبدالعزيز، ناصر، مشاري، أحمد، سارة، سلمان، محمد، ملاك، عبدالله، بندر، وسام، علاء، طارق) + Lead Consultant + Finance + Business Model + Market Research | Webhook `<slug>-intake` تناديه صفحات `/team/*` و`/chat` |
| **حلقات التشغيل الذاتي (BP AI)** | Task Dispatcher (كل ٥ د) · Task Review Loop (كل ١٠ د) · Deal Lifecycle (كل ١٠ د) · Stuck Task Sweeper (كل ساعة) · Cash Watchdog (كل ساعتين) · KPI Scorecard (يومي) · Unified Revenue Intake · Agent Control Center · AI Space Data API | Schedule + Webhook |
| **التوظيف** | Website ATS Intake (`E4DC5bIkRqFaDlhr`) · Outlook CVs → ATS (كل ٣ د) · Job Posting & Screening · Headhunter · Candidate↔Job Matcher · بوابة المرشحين | Webhook + Schedule + Gmail/Outlook + ٣ نماذج n8n Forms |
| **بوابة الخدمات المشتركة** | `ss-login` · `ss-chat` · `ss-onboard` · `ss-stats` · `ss-names` · `ss-knowledge` · Web Chat خالد · عميل صفر | Webhook + Chat Trigger |
| **الامتثال والعميل** | Client Portal API · استخراج المستندات B · قائد الامتثال · محلل ملفات العملاء (يومي ٠٧:٣٠) · وكيل الامتثال (Chat) | Webhook + Schedule |
| **استقبال نماذج الموقع** | `client-intake-web` (`R71kgwaBNw6WzKFI`) | Webhook تناديه صفحة تسكين العمالة |
| **محفول مكفول** | واتساب محفول (أقدم سيناريو، 2026-06-01) · مصمّم الرحلات · مطابقة إيصالات الدفع | WhatsApp + Webhook |
| **العقارات** | RE Matching (كل ٢٠ د) · RFQ Dispatch (كل ٣٠ د) | Schedule |
| **البريد والتسويق** | Email → Notion CRM · Bounce Handler · Weekly Newsletter · Daily Gov News · Gov Updates Monitor · Social Publisher (كل ١٥ د) · Classify Leads · Sales DB Hygiene · Investor Pipeline · Visa Tracker Sync · الكنس اليومي (٠٦:٠٠ و١٦:٠٠) | Gmail Trigger + Schedule |
| **الصوت** | Jarvis Voice (Azure Neural TTS) · Jarvis Pulse | Webhook |
| **المعالج المركزي** | `BP-Error-Handler` (`DEEBmcadEhrncGo4`) — كل السيناريوهات تحيل أخطاءها إليه | Error Trigger |

الثلاثون المتوقفة: حملات بريد قديمة (يونيو)، جامعات شركات (Places/OSM/Apollo)،
one-shot setup، تجارب DEV، ومزامنة الكتالوج التي كانت تدفع إلى `bp-quotes`.
**لا تُنقل** — تُصدَّر للأرشيف فقط (§5، الخطوة ٠).

### لماذا لا يُعاد بناؤها على Logic Apps

`BP-WhatsApp-Main` وحده **٧٨ عقدة**: ٢٢ شرطاً، **١٨ عقدة Code** بجافاسكربت،
١٤ نداء Notion، ١٠ HTTP، ٥ استدعاءات لسيناريوهات فرعية. وسيناريوهات الفريق
تقوم على عقد LangChain (`AI Agent` + `Azure OpenAI` + Output Parser + ذاكرة)
التي لا مقابل مباشراً لها في Logic Apps. إعادة كتابة ٨١ سيناريو بهذا الشكل
تعني شهوراً من العمل لتصل إلى ما يعمل اليوم، وكل شهر منها يُدار نظامان.

Logic Apps يبقى مناسباً لما هو **ناقل رقيق** لا منطق فيه — وهذا ما كُتب
فعلاً في `ops/azure/whatsapp-logic-app.json`: استقبال واتساب وتمريره إلى
`api/_docagent.js`. أما ما فيه منطق فيذهب إلى أحد مسارين (§3).

---

## 2) خريطة الارتباط — من ينادي من

### الموقع → n8n (كل ما ينكسر لو تغيّر عنوان n8n)

| أين | ما يُنادى | المتغيّر / الثابت |
|---|---|---|
| `api/candidate.js` (وعبره `api/_agencies.js`) | `POST /webhook/bp-ats-application` — ينتظر ردّ الفرز حتى ٥٠ ثانية | `N8N_ATS_WEBHOOK` أو `N8N_CANDIDATE_WEBHOOK` أو `BP_ATS_WEBHOOK`، وافتراضي **مكتوب في الكود** |
| `api/requests.js` · `api/_stage.js` · `api/book.js` | `POST /webhook/website-lead-notify` — إشعار المالك واتساب | `OWNER_WA_WEBHOOK`، وافتراضي **مكتوب في الكود** في الثلاثة |
| `api/requests.js` · `api/book.js` · `api/workspace.js` | نسخة من كل lead | `LEAD_WEBHOOK_URL` (اختياري، بلا افتراضي) |
| `api/_docagent.js` | مرآة الخزنة (Drive + نوشن) | `DOC_AGENT_SYNC_URL` (اختياري) |
| `site/scripts/assets/monitor.page.html` | `bp-chat-monitor-*` · `bp-chat-send-*` · `bp-chat-suggest-*` · `bp-chat-media-*` | **أربعة عناوين ثابتة في المتصفح** |
| `site/scripts/generate.mjs` — تسكين العمالة | `POST /webhook/client-intake-web` (multipart) | ثابت في المتصفح |
| `site/scripts/generate.mjs` — `/team/*` و`/chat` وبوابة SS | `N8N_BASE + '/' + <slug>-intake` و`KHALED_EP` (chat trigger) | **خمسة مواضع** بثابت `N8N_BASE`/`N8N` |
| `site/scripts/assets/admin.page.html` | رابط لوحة n8n + ثلاثة نماذج Forms للتوظيف | ثابت |
| **Meta (WhatsApp Cloud API)** | Callback URL للتطبيق يشير إلى n8n Cloud | **خارج المستودع — يضبطه المالك** |
| واجهة BP AI Command Space (Vercel) | `🛰️ BP AI Space — Data API` (`3B9PXV0YhcLOgMqi`) | خارج هذا المستودع (`docs/org-chart-2026-09-24.md`) |

الخلاصة العملية: **عنوان n8n منثور في ١٢ موضعاً على الأقل** بين كود الخادم
والمتصفح، وأربعة منها افتراضيات مكتوبة في الكود لا في البيئة. أول خطوة كود في
الخطة (§5، الخطوة ٢) هي جمعها في ثابت واحد قبل أي نقل.

### n8n → الموقع (ما يجب أن يبقى صحيحاً بعد النقل)

| من n8n | إلى | المفتاح |
|---|---|---|
| `Agent Gate` (`n8n/wa-agent-gate.js`) | `POST /api/simple` `ops-wa-check` | `BP_PANEL_KEY` في متغيّرات n8n |
| `Follow-up Sweep` (`n8n/followup-sweep.js`) | `POST /api/simple` `ops-followup-run` | `BP_PANEL_KEY` |
| `BP-Sub-AI-Conversation` أداة `site_catalog` | `GET /api/requests?action=catalog` | بلا مفتاح |
| واتساب المستندات (`ops/n8n/doc-agent-whatsapp.workflow.js`) | `POST /api/requests?__route=doc-agent` | `DOC_AGENT_HOOK_KEY` |
| `BP-WhatsApp-Main` | `www.businesspartner.sa` (HTTP node واحد) | — |

هذه كلها **عناوين الموقع**، لا تتغيّر بالنقل. ما يتغيّر هو متغيّرات بيئة n8n
(`BP_PANEL_KEY`، `DOC_AGENT_HOOK_KEY`) — تُنقل بقيمها نفسها.

### بيانات الاعتماد الخمس والثلاثون — لا تُصدَّر

n8n لا يُصدّر أسرار الاعتماد. كل واحدة تُنشأ من جديد على المثيل الجديد، ومنها
ما يحتاج **موافقة OAuth بيد المالك** في المتصفح:

| النوع | العدد | ملاحظة |
|---|---|---|
| WhatsApp (Trigger + Send) | ٧ | ثلاثة أرقام: `0507034157` الوكيل، `0530540231` فرح، محفول |
| Gmail OAuth2 | ٤ | Business Partner · Farina · اثنان قديمان |
| Notion OAuth2 (+ MCP) | ٣ | `Business Partner OS — Production` هي المستخدمة في ١٧ عقدة بالسيناريو الرئيسي |
| Google Drive · Calendar | ٢ | OAuth |
| Microsoft Outlook | ١ | OAuth — وكيل السير الذاتية (20k+) |
| LinkedIn | ٢ | OAuth — الناشر |
| GitHub | ١ | OAuth |
| Azure OpenAI (`bp-main`) | ١ | مفتاح — **هذا هو المحرّك الموحّد** |
| Azure Speech · ElevenLabs · Daftra · Vercel · Header Auth ×٤ | ٩ | مفاتيح في ترويسة HTTP |
| OpenAI · Anthropic · Gemini · OpenRouter | ٤ | **مزوّدون خارج Azure** — الأول لا يزال معرّفاً في سيناريو ATS كعقدة بديلة غير موصولة |
| oAuth2Api بلا اسم | ١ | يُحدَّد ما هو قبل النقل أو يُهمل |

فرصة في الطريق: الأربعة الأخيرة (OpenAI/Anthropic/Gemini/OpenRouter) تُترك
خلفنا ولا تُنشأ على المثيل الجديد؛ ما يستخدمها من السيناريوهات يُحوَّل إلى
`bp-main` قبل التصدير، فيصير n8n على قاعدة الموقع نفسها: Azure OpenAI وحده
(`ops/azure/README.md` §1).

---

## 3) الخيارات

| | (أ) إعادة البناء على Logic Apps | (ب) استضافة n8n على Azure Container Apps | (ج) نقل المنطق إلى `api/` |
|---|---|---|---|
| ما يُنقل | كل سيناريو يُكتب من جديد | **كل الـ١١١ كما هي** (تصدير/استيراد JSON) | ما هو منطق موقع أصلاً |
| المدة | شهور | أسابيع | مستمر، سيناريو سيناريو |
| ما يُفقد | عقد LangChain، Code nodes، تاريخ التنفيذ | اشتراك n8n Cloud وأدواته الإدارية (MCP، النسخ الاحتياطي المُدار) | لا شيء |
| ما يُكسب | أصالة Azure كاملة | **مثيل واحد، منطقة واحدة، قاعدة Azure PG نفسها، ولا اشتراك SaaS** | كود يُراجَع في PR ويُختبر |
| المخاطرة | عالية: نظامان لشهور، وواتساب الإنتاج بينهما | متوسطة: تغيير عنوان + إعادة اعتماد OAuth | منخفضة لكل خطوة |

**التوصية: (ب) كمنصة، و(ج) كاتجاه دائم، و(أ) للنواقل الرقيقة فقط.**

- (ب) يحقق «كل شيء على Azure» بأقل تغيير: n8n برنامج مفتوح المصدر يُشغَّل
  بحاوية رسمية (`docker.n8n.io/n8nio/n8n`)، ويحفظ حالته في PostgreSQL —
  وعندنا خادم Azure PG جاهز من هجرة القاعدة. رخصته (Sustainable Use) تسمح
  بالاستضافة الذاتية للاستخدام الداخلي للشركة.
- (ج) هو ما بدأ فعلاً: مزامنة الخزنة صارت في `api/_docagent.js` مباشرة إلى
  SharePoint، وبوابة الوكيل والمتابعة الذكية كودهما في المستودع ويُلصق في
  n8n. كل ما يمسّ بيانات عميل في `requests`/`users` يستمر بهذا الاتجاه.
- (أ) يبقى لما كُتب له: واتساب → وكيل المستندات. **لا يُوسَّع** إلى ما فيه
  منطق.

---

## 4) الشكل المستهدف على Azure

| المكوّن | الاختيار | لماذا |
|---|---|---|
| الحوسبة | **Azure Container Apps**، تطبيق واحد، `minReplicas = maxReplicas = 1` | n8n بوضعه الافتراضي (single main) لا يعمل بأكثر من نسخة؛ وضع الطوابير (queue mode + Redis) لا يلزمنا بهذا الحجم |
| الصورة | `docker.n8n.io/n8nio/n8n:<إصدار مثبَّت>` — **لا `latest`** | ترقية n8n قرار لا صدفة |
| قاعدة البيانات | قاعدة **`n8n`** منفصلة على خادم Azure PG الحالي نفسه، اتصال مباشر `5432` | `ops/azure/README.md` §2 — n8n (TypeORM) لا يُوصل عبر PgBouncer في وضع transaction |
| الملفات | حصة **Azure Files** مركّبة على `/home/node/.n8n` | فيها مفتاح التشفير والبيانات الثنائية (`N8N_DEFAULT_BINARY_DATA_MODE=filesystem`)؛ Container Apps لا يركّب Blob، وAzure Files يبقى عبر إعادة النشر |
| المنطقة | **المنطقة نفسها التي فيها خادم PG** | السعودية الشرقية غير متاحة بعد (المدوَّن: نوفمبر 2026) — تُختار أقرب منطقة والنقل لاحقاً مع القاعدة |
| النطاق | `n8n.businesspartner.sa` بشهادة مُدارة | الويبهوكات والنماذج وواجهة الإدارة كلها تحته |
| الدخول | إدارة مستخدمي n8n (المالك مالكَ المثيل)، والويبهوكات عامة كما هي اليوم | Meta والموقع يناديانها من الإنترنت |
| المراقبة | Container Apps logs → Log Analytics، و`BP-Error-Handler` كما هو | المالك يُنبَّه واتساب وبريداً عند أي فشل، كما اليوم |

متغيّرات الحاوية الأساسية:

```
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=<host>.postgres.database.azure.com
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=<user>
DB_POSTGRESDB_PASSWORD=<secret>
DB_POSTGRESDB_SSL_ENABLED=true
N8N_ENCRYPTION_KEY=<secret — يُولَّد مرة ويُحفظ؛ ضياعه = ضياع كل الاعتمادات>
N8N_HOST=n8n.businesspartner.sa
N8N_PROTOCOL=https
N8N_PORT=5678
WEBHOOK_URL=https://n8n.businesspartner.sa/
GENERIC_TIMEZONE=Asia/Riyadh
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336            # ١٤ يوماً
BP_PANEL_KEY=<نفس مفتاح /ops>
DOC_AGENT_HOOK_KEY=<نفس قيمة Vercel>
```

الأسرار تُوضع كـ**Secrets** في Container Apps وتُشار إليها من المتغيّرات، لا
تُكتب قيماً مباشرة. **لا شيء منها يُكتب في هذا المستودع** (`CLAUDE.md` §4).

---

## 5) خطة النقل — خطوة بخطوة

**من يفعل ماذا:** كما في هجرة القاعدة — Claude لا يصل إلى لوحة Azure ولا
إلى Meta. كل ما يلمس Azure أو Vercel أو Meta أو موافقة OAuth **يفعله
المالك**؛ وكل ما هو كود في المستودع أو تصدير/استيراد عبر API بمفتاح يعطيه
المالك **يفعله Claude**.

0. **الجرد والتجميد — Claude.** تصدير الـ١١١ سيناريو JSON عبر API إلى
   `ops/n8n/export/<id>.json` (بلا أسرار — n8n لا يصدّرها أصلاً) وكوميت.
   هذا أرشيف مؤرَّخ يُقارَن به بعد الاستيراد، وهو أول نسخة مصدرية كاملة من
   n8n في المستودع. يُرفق به `ops/n8n/export/INDEX.md`: المعرّف، الاسم،
   نشط/متوقف، الأسرة، نوع المشغّل، والاعتمادات التي يستخدمها.
   ثم **إعلان تجميد**: لا تعديل في n8n Cloud بعد التصدير إلا بإعادة
   التصدير.
   **نُفّذت 2026-09-29** (أمر المالك «نفّذ الخطوتين ٠ و٢»): الـ١١١ ملفاً في
   `ops/n8n/export/` والفهرس في `ops/n8n/export/INDEX.md`. الفحص وجد
   **أسراراً مكتوبة حرفياً داخل السيناريوهات** وحُجبت في الأرشيف بتعبيرات
   `$env` (التفصيل في الفهرس، قسم «ما حُجب») — أما النسخ الحيّة على n8n Cloud
   فما زالت تحمل القيم، وتبديل المفاتيح قرار المالك (§8).

1. **توحيد المزوّد — Claude ثم المالك.** كل عقدة `lmChatOpenAi`/Anthropic/
   Gemini/OpenRouter في السيناريوهات **النشطة** تُحوَّل إلى
   `lmChatAzureOpenAi` (`bp-main`) — كما فُعل في ATS Intake. يُعاد التصدير.
   المالك يُوافق على قائمة السيناريوهات المتأثرة قبل التعديل.
   **حجمها من الفهرس (2026-09-29):** ٢٧ سيناريو يشير إلى اعتماد خارج Azure
   (OpenAI / Anthropic / Gemini / OpenRouter / ElevenLabs)، منها **٢١ نشطاً** —
   كثير منها عقد نموذج معطّلة أو بديلة بقيت موصولة بالاعتماد، وبعضها على مسار
   التنفيذ فعلاً (قارئ الإيصالات على Gemini، وWhisper في مركز التحكم، وصوت
   ElevenLabs في Data API). القائمة بالاسم في عمود «خارج Azure» بالفهرس.

2. **عنوان واحد في الكود — Claude، قبل أي إنشاء على Azure.**
   - الخادم: متغيّر بيئة واحد `N8N_BASE_URL` تُشتق منه الأربعة
     (`N8N_ATS_WEBHOOK`، `OWNER_WA_WEBHOOK`، `DOC_AGENT_SYNC_URL`،
     وLEAD إن ضُبط) حين لا يُعطى كلٌّ منها صراحةً؛ وتُحذف الافتراضيات
     المكتوبة في `api/candidate.js` و`api/requests.js` و`api/_stage.js`
     و`api/book.js`. **الملفات لوكلائها**: `candidate.js` لـ
     `recruitment-candidate`، `requests.js`/`_stage.js`/`book.js` لـ
     `client-portal` — يُنسَّق معهم ولا يُكتب فيها من غيرهم.
   - المتصفح: ثابت بناء واحد `N8N_BASE` في `generate.mjs` يُحقن في
     `/team/*` و`/chat` وبوابة SS وصفحة تسكين العمالة و`monitor.page.html`
     و`admin.page.html` — بدل الثوابت الاثني عشر.
   - **بلا تغيير في القيمة**: يبقى يشير إلى n8n Cloud. الهدف أن يصير
     التبديل لاحقاً سطراً واحداً في Vercel وسطراً في البناء.
   - `npm run build` و`npm test` كاملان.
   **نُفّذت 2026-09-29:** `api/_n8n.js` (`N8N_BASE_URL` + `n8nWebhook()`)
   يغذّي `candidate.js` و`requests.js` و`_stage.js` و`book.js` و`chat.js`
   (الأخير لم يكن في الجرد الأول — كان السادس)؛ و`N8N_BASE` في `generate.mjs`
   يغذّي الصفحات الثماني، ويستبدل العلامة `__N8N_BASE__` في `monitor.page.html`
   و`admin.page.html`. `grep -rn "app.n8n.cloud"` خارج الأرشيف يعود بموضعين
   فقط: الافتراضي في `api/_n8n.js` والافتراضي في `generate.mjs`. الصفحات
   المولَّدة خرجت **مطابقةً بايتاً بايت** لما قبل التغيير، والاختبارات ٨٧/٨٧.

3. **إنشاء البنية — المالك** (§4): قاعدة `n8n` ومستخدمها على خادم PG،
   حساب تخزين وحصة Azure Files، بيئة Container Apps، التطبيق بالصورة
   المثبَّتة والأسرار والمتغيّرات، النطاق `n8n.businesspartner.sa`
   وسجلّه DNS والشهادة. ثم فتح `https://n8n.businesspartner.sa` وإنشاء حساب
   المالك. **لا استيراد بعد.**

4. **الاعتمادات — المالك.** إنشاء الخمس والثلاثين (§2) بالأسماء نفسها على
   المثيل الجديد، مع موافقات OAuth (Gmail ×٤، Notion ×٣، Drive، Calendar،
   Outlook، LinkedIn ×٢، GitHub) — كل موافقة تفتح نافذة متصفح بيد المالك.
   WhatsApp: بيانات Meta نفسها؛ **لا يُغيَّر Callback URL في Meta بعد.**
   الأربعة خارج Azure لا تُنشأ (الخطوة ١ أزالت الحاجة إليها).

5. **الاستيراد — Claude** بمفتاح API للمثيل الجديد يعطيه المالك مؤقتاً:
   - جدول ربط `<معرّف اعتماد قديم> → <جديد>` يُبنى من قائمة الاعتمادات
     الجديدة بالاسم، وتُبدَّل المعرّفات في ملفات التصدير قبل الاستيراد.
   - تُستورد **الـ٨١ النشطة فقط** بمعرّفاتها نفسها (حتى تبقى استدعاءات
     `Execute Workflow` بين الرئيسي وفروعه صحيحة) — **كلها متوقفة**
     (`active: false`) عند الاستيراد.
   - تحقّق: `INDEX.md` مقابل المثيل الجديد — لا سيناريو ناقص، ولا عقدة
     باعتماد غير محلول.

6. **التشغيل الموازي على غير الإنتاج — المالك يفعّل، Claude يفحص.**
   تُفعَّل على الجديد أولاً السيناريوهات التي **لا تُستدعى من الخارج ولا
   تُجدوَل**: الفريق الذكي (`<slug>-intake`)، بوابة SS، لوحة المحادثات، Jarvis.
   يُفحص كل واحد بنداء يدوي على العنوان الجديد ويُقارن ردّه بالقديم. لا يزال
   الموقع يشير إلى القديم، فلا عميل يتأثر.

7. **التبديل الأول — الويبهوكات التي يناديها الموقع.** المالك يضع
   `N8N_BASE_URL` الجديد في Vercel (Preview أولاً)، وClaude يغيّر ثابت
   البناء ويدفع بكوميت **بلا علامة نشر**؛ يُفحص على المعاينة: نموذج
   التوظيف (يُنتظر ردّ الفرز)، تسكين العمالة، `/team/*`، `/monitor`. ثم
   نشرة متعمَّدة بالعلامة المتفق عليها في `CLAUDE.md`. بعدها يُوقَف
   المقابل على n8n Cloud (يبقى موجوداً، غير نشط).

8. **التبديل الثاني — المجدولات.** هذه هي الوحيدة التي **تعمل مرتين** لو
   نشطت على المثيلين معاً (حملة تُرسل مرتين، مهمة تُفتح مرتين). لذلك لكل
   واحدة على حدة: **إيقاف على Cloud ثم تفعيل على Azure في الدقيقة نفسها**،
   بالترتيب: القراءة فقط أولاً (KPI، Watchdog، Pulse)، ثم الحلقات ذات
   الحماية من التكرار (Dispatcher، Review Loop، Deal Lifecycle، Sweeper —
   وصفها يقول idempotent)، ثم المرسِلات (الكنس اليومي، النشرة، الأخبار،
   الناشر، CVs → ATS). المالك ينفّذ لأن الإيقاف/التفعيل على Cloud بيده.

9. **التبديل الثالث — واتساب الإنتاج — المالك وحده.** تفعيل
   `BP-WhatsApp-Main` وفروعه وفرح ومحفول على Azure، ثم تغيير **Callback
   URL** في تطبيق Meta إلى `https://n8n.businesspartner.sa/webhook/...`
   (العنوان الذي يعرضه Trigger الجديد) والتحقق من الاشتراك. اللحظة نفسها
   يتوقف وصول الرسائل إلى Cloud — لا ازدواج. يُختبر فوراً برسالة من رقم
   خارجي: القائمة، المستشار، البوابة (`ops-wa-check`)، الإشعار للمالك.
   **وقت هادئ** (بعد منتصف الليل بتوقيت الرياض)، والرجوع = إعادة الـURL
   القديم في Meta وتفعيل السيناريو على Cloud.

10. **أسبوعان موازيان ثم الإغلاق — المالك.** n8n Cloud يبقى بلا سيناريو
    نشط أسبوعين (تاريخ التنفيذات القديمة مرجع عند أي شكّ)، ثم يُلغى
    الاشتراك. `ops/n8n/export/` هو الأرشيف.

11. **التوثيق في الدفعة نفسها:** `docs/projects.md` (§6: العدد والمكان
    الجديد)، `n8n/README.md` و`ops/n8n/README.md` (العنوان)، `ops/azure/
    README.md` §6، وهذا الملف بحالة كل خطوة.

---

## 6) مخاطر معروفة وكيف تُتّقى

| الخطر | الاتقاء |
|---|---|
| ضياع `N8N_ENCRYPTION_KEY` يُتلف كل الاعتمادات | يُحفظ في Key Vault عند الإنشاء، لا في الحاوية وحدها |
| تنفيذ مزدوج للمجدولات في فترة التوازي | الخطوة ٨: واحدةً واحدة، إيقاف ثم تفعيل، بالترتيب من الأقل ضرراً |
| انقطاع واتساب أثناء إعادة نشر الحاوية (نسخة واحدة) | Meta يعيد المحاولة على الفشل؛ التحديثات في وقت هادئ؛ ولا `latest` |
| جدول التنفيذات يتضخّم في PG | `EXECUTIONS_DATA_PRUNE` ١٤ يوماً؛ السيناريو الرئيسي يحفظ كل تنفيذ ناجح (`saveDataSuccessExecution: all`) — يُراجع |
| Container Apps يوقف النسخة الخاملة | `minReplicas = 1` — الأداة لا تُطفأ |
| عناوين قديمة منسيّة | الخطوة ٢ تجمعها؛ وبعد الإغلاق، `grep -r "app.n8n.cloud"` على المستودع يجب أن يعود فارغاً |
| إدارة n8n من جلسات Claude عبر MCP | ما نستعمله اليوم هو MCP الرسمي لـn8n Cloud؛ يُتحقّق قبل الخطوة ٣ من توفّره على المستضاف ذاتياً بالإصدار المختار، وإلا فـREST API n8n (`/api/v1`) بمفتاح — وكلاهما يكفي للتصدير والاستيراد والنشر |
| النماذج الثلاثة (Forms) والصفحة المستضافة لشات خالد تتغيّر عناوينها | كلها في `admin.page.html` و`generate.mjs` وتُحدَّث في الخطوة ٧ |
| واجهة BP AI Command Space تقرأ Data API من Cloud | خارج المستودع — تُحدَّث بيد المالك في الخطوة ٧ |
| **مفاتيح مكتوبة حرفياً داخل السيناريوهات** (وجدها تصدير الخطوة ٠): مفتاح لوحة `/ops` في عقد IF وHTTP، ومفتاح وسائط المحادثة، ومفتاح GOSI الرملي | حُجبت في الأرشيف بتعبيرات `$env`؛ عند الاستيراد تُضبط `BP_PANEL_KEY` و`BP_CHAT_MEDIA_KEY` كمتغيّرات بيئة على المثيل الجديد، **وتُبدَّل القيم** لأنها عاشت في سيناريوهات يقرؤها كل من له دخول n8n |

---

## 7) ما لا يُفعل

- لا إعادة كتابة للسيناريوهات النشطة على Logic Apps (§1).
- لا مثيل n8n ثانٍ على Vercel أو غيره، ولا مشروع Vercel جديد (`CLAUDE.md` §1).
- لا استيراد قبل الاعتمادات، ولا تفعيل قبل الفحص، ولا تغيير Callback في Meta
  قبل الخطوة ٩.
- لا حذف لـn8n Cloud قبل مرور الأسبوعين، ولا قبل أن يعود `grep` بفراغ.
- لا سرّ في المستودع: لا مفتاح تشفير، ولا رابط قاعدة، ولا مفتاح API.

---

## 8) ما يحتاج قرار المالك

1. **اعتماد الخيار (ب)** — استضافة n8n على Container Apps — بدل إعادة البناء.
2. **المنطقة**: نفس منطقة خادم PG (وتنتقلان معاً إلى السعودية الشرقية حين
   تتوفر).
3. **النطاق** `n8n.businesspartner.sa`.
4. **التكلفة**: حاوية دائمة (نسخة واحدة، نحو 1 vCPU / 2 GiB) + حصة Azure
   Files + قاعدة إضافية على خادم PG القائم، مقابل إلغاء اشتراك n8n Cloud.
   الرقم من حاسبة Azure بيد المالك؛ هذا الملف لا يخترع أرقاماً.
5. **نافذة التبديل** لواتساب الإنتاج (الخطوة ٩).
6. **تبديل مفتاح لوحة `/ops`** (`BP_PANEL_KEY`) ومفتاح وسائط المحادثة: كانا
   مكتوبين حرفياً في ثلاثة سيناريوهات على n8n Cloud (§6). التبديل يعني تحديث
   القيمة في Vercel وفي متغيّرات n8n وفي السيناريوهات الثلاثة معاً.

حتى يُتّخذ القرار الأول، **الخطوتان ٠ و٢ تُنفَّذان الآن** لأنهما مفيدتان في كل
الأحوال: أرشيف مصدري لـn8n في المستودع، وعنوان واحد بدل اثني عشر.

---

## الملكية

| ما | الوكيل |
|---|---|
| هذا الملف، `ops/azure/**`، بنية الحاوية والقاعدة والنطاق | `platform-engineer` |
| `n8n/**`، `ops/n8n/**` (ومنه `export/`)، السيناريوهات نفسها | `automation-agents` |
| `api/candidate.js` | `recruitment-candidate` |
| `api/requests.js` · `api/_stage.js` · `api/book.js` | `client-portal` |
| `monitor.page.html` · `admin.page.html` | `owner-ops` |
| صفحة تسكين العمالة في `generate.mjs` | `worker-housing` (الصفحة) داخل ملف `platform-engineer` |
| `/team/*` و`/chat` وبوابة SS | `bp-ai-platform` · `shared-services` |
| واتساب (`BP-WhatsApp-Main` وفروعه) | `whatsapp` |

وكيل يحتاج ملفاً لغيره يقف ويقول (`CLAUDE.md` §2.7).
