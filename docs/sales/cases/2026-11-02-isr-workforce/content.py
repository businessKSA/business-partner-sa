# -*- coding: utf-8 -*-
"""محتوى حزمة ISR Trading — توفير/إسناد عمالة (7 فرق × 15 = 105 عاملاً). مصدر واحد للـHTML.
الأسعار: من الكتالوج بالـSKU فقط (BP-REC-01). الرواتب والرسوم غير الموثّقة `[●]` ولا تُخترع.
لا بيانات شخصية هنا. الجوال/الآيبان يُحقنان في النسخ النهائية من بدر فقط.
"""
import json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
RLM = "‏"

def _sku(code):
    d = json.load(open(os.path.join(ROOT, "site/assets/data/catalog.json"), encoding="utf-8"))
    for s in d["services"]:
        if s.get("code") == code and "amount" in s:
            return s
    raise AssertionError("SKU %s not in catalog" % code)

REC = _sku("BP-REC-01")                       # استقدام واستخراج تأشيرات العمل — 500 مرة واحدة، رسوم حكومية منفصلة
assert REC["amount"] == 500 and REC["govFeesSeparate"] is True
REC_FEE = int(REC["amount"])
def n(x): return "{:,}".format(x)
def n2(x): return "{:,.2f}".format(x) if x != int(x) else "{:,}".format(int(x))

PER_TEAM = 15
SKILLED_MIN = 8                                # «نصفهم على الأقل» من 15 = 8
TEAMS = [  # (en, ar)
    ("Pre-engineered steel (Kirby-type) hangar erection team — steel fitters", "فريق تركيب هناجر معدنية (نوع كيربي) — حدادة هياكل"),
    ("Civil works team — excavation, concrete footings and welders", "فريق الأعمال المدنية — حفر وأساسات خرسانية ولحام"),
    ("Block installation team", "فريق تركيب البلوك"),
    ("Tile-fixing team", "فريق تركيب البلاط"),
    ("Gypsum team", "فريق الجبس"),
    ("Painting team", "فريق الدهان"),
    ("HVAC team — ducting and package-unit installation", "فريق التكييف والتهوية — مجاري الهواء وتركيب وحدة Package"),
]
NTEAMS = len(TEAMS)
WORKERS = NTEAMS * PER_TEAM                    # 105
SKILLED_TOTAL = NTEAMS * SKILLED_MIN           # 56
REC_TEAM = REC_FEE * PER_TEAM                  # 7,500
REC_TOTAL = REC_FEE * WORKERS                  # 52,500
REC_VAT = REC_TOTAL * 15 / 100                 # 7,875
REC_GRAND = REC_TOTAL + REC_VAT                # 60,375
# أسعار شهرية شاملة للعامل من «حاسبة التعاقد والتوطين» برواتب المالك 2,000 (مهني) و1,500 (عادي)، عقد 24 شهراً. تفصيلها في costing.html. بانتظار اعتماد المالك.
PRICE_SKILLED = 5184   # حاسبة التعاقد والتوطين: راتب 2,000 · عقد 24 شهراً · قبل الاستقدام الخارجي (فاتورة منفصلة)
PRICE_STD = 4570       # راتب 1,500 — انظر costing.html
STD_MIN = PER_TEAM - SKILLED_MIN               # 7
TEAM_MONTHLY = SKILLED_MIN * PRICE_SKILLED + STD_MIN * PRICE_STD          # 63,500
TOTAL_MONTHLY = TEAM_MONTHLY * NTEAMS                                      # 444,500
MONTHLY_VAT = TOTAL_MONTHLY * 15 / 100                                     # 66,675
MONTHLY_GRAND = TOTAL_MONTHLY + MONTHLY_VAT                                # 511,175
NATS = [("Filipino", "فلبينية"), ("Indian", "هندية"), ("Nepali", "نيبالية")]

CLIENT_AR = "آي إس آر للتجارة · ISR Trading"
CLIENT_EN = "ISR Trading"
DATE_EN = "2 November 2026"
DATE_AR = "2 نوفمبر 2026"
REF = "Workforce Supply"
REF_AR = "توفير العمالة"

def ar(s):
    return re.sub(r"\.(?=\s|$)", "." + RLM, s)

# ---------------------------------------------------------------- عرض السعر
Q_TITLE_EN = "Quotation: Workforce Supply — 7 Trade Teams"
Q_TITLE_AR = "عرض سعر: توفير العمالة — 7 فرق مهنية"
Q_COVER_EN = "Seven trade teams of fifteen workers each — Filipino, Indian and Nepali nationals only — supplied and managed by Business Partner."
Q_COVER_AR = "سبعة فرق مهنية، كل فريق خمسة عشر عاملاً، من الجنسيات الفلبينية والهندية والنيبالية فقط، توفّرها Business Partner وتديرها."

SCOPE = [
    ("Workforce supply", "توفير العمالة",
     "Supplying %d workers in %d trade teams of %d each, at least %d of every team being skilled professionals, under the terms of the Workforce Supply Agreement." % (WORKERS, NTEAMS, PER_TEAM, SKILLED_MIN),
     "توفير %d عاملاً في %d فرق مهنية، في كل فريق %d عاملاً، %d منهم على الأقل محترفون مهرة، وفق شروط عقد توفير العمالة." % (WORKERS, NTEAMS, PER_TEAM, SKILLED_MIN)),
    ("Nationalities", "الجنسيات",
     "Filipino, Indian and Nepali nationals only. No other nationality is proposed, accepted or substituted.",
     "الجنسيات الفلبينية والهندية والنيبالية فقط. ولا تُقترح جنسية أخرى ولا تُقبل ولا تُستبدل."),
    ("Recruitment and visas", "الاستقدام والتأشيرات",
     "Recruitment through licensed recruitment parties, work-visa issuance, and following up the applications until the workers arrive.",
     "الاستقدام عبر جهات استقدام مرخصة، واستخراج تأشيرات العمل، ومتابعة الطلبات حتى وصول العمال."),
    ("Professional verification", "الفحص المهني",
     "Verifying each worker’s trade before dispatch, so that the skilled share is real and the Client can review the results.",
     "التحقق من مهنة كل عامل قبل إرساله، ليكون عدد المهرة حقيقياً ويطّلع العميل على النتائج."),
    ("Residency and insurance", "الإقامة والتأمين",
     "Residence permits, work permits, health insurance and social insurance for each assigned worker, as the regulations require.",
     "الإقامات ورخص العمل والتأمين الصحي والتأمينات الاجتماعية لكل عامل مسنَد، بحسب الأنظمة."),
    ("Management and replacement", "الإدارة والاستبدال",
     "Monthly payroll and records, one point of contact, and replacement of a worker who fails verification or leaves, as set in the Agreement.",
     "الرواتب والسجلات شهرياً، ونقطة اتصال واحدة، واستبدال العامل الذي لا يجتاز التحقق أو يغادر، وفق ما يحدده العقد."),
]

PRICE_BASIS = [  # (component_en, component_ar, basis_en, basis_ar)
    ("What the monthly price includes", "ما يشمله السعر الشهري",
     "All-inclusive per worker: salary and allowances, residence permit, work permit, health and social insurance, end-of-service and leave provision, return ticket, and the management fee.",
     "شامل للعامل الواحد: الراتب والبدلات، الإقامة ورخصة العمل، التأمين الصحي والتأمينات الاجتماعية، مخصص نهاية الخدمة والإجازة، تذكرة العودة، ورسم الإدارة."),
    ("What it does not include", "ما لا يشمله السعر الشهري",
     "Accommodation, transport and food (see the choice below), overtime, and government fees outside the items above, which are invoiced at actual cost.",
     "السكن والنقل والإعاشة (انظر الخيار أدناه)، والعمل الإضافي، والرسوم الحكومية خارج البنود أعلاه فتُفوتَر بالتكلفة الفعلية."),
    ("Monthly price per worker", "السعر الشهري للعامل",
     "Skilled SAR %s · Standard SAR %s, before 15%% VAT, based on a 24-month contract, the same for the three nationalities." % (n(PRICE_SKILLED), n(PRICE_STD)),
     "ماهر %s ريال · عادي %s ريال، قبل ضريبة القيمة المضافة 15%%، على أساس عقد 24 شهراً، وهو نفسه للجنسيات الثلاث." % (n(PRICE_SKILLED), n(PRICE_STD))),
]

EXCLUSIONS = [
    ("Government fees (visa, iqama, work permit, Qiwa and the like), embassy and attestation charges, and travel tickets are not part of the service fee and are invoiced at actual cost, unless stated otherwise in the rate table.",
     "الرسوم الحكومية (التأشيرة والإقامة ورخصة العمل وقوى وما شابه)، ورسوم السفارات والتصديق، وتذاكر السفر ليست ضمن أتعاب الخدمة وتُفوتر بالتكلفة الفعلية، ما لم يُذكر خلاف ذلك في جدول الأسعار."),
    ("Accommodation, transport and food: the Client chooses below who provides them. ☐ Provided by the Client   ☐ Provided by the First Party and added to the monthly price.",
     "السكن والنقل والإعاشة: يحدّد العميل أدناه من يوفّرها. ☐ يوفّرها العميل   ☐ يوفّرها الطرف الأول وتُضاف إلى السعر الشهري."),
    ("Tools, equipment, materials and personal protective equipment for the work, unless agreed otherwise in writing.",
     "الأدوات والمعدات والمواد ومعدات الحماية الشخصية للعمل، ما لم يُتفق على غير ذلك كتابةً."),
    ("Overtime, invoiced at the actual hours worked under the regulations.", "العمل الإضافي، ويُفوتر بالساعات الفعلية وفق الأنظمة."),
    ("Any nationality other than Filipino, Indian and Nepali, and any trade not listed in the table, are outside this quotation and need a written change request priced separately.",
     "أي جنسية غير الفلبينية والهندية والنيبالية، وأي مهنة غير واردة في الجدول، خارج هذا العرض وتحتاج طلب تغيير كتابياً يُسعَّر على حدة."),
]

STAGES = [  # (stage_en, stage_ar, what_en, what_ar, duration)
    ("Acceptance and advance", "القبول والدفعة المقدمة",
     "Signing the quotation, the agreement and the authorisation, and paying the advance.", "توقيع العرض والعقد والتفويض وسداد الدفعة المقدمة.", "[●]"),
    ("Selection and trade verification", "الاختيار والفحص المهني",
     "Candidate CVs, the Client’s interview and selection, and trade verification.", "سير المرشحين، ومقابلة العميل واختياره، والفحص المهني.", "[●]"),
    ("Visa and documents", "التأشيرة والمستندات",
     "Visa applications, attestation and medical checks through the licensed parties.", "طلبات التأشيرات والتصديق والفحص الطبي عبر الجهات المرخصة.", "[●]"),
    ("Travel and arrival", "السفر والوصول",
     "Booking travel, arrival, and handing the workers over at the site.", "حجز السفر والوصول وتسليم العمال في الموقع.", "[●]"),
    ("Residency and start", "الإقامة والمباشرة",
     "Iqama, work permit, insurance, and starting work.", "الإقامة ورخصة العمل والتأمين، وبدء العمل.", "[●]"),
]

TERMS = [
    ("This quotation is valid for 14 days from its date.", "هذا العرض سارٍ لمدة 14 يوماً من تاريخه."),
    ("Prices are in Saudi riyals, before 15% VAT, which is added according to the regulations.",
     "الأسعار بالريال السعودي قبل ضريبة القيمة المضافة 15% وتُضاف وفق النظام."),
    ("Only Filipino, Indian and Nepali nationals are supplied. If the Client’s requirement cannot be met within these nationalities, we tell the Client in writing and supply no other nationality.",
     "لا يُوفَّر إلا عمال من الجنسيات الفلبينية والهندية والنيبالية. وإن تعذّر تلبية الطلب ضمن هذه الجنسيات أبلغنا العميل كتابةً ولم نوفّر أي جنسية أخرى."),
    ("«Skilled» means a worker who has passed the trade verification described in the Agreement. Not less than %d of every %d workers in each team are skilled." % (SKILLED_MIN, PER_TEAM),
     "«ماهر» هو العامل الذي اجتاز الفحص المهني الوارد في العقد. وفي كل فريق لا يقل عدد المهرة عن %d من كل %d عاملاً." % (SKILLED_MIN, PER_TEAM)),
    ("The stage durations depend on the licensed recruitment parties, the embassies and the competent authorities; we state them in writing before dispatch and do not guarantee a visa approval or an arrival date.",
     "تعتمد مدد المراحل على جهات الاستقدام المرخصة والسفارات والجهات المختصة؛ ونذكرها كتابةً قبل الإرسال ولا نضمن قبول تأشيرة ولا موعد وصول."),
    ("Replacement and guarantee period: as set in the Agreement.", "الاستبدال وفترة الضمان: وفق ما يحدده العقد."),
    ("No fee is charged to any worker in any form, and no worker’s passport is withheld.",
     "لا يُتقاضى أي مقابل من أي عامل بأي صورة، ولا يُحجز جواز أي عامل."),
    ("The legal terms are in the Workforce Supply Agreement, the non-disclosure agreement and the authorisation letter signed with this quotation.",
     "الأحكام القانونية في عقد توفير العمالة واتفاقية عدم الإفصاح وخطاب التفويض الموقّعة مع هذا العرض."),
]

# ---------------------------------------------------------------- العقد
C_TITLE_EN = "Workforce Supply Agreement"
C_TITLE_AR = "عقد توفير العمالة"
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

# ---------------------------------------------------------------- بنود العقد (§3.2: بنود مرقّمة وفروع 3.1 3.2 فوق بعضها)
def _pts(no, items):
    """items: [(en, ar)] → (en_html, ar_html) بنقاط مرقّمة no.1 no.2 فوق بعضها."""
    en = "<br>".join("%s.%d  %s" % (no, i, e) for i, (e, a) in enumerate(items, 1))
    arr = "<br>".join("%s.%d  %s" % (no, i, a) for i, (e, a) in enumerate(items, 1))
    return en, arr

def _mini_table(head, rows, widths):
    st = "width:100%;border-collapse:collapse;margin:4px 0;font-size:inherit"
    td = "border:1px solid #9AA5C8;padding:2px 4px;vertical-align:top"
    th = td + ";background:#EEF1FB;color:#0B1B5A;font-weight:700"
    h = "<tr>%s</tr>" % "".join('<th style="%s;width:%s%%">%s</th>' % (th, w, x) for x, w in zip(head, widths))
    b = "".join("<tr>%s</tr>" % "".join('<td style="%s">%s</td>' % (td, c) for c in r) for r in rows)
    return '<table style="%s">%s%s</table>' % (st, h, b)

def contract_clauses():
    core = _find("نواة العقد")
    rows = []
    def add(t_en, t_ar, b_en, b_ar): rows.append([t_en, t_ar, b_en, b_ar])
    def pts(t_en, t_ar, no, items, extra_en="", extra_ar=""):
        e, a = _pts(no, items); add(t_en, t_ar, e + extra_en, a + extra_ar)

    pts("Subject and definitions", "موضوع العقد والتعريفات", 2, [
        ("The First Party supplies to the Second Party %d workers in %d trade teams of %d workers each, as listed in the accepted quotation, which forms an integral part of this Agreement." % (WORKERS, NTEAMS, PER_TEAM),
         "يوفّر الطرف الأول للطرف الثاني %d عاملاً في %d فرق مهنية، في كل فريق %d عاملاً، وفق ما هو مبيّن في عرض السعر المقبول الذي يُعدّ جزءاً لا يتجزأ من هذا العقد." % (WORKERS, NTEAMS, PER_TEAM)),
        ("Not less than %d workers of every team are skilled. «Skilled» means a worker who has passed the trade verification in clause 5." % SKILLED_MIN,
         "لا يقل عدد المهرة في كل فريق عن %d عمال. و«الماهر» هو من اجتاز الفحص المهني الوارد في البند 5." % SKILLED_MIN),
        ("The nationalities are Filipino, Indian and Nepali only. The First Party supplies no other nationality and substitutes none.",
         "الجنسيات الفلبينية والهندية والنيبالية فقط. ولا يوفّر الطرف الأول جنسية أخرى ولا يستبدلها."),
        ("This is a separate written contract for workforce supply. It is not a recruitment-only service, and it does not make the workers employees of the Second Party.",
         "هذا عقد كتابي مستقل لتوفير العمالة، وليس خدمة استقدام فقط، ولا يجعل العمال موظفين لدى الطرف الثاني."),
        ("The workers remain employed by the First Party, or by a licensed partner where the regulations so require. The First Party remains responsible to the Second Party for performance.",
         "يبقى العمال على عمل الطرف الأول، أو شريك مرخّص حيث تقتضي الأنظمة ذلك. ويبقى الطرف الأول مسؤولاً أمام الطرف الثاني عن التنفيذ.")])

    fee = _mini_table(["Item · البند", "SAR · ريال"], [
        ["BP-REC-01 · Recruitment and work-visa issuance, per worker, one time · الاستقدام واستخراج التأشيرة للعامل، مرة واحدة", n(REC_FEE)],
        ["Recruitment, %d workers · الاستقدام لـ%d عاملاً" % (WORKERS, WORKERS), n(REC_TOTAL)],
        ["VAT 15% · ضريبة القيمة المضافة", n2(REC_VAT)],
        ["Total recruitment fee including VAT · إجمالي رسم الاستقدام شاملاً الضريبة", n2(REC_GRAND)]], [80, 20])
    items3 = [
        ("The Second Party pays the First Party: (a) the monthly price per worker, being the sum of the salary and allowances by trade, level and nationality, the residence permit, work permit and insurance cost, and the management fee, as set in the rate table of the quotation; and (b) the recruitment fee per worker in the table below.",
         "يسدّد الطرف الثاني للطرف الأول: (أ) السعر الشهري للعامل، وهو مجموع الراتب والبدلات بحسب المهنة والمستوى والجنسية، وتكلفة الإقامة ورخصة العمل والتأمين، ورسم الإدارة، كما في جدول الأسعار في عرض السعر؛ و(ب) رسم الاستقدام للعامل في الجدول أدناه."),
        ("The monthly price is invoiced on the number of workers actually on duty in the month. Overtime is invoiced separately at the actual hours.",
         "يُفوتر السعر الشهري على عدد العمال الفعلي على رأس العمل في الشهر، ويُفوتر العمل الإضافي على حدة بالساعات الفعلية."),
        ("Government fees, embassy and attestation charges and travel tickets are invoiced at actual cost with the supporting receipts, unless the quotation states that they are included.",
         "تُفوتر الرسوم الحكومية ورسوم السفارات والتصديق وتذاكر السفر بالتكلفة الفعلية مع الإيصالات المؤيدة، ما لم يذكر عرض السعر أنها شاملة."),
        ("Prices are before 15% VAT, which is added. Payment terms: advance of [●] months, then monthly, within [●] days of the invoice.",
         "الأسعار قبل ضريبة القيمة المضافة 15% التي تُضاف عليها. شروط السداد: دفعة مقدمة قدرها [●] أشهر، ثم شهرياً خلال [●] يوماً من الفاتورة."),
        ("Bank transfer to the First Party’s account: Bank [●], IBAN [IBAN].", "التحويل البنكي إلى حساب الطرف الأول: البنك [●]، الآيبان [IBAN].")]
    e, a = _pts(3, items3)
    add("Fees and payment", "الرسوم والسداد", e + "<br>" + fee, a + "<br>" + fee)

    pts("Term, start and stages", "المدة والمباشرة والمراحل", 4, [
        ("The Agreement starts on signature and runs for [●] months from the arrival of the first worker, renewable by written agreement.",
         "يبدأ العقد من التوقيع ويستمر [●] شهراً من وصول أول عامل، ويُجدَّد باتفاق كتابي."),
        ("The expected start date at the site is [●] at [site].", "تاريخ المباشرة المتوقع في الموقع [●] في [الموقع]."),
        ("Recruitment stages are: acceptance and advance, selection and trade verification, visa and documents, travel and arrival, residency and start. The First Party states each stage’s duration in writing before dispatch.",
         "مراحل الاستقدام: القبول والدفعة المقدمة، والاختيار والفحص المهني، والتأشيرة والمستندات، والسفر والوصول، والإقامة والمباشرة. ويذكر الطرف الأول مدة كل مرحلة كتابةً قبل الإرسال."),
        ("The durations depend on the licensed recruitment parties, the embassies and the competent authorities. The First Party does not guarantee a visa approval or an arrival date.",
         "تعتمد المدد على جهات الاستقدام المرخصة والسفارات والجهات المختصة، ولا يضمن الطرف الأول قبول تأشيرة ولا موعد وصول.")],
        "<br>" + _mini_table(["Team · الفريق", "Workers · العمال", "Skilled · المهرة"], [[ "%s<br>%s" % (e2, a2), str(PER_TEAM), "≥ %d" % SKILLED_MIN] for e2, a2 in TEAMS] + [["Total · الإجمالي", str(WORKERS), "≥ %d" % SKILLED_TOTAL]], [70, 15, 15]),
        "<br>" + _mini_table(["Team · الفريق", "Workers · العمال", "Skilled · المهرة"], [[ "%s<br>%s" % (e2, a2), str(PER_TEAM), "≥ %d" % SKILLED_MIN] for e2, a2 in TEAMS] + [["Total · الإجمالي", str(WORKERS), "≥ %d" % SKILLED_TOTAL]], [70, 15, 15]))

    pts("Trade verification and selection", "الفحص المهني والاختيار", 5, [
        ("Before dispatch the First Party verifies each worker’s trade by [●] and gives the Second Party the result.",
         "يتحقق الطرف الأول من مهنة كل عامل قبل إرساله بواسطة [●] ويسلّم الطرف الثاني النتيجة."),
        ("The Second Party may review the CVs and interview the candidates and may reject a candidate for a stated reason; the rejected candidate is replaced at the First Party’s cost before dispatch.",
         "للطرف الثاني الاطلاع على السير ومقابلة المرشحين ورفض مرشح لسبب مبيّن، ويُستبدل المرفوض على نفقة الطرف الأول قبل الإرسال."),
        ("A worker who fails the verification is not counted as skilled and is replaced or reclassified as standard, with the price adjusted to the standard level.",
         "العامل الذي لا يجتاز الفحص لا يُحتسب ماهراً، ويُستبدل أو يُعاد تصنيفه عادياً مع تعديل السعر إلى المستوى العادي.")])

    pts("Accommodation, transport and working conditions", "السكن والنقل وظروف العمل", 6, [
        ("Accommodation, transport and food are provided by the party the Second Party ticked in the quotation. Where the First Party provides them, they are added to the monthly price.",
         "يوفّر السكن والنقل والإعاشة الطرف الذي حدّده الطرف الثاني بعلامة في عرض السعر. وإن وفّرها الطرف الأول أُضيفت إلى السعر الشهري."),
        ("The Second Party provides a safe site, the tools, equipment, materials and personal protective equipment for the work, unless agreed otherwise in writing.",
         "يوفّر الطرف الثاني موقعاً آمناً والأدوات والمعدات والمواد ومعدات الحماية الشخصية للعمل، ما لم يُتفق على غير ذلك كتابةً."),
        ("The Second Party directs the daily tasks within the agreed trades only. Hiring, dismissal, discipline, wages and leave remain the First Party’s.",
         "يوجّه الطرف الثاني المهام اليومية ضمن المهن المتفق عليها فقط. وتبقى قرارات التوظيف والفصل والتأديب والأجور والإجازات للطرف الأول.")])

    pts("Replacement and guarantee", "الاستبدال والضمان", 7, [
        ("The First Party replaces a worker who fails verification, is unfit for the trade, or leaves during the guarantee period of [●] months, within [●] days of written notice.",
         "يستبدل الطرف الأول العامل الذي لا يجتاز الفحص أو لا يصلح للمهنة أو يغادر خلال فترة الضمان البالغة [●] أشهر، خلال [●] يوماً من الإشعار الكتابي."),
        ("The guarantee does not cover a worker’s departure caused by the Second Party’s breach, unsafe conditions, or non-payment of dues.",
         "لا يشمل الضمان مغادرة العامل بسبب إخلال الطرف الثاني أو ظروف عمل غير آمنة أو عدم سداد المستحقات."),
        ("The Second Party gives written notice of a request for replacement, with the reason.",
         "يرسل الطرف الثاني إشعاراً كتابياً بطلب الاستبدال مع بيان السبب.")])

    pts("Obligations of the First Party", "التزامات الطرف الأول", 8, [
        ("Supply the workers in the agreed numbers, trades, levels and nationalities.", "توفير العمال بالأعداد والمهن والمستويات والجنسيات المتفق عليها."),
        ("Pay the workers’ wages on time through the wage-protection system and keep their records.", "دفع أجور العمال في موعدها عبر نظام حماية الأجور وحفظ سجلاتهم."),
        ("Maintain the workers’ residence permits, work permits, health and social insurance.", "إبقاء إقامات العمال ورخص عملهم وتأمينهم الصحي والاجتماعي سارية."),
        ("Charge no fee to any worker in any form, and never withhold a worker’s passport.", "عدم تقاضي أي مقابل من أي عامل بأي صورة، وعدم حجز جواز أي عامل."),
        ("Appoint a supervisor or point of contact and report monthly on the workers’ attendance.", "تعيين مشرف أو نقطة اتصال، وتقديم تقرير شهري بحضور العمال.")])

    pts("Obligations of the Second Party (the Client)", "التزامات الطرف الثاني (العميل)", 9, [
        ("Give the First Party, in good time, the site, the start date, and the information needed to recruit and place the workers.",
         "تزويد الطرف الأول في الوقت المناسب بالموقع وتاريخ المباشرة والمعلومات اللازمة لاستقدام العمال وتوزيعهم."),
        ("Pay the invoices on their due dates and the actual-cost items against receipts.", "سداد الفواتير في مواعيدها والبنود بالتكلفة الفعلية مقابل الإيصالات."),
        ("Provide a safe site and comply with the occupational-safety regulations at the site.", "توفير موقع آمن والالتزام بأنظمة السلامة المهنية في الموقع."),
        ("Assign the workers only to the agreed trades, and not to another employer or site without written agreement.", "تكليف العمال بالمهن المتفق عليها وحدها، وعدم إسنادهم إلى صاحب عمل أو موقع آخر دون اتفاق كتابي."),
        ("Not employ the workers directly or move them to another party during the Agreement without the First Party’s written consent.", "عدم توظيف العمال مباشرة ولا نقلهم إلى جهة أخرى خلال العقد دون موافقة كتابية من الطرف الأول."),
        ("Confirm the accommodation, transport and food option in the quotation before the visa applications start.", "تأكيد خيار السكن والنقل والإعاشة في عرض السعر قبل بدء طلبات التأشيرات.")])

    pts("Data protection", "حماية بيانات التواصل والعمال", 10, [
        ("Purpose: the personal data of the workers and of the Second Party’s contacts is used only to perform this Agreement and the related government procedures.",
         "الغرض: تُستعمل البيانات الشخصية للعمال ولجهات اتصال الطرف الثاني لتنفيذ هذا العقد والإجراءات الحكومية المرتبطة به فقط."),
        ("Storage: the data is kept securely for the Agreement term and the period the regulations require.",
         "التخزين: تُحفظ البيانات بأمان طوال مدة العقد والمدة التي تقتضيها الأنظمة."),
        ("Sharing: the data is shared only with the competent authorities, the licensed recruitment parties and the service providers needed for performance, under the same obligations. Any transfer outside the Kingdom follows the choice made in the authorisation letter.",
         "المشاركة: لا تُشارك البيانات إلا مع الجهات المختصة وجهات الاستقدام المرخصة ومزودي الخدمات اللازمين للتنفيذ، بالالتزامات نفسها. وأي نقل خارج المملكة يتبع الخيار المحدد في خطاب التفويض."),
        ("Rights: each person may request access to, correction of or deletion of their data, as the regulations allow.",
         "الحقوق: لكل شخص طلب الاطلاع على بياناته أو تصحيحها أو إتلافها بحسب ما تجيزه الأنظمة."),
        ("Destruction: the data is destroyed or returned at the end of the Agreement, except what the regulations require to be kept.",
         "الإتلاف: تُتلف البيانات أو تُعاد عند انتهاء العقد، عدا ما توجب الأنظمة حفظه.")])

    pts("Compliance", "الالتزام النظامي", 11, [
        ("The Agreement is performed under the labour, recruitment and social-insurance regulations, through licensed recruitment parties, and within the First Party’s licence and registered activities.",
         "يُنفَّذ العقد وفق أنظمة العمل والاستقدام والتأمينات الاجتماعية، عبر جهات استقدام مرخصة، وضمن ترخيص الطرف الأول وأنشطة سجله."),
        ("No visa is requested without real work, and no service transfer or change of profession is made by circumvention.",
         "لا تُطلب تأشيرة دون عمل حقيقي، ولا يُنقل عامل ولا تُغيّر مهنة بالتحايل."),
        ("The First Party does not guarantee any effect on the Second Party’s localisation count or band.",
         "لا يضمن الطرف الأول أي أثر على نسبة التوطين أو نطاق الطرف الثاني.")])

    pts("Cancellation and refund", "الإلغاء والاسترداد", 12, [
        ("Cancellation before the visa applications are submitted: refund of the advance after deducting the actual costs incurred, and [●].",
         "الإلغاء قبل تقديم طلبات التأشيرات: يُرد المقدَّم بعد خصم التكاليف الفعلية المتكبدة، و[●]."),
        ("Cancellation after submission: amounts spent or committed to third parties are not refundable, except where the First Party is at fault.",
         "الإلغاء بعد التقديم: لا تُسترد المبالغ المنفقة أو الملتزَم بها للغير، إلا لخطأ من الطرف الأول."),
        ("Where a visa is rejected or a worker does not travel, the First Party replaces the worker or refunds the recruitment fee for that worker.",
         "عند رفض تأشيرة أو عدم سفر العامل يستبدله الطرف الأول أو يرد رسم الاستقدام عن ذلك العامل.")])

    # بنود النواة المعتمدة من القانونية: السرية · الاستعانة بالغير · الرشوة · المسؤولية · القانون · أحكام عامة
    for p in ("12.", "14.", "15.", "16.", "17.", "18."):
        add(*_clause(core, p))
    return rows
