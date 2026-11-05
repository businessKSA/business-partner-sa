# -*- coding: utf-8 -*-
"""عرض EOR لموظفة/موظفين سعوديين — Maake Beauty (جينان). مبسط + مفصل بصيغة الحزمة (أفقي، عربي يمين/إنجليزي يسار).
الاستعمال: NODE_PATH=$(npm root -g) python3 build_quote.py <outdir>   (BP_IBAN/BP_BANK تُحقن في نسخة العميل؛ بدونها يبقى [IBAN]/[BANK])
الأرقام: رسمنا ثابت 1,000 ريال للفرد شهرياً (قرار المالك 2026-11-05)؛ التأمينات من معادلة المالك (GOSI على 85% من الراتب: صاحب العمل 12.75%، الموظف 10.75%)."""
import os, sys, re, importlib.util
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'business-development-service', 'src')
sys.path.insert(0, SRC)
import rev_quote as q, rev_package as rp

S = 6200                      # راتب مثال (قبل خصم حصة الموظف)
FEE = 1000
base = S * 0.85
GOSI = round(base * (0.10 + 0.02 + 0.0075))        # صاحب العمل
GOSI_EMP = round(base * (0.10 + 0.0075))           # يُخصم من الموظف أو تتحمله الشركة
EOSB = round(S / 24.0)
LEAVE = round(S / 30.0 * 21 / 12.0)
VAT = round(FEE * 0.15)
M1 = S + GOSI + FEE                  # قبل الضريبة (النموذج 1: المكافأة والإجازة بالفعلي عند النهاية)
M2 = M1 + EOSB + LEAVE
f = lambda n: '{:,}'.format(int(n))
N = q.num
CFG = dict(client_en='Maake Beauty', client_ar=q.BLANK, date_en='5 November 2026', date_ar='5 نوفمبر 2026')
RLM = q.RLM
c3 = lambda e, a, cls='': (e, a, cls)


def cover():
    c = q.T_COVER
    c = c.replace('Business Partner Solutions' if False else 'Business Development as a Service', 'Employment under Contracting and Outsourcing: Saudi Employees')
    c = c.replace('تطوير الأعمال كخدمة', 'التوظيف على بند التعاقد والإسناد: موظفون سعوديون')
    c = c.replace('We bring you sales leads and referrals and help you register as a vendor with companies.', 'We employ your Saudi team on our contract and run payroll, social insurance and HR, while they work with you.')
    c = c.replace('نأتيك بفرص بيع وإحالات، ونساعدك في التسجيل كمورد لدى الشركات.', 'نوظّف فريقك السعودي على عقدنا، ونتولى الرواتب والتأمينات وشؤون الموظفين، وهم يعملون معكم.')
    c = re.sub(r'<div class="pk" dir="ltr">.*?</div>', '<div class="pk" dir="ltr">Transparent cost</div>', c)
    c = re.sub(r'<div class="pk" dir="rtl"[^>]*>.*?</div>', '<div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">التكلفة بشفافية</div>', c)
    return q.cover(CFG, rp.PHONE) if False else c.replace('<span>To / إلى السادة</span><span class="num">[●]</span>', '<span>To / إلى السادة</span>Maake Beauty').replace('<span>Date / التاريخ</span><span class="num">[●]</span>', '<span>Date / التاريخ</span>5 November 2026<br><span dir="rtl">5 نوفمبر 2026</span>').replace('[●]<br>business@', rp.PHONE + '<br>business@')


def price_models(detailed):
    head = [('Per employee, per month (SAR)', 'للموظف شهرياً (ريال)', False), ('Amount', 'المبلغ', True)]
    R = lambda e, a, v: [c3(e, a, ''), c3(N(v), N(v), 'c')]
    rows = [
        R('Salary (example, before the employee insurance deduction)', 'الراتب (مثال، قبل خصم حصة الموظف من التأمينات)', f(S)),
        R('Social insurance, employer share (approx. 13%)', 'التأمينات الاجتماعية، حصة صاحب العمل (نحو 13%)', f(GOSI)),
        R('Business Partner fixed fees', 'رسوم Business Partner الثابتة', f(FEE)),
        {'cls': 'tot', 'cells': R('Monthly total before VAT', 'الإجمالي الشهري قبل الضريبة', f(M1))},
        R('VAT 15% (on Business Partner fees only)', 'ضريبة القيمة المضافة 15% (على رسوم Business Partner فقط)', f(VAT)),
        {'cls': 'tot', 'cells': R('Monthly invoice incl. VAT', 'الفاتورة الشهرية شاملة الضريبة', f(M1 + VAT))},
    ]
    t = q.bi_table(head, rows, [44, 16])
    head2 = [('Billed at actual at contract end (12 months, indicative)', 'تُفوتَر بالفعلي عند نهاية العقد (12 شهراً، تقديري)', False), ('Amount', 'المبلغ', True)]
    rows2 = [R('End-of-service reward (passed to the employee)', 'مكافأة نهاية الخدمة (تُسلَّم للموظف)', f(S // 2)),
             R('Annual leave (21 days)', 'الإجازة السنوية (21 يوماً)', f(round(S / 30.0 * 21)))]
    t2 = q.bi_table(head2, rows2, [44, 16])
    return [q.h2(1, 'Price per Saudi employee: transparent cost', 'السعر للموظف السعودي: التكلفة بشفافية'),
            q.p('Each cost is shown as it is. You pay the salary, insurance and the fixed fees of Business Partner monthly. The end-of-service reward and leave are billed at actual when the contract ends.',
                'كل تكلفة تُعرض كما هي. تدفعون الراتب والتأمينات ورسوم Business Partner الثابتة شهرياً، وتُفوتَر مكافأة نهاية الخدمة والإجازة بالفعلي عند انتهاء العقد.'),
            t, t2,
            q.p('Salary is an example (SAR %s). Employee insurance share (approx. 10%%, SAR %s) is deducted from the salary, or you may pay it on top (+SAR %s per month) so the employee receives the full salary.' % (f(S), f(GOSI_EMP), f(GOSI_EMP)),
                'الراتب مثال (%s ريال). حصة الموظف من التأمينات (نحو 10%%، أي %s ريال) تُخصم من الراتب، أو تتحملونها فوق الراتب (+%s ريالاً شهرياً) ليستلم الموظف راتبه كاملاً.' % (f(S), f(GOSI_EMP), f(GOSI_EMP)))]


def included():
    return [q.h2(2, 'What you get', 'ما تحصلون عليه'),
            q.numbered([('Employment of your Saudi employee on our contract, registered with GOSI and Qiwa.', 'توظيف موظفكم السعودي على عقدنا وتسجيله في التأمينات الاجتماعية وقوى.'),
                        ('Monthly payroll and payslips, paid on time.', 'الرواتب الشهرية وقسائم الراتب في موعدها.'),
                        ('Social insurance, end-of-service reward and leave calculated and settled by us.', 'احتساب التأمينات ومكافأة نهاية الخدمة والإجازات وتسويتها من جهتنا.'),
                        ('Employee records and contract administration throughout the term.', 'ملف الموظف وإدارة العقد طوال المدة.'),
                        ], 'Included', 'يشمل')]


def reqs_excl():
    return [q.h2(3, 'What we need from you', 'ما نحتاجه منكم'),
            q.numbered([('Number of employees, job titles and monthly salaries.', 'عدد الموظفين ومسمياتهم الوظيفية ورواتبهم الشهرية.'),
                        ('Names and ID numbers of the employees, and their start date.', 'أسماء الموظفين وأرقام هوياتهم وتاريخ المباشرة.'),
                        ('Your choice on the employee social-insurance share: deducted from salary, or paid by the company.', 'اختياركم لحصة الموظف في التأمينات: تُخصم من الراتب أو تتحملها الشركة.'),
                        ('Your commercial registration, VAT number, national address and authorised representative.', 'سجلكم التجاري ورقمكم الضريبي وعنوانكم الوطني وممثلكم النظامي.')], 'Requirements', 'المتطلبات'),
            q.h2(4, 'Not included', 'لا يشمله العرض'),
            q.numbered([('Government fees, if any arise, are billed at actual.', 'الرسوم الحكومية، إن وجدت، تُفوتَر بالفعلي.'),
                        ('Medical insurance, if you want it, is quoted separately.', 'التأمين الطبي، إن رغبتم به، يُسعَّر منفصلاً.'),
                        ('Bonuses, commissions and allowances beyond the agreed salary.', 'المكافآت والعمولات والبدلات خارج الراتب المتفق عليه.')], 'Not included', 'غير مشمول')]


def how_it_works():
    return [q.h2(3, 'How it works', 'كيف تعمل الخدمة'),
            q.numbered([('You choose the employee and agree the salary and start date.', 'تختارون الموظف وتتفقون على الراتب وتاريخ المباشرة.'),
                        ('We sign the employment contract with the employee and register them.', 'نوقّع عقد العمل مع الموظف ونسجّله.'),
                        ('The employee works with you day to day; you direct the work.', 'يعمل الموظف معكم يومياً وأنتم توجّهون العمل.'),
                        ('Each month we pay the salary and settle the insurance, and send you one invoice. The first invoice follows the first month of work.', 'نصرف كل شهر الراتب ونسدّد التأمينات ونرسل لكم فاتورة واحدة. وتصدر أول فاتورة بعد أول شهر عمل.'),
                        ('At contract end we settle the end-of-service reward and leave, and pass the reward to the employee.', 'عند انتهاء العقد نسوّي مكافأة نهاية الخدمة والإجازات، ونسلّم المكافأة للموظف.')], 'Step', 'الخطوة')]


def terms(first, short=False):
    t = [('Advance payment: two months of the employee\'s salary (SAR %s at the example salary), paid before the employee starts.' % f(2 * S), 'دفعة مقدمة: راتب شهرين للموظف (%s ريالاً على الراتب المثال)، تُسدَّد قبل مباشرة الموظف.' % f(2 * S)),
         ('Contract term: 12 months.', 'مدة العقد: 12 شهراً.'),
         ('Quote validity: 14 days from the date above.', 'صلاحية العرض: 14 يوماً من التاريخ أعلاه.'),
         ('Business Partner fees of SAR 1,000 per employee per month are fixed for the contract term.', 'رسوم Business Partner 1,000 ريال للموظف شهرياً ثابتة طوال مدة العقد.'),
         ('Invoices are payable within 7 days. VAT 15% applies to Business Partner fees only.', 'الفواتير تُسدَّد خلال 7 أيام. وتُطبَّق ضريبة 15% على رسوم Business Partner فقط.'),
         ('Either party may end the contract with the notice period stated in the agreement.', 'لأي طرف إنهاء العقد بمهلة الإشعار المحددة في الاتفاقية.')]
    t = [x for x in t if not x[0].startswith('Quote validity')]
    if short:
        t = [x for x in t if not x[0].startswith('Either party')]
        t.insert(0, ('Not included: government fees (at actual), medical insurance (quoted separately), bonuses and allowances beyond the salary.', 'غير مشمول: الرسوم الحكومية (بالفعلي)، والتأمين الطبي (يُسعَّر منفصلاً)، والمكافآت والبدلات خارج الراتب.'))
    return [q.h2(first, 'Terms', 'الشروط'), q.numbered(t, 'Terms', 'الشروط')]


BIG = '.pt td,.pt th{font-size:12px;padding:3.5px 9px;line-height:1.4}.pt .num{font-size:13px}.rw p{font-size:12px;line-height:1.45;margin:4px 0}.rw h2{font-size:15px;margin:7px 0 4px}.rw .note{font-size:11.4px}.meta1{font-size:12.4px}'


def LAND(inner, n_title):
    return lambda i, n, phone: ('<section class="sheet land" lang="ar"><div dir="rtl">%s<div class="bp">%s</div></div>%s</section>' % (
        q.hd2("Quotation: Contracting and Outsourcing", "عرض سعر: التعاقد والإسناد"), "".join(inner), q.footer(i, n, phone)))


def build(detailed):
    pages = []
    if detailed:
        pages.append(LAND([q.meta('Maake Beauty', q.BLANK, CFG['date_en'], CFG['date_ar'])] + price_models(True), ''))
        pages.append(LAND(included() + how_it_works(), ''))
        pages.append(LAND(reqs_excl(), ''))
        pages.append(LAND(terms(5) + [q.h2(6, 'Signatures', 'التوقيعان'), q.sig_boxes(CFG)], ''))
    else:
        pages.append(LAND([q.meta('Maake Beauty', q.BLANK, CFG['date_en'], CFG['date_ar'])] + price_models(False), ''))
        pages.append(LAND(included() + reqs_excl()[:2], ''))
        pages.append(LAND(terms(4, True) + [q.h2(5, 'Signatures', 'التوقيعان'), q.sig_boxes(CFG)], ''))
    n = len(pages) + 2
    out = [re.sub(r'\d+ / \d+', '1 / %d' % n, cover())]
    for k, pg in enumerate(pages):
        out.append(pg(k + 2, n, rp.PHONE))
    out.append(re.sub(r'\d+ / \d+', '%d / %d' % (n, n), q.closing(rp.PHONE, rp.IBAN, rp.BANK)))
    title = 'عرض سعر التوظيف على بند التعاقد والإسناد للموظفين السعوديين' + (' — المفصل' if detailed else ' — المبسط')
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title>%s<style>%s%s</style></head><body>%s</body></html>') % (title, q.FONTS, q.CSS, q.EXTRA + BIG, ''.join(out).replace('[●]<br>business@', rp.PHONE + '<br>business@'))


if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    os.environ.setdefault('NODE_PATH', rp.sh('npm', 'root', '-g').strip())
    for key, det in (('quote-simple', False), ('quote-detailed', True)):
        h = os.path.join(out, key + '.html'); open(h, 'w', encoding='utf-8').write(build(det))
        s2, n = rp.fieldify(open(h, encoding='utf-8').read(), 'quote')
        fp = os.path.join(out, 'f-' + key + '.html'); open(fp, 'w', encoding='utf-8').write(s2)
        rp.render(fp, os.path.join(out, key + '.pdf'))
    print('M1', M1, 'M2', M2, 'VAT', VAT, 'GOSI', GOSI, GOSI_EMP, EOSB, LEAVE)
