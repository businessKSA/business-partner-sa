# بيانات دليل المستثمر (`/guide`) ومصدر كل قسم

القاعدة (أمر المالك 2026-10-16): **المحتوى من بياناتنا الموثّقة فقط.** لا نسخ من scbc.gov.sa (يحجب السحابة)،
ولا معلومة حكومية من الذاكرة. ما ليس في بياناتنا يُوسَم «نموذج — بحاجة تحقق».

## من أين يأتي كل قسم
| القسم | المصدر | ما يُعرض |
|---|---|---|
| رحلة المستثمر | `site/assets/data/catalog.json` + `sectors.json` + `stages.json` | ٩ قطاعات = تصنيفات الكتالوج؛ مراحل مقترحة منّا (SKUs مرتّبة)، والتسلسل الرسمي «بحاجة تحقق» |
| إجراءات الخدمات | الكتالوج (`govPlatform`) + `entities.json` + `procedures.json` | كل خدمة في الكتالوج الظاهر (١٩٥ بطاقة) مصنّفة بالجهة مع بحث وشرائح جهات |
| الأنظمة والتشريعات | `regulations.json` ← `api/_saudi-labor-data.json` | روابط رسمية بتاريخ الجلب فقط، **بلا ملخصات ولا أرقام** |
| دليل المكاتب المعتمدة | `offices.json` | «بحاجة تحقق» + خدماتنا للمكاتب (`BP-RE-*`) |
| خدمات الاعتراضات | `appeals.json` + الكتالوج | `BP-HRSD-04/05/01` و`BP-SELF-01`؛ مهل الاعتراض «بحاجة تحقق» |
| دليل المخالفات | `violations.json` (+ `violations-center.mjs`) | مراجعة / دراسة أهلية الاعتراض / تجهيز / تقديم / متابعة، بلا وعد بالإلغاء |
| الاتصال المرئي | `video.json` + `api/_booking.js` | رابط `/consultation`، ١ ظهراً–٩ مساءً بتوقيت الرياض |

الأسعار: من الكتالوج بالـSKU، بصنف `price-amt` فلا يراها غير المسجّل (SHOW_PRICES=false). الرسم الحكومي لا يُخلط بأتعابنا.

## الحالات
| `status` | المعنى | يُعرض كـ |
|---|---|---|
| `verified` | قرأه المالك من المصدر الرسمي (`source_url` + `verified_at`) | حقيقة |
| `sourced` | رابط رسمي وتاريخ جلب موثّقان في مرجع المستودع (`source_ref`) ولم يقرأه المالك بعد | رابط فقط + «جُلب في {تاريخ}» |
| `needs_verification` | لا مصدر | عنوان + شارة «نموذج — بحاجة تحقق» بلا رابط |
| `retired` | سُحب | لا يُعرض |

## الملفات (`site/data/sbc/`)
- `meta.json` — `noindex` (true حتى موافقة المالك ثم false).
- `sectors.json` — `id, category (مفتاح فئة الكتالوج), door, icon, name/summary {ar,en,fr,zh}, bundle[SKU], steps[{stage, skus[]}], official_order_status`.
- `stages.json` — أسماء المراحل بأربع لغات.
- `entities.json` — الجهات: `catalog_name` يطابق `govPlatform` حرفياً؛ `kind` = gov|multi|none|unspecified؛ `official_url`/`verified_at` فارغان حتى القراءة. **جهة جديدة في الكتالوج تُضاف هنا** (يفرضه الاختبار).
- `procedures.json` — طبقة تفاصيل رسمية لكل SKU **بعد** قراءة المالك: `code, steps[{ar,en}], documents[], gov_fee (رقم|null), duration {ar,en}, source_url, verified_at, status:"verified"`. فارغ الآن؛ حين يُملأ تظهر «التفاصيل الرسمية» داخل بطاقة الخدمة تلقائياً.
- `regulations.json` — `id, group (hrsd|gosi|general), kind, title{ar,en}, source_url, fetched_at, source_ref, status`.
- `offices.json`, `appeals.json`, `violations.json`, `video.json` — انظر الجدول أعلاه.

## قواعد
1. لا رقم رسمي (رسم/مدة/نسبة) بلا `source_url` و`verified_at`.
2. `gov_fee` رسم حكومي فقط؛ لا يُخلط بسعر خدمتنا.
3. كل رابط `sourced` يجب أن يرد حرفياً في `api/_saudi-labor-data.json` (اختبار).
4. أسماء الخدمات والجهات في fr/zh إنجليزية كما في `/catalog`.
5. الاختبارات: `tests/sbc-guide-data.test.mjs` و`tests/sbc-guide-page.test.mjs`. الأرقام الحالية لما يحتاج مادة حكومية: `guideGaps()` في `simple-v1-guide.mjs`.
