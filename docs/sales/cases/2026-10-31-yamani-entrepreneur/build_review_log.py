# -*- coding: utf-8 -*-
"""سجل مراجعة النقاط: لكل بند في كل وثيقة صف لكل جهة (قانونية · امتثال · مبيعات · عمليات). الحالة الافتراضية «بانتظار»."""
import csv, sys
from content import *
from info_docs import CHECKLIST, FORM, GUIDE

ENT = ["القانونية", "الامتثال", "المبيعات", "العمليات"]
NOTES = {  # (وثيقة، جزء من اسم البند) -> ملاحظة معروفة مسبقاً
    ("العقد", "Fees"): "الآيبان والبنك [IBAN]/[●] يحقنهما بدر؛ 30,000 من الكتالوج؛ 50/50.",
    ("العقد", "Cancellation"): "مهلة الإلغاء بالأيام والرسم الأدنى غير المسترد [●]: قرار المالك.",
    ("العقد", "Client Inactivity"): "30/90 يوماً افتراضيان من نص القانونية: يؤكدهما المالك.",
    ("العقد", "Client Obligations"): "مهلة ردّ العميل بأيام العمل [●]: قرار المالك.",
    ("العقد", "Exclusions"): "أُضيف: الوكالة خارج الحزمة (قرار المالك).",
    ("العقد", "Data Protection"): "الاستضافة والنقل خارج المملكة [●] في عرض السعر بند 7.",
    ("العقد", "General"): "عناوين الإشعارات [●].",
    ("العقد", "Compliance"): "بند الاستثمار الأجنبي: مصدر الأموال والمستفيد الحقيقي.",
    ("العقد", "Scope Limits"): "بند تأسيس الشركات: لا صفة اسمية.",
    ("عرض السعر", "Duration"): "«10 أيام عمل» منقولة من عرض 2026-10-08؛ تحتاج تحققاً رسمياً (العمليات).",
    ("عرض السعر", "Terms"): "بند 7: الاستضافة ونقل البيانات [●].",
    ("عرض السعر", "Price"): "30,000 + ضريبة 15% = 34,500؛ الرسوم الحكومية غير شاملة.",
    ("عرض السعر", "Not included"): "الوكالة خارج الحزمة؛ مقيم ← تصدر من داخل السعودية.",
    ("قائمة المستندات", "Support"): "جهات الدعم المعتمدة: تؤكدها العمليات من المصدر الرسمي.",
    ("دليل الخدمة", "How long"): "المدة الرسمية تحتاج تحققاً (العمليات).",
}

def note(doc, title):
    for (d, k), v in NOTES.items():
        if d == doc and k.lower() in title.lower():
            return v
    return ""

def items():
    for i, r in enumerate(contract_clauses(), 2):
        yield "العقد", "%d. %s / %s" % (i, r[1], r[0]), r[0]
    for i, r in enumerate(nda_rows(), 2):
        yield "اتفاقية عدم الإفصاح", "%d. %s / %s" % (i, r[1], r[0]), r[0]
    q = [("1", "Price", "السعر"), ("2", "Scope", "النطاق"), ("3", "Requirements", "المتطلبات"), ("4", "Not included", "ما لا يشمله العرض"),
         ("5", "Duration", "المدة"), ("6", "Payment terms", "طريقة الدفع"), ("7", "Terms", "الشروط والأحكام"), ("8", "Signatures", "التوقيعان")]
    for n_, en, a in q:
        yield "عرض السعر", "%s. %s / %s" % (n_, a, en), en
    for i, r in enumerate(CHECKLIST, 1):
        yield "قائمة المستندات", "%d. %s / %s" % (i, r[1], r[0]), r[0]
    for r in FORM:
        yield "نموذج البيانات", "%s / %s" % (r[1], r[0]), r[0]
    for i, r in enumerate(GUIDE, 1):
        yield "دليل الخدمة", "%d. %s / %s" % (i, r[1], r[0]), r[0]

if __name__ == "__main__":
    out = sys.argv[1]
    rows = []
    for doc, item, en in items():
        n_ = note(doc, en)
        for e in ENT:
            rows.append([doc, item, e, "بانتظار المراجعة", n_ if e in ("القانونية", "العمليات", "المبيعات") else ""])
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["الوثيقة", "البند", "الجهة", "الحالة", "الملاحظة"]); w.writerows(rows)
    print(len(rows), "rows")
