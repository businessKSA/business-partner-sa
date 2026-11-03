# -*- coding: utf-8 -*-
"""CL-0020 — Runyi (وسيط عميل جزر كايمان): شركة أجنبية 100٪ في الرياض + عنوان + بنك + محاسبة. وارد 13 أكتوبر.
الأسعار من الكتالوج بالـSKU فقط؛ البنود بلا سعر معتمد تُكتب [●]. مستندات العميل لم تصل: لا عقد قبل تأكيد الأنشطة والطرف المتعاقد."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-_engine"))
from blocks import *

SCOPE = [
    ("Activities & capital review", "مراجعة الأنشطة ورأس المال",
     "Reviewing the intended business activities against the licensing requirements to confirm which can be licensed together under one company, the legal form, and whether the intended capital (USD 100,000 was mentioned) is appropriate for them. We confirm this only after reviewing the activities.",
     "مراجعة الأنشطة المنوية مقابل اشتراطات الترخيص لتأكيد ما يمكن ترخيصه معاً في شركة واحدة، والشكل النظامي، وهل رأس المال المنوي (ذُكر 100,000 دولار) مناسب لها. ولا نؤكد ذلك إلا بعد مراجعة الأنشطة."),
    ("Investment licence — 100% foreign ownership", "ترخيص الاستثمار — ملكية أجنبية 100%",
     "Preparing the registration file with the Ministry of Investment (MISA) for a 100% foreign-owned company, reviewing it, filing it and following it up until the investment registration (licence) is issued.",
     "إعداد ملف التسجيل لدى وزارة الاستثمار لشركة مملوكة بالكامل لأجنبي ومراجعته وتقديمه ومتابعته حتى صدور التسجيل (رخصة الاستثمار)."),
    ("Incorporation", "التأسيس",
     "Preparing the contract of incorporation and articles of association, establishing the company in Riyadh and issuing the commercial registration through the Saudi Business Center.",
     "إعداد عقد التأسيس والنظام الأساسي، وتأسيس الشركة في الرياض وإصدار السجل التجاري عبر المركز السعودي للأعمال."),
    ("Registrations", "التسجيلات",
     "Chamber of Commerce membership; registration with ZATCA, including VAT registration when due; opening the establishment’s files with GOSI and the Ministry of Human Resources; registering the national address.",
     "الاشتراك في الغرفة التجارية؛ وتسجيل المنشأة لدى الزكاة والضريبة والجمارك ومنه التسجيل في ضريبة القيمة المضافة عند الاستحقاق؛ وفتح ملفاتها في التأمينات الاجتماعية ووزارة الموارد البشرية؛ وتسجيل العنوان الوطني."),
    ("Corporate bank account (BP-PL-0051)", "الحساب البنكي للشركة (BP-PL-0051)",
     "Preparing the file and coordinating with the bank to support opening the company’s corporate bank account. The bank decides on the account.",
     "تجهيز الملف والتنسيق مع البنك لدعم فتح الحساب البنكي التجاري للشركة. ويبقى القرار في الحساب للبنك."),
    ("Updates & handover", "المتابعة والتسليم",
     "Keeping the Client informed of the application status step by step, and handing over the complete final file.", "إبلاغ العميل بحالة الطلب أولاً بأول، وتسليم الملف النهائي كاملاً."),
]
DELIV = [
    ("Investment registration certificate from the Ministry of Investment.", "شهادة التسجيل الاستثماري من وزارة الاستثمار."),
    ("Commercial registration and the approved contract of incorporation.", "السجل التجاري وعقد التأسيس المعتمد."),
    ("Chamber of Commerce membership; tax number and ZATCA registration certificate; GOSI and Ministry of Human Resources files; the national address.", "عضوية الغرفة التجارية؛ والرقم الضريبي وشهادة التسجيل في الزكاة والضريبة والجمارك؛ وملفات التأمينات ووزارة الموارد البشرية؛ والعنوان الوطني."),
    ("Corporate bank account opening file and the bank’s outcome.", "ملف فتح الحساب البنكي التجاري ونتيجة البنك."),
]
REQ = [
    ("The shareholder’s corporate documents (the Cayman Islands company), attested and translated as the entities require, and the names of the intended managers or directors with a passport copy of each.",
     "مستندات الشريك الشركاتية (شركة جزر كايمان) مصدّقة ومترجمة كما تشترط الجهات، وأسماء المديرين المنويين مع صورة جواز كل منهم."),
    ("The full list of intended business activities, so we can check which can be licensed together under one company.", "القائمة الكاملة للأنشطة التجارية المنوية لنتحقق مما يمكن ترخيصه معاً في شركة واحدة."),
    ("The expected timeline and the preferred registered-office arrangement.", "الجدول الزمني المتوقع وترتيب المقر المسجَّل المفضّل."),
    ("Beneficial-owner details, and supporting evidence of the source of funds when requested.", "بيانات المستفيد الحقيقي، وإثباتات مصدر الأموال عند الطلب."),
    ("The identity of the contracting party and its authority to sign, if Runyi is acting for the shareholder.", "هوية الطرف المتعاقد وصلاحيته في التوقيع إن كان Runyi يتصرف نيابةً عن الشريك."),
    ("If the shareholder is not in the Kingdom: signing the separate power of attorney we prepare as a standalone document.", "إن كان الشريك خارج المملكة: التوقيع على الوكالة المستقلة التي نجهّزها بمستند منفصل."),
]
EXCL = [
    ("Government fees and the entities’ charges (investment registration, commercial registration and publication, chamber membership and any other fee): not included in the price and paid by the Client directly to the entities.",
     "الرسوم الحكومية ورسوم الجهات (التسجيل الاستثماري، والسجل التجاري والنشر، وعضوية الغرفة، وأي رسم آخر): غير شاملة في السعر، ويسدّدها العميل مباشرة للجهات."),
    ("Work visas and residence permits (excluded, as requested), attestation of foreign documents, certified translation, and sectoral licence fees for regulated activities.",
     "تأشيرات العمل والإقامات (مستثناة كما طُلب)، وتصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم الجهات القطاعية للأنشطة الخاضعة."),
    ("The registered or compliant office address for the first year and the monthly accounting and tax filing are quoted separately; the lines marked [●] above are priced once the office arrangement and the scope of the monthly service are confirmed.",
     "المقر المسجَّل أو المتوافق للسنة الأولى والمحاسبة وتقديم الإقرارات الضريبية الشهرية تُسعَّر على حدة؛ والبنود المعلَّمة بـ[●] أعلاه تُسعَّر بعد تأكيد ترتيب المقر ونطاق الخدمة الشهرية."),
    ("Post-registration obligations (renewals, zakat and tax filing, social insurance) unless listed above.", "الالتزامات اللاحقة للتسجيل (التجديد، الزكاة والضريبة، التأمينات) ما لم تُذكر أعلاه."),
    EXCL_EXTRA,
]
DURATION = [
    ("Investment registration", "التسجيل الاستثماري", "Announced official period: 10 working days from the date the file is complete (MISA Investor Guide, September 2026).",
     "المدة الرسمية المعلنة: 10 أيام عمل من اكتمال الملف (دليل المستثمر، وزارة الاستثمار، سبتمبر 2026)."),
    ("Before it", "قبله", "Receiving the shareholder’s documents, their attestation and translation (on the Client), and confirming the activities — they determine the overall duration.",
     "استلام مستندات الشريك وتصديقها وترجمتها (وهي على العميل) وتأكيد الأنشطة وتحدد المدة الكلية."),
    ("After it", "بعده", "Incorporation, opening the company’s files with the entities and the bank account file. The detailed schedule is set once the documents are received.",
     "التأسيس وفتح ملفات الشركة لدى الجهات وملف الحساب البنكي. وتُحدَّد الجدولة التفصيلية بعد استلام المستندات."),
]
PAY = [("First instalment", "الدفعة الأولى", 50, "On signing the quotation", "عند توقيع العرض"),
       ("Second instalment", "الدفعة الثانية", 50, "After the company is established and the work is delivered", "بعد تأسيس الشركة وتسليم العمل")]

S = dict(
    slug="runyi-foreign-company", client_en="Runyi", client_ar="Runyi", date_en="3 November 2026", date_ar="3 نوفمبر 2026", valid_days=14,
    capacity_en="Representative of the shareholder of the company to be established", capacity_ar="ممثل شريك الشركة المراد تأسيسها",
    quote_title_en="Quotation: 100% Foreign-Owned Company in Riyadh", quote_title_ar="عرض سعر: شركة مملوكة بالكامل لأجنبي في الرياض",
    cover=dict(h1_en="100% Foreign-Owned Company in Riyadh", sub_en="Licensing, commercial registration, the mandatory registrations and support in opening the company’s bank account, itemised with government fees and recurring charges shown separately.",
               h1_ar="شركة مملوكة بالكامل لأجنبي في الرياض", sub_ar="الترخيص والسجل التجاري والتسجيلات اللازمة ودعم فتح الحساب البنكي، ببنود مفصّلة وتظهر الرسوم الحكومية والرسوم المتكررة على حدة.",
               refs_en="BP-FI-03 · BP-PL-0051 · Foreign Investment · Business Support", refs_ar="BP-FI-03 · BP-PL-0051 · الاستثمار الأجنبي · دعم الأعمال"),
    refs_short="BP-FI-03 · BP-PL-0051",
    items=[dict(sku="BP-FI-03", en="100%-owned foreign company formation — service fee, one time", ar="تأسيس شركة أجنبية 100% ملكية — أتعاب الخدمة، مرة واحدة", expect=30000),
           dict(sku="BP-PL-0051", en="Corporate bank account opening support — service fee, one time", ar="فتح حساب بنكي تجاري للشركة — أتعاب الخدمة، مرة واحدة", expect=1000),
           dict(sku="BP-RE-03", en="Registered / compliant office address, first year — quoted once the arrangement is chosen", ar="المقر المسجَّل / المتوافق للسنة الأولى — يُسعَّر عند اختيار الترتيب", amount="[●]"),
           dict(sku="BP-PL-0059", en="Monthly accounting and tax filing — quoted once the scope is confirmed", ar="المحاسبة وتقديم الإقرارات الضريبية الشهرية — تُسعَّر عند تأكيد النطاق", amount="[●]")],
    total_label=("Total of the priced items before VAT", "إجمالي البنود المسعّرة قبل الضريبة"),
    gov_fees=[GOV_MISA, GOV_CR, GOV_CHAMBER],
    always_en="work visas and residence permits, attestation of foreign documents and certified translation, and sectoral licence fees for regulated activities. Government fees are paid by the Client directly when due. Lines marked [●] are priced separately once confirmed.",
    always_ar="تأشيرات العمل والإقامات، وتصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم الجهات القطاعية للأنشطة الخاضعة. ويسدّد العميل الرسوم الحكومية مباشرة عند استحقاقها. والبنود المعلَّمة بـ[●] تُسعَّر على حدة عند تأكيدها.",
    scope=SCOPE, deliverables=DELIV, requirements=REQ, exclusions=EXCL, duration=DURATION, pay=PAY,
    terms=terms(with_contract=False, extra=[("This quotation prices the confirmed items only; the lines marked [●] are quoted separately and are not part of the total above.",
                                              "يسعّر هذا العرض البنود المؤكَّدة وحدها؛ والبنود المعلَّمة بـ[●] تُسعَّر على حدة وليست ضمن الإجمالي أعلاه.")]),
    authz=dict(
        covered_en="Only the services of the accepted quotation dated 3 November 2026 (service BP-FI-03, 100%-owned foreign company formation, and service BP-PL-0051, corporate bank account opening support) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        covered_ar="خدمات عرض السعر المقبول المؤرخ 3 نوفمبر 2026 (الخدمتان BP-FI-03، تأسيس شركة أجنبية 100% ملكية، وBP-PL-0051، دعم فتح الحساب البنكي التجاري) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.",
        deleg=[D_MISA, D_INCORP, D_BANK]),
    docs=["nda"],
    info=dict(
        checklist=[ck("Shareholder’s corporate documents", "مستندات الشريك الشركاتية", "The Cayman Islands company’s documents, attested and translated as the entities require. Required from: the shareholder.", "مستندات شركة جزر كايمان مصدّقة ومترجمة كما تشترط الجهات. مطلوب من: الشريك."),
                   ck("Managers or directors", "المديرون", "The names of the intended managers or directors, with a passport copy of each.", "أسماء المديرين المنويين مع صورة جواز كل منهم."),
                   ck("Business activities", "الأنشطة التجارية", "The full list of intended activities, so we can check which can be licensed together under one company and whether the intended capital is appropriate.", "القائمة الكاملة للأنشطة المنوية لنتحقق مما يمكن ترخيصه معاً ومن مناسبة رأس المال المنوي."),
                   ck("Timeline and office arrangement", "الجدول الزمني وترتيب المقر", "The expected timeline and the preferred registered-office arrangement.", "الجدول الزمني المتوقع وترتيب المقر المسجَّل المفضّل."),
                   CK_BO,
                   ck("Contracting party", "الطرف المتعاقد", "The identity of the party signing the contract and its authority, if Runyi acts for the shareholder.", "هوية الطرف الموقّع على العقد وصلاحيته إن كان Runyi يتصرف نيابةً عن الشريك."),
                   CK_SIGNED],
        checklist_sub_en="The documents and details we need from you to prepare the final itemised quotation and start the company formation.",
        checklist_sub_ar="المستندات والبيانات التي نحتاجها منك لإعداد العرض المفصّل النهائي وبدء تأسيس الشركة.",
        form=[fg("A. Contracting party", "أ. الطرف المتعاقد", [("Name / company", "الاسم / الشركة"), ("Acting for the shareholder?", "يتصرف نيابةً عن الشريك؟", "yn"), ("Mobile", "الجوال"), ("Email", "الإيميل")]),
              fg("B. The shareholder", "ب. الشريك", [("Company name", "اسم الشركة"), ("Country of incorporation", "بلد التأسيس"), ("Registration no.", "رقم التسجيل"), ("Beneficial owner(s)", "المستفيد الحقيقي"), ("Source of funds", "مصدر الأموال")]),
              fg("C. The Saudi company", "ج. الشركة السعودية", [("Proposed name (1)", "الاسم المقترح (1)"), ("(2)", "(2)"), ("Activities (full list)", "الأنشطة (القائمة الكاملة)"), ("Intended capital", "رأس المال المنوي"), ("City", "المدينة")]),
              fg("D. Management", "د. الإدارة", [("Managers / directors — name / nationality / passport no.", "المديرون — الاسم / الجنسية / رقم الجواز")]),
              fg("E. Office and recurring services", "هـ. المقر والخدمات المتكررة", [("Registered-office arrangement wanted", "ترتيب المقر المسجَّل المطلوب"), ("Monthly accounting and tax filing wanted?", "هل تريد المحاسبة والإقرارات الشهرية؟", "yn"), ("Expected start date", "تاريخ البدء المتوقع")]),
              letter_decl(("F", "و"))],
    ),
)
