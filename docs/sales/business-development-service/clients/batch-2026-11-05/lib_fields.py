# -*- coding: utf-8 -*-
"""نسخة مأخوذة من src/rev_package.py (حقول تعبئة PDF وخانات الاختيار) لتبقى مستقلة عن تعديلات الجلسات الأخرى."""
import json, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))

CBX_CSS = (".fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}"
           ".fld.cbx{min-width:0;width:12px;height:12px;border:1px solid #0B1B5A;vertical-align:-2px}"
           ".fld.wide{display:block;width:96%;height:22px;min-width:0;margin:0 auto}")

def sh(*a, **k):
    r = subprocess.run(a, capture_output=True, text=True, **k)
    if r.returncode: raise SystemExit(r.stderr or r.stdout)
    return r.stdout

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
