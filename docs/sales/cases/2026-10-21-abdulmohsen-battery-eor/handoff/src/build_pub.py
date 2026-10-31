import json,os,glob,shutil,datetime
os.chdir(os.path.dirname(os.path.abspath(__file__)))
shutil.rmtree('pub',ignore_errors=True); os.makedirs('pub/project')
boards={};order=[]
def add(name,x,y,w,h,title):
    boards[name+'.dc.html']={"x":x,"y":y,"w":w,"h":h,"title":title}; order.append(name+'.dc.html')
pb=json.load(open('boards_prop.json'))
ptitle=['1 · الغلاف / Cover','2 · ماذا نفعل / Scope','3 · من يتحمل ماذا / Roles','4 · رسوم التوطين / Localisation','5 · حسبة الموظف الأجنبي / Cost calc','6 · النموذج الأول / Model 1','7 · النموذج الثاني / Model 2','8 · الشروط / Terms','9 · القبول / Acceptance']
lab={'bi':'ثنائي / Bilingual','ar':'عربي','en':'English'}
for r,m in enumerate(('bi','ar','en')):
    for i,n in enumerate(pb[m]): add(n,i*2000,r*1500,1920,1080,f'عرض السعر ({lab[m]}) — '+ptitle[i])
def group(prefix,y,label,docname):
    files=sorted(os.path.basename(f)[:-8] for f in glob.glob(f'out/project/{prefix}-[0-9]*.dc.html') if 'Fees-Table' not in f)
    for i,n in enumerate(files): add(n,i*1320,y,1240,1754,f'{docname} ({label}) — {i+1}/{len(files)}')
y=4800
for pre,doc in (('CT','عقد الخدمات'),('NDA','اتفاقية عدم الإفصاح')):
    for suf,m in (('','bi'),('AR','ar'),('EN','en')):
        group(pre+suf,y,lab[m],doc); y+=2000
for n in order:
    for d in ('outp/project/','out/project/'):
        if os.path.exists(d+n):
            shutil.copy(d+n,'pub/project/'+n);break
    else: raise SystemExit('missing '+n)
cv={"v":3,"createdOnFiles":{"v":1,"at":datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},"title":"عبدالمحسن — عرض EOR وعقد واتفاقية عدم الإفصاح (مسودة 2)","launch":{"view":"canvas"},"pages":[],"boards":boards,"order":order,"notes":{},"designSystems":[]}
json.dump(cv,open('pub/project/canvas.json','w'),ensure_ascii=False)
print(len(order)); print(json.dumps(["project/"+f for f in sorted(os.listdir('pub/project')) if f!='canvas.json'],ensure_ascii=False))
