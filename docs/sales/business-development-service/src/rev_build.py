# -*- coding: utf-8 -*-
"""REV service-contract builder. Usage: python3 rev_build.py contract|nda
Reads the *-shell.html (head/fonts/covers/header/footer), takes row content from the
content module, auto-paginates with Playwright (node, NODE_PATH=$(npm root -g)), writes ../REV-*.html"""
import re,sys,json,subprocess,os,importlib.util
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.dirname(HERE); TMP='/tmp/rev_build'; os.makedirs(TMP,exist_ok=True)
MOBILE='0530540231'; NAME_EN='Business Partner Solutions'
EXTRA='''<style>
.cx{direction:ltr;font-size:10.2px;line-height:1.5}
.cx .rw>.col{padding:2px 14px}.cx .rw>.col:first-child{padding-left:0}.cx .rw>.col+.col{padding-right:0}
.cx .hh .col{border-bottom:0}.cx h2{font-size:13px;margin:8px 0 3px}
.cx .rw.lr .col{border-bottom:1px solid #EEF1FB}
.cx .bu{display:inline-block;min-width:26px}
.cx b{color:#0B1B5A}
.bt{width:100%;table-layout:fixed;border-collapse:collapse;margin:4px 0 6px;font-size:10px;direction:ltr}
.bt th{background:#0B1B5A;color:#fff;padding:4px 6px;border:1px solid #0B1B5A;text-align:center;font-weight:700}
.bt th .pa{color:#9DB4FF;font-weight:400;font-size:9px}
.bt td{padding:3px 6px;border:1px solid #DDE1EE;vertical-align:middle}
.bt td.c{text-align:center}
.bt .lb{display:flex;justify-content:space-between;gap:8px;text-align:left}
.bt .lb span:last-child{text-align:right;direction:rtl}
.bt td .lb span:last-child{color:#4A5578}
.bt th .lb span:last-child{color:#9DB4FF;font-weight:400}
.bt .num{font-size:10.4px}
</style>'''
def fix(s):
    s=s.replace('<div class="c">[●]<br>',f'<div class="c">{MOBILE}<br>')
    s=s.replace('<span>Mobile</span><span class="kvv"><span class="num">[●]</span>',f'<span>Mobile</span><span class="kvv"><span class="num">{MOBILE}</span>')
    s=s.replace('Mobile / الجوال: <span class="num">[●]</span>',f'Mobile / الجوال: <span class="num">{MOBILE}</span>')
    s=s.replace('IBAN [●]','IBAN [IBAN]').replace('آيبان [●]','آيبان [IBAN]').replace('IBAN: <span class="num">[●]</span>','IBAN: <span class="num">[IBAN]</span>')
    s=s.replace('<td class="v">[●]<br><span dir="rtl">شركة بزنس',f'<td class="v">{NAME_EN}<br><span dir="rtl">شركة بزنس')
    s=s.replace('</span>[●]<br><span class="num">[●]</span></div>',f'</span>{NAME_EN}<br><span class="num">[●]</span></div>')
    return s
def load(path):
    spec=importlib.util.spec_from_file_location('c',path); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
def build(kind):
    cm=load(os.path.join(HERE,f'REV-{kind}-content.py'))
    shell=open(os.path.join(HERE,f'REV-{getattr(cm,"SHELL",kind)}-shell.html'),encoding='utf-8').read()
    i=shell.find('<body>'); head=shell[:i]; secs=re.split(r'(?=<section class="sheet)',shell[i:])
    pre,cover,sh2,last=secs[0],secs[1],secs[2],secs[-1]
    hd=sh2[sh2.find('<div class="hd"'):sh2.find('<div class="pre">')]
    if getattr(cm,'TITLE',None):
        hd=re.sub(r'<h1 class="sm">.*?</h1>',f'<h1 class="sm">{cm.TITLE[1]}</h1>',hd); hd=re.sub(r'(font-size:13px;text-align:right">).*?(</div>)',lambda m:m.group(1)+cm.TITLE[0]+m.group(2),hd)
    parties=sh2[sh2.find('<div class="pre">'):sh2.find('<table class="cl">')]
    fs=sh2.find('<div class="ft">'); ft=sh2[fs:sh2.rfind('</section>')]
    sig=''
    for x in secs[2:-1]:
        j=x.find('<div class="sg"')
        if j>=0: sig=x[j:x.find('<div class="ft">')-6]
    head=head.replace('</style></head>','</style>'+EXTRA+'</head>')
    wrap=lambda inner:f'<div class="bp cx">{inner}</div>'
    blks=[''.join(b) for b in cm.blocks()]
    if getattr(cm,'NOPARTIES',False): parties=''; sig=''
    items=([parties] if parties else [])+blks+([sig] if sig else [])
    meas=head+'<body style="width:794px"><div style="width:722px">'+''.join(f'<div class="m">{wrap(h)}</div>' for h in items)+'</div></body></html>'
    mp=os.path.join(TMP,'meas.html'); open(mp,'w',encoding='utf-8').write(meas)
    js="const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:1200}});await p.goto('file://%s');await p.evaluate(()=>document.fonts.ready);console.log(JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.m')].map(e=>e.getBoundingClientRect().height))));await b.close()})()"%mp
    jp=os.path.join(TMP,'meas.js'); open(jp,'w').write(js)
    env={**os.environ,'NODE_PATH':subprocess.run(['npm','root','-g'],capture_output=True,text=True).stdout.strip()}
    H=json.loads(subprocess.run(['node',jp],capture_output=True,text=True,env=env).stdout)
    CAP=int(os.environ.get("REV_CAP","870")); pages=[];cur=[];used=0
    for h,hh in zip(items,H):
        if used+hh>CAP and cur: pages.append(cur);cur=[];used=0
        cur.append(h);used+=hh
    if cur: pages.append(cur)
    nc=getattr(cm,'NOCOVERS',False); total=len(pages)+(0 if nc else 2)
    def sheet(n,bl):
        f=re.sub(r'\d+ / \d+',f'{n} / {total}',ft)
        return f'<section class="sheet port" lang="ar"><div dir="rtl">{hd}'+''.join(wrap(b) for b in bl)+f'</div>{f}</section>'
    if getattr(cm,'NOCOVERS',False):
        res=head+pre+''.join(sheet(k+1,p) for k,p in enumerate(pages))
    else:
        res=head+pre+re.sub(r'\d+ / \d+',f'1 / {total}',cover)+''.join(sheet(k+2,p) for k,p in enumerate(pages))+re.sub(r'\d+ / \d+',f'{total} / {total}',last)
    out=os.path.join(getattr(cm,'OUTDIR',OUT),cm.OUTNAME); open(out,'w',encoding='utf-8').write(fix(res)); print(out,total,'pages')
if __name__=='__main__': build(sys.argv[1])
