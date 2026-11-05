# -*- coding: utf-8 -*-
"""يولّد HTML الوثائق الثلاث بالهوية الدائمة (قوالب docs/sales/templates).
الاستعمال:  python3 build_html.py <outdir> [--final]
  بلا --final : نسخة المستودع — الجوال [●] والآيبان [IBAN].
  --final     : الجوال يُحقن (BP_PHONE)، والآيبان من BP_IBAN إن وُجد وإلا يبقى [IBAN].
"""
import base64, html, json, os, re, subprocess, sys
from content import *

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(ROOT, "docs/sales/templates")
LOGO = os.path.join(TPL, "assets/business-partner-logo-clean.png")
FINAL = "--final" in sys.argv
PHONE = os.environ.get("BP_PHONE", "0530540231")
IBAN = os.environ.get("BP_IBAN", "[IBAN]") if FINAL else "[IBAN]"
BANK = os.environ.get("BP_BANK", "[●]") if FINAL else "[●]"

def esc(s): return html.escape(s, quote=False)
def num(s): return '<span class="num">%s</span>' % esc(str(s))

def css_of(tpl):
    s = open(os.path.join(TPL, tpl), encoding="utf-8").read()
    c = s[s.index("<style>") + 7: s.index("</style>")]
    b64 = base64.b64encode(open(LOGO, "rb").read()).decode()
    c = c.replace("url(assets/business-partner-logo-clean.png)", "url(data:image/png;base64,%s)" % b64)
    return c

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@400;700&display=swap">'
EXTRA = """
.pt .nm{width:4%}.pt td.t{vertical-align:top}.pt td b{color:#0B1B5A}.pt td.tp{vertical-align:top}
.pt .tot td{font-weight:700;background:#EEF1FB}.pt .tot td .num{color:#0B1B5A}
.pt td.nx{text-align:center;font-family:'IBM Plex Mono',monospace;color:#1E3A9E;font-weight:700}
.pt th.nx{text-align:center}
.nt{border:1px solid #0B1B5A;background:#F2F4FB;padding:5px 10px;margin:6px 0;font-size:10.4px;color:#1B2340;direction:ltr;display:flex;gap:14px}
.nt>div{flex:1;min-width:0}.nt .ar{direction:rtl;text-align:right}.nt b{color:#0B1B5A}
.cv .ch .nm{font-family:'IBM Plex Sans Arabic',sans-serif;font-size:12px}
.sg h3 .cn2{font-size:10px}
.sheet.cover{padding:0!important}.sheet.cover>div{height:100%}.sheet.cover .cv{margin:0!important;height:100%!important;width:100%}
"""

def footer(i, n):
    return ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
            '<div class="c">%s<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">%d / %d</span></div>'
            '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>') % (esc(PHONE), i, n)

def doc(title, css, sheets, lang_dir="rtl"):
    n = len(sheets)
    body = "".join(s(i + 1, n) if callable(s) else s for i, s in enumerate(sheets))
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title>%s<style>%s%s</style></head><body>%s</body></html>') % (esc(title), FONTS, css, EXTRA, body)

# ------------------------------------------------------------------ مكوّنات عرض السعر (A4 أفقي)
def hd2(en, a):
    return ('<div class="hd2"><span class="logo" role="img" aria-label="Business Partner"></span>'
            '<div class="t e"><h1>%s</h1></div><div class="t a"><h1>%s</h1></div></div>') % (esc(en), esc(a))

def meta_row(with_to=True):
    return ('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> %s</div><div class="meta1"><b>Date:</b> %s</div><div class="meta1"><b>Quote validity:</b> 14 days</div></div>'
            '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> %s</div><div class="meta1"><b>التاريخ:</b> %s</div><div class="meta1"><b>صلاحية العرض:</b> 14 يوماً</div></div></div>') % (
        esc(CLIENT_EN), esc(DATE_EN), esc(CLIENT_AR), esc(DATE_AR))

def h2(i, en, a):
    return ('<div class="rw"><div class="col" dir="ltr"><h2><span class="n">%s</span>%s</h2></div>'
            '<div class="col" dir="rtl"><h2><span class="n">%s</span>%s</h2></div></div>') % (i, esc(en), i, esc(a))

def bi_table(head, rows, widths, cls="pt"):
    """جدول مشترك: [إنجليزي: أعمدة] [فاصل] [عربي: الأعمدة معكوسة].
    head: [(en,ar)...] لكل عمود إنجليزي؛ rows: قائمة صفوف، كل صف قائمة (en,ar,css) بنفس ترتيب الأعمدة؛ widths: نسب الأعمدة."""
    cg = "".join('<col style="width:%s%%">' % w for w in widths) + '<col style="width:2%">' + "".join('<col style="width:%s%%">' % w for w in reversed(widths))
    th_en = "".join('<th class="en%s">%s</th>' % (" c" if c else "", h) for (h, _a, c) in head)
    th_ar = "".join('<th class="ar%s">%s</th>' % (" c" if c else "", a) for (_h, a, c) in reversed(head))
    out = ['<table class="%s"><colgroup>%s</colgroup><tr>%s<td class="gp"></td>%s</tr>' % (cls, cg, th_en, th_ar)]
    for r in rows:
        tr_cls = ""
        if isinstance(r, dict):
            tr_cls = ' class="%s"' % r.get("cls", ""); r = r["cells"]
        tds_en = "".join('<td class="en%s">%s</td>' % (" " + c if c else "", e) for (e, _a, c) in r)
        tds_ar = "".join('<td class="ar%s">%s</td>' % (" " + c if c else "", a) for (_e, a, c) in reversed(r))
        out.append("<tr%s>%s<td class='gp'></td>%s</tr>" % (tr_cls, tds_en, tds_ar))
    out.append("</table>")
    return "".join(out)

def numbered(rows, le="Item", la="البند"):
    """جدول مرقّم: [#] نص | فاصل | نص [#]  — rows: [(en, ar)] والنص قد يحوي <b>."""
    head = [("#", "#", True), (le, la, False)]
    body = []
    for i, (e, a) in enumerate(rows, 1):
        body.append([(str(i), str(i), "nx"), (e, ar(a), "t")])
    return bi_table(head, body, [4, 46])

def sig_boxes(left_title=("Business Partner Solutions", "بزنس بارتنر سلوشنز"), right_title=("Client", "العميل"),
              left_co=("Business Partner Solutions · بزنس بارتنر سلوشنز"), right_co=None):
    def box(t, co, nm=None, tt=None):
        return ('<div><h3><span>%s</span><span dir="rtl">%s</span></h3>'
                '<div class="f2"><span>Company / Party</span><span class="v cn">%s</span><span dir="rtl">الشركة / الطرف</span></div>'
                '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div>'
                '<div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
                '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div>'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>') % (
            esc(t[0]), esc(t[1]), co, nm or num("[●]"), tt or num("[●]"), num(DATE_EN + " · " + DATE_AR))
    return '<div class="sg" style="direction:ltr">%s%s</div>' % (
        box(left_title, esc(left_co), esc(REP_EN) + ' · <span dir="rtl">' + esc(REP_AR) + '</span>',
            esc(REP_TITLE_EN) + ' · <span dir="rtl">' + esc(REP_TITLE_AR) + '</span>'),
        box(right_title, right_co or num("[●]")))

# ------------------------------------------------------------------ عرض السعر
SAR_SVG = '<svg class="sar" viewBox="0 0 1124.14 1256.39" role="img" aria-label="SAR"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>'
def sar_mark(h):
    """رمز الريال السعودي المعتمد (SAMA) بدل «ريال» و«SAR» في العروض."""
    h = re.sub(r"\bSAR\b", SAR_SVG, h)
    h = re.sub(r"ريال(?:اً)?(?![\u0600-\u06FF])", SAR_SVG, h)
    return h
def build_quote():
    css = css_of("REV-quote-template-bilingual.html") + ".sar{height:.95em;width:.85em;vertical-align:-.12em;fill:currentColor}.sheet.land .sg .bx2>div{height:46px}"
    sheets = []
    def cover(i, n):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv lt"><div class="lgband"><span class="logo big" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">Workforce Supply</h1>'
                '<div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>توفير العمالة</h1>'
                '<div class="sb">%s</div></div></div>'
                '<div class="pk" dir="ltr">Workforce Supply · %d workers</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">توفير العمالة · %d عاملاً</div>'
                '<div class="ch"><div><span>To / إلى السادة</span><span class="nm">%s</span></div><div><span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span></div>'
                '<div><span>Validity / صلاحية العرض</span>14 days<br><span dir="rtl">14 يوماً</span></div></div></div></div></section>') % (
            esc(Q_COVER_EN), esc(ar(Q_COVER_AR)), TOTAL_WORKERS, TOTAL_WORKERS, esc(CLIENT_AR), esc(DATE_EN), esc(DATE_AR))
    sheets.append(cover)

    REC_MAIN = []; REC_ANNEX = []
    def page(inner):
        REC_MAIN.append(inner)
        def f(i, n):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
                hd2(Q_TITLE_EN, Q_TITLE_AR), inner, footer(i, n))
        return f
    sheetsA = []
    def pageA(inner):
        REC_ANNEX.append(inner)
        def f(i, n):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
                hd2(Q_ANNEX_EN, Q_ANNEX_AR), inner, footer(i, n))
        return f

    B = "[●]"
    nat_all = (NAT_EN, NAT_AR)
    def pc(v): return (num(n(v)), num(n(v)), "c")
    def rate_table(prices, price_hdr=("Monthly price per worker (SAR)", "السعر الشهري للعامل (ريال)"), prices2=None, hdr2=None):
        rr = []
        for k, t in enumerate(TRADES, 1):
            le, la, sal, loc_fee = LEVELS[t["level"]]
            rr.append([(str(k), str(k), "nx"), ("<b>%s</b>" % esc(t["en"]), "<b>%s</b>" % esc(t["ar"]), "t"), (le, la, "c"), pc(sal), (str(t["count"]), str(t["count"]), "c"),
                       (NAT_EN, NAT_AR, "c"), pc(prices[t["level"]])] + ([pc(prices2[t["level"]])] if prices2 else []))
        return bi_table([("#", "#", True), ("Trade", "المهنة", False), ("Level", "المستوى", True), ("Salary", "الراتب", True), ("Workers", "العدد", True),
                         ("Nationalities", "الجنسيات", True), (price_hdr[0], price_hdr[1], True)] + ([(hdr2[0], hdr2[1], True)] if hdr2 else []),
                        rr, [3, 20, 9, 8, 7, 18, 12] + ([14] if hdr2 else []))
    rates12 = rate_table(PRICE12, prices2=PRICE12_F, hdr2=("Price under the Shared Talent item (SAR)", "السعر على بند الكوادر المشتركة (ريال)"))
    hours = ('<div class="nt"><div dir="ltr"><b>Working hours:</b> %d hours a day &nbsp;·&nbsp; <b>Working days:</b> %d days a month</div>'
             '<div class="ar" dir="rtl"><b>ساعات العمل:</b> %d ساعات يومياً &nbsp;·&nbsp; <b>أيام العمل:</b> %d يوماً في الشهر</div></div>') % (WORK_HOURS, WORK_DAYS, WORK_HOURS, WORK_DAYS)
    note = ('<div class="nt"><div dir="ltr"><b>Salary:</b> skilled 1,800 · helper 1,200 (you may raise or lower it). Prices are per worker per month, before 15% VAT.</div>'
            '<div class="ar" dir="rtl"><b>الراتب:</b> الماهر 1,800 · المساعد 1,200 (لك أن تزيده أو تنقصه). الأسعار للعامل شهرياً قبل ضريبة 15%.</div></div>')
    basis_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(ce), esc(be)), "<b>%s</b> — %s" % (esc(ca), esc(ar(ba))), "t")]
                  for i, (ce, ca, be, ba) in enumerate(PRICE_BASIS, 1)]
    basis = bi_table([("#", "#", True), ("How the monthly price per worker is built", "كيف يُبنى السعر الشهري للعامل", False)], basis_rows, [4, 46])
    def fac_table(pp, ppf):
        fr = [[(le, la, "t"), pc(sal), pc(pp[k2]), pc(ppf[k2]), pc(pp[k2] - ppf[k2])] for k2, (le, la, sal, lf) in LEVELS.items() if k2 in PRICE_LEVELS]
        return bi_table([("If the contract is under the Shared Talent item", "إذا كان التعاقد على بند الكوادر المشتركة", False), ("Salary", "الراتب", True), ("Standard price", "السعر العادي", True), ("Shared Talent price", "سعر الكوادر المشتركة", True), ("Saving", "الفرق", True)], fr, [18, 8, 8, 8, 8])
    fac12 = rate_table(PRICE12_F, ("Monthly price per worker under the Shared Talent item (SAR)", "السعر الشهري للعامل على بند الكوادر المشتركة (ريال)"))
    def diff_table():
        dr = [[(le, la, "t"), pc(sal), pc(PRICE12[k2]), pc(PRICE[k2]), pc(PRICE12[k2] - PRICE[k2])] for k2, (le, la, sal, lf) in LEVELS.items() if k2 in PRICE_LEVELS]
        dr.append([("Technical engineering (under a decision)", "فنية هندسية (عليها قرار توطين)", "t"), pc(LEVELS['tech'][2]), pc(PRICE_TECHDEC), pc(PRICE_TECHDEC24), pc(PRICE_TECHDEC - PRICE_TECHDEC24)])
        dr.append([("Engineering (under a decision)", "هندسية (عليها قرار توطين)", "t"), pc(ENG_SALARY), pc(PRICE_ENG), pc(PRICE_ENG24), pc(PRICE_ENG - PRICE_ENG24)])
        return bi_table([("Monthly price per worker (SAR)", "السعر الشهري للعامل (ريال)", False), ("Salary", "الراتب", True), ("12-month contract (our offer)", "عقد 12 شهراً (عرضنا)", True), ("24-month contract", "عقد 24 شهراً", True), ("Difference per month", "الفرق شهرياً", True)], dr, [18, 8, 9, 9, 8])
    diffnote = ('<div class="nt"><div dir="ltr">In a 24-month contract the visa or transfer of services (sponsorship transfer) fee (SAR 2,000) is spread over 24 months, so the price falls by about SAR 90 per worker per month.</div>'
                '<div class="ar" dir="rtl">في عقد 24 شهراً تُوزَّع رسوم التأشيرة أو نقل الخدمات (نقل الكفالة) (2,000 ريال) على 24 شهراً، فينخفض السعر نحو 90 ريالاً للعامل شهرياً.</div></div>')
    sheets.append(page(h2(1, "Trades, salaries and price: 12-month contract (SAR, before VAT)", "المهن والرواتب والسعر الشهري: عقد 12 شهراً (ريال، قبل الضريبة)") + hours + rates12))
    sheets.append(page(h2(2, "Calculation under the Shared Talent item (12-month contract)", "الحسبة على بند الكوادر المشتركة (عقد 12 شهراً)") + fac12))


    # 4 النطاق والمستثنيات
    scope_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")] for i, (te, ta, de, da) in enumerate(SCOPE, 1)]
    scope = bi_table([("#", "#", True), ("What is included", "ما يشمله العرض", False)], scope_rows, [4, 46])
    _b = lambda s: esc(s).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
    excl = numbered([(_b(e), _b(a)) for e, a in EXCLUSIONS], "Not included / on the Client", "غير مشمول / على العميل")
    scope_page = h2("A1", "Scope", "النطاق") + scope
    calc_box = '' if not CALC_URL else ('<div class="nt"><div dir="ltr"><b>Salary-based cost calculator:</b> %s</div>'
                '<div class="ar" dir="rtl"><b>الآلة الحاسبة للتكاليف بناءً على الرواتب:</b> <b dir="ltr">%s</b></div></div>') % (CALC_URL, CALC_URL)
    def model_how():
        rows_ = [
          [("<b>How it works</b>", "<b>كيف يعمل</b>", "t"), ("One fixed monthly amount that includes every government cost, spread over the contract.", "مبلغ شهري ثابت يشمل كل التكاليف الحكومية موزَّعة على العقد.", "t"), ("A lower monthly invoice; government costs are invoiced at their actual amount, no mark-up, when due.", "فاتورة شهرية أقل؛ والتكاليف الحكومية بمبلغها الفعلي دون هامش عند استحقاقها.", "t"), ("The contract is under the National and Non-National Shared Talent item, with its own price per worker (see the price table).", "التعاقد على بند الكوادر الوطنية وغير الوطنية المشتركة بسعر خاص للعامل (انظر جدول الأسعار).", "t")],
          [("<b>You pay</b>", "<b>تدفع</b>", "t"), ("Two months in advance, then the same amount monthly.", "شهرين مقدماً ثم المبلغ نفسه شهرياً.", "t"), ("Signing, entry, arrival (paid quarterly), monthly invoice, end. 15% VAT only on administrative costs and our fees.", "التوقيع، الدخول، الوصول (ربع سنوي)، الفاتورة الشهرية، النهاية. ضريبة 15% على الإدارية ورسومنا فقط.", "t"), ("As in Model 1 or Model 2, at the Shared Talent price.", "كما في النموذج الأول أو الثاني، بسعر الكوادر المشتركة.", "t")],
          [("<b>Total over the contract</b>", "<b>الإجمالي على العقد</b>", "t"), ("The same as Model 2.", "هو نفسه في النموذج الثاني.", "t"), ("The same as Model 1.", "هو نفسه في النموذج الأول.", "t"), ("At the Shared Talent price in the price table.", "بسعر الكوادر المشتركة في جدول الأسعار.", "t")]]
        return bi_table([("", "", False), ("Model 1 — Full cost", "النموذج الأول — التكلفة الكاملة", False), ("Model 2 — Transparent cost", "النموذج الثاني — التكلفة بشفافية", False), ("Model 3 — Shared Talent services", "النموذج الثالث — خدمات الكوادر الوطنية وغير الوطنية المشتركة", False)], rows_, [10, 18, 20, 18])
    model_tick = ('<div class="nt"><div dir="ltr">Choose the model: &nbsp; &#9744; Model 1 — Full cost &nbsp; &#9744; Model 2 — Transparent cost &nbsp; &#9744; Model 3</div>'
                  '<div class="ar" dir="rtl">اختر النموذج: &nbsp; &#9744; النموذج الأول — التكلفة الكاملة &nbsp; &#9744; النموذج الثاني — التكلفة بشفافية &nbsp; &#9744; النموذج الثالث</div></div>')
    sheets.append(page(h2(2, "Three models", "ثلاثة نماذج") + model_how()))
    model_short = ('<div class="nt"><div dir="ltr"><b>Two models, same total:</b> full cost (one fixed monthly amount) or transparent cost (a monthly invoice, with government costs at actual when due). Choose: &nbsp; \u2610 Full cost &nbsp; \u2610 Transparent cost. Details in the detailed quotation.</div>'
                   '<div class="ar" dir="rtl"><b>نموذجان بإجمالي واحد:</b> التكلفة الكاملة (مبلغ شهري ثابت) أو التكلفة بشفافية (فاتورة شهرية والتكاليف الحكومية بالفعلي عند استحقاقها). اختر: &nbsp; \u2610 التكلفة الكاملة &nbsp; \u2610 التكلفة بشفافية. والتفصيل في العرض المفصل.</div></div>')
    def calc_table():
        cr = [[(num(n(a)), num(n(a)), "c"), pc(worker_price(a, 900, months=12)), pc(worker_price(a, 900, months=12) - FACTORY_DISCOUNT), pc(worker_price(a, 900, months=24)), pc(worker_price(a, 900, months=24) - FACTORY_DISCOUNT)] for a in CALC_SALARIES]
        return bi_table([("Monthly salary (SAR)", "الراتب الشهري (ريال)", True), ("12 months, standard", "12 شهراً، عادي", True), ("12 months, National and Non-National Shared Talent", "12 شهراً، الكوادر المشتركة", True), ("24 months, standard", "24 شهراً، عادي", True), ("24 months, National and Non-National Shared Talent", "24 شهراً، الكوادر المشتركة", True)], cr, [12, 12, 12, 12, 12])
    calc_page = h2("A2", "Salary-based cost calculator", "الآلة الحاسبة للتكاليف بناءً على الرواتب") + calc_table() + calc_box
    incl_box = ('<div class="nt"><div dir="ltr"><b>The monthly price includes</b> per worker: the salary, residence permit, work permit, health and social insurance, end-of-service and leave provision, return ticket, administrative and operating costs, and our fees. It does not include allowances (accommodation, food, transport).</div>'
                '<div class="ar" dir="rtl"><b>يشمل السعر الشهري</b> للعامل الواحد: الراتب، الإقامة ورخصة العمل، التأمين الصحي والتأمينات الاجتماعية، مخصص نهاية الخدمة والإجازة، تذكرة العودة، التكاليف الإدارية والتشغيلية، ورسومنا. ولا يشمل البدلات (السكن والإعاشة والمواصلات).</div></div>')
    _bx = "&#9744; "
    opt_box = bi_table([("#", "#", True), ("Your option", "خيارك", False), ("What it means", "ماذا يعني", False), ("Your choice", "اختيارك", False)], [
        [("1", "1", "nx"), ("<b>Salary</b>", "<b>الراتب</b>", "t"), ("Raise or lower any worker's salary; the price is recalculated.", "زد راتب أي عامل أو انقصه، ويُعاد حساب السعر.", "t"), (_bx + "As offered<br>" + _bx + "My salary", _bx + "كما في العرض<br>" + _bx + "راتب أحدده", "t")],
        [("2", "2", "nx"), ("<b>Recruitment from abroad</b>", "<b>الاستقدام من الخارج</b>", "t"), ("By Business Partner at cost, or by you directly.", "من طرفنا بالتكلفة أو من طرفك مباشرة.", "t"), (_bx + "Business Partner<br>" + _bx + "The Client", _bx + "من طرفكم<br>" + _bx + "من طرف العميل", "t")],
        [("3", "3", "nx"), ("<b>Professions</b>", "<b>المهن</b>", "t"), ("Register the professions (residence permits, Qiwa contracts) as skilled, not technical, to avoid localisation costs.", "تسجيل المهن في الإقامات والعقود في قوى على المهن الماهرة، لا الفنية، لتجنب تكاليف التوطين.", "t"), (_bx + "Yes<br>" + _bx + "No", _bx + "نعم<br>" + _bx + "لا", "t")],
        [("4", "4", "nx"), ("<b>Contract model</b>", "<b>نموذج التعاقد</b>", "t"), ("Model 1 full cost, Model 2 transparent cost, or Model 3 Shared Talent services.", "النموذج الأول التكلفة الكاملة، أو الثاني التكلفة بشفافية، أو الثالث خدمات الكوادر الوطنية وغير الوطنية المشتركة.", "t"), (_bx + "Model 1<br>" + _bx + "Model 2<br>" + _bx + "Model 3", _bx + "الأول<br>" + _bx + "الثاني<br>" + _bx + "الثالث", "t")],
        [("5", "5", "nx"), ("<b>Direct payment</b>", "<b>الدفع المباشر</b>", "t"), ("Any item that would cost you more (accommodation, transport, food, medical upgrade, government fees, tickets): pay it directly; it is taken off our invoice.", "أي بند يكلفك أكثر (السكن، المواصلات، الإعاشة، رفع التأمين الطبي، الرسوم الحكومية، التذاكر): ادفعه مباشرة ويُحذف من فاتورتنا.", "t"), (_bx + "None<br>" + _bx + "These items: ________", _bx + "لا شيء<br>" + _bx + "بنود: ____", "t")]],
        [3, 14, 34, 16])
    inc_ex = [
        (("Salary", "الراتب"), ("&#9744; Accommodation (SAR 300, optional)", "&#9744; السكن (300 ريال، اختياري)")),
        (("Residence permit and work permit", "الإقامة ورخصة العمل"), ("&#9744; Transport (SAR 300, optional)", "&#9744; المواصلات (300 ريال، اختياري)")),
        (("Health insurance (category C)", "التأمين الصحي (فئة C)"), ("&#9744; Food (SAR 300, optional)", "&#9744; الإعاشة (300 ريال، اختياري)")),
        (("Social insurance", "التأمينات الاجتماعية"), ("Recruitment from abroad (by nationality)", "الاستقدام من الخارج (بحسب الجنسية)")),
        (("End-of-service and leave provision", "مخصص نهاية الخدمة والإجازة"), ("Embassy and attestation charges, tickets of recruited workers", "رسوم السفارات والتصديق وتذاكر المستقدَمين")),
        (("Return ticket", "تذكرة العودة"), ("A second transfer (4,000) or third (6,000): the increase", "النقل الثاني (4,000) أو الثالث (6,000): الزيادة")),
        (("Visa or transfer of services (sponsorship transfer), first time: SAR 2,000", "التأشيرة أو نقل الخدمات (نقل الكفالة) لأول مرة: 2,000 ريال"), ("Overtime (1.5 times the hourly rate)", "العمل الإضافي (بساعة ونصف)")),
        (("Administrative and operating costs, and our fees", "التكاليف الإدارية والتشغيلية ورسومنا"), ("Tools and protective equipment; medical insurance above category C", "الأدوات ومعدات الحماية؛ التأمين الطبي لفئة أعلى من C")),
        (("Localisation fees", "رسوم التوطين"), ("Localisation fees of professions (technical and engineering under a decision)", "رسوم توطين المهن (الفنية والهندسية التي عليها قرار توطين)"))]
    ok_ = lambda t: ('<b style="color:#1a7f37">&#10003;</b> %s' % esc(t)) if t else ""
    no_ = lambda t: ('<b style="color:#c62828">&#10007;</b> %s' % t) if t else ""
    inc_rows = [[(ok_(i[0]), ok_(i[1]), "t"), (no_(x[0]), no_(x[1]), "t")] for i, x in inc_ex]
    incexc = bi_table([("Included in the monthly price", "يشمله السعر الشهري", False), ("Not included (on the Client)", "لا يشمله السعر (على العميل)", False)], inc_rows, [26, 26])
    inc_notes = ('<div class="nt"><div dir="ltr">Items not included are invoiced at actual cost or paid by you directly. The optional SAR 300 per item applies to salaries below SAR 3,000. Overtime = monthly fees ÷ 30 days ÷ 8 hours × 1.5.</div>'
                 '<div class="ar" dir="rtl">البنود غير المشمولة تُفوتَر بالتكلفة الفعلية أو تدفعها مباشرة. والـ300 ريال الاختيارية لمن راتبه أقل من 3,000 ريال. والعمل الإضافي = الرسوم الشهرية ÷ 30 ÷ 8 × 1.5.</div></div>')
    sheets.append(page(h2(4, "What the price includes and does not include", "ما يشمله السعر وما لا يشمله") + incexc + calc_box))
    gov_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(fe), "<b>%s</b>" % esc(fa), "t"), (ae, aa, "t"), (ie, ia, "t")]
                for i, (fe, fa, ae, aa, ie, ia) in enumerate(GOV_FEES, 1)]
    gov = bi_table([("#", "#", True), ("Government fee", "الرسوم الحكومية", False), ("Official amount", "المبلغ الرسمي", False), ("In this offer", "في هذا العرض", False)], gov_rows, [3, 14, 18, 18])
    govnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(GOV_NOTE[0]), esc(ar(GOV_NOTE[1])))
    loc_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (we, wa, "t")]
                for i, (te, ta, we, wa) in enumerate(LOCALISATION, 1)]
    loc = bi_table([("#", "#", True), ("Case", "الحالة", False), ("Localisation fee", "رسوم التوطين", False)], loc_rows, [3, 16, 36])
    locnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(LOC_NOTE[0]), esc(ar(LOC_NOTE[1])))
    tr_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (num(n(fee)), num(n(fee)), "c"), (pe, pa, "c")] for i, (te, ta, fee, pe, pa) in enumerate(TRANSFER, 1)]
    trf = bi_table([("#", "#", True), ("Government fee", "الرسوم الحكومية", False), ("SAR per worker", "ريال للعامل", True), ("In the monthly price", "في السعر الشهري", True)], tr_rows, [3, 22, 9, 16])
    trfnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(TRANSFER_NOTE[0]), esc(ar(TRANSFER_NOTE[1])))
    sheetsA.append(pageA(h2("A3", "Government fees explained", "توضيح الرسوم الحكومية") + gov + govnote + h2("A4", "Sponsorship transfer costs (workers inside the Kingdom)", "تكاليف نقل الكفالة (عمال من داخل المملكة)") + trf + trfnote))
    rec_rows = [[("<b>%s</b>" % esc(ne), "<b>%s</b>" % esc(na), "t"), (num(n(r)), num(n(r)), "c"), (num(n(t)), num(n(t)), "c"), (num(n(k3)), num(n(k3)), "c"), (num(n(r + t + k3)), num(n(r + t + k3)), "c"), (de, da, "c")]
                for ne, na, r, t, k3, de, da in REC_COUNTRY]
    rec = bi_table([("Nationality", "الجنسية", False), ("Recruitment from the country", "الاستقدام من الدولة", True), ("Contracts and attestation", "العقود والتصديق", True), ("Arrival ticket", "تذكرة القدوم", True), ("Total per worker, at cost", "الإجمالي للعامل بالتكلفة", True), ("Typical duration", "المدة المعتادة", True)], rec_rows, [12, 10, 10, 8, 10, 8])
    recnote = ('<div class="nt"><div dir="ltr">Recruitment from abroad is at actual cost, with no mark-up, on a separate invoice, and applies only to workers recruited from abroad. For a worker transferred from inside the Kingdom there are no recruitment-from-abroad costs. The amounts are the same for every trade.</div>'
               '<div class="ar" dir="rtl">الاستقدام من الخارج بالتكلفة الفعلية دون هامش، بفاتورة منفصلة، ويخص العمال المستقدَمين من الخارج فقط. أما العامل المنقول من داخل المملكة فلا توجد عليه تكاليف استقدام من الخارج. والمبالغ نفسها لكل المهن.</div></div>')
    sheetsA.append(pageA(h2("A5", "Localisation fee", "رسوم التوطين") + loc + locnote + h2("A6", "Recruitment from the country, by nationality", "الاستقدام من الدولة بحسب الجنسية") + rec + recnote))
    lc_rows = [[("<b>%s</b>" % esc(ie), "<b>%s</b>" % esc(ia), "t"), (te_, ta_, "c"), (ee_, ea_, "c")] for ie, ia, te_, ta_, ee_, ea_ in LOCCALC]
    lcalc = bi_table([("Item", "البند", False), ("Technical engineering (e.g. steel-structure fitter)", "فنية هندسية (مثل فني هياكل معدنية)", True), ("Engineering (engineer)", "هندسية (مهندس)", True)], lc_rows, [26, 14, 14])
    lcnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(LOCCALC_NOTE[0]), esc(ar(LOCCALC_NOTE[1])))
    sheetsA.append(pageA(h2("A7", "Technical and engineering workers: how the localisation fees and the worker price are calculated", "العمالة الفنية والهندسية: كيف تُحسب رسوم التوطين وسعر العامل") + lcalc + lcnote))
    nst_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (we, wa, "t")] for i, (te, ta, we, wa) in enumerate(NST, 1)]
    nst = bi_table([("#", "#", True), ("Topic", "البند", False), ("What it means", "ماذا يعني", False)], nst_rows, [3, 14, 38])
    nstnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(NST_NOTE[0]), esc(ar(NST_NOTE[1])))
    nst_page = h2("A3", "National and Non-National Shared Talent service", "خدمة الكوادر الوطنية وغير الوطنية المشتركة") + nst + nstnote

    # 5 المراحل والدفع والشروط
    stg_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (we, wa, "t"), (he, ha, "t")]
                for i, (te, ta, we, wa, he, ha) in enumerate(STAGES2, 1)]
    stg = bi_table([("#", "#", True), ("When", "متى", False), ("What you pay", "ماذا تدفع", False), ("How", "كيف", False)], stg_rows, [3, 11, 22, 14])
    pay_rows = [[("1", "1", "nx"), ("Advance", "الدفعة المقدمة", ""), ("Two months of the monthly price", "شهران من السعر الشهري", "c"), ("On signing", "عند التوقيع", "")],
                [("2", "2", "nx"), ("Monthly invoice — workers on duty", "فاتورة شهرية — العمال على رأس العمل", ""), ("100%", "100%", "c"), ("Within 7 days of the invoice", "خلال 7 أيام من الفاتورة", "")]]
    pay = bi_table([("#", "#", True), ("Payment", "الدفعة", False), ("Amount", "المقدار", True), ("Due", "الاستحقاق", False)], pay_rows, [4, 20, 14, 16])
    def saudi_table():
        sr = [[(num(n(m)), num(n(m)), "c")] + [pc(round(m * 0.85 * (a_ + 0.0275 + a_ + 0.0075))) for _, _, a_ in GOSI_PERIODS[:1]] + [pc(round(saudi_one(m, a_))) for _, _, a_ in GOSI_PERIODS] for m in SAUDI_SALARIES]
        return bi_table([("Monthly salary (SAR)", "الراتب الشهري (ريال)", True), ("Social insurance, employer and employee (" + GOSI_PERIODS[0][0] + ")", "التأمينات على صاحب العمل والمشترك (" + GOSI_PERIODS[0][1] + ")", True)]
                        + [("Monthly cost: " + e_, "التكلفة الشهرية: " + a_s, True) for e_, a_s, _ in GOSI_PERIODS], sr, [10, 16, 14, 14, 14])
    gosi_note = ('<div class="nt"><div dir="ltr">Social insurance on the subscriber (the employee) and the employer follows the GOSI decision, which raises the annuities rate by 0.5 point each July from 2025 to 2028 (9.5%, 10%, 10.5%, 11% on each side), plus 2% occupational hazards (employer) and 0.75% SANED (each side), on 85% of the salary. The cost therefore rises every July; end of service and leave are included in the cost.</div>'
                 '<div class="ar" dir="rtl">التأمينات الاجتماعية على المشترك (الموظف) وعلى صاحب العمل بحسب قرار التأمينات الاجتماعية، وترتفع نسبة المعاشات نصف نقطة كل يوليو من 2025 إلى 2028 (9.5% ثم 10% ثم 10.5% ثم 11% على كل طرف)، مع 2% أخطار مهنية (صاحب العمل) و0.75% ساند (على كل طرف)، على 85% من الأجر. فتزداد التكلفة كل يوليو؛ وتشمل التكلفة نهاية الخدمة والإجازة.</div></div>')
    roles_t = bi_table([("Role", "الوظيفة", False), ("Salary used", "الراتب المعتمد", True)], [[(re_, ra_, "t"), (se_, sa_, "c")] for re_, ra_, se_, sa_ in SAUDI_ROLES], [30, 16])
    saudi_box = '' if not CALC_SAUDI_URL else ('<div class="nt"><div dir="ltr"><b>Saudi employee cost calculator</b> (professional and non-professional roles): <b>%s</b></div>'
                 '<div class="ar" dir="rtl"><b>الآلة الحاسبة لتكلفة الموظف السعودي</b> (المهني وغير المهني):<br><b dir="ltr">%s</b></div></div>') % (CALC_SAUDI_URL, CALC_SAUDI_URL)
    _ref = bi_table([("Topic", "الموضوع", False), ("What to check", "ما يُراجَع", False), ("Official reference", "المرجع الرسمي", False)], [
        [("<b>Professions and localisation</b>", "<b>المهن والتوطين</b>", "t"), ("Localisation decision of the profession and the procedural guide of the Ministry of Human Resources.", "قرار توطين المهنة والدليل الإجرائي لوزارة الموارد البشرية.", "t"), (num("hrsd.gov.sa") + "<br>" + num("businesspartner.sa/compliance-solutions"), num("hrsd.gov.sa") + "<br>" + num("businesspartner.sa/compliance-solutions"), "t")],
        [("<b>Social insurance</b>", "<b>التأمينات الاجتماعية</b>", "t"), ("Contribution rates and the yearly rise in July.", "نسب الاشتراك وزيادتها السنوية في يوليو.", "t"), (num("www.gosi.gov.sa"), num("www.gosi.gov.sa"), "t")]], [13, 24, 31])
    saudi_page = h2("A4", "Cost of a Saudi employee, by role and salary", "تكلفة الموظف السعودي بحسب الوظيفة والراتب") + roles_t + saudi_table() + gosi_note + _ref
    def model_table():
        ks = [(k_, v_) for k_, v_ in LEVELS.items() if k_ in PRICE_LEVELS]
        def split(a, loc):
            fixed = 9700/12.0 + 650/12.0 + 200/12.0 + 2000/12.0 + 50 + 125   # بنود حكومية وتذكرة تُفوتَر بالفعلي عند استحقاقها
            full = worker_price(a, loc, months=12)
            return full, full - fixed, fixed * 12
        mr = []
        for k2, (le, la, sal, loc) in ks:
            full, rec, ann = split(sal, loc)
            mr.append([(le, la, "t"), pc(sal), pc(round(full)), pc(round(rec)), pc(round(ann))])
        return bi_table([("Level", "المستوى", False), ("Salary", "الراتب", True), ("Full cost: monthly, fixed", "التكلفة الكاملة: شهرياً ثابتة", True), ("Transparent cost: monthly invoice", "التكلفة بشفافية: الفاتورة الشهرية", True), ("Transparent cost: government items at actual, per year", "التكلفة بشفافية: البنود الحكومية بالفعلي سنوياً", True)], mr, [14, 9, 12, 14, 18])
    model_note = ('<div class="nt"><div dir="ltr"><b>Two models, same total.</b> <b>Full cost:</b> one fixed monthly amount that includes the government costs, spread over the contract. <b>Transparent cost:</b> a monthly invoice plus the government costs (permit and levy, residence, medical insurance, exit and re-entry, visa or transfer of services (sponsorship transfer), return ticket) at their actual amount when they fall due, with our fees fixed. Only the timing of payment differs.</div>'
                  '<div class="ar" dir="rtl"><b>نموذجان بإجمالي واحد.</b> <b>التكلفة الكاملة:</b> مبلغ شهري ثابت واحد يشمل التكاليف الحكومية موزَّعة على مدة العقد. <b>التكلفة بشفافية:</b> فاتورة شهرية، والتكاليف الحكومية (رخصة العمل والمقابل، الإقامة، التأمين الطبي، الخروج والعودة، التأشيرة أو نقل الخدمات (نقل الكفالة)، تذكرة العودة) بمبلغها الفعلي عند استحقاقها، ورسومنا ثابتة. والفرق في توقيت الدفع فقط.</div></div>')
    model_pick = ('<div class="nt"><div dir="ltr">Choose the model: &nbsp; \u2610 Full cost &nbsp;&nbsp; \u2610 Transparent cost</div>'
                  '<div class="ar" dir="rtl">اختر النموذج: &nbsp; \u2610 التكلفة الكاملة &nbsp;&nbsp; \u2610 التكلفة بشفافية</div></div>')
    sheets_model_page = h2("A5", "Two models: full cost or transparent cost", "نموذجان: التكلفة الكاملة أو التكلفة بشفافية") + model_table() + h2("A6", "If the contract is 24 months: the difference", "إذا كان العقد 24 شهراً: الفرق") + diff_table() + diffnote
    sheetsA.insert(0, pageA(scope_page + calc_page))
    # ---- صفحة لكل نموذج + جدول الفروقات (للعرض المفصل)، بمثال عامل ماهر
    _sal = LEVELS["skilled"][2]; _p = worker_price(_sal, 900, months=12); _pf = _p - FACTORY_DISCOUNT
    _gov_items = [("Work permit and levy", "رخصة العمل والمقابل المالي", 9700, "yearly", "سنوياً"), ("Residence permit", "الإقامة", 650, "yearly", "سنوياً"), ("Medical insurance", "التأمين الطبي", 600, "yearly", "سنوياً"),
                  ("Exit and re-entry", "الخروج والعودة", 200, "yearly", "سنوياً"), ("Visa or transfer of services (sponsorship transfer)", "التأشيرة أو نقل الخدمات (نقل الكفالة)", 2000, "once", "مرة واحدة"), ("Return ticket", "تذكرة العودة", 1500, "at the end", "عند نهاية العقد")]
    _fixed_m = sum(x[2] for x in _gov_items) / 12.0
    _inv = _p - _fixed_m
    def kv(rows_): return bi_table([("Item", "البند", False), ("Amount (SAR)", "المبلغ (ريال)", True)], [[(e, a_, "t"), (num(n(v)) if isinstance(v, int) else v, num(n(v)) if isinstance(v, int) else v, "c")] for e, a_, v in rows_], [30, 12])
    def note_(en, ar_): return '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (en, ar_)
    def exp_table(rows_):
        return bi_table([("Point", "البند", False), ("Explanation", "الشرح", False)], [[("<b>%s</b>" % e1, "<b>%s</b>" % a1, "t"), (e2, a2, "t")] for e1, a1, e2, a2 in rows_], [14, 44])
    _ex = ("Example: a skilled worker, salary SAR %s, 12-month contract." % n(_sal), "المثال: عامل ماهر راتبه %s ريال، عقد 12 شهراً." % n(_sal))
    _gov_m = 9700/12.0 + 650/12.0 + 200/12.0 + 2000/12.0
    _bd = breakdown(_sal, 12)
    _inv_rows = [("Salary", "الراتب", _sal), ("Ajeer platform", "منصة أجير", 23), ("Social insurance (2% of 85% of the salary)", "التأمينات الاجتماعية (2% من 85% من الراتب)", _sal * 0.85 * 0.02),
                 ("End-of-service provision (salary ÷ 24)", "مخصص نهاية الخدمة (الراتب ÷ 24)", _sal / 24.0), ("Leave provision (salary ÷ 30 × 21 ÷ 12)", "مخصص الإجازة (الراتب ÷ 30 × 21 ÷ 12)", _sal / 30.0 * 21 / 12.0),
                 ("Administrative and operating costs", "التكاليف الإدارية والتشغيلية", OVERHEAD), ("Our fees (10% of the costs)", "رسومنا (10% من التكاليف)", _bd["fee"]),
                 ("Localisation fees", "رسوم التوطين", 900)]
    _fees_m = OVERHEAD + _bd["fee"] + 900     # الرسوم الشهرية: التكاليف الإدارية والتشغيلية + رسومنا + التوطين (عليها الضريبة وحدها)
    _inv_tbl = bi_table([("Monthly invoice, per worker (example: skilled worker, salary SAR %s)" % n(_sal), "الفاتورة الشهرية للعامل (مثال: عامل ماهر راتبه %s ريال)" % n(_sal), False), ("Amount (SAR)", "المبلغ (ريال)", True), ("VAT", "الضريبة", True)],
                        [[(e, a_, "t"), (num(n(round(v))), num(n(round(v))), "c"), (("15%", "15%") if k in (5, 6) else ("No", "لا")) + ("c",)] for k, (e, a_, v) in enumerate(_inv_rows)]
                        + [{"cls": "tot", "cells": [("Monthly invoice (before VAT)", "الفاتورة الشهرية (قبل الضريبة)", ""), (num(n(round(_inv))), num(n(round(_inv))), "c"), ("", "", "")]}], [30, 12, 8])

    _tot12 = _p * 12
    def stages(rows_): return bi_table([("#", "#", True), ("Stage", "المرحلة", False), ("What you pay", "ماذا تدفع", False), ("Amount (SAR)", "المبلغ (ريال)", True)], rows_, [3, 14, 36, 12])
    def sr_(k, en1, ar1, en2, ar2, v): return [(str(k), str(k), "nx"), ("<b>%s</b>" % en1, "<b>%s</b>" % ar1, "t"), (en2, ar2, "t"), ((num(n(v)), num(n(v)), "c") if isinstance(v, int) else (v, v, "c"))]
    same_note = note_("The total over the contract is the same in Model 1 and Model 2: SAR %s per worker for 12 months (skilled worker, salary SAR %s). Only the way it is divided and paid differs." % (n(_tot12), n(_sal)),
                      "الإجمالي على مدة العقد هو نفسه في النموذجين الأول والثاني: %s ريال للعامل عن 12 شهراً (عامل ماهر راتبه %s ريال). والذي يختلف هو طريقة التقسيم والدفع فقط." % (n(_tot12), n(_sal)))
    _full_rows = [("Salary", "الراتب", _sal), ("Ajeer platform", "منصة أجير", 23), ("Social insurance (2% of 85% of the salary)", "التأمينات الاجتماعية (2% من 85% من الراتب)", _sal * 0.85 * 0.02),
                  ("End-of-service provision (salary ÷ 24)", "مخصص نهاية الخدمة (الراتب ÷ 24)", _sal / 24.0), ("Leave provision (salary ÷ 30 × 21 ÷ 12)", "مخصص الإجازة (الراتب ÷ 30 × 21 ÷ 12)", _sal / 30.0 * 21 / 12.0),
                  ("Work permit and levy (9,700 ÷ 12)", "رخصة العمل والمقابل المالي (9,700 ÷ 12)", 9700 / 12.0), ("Residence permit (650 ÷ 12)", "الإقامة (650 ÷ 12)", 650 / 12.0), ("Medical insurance, category C (600 ÷ 12)", "التأمين الطبي فئة C (600 ÷ 12)", 50),
                  ("Exit and re-entry (200 ÷ 12)", "الخروج والعودة (200 ÷ 12)", 200 / 12.0), ("Visa or transfer of services (2,000 ÷ 12)", "التأشيرة أو نقل الخدمات (2,000 ÷ 12)", 2000 / 12.0), ("Return ticket (1,500 ÷ 12)", "تذكرة العودة (1,500 ÷ 12)", 125),
                  ("Administrative and operating costs", "التكاليف الإدارية والتشغيلية", OVERHEAD), ("Our fees (10% of the costs)", "رسومنا (10% من التكاليف)", _bd["fee"]), ("Localisation fees", "رسوم التوطين", 900)]
    _fx = OVERHEAD + _bd["fee"] + 900                      # التكاليف الإدارية + رسومنا + التوطين (عليها الضريبة وحدها)
    _fxv = OVERHEAD + _bd["fee"]                           # الإدارية والتشغيلية + رسومنا: أساس الضريبة (التوطين بلا ضريبة)
    _vat_m = _fxv * 0.15
    _vrows = [[(e, a_, "t"), (num(n(round(v))), num(n(round(v))), "c"), (("15%", "15%") if k in (11, 12) else ("No", "لا")) + ("c",)] for k, (e, a_, v) in enumerate(_full_rows)]
    _full_tbl = bi_table([("Fixed monthly price, per worker (example: skilled worker, salary SAR %s)" % n(_sal), "السعر الشهري الثابت للعامل (مثال: عامل ماهر راتبه %s ريال)" % n(_sal), False), ("Amount (SAR)", "المبلغ (ريال)", True), ("VAT", "الضريبة", True)],
                         _vrows + [{"cls": "tot", "cells": [("Fixed monthly price (before VAT)", "السعر الشهري الثابت (قبل الضريبة)", ""), (num(n(int(_p))), num(n(int(_p))), "c"), ("", "", "")]},
                                   [("VAT 15% on administrative and operating costs and our fees only", "ضريبة 15% على التكاليف الإدارية والتشغيلية ورسومنا فقط", "t"), (num(n(round(_vat_m))), num(n(round(_vat_m))), "c"), ("", "", "")],
                                   {"cls": "tot", "cells": [("Monthly invoice (with VAT)", "الفاتورة الشهرية (مع الضريبة)", ""), (num(n(round(_p + _vat_m))), num(n(round(_p + _vat_m))), "c"), ("", "", "")]}], [30, 12, 8])
    m1 = (h2("M1", "Model 1 — Full cost", "النموذج الأول — التكلفة الكاملة") +
          exp_table([("How it works", "كيف يعمل", "One fixed monthly amount per worker that already includes every government cost (work permit and levy, residence, medical insurance, exit and re-entry, visa or transfer of services, return ticket), spread over the contract.", "مبلغ شهري ثابت واحد للعامل يشمل مسبقاً كل التكاليف الحكومية (رخصة العمل والمقابل، الإقامة، التأمين الطبي، الخروج والعودة، التأشيرة أو نقل الخدمات، تذكرة العودة) موزَّعة على العقد."),
                     ("Other invoices", "فواتير أخرى", "None: no separate government invoice.", "لا شيء: لا فاتورة حكومية منفصلة.")]) +
          _full_tbl)
    m1s = (stages([sr_(1, "On signing", "عند التوقيع", "Advance of two months of the monthly price, with 15% VAT on administrative and operating costs and our fees only.", "دفعة مقدمة شهران من السعر الشهري، مع ضريبة 15% على التكاليف الإدارية والتشغيلية ورسومنا فقط.", int((_p + _vat_m) * 2)),
                  sr_(2, "Every month", "كل شهر", "The fixed monthly price with 15% VAT on administrative and operating costs and our fees only, invoiced for the workers on duty. Payable within 7 days.", "السعر الشهري الثابت مع ضريبة 15% على التكاليف الإدارية والتشغيلية ورسومنا فقط، للعمال على رأس العمل. يُسدَّد خلال 7 أيام.", int(_p + _vat_m)),
                  sr_(3, "Government costs", "التكاليف الحكومية", "Inside the monthly price. Nothing more to pay.", "داخل السعر الشهري. لا شيء إضافي.", 0)]) +
          same_note)
    _m3 = _sal + _sal * 0.85 * 0.02                         # الراتب + اشتراك التأمينات (بلا ضريبة)
    _stage2_year = 9700 + 650 + 600 + 276 + 200            # رخصة العمل + الإقامة + الطبي (فئة C) + أجير + الخروج والعودة
    _end_year = _sal / 24.0 * 12 + _sal / 30.0 * 21 + 1500  # نهاية الخدمة + الإجازة + تذكرة العودة (12 شهراً)
    _opts = [("3 months", "3 أشهر", 3), ("6 months", "6 أشهر", 6), ("9 months", "9 أشهر", 9), ("12 months", "12 شهراً", 12)]
    _inst_tbl = bi_table([("Pay the arrival and preparation costs over", "سداد تكاليف الوصول والتجهيز على", False), ("Per month (SAR)", "شهرياً (ريال)", True)],
                         [[(e, a_, "t"), (num(n(-(-_stage2_year // k))), num(n(-(-_stage2_year // k))), "c")] for e, a_, k in _opts] + [[("Four quarterly instalments, from the month you choose", "أربع دفعات ربع سنوية، من الشهر الذي تختاره", "t"), (num(n(-(-_stage2_year // 4))), num(n(-(-_stage2_year // 4))), "c")]], [30, 12])
    def bl(*items): return "<br>".join("&bull; " + x for x in items)
    _ins = _sal * 0.85 * 0.02
    _q = int(-(-_stage2_year // 4))
    _sg = int(_sal * 2 + (_fx + _vat_m))
    m2 = (h2("M2", "Model 2 — Transparent cost", "النموذج الثاني — التكلفة بشفافية") +
          exp_table([("How it works", "كيف يعمل", "Each cost is paid at its actual amount, without mark-up, in the stage where it falls due. The total over the contract is the same as Model 1.", "تُدفع كل تكلفة بمبلغها الفعلي دون هامش في المرحلة التي تستحق فيها. والإجمالي على العقد هو نفسه في النموذج الأول.")]) +
          stages([sr_(0, "On signing", "عند التوقيع", bl("Two months of basic salary: 2 × %s = %s (no VAT)" % (n(_sal), n(_sal * 2)), "Monthly fees: localisation %s (no VAT) + administrative and operating and our fees %s, plus 15%% VAT %s" % (n(900), n(round(_fxv)), n(round(_vat_m)))),
                                                    bl("راتب أساسي لشهرين: 2 × %s = %s (بلا ضريبة)" % (n(_sal), n(_sal * 2)), "الرسوم الشهرية: التوطين %s (بلا ضريبة) + التكاليف الإدارية والتشغيلية ورسومنا %s، وعليها ضريبة 15%% %s" % (n(900), n(round(_fxv)), n(round(_vat_m)))), _sg),
                  sr_(1, "Stage 1: entry", "المرحلة 1: الدخول", bl("Visa or transfer of services (sponsorship transfer), once: 2,000", "Recruited from abroad: recruitment from the country, contract attestation and arrival ticket, by nationality, at actual cost, separate"),
                                                    bl("التأشيرة أو نقل الخدمات (نقل الكفالة) مرة واحدة: 2,000", "للمستقدَم من الخارج: الاستقدام من الدولة وتصديق العقود وتذكرة الوصول، بحسب الجنسية، بالتكلفة الفعلية، منفصلة"), 2000),
                  sr_(2, "Stage 2: arrival and preparation", "المرحلة 2: الوصول والتجهيز", bl("Work permit and levy: 9,700", "Residence: 650", "Medical insurance, category C: 600", "Ajeer: 276", "Exit and re-entry: 200", "Paid quarterly: 4 × %s, from the month you choose" % n(_q)),
                                                    bl("رخصة العمل والمقابل المالي: 9,700", "الإقامة: 650", "التأمين الطبي فئة C: 600", "أجير: 276", "الخروج والعودة: 200", "تُسدَّد ربع سنوياً: 4 × %s، من الشهر الذي تختاره" % n(_q)), int(_stage2_year)),
                  sr_(3, "Stage 3: monthly invoice", "المرحلة 3: الفاتورة الشهرية", bl("Salary: %s (no VAT)" % n(_sal), "Social insurance: %s (no VAT)" % n(round(_ins)), "Localisation fees: %s (no VAT)" % n(900), "Administrative and operating %s + our fees %s = %s, plus 15%% VAT %s" % (n(OVERHEAD), n(round(_bd["fee"])), n(round(_fxv)), n(round(_vat_m))), "Payable within 7 days"),
                                                    bl("الراتب: %s (بلا ضريبة)" % n(_sal), "التأمينات الاجتماعية: %s (بلا ضريبة)" % n(round(_ins)), "رسوم التوطين: %s (بلا ضريبة)" % n(900), "الإدارية والتشغيلية %s + رسومنا %s = %s، وعليها ضريبة 15%% %s" % (n(OVERHEAD), n(round(_bd["fee"])), n(round(_fxv)), n(round(_vat_m))), "يُسدَّد خلال 7 أيام"), int(_m3 + (_fx + _vat_m))),
                  sr_(4, "Stage 4: end of the contract", "المرحلة 4: نهاية العقد", bl("End of service: %s" % n(round(_sal / 24.0 * 12)), "Leave pay: %s" % n(round(_sal / 30.0 * 21)), "Return ticket: 1,500 (actual cost)"),
                                                    bl("نهاية الخدمة: %s" % n(round(_sal / 24.0 * 12)), "بدل الإجازة: %s" % n(round(_sal / 30.0 * 21)), "تذكرة العودة: 1,500 (بالتكلفة الفعلية)"), int(_end_year))]))
    _inv_m = int(_m3 + (_fx + _vat_m))
    def _tl(en, ar, g, inv, fee, cls=None):
        cells = [(en, ar, "t"), (num(g) if g else "-", num(g) if g else "-", "c"), (num(inv) if inv else "-", num(inv) if inv else "-", "c"), (num(fee) if fee else "-", num(fee) if fee else "-", "c")]
        return {"cls": cls, "cells": cells} if cls else cells
    _fee_m = n(round(_fxv) + round(_vat_m))
    _g1 = n(2000 + _q)
    m2t = (h2("M2T", "Model 2 — Payment timeline (example: quarterly, starting in month 1)", "النموذج الثاني — الجدول الزمني للدفعات (مثال: ربع سنوي من الشهر 1)") +
           note_("The payment on signing is credited against the last monthly invoices of the contract.", "الدفعة عند التوقيع تُخصم من آخر الفواتير الشهرية في العقد.") +
           bi_table([("When", "متى", False), ("Government payments", "المدفوعات الحكومية", True), ("Monthly invoice (with VAT)", "الفاتورة الشهرية (مع الضريبة)", True), ("of which our fees and administrative costs (with VAT)", "منها رسومنا والإدارية (مع الضريبة)", True)],
                    [_tl("On signing: 2 months of salary + the monthly fees", "عند التوقيع: راتب شهرين + الرسوم الشهرية", "", n(_sg), _fee_m),
                     _tl("Month 1: arrival (entry 2,000 + first quarterly instalment)", "الشهر 1: الوصول (الدخول 2,000 + أول دفعة ربع سنوية)", _g1, n(_inv_m), _fee_m),
                     _tl("Months 2 and 3", "الشهران 2-3", "", n(_inv_m), _fee_m),
                     _tl("Month 4: second quarterly instalment", "الشهر 4: الدفعة الربع سنوية الثانية", n(_q), n(_inv_m), _fee_m),
                     _tl("Months 5 and 6", "الشهران 5-6", "", n(_inv_m), _fee_m),
                     _tl("Month 7: third quarterly instalment", "الشهر 7: الدفعة الربع سنوية الثالثة", n(_q), n(_inv_m), _fee_m),
                     _tl("Months 8 and 9", "الشهران 8-9", "", n(_inv_m), _fee_m),
                     _tl("Month 10: fourth quarterly instalment", "الشهر 10: الدفعة الربع سنوية الرابعة", n(_q), n(_inv_m), _fee_m),
                     _tl("Month 11", "الشهر 11", "", n(_inv_m), _fee_m),
                     _tl("Month 12, Stage 4: end of service, leave, return ticket", "الشهر 12، المرحلة 4: نهاية الخدمة والإجازة وتذكرة العودة", n(int(_end_year)), n(_inv_m), _fee_m)], [34, 11, 12, 12]))
    _st2 = [("Work permit and levy", "رخصة العمل والمقابل المالي", 9700), ("Residence permit", "الإقامة", 650), ("Medical insurance, category C", "التأمين الطبي فئة C", 600), ("Ajeer platform", "منصة أجير", 276), ("Exit and re-entry", "الخروج والعودة", 200)]
    m2i = (h2("M2", "Model 2 — Stage 2: arrival and preparation, paid quarterly", "النموذج الثاني — المرحلة 2: الوصول والتجهيز، تُسدَّد ربع سنوياً") +
           bi_table([("Item", "البند", False), ("For the year (SAR)", "للسنة (ريال)", True), ("Per quarter (SAR)", "للربع (ريال)", True)],
                    [[(e_, a_, "t"), (num(n(v)), num(n(v)), "c"), (num(n(-(-v // 4))), num(n(-(-v // 4))), "c")] for e_, a_, v in _st2] +
                    [{"cls": "tot", "cells": [("Stage 2 total", "إجمالي المرحلة 2", ""), (num(n(int(_stage2_year))), num(n(int(_stage2_year))), "c"), (num(n(-(-_stage2_year // 4))), num(n(-(-_stage2_year // 4))), "c")]}], [30, 12, 12]) +
           _inst_tbl)
    def _grp(en, ar): return {"cls": "tot", "cells": [(en, ar, ""), ("", "", "c"), ("", "", "c")]}
    _sidx = {"S1": [9], "S2": [1, 5, 6, 7, 8], "S3": [0, 2, 13, 11, 12], "S4": [3, 4, 10]}
    _gt = [("S1", "Stage 1: entry", "المرحلة 1: الدخول"), ("S2", "Stage 2: arrival and preparation", "المرحلة 2: الوصول والتجهيز"), ("S3", "Stage 3: monthly invoice", "المرحلة 3: الفاتورة الشهرية"), ("S4", "Stage 4: end of the contract", "المرحلة 4: نهاية العقد")]
    _m2rows = []
    for key, en_, ar_ in _gt:
        _m2rows.append(_grp(en_, ar_))
        for k in _sidx[key]:
            e_, a_, v = _full_rows[k]
            _m2rows.append([(e_, a_, "t"), (num(n(round(v))), num(n(round(v))), "c"), (("15%", "15%") if k in (11, 12) else ("No", "لا")) + ("c",)])
    m2b = (h2("M2", "Model 2 — The monthly cost by stage (the same as Model 1)", "النموذج الثاني — التكلفة الشهرية حسب المراحل (هي نفسها في النموذج الأول)") +
           bi_table([("Per worker (example: skilled worker, salary SAR %s)" % n(_sal), "للعامل (مثال: عامل ماهر راتبه %s ريال)" % n(_sal), False), ("Amount (SAR)", "المبلغ (ريال)", True), ("VAT", "الضريبة", True)],
                    _m2rows + [{"cls": "tot", "cells": [("Monthly cost (before VAT)", "التكلفة الشهرية (قبل الضريبة)", ""), (num(n(int(_p))), num(n(int(_p))), "c"), ("", "", "c")]},
                               [("VAT 15% on administrative and operating costs and our fees only", "ضريبة 15% على التكاليف الإدارية والتشغيلية ورسومنا فقط", "t"), (num(n(round(_vat_m))), num(n(round(_vat_m))), "c"), ("", "", "c")]], [34, 12, 8]) + same_note)
    m3 = (h2("M3", "Model 3 — National and Non-National Shared Talent services", "النموذج الثالث — خدمات الكوادر الوطنية وغير الوطنية المشتركة") +
          exp_table([("How it works", "كيف تعمل", "Saudi and non-Saudi employees employed by Business Partner work with you, part-time or flexibly, so Saudis count in your Saudization without you hiring them full-time.", "موظفون سعوديون وغير سعوديين يوظّفهم Business Partner يعملون لديك بدوام جزئي أو مرن، فيُحتسب السعوديون في توطينك دون أن توظّفهم بدوام كامل."),
                     ("Cost", "التكلفة", "The cost of each Saudi is shared with you.", "تُقسَّم تكلفة كل سعودي معك."),
                     ("Price", "السعر", "The price per worker under this item is shown in the price table. It works with Model 1 or Model 2.", "سعر العامل على هذا البند في جدول الأسعار. وتعمل مع النموذج الأول أو الثاني.")]) +
          nst +
          kv([("Monthly price under this item", "السعر الشهري على هذا البند", _pf)]))
    _cmp = [
        (("Monthly amount", "المبلغ الشهري"), ("Fixed: %s" % n(_p), "ثابت: %s" % n(_p)), ("Same: %s" % n(_p), "نفسه: %s" % n(_p)), ("Shared Talent price: %s" % n(_pf), "سعر الكوادر المشتركة: %s" % n(_pf))),
        (("On signing", "عند التوقيع"), ("2 months of the price", "شهران من السعر"), ("2 months of basic salary + the monthly fees", "راتب شهرين + الرسوم الشهرية"), ("As Model 1 or 2", "كالنموذج الأول أو الثاني")),
        (("Government costs", "التكاليف الحكومية"), ("Inside the price", "داخل السعر"), ("Actual amount, when due", "بالفعلي عند الاستحقاق"), ("As in Model 1 or 2", "كما في النموذج الأول أو الثاني")),
        (("Total over the contract", "الإجمالي على العقد"), ("Same as Model 2", "مثل النموذج الثاني"), ("Same as Model 1", "مثل النموذج الأول"), ("At the Shared Talent price", "بسعر الكوادر المشتركة")),
        (("Who it suits", "لمن يناسب"), ("A fixed monthly amount", "مبلغ شهري ثابت"), ("Seeing the actual costs", "رؤية التكاليف الفعلية"), ("Contracts under the National and Non-National Shared Talent item", "تعاقد على بند الكوادر الوطنية وغير الوطنية المشتركة"))]
    m4 = (h2("M4", "Differences between the three models", "الفروقات بين النماذج الثلاثة") +
          bi_table([("", "", False), ("Model 1 — Full cost", "النموذج الأول — التكلفة الكاملة", False), ("Model 2 — Transparent cost", "النموذج الثاني — التكلفة بشفافية", False), ("Model 3 — Shared Talent services", "النموذج الثالث — خدمات الكوادر الوطنية وغير الوطنية المشتركة", False)],
                   [[("<b>%s</b>" % esc(r[0][0]), "<b>%s</b>" % esc(r[0][1]), "t")] + [(esc(c[0]), esc(c[1]), "t") for c in r[1:]] for r in _cmp], [12, 18, 18, 18]) +
          note_("Example: a skilled worker, salary SAR %s, 12-month contract, before VAT. Prices follow the salary you choose; the calculator recomputes them." % n(_sal), "المثال: عامل ماهر راتبه %s ريال، عقد 12 شهراً، قبل الضريبة. وتتبع الأسعار الراتب الذي تختاره؛ والآلة الحاسبة تعيد حسابها." % n(_sal)))
    _model_pages = [pageA(_pg) for _pg in (m1, m1s, m2, m2t, m2i, m2b, m3, m4)]

    sheetsA.append(pageA(saudi_page))
    sheetsA.insert(1, pageA(sheets_model_page))
    sheetsA.append(pageA(h2("A8", "What you pay and when", "ماذا تدفع ومتى") + stg))
    sheetsA.append(pageA(h2("A9", "Terms and conditions", "الشروط والأحكام") + numbered([(esc(e), esc(a)) for e, a in TERMS], "Term", "الشرط")))

    # 6 التوقيعان
    sg = ('<div class="rw"><div class="col" dir="ltr"><p>By signing below, both parties accept this quotation and its terms and conditions.</p></div>'
          '<div class="col" dir="rtl"><p>%s</p></div></div>') % esc(ar("بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه."))
    page(h2(5, "Your options", "خياراتك") + opt_box)
    page(h2(6, "Signatures", "التوقيعان") + sg + sig_boxes(right_co=esc(CLIENT_AR)))

    def closing(i, n):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
                '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
                '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 / طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714<br>'
                'Mobile / الجوال: %s<br>Email / الإيميل: %s<br>Website / الموقع: %s</div>'
                '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: Business Partner Solutions / بزنس بارتنر سلوشنز<br>Bank / البنك: %s<br>IBAN: %s</div></div></div></div></section>') % (
            num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), esc(BANK), num(IBAN))
    def find(lst, sub):
        r = [x for x in lst if sub in x]
        assert r, sub
        return r[0]
    def pack(blocks, mk, title, tail=0):
        SOLO = ('<span class="n">M1</span>', '<span class="n">M2</span>', '<span class="n">M2T</span>')
        import subprocess, tempfile
        tmp = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8")
        tmp.write(doc(title, css, [mk('<div data-m="b%d">%s</div>' % (k, x)) for k, x in enumerate(blocks)])); tmp.close()
        out = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "render.cjs"), "measure", tmp.name], capture_output=True, text=True, check=True).stdout
        os.unlink(tmp.name)
        hs = json.loads(out.strip().splitlines()[-1]); CAP = int(os.environ.get("PACK_CAP", "553"))
        if os.environ.get("PACK_DEBUG"): print("heights", title, {k: round(v) for k, v in hs.items()}, file=sys.stderr)
        pages_, rest = [], list(range(len(blocks)))
        while rest:
            cur = [rest.pop(0)]; h = hs["b%d" % cur[0]]
            for k in list(rest[:3]):
                if any(s in blocks[k] or s in blocks[cur[0]] for s in SOLO): continue
                if tail and cur[0] < len(blocks) - tail and k >= len(blocks) - tail: continue
                if h + hs["b%d" % k] <= CAP:
                    cur.append(k); h += hs["b%d" % k]; rest.remove(k)
            pages_.append([blocks[k] for k in sorted(cur)])
        return [mk("".join(p)) for p in pages_]
    m_bank = (h2(7, "Payment details and national address", "بيانات الدفع والعنوان الوطني") +
              bi_table([("Item", "البند", False), ("Details", "البيانات", False)], [
                  [("<b>Beneficiary</b>", "<b>المستفيد</b>", "t"), ("Business Partner Solutions", "بزنس بارتنر سلوشنز", "t")],
                  [("<b>Bank</b>", "<b>البنك</b>", "t"), (esc(BANK), esc(BANK), "t")],
                  [("<b>IBAN</b>", "<b>الآيبان</b>", "t"), (num(IBAN), num(IBAN), "t")],
                  [("<b>National address</b>", "<b>العنوان الوطني</b>", "t"), ("RDAA9214 · Building 9214, King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 · Secondary no. 5076", "RDAA9214 · مبنى 9214، طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714 · الرقم الفرعي 5076", "t")]], [14, 44]))
    page(m_bank)
    m_prices = find(REC_MAIN, "Trades, salaries and price"); m_nst = find(REC_MAIN, "Calculation under the Shared Talent"); m_models = find(REC_MAIN, "Three models"); m_incl = find(REC_MAIN, "What the price includes")
    m_opts = find(REC_MAIN, "Your options"); m_sign = find(REC_MAIN, "Signatures")
    m_incl_s = m_incl.replace('<span class="n">4</span>', '<span class="n">5</span>'); m_opts_s = m_opts.replace('<span class="n">5</span>', '<span class="n">4</span>')
    simple_pages = pack([m_prices, m_models, m_opts_s, m_incl_s, m_sign, m_bank], page, "q", tail=2)
    A = REC_ANNEX
    annex_blocks = [m1, m1s, m2, m2t, m2i, m2b, m3, m4, sheets_model_page, scope_page, calc_page, find(A, "Government fees explained"), find(A, 'h2("A5"') if False else find(A, "Localisation fee"),
                    find(A, "Technical and engineering workers: how"), saudi_page, find(A, "What you pay and when"), find(A, "Terms and conditions")]
    detail_pages = pack([m_prices, m_models, m_incl] + annex_blocks + [m_opts, m_sign, m_bank], pageA, "qa", tail=2)
    return sar_mark(doc("Quotation (simple) — Workforce Supply", css, [sheets[0]] + simple_pages + [])), sar_mark(doc("Quotation (detailed) — ISR Trading (Workforce)", css, [sheets[0]] + detail_pages + [closing]))

# ------------------------------------------------------------------ العقد وNDA (A4 عمودي)
def hd_port(en, a, sub_en):
    return ('<div class="hd" dir="ltr"><span class="logo" role="img" aria-label="Business Partner"></span>'
            '<div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">%s</h1><div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">%s</div></div></div>') % (esc(a), esc(en))

def parties_html():
    me = ('<table class="pty2"><tr><th colspan="3"><span>First Party (Service Provider)</span><span dir="rtl">الطرف الأول (مزوّد الخدمة)</span></th></tr>'
          '<tr><td>Name</td><td class="v">Business Partner Solutions<br><span dir="rtl">شركة بزنس بارتنر سلوشنز</span></td><td>الاسم</td></tr>'
          '<tr><td>Unified / CR No.</td><td class="v">%s</td><td>الرقم الموحد / السجل التجاري</td></tr>'
          '<tr><td>VAT No.</td><td class="v">%s</td><td>الرقم الضريبي</td></tr>'
          '<tr><td>National Address</td><td class="v">%s</td><td>العنوان الوطني</td></tr>'
          '<tr><td>Represented by</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>يمثلها</td></tr>'
          '<tr><td>Title</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>الصفة</td></tr></table>') % (num("7038825860"), num("312079341500003"), num("RDAA9214"), esc(REP_EN), esc(REP_AR), esc(REP_TITLE_EN), esc(REP_TITLE_AR))
    cl = ('<table class="pty2"><tr><th colspan="3"><span>Second Party (Client)</span><span dir="rtl">الطرف الثاني (العميل)</span></th></tr>'
          '<tr><td>Name</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>الاسم</td></tr>'
          '<tr><td>Unified / CR No.</td><td class="v">%s</td><td>الرقم الموحد / السجل التجاري</td></tr>'
          '<tr><td>VAT No.</td><td class="v">%s</td><td>الرقم الضريبي</td></tr>'
          '<tr><td>National address</td><td class="v">%s</td><td>العنوان الوطني</td></tr>'
          '<tr><td>Represented by</td><td class="v">%s</td><td>يمثلها</td></tr>'
          '<tr><td>Title</td><td class="v">%s</td><td>الصفة</td></tr></table>') % (
        esc(CLIENT_EN), esc(CLIENT_AR), num("[●]"), num("[●]"), num("[●]"), num("[●]"), num("[●]"))
    return me + cl

NUMBERED = True
PARTIES = True
START = 2

def clause_tr(no, r):
    """كل بند: صف عنوان ثم صف لكل نقطة، الإنجليزي يساراً والعربي يميناً في الصف نفسه (شبكة CSS) ليتحاذيا سطراً بسطر."""
    t_en, t_ar, b_en, b_ar = r
    pre = "%d. " % no if NUMBERED else ""
    be = b_en if "&amp;" in b_en or b_en.startswith("<") else b_en.replace("&", "&amp;")
    ba = ar(b_ar)
    def _split(s):
        k = s.find("<table")
        head, tail = (s, "") if k < 0 else (s[:k], s[k:])
        parts = [x for x in head.split("<br>") if x.strip()]
        return parts, tail
    pe, te = _split(be); pa, ta = _split(ba)
    if len(pe) != len(pa):
        pe, pa, te, ta = [be], [ba], "", ""
    elif te or ta:
        pe = pe + [te]; pa = pa + [ta]
    cells = '<div class="en"><b>%s%s</b></div><div class="ar"><b>%s%s</b></div>' % (pre, esc(t_en), pre, esc(t_ar))
    for x, y in zip(pe, pa):
        cells += '<div class="en">%s</div><div class="ar">%s</div>' % (x, y)
    return '<tr data-m="r%d"><td colspan="2" style="padding:0"><div class="cg">%s</div></td></tr>' % (no, cells)

def sig_port():
    return ('<div class="sg" data-m="sig" style="direction:ltr"><div><h3><span>First Party</span><span dir="rtl">الطرف الأول</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>'
            '<div><h3><span>Second Party</span><span dir="rtl">الطرف الثاني</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div></div>') % (
        ("%s · %s" % (esc(REP_EN), esc(REP_AR)), "%s · %s" % (esc(REP_TITLE_EN), esc(REP_TITLE_AR)), num(DATE_EN + " · " + DATE_AR), "[●]", "[●]", num(DATE_EN + " · " + DATE_AR)))

def cover_port(kind_en, kind_ar, t_en, t_ar, s_en, s_ar, ref_label=True):
    def f(i, n):
        return ('<section class="sheet port cover" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">%s</div><h1 class="pf">%s</h1><div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">%s</div><h1>%s</h1><div class="sb">%s</div></div></div>'
                '<div class="ch"><div><span>Parties / الأطراف</span>Business Partner Solutions<br>%s</div><div><span>Date / التاريخ</span>%s<br>%s</div><div><span>Ref / المرجع</span>Workforce Supply<br><span dir="rtl">توفير العمالة</span></div></div></div></div>%s</section>') % (
            esc(kind_en), esc(t_en), esc(s_en), esc(kind_ar), esc(t_ar), esc(ar(s_ar)),
            esc(CLIENT_AR), esc(DATE_EN), '<span dir="rtl">' + esc(DATE_AR) + '</span>', "")
    return f

def closing_port():
    def f(i, n):
        return ('<section class="sheet port cover" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">PARTNERING FOR YOUR SUCCESS</div><h1 class="pf" style="font-size:34px">Business Partner Solutions</h1>'
                '<div class="sb" style="direction:rtl;text-align:right;margin-top:6px">بزنس بارتنر سلوشنز</div>'
                '<div class="bx" style="flex-direction:column;gap:22px"><div><b>Company · المنشأة</b>'
                '<div class="kv"><span>Unified No.</span><span class="kvv">%s</span><span dir="rtl">الرقم الموحد</span></div>'
                '<div class="kv"><span>VAT No.</span><span class="kvv">%s</span><span dir="rtl">الرقم الضريبي</span></div>'
                '<div class="kv"><span>National Address</span><span class="kvv">%s · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714</span><span dir="rtl">العنوان الوطني</span></div></div>'
                '<div><b>Contact · التواصل</b><div class="kv"><span>Mobile</span><span class="kvv">%s</span><span dir="rtl">الجوال</span></div>'
                '<div class="kv"><span>Email</span><span class="kvv">%s</span><span dir="rtl">الإيميل</span></div>'
                '<div class="kv"><span>Website</span><span class="kvv">%s</span><span dir="rtl">الموقع</span></div></div></div></div></div>%s</section>') % (
            num("7038825860"), num("312079341500003"), num("RDAA9214"), num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), "")
    return f

def measure(rows_html, extra_blocks, css, path):
    """يقيس ارتفاع كل صف/كتلة في الصفحة الفعلية ويعيد dict."""
    meas = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">%s<style>%s%s</style></head><body>'
            '<section class="sheet port" lang="ar"><div dir="rtl">%s<table class="cl" style="margin:0">%s</table>%s</div></section></body></html>') % (
        FONTS, css, EXTRA, hd_port("x", "x", ""), rows_html, extra_blocks)
    open(path, "w", encoding="utf-8").write(meas)
    out = subprocess.check_output(["node", os.path.join(HERE, "render.cjs"), "measure", path],
                                  env=dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"]).decode().strip()))
    return json.loads(out)

CG_CSS = ".cg{display:grid;grid-template-columns:1fr 1fr;direction:ltr}.cg>div{padding:3px 8px;border-bottom:1px solid #E3E7F2}.cg .en{direction:ltr;text-align:left}.cg .ar{direction:rtl;text-align:right;border-inline-start:1px solid #E3E7F2}.cl{width:100%}"
def paginate_port(rows, title_en, title_ar, kind_en, kind_ar, cover_args, with_sig=True, tmp="/tmp"):
    css = css_of("REV-contract-bilingual.html") + CG_CSS
    nums = list(range(START, START + len(rows)))
    trs = [clause_tr(no, r) for no, r in zip(nums, rows)]
    pa = '<div data-m="parties"><div class="pre"><b>1. الأطراف / Parties</b></div>%s</div>' % parties_html()
    ms = measure("".join(trs), pa + sig_port(), css, os.path.join(tmp, "isr-measure.html"))
    top = ms["__hdBottom"] + 6   # بعد الرأس مباشرة
    LIM = 979 - 8
    pages, cur, used, first = [], [], 0, True
    avail = LIM - top
    def new_page():
        nonlocal cur, used, first
        pages.append((cur, first)); cur = []; used = 0; first = False
    used = (ms["parties"] + 6) if PARTIES else 0
    for k, tr in enumerate(trs):
        h = ms["r%d" % nums[k]]
        if used + h > avail and cur:
            new_page()
        cur.append(tr); used += h
    sig_h = ms["sig"] + 8
    if with_sig and used + sig_h > avail:
        last_tr = cur.pop()          # البند الأخير ينتقل مع التوقيع كي لا تقف صفحة التوقيع وحدها
        new_page()
        cur.append(last_tr)
    pages.append((cur, first))
    sheets = [cover_port(*cover_args)]
    last = len(pages) - 1
    for pi, (rs, is_first) in enumerate(pages):
        def f(i, n, rs=rs, is_first=is_first, pi=pi):
            body = ""
            if is_first and PARTIES:
                body += '<div class="pre"><b>1. الأطراف / Parties</b></div>' + parties_html()
            body += '<table class="cl">%s</table>' % "".join(re.sub(r' data-m="r\d+"', "", x) for x in rs) if rs else ""
            if with_sig and pi == last:
                body += re.sub(r' data-m="sig"', "", sig_port())
            return '<section class="sheet port" lang="ar"><div dir="rtl">%s%s</div>%s</section>' % (hd_port(title_en, title_ar, ""), body, footer(i, n))
        sheets.append(f)
    sheets.append(closing_port())
    return doc(title_ar, css, sheets), css

def build_contract():
    rows = contract_clauses()
    cover = ("WORKFORCE SUPPLY AGREEMENT", "عقد توفير العمالة", C_TITLE_EN, C_TITLE_AR,
             ("Supplying %d workers in the trades listed in the quotation, %s nationals only." % (TOTAL_WORKERS, NATL_EN) if TEMPLATE else "Supplying seven trade teams of fifteen workers each, %s nationals only." % NATL_EN),
             ("توفير %d عاملاً في المهن المبيّنة في العرض، من الجنسيات %s فقط." % (TOTAL_WORKERS, NATL_AR) if TEMPLATE else "توفير سبعة فرق مهنية، في كل فريق خمسة عشر عاملاً، من الجنسيات %s فقط." % NATL_AR))
    h, _ = paginate_port(rows, C_TITLE_EN, C_TITLE_AR, None, None, cover)
    return h, rows

def build_info(rows, t_en, t_ar, kind_en, kind_ar, s_en, s_ar, numbered=True):
    global NUMBERED, PARTIES, START
    NUMBERED, PARTIES, START = numbered, False, 1
    cover = (kind_en, kind_ar, t_en, t_ar, s_en, s_ar)
    h, _ = paginate_port(rows, t_en, t_ar, None, None, cover, with_sig=False)
    NUMBERED, PARTIES, START = True, True, 2
    return h

def build_authz():
    global NUMBERED
    from authz import rows, INFO_COVER, T_EN, T_AR
    NUMBERED = False
    h, _ = paginate_port(rows(), T_EN, T_AR, None, None, INFO_COVER)
    NUMBERED = True
    return h

def build_nda():
    rows = nda_rows()
    cover = ("CONFIDENTIALITY", "سرية", N_TITLE_EN, N_TITLE_AR,
             "A mutual agreement protecting the confidential information exchanged between the parties.",
             "اتفاقية متبادلة لحماية المعلومات السرية المتبادلة بين الطرفين.")
    h, _ = paginate_port(rows, N_TITLE_EN, N_TITLE_AR, None, None, cover)
    return h, rows

# ------------------------------------------------------------------ المهن وقرارات التوطين (من بيانات أداة الامتثال)
def build_professions():
    data = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "services", "live-calculator", "src", "data.json"), encoding="utf-8"))
    css = css_of("REV-quote-template-bilingual.html") + ".pfx{width:100%;border-collapse:collapse;font-size:8.6px;direction:rtl}.pfx th{background:#0B1B5A;color:#fff;padding:3px 5px;text-align:center;font-weight:600}.pfx td{border-bottom:1px solid #DDE1EE;padding:2px 5px;text-align:center}.pfx td.n{text-align:right}.pfx tr.g td{background:#EEF1FB;font-weight:700;color:#0B1B5A;text-align:right;padding:4px 6px}.sar{height:.95em;width:.85em;vertical-align:-.12em;fill:currentColor}"
    rows = []   # (kind, html)
    k = 0
    for g in data["guides"]:
        if not g["occupations"]:
            continue
        acc = g.get("accreditation") or "—"
        rows.append(("g", '<tr class="g"><td colspan="8">%s · %s &nbsp;|&nbsp; %s %s · %s%% · %s · %s · %s</td></tr>' % (
            esc(g["nameAr"]), esc(g["nameEn"]), esc(g["decision"]), esc(g.get("date", "")), g["rate"],
            ("من %d عاملين فأكثر / from %d workers" % (g["minWorkers"], g["minWorkers"])),
            ("أقل أجر للسعودي %s / Saudi minimum %s" % (n(g["minSalary"]), n(g["minSalary"])) if g["minSalary"] else "لا حد أدنى منشور / no published minimum"), esc(acc))))
        for o in g["occupations"]:
            k += 1
            cost = n(round(saudi_one(g["minSalary"]))) if g["minSalary"] else "—"
            frn = "غير مسموح · Not allowed" if g["rate"] >= 100 else "مسموح ضمن النسبة · Allowed within the ratio"
            rows.append(("r", '<tr><td>%d</td><td class="n">%s</td><td>%s</td><td>%s%%</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
                k, esc(o["name"]), esc(o["code"]), g["rate"], g["minWorkers"], n(g["minSalary"]) if g["minSalary"] else "—", cost, frn)))
    head = ('<tr><th>#</th><th>المهنة · Profession</th><th>الرمز · Code</th><th>نسبة السعودة · Saudi share</th><th>يسري من (عاملين) · From (workers)</th>'
            '<th>أقل أجر للسعودي · Saudi minimum salary</th><th>تكلفة السعودي الشهرية عند الحد الأدنى · Saudi monthly cost at the minimum</th><th>العامل الأجنبي · Foreign worker</th></tr>')
    PER = 27
    pages, cur, used = [], [], 0
    for kind, h in rows:
        w = 1.5 if kind == "g" else 1
        if used + w > PER and cur:
            pages.append(cur); cur, used = [], 0
        cur.append(h); used += w
    if cur: pages.append(cur)
    sheets = []
    for pi, pg in enumerate(pages):
        inner = (h2("P%d" % (pi + 1), "All professions with a localisation decision: Saudis and foreigners", "كل المهن التي عليها قرار توطين: السعوديون والأجانب") if pi == 0 else "") + '<table class="pfx">%s%s</table>' % (head, "".join(pg))
        def f(i, n_, inner=inner):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (hd2("Professions and localisation decisions", "المهن وقرارات التوطين"), inner, footer(i, n_))
        sheets.append(f)
    note = ('<div class="nt"><div dir="ltr">Source: the Ministry of Human Resources localisation decisions as compiled in the Business Partner compliance tool. Any profession not listed has no localisation decision. Confirm with the Ministry before relying on a rate.</div>'
            '<div class="ar" dir="rtl">المصدر: قرارات التوطين الصادرة عن وزارة الموارد البشرية كما جُمعت في أداة الامتثال في Business Partner. وأي مهنة غير مدرجة لا قرار توطين عليها. وتُؤكَّد النسبة مع الوزارة قبل الاعتماد عليها.</div></div>')
    last = pages[-1]
    return sar_mark(doc("Professions and localisation decisions", css, sheets))

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    suffix = ""
    qm, qa = build_quote()
    open(os.path.join(out, "01-Quotation-Simple.html"), "w", encoding="utf-8").write(qm)
    open(os.path.join(out, "01B-Quotation-Detailed.html"), "w", encoding="utf-8").write(qa)
    h, _ = build_contract(); h = h.replace("[IBAN]", IBAN).replace("Bank [●]", "Bank " + BANK).replace("البنك [●]", "البنك " + BANK) if (FINAL and BANK != "[●]") else (h.replace("[IBAN]", IBAN) if FINAL else h); open(os.path.join(out, "02-Agreement.html"), "w", encoding="utf-8").write(h)
    h, _ = build_nda(); open(os.path.join(out, "03-NDA.html"), "w", encoding="utf-8").write(h)
    open(os.path.join(out, "07-Authorization-Letter.html"), "w", encoding="utf-8").write(build_authz())
    open(os.path.join(out, "05-Professions-Localisation.html"), "w", encoding="utf-8").write(build_professions())
    from info_docs import INFO
    for fname, spec in INFO.items():
        open(os.path.join(out, fname + ".html"), "w", encoding="utf-8").write(build_info(*spec))
    print("ok", out, "FINAL" if FINAL else "scrubbed")
