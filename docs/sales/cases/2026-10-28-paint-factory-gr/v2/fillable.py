"""يحوّل مستطيلات .fld إلى حقول نموذج PDF (AcroForm) قابلة للتعبئة مباشرة. أداة داخلية للبناء النهائي."""
import json
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (ArrayObject, BooleanObject, DictionaryObject, FloatObject, NameObject, NumberObject,
                           TextStringObject)


def add_fields(pdf_path):
    pdf_path = Path(pdf_path)
    fj = pdf_path.with_suffix(".fields.json")
    flds = json.loads(fj.read_text(encoding="utf8")) if fj.exists() else []
    fj.unlink(missing_ok=True)
    if not flds:
        return 0
    w = PdfWriter(clone_from=str(pdf_path))
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica"), NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})
    font_ref = w._add_object(font)
    acro = DictionaryObject({
        NameObject("/Fields"): ArrayObject(),
        NameObject("/DA"): TextStringObject("/Helv 10 Tf 0 g"),
        NameObject("/DR"): DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/Helv"): font_ref})}),
        NameObject("/NeedAppearances"): BooleanObject(True),
    })
    w._root_object[NameObject("/AcroForm")] = acro
    n = 0
    for f in flds:
        page = w.pages[f["page"]]
        mb = page.mediabox
        pw, ph = float(mb.width), float(mb.height)
        sc = pw / f["pw"]
        x1, x2 = f["x"] * sc, (f["x"] + f["w"]) * sc
        y2, y1 = ph - f["y"] * sc, ph - (f["y"] + f["h"]) * sc
        a = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/FT"): NameObject("/Tx"), NameObject("/T"): TextStringObject(f["name"]),
            NameObject("/Rect"): ArrayObject([FloatObject(x1), FloatObject(y1), FloatObject(x2), FloatObject(y2 + 1)]),
            NameObject("/F"): NumberObject(4), NameObject("/Ff"): NumberObject(0),
            NameObject("/DA"): TextStringObject("/Helv 10 Tf 0.043 0.106 0.353 rg"),
            NameObject("/V"): TextStringObject(""),
            NameObject("/MK"): DictionaryObject({NameObject("/BC"): ArrayObject()}),
        })
        ref = w._add_object(a)
        if "/Annots" not in page:
            page[NameObject("/Annots")] = ArrayObject()
        page["/Annots"].append(ref)
        acro["/Fields"].append(ref)
        n += 1
    tmp = pdf_path.with_suffix(".tmp.pdf")
    with open(tmp, "wb") as fh:
        w.write(fh)
    tmp.replace(pdf_path)
    return n


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, add_fields(p))
