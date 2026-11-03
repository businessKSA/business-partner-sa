# تقرير MCP والأدوات — 2026-11-02 (جلسة المراقب)

> مصدر كل رقم: فحص مباشر في هذه الجلسة (قائمة الأدوات، `n8n` عبر MCP، المستودع).
> ما لم أستطع فحصه مكتوب صراحةً تحت «غير مُتحقَّق» ولا يُخمَّن.

## 1) Claude Code (هذه الجلسة)

### أ) الخوادم التي تعمل فعلاً ومرتبطة بعمل الشركة
| الخادم | ماذا يفعل | ملاحظة استهلاك |
|---|---|---|
| `n8n` | بناء/تشغيل السيران، الاعتمادات، الوكلاء | الأهم تشغيلياً — يُترك |
| `github` | PR والملفات والـActions (نطاق المستودع فقط) | يُترك |
| `Vercel` | نشرات، لوجات، دومينات (200+ أداة) | أثقل خادم في قائمة الأدوات؛ يُستعمل للفحص فقط |
| `Supabase` | قاعدة الموقع، SQL، لوجات | يُترك |
| `Notion` | CRM/Tasks/معرفة المستشار | يُترك |
| `Microsoft_Learn` | وثائق Azure الرسمية | خفيف ومفيد لقاعدة Azure أولاً |
| `claude-code-remote` | إدارة الجلسات والمهام المجدولة | أداة المراقبة نفسها |
| `claude-artifacts` | نشر التقارير | يُترك |

### ب) موصولة وتعمل لكن لا علاقة لها بالشركة (تستهلك سياقاً في كل جلسة)
Adobe، Figma، Miro، Shopify، Make، HubSpot، Docusign، ElevenLabs، Expedia، Kiwi،
Indeed، Apify، Slack، Zoom، Gmail/Calendar/Drive/Docs/Sheets/Slides، Microsoft_365،
Anthropic_Economic_Index، وإضافات (بيولوجيا، QuickBooks، Qt، Twilio docs، GitKraken، pdf-viewer…).

- **كل خادم موصول يضيف أسماء أدواته إلى قائمة السياق** في كل جلسة، فالمئات منها = توكنات تُدفع
  قبل أن يُكتب أول حرف. هذا أكبر مصدر هدر قابل للإزالة هنا.
- **التوصية:** عطّل من `/plugin` و`/mcp` كل ما ليس في الجدول (أ). المرشحون الأوائل: حزمة
  `claude-for-financial-advisors`، `bio-research`، `small-business`، `zoom-plugin`، `cockroachdb`،
  `datadog`، `unity`، `qt-development-skills`. لم أعطّل شيئاً — القرار لك.

### ج) خوادم معطوبة (لا تعمل الآن)
- **تحتاج مصادقة OAuth منك** (من إعدادات موصلات claude.ai): Apollo_io، Canva، Airtable، Adobe (الإضافة)،
  Amazon SP، Atlan، Salesforce، Dropbox، Morningstar، وغيرها (~100).
- **فاشلة بسبب خادم المصادقة** (لا تدعم التسجيل الديناميكي): Slack/Box/Schwab ضمن حزمة المستشارين،
  HubSpot-sales، Asana، PagerDuty، BigQuery، Docusign/Xero ضمن small-business.
- **إعداد خاطئ:** ActiveCampaign (رابط غير مضبوط)، Datadog (`not-setup`)، CockroachDB (UUID/ENOENT/ECONNREFUSED)،
  Zocks وDefinite (نقطة غير موجودة)، Zoom (توكن مرفوض 401 ×3).
- هذه تُحذف ولا تُصلَح — لا شيء منها يخدم الشركة.

## 2) n8n (فحص حي)

- **143 سير عمل** الآن (CLAUDE.md يقول 101 — الرقم قديم، حدّثه).
- **35 اعتماداً**. أهم الأنواع: Gmail ×4، WhatsApp ×6، Notion ×3 (+ Notion MCP OAuth2)، LinkedIn ×2،
  Header Auth ×5 (منها `account 2` المكسور)، Google Drive/Calendar، Daftra، Vercel، GitHub، Outlook،
  Azure OpenAI، Azure Speech، Azure DevOps، ElevenLabs، Gemini.
- **🚩 مخالفة قاعدة «Azure أولاً / لا مدفوع خارج Azure»:** اعتمادات `OpenAI account` و`Anthropic account`
  و`OpenRouter account` ما زالت موجودة. وجودها ليس استعمالاً، لكن يجب التأكد أن لا سير نشطاً يستعملها
  (العقد الثلاث المفصولة في `kaBWVC2iDRhgtCQZ` مثال). **إجراء:** ابحث `get_node_usage` لكل واحد ثم احذف غير المستعمل.
- **أعطال حيّة:** `🌐 إشعار عميل الموقع — واتساب لباهر` فشل 3/3 (آخر تنفيذ 197360)،
  و`BP — Website ATS Intake → AI Screening` فشل 1/8 (195378).
- **مصدر استهلاك مشبوه:** `BP-Chat-Monitor-API` نفّذ **5891 مرة** — أعلى سير تشغيلاً. إن كان يُستدعى
  بالاستطلاع (polling) فهو يأكل حصة التنفيذ؛ راجع تردده.
- سيران جديدة غير منشورة: جسر `BP Bridge — Claude session → Drive` (منشور وفعّال)، و`WA Room Relay/Sender`
  (مسودات فقط، غير مفعّلة — صحيح كاحتياط).
- الأدوات المتاحة عبر n8n MCP: بحث/إنشاء/تحديث/نشر السيران، تنفيذ واختبار، الاعتمادات، جداول البيانات،
  الوكلاء (`create_agent`/`call_agent`)، التنفيذات والسجل.

## 3) Azure
- **لا يوجد خادم MCP لـAzure موصول** في هذه الجلسة؛ الموجود وثائق Microsoft Learn فقط.
- البنية الفعلية في المستودع (`agents/azure/`): `engine.mjs` (Azure OpenAI، نشر `bp-main`)، `team.mjs`،
  `tools.mjs` (حوكمة `commitmentIn()`)، `job.mjs`/`run.mjs` (Container Apps Jobs)، `Dockerfile`، `deploy.sh`.
- موارد: `bp-ai-ksa-2026` (Sweden Central) هو المعتمد؛ `drbahermagnas-6763-resource` فارغ.
- **غير مُتحقَّق:** حالة Budget Alert ورصيد الـ100 ألف دولار — لا أداة هنا تقرأ Azure Cost Management.
  تحتاج إما MCP/CLI لـAzure أو لقطة من البوابة.

## 4) OpenClaw
- **غير مُتحقَّق:** لا أثر له في المستودع ولا في n8n ولا في خوادم هذه الجلسة (بحثت نصياً).
  إن كان مثبتاً على جهاز أو خادم عندك فأعطني الموقع أو ملف إعداده (`openclaw.json` أو ما يعادله) وأفحصه.
- ملاحظة: إحدى إضافات هذه الجلسة (browser-use) تحمل وسم توافق `openclaw` في وصفها فقط — ليس تثبيتاً.

## 5) ChatGPT
- **غير مُتحقَّق:** لا شيء في المستودع (لا Custom GPT ولا Connector ولا أكشن). لا أستطيع رؤية حسابك على ChatGPT من هنا.
- المطلوب منك لإكمال القسم: قائمة الـConnectors/MCP المفعّلة في إعدادات ChatGPT وأي Custom GPT يستدعي
  `businesspartner.sa`. أي ربط من ChatGPT = أداة مدفوعة خارج Azure → يحتاج قرارك الصريح حسب القاعدة 2.6.

## 6) Business Partner AI (داخلي)
- **الوكلاء الفرعيون:** 62 ملفاً في `.claude/agents/` (37 مشروعاً + مدراء الشركة: عبدالرحمن، بدر، مازن…).
- **المدراء الـ12 على n8n:** يستيقظون من الموزّع `LZ5BqoVTwlYv3LOI` كل 5 دقائق — نقطة فشل واحدة.
- **منصة Notion:** CRM/Tasks/بريد؛ المتابعة `k5vtioWWKC2i1W0n` كل 10 دقائق.
- **نقاط التماس مع MCP:** n8n MCP (بناء السيران)، Notion MCP (تحديث `api/knowledge.json`)، والجسر
  `BP Bridge` (Claude → Drive). لا يوجد خادم MCP يخصّ الموقع نفسه.

## 7) خطة خفض الاستهلاك (مرتبة بالأثر)
1. **عطّل ~150 خادماً غير مستعمل** من `/plugin` — أكبر وفر في سياق كل جلسة.
2. **جلسات متوازية:** سقف Vercel (100 نشرة/يوم) ضُرب بـ19 فرعاً. اجعل الجلسات الجانبية بلا دفع إلا عند الحاجة.
3. **n8n:** راجع تردد `BP-Chat-Monitor-API` (5891 تنفيذاً) وأصلح السيرين الفاشلين قبل أن يعيدا المحاولة.
4. **احذف اعتمادات OpenAI/Anthropic/OpenRouter** بعد التأكد أنها غير مستعملة.
5. **الوكلاء الفرعيون:** وجّه كل مهمة لوكيل نطاقها فقط (يقلّل قراءة الملفات الزائدة).
6. فعّل **Budget Alert** في Azure إن لم يكن مفعّلاً.

## 8) ما أحتاجه منك لإكمال التقرير
- موقع/إعداد OpenClaw.
- لقطة من إعدادات Connectors في ChatGPT.
- وصول للقراءة إلى Azure Cost Management (أو لقطة).
