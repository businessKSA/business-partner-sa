import re,os,sys,glob,base64
HERE=os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
src=open('gen_deck.py').read().split("S=[]")[0]
exec(src)
os.chdir(HERE)
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
O='out/project'
def lst(prefix):
    fs=sorted(os.path.basename(f)[:-8] for f in glob.glob(f'{O}/{prefix}-[0-9]*.dc.html'))
    return [f for f in fs if 'Fees-Table' not in f]
docs={}

P='outp/project'
import json as _j
_B=_j.load(open('boards_prop.json'))
# bilingual PDF = Arabic slides, then English slides (same order), then one stacked bilingual acceptance page to sign
docs['Proposal-Bilingual']=(_B['en'][:-2]+_B['ar'][:-2]+[_B['bi'][-2],_B['bi'][-1]],P,1920,1080)
docs['Proposal-AR']=(_B['ar'],P,1920,1080)
docs['Proposal-EN']=(_B['en'],P,1920,1080)
for nm,pre in (('NDA','NDA'),('Service-Agreement-M1-Transparent-Cost','CT1'),('Service-Agreement-M2-Full-Employee-Cost','CT2')):
    for suf,lab in (('','Bilingual'),('AR','AR'),('EN','EN')):
        docs[f'{nm}-{lab}']=(lst(pre+suf),O,1240,1754)
docs['Company-Profile']=(['PROF-1-Cover','PROF-2-AR','PROF-3-EN','PROF-4-Details'],P,1920,1080)
for k,(fs,d,w,h) in docs.items():
    build(k,fs,d,w,h)
    print(k,len(fs))
