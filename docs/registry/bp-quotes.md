# bp-quotes — سجل المشروع

> **الغرض من هذا الملف:** المرجع الواحد لكل صفحة وخدمة تحت مسؤولية مشروع
> «نظام العروض والعقود والفواتير». يستعمله وكيل المشروع (ومَن يخلفه) لفهم
> النطاق قبل أي تعديل، ولمنع أي جلسة أخرى من امتلاك صفحة يملكها هذا المشروع.
>
> يُحدَّث الملف في نفس PR الذي يضيف صفحة أو خدمة، لا بعده.

**Project:** bp-quotes — العروض والعقود والفواتير
**Project Manager Agent:** bp-quotes Project Manager
**Department:** Revenue Operations (RevOps)
**Source of truth للتصميم:** `https://www.businesspartner.sa/ar` (الموقع الجديد)
**Status:** يعمل وظيفياً · يحتاج توحيداً بصرياً مع `/ar`

---

## البنية

اللوحة والبوابة تعملان حالياً كمشروع Vercel منفصل (`bp-quotes`) يُقدَّم
تحت الدومين الرئيسي عبر rewrite:

```
businesspartner.sa/quotes/*  →  bp-quotes-three.vercel.app/quotes/*
```

قاعدة البيانات: Supabase Postgres مستقلة (٢٥ جدول Prisma) — منفصلة عمداً
عن قاعدة الموقع الرئيسي.

---

## الوكلاء تحت المشروع (٢ + مدير)

| Agent | الصفحات المملوكة | الأنظمة المملوكة |
|---|---|---|
| **bp-quotes Admin Panel Agent** | `/quotes/admin/*` + `/quotes/d/[token]` + `/quotes/rfp/[token]` | Daftra، DocuSign، Notion Suppliers، Prisma (Admin) |
| **bp-quotes Customer Portal Agent** | `/quotes/portal/*` + قسم «عروضك وعقودك» في `/ar/account` | Tamara، Moyasar، Portal Auth، OTP |

**قاعدة صارمة:** كل صفحة أدناه لها Owner Agent واحد فقط. أي وكيل من خارج
هذين لا يعدّل هذه الصفحات إلا بموافقة مدير المشروع.

---

## سجل الصفحات

| Page | URL | Owner Agent | Status | Design |
|---|---|---|---|---|
| لوحة الإدارة | `/quotes/admin` | Admin Panel | Live | يحتاج توحيد مع `/ar` |
| كتالوج الخدمات | `/quotes/admin/catalog` | Admin Panel | Live | يحتاج توحيد |
| خريطة الكتالوج | `/quotes/admin/catalog/map` | Admin Panel | Live | يحتاج توحيد |
| العملاء | `/quotes/admin/clients` | Admin Panel | Live | يحتاج توحيد |
| عميل واحد | `/quotes/admin/clients/[id]` | Admin Panel | Live | يحتاج توحيد |
| تعديل عميل | `/quotes/admin/clients/[id]/edit` | Admin Panel | Live | يحتاج توحيد |
| عميل جديد | `/quotes/admin/clients/new` | Admin Panel | Live | يحتاج توحيد |
| مستند/عرض | `/quotes/admin/documents/[id]` | Admin Panel | Live | يحتاج توحيد |
| مستند جديد | `/quotes/admin/documents/new` | Admin Panel | Live | يحتاج توحيد |
| الفواتير | `/quotes/admin/invoices` | Admin Panel | Live | يحتاج توحيد |
| فاتورة جديدة | `/quotes/admin/invoices/new` | Admin Panel | Live | يحتاج توحيد |
| الموردون | `/quotes/admin/suppliers` | Admin Panel | Live | يحتاج توحيد |
| طلب توريد | `/quotes/admin/supply/[id]` | Admin Panel | Live | يحتاج توحيد |
| الوكيل المولّد | `/quotes/admin/agent` | Admin Panel | Live | يحتاج توحيد |
| سجل التدقيق | `/quotes/admin/audit` | Admin Panel | Live | يحتاج توحيد |
| دخول اللوحة | `/quotes/admin/login` | Admin Panel | Live | يحتاج توحيد |
| توقيع مستند برمز | `/quotes/d/[token]` | Admin Panel | Live | يحتاج توحيد |
| رد مورد على RFP | `/quotes/rfp/[token]` | Admin Panel | Live | يحتاج توحيد |
| بوابة العميل | `/quotes/portal` | Customer Portal | Live | يحتاج توحيد |
| دخول العميل | `/quotes/portal/login` | Customer Portal | Live | يحتاج توحيد |
| عروض العميل | `/quotes/portal/quotes` | Customer Portal | Live | يحتاج توحيد |
| عقود العميل | `/quotes/portal/contracts` | Customer Portal | Live | يحتاج توحيد |
| فواتير العميل | `/quotes/portal/invoices` | Customer Portal | Live | يحتاج توحيد |
| اختيار خدمة | `/quotes/portal/services` | Customer Portal | Live | يحتاج توحيد |
| الملف الشخصي | `/quotes/portal/profile` | Customer Portal | Live | يحتاج توحيد |
| السداد برمز | `/quotes/portal/pay/[token]` | Customer Portal | Live | يحتاج توحيد |
| قسم «عروضك وعقودك» | `/ar/account` (قسم داخلي) | Customer Portal | Live | ✅ موحّد جزئياً |

**Totals:** ٢٧ صفحة · ٢٦ يحتاج توحيداً بصرياً · ١ موحّد جزئياً.

---

## سجل الخدمات

| Service | Page | Portal | Automation | Status |
|---|---|---|---|---|
| إصدار عرض سعر | `/quotes/admin/documents/new` | Admin | — | Live |
| توقيع عقد إلكتروني | `/quotes/d/[token]` | عام برمز | DocuSign webhook | Live |
| فاتورة ضريبية | `/quotes/admin/invoices` | Admin | Daftra (تفويض) | Live |
| سداد بطاقة | `/quotes/portal/pay/[token]` | العميل | Moyasar webhook | Live |
| سداد بالتقسيط | `/quotes/portal/pay/[token]` | العميل | Tamara webhook | Live |
| طلب توريد بإعادة البيع | `/quotes/rfp/[token]` | عام | Notion supplier sync (n8n) | Live |
| اختيار خدمة من الكتالوج | `/quotes/portal/services` | العميل | — | Live |

---

## رحلة العميل الرسمية

```
/ar (الموقع الجديد)
   ↓
اختيار خدمة → طلب استشارة أو عرض سعر
   ↓
/quotes/portal/services
   ↓
دخول العميل (⚠️ حالياً دخول ثانٍ منفصل — الهدف: SSO مع /ar/account)
   ↓
العميل يرى عرضه → يوقّع → يستلم فاتورة → يدفع
   ↓
عودة إلى /ar/account
```

---

## التبعيات الخارجية

| النظام | الاستعمال | يبقى خارج Azure؟ |
|---|---|---|
| Daftra | إصدار الفاتورة الضريبية (زاتكا) | ✅ نعم — استثناء دائم |
| Tamara | السداد بالتقسيط | ✅ نعم — استثناء دائم |
| Moyasar | السداد بالبطاقة | ✅ نعم — استثناء دائم |
| DocuSign | التوقيع الإلكتروني | ✅ نعم — استثناء دائم |
| Notion (موردون) | مصدر بيانات الموردين | يُنقل إلى Azure AI Search لاحقاً |
| Azure OpenAI | توليد نص العرض/العقد عبر `agent.ts` | ✅ يعمل الآن (دُمج عبر PR #319 خارج هذه الجلسة) |
| Supabase Postgres | القاعدة | يُنقل إلى Azure PostgreSQL Flexible Server |
| Resend | البريد | يُنقل إلى Azure Communication Services (لم يبدأ) |

---

## المشاكل المفتوحة (Priority)

| # | المشكلة | Priority |
|---|---|---|
| ١ | الهوية البصرية للوحة والبوابة غير موحّدة مع `/ar` | **P0** |
| ٢ | دخول مزدوج بين الموقع واللوحة (لا SSO) | **P0** |
| ٣ | مفتاح Moyasar السرّي يحتاج تدويراً (كان في متغيّر خاطئ) | **P0** |
| ٤ | مشروع Vercel منفصل عبر rewrite — لا دمج حقيقي | **P1** |
| ٥ | بريد اللوحة ما زال على Resend، لم يُنقل إلى ACS | **P1** |
| ٦ | قراءة ملفات PDF متوقفة (تحتاج Azure Document Intelligence) | **P2** |

---

## Definition of Done (لتوحيد الهوية البصرية مع /ar)

المشروع يعتبر «موحّداً» عند تحقق **كل** ما يلي:

- [ ] Header و Navigation من `/ar` مطبَّقة على كل صفحات `/quotes/*`
- [ ] Footer الموحّد
- [ ] نظام ألوان `/ar` (لا الألوان الخاصة باللوحة)
- [ ] الخطوط من `/ar` بأحجام وأوزان `/ar`
- [ ] الأزرار والنماذج والبطاقات من مكوّنات `/ar`
- [ ] تجربة الدخول موحّدة (SSO مع `/ar/account`)
- [ ] Mobile يعمل على كل صفحة
- [ ] Arabic RTL يعمل
- [ ] لا رابط قديم مكسور
- [ ] لا Portal مكرر
- [ ] كل صفحة في هذا الملف لها Owner Agent مسجَّل

---

## مصادر مرجعية

- **تدقيق كامل للمحادثة الأصلية:** https://claude.ai/artifact/VAEfVxQE6NrNpC3mXcVa5E
- **السجل المختصر بالتواريخ:** https://claude.ai/artifact/T5oP2QCx1sKKVjgpqyWiAa
- **صفحة الجلسة في نوشن:** https://app.notion.com/p/3cfd108dee5c81f29259e95f6954700e
- **الجلسة الأصلية:** `session_018sMghkDU4jWhGdB8rfV1ia`

## قاعدة تحديث هذا الملف

- أي إضافة صفحة أو خدمة أو تغيير Owner Agent = يُحدَّث هذا الملف في نفس PR.
- المراجعة الدورية: مدير المشروع يفحص كل صفحة في الجدول ويؤكد أن Owner لم يتغيّر.
- ممنوع: صفحة تحت `/quotes/*` بلا سطر في هذا الجدول.
