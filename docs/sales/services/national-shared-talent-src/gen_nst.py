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


def slides_html(slides, mode, logo, fonts):
    ar = mode == 'ar'
    t = lambda p: ph(p[1] if ar else p[0])
    cls = 'a' if ar else 'e'
    out = []
    total = len(slides)
    for i, (kind, title, p) in enumerate(slides, 1):
        if kind == 'cover':
            inner = (f'<div class="cv"><div class="cvt">{t(title)}</div><div class="cvs">{t(p["sub"])}</div><div class="cvm">{t(p["meta"])}</div>'
                     f'<div class="nt">{t(p["note"])}</div></div>')
        else:
            if kind == 'text':
                body = f'<div class="lead">{t(p["lead"])}</div><div class="para">{t(p["body"])}</div>'
            elif kind in ('cards', 'steps'):
                cards = ''
                for j, (h, d) in enumerate(p, 1):
                    num = f'<div class="num">{j}</div>' if kind == 'steps' else ''
                    cards += f'<div class="card">{num}<div class="ch">{t(h)}</div><div class="cd">{t(d)}</div></div>'
                body = f'<div class="grid4">{cards}</div>'
            elif kind == 'table':
                tb = '<table class="tb"><tr>' + ''.join(f'<th>{t(h)}</th>' for h in p['head']) + '</tr>'
                for r, vals in p['rows']:
                    tb += f'<tr><td class="rl">{t(r)}</td>' + ''.join(f'<td>{v}</td>' for v in vals) + '</tr>'
                body = tb + f'</table><div class="foot">{t(p["note"])}</div>'
            elif kind == 'terms':
                tr = ''.join(f'<div class="tr"><b>{t(a)}</b><span>{t(b)}</span></div>' for a, b in p['terms'])
                st = ''.join(f'<div class="st"><i>{k}</i>{ph(s[1] if ar else s[0])}</div>' for k, s in enumerate(p['steps'], 1))
                body = f'<div class="two"><div>{tr}</div><div>{st}</div></div>'
            elif kind == 'accept':
                sg = ''.join(f'<div class="sg"><div class="sn">{t((a, b))}</div><div class="sp">{t((c, d))}</div><div class="sl"></div><div class="sc">{t(("Signature / Date", "التوقيع / التاريخ"))}</div></div>'
                             for a, b, c, d in p['sigs'])
                body = f'<div class="sigs">{sg}</div><div class="foot">{t(p["note"])}</div>'
            else:
                body = ''
            inner = f'<div class="ttl">{t(title)}</div>{body}'
        out.append(f'<section class="slide {cls}"><div class="bar"><img src="{logo}"><span>{i} / {total}</span></div>{inner}'
                   f'<div class="ft">Business Partner Solutions · 7038825860 · VAT 312079341500003 · DRAFT</div></section>')
    return out


SLIDE_CSS = f"""
@page{{size:1920px 1080px;margin:0}}
*{{box-sizing:border-box}} body{{margin:0;font-family:'PlexAr','Inter','DejaVu Sans',sans-serif;color:{INK}}}
.slide{{width:1920px;height:1080px;padding:56px 100px 50px;background:{PALE};position:relative;page-break-after:always;overflow:hidden}}
.slide.a{{direction:rtl;text-align:right}} .slide.e{{direction:ltr;text-align:left}}
.bar{{display:flex;justify-content:space-between;align-items:center;direction:ltr;height:60px;border-bottom:3px solid {NAVY}}}
.bar img{{height:46px}} .bar span{{font-size:22px;color:{MUTE}}}
.ft{{position:absolute;bottom:26px;left:100px;right:100px;font-size:18px;color:{MUTE};direction:ltr;text-align:center}}
.ttl{{font-size:60px;font-weight:600;color:{NAVY};margin:46px 0 34px;line-height:1.2}}
.lead{{font-size:64px;font-weight:600;color:{NAVY};line-height:1.35;margin-bottom:30px}} .para{{font-size:42px;line-height:1.75;color:#3A4466}}
.grid4{{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}}
.card{{background:#fff;border:2px solid {LINE};border-radius:18px;padding:30px 28px;min-height:560px}}
.ch{{font-size:40px;font-weight:600;color:{NAVY};margin-bottom:14px;line-height:1.3}} .cd{{font-size:31px;line-height:1.6;color:#3A4466}}
.num{{width:58px;height:58px;border-radius:50%;background:{NAVY};color:#fff;font-size:30px;font-weight:600;display:flex;align-items:center;justify-content:center;margin-bottom:18px}}
.tb{{width:100%;border-collapse:collapse;font-size:30px;direction:ltr}}
.tb th{{background:{NAVY};color:#fff;padding:14px 12px;font-size:25px;font-weight:600}} .tb td{{padding:13px 12px;text-align:center;border-bottom:2px solid {LINE};background:#fff}}
.tb td.rl{{text-align:start;font-weight:600;color:{NAVY}}} .slide.a .tb td.rl{{text-align:right;direction:rtl}}
.foot{{font-size:24px;color:{MUTE};margin-top:20px;line-height:1.5}}
.cv{{margin-top:130px}} .cvt{{font-size:104px;font-weight:600;color:{NAVY};line-height:1.15}} .cvs{{font-size:40px;color:#3A4466;margin:30px 0;max-width:1400px;line-height:1.5}}
.cvm{{font-size:28px;color:{MUTE};margin-top:60px}} .nt{{display:inline-block;margin-top:34px;background:#fff;border:2px solid {LINE};border-radius:12px;padding:14px 24px;font-size:26px;color:{MUTE}}}
.two{{display:grid;grid-template-columns:1.2fr 1fr;gap:60px}} .tr{{padding:24px 0;border-bottom:2px solid {LINE};font-size:33px;line-height:1.5}} .tr b{{display:block;color:{NAVY};font-size:32px}}
.st{{background:#fff;border:2px solid {LINE};border-radius:14px;padding:26px 24px;margin-bottom:22px;font-size:33px;display:flex;gap:18px;align-items:center}}
.st i{{font-style:normal;width:46px;height:46px;flex:none;border-radius:50%;background:{NAVY};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600}}
.sigs{{display:grid;grid-template-columns:1fr 1fr;gap:100px;margin-top:70px}} .sn{{font-size:36px;font-weight:600;color:{NAVY}}} .sp{{font-size:26px;color:{MUTE}}}
.sl{{border-bottom:3px solid {NAVY};height:90px}} .sc{{font-size:22px;color:{MUTE};margin-top:8px}}
.ph{{background:#E8EDFF;border-radius:4px;padding:0 6px;color:{NAVY};font-weight:600}}
"""


def build_slides(name, slides):
    logo, fonts = logo_uri(), font_css()
    parts = {m: slides_html(slides, m, logo, fonts) for m in ('ar', 'en')}
    decks = {'AR': parts['ar'], 'EN': parts['en'], 'Bilingual': parts['ar'] + parts['en']}
    for suf, secs in decks.items():
        fn = f'{name}-{suf}' + ('-TO-SIGN' if suf == 'Bilingual' else '')
        h = os.path.join(WORK, fn + '.html')
        open(h, 'w', encoding='utf8').write(f'<!doctype html><html><head><meta charset="utf-8"><title>{fn}</title><style>{fonts}{SLIDE_CSS}</style></head><body>{"".join(secs)}</body></html>')
        pdf = os.path.join(OUT, fn + '.pdf')
        subprocess.run([CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file://' + h],
                       check=True, capture_output=True, timeout=180)
        print('built', fn)


if __name__ == '__main__':
    pr = prices()
    build('01-Proposal', C.proposal(pr), draft_label='DRAFT', title='Shared National Talent — Proposal')
    build_slides('01-Proposal-Landscape', C.proposal_slides(pr))
    build('02-NDA', C.nda(), draft_label='DRAFT', title='Shared National Talent — NDA')
    build('03-Service-Agreement-INTERNAL-DRAFT', C.contract(pr), draft_label='INTERNAL DRAFT — NOT FINAL', title='Shared National Talent — Service Agreement (internal draft)')
