# خطة Azure والمنظمة الذكية — المرجع الموحّد (Source of Truth)

> **الحالة:** مسودة تشغيلية · **التاريخ:** 2026-09-23 · **المالك:** dr.baher.magnas@gmail.com
> هذا الملف هو المرجع الوحيد لخطة النقل إلى Azure وبناء المنظمة الذكية. يُحدَّث مع كل تقدم.

## القاعدتان الحاكمتان

1. **Azure غير مربوط بعد بأدوات هذه الجلسة.** لا يمكن إنشاء أي مورد على Azure قبل ربط اعتماد Azure (Service Principal / Azure MCP). كل مهمة على Azure حالتها **BLOCKED** حتى يتم الربط.
2. **النظام الحالي حيّ ويخدم عملاء** (Vercel + Supabase). لا نوقف ولا نكسر أي خدمة شغّالة. أي نقل يتم بطريقة Zero-Downtime (بناء جديد بجانب القديم، اختبار، تحويل تدريجي، إبقاء Rollback).

---

## 1) جرد الأنظمة (Inventory)

| النظام | المكان الحالي | الحالة |
|---|---|---|
| الموقع (`site/`) | Vercel — businesspartner.sa | ✅ يعمل |
| الـAPI (`api/`) | Vercel Serverless | ✅ يعمل |
| قاعدة البيانات | Supabase (Postgres) | ✅ يعمل |
| لوحة العروض (`quotes/`) | مشروع Vercel منفصل `bp-quotes` | ⚠️ يُدمج في الرئيسي ثم يُحذف |
| n8n (أتمتة) | n8n Cloud | ✅ يعمل |
| بوت واتساب الأعمال | n8n + Meta Cloud API (رقم الأعمال) | ✅ يعمل |
| «مُعين» — مساعد باهر الشخصي | n8n workflow `YgRwn40v1CqsscJw` | 🟡 مبني وغير مُفعّل (ينتظر رقم + توكن) |
| واتساب — رقم اختبار | Meta ‎+1 555‑656‑1837 (WABA `1311647421053442`) | ✅ متصل (خارجي) |
| Notion — ٧ قواعد شخصية + بيانات الشركة | Notion Cloud | ✅ يعمل |
| Gmail / Google Calendar / Google Drive | Google (خارجي) | ✅ متصل |
| GitHub | `businessKSA/business-partner-sa` | ✅ يعمل |
| المنظمة الذكية (Executive Manager, Orchestrator, Dept Managers, Agent Factory, Queues, Heartbeat) | — | 🔵 مخطط فقط (لا يوجد نظام مبني) |
| وكلاء متخصصون (مبيعات، HR ATS، وكيل مستندات) | `docs/*` خطط معمارية | 🟡/🔵 خطط، تنفيذ جزئي أو معدوم |

**قاعدة صدق:** أي بند 🔵 هو فكرة/خطة وليس نظاماً يعمل. لا نعامله كأنه جاهز.

---

## 2) الأخطاء المرصودة (ERRORS FOUND)

**E1 — Azure غير مربوط**
- Impact: يستحيل بناء أي شي على Azure الآن (منحة 100k دولار غير مُفعَّلة عملياً).
- Fix: ربط Azure بالجلسة عبر Service Principal (تطبيق + سر) أو موصّل Azure. المالك يوفّرها مرة واحدة.
- Status: **BLOCKED** (ينتظر المالك).

**E2 — «مُعين» غير مُفعّل**
- Impact: المساعد الشخصي جاهز لكن لا يستقبل رسائل.
- Fix: رقم واتساب باهر في عقدة `Owner Only` + توكن رقم الاختبار + تفعيل الـworkflow.
- Status: **BLOCKED** (ينتظر رقم + توكن من المالك).

**E3 — لا توجد بنية تشغيل 24/7 للمنظمة الذكية**
- Impact: أي «موظف ذكي» يعمل فقط ما دامت محادثة مفتوحة؛ لا Queue ولا Worker دائم.
- Fix: تُبنى على Azure (Container Apps + Service Bus + Postgres + Key Vault + Monitor) بعد E1.
- Status: **BLOCKED على E1**.

**E4 — تكرار مشاريع Vercel (`bp-quotes`)**
- Impact: يستهلك سقف النشر ويشتّت الحقيقة.
- Fix: نقل جداول/مسارات `quotes/` إلى `api/` + `db/` ثم حذف المشروع من لوحة Vercel (قرار المالك، Red).
- Status: مخطط (مهمة قائمة في CLAUDE.md).

**E5 — نسخ احتياطي غير موثّق لـSupabase**
- Impact: خطر فقد بيانات عند أي خطأ.
- Fix: تفعيل/توثيق جدول نسخ احتياطي تلقائي (Green عند توفر وصول Supabase).
- Status: مخطط.

**E6 — الأسرار موزّعة (Vercel env + n8n)**
- Impact: لا مصدر واحد للأسرار، صعب التدقيق.
- Fix: مستقبلاً → Azure Key Vault مصدراً موحّداً.
- Status: مخطط (بعد E1).

---

## 3) أين يعمل كل جزء (قرار الموضع)

| الجزء | الأفضل | السبب المختصر |
|---|---|---|
| الموقع | **يبقى Vercel** | حيّ وسريع ومربوط ببناء Vercel؛ نقله الآن خطر بلا فائدة واضحة |
| الـBackend/API | **يبقى Vercel** الآن | يعمل؛ مرشّح لـAzure Functions لاحقاً عند التوحيد |
| قاعدة البيانات | **تبقى Supabase** | Postgres يعمل؛ نقل البيانات خطر — يؤجّل بأولوية منخفضة |
| n8n | **Azure Container Apps** | هدف 24/7 مثالي، والمنحة تغطيه، وتعطينا تحكّم كامل |
| المنظمة الذكية (Queues/Workers) | **يُبنى جديد على Azure** | هنا فائدة Azure الحقيقية: تشغيل دائم |
| السكربتات/DevOps | **Terminal/Local** | أوامر وتثبيت واختبار |
| الأتمتة | **n8n الآن** → n8n-on-Azure لاحقاً | أبسط أداة متاحة |
| التفكير/التخطيط | **Claude / ChatGPT** | قيادة الأدوات والكتابة |

**الخلاصة:** لا نرحّل الموقع والـAPI الشغّالة الآن. Azure = **للجديد الدائم** (n8n مُدار + عقل المنظمة الذكية + التخزين + النسخ الاحتياطي + المراقبة).

---

## 4) هذه المحادثة (الوكيل الحالي)

**النوع: Hybrid Agent** (يميل إلى Terminal/Ops).
السبب: يراجع الكود ويعدّل المستودع، ويقود n8n وNotion عبر MCP، وسيقود Azure فور ربطه — كل ذلك من مكان واحد.

---

## 5) ترتيب النقل إلى Azure (Phased · Zero-Downtime)

- **Phase 1 — الجرد والإصلاح:** هذا الملف + إصلاح E2 (مُعين). *جارٍ.*
- **Phase 2 — أساس Azure:** بعد ربط Azure — Resource Group، Key Vault، Monitor، Networking، Backup.
- **Phase 3 — بيئة تطوير على Azure** بلا مساس بالإنتاج.
- **Phase 4 — البيانات:** نسخ (لا نقل مدمّر) قواعد/ملفات.
- **Phase 5 — Backend/Workers.**
- **Phase 6 — الأتمتة والوكلاء:** n8n على Azure + عقل المنظمة (Queue/Orchestrator).
- **Phase 7 — الموقع** (فقط إن ثبتت فائدة).
- **Phase 8 — Cutover تدريجي** مع Rollback.
- **Phase 9 — مراقبة.**
- **Phase 10 — إغلاق القديم** فقط بعد التأكد (Red — بإذن المالك).

---

## 6) المنظمة الذكية (AI Org) — الحقيقة والمسار

الرؤية (Executive AI Manager → Orchestrator/Automation Engineer/Monitoring/Agent Factory → إدارات → وكلاء) **ممتازة لكنها غير مبنية**. لا يمكن تشغيلها 24/7 بلا بنية Azure (E3).

**المسار الواقعي:**
1. نبدأ صغيراً على n8n بما هو متاح: «مُعين» = أول موظف (مساعد المالك).
2. بعد Azure: نبني «العقل» (Queue + سجل مركزي Agent Registry في Postgres + Orchestrator كخدمة Container App + Heartbeat).
3. نضيف الإدارات واحدة واحدة عند وجود حاجة تشغيلية فعلية (لا ننشئ وكيلاً بلا حاجة).

**Source of Truth للمنظمة (مستقبلاً):** المهام والسجل → Postgres على Azure · الكود → GitHub · الأسرار → Key Vault · الملفات → Azure Storage · السجلات → Azure Monitor.

---

## 7) ما نحتاجه من المالك للبدء الفعلي

1. **ربط Azure** (مرة واحدة): إنشاء Service Principal في بوابة Azure ومنحي: `Tenant ID` + `Subscription ID` + `Client ID` + `Client Secret` — أو تفعيل موصّل Azure. → يفكّ E1 وكل ما بعده.
2. **رقم واتساب باهر + توكن رقم الاختبار** → يفكّ E2 ويشغّل «مُعين» فوراً.

بدون (1) لا يبدأ أي عمل Azure. بدون (2) لا يشتغل «مُعين».

---

# English summary (for tools/sessions)

**Azure is NOT connected to this session** — no Azure resource can be created until the owner provides a Service Principal (Tenant/Subscription/Client ID + secret) or connects an Azure integration. Every Azure task is **BLOCKED** on this. The **live system (Vercel site+API, Supabase DB) must not be moved or broken**; Azure is for **new always-on infrastructure**: self-hosted n8n (Container Apps), the AI-org backend (Service Bus queue + Postgres registry + Container Apps orchestrator + Key Vault + Monitor), storage, and backups. Website/API/DB **stay where they are** for now (working, coupled, migration = risk with no clear benefit yet). The "AI organization" (Executive Manager, Orchestrator, Agent Factory, department agents) is **planned only, not built**, and cannot run 24/7 without the Azure backend. First concrete step after Azure connection: Phase 2 foundation (Resource Group, Key Vault, Monitor, Backup). Independent of Azure, "مُعين" (owner's personal WhatsApp assistant, n8n `YgRwn40v1CqsscJw`) is built but **inactive** — needs the owner's WhatsApp number + the test number's token to go live. Migrations follow zero-downtime: build beside the old, copy data, test, shift traffic gradually, keep rollback, decommission last (owner approval).
