# سجل صفحات الموقع — البوابات واللوحات

جرد من الكود على **فرع الإنتاج** `claude/bpic-marketing-site-jvrnga`
(الكوميت الحيّ `fbb148f3`) بتاريخ 2026-09-29، بعد `npm run build` كامل ناجح.
**لم يُنفَّذ أي إصلاح.**

## الأرقام الفعلية

| ما هو | العدد |
|---|---|
| صفحات HTML في الجذر `site/*.html` | **74** |
| كل صفحات HTML في `site/` | **1500** |
| ملفات `api/` | **48** (منها **11** دالة — بقي سلوت واحد من ١٢) |
| خطوات `npm run build` | **21** |
| صفحات الجذر التي تحمل ترويسة الموقع الموحّدة `<header class="sv1-hdr">` | **66** |
| صفحات الجذر بلا ترويسة موقع | **8** |

> أرقام التكليف السابق (65 صفحة جذر · 1222 صفحة · 40 ملف API · 19 خطوة ·
> «1209 pages») لم تعد صحيحة. وسطر نجاح البناء الحقيقي الآن:
> **«B10X cache key updated on 1495 pages»**.

### تنبيه على طريقة القياس

الجرد السابق قال «٦٠ من ٦٥ صفحة تستعمل `site-header` و`site-footer`». هذا
القياس **مضلّل**: الاسم `site-header` لم يبقَ في الصفحات المبنيّة كعنصر، بل
يظهر داخل قاعدة CSS واحدة لوضع `bp-embed` تُحقن في معظم الصفحات. الترويسة
الفعلية بعد البناء هي `<header class="sv1-hdr">` يكتبها
`simplified-global-header.mjs`. أي قياس على `site-header` يعدّ سطر CSS لا ترويسة.

## الثماني صفحات خارج ترويسة الموقع

كلها **noindex** — لا واحدة منها صفحة تسويقية عامة. وهي ثلاث حالات مختلفة
لا حالة واحدة:

| الصفحة | قوقعة خاصة | الشعار | «Business Partner» | الحكم |
|---|---|---|---|---|
| `account.html` | ✅ قوقعة تطبيق (`sideNav` + `bnav`) | ✅ | ٢٢ | **قصديّة** — مركز عمليات العميل، ١٠٩ روابط داخلة، ورقعتان تعتمدان عليها |
| `admin.html` | ✅ (`navDesk`) | ✅ ×٣ | ٦ | **قصديّة** — قوقعة إدارة، رقعة `v8` تعتمد عليها |
| `chat.html` | ✅ ٦ ترويسات + ملاحة | شعار SVG داخلي | ١٠ | **قصديّة ومكتوبة في الكود**: «بلا رأس ولا تذييل، noindex، وغير موصول من أي مكان» — تجربة المالك |
| `connect.html` | ❌ بلا ملاحة | ✅ | ٣ | موسومة، لكن لا طريق للعودة للموقع |
| `monitor.html` | ❌ بلا ملاحة | ✅ ×٢ | ٣ | موسومة، لكن لا طريق للعودة — ونسخة **مطابقة بايت-ببايت** لمصدرها |
| `portal.html` | ❌ بلا ملاحة | ✅ | ٢ | موسومة، لكن لا طريق للعودة |
| `dashboard.html` | ❌ | ❌ | ١ | **يتيمة فعلاً — بلا شعار** |
| `doc-agent-admin.html` | ❌ | ❌ | **صفر** | **يتيمة فعلاً — بلا شعار وبلا اسم العلامة** |

**الخلاصة التي يغيّرها هذا الجرد:**

- المخالفتان للهوية حقاً **اثنتان**: `dashboard.html` و`doc-agent-admin.html`.
- وخمس صفحات (`connect`, `monitor`, `portal`, `dashboard`, `doc-agent-admin`)
  بلا أي ملاحة — الزائر فيها لا يجد طريقاً للعودة إلى الموقع. هذا عيب
  استخدام حقيقي ومستقل عن الهوية.
- وثلاث (`account`, `admin`, `chat`) قوقعاتُ تطبيقٍ مقصودة وموسومة بالشعار.
  **إدخالها في ترويسة الموقع التسويقي يضرّها ولا ينفعها.**

## من أين تأتي هذه الصفحات

| الصفحة | المصدر |
|---|---|
| `monitor.html` | نسخ خام من `site/scripts/assets/monitor.page.html` (مطابق تماماً) |
| `admin.html` | نسخ خام من `assets/admin.page.html` |
| `account.html` | نسخ خام من `assets/account.page.html` + حقن `GOOGLE_CLIENT_ID` |
| `chat.html` | نسخ خام من `assets/chat.page.html` |
| `dashboard.html` | دالة `buildDashboard()` داخل `generate.mjs` |
| `doc-agent-admin.html` | دالة `buildDocAgentAdmin()` داخل `generate.mjs` |

## لماذا تبقى خارج الترويسة — الشرط الصريح

`simplified-global-header.mjs` لا «ينسى» هذه الصفحات، بل **يستثنيها بشرط مكتوب**:

```js
const hasHeader = html.includes('<header class="site-header">');
const hasFooter = html.includes('<footer class="site-footer">');
if (!hasHeader && !hasFooter) continue;
```

وتعليق الكود فوقه يشرح القصد: صفحات SV1 تحمل ترويستها من `SV1.shell()`،
و«لوحات `site-header portal-header` لا تُلمس (ليست من هذا النطاق)».

فالسكربت يرقّي ما يجد له ترويسةً قديمة فقط. ومن لا ترويسة له أصلاً — الثماني
أعلاه — يُتخطّى. **هذا هو موضع القرار، لا الصفحات نفسها.**

## طبقات إعادة التصميم — أضيق مما كان يُظن

ليست طبقات عامة على الموقع، بل رقعٌ على ملفات مسمّاة بالاسم:

| السكربت | الأسطر | يعدّل |
|---|---|---|
| `client-portal-v6.mjs` | ٣٣ | `site/ar/account.html` فقط |
| `doc-agent-portal-v7.mjs` | ٤١٤ | `site/ar/account.html` + `site/account.html` |
| `compliance-dashboard-v6.mjs` | ٨١ | `site/ar/compliance-dashboard.html` فقط |
| `admin-command-center-v8.mjs` | ٨٠ | `site/admin.html` فقط |

### ⚠️ الخطر الحقيقي: الرقع تنجح شكلاً وتموت مضموناً

الأربعة لا تتعلّق ببنية الصفحة عند **الحقن**: كلها تحقن عند `</head>` و`</body>`
وهما في كل صفحة. فالحقن نفسه متين ولن يفشل.

لكن **المحقون** مكتوب بالكامل على بنية تلك الصفحات بالذات — محدّدات مثل
`.side` و`.mainc` و`.topbar` و`.viewwrap` و`#sideNav [data-v]` و`#view-home`
و`#topOrgName`، ومعها كومة `!important`.

فلو نُقلت الصفحة إلى قالب آخر: يبقى الحقن ناجحاً، ويُطبع «applied»، وينجح
البناء — و**كل محدّد يفقد هدفه، فيتبخّر التصميم بهدوء**. وهذا أسوأ من فشلٍ
صريح، لأن لا شيء يشتكي.

و`verify-pages.mjs` يفحص **نحو الجافاسكربت فقط** لا البنية، فلا يمسك هذا.
وتعليقه في رأسه يذكر عطلاً مشابهاً وصل الإنتاج فعلاً: «فتُفتح بوابة العميل
على ترويسة وتذييل بلا شيء بينهما. البناء كان ينجح، والصفحة تُنشر، ولا شيء
يقول إن اللوحة ماتت.»

ولهذا فإن `account.html` — ١٠٩ روابط داخلة، ورقعتان (٣٣ + ٤١٤ سطراً) تعتمدان
على قوقعتها — **أخطر صفحة في المستودع من ناحية إعادة الهيكلة، وأقلّها ربحاً منها.**

## التصحيحان من التكليف — تأكّدا من `vercel.json`

1. `portal.html` و`portal/index.html` لا تتصادمان: الثانية تُوجَّه بشرط
   `has: host` على `hr.businesspartner.sa`. خدمتان منفصلتان. ✅
2. لوحتا `assets/data/` ليستا في مكان خاطئ: `/client-portal` و
   `/business-development-dashboard` تُحوّلان عمداً إلى
   `/assets/data/revenue-command-center`. ✅

## الـ66 صفحة داخل الترويسة الموحّدة

ترث الهوية تلقائياً من `simplified-global-header.mjs`، ولا تحتاج عملاً هنا:

about · agencies-admin · agency-portal · ai-agents · ai-document-agent · b10x ·
bank-account · business-development · calculator · candidate-profile · careers ·
cart-classic · cart · catalog · checkout-classic · checkout · classic-home ·
compliance-agent · consultation-classic · consultation · contact · contract ·
data · deals · directory · employer-dashboard · employer-join · employer-login ·
employer · employers · estrdad · farina · formation-contract · hiring · hr ·
index · job-search-service · job · jobsearch-admin · knowledge-center ·
magazine · mahfol-makfol · my · news · newsletter · opportunities · ops ·
packages · partner-dashboard · quote · recruitment-agencies · saudi-arabia ·
services · shared-services · simple-v1 · smart-employee · suppliers-admin ·
suppliers · task-force · terms · tools-and-calculators · tourism · trips ·
worker-housing · workspace-request · workspaces

## حالة الفروع (للعلم)

فرع الإنتاج `claude/bpic-marketing-site-jvrnga` متقدّم على `master` بـ**٦٨
كوميتاً**. النشرات الحيّة كلها تأتي من فرع العمل لا من `master` — تأكّد ذلك
من لوحة Vercel: آخر نشرة إنتاج `dpl_A65XdjRchsHw4exVkFkrbydZtKC6` من الكوميت
`fbb148f3` على فرع العمل. فبوابة `ignoreCommand` والعلامة `deploy-preview-please`
هما ما يفصل الدفع من النشر.
