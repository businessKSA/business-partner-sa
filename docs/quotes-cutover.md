# نقل bp-quotes إلى الموقع الرئيسي ثم حذفه

جرد ما هو قائم فعلاً (2026-09-04)، وخطة نقل لا تكسر شيئاً بيد عميل.

## لماذا لا يُحذف اليوم

`bp-quotes` ليس مجلداً زائداً: هو تطبيق Next.js حيّ، 157 ملفاً، 25 جدولاً في
قاعدة PostgreSQL خاصة به (`DATABASE_URL`)، وله أربع تبعيات قائمة:

| # | التبعية | أين | ما ينكسر بالحذف |
|---|---|---|---|
| 1 | `‏/quotes` و `/quotes/:path*` | `vercel.json` rewrite → `bp-quotes-three.vercel.app` | لوحة العروض كلها وبوابة العميل |
| 2 | `‏/quotes/d/<token>` | روابط المستندات في يد العملاء | كل عرض سعر وعقد أُرسل سابقاً يصير 404 |
| 3 | جسر المستندات | `api/requests.js` → `/api/bridge/client-documents` و `/api/bridge/owner` (٣ مواضع) | قسم العروض والعقود في `/account` ولوحة المالك |
| 4 | `‏/api/live-catalog` | `vercel.json` rewrite → `/quotes/api/catalog` | مصدر الكتالوج الحي |

النقطة الثانية هي الحاسمة: روابط `‏/d/<token>` مُرسَلة في بريد ووتساب عملاء
منذ أشهر. أي حذف قبل أن يخدمها الموقع الرئيسي = مستندات ميّتة في يد عميل.

## ما الذي يحل محله

طبقة Simple V1 المبنية بالفعل تغطي المسار الأمامي كاملاً: طلب → نطاق → عرض
سعر → اعتماد → عقد → توقيع → دفع → فاتورة، في جدول `requests` واحد
(`api/_simple.js`, `db/schema.sql`). فالمطلوب ليس بناء بديل — البديل جاهز —
بل **نقل التاريخ** و**تحويل المسارات**.

## الخريطة بين المخططين

| bp-quotes (Prisma) | الموقع الرئيسي (`requests`) |
|---|---|
| `Client` | `client_name` / `client_email` / `client_phone` / `company_name` + `organizations` |
| `Document` (type=QUOTE) | `quote` jsonb + `status` |
| `Document` (type=CONTRACT) | `contract` jsonb |
| `DocumentItem[]` | `quote.items[]` |
| `Invoice` | `invoice` jsonb + `payment` jsonb |
| `Envelope`/`Signature` | `contract.signature` |
| `TimelineEvent`/`AuditLog` | `request_events` |
| `Counter` | ترقيم `BP-R-` الحالي |
| `Supplier*`, `SupplyRequest`, `Milestone` | جداول الموردين القائمة في `db/schema.sql` |
| `Service`, `GovFee` | `site/assets/data/catalog.json` |

## الخطة — أربع مراحل، لا واحدة

**١. تجميد الاتجاه الأمامي (بلا نقل بيانات).** كل عرض سعر جديد يُنشأ من `/ops`
لا من لوحة العروض. `bp-quotes` يبقى حياً يخدم التاريخ فقط. قرار تشغيلي منك،
لا كود — وهو ما يجعل بقية المراحل بلا ضغط وقت.

**٢. النقل.** سكربت يقرأ قاعدة العروض ويكتب صفوف `requests` مكافئة، يعمل
افتراضياً على القاعدة المحلية (`LOCAL_DB=1`) حتى نراجع النتيجة قبل أي كتابة
حقيقية. يحتاج مني `DATABASE_URL` الخاص بلوحة العروض — **لا تلصقه في المحادثة**؛
ضعه في `.env.local` عندك وشغّل السكربت بنفسك.

**٣. خدمة الروابط القديمة من الموقع الرئيسي.** مسار `‏/quotes/d/<token>` يُخدَم
من `api/` عبر جدول ربط `token → request.ref`، فيبقى كل رابط في يد عميل حياً
بعد الحذف. هذه هي الخطوة التي تجعل الحذف آمناً.

**٤. الفصل والحذف.** تُحذف تحويلات `/quotes` و`/api/live-catalog` من
`vercel.json`، ويُستبدل جسر `api/requests.js` بقراءة مباشرة من `requests`،
ثم يُحذف المشروع من لوحة Vercel ويُحذف `quotes/` من المستودع.

## قيد تقني يجب حسمه في المرحلة ٣

المشروع الرئيسي على سقف 12 دالة في Vercel وهو ممتلئ (12/12). خدمة
`‏/quotes/d/<token>` يجب أن تمر عبر `api/requests.js?__route=…` مثل بقية
المسارات المضافة، لا كدالة جديدة.

## ما تم إنجازه من هذا الملف

- `erp/` حُذف من المستودع؛ `bp-erp` بلا نطاق مخصّص وجاهز للحذف من اللوحة.
- شرط `ignoreCommand` أوقف بناء المشاريع الثلاثة مع كل دفعة.
