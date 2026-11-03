# -*- coding: utf-8 -*-
"""محتوى حزمة أبو محمد اليمني — مصدر واحد للـHTML والـDOCX والـPPTX.
الامتثال والقيد بنظام الامتياز التجاري (BP-PL-0019 باستثناء سعري بقرار المالك). لا بيانات شخصية هنا؛ [●] لكل مجهول.
السعر استثناء خاص بهذا العميل بقرار المالك 2026-11-03 (الكتالوج `BP-PL-0019` لا يطابق نطاق المشروع).
"""
import json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
RLM = "‏"

# ---------------------------------------------------------------- الأسعار: قرار المالك 2026-11-03 (عميل تجريبي، استثناء سعري خاص)
STD_FEE = 60000                      # أتعابنا قبل الخصم (عرض 23/7)
DISC_PCT = 50                        # خصم خاص بهذا العميل فقط
FEE = STD_FEE * (100 - DISC_PCT) // 100   # 30,000
DISC = STD_FEE - FEE                 # 30,000
P1 = 10000                           # المرحلة الأولى بعد الخصم
P2 = FEE - P1                        # 20,000
COUNSEL = 60000                      # المحامي السعودي (متفق عليه)
TRANS = 35000                        # الترجمة المعتمدة (تقدير)
ALL_NET = FEE + COUNSEL + TRANS      # 125,000
def vat(x): return x * 15 // 100
VAT = vat(FEE); TOTAL = FEE + VAT
HALF = FEE // 2; HALF_VAT = vat(HALF); HALF_TOTAL = HALF + HALF_VAT
ALL_VAT = vat(ALL_NET); ALL_TOTAL = ALL_NET + ALL_VAT
def n(x): return "{:,}".format(x)

CLIENT_AR = "مكتب عبيد وميدور للمحاماة (بالنيابة عن عميله مانح الامتياز)"
CLIENT_EN = "Obeid and Medawar Law Firm (on behalf of its franchisor client)"
DATE_EN = "3 November 2026"
DATE_AR = "3 نوفمبر 2026"

def ar(s):
    """نقطة الجملة العربية في آخرها (RLM) — معيار العرض §4."""
    s = re.sub(r"\.(?=\s|$)", "." + RLM, s)
    return s

Q_TITLE_EN = "Quotation: KSA Franchise Law Compliance & Registration"
Q_TITLE_AR = "عرض سعر: الامتثال والقيد بنظام الامتياز التجاري"

SCOPE = [  # (title_en, title_ar, text_en, text_ar)
    ("Phase 1 — Compliance assessment & gap analysis", "المرحلة الأولى — تقييم الامتثال وتحليل الفجوات",
     "Agreement-by-agreement assessment of the four franchise agreements against the Franchise Law and its Implementing Regulations, and a gap report with recommendations. SAR %s. The Client confirms in writing before Phase 2 starts." % n(P1),
     "تقييم اتفاقيات الامتياز الأربع واحدة واحدة مقابل نظام الامتياز التجاري ولائحته التنفيذية، وتقرير فجوات بالتوصيات. %s ريال. ويؤكد العميل كتابةً قبل بدء المرحلة الثانية." % n(P1)),
    ("Phase 2 — Saudi disclosure document", "المرحلة الثانية — وثيقة الإفصاح السعودية",
     "Coordinating and managing the preparation of the Saudi franchise disclosure document with the Saudi legal counsel. Phase 2 total SAR %s." % n(P2),
     "تنسيق وإدارة إعداد وثيقة الإفصاح السعودية للامتياز مع المحامي السعودي. إجمالي المرحلة الثانية %s ريال." % n(P2)),
    ("Phase 2 — Franchise agreement review & Saudi localisation", "المرحلة الثانية — مراجعة اتفاقية الامتياز وتوطينها",
     "Coordinating the legal review and Saudi localisation of the franchise agreement template.",
     "تنسيق المراجعة القانونية لنموذج اتفاقية الامتياز وتوطينه سعودياً."),
    ("Phase 2 — Remediation documentation", "المرحلة الثانية — مستندات التصحيح",
     "Coordinating the corrective documentation for the existing franchise relationships.",
     "تنسيق مستندات التصحيح لعلاقات الامتياز القائمة."),
    ("Phase 2 — Certified Arabic translation", "المرحلة الثانية — الترجمة العربية المعتمدة",
     "Selecting and managing the certified translation provider; the scope of documents to translate is confirmed by the Saudi legal counsel.",
     "اختيار مزوّد الترجمة المعتمدة وإدارته؛ ويؤكد المحامي السعودي نطاق المستندات المطلوب ترجمتها."),
    ("Phase 2 — Ministry of Commerce registration", "المرحلة الثانية — القيد لدى وزارة التجارة",
     "Preparing and managing the registration process with the Ministry of Commerce, with legal filing support from the Saudi legal counsel.",
     "إعداد وإدارة إجراءات القيد لدى وزارة التجارة بدعم قانوني للتقديم من المحامي السعودي."),
    ("Phase 2 — Operational readiness & training", "المرحلة الثانية — الجاهزية التشغيلية والتدريب",
     "Reviewing operational readiness, preparing a future Saudi franchise compliance framework, training and post-completion clarification support.",
     "مراجعة الجاهزية التشغيلية، وإعداد إطار امتثال مستقبلي للامتياز في السعودية، والتدريب، ودعم التوضيح بعد الإنجاز."),
]

DELIVERABLES = [
    ("Compliance assessment and gap-analysis report for the four franchise agreements.",
     "تقرير تقييم الامتثال وتحليل الفجوات لاتفاقيات الامتياز الأربع."),
    ("Saudi disclosure document and localised franchise agreement (prepared with the Saudi legal counsel).",
     "وثيقة الإفصاح السعودية واتفاقية الامتياز بعد التوطين (بإعداد مع المحامي السعودي)."),
    ("Remediation documentation for the existing franchise relationships, and certified Arabic translations of the agreed documents.",
     "مستندات التصحيح لعلاقات الامتياز القائمة، والترجمات العربية المعتمدة للمستندات المتفق عليها."),
    ("Ministry of Commerce registration file prepared and submitted; compliance framework and training.",
     "ملف القيد لدى وزارة التجارة معدّاً ومقدَّماً؛ وإطار الامتثال والتدريب."),
]

GOV_FEES = [  # fee_en, fee_ar, entity_en, entity_ar, how_en, how_ar
    ("Franchise registration fees", "رسوم قيد الامتياز", "Ministry of Commerce", "وزارة التجارة",
     "Set by the Ministry; confirmed at filing and paid at actual cost with the Client’s prior approval", "تحدّدها الوزارة؛ تُؤكَّد عند التقديم وتُسدَّد بالتكلفة الفعلية بموافقة العميل المسبقة"),
    ("Notarisation, authentication & legalisation", "التوثيق والتصديق والتعميد", "Competent entities", "الجهات المختصة",
     "At actual cost, subject to the Client’s prior approval", "بالتكلفة الفعلية وبموافقة العميل المسبقة"),
]

REQUIREMENTS = [
    ("The four executed franchise agreements with all schedules, annexes and amendments, and confirmation that all four remain in force.",
     "اتفاقيات الامتياز الأربع الموقّعة بكل ملاحقها وتعديلاتها، وتأكيد أنها جميعاً سارية."),
    ("Any existing disclosure document or franchise information memorandum; operations and franchise manuals (or tables of contents).",
     "أي وثيقة إفصاح أو مذكرة معلومات امتياز قائمة؛ وأدلة التشغيل والامتياز (أو فهارسها)."),
    ("The franchisor’s incorporation and constitutional documents, trademark registration certificates and audited financial statements.",
     "مستندات تأسيس مانح الامتياز ونظامه الأساسي، وشهادات تسجيل العلامة التجارية، والقوائم المالية المدققة."),
    ("Corporate documents of the two Saudi franchisees and documents of the three operating locations; any previous filings or correspondence with the Ministry of Commerce.",
     "مستندات الشركتين السعوديتين الممنوح لهما والمستندات المتعلقة بالمواقع التشغيلية الثلاثة؛ وأي مراسلات أو قيود سابقة لدى وزارة التجارة."),
    ("Any powers of attorney, authorisations or declarations, and a written authorisation letter ticking the actions the Client authorises us to take (section 3.3 of our policy).",
     "أي وكالات أو تفويضات أو إقرارات، وخطاب تفويض مكتوب يحدّد فيه العميل ما يفوّضنا بتنفيذه."),
    ("A document evidencing the law firm’s authority to act for the franchisor (a written authorisation from the franchisor), and confirmation of who bears the payments before signing.",
     "مستند يثبت تمثيل المكتب لمانح الامتياز (تفويض كتابي من المانح)، وتحديد من يتحمل السداد قبل التوقيع."),
    ("Written approval of every external cost before it is incurred; timely responses and franchisee cooperation.",
     "موافقة كتابية على كل تكلفة خارجية قبل تحمّلها؛ وسرعة الاستجابة وتعاون الممنوح لهم."),
]

EXCLUSIONS = [
    ("Government and filing fees, notarisation, authentication and legalisation: not included; charged at actual cost with the Client’s prior approval.",
     "الرسوم الحكومية ورسوم القيد والتوثيق والتصديق والتعميد: غير مشمولة وتُحتسب بالتكلفة الفعلية بموافقة العميل المسبقة."),
    ("Anything beyond the Saudi legal counsel’s agreed scope (including more than two rounds of Ministry comments) and extra translation volume beyond the estimate.",
     "ما يتجاوز نطاق المحامي السعودي المتفق عليه (ومنه أكثر من جولتي ملاحظات من الوزارة) وحجم الترجمة الزائد عن التقدير."),
    ("The Ministry of Commerce’s processing time and its decisions: we do not guarantee an outcome that depends on them.",
     "مدة معالجة وزارة التجارة وقراراتها: ولا نضمن نتيجة تعتمد عليها."),
    ("Representing the franchisor before courts, tribunals or in disputes with franchisees.",
     "تمثيل مانح الامتياز أمام المحاكم أو في نزاعاته مع الممنوح لهم."),
    ("Any item not expressly listed in this quotation; additional work is performed only under a written change request priced separately.",
     "أي بند غير مذكور صراحةً في هذا العرض؛ ولا يُنفَّذ عمل إضافي إلا بطلب تغيير كتابي يُسعَّر على حدة."),
]

DURATION = [
    ("Overall", "المدة الكلية",
     "Approximately 6–8 weeks, excluding the Ministry of Commerce’s processing time.",
     "نحو 6–8 أسابيع، دون مدة معالجة وزارة التجارة."),
    ("Legal & translation", "القانوني والترجمة",
     "Legal review and compliance assessment: 10–15 business days. Disclosure and remediation documentation: 15–20 business days. Certified translation starts at engagement and runs in parallel.",
     "المراجعة القانونية وتقييم الامتثال: 10–15 يوم عمل. وثيقة الإفصاح ومستندات التصحيح: 15–20 يوم عمل. والترجمة المعتمدة تبدأ عند التعاقد وتسير بالتوازي."),
    ("Final review & filing", "المراجعة النهائية والتقديم",
     "Final legal review and filing preparation: about 5–10 business days. The timeline starts when the complete documents and the first payments are received.",
     "المراجعة القانونية النهائية وتجهيز التقديم: نحو 5–10 أيام عمل. وتبدأ المدة من استلام المستندات كاملة والدفعات الأولى."),
]

PAYMENT = [  # (no, label_en, label_ar, pct, net, vat, total, due_en, due_ar)
    ("1", "Business Partner — Phase 1 (minimum fee, non-refundable)", "بزنس بارتنر — المرحلة الأولى (الرسم الأدنى غير المسترد)", "33%", P1, vat(P1), P1 + vat(P1),
     "On signing the contract", "عند توقيع العقد"),
    ("2", "Business Partner — Phase 2", "بزنس بارتنر — المرحلة الثانية", "67%", P2, vat(P2), P2 + vat(P2),
     "On the Second Party’s written confirmation of Phase 2", "عند تأكيد الطرف الثاني الكتابي للمرحلة الثانية"),
    ("3", "Saudi legal counsel — first instalment", "المحامي السعودي — الدفعة الأولى", "50%", COUNSEL // 2, vat(COUNSEL // 2), COUNSEL // 2 + vat(COUNSEL // 2),
     "On appointment and start of the legal work", "عند التعيين وبدء العمل القانوني"),
    ("4", "Saudi legal counsel — second instalment", "المحامي السعودي — الدفعة الثانية", "50%", COUNSEL // 2, vat(COUNSEL // 2), COUNSEL // 2 + vat(COUNSEL // 2),
     "On completion of the agreed legal deliverables", "عند إنجاز المخرجات القانونية المتفق عليها"),
    ("5", "Certified Arabic translation (estimate)", "الترجمة العربية المعتمدة (تقدير)", "100%", TRANS, vat(TRANS), TRANS + vat(TRANS),
     "In advance, on engagement", "مقدماً عند التعاقد"),
]
UPFRONT_NET = P1 + COUNSEL // 2 + TRANS
UPFRONT_TOTAL = UPFRONT_NET + vat(P1) + vat(COUNSEL // 2) + vat(TRANS)

TERMS = [
    ("This quotation is valid for 14 days from its date.", "هذا العرض سارٍ لمدة 14 يوماً من تاريخه."),
    ("Prices are in Saudi riyals, before 15% VAT, which is added according to the regulations.",
     "الأسعار بالريال السعودي قبل ضريبة القيمة المضافة 15% وتُضاف وفق النظام."),
    ("The Business Partner fee is a special price for this engagement only, approved by the owner.",
     "أتعاب بزنس بارتنر سعر خاص بهذا الارتباط وحده باعتماد المالك."),
    ("Total before VAT: SAR %s; initial payment on engagement: SAR %s before VAT (SAR %s including VAT); the balance follows the completion milestones above." % (n(ALL_NET), n(UPFRONT_NET), n(UPFRONT_TOTAL)),
     "الإجمالي قبل الضريبة: %s ريال؛ والدفعة الأولية عند التعاقد: %s ريال قبل الضريبة (%s شاملة الضريبة)؛ والباقي وفق مراحل الإنجاز أعلاه." % (n(ALL_NET), n(UPFRONT_NET), n(UPFRONT_TOTAL))),
    ("The Saudi legal counsel’s fee and the certified translation estimate are third-party costs; no external cost beyond the approved amounts is incurred without the Client’s prior written approval.",
     "أتعاب المحامي السعودي وتقدير الترجمة المعتمدة تكاليف خارجية؛ ولا تُتحمَّل تكلفة خارجية تتجاوز المبالغ المعتمدة دون موافقة العميل الكتابية المسبقة."),
    ("Acceptance is by signing the quotation and the contract and paying the initial payments; work starts after both. Phase 2 starts only on the Second Party’s written confirmation.",
     "القبول بتوقيع العرض والعقد وسداد الدفعات الأولية، ويبدأ العمل بعد الأمرين. ولا تبدأ المرحلة الثانية إلا بتأكيد الطرف الثاني الكتابي."),
    ("Our services are administrative, coordination and advisory and are not the practice of law or licensed legal advice; legal work is performed by the Saudi legal counsel.",
     "خدماتنا إدارية وتنسيقية واستشارية ولا تُعدّ ممارسة للمحاماة ولا رأياً قانونياً مرخصاً؛ ويتولى العمل القانوني المحامي السعودي."),
    ("The Client’s documents are used only to perform the service. Hosting and any transfer outside the Kingdom: only as authorised in the authorisation letter.",
     "تُستعمل مستندات العميل لتنفيذ الخدمة فقط. والاستضافة وأي نقل خارج المملكة: بقدر ما يفوّض به خطاب التفويض فقط."),
    ("The legal terms are in the service contract, the non-disclosure agreement and the authorisation letter signed with this quotation.",
     "الأحكام القانونية في عقد الخدمة واتفاقية عدم الإفصاح وخطاب التفويض الموقّعة مع هذا العرض."),
]

# ---------------------------------------------------------------- العقد
C_TITLE_EN = "Franchise Law Compliance Service Agreement"
C_TITLE_AR = "عقد خدمة الامتثال والقيد بنظام الامتياز التجاري"
C_SUB_EN = "KSA Franchise Law compliance & registration — BP-PL-0019."
C_SUB_AR = "الامتثال والقيد بنظام الامتياز التجاري — BP-PL-0019."

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
    rows = []

    def add(t_en, t_ar, b_en, b_ar):
        rows.append([t_en, t_ar, b_en, b_ar])

    add("Subject", "موضوع العقد",
        "The First Party provides the Second Party, acting for its client the franchisor, with project management, coordination and implementation support for bringing the franchisor’s four franchise agreements in the Kingdom into compliance with the Franchise Law and its Implementing Regulations (compliance assessment and gap analysis, the Saudi disclosure document, agreement review and localisation, remediation documentation, certified Arabic translation, Ministry of Commerce registration, operational readiness and training), as detailed in the accepted quotation, which forms an integral part of this contract. The legal work is performed by a Saudi-licensed legal counsel; the First Party’s services are administrative, coordination and advisory.",
        "يقدّم الطرف الأول للطرف الثاني، بصفته ممثلاً لعميله مانح الامتياز، خدمات إدارة المشروع والتنسيق ودعم التنفيذ لإدخال اتفاقيات الامتياز الأربع لمانح الامتياز في المملكة في الامتثال لنظام الامتياز التجاري ولائحته التنفيذية (تقييم الامتثال وتحليل الفجوات، ووثيقة الإفصاح السعودية، ومراجعة الاتفاقية وتوطينها، ومستندات التصحيح، والترجمة العربية المعتمدة، والقيد لدى وزارة التجارة، والجاهزية التشغيلية والتدريب)، وفق ما هو مفصّل في عرض السعر المقبول الذي يُعدّ جزءاً لا يتجزأ من هذا العقد. ويتولى العمل القانوني محامٍ سعودي مرخَّص؛ وخدمات الطرف الأول إدارية وتنسيقية واستشارية.")

    t_en, t_ar, b_en, b_ar = _clause(core, "3.")
    b_en = b_en.replace(
        "The fees are those stated in the accepted quotation, before 15% VAT, which is added. Payment terms: [●].",
        "The First Party’s fee is SAR %s (thirty thousand Saudi riyals) before 15%% VAT, a special price for this engagement approved by the owner, payable as follows: SAR %s on signing this contract (the Phase 1 fee, which is the minimum fee and is non-refundable) and SAR %s on the Second Party’s written confirmation of Phase 2. The Saudi legal counsel’s fee (SAR %s before VAT) and the certified translation estimate (SAR %s before VAT) are third-party costs paid as set out in the accepted quotation; the total before VAT is SAR %s. No external cost beyond the approved amounts is incurred without the Second Party’s prior written approval." % (n(FEE), n(P1), n(P2), n(COUNSEL), n(TRANS), n(ALL_NET)))
    b_ar = b_ar.replace(
        "الرسوم هي المذكورة في عرض السعر المقبول، قبل ضريبة القيمة المضافة 15% التي تُضاف عليها. شروط السداد: [●].",
        "أتعاب الطرف الأول %s ريال (ثلاثون ألف ريال) قبل ضريبة القيمة المضافة 15%%، وهي سعر خاص بهذا الارتباط باعتماد المالك، تُسدَّد كما يلي: %s ريال عند توقيع هذا العقد (أتعاب المرحلة الأولى وهي الرسم الأدنى غير المسترد) و%s ريال عند تأكيد الطرف الثاني الكتابي للمرحلة الثانية. وأتعاب المحامي السعودي (%s ريال قبل الضريبة) وتقدير الترجمة المعتمدة (%s ريال قبل الضريبة) تكاليف خارجية تُسدَّد وفق عرض السعر المقبول؛ والإجمالي قبل الضريبة %s ريال. ولا تُتحمَّل تكلفة خارجية تتجاوز المبالغ المعتمدة دون موافقة الطرف الثاني الكتابية المسبقة." % (n(FEE), n(P1), n(P2), n(COUNSEL), n(TRANS), n(ALL_NET)))
    assert "[●]. Payment" not in b_en
    b_en = b_en.replace("IBAN [●]", "IBAN [IBAN]")
    b_ar = b_ar.replace("آيبان [●]", "آيبان [IBAN]")
    add(t_en, t_ar, b_en, b_ar)

    t_en, t_ar, b_en, b_ar = _clause(core, "4.")
    b_en = b_en.replace("The contract term is: [●].", "The contract term runs from signature until the final deliverables stated in the quotation are delivered, excluding the Ministry of Commerce’s processing time.")
    b_ar = b_ar.replace("مدة العقد: [●].", "مدة العقد من التوقيع حتى تسليم المخرجات النهائية المذكورة في عرض السعر، دون مدة معالجة وزارة التجارة.")
    add(t_en, t_ar, b_en, b_ar)

    for p in ("5.", "6.", "7."):
        add(*_clause(core, p))
    add(*_clause(core, "8."))

    add("Scope Limits, Phases & Client Responsibility", "حدود النطاق والمراحل ومسؤولية العميل",
        "The engagement runs in two phases: Phase 1 (compliance assessment and gap analysis) and Phase 2 (the remaining workstreams), which starts on the Second Party’s written confirmation after the Phase 1 report. The Second Party is responsible for the truth and completeness of the franchise documents and information, for the franchisor’s decisions and for franchisee cooperation. The First Party does not represent the franchisor before courts or in disputes with franchisees, and does not guarantee the Ministry of Commerce’s decision or processing time.",
        "يسير الارتباط على مرحلتين: المرحلة الأولى (تقييم الامتثال وتحليل الفجوات) والمرحلة الثانية (باقي مسارات العمل) وتبدأ بتأكيد كتابي من الطرف الثاني بعد تقرير المرحلة الأولى. ويتحمل الطرف الثاني صحة المستندات والمعلومات الخاصة بالامتياز واكتمالها وقرارات مانح الامتياز وتعاون الممنوح لهم. ولا يمثل الطرف الأول مانح الامتياز أمام المحاكم أو في نزاعاته مع الممنوح لهم، ولا يضمن قرار وزارة التجارة ولا مدة معالجتها.")
    for p in ("9.", "10.", "11.", "12.", "13.", "14.", "15.", "16.", "17.", "18."):
        add(*_clause(core, p))
    # قرارات المالك 2026-11-03 عبر بدر: ملء القيم المحسومة
    fixed = []
    for r in rows:
        t_en, t_ar, b_en, b_ar = r
        b_en = b_en.replace("account at [●], IBAN [IBAN]", "account at the bank stated on the tax invoice, IBAN [IBAN]")
        b_ar = b_ar.replace("لدى [●]، آيبان [IBAN]", "لدى البنك المذكور في الفاتورة الضريبية، آيبان [IBAN]")
        b_en = b_en.replace("written notice of [●] days", "written notice of 30 days")
        b_ar = b_ar.replace("بإشعار كتابي مدته [●] يوماً", "بإشعار كتابي مدته 30 يوماً")
        b_en = b_en.replace("a non-refundable minimum fee of [●] applies on engagement", "a non-refundable minimum fee equal to the Phase 1 fee (SAR %s before VAT) applies on engagement, and the minimum fee paid is not refundable" % n(P1))
        b_ar = b_ar.replace("رسم أدنى غير مسترد قدره [●]", "رسم أدنى غير مسترد يعادل أتعاب المرحلة الأولى (%s ريال قبل الضريبة)، والرسم الأدنى المدفوع لا يُسترد" % n(P1))
        b_en = b_en.replace("within [●] business days", "within 5 business days")
        b_ar = b_ar.replace("خلال [●] أيام عمل", "خلال 5 أيام عمل")
        b_en = b_en.replace("Notices to the addresses stated: [●].", "Notices to the addresses to be completed after agreement.")
        b_ar = b_ar.replace("الإشعارات على العناوين المذكورة: [●].", "الإشعارات على العناوين التي تُستكمل بعد الاتفاق.")
        if t_en.startswith("Cancellation"):
            b_en = ("Either party may terminate this contract by 30 days’ written notice. On termination or cancellation, the work performed up to that date is due and remains payable, measured by the stages stated in the quotation; the Phase 1 fee (SAR %s before VAT) is the minimum fee, is due on signing and is not refundable. Phase 2 is due only on the Second Party’s written confirmation. The Saudi legal counsel’s and the translation provider’s costs already incurred are due; any amount paid in advance and not spent is refunded within [●] days to be determined. Government fees actually paid are not refundable except to the extent the entity refunds them. The First Party may terminate or suspend the service for non-payment or material breach after 10 days’ written warning." % n(P1))
            b_ar = ("لأي من الطرفين إنهاء هذا العقد بإشعار كتابي مدته 30 يوماً. وعند الإنهاء أو الإلغاء يُستحق العمل المنجز حتى ذلك التاريخ، ويُقاس بالمراحل المذكورة في عرض السعر؛ وأتعاب المرحلة الأولى (%s ريال قبل الضريبة) هي الرسم الأدنى، وتُستحق عند التوقيع ولا تُسترد. ولا تُستحق المرحلة الثانية إلا بتأكيد الطرف الثاني الكتابي. وتُستحق تكاليف المحامي السعودي ومزوّد الترجمة المتكبَّدة فعلاً؛ وما دُفع مقدماً ولم يُنفق يُرد خلال [●] يوماً تُحدَّد. ولا تُسترد الرسوم الحكومية المدفوعة فعلاً إلا بقدر ما تردّه الجهة. وللطرف الأول إنهاء العقد أو إيقاف الخدمة عند عدم السداد أو الإخلال الجسيم بعد إنذار كتابي مدته 10 أيام." % n(P1))
        fixed.append([t_en, t_ar, b_en, b_ar])
    rows[:] = fixed
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
REP_EN = "Baher Bakr Ali Magnas"
REP_AR = "باهر بكر علي مقنص"
REP_TITLE_EN = "Chief Executive Officer"
REP_TITLE_AR = "المدير التنفيذي"

# عرض السعر باسم بدر (المعيار §6، قرار المالك 2026-11-03)
QREP_EN, QREP_AR = "Badr", "بدر"
QREP_TITLE_EN, QREP_TITLE_AR = "Sales & Business Development Manager", "مدير المبيعات وتطوير الأعمال"

TBC_EN, TBC_AR = "To be completed after agreement", "يُستكمل بعد الاتفاق"
