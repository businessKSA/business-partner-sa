# تكامل DocuSign eSignature — دليل الإعداد

النظام يتصل بـ **DocuSign eSignature REST API** عبر **JWT Grant**.
التكامل معزول بالكامل في `src/lib/docusign/` — إذا تعطّلت DocuSign يبقى النظام
شغالاً ويظهر تنبيه في لوحة التحكم وفي صفحة المستند.

## أوضاع التشغيل الثلاثة

| `DOCUSIGN_MODE` | الوصف | متى تستخدمه |
|---|---|---|
| `mock` | محاكاة محلية كاملة لدورة التوقيع بلا حساب DocuSign | الاختبار المحلي والتطوير |
| `demo` | بيئة DocuSign التجريبية (`account-d.docusign.com`) | إثبات دورة توقيع كاملة قبل الإنتاج |
| `production` | بيئة الإنتاج | بعد نجاح دورة التجربة |

ابدأ دائماً بـ `demo` وأثبت دورة توقيع كاملة قبل التحويل للإنتاج.

---

## الخطوة 1 — حساب المطوّر وIntegration Key

1. أنشئ حساباً مجانياً على <https://developers.docusign.com> ثم ادخل
   **Apps and Keys** من إعدادات الحساب.
2. اضغط **Add App and Integration Key**، وسمِّ التطبيق (مثلاً
   `Business Partner Quotes`).
3. انسخ **Integration Key** (بصيغة GUID) →
   ضعه في `DOCUSIGN_INTEGRATION_KEY`.

## الخطوة 2 — مفتاح RSA الخاص

1. في صفحة التطبيق نفسها، ضمن **Authentication**، اختر
   **Generate RSA** ضمن قسم **Service Integration**.
2. انسخ **Private Key** كاملاً (يبدأ بـ `-----BEGIN RSA PRIVATE KEY-----`).
   لن تستطيع رؤيته مرة أخرى بعد إغلاق النافذة.
3. احفظه في ملف خارج المستودع، مثلاً `quotes/secrets/docusign_private.key`،
   ثم اضبط `DOCUSIGN_PRIVATE_KEY_PATH="./secrets/docusign_private.key"`.
   بديلاً يمكن وضع المحتوى نفسه في `DOCUSIGN_PRIVATE_KEY` مع `\n` بدل الأسطر.

> مجلد `secrets/` مستبعد من Git في `.gitignore`. لا ترفع المفتاح الخاص إطلاقاً.

## الخطوة 3 — Redirect URI

في صفحة التطبيق، ضمن **Additional settings → Redirect URIs**، أضف:

```
http://localhost:3000/api/docusign/consent-callback
https://<نطاقك>/api/docusign/consent-callback
```

## الخطوة 4 — User ID وAccount ID

- **User ID (API Username)**: من **Apps and Keys**، أعلى الصفحة تحت
  **My Account Information** → انسخ **User ID** (GUID) إلى
  `DOCUSIGN_USER_ID`. هذا هو المستخدم الذي سينتحل النظام صفته (impersonation).
- **Account ID (API Account ID)**: في نفس القسم → انسخه إلى
  `DOCUSIGN_ACCOUNT_ID`.

## الخطوة 5 — منح الموافقة (Consent) لمرة واحدة

JWT Grant لا يعمل قبل أن يمنح المستخدم المنتحَلة صفته الموافقة مرة واحدة.

1. شغّل النظام واضبط المتغيرات أعلاه مع `DOCUSIGN_MODE="demo"`.
2. افتح الرابط التالي في المتصفح (استبدل `<INTEGRATION_KEY>`):

```
https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<INTEGRATION_KEY>&redirect_uri=http://localhost:3000/api/docusign/consent-callback
```

3. سجّل الدخول بحساب المطوّر واضغط **Accept**.
4. ستُعاد إلى صفحة تؤكد نجاح منح الموافقة.

إذا حاول النظام إصدار رمز قبل ذلك، تظهر رسالة `consent_required` مصحوبة
بالرابط الصحيح جاهزاً للفتح.

> للإنتاج استبدل `account-d.docusign.com` بـ `account.docusign.com`
> واضبط `DOCUSIGN_API_BASE="https://<region>.docusign.net/restapi"`.

## الخطوة 6 — DocuSign Connect (Webhook)

النظام يرفق `eventNotification` داخل كل ظرف، فلا حاجة لإعداد Connect يدوياً
في أغلب الحالات. عنوان الاستقبال:

```
https://<نطاقك>/api/docusign/webhook
```

الأحداث المستقبَلة: `sent` · `delivered` · `completed` · `declined` · `voided`.

للتحقق من صحة الطلبات، فعّل **HMAC** في
**Settings → Connect → Keys**، وانسخ المفتاح إلى
`DOCUSIGN_CONNECT_HMAC_KEY`. عندها يتحقق النظام من ترويسة
`X-DocuSign-Signature-1` ويرفض أي طلب غير موقّع.
عند ترك المتغير فارغاً يُقبل الطلب بلا تحقق (مناسب للتطوير فقط).

> في التطوير المحلي استخدم نفقاً مثل `ngrok` لتصل DocuSign إلى جهازك،
> واضبط `APP_URL` على عنوان النفق قبل إنشاء الظرف.

---

## علامات الربط (Anchor Tags)

مواضع التوقيع والتاريخ محددة بعلامات نصية مخفية بلون أبيض داخل قالب العقد،
فتثبت الحقول مهما تغيّر طول العقد:

| العلامة | الموضع |
|---|---|
| `/sig_client/` | توقيع الطرف الثاني (العميل) |
| `/date_client/` | تاريخ توقيع الطرف الثاني |
| `/sig_bp/` | توقيع الطرف الأول (بزنس بارتنر) |
| `/date_bp/` | تاريخ توقيع الطرف الأول |

العلامات معرّفة في `src/components/DocumentView.tsx` داخل كتلة التوقيعات،
وتنسيقها في `.anchor` ضمن `src/app/globals.css`.

**ملاحظة مهمة عن العربية:** كل علامة موضوعة في سطر مستقل مع
`direction: ltr` و`unicode-bidi: isolate`. بدون ذلك يفصل خوارزم الاتجاهين
(bidi) الشرطة المائلة الأخيرة عن الاسم داخل الـPDF، فتصبح `/sig_client /`
ولا تلتقطها DocuSign. يتحقق اختبار القبول من أن السلاسل الأربع متصلة حرفياً.

## ترتيب التوقيع

1. **الموقّع الأول:** العميل — الاسم والبريد من بطاقة العميل.
2. **الموقّع الثاني:** باهر مقنص — `Business@businesspartnerksa.com`.

الظرف يُنشأ بـ `routingOrder` ‏1 ثم 2، فلا يصل الطرف الثاني قبل توقيع الأول.

## طريقتا التوقيع

- **بريد DocuSign الرسمي:** الافتراضي عند إنشاء الظرف بـ `embedded = false`.
- **التوقيع المدمج (Embedded Signing):** الافتراضي في النظام. رابط التوقيع
  يُفتح مباشرة من صفحة العقد عبر
  `/api/docusign/sign?envelope=<id>&who=client|bp`.

## عند اكتمال التوقيع

عند وصول `completed` يقوم النظام تلقائياً بـ:

1. تنزيل **النسخة الموقّعة النهائية** (`documents/combined`).
2. تنزيل **شهادة الإتمام** (`documents/certificate`).
3. حفظهما في `<مجلد العميل>/contracts/`.
4. إرسالهما بالبريد للطرفين.
5. تحديث حالة العقد إلى **موقّع** وتسجيل الحدث في الخط الزمني وسجل التدقيق.

## استكشاف الأعطال

| الرسالة | السبب والحل |
|---|---|
| `consent_required` | لم تُمنح الموافقة — افتح رابط الموافقة في الخطوة 5 |
| `invalid_grant` | المفتاح الخاص لا يطابق Integration Key، أو `DOCUSIGN_USER_ID` خاطئ |
| `PARTNER_AUTHENTICATION_FAILED` | `DOCUSIGN_ACCOUNT_ID` خاطئ أو الحساب في بيئة أخرى |
| `ANCHOR_STRING_NOT_FOUND` | تغيّر قالب العقد وحُذفت العلامات — راجع كتلة التوقيعات |
| لا تصل تحديثات الحالة | `APP_URL` غير قابل للوصول من الإنترنت — استخدم نفقاً |
