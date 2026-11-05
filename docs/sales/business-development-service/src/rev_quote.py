# -*- coding: utf-8 -*-
"""مولّد عرض سعر REV (باقة واحدة: REV-LAUNCH) بنسختين: مبسط ومفصل — A4 أفقي بتصميم قالب REV المعتمد.
يقرأ ../templates/REV-quote-template-bilingual.html (الورق والغلاف والخدمات الأخرى والغلاف الختامي) ويبني الصفحات الباقية.
الأسعار من site/assets/data/catalog.json (REV-LAUNCH) ونسب النجاح من عقد REV المعتمد. لا آيبان ولا بنك: [IBAN] و[BANK] ما لم تُمرَّر BP_IBAN وBP_BANK.
الاستعمال من rev_package.py. الخانة الفارغة تُكتب [●] وتتحول لاحقاً إلى حقل تعبئة في PDF."""
import base64, html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
TPL = os.path.join(ROOT, "docs/sales/templates")
RLM = "‏"
BLANK = "[●]"


def esc(s): return html.escape(s, quote=False)
def num(s): return '<span class="num">%s</span>' % esc(str(s))


def catalog_launch():
    d = json.load(open(os.path.join(ROOT, "site/assets/data/catalog.json"), encoding="utf-8"))
    items = d if isinstance(d, list) else d.get("items") or d.get("catalog") or d.get("services") or []
    for it in items:
        if it.get("code") == "REV-LAUNCH":
            return it
    raise SystemExit("REV-LAUNCH not found in catalog.json")


_cat = catalog_launch()
FEE = int(_cat["amount"])          # 2,500 شهرياً قبل الضريبة (الكتالوج)
ADV = FEE * 3                      # دفعة مقدمة 3 أشهر (دليل REV)
YEAR = FEE * 12
f = lambda n: "{:,}".format(n)


def template_sections():
    s = open(os.path.join(TPL, "REV-quote-template-bilingual.html"), encoding="utf-8").read()
    css = s[s.index("<style>") + 7: s.index("</style>")]
    logo = base64.b64encode(open(os.path.join(TPL, "assets/business-partner-logo-clean.png"), "rb").read()).decode()
    css = css.replace("url(assets/business-partner-logo-clean.png)", "url(data:image/png;base64,%s)" % logo)
    fonts = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', s).group(0)
    body = s[s.index("<body>"):]
    secs = re.split(r'(?=<section class="sheet)', body)
    return css, fonts, secs[1], secs[2], secs[8]


CSS, FONTS, T_COVER, T_OTHERS, T_CLOSE = template_sections()
EXTRA = """
.pt .nm{width:4%}.pt td.t{vertical-align:top}.pt td b{color:#0B1B5A}
.pt td.nx{text-align:center;font-family:'IBM Plex Mono',monospace;color:#1E3A9E;font-weight:700}.pt th.nx{text-align:center}
.pt .tot td{font-weight:700;background:#EEF1FB}
.nt{border:1px solid #0B1B5A;background:#F2F4FB;padding:5px 10px;margin:6px 0;font-size:10.2px;color:#1B2340;direction:ltr;display:flex;gap:14px}
.nt>div{flex:1;min-width:0}.nt .ar{direction:rtl;text-align:right}.nt b{color:#0B1B5A}
.fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}
"""


def footer(i, n, phone):
    return ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
            '<div class="c">%s<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">%d / %d</span></div>'
            '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>') % (esc(phone), i, n)


def hd2(en, a):
    return ('<div class="hd2"><span class="logo" role="img" aria-label="Business Partner"></span>'
            '<div class="t e"><h1>%s</h1></div><div class="t a"><h1>%s</h1></div></div>') % (esc(en), esc(a))


def rw(en, a, cls=""):
    return '<div class="rw %s"><div class="col" dir="ltr">%s</div><div class="col" dir="rtl">%s</div></div>' % (cls, en, a)


def h2(i, en, a): return rw('<h2><span class="n">%s</span>%s</h2>' % (i, esc(en)), '<h2><span class="n">%s</span>%s</h2>' % (i, esc(a)))
def p(en, a): return rw("<p>%s</p>" % en, "<p>%s</p>" % (a + RLM))


def bi_table(head, rows, widths, cls="pt"):
    """[إنجليزي: الأعمدة] [فاصل] [عربي: الأعمدة معكوسة]. head: [(en, ar, center)]؛ rows: صفوف من (en, ar, css)."""
    cg = "".join('<col style="width:%s%%">' % w for w in widths) + '<col style="width:2%">' + "".join('<col style="width:%s%%">' % w for w in reversed(widths))
    th_en = "".join('<th class="en%s">%s</th>' % (" c" if c else "", h) for (h, _a, c) in head)
    th_ar = "".join('<th class="ar%s">%s</th>' % (" c" if c else "", a) for (_h, a, c) in reversed(head))
    out = ['<table class="%s"><colgroup>%s</colgroup><tr>%s<td class="gp"></td>%s</tr>' % (cls, cg, th_en, th_ar)]
    for r in rows:
        tr = ""
        if isinstance(r, dict):
            tr = ' class="%s"' % r["cls"]; r = r["cells"]
        out.append("<tr%s>%s<td class='gp'></td>%s</tr>" % (
            tr, "".join('<td class="en%s">%s</td>' % (" " + c if c else "", e) for (e, _a, c) in r),
            "".join('<td class="ar%s">%s</td>' % (" " + c if c else "", a) for (_e, a, c) in reversed(r))))
    out.append("</table>")
    return "".join(out)


def numbered(rows, le, la):
    head = [("#", "#", True), (le, la, False)]
    body = [[(str(i), str(i), "nx"), (e, a + RLM, "t")] for i, (e, a) in enumerate(rows, 1)]
    return bi_table(head, body, [4, 46])


def meta(to_en, to_ar, date_en, date_ar):
    t = lambda v: v if v != BLANK else num(BLANK)
    return ('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> %s</div><div class="meta1"><b>Date:</b> %s</div><div class="meta1"><b>Quote validity:</b> 14 days</div></div>'
            '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> %s</div><div class="meta1"><b>التاريخ:</b> %s</div><div class="meta1"><b>صلاحية العرض:</b> 14 يوماً</div></div></div>') % (
        t(esc(to_en)), esc(date_en), t(esc(to_ar)), esc(date_ar))


def sig_boxes(cfg):
    def box(t, co, nm, tt, dt):
        return ('<div><h3><span>%s</span><span dir="rtl">%s</span></h3>'
                '<div class="f2"><span>Company</span><span class="v cn">%s</span><span dir="rtl">الشركة</span></div>'
                '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div>'
                '<div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
                '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div>'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>') % (
            t[0], t[1], co, nm, tt, dt)
    ours = box(("Business Partner Solutions", "بزنس بارتنر سلوشنز"), "Business Partner Solutions · بزنس بارتنر سلوشنز",
               'Badr · <span dir="rtl">بدر</span>',
               'Sales &amp; Business Development Manager · <span dir="rtl">مدير المبيعات وتطوير الأعمال</span>',
               esc(cfg["date_en"]) + " · " + esc(cfg["date_ar"]))
    cl_co = (esc(cfg["client_en"]) + ' · <span dir="rtl">' + esc(cfg["client_ar"]) + "</span>") if cfg.get("client_en") else num(BLANK)
    theirs = box(("Client", "العميل"), cl_co, num(BLANK), num(BLANK), num(BLANK))
    return '<div class="sg" style="direction:ltr">%s%s</div>' % (ours, theirs)


# ---------------------------------------------------------------- المحتوى
UPGRADE = rw('<div class="nt" style="margin:4px 0"><div><b>Upgrade:</b> you can move to a higher package at any time on request.</div></div>',
             '<div class="nt" style="margin:4px 0"><div class="ar"><b>الترقية:</b> يمكن الانتقال إلى باقة أعلى في أي وقت عند الطلب.%s</div></div>' % RLM)


def price_block(cfg):
    head = [("Package", "الباقة", False), ('<span class="num">REV-LAUNCH</span><br>Launch', '<span class="num">REV-LAUNCH</span><br>الانطلاق', True)]
    rows = [
        [("Monthly fee (SAR, excl. VAT)", "الرسم الشهري (ريال، قبل الضريبة)", ""), (num(f(FEE)), num(f(FEE)), "c")],
        [("Advance payment: 3 months (SAR, excl. VAT)", "الدفعة المقدمة: 3 أشهر (ريال، قبل الضريبة)", ""), (num(f(ADV)), num(f(ADV)), "c")],
        [("12-month total (SAR, excl. VAT)", "إجمالي 12 شهراً (ريال، قبل الضريبة)", ""), (num(f(YEAR)), num(f(YEAR)), "c")],
        [("Target project size (SAR)", "حجم المشاريع المستهدفة (ريال)", ""), ("Up to 500,000", "حتى 500,000", "c")],
        [("Qualified leads per month (committed minimum)", "فرص مؤهلة شهرياً (حد أدنى ملتزم به)", ""), (num(4), num(4), "c")],
        [("Vendor registrations per month (committed minimum)", "تسجيلات مورد شهرياً (حد أدنى ملتزم به)", ""), (num(4), num(4), "c")],
        [("Meetings per month", "اجتماعات شهرياً", ""), (num(4), num(4), "c")],
    ]
    model_head = [("Closed deal value (SAR)", "قيمة الصفقة المغلقة (ريال)", False),
                  ("Lead handover only", "تسليم الفرصة فقط", True), ("With our participation in closing", "مع مشاركتنا في الإغلاق", True)]
    model = [
        [("Up to 1,000,000", "حتى 1,000,000", ""), (num("10%"), num("10%"), "c"), (num("12.5%"), num("12.5%"), "c")],
        [("1,000,000 to 5,000,000", "من 1,000,000 إلى 5,000,000", ""), (num("5%"), num("5%"), "c"), (num("7.5%"), num("7.5%"), "c")],
        [("Above 5,000,000", "أكثر من 5,000,000", ""), (num("2.5%"), num("2.5%"), "c"), (num("5%"), num("5%"), "c")],
    ]
    return [
        h2(1, "Price", "السعر"),
        bi_table(head, rows, [58, 40]),
        p("Prices exclude 15% VAT. Government fees, if any, are separate and not part of this price.",
          "الأسعار قبل ضريبة القيمة المضافة 15%. الرسوم الحكومية، إن وجدت، منفصلة ولا تدخل في هذا السعر."),
        UPGRADE,
        rw("<h2>Revenue model (hybrid): fixed monthly fee + success fee on closed deals</h2>",
           "<h2>نموذج الإيراد (هجين): رسم شهري ثابت + نسبة نجاح عند إغلاق الصفقة</h2>"),
        bi_table(model_head, model, [46, 26, 26]),
        p("Fee is before tax (15% VAT added) and remains due after the contract ends on delivered leads · Basis: contract or purchase order value, excl. VAT · Tier on the whole value · Due within 14 days.",
          "النسبة قبل الضريبة (وتُضاف 15% ضريبة القيمة المضافة) وتبقى مستحقة بعد انتهاء العقد عن الفرص المسلَّمة · الأساس: قيمة العقد أو أمر الشراء قبل الضريبة · الشريحة على كامل القيمة · الاستحقاق خلال 14 يوماً."),
    ]


FEATURES = [
    ("Qualified leads and referrals with contact details: email and/or mobile", "فرص مؤهلة وإحالات ببيانات تواصل: إيميل و/أو جوال"),
    ("List of companies, portals and registration emails by your activity", "قائمة بالشركات وصفحات وإيميلات التسجيل كمورد حسب نشاطكم"),
    ("Monthly meetings with target buyers", "اجتماعات شهرية مع الجهات"),
    ("The service’s smart advisor", "المستشار الذكي للخدمة"),
    ("Monthly performance report", "تقرير أداء شهري"),
]
DEFS = [
    ("“Qualified lead”: an entity with valid contact details (email and/or mobile) and a stated need or clear rationale.",
     "«فرصة مؤهلة»: جهة ببيانات تواصل صالحة (إيميل و/أو جوال) وحاجة معلنة أو مبرر واضح."),
    ("“Vendor registration”: a complete submission of the registration application, with documents, on the target company’s platform; acceptance rests with the company and is not guaranteed.",
     "«تسجيل مورد»: تقديم مكتمل لطلب التسجيل على منصة الشركة المستهدفة بمستنداته؛ القبول بيد الشركة ولا نضمنه."),
]


def scope_block(short):
    rows = FEATURES[:4] if short else FEATURES
    out = [h2(2, "Scope", "النطاق"), numbered(rows, "Included in REV-LAUNCH", "المشمول في REV-LAUNCH")]
    for e, a in (DEFS[:1] if short else DEFS):
        out.append(p(e, a))
    return out


STEPS = [
    ("You sign the quotation and the contract.", "توقّعون عرض السعر والعقد."),
    ("You provide the company data form and the required documents.", "تزوّدوننا بنموذج بيانات الشركة والمستندات المطلوبة."),
    ("We deliver qualified leads, vendor registrations and meetings every month.", "نسلّمكم شهرياً الفرص المؤهلة وتسجيلات المورد والاجتماعات."),
    ("You follow up the leads and report outcomes; we send a monthly performance report.", "تتابعون الفرص وتبلّغوننا بنتائجها، ونرسل تقرير أداء شهرياً."),
    ("The success fee is due on closed deals arising from delivered leads, per the contract.", "تُستحق نسبة النجاح على الصفقات المغلقة الناتجة عن الفرص المسلَّمة وفق العقد."),
]
REQS = [
    ("Company information and documents needed for vendor registration (commercial registration, company profile and others), on time.", "بيانات الشركة ومستنداتها اللازمة للتسجيل كمورد (سجل تجاري، ملف تعريفي، وغيرها) في الوقت المناسب."),
    ("A designated contact person at the client.", "تحديد مسؤول تواصل لدى العميل."),
    ("Attendance at meetings and follow-up of leads within 7 days of handover.", "حضور الاجتماعات ومتابعة الفرص خلال 7 أيام من تسليمها."),
    ("Reporting lead outcomes and any closed deal to us.", "إبلاغنا بنتائج الفرص وبأي صفقة تُغلق."),
    ("Copying our email business@businesspartner.sa (CC) on its email correspondence concerning delivered leads with the referred entities.", "إضافة بريدنا business@businesspartner.sa في خانة النسخة (CC) في مراسلاته الإلكترونية الخاصة بالفرص المسلَّمة مع الجهات المحالة إليه."),
]
EXCL = [
    ("Registration fees charged by buying entities.", "رسوم التسجيل التي تفرضها الجهات المشترية."),
    ("Government fees and platform subscriptions.", "الرسوم الحكومية واشتراكات المنصات."),
    ("Travel and accommodation.", "السفر والإقامة."),
    ("Classification and professional certificates.", "التصنيف والشهادات المهنية."),
    ("Any item not expressly stated in this quotation.", "أي بند غير مذكور صراحة في هذا العرض."),
    ("A guarantee of registration acceptance or deal closure; the decision rests with the buying entity.", "ضمان قبول التسجيل أو إغلاق صفقة، فالقرار للجهة المشترية."),
]
TERMS = [
    ("The First Party commits to the monthly minimum stated in the selected package; if missed, the shortfall is completed in the following month; if not completed, a credit is applied to the next invoice.",
     "يلتزم الطرف الأول بالحد الأدنى الشهري المذكور في الباقة المختارة، وعند عدم تحقيقه تُستكمل المخرجات الناقصة في الشهر التالي، فإن لم تُستكمل يُحتسب رصيد دائن في الفاتورة التالية."),
    ("The success fee follows the revenue model table; value basis is the signed contract or purchase order value excl. VAT, the tier applies to the whole value, and the due date is within 14 days.",
     "تُحتسب نسبة النجاح وفق جدول نموذج الإيراد، وأساس القيمة قيمة العقد أو أمر الشراء الموقّع قبل الضريبة، وتُطبَّق الشريحة على كامل القيمة، وموعد الاستحقاق خلال 14 يوماً."),
    ("The First Party does not guarantee vendor acceptance or deal closure; the decision rests with the buying entity.",
     "لا يضمن الطرف الأول قبول تسجيل المورد ولا إغلاق صفقة، فالقرار للجهة المشترية."),
    ("Information exchanged is subject to the Non-Disclosure Agreement.", "تخضع المعلومات المتبادلة لاتفاقية عدم الإفصاح."),
    ("Neither this quotation nor the contract may be amended except in writing by both parties.", "لا يُعدَّل العرض أو العقد إلا كتابةً بموافقة الطرفين."),
]


def term_pay_block(short):
    term = [h2(4 if short else 5, "Term", "المدة"),
            p("The contract term is 12 months. The client may cancel after a minimum of 3 months by written notice of 30 days. It renews by mutual consent.",
              "مدة العقد 12 شهراً، ويحق للعميل الإلغاء بعد 3 أشهر كحد أدنى بإشعار خطي مدته 30 يوماً، ويتجدد بموافقة الطرفين.")]
    pay = [("Monthly fee", "الرسم الشهري", "Paid in advance for a minimum of 3 months, excl. VAT, with 15% VAT added", "يُسدد مقدماً لمدة 3 أشهر كحد أدنى، قبل الضريبة، وتُضاف إليها ضريبة القيمة المضافة 15%"),
           ("Payment due", "موعد السداد", "Within 5 days of the invoice date", "خلال 5 أيام من تاريخ الفاتورة"),
           ("Success fee", "نسبة النجاح", "Invoiced after a deal closes per the table above; due date within 14 days", "تُفوتر بعد إغلاق الصفقة وفق الجدول أعلاه، وموعد الاستحقاق خلال 14 يوماً"),
           ("Payment method", "وسيلة السداد", "Bank transfer to the account shown on the last page", "تحويل بنكي على الحساب المبيّن في الصفحة الأخيرة")]
    head = [("Item", "البند", False), ("Method", "الطريقة", False)]
    rows = [[(a, b, "t"), (c, d + RLM, "t")] for (a, b, c, d) in pay]
    n = 5 if short else 6
    return term + [h2(n, "Payment", "طريقة الدفع"), bi_table(head, rows, [22, 28])]


# ---------------------------------------------------------------- التجميع
def cover(cfg, phone):
    c = T_COVER
    c = c.replace('<div class="pk" dir="ltr">REV-LAUNCH Launch · REV-GROWTH Growth · REV-PRO Pro</div>',
                  '<div class="pk" dir="ltr">REV-LAUNCH · Launch</div>')
    c = c.replace('<div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">REV-LAUNCH الانطلاق · REV-GROWTH النمو · REV-PRO الاحترافية</div>',
                  '<div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">REV-LAUNCH · الانطلاق</div>')
    to_en = esc(cfg["client_en"]) if cfg.get("client_en") else num(BLANK)
    to_ar = esc(cfg["client_ar"]) if cfg.get("client_ar") else ""
    to = to_en + (" · " + to_ar if cfg.get("client_en") and to_ar else "")
    c = c.replace('<span>To / إلى السادة</span><span class="num">[●]</span>', '<span>To / إلى السادة</span>' + to)
    c = c.replace('<span>Date / التاريخ</span><span class="num">[●]</span>', '<span>Date / التاريخ</span>%s<br>%s' % (esc(cfg["date_en"]), esc(cfg["date_ar"])))
    return c


def others(): return T_OTHERS


def closing(phone, iban, bank):
    c = T_CLOSE
    c = c.replace('Mobile / الجوال: <span class="num">[●]</span>', 'Mobile / الجوال: <span class="num">%s</span>' % esc(phone))
    c = c.replace('Bank / البنك: [●]', 'Bank / البنك: %s' % esc(bank)).replace('IBAN: <span class="num">[●]</span>', 'IBAN: <span class="num">%s</span>' % esc(iban))
    return c


def land(inner, n_title):
    return lambda i, n, phone: ('<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
        hd2("Quotation: Business Development as a Service", "عرض سعر: تطوير الأعمال كخدمة"), "".join(inner), footer(i, n, phone)))


def build(cfg, short, phone, iban, bank):
    """يعيد مستند HTML كاملاً. short=True: المبسط (≤5 صفحات)."""
    m = meta(cfg.get("client_en") or BLANK, cfg.get("client_ar") or BLANK, cfg["date_en"], cfg["date_ar"])
    pages = []
    if short:
        pages.append(land([m] + price_block(cfg), "")) # 2
        pages.append(land(scope_block(True) + [h2(3, "Client Requirements", "المتطلبات من العميل"), numbered(REQS[:4], "Client Requirements", "المتطلبات من العميل")], ""))  # 3
        pages.append(land(term_pay_block(True) + [h2(6, "Signatures", "التوقيعان"), sig_boxes(cfg)], ""))   # 4
    else:
        pages.append(None)  # الخدمات الأخرى
        pages.append(land([m] + price_block(cfg), ""))
        pages.append(land(scope_block(False) + [h2(3, "How it works", "كيف تعمل الخدمة"), numbered(STEPS, "Step", "الخطوة")], ""))
        pages.append(land([h2(4, "Client Requirements", "المتطلبات من العميل"), numbered(REQS, "Client Requirements", "المتطلبات من العميل"),
                           h2(5, "Exclusions", "ما لا يشمله العرض"), numbered(EXCL, "Exclusions", "ما لا يشمله العرض")], ""))
        tp = term_pay_block(False)
        pages.append(land(tp + [h2(7, "Terms &amp; Conditions", "الشروط والأحكام"), numbered(TERMS, "Terms &amp; Conditions", "الشروط والأحكام")], ""))
        pages.append(land([h2(8, "Signatures", "التوقيعان"),
                           p("By signing below, both parties accept this quotation and its terms and conditions.", "بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه."),
                           sig_boxes(cfg)], ""))
    if short:
        # إضافة الاستثناءات في المبسط داخل صفحة المتطلبات إن اتسعت (يُضبط بالقياس)
        pass
    N = len(pages) + 2
    out = []
    out.append(re.sub(r"\d+ / \d+", "1 / %d" % N, cover(cfg, phone)).replace("<span class=\"num\">[●]</span><br>business", "business"))
    for k, pg in enumerate(pages):
        i = k + 2
        if pg is None:
            sec = re.sub(r"\d+ / \d+", "%d / %d" % (i, N), others())
            out.append(sec.replace("[●]<br>business@", esc(phone) + "<br>business@"))
        else:
            out.append(pg(i, N, phone))
    out.append(re.sub(r"\d+ / \d+", "%d / %d" % (N, N), closing(phone, iban, bank)))
    body = "".join(out).replace("[●]<br>business@", esc(phone) + "<br>business@")
    title = "عرض سعر تطوير الأعمال" + (" المبسط" if short else " المفصل")
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title>%s<style>%s%s</style></head><body>%s</body></html>') % (title, FONTS, CSS, EXTRA, body)
