import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
NAVY='0B1B5A'; LIGHT='DCE6FF'; PALE='EEF2FF'
thin=Side(style='thin',color='DDE1EE'); box=Border(top=thin,bottom=thin,left=thin,right=thin)
wb=openpyxl.Workbook(); ws=wb.active; ws.title='Pricing'
ws.sheet_view.showGridLines=False
for c,w in zip('ABCD',(58,20,58,60)): ws.column_dimensions[c].width=w
ws.merge_cells('A1:D1'); ws['A1']='INTERNAL — Shared National Talent: monthly price per assignment   |   الكوادر الوطنية المشتركة — السعر الشهري لكل إسناد (داخلي)'
ws['A1'].font=Font(name='Arial',bold=True,size=13,color='FFFFFF'); ws['A1'].fill=PatternFill('solid',fgColor=NAVY); ws['A1'].alignment=Alignment(wrap_text=True,vertical='center'); ws.row_dimensions[1].height=34
def row(r,en,v,ar,how='',inp=False,bold=False,fmt=None,shade=False):
    a=ws.cell(r,1,en);b=ws.cell(r,2,v);c=ws.cell(r,3,ar);d=ws.cell(r,4,how)
    a.font=Font(name='Arial',bold=bold,size=11,color=NAVY);c.font=Font(name='Arial',bold=bold,size=11,color=NAVY);d.font=Font(name='Arial',size=9,color='6A7596')
    b.font=Font(name='Arial',bold=bold or inp,size=11,color=NAVY)
    a.alignment=Alignment(wrap_text=True,vertical='center');c.alignment=Alignment(wrap_text=True,horizontal='right',vertical='center',readingOrder=2)
    b.alignment=Alignment(horizontal='center',vertical='center');d.alignment=Alignment(wrap_text=True,vertical='center')
    for x in (a,b,c,d):
        x.border=box
        if shade:x.fill=PatternFill('solid',fgColor=PALE)
    if inp:b.fill=PatternFill('solid',fgColor=LIGHT)
    if fmt:b.number_format=fmt
    ws.row_dimensions[r].height=30
roles=['Human resources','Accounting','Marketing','Sales','Purchasing','Administrative support','Field / non-administrative','Engineering','Project management']
row(2,'Role',roles[0],'الوظيفة','Choose from the list',inp=True)
row(3,'Monthly salary, all-inclusive (SAR) — minimum 6,000',6000,'الراتب الشهري شاملاً البدلات (ريال) — الحد الأدنى 6,000','Includes transport, housing and commissions',inp=True,fmt='#,##0')
row(4,'Share of a full-time month assigned to this client (%)',50,'نسبة الشهر الكامل المسندة لهذا العميل (%)','Or enter the hours below',inp=True,fmt='0')
row(5,'Hours per month for this client (optional, overrides the share)',None,'ساعات هذا العميل شهرياً (اختياري، يغلب النسبة)','Leave empty to use the share',inp=True,fmt='0')
row(6,'Hours in a full-time month',176,'ساعات الشهر الكامل','8 hours × 22 days — assumption to confirm',inp=True,fmt='0')
row(7,'Contract term in months',12,'مدة العقد بالأشهر','',inp=True,fmt='0')
row(8,'Employer social insurance rate (%)',11.75,'نسبة التأمينات الاجتماعية على صاحب العمل (%)','Saudi employer share — assumption to confirm with GOSI',inp=True,fmt='0.00')
row(9,'Medical insurance per year per employee (SAR)',600,'التأمين الطبي سنوياً لكل موظف (ريال)','Current assumption — replace with the insurer quote',inp=True,fmt='#,##0')
row(10,'Field travel allowance per month, full-time (SAR) — non-administrative roles',0,'بدل التنقل الميداني شهرياً دوام كامل (ريال) — للوظائف غير الإدارية','Enter the amount for field roles',inp=True,fmt='#,##0')
row(11,'Our fee on top of all costs (%)',15,'نسبتنا فوق كل التكاليف (%)','Owner decision 2026-10-22',inp=True,fmt='0')
ws.cell(13,1,'Full-time monthly cost of the employee').font=Font(name='Arial',bold=True,color=NAVY)
ws.cell(13,3,'التكلفة الشهرية للموظف بدوام كامل').font=Font(name='Arial',bold=True,color=NAVY); ws.cell(13,3).alignment=Alignment(horizontal='right')
row(14,'Salary, all-inclusive','=B3','الراتب شاملاً البدلات','',fmt='#,##0.00')
row(15,'Employer social insurance','=B3*B8/100','التأمينات الاجتماعية على صاحب العمل','Salary × rate',fmt='#,##0.00')
row(16,'Medical insurance','=B9/12','التأمين الطبي','Annual ÷ 12',fmt='#,##0.00')
row(17,'End of service accrual','=B3/24','مكافأة نهاية الخدمة','Salary ÷ 24 (half a month a year for five years)',fmt='#,##0.00')
row(18,'Leave pay (21 days a year)','=B3/30*21/12','بدل الإجازة (21 يوماً)','Salary ÷ 30 × 21 ÷ 12',fmt='#,##0.00')
row(19,'Field travel allowance','=IF(B2="Field / non-administrative",B10,0)','بدل التنقل الميداني','Only for field roles',fmt='#,##0.00')
row(20,'Total full-time cost per month','=SUM(B14:B19)','إجمالي التكلفة الشهرية بدوام كامل','',bold=True,fmt='#,##0.00',shade=True)
ws.cell(22,1,'This client assignment').font=Font(name='Arial',bold=True,color=NAVY)
ws.cell(22,3,'إسناد هذا العميل').font=Font(name='Arial',bold=True,color=NAVY); ws.cell(22,3).alignment=Alignment(horizontal='right')
row(23,'Share of a full-time month applied','=IF(ISNUMBER(B5),MIN(1,B5/B6),B4/100)','النسبة المطبقة من الشهر الكامل','',fmt='0.0%')
row(24,'Cost of this assignment per month','=B20*B23','تكلفة هذا الإسناد شهرياً','',fmt='#,##0.00')
row(25,'Our fee','=B24*B11/100','رسمنا','Cost × fee %',fmt='#,##0.00')
row(26,'Monthly price excl. VAT','=MROUND(B24+B25,10)','السعر الشهري قبل الضريبة','Rounded to the nearest 10',bold=True,fmt='#,##0.00',shade=True)
row(27,'VAT 15%','=B26*0.15','ضريبة القيمة المضافة 15%','',fmt='#,##0.00')
row(28,'Monthly price incl. VAT','=B26+B27','السعر الشهري شامل الضريبة','',bold=True,fmt='#,##0.00',shade=True)
row(29,'Total for the term excl. VAT','=B26*B7','الإجمالي للمدة قبل الضريبة','',fmt='#,##0.00')
row(30,'Counts in Nitaqat for the client (indicative)','=IF(B23>=0.99,"1 Saudi",IF(B23>0,"0.5 Saudi if a real part-time contract is registered","—"))','الاحتساب في نطاقات للعميل (استرشادي)','Depends on the legal structure — to be confirmed',)
ws['B30'].alignment=Alignment(wrap_text=True,horizontal='center',vertical='center'); ws.row_dimensions[30].height=44
dv=DataValidation(type='list',formula1='"'+','.join(roles)+'"');ws.add_data_validation(dv);dv.add('B2')
dv2=DataValidation(type='decimal',operator='greaterThanOrEqual',formula1='6000');ws.add_data_validation(dv2);dv2.add('B3')
# utilisation sheet
u=wb.create_sheet('Utilisation')
u.sheet_view.showGridLines=False
for c,w in zip('ABCDE',(34,16,16,18,18)): u.column_dimensions[c].width=w
for i,h in enumerate(['Client / assignment','Share of month %','Price excl. VAT','Cost','Our fee'],1):
    x=u.cell(1,i,h);x.font=Font(name='Arial',bold=True,color='FFFFFF');x.fill=PatternFill('solid',fgColor=NAVY)
for r in range(2,8):
    u.cell(r,1).fill=PatternFill('solid',fgColor=LIGHT);u.cell(r,2).fill=PatternFill('solid',fgColor=LIGHT)
    u.cell(r,3,f'=IF(B{r}="","",MROUND(Pricing!$B$20*B{r}/100*(1+Pricing!$B$11/100),10))')
    u.cell(r,4,f'=IF(B{r}="","",Pricing!$B$20*B{r}/100)')
    u.cell(r,5,f'=IF(B{r}="","",C{r}-D{r})')
u['A9']='Total';u['B9']='=SUM(B2:B7)';u['C9']='=SUM(C2:C7)';u['D9']='=SUM(D2:D7)';u['E9']='=SUM(E2:E7)'
u['A10']='Unused capacity (cost we carry)';u['B10']='=MAX(0,100-B9)';u['D10']='=Pricing!B20*B10/100'
u['A11']='Result vs full-time cost';u['C11']='=C9-Pricing!B20'
for c in ('A9','A10','A11'): u[c].font=Font(name='Arial',bold=True,color=NAVY)
u['A13']='Fill the clients and their shares for one employee. If the shares total less than 100% the unused part is our cost; above 100% is not allowed.'
u['A13'].font=Font(name='Arial',size=9,color='6A7596')
for r in range(2,8): u.cell(r,3).number_format='#,##0.00';u.cell(r,4).number_format='#,##0.00';u.cell(r,5).number_format='#,##0.00'
for c in ('C9','D9','E9','D10','C11'): u[c].number_format='#,##0.00'
dvu=DataValidation(type='decimal',operator='between',formula1='0',formula2='100');u.add_data_validation(dvu);dvu.add('B2:B7')
wb.save('Shared-National-Talent-Pricing-INTERNAL.xlsx');print('ok')

# ---------------- Rate card ----------------
wb=openpyxl.load_workbook('Shared-National-Talent-Pricing-INTERNAL.xlsx')
rc=wb.create_sheet('Rate card',1); rc.sheet_view.showGridLines=False
fh=Font(name='Arial',bold=True,color='FFFFFF',size=10); fb=Font(name='Arial',size=10,color=NAVY); fbb=Font(name='Arial',bold=True,size=10,color=NAVY)
HF=PatternFill('solid',fgColor=NAVY); IN=PatternFill('solid',fgColor=LIGHT); SH=PatternFill('solid',fgColor=PALE)
rc.merge_cells('A1:O1'); rc['A1']='INTERNAL — Rate card: hourly price of a Saudi employee by role and utilisation   |   بطاقة الأسعار: سعر ساعة الموظف السعودي بحسب الوظيفة ونسبة الإشغال'
rc['A1'].font=Font(name='Arial',bold=True,size=13,color='FFFFFF'); rc['A1'].fill=HF; rc['A1'].alignment=Alignment(wrap_text=True,vertical='center'); rc.row_dimensions[1].height=34
# global inputs
glob=[('Hours in a full-time month (days per week × hours per day × 52 ÷ 12)','=E3*E4*52/12','0.0'),('Employer social insurance rate on basic + housing (%)',11.75,'0.00'),('Medical insurance per year (SAR)',600,'#,##0'),('Our fee on top of all costs (%)',15,'0'),('Expected billable utilisation if not stated per role (%)',70,'0'),('Mandatory development hours per month, not billable (training, courses, mentoring) — placeholder to confirm',8,'0'),('Training and development budget per year per employee (SAR) — placeholder to confirm',3000,'#,##0')]
for i,(l,v,f) in enumerate(glob,3):
    rc.cell(i,1,l).font=fb; c=rc.cell(i,2,v); c.fill=IN; c.number_format=f; c.font=fbb; c.alignment=Alignment(horizontal='center')
for r_,(l,v) in enumerate((('Working days per week',5),('Hours per day',8),('Expected variable-pay achievement (%)',100)),3):
    rc.cell(r_,4,l).font=fb; c=rc.cell(r_,5,v); c.fill=IN; c.font=fbb; c.alignment=Alignment(horizontal='center')
# table
heads=['Role','Job nature','Guaranteed package per month (SAR) = higher of 6,000 and the Ministry minimum','Basic %','Housing %','Transport and other %','Variable pay target at 100% KPI per month (SAR)','Field travel allowance per month (SAR)','Billable utilisation %','Full-time monthly cost incl. training','Billable hours per month (after development hours)','Cost per hour','Rate per hour excl. VAT','Actual utilisation at which revenue only covers cost %','Ministry minimum Saudi salary for the profession (SAR)']
HR=11
for j,h in enumerate(heads,1):
    c=rc.cell(HR,j,h); c.font=fh; c.fill=HF; c.alignment=Alignment(wrap_text=True,horizontal='center',vertical='center'); c.border=box
rc.row_dimensions[HR].height=62
roles2=[('Human resources','Fixed + efficiency KPI',6000,60,25,15,0,0,70,0),('Accounting','Administrative',6000,60,25,15,0,0,70,6000),('Marketing','Fixed + KPI',6000,60,25,15,0,0,70,5500),('Sales','Fixed + commission on sales growth',6000,60,25,15,0,0,70,0),('Purchasing','Fixed + savings and negotiation',6000,60,25,15,0,0,70,0),('Administrative support','Administrative',6000,60,25,15,0,0,70,0),('Field / non-administrative','Field',6000,60,25,15,0,0,70,0),('Engineering','Fixed + project KPI',6000,60,25,15,0,0,70,8000),('Project management','Fixed + milestones',6000,60,25,15,0,0,70,6000)]
for i,r in enumerate(roles2,HR+1):
    for j,v in enumerate(r[:9],1):
        c=rc.cell(i,j,v); c.border=box; c.font=fb
        if j>=3: c.fill=IN; c.alignment=Alignment(horizontal='center')
    mn=rc.cell(i,15,r[9]); mn.fill=IN; mn.border=box; mn.font=fb; mn.alignment=Alignment(horizontal='center')
    gp=rc.cell(i,3,f'=MAX(6000,O{i})'); gp.fill=SH; gp.number_format='#,##0'
    # computed
    c=rc.cell(i,10,f'=C{i}+(C{i}*(D{i}+E{i})/100*$B$4/100)+$B$5/12+C{i}/24+C{i}/30*21/12+G{i}*$E$5/100+H{i}+$B$9/12'); 
    c.number_format='#,##0.00'
    rc.cell(i,11,f'=MAX(0,$B$3-$B$8)*I{i}/100').number_format='0.0'
    rc.cell(i,12,f'=J{i}/K{i}').number_format='#,##0.00'
    rc.cell(i,13,f'=MROUND(L{i}*(1+$B$6/100),1)').number_format='#,##0'
    rc.cell(i,14,f'=I{i}/(1+$B$6/100)').number_format='0.0'
    for j in (10,11,12,13,14):
        x=rc.cell(i,j); x.border=box; x.font=fbb; x.fill=SH; x.alignment=Alignment(horizontal='center')
for j,w in enumerate((26,28,20,10,10,14,18,18,14,16,14,14,16,16,18),1): rc.column_dimensions[get_column_letter(j) if False else chr(64+j)].width=w
rc['A22']='How the rate is built'; rc['A22'].font=fbb
for i,t in enumerate([
 'Full-time monthly cost = guaranteed package + employer social insurance on basic and housing + medical + end of service (package ÷ 24) + leave pay (21 days) + variable pay target + field travel allowance + training budget ÷ 12.',
 'Billable hours = (hours in a full-time month − development hours) × billable utilisation. Cost per hour = full-time cost ÷ productive hours. Rate per hour = cost per hour + our fee.',
 'Lower utilisation means fewer billable hours to carry the same cost, so the hourly rate rises. If the real utilisation falls to the last column, revenue only covers cost: that is the floor to watch.',
 'Training: every employee has mandatory development hours each month and a yearly training budget; both are inside the rate, so the client buys a Saudi employee who is being trained, certified and prepared for the market, not only hours.','Package: 20 hours, 40 hours and 80 hours a month are shown on the sheet "Hour packages".','Guaranteed package = the higher of SAR 6,000 and the Ministry minimum Saudi salary for the profession (column O). Variable pay is on top of the package, never inside it: sales growth for sales, lower cost and better negotiation for purchasing, operational efficiency for human resources, and the KPI of each role.'],23):
    rc.cell(i,1,t).font=Font(name='Arial',size=9,color='6A7596')
rc.freeze_panes='B12'
# hour packages
hp=wb.create_sheet('Hour packages',2); hp.sheet_view.showGridLines=False
hp.merge_cells('A1:H1'); hp['A1']='INTERNAL — Monthly price by hours assigned   |   السعر الشهري بحسب الساعات المسندة'
hp['A1'].font=Font(name='Arial',bold=True,size=13,color='FFFFFF'); hp['A1'].fill=HF
for j,h in enumerate(['Role','Rate per hour','20 hours','40 hours','80 hours','120 hours','Full-time price (176 h at 100%)','Hours at which a package equals the full-time cost'],1):
    c=hp.cell(3,j,h); c.font=fh; c.fill=HF; c.alignment=Alignment(wrap_text=True,horizontal='center'); c.border=box
hp.row_dimensions[3].height=48
for i in range(9):
    r=4+i; src=HR+1+i
    hp.cell(r,1,f"='Rate card'!A{src}")
    hp.cell(r,2,f"='Rate card'!M{src}").number_format='#,##0'
    for j,h in zip(range(3,7),(20,40,80,120)):
        hp.cell(r,j,f"=B{r}*{h}").number_format='#,##0'
    hp.cell(r,7,f"=MROUND('Rate card'!J{src}*(1+'Rate card'!$B$6/100),10)").number_format='#,##0'
    hp.cell(r,8,f"=G{r}/B{r}").number_format='0'
    for j in range(1,9): hp.cell(r,j).border=box; hp.cell(r,j).font=fb
for j,w in enumerate((26,14,12,12,12,12,22,24),1): hp.column_dimensions[chr(64+j)].width=w
hp['A14']='Prices exclude VAT (15%). The rate per hour comes from the "Rate card" sheet and moves with the utilisation target of each role.'
hp['A14'].font=Font(name='Arial',size=9,color='6A7596')
# pay structure
ps=wb.create_sheet('Pay structure',3); ps.sheet_view.showGridLines=False
ps.merge_cells('A1:F1'); ps['A1']='INTERNAL — Pay structure by nature of work   |   هيكل الراتب بحسب طبيعة العمل'
ps['A1'].font=Font(name='Arial',bold=True,size=13,color='FFFFFF'); ps['A1'].fill=HF
for j,h in enumerate(['Job nature','Fixed part (guaranteed)','Allowances','Variable part','Performance measure (KPI)','Notes'],1):
    c=ps.cell(3,j,h); c.font=fh; c.fill=HF; c.alignment=Alignment(wrap_text=True,horizontal='center'); c.border=box
rows=[
 ('Administrative (HR, accounting, administrative support)','Basic salary + housing','Transport','None, or a quarterly bonus','Timely delivery, accuracy, client satisfaction','Fixed package; the hourly rate carries the cost.'),
 ('Human resources','Basic salary + housing','Transport','Variable pay on top of the guaranteed package','Operational efficiency of the client staff (turnover, time to hire, compliance)','Variable pay is on top, not inside the guaranteed package.'),
 ('Marketing','Basic salary + housing','Transport','Variable pay on top','Campaign results and leads','Variable pay is on top of the guaranteed package.'),
 ('Purchasing','Basic salary + housing','Transport','Variable pay on top','Reduction of purchase cost, negotiation savings, supplier performance','Variable pay is on top of the guaranteed package.'),
 ('Sales','Basic salary + housing (guaranteed ≥ 6,000 all-inclusive)','Transport','Commission on closed contracts','Growth in sales volume: contracts closed and collected revenue','Commission is on top of the guaranteed package; its expected value is included in the hourly rate (column G of the Rate card).'),
 ('Field (non-administrative)','Basic salary + housing','Transport + field travel allowance','Optional','Visits completed, report quality','Field travel allowance is charged only for field roles.'),
 ('Project-based','Basic salary + housing','Transport','Milestone payment','Milestones delivered on time and on scope','Price by project with a fixed scope; the milestone payment is part of the project price.'),
]
for i,r in enumerate(rows,4):
    for j,v in enumerate(r,1):
        c=ps.cell(i,j,v); c.alignment=Alignment(wrap_text=True,vertical='top'); c.font=fb; c.border=box
    ps.row_dimensions[i].height=62
for j,w in enumerate((34,32,26,28,40,52),1): ps.column_dimensions[chr(64+j)].width=w
ps['A10']='Rules that do not change: the guaranteed package is at least SAR 6,000 all-inclusive; every employee has a real contract, real work and registered social insurance; variable pay is never a substitute for the guaranteed package.'
ps['A10'].font=Font(name='Arial',size=9,color='6A7596')

dp=wb.create_sheet('Development plan',4); dp.sheet_view.showGridLines=False
dp.merge_cells('A1:E1'); dp['A1']='INTERNAL — Development plan for every Saudi employee   |   خطة التطوير لكل موظف سعودي'
dp['A1'].font=Font(name='Arial',bold=True,size=13,color='FFFFFF'); dp['A1'].fill=HF
for j,h in enumerate(['Component','What it is','When','Evidence kept','Counts toward the monthly development hours'],1):
    c=dp.cell(3,j,h); c.font=fh; c.fill=HF; c.alignment=Alignment(wrap_text=True,horizontal='center'); c.border=box
dd=[('Onboarding and role standards','Real job description, tools, client rules, confidentiality','First month','Signed job description','Yes'),
    ('Professional courses','Courses and certificates matched to the role; accredited where the Ministry guide requires it (for example SOCPA for accounting)','Every quarter, mandatory','Certificate or attendance record','Yes'),
    ('Mentoring and supervision','Weekly review with a senior manager, feedback on real deliverables','Weekly','Review notes','Yes'),
    ('Performance review','KPIs by job nature (see Pay structure), reviewed monthly and quarterly','Monthly and quarterly','Scorecard','Yes'),
    ('Market readiness','CV, interview skills, portfolio of delivered work, introductions to employers','Ongoing','Portfolio file','Yes'),
    ('Empowerment path (phase 2, postponed)','Support to build ventures and introductions to incubators and funds','Later','Decision of the owner','—')]
for i,r in enumerate(dd,4):
    for j,v in enumerate(r,1):
        c=dp.cell(i,j,v); c.alignment=Alignment(wrap_text=True,vertical='top'); c.font=fb; c.border=box
    dp.row_dimensions[i].height=58
for j,w in enumerate((34,60,24,28,26),1): dp.column_dimensions[chr(64+j)].width=w
dp['A11']='Integrity rules: every assignment has real work with a client deliverable, a timesheet and a signed scope; no employee is registered without actual work; training and work records are kept for each employee and can be shown to the Ministry.'
dp['A11'].font=Font(name='Arial',size=9,color='6A7596')
wb.save('Shared-National-Talent-Pricing-INTERNAL.xlsx'); print('rate card ok')
