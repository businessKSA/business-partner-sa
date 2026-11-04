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

# (رسم BP-REC-01 الثابت 500 أُلغي بقرار المالك 4/11: الاستقدام بتكلفة كل دولة)
#REC = _sku("BP-REC-01")                       # استقدام واستخراج تأشيرات العمل — 500 مرة واحدة، رسوم حكومية منفصلة


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
# ---- التسعير بحسب المهنة والراتب الأدنى (قرار المالك 4/11): فنية 3,000 · ماهرة 2,500 · عادية (عامل مساعد) 1,500
LEVELS = {  # key: (label_en, label_ar, min_salary, localisation_fee)
    "tech":    ("Technical", "فنية", 3000, 900),
    "skilled": ("Skilled", "ماهرة", 2500, 900),
    "helper":  ("Regular (helper)", "عادية (عامل مساعد)", 1500, 900),
}
TEAM_LEVEL = ["tech", "skilled", "skilled", "skilled", "skilled", "skilled", "tech"]   # بحسب ترتيب TEAMS
def worker_price(a, loc, factory=False, months=24):
    """حاسبة التعاقد والتوطين: التكلفة المباشرة (الراتب + الحكومية + الطبي + المخصصات) + الأوفر هيد 500 + رسمنا (10% بحد أدنى 500) + رسم التوطين 900.
    التكاليف الحكومية: رخصة العمل والمقابل 9,700/12 (مصنع: 100/12) + إقامة 650/12 + أجير 23 + 2% على 85% من الراتب + خروج وعودة 200/12 + تأشيرة 2,000/المدة."""
    permit = (100 if factory else 9700) / 12.0
    gov = permit + 650 / 12.0 + 23 + a * 0.85 * 0.02 + 200 / 12.0 + 2000.0 / months
    prov = a / 24.0 + a / 30.0 * 21 / 12.0 + 1500 / 12.0
    direct = a + gov + 50 + prov
    fee = max(0.10 * (direct + 500), 500.0)      # رسمنا 10% فوق (التكلفة + الأوفر هيد) وبحد أدنى 500 ريال (قرار المالك 4/11)
    return int(round(direct + 500 + fee + loc))   # + الأوفر هيد 500 + رسم التوطين 900
PRICE = {k: worker_price(v[2], v[3]) for k, v in LEVELS.items()}
FACTORY_DISCOUNT = 800    # إعفاء المقابل المالي لرخصة العمل في المصنع: 9,600 ÷ 12 (قرار المالك 4/11)
PRICE_F = {k: PRICE[k] - FACTORY_DISCOUNT for k in LEVELS}
STD_MIN = PER_TEAM - SKILLED_MIN               # 7 عمال مساعدين
def team_monthly(prices): return sum(SKILLED_MIN * prices[lv] + STD_MIN * prices["helper"] for lv in TEAM_LEVEL)
TOTAL_MONTHLY = team_monthly(PRICE)
MONTHLY_VAT = TOTAL_MONTHLY * 15 / 100
MONTHLY_GRAND = TOTAL_MONTHLY + MONTHLY_VAT
TOTAL_MONTHLY_F = team_monthly(PRICE_F)
MONTHLY_VAT_F = TOTAL_MONTHLY_F * 15 / 100
MONTHLY_GRAND_F = TOTAL_MONTHLY_F + MONTHLY_VAT_F
# الاستقدام من الدولة بحسب الجنسية (جدول «حاسبة التعاقد والتوطين»؛ العقود والتصديق 1,000 وتذكرة القدوم 2,000 افتراضات الحاسبة) — بالتكلفة، فاتورة منفصلة
REC_COUNTRY = [  # (nat_en, nat_ar, recruitment, attestation, ticket, days_en, days_ar)
    ("Filipino", "فلبينية", 6500, 1000, 2000, "60–90 days", "60–90 يوماً"),
    ("Indian", "هندية", 4500, 1000, 2000, "21 days", "21 يوماً"),
    ("Nepali", "نيبالية", 5000, 1000, 2000, "30 days", "30 يوماً"),
]
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
     "By trade level, per the table in section 1: before 15% VAT, based on a 24-month contract, the same for the three nationalities.",
     "بحسب مستوى المهنة في جدول البند 1: قبل ضريبة القيمة المضافة 15%، على أساس عقد 24 شهراً، وهو نفسه للجنسيات الثلاث."),
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

    fee = _mini_table(["Nationality · الجنسية", "Recruitment · الاستقدام", "Attestation · التصديق", "Arrival ticket · تذكرة القدوم", "Total at cost, SAR · الإجمالي بالتكلفة"],
        [[ne + " · " + na, n(r), n(t), n(k), n(r + t + k)] for ne, na, r, t, k, de, da in REC_COUNTRY], [28, 18, 18, 18, 18])
    items3 = [
        ("The Second Party pays the First Party: (a) the monthly price per worker, being the sum of the salary and allowances by trade, level and nationality, the residence permit, work permit and insurance cost, and the management fee, as set in the rate table of the quotation; and (b) for workers recruited from abroad only, the recruitment costs by nationality in the table below, at actual cost, on a separate invoice. For a worker transferred from inside the Kingdom (sponsorship transfer), no recruitment-from-abroad fee applies: neither the costs below, nor external recruitment, contract attestation or arrival ticket.",
         "يسدّد الطرف الثاني للطرف الأول: (أ) السعر الشهري للعامل، وهو مجموع الراتب والبدلات بحسب المهنة والمستوى والجنسية، وتكلفة الإقامة ورخصة العمل والتأمين، ورسم الإدارة، كما في جدول الأسعار في عرض السعر؛ و(ب) للعمال المستقدَمين من الخارج فقط، تكاليف الاستقدام بحسب الجنسية في الجدول أدناه، بالتكلفة الفعلية وبفاتورة منفصلة. أما العامل المنقول من داخل المملكة (نقل كفالة) فلا تُطبَّق عليه أي رسوم استقدام من الخارج، لا التكاليف أدناه ولا الاستقدام الخارجي ولا تصديق العقود ولا تذكرة القدوم."),
        ("The monthly price is invoiced on the number of workers actually on duty in the month. Overtime is invoiced separately at the actual hours.",
         "يُفوتر السعر الشهري على عدد العمال الفعلي على رأس العمل في الشهر، ويُفوتر العمل الإضافي على حدة بالساعات الفعلية."),
        ("Government fees, embassy and attestation charges and travel tickets are invoiced at actual cost with the supporting receipts, unless the quotation states that they are included.",
         "تُفوتر الرسوم الحكومية ورسوم السفارات والتصديق وتذاكر السفر بالتكلفة الفعلية مع الإيصالات المؤيدة، ما لم يذكر عرض السعر أنها شاملة."),
        ("Prices are before 15% VAT, which is added. Payment terms: advance of two (2) months, then monthly, within seven (7) days of the invoice.",
         "الأسعار قبل ضريبة القيمة المضافة 15% التي تُضاف عليها. شروط السداد: دفعة مقدمة قدرها شهران، ثم شهرياً خلال 7 أيام من الفاتورة."),
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


# ---- جداول مأخوذة من عرض عبدالمحسن المعتمد (EOR): ماذا تدفع ومتى · الرسوم الحكومية · التوطين
STAGES2 = [  # (when_en, when_ar, what_en, what_ar, how_en, how_ar)
    ("On signing", "عند التوقيع",
     "<b>Advance</b> of two months of the monthly price.",
     "<b>الدفعة المقدمة</b> شهران من السعر الشهري.",
     "Before anything starts. Visa, recruitment and the first permits are arranged after the advance.", "قبل البدء. وتُرتَّب التأشيرة والاستقدام والرخص الأولى بعد الدفعة المقدمة."),
    ("Workers recruited from abroad", "العمال المستقدَمون من الخارج",
     "Recruitment from the country by nationality, contract attestation and the arrival ticket, at actual cost (section 8).",
     "الاستقدام من الدولة بحسب الجنسية، وتصديق العقود، وتذكرة القدوم، بالتكلفة الفعلية (البند 8).",
     "A separate invoice, outside the monthly price. Typical duration: Filipino 60–90 days, Indian 21 days, Nepali 30 days. Not applicable to workers transferred from inside the Kingdom.",
     "بفاتورة منفصلة خارج السعر الشهري. المدة المعتادة: الفلبيني 60–90 يوماً، والهندي 21 يوماً، والنيبالي 30 يوماً. ولا تنطبق على العمال المنقولة كفالتهم من داخل المملكة."),
    ("Every month", "كل شهر",
     "The <b>monthly price</b> for the workers on duty: salary, work permit, residency, health and social insurance, and the management fee.",
     "<b>السعر الشهري</b> للعمال على رأس العمل: الراتب والرخصة والإقامة والتأمين الصحي والتأمينات ورسم الإدارة.",
     "Invoiced monthly and payable within 7 days. Overtime is invoiced at the actual hours. VAT 15% on the invoice.", "يُفوتَر شهرياً ويُسدَّد خلال 7 أيام. والعمل الإضافي بالساعات الفعلية. وتُضاف ضريبة 15%."),
    ("After the contract", "بعد انتهاء العقد",
     "End of service, leave pay and the return ticket.",
     "نهاية الخدمة وبدل الإجازة وتذكرة العودة.",
     "Provisioned inside the monthly price. No separate invoice. The exit and re-entry visa is optional.", "مخصَّصة داخل السعر الشهري، فلا فاتورة منفصلة. وتأشيرة الخروج والعودة اختيارية."),
]
GOV_FEES = [  # (fee_en, fee_ar, amount_en, amount_ar, in_offer_en, in_offer_ar)
    ("Work permit and expatriate levy", "رخصة العمل والمقابل المالي", "SAR 9,700 per year (levy 9,600 + permit 100). For a worker at a factory: SAR 100 only, the levy being exempt", "9,700 ريال سنوياً (المقابل 9,600 + الرخصة 100). وللعامل في مصنع: 100 ريال فقط لإعفائه من المقابل المالي", "Included in the monthly price", "مشمول في السعر الشهري"),
    ("Residency (Iqama), Passports", "الإقامة (الجوازات)", "SAR 650 per year", "650 ريالاً سنوياً", "Included in the monthly price", "مشمولة في السعر الشهري"),
    ("Ajeer platform", "منصة أجير", "SAR 276 per year (23 per month)", "276 ريالاً سنوياً (23 شهرياً)", "Included in the monthly price", "مشمولة في السعر الشهري"),
    ("Sponsorship transfer (workers inside the Kingdom)", "نقل الكفالة (عمال من داخل المملكة)", "SAR 2,000 first time, 4,000 second, 6,000 from the third", "2,000 ريال للمرة الأولى، و4,000 للثانية، و6,000 من الثالثة", "Included, spread over the term (SAR 2,000 assumed)", "مشمول موزّعاً على مدة العقد (على أساس 2,000 ريال)"),
    ("Visa, recruitment from abroad", "تأشيرة الاستقدام من الخارج", "SAR 2,000", "2,000 ريال", "Included, spread over the term", "مشمولة موزّعة على مدة العقد"),
    ("Exit and re-entry visa", "تأشيرة الخروج والعودة", "SAR 200 per year", "200 ريال سنوياً", "Included in the monthly price", "مشمولة في السعر الشهري"),
    ("Social insurance, foreign employee", "التأمينات الاجتماعية على الموظف الأجنبي", "2% of basic salary plus housing", "2% من الراتب الأساسي والسكن", "Included in the monthly price", "مشمولة في السعر الشهري"),
]
GOV_NOTE = ("Government fees are paid at cost with no mark-up and carry no VAT. Amounts follow the official schedules in force at the time of payment.",
            "الرسوم الحكومية تُسدَّد بالتكلفة دون هامش وبلا ضريبة قيمة مضافة. والمبالغ بحسب الجداول الرسمية السارية وقت السداد.")
LOCALISATION = [  # (case_en, case_ar, what_en, what_ar)
    ("If you take Saudis through us", "إذا أخذتَ معنا سعوديين",
     "You take Saudis in return for the foreigners. You pay the salaries of both and <b>no localisation fee</b>.",
     "تأخذ سعوديين مقابل الأجانب. فتدفع رواتب الجميع و<b>لا رسوم توطين</b>."),
    ("If you do not take Saudis", "إذا لم تأخذ سعوديين",
     "A profession with no localisation decision: a flat <b>SAR 900</b> per worker per month, <b>already included</b> in the monthly price. A profession with a decision (technical, engineering and others in the guides): the cost of the Saudis the ratio requires, divided across your foreign workers, added to the price of that profession.",
     "مهنة بلا قرار توطين: <b>900 ريال</b> ثابتة لكل عامل شهرياً، <b>مشمولة</b> في السعر الشهري. ومهنة عليها قرار (الفنية والهندسية وغيرها في الأدلة): تكلفة السعوديين الذين تتطلبهم النسبة مقسومة على عمالك الأجانب، وتُضاف إلى سعر تلك المهنة."),
    ("Saudi-only professions", "مهن للسعوديين فقط",
     "Human resources, administrative support, secretarial, reception, customer service and similar are reserved for Saudis by the guides. They are not offered as foreign workers.",
     "الموارد البشرية والمهن الإدارية المساندة والسكرتارية والاستقبال وخدمة العملاء ونحوها مقصورة على السعوديين بحسب الأدلة. ولا تُعرض كعمالة أجنبية."),
]
LOC_NOTE = ("The prices in this quotation include the flat SAR 900 localisation fee. A trade that falls under a localisation decision is priced separately before the order is placed. The First Party does not guarantee any effect on the Second Party’s localisation count or band.",
            "الأسعار في هذا العرض تشمل رسم التوطين الثابت 900 ريال. والمهنة التي عليها قرار توطين تُسعَّر على حدة قبل الطلب. ولا يضمن الطرف الأول أي أثر على نسبة التوطين أو نطاق الطرف الثاني.")

NST = [  # (topic_en, topic_ar, text_en, text_ar)
    ("What it is", "ما هي الخدمة",
     "Registered Saudi employees, employed by Business Partner, whom we manage and operate for your establishment: part-time, flexible, project-based or remote. Real localisation, not paper localisation.",
     "موظفون سعوديون مسجَّلون على Business Partner، نديرهم ونشغّلهم لمنشأتك: دوام جزئي أو مرن أو بمشاريع أو عن بُعد. توطين حقيقي لا سعودة وهمية."),
    ("How the cost is shared", "كيف تُقسَّم التكلفة",
     "You pay a share of the Saudi employee’s salary, because we employ, manage and operate him. The rest of the cost and the management are ours. The share is set per role in a separate quotation; no figure is assumed here.",
     "تدفع جزءاً من راتب الموظف السعودي، على أساس أننا نوظّفه وندير شؤونه ونشغّله. وباقي التكلفة والإدارة علينا. وتُحدَّد حصتك لكل دور في عرض مستقل، ولا يُفترض هنا أي رقم."),
    ("What we manage", "ما ندير",
     "Contract and registration, payroll, social insurance, end of service and leave, attendance and performance follow-up, and the mandatory training and professional development.",
     "العقد والتسجيل، والرواتب، والتأمينات الاجتماعية، ونهاية الخدمة والإجازات، ومتابعة الحضور والأداء، والتدريب والتطوير المهني الإلزامي."),
    ("What stays with you", "ما يبقى عليك",
     "Directing the daily work within the agreed scope, providing the tools and workplace, and giving access to what the role needs.",
     "توجيه العمل اليومي ضمن النطاق المتفق عليه، وتوفير الأدوات ومكان العمل، وإتاحة ما يحتاجه الدور."),
    ("What we do not promise", "ما لا نعد به",
     "No promise that a shared employee counts in your localisation band, and no counting of one employee for more than one establishment. No reduction of the levy on foreign workers. Reserved professions stay with Saudis only.",
     "لا نعد بأن يُحتسب الموظف المشترك في نطاق منشأتك، ولا باحتساب موظف واحد لأكثر من منشأة، ولا بخفض المقابل المالي للعمالة الأجنبية. وتبقى المهن المقصورة على السعوديين لهم."),
]
NST_NOTE = ("The service starts with part-time and flexible work. The share of the salary, the working hours and the roles are agreed in writing before any employee is assigned.",
            "تبدأ الخدمة بالدوام الجزئي والمرن. وتُتفق حصة الراتب وساعات العمل والأدوار كتابةً قبل إسناد أي موظف.")
