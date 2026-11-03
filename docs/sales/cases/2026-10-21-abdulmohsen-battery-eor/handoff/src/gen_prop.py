import os, html, json, re
esc = lambda s: html.escape(s, quote=False)
LOGO = '/_blob/3e3c443e48f3d61a03ccc1d0b1bf30fb'
OUT = 'outp/project/'
os.makedirs(OUT, exist_ok=True)
FOOT = '<span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>www.businesspartner.sa · business@businesspartner.sa · 0530540231 · Ad Diriyah · RDAA9214</span>'

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
    key='local', tag='07 · LOCALISATION FEE', kind='cards', cols=3,
    title=('Localisation fee', 'رسوم التوطين'),
    cards=[
        dict(dark=True, t=('If you take Saudis through us', 'إذا أخذتَ معنا سعوديين'),
             b=('You take Saudis in return for the foreigners, for example Saudi engineers for the foreign engineers. You pay the salaries of both and <b>no localisation fee</b>.',
                'تأخذ سعوديين مقابل الأجانب، مثلاً مهندسين سعوديين مقابل المهندسين الأجانب. فتدفع رواتب الجميع و<b>لا رسوم توطين</b>.')),
        dict(dark=False, t=('If you do not take Saudis', 'إذا لم تأخذ سعوديين'),
             b=('We calculate the Saudi\'s cost on you. Profession with no localisation decision: a flat <b>SAR 900</b> per employee per month. Profession with a decision (engineering, technical and others in the guides): the cost of the Saudis the ratio requires, divided across your foreign employees.',
                'نحسب عليك تكلفة السعودي. مهنة بلا قرار توطين: <b>900 ريال</b> ثابتة لكل موظف شهرياً. ومهنة عليها قرار (الهندسية والفنية وغيرها في الأدلة): تكلفة السعوديين الذين تتطلبهم النسبة مقسومة على موظفيك الأجانب.')),
        dict(dark=False, t=('Saudi-only professions', 'مهن للسعوديين فقط'),
             b=('Human resources, administrative support, secretarial, reception, customer service and similar are reserved for Saudis by the guides. They are not transferred to foreign employees.',
                'الموارد البشرية والمهن الإدارية المساندة والسكرتارية والاستقبال وخدمة العملاء ونحوها مقصورة على السعوديين بحسب الأدلة. ولا تُنقل لموظفين أجانب.')),
    ],
    note=('Example: 3 foreign engineers (ratio 30%, minimum Saudi salary SAR 8,000) and no Saudi engineer: 2 Saudis are required, so the fee is SAR 6,930 per engineer per month. <b>To understand each case:</b> <a href="https://www.businesspartner.sa/calculators/profession-checker" style="color:#13246E">Profession checker</a> · <a href="https://www.businesspartner.sa/calculators/government-cost" style="color:#13246E">Government cost calculator</a>',
          'مثال: 3 مهندسين أجانب (نسبة 30% وأقل راتب للسعودي 8,000 ريال) بلا مهندس سعودي: يلزم سعوديان، فالرسوم 6,930 ريالاً لكل مهندس شهرياً. <b>لتفهم كل حالة:</b> <a href="https://www.businesspartner.sa/ar/calculators/profession-checker" style="color:#13246E">فاحص المهن</a> · <a href="https://www.businesspartner.sa/ar/calculators/government-cost" style="color:#13246E">حاسبة التكاليف الحكومية</a>'),
))

S.append(dict(
    key='calc', tag='09 · FOREIGN EMPLOYEE COST', kind='calc',
    title=('Foreign employee cost calculation', 'حسبة تكلفة الموظف الأجنبي'),
    intro=('Illustration on an assumed total salary of SAR 6,000 per month. Actual figures follow each employee\'s confirmed salary, age and profession.',
           'مثال توضيحي على راتب إجمالي مفترض 6,000 ريال شهرياً. والأرقام الفعلية تتبع راتب كل موظف المؤكد وعمره ومهنته.'),
    rows=[
        (('Salary', 'الراتب'), ('Assumed basic + housing + other allowances', 'افتراض: أساسي + سكن + بدلات'), '6,000.00'),
        (('Work permit and levy', 'رخصة العمل والمقابل المالي'), ('SAR 9,600 (levy) + 100 (permit) = SAR 9,700 per year ÷ 12', '9,600 (مقابل مالي) + 100 (رخصة) = 9,700 ريال سنوياً ÷ 12'), '808.33'),
        (('Residency (Iqama)', 'الإقامة'), ('SAR 650 per year ÷ 12', '650 ريالاً سنوياً ÷ 12'), '54.17'),
        (('Social insurance (foreign)', 'التأمينات الاجتماعية للأجنبي'), ('2% of basic salary + housing', '2% من الراتب الأساسي والسكن'), '120.00'),
        (('End of service', 'مكافأة نهاية الخدمة'), ('Labour Law arts. 84-87: half a month per year for 5 years, then one month; accrual = wage ÷ 24', 'نظام العمل م84-87: نصف شهر عن كل سنة لأول 5 سنوات ثم شهر؛ الاستحقاق = الأجر ÷ 24'), '250.00'),
        (('Subtotal', 'المجموع الفرعي'), ('Before the items below', 'قبل البنود التالية'), '7,232.50'),
        (('Medical insurance', 'التأمين الطبي'), ('Insurer quote by age, class and gender', 'حسب عرض شركة التأمين: العمر والفئة والجنس'), 'Per quote|حسب العرض'),
        (('Transfer, visa and recruitment fees', 'رسوم النقل والتأشيرة والاستقدام'), ('Paid in advance: transfer 2,000 / 4,000 / 6,000; recruitment at actual', 'تُدفع مقدماً: النقل 2,000 / 4,000 / 6,000؛ والاستقدام بالفعلي'), 'Advance|مقدماً'),
        (('Localisation fee', 'رسوم التوطين'), ('Flat SAR 900, or by localisation decision: page 8', 'ثابت 900 ريال، أو بحسب قرار التوطين: الصفحة 8'), 'SAR 900+|900+ ريال'),
    ],
    note=('Model 1 invoices each item separately at actual cost, with its own payment dates. Model 2 includes them in one monthly price, and the localisation fee is added on top by profession. <b>The calculator:</b> <a href="https://claude.ai/artifact/YEH7Ze1xybx9Wg1qCNqXLA" style="color:#13246E">open the calculator</a> to price each employee, check localisation and Nitaqat, and see the Saudi cost. It is also attached as ABM-Calculator.html.',
          'النموذج الأول يفوتر كل بند منفصلاً بالتكلفة الفعلية وله مواعيد دفعه. والنموذج الثاني يضمّها في سعر شهري واحد، وتُضاف رسوم التوطين فوقه بحسب المهنة. <b>الحاسبة:</b> <a href="https://claude.ai/artifact/YEH7Ze1xybx9Wg1qCNqXLA" style="color:#13246E">افتح الحاسبة</a> لتسعّر كل موظف وتفحص التوطين والنطاقات وترى تكلفة السعودي. وهي مرفقة أيضاً بالملف ABM-Calculator.html.'),
))

S.append(dict(
    key='models', tag='03 · TWO MODELS', kind='cards', cols=2,
    title=('Two ways to pay', 'طريقتان للدفع'),
    cards=[
        dict(dark=True, t=('Model 1 · Transparent cost', 'النموذج 1 · التكلفة بشفافية'),
             b=('You pay each real cost when it happens, plus our fixed <b>SAR 500</b> per employee per month and the localisation fee. Every item has its own invoice and date.',
                'تدفع كل تكلفة فعلية عند حدوثها، مع رسوم خدمتنا الثابتة <b>500 ريال</b> شهرياً لكل موظف ورسوم التوطين. ولكل بند فاتورته وموعده.')),
        dict(dark=False, t=('Model 2 · Full employee cost', 'النموذج 2 · تكلفة الموظف الكاملة'),
             b=('One fixed monthly price per employee. It already includes salary, permits, insurance, end of service and the one-off fees. The localisation fee is added on top.',
                'سعر شهري ثابت لكل موظف. يشمل الراتب والرخص والتأمين ونهاية الخدمة والرسوم لمرة واحدة. ويُضاف فوقه رسوم التوطين.')),
    ],
    note=('You can choose a different model for each employee. Both models are annual: 12, 24 or 36 months.',
          'تستطيع اختيار نموذج مختلف لكل موظف. النموذجان سنويان: 12 أو 24 أو 36 شهراً.'),
))

S.append(dict(
    key='model1', tag='04 · MODEL 1 · TRANSPARENT COST', kind='stages',
    title=('Model 1 · Transparent cost: what you pay and when', 'النموذج 1 · التكلفة بشفافية: ماذا تدفع ومتى'),
    heads=(('When', 'متى'), ('What you pay', 'ماذا تدفع'), ('How', 'كيف')),
    rows=[
        (('Stage 1 · First advance', 'المرحلة 1 · الدفعة الأولى'),
         ('<b>Sponsorship transfer</b> (government fee): SAR 2,000, then 4,000, then 6,000 from the third. Or <b>recruitment from abroad</b>: the visa SAR 2,000 (paid to us, we issue it); the external party\'s costs and the arrival ticket are outside our price, on a separate invoice.',
          '<b>نقل الكفالة</b> (رسم حكومي): 2,000 ثم 4,000 ثم 6,000 من الثالثة. أو <b>الاستقدام من الخارج</b>: التأشيرة 2,000 (تدفعها لنا ونصدرها)، وتكاليف الجهة الخارجية وتذكرة القدوم خارج سعرنا بفاتورة منفصلة.'),
         ('Before anything starts. No salary and no work permit yet.', 'قبل البدء. بلا راتب ولا رخصة عمل بعد.')),
        (('Stage 2 · Entry', 'المرحلة 2 · الدخول'),
         ('<b>Medical insurance</b> for one full year. <b>Work permit, levy and residency</b> for the period you choose.',
          '<b>التأمين الطبي</b> لسنة كاملة. و<b>رخصة العمل والمقابل المالي والإقامة</b> للفترة التي تختارها.'),
         ('In advance. Permit and residency: quarterly, half-yearly or yearly.', 'مقدماً. الرخصة والإقامة: ربع سنوي أو نصف سنوي أو سنوي.')),
        (('Every month', 'كل شهر'),
         ('<b>Salary</b>, then <b>social insurance</b> (2%) after arrival, our <b>SAR 500</b> fee and the <b>localisation fee</b>.',
          '<b>الراتب</b>، و<b>التأمينات</b> (2%) بعد الوصول، ورسوم خدمتنا <b>500 ريال</b>، و<b>رسوم التوطين</b>.'),
         ('Salary is invoiced two months ahead, then monthly. VAT 15% on our fees and on medical insurance only.', 'الراتب يُفوتَر مقدماً بشهرين ثم شهرياً. وضريبة 15% على رسومنا والتأمين الطبي فقط.')),
        (('After the contract', 'بعد انتهاء العقد'),
         ('<b>End of service</b>, <b>leave pay</b> and the <b>return ticket</b>.',
          '<b>نهاية الخدمة</b> و<b>بدل الإجازة</b> و<b>تذكرة العودة</b>.'),
         ('One separate invoice at actual cost. The exit and re-entry visa is optional and outside the total.', 'فاتورة واحدة منفصلة بالتكلفة الفعلية. وتأشيرة الخروج والعودة اختيارية وخارج الإجمالي.')),
    ],
    note=('Also at actual cost when incurred: documents that need attestation. No fee of ours applies to stage 1, stage 2, the salary advance or the contract-end invoice.',
          'وبالتكلفة الفعلية عند حدوثها: المستندات التي تحتاج تصديقاً. ولا تُحمَّل رسومنا على المرحلة 1 ولا 2 ولا مقدم الراتب ولا فاتورة نهاية العقد.'),
))

S.append(dict(
    key='gov', tag='05 · GOVERNMENT FEES', kind='govtable',
    title=('Government fees explained', 'توضيح الرسوم الحكومية'),
    heads=(('Government fee', 'الرسم الحكومي'), ('Official amount', 'المبلغ الرسمي'), ('In Model 1', 'في النموذج 1'), ('In Model 2', 'في النموذج 2')),
    rows=[
        (('Work permit and expatriate levy', 'رخصة العمل والمقابل المالي'), ('SAR 9,700 per year (levy 9,600 + permit 100)', '9,700 ريال سنوياً (المقابل 9,600 + الرخصة 100)'),
         ('Paid in advance: quarterly, half-yearly or yearly', 'يُدفع مقدماً: ربع سنوي أو نصف سنوي أو سنوي'), ('Included in the monthly price', 'مشمول في السعر الشهري')),
        (('Residency (Iqama), Passports', 'الإقامة (الجوازات)'), ('SAR 650 per year', '650 ريالاً سنوياً'),
         ('Paid in advance with the work permit', 'يُدفع مقدماً مع رخصة العمل'), ('Included in the monthly price', 'مشمول في السعر الشهري')),
        (('Ajeer platform', 'منصة أجير'), ('SAR 276 per year (23 per month)', '276 ريالاً سنوياً (23 شهرياً)'),
         ('Not charged', 'لا يُحمَّل'), ('Included in the monthly price', 'مشمول في السعر الشهري')),
        (('Sponsorship transfer', 'نقل الكفالة'), ('SAR 2,000 first time, 4,000 second, 6,000 from the third', '2,000 ريال للمرة الأولى، و4,000 للثانية، و6,000 من الثالثة'),
         ('Paid in advance, at cost (stage 1)', 'يُدفع مقدماً بالتكلفة (المرحلة 1)'), ('Spread over the contract term', 'موزع على مدة العقد')),
        (('Visa, recruitment from abroad', 'تأشيرة الاستقدام من الخارج'), ('SAR 2,000', '2,000 ريال'),
         ('Paid in advance, at cost (stage 1)', 'يُدفع مقدماً بالتكلفة (المرحلة 1)'), ('Spread over the contract term', 'موزع على مدة العقد')),
        (('Exit and re-entry visa', 'تأشيرة الخروج والعودة'), ('SAR 200 per year', '200 ريال سنوياً'),
         ('Optional, at contract end, outside the total', 'اختيارية عند نهاية العقد وخارج الإجمالي'), ('Included in the monthly price', 'مشمولة في السعر الشهري')),
        (('Social insurance, foreign employee', 'التأمينات الاجتماعية على الموظف الأجنبي'), ('2% of basic salary plus housing', '2% من الراتب الأساسي والسكن'),
         ('Monthly, after arrival', 'شهرياً بعد الوصول'), ('Included in the monthly price', 'مشمولة في السعر الشهري')),
    ],
    note=('Government fees are paid at cost with no mark-up and carry no VAT. Amounts follow the official schedules in force at the time of payment.',
          'الرسوم الحكومية تُسدَّد بالتكلفة دون هامش وبلا ضريبة قيمة مضافة. والمبالغ بحسب الجداول الرسمية السارية وقت السداد.'),
))

import math
def _saudi(pkg):
    er = min(45000, pkg * 0.85) * 0.1275
    med = 600 / 12; eos = pkg / 24; lv = pkg / 30 * 21 / 12; ovh = 500
    cost = pkg + er + med + eos + lv + ovh
    price = int(math.floor(cost * 1.1 / 10 + 0.5) * 10)
    other = price - (pkg + er + med + eos + lv)
    return dict(pkg=pkg, er=er, med=med, eos=eos, lv=lv, other=other, price=price)
_o, _e = _saudi(6000), _saudi(8000)
_f = lambda x: f'{x:,.2f}'
S.append(dict(
    key='saudi', tag='08 · SAUDI EMPLOYEE COST', kind='govtable',
    title=('Saudi employee cost', 'تكلفة الموظف السعودي'),
    heads=(('Monthly cost item', 'بند التكلفة الشهري'), ('Basis', 'الأساس'), ('Ordinary or technical', 'عادية أو فنية'), ('Engineering', 'هندسية')),
    rows=[
        (('Guaranteed package', 'الباقة المضمونة'), ('At least SAR 6,000, or the profession minimum if higher', 'لا تقل عن 6,000 أو أقل راتب للمهنة إن كان أعلى'), (_f(_o['pkg']), _f(_o['pkg'])), (_f(_e['pkg']), _f(_e['pkg']))),
        (('Social insurance, employer share', 'التأمينات الاجتماعية، حصة صاحب العمل'), ('12.75% of basic + housing (85% of the package)', '12.75% من الأساسي والسكن (85% من الباقة)'), (_f(_o['er']), _f(_o['er'])), (_f(_e['er']), _f(_e['er']))),
        (('Medical insurance', 'التأمين الطبي'), ('Insurer quote; basic class shown (SAR 600 a year)', 'حسب عرض التأمين (الأساسية 600 سنوياً)'), (_f(_o['med']), _f(_o['med'])), (_f(_e['med']), _f(_e['med']))),
        (('End of service', 'نهاية الخدمة'), ('Package ÷ 24', 'الباقة ÷ 24'), (_f(_o['eos']), _f(_o['eos'])), (_f(_e['eos']), _f(_e['eos']))),
        (('Leave pay', 'بدل الإجازة'), ('21 days a year', '21 يوماً في السنة'), (_f(_o['lv']), _f(_o['lv'])), (_f(_e['lv']), _f(_e['lv']))),
        (('Our operating costs and service fee', 'مصاريفنا التشغيلية ورسم خدمتنا'), ('Included in the price', 'مشمولة في السعر'), (_f(_o['other']), _f(_o['other'])), (_f(_e['other']), _f(_e['other']))),
        (('Monthly price, before VAT', 'السعر الشهري قبل الضريبة'), ('Rounded to the nearest 10', 'مقرّب لأقرب 10'), (f"{_o['price']:,}", f"{_o['price']:,}"), (f"{_e['price']:,}", f"{_e['price']:,}")),
    ],
    note=('The Saudi\'s own share of social insurance comes out of his salary and is not a cost to you. For a Saudi taken in return for a foreigner, no localisation fee applies. Reserved professions (human resources and similar) are not offered to foreigners.',
          'حصة السعودي من التأمينات تُخصم من راتبه وليست تكلفة عليك. والسعودي الذي تأخذه مقابل أجنبي لا رسوم توطين عليه.'),
))

def _lump(a, n):
    prem = 0 if n >= 12 else 0.2 if n >= 9 else 0.3 if n >= 6 else 0.4 if n >= 3 else 1.0
    c = (a * (1 + prem) + (9700 + 650 + 276) / 12 + 600 / 12 + (a / 30 * 21) / 12 + 200 / 12 + 3000 / n + a / 2 / 12 + a * 0.02 + 1500 / 12 + 2000 / n + 500) * 1.1
    return int(math.floor(c / 10 + 0.5) * 10)
S.append(dict(
    key='model2', tag='06 · MODEL 2 · FULL EMPLOYEE COST', kind='lump',
    title=('Model 2: Full employee cost', 'النموذج الثاني: تكلفة الموظف الكاملة'),
    intro=('One fixed monthly price per employee, by total monthly package and contract term. It covers salary, work permit and levy, residency, medical and social insurance, end of service, leave pay, tickets, transfer and visa fees, and our operating costs and service fee. The longer the term, the lower the price.',
           'سعر شهري ثابت لكل موظف بحسب إجمالي الراتب الشهري ومدة العقد. يشمل الراتب ورخصة العمل والمقابل المالي والإقامة والتأمين الطبي والاجتماعي ونهاية الخدمة وبدل الإجازة والتذاكر ورسوم النقل والتأشيرة ومصاريفنا التشغيلية ورسم خدمتنا. وكلما طالت المدة انخفض السعر.'),
    rows=[((f'SAR {a:,}', f'{a:,} ريال'), f'{_lump(a,12):,}', f'{_lump(a,24):,}', f'{_lump(a,36):,}') for a in (3000, 4000, 5000, 6000, 7000, 8000, 10000)],
    note=('Monthly price per employee in SAR, excluding VAT (15% VAT added). The localisation fee is added on top (page 8). You pay two months of salary in advance. The Saudi human resources officer is not part of the transfer. For other salaries or terms, use the calculator.',
          'السعر الشهري لكل موظف بالريال قبل الضريبة (تُضاف 15%). وتُضاف رسوم التوطين فوقه (الصفحة 8). تدفع راتب شهرين مقدماً. وموظف الموارد البشرية السعودي ليس ضمن النقل. وللرواتب والمدد الأخرى استعمل الحاسبة.'),
))

S.append(dict(
    key='payment', tag='10 · TERMS & NEXT STEPS', kind='cards', cols=2,
    title=('Terms and next steps', 'الشروط والخطوات التالية'),
    cards=[
        dict(dark=True, t=('Term and payment', 'المدة والدفع'),
             b=('Minimum term 12 months, renewable. Two months of salary paid in advance. Under Model 1 each item has its own invoice and payment date, in annual terms of 12, 24 or 36 months. Invoices are payable within 7 days. Prices are valid for 30 days.',
                'المدة 12 شهراً كحد أدنى وتتجدد. وراتب شهرين مقدماً. وفي النموذج الأول لكل بند فاتورته وموعد دفعه، بعقود سنوية: 12 أو 24 أو 36 شهراً. والفواتير تُسدَّد خلال 7 أيام. والأسعار صالحة 30 يوماً.')),
        dict(dark=False, t=('Next steps', 'الخطوات التالية'),
             b=('1) Sign the NDA. 2) Choose Model 1 or Model 2 and sign this proposal. 3) Send the employee data. 4) We send the Services Agreement and start the Qiwa transfers.',
                '1) توقيع اتفاقية عدم الإفصاح. 2) اختيار النموذج الأول أو الثاني وتوقيع هذا العرض. 3) إرسال بيانات الموظفين. 4) نرسل عقد الخدمات ونبدأ نقل الخدمات عبر قوى.')),
    ],
    note=('Employee salaries are paid through payroll under the chosen model. Housing, transport and food allowance are provided by the Company.',
          'رواتب الموظفين تُدفع عبر الرواتب وفق النموذج المختار. والسكن والمواصلات وبدل الطعام على الشركة.'),
))

S.append(dict(
    key='accept', tag='11 · ACCEPTANCE', kind='accept',
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
    ts = (34, 40) if mode == 'bi' else (40, 44)
    bs = (26, 31) if mode == 'bi' else (32, 36)
    if cols >= 4:
        ts = (28, 34) if mode == 'bi' else (34, 38); bs = (21, 25) if mode == 'bi' else (27, 29)
    elif cols == 3:
        ts = (30, 36) if mode == 'bi' else (36, 40); bs = (24, 28) if mode == 'bi' else (29, 33)
    if c.get('compact'):
        ts = (26, 32) if mode == 'bi' else (30, 36); bs = (19, 23) if mode == 'bi' else (24, 27)
    return f'''<div style="background:{bg};border-radius:22px;padding:{22 if c.get('compact') else 44}px 40px;display:flex;flex-direction:column;gap:{8 if c.get('compact') else 22}px">
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
    elif k == 'bank':
        def box(c):
            title, rows = c
            body = ''.join(
                f'<div style="display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);column-gap:20px;align-items:baseline;padding:12px 0;border-top:1px solid #1E3A9E;direction:{"rtl" if mode=="ar" else "ltr"}">'
                f'<div style="font-size:22px;color:#9DB4FF">{esc(l[1] + " · " + l[0] if mode=="bi" else (l[1] if mode=="ar" else l[0]))}</div>'
                f'<div style="direction:ltr;text-align:{"right" if mode=="ar" else "left"};font-family:\'IBM Plex Mono\',monospace;font-weight:500;font-size:26px;line-height:1.4;color:#fff;word-break:break-all">{esc(v[0])}</div></div>'
                if (v[0] == v[1]) else
                f'<div style="display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);column-gap:20px;align-items:baseline;padding:12px 0;border-top:1px solid #1E3A9E;direction:{"rtl" if mode=="ar" else "ltr"}">'
                f'<div style="font-size:22px;color:#9DB4FF">{esc(l[1] + " · " + l[0] if mode=="bi" else (l[1] if mode=="ar" else l[0]))}</div>'
                f'<div style="direction:{"rtl" if mode=="ar" else "ltr"};text-align:{"right" if mode=="ar" else "left"};font-size:28px;line-height:1.45;color:#fff">{esc(v[1] if mode=="ar" else v[0])}</div></div>'
                for l, v in rows)
            return f'<div style="background:rgba(255,255,255,.06);border:2px solid #1E3A9E;border-radius:22px;padding:30px 38px 22px"><div style="margin-bottom:10px;direction:{"rtl" if mode=="ar" else "ltr"};text-align:{"right" if mode=="ar" else "left"};font-weight:700;font-size:40px;color:#fff">{esc(title[1] if mode=="ar" else title[0])}</div>{body}</div>'
        hd = hdr(s['tag'], mode).replace('color:#6A7596', 'color:#9DB4FF').replace('border:2px solid #DDE1EE', '')
        ttl = esc(s['title'][1] if mode == 'ar' else s['title'][0])
        inner = hd + f'<div style="margin-top:34px"><h2 style="margin:0;font-weight:700;font-size:54px;color:#fff;direction:{"rtl" if mode=="ar" else "ltr"};text-align:{"right" if mode=="ar" else "left"}">{ttl}</h2></div>'
        inner += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:34px;margin-top:46px;align-items:start">' + (box(s['left']) + box(s['right']) if mode != 'ar' else box(s['left']) + box(s['right'])) + '</div>'
        return page(inner, mode, cover=True)
    inner = hdr(s['tag'], mode) + h2(s['title'], mode)
    if k == 'cards':
        n = s['cols']
        inner += f'<div style="display:grid;grid-template-columns:repeat({n},minmax(0,1fr));column-gap:30px;margin-top:70px;align-items:stretch">' + ''.join(card(c, mode, n) for c in s['cards']) + '</div>'
        if s['note'][0]: inner += note(s['note'], mode, 28)
    elif k == 'tbl':
        fr = [float(x) for x in s['cols'].split()]
        d = 'rtl' if mode == 'ar' else 'ltr'
        cols = ' '.join(f'minmax(0,{x}fr)' for x in fr)
        def cell(c, size, color, bold=False):
            w = 'font-weight:700;' if bold else ''
            if mode == 'bi':
                return (f'<div style="direction:rtl;text-align:right;{w}font-size:{size-3}px;line-height:1.45;color:{color}">{c[1]}</div>'
                        f'<div style="direction:ltr;text-align:left;{w}font-size:{size-5}px;line-height:1.4;color:{color};opacity:.85">{c[0]}</div>')
            t = c[1] if mode == 'ar' else c[0]
            return f'<div style="direction:{d};text-align:{"right" if mode=="ar" else "left"};{w}font-size:{size}px;line-height:1.5;color:{color}">{t}</div>'
        fs = s.get('fs', 23)
        hr = ''.join(f'<div>{cell(h, fs-2, "#9DB4FF", True)}</div>' for h in s['head'])
        body = f'<div style="display:grid;grid-template-columns:{cols};column-gap:24px;padding:14px 26px;background:#0B1B5A;direction:{d}">{hr}</div>'
        for i, r in enumerate(s['rows']):
            bg = '#fff' if i % 2 == 0 else '#F7F8FD'
            cs = ''.join(f'<div>{cell(c, fs, "#0B1B5A" if j == 0 else "#1B2340", j == 0)}</div>' for j, c in enumerate(r))
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:24px;align-items:start;padding:15px 26px;background:{bg};border-bottom:2px solid #DDE1EE;direction:{d}">{cs}</div>'
        inner += f'<div style="margin-top:34px;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{body}</div>'
        if s.get('note'): inner += note(s['note'], mode, 24)
    elif k == 'next':
        d = 'rtl' if mode == 'ar' else 'ltr'; al = 'right' if mode == 'ar' else 'left'; ix = 1 if mode == 'ar' else 0
        def lst(items, col, bd):
            return ''.join(f'<div style="padding:6px 0;border-top:1px solid {bd};direction:{d};text-align:{al};font-size:25px;color:{col}">{(it[1] if mode in ("ar","bi") else it[0]) if mode != "bi" else it[1] + " · " + it[0]}</div>' for it in items)
        def ttl(t, col): return f'<div style="direction:{d};text-align:{al};font-weight:700;font-size:34px;line-height:1.4;color:{col}">{t[1] if mode in ("ar","bi") else t[0]}</div>'
        left = f'<div style="background:#0B1B5A;border-radius:22px;padding:20px 30px">{ttl(s["steps"][0], "#fff")}{lst(s["steps"][1], "#C9D5FF", "#2B3F8A")}</div>'
        right = f'<div style="background:#fff;border:2px solid #DDE1EE;border-radius:22px;padding:20px 30px">{ttl(s["need"][0], "#0B1B5A")}{lst(s["need"][1], "#1B2340", "#E6E9F3")}</div>'
        inner += f'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:28px;margin-top:18px;align-items:start;direction:{d}">{left}{right}</div>'
        rows = ''.join(f'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);column-gap:24px;padding:7px 26px;background:{"#fff" if i%2==0 else "#F7F8FD"};border-bottom:2px solid #DDE1EE;direction:{d}"><div style="direction:{d};text-align:{al};font-weight:700;font-size:22px;color:#0B1B5A">{r[0][1] if mode in ("ar","bi") else r[0][0]}</div><div style="direction:{d};text-align:{al};font-size:22px;color:#1B2340">{r[1][1] if mode in ("ar","bi") else r[1][0]}</div></div>' for i, r in enumerate(s['terms']))
        inner += f'<div style="margin-top:16px;background:#fff;border:2px solid #DDE1EE;border-radius:18px;overflow:hidden">{rows}</div>'
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
        fs = 22 if mode == 'bi' else 32
        def L(pair, size, bold=False, color='#0B1B5A', c=False):
            w = 'font-weight:700;' if bold else ''
            en = f'<div style="direction:ltr;text-align:{"center" if c else "left"};font-size:{size}px;line-height:1.25;color:{color};{w}">{esc(pair[0])}</div>'
            ar = f'<div style="direction:rtl;text-align:{"center" if c else "right"};font-size:{size+2}px;line-height:1.3;color:{color};{w}">{esc(pair[1])}</div>'
            return '<div>' + ((ar + en) if mode == 'bi' else (ar if mode == 'ar' else en)) + '</div>'
        cols = 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)'
        d = 'rtl' if mode == 'ar' else 'ltr'
        heads = (('Total monthly package', 'إجمالي الراتب الشهري'), ('12 months', '12 شهراً'), ('24 months', '24 شهراً'), ('36 months', '36 شهراً'))
        h = ''.join(f'<div style="{"text-align:center;" if i else ""}">{L(hp, fs, True, "#fff", c=bool(i))}</div>' for i, hp in enumerate(heads))
        body = f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:10px 24px;background:#0B1B5A;direction:{d}">{h}</div>'
        for i, r in enumerate(s['rows']):
            bg = '#EEF2FF' if r[0][0] == 'SAR 6,000' else '#fff'
            val = lambda v: f'<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:center;font-size:{fs+4}px;color:#0B1B5A">{esc(v)}</div>'
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:14px;align-items:center;padding:12px 24px;background:{bg};border-bottom:2px solid #DDE1EE;direction:{d}">{L(r[0], fs+1, True)}{val(r[1])}{val(r[2])}{val(r[3])}</div>'
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
                    lines += f'<div style="padding:16px 0;border-top:1px solid {"#2B3F8A" if dark else "#E6E9F3"};direction:{"rtl" if mode=="ar" else "ltr"};text-align:{"right" if mode=="ar" else "left"};font-size:{29 if mode=="ar" else 27}px;color:{icol[1] if mode=="ar" else icol[1]}">✓ {esc(t)}</div>'
            return f'<div style="background:{bg};border-radius:22px;padding:24px 30px;display:flex;flex-direction:column;gap:4px">{txt(title, mode, (34, 40), tcol, True)}{lines}</div>'
        inner += '<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);column-gap:28px;margin-top:22px;align-items:start">' + col(s['left'], True) + col(s['right'], False) + '</div>'
    elif k == 'stages':
        fs = 20 if mode == 'bi' else 24
        d = 'rtl' if mode == 'ar' else 'ltr'
        cols = 'minmax(0,0.75fr) minmax(0,1.7fr) minmax(0,1.1fr)'
        def C(pair, size, color, bold=False):
            return txt(pair, mode, (size, size + 2), (color, color), bold)
        hrow = ''.join(f'<div>{C(h, fs - 4, "#9DB4FF", True)}</div>' for h in s['heads'])
        body = f'<div style="display:grid;grid-template-columns:{cols};column-gap:26px;padding:16px 28px;background:#0B1B5A;direction:{d}">{hrow}</div>'
        for i, (w, what, how) in enumerate(s['rows']):
            bg = '#fff' if i % 2 == 0 else '#F7F8FD'
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:26px;align-items:start;padding:16px 28px;background:{bg};border-bottom:2px solid #DDE1EE;direction:{d}"><div>{C(w, fs, "#0B1B5A", True)}</div><div>{C(what, fs - 1, "#1B2340")}</div><div>{C(how, fs - 3, "#4A5578")}</div></div>'
        inner += f'<div style="margin-top:26px;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{body}</div>'
        inner += note(s['note'], mode, 18)
    elif k == 'govtable':
        fs = 19 if mode == 'bi' else 25
        d = 'rtl' if mode == 'ar' else 'ltr'
        cols = 'minmax(0,1.25fr) minmax(0,1.3fr) minmax(0,1.25fr) minmax(0,1.05fr)'
        def C(pair, size, color, bold=False):
            return txt(pair, mode, (size, size + 2), (color, color), bold)
        N = lambda v: f'<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:center;font-size:{fs}px;color:#0B1B5A">{esc(v[0])}</div>'
        if s['key'] == 'saudi': cols = 'minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,0.8fr) minmax(0,0.8fr)'
        hrow = ''.join(f'<div>{C(h, fs - 3, "#9DB4FF", True)}</div>' for h in s['heads'])
        body = f'<div style="display:grid;grid-template-columns:{cols};column-gap:24px;padding:14px 26px;background:#0B1B5A;direction:{d}">{hrow}</div>'
        for i, r in enumerate(s['rows']):
            bg = '#fff' if i % 2 == 0 else '#F7F8FD'
            body += f'<div style="display:grid;grid-template-columns:{cols};column-gap:24px;align-items:start;padding:11px 26px;background:{bg};border-bottom:2px solid #DDE1EE;direction:{d}"><div>{C(r[0], fs, "#0B1B5A", True)}</div><div>{C(r[1], fs - 1, "#0B1B5A")}</div><div>{N(r[2]) if s['key'] == 'saudi' else C(r[2], fs - 2, "#1B2340")}</div><div>{N(r[3]) if s['key'] == 'saudi' else C(r[3], fs - 2, "#4A5578")}</div></div>'
        inner += f'<div style="margin-top:20px;background:#fff;border:2px solid #DDE1EE;border-radius:20px;overflow:hidden">{body}</div>'
        inner += note(s['note'], mode, 14)
    elif k == 'accept':
        L = lambda t: f'<div style="font-size:24px;color:#6A7596;margin-top:8px">{t}</div><div class="ln"></div>'
        blocks = []
        for dark, ti, body in (
            (True, ('Acceptance of proposal', 'قبول العرض'),
             (f'In acceptance of this proposal, for and on behalf of {CLIENT_EN}. Model chosen: ☐ Model 1 (Transparent cost)  ☐ Model 2 (Full employee cost). Name and title: ________________',
              f'بالقبول بهذا العرض نيابةً عن شركة {CLIENT_AR}. النموذج المختار: ☐ الأول (التكلفة بشفافية)  ☐ الثاني (تكلفة الموظف الكاملة). الاسم والصفة: ________________')),
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


exec(open('lean_patch.py').read())
NAMES = {  # key -> (bi, ar, en)
    'cover': ('Main', 'AR-1-Cover', 'EN-1-Cover'),
    'scope': ('Scope', 'AR-2-Scope', 'EN-2-Scope'),
    'roles': ('Roles', 'AR-3-Roles', 'EN-3-Roles'),
    'models': ('Models', 'AR-10-Models', 'EN-10-Models'),
    'gov': ('Gov', 'AR-11-Gov', 'EN-11-Gov'),
    'saudi': ('Saudi', 'AR-12-Saudi', 'EN-12-Saudi'),
    'local': ('Local', 'AR-4-Local', 'EN-4-Local'),
    'calc': ('Calc', 'AR-5-Calc', 'EN-5-Calc'),
    'model1': ('Price', 'AR-6-Price', 'EN-6-Price'),
    'model2': ('Fees', 'AR-7-Fees', 'EN-7-Fees'),
    'bank': ('Bank', 'AR-14-Bank', 'EN-14-Bank'),
    'need': ('Need', 'AR-13-Need', 'EN-13-Need'),
    'payment': ('Next', 'AR-8-Next', 'EN-8-Next'),
    'accept': ('Accept', 'AR-9-Accept', 'EN-9-Accept'),
}
ORDER = ['cover', 'scope', 'roles', 'models', 'model1', 'calc', 'model2', 'gov', 'local', 'saudi', 'payment', 'accept', 'bank']
S.sort(key=lambda x: ORDER.index(x['key']))
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
