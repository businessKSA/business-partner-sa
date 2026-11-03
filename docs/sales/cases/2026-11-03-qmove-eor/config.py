# -*- coding: utf-8 -*-
"""QMOVE (CL-0013) — نظام التعاقد لفريق يبدأ بـ20 ويصل إلى 50 (طلب 23 أكتوبر 2026، مهمة فرح FARAH-20261023-150932-URRM).
المهن والجنسيات والمدينة والمدة وتاريخ البدء غير معلومة بعد، فكلها [●]؛ الأسعار [●] (انظر README)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-eor-shared", "engine"))
from eor_common import make

C = make(
    client_en="QMOVE", client_ar="QMOVE",
    roles=[
        dict(en="Initial team — roles to be confirmed", ar="الفريق الأولي — الوظائف تُحدَّد", nat_en="[●]", nat_ar="[●]", count=20),
        dict(en="Expansion phase — roles to be confirmed (growing to 50 in total)", ar="مرحلة التوسع — الوظائف تُحدَّد (حتى 50 إجمالاً)", nat_en="[●]", nat_ar="[●]", count=30),
    ],
    source="tbd", housing="choice",
    site_en="[●]", site_ar="[●]", start_en="[●]", start_ar="[●]",
    term_en="[●] months", term_ar="[●] شهراً", med_en="category [●]", med_ar="الفئة [●]",
    workers_label=("20, growing to 50", "20 ويصل إلى 50"), workers_suffix=(" (up to)", " (حتى)"),
    headcount_note=("The team starts with 20 workers and may grow to 50; prices may differ by headcount band, as the Client and Business Partner agree in writing.",
                    "يبدأ الفريق بـ20 عاملاً وقد يصل إلى 50؛ وقد تختلف الأسعار بحسب شريحة العدد، كما يتفق العميل وBusiness Partner كتابةً."),
)
