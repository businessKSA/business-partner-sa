import json,base64,sys,pathlib
d=pathlib.Path(__file__).parent
s=(d/"template.html").read_text(encoding="utf-8"); s=s.replace(">v128<",">"+__import__("datetime").datetime.utcnow().strftime("%m%d-%H%M")+"<"); j=(d/"data.json").read_text(encoding="utf-8")
tr=json.dumps(json.loads((d/"i18n-fr-zh.json").read_text(encoding="utf-8")),ensure_ascii=False)
logo="data:image/png;base64,"+base64.b64encode((d/"logo700.png").read_bytes()).decode()
fz=(d/"fawaz.json").read_text(encoding="utf-8") if (d/"fawaz.json").exists() else "null"
for name,client,demo,fawaz in (("index.html","false","false","null"),("index-client.html","true","false","null"),("index-demo.html","true","true","null"),("index-fawaz.html","true","true",fz)):
    (d/name).write_text(("" if True else "")+s.replace("__DATA__",j).replace("__TR__",tr).replace("__MODESEL__","false").replace("__FZ__","null").replace("__WEB__","false").replace("__CLIENT__",client).replace("__DEMO__",demo).replace("__FAWAZ__",fawaz).replace("__LOGO__",logo),encoding="utf-8")
print("built 4")

import re
for name,t in (("index-demo.html","حاسبة التعاقد والتوطين — ديمو"),("index-fawaz.html","ديمو سليمان الفواز — حاسبة التعاقد والتوطين")):
    p=d/name; x=p.read_text(encoding="utf-8"); x=re.sub(r"<title>[^<]*</title>","<title>"+t+"</title>",x,count=1); p.write_text(x,encoding="utf-8")

# نسخة الويب العامة: نسخة العميل بلا أي تسعير (قرار المالك). تُجرَّد دوال التسعير وأرقام الهامش.
import subprocess,json as _j
dj=_j.loads(j)
for row in dj["prof"]: row[2]=0
jw=_j.dumps(dj,ensure_ascii=False)
w=s.replace("__MODESEL__","false").replace("__FZ__","null").replace("__DATA__",jw).replace("__TR__",tr).replace("__WEB__","true").replace("__CLIENT__","true").replace("__DEMO__","false").replace("__FAWAZ__","null").replace("__LOGO__",logo)
w=w.replace("fee:{overhead:500,pct:10,loc:'Yes',p9:20,p6:30,p3:40,pS:100},","fee:{overhead:0,pct:0,loc:'No',p9:0,p6:0,p3:0,pS:0},")
w=w.replace("if(p[1]==='Standard'&&p[2]===500) p[2]=900;","p[2]=0;").replace("'Standard',900,","'Standard',0,")
(d/"index-web.html").write_text(w,encoding="utf-8")
print(subprocess.run(["node",str(d/"strip_web.js"),str(d/"index-web.html")],capture_output=True,text=True).stdout)

# نسخة موحّدة واحدة للنشر كأرتيفاكت: كل الأوضاع بمبدّل داخلي (عميل/ديمو/سليمان/مالك)
u=s.replace("__DATA__",j).replace("__TR__",tr).replace("__WEB__","false").replace("__MODESEL__","true").replace("__FZ__",fz).replace("__CLIENT__","true").replace("__DEMO__","false").replace("__FAWAZ__","null").replace("__LOGO__",logo)
(d/"index-all.html").write_text(u,encoding="utf-8")
print("built index-all.html")
