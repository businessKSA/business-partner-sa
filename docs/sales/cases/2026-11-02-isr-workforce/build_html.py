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
def build_quote():
    css = css_of("REV-quote-template-bilingual.html")
    sheets = []
    def cover(i, n):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv lt"><div class="lgband"><span class="logo big" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">Workforce Supply — 7 Trade Teams</h1>'
                '<div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>توفير العمالة — 7 فرق مهنية</h1>'
                '<div class="sb">%s</div></div></div>'
                '<div class="pk" dir="ltr">Workforce Supply · %d workers</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">توفير العمالة · %d عاملاً</div>'
                '<div class="ch"><div><span>To / إلى السادة</span><span class="nm">%s</span></div><div><span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span></div>'
                '<div><span>Validity / صلاحية العرض</span>14 days<br><span dir="rtl">14 يوماً</span></div></div></div></div></section>') % (
            esc(Q_COVER_EN), esc(ar(Q_COVER_AR)), WORKERS, WORKERS, esc(CLIENT_AR), esc(DATE_EN), esc(DATE_AR))
    sheets.append(cover)

    def page(inner):
        def f(i, n):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
                hd2(Q_TITLE_EN, Q_TITLE_AR), inner, footer(i, n))
        return f

    B = "[●]"
    nat_all = ("Filipino · Indian · Nepali", "فلبينية · هندية · نيبالية")
    def pc(v): return (num(n(v)), num(n(v)), "c")
    def rate_table(prices, tot):
        rr = []; k = 0
        for ti, (te, ta) in enumerate(TEAMS):
            lv = TEAM_LEVEL[ti]; le, la, sal, loc_fee = LEVELS[lv]; short_e = te.split(" — ")[0]; short_a = ta.split(" — ")[0]
            k += 1
            rr.append([(str(k), str(k), "nx"), ("<b>%s</b>" % esc(short_e), "<b>%s</b>" % esc(short_a), "t"), (le, la, "c"), pc(sal), (str(SKILLED_MIN), str(SKILLED_MIN), "c"),
                       nat_all + ("c",), pc(prices[lv]), pc(SKILLED_MIN * prices[lv])])
        he, ha, hs, hl = LEVELS["helper"]; hn = STD_MIN * NTEAMS
        k += 1
        rr.append([(str(k), str(k), "nx"), ("<b>Helper (all seven teams)</b>", "<b>العامل المساعد (الفرق السبعة)</b>", "t"), (he, ha, "c"), pc(hs), (str(hn), str(hn), "c"),
                   nat_all + ("c",), pc(prices["helper"]), pc(hn * prices["helper"])])
        rr.append({"cls": "tot", "cells": [("", "", ""), ("Total", "الإجمالي", ""), ("", "", ""), ("", "", ""), (str(WORKERS), str(WORKERS), "c"), ("", "", ""), ("", "", ""), pc(tot)]})
        return bi_table([("#", "#", True), ("Trade", "المهنة", False), ("Level", "المستوى", True), ("Minimum salary", "الحد الأدنى للراتب", True), ("Workers", "العدد", True),
                         ("Nationalities", "الجنسيات", True), ("Monthly price per worker (SAR)", "السعر الشهري للعامل (ريال)", True), ("Monthly total (SAR)", "الإجمالي الشهري (ريال)", True)],
                        rr, [3, 16, 8, 7, 6, 15, 9, 9])
    def totals_table(tot, vat, grand):
        rows_ = [[("<b>Seven teams, per month</b> (before VAT)", "<b>الفرق السبعة شهرياً</b> (قبل الضريبة)", "t"), pc(tot)],
                 [("VAT 15%", "ضريبة القيمة المضافة 15%", "t"), (num(n2(vat)), num(n2(vat)), "c")],
                 [("<b>Total per month</b> (SAR)", "<b>الإجمالي شهرياً</b> (ريال)", "t"), (num(n2(grand)), num(n2(grand)), "c")]]
        return bi_table([("At the minimum skilled share (8 of 15 per team)", "عند الحد الأدنى للمهرة (8 من 15 في الفريق)", False), ("SAR", "ريال", True)], rows_, [40, 10])
    rates12 = rate_table(PRICE12, TOTAL_MONTHLY12) + totals_table(TOTAL_MONTHLY12, VAT12, GRAND12)
    rates24 = rate_table(PRICE, TOTAL_MONTHLY) + totals_table(TOTAL_MONTHLY, MONTHLY_VAT, MONTHLY_GRAND)
    hours = ('<div class="nt"><div dir="ltr"><b>Working hours:</b> %d hours a day &nbsp;·&nbsp; <b>Working days:</b> %d days a month</div>'
             '<div class="ar" dir="rtl"><b>ساعات العمل:</b> %d ساعات يومياً &nbsp;·&nbsp; <b>أيام العمل:</b> %d يوماً في الشهر</div></div>') % (WORK_HOURS, WORK_DAYS, WORK_HOURS, WORK_DAYS)
    note = ('<div class="nt"><div dir="ltr"><b>Minimum salary</b> by trade level: technical SAR 3,000, skilled SAR 2,500, regular (helper) SAR 1,500. One calculation per worker, shown for 12-month and 24-month contracts, before 15%% VAT. Prices include the salary, government fees, insurance, end of service, leave, the return ticket, the management fee and the localisation fee. '
            '<b>Recruitment from abroad</b> is by nationality, at actual cost, on a separate invoice (section 8). <b>Workers transferred from inside the Kingdom (sponsorship transfer): no recruitment-from-abroad costs at all.</b> The monthly price is the same, as the transfer fee is included in it. <b>These prices are for workers on trades that have no relation to localisation (no localisation decision), which is why the costs are lower. A technical or engineering profession under a localisation decision follows other procedures and other pricing, at a higher cost (section 10).</b></div>'
            '<div class="ar" dir="rtl"><b>الحد الأدنى للراتب</b> بحسب مستوى المهنة: الفنية 3,000 ريال، والماهرة 2,500 ريال، والعادية (العامل المساعد) 1,500 ريال. حسبة واحدة للعامل، لعقد 12 شهراً وعقد 24 شهراً، قبل ضريبة 15%%. تشمل الأسعار الراتب والرسوم الحكومية والتأمين ونهاية الخدمة والإجازة وتذكرة العودة ورسم الإدارة ورسم التوطين. '
            '<b>الاستقدام من الخارج</b> بحسب الجنسية، بالتكلفة الفعلية، بفاتورة منفصلة (البند 8). <b>العمال المنقولة كفالتهم من داخل المملكة: لا توجد أي تكاليف استقدام من الخارج.</b> والسعر الشهري نفسه لأن رسم النقل داخل فيه. <b>هذه الأسعار لعمالة على مهن ليس لها علاقة بالتوطين (لا قرار توطين عليها)، ولذلك التكاليف أقل. والمهنة الفنية أو الهندسية التي عليها قرار توطين لها إجراءات أخرى وتسعيرات أخرى بتكلفة أعلى (البند 10).</b></div></div>').replace('%%', '%')
    basis_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(ce), esc(be)), "<b>%s</b> — %s" % (esc(ca), esc(ar(ba))), "t")]
                  for i, (ce, ca, be, ba) in enumerate(PRICE_BASIS, 1)]
    basis = bi_table([("#", "#", True), ("How the monthly price per worker is built", "كيف يُبنى السعر الشهري للعامل", False)], basis_rows, [4, 46])
    def fac_table(pp, ppf, tot, totf):
        fr = [[(le, la, "t"), pc(sal), pc(pp[k2]), pc(ppf[k2]), pc(pp[k2] - ppf[k2])] for k2, (le, la, sal, lf) in LEVELS.items()]
        fr.append({"cls": "tot", "cells": [("Seven teams, per month (before VAT)", "الفرق السبعة شهرياً (قبل الضريبة)", ""), ("", "", ""), pc(tot), pc(totf), pc(tot - totf)]})
        return bi_table([("If the worker is employed at a factory", "إذا كان العامل على مصنع", False), ("Minimum salary", "الحد الأدنى للراتب", True), ("Standard price", "السعر العادي", True), ("Factory price", "سعر المصنع", True), ("Saving", "الفرق", True)], fr, [18, 8, 8, 8, 8])
    fac12 = fac_table(PRICE12, PRICE12_F, TOTAL_MONTHLY12, TOTAL_MONTHLY12_F)
    fac24 = fac_table(PRICE, PRICE_F, TOTAL_MONTHLY, TOTAL_MONTHLY_F)
    facnote = ('<div class="nt"><div dir="ltr">For a worker at a licensed factory the work-permit levy of SAR 9,600 a year is exempt, and only the SAR 100 permit fee is paid. The factory price is the standard price less SAR 800 a month (the levy exemption, SAR 9,600 ÷ 12).</div>'
               '<div class="ar" dir="rtl">للعامل على مصنع مرخَّص يُعفى من المقابل المالي لرخصة العمل (9,600 ريال سنوياً)، ويُدفع رسم الرخصة 100 ريال فقط. وسعر المصنع هو السعر العادي مطروحاً منه 800 ريال شهرياً (إعفاء المقابل المالي: 9,600 ÷ 12).</div></div>')
    sheets.append(page(h2("1A", "Trades, salaries and price: 12-month contract (SAR, before VAT)", "المهن والرواتب والسعر الشهري: عقد 12 شهراً (ريال، قبل الضريبة)") + hours + rates12))
    sheets.append(page(h2("1B", "Trades, salaries and price: 24-month contract (SAR, before VAT)", "المهن والرواتب والسعر الشهري: عقد 24 شهراً (ريال، قبل الضريبة)") + rates24))
    sheets.append(page(h2(2, "Calculation if the worker is employed at a factory", "الحسبة إذا كان العامل على مصنع") + h2("2A", "12-month contract", "عقد 12 شهراً") + fac12 + h2("2B", "24-month contract", "عقد 24 شهراً") + fac24 + facnote))
    sheets.append(page(h2("", "Notes on the prices", "ملاحظات على الأسعار") + note))


    # 4 النطاق والمستثنيات
    scope_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")] for i, (te, ta, de, da) in enumerate(SCOPE, 1)]
    scope = bi_table([("#", "#", True), ("What is included", "ما يشمله العرض", False)], scope_rows, [4, 46])
    _b = lambda s: esc(s).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
    excl = numbered([(_b(e), _b(a)) for e, a in EXCLUSIONS], "Not included / on the Client", "غير مشمول / على العميل")
    sheets.append(page(h2(3, "Price basis", "أساس السعر") + basis + h2(4, "Scope", "النطاق") + scope))
    sheets.append(page(h2(5, "Not included in the price", "ما لا يشمله السعر") + excl))
    gov_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(fe), "<b>%s</b>" % esc(fa), "t"), (ae, aa, "t"), (ie, ia, "t")]
                for i, (fe, fa, ae, aa, ie, ia) in enumerate(GOV_FEES, 1)]
    gov = bi_table([("#", "#", True), ("Government fee", "الرسم الحكومي", False), ("Official amount", "المبلغ الرسمي", False), ("In this offer", "في هذا العرض", False)], gov_rows, [3, 14, 18, 18])
    govnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(GOV_NOTE[0]), esc(ar(GOV_NOTE[1])))
    loc_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (we, wa, "t")]
                for i, (te, ta, we, wa) in enumerate(LOCALISATION, 1)]
    loc = bi_table([("#", "#", True), ("Case", "الحالة", False), ("Localisation fee", "رسوم التوطين", False)], loc_rows, [3, 16, 36])
    locnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(LOC_NOTE[0]), esc(ar(LOC_NOTE[1])))
    sheets.append(page(h2(6, "Government fees explained", "توضيح الرسوم الحكومية") + gov + govnote))
    rec_rows = [[("<b>%s</b>" % esc(ne), "<b>%s</b>" % esc(na), "t"), (num(n(r)), num(n(r)), "c"), (num(n(t)), num(n(t)), "c"), (num(n(k3)), num(n(k3)), "c"), (num(n(r + t + k3)), num(n(r + t + k3)), "c"), (de, da, "c")]
                for ne, na, r, t, k3, de, da in REC_COUNTRY]
    rec = bi_table([("Nationality", "الجنسية", False), ("Recruitment from the country", "الاستقدام من الدولة", True), ("Contracts and attestation", "العقود والتصديق", True), ("Arrival ticket", "تذكرة القدوم", True), ("Total per worker, at cost", "الإجمالي للعامل بالتكلفة", True), ("Typical duration", "المدة المعتادة", True)], rec_rows, [12, 10, 10, 8, 10, 8])
    recnote = ('<div class="nt"><div dir="ltr">Recruitment from abroad is at actual cost, with no mark-up, on a separate invoice, and applies only to workers recruited from abroad. For a worker transferred from inside the Kingdom there are no recruitment-from-abroad costs. The amounts are the same for every trade.</div>'
               '<div class="ar" dir="rtl">الاستقدام من الخارج بالتكلفة الفعلية دون هامش، بفاتورة منفصلة، ويخص العمال المستقدَمين من الخارج فقط. أما العامل المنقول من داخل المملكة فلا توجد عليه تكاليف استقدام من الخارج. والمبالغ نفسها لكل المهن.</div></div>')
    sheets.append(page(h2(7, "Localisation fee", "رسوم التوطين") + loc + locnote + h2(8, "Recruitment from the country, by nationality", "الاستقدام من الدولة بحسب الجنسية") + rec + recnote))
    tr_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (num(n(fee)), num(n(fee)), "c"), (pe, pa, "c")] for i, (te, ta, fee, pe, pa) in enumerate(TRANSFER, 1)]
    trf = bi_table([("#", "#", True), ("Government fee", "الرسم الحكومي", False), ("SAR per worker", "ريال للعامل", True), ("In the monthly price", "في السعر الشهري", True)], tr_rows, [3, 22, 9, 16])
    trfnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(TRANSFER_NOTE[0]), esc(ar(TRANSFER_NOTE[1])))
    lc_rows = [[("<b>%s</b>" % esc(ie), "<b>%s</b>" % esc(ia), "t"), (te_, ta_, "c"), (ee_, ea_, "c")] for ie, ia, te_, ta_, ee_, ea_ in LOCCALC]
    lcalc = bi_table([("Item", "البند", False), ("Technical engineering (e.g. steel-structure fitter)", "فنية هندسية (مثل فني هياكل معدنية)", True), ("Engineering (engineer)", "هندسية (مهندس)", True)], lc_rows, [26, 14, 14])
    lcnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(LOCCALC_NOTE[0]), esc(ar(LOCCALC_NOTE[1])))
    sheets.append(page(h2(9, "Sponsorship transfer costs (workers inside the Kingdom)", "تكاليف نقل الكفالة (عمال من داخل المملكة)") + trf + trfnote))
    sheets.append(page(h2(10, "Technical and engineering workers: how the localisation fee is calculated", "العمالة الفنية والهندسية: كيف يُحسب رسم التوطين") + lcalc + lcnote))
    nst_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (we, wa, "t")] for i, (te, ta, we, wa) in enumerate(NST, 1)]
    nst = bi_table([("#", "#", True), ("Topic", "البند", False), ("What it means", "ماذا يعني", False)], nst_rows, [3, 14, 38])
    nstnote = '<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>' % (esc(NST_NOTE[0]), esc(ar(NST_NOTE[1])))
    sheets.append(page(h2(11, "National Shared Talent service", "خدمة الكوادر الوطنية المشتركة") + nst + nstnote))

    # 5 المراحل والدفع والشروط
    stg_rows = [[(str(i), str(i), "nx"), ("<b>%s</b>" % esc(te), "<b>%s</b>" % esc(ta), "t"), (we, wa, "t"), (he, ha, "t")]
                for i, (te, ta, we, wa, he, ha) in enumerate(STAGES2, 1)]
    stg = bi_table([("#", "#", True), ("When", "متى", False), ("What you pay", "ماذا تدفع", False), ("How", "كيف", False)], stg_rows, [3, 11, 22, 14])
    pay_rows = [[("1", "1", "nx"), ("Advance", "الدفعة المقدمة", ""), ("Two months of the monthly price", "شهران من السعر الشهري", "c"), ("On signing", "عند التوقيع", "")],
                [("2", "2", "nx"), ("Monthly invoice — workers on duty", "فاتورة شهرية — العمال على رأس العمل", ""), ("100%", "100%", "c"), ("Within 7 days of the invoice", "خلال 7 أيام من الفاتورة", "")]]
    pay = bi_table([("#", "#", True), ("Payment", "الدفعة", False), ("Amount", "المقدار", True), ("Due", "الاستحقاق", False)], pay_rows, [4, 20, 14, 16])
    sheets.append(page(h2(12, "What you pay and when", "ماذا تدفع ومتى") + stg + h2(13, "Payment terms", "طريقة الدفع") + pay))
    sheets.append(page(h2(14, "Terms and conditions", "الشروط والأحكام") + numbered([(esc(e), esc(a)) for e, a in TERMS], "Term", "الشرط")))

    # 6 التوقيعان
    sg = ('<div class="rw"><div class="col" dir="ltr"><p>By signing below, both parties accept this quotation and its terms and conditions.</p></div>'
          '<div class="col" dir="rtl"><p>%s</p></div></div>') % esc(ar("بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه."))
    inner = h2(15, "Signatures", "التوقيعان") + sg + sig_boxes(right_co=esc(CLIENT_AR))
    sheets.append(page(inner))

    def closing(i, n):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
                '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
                '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 / طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714<br>'
                'Mobile / الجوال: %s<br>Email / الإيميل: %s<br>Website / الموقع: %s</div>'
                '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: Business Partner Solutions / بزنس بارتنر سلوشنز<br>Bank / البنك: %s<br>IBAN: %s</div></div></div></div></section>') % (
            num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), esc(BANK), num(IBAN))
    sheets.append(closing)
    return doc("Quotation — ISR Trading (Workforce)", css, sheets)

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
    open(os.path.join(out, "01-Quotation.html"), "w", encoding="utf-8").write(build_quote())
    h, _ = build_contract(); open(os.path.join(out, "02-Agreement.html"), "w", encoding="utf-8").write(h)
    h, _ = build_nda(); open(os.path.join(out, "03-NDA.html"), "w", encoding="utf-8").write(h)
    open(os.path.join(out, "07-Authorization-Letter.html"), "w", encoding="utf-8").write(build_authz())
    from info_docs import INFO
    for fname, spec in INFO.items():
        open(os.path.join(out, fname + ".html"), "w", encoding="utf-8").write(build_info(*spec))
    print("ok", out, "FINAL" if FINAL else "scrubbed")
