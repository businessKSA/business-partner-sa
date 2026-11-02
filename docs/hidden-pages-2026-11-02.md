# الصفحات المخفية والمُنهاة — 2026-11-02

قرار المالك (البنود 9 و12 و13-جزء و14). النطاق: `platform-engineer`. الآلية ليست جديدة:
هي **الإخفاء المركزي** `site/data/hidden.json` (رأس `site/scripts/hidden.mjs`)، وُسِّعت بصنفٍ جديد.

## ما أُخفي وأين يذهب الزائر

| الصفحة | كل اللغات | الوجهة | الحالة | السبب |
|---|---|---|---|---|
| `/privacy` | ar · en · fr · zh (وes/hi/ja/ko/ru تسقط إلى الإنجليزية) | `/` (و`/ar` `/fr` `/zh` بلغتها) | 308 | فيها خطأ جسيم: ذكر «فرح» والصواب «المساعد» |
| `/data-deletion` | نفسها | `/` | 308 | الصفحة الخاصة المقترنة بالخصوصية |
| `/ai-agents` | نفسها | `/services` | 308 | قرار المالك |
| `/calculator` | نفسها | `/catalog` (حيث تُكوَّن السلة اليوم) | 308 | الحاسبة كاملة |
| `/account` | نفسها | `/my` | 308 | الموقع القديم يُنهى، `/my` هو الجديد |

**308 لا 302:** تحويل دائم كما طلب المالك. وعلى Vercel يأتي بـ`cache-control: public, max-age=0,
must-revalidate` (فُحص حياً على `/blog`)، فالمتصفح يعيد التحقق ولا يعلق عند إعادة الصفحة.

`/account` تحمل معاملاتها: `/account?ref=BP-…&view=documents` → `/my?ref=BP-…&view=documents`
(Vercel يمرّر الاستعلام كما هو، وتحقّقنا من ذلك على الموقع الحيّ). و`/my` يقرأ `view` و`ref` فعلاً.
المعامل القديم `?redirect=checkout|employer|…` لا يعرفه `/my` فيُهمَل ويفتح اللوحة — وصاحبه سكربتٌ
في `main.js` (الطبقة القديمة) لا يُطوَّر.

## كيف يعمل الإخفاء (بالترتيب)

1. **`generate.mjs`** يُسقط الاسم من `sitemap.xml` (عبر `isHiddenHref`) ويقلّم `nav.json`/`footer.json`
   (`pruneLinks`). الروابط إلى الصفحات **المنقولة** (`moved`، أي `/account`) **تُعاد كتابتها** إلى
   بديلها بدل حذفها؛ وإلى الصفحات **المخفية** (`pages`) تُحذف.
2. **التذييل (`simple-v1.mjs`)**: روابط الخصوصية وحذف البيانات والمستشارين مشروطة بـ`pageVisible()`.
3. **`hide-scrub.mjs`** (آخر السلسلة): شبكة أمان تحذف/تعيد كتابة أي `<a>` نجا في أي صفحة، ثم **يحذف
   ملفات الصفحات المخفية** من `site/`. تُولَّد أثناء البناء عمداً لأن سكربتات لاحقة تقرأها
   (`b10x-package-page.mjs` يشتق `b10x.html` من `ai-agents.html`؛ `client-portal-v6` و`doc-agent-portal-v7`
   يرقّعان `account.html`) — فحذفها في الآخر يحفظ الباقي دون أن يصل منها شيء إلى النشرة.
4. **`verify-pages.mjs`** يُسقط البناء إن بقي ملف صفحةٍ مخفية أو رابط `<a>` إليها.
5. **`vercel.json`**: أسطر `redirects` (بـ`statusCode`) و`headers` (بـ`X-Robots-Tag: noindex, nofollow`)
   يولّدها البناء ولا تُكتب باليد. اختبار `tests/hidden.test.mjs` يفشل إن لم تتطابق مع `hidden.json`.

**لم يُحذف أي ملف مصدر:** دوال `buildPrivacy` و`buildDataDeletion` و`buildAiAgents` و`buildCalculator`
و`buildAccount` باقية في `generate.mjs`.

## الإعادة

احذف الاسم من `pages` (وسطره من `redirects`) في `site/data/hidden.json`، ثم `npm run build`.
تعود الصفحة وروابطها والتذييل وsitemap ويزول التحويل وnoindex. لإعادة `/account`: احذفه من `moved`.

## ما بقي كما هو عمداً

- `/calculators/*` (الحكومية، نهاية الخدمة، الإجازة، الإضافي، التأمينات، فاحص المهن) و`/tools-and-calculators`:
  لم تُذكر في الطلب (المذكور `/calculator` وحدها). **قرار للمالك إن أراد إخفاءها أيضاً.**
- `api/` ولوحات `assets/data/*` المكتوبة يدوياً (compliance-dashboard وrevenue-command-center وrevenue-os)
  و`scripts/assets/admin.page.html` و`main.js` و`revenue-dashboard-v2.js`: فيها روابط نصّية إلى
  `/account…` داخل جافاسكربت أو لوحات ليست ملك هذا النطاق. **تعمل** لأن التحويل أعلاه يحمل المعاملات
  (مثلاً `/ar/account?view=compliance` → `/ar/my?view=compliance`، و`/my` فيه عرض `compliance`).
  نظّفها أصحابها في دفعاتهم (`client-portal` و`owner-ops` و`business-development` و`compliance`).
- `site/data/site.json` → `nav`: قائمة قديمة غير مقروءة من المولّد فيها `/ai-agents` و`/calculator`.

## الصفحات القانونية: اقتراح (لا قرار منفَّذ)

إخفاء `/privacy` له كلفة خارج الموقع، فقبل أي نشرٍ حيّ يُراجَع:

1. **مزوّدو الخدمة** يطلبون رابط سياسة خصوصية عاملاً عند التسجيل أو التدقيق: شاشة موافقة Google (تسجيل
   الدخول بجوجل)، وواتساب للأعمال/Meta، ومُيسّر وتمارا. إن كان أيٌّ منها مسجَّلاً بـ
   `https://businesspartner.sa/privacy` فسيصير الرابط تحويلاً إلى الرئيسية.
2. **نظام حماية البيانات الشخصية (PDPL)** يُلزم من يجمع بيانات الأفراد (والموقع يجمعها في النماذج
   والتسجيل) بإتاحة إشعار خصوصية.

**المقترح:** إصلاح الصفحة (فرح ← المساعد) ثم إعادتها خلال أيام، لا تركها مخفية. وإن أراد المالك بقاءها
مخفية من القوائم: تُنشر على مسار غير مفهرس ولا مربوط (مثل `/legal/privacy`، بـ`noindex` وبلا ظهور في
sitemap أو التذييل) ويُحدَّث رابط المزوّدين إليه — وهذا يحتاج قراره لأنه يغيّر ما يراه المستخدم عند
الموافقة. لم أنفّذه.

## للتحقق

`npm run build` ثم `LOCAL_DB=1 node site/scripts/devserver.mjs` (الخادم المحلي يطبّق redirects
`vercel.json` الآن عبر `site/scripts/vercel-redirects.mjs`):

```
curl -sI localhost:3000/privacy               # 308 → /
curl -sI "localhost:3000/ar/account?view=documents&ref=X"   # 308 → /ar/my?view=documents&ref=X
```

اختبارها: `tests/hidden-pages-1102.test.mjs` (يطابق قواعد `vercel.json` نفسها على كل صفحة × كل لغة
ويتأكد أن الوجهة صفحةٌ مبنيّة).
