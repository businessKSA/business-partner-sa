# Business Partner — قواعد العمل لكل جلسات Claude (اقرأها قبل أي تعديل)

## 1) هدف واحد للنشر: مشروع Vercel الرئيسي فقط

قرار المالك (2026-09-01): **لا عمل ولا نشر إلا على مشروع Vercel الرئيسي**:

| المشروع | المعرّف | الحالة |
|---|---|---|
| `business-partner-sa-businessksa` (الموقع + `api/`) | `prj_0QXlyAeL02QYYNrAQCfc6lRheTGp` | **الوحيد المعتمد** |
| `bp-quotes` (Root Directory: `quotes/`) | `prj_Vj1vuhZ803Bt8ETpHsOsMasVGvwt` | يُدمج في الرئيسي ثم **يُحذف نهائياً** |
| `bp-erp` (Root Directory: `erp/`) | `prj_jRpTMKArauNZLe22qOZpDMj4GtJP` | يُدمج في الرئيسي ثم **يُحذف نهائياً** |

- **ممنوع** إنشاء مشروع Vercel جديد، أو ربط مجلد جديد كمشروع مستقل، أو إضافة `vercel.json` لمجلد فرعي.
- **ممنوع** تطوير ميزات جديدة داخل `quotes/` أو `erp/` كتطبيقات مستقلة. أي عمل عليهما يكون فقط لنقل ما فيهما إلى الموقع الرئيسي (`site/` + `api/`) تمهيداً لحذفهما.
- المشاريع الثلاثة تُبنى مع كل دفعة على أي فرع، وهذا ما استنفد سقف المئة نشرة في اليوم على الخطة المجانية مراراً وعطّل إصلاحات جاهزة. لهذا يُصفّى كل شيء في مشروع واحد.
- حذف المشروعين من Vercel يتم من لوحة Vercel (Project → Settings → Delete) بعد اكتمال الدمج — لا يحذفهما Claude من نفسه، ولا يوقفهما (pause) قبل الدمج حتى لا تنقطع خدمة قائمة.
- **الوضع الحالي (2026-09-02):** `bp-erp` مجرد تحويل إلى الموقع الرئيسي ويمكن حذفه الآن. أما `bp-quotes` فما زال يشغّل لوحة العروض فعلياً؛ المسار `businesspartner.sa/quotes/*` هو **rewrite** إليه من `vercel.json` الرئيسي، وليس دمجاً. حذفه أو إيقافه الآن يكسر عروض الأسعار والعقود والفواتير حتى تُنقل جداوله ومساراته إلى `api/` + `db/` (المهمة القادمة).
- شرط التجاهل: `erp/vercel.json` لا يبني أبداً، و`quotes/vercel.json` يبني فقط إذا تغيّر `quotes/` أو `site/assets/data/catalog.json` في مدى الدفعة. لا تحذف `ignoreCommand` من الملفين.

## 2) فرع واحد و Pull Request واحد

- فرع الإنتاج للعمل: `claude/bpic-marketing-site-jvrnga`، والـ PR المفتوح هو **#271** — لا يُفتح PR آخر لهذا العمل.
- قبل كل دفعة: `git fetch` ثم `git rebase origin/claude/bpic-marketing-site-jvrnga`. تعارضات ملفات البناء (`site/**/*.html`, `site/assets/data/catalog.json`) تُحل بأخذ أي نسخة ثم `npm run build` وإعادة التوليد. بعد أي تعارض: `grep -rln "^<<<<<<< " site/ api/ db/` يجب أن يعود فارغاً.
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

**One deployment target only:** the Vercel project `business-partner-sa-businessksa` (`prj_0QXlyAeL02QYYNrAQCfc6lRheTGp`). The `bp-quotes` (`quotes/`) and `bp-erp` (`erp/`) Vercel projects are being folded into the main site and will then be permanently deleted by the owner from the Vercel dashboard. Do not create Vercel projects, do not build new features inside `quotes/` or `erp/` as standalone apps, do not pause those projects before their functionality has been merged. One branch (`claude/bpic-marketing-site-jvrnga`), one PR (#271); rebase before every push; full `npm run build`; verify every `api/` import resolves before pushing.
