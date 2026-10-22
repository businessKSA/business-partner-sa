# -*- coding: utf-8 -*-
"""Texts of the Shared National Talent package (proposal, NDA, internal contract draft).
Each block is (kind, en, ar). kinds: title, sub, h, p, li, note, table, sig, gap.
Open items are [[PLACEHOLDERS]]. Prices come in through `prices` (read from the pricing workbook)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
NDA_PAIRS = os.path.join(HERE, '..', '..', 'cases', '2026-10-21-abdulmohsen-battery-eor', 'handoff', 'src', 'pairs_nda.json')


def n(x):
    return f'{x:,.0f}'


def proposal(pr):
    roles = [
        ('Human resources', 'الموارد البشرية', 'Human resources'),
        ('Accounting', 'المحاسبة', 'Accounting'),
        ('Marketing', 'التسويق', 'Marketing'),
        ('Sales', 'المبيعات', 'Sales'),
        ('Purchasing', 'المشتريات', 'Purchasing'),
        ('Administrative support', 'الدعم الإداري', 'Administrative support'),
        ('Project management', 'إدارة المشاريع', 'Project management'),
        ('Engineering', 'الهندسة', 'Engineering'),
    ]
    rows = []
    for en, ar, key in roles:
        r = pr[key]
        rows.append(((en, ar), [n(r['rate']), n(r['p20']), n(r['p40']), n(r['p80']), n(r['p120']), n(r['full'])]))
    head = [('Role', 'الوظيفة'), ('Per hour', 'للساعة'), ('20 h / month', '20 ساعة شهرياً'), ('40 h / month', '40 ساعة شهرياً'),
            ('80 h / month', '80 ساعة شهرياً'), ('120 h / month', '120 ساعة شهرياً'), ('Full-time month', 'شهر بدوام كامل')]
    return [
        ('title', 'Shared National Talent', 'الكوادر الوطنية المشتركة'),
        ('sub', 'Service proposal — part-time and flexible Saudi professionals, managed by Business Partner',
         'عرض سعر — كوادر سعودية بدوام جزئي ومرن تُدار من بزنس بارتنر'),
        ('meta', 'Prepared for: [[CLIENT_NAME]]   ·   Date: [[DATE]]   ·   Ref: [[PROPOSAL_NO]]   ·   Valid for [[VALIDITY_DAYS]] days',
         'مُعدّ لـ: [[اسم العميل]]   ·   التاريخ: [[التاريخ]]   ·   المرجع: [[رقم العرض]]   ·   صالح لمدة [[مدة الصلاحية]] يوماً'),
        ('note', 'DRAFT for owner review — not for sending. The employment structure in section 5 is a declared working assumption pending official and legal verification.',
         'مسودة لمراجعة المالك — لا تُرسل. هيكل التوظيف في البند 5 افتراض عمل معلَن بانتظار التحقق الرسمي والقانوني.'),
        ('h', '1. The service', '1. الخدمة'),
        ('p', 'Business Partner assigns qualified Saudi employees to your company for the days and hours you need — part-time, flexible, remote or by project — and manages them, trains them and develops their skills. You get a real professional in a defined role without the cost of a full-time hire. Every assignment is real work with deliverables and a timesheet.',
         'تُسند بزنس بارتنر إلى شركتكم موظفين سعوديين مؤهلين للأيام والساعات التي تحتاجونها — بدوام جزئي أو مرن أو عن بُعد أو بالمشروع — وتدير عملهم وتدرّبهم وتطوّر مهاراتهم. تحصلون على متخصص حقيقي في دور محدد دون تكلفة التوظيف بدوام كامل. وكل إسناد عمل فعلي له مخرجات وسجل ساعات.'),
        ('h', '2. How it works', '2. آلية العمل'),
        ('li', 'You choose the role and monthly hours, or a project scope.', 'تختارون الدور والساعات الشهرية، أو نطاق مشروع.'),
        ('li', 'We match and introduce a Saudi employee to you before the start date.', 'نرشّح لكم موظفاً سعودياً مناسباً ونعرّفكم به قبل تاريخ البدء.'),
        ('li', 'Work runs under a signed scope, a weekly plan and a timesheet.', 'يسير العمل بنطاق موقّع وخطة أسبوعية وسجل ساعات.'),
        ('li', 'A senior Business Partner manager reviews the work every week.', 'يراجع مدير أول من بزنس بارتنر العمل كل أسبوع.'),
        ('li', 'You receive a monthly report of hours, deliverables and training.', 'يصلكم تقرير شهري بالساعات والمخرجات والتدريب.'),
        ('li', 'If the employee is absent for more than [[REPLACEMENT_DAYS]] days or leaves, we provide a replacement.',
         'إن غاب الموظف أكثر من [[أيام الاستبدال]] أيام أو غادر، نوفّر بديلاً.'),
        ('h', '3. Forms of engagement', '3. صيغ التعاقد'),
        ('li', 'Part-time: fixed weekly hours with one company.', 'دوام جزئي: ساعات أسبوعية ثابتة لدى شركة واحدة.'),
        ('li', 'Flexible: hours as needed between an agreed minimum and maximum, registered through the Ministry of Human Resources "Marn" platform where applicable.',
         'عمل مرن: ساعات بحسب الحاجة بين حد أدنى وأقصى متفق عليهما، ويُوثَّق عبر منصة «مرن» التابعة لوزارة الموارد البشرية حيثما انطبق.'),
        ('li', 'Remote: tasks delivered without attendance (for example accounting, marketing, purchasing).', 'عن بُعد: مهام تُسلَّم دون حضور (مثل المحاسبة والتسويق والمشتريات).'),
        ('li', 'By project: defined scope, deliverables and duration, with milestone payments.', 'بالمشروع: نطاق ومخرجات ومدة محددة، بدفعات حسب المعالم.'),
        ('h', '4. Roles and prices (SAR, excluding VAT)', '4. الوظائف والأسعار (ريال، قبل ضريبة القيمة المضافة)'),
        ('table', head, rows),
        ('note', 'Hours between two packages are priced at the hourly rate. Field (non-administrative) roles and project-based work are quoted per assignment. VAT of 15% is added to every price.',
         'تُسعَّر الساعات بين باقتين بسعر الساعة. الوظائف الميدانية وأعمال المشاريع تُسعَّر لكل إسناد. تُضاف ضريبة القيمة المضافة 15% على كل الأسعار.'),
        ('p', 'Performance-linked pay for roles such as sales, purchasing and human resources is agreed in the assignment schedule: [[VARIABLE_PAY_TERMS]].',
         'يُتفق على الأجر المرتبط بالأداء في وظائف مثل المبيعات والمشتريات والموارد البشرية في ملحق الإسناد: [[شروط الأجر المتغير]].'),
        ('h', '5. Employment structure (working assumption)', '5. هيكل التوظيف (افتراض عمل)'),
        ('p', 'The Saudi employee holds a genuine part-time or flexible employment contract, registered with the authorities and social insurance in accordance with the structure confirmed before signature. Business Partner manages the employee, develops them and invoices the service. The final structure is confirmed in writing before the Service Agreement is signed.',
         'يحمل الموظف السعودي عقد عمل جزئياً أو مرناً حقيقياً، مسجّلاً لدى الجهات المختصة والتأمينات الاجتماعية وفق الهيكل المؤكَّد قبل التوقيع. تدير بزنس بارتنر الموظف وتطوّره وتفوتر الخدمة. ويُؤكَّد الهيكل النهائي كتابةً قبل توقيع عقد الخدمة.'),
        ('h', '6. What the price includes', '6. ما يشمله السعر'),
        ('li', 'A Saudi employee with a real contract, registered social insurance and medical insurance.', 'موظف سعودي بعقد حقيقي وتأمينات اجتماعية وتأمين طبي مسجّلين.'),
        ('li', 'Management, weekly supervision and performance review.', 'الإدارة والإشراف الأسبوعي وتقييم الأداء.'),
        ('li', 'Mandatory training and professional development for every employee.', 'التدريب والتطوير المهني الإلزاميان لكل موظف.'),
        ('li', 'Timesheets, monthly reporting and replacement cover.', 'سجل الساعات والتقارير الشهرية وتغطية الاستبدال.'),
        ('p', 'Not included: VAT; performance-linked pay agreed separately; field travel; your own tools, licences and systems.',
         'لا يشمل: ضريبة القيمة المضافة؛ الأجر المرتبط بالأداء المتفق عليه منفصلاً؛ التنقل الميداني؛ أدواتكم وتراخيصكم وأنظمتكم.'),
        ('h', '7. Integrity and compliance', '7. النزاهة والامتثال'),
        ('li', 'Every assignment is real work with a client deliverable, a timesheet and a signed scope. No employee is registered without actual work.',
         'كل إسناد عمل فعلي بمخرج للعميل وسجل ساعات ونطاق موقّع. ولا يُسجَّل موظف بلا عمل فعلي.'),
        ('li', 'Work and training records are kept for each employee and can be shown to the competent authorities.',
         'تُحفظ سجلات العمل والتدريب لكل موظف ويمكن عرضها على الجهات المختصة.'),
        ('li', 'How an assignment is counted in the Nitaqat programme depends on the employment structure registered for each employee. Business Partner makes no commitment to any Nitaqat result or band, and none that one employee counts for more than one entity.',
         'يتبع احتساب الإسناد في برنامج نطاقات الهيكل المسجَّل لكل موظف. ولا تلتزم بزنس بارتنر بأي نتيجة أو نطاق في نطاقات، ولا بأن يُحتسب موظف واحد لأكثر من منشأة.'),
        ('li', 'Both parties sign a non-disclosure agreement before any employee or company information is shared.',
         'يوقّع الطرفان اتفاقية عدم إفصاح قبل تبادل أي معلومات عن الموظفين أو الشركات.'),
        ('h', '8. Commercial terms', '8. الشروط التجارية'),
        ('li', 'Term: [[TERM_MONTHS]] months. Flexible engagements through Marn follow the term limits that the platform allows.', 'المدة: [[عدد الأشهر]] شهراً. وتلتزم عقود المرن بحدود المدة التي تتيحها المنصة.'),
        ('li', 'Invoicing: monthly, [[PAYMENT_TERMS]].', 'الفوترة: شهرية، [[شروط الدفع]].'),
        ('li', 'Early termination and notice: [[EARLY_TERMINATION]], notice [[NOTICE_DAYS]] days.', 'الإنهاء المبكر والإشعار: [[الإنهاء المبكر]]، إشعار [[أيام الإشعار]] يوماً.'),
        ('li', 'Your responsibilities: define the tasks, provide access and tools, and approve timesheets on time.', 'التزاماتكم: تحديد المهام، وتوفير الصلاحيات والأدوات، واعتماد سجل الساعات في وقته.'),
        ('h', '9. Next steps', '9. الخطوات التالية'),
        ('li', 'Sign the non-disclosure agreement.', 'توقيع اتفاقية عدم الإفصاح.'),
        ('li', 'Confirm roles, hours and start date.', 'تأكيد الوظائف والساعات وتاريخ البدء.'),
        ('li', 'Sign the Service Agreement and the assignment schedule.', 'توقيع عقد الخدمة وملحق الإسناد.'),
        ('li', 'The employee starts on the agreed date.', 'يبدأ الموظف في التاريخ المتفق عليه.'),
        ('h', 'Acceptance', 'القبول'),
        ('sig', [('Business Partner Solutions', 'شركة بزنس بارتنر سلوشنز', 'Baher Bakr Ali Magnas — General Manager', 'باهر بكر علي مقنص — المدير العام'),
                 ('[[CLIENT_NAME]]', 'شركة [[اسم العميل]]', '[[SIGNATORY_NAME]] — [[TITLE]]', '[[اسم المفوّض]] — [[الصفة]]')], None),
    ]


def nda():
    p = json.load(open(NDA_PAIRS, encoding='utf8'))
    en = [e['t'] for e, a in p]
    ar = [a['t'] for e, a in p]

    def put(i, e, a):
        en[i], ar[i] = e, a
    put(4, '(2) [[CLIENT_NAME]], a company established under the laws of [[JURISDICTION]], address [[ADDRESS]], Commercial Registration no. [[CR_NO]], represented by [[SIGNATORY_NAME]], [[TITLE]] (the "Company").',
        '(2) شركة [[اسم العميل]]، شركة مؤسَّسة وفق أنظمة [[الجهة النظامية]]، وعنوانها [[العنوان]]، سجل تجاري رقم [[رقم السجل]]، ويمثّلها السيد/ [[اسم المفوّض]] بصفته [[الصفة]] («الشركة»).')
    put(6, '1.1 The Parties wish to discuss and carry out the "Shared National Talent" service — the assignment, management and development of Saudi employees working part-time or flexibly for the Company — and related services (the "Purpose"), and each may disclose confidential information to the other for that Purpose.',
        '1-1 يرغب الطرفان في بحث وتنفيذ خدمة «الكوادر الوطنية المشتركة» — إسناد موظفين سعوديين يعملون بدوام جزئي أو مرن لدى الشركة وإدارتهم وتطويرهم — والخدمات المتصلة بها («الغرض»)، وقد يُفصح كلٌّ منهما للآخر عن معلومات سرية لهذا الغرض.')
    put(8, '2.1 "Confidential Information" means all information, in any form, disclosed by or on behalf of a Party in connection with the Purpose, including company documents, employee and candidate information, identity details, salaries and contracts, work plans and client information, pricing, proposals, methods and know-how, and any information a reasonable person would regard as confidential.',
        '2-1 تعني «المعلومات السرية» كل معلومة، بأي صورة، يُفصح عنها أحد الطرفين أو من ينوب عنه فيما يتصل بالغرض، بما في ذلك مستندات الشركة وبيانات الموظفين والمرشحين وبيانات الهوية والرواتب والعقود وخطط العمل ومعلومات العملاء والأسعار والعروض والأساليب والخبرات، وأي معلومة يعدّها الشخص المعتاد سرية.')
    put(11, '3.2 Personal data of employees and candidates (including identity details, salaries and performance records) shall be handled only by persons who need it for the Purpose and shall be protected in accordance with applicable law, including the Personal Data Protection Law.',
        '3-2 تُعالَج البيانات الشخصية للموظفين والمرشحين (ومنها بيانات الهوية والرواتب وسجلات الأداء) من الأشخاص المحتاجين إليها للغرض فقط، وتُحمى وفق الأنظمة السارية ومنها نظام حماية البيانات الشخصية.')
    put(15, '5.1 A Party may disclose Confidential Information (a) to its directors, employees, and professional advisers who need to know it for the Purpose and are bound by equivalent confidentiality duties; (b) to confidential service providers engaged for the Purpose (such as payroll, insurance, training, and cloud and AI processing providers) under confidentiality obligations; and (c) to the Saudi government authorities (including the Ministry of Human Resources and Social Development, the General Organization for Social Insurance and ZATCA) to the extent necessary to carry out the Purpose.',
        '5-1 يجوز لأي طرف الإفصاح عن المعلومات السرية (أ) لأعضاء مجلس إدارته وموظفيه ومستشاريه المهنيين المحتاجين إليها للغرض والملزمين بالتزامات سرية مماثلة؛ (ب) لمقدمي الخدمة الملتزمين بالسرية والمتعاقد معهم للغرض (كمعالجة الرواتب والتأمين والتدريب ومزودي المعالجة السحابية والذكاء الآلي)؛ و(ج) للجهات الحكومية السعودية (ومنها وزارة الموارد البشرية والتنمية الاجتماعية والمؤسسة العامة للتأمينات الاجتماعية وهيئة الزكاة والضريبة والجمارك) بالقدر اللازم لتنفيذ الغرض.')
    extra = {
        '3.3': ('3.3 Employees assigned to several companies: information of one company is not shared with another company served by the same employee, and the employee is bound in writing by the same duties.',
                '3-3 الموظفون المُسنَدون إلى أكثر من شركة: لا تُنقل معلومات شركة إلى شركة أخرى يخدمها الموظف نفسه، ويلتزم الموظف كتابةً بالالتزامات نفسها.'),
    }
    pairs = list(zip(en, ar))
    out = []
    for i, (e, a) in enumerate(pairs):
        out.append(('h' if _is_head(e) else 'p', e, a))
        if i == 11:
            out.append(('p',) + extra['3.3'])
    # signature blocks (replace the last 8 pairs with structured block)
    sig_start = 28
    body = out[:sig_start]
    body.append(('sig', [(en[28], ar[28], en[29], ar[29]),
                         ('[[CLIENT_NAME]]', 'شركة [[اسم العميل]]', '[[SIGNATORY_NAME]] — [[TITLE]]', '[[اسم المفوّض]] — [[الصفة]]')], None))
    first = body[0]
    # opening paragraph becomes the title block
    head = [('title', 'Mutual Non-Disclosure Agreement', 'اتفاقية عدم الإفصاح المتبادلة'),
            ('sub', 'Shared National Talent service', 'خدمة الكوادر الوطنية المشتركة'),
            ('note', 'DRAFT — requires human legal review before use. Based on the Business Partner NDA template; the client details are placeholders.',
             'مسودة — تحتاج مراجعة قانونية بشرية قبل الاستعمال. مبنية على قالب الـNDA المعتمد لدى بزنس بارتنر؛ وبيانات العميل حقول فارغة.')]
    return head + body


def _is_head(e):
    import re
    return bool(re.match(r'^(\d+\.\s+[A-Z ,&-]+$|BETWEEN:|IN WITNESS|And;)', e))


def contract(pr):
    L = []
    A = L.append
    A(('title', 'Service Assignment Agreement', 'عقد إسناد الكوادر الوطنية المشتركة'))
    A(('sub', 'Shared National Talent — INTERNAL DRAFT STRUCTURE', 'الكوادر الوطنية المشتركة — هيكل مسودة داخلية'))
    A(('note', 'INTERNAL DRAFT — NOT FINAL. Not for sending or signature. Structure and wording await the full legal response (BP_AI_Tasks: legal-to-badr-20261022-albir-abdulmohsen, badr-2026-10-22-legal-abdulmohsen-nat-talent). Square-bracket items are open decisions.',
         'مسودة داخلية — غير نهائية. لا تُرسل ولا يُوقَّع عليها. الهيكل والصياغة بانتظار الرد القانوني الكامل (مهمتا BP_AI_Tasks: legal-to-badr-20261022-albir-abdulmohsen وbadr-2026-10-22-legal-abdulmohsen-nat-talent). البنود بين الأقواس مفتوحة للقرار.'))
    A(('p', 'This Agreement is made on [[DATE]] between Business Partner Solutions, a limited liability company, Commercial Registration no. 1009014355, Riyadh, holder of licence [[LICENSE_NO]] for "mediation in employing Saudis and assigning temporary national staff" ("Business Partner"), and [[CLIENT_NAME]], Commercial Registration no. [[CR_NO]], address [[ADDRESS]] (the "Client").',
         'أُبرم هذا العقد بتاريخ [[التاريخ]] بين شركة بزنس بارتنر سلوشنز، شركة ذات مسؤولية محدودة، سجل تجاري رقم 1009014355، الرياض، المرخّصة برقم [[رقم الترخيص]] لـ«التوسط لتوظيف السعوديين وإسناد الكوادر الوطنية المؤقتة» («بزنس بارتنر»)، وشركة [[اسم العميل]]، سجل تجاري رقم [[رقم السجل]]، وعنوانها [[العنوان]] («العميل»).'))
    clauses = [
        ('1. Definitions', '1. التعريفات', [
            ('1.1 "Assigned Employee" means a Saudi national assigned to the Client under an Assignment Schedule. "Assignment Schedule" means Schedule 1. "Hours" and "Fees" have the meanings in Schedules 1 and 2.',
             '1-1 «الموظف المُسنَد» سعودي الجنسية يُسنَد إلى العميل بموجب ملحق إسناد. «ملحق الإسناد» هو الملحق (1). ولـ«الساعات» و«الأتعاب» المعنى الوارد في الملحقين (1) و(2).')]),
        ('2. Services', '2. الخدمات', [
            ('2.1 Business Partner assigns the Assigned Employee to the Client for the role, hours and period in the Assignment Schedule, manages and supervises the employee, and delivers the mandatory training and development plan.',
             '2-1 تُسند بزنس بارتنر الموظف المُسنَد إلى العميل للدور والساعات والمدة الواردة في ملحق الإسناد، وتدير الموظف وتشرف عليه، وتنفّذ خطة التدريب والتطوير الإلزامية.'),
            ('2.2 [[Employment structure — OPTION A (working assumption): the Client is the registered employer under a genuine part-time or flexible contract; Business Partner manages and invoices. Options B and C: text reserved for the legal response.]]',
             '2-2 [[هيكل التوظيف — الخيار (أ) (افتراض عمل): العميل صاحب العمل المسجَّل بعقد جزئي أو مرن حقيقي، وبزنس بارتنر تدير وتفوتر. الخياران (ب) و(ج): النص محجوز لرد القانونية.]]')]),
        ('3. Genuine work and integrity', '3. العمل الحقيقي والنزاهة', [
            ('3.1 Every assignment is genuine work with a Client deliverable, a timesheet and a signed scope. Neither party shall register or maintain an employee without actual work.',
             '3-1 كل إسناد عمل حقيقي بمخرج للعميل وسجل ساعات ونطاق موقّع. ولا يسجّل أي طرف موظفاً أو يُبقي تسجيله بلا عمل فعلي.'),
            ('3.2 Business Partner keeps work and training records for each Assigned Employee and the Client may inspect them; either party may present them to the competent authorities.',
             '3-2 تحتفظ بزنس بارتنر بسجلات العمل والتدريب لكل موظف مُسنَد، ويحق للعميل الاطلاع عليها، ولكل طرف عرضها على الجهات المختصة.')]),
        ('4. Client obligations', '4. التزامات العميل', [
            ('4.1 The Client defines tasks within the signed scope, provides access, tools and a safe working environment, and approves timesheets within [[APPROVAL_DAYS]] days.',
             '4-1 يحدد العميل المهام ضمن النطاق الموقّع، ويوفّر الصلاحيات والأدوات وبيئة عمل آمنة، ويعتمد سجل الساعات خلال [[أيام الاعتماد]] أيام.'),
            ('4.2 The Client shall not assign work outside the scope or the agreed hours without a written change to the Assignment Schedule.',
             '4-2 لا يكلّف العميل بعمل خارج النطاق أو الساعات المتفق عليها دون تعديل كتابي لملحق الإسناد.')]),
        ('5. Fees and invoicing', '5. الأتعاب والفوترة', [
            ('5.1 Fees are as in Schedule 2, exclude VAT (15%), and are invoiced monthly [[PAYMENT_TERMS]].',
             '5-1 الأتعاب كما في الملحق (2)، وهي قبل ضريبة القيمة المضافة (15%)، وتُفوتَر شهرياً [[شروط الدفع]].'),
            ('5.2 Performance-linked pay, if any, is as agreed in the Assignment Schedule and is in addition to the Fees: [[VARIABLE_PAY_TERMS]].',
             '5-2 الأجر المرتبط بالأداء، إن وُجد، وفق ما يُتفق عليه في ملحق الإسناد، وهو إضافة إلى الأتعاب: [[شروط الأجر المتغير]].')]),
        ('6. Replacement', '6. الاستبدال', [
            ('6.1 If the Assigned Employee is absent for more than [[REPLACEMENT_DAYS]] days or leaves, Business Partner provides a replacement within [[REPLACEMENT_PERIOD]].',
             '6-1 إن غاب الموظف المُسنَد أكثر من [[أيام الاستبدال]] أيام أو غادر، توفّر بزنس بارتنر بديلاً خلال [[مدة الاستبدال]].')]),
        ('7. Confidentiality and personal data', '7. السرية والبيانات الشخصية', [
            ('7.1 The parties are bound by the Non-Disclosure Agreement signed between them, which this Agreement does not cancel. Personal data is processed in accordance with applicable law.',
             '7-1 يلتزم الطرفان باتفاقية عدم الإفصاح الموقّعة بينهما ولا يلغيها هذا العقد. وتُعالَج البيانات الشخصية وفق الأنظمة السارية.')]),
        ('8. Conflicts of interest', '8. تعارض المصالح', [
            ('8.1 An Assigned Employee may serve other clients of Business Partner. Business Partner shall disclose to the Client any assignment to a direct competitor, keep information of each client separate, and the Client may refuse the assignment of a particular employee for a reasonable ground.',
             '8-1 يجوز أن يخدم الموظف المُسنَد عملاء آخرين لبزنس بارتنر. وتفصح بزنس بارتنر للعميل عن أي إسناد لمنافس مباشر وتفصل معلومات كل عميل، ويحق للعميل رفض إسناد موظف بعينه لسبب معقول.')]),
        ('9. Localisation statement', '9. بيان التوطين', [
            ('9.1 Business Partner gives no commitment as to any Nitaqat result or band, nor that one employee counts for more than one entity. Any counting follows the structure registered with the authorities.',
             '9-1 لا تلتزم بزنس بارتنر بأي نتيجة أو نطاق في برنامج نطاقات، ولا بأن يُحتسب موظف واحد لأكثر من منشأة. ويتبع أي احتساب الهيكل المسجَّل لدى الجهات المختصة.')]),
        ('10. Term and termination', '10. المدة والإنهاء', [
            ('10.1 Term: [[TERM_MONTHS]] months from the start date. Early termination and notice: [[EARLY_TERMINATION]], [[NOTICE_DAYS]] days. Who bears end-of-service and any remaining-term wages on early termination: [[EOS_ALLOCATION]].',
             '10-1 المدة: [[عدد الأشهر]] شهراً من تاريخ البدء. الإنهاء المبكر والإشعار: [[الإنهاء المبكر]]، [[أيام الإشعار]] يوماً. من يتحمل مكافأة نهاية الخدمة وأجور المدة المتبقية عند الإنهاء المبكر: [[تحمّل نهاية الخدمة]].')]),
        ('11. Liability', '11. المسؤولية', [
            ('11.1 [[LIABILITY_CAP — reserved for legal review]]', '11-1 [[سقف المسؤولية — محجوز للمراجعة القانونية]]')]),
        ('12. Governing law and language', '12. النظام الواجب التطبيق واللغة', [
            ('12.1 This Agreement is governed by the laws of the Kingdom of Saudi Arabia and the courts of Riyadh have exclusive jurisdiction. It is made in Arabic and English; if they differ, the Arabic text prevails.',
             '12-1 يخضع هذا العقد لأنظمة المملكة العربية السعودية وتختص محاكم الرياض حصرياً. وقد حُرّر بالعربية والإنجليزية، وعند الاختلاف يُعتد بالنص العربي.')]),
    ]
    for he, ha, items in clauses:
        A(('h', he, ha))
        for e, a in items:
            A(('p', e, a))
    A(('sig', [('Business Partner Solutions', 'شركة بزنس بارتنر سلوشنز', 'Baher Bakr Ali Magnas — General Manager', 'باهر بكر علي مقنص — المدير العام'),
               ('[[CLIENT_NAME]]', 'شركة [[اسم العميل]]', '[[SIGNATORY_NAME]] — [[TITLE]]', '[[اسم المفوّض]] — [[الصفة]]')], None))
    A(('h', 'Schedule 1 — Assignment Schedule (one per employee)', 'الملحق (1) — ملحق الإسناد (واحد لكل موظف)'))
    A(('table', [('Item', 'البند'), ('Detail', 'التفصيل')],
       [(('Role', 'الوظيفة'), ['[[ROLE]]']), (('Form of engagement', 'صيغة التعاقد'), ['[[part-time / flexible / remote / project]]']),
        (('Hours per month, days and times', 'الساعات الشهرية والأيام والأوقات'), ['[[HOURS]]']),
        (('Scope and deliverables', 'النطاق والمخرجات'), ['[[SCOPE]]']), (('Start date and period', 'تاريخ البدء والمدة'), ['[[START]] / [[PERIOD]]']),
        (('Performance-linked pay', 'الأجر المرتبط بالأداء'), ['[[VARIABLE_PAY_TERMS]]'])]))
    A(('h', 'Schedule 2 — Fees (SAR per month, excluding VAT)', 'الملحق (2) — الأتعاب (ريال شهرياً، قبل الضريبة)'))
    p = proposal(pr)
    tbl = [b for b in p if b[0] == 'table'][0]
    A(tbl)
    A(('note', 'Prices are taken from the Business Partner rate card; they must match the signed proposal.', 'الأسعار من بطاقة أسعار بزنس بارتنر ويجب أن تطابق العرض الموقّع.'))
    return L


def proposal_slides(pr):
    """Landscape deck (1920x1080). Slide = (kind, title(en,ar), payload). Same facts and numbers as proposal()."""
    rows = []
    for en, ar, key in [('Human resources', 'الموارد البشرية', 'Human resources'), ('Accounting', 'المحاسبة', 'Accounting'),
                        ('Marketing', 'التسويق', 'Marketing'), ('Sales', 'المبيعات', 'Sales'), ('Purchasing', 'المشتريات', 'Purchasing'),
                        ('Administrative support', 'الدعم الإداري', 'Administrative support'),
                        ('Project management', 'إدارة المشاريع', 'Project management'), ('Engineering', 'الهندسة', 'Engineering')]:
        r = pr[key]
        rows.append(((en, ar), [n(r['rate']), n(r['p20']), n(r['p40']), n(r['p80']), n(r['p120']), n(r['full'])]))
    head = [('Role', 'الوظيفة'), ('Per hour', 'للساعة'), ('20 h', '20 ساعة'), ('40 h', '40 ساعة'), ('80 h', '80 ساعة'), ('120 h', '120 ساعة'),
            ('Full-time month', 'شهر كامل')]
    return [
        ('cover', ('Shared National Talent', 'الكوادر الوطنية المشتركة'),
         dict(sub=('Service proposal — part-time and flexible Saudi professionals, managed by Business Partner',
                   'عرض سعر — كوادر سعودية بدوام جزئي ومرن تُدار من بزنس بارتنر'),
              meta=('Prepared for [[CLIENT_NAME]] · [[DATE]] · Ref [[PROPOSAL_NO]] · Valid for [[VALIDITY_DAYS]] days',
                    'مُعدّ لـ [[اسم العميل]] · [[التاريخ]] · المرجع [[رقم العرض]] · صالح لمدة [[مدة الصلاحية]] يوماً'),
              note=('DRAFT for owner review — not for sending', 'مسودة لمراجعة المالك — لا تُرسل'))),
        ('text', ('The service', 'الخدمة'),
         dict(lead=('A real Saudi professional, for the hours you actually need.', 'متخصص سعودي حقيقي… للساعات التي تحتاجها فعلاً.'),
              body=('Business Partner assigns qualified Saudi employees to your company part-time, flexibly, remotely or by project, and manages them, trains them and develops their skills. A defined role without the cost of a full-time hire. Every assignment is real work with deliverables and a timesheet.',
                    'تُسند بزنس بارتنر إلى شركتكم موظفين سعوديين مؤهلين بدوام جزئي أو مرن أو عن بُعد أو بالمشروع، وتدير عملهم وتدرّبهم وتطوّر مهاراتهم. دور محدد دون تكلفة التوظيف بدوام كامل. وكل إسناد عمل فعلي له مخرجات وسجل ساعات.'))),
        ('steps', ('How it works', 'آلية العمل'), [
            (('Choose the role and hours', 'اختيار الدور والساعات'), ('Or a project scope.', 'أو نطاق مشروع.')),
            (('We match and introduce', 'نرشّح ونعرّفكم'), ('A Saudi employee, introduced before the start date.', 'موظف سعودي نعرّفكم به قبل تاريخ البدء.')),
            (('Signed scope, weekly review', 'نطاق موقّع ومراجعة أسبوعية'), ('Timesheet and weekly review by a senior manager.', 'سجل ساعات ومراجعة أسبوعية من مدير أول.')),
            (('Monthly report, replacement cover', 'تقرير شهري وتغطية استبدال'), ('Hours, deliverables and training; replacement if absent more than [[REPLACEMENT_DAYS]] days.',
                                                                              'الساعات والمخرجات والتدريب؛ واستبدال عند الغياب أكثر من [[أيام الاستبدال]] أيام.'))]),
        ('cards', ('Forms of engagement', 'صيغ التعاقد'), [
            (('Part-time', 'دوام جزئي'), ('Fixed weekly hours with one company.', 'ساعات أسبوعية ثابتة لدى شركة واحدة.')),
            (('Flexible', 'عمل مرن'), ('Hours between an agreed minimum and maximum, documented through the Marn platform where applicable.',
                                       'ساعات بين حد أدنى وأقصى متفق عليهما، وتُوثَّق عبر منصة «مرن» حيثما انطبق.')),
            (('Remote', 'عن بُعد'), ('Tasks delivered without attendance.', 'مهام تُسلَّم دون حضور.')),
            (('By project', 'بالمشروع'), ('Defined scope, deliverables and milestone payments.', 'نطاق ومخرجات ودفعات حسب المعالم.'))]),
        ('table', ('Roles and prices — SAR per month, excluding VAT', 'الوظائف والأسعار — ريال شهرياً قبل الضريبة'),
         dict(head=head, rows=rows,
              note=('Hours between two packages are priced at the hourly rate. Field roles and projects are quoted per assignment. VAT 15% is added.',
                    'تُسعَّر الساعات بين باقتين بسعر الساعة. الوظائف الميدانية والمشاريع تُسعَّر لكل إسناد. تُضاف ضريبة 15%.'))),
        ('cards', ('What the price includes', 'ما يشمله السعر'), [
            (('Real employment', 'توظيف حقيقي'), ('Real contract, registered social and medical insurance.', 'عقد حقيقي وتأمينات اجتماعية وطبية مسجّلة.')),
            (('Management', 'الإدارة'), ('Weekly supervision and performance review.', 'إشراف أسبوعي وتقييم أداء.')),
            (('Training', 'التدريب'), ('Mandatory training and professional development for every employee.', 'تدريب وتطوير مهني إلزاميان لكل موظف.')),
            (('Reporting and cover', 'التقارير والتغطية'), ('Timesheets, monthly reports and replacement. Not included: VAT, performance-linked pay agreed separately, field travel, your own tools.',
                                                           'سجل الساعات وتقارير شهرية واستبدال. لا يشمل: الضريبة، الأجر المرتبط بالأداء المتفق عليه منفصلاً، التنقل الميداني، أدواتكم.'))]),
        ('cards', ('Integrity and compliance', 'النزاهة والامتثال'), [
            (('Real work only', 'عمل حقيقي فقط'), ('Client deliverable, timesheet and signed scope for every assignment. No employee is registered without actual work.',
                                                    'مخرج للعميل وسجل ساعات ونطاق موقّع لكل إسناد. ولا يُسجَّل موظف بلا عمل فعلي.')),
            (('Records you can show', 'سجلات تُعرض'), ('Work and training records per employee, available to the competent authorities.', 'سجلات العمل والتدريب لكل موظف متاحة للجهات المختصة.')),
            (('No Nitaqat promise', 'لا وعد في نطاقات'), ('Counting follows the structure registered for each employee. No commitment to any Nitaqat result, nor that one employee counts for more than one entity.',
                                                         'يتبع الاحتساب الهيكل المسجَّل لكل موظف. لا التزام بأي نتيجة في نطاقات، ولا بأن يُحتسب موظف لأكثر من منشأة.')),
            (('NDA first', 'اتفاقية السرية أولاً'), ('Both parties sign a non-disclosure agreement before any information is shared.', 'يوقّع الطرفان اتفاقية عدم إفصاح قبل تبادل أي معلومات.'))]),
        ('terms', ('Commercial terms and next steps', 'الشروط التجارية والخطوات التالية'),
         dict(terms=[(('Term', 'المدة'), ('[[TERM_MONTHS]] months; Marn engagements follow the platform limits', '[[عدد الأشهر]] شهراً؛ وعقود مرن تلتزم بحدود المنصة')),
                     (('Invoicing', 'الفوترة'), ('Monthly, [[PAYMENT_TERMS]]', 'شهرية، [[شروط الدفع]]')),
                     (('Early termination', 'الإنهاء المبكر'), ('[[EARLY_TERMINATION]], notice [[NOTICE_DAYS]] days', '[[الإنهاء المبكر]]، إشعار [[أيام الإشعار]] يوماً')),
                     (('Your responsibilities', 'التزاماتكم'), ('Define tasks, provide access and tools, approve timesheets on time', 'تحديد المهام وتوفير الصلاحيات والأدوات واعتماد السجل في وقته'))],
              steps=[('Sign the NDA', 'توقيع اتفاقية عدم الإفصاح'), ('Confirm roles, hours and start date', 'تأكيد الوظائف والساعات وتاريخ البدء'),
                     ('Sign the Service Agreement and schedule', 'توقيع عقد الخدمة وملحق الإسناد'), ('Employee starts', 'يبدأ الموظف')])),
        ('accept', ('Acceptance', 'القبول'),
         dict(sigs=[('Business Partner Solutions', 'شركة بزنس بارتنر سلوشنز', 'Baher Bakr Ali Magnas — General Manager', 'باهر بكر علي مقنص — المدير العام'),
                    ('[[CLIENT_NAME]]', 'شركة [[اسم العميل]]', '[[SIGNATORY_NAME]] — [[TITLE]]', '[[اسم المفوّض]] — [[الصفة]]')],
              note=('The employment structure is a declared working assumption until confirmed in writing before the Service Agreement is signed.',
                    'هيكل التوظيف افتراض عمل معلَن إلى أن يُؤكَّد كتابةً قبل توقيع عقد الخدمة.'))),
    ]
