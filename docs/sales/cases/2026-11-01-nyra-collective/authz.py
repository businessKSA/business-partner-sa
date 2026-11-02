# -*- coding: utf-8 -*-
"""خطاب التفويض لـNyra Collective — نص القانونية (authorization-letter-template-DRAFT.md) + قائمة تفويض بخانات اختيار (§3.3).
غير المحدَّد غير مفوَّض. لا وكالة: الوكالة (إن لزمت) مستند مستقل خارج حزمتنا."""
import os, re
from content import *

AUTH_MD = os.path.join(ROOT, "docs/sales/templates/categories/authorization-letter-template-DRAFT.md")
T_EN, T_AR = "Authorization Letter", "خطاب تفويض"

def legal():
    out, in_p1, cur = {}, False, None
    for line in open(AUTH_MD, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## الجزء الأول"): in_p1 = True; continue
        if line.startswith("## الجزء الثاني"): break
        if not in_p1: continue
        if line.startswith("### "):
            cur = line[4:].strip(); out[cur] = {}
        elif cur and line.startswith("- EN: "): out[cur]["en"] = line[6:].strip()
        elif cur and line.startswith("- AR: "): out[cur]["ar"] = line[6:].strip()
    return out

def get(d, num):
    for k, v in d.items():
        if k.startswith("%d. " % num) and "en" in v:
            a, b = [x.strip() for x in k.split(" / ", 1)]
            return re.sub(r"^\d+\.\s*", "", a), re.sub(r"^\d+\.\s*", "", b), v["en"], v["ar"]
    raise KeyError(num)

BOX = "☐"
DELEG = [  # (title_en, title_ar, entity_en, entity_ar, scope_en, scope_ar)
    ("Registration with the Ministry of Investment", "التسجيل لدى وزارة الاستثمار",
     "Ministry of Investment (MISA)", "وزارة الاستثمار",
     "Preparing, submitting and following up the investment registration file under the entrepreneurship category.",
     "إعداد ملف التسجيل الاستثماري لفئة ريادة الأعمال وتقديمه ومتابعته."),
    ("Incorporation and registration with the competent authorities", "التأسيس لدى الجهات المختصة",
     "Saudi Business Center, Chamber of Commerce, ZATCA, GOSI, Ministry of Human Resources, national address",
     "المركز السعودي للأعمال، الغرفة التجارية، الزكاة والضريبة والجمارك، التأمينات الاجتماعية، وزارة الموارد البشرية، العنوان الوطني",
     "Preparing and submitting the incorporation and registration applications and following them up. Signing the contract of incorporation or partners’ decisions on the Client’s behalf is excluded.",
     "إعداد طلبات التأسيس والتسجيل وتقديمها ومتابعتها. ويُستثنى توقيع عقد التأسيس أو قرارات الشركاء باسم العميل."),
    ("Documenting the online store in the e-commerce register", "توثيق المتجر الإلكتروني في سجل التجارة الإلكترونية",
     "Saudi Business Center", "المركز السعودي للأعمال",
     "Preparing, submitting and following up the documentation of the Client’s online store, using the store details the Client provides.",
     "إعداد طلب توثيق المتجر الإلكتروني وتقديمه ومتابعته، اعتماداً على بيانات المتجر التي تقدّمها العميلة."),
    ("Paying official fees on the Client’s behalf", "دفع الرسوم الرسمية نيابةً عن العميل",
     "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
     "Only from funds the Client has deposited for that purpose, against the entity’s receipt; the unused balance is returned.",
     "من مبالغ أودعها العميل لهذا الغرض فقط وبإيصال الجهة، ويُرد الرصيد غير المستعمل."),
    ("Receiving notifications and official correspondence", "استلام الإشعارات والمراسلات الرسمية",
     "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
     "Receiving notifications and official documents relating to the authorised transactions only, and notifying the Client within [2] business days.",
     "استلام الإشعارات والمستندات الرسمية المتعلقة بالمعاملات المفوَّض بها وحدها، وإبلاغ العميل خلال [2] يوم عمل."),
    ("Viewing the Client’s accounts on the platforms", "الاطلاع على حسابات العميل في المنصات",
     "The platforms of the entities named above", "منصات الجهات المسماة أعلاه",
     "View-only access through the platforms’ official delegation features, never through passwords or verification codes, limited to the authorised transactions.",
     "اطلاع فقط عبر خصائص التفويض الرسمية في المنصات، لا بكلمات المرور ولا رموز التحقق، ومحصور في المعاملات المفوَّض بها."),
    ("Transferring the Client’s data", "نقل بيانات العميل",
     "The entities, and the First Party’s service providers (hosting and artificial intelligence)", "الجهات، ومزودو خدمات الطرف الأول (الاستضافة والذكاء الاصطناعي)",
     "Transferring the Client’s documents and data only as needed to perform the authorised services, under the data protection clause. Transfer outside the Kingdom: %s Authorised  %s Not authorised." % (BOX, BOX),
     "نقل مستندات العميل وبياناته بقدر ما يلزم لتنفيذ الخدمات المفوَّض بها فقط، وفق بند حماية البيانات. النقل خارج المملكة: %s مفوَّض  %s غير مفوَّض." % (BOX, BOX)),
]

def rows():
    d = legal()
    R = []
    def add(t_en, t_ar, b_en, b_ar): R.append([t_en, t_ar, b_en, b_ar])
    add("2. Services covered", "2. الخدمات المشمولة",
        "Only the services of the accepted quotation dated 1 November 2026 (services BP-FI-05, entrepreneurship-licence company formation, and BP-SBC-26, e-store documentation) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        "خدمات عرض السعر المقبول المؤرخ 1 نوفمبر 2026 (الخدمتان BP-FI-05، تأسيس شركة برخصة ريادة الأعمال، وBP-SBC-26، توثيق المتجر الإلكتروني) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.")
    add("3. Delegation list — the Second Party ticks what it authorises", "3. قائمة التفويض — يحدّد الطرف الثاني ما يفوّض به",
        "Tick %s each delegation the Second Party authorises. For each item: the entity, the scope, the term stated in section 9, and the right to stop it immediately by written notice." % BOX,
        "يضع الطرف الثاني علامة %s أمام كل تفويض يمنحه. ولكل بند: الجهة والنطاق والمدة المذكورة في البند 9 وحقه في إيقافه فوراً بإشعار كتابي." % BOX)
    for i, (te, ta, ee, ea, se, sa) in enumerate(DELEG, 1):
        add("3.%d  %s  %s Authorised" % (i, te, BOX), "3.%d  %s  %s مفوَّض" % (i, ta, BOX),
            "<b>Entity:</b> %s<br><b>Scope:</b> %s<br><b>Stop:</b> immediately by written notice." % (ee, se),
            "<b>الجهة:</b> %s<br><b>النطاق:</b> %s<br><b>الإيقاف:</b> فوراً بإشعار كتابي." % (ea, sa))
    for num, label in ((3, "4"), (4, "5"), (5, "6"), (6, "7"), (7, "8"), (8, "9"), (9, "10"), (10, "11"), (11, "12"), (12, "13")):
        t_en, t_ar, b_en, b_ar = get(d, num)
        if num == 3:
            b_en = b_en.replace("Within the covered services only, the Authorised Party may:", "Within the services the Second Party has ticked in section 3 only, the First Party may:")
            b_ar = b_ar.replace("ضمن الخدمات المشمولة وحدها، للمفوَّض:", "ضمن البنود التي حدّدها الطرف الثاني في البند 3 وحدها، للطرف الأول:")
        if num == 7:
            b_en = "The First Party acts only through its named staff: Dr. Baher Magnas, Chief Executive Officer; any other staff member only with the Second Party’s prior written approval (identification details are kept in the executed copy)."
            b_ar = "يعمل الطرف الأول عبر موظفيه المسمّين وحدهم: د. باهر مقنص، المدير التنفيذي؛ ولا يعمل أي موظف آخر إلا بموافقة كتابية مسبقة من الطرف الثاني (وبيانات الهوية في النسخة الموقّعة)."
        b_en = b_en.replace("the Category Annex", "section 3").replace("The Authorised Party", "The First Party").replace("the Authorised Party", "the First Party").replace("The Principal", "The Second Party").replace("the Principal", "the Second Party").replace("Principal’s", "Second Party’s")
        b_ar = b_ar.replace("ملحق الفئة", "البند 3").replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        t_en = t_en.replace("Principal’s", "Second Party’s").replace("Authorised Party’s", "First Party’s")
        t_ar = t_ar.replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        add("%s. %s" % (label, t_en), "%s. %s" % (label, t_ar), b_en, b_ar)
    return R

INFO_COVER = ("AUTHORIZATION", "تفويض", T_EN, T_AR,
              "The Second Party chooses, from a list, what it authorises the First Party to do.",
              "يختار الطرف الثاني من قائمة ما يفوّض به الطرف الأول.")
