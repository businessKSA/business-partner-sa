# -*- coding: utf-8 -*-
"""حزمة REV (تطوير الأعمال كخدمة) لخمسة عملاء — بناء من القوالب المعتمدة.
الاستعمال:  BP_OUT=<مجلد خارج المستودع> python3 build_rev_batch.py [--only key] [--keep-dots]
 - عرض السعر (أفقي): من templates/REV-quote-template-bilingual.html — مبسط (5 صفحات) ومفصل.
 - العقد وعدم الإفصاح والتفويض (عمودي): عبر src/rev_build.py ومحتوى REV-*-content.py.
 - كل [●] متبقٍّ يصير حقل تعبئة PDF (AcroForm). الآيبان/البنك من BP_IBAN وBP_BANK إن وُجدا، وإلا «مبيّن في الفاتورة الضريبية».
 - لا بيانات اتصال للعملاء هنا. المخرجات خارج المستودع."""
import json, os, re, subprocess, sys, shutil, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
SALES = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(SALES, 'business-development-service', 'src')
TPL = os.path.join(SALES, 'templates')
ISR = os.path.join(SALES, 'cases', '2026-11-02-isr-workforce')
OUT = os.environ.get('BP_OUT') or sys.exit('BP_OUT مطلوب (خارج المستودع)')
DATE_EN, DATE_AR = '5 November 2026', '5 نوفمبر 2026'
PHONE = '0530540231'
IBAN, BANK = os.environ.get('BP_IBAN'), os.environ.get('BP_BANK')
OWNER_EN, OWNER_AR = 'Baher Bakr Ali Magnas', 'باهر بكر علي مقنص'
SIGNER_EN, SIGNER_AR = 'Badr · بدر', None
TITLE_EN, TITLE_AR = 'Sales &amp; Business Development Manager', 'مدير المبيعات وتطوير الأعمال'
FLD_CSS = '.fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}.cv .fld{border-bottom-color:#9DB4FF}.fld.w{min-width:150px}.fld.s{min-width:46px}'
NODE_ENV = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())

CLIENTS = json.load(open(os.path.join(HERE, 'clients.json'), encoding='utf-8'))


def load(path):
    spec = importlib.util.spec_from_file_location('m', path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


# ---------------------------------------------------------------- القواعد المشتركة
def bank_sub(h):
    if IBAN and BANK:
        return h.replace('[IBAN]', IBAN).replace('Bank / البنك: [●]', 'Bank / البنك: ' + BANK)
    h = h.replace("Payment is by bank transfer to the First Party’s account at [●], IBAN [IBAN].", 'Payment is by bank transfer to the First Party’s bank account stated on the tax invoice.')
    h = h.replace('السداد بتحويل بنكي إلى حساب الطرف الأول لدى [●]، آيبان [IBAN].', 'السداد بتحويل بنكي إلى حساب الطرف الأول البنكي المبيّن في الفاتورة الضريبية.')
    h = h.replace('Bank transfer to the account shown on the last page', 'Bank transfer to the account stated on the tax invoice')
    h = h.replace('تحويل بنكي على الحساب المبيّن في الصفحة الأخيرة', 'تحويل بنكي على الحساب المبيّن في الفاتورة الضريبية')
    h = re.sub(r'Bank / البنك: \[●\]<br>IBAN: <span class="num">\[●\]</span>',
               'Bank details / بيانات الحساب: stated on the tax invoice · مبيّنة في الفاتورة الضريبية', h)
    return h


def strip_brackets(h):
    h = re.sub(r'\[(or of 60 days[^\]]*)\]', r'\1', h)
    h = re.sub(r'\[(أو من مرور[^\]]*)\]', r'\1', h)
    h = re.sub(r'\[(\d+)\]', r'\1', h)
    return h


def fields(h, tag):
    k = [0]
    def rep(m):
        k[0] += 1; return '<span class="fld" data-f="%s_f%d"></span>' % (tag, k[0])
    h2 = re.sub(r'\[●\]', rep, h)
    return h2.replace('</style>', FLD_CSS + '</style>', 1), k[0]


def renumber_h2(h):
    c = [0]
    def rep(m):
        c[0] += 1; return '<h2><span class="n">%d</span>' % c[0]
    return re.sub(r'<h2><span class="n">\d+</span>', rep, h)


def page_numbers(h):
    secs = re.split(r'(?=<section class="sheet)', h)
    head, body = secs[0], secs[1:]
    n = len(body)
    out = [head]
    for i, s in enumerate(body, 1):
        out.append(re.sub(r'(<span class="m">)\d+ / \d+(</span>)', r'\g<1>%d / %d\2' % (i, n), s))
    return ''.join(out)


def known_names(c):
    if not c.get('name_ar'):
        return None
    return c['name_en'], c['name_ar']


# ---------------------------------------------------------------- عرض السعر
def cmp_sheet(hd, ft, tag):
    f = '<span class="fld s"></span>'
    def row(en, ar, a, b, ca='c', cb='c'):
        return '<tr><td class="en">%s</td><td class="%s">%s</td><td class="%s">%s</td><td class="ar">%s</td></tr>' % (en, ca, a, cb, b, ar)
    N = lambda x: '<span class="num">%s</span>' % x
    rows = ''.join([
        row('Fee model', 'نموذج المقابل', 'Fixed monthly fee<br>+ success fee on closed deals<br><span dir="rtl">رسم شهري ثابت + نسبة نجاح</span>', 'Commission on closed deals<br><span dir="rtl">عمولة على الصفقات المغلقة</span>'),
        row('Monthly fee (SAR, excl. VAT)', 'الرسم الشهري (ريال، قبل الضريبة)', N('2,500'), '[●]'),
        row('Deal value up to 1,000,000 (SAR)', 'قيمة الصفقة حتى 1,000,000 (ريال)', N('10%') + ' · ' + N('12.5%') + '<br><span class="note">with our participation in closing · بمشاركتنا في الإغلاق</span>', '[●] %'),
        row('Above 1,000,000 up to 5,000,000 (SAR)', 'أكثر من 1,000,000 حتى 5,000,000 (ريال)', N('5%') + ' · ' + N('7.5%'), '[●] %'),
        row('Above 5,000,000 (SAR)', 'أكثر من 5,000,000 (ريال)', N('2.5%') + ' · ' + N('5%'), '[●] %'),
        row('Committed monthly minimum: qualified leads, vendor registrations, meetings', 'الحد الأدنى الشهري الملتزم به: فرص مؤهلة وتسجيلات مورد واجتماعات', N('4') + ' · ' + N('4') + ' · ' + N('4'), '[●]'),
        row('Fee due date', 'موعد استحقاق النسبة', 'Within 14 days of the first payment received under the deal<br><span dir="rtl">خلال 14 يوماً من أول دفعة تُستلم عن الصفقة</span>', '[●]'),
    ])
    body = ('<div class="bp"><div class="rw "><div class="col" dir="ltr"><h2><span class="n">2</span>Fixed fee vs. commission: comparison</h2></div><div class="col" dir="rtl"><h2><span class="n">2</span>المقابل الثابت مقابل العمولة: مقارنة</h2></div></div>'
            '<div class="rw "><div class="col" dir="ltr"><p>Option A is the fixed package with its success fee, as in this quotation. Option B is a commission-only alternative for comparison; its rates are agreed in writing and entered in the blank fields before signing.</p></div>'
            '<div class="col" dir="rtl"><p>الخيار أ هو الباقة بمقابلها الثابت ونسبة نجاحها كما في هذا العرض. والخيار ب بديل بالعمولة وحدها للمقارنة، وتُتفق نسبه كتابةً وتُدوَّن في الخانات الفارغة قبل التوقيع.‏</p></div></div>'
            '<table class="pt"><colgroup><col style="width:27%"><col style="width:23%"><col style="width:23%"><col style="width:27%"></colgroup>'
            '<tr><th class="en">Item</th><th class="c">Option A · الخيار أ<br><span class="num">REV-LAUNCH</span> Launch · الانطلاق</th><th class="c">Option B · الخيار ب<br>Commission only · بالعمولة وحدها</th><th class="ar">البند</th></tr>%s</table>'
            '<div class="rw "><div class="col" dir="ltr"><p class="note">Prices and rates are before tax; 15% VAT is added. Government fees, if any, are separate. The success fee remains due after the contract ends on delivered leads.</p></div>'
            '<div class="col" dir="rtl"><p class="note">الأسعار والنسب قبل الضريبة وتُضاف ضريبة القيمة المضافة 15%. الرسوم الحكومية، إن وجدت، منفصلة. وتبقى نسبة النجاح مستحقة بعد انتهاء العقد عن الفرص المسلَّمة.‏</p></div></div></div>') % rows
    return '<section class="sheet land" lang="ar"><div dir="rtl">%s%s</div>%s</section>' % (hd, body, ft)


def drop_cols(sec, k):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(sec, 'html.parser')
    for t in soup.select('table.pt'):
        rows = t.find_all('tr')
        if not rows: continue
        c0 = rows[0].find_all(['td', 'th'], recursive=False)
        if len(c0) != 9 or 'gp' not in (c0[4].get('class') or []): continue
        keep = {0, 8, 1 + k, 4, 7 - k}
        for tr in rows:
            cs = tr.find_all(['td', 'th'], recursive=False)
            if len(cs) == 9:
                for i, c in enumerate(cs):
                    if i not in keep: c.decompose()
        cg = t.find('colgroup')
        if cg:
            cg.clear()
            for w in (30, 18, 4, 18, 30):
                col = soup.new_tag('col'); col['style'] = 'width:%d%%' % w; cg.append(col)
    return str(soup)


def build_quote(c, detailed):
    s = open(os.path.join(TPL, 'REV-quote-template-bilingual.html'), encoding='utf-8').read()
    parts = re.split(r'(?=<section class="sheet)', s)
    head, secs = parts[0], parts[1:]
    cover, services, price, scope, req, terms, sign, closing = secs
    hd = re.search(r'<div class="hd2">.*?(?=<div class="bp">)', price, re.S).group(0)
    ft = re.search(r'<div class="ft">.*</div></section>', price, re.S).group(0)[:-len('</section>')]
    pk = {'LAUNCH': 0, 'GROWTH': 1, 'PRO': 2}.get(c.get('pkg'))
    if pk is not None:
        names = [('REV-LAUNCH', 'Launch', 'الانطلاق'), ('REV-GROWTH', 'Growth', 'النمو'), ('REV-PRO', 'Pro', 'الاحترافية')][pk]
        cover = re.sub(r'<div class="pk" dir="ltr">.*?</div>', '<div class="pk" dir="ltr">%s %s</div>' % (names[0], names[1]), cover)
        cover = re.sub(r'(<div class="pk" dir="rtl"[^>]*>).*?</div>', r'\g<1>%s %s</div>' % (names[0], names[2]), cover)
        price, scope = drop_cols(price, pk), drop_cols(scope, pk)
    sheets = [cover]
    if detailed: sheets.append(services)
    sheets.append(price)
    if c.get('commission'): sheets.append(cmp_sheet(hd, ft, c['key']))
    if detailed or not c.get('commission'): sheets.append(scope)
    if detailed: sheets.append(req)
    sheets += [terms, sign]
    if detailed: sheets.append(closing)
    h = head + ''.join(sheets)
    # الأسماء والتواريخ
    kn = known_names(c)
    en, ar = (kn if kn else ('[●]', '[●]'))
    h = h.replace('<b>To:</b> <span class="num">[●]</span>', '<b>To:</b> <span class="num">%s</span>' % en)
    h = h.replace('<b>إلى السادة:</b> <span class="num">[●]</span>', '<b>إلى السادة:</b> <span class="num">%s</span>' % ar)
    h = h.replace('<span>To / إلى السادة</span><span class="num">[●]</span>', '<span>To / إلى السادة</span>%s' % ('<span class="num">%s</span><br><span dir="rtl">%s</span>' % (en, ar) if kn else '<span class="num">[●]</span>'))
    h = h.replace('<b>Date:</b> <span class="num">[●]</span>', '<b>Date:</b> <span class="num">%s</span>' % DATE_EN)
    h = h.replace('<b>التاريخ:</b> <span class="num">[●]</span>', '<b>التاريخ:</b> <span class="num">%s</span>' % DATE_AR)
    h = h.replace('<span>Date / التاريخ</span><span class="num">[●]</span>', '<span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span>' % (DATE_EN, DATE_AR))
    h = h.replace('<div class="c">[●]<br>', '<div class="c">%s<br>' % PHONE).replace('Mobile / الجوال: <span class="num">[●]</span>', 'Mobile / الجوال: <span class="num">%s</span>' % PHONE)
    # التوقيع: اسمنا (بدر) وصفته وتاريخ الإرسال؛ والعميل حقول
    i = h.find('<div class="sg"')
    sg = h[i:]
    for val in (SIGNER_EN, TITLE_EN + ' · ' + TITLE_AR, DATE_EN + ' · ' + DATE_AR):
        sg = sg.replace('<span class="num">[●]</span>', '<span class="num">%s</span>' % val, 1)
    if kn:
        sg = sg.replace('<span class="v cn"><span class="num">[●]</span>', '<span class="v cn"><span class="num">%s · %s</span>' % (en, ar), 1) if False else sg
    h = h[:i] + sg
    h = bank_sub(h)
    h = renumber_h2(page_numbers(h))
    return h


# ---------------------------------------------------------------- العقد/NDA/التفويض (من rev_build)
def build_bases():
    sys.path.insert(0, SRC)
    import rev_build as rb
    base = os.path.join(OUT, '_base'); os.makedirs(base, exist_ok=True)
    rb.OUT = base
    for kind in ('contract', 'nda', 'authz'):
        rb.build(kind)
    sys.path.pop(0)
    return {'contract': os.path.join(base, 'REV-contract-bilingual.html'), 'nda': os.path.join(base, 'REV-nda-mutual-bilingual.html'),
            'authz': os.path.join(base, 'REV-authorization-letter.html')}


def portrait(c, kind, base_path):
    h = open(base_path, encoding='utf-8').read()
    h = h.replace('Dr. Baher Magnas · د. باهر مقنص', '%s · %s' % (OWNER_EN, OWNER_AR))
    if kind == 'authz':
        cm = load(os.path.join(SRC, 'REV-authz-content.py')); cv = cm.COVER
        h = h.replace('SERVICE AGREEMENT', cv['eb_en'], 1).replace('عقد خدمة</div>', cv['eb_ar'] + '</div>', 1)
        h = h.replace('Business Development Service Agreement', cv['t_en'])
        h = h.replace('عقد خدمة تطوير الأعمال', cv['t_ar'])
        h = h.replace('Sales leads and referrals and help registering as a vendor with companies.', cv['s_en'])
        h = h.replace('خدمة تزويدك بفرص بيع وإحالات ومساعدتك في التسجيل كمورد لدى الشركات.', cv['s_ar'])
    kn = known_names(c)
    en, ar = (kn if kn else ('[●]', '[●]'))
    ref = c['ref']
    h = h.replace('<span>Parties / الأطراف</span>Business Partner Solutions<br><span class="num">[●]</span>',
                  '<span>Parties / الأطراف</span>Business Partner Solutions<br>%s' % ('<span class="num">%s</span><br><span dir="rtl">%s</span>' % (en, ar) if kn else '<span class="num">[●]</span>'))
    h = h.replace('<span>Date / التاريخ</span><span class="num">[●]</span>', '<span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span>' % (DATE_EN, DATE_AR))
    h = h.replace('<span>Ref / المرجع</span><span class="num">[●]</span>', '<span>Ref / المرجع</span><span class="num">%s</span>' % ref)
    if kn:
        h = h.replace('<tr><td>Name</td><td class="v"><span class="num">[●]</span></td><td>الاسم</td></tr>',
                      '<tr><td>Name</td><td class="v">%s<br><span dir="rtl">%s</span></td><td>الاسم</td></tr>' % (en, ar), 1)
    # علامة الباقة المختارة
    if kind == 'contract' and c.get('pkg'):
        idx = {'LAUNCH': 0, 'GROWTH': 1, 'PRO': 2}[c['pkg']]
        m = re.search(r'(<td class="c">)☐(</td>)(<td class="c">)☐(</td>)(<td class="c">)☐(</td>)', h)
        if m:
            cells = ['☐', '☐', '☐']; cells[idx] = '☑'
            h = h[:m.start()] + ''.join('<td class="c">%s</td>' % x for x in cells) + h[m.end():]
    # التوقيع: تاريخ الطرف الأول
    i = h.find('<div class="sg"')
    if i >= 0:
        sg = h[i:]
        sg = sg.replace('<span class="v">[●]</span>', '<span class="v">%s · %s</span>' % (DATE_EN, DATE_AR), 1)
        h = h[:i] + sg
    h = bank_sub(strip_brackets(h))
    return h


# ---------------------------------------------------------------- الإخراج
def render(html_path, pdf_path):
    subprocess.run(['node', os.path.join(ISR, 'render_fld.cjs'), html_path, pdf_path], check=True, env=NODE_ENV)
    sys.path.insert(0, os.path.join(SALES, 'cases', '2026-10-28-paint-factory-gr', 'v2'))
    import fillable
    n = fillable.add_fields(pdf_path)
    sys.path.pop(0)
    return n


def write(path, h, tag, keep_dots):
    n = 0
    if not keep_dots: h, n = fields(h, tag)
    open(path, 'w', encoding='utf-8').write(h)
    return n


def main():
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    keep = '--keep-dots' in sys.argv
    bases = build_bases()
    docs = [('01-Quotation-Simple', 'quote_s'), ('01B-Quotation-Detailed', 'quote_d'), ('02-Agreement', 'contract'), ('03-NDA', 'nda'), ('04-Authorization', 'authz')]
    for c in CLIENTS:
        if only and c['key'] != only: continue
        d = os.path.join(OUT, c['key']); os.makedirs(os.path.join(d, 'html'), exist_ok=True)
        for name, kind in docs:
            if kind == 'quote_s': h = build_quote(c, False)
            elif kind == 'quote_d': h = build_quote(c, True)
            else: h = portrait(c, kind, bases[kind])
            hp = os.path.join(d, 'html', name + '.html'); pp = os.path.join(d, name + '.pdf')
            n = write(hp, h, name.split('-')[0] + c['key'][:3], keep)
            f = render(hp, pp) if not keep else 0
            print(c['key'], name, 'fields', n, f)


if __name__ == '__main__':
    main()
