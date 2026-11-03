# -*- coding: utf-8 -*-
"""CL-0022 — أحمد عز: تعديل عقد تأسيس وقرارات شركاء (BP-SBC-10)، الطلب BPT-445107 / BP-682931 (27/8).
القطعة الناقصة التي تعطّل المسودة عند ملاك: «قائمة المستندات» — تُبنى هنا (05-Documents-Checklist). ما نطلبه من العميل صياغتنا نحن، وليس ادعاءً بمتطلب رسمي."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-_engine"))
from blocks import *

SCOPE = [
    ("Review", "المراجعة",
     "Reviewing the company’s current contract of incorporation (and any earlier amendments) and the amendment the partners want: for example the name, the activity, the capital, the partners or their shares, the manager or the headquarters.",
     "مراجعة عقد تأسيس الشركة الحالي (وأي تعديلات سابقة) والتعديل الذي يريده الشركاء: كالاسم أو النشاط أو رأس المال أو الشركاء أو حصصهم أو المدير أو المقر."),
    ("Drafting", "الصياغة",
     "Drafting the amended contract of incorporation and/or the partners’ resolutions for the Client’s review and approval.",
     "صياغة عقد التأسيس المعدّل و/أو قرارات الشركاء لمراجعة العميل واعتماده."),
    ("Filing", "التقديم",
     "Submitting the amendment through the Saudi Business Center (Ministry of Commerce) once the partners have signed, and following it up until it is completed.",
     "تقديم التعديل عبر المركز السعودي للأعمال (وزارة التجارة) بعد توقيع الشركاء، ومتابعته حتى اكتماله."),
    ("Updates & handover", "المتابعة والتسليم",
     "Keeping the Client informed of the status step by step, and handing over the amended documents.", "إبلاغ العميل بحالة الطلب أولاً بأول، وتسليم المستندات المعدّلة."),
]
DELIV = [("The amended contract of incorporation and/or the partners’ resolutions, in final form.", "عقد التأسيس المعدّل و/أو قرارات الشركاء بصيغتها النهائية."),
         ("Confirmation that the amendment has been filed and completed.", "إثبات تقديم التعديل واكتماله.")]
REQ = [
    ("Copy of the current contract of incorporation and any earlier amendments, and of the commercial registration.", "نسخة من عقد التأسيس الحالي وأي تعديلات سابقة، ومن السجل التجاري."),
    ("A clear description of the amendment wanted, agreed by all partners.", "وصف واضح للتعديل المطلوب متفق عليه بين جميع الشركاء."),
    ("A copy of the ID or passport of each partner affected by the amendment, and of the manager.", "نسخة من هوية أو جواز كل شريك يمسّه التعديل ومن المدير."),
    ("The partners sign the amendment or the resolutions themselves, or through an independent power of attorney; we do not sign on their behalf.",
     "يوقّع الشركاء التعديل أو القرارات بأنفسهم أو بوكالة مستقلة؛ ولا نوقّع نيابةً عنهم."),
    ("If a partner is a foreign company or person: its documents attested and translated as the entities require.", "إن كان أحد الشركاء شركة أو شخصاً أجنبياً: مستنداته مصدّقة ومترجمة كما تشترط الجهات."),
]
EXCL = [
    ("Government fees and the entities’ charges: not included in the price and paid by the Client directly to the entities.", "الرسوم الحكومية ورسوم الجهات: غير شاملة في السعر، ويسدّدها العميل مباشرة للجهات."),
    ("Amending the commercial registration data that follows the amendment (service BP-SBC-11), amending an investment licence (service BP-FI-11), and any other filing: separate services priced in the catalogue.",
     "تعديل بيانات السجل التجاري الناتج عن التعديل (الخدمة BP-SBC-11)، وتعديل ترخيص الاستثمار (الخدمة BP-FI-11)، وأي تقديم آخر: خدمات مستقلة مسعّرة في الكتالوج."),
    ("Attestation of foreign documents and certified translation.", "تصديق المستندات الأجنبية والترجمة المعتمدة."),
    EXCL_EXTRA,
]
DURATION = [("Execution", "التنفيذ", "[●] working days from the date the file is complete and signed — to be confirmed by our operations team before issue.",
             "[●] أيام عمل من اكتمال الملف وتوقيعه — تؤكدها عمليات الشركة قبل الإصدار."),
            ("Dependency", "الاعتماد", "The overall duration depends on receiving the documents in full, on the partners’ signatures and on the response time of the entity.",
             "تعتمد المدة الكلية على استلام المستندات كاملة وعلى توقيعات الشركاء وزمن استجابة الجهة.")]
PAY = [("First instalment", "الدفعة الأولى", 50, "On signing the quotation", "عند توقيع العرض"),
       ("Second instalment", "الدفعة الثانية", 50, "On completion of the amendment", "عند اكتمال التعديل")]

S = dict(
    slug="ahmed-ezz-aoa-amendment", client_en="Ahmed Ezz", client_ar="أحمد عز", date_en="3 November 2026", date_ar="3 نوفمبر 2026", valid_days=14,
    capacity_en="Partner / manager of the company", capacity_ar="شريك / مدير الشركة",
    quote_title_en="Quotation: Amending the Contract of Incorporation", quote_title_ar="عرض سعر: تعديل عقد التأسيس وقرارات الشركاء",
    cover=dict(h1_en="Amending the Contract of Incorporation", sub_en="Drafting, filing and following up the amendment of your company’s contract of incorporation and the partners’ resolutions.",
               h1_ar="تعديل عقد التأسيس وقرارات الشركاء", sub_ar="صياغة تعديل عقد تأسيس شركتك وقرارات الشركاء وتقديمه ومتابعته.",
               refs_en="BP-SBC-10 · Company Formation", refs_ar="BP-SBC-10 · تأسيس الشركات"),
    refs_short="BP-SBC-10",
    items=[dict(sku="BP-SBC-10", en="Amending the contract of incorporation / partners’ resolutions — service fee, one time", ar="تعديل عقد تأسيس / قرارات شركاء — أتعاب الخدمة، مرة واحدة", expect=1000, short_en="for the amendment", short_ar="للتعديل")],
    gov_fees=[GOV_SBC],
    always_en="amending the commercial registration data, investment-licence amendments, attestation and translation of foreign documents. Government fees are paid by the Client directly when due.",
    always_ar="تعديل بيانات السجل التجاري، وتعديل تراخيص الاستثمار، وتصديق المستندات الأجنبية وترجمتها. ويسدّد العميل الرسوم الحكومية مباشرة عند استحقاقها.",
    scope=SCOPE, deliverables=DELIV, requirements=REQ, exclusions=EXCL, duration=DURATION, pay=PAY, terms=terms(),
    contract=dict(
        title_en="Contract Amendment Service Agreement", title_ar="عقد خدمة تعديل عقد التأسيس",
        cover_en="Drafting, filing and following up the amendment of a contract of incorporation.", cover_ar="صياغة تعديل عقد التأسيس وتقديمه ومتابعته.",
        subject_en="The First Party provides the Client with drafting, filing and following up the amendment of the Client’s company contract of incorporation and the partners’ resolutions with the competent authorities through the Saudi Business Center, as detailed in the accepted quotation (service BP-SBC-10), which forms an integral part of this contract.",
        subject_ar="يقدّم الطرف الأول للعميل صياغة تعديل عقد تأسيس شركة العميل وقرارات الشركاء وتقديمه ومتابعته لدى الجهات المختصة عبر المركز السعودي للأعمال، وفق ما هو مفصّل في عرض السعر المقبول (الخدمة BP-SBC-10) الذي يُعدّ جزءاً لا يتجزأ من هذا العقد.",
        poa_en="Issuing any power of attorney is not part of the services; the partners sign the amendment themselves or through an independent power of attorney.",
        poa_ar="ولا يدخل إصدار أي وكالة ضمن الخدمات؛ ويوقّع الشركاء التعديل بأنفسهم أو بوكالة مستقلة.",
        cats=[("بنود خاصة بفئة تأسيس الشركات", "Scope Limits")]),
    authz=dict(
        covered_en="Only the service of the accepted quotation dated 3 November 2026 (service BP-SBC-10, amending the contract of incorporation and the partners’ resolutions) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        covered_ar="خدمة عرض السعر المقبول المؤرخ 3 نوفمبر 2026 (الخدمة BP-SBC-10، تعديل عقد التأسيس وقرارات الشركاء) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.",
        deleg=[D_SBC]),
    docs=["contract", "nda"],
    info=dict(
        checklist=[ck("Current contract of incorporation", "عقد التأسيس الحالي", "A clear copy of the current contract of incorporation and of any earlier amendments.", "نسخة واضحة من عقد التأسيس الحالي وأي تعديلات سابقة."),
                   ck("Commercial registration", "السجل التجاري", "A copy of the company’s current commercial registration.", "نسخة من السجل التجاري الحالي للشركة."),
                   ck("The amendment wanted", "التعديل المطلوب", "A clear description of what changes (for example the name, the activity, the capital, a partner entering or leaving or a change in shares, the manager, the headquarters), agreed by all partners.",
                      "وصف واضح لما سيتغيّر (كالاسم أو النشاط أو رأس المال أو دخول شريك أو خروجه أو تغيّر الحصص أو المدير أو المقر)، متفق عليه بين جميع الشركاء."),
                   ck("Partners’ and manager’s identification", "هويات الشركاء والمدير", "A clear copy of the ID or passport of each partner affected by the amendment and of the manager. Required from: partners affected and the manager.",
                      "نسخة واضحة من هوية أو جواز كل شريك يمسّه التعديل ومن المدير. مطلوب من: الشركاء المعنيين والمدير."),
                   ck("Foreign partner documents", "مستندات الشريك الأجنبي", "If a partner is a foreign company or person: its documents attested and translated as the entities require. Required from: foreign partners only.",
                      "إن كان أحد الشركاء شركة أو شخصاً أجنبياً: مستنداته مصدّقة ومترجمة كما تشترط الجهات. مطلوب من: الشركاء الأجانب فقط."),
                   ck("Signatures", "التوقيعات", "The partners sign the amended contract or the resolutions we draft, themselves or through an independent power of attorney. We do not sign on their behalf.",
                      "يوقّع الشركاء العقد المعدّل أو القرارات التي نصوغها بأنفسهم أو بوكالة مستقلة. ولا نوقّع نيابةً عنهم."),
                   CK_SIGNED],
        checklist_sub_en="The documents and details we need from you to prepare the amendment of your contract of incorporation. The entity confirms its exact requirements when the file is filed.",
        checklist_sub_ar="المستندات والبيانات التي نحتاجها منك لإعداد تعديل عقد تأسيسك. وتؤكد الجهة متطلباتها الدقيقة عند تقديم الملف.",
        form=[F_APPLICANT, F_CONTACT,
              fg("C. The company", "ج. الشركة", [("Company name", "اسم الشركة"), ("Commercial registration no.", "رقم السجل التجاري"), ("Current partners — name / %", "الشركاء الحاليون — الاسم / النسبة"), ("Current manager", "المدير الحالي")]),
              fg("D. The amendment", "د. التعديل", [("Name change?", "تغيير الاسم؟", "yn"), ("Activity change?", "تغيير النشاط؟", "yn"), ("Capital change?", "تغيير رأس المال؟", "yn"), ("Partner entering / leaving / share change?", "دخول شريك / خروجه / تغيّر الحصص؟", "yn"),
                                                          ("Manager change?", "تغيير المدير؟", "yn"), ("Headquarters change?", "تغيير المقر؟", "yn"), ("Details of the change", "تفاصيل التغيير")]),
              letter_decl(("E", "هـ"))],
    ),
)
