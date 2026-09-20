# دليل منصة Business Partner — الروابط، اللوحات، الوكلاء، العمليات، والتاريخ

تاريخ الإصدار: 2026-09-15. مصدر كل سطر هنا هو الكود نفسه (`site/`, `api/`, `vercel.json`, `site/data/nav.json`, `site/data/footer.json`, لوحة `/admin`) وسجلّ Git وقائمة سيناريوهات n8n كما هي اليوم — لا شيء من الذاكرة. النسخة المقروءة: https://claude.ai/artifact/G9MZcDxchxYdrkCN1BfWA2

النطاق الرئيسي: `https://www.businesspartner.sa` — كل مسار أدناه يعمل تحته، وبالعربية تحت `/ar/…` (وبالفرنسية `/fr/…` والصينية `/zh/…` حيث تُبنى الصفحة).

---

## 1) البنية: الموقع الجديد والقديم وما بينهما

| | الموقع الجديد (الإنتاج) | الموقع القديم |
|---|---|---|
| الفرع | `claude/bpic-marketing-site-jvrnga` (PR ‎#271 هو الـPR الوحيد للعمل) | `master` (آخر كوميت 2026-09-13، متأخر عن الإنتاج) |
| النشر | مشروع Vercel الوحيد `business-partner-sa-businessksa` (`prj_0QXlyAeL02QYYNrAQCfc6lRheTGp`) — يبني تلقائياً على الإنتاج فقط؛ الفروع الأخرى بعلامة في رسالة الكوميت | كان يُبنى من `master` قبل تحويل الإنتاج |
| الرئيسية | Simple V1 على `/` (محادثة واحدة تُخرج نطاقاً → عرض سعر → عقد → دفع → فاتورة) | الرئيسية الكلاسيكية باقية على `/classic-home` |
| التطوير | محلياً أولاً: `npm run dev` → `http://localhost:3000` مع `LOCAL_DB=1` (لا بطاقة تُخصم ولا رسالة تصل عميلاً) | — |
| البناء | `npm run build` (21 خطوة؛ النجاح = «B10X cache key updated on 1209 pages») وأول خطوة حارس `verify-api.mjs` | — |

**تطبيقات جانبية:**
- `bp-quotes` (`quotes/`) — لوحة العروض والعقود القديمة، ما زالت حيّة خلف `businesspartner.sa/quotes/*` بـrewrite. تُنقل إلى الموقع الرئيسي ثم تُحذف (`docs/quotes-cutover.md`).
- `bp-erp` — **حُذف نهائياً** (2026-09-04) من Vercel ومن المستودع.
- `hr.businesspartner.sa` — بوابة الاستقدام والتوظيف (نفس المشروع؛ `/portal/*`).

**روابط الموقع القديم التي تُحوَّل تلقائياً (308) إلى الجديد:**

| القديم | الجديد |
|---|---|
| `/revenue-os`, `/bdaas` | `/business-development` |
| `/revenue-dashboard` | `/business-development-dashboard` |
| `/blog` | `/saudi-arabia` |
| `/business-tourism` | `/tourism` |
| `/lead-generation` | `/data` |
| `/compliance-portal` | `/compliance-agent` |
| `/installments` | `/` (حُذف تابي؛ التقسيط عبر تمارا داخل الدفع) |
| `/inbox`, `/ar/inbox` | `/monitor` |
| `/ar/admin` | `/admin` |
| أكواد خدمات قديمة `bp-pl-0001/0067/0075/0094`, `bp-gosi-04` | `bp-sbc-01`, `bp-fi-02`, `bp-pl-0051`, `bp-pl-0019`, `bp-gosi-01` |
| لوحة العروض القديمة `/admin`, `/portal`, `/d/<token>`, `/rfp` (على bp-quotes) | `/quotes/admin`, `/quotes/portal`, `/quotes/d/<token>`, `/quotes/rfp` |

---

## 2) الصفحات العامة (الموقع)

**الشركة والتواصل:** `/` الرئيسية · `/about` من نحن · `/contact` تواصل معنا · `/consultation` احجز استشارة (على تقويم الشركة) · `/terms` الشروط · `/careers` الوظائف · `/newsletter` النشرة · `/magazine` المجلة (PDF) · `/team/<slug>` صفحات الفريق.

**الخدمات والباقات:** `/services` كل الخدمات (نحو 200 صفحة خدمة تحت `/services/<sku>` وتصنيفات `/services/category/*`: تأسيس الشركات، الاستثمار الأجنبي، الإقامة المميزة، العلاقات الحكومية، الموارد البشرية، التوظيف والاستقدام، دعم الأعمال، الأتمتة والذكاء) · `/packages` الباقات (باقات الخدمات بالموظفين، تأسيس الشركات، الباقات القانونية) · على كل صفحة خدمة «مشخّص الخدمة» (أسئلة قصيرة → ملخص مكتوب → خطوة تالية).

**المنتجات ⚡:** `/ai-agents` المستشارون الأذكياء · `/compliance-agent` مستشار الامتثال · `/ai-document-agent` مستشار المستندات · `/smart-employee` الموظف الذكي · `/shared-services` فريق الخدمات المشتركة · `/business-development` تطوير الأعمال كخدمة · `/task-force` تاسك فورس · `/data` قاعدة عملاء الأعمال (مفتوحة بلا رسوم) · `/deals` الصفقات · `/estrdad` استرداد الرسوم (BP-REF-01) · `/bank-account` فتح حساب بنكي · `/formation-contract` تأسيس بين شركاء · `/b10x` · `/connect` ربط الأدوات.

**التوظيف:** `/hr` خدمات التوظيف · `/employers` لأصحاب العمل · `/employer-join` انضم · `/employer-login` دخول · `/job-search-service` نبحث لك عن وظيفة · `/jobs/*` الوظائف المتاحة · `/job` · `/recruitment-agencies` مكاتب الاستقدام · `/candidate-profile` ملف المرشح · `/jobs-feed.xml` و`/indeed.xml` تغذية الوظائف.

**السياحة والمساحات والتموين والإسكان:** `/mahfol-makfol` محفول مكفول (للمستثمر؛ 54 رحلة مسعّرة) · `/mahfol-makfol/trips` الرحلات · `/tourism` فعاليات الشركات · `/workspaces` المساحات · `/workspace-request` اطلب مساحة · `/farina` التموين والضيافة · `/worker-housing` تسكين العمالة.

**مركز المعرفة والحاسبات:** `/saudi-arabia` الاستثمار في السعودية · `/guide/saudi-market` · `/guide/business-setup` · `/guide/run-your-business` · `/guide/live-in-saudi` · `/guide/residency` · `/directory` دليل ريادة الأعمال · `/opportunities` الفرص · `/news` الرؤى والأخبار · `/tools-and-calculators` · `/calculator` حاسبة التكاليف · `/calculators/government-cost` · `/calculators/profession-checker` · `/calculators/end-of-service` · `/calculators/annual-leave` · `/calculators/overtime` · `/calculators/gosi`.

**الشراكات:** `/suppliers` تسجيل الشركاء (الباب الوحيد؛ يفتح `/partner-dashboard#signup`).

**المسار التجاري:** `/cart` السلة · `/checkout` الدفع (مُيسّر بطاقة/Apple Pay، تمارا تقسيط، تحويل بنكي مع رفع الإيصال) · `/quote` عرض السعر · `/contract` العقد.

---

## 3) بوابات العملاء (تسجيل دخول)

| البوابة | المسار | من يدخل | الدخول |
|---|---|---|---|
| منصّة العملاء | `/account` | كل عميل اشترى خدمة — طلباته، مستنداته، فواتيره، عروضه وعقوده، التذاكر | بريد + رمز / كلمة مرور / Google |
| بوابة Simple V1 | `/my` (`/ar/my`, `/fr/my`, `/zh/my`) | عميل المسار الجديد: النطاق → العرض → العقد → الدفع → الفاتورة | بريد + رمز |
| لوحة تطوير الأعمال كخدمة | `/business-development-dashboard` (اسم بديل `/client-portal`) | مشتركو تطوير الأعمال: البايبلاين، الشركات المطابقة، الإيرادات | جلسة الحساب |
| لوحة الشريك | `/partner-dashboard` | الشركاء/الموردون: أوامر العمل، خدماتهم وأسعارهم، عمولتهم، محفظتهم، رابط الإحالة | حساب + كلمة مرور + رمز بريد / Google |
| بوابة الموظفين الأذكياء | `/portal`, `/portal/dashboard` | مشتركو الموظف الذكي / بوابة الاستقدام HR | رمز / جلسة |
| لوحة منصة التوظيف | `/employer-dashboard` | أصحاب العمل: المرشحون والطلبات والمقابلات | `/employer-login` |
| بوابة المكاتب | `/agency-portal` | مكاتب الاستقدام ووكالات التوظيف | رمز |
| لوحة الامتثال | `/compliance-dashboard` | مشتركو مستشار الامتثال: المخالفات والاعتراضات وتجربة 14 يوماً | جلسة الحساب |
| لوحة الخدمات المشتركة | `/shared-services/dashboard` | عملاء فريق الخدمات المشتركة | رمز BP-XXXXXX |
| بوابة العروض والعقود (القديمة) | `/quotes/portal`, `/quotes/d/<token>` | عملاء لديهم عروض/عقود صادرة من bp-quotes | رابط موقّع |

---

## 4) لوحات المالك والإدارة

| اللوحة | المسار | الوظيفة |
|---|---|---|
| لوحة تحكم الموقع | `/admin` | المركز الوحيد: نظرة عامة، الطلبات والموافقات، نوشن مباشر، المالية، الإيرادات، الشركاء، محتوى الموقع (ملف لكل صفحة)، الصفحات، الأدوات، لوحاتنا (تُفتح داخل اللوحة)، الخدمات المتصلة |
| لوحة عمليات Simple V1 | `/ops` | طلبات المسار الجديد: تسعير، اعتماد، عقد، دفع، إشعارات |
| BP Inbox | `/monitor` | محادثات واتساب ومستشار الموقع والتذاكر — الرد المباشر بمساعدة الذكاء، إيقاف/تفعيل الوكيل لكل عميل |
| فريق الإيجنتس | `/dashboard` | اختبار كل موظف ذكي والتحكم بتفعيله |
| لوحة الشركاء (المالك) | `/suppliers-admin` | اعتماد الموردين، طلب عروض أسعار، أوامر العمل، الفواتير |
| لوحة مزوّدي التوظيف | `/agencies-admin` | مكاتب الاستقدام، رسومها، نشر الطلبات للشبكة |
| خدمة البحث عن وظيفة | `/jobsearch-admin` | المرشحون الذين طلبوا البحث لهم عن عمل |
| مستشار المستندات | `/doc-agent-admin` | طلبات تعبئة المستندات، المخرجات، إعادة التوليد |
| لوحة العروض والعقود (القديمة) | `/quotes/admin` | إصدار العروض وتحويلها لعقود (على bp-quotes) |

**أدوات `/admin` (كل أداة صفحة مستقلة):** استرجاع المدفوعات (دفعات وصلت ولم تُسجَّل) · حالة الخدمات (أي مفتاح موصول — أسماء فقط، ومنها أسطر Azure الأربعة) · جاهزية الدفع (مُيسّر) · الربط المحاسبي (الدفترة) · تصحيح فاتورة صادرة · إرسال الدفترة لفاتورتها · اعتماد — العقود الحكومية · أكواد الخصم · الضمانات والمحافظ · أمر عمل جديد · العقود والتوقيع (DocuSign) · إشعارات العميل · لوحة العروض والعقود.

---

## 5) المستشارون الأذكياء والوكلاء

**على الموقع (يعمل من `api/chat.js` ومزوّدها الأول Azure OpenAI):**
- «باهر» — المستشار العائم على كل صفحة، بالصوت والنص، ويسجّل العميل ويفتح تذكرة أو عرض سعر.
- المحادثة الموحّدة في الرئيسية (Simple V1) — تُخرج نطاق الخدمة مباشرة.
- مشخّص الخدمة على كل صفحة `/services/<sku>`.
- مستشار الامتثال (`/compliance-agent`)، مستشار المستندات (`/ai-document-agent` — رفع، تصنيف، استخراج، تعبئة DOCX/PDF/Excel)، الموظف الذكي (`/smart-employee`).
- فريق الخدمات المشتركة (`/shared-services`): خالد (المكتب الافتراضي) · مازن (العمليات) · ناصر (الموارد البشرية) · مشاري (الامتثال) · عبدالرحمن (المالية) · عبدالعزيز (القانوني) · بدر (المبيعات) · فرح (النمو والتسويق) · ملاك (مساعدة تنفيذية) · محمد (تقنية المعلومات) · أحمد (التخطيط الاستراتيجي) · عبدالله (المشتريات والتوريد).

**في n8n (`businesspartnerai.app.n8n.cloud` — 101 سيناريو، الحيّة منها):**
- خدمة العملاء: `BP-WhatsApp-Main (Orchestrator)` واتساب الإنتاج · `مُعين — Chief of Staff لباهر` (صوت + واتساب للمالك) · `BP-Chat-Monitor-API` / `BP-Chat-Suggest` / `BP-Chat-Media` (خلفية BP Inbox) · `BP-Sub-AI-Conversation` / `Advisor` / `Documents` / `Menu` · `إشعار عميل الموقع — واتساب لباهر` · `استقبال ملفات العميل — Webhook`.
- فريق المدراء الذكي: Baher (Business Advisor) · Badr (Sales & BD) · Abdulaziz (Legal & Compliance) · Abdulrahman (CFO) · Mazen (Operations) · Nasser (HR) · Mishari (Compliance) · Farah (Growth) · Malak (EA) · Mohammed (IT) · Ahmed (Strategic Planning) · Abdullah (Procurement) · Salman (Digital Product & Funnel) · Lead Consultant · Finance & Pricing · Market Research · Business Model.
- محرك الإيرادات: `Unified Revenue Intake` · `Deal Lifecycle Orchestrator` · `Team Task Dispatcher` · `Department KPI Scorecard` · `Cash & Execution Watchdog` · `Agent Control Center` · `BP AI Space — Data API` · `Virtual Baher Live`.
- الامتثال: `BP3 — قائد الامتثال (WhatsApp)` · `وكيل الامتثال — شريك الأعمال` · `BP3 — واجهة API للوحة العميل` · `BP3 — استخراج المستندات` · `محلل ملفات العملاء — نطاقات + تكاليف`.
- التوظيف: `Website ATS Intake → AI Screening` · `Recruitment Agent — Headhunter` · `Job Posting & Screening` · `Candidate ↔ Job Matcher` · `وكيل Outlook CVs → ATS` · `بوابة استقبال المرشحين` · `Sync Visa Tracker`.
- المبيعات وقاعدة الشركات: `Classify Leads` · `Sales DB Hygiene` · `Bounce Handler` · `Email → Notion CRM + Drive` · (موقوفة: Google Places Ingest، OSM Ingest، Apollo Enrich، Website Email Finder، Campaign Sender).
- التسويق: `Weekly Newsletter (Sunday 10AM)` · `BP-Daily-Gov-News` · `Publisher — Autonomous Social Distributor` · `Autonomous Weekly Content Planner` · `Marketing Dashboard & Approvals` · `Government Updates Monitor`.
- العمليات: `إيجنت التحقق من مطابقة إيصالات الدفع` · `الكنس اليومي: الضمانات + متابعات CRM` · `BP-Error-Handler` · `RE — Client Intake / Matching Engine / RFQ Dispatch` · `Mahfol Makfol AI WhatsApp` · `AI Trip Designer` · `SS — Login / Onboarding / Chat Gateway / Knowledge / Stats / Names` · `Investor Lead Pipeline`.
- بنية: `GOSI — نِسب خصومات الاشتراكات` (DPoP) · حاسبتا النطاقات والرسوم (موقوفتان) · `مزامنة الكتالوج نوشن ⇄ اللوحة ⇄ الموقع` (موقوفة).

---

## 6) العمليات والتكاملات (ما هو مربوط فعلاً)

| الخدمة | الرابط | الدور | أسماء المتغيرات (قيمها في Vercel فقط) |
|---|---|---|---|
| Vercel | vercel.com — المشروع `business-partner-sa-businessksa` | الاستضافة + 12 دالة `api/` | — |
| Microsoft Azure | مورد المالك — Microsoft for Startups | **البنية التحتية الرقمية**: OpenAI، Document Intelligence، Blob، SharePoint (القسم 8) | `AZURE_*` |
| بدائل الذكاء | Gemini، Groq، Anthropic، OpenAI، ElevenLabs (تفريغ صوتي) | احتياط للمحادثة العامة؛ معطّلة في المستندات والتوظيف إلا بالصمّام | `GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` |
| Supabase | قاعدة PostgreSQL (`db/schema.sql`) | المستخدمون، الجلسات، الطلبات، المهام، التذاكر، الضمانات، المحافظ | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Notion | 16 قاعدة (أدناه) | CRM وسجلات التشغيل | `NOTION_TOKEN` + `NOTION_*_DB` |
| n8n Cloud | businesspartnerai.app.n8n.cloud | الأتمتة، واتساب، الفريق الذكي | webhooks |
| WhatsApp Cloud API (Meta) | عبر n8n | الرقم الرسمي 0530540231 | — |
| مُيسّر | dashboard.moyasar.com | الدفع بالبطاقة وApple Pay + Webhook | `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_SECRET_KEY`, `MOYASAR_WEBHOOK_SECRET` |
| تمارا | — | التقسيط (12 قسطاً، حد 50 ألفاً) | `TAMARA_API_TOKEN`, `TAMARA_API_BASE` |
| الدفترة (ZATCA) | businesspartner.daftra.com | الفواتير الضريبية، عروض الأسعار، الإشعارات الدائنة | `DAFTRA_API_KEY`, `DAFTRA_SUBDOMAIN` |
| DocuSign | app.docusign.com | العقود والتوقيع (⚠ ما زال `DOCUSIGN_ENV=demo`) | `DOCUSIGN_*` |
| Resend | — | كل البريد والمرفقات | `RESEND_API_KEY` |
| Google | OAuth + Drive | دخول العملاء بحساب Google؛ Drive كان مرآة الخزنة قبل SharePoint | `GOOGLE_CLIENT_ID` |
| اعتماد | apiportal.etimad.sa | العقود الحكومية (رمز حقيقي، مسار العقود بانتظار دليل التكامل) | `ETIMAD_*` |
| نفاذ (Elm) | — | مبني كاملاً (لوحة المالك وبوابات العملاء) — **غير مهيّأ بعد** | `NAFATH_APP_ID`, `NAFATH_SERVICE`, `OWNER_NATIONAL_IDS` |
| GitHub | github.com/businessKSA/business-partner-sa | الكود + حفظ المحتوى من `/admin` | `GITHUB_TOKEN` |

**قواعد نوشن الموصولة:** CRM الموحّد — Sales Pipeline `notion.so/d9a342be24774be3b4095d439d21fc90` · CRM `app.notion.com/p/0b126b52ef9c40b5821f3495ae2985b4` · العملاء المحتملون (Leads) `…/26faca2761884b6ab584924c374f2d22` · الموردون والشركاء `…/d60933ed446e40ee8bcb8a640d5bcb52` · أوامر عمل الموردين `…/fde498d5974c48f5a0ca9f21de4c0caf` · المرشحون (ATS) `…/71792742873e4de398135c7855542b95` · الوظائف `…/260d76959d464631943f79f313fbf3c9` · أصحاب العمل `…/f1104f8bcc3d4beb84accdbda0aa8322` · مكاتب الاستقدام `…/32f564a5c1dd4370b5af6567c27eee40` · طلبات المكاتب `…/9023896619e24c7592d97fbd43dda7f9` · الامتثال `…/5d570a75009b41019857060d0670642f` · لوحة المهام `…/f416606b4fab4cbb80ced171f75e0a3b` · التوريد `…/644ac54670e44fdb8f03904fe9eed362` · الورشة `…/f83bce33eab7481a8b803495c6cd7619` · نشرة الأخبار اليومية `…/396d108dee5c813cbac6c269c47d0b4f` · مسودة النشرة البريدية `…/398d108dee5c815189ddd26523be6631`.

---

## 7) ما أُنجز من يوليو حتى اليوم

سجلّ Git لهذا المستودع يبدأ في 2026-08-22 (PR ‎#237). ما قبله موثّق في `docs/` وفي تواريخ إنشاء سيناريوهات n8n.

**يونيو–يوليو 2026 — الأساس والفريق الذكي (n8n + docs):**
واتساب الإنتاج `BP-WhatsApp-Main` (29 يونيو) · BP Inbox وخلفيته (2 يوليو) · فريق المدراء الذكي: بدر، عبدالعزيز، عبدالرحمن، مازن، ملاك، محمد، عبدالله، فرح (2 يوليو)، باهر، ناصر، مشاري (9 يوليو)، أحمد الاستراتيجي (16 يوليو)، سلمان (27 يوليو) · مُعين Chief of Staff (3 يوليو) · وكيل الامتثال ومحلل ملفات العملاء (2–6 يوليو) · استخراج المستندات وواجهة لوحة العميل (8 يوليو) · النشرة اليومية الحكومية (7 يوليو) · وكيل Outlook CVs → ATS (6 يوليو) · بوابة الخدمات المشتركة كاملة (16–21 يوليو) · التوظيف: Headhunter، Job Posting & Screening، Candidate↔Job Matcher (22–23 يوليو) · العقارات: Intake، Matching، RFQ (17 يوليو) · الناشر والمخطط الأسبوعي والنشرة الأسبوعية (18–21 يوليو) · قاعدة الشركات: Google Places، OSM، Apollo، Email Finder (23 يوليو) · Cash Watchdog، KPI Scorecard، Unified Revenue Intake (26–27 يوليو) · وثائق: رحلة العميل (16 يوليو)، عميل صفر، HR ATS MVP، ورشة الفعاليات، معمارية فريق الخدمات المشتركة.

**أغسطس 2026 (46 كوميت):**
شاشة الفواتير وجسر الدفترة (#238–239) · الكتالوج الكامل وتعديل بيانات العميل (#241) · الإصدار التلقائي وبوابة العميل الكاملة (#265) · تصنيف كل عميل بقناة الوصول · BP Inbox بأزرار واتساب/اتصال/بريد · تسجيل الشركاء من باب واحد (#266) · متابعات اليوم كسطح CRM حيّ · أداة استرجاع المدفوعات (#269) · الفاتورة الضريبية من مصدر واحد · ما يصل العميل: جدول وزر وإيصال · أثر التوقيع · تمارا (التقسيط) مع الفحص الحيّ · حذف تابي · محرك مستشار المستندات وجداوله وصفحته · التعبئة في المكان (DOCX/Excel/PDF) · مرآة الخزنة: مجلد لكل عميل في Drive ونوشن · التوريد بإعادة البيع (طلب عروض من الموردين) · لوحة العروض موصولة بلوحة الموقع · الامتثال في بوابة العميل (المخالفات، الاعتراضات، تجربة 14 يوماً) · إصلاحات حيّة من سجلات الإنتاج.

**سبتمبر 2026 (122 كوميت):**
- 1–2: ترتيب لوحة العميل كاملة (قوائم مجمّعة، مستشارون مدمجون، مركز مهام، بوابات بلا رموز) · الرقم الرسمي 0530540231 في كل صفحة · لوحة الإيرادات تفصل مالنا عمّا يمرّ من خلالنا · قواعد العمل `CLAUDE.md` (مشروع Vercel واحد) · حارس الـAPI (بناءٌ يفشل بدل إنتاجٍ يسقط) بعد عطلَي 500 · إصلاح لوحة `/admin` (وسم زائد أفسد كل الشاشات) (#311) · لوحة العروض تحت الدومين الرئيسي `/quotes` · كتالوج الوكيل ببحث عربي مطوي · Simple V1: الرئيسية الجديدة بأربع لغات، بوابة `/my`، لوحة `/ops` · Vercel: النشر بالطلب لا مع كل دفعة.
- 3–4: التطوير المحلي أولاً (`localhost:3000` + قاعدة محلية) · مشخّص الخدمة على كل صفحة خدمة · حذف `erp/` · جرد bp-quotes وخطة نقله · نطاق الخدمات ومستنداته · العقد بعد اعتماد العرض والدفع كاملاً والفاتورة من الدفترة · دخول لوحة العميل بكلمة المرور وGoogle · قائمة خدمات واتساب من الكتالوج (140 خدمة) · الرحلة تمشي بنفسها (عرض فوري وإشعار للطرفين) · الهوية الرسمية من المستندات (السجل، الرقم الموحد، الضريبي) · صفحة دفع جديدة بتصميم الموقع ورفع إيصال التحويل · تحكّم الإدارة بوكيل واتساب (آلة أم إنسان) · Simple V1 هي الرئيسية.
- 5–9: اتجاه «مختبر» على الموقع كاملاً بألوان الهوية · الصوت في المحادثة (Whisper ثم ElevenLabs Scribe للعربية) · إلغاء الطلبات من الجهتين · رحلة عميل الواتساب تصل إلى عرض سعر برابطه · محفول مكفول: 54 رحلة مسعّرة من نوشن إلى السلة · مُهيّئ زيارة المستثمر · حجز الاستشارة على تقويم الشركة · خدمة استرداد الرسوم BP-REF-01 · قاعدة عملاء الأعمال بلا رسوم · تنظيف كل الروابط الميتة · 24 خدمة إقامة مميزة واستثمار وتجارة + خدمات أجير وبوابة المستفيد ومنصات الوزارة من مراجع نوشن · إصلاح سقوط المحادثة (نموذج Groq المتوقَّف) · قاعدة المعرفة لم تعد تُحقن كاملة · بطاقات ثنائية اللغة.
- 13: مصادقة العروض داخل بوابة العميل · إصلاح ازدواج كوكي الجلسة (apex/www) · عناوين الطلبات بلغة العميل · غلاف محادثة مرن مع احتياط حتمي عند غياب المزوّدات.
- 15 (اليوم): **Azure OpenAI مزوّداً أول للمحادثة والصوت** · **البنية التحتية على Azure: قراءة المستندات (OpenAI + Document Intelligence)، الخزنة (Blob)، مجلدات العملاء (SharePoint)، وتعريف Logic App لواتساب** · **Azure أولاً في التوظيف وفرز المرشحين، وأربعة أسطر Azure في «حالة الخدمات»** · Chat OS (الموقع كله محادثة) على رابط تجريبي · زر السلة في الشريط · 200 صفحة خدمة وُصلت من باب الخدمات · هذه الوثيقة.

---

## 8) أزور (Microsoft Azure): الحالي، وخريطة النقل، وما يلزم

قرار المالك (2026-09-15): البنية التحتية الرقمية على Microsoft Azure. التفاصيل التشغيلية في `ops/azure/README.md`.

**ما انتقل فعلاً إلى Azure (في الكود، اليوم):**

| الطبقة | قبل | الآن | الملف |
|---|---|---|---|
| المحادثة (باهر، Simple V1، المشخّص) | Gemini → Groq → Anthropic → OpenAI | **Azure OpenAI أولاً** ثم البدائل | `api/chat.js` |
| التفريغ الصوتي | Whisper / ElevenLabs | **Azure OpenAI (Whisper)** أولاً | `api/_docread.js` |
| قراءة المستندات (صور) والتخطيط والمطابقة | Gemini → Anthropic → OpenAI | **Azure OpenAI فقط** — البدائل معطّلة إلا بـ`DOC_AI_ALLOW_FALLBACK=1` | `api/_docread.js` |
| قراءة الـPDF | Gemini/Anthropic | **Azure AI Document Intelligence** (OCR) ثم Azure OpenAI | `api/_docread.js` |
| التوظيف وفرز المرشحين | Gemini → Groq → OpenAI → Anthropic | **Azure OpenAI أولاً**؛ متى ضُبط Azure تتعطّل البدائل إلا بالصمّام نفسه | `api/hire.js`, `api/candidate.js`, `api/_azure.js` |
| خزنة الملفات | Supabase Storage | **Azure Blob Storage** + روابط SAS (القراءة ترجع إلى Supabase عند 404 فقط للملفات القديمة) | `api/_azblob.js`, `api/_db.js` |
| مجلدات العملاء | Notion + Google Drive | **SharePoint عبر Microsoft Graph** (مجلد لكل منشأة) | `api/_msgraph.js`, `api/_docagent.js` |
| مدخل واتساب | n8n | تعريف Logic App جاهز **غير منشور بعد** — واتساب الإنتاج ما زال في n8n | `ops/azure/whatsapp-logic-app.json` |
| الاختبارات | — | `tests/azure-provider.test.mjs` يُسقط أي نداء يتسرّب إلى googleapis/anthropic/openai؛ `tests/azure-blob.test.mjs` | `tests/` |

**في `/admin` → الأدوات → حالة الخدمات** أربعة أسطر جديدة تقول ما هو موصول من Azure، بالأسماء لا القيم: الذكاء (OpenAI) · قراءة الـPDF (Document Intelligence) · الخزنة (Blob) · مجلدات العملاء (SharePoint).

**ما يلزم من المالك — في Vercel → Settings → Environment Variables → Production (لا يُلصق أي مفتاح في المحادثة أبداً):**

| المجموعة | المتغيرات | ملاحظة |
|---|---|---|
| الذكاء | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` (+ اختياري `AZURE_OPENAI_VISION_DEPLOYMENT`, `AZURE_OPENAI_TEXT_DEPLOYMENT`) | يخدم المحادثة والصوت والمستندات والتوظيف |
| قراءة الـPDF | `AZURE_DOCINTEL_ENDPOINT`, `AZURE_DOCINTEL_KEY` (+ اختياري `AZURE_DOCINTEL_MODEL`, `AZURE_DOCINTEL_API_VERSION`) | **مطلوب** — بدونه لا يُقرأ أي PDF |
| الخزنة | `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY` (+ اختياري `AZURE_STORAGE_CONTAINER`) | الحاوية خاصة؛ الوصول بروابط SAS عشر دقائق |
| مجلدات العملاء | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_GRAPH_DRIVE_ID` (+ اختياري `AZURE_GRAPH_ROOT_FOLDER`) | تطبيق Entra ID بصلاحيات `Files.ReadWrite.All` و`Sites.ReadWrite.All` |
| صمّام الأمان | `DOC_AI_ALLOW_FALLBACK=1` | فقط عند انقطاع Azure؛ ليس مساراً افتراضياً |

بعد الضبط يُعاد النشر، ثم حالة الخدمات يجب أن تُظهر الأسطر الأربعة ✓.

**ما لم يُنقل بعد (قرارات، لا تنفيذ صامت):**

| المكوّن الحالي | البديل على Azure | الحجم | ملاحظة |
|---|---|---|---|
| Supabase (PostgreSQL: المستخدمون، الجلسات، الطلبات، المدفوعات) | Azure Database for PostgreSQL | كبير | يحتاج مُشغّل `pg` وتغيير أمر التثبيت وتجميع اتصالات؛ الخطة المرحلية في `ops/azure/README.md` §5 — تبديل دفعة واحدة يوقف الدخول والشراء إن أخطأ شيء |
| n8n (101 سيناريو، واتساب الإنتاج، الفريق الذكي) | Logic Apps / Functions + Azure Communication Services | كبير | **لا يُعدَّل واتساب الحي**؛ يُبنى بالتوازي ثم يُقطع سيناريو سيناريو، بدءاً من Logic App المدخل |
| Notion (16 قاعدة) | Azure SQL / Cosmos DB + Dataverse | كبير | نوشن واجهة تشغيل للفريق أيضاً؛ يُبقى مرآة أو يُستبدل بواجهة |
| Resend (البريد) | Azure Communication Services Email | صغير | مزوّد واحد |
| بدائل الذكاء (Gemini/Groq/Anthropic/OpenAI/ElevenLabs) | تُزال | صغير | باقية كصمّام أمان خلف `DOC_AI_ALLOW_FALLBACK`؛ والمحادثة العامة ما زالت تحتفظ بها كاحتياط تلقائي |
| الاستضافة Vercel | Azure Static Web Apps + Functions | كبير | يتعارض مع قرار «مشروع Vercel واحد» في `CLAUDE.md` — قرار مالك |
| مُيسّر، تمارا، الدفترة/ZATCA، نفاذ، اعتماد، WhatsApp Cloud API (Meta) | **لا بديل على Azure** | — | مزوّدون سعوديون/تنظيميون أو Meta؛ يبقون، ويتصل بهم الكود من Azure كما يتصل بهم اليوم |

---

## 9) مفتوح الآن

- اختبار `tests/contract.test.mjs` («The note written at checkout parses back into terms») يفشل على الفرع الأساسي قبل أي تغيير اليوم — عطل قائم يحتاج إصلاحاً منفصلاً.
- `DOCUSIGN_ENV` ما زال `demo` — التوقيعات غير ملزمة قانوناً حتى يُضبط `production`.
- نفاذ مبني وغير مهيّأ (`NAFATH_APP_ID`, `NAFATH_SERVICE`, `OWNER_NATIONAL_IDS`).
- اعتماد: مسار العقود بانتظار دليل التكامل/Postman من اعتماد.
- bp-quotes: نقل التاريخ وتحويل `/quotes/d/<token>` إلى الموقع الرئيسي ثم الحذف.
- سقف Vercel (100 نشرة/يوم): جلسة واحدة على الموقع في كل مرة، والمعاينة بالطلب فقط.
