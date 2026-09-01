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

## 2) فرع واحد و Pull Request واحد

- فرع الإنتاج للعمل: `claude/bpic-marketing-site-jvrnga`، والـ PR المفتوح هو **#271** — لا يُفتح PR آخر لهذا العمل.
- قبل كل دفعة: `git fetch` ثم `git rebase origin/claude/bpic-marketing-site-jvrnga`. تعارضات ملفات البناء (`site/**/*.html`, `site/assets/data/catalog.json`) تُحل بأخذ أي نسخة ثم `npm run build` وإعادة التوليد. بعد أي تعارض: `grep -rln "^<<<<<<< " site/ api/ db/` يجب أن يعود فارغاً.
- **لا تدفع أبداً إلى فرع آخر** دون إذن صريح من المالك.

## 3) البناء والتحقق

- البناء الكامل: `npm run build` (16 خطوة؛ النجاح = «B10X cache key updated on 1209 pages»). لا تشغّل `generate.mjs` وحده.
- `api/` محدود بـ 12 دالة على Vercel — الملفات المساعدة تبدأ بـ `_` (مثل `api/_trial.js`). بعد أي تعديل في `api/`: `node --check` لكل ملف، وتأكد أن كل `import { ... } from "./_x.js"` يجد صادراته (فقدان صادر واحد يُسقط كل الـAPI بـ500 عند التحميل — حدث فعلاً في 2026-09-01).
- لا تقل «صار حياً» قبل أن تكون نشرة Vercel بحالة READY وتُفحص الصفحة الحية.

## 4) سياسات المحتوى الثابتة

- الأسعار من الكتالوج بالـSKU فقط، ولا تُخترع أسعار أو معلومات حكومية. `SHOW_PRICES=false` (الأسعار للمسجّلين فقط).
- لا أزرار واتساب داخل محتوى الصفحات — فقط الزر العائم.
- التسمية: «المستشار الذكي» وعائلتها، وليس «الوكيل» (باستثناء المسميات المهنية الرسمية و«وكيل محفول مكفول» والتوكيل القانوني).
- المخالفات: مراجعة / دراسة أهلية الاعتراض / تجهيز / تقديم / متابعة — لا وعد بالإلغاء.
- لا تُكتب أسرار في Notion أو في الملفات المدفوعة.
- المالك (`dr.baher.magnas@gmail.com`) لا يرى أي فترة تجريبية على أي خدمة، وكل البوابات تُفتح بجلسة الحساب بلا رموز (`api/_trial.js`: `OPEN_ACCESS`, `openFor`).

---

# English summary for tools that read this file

**One deployment target only:** the Vercel project `business-partner-sa-businessksa` (`prj_0QXlyAeL02QYYNrAQCfc6lRheTGp`). The `bp-quotes` (`quotes/`) and `bp-erp` (`erp/`) Vercel projects are being folded into the main site and will then be permanently deleted by the owner from the Vercel dashboard. Do not create Vercel projects, do not build new features inside `quotes/` or `erp/` as standalone apps, do not pause those projects before their functionality has been merged. One branch (`claude/bpic-marketing-site-jvrnga`), one PR (#271); rebase before every push; full `npm run build`; verify every `api/` import resolves before pushing.
