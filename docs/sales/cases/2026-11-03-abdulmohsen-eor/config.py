# -*- coding: utf-8 -*-
"""عبدالمحسن — مصنع بطاريات (CL-0011): خطاب التفويض فقط (العرض والعقدان وNDA مُسلَّمة سابقاً في cases/2026-10-21-abdulmohsen-battery-eor).
نقل خدمات داخل المملكة لخمسة أجانب (3 مهندسين + 2 مبيعات) بحسب case.md؛ اسم الشركة غير معروف بعد."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-eor-shared", "engine"))
from eor_common import make

C = make(
    client_en="Abdulmohsen — Battery Factory", client_ar="عبدالمحسن — مصنع بطاريات",
    roles=[
        dict(en="Engineers", ar="مهندسون", nat_en="[●]", nat_ar="[●]", count=3),
        dict(en="Sales", ar="مبيعات", nat_en="[●]", nat_ar="[●]", count=2),
    ],
    source="inside", housing="client",
    site_en="[●]", site_ar="[●]", start_en="[●]", start_ar="[●]",
    term_en="[●] months", term_ar="[●] شهراً", med_en="[●]", med_ar="[●]",
)
C["docs"] = ["authz"]
