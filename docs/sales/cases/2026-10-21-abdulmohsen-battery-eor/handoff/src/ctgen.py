# Contract renderer (QMOVE-style): tables, keep-together blocks, navy top bar. MODE=bi|ar|en  PAIRS=file  PFX=CT1
import json, re, html, math, os
from ct_tables import build
MODE = os.environ.get('MODE', 'bi'); PFX = os.environ.get('PFX', 'CT'); MODEL = int(os.environ.get('MODEL', '1'))
SUF = {'bi': '', 'ar': 'AR', 'en': 'EN'}[MODE]
OUT = os.environ.get('OUTDIR', 'out/project/'); os.makedirs(OUT, exist_ok=True)
AR_MAP = {'CLIENT_NAME': 'اسم الشركة', 'CLIENT_ADDRESS': 'العنوان', 'CLIENT_REG_NO': 'رقم السجل', 'SIGNATORY_NAME': 'اسم المفوّض', 'SIGNATORY_TITLE': 'الصفة', 'CLIENT_EMAIL': 'البريد الإلكتروني', 'EMPLOYER_ENTITY': 'الجهة صاحبة العمل', 'START_DATE': 'تاريخ البدء', 'RENEWAL_DATE': 'تاريخ التجديد', 'WORKING_HOURS': 'ساعات العمل', 'ADOPTION_DAYS': 'عدد أيام الاعتماد', 'HEADCOUNT_NOTICE_DAYS': 'عدد أيام الإخطار', 'REVIEW_DAYS': 'عدد أيام المراجعة', 'AMICABLE_DAYS': 'عدد الأيام', 'OBJECTION_DAYS': 'عدد الأيام', 'ADVANCE_REFUND_TERMS': 'شروط الاسترداد'}
def arfix(t):
    for a, b in (('Business Partner Solutions Company', 'بزنس بارتنر سلوشنز'), ('Business Partner Solutions', 'بزنس بارتنر سلوشنز'), ('Business Partner', 'بزنس بارتنر'), ('النموذج (1)', 'النموذج 1'), ('النموذج (2)', 'النموذج 2')): t = t.replace(a, b)
    return t
def ph(t, ar):
    if ar: t = arfix(t)
    return re.sub(r'\[\[(\w+)\]\]', lambda m: '[' + ((AR_MAP.get(m.group(1)) or m.group(1).replace('_', ' ')) if ar else m.group(1).replace('_', ' ')) + ']', t)
raw = json.load(open(os.environ.get('PAIRS', 'pairs_eor.json')))
P = build([(e, a) if not e['ar'] else (a, e) for e, a in raw], MODEL, ph)
esc = lambda s: html.escape(s, quote=False)
LOGO = '/_blob/3e3c443e48f3d61a03ccc1d0b1bf30fb'
VT_EN = os.environ.get('VT_EN', ''); VT_AR = os.environ.get('VT_AR', '')
GC = 'repeat(2,minmax(0,1fr));column-gap:44px' if MODE == 'bi' else 'minmax(0,1fr)'
FE = 14.5 if MODE == 'bi' else 17; FA = 16 if MODE == 'bi' else 18
CSS = f'''body{{margin:0}}
.g{{display:grid;grid-template-columns:{GC};padding:3px 0}}
.e{{direction:ltr;text-align:left;font-size:{FE}px;line-height:1.5;color:#3A4566}}
.a{{direction:rtl;text-align:right;font-size:{FA}px;line-height:1.65;color:#1B2340}}
.h .e{{font-family:'Playfair Display',serif;font-weight:700;font-size:15px;color:#fff;line-height:1.3}}
.h .a{{font-weight:700;font-size:16px;color:#fff;line-height:1.3}}
.h{{background:#0B1B5A;border-radius:6px;margin-top:10px;padding:7px 12px}}
.tr{{border:1px solid #CBD3E8;margin-top:-1px;padding:0}}
.tr .e,.tr .a{{padding:0}}
.tn{{padding:6px 2px}}
.tb{{background:#0B1B5A;margin-top:12px;padding:7px 12px;border-radius:5px}}
.tb .e,.tb .a{{font-weight:600;color:#fff}}
.tg{{display:grid;grid-template-columns:1.25fr .9fr .95fr 1.1fr}}
.tg div{{padding:6px 8px;border-inline-start:1px solid #CBD3E8;background:#fff}}
.tg div:first-child{{border-inline-start:none;font-weight:600;color:#0B1B5A}}
.th .tg div{{background:#EEF1FB;font-weight:600;color:#0B1B5A}}
.tc .tg div{{text-align:center}}
.ln{{border-bottom:1px solid #0B1B5A;height:30px;margin-top:8px}}'''
def head(title):
    return f'''<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Playfair+Display:wght@700&display=swap">
<style>
{CSS}
</style>
</helmet>
'''
FOOT = '''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1240,"height":1754}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
'''
def frame(inner, label):
    return f'''<div style="width:1240px;height:1754px;box-sizing:border-box;padding:0 64px 34px;display:flex;flex-direction:column;background:#fff;color:#1B2340;font-family:'IBM Plex Sans Arabic',sans-serif">
<div style="height:14px;background:#0B1B5A;margin:0 -64px"></div>
<div style="display:flex;justify-content:space-between;align-items:center;height:56px;margin-top:14px;border-bottom:1px solid #DDE1EE;direction:ltr">
<img src="{LOGO}" alt="Business Partner" style="height:34px">
<div style="font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:13px;color:#0B1B5A;letter-spacing:.06em">{label}</div>
</div>
<div class="body" style="margin-top:10px">
{inner}
</div>
<div class="foot" style="margin-top:auto;display:flex;justify-content:space-between;font-size:11px;color:#6A7596;border-top:1px solid #0B1B5A;padding-top:8px;direction:ltr"><span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>www.businesspartner.sa · business@businesspartner.sa · 0530540231 · Ad Diriyah · RDAA9214</span></div>
</div>
</x-dc>
'''
def kind(e):
    t = e['t']
    if re.match(r'^(\d+\.\s+[A-Z ,&-]+$|WHEREAS|BETWEEN:|CONTRACT DETAILS|SCHEDULE|IN WITNESS)', t): return 'h'
    if re.match(r'^(\d+\.\d+ |Procedure|Mechanism|The basis|Fees:|Actual Costs paid|Cost components|Job title|Occupation:|Localisation Fee per|Reference table|Minimum wage|Other occupations|Each occupation|An occupation|The Inclusive)', t): return 'n'
    return ''
def lines(t, w): return max(1, math.ceil(len(t) / w))
W = 534 if MODE == 'bi' else 1112
def cw(fr):
    v = [float(x.replace('fr', '')) for x in fr.split()]; s = sum(v); return [x / s for x in v]
def cell_h(txt, frac, ar, rowpad=14):
    wpx = max(40, frac * W - 18); ch = (7.3 if ar else 6.3) * (1 if MODE == 'bi' else 1.15)
    return math.ceil(len(txt) * ch / wpx) * (26 if ar else 22)
def spec_h(s):
    fr = cw(s['cols']); h = 0
    if s.get('title'): h += 44
    rows = ([[(c[0], c[1]) for c in s['head']]] if s['head'] else []) + s['rows']
    for r in rows:
        rh = 0
        for k, c in enumerate(r):
            if MODE in ('bi', 'en'): rh = max(rh, cell_h(c[0], fr[k], False))
            if MODE in ('bi', 'ar'): rh = max(rh, cell_h(c[1], fr[k], True))
        h += max(rh, s.get('rowh', 0)) + 14
    return h + 8
def row_h(e, a):
    if e['t'] == '@@T': return spec_h(e['spec'])
    w_e = (72 if MODE == 'bi' else 128); w_a = (62 if MODE == 'bi' else 112)
    h = 0
    if MODE in ('bi', 'en'): h = max(h, lines(e['t'], w_e) * 22)
    if MODE in ('bi', 'ar'): h = max(h, lines(a['t'], w_a) * 27)
    return h + 12 + (36 if kind(e) == 'h' else 0)
def cells(r, cols, i, mh=0):
    return f'<div class="tg" style="grid-template-columns:{cols};min-height:{mh}px">' + ''.join(f'<div>{esc(ph(c[i], bool(i)))}</div>' for c in r) + '</div>'
def wrap(en, ar, cls):
    parts = ''
    if MODE in ('bi', 'en'): parts += f'<div class="e">{en}</div>'
    if MODE in ('bi', 'ar'): parts += f'<div class="a">{ar}</div>'
    return f'<div class="g {cls}">{parts}</div>'
def render_spec(s):
    out = '<!--G-->'
    if s.get('title'): out += wrap(esc(ph(s['title'][0], False)), esc(ph(s['title'][1], True)), 'tb')
    c = ' tc' if s.get('center') else ''
    if s['head']: out += wrap(cells([(h[0], h[1]) for h in s['head']], s['cols'], 0), cells([(h[0], h[1]) for h in s['head']], s['cols'], 1), 'tr tt th' + c)
    for r in s['rows']:
        out += wrap(cells(r, s['cols'], 0, s.get('rowh', 0)), cells(r, s['cols'], 1, s.get('rowh', 0)), 'tr tt' + c)
    return out + '<!--/G-->'
def fmt_row(e, a):
    if e['t'] == '@@T': return render_spec(e['spec'])
    c = kind(e)
    return wrap(esc(e['t']), esc(a['t']), 'h' if c == 'h' else ('tn' if c == 'n' else ''))
# ---- pagination: tables are never split; a heading stays with what follows
BUD = int(os.environ.get('BUD', '1560' if MODE == 'bi' else '1440'))
BREAK_BEFORE = ('SCHEDULE 1',)
units = []; pend = []
for e, a in P:
    if kind(e) == 'h' and e['t'] != '@@T': pend.append((e, a)); continue
    units.append(pend + [(e, a)]); pend = []
if pend: units.append(pend)
pages = []; cur = []; h = 0
for u in units:
    uh = sum(row_h(e, a) for e, a in u)
    force = any(u[0][0]['t'].startswith(b) for b in BREAK_BEFORE)
    if cur and (force or h + uh > BUD):
        pages.append(cur); cur = []; h = 0
    cur.extend(u); h += uh
if cur: pages.append(cur)
total = len(pages) + 1
files = []
def cover():
    ar = f'''<div style="margin-top:240px;direction:rtl;text-align:right">
<h1 style="margin:0;font-size:62px;line-height:1.25;font-weight:700">اتفاقية خدمات نظام التعاقد ونقل الخدمات</h1>
<p style="margin:22px 0 0;font-size:30px;line-height:1.5;color:#9DB4FF">{esc(VT_AR)}</p>
<p style="margin:14px 0 0;font-size:26px;line-height:1.5;color:#C9D5FF">للموظفين العاملين لدى شركة مختلطة نرويجية سعودية تحت التأسيس</p>
</div>'''
    en = f'''<div style="margin-top:{56 if MODE=='bi' else 240}px;direction:ltr;text-align:left">
<h2 style="margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:44px;line-height:1.2">Employer of Record and<br>Service Transfer Agreement</h2>
<p style="margin:14px 0 0;font-size:28px;line-height:1.5;color:#9DB4FF">{esc(VT_EN)}</p>
<p style="margin:12px 0 0;font-size:22px;line-height:1.5;color:#C9D5FF">Employees of a mixed Norwegian–Saudi company under formation</p>
</div>'''
    meta_en = '<div style="direction:ltr;text-align:left">Between: Business Partner Solutions<br>and [CLIENT NAME]<br>Fee per employee from SAR 900 per month · excl. VAT</div>'
    meta_ar = '<div style="direction:rtl;text-align:right">بين: شركة بزنس بارتنر<br>و[اسم الشركة]<br>رسمنا من 900 ريال للفرد شهرياً · قبل الضريبة</div>'
    body = (ar + en) if MODE == 'bi' else (ar if MODE == 'ar' else en)
    meta = (meta_en + meta_ar) if MODE == 'bi' else (meta_ar if MODE == 'ar' else meta_en)
    label = 'اتفاقية · مسودة 1 · 24 أكتوبر 2026' if MODE == 'ar' else 'AGREEMENT · DRAFT v1 · 24 OCT 2026'
    fl = ('مسودة للمراجعة · لم تُرسَل · خاضعة للمراجعة القانونية' if MODE == 'ar' else 'Draft for review · not sent · subject to legal review')
    return head('Agreement') + f'''<div style="width:1240px;height:1754px;box-sizing:border-box;padding:60px 70px 50px;display:flex;flex-direction:column;background:linear-gradient(135deg,#071442,#0B1B5A);color:#fff;font-family:'IBM Plex Sans Arabic',sans-serif">
<div style="display:flex;justify-content:space-between;align-items:center;height:70px">
<div style="background:#fff;border-radius:14px;padding:10px 22px;display:flex"><img src="{LOGO}" alt="Business Partner" style="height:46px"></div>
<div style="font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:22px;color:#9DB4FF;letter-spacing:.06em">{label}</div>
</div>
{body}
<div style="margin-top:70px;display:grid;grid-template-columns:{'repeat(2,minmax(0,1fr))' if MODE=='bi' else 'minmax(0,1fr)'};column-gap:40px;font-size:21px;line-height:1.6;color:#C9D5FF">{meta}</div>
<div style="margin-top:auto;display:flex;justify-content:space-between;font-size:19px;color:#9DB4FF;border-top:2px solid #9DB4FF;padding-top:14px;direction:ltr"><span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>{fl}</span></div>
</div>
</x-dc>
''' + FOOT
files.append((f'{PFX}{SUF}-01-Cover', cover()))
for i, rows in enumerate(pages):
    n = i + 2
    inner = '\n'.join(fmt_row(e, a) for e, a in rows)
    if any(r[0]['t'].startswith('IN WITNESS') for r in rows): pass
    files.append((f'{PFX}{SUF}-{n:02d}-Clauses', head('Contract') + frame(inner, f'CONTRACT · {n:02d}/{total:02d}') + FOOT))
for name, content in files:
    open(OUT + name + '.dc.html', 'w', encoding='utf8').write(content)
print(PFX + SUF, len(files))
