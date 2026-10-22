import os, html, json, re
esc = lambda s: html.escape(s, quote=False)
LOGO = '/_blob/3e3c443e48f3d61a03ccc1d0b1bf30fb'
OUT = 'outp/project/'
os.makedirs(OUT, exist_ok=True)
FOOT = '<span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>www.businesspartner.sa · Riyadh · RHSC2978</span>'

HEAD = '''<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8">
<title>%s</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Playfair+Display:wght@700&display=swap">
<style>
body{margin:0}
.ln{border-bottom:2px solid #9DB0D8;height:28px}
</style>
</helmet>
'''
TAIL = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1920,"height":1080}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
'''

CLIENT_EN = '[CLIENT NAME]'
CLIENT_AR = '[اسم الشركة]'

# ---------- content ----------
# each text = (en, ar)
S = []

S.append(dict(
    key='cover', tag='PROPOSAL · 21 OCT 2026',
    kind='cover',
    title=('Employer of Record and Employee Transfer Services in Saudi Arabia',
           'خدمات نظام التعاقد ونقل خدمات الموظفين في المملكة'),
    sub=('We transfer your team\'s services through Qiwa, regularise their status and handle payroll, insurance and localisation.',
         'ننقل خدمات فريقك عبر منصة قوى، ونضبط وضعهم النظامي، ونتولى الرواتب والتأمين والتوطين.'),
    meta=(f'Prepared for: {CLIENT_EN}<br>Mixed Norwegian–Saudi company, under formation<br>Valid for 30 days',
          f'مُعَدّ لشركة {CLIENT_AR}<br>شركة مختلطة نرويجية سعودية تحت التأسيس<br>صالح لمدة 30 يوماً'),
))

S.append(dict(
    key='scope', tag='01 · SCOPE', kind='cards', cols=3,
    title=('What we do for you', 'ماذا نفعل لك'),
    cards=[
        dict(dark=True, t=('Electronic transfer through Qiwa', 'نقل إلكتروني عبر قوى'),
             b=('We transfer each employee\'s services to Business Partner through the Qiwa platform. The whole process is electronic, from the transfer request to the employment contract.',
                'ننقل خدمات كل موظف إليها عبر منصة قوى. والعملية كلها إلكترونية، من طلب النقل إلى عقد العمل.')),
        dict(dark=False, t=('Legal status', 'الوضع النظامي'),
             b=('Residency, work permits, medical and social insurance, authorisations, employment contracts, and any embassy papers.',
                'الإقامة ورخص العمل والتأمين الطبي والتأمينات الاجتماعية والتفويضات وعقود العمل وأوراق السفارات.')),
        dict(dark=False, t=('Localisation and payroll', 'التوطين والرواتب'),
             b=('Localisation by profession as required by the Ministry\'s procedural guides, monthly payroll, end-of-service and leave.',
                'التوطين بحسب المهنة كما تقتضيه الأدلة الإجرائية للوزارة، والرواتب الشهرية ونهاية الخدمة والإجازات.')),
    ],
    note=('Your team in this transfer: 5 employees, expected to grow to 30+ within six months. Minimum contract term: 12 months, renewable.',
          'فريقك في هذا النقل: 5 موظفين، ويصل إلى أكثر من 30 خلال ستة أشهر. مدة العقد 12 شهراً كحد أدنى وتتجدد.'),
))

S.append(dict(
    key='roles', tag='02 · WHO PROVIDES WHAT', kind='checklist',
    title=('Who provides what', 'من يتحمل ماذا'),
    left=(('Business Partner provides', 'تتحملها Business Partner'),
          [('Medical insurance', 'التأمين الطبي'),
           ('Work permit', 'رخصة العمل'),
           ('Residency (Iqama)', 'الإقامة'),
           ('Sponsorship transfer or visa issuance fees', 'رسوم نقل الكفالة أو إصدار التأشيرة'),
           ('Completion of all procedures', 'إنهاء الإجراءات'),
           ('Recruitment from abroad, when needed', 'الاستقدام من الخارج عند اللزوم'),
           ('Authorisations, employment contracts and embassy documents', 'التفويضات وعقود العمل وأوراق السفارات والمستندات'),
           ('Social insurance', 'التأمينات الاجتماعية'),
           ('End of service and leave', 'نهاية الخدمة والإجازات'),
           ('Localisation, by profession', 'التوطين بحسب المهنة')]),
    right=(('The Company provides', 'يتحملها العميل'),
           [('Housing', 'السكن'),
            ('Transport', 'المواصلات'),
            ('Food allowance', 'بدل الطعام')]),
))

S.append(dict(
    key='local', tag='03 · LOCALISATION', kind='local4',
    title=('Localisation fee by profession or activity', 'رسوم التوطين بحسب المهنة أو النشاط'),
    intro=('Each profession has its own localisation ratio and minimum Saudi salary in the Ministry\'s procedural guide. The higher the ratio, the higher our monthly fee per employee.',
           'لكل مهنة نسبة توطين وحد أدنى لأجر السعودي في الدليل الإجرائي للوزارة. وكلما ارتفعت النسبة ارتفع رسمنا الشهري لكل موظف.'),
    rows=[
        (('Standard professions', 'المهن العادية'), ('No localisation decision', 'بلا قرار توطين'), ('—', '—'), 'SAR 500', 'SAR 575'),
        (('Administrative', 'الإدارية'),
         ('Purchasing 70% · Sales 60% · Marketing 60% · Accounting 40% rising to 70%', 'المشتريات 70% · المبيعات 60% · التسويق 60% · المحاسبة 40% وتصل إلى 70%'),
         ('Marketing SAR 5,500 · Accounting SAR 6,000 (bachelor) or 4,500 (diploma) · Purchasing and sales: none stated', 'التسويق 5,500 · المحاسبة 6,000 (بكالوريوس) أو 4,500 (دبلوم) · المشتريات والمبيعات: لا حد منصوص'),
         'SAR 2,000', 'SAR 2,300'),
        (('Technical', 'الفنية'), ('30%', '30%'), ('SAR 5,000', '5,000 ريال'), 'SAR 1,500', 'SAR 1,725'),
        (('Engineering', 'الهندسية'), ('30%', '30%'), ('SAR 8,000', '8,000 ريال'), 'SAR 3,000', 'SAR 3,450'),
    ],
    note=('Prices exclude VAT. A Saudi employee paid below the minimum salary is not counted toward the ratio. Professions restricted to Saudi nationals (human resources, secretarial, reception, customer service and similar) are not transferred to foreign employees. Ratios apply once the minimum number of employees in each guide is reached.',
          'الأسعار قبل الضريبة. والسعودي الذي يقل أجره عن الحد الأدنى لا يُحتسب ضمن النسبة. والمهن المقصورة على السعوديين (الموارد البشرية والسكرتارية والاستقبال وخدمة العملاء وما شابهها) لا يُنقل إليها أجنبي. وتسري النسب عند بلوغ الحد الأدنى للعاملين في كل دليل.'),
))

S.append(dict(
    key='calc', tag='04 · FOREIGN EMPLOYEE COST', kind='calc',
    title=('Foreign employee cost calculation', 'حسبة تكلفة الموظف الأجنبي'),
    intro=('Illustration on an assumed total salary of SAR 6,000 per month. Actual figures follow each employee\'s confirmed salary, age and profession.',
           'مثال توضيحي على راتب إجمالي مفترض 6,000 ريال شهرياً. والأرقام الفعلية تتبع راتب كل موظف المؤكد وعمره ومهنته.'),
    rows=[
        (('Salary', 'الراتب'), ('Assumed basic + housing + other allowances', 'افتراض: أساسي + سكن + بدلات'), '6,000.00'),
        (('Work permit and levy', 'رخصة العمل والمقابل المالي'), ('SAR 9,600 (levy) + 100 (permit) = SAR 9,700 per year ÷ 12', '9,600 (مقابل مالي) + 100 (رخصة) = 9,700 ريال سنوياً ÷ 12'), '808.33'),
        (('Residency (Iqama)', 'الإقامة'), ('SAR 650 per year ÷ 12', '650 ريالاً سنوياً ÷ 12'), '54.17'),
        (('Social insurance (foreign)', 'التأمينات الاجتماعية للأجنبي'), ('2% of basic salary + housing', '2% من الراتب الأساسي والسكن'), '120.00'),
        (('End of service', 'مكافأة نهاية الخدمة'), ('Labour Law: half a month per year for 5 years, then one month; monthly accrual = wage ÷ 24', 'نظام العمل: نصف شهر عن كل سنة لأول 5 سنوات ثم شهر؛ الاستحقاق الشهري = الأجر ÷ 24'), '250.00'),
        (('Subtotal', 'المجموع الفرعي'), ('Before the items below', 'قبل البنود التالية'), '7,232.50'),
        (('Medical insurance', 'التأمين الطبي'), ('Insurer quote by age, class and gender', 'حسب عرض شركة التأمين: العمر والفئة والجنس'), 'Per quote|حسب العرض'),
        (('Transfer, visa and recruitment fees', 'رسوم النقل والتأشيرة والاستقدام'), ('Actual fee ÷ contract months (min 12)', 'الرسم الفعلي ÷ أشهر العقد (12 كحد أدنى)'), 'Actual|فعلي'),
        (('Localisation fee', 'رسم التوطين'), ('By profession or activity: previous page', 'بحسب المهنة أو النشاط: الصفحة السابقة'), 'SAR 500–3,000'),
    ],
    note=('Model 1 invoices the official items at actual cost, separately and without VAT. Model 2 includes them in one monthly price, and the localisation fee is added on top by profession. <b>Price calculators, one Excel file: both models for 6 / 12 / 24 months, and localisation by profession and by activity:</b> <a href="https://drive.google.com/file/d/1QUmP9EfoscToq1OpkenaTfFvfE0TpfI_/view" style="color:#13246E">Open the calculator</a>',
          'النموذج الأول يفوتر البنود الرسمية بالتكلفة الفعلية منفصلة وبلا ضريبة. والنموذج الثاني يضمّها في سعر شهري واحد، ويُضاف رسم التوطين فوقه بحسب المهنة. <b>حاسبات الأسعار في ملف إكسل واحد: النموذجان على 6 / 12 / 24 شهراً، والتوطين بالمهنة وبالنشاط:</b> <a href="https://drive.google.com/file/d/1QUmP9EfoscToq1OpkenaTfFvfE0TpfI_/view" style="color:#13246E">افتح الحاسبة</a>'),
))

S.append(dict(
    key='model1', tag='05 · MODEL 1 · COST PLUS', kind='cards', cols=2,
    title=('Model 1: Cost plus', 'النموذج الأول: التكلفة زائد'),
    cards=[
        dict(compact=True, dark=True, t=('Our fee', 'رسمنا'),
             b=('The monthly localisation fee per employee shown on the previous page, plus 15% VAT. Government fees carry no VAT.',
                'رسم التوطين الشهري لكل موظف الموضح في الصفحة السابقة، مع ضريبة 15%. أما الرسوم الحكومية فلا ضريبة عليها.')),
        dict(compact=True, dark=False, t=('Costs at actual cost', 'التكاليف بالتكلفة الفعلية'),
             b=('You transfer each cost when we request it: sponsorship transfer fee, medical insurance, work permit, residency, leave pay, flight and exit and re-entry tickets, external recruitment, contracts and attestation, arrival ticket and other official fees. Each is invoiced separately at actual cost; government fees carry no VAT.',
                'تحوّل لنا كل تكلفة عند طلبها: رسوم نقل الكفالة، والتأمين الطبي، ورخصة العمل، والإقامة، وبدل الإجازة، وتذاكر الطيران والخروج والعودة، والاستقدام من الخارج، والعقود والتصديق، وتذكرة القدوم، وغيرها من الرسوم الرسمية. وكل واحدة بفاتورة منفصلة بالتكلفة الفعلية، والرسوم الحكومية بلا ضريبة.')),
        dict(compact=True, dark=False, t=('Work permit and residency', 'رخصة العمل والإقامة'),
             b=('Currently SAR 9,700 per year for the work permit and levy, and SAR 650 per year for residency (Jawazat). Each is paid in four quarterly instalments, per the official schedule in force at the time of payment.',
                'حالياً 9,700 ريال سنوياً لرخصة العمل والمقابل المالي، و650 ريالاً سنوياً للإقامة (الجوازات). وكل منهما على أربع دفعات ربع سنوية، وفق الجداول الرسمية السارية وقت السداد.')),
        dict(compact=True, dark=False, t=('Sponsorship transfer and visa fees', 'رسوم نقل الكفالة والتأشيرة'),
             b=('Spread over the contract term (minimum 12 months), so the monthly share depends on the term you choose.',
                'تُقسَّم على مدة العقد (12 شهراً كحد أدنى)، فالحصة الشهرية تتغير بحسب المدة التي تختارها.')),
    ],
    note=('', ''),
))

import math
def _lump(a, n):
    c = (a + (9700 + 650 + 240) / 12 + 600 / 12 + (a / 30 * 21) / 12 + 200 / 12 + 3000 / n + a / 2 / 12 + a * 0.02 + 1500 / 12 + 2000 / n + 1000) * 1.1
    return int(math.floor(c / 10 + 0.5) * 10)
S.append(dict(
    key='model2', tag='06 · MODEL 2 · LUMP SUM', kind='lump',
    title=('Model 2: Lump sum', 'النموذج الثاني: مبلغ مقطوع'),
    intro=('One fixed monthly price for each employee, by total monthly package and contract term. It covers salary and allowances, work permit and levy, residency, medical and social insurance, end of service, leave pay, flight and exit and re-entry tickets, and transfer and visa fees. The longer the term, the lower the monthly price, because one-off fees are spread over more months.',
           'سعر شهري ثابت لكل موظف بحسب إجمالي الراتب الشهري ومدة العقد. يشمل الراتب والبدلات، ورخصة العمل والمقابل المالي، والإقامة، والتأمين الطبي والاجتماعي، ونهاية الخدمة، وبدل الإجازة، وتذاكر الطيران والخروج والعودة، ورسوم النقل والتأشيرة. وكلما طالت المدة انخفض السعر الشهري لأن الرسوم لمرة واحدة تتوزع على أشهر أكثر.'),
    rows=[((f'SAR {a:,}', f'{a:,} ريال'), f'{_lump(a,6):,}', f'{_lump(a,12):,}', f'{_lump(a,24):,}') for a in (3000, 4000, 5000, 6000, 7000, 8000, 10000)],
    note=('Monthly price per employee in SAR, excluding VAT (15% VAT added). The localisation fee is added on top by each profession (page 4). Applies to: Engineer (Yemeni, Indian, Jordanian) and Sales (Yemeni, Indian). The Saudi human resources officer is not part of the transfer: he joins through a licensed assignment on the Ajeer platform or direct hiring by your company. You pay two months in advance. Use the calculator for any other salary or term.',
          'السعر الشهري لكل موظف بالريال قبل الضريبة (تُضاف 15%). ويُضاف رسم التوطين فوقه بحسب كل مهنة (الصفحة 4). ينطبق على: مهندس (يمني، هندي، أردني) ومبيعات (يمني، هندي). وموظف الموارد البشرية السعودي ليس ضمن النقل: يكون بإسناد من جهة مرخّصة عبر منصة أجير أو بتوظيف مباشر لدى شركتكم. تدفع شهرين مقدماً. وللرواتب والمدد الأخرى استعمل الحاسبة.'),
))

S.append(dict(
    key='payment', tag='07 · TERMS & NEXT STEPS', kind='cards', cols=2,
    title=('Terms and next steps', 'الشروط والخطوات التالية'),
    cards=[
        dict(dark=True, t=('Term and payment', 'المدة والدفع'),
             b=('Minimum term 12 months, renewable. Two months paid in advance. Monthly invoices are payable within 7 days. Prices are valid for 30 days.',
                'المدة 12 شهراً كحد أدنى وتتجدد. وشهران مقدماً. والفواتير الشهرية تُسدَّد خلال 7 أيام. والأسعار صالحة 30 يوماً.')),
        dict(dark=False, t=('Next steps', 'الخطوات التالية'),
             b=('1) Sign the NDA. 2) Choose Model 1 or Model 2 and sign this proposal. 3) Send the employee data. 4) We send the Services Agreement and start the Qiwa transfers.',
                '1) توقيع اتفاقية عدم الإفصاح. 2) اختيار النموذج الأول أو الثاني وتوقيع هذا العرض. 3) إرسال بيانات الموظفين. 4) نرسل عقد الخدمات ونبدأ نقل الخدمات عبر قوى.')),
    ],
    note=('Employee salaries are paid through payroll under the chosen model. Housing, transport and food allowance are provided by the Company.',
          'رواتب الموظفين تُدفع عبر الرواتب وفق النموذج المختار. والسكن والمواصلات وبدل الطعام على الشركة.'),
))

S.append(dict(
    key='accept', tag='08 · ACCEPTANCE', kind='accept',
    title=('Acceptance', 'القبول'),
))


# ---------- rendering ----------
def hdr(tag, mode):
    if mode == 'ar':
        return f'''<div style="display:flex;justify-content:space-between;align-items:center;height:70px;direction:ltr">
<div style="font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:22px;color:#6A7596;letter-spacing:.06em">{tag}</div>
<div style="background:#fff;border-radius:14px;padding:10px 22px;display:flex;border:2px solid #DDE1EE"><img src="{LOGO}" alt="Business Partner" style="height:46px"></div>
</div>'''
    return f'''<div style="display:flex;justify-content:space-between;align-items:center;height:70px">
<div style="background:#fff;border-radius:14px;padding:10px 22px;display:flex;border:2px solid #DDE1EE"><img src="{LOGO}" alt="Business Partner" style="height:46px"></div>
<div style="font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:22px;color:#6A7596;letter-spacing:.06em">{tag}</div>
</div>'''


def page(inner, mode, cover=False):
    bg = 'linear-gradient(135deg,#071442,#0B1B5A);color:#fff' if cover else '#F7F8FD;color:#1B2340'
    d = ';direction:rtl;text-align:right' if mode == 'ar' else ''
    return f'''<div style="width:1920px;height:1080px;box-sizing:border-box;padding:70px 90px 60px;display:flex;flex-direction:column;background:{bg};font-family:'IBM Plex Sans Arabic',sans-serif{d}">
{inner}
<div style="margin-top:auto;display:flex;justify-content:space-between;font-size:19px;color:{'#9DB4FF' if cover else '#6A7596'};border-top:2px solid {'#9DB4FF' if cover else '#0B1B5A'};padding-top:14px;direction:ltr">{FOOT}</div>
</div>
'''


def h2(t, mode):
    en = f'<h2 style="margin:0;font-family:\'Playfair Display\',serif;font-weight:700;font-size:{54 if mode=="bi" else 62}px;line-height:1.2;color:#0B1B5A;direction:ltr;text-align:left">{esc(t[0])}</h2>'
    ar = f'<h2 style="margin:0;font-weight:700;font-size:{56 if mode=="bi" else 64}px;line-height:1.2;color:#0B1B5A;direction:rtl;text-align:right">{esc(t[1])}</h2>'
    if mode == 'bi':
        return f'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:60px;margin-top:34px">{en}{ar}</div>'
    return f'<div style="margin-top:34px">{ar if mode=="ar" else en}</div>'


def txt(pair, mode, sizes, colors, bold=False):
    """pair=(en,ar). sizes=(en_px,ar_px). colors=(en,ar)."""
    w = 'font-weight:700;' if bold else ''
    en = f'<div style="direction:ltr;text-align:left;{w}font-size:{sizes[0]}px;line-height:1.5;color:{colors[0]}">{pair[0]}</div>'
    ar = f'<div style="direction:rtl;text-align:right;{w}font-size:{sizes[1]}px;line-height:1.55;color:{colors[1]}">{pair[1]}</div>'
    if mode == 'bi': return ar + en
    return ar if mode == 'ar' else en


def card(c, mode, cols):
    dark = c['dark']
    bg = '#0B1B5A' if dark else '#fff;border:2px solid #DDE1EE'
    tcol = ('#9DB4FF', '#fff') if dark else ('#13246E', '#0B1B5A')
    bcol = ('#9DB4FF', '#C9D5FF') if dark else ('#6A7596', '#4A5578')
    ts = (34, 42) if mode == 'bi' else (40, 44)
    bs = (24, 29) if mode == 'bi' else (30, 32)
    if cols >= 4:
        ts = (28, 34) if mode == 'bi' else (34, 38); bs = (21, 25) if mode == 'bi' else (27, 29)
    elif cols == 3:
        ts = (30, 36) if mode == 'bi' else (36, 40); bs = (22, 26) if mode == 'bi' else (28, 30)
    if c.get('compact'):
        ts = (26, 32) if mode == 'bi' else (30, 36); bs = (19, 23) if mode == 'bi' else (24, 27)
    return f'''<div style="background:{bg};border-radius:22px;padding:{22 if c.get('compact') else 30}px 34px;display:flex;flex-direction:column;gap:{8 if c.get('compact') else 12}px">
{txt(c['t'], mode, ts, tcol, True)}
{txt(c['b'], mode, bs, bcol)}
</div>'''


def note(pair, mode, mt=22):
    en = f'<p style="margin:{mt}px 0 0;direction:ltr;text-align:left;font-size:{20 if mode=="bi" else 25}px;line-height:1.5;color:#6A7596">{pair[0]}</p>'
    ar = f'<p style="margin:{mt}px 0 0;direction:rtl;text-align:right;font-size:{22 if mode=="bi" else 27}px;line-height:1.5;color:#4A5578">{pair[1]}</p>'
    if mode == 'bi': return ar + en.replace(f'margin:{mt}px 0 0', 'margin:8px 0 0')
    return ar if mode == 'ar' else en


def render(s, mode):
    k = s['kind']
    if k == 'cover':
        t, sub, meta = s['title'], s['sub'], s['meta']
        en = f'''<div style="margin-top:56px;direction:ltr;text-align:left">
<h2 style="margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:{56 if mode=="bi" else 76}px;line-height:1.2">{esc(t[0])}</h2>
<p style="margin:12px 0 0;font-size:{28 if mode=="bi" else 34}px;line-height:1.5;color:#C9D5FF">{esc(sub[0])}</p>
</div>'''
        ar = f'''<div style="margin-top:{130 if mode!="bi" else 110}px;direction:rtl;text-align:right">
<h1 style="margin:0;font-size:{72 if mode=="bi" else 88}px;line-height:1.25;font-weight:700">{esc(t[1])}</h1>
<p style="margin:26px 0 0;font-size:{34}px;line-height:1.5;color:#C9D5FF">{esc(sub[1])}</p>
</div>'''
        if mode == 'bi':
            body = ar + en
            m = f'''<div style="margin-top:64px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:60px;font-size:28px;line-height:1.6;color:#C9D5FF">
<div style="direction:ltr;text-align:left">{meta[0]}</div><div style="direction:rtl;text-align:right">{meta[1]}</div></div>'''
        elif mode == 'ar':
            body = ar.replace('margin-top:130px', 'margin-top:190px')
            m = f'<div style="margin-top:80px;direction:rtl;text-align:right;font-size:30px;line-height:1.6;color:#C9D5FF">{meta[1]}</div>'
        else:
            body = en.replace('margin-top:56px', 'margin-top:190px')
            m = f'<div style="margin-top:80px;direction:ltr;text-align:left;font-size:30px;line-height:1.6;color:#C9D5FF">{meta[0]}</div>'
        hd = hdr(s['tag'], mode).replace('color:#6A7596', 'color:#9DB4FF').replace('border:2px solid #DDE1EE', '')
        return page(hd + body + m, mode, cover=True)
    inner = hdr(s['tag'], mode) + h2(s['title'], mode)
    if k == 'cards':
        n = s['cols']
        inner += f'<div style="display:grid;grid-template-columns:repeat({n},minmax(0,1fr));column-gap:26px;margin-top:34px;align-items:start">' + ''.join(card(c, mode, n) for c in s['cards']) + '</div>'
        if s['note'][0]: inner += note(s['note'], mode, 28)
    elif k == 'local4':
        inner += '<div style="margin-top:12px">' + note(s['intro'], mode, 4) + '</div>'
        fs = 19 if mode == 'bi' else 25
        def L(pair, size=None, bold=False, color='#0B1B5A'):
            size = size or fs
            w = 'font-weight:700;' if bold else ''
            en = f'<div style="direction:ltr;text-align:left;font-size:{size}px;line-height:1.35;color:{color};{w}">{esc(pair[0])}</div>'
            ar = f'<div style="direction:rtl;text-align:right;font-size:{size+2}px;line-height:1.4;color:{color};{w}">{esc(pair[1])}</div>'
            if mode == 'bi' and pair[0] == pair[1]: return '<div>' + ar + '</div>'
            return '<div>' + ((ar + en) if mode == 'bi' else (ar if mode == 'ar' else en)) + '</div>'
        cols = 'minmax(0,0.8fr) minmax(0,1.5fr) minmax(0,1.7fr) 150px 150px'
        d = 'rtl' if mode == 'ar' else 'ltr'
        heads = (('Category', 'الفئة'), ('Ratio', 'النسبة'), ('Minimum Saudi salary', 'الحد الأدنى لأجر السعودي'), ('Fee / month', 'الرسم شهرياً'), ('Incl. 15% VAT', 'شامل ضريبة 15%'))
        h = ''.join(f'<div style="color:#fff;font-size:{fs-1}px;{"text-align:center;" if i>=3 else ""}">{L(hp, fs-1, True, "#fff")}</div>' for i, hp in enumerate(heads))
        hrow = f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:14px 22px;background:#0B1B5A;direction:{d}">{h}</div>'
        body = ''
        for r in s['rows']:
            val = lambda v: f'<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:center;font-size:{fs+3}px;color:#0B1B5A">{esc(v)}</div>'
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:9px 22px;background:#fff;border-bottom:2px solid #DDE1EE;direction:{d}">{L(r[0], fs+1, True)}{L(r[1], fs, False, "#1B2340")}{L(r[2], fs, False, "#1B2340")}{val(r[3])}{val(r[4])}</div>'
        inner += f'<div style="margin-top:10px;flex-shrink:0;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{hrow}{body}</div>'
        inner += note(s['note'], mode, 10)
    elif k == 'calc':
        inner += '<div style="margin-top:12px">' + note(s['intro'], mode, 4) + '</div>'
        fs = 15 if mode == 'bi' else 21
        def L(pair, size, bold=False, color='#0B1B5A'):
            w = 'font-weight:700;' if bold else ''
            en = f'<div style="direction:ltr;text-align:left;font-size:{size}px;line-height:1.2;color:{color};{w}">{esc(pair[0])}</div>'
            ar = f'<div style="direction:rtl;text-align:right;font-size:{size+2}px;line-height:1.35;color:{color};{w}">{esc(pair[1])}</div>'
            return '<div>' + ((ar + en) if mode == 'bi' else (ar if mode == 'ar' else en)) + '</div>'
        cols = 'minmax(0,0.9fr) minmax(0,1.9fr) 230px'
        d = 'rtl' if mode == 'ar' else 'ltr'
        heads = (('Item', 'البند'), ('Basis', 'الأساس'), ('SAR / month', 'ريال شهرياً'))
        h = ''.join(f'<div style="{"text-align:center;" if i==2 else ""}">{L(hp, fs-1, True, "#fff")}</div>' for i, hp in enumerate(heads))
        body = f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:8px 22px;background:#0B1B5A;direction:{d}">{h}</div>'
        for r in s['rows']:
            sub = r[0][0] == 'Subtotal'
            bg = '#EEF2FF' if sub else '#fff'
            v = r[2].split('|')
            if len(v) == 2 and mode == 'ar': vt = v[1]
            elif len(v) == 2 and mode == 'en': vt = v[0]
            elif len(v) == 2: vt = v[0] + ' / ' + v[1]
            else: vt = v[0]
            vfs = fs + 2 if len(v) == 1 else fs - 1
            val = f'<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:{700 if sub else 500};direction:ltr;text-align:center;font-size:{vfs}px;color:#0B1B5A">{esc(vt)}</div>'
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:2px 22px;background:{bg};border-bottom:2px solid #DDE1EE;direction:{d}">{L(r[0], fs+1, True)}{L(r[1], fs-1, False, "#1B2340")}{val}</div>'
        inner += f'<div style="margin-top:10px;flex-shrink:0;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{body}</div>'
        inner += note(s['note'], mode, 10)
    elif k == 'lump':
        inner += '<div style="margin-top:12px">' + note(s['intro'], mode, 4) + '</div>'
        fs = 18 if mode == 'bi' else 24
        def L(pair, size, bold=False, color='#0B1B5A', c=False):
            w = 'font-weight:700;' if bold else ''
            en = f'<div style="direction:ltr;text-align:{"center" if c else "left"};font-size:{size}px;line-height:1.25;color:{color};{w}">{esc(pair[0])}</div>'
            ar = f'<div style="direction:rtl;text-align:{"center" if c else "right"};font-size:{size+2}px;line-height:1.3;color:{color};{w}">{esc(pair[1])}</div>'
            return '<div>' + ((ar + en) if mode == 'bi' else (ar if mode == 'ar' else en)) + '</div>'
        cols = 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)'
        d = 'rtl' if mode == 'ar' else 'ltr'
        heads = (('Total monthly package', 'إجمالي الراتب الشهري'), ('6 months', '6 أشهر'), ('12 months', '12 شهراً'), ('24 months', '24 شهراً'))
        h = ''.join(f'<div style="{"text-align:center;" if i else ""}">{L(hp, fs, True, "#fff", c=bool(i))}</div>' for i, hp in enumerate(heads))
        body = f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:10px 24px;background:#0B1B5A;direction:{d}">{h}</div>'
        for i, r in enumerate(s['rows']):
            bg = '#EEF2FF' if r[0][0] == 'SAR 6,000' else '#fff'
            val = lambda v: f'<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:center;font-size:{fs+4}px;color:#0B1B5A">{esc(v)}</div>'
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:4px 24px;background:{bg};border-bottom:2px solid #DDE1EE;direction:{d}">{L(r[0], fs+1, True)}{val(r[1])}{val(r[2])}{val(r[3])}</div>'
        inner += f'<div style="margin-top:10px;flex-shrink:0;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{body}</div>'
        inner += note(s['note'], mode, 10)
    elif k in ('table','table4'):
        inner += '<div style="margin-top:18px">' + note(s['intro'], mode, 6) + '</div>'
        hd = s['head']
        def row(a, b, c, header=False):
            bgc = '#0B1B5A' if header else '#fff'
            col = '#fff' if header else '#0B1B5A'
            fs = 27 if mode != 'bi' else 23
            lab_en = f'<div style="direction:ltr;text-align:left;font-size:{fs}px;color:{col}">{esc(a[0])}</div>'
            lab_ar = f'<div style="direction:rtl;text-align:right;font-size:{fs+2}px;color:{col};font-weight:{700 if header else 600}">{esc(a[1])}</div>'
            val = lambda v: f'<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:center;font-size:{fs}px;color:{col}">{esc(v)}</div>'
            if mode == 'bi':
                return f'<div style="display:grid;grid-template-columns:minmax(0,1.1fr) 250px 250px minmax(0,1fr);column-gap:14px;align-items:center;padding:3px 22px;background:{bgc};border-bottom:2px solid #DDE1EE">{lab_en}{val(b if not header else b[0])}{val(c if not header else c[0])}{lab_ar}</div>'
            lab = lab_ar if mode == 'ar' else lab_en
            return f'<div style="display:grid;grid-template-columns:minmax(0,1.2fr) 330px 330px;column-gap:14px;align-items:center;padding:10px 24px;background:{bgc};border-bottom:2px solid #DDE1EE;direction:{"rtl" if mode=="ar" else "ltr"}">{lab}{val(b if not header else b[1 if mode=="ar" else 0])}{val(c if not header else c[1 if mode=="ar" else 0])}</div>'
        # header row: head=((en0,en1,en2),(ar0,ar1,ar2))
        if mode == 'bi':
            hrow = f'<div style="display:grid;grid-template-columns:minmax(0,1.1fr) 250px 250px minmax(0,1fr);column-gap:14px;align-items:center;padding:16px 22px;background:#0B1B5A;border-radius:18px 18px 0 0;color:#fff"><div style="direction:ltr;text-align:left;font-size:22px">{esc(hd[0][0])}</div><div style="direction:ltr;text-align:center;font-size:20px">{esc(hd[0][1])}</div><div style="direction:ltr;text-align:center;font-size:20px">{esc(hd[0][2])}</div><div style="direction:rtl;text-align:right;font-size:24px;font-weight:700">{esc(hd[1][0])}</div></div>'
            sub2 = f'<div style="display:grid;grid-template-columns:minmax(0,1.1fr) 250px 250px minmax(0,1fr);column-gap:14px;padding:0 22px 8px;background:#0B1B5A;color:#9DB4FF;font-size:20px"><div></div><div style="direction:rtl;text-align:center">{esc(hd[1][1])}</div><div style="direction:rtl;text-align:center">{esc(hd[1][2])}</div><div></div></div>'
            hrow += sub2
        else:
            i = 1 if mode == 'ar' else 0
            hrow = f'<div style="display:grid;grid-template-columns:minmax(0,1.2fr) 330px 330px;column-gap:14px;align-items:center;padding:18px 24px;background:#0B1B5A;border-radius:18px 18px 0 0;color:#fff;font-size:24px;direction:{"rtl" if mode=="ar" else "ltr"};{"font-weight:700;" if mode=="ar" else ""}"><div>{esc(hd[i][0])}</div><div style="text-align:center">{esc(hd[i][1])}</div><div style="text-align:center">{esc(hd[i][2])}</div></div>'
        rows = ''.join(row(r[0], r[1], r[2]) for r in s['rows'])
        inner += f'<div style="margin-top:22px;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{hrow}{rows}</div>'
        inner += note(s['note'], mode, 22)
    elif k == 'checklist':
        def col(c, dark):
            title, items = c
            bg = '#0B1B5A' if dark else '#fff;border:2px solid #DDE1EE'
            tcol = ('#9DB4FF', '#fff') if dark else ('#13246E', '#0B1B5A')
            icol = ('#9DB4FF', '#C9D5FF') if dark else ('#6A7596', '#1B2340')
            lines = ''
            for en, ar in items:
                if mode == 'bi':
                    lines += f'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:18px;padding:5px 0;border-top:1px solid {"#2B3F8A" if dark else "#E6E9F3"}"><div style="direction:ltr;text-align:left;font-size:20px;color:{icol[0]}">✓ {esc(en)}</div><div style="direction:rtl;text-align:right;font-size:22px;color:{icol[1]}">{esc(ar)} ✓</div></div>'
                else:
                    t = ar if mode == 'ar' else en
                    lines += f'<div style="padding:7px 0;border-top:1px solid {"#2B3F8A" if dark else "#E6E9F3"};direction:{"rtl" if mode=="ar" else "ltr"};text-align:{"right" if mode=="ar" else "left"};font-size:{27 if mode=="ar" else 25}px;color:{icol[1] if mode=="ar" else icol[1]}">✓ {esc(t)}</div>'
            return f'<div style="background:{bg};border-radius:22px;padding:24px 30px;display:flex;flex-direction:column;gap:4px">{txt(title, mode, (30, 36), tcol, True)}{lines}</div>'
        inner += '<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);column-gap:28px;margin-top:22px;align-items:start">' + col(s['left'], True) + col(s['right'], False) + '</div>'
    elif k == 'accept':
        L = lambda t: f'<div style="font-size:24px;color:#6A7596;margin-top:8px">{t}</div><div class="ln"></div>'
        blocks = []
        for dark, ti, body in (
            (True, ('Acceptance of proposal', 'قبول العرض'),
             (f'In acceptance of this proposal, for and on behalf of {CLIENT_EN}. Model chosen: ☐ Model 1 (Cost plus)  ☐ Model 2 (All-inclusive). Name and title: ________________',
              f'بالقبول بهذا العرض نيابةً عن شركة {CLIENT_AR}. النموذج المختار: ☐ الأول (تكلفة زائد)  ☐ الثاني (شامل). الاسم والصفة: ________________')),
            (False, ('For Business Partner Solutions', 'عن شركة بزنس بارتنر سلوشنز'),
             ('Baher Magnas, Business Development Manager. Signature and stamp: ________________',
              'باهر ماغناس، مدير تطوير الأعمال. التوقيع والختم: ________________'))):
            tcol = ('#9DB4FF', '#fff') if dark else ('#13246E', '#0B1B5A')
            bcol = ('#9DB4FF', '#C9D5FF') if dark else ('#6A7596', '#4A5578')
            bg = '#0B1B5A' if dark else '#fff;border:2px solid #DDE1EE'
            sig = '<div style="direction:ltr;text-align:left;font-size:22px;color:#9DB4FF;margin-top:18px">Date and signature &amp; stamp</div><div class="ln" style="height:52px"></div>' if dark else ''
            blocks.append(f'<div style="background:{bg};border-radius:22px;padding:30px 38px;display:flex;flex-direction:column;gap:12px">{txt(ti, mode, (32,40), tcol, True)}{txt(body, mode, (24,28), bcol)}{sig if mode!="ar" else ""}</div>')
        inner += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:34px;margin-top:34px;align-items:start">' + ''.join(blocks) + '</div>'
        inner += note(('A signed copy of this proposal and the Non-Disclosure Agreement are required before we send the Services Agreement.',
                       'نحتاج نسخة موقعة من هذا العرض واتفاقية عدم الإفصاح قبل أن نرسل عقد الخدمات.'), mode, 28)
    return page(inner, mode)


NAMES = {  # key -> (bi, ar, en)
    'cover': ('Main', 'AR-1-Cover', 'EN-1-Cover'),
    'scope': ('Scope', 'AR-2-Scope', 'EN-2-Scope'),
    'roles': ('Roles', 'AR-3-Roles', 'EN-3-Roles'),
    'local': ('Local', 'AR-4-Local', 'EN-4-Local'),
    'calc': ('Calc', 'AR-5-Calc', 'EN-5-Calc'),
    'model1': ('Price', 'AR-6-Price', 'EN-6-Price'),
    'model2': ('Fees', 'AR-7-Fees', 'EN-7-Fees'),
    'payment': ('Next', 'AR-8-Next', 'EN-8-Next'),
    'accept': ('Accept', 'AR-9-Accept', 'EN-9-Accept'),
}
boards = {'bi': [], 'ar': [], 'en': []}
for s in S:
    for i, mode in enumerate(('bi', 'ar', 'en')):
        name = NAMES[s['key']][i]
        t = s['title'][1] if mode != 'en' else s['title'][0]
        content = HEAD % esc(t) + render(s, mode) + TAIL
        open(OUT + name + '.dc.html', 'w', encoding='utf8').write(content)
        boards[mode].append(name)
json.dump(boards, open('boards_prop.json', 'w'))
print({k: len(v) for k, v in boards.items()})
