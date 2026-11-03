# -*- coding: utf-8 -*-
"""محرّك حزم المبيعات 2026-11-03 — يبني HTML (ثم PDF عبر build.sh) من مواصفة عميل واحدة `spec.py`.
مبني على مولّد حزمة Nyra (cases/2026-11-01-nyra-collective) بعد تعميمه: كل نص خاص بعميل يأتي من المواصفة،
والأسعار من site/assets/data/catalog.json بالـSKU فقط (المبلغ غير المعروف يُكتب [●])، والنصوص القانونية من
docs/sales/templates/categories (تبقى المصدر الوحيد)، ولا مسمى وظيفي في التوقيع.

الاستعمال:  python3 pack.py <spec.py> <outdir>
"""
import base64, html, importlib.util, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
TPL = os.path.join(ROOT, "docs/sales/templates")
LOGO = os.path.join(TPL, "assets/business-partner-logo-clean.png")
sys.path.insert(0, HERE)

RLM = "‏"
PHONE = "00966530540231"          # جوال المنشأة المعتمد للتوقيع (أمر المالك)
IBAN, BANK = "[IBAN]", "[●]"      # يُحقنان من بدر في النسخة النهائية فقط
REP_EN, REP_AR = "Dr. Baher Magnas", "د. باهر مقنص"   # بلا مسمى وظيفي
VAT_RATE = 15

# ------------------------------------------------------------------ المواصفة
spec_path, OUT = os.path.abspath(sys.argv[1]), sys.argv[2]
_sp = importlib.util.spec_from_file_location("clientspec", spec_path)
_m = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_m)
S = _m.S

TMP = tempfile.mkdtemp(prefix="bp-pack-")

def ar(s):
    return re.sub(r"\.(?=\s|$)", "." + RLM, s)

def n(x):
    x = float(x)
    return "{:,}".format(int(x)) if x.is_integer() else "{:,.2f}".format(x)

# ------------------------------------------------------------------ الكتالوج
_CAT = json.load(open(os.path.join(ROOT, "site/assets/data/catalog.json"), encoding="utf-8"))
def cat_price(code):
    hit = []
    def walk(x):
        if isinstance(x, dict):
            if x.get("code") == code and "amount" in x: hit.append(x)
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(_CAT)
    assert hit, "SKU %s not in catalog" % code
    return hit[0]["amount"]

def groups():
    """[(label_en,label_ar,items,fee,vat,total)] — مجموعة واحدة، أو خيارات."""
    raw = S["options"] if "options" in S else [dict(label_en="", label_ar="", items=S["items"])]
    out = []
    for g in raw:
        items = []
        for it in g["items"]:
            amt = cat_price(it["sku"]) if it.get("amount") is None else it["amount"]
            if "expect" in it: assert float(amt) == it["expect"], "الكتالوج تغيّر لـ%s: راجع المالك" % it["sku"]
            items.append(dict(it, amt=amt))
        fee = sum(float(i["amt"]) for i in items if not isinstance(i["amt"], str))
        out.append(dict(label_en=g["label_en"], label_ar=g["label_ar"], items=items, fee=fee, vat=fee * VAT_RATE / 100, total=fee * (100 + VAT_RATE) / 100))
    return out
G = groups()
MULTI = len(G) > 1
FEE, VAT, TOTAL = G[0]["fee"], G[0]["vat"], G[0]["total"]

# ------------------------------------------------------------------ مكوّنات مشتركة
NBRE = re.compile(r"(BP-[A-Z]+-\d+)")
def nb(h): return NBRE.sub(r'<span class="nb">\1</span>', h)
def esc(s): return html.escape(s, quote=False)
BLANK = '<span class="num">________________</span>'
def num(s): return '<span class="num">%s</span>' % esc(str(s))

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
.nb{white-space:nowrap}.pp{margin-top:3px}.pp .pk{font-family:'IBM Plex Mono',monospace;color:#1E3A9E;font-weight:700;margin-inline-end:4px}
.pt2{width:100%;table-layout:fixed;border-collapse:collapse;margin:5px 0;font-size:9.6px}.pt2 th:first-child,.pt2 td:first-child{width:7%;text-align:center}.pt2 th:nth-child(2){width:37%}.pt2 th{background:#0B1B5A;color:#fff;padding:3px 5px}.pt2 td{border:1px solid #DDE1EE;padding:3px 5px}.pt2 td.v{font-family:'IBM Plex Mono',monospace;color:#1E3A9E;text-align:center}.pt2 tr.tt td{font-weight:700;background:#EEF1FB}
.sheet.cover{padding:0!important}.sheet.cover>div{height:100%}.sheet.cover .cv{margin:0!important;height:100%!important;width:100%}
"""

def footer(i, n_):
    return ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
            '<div class="c">%s<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">%d / %d</span></div>'
            '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>') % (esc(PHONE), i, n_)

def doc(title, css, sheets):
    n_ = len(sheets)
    body = nb("".join(s(i + 1, n_) if callable(s) else s for i, s in enumerate(sheets)))
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title>%s<style>%s%s</style></head><body>%s</body></html>') % (esc(title), FONTS, css, EXTRA, body)

def hd2(en, a):
    return ('<div class="hd2"><span class="logo" role="img" aria-label="Business Partner"></span>'
            '<div class="t e"><h1>%s</h1></div><div class="t a"><h1>%s</h1></div></div>') % (esc(en), esc(a))

def meta_row():
    return ('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> %s</div><div class="meta1"><b>Date:</b> %s</div><div class="meta1"><b>Quote validity:</b> %d days</div></div>'
            '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> %s</div><div class="meta1"><b>التاريخ:</b> %s</div><div class="meta1"><b>صلاحية العرض:</b> %d يوماً</div></div></div>') % (
        esc(S["client_en"]), esc(S["date_en"]), S.get("valid_days", 14), esc(S["client_ar"]), esc(S["date_ar"]), S.get("valid_days", 14))

def h2(i, en, a):
    return ('<div class="rw"><div class="col" dir="ltr"><h2><span class="n">%s</span>%s</h2></div>'
            '<div class="col" dir="rtl"><h2><span class="n">%s</span>%s</h2></div></div>') % (i, esc(en), i, esc(a))

def bi_table(head, rows, widths, cls="pt", mid=None):
    cg = "".join('<col style="width:%s%%">' % w for w in widths) + '<col style="width:2%">' + "".join('<col style="width:%s%%">' % w for w in reversed(widths))
    th_en = "".join('<th class="en%s">%s</th>' % (" c" if c else "", h) for (h, _a, c) in head)
    th_ar = "".join('<th class="ar%s">%s</th>' % (" c" if c else "", a) for (_h, a, c) in reversed(head))
    dm = lambda k: (' data-m="%s_%s"' % (mid, k)) if mid else ""
    out = ['<table class="%s"%s><colgroup>%s</colgroup><tr%s>%s<td class="gp"></td>%s</tr>' % (cls, dm("t"), cg, dm("th"), th_en, th_ar)]
    for i, r in enumerate(rows):
        tr_cls = ""
        if isinstance(r, dict):
            tr_cls = ' class="%s"' % r.get("cls", ""); r = r["cells"]
        tds_en = "".join('<td class="en%s">%s</td>' % (" " + c if c else "", e) for (e, _a, c) in r)
        tds_ar = "".join('<td class="ar%s">%s</td>' % (" " + c if c else "", a) for (_e, a, c) in reversed(r))
        out.append("<tr%s%s>%s<td class='gp'></td>%s</tr>" % (tr_cls, dm("r%d" % i), tds_en, tds_ar))
    out.append("</table>")
    return "".join(out)

def numbered(rows, le="Item", la="البند"):
    head = [("#", "#", True), (le, la, False)]
    body = [[(str(i), str(i), "nx"), (e, ar(a), "t")] for i, (e, a) in enumerate(rows, 1)]
    return bi_table(head, body, [4, 46])

REP_CELL = esc(REP_EN) + ' · <span dir="rtl">' + esc(REP_AR) + '</span>'
def sig_boxes(right_co):
    def box(t, co, nm, extra_label, extra_val):
        return ('<div><h3><span>%s</span><span dir="rtl">%s</span></h3>'
                '<div class="f2"><span>Company / Party</span><span class="v cn">%s</span><span dir="rtl">الشركة / الطرف</span></div>'
                '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div>'
                '<div class="f2"><span>%s</span><span class="v">%s</span><span dir="rtl">%s</span></div>'
                '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div>'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>') % (
            t[0], t[1], co, nm, extra_label[0], extra_val, extra_label[1], BLANK)
    return '<div class="sg" style="direction:ltr">%s%s</div>' % (
        box(("Business Partner Solutions", "بزنس بارتنر سلوشنز"), esc("Business Partner Solutions · بزنس بارتنر سلوشنز"), REP_CELL, ("Mobile", "الجوال"), num(PHONE)),
        box(("Client", "العميل"), right_co, BLANK, ("Title", "الصفة"), BLANK))

# ------------------------------------------------------------------ عرض السعر (A4 أفقي)
OTHER_CARDS = [
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

def pay_amounts(g):
    return [(p, g["fee"] * p[2] / 100) for p in S["pay"]]


def flow_land(secs):
    """يقيس كل قسم (العنوان، رأس الجدول، كل صف) في صفحة أفقية فعلية، ثم يرصّها على الصفحات دون تجاوز التذييل؛
    القسم الطويل يُقسَّم بين الصفحات على حدود الصفوف (ويُكرَّر رأس الجدول)."""
    css = css_of("REV-quote-template-bilingual.html")
    body = ""
    for sc in secs:
        body += '<div data-m="%s_pre">%s</div><div data-m="%s_h2">%s</div>%s<div data-m="%s_post">%s</div>' % (
            sc["id"], sc["pre"], sc["id"], sc["h2"], bi_table(sc["head"], sc["rows"], sc["widths"], mid=sc["id"]), sc["id"], sc.get("post", ""))
    meas = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">%s<style>%s%s</style></head><body>'
            '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div></section></body></html>') % (FONTS, css, EXTRA, hd2("x", "x"), nb(body))
    path = os.path.join(TMP, "measure-land.html"); open(path, "w", encoding="utf-8").write(meas)
    ms = json.loads(subprocess.check_output(["node", os.path.join(HERE, "render.cjs"), "measure", path],
                                            env=dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"]).decode().strip())))
    avail = 650 - ms["__bpTop"] - 6
    pages, cur, used = [], [], 0
    def new_page():
        nonlocal cur, used
        pages.append("".join(cur)); cur = []; used = 0
    for sc in secs:
        i, nrows, first = sc["id"], len(sc["rows"]), True
        extra = max(0, ms[i + "_t"] - ms[i + "_th"] - sum(ms["%s_r%d" % (i, k)] for k in range(nrows)))
        lo = 0
        while lo < nrows:
            head_h = ((ms[i + "_pre"] + ms[i + "_h2"]) if first else 0) + ms[i + "_th"] + extra
            hi, h = lo, head_h
            while hi < nrows and used + h + ms["%s_r%d" % (i, hi)] <= avail:
                h += ms["%s_r%d" % (i, hi)]; hi += 1
            if hi == lo:
                if cur: new_page(); continue
                hi = lo + 1; h += ms["%s_r%d" % (i, lo)]
            cur.append((sc["pre"] + sc["h2"] if first else "") + bi_table(sc["head"], sc["rows"][lo:hi], sc["widths"]))
            used += h; first = False; lo = hi
            if lo < nrows: new_page()
        if sc.get("post"):
            if used + ms[i + "_post"] > avail and cur: new_page()
            cur.append(sc["post"]); used += ms[i + "_post"]
    if cur: pages.append("".join(cur))
    return pages

def build_quote():
    css = css_of("REV-quote-template-bilingual.html")
    cv = S["cover"]; sheets = []
    def cover(i, n_):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv lt"><div class="lgband"><span class="logo big" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">%s</h1><div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>%s</h1><div class="sb">%s</div></div></div>'
                '<div class="pk" dir="ltr">%s</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">%s</div>'
                '<div class="ch"><div><span>To / إلى السادة</span><span class="nm">%s · <span dir="rtl">%s</span></span></div><div><span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span></div>'
                '<div><span>Validity / صلاحية العرض</span>%d days<br><span dir="rtl">%d يوماً</span></div></div></div></div></section>') % (
            esc(cv["h1_en"]), esc(cv["sub_en"]), esc(cv["h1_ar"]), esc(ar(cv["sub_ar"])), esc(cv["refs_en"]), esc(cv["refs_ar"]),
            esc(S["client_en"]), esc(S["client_ar"]), esc(S["date_en"]), esc(S["date_ar"]), S.get("valid_days", 14), S.get("valid_days", 14))
    sheets.append(cover)

    def page(inner):
        def f(i, n_):
            return '<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
                hd2(S["quote_title_en"], S["quote_title_ar"]), inner, footer(i, n_))
        return f

    lk = '<a href="https://www.businesspartner.sa" target="_blank" rel="noopener">%s</a>'
    inner = '<div class="rw"><div class="col" dir="ltr"><h2>Other Business Partner services</h2></div><div class="col" dir="rtl"><h2>خدمات Business Partner الأخرى</h2></div></div>'
    for i, (te, ta, de, da) in enumerate(OTHER_CARDS, 1):
        inner += ('<div class="rw cd"><div class="col" dir="ltr"><div class="card"><b>%d. %s</b><br>%s<br><i>Price per case or per catalogue</i> · %s</div></div>'
                  '<div class="col" dir="rtl"><div class="card"><b>%d. %s</b><br>%s<br><i>السعر حسب الحالة أو بحسب الكتالوج</i> · %s</div></div></div>') % (
            i, lk % esc(te), esc(de), lk % "Learn more", i, lk % esc(ta), esc(ar(da)), lk % "اعرف المزيد")
    sheets.append(page(inner))

    # ---- أقسام العرض: تُقاس وتُرصّ على الصفحات آلياً (لا تتجاوز التذييل)
    price_rows = []
    for g in G:
        if MULTI:
            price_rows.append({"cls": "tot", "cells": [("<b>%s</b>" % esc(g["label_en"]), "<b>%s</b>" % esc(g["label_ar"]), ""), ("", "", "c")]})
        for it in g["items"]:
            a_ = it["amt"]; shown = a_ if isinstance(a_, str) else n(a_)
            price_rows.append([("<b>%s</b> · %s" % (it["sku"], it["en"]), "<b>%s</b> · %s" % (it["sku"], it["ar"]), ""), (num(shown), num(shown), "c")])
        tl = S.get("total_label", ("Total service fees before VAT", "إجمالي الأتعاب قبل الضريبة"))
        price_rows.append({"cls": "tot", "cells": [(tl[0], tl[1], ""), (num(n(g["fee"])), num(n(g["fee"])), "c")]})
        price_rows.append([("VAT 15% (added according to the regulations)", "ضريبة القيمة المضافة 15% (تُضاف وفق النظام)", ""), (num(n(g["vat"])), num(n(g["vat"])), "c")])
        price_rows.append({"cls": "tot", "cells": [("Total including VAT", "الإجمالي شامل الضريبة", ""), (num(n(g["total"])), num(n(g["total"])), "c")]})
    price_rows.append([("<b>Government fees</b> — paid by the Client directly to the entities (see below)", "<b>الرسوم الحكومية</b> — يسدّدها العميل مباشرة للجهات (انظر أدناه)", ""), ("<b>Not included</b>", "<b>غير شامل</b>", "c")])
    gov_rows = [[(fe, fa, ""), (ee, ea, ""), (he, ar(ha), "")] for fe, fa, ee, ea, he, ha in S["gov_fees"]]
    note = ('<div class="nt"><div dir="ltr"><b>Not included, always:</b> %s</div><div class="ar" dir="rtl"><b>خارج السعر دائماً:</b> %s</div></div>') % (esc(S["always_en"]), esc(ar(S["always_ar"])))
    nrow = lambda lst: [[(str(i), str(i), "nx"), (e, ar(a_), "t")] for i, (e, a_) in enumerate(lst, 1)]
    scope_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")] for i, (te, ta, de, da) in enumerate(S["scope"], 1)]
    dur_rows = [[(str(i), str(i), "nx"), ("<b>%s</b> — %s" % (esc(te), esc(de)), "<b>%s</b> — %s" % (esc(ta), esc(ar(da))), "t")] for i, (te, ta, de, da) in enumerate(S["duration"], 1)]
    pay_rows = []
    for g in G:
        sfx_en = (" — " + g["label_en"].split(" — ")[0]) if MULTI else ""; sfx_ar = (" — " + g["label_ar"].split(" — ")[0]) if MULTI else ""
        for k, (p, amt) in enumerate(pay_amounts(g), 1):
            v = amt * VAT_RATE / 100
            pay_rows.append([(str(k), str(k), "nx"), (p[0] + sfx_en, p[1] + sfx_ar, ""), ("%s%%" % p[2], "%s%%" % p[2], "c"), (num(n(amt)), num(n(amt)), "c"), (num(n(v)), num(n(v)), "c"), (num(n(amt + v)), num(n(amt + v)), "c"), (p[3], p[4], "")])
        pay_rows.append({"cls": "tot", "cells": [("", "", ""), ("Total" + sfx_en, "الإجمالي" + sfx_ar, ""), ("100%", "100%", "c"),
                                                    (num(n(g["fee"])), num(n(g["fee"])), "c"), (num(n(g["vat"])), num(n(g["vat"])), "c"), (num(n(g["total"])), num(n(g["total"])), "c"), ("", "", "")]})
    H1 = [("#", "#", True), ("Item", "البند", False)]
    secs = [
        dict(id="price", pre=meta_row(), h2=h2(1, "Price", "السعر"), head=[("Item", "البند", False), ("SAR", "ريال", True)], rows=price_rows, widths=[40, 8]),
        dict(id="gov", pre="", h2=h2("", "Government fees — not included in the price", "الرسوم الحكومية — غير شاملة في السعر"),
             head=[("Fee", "الرسم", False), ("Entity", "الجهة", False), ("Amount and payment", "المبلغ وطريقة السداد", False)], rows=gov_rows, widths=[18, 12, 18], post=note),
        dict(id="scope", pre="", h2=h2(2, "Scope — included in the fee", "النطاق — شامل ضمن الأتعاب"), head=[("#", "#", True), ("Services included in the fee", "الخدمات الشاملة ضمن الأتعاب", False)], rows=scope_rows, widths=[4, 46]),
        dict(id="deliv", pre="", h2=h2("", "Deliverables", "المخرجات"), head=[("#", "#", True), ("Deliverable", "المخرج", False)], rows=nrow([(esc(e), esc(a_)) for e, a_ in S["deliverables"]]), widths=[4, 46]),
        dict(id="req", pre="", h2=h2(3, "Requirements from the Client", "المتطلبات من العميل"), head=[("#", "#", True), ("Requirement", "المتطلب", False)], rows=nrow([(esc(e), esc(a_)) for e, a_ in S["requirements"]]), widths=[4, 46]),
        dict(id="excl", pre="", h2=h2(4, "Not included in the quotation", "ما لا يشمله العرض / على العميل"), head=[("#", "#", True), ("Not included", "غير مشمول", False)], rows=nrow([(esc(e), esc(a_)) for e, a_ in S["exclusions"]]), widths=[4, 46]),
        dict(id="dur", pre="", h2=h2(5, "Duration", "المدة"), head=[("#", "#", True), ("Stage", "المرحلة", False)], rows=dur_rows, widths=[4, 46]),
        dict(id="pay", pre="", h2=h2(6, "Payment terms", "طريقة الدفع"),
             head=[("#", "#", True), ("Instalment", "الدفعة", False), ("%", "النسبة", True), ("SAR excl. VAT", "ريال قبل الضريبة", True), ("VAT 15%", "الضريبة 15%", True), ("SAR incl. VAT", "ريال شامل الضريبة", True), ("Due", "الاستحقاق", False)],
             rows=pay_rows, widths=([3, 13, 5, 7, 6, 7, 9] if MULTI else [3, 9, 5, 7, 6, 7, 13])),
        dict(id="terms", pre="", h2=h2(7, "Terms and conditions", "الشروط والأحكام"), head=[("#", "#", True), ("Term", "الشرط", False)], rows=nrow([(esc(e), esc(a_)) for e, a_ in S["terms"]]), widths=[4, 46]),
    ]
    for pg in flow_land(secs):
        sheets.append(page(pg))

    sg = ('<div class="rw"><div class="col" dir="ltr"><p>By signing below, both parties accept this quotation and its terms and conditions.</p></div>'
          '<div class="col" dir="rtl"><p>%s</p></div></div>') % esc(ar("بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه."))
    client_co = '%s · <span dir="rtl">%s</span>' % (esc(S["client_en"]), esc(S["client_ar"]))
    sheets.append(page(h2(8, "Signatures", "التوقيعان") + sg + sig_boxes(client_co)))

    def closing(i, n_):
        return ('<section class="sheet land cover" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
                '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
                '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 / طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714<br>'
                'Mobile / الجوال: %s<br>Email / الإيميل: %s<br>Website / الموقع: %s</div>'
                '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: Business Partner Solutions / بزنس بارتنر سلوشنز<br>Bank / البنك: %s<br>IBAN: %s</div></div></div></div></section>') % (
            num(PHONE), num("business@businesspartner.sa"), num("www.businesspartner.sa"), esc(BANK), num(IBAN))
    sheets.append(closing)
    return doc(S["quote_title_ar"], css, sheets)

# ------------------------------------------------------------------ العقد وNDA والتفويض والمساندة (A4 عمودي)
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
          '<tr><td>Mobile</td><td class="v">%s</td><td>الجوال</td></tr></table>') % (num("7038825860"), num("312079341500003"), num("RDAA9214"), esc(REP_EN), esc(REP_AR), num(PHONE))
    cl = ('<table class="pty2"><tr><th colspan="3"><span>Second Party (Client)</span><span dir="rtl">الطرف الثاني (العميل)</span></th></tr>'
          '<tr><td>Name</td><td class="v">%s<br><span dir="rtl">%s</span><br>%s</td><td>الاسم</td></tr>'
          '<tr><td>ID / Iqama / Passport / CR No.</td><td class="v">%s</td><td>رقم الهوية / الإقامة / الجواز / السجل</td></tr>'
          '<tr><td>Nationality</td><td class="v">%s</td><td>الجنسية</td></tr>'
          '<tr><td>National / residence address</td><td class="v">%s</td><td>العنوان الوطني / السكن</td></tr>'
          '<tr><td>Capacity</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>الصفة</td></tr></table>') % (
        esc(S["client_en"]), esc(S["client_ar"]), "full name as in ID: " + BLANK, BLANK, BLANK, BLANK, esc(S["capacity_en"]), esc(S["capacity_ar"]))
    return me + cl

NUMBERED, PARTIES, START = True, True, 2

def norm_en(t):
    t = re.sub(r"\bthe Client\b", "the Second Party", t)
    t = re.sub(r"\bThe Client\b", "The Second Party", t)
    t = t.replace("Client’s", "Second Party’s").replace("Client's", "Second Party's")
    t = re.sub(r"\bClient\b", "Second Party", t)
    return t.replace("Second Party Inactivity", "Second Party Non-Responsiveness")

def norm_ar(t):
    t = t.replace("مخوَّل بتزويدنا ببيانات", "مخوَّل بتزويد الطرف الأول ببيانات").replace("تعطّل العميل", "عدم تجاوب الطرف الثاني")
    return t.replace("العميل", "الطرف الثاني")

ABBR = ("No.", "no.", "e.g.", "i.e.", "etc.", "Ltd.", "Art.")
def split_pts(t, lang):
    if lang == "en":
        parts = re.split(r"(?<=[.;])\s+(?=[A-Z(\[“\"])", t); out = []
        for p in parts:
            if out and out[-1].endswith(ABBR): out[-1] += " " + p
            else: out.append(p)
        return out
    return re.split(r"(?<=\.)\s+(?=\S)", t)

def paytable():
    g = G[0]; ps = pay_amounts(g)
    en = '<table class="pt2"><tr><th>#</th><th>Instalment</th><th>SAR excl. VAT</th><th>VAT 15%</th><th>SAR incl. VAT</th></tr>'
    ar_ = '<table class="pt2"><tr><th>#</th><th>الدفعة</th><th>ريال قبل الضريبة</th><th>الضريبة 15%</th><th>ريال شامل الضريبة</th></tr>'
    for k, (p, amt) in enumerate(ps, 1):
        v = amt * VAT_RATE / 100
        cells = "<td>%d</td><td>%s</td><td class='v'>%s</td><td class='v'>%s</td><td class='v'>%s</td></tr>"
        en += "<tr>" + cells % (k, "%s — %s" % (p[0], p[3]), n(amt), n(v), n(amt + v))
        ar_ += "<tr>" + cells % (k, "%s — %s" % (p[1], p[4]), n(amt), n(v), n(amt + v))
    tot = "<tr class='tt'><td></td><td>%s</td><td class='v'>%s</td><td class='v'>%s</td><td class='v'>%s</td></tr></table>"
    return en + tot % ("Total", n(g["fee"]), n(g["vat"]), n(g["total"])), ar_ + tot % ("الإجمالي", n(g["fee"]), n(g["vat"]), n(g["total"]))

def points(no, body, lang):
    pts = split_pts(body, lang)
    if lang == "ar": pts = [ar(p) for p in pts]
    if len(pts) == 1: return "<div class='pp'>%s</div>" % pts[0]
    return "".join("<div class='pp'><span class='pk'>%d.%d</span> %s</div>" % (no, i, p) for i, p in enumerate(pts, 1))

def clause_tr(no, r):
    t_en, t_ar, b_en, b_ar = r
    pre = "%d. " % no if NUMBERED else ""
    b_en, b_ar, t_en, t_ar = norm_en(b_en), norm_ar(b_ar), norm_en(t_en), norm_ar(t_ar)
    if t_en.startswith("Second Party Obligations"): t_ar = "التزامات الطرف الثاني (العميل) وإقراراته"
    x_en = x_ar = ""
    if "{{PAYTABLE}}" in b_en:
        x_en, x_ar = paytable()
        b_en, b_ar = b_en.replace("{{PAYTABLE}}", "").rstrip(), b_ar.replace("{{PAYTABLE}}", "").rstrip()
    def fmt(b, lang):
        b = b if ("&amp;" in b or b.startswith("<")) else b.replace("&", "&amp;")
        return points(no, b, lang) if NUMBERED and PARTIES else (ar(b) if lang == "ar" else b)
    return '<tr data-m="r%d"><td class="en"><b>%s%s</b>%s%s</td><td class="ar"><b>%s%s</b>%s%s</td></tr>' % (
        no, pre, esc(t_en), fmt(b_en, "en"), x_en, pre, esc(t_ar), fmt(b_ar, "ar"), x_ar)

def sig_port():
    ph = "________________"
    return ('<div class="sg" data-m="sig" style="direction:ltr"><div><h3><span>First Party</span><span dir="rtl">الطرف الأول</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s · %s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Mobile</span><span class="v">%s</span><span dir="rtl">الجوال</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>'
            '<div><h3><span>Second Party</span><span dir="rtl">الطرف الثاني</span></h3>'
            '<div class="f2"><span>Name</span><span class="v">%s</span><span dir="rtl">الاسم</span></div><div class="f2"><span>Title</span><span class="v">%s</span><span dir="rtl">الصفة</span></div>'
            '<div class="f2"><span>Date</span><span class="v">%s</span><span dir="rtl">التاريخ</span></div><div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div></div>') % (
        esc(REP_EN), esc(REP_AR), PHONE, ph, ph, ph, ph)

def refs_label():
    return S["cover"]["refs_en"].split(" · ")[0]

def cover_port(kind_en, kind_ar, t_en, t_ar, s_en, s_ar):
    def f(i, n_):
        return ('<section class="sheet port cover" lang="ar"><div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>'
                '<div class="cvb"><div dir="ltr"><div class="eb">%s</div><h1 class="pf">%s</h1><div class="sb">%s</div></div>'
                '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">%s</div><h1>%s</h1><div class="sb">%s</div></div></div>'
                '<div class="ch"><div><span>Parties / الأطراف</span>Business Partner Solutions<br>%s</div><div><span>Date / التاريخ</span>%s<br>%s</div><div><span>Ref / المرجع</span>%s</div></div></div></div></section>') % (
            esc(kind_en), esc(t_en), esc(s_en), esc(kind_ar), esc(t_ar), esc(ar(s_ar)),
            esc(S["client_en"]) + ' · <span dir="rtl">' + esc(S["client_ar"]) + '</span>', esc(S["date_en"]), '<span dir="rtl">' + esc(S["date_ar"]) + '</span>', esc(S["refs_short"]))
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
        FONTS, css, EXTRA, hd_port("x", "x"), nb(rows_html), nb(extra_blocks))
    open(path, "w", encoding="utf-8").write(meas)
    out = subprocess.check_output(["node", os.path.join(HERE, "render.cjs"), "measure", path],
                                  env=dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"]).decode().strip()))
    return json.loads(out)

def paginate_port(rows, title_en, title_ar, cover_args, with_sig=True):
    css = css_of("REV-contract-bilingual.html")
    nums = list(range(START, START + len(rows)))
    trs = [clause_tr(no, r) for no, r in zip(nums, rows)]
    pa = '<div data-m="parties"><div class="pre"><b>1. الأطراف / Parties</b></div>%s</div>' % parties_html()
    ms = measure("".join(trs), pa + sig_port(), css, os.path.join(TMP, "measure.html"))
    top = ms["__hdBottom"] + 6; LIM = 979 - 8; avail = LIM - top
    pages, cur, used, first = [], [], 0, True
    def new_page():
        nonlocal cur, used, first
        pages.append((cur, first)); cur = []; used = 0; first = False
    used = (ms["parties"] + 6) if PARTIES else 0
    for k, tr in enumerate(trs):
        h = ms["r%d" % nums[k]]
        if used + h > avail and cur: new_page()
        cur.append(tr); used += h
    sig_h = ms["sig"] + 8
    if with_sig and used + sig_h > avail:
        last_tr = cur.pop(); new_page(); cur.append(last_tr)
    pages.append((cur, first))
    sheets = [cover_port(*cover_args)]; last = len(pages) - 1
    for pi, (rs, is_first) in enumerate(pages):
        def f(i, n_, rs=rs, is_first=is_first, pi=pi):
            body = ""
            if is_first and PARTIES: body += '<div class="pre"><b>1. الأطراف / Parties</b></div>' + parties_html()
            body += '<table class="cl">%s</table>' % "".join(re.sub(r' data-m="r\d+"', "", x) for x in rs) if rs else ""
            if with_sig and pi == last: body += re.sub(r' data-m="sig"', "", sig_port())
            return '<section class="sheet port" lang="ar"><div dir="rtl">%s%s</div>%s</section>' % (hd_port(title_en, title_ar), body, footer(i, n_))
        sheets.append(f)
    sheets.append(closing_port())
    return doc(title_ar, css, sheets)

# ------------------------------------------------------------------ نصوص قانونية من القوالب (المصدر الوحيد)
LEGAL_MD = os.path.join(TPL, "categories/contract-core-and-category-clauses-FOR-LEGAL-REVIEW.md")
AUTH_MD = os.path.join(TPL, "categories/authorization-letter-template-DRAFT.md")

def parse_legal():
    sec = cur = None; out = {}
    for line in open(LEGAL_MD, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## "): sec = line[3:].strip(); out.setdefault(sec, {}); cur = None
        elif line.startswith("### "): cur = line[4:].strip(); out[sec][cur] = {}
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

def fee_sentences():
    g = G[0]
    parts_en = ", ".join("SAR %s for %s" % (n(i["amt"]), i["sku"]) for i in g["items"] if not isinstance(i["amt"], str))
    parts_ar = "، ".join("%s ريال للخدمة %s" % (n(i["amt"]), i["sku"]) for i in g["items"] if not isinstance(i["amt"], str))
    ins_en = " and ".join("%s%% %s" % (p[2], p[3][0].lower() + p[3][1:]) for p in S["pay"])
    ins_ar = " و".join("%s%% %s" % (p[2], p[4]) for p in S["pay"])
    k = len(S["pay"]); amts = [a for _, a in pay_amounts(G[0])]
    if k == 1:
        each_en, each_ar = "a single instalment — ", "دفعة واحدة — "
    else:
        each_en = "%d instalments of %s before VAT — " % (k, " and ".join("SAR " + n(a) for a in amts))
        each_ar = "%d دفعات قدرها %s قبل الضريبة — " % (k, " و".join(n(a) + " ريال" for a in amts)) if k > 2 else "دفعتان قدرهما %s قبل الضريبة — " % " و".join(n(a) + " ريال" for a in amts)
    en = ("The First Party’s service fee is SAR %s (%s) before 15%% VAT, which is added. Payment terms: %s%s, as in the table below. Government fees are not included in the service fee. {{PAYTABLE}}" % (n(FEE), parts_en, each_en, ins_en))
    a = ("أتعاب الطرف الأول عن الخدمة %s ريال سعودي (%s) قبل ضريبة القيمة المضافة 15%% التي تُضاف عليها. شروط السداد: %s%s، كما في الجدول أدناه. والرسوم الحكومية غير شاملة في الأتعاب. {{PAYTABLE}}" % (n(FEE), parts_ar, each_ar, ins_ar))
    return en, a

def contract_clauses():
    assert not MULTI, "العقد لا يُبنى على عرض بخيارين"
    C = S["contract"]
    core = _find("نواة العقد"); rows = []
    def add(t_en, t_ar, b_en, b_ar): rows.append([t_en, t_ar, b_en, b_ar])
    add("Subject", "موضوع العقد", C["subject_en"], C["subject_ar"])
    t_en, t_ar, b_en, b_ar = _clause(core, "3.")
    f_en, f_ar = fee_sentences()
    old_en = "The fees are those stated in the accepted quotation, before 15% VAT, which is added. Payment terms: [●]."
    old_ar = "الرسوم هي المذكورة في عرض السعر المقبول، قبل ضريبة القيمة المضافة 15% التي تُضاف عليها. شروط السداد: [●]."
    assert old_en in b_en and old_ar in b_ar, "نص البند 3 في القالب القانوني تغيّر"
    b_en, b_ar = b_en.replace(old_en, f_en).replace("IBAN [●]", "IBAN [IBAN]"), b_ar.replace(old_ar, f_ar).replace("آيبان [●]", "آيبان [IBAN]")
    add(t_en, t_ar, b_en, b_ar)
    t_en, t_ar, b_en, b_ar = _clause(core, "4.")
    b_en = b_en.replace("The contract term is: [●].", "The contract term runs from signature until the final deliverables stated in the quotation are delivered.")
    b_ar = b_ar.replace("مدة العقد: [●].", "مدة العقد من التوقيع حتى تسليم المخرجات النهائية المذكورة في عرض السعر.")
    add(t_en, t_ar, b_en, b_ar)
    for p in ("5.", "6."): add(*_clause(core, p))
    t_en, t_ar, b_en, b_ar = _clause(core, "7.")
    add(t_en, t_ar, b_en + " " + C["poa_en"], b_ar + " " + C["poa_ar"])
    add(*_clause(core, "8."))
    for cat, key in C["cats"]:
        add(*_clause(_find(cat), key))
    for p in ("9.", "10.", "11.", "12.", "13.", "14.", "15.", "16.", "17.", "18."): add(*_clause(core, p))
    return rows

def nda_rows():
    nda = _find("اتفاقية عدم الإفصاح المتبادلة العامة"); rows = []
    for k in nda:
        en_t, ar_t = [re.sub(r"^\d+\.\s*", "", x.strip()) for x in k.split(" / ", 1)]
        rows.append([en_t, ar_t, nda[k]["en"], nda[k]["ar"]])
    return rows

def build_contract():
    C = S["contract"]
    cover = ("SERVICE AGREEMENT", "عقد خدمة", C["title_en"], C["title_ar"], C["cover_en"], C["cover_ar"])
    return paginate_port(contract_clauses(), C["title_en"], C["title_ar"], cover)

def build_nda():
    cover = ("CONFIDENTIALITY", "سرية", "Mutual Non-Disclosure Agreement", "اتفاقية عدم إفصاح متبادلة",
             "A mutual agreement protecting the confidential information exchanged between the parties.",
             "اتفاقية متبادلة لحماية المعلومات السرية المتبادلة بين الطرفين.")
    return paginate_port(nda_rows(), "Mutual Non-Disclosure Agreement", "اتفاقية عدم إفصاح متبادلة", cover, with_sig=True)

# --- خطاب التفويض: نص القانونية + قائمة تفويض بخانات اختيار (§3.3). غير المحدَّد غير مفوَّض.
BOX = "☐"
T_EN, T_AR = "Authorization Letter", "خطاب تفويض"
def legal_auth():
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

def _aget(d, k):
    for key, v in d.items():
        if key.startswith("%d. " % k) and "en" in v:
            a, b = [x.strip() for x in key.split(" / ", 1)]
            return re.sub(r"^\d+\.\s*", "", a), re.sub(r"^\d+\.\s*", "", b), v["en"], v["ar"]
    raise KeyError(k)

# تفويضات مشتركة لكل الحزم
DELEG_FEES = ("Paying official fees on the Client’s behalf", "دفع الرسوم الرسمية نيابةً عن العميل", "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
              "Only from funds the Client has deposited for that purpose, against the entity’s receipt; the unused balance is returned.",
              "من مبالغ أودعها العميل لهذا الغرض فقط وبإيصال الجهة، ويُرد الرصيد غير المستعمل.")
DELEG_NOTIF = ("Receiving notifications and official correspondence", "استلام الإشعارات والمراسلات الرسمية", "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
               "Receiving notifications and official documents relating to the authorised transactions only, and notifying the Client within [2] business days.",
               "استلام الإشعارات والمستندات الرسمية المتعلقة بالمعاملات المفوَّض بها وحدها، وإبلاغ العميل خلال [2] يوم عمل.")
DELEG_VIEW = ("Viewing the Client’s accounts on the platforms", "الاطلاع على حسابات العميل في المنصات", "The platforms of the entities named above", "منصات الجهات المسماة أعلاه",
              "View-only access through the platforms’ official delegation features, never through passwords or verification codes, limited to the authorised transactions.",
              "اطلاع فقط عبر خصائص التفويض الرسمية في المنصات، لا بكلمات المرور ولا رموز التحقق، ومحصور في المعاملات المفوَّض بها.")
DELEG_DATA = ("Transferring the Client’s data", "نقل بيانات العميل", "The entities, and the First Party’s service providers (hosting and artificial intelligence)", "الجهات، ومزودو خدمات الطرف الأول (الاستضافة والذكاء الاصطناعي)",
              "Transferring the Client’s documents and data only as needed to perform the authorised services, under the data protection clause. Transfer outside the Kingdom: %s Authorised  %s Not authorised." % (BOX, BOX),
              "نقل مستندات العميل وبياناته بقدر ما يلزم لتنفيذ الخدمات المفوَّض بها فقط، وفق بند حماية البيانات. النقل خارج المملكة: %s مفوَّض  %s غير مفوَّض." % (BOX, BOX))

def authz_rows():
    A = S["authz"]; d = legal_auth(); R = []
    def add(t_en, t_ar, b_en, b_ar): R.append([t_en, t_ar, b_en, b_ar])
    add("2. Services covered", "2. الخدمات المشمولة", A["covered_en"], A["covered_ar"])
    add("3. Delegation list — the Second Party ticks what it authorises", "3. قائمة التفويض — يحدّد الطرف الثاني ما يفوّض به",
        "Tick %s each delegation the Second Party authorises. For each item: the entity, the scope, the term stated in section 9, and the right to stop it immediately by written notice." % BOX,
        "يضع الطرف الثاني علامة %s أمام كل تفويض يمنحه. ولكل بند: الجهة والنطاق والمدة المذكورة في البند 9 وحقه في إيقافه فوراً بإشعار كتابي." % BOX)
    for i, (te, ta, ee, ea, se, sa) in enumerate(A["deleg"] + [DELEG_FEES, DELEG_NOTIF, DELEG_VIEW, DELEG_DATA], 1):
        add("3.%d  %s  %s Authorised" % (i, te, BOX), "3.%d  %s  %s مفوَّض" % (i, ta, BOX),
            "<b>Entity:</b> %s<br><b>Scope:</b> %s<br><b>Stop:</b> immediately by written notice." % (ee, se),
            "<b>الجهة:</b> %s<br><b>النطاق:</b> %s<br><b>الإيقاف:</b> فوراً بإشعار كتابي." % (ea, sa))
    for k, label in ((3, "4"), (4, "5"), (5, "6"), (6, "7"), (7, "8"), (8, "9"), (9, "10"), (10, "11"), (11, "12"), (12, "13")):
        t_en, t_ar, b_en, b_ar = _aget(d, k)
        if k == 3:
            b_en = b_en.replace("Within the covered services only, the Authorised Party may:", "Within the services the Second Party has ticked in section 3 only, the First Party may:")
            b_ar = b_ar.replace("ضمن الخدمات المشمولة وحدها، للمفوَّض:", "ضمن البنود التي حدّدها الطرف الثاني في البند 3 وحدها، للطرف الأول:")
        if k == 8:
            b_en = b_en.replace(" [recommended maximum 12]", "")
            b_ar = re.sub(r"\s*\[الحد الأقصى المقترح 12\]", "", b_ar)
        if k == 7:
            b_en = "The First Party acts only through its named staff: %s; any other staff member only with the Second Party’s prior written approval (identification details are kept in the executed copy)." % REP_EN
            b_ar = "يعمل الطرف الأول عبر موظفيه المسمّين وحدهم: %s؛ ولا يعمل أي موظف آخر إلا بموافقة كتابية مسبقة من الطرف الثاني (وبيانات الهوية في النسخة الموقّعة)." % REP_AR
        b_en = b_en.replace("the Category Annex", "section 3").replace("The Authorised Party", "The First Party").replace("the Authorised Party", "the First Party").replace("The Principal", "The Second Party").replace("the Principal", "the Second Party").replace("Principal’s", "Second Party’s")
        b_ar = b_ar.replace("ملحق الفئة", "البند 3").replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        t_en = t_en.replace("Principal’s", "Second Party’s").replace("Authorised Party’s", "First Party’s")
        t_ar = t_ar.replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        add("%s. %s" % (label, t_en), "%s. %s" % (label, t_ar), b_en, b_ar)
    return R

def build_authz():
    global NUMBERED
    NUMBERED = False
    cover = ("AUTHORIZATION", "تفويض", T_EN, T_AR, "The Second Party chooses, from a list, what it authorises the First Party to do.", "يختار الطرف الثاني من قائمة ما يفوّض به الطرف الأول.")
    h = paginate_port(authz_rows(), T_EN, T_AR, cover)
    NUMBERED = True
    return h

def build_info(rows, t_en, t_ar, kind_en, kind_ar, s_en, s_ar, numbered=True):
    global NUMBERED, PARTIES, START
    NUMBERED, PARTIES, START = numbered, False, 1
    h = paginate_port(rows, t_en, t_ar, (kind_en, kind_ar, t_en, t_ar, s_en, s_ar), with_sig=False)
    NUMBERED, PARTIES, START = True, True, 2
    return h

# ------------------------------------------------------------------ المستندات المساندة من المواصفة
def guide_rows():
    I = S["info"]; rows = list(I["guide_head"])
    for i, (te, ta, de, da) in enumerate(S["scope"], 1):
        rows.append(("Step %d — %s" % (i, te), "الخطوة %d — %s" % (i, ta), de, da))
    g = G[0]
    cost_en = "; ".join("SAR %s %s" % (n(i["amt"]), i["short_en"]) for i in g["items"] if not isinstance(i["amt"], str))
    cost_ar = "؛ ".join("%s ريال %s" % (n(i["amt"]), i["short_ar"]) for i in g["items"] if not isinstance(i["amt"], str))
    pay_en = ", ".join("%s%% %s" % (p[2], p[3][0].lower() + p[3][1:]) for p in S["pay"])
    pay_ar = "، ".join("%s%% %s" % (p[2], p[4]) for p in S["pay"])
    rows += [
        ("How long it takes", "كم تستغرق", " ".join(x[2] for x in S["duration"]), " ".join(x[3] for x in S["duration"])),
        ("What it costs", "كم تكلف",
         "Our service fees are SAR %s before 15%% VAT (%s), paid as follows: %s. Government fees are not included and are paid by you directly to the entities." % (n(FEE), cost_en, pay_en),
         "أتعابنا %s ريال قبل ضريبة القيمة المضافة 15%% (%s)، وتُسدَّد كما يلي: %s. والرسوم الحكومية غير شاملة، وتسدّدها أنت مباشرة للجهات." % (n(FEE), cost_ar, pay_ar)),
        ("What you receive", "ما الذي تتسلمه", " ".join(e for e, _ in S["deliverables"]), " ".join(a for _, a in S["deliverables"])),
        ("What is not included", "ما لا تشمله الخدمة", I["not_en"], I["not_ar"]),
        ("What we need from you", "ما نحتاجه منك",
         "Complete the client data form and send the documents in the checklist. Complete and timely documents are what keep the timeline short.",
         "عبّئ نموذج بيانات العميل وأرسل المستندات الواردة في القائمة. والمستندات الكاملة في وقتها هي ما يُبقي المدة قصيرة."),
    ]
    return rows

def info_docs():
    I = S["info"]; out = {}
    if "checklist" in I:
        out["Documents-Checklist"] = (I["checklist"], "Required Documents Checklist", "قائمة المستندات المطلوبة", "CHECKLIST", "قائمة", I["checklist_sub_en"], I["checklist_sub_ar"], True)
    if "form" in I:
        out["Client-Data-Form"] = (I["form"], "Client Data Form", "نموذج بيانات العميل", "FORM", "نموذج", "Please complete this form and return it with the documents in the checklist.", "نرجو تعبئة هذا النموذج وإعادته مع المستندات الواردة في القائمة.", False)
    if I.get("guide_head"):
        out["Service-Guide"] = (guide_rows(), "Service Guide: " + I["guide_title_en"], "دليل الخدمة: " + I["guide_title_ar"], "SERVICE GUIDE", "دليل الخدمة",
                                "What the service includes, how it works, what it costs and what we need from you.", "ما تشمله الخدمة وكيف تسير وكم تكلف وما نحتاجه منك.", False)
    return out

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    docs = S["docs"]; files = []
    def w(name, h):
        open(os.path.join(OUT, name + ".html"), "w", encoding="utf-8").write(h); files.append(name)
    w("01-Quotation", build_quote())
    if "contract" in docs: w("02-Agreement", build_contract())
    if "nda" in docs: w("03-NDA", build_nda())
    w("04-Authorization-Letter", build_authz())
    k = 5
    for name, spec in info_docs().items():
        w("%02d-%s" % (k, name), build_info(*spec)); k += 1
    print("ok", OUT, files)
