# -*- coding: utf-8 -*-
"""Contract and NDA in the permanent Business Partner standard (owner decision 2026-10-29):
A4 portrait, one row per clause with English on the left and Arabic on the right, official letterhead, two signature boxes.
Pagination is measured in Chromium (row heights) and then packed into fixed A4 sheets, like the reference artifact.
Usage: python3 gen_nst_docs.py [WORKDIR]"""
import os, re, json, subprocess, html
import gen_nst as G
import gen_nst_a4 as A
import nst_content as C

HERE, WORK, OUT, CHROME = G.HERE, G.WORK, G.OUT, G.CHROME
ph = G.ph
AVAIL = 880          # px of content per sheet: 1123 - 30 top - 102 letterhead - ~110 footer
EXTRA = ("@page{size:794px 1123px;margin:0}body{margin:0;background:#fff}.sheet{break-after:page;page-break-after:always}"
         "mark.ph{background:#EEF1FB;color:#1E3A9E;border-bottom:1.5px solid #1E3A9E;padding:0 2px;border-radius:2px;font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace}"
         ".it{margin:0;padding:0}.dnote{direction:ltr}.dnote div{font-size:10.4px;line-height:1.55}.dnote .ar{direction:rtl;text-align:right;margin-top:3px}")


def ph2(s):
    return ph(s).replace('\n', '<br>')


def clause_rows(blocks, skip_first_p):
    """blocks from nst_content -> list of ('cl', en_html, ar_html) | ('card', en, ar) | ('wide', html) | ('sig', blocks)."""
    items, cur = [], None
    seen_head = False
    skip_next_p = False
    for b in blocks:
        k = b[0]
        if k in ('title', 'sub'):
            continue
        if k == 'note':
            items.append(('card', b[1], b[2]))
            continue
        if k == 'sig':
            if cur: items.append(cur); cur = None
            items.append(('sig', b[1]))
            continue
        if k == 'table':
            if cur: items.append(cur); cur = None
            items.append(('wide', mirror_table(b[1], b[2])))
            continue
        if k == 'h':
            en = b[1]
            if cur: items.append(cur); cur = None
            if en.startswith(('BETWEEN', 'And;', 'IN WITNESS')):
                skip_next_p = en.startswith(('BETWEEN', 'And;'))
                continue
            seen_head = True
            skip_next_p = False
            if en.isupper() or re.match(r'^\d+\.\s+[A-Z ,&-]+$', en):
                en = re.sub(r'^(\d+\.\s+)(.*)$', lambda m: m.group(1) + m.group(2).title(), en)
            cur = ['cl', f'<b>{ph(en)}</b>', f'<b>{ph(b[2])}</b>']
            continue
        if k == 'p':
            if not seen_head and skip_first_p:
                continue
            if skip_next_p:
                skip_next_p = False
                continue
            if cur is None:
                cur = ['cl', ph(b[1]), ph(b[2])]
            else:
                cur[1] += '<br>' + ph(b[1])
                cur[2] += '<br>' + ph(b[2])
    if cur: items.append(cur)
    return [tuple(i) if isinstance(i, list) else i for i in items]


def mirror_table(head, rows):
    """head = [(en, ar), ...] (first = label column); rows = [((en, ar), [values])] -> mirrored EN-left / AR-right table."""
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


def schedule_table(pr_rows):
    return pr_rows


def parties(extra_first=''):
    def party(title_en, title_ar, fixed):
        rows = [('Name', 'الاسم', 'Business Partner Solutions<br><span dir="rtl">شركة بزنس بارتنر سلوشنز</span>' if fixed else '<span class="num">[●]</span>'),
                ('Unified / CR No.', 'الرقم الموحد / السجل التجاري', '<span class="num">7038825860</span>' if fixed else '<span class="num">[●]</span>'),
                ('VAT No.', 'الرقم الضريبي', '<span class="num">312079341500003</span>' if fixed else '<span class="num">[●]</span>'),
                ('National Address', 'العنوان الوطني', '<span class="num">RHSC2978</span>' if fixed else '<span class="num">[●]</span>'),
                ('Represented by', 'يمثلها', '<span class="num">[●]</span>'), ('Title', 'الصفة', '<span class="num">[●]</span>')]
        if fixed and extra_first:
            rows.append(('Licence', 'الترخيص', extra_first))
        elif not fixed and extra_first:
            rows.append(('Authorisation', 'التفويض', '<span class="num">[●]</span>'))
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


def render_item(it):
    k = it[0]
    if k == 'pre':
        return f'<div class="pre"><b>{it[1]}</b></div>'
    if k == 'parties':
        return it[1]
    if k == 'cl':
        return f'<table class="cl"><tr><td class="en">{it[1]}</td><td class="ar">{it[2]}</td></tr></table>'
    if k == 'card':
        return (f'<div class="card dnote"><div><b>{ph(it[1])}</b></div><div class="ar"><b>{ph(it[2])}</b></div></div>')
    if k == 'wide':
        return it[1]
    if k == 'sig':
        return sig()
    return ''


def measure(items, title_ar, title_en, fonts, css):
    body = ''.join(f'<div class="it" id="i{n}">{render_item(it)}</div>' for n, it in enumerate(items))
    page = (f'<!doctype html><html><head><meta charset="utf-8"><style>{fonts}{css}{EXTRA}.m{{width:722px;position:absolute;top:0;left:0}}</style></head><body>'
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
    for it, h in zip(items, heights):
        if cur and used + h > AVAIL:
            pages.append(cur); cur, used = [], 0
        cur.append(it); used += h
    if cur: pages.append(cur)
    return pages


def build_doc(name, title_ar, title_en, items):
    fonts, css = A.fonts(), A.css()
    css = css.replace('@page{size:1123px 794px;margin:0}', '')
    heights = measure(items, title_ar, title_en, fonts, css)
    pages = paginate(items, heights)
    n = len(pages)
    hd = (f'<div class="hd" dir="ltr">{A.LOGO}<div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">{title_ar}</h1>'
          f'<div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">{title_en}</div></div></div>')
    secs = ''
    for i, pg in enumerate(pages, 1):
        # consecutive clause rows share one table, like the reference
        inner, buf = '', ''
        for it in pg:
            if it[0] == 'cl':
                buf += f'<tr><td class="en">{it[1]}</td><td class="ar">{it[2]}</td></tr>'
            else:
                if buf: inner += f'<table class="cl">{buf}</table>'; buf = ''
                inner += render_item(it)
        if buf: inner += f'<table class="cl">{buf}</table>'
        secs += f'<section class="sheet port" lang="ar"><div dir="rtl">{hd}{inner}</div>{A.FT % i}</section>'.replace(f'/ {A.TOTAL}', f'/ {n}')
    doc = f'<!doctype html><html><head><meta charset="utf-8"><title>{title_en}</title><style>{fonts}{css}{EXTRA}</style></head><body>{secs}</body></html>'
    h = os.path.join(WORK, name + '.html')
    open(h, 'w', encoding='utf8').write(doc)
    pdf = os.path.join(OUT, name + '.pdf')
    subprocess.run([CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file://' + h], check=True, capture_output=True, timeout=180)
    print('built', name, n, 'pages')


def main():
    pr = G.prices()
    lic = '<mark class="ph">[LICENSE_DESCRIPTION: attach the licence and confirm its scope]</mark><br><span dir="rtl"><mark class="ph">[وصف الترخيص: يُرفق الترخيص ويُتحقق من نطاقه]</mark></span>'

    def assemble(rows, party_html):
        lead = [r for r in rows[:1] if r[0] == 'card']
        rest = rows[len(lead):]
        return lead + [('pre', 'الأطراف / Parties'), ('parties', party_html)] + rest + [('sig',)]
    nda = [r for r in clause_rows(C.nda(), skip_first_p=False) if r[0] not in ('sig', 'card')]
    build_doc('02-NDA-Bilingual-FOR-REVIEW', 'اتفاقية عدم إفصاح متبادلة', 'Mutual Non-Disclosure Agreement', assemble(nda, parties()))
    ct = [r for r in clause_rows(C.contract(pr), skip_first_p=True) if r[0] != 'sig']
    build_doc('03-Service-Agreement-INTERNAL-DRAFT-Bilingual', 'عقد إسناد الكوادر الوطنية المشتركة', 'Shared National Talent Service Assignment Agreement', assemble(ct, parties(lic)))


if __name__ == '__main__':
    main()
