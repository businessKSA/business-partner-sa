# -*- coding: utf-8 -*-
"""حاسبة سعر عامل واحد بالشهر — منهجية بدر (قرار 2026-10-07) كما في وصف مسؤول EOR. داخلية: لا تُرفق بمستند عميل.

السعر الشهري للعامل = (١ الراتب والبدلات + ٢ المصاريف التشغيلية + ٣ البنود المحمَّلة + ٤ نصيب السعودة) ÷ (1 − الهامش)
  ٢ = 883 (إقامة + رخصة عمل + أجير) + 50 (طبي) + 17 (خروج وعودة) + 2% من الراتب والبدلات
  ٣ = رسم نقل الكفالة ÷ المدة + نهاية الخدمة (الراتب ÷ 24 عند 24 شهراً) + الإجازة (الراتب ÷ 30 × 21 ÷ 12) + تذكرة 125
      — كل بند يدخل السعر فقط إن تحمّلته Business Partner؛ وإلا فبالتكلفة على العميل.
  ٤ = عدد السعوديين × 4,776.67 ÷ عدد الوافدين
«الراتب» في ٣ = الراتب والبدلات معاً (يطابق النتائج المرجعية 2,897 / 3,250 / 3,239 / 3,593 عند رسم نقل 2,000).
لا قيم افتراضية للمجهول: الراتب والرسم والهامش ونشاط السعودة تُمرَّر صراحةً، وغيابها يُرجع None (يُكتب [●]).
الاستعمال:  python3 price_calc.py --selftest
             python3 price_calc.py inputs.csv --months 24 --margin 0.10 --bears eos,leave,ticket,transfer --transfer-fee 2000 --saudis 4 --expats 30
"""
import argparse, csv, math, sys

RES_WP_AJEER = 883      # إقامة + رخصة عمل + أجير (شهرياً) — ملف التسعير
MEDICAL = 50            # تأمين طبي (شهرياً) — ملف التسعير، الفئة الأساسية
EXIT_RE = 17            # خروج وعودة (شهرياً)
GOSI_FOREIGN = 0.02     # التأمينات على الأجنبي: 2% من الراتب والبدلات
TICKET = 125            # تذكرة العودة شهرياً — ملف التسعير
LEAVE_DAYS = 21
SAUDI_SALARY, SAUDI_MEDICAL = 4000, 100
SAUDI_EMPLOYER_GOSI = 0.1275   # 10% معاشات (من يوليو 2026، تتصاعد 0.5% كل يوليو إلى 11%) + 2% أخطار + 0.75% ساند — (2% + 0.75%) من معلومات عامة تُؤكَّد

def saudi_cost_monthly(eos_months=24):
    """تكلفة السعودي الكاملة شهرياً = راتب + تأمينات صاحب العمل + طبي + نهاية الخدمة (الراتب ÷ 24) = 4,776.67 (المثال المعتمد)."""
    return SAUDI_SALARY + SAUDI_SALARY * SAUDI_EMPLOYER_GOSI + SAUDI_MEDICAL + SAUDI_SALARY / eos_months

# نسب نطاقات 2026 (دليل برنامج نطاقات المطوّر): ص = م × ln(س) + ث ؛ الأعمدة: أخضر منخفض / متوسط / مرتفع / بلاتيني
NITAQAT = {
    "construction": dict(m=(-0.37, -0.37, -0.37, -0.37), c=(14.17, 16.17, 17.50, 22.50)),
    "mining":       dict(m=(0, 0, 0, 6), c=(7, 10, 13, 23)),   # تعدين مواد البناء — البلاتيني م=6 وث=23
}
TIERS = {"green_low": 0, "green_mid": 1, "green_high": 2, "platinum": 3}

def required_saudis(activity, tier, expats, total_workforce=None):
    """عدد السعوديين المطلوب لبلوغ النطاق: S/(S+E) ≥ ص/100. س = إجمالي عمالة الكيان؛ إن لم يُعطَ يُحسب تكرارياً من S+E.
    نشاط الكيان المسجَّل هو الذي يحكم، لا نشاط العميل — يُسأل بدر قبل أي حساب. الهدف الأدنى: green_mid (الأخضر المنخفض لا تُنقل منه الخدمات صراحةً)."""
    k = NITAQAT[activity]; i = TIERS[tier]
    s = 0
    for _ in range(50):
        x = total_workforce if total_workforce else (s + expats)
        p = (k["m"][i] * math.log(x) + k["c"][i]) / 100.0
        s2 = math.ceil(p * expats / (1 - p) - 1e-9)
        if s2 == s: break
        s = s2
    return s

def price(salary_total, months=24, margin=0.10, bears=(), transfer_fee=None, saudis=None, expats=None):
    """يعيد dict بالمكوّنات والسعر؛ أي مدخل ناقص يجعل السعر None.
    bears: ما تتحمله Business Partner من {'transfer','eos','leave','ticket'} — ما لم يُذكر يُفوتَر على العميل بالتكلفة."""
    if salary_total is None or margin is None or saudis is None or expats is None:
        return None
    if "transfer" in bears and transfer_fee is None:
        return None
    ops = RES_WP_AJEER + MEDICAL + EXIT_RE + GOSI_FOREIGN * salary_total
    items = 0.0
    if "transfer" in bears: items += transfer_fee / months
    if "eos" in bears: items += salary_total / 24.0 if months == 24 else salary_total / 24.0   # نصف شهر لكل سنة = الراتب ÷ 24 شهرياً
    if "leave" in bears: items += salary_total / 30.0 * LEAVE_DAYS / 12.0
    if "ticket" in bears: items += TICKET
    saud = saudis * saudi_cost_monthly() / expats
    cost = salary_total + ops + items + saud
    p = cost / (1 - margin)
    return dict(salary=salary_total, ops=ops, items=items, saudization=saud, direct=salary_total + ops + items, cost=cost, price=p,
                effective_margin=(p - cost) / p)

def selftest():
    ok = True
    def chk(name, got, want, tol=0.6):
        nonlocal ok
        good = abs(got - want) <= tol
        ok &= good
        print(("OK  " if good else "FAIL"), name, round(got, 2), "≈", want)
    chk("تكلفة السعودي الكاملة", saudi_cost_monthly(), 4776.67, 0.01)
    chk("سعودة تعدين 4 من 30", 4 * saudi_cost_monthly() / 30, 637, 0.5)
    chk("سعودة مقاولات 6 من 30", 6 * saudi_cost_monthly() / 30, 955, 0.5)
    chk("عدد السعوديين: تعدين أخضر متوسط لـ30 وافداً", required_saudis("mining", "green_mid", 30), 4, 0)
    chk("عدد السعوديين: مقاولات أخضر متوسط لـ30 وافداً", required_saudis("construction", "green_mid", 30), 6, 0)
    a = price(1000, 24, 0.10, (), None, 4, 30);  chk("العميل يتحمل البنود — تعدين", a["price"], 2897)
    b = price(1000, 24, 0.10, (), None, 6, 30);  chk("العميل يتحمل البنود — مقاولات", b["price"], 3250)
    c = price(1000, 24, 0.10, ("transfer", "eos", "leave", "ticket"), 2000, 4, 30); chk("BP تتحمل — تعدين", c["price"], 3239)
    d = price(1000, 24, 0.10, ("transfer", "eos", "leave", "ticket"), 2000, 6, 30); chk("BP تتحمل — مقاولات", d["price"], 3593)
    chk("التكلفة المباشرة 1,970", a["direct"], 1970, 0.01)
    print("SELFTEST", "PASS" if ok else "FAIL")
    return 0 if ok else 1

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?"); ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--months", type=int, default=24); ap.add_argument("--margin", type=float)
    ap.add_argument("--bears", default=""); ap.add_argument("--transfer-fee", type=float)
    ap.add_argument("--saudis", type=float); ap.add_argument("--expats", type=float)
    a = ap.parse_args()
    if a.selftest or not a.csv: sys.exit(selftest())
    bears = tuple(x for x in a.bears.split(",") if x)
    print("role,nationality,count,salary_total,price_per_worker,monthly_total,effective_margin")
    tot = 0; unknown = False
    for r in csv.DictReader(open(a.csv, encoding="utf-8-sig")):
        sal = None if r["salary_and_allowances"].strip() in ("", "[●]") else float(r["salary_and_allowances"])
        cnt = None if r["count"].strip() in ("", "[●]") else int(r["count"])
        res = price(sal, a.months, a.margin, bears, a.transfer_fee, a.saudis, a.expats)
        if res is None or cnt is None:
            unknown = True; print("%s,%s,%s,%s,[●],[●],[●]" % (r["role"], r["nationality"], cnt if cnt is not None else "[●]", r["salary_and_allowances"] or "[●]")); continue
        tot += res["price"] * cnt
        print("%s,%s,%d,%.0f,%.2f,%.2f,%.1f%%" % (r["role"], r["nationality"], cnt, sal, res["price"], res["price"] * cnt, res["effective_margin"] * 100))
    print("TOTAL," + ("[●]" if unknown else "%.2f" % tot))

if __name__ == "__main__":
    main()
