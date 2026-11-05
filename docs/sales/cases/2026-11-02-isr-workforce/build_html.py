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
            esc(t[0]), esc(t[1]), co, nm or num("[●]"), tt or num("[●]"), num("[●]"))
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
    nat_all = ("Filipino · Indian · Nepali", "فلبينية · هندية · نيبالية")
    def pc(v): return (num(n(v)), num(n(v)), "c")
    def rate_table(prices, price_hdr=("Monthly price per worker (SAR)", "السعر الشهري للعامل (ريال)")):
        rr = []
        for k, t in enumerate(TRADES, 1):
            le, la, sal, loc_fee = LEVELS[t["level"]]
            rr.append([(str(k), str(k), "nx"), ("<b>%s</b>" % esc(t["en"]), "<b>%s</b>" % esc(t["ar"]), "t"), (le, la, "c"), pc(sal), (str(t["count"]), str(t["count"]), "c"),
                       (NAT_EN, NAT_AR, "c"), pc(prices[t["level"]])])
        return bi_table([("#", "#", True), ("Trade", "المهنة", False), ("Level", "المستوى", True), ("Salary", "الراتب", True), ("Workers", "العدد", True),
                         ("Nationalities", "الجنسيات", True), (price_hdr[0], price_hdr[1], True)],
                        rr, [3, 20, 9, 8, 7, 18, 12])
    rates12 = rate_table(PRICE12)
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
    facnote = ('<div class="nt"><div dir="ltr">Under the Shared Talent item the work-permit levy (SAR 9,600 a year) is exempt: the price is the standard price less SAR 800 a month.</div>'
               '<div class="ar" dir="rtl">على بند الكوادر المشتركة يُعفى المقابل المالي لرخصة العمل (9,600 ريال سنوياً): السعر هو السعر العادي ناقص 800 ريال شهرياً.</div></div>')
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
    calc_box = '' if not CALC_URL else ('<div class="nt"><div dir="ltr"><b>Salary-based cost calculator.</b> Enter the salary, nationality and contract length to see the actual monthly cost per worker: <b>%s</b></div>'
                '<div class="ar" dir="rtl"><b>الآلة الحاسبة للتكاليف بناءً على الرواتب.</b> أدخل الراتب والجنسية ومدة العقد لتعرف التكلفة الفعلية الشهرية للعامل: <b dir="ltr">%s</b></div></div>') % (CALC_URL, CALC_URL)
    def model_how():
        rows_ = [
          [("<b>How it works</b>", "<b>كيف يعمل</b>", "t"), ("One fixed monthly amount that includes every government cost, spread over the contract.", "مبلغ شهري ثابت يشمل كل التكاليف الحكومية موزَّعة على العقد.", "t"), ("A lower monthly invoice; government costs are invoiced at their actual amount, no mark-up, when due.", "فاتورة شهرية أقل؛ والتكاليف الحكومية بمبلغها الفعلي دون هامش عند استحقاقها.", "t"), ("The contract is under the Shared Talent item: the work-permit levy (SAR 9,600 a year) is exempt.", "التعاقد على بند الكوادر المشتركة: يُعفى المقابل المالي لرخصة العمل (9,600 ريال سنوياً).", "t")],
          [("<b>You pay</b>", "<b>تدفع</b>", "t"), ("Two months in advance, then the same amount monthly. Invoices are payable within 7 days.", "شهرين مقدماً ثم المبلغ نفسه شهرياً. وتُسدَّد الفواتير خلال 7 أيام.", "t"), ("Two months of the invoice in advance, then the invoice monthly, plus each government cost when due. Invoices are payable within 7 days.", "شهرين من الفاتورة مقدماً ثم الفاتورة شهرياً، وكل تكلفة حكومية عند استحقاقها. وتُسدَّد الفواتير خلال 7 أيام.", "t"), ("The standard price less SAR 800 a month, under Model 1 or Model 2.", "السعر العادي ناقص 800 ريال شهرياً، ضمن النموذج الأول أو الثاني.", "t")],
          [("<b>Total over the contract</b>", "<b>الإجمالي على العقد</b>", "t"), ("The same as Model 2.", "هو نفسه في النموذج الثاني.", "t"), ("The same as Model 1.", "هو نفسه في النموذج الأول.", "t"), ("Lower by SAR 800 for every month.", "أقل بـ800 ريال عن كل شهر.", "t")]]
        return bi_table([("", "", False), ("Model 1 — Full cost", "النموذج الأول — التكلفة الكاملة", False), ("Model 2 — Transparent cost", "النموذج الثاني — التكلفة بشفافية", False), ("Model 3 — Shared Talent services", "النموذج الثالث — خدمات الكوادر الوطنية وغير الوطنية المشتركة", False)], rows_, [10, 18, 20, 18])
    model_tick = ('<div class="nt"><div dir="ltr">Choose the model: &nbsp; &#9744; Model 1 — Full cost &nbsp; &#9744; Model 2 — Transparent cost &nbsp; &#9744; Model 3</div>'
                  '<div class="ar" dir="rtl">اختر النموذج: &nbsp; &#9744; النموذج الأول — التكلفة الكاملة &nbsp; &#9744; النموذج الثاني — التكلفة بشفافية &nbsp; &#9744; النموذج الثالث</div></div>')
    sheets.append(page(h2(3, "Three models", "ثلاثة نماذج") + model_how()))
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
        [("5", "5", "nx"), ("<b>Contract model</b>", "<b>نموذج التعاقد</b>", "t"), ("Model 1 full cost, Model 2 transparent cost, or Model 3 Shared Talent services.", "النموذج الأول التكلفة الكاملة، أو الثاني التكلفة بشفافية، أو الثالث خدمات الكوادر الوطنية وغير الوطنية المشتركة.", "t"), (_bx + "Model 1<br>" + _bx + "Model 2<br>" + _bx + "Model 3", _bx + "الأول<br>" + _bx + "الثاني<br>" + _bx + "الثالث", "t")],
        [("4", "4", "nx"), ("<b>Direct payment</b>", "<b>الدفع المباشر</b>", "t"), ("Any item that would cost you more (accommodation, transport, food, medical upgrade, government fees, tickets): pay it directly; it is taken off our invoice.", "أي بند يكلفك أكثر (السكن، المواصلات، الإعاشة، رفع التأمين الطبي، الرسوم الحكومية، التذاكر): ادفعه مباشرة ويُحذف من فاتورتنا.", "t"), (_bx + "None<br>" + _bx + "These items: ________", _bx + "لا شيء<br>" + _bx + "بنود: ____", "t")]],
        [3, 14, 34, 16])
    inc_ex = [
        (("Salary", "الراتب"), ("&#9744; Accommodation (SAR 300, optional)", "&#9744; السكن (300 ريال، اختياري)")),
        (("Residence permit and work permit", "الإقامة ورخصة العمل"), ("&#9744; Transport (SAR 300, optional)", "&#9744; المواصلات (300 ريال، اختياري)")),
        (("Health insurance and social insurance", "التأمين الصحي والتأمينات الاجتماعية"), ("&#9744; Food (SAR 300, optional)", "&#9744; الإعاشة (300 ريال، اختياري)")),
        (("End-of-service and leave provision", "مخصص نهاية الخدمة والإجازة"), ("Recruitment from abroad (by nationality)", "الاستقدام من الخارج (بحسب الجنسية)")),
        (("Return ticket", "تذكرة العودة"), ("Embassy and attestation charges, tickets of recruited workers", "رسوم السفارات والتصديق وتذاكر المستقدَمين")),
        (("Visa or transfer of services (sponsorship transfer), first time: SAR 2,000", "التأشيرة أو نقل الخدمات (نقل الكفالة) لأول مرة: 2,000 ريال"), ("A second transfer (4,000) or third (6,000): the increase", "النقل الثاني (4,000) أو الثالث (6,000): الزيادة")),
        (("Administrative and operating costs, and our fees", "التكاليف الإدارية والتشغيلية ورسومنا"), ("Overtime (1.5 times the hourly rate)", "العمل الإضافي (بساعة ونصف)")),
        (("", ""), ("Tools, equipment and protective equipment", "الأدوات والمعدات ومعدات الحماية"))]
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
    saudi_page = h2("A4", "Cost of a Saudi employee, by role and salary", "تكلفة الموظف السعودي بحسب الوظيفة والراتب") + roles_t + saudi_table() + gosi_note + saudi_box
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
    m1 = (h2("M1", "Model 1 — Full cost", "النموذج الأول — التكلفة الكاملة") +
          note_("<b>How it works.</b> You pay one fixed monthly amount per worker. It already includes every government cost (work permit and levy, residence, medical insurance, exit and re-entry, visa or transfer of services, return ticket), spread over the contract. You receive no other government invoice. <b>Example</b> below: a skilled worker, salary SAR %s, 12-month contract." % n(_sal),
                "<b>كيف يعمل.</b> تدفع مبلغاً شهرياً ثابتاً واحداً للعامل. وهو يشمل مسبقاً كل التكاليف الحكومية (رخصة العمل والمقابل، الإقامة، التأمين الطبي، الخروج والعودة، التأشيرة أو نقل الخدمات، تذكرة العودة) موزَّعة على العقد. ولا تصلك فاتورة حكومية أخرى. <b>المثال</b> أدناه: عامل ماهر راتبه %s ريال، عقد 12 شهراً." % n(_sal)) +
          kv([("On signing: two months in advance", "عند التوقيع: شهران مقدماً", _p * 2), ("Every month", "كل شهر", _p), ("Government costs on top", "تكاليف حكومية إضافية", 0)]) +
          '')
    m2 = (h2("M2", "Model 2 — Transparent cost", "النموذج الثاني — التكلفة بشفافية") +
          note_("<b>How it works.</b> You pay a lower monthly invoice (salary, insurance, provisions, administrative and operating costs, our fees). The government costs below are invoiced at their <b>actual amount, without mark-up, when each falls due</b>. <b>Example</b>: a skilled worker, salary SAR %s, 12 months." % n(_sal),
                "<b>كيف يعمل.</b> تدفع فاتورة شهرية أقل (الراتب، التأمينات، المخصصات، التكاليف الإدارية والتشغيلية، رسومنا). أما التكاليف الحكومية أدناه فتُفوتَر <b>بمبلغها الفعلي دون هامش عند استحقاق كل بند</b>. <b>المثال</b>: عامل ماهر راتبه %s ريال، 12 شهراً." % n(_sal)) +
          kv([("On signing: two months of the invoice in advance", "عند التوقيع: شهران من الفاتورة مقدماً", round(_inv * 2)), ("Every month: the monthly invoice", "كل شهر: الفاتورة الشهرية", round(_inv))]) +
          bi_table([("Government cost, at actual when due", "تكلفة حكومية بالفعلي عند الاستحقاق", False), ("Amount (SAR)", "المبلغ (ريال)", True), ("When", "متى", True)], [[(e, a_, "t"), (num(n(v)), num(n(v)), "c"), (we, wa, "c")] for e, a_, v, we, wa in _gov_items], [30, 12, 12]) +
          '')
    m3 = (h2("M3", "Model 3 — National and Non-National Shared Talent services", "النموذج الثالث — خدمات الكوادر الوطنية وغير الوطنية المشتركة") +
          note_("<b>How it works.</b> Saudi and non-Saudi employees employed by Business Partner work with you, part-time or flexibly, so Saudis count in your Saudization without you hiring them full-time. The cost of each Saudi is shared with you, and under this item the work-permit levy (SAR 9,600 a year) is exempt, so the price of the contracted worker is the standard price <b>less SAR 800 every month</b>. It works together with Model 1 or Model 2. <b>Example</b>: a skilled worker, salary SAR %s, 12 months." % n(_sal),
                "<b>كيف تعمل.</b> موظفون سعوديون وغير سعوديين يوظّفهم Business Partner يعملون لديك بدوام جزئي أو مرن، فيُحتسب السعوديون في توطينك دون أن توظّفهم بدوام كامل. وتُقسَّم تكلفة كل سعودي معك، وعلى هذا البند يُعفى المقابل المالي لرخصة العمل (9,600 ريال سنوياً) فيكون سعر العامل المتعاقد معه السعر العادي <b>ناقص 800 ريال كل شهر</b>. وتعمل مع النموذج الأول أو الثاني. <b>المثال</b>: عامل ماهر راتبه %s ريال، 12 شهراً." % n(_sal)) +
          nst + nstnote +
          kv([("Standard monthly price (Model 1)", "السعر الشهري العادي (النموذج الأول)", _p), ("Monthly price under this item", "السعر الشهري على هذا البند", _pf), ("Saving every month", "الوفر كل شهر", FACTORY_DISCOUNT)]))
    _cmp = [
        (("Monthly amount", "المبلغ الشهري"), ("Fixed: %s" % n(_p), "ثابت: %s" % n(_p)), ("Invoice: %s" % n(round(_inv)), "الفاتورة: %s" % n(round(_inv))), ("Less 800: %s / %s" % (n(_pf), n(round(_inv))), "ناقص 800: %s / %s" % (n(_pf), n(round(_inv))))),
        (("On signing", "عند التوقيع"), ("2 months of the price", "شهران من السعر"), ("2 months of the invoice", "شهران من الفاتورة"), ("As Model 1 or 2", "كالنموذج الأول أو الثاني")),
        (("Government costs", "التكاليف الحكومية"), ("Inside the price", "داخل السعر"), ("Actual amount, when due", "بالفعلي عند الاستحقاق"), ("Levy exempt; SAR 100 permit fee", "المقابل معفى؛ 100 ريال رسوم رخصة")),
        (("Total over the contract", "الإجمالي على العقد"), ("Same as Model 2", "مثل النموذج الثاني"), ("Same as Model 1", "مثل النموذج الأول"), ("Lower by 800 each month", "أقل 800 كل شهر")),
        (("Who it suits", "لمن يناسب"), ("A fixed monthly amount", "مبلغ شهري ثابت"), ("Seeing the actual costs", "رؤية التكاليف الفعلية"), ("Contracts under the National and Non-National Shared Talent item", "تعاقد على بند الكوادر الوطنية وغير الوطنية المشتركة"))]
    m4 = (h2("M4", "Differences between the three models", "الفروقات بين النماذج الثلاثة") +
          bi_table([("", "", False), ("Model 1 — Full cost", "النموذج الأول — التكلفة الكاملة", False), ("Model 2 — Transparent cost", "النموذج الثاني — التكلفة بشفافية", False), ("Model 3 — Shared Talent services", "النموذج الثالث — خدمات الكوادر الوطنية وغير الوطنية المشتركة", False)],
                   [[("<b>%s</b>" % esc(r[0][0]), "<b>%s</b>" % esc(r[0][1]), "t")] + [(esc(c[0]), esc(c[1]), "t") for c in r[1:]] for r in _cmp], [12, 18, 18, 18]) +
          note_("Example: a skilled worker, salary SAR %s, 12-month contract, before VAT. Prices follow the salary you choose; the calculator recomputes them." % n(_sal), "المثال: عامل ماهر راتبه %s ريال، عقد 12 شهراً، قبل الضريبة. وتتبع الأسعار الراتب الذي تختاره؛ والآلة الحاسبة تعيد حسابها." % n(_sal)))
    _model_pages = [pageA(_pg) for _pg in (m1, m2, m3, m4)]

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
    def pack(blocks, mk, title):
        import subprocess, tempfile
        tmp = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8")
        tmp.write(doc(title, css, [mk('<div data-m="b%d">%s</div>' % (k, x)) for k, x in enumerate(blocks)])); tmp.close()
        out = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "render.cjs"), "measure", tmp.name], capture_output=True, text=True, check=True).stdout
        os.unlink(tmp.name)
        hs = json.loads(out.strip().splitlines()[-1]); CAP = 548
        if os.environ.get("PACK_DEBUG"): print("heights", title, {k: round(v) for k, v in hs.items()}, file=sys.stderr)
        pages_, rest = [], list(range(len(blocks)))
        while rest:
            cur = [rest.pop(0)]; h = hs["b%d" % cur[0]]
            for k in list(rest[:3]):
                if h + hs["b%d" % k] <= CAP:
                    cur.append(k); h += hs["b%d" % k]; rest.remove(k)
            pages_.append([blocks[k] for k in sorted(cur)])
        return [mk("".join(p)) for p in pages_]
    m_prices = find(REC_MAIN, "Trades, salaries and price"); m_nst = find(REC_MAIN, "Calculation under the Shared Talent"); m_models = find(REC_MAIN, "Three models"); m_incl = find(REC_MAIN, "What the price includes")
    m_opts = find(REC_MAIN, "Your options"); m_sign = find(REC_MAIN, "Signatures")
    simple_pages = pack([m_prices, m_nst, m_models, m_incl, m_opts, m_sign], page, "q")
    A = REC_ANNEX
    annex_blocks = [m1, m2, m3, m4, sheets_model_page, scope_page, calc_page, find(A, "Government fees explained"), find(A, 'h2("A5"') if False else find(A, "Localisation fee"),
                    find(A, "Technical and engineering workers: how"), saudi_page, find(A, "What you pay and when"), find(A, "Terms and conditions")]
    detail_pages = pack([m_prices, m_nst, m_models, m_incl] + annex_blocks + [m_opts, m_sign], pageA, "qa")
    return sar_mark(doc("Quotation (simple) — ISR Trading (Workforce)", css, [sheets[0]] + simple_pages + [])), sar_mark(doc("Quotation (detailed) — ISR Trading (Workforce)", css, [sheets[0]] + detail_pages + [closing]))

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
    t_en, t_ar, b_en, b_ar = r
    pre = "%d. " % no if NUMBERED else ""
    return '<tr data-m="r%d"><td class="en"><b>%s%s</b><br>%s</td><td class="ar"><b>%s%s</b><br>%s</td></tr>' % (
        no, pre, esc(t_en), b_en if "&amp;" in b_en or b_en.startswith("<") else b_en.replace("&", "&amp;"), pre, esc(t_ar), ar(b_ar))

def sig_port():
    return ('<div class="sg" data-m="sig" style="direction:ltr"><div><h3><span>First Party</span><span dir="rtl">الطرف الأول</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>'
            '<div><h3><span>Second Party</span><span dir="rtl">الطرف الثاني</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div></div>') % (
        ("%s · %s" % (esc(REP_EN), esc(REP_AR)), "%s · %s" % (esc(REP_TITLE_EN), esc(REP_TITLE_AR)), "[●]", "[●]", "[●]", "[●]"))

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

def paginate_port(rows, title_en, title_ar, kind_en, kind_ar, cover_args, with_sig=True, tmp="/tmp"):
    css = css_of("REV-contract-bilingual.html")
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
             "Supplying seven trade teams of fifteen workers each, Filipino, Indian and Nepali nationals only.",
             "توفير سبعة فرق مهنية، في كل فريق خمسة عشر عاملاً، من الجنسيات الفلبينية والهندية والنيبالية فقط.")
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

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    suffix = ""
    qm, qa = build_quote()
    open(os.path.join(out, "01-Quotation-Simple.html"), "w", encoding="utf-8").write(qm)
    open(os.path.join(out, "01B-Quotation-Detailed.html"), "w", encoding="utf-8").write(qa)
    h, _ = build_contract(); open(os.path.join(out, "02-Agreement.html"), "w", encoding="utf-8").write(h)
    h, _ = build_nda(); open(os.path.join(out, "03-NDA.html"), "w", encoding="utf-8").write(h)
    open(os.path.join(out, "07-Authorization-Letter.html"), "w", encoding="utf-8").write(build_authz())
    from info_docs import INFO
    for fname, spec in INFO.items():
        open(os.path.join(out, fname + ".html"), "w", encoding="utf-8").write(build_info(*spec))
    print("ok", out, "FINAL" if FINAL else "scrubbed")
