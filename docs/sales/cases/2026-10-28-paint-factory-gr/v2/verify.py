#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""فحص حزمة v2: إعادة حساب الأرقام، واتساقها في كل مستند، وغياب المحظورات. الاستعمال: python3 verify.py"""
import re
import subprocess
import sys
from decimal import Decimal as D
from pathlib import Path

HERE = Path(__file__).resolve().parent
VAT = D("0.15")
annual, setup = D(24000), D(12000)
q = annual / 4
due_net = q + setup
first_net = annual + setup
fmt = lambda x: f"{x:,.2f}".rstrip("0").rstrip(".") if x != int(x) else f"{int(x):,}"
exp = {
    "annual 24,000": (annual, D(24000)), "quarter 6,000": (q, D(6000)), "setup 12,000": (setup, D(12000)),
    "due on signature net 18,000": (due_net, D(18000)), "due on signature incl. VAT 20,700": (due_net * (1 + VAT), D(20700)),
    "first year net 36,000": (first_net, D(36000)), "first year incl. VAT 41,400": (first_net * (1 + VAT), D(41400)),
    "quarterly invoice incl. VAT 6,900": (q * (1 + VAT), D(6900)),
    "20,700 + 3 x 6,900 = 41,400": (D(20700) + 3 * D(6900), D(41400)),
    "extra employee per quarter 75": (D(300) / 4, D(75)), "operations 30 x 12 = 360": (D(30) * 12, D(360)),
    "alert at 80% of 30 = 24": (D(30) * D("0.8"), D(24)),
}
bad = 0
print("== 1) إعادة حساب الأرقام")
for k, (got, want) in exp.items():
    ok = got == want
    bad += not ok
    print(f"  {'OK ' if ok else 'XX '} {k}: {fmt(got)}")

client = ["quote", "contract", "nda", "terms", "authorization-letter", "assessment-summary", "assessment-full"]
text = {}
for n in client:
    html = (HERE / f"{n}.html").read_text(encoding="utf8")
    html = re.sub(r"<style>.*?</style>", "", html, flags=re.S)
    html = re.sub(r"<[^>]+>", " ", html)
    t_html = html
    pdf = HERE / "pdf" / f"{n}.pdf"
    t_pdf = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout if pdf.exists() else ""
    text[n] = (t_html, t_pdf)

print("== 2) الأرقام داخل المستندات (HTML / PDF)")
need = {"quote": ["24,000", "6,000", "12,000", "18,000", "20,700", "36,000", "41,400", "6,900", "3,000", "300", "40", "75"],
        "contract": ["24,000", "6,000", "12,000", "18,000", "20,700", "6,900", "3,000", "300", "40", "75"],
        "terms": ["24,000", "6,000", "12,000", "20,700", "6,900", "3,000", "300", "40", "75"],
        "assessment-full": ["32,200", "24,000", "7,000", "1,200", "33,200", "34,000", "84,659.45", "68,066.32", "16,593.13", "2,919.29", "2,248.25", "38,367.54", "87,578.74", "16,225.10", "4,148.28", "7.14"]}
for n, nums in need.items():
    for nm in nums:
        h = nm in text[n][0].replace(" ", "")
        p = nm in text[n][1].replace(" ", "")
        bad += not (h and p)
        print(f"  {'OK ' if h and p else 'XX '} {n}: {nm} html={h} pdf={p}")
print("  أرقام العرض السابق غائبة عن مستندات العميل (7,500 / 15,000 / 90,000 / 105,000 / 43,125 / 25,875):")
for n in client:
    for old in ["7,500", "15,000", "90,000", "105,000", "43,125", "25,875"]:
        for lab, t in zip(("html", "pdf"), text[n]):
            if old in t.replace(" ", ""):
                bad += 1
                print(f"  XX {n} {lab}: {old}")
print("  (لا مطابقات = سليم)")

print("== 3) المحظورات في كل ملفات v2 عدا السكربتات (grep)")
files = [p for p in HERE.glob("*") if p.is_file() and p.suffix in (".html", ".md")]
pats = {
    "IBAN فعلي (SA + أرقام)": r"\bSA\d{2}[\s\d]{16,}",
    "أرقام هواتف (أنماط الجوال السعودي)": r"(\b05\d{8}\b|\+?966\s?-?5\d{8}|00966)",
    "كلمة محظورة رقم 1 (معيار العرض)": r"مسودة",
    "كلمة محظورة رقم 2 (التسمية: المستشار الذكي)": r"الوكيل",
    "عنوان شارع من ورق الشركة القديم": r"Al Arid|Rihana|العريد|ريحانة",
}
for lab, pat in pats.items():
    hits = [f"{f.name}:{i}" for f in files for i, l in enumerate(f.read_text(encoding='utf8').splitlines(), 1) if re.search(pat, l)]
    for n in client:
        for src, t in zip(("html", "pdf"), text[n]):
            pass
    pdfhits = [n for n in client if re.search(pat, text[n][1])]
    ok = not hits and not pdfhits
    bad += not ok
    print(f"  {'OK ' if ok else 'XX '} {lab}: ملفات نصية={hits or 'لا شيء'} · PDF={pdfhits or 'لا شيء'}")
# كلمة draft في نصوص العميل وجسم الإيميل (اسم الملف نفسه مستثنى)
body = (HERE / "cover-email-draft.md").read_text(encoding="utf8").split("\n---\n", 1)[-1]
dh = [n for n in client if re.search(r"draft", text[n][0] + text[n][1], re.I)] + (["email-body"] if re.search(r"draft", body, re.I) else [])
bad += bool(dh)
print(f"  {'OK ' if not dh else 'XX '} كلمة draft في نصوص العميل وجسم الإيميل: {dh or 'لا شيء'}")
ib = {n: len(re.findall(r"\[IBAN\]", text[n][0])) for n in client}
print("  عدد [IBAN] (نائب فقط):", {k: v for k, v in ib.items() if v})
print("== 4) مرجع الأسماء: كل المستندات باسم المالك (قرار 2026-11-04)")
for n, w in [("quote", "Baher Bakr Ali Magnas"), ("assessment-full", "Baher Bakr Ali Magnas"), ("contract", "Baher Bakr Ali Magnas"), ("nda", "Baher Bakr Ali Magnas"), ("authorization-letter", "Baher Bakr Ali Magnas")]:
    ok = w in text[n][0]
    bad += not ok
    print(f"  {'OK ' if ok else 'XX '} {n}: {w}")
print("== 5) الفرق عن العرض المرسل 2026-11-01 (7,500 شهرياً + إعداد 15,000؛ قرارات المالك 2026-10-30)")
old_rec, old_setup = D(7500) * 12, D(15000)
old_first = old_rec + old_setup
old_sign_net = D(7500) * 3 + old_setup
pc = lambda a, b: f"{(a - b) / b * 100:.1f}%"
print(f"  السنة الأولى قبل الضريبة: {fmt(old_first)} ← {fmt(first_net)}  ({pc(first_net, old_first)}؛ فرق {fmt(old_first - first_net)})")
print(f"  المتكرر السنوي: {fmt(old_rec)} ← {fmt(annual)}  ({pc(annual, old_rec)})")
print(f"  رسم الإعداد/التصحيح: {fmt(old_setup)} ← {fmt(setup)}  ({pc(setup, old_setup)})")
print(f"  المستحق عند التوقيع قبل الضريبة: {fmt(old_sign_net)} ← {fmt(due_net)}؛ شاملة الضريبة: {fmt(old_sign_net * (1 + VAT))} ← {fmt(due_net * (1 + VAT))}")
print(f"  الفرع الإضافي سنوياً: {fmt(D(2500) * 12)} ← 3,000؛ الموظف الإضافي 300 سنوياً (بلا تغيير)؛ حد الموظفين 30 ← 49")
print("== النتيجة:", "كل الفحوص سليمة" if not bad else f"{bad} فحصاً فاشلاً")
sys.exit(1 if bad else 0)
