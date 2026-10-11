# خطة النقل إلى Azure + جرد المشروع (Migration & Ops)

> أُعدّت 2026-09-23. لغة مبسّطة للمالك + تفاصيل تقنية للمنفّذ. مصدر الحقيقة لهذه الخطة = هذا الملف في GitHub.
> **قاعدة حاكمة:** لا نشر ولا نقل حيّ إلا بموافقة صريحة (Red). هذا الملف تخطيط وتوثيق فقط — لا ينفّذ شيئًا.

---

## 0. الحقيقة الأهم (اقرأها أولًا)

1. **الذكاء الاصطناعي يعمل على Azure بالفعل.** كل عقل المنصة = Azure OpenAI (منطقتان)، مدفوع من منحة Microsoft for Startups. لا مزود ذكاء آخر في `api/` (انظر `api/_azure.js`). أي «نقل الذكاء إلى Azure» ≈ **منجز**.
2. **بقية البنية ما زالت خارج Azure:** الاستضافة = Vercel، قاعدة البيانات = Supabase (Postgres)، الملفات/التخزين = مختلط.
3. **لا يمكن إنشاء موارد Azure من جلسة Claude الحالية** — لا توجد أداة/صلاحية Azure متصلة هنا (المتصل: Supabase, Vercel, GitHub, Notion, n8n, Make). لذلك النقل الفعلي **BLOCKED** حتى يُوصَّل دخول Azure أو ينفّذه مهندس بهذه الخطة.
4. **النقل الكامل قرار Red** (تغيير بنية رئيسية + تكلفة + احتمال توقف خدمة) → يحتاج موافقة المالك خطوة بخطوة.

---

## 1. جرد المشروع (من الكود، لا من النقاش)

| النظام | الوصف | المكان الحالي | الحالة |
|---|---|---|---|
| Website | مولّد صفحات ثابت (~1209 صفحة، متعدد اللغات) | Vercel | ✅ يعمل |
| Backend APIs | 12 دالة (`api/*.js`) — الحد الأقصى على Vercel | Vercel Functions | ✅ يعمل (حارس سليم 12/12) |
| Database | Postgres (عبر `pg`) + `db/schema.sql` | Supabase | ✅ يعمل |
| AI / Agents | `chat.js` + `_knowledge.js` + `knowledge.json` | **Azure OpenAI** | ✅ يعمل على Azure |
| WhatsApp | منطق قائمة + بوابة وكيل (`n8n/*.js`) | n8n + Logic App جاهز في `ops/azure/` | ⚠️ يعمل جزئيًا/يدوي |
| Email | Microsoft Graph (`_msgraph.js`) + معاينة محليًا | Microsoft 365 | ✅ يعمل |
| Payments | Moyasar + Tamara/BNPL (`_moyasar.js`,`_bnpl.js`) | مزودون خارجيون | ✅ يعمل |
| Invoicing / Tax | Daftra + ZATCA (`_daftra.js`,`_zatca.js`) | خارجي حكومي | ✅ يعمل |
| Identity | Nafath + OTP (`_nafath.js`,`otp.js`) | خارجي حكومي | ✅ يعمل |
| Storage (files) | طبقة Azure Blob جاهزة (`_azblob.js`) لكن غير مفعّلة كأساس | مختلط | ⚠️ جاهز غير مُحوَّل |
| Azure Postgres | طبقة جاهزة (`_azpg.js`) | كود جاهز فقط | 🟡 جاهز للتحويل |
| Cron Jobs | 3 مهام في `vercel.json` (نشرة، jobhunt، backfill) | Vercel Cron | ✅ يعمل |
| Quotes app | لوحة عروض/عقود/فواتير | مشروع Vercel منفصل (`bp-quotes`) عبر rewrite | ⚠️ ازدواج — مخطط دمجه |
| HR / ATS | `candidate/candidates/employer/hire/spaces/workspace` | Vercel + DB | ✅ يعمل |
| AI Employee Org (المدير التنفيذي + الإدارات) | خطط في `docs/*architecture*.md` | — | 🔵 مخطط فقط (غير مبني) |

---

## 2. ERRORS FOUND (المشاكل)

### E1 — لا دخول Azure في جلسة التشغيل
- **Problem:** لا أداة/صلاحية Azure متصلة بالوكيل → لا يمكن إنشاء Resource Group / Key Vault / Container Apps.
- **Impact:** كل مراحل النقل الفعلي متوقفة.
- **Fix:** توصيل حساب/صلاحية Azure للوكيل، أو تنفيذ ملفات IaC يدويًا. حتى ذلك: نجهّز كل شيء جاهزًا.
- **Status:** BLOCKED (يحتاج قرارك).

### E2 — ازدواج نشر (bp-quotes منفصل)
- **Problem:** `bp-quotes` مشروع Vercel مستقل يُوصَل عبر rewrite؛ سبق أن استنفد سقف 100 نشرة/يوم.
- **Impact:** هشاشة نشر + تكلفة.
- **Fix:** دمج `quotes/` داخل `api/`+`db/` ثم حذف المشروع من لوحة Vercel (بالترتيب، بعد الدمج). موثّق في `docs/quotes-cutover.md`.
- **Status:** Working on it (مهمة قائمة سابقة).

### E3 — فرع الإنتاج = فرع العمل (خطر نشر حيّ بلا مراجعة)
- **Problem:** الدفع لفرع العمل مع علامة النشر يصل الموقع الحيّ خلال دقيقة.
- **Impact:** نشر غير مقصود على عملاء.
- **Fix:** بوابة `ignoreCommand` في `vercel.json` (مطبّقة) — لا نشر إلا بعلامة في رسالة الكوميت. **مطبّق ويعمل.**
- **Status:** Fixed.

### E4 — لا `.env.example` موثّق على هذا الفرع
- **Problem:** لا ملف أمثلة للمتغيرات → صعوبة إعداد بيئة جديدة (مهم عند النقل لـ Azure).
- **Impact:** بطء الإعداد + احتمال نسيان متغير.
- **Fix:** توليد `.env.example` من المتغيرات المستعملة فعليًا في `api/` (مهمة Green لاحقة).
- **Status:** Working on it.

> لم تُرصد أخطاء بناء: حارس الـAPI يمرّ (47 ملفًا، 269 استيرادًا، 12/12 دالة).

---

## 3. أين الأفضل أن يعمل كل جزء؟

| الجزء | الأفضل | السبب المبسّط |
|---|---|---|
| Website | **Current (Vercel)** الآن، Azure لاحقًا اختياري | يعمل ممتاز؛ النقل لا يستعجل |
| Backend APIs | **Azure (Container Apps)** لاحقًا | تشغيل 24/7 + بلا حد 12 دالة |
| Database | **Azure Postgres** لاحقًا | توحيد على منحة Azure + نسخ احتياطي |
| AI Agent | **Azure (تم)** | يعمل الآن على Azure OpenAI |
| n8n / Automations | **Azure (Container Apps)** | يحتاج تشغيلًا دائمًا |
| Scripts / Build | **Terminal / Local** | أدوات تطوير لا تحتاج سحابة |
| Files / Storage | **Azure Blob** | الطبقة جاهزة في الكود |
| Secrets | **Azure Key Vault** | مصدر واحد آمن |
| Monitoring | **Azure Monitor + App Insights** | مراقبة موحّدة |

---

## 4. جدول النقل إلى Azure

| System | Current | Move? | Azure Service | Priority |
|---|---|---|---|---|
| AI / OpenAI | Azure | ✅ تم | Azure OpenAI | — |
| Secrets | Vercel env | ✅ Yes | Key Vault | عالية |
| Database | Supabase | ⚠️ Partial | Azure DB for PostgreSQL | عالية |
| File storage | مختلط | ✅ Yes | Blob Storage | متوسطة |
| Backend APIs | Vercel | ⚠️ Partial | Container Apps / Functions | متوسطة |
| n8n / Automation | n8n | ✅ Yes | Container Apps + Logic Apps | متوسطة |
| Queue/Workers 24/7 | لا يوجد | ✅ Yes | Service Bus + Container Apps | لبناء الـAgents |
| Monitoring | محدود | ✅ Yes | Azure Monitor / App Insights | عالية |
| Website hosting | Vercel | ❌ No (الآن) | (لاحقًا Static Web Apps) | منخفضة |
| WhatsApp / Nafath / ZATCA / Daftra / Moyasar | خارجي | ❌ No | تبقى خارجية (تُستدعى فقط) | — |

**ما يبقى خارج Azure:** المنصات الحكومية والدفع والواتساب (خدمات طرف ثالث لا تُنقل).

---

## 5. ترتيب التنفيذ (Zero-Downtime)

- **Phase 1 — Inventory & Fix:** ✅ (هذا الملف + فحص الصحة).
- **Phase 2 — Azure Foundation:** Resource Group + Key Vault + Monitor + Backup. **يحتاج دخول Azure.**
- **Phase 3 — بيئة تطوير على Azure:** بلا مساس بالإنتاج.
- **Phase 4 — البيانات:** نسخ Supabase → Azure Postgres (القديم يبقى يعمل).
- **Phase 5 — Backend:** نشر APIs على Container Apps بالتوازي.
- **Phase 6 — Automation/Agents:** n8n + Queue + Workers.
- **Phase 7 — Website:** اختياري لاحقًا.
- **Phase 8 — Cutover:** تحويل تدريجي + خطة رجوع.
- **Phases 9–10:** مراقبة ثم إغلاق القديم بعد التأكد.

**القاعدة:** لا يُطفأ القديم إلا بعد نجاح Azure. No Downtime, No Data Loss.

---

## 6. ما أحتاجه منك لفكّ التوقّف (أقل قدر)

1. **توصيل دخول Azure** للوكيل (Service Principal بصلاحية Contributor على اشتراك المنحة) — أو تكليف مهندس بتنفيذ ملفات IaC التي سأجهّزها.
2. **موافقة مبدئية** على أن الوجهة = Azure لِـ (Database + Backend + Automation + Secrets)، مع إبقاء الاستضافة على Vercel مؤقتًا.

كل ما عدا ذلك (توثيق، تجهيز ملفات، تنظيف، فحوص، مراقبة) أتابعه بنفسي دون إزعاجك.

---

## 7. ملاحظة عن «مؤسسة الموظفين الأذكياء» (Sections 26–50)

هذه رؤية كبيرة **غير مبنية بعد** (توجد كخطط في `docs/`). بناؤها الحقيقي (مدير تنفيذي ذكي + إدارات + Orchestrator + Queue + Heartbeat) يتطلب تشغيلًا دائمًا 24/7 = بنية Azure من Phase 6. لا يمكن «تشغيلها» من محادثة، لأن المحادثة مؤقتة. الأساس الموجود: طبقة Azure OpenAI + طبقات المزودين الجاهزة — نبني فوقها بعد فتح Azure.
