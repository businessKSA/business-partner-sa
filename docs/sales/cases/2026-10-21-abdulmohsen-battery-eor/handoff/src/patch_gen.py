import re,sys
PRELUDE = r'''
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
'''
def patch(src):
    L=src.split('\n')
    out=[]
    for i,l in enumerate(L):
        if i==0:
            out.append(l); out.append(PRELUDE); continue
        l=re.sub(r"OUT='out[np]?/project/'","OUT='outm/project/'",l)
        l=l.replace("grid-template-columns:repeat(2,minmax(0,1fr));column-gap:56px;padding:6px 0","grid-template-columns:{GC};padding:6px 0")
        l=l.replace("font-size:15px;line-height:1.45","font-size:{FE}px;line-height:1.45").replace("font-size:17px;line-height:1.6","font-size:{FA}px;line-height:1.6")
        l=l.replace("max(lines(e['t'],62)*22, lines(a['t'],54)*28)+12","ROW(e,a)")
        m=re.match(r"files\.append\(\('(\w+)-01-Cover',cover",l)
        if m: out.append("cover=COVERFIX(cover)")
        if l.startswith("    html_=head("): out.append("    inner=SEL(inner)")
        if l.startswith("rowsT="): l=l.replace("rowsT=","rowsT=ROWST(fees) if MODE!='bi' else ",1)
        if l.startswith("files.append((f'") or l.startswith("if False: files.append((f'"): out.append("inner=SEL(inner)")
        if l.startswith("for name,content,_ in files"):
            out.append("files=[(n.split('-')[0]+SUF+'-'+n.split('-',1)[1],c,t) for n,c,t in files]")
        if "open('boards.json','w')" in l:
            l=l.replace("open('boards.json','w')","open('boards_'+files[0][0].split('-')[0]+'.json','w')")
        out.append(l)
    return '\n'.join(out)
base,dst=sys.argv[1],sys.argv[2]
open(dst,'w',encoding='utf8').write(patch(open(base,encoding='utf8').read()))
