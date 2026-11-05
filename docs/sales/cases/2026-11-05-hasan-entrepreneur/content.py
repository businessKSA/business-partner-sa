# -*- coding: utf-8 -*-
"""محتوى حزمة المهندس حسن — مصدر واحد للـHTML والـDOCX والـPPTX.
تأسيس شركة برخصة ريادة الأعمال (BP-FI-05). لا بيانات شخصية هنا؛ [●] لكل مجهول.
السعر قرار المالك 2026-11-05 (يتجاوز الكتالوج 30,000): الخيار أ = 20,000 بدون رسوم حكومية، الخيار ب = 25,000 مع الرسوم الحكومية؛ كلاهما قبل ضريبة 15٪. SKU: BP-FI-05.
"""
import json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
RLM = "‏"

# ---------------------------------------------------------------- السعر من الكتالوج (SKU)
def _catalog_price(code="BP-FI-05"):
    d = json.load(open(os.path.join(ROOT, "site/assets/data/catalog.json"), encoding="utf-8"))
    hit = []
    def walk(x):
        if isinstance(x, dict):
            if x.get("code") == code and "amount" in x:
                hit.append(x)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(d)
    assert hit, "SKU %s not in catalog" % code
    return hit[0]

# قرار المالك 2026-11-05: خياران لهذا العميل (نفس عرض أبو محمد اليمني بسعر مختلف)
FEE_A = 20000                       # أ: بدون الرسوم الحكومية
FEE_B = 25000                       # ب: مع الرسوم الحكومية
def _v(x): return x * 15 // 100
FEE = FEE_A; VAT = _v(FEE_A); TOTAL = FEE_A + VAT          # الخيار أ (الافتراضي في الجداول المفردة)
VAT_B = _v(FEE_B); TOTAL_B = FEE_B + VAT_B
HALF = FEE_A // 2; HALF_VAT = _v(HALF); HALF_TOTAL = HALF + HALF_VAT
HALF_B = FEE_B // 2; HALF_B_VAT = _v(HALF_B); HALF_B_TOTAL = HALF_B + HALF_B_VAT
def n(x): return "{:,}".format(x)

CLIENT_AR = "المهندس حسن"
CLIENT_EN = "Eng. Hasan"
DATE_EN = "5 November 2026"
DATE_AR = "5 نوفمبر 2026"

def ar(s):
    """نقطة الجملة العربية في آخرها (RLM) — معيار العرض §4."""
    s = re.sub(r"\.(?=\s|$)", "." + RLM, s)
    return s

# ---------------------------------------------------------------- عرض السعر
Q_TITLE_EN = "Quotation: Entrepreneurship-Licence Company Formation"
Q_TITLE_AR = "عرض سعر: تأسيس شركة برخصة ريادة الأعمال"

SCOPE = [  # (title_en, title_ar, text_en, text_ar)
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
     "Appointing the manager and preparing the authorisations required for the company’s operation.",
     "تعيين المدير وتجهيز التفويضات اللازمة لتشغيل الشركة."),
    ("Updates & handover", "المتابعة والتسليم",
     "Keeping the Client informed of the application status step by step, and handing over the complete final file.",
     "إبلاغ العميل بحالة الطلب أولاً بأول، وتسليم الملف النهائي كاملاً."),
]

DELIVERABLES = [
    ("Investment registration certificate (entrepreneurship category) from the Ministry of Investment.",
     "شهادة التسجيل الاستثماري (فئة ريادة الأعمال) من وزارة الاستثمار."),
    ("Commercial registration and the approved contract of incorporation.",
     "السجل التجاري وعقد التأسيس المعتمد."),
    ("Chamber of Commerce membership; tax number and ZATCA registration certificate.",
     "عضوية الغرفة التجارية؛ والرقم الضريبي وشهادة التسجيل في الزكاة والضريبة والجمارك."),
    ("GOSI and Ministry of Human Resources files, and the national address; the complete company document pack.",
     "ملفات التأمينات الاجتماعية ووزارة الموارد البشرية، والعنوان الوطني؛ وحزمة مستندات الشركة كاملة."),
]

GOV_FEES = [  # fee_en, fee_ar, entity_en, entity_ar, how_en, how_ar
    ("Investment registration", "التسجيل الاستثماري", "Ministry of Investment", "وزارة الاستثمار",
     "Set by the Ministry on approval", "تحدّدها الوزارة عند الموافقة"),
    ("Commercial registration & publication", "السجل التجاري والنشر", "Ministry of Commerce", "وزارة التجارة",
     "By entity type; confirmed on execution day", "حسب نوع الكيان؛ تُؤكَّد يوم التنفيذ"),
    ("Chamber of Commerce membership", "عضوية الغرفة التجارية", "Chamber of Commerce", "الغرفة التجارية",
     "By capital and activity; confirmed on execution day", "حسب رأس المال والنشاط؛ تُؤكَّد يوم التنفيذ"),
]

REQUIREMENTS = [
    ("Valid passport copy for each partner and contact details; signing the documents and authorising us to file and follow up on the Client’s behalf.",
     "صورة جواز السفر سارية المفعول لكل شريك وبيانات التواصل؛ والتوقيع على الوثائق وتفويضنا بالتقديم والمتابعة."),
    ("Proposed company name (three options), its activity, a description of the innovative project and a brief business plan.",
     "اسم الشركة المقترح (ثلاثة خيارات)، ونشاطها، ووصف المشروع المبتكر وخطة عمل مختصرة."),
    ("Ownership structure, partners’ percentages and proposed capital; manager and authorised-signatory details.",
     "هيكل الملكية ونسب الشركاء ورأس المال المقترح؛ وبيانات المدير والمفوّضين."),
    ("Support or project-endorsement letter from a Saudi university or accredited business incubator, including the activity and ownership data.",
     "خطاب دعم أو اعتماد المشروع من جامعة سعودية أو حاضنة أعمال معتمدة، يتضمن النشاط وبيانات الملكية."),
    ("If a partner is a foreign company: its commercial registration attested by the Saudi embassy (and the parent company’s if the nationality differs), translated.",
     "إن كان الشريك شركة أجنبية: سجلها التجاري مصدّقاً من السفارة السعودية (ومعه سجل الشركة الأم إن اختلفت الجنسية)، مترجماً."),
    ("If the applicant is resident in the Kingdom: a no-objection letter from the employer and a copy of the residence permit.",
     "إن كان المتقدم مقيماً في المملكة: خطاب عدم ممانعة من جهة عمله ونسخة من إقامته."),
]

EXCLUSIONS = [
    ("Government fees and the entities’ charges (investment registration, commercial registration and publication, chamber membership): under Option A they are not included and are paid by the Client directly to the entities; under Option B they are included in the price. Any other fee is always paid by the Client.",
     "الرسوم الحكومية ورسوم الجهات (التسجيل الاستثماري، والسجل التجاري والنشر، وعضوية الغرفة): في الخيار أ غير شاملة ويسدّدها العميل مباشرة للجهات، وفي الخيار ب شاملة في السعر. وأي رسم آخر يسدّده العميل."),
    ("Attestation of foreign documents, certified translation, fees of the support entity or incubator, and sectoral licence fees for regulated activities.",
     "تصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم جهة الدعم أو الحاضنة، ورسوم الجهات القطاعية للأنشطة الخاضعة."),
    ("Powers of attorney are not part of this package; where the Client is resident in the Kingdom, the power of attorney is issued directly from within the Kingdom.",
     "الوكالات ليست ضمن هذه الحزمة؛ وإن كان العميل مقيماً في المملكة فتصدر الوكالة من داخل السعودية مباشرة."),
    ("Opening a bank account, and post-incorporation obligations (renewals, zakat and tax filing, social insurance, accounting) unless listed above.",
     "فتح الحساب البنكي، والالتزامات اللاحقة للتأسيس (التجديد، الزكاة والضريبة، التأمينات، المحاسبة) ما لم تُذكر أعلاه."),
    ("Any item not expressly listed in this quotation; additional work is performed only under a written change request priced separately.",
     "أي بند غير مذكور صراحةً في هذا العرض؛ ولا يُنفَّذ عمل إضافي إلا بطلب تغيير كتابي يُسعَّر على حدة."),
]

DURATION = [
    ("Investment registration", "التسجيل الاستثماري",
     "Announced official period: 10 working days from the date the file is complete.",
     "المدة الرسمية المعلنة: 10 أيام عمل من اكتمال الملف."),
    ("Before it", "قبله",
     "Document preparation, the support letter and attestation (on the Client) — they determine the overall duration.",
     "تجهيز المستندات واستخراج خطاب الدعم والتصديق (وهي على العميل) وتحدد المدة الكلية."),
    ("After it", "بعده",
     "Incorporation of the company and opening its files with the entities. The detailed schedule is set at contract signing.",
     "تأسيس الشركة وفتح ملفاتها لدى الجهات. وتُحدَّد الجدولة التفصيلية عند توقيع العقد."),
]

PAYMENT = [  # (no, label_en, label_ar, pct, net, vat, total, due_en, due_ar)
    ("A1", "Option A — first instalment", "الخيار أ — الدفعة الأولى", "50%", HALF, HALF_VAT, HALF_TOTAL,
     "On signing the contract", "عند التعاقد"),
    ("A2", "Option A — second instalment", "الخيار أ — الدفعة الثانية", "50%", HALF, HALF_VAT, HALF_TOTAL,
     "After the company is established and the work is delivered", "بعد تأسيس الشركة وتسليم العمل"),
    ("B1", "Option B — first instalment", "الخيار ب — الدفعة الأولى", "50%", HALF_B, HALF_B_VAT, HALF_B_TOTAL,
     "On signing the contract", "عند التعاقد"),
    ("B2", "Option B — second instalment", "الخيار ب — الدفعة الثانية", "50%", HALF_B, HALF_B_VAT, HALF_B_TOTAL,
     "After the company is established and the work is delivered", "بعد تأسيس الشركة وتسليم العمل"),
]

TERMS = [
    ("This quotation is valid for 14 days from its date.", "هذا العرض سارٍ لمدة 14 يوماً من تاريخه."),
    ("Prices are in Saudi riyals, before 15% VAT, which is added according to the regulations.",
     "الأسعار بالريال السعودي قبل ضريبة القيمة المضافة 15% وتُضاف وفق النظام."),
    ("Acceptance is by signing the quotation and the contract and paying the first instalment; work starts after both.",
     "القبول بتوقيع العرض والعقد وسداد الدفعة الأولى، ويبدأ العمل بعد الأمرين."),
    ("The timeline starts when the complete documents and the payment due are received, and depends on the response times of the entities.",
     "تبدأ المدة من استلام المستندات كاملة والمستحق، وتخضع لمدد استجابة الجهات."),
    ("The category and the activity are determined by the competent entity; we do not guarantee an outcome that depends on its decision. Our assessment is advisory.",
     "الفئة والنشاط تحددهما الجهة المختصة، ولا نضمن نتيجة تعتمد على قرارها. وتقييمنا استشاري."),
    ("Our services are administrative and advisory and are not the practice of law or licensed legal advice.",
     "خدماتنا إدارية واستشارية، ولا تُعدّ ممارسة للمحاماة ولا رأياً قانونياً مرخصاً."),
    ("The Client’s documents are used only to perform the service. Hosting and any transfer outside the Kingdom: [●].",
     "تُستعمل مستندات العميل لتنفيذ الخدمة فقط. موقع الاستضافة وأي نقل خارج المملكة: [●]."),
    ("The legal terms are in the service contract and the non-disclosure agreement signed with this quotation.",
     "الأحكام القانونية في عقد الخدمة واتفاقية عدم الإفصاح الموقّعين مع هذا العرض."),
]

# ---------------------------------------------------------------- العقد
C_TITLE_EN = "Company Formation Service Agreement"
C_TITLE_AR = "عقد خدمة تأسيس شركة برخصة ريادة الأعمال"
C_SUB_EN = "Entrepreneurship-licence company formation — BP-FI-05."
C_SUB_AR = "تأسيس شركة برخصة ريادة الأعمال — BP-FI-05."

N_TITLE_EN = "Mutual Non-Disclosure Agreement"
N_TITLE_AR = "اتفاقية عدم إفصاح متبادلة"

# نص النواة والفئة يُقرأ من ملف القوالب القانوني (يبقى المصدر الوحيد للنص)
LEGAL_MD = os.path.join(ROOT, "docs/sales/templates/categories/contract-core-and-category-clauses-FOR-LEGAL-REVIEW.md")

def parse_legal():
    sec = None; cur = None; out = {}
    for line in open(LEGAL_MD, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## "):
            sec = line[3:].strip(); out.setdefault(sec, {}); cur = None
        elif line.startswith("### "):
            cur = line[4:].strip(); out[sec][cur] = {}
        elif cur and line.startswith("- EN: "):
            out[sec][cur]["en"] = line[6:].strip()
        elif cur and line.startswith("- AR: "):
            out[sec][cur]["ar"] = line[6:].strip()
    return out

def _find(sec_prefix):
    L = parse_legal()
    for k in L:
        if k.startswith(sec_prefix):
            return L[k]
    raise KeyError(sec_prefix)

def _clause(d, key_prefix):
    for k, v in d.items():
        if k.startswith(key_prefix):
            en_t, ar_t = [re.sub(r"^\d+\.\s*", "", x.strip()) for x in k.split(" / ", 1)]
            return en_t, ar_t, v["en"], v["ar"]
    raise KeyError(key_prefix)

def contract_clauses():
    core = _find("نواة العقد")
    cf = _find("بنود خاصة بفئة تأسيس الشركات")
    fi = _find("بنود خاصة بفئة الاستثمار الأجنبي")
    rows = []

    def add(t_en, t_ar, b_en, b_ar):
        rows.append([t_en, t_ar, b_en, b_ar])

    # 2 الموضوع — صيغة الاستثمار الأجنبي + التأسيس مخصّصة لريادة الأعمال
    add("Subject", "موضوع العقد",
        "The First Party provides the Client with the registration of the Client’s investment under the entrepreneurship category with the Ministry of Investment, and the establishment and registration of the resulting company and the issuance of its commercial licences and memberships with the competent authorities, as detailed in the accepted quotation (service BP-FI-05), which forms an integral part of this contract.",
        "يقدّم الطرف الأول للعميل إجراءات التسجيل الاستثماري لفئة ريادة الأعمال لدى وزارة الاستثمار، وتأسيس الشركة الناتجة وتسجيلها واستخراج تراخيصها وعضوياتها التجارية لدى الجهات المختصة، وفق ما هو مفصّل في عرض السعر المقبول (الخدمة BP-FI-05) الذي يُعدّ جزءاً لا يتجزأ من هذا العقد.")

    # 3 الرسوم والسداد
    t_en, t_ar, b_en, b_ar = _clause(core, "3.")
    b_en = b_en.replace(
        "The fees are those stated in the accepted quotation, before 15% VAT, which is added. Payment terms: [●].",
        "The Client selects ONE of two options (mark the selected one: [ ] A  [ ] B). Option A: SAR %s (twenty thousand Saudi riyals) before 15%% VAT, government fees NOT included and paid by the Client directly to the entities. Option B: SAR %s (twenty-five thousand Saudi riyals) before 15%% VAT, government fees (investment registration, commercial registration and publication, chamber membership) INCLUDED. Payment terms for either option: two equal instalments before VAT — 50%% on signing this contract and 50%% after the company is established and the work is delivered." % (n(FEE_A), n(FEE_B)))
    b_ar = b_ar.replace(
        "الرسوم هي المذكورة في عرض السعر المقبول، قبل ضريبة القيمة المضافة 15% التي تُضاف عليها. شروط السداد: [●].",
        "يختار العميل أحد خيارين فقط (يُعلَّم المختار: [ ] أ  [ ] ب). الخيار أ: %s ريال سعودي (عشرون ألف ريال) قبل ضريبة القيمة المضافة 15%% والرسوم الحكومية غير شاملة ويسدّدها العميل مباشرة للجهات. الخيار ب: %s ريال سعودي (خمسة وعشرون ألف ريال) قبل ضريبة القيمة المضافة 15%% والرسوم الحكومية (التسجيل الاستثماري، والسجل التجاري والنشر، وعضوية الغرفة) شاملة. شروط السداد للخيارين: دفعتان متساويتان قبل الضريبة — 50%% عند توقيع هذا العقد و50%% بعد تأسيس الشركة وتسليم العمل." % (n(FEE_A), n(FEE_B)))
    assert "[●]. Payment" not in b_en
    b_en = b_en.replace("IBAN [●]", "IBAN [IBAN]")
    b_ar = b_ar.replace("آيبان [●]", "آيبان [IBAN]")
    add(t_en, t_ar, b_en, b_ar)

    # 4 المخرجات والمدة والقبول
    t_en, t_ar, b_en, b_ar = _clause(core, "4.")
    b_en = b_en.replace("The contract term is: [●].", "The contract term runs from signature until the final deliverables stated in the quotation are delivered.")
    b_ar = b_ar.replace("مدة العقد: [●].", "مدة العقد من التوقيع حتى تسليم المخرجات النهائية المذكورة في عرض السعر.")
    add(t_en, t_ar, b_en, b_ar)

    for p in ("5.", "6."):
        add(*_clause(core, p))

    # 7 خارج نطاق السعر + الوكالة (قرار المالك)
    t_en, t_ar, b_en, b_ar = _clause(core, "7.")
    b_en += " Issuing any power of attorney is not part of the services; where the Client is resident in the Kingdom, it is issued directly from within the Kingdom."
    b_ar += " ولا يدخل إصدار أي وكالة ضمن الخدمات؛ وإن كان العميل مقيماً في المملكة فتصدر الوكالة من داخل السعودية مباشرة."
    add(t_en, t_ar, b_en, b_ar)

    add(*_clause(core, "8."))
    # بنود فئة الاستثمار الأجنبي والتأسيس
    add(*_clause(fi, "Compliance, Source of Funds"))
    add(*_clause(cf, "Scope Limits"))
    for p in ("9.", "10.", "11.", "12.", "13.", "14.", "15.", "16.", "17.", "18."):
        add(*_clause(core, p))
    return rows

def nda_rows():
    nda = _find("اتفاقية عدم الإفصاح المتبادلة العامة")
    rows = []
    for k in nda:
        en_t, ar_t = [re.sub(r"^\d+\.\s*", "", x.strip()) for x in k.split(" / ", 1)]
        rows.append([en_t, ar_t, nda[k]["en"], nda[k]["ar"]])
    return rows

def strip_numbers(rows):
    return rows

# ممثل بزنس بارتنر — أمر المالك (عبر بدر) 2026-10-31: يُكتب في العروض والعقود وNDA
REP_EN = "Dr. Baher Magnas"
REP_AR = "د. باهر مقنص"
REP_TITLE_EN = "Chief Executive Officer"
REP_TITLE_AR = "المدير التنفيذي"
