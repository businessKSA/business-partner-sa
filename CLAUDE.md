# Business Partner — قواعد العمل لكل جلسات Claude (اقرأها قبل أي تعديل)

## 0) أين تقرأ حالة المنظومة قبل أن تبدأ

تدقيق كامل لسبتمبر 2026 — ما بُني، وما عُلّق، وخرائط الوكلاء والتحكم والتكاملات، وجرد السيران والاعتمادات والروابط:
<https://claude.ai/code/artifact/9af225cc-9ec9-45ae-b977-408053f452cf>

أرقام محسومة فيه ولا تُخمَّن: **101 سير عمل** في n8n (83 نشطاً)، لا 18 — الـ18 هي الموسومة `AI Team` وحدها. و**35 اعتماداً**، فيها اعتماد OpenAI ميت واعتماد `Header Auth account 2` مكسور. و`api/` بلغ سقف **12 دالة** بالضبط.

والبنية الحرجة: المدراء الـ12 **لا مؤقّت لأيٍّ منهم** — كلهم يستيقظون حين يناديهم الموزّع `LZ5BqoVTwlYv3LOI` كل خمس دقائق. توقُّفه يوقف الشركة كلها.

## 1) هدف واحد للنشر: مشروع Vercel الرئيسي فقط

قرار المالك (2026-09-01): **لا عمل ولا نشر إلا على مشروع Vercel الرئيسي**:

| المشروع | المعرّف | الحالة |
|---|---|---|
| `business-partner-sa-businessksa` (الموقع + `api/`) | `prj_0QXlyAeL02QYYNrAQCfc6lRheTGp` | **الوحيد المعتمد** |
| `bp-quotes` (Root Directory: `quotes/`) | `prj_Vj1vuhZ803Bt8ETpHsOsMasVGvwt` | يُدمج في الرئيسي ثم **يُحذف نهائياً** |
| ~~`bp-erp`~~ | — | **حُذف نهائياً (2026-09-04)** من لوحة Vercel، ثم حُذف `erp/` من المستودع. لا تعده. |

- **ممنوع** إنشاء مشروع Vercel جديد، أو ربط مجلد جديد كمشروع مستقل، أو إضافة `vercel.json` لمجلد فرعي.
- **ممنوع** تطوير ميزات جديدة داخل `quotes/` كتطبيق مستقل. أي عمل عليه يكون فقط لنقل ما فيه إلى الموقع الرئيسي (`site/` + `api/`) تمهيداً لحذفه. (`erp/` لم يعد موجوداً.)
- المشاريع الثلاثة تُبنى مع كل دفعة على أي فرع، وهذا ما استنفد سقف المئة نشرة في اليوم على الخطة المجانية مراراً وعطّل إصلاحات جاهزة. لهذا يُصفّى كل شيء في مشروع واحد.
- حذف المشروعين من Vercel يتم من لوحة Vercel (Project → Settings → Delete) بعد اكتمال الدمج — لا يحذفهما Claude من نفسه، ولا يوقفهما (pause) قبل الدمج حتى لا تنقطع خدمة قائمة.
- **الوضع الحالي (2026-09-16):** `bp-erp` حُذف من اللوحة ثم من المستودع — بقي مشروعان. وقرار المالك في 2026-09-16: **`bp-quotes` يندمج في الرئيسي ولا يُستخدم مرة ثانية**. أُنجز من الدمج كل ما لا يحتاج قاعدة اللوحة:
  - `‏/api/live-catalog` لم يَعُد تمريرةً إلى اللوحة — يُخدَم من `site/assets/data` عبر `api/_quotes.js`. **التبعية انتهت.**
  - `‏/quotes/d/<token>` صار يمرّ بالموقع أولاً: ما في `legacy_doc_links` يُخدَم من `requests`، وما سواه يُحوَّل ٣٠٢ إلى اللوحة ما دامت حيّة، وبعد حذفها يُضبط `QUOTES_PANEL_RETIRED=1` فتظهر صفحة ٤١٠ تدلّ العميل على حسابه.
  - قسم «عروضي وعقودي» في `/account` صار يقرأ قاعدتنا أولاً واللوحة ثانياً، فلا يموت بموتها.
  - بقي **نقل التاريخ** وحده، ويحتاج `DATABASE_URL` الخاص باللوحة: `quotes/scripts/export-for-main.ts` ثم `ops/quotes-import.mjs`. يشغّلهما المالك بنفسه — لا يُطلب السرّ في محادثة.
  ما زال حذف اللوحة أو إيقافها **قبل** النقل يكسر عروض الأسعار والعقود والفواتير. التفصيل والترتيب في `docs/quotes-cutover.md`.
- شرط التجاهل: `quotes/vercel.json` يبني فقط إذا تغيّر `quotes/` أو `site/assets/data/catalog.json` في مدى الدفعة. لا تحذف `ignoreCommand` منه، ولا تحذف مجلداً هو جذرُ مشروع Vercel قائم — احذف المشروع من اللوحة أولاً (هذا ما جرى مع `erp/`).
- **المشروع الرئيسي كذلك صار له `ignoreCommand` (2026-09-04):** يبني تلقائياً
  على `master` و`staging` وفي الإنتاج فقط. أي فرع آخر لا ينشر إلا إذا احتوت
  رسالة آخر كوميت على العلامة المتفق عليها (انظر `ignoreCommand` في
  `vercel.json`). هذا هو حل «اللخبطة» وسقف المئة نشرة: الفروع تُدفع بحرية،
  والمعاينة تُطلب عمداً. لحذفه أثر مباشر على الفاتورة والسقف.
- **لا تكتب العلامة في رسالة كوميت إلا وأنت تريد نشرة فعلاً.** أول محاولة
  استعملت `[preview]` فطابقت الكوميت الذي يشرحها نفسه وبنَت بلا داعٍ؛ لذلك صارت
  العلامة كلمة لا تَرِد في الكلام العادي، والمطابقة نصية `grep -qF` بلا أنماط.

- **`bp-ai-space` حُذف من Vercel (قرار المالك 2026-09-20).** كان **مشروع Vercel
  رابعاً** لا تذكره هذه القائمة أصلاً — يُنشر باليد لأن `config.js` لا يدخل
  المستودع العام، وحمايته Vercel Authentication لا بوابة مالك. بديله
  **Azure Static Web Apps** (البند ٢٫٦: Azure أولاً) خلف تسجيل دخول Entra
  بالدور `owner`، والنشر آلي من `.github/workflows/azure-ai-space.yml`.
  `config.js` يُكتب في الـrunner من سرّ `AI_SPACE_CONFIG` ولا يُكتب في git أبداً.
  مجلد `ai-space/` بقي في المستودع لكن `ai-space/vercel.json` حُذف — لم يعد له
  مشروع. الدرس نفسه المتكرر: أي مجلد يصير جذر مشروع Vercel يخلق هدف نشر
  إضافياً يستهلك من سقف المئة نشرة، فيُحذف المشروع من اللوحة أولاً ثم تُنظَّف
  ملفاته.
- وللتذكير: اللوحة التشغيلية موجودة أصلاً داخل n8n بلا أي استضافة —
  `6jgqpWlBRbyncwTC` يخدم صفحة HTML كاملة (الأقسام، المهام، الصفقات، المؤشرات،
  تشغيل/إيقاف الوكلاء) على
  `‏/webhook/bp-ai-control-j8PUwUks3morvPEaHyx5aNGfjlsbEm66`. حمايتها سرّية
  الرابط فقط، ولهذا نُقلت اللوحة الأساسية إلى Azure ببوابة حقيقية.

## 2) فرع واحد و Pull Request واحد

- فرع الإنتاج للعمل: `claude/intelligent-agents-collaboration-y788ck`، والـ PR المفتوح هو **#315** — لا يُفتح PR آخر لهذا العمل.
- **تصحيح 2026-09-23:** كان هذا البند يقول الفرع `claude/bpic-marketing-site-jvrnga` والطلب **#271**. و**#271 دُمج فعلاً في 2026-09-04** (`merged_at`)، فبقي البند يوجّه الجلسات إلى فرعٍ وطلبٍ منتهيين تسعة عشر يوماً. الطلب المدموج لا يُعاد استعماله ولا يتتبّع عملاً جديداً. تحقّق من الفرع بـ`git rev-parse --abbrev-ref HEAD` قبل أن تصدّق أي اسم مكتوب هنا.
- قبل كل دفعة: `git fetch` ثم `git rebase origin/claude/intelligent-agents-collaboration-y788ck`. تعارضات ملفات البناء (`site/**/*.html`, `site/assets/data/catalog.json`) تُحل بأخذ أي نسخة ثم `npm run build` وإعادة التوليد. بعد أي تعارض: `grep -rln "^<<<<<<< " site/ api/ db/` يجب أن يعود فارغاً.
- **لا تدفع أبداً إلى فرع آخر** دون إذن صريح من المالك.

## 2.5) التطوير المحلي أولاً (قرار المالك 2026-09-04)

- **لا نشرة على Vercel مع كل تعديل.** العمل على `localhost` أولاً: `npm run dev`
  ثم `http://localhost:3000`. تُطلب معاينة Vercel عند محطة مستقرة فقط أو حين
  يطلبها المالك. التفاصيل في `docs/local-development.md`.
- `LOCAL_DB=1` يحوّل قاعدة البيانات إلى ملف JSON تحت `.localdb/`؛ الخادم يرفض
  الإقلاع إن أُطفئ بلا `LOCAL_ALLOW_REMOTE_DB=1` حتى لا يُطوَّر على بيانات
  عملاء حقيقية.
- `api/_mode.js`: محلياً الدفع اختبار، تمارا رمليّة، واتساب محاكى، البريد
  معاينة، العقد اختبار. لا بطاقة تُخصم ولا رسالة تصل عميلاً.
- حسابات محلية: `client@test.local` و`admin@test.local` بالرمز `123456`،
  ومفتاح اللوحة `test-ops`.

## 2.6) كل ما يستهلك رصيداً يتحوّل إلى Azure (قرار المالك 2026-09-15)

**القاعدة الحاكمة: لا يُشحن رصيد على أي مزوّد بعد اليوم.** رصيد
Microsoft for Startups (100,000 دولار، ينتهي 8 سبتمبر 2028، وله مهلة تفعيل
ثلاثة أشهر من 8 سبتمبر 2026) هو مصدر التمويل الوحيد لكل استدعاء مدفوع.

**الترتيب الإلزامي عند اختيار أي محرّك أو خدمة:**

1. **Azure أولاً** — إن وُجدت خدمة Azure تؤدي الغرض فهي الخيار، ولو كان
   غيرها أسهل. المحرّك اللغوي: `Azure OpenAI`. الصوت: `Azure Speech`.
   الاستضافة: `Azure Container Apps`. البحث الدلالي: `Azure AI Search`.
2. **مجاني حقيقي** — Groq وGemini، وهما احتياطي عند نفاد حصة Azure لا أساس.
3. **مدفوع خارج Azure** — **ممنوع**. لا OpenAI ولا Anthropic ولا OpenRouter
   ولا ElevenLabs بحساب مدفوع، ولا أي اشتراك جديد. من احتاج واحداً منها
   فليطلب قراراً صريحاً من المالك قبل أي ربط.

**ممنوع صراحةً:** إضافة وسيلة دفع جديدة، أو ترقية خطة، أو تفعيل فوترة
استخدام، أو ربط بطاقة بأي مزوّد — بما فيها Vercel وn8n وNotion — دون إذن
المالك المكتوب في الشات.

**مراقبة الاستهلاك واجبة:** يُضبط Budget Alert في Azure Cost Management.
سقف المئة نشرة اليومي في Vercel وسقف 8000 توكن/دقيقة في Groq درسان
مدفوعان: المنظومة تُبنى أسرع مما تحتمله مواردها، فالحدّ يُراقَب قبل أن
يُضرب لا بعده.

**فريق الوكلاء أُعيد بناؤه على Azure (قرار المالك 2026-09-17).** كان على
`Claude Managed Agents` وهي مدفوعة من Anthropic فتخالف هذه القاعدة نفسها؛
فحُذفت تلك الطبقة وبُني البديل في `agents/azure/`: العقل `Azure OpenAI`،
والمنطق كودٌ في git، والجولات `Azure Container Apps Jobs`، والحالة Supabase
(قاعدة الموقع نفسها). و`n8n` نزل من «العقل والمنسّق» إلى **طبقة موصّلات**
فقط (واتساب وLinkedIn وGmail) لأن تفويضاتها تعمل، ويُقلَّص كلما بُنيت أداة
هنا. والحوكمة صارت في الكود لا في البرومبت: `commitmentIn()` في
`agents/azure/tools.mjs` يرفض أي رسالة فيها سعر أو ضمان أو خصم قبل الشبكة،
وتُسجَّل `pending_approval`. التفاصيل في `agents/README.md`.

**حقل `model` في Azure هو اسم النشر (deployment) لا اسم الموديل** — الخلط
بينهما أعطى `could not be found` مرتين وأوقف التحويل يوماً كاملاً.

**التحويل عن Groq تمّ وتُحقِّق منه (2026-09-19).** القيم المحسومة:

| المفتاح | القيمة |
|---|---|
| المورد | `bp-ai-ksa-2026` — Azure OpenAI، Sweden Central، مجموعة `bp-ai` |
| النشر (`model`) | **`bp-main`** (وهو `gpt-4.1`) |
| الاعتماد في n8n | `hA1ULr5qtFuoBZ6B` — «Azure Open AI account»، Classic، `2025-03-01-preview` |

المورد الثاني `drbahermagnas-6763-resource` (مشروع Foundry، East US 2) جدول
`Deployments` فيه **فارغ** — ولهذا وحده توقّف العمل يومين. لا تستعمله حتى
يُنشر فيه شيء.

وكل سير مديرٍ صار فيه عقدة `Azure OpenAI (bp-main)` على المدخل **٠**
و`Gemini` على المدخل **١** احتياطياً، وحُذفت عقد Groq. التحقق تمّ بتنفيذين
حقيقيين لا بقراءة إعداد: «مُعين» (`108283`) وبدر (`108284`)، وكلاهما رجّع
`engine_fallback: false` وصفر `tool_calls` على رسالة اختبار تمنع أي تعديل.
و٩٦٢ تنفيذاً ناجحاً لسير الفريق منذ 02:30Z (لا للمنصة كلها — انظر أسفله)، وحلقة المتابعة
`k5vtioWWKC2i1W0n` صارت منشورة وتعمل كل عشر دقائق.

**اللوحة جُرّبت من طرفٍ إلى طرف (2026-09-19، التنفيذ `108333`).** نفس مسار
`ai-space`: ويبهوك `Command Space Direct In` ← «مُعين» ← `Return Dashboard
Reply` ← ٢٠٠ JSON. `Azure OpenAI (bp-main)` نفّذ جولتين (٢٥٨٤ ثم ٢٦١٢٩
توكن)، وGemini الاحتياطي لم يعمل، وعقدة «سبب تعذّر الرد» لم تعمل، والرد جاء
بصيغة `VOICE/[[DETAILS]]` الصحيحة. ملاحظة تشغيلية: حاوية الجلسة لا تصل
`businesspartnerai.app.n8n.cloud` (الوكيل يردّ ٤٠٣ على CONNECT)، فالاختبار
المكافئ يُجرى عبر `mcp__n8n__execute_workflow` على نفس عقدة الويبهوك.

**سيران كانا يفشلان يومياً وأُصلحا في الجلسة نفسها:**

| السير | العطل | الإصلاح | التحقق |
|---|---|---|---|
| `kaBWVC2iDRhgtCQZ` — BPIC Government Updates Monitor | ثلاث عقد `gpt-4o` على حساب OpenAI مدفوع — مخالفة صريحة لهذا البند | عقدة `Azure OpenAI (bp-main)` واحدة تغذّي الوكلاء الثلاثة؛ عقد OpenAI بقيت مفصولة لا محذوفة | التنفيذ `108338` ناجح، وAzure ظهر في `runData` وOpenAI لم يظهر |
| `OfesoKDnsVO1IdEk` — محلل ملفات العملاء | اعتماد `httpHeaderAuth` قيمته بلا `Bearer` فيردّ Notion ٤٠١ كل يوم 07:30 | العقدتان صارتا `predefinedCredentialType` + `notionOAuth2Api` | التنفيذ `108348` ناجح وكتب فعلاً في صفحة العميل |

الدرس: «صفر أخطاء» تُقاس بفلترة `status=error` على المدى كله، لا على سيرٍ
واحد. البحث عن الأخطاء كشف مخالفة تمويل حيّة لم يكشفها أي سير أخضر.

**عند تحويل سير عمل إلى Azure:** تُستبدل عقدة المحرّك وحدها — كل مدير في
`n8n` له عقدة محرّك واحدة تغذّي `AI Engine` وكل متخصصيه، فاستبدالها يُصلح
الإدارة كاملة. لا تُحذف عقدة المحرّك القديمة إلا بعد التحقق من تنفيذ حقيقي
ناجح (`engine_fallback: false`).

## 3) البناء والتحقق

- البناء الكامل: `npm run build` (16 خطوة؛ النجاح = «B10X cache key updated on 1209 pages»). لا تشغّل `generate.mjs` وحده.
- **حارس الـAPI يعمل تلقائياً** أول خطوة في `npm run build` (`site/scripts/verify-api.mjs`): يفحص نحو كل ملف في `api/`، ويتأكد أن كل اسم في `import { ... } from "./_x.js"` مُصدَّر فعلاً، وأن الدوال ١٢ فأقل، وألا تكون علامات تعارض دمج قد نجت في `api/` أو `db/` أو `site/scripts/`. فشله يُسقط البناء، فتبقى النشرة السابقة السليمة حيّة — عطلٌ في البناء بدل عطلٍ في الإنتاج. لا تحذفه ولا تنقله من أول السلسلة.
- `api/` محدود بـ 12 دالة على Vercel — الملفات المساعدة تبدأ بـ `_` (مثل `api/_trial.js`). هذان الصنفان أسقطا الـAPI كله بـ500 مرتين: **صادر مفقود** (2026-09-01)، و**تعريف مكرّر** نجا من دمج master (2026-09-02، الكوميت `4b8947fa8`) — وتكرار تعريف دالة في وحدة ES خطأ نحوي يمنع تحميلها، فيسقط معها كل مستورديها. الحارس يمسك الاثنين الآن.
- لا تقل «صار حياً» قبل أن تكون نشرة Vercel بحالة READY وتُفحص الصفحة الحية.

## 4) سياسات المحتوى الثابتة

- الأسعار من الكتالوج بالـSKU فقط، ولا تُخترع أسعار أو معلومات حكومية. `SHOW_PRICES=false` (الأسعار للمسجّلين فقط).
- لا أزرار واتساب داخل محتوى الصفحات — فقط الزر العائم. **استثناء واحد
  بأمر المالك (2026-09-04):** زر «أرسل طلبي على واتساب» داخل «مشخّص الخدمة»
  في صفحات `/services/*` (`site/scripts/service-advisor.mjs`)، لأن الملخّص
  المكتوب هو ناتج المشخّص نفسه.
- اسم العلامة الظاهر «Business Partner» في كل اللغات بالشعار الرسمي — لا
  «شريك الأعمال» ولا «شريك أعمالك» (قرار المالك 2026-09-04، طبقة Simple V1).
- التسمية: «المستشار الذكي» وعائلتها، وليس «الوكيل» (باستثناء المسميات المهنية الرسمية و«وكيل محفول مكفول» والتوكيل القانوني).
- المخالفات: مراجعة / دراسة أهلية الاعتراض / تجهيز / تقديم / متابعة — لا وعد بالإلغاء.
- لا تُكتب أسرار في Notion أو في الملفات المدفوعة.
- المالك (`dr.baher.magnas@gmail.com`) لا يرى أي فترة تجريبية على أي خدمة، وكل البوابات تُفتح بجلسة الحساب بلا رموز (`api/_trial.js`: `OPEN_ACCESS`, `openFor`).

---

# English summary for tools that read this file

**Local-first (2026-09-04):** develop on `npm run dev` → http://localhost:3000
with `LOCAL_DB=1` (JSON file under `.localdb/`, production Supabase untouched)
and every integration in a safe mode (`api/_mode.js`). Vercel previews are for
stable milestones only, never after every change. See `docs/local-development.md`.

**Azure pays for everything (owner decision 2026-09-15):** the Microsoft for
Startups grant ($100,000, expires 8 Sept 2028, activate within 3 months of
8 Sept 2026) funds every paid call. Order of preference for any engine or
service: (1) Azure — `Azure OpenAI` for LLMs, `Azure Speech` for voice,
`Azure Container Apps` for hosting, `Azure AI Search` for retrieval;
(2) genuinely free tiers (Groq, Gemini) as fallback only, never as the base;
(3) paid non-Azure — **forbidden**. Never add a payment method, upgrade a
plan, enable usage billing or attach a card to any provider — Vercel, n8n and
Notion included — without the owner's explicit written approval in chat. Set a
Budget Alert in Azure Cost Management. When migrating a workflow, swap only
the model node: each n8n manager has ONE model node feeding its `AI Engine`
and every specialist, so replacing it fixes the whole department; keep the old
node until a real run returns `engine_fallback: false`.

**One deployment target only:** the Vercel project `business-partner-sa-businessksa` (`prj_0QXlyAeL02QYYNrAQCfc6lRheTGp`). The `bp-quotes` (`quotes/`) Vercel project is being folded into the main site and will then be permanently deleted by the owner from the Vercel dashboard; `bp-erp` was deleted from the dashboard on 2026-09-04 and `erp/` then removed from the repository — in that order, because removing the root directory of a live project fails every build at container init, before `ignoreCommand` is ever read. Do not create Vercel projects, do not build new features inside `quotes/` as a standalone app, do not pause those projects before their functionality has been merged. One branch (`claude/intelligent-agents-collaboration-y788ck`), one PR (#315 — #271 was merged on 2026-09-04 and must not be reused); rebase before every push; full `npm run build`; verify every `api/` import resolves before pushing.
