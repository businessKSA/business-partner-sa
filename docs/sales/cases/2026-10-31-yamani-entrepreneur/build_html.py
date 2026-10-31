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
PHONE = os.environ.get("BP_PHONE", "[●]")
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
    def box(t, co):
        return ('<div><h3><span>%s</span><span dir="rtl">%s</span></h3>'
                '<div class="f2"><span>Company / Party</span><span class="v cn">%s</span><span dir="rtl">الشركة / الطرف</span></div>'
                '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div>'
                '<div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
                '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div>'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>') % (
            esc(t[0]), esc(t[1]), co, num("[●]"), num("[●]"), num("[●]"))
    return '<div class="sg" style="direction:ltr">%s%s</div>' % (
        box(left_title, esc(left_co)), box(right_title, right_co or num("[●]")))

# ------------------------------------------------------------------ عرض السعر
def build_quote():
    css = css_of("REV-quote-template-bilingual.html")
    sheets = []
    # 1 الغلاف
    def cover(i, n):
        return ('<section class="sheet land" lang="ar"><div dir="rtl"><div class="cv lt"><div class="lgband"><span class="logo big" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">Entrepreneurship-Licence Company Formation</h1>'
                '<div class="sb">Registering your investment under the entrepreneurship category with the Ministry of Investment, then establishing your company and registering it with the competent authorities.</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>تأسيس شركة برخصة ريادة الأعمال</h1>'
                '<div class="sb">%s</div></div></div>'
                '<div class="pk" dir="ltr">BP-FI-05 · Foreign Investment</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">BP-FI-05 · الاستثمار الأجنبي</div>'
                '<div class="ch"><div><span>To / إلى السادة</span><span class="nm">%s · <span dir="rtl">%s</span></span></div><div><span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span></div>'
                '<div><span>Validity / صلاحية العرض</span>14 days<br><span dir="rtl">14 يوماً</span></div></div></div></div>%s</section>') % (
            esc(ar("تسجيل استثمارك في فئة ريادة الأعمال لدى وزارة الاستثمار، ثم تأسيس شركتك وتسجيلها لدى الجهات المختصة.")),
            esc(CLIENT_EN), esc(CLIENT_AR), esc(DATE_EN), esc(DATE_AR), footer(i, n))
    sheets.append(cover)

    def page(inner):
        def f(i, n):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
                hd2(Q_TITLE_EN, Q_TITLE_AR), inner, footer(i, n))
        return f

    # 2 خدمات أخرى
    cards = [
        ("Shared Services Management", "إدارة الخدمات المشتركة",
         "HR, compliance and government relations under one annual monthly contract with a single point of contact, with our smart advisor supporting follow-up.",
         "الموارد البشرية والامتثال والعلاقات الحكومية بعقد شهري سنوي ونقطة اتصال واحدة، ويدعمك المستشار الذكي في المتابعة."),
        ("EOR & Recruitment", "EOR والتوظيف",
         "Employment on your behalf, workforce supply and recruitment, so your team can start without the administrative load.",
         "توظيف بالنيابة، وتوفير العمالة، واستقدام، لتبدأ فريقك دون عبء إداري."),
        ("Government Services Management", "إدارة الخدمات الحكومية",
         "We manage your transactions on Qiwa, Muqeem, Absher Business, GOSI, Mudad, Balady and more.",
         "نتابع معاملاتك على قوى ومقيم وأبشر أعمال والتأمينات ومدد وبلدي وغيرها."),
        ("Compliance Services", "خدمات الامتثال",
         "Compliance with localization (Saudization) and profession localization, and compliance of commercial registrations and licences. Violation follow-up: review, assessment of objection eligibility, then preparing, filing and following up the objection. The final decision rests with the competent authority.",
         "الامتثال للتوطين وتوطين المهن، والامتثال للسجلات التجارية والرخص. ومتابعة المخالفات: مراجعتها ودراسة أهلية الاعتراض، ثم تجهيز الاعتراض وتقديمه ومتابعته. القرار النهائي للجهة المختصة."),
    ]
    lk = '<a href="https://www.businesspartner.sa" target="_blank" rel="noopener">%s</a>'
    inner = '<div class="rw"><div class="col" dir="ltr"><h2>Other Business Partner services</h2></div><div class="col" dir="rtl"><h2>خدمات Business Partner الأخرى</h2></div></div>'
    for i, (te, ta, de, da) in enumerate(cards, 1):
        inner += ('<div class="rw cd"><div class="col" dir="ltr"><div class="card"><b>%d. %s</b><br>%s<br><i>Price per case or per catalogue</i> · %s</div></div>'
                  '<div class="col" dir="rtl"><div class="card"><b>%d. %s</b><br>%s<br><i>السعر حسب الحالة أو بحسب الكتالوج</i> · %s</div></div></div>') % (
            i, lk % esc(te), esc(de), lk % "Learn more", i, lk % esc(ta), esc(ar(da)), lk % "اعرف المزيد")
    sheets.append(page(inner))

    # 3 السعر
    price_rows = [
        [("<b>BP-FI-05</b> · Entrepreneurship-Licence Company Formation — service fee, one time", "<b>BP-FI-05</b> · تأسيس شركة برخصة ريادة الأعمال (رائد أعمال) — أتعاب الخدمة، مرة واحدة", ""),
         (num(n(FEE)), num(n(FEE)), "c")],
        [("VAT 15% (added according to the regulations)", "ضريبة القيمة المضافة 15% (تُضاف وفق النظام)", ""), (num(n(VAT)), num(n(VAT)), "c")],
        {"cls": "tot", "cells": [("Total including VAT", "الإجمالي شامل الضريبة", ""), (num(n(TOTAL)), num(n(TOTAL)), "c")]},
        [("<b>Government fees</b> — paid by the Client directly to the entities (see below)", "<b>الرسوم الحكومية</b> — يسدّدها العميل مباشرة للجهات (انظر أدناه)", ""),
         ("<b>Not included</b>", "<b>غير شامل</b>", "c")],
    ]
    price = bi_table([("Item", "البند", False), ("SAR", "ريال", True)], price_rows, [40, 8])
    gov_rows = []
    for fe, fa, ee, ea, he, ha in GOV_FEES:
        gov_rows.append([(fe, fa, ""), (ee, ea, ""), (he, ar(ha), "")])
    gov = bi_table([("Fee", "الرسم", False), ("Entity", "الجهة", False), ("Amount and payment", "المبلغ وطريقة السداد", False)], gov_rows, [18, 12, 18])
    note = ('<div class="nt"><div dir="ltr"><b>Not included, always:</b> attestation of foreign documents and certified translation, the support entity’s or incubator’s fees, and sectoral licence fees for regulated activities. Government fees are paid by the Client directly when due.</div>'
            '<div class="ar" dir="rtl"><b>خارج السعر دائماً:</b> %s</div></div>') % esc(ar("تصديق المستندات الأجنبية والترجمة المعتمدة، ورسوم جهة الدعم أو الحاضنة، ورسوم الجهات القطاعية للأنشطة الخاضعة. ويسدّد العميل الرسوم الحكومية مباشرة عند استحقاقها."))
    inner = meta_row() + h2(1, "Price", "السعر") + price + h2("", "Government fees — not included in the price", "الرسوم الحكومية — غير شاملة في السعر") + gov + note
    sheets.append(page(inner))

    # 4 النطاق والمخرجات
    scope_rows = []
    for i, (te, ta, de, da) in enumerate(SCOPE, 1):
        scope_rows.append([(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")])
    scope = bi_table([("#", "#", True), ("Services included in the fee", "الخدمات الشاملة ضمن الأتعاب", False)], scope_rows, [4, 46])
    deliv = numbered([(esc(e), esc(a)) for e, a in DELIVERABLES], "Deliverable", "المخرج")
    inner = h2(2, "Scope — included in the fee", "النطاق — شامل ضمن الأتعاب") + scope + h2("", "Deliverables", "المخرجات") + deliv
    sheets.append(page(inner))

    # 5 المتطلبات وما لا يشمله
    inner = h2(3, "Requirements from the Client", "المتطلبات من العميل") + numbered([(esc(e), esc(a)) for e, a in REQUIREMENTS], "Requirement", "المتطلب") + \
        h2(4, "Not included in the quotation", "ما لا يشمله العرض / على العميل") + numbered([(esc(e), esc(a)) for e, a in EXCLUSIONS], "Not included", "غير مشمول")
    sheets.append(page(inner))

    # 6 المدة والدفع والشروط
    dur_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")]
                for i, (te, ta, de, da) in enumerate(DURATION, 1)]
    dur = bi_table([("#", "#", True), ("Stage", "المرحلة", False)], dur_rows, [4, 46])
    pay_rows = [[(p[0], p[0], "nx"), (p[1], p[2], ""), (p[3], p[3], "c"), (num(n(p[4])), num(n(p[4])), "c"), (num(n(p[5])), num(n(p[5])), "c"), (num(n(p[6])), num(n(p[6])), "c"), (p[7], p[8], "")]
                for p in PAYMENT]
    pay_rows.append({"cls": "tot", "cells": [("", "", ""), ("Total", "الإجمالي", ""), ("100%", "100%", "c"), (num(n(FEE)), num(n(FEE)), "c"), (num(n(VAT)), num(n(VAT)), "c"), (num(n(TOTAL)), num(n(TOTAL)), "c"), ("", "", "")]})
    pay = bi_table([("#", "#", True), ("Instalment", "الدفعة", False), ("%", "النسبة", True), ("SAR excl. VAT", "ريال قبل الضريبة", True),
                    ("VAT 15%", "الضريبة 15%", True), ("SAR incl. VAT", "ريال شامل الضريبة", True), ("Due", "الاستحقاق", False)],
                   pay_rows, [3, 9, 5, 7, 6, 7, 13])
    terms = numbered([(esc(e), esc(a)) for e, a in TERMS], "Term", "الشرط")
    inner = h2(5, "Duration", "المدة") + dur + h2(6, "Payment terms", "طريقة الدفع") + pay
    sheets.append(page(inner))
    sheets.append(page(h2(7, "Terms and conditions", "الشروط والأحكام") + terms))

    # 7 التوقيعان
    sg = ('<div class="rw"><div class="col" dir="ltr"><p>By signing below, both parties accept this quotation and its terms and conditions.</p></div>'
          '<div class="col" dir="rtl"><p>%s</p></div></div>') % esc(ar("بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه."))
    client_co = '%s · <span dir="rtl">%s</span>' % (esc(CLIENT_EN), esc(CLIENT_AR))
    inner = h2(8, "Signatures", "التوقيعان") + sg + sig_boxes(right_co=client_co)
    sheets.append(page(inner))

    # 8 الغلاف الختامي
    def closing(i, n):
        return ('<section class="sheet land" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
                '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
                '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 / طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714<br>'
                'Mobile / الجوال: %s<br>Email / الإيميل: %s<br>Website / الموقع: %s</div>'
                '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: Business Partner Solutions / بزنس بارتنر سلوشنز<br>Bank / البنك: %s<br>IBAN: %s</div></div></div></div>%s</section>') % (
            num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), esc(BANK), num(IBAN), footer(i, n))
    sheets.append(closing)
    return doc("عرض سعر — تأسيس شركة برخصة ريادة الأعمال", css, sheets)

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
          '<tr><td>Represented by</td><td class="v">%s</td><td>يمثلها</td></tr>'
          '<tr><td>Title</td><td class="v">%s</td><td>الصفة</td></tr></table>') % (num("7038825860"), num("312079341500003"), num("RDAA9214"), num("[●]"), num("[●]"))
    cl = ('<table class="pty2"><tr><th colspan="3"><span>Second Party (Client)</span><span dir="rtl">الطرف الثاني (العميل)</span></th></tr>'
          '<tr><td>Name</td><td class="v">%s<br><span dir="rtl">%s</span><br>%s</td><td>الاسم</td></tr>'
          '<tr><td>ID / Iqama / Passport No.</td><td class="v">%s</td><td>رقم الهوية / الإقامة / الجواز</td></tr>'
          '<tr><td>Nationality</td><td class="v">%s</td><td>الجنسية</td></tr>'
          '<tr><td>National / residence address</td><td class="v">%s</td><td>العنوان الوطني / السكن</td></tr>'
          '<tr><td>Capacity</td><td class="v">Founder of the company to be established<br><span dir="rtl">مؤسس الشركة المراد تأسيسها</span></td><td>الصفة</td></tr></table>') % (
        esc(CLIENT_EN), esc(CLIENT_AR), "full name as in ID: " + num("[●]"), num("[●]"), num("[●]"), num("[●]"))
    return me + cl

def clause_tr(no, r):
    t_en, t_ar, b_en, b_ar = r
    return '<tr data-m="r%d"><td class="en"><b>%d. %s</b><br>%s</td><td class="ar"><b>%d. %s</b><br>%s</td></tr>' % (
        no, no, esc(t_en), b_en.replace("&", "&amp;") if "&amp;" not in b_en else b_en, no, esc(t_ar), ar(b_ar))

def sig_port():
    return ('<div class="sg" data-m="sig" style="direction:ltr"><div><h3><span>First Party</span><span dir="rtl">الطرف الأول</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>'
            '<div><h3><span>Second Party</span><span dir="rtl">الطرف الثاني</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div></div>') % (
        ("[●]",) * 6)

def cover_port(kind_en, kind_ar, t_en, t_ar, s_en, s_ar, ref_label=True):
    def f(i, n):
        return ('<section class="sheet port" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">%s</div><h1 class="pf">%s</h1><div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">%s</div><h1>%s</h1><div class="sb">%s</div></div></div>'
                '<div class="ch"><div><span>Parties / الأطراف</span>Business Partner Solutions<br>%s</div><div><span>Date / التاريخ</span>%s<br>%s</div><div><span>Ref / المرجع</span>BP-FI-05</div></div></div></div>%s</section>') % (
            esc(kind_en), esc(t_en), esc(s_en), esc(kind_ar), esc(t_ar), esc(ar(s_ar)),
            esc(CLIENT_EN) + ' · <span dir="rtl">' + esc(CLIENT_AR) + '</span>', esc(DATE_EN), '<span dir="rtl">' + esc(DATE_AR) + '</span>', footer(i, n))
    return f

def closing_port():
    def f(i, n):
        return ('<section class="sheet port" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">PARTNERING FOR YOUR SUCCESS</div><h1 class="pf" style="font-size:34px">Business Partner Solutions</h1>'
                '<div class="sb" style="direction:rtl;text-align:right;margin-top:6px">بزنس بارتنر سلوشنز</div>'
                '<div class="bx" style="flex-direction:column;gap:22px"><div><b>Company · المنشأة</b>'
                '<div class="kv"><span>Unified No.</span><span class="kvv">%s</span><span dir="rtl">الرقم الموحد</span></div>'
                '<div class="kv"><span>VAT No.</span><span class="kvv">%s</span><span dir="rtl">الرقم الضريبي</span></div>'
                '<div class="kv"><span>National Address</span><span class="kvv">%s · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714</span><span dir="rtl">العنوان الوطني</span></div></div>'
                '<div><b>Contact · التواصل</b><div class="kv"><span>Mobile</span><span class="kvv">%s</span><span dir="rtl">الجوال</span></div>'
                '<div class="kv"><span>Email</span><span class="kvv">%s</span><span dir="rtl">الإيميل</span></div>'
                '<div class="kv"><span>Website</span><span class="kvv">%s</span><span dir="rtl">الموقع</span></div></div></div></div></div>%s</section>') % (
            num("7038825860"), num("312079341500003"), num("RDAA9214"), num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), footer(i, n))
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
    nums = list(range(2, 2 + len(rows)))
    trs = [clause_tr(no, r) for no, r in zip(nums, rows)]
    pa = '<div data-m="parties"><div class="pre"><b>1. الأطراف / Parties</b></div>%s</div>' % parties_html()
    ms = measure("".join(trs), pa + sig_port(), css, os.path.join(tmp, "yamani-measure.html"))
    top = ms["__hdBottom"] + 6   # بعد الرأس مباشرة
    LIM = 979 - 8
    pages, cur, used, first = [], [], 0, True
    avail = LIM - top
    def new_page():
        nonlocal cur, used, first
        pages.append((cur, first)); cur = []; used = 0; first = False
    used = ms["parties"] + 6
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
            if is_first:
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
    cover = ("SERVICE AGREEMENT", "عقد خدمة", C_TITLE_EN, C_TITLE_AR,
             "Registering the investment under the entrepreneurship category and establishing the company.",
             "تسجيل الاستثمار في فئة ريادة الأعمال وتأسيس الشركة.")
    h, _ = paginate_port(rows, C_TITLE_EN, C_TITLE_AR, None, None, cover)
    return h, rows

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
    print("ok", out, "FINAL" if FINAL else "scrubbed")
