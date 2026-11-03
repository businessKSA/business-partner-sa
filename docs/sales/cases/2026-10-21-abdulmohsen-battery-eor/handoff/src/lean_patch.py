# Lean redesign: one idea per card, short lines, details moved to the annex.
def _by(k): return next(s for s in S if s['key'] == k)
def _c(dark, t, b): return dict(dark=dark, t=t, b=b)

c = _by('cover')
c['title'] = ('Moving your team to Saudi Arabia, made simple', 'ننقل فريقك إلى السعودية بسهولة')
c['sub'] = ('We handle the transfer, permits, insurance and payroll.', 'نتولى النقل والرخص والتأمين والرواتب.')
c['meta'] = (f'Prepared for {CLIENT_EN}<br>Valid for 30 days', f'مُعَدّ لشركة {CLIENT_AR}<br>صالح لمدة 30 يوماً')

s = _by('scope'); s['title'] = ('What you get', 'ماذا تحصل')
s['cards'] = [
 _c(True, ('1 · Transfer', '1 · النقل'), ('Your team moves to us on Qiwa. All electronic.', 'ينتقل فريقك إلينا عبر قوى. كل شيء إلكتروني.')),
 _c(False, ('2 · Papers', '2 · الأوراق'), ('Residency, work permits, insurance and contracts.', 'الإقامة ورخص العمل والتأمين والعقود.')),
 _c(False, ('3 · Payroll', '3 · الرواتب'), ('Monthly salaries, end of service and leave.', 'الرواتب الشهرية ونهاية الخدمة والإجازات.')),
]
s['note'] = ('5 employees now, 30+ within six months. Minimum term 12 months.', '5 موظفين الآن، وأكثر من 30 خلال ستة أشهر. المدة 12 شهراً كحد أدنى.')

r = _by('roles'); r['title'] = ('Who pays for what', 'من يتحمل ماذا')
r['left'] = (('We handle', 'علينا'), [
 ('Transfer or visa fees', 'رسوم النقل أو التأشيرة'), ('Work permit and residency', 'رخصة العمل والإقامة'),
 ('Medical and social insurance', 'التأمين الطبي والاجتماعي'), ('Contracts and paperwork', 'العقود والأوراق'),
 ('End of service and leave', 'نهاية الخدمة والإجازات')])
r['right'] = (('You provide', 'عليك'), [('Housing', 'السكن'), ('Transport', 'المواصلات'), ('Food allowance', 'بدل الطعام'), ('Recruitment from abroad, embassy requirements and arrival ticket (separate invoice)', 'الاستقدام من الخارج ومتطلبات السفارة وتذكرة القدوم (بفاتورة منفصلة)')])

m = _by('models'); m['title'] = ('Choose how you pay', 'اختر طريقة الدفع')
m['cards'] = [
 _c(True, ('Model 1 · Transparent cost', 'النموذج 1 · التكلفة بشفافية'),
    ('Pay each real cost as it happens.<br>Our fee: <b>SAR 500</b> per employee per month.', 'تدفع كل تكلفة فعلية عند حدوثها.<br>رسومنا: <b>500 ريال</b> شهرياً لكل موظف.')),
 _c(False, ('Model 2 · Full employee cost', 'النموذج 2 · تكلفة الموظف الكاملة'),
    ('One fixed monthly price per employee.<br>Everything is included.', 'سعر شهري ثابت لكل موظف.<br>كل شيء مشمول.')),
]
m['note'] = ('Pick a model per employee. Terms: 12, 24 or 36 months.', 'تختار نموذجاً لكل موظف. المدد: 12 أو 24 أو 36 شهراً.')

l = _by('local'); l['title'] = ('Localisation fees', 'رسوم التوطين')
l['cards'] = [
 _c(True, ('Take Saudis through us', 'تأخذ معنا سعوديين'), ('<b>No fee.</b>', '<b>بلا رسوم.</b>')),
 _c(False, ('Do not take Saudis', 'لا تأخذ سعوديين'), ('<b>SAR 900</b> per employee per month.<br>More for professions with a localisation decision.', '<b>900 ريال</b> شهرياً لكل موظف.<br>وأكثر للمهن التي عليها قرار توطين.')),
 _c(False, ('Saudi-only professions', 'مهن للسعوديين فقط'), ('HR, reception, customer service and similar.', 'الموارد البشرية والاستقبال وخدمة العملاء ونحوها.')),
]
l['note'] = ('Check any profession: <a href="https://www.businesspartner.sa/calculators/profession-checker" style="color:#13246E">Profession checker</a>',
             'افحص أي مهنة: <a href="https://www.businesspartner.sa/ar/calculators/profession-checker" style="color:#13246E">فاحص المهن</a>')

f = _by('model2'); f['title'] = ('Model 2 prices', 'أسعار النموذج 2')
f['intro'] = ('Monthly price per employee, SAR.', 'السعر الشهري لكل موظف بالريال.')
f['note'] = ('Before 15% VAT. Localisation fee added on top. Longer term, lower price.', 'قبل ضريبة 15%. وتُضاف رسوم التوطين. كلما طالت المدة انخفض السعر.')

p = _by('payment'); p['title'] = ('Next steps', 'الخطوات التالية')
p['cards'] = [
 _c(True, ('Four steps', 'أربع خطوات'), ('1 · Sign the NDA<br>2 · Choose a model and sign<br>3 · Send employee data<br>4 · We start the transfers', '1 · توقيع اتفاقية عدم الإفصاح<br>2 · اختيار النموذج والتوقيع<br>3 · إرسال بيانات الموظفين<br>4 · نبدأ النقل')),
 _c(False, ('Terms', 'الشروط'), ('Two months of salary in advance.<br>Invoices payable in 7 days.<br>Prices valid 30 days.', 'راتب شهرين مقدماً.<br>الفواتير تُسدَّد خلال 7 أيام.<br>الأسعار صالحة 30 يوماً.')),
]
p['note'] = ('', '')

# annex tags / short titles
for k, n in (('model1', 'A1'), ('gov', 'A2'), ('saudi', 'A3'), ('calc', 'A4')):
    _by(k)['tag'] = f'ANNEX {n[1]}'
_by('model1')['title'] = ('Model 1 · what you pay and when', 'النموذج 1 · ماذا تدفع ومتى')
for k, t in (('scope', '01 · WHAT YOU GET'), ('roles', '02 · WHO PAYS'), ('models', '03 · TWO MODELS'), ('model2', '04 · PRICES'), ('local', '05 · LOCALISATION'), ('payment', '06 · NEXT STEPS'), ('accept', '07 · ACCEPTANCE')):
    _by(k)['tag'] = t

S.append(dict(key='need', tag='06 · WHAT WE NEED', kind='checklist',
    title=('What we need from you', 'ما نحتاجه منك'),
    left=(('For each employee', 'لكل موظف'), [
        ('Number of employees', 'العدد'), ('Nationalities', 'الجنسيات'), ('Salaries', 'الرواتب'), ('Professions', 'المهن'),
        ('CV', 'السيرة الذاتية'), ('Contact number of each selected employee', 'رقم تواصل كل موظف مختار')]),
    right=(('Tell us for each one', 'وأخبرنا عن كل واحد'), [
        ('Already selected, or needs sourcing', 'مختار أو يحتاج استقطاب'), ('Inside or outside Saudi Arabia', 'داخل السعودية أو خارجها')])))
_by('payment')['tag'] = '07 · NEXT STEPS'
_by('accept')['tag'] = '08 · ACCEPTANCE'

S.append(dict(key='bank', tag='08 · BANK & CONTACT', kind='bank',
    title=('Thank you', 'شكراً لكم'),
    left=(('Bank transfer details', 'بيانات التحويل البنكي'), [
        (('Beneficiary', 'المستفيد'), ('Business Partner Solutions Company', 'شركة بزنس بارتنر سلوشنز')),
        (('Bank', 'البنك'), ('Al Rajhi Bank', 'مصرف الراجحي')),
        (('IBAN', 'الآيبان'), ('SA5380000511608016228498', 'SA5380000511608016228498')),
        (('Account no.', 'رقم الحساب'), ('511000010006086228498', '511000010006086228498'))]),
    right=(('Contact us', 'تواصل معنا'), [
        (('Mobile', 'الجوال'), ('0530540231', '0530540231')),
        (('E-mail', 'البريد'), ('business@businesspartner.sa', 'business@businesspartner.sa')),
        (('Website', 'الموقع'), ('www.businesspartner.sa', 'www.businesspartner.sa')),
        (('Address', 'العنوان'), ('Building 9214, King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 (RDAA9214)', 'مبنى 9214، طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714 (RDAA9214)'))])))
_by('accept')['tag'] = '09 · ACCEPTANCE'

S[:] = [x for x in S if x['key'] != 'need']
_m = _by('models'); _m.clear(); _m.update(dict(key='models', tag='03 · TWO MODELS', kind='tbl', cols='1.1 1.7 1.4',
    title=('Choose how you pay', 'اختر طريقة الدفع'),
    head=[('Model', 'النموذج'), ('How you pay', 'طريقة الدفع'), ('Our fees', 'رسومنا')],
    rows=[[('Model 1 · Transparent cost', 'النموذج 1 · التكلفة بشفافية'), ('You pay each real cost when it happens, one invoice per item.', 'تدفع كل تكلفة فعلية عند حدوثها، بفاتورة لكل بند.'), ('SAR 500 per employee per month, plus the localisation fee.', '500 ريال شهرياً لكل موظف، إضافةً إلى رسوم التوطين.')],
          [('Model 2 · Full employee cost', 'النموذج 2 · تكلفة الموظف الكاملة'), ('One fixed monthly price per employee. Everything is included.', 'سعر شهري ثابت لكل موظف، وكل شيء مشمول.'), ('See the prices page, plus the localisation fee.', 'انظر صفحة الأسعار، إضافةً إلى رسوم التوطين.')],
          [('Recruitment from abroad and arrival ticket (both models)', 'الاستقدام من الخارج وتذكرة القدوم (في النموذجين)'), ('Separate invoice, outside our price.', 'بفاتورة منفصلة وخارج سعرنا.'), ('The visa fee of SAR 2,000 is paid to us.', 'رسم التأشيرة 2,000 ريال يُدفع لنا.')]],
    note=('Each model has its own agreement. Terms: 12, 24 or 36 months.', 'لكل نموذج اتفاقيته الخاصة. المدد: 12 أو 24 أو 36 شهراً.')))
_l = _by('local'); _l.clear(); _l.update(dict(key='local', tag='08 · LOCALISATION', kind='tbl', cols='1.4 1.1 1.7',
    title=('Localisation fees', 'رسوم التوطين'),
    head=[('Case', 'الحالة'), ('Fee per foreign employee per month, before VAT', 'الرسم لكل موظف أجنبي شهرياً قبل الضريبة'), ('Notes', 'ملاحظات')],
    rows=[[('Occupation with a localisation decision, and you employ no Saudis', 'مهنة عليها قرار توطين، ولا توظّف سعوديين'), ('Cost of the Saudis the ratio requires, divided across your foreign employees', 'تكلفة السعوديين الذين تتطلبهم النسبة موزعة على موظفيك الأجانب'), ('Example: 3 engineers (30%), no Saudi engineer: SAR 6,930 each.', 'مثال: 3 مهندسين (30%) بلا مهندس سعودي: 6,930 ريالاً لكل مهندس.')],
          [('Occupation with a decision, and you take Saudis through us', 'مهنة عليها قرار، وتأخذ معنا سعوديين'), ('Reduced or waived after verification', 'يُخفَّض أو يسقط بعد التحقق'), ('By a separate written arrangement. Each Saudi is a real employee on a real wage.', 'بترتيب كتابي مستقل. وكل سعودي موظف فعلي بأجر فعلي.')],
          [('Occupation with no localisation decision', 'مهنة بلا قرار توطين'), ('SAR 900', '900 ريال'), ('Flat fee per employee per month.', 'رسم ثابت لكل موظف شهرياً.')],
          [('Saudi-only professions: HR, reception, in-person customer service, translator and similar', 'مهن للسعوديين فقط: الموارد البشرية والاستقبال وخدمة العملاء الحضورية والترجمة ونحوها'), ('Not transferred', 'لا تُنقل'), ('Reserved for Saudis by the guides.', 'مقصورة على السعوديين بحسب الأدلة.')]],
    note=('Check any profession: <a href="https://www.businesspartner.sa/calculators/profession-checker" style="color:#13246E">Profession checker</a>', 'افحص أي مهنة: <a href="https://www.businesspartner.sa/ar/calculators/profession-checker" style="color:#13246E">فاحص المهن</a>')))
_p = _by('payment'); _p.clear(); _p.update(dict(key='payment', tag='11 · NEXT STEPS', kind='next',
    title=('Next steps', 'الخطوات التالية'),
    steps=(('Four steps', 'أربع خطوات'), [('1 · Sign the NDA', '1 · توقيع اتفاقية عدم الإفصاح'), ('2 · Choose a model and sign', '2 · اختيار النموذج والتوقيع'), ('3 · Send the information we need', '3 · إرسال المعلومات المطلوبة'), ('4 · We start the transfer and recruitment', '4 · نبدأ النقل والاستقدام')]),
    need=(('We need from you', 'نحتاج منكم'), [('Number of employees', 'عدد الموظفين'), ('Nationalities', 'الجنسيات'), ('Salaries and allowances', 'الرواتب والبدلات'), ('Occupations (job titles)', 'المهن (المسمى الوظيفي)'), ('CVs', 'السير الذاتية'), ('Contact numbers of the selected employees', 'أرقام التواصل للموظفين المختارين'), ('Per employee: selected, or needs sourcing', 'لكل موظف: هل هو مختار أم يحتاج إلى استقطاب'), ('Per employee: inside or outside Saudi Arabia', 'لكل موظف: هل هو داخل السعودية أم خارجها')]),
    terms=[(('Advance payment', 'دفعة مقدمة'), ('Two months of salary', 'راتب شهرين')), (('Invoices', 'الفواتير'), ('Payable within 7 days', 'تُسدَّد خلال 7 أيام')), (('Recruitment costs and arrival ticket', 'رسوم الاستقدام وتذكرة القدوم'), ('Separate invoice, outside our price', 'بفاتورة منفصلة وخارج سعرنا')), (('Offer validity', 'صلاحية العرض'), ('30 days', '30 يوماً'))]))
for _k, _t in (('cover', 'PROPOSAL · 24 OCT 2026'), ('scope', '01 · WHAT YOU GET'), ('roles', '02 · WHO PAYS'), ('models', '03 · TWO MODELS'), ('model1', '04 · MODEL 1'), ('calc', '05 · MODEL 1 · COST'), ('model2', '06 · MODEL 2'), ('gov', '07 · GOVERNMENT FEES'), ('local', '08 · LOCALISATION'), ('saudi', '09 · SAUDI COST'), ('payment', '10 · NEXT STEPS'), ('accept', '11 · ACCEPTANCE'), ('bank', '12 · BANK & CONTACT')):
    _by(_k)['tag'] = _t
