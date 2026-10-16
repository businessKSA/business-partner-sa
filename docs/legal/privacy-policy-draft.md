> **مسودة تحتاج مراجعة محامٍ مرخّص قبل النشر؛ لا تُنشر كما هي.**
> *Draft requiring review by a licensed lawyer before publication; do not publish as is.*

- أُعدّت من قراءة الكود في 2026-10-16 (الفرع `claude/trusting-tesla-ns9siz`). كل ادّعاء له ملف دعم بين قوسين.
- ما لم أجد له سنداً في الكود وُضع مكانه `[يحتاج تأكيد المالك: …]`. لم أخترع مدداً ولا مواقع خوادم ولا إجراءات.
- الإطار المرجعي: نظام حماية البيانات الشخصية السعودي (PDPL) ولوائحه. المسودة لا تدّعي امتثالاً كاملاً ولا تقتبس مواد.
- قسم «أسئلة للمالك» وقسم «ما رأيته في الكود» في آخر الملف **للمالك والمحامي فقط ويُحذفان قبل النشر**.

---

# القسم الأول — العربية (الأساس)

# سياسة الخصوصية — Business Partner

آخر تحديث: `[يحتاج تأكيد المالك: تاريخ سريان السياسة]`

## 1. من نحن

نحن **شركة بزنس بارتنر سلوشنز** (الاسم الظاهر: Business Partner)، الرقم الموحّد 7038825860، الرقم الضريبي 312079341500003. العنوان الوطني: مبنى 2978، شارع تركي بن عبدالله آل سعود، حي السليمانية، الرياض 12234، الرقم الفرعي 8630. (المصدر: تذييل `site/ar/terms.html` و`site/ar/contact.html`.)

نشغّل موقع **businesspartner.sa** وتطبيق **Business Partner** على iOS وAndroid. نقدّم الاستشارات والخدمات الحكومية وتأسيس الشركات، ونتلقى منك طلباتك ونحضّر عروضها وعقودها وفواتيرها.

تسري هذه السياسة على الموقع والتطبيق معاً. نحن الجهة المتحكمة في بياناتك الشخصية. `[يحتاج تأكيد المالك: السجل التجاري، وهل عُيّن مسؤول لحماية البيانات]`

نعمل في إطار نظام حماية البيانات الشخصية في المملكة العربية السعودية ولوائحه التنفيذية، ونسعى إلى الالتزام به. هذه السياسة لا تعني ادّعاء امتثال كامل.

## 2. البيانات التي نجمعها

**أ. الحساب والدخول**
- البريد الإلكتروني، والاسم إن أدخلته، واسم الشركة إن أدخلته. (`api/otp.js`، جدولا `users` و`organizations` في `db/schema.sql`)
- كلمة المرور إن اخترتَ واحدة. نخزّنها مُجزّأة بـscrypt مع ملح، ولا نخزّن النص الأصلي. (`api/otp.js`: `hashPassword`)
- رمز الدخول المؤقت يصلك بالبريد. صلاحيته 10 دقائق، ولا يُخزَّن في قاعدة البيانات بل يُختم في «تحدٍّ» مشفّر. (`api/otp.js`)
- الجلسة: عند الدخول نحفظ تجزئة رمز الجلسة، وعنوان IP ونوع المتصفح، ومدتها 30 يوماً. (`api/otp.js`: `createSession`، جدول `user_sessions`)
- الدخول بحساب Google: نستلم البريد والاسم من رمز الهوية الذي تصدره Google. (`api/otp.js`: `action: google`)
- الدخول بنفاذ (إن فُعّل): نرسل رقم الهوية الوطنية إلى نفاذ للتحقق، ولا نخزّنه نصاً. نخزّن بصمة مُجزّأة بمفتاح سري (HMAC-SHA256) لنربط هويتك بحسابك. (`api/_nafath.js`: `nafathIdHash`، عمود `users.nafath_id`) `[يحتاج تأكيد المالك: هل الدخول بنفاذ مفعّل للعملاء حالياً]`
- الدخول بحساب Apple: قيد الإضافة ولم أجد له كوداً بعد. `[يحتاج تأكيد المالك: ما تستلمه من Apple (قد يكون بريداً مستعاراً) بعد اكتمال الإضافة]`

**ب. الطلبات والتعاقد والدفع**
- بيانات الطلب: العنوان والملخص والنطاق والمستندات المطلوبة، واسمك وبريدك وجوالك واسم شركتك. (`api/_simple.js`، جدول `requests` في `db/schema.sql`)
- نص محادثتك مع المستشار الذكي أثناء إعداد الطلب، يُحفظ مع الطلب. (`requests.conversation` في `db/schema.sql`)
- سجل أحداث الطلب: إنشاء، عرض سعر، توقيع، دفع. (جدول `request_events`)
- العروض والعقود والفواتير، وعند التوقيع: اسمك وبريدك وعنوان IP ونوع المتصفح ووقت التوقيع وبصمة العقد. (`api/_simple.js` حول `signature`، و`requests.contract` في `db/schema.sql`)
- الدفع: حالة الدفع ومرجعه ومبلغه وطريقته. **بيانات البطاقة لا تمر بخوادمنا**: حقول البطاقة تعرضها مُيسّر وتستلمها مباشرة. (`api/_moyasar.js`، `api/pay.js`) `[يحتاج تأكيد المالك: تأكيد أن الدفع كله عبر نموذج مُيسّر المستضاف دون تخزين لأرقام البطاقات]`
- في حال التحويل البنكي: صورة الإيصال التي ترفعها. (`api/_simple.js` حول `receipt`)
- الفاتورة الضريبية تُصدر باسمك وبيانات منشأتك الضريبية عبر الدفترة. (`api/_simple.js`: `daftraInvoiceForRequest`)

**ج. المستندات التي ترفعها**
- ملفات (صور وPDF) مثل السجل التجاري والهويات والعقود، حتى 6 ميغابايت للملف. نقرؤها بالمستشار الذكي لاستخراج البيانات. (`api/_docread.js`: `MAX_DOC_BYTES`، `api/_docagent.js`، جداول `doc_agent_*`)
- نخزّنها في مخزن ملفات خاص، ونعطيك روابط تنزيل موقّعة قصيرة العمر (10 دقائق افتراضياً). (`api/_db.js`: `storagePut`/`storageSign`، `api/_azblob.js`)

**د. الصوت**
- إن ضغطتَ زر الميكروفون في المحادثة نسجّل مقطعاً قصيراً (حتى نحو 12 ميغابايت) ونرسله لتفريغه إلى نص. لا نحفظ التسجيل في قاعدة بياناتنا حسب ما رأيت في الكود، ويُحفظ النص الناتج إن أرسلته ضمن المحادثة. (`site/scripts/simple-v1.mjs`: `getUserMedia`، `api/_chat.js` `mode: voice`، `api/_docread.js`: `transcribeAudio`) `[يحتاج تأكيد المالك: هل يحتفظ مزوّد التفريغ بالصوت وكم مدة]`

**هـ. التواصل عبر واتساب والبريد**
- رقم جوالك ورسائلك وآخر رسالة، حين تراسلنا على واتساب، وتُسجَّل في سجل العملاء. (`api/requests.js`، قاعدة CRM في Notion)
- رسائل البريد التي نرسلها لك (رموز الدخول، العروض، الفواتير، الإشعارات). (`api/_simple.js`، `api/otp.js`)
- الاشتراك في النشرة: بريدك واسمك. (`api/newsletter.js`)

**و. التوظيف** `[يحتاج تأكيد المالك: هل تغطي هذه السياسة صفحة الوظائف ولوحة صاحب العمل؟ يوجد في الكود استقبال سير ذاتية (api/candidate.js) وبيانات أصحاب عمل (api/employer.js) تحتاج بنداً خاصاً]`

**ز. بيانات الاستخدام**
- عدّاد زيارات خاص بنا: الصفحة، المصدر المُحيل (الموقع فقط)، لغة الصفحة، نوع الجهاز (جوال/حاسوب)، معرّف زائر عشوائي، والنقرات على أزرار محددة، وأخطاء المتصفح. **لا نخزّن عنوان IP ولا اسماً ولا بريداً في هذا الجدول.** (`site/scripts/simple-v1.mjs`: `BEACON_JS`، `api/requests.js`، جدولا `page_hits` و`site_errors` في `db/schema.sql`) نخزّن نوع المتصفح (User-Agent) مع أخطاء المتصفح فقط.

## 3. كيف نستخدم بياناتك وعلى أي أساس

| الغرض | البيانات | الأساس |
|---|---|---|
| إنشاء حسابك وتسجيل دخولك وحمايته | البريد، كلمة المرور المجزّأة، الجلسة | تنفيذ العقد معك |
| تنفيذ طلبك وإعداد النطاق والعرض والعقد | بيانات الطلب والمحادثة والمستندات | تنفيذ العقد معك |
| الدفع وإصدار الفاتورة الضريبية | بيانات الدفع والفاتورة | تنفيذ العقد والتزام نظامي ضريبي `[يحتاج تأكيد المالك: مراجعة المحامي للأساس النظامي]` |
| قراءة مستنداتك وملء النماذج | الملفات والبيانات المستخرجة | بطلبك وموافقتك عند الرفع |
| الردّ عليك عبر المستشار الذكي | نص المحادثة والصوت | بطلبك |
| التواصل والمتابعة | الجوال والبريد | تنفيذ العقد، وموافقتك في التسويق |
| الأمان ومنع إساءة الاستخدام | IP، المتصفح، الجلسات | مصلحتنا المشروعة في حماية الخدمة `[يحتاج تأكيد المالك: مراجعة المحامي]` |
| تحسين الموقع | عدّاد الزيارات | مصلحتنا المشروعة `[يحتاج تأكيد المالك: هل يلزم طلب موافقة صريحة بحسب اللوائح]` |

لا نبيع بياناتك.

**المستشار الذكي** نظام آلي يولّد الردود. لا يتخذ قراراً نهائياً بشأنك، ويراجع فريقنا العروض والعقود. نمنع في الكود إرسال التزام بسعر أو ضمان من النظام الآلي دون اعتماد بشري. `[يحتاج تأكيد المالك: تأكيد هذه الصياغة؛ المصدر agents/ في CLAUDE.md وليس مسار الموقع]`

## 4. من نشاركها معه

نستعين بمزوّدين لتشغيل الخدمة. لكل منهم ما يلزم لأداء دوره:

| الجهة | ما تستقبله | لماذا | الملف |
|---|---|---|---|
| **Supabase** (قاعدة البيانات الأساسية) | الحسابات والطلبات والمحادثات والعقود والفواتير والجلسات وعدّاد الزيارات، وملفات قديمة | تخزين بيانات الخدمة | `api/_db.js` |
| **Microsoft Azure** (Blob Storage) | ملفات العملاء المرفوعة | تخزين المستندات | `api/_azblob.js`، `api/_db.js` |
| **Microsoft Azure OpenAI** | نص المحادثة، ونصوص المستندات وصورها، والمقاطع الصوتية | المستشار الذكي، وقراءة المستندات، وتفريغ الصوت | `api/_azure.js`، `api/_chat.js`، `api/_docread.js` |
| **Vercel** | كل طلب إلى الموقع وواجهاته (الاستضافة) | تشغيل الموقع | `vercel.json` |
| **Resend** | بريدك ومحتوى الرسالة | إرسال البريد | `api/otp.js`، `api/_simple.js` |
| **مُيسّر (Moyasar)** | بيانات الدفع والمبلغ وبيانات الطلب | الدفع | `api/_moyasar.js` |
| **تمارا (Tamara)** | بيانات الطلب والعميل اللازمة للتقسيط | الدفع بالتقسيط | `api/_bnpl.js` `[يحتاج تأكيد المالك: الحقول المرسلة لتمارا]` |
| **الدفترة (Daftra)** | اسمك وبيانات منشأتك والبنود والمبالغ | الفاتورة الضريبية | `api/_daftra.js` |
| **Notion** | بيانات العملاء المحتملين وسجل التواصل والإيصالات المرفوعة في المسار القديم | إدارة العملاء | `api/requests.js`، `api/book.js` |
| **n8n Cloud** (واتساب والتنبيهات) | رقم الجوال ونص المحادثة والتنبيهات | رسائل واتساب وإشعار الفريق، ونسخة احتياطية للمحادثة | `api/_chat.js`، `api/_stage.js`، `api/book.js` |
| **Meta (واتساب)** | رقمك ورسائلك | المراسلة عبر واتساب | `api/_stage.js` |
| **Google** | رمز الهوية عند الدخول بجوجل. وتحميل خط وصفحة الدخول من Google قد يكشف عنوان IP لها | الدخول، والخطوط | `api/_suppliers.js`، `site/scripts/simple-v1-my.mjs` |
| **Google Calendar / Microsoft 365** | تفاصيل المواعيد (الموضوع والوقت) | حجز الاستشارات | `api/_gcal.js`، `api/_msgraph.js` |
| **نفاذ (Elm)** | رقم الهوية الوطنية (للمتحقق بنفاذ فقط) | التحقق من الهوية | `api/_nafath.js` |
| **DocuSign / منصة اعتماد** | `[يحتاج تأكيد المالك: هل يُستخدم فعلاً أم هو تجهيز فقط؟]` | التوقيع | `api/_docusign.js` |

نشارك البيانات كذلك مع الجهات الحكومية حين تطلب منا تنفيذ معاملة حكومية، وبقدر ما تتطلبه المعاملة. ونفصح عنها للجهات المختصة إذا أوجب النظام ذلك. `[يحتاج تأكيد المالك: مراجعة المحامي]`

## 5. النقل خارج المملكة

قد تُعالَج بياناتك أو تُخزَّن خارج المملكة. الوقائع التي تحققت منها:

- **قاعدة بيانات Supabase الأساسية في طوكيو، اليابان** (المنطقة `ap-northeast-1`، من لوحة Supabase).
- خوادم Azure OpenAI وAzure Blob: الكود لا يحدد المنطقة (تأتي من إعدادات البيئة). `[يحتاج تأكيد المالك: منطقة Azure OpenAI ومنطقة Azure Blob المستخدمتين للموقع؛ تشير ملاحظات المشروع إلى مورد في السويد (Sweden Central) لسير n8n، ولم أتحقق من مورد الموقع]`
- منطقة تشغيل دوال Vercel غير محددة في `vercel.json`. `[يحتاج تأكيد المالك: منطقة Vercel]`
- Resend وNotion وMeta وn8n Cloud وGoogle ومُيسّر وتمارا والدفترة: `[يحتاج تأكيد المالك: مواقع المعالجة لكل جهة]`.

`[يحتاج تأكيد المالك: الأساس النظامي للنقل خارج المملكة بحسب PDPL ولوائح نقل البيانات، والضمانات التعاقدية مع كل مزوّد، وهل يلزم إشعار أو موافقة]`

## 6. مدة الاحتفاظ

ما وجدته في الكود فقط:
- رمز الدخول بالبريد: صالح 10 دقائق. (`api/otp.js`)
- الجلسة: 30 يوماً، أو حتى تسجّل الخروج. (`api/otp.js`)
- إثبات نفاذ المؤقت قبل الربط بالحساب: 10 دقائق. (`api/otp.js`)
- روابط تنزيل المستندات: 10 دقائق افتراضياً. (`api/_db.js`)
- يمكنك حذف مستند رفعته من خزنتك. (`api/_db.js`: `storageDelete`)

لم أجد في الكود مدة احتفاظ ولا حذفاً آلياً لباقي البيانات (الحسابات، الطلبات، المحادثات، العقود، الفواتير، الجلسات المنتهية، عدّاد الزيارات، سجلات Notion، نسخ المستندات). `[يحتاج تأكيد المالك: مدة الاحتفاظ بكل فئة، ومنها الفواتير والعقود (التزامات نظامية)، والحسابات غير النشطة، والمحادثات، والتسجيلات الصوتية، وعدّاد الزيارات]`

## 7. أمن البيانات

ما يطابق الكود:
- كلمات المرور مجزّأة بـscrypt مع ملح، ومقارنتها بزمن ثابت. (`api/otp.js`)
- رمز الجلسة عشوائي، ونخزّن تجزئته (SHA-256) لا قيمته، ويُسلَّم في كوكي `HttpOnly; Secure; SameSite=Lax`. (`api/otp.js`، `api/_db.js`)
- رموز الدخول والتحدّيات مختومة بتشفير AES-256-GCM. (`api/otp.js`)
- رقم الهوية الوطنية عبر نفاذ لا يُخزَّن نصاً ولا يعود إلى المتصفح. (`api/otp.js`، `api/_nafath.js`)
- المستندات في مخزن خاص، وتنزيلها بروابط موقّعة قصيرة العمر. (`api/_db.js`، `api/_azblob.js`)
- مفاتيح الخدمات في إعدادات الخادم لا في الكود. (`api/_azure.js`)
- محاولات كلمة المرور الخاطئة مقيّدة في ذاكرة الخادم، وطلبات نفاذ مقيّدة. وهذا يبطّئ التخمين ولا يمنعه كلياً. (`api/otp.js`)

لا يوجد نظام آمن بالكامل، ولا نضمن عدم حدوث اختراق. `[يحتاج تأكيد المالك: إجراءات إضافية قائمة فعلاً (نسخ احتياطي، صلاحيات الموظفين، تسجيل الدخول للوحة الإدارة، إجراءات الإبلاغ عن الاختراق)]`

## 8. حقوقك

بحسب نظام حماية البيانات الشخصية ولوائحه، لك حقوق منها: العلم بكيفية معالجة بياناتك، والاطلاع عليها والحصول على نسخة، وتصحيحها، وطلب إتلافها، وسحب موافقتك حيث تكون الموافقة هي الأساس. `[يحتاج تأكيد المالك: مراجعة المحامي لقائمة الحقوق ومدد الردّ بحسب اللوائح]`

لممارسة أي حق تواصل معنا (القسم 14). `[يحتاج تأكيد المالك: مدة ردّنا على الطلب وآلية التحقق من هويتك]`

لك أيضاً الحق في التقدم بشكوى إلى الجهة المختصة بحماية البيانات في المملكة. `[يحتاج تأكيد المالك: اسم الجهة وطريقة الشكوى]`

## 9. الأطفال

خدماتنا للأعمال وليست موجّهة لمن هم دون 18 عاماً، ولا نجمع عمداً بيانات أطفال. `[يحتاج تأكيد المالك: السن المعتمدة]` إن علمتَ أن طفلاً زوّدنا ببيانات فأخبرنا لنحذفها.

## 10. ملفات الارتباط والتخزين المحلي

**ملف الارتباط الأساسي**
- كوكي الجلسة: `HttpOnly; Secure; SameSite=Lax`، بنطاق `.businesspartner.sa`، مدته 30 يوماً، لازم لتسجيل الدخول. (`api/otp.js`)

**التخزين المحلي في متصفحك** (`site/scripts/*`)
- `bp_vid`: معرّف عشوائي لعدّاد الزيارات. (`simple-v1.mjs`)
- `bp_session`: علامة تجميلية تعني أنك سجّلت الدخول لرسم الواجهة بسرعة، ولا تمنح صلاحية. (`simple-v1.mjs`، `simple-v1-my.mjs`)
- `bp_cart`: محتوى سلتك. (`simple-v1-cart.mjs`)
- في `sessionStorage` (يُمحى بإغلاق التبويب): نص محادثتك الجارية `sv1_chat`، ولقطة الدفع `bp_pay_order`، وبيانات الانتقال بين الصفحات.
- `bp_push_token`: رمز الإشعارات داخل التطبيق إن فُعّلت (حالياً مطفأة). (`app-bridge.js`)

**جهات خارجية تُحمَّل من الصفحات**: خطوط Google (`fonts.googleapis.com`) وسكربت الدخول بجوجل (`accounts.google.com/gsi/client`) في صفحات الدخول، ونموذج الدفع من مُيسّر. هذه الجهات ترى عنوان IP الخاص بك.

لم أجد في الكود شريط موافقة على الكوكيز. `[يحتاج تأكيد المالك: هل نضيف شريط موافقة على عدّاد الزيارات والخطوط الخارجية، أم نعدّ العدّاد ضرورياً؟]`

## 11. التطبيق (iOS وAndroid)

- التطبيق غلاف أصلي يعرض موقعنا `https://businesspartner.sa` داخل التطبيق، فتسري عليه كل بنود هذه السياسة. (`mobile/capacitor.config.json`، `docs/mobile-app.md`)
- **الأذونات**: يطلب Android إذن الإنترنت فقط حسب ملف `AndroidManifest.xml`. لا أذونات للكاميرا أو الموقع أو جهات الاتصال. (`mobile/android/app/src/main/AndroidManifest.xml`) `[يحتاج تأكيد المالك: هل سيعمل الميكروفون داخل التطبيق؟ إن أُضيف إذنه وجب ذكره هنا]`
- **الإشعارات**: مطفأة حالياً، ولا يرسل التطبيق رمز الإشعار إلى خوادمنا في الوقت الحالي. إن فُعّلت سنحدّث السياسة. (`site/assets/js/app-bridge.js`، `docs/mobile-app.md`)
- **الدخول**: بالبريد وكلمة المرور أو رمز البريد. الدخول بحساب Google وبحساب Apple قيد الإضافة. (`docs/mobile-app.md`)
- يستخدم التطبيق نفس كوكي الجلسة والتخزين المحلي أعلاه داخل المتصفح المدمج.
- اتصال التطبيق الأصلي بالشبكة لتسجيل الدخول فقط عبر `/api/otp` من الأصل نفسه. (`docs/mobile-app.md`)
- يظهر في قائمة التطبيق رابط للشروط والتواصل وطلب حذف الحساب.
- `[يحتاج تأكيد المالك: إجابات نماذج Apple Privacy Labels وGoogle Data Safety، وتطابقها مع هذه السياسة]`

## 12. حذف الحساب

- من التطبيق: زر «طلب حذف الحساب» يفتح محادثة واتساب برسالة جاهزة إلينا، ثم نتواصل معك للتأكيد قبل أي حذف. (`site/assets/js/app-bridge.js`)
- **لا يوجد في الكود حالياً حذف آلي للحساب من الخادم.** `[يحتاج تأكيد المالك: آلية الحذف الفعلية (ما يُحذف، وما يُحتفظ به لالتزامات نظامية كالفواتير والعقود)، والمدة المستغرقة، وهل ستُبنى ميزة حذف داخل التطبيق قبل الرفع لمتجر آبل]`
- يمكنك أيضاً مراسلتنا على البريد أو واتساب (القسم 14).

## 13. تعديل السياسة

قد نعدّل هذه السياسة. ننشر النسخة الجديدة هنا مع تاريخ التحديث، وننبّهك في التعديلات الجوهرية. `[يحتاج تأكيد المالك: وسيلة التنبيه (بريد أو إشعار داخل التطبيق)]`

## 14. التواصل

- البريد: business@businesspartner.sa
- الهاتف وواتساب: 0530540231 (`https://wa.me/966530540231`)
- العنوان: مبنى 2978، شارع تركي بن عبدالله آل سعود، حي السليمانية، الرياض 12234.
- ساعات العمل المعلنة: الأحد إلى الخميس، 9 صباحاً إلى 6 مساءً، والمستشار الذكي على مدار الساعة.

(المصدر: تذييل `site/ar/contact.html`). `[يحتاج تأكيد المالك: بريد مخصص للخصوصية مثل privacy@، واسم المسؤول عن الطلبات]`

---

# PART TWO — English (full translation)

# Privacy Policy — Business Partner

Last updated: `[Owner confirmation needed: effective date]`

## 1. Who we are

We are **Business Partner Solutions Company** (displayed name: Business Partner), Unified Number 7038825860, VAT number 312079341500003. National address: Building 2978, Turki Ibn Abdullah Aal Saud St., Al Sulaimaniyah District, Riyadh 12234, Additional No. 8630. (Source: footer of `site/terms.html` and `site/contact.html`.)

We operate **businesspartner.sa** and the **Business Partner** app on iOS and Android. We provide consulting, government-service and company-formation services, receive your requests, and prepare their quotes, contracts and invoices.

This policy covers the website and the app together. We are the controller of your personal data. `[Owner confirmation needed: Commercial Registration number, and whether a data protection officer has been appointed]`

We operate within the framework of the Kingdom of Saudi Arabia's Personal Data Protection Law (PDPL) and its implementing regulations, and aim to follow it. This policy does not claim full compliance.

## 2. Data we collect

**A. Account and sign-in**
- Email, and name and company name if you enter them. (`api/otp.js`; `users`, `organizations` tables in `db/schema.sql`)
- A password if you choose one. We store it hashed with salted scrypt, never in plain text. (`api/otp.js`: `hashPassword`)
- The one-time code emailed to you is valid for 10 minutes and is not stored in the database; it is sealed in an encrypted "challenge". (`api/otp.js`)
- Session: at sign-in we store a hash of the session token, your IP address and browser type, for 30 days. (`api/otp.js`: `createSession`; `user_sessions` table)
- Google sign-in: we receive your email and name from the identity token Google issues. (`api/otp.js`: `action: google`)
- Nafath sign-in (if enabled): we send the national ID number to Nafath for verification and do not store it as plain text. We store a fingerprint hashed with a secret key (HMAC-SHA256) to link your identity to your account. (`api/_nafath.js`: `nafathIdHash`; `users.nafath_id`) `[Owner confirmation needed: whether Nafath sign-in is currently live for clients]`
- Apple sign-in: being added; I found no code for it yet. `[Owner confirmation needed: what we receive from Apple (possibly a relay email) once it is added]`

**B. Requests, contracts and payment**
- Request data: title, summary, scope, requested documents, and your name, email, phone and company name. (`api/_simple.js`; `requests` table)
- The text of your conversation with the smart advisor while preparing the request, stored with the request. (`requests.conversation`)
- A log of request events: creation, quote, signature, payment. (`request_events` table)
- Quotes, contracts and invoices; on signing: your name, email, IP address, browser type, time of signing and a fingerprint of the contract. (`api/_simple.js` around `signature`; `requests.contract`)
- Payment: status, reference, amount and method. **Card details do not pass through our servers**: Moyasar draws the card fields and receives them directly. (`api/_moyasar.js`, `api/pay.js`) `[Owner confirmation needed: that all card payment goes through Moyasar's hosted form with no card numbers stored by us]`
- For bank transfers: the receipt image you upload. (`api/_simple.js` around `receipt`)
- A tax invoice is issued in your name and your company's tax details through Daftra. (`api/_simple.js`: `daftraInvoiceForRequest`)

**C. Documents you upload**
- Files (images and PDF) such as commercial registrations, IDs and contracts, up to 6 MB each. The smart advisor reads them to extract data. (`api/_docread.js`: `MAX_DOC_BYTES`; `api/_docagent.js`; `doc_agent_*` tables)
- We store them in a private file store and give you short-lived signed download links (10 minutes by default). (`api/_db.js`: `storagePut`/`storageSign`; `api/_azblob.js`)

**D. Voice**
- If you press the microphone button in the chat, we record a short clip (up to about 12 MB) and send it to be transcribed into text. As far as the code shows, we do not keep the recording in our database; the resulting text is kept if you send it in the conversation. (`site/scripts/simple-v1.mjs`: `getUserMedia`; `api/_chat.js` `mode: voice`; `api/_docread.js`: `transcribeAudio`) `[Owner confirmation needed: whether the transcription provider retains audio, and for how long]`

**E. WhatsApp and email communication**
- Your phone number and messages when you contact us on WhatsApp, recorded in our client log. (`api/requests.js`; Notion CRM database)
- Emails we send you (sign-in codes, quotes, invoices, notifications). (`api/_simple.js`, `api/otp.js`)
- Newsletter subscription: your email and name. (`api/newsletter.js`)

**F. Recruitment** `[Owner confirmation needed: whether this policy covers the jobs page and the employer dashboard. The code receives CVs (api/candidate.js) and employer data (api/employer.js), which need a dedicated clause]`

**G. Usage data**
- Our own visit counter: page, referring site (host only), page language, device type (mobile/desktop), a random visitor ID, clicks on specific buttons, and browser errors. **We do not store IP address, name or email in this table.** (`site/scripts/simple-v1.mjs`: `BEACON_JS`; `api/requests.js`; `page_hits` and `site_errors` tables) We store the browser type (User-Agent) with browser errors only.

## 3. How we use your data and on what basis

| Purpose | Data | Basis |
|---|---|---|
| Create, secure and sign you in to your account | Email, hashed password, session | Performing our contract with you |
| Carry out your request; prepare scope, quote and contract | Request data, conversation, documents | Performing our contract with you |
| Payment and tax invoicing | Payment and invoice data | Contract and legal tax obligation `[Owner confirmation needed: lawyer to review legal basis]` |
| Reading your documents and filling forms | Files and extracted data | Your request and consent at upload |
| Answering you through the smart advisor | Chat text and voice | Your request |
| Contact and follow-up | Phone and email | Contract; your consent for marketing |
| Security and abuse prevention | IP, browser, sessions | Our legitimate interest in protecting the service `[Owner confirmation needed: lawyer to review]` |
| Improving the site | Visit counter | Our legitimate interest `[Owner confirmation needed: whether explicit consent is required under the regulations]` |

We do not sell your data.

**The smart advisor** is an automated system that generates replies. It makes no final decision about you, and our team reviews quotes and contracts. The code blocks automated messages that commit to a price or guarantee without human approval. `[Owner confirmation needed: confirm this wording; the source is agents/ per CLAUDE.md, not the website path]`

## 4. Who we share it with

We use providers to run the service. Each receives what it needs for its role:

| Party | What it receives | Why | File |
|---|---|---|---|
| **Supabase** (primary database) | Accounts, requests, conversations, contracts, invoices, sessions, visit counter, legacy files | Storing service data | `api/_db.js` |
| **Microsoft Azure** (Blob Storage) | Client-uploaded files | Document storage | `api/_azblob.js`, `api/_db.js` |
| **Microsoft Azure OpenAI** | Chat text, document text and images, audio clips | Smart advisor, document reading, transcription | `api/_azure.js`, `api/_chat.js`, `api/_docread.js` |
| **Vercel** | Every request to the site and its APIs (hosting) | Running the site | `vercel.json` |
| **Resend** | Your email and message content | Sending email | `api/otp.js`, `api/_simple.js` |
| **Moyasar** | Payment data, amount, request details | Payment | `api/_moyasar.js` |
| **Tamara** | Request and customer data needed for installments | Installment payment | `api/_bnpl.js` `[Owner confirmation needed: fields sent to Tamara]` |
| **Daftra** | Your name, company details, line items, amounts | Tax invoice | `api/_daftra.js` |
| **Notion** | Lead data, contact log and uploaded receipts in the legacy path | Client management | `api/requests.js`, `api/book.js` |
| **n8n Cloud** (WhatsApp and alerts) | Phone number, chat text, alerts | WhatsApp messages and team notification; a backup route for the chat | `api/_chat.js`, `api/_stage.js`, `api/book.js` |
| **Meta (WhatsApp)** | Your number and messages | WhatsApp messaging | `api/_stage.js` |
| **Google** | Identity token on Google sign-in. Loading a font and the sign-in script from Google may expose your IP address to it | Sign-in, fonts | `api/_suppliers.js`, `site/scripts/simple-v1-my.mjs` |
| **Google Calendar / Microsoft 365** | Appointment details (topic, time) | Booking consultations | `api/_gcal.js`, `api/_msgraph.js` |
| **Nafath (Elm)** | National ID number (Nafath verification only) | Identity verification | `api/_nafath.js` |
| **DocuSign** | `[Owner confirmation needed: is it actually used or only prepared?]` | Signing | `api/_docusign.js` |

We also share data with government bodies when you ask us to carry out a government transaction, to the extent the transaction requires. We disclose to competent authorities where the law requires. `[Owner confirmation needed: lawyer to review]`

## 5. Transfers outside the Kingdom

Your data may be processed or stored outside the Kingdom. Facts I verified:

- **The primary Supabase database is in Tokyo, Japan** (region `ap-northeast-1`, from the Supabase dashboard).
- Azure OpenAI and Azure Blob regions: the code does not set the region (it comes from environment settings). `[Owner confirmation needed: the Azure OpenAI and Azure Blob regions used by the website; project notes mention a Sweden Central resource for n8n workflows, and I did not verify the website's resource]`
- Vercel function region is not set in `vercel.json`. `[Owner confirmation needed: Vercel region]`
- Resend, Notion, Meta, n8n Cloud, Google, Moyasar, Tamara and Daftra: `[Owner confirmation needed: processing locations for each]`.

`[Owner confirmation needed: the legal basis for transfers outside the Kingdom under the PDPL and its transfer regulations, contractual safeguards with each provider, and whether notice or consent is required]`

## 6. Retention

Only what I found in the code:
- Email sign-in code: valid 10 minutes. (`api/otp.js`)
- Session: 30 days, or until you sign out. (`api/otp.js`)
- Temporary Nafath proof before linking to an account: 10 minutes. (`api/otp.js`)
- Document download links: 10 minutes by default. (`api/_db.js`)
- You can delete a document you uploaded from your vault. (`api/_db.js`: `storageDelete`)

I found no retention period or automatic deletion in the code for the remaining data (accounts, requests, conversations, contracts, invoices, expired sessions, visit counter, Notion records, document copies). `[Owner confirmation needed: retention period for each category, including invoices and contracts (legal obligations), inactive accounts, conversations, audio, and the visit counter]`

## 7. Data security

What matches the code:
- Passwords are hashed with salted scrypt and compared in constant time. (`api/otp.js`)
- The session token is random; we store its SHA-256 hash, not the value, and deliver it in a `HttpOnly; Secure; SameSite=Lax` cookie. (`api/otp.js`, `api/_db.js`)
- Sign-in codes and challenges are sealed with AES-256-GCM. (`api/otp.js`)
- A national ID used with Nafath is not stored in plain text and never returns to the browser. (`api/otp.js`, `api/_nafath.js`)
- Documents are in a private store, downloaded through short-lived signed links. (`api/_db.js`, `api/_azblob.js`)
- Service keys live in server settings, not in code. (`api/_azure.js`)
- Wrong-password attempts and Nafath requests are rate-limited in server memory. This slows guessing but does not fully prevent it. (`api/otp.js`)

No system is perfectly secure, and we cannot guarantee that a breach will never occur. `[Owner confirmation needed: additional measures actually in place (backups, staff access, admin panel login, breach notification procedure)]`

## 8. Your rights

Under the Personal Data Protection Law and its regulations you have rights that include: being informed of how your data is processed, accessing it and obtaining a copy, correcting it, requesting its destruction, and withdrawing consent where consent is the basis. `[Owner confirmation needed: lawyer to review the list of rights and response times under the regulations]`

To exercise a right, contact us (Section 14). `[Owner confirmation needed: our response time and how we verify your identity]`

You may also complain to the competent data protection authority in the Kingdom. `[Owner confirmation needed: authority name and complaint procedure]`

## 9. Children

Our services are for businesses and are not directed to anyone under 18, and we do not knowingly collect children's data. `[Owner confirmation needed: the age threshold to adopt]` If you know a child has given us data, tell us and we will delete it.

## 10. Cookies and local storage

**Main cookie**
- Session cookie: `HttpOnly; Secure; SameSite=Lax`, domain `.businesspartner.sa`, 30 days, required for sign-in. (`api/otp.js`)

**Local storage in your browser** (`site/scripts/*`)
- `bp_vid`: a random ID for the visit counter. (`simple-v1.mjs`)
- `bp_session`: a cosmetic flag meaning you are signed in, used to draw the interface quickly; it grants no access. (`simple-v1.mjs`, `simple-v1-my.mjs`)
- `bp_cart`: your cart contents. (`simple-v1-cart.mjs`)
- In `sessionStorage` (cleared when the tab closes): your current chat `sv1_chat`, the payment snapshot `bp_pay_order`, and page-to-page handoff data.
- `bp_push_token`: the in-app notification token, if enabled (currently off). (`app-bridge.js`)

**Third parties loaded by pages**: Google Fonts (`fonts.googleapis.com`) and the Google sign-in script (`accounts.google.com/gsi/client`) on sign-in pages, and the Moyasar payment form. These parties see your IP address.

I found no cookie consent banner in the code. `[Owner confirmation needed: whether to add a consent banner for the visit counter and external fonts, or treat the counter as necessary]`

## 11. The app (iOS and Android)

- The app is a native shell that shows our site `https://businesspartner.sa` inside the app, so everything in this policy applies. (`mobile/capacitor.config.json`, `docs/mobile-app.md`)
- **Permissions**: Android requests only the internet permission per `AndroidManifest.xml`. No camera, location or contacts permission. (`mobile/android/app/src/main/AndroidManifest.xml`) `[Owner confirmation needed: will the microphone work inside the app? If its permission is added it must be listed here]`
- **Notifications**: currently off, and the app does not send a push token to our servers at present. If enabled we will update this policy. (`site/assets/js/app-bridge.js`, `docs/mobile-app.md`)
- **Sign-in**: email and password, or an emailed code. Google and Apple sign-in are being added. (`docs/mobile-app.md`)
- The app uses the same session cookie and local storage described above in its embedded browser.
- The native app's only network use is sign-in via `/api/otp` from the same origin. (`docs/mobile-app.md`)
- The app menu links to the terms, contact, and account-deletion request.
- `[Owner confirmation needed: answers for Apple Privacy Labels and Google Data Safety, and their consistency with this policy]`

## 12. Deleting your account

- In the app: the "Request account deletion" button opens a WhatsApp chat to us with a ready message, and we contact you to confirm before any deletion. (`site/assets/js/app-bridge.js`)
- **The code currently has no automatic server-side account deletion.** `[Owner confirmation needed: the real deletion procedure (what is deleted and what is kept for legal obligations such as invoices and contracts), how long it takes, and whether an in-app deletion feature will be built before the App Store submission]`
- You can also write to us by email or WhatsApp (Section 14).

## 13. Changes to this policy

We may amend this policy. We will publish the new version here with its update date and notify you of material changes. `[Owner confirmation needed: notification method (email or in-app)]`

## 14. Contact

- Email: business@businesspartner.sa
- Phone and WhatsApp: 0530540231 (`https://wa.me/966530540231`)
- Address: Building 2978, Turki Ibn Abdullah Aal Saud St., Al Sulaimaniyah District, Riyadh 12234.
- Stated hours: Sunday to Thursday, 9 AM to 6 PM, and the smart advisor around the clock.

(Source: footer of `site/contact.html`.) `[Owner confirmation needed: a dedicated privacy mailbox such as privacy@, and who handles requests]`

---

# للمالك والمحامي فقط — يُحذف قبل النشر

## أسئلة للمالك

1. ما تاريخ سريان السياسة؟
2. ما رقم السجل التجاري، وهل عُيّن مسؤول لحماية البيانات؟
3. هل الدخول بنفاذ مفعّل للعملاء الآن؟
4. ماذا ستستلم من Apple عند إضافة الدخول بها (بريد حقيقي أم مستعار)؟
5. هل الدفع كله عبر نموذج مُيسّر المستضاف دون أن نخزّن أرقام البطاقات؟
6. هل يحتفظ مزوّد تفريغ الصوت بالتسجيل، وكم مدة؟
7. هل تشمل السياسة صفحة الوظائف ولوحة صاحب العمل (سير ذاتية وبيانات أصحاب العمل)؟
8. هل يراجع المحامي الأساس النظامي لكل غرض في جدول القسم 3 (الضريبة، الأمان، التحليلات)؟
9. هل يلزم طلب موافقة صريحة على عدّاد الزيارات بحسب اللوائح؟
10. هل صياغة «لا قرار آلي نهائياً ولا التزام بسعر دون اعتماد بشري» صحيحة لمسار الموقع الحالي؟
11. ما الحقول التي نرسلها إلى تمارا؟
12. هل يُستخدم DocuSign فعلاً أم هو تجهيز فقط؟
13. هل المراجعة القانونية جاهزة للإفصاح عن مشاركة البيانات مع الجهات الحكومية والمختصة؟
14. ما منطقة Azure OpenAI ومنطقة Azure Blob التي يستخدمها الموقع فعلاً؟
15. ما منطقة تشغيل دوال Vercel؟
16. أين تعالج Resend وNotion وMeta وn8n Cloud وGoogle ومُيسّر وتمارا والدفترة البيانات؟
17. ما الأساس النظامي للنقل خارج المملكة (ومنه قاعدة Supabase في طوكيو)، وما الضمانات التعاقدية، وهل يلزم إشعار أو موافقة؟
18. ما مدة الاحتفاظ بكل فئة (حسابات، طلبات، محادثات، عقود، فواتير، صوت، عدّاد، Notion، مستندات)، وما الحد النظامي للفواتير والعقود؟
19. ما الإجراءات الأمنية الإضافية القائمة فعلاً (نسخ احتياطي، صلاحيات الموظفين، دخول الإدارة، الإبلاغ عن الاختراق)؟
20. هل قائمة الحقوق ومدد الردّ صحيحة بحسب اللوائح؟
21. كم مدة ردّنا على طلبات الحقوق، وكيف نتحقق من هوية الطالب؟
22. ما الجهة المختصة بالشكاوى وطريقتها؟
23. ما السن المعتمدة للأطفال؟
24. هل نضيف شريط موافقة كوكيز؟
25. هل سيعمل الميكروفون داخل التطبيق، وهل ستُضاف أذونات له؟
26. ما إجابات Apple Privacy Labels وGoogle Data Safety؟
27. ما آلية حذف الحساب الفعلية (ما يُحذف وما يُحتفظ به ومدتها)، وهل تُبنى ميزة حذف داخل التطبيق قبل متجر آبل؟
28. بأي وسيلة ننبّه المستخدمين بتعديل السياسة؟
29. هل نعتمد بريداً مخصصاً للخصوصية ومسؤولاً عن الطلبات؟

## ما رأيته في الكود ويستحق انتباه المالك

1. **قاعدة بياناتنا الأساسية في طوكيو.** تحققت من لوحة Supabase: المنطقة `ap-northeast-1`. كل الحسابات والمحادثات والعقود خارج المملكة. هذا نقل بيانات عبر الحدود يحتاج أساساً نظامياً وإفصاحاً، ويستحق قراراً: نقل القاعدة، أو توثيق الأساس. الكود يدعم التحويل إلى PostgreSQL على Azure بمتغير `DB_DRIVER=azure` (`api/_db.js`)، ومنطقته غير معروفة.
2. **لا توجد صفحة خصوصية، ولا بند بيانات في الشروط الحالية.** `site/terms.html` عشرة بنود عن الاشتراك والخدمة، ولا تذكر جمع البيانات ولا مشاركتها ولا الذكاء الاصطناعي. و`app-bridge.js` ينتظر `PRIVACY_PATH` فارغاً، وآبل وجوجل تشترطان رابطاً. ولا يوجد حذف حساب آلي ولا مدة احتفاظ ولا تنظيف دوري لأي جدول، وزر الحذف في التطبيق يفتح واتساب فقط (آبل قد ترفضه، وفق `docs/mobile-app.md`).
3. **بيانات تذهب لأطراف ثالثة ولا تذكرها الشروط:** نص المحادثة والمستندات (هويات، سجلات تجارية) والصوت إلى Azure OpenAI؛ وإن تعطّل المسار الأول تذهب المحادثة إلى وكيل n8n Cloud (`api/_chat.js`: `callN8nBaher`)؛ والعملاء المحتملون وإيصالات التحويل البنكي المرفوعة إلى Notion بملفاتها (`api/requests.js`: `uploadFileToNotion`) في المسار القديم؛ وأرقام الجوال والرسائل إلى n8n وMeta؛ وعنوان IP إلى Google عند تحميل الخطوط وسكربت الدخول.
4. عنوان IP ونوع المتصفح يُخزَّنان في كل جلسة وفي توقيع كل عقد (`user_sessions`، `requests.contract.signature`) ولا حد لمدة بقائهما. وعدّاد الزيارات لا يخزّن IP، وهذا مطمئن.
5. **مسار تطبيق الجوال:** `AndroidManifest.xml` فيه إذن الإنترنت فقط، و`Info.plist` بلا أي وصف استخدام (`UsageDescription`)، بينما المحادثة فيها زر ميكروفون يستخدم `getUserMedia`. غالباً لن يعمل الميكروفون داخل التطبيق، وإن أُضيف الإذن وجب تحديث السياسة ونماذج المتاجر. ووثيقة `docs/mobile-app.md` تقول إن Sign in with Apple غير مطلوب لأن الدخول بالبريد، وهذا ينقلب بإضافة جوجل، وقد قلتَ إنه قيد الإضافة الآن.
6. `docs/mobile-app.md` يقول «Sign in with Apple غير مطلوب»، والتعليمات الحالية تقول إنه قيد الإضافة. يلزم تحديث الوثيقة.
7. الاستشارات والتوظيف: `api/candidate.js` و`api/employer.js` يجمعان سيراً ذاتية وبيانات أصحاب عمل (وتُرسل إلى Notion وwebhook n8n للـATS). وسياسة هذه المسودة لا تغطيها إلا بسؤال.
8. بيانات حساسة محتملة: المستندات المرفوعة قد تحوي هويات وجوازات وبيانات بنكية، وتُقرأ بنموذج لغوي في Azure. يفيد أن يراجع المحامي هل تُعدّ «بيانات حساسة» في النظام وما يلزمها من موافقة.
