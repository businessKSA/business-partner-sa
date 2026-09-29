# فهرس أرشيف n8n Cloud — 2026-09-29

مصدره `mcp__n8n__get_workflow_details` (detailLevel full) لكل سيناريو على
`businesspartnerai.app.n8n.cloud`؛ حُذف من كل ملف `scopes` و`canExecute`
(خاصان بجلسة القراءة). **يُولَّد هذا الفهرس من الملفات نفسها** — لا يُحرَّر يدوياً.

| | العدد |
|---|---|
| سيناريوهات | **111** |
| نشطة | **81** |
| متوقفة | 30 |
| تستخدم اعتماداً خارج Azure (OpenAI/Anthropic/Gemini/OpenRouter/ElevenLabs) | 27 — منها نشطة 21 |
| نسختها المنشورة تختلف عن المسودة | 1 |

## ما حُجب قبل الحفظ

n8n لا يُصدّر أسرار الاعتماد، لكنه يُصدّر ما كُتب **حرفياً داخل العقد**. الفحص
(نمط القيم + معاملات باسم `key`/`token`… + مقارنات IF وCode بمعرّف حرفي)
وجد الآتي، واستُبدل في الأرشيف بتعبير بيئة. **النسخ الحيّة على n8n Cloud ما
زالت تحمل القيم**، وتبديلها قرار المالك (`docs/n8n-to-azure-migration.md` §8).

| المعرّف | السيناريو | أين | صار |
|---|---|---|---|
| `ol6DEU2baRYENYfB` | الكنس اليومي | عقدة HTTP «اقرأ المتابعات من الموقع» — معامل `key` | `={{ $env.BP_PANEL_KEY }}` |
| `eABgXmMQZcCTzatn` | BP-Chat-Monitor-API | عقدتا IF «Feed Key Valid?» و«Send Key Valid?» وعقدة Code «Parse Send Request» | `$env.BP_PANEL_KEY` |
| `ETxqAM5VooDiDJDN` | BP-Sub-AI-Conversation | أداة `issue_quote` — حقل `key` في جسم الطلب | `$env.BP_PANEL_KEY` |
| `fjOMfqFdUhc5DxDf` | BP-Chat-Media | عقدة Code «Parse Media Request» وعقدة IF «Media Key Valid?» | `$env.BP_CHAT_MEDIA_KEY` |
| `B0pF8xB7b4L3hxtd` | BP-Chat-Suggest | عقدة Code «Parse Suggest Request» (القيمة نفسها التي في BP-Chat-Media) | `$env.BP_CHAT_MEDIA_KEY` |
| `FlBeLfyjQaSpPAzR` | GOSI (متوقف) | عقدة Code «بناء الطلب» — احتياطي `x-apikey` الرملي | `''` (يُقرأ من `$vars.GOSI_APIKEY` فقط) |

عند الاستيراد على المثيل الجديد تُضبط `BP_PANEL_KEY` و`BP_CHAT_MEDIA_KEY`
في متغيّرات بيئة n8n، وإلا رفضت هذه العقد كل طلب (مقارنة بسلسلة فارغة).

## السيناريوهات

المشغّل: WhatsApp · Webhook · Schedule · Chat · Form · Gmail · Notion · Error ·
فرعي (يُستدعى من سيناريو آخر) · يدوي.

| # | المعرّف | الاسم | نشط | عقد | المشغّل | الاعتمادات | خارج Azure |
|---|---|---|---|---|---|---|---|
| 1 | `e8ki3rUFQCkWvqD7` | ⏱️ BP AI — Cash & Execution Watchdog | ✅ | 7 | Schedule | WhatsApp account |  |
| 2 | `h4Z5QWt2WSc4XN19` | ⏲️ BP AI — Stuck Task Sweeper | ✅ | 4 | Schedule | — |  |
| 3 | `R71kgwaBNw6WzKFI` | 🌐 استقبال ملفات العميل — Webhook + إشعارات | ✅ | 16 | Webhook | Gmail — Business Partner — Production · Google Drive OAuth2 API · Header Auth account 2 · Notion — Business Partner OS — Production |  |
| 4 | `bldhMv0BAGs41Xqo` | 🌐 إشعار عميل الموقع — واتساب لباهر | ✅ | 5 | Webhook | Business Partner Test · Google Calendar — Business Partner — Production |  |
| 5 | `6jgqpWlBRbyncwTC` | 🎛️ BP AI — Agent Control Center | ✅ | 23 | Webhook | OpenAI account | OpenAI account |
| 6 | `W67UYN1WLumjVoCr` | 🎯 BP Team — Baher (Business Advisor) | ✅ | 7 | Webhook | Azure Open AI account |  |
| 7 | `x7gmc3bXUGJGZScR` | 🎯 BP Team — Marketing Dashboard & Approvals | ✅ | 10 | Webhook | Notion OAuth2 API |  |
| 8 | `BFtwc8hCIaq6mbsB` | 🎯 BP Team — Wissam (Revenue Ops & Deal Desk) | ✅ | 12 | Webhook · فرعي | Azure Open AI account |  |
| 9 | `JOHZYShR1yVAUMsV` | 🏢 BP Team — Tariq (Real Estate Services) | ✅ | 11 | Webhook · فرعي | Azure Open AI account |  |
| 10 | `c7WRFI1UmoQ4noM5` | 👥 BP Team — Nasser (HR) | ✅ | 12 | Webhook · فرعي | Azure Open AI account |  |
| 11 | `HZ8W430gZovbVSSs` | 💰 BP Team — Abdulrahman (CFO) | ✅ | 13 | Webhook · فرعي | Azure Open AI account |  |
| 12 | `SwrEPSRIz6utN51c` | 💰 BP Team — Finance & Pricing | ✅ | 6 | Webhook | Azure Open AI account |  |
| 13 | `SL1aYYS2UBsqHFPE` | 💼 BP Team — Abdulaziz (Legal & Compliance) | ✅ | 12 | Webhook · فرعي | Azure Open AI account |  |
| 14 | `nvrh0c3mUctb1EsG` | 💼 BP Team — Badr (Sales & BD) | ✅ | 20 | Webhook · فرعي | Azure Open AI account · Notion OAuth2 API · Notion — Business Partner OS — Production |  |
| 15 | `7CxR4ecw92hYHIfq` | 💼 BP Team — Malak (Executive Assistant) | ✅ | 7 | Webhook | Azure Open AI account |  |
| 16 | `WZE7oUzCzQGR1u0t` | 💼 BP Team — Mazen (Operations & Support) | ✅ | 13 | Webhook · فرعي | Azure Open AI account |  |
| 17 | `e9G9S6GG0j7lCiWt` | 💼 BP Team — Mohammed (IT) | ✅ | 14 | Webhook · فرعي | Azure Open AI account |  |
| 18 | `vWICtJIGL4Cu7NXy` | 📈 BP Team — Sara (Head of Growth & Marketing) | ✅ | 17 | Webhook · فرعي | Azure Open AI account · Notion MCP OAuth2 |  |
| 19 | `S3507deZMyxbCdZq` | 📊 BP AI — Department KPI Scorecard | ✅ | 7 | Schedule · يدوي | — |  |
| 20 | `5slajhpFDal0SCqi` | 📊 BP Team — Market Research | ✅ | 6 | Webhook | Azure Open AI account |  |
| 21 | `J8xm3tguTH390xCq` | 📣 BP Publisher — Autonomous Social Distributor | ✅ | 9 | Schedule · يدوي | LinkedIn account · Notion — Business Partner OS — Production · OpenAI account | OpenAI account |
| 22 | `u8oFePZaV69YdjFn` | 📥 BP AI — Unified Revenue Intake | ✅ | 13 | Webhook | — |  |
| 23 | `8PGiUitiRKDybt3l` | 📦 BP Team — Abdullah (Procurement) | ✅ | 11 | Webhook · فرعي | Azure Open AI account |  |
| 24 | `8HL5NWvqi1SkTKqb` | 📦 BP Team — Salman (Product Manager — Service, Page, Packages, Portal, Journey) | ✅ | 15 | Webhook · فرعي | Azure Open AI account · Vercel — Business Partner — Production |  |
| 25 | `6PJLw2ABLXE2l6sF` | 📰 BP Team — Alaa (News & Regulatory Content) | ✅ | 10 | Webhook · فرعي | Azure Open AI account |  |
| 26 | `WTBfUJKaeCJSIi3m` | 🔄 BP AI — Deal Lifecycle Orchestrator | ✅ | 5 | Schedule | — |  |
| 27 | `lsi2W7g238uIGyAC` | 🔊 Jarvis — Voice (Azure Neural TTS) | ✅ | 4 | Webhook | Azure Speech — Jarvis |  |
| 28 | `OfesoKDnsVO1IdEk` | 🔗 محلل ملفات العملاء — نطاقات + تكاليف | ✅ | 5 | يدوي · Schedule | Header Auth account 2 · Notion — Business Partner OS — Production |  |
| 29 | `d2Hckm4D2WfUZrq2` | 🗝️ SS — Agent Names (ss-names) | ✅ | 8 | Webhook | Notion OAuth2 API |  |
| 30 | `wXMFBKkxcvjOjzEb` | 🗝️ SS — Chat Gateway (ss-chat) | ✅ | 10 | Webhook | Notion OAuth2 API |  |
| 31 | `YzQW3nycx1FSCrRG` | 🗝️ SS — Client Login (ss-login) | ✅ | 5 | Webhook | Notion OAuth2 API |  |
| 32 | `lVif1yk5tJGY8V0V` | 🗝️ SS — Client Onboarding (ss-onboard) | ✅ | 12 | Webhook | Gmail OAuth2 API · Notion OAuth2 API |  |
| 33 | `0qWMwVVXZvbPdJdj` | 🗝️ SS — Company Knowledge (ss-knowledge) | ✅ | 15 | Webhook | Anthropic account · Azure Open AI account · Notion — Business Partner OS — Production · OpenAI account | Anthropic account · OpenAI account |
| 34 | `m9S6s6qQ0QIvQcFs` | 🗝️ SS — Team Stats (ss-stats) | ✅ | 10 | Webhook | Notion OAuth2 API |  |
| 35 | `ZvPryyHTAVNqUtGF` | 🤝 BP Shared Services — Web Chat (Virtual Office) | ✅ | 26 | Chat | Azure Open AI account · Notion — Business Partner OS — Production |  |
| 36 | `3EaVnFEzwO5HxXMI` | 🧑‍💼 BP Team — Bandar (Recruitment & Staffing Services) | ✅ | 12 | Webhook · فرعي | Azure Open AI account |  |
| 37 | `YgRwn40v1CqsscJw` | 🧠 فرح — رئيسة المكتب التنفيذي لباهر (Voice + WhatsApp) | ✅ | 40 | WhatsApp · فرعي · Webhook | Azure Open AI account · Azure Speech — Jarvis · Business Partner Test · Gmail OAuth2 API · Google Calendar — Business Partner — Production · Notion MCP OAuth2 · WhatsApp account · WhatsApp — Muin — 0530540231 |  |
| 38 | `k5vtioWWKC2i1W0n` | 🧠 BP AI — Virtual Baher Task Review Loop | ✅ | 11 | Schedule | Azure Open AI account |  |
| 39 | `BZlZ9irajglk4qpS` | 🧠 BP Team — Ahmed (Strategic Planning) | ✅ | 12 | Webhook · فرعي | Azure Open AI account |  |
| 40 | `Gktp6pcZ94F3IEmg` | 🧠 Virtual Baher Live — Open AI Chat | ✅ | 26 | Webhook · فرعي | Azure Open AI account · Google Gemini(PaLM) Api account · OpenAI account | Google Gemini(PaLM) Api account · OpenAI account |
| 41 | `IEZoSpEJR5FiSo8L` | 🧩 BP Team — Business Model | ✅ | 6 | Webhook | Azure Open AI account |  |
| 42 | `ialdR5jzaILmjYgn` | 🧪 عميل صفر — باهر (Front Desk) | ✅ | 17 | Chat | Azure Open AI account · Notion — Business Partner OS — Production |  |
| 43 | `fjXdJCgt1jDbzKkC` | 🧭 BP Team — Lead Consultant | ✅ | 6 | Webhook | Azure Open AI account |  |
| 44 | `LZ5BqoVTwlYv3LOI` | 🚦 BP AI — Team Task Dispatcher | ✅ | 12 | Schedule | — |  |
| 45 | `milR3qpw3c9Li5xN` | 🛡️ BP Team — Mishari (Compliance) | ✅ | 11 | Webhook · فرعي | Azure Open AI account |  |
| 46 | `3B9PXV0YhcLOgMqi` | 🛰️ BP AI Space — Data API | ✅ | 19 | Webhook | ElevenLabs | ElevenLabs |
| 47 | `a8mMc7Vz6YjyHeu7` | 🛰️ Jarvis — Pulse (who is working now) | ✅ | 6 | Webhook | — |  |
| 48 | `0UKcVmH6lTTli5BN` | إيجنت التحقق من مطابقة إيصالات الدفع | ✅ | 21 | Schedule | Gmail — Business Partner — Production · Google Gemini(PaLM) Api account · Notion — Business Partner OS — Production · OpenAI account | Google Gemini(PaLM) Api account · OpenAI account |
| 49 | `qlf0NpE3OxOzN966` | وكيل الامتثال — شريك الأعمال (Compliance Agent) | ✅ | 5 | Chat | Azure Open AI account |  |
| 50 | `MbqauQQ4HQ9hwiZ7` | BP - Sync Visa Tracker to Companies Employees | ✅ | 18 | Notion | Notion OAuth2 API · Notion account |  |
| 51 | `ol6DEU2baRYENYfB` | BP — الكنس اليومي: الضمانات + متابعات CRM (تلقائي) | ✅ | 13 | Schedule | Business Partner Test · Gmail — Business Partner — Production |  |
| 52 | `jKY98dsZ9EKA8yFj` | BP — بوابة استقبال المرشحين (Candidate Intake) | ✅ | 6 | Webhook | Anthropic account · Notion OAuth2 API | Anthropic account |
| 53 | `TfsAjfMoTXc8i2uw` | BP — وكيل Outlook CVs → ATS (تفريغ 20k+) | ✅ | 23 | Schedule · يدوي | Azure Open AI account · Google Drive OAuth2 API · Notion — Business Partner OS — Production · OpenAI account · Outlook — Business Partner — Production | OpenAI account |
| 54 | `QXuY39TKC0FNQp9R` | BP — Bounce Handler (فلتر الارتداد التلقائي) | ✅ | 7 | Schedule · يدوي | Gmail — Business Partner — Production · Notion — Business Partner OS — Production |  |
| 55 | `VIxYiIVltjVwZyKw` | BP — Classify Leads (تصنيف العملاء) | ✅ | 8 | يدوي · Schedule | Notion — Business Partner OS — Production |  |
| 56 | `ess3HEXGMPnZnzLH` | BP — Email → Notion CRM + Drive + Alerts | ✅ | 24 | Gmail · يدوي · Schedule | Anthropic account · Azure Open AI account · Gmail OAuth2 API · Google Drive OAuth2 API · Google Gemini(PaLM) Api account · Notion — Business Partner OS — Production · OpenAI account · OpenRouter account · WhatsApp — Business Partner — 0507034157 | Anthropic account · Google Gemini(PaLM) Api account · OpenAI account · OpenRouter account |
| 57 | `311djGhHO9wfV6jy` | BP — Sales DB Hygiene (تنظيف قاعدة الشركات) | ✅ | 8 | يدوي · Schedule | Notion — Business Partner OS — Production |  |
| 58 | `E4DC5bIkRqFaDlhr` | BP — Website ATS Intake → AI Screening | ✅ | 25 | Webhook | Azure Open AI account · Gmail — Business Partner — Production · Google Drive OAuth2 API · OpenAI account | OpenAI account |
| 59 | `TAWrtYzs35JLfmDA` | BP — Weekly Newsletter (Sunday 10AM) | ✅ | 7 | Schedule · يدوي | Gmail OAuth2 API · Notion OAuth2 API |  |
| 60 | `fjOMfqFdUhc5DxDf` | BP-Chat-Media | ✅ | 15 | Webhook | Notion account · WhatsApp account |  |
| 61 | `eABgXmMQZcCTzatn` | BP-Chat-Monitor-API | ✅ | 18 | Webhook | Notion — Business Partner OS — Production · WhatsApp account |  |
| 62 | `B0pF8xB7b4L3hxtd` | BP-Chat-Suggest | ✅ | 12 | Webhook | Anthropic account · Azure Open AI account · Notion account · OpenAI account | Anthropic account · OpenAI account |
| 63 | `cZBWSMyOhfkIwRdL` | BP-Daily-Gov-News | ✅ | 10 | Schedule | Azure Open AI account · Gmail — Business Partner — Production · Notion account · OpenAI account · WhatsApp account | OpenAI account |
| 64 | `DEEBmcadEhrncGo4` | BP-Error-Handler | ✅ | 4 | Error | Gmail — Business Partner — Production · WhatsApp account |  |
| 65 | `oqh3CNGNcdzyiPld` | BP-Sub-Advisor | ✅ | 4 | فرعي | Business Partner Test · Notion account |  |
| 66 | `ETxqAM5VooDiDJDN` | BP-Sub-AI-Conversation | ✅ | 30 | فرعي | Azure Open AI account · Gmail OAuth2 API · Gmail — Business Partner — Production · Google Calendar — Business Partner — Production · Notion MCP OAuth2 · Notion — Business Partner OS — Production · OpenAI account · WhatsApp account | OpenAI account |
| 67 | `Sn2vTAQzU1PuWuDs` | BP-Sub-Documents | ✅ | 20 | فرعي | Azure Open AI account · Google Drive OAuth2 API · Notion account · OpenAI account · WhatsApp account | OpenAI account |
| 68 | `lX0bfeISV3g7qw7R` | BP-Sub-Menu | ✅ | 6 | فرعي | Business Partner Test · Notion account |  |
| 69 | `tIb4wNOSYVTZQuox` | BP-WhatsApp-Main (Orchestrator) | ✅ | 78 | WhatsApp | Gmail OAuth2 API · Google Calendar — Business Partner — Production · Notion — Business Partner OS — Production · WhatsApp OAuth business partner · WhatsApp account · WhatsApp — Business Partner — 0507034157 |  |
| 70 | `4HSFisd4Qq1a21g4` | BP3 — استخراج المستندات (Document Extraction B) | ✅ | 18 | فرعي · يدوي | Azure Open AI account · Google Drive OAuth2 API · Header Auth account · Header Auth account 2 · Notion — Business Partner OS — Production · OpenAI account | OpenAI account |
| 71 | `DHdxNSbhQQb1AWKg` | BP3 — قائد الامتثال (WhatsApp) ⚠️ | ✅ | 14 | فرعي · يدوي | Azure Open AI account · Notion — Business Partner OS — Production |  |
| 72 | `Y4kRUn49yn798hLi` | BP3 — واجهة API للوحة العميل (Client Portal API) | ✅ | 11 | Webhook | Header Auth account 2 · Notion — Business Partner OS — Production |  |
| 73 | `kaBWVC2iDRhgtCQZ` | BPIC - Government Updates Monitor v1 | ✅ | 28 | Schedule | Azure Open AI account · LinkedIn — Baher Magnas — Production · Notion — Business Partner OS — Production · OpenAI account | OpenAI account |
| 74 | `EJvKJwbtR2z0uhGB` | Investor Lead Pipeline (Notion + Email) | ✅ | 4 | Webhook | Gmail account · Notion OAuth2 API |  |
| 75 | `OYtiKvINZrfuCiiY` | Mahfol Makfol — AI Trip Designer | ✅ | 6 | Chat | Azure Open AI account · Google Gemini(PaLM) Api account | Google Gemini(PaLM) Api account |
| 76 | `FXyYuDiYyrSvXdvZ` | Mahfol Makfol AI Whatsapp | ✅ | 8 | WhatsApp | Azure Open AI account · Gmail — Business Partner — Production · Notion MCP OAuth2 · OpenAI account · WhatsApp OAuth account 3 · WhatsApp Send Message Mahfol Makfol | OpenAI account |
| 77 | `1YRfOoXmUYLPExTg` | RE — Matching Engine | ✅ | 5 | يدوي · Schedule | Notion OAuth2 API |  |
| 78 | `AQlkuTlh2HoC3puN` | RE — RFQ Dispatch (Approval-Gated) | ✅ | 9 | يدوي · Schedule | Gmail OAuth2 API · Notion OAuth2 API |  |
| 79 | `VkmdQrzMKQSokS1P` | Recruitment Agent — Candidate ↔ Job Matcher | ✅ | 11 | Form | Azure Open AI account · Gmail — Business Partner — Production · Notion — Business Partner OS — Production · OpenAI account | OpenAI account |
| 80 | `fbvX49CeIosMLHpU` | Recruitment Agent — Headhunter | ✅ | 25 | Form · Webhook | Azure Open AI account · Gmail — Business Partner — Production · Google Calendar — Business Partner — Production · Notion — Business Partner OS — Production · OpenAI account | OpenAI account |
| 81 | `xwM48oL1X9IcWlVy` | Recruitment Agent — Job Posting & Screening | ✅ | 44 | Form · Gmail · Webhook | Azure Open AI account · Gmail — Business Partner — Production · Google Calendar — Business Partner — Production · Notion — Business Partner OS — Production · OpenAI account · WhatsApp account | OpenAI account |
| 82 | `fUBftwquKyBuRJ0P` | 💰 حاسبة التكاليف الحكومية — Fees Calculator | — | 4 | يدوي · فرعي | — |  |
| 83 | `Ei5FY8iiLooTjEm6` | 🗂️ [معطّل — مكرر] BP3 استقبال ملفات العميل (نموذج n8n) | — | 6 | Form | Google Drive OAuth2 API · Header Auth account 2 |  |
| 84 | `JkXJJMwKqQ7TPMqx` | 🗓️ BP Marketing — Autonomous Weekly Content Planner | — | 10 | Schedule · يدوي | Notion — Business Partner OS — Production |  |
| 85 | `irYKqZctmrCMNYsH` | 🗝️ SS Setup — Clients Registry (run once) | — | 2 | يدوي | Notion OAuth2 API |  |
| 86 | `furevCegGUxcBNzi` | 🗝️ SS Setup — CompanyProfile property (run once) | — | 2 | يدوي | Notion OAuth2 API |  |
| 87 | `JGTHmdzhSrXFGtPf` | 🧪 [DEV] BP AI — Native Dispatch Verification | — | 3 | Schedule | — |  |
| 88 | `DXfVlWVFHyU7eoBE` | 🛡️ BP3 Compliance Agent V1 — Qiwa & Muqeem | — | 10 | يدوي · Schedule | Gmail account · Header Auth account · Header Auth account 2 · OpenAI account | OpenAI account |
| 89 | `bklN7C6F08NJ7TJE` | 🟢 حاسبة النطاقات — Nitaqat Calculator | — | 4 | يدوي · فرعي | — |  |
| 90 | `pP51EK66BKWcU5c7` | BP — باهر v2: استقبال → جلسة الفريق الذكي | — | 5 | Webhook | Anthropic account · Header Auth account | Anthropic account |
| 91 | `u0T7GXTB717RcwEQ` | BP — ترقيع ATS CV Text من جسم الصفحة (نوشن → نوشن) | — | 10 | يدوي | Notion — Business Partner OS — Production |  |
| 92 | `2K16p4MK8I86Glfv` | BP — جرد مرفقات Inbox/CVs (قراءة فقط) | — | 4 | يدوي | Outlook — Business Partner — Production |  |
| 93 | `qpgl9BEvt0jJt2qB` | BP — جرد Outlook CVs (قراءة فقط) | — | 8 | يدوي | Outlook — Business Partner — Production |  |
| 94 | `vomoBu7MxIY8hTIP` | BP — مزامنة الكتالوج: نوشن ⇄ اللوحة ⇄ الموقع | — | 12 | Schedule · Webhook | Notion — Business Partner OS — Production |  |
| 95 | `88NT2siAUXc1JPoY` | BP — Apollo Enrich (All sectors) | — | 13 | يدوي · Schedule | Header Auth account 3 · Notion OAuth2 API |  |
| 96 | `SWZhpsbAE2ijedV5` | BP — Backfill classification (one-shot) | — | 4 | يدوي | Notion OAuth2 API |  |
| 97 | `uSvfeWX9WgEGENPU` | BP — Company Ingest (OSM free) | — | 4 | يدوي | Notion OAuth2 API |  |
| 98 | `fzYZhTk5QMUxQ6UX` | BP — Email CRM Router & Linker | — | 16 | يدوي · Schedule | Notion OAuth2 API |  |
| 99 | `1s4xCrpyWCBhtiz1` | BP — Google Places Ingest (KSA) | — | 8 | يدوي · Schedule | Header Auth account 4 · Notion OAuth2 API |  |
| 100 | `cRnUgcqXa6tCm2hR` | BP — Reset Planned Week (إعادة بناء أسبوع) | — | 6 | يدوي | Notion — Business Partner OS — Production |  |
| 101 | `rYaoqJaYjhcX1J0r` | BP — Website Email Finder | — | 9 | يدوي · Schedule | Notion OAuth2 API |  |
| 102 | `d7a9JhgvFRI5LXQh` | BP Campaign Sender (Companies Sales DB) | — | 10 | يدوي · Schedule | Gmail OAuth2 API · Notion — Business Partner OS — Production |  |
| 103 | `P6BPDWr7A0Lv2GOf` | BP Publisher — Content Generator | — | 9 | Schedule · يدوي | Notion OAuth2 API · OpenAI account | OpenAI account |
| 104 | `mFBn4LWIpmwPPFyn` | Business Partner Campaign Launcher | — | 7 | يدوي | Gmail OAuth2 API · Notion OAuth2 API |  |
| 105 | `677Cf4tBVAPmaqMa` | Business Partner Campaign Sender | — | 6 | Schedule | Gmail OAuth2 API · Notion OAuth2 API |  |
| 106 | `3ujkx9HHwPk9zCsM` | Business Partner Email Campaign V1 | — | 5 | يدوي | Gmail OAuth2 API · Notion OAuth2 API · OpenAI account | OpenAI account |
| 107 | `7IXL4qisqAHa5AsI` | Business Partner Gmail Organizer + Notion Email Archive | — | 28 | يدوي · Gmail | Gmail account · Notion OAuth2 API · OpenAI account | OpenAI account |
| 108 | `dS8OEG8YpTmDFcy9` | Business Partner Reply Intelligence Engine | — | 11 | Gmail | Gmail OAuth2 API · Notion OAuth2 API · OpenAI account | OpenAI account |
| 109 | `FlBeLfyjQaSpPAzR` | GOSI — نِسب خصومات الاشتراكات (Engagement Deduction) | — | 9 | Webhook · فرعي | — |  |
| 110 | `cGsCRetdvRUjzp5g` | RE — Client Intake | — | 5 | Webhook | Gmail OAuth2 API · Notion OAuth2 API |  |
| 111 | `X1v0xPTlDQACNuDB` | RE — Vendor Commission Notice Campaign | — | 5 | يدوي | Gmail OAuth2 API · Notion OAuth2 API |  |

⚠️ = النسخة المنشورة (`activeVersion`) تختلف عن المسودة؛ الملف يحمل الاثنتين.

## الاعتمادات المستخدمة (بالاسم — بلا أسرار)

| الاعتماد | عدد السيناريوهات |
|---|---|
| Azure Open AI account | 43 |
| Notion OAuth2 API | 29 |
| Notion — Business Partner OS — Production | 28 |
| OpenAI account | 23 |
| Gmail OAuth2 API | 14 |
| Gmail — Business Partner — Production | 12 |
| WhatsApp account | 10 |
| Google Drive OAuth2 API | 7 |
| Notion account | 7 |
| Header Auth account 2 | 6 |
| Google Calendar — Business Partner — Production | 6 |
| Business Partner Test | 5 |
| Anthropic account | 5 |
| Notion MCP OAuth2 | 4 |
| Google Gemini(PaLM) Api account | 4 |
| Outlook — Business Partner — Production | 3 |
| Header Auth account | 3 |
| Gmail account | 3 |
| Azure Speech — Jarvis | 2 |
| WhatsApp — Business Partner — 0507034157 | 2 |
| LinkedIn account | 1 |
| Vercel — Business Partner — Production | 1 |
| WhatsApp — Muin — 0530540231 | 1 |
| ElevenLabs | 1 |
| OpenRouter account | 1 |
| WhatsApp OAuth business partner | 1 |
| LinkedIn — Baher Magnas — Production | 1 |
| WhatsApp OAuth account 3 | 1 |
| WhatsApp Send Message Mahfol Makfol | 1 |
| Header Auth account 3 | 1 |
| Header Auth account 4 | 1 |

كل اعتماد هنا يُنشأ من جديد على المثيل الجديد بالاسم نفسه (الخطوة ٤ في
`docs/n8n-to-azure-migration.md`)، ثم تُبدَّل معرّفاته في هذه الملفات قبل
الاستيراد (الخطوة ٥).
