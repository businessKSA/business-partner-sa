# المصادر والتكاملات والأتمتة وOnboarding — المعمارية والـ Schema

> امتداد لـ `hr-vision.md` و`hr-schema.md`. المبدأ: **كل شيء يمر عبر Business Partner Recruitment OS** — كل منصة/حملة/رسالة/إحالة تدخل النظام، يُحفظ مصدرها الحقيقي ومسارها، ثم مطابقة → تواصل → توظيف → Onboarding سعودي. **ممنوع Scraping أو Browser Automation أو مشاركة كلمات مرور** — قنوات رسمية فقط: APIs، Webhooks، Feeds، Email Ingestion، روابط تقديم متتبعة.

## 1) الإسناد (Attribution)

- حقول Candidate/Application: `firstTouch{Source,Channel,CampaignId,At}`, `lastTouch{...}`, `applicationSource`, `candidateSource`, `sourcePlatform/Account/JobId/ApplicationId/MessageId/ConversationId/ReferralId`, `sourceUrl`, `landingPageUrl`, `referrerUrl`, `utm{Source,Medium,Campaign,Content,Term}`, `clickId`, `trackingToken` (موقّع، بلا PII), `referralCode`, `deviceType`, `country`, `city`, `attributionConfidence`, `attributionMethod`.
- **Source Registry** مفتوح (جدول، ليس enum مغلقاً) — القيم المعتمدة الأولية: WEBSITE_ORGANIC/WEBSITE_JOB_APPLICATION/WEBSITE_GENERAL_REGISTRATION/EMAIL_INBOUND/EMAIL_CAMPAIGN/WHATSAPP_INBOUND/WHATSAPP_CAMPAIGN/EMPLOYEE_REFERRAL/EXTERNAL_REFERRAL/RECRUITER_REFERRAL/LINKEDIN_ORGANIC/LINKEDIN_JOB/LINKEDIN_RECRUITER/INDEED/SABBAR/JADARAT/BAYT/GULFTALENT/NAUKRIGULF/SOCIAL_MEDIA/INSTAGRAM/FACEBOOK/X_TWITTER/TIKTOK/SNAPCHAT/GOOGLE_ADS/META_ADS/JOB_FAIR/UNIVERSITY/RECRUITMENT_AGENCY/NOTION_IMPORT/CSV_IMPORT/GOOGLE_DRIVE/MANUAL_ENTRY/API/OTHER.
- `CandidateTouchpoint`: سطر لكل تفاعل (id, organizationId, candidateId, applicationId, jobId, sourceId, channel, direction, eventType, campaignId, messageId, conversationId, externalEventId, occurredAt, metadata, consentStatus, createdBy, workflowRunId). الأحداث: AD_IMPRESSION → … → ONBOARDING_COMPLETED (القائمة الكاملة في المتطلبات، مطبّقة كقاموس في الكود).
- `firstTouchSource` **لا يُستبدل أبداً**؛ التقارير بثلاثة نماذج: First-touch / Last-touch / Multi-touch.

## 2) الحملات والإحالات

- كيانات: RecruitmentCampaign, CampaignChannel, CampaignLink, CampaignAudience, CampaignMessage, CampaignCost, CampaignEvent, CampaignPerformance — مع مقاييس (مشاهدات/نقرات/بدء تقديم/اكتمال/مؤهلون/مقابلات/عروض/تعيينات/تكلفة لكل متقدم-مؤهل-تعيين).
- رابط متتبع مختلف لكل (وظيفة × منصة × حملة × إعلان × Recruiter × شريك إحالة): `/jobs/{slug}?utm_source=…&utm_medium=…&utm_campaign=…&tracking_token=SIGNED` — التوكن موقّع HMAC بلا بيانات شخصية.
- الإحالات: ReferralProgram, Referral, Referrer (أنواع: موظف/مرشح/شريك BP/وكالة/جامعة/Influencer/عميل/Recruiter داخلي) بحقول referralCode/Link/Source, referrerType/Id, referredCandidateId/JobId, status (أُنشئ الرابط → دخل → بدأ → أكمل → مؤهل → قوبل → وُظف → اجتاز الاستحقاق → مكافأة مستحقة → دُفعت / غير مستحق بسبب), rewardEligibility/Status. **لا يرى المُحيل بيانات سرية أو أسباب رفض تفصيلية.**

## 3) البريد وواتساب

- **Email Ingestion** (Gmail الحالي عبر n8n، والبيانات النهائية في قاعدة النظام): Aliases متتبعة (jobs@ / candidates@ / onboarding@ / job-[code]@). مسار الوارد: تحقق من المرسل → حدد الوظيفة/الحملة → استخرج النص والمرفقات → افحصها → **ابحث عن المرشح قبل الإنشاء** (بريد/جوال/LinkedIn/بصمة CV/مكرر محتمل) → Touchpoint → اربط بالمرشح والتطبيق → حلل السيرة → مهمة مراجعة عند الحاجة → تأكيد استلام → احفظ Gmail Thread/Message ID.
- **WhatsApp Cloud API** الرسمي: كل رسالة مربوطة بـ candidateId/applicationId/jobId/campaignId/conversationId/messageId/templateId/direction/deliveryStatus/readStatus/consentStatus/sentAt/receivedAt/sourceWorkflow. المساعد: يقرأ سجل المرشح قبل الرد، لا يكرر الأسئلة، سؤال واحد واضح، يحترم Opt-in/out، يحوّل للإنسان في الحساس، **لا يرسل عرضاً أو رفضاً نهائياً دون موافقة**.

## 4) مصفوفة التكاملات (Integrations Matrix)

| المنصة | النوع | الحالة | ملاحظة |
| --- | --- | --- | --- |
| موقع BP | مدمج | OFFICIAL_API_AVAILABLE | صفحات التقديم + الفيدات تعمل |
| Notion | API رسمي | OFFICIAL_API_AVAILABLE | مزامنة عبر n8n وفق `hr-notion-mapping.md` |
| Gmail | Email Ingestion | EMAIL_INGESTION_ONLY | مربوط عبر n8n (وكيل الفرز الحالي) |
| WhatsApp Cloud | API + Webhook | WEBHOOK_AVAILABLE | بانتظار اعتماد قالب Meta |
| Google Calendar | API رسمي | OFFICIAL_API_AVAILABLE | حجز المقابلات يعمل (وكيل n8n) |
| Indeed | XML Feed | FEED_AVAILABLE | `/jobs-feed.xml` جاهز — يحتاج تسجيله في حساب صاحب العمل |
| LinkedIn | Connector جاهز | PARTNER_APPROVAL_REQUIRED | لا يُدّعى عمله قبل اعتماد الشريك؛ مؤقتاً روابط متتبعة |
| صبّار / جدارات / Bayt / GulfTalent / Naukrigulf | حسب المنصة | TRACKED_LINK_ONLY / MANUAL_IMPORT | حتى توفر API رسمي |
| Meta/Google/TikTok/Snap Ads | روابط متتبعة + تقارير تكلفة API | TRACKED_LINK_ONLY | تُرقّى لاحقاً |

كل Connector يدعم (حسب الإمكانية الرسمية): نشر/تحديث/إغلاق وظيفة، استقبال متقدمين، استيراد سير، Webhooks، مزامنة إحصائيات وتكاليف، اختبار اتصال، آخر مزامنة، أخطاء، إعادة محاولة، إيقاف. حالات الصحة: Healthy/Delayed/Authentication Required/Rate Limited/Partially Failed/Failed/Disabled. **لا أسرار في الواجهة أو اللوقز.**

## 5) الأتمتة الداخلية (Event-driven)

أمثلة مطبّقة في الخريطة: `APPLICATION_COMPLETED` → فحص تكرار → تحليل CV → مطابقة → ملخص → تأكيد → إشعار → مهمة مراجعة → SLA. `MATCH_SCORE_ABOVE_THRESHOLD` → وسم + طلب مراجعة (لا إرسال للمرشح قبل الاعتماد). `INTERVIEW_BOOKED` → Calendar + دعوة + تذكير + Interview Kit + إخطار اللجنة + نموذج تقييم. `OFFER_ACCEPTED` → Hired → إغلاق الشاغر → Preboarding → رحلة Onboarding → مستندات → مهام HR/GRO/IT/Finance → إشعارات → إيقاف رسائل التوظيف → تحديث التقارير والمصدر.
- **Automation Inbox** (مبنية في `/hr/employer/automations`): موافقات، نواقص، تكاملات فاشلة، متأخرون، تقييمات مقابلات، عروض، Onboarding، معاملات حكومية.
- كل Workflow **Idempotent** (Idempotency key) — إعادة Webhook لا تكرر مرشحاً/تطبيقاً/رسالة/مقابلة/موظفاً/مهمة.
- التقسيم: التطبيق = قاعدة البيانات/الصلاحيات/الحالات/Attribution/Matchmaking/Audit/Approvals/Multi-tenancy. n8n = Gmail/WhatsApp/Calendar/Drive/Notion Sync/إشعارات/Webhooks/تقارير مجدولة.

## 6) من مرشح إلى موظف + Onboarding السعودي

المسار: Candidate → Application → Offer → **Hire** → **Preboarding** → **Employee** → **Onboarding** (بدون ملف منفصل مقطوع الصلة؛ يُحفظ التاريخ وتُفصل صلاحيات بيانات التوظيف عن بيانات الموظف).

- **تصنيف قبل الرحلة** (قالب مختلف لكل حالة، لا Checklist واحدة): سعودي / خليجي / مقيم بنقل خدمات / مقيم بدون نقل / خارج المملكة بتأشيرة / مؤقت / جزئي / مرن / متدرب / عن بعد / موسمي / أجير-مزود قوى عاملة.
- **المراحل الخمس**: قبل المباشرة (العرض والمستندات والموافقات والفحوصات) → الجاهزية النظامية (العقد وتوثيق قوى، التأمينات، التأمين الطبي، تصريح العمل/نقل الخدمات، مقيم/أبشر أعمال، أجير، الرواتب ومدد وحماية الأجور، فترة التجربة والتنبيهات) → الجاهزية الداخلية (HR/IT/Finance/Manager/Employee) → يوم المباشرة → ما بعد المباشرة (7/30/60/90 وقرار التجربة).
- **حكومي**: لا تنفيذ آلي إلا عبر API/مزود معتمد وصلاحية رسمية؛ وإلا مهمة موجهة بمسؤول وخطوات وإثبات إنجاز ورقم مرجعي وتحقق بشري — **لا تخزين بيانات دخول المنصات الحكومية**.
- **الحالات** (مطبقة في اللوحة): NOT_STARTED … CANCELLED (العشرون حالة)، وكل BLOCKED يحمل السبب/المسؤول/الإجراء/الموعد/الخطورة/الأثر.
- **بوابة الموظف الجديد (Preboarding Portal)**: عرض وقبول العرض، تعبئة البيانات، رفع ومراجعة المستندات، حالة العقد، مهام ما قبل المباشرة، السياسات والإقرارات، خطة اليوم الأول، تواصل HR — بلغة بسيطة («جارٍ استكمال تسجيلك في التأمينات الاجتماعية» وليس أسماء الأنظمة الداخلية).

## 7) الكيانات المضافة

SourceRegistry, CandidateTouchpoint, RecruitmentCampaign, CampaignChannel, CampaignLink, CampaignEvent, CampaignCost, ReferralProgram, Referral, Referrer, ExternalPlatform, IntegrationConnector, IntegrationAccount, IntegrationEvent, IntegrationSyncRun, ExternalJobPosting, ExternalApplication, AttributionRecord, Hire, Employee, EmployeeDocument, PreboardingCase, OnboardingTemplate, OnboardingCase, OnboardingStage, OnboardingTask, OnboardingDependency, GovernmentProcess, GovernmentTransaction, GovernmentTransactionEvidence, PayrollProfile, BenefitEnrollment, EquipmentRequest, EmployeeAcknowledgment, ProbationPlan, ProbationReview.

## 8) التقارير

مصادر: عدد/مؤهلون/مقابلات/عروض/تعيينات لكل مصدر، معدلات تحويل، وقت التوظيف، تكلفة متقدم/تعيين، جودة التعيين، First vs Last touch، أداء الحملات وشركاء الإحالة (شاشة المصادر مبنية؛ التكلفة تتفعّل مع الحملات). Onboarding: متوسط المدة، اكتمال ما قبل المباشرة، التأخيرات بأسبابها (عقود/تأمينات/طبي/رواتب/IT)، اجتياز التجربة، رضا الموظف، أداء الأقسام.

## 9) خطة التنفيذ (بالترتيب)

1. Source Registry + CandidateTouchpoint ✅ (نموذج + شاشات mock)
2. Attribution على Candidate/Application ✅ (schema + تبويب «الرحلة والمصدر»)
3. Campaign Tracking Links → 4. Website Applications → 5. Gmail Ingestion → 6. WhatsApp Cloud → 7. Referral System → 8. Integration Hub ✅ (شاشة بحالات صادقة) → 9. Connectors رسمية → 10. Internal Automation Engine (Inbox ✅ mock) → 11. Hire/Employee conversion → 12. Onboarding سعودي ✅ (لوحة + حالات + قوالب mock) → 13. Preboarding Portal → 14. تقارير Attribution/Onboarding ✅ (شاشة المصادر) → 15. اختبارات عدم التكرار وعزل العملاء.

**قواعد أثناء التطوير**: لا إرسال حقيقي، لا استيراد شامل، بيانات اختبار + Preview + Feature Flags فقط.
