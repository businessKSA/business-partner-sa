# -*- coding: utf-8 -*-
"""ATYX (CL-0014) — نظام التعاقد لأربعة عاملين، الدمام، 9 أشهر من 15 أبريل 2027 (طلب EOR-137189، 12 أكتوبر 2026).
الحقائق من طلب العميل كما سُجّل في pricing-ledger وclient-service-review؛ الأسعار [●] (انظر README)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-eor-shared", "engine"))
from eor_common import make

C = make(
    client_en="ATYX", client_ar="ATYX",
    roles=[
        dict(en="Site manager — construction", ar="مدير موقع — إنشاءات", nat_en="India", nat_ar="الهند", count=1),
        dict(en="Mechanical assembly technician", ar="فني تجميع ميكانيكي", nat_en="Morocco, South Africa", nat_ar="المغرب، جنوب أفريقيا", count=2),
        dict(en="Electrical and electronic assembly technician", ar="فني تجميع إلكتروني وكهربائي", nat_en="India", nat_ar="الهند", count=1),
    ],
    source="abroad", housing="bp",
    site_en="Dammam", site_ar="الدمام", start_en="15 April 2027", start_ar="15 أبريل 2027",
    term_en="9 months", term_ar="9 أشهر", med_en="Category A", med_ar="الفئة A",
    countries_en="India, Morocco and South Africa", countries_ar="الهند والمغرب وجنوب أفريقيا",
)
