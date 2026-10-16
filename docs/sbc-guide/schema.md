# مخطط بيانات دليل المستثمر (`/guide`)

الملفات في `site/data/sbc/`. **كل سجل** يحمل الحقول المشتركة:

| الحقل | النوع | قاعدة |
|---|---|---|
| `id` | نص فريد (kebab) | ثابت، لا يُعاد استعماله |
| `source_url` | رابط رسمي | إلزامي قبل أن يصير السجل `verified` |
| `verified_at` | `YYYY-MM-DD` | تاريخ قراءة المالك للصفحة الرسمية |
| `status` | `needs_verification` \| `verified` \| `retired` | الافتراضي `needs_verification`؛ لا يُعرض للزائر كحقيقة ما لم يكن `verified` |

النصوص الظاهرة كائنات `{ ar, en }` **بصياغتنا** — لا نسخ من الموقع الحكومي.

## الملفات
- `meta.json` — `sample` (true ما دامت البيانات نموذجية فتُوسم الصفحة وتبقى `noindex`) و`tabs`.
- `sectors.json` — القطاعات (رحلة المستثمر): `id, name, summary`.
- `entities.json` — الجهات: `id, name, platform`.
- `procedures.json` — الإجراءات:
  `id, entity (→entities.id), sector (→sectors.id), title, summary,`
  `steps[{ar,en}], documents[{ar,en}], gov_fee (رقم ريال أو null — منفصل دائماً عن أتعابنا),`
  `duration ({ar,en}|null), platform ({ar,en}|null), catalog_sku (SKU في /catalog أو null → عندها «تحدّث مع المستشار الذكي»).`
- لاحقاً (بعد وصول المادة): `regulations.json`, `offices.json`, `appeals.json`, `violations.json` بنفس الحقول المشتركة.

## قواعد
1. لا رقم رسمي (رسم/مدة) بلا `source_url` و`verified_at`.
2. `gov_fee` رسم حكومي فقط؛ لا يُخلط بسعر خدمتنا (الأسعار من الكتالوج بالـSKU).
3. المراجع الفارغة تعني «بحاجة تحقق» ولا تُعرض كمعلومة.
4. الاختبار `tests/sbc-guide-data.test.mjs` يفرض هذه القواعد.
