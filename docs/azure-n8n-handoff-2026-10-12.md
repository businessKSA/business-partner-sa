# مذكرة تسليم — نقل n8n إلى Azure وفرح بذاكرة دائمة (2026-10-12)

> اقرأها قبل أي عمل على n8n Azure. لا أسرار فيها، ولا يُكتب فيها سرّ أبداً. الحالة مفحوصة من المصدر في التاريخ أعلاه.

## 1) القرار والاتجاه
المالك: كل شيء يعمل على Azure (n8n والوكلاء والموقع لاحقاً)، بلا GitHub/Vercel في المسار التشغيلي. اختار «n8n على Azure + نقل الثقيل لكود».
فرح تكون **العقل الواحد** للشركة، على n8n Azure، **بلا OpenClaw**، وبصلاحيات واسعة (بريد، تقويم، Drive/Docs/Sheets/Slides، تفويض الفريق) مع ضوابط ضيقة (انظر §6).

## 2) البنية (Azure، مجموعة `bp-ai`)
| المورد | ملاحظة |
|---|---|
| `bp-n8n` (Container Apps، السويد) | `https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io` — نسخة واحدة min=max=1 |
| `bp-n8n-pg` (PostgreSQL 16) | قاعدة `n8n` (مستخدم `n8nadmin`) + مخطط `farah` (مستخدم `farah_app`) |
| `bp-ai-ksa-2026` | Azure OpenAI، النشر `bp-main` |
| `drbahermagnas-6763-resource` (eastus2) | AIServices — منه الصوت (Speech TTS) |
| `bp-ai-claude-eu` | AIServices (السويد) — **لم يُقرَّر** شأنه؛ لا تلمسه |
| `rg-farah/farah` (الإمارات) | وكيل OpenClaw كودي **خارج مسار n8n**. يُصفَّر (`--min-replicas 0`) بعد نجاح الاختبار، **لا يُحذف** |
| `rg-bp-web/bp-site`, `bp-site-staging` | صورة `quickstart` فارغة — موقع لم يُنقل بعد |
| `bp-wa-rg/bp-wa-bridge` | جسر واتساب ويب (غير رسمي، خطر حظر) من محادثة أخرى — **راجِعه مع المالك** |

## 3) ما تمّ على n8n Azure (الحالة: 169 سيراً، كلها غير مفعّلة ما عدا معالج الأخطاء)
- استيراد السير وجداول البيانات (11) من Cloud. اعتمادات أُنشئت يدوياً بأسماء مطابقة تماماً (Google ×6، GitHub، LinkedIn، Notion API وMCP، واتساب ×4 + الاستقبال `WhatsApp OAuth business partner` و`WhatsApp — Muin — 0530540231`، Azure OpenAI، Azure Speech، Daftra، Farah Memory).
- `fix.mjs` (مطبَّق): 40 عقدة نموذج لغوي (OpenAI/Anthropic/Groq/Gemini) → `Azure OpenAI (bp-main)`، وتوحيد اسم واتساب `0507034157` إلى `WhatsApp account`.
- `fix2.mjs` (مطبَّق): 18 عقدة Notion كانت Header Auth مكسوراً → اعتماد `Notion — Business Partner OS — Production`، وتوحيد أسماء LinkedIn/Calendar/Outlook.
- **سجل الوكلاء** `BP_Agent_Registry.workflow_id` كان يحمل معرّفات Cloud: أُعيدت كتابة 21 معرّفاً إلى معرّفات Azure بالاسم (`ops/azure-n8n/registry-ids.mjs`). **كرّره بعد أي إعادة نسخ لجداول Cloud**. لا مراجع مكتوبة بعنوان Cloud داخل العقد (فُحص).
- **ذاكرة فرح** (`ops/azure-n8n/farah-memory.sql` + `farah-memory.mjs`): جداول `messages` و`pending` و`memories` و`daily_summaries`، وتسجيل كل رسالة، وسياق الرد بالاقتباس، وترقيم التحديثات الاستباقية ①②، وثمانية أدوات ذاكرة، وقاعدة «اقرئي قبل أن تسألي». **اختُبرت** بتنفيذ يدوي (Command Space): نادت `Open Pending` وأجابت بصدق.
- **توسعة الأدوات** (`ops/azure-n8n/farah-tools.mjs`، مطبَّقة): `Send Email (Safe)` (سير فرعي `LaPfNkA4fug0x73i` فيه حارس كود)، وتقويم (List/Update/Delete)، وDrive (Search/Create Folder/Move/Trash/Read Text)، وSheets (Create/Read/Write/Append)، وDocs (Create/Edit)، وSlides (Create/Read/Edit). **الاعتمادات ارتبطت كلها بالاسم**. لم تُجرَّب تشغيلياً بعد.

## 4) معرّفات مهمة (Azure)
فرح `g2Y2k2KbxYwmhSqu` · `BP-WhatsApp-Main (Orchestrator)` `FIHrYSg706SpvNzr` · التحديثات الاستباقية `r7NpBHRM6r9jIrVC` · الإرسال الآمن `LaPfNkA4fug0x73i`.
معرّفات Cloud مختلفة (فرح `YgRwn40v1CqsscJw`، الموجّه `tIb4wNOSYVTZQuox`). الربط بالاسم، لا بالمعرّف.

## 5) كيف يعمل واتساب (من التنفيذات الفعلية، لا من الافتراض)
- تطبيقات Meta الخمسة كلها «In development». **رقم الشركة `0507034157`** (Phone ID `1216029938250852`) و**الرقم التجريبي `+1 555 656 1837`** (Phone ID `1112996661901731`، الذي يراسل منه باهر فرح) يمران بتطبيق **Business partner** (`1006610415315995`) ← Callback → عقدة `Receive message` في `BP-WhatsApp-Main` ← عقدة «Route to Muin Assistant؟» ← **تستدعي سير فرح كسير فرعي** (`Run: Muin Assistant`). لذا تنفيذات فرح بنمط `integrated`.
- تطبيق **Muin Personal Assistant** Callback له يشير لعقدة قديمة في سير فرح على Cloud (لا تُستعمل عملياً). تطبيق **Farah Assistant** Callback له يشير إلى حاوية `farah` (OpenClaw). **«Mahmol Makfol»** بلا منتج واتساب ولا Callback — يُركَن.
- **قيد واتساب:** الرسالة الحرة لا تُسلَّم بعد 24 ساعة من آخر ردّ من باهر (الخطأ `131047`). الحل المخطّط: قالب Meta معتمد للتحديثات الاستباقية أو رسالة صباحية يردّ عليها.
- **التحويل:** لكل تطبيق Callback واحد؛ تفعيل سير فيه `WhatsApp Trigger` يسجّل عنوانه الجديد لدى Meta. يُنفَّذ تطبيقاً بتطبيق: عطّل سير Cloud ثم فعّل سير Azure، والرجوع بالعكس. **لا تفعّل مشغّل واتساب على Azure قبل فحص `farah` (الحاوية) ورقم المرسل.**

## 6) الضوابط (قرار المالك)
- بريد: يمر بـ`Send Email (Safe)`؛ يُمنع تلقائياً: سعر/خصم/ضمان/التزام حكومي/أكثر من 5 مستلمين → `sent=false` ثم `Create Pending` وموافقة باهر الصريحة. (الحارس مُختبَر محلياً بتسع حالات.)
- Drive: الحذف إلى السلة فقط، لا حذف نهائي.
- تعديل الموقع: طلب دمج بانتظار موافقة المالك، لا نشر حيّ بلا موافقته. (أداة GitHub لم تُبنَ بعد: n8n لا يملك عملية إنشاء PR، فتُبنى كسير فرعي: فرع + ملف + PR بلا صلاحية دمج.)
- الأسعار من الكتالوج فقط. لا أسرار في المحادثة أو الملفات.

## 7) المتبقي (بالترتيب)
1. **أسرار الجلسة الدائمة:** `N8N_AZURE_API_KEY` (90 يوماً) ومتغيرات Azure SP (`AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET/SUBSCRIPTION_ID`) في إعدادات بيئة الجلسة. **احذف المفتاح الذي لُصق في محادثة 2026-10-12** (بلا انتهاء).
2. اختبار تشغيلي للأدوات الجديدة (يحتاج تفعيل سير فرح على Azure مع تعطيل `Baher WhatsApp In`، وهذا قرار نشر يوافق عليه المالك).
3. **Outlook:** التطبيق مسجّل في Entra (`n8n Outlook BP`، صلاحيات Mail.ReadWrite/Mail.Send/offline_access/User.Read ممنوحة). بقي: إنشاء السر وإدخاله في اعتماد `Outlook — Business Partner — Production` وتسجيل الدخول — **بيد المالك**.
4. **عقد الذكاء الاصطناعي غير المحوّلة** (نحو 15 عقدة: `openAi`/`anthropic` من غير نوع المحادثة وHTTP لـ`api.openai.com`/`api.anthropic.com`): `BP-Chat-Suggest`، `BP3 Compliance Agent V1`، بوابة استقبال المرشحين، وكيل Outlook CVs، استخراج المستندات B. تُعاد كتابتها سيراً بسير إلى `Azure OpenAI`.
5. تصفية ضجيج البريد في التحديثات الاستباقية (يحتاج رداً / للعلم / تجاهل) والملخص الليلي لـ`farah.daily_summaries`.
6. أداة GitHub (PR)، وربط Instagram/LinkedIn (توكنات: LinkedIn جاهز، 60 يوماً)، ومراجعة `bp-wa-bridge`.
7. **حزمة التحويل:** إعادة نسخ الجداول ثم `registry-ids.mjs` ← تعطيل سير Cloud النشطة (91) ← تفعيل Azure وتسجيل Callback كل تطبيق ← فحص حيّ ← تصفير `farah` ← حذف مفاتيح API المؤقتة (Azure وCloud). خطة الرجوع: إعادة تفعيل Cloud وتعطيل Azure (دقائق).
8. تحديث `CLAUDE.md` (الاتجاه Azure-only، وPR #315/#350 مدموجان) و`docs/agents-registry.md`.

## 8) تنبيهات تشغيلية تعلّمناها
- في Cloud Shell: كل أمر `read -s` **بلصقة وحده**، وإلا ابتلع السطور اللاحقة. ولا تُصوَّر شاشة فيها سر.
- مفتاح n8n على Azure غير مفتاح Cloud، وشكلهما واحد. تحقّق بـ`curl …/api/v1/workflows?limit=1` (200).
- حفظ السير عبر الـAPI (PUT) قد يمسح البيانات المثبّتة (pinData): أعد تثبيتها قبل الاختبار.

## 9) فحص ما قبل التحويل (2026-10-13) — `ops/azure-n8n/cutover.mjs`
نتيجة الفحص (قراءة فقط): 91 سيراً نشطاً في Cloud، كلها موجودة في Azure بالاسم. **موانع قبل أي تعطيل في Cloud:**
1. **[حُسم 2026-10-13] ويبهوك Azure سليم**: ردّ 403 من بيئة جلسة Claude فقط (مسار الخروج)، أما من متصفح المالك فيردّ 200 (`{"reply":"جاهز"}`). متغيرات حاوية `bp-n8n` بلا أي متغير مصادقة. **تنبيه أمني:** رابط Command Space المنشور بلا مصادقة وفرح لها صلاحيات واسعة؛ يُلغى نشره (Unpublish) بعد الاختبار، ويُنشر لاحقاً بمصادقة Header Auth. (كان:  ويبهوك Azure يردّ 403 («Authorization data is wrong!») على الطلبات الفعلية رغم أن العقدة بلا مصادقة (OPTIONS يردّ 204). 48 سيراً من النشطة ويبهوك، فلا تحويل قبل معرفة السبب (يُفحص من بيئة حاوية `bp-n8n` ومن إعداد n8n).
2. أربعة سير فيها عقد ذكاء خارج Azure: BP-Chat-Suggest، وكيل Outlook CVs، التحقق من إيصالات الدفع، بوابة استقبال المرشحين.
3. مستدعو الويبهوك (الموقع و`api/` وn8n نفسه) يشيرون لعنوان Cloud عبر `BP_N8N_BASE` وما شابهه؛ يُحوَّل قبل مرحلة webhooks.
4. مشغّلات خارجية: gmailTrigger ×2 وwhatsAppTrigger ×2 (BP-WhatsApp-Main وMahfol — الأخير يُركَن) وnotionTrigger ×1، وتحتاج اعتماداتها حيّة في Azure.
الاختبار التشغيلي لفرح على Azure نجح يدوياً (قراءة تقويم وDrive وحارس البريد وتسجيل الرسائل). ترتيب المراحل في رأس `cutover.mjs`: schedulers ← webhooks ← whatsapp، ولكل مرحلة `--rollback`.

## 10) الجلسة الثانية 2026-10-13 — ما وُجد قبل التنفيذ، وما بقي بأمر واحد

> فُحص من المصدر (الواجهتان العامتان لـCloud وAzure) بالقراءة فقط. هذه الجلسة **لم تكتب شيئاً على n8n**: صلاحيتها ترفض أي كتابة على n8n Azure (تصنيف «مورد مشترك»)، فحُوِّل كل ما يحتاج كتابةً إلى سكربتات جاهزة أدناه يشغّلها المالك أو جلسةٌ بصلاحية الكتابة. الأرقام: **88** سيراً نشطاً في Cloud (كانت 91)، **170** على Azure، كلها موجودة بالاسم.

### ما كشفه الفحص (ولم تعرفه المذكرة)
1. **37 سيراً على Azure تحمل اعتمادات بمعرّف Cloud نفسه** — أثقلها عقدة `Azure OpenAI (bp-main)` في **16 مديراً** (`hA1ULr5qtFuoBZ6B` وهو معرّف Cloud؛ معرّف Azure للاعتماد نفسه `fI2SkJuYmB2v3zCo`)، ثم Gmail وواتساب والتقويم وDrive وOutlook وGitHub وSpeech ومشغّل واتساب في `BP-WhatsApp-Main`. السبب: الاستيراد سبق إنشاء الاعتمادات، وn8n يربط بالاسم **عند الحفظ** فقط (`replaceInvalidCredentials`)، فما لم يُعَد حفظه بقي بمعرّف ميت. لو فُعِّلت هذه السير لفشلت أول تنفيذ. العلاج: `ops/azure-n8n/cred-rebind.mjs --apply` (إعادة حفظ بلا تعديل + تقرير). ما يبقى بعده بلا اعتماد يُنشأ على Azure **بالنوع والاسم تماماً** كما يطبعه التقرير، ثم يُعاد التشغيل حتى يصفر. و`cutover.mjs` صار **يغلق البوابة** على هذا الشرط.
2. **أسماء مكرّرة على Azure** لثلاثة سير نشطة (طارق العقارات ×2، محلل ملفات العملاء ×2، Candidate ↔ Job Matcher ×2) وثلاثة غير نشطة. كان السكربت يختار بالاسم فقط؛ صار يختار التوأم الذي **تطابق عقدُه عقدَ Cloud** ثم الأحدث، ويطبع اختياره. النسخ الزائدة تُحذف يدوياً بعد التحويل (`8NN8ceUbJZL8bLft`، `hAAKGoZt0vg3TEtg`، `Dp2NQQ0TKbV8i4e8`).
3. **سيران مختلطان** (ويبهوك + مشغّل استطلاعي): `BP — WhatsApp Web Reader → Notion` (مؤقّت) و`Recruitment Agent — Job Posting & Screening` (Gmail). لا يصلح تشغيلهما على الطرفين، فيُنقلان حصرياً مع `--retire-cloud`.
4. **الجداول متأخرة يوماً**: `BP_AI_Tasks` +14 صفاً و45 تحديثاً، `BP_AI_Performance` +11، `BP_News_Feed` 24 تحديثاً، `BP_Agent_Registry` 5 تحديثات (بلا لمس `workflow_id`). و`BP_WA_Style` (من قارئ واتساب ويب، #351) **غير موجود على Azure** — يُنشأ بالأعمدة نفسها قبل تفعيل ذاك السير. العلاج: `tables-sync.mjs --apply` ثم `registry-ids.mjs --apply`.
5. **سير «استخراج المستندات B» محوَّل فعلاً** إلى Azure (العقدة تنادي `bp-main` باعتماد Azure)، وما فيها من مراجع OpenAI/Header Auth بقايا غير مستعملة. لا عقدة ذكاء خارج Azure في أي سير نشط.
6. على Azure: لا تنفيذ لغير فرح، ولا تنفيذ بخطأ. على Cloud آخر الأخطاء متفرقة في `Virtual Baher Task` (10-09 إلى 10-12).

### مستدعو الويبهوك من الموقع — صار لهم مفتاح واحد
- `api/_n8n.js`: كل نداء n8n في `api/` (`book` · `requests` · `_stage` · `candidate` · `_chat`) يمرّ بـ`n8nHook()`، والعنوان من `BP_N8N_BASE` وافتراضه Cloud.
- `site/scripts/n8n-base.mjs` (خطوة بناء قبل حارس الصفحات): إن ضُبط `BP_N8N_PUBLIC_BASE` بُدِّل عنوان Cloud في كل صفحات `site/` المولَّدة والثابتة (dashboard · portal · monitor · admin · الخدمات المشتركة…). بلا المتغيّر لا تفعل شيئاً. فالتحويل ضبطُ متغيّرين في Vercel ونشرة، والرجوع حذفُهما ونشرة.

### ترتيب التنفيذ (كلها بالمفتاحين `N8N_AZURE_API_KEY` و`N8N_CLOUD_API_KEY` في البيئة)
```
node ops/azure-n8n/cred-rebind.mjs --apply      # كرّره بعد إنشاء ما يطبعه ناقصاً حتى يصفر
node ops/azure-n8n/tables-sync.mjs --apply
node ops/azure-n8n/registry-ids.mjs --apply
node ops/azure-n8n/cutover.mjs                  # يجب أن ينتهي بـ exit 0
node ops/azure-n8n/cutover.mjs --phase=schedulers --apply
#   راقب 15 دقيقة: الموزّع QWFV22wp5WDi0vM3 ينفّذ كل خمس دقائق، و GET /api/v1/executions?status=error على Azure يبقى فارغاً
node ops/azure-n8n/cutover.mjs --phase=webhooks --keep-cloud --apply
#   ثم في Vercel (Production): BP_N8N_BASE و BP_N8N_PUBLIC_BASE = https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io
#   نشرة بالعلامة (قرار المالك) → اختبار نموذج من الموقع يصل Azure
node ops/azure-n8n/cutover.mjs --phase=webhooks --retire-cloud --apply
#   whatsapp: §5 — بعد فحص farah ورقم المرسل وقرار المالك
#   ثم: تصفير farah، حذف مفاتيح API المؤقتة، حذف النسخ المكرّرة أعلاه
```
الرجوع لأي مرحلة: `--phase=X --rollback --apply` (يفعّل Cloud ويعطّل Azure)، وللموقع حذف المتغيّرين ونشرة.

## 11) نُفِّذت المجدولات وواتساب الرئيسي — 2026-10-13 (مساءً UTC)

> نُفِّذ بجلسة بصلاحية الكتابة وبموافقة المالك مرحلةً مرحلة. الأرقام من الواجهة العامة لـAzure بالقراءة بعد التنفيذ.

**ما تمّ**
- **الاعتمادات الخمسة** أنشأها المالك على Azure بالاسم والنوع تماماً (Gemini · Vercel Header Auth · Gmail · Outlook · GitHub)، ثم `cred-rebind.mjs --apply` ربط السير الخمسة. `cutover.mjs` خرج بصفر.
- **المجدولات: 34 من 34 على Azure.** 33 بالدفعة الأولى، والـ34 (`BP - Sync Visa Tracker to Companies Employees`، `OHkxRibLXkRt8xOr`) فشل تفعيله لأن عقدة `Visa Tracker Updated` كانت `authentication: oAuth2` بلا اعتماد OAuth؛ حُوِّلت إلى `apiKey` بالاعتماد `Notion — Business Partner OS — Production` ثم نُقل. المراقبة: الموزّع `QWFV22wp5WDi0vM3` نفّذ كل خمس دقائق من 20:35 إلى 22:25 بلا فجوة. نسخ احتياطية للسير في `.azure-n8n-backups/` (خارج git).
- **واتساب الرئيسي (`BP-WhatsApp-Main`) على Azure منذ 20:46**، وCallback تطبيق Meta «Business partner» (1006610415315995) صار `…/webhook/4f86756f-28ad-4c52-928c-672360b512a2/webhook` على Azure (الرابط القديم على Cloud للتراجع). تنفيذات ناجحة 22:10–22:11. الرجوع: `--phase=whatsapp --rollback --apply` ثم إعادة الـCallback القديم.
- **فرح عادت إلى Cloud**: مشغّلها `Baher WhatsApp In` معطّل عمداً على Azure (§5)، فنقلها يقطع استقبالها. **لكن واتساب الرئيسي ينادي فرح على Azure كسير فرعي (`Run: Muin Assistant` ← `g2Y2k2KbxYwmhSqu`)، فنسخة Azure يجب أن تبقى نشطة بمشغّلها المعطّل.** وفرح على Cloud تحتاج سيرها الفرعي `BP3 — قائد الامتثال (WhatsApp)` (`DHdxNSbhQQb1AWKg`) نشطاً على Cloud.
- **تطبيق Muin (الرقم 0530540231) ما زال على Cloud** — لا يُغيَّر رابطه قبل قرار فرح.

**درس نوشن (مهم):** 189 عقدة نوشن على Azure صارت `apiKey` + `notionApi` بينما كانت على Cloud `oAuth2`. المفتاح لا يرى إلا ما شُورك مع تكامل «Business Partner»، فظهرت أخطاء «Could not find database … shared with your integration» (`RE — Matching Engine`، `BP Publisher`، `ترقيع ATS`). شارك المالك الصفحات العليا مع التكامل؛ وبعدها نجح `BP Publisher`. **لم يُتحقَّق بعد** من `RE — Matching Engine` (كل 20 دقيقة) و`ترقيع ATS` (كل ساعة): لا تنفيذ لهما بعد 21:00 UTC.

**المتبقي**
1. `RE — Matching Engine` و`ترقيع ATS`: لا تنفيذ ظاهراً بعد 21:00 UTC ولا خطأ جديد. **أرجح تفسير (استنتاج لا إثبات):** Azure لا تحفظ التنفيذات الناجحة افتراضياً — كل السير التسعة التي ظهر لها نجاح في السجل لها `saveDataSuccessExecution: all` صريح، و25 من 39 سيراً نشطاً بلا إعداد صريح وبلا أي نجاح ظاهر. أي أن الأخطاء وحدها تظهر في `executions` للسير الافتراضية، فغياب الخطأ هو دليل النجاح؛ ولو أردت مراقبة النجاح فاضبط `EXECUTIONS_DATA_SAVE_ON_SUCCESS=all` على حاوية n8n (يزيد التخزين).
2. `BP — وكيل Outlook CVs → ATS` فشل: «The mailbox is either inactive, soft-deleted, or is hosted on-premise» — الحساب المربوط في الاعتماد `Outlook — Business Partner — Production` بلا صندوق بريد Exchange Online فعّال؛ يُراجَع الحساب المستعمل.
3. مرحلة الويبهوكات (49) والسيران المختلطان — قرار المالك (§10).
4. حذف النسخ المكرّرة (`8NN8ceUbJZL8bLft` · `hAAKGoZt0vg3TEtg` · `Dp2NQQ0TKbV8i4e8`) بعد التحويل، وجدول `BP_WA_Style`، وتأكيد مزامنة الجداول (`tables-sync.mjs` / `registry-ids.mjs` لم يُتحقَّق من تشغيلهما هنا).
5. اعتماد `Outlook — Personal — Baher` (Hotmail) أُنشئ ومتصل ولا يستعمله أي سير بعد.

## 12) سياسة النماذج — أرخص نشرة تكفي، وفرح وحدها قوية (قرار المالك 2026-10-14)

- نشرات `bp-ai-ksa-2026` (Sweden Central): `bp-fast` = gpt-4.1-mini (الأرخص المستعمل) · `bp-main` = gpt-4.1 · `bp-ultra` = gpt-5.1 · `bp-embed` = text-embedding-3-small (جاهز لذاكرة فرح) · وغيرها. أرخص منها متاح للنشر ولم يُنشر: `gpt-4.1-nano` و`gpt-5-nano`.
- **حُوِّل كل الوكلاء (62 سيراً · 87 عقدة) من `bp-main` إلى `bp-fast`** بـ`ops/azure-n8n/switch-model.mjs` (تجربة جافة افتراضياً، نسخة احتياطية لكل سير، تراجع بعكس المعاملين). فرح (3 سير) باقية على `bp-main`. التجربة الحيّة لـ`bp-fast` ردّت `gpt-4.1-mini`.
- مُستثنى مؤقتاً: «سحب كل سير Hotmail (Backfill)» (`Ws1zQQ6YezxAOMSN`) لأن مؤشره في `staticData` وحفظه قد يصفّره؛ يُحوَّل بعد انتهاء التجربة.
- **Document Intelligence متاح** على موارد AIServices الثلاثة (`prebuilt-read` يردّ 200، API `2024-11-30`) — لا حاجة لمورد جديد. أحدها: `bp-ai-claude-eu` (Sweden Central).
- تحذير: `bp-ultra` (gpt-5.1) نموذج استدلال قد يرفض `temperature` و`max_tokens` في عقدة n8n؛ يُجرَّب مباشرة قبل أن تُحوَّل فرح إليه.
