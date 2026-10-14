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

## 10) تنفيذ 2026-10-14 (جلسة المتابعة)
- **فحص `cutover.mjs` (قراءة فقط):** Cloud النشطة 53 · Azure 170، لا ناقص ولا عقد ذكاء خارج Azure بين النشطة. التوزيع: schedulers 1 · webhooks 51 · whatsapp 1. لم يُنفَّذ `--apply`.
- **عقد الذكاء المتبقية (كلها في سير غير نشطة على Azure، 8 عقد في 8 سير):** Email Campaign V1 (`6CYU2UO8TilXzBqO`, openAi) · استقبال المرشحين من البريد (`8ki6w3hoym6VK0n2`, anthropic) · BP3 Compliance ×3 (`Ao2FXaIgHUQAFE8e` OpenAI HTTP، `qVNwlYHUDpkY7dhk` و`rDQXYYplqelAQAmY` Anthropic HTTP) · استقبال من Outlook (`e7FmrFfBK0yrmMJz`, openAi) · باهر v2 (`mytupyHHG9EIyzjL`, Anthropic Managed Agents) · Email Marketing Network (`T7XUSox6eNNKLSZm`: توليد صورة + عقدتا openAi فارغتان). **لم تُحوَّل بعد:** لكل سير شكل مخرجات مختلف (`content[0].text` / `choices[0].message.content`) فتحتاج محوّلاً خاصاً بكل واحد، وتوليد الصور لا يغطيه `bp-main` (gpt-4.1). تبقى غير نشطة حتى التحويل.
- **الموقع على staging:** سجل الصور الفعلي `bpwebacr5235` (لا `bpsiteacr` المذكور في `azure-site.yml` — يلزم تصحيحه). بُنيت الصورة `bp-site:c75cf5827a40` وحُدّثت `bp-site-staging` (rg-bp-web) → `Succeeded`. `/healthz` و`/` و`/catalog` و`/cart` و`/my` كلها 200. لم يُمسّ الإنتاج `bp-site` ولا النطاق ولا DNS.

### 10.1) تحويل عقد الذكاء المتبقية — `ops/azure-n8n/convert-ai-remaining.mjs` (2026-10-14)
حُوّلت **6 من 8 سير** إلى Azure OpenAI (`bp-main`) على Azure فقط، وكلها غير نشطة (تجربة جافة ثم `--apply`، ونسخة احتياطية لكل سير قبل الكتابة خارج المستودع):
- `Ao2FXaIgHUQAFE8e` (OpenAI HTTP): الوجهة والاعتماد → Azure فقط (الصيغة نفسها).
- `qVNwlYHUDpkY7dhk` و`rDQXYYplqelAQAmY` (Claude HTTP): الطلب يُحوَّل إلى صيغة الدردشة، ومحلّل «بناء سجل التنبيه» يقرأ `choices` أيضاً.
- `e7FmrFfBK0yrmMJz` (Outlook) و`8ki6w3hoym6VK0n2` (البريد): عقدة HTTP + Set تعيد `content`/`text` كما يقرأه محلّل السيرة.
- `6CYU2UO8TilXzBqO` (Email Campaign): HTTP + Code يعيد `output[0].content[0].text` ككائن لعقدة Gmail.

**لم يُحوَّل عمداً، ويحتاج قرارك:** `mytupyHHG9EIyzjL` (باهر v2 — يفتح جلسة Claude Managed Agents، الطبقة محذوفة بقرار 2026-09-17، فالبديل هو فريق `agents/azure/`)، و`T7XUSox6eNNKLSZm` (Email Marketing Network — توليد صور لا يغطيه `bp-main`، وعقدتا الرسائل فارغتان).
**لم تُنفَّذ أي من السير المحوّلة** (غير نشطة وليس في واجهة n8n العامة تنفيذ يدوي) — يُختبر كلٌّ من واجهة n8n بتنفيذ يدوي قبل التفعيل.

### 10.2) المرحلة الأولى من التحويل (schedulers) — بموافقة المالك الصريحة 2026-10-14
سير واحد: «BP3 — قائد الامتثال (WhatsApp)» (سير فرعي `executeWorkflowTrigger`): Cloud `DHdxNSbhQQb1AWKg` → `active=false`، وAzure `JJmvzvFTDUSxiEx1` → `active=true`. لا تنفيذات له بعد (يُستدعى من سير آخر). الرجوع: `node ops/azure-n8n/cutover.mjs --phase=schedulers --rollback --apply`.

### 10.3) باهر v2 — أُرشف (2026-10-14، بتفويض المالك: «نحذفه أو نؤرشفه إن كان مكرراً»)
الفحص: السير مجرد هيكل — معرّفات `REPLACE_WITH_*` لم تُملأ قط، ويستدعي Claude Managed Agents (مدفوع وخارج Azure، والطبقة محذوفة بقرار 2026-09-17)، ولا مرجع له إلا ملف مصدره `ops/n8n/baher-intake-v2.workflow.js`. والوظيفة مغطاة بسير نشطة: «Virtual Baher Live — Open AI Chat» و«BP Team — Baher (Business Advisor)» و«عميل صفر — باهر (Front Desk)». **أُرشف نسخة Azure `mytupyHHG9EIyzjL` ونسخة Cloud `pP51EK66BKWcU5c7`** (أرشفة قابلة للاسترجاع من واجهة n8n، لا حذف). ملف المصدر في المستودع تُرك كما هو.

### 10.4) تنبيه أمني — فرح على Azure نشطة (`g2Y2k2KbxYwmhSqu`)
وُجدت `active=true` يوم 2026-10-14 بينما كانت «غير منشورة عمداً» (البند 4)، و`Command Space Direct In` و`TEMP Muin GET Health` بلا مصادقة (`authentication: none`). لم أفعل ذلك ولم أُعطّلها بعد؛ بانتظار قرار المالك: إلغاء النشر حتى تُضاف مصادقة Header Auth، أم إبقاؤها.
**قرار المالك 2026-10-14: «عطّل فرح حتى نضيف المصادقة» — نُفّذ.** `g2Y2k2KbxYwmhSqu` على Azure صارت `active=false`، ورابطا `Command Space` و`Health` يردّان 404. تبقى معطّلة حتى تُضاف Header Auth بمفتاح سرّي لعقدة `Command Space Direct In` (وحذف `TEMP Muin GET Health`). نسخة Cloud (`YgRwn40v1CqsscJw`) لم تُمسّ.
**قرار المالك 2026-10-14: «أضف المصادقة لفرح وانشرها» — نُفّذ.** أُنشئ اعتماد `Header Auth — فرح Command Space` (`LdQ9dkKZU09TRa6H`، الترويسة `X-BP-Farah-Key`) بمفتاح عشوائي لم يُطبع ولم يُكتب في أي ملف، وربط بعقدة `Command Space Direct In`. حُذفت `TEMP Muin GET Health` و`Prepare TEMP Health Envelope` (كانت تحقن مغلف واتساب مزيفاً في خط فرح بلا مصادقة). نُشرت `g2Y2k2KbxYwmhSqu` (`active=true`، 88 عقدة). التحقق: بلا ترويسة 403، مفتاح خاطئ 403، رابط الصحة 404. **لم يُجرَّب المسار الناجح** (يشغّل فرح فعلياً).
**المطلوب من المالك قبل تحويل أي مستدعٍ (اللوحة، ai-space، راوتر واتساب) إلى Azure:** افتح الاعتماد في واجهة n8n على Azure واكتب فيه مفتاحاً تعرفه (Credentials ← «Header Auth — فرح Command Space» ← Value) ثم ضعه في ترويسة `X-BP-Farah-Key` عند المستدعين. إلى ذلك الحين الرابط مغلق لكل الناس (آمن افتراضياً)، والمستدعون ما زالوا يوجَّهون إلى Cloud.

### 10.5) Email Marketing Network — اكتمل بناؤه ويبقى **غير نشط** للاختبار (2026-10-14، `ops/azure-n8n/build-email-marketing.mjs`)
أُعيد بناء `T7XUSox6eNNKLSZm` (15 → 17 عقدة) بالإعدادات المقترحة؛ حُذف توليد الصور وBannerbear (مدفوعان خارج Azure).
- **المسار ١** (يدوي + أيام العمل 9 ص بتوقيت الرياض): عملاء `Status=Ready` (٥ كحد أقصى) ← صياغة Azure `bp-main` ← **موافقة المالك بالبريد** (Gmail send-and-wait إلى المالك) ← إرسال للعميل ← `Status=Sent`. لا يخرج بريد بلا موافقة.
- **المسار ٢** (Gmail كل ١٥ دقيقة، وارد الأساسي غير المقروء): تصنيف Azure ← إيجاد العميل بالبريد ← `Status=Replied` أو `Unsubscribed` + فقرة ملخص في صفحته.
- **افتراضات تُتحقَّق عند الاختبار** (لم أستطع قراءة قاعدة «Riyadh Chamber Data - Leads» من موصّل Notion المتاح): عمود `Status` من نوع select بالقيم Ready/Sent/Replied/Unsubscribed، وعمود `Email` من نوع email. إن اختلفت الأسماء تُعدَّل الثوابت أعلى السكربت ويُعاد تشغيله.
- **الاختبار:** من واجهة n8n بتنفيذ يدوي من «تشغيل يدوي» مع عميل تجريبي `Ready` بريده بريدك؛ لا يُفعَّل قبل اجتياز الاختبار.

### 10.6) Email Marketing Network — رُبط بالقاعدة الفعلية (2026-10-14)
القاعدة: **«BP — Companies Sales DB (قاعدة الشركات)»** (`26faca27-6188-4b6a-b584-924c374f2d22`) — تُلغي افتراضات 10.5 عن أعمدة `Status`. المرشّح: `Email` غير فارغ و`Campaign Sent`/`Suppressed`/`Duplicate` غير مؤشّرة (٥ كحد أقصى). بعد الإرسال: `Campaign Sent` ✓ و`Last Campaign Status=Sent` و`Campaign Date`. الردود: `Stage=In progress`، وطلب إلغاء المراسلة → `Suppressed` ✓ و`Suppress Reason=Unsubscribed`. 19 عقدة، غير نشط. **تنبيه اختبار:** القاعدة بيانات عملاء حقيقيين — لا تنفّذ قبل أن تؤشّر `Campaign Sent` على كل الصفوف عدا صف تجريبي بريدك، وإلا ظهرت مسودات لعملاء حقيقيين في بريد الموافقة (لا يُرسل لهم شيء بلا موافقتك).

### 10.7) قالب HTML بشعار Business Partner (2026-10-14)
البريد الصادر لعملاء Email Marketing Network صار HTML من اليمين لليسار (`ops/azure-n8n/email-template.mjs`): شريط كحلي `#0B1B5A`، الشعار من `https://www.businesspartner.sa/assets/img/logo.png`، عنوان ونص وزر «تعرّف على خدماتنا» وتذييل فيه سطر إيقاف المراسلة بالرد. الدالة نفسها تُحقن في عقدة «تجهيز الرسالة» داخل السير وتُستعمل محلياً لتوليد المعاينة (`node ops/azure-n8n/email-template.mjs > preview.html`). بريد موافقة المالك نص عادي مع ملاحظة أن الرسالة ستصل بقالب HTML. اختُبر الكود المحقون بمحاكاة (يخرج `html` بالشعار) وصُوّرت المعاينة؛ لم يُنفَّذ السير فعلياً. السير غير نشط.

### 10.8) اختبار حيّ جزئي لـ Email Marketing Network (2026-10-14)
نُفّذ بسير مؤقت (ويبهوك بمسار عشوائي، حُذف بعد الاختبار): **جلب العملاء من القاعدة الفعلية بالمرشّحات ← صياغة Azure `bp-main` ← تجهيز الرسالة وHTML — نجح** (موضوع ونص عربي سليمان للمنشأة، `html` مولَّد). **لم يُختبر:** إرسال بريد الموافقة، إرسال العميل، تحديث Notion، ومسار الردود (تحتاج Gmail وتكتب في القاعدة). أُضيف لتعليمات الصياغة افتتاح «السادة / المنشأة المحترمين» وخاتمة «مع خالص التحية، فريق Business Partner». السير غير نشط.
