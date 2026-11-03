# Two separate Services Agreements from pairs_eor.json: M1 (Transparent Cost) and M2 (Full Employee Cost).
import json, re, copy
BASE = json.load(open('pairs_eor.json'))

def build(model):
    P = copy.deepcopy(BASE)
    E = lambda n: P[n][0] if not P[n][0]['ar'] else P[n][1]
    A = lambda n: P[n][1] if P[n][1]['ar'] else P[n][0]
    def sub(n, en_old, en_new, ar_old, ar_new):
        e, a = E(n), A(n)
        assert en_old in e['t'], (n, en_old)
        assert ar_old in a['t'], (n, ar_old)
        e['t'] = e['t'].replace(en_old, en_new); a['t'] = a['t'].replace(ar_old, ar_new)
    def put(n, en, ar): E(n)['t'] = en; A(n)['t'] = ar
    m1 = model == 1
    # common: recruitment-from-abroad costs, embassy requirements and arrival ticket are the Client's
    sub(29, 'where required, including the related authorisations, employment contracts, embassy papers, and documents;',
        'where required, including the related authorisations, employment contracts, embassy papers, and documents, the external costs of which (including embassy requirements and the arrival ticket) are outside Business Partner\'s pricing, borne by the Client and invoiced separately as stated in Schedule 6;',
        'عند اللزوم، بما يتصل به من تفويضات وعقود عمل وأوراق السفارات والمستندات، وتكاليفه الخارجية (ومنها متطلبات السفارة وتذكرة القدوم) خارج تسعير Business Partner وعلى العميل وتُفوتَر منفصلة كما في الملحق (6)؛',
        'عند اللزوم، بما يتصل به من تفويضات وعقود عمل وأوراق السفارات والمستندات، وتكاليفه الخارجية (ومنها متطلبات السفارة وتذكرة القدوم) خارج تسعير Business Partner وعلى العميل وتُفوتَر منفصلة كما في الملحق (6)؛') if False else None
    e, a = E(29), A(29)
    e['t'] = e['t'].replace('including the related authorisations, employment contracts, embassy papers, and documents;', 'including the related authorisations, employment contracts, embassy papers, and documents, the external costs of which (including embassy requirements and the arrival ticket) are outside Business Partner\'s pricing, borne by the Client and invoiced separately as stated in Schedule 6;')
    a['t'] = a['t'].replace('بما يتصل به من تفويضات وعقود عمل وأوراق السفارات والمستندات؛', 'بما يتصل به من تفويضات وعقود عمل وأوراق السفارات والمستندات، وتكاليفه الخارجية (ومنها متطلبات السفارة وتذكرة القدوم) خارج تسعير Business Partner وعلى العميل وتُفوتَر منفصلة كما في الملحق (6)؛')
    assert 'invoiced separately as stated in Schedule 6' in e['t'] and 'تُفوتَر منفصلة كما في الملحق (6)' in a['t']
    put(124, 'Borne by the Client: housing; transport; food allowance; the external recruitment costs (the external party\'s invoice, authorisation, attestation, dispatch and embassy requirements) and the arrival ticket, which are outside Business Partner\'s pricing and invoiced separately at all times; the cost of repatriating the Employees; and responsibility for the acts of the Employees at the Client\'s site.',
        'على العميل: السكن؛ المواصلات؛ بدل الطعام؛ تكاليف الاستقدام الخارجية (فاتورة الجهة الخارجية والتفويض والتصديق والإرسال ومتطلبات السفارة) وتذكرة القدوم، وهي خارج تسعير Business Partner وتُفوتَر منفصلة دائماً؛ تكلفة إعادة الموظفين إلى بلدانهم؛ والمسؤولية عن أفعال الموظفين في موقع العميل.')
    # contract details line
    sub(9, 'Pricing Model: as selected per Employee in Schedule 1.', 'Pricing Model: ' + ('Model 1 (Transparent Cost).' if m1 else 'Model 2 (Full Employee Cost).'),
        'نموذج التسعير: بحسب ما يُحدَّد لكل موظف في الملحق (1).', 'نموذج التسعير: ' + ('النموذج (1) التكلفة بشفافية.' if m1 else 'النموذج (2) تكلفة الموظف الكاملة.'))
    # definitions
    if m1:
        put(23, '1.8 "Pricing Model" means Model 1 (Transparent Cost), under which the Client pays each Actual Cost as it is incurred, plus the fees stated in Schedule 2.',
            '1-8 «نموذج التسعير»: النموذج (1) التكلفة بشفافية، ويدفع العميل بموجبه كل تكلفة فعلية عند حدوثها مضافاً إليها الرسوم المبيّنة في الملحق (2).')
        # drop 1.10 and renumber the following definitions
        P[25] = None
        sub(26, '1.11', '1.10', '1-11', '1-10'); sub(27, '1.12', '1.11', '1-12', '1-11')
    else:
        put(22, '1.7 "Actual Costs" means the Government Fees and the other costs actually incurred in respect of the Employees, as listed in Schedule 3, which are included in the Inclusive Monthly Rate.',
            '1-7 «التكاليف الفعلية»: الرسوم الحكومية وسائر التكاليف المتكبَّدة فعلاً بخصوص الموظفين والمبيّنة في الملحق (3)، وهي داخلة في السعر الشهري الشامل.')
        put(23, '1.8 "Pricing Model" means Model 2 (Full Employee Cost), under which the Client pays the Inclusive Monthly Rate stated in Schedule 3.',
            '1-8 «نموذج التسعير»: النموذج (2) تكلفة الموظف الكاملة، ويدفع العميل بموجبه السعر الشهري الشامل المبيّن في الملحق (3).')
    # clause 5.3 / 6
    put(42, '5.3 Business Partner arranges and pays the items allocated to it in Schedule 6 according to the mechanism of ' + ('Schedule 2' if m1 else 'Schedule 3') + ', and the Client bears the items allocated to it in Schedule 6.',
        '5-3 تتولى Business Partner ترتيب وسداد البنود المسندة إليها في الملحق (6) بحسب آلية الملحق (' + ('2' if m1 else '3') + ')، ويتحمل العميل البنود المسندة إليه في الملحق (6).')
    if m1:
        put(45, '6.1 The Client shall pay for each Employee under Model 1 (Transparent Cost), as set out in this Clause 6 and Schedule 2. The Pricing Model may be changed only by written agreement.',
            '6-1 يدفع العميل عن كل موظف وفق النموذج (1) التكلفة بشفافية، كما في هذا البند (6) والملحق (2)، ولا يُغيَّر نموذج التسعير إلا باتفاق كتابي.')
        put(47, '6.3 Business Partner adds no mark-up to the Actual Costs and attaches to each invoice the official receipt or the supporting document. The Client transfers the amount of each Actual Cost upon request, before Business Partner pays it.',
            '6-3 لا تضيف Business Partner أي هامش على التكاليف الفعلية، وترفق بكل فاتورة الإيصال الرسمي أو المستند المؤيد. ويحوّل العميل مبلغ كل تكلفة فعلية عند الطلب قبل أن تسدده Business Partner.')
        put(50, '6.6 Official rates, fees, and levies may change during the term. The Client bears the actual amounts.',
            '6-6 قد تتغير الرسوم والمقابل المالي الرسمية خلال مدة الاتفاقية، ويتحمل العميل المبالغ الفعلية.')
        put(52, '7.1 Before the services start, the Client shall pay an Advance Payment equal to two months of the Employee\'s salary only, with no fee on it, in addition to the items payable in advance under Schedule 2, each under a separate invoice. Value added tax is added where applicable. The Advance Payment is applied to the invoices of the first two months, and any difference between the estimate and the actual amounts is settled in the following invoice.',
            '7-1 يسدد العميل قبل البدء بالخدمات دفعة مقدمة تعادل شهرين من راتب الموظف فقط دون رسوم عليها، إضافةً إلى البنود المستحقة مقدماً وفق الملحق (2) وكلٌّ منها بفاتورة منفصلة. وتُضاف ضريبة القيمة المضافة حيثما تنطبق. تُحتسب الدفعة المقدمة على فواتير أول شهرين، وتُسوّى في الفاتورة التالية أي فروقات بين التقدير والمبالغ الفعلية.')
        put(79, '16.4 Under the Labor Law, early termination before two years of service may affect end-of-service entitlements. End-of-service and leave entitlements are arranged and paid by Business Partner and charged to the Client at actual cost when they fall due.',
            '16-4 قد يؤثر الإنهاء المبكر قبل مضي سنتين من الخدمة على مستحقات نهاية الخدمة وفق نظام العمل. وتتولى Business Partner ترتيب وسداد مستحقات نهاية الخدمة والإجازة وتُحمَّل على العميل بالتكلفة الفعلية عند استحقاقها.')
    else:
        put(45, '6.1 The Client shall pay for each Employee under Model 2 (Full Employee Cost), as set out in this Clause 6 and Schedule 3. The Pricing Model may be changed only by written agreement.',
            '6-1 يدفع العميل عن كل موظف وفق النموذج (2) تكلفة الموظف الكاملة، كما في هذا البند (6) والملحق (3)، ولا يُغيَّر نموذج التسعير إلا باتفاق كتابي.')
        put(46, '6.2 Business Partner\'s service fee and operating expenses are included in the Inclusive Monthly Rate, and Business Partner charges no other fee except the Localisation Fee under Clause 6.3.',
            '6-2 رسوم خدمة Business Partner ومصاريفها التشغيلية داخلة في السعر الشهري الشامل، ولا تستوفي Business Partner أي رسوم أخرى سوى رسوم التوطين وفق البند (6-3).')
        put(48, '6.4 The Government Fees and the other Actual Costs listed in Schedule 3 are included in the Inclusive Monthly Rate and are not invoiced separately. Costs of recruitment from abroad, embassy requirements and the arrival ticket are not included in the Inclusive Monthly Rate, are borne by the Client and invoiced separately under Schedule 6; the visa fee of SAR 2,000 is paid by the Client to Business Partner, which issues the visa, and remains within the Inclusive Monthly Rate.',
            '6-4 الرسوم الحكومية وسائر التكاليف الفعلية المبيّنة في الملحق (3) داخلة في السعر الشهري الشامل ولا تُفوتَر منفصلة. أما تكاليف الاستقدام من الخارج ومتطلبات السفارة وتذكرة القدوم فلا يشملها السعر الشهري الشامل وهي على العميل وتُفوتَر منفصلة وفق الملحق (6)؛ أما رسم التأشيرة (2,000 ريال) فيدفعه العميل إلى Business Partner وتصدرها وهو داخل السعر الشهري الشامل.')
        put(50, '6.6 Official rates, fees, and levies may change during the term. Business Partner bears any difference between the actual official fees and the amounts built into the Inclusive Monthly Rate during the then-current term, and the rate may be reviewed at renewal.',
            '6-6 قد تتغير الرسوم والمقابل المالي الرسمية خلال مدة الاتفاقية. وتتحمل Business Partner أي فرق بين الرسوم الرسمية الفعلية والمبالغ المحتسبة في السعر الشهري الشامل خلال المدة الجارية، ويجوز مراجعة السعر عند التجديد.')
        put(52, '7.1 Before the services start, the Client shall pay an Advance Payment equal to two months of the Inclusive Monthly Rate plus two months of the Localisation Fee. Value added tax is added where applicable. The Advance Payment is applied to the invoices of the first two months.',
            '7-1 يسدد العميل قبل البدء بالخدمات دفعة مقدمة تعادل شهرين من السعر الشهري الشامل مضافاً إليها شهران من رسوم التوطين. وتُضاف ضريبة القيمة المضافة حيثما تنطبق. وتُحتسب الدفعة المقدمة على فواتير أول شهرين.')
        put(79, '16.4 Under the Labor Law, early termination before two years of service may affect end-of-service entitlements. End-of-service and leave entitlements are arranged and paid by Business Partner and are included in the Inclusive Monthly Rate.',
            '16-4 قد يؤثر الإنهاء المبكر قبل مضي سنتين من الخدمة على مستحقات نهاية الخدمة وفق نظام العمل. وتتولى Business Partner ترتيب وسداد مستحقات نهاية الخدمة والإجازة وهي داخلة ضمن السعر الشهري الشامل.')
        sub(110, 'Housing, transport and food allowance are not included.', 'Housing, transport, food allowance, recruitment from abroad, embassy requirements and the arrival ticket are not included.',
            'ولا يشمل السعر السكن والمواصلات وبدل الطعام.', 'ولا يشمل السعر السكن والمواصلات وبدل الطعام وتكاليف الاستقدام من الخارج ومتطلبات السفارة وتذكرة القدوم.')
    sub(55, 'no Pricing Model or rate applies to a new Employee', 'no ' + ('fee or cost' if m1 else 'rate') + ' applies to a new Employee',
        'ولا يسري أي نموذج تسعير أو سعر على موظف جديد', 'ولا ' + ('تسري أي رسوم أو تكلفة' if m1 else 'يسري أي سعر') + ' على موظف جديد')
    sub(98, '; the Pricing Model is selected per Employee', '', '، ويُحدَّد نموذج التسعير لكل موظف', '')
    sub(99, '; Pricing Model: [[ENGINEER_MODEL]]', '', '؛ نموذج التسعير: [[ENGINEER_MODEL]]', '')
    if m1:
        sub(104, 'recruitment from abroad in advance per the external party\'s invoice (visa SAR 2,000, authorisation, contract, attestation, dispatch and embassy requirements, by country, nationality and occupation) plus the arrival ticket (recruitment from abroad only);',
            'recruitment from abroad: the visa fee of SAR 2,000 is paid by the Client to Business Partner, which issues the visa, while the external party\'s costs (authorisation, contract, attestation, dispatch, embassy requirements and the arrival ticket) are outside Business Partner\'s pricing and invoiced separately at all times;',
            'الاستقدام من الخارج مقدماً بحسب فاتورة الجهة الخارجية (التأشيرة 2,000 ريال، والتفويض، والعقد، والتصديق، والإرسال، ومتطلبات السفارة، بحسب الدولة والجنسية والمهنة) مع تذكرة القدوم (للاستقدام من الخارج فقط)؛',
            'الاستقدام من الخارج: تأشيرة 2,000 ريال يدفعها العميل إلى Business Partner وتصدرها، أما تكاليف الجهة الخارجية (التفويض والعقد والتصديق والإرسال ومتطلبات السفارة وتذكرة القدوم) فخارج تسعير Business Partner وتُفوتَر منفصلة دائماً؛')
    sub(122, 'nationality, occupation, salary, Pricing Model, and start date;',
        'nationality, occupation, salary and start date, together with the Employee\'s CV, his/her contact number, whether he/she is already selected or needs to be sourced, and whether he/she is inside or outside the Kingdom;',
        'والجنسية والمهنة والراتب ونموذج التسعير وتاريخ البدء؛',
        'والجنسية والمهنة والراتب وتاريخ البدء، ومعها السيرة الذاتية للموظف ورقم تواصله وهل هو مختار أو يحتاج إلى استقطاب وهل هو داخل المملكة أو خارجها؛')
    # schedule 6 allocation
    put(125, 'Arranged and paid by Business Partner according to the mechanism of ' + ('Schedule 2' if m1 else 'Schedule 3') + ': medical insurance; work permit; residence; service transfer or visa fees; completion of the procedures; social insurance for the foreign Employees; and end-of-service and leave. Recruitment from abroad, where required, is arranged by Business Partner and paid by the Client under the previous paragraph.',
        'تتولى Business Partner ترتيبها وسدادها بحسب آلية الملحق (' + ('2' if m1 else '3') + '): التأمين الطبي؛ رخصة العمل؛ الإقامة؛ رسوم نقل الخدمات أو التأشيرة؛ إنهاء الإجراءات؛ التأمينات الاجتماعية للموظفين الأجانب؛ ونهاية الخدمة والإجازة. أما الاستقدام من الخارج عند اللزوم فتتولى Business Partner ترتيبه ويدفع العميل تكاليفه وفق الفقرة السابقة.')
    put(126, 'Mechanism: ' + ('each item allocated to Business Partner is recovered from the Client at actual cost as stated in Schedule 2.' if m1 else 'each item allocated to Business Partner is included in the Inclusive Monthly Rate as stated in Schedule 3.'),
        'الآلية: ' + ('تُستردّ من العميل كل بند مسند إلى Business Partner بالتكلفة الفعلية وفق الملحق (2).' if m1 else 'يدخل كل بند مسند إلى Business Partner ضمن السعر الشهري الشامل وفق الملحق (3).'))
    # drop the other model's schedule
    drop = range(106, 113) if m1 else range(101, 106)
    for n in drop: P[n] = None
    P = [x for x in P if x]
    # renumber schedules
    mp = {1: 1, 2: 2, 4: 3, 5: 4, 6: 5} if m1 else {1: 1, 3: 2, 4: 3, 5: 4, 6: 5}
    fn = lambda m: m.group(1) + str(mp[int(m.group(2))]) + m.group(3)
    pats = [r'(Schedule )(\d)()', r'(SCHEDULE )(\d)()', r'(الملحق \()(\d)(\))', r'(الملحق )(\d)(?!\d)()']
    for e, a in P:
        for d in (e, a):
            for pt in pats: d['t'] = re.sub(pt, fn, d['t'])
    return P

for k in (1, 2):
    json.dump(build(k), open(f'pairs_eor_m{k}.json', 'w'), ensure_ascii=False)
    print(k, len(build(k)))
