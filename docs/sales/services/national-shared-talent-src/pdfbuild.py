import re,os,sys,glob,base64
os.chdir('/tmp/claude-0/-home-user-business-partner-sa/6975426c-127c-542b-a9a3-75304d972c91/scratchpad/pr2')
src=open('gen_deck.py').read().split("S=[]")[0]
exec(src)
os.chdir('/tmp/claude-0/-home-user-business-partner-sa/6975426c-127c-542b-a9a3-75304d972c91/scratchpad/abm')
LOGOURI='data:image/png;base64,'+LOGO
def build(name,files,srcdir,w,h,fix=True):
    body='';extra=''
    for f in files:
        t=open(f'{srcdir}/{f}.dc.html',encoding='utf8').read()
        m=re.search(r'<x-dc>(.*)</x-dc>',t,re.S).group(1)
        for st in re.findall(r'<style>(.*?)</style>',m,re.S): extra+=st
        m=re.sub(r'<helmet>.*?</helmet>','',m,flags=re.S).replace('/_blob/3e3c443e48f3d61a03ccc1d0b1bf30fb',LOGOURI)
        body+=f"<section style='page-break-after:always'>{m}</section>"
    html=f"<!doctype html><html><head><meta charset='utf-8'><title>{name}</title><style>{ff}@page{{size:{w}px {h}px;margin:0}}{extra}</style></head><body style='margin:0'>{body}</body></html>"
    if fix: html=html.replace('font-weight:700','font-weight:600')
    open(f'pdfwork/{name}.html','w',encoding='utf8').write(html)
os.makedirs('pdfwork',exist_ok=True)
Q='/tmp/claude-0/-home-user-business-partner-sa/6975426c-127c-542b-a9a3-75304d972c91/scratchpad/ng3/project'
O='out/project'
def lst(prefix):
    fs=sorted(os.path.basename(f)[:-8] for f in glob.glob(f'{O}/{prefix}-[0-9]*.dc.html'))
    return [f for f in fs if f!='CT-12-Fees-Table']
docs={}

P='outp/project'
docs['Proposal-Bilingual']=(['Main','Scope','Roles','Local','Calc','Price','Fees','Next','Accept'],P,1920,1080)
docs['Proposal-AR']=(['AR-1-Cover','AR-2-Scope','AR-3-Roles','AR-4-Local','AR-5-Calc','AR-6-Price','AR-7-Fees','AR-8-Next','AR-9-Accept'],P,1920,1080)
docs['Proposal-EN']=(['EN-1-Cover','EN-2-Scope','EN-3-Roles','EN-4-Local','EN-5-Calc','EN-6-Price','EN-7-Fees','EN-8-Next','EN-9-Accept'],P,1920,1080)
for nm,pre in (('NDA','NDA'),('Service-Agreement','CT')):
    for suf,lab in (('','Bilingual'),('AR','AR'),('EN','EN')):
        docs[f'{nm}-{lab}']=(lst(pre+suf),O,1240,1754)
for k,(fs,d,w,h) in docs.items():
    build(k,fs,d,w,h)
    print(k,len(fs))
