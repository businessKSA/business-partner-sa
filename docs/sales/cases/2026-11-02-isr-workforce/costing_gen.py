# -*- coding: utf-8 -*-
"""يولّد costing.html (داخلي، لا يُرفق بمستند عميل) من نفس دالة التسعير المستعملة في العرض."""
from content import *
f = lambda x: "{:,.2f}".format(x)
def detail(a, loc, factory=False, months=24):
    permit = 9700 / 12.0
    rows = [("الراتب (الحد الأدنى)", a), ("رخصة العمل والمقابل المالي (9,700÷12)", permit), ("الإقامة (650÷12)", 650/12.0), ("أجير (23 شهرياً)", 23),
            ("التأمينات 2% على 85% من الراتب", a*0.85*0.02), ("التأمين الطبي (فئة أساسية)", 50), ("نهاية الخدمة (الراتب÷24)", a/24.0),
            ("بدل الإجازة (الراتب÷30×21÷12)", a/30.0*21/12.0), ("خروج وعودة (200÷12)", 200/12.0), ("تذكرة العودة (1,500÷12)", 125.0), ("تأشيرة العامل المستقدَم أو نقل الكفالة (2,000÷%d)" % months, 2000.0/months)]
    direct = sum(v for _, v in rows); fee10 = 0.10*(direct+500); fee = max(fee10, 500.0); price = direct+500+fee+loc
    t = '<table><tr><th>البند</th><th>ريال/شهر</th></tr>' + ''.join('<tr><td>%s</td><td>%s</td></tr>' % (k, f(v)) for k, v in rows)
    t += '<tr class=s><td>التكلفة المباشرة</td><td>%s</td></tr><tr><td>الأوفر هيد على الموظف</td><td>500.00</td></tr>' % f(direct)
    t += '<tr><td>رسمنا: 10%% على (التكلفة + الأوفر هيد) = %s، وبحد أدنى 500</td><td>%s</td></tr>' % (f(fee10), f(fee))
    t += '<tr><td>رسم التوطين (سعودة) داخل السعر</td><td>%s</td></tr>' % f(loc)
    if factory:
        price -= 800; t += '<tr><td>خصم المصنع: إعفاء المقابل المالي (9,600÷12)</td><td>−800.00</td></tr>'
    t += '<tr class=t><td>السعر قبل الضريبة</td><td>%s ≈ %s</td></tr></table>' % (f(price), "{:,}".format(int(round(price))))
    return t
h = '''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تكلفة ISR</title><style>
body{font:13px/1.6 "Noto Naskh Arabic","Noto Sans Arabic",Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:15px;margin:18px 0 6px;color:#0b3d6b}
table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #bbb;padding:4px 8px;text-align:right}th{background:#eef2f7}tr.s td{background:#f6f6f6;font-weight:bold}tr.t td{background:#dff0e6;font-weight:bold}
.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}.n{background:#fff7e0;border:1px solid #e4c96a;padding:8px;margin:8px 0}</style></head><body>
<h1>تكلفة وتسعير خدمة توفير العمالة بنظام التعاقد — ISR Trading (داخلي، لا يُرفق بمستند عميل)</h1>
<div class="n"><b>قواعد المالك 4/11:</b> الأوفر هيد 500 للموظف شهرياً · رسم التوطين (السعودة) 900 داخل السعر · رسمنا 10% فوق (التكلفة + الأوفر هيد) <b>وبحد أدنى 500 ريال</b> · الضريبة 15% تُضاف · الرواتب الدنيا: فنية 3,000 · ماهرة 2,500 · عادية (عامل مساعد) 1,500 · عقد 24 شهراً · الاستقدام من الدولة بحسب الجنسية بالتكلفة وبفاتورة منفصلة (لا رسم 500 ثابت) · السعر واحد للجنسيات الثلاث · العامل على مصنع: رسم رخصة العمل 100 بدل 9,700 سنوياً.</div>'''
for k, (le, la, a, loc) in LEVELS.items():
    h += '<h2>%s — راتب %s: الحسبة بند بند (العامل العادي، 24 شهراً)</h2><div class="g"><div><b>سعر عادي</b>%s</div><div><b>سعر مصنع</b>%s</div></div>' % (la, "{:,}".format(a), detail(a, loc), detail(a, loc, True))
rows = ''
for k, (le, la, a, loc) in LEVELS.items():
    rows += '<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (la, "{:,}".format(a), "{:,}".format(PRICE[k]), "{:,}".format(PRICE_F[k]), "{:,}".format(PRICE[k]-PRICE_F[k]))
h += '<h2>ملخص الأسعار</h2><table><tr><th>المستوى</th><th>الحد الأدنى للراتب</th><th>السعر العادي</th><th>سعر المصنع</th><th>الفرق</th></tr>%s</table>' % rows
h += '<h2>الفرق السبعة (105 عمال: 8 محترفين + 7 عمال مساعدين في كل فريق)</h2><table><tr><th>الحالة</th><th>شهرياً قبل الضريبة</th><th>الضريبة 15%</th><th>الإجمالي شهرياً</th><th>مدة 24 شهراً قبل الضريبة</th></tr>'
h += '<tr><td>سعر عادي</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % ("{:,}".format(TOTAL_MONTHLY), f(MONTHLY_VAT), f(MONTHLY_GRAND), "{:,}".format(TOTAL_MONTHLY*24))
h += '<tr><td>كل العمال على مصنع</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr></table>' % ("{:,}".format(TOTAL_MONTHLY_F), f(MONTHLY_VAT_F), f(MONTHLY_GRAND_F), "{:,}".format(TOTAL_MONTHLY_F*24))
h += '<h2>الاستقدام من الدولة (بالتكلفة، فاتورة منفصلة، خارج السعر الشهري)</h2><table><tr><th>الجنسية</th><th>الاستقدام</th><th>العقود والتصديق</th><th>تذكرة القدوم</th><th>الإجمالي للعامل</th><th>المدة المعتادة</th></tr>'
for ne, na, r, t, k3, de, da in REC_COUNTRY: h += '<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (na, "{:,}".format(r), "{:,}".format(t), "{:,}".format(k3), "{:,}".format(r+t+k3), da)
h += '</table><p>العامل المنقول من داخل المملكة: لا توجد تكاليف استقدام من الخارج، ورسم النقل (2,000 للمرة الأولى، ثم 4,000، ثم 6,000) يحلّ محل تأشيرة العامل في الحسبة.</p>'
h += '<h2>مقارنة بعملاء EOR السابقين</h2><table><tr><th>العميل</th><th>السعر شهرياً للعامل</th><th>ملاحظة</th></tr><tr><td>ISR الآن</td><td>%s / %s / %s</td><td>فنية / ماهرة / مساعد</td></tr><tr><td>ATYX</td><td>5,620</td><td>راتب 2,000 مع الاستقدام</td></tr><tr><td>بترومنت (موقّع)</td><td>4,100 / 4,350 / 6,000</td><td>راتب 2,000 + رسم إدارة</td></tr><tr><td>فلبيني ×60</td><td>4,200</td><td>هامش مفترض 10%%</td></tr><tr><td>نظافة ×100</td><td>4,500</td><td>هامش فعلي ≈ 4.4%%</td></tr></table>' % (PRICE["tech"], PRICE["skilled"], PRICE["helper"])
h += '<h2>التوطين بقرار للمهن الفنية والهندسية: تكلفة أعلى (العمالة في العرض على مهن بلا علاقة بالتوطين)</h2><table><tr><th>البند</th><th>فنية هندسية</th><th>هندسية</th></tr>'
h += '<tr><td>النسبة / أقل راتب للسعودي</td><td>30%% / 5,500</td><td>30%% / 8,000</td></tr>'
h += '<tr><td>العمال الأجانب في الحسبة</td><td>%d (فريقا الهياكل والتكييف)</td><td>%d (مثال)</td></tr>' % (LOC_TECH["q"], LOC_ENG["q"])
h += '<tr><td>السعوديون المطلوبون = ceil(ن÷(1−ن)×العمال)</td><td>%d</td><td>%d</td></tr>' % (TECH_NEED, ENG_NEED)
h += '<tr><td>تكلفة السعودي الواحد (راتب + تأمينات صاحب العمل 12.75%% والموظف 10.75%% على 85%% + نهاية الخدمة ÷24 + إجازة)</td><td>%s</td><td>%s</td></tr>' % (f(TECH_ONE), f(ENG_ONE))
h += '<tr><td>رسم التوطين للعامل شهرياً (بدل 900)</td><td>%s</td><td>%s</td></tr>' % (f(TECH_FEE), f(ENG_FEE))
h += '<tr><td>السعر العادي للعامل (راتب 3,000)</td><td>%s</td><td>%s (راتب مفترض 3,000)</td></tr>' % ("{:,}".format(PRICE_TECHDEC), "{:,}".format(PRICE_ENG))
h += '<tr><td>سعر المصنع (ناقص 800)</td><td>%s</td><td>%s</td></tr></table>' % ("{:,}".format(PRICE_TECHDEC_F), "{:,}".format(PRICE_ENG_F))
h += '<h2>نقل الكفالة</h2><p>رسم حكومي بالتكلفة: 2,000 للأول (مشمول في السعر ÷ 24 = 83.33 شهرياً)، 4,000 للثاني، 6,000 من الثالث، والزيادة عن 2,000 تُفوتَر بالتكلفة. 105 عمال كلهم نقل أول = 210,000 موزعة داخل السعر.</p>'
h += '<h2>مفتوح</h2><ul><li>مدة العقد المعتمدة (24 شهراً افتراضاً) والضمان والاستبدال.</li><li>الترخيص: بترخيصنا أم عبر شريك مرخّص (القانونية).</li><li>المهن التي عليها قرار توطين (فنية/هندسية) تُسعَّر على حدة بحسب النسبة.</li></ul></body></html>'
open("costing.html", "w", encoding="utf8").write(h)
