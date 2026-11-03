# -*- coding: utf-8 -*-
"""CL-0024 — Syed Ameer (باكستان): فرع أو شركة ذات مسؤولية محدودة في مكة. الاستبيان أُرسل 11/6 ولم يُجب.
المسار غير محسوم، فالعرض بخيارين من الكتالوج (أ: تسجيل فرع BP-FI-06، ب: تأسيس شركة لمستثمر أجنبي BP-FI-01). لا عقد قبل اختيار المسار."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-_engine"))
from blocks import *

SCOPE = [
    ("Structuring (both options)", "الهيكلة (الخياران)",
     "Using your questionnaire answers, confirming the right path — a branch of your foreign company (Option A) or a Saudi company with a foreign investor (Option B) — and the activity (ISIC), the ownership and the capital.",
     "اعتماداً على إجابات الاستبيان، تأكيد المسار المناسب — فرع لشركتك الأجنبية (الخيار أ) أو شركة سعودية بمستثمر أجنبي (الخيار ب) — والنشاط (ISIC) والملكية ورأس المال."),
    ("Investment registration (both options)", "التسجيل الاستثماري (الخياران)",
     "Preparing the registration file with the Ministry of Investment (MISA) for the chosen option, reviewing it, filing it and following it up until the investment registration (licence) is issued.",
     "إعداد ملف التسجيل لدى وزارة الاستثمار للخيار المختار ومراجعته وتقديمه ومتابعته حتى صدور التسجيل (رخصة الاستثمار)."),
    ("Option A — branch", "الخيار أ — الفرع",
     "Registering the branch of the foreign company in the Kingdom (service BP-FI-06) with an address in Makkah, and following the registration with the competent authorities.",
     "تسجيل فرع الشركة الأجنبية في المملكة (الخدمة BP-FI-06) بعنوان في مكة المكرمة، ومتابعة التسجيل لدى الجهات المختصة."),
    ("Option B — company", "الخيار ب — الشركة",
     "Preparing the contract of incorporation and articles of association, establishing the Saudi company with the foreign investor and issuing its commercial registration through the Saudi Business Center (service BP-FI-01).",
     "إعداد عقد التأسيس والنظام الأساسي، وتأسيس الشركة السعودية بالمستثمر الأجنبي وإصدار سجلها التجاري عبر المركز السعودي للأعمال (الخدمة BP-FI-01)."),
    ("Final scope", "النطاق النهائي",
     "The registrations needed to operate (chamber membership, ZATCA, GOSI, Ministry of Human Resources, national address) and the handover are listed in the service contract for the option you choose, once the questionnaire is complete.",
     "التسجيلات اللازمة للتشغيل (الغرفة التجارية، الزكاة والضريبة والجمارك، التأمينات، وزارة الموارد البشرية، العنوان الوطني) والتسليم تُفصَّل في عقد الخدمة للخيار الذي تختاره بعد اكتمال الاستبيان."),
]
DELIV = [
    ("Investment registration certificate from the Ministry of Investment for the chosen option.", "شهادة التسجيل الاستثماري من وزارة الاستثمار للخيار المختار."),
    ("Option A: the registered branch’s documents. Option B: the commercial registration and the approved contract of incorporation.", "الخيار أ: مستندات تسجيل الفرع. الخيار ب: السجل التجاري وعقد التأسيس المعتمد."),
    ("The final file, handed over complete.", "الملف النهائي مسلَّماً كاملاً."),
]
REQ = [
    ("The questionnaire previously sent to you, completed.", "الاستبيان الذي أُرسل إليك سابقاً، معبّأً."),
    ("Passport copy of each investor and contact details; signing the documents and authorising us to file and follow up on your behalf.", "صورة جواز سفر كل مستثمر وبيانات التواصل؛ والتوقيع على الوثائق وتفويضنا بالتقديم والمتابعة."),
    ("Option A: the corporate documents of the foreign company, attested and translated as the entities require. Option B: the investor’s details and the ownership structure.",
     "الخيار أ: مستندات الشركة الأجنبية مصدّقة ومترجمة كما تشترط الجهات. الخيار ب: بيانات المستثمر وهيكل الملكية."),
    ("The activity, the proposed address in Makkah and the intended capital.", "النشاط والعنوان المقترح في مكة المكرمة ورأس المال المنوي."),
    ("Beneficial-owner details, and supporting evidence of the source of funds when requested.", "بيانات المستفيد الحقيقي، وإثباتات مصدر الأموال عند الطلب."),
    ("If the investor is not resident in the Kingdom: signing the separate power of attorney we prepare as a standalone document.", "إن كان المستثمر غير مقيم في المملكة: التوقيع على الوكالة المستقلة التي نجهّزها بمستند منفصل."),
]
EXCL = [
    ("Government fees and the entities’ charges (investment registration, commercial registration and publication, chamber membership and any other fee): not included in the price and paid by the Client directly to the entities.",
     "الرسوم الحكومية ورسوم الجهات (التسجيل الاستثماري، والسجل التجاري والنشر، وعضوية الغرفة، وأي رسم آخر): غير شاملة في السعر، ويسدّدها العميل مباشرة للجهات."),
    ("Attestation of foreign documents, certified translation, and sectoral licence fees for regulated activities.", "تصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم الجهات القطاعية للأنشطة الخاضعة."),
    ("Opening a bank account, work visas and residence permits, and post-registration obligations (renewals, zakat and tax filing, social insurance, accounting).", "فتح الحساب البنكي، وتأشيرات العمل والإقامات، والالتزامات اللاحقة للتسجيل (التجديد، الزكاة والضريبة، التأمينات، المحاسبة)."),
    ("The two options are alternatives: the Client chooses one, and the other is not charged.", "الخياران بديلان: يختار العميل أحدهما ولا يُحتسب الآخر."),
    EXCL_EXTRA,
]
DURATION = [
    ("Investment registration", "التسجيل الاستثماري", "Announced official period: 10 working days from the date the file is complete (MISA Investor Guide, September 2026).",
     "المدة الرسمية المعلنة: 10 أيام عمل من اكتمال الملف (دليل المستثمر، وزارة الاستثمار، سبتمبر 2026)."),
    ("Before it", "قبله", "Completing the questionnaire, preparing the documents and their attestation (on the Client) — they determine the overall duration.",
     "تعبئة الاستبيان وتجهيز المستندات وتصديقها (وهي على العميل) وتحدد المدة الكلية."),
    ("After it", "بعده", "Registration of the branch or incorporation of the company, and opening its files with the entities. The detailed schedule is set in the service contract.",
     "تسجيل الفرع أو تأسيس الشركة وفتح ملفاتها لدى الجهات. وتُحدَّد الجدولة التفصيلية في عقد الخدمة."),
]
PAY = [("First instalment", "الدفعة الأولى", 50, "On signing the contract", "عند التعاقد"),
       ("Second instalment", "الدفعة الثانية", 50, "After the registration is completed and the work is delivered", "بعد اكتمال التسجيل وتسليم العمل")]

S = dict(
    slug="syed-ameer-makkah", client_en="Syed Ameer", client_ar="Syed Ameer", date_en="3 November 2026", date_ar="3 نوفمبر 2026", valid_days=14,
    capacity_en="Investor", capacity_ar="مستثمر",
    quote_title_en="Quotation: Branch or Company in Makkah", quote_title_ar="عرض سعر: فرع أو شركة في مكة المكرمة",
    cover=dict(h1_en="Branch or Company in Makkah", sub_en="Two ways to start your business in Makkah: registering a branch of your foreign company, or establishing a Saudi company with a foreign investor. You choose one.",
               h1_ar="فرع أو شركة في مكة المكرمة", sub_ar="طريقان لبدء نشاطك في مكة المكرمة: تسجيل فرع لشركتك الأجنبية، أو تأسيس شركة سعودية بمستثمر أجنبي. وتختار أحدهما.",
               refs_en="BP-FI-06 | BP-FI-01 · Foreign Investment", refs_ar="BP-FI-06 | BP-FI-01 · الاستثمار الأجنبي"),
    refs_short="BP-FI-06 | BP-FI-01",
    options=[
        dict(label_en="Option A — Branch of the foreign company", label_ar="الخيار أ — فرع للشركة الأجنبية",
             items=[dict(sku="BP-FI-06", en="Foreign Company Branch Registration — service fee, one time", ar="تسجيل فرع لشركة أجنبية — أتعاب الخدمة، مرة واحدة", expect=12000)]),
        dict(label_en="Option B — Saudi company with a foreign investor", label_ar="الخيار ب — شركة سعودية بمستثمر أجنبي",
             items=[dict(sku="BP-FI-01", en="Foreign Investor Company Formation — service fee, one time", ar="تأسيس شركة لمستثمر أجنبي — أتعاب الخدمة، مرة واحدة", expect=22500)]),
    ],
    gov_fees=[GOV_MISA, GOV_CR, GOV_CHAMBER],
    always_en="attestation of foreign documents and certified translation, and sectoral licence fees for regulated activities. Government fees are paid by the Client directly when due. The two options are alternatives.",
    always_ar="تصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم الجهات القطاعية للأنشطة الخاضعة. ويسدّد العميل الرسوم الحكومية مباشرة عند استحقاقها. والخياران بديلان.",
    scope=SCOPE, deliverables=DELIV, requirements=REQ, exclusions=EXCL, duration=DURATION, pay=PAY,
    terms=terms(with_contract=False, extra=[("The final scope and price of the chosen option are confirmed once the questionnaire is complete; the option you choose is then set out in the service contract.",
                                              "يُؤكَّد النطاق النهائي وسعر الخيار المختار بعد اكتمال الاستبيان، ثم يُفصَّل الخيار الذي تختاره في عقد الخدمة.")]),
    authz=dict(
        covered_en="Only the service of the option accepted in the quotation dated 3 November 2026 (service BP-FI-06 for Option A, or service BP-FI-01 for Option B) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        covered_ar="خدمة الخيار المقبول في عرض السعر المؤرخ 3 نوفمبر 2026 (الخدمة BP-FI-06 للخيار أ، أو الخدمة BP-FI-01 للخيار ب) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.",
        deleg=[D_MISA, D_INCORP]),
    docs=["nda"],
    info=dict(
        checklist=[CK_PASSPORT,
                   ck("Questionnaire", "الاستبيان", "The questionnaire previously sent to you, completed. It lets us confirm the option, the activity and the ownership.", "الاستبيان الذي أُرسل إليك سابقاً، معبّأً. وبه نؤكد الخيار والنشاط والملكية."),
                   ck("Foreign company documents (Option A)", "مستندات الشركة الأجنبية (الخيار أ)", "The corporate documents of the foreign company, attested and translated as the entities require. Required from: Option A only.",
                      "مستندات الشركة الأجنبية مصدّقة ومترجمة كما تشترط الجهات. مطلوب من: الخيار أ فقط."),
                   CK_OWN, CK_MGR,
                   ck("Activity, address in Makkah and capital", "النشاط والعنوان في مكة والمال", "The activity, the proposed address in Makkah and the intended capital.", "النشاط والعنوان المقترح في مكة المكرمة ورأس المال المنوي."),
                   CK_BO, CK_SIGNED],
        checklist_sub_en="The documents and details we need from you to start, once you have chosen between the branch and the company.",
        checklist_sub_ar="المستندات والبيانات التي نحتاجها منك لنبدأ بعد أن تختار بين الفرع والشركة.",
        form=[fg("A. Investor", "أ. المستثمر", [("Full name as in the passport", "الاسم الكامل كما في الجواز"), ("Nationality", "الجنسية"), ("Passport no.", "رقم الجواز"), ("Resident in the Kingdom?", "مقيم في المملكة؟", "yn")]),
              F_CONTACT,
              fg("C. Your choice", "ج. اختيارك", [("Option A — branch of the foreign company", "الخيار أ — فرع للشركة الأجنبية", "yn"), ("Option B — Saudi company with a foreign investor", "الخيار ب — شركة سعودية بمستثمر أجنبي", "yn")]),
              fg("D. The business in Makkah", "د. النشاط في مكة المكرمة", [("Activity", "النشاط"), ("Proposed address in Makkah", "العنوان المقترح في مكة المكرمة"), ("Intended capital", "رأس المال المنوي"), ("Trade name (1)", "الاسم التجاري (1)"), ("(2)", "(2)")]),
              fg("E. Foreign company (Option A)", "هـ. الشركة الأجنبية (الخيار أ)", [("Company name", "اسم الشركة"), ("Country of incorporation", "بلد التأسيس"), ("Registration no.", "رقم التسجيل"), ("Directors — names", "المديرون — الأسماء")]),
              fg("F. Source of funds and beneficial owner", "و. مصدر الأموال والمستفيد الحقيقي", [("Source of funds", "مصدر الأموال"), ("Beneficial owner(s)", "المستفيد الحقيقي")]),
              letter_decl(("G", "ز"))],
    ),
)
