# Turns plain clause pairs into table specs (QMOVE-style contract design). Each spec is rendered by ctgen.py.
import re

def _find(P, prefix):
    for i, (e, a) in enumerate(P):
        if e['t'].startswith(prefix): return i
    raise KeyError(prefix)

def _spec(title, cols, head, rows, **kw):
    s = dict(title=title, cols=cols, head=head, rows=rows); s.update(kw)
    return ({'t': '@@T', 'ar': False, 'spec': s}, {'t': '@@T', 'ar': True, 'spec': s})

EN_M = r'\(([a-f])\) '
AR_M = r'\((أ|ب|ج|د|هـ|و)\) '

def _items(t, marker):
    parts = re.split(marker, t)
    intro = parts[0].strip(); items = [parts[i + 2].strip() for i in range(0, len(parts) - 2, 2)]
    items = [re.sub(r'[;؛]?\s*(and|و)?\s*$', '', x).rstrip('.;؛ ') for x in items]
    items = [re.sub(r'^(and|و)\s+', '', x) for x in items]
    return intro, items

def _kv(rows): return [[(l[0], l[1]), (v[0], v[1])] for l, v in rows]

def build(P, model, ph):
    P = list(P)
    P = [(e, a) for e, a in P]
    def rep(i, n, new):
        P[i:i + n] = new
    # ---- parties
    i = _find(P, '(1) Business Partner Solutions')
    bp = _spec(('First Party — Business Partner', 'الطرف الأول — بزنس بارتنر'), '1fr 2.6fr', None, _kv([
        (('Name', 'الاسم'), ('Business Partner Solutions Company ("Business Partner" and "First Party")', 'شركة بزنس بارتنر سلوشنز («بزنس بارتنر» و«الطرف الأول»)')),
        (('Legal form', 'الشكل القانوني'), ('Limited liability company under the laws of the Kingdom of Saudi Arabia', 'شركة ذات مسؤولية محدودة وفق أنظمة المملكة العربية السعودية')),
        (('Unified National Number', 'الرقم الوطني الموحد'), ('7038825860 (Commercial Registration)', '7038825860 (السجل التجاري)')),
        (('VAT registration no.', 'الرقم الضريبي'), ('312079341500003', '312079341500003')),
        (('National address', 'العنوان الوطني'), ('King Khaled Branch Road, Al Asemah District, Building 9214, Secondary No. 5076, Ad Diriyah 13714, Kingdom of Saudi Arabia (short address RDAA9214)', 'طريق الملك خالد الفرعي، حي العاصمة، مبنى 9214، الرقم الفرعي 5076، الدرعية 13714، المملكة العربية السعودية (العنوان المختصر RDAA9214)')),
        (('E-mail', 'البريد الإلكتروني'), ('business@businesspartner.sa', 'business@businesspartner.sa')),
        (('Represented by', 'يمثّلها'), ('Mr. Baher Bakr Ali Magnas, General Manager', 'السيد باهر بكر علي مقنص، المدير العام')),
    ]), keep=True)
    rep(i, 1, [bp])
    j = _find(P, '(2) [[CLIENT_NAME]]')
    cl = _spec(('Second Party — the Client', 'الطرف الثاني — العميل'), '1fr 2.6fr', None, _kv([
        (('Name', 'الاسم'), ('[[CLIENT_NAME]] (the "Client" and "Second Party")', '[[CLIENT_NAME]] («العميل» و«الطرف الثاني»)')),
        (('Legal form', 'الشكل القانوني'), ('Mixed Norwegian–Saudi company under incorporation', 'شركة مختلطة نرويجية سعودية تحت التأسيس')),
        (('Registration no.', 'رقم القيد'), ('[[CLIENT_REG_NO]]', '[[CLIENT_REG_NO]]')),
        (('Address', 'العنوان'), ('[[CLIENT_ADDRESS]]', '[[CLIENT_ADDRESS]]')),
        (('E-mail', 'البريد الإلكتروني'), ('[[CLIENT_EMAIL]]', '[[CLIENT_EMAIL]]')),
        (('Represented by', 'يمثّلها'), ('[[SIGNATORY_NAME]], [[SIGNATORY_TITLE]]', '[[SIGNATORY_NAME]]، [[SIGNATORY_TITLE]]')),
    ]), keep=True)
    rep(j, 1, [cl])
    # ---- contract details (replaces the two sentences)
    k = _find(P, 'Parties: as stated above')
    pm = ('Model 1 (Transparent Cost), as set out in Schedule 2', 'النموذج (1) التكلفة بشفافية، وفق الملحق (2)') if model == 1 else ('Model 2 (Full Employee Cost), as set out in Schedule 2', 'النموذج (2) تكلفة الموظف الكاملة، وفق الملحق (2)')
    det = _spec(None, '1fr 2.6fr', None, _kv([
        (('Type of service', 'نوع الخدمة'), ('Employer of Record and Service Transfer Services', 'خدمات التعاقد ونقل الخدمات')),
        (('Employees', 'الموظفون'), ('As listed in Schedule 1', 'كما في الملحق (1)')),
        (('Start date', 'تاريخ البدء'), ('[[START_DATE]]', '[[START_DATE]]')),
        (('Term', 'المدة'), ('Twelve (12) months minimum, renewable under Clause 16', '12 شهراً كحد أدنى، وتتجدد وفق البند (16)')),
        (('Renewal date', 'تاريخ التجديد'), ('[[RENEWAL_DATE]]', '[[RENEWAL_DATE]]')),
        (('Working hours', 'ساعات العمل'), ('[[WORKING_HOURS]]', '[[WORKING_HOURS]]')),
        (('Monthly invoice', 'الفاتورة الشهرية'), ('Payable within seven (7) days of its date', 'تُسدَّد خلال 7 أيام من تاريخها')),
        (('Advance payment', 'الدفعة المقدمة'), ('Two (2) months, as stated in Clause 7', 'شهران وفق البند (7)')),
        (('Pricing Model', 'نموذج التسعير'), pm),
        (('Service provider\'s bank', 'مصرف مقدم الخدمة'), ('Al Rajhi Bank', 'مصرف الراجحي')),
        (('Account number', 'رقم الحساب'), ('511000010006086228498', '511000010006086228498')),
        (('IBAN', 'الآيبان'), ('SA5380000511608016228498', 'SA5380000511608016228498')),
    ]), keep=True)
    rep(k, 2, [det])
    # ---- definitions
    first = _find(P, '1.1 "Applicable Law"')
    last = first
    while re.match(r'^1\.\d+ "', P[last + 1][0]['t']): last += 1
    rows = []
    for e, a in P[first:last + 1]:
        me = re.match(r'^(\d+\.\d+) "([^"]+)" (?:means )?(.*)$', e['t'], re.S)
        ma = re.match(r'^(\d+-\d+) «([^»]+)»: (.*)$', a['t'], re.S)
        assert me and ma, (e['t'][:60], a['t'][:60])
        rows.append([(me.group(1), ma.group(1)), (me.group(2), ma.group(2)), (me.group(3)[0].upper() + me.group(3)[1:], ma.group(3))])
    defs = _spec(None, '.65fr 1.1fr 3.2fr', [('No.', 'م'), ('Term', 'المصطلح'), ('Definition', 'التعريف')], rows)
    rep(first, last - first + 1, [defs])
    # ---- 2.1 services
    s = _find(P, '2.1 Business Partner shall provide')
    e, a = P[s]
    ie, ee = _items(e['t'], EN_M); ia, aa = _items(a['t'], AR_M)
    assert len(ee) == len(aa) == 6, (len(ee), len(aa))
    titles = [('Service transfer', 'نقل الخدمات'), ('Residence and work permits', 'الإقامات ورخص العمل'), ('Transfer and visa fees', 'رسوم النقل والتأشيرة'), ('Recruitment from abroad', 'الاستقدام من الخارج'), ('Insurance', 'التأمينات'), ('Payroll and entitlements', 'الرواتب والمستحقات')]
    rows = [[(str(n + 1),) * 2, titles[n], (ee[n][0].upper() + ee[n][1:], aa[n])] for n in range(6)]
    srv = _spec((ie, ia), '.3fr 1.2fr 3fr', [('No.', 'م'), ('Service', 'الخدمة'), ('Details', 'التفاصيل')], rows)
    rep(s, 1, [srv])
    # ---- 3.1 conditions + 3.2 + 3.3
    c = _find(P, '3.1 The performance of the services')
    e, a = P[c]
    ie, ee = _items(e['t'], EN_M); ia, aa = _items(a['t'], AR_M)
    assert len(ee) == len(aa) == 4
    titles = [('Qiwa acceptance', 'القبول عبر قوى'), ('Employee documents', 'مستندات الموظف'), ('Client documents', 'مستندات العميل'), ('Advance Payment', 'الدفعة المقدمة')]
    rows = [[(f'3.1.{n+1}', f'3-1-{n+1}'), titles[n], (ee[n][0].upper() + ee[n][1:], aa[n])] for n in range(4)]
    e2, a2 = P[c + 1]; e3, a3 = P[c + 2]
    for (ee_, aa_, num, ttl) in ((e2, a2, ('3.2', '3-2'), ('Adoption of the Agreement', 'تبنّي الاتفاقية')), (e3, a3, ('3.3', '3-3'), ('Right to decline or suspend', 'حق الرفض أو التعليق'))):
        rows.append([num, ttl, (re.sub(r'^\d\.\d ', '', ee_['t']), re.sub(r'^\d-\d ', '', aa_['t']))])
    cond = _spec((ie, ia), '.55fr 1.2fr 3fr', [('No.', 'م'), ('Condition', 'الشرط'), ('Details', 'التفاصيل')], rows)
    rep(c, 3, [cond])
    # ---- 5.1 / 5.2 obligations
    for pref, ttl in (('5.1 Business Partner shall', None), ('5.2 The Client shall', None)):
        o = _find(P, pref); e, a = P[o]
        ie, ee = _items(e['t'], EN_M); ia, aa = _items(a['t'], AR_M)
        assert len(ee) == len(aa) >= 4
        rows = [[(str(n + 1),) * 2, (ee[n][0].upper() + ee[n][1:], aa[n])] for n in range(len(ee))]
        ob = _spec((ie, ia), '.3fr 4fr', [('No.', 'م'), ('Obligation', 'الالتزام')], rows)
        rep(o, 1, [ob])
    # ---- signatures
    w = _find(P, 'IN WITNESS')
    sg_e = P[w + 1]  # 'Signed for and on behalf of:' ... up to the last 'Signature:' row
    end = w + 1
    while not P[end][0]['t'].startswith('Signature:') or end < w + 5: end += 1
    sig = _spec(('Signed for and on behalf of', 'وُقّع نيابةً عن'), '1.3fr 1.2fr 1fr 1fr .8fr',
                [('Party', 'الجهة'), ('Name', 'الاسم'), ('Title', 'الصفة'), ('Signature and stamp', 'التوقيع والختم'), ('Date', 'التاريخ')],
                [[('Business Partner Solutions Company', 'شركة بزنس بارتنر سلوشنز'), ('Baher Bakr Ali Magnas', 'باهر بكر علي مقنص'), ('General Manager', 'المدير العام'), ('', ''), ('', '')],
                 [('[[CLIENT_NAME]]', '[[CLIENT_NAME]]'), ('[[SIGNATORY_NAME]]', '[[SIGNATORY_NAME]]'), ('[[SIGNATORY_TITLE]]', '[[SIGNATORY_TITLE]]'), ('', ''), ('', '')]], rowh=90)
    rep(w + 1, end - w, [sig])
    # ---- schedule 1 employee rows
    for pref in ('Row 1 —', 'Row 2 —'):
        r = _find(P, pref); e, a = P[r]
        he, be = e['t'].split(': ', 1); ha, ba = a['t'].split(': ', 1)
        pe = [x.strip().rstrip('.') for x in be.split('; ')]; pa = [x.strip().rstrip('.') for x in ba.split('؛ ')]
        if len(pe) != len(pa): continue
        rows = []
        for x, y in zip(pe, pa):
            kx, vx = x.split(': ', 1); ky, vy = y.split(': ', 1)
            rows.append([(kx, ky), (vx, vy)])
        rep(r, 1, [_spec((he, ha), '1fr 2.6fr', None, rows)])
    # ---- schedule 2 (M1) stages + basis tables
    def basis(prefix):
        b = _find(P, prefix); e, a = P[b]
        he, be = e['t'].split('): ', 1); ha, ba = a['t'].split('): ', 1)
        he += ')'; ha += ')'
        cut = be.find(' Items (1)'); tail_e = be[cut:].strip() if cut > 0 else ''; be = be[:cut] if cut > 0 else be
        cuta = ba.find(' البنود من'); tail_a = ba[cuta:].strip() if cuta > 0 else ''; ba = ba[:cuta] if cuta > 0 else ba
        pe = re.split(r'\(\d\) ', be)[1:]; pa = re.split(r'\(\d\) ', ba)[1:]
        assert len(pe) == len(pa), prefix
        rows = []
        for n, (x, y) in enumerate(zip(pe, pa)):
            x = x.strip().rstrip(';. '); y = y.strip().rstrip('؛. ')
            kx, vx = (x.split(': ', 1) + [''])[:2]; ky, vy = (y.split(': ', 1) + [''])[:2]
            rows.append([(str(n + 1),) * 2, (kx[0].upper() + kx[1:], ky), (vx, vy)])
        out = [_spec((he[:1].upper() + he[1:], ha), '.3fr 1.1fr 3fr', [('No.', 'م'), ('Item', 'البند'), ('Basis', 'الأساس')], rows)]
        if tail_e: out.append(({'t': tail_e, 'ar': False}, {'t': tail_a, 'ar': True}))
        rep(b, 1, out)
    for pref in ('Basis of calculating',):
        while True:
            try: basis(pref)
            except KeyError: break
    if model == 1:
        st = _find(P, 'Stages and payment:'); e, a = P[st]
        ie, be = e['t'].split(': ', 1); ia, ba = a['t'].split(': ', 1)
        ee = re.split(r'\(([A-E])\) ', be); aa = re.split(r'\((أ|ب|ج|د|هـ)\) ', ba)
        pe = [ee[i + 2].strip() for i in range(0, len(ee) - 2, 2)]; pa = [aa[i + 2].strip() for i in range(0, len(aa) - 2, 2)]
        assert len(pe) == len(pa) == 5, (len(pe), len(pa))
        rows = []
        for n, (x, y) in enumerate(zip(pe, pa)):
            tx, dx = x.split(': ', 1) if ': ' in x else (x, ''); ty, dy = y.split(': ', 1) if ': ' in y else (y, '')
            rows.append([('ABCDE'[n], 'أبجدهـ'[n] if n < 4 else 'هـ'), (tx[0].upper() + tx[1:], ty), (dx, dy)])
        # last sentence (VAT) sits at the end of item E
        rep(st, 1, [_spec((ie[0].upper() + ie[1:] + ':', ia + ':'), '.25fr 1.2fr 3.2fr', [('', ''), ('Stage', 'المرحلة'), ('What and how', 'ماذا وكيف')], rows)])
    # ---- localisation at a glance
    sc = _find(P, 'SCHEDULE 3 — LOCALISATION')
    glance = _spec(('Localisation Fee at a glance', 'رسوم التوطين في لمحة'), '2fr 1.3fr', [('Case', 'الحالة'), ('Fee per Employee per month', 'الرسم لكل موظف شهرياً')], [
        [('Occupation with no localisation decision', 'مهنة بلا قرار توطين'), ('SAR 900', '900 ريال')],
        [('Occupation with a localisation decision', 'مهنة عليها قرار توطين'), ('Cost of the Saudis the ratio requires, divided across the foreign Employees (below)', 'تكلفة السعوديين الذين تتطلبهم النسبة مقسومة على الموظفين الأجانب (أدناه)')],
        [('Client takes Saudis through Business Partner', 'يأخذ العميل سعوديين عبر Business Partner'), ('No Localisation Fee', 'بلا رسوم توطين')]])
    P.insert(sc + 1, glance)
    # ---- allocation matrix (last schedule)
    ia = [i for i, (e, a) in enumerate(P) if e['t'].startswith('Borne by the Client:')][0]
    ce, ca = P[ia]; be_, ba_ = P[ia + 1]; me_, ma_ = P[ia + 2]
    cl_e = [x.strip().rstrip('.') for x in re.sub(r'^Borne by the Client: ', '', ce['t']).split('; ')]
    cl_a = [x.strip().rstrip('.') for x in re.sub(r'^على العميل: ', '', ca['t']).split('؛ ')]
    cl_e = [re.sub(r'^and ', '', x) for x in cl_e]; cl_a = [re.sub(r'^و', '', x) if x.startswith('والمسؤولية') else x for x in cl_a]
    body_e = be_['t'].split(': ', 1)[1].split('. ')[0]; body_a = be_a = ba_['t'].split(': ', 1)[1].split('. ')[0]
    bp_e = [re.sub(r'^and ', '', x.strip()) for x in body_e.rstrip('.').split('; ')]; bp_a = [re.sub(r'^و(?=نهاية)', '', x.strip()) for x in body_a.rstrip('.').split('؛ ')]
    assert len(cl_e) == len(cl_a) and len(bp_e) == len(bp_a), (len(cl_e), len(cl_a), len(bp_e), len(bp_a))
    rows = [[(x[0].upper() + x[1:], y), ('✓', '✓'), ('', '')] for x, y in zip(cl_e, cl_a)]
    rows += [[(x[0].upper() + x[1:], y), ('', ''), ('✓', '✓')] for x, y in zip(bp_e, bp_a)]
    rows.append([('Arranging recruitment from abroad where required: authorisations, employment contracts, embassy papers and documents', 'ترتيب الاستقدام من الخارج عند اللزوم: التفويضات وعقود العمل وأوراق السفارات والمستندات'), ('', ''), ('✓', '✓')])
    mat = _spec(('Allocation of responsibilities', 'توزيع المسؤوليات'), '3fr .8fr 1fr', [('Item', 'البند'), ('Client', 'العميل'), ('Business Partner', 'بزنس بارتنر')], rows, center=[1, 2])
    P[ia:ia + 3] = [mat, (me_, ma_)]
    # placeholders
    for e, a in P:
        if e['t'] != '@@T': e['t'] = ph(e['t'], False); a['t'] = ph(a['t'], True)
    return P
