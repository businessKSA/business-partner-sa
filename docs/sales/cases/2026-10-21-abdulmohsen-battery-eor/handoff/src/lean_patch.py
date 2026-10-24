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
r['right'] = (('You provide', 'عليك'), [('Housing', 'السكن'), ('Transport', 'المواصلات'), ('Food allowance', 'بدل الطعام'), ('Recruitment from abroad, embassy requirements and arrival ticket', 'الاستقدام من الخارج ومتطلبات السفارة وتذكرة القدوم')])

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
_by('model1')['title'] = ('Annex · Model 1: what you pay and when', 'ملحق · النموذج 1: ماذا تدفع ومتى')
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
