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
BADR = G.CEO_NAME          # قرار المالك 2026-11-04: العرض باسم د. باهر لا باسم بدر
BADR_T = G.CEO_TITLE

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
.fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}
.sheet.port table.cl td{font-size:9.4px;line-height:1.48;padding:4px 9px}
.sheet.port table.cl td b{font-size:10px}
.sl p.si{display:flex;gap:5px;align-items:flex-start;margin:0 0 2.5px 0}
.sl p.si .sn{flex:0 0 27px;min-width:0;font-size:9px;color:#0B1B5A;font-weight:700}
.sl p.si .tx{flex:1 1 auto}
.sl table.ct{font-size:9px;margin:3px 0 5px}.sl table.ct th,.sl table.ct td{padding:2px 5px}
.sl table.ct{width:100%;border-collapse:collapse;margin:4px 0 6px;font-size:10px}.sl table.ct th{background:#0B1B5A;color:#fff;padding:3px 6px;font-weight:700}.sl table.ct td{border:1px solid #DDE1EE;padding:3px 6px}.sl table.ct td.l{text-align:start}.sl table.ct td.c{text-align:center}
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
             ("Issued by / صادر عن", f"{G.CEO_EN} · <bdi dir=\"rtl\">{G.CEO_AR}</bdi>")]
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
         "موظف إضافي فوق 49 موظفاً", f"{n(EXTRA_EMP)} ريال سنوياً<br><span class=\"sm\">({n(EXTRA_EMP_Q)} ريالاً في كل فاتورة ربع سنوية)</span>"),
        ("Additional branch (the first branch, Riyadh, is included)", f"{n(EXTRA_BRANCH)} per year<br><span class=\"sm\">from receipt of its documents and authorisation</span>",
         "فرع إضافي (الفرع الأول، الرياض، مشمول)", f"{n(EXTRA_BRANCH)} ريال سنوياً<br><span class=\"sm\">تبدأ باستلام وثائق الفرع وتفويضه</span>"),
        ("Additional operation above the monthly limit", f"{n(OVERAGE)} per operation<br><span class=\"sm\">invoiced monthly</span>",
         "عملية إضافية فوق الحد الشهري", f"{n(OVERAGE)} ريالاً للعملية<br><span class=\"sm\">تُفوتَر شهرياً</span>"),
    ], ("Addition", "Rate (SAR)"), ("الإضافة", "السعر (قبل الضريبة)"))
    pages.append(p2)

    # ص3: الشمول + التصحيح والتأسيس
    scope = [
        ("Qiwa: work permits and employment contracts.", "قوى: رخص العمل وعقود العمل."),
        ("Social insurance (GOSI): subscription, invoices and certificate.", "التأمينات الاجتماعية: الاشتراك والفواتير والشهادة."),
        ("Organising the employees’ medical insurance and an alert before any violation.", "تنظيم التأمين الطبي للموظفين والتنبيه قبل أي مخالفة."),
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
        ("The commercial registration and its renewal, and zakat, tax and customs matters: not included; zakat and tax are handled with an independent accountant or for a separate fee.", "السجل التجاري وتجديده، والزكاة والضريبة والجمارك: غير مشمولة؛ والزكاة والضريبة مع محاسب مستقل أو برسوم منفصلة."),
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
        ("If a payment is late, the service stops 5 business days after written notice, and we hand the Client the platforms and documents we hold for it.", "عند التأخر في السداد تتوقف الخدمة بعد 5 أيام عمل من الإشعار الكتابي، ونسلّم العميل المنصات والمستندات التي بحوزتنا له."),
    ]
    terms = [
        ("This quotation is an updated offer and replaces in full our earlier offer of 1 November 2026.", "هذا العرض محدَّث ويحلّ بالكامل محل عرضنا السابق بتاريخ 1 نوفمبر 2026."),
        ("Valid for 14 days from its date; accepted by the Client’s signature; electronic signature is valid.", "ساري 14 يوماً من تاريخه، ويُقبل بتوقيع العميل، ويُعتدّ بالتوقيع الإلكتروني."),
        ("The service agreement, the Terms &amp; Conditions and the authorisation letter are attached; a signed service agreement prevails over this quotation.", "عقد الخدمة والشروط والأحكام وخطاب التفويض مرفقة؛ وعقد الخدمة الموقّع يسبق هذا العرض."),
        ("Confidentiality is under the Non-Disclosure Agreement; governed by the laws of the Kingdom of Saudi Arabia.", "السرية وفق اتفاقية عدم الإفصاح؛ ويخضع العرض لأنظمة المملكة العربية السعودية."),
        ("Data hosting and processing are on Microsoft Azure; any transfer of the Client’s data outside the Kingdom is made only with the Client’s written consent.", "استضافة البيانات ومعالجتها على Microsoft Azure؛ ولا يُنقل أي من بيانات العميل خارج المملكة إلا بموافقة العميل الكتابية."),
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
    return ("Subject", "موضوع العقد",
            ("STRUCT", [
                f'The First Party provides the Client with the {PKG_EN} (<span class="num">{SKU}</span>) of the {FAM_EN}, for one branch of the Client’s establishment (Riyadh) and up to 49 employees.',
                f'The First Party also provides the one-time {SETUP_EN} service.',
                "The services are detailed in the accepted quotation, which forms an integral part of this contract."]),
            ("STRUCT", [
                f'يقدّم الطرف الأول للعميل {PKG_AR} (<span class="num">{SKU}</span>) من {FAM_AR}، لفرع واحد من منشأة العميل (الرياض) وبحد أقصى 49 موظفاً.',
                f'ويقدّم الطرف الأول كذلك خدمة «{SETUP_AR}» لمرة واحدة.',
                "وتُفصَّل الخدمات في عرض السعر المقبول الذي يُعدّ جزءاً لا يتجزأ من هذا العقد."]))


def clause_services():
    return ("Included Services", "الخدمات المشمولة",
            ("STRUCT", [
                "The package covers Qiwa: work permits and employment contracts.",
                "Social insurance: subscription, invoices and certificate.",
                "Organising the employees’ medical insurance, with an alert before any violation.",
                "Mudad: the monthly wage-protection file and handling of notes.",
                "Nitaqat and localisation: a monthly calculation and an alert before any drop.",
                "Muqeem and Absher Business: residencies.",
                "A unified renewals calendar, a monthly report and a single point of contact.",
                "Monitoring of violations and deadlines on Tamm.",
                "Anything not listed is outside the package and is performed only under a written change request, priced separately."]),
            ("STRUCT", [
                "تشمل الباقة قوى: رخص العمل وعقود العمل.",
                "التأمينات الاجتماعية: الاشتراك والفواتير والشهادة.",
                "تنظيم التأمين الطبي للموظفين، والتنبيه قبل أي مخالفة.",
                "مدد: ملف حماية الأجور شهرياً ومعالجة الملاحظات.",
                "نطاقات والتوطين: حساب شهري وتنبيه قبل أي هبوط.",
                "مقيم وأبشر أعمال: الإقامات.",
                "تقويم موحّد للتجديدات وتقرير شهري ونقطة اتصال واحدة.",
                "رصد المخالفات والمهل على «تمام».",
                "وما لم يُذكر فهو خارج الباقة ولا يُنفَّذ إلا بطلب تغيير كتابي يُسعَّر على حدة."]))


def clause_limits():
    tl_en = _tbl(("Limit", "Package"), None, [
        ("Operations per month", "", [n(LIM["ops_m"])]), ("Operations per year", "", [n(LIM["ops_y"])]),
        ("Requests per month", "", [n(LIM["req_m"])]), ("Requests per day (maximum)", "", [n(LIM["req_d"])]),
        ("Alert to the Client", "", [f"at 80% of the monthly limit ({n(int(LIM['ops_m'] * LIM['alert']))} operations)"]),
        ("Price of an additional operation", "", [f"SAR {n(OVERAGE)}, before VAT"])])
    tl_ar = _tbl(("الحد", "الباقة"), None, [
        ("عمليات شهرياً", "", [n(LIM["ops_m"])]), ("عمليات سنوياً", "", [n(LIM["ops_y"])]),
        ("طلبات شهرياً", "", [n(LIM["req_m"])]), ("طلبات يومياً (حد أقصى)", "", [n(LIM["req_d"])]),
        ("تنبيه العميل", "", [f"عند 80٪ من الحد الشهري ({n(int(LIM['ops_m'] * LIM['alert']))} عملية)"]),
        ("سعر العملية الإضافية", "", [f"{n(OVERAGE)} ريالاً قبل الضريبة"])])
    en = [
        "The limits of the package are as follows:",
        ("TABLE", tl_en),
        "An operation is a transaction or action on a government platform (issue, renewal, amendment, attestation, file upload, or handling of a note or violation), counted once for each action, entity and worker or entity concerned.",
        "A request is what the Client submits to the First Party through the approved channel; enquiring about the status of an existing request is not an operation.",
        f"Automatic alerts, the monthly report, actions covered by the {SETUP_EN} fee and updates to the Client’s own data held by the First Party are not counted.",
        "Each operation is logged with a reference number and the Client is told the remaining limits.",
        "The Client is alerted at 80% of the monthly limit; beyond the limit, the price of an additional operation is shown before execution and the First Party proceeds only after the Client confirms.",
        f"An additional operation is SAR {n(OVERAGE)} before VAT, invoiced monthly with a statement of the operations.",
        "Requests above the daily maximum are scheduled for the next day unless an entity’s deadline requires otherwise.",
    ]
    ar = [
        "حدود الباقة كما يلي:",
        ("TABLE", tl_ar),
        "والعملية هي معاملة أو إجراء على منصة حكومية (إصدار أو تجديد أو تعديل أو توثيق أو رفع ملف أو معالجة ملاحظة أو مخالفة)، وتُحتسب مرة لكل إجراء وجهة وعامل أو كيان معني.",
        "والطلب هو ما يرفعه العميل إلى الطرف الأول عبر القناة المعتمدة، ولا يُعدّ الاستفسار عن حالة طلب قائم عملية.",
        f"ولا تُحتسب التنبيهات الآلية ولا التقرير الشهري ولا الإجراءات المشمولة في رسم «{SETUP_AR}» ولا تحديث بيانات العميل لدى الطرف الأول.",
        "وتُسجَّل كل عملية برقم مرجعي ويُبلَّغ العميل بالحدود المتبقية.",
        "وينبَّه العميل عند 80٪ من الحد الشهري؛ وما زاد على الحد يُعرض سعر العملية الإضافية قبل تنفيذها ولا يمضي الطرف الأول إلا بعد تأكيد العميل.",
        f"وسعر العملية الإضافية {n(OVERAGE)} ريالاً قبل الضريبة، وتُفوتَر شهرياً مع كشف بالعمليات.",
        "والطلبات الزائدة على الحد اليومي تُجدول لليوم التالي ما لم تقتضِ مهلة جهة غير ذلك.",
    ]
    return ("Operation Limits & Additional Operations", "حدود العمليات والعمليات الإضافية", ("STRUCT", en), ("STRUCT", ar))


def _tbl(head_en, head_ar, rows):
    """جدول صغير داخل البند: rows = [(label_en, label_ar, [cells])]."""
    h = '<table class="ct"><tr>' + "".join(f"<th>{x}</th>" for x in head_en) + "</tr>"
    for le, la, cells in rows:
        h += f'<tr><td class="l">{le}</td>' + "".join(f'<td class="c">{c}</td>' for c in cells) + "</tr>"
    return h + "</table>"


def clause_fees():
    rowsd = [
        ("Platform Setup & Remediation fee (one-time, on signature)", "رسم تصحيح المنصات والتأسيس (مرة واحدة، عند التوقيع)", SETUP),
        ("First quarterly instalment (on signature)", "الدفعة الربع سنوية الأولى (عند التوقيع)", QUARTER),
        ("Amount due on signature", "المستحق عند التوقيع", DUE_SIGN),
        ("Each of the three following quarterly instalments", "كل دفعة من الدفعات الربع سنوية الثلاث التالية", QUARTER),
        ("Total of the first year", "إجمالي السنة الأولى", FIRST_YEAR),
    ]
    te = _tbl(("Item", "Before VAT (SAR)", "VAT 15% (SAR)", "Total (SAR)"), None,
              [(a, b, [n(x), n(vat(x)), n(inc(x))]) for a, b, x in rowsd])
    ta = _tbl(("البند", "قبل الضريبة (ريال)", "الضريبة 15٪ (ريال)", "الإجمالي (ريال)"), None,
              [(b, a, [n(x), n(vat(x)), n(inc(x))]) for a, b, x in rowsd])
    en = [
        f"The annual fee of the package is SAR {n(ANNUAL)}, paid quarterly in advance in four instalments of SAR {n(QUARTER)}: the first on signature and the others at the start of each following quarter.",
        f"The one-time {SETUP_EN} fee is SAR {n(SETUP)}, payable on signature.",
        "All amounts are before 15% VAT, which is added. The fees and the amounts due are as follows:",
        ("TABLE", te),
        f"An employee above 49 is SAR {n(EXTRA_EMP)} per year (SAR {n(EXTRA_EMP_Q)} on each quarterly invoice), and each additional branch is SAR {n(EXTRA_BRANCH)} per year from the date its documents and authorisation are received.",
        "Payment is by bank transfer to the First Party’s account at [●], IBAN [IBAN], against a tax invoice.",
        "Government fees, fines and platform subscriptions are not included: they are invoiced separately and paid directly to the entity or supplier when the invoice is issued, with no percentage or fee to the First Party.",
    ]
    ar = [
        f"الرسم السنوي للباقة {n(ANNUAL)} ريال، يُدفع ربع سنوياً مقدماً على أربع دفعات قيمة كل منها {n(QUARTER)} ريال: الأولى عند التوقيع والباقي في بداية كل ربع تالٍ.",
        f"ورسم «{SETUP_AR}» لمرة واحدة {n(SETUP)} ريال يُدفع عند التوقيع.",
        "وكل المبالغ قبل ضريبة القيمة المضافة 15٪ التي تُضاف عليها. والرسوم والمبالغ المستحقة كما يلي:",
        ("TABLE", ta),
        f"والموظف فوق 49 بمبلغ {n(EXTRA_EMP)} ريال في السنة ({n(EXTRA_EMP_Q)} ريالاً على كل فاتورة ربع سنوية)، وكل فرع إضافي {n(EXTRA_BRANCH)} ريال في السنة من تاريخ استلام وثائقه وتفويضه.",
        "ويتم السداد بتحويل بنكي إلى حساب الطرف الأول لدى [●]، آيبان [IBAN]، مقابل فاتورة ضريبية.",
        "ولا تشمل الرسوم الحكومية ولا الغرامات ولا اشتراكات المنصات: تُفوتَر على حدة وتُدفع مباشرةً للجهة أو المورّد عند إصدار الفاتورة، دون أي نسبة أو أتعاب للطرف الأول.",
    ]
    return ("Prices, Payment & VAT", "الأسعار والدفع والضريبة", ("STRUCT", en), ("STRUCT", ar))


def clause_late():
    return C("Late Payment", "التأخر في السداد",
             "If a payment is not made when due, the First Party notifies the Client in writing. If the amount is still unpaid 5 business days after the notice, the service stops, and the First Party hands over to the Client "
             "the platforms it manages for the Client and the documents it holds, and removes any delegation it was given. Stopping the service does not cancel amounts already due. No late-payment interest applies.",
             "إن لم يُسدَّد مبلغ في موعده أشعر الطرف الأول العميل كتابةً. فإن بقي المبلغ غير مسدَّد بعد 5 أيام عمل من الإشعار توقفت الخدمة، وسلّم الطرف الأول للعميل المنصات التي يديرها له والمستندات التي بحوزته، "
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
             "large new services (establishing a new entity or branch, a new industrial licence, recruitment, transfer of services); the commercial registration and its renewal; government relations services (investment licensing, municipality, environmental and industrial licensing and renewals), which are quoted separately on request; zakat, tax and customs matters (filing, calculation and representation), "
             "which are handled with an independent accountant or for a separate fee; and any item not expressly listed in the quotation. Additional work is performed only under a written change request priced separately.",
             "لا يشمل السعر: الرسوم الحكومية والغرامات واشتراكات المنصات؛ وتكلفة توظيف السعوديين ورواتبهم؛ والتمثيل القضائي والمحاماة؛ "
             "والخدمات الكبيرة الجديدة (تأسيس منشأة أو فرع، ترخيص صناعي جديد، استقدام، نقل خدمات)؛ والسجل التجاري وتجديده؛ وخدمات العلاقات الحكومية (الاستثمار والبلدية والتراخيص البيئية والصناعية وتجديدها) وتُسعَّر منفصلة عند الطلب؛ والزكاة والضريبة والجمارك (الإعداد والإقرار والتمثيل) التي تُدار مع محاسب مستقل أو برسوم منفصلة؛ "
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



# ------------------------------------------------------------------ بنود مرقّمة (بند/فقرة) للعقد والشروط وعدم الإفصاح
_SPLIT_EN = re.compile(r'(?<=[.;])\s+(?=[A-Z“"(\u2018\u2019]|<span)')
_SPLIT_AR = re.compile(r'(?<=\.)[\u200f\u200e]*\s+')


def _items(x, en):
    """نص البند → قائمة فقرات: إمّا من قائمة جاهزة (STRUCT) أو بتقسيم الجمل."""
    if isinstance(x, tuple) and x and x[0] == "STRUCT":
        return list(x[1])
    x = x.strip()
    parts = _SPLIT_EN.split(x) if en else _SPLIT_AR.split(x)
    return [q for q in (p.strip() for p in parts) if q]


def _render_items(items, num, en, k0=0):
    out = ['<div class="sl">']
    k = k0
    for it in items:
        if isinstance(it, tuple) and it[0] == "TABLE":
            out.append(it[1])
            continue
        k += 1
        out.append(f'<p class="si"><b class="sn">{num}.{k}</b><span class="tx">{it}</span></p>')
    out.append("</div>")
    return "".join(out), k


BLOCK_SCALE = float(os.environ.get("BP_BLOCK_SCALE", "0.8"))   # معايرة تقدير ارتفاع البنود حتى تمتلئ الصفحات بلا تجاوز
MAXL = int(os.environ.get("BP_MAXL", "9"))   # أقصى عدد أسطر تقديرية في الكتلة الواحدة قبل التجزئة


def _lines(it):
    if isinstance(it, tuple) and it[0] == "TABLE":
        return 2 + it[1].count("<tr>") * 1.7
    return max(1, -(-len(re.sub(r"<[^>]+>", "", it)) // 50)) + 0.3


def numbered_clause_blocks(items, start=1):
    """كل بند يُجزَّأ إلى كتل صغيرة (العنوان مع أول كتلة) لتتدفق الفقرات على الصفحات بلا فراغات."""
    out = []
    for i, (t_en, t_ar, x_en, x_ar) in enumerate(items, start):
        ie, ia = _items(x_en, True), _items(x_ar, False)
        N = max(len(ie), len(ia))
        chunks, cur, acc = [], [], 0.0
        for j in range(N):
            le = _lines(ie[j]) if j < len(ie) else 0
            la = _lines(ia[j]) if j < len(ia) else 0
            h = max(le, la)
            if cur and acc + h > MAXL:
                chunks.append(cur); cur, acc = [], 0.0
            cur.append(j); acc += h
        if cur:
            chunks.append(cur)
        ke = ka = 0
        for ci, ch in enumerate(chunks):
            ce = [ie[j] for j in ch if j < len(ie)]
            ca = [ia[j] for j in ch if j < len(ia)]
            he, ke = _render_items(ce, i, True, ke)
            ha, ka = _render_items(ca, i, False, ka)
            lines = max(sum(_lines(x) for x in ce), sum(_lines(x) for x in ca))
            if ci == 0:
                html_ = G.row(i, t_en, he, t_ar, ha, alt=i % 2 == 0)
                lines += 1.4
            else:
                html_ = f'<table class="cl{" alt" if i % 2 == 0 else ""}"><tr><td class="en">{he}</td><td class="ar">{ha}</td></tr></table>'
            out.append(G.blk(html_, int((lines * G.PORT_LH + 10) * BLOCK_SCALE)))
    return out


# ------------------------------------------------------------------ العقد
def build_contract():
    seq = [clause_subject(), clause_services(), clause_limits(), clause_fees(), clause_late(), clause_term(), clause_setup()]
    seq += core_items([8, 9], EXT)
    seq += [clause_violations(), clause_local(), clause_excl()]
    seq += core_items([10], EXT)
    seq += core_items([11, 12, 13, 14, 15, 16, 17, 18], EXT)
    blocks = parties_blocks("Second Party (Client)", "الطرف الثاني (العميل)")
    blocks += numbered_clause_blocks(seq, start=2)
    blocks.append(G.blk(G.sig_pair(G.sig_box("First Party", "الطرف الأول", G.CEO_NAME, G.CEO_TITLE),
                                   sig_client("Second Party", "الطرف الثاني")), G.sig_h()))
    cover = G.cover_port("SERVICE AGREEMENT", "عقد خدمة", "Launch Package", "باقة الانطلاق",
                         f"{FAM_EN} · {SKU}", f"{FAM_AR} · {SKU}", cover_strip())
    return G.port_doc("عقد خدمة: باقة الانطلاق للامتثال والتوطين", "Service Agreement: Launch Package — Compliance &amp; Localization",
                      blocks, cover, None, "عقد خدمة · Service Agreement · باقة الانطلاق")


# ------------------------------------------------------------------ عدم الإفصاح
def build_nda():
    nda, core, cats = G.legal_core()
    blocks = parties_blocks("Second Party", "الطرف الثاني")
    blocks += numbered_clause_blocks([G.lc(x) for x in nda], start=2)
    blocks.append(G.blk(G.sig_pair(G.sig_box("First Party", "الطرف الأول", G.CEO_NAME, G.CEO_TITLE),
                                   sig_client("Second Party", "الطرف الثاني")), G.sig_h()))
    cover = G.cover_port("MUTUAL NON-DISCLOSURE AGREEMENT", "اتفاقية عدم إفصاح متبادلة", "Mutual Non-Disclosure Agreement",
                         "اتفاقية عدم إفصاح متبادلة", "Applies to all Business Partner services", "تسري على كل خدمات Business Partner", cover_strip())
    return G.port_doc("اتفاقية عدم إفصاح متبادلة", "Mutual Non-Disclosure Agreement", blocks, cover, None,
                      "اتفاقية عدم إفصاح · Mutual NDA")


# ------------------------------------------------------------------ الشروط والأحكام
def build_terms():
    seq = [
        ("Scope & Precedence", "النطاق وأسبقية الوثائق",
         ("STRUCT", [f"These terms apply to the {PKG_EN} ({FAM_EN}) quoted by Business Partner Solutions (the “First Party”) to the Client.",
                     "These terms form part of the accepted quotation.",
                     "If a service agreement is signed, it prevails over these terms."]),
         ("STRUCT", [f"تسري هذه الشروط على {PKG_AR} ({FAM_AR}) التي تعرضها شركة بزنس بارتنر سلوشنز («الطرف الأول») على العميل.",
                     "وتُعدّ هذه الشروط جزءاً من عرض السعر المقبول.",
                     "وإن وُقّع عقد خدمة فهو يسبق هذه الشروط."])),
        ("Quotation & Acceptance", "عرض السعر والقبول",
         ("STRUCT", ["A quotation is valid for 14 days from its date.",
                     "It is accepted by the Client’s signature on it; electronic signature is valid.",
                     "Work starts when the Client has provided the complete documents and the authorisation, and paid the amount due."]),
         ("STRUCT", ["يسري عرض السعر 14 يوماً من تاريخه.",
                     "ويُقبل بتوقيع العميل عليه، ويُعتدّ بالتوقيع الإلكتروني.",
                     "ويبدأ العمل عند تقديم العميل المستندات كاملة والتفويض وسداد المستحق."])),
    ]
    seq += [clause_fees()]
    seq += [clause_late(), clause_term(), clause_limits(), clause_setup()]
    seq += core_items([8, 9], EXT)
    seq += [clause_violations(), clause_local(), clause_excl()]
    seq += core_items([10, 11, 12, 13, 16, 17], EXT)
    seq += [C("Entire Terms", "كامل الشروط",
              "The Arabic version prevails in case of discrepancy. Amendments only in writing signed by both parties. Notices are sent to the addresses and e-mail addresses stated in the quotation and in this document.",
              "النسخة العربية هي المرجع عند الاختلاف. لا تُعدَّل هذه الشروط إلا كتابةً بموافقة الطرفين. وتُرسل الإشعارات إلى العناوين والبريد الإلكتروني المذكورة في عرض السعر وفي هذه الوثيقة.")]
    blocks = [G.blk('<table class="cl"><tr><td class="en"><b>Date:</b> <span class="num">[●]</span></td><td class="ar"><b>التاريخ:</b> <span class="num">[●]</span></td></tr></table>', 26)]
    blocks += numbered_clause_blocks(seq)
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

    blocks = [G.blk('<table class="cl"><tr><td class="en"><b>Prepared for:</b> ' + CLIENT_EN + '<br><b>Date:</b> <span class="num">[●]</span><br><b>Data as of:</b> 28 October 2026 · aggregate figures only</td>'
                    '<td class="ar"><b>أُعدّ لـ:</b> ' + CLIENT_AR + '<br><b>التاريخ:</b> <span class="num">[●]</span><br><b>البيانات حتى:</b> 28 أكتوبر 2026 · أرقام مجمّعة فقط' + RLM + '</td></tr></table>', 60)]
    blocks += fact_blocks("Establishment snapshot", "لمحة عن المنشأة", facts)
    blocks += fact_blocks("Status by entity", "الحالة أمام الجهات", status)
    blocks += fact_blocks("Violations (Tamm)", "المخالفات (تمام)", viol)
    blocks += fact_blocks("Near-term amounts due to government entities (not part of our price)", "المستحق القريب للجهات الحكومية (ليس من سعرنا)", cash)
    blocks += numbered("Priorities and indicative plan", "الأولويات والخطة التقديرية", plan)
    blocks += numbered("What we need from the establishment", "ما نحتاجه من المنشأة", need)
    blocks += numbered("Limits of this summary", "حدود هذا الملخص", limits)
    G.PORT_BUDGET = 720
    return G.port_doc("ملخص تقييم الامتثال", "Compliance Assessment Summary", blocks, doc_title="ملخص تقييم الامتثال · Compliance Assessment Summary")


# ------------------------------------------------------------------ التقييم الشامل (للعميل؛ أرقام مجمّعة من لقطات العميل وبياناته، بلا هويات)
FULL_CSS = """
table.mt{direction:ltr;table-layout:fixed;margin:4px 0 6px;font-size:9.8px}
table.mt th,table.mt td{padding:3px 6px;line-height:1.45}
table.mt td.en{direction:ltr;text-align:left}table.mt td.ar{direction:rtl;text-align:right}
table.mt th.en{text-align:left}table.mt th.ar{direction:rtl;text-align:right}
table.mt td.c,table.mt th.c{text-align:center}
table.mt tr.tot td{background:#EEF1FB;font-weight:700;color:#0B1B5A}
table.mt td.gp,table.mt th.gp{border:0;background:none;padding:0}
.kp{display:flex;gap:6px;direction:ltr;margin:6px 0 4px}
.kp>div{flex:1;background:#F2F4FB;border:1px solid #DDE1EE;border-top:3px solid #0B1B5A;padding:5px 7px;text-align:center;line-height:1.35}
.kp .v{display:block;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;color:#0B1B5A;direction:ltr}
.kp .l{display:block;font-size:8.6px;color:#4A5578}
.ph{margin:7px 0 2px;direction:ltr;display:flex;justify-content:space-between;background:#EEF1FB;border-inline-start:3px solid #1E3A9E;padding:3px 9px;color:#0B1B5A;font-size:11.2px}
.mt0{font-size:9.4px;color:#4A5578;display:block;margin-top:3px}
"""


def _plain(s):
    return re.sub(r"<[^>]+>", "", s).replace("&amp;", "&").replace("&nbsp;", " ")


def _seg_lines(s, cpl):
    return sum(max(1, -(-len(_plain(p)) // cpl)) for p in re.split(r"<br\s*/?>|<span class=\"mt0\">", s))


FULL_CPL_EN, FULL_CPL_AR, FULL_LH, FULL_PAD = 68, 58, 16.4, 11
FULL_SCALE = float(os.environ.get("BP_FULL_SCALE", "1.0"))


def _pt_h(en, ar):
    return int((max(_seg_lines(en, FULL_CPL_EN), _seg_lines(ar, FULL_CPL_AR)) * FULL_LH + FULL_PAD) * FULL_SCALE)


def _bk(html_, h, keep=False):
    return G.blk(f'<div class="bk" data-e="{h}">{html_}</div>', h, keep=keep)


def f_head(num_, en, ar):
    return _bk('<div class="bp">' + sec(num_, en, ar) + "</div>", 54 if len(en) > 48 else 40, keep=True)


def f_point(num_, en, ar, alt=False, keep=False):
    return _bk(bl(num_, en, ar, alt=alt), _pt_h(en, ar), keep=keep)


def f_phase(en, ar):
    return _bk(f'<div class="ph"><b>{en}</b><b dir="rtl">{ar}</b></div>', 28, keep=True)


def f_kpis(items):
    tiles = "".join(f'<div><span class="v">{v}</span><span class="l">{le}<br><span dir="rtl">{la}</span></span></div>' for v, le, la in items)
    return _bk(f'<div class="kp">{tiles}</div>', 70)


def mt(head, widths, rows, tot=()):
    """جدول ثنائي اللغة بعرض الصفحة: أعمدة الإنجليزي يساراً ثم فاصل ثم أعمدة العربي معكوسة يميناً.
    head = (heads_en, heads_ar)؛ rows = [(cells_en, cells_ar)] بترتيب منطقي (العمود الأول هو الأقرب للهامش الخارجي)؛ widths لجانب واحد (مجموعها 49)."""
    he, ha = head
    cg = "".join(f'<col style="width:{w}%">' for w in widths)
    h = f'<table class="pt mt"><colgroup>{cg}<col style="width:2%">{"".join(f"<col style=\"width:{w}%\">" for w in reversed(widths))}</colgroup>'
    h += "<tr>" + "".join(f'<th class="en{" c" if i else ""}">{x}</th>' for i, x in enumerate(he)) + '<th class="gp"></th>'
    h += "".join(f'<th class="ar{" c" if i else ""}">{x}</th>' for i, x in reversed(list(enumerate(ha)))) + "</tr>"
    est = 22
    for ri, (ce, ca) in enumerate(rows):
        cls = ' class="tot"' if ri in tot else ""
        h += f"<tr{cls}>" + "".join(f'<td class="en{" c" if i else ""}">{x}</td>' for i, x in enumerate(ce)) + '<td class="gp"></td>'
        h += "".join(f'<td class="ar{" c" if i else ""}">{A(x)}</td>' for i, x in reversed(list(enumerate(ca)))) + "</tr>"
        lines = 1
        for i, (x, y) in enumerate(zip(ce, ca)):
            lines = max(lines, _seg_lines(x, max(6, int(FULL_CPL_EN * 1.0 * widths[i] / 49 * 0.93))), _seg_lines(y, max(6, int(FULL_CPL_AR * widths[i] / 49 * 0.93))))
        est += lines * 14.4 + 7
    return _bk(h + "</table>", int((est * 1.08 + 10) * FULL_SCALE))


def _measure_blocks(blocks):
    """يقيس الارتفاع الفعلي لكل كتلة في Chromium (يستبدل التقدير)؛ عند تعذّر القياس يبقى التقدير."""
    if os.environ.get("BP_NOMEASURE"):
        return blocks
    try:
        fetch_fonts()
        tmp = Path(os.environ.get("BP_TMP", "/tmp/bp-v2-build"))
        tmp.mkdir(parents=True, exist_ok=True)
        inner = "".join(b["html"] for b in blocks)
        h = G.document("m", "port", [f'<section class="sheet port" lang="ar" style="height:auto"><div dir="rtl">{inner}</div></section>'])
        h = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', "", h)
        h = h.replace("<style>", "<style>" + font_css(), 1).replace("</style>", FULL_CSS + EXTRA + ".sheet.port{height:auto!important;overflow:visible!important}</style>", 1)
        h = h.replace("{{ASSETS}}", str(LIB / "assets"))
        src, out = tmp / "measure.html", tmp / "measure.json"
        src.write_text(h, encoding="utf8")
        r = subprocess.run(["node", str(HERE / "measure_blocks.mjs"), str(src), str(out)], capture_output=True, text=True, timeout=120)
        if r.returncode:
            return blocks
        import json
        hs = json.loads(out.read_text())
        if len(hs) != len(blocks):
            return blocks
        for b, x in zip(blocks, hs):
            b["h"] = x
    except Exception:
        pass
    return blocks


def build_assessment_full():
    k = G.num
    ar_pc = lambda x: k(f"{x}٪")
    assert 17 + 1 + 4 == 22 and 24000 + 7000 + 1200 == 32200 and 32200 + 1000 == 33200
    assert 10000 + 10000 + 10000 + 4000 == 34000 and 6 * 4000 == 24000 and 7 * 1000 == 7000 and 4 * 300 == 1200
    assert round(68066.32 + 16593.13, 2) == 84659.45 and round(16593.13 * 0.25, 2) == 4148.28
    assert round(33200 + 2248.25 + 2919.29, 2) == 38367.54
    assert 27 + 19 + 2 + 1 + 1 == 50
    assert round(5 / 31 * 100, 1) == 16.1 and round(2 / 28 * 100, 2) == 7.14
    # عدد السعوديين المحتسبين اللازم لبلوغ 21٪ و28٪ مع 26 غير سعودي محتسباً (تقريبي)
    import math
    need21 = math.ceil(0.21 * 26 / 0.79)
    need28 = math.ceil(0.28 * 26 / 0.72)
    assert (need21, need28) == (7, 11) and (need21 - 2, need28 - 2) == (5, 9)

    B = []
    meta = ('<table class="cl"><tr><td class="en"><b>Prepared for:</b> ' + CLIENT_EN + '<br><b>Date:</b> <span class="num">[●]</span><br>'
            '<b>Data as of:</b> 28 October 2026 · aggregate figures from the Client’s own data and screenshots</td>'
            '<td class="ar"><b>أُعدّ لـ:</b> ' + CLIENT_AR + '<br><b>التاريخ:</b> <span class="num">[●]</span><br>'
            '<b>البيانات حتى:</b> 28 أكتوبر 2026 · أرقام مجمّعة من بيانات العميل ولقطاته' + RLM + '</td></tr></table>')
    B.append(_bk(meta, 76))

    # ---------------------------------------------------------------- 1
    B.append(f_head(1, "Executive summary and priorities", "الملخص التنفيذي والأولويات"))
    B.append(f_kpis([
        (k("7.14%"), "Nitaqat: red band", "نطاقات: النطاق الأحمر"),
        (k("57%"), "Qiwa compliance", "الالتزام في قوى"),
        (k("32,200"), "17 unpaid violations (SAR)", "17 مخالفة غير مسددة (ريال)"),
        (k("84,659.45"), "Unpaid social insurance (SAR)", "التأمينات غير المسددة (ريال)"),
        (k("38,367.54"), "Near-term amounts due (SAR)", "المستحق القريب (ريال)"),
    ]))
    s1 = [
        ("This report sets out the position of the Client’s establishment before the government platforms, as it appears from the data and screenshots the Client provided on 28 October 2026. It ranks the risks and proposes a corrective plan in phases.",
         "يعرض هذا التقرير وضع منشأة العميل أمام المنصات الحكومية كما يظهر من البيانات واللقطات التي قدّمها العميل في 28 أكتوبر 2026، ويرتّب المخاطر، ويقترح خطة تصحيحية على مراحل."),
        (f"The establishment is in the red Nitaqat band at {k('7.14%')} (the red band covers {k('0–21%')}). Qiwa shows overall compliance of {k('57%')}, which is not compliant. Tamm shows {k(17)} unpaid violations totalling {k('32,200')} SAR, plus one violation of {k('1,000')} SAR transferred to the enforcement platform.",
         f"المنشأة في النطاق الأحمر في نطاقات بنسبة {ar_pc('7.14')} (النطاق الأحمر من {k('0–21٪')}). وتُظهر قوى التزاماً عاماً بنسبة {ar_pc(57)}، أي غير ملتزمة. وتُظهر «تمام» {k(17)} مخالفة غير مسددة بمجموع {k('32,200')} ريال، إضافة إلى مخالفة واحدة بقيمة {k('1,000')} ريال مرحّلة إلى منصة التنفيذ."),
        (f"The largest group of violations ({k(6)} violations, {k('24,000')} SAR, about three quarters of the unpaid total) concerns localisation of sales professions, where {k(2)} Saudi employees are required and {k(0)} are counted. The same position stands today, so further violations may be issued until it is corrected.",
         f"أكبر مجموعة مخالفات ({k(6)} مخالفات بمبلغ {k('24,000')} ريال، أي نحو ثلاثة أرباع غير المسدد) تتعلق بتوطين مهن المبيعات، المطلوب فيها {k(2)} سعوديان والمحتسب {k(0)}. والوضع نفسه قائم اليوم، فقد تصدر مخالفات أخرى إلى أن يُصحَّح."),
        (f"Social insurance shows an unpaid balance of {k('84,659.45')} SAR (contributions {k('68,066.32')} and penalties {k('16,593.13')}) under an instalment plan of {k(30)} instalments, of which one is paid.",
         f"تُظهر التأمينات الاجتماعية رصيداً غير مسدد قدره {k('84,659.45')} ريال (اشتراكات {k('68,066.32')} وغرامات {k('16,593.13')}) ضمن خطة تقسيط من {k(30)} قسطاً سُدد منها قسط واحد."),
        (f"Dated items: the Qiwa group subscription ({k('2,248.25')} SAR) before 11 November 2026, the social-insurance instalment ({k('2,919.29')} SAR) on 17 November 2026, and the instalment certificate, valid until 16/06/1448H (about 27 November 2026). With the violations, the near-term amounts due to entities total {k('38,367.54')} SAR; they are paid to the entities and are not part of our fees.",
         f"بنود لها مواعيد: اشتراك المجموعة في قوى ({k('2,248.25')} ريال) قبل 11 نوفمبر 2026، وقسط التأمينات ({k('2,919.29')} ريال) في 17 نوفمبر 2026، وشهادة التقسيط السارية حتى 16/06/1448هـ (نحو 27 نوفمبر 2026). وبإضافة المخالفات يبلغ المستحق القريب للجهات {k('38,367.54')} ريال؛ وهي تُدفع للجهات وليست من أتعابنا."),
        ("The Client’s screenshots show a note on the establishment-stability support programme. We have not seen its text, issuer or date. The official procedure for lifting it, and what the Ministry requires, are to be confirmed with the Ministry.",
         "تُظهر لقطات العميل ملاحظة على برنامج دعم استقرار المنشآت. ولم نطّلع على نصها ولا على جهتها وتاريخها. والإجراء الرسمي لرفعها وما تطلبه الوزارة لذلك يُؤكَّدان مع الوزارة."),
        ("Items marked “to be confirmed” were not verifiable from the data provided. They are confirmed on the platform or with the entity before any action, and are never assumed.",
         "البنود الموسومة «يُؤكَّد» لم يمكن التحقق منها من البيانات المقدّمة. وتُؤكَّد على المنصة أو مع الجهة قبل أي إجراء، ولا تُفترض."),
    ]
    for i, (en, ar) in enumerate(s1, 1):
        if i == 2:
            B.append(f_phase("Recommended order of priorities", "ترتيب الأولويات المقترح"))
            B.append(mt((["#", "Priority", "Who"], ["#", "الأولوية", "الجهة"]), [4, 29, 16], [
                (["1", "Stop new violations: settle the position of the sales professions", "Client; Business Partner"],
                 ["1", "إيقاف المخالفات الجديدة: حسم وضع مهن المبيعات", "العميل؛ Business Partner"]),
                (["2", "Meet the dated payments on Qiwa and social insurance", "Client"],
                 ["2", "الوفاء بالمدفوعات ذات المواعيد في قوى والتأمينات", "العميل"]),
                (["3", "Study, violation by violation, the route available (payment, objection or settlement) against its notification date", "Business Partner; Client approves"],
                 ["3", "دراسة المسار المتاح لكل مخالفة (سداد أو اعتراض أو تسوية) على ضوء تاريخ تبليغها", "Business Partner؛ والعميل يوافق"]),
                (["4", "Correct work permits, contracts and wage-protection notes", "Client; Business Partner"],
                 ["4", "تصحيح رخص العمل والعقود وملاحظات حماية الأجور", "العميل؛ Business Partner"]),
                (["5", "Plan the exit from the red band through genuine Saudi hiring", "Client; Business Partner"],
                 ["5", "تخطيط الخروج من النطاق الأحمر بتوظيف سعودي فعلي", "العميل؛ Business Partner"]),
                (["6", "Extract residency data and set a renewals calendar", "Business Partner"],
                 ["6", "استخراج بيانات الإقامات ووضع تقويم تجديدات", "Business Partner"]),
            ]))
        B.append(f_point(f"1.{i}", en, ar, alt=i % 2 == 0))

    # ---------------------------------------------------------------- 2
    B.append(f_head(2, "Establishment snapshot", "لمحة عن المنشأة"))
    B.append(mt((["Item", "Reading"], ["البند", "القراءة"]), [17, 32], [
        (["Type and size", "Company; small establishment, category B (21–49 workers), Riyadh"], ["النوع والحجم", "شركة؛ منشأة صغيرة (فئة ب: من 21 إلى 49 عاملاً)، الرياض"]),
        (["Activity (as on Qiwa)", "Manufacture of organic solvents, thinners and paint-removal preparations"], ["النشاط (كما في قوى)", "صناعة المذيبات والمخففات العضوية ومحضرات إزالة الدهانات"]),
        (["Stage on Qiwa", f"“Expansion”; recruitment balance {k(26)} used / {k(0)} current; no visas"], ["المرحلة في قوى", f"«توسع»؛ رصيد الاستقطاب {k(26)} مستخدم / {k(0)} حالي؛ لا تأشيرات"]),
        (["Workforce on the employment statement", f"{k(31)} workers: {k(5)} Saudi ({k('16.1%')}) and {k(26)} non-Saudi"], ["العمالة في بيان العمالة", f"{k(31)} عاملاً: {k(5)} سعوديون ({k('16.1٪')}) و{k(26)} غير سعوديين"]),
        (["Active social-insurance subscriptions", f"{k(29)}: {k(3)} Saudi and {k(26)} non-Saudi"], ["الاشتراكات النشطة في التأمينات", f"{k(29)}: {k(3)} سعوديون و{k(26)} غير سعوديين"]),
        (["Counted in Nitaqat", f"{k(28)}: {k(2)} Saudi and {k(26)} non-Saudi"], ["المحتسبون في نطاقات", f"{k(28)}: {k(2)} سعوديان و{k(26)} غير سعوديين"]),
        (["Nitaqat band and rate", f"Red; {k('7.14%')} (red band {k('0–21%')}); the portal also shows a period of {k(8)} weeks, whose meaning is to be confirmed"], ["النطاق والنسبة", f"أحمر؛ {k('7.14٪')} (النطاق الأحمر {k('0–21٪')})؛ وتُظهر البوابة أيضاً مدة {k(8)} أسابيع يُؤكَّد معناها"]),
        (["Branches stated in the documents provided", "Riyadh, Al-Zulfi, Sakaka and Arar"], ["الفروع المذكورة في المستندات المقدّمة", "الرياض والزلفي وسكاكا وعرعر"]),
    ]))
    s2 = [
        ("The Launch Package covers one branch (Riyadh); additional branches are added under the terms of the Agreement. The distribution of workers across the four branches, and their registration on Qiwa and social insurance, are to be confirmed; they may also explain the difference in sales roles noted in section 5.",
         "تشمل باقة الانطلاق فرعاً واحداً (الرياض)، وتُضاف الفروع الأخرى وفق شروط العقد. وتوزيع العمالة على الفروع الأربعة وتسجيلها في قوى والتأمينات يُؤكَّدان؛ وقد يفسّران كذلك الفرق في وظائف المبيعات المذكور في البند 5."),
        (f"The group subscription on Qiwa suggests that more than one establishment may be covered. The number of establishments, and who is authorised on each, are to be confirmed.",
         "يوحي «اشتراك المجموعة» في قوى بأن أكثر من منشأة قد تكون مشمولة. وعدد المنشآت ومن هو المفوّض على كل منها يُؤكَّدان."),
        (f"Data quality: the employment statement has {k(36)} rows for {k(31)} distinct identities (some repeated), {k(22)} of the {k(36)} rows lack a birth date, and {k(3)} identities are in a non-standard format. The statement is cleaned before any upload or submission.",
         f"جودة البيانات: يضم بيان العمالة {k(36)} صفاً لـ{k(31)} هوية مختلفة (بعضها مكرر)، ويفتقر {k(22)} من الصفوف الـ{k(36)} إلى تاريخ الميلاد، و{k(3)} هويات بصيغة غير قياسية. وينظَّف البيان قبل أي رفع أو تقديم."),
        (f"The employment statement lists {k(5)} Saudi employees, {k(3)} of them with an active social-insurance subscription and {k(2)} counted in Nitaqat. The reason for each difference is to be confirmed with the entity.",
         f"يُدرج بيان العمالة {k(5)} موظفين سعوديين، منهم {k(3)} باشتراك نشط في التأمينات و{k(2)} محتسبان في نطاقات. وسبب كل فرق يُؤكَّد مع الجهة."),
    ]
    for i, (en, ar) in enumerate(s2, 1):
        B.append(f_point(f"2.{i}", en, ar, alt=i % 2 == 0))

    # ---------------------------------------------------------------- 3
    B.append(f_head(3, "Status by entity and platform", "الحالة أمام الجهات والمنصات"))
    B.append(f_phase("3.1 Qiwa — indicators on the Client’s screenshots", "3.1 قوى — المؤشرات في لقطات العميل"))
    ok_e, no_e, at_e = "Met", "Not met", "Attention"
    ok_a, no_a, at_a = "مستوفٍ", "غير مستوفٍ", "يحتاج متابعة"
    B.append(mt((["Indicator", "Reading", "Status"], ["المؤشر", "القراءة", "الحالة"]), [15, 22, 12], [
        (["Overall compliance", f"{k('57%')}, not compliant", no_e], ["الالتزام العام", f"{ar_pc(57)}، غير ملتزمة", no_a]),
        (["Work-permit validity", f"{k('92%')}; {k(2)} expired; {k(1)} worker without a contract", no_e], ["صلاحية رخص العمل", f"{ar_pc(92)}؛ {k(2)} منتهية؛ عامل واحد بلا عقد", no_a]),
        (["Contract documentation", k("93%"), ok_e], ["توثيق العقود", ar_pc(93), ok_a]),
        (["Location assignment", k("100%"), ok_e], ["تعيين المواقع", ar_pc(100), ok_a]),
        (["Wage-protection notes", f"not compliant; {k(7)} violations", no_e], ["ملاحظات حماية الأجور", f"غير ملتزمة؛ {k(7)} مخالفات", no_a]),
        (["Nitaqat", f"{k('7.14%')}, red band", no_e], ["نطاقات", f"{ar_pc('7.14')}، النطاق الأحمر", no_a]),
        (["Localisation of sales professions", f"required {k(2)}, actual {k(0)}", no_e], ["توطين مهن المبيعات", f"مطلوب {k(2)}، فعلي {k(0)}", no_a]),
        (["Group subscription", f"ends soon; renewal {k('2,248.25')} SAR", at_e], ["اشتراك المجموعة", f"ينتهي قريباً؛ التجديد {k('2,248.25')} ريال", at_a]),
    ]))
    s31 = [
        ("Qiwa subscription: the screenshot gives 11 November 2026 as the date up to which the renewal amount is valid, while the text on the same screen (“12 days”) points to about 9 November. We recommend paying by 9 November, and the correct date is confirmed on the platform.",
         "اشتراك قوى: تذكر اللقطة 11 نوفمبر 2026 تاريخاً لصلاحية مبلغ التجديد، بينما يشير النص على الشاشة نفسها («12 يوماً») إلى نحو 9 نوفمبر. ونوصي بالسداد قبل 9 نوفمبر، ويُؤكَّد التاريخ الصحيح على المنصة."),
        (f"Employment contracts on Qiwa: {k(50)} rows covering {k(47)} identities, all full-time. Valid: {k(27)}; ended by termination: {k(19)}; cancelled by the establishment: {k(2)}; expired: {k(1)}; cancelled automatically: {k(1)}.",
         f"عقود العمل في قوى: {k(50)} صفاً تغطي {k(47)} هوية، جميعها دوام كامل. الساري {k(27)}؛ والمنتهي بإنهاء {k(19)}؛ والملغي من المنشأة {k(2)}؛ والمنتهي {k(1)}؛ والملغي تلقائياً {k(1)}."),
        (f"Matching with the employment statement: {k(26)} of the {k(27)} valid contracts match the statement and one valid contract is outside it (to be confirmed). {k(5)} workers on the statement have no valid contract: {k(2)} Saudi and {k(3)} non-Saudi. Valid contracts cover {k(3)} of the {k(5)} Saudi employees, and {k(8)} valid contracts were last updated before January 2026 (to be confirmed).",
         f"المطابقة مع بيان العمالة: {k(26)} من العقود السارية الـ{k(27)} تطابق البيان، وعقد ساري واحد خارج البيان (يُؤكَّد). و{k(5)} عمال في البيان بلا عقد ساري: سعوديان و{k(3)} غير سعوديين. وتغطي العقود السارية {k(3)} من الموظفين السعوديين الخمسة، وآخر تحديث لـ{k(8)} عقود سارية قبل يناير 2026 (يُؤكَّد). "),
        ("Where a worker without a valid contract is in fact working, the contract is documented; where the worker has left, the statement is updated through the lawful route.",
         "حيث يعمل فعلاً عامل بلا عقد ساري يُوثَّق عقده؛ وحيث غادر العامل يُحدَّث البيان بالطريق النظامي."),
    ]
    for i, (en, ar) in enumerate(s31, 1):
        B.append(f_point(f"3.1.{i}", en, ar, alt=i % 2 == 0))

    B.append(f_phase("3.2 Social insurance (GOSI)", "3.2 التأمينات الاجتماعية"))
    B.append(mt((["Item", "Reading (SAR where an amount)"], ["البند", "القراءة (بالريال حيث يوجد مبلغ)"]), [19, 30], [
        (["Active subscriptions", f"{k(29)}: {k(3)} Saudi and {k(26)} non-Saudi"], ["الاشتراكات النشطة", f"{k(29)}: {k(3)} سعوديون و{k(26)} غير سعوديين"]),
        (["Unpaid balance (28 Oct 2026)", f"{k('84,659.45')} = contributions {k('68,066.32')} + penalties {k('16,593.13')}"], ["غير المسدد (28 أكتوبر 2026)", f"{k('84,659.45')} = اشتراكات {k('68,066.32')} + غرامات {k('16,593.13')}"]),
        (["Current instalment plan", f"{k(30)} instalments of {k('2,919.29')}; one paid; next on 17 Nov 2026; plan value as shown {k('87,578.74')}"], ["خطة التقسيط الحالية", f"{k(30)} قسطاً بقيمة {k('2,919.29')}؛ سُدد قسط واحد؛ والتالي في 17 نوفمبر 2026؛ وقيمة الخطة كما تظهر {k('87,578.74')}"]),
    ]))
    B.append(mt((["Item", "Reading (SAR where an amount)"], ["البند", "القراءة (بالريال حيث يوجد مبلغ)"]), [19, 30], [
        (["Earlier plan (Aug 2024 – Jan 2027)", f"paid {k(0)}; remaining {k('16,225.10')}; status to be confirmed"], ["خطة سابقة (أغسطس 2024 – يناير 2027)", f"المسدد {k(0)}؛ المتبقي {k('16,225.10')}؛ وحالتها تُؤكَّد"]),
        (["Penalty waiver", f"{k('25%')} of penalties shown as eligible = {k('4,148.28')}; status of any request to be confirmed"], ["إعفاء الغرامات", f"{ar_pc(25)} من الغرامات ظاهرة كمؤهلة = {k('4,148.28')}؛ وحالة أي طلب تُؤكَّد"]),
        (["Instalment certificate", "dated 28 Oct 2026; valid until 16/06/1448H (about 27 Nov 2026)"], ["شهادة التقسيط", "بتاريخ 28 أكتوبر 2026؛ سارية حتى 16/06/1448هـ (نحو 27 نوفمبر 2026)"]),
        (["Earlier social-insurance violations", f"{k(4)}, all paid; no action"], ["مخالفات التأمينات السابقة", f"{k(4)}، جميعها مسددة؛ لا إجراء"]),
    ]))
    s32 = [
        (f"The certificate states that the establishment pays its debt in instalments and that the plan is regular; it covers the {k(29)} active subscribers and not suspended subscribers, and the employer-name field on it is blank. It is renewed before it expires. The effect of a missed instalment on the certificate is to be confirmed with social insurance.",
         f"تفيد الشهادة بأن المنشأة تسدد مديونيتها بالتقسيط وأن الخطة منتظمة؛ وهي تشمل {k(29)} مشتركاً نشطاً دون المشتركين المعلّقين، وحقل اسم صاحب العمل فيها فارغ. وتُجدَّد قبل انتهائها. وأثر التأخر عن قسط على الشهادة يُؤكَّد مع التأمينات."),
        (f"Thirteen invoices still appear unpaid although a plan exists, and the September 2026 invoice includes one extra subscriber with a wage of {k(800)}. The relationship between the invoices and the plan, and the reason for the extra subscriber, are to be confirmed.",
         f"ما زالت {k(13)} فاتورة تظهر غير مسددة رغم وجود خطة، وتتضمن فاتورة سبتمبر 2026 مشتركاً زائداً بأجر {k(800)}. والعلاقة بين الفواتير والخطة وسبب المشترك الزائد يُؤكَّدان."),
    ]
    for i, (en, ar) in enumerate(s32, 1):
        B.append(f_point(f"3.2.{i}", en, ar, alt=i % 2 == 0))

    s33 = [
        ("3.3 Mudad (wage protection). ", "3.3 مدد (حماية الأجور). ",
         f"No Mudad data was provided. Qiwa shows the wage-protection indicator as not compliant, and Tamm shows {k(7)} wage-protection violations for the months September 2025 to August 2026 and {k(4)} violations for late payment of wages (13 October 2025). Whether Mudad is activated and the monthly file is uploaded at the required compliance rate is to be confirmed.",
         f"لم تُقدَّم بيانات من مدد. وتُظهر قوى مؤشر حماية الأجور غير ملتزم، وتُظهر «تمام» {k(7)} مخالفات حماية أجور عن الأشهر من سبتمبر 2025 إلى أغسطس 2026 و{k(4)} مخالفات تأخر في دفع الأجور (13 أكتوبر 2025). وهل مدد مفعّلة والملف الشهري مرفوع بنسبة الامتثال المطلوبة يُؤكَّد."),
        ("3.4 Muqeem and Absher Business (residencies). ", "3.4 مقيم وأبشر أعمال (الإقامات). ",
         "The sources provided contain no residency dates, so the residencies cannot be assessed and no conclusion is drawn about any of them. The residency report is extracted from Muqeem or Qiwa after authorisation, and those ending soon are listed with a renewals calendar.",
         "لا تتضمن المصادر المقدّمة تواريخ إقامات، فلا يمكن تقييم الإقامات ولا نستخلص حكماً عن أي منها. ويُستخرج تقرير الإقامات من مقيم أو قوى بعد التفويض، وتُدرج المنتهية قريباً في تقويم تجديدات."),
        ("3.5 Medical insurance. ", "3.5 التأمين الطبي. ",
         "No medical-insurance data appears in the data provided, so the current position is to be confirmed: provider, number of insured workers and expiry. The Client’s work regulations (Article 33) refer to medical insurance for all workers, and the package includes organising the employees’ medical insurance.",
         "لا تظهر بيانات للتأمين الطبي في البيانات المقدّمة، فيُؤكَّد الوضع الحالي: المزوّد وعدد المؤمَّن عليهم وتاريخ الانتهاء. وتشير لائحة تنظيم العمل لدى العميل (المادة 33) إلى التأمين الطبي لجميع العاملين، وتشمل الباقة تنظيم التأمين الطبي للموظفين."),
        ("3.6 Work regulations. ", "3.6 لائحة تنظيم العمل. ",
         "The regulations provided (31 pages, 55 articles) were approved by the Ministry on 13/05/1444H. Several fields are blank: number of workers, activity, national address, establishment file number and the definitions of “establishment” and “authorised person”. Whether this is the latest approved version is to be confirmed. The regulations should match the real position, including wages through banks and wage protection (Article 14).",
         "اللائحة المقدّمة (31 صفحة و55 مادة) معتمدة من الوزارة بتاريخ 13/05/1444هـ. وفيها حقول فارغة: عدد العاملين والنشاط والعنوان الوطني ورقم ملف المنشأة وتعريف «المنشأة» و«صاحب الصلاحية». وهل هذه آخر نسخة معتمدة يُؤكَّد. وينبغي أن توافق اللائحة الواقع، ومنه دفع الأجور عبر البنوك وحماية الأجور (المادة 14)."),
    ]
    for i, (te, ta, en, ar) in enumerate(s33):
        B.append(f_point(te.split()[0], f"<b>{te.split(' ', 1)[1]}</b>{en}", f"<b>{ta.split(' ', 1)[1]}</b>{ar}", alt=i % 2 == 1))

    B.append(f_phase("3.7 Nitaqat and localisation", "3.7 نطاقات والتوطين"))
    B.append(mt((["Profession group", "Required", "Actual", "Required rate"], ["مجموعة المهن", "المطلوب", "الفعلي", "النسبة المطلوبة"]), [21, 9, 9, 10], [
        (["Sales professions", k(2), k(0), k("60%")], ["مهن المبيعات", k(2), k(0), ar_pc(60)]),
    ]))
    s37 = [
        (f"Band limits as shown on the portal: low green {k('21–28%')}, medium green {k('28–31%')}, high green {k('31–37%')}, platinum above {k('37%')}. They are checked against the official calculator, together with the establishment’s activity group (most likely “industries”) and the minimum wage at which a Saudi employee is counted, before any figure is adopted.",
         f"حدود النطاق كما تظهر في البوابة: أخضر منخفض {k('21–28٪')}، وأخضر متوسط {k('28–31٪')}، وأخضر مرتفع {k('31–37٪')}، وبلاتيني فوق {k('37٪')}. وتُراجع بالحاسبة الرسمية، ومعها مجموعة نشاط المنشأة (الأرجح «الصناعات») وحدّ الأجر الذي يُحتسب عنده الموظف السعودي، قبل اعتماد أي رقم."),
        (f"Sales professions: {k(2)} Saudi employees are required and {k(0)} are counted. The employment statement lists {k(6)} workers in sales professions while Qiwa shows {k(3)}; the reason is to be confirmed.",
         f"مهن المبيعات: المطلوب {k(2)} سعوديان والمحتسب {k(0)}. ويُدرج بيان العمالة {k(6)} عمال في مهن بيع بينما تُظهر قوى {k(3)}؛ والسبب يُؤكَّد."),
        ("Options for the sales professions, each decided by the Client and checked with the Ministry before use: (a) employ Saudi nationals genuinely working in those roles; (b) where a worker’s real work differs from the registered job title, correct the title to match the real work; (c) any other option the Ministry confirms for the profession. We do not register anyone nominally.",
         "خيارات مهن المبيعات، ويقرّر العميل كلاً منها وتُراجَع مع الوزارة قبل اعتمادها: (أ) توظيف سعوديين يعملون فعلاً في هذه الوظائف؛ (ب) حيث يختلف عمل العامل الفعلي عن المسمى الوظيفي المسجّل يُصحَّح المسمى ليطابق العمل الحقيقي؛ (ج) أي خيار آخر تؤكده الوزارة للمهنة. ولا نسجّل أحداً شكلياً."),
        (f"Approximate climb out of the red band, counting {k(26)} non-Saudi workers: about {k(7)} counted Saudi employees are needed to reach {k('21%')} (currently {k(2)}, so about {k(5)} more) and about {k(11)} to reach {k('28%')} (about {k(9)} more). This changes with the counting rules and wages, and is confirmed with the official calculator.",
         f"الارتقاء التقريبي من النطاق الأحمر مع {k(26)} عاملاً غير سعودي: يلزم نحو {k(7)} سعوديين محتسبين لبلوغ {ar_pc(21)} (الآن {k(2)}، أي نحو {k(5)} إضافيين) ونحو {k(11)} لبلوغ {ar_pc(28)} (نحو {k(9)} إضافيين). ويتغير ذلك بقواعد الاحتساب والأجور، ويُؤكَّد بالحاسبة الرسمية."),
        ("The effect of the red band on the establishment’s services is to be confirmed with the Ministry.",
         "وأثر النطاق الأحمر على خدمات المنشأة يُؤكَّد مع الوزارة."),
    ]
    for i, (en, ar) in enumerate(s37, 1):
        B.append(f_point(f"3.7.{i}", en, ar, alt=i % 2 == 0))
    B.append(f_point("3.8", "<b>Tamm (violations). </b>The violations, their types and amounts are set out in section 4.",
                     "<b>تمام (المخالفات). </b>تفصيل المخالفات وأنواعها ومبالغها في البند 4.", alt=True))
    B.append(f_point("3.9", "<b>Stability-support note. </b>The Client’s screenshots show a note on the establishment-stability support programme. The text, issuer and date are to be obtained, and the official procedure to lift it is to be confirmed with the Ministry. Every document submitted to any entity must match the real facts.",
                     "<b>ملاحظة دعم الاستقرار. </b>تُظهر لقطات العميل ملاحظة على برنامج دعم استقرار المنشآت. ويُحصَل على نصها وجهتها وتاريخها، ويُؤكَّد مع الوزارة الإجراء الرسمي لرفعها. وكل مستند يُقدَّم إلى أي جهة يجب أن يطابق الوقائع."))

    # ---------------------------------------------------------------- 4
    B.append(f_head(4, "Violations on Tamm", "المخالفات في «تمام»"))
    B.append(mt((["Type", "No.", "Amount (SAR)", "Notes"], ["النوع", "العدد", "المبلغ (ريال)", "ملاحظات"]), [14, 5, 9, 21], [
        (["Localisation", k(6), k("24,000"), f"July, September and October 2026; linked to two non-Saudi workers in sales professions ({k('4,000')} each)"],
         ["التوطين", k(6), k("24,000"), f"يوليو وسبتمبر وأكتوبر 2026؛ مرتبطة بعاملين غير سعوديين اثنين في مهن البيع ({k('4,000')} لكل مخالفة)"]),
        (["Wage-protection file", k(7), k("7,000"), f"September 2025 to August 2026 ({k('1,000')} each)"],
         ["ملف حماية الأجور", k(7), k("7,000"), f"من سبتمبر 2025 إلى أغسطس 2026 ({k('1,000')} لكل مخالفة)"]),
        (["Late payment of wages", k(4), k("1,200"), f"13 October 2025 ({k(300)} each)"],
         ["عدم دفع الأجور في موعدها", k(4), k("1,200"), f"13 أكتوبر 2025 ({k(300)} لكل مخالفة)"]),
        (["Total unpaid", k(17), k("32,200"), ""], ["إجمالي غير المسدد", k(17), k("32,200"), ""]),
    ], tot=(3,)))
    B.append(f_phase("Other violation records", "سجلات المخالفات الأخرى"))
    B.append(mt((["Type", "No.", "Amount (SAR)", "Notes"], ["النوع", "العدد", "المبلغ (ريال)", "ملاحظات"]), [14, 5, 9, 21], [
        (["Transferred to the enforcement platform", k(1), k("1,000"), "18 January 2026"], ["المرحّلة إلى منصة التنفيذ", k(1), k("1,000"), "18 يناير 2026"]),
        (["Unpaid and in enforcement", k(18), k("33,200"), ""], ["غير المسدد والمرحّل", k(18), k("33,200"), ""]),
        (["Cancelled earlier", k(4), k("34,000"), f"health care ×2 ({k('10,000')} each, 2019); work without a work permit ({k('10,000')}, 2024); localisation ({k('4,000')}, 2024)"],
         ["الملغاة سابقاً", k(4), k("34,000"), f"رعاية صحية ×2 ({k('10,000')} لكل مخالفة، 2019)؛ تشغيل بلا رخصة عمل ({k('10,000')}، 2024)؛ توطين ({k('4,000')}، 2024)"]),
        (["All violations recorded", k(22), "", f"{k(17)} + {k(1)} + {k(4)}; one violation has an objection filed"],
         ["إجمالي المخالفات المسجّلة", k(22), "", f"{k(17)} + {k(1)} + {k(4)}؛ وعلى واحدة منها اعتراض مقدَّم"]),
    ], tot=(1, 3)))
    s4 = [
        ("The amounts above are those shown on the Client’s screens. We have not added, estimated or calculated any penalty of our own. The amounts of the cancelled violations are not part of the amounts due.",
         "المبالغ أعلاه هي ما يظهر في شاشات العميل. ولم نضف أو نقدّر أو نحسب أي غرامة من عندنا. ومبالغ المخالفات الملغاة ليست من المستحق."),
        ("Time limits for payment, objection and settlement run from the notification date and differ by case; some may already have passed, particularly for the July localisation violations. The notification date of each violation is obtained first, and each limit is confirmed on Tamm.",
         "مهل السداد والاعتراض والتسوية تبدأ من تاريخ التبليغ وتختلف بحسب الحالة؛ وقد يكون بعضها انقضى، خصوصاً مخالفات التوطين عن يوليو. ويُحصَل أولاً على تاريخ تبليغ كل مخالفة، وتُؤكَّد كل مهلة على «تمام»."),
        ("For each violation we review the file, study the eligibility of the route available (payment, objection or settlement), prepare it, submit it only with the Client’s separate written approval, and follow it up. Earlier cancellations show that the objection route has been used, but they do not mean the same result for any violation now due, and we promise no cancellation or reduction.",
         "نراجع ملف كل مخالفة، وندرس أهلية المسار المتاح لها (سداد أو اعتراض أو تسوية)، ونجهّزه، ولا نقدّمه إلا بموافقة العميل الخطية المنفصلة، ثم نتابعه. وتدل الإلغاءات السابقة على أن مسار الاعتراض سبق سلوكه، لكنها لا تعني النتيجة نفسها لأي مخالفة مستحقة الآن، ولا نعد بإلغاء ولا بتخفيض."),
        ("Localisation violations were issued for three separate months while the position of the sales professions has not changed. Unless it is corrected, further violations may be issued; this is confirmed against the notification dates.",
         "صدرت مخالفات التوطين عن ثلاثة أشهر منفصلة ووضع مهن المبيعات لم يتغير. وما لم يُصحَّح قد تصدر مخالفات أخرى؛ ويُؤكَّد ذلك بتواريخ التبليغ."),
        ("Priority order for the study: localisation first, then wage protection (after proof of the file upload), then late payment of wages.",
         "ترتيب الأولوية في الدراسة: التوطين أولاً، ثم حماية الأجور (بعد إثبات رفع الملف)، ثم تأخر الأجور."),
    ]
    for i, (en, ar) in enumerate(s4, 1):
        B.append(f_point(f"4.{i}", en, ar, alt=i % 2 == 0))

    # ---------------------------------------------------------------- 5
    B.append(f_head(5, "Risks ranked by impact", "المخاطر مرتبة بالأثر"))
    lab = lambda e, a: (f"<b>{e}</b> ", f"<b>{a}</b> ")

    def risk(n_, impact, t_en, t_ar, eff, rec, own, dl):
        en = (f'<b>{t_en}</b> <span class="mt0">Impact: <b>{impact[0]}</b></span>'
              f'<b>Likely effect:</b> {eff[0]}<br><b>We recommend:</b> {rec[0]}<br><b>Owner:</b> {own[0]} · <b>Deadline:</b> {dl[0]}')
        ar = (f'<b>{t_ar}</b> <span class="mt0">الأثر: <b>{impact[1]}</b></span>'
              f'<b>الأثر المحتمل:</b> {eff[1]}<br><b>نوصي بـ:</b> {rec[1]}<br><b>المسؤول:</b> {own[1]} · <b>الموعد:</b> {dl[1]}')
        return f_point(f"5.{n_}", en, ar, alt=n_ % 2 == 0)

    C_, BP_ = ("Client", "العميل"), ("Business Partner", "Business Partner")
    risks = [
        risk(1, ("Very high", "عالٍ جداً"), "Red Nitaqat band with unpaid localisation violations", "النطاق الأحمر مع مخالفات توطين غير مسددة",
             (f"{k('24,000')} SAR of unpaid violations, about three quarters of the total, relate to localisation; the effect of the red band on services is to be confirmed with the Ministry.",
              f"{k('24,000')} ريال من المخالفات غير المسددة، أي نحو ثلاثة أرباعها، من التوطين؛ وأثر النطاق الأحمر على الخدمات يُؤكَّد مع الوزارة."),
             ("settle the sales-professions position, then plan the climb with the official calculator.", "حسم وضع مهن المبيعات ثم تخطيط الارتقاء بالحاسبة الرسمية."),
             ("Client decides and hires; Business Partner calculates and follows up", "العميل يقرّر ويوظّف؛ وBusiness Partner يحسب ويتابع"),
             ("position within 7 days; climb plan within 30–90 days", "الوضع خلال 7 أيام؛ وخطة الارتقاء خلال 30 إلى 90 يوماً")),
        risk(2, ("High", "عالٍ"), "Social-insurance balance and a long instalment plan", "رصيد التأمينات وخطة تقسيط طويلة",
             (f"{k('84,659.45')} SAR is unpaid and the plan runs for {k(30)} instalments; the instalment certificate depends on the plan staying regular, and the effect of non-payment is to be confirmed with social insurance.",
              f"رصيد {k('84,659.45')} ريال غير مسدد والخطة من {k(30)} قسطاً؛ وتعتمد الشهادة على انتظام الخطة، وأثر عدم السداد يُؤكَّد مع التأمينات."),
             (f"pay the {k('2,919.29')} SAR instalment, renew the certificate before it expires, and follow up the penalty-waiver request.",
              f"سداد قسط {k('2,919.29')} ريال، وتجديد الشهادة قبل انتهائها، ومتابعة طلب إعفاء الغرامات."),
             ("Client pays; Business Partner follows up", "العميل يسدد؛ وBusiness Partner يتابع"),
             ("17 November 2026; certificate before about 27 November 2026", "17 نوفمبر 2026؛ والشهادة قبل نحو 27 نوفمبر 2026")),
        risk(3, ("High", "عالٍ"), "Unpaid violations on Tamm", "مخالفات غير مسددة في «تمام»",
             (f"{k(17)} violations ({k('32,200')} SAR) plus one in enforcement ({k('1,000')} SAR); limits for objection or settlement may already have passed for some.",
              f"{k(17)} مخالفة ({k('32,200')} ريال) ومخالفة في التنفيذ ({k('1,000')} ريال)؛ وقد تكون مهل الاعتراض أو التسوية انقضت لبعضها."),
             ("obtain the notification dates, then study each violation, localisation first.", "الحصول على تواريخ التبليغ ثم دراسة كل مخالفة، والتوطين أولاً."),
             ("Business Partner studies; Client approves and pays", "Business Partner يدرس؛ والعميل يوافق ويسدد"),
             ("study within 3 weeks of authorisation", "الدراسة خلال 3 أسابيع من التفويض")),
        risk(4, ("High", "عالٍ"), "Difference in sales roles between the employment statement and Qiwa", "فرق وظائف المبيعات بين بيان العمالة وقوى",
             (f"The statement lists {k(6)} workers in sales professions against {k(3)} on Qiwa; any mismatch between job titles and real work weakens every submission.",
              f"يُدرج البيان {k(6)} عمال في مهن البيع مقابل {k(3)} في قوى؛ وأي عدم تطابق بين المسميات والعمل الفعلي يُضعف كل تقديم."),
             ("confirm who actually works in each sales role and make job titles match the real work.", "تأكيد من يعمل فعلاً في كل وظيفة مبيعات وجعل المسميات تطابق العمل الحقيقي."),
             ("Client", "العميل"), ("7 days", "7 أيام")),
        risk(5, ("High, time-bound", "عالٍ زمنياً"), "Qiwa group subscription ending", "قرب انتهاء اشتراك المجموعة في قوى",
             ("The effect of the subscription ending is to be confirmed with Qiwa.", "أثر انتهاء الاشتراك يُؤكَّد مع قوى."),
             (f"confirm the date and pay {k('2,248.25')} SAR.", f"تأكيد التاريخ وسداد {k('2,248.25')} ريال."),
             ("Client", "العميل"), ("by 9 November 2026 (recommended), and no later than 11 November 2026", "قبل 9 نوفمبر 2026 (الأحوط)، وبما لا يتجاوز 11 نوفمبر 2026")),
        risk(6, ("Medium to high", "متوسط إلى عالٍ"), "Qiwa compliance at 57%, two expired work permits and one missing contract", "التزام قوى 57٪ ورخصتا عمل منتهيتان وعقد مفقود",
             ("Compliance stays below target until permits and the contract are corrected.", "يبقى الالتزام دون المستهدف إلى أن تُصحَّح الرخص والعقد."),
             ("renew the two work permits and document the contract (government fees are paid by the Client).", "تجديد رخصتي العمل وتوثيق العقد (والرسوم الحكومية يدفعها العميل)."),
             ("Client with Business Partner", "العميل مع Business Partner"), ("2 weeks", "أسبوعان")),
        risk(7, ("Medium to high", "متوسط إلى عالٍ"), "Stability-support note", "ملاحظة دعم استقرار المنشآت",
             ("Its scope and effect are to be confirmed with the Ministry; we have not seen its text.", "يُؤكَّد نطاقها وأثرها مع الوزارة؛ ولم نطّلع على نصها."),
             ("obtain the note’s text, issuer and date, and ask the Ministry for the official procedure and requirements.", "الحصول على نص الملاحظة وجهتها وتاريخها، وسؤال الوزارة عن الإجراء الرسمي والمتطلبات."),
             ("Client with Business Partner", "العميل مع Business Partner"), ("7 days", "7 أيام")),
        risk(8, ("Medium", "متوسط"), "Saudi employees without an active subscription or valid contract", "موظفان سعوديان بلا اشتراك نشط وبلا عقد ساري",
             (f"{k(2)} Saudi employees on the statement have no active subscription and {k(2)} have no valid contract (whether they are the same employees is to be confirmed); employees without an active subscription may not be counted in Nitaqat.", f"موظفان سعوديان في البيان بلا اشتراك نشط وموظفان بلا عقد ساري (وهل هما أنفسهما يُؤكَّد)؛ وقد لا يُحتسب في نطاقات من لا اشتراك نشط له."),
             ("find the reason; document their contracts if they work, or update the statement through the lawful route.", "معرفة السبب؛ وتوثيق عقديهما إن كانا يعملان، أو تحديث البيان بالطريق النظامي."),
             ("Client", "العميل"), ("2 weeks", "أسبوعان")),
        risk(9, ("Medium (unknown)", "متوسط (مجهول)"), "Residencies with unknown expiry dates", "إقامات مجهولة تواريخ الانتهاء",
             ("No dates were provided, so no judgement is possible.", "لا تواريخ مقدّمة، فلا حكم ممكناً."),
             ("extract the report from Muqeem or Qiwa and list those ending soon.", "استخراج التقرير من مقيم أو قوى وإدراج المنتهية قريباً."),
             ("Business Partner, after authorisation", "Business Partner بعد التفويض"), ("within 2 weeks of authorisation", "خلال أسبوعين من التفويض")),
        risk(10, ("Medium (unknown)", "متوسط (مجهول)"), "Medical insurance not shown", "التأمين الطبي غير ظاهر",
             ("Its current position is unknown.", "وضعه الحالي مجهول."),
             ("provide the policy details; we organise the employees’ medical insurance under the package.", "تزويدنا بتفاصيل الوثيقة؛ وننظّم التأمين الطبي للموظفين ضمن الباقة."),
             ("Client with Business Partner", "العميل مع Business Partner"), ("30 days", "30 يوماً")),
        risk(11, ("Low to medium", "منخفض إلى متوسط"), "Data quality and the extra subscriber on the invoice", "جودة البيانات والمشترك الزائد في الفاتورة",
             ("Repeated rows, missing birth dates and an extra subscriber can distort figures and submissions.", "تكرار الصفوف ونقص تواريخ الميلاد والمشترك الزائد قد تشوّه الأرقام والتقديمات."),
             ("clean the statement before any upload and confirm the reason for the extra subscriber.", "تنظيف البيان قبل أي رفع وتأكيد سبب المشترك الزائد."),
             ("Business Partner with Client", "Business Partner مع العميل"), ("1 week", "أسبوع")),
    ]
    B += risks

    # ---------------------------------------------------------------- 6
    B.append(f_head(6, "Corrective action plan", "خطة العمل التصحيحية"))
    B.append(f_point("6.1",
                     f"The plan is carried out through two services under the Agreement: <b>{SETUP_EN}</b> (one-time): the assessment, setting up the file on the platforms, cleaning and organising it, a corrective plan, and follow-up until stability; and the <b>{PKG_EN}</b> (ongoing): Qiwa, social insurance, Mudad, Muqeem and Absher Business, medical insurance, Nitaqat and localisation, a unified renewals calendar, a monthly report, and the Tamm process for each violation. Payments, hiring decisions and approvals stay with the Client; government fees, fines and platform subscriptions are paid directly to the entity.",
                     f"تُنفَّذ الخطة عبر خدمتين في العقد: <b>{SETUP_AR}</b> (مرة واحدة): التقييم وتأسيس الملف على المنصات وتنظيفه وترتيبه وخطة تصحيحية والمتابعة حتى الاستقرار؛ و<b>{PKG_AR}</b> (مستمرة): قوى والتأمينات الاجتماعية ومدد ومقيم وأبشر أعمال والتأمين الطبي ونطاقات والتوطين وتقويم موحّد للتجديدات وتقرير شهري ومسار «تمام» لكل مخالفة. وتبقى المدفوعات وقرارات التوظيف والموافقات على العميل؛ والرسوم الحكومية والغرامات واشتراكات المنصات تُدفع مباشرةً للجهة."))

    def act(n_, en, ar, own, scope):
        e = f'{en}<span class="mt0">Owner: {own[0]} · Under: {scope[0]}</span>'
        a = f'{ar}<span class="mt0">المسؤول: {own[1]} · ضمن: {scope[1]}</span>'
        return f_point(f"6.{n_}", e, a, alt=n_ % 2 == 0)

    SU = (SETUP_EN, SETUP_AR)
    LA = (PKG_EN, PKG_AR)
    CL = ("Client", "العميل")
    CB = ("Client with Business Partner", "العميل مع Business Partner")
    BPo = ("Business Partner", "Business Partner")
    PRE = ("Prerequisite to both services", "شرط مسبق للخدمتين")
    B.append(f_phase("Phase 1 — Immediate (first 7 days)", "المرحلة 1 — فورية (أول 7 أيام)"))
    B.append(act(2, "Sign the authorisation letter attested by the Chamber of Commerce and delegate access on Qiwa, social insurance, Mudad and Muqeem. Never passwords or verification codes.",
                 "توقيع خطاب التفويض المصدَّق من الغرفة التجارية وتفويض الوصول على قوى والتأمينات ومدد ومقيم. ولا كلمات مرور ولا رموز تحقق إطلاقاً.", CL, PRE))
    B.append(act(3, "List the notification date of every violation and sort out those still within an objection or settlement limit.",
                 "جرد تاريخ تبليغ كل مخالفة وفرز ما بقي منها ضمن مهلة اعتراض أو تسوية.", BPo, SU))
    B.append(act(4, "Settle the position of the sales professions: who actually works in each role, job titles that match the real work, and genuine Saudi hiring where required.",
                 "حسم وضع مهن المبيعات: من يعمل فعلاً في كل وظيفة، ومسميات تطابق العمل الحقيقي، وتوظيف سعودي فعلي حيث يلزم.", CB, SU))
    B.append(act(5, f"Confirm the date and pay the Qiwa group subscription ({k('2,248.25')} SAR), by 9 November 2026 if possible.",
                 f"تأكيد التاريخ وسداد اشتراك المجموعة في قوى ({k('2,248.25')} ريال)، قبل 9 نوفمبر 2026 إن أمكن.", CB, SU))
    B.append(act(6, "Obtain the text, issuer and date of the stability-support note, and confirm with the Ministry the official procedure to lift it and its requirements.",
                 "الحصول على نص ملاحظة دعم الاستقرار وجهتها وتاريخها، وتأكيد الإجراء الرسمي لرفعها ومتطلباتها مع الوزارة.", CB, SU))
    B.append(act(7, "Submit nothing new to any entity until it has been reviewed against the real facts.",
                 "عدم تقديم أي مستند جديد لأي جهة قبل مراجعته بالوقائع.", CB, SU))
    B.append(f_phase("Phase 2 — Within 30 days", "المرحلة 2 — خلال 30 يوماً"))
    B.append(act(8, f"Pay the social-insurance instalment of {k('2,919.29')} SAR due on 17 November 2026, renew the instalment certificate before it expires, and follow up the penalty-waiver request.",
                 f"سداد قسط التأمينات {k('2,919.29')} ريال المستحق في 17 نوفمبر 2026، وتجديد شهادة التقسيط قبل انتهائها، ومتابعة طلب إعفاء الغرامات.", CB, SU))
    B.append(act(9, "Study each unpaid violation (localisation first, then wage protection), prepare the chosen route and submit it only with the Client’s separate written approval.",
                 "دراسة كل مخالفة غير مسددة (التوطين أولاً ثم حماية الأجور) وتجهيز المسار المختار وتقديمه بموافقة العميل الخطية المنفصلة فقط.", BPo, LA))
    B.append(act(10, "Activate Mudad and file the wage-protection file monthly at the required compliance rate; handle the notes.",
                 "تفعيل مدد ورفع ملف حماية الأجور شهرياً بنسبة الامتثال المطلوبة، ومعالجة الملاحظات.", BPo, (f"{SETUP_EN}, then {PKG_EN}", f"{SETUP_AR} ثم {PKG_AR}")))
    B.append(act(11, "Renew the two expired work permits and document the missing contract.",
                 "تجديد رخصتي العمل المنتهيتين وتوثيق العقد المفقود.", CB, LA))
    B.append(act(12, "Verify the social-insurance status and contract of every Saudi employee, and reconcile the statement with Qiwa and social insurance (duplicates, birth dates, professions).",
                 "التحقق من وضع كل موظف سعودي في التأمينات وعقده، ومطابقة البيان مع قوى والتأمينات (المكررات وتواريخ الميلاد والمهن).", CB, SU))
    B.append(act(13, "Provide the medical-insurance details; organise the employees’ medical insurance and an alert before expiry.",
                 "تزويدنا بتفاصيل التأمين الطبي؛ وتنظيم التأمين الطبي للموظفين مع تنبيه قبل الانتهاء.", CB, LA))
    B.append(act(14, "Complete the blank fields of the work regulations, update them, and apply them in practice (wages through banks, medical insurance).",
                 "استكمال الحقول الفارغة في لائحة تنظيم العمل وتحديثها وتطبيقها فعلياً (الأجور عبر البنوك والتأمين الطبي).", CL, SU))
    B.append(f_phase("Phase 3 — 30 to 90 days", "المرحلة 3 — من 30 إلى 90 يوماً"))
    B.append(act(15, "Calculate the climb out of the red band with the official calculator and the counting rules, and set a monthly Nitaqat calculation with an alert before any drop.",
                 "حساب الارتقاء من النطاق الأحمر بالحاسبة الرسمية وقواعد الاحتساب، وضبط حساب شهري لنطاقات مع تنبيه قبل أي هبوط.", BPo, LA))
    B.append(act(16, "Set a genuine Saudi hiring plan: jobs, wages and schedule. The cost of hiring and the salaries are the Client’s.",
                 "وضع خطة توظيف سعودي فعلي: المهن والأجور والجدول. وتكلفة التوظيف والرواتب على العميل.", CL, ("outside our fees", "خارج أتعابنا")))
    B.append(act(17, "Extract the residency report from Muqeem or Qiwa, list those ending, and renew them on a renewals calendar.",
                 "استخراج تقرير الإقامات من مقيم أو قوى، وإدراج المنتهية منها، وتجديدها وفق تقويم التجديدات.", BPo, LA))
    B.append(act(18, "Pay the social-insurance instalments on schedule.", "سداد أقساط التأمينات في موعدها.", CL, ("Client’s obligation", "التزام على العميل")))
    B.append(act(19, "Move to monthly management: a monthly report, a unified renewals calendar, alerts before any violation, and a single point of contact.",
                 "الانتقال إلى الإدارة الشهرية: تقرير شهري وتقويم موحّد للتجديدات وتنبيه قبل أي مخالفة ونقطة اتصال واحدة.", BPo, LA))
    B.append(act(20, f"Review at 90 days against these aims, which are aims of the plan and not guarantees: no new violations for three months; localisation at {k('21%')} or more; permits and contracts at {k('100%')}; no wage-protection notes. They depend on the Client’s decisions and the entities’ response.",
                 f"المراجعة بعد 90 يوماً على هذه الأهداف، وهي أهداف للخطة لا ضمانات: لا مخالفات جديدة لثلاثة أشهر؛ وتوطين {ar_pc(21)} فأكثر؛ والرخص والعقود {ar_pc(100)}؛ ولا ملاحظات حماية أجور. وتعتمد على قرارات العميل واستجابة الجهات.", BPo, LA))

    # ---------------------------------------------------------------- 7
    B.append(f_head(7, "Information and documents we need from the Client", "المعلومات والمستندات التي نحتاجها من العميل"))
    s7 = [
        ("The authorisation letter attested by the Chamber of Commerce, and the type of access delegated on Qiwa, social insurance, Mudad and Muqeem (never passwords or verification codes).",
         "خطاب التفويض مصدَّقاً من الغرفة التجارية، ونوع الوصول المفوَّض على قوى والتأمينات ومدد ومقيم (لا كلمات مرور ولا رموز تحقق)."),
        ("The correct renewal date of the Qiwa group subscription, the number of establishments it covers, and who is authorised on each.",
         "تاريخ تجديد اشتراك المجموعة في قوى الصحيح، وعدد المنشآت التي يشملها، ومن هو المفوَّض على كل منها."),
        ("From social insurance: the status of the penalty-waiver request, the status of the earlier instalment plan, and why thirteen invoices appear unpaid; the official report of all social-insurance violations.",
         "من التأمينات: حالة طلب إعفاء الغرامات، وحالة خطة التقسيط السابقة، وسبب ظهور 13 فاتورة غير مسددة؛ والتقرير الرسمي بكل مخالفات التأمينات."),
        ("From Tamm: the official report of all violations (paid and unpaid) and the notification date of each.",
         "من «تمام»: التقرير الرسمي بكل المخالفات (المسددة وغير المسددة) وتاريخ تبليغ كل منها."),
        ("The stability-support note: a screenshot of it, its issuer and date, and the Ministry’s requirements when known.",
         "ملاحظة دعم الاستقرار: صورتها وجهتها وتاريخها، ومتطلبات الوزارة عند معرفتها."),
        ("The residency and work-permit report for each worker (from Muqeem or Qiwa), and the wages on the employment statement, which has none.",
         "تقرير الإقامات ورخص العمل لكل عامل (من مقيم أو قوى)، والأجور في بيان العمالة الذي لا يتضمنها."),
        ("An explanation of the difference in sales roles between the statement and Qiwa, of the extra subscriber on the September invoice, and of the Saudi employees without an active subscription or valid contract.",
         "تفسير الفرق في وظائف المبيعات بين البيان وقوى، والمشترك الزائد في فاتورة سبتمبر، والموظفين السعوديين بلا اشتراك نشط أو عقد ساري."),
        ("The distribution of workers across the four branches and their registration on each platform.",
         "توزيع العمالة على الفروع الأربعة وتسجيلهم في كل منصة."),
        ("The Client’s hiring plan for Saudi employees (jobs, wages and schedule).", "خطة العميل لتوظيف السعوديين (المهن والأجور والجدول)."),
        ("The medical-insurance policy: provider, number of insured workers, coverage and expiry.", "وثيقة التأمين الطبي: المزوّد وعدد المؤمَّن عليهم والتغطية وتاريخ الانتهاء."),
        ("The establishment’s activity group in Nitaqat and the establishment file number at the labour office.", "مجموعة نشاط المنشأة في نطاقات ورقم ملف المنشأة في مكتب العمل."),
        ("The current national-address proof (the one provided shows an expiry on 22 October 2026), and the latest approved work regulations with their blank fields completed.",
         "إثبات العنوان الوطني الحالي (الذي قُدّم ينتهي في 22 أكتوبر 2026)، وآخر نسخة معتمدة من لائحة تنظيم العمل بعد استكمال حقولها الفارغة."),
        ("Please send documents through the approved channel only. Screenshots that show identity numbers or phone numbers are shared only with those authorised.",
         "نرجو إرسال المستندات عبر القناة المعتمدة فقط. واللقطات التي تُظهر أرقام هوية أو جوالات لا تُشارَك إلا مع المخوَّلين."),
    ]
    for i, (en, ar) in enumerate(s7, 1):
        B.append(f_point(f"7.{i}", en, ar, alt=i % 2 == 0))

    # ---------------------------------------------------------------- 8
    B.append(f_head(8, "Limits of this assessment", "حدود هذا التقييم"))
    s8 = [
        ("This assessment is built from the data and screenshots the Client provided on 28 October 2026: the lists of social-insurance subscribers, the employment statement, the September 2026 invoice, the work regulations, and screenshots of Qiwa, social insurance and Tamm.",
         "بُني هذا التقييم من البيانات واللقطات التي قدّمها العميل في 28 أكتوبر 2026: قوائم المشتركين في التأمينات وبيان العمالة وفاتورة سبتمبر 2026 ولائحة تنظيم العمل ولقطات من قوى والتأمينات و«تمام»."),
        ("No platform was accessed and nothing was submitted to any entity.", "لم يُدخل أي منصة ولم يُقدَّم شيء لأي جهة."),
        ("Figures may change as the entities update their records. Each figure is confirmed on the platform before any action, and items marked “to be confirmed” are not verified.",
         "قد تتغير الأرقام بتحديث الجهات لسجلاتها. ويُؤكَّد كل رقم على المنصة قبل أي إجراء، والبنود الموسومة «يُؤكَّد» لم يُتحقق منها."),
        ("The amounts of fines, subscriptions and fees are those shown on the Client’s screens. They are paid by the Client directly to the entity or supplier and are not part of our fees.",
         "مبالغ الغرامات والاشتراكات والرسوم هي ما يظهر في شاشات العميل. ويدفعها العميل مباشرةً للجهة أو المورّد، وليست من أتعابنا."),
        ("The estimate of Saudi employees needed to leave the red band is approximate and depends on the counting rules and wages.",
         "تقدير عدد السعوديين اللازم للخروج من النطاق الأحمر تقريبي ويعتمد على قواعد الاحتساب والأجور."),
        ("This assessment covers human-resources matters only: Qiwa, Mudad, Muqeem and Absher Business, social insurance, medical insurance, Nitaqat and localisation, and Tamm. Other areas are not assessed.",
         "يغطي هذا التقييم شؤون الموارد البشرية فقط: قوى ومدد ومقيم وأبشر أعمال والتأمينات الاجتماعية والتأمين الطبي ونطاقات والتوطين و«تمام». ولم تُقيَّم مجالات أخرى."),
        ("This is not a legal opinion. We promise no outcome: not the lifting of any hold or note, not the cancellation or reduction of any violation, not any Nitaqat band, and not the acceptance of any request by an entity.",
         "هذا التقييم ليس رأياً قانونياً. ولا نعد بأي نتيجة: لا برفع تجميد أو ملاحظة، ولا بإلغاء مخالفة أو تخفيضها، ولا بنطاق معيّن، ولا بقبول أي جهة لأي طلب."),
    ]
    for i, (en, ar) in enumerate(s8, 1):
        B.append(f_point(f"8.{i}", en, ar, alt=i % 2 == 0))
    B.append(_bk('<div class="bp" style="margin-top:14px"><div class="rw"><div class="col" dir="ltr"><b>Issued by</b><br>' + G.CEO_EN + ' · ' + G.CEO_TITLE_EN + '<br>' + G.CO_EN + '</div>'
                 '<div class="col" dir="rtl"><b>صادر عن</b><br>' + G.CEO_AR + ' · ' + G.CEO_TITLE_AR + '<br>' + G.CO_AR + '</div></div></div>', 64))

    strip = [("Prepared for / أُعدّ لـ", CLIENT_EN), ("Date / التاريخ", G.num("[●]")), ("Data as of / البيانات حتى", "28 Oct 2026 · 28 أكتوبر 2026"),
             ("Issued by / صادر عن", f"{G.CEO_EN}<br><span dir=\"rtl\">{G.CEO_AR}</span>")]
    cover = G.cover_port("COMPREHENSIVE ASSESSMENT", "التقييم الشامل", "Comprehensive Compliance Assessment", "تقييم الامتثال الشامل",
                         "Government platforms · Nitaqat and localisation · Tamm", "المنصات الحكومية · نطاقات والتوطين · تمام", strip)
    B = _measure_blocks(B)
    G.PORT_BUDGET = int(os.environ.get("BP_FULL_BUDGET", "888"))
    h = G.port_doc("تقييم الامتثال الشامل", "Comprehensive Compliance Assessment", B, cover, G.closing_port(),
                   "تقييم الامتثال الشامل · Comprehensive Compliance Assessment")
    return h.replace("</style>", FULL_CSS + "</style>", 1)



# ------------------------------------------------------------------ الكتابة والتحويل إلى PDF
DOCS = {
    "quote": ("quote", build_quote, "land"),
    "contract": ("contract", build_contract, "port"),
    "nda": ("nda", build_nda, "port"),
    "terms": ("terms", build_terms, "port"),
    "authorization": ("authorization-letter", build_auth, "port"),
    "assessment": ("assessment-summary", build_assessment, "port"),
    "assessment_full": ("assessment-full", build_assessment_full, "port"),
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
        h = h.replace('<div class="c">[●]<br>', '<div class="c">' + PHONE + '<br>')
        h = h.replace('Mobile / الجوال: <span class="num">[●]</span>', 'Mobile / الجوال: <span class="num">' + PHONE + '</span>')
    if BANK:
        h = h.replace('Bank / البنك: [●]', 'Bank / البنك: ' + BANK)
        h = h.replace('account at [●], IBAN [IBAN]', 'account at ' + BANK + ', IBAN [IBAN]')
        h = h.replace('لدى [●]، آيبان [IBAN]', 'لدى ' + BANK + '، آيبان [IBAN]')
    if IBAN:
        h = h.replace('[IBAN]', IBAN)
    return h


# ------------------------------------------------------------------ النسخة النهائية: تاريخ الإرسال والمراجع والحقول القابلة للتعبئة
SEND_DATE = os.environ.get("BP_DATE", "")            # مثال: 2026-11-04
DOC_REF = {"quote": "Q", "contract": "C", "nda": "NDA", "terms": "TC", "authorization-letter": "AUTH", "assessment-summary": "ASM", "assessment-full": "ASF"}
_AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
_EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _fld(name):
    return f'<span class="fld" data-f="{name}"></span>'


def finalize_html(h, docname):
    """يُستعمل في البناء النهائي فقط (BP_DATE): يملأ التاريخ والمراجع، ويحوّل كل [●] متبقٍّ إلى حقل تعبئة."""
    if not SEND_DATE:
        return h
    y, m, d = (int(x) for x in SEND_DATE.split("-"))
    date_s = f"{d} {_EN_MONTHS[m-1]} {y} · {d} {_AR_MONTHS[m-1]} {y}"
    ymd = SEND_DATE.replace("-", "")
    ref = f"BP-{DOC_REF[docname]}-{ymd}-GLF"
    q_no, c_no = f"BP-Q-{ymd}-GLF", f"BP-C-{ymd}-GLF"
    # أرقام المرجع
    h = re.sub(r"(Service Agreement No\.) \[●\]", lambda mm: f"{mm.group(1)} {c_no}", h)
    h = re.sub(r"(عقد الخدمة رقم) \[●\]", lambda mm: f"{mm.group(1)} {c_no}", h)
    h = re.sub(r"(quotation no\.) \[●\]", lambda mm: f"{mm.group(1)} {q_no}", h)
    h = re.sub(r"(عرض السعر المقبول رقم) \[●\]", lambda mm: f"{mm.group(1)} {q_no}", h)
    out, pos, k = [], 0, 0
    for mm in re.finditer(r"\[●\]", h):
        pre = re.sub(r"<[^>]+>", "", h[max(0, mm.start() - 400):mm.start()])
        tail = pre[-30:]
        if re.search(r"(Ref / المرجع|Ref)\W*$", tail):
            rep = ref
        elif re.search(r"(Date|التاريخ)[^A-Za-z\u0600-\u06FF]*$", tail):
            client_sig = (CLIENT_AR in pre[-260:]) and ("Title" in pre[-120:] or "الصفة" in pre[-120:])
            if client_sig:
                k += 1
                rep = _fld(f"{docname}_client_date_{k}")
            else:
                rep = date_s
        else:
            k += 1
            rep = _fld(f"{docname}_f{k}")
        out.append(h[pos:mm.start()]); out.append(rep); pos = mm.end()
    out.append(h[pos:])
    return "".join(out)


def pdf_input(path):
    """نسخة للتحويل: الخطوط مضمّنة محلياً ومسار الشعار مطلق، تُكتب خارج المستودع."""
    h = finalize_html(inject_company(path.read_text(encoding="utf8")), path.stem)
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
    if SEND_DATE:
        import fillable
        for _, outp in jobs:
            print("  حقول قابلة للتعبئة:", Path(outp).name, fillable.add_fields(outp))


def main():
    paths = write_html()
    print("HTML:", ", ".join(p.name for p in paths.values()))
    if "--html" not in sys.argv:
        render_pdfs(paths)


if __name__ == "__main__":
    main()
