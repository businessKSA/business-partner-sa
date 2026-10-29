# -*- coding: utf-8 -*-
"""Contract (and NDA) in the approved Business Partner templates (docs/sales/templates/): A4 portrait, cover, one row per clause
with English on the left and Arabic on the right, official letterhead, two signature boxes, closing page.
- NDA: the single mutual NDA for all services, taken from the template as is (only fonts are embedded).
- Contract: this service's clauses in the template's structure; generic clauses (subcontractors, liability, governing law, general)
  are the template's own wording.
Pagination is measured in Chromium and packed into fixed A4 sheets.  Usage: python3 gen_nst_docs.py [WORKDIR]"""
import os, re, json, subprocess
import gen_nst as G
import gen_nst_a4 as A
import nst_content as C
import nst_tpl as T

HERE, WORK, OUT, CHROME = G.HERE, G.WORK, G.OUT, G.CHROME
ph = G.ph
AVAIL = 880
EXTRA = ("@page{size:794px 1123px;margin:0}body{margin:0;background:#fff}.sheet{break-after:page;page-break-after:always}"
         "mark.ph{background:#EEF1FB;color:#1E3A9E;border-bottom:1.5px solid #1E3A9E;padding:0 2px;border-radius:2px;font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace}"
         ".it{margin:0;padding:0}.dnote{direction:ltr}.dnote div{font-size:10.4px;line-height:1.55}.dnote .ar{direction:rtl;text-align:right;margin-top:3px}")


def css():
    return T.css(T.CONTRACT) + EXTRA


def mirror_table(head, rows):
    n = len(rows[0][1])
    side = (100 - 28 - 2) / (2 * n)
    cg = '<col style="width:14%">' + f'<col style="width:{side}%">' * n + '<col style="width:2%">' + f'<col style="width:{side}%">' * n + '<col style="width:14%">'
    t = f'<table class="pt"><colgroup>{cg}</colgroup><tr><th class="en">{head[0][0]}</th>'
    t += ''.join(f'<th class="c en">{h[0]}</th>' for h in head[1:]) + '<td class="gp"></td>'
    t += ''.join(f'<th class="c ar">{h[1]}</th>' for h in reversed(head[1:])) + f'<th class="ar">{head[0][1]}</th></tr>'
    for (le, la), vals in rows:
        t += f'<tr><td class="en">{ph(le)}</td>' + ''.join(f'<td class="c en"><span class="num">{ph(v)}</span></td>' for v in vals) + '<td class="gp"></td>'
        t += ''.join(f'<td class="c ar"><span class="num">{ph(v)}</span></td>' for v in reversed(vals)) + f'<td class="ar">{ph(la)}</td></tr>'
    return t + '</table>'


def parties(licence):
    def party(title_en, title_ar, fixed):
        rows = [('Name', 'الاسم', 'Business Partner Solutions<br><span dir="rtl">شركة بزنس بارتنر سلوشنز</span>' if fixed else '<span class="num">[●]</span>'),
                ('Unified / CR No.', 'الرقم الموحد / السجل التجاري', '<span class="num">7038825860</span>' if fixed else '<span class="num">[●]</span>'),
                ('VAT No.', 'الرقم الضريبي', '<span class="num">312079341500003</span>' if fixed else '<span class="num">[●]</span>'),
                ('National Address', 'العنوان الوطني', '<span class="num">RDAA9214</span>' if fixed else '<span class="num">[●]</span>'),
                ('Represented by', 'يمثلها', '<span class="num">[●]</span>'), ('Title', 'الصفة', '<span class="num">[●]</span>')]
        rows.append(('Licence', 'الترخيص', licence) if fixed else ('Authorisation', 'التفويض', '<span class="num">[●]</span>'))
        t = f'<table class="pty2"><tr><th colspan="3"><span>{title_en}</span><span dir="rtl">{title_ar}</span></th></tr>'
        for e, a, v in rows:
            t += f'<tr><td>{e}</td><td class="v">{v}</td><td>{a}</td></tr>'
        return t + '</table>'
    return party('First Party (Service Provider)', 'الطرف الأول (مزوّد الخدمة)', True) + party('Second Party (Client)', 'الطرف الثاني (العميل)', False)


def sig():
    def one(en, ar):
        rows = ''.join(f'<div class="f2"><span>{e}</span><span class="v"><span class="num">[●]</span></span><span dir="rtl">{a}</span></div>'
                       for e, a in (('Name', 'الاسم'), ('Title', 'الصفة'), ('Date', 'التاريخ')))
        return (f'<div><h3><span>{en}</span><span dir="rtl">{ar}</span></h3>{rows}'
                '<div class="bx2"><div style="text-align:center">Signature &amp; Stamp · التوقيع والختم</div></div></div>')
    return '<div class="sg" style="direction:ltr">' + one('First Party', 'الطرف الأول') + one('Second Party', 'الطرف الثاني') + '</div>'


def card(en, ar):
    return f'<div class="card dnote"><div><b>{ph(en)}</b></div><div class="ar"><b>{ph(ar)}</b></div></div>'


def contract_clauses(pr):
    """Clauses of this service as [(en title, ar title, [(en text, ar text)])] unnumbered, then template clauses."""
    blocks = C.contract(pr)
    clauses, cur, sched = [], None, []
    in_sched = False
    for b in blocks:
        k = b[0]
        if k in ('title', 'sub', 'note', 'sig'):
            continue
        if k == 'p' and cur is None and not clauses:
            continue                       # preamble sentence is replaced by the parties tables
        if k == 'h':
            if b[1].startswith('Schedule'):
                in_sched = True
                sched.append(('h', b[1], b[2]))
                continue
            cur = (re.sub(r'^\d+\.\s*', '', b[1]), re.sub(r'^\d+\.\s*', '', b[2]), [])
            clauses.append(cur)
            continue
        if in_sched:
            sched.append(b)
            continue
        if k == 'p':
            cur[2].append((re.sub(r'^\d+\.\d+\s+', '', b[1]), re.sub(r'^\d+-\d+\s+', '', b[2])))
    return clauses, sched


def clause_item(n, en_t, ar_t, paras):
    en, ar = f'<b>{n}. {ph(en_t)}</b>', f'<b>{n}. {ph(ar_t)}</b>'
    for i, (e, a) in enumerate(paras, 1):
        pre_e, pre_a = (f'{n}.{i} ', f'{n}-{i} ') if len(paras) > 1 else ('', '')
        en += '<br>' + pre_e + ph(e)
        ar += '<br>' + pre_a + ph(a)
    return ('cl', en, ar)


def template_item(n, key, tail_en='', tail_ar=''):
    (te, he), (ta, ha) = T.clause_rows(T.CONTRACT)[key]
    return ('cl', f'<b>{n}. {te}</b><br>{he}{tail_en}', f'<b>{n}. {ta}</b><br>{ha}{tail_ar}')


def contract_items(pr):
    clauses, sched = contract_clauses(pr)
    items = [('pre', 'الأطراف / Parties'), ('html', parties('<mark class="ph">[LICENSE_DESCRIPTION: attach the licence and confirm its scope]</mark><br><span dir="rtl"><mark class="ph">[وصف الترخيص: يُرفق الترخيص ويُتحقق من نطاقه]</mark></span>'))]
    n = 2
    # this service's clauses up to "Term and termination"; "Liability" and "General" come from the template
    keep = [c for c in clauses if not c[0].startswith(('Liability', 'General'))]
    work = [c for c in clauses if c[0].startswith('General')]
    for c in keep:
        items.append(clause_item(n, *c)); n += 1
    items.append(template_item(n, 'Subcontractors')); n += 1
    for c in work:
        items.append(clause_item(n, 'Work product and leave', 'ملكية العمل والإجازات', [work[0][2][0]])); n += 1
        break
    items.append(template_item(n, 'Liability', ' <mark class="ph">[Subject to final legal review]</mark>', ' <mark class="ph">[بانتظار المراجعة القانونية النهائية]</mark>')); n += 1
    items.append(template_item(n, 'Governing Law & Disputes')); n += 1
    items.append(template_item(n, 'General')); n += 1
    # schedules (this service): heading rows, tables, reserved text
    for b in sched:
        if b[0] == 'h':
            items.append(('cl', f'<b>{ph(b[1])}</b>', f'<b>{ph(b[2])}</b>'))
        elif b[0] == 'table':
            items.append(('html', mirror_table(b[1], b[2])))
        elif b[0] == 'p':
            items.append(('cl', ph(b[1]), ph(b[2])))
    items.append(('sig',))
    return items


def render_item(it):
    k = it[0]
    if k == 'pre':
        return f'<div class="pre"><b>{it[1]}</b></div>'
    if k == 'html':
        return it[1]
    if k == 'cl':
        return f'<table class="cl"><tr><td class="en">{it[1]}</td><td class="ar">{it[2]}</td></tr></table>'
    if k == 'sig':
        return sig()
    return ''


def measure(items, fonts, cssx):
    body = ''.join(f'<div class="it" id="i{n}">{render_item(it)}</div>' for n, it in enumerate(items))
    page = (f'<!doctype html><html><head><meta charset="utf-8"><style>{fonts}{cssx}.m{{width:722px;position:absolute;top:0;left:0}}</style></head><body>'
            f'<div class="m" dir="rtl">{body}</div><pre id="out"></pre><script>document.fonts.ready.then(function(){{var r=[];'
            f'document.querySelectorAll(".it").forEach(function(e){{r.push(Math.ceil(e.getBoundingClientRect().height))}});'
            f'document.getElementById("out").textContent="H"+JSON.stringify(r)+"E"}});</script></body></html>')
    f = os.path.join(WORK, 'measure.html')
    open(f, 'w', encoding='utf8').write(page)
    out = subprocess.run([CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', 'file://' + f],
                         capture_output=True, timeout=120).stdout.decode('utf8', 'replace')
    m = re.search(r'H(\[[0-9,]+\])E', out)
    if not m:
        raise SystemExit('measurement failed')
    return json.loads(m.group(1))


def paginate(items, heights):
    pages, cur, used = [], [], 0
    for k, (it, h) in enumerate(zip(items, heights)):
        # a schedule heading stays with the table that follows it
        need = h + (heights[k + 1] if it[0] == 'cl' and it[1].startswith('<b>Schedule') and k + 1 < len(items) else 0)
        if cur and used + need > AVAIL:
            pages.append(cur); cur, used = [], 0
        cur.append(it); used += h
    if cur: pages.append(cur)
    return pages


def cover(title_en, title_ar, kicker_en, kicker_ar, sub_en, sub_ar):
    return (f'<div dir="ltr"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div><div class="cvb"><div dir="ltr">'
            f'<div class="eb">{kicker_en}</div><h1 class="pf">{title_en}</h1><div class="sb">{sub_en}</div></div><div dir="rtl">'
            f'<div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">{kicker_ar}</div><h1>{title_ar}</h1><div class="sb">{sub_ar}</div></div></div>'
            '<div class="ch"><div><span>Parties / الأطراف</span>Business Partner Solutions<br><span class="num">[●]</span></div>'
            '<div><span>Date / التاريخ</span><span class="num">[●]</span></div><div><span>Ref / المرجع</span><span class="num">[●]</span></div></div></div></div>')


def sections(items, title_ar, title_en, cover_html, fonts, cssx):
    """Fixed A4 sheets (cover, measured content pages, closing page) as HTML strings."""
    heights = measure(items, fonts, cssx)
    pages = paginate(items, heights)
    n = len(pages) + 2
    hd = (f'<div class="hd" dir="ltr">{A.LOGO}<div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">{title_ar}</h1>'
          f'<div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">{title_en}</div></div></div>')
    ft = lambda i: (A.FT % i).replace(f'/ {A.TOTAL}', f'/ {n}')
    out = [f'<section class="sheet port" lang="ar">{cover_html}{ft(1)}</section>']
    for i, pg in enumerate(pages, 2):
        inner, buf = '', ''
        for it in pg:
            if it[0] == 'cl':
                buf += f'<tr><td class="en">{it[1]}</td><td class="ar">{it[2]}</td></tr>'
            else:
                if buf: inner += f'<table class="cl">{buf}</table>'; buf = ''
                inner += render_item(it)
        if buf: inner += f'<table class="cl">{buf}</table>'
        out.append(f'<section class="sheet port" lang="ar"><div dir="rtl">{hd}{inner}</div>{ft(i)}</section>')
    closing = T.inner(T.sheets(T.CONTRACT)[-1])
    out.append(f'<section class="sheet port" lang="ar">{closing}{ft(n)}</section>')
    return out


def build_doc(name, title_ar, title_en, items, cover_html):
    fonts, cssx = A.fonts(), css()
    secs = sections(items, title_ar, title_en, cover_html, fonts, cssx)
    doc = f'<!doctype html><html><head><meta charset="utf-8"><title>{title_en}</title><style>{fonts}{cssx}</style></head><body>{"".join(secs)}</body></html>'
    return doc, len(secs)


def contract_cover():
    return cover('Shared National Talent Service Assignment Agreement', 'عقد إسناد الكوادر الوطنية المشتركة', 'SERVICE AGREEMENT', 'عقد خدمة',
                 'Saudi professionals assigned part-time or flexibly, managed and developed by Business Partner.',
                 'كوادر سعودية تُسند بدوام جزئي أو مرن، تديرها وتطوّرها Business Partner.')


def print_pdf(name, doc):
    h = os.path.join(WORK, name + '.html')
    open(h, 'w', encoding='utf8').write(doc)
    pdf = os.path.join(OUT, name + '.pdf')
    subprocess.run([CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file://' + h], check=True, capture_output=True, timeout=180)


def build_nda():
    """The single mutual NDA of the approved template, unchanged; fonts embedded."""
    raw = T.read(T.NDA)
    body = raw[raw.index('</style>') + len('</style>'):]          # starts with </head><body>
    doc = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Mutual Non-Disclosure Agreement</title><style>'
           + A.fonts() + T.css(T.NDA) + '@page{size:794px 1123px;margin:0}</style>' + body)
    print_pdf('02-NDA-Bilingual-FOR-REVIEW', doc)
    print('built NDA from template')


def main():
    pr = G.prices()
    build_nda()
    items = contract_items(pr)
    doc, n = build_doc('03-Service-Agreement-INTERNAL-DRAFT-Bilingual', 'عقد إسناد الكوادر الوطنية المشتركة', 'Shared National Talent Service Assignment Agreement', items, contract_cover())
    print_pdf('03-Service-Agreement-INTERNAL-DRAFT-Bilingual', doc)
    print('built contract', n, 'pages')


if __name__ == '__main__':
    main()
