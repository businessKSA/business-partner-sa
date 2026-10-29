# -*- coding: utf-8 -*-
"""Quote in the permanent Business Partner quotation standard (owner decision 2026-10-29):
A4 landscape, Arabic on the right and English on the left in aligned rows, navy cover, closing cover.
CSS, letterhead and standard pages are read from docs/sales/templates (nst_tpl.py).
Usage: python3 gen_nst_a4.py [WORKDIR]   Prices are read from the pricing workbook through gen_nst.prices()."""
import os, sys, re, base64, subprocess
import gen_nst as G
import nst_tpl as T

HERE, WORK, OUT, CHROME = G.HERE, G.WORK, G.OUT, G.CHROME
ph = G.ph


def b64(f):
    return base64.b64encode(open(os.path.join(WORK, f), 'rb').read()).decode()


def fonts():
    spec = [('IBM Plex Sans Arabic', 400, 'ar400'), ('IBM Plex Sans Arabic', 700, 'ar700'), ('IBM Plex Mono', 400, 'mono400'), ('Playfair Display', 700, 'pf700')]
    for _, _, k in spec:
        if not os.path.exists(os.path.join(WORK, k + '.ttf')):
            raise SystemExit(f'missing font {k}.ttf in {WORK}')
    return ''.join("@font-face{font-family:'%s';font-weight:%d;src:url(data:font/ttf;base64,%s)}" % (n, w, b64(k + '.ttf')) for n, w, k in spec)


def css():
    extra = ("@page{size:1123px 794px;margin:0}body{margin:0;background:#fff}.sheet{break-after:page;page-break-after:always}"
             "mark.ph{background:#EEF1FB;color:#1E3A9E;border-bottom:1.5px solid #1E3A9E;padding:0 2px;border-radius:2px;font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace}"
             ".cv mark.ph{background:rgba(255,255,255,.14);color:#fff;border-bottom-color:#9DB4FF}.sb3{margin:7px 0 3px;color:#0B1B5A;font-weight:700;font-size:12px}")
    return T.css(T.QUOTE) + extra


TOTAL = 9
FT = ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
      '<div class="c">[●]<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">%d / ' + str(TOTAL) + '</span></div>'
      '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>')
LOGO = '<span class="logo" role="img" aria-label="Business Partner"></span>'
TITLE = ('Quotation: Shared National Talent', 'عرض سعر: الكوادر الوطنية المشتركة')


def hd2():
    return (f'<div class="hd2">{LOGO}<div class="t e"><h1>{TITLE[0]}</h1></div><div class="t a"><h1>{TITLE[1]}</h1></div></div>')


def rw(en, ar, cls=''):
    return f'<div class="rw {cls}"><div class="col" dir="ltr">{en}</div><div class="col" dir="rtl">{ar}</div></div>'


def h2(n, en, ar):
    num = f'<span class="n">{n}</span>' if n else ''
    return rw(f'<h2>{num}{ph(en)}</h2>', f'<h2>{num}{ph(ar)}</h2>')


def p(en, ar):
    return rw(f'<p>{ph(en)}</p>', f'<p>{ph(ar)}</p>')


def card(en_t, en_b, ar_t, ar_b):
    return rw(f'<div class="card"><b>{ph(en_t)}</b><br>{ph(en_b)}</div>', f'<div class="card"><b>{ph(ar_t)}</b><br>{ph(ar_b)}</div>', 'cd')


def pair_table(hdr, rows, widths=(14, 35, 2, 35, 14)):
    """hdr = (en label, en text, ar text, ar label); rows = [(en label, en text, ar text, ar label)]"""
    cg = ''.join(f'<col style="width:{w}%">' for w in widths)
    t = f'<table class="pt"><colgroup>{cg}</colgroup><tr><th class="en">{hdr[0]}</th><th class="en">{hdr[1]}</th><td class="gp"></td><th class="ar">{hdr[2]}</th><th class="ar">{hdr[3]}</th></tr>'
    for a, b, c, d in rows:
        t += f'<tr><td class="en">{ph(a)}</td><td class="en">{ph(b)}</td><td class="gp"></td><td class="ar">{ph(c)}</td><td class="ar">{ph(d)}</td></tr>'
    return t + '</table>'


def num_table(hdr_en, hdr_ar, rows):
    t = ('<table class="pt lt"><colgroup><col style="width:4%"><col style="width:45%"><col style="width:2%"><col style="width:45%"><col style="width:4%"></colgroup>'
         f'<tr><th class="en">#</th><th class="en">{hdr_en}</th><td class="gp"></td><th class="ar">{hdr_ar}</th><th class="ar">#</th></tr>')
    for i, (e, a) in enumerate(rows, 1):
        t += f'<tr><td class="en">{i}</td><td class="en">{ph(e)}</td><td class="gp"></td><td class="ar">{ph(a)}</td><td class="ar">{i}</td></tr>'
    return t + '</table>'


def prices_table(pr):
    roles = [('Human resources', 'الموارد البشرية', 'Human resources'), ('Accounting', 'المحاسبة', 'Accounting'), ('Marketing', 'التسويق', 'Marketing'),
             ('Sales', 'المبيعات', 'Sales'), ('Purchasing', 'المشتريات', 'Purchasing'), ('Administrative support', 'الدعم الإداري', 'Administrative support'),
             ('Project management', 'إدارة المشاريع', 'Project management'), ('Engineering', 'الهندسة', 'Engineering')]
    he = ['Per hour', '20 h', '40 h', '80 h', '120 h', 'Full-time<br>month']
    ha = ['للساعة', '20 ساعة', '40 ساعة', '80 ساعة', '120 ساعة', 'شهر<br>كامل']
    side = (100 - 30 - 2) / 12
    cg = f'<col style="width:15%">' + f'<col style="width:{side}%">' * 6 + '<col style="width:2%">' + f'<col style="width:{side}%">' * 6 + '<col style="width:15%">'
    t = f'<table class="pt"><colgroup>{cg}</colgroup><tr><th class="en">Role</th>' + ''.join(f'<th class="c en">{x}</th>' for x in he) + '<td class="gp"></td>' + ''.join(f'<th class="c ar">{x}</th>' for x in reversed(ha)) + '<th class="ar">الوظيفة</th></tr>'
    for en, ar, key in roles:
        r = pr[key]
        v = [f'{r["rate"]:,.0f}', f'{r["p20"]:,.0f}', f'{r["p40"]:,.0f}', f'{r["p80"]:,.0f}', f'{r["p120"]:,.0f}', f'{r["full"]:,.0f}']
        t += (f'<tr><td class="en">{en}</td>' + ''.join(f'<td class="c en"><span class="num">{x}</span></td>' for x in v) + '<td class="gp"></td>'
              + ''.join(f'<td class="c ar"><span class="num">{x}</span></td>' for x in reversed(v)) + f'<td class="ar">{ar}</td></tr>')
    return t + '</table>'


def sig_block():
    def one(en, ar, fixed=None):
        fields = [('Company', 'الشركة'), ('Name', 'الاسم'), ('Title', 'الصفة'), ('Date', 'التاريخ')]
        rows = ''
        for i, (e, a) in enumerate(fields):
            val = fixed if (fixed and i == 0) else '<span class="num">[●]</span>'
            rows += f'<div class="f2"><span>{e}</span><span class="v cn">{val}</span><span dir="rtl">{a}</span></div>'
        return (f'<div><h3><span>{en}</span><span dir="rtl">{ar}</span></h3>{rows}'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>')
    return '<div class="sg" style="direction:ltr">' + one('Business Partner Solutions', 'بزنس بارتنر سلوشنز', 'Business Partner Solutions · بزنس بارتنر سلوشنز') + one('Client', 'العميل') + '</div>'


def sheet(inner, n, closing=False):
    return f'<section class="sheet land" lang="ar"><div dir="rtl">{inner}</div>{FT % n}</section>'


def template_page(idx, title_swap=True):
    """Inner content of a standard template page (without footer), with the quotation title replaced."""
    s = T.inner(T.sheets(T.QUOTE)[idx])
    s = s[len('<div dir="rtl">'):]
    s = s[:s.rindex('</div>')]
    if title_swap:
        s = s.replace('Quotation: Business Development as a Service', TITLE[0]).replace('عرض سعر: تطوير الأعمال كخدمة', TITLE[1])
    return s


def sub(en, ar):
    return rw(f'<div class="sb3">{ph(en)}</div>', f'<div class="sb3">{ph(ar)}</div>')


def build_pages(pr):
    S = []

    def pg(inner):
        S.append(sheet(inner, len(S) + 1))
    # 1 cover
    pg(f'<div class="cv"><div class="lgc">{LOGO}</div><div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">Shared National Talent</h1>'
       '<div class="sb">Qualified Saudi professionals, part-time and flexible, managed and developed by Business Partner.</div></div>'
       '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>الكوادر الوطنية المشتركة</h1>'
       '<div class="sb">كوادر سعودية مؤهلة بدوام جزئي ومرن، تديرها وتطوّرها Business Partner.</div></div></div>'
       '<div class="pk" dir="ltr">Accounting · HR · Marketing · Sales · Purchasing · Admin · Projects · Engineering</div>'
       '<div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">المحاسبة · الموارد البشرية · التسويق · المبيعات · المشتريات · الدعم الإداري · المشاريع · الهندسة</div>'
       '<div class="ch"><div><span>To / إلى السادة</span><span class="num">[●]</span></div><div><span>Date / التاريخ</span><span class="num">29/10/2026</span></div>'
       '<div><span>Validity / صلاحية العرض</span><mark class="ph">[VALIDITY_DAYS]</mark> days<br><mark class="ph">[مدة الصلاحية]</mark> يوماً</div></div></div>')
    # 2 other Business Partner services (template page, no prices)
    pg(template_page(1))
    # 3 price
    s = hd2() + '<div class="bp">'
    s += ('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> <span class="num">[●]</span></div><div class="meta1"><b>Date:</b> <span class="num">29/10/2026</span></div>'
          '<div class="meta1"><b>Quote validity:</b> <mark class="ph">[VALIDITY_DAYS]</mark> days</div></div>'
          '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> <span class="num">[●]</span></div><div class="meta1"><b>التاريخ:</b> <span class="num">29/10/2026</span></div>'
          '<div class="meta1"><b>صلاحية العرض:</b> <mark class="ph">[مدة الصلاحية]</mark> يوماً</div></div></div>')
    s += h2(1, 'Price (SAR per month, excl. VAT)', 'السعر (ريال شهرياً، قبل الضريبة)')
    s += prices_table(pr)
    s += p('Hours between two packages are priced at the hourly rate. Field (non-administrative) roles and project-based work are quoted per assignment. VAT of 15% is added to every price.',
           'تُسعَّر الساعات بين باقتين بسعر الساعة. الوظائف الميدانية وأعمال المشاريع تُسعَّر لكل إسناد. تُضاف ضريبة القيمة المضافة 15% على كل الأسعار.')
    s += p('Performance-linked pay for roles such as sales, purchasing and human resources is agreed in the assignment schedule: [[VARIABLE_PAY_TERMS]].',
           'يُتفق على الأجر المرتبط بالأداء في وظائف مثل المبيعات والمشتريات والموارد البشرية في ملحق الإسناد: [[شروط الأجر المتغير]].')
    pg(s + '</div>')
    # 4 scope (1/2)
    s = hd2() + '<div class="bp">'
    s += h2(2, 'Scope', 'النطاق')
    s += p('Business Partner assigns qualified Saudi employees to your company part-time, flexibly, remotely or by project, and manages them, trains them and develops their skills. A defined role without the cost of a full-time hire. Every assignment is real work with deliverables and a timesheet.',
           'تُسند بزنس بارتنر إلى شركتكم موظفين سعوديين مؤهلين بدوام جزئي أو مرن أو عن بُعد أو بالمشروع، وتدير عملهم وتدرّبهم وتطوّر مهاراتهم. دور محدد دون تكلفة التوظيف بدوام كامل. وكل إسناد عمل فعلي له مخرجات وسجل ساعات.')
    s += sub('How it works', 'آلية العمل')
    s += num_table('How it works', 'آلية العمل', [
        ('You choose the role and monthly hours, or a project scope.', 'تختارون الدور والساعات الشهرية، أو نطاق مشروع.'),
        ('We match and introduce a Saudi employee to you before the start date.', 'نرشّح لكم موظفاً سعودياً مناسباً ونعرّفكم به قبل تاريخ البدء.'),
        ('Work runs under a signed scope, a weekly plan and a timesheet.', 'يسير العمل بنطاق موقّع وخطة أسبوعية وسجل ساعات.'),
        ('A senior Business Partner manager reviews the work every week.', 'يراجع مدير أول من بزنس بارتنر العمل كل أسبوع.'),
        ('You receive a monthly report of hours, deliverables and training.', 'يصلكم تقرير شهري بالساعات والمخرجات والتدريب.'),
        ('If the employee is absent for more than [[REPLACEMENT_DAYS]] days or leaves, we provide a replacement.', 'إن غاب الموظف أكثر من [[أيام الاستبدال]] أيام أو غادر، نوفّر بديلاً.')])
    s += sub('Forms of engagement', 'صيغ التعاقد')
    s += card('Part-time', 'Fixed weekly hours with one company.', 'دوام جزئي', 'ساعات أسبوعية ثابتة لدى شركة واحدة.')
    s += card('Flexible', 'Hours as needed between an agreed minimum and maximum, registered through the Ministry of Human Resources "Marn" platform where applicable.', 'عمل مرن', 'ساعات بحسب الحاجة بين حد أدنى وأقصى متفق عليهما، ويُوثَّق عبر منصة «مرن» التابعة لوزارة الموارد البشرية حيثما انطبق.')
    s += card('Remote', 'Tasks delivered without attendance (for example accounting, marketing, purchasing).', 'عن بُعد', 'مهام تُسلَّم دون حضور (مثل المحاسبة والتسويق والمشتريات).')
    s += card('By project', 'Defined scope, deliverables and duration, with milestone payments.', 'بالمشروع', 'نطاق ومخرجات ومدة محددة، بدفعات حسب المعالم.')
    pg(s + '</div>')
    # 5 scope (2/2)
    s = hd2() + '<div class="bp">'
    s += sub('What the price includes', 'ما يشمله السعر')
    s += num_table('Included', 'المشمول', [
        ('A Saudi employee with a real contract, registered social insurance and medical insurance.', 'موظف سعودي بعقد حقيقي وتأمينات اجتماعية وتأمين طبي مسجّلين.'),
        ('Management, weekly supervision and performance review.', 'الإدارة والإشراف الأسبوعي وتقييم الأداء.'),
        ('Mandatory training and professional development for every employee.', 'التدريب والتطوير المهني الإلزاميان لكل موظف.'),
        ('Timesheets, monthly reporting and replacement cover.', 'سجل الساعات والتقارير الشهرية وتغطية الاستبدال.')])
    s += sub('Employment structure', 'هيكل التوظيف')
    s += p('The Saudi employee holds a genuine part-time or flexible employment contract, registered with the authorities and social insurance in accordance with the structure confirmed before signature. Business Partner manages the employee, develops them and invoices the service. The final structure is confirmed in writing before the Service Agreement is signed.',
           'يحمل الموظف السعودي عقد عمل جزئياً أو مرناً حقيقياً، مسجّلاً لدى الجهات المختصة والتأمينات الاجتماعية وفق الهيكل المؤكَّد قبل التوقيع. تدير بزنس بارتنر الموظف وتطوّره وتفوتر الخدمة. ويُؤكَّد الهيكل النهائي كتابةً قبل توقيع عقد الخدمة.')
    s += sub('Integrity and compliance', 'النزاهة والامتثال')
    s += num_table('Integrity and compliance', 'النزاهة والامتثال', [
        ('Every assignment is real work with a client deliverable, a timesheet and a signed scope. No employee is registered without actual work.', 'كل إسناد عمل فعلي بمخرج للعميل وسجل ساعات ونطاق موقّع. ولا يُسجَّل موظف بلا عمل فعلي.'),
        ('Work and training records are kept for each employee and can be shown to the competent authorities.', 'تُحفظ سجلات العمل والتدريب لكل موظف ويمكن عرضها على الجهات المختصة.'),
        ('How an assignment is counted in the Nitaqat programme depends on the employment structure registered for each employee. Business Partner makes no commitment to any Nitaqat result or band, and none that one employee counts for more than one entity.', 'يتبع احتساب الإسناد في برنامج نطاقات الهيكل المسجَّل لكل موظف. ولا تلتزم بزنس بارتنر بأي نتيجة أو نطاق في نطاقات، ولا بأن يُحتسب موظف واحد لأكثر من منشأة.'),
        ('Both parties sign a non-disclosure agreement before any employee or company information is shared.', 'يوقّع الطرفان اتفاقية عدم إفصاح قبل تبادل أي معلومات عن الموظفين أو الشركات.')])
    pg(s + '</div>')
    # 6 client requirements + exclusions
    s = hd2() + '<div class="bp">'
    s += h2(3, 'Client Requirements', 'المتطلبات من العميل')
    s += num_table('Client Requirements', 'المتطلبات من العميل', [
        ('Define the tasks and the scope of each assignment.', 'تحديد المهام ونطاق كل إسناد.'),
        ('Provide access, tools and a safe working environment.', 'توفير الصلاحيات والأدوات وبيئة عمل آمنة.'),
        ('Approve timesheets on time.', 'اعتماد سجل الساعات في وقته.'),
        ('Copy our email business@businesspartner.sa (CC) on its correspondence about the assignment.', 'إضافة بريدنا business@businesspartner.sa في خانة النسخة (CC) في مراسلاته الخاصة بالإسناد.')])
    s += h2(4, 'Exclusions', 'ما لا يشمله العرض')
    s += num_table('Not included', 'غير مشمول', [
        ('VAT.', 'ضريبة القيمة المضافة.'),
        ('Performance-linked pay, which is agreed separately.', 'الأجر المرتبط بالأداء، ويُتفق عليه منفصلاً.'),
        ('Field travel.', 'التنقل الميداني.'),
        ('Your own tools, licences and systems.', 'أدواتكم وتراخيصكم وأنظمتكم.')])
    pg(s + '</div>')
    # 7 term, payment, terms
    s = hd2() + '<div class="bp">'
    s += h2(5, 'Term', 'المدة')
    s += p('The term is [[TERM_MONTHS]] months. Flexible engagements through Marn follow the term limits that the platform allows.', 'مدة العقد [[عدد الأشهر]] شهراً. وتلتزم عقود المرن بحدود المدة التي تتيحها المنصة.')
    s += h2(6, 'Payment', 'طريقة الدفع')
    s += pair_table(('Item', 'Method', 'الطريقة', 'البند'), [
        ('Invoicing', 'Monthly, [[PAYMENT_TERMS]]', 'شهرية، [[شروط الدفع]]', 'الفوترة'),
        ('Early termination', '[[EARLY_TERMINATION]], notice [[NOTICE_DAYS]] days', '[[الإنهاء المبكر]]، إشعار [[أيام الإشعار]] يوماً', 'الإنهاء المبكر'),
        ('Payment method', 'Bank transfer to the account shown on the last page', 'تحويل بنكي على الحساب المبيّن في الصفحة الأخيرة', 'وسيلة السداد')])
    s += h2(7, 'Terms & Conditions', 'الشروط والأحكام')
    s += num_table('Terms & Conditions', 'الشروط والأحكام', [
        ('All prices exclude VAT of 15%.', 'جميع الأسعار قبل ضريبة القيمة المضافة 15%.'),
        ('The services and fees are governed by a separate Service Agreement, and information is shared only under the non-disclosure agreement.', 'تخضع الخدمات والأتعاب لعقد خدمة مستقل، ولا تُتبادل المعلومات إلا بموجب اتفاقية عدم الإفصاح.'),
        ('The employment structure is confirmed in writing before the Service Agreement is signed.', 'يُؤكَّد هيكل التوظيف كتابةً قبل توقيع عقد الخدمة.'),
        ('Next steps: sign the non-disclosure agreement; confirm roles, hours and start date; sign the Service Agreement and the assignment schedule; the employee starts on the agreed date.', 'الخطوات التالية: توقيع اتفاقية عدم الإفصاح؛ تأكيد الوظائف والساعات وتاريخ البدء؛ توقيع عقد الخدمة وملحق الإسناد؛ ثم يبدأ الموظف في التاريخ المتفق عليه.')])
    pg(s + '</div>')
    # 8 signatures
    pg(hd2() + '<div class="bp">' + h2(8, 'Signatures', 'التوقيعان') + p('By signing below, both parties accept this quotation and its terms and conditions.', 'بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه وأحكامه.') + sig_block() + '</div>')
    # 9 closing cover (template page; bank details and mobile stay [●] in repository files)
    pg(template_page(7, title_swap=False))
    return S


def main():
    pr = G.prices()
    html = ('<!doctype html><html><head><meta charset="utf-8"><title>Quotation: Shared National Talent</title><style>' + fonts() + css() + '</style></head><body>'
            + ''.join(build_pages(pr)) + '</body></html>')
    h = os.path.join(WORK, '01-Proposal-A4-Landscape.html')
    open(h, 'w', encoding='utf8').write(html)
    pdf = os.path.join(OUT, '01-Proposal-A4-Landscape-Bilingual-FOR-REVIEW.pdf')
    subprocess.run([CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file://' + h], check=True, capture_output=True, timeout=180)
    print('built', pdf)


if __name__ == '__main__':
    main()
