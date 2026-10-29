# Re-render the EOR proposal in the Business Development quote standard (A4 landscape, EN left / AR right, aligned rows).
import os, re, html, math, sys
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
BD = sys.argv[1]            # saved HTML of the BD artifact (design standard)
OUTDIR = sys.argv[2]
esc = lambda s: html.escape(s, quote=False)
PHONE = os.environ.get('BP_PHONE', '[●]')   # mobile: placeholder in the repo; real number only in the private final build

# ---- content: final S after gen_prop content + lean_patch (no rendering)
src = open('gen_prop.py', encoding='utf8').read()
head = src.split('# ---------- rendering ----------')[0]
g = {}
exec(head.replace("os.makedirs(OUT, exist_ok=True)", "pass"), g)
exec(open('lean_patch.py', encoding='utf8').read(), g)
S = g['S']
ORDER = ['cover', 'scope', 'roles', 'models', 'model1', 'calc', 'model2', 'gov', 'local', 'saudi', 'payment', 'accept', 'bank']
S.sort(key=lambda x: ORDER.index(x['key']))
by = {s['key']: s for s in S}
CE, CA = g['CLIENT_EN'], g['CLIENT_AR']

# ---- design CSS from the standard
h = open(BD, encoding='utf8').read()
css = next(b for b in re.findall(r'<style>(.*?)</style>', h, re.S) if '.sheet.land' in b)
css = css.split('body{background:var(--bg);color:var(--fg)}')[0]
EXTRA = '''
.gr{display:grid;border:1px solid #DDE1EE;border-top:0;background:#fff;font-size:10.2px;line-height:1.45}
.gr>div{padding:3px 7px;border-inline-start:1px solid #DDE1EE;min-width:0}.gr>div:first-child{border-inline-start:0}
.gr.hh{background:#0B1B5A;color:#fff;font-weight:700;border-color:#0B1B5A}.gr.hh>div{border-color:#13246E}
.gr.z{background:#F7F8FD}.gr .b{font-weight:700;color:#0B1B5A}.gr.hh .b{color:#fff}
.gr .nm{font-family:'IBM Plex Mono',monospace;direction:ltr;text-align:center;color:#1E3A9E;unicode-bidi:isolate}
.gr.hl{background:#EEF1FB}
.rw.tb{align-items:stretch}.rw.tb>.col{display:block;padding-top:0;padding-bottom:0}
.rw.tb>.col:first-child{padding-left:0}
.ck{display:flex;gap:6px;align-items:baseline;padding:2px 0;border-bottom:1px solid #EEF1FB;font-size:11px}
.ck .bu{flex:none}
.card.dk{background:#0B1B5A;border-color:#0B1B5A;color:#C9D5FF}.card.dk b{color:#fff}
.chb{font-family:'IBM Plex Mono',monospace;color:#1E3A9E}
'''
STYLE = css + EXTRA + '@page{size:1123px 794px;margin:0}.sheet{break-after:page;page-break-after:always}body{background:#fff}'

FOOT = lambda n, N: ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
    f'<div class="c">{PHONE}<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">{n} / {N}</span></div>'
    '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>')
HD = ('<div class="hd2"><span class="logo" role="img" aria-label="Business Partner"></span>'
      '<div class="t e"><h1>Proposal: EOR and Employee Transfer</h1></div>'
      '<div class="t a"><h1>عرض سعر: نظام التعاقد ونقل خدمات الموظفين</h1></div></div>')

def rw(en, ar, cls=''):
    return f'<div class="rw {cls}"><div class="col" dir="ltr">{en}</div><div class="col" dir="rtl">{ar}</div></div>'
def h2(n, t):
    return rw(f'<h2><span class="n">{n}</span>{esc(t[0])}</h2>', f'<h2><span class="n">{n}</span>{esc(t[1])}</h2>')
def note(p):
    return rw(f'<p class="note">{p[0]}</p>', f'<p class="note">{p[1]}</p>') if p and p[0] else ''
def cards(cs, start=1):
    out = ''
    for i, c in enumerate(cs, start):
        k = ' dk' if c['dark'] else ''
        out += rw(f'<div class="card{k}"><b>{i}. {c["t"][0]}</b><br>{c["b"][0]}</div>', f'<div class="card{k}"><b>{i}. {c["t"][1]}</b><br>{c["b"][1]}</div>', 'cd')
    return out
def side(cells, cols, cls, d):
    return f'<div class="gr {cls}" dir="{d}" style="grid-template-columns:{cols}">' + ''.join(cells) + '</div>'
def grid_rows(heads, rows, cols, cell_fmt=None, hl=None):
    """text tables, one aligned row-pair per row. heads/rows items are (en,ar) pairs."""
    out = rw(side([f'<div class="b">{x[0]}</div>' for x in heads], cols, 'hh', 'ltr'),
             side([f'<div class="b">{x[1]}</div>' for x in heads], cols, 'hh', 'rtl'), 'tb')
    for i, r in enumerate(rows):
        z = 'z' if i % 2 else ''
        z += ' hl' if hl and hl(r) else ''
        fm = cell_fmt or (lambda j, c, k: f'<div class="b">{c[k]}</div>' if j == 0 else f'<div>{c[k]}</div>')
        out += rw(side([fm(j, c, 0) for j, c in enumerate(r)], cols, z, 'ltr'),
                  side([fm(j, c, 1) for j, c in enumerate(r)], cols, z, 'rtl'), 'tb')
    return out
def num(v): return f'<div class="nm">{v}</div>'
def mirror(heads, rows, weights, nums=()):
    """BD-style mirrored numeric table: EN label left ... AR label right; numbers repeated."""
    W = ''.join(f'<col style="width:{w}%">' for w in weights) + '<col style="width:2%">' + ''.join(f'<col style="width:{w}%">' for w in reversed(weights))
    n = len(weights)
    def tr(cells_en, cells_ar, th=False):
        t = 'th' if th else 'td'
        e = ''.join(f'<{t} class="{"c " if j else ""}en">{c}</{t}>' for j, c in enumerate(cells_en))
        a = ''.join(f'<{t} class="{"c " if j else ""}ar">{c}</{t}>' for j, c in reversed(list(enumerate(cells_ar))))
        return f'<tr>{e}<td class="gp"></td>{a}</tr>'
    out = tr([x[0] for x in heads], [x[1] for x in heads], True)
    for r in rows:
        en = [c[0] if isinstance(c, tuple) else c for c in r]; ar = [c[1] if isinstance(c, tuple) else c for c in r]
        en = [f'<span class="num">{c}</span>' if j in nums else c for j, c in enumerate(en)]
        ar = [f'<span class="num">{c}</span>' if j in nums else c for j, c in enumerate(ar)]
        out += tr(en, ar)
    return f'<table class="pt"><colgroup>{W}</colgroup>{out}</table>'

PAGES = []
def page(body): PAGES.append(f'<section class="sheet land" lang="ar"><div dir="rtl">{HD}<div class="bp">{body}</div></div>@@FT@@</section>')

# 1 cover
c = by['cover']
cover = f'''<section class="sheet land" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div>
<div class="cvb"><div dir="ltr"><div class="eb">PROPOSAL</div><h1 class="pf">{esc(c['title'][0])}</h1><div class="sb">{esc(c['sub'][0])}</div></div>
<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>{esc(c['title'][1])}</h1><div class="sb">{esc(c['sub'][1])}</div></div></div>
<div class="pk" dir="ltr">Model 1 · Transparent cost · Model 2 · Full employee cost</div><div class="pk" dir="rtl" style="margin-top:6px;letter-spacing:0;font-family:inherit">النموذج 1 · التكلفة بشفافية · النموذج 2 · تكلفة الموظف الكاملة</div>
<div class="ch"><div><span>To / إلى السادة</span><span class="num">{CE} / {CA}</span></div><div><span>Date / التاريخ</span><span class="num">29/10/2026</span></div><div><span>Validity / صلاحية العرض</span>30 days<br>30 يوماً</div></div></div></div>@@FT@@</section>'''
PAGES.append(cover)

n = 0
def N(): 
    global n; n += 1; return n
# 2 scope
s = by['scope']
page(h2(N(), s['title']) + cards(s['cards']) + note(s['note']))
# 3 roles
s = by['roles']
def lst(c):
    return rw(f'<h2 style="font-size:12.5px">{esc(c[0][0])}</h2>', f'<h2 style="font-size:12.5px">{esc(c[0][1])}</h2>') + ''.join(
        rw(f'<div class="ck"><span class="bu">✓</span><span>{a}</span></div>', f'<div class="ck"><span class="bu">✓</span><span>{b}</span></div>') for a, b in c[1])
page(h2(N(), s['title']) + lst(s['left']) + lst(s['right']))
# 4 models
s = by['models']
page(h2(N(), s['title']) + grid_rows(s['head'], s['rows'], '1.1fr 1.7fr 1.4fr') + note(s['note']))
# 5 model 1 stages
s = by['model1']
page(h2(N(), s['title']) + grid_rows(s['heads'], s['rows'], '0.75fr 1.7fr 1.1fr') + note(s['note']))
# 6 calc (model 1 illustration)
s = by['calc']
def vt(v, k):
    p = v.split('|')
    return p[1] if len(p) == 2 and k == 1 else p[0]
rows = [((r[0][0], r[0][1]), (r[1][0], r[1][1]), (vt(r[2], 0), vt(r[2], 1))) for r in s['rows']]
page(h2(N(), s['title']) + rw(f'<p>{s["intro"][0]}</p>', f'<p>{s["intro"][1]}</p>') +
     grid_rows([('Item', 'البند'), ('Basis', 'الأساس'), ('SAR / month', 'ريال شهرياً')], rows, '0.9fr 1.9fr 0.8fr',
               lambda j, c, k: (f'<div class="b">{c[k]}</div>' if j == 0 else (num(c[k]) if j == 2 else f'<div>{c[k]}</div>')),
               hl=lambda r: r[0][0] == 'Subtotal') + note(s['note']))
# 7 model 2 prices
s = by['model2']
page(h2(N(), s['title']) + rw(f'<p>{s["intro"][0]}</p>', f'<p>{s["intro"][1]}</p>') +
     mirror([('Total monthly package', 'إجمالي الراتب الشهري'), ('12 months', '12 شهراً'), ('24 months', '24 شهراً'), ('36 months', '36 شهراً')],
            [((r[0][0], r[0][1]), r[1], r[2], r[3]) for r in s['rows']], [28, 16, 16, 16], nums=(1, 2, 3)) + note(s['note']))
# 8 gov
s = by['gov']
page(h2(N(), s['title']) + grid_rows(s['heads'], s['rows'], '1.1fr 1.3fr 1.1fr 1fr') + note(s['note']))
# 9 local
s = by['local']
page(h2(N(), s['title']) + grid_rows(s['head'], s['rows'], '1.4fr 1.1fr 1.7fr') + note(s['note']))
# 10 saudi
s = by['saudi']
rows = [(r[0], r[1], (r[2][0], r[2][0]), (r[3][0], r[3][0])) for r in s['rows']]
page(h2(N(), s['title']) + grid_rows(s['heads'], rows, '1.3fr 1.6fr 0.8fr 0.8fr',
     lambda j, c, k: (f'<div class="b">{c[k]}</div>' if j == 0 else (num(c[k]) if j >= 2 else f'<div>{c[k]}</div>')),
     hl=lambda r: r[0][0].startswith('Monthly price')) + note(s['note']))
# 11 next steps
s = by['payment']
def items(c):
    return rw(f'<h2 style="font-size:12.5px">{esc(c[0][0])}</h2>', f'<h2 style="font-size:12.5px">{esc(c[0][1])}</h2>') + ''.join(
        rw(f'<div class="ck"><span class="bu">›</span><span>{a}</span></div>', f'<div class="ck"><span class="bu">›</span><span>{b}</span></div>') for a, b in c[1])
terms = grid_rows([('Terms', 'الشروط'), ('', '')], [((a[0], a[1]), (b[0], b[1])) for a, b in s['terms']], '1fr 1.5fr') 
page(h2(N(), s['title']) + items(s['steps']) + items(s['need']) + terms)
# 12 acceptance (signature boxes in the standard)
s = by['accept']
def sg(title, rows, sig):
    f = ''.join(f'<div class="f2"><span>{a}</span><span class="v"><span class="num">{v}</span></span><span dir="rtl">{b}</span></div>' for (a, b), v in rows)
    return f'<div><h3><span>{title[0]}</span><span dir="rtl">{title[1]}</span></h3>{f}<div class="bx2"><div style="text-align:center">{sig}</div></div></div>'
SIG = 'Signature &amp; Stamp · التوقيع والختم'
flds = lambda c: [(('Company', 'الشركة'), c), (('Name', 'الاسم'), '[●]'), (('Title', 'الصفة'), '[●]'), (('Date', 'التاريخ'), '[●]')]
page(h2(N(), s['title']) +
     rw('<p>By signing below, both parties accept this proposal and its terms. Model chosen: <span class="chb">☐</span> Model 1 (Transparent cost) &nbsp; <span class="chb">☐</span> Model 2 (Full employee cost).</p>',
        '<p>بالتوقيع أدناه يوافق الطرفان على هذا العرض وشروطه. النموذج المختار: <span class="chb">☐</span> الأول (التكلفة بشفافية) &nbsp; <span class="chb">☐</span> الثاني (تكلفة الموظف الكاملة).</p>') +
     f'<div class="sg" style="direction:ltr">{sg(("Business Partner Solutions", "بزنس بارتنر سلوشنز"), flds("Business Partner Solutions"), SIG)}{sg(("Client", "العميل"), flds(CE), SIG)}</div>' +
     note(('A signed copy of this proposal and the Non-Disclosure Agreement are required before we send the Services Agreement.', 'نحتاج نسخة موقعة من هذا العرض واتفاقية عدم الإفصاح قبل أن نرسل عقد الخدمات.')))
# 13 closing
b = by['bank']
def bx(c):
    return f'<div><b>{c[0][0]} · {c[0][1]}</b>' + '<br>'.join(f'{l[0]} / {l[1]}: ' + (f'<span class="num">{v[0]}</span>' if v[0] == v[1] else f'{v[0]} / {v[1]}') for l, v in c[1]) + '</div>'
closing = f'''<section class="sheet land" lang="ar"><div dir="rtl"><div class="cv"><div class="lgc"><span class="logo" role="img" aria-label="Business Partner"></span></div><div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div><h1 class="pf">Thank you for your trust · <span style="font-family:'IBM Plex Sans Arabic'">شكراً لثقتكم</span></h1><div class="bx">{bx(b['right'])}{bx(b['left'])}</div></div></div>@@FT@@</section>'''
PAGES.append(closing)

total = len(PAGES)
body = ''.join(p.replace('@@FT@@', FOOT(i, total)) for i, p in enumerate(PAGES, 1))
ff = ''
if len(sys.argv) > 3:
    exec(open('gen_deck.py', encoding='utf8').read().split('S=[]')[0], g2 := {})
    ff = g2['ff']
gf = '' if ff else '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@700&display=swap">'
doc = f'<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عرض سعر نظام التعاقد ونقل الخدمات</title>{gf}<style>{ff}{STYLE}</style></head><body>{body}</body></html>'
doc = doc.replace('0530540231', PHONE)
os.makedirs(OUTDIR, exist_ok=True)
open(os.path.join(OUTDIR, 'proposal-bd.html'), 'w', encoding='utf8').write(doc)
print('pages', total)
