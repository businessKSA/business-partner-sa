# -*- coding: utf-8 -*-
"""يبني حزمة عميل خدمة «تطوير الأعمال كخدمة» (REV) كاملة بباقة REV-LAUNCH:
  01 عرض مبسط · 02 عرض مفصل (أفقي) · 03 عقد · 04 عدم إفصاح · 05 تفويض · 06 المستندات المطلوبة (طولي).
الاستعمال:  NODE_PATH=$(npm root -g) python3 rev_package.py <config.json> <outdir>
  config: {"slug","client_en","client_ar","date_en","date_ar"} — client_* اختياريان؛ بلا اسم تبقى خانته حقل تعبئة.
  الإخراج: <outdir>/pdf (للعميل: PDF بحقول تعبئة) و<outdir>/open (HTML + DOCX داخلي).
  BP_PHONE وBP_IBAN وBP_BANK تُحقن في الغلاف الختامي والعقد؛ وإلا يبقى [IBAN] و[BANK]. لا تُشغَّل في المستودع بقيم حقيقية: الإخراج خارجه.
الخانة الفارغة [●] تصير حقل تعبئة، و☐ تصير خانة اختيار. لا نقاط ظاهرة للعميل."""
import importlib.util, json, os, re, subprocess, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rev_build, rev_quote

PHONE = os.environ.get("BP_PHONE", "0530540231")
IBAN = os.environ.get("BP_IBAN", "[IBAN]")
BANK = os.environ.get("BP_BANK", "[BANK]")
REP_OLD = "Dr. Baher Magnas · د. باهر مقنص"
REP_NEW = "Baher Bakr Ali Magnas · باهر بكر علي مقنص"
NAMES = {
    "quote-simple": "01 عرض السعر المبسط · Quotation Simple",
    "quote-detailed": "02 عرض السعر المفصل · Quotation Detailed",
    "contract": "03 العقد · Agreement",
    "nda": "04 اتفاقية عدم الإفصاح · NDA",
    "authz": "05 خطاب التفويض · Authorization Letter",
    "docs": "06 المستندات المطلوبة · Required Documents",
}
CBX_CSS = (".fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}"
           ".fld.cbx{min-width:0;width:12px;height:12px;border:1px solid #0B1B5A;vertical-align:-2px}"
           ".fld.wide{display:block;width:96%;height:22px;min-width:0;margin:0 auto}")


def sh(*a, **k):
    r = subprocess.run(a, capture_output=True, text=True, **k)
    if r.returncode: raise SystemExit(r.stderr or r.stdout)
    return r.stdout


def portrait_post(s, kind, cfg):
    d_en, d_ar = cfg["date_en"], cfg["date_ar"]
    s = s.replace(REP_OLD, REP_NEW)
    s = s.replace('<span>Date / التاريخ</span><span class="num">[●]</span>', '<span>Date / التاريخ</span><span class="num">%s<br><span dir="rtl">%s</span></span>' % (d_en, d_ar))
    s = s.replace('<span>Ref / المرجع</span><span class="num">[●]</span>', '<span>Ref / المرجع</span><span class="num">REV-LAUNCH</span>')
    s = s.replace('<span>Date</span><span class="v">[●]</span>', '<span>Date</span><span class="v">%s · <span dir="rtl">%s</span></span>' % (d_en, d_ar), 1)
    if kind == "contract":
        s = s.replace('<td class="c">☐</td><td class="c">☐</td><td class="c">☐</td>', '<td class="c">☑</td><td class="c">☐</td><td class="c">☐</td>', 1)
        s = s.replace("account at [●], IBAN [IBAN]", "account at %s, IBAN %s" % (BANK, IBAN)).replace("لدى [●]، آيبان [IBAN]", "لدى %s، آيبان %s" % (BANK, IBAN))
    if kind == "authz":
        for a, b in (("SERVICE AGREEMENT", "AUTHORIZATION"), ("Business Development Service Agreement", "Authorization Letter"),
                     ("Sales leads and referrals and help registering as a vendor with companies.", "The Second Party chooses what it authorizes the First Party to do."),
                     (">عقد خدمة<", ">تفويض<"), ("عقد خدمة تطوير الأعمال", "خطاب تفويض"),
                     ("خدمة تزويدك بفرص بيع وإحالات ومساعدتك في التسجيل كمورد لدى الشركات.", "يختار الطرف الثاني ما يفوّض به الطرف الأول.")):
            s = s.replace(a, b)
    return s


def fieldify(s, stem):
    k = [0]
    def fld(cls):
        def rep(m):
            k[0] += 1
            return '<span class="fld %s" data-f="%s_f%d"></span>' % (cls, stem, k[0])
        return rep
    s = s.replace('<td class="c" style="height:34px">&nbsp;</td>', '<td class="c" style="height:34px">[●wide]</td>')
    s = re.sub(r"\[●wide\]", fld("wide"), s)
    s = re.sub(r"\[●\]", fld(""), s)
    s = re.sub(r"☐", fld("cbx"), s)
    s = s.replace("</style>", CBX_CSS + "</style>", 1)
    return s, k[0]


def add_fields(pdf, flds):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import (ArrayObject, BooleanObject, DictionaryObject, FloatObject, NameObject, NumberObject,
                               TextStringObject, DecodedStreamObject)
    w = PdfWriter(clone_from=pdf)
    font = w._add_object(DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                                           NameObject("/BaseFont"): NameObject("/Helvetica"), NameObject("/Encoding"): NameObject("/WinAnsiEncoding")}))
    acro = DictionaryObject({NameObject("/Fields"): ArrayObject(), NameObject("/DA"): TextStringObject("/Helv 10 Tf 0 g"),
                             NameObject("/DR"): DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/Helv"): font})}),
                             NameObject("/NeedAppearances"): BooleanObject(True)})
    w._root_object[NameObject("/AcroForm")] = acro
    for f in flds:
        page = w.pages[f["page"]]; mb = page.mediabox; pw, ph = float(mb.width), float(mb.height); sc = pw / f["pw"]
        x1, x2 = f["x"] * sc, (f["x"] + f["w"]) * sc
        y2, y1 = ph - f["y"] * sc, ph - (f["y"] + f["h"]) * sc
        rect = ArrayObject([FloatObject(x1), FloatObject(y1), FloatObject(x2), FloatObject(y2 + (0 if f["cb"] else 1))])
        a = DictionaryObject({NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Widget"),
                              NameObject("/T"): TextStringObject(f["name"]), NameObject("/Rect"): rect, NameObject("/F"): NumberObject(4)})
        if f["cb"]:
            bw, bh = x2 - x1, y2 - y1
            def stream(content):
                st = DecodedStreamObject(); st.set_data(content.encode())
                st.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Form"),
                           NameObject("/BBox"): ArrayObject([FloatObject(0), FloatObject(0), FloatObject(bw), FloatObject(bh)]),
                           NameObject("/Resources"): DictionaryObject()})
                return w._add_object(st)
            yes = stream("0.043 0.106 0.353 RG 1.4 w %.2f %.2f m %.2f %.2f l %.2f %.2f l S" % (bw * .2, bh * .5, bw * .42, bh * .22, bw * .82, bh * .8))
            off = stream(" ")
            a.update({NameObject("/FT"): NameObject("/Btn"), NameObject("/Ff"): NumberObject(0), NameObject("/V"): NameObject("/Off"),
                      NameObject("/AS"): NameObject("/Off"),
                      NameObject("/MK"): DictionaryObject({NameObject("/BC"): ArrayObject([FloatObject(.043), FloatObject(.106), FloatObject(.353)])}),
                      NameObject("/AP"): DictionaryObject({NameObject("/N"): DictionaryObject({NameObject("/Yes"): yes, NameObject("/Off"): off})})})
        else:
            a.update({NameObject("/FT"): NameObject("/Tx"), NameObject("/Ff"): NumberObject(0),
                      NameObject("/DA"): TextStringObject("/Helv 10 Tf 0.043 0.106 0.353 rg"), NameObject("/V"): TextStringObject(""),
                      NameObject("/MK"): DictionaryObject({NameObject("/BC"): ArrayObject()})})
        ref = w._add_object(a)
        if "/Annots" not in page: page[NameObject("/Annots")] = ArrayObject()
        page["/Annots"].append(ref); acro["/Fields"].append(ref)
    w.write(pdf)


def render(html, pdf):
    print(sh("node", os.path.join(HERE, "rev_render.cjs"), html, pdf).strip())
    fj = pdf[:-4] + ".fields.json"
    flds = json.load(open(fj)); os.remove(fj)
    if flds: add_fields(pdf, flds)


def main(cfg_path, outdir):
    cfg = json.load(open(cfg_path, encoding="utf-8"))
    hd, od, pd = [os.path.join(outdir, x) for x in ("html", "open", "pdf")]
    for d in (hd, od, pd): os.makedirs(d, exist_ok=True)
    os.environ.setdefault("NODE_PATH", sh("npm", "root", "-g").strip())
    rev_build.OUT = hd
    os.environ["REV_OUTDIR"] = hd
    for kind in ("contract", "nda", "authz", "docs", "form"):
        rev_build.build(kind)
    # عروض السعر
    for key, short in (("quote-simple", True), ("quote-detailed", False)):
        open(os.path.join(hd, key + ".html"), "w", encoding="utf-8").write(rev_quote.build(cfg, short, PHONE, IBAN, BANK))
    files = {"contract": "REV-contract-bilingual.html", "nda": "REV-nda-mutual-bilingual.html", "authz": "REV-authorization.html",
             "docs": "REV-documents-checklist.html", "form": "REV-client-data-form.html"}
    for key, fn in files.items():
        p = os.path.join(hd, fn); s = open(p, encoding="utf-8").read()
        open(p, "w", encoding="utf-8").write(portrait_post(s, key, cfg))
    # مفتوح داخلي: HTML بخانات [●] كما هي
    for key, fn in list(files.items()) + [("quote-simple", "quote-simple.html"), ("quote-detailed", "quote-detailed.html")]:
        shutil.copy(os.path.join(hd, fn if key in files else fn), os.path.join(od, fn))
    # PDF: حقول
    allh = {**files, "quote-simple": "quote-simple.html", "quote-detailed": "quote-detailed.html"}
    for key, fn in allh.items():
        p = os.path.join(hd, fn); s = open(p, encoding="utf-8").read()
        s2, n = fieldify(s, key.split("-")[0])
        fp = os.path.join(hd, "f-" + fn); open(fp, "w", encoding="utf-8").write(s2)
        render(fp, os.path.join(hd, key + ".pdf"))
    from pypdf import PdfWriter
    m = PdfWriter()
    for k in ("docs", "form"): m.append(os.path.join(hd, k + ".pdf"))
    m.write(os.path.join(hd, "docs-merged.pdf"))
    for key in ("quote-simple", "quote-detailed", "contract", "nda", "authz"):
        shutil.copy(os.path.join(hd, key + ".pdf"), os.path.join(pd, NAMES[key] + ".pdf"))
    shutil.copy(os.path.join(hd, "docs-merged.pdf"), os.path.join(pd, NAMES["docs"] + ".pdf"))
    print("done", pd)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
