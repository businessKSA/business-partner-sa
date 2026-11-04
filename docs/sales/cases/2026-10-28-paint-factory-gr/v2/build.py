#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""بناء حزمة عرض مصنع الخطوط الذهبية للدهانات (v2) — التسعير الجديد 2026-11-03.

مصادر HTML المفتوحة (داخلية) تُكتب في هذا المجلد؛ وPDF يُنتَج بـ Chromium (Playwright) بخطوط الهوية.
يعيد استعمال مكوّنات مكتبة المبيعات (docs/sales/library/generate.py) ونصوصها القانونية دون تعديلها.

  python3 build.py            # HTML + PDF + فحص الاتساع
  python3 build.py --html     # HTML فقط
  BP_ADDRESS="<العنوان الوطني>" python3 build.py   # حقن العنوان الوطني في النسخة النهائية فقط

لا آيبان ولا جوال ولا عنوان في المستودع: [IBAN] و[●].
"""
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
LIB = HERE.parents[2] / "library"
sys.path.insert(0, str(LIB))
import generate as G  # noqa: E402

RLM = G.RLM
ASSETS_REL = "../../../library/assets"          # من v2/ إلى docs/sales/library/assets
FONT_DIR = Path(os.environ.get("BP_FONT_DIR", "/tmp/bp-fonts"))
PDF_DIR = Path(os.environ["BP_PDF_DIR"]) if os.environ.get("BP_PDF_DIR") else HERE / "pdf"

# ------------------------------------------------------------------ الأرقام (مصدر واحد للحقيقة)
VAT_RATE = 0.15
ANNUAL = 24000          # الباقة 2 «الانطلاق» BP-PKG-LAUNCH، سنوياً قبل الضريبة
QUARTER = ANNUAL // 4   # 6,000
SETUP = 12000           # «تصحيح المنصات والتأسيس» مرة واحدة
EXTRA_EMP = 300         # سنوياً للموظف فوق 49
EXTRA_EMP_Q = EXTRA_EMP // 4   # 75 على الفاتورة الربع سنوية
EXTRA_BRANCH = 3000     # سنوياً للفرع الإضافي
OVERAGE = 40            # للعملية الزائدة (الخيار ب المعتمد)
LIM = {"ops_m": 30, "ops_y": 360, "req_m": 60, "req_d": 6, "alert": 0.8}
FIRST_YEAR = ANNUAL + SETUP
DUE_SIGN = QUARTER + SETUP


def vat(x):
    return round(x * VAT_RATE, 2)


def inc(x):
    return round(x + vat(x), 2)


assert (QUARTER, FIRST_YEAR, DUE_SIGN) == (6000, 36000, 18000)
assert inc(DUE_SIGN) == 20700 and inc(FIRST_YEAR) == 41400 and inc(QUARTER) == 6900
assert inc(DUE_SIGN) + 3 * inc(QUARTER) == inc(FIRST_YEAR)
assert LIM["ops_m"] * 12 == LIM["ops_y"]

CLIENT_AR = "مصنع الخطوط الذهبية للدهانات"
CLIENT_EN = f'<bdi dir="rtl">{CLIENT_AR}</bdi>'     # الاسم الإنجليزي لم يحدده المالك: يُكتب كما أعطاه
M = G.money


def n(x):
    return f'<span class="num">{M(x)}</span>'


def t(x):
    """نص رقمي حر داخل span الأرقام."""
    return f'<span class="num">{x}</span>'


def A(s):
    s = s.strip()
    return s + RLM if s.endswith(".") else s


PKG_EN, PKG_AR = "Launch Package", "باقة الانطلاق"
FAM_EN, FAM_AR = "Corporate Compliance &amp; Localization Packages", "باقات الامتثال والتوطين للشركات"
SETUP_EN, SETUP_AR = "Platform Setup &amp; Remediation", "تصحيح المنصات والتأسيس"
SKU = "BP-PKG-LAUNCH"
BADR = G.BADR_NAME
BADR_T = G.BADR_TITLE

# ------------------------------------------------------------------ CSS إضافي
EXTRA = """
.pt tr.tot td{background:#EEF1FB;font-weight:700;color:#0B1B5A}.pt tr.sb td{color:#4A5578}
.pt td{font-size:10.4px}.pt th{font-size:9.8px}
.bx0{display:inline-block;width:13px;height:13px;border:1.5px solid #0B1B5A;background:#fff;vertical-align:-2px}
table.tk td{padding:5px 8px}table.tk td.bxc{width:34px;text-align:center;background:#fff}
table.tk td.en{direction:ltr;text-align:left}table.tk td.ar{direction:rtl;text-align:right}
.sm{font-size:9.6px;color:#4A5578}
.kv3 th.l{text-align:left}.kv3 th.r{text-align:right}
table.kv3{direction:ltr}
table.kv3 td.k{width:27%;color:#4A5578}table.kv3 td.k.a{direction:rtl;text-align:right}table.kv3 td.k.e{text-align:left}
table.kv3 td.v{text-align:center;width:46%}
.cardx{background:#F2F4FB;border:1px solid #DDE1EE;padding:6px 11px;margin:6px 0;font-size:10.4px}
.cardx b{color:#0B1B5A}
.att{border:1px dashed #0B1B5A;background:#fff;margin:8px 0;padding:6px 10px}
.rw.mt>.col{display:flex;gap:6px}.rw.mt .meta1{margin:2px 0}
.bp .cl td{padding:2px 9px}
@page{margin:0}
"""

FONT_FILES = {
    "ibm-plex-sans-arabic-arabic-400-normal.woff2": "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2",
    "ibm-plex-sans-arabic-arabic-700-normal.woff2": "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2",
    "ibm-plex-sans-arabic-latin-400-normal.woff2": "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-400-normal.woff2",
    "ibm-plex-sans-arabic-latin-700-normal.woff2": "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-700-normal.woff2",
    "ibm-plex-mono-latin-400-normal.woff2": "ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
    "ibm-plex-mono-latin-700-normal.woff2": "ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2",
    "playfair-display-latin-700-normal.woff2": "playfair-display/files/playfair-display-latin-700-normal.woff2",
}


def fetch_fonts():
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    for name, path in FONT_FILES.items():
        f = FONT_DIR / name
        if not f.exists() or f.stat().st_size < 1000:
            urllib.request.urlretrieve("https://cdn.jsdelivr.net/npm/@fontsource/" + path, f)


def font_css():
    ar = "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC"
    lat = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"

    def ff(fam, w, fn, rng):
        return (f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;"
                f"src:url('file://{FONT_DIR}/{fn}') format('woff2');unicode-range:{rng}}}")
    out = []
    for w in (400, 700):
        out.append(ff("IBM Plex Sans Arabic", w, f"ibm-plex-sans-arabic-arabic-{w}-normal.woff2", ar))
        out.append(ff("IBM Plex Sans Arabic", w, f"ibm-plex-sans-arabic-latin-{w}-normal.woff2", lat))
        out.append(ff("IBM Plex Mono", w, f"ibm-plex-mono-latin-{w}-normal.woff2", lat))
    out.append(ff("Playfair Display", 700, "playfair-display-latin-700-normal.woff2", lat))
    return "".join(out)


# ------------------------------------------------------------------ مكوّنات مشتركة
def doc(title, kind, sections):
    h = G.document(title, kind, sections)
    h = h.replace("{{ASSETS}}", ASSETS_REL)
    return h.replace("</style>", EXTRA + "</style>", 1)


def sec(num_, en, ar):
    return (f'<div class="rw"><div class="col" dir="ltr"><h2><span class="n">{num_}</span>{en}</h2></div>'
            f'<div class="col" dir="rtl"><h2><span class="n">{num_}</span>{ar}</h2></div></div>')


def bl(i, en, ar, alt=False):
    """بند مرقّم بصف: الإنجليزي يسار والعربي يمين (نصوص HTML خام)."""
    return (f'<table class="cl{" alt" if alt else ""}"><tr><td class="en"><span class="nb">{i}</span>{en}</td>'
            f'<td class="ar"><span class="nb">{i}</span>{A(ar)}</td></tr></table>')


def bullets(items):
    return "".join(bl(i, en, ar, alt=i % 2 == 0) for i, (en, ar) in enumerate(items, 1))


def mirrored(rows, head_en, head_ar):
    """جدول مقابل: [EN label | EN value] — [AR value | AR label]، من (label_en, value_en, label_ar, value_ar)."""
    h = ('<table class="pt"><colgroup><col style="width:30%"><col style="width:19%"><col style="width:2%">'
         '<col style="width:19%"><col style="width:30%"></colgroup>'
         f'<tr><th class="en">{head_en[0]}</th><th class="c en">{head_en[1]}</th><td class="gp"></td>'
         f'<th class="c ar">{head_ar[1]}</th><th class="ar">{head_ar[0]}</th></tr>')
    for le, ve, la, va in rows:
        h += (f'<tr><td class="en">{le}</td><td class="c en">{ve}</td><td class="gp"></td>'
              f'<td class="c ar">{va}</td><td class="ar">{A(la)}</td></tr>')
    return h + "</table>"


def kv3(rows, head_en, head_ar):
    """جدول بيانات: تسمية إنجليزية | قيمة | تسمية عربية."""
    h = (f'<table class="kv3 pty2"><tr><th colspan="3"><span>{head_en}</span><span dir="rtl">{head_ar}</span></th></tr>')
    for le, v, la in rows:
        h += f'<tr><td class="k e">{le}</td><td class="v">{v}</td><td class="k a">{A(la)}</td></tr>'
    return h + "</table>"


# ------------------------------------------------------------------ عرض السعر (A4 أفقي)
def land_page(inner, n_, total):
    head = G.hd_land("عرض سعر · باقة الانطلاق", "Quotation · Launch Package")
    return G.sheet("land", '<div class="bp">' + inner + "</div>", n_, total, head)


def cover_land():
    strip = [("To / إلى السادة", CLIENT_EN), ("Date / التاريخ", G.num("[●]")),
             ("Validity / صلاحية العرض", "14 days<br>14 يوماً"),
             ("Issued by / صادر عن", f"{G.BADR_EN} · <bdi dir=\"rtl\">{G.BADR_AR}</bdi>")]
    ch = "".join(f"<div><span>{a}</span>{b}</div>" for a, b in strip)
    return ('<div class="cv lt"><div class="lgband"><span class="logo big" role="img" aria-label="Business Partner"></span></div>'
            '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">Launch Package</h1>'
            f'<div class="sb">{FAM_EN} · <span class="num" style="color:#EEF1FB">{SKU}</span></div></div>'
            '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div>'
            f'<h1>باقة الانطلاق</h1><div class="sb">{FAM_AR} · <span class="num" style="color:#EEF1FB">{SKU}</span></div></div></div>'
            f'<div class="ch">{ch}</div></div>')


def closing_land():
    return ('<div class="cv"><div class="lgc">' + G.logo() + '</div><div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
            '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
            '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: <span class="num">' + G.ADDRESS + '</span><br>'
            'Mobile / الجوال: <span class="num">[●]</span><br>Email / الإيميل: <span class="num">business@businesspartner.sa</span><br>'
            'Website / الموقع: <span class="num">www.businesspartner.sa</span></div>'
            '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: ' + G.CO_EN + ' / بزنس بارتنر سلوشنز<br>'
            'Bank / البنك: [●]<br>IBAN: <span class="num">[IBAN]</span></div></div></div>')


def price_table():
    cols = ('<table class="pt"><colgroup><col style="width:23%"><col style="width:10%"><col style="width:7%"><col style="width:6%">'
            '<col style="width:7%"><col style="width:2%"><col style="width:7%"><col style="width:6%"><col style="width:7%">'
            '<col style="width:10%"><col style="width:23%"></colgroup>'
            '<tr><th class="en">Item</th><th class="c en">Basis</th><th class="c en">Excl. VAT (SAR)</th><th class="c en">VAT 15%</th>'
            '<th class="c en">Total (SAR)</th><td class="gp"></td><th class="c ar">الإجمالي (ريال)</th><th class="c ar">ضريبة 15%</th>'
            '<th class="c ar">قبل الضريبة (ريال)</th><th class="c ar">الأساس</th><th class="ar">البند</th></tr>')
    rows = [
        ("", f'{PKG_EN} — <span class="num">{SKU}</span><br>5–49 employees · one branch (Riyadh)', "Annual, paid quarterly in advance",
         ANNUAL, f'{PKG_AR} — <span class="num">{SKU}</span><br>من 5 إلى 49 موظفاً · فرع واحد (الرياض)', "سنوي، يُدفع ربع سنوياً مقدماً"),
        ("sb", "&nbsp;&nbsp;— each quarterly instalment (4 per year)", "Quarterly", QUARTER, "— كل دفعة ربع سنوية (4 في السنة)", "ربع سنوي"),
        ("", f"{SETUP_EN}", "One-time, on signature", SETUP, f"{SETUP_AR}", "مرة واحدة عند التوقيع"),
        ("tot", "First-year total", "Year 1", FIRST_YEAR, "إجمالي السنة الأولى", "السنة الأولى"),
        ("tot", "Due on signature (first quarter + setup)", "On signature", DUE_SIGN, "المستحق عند التوقيع (الربع الأول + التصحيح والتأسيس)", "عند التوقيع"),
        ("", "Each of the next 3 quarterly invoices", "Quarterly", QUARTER, "كل فاتورة من الفواتير الربع سنوية الثلاث التالية", "ربع سنوي"),
    ]
    h = cols
    for cls, ien, ben, net, iar, bar in rows:
        c = f' class="{cls}"' if cls else ""
        h += (f'<tr{c}><td class="en">{ien}</td><td class="c en">{ben}</td><td class="c en">{n(net)}</td><td class="c en">{n(vat(net))}</td>'
              f'<td class="c en">{n(inc(net))}</td><td class="gp"></td><td class="c ar">{n(inc(net))}</td><td class="c ar">{n(vat(net))}</td>'
              f'<td class="c ar">{n(net)}</td><td class="c ar">{bar}</td><td class="ar">{iar}</td></tr>')
    return h + "</table>"


def build_quote():
    pages = []

    # ص2: السعر + الإضافات
    meta = ('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> ' + CLIENT_EN + '</div>'
            '<div class="meta1"><b>Date:</b> <span class="num">[●]</span></div><div class="meta1"><b>Validity:</b> 14 days</div></div>'
            '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> ' + CLIENT_AR + '</div>'
            '<div class="meta1"><b>التاريخ:</b> <span class="num">[●]</span></div><div class="meta1"><b>الصلاحية:</b> 14 يوماً</div></div></div>')
    p2 = meta + sec(1, "Price", "السعر") + price_table()
    p2 += ('<table class="cl"><tr><td class="en">All amounts are in Saudi riyals. The annual fee is paid in four quarterly instalments in advance: '
           'the first on signature and the others at the start of each following quarter. Government fees are separate (section 7).</td>'
           '<td class="ar">' + A("جميع المبالغ بالريال السعودي. يُدفع الرسم السنوي على أربع دفعات ربع سنوية مقدماً: الأولى عند التوقيع والباقي في بداية كل ربع تالٍ. والرسوم الحكومية منفصلة (البند 7).") + '</td></tr></table>')
    p2 += sec(2, "Rates for additions (before VAT)", "أسعار الإضافات (قبل الضريبة)")
    p2 += mirrored([
        ("Additional employee above 49", f"{n(EXTRA_EMP)} per year<br><span class=\"sm\">({n(EXTRA_EMP_Q)} on each quarterly invoice)</span>",
         "موظف إضافي فوق 49", f"{n(EXTRA_EMP)} ريال في السنة<br><span class=\"sm\">({n(EXTRA_EMP_Q)} على كل فاتورة ربع سنوية)</span>"),
        ("Additional branch (the first branch, Riyadh, is included)", f"{n(EXTRA_BRANCH)} per year<br><span class=\"sm\">from receipt of its documents and authorisation</span>",
         "فرع إضافي (الفرع الأول، الرياض، مشمول)", f"{n(EXTRA_BRANCH)} ريال في السنة<br><span class=\"sm\">من استلام وثائقه وتفويضه</span>"),
        ("Additional operation above the monthly limit", f"{n(OVERAGE)} per operation<br><span class=\"sm\">invoiced monthly</span>",
         "عملية إضافية فوق الحد الشهري", f"{n(OVERAGE)} ريال للعملية<br><span class=\"sm\">تُفوتَر شهرياً</span>"),
    ], ("Addition", "Rate (SAR)"), ("الإضافة", "السعر (ريال)"))
    pages.append(p2)

    # ص3: الشمول + التصحيح والتأسيس
    scope = [
        ("The commercial registration and its renewal.", "السجل التجاري وتجديده."),
        ("Qiwa: work permits and employment contracts.", "قوى: رخص العمل وعقود العمل."),
        ("Social insurance (GOSI): subscription, invoices and certificate.", "التأمينات الاجتماعية: الاشتراك والفواتير والشهادة."),
        ("Organising the employees’ medical insurance and an alert before any violation, through the Smart Advisor.", "تنظيم التأمين الطبي للموظفين والتنبيه قبل أي مخالفة عبر «المستشار الذكي»."),
        ("Basic zakat and tax follow-up: due dates and notices (filing and calculation are outside the price, section 7).", "متابعة الزكاة والضريبة الأساسية: المواعيد والإشعارات (ويخرج عن السعر الإعداد والإقرار، البند 7)."),
        ("Mudad: the monthly wage-protection file and handling of notes.", "مدد: ملف حماية الأجور شهرياً ومعالجة الملاحظات."),
        ("Nitaqat and localisation: a monthly calculation and an alert before any drop.", "نطاقات والتوطين: حساب شهري وتنبيه قبل أي هبوط."),
        ("Muqeem and Absher Business: residencies.", "مقيم وأبشر أعمال: الإقامات."),
        ("A unified renewals calendar, a monthly report and a single point of contact.", "تقويم موحّد للتجديدات وتقرير شهري ونقطة اتصال واحدة."),
        ("Tamm: monitoring of violations and deadlines; for each violation: review, a study of the eligibility of the available route, preparation, submission (with the Client’s separate written approval) and follow-up. No promise of cancellation or reduction.",
         "تمام: رصد المخالفات والمهل؛ ولكل مخالفة: مراجعة ودراسة أهلية المسار المتاح وتجهيز وتقديم (بموافقة العميل الخطية المنفصلة) ومتابعة، دون وعد بالإلغاء أو التخفيض."),
    ]
    p3 = sec(3, "What the package includes", "ما تشمله الباقة") + bullets(scope)
    p3 += sec(4, f"{SETUP_EN} (one-time)", f"{SETUP_AR} (مرة واحدة)")
    p3 += ('<table class="cl"><tr><td class="en">Applies because the establishment has violations and challenges on the platforms. It covers the assessment, '
           'setting up the file on the platforms, cleaning and organising it, a corrective plan for the platforms and for compliance management, '
           'and follow-up until stability. Actions included in this fee are not counted as operations.</td>'
           '<td class="ar">' + A("تسري لوجود مخالفات وتحديات على المنصات. وتشمل التقييم، وتأسيس الملف على المنصات، وتنظيفه وترتيبه، وخطة تصحيحية للمنصات وإدارة الامتثال، والمتابعة حتى الاستقرار. والإجراءات المشمولة في هذا الرسم لا تُحتسب عمليات.") + '</td></tr></table>')
    pages.append(p3)

    # ص4: الحدود
    p4 = sec(5, "Operation limits and additional operations", "حدود العمليات والعمليات الإضافية")
    p4 += mirrored([
        ("Operations per month", n(LIM["ops_m"]), "عمليات شهرياً", n(LIM["ops_m"])),
        ("Operations per year", n(LIM["ops_y"]), "عمليات سنوياً", n(LIM["ops_y"])),
        ("Requests per month", n(LIM["req_m"]), "طلبات شهرياً", n(LIM["req_m"])),
        ("Requests per day (maximum)", n(LIM["req_d"]), "طلبات يومياً (حد أقصى)", n(LIM["req_d"])),
        ("Alert to the Client", f"at 80% of the monthly limit ({n(int(LIM['ops_m'] * LIM['alert']))} operations)",
         "تنبيه العميل", f"عند 80٪ من الحد الشهري ({n(int(LIM['ops_m'] * LIM['alert']))} عملية)"),
        ("Price of an additional operation", f"{n(OVERAGE)} SAR, before VAT", "سعر العملية الإضافية", f"{n(OVERAGE)} ريال قبل الضريبة"),
    ], ("Limit", "Package"), ("الحد", "الباقة"))
    defs = [
        ("An operation is a transaction or action on a government platform: issue, renewal, amendment, attestation, file upload, or handling of a note or violation. It is counted once for each action, entity and worker or entity concerned (renewing 3 residencies is 3 operations).",
         "العملية هي معاملة أو إجراء على منصة حكومية: إصدار أو تجديد أو تعديل أو توثيق أو رفع ملف أو معالجة ملاحظة أو مخالفة. وتُحتسب مرة لكل إجراء وجهة وعامل أو كيان معني (تجديد 3 إقامات = 3 عمليات)."),
        ("A request is what the Client submits to us through the approved channel. Enquiring about the status of an existing request is not an operation.",
         "الطلب هو ما يرفعه العميل لنا عبر القناة المعتمدة. والاستفسار عن حالة طلب قائم لا يُحسب عملية."),
        ("Not counted: automatic alerts, the monthly report, and updates to the Client’s own data held by us.",
         "لا يُحتسب: التنبيهات الآلية والتقرير الشهري وتحديث بيانات العميل لدينا."),
        ("Each operation is logged with a reference number and the Client is told the remaining limits. Above the limit, the price of an additional operation is shown before execution and we proceed only after the Client confirms.",
         "تُسجَّل كل عملية برقم مرجعي ويُبلَّغ العميل بالحدود المتبقية. وفوق الحد يُعرض سعر العملية الإضافية قبل تنفيذها ولا نمضي إلا بعد تأكيد العميل."),
        ("Requests above the daily maximum are scheduled for the next day unless an entity’s deadline requires otherwise.",
         "الطلبات الزائدة على الحد اليومي تُجدول لليوم التالي ما لم تقتضِ مهلة جهة غير ذلك."),
    ]
    p4 += bullets(defs)
    pages.append(p4)

    # ص5: المتطلبات + ما لا يشمله
    need = [
        ("An authorisation letter attested by the Chamber of Commerce, with a tick box for each action (attached).", "خطاب تفويض مصدَّق من الغرفة التجارية بخانة اختيار لكل إجراء (مرفق)."),
        ("Official delegation or authorisation on the platforms; never passwords or verification codes.", "تفويض رسمي على المنصات؛ ولا كلمات مرور ولا رموز تحقق إطلاقاً."),
        ("Accurate and current data of the establishment, its employees and wages, its commercial registration documents and its national address.", "بيانات دقيقة ومحدّثة للمنشأة وموظفيها وأجورهم، ومستندات السجل التجاري، والعنوان الوطني."),
        ("Written approval of what we prepare before submission; and a separate written approval before any payment, objection or settlement request, signing of an employment contract, or ending of a service.",
         "اعتماد كتابي لما نعدّه قبل الرفع؛ وموافقة كتابية منفصلة قبل أي سداد أو اعتراض أو طلب تسوية أو توقيع عقد عمل أو إنهاء خدمة."),
        ("Payment of government fees, fines and platform subscriptions directly to the entity or supplier when invoiced.", "سداد الرسوم الحكومية والغرامات واشتراكات المنصات مباشرةً للجهة أو المورّد عند الفوترة."),
        ("Payment of wages from the Client’s own account, and responsibility for the accuracy of what it provides and for the real work behind each job title.", "دفع الأجور من حساب العميل نفسه، والمسؤولية عن صحة ما يقدّمه وعن حقيقة العمل خلف كل مسمى وظيفي."),
        ("Notifying its employees of the processing of their data; a named contact person; sending requests through the approved channel.", "إشعار موظفيه بمعالجة بياناتهم؛ وجهة اتصال مسمّاة؛ ورفع الطلبات عبر القناة المعتمدة."),
    ]
    notinc = [
        ("Government fees, fines and platform subscriptions: invoiced separately and paid directly to the entity or supplier, with no percentage or fee to Business Partner.", "الرسوم الحكومية والغرامات واشتراكات المنصات: بفواتير منفصلة وتُدفع مباشرةً للجهة أو المورّد، دون أي نسبة أو أتعاب لبزنس بارتنر."),
        ("The cost of hiring Saudi nationals and their salaries. We manage compliance; we do not register anyone nominally.", "تكلفة توظيف السعوديين ورواتبهم. نحن ندير الامتثال ولا نسجّل أحداً شكلياً."),
        ("Litigation, representation before courts and legal practice.", "التمثيل القضائي والمحاماة."),
        ("Large new services (establishing a new entity or branch, a new industrial licence, recruitment, transfer of services): quoted separately.", "الخدمات الكبيرة الجديدة (تأسيس منشأة أو فرع، ترخيص صناعي جديد، استقدام، نقل خدمات): بعرض مستقل."),
        ("Zakat, tax and customs matters (filing, calculation and representation): with an independent accountant or for a separate fee.", "الزكاة والضريبة والجمارك (الإعداد والإقرار والتمثيل): مع محاسب مستقل أو برسوم منفصلة."),
        ("Any service not listed in section 3 is performed only under a written change request, priced separately.", "أي خدمة غير مذكورة في البند 3 لا تُنفَّذ إلا بطلب تغيير كتابي يُسعَّر على حدة."),
        ("No guarantee of an outcome: we do not promise the lifting of a hold, the cancellation or reduction of a violation, a Nitaqat band, or the acceptance of any request by an entity.",
         "لا ضمان بنتيجة: لا نعد برفع تجميد ولا بإلغاء مخالفة أو تخفيضها ولا بنطاق معيّن ولا بقبول أي جهة لأي طلب."),
    ]
    pages.append(sec(6, "Required from the Client", "المطلوب من العميل") + bullets(need)
                 + sec(7, "Not included in the price", "ما لا يشمله السعر") + bullets(notinc))

    # ص6: المدة والدفع والشروط
    dur = [
        ("12 months from the start date, renewable for a similar period.", "مدة العقد 12 شهراً من تاريخ البدء، وتُجدَّد بمدة مماثلة."),
        ("The start date is the latest of signature, payment of the amount due on signature, and arrival of the authorisation on the platforms.", "يبدأ العقد بآخر ما يلي: التوقيع، وسداد المستحق عند التوقيع، ووصول التفويض على المنصات."),
        ("The Client may cancel after the first 3 months (the minimum term). Either party may end the agreement by at least 30 days’ written notice.", "للعميل الإلغاء بعد 3 أشهر كحد أدنى، ولأي طرف الإلغاء بإشعار كتابي لا تقل مدته عن 30 يوماً."),
        ("Amounts prepaid for work not performed are refunded pro rata or credited.", "ما سُدد مقدماً عن عمل لم يُنفَّذ يُرد بالتناسب أو يُخصم."),
    ]
    pay = [
        (f"Quarterly in advance by tax invoice: on signature {n(DUE_SIGN)} before VAT (first quarter {n(QUARTER)} + {SETUP_EN} {n(SETUP)}), VAT {n(vat(DUE_SIGN))}, total {n(inc(DUE_SIGN))}; then {n(inc(QUARTER))} including VAT at the start of each of the next 3 quarters.",
         f"ربع سنوياً مقدماً بفاتورة ضريبية: عند التوقيع {n(DUE_SIGN)} قبل الضريبة (الربع الأول {n(QUARTER)} + {SETUP_AR} {n(SETUP)})، والضريبة {n(vat(DUE_SIGN))}، فالإجمالي {n(inc(DUE_SIGN))}؛ ثم {n(inc(QUARTER))} شاملة الضريبة في بداية كل ربع من الأرباع الثلاثة التالية."),
        ("Payment is by bank transfer to the account on the last page. Additions (section 2) are invoiced as stated there.", "السداد بالتحويل البنكي إلى الحساب في الصفحة الأخيرة. وتُفوتَر الإضافات (البند 2) كما هو مبيّن فيه."),
        ("If a payment is late, the service stops [●] days after written notice, and we hand the Client the platforms and documents we hold for it.", "عند التأخر في السداد تتوقف الخدمة بعد [●] أيام من الإشعار الكتابي، ونسلّم العميل المنصات والمستندات التي بحوزتنا له."),
    ]
    terms = [
        ("This quotation is an updated offer and replaces in full our earlier offer of 1 November 2026.", "هذا العرض محدَّث ويحلّ بالكامل محل عرضنا السابق بتاريخ 1 نوفمبر 2026."),
        ("Valid for 14 days from its date; accepted by the Client’s signature; electronic signature is valid.", "ساري 14 يوماً من تاريخه، ويُقبل بتوقيع العميل، ويُعتدّ بالتوقيع الإلكتروني."),
        ("The service agreement, the Terms &amp; Conditions and the authorisation letter are attached; a signed service agreement prevails over this quotation.", "عقد الخدمة والشروط والأحكام وخطاب التفويض مرفقة؛ وعقد الخدمة الموقّع يسبق هذا العرض."),
        ("Confidentiality is under the Non-Disclosure Agreement; governed by the laws of the Kingdom of Saudi Arabia.", "السرية وفق اتفاقية عدم الإفصاح؛ ويخضع العرض لأنظمة المملكة العربية السعودية."),
        ("Data hosting and processing location, and any transfer outside the Kingdom: [●].", "موقع استضافة البيانات ومعالجتها وأي نقل خارج المملكة: [●]."),
    ]
    p6 = sec(8, "Duration", "المدة") + bullets(dur) + sec(9, "Payment", "طريقة الدفع") + bullets(pay) + sec(10, "Terms", "الشروط") + bullets(terms)
    pages.append(p6)

    # ص7: القبول
    acc = (sec(11, "Acceptance", "القبول")
           + G.sig_pair(G.sig_box("Business Partner Solutions", "بزنس بارتنر سلوشنز", BADR, BADR_T, 70),
                        G.sig_box("Client", "العميل", CLIENT_EN, "[●]", 70)))
    pages.append(acc)

    total = len(pages) + 2
    secs = [G.sheet("land", cover_land(), 1, total, "")]
    for i, p in enumerate(pages, 2):
        secs.append(land_page(p, i, total))
    secs.append(G.sheet("land", closing_land(), total, total, ""))
    return doc("عرض سعر · Quotation · باقة الانطلاق", "land", secs)


# ------------------------------------------------------------------ بنود مخصصة (عقد وشروط)
def C(t_en, t_ar, x_en, x_ar):
    return (t_en, t_ar, x_en, A(x_ar))


def clause_subject():
    return C("Subject", "موضوع العقد",
             f'The First Party provides the Client with the {PKG_EN} (<span class="num">{SKU}</span>) of the {FAM_EN}, for one branch of the Client’s establishment (Riyadh) and up to 49 employees, '
             f'together with the one-time {SETUP_EN} service, as detailed in the accepted quotation, which forms an integral part of this contract.',
             f'يقدّم الطرف الأول للعميل {PKG_AR} (<span class="num">{SKU}</span>) من {FAM_AR}، لفرع واحد من منشأة العميل (الرياض) وبحد أقصى 49 موظفاً، '
             f'إضافةً إلى خدمة «{SETUP_AR}» لمرة واحدة، وفق ما هو مفصّل في عرض السعر المقبول الذي يُعدّ جزءاً لا يتجزأ من هذا العقد.')


def clause_services():
    return C("Included Services", "الخدمات المشمولة",
             "The package covers: the commercial registration and its renewal; Qiwa (work permits and employment contracts); social insurance (subscription, invoices and certificate); "
             "organising the employees’ medical insurance with an alert before any violation (through the Smart Advisor); basic zakat and tax follow-up of due dates and notices; "
             "Mudad (the monthly wage-protection file and handling of notes); Nitaqat and localisation (a monthly calculation and an alert before any drop); Muqeem and Absher Business (residencies); "
             "a unified renewals calendar, a monthly report and a single point of contact; and monitoring of violations and deadlines on Tamm. "
             "Anything not listed is outside the package and is performed only under a written change request, priced separately.",
             "تشمل الباقة: السجل التجاري وتجديده؛ قوى (رخص العمل وعقود العمل)؛ التأمينات الاجتماعية (الاشتراك والفواتير والشهادة)؛ تنظيم التأمين الطبي للموظفين والتنبيه قبل أي مخالفة (عبر «المستشار الذكي»)؛ "
             "متابعة الزكاة والضريبة الأساسية من مواعيد وإشعارات؛ مدد (ملف حماية الأجور شهرياً ومعالجة الملاحظات)؛ نطاقات والتوطين (حساب شهري وتنبيه قبل أي هبوط)؛ مقيم وأبشر أعمال (الإقامات)؛ "
             "تقويم موحّد للتجديدات وتقرير شهري ونقطة اتصال واحدة؛ ورصد المخالفات والمهل على «تمام». وما لم يُذكر فهو خارج الباقة ولا يُنفَّذ إلا بطلب تغيير كتابي يُسعَّر على حدة.")


def clause_limits():
    return C("Operation Limits &amp; Additional Operations".replace("&amp;", "&"), "حدود العمليات والعمليات الإضافية",
             f"The package includes up to {n(LIM['ops_m'])} operations per month and {n(LIM['ops_y'])} per year, and up to {n(LIM['req_m'])} requests per month and {n(LIM['req_d'])} requests per day. "
             "An operation is a transaction or action on a government platform (issue, renewal, amendment, attestation, file upload, or handling of a note or violation), counted once for each action, entity and worker or entity concerned. "
             "A request is what the Client submits to the First Party through the approved channel; enquiring about the status of an existing request is not an operation. "
             f"Automatic alerts, the monthly report, actions covered by the {SETUP_EN} fee and updates to the Client’s own data held by the First Party are not counted. "
             "Each operation is logged with a reference number and the Client is told the remaining limits. The Client is alerted at 80% of the monthly limit; beyond the limit, "
             "the price of an additional operation is shown before execution and the First Party proceeds only after the Client confirms. "
             f"An additional operation is SAR {n(OVERAGE)} before VAT, invoiced monthly with a statement of the operations. "
             "Requests above the daily maximum are scheduled for the next day unless an entity’s deadline requires otherwise.",
             f"تشمل الباقة حتى {n(LIM['ops_m'])} عملية شهرياً و{n(LIM['ops_y'])} عملية سنوياً، وحتى {n(LIM['req_m'])} طلباً شهرياً و{n(LIM['req_d'])} طلبات يومياً. "
             "والعملية هي معاملة أو إجراء على منصة حكومية (إصدار أو تجديد أو تعديل أو توثيق أو رفع ملف أو معالجة ملاحظة أو مخالفة)، وتُحتسب مرة لكل إجراء وجهة وعامل أو كيان معني. "
             "والطلب هو ما يرفعه العميل إلى الطرف الأول عبر القناة المعتمدة، ولا يُعدّ الاستفسار عن حالة طلب قائم عملية. "
             f"ولا تُحتسب التنبيهات الآلية ولا التقرير الشهري ولا الإجراءات المشمولة في رسم «{SETUP_AR}» ولا تحديث بيانات العميل لدى الطرف الأول. "
             "تُسجَّل كل عملية برقم مرجعي ويُبلَّغ العميل بالحدود المتبقية. وينبَّه العميل عند 80٪ من الحد الشهري؛ وما زاد على الحد يُعرض سعر العملية الإضافية قبل تنفيذها "
             "ولا يمضي الطرف الأول إلا بعد تأكيد العميل. "
             f"وسعر العملية الإضافية {n(OVERAGE)} ريالاً قبل الضريبة، وتُفوتَر شهرياً مع كشف بالعمليات. "
             "والطلبات الزائدة على الحد اليومي تُجدول لليوم التالي ما لم تقتضِ مهلة جهة غير ذلك.")


def clause_fees():
    return C("Fees &amp; Payment".replace("&amp;", "&"), "الأتعاب والدفع",
             f"The annual fee of the package is SAR {n(ANNUAL)}, paid quarterly in advance in four instalments of SAR {n(QUARTER)}: the first on signature and the others at the start of each following quarter. "
             f"The one-time {SETUP_EN} fee is SAR {n(SETUP)}, payable on signature. All amounts are before 15% VAT, which is added: the amount due on signature is SAR {n(DUE_SIGN)} plus VAT of SAR {n(vat(DUE_SIGN))}, a total of SAR {n(inc(DUE_SIGN))}; "
             f"and each of the three following quarterly invoices is SAR {n(QUARTER)} plus VAT of SAR {n(vat(QUARTER))}, a total of SAR {n(inc(QUARTER))}. "
             f"An employee above 49 is SAR {n(EXTRA_EMP)} per year (SAR {n(EXTRA_EMP_Q)} on each quarterly invoice), and each additional branch is SAR {n(EXTRA_BRANCH)} per year from the date its documents and authorisation are received. "
             "Payment is by bank transfer to the First Party’s account at [●], IBAN [IBAN], against a tax invoice. Government fees, fines and platform subscriptions are not included: "
             "they are invoiced separately and paid directly to the entity or supplier when the invoice is issued, with no percentage or fee to the First Party.",
             f"الرسم السنوي للباقة {n(ANNUAL)} ريال، يُدفع ربع سنوياً مقدماً على أربع دفعات قيمة كل منها {n(QUARTER)} ريال: الأولى عند التوقيع والباقي في بداية كل ربع تالٍ. "
             f"ورسم «{SETUP_AR}» لمرة واحدة {n(SETUP)} ريال يُدفع عند التوقيع. وكل المبالغ قبل ضريبة القيمة المضافة 15٪ التي تُضاف عليها: فالمستحق عند التوقيع {n(DUE_SIGN)} ريال والضريبة {n(vat(DUE_SIGN))} ريال، فالإجمالي {n(inc(DUE_SIGN))} ريال؛ "
             f"وكل فاتورة من الفواتير الربع سنوية الثلاث التالية {n(QUARTER)} ريال والضريبة {n(vat(QUARTER))} ريال، فالإجمالي {n(inc(QUARTER))} ريال. "
             f"والموظف فوق 49 بمبلغ {n(EXTRA_EMP)} ريال في السنة ({n(EXTRA_EMP_Q)} ريالاً على كل فاتورة ربع سنوية)، وكل فرع إضافي {n(EXTRA_BRANCH)} ريال في السنة من تاريخ استلام وثائقه وتفويضه. "
             "ويتم السداد بتحويل بنكي إلى حساب الطرف الأول لدى [●]، آيبان [IBAN]، مقابل فاتورة ضريبية. ولا تشمل الرسوم الحكومية ولا الغرامات ولا اشتراكات المنصات: "
             "تُفوتَر على حدة وتُدفع مباشرةً للجهة أو المورّد عند إصدار الفاتورة، دون أي نسبة أو أتعاب للطرف الأول.")


def clause_late():
    return C("Late Payment", "التأخر في السداد",
             "If a payment is not made when due, the First Party notifies the Client in writing. If the amount is still unpaid [●] days after the notice, the service stops, and the First Party hands over to the Client "
             "the platforms it manages for the Client and the documents it holds, and removes any delegation it was given. Stopping the service does not cancel amounts already due. No late-payment interest applies.",
             "إن لم يُسدَّد مبلغ في موعده أشعر الطرف الأول العميل كتابةً. فإن بقي المبلغ غير مسدَّد بعد [●] أيام من الإشعار توقفت الخدمة، وسلّم الطرف الأول للعميل المنصات التي يديرها له والمستندات التي بحوزته، "
             "وأزال أي تفويض مُنح له. ولا يُسقط إيقاف الخدمة المبالغ المستحقة. ولا تُحتسب فوائد تأخير.")


def clause_term():
    return C("Term, Renewal &amp; Cancellation".replace("&amp;", "&"), "المدة والتجديد والإلغاء",
             "The term is 12 months from the start date, which is the latest of: signature, payment of the amount due on signature, and arrival of the Client’s authorisation on the platforms. "
             "The term renews for a similar period unless either party gives written notice of non-renewal at least 30 days before its end. "
             "The Client may cancel after the first 3 months, which are the minimum term. Either party may end the contract by written notice of at least 30 days. "
             "Amounts paid in advance for work not performed are refunded pro rata or credited, measured by the stages stated in the quotation and the period elapsed. "
             "For a material breach by the Client other than non-payment, the First Party gives 10 days’ written warning before terminating or suspending the service.",
             "مدة العقد 12 شهراً من تاريخ البدء، وهو آخر ما يلي: التوقيع، وسداد المستحق عند التوقيع، ووصول تفويض العميل على المنصات. "
             "وتُجدَّد المدة بمدة مماثلة ما لم يُشعر أحد الطرفين الآخر كتابةً بعدم التجديد قبل نهايتها بـ30 يوماً على الأقل. "
             "وللعميل الإلغاء بعد 3 أشهر كحد أدنى هي المدة الدنيا. ولأي طرف إنهاء العقد بإشعار كتابي لا تقل مدته عن 30 يوماً. "
             "وما سُدد مقدماً عن عمل لم يُنفَّذ يُرد بالتناسب أو يُخصم، ويُقاس بالمراحل المذكورة في عرض السعر وبالمدة المنقضية. "
             "وعند إخلال جسيم من العميل غير عدم السداد، يوجّه الطرف الأول إنذاراً كتابياً مدته 10 أيام قبل إنهاء الخدمة أو إيقافها.")


def clause_setup():
    return C(SETUP_EN.replace("&amp;", "&"), SETUP_AR,
             "Because the Client’s establishment has violations and challenges on the platforms, the one-time service applies. It covers the assessment, setting up the file on the platforms, cleaning and organising it, "
             "a corrective plan for the platforms and for compliance management, and follow-up until stability. The fee is charged once, is separate from the annual fee, "
             "and does not include government fees, fines or the costs of hiring.",
             "لوجود مخالفات وتحديات على منصات منشأة العميل تسري هذه الخدمة لمرة واحدة. وتشمل التقييم، وتأسيس الملف على المنصات، وتنظيفه وترتيبه، وخطة تصحيحية للمنصات وإدارة الامتثال، والمتابعة حتى الاستقرار. "
             "ويُحتسب الرسم مرة واحدة منفصلاً عن الرسم السنوي، ولا يشمل الرسوم الحكومية ولا الغرامات ولا تكلفة التوظيف.")


def clause_violations():
    return C("Violations", "المخالفات",
             "For violations, the First Party’s work is: review of the violation file, a study of the eligibility of the available route (objection, settlement or correction) under the applicable regulations, "
             "preparation of the file, submission through the official platform, and follow-up. This is advisory: the First Party does not promise cancellation, reduction or acceptance. "
             "The entities’ deadlines run from their notification dates, and the First Party tells the Client of the deadlines it learns of. "
             "The First Party does not pay any amount, file an objection or a settlement request, sign an employment contract, or end a service or a work permit without the Client’s separate written approval. "
             "Fines resulting from the Client’s information or late documents are borne by the Client.",
             "في المخالفات يقوم الطرف الأول بـ: مراجعة ملف المخالفة، ودراسة أهلية المسار المتاح (اعتراض أو تسوية أو تصحيح) وفق الأنظمة المعمول بها، وتجهيز الملف، والتقديم عبر المنصة الرسمية، والمتابعة. "
             "وهذا عمل استشاري: فلا يعد الطرف الأول بالإلغاء ولا بالتخفيض ولا بالقبول. "
             "وتسري مهل الجهات من تواريخ تبليغها، ويُعلم الطرف الأول العميل بالمهل التي يطّلع عليها. "
             "ولا يسدد الطرف الأول أي مبلغ ولا يقدّم اعتراضاً أو طلب تسوية ولا يوقّع عقد عمل ولا ينهي خدمة أو رخصة عمل إلا بموافقة العميل الخطية المنفصلة. "
             "وتقع على العميل الغرامات الناتجة عن معلوماته أو تأخر مستنداته.")


def clause_local():
    return C("Localisation &amp; Employment Relationship".replace("&amp;", "&"), "التوطين وعلاقة العمل",
             "The package does not make the First Party the employer of the Client’s employees or responsible for the Client’s employer obligations. The First Party does not receive, hold or pay wages; the Client pays wages from its own account. "
             "The First Party manages compliance and does not register anyone nominally: jobs must be genuine positions with real work, and the Client is responsible for the accuracy of what it provides and for the real work behind each job title. "
             "The First Party does not guarantee that any person is counted in any localisation programme or band. The cost of hiring Saudi nationals and their salaries are the Client’s. "
             "Dismissal and disciplinary decisions are the Client’s, signed by it, and the First Party’s input is advisory only. The Client notifies its employees of the processing of their data. The services are not licensed legal advice.",
             "لا تجعل الباقة الطرف الأول صاحب عمل لموظفي العميل ولا مسؤولاً عن التزامات العميل كصاحب عمل. ولا يستلم الطرف الأول الأجور ولا يمسك بها ولا يدفعها؛ ويدفعها العميل من حسابه. "
             "ويدير الطرف الأول الامتثال ولا يسجّل أحداً شكلياً: فيجب أن تكون الوظائف حقيقية بعمل فعلي، ويتحمل العميل صحة ما يقدّمه وحقيقة العمل خلف كل مسمى وظيفي. "
             "ولا يضمن الطرف الأول احتساب أي شخص في أي برنامج توطين أو نطاق. وتكلفة توظيف السعوديين ورواتبهم على العميل. "
             "وقرارات الفصل والتأديب للعميل بتوقيعه، ورأي الطرف الأول استشاري فقط. ويُشعر العميل موظفيه بمعالجة بياناتهم. والخدمات ليست استشارة قانونية مرخصة.")


def clause_excl():
    return C("Exclusions", "خارج نطاق السعر",
             "The price does not include: government fees, fines and platform subscriptions; the cost of hiring Saudi nationals and their salaries; litigation, representation before courts and the practice of law; "
             "large new services (establishing a new entity or branch, a new industrial licence, recruitment, transfer of services); government relations services (investment licensing, municipality, environmental and industrial licensing and renewals), which are quoted separately on request; zakat, tax and customs matters (filing, calculation and representation), "
             "which are handled with an independent accountant or for a separate fee; and any item not expressly listed in the quotation. Additional work is performed only under a written change request priced separately.",
             "لا يشمل السعر: الرسوم الحكومية والغرامات واشتراكات المنصات؛ وتكلفة توظيف السعوديين ورواتبهم؛ والتمثيل القضائي والمحاماة؛ "
             "والخدمات الكبيرة الجديدة (تأسيس منشأة أو فرع، ترخيص صناعي جديد، استقدام، نقل خدمات)؛ وخدمات العلاقات الحكومية (الاستثمار والبلدية والتراخيص البيئية والصناعية وتجديدها) وتُسعَّر منفصلة عند الطلب؛ والزكاة والضريبة والجمارك (الإعداد والإقرار والتمثيل) التي تُدار مع محاسب مستقل أو برسوم منفصلة؛ "
             "وأي بند غير مذكور صراحةً في عرض السعر. ولا يُنفَّذ عمل إضافي إلا بطلب تغيير كتابي يُسعَّر على حدة.")


def core_items(keys, ext=None):
    nda, core, cats = G.legal_core()
    byn = {x["n"]: x for x in core}
    out = []
    for k in keys:
        x = G.lc(byn[k])
        if ext and k in ext:
            e_en, e_ar = ext[k]
            x = (x[0], x[1], x[2] + " " + e_en, x[3].rstrip(RLM) + " " + A(e_ar))
        out.append(x)
    return out


EXT = {
    9: ("The authorisation is given by an authorisation letter attested by the Chamber of Commerce, with a tick box for each action; an act that is not ticked is not authorised.",
        "ويُمنح التفويض بخطاب تفويض مصدَّق من الغرفة التجارية بخانة اختيار لكل إجراء؛ وما لم تُختر خانته فلا تفويض فيه."),
    10: ("This includes the lifting of any hold or freeze, the cancellation or reduction of a violation, and any Nitaqat band.",
         "ويشمل ذلك رفع أي تجميد وإلغاء أي مخالفة أو تخفيضها وأي نطاق."),
    18: ("This contract and the accepted quotation also replace the First Party’s earlier offer of 1 November 2026.",
         "ويحل هذا العقد وعرض السعر المقبول كذلك محل عرض الطرف الأول السابق بتاريخ 1 نوفمبر 2026."),
}


def client_party_named(role_en, role_ar):
    rows = [("Name", CLIENT_EN, "الاسم"), ("Unified / CR No.", G.num("[●]"), "الرقم الموحد / السجل التجاري"),
            ("VAT No.", G.num("[●]"), "الرقم الضريبي"), ("National Address", G.num("[●]"), "العنوان الوطني"),
            ("Represented by", G.num("[●]"), "يمثلها"), ("Title", G.num("[●]"), "الصفة")]
    return G.party_table(role_en, role_ar, rows)


def parties_blocks(second_en, second_ar, first_en="First Party", first_ar="الطرف الأول", first_extra=""):
    return [G.blk(G.pre_h(1, "Parties", "الأطراف"), 30, keep=True),
            G.blk(G.co_party(first_en, first_ar), 215, keep=True),
            G.blk(client_party_named(second_en, second_ar), 215)]


def sig_client(role_en, role_ar):
    return G.sig_box(role_en, role_ar, CLIENT_EN, "[●]")


def cover_strip(extra=None):
    return [("Parties / الأطراف", f"{G.CO_EN} · {CLIENT_EN}"), ("Date / التاريخ", G.num("[●]")), ("Ref / المرجع", G.num("[●]"))]


# ------------------------------------------------------------------ العقد
def build_contract():
    seq = [clause_subject(), clause_services(), clause_limits(), clause_fees(), clause_late(), clause_term(), clause_setup()]
    seq += core_items([8, 9], EXT)
    seq += [clause_violations(), clause_local(), clause_excl()]
    seq += core_items([10], EXT)
    seq += core_items([11, 12, 13, 14, 15, 16, 17, 18], EXT)
    blocks = parties_blocks("Second Party (Client)", "الطرف الثاني (العميل)")
    blocks += G.clause_blocks(seq, start=2)
    blocks.append(G.blk(G.sig_pair(G.sig_box("First Party", "الطرف الأول", G.CEO_NAME, G.CEO_TITLE),
                                   sig_client("Second Party", "الطرف الثاني")), G.sig_h()))
    cover = G.cover_port("SERVICE AGREEMENT", "عقد خدمة", "Launch Package", "باقة الانطلاق",
                         f"{FAM_EN} · {SKU}", f"{FAM_AR} · {SKU}", cover_strip())
    return G.port_doc("عقد خدمة: باقة الانطلاق للامتثال والتوطين", "Service Agreement: Launch Package — Compliance &amp; Localization",
                      blocks, cover, G.closing_port(), "عقد خدمة · Service Agreement · باقة الانطلاق")


# ------------------------------------------------------------------ عدم الإفصاح
def build_nda():
    nda, core, cats = G.legal_core()
    blocks = parties_blocks("Second Party", "الطرف الثاني")
    blocks += G.clause_blocks([G.lc(x) for x in nda], start=2)
    blocks.append(G.blk(G.sig_pair(G.sig_box("First Party", "الطرف الأول", G.CEO_NAME, G.CEO_TITLE),
                                   sig_client("Second Party", "الطرف الثاني")), G.sig_h()))
    cover = G.cover_port("MUTUAL NON-DISCLOSURE AGREEMENT", "اتفاقية عدم إفصاح متبادلة", "Mutual Non-Disclosure Agreement",
                         "اتفاقية عدم إفصاح متبادلة", "Applies to all Business Partner services", "تسري على كل خدمات Business Partner", cover_strip())
    return G.port_doc("اتفاقية عدم إفصاح متبادلة", "Mutual Non-Disclosure Agreement", blocks, cover, G.closing_port(),
                      "اتفاقية عدم إفصاح · Mutual NDA")


# ------------------------------------------------------------------ الشروط والأحكام
def build_terms():
    seq = [
        C("Scope &amp; Precedence".replace("&amp;", "&"), "النطاق وأسبقية الوثائق",
          f"These terms apply to the {PKG_EN} ({FAM_EN}) quoted by Business Partner Solutions (the “First Party”) to the Client and form part of the accepted quotation. If a service agreement is signed, it prevails over these terms.",
          f"تسري هذه الشروط على {PKG_AR} ({FAM_AR}) التي تعرضها شركة بزنس بارتنر سلوشنز («الطرف الأول») على العميل، وتُعدّ جزءاً من عرض السعر المقبول. وإن وُقّع عقد خدمة فهو يسبق هذه الشروط."),
        C("Quotation &amp; Acceptance".replace("&amp;", "&"), "عرض السعر والقبول",
          "A quotation is valid for 14 days from its date. It is accepted by the Client’s signature on it; electronic signature is valid. Work starts when the Client has provided the complete documents and the authorisation, and paid the amount due.",
          "يسري عرض السعر 14 يوماً من تاريخه، ويُقبل بتوقيع العميل عليه، ويُعتدّ بالتوقيع الإلكتروني. ويبدأ العمل عند تقديم العميل المستندات كاملة والتفويض وسداد المستحق."),
    ]
    f = clause_fees()
    seq += [("Prices, Payment & VAT", "الأسعار والدفع والضريبة", f[2], f[3])]
    seq += [clause_late(), clause_term(), clause_limits(), clause_setup()]
    seq += core_items([8, 9], EXT)
    seq += [clause_violations(), clause_local(), clause_excl()]
    seq += core_items([10, 11, 12, 13, 16, 17], EXT)
    seq += [C("Entire Terms", "كامل الشروط",
              "The Arabic version prevails in case of discrepancy. Amendments only in writing signed by both parties. Notices to the addresses stated in the quotation: [●].",
              "النسخة العربية هي المرجع عند الاختلاف. لا تُعدَّل هذه الشروط إلا كتابةً بموافقة الطرفين. الإشعارات على العناوين المذكورة في عرض السعر: [●].")]
    blocks = G.clause_blocks(seq)
    blocks.append(G.blk('<div class="sg one" style="direction:ltr">' + sig_client("Client acknowledgement", "إقرار العميل") + "</div>", 190))
    return G.port_doc("الشروط والأحكام: باقة الانطلاق", "Terms &amp; Conditions: Launch Package", blocks,
                      doc_title="الشروط والأحكام · Terms &amp; Conditions · باقة الانطلاق")


# ------------------------------------------------------------------ خطاب التفويض
def tick_rows(rows, head_en, head_ar):
    h = (f'<div class="hdr2" dir="ltr">{head_en} <span dir="rtl" style="float:right">{head_ar}</span></div>')
    h += '<table class="cl tk"><colgroup><col style="width:44%"><col style="width:6%"><col style="width:50%"></colgroup>'
    for i, (en, ar) in enumerate(rows):
        h += f'<tr><td class="en">{en}</td><td class="bxc"><span class="bx0"></span></td><td class="ar">{A(ar)}</td></tr>'
    return h + "</table>"


def build_auth():
    cl = [G.lc(x) for x in G.legal_auth()]       # البنود 2..12 بالترتيب
    by = {x["n"]: G.lc(x) for x in G.legal_auth()}
    seq = [
        C("Services covered", "الخدمات المشمولة",
          f"Only the {PKG_EN} (<span class=\"num\">{SKU}</span>) and the {SETUP_EN} service in accepted quotation no. [●], limited to the actions ticked in Annex A and the entities ticked in Annex B. Nothing outside them is authorised.",
          f"{PKG_AR} (<span class=\"num\">{SKU}</span>) وخدمة «{SETUP_AR}» في عرض السعر المقبول رقم [●] وحدهما، ضمن الإجراءات المختارة في الملحق أ والجهات المختارة في الملحق ب. ولا يشمل التفويض ما خرج عنها."),
        C("Permitted acts", "الأعمال المسموحة",
          "Within the covered services and the ticked actions and entities only, the Authorised Party may: (a) prepare and submit applications and documents to the ticked entities; (b) follow up the transactions; "
          "(c) receive notifications and official documents relating to them; (d) pay official fees, only if that action is ticked, from funds the Principal has deposited for that purpose, against the entity’s receipt and with the Principal’s separate written approval each time; "
          "(e) communicate with the entity about those transactions. The Principal approves what is prepared before it is submitted.",
          "ضمن الخدمات المشمولة والإجراءات والجهات المختارة وحدها، للمفوَّض: (أ) إعداد الطلبات والمستندات وتقديمها إلى الجهات المختارة؛ (ب) متابعة المعاملات؛ (ج) استلام الإشعارات والمستندات الرسمية المتعلقة بها؛ "
          "(د) سداد الرسوم الرسمية، إن اختيرت خانة هذا الإجراء، من مبالغ أودعها المفوِّض لهذا الغرض فقط وبإيصال الجهة وبموافقة المفوِّض الكتابية المنفصلة في كل مرة؛ (هـ) مخاطبة الجهة بشأن هذه المعاملات. ويعتمد المفوِّض ما يُعدّ قبل تقديمه."),
        by[4], by[5],
        C("Fees", "الرسوم",
          "Official fees are paid directly by the Principal to the entity. Where the fee-payment action is ticked, the Principal deposits the fees before execution, and the Authorised Party provides the entities’ receipts and returns any unused balance.",
          "يسدد المفوِّض الرسوم الرسمية مباشرةً للجهة. وإن اختيرت خانة سداد الرسوم أودعها المفوِّض قبل التنفيذ، وقدّم المفوَّض إيصالات الجهات ورد الرصيد غير المستعمل."),
        by[7],
        C("Term and revocation", "المدة والإلغاء",
          "This letter starts on [●] and ends on the earliest of: completion or closure of the covered services; the end of the service agreement; or 12 months from its start. The Principal may revoke it at any time by written notice, effective on receipt, "
          "without prejudice to fees earned under the service agreement. On revocation or expiry the Authorised Party stops acting, hands over documents and receipts, and removes any platform delegation within [2] business days.",
          "يبدأ هذا الخطاب في [●] وينتهي بأسبق ما يلي: إتمام الخدمات المشمولة أو إغلاقها؛ أو انتهاء عقد الخدمة؛ أو بعد 12 شهراً من بدايته. وللمفوِّض إلغاؤه في أي وقت بإشعار كتابي ينفذ باستلامه، "
          "دون المساس بالرسوم المستحقة بموجب عقد الخدمة. وعند الإلغاء أو الانتهاء يتوقف المفوَّض عن العمل ويسلّم المستندات والإيصالات ويزيل أي تفويض على المنصات خلال [2] يوم عمل."),
        by[9], by[10], by[11], by[12],
    ]
    # by[x] للبنود 4,5,7,9..12: tuples (t_en,t_ar,x_en,x_ar)؛ بند 6 و8 و2 و3 مخصصة
    parties = [G.blk(G.pre_h(1, "Parties", "الأطراف"), 30, keep=True),
               G.blk(client_party_named("The Principal (the Client)", "المفوِّض (العميل)"), 215, keep=True),
               G.blk(G.co_party("The Authorised Party", "المفوَّض"), 215)]
    blocks = parties + G.clause_blocks(seq, start=2)

    acts = [
        ("Follow up transactions and receive notifications and official documents.", "متابعة المعاملات واستلام الإشعارات والمستندات الرسمية."),
        ("Prepare and submit applications and documents (issue, renewal, amendment, attestation). <span class=\"sm\">Approval of what is prepared before submission.</span>",
         "إعداد الطلبات والمستندات وتقديمها (إصدار، تجديد، تعديل، توثيق). <span class=\"sm\">اعتماد ما يُعدّ قبل التقديم.</span>"),
        ("Upload the monthly files (wage protection, social insurance). <span class=\"sm\">Approval of the file before upload.</span>",
         "رفع الملفات الشهرية (حماية الأجور، التأمينات). <span class=\"sm\">اعتماد الملف قبل الرفع.</span>"),
        ("Monitor violations and deadlines; review the file and study the eligibility of the available route.", "رصد المخالفات والمهل؛ ومراجعة الملف ودراسة أهلية المسار المتاح."),
        ("Prepare and submit an objection or a settlement request. <span class=\"sm\">Separate written approval each time.</span>",
         "إعداد اعتراض أو طلب تسوية وتقديمه. <span class=\"sm\">موافقة كتابية منفصلة في كل مرة.</span>"),
        ("Pay official fees from funds the Principal deposits, against the entity’s receipt. <span class=\"sm\">Separate written approval each time.</span>",
         "سداد الرسوم الرسمية من مبالغ يودعها المفوِّض وبإيصال الجهة. <span class=\"sm\">موافقة كتابية منفصلة في كل مرة.</span>"),
        ("Attest or sign an employment contract on a platform. <span class=\"sm\">Separate written approval each time.</span>",
         "توثيق عقد عمل أو توقيعه على منصة. <span class=\"sm\">موافقة كتابية منفصلة في كل مرة.</span>"),
        ("End a service or cancel a work permit. <span class=\"sm\">Separate written approval each time.</span>",
         "إنهاء خدمة أو إلغاء رخصة عمل. <span class=\"sm\">موافقة كتابية منفصلة في كل مرة.</span>"),
    ]
    ents = [
        ("Qiwa (including Nitaqat and localisation)", "قوى (ومنها نطاقات والتوطين)"),
        ("Social insurance (GOSI)", "التأمينات الاجتماعية"),
        ("Mudad (wage protection)", "مدد (حماية الأجور)"),
        ("Muqeem", "مقيم"),
        ("Absher Business", "أبشر أعمال"),
        ("Tamm (violations)", "تمام (المخالفات)"),
        ("Commercial registration (Saudi Business Center)", "السجل التجاري (المركز السعودي للأعمال)"),
        ("Zakat, Tax and Customs Authority (dates and notices follow-up only)", "هيئة الزكاة والضريبة والجمارك (متابعة المواعيد والإشعارات فقط)"),
        ("Medical-insurance provider portal: [●]", "بوابة مزوّد التأمين الطبي: [●]"),
        ("Other entity named in writing: [●]", "جهة أخرى تُسمّى كتابةً: [●]"),
    ]
    blocks.append(G.blk(tick_rows(acts, "Annex A — Actions authorised (tick each)", "الملحق أ — الإجراءات المفوَّض بها (اختر كل إجراء)"), 330, keep=True))
    blocks.append(G.blk(tick_rows(ents, "Annex B — Entities and platforms (tick each)", "الملحق ب — الجهات والمنصات (اختر كل جهة)"), 300))
    sig = G.sig_pair(G.sig_box("Principal (Client)", "المفوِّض (العميل)", CLIENT_EN, "[●]"),
                     G.sig_box("Authorised Party", "المفوَّض", G.CEO_NAME, G.CEO_TITLE))
    att = ('<div class="att" dir="ltr"><b style="color:#0B1B5A">Attestation by the Chamber of Commerce</b> '
           '<span dir="rtl" style="float:right"><b style="color:#0B1B5A">تصديق الغرفة التجارية</b></span><br>'
           '<span class="sm">Chamber: [●] · Attestation no.: [●] · Date: [●]</span>'
           '<span class="sm" dir="rtl" style="float:right">الغرفة: [●] · رقم التصديق: [●] · التاريخ: [●]</span>'
           '<div style="height:70px;border:1px dashed #8A93B0;margin-top:6px;text-align:center;color:#8A93B0;font-size:9.5px;padding-top:4px">Stamp and signature of the Chamber · ختم الغرفة وتوقيعها</div></div>')
    blocks.append(G.blk(sig + att, 330))
    blocks.insert(0, G.blk('<div class="hdr2" dir="ltr">Annex to Service Agreement No. [●] — Date [●] <span dir="rtl" style="float:right">ملحق بعقد الخدمة رقم [●] — التاريخ [●]</span></div>', 28))
    return G.port_doc("خطاب تفويض: باقة الانطلاق للامتثال والتوطين", "Authorization Letter: Launch Package — Compliance &amp; Localization",
                      blocks, doc_title="خطاب تفويض · Authorization Letter · باقة الانطلاق")


# ------------------------------------------------------------------ ملخص التقييم (أرقام مجمّعة بلا هويات)
def fact_row(le, ve, la, va, alt=False):
    return (f'<table class="cl{" alt" if alt else ""}"><tr><td class="en"><b>{le}:</b> {ve}</td>'
            f'<td class="ar"><b>{la}:</b> {A(va)}</td></tr></table>')


def fact_blocks(title_en, title_ar, rows):
    out = [G.blk(f'<div class="pre"><b>{title_en} / {title_ar}</b></div>', 28, keep=True)]
    for i, (le, ve, la, va) in enumerate(rows):
        out.append(G.blk(fact_row(le, ve, la, va, alt=i % 2 == 1), G.est_row(ve, va, 56, 16, title=False, pad=10), keep=(i == 0)))
    return out


def build_assessment():
    gov_cash = 32200 + 1000 + 2248.25 + 2919.29
    assert round(gov_cash, 2) == 38367.54
    assert 17 + 1 + 4 == 22 and 24000 + 7000 + 1200 == 32200
    assert round(68066.32 + 16593.13, 2) == 84659.45
    k = G.num
    facts = [
        ("Workforce on the employment statement", k(31), "العمالة في بيان العمالة", k(31)),
        ("of which Saudi / non-Saudi", f"{k(5)} (16.1%) / {k(26)}", "منهم سعوديون / غير سعوديين", f"{k(5)} (16.1٪) / {k(26)}"),
        ("Active social-insurance subscriptions", f"{k(29)}: {k(3)} Saudi, {k(26)} non-Saudi", "الاشتراكات النشطة في التأمينات", f"{k(29)}: {k(3)} سعوديون، {k(26)} غير سعوديين"),
        ("Counted in Nitaqat", f"{k(2)} Saudi of {k(28)} counted = {k('7.14%')}", "المحتسبون في نطاقات", f"سعوديان من {k(28)} محتسباً = {k('7.14٪')}"),
        ("Nitaqat band", "Red (0–21%)", "النطاق", "الأحمر (0–21٪)"),
        ("Localisation of sales professions", f"required {k(2)}, actual {k(0)} (required rate {k('60%')})", "توطين مهن المبيعات", f"مطلوب {k(2)}، فعلي {k(0)} (النسبة المطلوبة {k('60٪')})"),
    ]
    status = [
        ("Qiwa: overall compliance", f"{k('57%')}, not compliant", "قوى: الالتزام العام", f"{k('57٪')}، غير ملتزمة"),
        ("Work-permit validity", f"{k('92%')}; {k(2)} expired; {k(1)} worker without a contract", "صلاحية رخص العمل", f"{k('92٪')}؛ {k(2)} منتهية؛ عامل واحد بلا عقد"),
        ("Contract documentation; location assignment", f"{k('93%')}; {k('100%')}", "توثيق العقود؛ تعيين المواقع", f"{k('93٪')}؛ {k('100٪')}"),
        ("Wage protection (Mudad)", f"not compliant; {k(7)} violations", "حماية الأجور (مدد)", f"غير ملتزمة؛ {k(7)} مخالفات"),
        ("Social insurance: unpaid", f"{k('84,659.45')} (contributions {k('68,066.32')} + penalties {k('16,593.13')})", "التأمينات: غير المسدد", f"{k('84,659.45')} (اشتراكات {k('68,066.32')} + غرامات {k('16,593.13')})"),
        ("Social insurance: instalment plan", f"{k(30)} instalments of {k('2,919.29')}; one paid; next on 17 Nov 2026", "التأمينات: خطة التقسيط", f"{k(30)} قسطاً بقيمة {k('2,919.29')}؛ سُدد قسط واحد؛ والتالي في 17 نوفمبر 2026"),
        ("Qiwa group subscription", f"ending soon; renewal {k('2,248.25')} before 11 Nov 2026 (date to be confirmed on the platform)", "اشتراك المجموعة في قوى", f"ينتهي قريباً؛ التجديد {k('2,248.25')} قبل 11 نوفمبر 2026 (يُؤكَّد التاريخ على المنصة)"),
        ("Residencies (Muqeem)", "cannot be assessed: no dates in the sources provided", "الإقامات (مقيم)", "غير قابلة للتقييم: لا تواريخ في المصادر المقدّمة"),
    ]
    viol = [
        ("Violations recorded on Tamm", k(22), "المخالفات المسجّلة على «تمام»", k(22)),
        ("Unpaid", f"{k(17)} = {k('32,200')} (localisation {k(6)} = {k('24,000')}; wage protection {k(7)} = {k('7,000')}; late wages {k(4)} = {k('1,200')})", "غير المسددة", f"{k(17)} = {k('32,200')} (توطين {k(6)} = {k('24,000')}؛ حماية أجور {k(7)} = {k('7,000')}؛ تأخر أجور {k(4)} = {k('1,200')})"),
        ("Transferred to the enforcement platform", f"{k(1)} = {k('1,000')}", "المرحّلة إلى منصة التنفيذ", f"{k(1)} = {k('1,000')}"),
        ("Cancelled earlier", f"{k(4)} ({k('34,000')})", "الملغاة سابقاً", f"{k(4)} ({k('34,000')})"),
        ("With an objection filed", k(1), "عليها اعتراض مقدَّم", k(1)),
    ]
    cash = [
        ("Unpaid violations and the one in enforcement", k("33,200"), "المخالفات غير المسددة والمرحّلة", k("33,200")),
        ("Qiwa subscription", k("2,248.25"), "اشتراك قوى", k("2,248.25")),
        ("Social-insurance instalment (17 Nov 2026)", k("2,919.29"), "قسط التأمينات (17 نوفمبر 2026)", k("2,919.29")),
        ("Total near-term amounts due to entities", k(M(gov_cash)), "إجمالي المستحق القريب للجهات", k(M(gov_cash))),
    ]

    plan = [
        ("<b>First 7 days.</b> List the notification date of every violation and sort out what is still within an objection or settlement deadline; "
         "confirm who actually works in each sales role so that job titles match the real work; renew the Qiwa subscription; "
         "issue the authorisation letter to us; obtain the text, issuer and date of the stability-support notice shown on the establishment’s account.",
         "<b>أول 7 أيام.</b> جرد تاريخ تبليغ كل مخالفة وفرز ما بقي ضمن مهلة اعتراض أو تسوية؛ وتأكيد من يعمل فعلاً في كل وظيفة مبيعات ليطابق المسمى الوظيفي العمل الحقيقي؛ "
         "وتجديد اشتراك قوى؛ وإصدار خطاب التفويض لنا؛ والحصول على نص إشعار «دعم استقرار المنشآت» الظاهر على حساب المنشأة وجهته وتاريخه."),
        ("<b>Within 30 days.</b> Pay the social-insurance instalment and renew the instalment certificate; study the eligibility of the available route for each unpaid violation "
         "(localisation first, then wage protection); activate Mudad and file monthly; renew the two expired work permits and document the missing contract; "
         "verify the social-insurance status of every Saudi employee; assemble the file for lifting the hold; complete and update the work regulations.",
         "<b>خلال 30 يوماً.</b> سداد قسط التأمينات وتجديد شهادة التقسيط؛ ودراسة أهلية المسار المتاح لكل مخالفة غير مسددة (التوطين أولاً ثم حماية الأجور)؛ وتفعيل مدد والرفع الشهري؛ "
         "وتجديد رخصتي العمل المنتهيتين وتوثيق العقد المفقود؛ والتحقق من وضع كل موظف سعودي في التأمينات؛ وتجميع ملف رفع التجميد؛ واستكمال لائحة تنظيم العمل وتحديثها."),
        (f"<b>30 to 90 days.</b> Plan the climb out of the red band: about {k(5)} more counted Saudi employees to reach 21% and about {k(9)} more to reach 28% (approximate, to be confirmed with the calculator and the counting rules); "
         "a genuine hiring plan (real jobs, wages and schedule); extract the residencies and renew those ending; move to monthly management under the package.",
         f"<b>من 30 إلى 90 يوماً.</b> تخطيط الخروج من النطاق الأحمر: نحو {k(5)} سعوديين محتسبين إضافيين لبلوغ 21٪ ونحو {k(9)} لبلوغ 28٪ (تقريبي، يُؤكَّد بالحاسبة وقواعد الاحتساب)؛ "
         "وخطة توظيف فعلي (مهن وأجور وجدول)؛ واستخراج الإقامات وتجديد المنتهي منها؛ والانتقال إلى الإدارة الشهرية ضمن الباقة."),
        ("<b>Indicators to review at 90 days</b> (aims of the plan, not guarantees; they depend on the Client’s decisions and the entities’ response): no new violations for three months; localisation at 21% or more; permits and contracts at 100%; no wage-protection notes.",
         "<b>مؤشرات المراجعة بعد 90 يوماً</b> (أهداف للخطة لا ضمانات، وتعتمد على قرارات العميل واستجابة الجهات): لا مخالفات جديدة لثلاثة أشهر؛ وتوطين 21٪ فأكثر؛ والرخص والعقود 100٪؛ ولا ملاحظات حماية أجور."),
    ]
    need = [
        ("The authorisation letter attested by the Chamber of Commerce, and the type of delegated access on Qiwa, social insurance, Mudad and Muqeem (never passwords).", "خطاب التفويض مصدَّقاً من الغرفة التجارية، ونوع الوصول المفوَّض على قوى والتأمينات ومدد ومقيم (لا كلمات مرور)."),
        ("The correct renewal date of the Qiwa subscription and the status of the request to waive social-insurance penalties.", "تاريخ تجديد اشتراك قوى الصحيح وحالة طلب إعفاء غرامات التأمينات."),
        ("The residency and work-permit report for each worker, and the wages on the employment statement.", "تقرير الإقامات ورخص العمل لكل عامل، والأجور في بيان العمالة."),
        ("An explanation of the difference in sales roles between the employment statement and the Qiwa portal, and of the extra subscriber on the invoice.", "تفسير الفرق في وظائف المبيعات بين بيان العمالة وبوابة قوى، والمشترك الزائد في الفاتورة."),
        ("The Client’s hiring plan for Saudi employees (jobs and wages).", "خطة العميل لتوظيف السعوديين (المهن والأجور)."),
        ("The commercial registration documents, national address and municipal licence, and the text of the stability-support notice.", "مستندات السجل التجاري والعنوان الوطني ورخصة البلدية، ونص إشعار دعم استقرار المنشآت."),
    ]
    limits = [
        ("This summary is built from the data and screenshots the Client provided on 28 October 2026. No platform was accessed and nothing was submitted to any entity.", "بُني هذا الملخص من البيانات واللقطات التي قدّمها العميل في 28 أكتوبر 2026. ولم يُدخل أي منصة ولم يُقدَّم شيء لأي جهة."),
        ("Figures may change as the entities update their records, and each one is confirmed on the platform before any action. It is not a legal opinion and promises no outcome.", "قد تتغير الأرقام بتحديث الجهات لسجلاتها، ويُؤكَّد كل رقم على المنصة قبل أي إجراء. وليس رأياً قانونياً ولا يعد بأي نتيجة."),
    ]

    def numbered(title_en, title_ar, items):
        out = [G.blk(f'<div class="pre"><b>{title_en} / {title_ar}</b></div>', 28, keep=True)]
        for i, (en, ar) in enumerate(items, 1):
            out.append(G.blk(bl(i, en, ar, alt=i % 2 == 0), G.est_row(en, ar, 56, 16, title=False, pad=10), keep=(i == 1)))
        return out

    blocks = [G.blk('<table class="cl"><tr><td class="en"><b>Prepared for:</b> ' + CLIENT_EN + '<br><b>Data as of:</b> 28 October 2026 · aggregate figures only</td>'
                    '<td class="ar"><b>أُعدّ لـ:</b> ' + CLIENT_AR + '<br><b>البيانات حتى:</b> 28 أكتوبر 2026 · أرقام مجمّعة فقط' + RLM + '</td></tr></table>', 60)]
    blocks += fact_blocks("Establishment snapshot", "لمحة عن المنشأة", facts)
    blocks += fact_blocks("Status by entity", "الحالة أمام الجهات", status)
    blocks += fact_blocks("Violations (Tamm)", "المخالفات (تمام)", viol)
    blocks += fact_blocks("Near-term amounts due to government entities (not part of our price)", "المستحق القريب للجهات الحكومية (ليس من سعرنا)", cash)
    blocks += numbered("Priorities and indicative plan", "الأولويات والخطة التقديرية", plan)
    blocks += numbered("What we need from the establishment", "ما نحتاجه من المنشأة", need)
    blocks += numbered("Limits of this summary", "حدود هذا الملخص", limits)
    G.PORT_BUDGET = 720
    return G.port_doc("ملخص تقييم الامتثال", "Compliance Assessment Summary", blocks, doc_title="ملخص تقييم الامتثال · Compliance Assessment Summary")


# ------------------------------------------------------------------ الكتابة والتحويل إلى PDF
DOCS = {
    "quote": ("quote", build_quote, "land"),
    "contract": ("contract", build_contract, "port"),
    "nda": ("nda", build_nda, "port"),
    "terms": ("terms", build_terms, "port"),
    "authorization": ("authorization-letter", build_auth, "port"),
    "assessment": ("assessment-summary", build_assessment, "port"),
}


def write_html():
    out = {}
    for key, (name, fn, kind) in DOCS.items():
        G.PORT_BUDGET = 900 if key in ("contract", "terms", "authorization") else 820
        h = fn()
        h = h.replace("{{ASSETS}}", ASSETS_REL)
        if "</style>" in h and ".pt tr.tot" not in h:
            h = h.replace("</style>", EXTRA + "</style>", 1)
        (HERE / f"{name}.html").write_text(h, encoding="utf8")
        out[name] = HERE / f"{name}.html"
    return out


# --- بيانات الشركة تُحقن وقت البناء النهائي فقط (قرار المالك 2026-11-04): BP_BANK, BP_IBAN, BP_PHONE, BP_ADDRESS
BANK = os.environ.get("BP_BANK", "")
IBAN = os.environ.get("BP_IBAN", "")
PHONE = os.environ.get("BP_PHONE", "")


def inject_company(h):
    if PHONE:
        h = h.replace('Mobile / الجوال: <span class="num">[●]</span>', 'Mobile / الجوال: <span class="num">' + PHONE + '</span>')
    if BANK:
        h = h.replace('Bank / البنك: [●]', 'Bank / البنك: ' + BANK)
        h = h.replace('account at [●], IBAN [IBAN]', 'account at ' + BANK + ', IBAN [IBAN]')
        h = h.replace('لدى [●]، آيبان [IBAN]', 'لدى ' + BANK + '، آيبان [IBAN]')
    if IBAN:
        h = h.replace('[IBAN]', IBAN)
    return h


def pdf_input(path):
    """نسخة للتحويل: الخطوط مضمّنة محلياً ومسار الشعار مطلق، تُكتب خارج المستودع."""
    h = inject_company(path.read_text(encoding="utf8"))
    h = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', "", h)
    h = h.replace("<style>", "<style>" + font_css(), 1)
    h = h.replace(ASSETS_REL, str((LIB / "assets")))
    # حجم الورقة بالبكسل 1123/794 يزيد عن A4 بكسراً: نقصّ ارتفاع الصفحة بمقدار ضئيل لمنع صفحة فارغة
    h = h.replace("</style>", ".sheet.land{height:793px!important}.sheet.port{height:1122px!important}</style>", 1)
    return h


def render_pdfs(paths):
    fetch_fonts()
    PDF_DIR.mkdir(exist_ok=True)
    tmp = Path(os.environ.get("BP_TMP", "/tmp/bp-v2-build"))
    tmp.mkdir(parents=True, exist_ok=True)
    jobs = []
    for name, p in paths.items():
        f = tmp / f"{name}.html"
        f.write_text(pdf_input(p), encoding="utf8")
        jobs.append((str(f), str(PDF_DIR / f"{name}.pdf")))
    arg = "|".join(a + "=>" + b for a, b in jobs)
    r = subprocess.run(["node", str(HERE / "render_pdf.mjs"), arg], capture_output=True, text=True)
    print(r.stdout)
    if r.returncode:
        print(r.stderr, file=sys.stderr)
        sys.exit(r.returncode)


def main():
    paths = write_html()
    print("HTML:", ", ".join(p.name for p in paths.values()))
    if "--html" not in sys.argv:
        render_pdfs(paths)


if __name__ == "__main__":
    main()
