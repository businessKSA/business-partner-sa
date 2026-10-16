# بنية `site/data/service-journeys/<code>.json`

ملف لكل خدمة في الكتالوج (اسمه الـSKU بحروف صغيرة). يولَّد أول مرة بـ`node docs/service-journeys/tools/seed.mjs`
(لا يكتب فوق موجود) ومنه تُملأ الخطوات والمصادر يدوياً بعد قراءتها من الجهة الرسمية.

كل ادّعاء حكومي (`authority` · `duration` · `documents` · `gov_fees` · كل عنصر من `steps`) يحمل:

| الحقل | المعنى |
|---|---|
| `status` | `needs_verification` (الافتراضي) · `verified` · `not_applicable` |
| `source_url` | رابط رسمي بـ`https://` — مطلوب للتحقق |
| `verified_at` | `YYYY-MM-DD` — مطلوب للتحقق، و`null` ما لم يكن `verified` |

القاعدة: **لا يُعرض في الصفحة شيء إلا `verified` بمصدر وتاريخ**، وما سواه يبقى في الملف. السعر والمبلغ الحكومي لا يُكتبان هنا أبداً (السعر من `catalog.json`).

`steps[]`: `{ actor: "client"|"bp"|"authority", title_ar, title_en, title_fr?, title_zh?, duration_ar?, duration_en?, …, status, source_url, verified_at }`.
خطوة بلا `title_<لغة الصفحة>` لا تُعرض في تلك اللغة (لا إنجليزية في صفحة فرنسية). لا تُدّعى حالة «في /my» لخدمة تُشترى بسلة قبل إصلاح مسار ما بعد الدفع.
