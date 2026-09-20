# جرد قواعد Notion وخطة الربط (Data Mapping)

> **Discovery فقط — لم تُنفذ أي مزامنة أو تعديل على Notion.** الجرد أدناه من الفحص الفعلي للقواعد المستخدمة حالياً في الـ APIs (أسماء الحقول الحقيقية، غير مفترضة). حالة الاستيراد لكل القواعد: `NOT_STARTED`.

## 1) جرد القواعد (Notion Database Inventory)

| القاعدة | المعرف (database id) | الحجم التقريبي | الاستخدام الحالي |
| --- | --- | --- | --- |
| بنك السير الذاتية (CV Bank) | المعرف في `api/candidates.js` (`DB_ID`) | ~17,000+ صف ويتزايد | مصدر المرشحين للوحة الحالية والموقع |
| إعلانات الوظائف (Job Postings) | `260d7695-9d46-4631-943f-79f313fbf3c9` (data source `c80d4586…`) | ~40+ | وظائف أصحاب العمل، فيها relation «المرشحون المطابقون» |
| أصحاب العمل — الاشتراكات (Employers) | `f1104f8b-cc3d-4beb-84ac-cdbda0aa8322` | صغيرة | حسابات/رموز وصول/باقات + hash كلمات المرور |
| مسار المرشحين (Pipeline/ATS) | `c4346abd…` (data source `df99c600…`) | متوسطة | سجلات وكلاء n8n (Sourcing/Headhunter): مراحل، مقابلات |
| حملة توظيف الورشة (Workshop Campaign) | `f83bce33-eab7-481a-8b80-3495c6cd7619` | 43 دور / 186 موظفاً | مصدر فيد Indeed/Google for Jobs |

## 2) مصفوفة الربط (Data Mapping Matrix)

الاتجاهات: `N→P` (من Notion إلى قاعدة الموقع)، `P→N` (العكس)، `2W` (ثنائي). قاعدة التعارض الافتراضية: **قاعدة الموقع تغلب بعد الاستيراد الأول** (Notion يغلب في الاستيراد الأول فقط). PII = بيانات شخصية.

### CV Bank → Candidate / CandidateResume

| حقل Notion | النوع | كيان النظام | حقل النظام | اتجاه | تعارض | PII | حالة |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (title) | title | Candidate | name | N→P | أول استيراد فقط | نعم | NOT_STARTED |
| Email | email | Candidate | email (+مفتاح التكرار) | N→P | لا يتغير | نعم | NOT_STARTED |
| Phone | phone | Candidate | phone (+مفتاح التكرار) | N→P | لا يتغير | نعم | NOT_STARTED |
| Field | select | Candidate | fieldNormalized | N→P | الموقع يغلب | لا | NOT_STARTED |
| City / Country | rich_text | Candidate | city/country | N→P | الموقع يغلب | جزئي | NOT_STARTED |
| Nationality Type | select | Candidate | nationalityType | N→P | الموقع يغلب | نعم (حساس) | NOT_STARTED |
| Candidate ID | number/text | Candidate | externalRef | N→P | ثابت | لا | NOT_STARTED |
| مخفي عن الموقع | checkbox | Candidate | hiddenFlags.unparsable | 2W | الموقع يغلب | لا | NOT_STARTED |
| CV file/link | files/url | CandidateResume | storageKey (يُنقل للتخزين) | N→P | ثابت | نعم | NOT_STARTED |

### Job Postings → Job

| حقل Notion | النوع | كيان | حقل | اتجاه | تعارض | PII | حالة |
| --- | --- | --- | --- | --- | --- | --- | --- |
| العنوان الوظيفي | title | Job | titleAr | 2W | الموقع يغلب | لا | NOT_STARTED |
| الشركة | rich_text | Company | name (ربط بالشركة) | N→P | أول استيراد | لا | NOT_STARTED |
| المدينة / المجال | rich_text/select | Job | city / category | 2W | الموقع يغلب | لا | NOT_STARTED |
| الحالة (نشطة/مغلقة) | select | Job | status | 2W | الموقع يغلب | لا | NOT_STARTED |
| رمز صاحب العمل | rich_text | Job | companyId (عبر جدول الرموز) | N→P | ثابت | لا | NOT_STARTED |
| الوصف والمتطلبات | rich_text | Job | description | 2W | الموقع يغلب | لا | NOT_STARTED |
| تاريخ النشر | date | Job | postedAt | N→P | ثابت | لا | NOT_STARTED |
| المرشحون المطابقون (relation) | relation | MatchResult | candidateIds | P→N | الموقع مصدر | لا | NOT_STARTED |

### Employers → Company / Subscription / User

| حقل Notion | النوع | كيان | حقل | اتجاه | تعارض | PII | حالة |
| --- | --- | --- | --- | --- | --- | --- | --- |
| اسم الشركة | title | Company | name | N→P | الموقع يغلب | لا | NOT_STARTED |
| البريد / الجوال / جهة الاتصال | email/phone/rich_text | User | email/phone/name | N→P | الموقع يغلب | نعم | NOT_STARTED |
| رمز الوصول | rich_text | Subscription | accessCode | 2W | الموقع يغلب | لا | NOT_STARTED |
| الباقة / الحالة | select | Subscription | plan/status | 2W | **Notion يغلب** (تفعيل يدوي من الفريق) | لا | NOT_STARTED |
| بيانات الدخول (scrypt hash) | rich_text | User | passwordHash | N→P ثم يُدار في الموقع | الموقع يغلب | نعم (سري) | NOT_STARTED |
| السجل التجاري | rich_text | Company | crNumber | N→P | الموقع يغلب | نعم | NOT_STARTED |

### Pipeline (ATS agents) → Application / Interview

| حقل Notion | النوع | كيان | حقل | اتجاه | تعارض | PII | حالة |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name/Email/Phone | title/email/phone | Candidate (ربط عبر محرك التكرار) | — | N→P | محرك التكرار يقرر | نعم | NOT_STARTED |
| Stage (New/AI Screened/Interested/Call Scheduled/…) | select | Application | stageKey (خريطة قيم) | 2W | الموقع يغلب | لا | NOT_STARTED |
| Score / ملاحظات | number/rich_text | Application | matchScore/notes | N→P | أول استيراد | لا | NOT_STARTED |
| Source (LinkedIn Headhunt/بوابة…) | select | Application | source→candidateSource | N→P | ثابت | لا | NOT_STARTED |

### Workshop Campaign → RecruitmentRequest

| حقل Notion | كيان | ملاحظة | حالة |
| --- | --- | --- | --- |
| الدور/العدد/حالة النشر/JD | RecruitmentRequest + Job | كل دور = طلب توظيف بحالة SOURCING مربوط بوظيفة منشورة | NOT_STARTED |

## 3) خطة التنفيذ الآمنة (مرحلة 4)

1. **Read-only discovery** ✅ (هذه الوثيقة) — بدون أي كتابة على Notion.
2. **Dry run**: سكربت يقرأ عينة 50 صفاً من كل قاعدة ويطبع الـ mapping الناتج دون حفظ.
3. **Import preview**: تقرير فروقات + نتائج محرك التكرار (EXACT/POSSIBLE/UNIQUE/NEEDS_HUMAN_REVIEW) للاعتماد.
4. **دفعة تجريبية صغيرة** (100 مرشح) ← تحقق يدوي.
5. **استيراد كامل** مع ImportBatch + SyncRun لكل تشغيل، وIdempotency على `notionPageId`.
6. **مزامنة لاحقة** عبر n8n (workflow موثق باسم/Owner/Retry/DLQ) حسب الاتجاهات أعلاه فقط.

مخاطر معروفة: rate limit Notion (~3 rps) على 17k صف → مزامنة تدريجية بمؤشر آخر تعديل؛ حقول التواصل مخفية عن غير المشتركين — تُحترم في طبقة الصلاحيات وليس بالحذف؛ لا توجد قاعدة Production بعد (قرارها ضمن مرحلة 1 الفعلية — التوصية: Postgres على Neon/Supabase مع Vercel).
