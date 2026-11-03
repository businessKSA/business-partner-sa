# -*- coding: utf-8 -*-
"""ثلاث وثائق مساندة للعميل: قائمة المستندات، نموذج البيانات، دليل الخدمة. نفس الهوية؛ بلا بيانات عميل (فراغات للتعبئة).
لا معلومات حكومية مخترعة: المتطلبات والمراحل من عرض السعر المعتمد، وما لا نعرفه يُحال للجهة المختصة."""
from content import *

BL = "________________"

CHECKLIST = [
    ("Passport", "جواز السفر",
     "A clear copy of a valid passport for each partner. Required from: every partner.",
     "صورة واضحة لجواز سفر ساري المفعول لكل شريك. مطلوب من: كل شريك."),
    ("Residence permit and employer no-objection letter", "الإقامة وخطاب عدم الممانعة",
     "If the applicant is resident in the Kingdom: a copy of the residence permit and a no-objection letter from the employer. Required from: resident applicants only.",
     "إن كان المتقدم مقيماً في المملكة: نسخة من الإقامة وخطاب عدم ممانعة من جهة عمله. مطلوب من: المقيمين فقط."),
    ("Proposed company name", "اسم الشركة المقترح",
     "Three options, in order of preference.",
     "ثلاثة خيارات بحسب الأفضلية."),
    ("Activity, project description and business plan", "النشاط ووصف المشروع وخطة العمل",
     "The company’s activity, a description of the innovative project and a brief business plan.",
     "نشاط الشركة، ووصف المشروع المبتكر، وخطة عمل مختصرة."),
    ("Ownership structure and capital", "هيكل الملكية ورأس المال",
     "Partners’ names and percentages, and the proposed capital.",
     "أسماء الشركاء ونسبهم، ورأس المال المقترح."),
    ("Manager and authorised signatories", "المدير والمفوّضون",
     "Names and identification details of the manager and any authorised signatory.",
     "أسماء المدير وأي مفوّض بالتوقيع وبيانات هوياتهم."),
    ("Support or project-endorsement letter", "خطاب الدعم أو اعتماد المشروع",
     "From a Saudi university or an accredited business incubator, including the activity and the ownership data. We guide you to the entity and coordinate with it.",
     "من جامعة سعودية أو حاضنة أعمال معتمدة، ويتضمن النشاط وبيانات الملكية. نوجّهك إلى الجهة وننسّق معها."),
    ("Foreign partner company documents", "مستندات الشريك إن كان شركة أجنبية",
     "Its commercial registration attested by the Saudi embassy (and the parent company’s if the nationality differs), translated. Required from: foreign-company partners only.",
     "سجلها التجاري مصدّقاً من السفارة السعودية (ومعه سجل الشركة الأم إن اختلفت الجنسية)، مترجماً. مطلوب من: الشركاء من الشركات الأجنبية فقط."),
    ("Source of funds and beneficial owner", "مصدر الأموال والمستفيد الحقيقي",
     "Beneficial-owner details, and supporting evidence of the source of funds when requested.",
     "بيانات المستفيد الحقيقي، وإثباتات مصدر الأموال عند الطلب."),
    ("Signed documents and authorisation", "الوثائق الموقّعة والتفويض",
     "Signing the documents we prepare and authorising us to file and follow up on your behalf.",
     "التوقيع على الوثائق التي نجهزها وتفويضنا بالتقديم والمتابعة نيابة عنك."),
]

FORM = [
    ("A. Applicant", "أ. مقدّم الطلب",
     "Full name as in the passport: %s<br>Nationality: %s<br>Passport no.: %s<br>ID / Iqama no. (if any): %s<br>Resident in the Kingdom?  ☐ Yes  ☐ No" % ((BL,) * 4),
     "الاسم الكامل كما في الجواز: %s<br>الجنسية: %s<br>رقم الجواز: %s<br>رقم الهوية / الإقامة (إن وُجد): %s<br>مقيم في المملكة؟  ☐ نعم  ☐ لا" % ((BL,) * 4)),
    ("B. Contact and address", "ب. التواصل والعنوان",
     "Mobile: %s<br>Email: %s<br>National / residence address: %s" % ((BL,) * 3),
     "الجوال: %s<br>الإيميل: %s<br>العنوان الوطني / السكن: %s" % ((BL,) * 3)),
    ("C. The company", "ج. الشركة",
     "Proposed names (1): %s<br>(2): %s<br>(3): %s<br>Activity: %s<br>Project description: %s<br>%s" % (BL, BL, BL, BL, BL, BL),
     "الأسماء المقترحة (1): %s<br>(2): %s<br>(3): %s<br>النشاط: %s<br>وصف المشروع: %s<br>%s" % (BL, BL, BL, BL, BL, BL)),
    ("D. Ownership and capital", "د. الملكية ورأس المال",
     "Partner 1 — name / %%: %s<br>Partner 2 — name / %%: %s<br>Proposed capital: %s<br>Is any partner a foreign company?  ☐ Yes  ☐ No" % ((BL,) * 3),
     "الشريك 1 — الاسم / النسبة: %s<br>الشريك 2 — الاسم / النسبة: %s<br>رأس المال المقترح: %s<br>هل أحد الشركاء شركة أجنبية؟  ☐ نعم  ☐ لا" % ((BL,) * 3)),
    ("E. Management", "هـ. الإدارة",
     "Manager — name / nationality / ID no.: %s<br>Authorised signatories: %s" % (BL, BL),
     "المدير — الاسم / الجنسية / رقم الهوية: %s<br>المفوّضون بالتوقيع: %s" % (BL, BL)),
    ("F. Support entity", "و. جهة الدعم",
     "University / incubator (if already chosen): %s<br>☐ I need guidance to choose one" % BL,
     "الجامعة / الحاضنة (إن اختيرت): %s<br>☐ أحتاج توجيهاً لاختيار جهة" % BL),
    ("G. Source of funds and beneficial owner", "ز. مصدر الأموال والمستفيد الحقيقي",
     "Source of funds: %s<br>Beneficial owner(s): %s" % (BL, BL),
     "مصدر الأموال: %s<br>المستفيد الحقيقي: %s" % (BL, BL)),
    ("H. Declaration", "ح. الإقرار",
     "I confirm that the information above is true and complete.<br>Name: %s   Date: %s<br>Signature: %s" % ((BL,) * 3),
     "أقرّ بأن المعلومات أعلاه صحيحة وكاملة.<br>الاسم: %s   التاريخ: %s<br>التوقيع: %s" % ((BL,) * 3)),
]

GUIDE = [
    ("What this service is", "ما هذه الخدمة",
     "Registering your investment under the entrepreneurship category with the Ministry of Investment (MISA), then establishing your company and registering it with the competent authorities, delivered ready to operate (service BP-FI-05).",
     "تسجيل استثمارك في فئة ريادة الأعمال لدى وزارة الاستثمار، ثم تأسيس شركتك وتسجيلها لدى الجهات المختصة، وتسليمها جاهزةً للتشغيل (الخدمة BP-FI-05)."),
    ("Who decides eligibility", "من يقرر الأهلية",
     "We study your project’s eligibility for the entrepreneurship category and advise you. The category and the activity are determined by the competent entity, and we do not guarantee an outcome that depends on its decision.",
     "ندرس أهلية مشروعك لفئة ريادة الأعمال ونشير عليك. والفئة والنشاط تحددهما الجهة المختصة، ولا نضمن نتيجة تعتمد على قرارها."),
]
for i, (te, ta, de, da) in enumerate(SCOPE, 1):
    GUIDE.append(("Step %d — %s" % (i, te), "الخطوة %d — %s" % (i, ta), de, da))
GUIDE += [
    ("How long it takes", "كم تستغرق",
     "Investment registration: the announced official period is 10 working days from the date the file is complete. Before it: document preparation, the support letter and attestation, which are on you and determine the overall duration. After it: incorporation and opening the company’s files. The detailed schedule is set at contract signing.",
     "التسجيل الاستثماري: المدة الرسمية المعلنة 10 أيام عمل من اكتمال الملف. قبله: تجهيز المستندات وخطاب الدعم والتصديق، وهي عليك وتحدد المدة الكلية. وبعده: تأسيس الشركة وفتح ملفاتها. وتُحدَّد الجدولة التفصيلية عند توقيع العقد."),
    ("What it costs", "كم تكلف",
     "Our service fee is SAR %s before 15%% VAT, paid in two instalments: 50%% on signing the contract and 50%% after the company is established and the work is delivered. Government fees are not included and are paid by you directly to the entities." % n(FEE),
     "أتعابنا %s ريال قبل ضريبة القيمة المضافة 15%%، وتُسدَّد على دفعتين: 50%% عند التعاقد و50%% بعد تأسيس الشركة وتسليم العمل. والرسوم الحكومية غير شاملة، وتسدّدها أنت مباشرة للجهات." % n(FEE)),
    ("What you receive", "ما الذي تتسلمه",
     "The investment registration certificate, the commercial registration and contract of incorporation, chamber membership, the tax number and ZATCA certificate, the GOSI and Ministry of Human Resources files, the national address and the complete company document pack.",
     "شهادة التسجيل الاستثماري، والسجل التجاري وعقد التأسيس، وعضوية الغرفة، والرقم الضريبي وشهادة الزكاة والضريبة والجمارك، وملفات التأمينات ووزارة الموارد البشرية، والعنوان الوطني، وحزمة مستندات الشركة كاملة."),
    ("What is not included", "ما لا تشمله الخدمة",
     "Government and entity fees, attestation and certified translation, support-entity fees, powers of attorney (issued directly from within the Kingdom if you are resident), opening a bank account, and post-incorporation obligations such as renewals, zakat and tax filing and social insurance.",
     "الرسوم الحكومية ورسوم الجهات، والتصديق والترجمة المعتمدة، ورسوم جهة الدعم، والوكالات (تصدر من داخل السعودية مباشرة إن كنت مقيماً)، وفتح الحساب البنكي، والالتزامات اللاحقة للتأسيس كالتجديد والزكاة والضريبة والتأمينات."),
    ("What we need from you", "ما نحتاجه منك",
     "Complete the client data form and send the documents in the checklist. Complete and timely documents are what keep the timeline short.",
     "عبّئ نموذج بيانات العميل وأرسل المستندات الواردة في القائمة. والمستندات الكاملة في وقتها هي ما يُبقي المدة قصيرة."),
]

def spec(rows, t_en, t_ar, k_en, k_ar, s_en, s_ar, numbered=True):
    return (rows, t_en, t_ar, k_en, k_ar, s_en, s_ar, numbered)

INFO = {
    "04-Client-Documents-Checklist": spec(CHECKLIST, "Required Documents Checklist", "قائمة المستندات المطلوبة", "CHECKLIST", "قائمة",
        "The documents we need from you to start the entrepreneurship-licence company formation.",
        "المستندات التي نحتاجها منك لبدء تأسيس شركتك برخصة ريادة الأعمال."),
    "05-Client-Data-Form": spec(FORM, "Client Data Form", "نموذج بيانات العميل", "FORM", "نموذج",
        "Please complete this form and return it with the documents in the checklist.",
        "نرجو تعبئة هذا النموذج وإعادته مع المستندات الواردة في القائمة.", False),
    "06-Service-Guide": spec(GUIDE, "Service Guide: Entrepreneurship-Licence Company", "دليل الخدمة: شركة برخصة ريادة الأعمال", "SERVICE GUIDE", "دليل الخدمة",
        "What the service includes, how it works, what it costs and what we need from you.",
        "ما تشمله الخدمة وكيف تسير وكم تكلف وما نحتاجه منك.", False),
}
