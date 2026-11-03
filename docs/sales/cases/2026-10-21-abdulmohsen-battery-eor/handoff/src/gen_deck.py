import base64,glob
def b64(p): return base64.b64encode(open(p,'rb').read()).decode()
def F(pat): return glob.glob(pat)[0]
A='x_fontsource-ibm-plex-sans-arabic-5.3.0/package/files/ibm-plex-sans-arabic-%s-%s-normal.woff2'
P='x_fontsource-playfair-display-5.3.0/package/files/playfair-display-latin-%s-normal.woff2'
M='x_fontsource-ibm-plex-mono-5.3.0/package/files/ibm-plex-mono-latin-%s-normal.woff2'
ff=''
for w in (400,600,700):
    ff+=f"@font-face{{font-family:'IBM Plex Sans Arabic';font-weight:{w};src:url(data:font/woff2;base64,{b64(A%('arabic',w))}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F}}"
    ff+=f"@font-face{{font-family:'IBM Plex Sans Arabic';font-weight:{w};src:url(data:font/woff2;base64,{b64(A%('latin',w if w!=600 else 400))}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}}" if w in (400,700) else ''
for w in (600,700): ff+=f"@font-face{{font-family:'Playfair Display';font-weight:{w};src:url(data:font/woff2;base64,{b64(P%w)}) format('woff2')}}"
ff+=f"@font-face{{font-family:'IBM Plex Mono';font-weight:500;src:url(data:font/woff2;base64,{b64(M%500)}) format('woff2')}}"
import os
LOGO=b64(os.environ['REPO']+'/site/assets/img/logo.png')
R='‏'
CSS=ff+"""
*{box-sizing:border-box;margin:0;padding:0}
@page{size:1920px 1080px;margin:0}
body{background:#fff;font-family:'IBM Plex Sans Arabic',sans-serif;color:#1B2340}
.s{width:1920px;height:1080px;position:relative;overflow:hidden;page-break-after:always;background:#F7F8FD;display:flex;flex-direction:column;padding:70px 90px 60px}
.dark{background:linear-gradient(135deg,#071442,#0B1B5A);color:#fff}
.top{display:flex;justify-content:space-between;align-items:center;height:70px}
.logo{background:#fff;border-radius:14px;padding:10px 22px;display:flex}
.logo img{height:46px}
.tag{font-family:'IBM Plex Mono';font-weight:500;font-size:22px;color:#8A93B0;letter-spacing:.06em}
.dark .tag{color:#9DB4FF}
.hd{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:34px}
.hd .ar{text-align:right;direction:rtl}.hd .en{text-align:left;direction:ltr}
h1{font-family:'Playfair Display','IBM Plex Sans Arabic',serif;font-weight:700;color:#0B1B5A}
.ar h1,.ar h2{font-family:'IBM Plex Sans Arabic';font-weight:700}
h2{font-size:54px;color:#0B1B5A;line-height:1.2;font-family:'Playfair Display';font-weight:700}
.sub{font-size:26px;color:#4A5578;margin-top:10px;line-height:1.5}
.dark h2,.dark h1{color:#fff}.dark .sub{color:#C9D5FF}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:40px;align-items:start}
.card{background:#fff;border:2px solid #DDE1EE;border-radius:22px;padding:34px 38px;min-height:420px;display:flex;flex-direction:column;gap:14px;min-height:0}
.card.fill{background:#0B1B5A;color:#fff;border-color:#0B1B5A}
.row{display:grid;grid-template-columns:1fr 1fr;gap:30px}
.ar{direction:rtl;text-align:right}.en{direction:ltr;text-align:left}
.t{font-size:40px;font-weight:700;color:#0B1B5A}.fill .t{color:#fff}
.d{font-size:31px;line-height:1.55;color:#4A5578}.fill .d{color:#C9D5FF}
.en .t{font-size:32px;color:#13246E}.en .d{font-size:26px;color:#6A7596}
.fill .en .t{color:#9DB4FF}.fill .en .d{color:#9DB4FF}
.n{font-family:'IBM Plex Mono';font-weight:500;font-size:74px;color:#1E3A9E;line-height:1}.fill .n{color:#9DB4FF}
.badge{width:64px;height:64px;border-radius:50%;background:#EEF1FB;color:#1E3A9E;font-family:'IBM Plex Mono';font-weight:500;font-size:30px;display:flex;align-items:center;justify-content:center}
.fill .badge{background:#13246E;color:#9DB4FF}
.cardhead{display:flex;align-items:center;gap:22px;flex-direction:row-reverse;justify-content:flex-start}
table{width:100%;border-collapse:collapse}
td{padding:13px 10px;border-bottom:2px solid #DDE1EE;font-size:29px;vertical-align:middle}
td.a{text-align:right;direction:rtl;width:42%}td.e{text-align:left;direction:ltr;color:#4A5578;font-size:26px;width:42%}td.p{font-family:'IBM Plex Mono';font-weight:500;color:#0B1B5A;font-size:30px;text-align:center;width:16%}
tr:nth-child(even) td{background:#F7F8FD}
.note{font-size:26px;color:#4A5578;margin-top:18px;line-height:1.5}
.foot{margin-top:auto;display:flex;justify-content:space-between;font-size:19px;color:#8A93B0;border-top:2px solid #0B1B5A;padding-top:14px}
.dark .foot{color:#9DB4FF;border-color:#9DB4FF}
.big{font-size:150px;font-family:'IBM Plex Mono';font-weight:500;color:#9DB4FF;line-height:1}
"""
def foot(): return "<div class='foot'><span>Business Partner Solutions Company · 7038825860 · VAT 312079341500003</span><span>www.businesspartner.sa · Riyadh · RHSC2978</span></div>"
def top(tag): return f"<div class='top'><div class='logo'><img src='data:image/png;base64,{LOGO}'></div><div class='tag'>{tag}</div></div>"
def card(n,ta,da,te,de,fill=False):
    return f"<div class='card{' fill' if fill else ''}'><div class='cardhead ar'><div class='badge'>{n}</div><div style='flex:1'><div class='t'>{ta}</div></div></div><div class='ar'><div class='d'>{da}</div></div><div class='en'><div class='t'>{te}</div><div class='d'>{de}</div></div></div>"
S=[]
# 1 cover
S.append(f"""<section class='s dark'>{top('QUOTATION · 18 OCT 2026')}
<div style='margin-top:150px'>
<div class='ar'><h1 style='font-size:92px;line-height:1.25'>الإقامة المميزة<br>تقييم الأهلية وتحديد المسار الأنسب{R}</h1><p class='sub' style='font-size:34px;margin-top:26px'>نراجع ملفك، ونحدّد المسار الأقرب للقبول، ثم نجهّز طلبك ونتابعه{R}</p></div>
<div class='en' style='margin-top:60px'><h1 style='font-size:58px;line-height:1.2'>Premium Residency<br>Eligibility Review and Best-Fit Route</h1><p class='sub' style='font-size:28px'>We review your profile, identify the route most likely to succeed, then prepare and follow your application.</p></div></div>
<div class='row' style='margin-top:70px'><div class='en sub' style='font-size:28px'>Prepared for: Engr. Abdul Rehman<br>Valid for 14 days</div><div class='ar sub' style='font-size:30px'>مُعَدّ للمهندس / عبدالرحمن<br>صالح لمدة 14 يوماً{R}</div></div>
{foot()}</section>""")
# 2 understanding & stages
S.append(f"""<section class='s'>{top('01 · SCOPE')}
<div class='hd'><div class='en'><h2>Your case, in two stages</h2></div><div class='ar'><h2>حالتك على مرحلتين{R}</h2></div></div>
<div class='grid'>
{card('1','المرحلة الأولى: تقييم الأهلية وتحديد المسار','نراجع مستنداتك مقابل شروط المسارات المنشورة وقت التقييم، ونعطيك تقريراً مكتوباً: هل يمكن الاستمرار في الموهبة الخاصة، وأي مسار أنسب، وما الناقص من مستنداتك{R}'.replace('{R}',R),'Stage 1: Eligibility review and route selection','We review your documents against the published route conditions and give you a written report: can Special Talent still be pursued, which route fits best, and what documents are missing.',True)}
{card('2','المرحلة الثانية: تجهيز الطلب وتقديمه ومتابعته','بعد أن تختار المسار، نجهّز ملف الطلب ونقدّمه عبر بوابة المركز ونتابعه حتى صدور القرار{R}'.replace('{R}',R),'Stage 2: Prepare, submit and follow up','Once you choose a route, we prepare the file, submit it through the Center’s portal and follow it until a decision is issued.')}
</div>
<p class='note ar'>مسارات قيد الدراسة: الموهبة الخاصة · مستثمر الأعمال عبر ملكيتك للمنشأة الأم · المسار المالي · الكفاءة الاستثنائية{R}</p>
<p class='note en'>Routes under review: Special Talent · Business Investor through your ownership of the parent entity · Financial route · Exceptional Competence</p>
{foot()}</section>""")
# 3 price
rows=[('المرحلة الأولى: تقييم الأهلية وتحديد المسار','Stage 1: Eligibility review and route selection','1,500'),('المرحلة الثانية: مسار الموهبة','Stage 2: Talent route','6,000'),('مسار مستثمر الأعمال','Business Investor route','7,500'),('المسار المالي (دائمة أو سنوية)','Financial route (permanent or annual)','6,000'),('مسار الكفاءة الاستثنائية','Exceptional Competence route','6,500'),('ضمّ أفراد الأسرة (اختياري)','Adding family members (optional)','2,500')]
tr=''.join(f"<tr><td class='a'>{a}</td><td class='p'>{p}</td><td class='e'>{e}</td></tr>" for a,e,p in rows)
S.append(f"""<section class='s'>{top('02 · PRICE')}
<div class='hd'><div class='en'><h2>Price, in SAR before VAT</h2></div><div class='ar'><h2>السعر بالريال قبل الضريبة{R}</h2></div></div>
<div class='card' style='margin-top:30px;min-height:0;padding:14px 38px'><table>{tr}</table></div>
<p class='note ar'>أتعابنا قبل ضريبة القيمة المضافة 15%. المرحلة الثانية تختار فيها مساراً واحداً بعد تقرير المرحلة الأولى. الرسوم الحكومية لمركز الإقامة المميزة منفصلة وتُدفع بالمبلغ المعلن وقت التقديم{R}</p>
<p class='note en'>Our fees, before 15% VAT. In Stage 2 you choose one route after the Stage 1 report. Premium Residency Center government fees are separate, paid at the amount announced at submission.</p>
{foot()}</section>""")
# 4 timeline & payment
S.append(f"""<section class='s'>{top('03 · TIMELINE & PAYMENT')}
<div class='hd'><div class='en'><h2>Timeline and payment</h2></div><div class='ar'><h2>المدة والدفع{R}</h2></div></div>
<div class='grid'>
{card('3','المرحلة الأولى خلال 3 أيام عمل','من استلام المستندات المطلوبة. أما المرحلة الثانية فتُحدَّد بعد اختيار المسار، وتتبع مدة القرار التي يعلنها المركز{R}'.replace('{R}',R),'Stage 1 within 3 working days','From receiving the required documents. Stage 2 is set once the route is chosen and follows the decision time the Center announces.')}
{card('%','المرحلة الأولى: 1,500 كاملة مقدماً','المرحلة الثانية: 50% عند الاعتماد و50% عند تقديم الطلب. تُرسل بيانات التحويل مع الفاتورة الضريبية بعد اعتماد العرض{R}'.replace('{R}',R),'Stage 1: SAR 1,500 in full, in advance','Stage 2: 50% on approval, 50% on submission. Bank details are sent with the tax invoice after the quotation is approved.',True)}
</div>
{foot()}</section>""")
# 5 close
S.append(f"""<section class='s dark'>{top('04 · NEXT STEP')}
<div class='hd'><div class='en'><h1 style='font-size:60px'>To start the review, please send</h1></div><div class='ar'><h1 style='font-size:64px;line-height:1.3'>للبدء في التقييم أرسل لنا{R}</h1></div></div>
<div class='row' style='margin-top:44px;font-size:30px;line-height:1.8'>
<div class='en' style='color:#C9D5FF'>1. The Center’s reply about your employer and the route you applied under<br>2. Employment contract showing total salary and job title<br>3. The Saudi company’s commercial registration and investment license status<br>4. Your share in the UAE parent entity and its link to the Saudi company<br>5. Whether the application includes your family</div>
<div class='ar' style='color:#fff'>1. ردّ المركز بشأن جهة عملك والمسار الذي قدّمت عليه{R}<br>2. عقد العمل وفيه الراتب الشامل والمسمّى الوظيفي{R}<br>3. السجل التجاري للشركة السعودية وهل لها ترخيص استثمار{R}<br>4. حصّتك في المنشأة الأم في الإمارات وعلاقتها بالشركة السعودية{R}<br>5. هل الطلب يشمل أسرتك{R}</div></div>
<p class='sub ar' style='margin-top:40px;font-size:28px'>القبول قرار مركز الإقامة المميزة وحده؛ نقيّم الأهلية ونعدّ الملف ونقدّمه ونتابعه ولا نضمن صدور الإقامة{R}</p>
<p class='sub en' style='font-size:24px'>Approval is the Premium Residency Center’s decision alone; we assess, prepare, submit and follow up, and do not guarantee issuance.</p>
{foot()}</section>""")
open('deck.html','w').write(f"<!doctype html><html><head><meta charset='utf-8'><title>Premium Residency Quotation</title><style>{CSS}</style></head><body>{''.join(S)}</body></html>")
