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
FLD_CSS = '.fld{display:inline-block;min-width:92px;height:14px;border-bottom:1px solid #8A93B5;vertical-align:-2px}.cv .fld{border-bottom-color:#9DB4FF}.fld.w{min-width:150px}.fld.s{min-width:46px}.pt.cmp td,.pt.cmp th{padding:7px 8px;font-size:12px;line-height:1.5}.pt.cmp th{font-size:12px}.pt.cmp .num{font-size:12.6px}.pt.cmp .note{font-size:11.2px}.pt.cmp .ln{min-width:70px!important;height:16px!important}.pt.cmp td.rec{background:#EEF3FF;font-weight:700}.pt.cmp th.rec .note{color:#fff!important;font-weight:600}.pt.cmp th.rec{background:#2F4BE0!important;color:#fff!important}'
NODE_ENV = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())

sys.path.insert(0, HERE)
import lib_fields
import base64
LOGO64 = base64.b64encode(open(os.path.join(TPL, 'assets', 'business-partner-logo-clean.png'), 'rb').read()).decode()
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
    h2, n = lib_fields.fieldify(h, tag)
    return h2.replace('</style>', FLD_CSS + '</style>', 1), n


def renumber_h2(h):
    c = [0]
    def rep(m):
        c[0] += 1; return '<h2><span class="n">%d</span>' % ((c[0] + 1) // 2)
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
    # صفحة الباقات كلها بخيار واحد: REV-LAUNCH مقترحنا (قرار المالك 2026-11-05) — الإنجليزي يسار والعربي يمين بمرآة دقيقة
    N = lambda x: '<span class="num">%s</span>' % x
    def row(en, ar, v_en, v_ar=None):
        v_ar = v_ar or v_en
        cells_en = ''.join('<td class="c%s">%s</td>' % (' rec' if i == 0 else '', x) for i, x in enumerate(v_en))
        cells_ar = ''.join('<td class="c%s">%s</td>' % (' rec' if i == 0 else '', x) for i, x in enumerate(v_ar))
        return '<tr><td class="en">%s</td>%s<td class="gp"></td>%s<td class="ar">%s</td></tr>' % (en, cells_en, cells_ar[::1] if False else ''.join(reversed(re.findall(r'<td class="c[^>]*>.*?</td>', cells_ar))), ar)
    rows = ''.join([
        row('Monthly fee (SAR, excl. VAT)', 'الرسم الشهري (ريال، قبل الضريبة)', [N('2,500'), N('5,000'), N('9,500')]),
        row('Advance: 3 months (SAR, excl. VAT)', 'الدفعة المقدمة: 3 أشهر (ريال، قبل الضريبة)', [N('7,500'), N('15,000'), N('28,500')]),
        row('Target project size (SAR)', 'حجم المشاريع المستهدفة (ريال)', ['Up to 500,000', '1,000,000 to 5,000,000', '5,000,000 to 10,000,000'], ['حتى 500,000', 'من 1,000,000 إلى 5,000,000', 'من 5,000,000 إلى 10,000,000']),
        row('Qualified leads / month (committed minimum)', 'فرص مؤهلة شهرياً (حد أدنى ملتزم به)', [N('4'), N('8'), N('16')]),
        row('Vendor registrations / month (committed minimum)', 'تسجيلات مورد شهرياً (حد أدنى ملتزم به)', [N('4'), N('8'), N('16')]),
        row('Meetings / month', 'اجتماعات شهرياً', [N('4'), N('8'), N('16')]),
        row('Success fee on closed deals', 'نسبة النجاح على الصفقات المغلقة', ['As on page 1', 'As on page 1', 'As on page 1'], ['كما في الصفحة الأولى'] * 3),
    ])
    pk = lambda a, b: '<th class="c%s">%s<br><span class="num">%s</span></th>'
    th_en = ''.join('<th class="c%s"><span class="num">%s</span><br>%s%s</th>' % (' rec' if i == 0 else '', n, e, '<br><span class="note">Our proposal</span>' if i == 0 else '') for i, (n, e, a) in enumerate([('REV-LAUNCH', 'Launch', ''), ('REV-GROWTH', 'Growth', ''), ('REV-PRO', 'Pro', '')]))
    th_ar = ''.join('<th class="c%s"><span class="num">%s</span><br>%s%s</th>' % (' rec' if i == 0 else '', n, a, '<br><span class="note">مقترحنا</span>' if i == 0 else '') for i, (n, e, a) in enumerate([('REV-LAUNCH', 'Launch', 'الانطلاق'), ('REV-GROWTH', 'Growth', 'النمو'), ('REV-PRO', 'Pro', 'الاحترافية')]))
    th_ar = ''.join(reversed(re.findall(r'<th class="c[^>]*>.*?</th>', th_ar)))
    body = ('<div class="bp"><div class="rw "><div class="col" dir="ltr"><h2><span class="n">2</span>Our packages: one option, proposed for you</h2></div><div class="col" dir="rtl"><h2><span class="n">2</span>باقاتنا: خيار واحد نقترحه عليكم</h2></div></div>'
            '<div class="rw "><div class="col" dir="ltr"><p>For your information, these are all our business development packages. Our proposal for you is <b>REV-LAUNCH Launch at SAR 2,500 per month</b>, the quotation on the previous page; you may move to a higher package at any time.</p></div>'
            '<div class="col" dir="rtl"><p>للاطلاع، هذه كل باقات تطوير الأعمال لدينا. ومقترحنا لكم <b>باقة REV-LAUNCH الانطلاق بمبلغ 2,500 ريال شهرياً</b>، وهي المبيّنة في الصفحة السابقة، ويمكنكم الانتقال إلى باقة أعلى في أي وقت.\u200f</p></div></div>'
            '<table class="pt cmp"><colgroup><col style="width:19%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:2%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:19%"></colgroup>'
            '<tr><th class="en">Item</th>' + th_en + '<th class="gp"></th>' + th_ar + '<th class="ar">البند</th></tr>@@ROWS@@</table>'
            '<div class="rw "><div class="col" dir="ltr"><p class="note">Prices and rates are before tax; 15% VAT is added. Government fees, if any, are separate. The success fee remains due after the contract ends on delivered leads.</p></div>'
            '<div class="col" dir="rtl"><p class="note">الأسعار والنسب قبل الضريبة وتُضاف ضريبة القيمة المضافة 15%. الرسوم الحكومية، إن وجدت، منفصلة. وتبقى نسبة النجاح مستحقة بعد انتهاء العقد عن الفرص المسلَّمة.\u200f</p></div></div></div>').replace('@@ROWS@@', rows)
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
    h = h.replace('<b>To:</b> <span class="num">[●]</span>', '<b>To:</b> %s' % en)
    h = h.replace('<b>إلى السادة:</b> <span class="num">[●]</span>', '<b>إلى السادة:</b> %s' % ar)
    h = h.replace('<span>To / إلى السادة</span><span class="num">[●]</span>', '<span>To / إلى السادة</span>%s' % ('%s<br><span dir="rtl">%s</span>' % (en, ar) if kn else '<span class="num">[●]</span>'))
    h = h.replace('<b>Date:</b> <span class="num">[●]</span>', '<b>Date:</b> %s' % DATE_EN)
    h = h.replace('<b>التاريخ:</b> <span class="num">[●]</span>', '<b>التاريخ:</b> %s' % DATE_AR)
    h = h.replace('<span>Date / التاريخ</span><span class="num">[●]</span>', '<span>Date / التاريخ</span>%s<br><span dir="rtl">%s</span>' % (DATE_EN, DATE_AR))
    h = re.sub(r'<div class="c">\[●\]<br\s*/?>', '<div class="c">%s<br>' % PHONE, h)
    h = h.replace('url(assets/business-partner-logo-clean.png)', 'url(data:image/png;base64,%s)' % LOGO64).replace('Mobile / الجوال: <span class="num">[●]</span>', 'Mobile / الجوال: <span class="num">%s</span>' % PHONE)
    # التوقيع: اسمنا (بدر) وصفته وتاريخ الإرسال؛ والعميل حقول
    i = h.find('<div class="sg"')
    sg = h[i:]
    for val in (SIGNER_EN, TITLE_EN + ' · ' + TITLE_AR, DATE_EN + ' · ' + DATE_AR):
        sg = sg.replace('<span class="num">[●]</span>', '<span>%s</span>' % val, 1)
    if kn:
        sg = sg.replace('<span class="v cn"><span class="num">[●]</span></span>', '<span class="v cn">%s · %s</span>' % (en, ar), 1)
    h = h[:i] + sg
    h = bank_sub(h)
    h = renumber_h2(page_numbers(h))
    return h


# ---------------------------------------------------------------- العقد/NDA/التفويض (من rev_build)
def build_bases():
    sys.path.insert(0, SRC)
    import rev_build as rb
    base = os.path.join(OUT, '_base'); os.makedirs(base, exist_ok=True)
    rb.TMP = os.path.join(OUT, '_tmp'); os.makedirs(rb.TMP, exist_ok=True)
    rb.OUT = base; os.environ['REV_OUTDIR'] = base
    for kind in ('contract', 'nda', 'authz'):
        rb.build(kind)
    sys.path.pop(0)
    return {'contract': os.path.join(base, 'REV-contract-bilingual.html'), 'nda': os.path.join(base, 'REV-nda-mutual-bilingual.html'),
            'authz': os.path.join(base, 'REV-authorization.html')}


def portrait(c, kind, base_path):
    h = open(base_path, encoding='utf-8').read()
    h = h.replace('Dr. Baher Magnas · د. باهر مقنص', '%s · %s' % (OWNER_EN, OWNER_AR))
    if kind == 'authz':
        for a, b in (('SERVICE AGREEMENT', 'AUTHORIZATION'), ('Business Development Service Agreement', 'Authorization Letter'),
                     ('Sales leads and referrals and help registering as a vendor with companies.', 'The Second Party chooses what it authorizes the First Party to do.'),
                     ('>عقد خدمة<', '>تفويض<'), ('عقد خدمة تطوير الأعمال', 'خطاب تفويض'),
                     ('خدمة تزويدك بفرص بيع وإحالات ومساعدتك في التسجيل كمورد لدى الشركات.', 'يختار الطرف الثاني ما يفوّض به الطرف الأول.')):
            h = h.replace(a, b)
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
            cells = ['—', '—', '—']; cells[idx] = '☑'
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
    os.environ['NODE_PATH'] = NODE_ENV['NODE_PATH']
    lib_fields.render(html_path, pdf_path)
    return 1


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
