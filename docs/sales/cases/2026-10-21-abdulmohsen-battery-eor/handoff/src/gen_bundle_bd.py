# Bundle: quotation + agreements (Model 1, Model 2) + NDA in the Business Development standard, as one 3-tab page.
# usage: gen_bundle_bd.py <bd_artifact_html> <outdir> [final]   (final = real phone/IBAN/unified no.; else placeholders)
import os, sys, re, json, html, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, HERE)
BD, OUT = sys.argv[1], sys.argv[2]; FINAL = len(sys.argv) > 3 and sys.argv[3] == 'final'
os.makedirs(OUT, exist_ok=True)
esc = lambda s: html.escape(s, quote=False)

# ---- quotation sheets (landscape) from gen_prop_bd
env = dict(os.environ)
if FINAL: env.update(BP_PHONE='0530540231', BP_IBAN='SA5380000511608016228498')
subprocess.run([sys.executable, '-I', 'gen_prop_bd.py', BD, OUT + '/q'], check=True, env=env, stdout=subprocess.DEVNULL)
qh = open(OUT + '/q/proposal-bd.html', encoding='utf8').read()
qcss = re.findall(r'<style>(.*?)</style>', qh, re.S)[0]
qsheets = re.search(r'<body>(.*)</body>', qh, re.S).group(1)

# ---- contract content
def load_P(pairs, model):
    e = dict(os.environ, MODE='bi', PFX='X', MODEL=str(model), PAIRS=pairs, OUTDIR='/tmp/_ctx/')
    old = dict(os.environ); os.environ.update(e)
    g = {}; exec(open('ctgen.py', encoding='utf8').read().split('# ---- pagination')[0], g)
    os.environ.clear(); os.environ.update(old)
    return g['P'], g['kind'], g['ph']
P1, kind, ph = load_P('pairs_eor_m1.json', 1)
P2, _, _ = load_P('pairs_eor_m2.json', 2)
nda = json.load(open('pairs_nda.json', encoding='utf8'))
PN = [({'t': x[0]['t']}, {'t': x[1]['t']}) for x in nda]

def cellfmt(t, ar): return esc(ph(t, ar))
def pair_unit(e, a, head=False):
    cls = ' class="hh"' if head else ''
    return (f'<table class="cl"{cls}><tr><td class="en">{cellfmt(e["t"], False)}</td><td class="ar">{cellfmt(a["t"], True)}</td></tr></table>')
def spec_unit(s):
    cols = s['cols']
    def side(cells, d, z='', hh=False):
        return f'<div class="gr {"hh " if hh else ""}{z}" dir="{d}" style="grid-template-columns:{cols}">' + ''.join(f'<div>{cellfmt(c, d == "rtl")}</div>' for c in cells) + '</div>'
    top = ''
    if s.get('title'):
        top += f'<div class="rw tb"><div class="col" dir="ltr"><div class="gr hh" style="grid-template-columns:1fr"><div class="b">{cellfmt(s["title"][0], False)}</div></div></div><div class="col" dir="rtl"><div class="gr hh" style="grid-template-columns:1fr"><div class="b">{cellfmt(s["title"][1], True)}</div></div></div></div>'
    if s.get('head'):
        top += f'<div class="rw tb"><div class="col" dir="ltr">{side([h[0] for h in s["head"]], "ltr", hh=True)}</div><div class="col" dir="rtl">{side([h[1] for h in s["head"]], "rtl", hh=True)}</div></div>'
    rws = []
    for i, r in enumerate(s['rows']):
        z = 'z' if i % 2 else ''
        rws.append(f'<div class="rw tb"><div class="col" dir="ltr">{side([c[0] for c in r], "ltr", z)}</div><div class="col" dir="rtl">{side([c[1] for c in r], "rtl", z)}</div></div>')
    us = []
    for i, r in enumerate(rws):
        us.append(f'<div class="bp ct" style="margin:{"6px" if i == 0 else "0"} 0 0">' + (top if i == 0 else '') + r + '</div>')
    return us
def units(P):
    out = []; pend = []
    for e, a in P:
        if e['t'] == '@@T':
            us = spec_unit(e['spec']); out.append(''.join(pend) + us[0]); pend = []; out.extend(us[1:]); continue
        u = pair_unit(e, a, kind(e) == 'h'); head = kind(e) == 'h'
        if head: pend.append(u); continue
        out.append(''.join(pend) + u); pend = []
    if pend: out.append(''.join(pend))
    return out
DOCS = {
 'm1': (units(P1[1:]), 'اتفاقية نظام التعاقد ونقل الخدمات', 'Model 1 · Transparent cost · النموذج 1 · التكلفة بشفافية'),
 'm2': (units(P2[1:]), 'اتفاقية نظام التعاقد ونقل الخدمات', 'Model 2 · Full employee cost · النموذج 2 · تكلفة الموظف الكاملة'),
 'nda': (units(PN), 'اتفاقية عدم الإفصاح المتبادلة', 'Mutual Non-Disclosure Agreement · NDA'),
}
FOOT = lambda n, N: ('<div class="ft"><div class="a">National Address: RDAA9214<br>9214 King Khaled Branch Rd, Al Asemah<br>Ad Diriyah 13714, Saudi Arabia</div>'
    f'<div class="c">0530540231<br>business@businesspartner.sa<br>www.businesspartner.sa<br><span class="m">{n} / {N}</span></div>'
    '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>')
HD = lambda ar, en: (f'<div class="hd" dir="ltr"><span class="logo" role="img" aria-label="Business Partner"></span><div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">{esc(ar)}</h1><div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">{esc(en)}</div></div></div>')

bd = open(BD, encoding='utf8').read()
bdcss = [b for b in re.findall(r'<style>(.*?)</style>', bd, re.S) if '.sheet.land' in b][0].split('body{background:var(--bg);color:var(--fg)}')[0]
viewer = re.findall(r'<style>(.*?)</style>', bd, re.S)[0]
EXTRA = '''.cl{margin:-1px 0 0;table-layout:fixed;font-size:10.4px;line-height:1.5}.cl td{vertical-align:top;padding:4px 8px}.cl.hh td{background:#EEF1FB;font-weight:700;color:#0B1B5A}
.gr{display:grid;border:1px solid #DDE1EE;border-top:0;background:#fff;font-size:9.4px;line-height:1.4}.gr>div{padding:2px 6px;border-inline-start:1px solid #DDE1EE;min-width:0}.gr>div:first-child{border-inline-start:0}
.gr.hh{background:#0B1B5A;color:#fff;font-weight:700;border-color:#0B1B5A}.gr.hh>div{border-color:#13246E}.gr.z{background:#F7F8FD}.gr .b{font-weight:700}
.rw.tb>.col{padding-top:0;padding-bottom:0;display:flex;flex-direction:column}.rw.tb .gr{flex:1}.gr>div{display:flex;align-items:center}.bp.ct{margin:6px 0 0}.rw{display:flex}.rw>.col{flex:1;min-width:0}'''
pool = ''
for k, (us, ar, en) in DOCS.items():
    pool += f'<div class="pooldoc" data-k="{k}" data-ar="{esc(ar)}" data-en="{esc(en)}">' + ''.join(f'<div class="unit">{u}</div>' for u in us) + '</div>'
poolhtml = f'<!doctype html><html lang="ar"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@700&display=swap"><style>{bdcss}{EXTRA}</style></head><body><div id="pool" style="display:none">{pool}</div></body></html>'
open(OUT + '/pool.html', 'w', encoding='utf8').write(poolhtml)
# paginate in a real browser
js = r'''
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(1500);
  const res = await p.evaluate((hdh) => {
    const out = {};
    document.querySelectorAll('.pooldoc').forEach(d => {
      const k = d.dataset.k; const units = [...d.querySelectorAll('.unit')]; const pages = [];
      const mk = () => { const s = document.createElement('section'); s.className = 'sheet port'; s.setAttribute('lang', 'ar');
        s.innerHTML = '<div dir="rtl">' + hdh[k] + '<div class="body" style="margin-top:6px"></div></div>'; s.style.position = 'absolute'; s.style.left = '0'; s.style.top = '0'; document.body.appendChild(s); return s; };
      let s = mk(), body = s.querySelector('.body');
      const lim = 1012;
      units.forEach(u => {
        body.appendChild(u.firstElementChild ? u : u);
        const over = () => body.lastElementChild.getBoundingClientRect().bottom - s.getBoundingClientRect().top > lim;
        if (over() && body.children.length > 1) {
          const last = body.lastElementChild; body.removeChild(last);
          pages.push(s.querySelector('div[dir=rtl]').innerHTML); s.remove(); s = mk(); body = s.querySelector('.body'); body.appendChild(last);
        }
      });
      pages.push(s.querySelector('div[dir=rtl]').innerHTML); s.remove(); out[k] = pages;
    });
    return out;
  }, JSON.parse(process.argv[3]));
  require('fs').writeFileSync(process.argv[4], JSON.stringify(res)); await b.close();
})();
'''
open(OUT + '/pag.js', 'w').write(js)
hdh = {k: HD(v[1], v[2]) for k, v in DOCS.items()}
subprocess.run(['node', OUT + '/pag.js', os.path.abspath(OUT + '/pool.html'), json.dumps(hdh), OUT + '/pages.json'], check=True)
pages = json.load(open(OUT + '/pages.json', encoding='utf8'))

def sheets(k):
    ps = pages[k]; N = len(ps)
    return ''.join(f'<section class="sheet port" lang="ar"><div dir="rtl">{p}</div>{FOOT(i, N)}</section>' for i, p in enumerate(ps, 1))
TABS = [('quote', 'عرض السعر', 'Quotation', qsheets), ('agreement', 'العقد', 'Agreement', '<div class="agh">' + sheets('m1') + '</div><div class="agh">' + sheets('m2') + '</div>'), ('nda', 'عدم الإفصاح', 'NDA', sheets('nda'))]
bar = ''.join(f'<button role="tab" id="t-{k}" data-tab="{k}" aria-controls="p-{k}"><span>{ar}</span><small>{en}</small></button>' for k, ar, en, _ in TABS)
panels = ''.join(f'<div role="tabpanel" id="p-{k}" aria-labelledby="t-{k}" hidden><div class="scroller">{body}</div></div>' for k, ar, en, body in TABS)
page = f'''<title>عقد واتفاقية عبدالمحسن</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@700&display=swap">
<style>{viewer}
{bdcss}{EXTRA}
body{{background:var(--bg);color:var(--fg)}}.sheet{{break-after:auto;page-break-after:auto}}.agh{{display:contents}}
</style>
<div class="wrap"><div class="bar"><h1>عقد واتفاقية عبدالمحسن</h1><div role="tablist" aria-label="المستندات">{bar}</div></div>{panels}</div>
<script>
(function(){{
 var keys=["quote","agreement","nda"];
 document.querySelectorAll(".sheet").forEach(function(root){{var box=document.createElement("div");box.className="fit";root.parentNode.insertBefore(box,root);box.appendChild(root)}});
 function fit(){{document.querySelectorAll(".fit").forEach(function(b){{var s=b.firstElementChild,w=s.classList.contains("land")?1123:794,h=s.classList.contains("land")?794:1123;var avail=b.parentNode.clientWidth;if(!avail)return;var k=Math.min(1.5,avail/w);
  s.style.transform="scale("+k+")";s.style.transformOrigin="top left";b.style.width=Math.round(w*k)+"px";b.style.height=Math.round(h*k)+"px"}})}}
 function show(k){{if(keys.indexOf(k)<0)k="quote";keys.forEach(function(x){{document.getElementById("p-"+x).hidden=x!==k;document.getElementById("t-"+x).setAttribute("aria-selected",x===k)}});fit()}}
 document.querySelectorAll("[role=tab]").forEach(function(b){{b.addEventListener("click",function(){{location.hash=b.dataset.tab}})}});
 window.addEventListener("hashchange",function(){{show(location.hash.slice(1))}});window.addEventListener("resize",fit);show(location.hash.slice(1));
}})();
</script>
'''
if FINAL:
    page = page.replace('0530540231', '0530540231')
else:
    for s_ in ('0530540231', '7038825860', 'SA5380000511608016228498'): page = page.replace(s_, '[●]')
open(OUT + '/bundle.html', 'w', encoding='utf8').write(page)
print({k: len(v) for k, v in pages.items()}, len(page))
