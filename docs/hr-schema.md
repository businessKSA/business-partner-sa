# نموذج بيانات منصة التوظيف (ATS) — مقترح

الهدف: نموذج Multi-tenant يبدأ فوق Notion الحالي (قاعدة المرشّحين + قاعدة إعلانات الوظائف + قاعدة أصحاب العمل) ويصلح للنقل لاحقاً إلى Postgres دون تغيير الواجهة، لأن الواجهة تتعامل حصراً مع طبقة `HRStore` في `site/assets/js/hr-app.js`.

## مبادئ

- كل صف يحمل `organizationId` و`companyId` (و`branchId` عند الحاجة). لا يُرجع أي API صفاً خارج شركة المستخدم — العزل يتم في الخادم، وليس في الواجهة.
- الملفات (سير ذاتية، مستندات، عروض) تُخزَّن في تخزين ملفات (Vercel Blob / S3) ويُحفظ في القاعدة `storageKey + mime + size` فقط.
- كل إجراء حسّاس (رفض، توظيف، تنزيل بيانات، تعديل صلاحيات) يُسجَّل في `AuditLog`.

## الكيانات

| الكيان | الحقول الأساسية |
| --- | --- |
| Organization | id, name, createdAt |
| Company | id, organizationId, name, crNumber, city, logoUrl, plan, status |
| Branch | id, companyId, name, city |
| User | id, email, name, phone, passwordHash, lastLoginAt |
| Role | id, key (owner/hr_manager/recruiter/dept_manager/interviewer/external/viewer), name |
| Permission | id, roleId, action (see_salary, see_contacts, publish_job, reject_candidate, send_offer, export_data, manage_team, manage_company) |
| TeamMember | id, companyId, userId, roleId, branchId?, invitedBy, status |
| Job | id, companyId, branchId?, titleAr, titleEn, dept, category, country, city, workMode(onsite/remote/hybrid), type(full/part/flex/seasonal/intern), openings, salaryMin, salaryMax, salaryVisible, nationalityReq?, residencyReq?, sponsorshipTransferable?, experienceYears, qualification, languages[], skills[], requiredDocs[], status(draft/in_review/published/paused/expired/closed), postedAt, closesAt, hiringManagerId, createdBy |
| JobQuestion | id, jobId, text, type(text/select/boolean/number), required, disqualifying?, options[] |
| JobStage | id, jobId, key, label, order, color — يسمح بتخصيص مراحل كل وظيفة |
| Candidate | id, companyId (أو مشترك عبر talent pool المنصة), name, title, email, phone, city, country, nationality, residencyStatus, workPermit, relocatable, currentSalary?, expectedSalary?, noticeDays, source, tags[], hiddenFlags |
| CandidateResume | id, candidateId, storageKey, parsedText, atsVersionKey?, uploadedAt |
| CandidateExperience | id, candidateId, title, company, from, to, description |
| CandidateEducation | id, candidateId, degree, major, school, year |
| CandidateSkill | id, candidateId, skill, level? |
| Application | id, companyId, jobId, candidateId, stageKey, sideStageKey?, matchScore?, aiSummary?, source, appliedAt, unread, duplicateOf? |
| ApplicationAnswer | id, applicationId, questionId, answer |
| PipelineStage | (بديل JobStage على مستوى الشركة إن وُحّدت المراحل) |
| Interview | id, companyId, applicationId, type(onsite/call/video), at, durationMin, location/meetingUrl, panel[userId], status(pending/confirmed/done/no_show/cancelled), rescheduleOf? |
| InterviewEvaluation | id, interviewId, evaluatorId, rating1to5, strengths, concerns, recommendation(hire/no/maybe), notes, updatedAt |
| Note | id, companyId, candidateId, applicationId?, authorId, body, visibility(private/team), createdAt, editedAt |
| Message | id, companyId, candidateId, channel(email/whatsapp/platform), direction, templateId?, body, scheduledAt?, sentAt, status |
| MessageTemplate | id, companyId, name, channel, subject?, body (بمتغيرات {candidate_name}, {job_title}...) |
| Document | id, companyId, candidateId?, applicationId?, kind(cv/id/certificate/offer/other), storageKey, mime, size, uploadedBy |
| Offer | id, companyId, applicationId, baseSalary, allowances[], benefits[], startDate, validUntil, approvals[{userId,status,at}], status(draft/pending_approval/sent/accepted/declined/negotiating), signedDocId? |
| ActivityLog | id, companyId, actorId, entity, entityId, action, meta, at |
| Notification | id, userId, kind, entityRef, readAt?, at |
| Subscription | id, companyId, plan, billingPeriod, status, startedAt, renewsAt |
| AuditLog | id, companyId, actorId, action, entity, entityId, ip?, at — للأحداث الحسّاسة فقط |

## الربط بالموجود حالياً

- Candidate ⇐ قاعدة المرشّحين في Notion (`/api/candidates`).
- Job ⇐ قاعدة إعلانات الوظائف (`action:list-postings/create-posting`).
- Company/Subscription ⇐ قاعدة أصحاب العمل (`/api/employer`).
- Application.stage ⇐ خاصية Stage (`action:update-stage`) — تحتاج توسعة قيم المراحل لتطابق مراحل ATS أعلاه.
- ما لا يوجد له مقابل بعد (Interview, Offer, Message, Note, Team/Roles) يعمل حالياً من طبقة mock (`site/data/hr-mock.json` + localStorage) خلف نفس دوال `HRStore` — استبداله يعني تنفيذ endpoints بنفس التواقيع.

## كيانات المرحلة التالية (رؤية «أسهل نظام توظيف»)

| الكيان | الدور |
| --- | --- |
| RecruitmentRequest | طلب توظيف مستقل عن الوظيفة — الحقول: requestNumber, requestSource(EMPLOYER_SELF_SERVICE/BUSINESS_PARTNER_MANAGED_SERVICE/NOTION/EMAIL/WHATSAPP/MANUAL/API), serviceType(SELF_SERVICE/MANAGED_BY_BUSINESS_PARTNER), jobTitle, numberOfVacancies, متطلبات كاملة, urgency, assignedRecruiterId, status(NEW/NEEDS_INFORMATION/UNDER_REVIEW/WAITING_CLIENT_APPROVAL/APPROVED/SOURCING/SHORTLIST_READY/INTERVIEWING/OFFER_STAGE/FILLED/PARTIALLY_FILLED/ON_HOLD/CANCELLED/CLOSED), originalRequest (النص الطبيعي), generatedJobDescription, approvalStatus, linkedJobId |
| RecruitmentRequestComment / RecruitmentRequestAttachment | نقاش ومرفقات الطلب |
| CandidateConsent | الموافقات: تخزين، مشاركة مع أصحاب عمل، الغاية، التاريخ |
| CandidateIdentity | مفاتيح الهوية بعد الـ normalization (بريد/جوال/هوية/LinkedIn/بصمة CV) |
| CandidateSource | قيم candidateSource: WEBSITE_JOB_APPLICATION, WEBSITE_GENERAL_REGISTRATION, NOTION_IMPORT, MANUAL_ENTRY, CSV_IMPORT, GOOGLE_DRIVE, EMAIL_IMPORT, EMPLOYER_UPLOAD, BUSINESS_PARTNER_RECRUITER, REFERRAL, INVITED_TO_APPLY, EXTERNAL_JOB_BOARD, API |
| CandidateImport / ImportBatch / DataConflict | سجل الاستيراد والدفعات والتعارضات |
| CandidateMerge | دمج السجلات: primaryId, mergedIds, حالة (EXACT_MATCH/POSSIBLE_DUPLICATE/UNIQUE/NEEDS_HUMAN_REVIEW), قابلية التراجع, AuditLog |
| ParsedResume / ExtractedField | لكل حقل مستخرج: value, source, confidence, sourceSpan, reviewedBy, updatedAt. حالات المعالجة: UPLOADED/QUEUED/PROCESSING/NEEDS_OCR/NEEDS_REVIEW/COMPLETED/FAILED |
| NormalizedSkill / NormalizedJobTitle | قواميس توحيد المهارات والمسميات (عربي/إنجليزي/مرادفات/اختصارات) |
| MatchRun / MatchResult / MatchScoreComponent | تشغيلات المطابقة ونتائجها المفصلة (انظر المواصفة أدناه) |
| MatchFeedback | مناسب/غير مناسب/دُعي/قابل/عرض/وُظف/رفض/انسحب + السبب — لتحسين الأوزان لاحقاً (بدون تدريب نماذج على بيانات العملاء دون سياسة وموافقة) |
| MatchingProfile | أوزان مخصصة لكل شركة/وظيفة ضمن حدود منطقية |
| AutomationTemplate / AutomationRule / WorkflowRun / WorkflowStepRun | قوالب المسارات الثمانية وتشغيلاتها (المرحلة الحالية، الخطوة الجارية، الفاشلة، المحاولات، بانتظار إنسان) |
| ApprovalRequest | طلبات الاعتماد البشري (انظر مصفوفة الموافقات في hr-vision.md) |
| CommunicationLog / MessageTemplate | كل رسالة: القناة، المستلم، القالب، المتغيرات، وقت الإرسال، التسليم، القراءة، الرد، المرسل |
| IntegrationConnection / SyncRun | اتصالات Notion/البريد/التقويم/واتساب وتشغيلات المزامنة (syncStatus/lastSyncedAt/syncError) |
| ServiceSLA | اتفاقيات مستوى الخدمة للطلبات المدارة |

## مواصفة محرك المطابقة (Matchmaking Scoring Specification)

- **الاتجاهان**: Job→Candidate وCandidate→Job على نفس المكونات.
- **الأوزان الافتراضية** (قابلة للضبط ضمن حدود): المهارات 25، الخبرة 20، المسمى 10، المؤهل 10، الموقع 10، الإقامة/تصريح العمل 10، الراتب 5، اللغة 5، التوفر 5 = 100%.
- **أنواع الشروط**: MUST_HAVE (hard filter صريح — يعرض المرشح في فئة منفصلة ولا يُخفى)، PREFERRED، NICE_TO_HAVE.
- **حالات كل مكوّن**: MATCH / PARTIAL_MATCH / NO_MATCH / **UNKNOWN** — UNKNOWN لا يستبعد أبداً؛ يُعرض ويُطلب من المرشح.
- **نتيجة كل Match** تشمل: overallScore + درجات المكونات التسعة + matchedRequirements + missingRequirements + unknownRequirements + disqualifyingFactors + explanation + modelVersion + scoringVersion + generatedAt + reviewedBy + reviewStatus.
- **الفئات** (قابلة للتعديل): 85–100 قوية، 70–84 جيدة، 50–69 مراجعة، <50 ضعيفة.
- **العرض**: Breakdown بصري لكل مكوّن + «لماذا ظهر هذا المرشح؟» + زر إعادة الحساب مع تسجيل نسخة المحرك — لا نسبة غامضة وحدها.
- التنفيذ الحالي: `runMatch()/matchComponents()` في `site/assets/js/hr-app.js` (نسخة v1-mock تعمل على بيانات تجريبية؛ نفس العقد يُنقل للخادم).
