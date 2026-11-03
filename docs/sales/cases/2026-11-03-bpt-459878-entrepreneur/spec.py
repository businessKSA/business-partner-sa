# -*- coding: utf-8 -*-
"""CL-0037 — طلب الموقع BPT-459878: رخصة ريادة أعمال. هوية العميل غير معروفة في المستودع (البيانات في Notion/ops) فالاسم [●].
الخدمة المرجّحة من فرز 2026-10-31: تسجيل ريادة الأعمال + تأسيس الشركة (BP-FI-05). الأسعار من الكتالوج بالـSKU فقط."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-_engine"))
from blocks import *

SCOPE = [
    ("Eligibility & structuring", "الأهلية والهيكلة",
     "Study of the project’s eligibility for the entrepreneurship category; determination of the activity (ISIC), the ownership structure and the legal form of the company.",
     "دراسة أهلية المشروع لفئة ريادة الأعمال، وتحديد النشاط (ISIC) وهيكل الملكية والشكل النظامي للشركة."),
    ("Investment registration", "التسجيل الاستثماري",
     "Preparing the registration file with the Ministry of Investment (MISA), reviewing it, filing it and following it up until the investment registration (licence) is issued.",
     "إعداد ملف التسجيل لدى وزارة الاستثمار ومراجعته وتقديمه ومتابعته حتى صدور التسجيل (رخصة الاستثمار)."),
    ("Support entity", "جهة الدعم",
     "Guiding the Client to the accredited support entity (a Saudi university or an accredited business incubator) and coordinating with it to obtain the support or project-endorsement letter.",
     "توجيه العميل إلى جهة الدعم المعتمدة (جامعة سعودية أو حاضنة أعمال معتمدة) والتنسيق معها لاستخراج خطاب الدعم أو اعتماد المشروع."),
    ("Incorporation", "التأسيس",
     "Preparing the contract of incorporation and articles of association, establishing the company and issuing the commercial registration through the Saudi Business Center.",
     "إعداد عقد التأسيس والنظام الأساسي، وتأسيس الشركة وإصدار السجل التجاري عبر المركز السعودي للأعمال."),
    ("Registrations", "التسجيلات",
     "Chamber of Commerce membership; registration with ZATCA (VAT when due); opening the establishment’s files with GOSI and the Ministry of Human Resources; registering the national address.",
     "الاشتراك في الغرفة التجارية؛ وتسجيل المنشأة لدى الزكاة والضريبة والجمارك (ضريبة القيمة المضافة عند الاستحقاق)؛ وفتح ملفاتها في التأمينات الاجتماعية ووزارة الموارد البشرية؛ وتسجيل العنوان الوطني."),
    ("Manager & authorisations", "المدير والتفويضات",
     "Appointing the manager and preparing the authorisations required for the company’s operation.", "تعيين المدير وتجهيز التفويضات اللازمة لتشغيل الشركة."),
    ("Updates & handover", "المتابعة والتسليم",
     "Keeping the Client informed of the application status step by step, and handing over the complete final file.", "إبلاغ العميل بحالة الطلب أولاً بأول، وتسليم الملف النهائي كاملاً."),
]
DELIV = [
    ("Investment registration certificate (entrepreneurship category) from the Ministry of Investment.", "شهادة التسجيل الاستثماري (فئة ريادة الأعمال) من وزارة الاستثمار."),
    ("Commercial registration and the approved contract of incorporation.", "السجل التجاري وعقد التأسيس المعتمد."),
    ("Chamber of Commerce membership; tax number and ZATCA registration certificate.", "عضوية الغرفة التجارية؛ والرقم الضريبي وشهادة التسجيل في الزكاة والضريبة والجمارك."),
    ("GOSI and Ministry of Human Resources files, and the national address; the complete company document pack.", "ملفات التأمينات الاجتماعية ووزارة الموارد البشرية، والعنوان الوطني؛ وحزمة مستندات الشركة كاملة."),
]
REQ = [
    ("Valid passport copy for each partner and contact details; signing the documents and authorising us to file and follow up on the Client’s behalf.",
     "صورة جواز السفر سارية المفعول لكل شريك وبيانات التواصل؛ والتوقيع على الوثائق وتفويضنا بالتقديم والمتابعة."),
    ("Proposed company name (three options), its activity, a description of the innovative project and a brief business plan.", "اسم الشركة المقترح (ثلاثة خيارات)، ونشاطها، ووصف المشروع المبتكر وخطة عمل مختصرة."),
    ("Ownership structure, partners’ percentages and proposed capital; manager and authorised-signatory details.", "هيكل الملكية ونسب الشركاء ورأس المال المقترح؛ وبيانات المدير والمفوّضين."),
    ("Support or project-endorsement letter from a Saudi university or accredited business incubator, including the activity and ownership data.",
     "خطاب دعم أو اعتماد المشروع من جامعة سعودية أو حاضنة أعمال معتمدة، يتضمن النشاط وبيانات الملكية."),
    ("If a partner is a foreign company: its commercial registration attested by the Saudi embassy (and the parent company’s if the nationality differs), translated.",
     "إن كان الشريك شركة أجنبية: سجلها التجاري مصدّقاً من السفارة السعودية (ومعه سجل الشركة الأم إن اختلفت الجنسية)، مترجماً."),
    ("If the applicant is resident in the Kingdom: a no-objection letter from the employer and a copy of the residence permit.", "إن كان المتقدم مقيماً في المملكة: خطاب عدم ممانعة من جهة عمله ونسخة من إقامته."),
]
EXCL = [
    ("Government fees and the entities’ charges (investment registration, commercial registration and publication, chamber membership and any other fee): not included in the price and paid by the Client directly to the entities.",
     "الرسوم الحكومية ورسوم الجهات (التسجيل الاستثماري، والسجل التجاري والنشر، وعضوية الغرفة، وأي رسم آخر): غير شاملة في السعر، ويسدّدها العميل مباشرة للجهات."),
    ("Attestation of foreign documents, certified translation, fees of the support entity or incubator, and sectoral licence fees for regulated activities.",
     "تصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم جهة الدعم أو الحاضنة، ورسوم الجهات القطاعية للأنشطة الخاضعة."),
    ("Powers of attorney are not part of this package; where the Client is resident in the Kingdom, the power of attorney is issued directly from within the Kingdom.",
     "الوكالات ليست ضمن هذه الحزمة؛ وإن كان العميل مقيماً في المملكة فتصدر الوكالة من داخل السعودية مباشرة."),
    ("Building or hosting any online store or website, trademark registration, and e-store documentation (priced separately in the catalogue).",
     "بناء أي متجر إلكتروني أو موقع واستضافته، وتسجيل العلامة التجارية، وتوثيق المتجر الإلكتروني (تُسعَّر على حدة بحسب الكتالوج)."),
    ("Opening a bank account, and post-incorporation obligations (renewals, zakat and tax filing, social insurance, accounting) unless listed above.",
     "فتح الحساب البنكي، والالتزامات اللاحقة للتأسيس (التجديد، الزكاة والضريبة، التأمينات، المحاسبة) ما لم تُذكر أعلاه."),
    EXCL_EXTRA,
]
DURATION = [
    ("Investment registration", "التسجيل الاستثماري", "Announced official period: 10 working days from the date the file is complete (MISA Investor Guide, September 2026).",
     "المدة الرسمية المعلنة: 10 أيام عمل من اكتمال الملف (دليل المستثمر، وزارة الاستثمار، سبتمبر 2026)."),
    ("Before it", "قبله", "Document preparation, the support letter and attestation (on the Client) — they determine the overall duration.",
     "تجهيز المستندات واستخراج خطاب الدعم والتصديق (وهي على العميل) وتحدد المدة الكلية."),
    ("After it", "بعده", "Incorporation of the company and opening its files with the entities. The detailed schedule is set at contract signing.",
     "تأسيس الشركة وفتح ملفاتها لدى الجهات. وتُحدَّد الجدولة التفصيلية عند توقيع العقد."),
]
PAY = [("First instalment", "الدفعة الأولى", 50, "On signing the contract", "عند التعاقد"),
       ("Second instalment", "الدفعة الثانية", 50, "After the company is established and the work is delivered", "بعد تأسيس الشركة وتسليم العمل")]

S = dict(
    slug="bpt-459878-entrepreneur", client_en="[●]", client_ar="[●]", date_en="3 November 2026", date_ar="3 نوفمبر 2026", valid_days=14,
    capacity_en="Founder of the company to be established", capacity_ar="مؤسس الشركة المراد تأسيسها",
    quote_title_en="Quotation: Entrepreneurship-Licence Company", quote_title_ar="عرض سعر: شركة برخصة ريادة الأعمال",
    cover=dict(h1_en="Entrepreneurship-Licence Company",
               sub_en="Registering your investment under the entrepreneurship category with the Ministry of Investment, and establishing your company ready to operate.",
               h1_ar="شركة برخصة ريادة الأعمال", sub_ar="تسجيل استثمارك في فئة ريادة الأعمال لدى وزارة الاستثمار، وتأسيس شركتك جاهزةً للتشغيل.",
               refs_en="BP-FI-05 · Foreign Investment", refs_ar="BP-FI-05 · الاستثمار الأجنبي"),
    refs_short="BP-FI-05",
    items=[dict(sku="BP-FI-05", en="Entrepreneurship-Licence Company Formation — service fee, one time", ar="تأسيس شركة برخصة ريادة الأعمال (رائد أعمال) — أتعاب الخدمة، مرة واحدة", expect=30000,
                short_en="for the company", short_ar="للشركة")],
    gov_fees=[GOV_MISA, GOV_CR, GOV_CHAMBER],
    always_en="attestation of foreign documents and certified translation, the support entity’s or incubator’s fees, and sectoral licence fees for regulated activities. Government fees are paid by the Client directly when due.",
    always_ar="تصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم جهة الدعم أو الحاضنة، ورسوم الجهات القطاعية للأنشطة الخاضعة. ويسدّد العميل الرسوم الحكومية مباشرة عند استحقاقها.",
    scope=SCOPE, deliverables=DELIV, requirements=REQ, exclusions=EXCL, duration=DURATION, pay=PAY, terms=terms(),
    contract=dict(
        title_en="Company Formation Service Agreement", title_ar="عقد خدمة تأسيس شركة برخصة ريادة الأعمال",
        cover_en="Registering the investment under the entrepreneurship category and establishing the company.", cover_ar="تسجيل الاستثمار في فئة ريادة الأعمال وتأسيس الشركة.",
        subject_en="The First Party provides the Client with the registration of the Client’s investment under the entrepreneurship category with the Ministry of Investment, and the establishment and registration of the resulting company and the issuance of its commercial licences and memberships with the competent authorities, as detailed in the accepted quotation (service BP-FI-05), which forms an integral part of this contract.",
        subject_ar="يقدّم الطرف الأول للعميل إجراءات التسجيل الاستثماري لفئة ريادة الأعمال لدى وزارة الاستثمار، وتأسيس الشركة الناتجة وتسجيلها واستخراج تراخيصها وعضوياتها التجارية لدى الجهات المختصة، وفق ما هو مفصّل في عرض السعر المقبول (الخدمة BP-FI-05) الذي يُعدّ جزءاً لا يتجزأ من هذا العقد.",
        poa_en="Issuing any power of attorney is not part of the services; where the Client is resident in the Kingdom, it is issued directly from within the Kingdom.",
        poa_ar="ولا يدخل إصدار أي وكالة ضمن الخدمات؛ وإن كان العميل مقيماً في المملكة فتصدر الوكالة من داخل السعودية مباشرة.",
        cats=[("بنود خاصة بفئة الاستثمار الأجنبي", "Compliance, Source of Funds"), ("بنود خاصة بفئة تأسيس الشركات", "Scope Limits")]),
    authz=dict(
        covered_en="Only the service of the accepted quotation dated 3 November 2026 (service BP-FI-05, entrepreneurship-licence company formation) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        covered_ar="خدمة عرض السعر المقبول المؤرخ 3 نوفمبر 2026 (الخدمة BP-FI-05، تأسيس شركة برخصة ريادة الأعمال) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.",
        deleg=[D_MISA, D_INCORP]),
    docs=["contract", "nda"],
    info=dict(
        checklist=[CK_PASSPORT, CK_RESIDENT, CK_NAME,
                   ck("Activity, project description and business plan", "النشاط ووصف المشروع وخطة العمل", "The company’s activity, a description of the innovative project and a brief business plan.", "نشاط الشركة، ووصف المشروع المبتكر، وخطة عمل مختصرة."),
                   CK_OWN, CK_MGR,
                   ck("Support or project-endorsement letter", "خطاب الدعم أو اعتماد المشروع", "From a Saudi university or an accredited business incubator, including the activity and the ownership data. We guide you to the entity and coordinate with it.",
                      "من جامعة سعودية أو حاضنة أعمال معتمدة، ويتضمن النشاط وبيانات الملكية. نوجّهك إلى الجهة وننسّق معها."),
                   CK_FOREIGN, CK_BO, CK_SIGNED],
        checklist_sub_en="The documents and details we need from you to start the entrepreneurship-licence company formation.",
        checklist_sub_ar="المستندات والبيانات التي نحتاجها منك لبدء تأسيس شركتك برخصة ريادة الأعمال.",
        form=[F_APPLICANT, F_CONTACT,
              fg("C. The company", "ج. الشركة", [("Proposed name (1)", "الاسم المقترح (1)"), ("(2)", "(2)"), ("(3)", "(3)"), ("Activity", "النشاط"), ("Project description", "وصف المشروع")]),
              fg("D. Ownership and capital", "د. الملكية ورأس المال", [("Partner 1 — name / %", "الشريك 1 — الاسم / النسبة"), ("Partner 2 — name / %", "الشريك 2 — الاسم / النسبة"), ("Proposed capital", "رأس المال المقترح"), ("Is any partner a foreign company?", "هل أحد الشركاء شركة أجنبية؟", "yn")]),
              fg("E. Management", "هـ. الإدارة", [("Manager — name / nationality / ID no.", "المدير — الاسم / الجنسية / رقم الهوية"), ("Authorised signatories", "المفوّضون بالتوقيع")]),
              fg("F. Support entity", "و. جهة الدعم", [("University / incubator (if already chosen)", "الجامعة / الحاضنة (إن اختيرت)"), ("I need guidance to choose one", "أحتاج توجيهاً لاختيار جهة", "yn")]),
              fg("G. Source of funds and beneficial owner", "ز. مصدر الأموال والمستفيد الحقيقي", [("Source of funds", "مصدر الأموال"), ("Beneficial owner(s)", "المستفيد الحقيقي")]),
              letter_decl(("H", "ح"))],
        guide_title_en="Entrepreneurship-Licence Company", guide_title_ar="شركة برخصة ريادة الأعمال",
        guide_head=[("What this service is", "ما هذه الخدمة",
                     "Registering your investment under the entrepreneurship category with the Ministry of Investment (MISA), then establishing your company and registering it with the competent authorities, delivered ready to operate (service BP-FI-05).",
                     "تسجيل استثمارك في فئة ريادة الأعمال لدى وزارة الاستثمار، ثم تأسيس شركتك وتسجيلها لدى الجهات المختصة، وتسليمها جاهزةً للتشغيل (الخدمة BP-FI-05)."),
                    ("Who decides eligibility", "من يقرر الأهلية",
                     "We study your project’s eligibility for the entrepreneurship category and advise you. The category and the activity are determined by the competent entity, and we do not guarantee an outcome that depends on its decision.",
                     "ندرس أهلية مشروعك لفئة ريادة الأعمال ونشير عليك. والفئة والنشاط تحددهما الجهة المختصة، ولا نضمن نتيجة تعتمد على قرارها.")],
        not_en="Government and entity fees, attestation and certified translation, support-entity fees, powers of attorney (issued directly from within the Kingdom if you are resident), opening a bank account, and post-incorporation obligations such as renewals, zakat and tax filing and social insurance.",
        not_ar="الرسوم الحكومية ورسوم الجهات، والتصديق والترجمة المعتمدة، ورسوم جهة الدعم، والوكالات (تصدر من داخل السعودية مباشرة إن كنت مقيماً)، وفتح الحساب البنكي، والالتزامات اللاحقة للتأسيس كالتجديد والزكاة والضريبة والتأمينات."),
)
