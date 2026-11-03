# -*- coding: utf-8 -*-
"""مولّد حزمة «نظام التعاقد» (EOR) لأي عميل — عرض سعر A4 أفقي + عقد + اتفاقية عدم إفصاح + خطاب تفويض (A4 عمودي).

التصميم والقوالب والخطوط: نفسها المعتمدة (docs/sales/templates)، ومولّد ISR Trading (cases/2026-11-02-isr-workforce) هو الأصل.
المتغير الوحيد = ملف إعداد العميل (cfg_<client>.py يعرّف C). لا أسعار تُخترع: كل خانة غير موثّقة `[●]`.
لا بيانات شخصية. الجوال يظهر في الفوتر كما أمر المالك؛ الآيبان `[IBAN]` يُحقن في النسخ النهائية بقرار بدر وحده.

الاستعمال: python3 eorpack.py <cfg.py> <outdir> [--only quote,agreement,nda,authz]
"""
import base64, html, importlib.util, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
TPL = os.path.join(ROOT, "docs/sales/templates")
LOGO = os.path.join(TPL, "assets/business-partner-logo-clean.png")
LEGAL_MD = os.path.join(TPL, "categories/contract-core-and-category-clauses-FOR-LEGAL-REVIEW.md")
AUTH_MD = os.path.join(TPL, "categories/authorization-letter-template-DRAFT.md")
RLM = "‏"
PHONE = os.environ.get("BP_PHONE", "00966530540231")
IBAN = "[IBAN]"
BANK = "[●]"
BOX = "☐"

REP_EN, REP_AR = "Dr. Baher Magnas", "د. باهر مقنص"
REP_TITLE_EN, REP_TITLE_AR = "Chief Executive Officer", "المدير التنفيذي"

C = {}   # إعداد العميل الحالي (يُحمَّل في main)

def esc(s): return html.escape(s, quote=False)
def num(s): return '<span class="num">%s</span>' % esc(str(s))
def ar(s): return re.sub(r"\.(?=\s|$)", "." + RLM, s)
def n(x): return "{:,}".format(x)
def n2(x): return "{:,.2f}".format(x) if x != int(x) else "{:,}".format(int(x))
def B(): return num("[●]")

# ------------------------------------------------------------------ القوالب والـCSS
def css_of(tpl):
    s = open(os.path.join(TPL, tpl), encoding="utf-8").read()
    c = s[s.index("<style>") + 7: s.index("</style>")]
    b64 = base64.b64encode(open(LOGO, "rb").read()).decode()
    return c.replace("url(assets/business-partner-logo-clean.png)", "url(data:image/png;base64,%s)" % b64)

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

def footer(i, n_):
    return ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
            '<div class="c">%s<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">%d / %d</span></div>'
            '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>') % (esc(PHONE), i, n_)

def doc(title, css, sheets):
    n_ = len(sheets)
    body = "".join(s(i + 1, n_) if callable(s) else s for i, s in enumerate(sheets))
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title>%s<style>%s%s</style></head><body>%s</body></html>') % (esc(title), FONTS, css, EXTRA, body)

# ------------------------------------------------------------------ مكوّنات عرض السعر (A4 أفقي)
def hd2(en, a):
    return ('<div class="hd2"><span class="logo" role="img" aria-label="Business Partner"></span>'
            '<div class="t e"><h1>%s</h1></div><div class="t a"><h1>%s</h1></div></div>') % (esc(en), esc(a))

def meta_row():
    return ('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> %s</div><div class="meta1"><b>Date:</b> %s</div><div class="meta1"><b>Quote validity:</b> 14 days</div></div>'
            '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> %s</div><div class="meta1"><b>التاريخ:</b> %s</div><div class="meta1"><b>صلاحية العرض:</b> 14 يوماً</div></div></div>') % (
        esc(C["client_en"]), esc(C["date_en"]), esc(C["client_ar"]), esc(C["date_ar"]))

def h2(i, en, a):
    return ('<div class="rw"><div class="col" dir="ltr"><h2><span class="n">%s</span>%s</h2></div>'
            '<div class="col" dir="rtl"><h2><span class="n">%s</span>%s</h2></div></div>') % (i, esc(en), i, esc(a))

def bi_table(head, rows, widths, cls="pt"):
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
    head = [("#", "#", True), (le, la, False)]
    body = [[(str(i), str(i), "nx"), (e, ar(a), "t")] for i, (e, a) in enumerate(rows, 1)]
    return bi_table(head, body, [4, 46])

def sig_boxes():
    def box(t, co, nm=None, tt=None):
        return ('<div><h3><span>%s</span><span dir="rtl">%s</span></h3>'
                '<div class="f2"><span>Company / Party</span><span class="v cn">%s</span><span dir="rtl">الشركة / الطرف</span></div>'
                '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div>'
                '<div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
                '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div>'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>') % (
            esc(t[0]), esc(t[1]), co, nm or B(), tt or B(), B())
    return '<div class="sg" style="direction:ltr">%s%s</div>' % (
        box(("Business Partner Solutions", "بزنس بارتنر سلوشنز"), esc("Business Partner Solutions · بزنس بارتنر سلوشنز"),
            esc(REP_EN) + ' · <span dir="rtl">' + esc(REP_AR) + '</span>', esc(REP_TITLE_EN) + ' · <span dir="rtl">' + esc(REP_TITLE_AR) + '</span>'),
        box(("Client", "العميل"), esc(C["client_ar"])))

# ------------------------------------------------------------------ عرض السعر
def tick(en, a): return ("%s %s" % (BOX, en), "%s %s" % (BOX, a))

def build_quote():
    css = css_of("REV-quote-template-bilingual.html")
    sheets = []
    q = C["quote"]
    workers = sum(r["count"] for r in C["roles"])

    def cover(i, n_):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv lt"><div class="lgband"><span class="logo big" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">%s</h1><div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>%s</h1><div class="sb">%s</div></div></div>'
                '<div class="pk" dir="ltr">%s</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">%s</div>'
                '<div class="ch"><div><span>To / إلى السادة</span><span class="nm">%s</span></div><div><span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span></div>'
                '<div><span>Validity / صلاحية العرض</span>14 days<br><span dir="rtl">14 يوماً</span></div></div></div></div></section>') % (
            esc(q["cover_title_en"]), esc(q["cover_sub_en"]), esc(q["cover_title_ar"]), esc(ar(q["cover_sub_ar"])),
            esc(q["cover_tag_en"]), esc(q["cover_tag_ar"]), esc(C["client_ar"]), esc(C["date_en"]), esc(C["date_ar"]))
    sheets.append(cover)

    def page(inner):
        def f(i, n_):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
                hd2(q["title_en"], q["title_ar"]), inner, footer(i, n_))
        return f

    # 1 النطاق
    scope_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")]
                  for i, (te, ta, de, da) in enumerate(q["scope"], 1)]
    scope = bi_table([("#", "#", True), ("Scope of service", "نطاق الخدمة", False)], scope_rows, [4, 46])

    # 2 السعر لعامل واحد ولكل العدد
    prow = []
    for i, r in enumerate(C["roles"], 1):
        prow.append([(str(i), str(i), "nx"), ("<b>%s</b>" % esc(r["en"]), "<b>%s</b>" % esc(r["ar"]), "t"),
                     (esc(r["nat_en"]), esc(r["nat_ar"]), "c"), (str(r["count"]), str(r["count"]), "c"),
                     (num(n2(r["price"])) if r.get("price") is not None else B(), num(n2(r["price"])) if r.get("price") is not None else B(), "c"),
                     (num(n2(r["price"] * r["count"])) if r.get("price") is not None else B(), num(n2(r["price"] * r["count"])) if r.get("price") is not None else B(), "c")])
    known = all(r.get("price") is not None for r in C["roles"])
    gtot = num(n2(sum(r["price"] * r["count"] for r in C["roles"]))) if known else B()
    prow.append({"cls": "tot", "cells": [("", "", ""), ("Total — all workers, per month", "الإجمالي — كل العمال، شهرياً", ""), ("", "", ""),
                 (str(workers) + (q.get("workers_suffix_en", "")), str(workers) + (q.get("workers_suffix_ar", "")), "c"), ("", "", ""), (gtot, gtot, "c")]})
    price = bi_table([("#", "#", True), ("Role", "الوظيفة", False), ("Nationality", "الجنسية", True), ("Workers", "العدد", True),
                      ("Monthly price per worker (SAR)", "السعر الشهري للعامل (ريال)", True), ("Monthly total (SAR)", "الإجمالي الشهري (ريال)", True)],
                     prow, [3, 17, 11, 5, 9, 9])
    pnote = ('<div class="nt"><div dir="ltr">%s</div><div class="ar" dir="rtl">%s</div></div>') % (esc(q["price_note_en"]), esc(ar(q["price_note_ar"])))
    inc = numbered([(esc(e), esc(a)) for e, a in q["includes"]], "Included in the monthly price", "ما يشمله السعر الشهري")
    cost_rows = []
    for i, (te, ta, de, da, who) in enumerate(q["at_cost"], 1):
        if who == "client":
            c = ("The Client", "العميل", "c")
        else:
            c = (esc(who[0]), esc(who[1]), "c")
        cost_rows.append([(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t"), c])
    cost = bi_table([("#", "#", True), ("Invoiced at actual cost", "يُفوتَر بالتكلفة الفعلية", False), ("Who bears it", "من يتحمله", True)], cost_rows, [4, 38, 12])
    req = numbered([(esc(e), esc(a)) for e, a in q["requirements"]], "What we need from the Client", "المتطلبات من العميل")
    exc = numbered([(esc(e), esc(a)) for e, a in q["exclusions"]], "Not included in the price", "ما لا يشمله السعر")

    srows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(se), esc(we)), "<b>%s</b> — %s" % (esc(sa), esc(ar(wa))), "t"), (B(), B(), "c")]
             for i, (se, sa, we, wa) in enumerate(q["stages"], 1)]
    stg = bi_table([("#", "#", True), ("Stage", "المرحلة", False), ("Days", "الأيام", True)], srows, [4, 40, 6])
    dur = ('<div class="rw"><div class="col" dir="ltr"><p>%s</p></div><div class="col" dir="rtl"><p>%s</p></div></div>') % (esc(q["term_en"]), esc(ar(q["term_ar"])))
    pay_rows = [[("1", "1", "nx"), ("Advance", "الدفعة المقدمة", ""), (B(), B(), "c"), ("On signing", "عند التوقيع", "")],
                [("2", "2", "nx"), ("Monthly invoice — workers on duty", "فاتورة شهرية — العمال على رأس العمل", ""), ("100%", "100%", "c"), ("Within [●] days of the invoice", "خلال [●] يوماً من الفاتورة", "")]]
    pay = bi_table([("#", "#", True), ("Payment", "الدفعة", False), ("Share", "النسبة", True), ("Due", "الاستحقاق", False)], pay_rows, [4, 22, 8, 16])
    terms = numbered([(esc(e), esc(a)) for e, a in q["terms"]], "Term", "الشرط")

    sheets.append(page(meta_row() + h2(1, "Scope", "النطاق") + scope))
    sheets.append(page(h2(2, "Price — per worker per month, and for the full headcount", "السعر — للعامل الواحد شهرياً ولكامل العدد") + price + pnote
                        + h2(3, "What the price includes", "ما يشمله السعر") + inc))
    sheets.append(page(h2(4, "What is invoiced at cost, and who bears it", "ما يُفوتَر بالتكلفة ومن يتحمله") + cost
                        + h2("4b", "Not included", "ما لا يشمله العرض") + exc))
    sheets.append(page(h2(5, "Requirements from the Client", "المتطلبات من العميل") + req
                        + h2(6, "Duration and stages", "المدة والمراحل") + dur + stg))
    sheets.append(page(h2(7, "Payment terms", "طريقة الدفع") + pay + h2(8, "Terms and conditions", "الشروط والأحكام") + terms))

    sg = ('<div class="rw"><div class="col" dir="ltr"><p>By signing below, both parties accept this quotation and its terms and conditions.</p></div>'
          '<div class="col" dir="rtl"><p>%s</p></div></div>') % esc(ar("بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه."))
    sheets.append(page(h2(9, "Signatures", "التوقيعان") + sg + sig_boxes()))

    def closing(i, n_):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
                '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
                '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 / طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714<br>'
                'Mobile / الجوال: %s<br>Email / الإيميل: %s<br>Website / الموقع: %s</div>'
                '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: Business Partner Solutions / بزنس بارتنر سلوشنز<br>Bank / البنك: %s<br>IBAN: %s</div></div></div></div></section>') % (
            num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), esc(BANK), num(IBAN))
    sheets.append(closing)
    return doc("Quotation — " + C["client_en"], css, sheets)

# ------------------------------------------------------------------ العقد وNDA وخطاب التفويض (A4 عمودي)
def hd_port(en, a):
    return ('<div class="hd" dir="ltr"><span class="logo" role="img" aria-label="Business Partner"></span>'
            '<div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">%s</h1><div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">%s</div></div></div>') % (esc(a), esc(en))

def parties_html():
    me = ('<table class="pty2"><tr><th colspan="3"><span>First Party (Service Provider)</span><span dir="rtl">الطرف الأول (مزوّد الخدمة)</span></th></tr>'
          '<tr><td>Name</td><td class="v">Business Partner Solutions<br><span dir="rtl">شركة بزنس بارتنر سلوشنز</span></td><td>الاسم</td></tr>'
          '<tr><td>Unified / CR No.</td><td class="v">%s</td><td>الرقم الموحد / السجل التجاري</td></tr>'
          '<tr><td>VAT No.</td><td class="v">%s</td><td>الرقم الضريبي</td></tr>'
          '<tr><td>National Address</td><td class="v">%s</td><td>العنوان الوطني</td></tr>'
          '<tr><td>Represented by</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>يمثلها</td></tr>'
          '<tr><td>Title</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>الصفة</td></tr></table>') % (
        num("7038825860"), num("312079341500003"), num("RDAA9214"), esc(REP_EN), esc(REP_AR), esc(REP_TITLE_EN), esc(REP_TITLE_AR))
    cl = ('<table class="pty2"><tr><th colspan="3"><span>Second Party (Client)</span><span dir="rtl">الطرف الثاني (العميل)</span></th></tr>'
          '<tr><td>Name</td><td class="v">%s</td><td>الاسم</td></tr>'
          '<tr><td>Unified / CR No.</td><td class="v">%s</td><td>الرقم الموحد / السجل التجاري</td></tr>'
          '<tr><td>VAT No.</td><td class="v">%s</td><td>الرقم الضريبي</td></tr>'
          '<tr><td>National address</td><td class="v">%s</td><td>العنوان الوطني</td></tr>'
          '<tr><td>Represented by</td><td class="v">%s</td><td>يمثلها</td></tr>'
          '<tr><td>Title</td><td class="v">%s</td><td>الصفة</td></tr></table>') % (
        esc(C["client_en"]) + ("" if C["client_en"] == C["client_ar"] else '<br><span dir="rtl">%s</span>' % esc(C["client_ar"])), B(), B(), B(), B(), B())
    return me + cl

STATE = {"numbered": True, "parties": True, "start": 2}

def clause_tr(no, r):
    t_en, t_ar, b_en, b_ar = r
    pre = "%d. " % no if STATE["numbered"] else ""
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

def cover_port(kind_en, kind_ar, t_en, t_ar, s_en, s_ar, ref_en, ref_ar):
    def f(i, n_):
        return ('<section class="sheet port cover" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">%s</div><h1 class="pf">%s</h1><div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">%s</div><h1>%s</h1><div class="sb">%s</div></div></div>'
                '<div class="ch"><div><span>Parties / الأطراف</span>Business Partner Solutions<br>%s</div><div><span>Date / التاريخ</span>%s<br>%s</div><div><span>Ref / المرجع</span>%s<br><span dir="rtl">%s</span></div></div></div></div></section>') % (
            esc(kind_en), esc(t_en), esc(s_en), esc(kind_ar), esc(t_ar), esc(ar(s_ar)),
            esc(C["client_ar"]), esc(C["date_en"]), '<span dir="rtl">' + esc(C["date_ar"]) + '</span>', esc(ref_en), esc(ref_ar))
    return f

def closing_port():
    def f(i, n_):
        return ('<section class="sheet port cover" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">PARTNERING FOR YOUR SUCCESS</div><h1 class="pf" style="font-size:34px">Business Partner Solutions</h1>'
                '<div class="sb" style="direction:rtl;text-align:right;margin-top:6px">بزنس بارتنر سلوشنز</div>'
                '<div class="bx" style="flex-direction:column;gap:22px"><div><b>Company · المنشأة</b>'
                '<div class="kv"><span>Unified No.</span><span class="kvv">%s</span><span dir="rtl">الرقم الموحد</span></div>'
                '<div class="kv"><span>VAT No.</span><span class="kvv">%s</span><span dir="rtl">الرقم الضريبي</span></div>'
                '<div class="kv"><span>National Address</span><span class="kvv">%s · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714</span><span dir="rtl">العنوان الوطني</span></div></div>'
                '<div><b>Contact · التواصل</b><div class="kv"><span>Mobile</span><span class="kvv">%s</span><span dir="rtl">الجوال</span></div>'
                '<div class="kv"><span>Email</span><span class="kvv">%s</span><span dir="rtl">الإيميل</span></div>'
                '<div class="kv"><span>Website</span><span class="kvv">%s</span><span dir="rtl">الموقع</span></div></div></div></div></div></section>') % (
            num("7038825860"), num("312079341500003"), num("RDAA9214"), num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"))
    return f

def measure(rows_html, extra_blocks, css, path):
    meas = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">%s<style>%s%s</style></head><body>'
            '<section class="sheet port" lang="ar"><div dir="rtl">%s<table class="cl" style="margin:0">%s</table>%s</div></section></body></html>') % (
        FONTS, css, EXTRA, hd_port("x", "x"), rows_html, extra_blocks)
    open(path, "w", encoding="utf-8").write(meas)
    out = subprocess.check_output(["node", os.path.join(HERE, "render.cjs"), "measure", path],
                                  env=dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"]).decode().strip()))
    return json.loads(out)

def paginate_port(rows, title_en, title_ar, cover_args, with_sig=True):
    css = css_of("REV-contract-bilingual.html")
    nums = list(range(STATE["start"], STATE["start"] + len(rows)))
    trs = [clause_tr(no, r) for no, r in zip(nums, rows)]
    pa = '<div data-m="parties"><div class="pre"><b>1. الأطراف / Parties</b></div>%s</div>' % parties_html()
    tmp = os.path.join(tempfile.gettempdir(), "eorpack-measure-%d.html" % os.getpid())
    ms = measure("".join(trs), pa + sig_port(), css, tmp)
    os.remove(tmp)
    top = ms["__hdBottom"] + 6
    LIM = 979 - 40
    avail = LIM - top
    pages, cur, used, first = [], [], 0, True
    def new_page():
        nonlocal cur, used, first
        pages.append((cur, first)); cur = []; used = 0; first = False
    used = (ms["parties"] + 6) if STATE["parties"] else 0
    for k, tr in enumerate(trs):
        h = ms["r%d" % nums[k]]
        if used + h > avail and cur:
            new_page()
        cur.append(tr); used += h
    sig_h = ms["sig"] + 8
    if with_sig and used + sig_h > avail:
        last_tr = cur.pop()
        new_page()
        cur.append(last_tr)
    pages.append((cur, first))
    sheets = [cover_port(*cover_args)]
    last = len(pages) - 1
    for pi, (rs, is_first) in enumerate(pages):
        def f(i, n_, rs=rs, is_first=is_first, pi=pi):
            body = ""
            if is_first and STATE["parties"]:
                body += '<div class="pre"><b>1. الأطراف / Parties</b></div>' + parties_html()
            body += ('<table class="cl">%s</table>' % "".join(re.sub(r' data-m="r\d+"', "", x) for x in rs)) if rs else ""
            if with_sig and pi == last:
                body += re.sub(r' data-m="sig"', "", sig_port())
            return '<section class="sheet port" lang="ar"><div dir="rtl">%s%s</div>%s</section>' % (hd_port(title_en, title_ar), body, footer(i, n_))
        sheets.append(f)
    sheets.append(closing_port())
    return doc(title_ar, css, sheets)

# ---------------------------------------------------------------- نصوص القانونية (المصدر الوحيد للنص)
def parse_legal(path=LEGAL_MD):
    sec = None; cur = None; out = {}
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## "):
            sec = line[3:].strip(); out.setdefault(sec, {}); cur = None
        elif line.startswith("### "):
            cur = line[4:].strip(); out[sec][cur] = {}
        elif cur and line.startswith("- EN: "): out[sec][cur]["en"] = line[6:].strip()
        elif cur and line.startswith("- AR: "): out[sec][cur]["ar"] = line[6:].strip()
    return out

def _find(prefix):
    L = parse_legal()
    for k in L:
        if k.startswith(prefix): return L[k]
    raise KeyError(prefix)

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

def _pts(no, items):
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
    k = C["contract"]
    core = _find("نواة العقد")
    rows = []
    def add(t_en, t_ar, b_en, b_ar): rows.append([t_en, t_ar, b_en, b_ar])
    def pts(t_en, t_ar, no, items, extra_en="", extra_ar=""):
        e, a = _pts(no, items); add(t_en, t_ar, e + extra_en, a + extra_ar)
    roles_tbl = _mini_table(["Role · الوظيفة", "Workers · العدد", "Nationality · الجنسية"],
                            [["%s<br>%s" % (r["en"], r["ar"]), str(r["count"]), "%s<br>%s" % (r["nat_en"], r["nat_ar"])] for r in C["roles"]], [50, 15, 35])

    pts("Subject and definitions", "موضوع العقد والتعريفات", 2, k["subject"], "<br>" + roles_tbl, "<br>" + roles_tbl)

    fee = _mini_table(["Item · البند", "Basis · الأساس"], [
        ["Monthly price per worker · السعر الشهري للعامل", "As in the accepted quotation, section 2 · كما في عرض السعر المقبول، البند 2"],
        ["Items at cost · البنود بالتكلفة", "As in the accepted quotation, section 4 · كما في عرض السعر المقبول، البند 4"],
        ["VAT · ضريبة القيمة المضافة", "15%"]], [45, 55])
    items3 = [
        ("The Second Party pays the First Party the monthly price per worker stated in the accepted quotation, multiplied by the number of workers on duty in the month.",
         "يسدّد الطرف الثاني للطرف الأول السعر الشهري للعامل المذكور في عرض السعر المقبول مضروباً في عدد العمال على رأس العمل في الشهر."),
        ("The items the accepted quotation lists as invoiced at cost are invoiced at actual cost with the supporting receipts, to the party the quotation names.",
         "تُفوتر البنود التي يذكر عرض السعر المقبول أنها بالتكلفة بتكلفتها الفعلية مع الإيصالات المؤيدة، على الطرف الذي يحدده العرض."),
        ("Overtime is invoiced separately at the actual hours worked under the regulations.", "يُفوتر العمل الإضافي على حدة بالساعات الفعلية وفق الأنظمة."),
        ("Prices are before 15% VAT, which is added. Payment terms: advance of [●] months, then monthly, within [●] days of the invoice.",
         "الأسعار قبل ضريبة القيمة المضافة 15% التي تُضاف عليها. شروط السداد: دفعة مقدمة قدرها [●] أشهر، ثم شهرياً خلال [●] يوماً من الفاتورة."),
        ("Bank transfer to the First Party’s account: Bank [●], IBAN [IBAN].", "التحويل البنكي إلى حساب الطرف الأول: البنك [●]، الآيبان [IBAN].")]
    e, a = _pts(3, items3)
    add("Fees and payment", "الرسوم والسداد", e + "<br>" + fee, a + "<br>" + fee)

    pts("Term, start and stages", "المدة والمباشرة والمراحل", 4, k["term"])
    pts("Selection of workers", "اختيار العمال", 5, [
        ("Before dispatch or assignment, the First Party gives the Second Party the candidates’ CVs, and the Second Party may interview them and reject a candidate for a stated reason.",
         "قبل الإرسال أو الإسناد يسلّم الطرف الأول الطرف الثاني سير المرشحين، وللطرف الثاني مقابلتهم ورفض أي مرشح لسبب مبيّن."),
        ("A rejected candidate is replaced at the First Party’s cost before dispatch or assignment.", "يُستبدل المرشح المرفوض على نفقة الطرف الأول قبل الإرسال أو الإسناد."),
        ("The roles, numbers and nationalities are those in the accepted quotation; any change needs a written change request priced separately.",
         "الوظائف والأعداد والجنسيات هي الواردة في عرض السعر المقبول؛ وأي تغيير يحتاج طلب تغيير كتابياً يُسعَّر على حدة.")])
    pts("Accommodation, transport and working conditions", "السكن والنقل وظروف العمل", 6, k["conditions"])
    pts("Replacement and guarantee", "الاستبدال والضمان", 7, [
        ("The First Party replaces a worker who is unfit for the role or leaves during the guarantee period of [●] months, within [●] days of written notice.",
         "يستبدل الطرف الأول العامل الذي لا يصلح للوظيفة أو يغادر خلال فترة الضمان البالغة [●] أشهر، خلال [●] يوماً من الإشعار الكتابي."),
        ("The guarantee does not cover a worker’s departure caused by the Second Party’s breach, unsafe conditions, or non-payment of dues.",
         "لا يشمل الضمان مغادرة العامل بسبب إخلال الطرف الثاني أو ظروف عمل غير آمنة أو عدم سداد المستحقات."),
        ("The Second Party gives written notice of a request for replacement, with the reason.", "يرسل الطرف الثاني إشعاراً كتابياً بطلب الاستبدال مع بيان السبب.")])
    pts("Obligations of the First Party", "التزامات الطرف الأول", 8, [
        ("Employ the workers as their legal employer, and pay their wages on time through the wage-protection system.", "توظيف العمال بصفته صاحب عملهم النظامي ودفع أجورهم في موعدها عبر نظام حماية الأجور."),
        ("Maintain the workers’ residence permits, work permits, health and social insurance, and keep their records.", "إبقاء إقامات العمال ورخص عملهم وتأمينهم الصحي والاجتماعي سارية وحفظ سجلاتهم."),
        ("Charge no fee to any worker in any form, and never withhold a worker’s passport.", "عدم تقاضي أي مقابل من أي عامل بأي صورة، وعدم حجز جواز أي عامل."),
        ("Appoint a point of contact and report monthly on the workers’ attendance.", "تعيين نقطة اتصال وتقديم تقرير شهري بحضور العمال.")])
    pts("Obligations of the Second Party (the Client)", "التزامات الطرف الثاني (العميل)", 9, [
        ("Give the First Party, in good time, the site, the start date, the job descriptions and the information needed to place the workers.",
         "تزويد الطرف الأول في الوقت المناسب بالموقع وتاريخ المباشرة والأوصاف الوظيفية والمعلومات اللازمة لإسناد العمال."),
        ("Pay the invoices on their due dates and the actual-cost items against receipts.", "سداد الفواتير في مواعيدها والبنود بالتكلفة الفعلية مقابل الإيصالات."),
        ("Direct the daily tasks within the agreed roles only; hiring, dismissal, discipline, wages and leave remain the First Party’s decisions as employer.",
         "توجيه المهام اليومية ضمن الوظائف المتفق عليها وحدها؛ وتبقى قرارات التوظيف والفصل والتأديب والأجور والإجازات للطرف الأول بصفته صاحب العمل."),
        ("Provide a safe site and comply with the occupational-safety regulations.", "توفير موقع آمن والالتزام بأنظمة السلامة المهنية."),
        ("Not employ the workers directly or move them to another party during the Agreement without the First Party’s written consent.",
         "عدم توظيف العمال مباشرة ولا نقلهم إلى جهة أخرى خلال العقد دون موافقة الطرف الأول الكتابية.")])
    pts("Data protection", "حماية بيانات التواصل والعمال", 10, [
        ("Purpose: the personal data of the workers and of the Second Party’s contacts is used only to perform this Agreement and the related government procedures.",
         "الغرض: تُستعمل البيانات الشخصية للعمال ولجهات اتصال الطرف الثاني لتنفيذ هذا العقد والإجراءات الحكومية المرتبطة به فقط."),
        ("Storage: the data is kept securely for the Agreement term and the period the regulations require.", "التخزين: تُحفظ البيانات بأمان طوال مدة العقد والمدة التي تقتضيها الأنظمة."),
        ("Sharing: the data is shared only with the competent authorities, the licensed parties and the service providers needed for performance, under the same obligations. Any transfer outside the Kingdom follows the choice made in the authorisation letter.",
         "المشاركة: لا تُشارك البيانات إلا مع الجهات المختصة والجهات المرخصة ومزودي الخدمات اللازمين للتنفيذ، بالالتزامات نفسها. وأي نقل خارج المملكة يتبع الخيار المحدد في خطاب التفويض."),
        ("Rights: each person may request access to, correction of or deletion of their data, as the regulations allow.", "الحقوق: لكل شخص طلب الاطلاع على بياناته أو تصحيحها أو إتلافها بحسب ما تجيزه الأنظمة."),
        ("Destruction: the data is destroyed or returned at the end of the Agreement, except what the regulations require to be kept.", "الإتلاف: تُتلف البيانات أو تُعاد عند انتهاء العقد، عدا ما توجب الأنظمة حفظه.")])
    pts("Compliance", "الالتزام النظامي", 11, [
        ("The Agreement is performed under the labour, recruitment and social-insurance regulations, through licensed parties, and within the First Party’s licence and registered activities.",
         "يُنفَّذ العقد وفق أنظمة العمل والاستقدام والتأمينات الاجتماعية، عبر جهات مرخصة، وضمن ترخيص الطرف الأول وأنشطة سجله."),
        ("No visa is requested without real work, and no service transfer or change of profession is made by circumvention.", "لا تُطلب تأشيرة دون عمل حقيقي، ولا يُنقل عامل ولا تُغيّر مهنة بالتحايل."),
        ("The First Party does not guarantee any effect on the Second Party’s localisation count or band.", "لا يضمن الطرف الأول أي أثر على نسبة التوطين أو نطاق الطرف الثاني.")])
    pts("Early termination and end-of-service", "الإنهاء المبكر ونهاية الخدمة", 12, [
        ("Early termination by the Second Party before the end of the term: the Second Party pays the monthly prices up to the end of the notice period of [●] days, and the actual-cost items already incurred.",
         "الإنهاء المبكر من الطرف الثاني قبل نهاية المدة: يسدّد الطرف الثاني الأسعار الشهرية حتى نهاية مدة الإشعار البالغة [●] يوماً، والبنود بالتكلفة التي تحققت فعلاً."),
        ("The end-of-service award is calculated under the labour regulations. Where the Agreement ends before two years, who bears the amounts that the regulations do not require is: [●].",
         "تُحتسب مكافأة نهاية الخدمة وفق نظام العمل. وإذا انتهى العقد قبل سنتين فمن يتحمل المبالغ التي لا تلزم بها الأنظمة هو: [●]."),
        ("Where the accepted quotation states that end-of-service, annual leave and the return ticket are invoiced at cost, they are settled with the final invoice.",
         "وحيث يذكر عرض السعر المقبول أن مكافأة نهاية الخدمة والإجازة السنوية وتذكرة العودة بالتكلفة، فتُسوَّى مع الفاتورة الأخيرة.")])
    pts("Cancellation and refund", "الإلغاء والاسترداد", 13, k["cancel"])
    for p in ("12.", "14.", "15.", "16.", "17.", "18."):
        add(*_clause(core, p))
    return rows

# ---------------------------------------------------------------- خطاب التفويض
def auth_legal():
    out, in_p1, cur = {}, False, None
    for line in open(AUTH_MD, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## الجزء الأول"): in_p1 = True; continue
        if line.startswith("## الجزء الثاني"): break
        if not in_p1: continue
        if line.startswith("### "): cur = line[4:].strip(); out[cur] = {}
        elif cur and line.startswith("- EN: "): out[cur]["en"] = line[6:].strip()
        elif cur and line.startswith("- AR: "): out[cur]["ar"] = line[6:].strip()
    return out

def _aget(d, no):
    for k, v in d.items():
        if k.startswith("%d. " % no) and "en" in v:
            a, b = [x.strip() for x in k.split(" / ", 1)]
            return re.sub(r"^\d+\.\s*", "", a), re.sub(r"^\d+\.\s*", "", b), v["en"], v["ar"]
    raise KeyError(no)

def authz_rows():
    d = auth_legal(); R = []
    def add(t_en, t_ar, b_en, b_ar): R.append([t_en, t_ar, b_en, b_ar])
    a = C["authz"]
    add("2. Services covered", "2. الخدمات المشمولة",
        "Only the services of accepted quotation no. [●] (%s) that the Second Party ticks in section 3. Anything not ticked is not authorised." % a["services_en"],
        "خدمات عرض السعر المقبول رقم [●] (%s) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض." % a["services_ar"])
    add("3. Delegation list — the Second Party ticks what it authorises", "3. قائمة التفويض — يحدّد الطرف الثاني ما يفوّض به",
        "Tick %s each delegation the Second Party authorises. For each item: the entity, the scope, the term stated in section 9, and the right to stop it immediately by written notice." % BOX,
        "يضع الطرف الثاني علامة %s أمام كل تفويض يمنحه. ولكل بند: الجهة والنطاق والمدة المذكورة في البند 9 وحقه في إيقافه فوراً بإشعار كتابي." % BOX)
    for i, (te, ta, ee, ea, se, sa) in enumerate(a["deleg"], 1):
        se = se.replace("{BOX}", BOX); sa = sa.replace("{BOX}", BOX)
        add("3.%d  %s  %s Authorised" % (i, te, BOX), "3.%d  %s  %s مفوَّض" % (i, ta, BOX),
            "<b>Entity:</b> %s<br><b>Scope:</b> %s<br><b>Stop:</b> immediately by written notice." % (ee, se),
            "<b>الجهة:</b> %s<br><b>النطاق:</b> %s<br><b>الإيقاف:</b> فوراً بإشعار كتابي." % (ea, sa))
    for num_, label in ((3, "4"), (4, "5"), (5, "6"), (6, "7"), (7, "8"), (8, "9"), (9, "10"), (10, "11"), (11, "12"), (12, "13")):
        t_en, t_ar, b_en, b_ar = _aget(d, num_)
        if num_ == 3:
            b_en = b_en.replace("Within the covered services only, the Authorised Party may:", "Within the services the Second Party has ticked in section 3 only, the First Party may:")
            b_ar = b_ar.replace("ضمن الخدمات المشمولة وحدها، للمفوَّض:", "ضمن البنود التي حدّدها الطرف الثاني في البند 3 وحدها، للطرف الأول:")
        if num_ == 7:
            b_en = "The First Party acts only through its named staff: Dr. Baher Magnas, Chief Executive Officer; other named staff: [●] (identification details are kept in the executed copy)."
            b_ar = "يعمل الطرف الأول عبر موظفيه المسمّين وحدهم: د. باهر مقنص، المدير التنفيذي؛ وموظفون آخرون مسمّون: [●] (وبيانات الهوية في النسخة الموقّعة)."
        b_en = b_en.replace("the Category Annex", "section 3").replace("The Authorised Party", "The First Party").replace("the Authorised Party", "the First Party").replace("The Principal", "The Second Party").replace("the Principal", "the Second Party").replace("Principal’s", "Second Party’s")
        b_ar = b_ar.replace("ملحق الفئة", "البند 3").replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        t_en = t_en.replace("Principal’s", "Second Party’s").replace("Authorised Party’s", "First Party’s")
        t_ar = t_ar.replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        add("%s. %s" % (label, t_en), "%s. %s" % (label, t_ar), b_en, b_ar)
    return R

# ---------------------------------------------------------------- البناء
def load_cfg(path):
    spec = importlib.util.spec_from_file_location("cfg", path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m.C

def build(kind):
    ref_en, ref_ar = C["ref_en"], C["ref_ar"]
    if kind == "quote": return build_quote()
    if kind == "agreement":
        STATE.update(numbered=True, parties=True, start=2)
        cov = ("EMPLOYMENT OUTSOURCING AGREEMENT", "عقد نظام التعاقد", C["contract"]["title_en"], C["contract"]["title_ar"],
               C["contract"]["sub_en"], C["contract"]["sub_ar"], ref_en, ref_ar)
        return paginate_port(contract_clauses(), C["contract"]["title_en"], C["contract"]["title_ar"], cov)
    if kind == "nda":
        STATE.update(numbered=True, parties=True, start=2)
        cov = ("CONFIDENTIALITY", "سرية", "Mutual Non-Disclosure Agreement", "اتفاقية عدم إفصاح متبادلة",
               "A mutual agreement protecting the confidential information exchanged between the parties.",
               "اتفاقية متبادلة لحماية المعلومات السرية المتبادلة بين الطرفين.", ref_en, ref_ar)
        return paginate_port(nda_rows(), "Mutual Non-Disclosure Agreement", "اتفاقية عدم إفصاح متبادلة", cov)
    if kind == "authz":
        STATE.update(numbered=False, parties=False, start=1)
        cov = ("AUTHORIZATION", "تفويض", "Authorization Letter", "خطاب تفويض",
               "The Second Party chooses, from a list, what it authorises the First Party to do.",
               "يختار الطرف الثاني من قائمة ما يفوّض به الطرف الأول.", ref_en, ref_ar)
        h = paginate_port(authz_rows(), "Authorization Letter", "خطاب تفويض", cov, with_sig=True)
        STATE.update(numbered=True, parties=True, start=2)
        return h
    raise KeyError(kind)

FILES = {"quote": "01-Quotation", "agreement": "02-Agreement", "nda": "03-NDA", "authz": "04-Authorization-Letter"}

if __name__ == "__main__":
    cfg_path, out = sys.argv[1], sys.argv[2]
    only = None
    if "--only" in sys.argv: only = sys.argv[sys.argv.index("--only") + 1].split(",")
    C.update(load_cfg(cfg_path))
    os.makedirs(out, exist_ok=True)
    for kind, fn in FILES.items():
        if only and kind not in only: continue
        if kind not in C.get("docs", list(FILES)): continue
        open(os.path.join(out, fn + ".html"), "w", encoding="utf-8").write(build(kind))
    print("ok", out)
