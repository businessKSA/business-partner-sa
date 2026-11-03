# -*- coding: utf-8 -*-
"""كتل نصية مشتركة بين مواصفات عملاء 2026-11-03. لا أرقام أسعار هنا (الأسعار من الكتالوج بالـSKU في المحرّك).
لا معلومات حكومية مخترعة: ما تعرضه الكتل من المصدر الرسمي مؤرَّخ، وما سواه صياغة لما نحتاجه نحن من العميل."""

BL = "________________"
BX = "☐"

# ---------------------------------------------------------------- الرسوم الحكومية (صفوف GOV_FEES)
GOV_MISA = ("Investment registration", "التسجيل الاستثماري", "Ministry of Investment", "وزارة الاستثمار",
            "Set by the Ministry on approval for the whole registration period; payable within 30 days of the notice, otherwise the registration lapses (MISA Investor Guide, September 2026)",
            "تحدّدها الوزارة عند الموافقة عن كامل مدة التسجيل، وتُسدَّد خلال 30 يوماً من الإشعار وإلا بطل التسجيل (دليل المستثمر، وزارة الاستثمار، سبتمبر 2026)")
GOV_CR = ("Commercial registration & publication", "السجل التجاري والنشر", "Ministry of Commerce", "وزارة التجارة",
          "By entity type; confirmed on execution day", "حسب نوع الكيان؛ تُؤكَّد يوم التنفيذ")
GOV_CHAMBER = ("Chamber of Commerce membership", "عضوية الغرفة التجارية", "Chamber of Commerce", "الغرفة التجارية",
               "By capital and activity; confirmed on execution day", "حسب رأس المال والنشاط؛ تُؤكَّد يوم التنفيذ")
GOV_ESTORE = ("E-store documentation", "توثيق المتجر الإلكتروني", "Saudi Business Center", "المركز السعودي للأعمال",
              "Any fee set by the entity; confirmed on execution day", "أي رسم تحدّده الجهة؛ يُؤكَّد يوم التنفيذ")
GOV_SBC = ("Service fee of the entity", "رسم الجهة عن الخدمة", "Saudi Business Center / Ministry of Commerce", "المركز السعودي للأعمال / وزارة التجارة",
           "By service; confirmed on execution day", "بحسب الخدمة؛ يُؤكَّد يوم التنفيذ")

# ---------------------------------------------------------------- الشروط
def terms(replaces=None, with_contract=True, extra=()):
    T = [("This quotation is valid for 14 days from its date.", "هذا العرض سارٍ لمدة 14 يوماً من تاريخه.")]
    if replaces:
        T.append(replaces)
    T += [
        ("Prices are in Saudi riyals, before 15% VAT, which is added according to the regulations.",
         "الأسعار بالريال السعودي قبل ضريبة القيمة المضافة 15% وتُضاف وفق النظام."),
        ("Acceptance is by signing the quotation%s and paying the first instalment; work starts after both." % (" and the contract" if with_contract else ""),
         "القبول بتوقيع العرض%s وسداد الدفعة الأولى، ويبدأ العمل بعد الأمرين." % (" والعقد" if with_contract else "")),
        ("The timeline starts when the complete documents and the payment due are received, and depends on the response times of the entities.",
         "تبدأ المدة من استلام المستندات كاملة والمستحق، وتخضع لمدد استجابة الجهات."),
        ("The decisions of the competent entities are theirs alone; we prepare, file and follow up, and we do not guarantee an outcome that depends on their decision. Our assessment is advisory.",
         "قرارات الجهات المختصة لها وحدها؛ ونحن نُعدّ ونقدّم ونتابع، ولا نضمن نتيجة تعتمد على قرارها. وتقييمنا استشاري."),
        ("Our services are administrative and advisory and are not the practice of law or licensed legal advice.",
         "خدماتنا إدارية واستشارية، ولا تُعدّ ممارسة للمحاماة ولا رأياً قانونياً مرخصاً."),
        ("The Client’s documents are used only to perform the service. Hosting and any transfer outside the Kingdom: [●].",
         "تُستعمل مستندات العميل لتنفيذ الخدمة فقط. موقع الاستضافة وأي نقل خارج المملكة: [●]."),
    ]
    T += list(extra)
    if with_contract:
        T.append(("The legal terms are in the service contract and the non-disclosure agreement signed with this quotation.",
                  "الأحكام القانونية في عقد الخدمة واتفاقية عدم الإفصاح الموقّعين مع هذا العرض."))
    else:
        T.append(("The legal terms are in the non-disclosure agreement signed with this quotation and in the service contract, which is issued once the scope is confirmed.",
                  "الأحكام القانونية في اتفاقية عدم الإفصاح الموقّعة مع هذا العرض وفي عقد الخدمة الذي يصدر بعد تأكيد النطاق."))
    return T

# ---------------------------------------------------------------- خطاب التفويض: بنود جهات شائعة
def deleg(title_en, title_ar, ent_en, ent_ar, sc_en, sc_ar):
    return (title_en, title_ar, ent_en, ent_ar, sc_en, sc_ar)

D_MISA = deleg("Registration with the Ministry of Investment", "التسجيل لدى وزارة الاستثمار", "Ministry of Investment (MISA)", "وزارة الاستثمار",
               "Preparing, submitting and following up the investment registration file for the service named in section 2.",
               "إعداد ملف التسجيل الاستثماري للخدمة المذكورة في البند 2 وتقديمه ومتابعته.")
D_INCORP = deleg("Incorporation and registration with the competent authorities", "التأسيس لدى الجهات المختصة",
                 "Saudi Business Center, Chamber of Commerce, ZATCA, GOSI, Ministry of Human Resources, national address",
                 "المركز السعودي للأعمال، الغرفة التجارية، الزكاة والضريبة والجمارك، التأمينات الاجتماعية، وزارة الموارد البشرية، العنوان الوطني",
                 "Preparing and submitting the incorporation and registration applications and following them up. Signing the contract of incorporation or partners’ decisions on the Client’s behalf is excluded.",
                 "إعداد طلبات التأسيس والتسجيل وتقديمها ومتابعتها. ويُستثنى توقيع عقد التأسيس أو قرارات الشركاء باسم العميل.")
D_SBC = deleg("Filing with the Saudi Business Center", "التقديم عبر المركز السعودي للأعمال", "Saudi Business Center (Ministry of Commerce)", "المركز السعودي للأعمال (وزارة التجارة)",
              "Preparing, submitting and following up the applications of the service named in section 2 through the Client’s account delegation. Signing contracts or partners’ decisions on the Client’s behalf is excluded.",
              "إعداد طلبات الخدمة المذكورة في البند 2 وتقديمها ومتابعتها عبر تفويض حساب العميل. ويُستثنى توقيع العقود أو قرارات الشركاء باسم العميل.")
D_ESTORE = deleg("Documenting the online store in the e-commerce register", "توثيق المتجر الإلكتروني في سجل التجارة الإلكترونية", "Saudi Business Center", "المركز السعودي للأعمال",
                 "Preparing, submitting and following up the documentation of the Client’s online store, using the store details the Client provides.",
                 "إعداد طلب توثيق المتجر الإلكتروني وتقديمه ومتابعته، اعتماداً على بيانات المتجر التي يقدّمها العميل.")
D_BANK = deleg("Corporate bank account opening support", "دعم فتح الحساب البنكي للشركة", "The bank chosen by the Client", "البنك الذي يختاره العميل",
               "Preparing the file and coordinating with the bank. Opening the account, signing bank forms and operating the account remain with the Client’s authorised signatories.",
               "تجهيز الملف والتنسيق مع البنك. ويبقى فتح الحساب وتوقيع نماذج البنك وتشغيل الحساب لمفوّضي العميل.")

# ---------------------------------------------------------------- قوائم مستندات شائعة (en, ar, body_en, body_ar)
def ck(t_en, t_ar, b_en, b_ar): return (t_en, t_ar, b_en, b_ar)

CK_PASSPORT = ck("Passport", "جواز السفر", "A clear copy of a valid passport for each partner. Required from: every partner.",
                 "صورة واضحة لجواز سفر ساري المفعول لكل شريك. مطلوب من: كل شريك.")
CK_RESIDENT = ck("Residence permit and employer no-objection letter", "الإقامة وخطاب عدم الممانعة",
                 "If the applicant is resident in the Kingdom: a copy of the residence permit and a no-objection letter from the employer. Required from: resident applicants only.",
                 "إن كان المتقدم مقيماً في المملكة: نسخة من الإقامة وخطاب عدم ممانعة من جهة عمله. مطلوب من: المقيمين فقط.")
CK_NAME = ck("Proposed company name", "اسم الشركة المقترح", "Three options, in order of preference.", "ثلاثة خيارات بحسب الأفضلية.")
CK_OWN = ck("Ownership structure and capital", "هيكل الملكية ورأس المال", "Partners’ names and percentages, and the proposed capital.", "أسماء الشركاء ونسبهم، ورأس المال المقترح.")
CK_MGR = ck("Manager and authorised signatories", "المدير والمفوّضون", "Names and identification details of the manager and any authorised signatory.", "أسماء المدير وأي مفوّض بالتوقيع وبيانات هوياتهم.")
CK_FOREIGN = ck("Foreign partner company documents", "مستندات الشريك إن كان شركة أجنبية",
                "Its commercial registration attested by the Saudi embassy (and the parent company’s if the nationality differs), translated. Required from: foreign-company partners only.",
                "سجلها التجاري مصدّقاً من السفارة السعودية (ومعه سجل الشركة الأم إن اختلفت الجنسية)، مترجماً. مطلوب من: الشركاء من الشركات الأجنبية فقط.")
CK_BO = ck("Source of funds and beneficial owner", "مصدر الأموال والمستفيد الحقيقي", "Beneficial-owner details, and supporting evidence of the source of funds when requested.",
           "بيانات المستفيد الحقيقي، وإثباتات مصدر الأموال عند الطلب.")
CK_SIGNED = ck("Signed documents and authorisation", "الوثائق الموقّعة والتفويض", "Signing the documents we prepare and authorising us to file and follow up on your behalf.",
               "التوقيع على الوثائق التي نجهزها وتفويضنا بالتقديم والمتابعة نيابة عنك.")

# ---------------------------------------------------------------- نموذج: مجموعات حقول
def fg(t_en, t_ar, fields):
    """fields: [(label_en, label_ar)] أو [(label_en, label_ar, 'yn')] لسؤال نعم/لا."""
    en, ar_ = [], []
    for f in fields:
        if len(f) == 3:
            en.append("%s  %s Yes  %s No" % (f[0], BX, BX)); ar_.append("%s  %s نعم  %s لا" % (f[1], BX, BX))
        else:
            en.append("%s: %s" % (f[0], BL)); ar_.append("%s: %s" % (f[1], BL))
    return (t_en, t_ar, "<br>".join(en), "<br>".join(ar_))

F_APPLICANT = fg("A. Applicant", "أ. مقدّم الطلب", [("Full name as in the passport", "الاسم الكامل كما في الجواز"), ("Nationality", "الجنسية"), ("Passport no.", "رقم الجواز"),
                 ("ID / Iqama no. (if any)", "رقم الهوية / الإقامة (إن وُجد)"), ("Resident in the Kingdom?", "مقيم في المملكة؟", "yn")])
F_CONTACT = fg("B. Contact and address", "ب. التواصل والعنوان", [("Mobile", "الجوال"), ("Email", "الإيميل"), ("National / residence address", "العنوان الوطني / السكن")])
F_DECL = ("Declaration", "الإقرار", "I confirm that the information above is true and complete.<br>Name: %s   Date: %s<br>Signature: %s" % (BL, BL, BL),
          "أقرّ بأن المعلومات أعلاه صحيحة وكاملة.<br>الاسم: %s   التاريخ: %s<br>التوقيع: %s" % (BL, BL, BL))

def letter_decl(letter):
    t_en, t_ar, b_en, b_ar = F_DECL
    return ("%s. %s" % (letter[0], t_en), "%s. %s" % (letter[1], t_ar), b_en, b_ar)

EXCL_GOV = ("Government fees and the entities’ charges: not included in the price and paid by the Client directly to the entities.",
            "الرسوم الحكومية ورسوم الجهات: غير شاملة في السعر، ويسدّدها العميل مباشرة للجهات.")
EXCL_EXTRA = ("Any item not expressly listed in this quotation; additional work is performed only under a written change request priced separately.",
              "أي بند غير مذكور صراحةً في هذا العرض؛ ولا يُنفَّذ عمل إضافي إلا بطلب تغيير كتابي يُسعَّر على حدة.")
