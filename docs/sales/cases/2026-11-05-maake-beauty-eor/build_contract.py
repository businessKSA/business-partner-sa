# -*- coding: utf-8 -*-
"""اتفاقية التوظيف على بند التعاقد والإسناد — Maake Beauty (موظفون سعوديون فقط، «التكلفة بشفافية»، 12 شهراً).
A4 طولي ثنائي اللغة (عربي يمين / إنجليزي يسار) بورق REV المعتمد: الغلاف + البنود + صندوقا التوقيع + الغلاف الختامي.
يعيد استعمال أدوات docs/sales/business-development-service/src (rev_build: القالب والترقيم، rev_package: fieldify/render).
الخانة الفارغة [●] تصير حقل تعبئة في الـPDF، و☐ خانة اختيار. [IBAN]/[BANK] تبقى كما هي ما لم تُمرَّر BP_IBAN/BP_BANK.
الاستعمال:
    NODE_PATH=$(npm root -g) python3 build_contract.py <outdir>
الإخراج في <outdir>: Agreement.pdf (حقول تعبئة) + Agreement.html (المصدر المفتوح بخانات [●]) + _build/ (ملفات وسيطة).
الأرقام المعتمدة (المالك 2026-11-05): رسوم Business Partner 1,000 للموظف شهرياً + 15% ضريبة على الرسوم فقط؛ المدة 12 شهراً؛
راتب مثال 6,200؛ التأمينات: صاحب العمل نحو 13% والموظف نحو 10%؛ دفعة مقدمة براتب شهرين؛ الفواتير خلال 7 أيام.
أرقام المثال تحسب بمعادلة المالك نفسها في build_quote.py (وعاء الاشتراك 85% من الراتب)."""
import os, re, shutil, sys, types, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'business-development-service', 'src')
sys.path.insert(0, SRC)
import rev_build, rev_package as rp  # noqa: E402


def _load(path):
    spec = importlib.util.spec_from_file_location('revc', path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


C = _load(os.path.join(SRC, 'REV-contract-content.py'))
H, R, TB, N, LB = C.H, C.R, C.TB, C.N, C.LB

# ---------- الأرقام ----------
S = 6200                                   # راتب مثال قبل خصم حصة الموظف
FEE = 1000
BASE = S * 0.85                            # وعاء الاشتراك (معادلة المالك)
GOSI = round(BASE * (0.10 + 0.02 + 0.0075))    # حصة صاحب العمل
GOSI_EMP = round(BASE * (0.10 + 0.0075))       # حصة الموظف
VAT = round(FEE * 0.15)
SUBTOTAL = S + GOSI + FEE
EOSB = S // 2
LEAVE = round(S / 30.0 * 21)
ADV = 2 * S
f = lambda n: '{:,}'.format(int(n))
IBAN, BANK = rp.IBAN, rp.BANK

# ---------- المحتوى ----------


def blocks():
    return _chunk(_blocks())


def _chunk(B):
    """كل بند كتلة مستقلة (العنوان مع أول بند، والجدول مع ما قبله) ليمتلئ كل ورق دون فراغات."""
    out = []
    for blk in B:
        for it in blk:
            if out and ((it.startswith('<table') and not out[-1][-1].startswith('<table')) or out[-1][-1].startswith('<div class="rw hh"')):
                out[-1].append(it)
            else:
                out.append([it])
    return out


def _blocks():
    B = []
    # 2
    B.append([H(2, 'Subject and Definitions', 'الموضوع والتعريفات'),
              R('2.1', 'Business Partner employs, on its own employment contract, the Saudi employees named in clause 3 (each an “Employee”) and places them to work with the Client, and the Client directs their day-to-day work. Business Partner is the employer on record: it concludes and documents the employment contract, registers the Employee with the competent authorities, pays salaries and social insurance, and administers the Employee’s file and entitlements.',
                'يوظّف Business Partner، بموجب عقد عمل خاص بها، الموظفين السعوديين المذكورين في البند 3 (كلٌّ منهم «الموظف») ويضعهم للعمل لدى العميل، ويتولى العميل توجيه عملهم اليومي. وتكون Business Partner صاحبة العمل المسجَّلة، فتبرم عقد العمل وتوثّقه، وتسجّل الموظف لدى الجهات المختصة، وتصرف الرواتب وتسدّد التأمينات الاجتماعية، وتدير ملف الموظف ومستحقاته.'),
              R('2.2', 'This Agreement covers Saudi nationals only.', 'تقتصر هذه الاتفاقية على المواطنين السعوديين.'),
              R('2.3', '<b>“Applicable Law”</b> means the laws and regulations in force in the Kingdom of Saudi Arabia, including the Labor Law, the Social Insurance Law and the decisions of the Ministry of Human Resources and Social Development, as amended from time to time. <b>“Authorities”</b> means the competent government bodies and official platforms, including Qiwa and the General Organization for Social Insurance (GOSI).',
                '<b>«الأنظمة المعمول بها»:</b> الأنظمة واللوائح السارية في المملكة العربية السعودية، ومنها نظام العمل ونظام التأمينات الاجتماعية وقرارات وزارة الموارد البشرية والتنمية الاجتماعية، بصيغتها المعدّلة من وقت لآخر. <b>«الجهات المختصة»:</b> الجهات الحكومية والمنصات الرسمية المختصة، ومنها منصة قوى والمؤسسة العامة للتأمينات الاجتماعية.'),
              R('2.4', 'The services do not include legal, tax or accounting advice, nor the management of the Employees’ day-to-day work, which remains the Client’s responsibility within the limits of the Applicable Law.',
                'لا تشمل الخدمات الاستشارات القانونية أو الضريبية أو المحاسبية، ولا إدارة العمل اليومي للموظفين الذي يبقى مسؤولية العميل في حدود الأنظمة المعمول بها.')])
    # 3
    B.append([H(3, 'Employees', 'الموظفون'),
              R('3.1', 'The Employees, their job titles, salaries and start dates are set out in the table below, completed for each Employee before he or she starts.',
                'يُبيَّن الموظفون ومسمياتهم الوظيفية ورواتبهم وتواريخ مباشرتهم في الجدول أدناه، ويُستكمل لكل موظف قبل مباشرته.'),
              TB([('No.', 'م'), ('Employee name and ID no.', 'اسم الموظف ورقم الهوية'), ('Job title', 'المسمى الوظيفي'), ('Salary and allowances (SAR)', 'الراتب والبدلات (ريال)'), ('Start date', 'تاريخ المباشرة')],
                 [[str(i), '[●]', '[●]', '[●]', '[●]'] for i in (1, 2, 3)], [6, 28, 22, 24, 20])])
    B.append([R('3.2', 'Employment of an Employee starts only when: (a) the Client has chosen the Employee and agreed the salary and start date with him or her in writing; (b) the Employee has signed the employment contract and been registered; and (c) Business Partner has received the Advance Payment under clause 5.1.',
                'لا يبدأ توظيف أي موظف إلا بعد: (أ) اختيار العميل للموظف واتفاقه معه كتابةً على الراتب وتاريخ المباشرة؛ (ب) توقيع الموظف عقد العمل وتسجيله؛ (ج) استلام Business Partner للدفعة المقدمة وفق البند 5.1.'),
              R('3.3', '<b>Adding or removing an Employee:</b> the Client notifies Business Partner in writing before the intended start, stating the Employee’s name, ID number, job title, salary and start date; Business Partner approves, declines or asks for further documents; on approval the table is updated and initialled by both Parties and the Advance Payment for the added Employee is paid. Removal follows clause 6.6.',
                '<b>إضافة موظف أو إزالته:</b> يُخطر العميل Business Partner كتابةً قبل تاريخ المباشرة المقصود، مبيّناً اسم الموظف ورقم هويته ومسماه الوظيفي وراتبه وتاريخ مباشرته؛ وتوافق Business Partner أو ترفض أو تطلب مستندات إضافية؛ وعند الموافقة يُحدَّث الجدول ويُوقَّع بالأحرف الأولى من الطرفين وتُسدَّد الدفعة المقدمة عن الموظف المضاف. وتتم الإزالة وفق البند 6.6.'),
              R('3.4', 'Business Partner may decline or postpone an Employee whose documents are incomplete or whose engagement would conflict with the Applicable Law.',
                'لـ Business Partner رفض أو تأجيل أي موظف مستنداته غير مكتملة أو يتعارض توظيفه مع الأنظمة المعمول بها.')])
    # 4
    B.append([H(4, 'Price: Transparent Cost', 'السعر: التكلفة بشفافية'),
              R('', 'Each cost is shown as it is. The Client pays the salary, the social insurance and the fixed fees of Business Partner monthly; the end-of-service reward and annual leave are billed at actual when the Agreement ends. Amounts are per Employee, in Saudi Riyals, at an example salary of SAR %s.' % f(S),
                'كل تكلفة تُعرض كما هي. يدفع العميل شهرياً الراتب والتأمينات الاجتماعية ورسوم Business Partner الثابتة، وتُفوتَر مكافأة نهاية الخدمة والإجازة السنوية بالفعلي عند انتهاء الاتفاقية. المبالغ للموظف الواحد بالريال السعودي على راتب مثال قدره %s ريال.' % f(S)),
              TB([('Per Employee, per month (SAR)', 'للموظف شهرياً (ريال)'), 'Amount · المبلغ'], [
                  [('Salary and allowances (example, before the Employee’s insurance share)', 'الراتب والبدلات (مثال، قبل خصم حصة الموظف من التأمينات)'), N(f(S))],
                  [('Social insurance, employer share (approx. 13%)', 'التأمينات الاجتماعية، حصة صاحب العمل (نحو 13%)'), N(f(GOSI))],
                  [('Business Partner fees', 'رسوم Business Partner'), N(f(FEE))],
                  [('<b>Monthly total before VAT</b>', '<b>الإجمالي الشهري قبل الضريبة</b>'), '<b>%s</b>' % N(f(SUBTOTAL))],
                  [('VAT 15% (on Business Partner fees only)', 'ضريبة القيمة المضافة 15% (على رسوم Business Partner فقط)'), N(f(VAT))],
                  [('<b>Monthly invoice including VAT</b>', '<b>الفاتورة الشهرية شاملة الضريبة</b>'), '<b>%s</b>' % N(f(SUBTOTAL + VAT))],
              ], [78, 22]),
              TB([('Billed at actual when the Agreement ends (12 months, indicative)', 'تُفوتَر بالفعلي عند انتهاء الاتفاقية (12 شهراً، تقديري)'), 'Amount · المبلغ'], [
                  [('End-of-service reward (handed to the Employee)', 'مكافأة نهاية الخدمة (تُسلَّم للموظف)'), N(f(EOSB))],
                  [('Annual leave (21 days)', 'الإجازة السنوية (21 يوماً)'), N(f(LEAVE))],
              ], [78, 22])])
    B.append([R('4.1', '<b>Business Partner fees:</b> SAR %s per Employee per month, fixed for the term of this Agreement (“Business Partner fees”).' % f(FEE),
                '<b>رسوم Business Partner:</b> %s ريال للموظف شهرياً، ثابتة طوال مدة هذه الاتفاقية («رسوم Business Partner»).' % f(FEE)),
              R('4.2', '<b>VAT:</b> 15%% applies to Business Partner fees only (SAR %s per Employee per month). Salaries and social insurance are charged to the Client at actual, with no Business Partner fee on them other than clause 4.1.' % f(VAT),
                '<b>ضريبة القيمة المضافة:</b> تُطبَّق نسبة 15%% على رسوم Business Partner فقط (%s ريالاً للموظف شهرياً). أما الرواتب والتأمينات فتُحمَّل على العميل بالفعلي دون أي رسوم لـ Business Partner عليها غير ما ورد في البند 4.1.' % f(VAT)),
              R('4.3', '<b>Salary:</b> the Client sets the salary and allowances of each Employee, which are entered in the table in clause 3; SAR %s is an example. A salary changes only by written notice to Business Partner before the start of the payroll month in which the change takes effect, and with the Employee’s agreement as the Labor Law requires.' % f(S),
                '<b>الراتب:</b> يحدد العميل راتب كل موظف وبدلاته ويُدرجان في جدول البند 3، ومبلغ %s ريال مثال. ولا يتغير الراتب إلا بإشعار كتابي إلى Business Partner قبل بدء شهر الرواتب الذي يسري فيه التغيير، وبموافقة الموظف حسبما يقتضيه نظام العمل.' % f(S)),
              R('4.4', '<b>Social insurance:</b> Business Partner pays social insurance for each Employee and charges it to the Client at actual. The employer share (approx. 13%%) is invoiced monthly. The Employee’s share (approx. 10%%) is, at the Client’s choice, deducted from the Employee’s salary or borne by the Client on top of the salary so that the Employee receives the full salary. Rates apply to the contribution base under the social insurance rules in force (in the example, SAR %s, being 85%% of the example salary). Client’s choice: ☐ deducted from the salary ☐ borne by the Client (+SAR %s per month at the example).' % (f(BASE), f(GOSI_EMP)),
                '<b>التأمينات الاجتماعية:</b> تسدّد Business Partner التأمينات الاجتماعية عن كل موظف وتُحمَّل على العميل بالفعلي. تُفوتَر حصة صاحب العمل (نحو 13%%) شهرياً. أما حصة الموظف (نحو 10%%) فيختار العميل إما خصمها من راتب الموظف أو تحمّلها فوق الراتب ليستلم الموظف راتبه كاملاً. وتُحسب النسب على وعاء الاشتراك وفق أنظمة التأمينات السارية (في المثال %s ريالاً، أي 85%% من الراتب المثال). اختيار العميل: ☐ تُخصم من الراتب ☐ يتحملها العميل (+%s ريالاً شهرياً في المثال).' % (f(BASE), f(GOSI_EMP)))])
    B.append([R('4.5', '<b>End-of-service reward and annual leave:</b> not included in the monthly invoice. Business Partner calculates and settles them under the Labor Law and bills them to the Client at actual when the Agreement ends, or when they fall due if an Employee’s employment ends earlier; the end-of-service reward is handed to the Employee. The second table above is indicative for 12 months at the example salary.',
                '<b>مكافأة نهاية الخدمة والإجازة السنوية:</b> لا تدخلان في الفاتورة الشهرية. وتحتسبهما Business Partner وتسوّيهما وفق نظام العمل وتُفوتَران على العميل بالفعلي عند انتهاء الاتفاقية، أو عند استحقاقهما إن انتهى عمل الموظف قبل ذلك، وتُسلَّم المكافأة للموظف. والجدول الثاني أعلاه تقديري لمدة 12 شهراً على الراتب المثال.'),
              R('4.6', 'The Client bears the end-of-service reward and leave to the extent the Labor Law makes them due, including where the Agreement or an Employee’s employment ends before the end of the term; only what the Employee is entitled to by law is billed.',
                'يتحمل العميل مكافأة نهاية الخدمة والإجازة بالقدر الذي يجعله نظام العمل مستحقاً، ومنه حين تنتهي الاتفاقية أو خدمة الموظف قبل نهاية المدة؛ ولا يُفوتَر إلا ما يستحقه الموظف نظاماً.'),
              R('4.7', '<b>Government fees:</b> none are included. If any government fee arises in respect of an Employee, it is billed at actual, supported by the receipt, without mark-up.',
                '<b>الرسوم الحكومية:</b> غير مشمولة. وإن نشأ رسم حكومي بخصوص أي موظف فيُفوتَر بالفعلي مؤيداً بالإيصال ودون هامش.'),
              R('4.8', '<b>Medical insurance:</b> not included. It is quoted separately, before enrolment, if the Client wants it.',
                '<b>التأمين الطبي:</b> غير مشمول، ويُسعَّر منفصلاً قبل إدراج الموظف إن رغب العميل به.'),
              R('4.9', '<b>Other pay:</b> bonuses, commissions and allowances beyond the agreed salary are not included. If the Client wants them paid through payroll, it notifies Business Partner in writing and they are invoiced at actual.',
                '<b>مدفوعات أخرى:</b> المكافآت والعمولات والبدلات خارج الراتب المتفق عليه غير مشمولة. وإن رغب العميل بصرفها عبر الرواتب أخطر Business Partner كتابةً وفُوتِرت بالفعلي.')])
    # 5
    B.append([H(5, 'Invoicing and Payment', 'الفوترة والدفع'),
              R('5.1', '<b>Advance Payment:</b> for each Employee, the Client pays an advance equal to two months of the Employee’s salary (SAR %s at the example salary) before the Employee starts. No Business Partner fee is charged on it. It is applied to the invoices of the first two months, and any difference is settled in the following invoice (the “Advance Payment”).' % f(ADV),
                '<b>الدفعة المقدمة:</b> يسدد العميل عن كل موظف دفعة مقدمة تعادل راتب شهرين (%s ريالاً على الراتب المثال) قبل مباشرة الموظف، ولا تُحمَّل عليها رسوم Business Partner. وتُحتسب على فاتورتي أول شهرين، وتُسوّى في الفاتورة التالية أي فروق («الدفعة المقدمة»).' % f(ADV)),
              R('5.2', '<b>Invoices:</b> Business Partner issues one invoice per month, the first after the first month of work. Each invoice covers the salary, the employer share of social insurance, Business Partner fees with VAT on them, and any actual item provided for in this Agreement, with a supporting statement. The Client pays each invoice within seven (7) days of its date, in Saudi Riyals and net of bank charges.',
                '<b>الفواتير:</b> تصدر Business Partner فاتورة واحدة شهرياً، وتصدر الأولى بعد أول شهر عمل. تشمل كل فاتورة الراتب وحصة صاحب العمل من التأمينات ورسوم Business Partner وضريبة القيمة المضافة عليها وأي بند بالفعلي منصوص عليه في هذه الاتفاقية، مع بيان مؤيد. ويسدد العميل كل فاتورة خلال 7 أيام من تاريخها بالريال السعودي وصافية من الرسوم البنكية.'),
              R('5.3', 'Payment is by bank transfer to Business Partner’s account at %s, IBAN %s.' % (BANK, IBAN),
                'السداد بتحويل بنكي إلى حساب Business Partner لدى %s، آيبان %s.' % (BANK, IBAN)),
              R('5.4', 'The Client may object in writing to any item within [●] days of receiving the invoice, failing which the invoice is deemed accepted.',
                'للعميل الاعتراض كتابةً على أي بند خلال [●] يوماً من استلام الفاتورة، وإلا عُدّت الفاتورة مقبولة.'),
              R('5.5', 'Salaries are transferred to the Employees through the wage protection arrangements on the dates required by the Applicable Law, from funds actually received. Business Partner is not obliged to pay salaries or social insurance from its own funds. If the Client is late in payment, Business Partner may notify it, suspend new additions, and terminate after a written warning of [●] days; delay does not entitle Business Partner to withhold the statutory entitlements of registered Employees, and the Client bears the penalties and claims that result from its delay.',
                'تُحوَّل الرواتب إلى الموظفين عبر ترتيبات حماية الأجور في المواعيد التي تقتضيها الأنظمة المعمول بها، ومن أموال مستلمة فعلاً. ولا تلتزم Business Partner بدفع الرواتب أو التأمينات من مالها. وإن تأخر العميل في السداد فلـ Business Partner إشعاره ووقف الإضافات الجديدة والإنهاء بعد إنذار كتابي مدته [●] يوماً؛ ولا يخوّلها التأخر حجب المستحقات النظامية للموظفين المسجلين، ويتحمل العميل ما يترتب على تأخره من غرامات ومطالبات.'),
              R('5.6', 'Official rates, including social insurance rates, may change during the term. The Client bears the actual amounts.',
                'قد تتغير الرسوم والنسب الرسمية، ومنها نسب التأمينات الاجتماعية، خلال مدة الاتفاقية، ويتحمل العميل المبالغ الفعلية.')])
    # 6
    B.append([H(6, 'Term and Termination', 'المدة والإنهاء'),
              R('6.1', 'This Agreement starts on [●] and runs for twelve (12) months. It renews only by written agreement of both Parties.',
                'تبدأ هذه الاتفاقية في [●] ومدتها 12 شهراً، ولا تتجدد إلا باتفاق كتابي بين الطرفين.'),
              R('6.2', 'Either Party may end this Agreement by written notice of [●] days.',
                'لأي طرف إنهاء هذه الاتفاقية بإشعار كتابي مدته [●] يوماً.'),
              R('6.3', 'Either Party may terminate immediately by written notice if the other commits a material breach and does not remedy it within [●] days of the notice, or becomes insolvent.',
                'لأي طرف إنهاؤها فوراً بإشعار كتابي إذا ارتكب الطرف الآخر إخلالاً جوهرياً ولم يعالجه خلال [●] يوماً من الإشعار، أو أُعلن إعساره.'),
              R('6.4', 'Business Partner may terminate this Agreement, or any part of it, if an Authority or the Applicable Law determines that the arrangement or any part of it is not permitted; the Client pays for what was performed until termination.',
                'لـ Business Partner إنهاء الاتفاقية أو أي جزء منها إن رأت جهة مختصة أو أوجبت الأنظمة المعمول بها أن الترتيب أو جزءاً منه غير جائز، ويسدد العميل ما نُفِّذ حتى الإنهاء.'),
              R('6.5', '<b>On termination,</b> the Parties settle: (a) outstanding invoices; (b) salaries and social insurance up to the termination date; (c) the end-of-service reward and leave under clause 4.5, the reward being handed to the Employee; and (d) the unused balance of the Advance Payment, from which Business Partner deducts what is due to it and refunds the remainder within [●] days of request. Business Partner hands over the Employees’ files. Termination does not affect accrued rights or the provisions on confidentiality, liability and governing law.',
                '<b>عند الإنهاء</b> يسوّي الطرفان: (أ) الفواتير المستحقة؛ (ب) الرواتب والتأمينات حتى تاريخ الإنهاء؛ (ج) مكافأة نهاية الخدمة والإجازة وفق البند 4.5 وتُسلَّم المكافأة للموظف؛ (د) رصيد الدفعة المقدمة غير المستعمل، تقتطع منه Business Partner ما يستحق لها وتردّ الباقي خلال [●] يوماً من الطلب. وتسلّم Business Partner ملفات الموظفين. ولا يمس الإنهاء الحقوق المستحقة ولا أحكام السرية والمسؤولية والقانون الواجب التطبيق.'),
              R('6.6', '<b>Ending an Employee’s employment:</b> the Client may ask Business Partner in writing to end an Employee’s employment, and Business Partner ends it under the Labor Law. Employment may be ended for cause only under the documented statutory procedure, after consulting Business Partner. The Client bears any compensation or notice pay the Labor Law requires for ending employment without a lawful ground, unless it arises from Business Partner’s error.',
                '<b>إنهاء عمل موظف:</b> يجوز للعميل أن يطلب كتابةً من Business Partner إنهاء عمل موظف، وتنهيه وفق نظام العمل. ولا يُنهى عقد الموظف لسبب إلا وفق الإجراء النظامي الموثّق وبعد استشارة Business Partner. ويتحمل العميل ما يقتضيه نظام العمل من تعويض أو بدل مهلة عن إنهاء العمل بلا مسوّغ نظامي، ما لم ينشأ عن خطأ Business Partner.')])
    # 7
    B.append([H(7, 'Responsibilities of the Parties', 'مسؤوليات الطرفين'),
              R('7.1', '<b>Business Partner shall:</b> (a) carry out the services with reasonable skill and care; (b) pay the Employees’ salaries and social insurance on time from funds provided under clause 5; (c) issue payslips and keep each Employee’s file; (d) calculate and settle the end-of-service reward and leave; and (e) give the Client a supporting statement with each invoice.',
                '<b>تلتزم Business Partner بما يلي:</b> (أ) تنفيذ الخدمات بالمهارة والعناية المعقولتين؛ (ب) صرف رواتب الموظفين وسداد تأميناتهم في مواعيدها من الأموال المتاحة وفق البند 5؛ (ج) إصدار قسائم الراتب وحفظ ملف كل موظف؛ (د) احتساب مكافأة نهاية الخدمة والإجازة وتسويتهما؛ (هـ) تزويد العميل ببيان مؤيد مع كل فاتورة.'),
              R('7.2', '<b>The Client shall:</b> (a) provide accurate and complete information and documents promptly; (b) direct the Employee’s day-to-day work within the job title agreed in clause 3 and the working hours [●]; (c) provide the workplace, tools, supervision and a safe working environment; (d) record attendance, report any absence to Business Partner without delay, and approve leave requests so that they can be settled; (e) comply with the Labor Law in respect of the Employees’ work; and (f) notify Business Partner without delay of any change affecting an Employee’s status, job title, salary or place of work, and not assign an Employee to work for another entity without written consent.',
                '<b>يلتزم العميل بما يلي:</b> (أ) تقديم معلومات ومستندات صحيحة وكاملة في الوقت المناسب؛ (ب) توجيه عمل الموظف اليومي ضمن المسمى الوظيفي المتفق عليه في البند 3 وساعات العمل [●]؛ (ج) توفير مقر العمل والأدوات والإشراف وبيئة عمل آمنة؛ (د) إثبات الحضور وإبلاغ Business Partner دون تأخير بأي غياب، والموافقة على طلبات الإجازة بما يتيح تسويتها؛ (هـ) الالتزام بنظام العمل فيما يخص عمل الموظفين؛ (و) إخطار Business Partner دون تأخير بأي تغيير يمس وضع الموظف أو مسماه الوظيفي أو راتبه أو مكان عمله، وعدم إسناده للعمل لدى جهة أخرى دون موافقة كتابية.'),
              R('7.3', 'The Client is responsible for the acts of the Employees at its site and for the instructions it gives. Disputes brought by an Employee against Business Partner as the employer on record are handled procedurally by Business Partner; the Client bears their cost and compensation unless they arise from Business Partner’s error, and cooperates and provides the documents.',
                'يكون العميل مسؤولاً عن أفعال الموظفين في موقعه وعن تعليماته. وتتولى Business Partner إجرائياً النزاعات التي يقيمها الموظف ضدها بوصفها صاحبة العمل المسجَّلة، ويتحمل العميل كلفتها وتعويضاتها ما لم تنشأ عن خطأ Business Partner، ويتعاون ويزوّد الوثائق.')])
    # 8
    B.append([H(8, 'Compliance, Confidentiality and Personal Data', 'الامتثال والسرية والبيانات الشخصية'),
              R('8.1', 'Each Party shall comply with the Applicable Law. Neither Party shall use this Agreement for a sham arrangement, to conceal the real employer, or for any arrangement contrary to the Applicable Law. Business Partner does not guarantee any effect on the Client’s Nitaqat status or category or on the counting of any Employee.',
                'يلتزم كل طرف بالأنظمة المعمول بها، ولا يجوز لأي منهما استعمال هذه الاتفاقية في ترتيب صوري أو لإخفاء صاحب العمل الحقيقي أو في أي ترتيب يخالف الأنظمة المعمول بها. ولا تضمن Business Partner أي أثر على وضع العميل أو فئته في برنامج نطاقات ولا على احتساب أي موظف.'),
              R('8.2', 'Each Party shall keep confidential the information received from the other in connection with this Agreement, including the Employees’ data and salaries, and use it only to perform this Agreement, except where disclosure is required by the Applicable Law or the Authorities.',
                'يحافظ كل طرف على سرية المعلومات التي يتسلمها من الطرف الآخر بخصوص هذه الاتفاقية، ومنها بيانات الموظفين ورواتبهم، ولا يستعملها إلا لتنفيذها، إلا ما أوجبت الأنظمة المعمول بها أو الجهات المختصة الإفصاح عنه.'),
              R('8.3', 'Each Party shall process the Employees’ personal data in accordance with the Personal Data Protection Law and its regulations, for the purposes of this Agreement only, and shall apply appropriate organisational and technical safeguards. The Client confirms that the Employees have been informed that their data will be shared with Business Partner and the Authorities for the purposes of this Agreement.',
                'يعالج كل طرف البيانات الشخصية للموظفين وفق نظام حماية البيانات الشخصية ولوائحه ولأغراض هذه الاتفاقية فقط، ويطبق ضمانات تنظيمية وتقنية مناسبة. ويؤكد العميل أن الموظفين أُبلغوا بأن بياناتهم ستُشارَك مع Business Partner والجهات المختصة لأغراض هذه الاتفاقية.'),
              R('8.4', 'This Agreement does not cancel any non-disclosure agreement signed between the Parties; it remains in force for information exchanged before and after this Agreement, and in case of conflict the provision more protective of confidentiality prevails.',
                'لا تُلغي هذه الاتفاقية أي اتفاقية عدم إفصاح موقّعة بين الطرفين، وهي سارية على المعلومات المتبادلة قبل هذه الاتفاقية وبعدها، وعند التعارض يؤخذ بالأشد حمايةً للسرية.'),
              R('8.5', 'The intellectual property and work product created by the Employees in the course of their work for the Client belong to the Client, as agreed in their employment contracts and in accordance with the Applicable Law.',
                'تعود للعميل الملكية الفكرية ونتاج العمل الذي ينشئه الموظفون أثناء عملهم لديه، وفق ما يُتفق عليه في عقود عملهم والأنظمة المعمول بها.')])
    # 9
    B.append([H(9, 'Liability and Force Majeure', 'المسؤولية والقوة القاهرة'),
              R('9.1', 'Business Partner shall exercise due diligence in performing the services. It does not guarantee the decisions of the Authorities.',
                'تبذل Business Partner العناية اللازمة في تنفيذ الخدمات، ولا تضمن قرارات الجهات المختصة.'),
              R('9.2', 'Business Partner’s total liability to the Client under this Agreement, whether in contract or otherwise, is limited to the Business Partner fees actually received by it in the [●] months preceding the event, excluding salaries, social insurance and amounts paid on behalf of the Client. Neither Party is liable for indirect or consequential loss or loss of profit, except in cases of fraud or gross negligence or where the Applicable Law does not permit exclusion of liability.',
                'تقتصر مسؤولية Business Partner الإجمالية تجاه العميل بموجب هذه الاتفاقية، تعاقدية أو غيرها، على رسوم Business Partner التي تسلّمتها فعلاً خلال الأشهر الـ [●] السابقة للواقعة، باستثناء الرواتب والتأمينات والمبالغ المسدَّدة نيابةً عن العميل. ولا يسأل أي من الطرفين عن الأضرار غير المباشرة أو التبعية أو فوات الربح، إلا في حالات الغش أو الخطأ الجسيم أو حيث لا تجيز الأنظمة المعمول بها استبعاد المسؤولية.'),
              R('9.3', 'The Client is liable for any loss, fine or claim arising from inaccurate information or documents it provided, from its breach of the Applicable Law, or from its instructions, and shall indemnify Business Partner against it.',
                'يسأل العميل عن أي خسارة أو غرامة أو مطالبة تنشأ عن معلومات أو مستندات غير صحيحة قدّمها أو عن مخالفته للأنظمة المعمول بها أو عن تعليماته، ويعوّض Business Partner عنها.'),
              R('9.4', 'If either Party is wholly or partly unable to fulfil its obligations because of a sudden general event beyond its control that is impossible to avoid or foresee, including a decision of the Authorities or the suspension of an official platform, it is exempted to the extent affected until the event ends, provided it immediately notifies the other Party. Payment obligations for sums already due are not suspended.',
                'إذا عجز أي طرف كلياً أو جزئياً عن الوفاء بالتزاماته بسبب حدث عام مفاجئ خارج عن إرادته يتعذّر دفعه أو توقّعه، ومنه قرار من الجهات المختصة أو تعطّل منصة رسمية، فيُعفى بقدر تأثّره حتى زوال الحدث، على أن يُخطر الطرف الآخر فوراً. ولا تُعلَّق التزامات سداد المبالغ المستحقة فعلاً.')])
    # 10
    B.append([H(10, 'Governing Law and General', 'القانون الواجب التطبيق وأحكام عامة'),
              R('10.1', 'This Agreement is governed by the laws of the Kingdom of Saudi Arabia.', 'تخضع هذه الاتفاقية لأنظمة المملكة العربية السعودية.'),
              R('10.2', 'Disputes are resolved amicably within 30 days of written notice, then before the Commercial Court in Riyadh.',
                'تُحل النزاعات ودياً خلال 30 يوماً من الإخطار الكتابي، ثم أمام المحكمة التجارية بالرياض.'),
              R('10.3', 'Notices are in writing and sent to the addresses and e-mails stated in clause 1, or to any other address notified in writing. Neither Party may assign this Agreement without the other’s written consent. Nothing in this Agreement creates a partnership between the Parties.',
                'تكون الإخطارات كتابية وترسل إلى العناوين والبريد الإلكتروني المبيّنة في البند 1 أو إلى أي عنوان آخر يُخطر به كتابةً. ولا يجوز لأي طرف التنازل عن هذه الاتفاقية دون موافقة كتابية من الآخر. ولا تنشئ هذه الاتفاقية شراكة بين الطرفين.'),
              R('10.4', 'The Parties each represent that they have the capacity and authority to enter into this Agreement and that doing so breaches no other agreement or the Applicable Law.',
                'يقر كل طرف بأن لديه الأهلية والصلاحية لإبرام هذه الاتفاقية، وأن إبرامها لا يخل بأي اتفاق آخر ولا بالأنظمة المعمول بها.'),
              R('10.5', 'This is the entire agreement of the Parties on its subject matter, and may be amended only in writing signed by both. If any provision is invalid, the remainder continues in force. Electronic signature is valid.',
                'تمثل هذه الاتفاقية كامل الاتفاق بين الطرفين في موضوعها، ولا تُعدَّل إلا كتابةً بتوقيع الطرفين. وإذا بطل أي حكم فيها بقيت سائر الأحكام نافذة. ويُعتدّ بالتوقيع الإلكتروني.'),
              R('10.6', 'This Agreement is executed in Arabic and English with the same content; the Arabic text prevails in case of inconsistency.',
                'حُررت هذه الاتفاقية بالعربية والإنجليزية بالمحتوى نفسه، ويُعتدّ بالنص العربي عند الاختلاف.')])
    return B


# ---------- الأطراف ----------
def parties_html():
    def tbl(th_en, th_ar, rows):
        body = ''.join('<tr><td>%s</td><td class="v">%s</td><td>%s</td></tr>' % r for r in rows)
        return '<table class="pty2"><tr><th colspan="3"><span>%s</span><span dir="rtl">%s</span></th></tr>%s</table>' % (th_en, th_ar, body)
    intro = R('', 'This Agreement is made on [●] between the following parties:', 'أُبرمت هذه الاتفاقية بتاريخ [●] بين الطرفين التاليين:')
    p1 = tbl('First Party (Business Partner)', 'الطرف الأول (Business Partner)', [
        ('Name', 'Business Partner Solutions<br><span dir="rtl">شركة بزنس بارتنر سلوشنز</span>', 'الاسم'),
        ('Unified / CR No.', '<span class="num">7038825860</span>', 'الرقم الموحد / السجل التجاري'),
        ('VAT No.', '<span class="num">312079341500003</span>', 'الرقم الضريبي'),
        ('Registered office', 'Al Arid, Office 25, 5890 Rihana bint Zaid, Riyadh<br><span dir="rtl">العارض، مكتب 25، 5890 ريحانة بنت زيد، الرياض</span>', 'المقر المسجل'),
        ('E-mail', '<span class="num">business@businesspartner.sa</span>', 'البريد الإلكتروني'),
        ('Represented by', 'Baher Bakr Ali Magnas · باهر بكر علي مقنص', 'يمثلها'),
        ('Title', 'المدير التنفيذي (Chief Executive Officer)', 'الصفة')])
    p2 = tbl('Second Party (the Client)', 'الطرف الثاني (العميل)', [
        ('Name', 'Maake Beauty', 'الاسم'),
        ('Unified / CR No.', '<span class="num">[●]</span>', 'الرقم الموحد / السجل التجاري'),
        ('VAT No.', '<span class="num">[●]</span>', 'الرقم الضريبي'),
        ('National Address', '<span class="num">[●]</span>', 'العنوان الوطني'),
        ('E-mail', '<span class="num">Jinane@maakebeauty.com</span>', 'البريد الإلكتروني'),
        ('Represented by', '<span class="num">[●]</span>', 'يمثلها'),
        ('Title', '<span class="num">[●]</span>', 'الصفة')])
    defs = R('', 'In this Agreement “Business Partner” is the First Party and the “Client” is the Second Party; each is a “Party” and together the “Parties”.',
             'في هذه الاتفاقية «Business Partner» هي الطرف الأول و«العميل» هو الطرف الثاني، ويُسمّى كلٌّ منهما «طرفاً» ويُسمّيان معاً «الطرفين».')
    return '<div class="pre"><b>1. الأطراف / Parties</b></div>' + intro + p1 + p2 + defs


# ---------- القالب ----------
def patched_shell(path_in, path_out):
    s = open(path_in, encoding='utf-8').read()
    i, j = s.find('<div class="pre">'), s.find('<table class="cl">')
    s = s[:i] + parties_html() + s[j:]
    rep = [
        ('<title>عقد خدمة تطوير الأعمال</title>', '<title>اتفاقية التوظيف على بند التعاقد والإسناد</title>'),
        ('SERVICE AGREEMENT', 'SERVICES AGREEMENT'),
        ('Business Development Service Agreement', 'Contracting and Outsourcing Agreement'),
        ('Sales leads and referrals and help registering as a vendor with companies.', 'We employ your Saudi team on our contract, and they work with you day to day.'),
        ('>عقد خدمة<', '>اتفاقية<'),
        ('<h1>عقد خدمة تطوير الأعمال</h1>', '<h1>اتفاقية التوظيف على بند التعاقد والإسناد</h1>'),
        ('خدمة تزويدك بفرص بيع وإحالات ومساعدتك في التسجيل كمورد لدى الشركات.', 'نوظّف فريقكم السعودي على عقدنا، ويعملون معكم يومياً.'),
        # الغلاف: الأطراف والتاريخ والنموذج
        ('<div><span>Parties / الأطراف</span>[●]<br><span class="num">[●]</span></div>', '<div><span>Parties / الأطراف</span>Business Partner Solutions<br>Maake Beauty</div>'),
        ('<div><span>Ref / المرجع</span><span class="num">[●]</span></div>', '<div><span>Model / النموذج</span>Transparent cost · 12 months<br><span dir="rtl">التكلفة بشفافية · 12 شهراً</span></div>'),
        # الورق: العنوان من العقد القائم
        ('National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia', 'Al Arid · Office 25<br>5890 Rihana bint Zaid<br>Riyadh, Saudi Arabia'),
        ('<div class="kv"><span>National Address</span><span class="kvv"><span class="num">RDAA9214</span> · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714</span><span dir="rtl">العنوان الوطني</span></div>',
         '<div class="kv"><span>Registered office</span><span class="kvv">Al Arid, Office 25, 5890 Rihana bint Zaid, Riyadh</span><span dir="rtl">المقر المسجل</span></div>'),
        # التوقيع: الاسم والصفة باسم المالك (قاعدة 2026-11-03)
        (rp.REP_OLD, rp.REP_NEW),
    ]
    for a, b in rep:
        if a not in s:
            raise SystemExit('shell pattern not found: ' + a[:70])
        s = s.replace(a, b)
    open(path_out, 'w', encoding='utf-8').write(s)


def main(outdir):
    outdir = os.path.abspath(outdir)
    work = os.path.join(outdir, '_build')
    os.makedirs(work, exist_ok=True)
    os.environ.setdefault('REV_CAP', '785')
    os.environ.setdefault('NODE_PATH', rp.sh('npm', 'root', '-g').strip())
    patched_shell(os.path.join(SRC, 'REV-contract-shell.html'), os.path.join(work, 'REV-contract-shell.html'))
    cm = types.SimpleNamespace(blocks=blocks, OUTNAME='Agreement.html', OUTDIR=outdir, SHELL='contract',
                               TITLE=('Contracting and Outsourcing Agreement', 'اتفاقية التوظيف على بند التعاقد والإسناد'))
    rev_build.HERE = work
    rev_build.TMP = os.path.join(work, 'meas'); os.makedirs(rev_build.TMP, exist_ok=True)
    rev_build.MOBILE = rp.PHONE
    rev_build.load = lambda path: cm
    rev_build.build('contract')
    src = os.path.join(outdir, 'Agreement.html')
    s2, n = rp.fieldify(open(src, encoding='utf-8').read(), 'agreement')
    fp = os.path.join(work, 'Agreement.fields.html')
    open(fp, 'w', encoding='utf-8').write(s2)
    rp.render(fp, os.path.join(outdir, 'Agreement.pdf'))
    print('fields', n, '->', os.path.join(outdir, 'Agreement.pdf'))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
