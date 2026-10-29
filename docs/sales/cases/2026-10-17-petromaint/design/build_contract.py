#!/usr/bin/env python3
"""يولّد عقد إسناد العمالة BP-OS-2026-001 واتفاقية عدم الإفصاح لبترومنت على معيار «عرض تطوير الأعمال» (A4 طولي،
جدول متقابل عربي يمين/إنجليزي يسار بصف لكل بند). نص العقد منقول من النسخة الموقّعة الممسوحة؛ هذه نسخة معاد تنسيقها وليست بديلاً عن الموقّعة.
لا آيبان ولا هاتف ولا بريد ولا أرقام نظامية للعميل ولا هوية في الملف: تُقرأ من BP_PHONE/BP_EMAIL/BP_IBAN/CL_UNIFIED/CL_VAT وإلا [●].
الاستعمال: python3 build_contract.py [contract|nda|both]"""
import os, sys, html
D = os.path.dirname(os.path.abspath(__file__))
HEAD = open(os.path.join(D, '_standard-head.html'), encoding='utf-8').read().replace('LOGOB64', open(os.path.join(D, '_logo.b64')).read().strip())
E = os.environ.get
PHONE, EMAIL, IBAN = E('BP_PHONE', '[●]'), E('BP_EMAIL', '[●]'), E('BP_IBAN', '[●]')
CL_UNI, CL_VAT = E('CL_UNIFIED', '[●]'), E('CL_VAT', '[●]')
RLM = '‏'
LOGO = '<span class="logo" role="img" aria-label="Business Partner"></span>'
num = lambda x: f'<span class="num">{x}</span>'


def rich(s):
    s = s.replace('&', '&amp;') if '&amp;' not in s else s
    return s.replace('\n• ', '<br>▪ ').replace('\n', '<br>')


def ft(n, N):
    return ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
            f'<div class="c">{PHONE}<br>{EMAIL}<br>www.businesspartner.sa<br><span class="m">{n} / {N}</span></div><div class="w">{LOGO}</div></div>')


def hd(ar, en):
    return (f'<div class="hd" dir="ltr">{LOGO}<div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">{ar}</h1>'
            f'<div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">{en}</div></div></div>')


def pty(title_en, title_ar, rows):
    t = f'<table class="pty2"><tr><th colspan="3"><span>{title_en}</span><span dir="rtl">{title_ar}</span></th></tr>'
    for en, v, ar in rows: t += f'<tr><td>{en}</td><td class="v">{v}</td><td>{ar}</td></tr>'
    return t + '</table>'


def clause(n, en_t, ar_t, en, ar):
    return f'<tr><td class="en"><b>{n}. {en_t}</b><br>{rich(en)}</td><td class="ar"><b><bdi>{n}</bdi>{RLM}. {ar_t}</b><br>{rich(ar)}{RLM}</td></tr>'


def weight(r):  # تقدير الارتفاع بالبكسل
    import re
    en = len(re.sub('<[^>]+>', '', r.split('<td class="ar">')[0])); ar = len(re.sub('<[^>]+>', '', r.split('<td class="ar">')[1]))
    return (max(en, ar) / 56 + 1.3) * 16.4 + 9


def sg(first, second):
    def box(en, ar, name, title):
        f = lambda e, a, v: f'<div class="f2"><span>{e}</span><span class="v">{v}</span><span dir="rtl">{a}</span></div>'
        return (f'<div><h3><span>{en}</span><span dir="rtl">{ar}</span></h3>' + f('Name', 'الاسم', name) + f('Title', 'الصفة', title) + f('Date', 'التاريخ', num('[●]'))
                + '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>')
    return '<div class="sg" style="direction:ltr">' + box('First Party', 'الطرف الأول', *first) + box('Second Party', 'الطرف الثاني', *second) + '</div>'


def paginate(title_ar, title_en, head_block, head_h, rows, tails, usable=860):
    """يوزّع الصفوف ثم كتل الذيل [(html, ارتفاع)] على صفحات طولية؛ كل كتلة تنزل لصفحة جديدة إن لم تتسع."""
    pages, cur, used, first = [], [], head_h, True
    for r in rows:
        w = weight(r)
        if used + w > usable:
            pages.append([first, cur, '']); cur, used, first = [], 0, False
        cur.append(r); used += w
    pages.append([first, cur, ''])
    for html_, h in tails:
        if used + h > usable:
            pages.append([False, [], '']); used = 0
        pages[-1][2] += html_; used += h
    N = len(pages); out = ''
    for i, (is_first, rs, extra) in enumerate(pages, 1):
        body = hd(title_ar, title_en) + (head_block if is_first else '')
        if rs: body += '<table class="cl">' + ''.join(rs) + '</table>'
        body += extra
        out += f'<section class="sheet port" lang="ar"><div dir="rtl">{body}</div>{ft(i, N)}</section>'
    return out


def wrap(title, body):
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{html.escape(title)}</title>{HEAD}<style>:root{{--bg:#F2F4FB;--fg:#1B2340}}body{{margin:0;background:var(--bg)}}.sheet{{margin:20px auto;box-shadow:0 2px 14px rgba(11,27,90,.18)}}'
            '.pre{margin:8px 0 4px}.cl td{padding:5px 9px}.cl{margin-top:6px}@page{size:210mm 297mm;margin:0}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;break-after:page}}</style></head><body>'
            + body + '</body></html>')


BP_ROWS = [('Name', 'Business Partner Solutions Company<br><span dir="rtl">شركة بزنس بارتنر سلوشنز</span>', 'الاسم'), ('Legal form', 'Limited Liability Company (Single Person)<br><span dir="rtl">ذات مسؤولية محدودة (شخص واحد)</span>', 'الكيان'),
           ('Unified / CR No.', num('7038825860') + ' / ' + num('1009014355'), 'الرقم الموحد / السجل التجاري'), ('VAT No.', num('312079341500003'), 'الرقم الضريبي'),
           ('National Address', num('RHSC2978') + '<br>Building 2978, Turki Ibn Abdullah Aal Saud St., Al Sulaimaniyah, Riyadh 12234', 'العنوان الوطني'),
           ('Represented by', 'Baher Bakr Ali Magnas<br><span dir="rtl">باهر بكر علي مقنص</span>', 'يمثلها'), ('Title', 'Manager<br><span dir="rtl">المدير</span>', 'الصفة')]
CL_ROWS = [('Name', 'Alexandria Petroleum Maintenance Co. (Petromaint) – Branch of a Foreign Company<br><span dir="rtl">شركة اسكندرية للصيانة البترولية بترومنت (فرع شركة أجنبية)</span>', 'الاسم'),
           ('Unified No.', num(CL_UNI), 'الرقم الموحد'), ('VAT No.', num(CL_VAT), 'الرقم الضريبي'),
           ('Address', 'King Fahd Bin Abdulaziz Rd., Al Qashlah Dist., Dhahran 34232<br><span dir="rtl">الظهران – حي القشلة – طريق الملك فهد بن عبدالعزيز – 34232</span>', 'العنوان'),
           ('Represented by', 'Ibrahim Hussein Mohamed Eleryan<br><span dir="rtl">إبراهيم حسين محمد العريان</span>', 'يمثلها'), ('Title', 'General Manager<br><span dir="rtl">المدير العام</span>', 'الصفة')]

# ───── العقد ─────
C = [  # (رقم, عنوان EN, عنوان AR, EN, AR)
 ('1', 'Preamble', 'التمهيد', 'Whereas the Second Party wishes to benefit from the First Party’s services in providing manpower for its sites within the Kingdom, and whereas the First Party is capable of providing such services, the Parties, having full legal capacity, have agreed as follows. This preamble and the annexes form an integral part of this Agreement.',
  'حيث إن الطرف الثاني يرغب في الاستفادة من خدمات الطرف الأول في توفير العمالة لمواقعه داخل المملكة، وحيث إن الطرف الأول لديه القدرة على تقديم هذه الخدمات، فقد اتفق الطرفان على ما يلي بكامل أهليتهما المعتبرة شرعاً ونظاماً، ويُعد هذا التمهيد والملاحق جزءاً لا يتجزأ من الاتفاقية.'),
 ('2', 'Contract Particulars', 'بيانات العقد',
  'Scope & Locations: provision of manpower (labor / technical / engineering) to work at the Second Party’s sites in the Eastern Province and any other sites it designates within the Kingdom, as per the numbers and professions approved in Annex (1).\nService Start Date: from the date the first worker commences work with the Second Party, and for each worker from his own commencement date.\nContract Term: (12) Gregorian months. Renewal: automatically renewed for a similar period unless either Party notifies the other in writing of its wish not to renew two (2) months before expiry.\nWorking Hours & Days: as per the Saudi Labor Law.\nInvoicing & Payment: a monthly advance (pro-forma) invoice issued no later than the 20th and paid no later than the 25th of the same month.\nAdvance Payment (Security Deposit): equivalent to one (1) month of the total monthly service value, paid upon signing, and refunded by offsetting it against the last month’s invoice of the contract.\nFirst Party Bank Account: Al Rajhi Bank — Business Partner Solutions Company — IBAN: ' + IBAN,
  'نطاق العمل والمواقع: توفير عمالة (عمالية / فنية / هندسية) للعمل في مواقع الطرف الثاني بالمنطقة الشرقية وأي مواقع أخرى يحددها داخل المملكة، وفق الأعداد والمهن المعتمدة في الملحق رقم (1).\nتاريخ بدء الخدمة: من تاريخ مباشرة أول عامل لدى الطرف الثاني، ولكل عامل من تاريخ مباشرته.\nمدة العقد: (12) شهراً ميلادياً. التجديد: يتجدد تلقائياً لمدة مماثلة ما لم يُخطر أحد الطرفين الآخر كتابةً برغبته في عدم التجديد قبل شهرين (2) من انتهاء المدة.\nساعات وأيام العمل: وفق نظام العمل السعودي.\nالفوترة والسداد: فاتورة شهرية مقدمة (Pro-forma) تصدر في موعد أقصاه يوم (20) وتُسدّد في موعد أقصاه يوم (25) من الشهر نفسه.\nالدفعة المقدمة (تأمين): ما يعادل قيمة شهر (1) واحد من إجمالي قيمة الخدمة الشهرية، تُسدد عند التوقيع، وتُسترد بخصمها من فاتورة الشهر الأخير من العقد.\nحساب الطرف الأول البنكي: مصرف الراجحي — باسم: شركة بزنس بارتنر سلوشنز — الآيبان: ' + IBAN),
 ('2-1', 'First Party’s Obligations', 'التزامات الطرف الأول', 'The First Party shall provide the services itself or through its partners licensed by the Ministry of Human Resources and Social Development. The workers shall be under the sponsorship of the First Party or its licensed partner, and supporting documents shall be provided to the Second Party upon request.',
  'يقدم الطرف الأول الخدمات بنفسه أو من خلال شركائه المرخصين من وزارة الموارد البشرية والتنمية الاجتماعية، وتكون العمالة على كفالة الطرف الأول أو شريكه المرخص، ويقدم للطرف الثاني ما يثبت ذلك عند الطلب.'),
 ('2-2', 'Costs borne by the First Party', 'ما يتحمله الطرف الأول', 'The First Party shall bear, within the monthly service value, all of the following fees and costs:\n• Monthly salary, payroll management and bank transfer to the worker\n• Visa issuance / sponsorship transfer, and first-time Iqama issuance\n• Work permit (expat levy) and Iqama renewal throughout the contract term\n• Ajeer platform and Saudization (Nitaqat) compliance\n• Social insurance (GOSI)\n• Medical insurance: Labor – Class (C), Technical – Class (B), Engineering – Class (A)\n• Booking the medical examination appointment and opening the worker’s bank account\n• Annual leave (21 days) and leave allowance\n• End-of-service benefits (EOSB)\n• Air tickets (arrival, vacation and end of contract)\n• Exit / Re-entry visa\n• Chamber of Commerce and MOFA attestation fees related to visas',
  'يتحمل الطرف الأول ضمن قيمة الخدمة الشهرية جميع الرسوم والتكاليف التالية:\n• الراتب الشهري وإدارة مسيّر الرواتب والتحويل البنكي للعامل\n• إصدار التأشيرة / نقل الخدمات، وإصدار الإقامة (هوية مقيم) لأول مرة\n• رخصة العمل (المقابل المالي) وتجديد الإقامة طوال مدة العقد\n• منصة أجير ونسب التوطين (السعودة / نطاقات)\n• التأمينات الاجتماعية (GOSI)\n• التأمين الطبي: المهن العمالية فئة (C) – الفنية فئة (B) – الهندسية فئة (A)\n• حجز موعد الفحص الطبي وفتح الحساب البنكي للعامل\n• الإجازة السنوية (21 يوماً) وبدل الإجازة\n• مكافأة نهاية الخدمة\n• تذاكر الطيران (القدوم، الإجازة، نهاية العقد)\n• تأشيرة الخروج والعودة\n• رسوم الغرفة التجارية وتصديق الخارجية المتعلقة بالتأشيرات'),
 ('2-3', 'Salaries', 'الرواتب', 'The First Party shall pay the workers’ salaries no later than the 5th of the following month, and shall be solely responsible towards the workers for their salaries and entitlements in accordance with the Labor Law.',
  'يلتزم الطرف الأول بصرف رواتب العمالة في موعد أقصاه يوم (5) من الشهر التالي، وهو المسؤول وحده أمام العمالة عن رواتبهم ومستحقاتهم وفق نظام العمل.'),
 ('2-4', 'Service Delivery', 'تقديم الخدمة', 'The First Party shall provide the services at the agreed locations and times, and shall appoint an account manager to follow up with the Second Party.',
  'يلتزم الطرف الأول بتقديم الخدمة في المواقع والأوقات المتفق عليها، وتعيين مسؤول حساب لمتابعة الطرف الثاني.'),
 ('3-1', 'Second Party’s Obligations: Payment', 'التزامات الطرف الثاني: السداد', 'To pay the monthly invoices on the due dates set out in the Contract Particulars.', 'سداد قيمة الفواتير الشهرية في مواعيدها الموضحة في بيانات العقد.'),
 ('3-2', 'Costs borne by the Second Party', 'ما يتحمله الطرف الثاني', 'The Second Party shall bear only the following:\n• Accommodation\n• Food (catering)\n• Transportation to/from the work site\n• Overtime hours (charged at actuals as per the Labor Law)\n• While the First Party is responsible for arranging the medical examination appointment upon the employee’s arrival in the Kingdom, the Second Party shall pay the cost of the medical examination required for Iqama issuance, amounting to SAR 90 or the actual fee charged by the medical center at which the examination appointment is booked.\n• Value Added Tax (15%) as per regulations',
  'يتحمل الطرف الثاني فقط ما يلي:\n• السكن\n• الإعاشة (الطعام)\n• المواصلات من وإلى موقع العمل\n• ساعات العمل الإضافي (تحتسب فعلياً وفق نظام العمل)\n• كما أن الطرف الأول ملتزم بإجراءات حجز موعد الفحص الطبي عند وصول الموظف إلى المملكة العربية السعودية، فإن الطرف الثاني يلتزم بسداد قيمة الفحص الطبي اللازم لإصدار الإقامة، بمبلغ 90 ريالاً سعودياً أو حسب قيمته الفعلية لدى المركز الطبي الذي سيتم حجز الموعد فيه لإجراء الفحص.\n• ضريبة القيمة المضافة (15%) وفق الأنظمة'),
 ('3-3', 'Selection of Workers', 'اختيار العمالة', 'The Second Party shall nominate and select the workers and conduct the interviews; the First Party shall bear no responsibility for the selection of candidates.',
  'يتولى الطرف الثاني ترشيح واختيار العمالة وإجراء المقابلات، ولا يتحمل الطرف الأول مسؤولية اختيار المرشحين.'),
 ('3-4', 'Conduct & Safety', 'التصرفات والسلامة', 'The Second Party shall be responsible for the acts and conduct of the workers at the work sites, and for providing a safe work environment and the necessary safety equipment.',
  'يكون الطرف الثاني مسؤولاً عن أعمال العمالة وتصرفاتها داخل مواقع العمل، وعن توفير بيئة عمل آمنة ومعدات السلامة اللازمة.'),
 ('3-5', 'Security Deposit', 'دفعة التأمين', 'To pay an advance payment as a security deposit equivalent to one (1) month of the total monthly service value of the contracted workers, payable upon signing and before the service starts. It shall be refunded to the Second Party by offsetting it against the last month’s invoice of the contract, after settling any outstanding dues, if any.',
  'سداد دفعة مقدمة كتأمين تعادل قيمة شهر (1) واحد من إجمالي قيمة الخدمة الشهرية للعمالة المتعاقد عليها، تُسدد عند توقيع العقد وقبل بدء الخدمة، وتُسترد للطرف الثاني بخصمها من فاتورة الشهر الأخير من العقد، بعد تسوية أي مستحقات قائمة إن وجدت.'),
 ('3-6', 'Unlawful Instructions', 'التعليمات المخالفة', 'If the Second Party requests the workers to use equipment or materials that violate laws or safety standards, or issues instructions in breach of the regulations, it shall bear sole and full responsibility for any resulting damages or claims, including third-party claims, and the First Party may immediately refrain from executing such instructions without any liability.',
  'إذا طلب الطرف الثاني من العمالة استخدام معدات أو مواد مخالفة للأنظمة أو اشتراطات السلامة، أو أصدر تعليمات مخالفة للأنظمة، يتحمل وحده كامل المسؤولية عن أي أضرار أو مطالبات تنشأ عن ذلك بما فيها مطالبات الغير، ويحق للطرف الأول الامتناع فوراً عن تنفيذ تلك التعليمات دون أي مسؤولية عليه.'),
 ('4-1', 'Service Fees', 'المقابل المالي', 'Fees are calculated monthly per worker according to the prices in Annex (1), and the service fees shall remain fixed throughout the first year of the contract.',
  'يُحتسب المقابل المالي شهرياً لكل عامل وفق الأسعار الواردة في الملحق رقم (1)، وتكون رسوم الخدمة ثابتة طوال السنة الأولى من العقد.'),
 ('4-2', 'Overtime', 'العمل الإضافي', 'Overtime shall be calculated at (1.5) times the hourly wage in accordance with the Saudi Labor Law and its amendments, and added to the monthly invoice based on attendance sheets approved by the Second Party.',
  'يُحتسب العمل الإضافي بمعدل (1.5) من أجر الساعة وفق نظام العمل السعودي وتعديلاته، ويُضاف إلى الفاتورة الشهرية بناءً على كشوف الحضور المعتمدة من الطرف الثاني.'),
 ('4-3', 'Additions & Deductions', 'الإضافة والخصم', 'Any addition or deduction to the invoice shall be based on an operating sheet showing the workers’ names, numbers and attendance, prepared by the First Party and approved by both Parties.',
  'تتم أي إضافة أو خصم على الفاتورة بناءً على كشف تشغيل يوضح أسماء العمالة وأرقامهم وحضورهم، يُعده الطرف الأول ويعتمده الطرفان.'),
 ('4-4', 'Invoice Objection', 'الاعتراض على الفاتورة', 'If the First Party receives no objection to an invoice within three (3) business days of its receipt, the invoice shall be deemed final, approved and payable.',
  'إذا لم يستلم الطرف الأول أي اعتراض على الفاتورة خلال ثلاثة (3) أيام عمل من استلامها، تُعد نهائية ومعتمدة وملزمة السداد.'),
 ('4-5', 'Late Payment', 'التأخر في السداد', 'In case of late payment, the First Party shall notify the Second Party in writing and may suspend the service seven (7) days after the notice, without this being deemed a breach on its part.',
  'في حال عدم السداد في الموعد، يُخطر الطرف الأول الطرف الثاني كتابياً، ويحق له تعليق الخدمة بعد سبعة (7) أيام من الإشعار دون أن يُعد ذلك إخلالاً منه.'),
 ('4-6', 'Balance Confirmation', 'مصادقة الرصيد', 'The Second Party shall sign and stamp the balance confirmation sent by the First Party within five (5) business days; failure to object within this period constitutes acknowledgement of the balance.',
  'يلتزم الطرف الثاني بتوقيع وختم مصادقة الرصيد المرسلة من الطرف الأول خلال خمسة (5) أيام عمل، ويُعد عدم الاعتراض خلالها إقراراً بصحة الرصيد.'),
 ('4-7', 'New Government Fees', 'الرسوم الحكومية الجديدة', 'If new government fees or taxes are imposed or existing ones are increased (Iqama, work permit, exit/re-entry, GOSI or others), the actual increase shall be added to the service value from its effective date after notifying the Second Party.',
  'في حال فرض رسوم أو ضرائب حكومية جديدة أو زيادة القائمة منها (الإقامة، رخصة العمل، الخروج والعودة، التأمينات أو غيرها)، تضاف الزيادة الفعلية على قيمة الخدمة من تاريخ سريانها بعد إشعار الطرف الثاني.'),
 ('4-8', 'Review of Fees', 'مراجعة الرسوم', 'Service fees shall be reviewed after the first year by mutual written agreement through an addendum to this contract.',
  'تُراجع رسوم الخدمة بعد انقضاء السنة الأولى باتفاق الطرفين كتابياً بموجب ملحق للعقد.'),
 ('4-9', 'VAT', 'ضريبة القيمة المضافة', 'VAT shall be added to all invoices as per regulations and shall be paid by the Second Party.', 'تضاف ضريبة القيمة المضافة على جميع الفواتير وفق الأنظمة، ويلتزم الطرف الثاني بسدادها.'),
 ('4-10', 'Independence of Payment', 'استقلال السداد', 'The Second Party’s payment obligation is independent of its actual utilization of the workers or its internal operating conditions, as long as the First Party provides the workers in accordance with this contract.',
  'التزام الطرف الثاني بالسداد مستقل عن مدى استفادته الفعلية من العمالة وظروف التشغيل لديه، متى كان الطرف الأول ملتزماً بتوفير العمالة وفق العقد.'),
 ('5-1', 'Term', 'مدة العقد', 'This contract shall be effective from the service start date for the term set out in the Contract Particulars, and shall be automatically renewed as stated therein.',
  'يسري العقد من تاريخ بدء الخدمة وللمدة المحددة في بيانات العقد، ويتجدد تلقائياً وفق ما ورد فيها.'),
 ('5-2', 'Termination by the First Party', 'إنهاء الطرف الأول', 'The First Party may terminate this contract with two (2) months’ written notice in case the Second Party breaches any of its obligations.',
  'يحق للطرف الأول إنهاء العقد بإشعار كتابي مدته شهران (2) في حال إخلال الطرف الثاني بأي من التزاماته.'),
 ('5-3', 'Termination by the Second Party', 'إنهاء الطرف الثاني', 'If the Second Party terminates this contract, or the services of any worker, before the end of the term for a reason not attributable to the First Party, it shall pay all dues up to the termination date, the non-recoverable costs incurred by the First Party (including the unamortized portion of recruitment, visa and Iqama costs), and the workers’ repatriation costs, within seven (7) days from the termination date.',
  'في حال إنهاء الطرف الثاني للعقد أو لخدمات أي عامل قبل انتهاء المدة لسبب لا يعود للطرف الأول، يلتزم بسداد جميع المستحقات حتى تاريخ الإنهاء، والتكاليف غير القابلة للاسترداد التي تكبدها الطرف الأول (بما فيها الجزء غير المستهلك من تكاليف الاستقدام والتأشيرات والإقامات)، وتكاليف ترحيل العمالة، وذلك خلال سبعة (7) أيام من تاريخ الإنهاء.'),
 ('6-1', 'Ramadan & Holidays', 'رمضان والإجازات', 'Working hours shall be reduced during Ramadan as per the Labor Law, with the Second Party paying the full service value. Workers shall be granted Eid, National Day and Founding Day holidays as per the law without deduction from the service value, and work on such days shall be charged as overtime.',
  'تُخفض ساعات العمل خلال شهر رمضان وفق نظام العمل، مع التزام الطرف الثاني بسداد قيمة الخدمة كاملة، وتُمنح العمالة إجازات الأعياد واليوم الوطني ويوم التأسيس وفق النظام دون خصمها من قيمة الخدمة، ويُحتسب العمل فيها كعمل إضافي.'),
 ('6-2', 'No Agency', 'عدم الوكالة', 'The First Party is not an agent or legal representative of the Second Party and may not make any commitments on its behalf towards third parties.',
  'لا يُعد الطرف الأول وكيلاً أو ممثلاً نظامياً للطرف الثاني، ولا يحق له التعهد نيابةً عنه أمام الغير.'),
 ('6-3', 'Assault or Theft', 'الاعتداء أو السرقة', 'If any worker commits an assault or theft, he shall be personally liable for his act and shall be referred to the competent authorities in accordance with the regulations.',
  'في حال ارتكاب أي عامل اعتداءً أو سرقة يتحمل مسؤولية فعله شخصياً، ويُحال إلى الجهات المختصة وفق الأنظمة.'),
 ('6-4', 'Assignment', 'التنازل', 'Neither Party may assign its rights or obligations under this contract to any third party without the prior written consent of the other Party, except for the First Party’s use of its licensed partners under clause (2-1).',
  'لا يجوز لأي طرف التنازل عن حقوقه أو التزاماته بموجب هذا العقد للغير دون موافقة كتابية مسبقة من الطرف الآخر، ويُستثنى من ذلك استعانة الطرف الأول بشركائه المرخصين وفق البند (2-1).'),
 ('6-5', 'Visas & Authorities', 'التأشيرات والجهات المختصة', 'Visa and sponsorship-transfer requests are subject to the approval of the competent authorities, the workers’ qualifications and the approved professions, and their duration depends on those authorities’ procedures and the establishments’ Nitaqat status.',
  'تخضع طلبات التأشيرات ونقل الخدمات لموافقة الجهات المختصة ومؤهلات العمالة والمهن المعتمدة، وتعتمد مدتها على إجراءات تلك الجهات ونطاقات المنشآت.'),
 ('6-6', 'Severability', 'قابلية التجزئة', 'If any judicial or governmental authority invalidates any clause, such invalidity shall not extend to the remaining clauses.', 'إذا قضت جهة قضائية أو حكومية ببطلان أي بند، فلا يمتد البطلان إلى بقية البنود.'),
 ('6-7', 'Entire Agreement', 'كامل الاتفاق', 'This contract and its annexes constitute the entire agreement between the Parties and supersede any prior understandings; it may only be amended in writing signed by the authorized representatives of both Parties.',
  'يمثل هذا العقد وملاحقه كامل الاتفاق بين الطرفين، ويلغي أي تفاهمات سابقة، ولا يجوز تعديله إلا كتابةً وبتوقيع الممثلين المفوضين للطرفين.'),
 ('6-8', 'Compliance', 'الالتزام بالأنظمة', 'Each Party shall comply with the regulations in force in the Kingdom, particularly the Labor Law, in performing its obligations.', 'يلتزم كل طرف بالأنظمة السارية في المملكة، وخصوصاً نظام العمل، فيما يخص تنفيذ التزاماته.'),
 ('6-9', 'Notices', 'المراسلات', 'All correspondence and notices shall be in writing to the addresses and emails stated in this contract, and sending to them shall be deemed proof of receipt.',
  'تكون المراسلات والإشعارات كتابةً على العناوين والبريد الإلكتروني الموضحة في هذا العقد، ويُعد الإرسال إليها إثباتاً للاستلام.'),
 ('7', 'Force Majeure', 'القوة القاهرة', 'Neither Party shall be deemed in breach if it is unable to perform its obligations due to force majeure beyond its control, such as natural disasters, wars or government decisions, provided it promptly notifies the other Party in writing.',
  'لا يُعد أي طرف مخلاً بالتزاماته إذا تعذر تنفيذها بسبب قوة قاهرة خارجة عن إرادته، كالكوارث الطبيعية والحروب والقرارات الحكومية، على أن يُخطر الطرف الآخر كتابياً فور حدوثها.'),
 ('8', 'Governing Law & Disputes', 'القانون الواجب التطبيق وحل النزاعات', 'This contract is governed by the laws of the Kingdom of Saudi Arabia. The Parties shall seek to settle any dispute amicably; failing that, it shall be referred to the competent court in Riyadh. The Second Party shall bear the judicial fees and litigation costs if the First Party resorts to the courts to collect its dues.',
  'يخضع هذا العقد لأنظمة المملكة العربية السعودية، ويسعى الطرفان لحل أي نزاع ودياً، فإن تعذر ذلك يُحال إلى المحكمة المختصة بمدينة الرياض. ويتحمل الطرف الثاني الرسوم القضائية وأتعاب التقاضي في حال لجوء الطرف الأول للقضاء لتحصيل مستحقاته.'),
 ('9', 'Language & Counterparts', 'اللغة والنسخ', 'This contract is executed in Arabic and English. In case of any discrepancy between the two texts, the Arabic text shall prevail. It is executed in two (2) originals, one for each Party. Both Parties acknowledge that they have signed it freely and with full understanding of all its terms.',
  'حُرر هذا العقد باللغتين العربية والإنجليزية، وفي حال وجود أي اختلاف بين النصين يُعتمد النص العربي. حُرر من نسختين أصليتين، بيد كل طرف نسخة للعمل بموجبها، ويقر الطرفان بأنهما وقعاه بإرادة حرة وفهم كامل لجميع بنوده.'),
 ('10', 'Required Documents', 'المستندات المطلوبة', 'A valid copy of each Party’s Commercial Registration; a valid copy of each Party’s VAT registration certificate; a signatory authorization attested by the Chamber of Commerce if the signatory’s name is not listed in the Commercial Registration.',
  'صورة سارية من السجل التجاري لكل طرف؛ صورة سارية من شهادة التسجيل في ضريبة القيمة المضافة لكل طرف؛ تفويض بالتوقيع مصدّق من الغرفة التجارية في حال لم يكن اسم الموقع وارداً في السجل التجاري.'),
]
# الملحق 1 وتوزيع التكاليف
CATS = [('Labor', 'العمالية', 'General laborer, maintenance worker, helper, cleaning &amp; services worker', 'عامل عادي، عامل صيانة، مساعد فني، عامل نظافة وخدمات', '2,000', '2,100', '4,100', '4,715', 'C'),
        ('Technical', 'الفنية', 'Mechanical technician, electrician, welder, plumber, equipment operator, HVAC technician', 'فني ميكانيكا، كهربائي، لحام، سباك، مشغل معدات، فني تكييف', '2,000', '2,350', '4,350', '5,002.5', 'B'),
        ('Engineering', 'الهندسية', 'Mechanical, electrical, civil and safety engineers', 'مهندس ميكانيكا، مهندس كهرباء، مهندس مدني، مهندس سلامة', '3,000', '3,000', '6,000', '6,900', 'A')]
COST = [('Monthly salary, payroll management and bank transfer', 'الراتب الشهري وإدارة الرواتب والتحويل البنكي', 0), ('Visa issuance / sponsorship transfer, first-time Iqama', 'إصدار التأشيرة / نقل الخدمات والإقامة لأول مرة', 0),
        ('Work permit (expat levy) and Iqama renewal', 'رخصة العمل وتجديد الإقامة', 0), ('Ajeer platform and Saudization (Nitaqat)', 'منصة أجير والتوطين (نطاقات)', 0), ('Social insurance (GOSI)', 'التأمينات الاجتماعية', 0),
        ('Medical insurance: Labor C, Technical B, Engineering A', 'التأمين الطبي: العمالية C، الفنية B، الهندسية A', 0), ('Medical examination and opening the worker’s bank account', 'الفحص الطبي وفتح الحساب البنكي', 0),
        ('Annual leave (21 days) and leave allowance', 'الإجازة السنوية (21 يوماً) وبدل الإجازة', 0), ('End-of-service benefits (EOSB)', 'مكافأة نهاية الخدمة', 0), ('Air tickets (arrival, vacation, end of contract)', 'تذاكر الطيران (القدوم، الإجازة، نهاية العقد)', 0),
        ('Exit / Re-entry visa', 'تأشيرة الخروج والعودة', 0), ('Chamber of Commerce and MOFA attestation fees', 'رسوم الغرفة التجارية وتصديق الخارجية', 0),
        ('Accommodation', 'السكن', 1), ('Food (catering)', 'الإعاشة (الطعام)', 1), ('Transportation to/from the work site', 'المواصلات من وإلى موقع العمل', 1),
        ('Overtime hours (charged at actuals per the Labor Law)', 'ساعات العمل الإضافي (فعلياً وفق نظام العمل)', 1), ('Medical examination cost for Iqama: SAR 90 or actual', 'كلفة الفحص الطبي للإقامة: 90 ريالاً أو الفعلي', 1), ('Value Added Tax (15%)', 'ضريبة القيمة المضافة (15%)', 1)]


def annex_block():
    out = '<div class="bp" style="margin-top:10px"><div class="pre"><b>Annex (1): Price &amp; Quantity Schedule · الملحق رقم (1): جدول الأسعار والأعداد</b></div>'
    out += '<table class="pt"><colgroup><col style="width:15%"><col style="width:9%"><col style="width:11%"><col style="width:11%"><col style="width:15%"><col style="width:13%"><col style="width:13%"><col style="width:13%"></colgroup><tr>'
    for a in ['Category<br>الفئة', 'Nationality<br>الجنسية', 'Qty<br>العدد', 'Monthly salary<br>الراتب الشهري', 'Service fee<br>رسوم الخدمة', 'Monthly total<br>الإجمالي الشهري', 'Incl. 15% VAT<br>شامل الضريبة', 'Medical class<br>الفئة الطبية']:
        out += f'<th class="c">{a}</th>'
    out += '</tr>'
    for en, ar, pe, pa, s, f, t, v, m in CATS:
        out += f'<tr><td>{en}<br><span dir="rtl">{ar}</span></td><td class="c">Egypt<br><span dir="rtl">مصر</span></td><td class="c">As requested<br><span dir="rtl">حسب الطلب</span></td><td class="c">{num(s)}</td><td class="c">{num(f)}</td><td class="c"><b>{num(t)}</b></td><td class="c">{num(v)}</td><td class="c">{num(m)}</td></tr>'
        out += f'<tr><td colspan="8" class="note">{pe}<br><span dir="rtl">{pa}</span></td></tr>'
    out += '</table><p class="note">Prices in SAR per worker per month, excluding VAT. Final quantities per profession are set by written purchase orders from the Second Party and form part of this Annex. Accommodation, food and transportation are provided by the Second Party; all other fees and costs are borne by the First Party.<br><span dir="rtl">الأسعار بالريال السعودي شهرياً لكل عامل، غير شاملة الضريبة. الأعداد النهائية لكل مهنة تُحدد بأوامر طلب كتابية من الطرف الثاني وتُعد جزءاً من هذا الملحق. يوفر الطرف الثاني السكن والإعاشة والمواصلات، وكل ما عدا ذلك من رسوم وتكاليف يتحمله الطرف الأول.</span></p>'
    out += '<div class="pre"><b>Cost Allocation Between the Parties · توزيع التكاليف بين الطرفين</b></div><table class="pt"><colgroup><col style="width:5%"><col style="width:36%"><col style="width:36%"><col style="width:11.5%"><col style="width:11.5%"></colgroup><tr><th class="c">#</th><th>Description</th><th class="ar">البند</th><th class="c">Client<br>العميل</th><th class="c">Business Partner<br>بزنس بارتنر</th></tr>'
    for i, (e, a, who) in enumerate(COST, 1):
        out += f'<tr><td class="c">{i}</td><td>{e}</td><td class="ar">{a}</td><td class="c">{"✓" if who else "—"}</td><td class="c">{"—" if who else "✓"}</td></tr>'
    return out + '</table></div>'


def build_contract():
    head = ('<div class="note" dir="ltr" style="margin:6px 0 0">Agreement No. <span class="num">BP-OS-2026-001</span> · Date <span class="num">30/09/2026</span> · Place: Riyadh · Quotation Ref. <span class="num">BP-QT-2026-0930-PM</span></div>'
            '<div class="note" dir="rtl" style="margin:0 0 2px">رقم الاتفاقية: <span class="num">BP-OS-2026-001</span> · تاريخ الإبرام: <span class="num">30/09/2026</span>م · المكان: الرياض · مرجع العرض: <span class="num">BP-QT-2026-0930-PM</span></div>'
            '<div class="pre"><b>1. الأطراف / Parties</b></div>' + pty('First Party (Service Provider)', 'الطرف الأول (مقدم الخدمة)', BP_ROWS) + pty('Second Party (Client)', 'الطرف الثاني (العميل)', CL_ROWS))
    tail = (sg(('Baher Bakr Ali Magnas · باهر بكر علي مقنص', 'Manager · المدير'), ('Ibrahim Hussein Mohamed Eleryan · إبراهيم حسين محمد العريان', 'General Manager · المدير العام'))
            + '<p class="note" style="margin-top:8px">نسخة معاد تنسيقها على معيار Business Partner من العقد الموقّع BP-OS-2026-001؛ النص المعتمد هو النسخة الموقّعة. · Re-formatted copy of the signed agreement; the signed original prevails.</p>')
    rows = [clause(*c) for c in C]
    # الملحق قبل التوقيعات: يُضاف إلى tail أولاً
    return wrap('عقد إسناد العمالة — Petromaint', paginate('اتفاقية تقديم خدمات إسناد العمالة', 'Employment Outsourcing Agreement', head, 640, rows, [(annex_block(), 800), (tail, 300)]))


NDA = [('2', 'Purpose', 'الغرض', 'Exchange of information to evaluate and perform the employment outsourcing services (the “Purpose”).', 'تبادل معلومات لغرض تقييم وتنفيذ خدمات إسناد العمالة («الغرض»).'),
       ('3', 'Confidential Information', 'المعلومات السرية', 'Any non-public information disclosed in any form, including pricing, clients, workers’ and candidates’ data, workforce plans, sites and operating plans. This clause does not prevent either party from using workers’ information as needed to perform the services contract.',
        'كل معلومة غير عامة تُفصح بأي وسيلة، وتشمل الأسعار والعملاء وبيانات العمالة والمرشحين وخطط القوى العاملة والمواقع والخطط التشغيلية. ولا يمنع هذا البند استعمال أي طرف لمعلومات العمالة بالقدر اللازم لتنفيذ عقد الخدمة.'),
       ('4', 'Obligations', 'الالتزامات', 'Use only for the Purpose; no disclosure to third parties except employees, advisors, licensed partners and technology, artificial intelligence and hosting service providers who need it and are bound by confidentiality; protect with at least reasonable care.',
        'استخدام المعلومات للغرض فقط، وعدم الإفصاح لأي طرف ثالث إلا للعاملين والمستشارين والشركاء المرخصين ومزودي الخدمات التقنية والذكاء الاصطناعي والاستضافة المحتاجين لها والملتزمين بالسرية، وحمايتها بعناية معقولة لا تقل عن عنايته بمعلوماته.'),
       ('5', 'Exclusions', 'الاستثناءات', 'Information that is public, previously known, independently developed, lawfully received from a third party, or legally compelled (with notice to the other party). The burden of proving an exception lies on the party claiming it.',
        'المعلومات العامة، أو المعروفة سابقاً، أو المطوّرة باستقلال، أو المستلمة من طرف ثالث بصورة مشروعة، أو المطلوب الإفصاح عنها بأمر نظامي مع إشعار الطرف الآخر. وعبء إثبات الاستثناء على من يدّعيه.'),
       ('6', 'Personal Data', 'البيانات الشخصية', 'Workers’ personal data is handled under the Personal Data Protection Law and the services contract, with which this clause does not conflict.', 'تُعامل بيانات العمالة الشخصية وفق نظام حماية البيانات الشخصية وعقد الخدمة، ولا يتعارض هذا البند معهما.'),
       ('7', 'Term', 'المدة', 'Effective from signature for 3 years; confidentiality survives expiry for 5 years, and remains open-ended for trade secrets and personal data.', 'يسري الاتفاق من تاريخ التوقيع ولمدة 3 سنوات، وتستمر السرية بعد انتهائه لمدة 5 سنوات، وتبقى مفتوحة المدة للأسرار التجارية والبيانات الشخصية.'),
       ('8', 'Return & Destruction', 'الإعادة والإتلاف', 'On request or when the Purpose ends, information is returned or destroyed within 14 days, except automatic backups and statutorily retained copies.', 'عند الطلب أو انتهاء الغرض تُعاد المعلومات أو تُتلف خلال 14 يوماً، عدا النسخ الاحتياطية الآلية والمحتفظ بها نظاماً.'),
       ('9', 'Breach & Remedies', 'الإخلال والتعويض', 'The affected party may claim compensation for proven actual direct damage and seek an urgent court order to stop disclosure, with no fixed penalty.', 'يحق للطرف المتضرر المطالبة بالتعويض عن الضرر الفعلي المباشر المثبت، وطلب أمر قضائي مستعجل بوقف الإفصاح، دون غرامة ثابتة.'),
       ('10', 'Governing Law', 'القانون والاختصاص', 'Governed by the laws of the Kingdom of Saudi Arabia; disputes are resolved amicably within 30 days of written notice, then before the Commercial Court in Riyadh.', 'تخضع لأنظمة المملكة العربية السعودية، وتُحل النزاعات ودياً خلال 30 يوماً من الإخطار الخطي ثم أمام المحكمة التجارية في الرياض.')]


def build_nda():
    bp = [r for r in BP_ROWS if r[0] != 'Legal form']; bp[3] = ('National Address', num('RHSC2978'), 'العنوان الوطني')
    cl = [r for r in CL_ROWS if r[0] != 'Address']
    head = '<div class="pre"><b>1. الأطراف / Parties</b></div>' + pty('First Party (Service Provider)', 'الطرف الأول (مقدم الخدمة)', bp) + pty('Second Party (Client)', 'الطرف الثاني (العميل)', cl)
    tail = sg(('Baher Bakr Ali Magnas · باهر بكر علي مقنص', 'Manager · المدير'), ('Ibrahim Hussein Mohamed Eleryan · إبراهيم حسين محمد العريان', 'General Manager · المدير العام'))
    return wrap('اتفاقية عدم إفصاح — Petromaint', paginate('اتفاقية عدم إفصاح متبادلة', 'Mutual Non-Disclosure Agreement', head, 470, [clause(*c) for c in NDA], [(tail, 330)]))


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'both'
    if what in ('contract', 'both'): open(os.path.join(D, 'BP_Contract_Petromaint_v2.html'), 'w', encoding='utf-8').write(build_contract())
    if what in ('nda', 'both'): open(os.path.join(D, 'BP_NDA_Petromaint_v1.html'), 'w', encoding='utf-8').write(build_nda())
    print('ok')
