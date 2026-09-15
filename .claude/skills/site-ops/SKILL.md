---
name: site-ops
description: كيف يُبنى ويُختبر ويُنشر موقع www.businesspartner.sa من هذا المستودع، وما القواعد قبل أي تعديل أو Pull Request. استخدمها عند فحص الموقع أو إصلاح صفحة أو لوحة أو نموذج أو خطأ نشر في Vercel.
---

# تشغيل موقع Business Partner

## البنية
- `site/` هو الموقع المنشور كما هو (HTML/CSS/JS ثابت، عربي RTL أولًا، مع `en` و`es` و`fr` و`hi` و`ja` و`ko` و`ru` و`zh` كنسخ مترجمة).
- الصفحات تُولَّد بـ `node site/scripts/generate.mjs` من `site/data/*.json` (`services.json`، `categories.json`، `site.json`). عدّل المصدر، لا HTML المولَّد، عندما تكون الصفحة مولَّدة. الصفحات اليدوية (اللوحات مثل `admin.html`، `monitor.html`، `dashboard.html`) تُعدَّل مباشرة.
- `api/` دوال Vercel (Node، بلا تبعيات). التوجيه في `vercel.json` (`rewrites`، `redirects`، `crons`).
- `quotes/` تطبيق Next.js منفصل للوحة العروض، ينشر على `bp-quotes-three.vercel.app` ويُخدم تحت `/quotes`.
- الاختبارات: `npm test` من جذر المستودع (Node test runner على `tests/**/*.test.mjs`).

## قبل أي تعديل
1. أعد إنتاج المشكلة على الموقع الحي أو بتوليد الموقع محليًا: `node site/scripts/generate.mjs` ثم افتح الملف الناتج.
2. ابحث عن مصدر النص أو الرابط (`grep -rn` في `site/data` ثم `site/scripts` ثم `site/`). كثير من الصفحات مكررة بعدة لغات: أصلح المصدر أو كل النسخ.
3. الأسعار والأكواد (BP-xxx) وأسماء الخدمات مصدرها كتالوج نوشن. لا تغيّرها في الكود أبدًا؛ أبلغ فقط.

## بعد التعديل
- `node site/scripts/generate.mjs && npm test` يجب أن يمرا بلا أخطاء.
- تحقق أن الصفحة المعدلة تفتح بالعربية والإنجليزية وأن الروابط داخلها صحيحة.
- لا تضف تبعيات npm إلى الجذر (`installCommand` في Vercel هو `echo "no dependencies"`).

## Pull Request
- فرع باسم `agent/site-<yyyy-mm-dd>-<وصف-قصير>` من `main`.
- رسالة commit عربية قصيرة تصف الأثر (كما في سجل المستودع).
- افتح PR مسودة بوصف: المشكلة، التغيير، كيف تحققت، وما يحتاج قرار المالك. لا تدمج.
- أي تغيير في `vercel.json` أو `api/` أو الهوية البصرية يُشار إليه صراحة في الوصف.

## ما لا تفعله
- لا حذف صفحات أو بيانات، لا إعادة تسمية مسارات منشورة (كسر روابط خارجية)، لا تغيير أسعار، لا أسرار في الكود.
