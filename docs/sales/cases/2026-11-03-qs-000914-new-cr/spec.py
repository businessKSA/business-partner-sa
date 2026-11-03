# -*- coding: utf-8 -*-
"""CL-0038 — نموذج سريع QS-000914: إصدار سجل تجاري جديد (BP-SBC-02). هوية العميل ونوع الكيان والنشاط غير معروفة (البيانات في Notion/ops)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-_engine"))
from blocks import *

SCOPE = [
    ("Review of the request", "مراجعة الطلب",
     "Reviewing the details of the new commercial registration you need: the entity type (establishment or company), the activity and the owner details, and confirming the service path before filing.",
     "مراجعة تفاصيل السجل التجاري الجديد المطلوب: نوع الكيان (مؤسسة أو شركة) والنشاط وبيانات المالك، وتأكيد مسار الخدمة قبل التقديم."),
    ("Filing", "التقديم",
     "Preparing the commercial registration application, submitting it through the Saudi Business Center (Ministry of Commerce) and following it up until the commercial registration is issued.",
     "إعداد طلب السجل التجاري وتقديمه عبر المركز السعودي للأعمال (وزارة التجارة) ومتابعته حتى صدور السجل التجاري."),
    ("Updates & handover", "المتابعة والتسليم",
     "Keeping the Client informed of the application status step by step, and handing over the issued commercial registration.", "إبلاغ العميل بحالة الطلب أولاً بأول، وتسليم السجل التجاري الصادر."),
]
DELIV = [("The issued commercial registration.", "السجل التجاري الصادر."),
         ("A summary of the registration data and of any next steps.", "ملخص بيانات السجل وأي خطوات لاحقة.")]
REQ = [
    ("Copy of the owner’s national ID or residence permit, and contact details; authorising us to file and follow up on the Client’s behalf.",
     "صورة هوية المالك الوطنية أو إقامته وبيانات التواصل؛ وتفويضنا بالتقديم والمتابعة نيابة عن العميل."),
    ("The entity type, the activity, and the trade name or the options proposed.", "نوع الكيان والنشاط والاسم التجاري أو الخيارات المقترحة."),
    ("The business address and the national address of the establishment, if available.", "عنوان النشاط والعنوان الوطني للمنشأة إن وُجد."),
    ("If any owner is not a Saudi national, please tell us before signing: the service path and this quotation may change.",
     "إن كان أي مالك غير سعودي فيُرجى إبلاغنا قبل التوقيع: فقد يتغيّر مسار الخدمة وهذا العرض."),
]
EXCL = [
    ("Government fees and the entities’ charges: not included in the price and paid by the Client directly to the entities.", "الرسوم الحكومية ورسوم الجهات: غير شاملة في السعر، ويسدّدها العميل مباشرة للجهات."),
    ("Name reservation, contract of incorporation and notarisation for companies, chamber membership, municipal licence, tax, social-insurance and other registrations: each is a separate service priced in the catalogue.",
     "حجز الاسم، وعقد التأسيس وتوثيقه للشركات، وعضوية الغرفة، والرخصة البلدية، والتسجيل الضريبي والتأمينات وغيرها: لكل منها خدمة مستقلة مسعّرة في الكتالوج."),
    ("Activities that require a sectoral licence, and opening a bank account.", "الأنشطة التي تتطلب ترخيصاً قطاعياً، وفتح الحساب البنكي."),
    EXCL_EXTRA,
]
DURATION = [("Execution", "التنفيذ", "[●] working days from the date the file is complete — to be confirmed by our operations team before issue.",
             "[●] أيام عمل من اكتمال الملف — تؤكدها عمليات الشركة قبل الإصدار."),
            ("Dependency", "الاعتماد", "The overall duration depends on receiving the documents in full and on the response time of the entity.",
             "تعتمد المدة الكلية على استلام المستندات كاملة وعلى زمن استجابة الجهة.")]
PAY = [("First instalment", "الدفعة الأولى", 50, "On signing the quotation", "عند توقيع العرض"),
       ("Second instalment", "الدفعة الثانية", 50, "On issue of the commercial registration", "عند صدور السجل التجاري")]

S = dict(
    slug="qs-000914-new-cr", client_en="[●]", client_ar="[●]", date_en="3 November 2026", date_ar="3 نوفمبر 2026", valid_days=14,
    capacity_en="Owner of the establishment to be registered", capacity_ar="مالك المنشأة المراد تسجيلها",
    quote_title_en="Quotation: New Commercial Registration", quote_title_ar="عرض سعر: إصدار سجل تجاري جديد",
    cover=dict(h1_en="New Commercial Registration", sub_en="Preparing, filing and following up your new commercial registration through the Saudi Business Center.",
               h1_ar="إصدار سجل تجاري جديد", sub_ar="إعداد طلب سجلك التجاري الجديد وتقديمه ومتابعته عبر المركز السعودي للأعمال.",
               refs_en="BP-SBC-02 · Company Formation", refs_ar="BP-SBC-02 · تأسيس الشركات"),
    refs_short="BP-SBC-02",
    items=[dict(sku="BP-SBC-02", en="New Commercial Registration Issuance — service fee, one time", ar="إصدار سجل تجاري جديد — أتعاب الخدمة، مرة واحدة", expect=250, short_en="for the commercial registration", short_ar="للسجل التجاري")],
    gov_fees=[GOV_SBC],
    always_en="name reservation, contract of incorporation, chamber membership, municipal licence and other registrations (separate services priced in the catalogue), and sectoral licence fees. Government fees are paid by the Client directly when due.",
    always_ar="حجز الاسم، وعقد التأسيس، وعضوية الغرفة، والرخصة البلدية وغيرها من التسجيلات (خدمات مستقلة مسعّرة في الكتالوج)، ورسوم الجهات القطاعية. ويسدّد العميل الرسوم الحكومية مباشرة عند استحقاقها.",
    scope=SCOPE, deliverables=DELIV, requirements=REQ, exclusions=EXCL, duration=DURATION, pay=PAY, terms=terms(),
    contract=dict(
        title_en="Commercial Registration Service Agreement", title_ar="عقد خدمة إصدار سجل تجاري",
        cover_en="Preparing, filing and following up a new commercial registration.", cover_ar="إعداد طلب سجل تجاري جديد وتقديمه ومتابعته.",
        subject_en="The First Party provides the Client with preparing, filing and following up the application for a new commercial registration with the competent authorities through the Saudi Business Center, as detailed in the accepted quotation (service BP-SBC-02), which forms an integral part of this contract.",
        subject_ar="يقدّم الطرف الأول للعميل إعداد طلب سجل تجاري جديد وتقديمه ومتابعته لدى الجهات المختصة عبر المركز السعودي للأعمال، وفق ما هو مفصّل في عرض السعر المقبول (الخدمة BP-SBC-02) الذي يُعدّ جزءاً لا يتجزأ من هذا العقد.",
        poa_en="Issuing any power of attorney is not part of the services.", poa_ar="ولا يدخل إصدار أي وكالة ضمن الخدمات.",
        cats=[("بنود خاصة بفئة تأسيس الشركات", "Scope Limits")]),
    authz=dict(
        covered_en="Only the service of the accepted quotation dated 3 November 2026 (service BP-SBC-02, new commercial registration issuance) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        covered_ar="خدمة عرض السعر المقبول المؤرخ 3 نوفمبر 2026 (الخدمة BP-SBC-02، إصدار سجل تجاري جديد) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.",
        deleg=[D_SBC]),
    docs=["contract", "nda"],
    info=dict(
        checklist=[ck("National ID or residence permit of the owner", "هوية المالك الوطنية أو إقامته", "A clear copy. Required from: the owner of the establishment.", "صورة واضحة. مطلوب من: مالك المنشأة."),
                   ck("Entity type and activity", "نوع الكيان والنشاط", "Establishment or company, and the activity the registration is for.", "مؤسسة أو شركة، والنشاط المطلوب السجل له."),
                   ck("Trade name", "الاسم التجاري", "The name, or three options in order of preference.", "الاسم، أو ثلاثة خيارات بحسب الأفضلية."),
                   ck("Business address", "عنوان النشاط", "The business address and the national address of the establishment, if available.", "عنوان النشاط والعنوان الوطني للمنشأة إن وُجد."),
                   CK_SIGNED],
        checklist_sub_en="The documents and details we need from you to start your new commercial registration.",
        checklist_sub_ar="المستندات والبيانات التي نحتاجها منك لبدء إصدار سجلك التجاري الجديد.",
        form=[F_APPLICANT, F_CONTACT,
              fg("C. The registration", "ج. السجل التجاري", [("Entity type (establishment / company)", "نوع الكيان (مؤسسة / شركة)"), ("Trade name (1)", "الاسم التجاري (1)"), ("(2)", "(2)"), ("(3)", "(3)"), ("Activity", "النشاط"), ("Business address", "عنوان النشاط")]),
              letter_decl(("D", "د"))],
    ),
)
