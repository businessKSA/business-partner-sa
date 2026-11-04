# -*- coding: utf-8 -*-
"""يحوّل كل [●] متبقٍّ في ملفات HTML الصادرة إلى حقل تعبئة (.fld) ليكتبه العميل مباشرة في PDF.
الاستعمال: python3 fillable_pass.py <مجلد الإخراج>. لا يمسّ ملفات المستودع؛ يعمل على نسخة الإخراج فقط."""
import re, sys
from pathlib import Path
CSS = ".fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}"
def run(out):
    n = 0
    for p in sorted(Path(out).glob("*.html")):
        h = p.read_text(encoding="utf8"); k = [0]
        def rep(m):
            k[0] += 1; return '<span class="fld" data-f="%s_f%d"></span>' % (p.stem.split("-")[0], k[0])
        h2 = re.sub(r"\[●\]", rep, h)
        if k[0]:
            h2 = h2.replace("</style>", CSS + "</style>", 1)
        p.write_text(h2, encoding="utf8"); n += k[0]
        print(p.name, k[0])
    return n
if __name__ == "__main__":
    run(sys.argv[1])
