#!/usr/bin/env python3
"""يولّد عرض سعر بترومنت على معيار تصميم «عرض تطوير الأعمال» (A4 أفقي، عربي يمين/إنجليزي يسار).
المحتوى والأسعار من العقد BP-OS-2026-001 والملحق (1). لا آيبان ولا هاتف ولا بريد في الملف:
تُقرأ من متغيرات البيئة BP_PHONE و BP_EMAIL و BP_IBAN، وإلا تُترك [●].
الاستعمال: python3 build_quote.py [out.html]"""
import os, sys, html

D = os.path.dirname(os.path.abspath(__file__))
HEAD = open(os.path.join(D, '_standard-head.html'), encoding='utf-8').read().replace('LOGOB64', open(os.path.join(D, '_logo.b64')).read().strip())
PHONE = os.environ.get('BP_PHONE', '[●]'); EMAIL = os.environ.get('BP_EMAIL', '[●]'); IBAN = os.environ.get('BP_IBAN', '[●]')
DATE = '30/09/2026'; REF = 'BP-QT-2026-0930-PM'
TITLE_EN = 'Quotation: Employment Outsourcing Services'; TITLE_AR = 'عرض سعر: خدمات إسناد العمالة'
RLM = '‏'
TOTAL = 0
LOGO = '<span class="logo" role="img" aria-label="Business Partner"></span>'


def num(x): return f'<span class="num">{x}</span>'


def ft(n):
    return ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
            f'<div class="c">{PHONE}<br>{EMAIL}<br>www.businesspartner.sa<br><span class="m">{n} / @@N@@</span></div>'
            f'<div class="w">{LOGO}</div></div>')


def sheet(body, n): return f'<section class="sheet land" lang="ar"><div dir="rtl">{body}</div>{ft(n)}</section>'


def hd2():
    return (f'<div class="hd2">{LOGO}<div class="t e"><h1>{TITLE_EN}</h1></div><div class="t a"><h1>{TITLE_AR}</h1></div></div>')


def rw(en, ar, cls=''): return f'<div class="rw {cls}"><div class="col" dir="ltr">{en}</div><div class="col" dir="rtl">{ar}</div></div>'


def h2(n, en, ar): return rw(f'<h2><span class="n">{n}</span>{en}</h2>', f'<h2><span class="n">{n}</span>{ar}</h2>')


def p(en, ar, cls=''): return rw(f'<p class="{cls}">{en}</p>', f'<p class="{cls}">{ar}{RLM}</p>')


def mtable(widths, head_en, head_ar, rows, cls='', center=()):
    """widths: نسب أعمدة جهة واحدة؛ الأعمدة العربية تُعكس. كل صف: (cells_en, cells_ar) بالترتيب نفسه."""
    cg = ''.join(f'<col style="width:{w}%">' for w in widths) + '<col style="width:2%">' + ''.join(f'<col style="width:{w}%">' for w in reversed(widths))
    def th(cells, lang): return ''.join(f'<th class="{"c " if i in center else ""}{lang}">{c}</th>' for i, c in enumerate(cells))
    def td(cells, lang): return ''.join(f'<td class="{"c " if i in center else ""}{lang}">{c}</td>' for i, c in enumerate(cells))
    out = f'<table class="pt {cls}"><colgroup>{cg}</colgroup><tr>{th(head_en, "en")}<td class="gp"></td>{th(list(reversed(head_ar)), "ar")}</tr>'
    for en, ar in rows:
        out += f'<tr>{td(en, "en")}<td class="gp"></td>{td(list(reversed(ar)), "ar")}</tr>'
    return out + '</table>'


def ltable(head_en, head_ar, rows):
    w = 45.0
    return mtable([4, w], ['#', head_en], ['#', head_ar], [([str(i), e], [str(i), a + RLM]) for i, (e, a) in enumerate(rows, 1)], cls='lt')


def card(n, en_t, ar_t, en_b, ar_b):
    price_en, price_ar = 'Price per case or per catalogue', 'السعر حسب الحالة أو بحسب الكتالوج'
    link = lambda t: f'<a href="https://www.businesspartner.sa" target="_blank" rel="noopener">{t}</a>'
    return rw(f'<div class="card"><b>{n}. {link(en_t)}</b><br>{en_b}<br><i>{price_en}</i> · {link("Learn more")}</div>',
              f'<div class="card"><b>{n}. {link(ar_t)}</b><br>{ar_b}{RLM}<br><i>{price_ar}</i> · {link("اعرف المزيد")}</div>', 'cd')

pages = []

# 1) الغلاف
pages.append(lambda n: sheet(
    f'<div class="cv"><div class="lgc">{LOGO}</div><div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div>'
    '<h1 class="pf">Employment Outsourcing Services</h1><div class="sb">We supply and employ your workforce for your sites in the Eastern Province: salary, visas, Iqama, insurance and government fees are on us.</div></div>'
    f'<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>خدمات إسناد العمالة</h1><div class="sb">نوفّر ونوظّف لك العمالة لمواقعك في المنطقة الشرقية؛ الراتب والتأشيرة والإقامة والتأمين والرسوم الحكومية علينا.{RLM}</div></div></div>'
    '<div class="pk" dir="ltr">Labor · Technical · Engineering</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">العمالية · الفنية · الهندسية</div>'
    f'<div class="ch"><div><span>To / إلى السادة</span>Alexandria Petroleum Maintenance Co. (Petromaint)<br>شركة اسكندرية للصيانة البترولية بترومنت</div><div><span>Date / التاريخ</span>{num(DATE)}</div><div><span>Ref / المرجع</span>{num(REF)}</div><div><span>Validity / صلاحية العرض</span>14 days<br>14 يوماً</div></div></div>', n))

# 2) خدمات أخرى
def p_other(n):
    cards = [
        ('Company Formation', 'تأسيس الشركات', 'We set up your entity in clear steps: commercial registration, chamber of commerce, licences, articles of association and their amendments.', 'نؤسس كيانك بخطوات واضحة: السجل التجاري، والغرفة التجارية، والتراخيص، وعقد التأسيس وتعديلاته.'),
        ('Shared Services Management', 'إدارة الخدمات المشتركة', 'HR, compliance and government relations under one annual monthly contract with a single point of contact, with our smart advisor supporting follow-up.', 'الموارد البشرية والامتثال والعلاقات الحكومية بعقد شهري سنوي ونقطة اتصال واحدة، ويدعمك المستشار الذكي في المتابعة.'),
        ('EOR & Recruitment', 'EOR والتوظيف', 'Employment on your behalf, workforce supply and recruitment, so your team can start without the administrative load.', 'توظيف بالنيابة، وتوفير العمالة، واستقدام، لتبدأ فريقك دون عبء إداري.'),
        ('Government Services Management', 'إدارة الخدمات الحكومية', 'We manage your transactions on Qiwa, Muqeem, Absher Business, GOSI, Mudad, Balady and more.', 'نتابع معاملاتك على قوى ومقيم وأبشر أعمال والتأمينات ومدد وبلدي وغيرها.'),
        ('Compliance Services', 'خدمات الامتثال', 'Compliance with localization (Saudization) and profession localization, and compliance of commercial registrations and licences. Violation follow-up: review, assessment of objection eligibility, then preparing, filing and following up the objection. The final decision rests with the competent authority.', 'الامتثال للتوطين وتوطين المهن، والامتثال للسجلات التجارية والرخص. ومتابعة المخالفات: مراجعتها ودراسة أهلية الاعتراض، ثم تجهيز الاعتراض وتقديمه ومتابعته. القرار النهائي للجهة المختصة.'),
    ]
    body = hd2() + '<div class="bp">' + rw('<h2>Other Business Partner services</h2>', '<h2>خدمات Business Partner الأخرى</h2>')
    body += ''.join(card(i, *c) for i, c in enumerate(cards, 1)) + '</div>'
    return sheet(body, n)
pages.append(p_other)

# 3) السعر
def p_price(n):
    meta = rw('<div class="meta1"><b>To:</b> Alexandria Petroleum Maintenance Co. (Petromaint)</div>' f'<div class="meta1"><b>Date:</b> {num(DATE)}</div><div class="meta1"><b>Quote validity:</b> 14 days</div>',
              '<div class="meta1"><b>إلى السادة:</b> شركة اسكندرية للصيانة البترولية بترومنت</div>' f'<div class="meta1"><b>التاريخ:</b> {num(DATE)}</div><div class="meta1"><b>صلاحية العرض:</b> 14 يوماً</div>', 'mt')
    cats = [('Labor', 'العمالية', '2,000', '2,100', '4,100', '4,715'), ('Technical', 'الفنية', '2,000', '2,350', '4,350', '5,002.5'), ('Engineering', 'الهندسية', '3,000', '3,000', '6,000', '6,900')]
    rows = [([e, 'Egypt', num(s), num(f), f'<b>{num(t)}</b>', num(v)], [a, 'مصر', num(s), num(f), f'<b>{num(t)}</b>', num(v)]) for e, a, s, f, t, v in cats]
    tbl = mtable([16, 10, 11, 11, 13, 13],
                 ['Category', 'Nationality', 'Monthly salary', 'Service fee', 'Monthly total (excl. VAT)', 'Incl. 15% VAT'],
                 ['الفئة', 'الجنسية', 'الراتب الشهري', 'رسوم الخدمة', 'الإجمالي الشهري (قبل الضريبة)', 'شامل ضريبة 15%'], rows, center=(1, 2, 3, 4, 5))
    body = hd2() + '<div class="bp">' + meta + h2(1, 'Price (SAR per worker per month)', 'السعر (ريال لكل عامل شهرياً)') + tbl
    body += p('Prices are per worker per month and exclude 15% VAT. Service fees are fixed throughout the first year of the contract. The final quantity per profession is set by written purchase orders from the client, which form part of Annex (1).',
              'الأسعار لكل عامل شهرياً وقبل ضريبة القيمة المضافة 15%. رسوم الخدمة ثابتة طوال السنة الأولى من العقد. الأعداد النهائية لكل مهنة بأوامر طلب كتابية من العميل تُعدّ جزءاً من الملحق (1).', 'note')
    body += h2(2, 'Included in the monthly price', 'ما يشمله السعر الشهري')
    inc = [('Monthly salary, payroll management and bank transfer to the worker', 'الراتب الشهري وإدارة مسيّر الرواتب والتحويل البنكي للعامل'),
           ('Visa issuance / sponsorship transfer, and first-time Iqama issuance', 'إصدار التأشيرة / نقل الخدمات، وإصدار الإقامة لأول مرة'),
           ('Work permit (expat levy) and Iqama renewal throughout the contract term', 'رخصة العمل (المقابل المالي) وتجديد الإقامة طوال مدة العقد'),
           ('Ajeer platform and Saudization (Nitaqat) compliance', 'منصة أجير ونسب التوطين (السعودة / نطاقات)'),
           ('Social insurance (GOSI)', 'التأمينات الاجتماعية (GOSI)'),
           ('Medical insurance: Labor – Class C, Technical – Class B, Engineering – Class A', 'التأمين الطبي: العمالية فئة C، الفنية فئة B، الهندسية فئة A'),
           ('Medical examination appointment and opening the worker’s bank account', 'حجز الفحص الطبي وفتح الحساب البنكي للعامل'),
           ('Annual leave (21 days) and leave allowance', 'الإجازة السنوية (21 يوماً) وبدل الإجازة'),
           ('End-of-service benefits (EOSB)', 'مكافأة نهاية الخدمة'),
           ('Air tickets (arrival, vacation and end of contract) and exit / re-entry visa', 'تذاكر الطيران (القدوم، الإجازة، نهاية العقد) وتأشيرة الخروج والعودة'),
           ('Chamber of Commerce and MOFA attestation fees related to visas', 'رسوم الغرفة التجارية وتصديق الخارجية المتعلقة بالتأشيرات')]
    body += ltable('Included', 'يشمل السعر', inc) + '</div>'
    return sheet(body, n)
pages.append(p_price)

# 4) النطاق
def p_scope(n):
    body = hd2() + '<div class="bp">' + h2(3, 'Scope: categories and professions', 'النطاق: الفئات والمهن')
    rows = [
        (['Labor', 'General laborer, maintenance worker, helper, cleaning &amp; services worker', 'Class C'], ['العمالية', 'عامل عادي، عامل صيانة، مساعد فني، عامل نظافة وخدمات', 'فئة C']),
        (['Technical', 'Mechanical technician, electrician, welder, plumber, equipment operator, HVAC technician', 'Class B'], ['الفنية', 'فني ميكانيكا، كهربائي، لحام، سباك، مشغل معدات، فني تكييف', 'فئة B']),
        (['Engineering', 'Mechanical, electrical, civil and safety engineers', 'Class A'], ['الهندسية', 'مهندس ميكانيكا، مهندس كهرباء، مهندس مدني، مهندس سلامة', 'فئة A']),
    ]
    body += mtable([14, 38, 10], ['Category', 'Professions (examples)', 'Medical insurance'], ['الفئة', 'المهن (أمثلة)', 'التأمين الطبي'], rows, center=(2,))
    body += p('Work sites: the client’s sites in the Eastern Province and any other site it designates within the Kingdom. Service start date: the date the first worker commences work with the client, and for each worker from their own commencement date. Working hours and days follow the Saudi Labor Law.',
              'مواقع العمل: مواقع العميل بالمنطقة الشرقية وأي مواقع أخرى يحددها داخل المملكة. بدء الخدمة: من مباشرة أول عامل لدى العميل، ولكل عامل من تاريخ مباشرته. ساعات وأيام العمل وفق نظام العمل السعودي.', 'note')
    body += h2(4, 'Our commitments', 'التزاماتنا')
    ob = [('We provide the services ourselves or through our partners licensed by the Ministry of Human Resources and Social Development; workers are under our sponsorship or our licensed partner’s, with supporting documents provided on request.', 'نقدّم الخدمات بأنفسنا أو عبر شركائنا المرخّصين من وزارة الموارد البشرية والتنمية الاجتماعية، وتكون العمالة على كفالتنا أو كفالة شريكنا المرخّص، مع تقديم ما يثبت ذلك عند الطلب.'),
          ('We pay workers’ salaries no later than the 5th of the following month and are solely responsible towards them for their salaries and entitlements.', 'ندفع رواتب العمالة في موعد أقصاه يوم 5 من الشهر التالي، ونكون المسؤول وحدنا أمامهم عن رواتبهم ومستحقاتهم.'),
          ('We provide the services at the agreed locations and times, and appoint an account manager to follow up with the client.', 'نقدّم الخدمة في المواقع والأوقات المتفق عليها، ونعيّن مسؤول حساب لمتابعة العميل.')]
    body += ltable('Our commitments', 'التزاماتنا', ob) + '</div>'
    return sheet(body, n)
pages.append(p_scope)

# 5) المتطلبات وما لا يشمله
def p_req(n):
    req = [('Nominating and selecting the workers and conducting the interviews; Business Partner bears no responsibility for the selection of candidates.', 'ترشيح العمالة واختيارها وإجراء المقابلات؛ ولا نتحمل مسؤولية اختيار المرشحين.'),
           ('Written purchase orders stating the quantity per profession for each batch of workers.', 'أوامر طلب كتابية تحدد العدد لكل مهنة لكل دفعة عمالة.'),
           ('Responsibility for the workers’ acts and conduct at the work sites, and for providing a safe work environment and the necessary safety equipment.', 'المسؤولية عن أعمال العمالة وتصرفاتها داخل مواقع العمل، وتوفير بيئة عمل آمنة ومعدات السلامة اللازمة.'),
           ('Payment of the security deposit (one month of the total monthly service value of the contracted workers) upon signing and before the service starts.', 'سداد دفعة التأمين (شهر واحد من إجمالي قيمة الخدمة الشهرية للعمالة المتعاقد عليها) عند التوقيع وقبل بدء الخدمة.'),
           ('Signing and stamping the balance confirmation within five (5) business days.', 'توقيع وختم مصادقة الرصيد خلال خمسة (5) أيام عمل.')]
    exc = [('Accommodation.', 'السكن.'), ('Food (catering).', 'الإعاشة (الطعام).'), ('Transportation to/from the work site.', 'المواصلات من وإلى موقع العمل.'),
           ('Overtime hours, charged at actuals at 1.5 times the hourly wage per the Labor Law, based on attendance sheets approved by the client.', 'ساعات العمل الإضافي، وتُحتسب فعلياً بمعدل 1.5 من أجر الساعة وفق نظام العمل، بكشوف حضور يعتمدها العميل.'),
           ('Medical examination cost required for Iqama issuance: SAR 90 or the actual fee at the medical center.', 'كلفة الفحص الطبي اللازم لإصدار الإقامة: 90 ريالاً أو حسب الفعلي لدى المركز الطبي.'),
           ('New government fees or taxes, or increases in existing ones, from their effective date after notifying the client.', 'أي رسوم أو ضرائب حكومية جديدة أو زيادة القائمة منها، من تاريخ سريانها بعد إشعار العميل.'),
           ('Value Added Tax (15%) as per regulations, and any item not expressly stated in this quotation.', 'ضريبة القيمة المضافة (15%) وفق الأنظمة، وأي بند غير مذكور صراحة في هذا العرض.')]
    body = hd2() + '<div class="bp">' + h2(5, 'Client Requirements', 'المتطلبات من العميل') + ltable('Client Requirements', 'المتطلبات من العميل', req)
    body += h2(6, 'Exclusions (borne by the client)', 'ما لا يشمله العرض (على العميل)') + ltable('Exclusions', 'ما لا يشمله العرض', exc) + '</div>'
    return sheet(body, n)
pages.append(p_req)

# 6) المدة والدفع
def p_pay(n):
    pay = [(['Monthly invoice', 'A monthly advance (pro-forma) invoice issued no later than the 20th, with 15% VAT added'], ['الفاتورة الشهرية', 'فاتورة شهرية مقدمة (Pro-forma) تصدر في موعد أقصاه يوم 20، وتُضاف إليها ضريبة القيمة المضافة 15%']),
           (['Payment due', 'Paid no later than the 25th of the same month'], ['موعد السداد', 'يُسدّد في موعد أقصاه يوم 25 من الشهر نفسه']),
           (['Security deposit', 'One month of the total monthly service value of the contracted workers, paid upon signing and before the service starts; refunded by offsetting it against the last month’s invoice'], ['دفعة التأمين', 'شهر واحد من إجمالي قيمة الخدمة الشهرية للعمالة المتعاقد عليها، تُسدّد عند التوقيع وقبل بدء الخدمة، وتُسترد بخصمها من فاتورة الشهر الأخير']),
           (['Overtime', 'Added to the monthly invoice at actuals based on approved attendance sheets'], ['العمل الإضافي', 'يُضاف إلى الفاتورة الشهرية بالفعلي بناءً على كشوف الحضور المعتمدة']),
           (['Payment method', 'Bank transfer to the account shown on the last page'], ['وسيلة السداد', 'تحويل بنكي على الحساب المبيّن في الصفحة الأخيرة'])]
    body = hd2() + '<div class="bp">' + h2(7, 'Term', 'المدة')
    body += p('The contract term is twelve (12) Gregorian months, starting from the commencement of the first worker. It renews automatically for a similar period unless either party notifies the other in writing of its wish not to renew two (2) months before expiry.',
              'مدة العقد اثنا عشر (12) شهراً ميلادياً من تاريخ مباشرة أول عامل. يتجدد تلقائياً لمدة مماثلة ما لم يُخطر أحد الطرفين الآخر كتابةً برغبته في عدم التجديد قبل شهرين من انتهاء المدة.')
    body += h2(8, 'Payment', 'طريقة الدفع') + mtable([14, 36], ['Item', 'Method'], ['البند', 'الطريقة'], [([a, b], [c, d]) for (a, b), (c, d) in [(x[0][0:2], x[1][0:2]) for x in pay]]) + '</div>'
    return sheet(body, n)
pages.append(p_pay)

# 7) الشروط
def p_terms(n):
    terms = [('Fees are calculated monthly per worker according to the prices in Annex (1) and remain fixed throughout the first year; after that they are reviewed by mutual written agreement through an addendum.', 'يُحتسب المقابل المالي شهرياً لكل عامل وفق الأسعار الواردة في الملحق (1)، وتكون ثابتة طوال السنة الأولى، وتُراجع بعدها باتفاق الطرفين كتابياً بملحق للعقد.'),
             ('Any addition or deduction on the invoice is based on an operating sheet showing the workers’ names, numbers and attendance, approved by both parties.', 'تتم أي إضافة أو خصم على الفاتورة بناءً على كشف تشغيل يوضح أسماء العمالة وأرقامهم وحضورهم ويعتمده الطرفان.'),
             ('If no objection to an invoice is received within three (3) business days of its receipt, it is deemed final, approved and payable.', 'إذا لم نتسلّم أي اعتراض على الفاتورة خلال ثلاثة (3) أيام عمل من استلامها، تُعدّ نهائية ومعتمدة وملزمة السداد.'),
             ('In case of late payment we notify the client in writing and may suspend the service seven (7) days after the notice.', 'في حال عدم السداد في الموعد نُخطر العميل كتابياً، ويحق لنا تعليق الخدمة بعد سبعة (7) أيام من الإشعار.'),
             ('The client’s payment obligation is independent of its actual utilization of the workers, as long as the workers are provided in accordance with the contract.', 'التزام العميل بالسداد مستقل عن مدى استفادته الفعلية من العمالة، متى كنا ملتزمين بتوفير العمالة وفق العقد.'),
             ('If the client terminates before the end of the term for a reason not attributable to us, it pays all dues until the termination date, the non-recoverable costs we incurred (including the unamortized recruitment, visa and Iqama costs) and the workers’ repatriation costs within seven (7) days.', 'إذا أنهى العميل العقد أو خدمات أي عامل قبل انتهاء المدة لسبب لا يعود إلينا، يلتزم بسداد المستحقات حتى تاريخ الإنهاء والتكاليف غير القابلة للاسترداد التي تكبدناها (بما فيها الجزء غير المستهلك من تكاليف الاستقدام والتأشيرات والإقامات) وتكاليف ترحيل العمالة خلال سبعة (7) أيام.'),
             ('Visa and sponsorship-transfer requests are subject to the approval of the competent authorities; their duration depends on those authorities’ procedures and the establishments’ Nitaqat status.', 'تخضع طلبات التأشيرات ونقل الخدمات لموافقة الجهات المختصة، وتعتمد مدتها على إجراءات تلك الجهات ونطاقات المنشآت.'),
             ('Working hours are reduced in Ramadan per the Labor Law with the full service value payable; Eid, National Day and Founding Day holidays are granted without deduction, and work on such days is charged as overtime.', 'تُخفض ساعات العمل في رمضان وفق نظام العمل مع سداد قيمة الخدمة كاملة، وتُمنح إجازات الأعياد واليوم الوطني ويوم التأسيس دون خصم، ويُحتسب العمل فيها كعمل إضافي.'),
             ('The contract is governed by the laws of the Kingdom of Saudi Arabia; disputes are settled amicably, failing which they are referred to the competent court in Riyadh.', 'يخضع العقد لأنظمة المملكة العربية السعودية، وتُحل النزاعات ودياً، وإلا أُحيلت إلى المحكمة المختصة بمدينة الرياض.')]
    body = hd2() + '<div class="bp">' + h2(9, 'Terms & Conditions', 'الشروط والأحكام') + ltable('Terms & Conditions', 'الشروط والأحكام', terms) + '</div>'
    return sheet(body, n)
pages.append(p_terms)

# 8) التوقيعان
def p_sign(n):
    def box(en, ar, company, name_title):
        f = lambda e, a, v: f'<div class="f2"><span>{e}</span><span class="v">{v}</span><span dir="rtl">{a}</span></div>'
        return (f'<div><h3><span>{en}</span><span dir="rtl">{ar}</span></h3>' + f('Company', 'الشركة', company) + f('Name', 'الاسم', num('[●]')) + f('Title', 'الصفة', name_title) + f('Date', 'التاريخ', num('[●]'))
                + '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>')
    body = hd2() + '<div class="bp">' + h2(10, 'Signatures', 'التوقيعان') + p('By signing below, both parties accept this quotation and its terms and conditions.', 'بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه.')
    body += '<div class="sg" style="direction:ltr">' + box('Business Partner Solutions', 'بزنس بارتنر سلوشنز', 'Business Partner Solutions · بزنس بارتنر سلوشنز', num('[●]')) \
        + box('Client', 'العميل', 'Alexandria Petroleum Maintenance Co. (Petromaint)<br>شركة اسكندرية للصيانة البترولية بترومنت', num('[●]')) + '</div></div>'
    return sheet(body, n)
pages.append(p_sign)

# 9) الغلاف الختامي
pages.append(lambda n: sheet(
    f'<div class="cv"><div class="lgc">{LOGO}</div><div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
    '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1><div class="bx"><div><b>Contact · التواصل</b>'
    'National address / العنوان الوطني: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 / طريق الملك خالد الفرعي، حي العاصمة، الدرعية 13714<br>'
    f'Mobile / الجوال: {num(PHONE)}<br>Email / الإيميل: {num(EMAIL)}<br>Website / الموقع: {num("www.businesspartner.sa")}</div>'
    '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: Business Partner Solutions / بزنس بارتنر سلوشنز<br>Bank / البنك: Al Rajhi Bank / مصرف الراجحي<br>'
    f'IBAN: {num(IBAN)}</div></div></div>', n))

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, 'BP_Quotation_Petromaint_v2.html')
N = len(pages)
body = ''.join(pg(i) for i, pg in enumerate(pages, 1)).replace('@@N@@', str(N))
doc = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       f'<title>{html.escape(TITLE_AR)} — Petromaint</title>{HEAD}'
       '<style>:root{--bg:#F2F4FB;--fg:#1B2340}body{margin:0;background:var(--bg)}.sheet{margin:20px auto;box-shadow:0 2px 14px rgba(11,27,90,.18)}'
       '@page{size:297mm 210mm;margin:0}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;break-after:page}}</style></head><body>'
       + body + '</body></html>')
open(out, 'w', encoding='utf-8').write(doc)
print('wrote', out, N, 'pages')
