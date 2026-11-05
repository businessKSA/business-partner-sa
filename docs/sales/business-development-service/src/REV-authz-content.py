# -*- coding: utf-8 -*-
"""خطاب تفويض لعقد تطوير الأعمال كخدمة (REV). الصياغة المشتركة (البنود 4-12) من
templates/categories/authorization-letter-template-DRAFT.md (الجزء الأول)؛ وقائمة التفويض (البند 3) مشتقة من بنود عقد REV:
6.6 (تفويض تقديم طلبات التسجيل باسم العميل بلا كلمات مرور) و6.1 و2.1 و6.7. غير المحدَّد غير مفوَّض.
تحتاج مراجعة القانونية قبل الاعتماد (الاسم الداخلي للمسودة القانونية لا يظهر في مستند العميل)."""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import *
OUTNAME = 'REV-authorization-letter.html'; SHELL = 'contract'
TITLE = ('Authorization Letter', 'خطاب تفويض')
COVER = dict(eb_en='AUTHORIZATION', eb_ar='تفويض', t_en='Authorization Letter', t_ar='خطاب تفويض',
             s_en='The Second Party chooses, from a list, what it authorises the First Party to do under the Business Development service contract.',
             s_ar='يختار الطرف الثاني من قائمة ما يفوّض به الطرف الأول ضمن عقد خدمة تطوير الأعمال.')
BOX = '☐'
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'templates', 'categories', 'authorization-letter-template-DRAFT.md')
OWNER = ('Baher Bakr Ali Magnas', 'باهر بكر علي مقنص')


def legal():
    out, in_p1, cur = {}, False, None
    for line in open(SRC, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('## الجزء الأول'): in_p1 = True; continue
        if line.startswith('## الجزء الثاني'): break
        if not in_p1: continue
        if line.startswith('### '): cur = line[4:].strip(); out[cur] = {}
        elif cur and line.startswith('- EN: '): out[cur]['en'] = line[6:].strip()
        elif cur and line.startswith('- AR: '): out[cur]['ar'] = line[6:].strip()
    return out


def get(d, num):
    for k, v in d.items():
        if k.startswith('%d. ' % num) and 'en' in v:
            a, b = [x.strip() for x in k.split(' / ', 1)]
            return re.sub(r'^\d+\.\s*', '', a), re.sub(r'^\d+\.\s*', '', b), v['en'], v['ar']
    raise KeyError(num)


def party(s, ar=False):
    if ar:
        return s.replace('ملحق الفئة', 'البند 3').replace('المفوَّض', 'الطرف الأول').replace('المفوِّض', 'الطرف الثاني')
    for a, b in (('the Category Annex', 'section 3'), ('The Authorised Party', 'The First Party'), ('the Authorised Party', 'the First Party'),
                 ('Authorised Party’s', 'First Party’s'), ('The Principal', 'The Second Party'), ('the Principal', 'the Second Party'),
                 ('Principal’s', 'Second Party’s')):
        s = s.replace(a, b)
    return s


DELEG = [
    ('Vendor registration', 'التسجيل كمورد',
     'Preparing and submitting vendor-registration applications and documents in the Second Party’s name on the platforms and portals of the target companies the Second Party approves, and following them up (contract clauses 4.2 and 6.6). Access is by delegated access or a separate account, never by passwords.',
     'إعداد طلبات التسجيل كمورد ومستنداتها وتقديمها باسم الطرف الثاني على منصات الشركات المستهدفة وبواباتها التي يوافق عليها، ومتابعتها (البندان 4.2 و6.6 من العقد). ويكون الوصول بتفويض وصول أو بحساب منفصل، لا بكلمات المرور.'),
    ('Communication with referred entities', 'التواصل مع الجهات المحالة',
     'Contacting the entities to which leads are delivered, introducing the Second Party and its products or services, and arranging meetings (contract clauses 2.1 and 4.3), copying business@businesspartner.sa on the correspondence.',
     'مخاطبة الجهات التي تُسلَّم فرصها، والتعريف بالطرف الثاني ومنتجاته أو خدماته، وترتيب الاجتماعات (البندان 2.1 و4.3 من العقد)، مع نسخ business@businesspartner.sa على المراسلات.'),
    ('Use of the Second Party’s documents', 'استعمال مستندات الطرف الثاني',
     'Using the commercial registration, company profile, catalogues and price lists the Second Party provides, only for the vendor registrations and communications authorised above.',
     'استعمال السجل التجاري والملف التعريفي والكتالوجات وقوائم الأسعار التي يزوّد بها الطرف الثاني، للتسجيلات والمراسلات المفوَّض بها أعلاه وحدها.'),
    ('Receiving registration notices', 'استلام إشعارات التسجيل',
     'Receiving the registration emails and notifications of the target companies on the address the Second Party designates for this purpose, and informing the Second Party of any decision or request.',
     'استلام رسائل التسجيل وإشعارات الشركات المستهدفة على العنوان الذي يحدّده الطرف الثاني لهذا الغرض، وإبلاغه بأي قرار أو طلب.'),
]


def blocks():
    d = legal()
    B = []
    B.append([H(2, 'Services covered', 'الخدمات المشمولة'),
              R('2.1', 'Only the services of the Business Development service contract between the parties, within the package selected there, and only the delegations the Second Party ticks in section 3. Anything not ticked is not authorised.',
                'خدمات عقد خدمة تطوير الأعمال بين الطرفين ضمن الباقة المختارة فيه، والتفويضات التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدَّد غير مفوَّض.')])
    rows = [H(3, 'Delegation list: the Second Party ticks what it authorises', 'قائمة التفويض: يحدّد الطرف الثاني ما يفوّض به'),
            R('3.1', 'Tick %s each delegation the Second Party authorises. Each may be stopped immediately by written notice, and runs for the term in section 9.' % BOX,
              'يضع الطرف الثاني علامة %s أمام كل تفويض يمنحه. ولكل بند إيقافه فوراً بإشعار كتابي، ويسري للمدة المذكورة في البند 9.' % BOX)]
    for i, (te, ta, be, ba) in enumerate(DELEG, 2):
        rows.append(R('3.%d' % i, '%s <b>%s</b>: %s' % (BOX, te, be), '%s <b>%s</b>: %s' % (BOX, ta, ba)))
    B.append(rows)
    for num, label in ((3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 9), (9, 10), (10, 11), (11, 12), (12, 13)):
        # بنود القالب 3..11 تصير 4..12 هنا
        t_en, t_ar, b_en, b_ar = get(d, num)
        b_en, b_ar, t_en, t_ar = party(b_en), party(b_ar, True), party(t_en), party(t_ar, True)
        if num == 3:
            b_en = b_en.replace('Within the covered services only, the First Party may:', 'Within the delegations the Second Party has ticked in section 3 only, the First Party may:')
            b_ar = b_ar.replace('ضمن الخدمات المشمولة وحدها، للطرف الأول:', 'ضمن التفويضات التي حدّدها الطرف الثاني في البند 3 وحدها، للطرف الأول:')
            b_en = re.sub(r'\(d\) pay official fees[^;]*; ', '', b_en); b_en = b_en.replace('(e) communicate', '(d) communicate')
            b_ar = re.sub(r'\(د\) سداد الرسوم الرسمية[^؛]*؛ ', '', b_ar); b_ar = b_ar.replace('(هـ) مخاطبة', '(د) مخاطبة')
        if num == 4:
            b_en = b_en.replace('named staff in section 7', 'named staff in section 8')
            b_ar = b_ar.replace('المسمّين في البند 7', 'المسمّين في البند 8')
            b_en = b_en.replace('(b) receive or hold the Second Party’s funds other than deposits for official fees', '(b) receive or hold the Second Party’s funds')
            b_ar = b_ar.replace('(ب) استلام أو حيازة أموال الطرف الثاني غير ودائع الرسوم الرسمية', '(ب) استلام أو حيازة أموال الطرف الثاني')
        if num == 6:
            b_en = 'No official fees are paid by the First Party on the Second Party’s behalf under this letter; registration fees charged by buying entities are the Second Party’s own (contract clause 10.1).'
            b_ar = 'لا يدفع الطرف الأول أي رسوم رسمية نيابةً عن الطرف الثاني بموجب هذا الخطاب؛ ورسوم التسجيل التي تفرضها الجهات المشترية على الطرف الثاني نفسه (البند 10.1 من العقد).'
        if num == 7:
            b_en = 'The First Party acts only through its named staff: %s, Chief Executive Officer; other named staff: [●] (identification details are kept in the executed copy).' % OWNER[0]
            b_ar = 'يعمل الطرف الأول عبر موظفيه المسمّين وحدهم: %s، المدير التنفيذي؛ وموظفون آخرون مسمّون: [●] (وبيانات الهوية في النسخة الموقّعة).' % OWNER[1]
        if num == 8:
            b_en = re.sub(r'or \[●\] months \[recommended maximum 12\]', 'or [●] months', b_en)
            b_ar = b_ar.replace('أو بعد [●] شهراً [الحد الأقصى المقترح 12]', 'أو بعد [●] شهراً')
            b_en = b_en.replace('covered services', 'delegated services').replace('and removes any platform delegation within [2] business days', 'and removes any platform delegation within 2 business days')
            b_ar = b_ar.replace('الخدمات المشمولة', 'الخدمات المفوَّض بها').replace('خلال [2] يوم عمل', 'خلال 2 يوم عمل')
            b_en = b_en.replace('hands over documents and receipts', 'hands over documents')
            b_ar = b_ar.replace('ويسلّم المستندات والإيصالات', 'ويسلّم المستندات')
        if num == 9:
            b_en = b_en.replace('deposits official fees, ', '')
            b_ar = b_ar.replace('ويودع الرسوم الرسمية، ', '')
        if num == 10:
            b_en = b_en.replace('within [2] business days', 'within 2 business days').replace('and the Data Schedule of the service agreement', 'of the service agreement')
            b_ar = b_ar.replace('خلال [2] يوم عمل', 'خلال 2 يوم عمل').replace('وجدول البيانات في عقد الخدمة', 'في عقد الخدمة')
        B.append([H(label, t_en, t_ar), R('%d.1' % label, b_en, b_ar)])
    return B
