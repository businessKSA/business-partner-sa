# -*- coding: utf-8 -*-
"""Builds the Shared National Talent package (proposal, NDA, internal contract draft) as PDFs.
Usage: python3 gen_nst.py [WORKDIR]   (WORKDIR holds fonts, recalculated workbook, html; default ./_work)
Prices are read from Shared-National-Talent-Pricing-INTERNAL.xlsx (recalculated by LibreOffice), never typed here."""
import os, sys, re, html, base64, subprocess, shutil, urllib.request
import openpyxl
import nst_content as C

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, '_work')
OUT = os.path.join(HERE, '..', 'national-shared-talent-out')
os.makedirs(WORK, exist_ok=True); os.makedirs(OUT, exist_ok=True)
CHROME = next(p for p in ('/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium') if os.path.exists(p))
FONTS = {'ar400': 'ibmplexsansarabic/v15/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6bs6.ttf',
         'ar600': 'ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPi-NCT.ttf'}
NAVY, INK, MUTE, LINE, PALE = '#0B1B5A', '#1B2340', '#6A7596', '#DDE1EE', '#F7F8FD'


def font_css():
    css = ''
    for k, u in FONTS.items():
        f = os.path.join(WORK, k + '.ttf')
        if not os.path.exists(f):
            urllib.request.urlretrieve('https://fonts.gstatic.com/s/' + u, f)
        w = 400 if k.endswith('400') else 600
        css += "@font-face{font-family:'PlexAr';font-weight:%d;src:url(data:font/ttf;base64,%s)}" % (w, base64.b64encode(open(f, 'rb').read()).decode())
    return css


def logo_uri():
    from PIL import Image
    im = Image.open(os.path.join(HERE, '..', '..', '..', '..', 'site', 'assets', 'img', 'logo.png')); im.thumbnail((700, 200))
    f = os.path.join(WORK, 'logo.png'); im.save(f)
    return 'data:image/png;base64,' + base64.b64encode(open(f, 'rb').read()).decode()


def prices():
    src = os.path.join(HERE, 'Shared-National-Talent-Pricing-INTERNAL.xlsx')
    rc = os.path.join(WORK, 'recalc'); os.makedirs(rc, exist_ok=True)
    subprocess.run(['soffice', '--headless', '--convert-to', 'xlsx', '--outdir', rc, src], check=True, capture_output=True)
    wb = openpyxl.load_workbook(os.path.join(rc, os.path.basename(src)), data_only=True)
    r, h = wb['Rate card'], wb['Hour packages']
    out = {}
    for i in range(9):
        name = r.cell(12 + i, 1).value
        out[name] = dict(rate=r.cell(12 + i, 13).value, p20=h.cell(4 + i, 3).value, p40=h.cell(4 + i, 4).value,
                         p80=h.cell(4 + i, 5).value, p120=h.cell(4 + i, 6).value, full=h.cell(4 + i, 7).value)
    return out


esc = lambda s: html.escape(s, quote=False)
PH = re.compile(r'\[\[(.+?)\]\]')


def ph(s):
    return PH.sub(lambda m: '<span class="ph">[%s]</span>' % m.group(1), esc(s))


def cell(en, ar, mode):
    if mode == 'en': return '<span class="e">%s</span>' % ph(en)
    if mode == 'ar': return '<span class="a">%s</span>' % ph(ar)
    return '<span class="e">%s</span><br><span class="a">%s</span>' % (ph(en), ph(ar))


def block(b, mode):
    k = b[0]
    if k in ('title', 'sub', 'h', 'p', 'li', 'note', 'meta'):
        en, ar = b[1], b[2]
        if mode == 'bi':
            return '<div class="row %s"><div class="e">%s</div><div class="a">%s</div></div>' % (k, ph(en), ph(ar))
        return '<div class="row %s one %s"><div class="%s">%s</div></div>' % (k, mode, 'e' if mode == 'en' else 'a', ph(en if mode == 'en' else ar))
    if k == 'table':
        head, rows = b[1], b[2]
        t = '<table><tr>' + ''.join('<th>%s</th>' % cell(e, a, mode) for e, a in head) + '</tr>'
        for (re_, ra), vals in rows:
            t += '<tr><td class="rl">%s</td>' % cell(re_, ra, mode) + ''.join('<td class="n">%s</td>' % ph(v) for v in vals) + '</tr>'
        return t + '</table>'
    if k == 'sig':
        cols = ''
        for ne, na, pe, pa in b[1]:
            cols += '<div class="sg"><div class="who">%s</div><div class="who2">%s</div><div class="ln"></div><div class="pl">%s</div></div>' % (
                cell(ne, na, mode), cell(pe, pa, mode),
                cell('Signature / Date', 'التوقيع / التاريخ', mode))
        return '<div class="sigs">%s</div>' % cols
    return ''


def page(title, blocks, mode, draft_label, logo, fonts):
    ar = mode == 'ar'
    body = ''.join(block(b, mode) for b in blocks)
    wm = '<div class="wm">%s</div>' % esc(draft_label) if draft_label else ''
    return f"""<!doctype html><html lang="{'ar' if ar else 'en'}" dir="{'rtl' if ar else 'ltr'}"><head><meta charset="utf-8"><title>{esc(title)}</title><style>{fonts}
@page{{size:A4;margin:12mm 15mm 12mm}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:'PlexAr','Inter','DejaVu Sans',sans-serif;color:{INK};font-size:11.5px;line-height:1.55}}
.hd{{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid {NAVY};padding:0 0 6px;margin-bottom:8px;direction:ltr}}
.hd img{{height:30px}} .hd span{{font-size:10px;color:{MUTE};letter-spacing:.05em}}
.ft{{font-size:9px;color:{MUTE};border-top:1px solid {LINE};padding-top:5px;margin-top:6px;direction:ltr;text-align:center}}
table.w,table.w>thead>tr>td,table.w>tbody>tr>td,table.w>tfoot>tr>td{{border:0;padding:0;background:none;display:revert}}
table.w{{margin:0;break-inside:auto}}
.wm{{position:fixed;top:42%;left:0;right:0;text-align:center;font-size:62px;font-weight:600;color:rgba(11,27,90,.07);transform:rotate(-28deg);z-index:-1;direction:ltr}}
.row{{display:grid;grid-template-columns:1fr 1fr;column-gap:26px;padding:3px 0;break-inside:avoid}}
.row.one{{display:block}}
.e{{direction:ltr;text-align:left;color:#3A4466}} .a{{direction:rtl;text-align:right}}
.row.one.en .e{{color:{INK}}}
.title .e{{font-size:30px;font-weight:600;color:{NAVY};line-height:1.15}} .title .a{{font-size:32px;font-weight:600;color:{NAVY};line-height:1.2}}
.sub{{margin-bottom:8px}} .sub .e,.sub .a{{font-size:14px;color:{MUTE}}}
.meta .e,.meta .a{{font-size:10.5px;color:{MUTE}}}
.h{{margin-top:12px;border-top:1.5px solid {LINE};padding-top:8px;break-after:avoid}} .h .e,.h .a{{font-size:14px;font-weight:600;color:{NAVY}}}
.li .e::before{{content:'• '}} .li .a::before{{content:'• '}}
.note{{background:{PALE};border:1px solid {LINE};border-radius:6px;padding:6px 10px;margin:6px 0}} .note .e,.note .a{{font-size:10.5px;color:{MUTE}}}
.ph{{background:#E8EDFF;border-radius:3px;padding:0 3px;color:{NAVY};font-weight:600}}
table{{width:100%;border-collapse:collapse;margin:6px 0;break-inside:avoid}}
th{{background:{NAVY};color:#fff;font-weight:600;font-size:10px;padding:5px 6px;text-align:center}} th .e,th .a{{color:#fff;font-size:10px}}
td{{border-bottom:1px solid {LINE};padding:5px 6px;font-size:11px}} td.n{{text-align:center;direction:ltr}} td.rl .e,td.rl .a{{font-size:11px}}
tr:nth-child(even) td{{background:{PALE}}}
.sigs{{display:grid;grid-template-columns:1fr 1fr;column-gap:30px;margin-top:14px;break-inside:avoid}}
.sg .who{{font-weight:600}} .sg .ln{{border-bottom:1.5px solid {NAVY};height:34px}} .sg .pl{{font-size:9.5px;color:{MUTE};margin-top:3px}} .sg .who2{{font-size:10.5px;color:{MUTE}}}
</style></head><body>
{wm}<table class="w"><thead><tr><td><div class="hd"><img src="{logo}"><span>Business Partner Solutions · {esc(title)}</span></div></td></tr></thead>
<tfoot><tr><td><div class="ft">Business Partner Solutions Company · 7038825860 · VAT 312079341500003</div></td></tr></tfoot>
<tbody><tr><td>{body}</td></tr></tbody></table></body></html>"""


def build(name, blocks, draft_label=None, title=None):
    logo, fonts = logo_uri(), font_css()
    for mode, suf in (('ar', 'AR'), ('en', 'EN'), ('bi', 'Bilingual')):
        label = draft_label
        fn = f'{name}-{suf}' + ('-TO-SIGN' if suf == 'Bilingual' and not draft_label else '')
        h = os.path.join(WORK, fn + '.html')
        open(h, 'w', encoding='utf8').write(page(title or name, blocks, mode, label, logo, fonts))
        pdf = os.path.join(OUT, fn + '.pdf')
        subprocess.run([CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file://' + h],
                       check=True, capture_output=True, timeout=180)
        print('built', fn)


if __name__ == '__main__':
    pr = prices()
    build('02-NDA', C.nda(), draft_label='DRAFT', title='Shared National Talent — NDA')
    build('03-Service-Agreement-INTERNAL-DRAFT', C.contract(pr), draft_label='INTERNAL DRAFT — NOT FINAL', title='Shared National Talent — Service Agreement (internal draft)')
