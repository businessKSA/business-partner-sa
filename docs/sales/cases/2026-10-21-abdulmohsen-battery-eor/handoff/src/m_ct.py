import json,re,html,math,glob,os

MODE=os.environ.get('MODE','bi'); SUF={'bi':'','ar':'AR','en':'EN'}[MODE]
GC='repeat(2,minmax(0,1fr));column-gap:56px' if MODE=='bi' else 'minmax(0,1fr)'
FE=15 if MODE=='bi' else 17
FA=17 if MODE=='bi' else 20
def ROW(e,a):
    if MODE=='bi': return max(lines(e['t'],62)*22, lines(a['t'],54)*28)+12
    if MODE=='en': return lines(e['t'],118)*26+12
    return lines(a['t'],100)*33+12
def SEL(h):
    if MODE=='en':
        h=h.replace('<div class="a"><div class="ln"></div></div>','')
        h=re.sub(r'<div class="a"[^>]*>(?:(?!<div).)*?</div>','',h,flags=re.S)
    if MODE=='ar':
        h=h.replace('<div class="e"><div class="ln"></div></div>','')
        h=re.sub(r'<div class="e"[^>]*>(?:(?!<div).)*?</div>','',h,flags=re.S)
    return h
def COVERFIX(c):
    if MODE=='bi': return c
    c=c.replace('grid-template-columns:repeat(2,minmax(0,1fr));column-gap:40px','grid-template-columns:minmax(0,1fr);column-gap:0')
    if MODE=='en':
        c=re.sub(r'<div style="margin-top:240px;direction:rtl;text-align:right">.*?</div>','',c,count=1,flags=re.S)
        c=c.replace('margin-top:56px;direction:ltr;text-align:left','margin-top:240px;direction:ltr;text-align:left',1)
        c=re.sub(r'<div style="direction:rtl;text-align:right">.*?</div>','',c,count=1,flags=re.S)
    else:
        c=re.sub(r'<div style="margin-top:56px;direction:ltr;text-align:left">.*?</div>','',c,count=1,flags=re.S)
        c=re.sub(r'<div style="direction:ltr;text-align:left">.*?</div>','',c,count=1,flags=re.S)
    return c
def ROWST(fees):
    out=[]
    for r in fees:
        if len(r)!=4: continue
        if MODE=='en':
            out.append(f'<div class="t" style="grid-template-columns:minmax(0,1fr) 260px"><div style="direction:ltr;text-align:left;color:#1B2340">{esc(r[0])}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:right;color:#0B1B5A">{esc(r[1])}</div></div>')
        else:
            out.append(f'<div class="t" style="grid-template-columns:minmax(0,1fr) 260px"><div style="direction:rtl;text-align:right;color:#1B2340">{esc(r[3])}</div><div style="direction:rtl;text-align:left;color:#0B1B5A">{esc(r[2])}</div></div>')
    return '\n'.join(out)

P=json.load(open('pairs_eor.json'))
AR_MAP={'CLIENT_NAME':'اسم الشركة','CLIENT_ADDRESS':'العنوان','CLIENT_REG_NO':'رقم السجل','SIGNATORY_NAME':'اسم المفوّض','SIGNATORY_TITLE':'الصفة','EMPLOYER_ENTITY':'الجهة صاحبة العمل'}
def _ph(t,ar):
    return re.sub(r'\[\[(\w+)\]\]',lambda m:'['+((AR_MAP.get(m.group(1)) or m.group(1).replace('_',' ')) if ar else m.group(1).replace('_',' '))+']',t)
for _e,_a in P:
    _e['t']=_ph(_e['t'],False); _a['t']=_ph(_a['t'],True)
src='../ng3/project/'
OUT='outm/project/'; os.makedirs(OUT,exist_ok=True)
for f in glob.glob(src+'*'): 
    pass
esc=lambda s:html.escape(s,quote=False)
LOGO='/_blob/3e3c443e48f3d61a03ccc1d0b1bf30fb'
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
body{{margin:0}}
.g{{display:grid;grid-template-columns:{GC};padding:6px 0}}
.e{{direction:ltr;text-align:left;font-size:{FE}px;line-height:1.45;color:#4A5578}}
.a{{direction:rtl;text-align:right;font-size:{FA}px;line-height:1.6;color:#1B2340}}
.h .e{{font-family:'Playfair Display',serif;font-weight:700;font-size:20px;color:#0B1B5A;line-height:1.3}}
.h .a{{font-weight:700;font-size:22px;color:#0B1B5A;line-height:1.3}}
.h{{border-top:2px solid #DDE1EE;margin-top:6px;padding-top:12px}}
.s .e,.s .a{{font-weight:600}}
.t{{display:grid;grid-template-columns:minmax(0,1.2fr) 130px 130px minmax(0,1fr);column-gap:10px;align-items:center;padding:7px 10px;border-bottom:2px solid #DDE1EE}}
.t:nth-child(even){{background:#F7F8FD}}
.t div{{font-size:15px;line-height:1.3}}
.ln{{border-bottom:2px solid #9DB0D8;height:34px;margin-top:10px}}
</style>
</helmet>
'''
FOOT='''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1240,"height":1754}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
'''
def frame(inner,label):
    return f'''<div style="width:1240px;height:1754px;box-sizing:border-box;padding:50px 70px 40px;display:flex;flex-direction:column;background:#F7F8FD;color:#1B2340;font-family:'IBM Plex Sans Arabic',sans-serif">
<div style="display:flex;justify-content:space-between;align-items:center;height:62px">
<div style="background:#fff;border-radius:14px;padding:8px 20px;display:flex;border:2px solid #DDE1EE"><img src="{LOGO}" alt="Business Partner" style="height:42px"></div>
<div style="font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:17px;color:#6A7596;letter-spacing:.06em">{label}</div>
</div>
<div style="margin-top:14px">
{inner}
</div>
<div style="margin-top:auto;display:flex;justify-content:space-between;font-size:14px;color:#6A7596;border-top:2px solid #0B1B5A;padding-top:10px;direction:ltr"><span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>Services Agreement · DRAFT v1 · 21 Oct 2026</span></div>
</div>
</x-dc>
'''
def kind(e):
    t=e['t']
    if re.match(r'^(\d+\.\s+[A-Z ,&-]+$|WHEREAS|BETWEEN:|SCHEDULE|IN WITNESS)',t): return 'h'
    if re.match(r'^(Phase [12] —)',t): return 's'
    return ''
def lines(t,w): return max(1,math.ceil(len(t)/w))
def hrow(e,a):
    return 38 if kind(e)=='h' else 0
def row_h(e,a):
    h=ROW(e,a)
    if kind(e)=='h': h+=24+8
    return h
# pagination
BUD=1700
pages=[];cur=[];h=0
BREAK_BEFORE=('IN WITNESS','SCHEDULE 1','SCHEDULE 2','SCHEDULE 3','SCHEDULE 4','SCHEDULE 5')
for e,a in P:
    rh=row_h(e,a)
    force=any(e['t'].startswith(b) for b in BREAK_BEFORE)
    if cur and (force or h+rh>BUD or (kind(e)=='h' and h+rh+160>BUD)):
        pages.append(cur);cur=[];h=0
    cur.append((e,a));h+=rh
if cur: pages.append(cur)
# split signature region: rows from IN WITNESS until SCHEDULE 1 stay on one page (already forced)
fees=[]
lines_=[]
tb=[]
for l in lines_:
    m=re.match(r'(\d+)(B| ) (.*)',l)
    if m and 296<=int(m.group(1))<=375: tb.append(m.group(3))
for k in range(0,len(tb),4): fees.append(tb[k:k+4])
# pairs list ends at row for 'The table below' (para 290/291); table is separate
N=len(pages)+1  # cover + fees page
total=N
def fmt(rows,idx):
    out=[]
    for e,a in rows:
        c=kind(e)
        out.append(f'<div class="g {c}"><div class="e">{esc(e["t"])}</div><div class="a">{esc(a["t"])}</div></div>')
    return '\n'.join(out)
files=[]
# cover
cover=head('اتفاقية خدمات نظام التعاقد ونقل الخدمات')+f'''<div style="width:1240px;height:1754px;box-sizing:border-box;padding:60px 70px 50px;display:flex;flex-direction:column;background:linear-gradient(135deg,#071442,#0B1B5A);color:#fff;font-family:'IBM Plex Sans Arabic',sans-serif">
<div style="display:flex;justify-content:space-between;align-items:center;height:70px">
<div style="background:#fff;border-radius:14px;padding:10px 22px;display:flex"><img src="{LOGO}" alt="Business Partner" style="height:46px"></div>
<div style="font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:22px;color:#9DB4FF;letter-spacing:.06em">AGREEMENT · DRAFT v1 · 21 OCT 2026</div>
</div>
<div style="margin-top:240px;direction:rtl;text-align:right">
<h1 style="margin:0;font-size:62px;line-height:1.25;font-weight:700">اتفاقية خدمات نظام التعاقد ونقل الخدمات</h1>
<p style="margin:22px 0 0;font-size:26px;line-height:1.5;color:#C9D5FF">للموظفين العاملين لدى شركة مختلطة نرويجية سعودية تحت التأسيس</p>
</div>
<div style="margin-top:56px;direction:ltr;text-align:left">
<h2 style="margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:44px;line-height:1.2">Employer of Record and<br>Service Transfer Agreement</h2>
<p style="margin:12px 0 0;font-size:22px;line-height:1.5;color:#C9D5FF">Employees of a mixed Norwegian–Saudi company under formation</p>
</div>
<div style="margin-top:70px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:40px;font-size:21px;line-height:1.6;color:#C9D5FF">
<div style="direction:ltr;text-align:left">Between: Business Partner Solutions<br>and [CLIENT NAME]<br>Fee per employee from SAR 900 per month · excl. VAT</div>
<div style="direction:rtl;text-align:right">بين: شركة بزنس بارتنر<br>و[اسم الشركة]<br>رسمنا من 900 ريال للفرد شهرياً · قبل الضريبة</div>
</div>
<div style="margin-top:auto;display:flex;justify-content:space-between;font-size:19px;color:#9DB4FF;border-top:2px solid #9DB4FF;padding-top:14px"><span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>Draft for review · not sent · subject to legal review</span></div>
</div>
</x-dc>
'''+FOOT
cover=COVERFIX(cover)
files.append(('CT-01-Cover',cover,'1 · الغلاف / Cover'))
for i,rows in enumerate(pages):
    n=i+2
    first=rows[0][0]['t'][:40]
    inner=fmt(rows,i)
    if rows[0][0]['t'].startswith('IN WITNESS') or any(r[0]['t'].startswith('IN WITNESS') for r in rows):
        inner+='''
<div class="g" style="padding-top:30px"><div class="e"><div class="ln"></div></div><div class="a"><div class="ln"></div></div></div>'''
    inner=SEL(inner)
    html_=head('عقد — صفحة %d'%n)+frame(inner,f'CONTRACT · {n:02d}/{total:02d}')+FOOT
    ttl=f'{n} · '+re.sub(r'^\d+\.?\s*','',rows[0][0]['t'])[:34]
    files.append((f'CT-{n:02d}-Clauses',html_,ttl))
# fees page
rowsT=ROWST(fees) if MODE!='bi' else '\n'.join(f'<div class="t"><div style="direction:ltr;text-align:left;color:#4A5578">{esc(r[0])}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-weight:500;direction:ltr;text-align:center;color:#0B1B5A">{esc(r[1])}</div><div style="direction:rtl;text-align:center;color:#0B1B5A">{esc(r[2])}</div><div style="direction:rtl;text-align:right;color:#1B2340">{esc(r[3])}</div></div>' for r in fees if len(r)==4)
inner=f'''<div class="g h" style="border-top:none"><div class="e">Schedule 2 — Estimated Government Fees (table)</div><div class="a">الملحق (2) — جدول الرسوم الحكومية المقدّرة</div></div>
<div style="background:#fff;border:2px solid #DDE1EE;border-radius:18px;padding:4px 10px">
{rowsT}
</div>
<div class="g" style="padding-top:14px"><div class="e" style="font-size:14px">Note: government fees for processing the GM visa in the country of origin or residence are not included and generally range between SAR 5,000 and 10,000 (one-off).</div><div class="a" style="font-size:16px">ملاحظة: رسوم إصدار تأشيرة المدير العام في بلد المنشأ أو الإقامة غير مشمولة وتتراوح عادة بين 5,000 و10,000 ريال (لمرة واحدة).</div></div>'''
inner=SEL(inner)
if False: files.append((f'CT-{N:02d}-Fees-Table',head('عقد — جدول الرسوم')+frame(inner,f'CONTRACT · {N:02d}/{total:02d}')+FOOT,f'{N} · الرسوم الحكومية / Gov. fees'))
files=[(n.split('-')[0]+SUF+'-'+n.split('-',1)[1],c,t) for n,c,t in files]
for name,content,_ in files: open(OUT+name+'.dc.html','w',encoding='utf8').write(content)
json.dump([(n,t) for n,_,t in files],open('boards_'+files[0][0].split('-')[0]+'.json','w'),ensure_ascii=False)
print(len(files),[ (n,len(p)) for n,p in zip([f[0] for f in files[1:]],pages)])
