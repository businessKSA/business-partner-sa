import json, openpyxl, sys
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

import os
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calcdata') + '/'
INTERNAL = len(sys.argv) > 1 and sys.argv[1] == 'internal'
TRANSPARENT = len(sys.argv) > 1 and sys.argv[1] == 'transparent'
OUT = H + 'calc/' + ('BP-Calculators-INTERNAL.xlsx' if INTERNAL else ('BP-Calculators-Transparent.xlsx' if TRANSPARENT else 'BP-Calculators.xlsx'))

NAVY = '0B1B5A'; LIGHT = 'DCE6FF'; PALE = 'EEF2FF'; GREY = '6A7596'
f_title = Font(name='Arial', bold=True, size=13, color='FFFFFF')
f_b = Font(name='Arial', bold=True, size=11, color=NAVY)
f_n = Font(name='Arial', size=11, color='1B2340')
f_s = Font(name='Arial', size=9, color=GREY)
fill_h = PatternFill('solid', fgColor=NAVY)
fill_in = PatternFill('solid', fgColor=LIGHT)
fill_p = PatternFill('solid', fgColor=PALE)
thin = Side(style='thin', color='DDE1EE')
box = Border(top=thin, bottom=thin, left=thin, right=thin)
wrap = Alignment(wrap_text=True, vertical='center')
ctr = Alignment(horizontal='center', vertical='center', wrap_text=True)
rtl = Alignment(horizontal='right', vertical='center', wrap_text=True, readingOrder=2)
NUM = '#,##0.00'

wb = openpyxl.Workbook()

# ---------- data ----------
guides = json.load(open(H + 'hrsd/guides.json', encoding='utf8'))
src = openpyxl.load_workbook(H + 'hrsd/HRSD-Localization-Guides-Complete.xlsx')
summ = {r[0]: r for r in src['ملخص الأدلة'].iter_rows(min_row=2, values_only=True)}
occ = [r for r in src['المهن بالتفصيل'].iter_rows(min_row=2, values_only=True) if r[3]]
FEE = {'عادية': 500, 'إدارية (2,000)': 2000, 'فنية (1,500)': 1500, 'هندسية (3,000)': 3000}
def cat(c):
    if c.startswith('إدارية'): return 'Administrative'
    if c.startswith('فنية'): return 'Technical'
    if c.startswith('هندسية'): return 'Engineering'
    if c.startswith('مقصورة'): return 'Saudi-only'
    return 'On request'
FEE_BY_CAT = {'Standard': 900, 'Administrative': 2000, 'Technical': 1500, 'Engineering': 3000}
rows_p = [('أي مهنة أخرى بلا قرار توطين · Any other profession', 'أي مهنة أخرى', 'لا يوجد دليل', 'No localisation guide', 0, 0, 0, 'Standard', 900, 'Standard fee', '')]
seen = set()
guide_by_id = {g['id']: g for g in guides}
for o in occ:
    gid = o[0]; s = summ.get(gid)
    key = f"{o[3]} · {o[1]}"
    if key in seen: continue
    seen.add(key)
    g = guide_by_id.get(gid, {})
    c = cat(o[5])
    fee = FEE_BY_CAT.get(c) or {'Administrative': 2000, 'Technical': 1500, 'Engineering': 3000}.get(c)
    rows_p.append((key, o[3], o[1], g.get('nameEn', ''), o[4], s[6] if s else None, (s[7] if s and s[7] else 0), c, fee, (s[11] if s and s[11] else ''), (s[8] if s and s[8] else '')))

NP_LATE = len(rows_p) + 1
def locfee(P, Q, SD):
    """Localisation fee per foreign employee per month: flat 900 for professions without a decision;
    otherwise cost of the Saudis still required (ratio r/(1-r) x foreigners, less Saudis already employed) / foreigners."""
    ix = lambda col: f'INDEX(Professions!${col}$2:${col}${NP_LATE},MATCH({P},Professions!$A$2:$A${NP_LATE},0))'
    q = f'MAX(1,{Q})'
    return (f'=IFERROR(IF(OR({ix("H")}="Saudi-only",{ix("H")}="On request"),0,IF(OR({ix("H")}="Standard",{ix("M")}=0),N({ix("I")})*MAX(0,{q}-({SD}))/{q},'
            f'ROUND(MAX(0,ROUNDUP(ROUND({ix("M")}*{q},6),0)-({SD}))*{ix("L")}/{q}/10,0)*10)),0)')
FEE_FORMULA = locfee('B5', '1', '0')
FEE_FORMULA_C = FEE_FORMULA.replace('B5','B7')
nit = json.load(open(H + 'nitaqat_const.json', encoding='utf8'))

def hdr(ws, row, vals, cols=None):
    for i, v in enumerate(vals, 1):
        c = ws.cell(row, i, v); c.font = Font(name='Arial', bold=True, color='FFFFFF', size=10)
        c.fill = fill_h; c.alignment = ctr

def title(ws, text_en, text_ar):
    ws.merge_cells('A1:C1')
    ws['A1'] = text_en + '   |   ' + text_ar
    ws['A1'].font = f_title; ws['A1'].fill = fill_h; ws['A1'].alignment = wrap
    ws.row_dimensions[1].height = 34
    ws.column_dimensions['A'].width = 58; ws.column_dimensions['B'].width = 20; ws.column_dimensions['C'].width = 58
    ws.sheet_view.showGridLines = False

def row(ws, r, en, val, ar, inp=False, bold=False, fmt=None, shade=False):
    a = ws.cell(r, 1, en); b = ws.cell(r, 2, val); c = ws.cell(r, 3, ar)
    a.font = f_b if bold else f_n; c.font = f_b if bold else f_n
    b.font = Font(name='Arial', bold=True if (bold or inp) else False, size=11, color=NAVY)
    a.alignment = wrap; c.alignment = rtl; b.alignment = ctr
    for x in (a, b, c):
        x.border = box
        if shade: x.fill = fill_p
    if inp: b.fill = fill_in
    if fmt: b.number_format = fmt
    ws.row_dimensions[r].height = 30
    return b

def note(ws, r, en, ar, h=48):
    ws.cell(r, 1, en).font = f_s; ws.cell(r, 1).alignment = wrap
    ws.cell(r, 3, ar).font = f_s; ws.cell(r, 3).alignment = rtl
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=1)
    ws.row_dimensions[r].height = h

# ---------- Rates (price table, Model 2) ----------
PXL = 'IF(B4>=12,0,IF(B4>=9,0.2,IF(B4>=6,0.3,IF(B4>=3,0.4,1))))'
PREM = lambda n: 0 if n >= 12 else 0.2 if n >= 9 else 0.3 if n >= 6 else 0.4 if n >= 3 else 1.0
def price(a, n):
    return (a * (1 + PREM(n)) + (9700 + 650 + 276) / 12 + 600 / 12 + (a / 30 * 21) / 12 + 200 / 12 + 3000 / n + a / 2 / 12 + a * 0.02 + 1500 / 12 + 500) * (1 + 0.1)

# ---------- 0. Start ----------
ws0 = wb.active; ws0.title = 'Start'
title(ws0, 'Business Partner — Employee Cost & Localisation Calculators', 'بزنس بارتنر — حاسبات تكلفة الموظف والتوطين')
ws0.column_dimensions['A'].width = 58; ws0.column_dimensions['C'].width = 58
lines = [
 ('How to use', 'طريقة الاستخدام'),
 ('Change only the light-blue cells. Everything else is calculated.', 'غيّر الخانات الزرقاء الفاتحة فقط. كل شيء آخر يُحسب تلقائياً.'),
 ('Sheet "Full employee cost": one fixed monthly price per employee (Model 2), for 12, 24 or 36 months.', 'ورقة «Full employee cost»: سعر شهري ثابت لكل موظف (النموذج الثاني) لمدة 12 أو 24 أو 36 شهراً.'),
 ('Sheet "Transparent cost": monthly invoice at actual cost plus our fees (Model 1), in annual terms of 12, 24 or 36 months.', 'ورقة «Transparent cost»: فاتورة شهرية بالتكلفة الفعلية زائد رسوم التوطين (النموذج الأول).'),
 ('Sheet "Profession calculator": the localisation ratio, minimum Saudi salary, Saudis required and our fee for each profession.', 'ورقة «Profession calculator»: نسبة التوطين وأقل راتب للسعودي وعدد السعوديين المطلوب ورسمنا لكل مهنة.'),
 ('Sheet "Nitaqat calculator": the four Nitaqat bands, Saudis required, foreigners the total can carry and the shortfall for your activity group.', 'ورقة «Nitaqat calculator»: النطاقات الأربعة وعدد السعوديين المطلوب والأجانب الذين يتحملهم الإجمالي والنقص لمجموعة نشاطك.'),
 *([('Sheets "Insurance" and "Recruitment": estimated medical insurance by nationality, sex, age and class, and recruitment cost by country, profession and certificates. Both feed the price sheets.', 'ورقتا «Insurance» و«Recruitment»: التأمين الطبي المتوقع بحسب الجنسية والجنس والعمر والفئة، وتكلفة الاستقدام بحسب الدولة والمهنة والشهادات. وتغذيان ورقتي الأسعار.')] if TRANSPARENT else []),
 ('Prices exclude VAT unless stated. VAT is 15%; government fees carry no VAT.', 'الأسعار قبل الضريبة ما لم يُذكر غير ذلك. الضريبة 15%، والرسوم الحكومية بلا ضريبة.'),
 ('Results are indicative. The signed proposal and agreement govern. Official amounts follow the schedules in force at the time of payment.', 'النتائج استرشادية، والعرض والعقد الموقّعان هما المرجع. والمبالغ الرسمية بحسب الجداول السارية وقت السداد.'),
 ('Business Partner Solutions Company · CR 7038825860 · www.businesspartner.sa', 'شركة بزنس بارتنر سلوشنز · س.ت 7038825860 · www.businesspartner.sa'),
]
for i, (e, a) in enumerate(lines, 3):
    c1 = ws0.cell(i, 1, e); c3 = ws0.cell(i, 3, a)
    c1.font = f_b if i == 3 else f_n; c3.font = f_b if i == 3 else f_n
    c1.alignment = wrap; c3.alignment = rtl; ws0.row_dimensions[i].height = 44 if i > 3 else 24

# ---------- Rates ----------
wr = wb.create_sheet('Rates')
wr['A1'] = 'Total monthly package (SAR)'
for j, n in enumerate((12, 24, 36)): wr.cell(1, 2 + j, n)
pk = list(range(1000, 20001, 1000))
for i, a in enumerate(pk, 2):
    wr.cell(i, 1, a)
    for j, n in enumerate((12, 24, 36)):
        wr.cell(i, 2 + j, round(price(a, n), 8))
hdr(wr, 1, ['Total monthly package (SAR)', 12, 24, 36])
RL = len(pk) + 1
wr.column_dimensions['A'].width = 30
for col in 'BCD': wr.column_dimensions[col].width = 18
wr['G1'] = 'Monthly price excl. VAT by contract term in months (reference table used by the Full employee cost sheet).'
wr['G1'].font = f_s
wr.sheet_state = 'visible'

# ---------- Fees ----------
wf = wb.create_sheet('Fees')
hdr(wf, 1, ['Category', 'Fee per month excl. VAT (SAR)', 'Notes', 'Professional accreditation'])
fees_rows = [('None', 0, 'No localisation fee'), ('Standard', 900, 'Profession without a localisation decision'),
             ('Administrative', 2000, 'Purchasing, sales, marketing, accounting'),
             ('Technical', 1500, 'Technical engineering professions'),
             ('Engineering', 3000, 'Engineering professions')]
for i, r in enumerate(fees_rows, 2):
    for j, v in enumerate(r, 1): wf.cell(i, j, v)
wf.column_dimensions['A'].width = 20; wf.column_dimensions['B'].width = 30; wf.column_dimensions['C'].width = 50

# ---------- Full employee cost ----------
ws = wb.create_sheet('Full employee cost', 1)
title(ws, 'Foreign employee — monthly price (Model 2: full employee cost)', 'الموظف الأجنبي — السعر الشهري (النموذج الثاني: تكلفة الموظف الكاملة)')
note(ws, 2, 'Change the light-blue cells only.', 'غيّر الخانات الزرقاء الفاتحة فقط.', 20)
row(ws, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', inp=True, fmt='#,##0')
row(ws, 4, 'Contract term in months (12, 24 or 36)', 12, 'مدة العقد بالأشهر (12 أو 24 أو 36)', inp=True)
row(ws, 5, 'Profession (localisation fee is added on top)', rows_p[0][0], 'المهنة (رسوم التوطين تُضاف فوق السعر)', inp=True)
row(ws, 6, 'External recruitment costs, total actual (SAR) — 0 if the employee is already in the Kingdom', 0, 'تكاليف الاستقدام من الخارج الفعلية الإجمالية (ريال) — 0 إن كان الموظف داخل المملكة', inp=True, fmt=NUM)
row(ws, 7, 'Contracts and attestation costs, total actual (SAR)', 0, 'تكاليف العقود والتصديق الفعلية الإجمالية (ريال)', inp=True, fmt=NUM)
row(ws, 8, 'Arrival ticket, total actual (SAR)', 2000, 'تذكرة القدوم الفعلية (ريال)', inp=True, fmt=NUM)
EXTRA = '(B6+B7+B8)/B4*1.1'
if INTERNAL:
    ex = '(B3*(1+'+PXL+')+(9700+650+276)/12+600/12+(B3/30*21)/12+200/12+3000/B4+B3/2/12+B3*2%+1500/12+500+(B6+B7+B8)/B4)*(1+0.1)'
    row(ws, 9, 'Monthly price before localisation, excl. VAT (SAR)', '=MROUND(' + ex + ',10)', 'السعر الشهري قبل التوطين قبل الضريبة (ريال)', bold=True, fmt=NUM)
    row(ws, 10, 'Cost before the 10% (INTERNAL)', '=(B3*(1+'+PXL+')+(9700+650+276)/12+600/12+(B3/30*21)/12+200/12+3000/B4+B3/2/12+B3*2%+1500/12+500+(B6+B7+B8)/B4)', 'التكلفة قبل الـ10% (داخلي)', fmt=NUM)
    row(ws, 11, 'Localisation fee per month, added on top (SAR)', FEE_FORMULA, 'رسوم التوطين شهرياً تُضاف فوق السعر (ريال)', fmt=NUM)
    o = 11
else:
    row(ws, 9, 'Monthly price before localisation, excl. VAT (SAR)',
        f'=MROUND(FORECAST(B3,INDEX(Rates!$B$2:$D${RL},0,MATCH(B4,Rates!$B$1:$D$1,0)),Rates!$A$2:$A${RL})+{EXTRA},10)',
        'السعر الشهري قبل التوطين قبل الضريبة (ريال)', bold=True, fmt=NUM)
    row(ws, 10, 'Localisation fee per month, added on top (SAR)', FEE_FORMULA, 'رسوم التوطين شهرياً تُضاف فوق السعر (ريال)', fmt=NUM)
    o = 10
row(ws, o + 1, 'Monthly price incl. localisation fee, excl. VAT (SAR)', f'=B9+B{o}', 'السعر الشهري شامل رسوم التوطين قبل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(ws, o + 2, 'VAT 15% (SAR)', f'=B{o+1}*0.15', 'ضريبة القيمة المضافة 15% (ريال)', fmt=NUM)
row(ws, o + 3, 'Monthly price incl. VAT (SAR)', f'=B{o+1}+B{o+2}', 'السعر الشهري شامل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(ws, o + 4, 'Total for the term excl. VAT (SAR)', f'=B{o+1}*B4', 'الإجمالي للمدة قبل الضريبة (ريال)', fmt=NUM)
row(ws, o + 5, 'Two months in advance excl. VAT (SAR)', f'=B{o+1}*2', 'شهران مقدماً قبل الضريبة (ريال)', fmt=NUM)
r0 = o + 7
ws.cell(r0, 1, 'Same package by term — monthly price excl. VAT').font = f_b
ws.cell(r0, 3, 'نفس الراتب بحسب المدة — السعر الشهري قبل الضريبة').font = f_b; ws.cell(r0, 3).alignment = rtl
for k, (n, col) in enumerate(((12, 'B'), (24, 'C'), (36, 'D'))):
    if not INTERNAL:
        base = f'MROUND(FORECAST($B$3,Rates!${col}$2:${col}${RL},Rates!$A$2:$A${RL})+(B6+B7+B8)/{n}*1.1,10)'
    else:
        base = f'MROUND((B3*(1+{PREM(n)})+(9700+650+276)/12+600/12+(B3/30*21)/12+200/12+3000/{n}+B3/2/12+B3*2%+1500/12+500+(B6+B7+B8)/{n})*(1+0.1),10)'
    row(ws, r0 + 1 + k, f'{n} months', f'={base}+B{o}', f'{n} أشهر' if n == 6 else f'{n} شهراً', fmt=NUM)
note(ws, r0 + 5, 'The monthly price covers salary and allowances, work permit and levy, residency, medical and social insurance, end of service, leave pay, tickets and exit and re-entry visa, transfer, visa and recruitment costs, contracts and attestation, and our service fee. The price changes with the term because transfer and visa fees are spread over the contract months. The localisation fee is added on top of the price and follows the profession (see "Profession calculator"); Saudi-only professions are not transferred and professions outside our approved categories are quoted on request.',
     'السعر الشهري يشمل الراتب والبدلات، ورخصة العمل والمقابل المالي، والإقامة، والتأمين الطبي والاجتماعي، ومكافأة نهاية الخدمة، وبدل الإجازة، وتذاكر الطيران والخروج والعودة، وتكاليف النقل والتأشيرة والاستقدام، والعقود والتصديق، ورسم خدمتنا. ويتغير السعر بتغير المدة لأن رسوم النقل والتأشيرة تُقسَّم على أشهر العقد. وتُضاف رسوم التوطين فوق السعر بحسب المهنة (انظر «Profession calculator»)، والمهن المقصورة على السعوديين لا يُنقل إليها أجنبي، والمهن خارج فئاتنا المعتمدة تُحدَّد عند الطلب.', 110)
dv = DataValidation(type='list', formula1='"12,24,36"', allow_blank=False); ws.add_data_validation(dv); dv.add('B4')
dv2 = DataValidation(type='list', formula1='=Professions!$A$2:$A$%d' % NP_LATE, allow_blank=False); ws.add_data_validation(dv2); dv2.add('B5')
dv3 = DataValidation(type='decimal', operator='greaterThan', formula1='0'); ws.add_data_validation(dv3); dv3.add('B3')

# ---------- Transparent cost ----------
wc = wb.create_sheet('Transparent cost', 2)
title(wc, 'Foreign employee — monthly invoice (Model 1: cost plus)', 'الموظف الأجنبي — الفاتورة الشهرية (النموذج الأول: التكلفة بشفافية)')
note(wc, 2, 'Change the light-blue cells only. Items that do not apply (for example recruitment from abroad for an employee already in the Kingdom) stay at 0.', 'غيّر الخانات الزرقاء الفاتحة فقط. والبنود التي لا تنطبق (مثل الاستقدام من الخارج لموظف داخل المملكة) اتركها 0.', 34)
row(wc, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', inp=True, fmt='#,##0')
row(wc, 4, 'Contract term in months (12, 24 or 36)', 12, 'مدة العقد بالأشهر (12 أو 24 أو 36)', inp=True)
row(wc, 5, 'Medical insurance per month (SAR) — per insurer quote by age, class and gender', 0, 'التأمين الطبي شهرياً (ريال) — حسب عرض شركة التأمين: العمر والفئة والجنس', inp=True, fmt=NUM)
row(wc, 6, 'Transfer and visa fees, total actual (SAR)', 3000, 'رسوم النقل والتأشيرة الفعلية الإجمالية (ريال)', inp=True, fmt=NUM)
row(wc, 7, 'Profession (our localisation fee)', rows_p[0][0], 'المهنة (رسوم التوطين لدينا)', inp=True)
row(wc, 8, 'Return flight ticket per year (SAR)', 1500, 'تذكرة الطيران (العودة) سنوياً (ريال)', inp=True, fmt=NUM)
row(wc, 9, 'Exit and re-entry visa per year (SAR)', 200, 'تأشيرة الخروج والعودة سنوياً (ريال)', inp=True, fmt=NUM)
row(wc, 10, 'External recruitment costs, total actual (SAR)', 0, 'تكاليف الاستقدام من الخارج الفعلية الإجمالية (ريال)', inp=True, fmt=NUM)
row(wc, 11, 'Contracts and attestation costs, total actual (SAR)', 0, 'تكاليف العقود والتصديق الفعلية الإجمالية (ريال)', inp=True, fmt=NUM)
row(wc, 12, 'Arrival ticket, total actual (SAR)', 2000, 'تذكرة القدوم الفعلية (ريال)', inp=True, fmt=NUM)
wc.cell(13, 1, 'Costs at actual — no VAT').font = f_b
wc.cell(13, 3, 'التكاليف بالتكلفة الفعلية — بلا ضريبة').font = f_b; wc.cell(13, 3).alignment = rtl
items = [
 ('Salary', '=B3', 'الراتب'),
 ('Work permit and levy (9,600 + 100 = SAR 9,700 per year ÷ 12)', '=(9600+100)/12', 'رخصة العمل والمقابل المالي (9,600 + 100 = 9,700 ريال سنوياً ÷ 12)'),
 ('Residency (SAR 650 per year ÷ 12)', '=650/12', 'الإقامة (650 ريالاً سنوياً ÷ 12)'),
 ('Social insurance, foreign (2% of salary)', '=B3*0.02', 'التأمينات الاجتماعية للأجنبي (2% من الراتب)'),
 ('End of service accrual (salary ÷ 24)', '=B3/24', 'استحقاق نهاية الخدمة (الأجر ÷ 24)'),
 ('Leave pay (21 days a year)', '=B3/30*21/12', 'بدل الإجازة (21 يوماً في السنة)'),
 ('Medical insurance', '=B5', 'التأمين الطبي'),
 ('Transfer and visa fees (total ÷ months)', '=B6/B4', 'رسوم النقل والتأشيرة (الإجمالي ÷ الأشهر)'),
 ('Return flight ticket (per year ÷ 12)', '=B8/12', 'تذكرة الطيران (العودة) (سنوياً ÷ 12)'),
 ('Exit and re-entry visa (per year ÷ 12)', '=B9/12', 'تأشيرة الخروج والعودة (سنوياً ÷ 12)'),
 ('External recruitment costs (total ÷ months)', '=B10/B4', 'تكاليف الاستقدام من الخارج (الإجمالي ÷ الأشهر)'),
 ('Contracts and attestation (total ÷ months)', '=B11/B4', 'العقود والتصديق (الإجمالي ÷ الأشهر)'),
 ('Arrival ticket (total ÷ months)', '=B12/B4', 'تذكرة القدوم (الإجمالي ÷ الأشهر)'),
]
for i, (e, v, a) in enumerate(items, 14): row(wc, i, e, v, a, fmt=NUM)
last = 14 + len(items) - 1
row(wc, last + 1, 'Total costs at actual (no VAT)', f'=SUM(B14:B{last})', 'إجمالي التكاليف بالفعلي (بلا ضريبة)', bold=True, fmt=NUM, shade=True)
row(wc, last + 2, 'Our localisation fee, excl. VAT', FEE_FORMULA_C, 'رسوم التوطين لدينا قبل الضريبة', fmt=NUM)
row(wc, last + 3, 'VAT 15% on our fee only', f'=B{last+2}*0.15', 'ضريبة 15% على رسمنا فقط', fmt=NUM)
row(wc, last + 4, 'Total monthly invoice (SAR)', f'=B{last+1}+B{last+2}+B{last+3}', 'إجمالي الفاتورة الشهرية (ريال)', bold=True, fmt=NUM, shade=True)
row(wc, last + 5, 'Total for the term (SAR)', f'=B{last+4}*B4', 'الإجمالي للمدة (ريال)', fmt=NUM)
row(wc, last + 6, 'Two months in advance (SAR)', f'=B{last+4}*2', 'شهران مقدماً (ريال)', fmt=NUM)
note(wc, last + 7, 'Each item is invoiced separately at actual cost; government fees carry no VAT and VAT applies only to our fee. One-off items (transfer, recruitment, attestation, arrival ticket) are spread over the contract months, so the monthly share changes with the term. Medical insurance follows the insurer quote.',
     'كل بند يُفوتر منفصلاً بالتكلفة الفعلية؛ والرسوم الحكومية بلا ضريبة والضريبة على رسمنا فقط. والبنود لمرة واحدة (النقل والاستقدام والتصديق وتذكرة القدوم) تُقسَّم على أشهر العقد فتتغير حصتها الشهرية بالمدة. والتأمين الطبي حسب عرض شركة التأمين.', 80)
dv_c = DataValidation(type='list', formula1='"12,24,36"'); wc.add_data_validation(dv_c); dv_c.add('B4')
dv_c2 = DataValidation(type='list', formula1='=Professions!$A$2:$A$%d' % NP_LATE); wc.add_data_validation(dv_c2); dv_c2.add('B7')

# ---------- Professions ----------
wp = wb.create_sheet('Professions')
hdr(wp, 1, ['Profession · guide', 'Profession', 'Guide (Arabic)', 'Guide (English)', 'Ratio %', 'Min workers', 'Min Saudi salary (SAR)', 'Category', 'Fee per month excl. VAT (SAR)', 'Notes', 'Professional accreditation', 'Cost of one Saudi per month (SAR)', 'Saudis required per foreigner'])
for i, r in enumerate(rows_p, 2):
    for j, v in enumerate(r, 1): wp.cell(i, j, v)
NP = len(rows_p) + 1
for i in range(2, NP + 1):
    wp.cell(i, 12, f'=IF(G{i}>0,G{i},4000)+MIN(45000,IF(G{i}>0,G{i},4000)*0.85)*(0.1275+0.1075)+IF(G{i}>0,G{i},4000)/24+IF(G{i}>0,G{i},4000)/30*21/12')
    wp.cell(i, 13, f'=IF(AND(E{i}>0,E{i}<100),(E{i}/100)/(1-E{i}/100),0)')
    wp.cell(i, 12).number_format = '#,##0.00'; wp.cell(i, 13).number_format = '0.0000'
for col, w in zip('ABCDEFGHIJK', (60, 34, 34, 28, 10, 12, 18, 16, 22, 60, 40)): wp.column_dimensions[col].width = w
wp.freeze_panes = 'B2'

# ---------- Profession calculator ----------
wl = wb.create_sheet('Profession calculator', 3)
title(wl, 'Localisation and minimum salary by profession', 'حاسبة توطين المهن وأقل راتب')
note(wl, 2, 'Choose the profession in B3, then enter the Saudis and foreigners in that profession. Change the light-blue cells only.', 'اختر المهنة في B3 ثم أدخل عدد السعوديين والأجانب في هذه المهنة. غيّر الخانات الزرقاء الفاتحة فقط.', 22)
row(wl, 3, 'Profession · guide (choose from the list)', rows_p[0][0], 'المهنة · الدليل (اختر من القائمة)', inp=True)
wl['B3'].alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); wl.column_dimensions['B'].width = 46
wl.row_dimensions[3].height = 48
row(wl, 4, 'Saudi employees you take through us, in this profession or any other (part time counts 0.5)', 0, 'عدد السعوديين الذين تأخذهم عندنا، في هذه المهنة أو أي مهنة أخرى (الجزئي يُحتسب 0.5)', inp=True, fmt='0.0')
row(wl, 5, 'Foreign employees in this profession (to transfer)', 1, 'عدد الأجانب في هذه المهنة (المراد نقلهم)', inp=True, fmt='0')
row(wl, 6, 'Contract term in months', 12, 'مدة العقد بالأشهر', inp=True)
look = lambda col: f'=INDEX(Professions!${col}$2:${col}${NP},MATCH($B$3,Professions!$A$2:$A${NP},0))'
row(wl, 7, 'Guide', look('C'), 'الدليل')
row(wl, 8, 'Localisation ratio', f'=INDEX(Professions!$E$2:$E${NP},MATCH($B$3,Professions!$A$2:$A${NP},0))/100', 'نسبة التوطين', fmt='0%')
row(wl, 9, 'Minimum workers for the ratio to apply', look('F'), 'الحد الأدنى للعاملين لسريان النسبة')
row(wl, 10, 'Minimum salary counted for a Saudi (SAR)', '=IF(INDEX(Professions!$G$2:$G$%d,MATCH($B$3,Professions!$A$2:$A$%d,0))=0,"None stated",INDEX(Professions!$G$2:$G$%d,MATCH($B$3,Professions!$A$2:$A$%d,0)))' % (NP,NP,NP,NP), 'أقل راتب يُحتسب للسعودي (ريال)', bold=True, fmt='#,##0', shade=True)
row(wl, 11, 'Category', look('H'), 'الفئة')
row(wl, 12, 'Saudi-only profession (not transferred to foreigners)?', '=IF(B11="Saudi-only","Yes — not transferable","No")', 'مهنة للسعوديين فقط (لا تُنقل لأجنبي)؟', bold=True)
row(wl, 13, 'Total workers in the profession (Saudi + foreign)', '=B4+B5', 'إجمالي العاملين في المهنة (سعودي + أجنبي)', fmt='0')
row(wl, 14, 'Does the ratio apply to this total?', '=IF(B13>=B9,"Yes","No — below the minimum workers")', 'هل تسري النسبة على هذا الإجمالي؟')
row(wl, 15, 'Saudis required by the ratio (rounded up)', '=IF(B13>=B9,ROUNDUP(ROUND(B13*B8,6),0),0)', 'عدد السعوديين المطلوب بالنسبة (تقريب للأعلى)', bold=True, fmt='0', shade=True)
row(wl, 16, 'Foreigners this total can carry', '=B13-B15', 'عدد الأجانب الذي يتحمّله هذا الإجمالي', bold=True, fmt='0', shade=True)
row(wl, 17, 'Additional Saudis needed (shortfall, with the total held)', '=MAX(0,B15-B4)', 'النقص بالسعوديين (والإجمالي ثابت)', bold=True, fmt='0')
wl.cell(18, 1, '="To meet the ratio you need "&B17&" more Saudi employee(s) in this profession."').font = f_b
wl.cell(18, 3, '="لتحقيق نسبة التوطين تحتاج "&B17&" سعودياً إضافياً في هذه المهنة."').font = f_b
wl.cell(18, 3).alignment = rtl; wl.cell(18, 1).alignment = wrap; wl.row_dimensions[18].height = 30
row(wl, 19, 'Our fee per employee per month, excl. VAT (SAR) — on top of Model 2',
    f'=IF(B11="Saudi-only","Not transferable",IF(B11="On request","Quoted on request",{locfee("$B$3", "B5", "B4")[1:]}))',
    'رسمنا لكل موظف شهرياً قبل الضريبة (ريال) — فوق النموذج الثاني', bold=True, fmt=NUM, shade=True)
row(wl, 20, 'Our monthly fee for the foreign employees, excl. VAT (SAR)', '=IF(ISNUMBER(B19),B19*B5,B19)', 'رسمنا الشهري للموظفين الأجانب قبل الضريبة (ريال)', bold=True, fmt=NUM)
row(wl, 21, 'VAT 15% (SAR)', '=IF(ISNUMBER(B20),B20*0.15,"—")', 'ضريبة 15% (ريال)', fmt=NUM)
row(wl, 22, 'Monthly fee incl. VAT (SAR)', '=IF(ISNUMBER(B20),B20+B21,"—")', 'الرسم الشهري شامل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(wl, 23, 'Fee for the term excl. VAT (SAR)', '=IF(ISNUMBER(B20),B20*B6,"—")', 'الرسم للمدة قبل الضريبة (ريال)', fmt=NUM)
row(wl, 24, 'Notes from the guide', look('J'), 'ملاحظات الدليل')
wl.row_dimensions[24].height = 90; wl['B24'].alignment = Alignment(wrap_text=True, vertical='top', horizontal='left')
wl.row_dimensions[7].height = 34
note(wl, 25, 'Localisation ratios and minimum salaries come from the Ministry of Human Resources procedural guides. A Saudi paid below the minimum is not counted toward the ratio. Saudi-only professions (human resources, secretarial, reception, customer service and similar) are not transferred to foreign employees. When you also take Saudis through us, in a profession with a localisation decision or an ordinary one, no localisation fee applies to the part they cover (one Saudi removes the flat fee for one foreigner); each Saudi has his own cost calculation (salary not below SAR 6,000, or the profession minimum if higher, plus insurance, end of service and leave). Fees for professions outside our approved categories are quoted on request. Results are indicative and not an official determination.',
     'نسب التوطين والحد الأدنى للأجور من الأدلة الإجرائية لوزارة الموارد البشرية. والسعودي الذي يقل أجره عن الحد الأدنى لا يُحتسب ضمن النسبة. والمهن المقصورة على السعوديين (الموارد البشرية والسكرتارية والاستقبال وخدمة العملاء ونحوها) لا تُنقل لموظفين أجانب. والمهن خارج فئاتنا المعتمدة تُسعَّر بالطلب. والنتائج استرشادية وليست تحديداً رسمياً.', 110)
dvp = DataValidation(type='list', formula1=f'=Professions!$A$2:$A${NP}', allow_blank=False); wl.add_data_validation(dvp); dvp.add('B3')
dvm = DataValidation(type='list', formula1='"12,24,36"'); wl.add_data_validation(dvm); dvm.add('B6')

# ---------- Activity data ----------
wd = wb.create_sheet('Activity data')
hdr(wd, 1, ['Activity group', 'Band', 'M', 'C 2026', 'C 2027', 'C 2028'])
r = 2
groups = list(nit.keys())
for g in groups:
    for b in ('light_green', 'medium_green', 'high_green', 'platinum'):
        v = nit[g][b]
        wd.cell(r, 1, g); wd.cell(r, 2, b)
        for j, x in enumerate(v, 3): wd.cell(r, j, x)
        r += 1
ND = r - 1
wd.column_dimensions['A'].width = 52
wd['H1'] = 'Nitaqat constants (Ministry of Human Resources): Y = M·ln(X) + C, where X is the total workforce.'; wd['H1'].font = f_s
wg = wb.create_sheet('Groups'); wg['A1'] = 'Activity group'
for i, g in enumerate(groups, 2): wg.cell(i, 1, g)
hdr(wg, 1, ['Activity group']); wg.column_dimensions['A'].width = 52

# ---------- Nitaqat calculator ----------
wa = wb.create_sheet('Nitaqat calculator', 4)
title(wa, 'Nitaqat and localisation calculator', 'حاسبة النطاقات والتوطين')
wa.column_dimensions['D'].width = 18; wa.column_dimensions['E'].width = 22; wa.column_dimensions['F'].width = 22; wa.column_dimensions['G'].width = 18; wa.column_dimensions['H'].width = 26
note(wa, 2, 'Choose your activity group in B3 and enter your headcount. Change the light-blue cells only.', 'اختر مجموعة نشاطك في B3 وأدخل أعداد العاملين. غيّر الخانات الزرقاء الفاتحة فقط.', 22)
row(wa, 3, 'Activity group (choose from the list)', 'الصناعات', 'مجموعة النشاط (اختر من القائمة)', inp=True)
row(wa, 4, 'Year', 2026, 'السنة', inp=True)
row(wa, 5, 'Saudi employees (full time)', 0, 'عدد السعوديين (دوام كامل)', inp=True, fmt='0')
row(wa, 6, 'Saudi employees (part time, optional) — counted as 0.5', 0, 'عدد السعوديين بدوام جزئي (اختياري) — يُحسب 0.5', inp=True, fmt='0')
row(wa, 7, 'Foreign employees', 30, 'عدد الأجانب', inp=True, fmt='0')
row(wa, 8, 'Target band (choose from the list)', 'Medium green', 'النطاق المستهدف (اختر من القائمة)', inp=True)
row(wa, 9, 'Total workforce (Saudi + foreign, headcount)', '=B5+B6+B7', 'إجمالي العاملين (سعودي + أجنبي، بالعدد)', bold=True, fmt='0', shade=True)
row(wa, 10, 'Saudis counted (full time + 0.5 × part time)', '=B5+0.5*B6', 'السعوديون المحتسبون (كامل + 0.5 × جزئي)', fmt='0.0')
row(wa, 11, 'Current Saudisation %', '=IF($B$9>0,ROUND($B$10/$B$9*100,2),0)', 'نسبة السعودة الحالية %', bold=True, fmt='0.00', shade=True)
row(wa, 12, 'Current band', '=IF(B11>=B18,"Platinum",IF(B11>=B17,"High green",IF(B11>=B16,"Medium green",IF(B11>=B15,"Light green","Red"))))', 'النطاق الحالي', bold=True, shade=True)
hdr(wa, 14, ['Band', 'Minimum Saudi % (Y = M·ln X + C)', 'الحد الأدنى للسعودة %'])
for cidx, t in ((4, 'Saudis required'), (5, 'Foreigners this total can carry'), (6, 'Shortfall (Saudis to add, total held)'), (7, 'Surplus Saudis'), (8, 'Hires needed if each new Saudi adds to the total')):
    c = wa.cell(14, cidx, t); c.font = Font(name='Arial', bold=True, color='FFFFFF', size=10); c.fill = fill_h; c.alignment = ctr
wa.row_dimensions[14].height = 44
bands = [('light_green', 'Light green', 'أخضر منخفض'), ('medium_green', 'Medium green', 'أخضر متوسط'), ('high_green', 'High green', 'أخضر مرتفع'), ('platinum', 'Platinum', 'بلاتيني')]
rngA = f"'Activity data'!$A$2:$A${ND}"; rngB = f"'Activity data'!$B$2:$B${ND}"
for k, (code, en, ar) in enumerate(bands, 15):
    m = f"SUMIFS('Activity data'!$C$2:$C${ND},{rngA},$B$3,{rngB},\"{code}\")"
    cc = f"CHOOSE($B$4-2025,SUMIFS('Activity data'!$D$2:$D${ND},{rngA},$B$3,{rngB},\"{code}\"),SUMIFS('Activity data'!$E$2:$E${ND},{rngA},$B$3,{rngB},\"{code}\"),SUMIFS('Activity data'!$F$2:$F${ND},{rngA},$B$3,{rngB},\"{code}\"))"
    a_ = wa.cell(k, 1, en); a_.font = f_b; a_.border = box; a_.alignment = wrap
    b_ = wa.cell(k, 2, f'=ROUND(MIN(100,MAX(0,{m}*LN(MAX($B$9,1))+{cc})),2)'); b_.number_format = '0.00'; b_.alignment = ctr; b_.border = box; b_.font = f_b
    c_ = wa.cell(k, 3, ar); c_.font = f_n; c_.alignment = rtl; c_.border = box
    d_ = wa.cell(k, 4, f'=ROUNDUP(ROUND(B{k}/100*$B$9,6),0)'); d_.alignment = ctr; d_.border = box; d_.font = f_b
    e_ = wa.cell(k, 5, f'=$B$9-D{k}'); e_.alignment = ctr; e_.border = box
    f_ = wa.cell(k, 6, f'=MAX(0,D{k}-$B$10)'); f_.alignment = ctr; f_.border = box; f_.font = f_b
    g_ = wa.cell(k, 7, f'=MAX(0,$B$10-D{k})'); g_.alignment = ctr; g_.border = box
    h_ = wa.cell(k, 8, f'=IF(B{k}>=100,"—",MAX(0,ROUNDUP(ROUND((B{k}/100*$B$9-$B$10)/(1-B{k}/100),6),0)))'); h_.alignment = ctr; h_.border = box
    wa.row_dimensions[k].height = 26
TB = 'MATCH($B$8,$A$15:$A$18,0)'
wa.cell(20, 1, f'="To reach "&$B$8&" you need "&INDEX($F$15:$F$18,{TB})&" additional Saudi employee(s), with the total held at "&$B$9&"."').font = f_b
wa.cell(20, 3, f'="لتبلغ النطاق "&INDEX($C$15:$C$18,{TB})&" تحتاج "&INDEX($F$15:$F$18,{TB})&" سعودياً إضافياً، والإجمالي ثابت عند "&$B$9&"."').font = f_b
wa.cell(20, 3).alignment = rtl; wa.cell(20, 1).alignment = wrap; wa.row_dimensions[20].height = 34
note(wa, 21, 'Nitaqat bands follow the Ministry formula Y = M·ln(X) + C per activity group and year, where X is the total workforce. Part-time Saudis count as 0.5 in the Saudi count; the exact treatment of part-time staff in the total and the group for your commercial activity (ISIC code) must be confirmed on the Ministry tool. Results are indicative, not an official determination.',
     'نطاقات تتبع معادلة الوزارة Y = M·ln(X) + C لكل مجموعة نشاط وسنة، حيث X إجمالي العاملين. والسعودي بدوام جزئي يُحسب 0.5 في عدد السعوديين؛ أما معالجة الدوام الجزئي في الإجمالي ومجموعة نشاطك التجاري (رمز ISIC) فتُؤكَّد من أداة الوزارة. والنتائج استرشادية وليست تحديداً رسمياً.', 110)
dva = DataValidation(type='list', formula1=f'=Groups!$A$2:$A${len(groups)+1}'); wa.add_data_validation(dva); dva.add('B3')
dvy = DataValidation(type='list', formula1='"2026,2027,2028"'); wa.add_data_validation(dvy); dvy.add('B4')
dvb = DataValidation(type='list', formula1='"Light green,Medium green,High green,Platinum"'); wa.add_data_validation(dvb); dvb.add('B8')

for _n in ('Full employee cost','Transparent cost'):
    wb[_n].column_dimensions['B'].width = 46
    wb[_n]['B5'].alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
    wb[_n].row_dimensions[5 if _n=='Full employee cost' else 7].height = 48
if INTERNAL:
    wt = wb.create_sheet('Cost table')
    wt.sheet_view.showGridLines = False
    wt.column_dimensions['A'].width = 40; wt.column_dimensions['B'].width = 16; wt.column_dimensions['C'].width = 46
    wt.merge_cells('A1:C1'); wt['A1'] = 'INTERNAL — Cost build-up per employee (do not send to the client)   |   تفصيل التكلفة لكل موظف (داخلي — لا يُرسل للعميل)'
    wt['A1'].font = f_title; wt['A1'].fill = fill_h; wt['A1'].alignment = wrap; wt.row_dimensions[1].height = 34
    def tr(r, a, v, c='', inp=False, bold=False, fmt=NUM, shade=False):
        x = wt.cell(r, 1, a); y = wt.cell(r, 2, v); z = wt.cell(r, 3, c)
        x.font = f_b if bold else f_n; y.font = Font(name='Arial', bold=bold or inp, size=11, color=NAVY); z.font = f_s
        y.number_format = fmt; y.alignment = ctr
        for q in (x, y, z):
            q.border = box
            if shade: q.fill = fill_p
        if inp: y.fill = fill_in
    tr(2, 'Total monthly package (Salary)', 6000, 'Input', inp=True, fmt='#,##0')
    tr(3, 'Contract term in months (12, 24 or 36)', 12, 'Input', inp=True, fmt='0')
    wt['A4'] = 'Component'; wt['B4'] = 'Cost'; wt['C4'] = 'Basis'
    for q in ('A4', 'B4', 'C4'):
        wt[q].font = Font(name='Arial', bold=True, color='FFFFFF'); wt[q].fill = fill_h; wt[q].alignment = ctr
    comp = [
     ('Salary', '=B2', 'Total monthly package'),
     ('Visa and joining fee', '=3000/B3', 'SAR 3,000 ÷ contract months'),
     ('Iqamah + LL + Ajeer', '=(9700+650+276)/12', '(9,700 levy and permit + 650 iqama + 276 Ajeer) ÷ 12'),
     ('Insurance', '=600/12', 'SAR 600 ÷ 12'),
     ('Re-entry visa', '=200/12', 'SAR 200 ÷ 12'),
     ('EOS', '=B2/24', 'Salary ÷ 24'),
     ('Leave pay', '=B2/30*21/12', '21 days a year'),
     ('Return ticket', '=1500/12', 'SAR 1,500 ÷ 12'),
     ('Arrival ticket', '=2000/B3', 'SAR 2,000 ÷ contract months'),
     ('Gosi', '=B2*2%', '2% of salary'),
     ('Overhead', 500, 'SAR 500 per employee per month'),
    ]
    for i, (a, v, c) in enumerate(comp, 5): tr(i, a, v, c)
    last = 5 + len(comp) - 1; r = last + 1
    tr(r, 'Total cost', f'=SUM(B5:B{last})', '', bold=True, shade=True)
    tr(r + 1, 'Monthly Rate 10%', f'=B{r}*(1+0.1)', 'Total cost + 10%', bold=True)
    tr(r + 2, 'Monthly Billable', f'=MROUND(B{r+1},10)', 'Rounded to the nearest 10', bold=True, shade=True)
    tr(r + 3, 'Salary Markup', f'=B{r+2}-B2', 'Billable − salary')
    tr(r + 4, 'Gross profit', f'=B{r+2}-(B{r}-B{last})', 'Billable − (total cost − overhead)')
    tr(r + 5, 'Gross Profit Margin', f'=B{r+4}/B{r+2}', '', fmt='0.00%')
    tr(r + 6, 'Net Profit', f'=B{r+2}-B{r}', 'Billable − total cost')
    tr(r + 7, 'Net Profit Margin', f'=B{r+6}/B{r+2}', '', fmt='0.00%')
    dvt = DataValidation(type='list', formula1='"12,24,36"'); wt.add_data_validation(dvt); dvt.add('B3')

if TRANSPARENT:
    del wb['Full employee cost']; del wb['Transparent cost']
    PRO = f'Professions!$A$2:$A${NP_LATE}'
    def t4(ws, a, b, c, d):
        ws.merge_cells('A1:D1'); ws['A1'] = a + '   |   ' + b
        ws['A1'].font = f_title; ws['A1'].fill = fill_h; ws['A1'].alignment = wrap; ws.row_dimensions[1].height = 34
        ws.column_dimensions['A'].width = 52; ws.column_dimensions['B'].width = 22; ws.column_dimensions['C'].width = 52; ws.column_dimensions['D'].width = 62
        ws.sheet_view.showGridLines = False
    def r4(ws, r, en, v, ar, how='', inp=False, bold=False, fmt=None, shade=False):
        a = ws.cell(r, 1, en); b = ws.cell(r, 2, v); c = ws.cell(r, 3, ar); d = ws.cell(r, 4, how)
        a.font = f_b if bold else f_n; c.font = f_b if bold else f_n; d.font = f_s
        b.font = Font(name='Arial', bold=bold or inp, size=11, color=NAVY)
        a.alignment = wrap; c.alignment = rtl; b.alignment = ctr; d.alignment = wrap
        for x in (a, b, c, d):
            x.border = box
            if shade: x.fill = fill_p
        if inp: b.fill = fill_in
        if fmt: b.number_format = fmt
        ws.row_dimensions[r].height = 32
    # ---- Insurance ----
    wi = wb.create_sheet('Insurance')
    t4(wi, 'Estimated medical insurance', 'التأمين الطبي المتوقع', '', '')
    classes = ['Basic', 'Class C', 'Class B', 'Class A', 'VIP']
    bands = [(18, '18-24'), (25, '25-29'), (30, '30-34'), (35, '35-39'), (40, '40-44'), (45, '45-49'), (50, '50-54'), (55, '55-59'), (60, '60+')]
    nats = ['Yemeni', 'Indian', 'Jordanian', 'Filipino', 'Pakistani', 'Egyptian', 'Bangladeshi', 'Sudanese', 'Nepalese', 'Sri Lankan', 'Other']
    r4(wi, 2, 'Nationality', 'Yemeni', 'الجنسية', 'Choose from the list', inp=True)
    r4(wi, 3, 'Sex', 'Male', 'الجنس', 'Male or Female', inp=True)
    r4(wi, 4, 'Age (years)', 30, 'العمر (سنة)', 'Age at the start of the policy', inp=True, fmt='0')
    r4(wi, 5, 'Insurance class', 'Class C', 'فئة التأمين', 'Expected class', inp=True)
    r4(wi, 7, 'Age band', '=INDEX($G$14:$G$22,MATCH(B4,$F$14:$F$22,1))', 'الشريحة العمرية', 'Found from the age')
    r4(wi, 8, 'Base annual premium from the rate table (SAR)', '=INDEX($H$14:$L$22,MATCH(B4,$F$14:$F$22,1),MATCH(B5,$H$13:$L$13,0))', 'القسط السنوي الأساسي من جدول الأسعار (ريال)', 'Empty until the insurer rates are entered in the table', fmt=NUM)
    r4(wi, 9, 'Sex factor', '=INDEX($F$27:$F$28,MATCH(B3,$E$27:$E$28,0))', 'معامل الجنس', 'From the factors table', fmt='0.00')
    r4(wi, 10, 'Nationality factor', '=INDEX($F$31:$F$41,MATCH(B2,$E$31:$E$41,0))', 'معامل الجنسية', 'From the factors table', fmt='0.00')
    r4(wi, 11, 'Fallback annual premium (current assumption, SAR)', 600, 'القسط السنوي الافتراضي الحالي (ريال)', 'Used while no insurer rate is entered', inp=True, fmt=NUM)
    r4(wi, 12, 'Annual premium (SAR)', '=IF(ISNUMBER(B8),IF(B8>0,B8*B9*B10,B11),B11)', 'القسط السنوي (ريال)', '=IF(AND(ISNUMBER(B8),B8>0),"From the insurer rate table","Current assumption — replace with the insurer quote")', bold=True, fmt=NUM, shade=True)
    r4(wi, 13, 'Monthly premium (SAR)', '=B12/12', 'القسط الشهري (ريال)', 'Annual premium ÷ 12 — used by the price calculators', bold=True, fmt=NUM, shade=True)
    wi['F12'] = 'Annual premium by age band and class (SAR) — fill from the insurer quote'; wi['F12'].font = f_b
    wi['F13'] = 'From age'; wi['G13'] = 'Band'
    for j, c in enumerate(classes): wi.cell(13, 8 + j, c)
    for q in range(6, 13):
        cc = wi.cell(13, q); cc.font = Font(name='Arial', bold=True, color='FFFFFF'); cc.fill = fill_h; cc.alignment = ctr
    for i, (lo, lab) in enumerate(bands, 14):
        wi.cell(i, 6, lo); wi.cell(i, 7, lab)
        for j in range(5):
            c = wi.cell(i, 8 + j); c.fill = fill_in; c.number_format = NUM; c.border = box
    wi['E26'] = 'Sex'; wi['F26'] = 'Factor'; wi['E30'] = 'Nationality'; wi['F30'] = 'Factor'
    for q in ('E26', 'F26', 'E30', 'F30'):
        wi[q].font = Font(name='Arial', bold=True, color='FFFFFF'); wi[q].fill = fill_h
    for i, sx in enumerate(('Male', 'Female'), 27):
        wi.cell(i, 5, sx); c = wi.cell(i, 6, 1); c.fill = fill_in
    for i, nt in enumerate(nats, 31):
        wi.cell(i, 5, nt); c = wi.cell(i, 6, 1); c.fill = fill_in
    for col in 'EFGHIJKL': wi.column_dimensions[col].width = 14
    wi.column_dimensions['F'].width = 22
    for rng, lst in (('B2', '=$E$31:$E$41'), ('B3', '"Male,Female"'), ('B5', '=$H$13:$L$13')):
        dvx = DataValidation(type='list', formula1=lst); wi.add_data_validation(dvx); dvx.add(rng)
    note(wi, 15, 'Insurance premiums depend on age, sex, nationality and class. The rate table is filled from the insurer quote; until then the calculator uses the current assumption of SAR 600 per year.', 'يعتمد قسط التأمين على العمر والجنس والجنسية والفئة. ويُعبَّأ جدول الأسعار من عرض شركة التأمين، وإلى ذلك الحين تستعمل الحاسبة الافتراضي الحالي 600 ريال سنوياً.', 60)
    # ---- Recruitment ----
    wcr = wb.create_sheet('Recruitment')
    t4(wcr, 'Recruitment from abroad', 'الاستقدام من الخارج', '', '')
    countries = [('Philippines', 5625, 2000, 350, None, 2000, 'Recruitment SAR 5,625 (USD 1,500 at 3.75); visa SAR 2,000; contract and authorisations SAR 350 (Philippine labour office approval, attestation by Foreign Affairs and the Chamber of Commerce)'),
                 ('India', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Pakistan', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Egypt', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Bangladesh', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Nepal', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Sri Lanka', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Jordan', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Yemen', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country'),
                 ('Other', None, None, None, None, None, 'To be entered per agency quote and the requirements of the country')]
    r4(wcr, 2, 'Country recruited from', 'Philippines', 'الدولة المستقدم منها', 'Choose from the list', inp=True)
    r4(wcr, 3, 'Profession (for the professional accreditation)', rows_p[0][0], 'المهنة (للاعتماد المهني)', 'Choose from the list', inp=True)
    r4(wcr, 4, 'Number of certificates to attest', 0, 'عدد الشهادات المطلوب تصديقها', 'Education and experience certificates', inp=True, fmt='0')
    wcr['B3'].alignment = ctr
    CT = f'$F$13:$F$22'
    def cl(col): return f'IFERROR(INDEX(${col}$13:${col}$22,MATCH($B$2,$F$13:$F$22,0)),0)'
    r4(wcr, 6, 'Professional accreditation required for the profession', f'=IFERROR(IF(INDEX(Professions!$K$2:$K${NP_LATE},MATCH(B3,Professions!$A$2:$A${NP_LATE},0))="","None listed",INDEX(Professions!$K$2:$K${NP_LATE},MATCH(B3,Professions!$A$2:$A${NP_LATE},0))),"None listed")', 'الاعتماد المهني المطلوب للمهنة', 'From the Ministry guides', )
    r4(wcr, 7, 'Recruitment agency cost (SAR)', '=N(' + cl('G').replace('$G$', '$G$') + ')', 'تكلفة مكتب الاستقدام (ريال)', 'From the country table', fmt=NUM)
    r4(wcr, 8, 'Visa cost (SAR)', '=' + cl('H'), 'تكلفة التأشيرة (ريال)', 'From the country table', fmt=NUM)
    r4(wcr, 9, 'Contracts and authorisations (SAR)', '=' + cl('I'), 'العقود والتفويضات (ريال)', 'From the country table', fmt=NUM)
    r4(wcr, 10, 'Certificates attestation (SAR)', '=B4*' + cl('J'), 'تصديق الشهادات (ريال)', 'Number of certificates × attestation cost per certificate', fmt=NUM)
    r4(wcr, 11, 'Total recruitment costs excl. arrival ticket (SAR)', '=SUM(B7:B10)', 'إجمالي تكاليف الاستقدام دون تذكرة القدوم (ريال)', 'Used by the price calculators', bold=True, fmt=NUM, shade=True)
    r4(wcr, 12, 'Arrival ticket (SAR)', '=IF(' + cl('K') + '>0,' + cl('K') + ',2000)', 'تذكرة القدوم (ريال)', 'Country table; SAR 2,000 if not entered', bold=True, fmt=NUM, shade=True)
    for q, t in zip('FGHIJK', ('Country', 'Agency cost (SAR)', 'Visa (SAR)', 'Contracts and authorisations (SAR)', 'Attestation per certificate (SAR)', 'Arrival ticket (SAR)')):
        cc = wcr[q + '12']; cc.value = t; cc.font = Font(name='Arial', bold=True, color='FFFFFF'); cc.fill = fill_h; cc.alignment = ctr
    wcr['L12'] = 'Requirements'; wcr['L12'].font = Font(name='Arial', bold=True, color='FFFFFF'); wcr['L12'].fill = fill_h
    for i, row_ in enumerate(countries, 13):
        for j, v in enumerate(row_):
            c = wcr.cell(i, 6 + j, v)
            if 1 <= j <= 5: c.fill = fill_in; c.number_format = NUM
        wcr.cell(i, 12).alignment = Alignment(wrap_text=True)
    for col, w in zip('FGHIJKL', (16, 18, 14, 22, 22, 16, 70)): wcr.column_dimensions[col].width = w
    dvc = DataValidation(type='list', formula1='=$F$13:$F$22'); wcr.add_data_validation(dvc); dvc.add('B2')
    dvq = DataValidation(type='list', formula1=f'={PRO}'); wcr.add_data_validation(dvq); dvq.add('B3')
    note(wcr, 14, 'Recruitment costs depend on the country, its requirements, the profession and the certificates to attest. Philippines figures come from our current offer; other countries are entered per agency quote.', 'تعتمد تكاليف الاستقدام على الدولة ومتطلباتها والمهنة والشهادات المطلوب تصديقها. وأرقام الفلبين من عرضنا الحالي، وبقية الدول تُدخل بحسب عرض مكتب الاستقدام.', 70)
    # ---- Full employee cost (transparent) ----
    ws = wb.create_sheet('Full employee cost', 1)
    t4(ws, 'Foreign employee — monthly price (Model 2: full employee cost)', 'الموظف الأجنبي — السعر الشهري (النموذج الثاني: تكلفة الموظف الكاملة)', '', '')
    r4(ws, 2, 'Change the light-blue cells only. The calculation is shown line by line, so you can follow how the salary drives the price.', 'غيّر الخانات الزرقاء الفاتحة فقط. والحسبة معروضة سطراً بسطر لتتبع كيف يؤثر الراتب على السعر.', 'Formulas are visible in every cell.')
    ws.row_dimensions[2].height = 40
    r4(ws, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', 'The variable that drives the price', inp=True, fmt='#,##0')
    r4(ws, 4, 'Contract term in months (12, 24 or 36)', 12, 'مدة العقد بالأشهر (12 أو 24 أو 36)', 'One-off fees are spread over this term', inp=True)
    r4(ws, 5, 'Profession (localisation fee is added on top)', rows_p[0][0], 'المهنة (رسوم التوطين تُضاف فوق السعر)', 'See "Profession calculator"', inp=True)
    r4(ws, 6, 'Recruited from abroad? (Yes or No)', 'No', 'مستقدَم من الخارج؟ (Yes أو No)', 'Yes uses the "Recruitment" sheet', inp=True)
    r4(ws, 7, 'Use the "Insurance" sheet estimate? (Yes or No)', 'Yes', 'استعمال تقدير ورقة «Insurance»؟ (Yes أو No)', 'No uses SAR 600 per year', inp=True)
    r4(ws, 8, 'Foreign employees in this profession (for the localisation fee)', 1, 'عدد الأجانب في هذه المهنة (لرسوم التوطين)', 'Fee = cost of the Saudis the ratio requires ÷ foreigners', inp=True, fmt='0')
    ws.cell(9, 1, 'Cost component per month').font = f_b; ws.cell(9, 3, 'بند التكلفة الشهري').font = f_b; ws.cell(9, 3).alignment = rtl
    comp = [
     ('Salary', '=B3', 'الراتب', 'Total monthly package'),
     ('Iqama + work permit and levy + Ajeer', '=(9700+650+276)/12', 'الإقامة + رخصة العمل والمقابل المالي + أجير', '(9,700 levy and permit + 650 iqama + 276 Ajeer) ÷ 12'),
     ('Medical insurance', '=IF(B7="Yes",Insurance!B13,600/12)', 'التأمين الطبي', 'Insurance sheet (age, sex, nationality, class) or SAR 600 ÷ 12'),
     ('Re-entry visa', '=200/12', 'تأشيرة الخروج والعودة', 'SAR 200 ÷ 12'),
     ('End of service', '=B3/24', 'مكافأة نهاية الخدمة', 'Salary ÷ 24 (half a month a year for the first five years)'),
     ('Leave pay', '=B3/30*21/12', 'بدل الإجازة', '21 days a year: salary ÷ 30 × 21 ÷ 12'),
     ('Social insurance (GOSI), foreign', '=B3*2%', 'التأمينات الاجتماعية للأجنبي', '2% of salary'),
     ('Return flight ticket', '=1500/12', 'تذكرة الطيران (العودة)', 'SAR 1,500 ÷ 12'),
     ('Visa and joining fee', '=3000/B4', 'رسوم التأشيرة والالتحاق', 'SAR 3,000 ÷ contract months'),
     ('Recruitment from abroad', '=IF(B6="Yes",Recruitment!B11,0)/B4', 'الاستقدام من الخارج', 'Recruitment sheet total ÷ contract months'),
     ('Arrival ticket', '=IF(B6="Yes",Recruitment!B12,2000)/B4', 'تذكرة القدوم', 'SAR 2,000 (or the country value) ÷ contract months'),
     ('Business Partner monthly operating expenses', 500, 'المصاريف التشغيلية الشهرية لـ Business Partner على الموظف', 'SAR 500 per employee per month'),
    ]
    for i, (e, v, a, h) in enumerate(comp, 10): r4(ws, i, e, v, a, h, fmt=NUM)
    lc = 10 + len(comp) - 1
    R = lc + 1
    r4(ws, R, 'Total cost per month (SAR)', f'=SUM(B10:B{lc})', 'إجمالي التكلفة الشهرية (ريال)', 'Sum of the lines above', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 1, 'Business Partner service fee (SAR)', f'=(B{R}+B3*{PXL})*0.1+B3*{PXL}', 'رسم خدمة Business Partner (ريال)', 'Service fee on the total cost', fmt=NUM)
    r4(ws, R + 2, 'Monthly price before localisation, excl. VAT (SAR)', f'=MROUND(B{R}+B{R+1},10)', 'السعر الشهري قبل التوطين قبل الضريبة (ريال)', 'Total cost + service fee, rounded to the nearest 10', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 3, 'Localisation fee per month, added on top (SAR)', locfee('B5', 'B8', '0'), 'رسوم التوطين شهرياً تُضاف فوق السعر (ريال)', 'Profession calculator', fmt=NUM)
    r4(ws, R + 4, 'Monthly price incl. localisation fee, excl. VAT (SAR)', f'=B{R+2}+B{R+3}', 'السعر الشهري شامل رسوم التوطين قبل الضريبة (ريال)', '', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 5, 'VAT 15% (SAR)', f'=B{R+4}*0.15', 'ضريبة القيمة المضافة 15% (ريال)', '', fmt=NUM)
    r4(ws, R + 6, 'Monthly price incl. VAT (SAR)', f'=B{R+4}+B{R+5}', 'السعر الشهري شامل الضريبة (ريال)', '', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 7, 'Total for the term excl. VAT (SAR)', f'=B{R+4}*B4', 'الإجمالي للمدة قبل الضريبة (ريال)', '', fmt=NUM)
    r4(ws, R + 8, 'Two months in advance excl. VAT (SAR)', f'=B{R+4}*2', 'شهران مقدماً قبل الضريبة (ريال)', '', fmt=NUM)
    cmp0 = R + 10
    ws.cell(cmp0, 1, 'Same package by term — monthly price excl. VAT').font = f_b
    ws.cell(cmp0, 3, 'نفس الراتب بحسب المدة — السعر الشهري قبل الضريبة').font = f_b; ws.cell(cmp0, 3).alignment = rtl
    fixed = f'(SUM(B10:B{lc})-B18-B19-B20)'
    oneoff = '(3000+IF(B6="Yes",Recruitment!B11,0)+IF(B6="Yes",Recruitment!B12,2000))'
    for k, n in enumerate((12, 24, 36)):
        r4(ws, cmp0 + 1 + k, f'{n} months', f'=MROUND(({fixed}+{oneoff}/{n}+B3*{PREM(n)})*1.1,10)+B{R+3}', f'{n} أشهر' if n == 6 else f'{n} شهراً', 'Fixed monthly costs + one-off costs ÷ months, plus 10%, plus localisation', fmt=NUM)
    note(ws, cmp0 + 6, 'Indicative. The signed proposal and agreement govern. Saudi-only professions are not transferred to foreign employees, and professions outside our approved categories are quoted on request.', 'استرشادي. والعرض والعقد الموقّعان هما المرجع. والمهن المقصورة على السعوديين لا يُنقل إليها أجنبي، والمهن خارج فئاتنا المعتمدة تُحدَّد عند الطلب.', 50)
    for rng, lst in (('B4', '"12,24,36"'), ('B5', f'={PRO}'), ('B6', '"Yes,No"'), ('B7', '"Yes,No"')):
        dvz = DataValidation(type='list', formula1=lst); ws.add_data_validation(dvz); dvz.add(rng)
    ws['B5'].alignment = ctr; ws.row_dimensions[5].height = 48
    # ---- Transparent cost (transparent) ----
    wc = wb.create_sheet('Transparent cost', 2)
    t4(wc, 'Foreign employee — monthly invoice (Model 1: cost plus)', 'الموظف الأجنبي — الفاتورة الشهرية (النموذج الأول: التكلفة بشفافية)', '', '')
    r4(wc, 2, 'Change the light-blue cells only. Each item is invoiced separately at actual cost.', 'غيّر الخانات الزرقاء الفاتحة فقط. وكل بند يُفوتر منفصلاً بالتكلفة الفعلية.', 'Government fees carry no VAT; VAT applies only to our fee.')
    r4(wc, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', '', inp=True, fmt='#,##0')
    r4(wc, 4, 'Contract term in months (12, 24 or 36)', 12, 'مدة العقد بالأشهر (12 أو 24 أو 36)', '', inp=True)
    r4(wc, 5, 'Profession (our localisation fee)', rows_p[0][0], 'المهنة (رسوم التوطين لدينا)', 'See "Profession calculator"', inp=True)
    r4(wc, 6, 'Recruited from abroad? (Yes or No)', 'No', 'مستقدَم من الخارج؟ (Yes أو No)', 'Yes uses the "Recruitment" sheet', inp=True)
    r4(wc, 7, 'Use the "Insurance" sheet estimate? (Yes or No)', 'Yes', 'استعمال تقدير ورقة «Insurance»؟ (Yes أو No)', 'No uses SAR 600 per year', inp=True)
    r4(wc, 8, 'Foreign employees in this profession (for the localisation fee)', 1, 'عدد الأجانب في هذه المهنة (لرسوم التوطين)', 'Fee = cost of the Saudis the ratio requires ÷ foreigners', inp=True, fmt='0')
    wc.cell(9, 1, 'Costs at actual — no VAT').font = f_b; wc.cell(9, 3, 'التكاليف بالتكلفة الفعلية — بلا ضريبة').font = f_b; wc.cell(9, 3).alignment = rtl
    items = [
     ('Salary', '=B3', 'الراتب', 'Total monthly package'),
     ('Iqama + work permit and levy', '=(9700+650)/12', 'الإقامة + رخصة العمل والمقابل المالي', '(9,700 levy and permit + 650 iqama) ÷ 12'),
     ('Medical insurance', '=IF(B7="Yes",Insurance!B13,600/12)', 'التأمين الطبي', 'Insurance sheet or SAR 600 ÷ 12'),
     ('Social insurance (GOSI), foreign', '=B3*0.02', 'التأمينات الاجتماعية للأجنبي', '2% of salary'),
     ('End of service', '=B3/24', 'مكافأة نهاية الخدمة', 'Salary ÷ 24'),
     ('Leave pay', '=B3/30*21/12', 'بدل الإجازة', '21 days a year'),
     ('Return flight ticket', '=1500/12', 'تذكرة الطيران (العودة)', 'SAR 1,500 ÷ 12'),
     ('Sponsorship transfer fee', "=IF(B6=\"Yes\",0,'Billing schedule'!B15)/B4", 'رسوم نقل الكفالة', 'Tiered fee from the Billing schedule sheet ÷ contract months'),
     ('Recruitment from abroad', '=IF(B6="Yes",Recruitment!B11,0)/B4', 'الاستقدام من الخارج', 'Recruitment sheet total ÷ contract months'),
     ('Arrival ticket (recruitment from abroad only)', '=IF(B6="Yes",Recruitment!B12,0)/B4', 'تذكرة القدوم (للاستقدام من الخارج فقط)', 'Recruitment sheet value ÷ contract months; none when transferring inside the Kingdom'),
    ]
    for i, (e, v, a, h) in enumerate(items, 10): r4(wc, i, e, v, a, h, fmt=NUM)
    lc2 = 10 + len(items) - 1
    r4(wc, lc2 + 1, 'Total costs at actual (no VAT)', f'=SUM(B10:B{lc2})', 'إجمالي التكاليف بالفعلي (بلا ضريبة)', '', bold=True, fmt=NUM, shade=True)
    r4(wc, lc2 + 2, 'Our localisation fee, excl. VAT', locfee('B5', 'B8', '0'), 'رسوم التوطين لدينا قبل الضريبة', 'Profession calculator', fmt=NUM)
    r4(wc, lc2 + 3, 'Business Partner monthly service fee, excl. VAT', "='Billing schedule'!B16", 'رسوم خدمة بزنس بارتنر الشهرية قبل الضريبة', 'Fixed per employee per month — monthly invoice only', fmt=NUM)
    r4(wc, lc2 + 4, 'VAT 15% on our fees and on medical insurance', f'=(B{lc2+2}+B{lc2+3}+B12)*0.15', 'ضريبة 15% على رسومنا وعلى التأمين الطبي', 'Other costs follow the actual invoice', fmt=NUM)
    r4(wc, lc2 + 5, 'Total monthly invoice (SAR)', f'=B{lc2+1}+B{lc2+2}+B{lc2+3}+B{lc2+4}', 'إجمالي الفاتورة الشهرية (ريال)', '', bold=True, fmt=NUM, shade=True)
    r4(wc, lc2 + 6, 'Total for the term (SAR)', f'=B{lc2+5}*B4', 'الإجمالي للمدة (ريال)', '', fmt=NUM)
    r4(wc, lc2 + 7, 'Salary invoiced two months in advance (SAR)', '=B3*2', 'الراتب المفوتر شهرين مقدماً (ريال)', 'Salary only; no fee on it', fmt=NUM)
    for rng, lst in (('B4', '"12,24,36"'), ('B5', f'={PRO}'), ('B6', '"Yes,No"'), ('B7', '"Yes,No"')):
        dvz = DataValidation(type='list', formula1=lst); wc.add_data_validation(dvz); dvz.add(rng)
    wc['B5'].alignment = ctr; wc.row_dimensions[5].height = 48

    # ---- Billing schedule (cost plus: stages, one invoice / payment per item) ----
    wbs = wb.create_sheet('Billing schedule')
    t4(wbs, 'Billing and payment schedule — Model 1 (cost plus), annual contracts', 'جدول الفوترة والدفع — النموذج الأول (التكلفة بشفافية)، العقود السنوية', '', '')
    CP = "'Transparent cost'!"
    r4(wbs, 2, 'Stages: 1 first advance (recruitment or sponsorship transfer) · 2 entry or on the Company sponsorship · monthly · after contract end. Month 0 = start; month 1 = end of the first month. Amounts exclude VAT unless stated and are at actual cost.', '', 'المراحل: 1 الدفعة الأولى المقدمة (استقدام أو نقل كفالة) · 2 الدخول أو وجود الموظف على كفالة الشركة · شهرياً · بعد نهاية العقد. الشهر 0 = البدء؛ الشهر 1 = نهاية الشهر الأول. المبالغ قبل الضريبة ما لم يُذكر وبالتكلفة الفعلية.')
    wbs.row_dimensions[2].height = 52
    r4(wbs, 3, 'Start date (optional)', None, 'تاريخ البدء (اختياري)', 'Fills the dates row', inp=True, fmt='yyyy-mm-dd')
    r4(wbs, 4, 'Contract term in months (12, 24 or 36)', f'={CP}B4', 'مدة العقد بالأشهر (12 أو 24 أو 36)', 'From the Transparent cost sheet', fmt='0')
    r4(wbs, 5, 'Total monthly package (SAR)', f'={CP}B3', 'إجمالي الراتب الشهري (ريال)', 'From the Transparent cost sheet', fmt='#,##0')
    r4(wbs, 6, 'Recruited from abroad?', f'={CP}B6', 'مستقدَم من الخارج؟', 'From the Transparent cost sheet')
    r4(wbs, 7, 'Work permit and iqama payment frequency', 'Annual', 'دورية دفع رخصة العمل والإقامة', 'Quarterly, Half-yearly or Annual — client chooses', inp=True)
    r4(wbs, 8, 'Sponsorship transfer number (1, 2, 3 or more)', 1, 'رقم عملية نقل الكفالة (1 أو 2 أو 3 فأكثر)', 'Enter 3 for the third transfer and above', inp=True, fmt='0')
    r4(wbs, 9, 'Hiring a Saudi national? (Yes or No)', 'No', 'توظيف سعودي؟ (Yes أو No)', 'Localisation (Saudi) lines below', inp=True)
    r4(wbs, 10, 'Saudi monthly salary (SAR)', 0, 'راتب السعودي الشهري (ريال)', 'Enter the agreed salary: not below SAR 6,000, or the profession minimum if higher', inp=True, fmt='#,##0')
    r4(wbs, 11, 'Saudi salary invoicing', 'Arrears', 'فوترة راتب السعودي', 'Arrears: invoiced after the first month of work and monthly thereafter (owner decision). Advance is available as an alternative', inp=True)
    r4(wbs, 12, 'Social insurance rate on the Saudi (employer share, %)', 0, 'نسبة التأمينات على السعودي (حصة صاحب العمل، %)', '[[To confirm]] — left at 0 until the official rate is confirmed', inp=True, fmt='0.00')
    r4(wbs, 13, 'Annual medical premium used (SAR)', f'=IF({CP}B7="Yes",Insurance!B12,600)', 'قسط التأمين الطبي السنوي المعتمد (ريال)', 'Insurance sheet or SAR 600', fmt=NUM)
    r4(wbs, 14, 'Permit and iqama payment period (months)', '=IF(B7="Quarterly",3,IF(B7="Half-yearly",6,12))', 'مدة دفعة الرخصة والإقامة (أشهر)', '', fmt='0')
    r4(wbs, 15, 'Sponsorship transfer fee (SAR) — paid in advance', '=IF(B6="Yes",0,IF(B8<=1,2000,IF(B8=2,4000,6000)))', 'رسوم نقل الكفالة (ريال) — تُدفع مقدماً', '2,000 first time · 4,000 second · 6,000 third and above. Official government fee, paid at cost — no Business Partner mark-up', bold=True, fmt='#,##0', shade=True)
    r4(wbs, 16, 'Business Partner monthly service fee per employee (SAR)', 500, 'رسوم خدمة بزنس بارتنر الشهرية لكل موظف (ريال)', 'Fixed, monthly invoice only — no fee on advances, stage 2, contract end or the salary advance. Subject to 15% VAT', inp=True, fmt='#,##0')
    for rng, lst in (('B7', '"Quarterly,Half-yearly,Annual"'), ('B9', '"Yes,No"'), ('B11', '"Arrears,Advance"')):
        dvz = DataValidation(type='list', formula1=lst); wbs.add_data_validation(dvz); dvz.add(rng)
    HR = 19; FM = 6; NM = 36
    ML = lambda m: get_column_letter(FM + m)
    for j, h in enumerate(('Item', 'البند', 'Stage · When', 'Total over the term (SAR)')):
        c = wbs.cell(HR, 1 + j, h); c.font = Font(name='Arial', bold=True, color='FFFFFF'); c.fill = fill_h; c.alignment = ctr
    wbs.cell(HR - 1, 1, 'Month →').font = f_b
    for m in range(NM + 1):
        c = wbs.cell(HR, FM + m, m); c.font = Font(name='Arial', bold=True, color='FFFFFF'); c.fill = fill_h; c.alignment = ctr
        d = wbs.cell(HR - 1, FM + m, f'=IF($B$3="","",EDATE($B$3,{ML(m)}${HR}))'); d.number_format = 'yyyy-mm-dd'; d.font = f_s; d.alignment = ctr
        wbs.column_dimensions[ML(m)].width = 11
    wbs.column_dimensions['C'].width = 34; wbs.column_dimensions['D'].width = 24
    T = '$B$4'; S = '$B$5'
    fee_row = lc2 + 2
    SA = '($B$9="Yes")'
    def mv(m): return f'{ML(m)}${HR}'
    MED = lambda m: f'AND(MOD({mv(m)},12)=0,{mv(m)}<{T})'
    sched = [
     ('Recruitment from abroad (visa SAR 2,000 included)', 'الاستقدام من الخارج (يشمل التأشيرة 2,000)', '1 · First advance, separate invoice · الدفعة الأولى بفاتورة منفصلة',
      lambda m: f'=IF(AND({mv(m)}=0,$B$6="Yes"),Recruitment!$B$11,0)'),
     ('Arrival ticket (recruitment from abroad only; actual)', 'تذكرة القدوم (للاستقدام من الخارج فقط؛ بالفعلي)', '1 · First advance · الدفعة الأولى',
      lambda m: f'=IF(AND({mv(m)}=0,$B$6="Yes"),Recruitment!$B$12,0)'),
     ('Sponsorship transfer (government fee)', 'نقل الكفالة (رسم حكومي)', '1 · First advance · الدفعة الأولى',
      lambda m: f'=IF({mv(m)}=0,$B$15,0)'),
     ('Medical insurance — full year', 'التأمين الطبي — سنة كاملة', '2 · One full year in advance · سنة كاملة مقدماً',
      lambda m: f'=IF({MED(m)},$B$13,0)'),
     ('Work permit, levy and iqama', 'رخصة العمل والمقابل المالي والإقامة', '2 · Quarterly / half-yearly / annual, in advance · دورية مقدماً',
      lambda m: f'=IF(AND(MOD({mv(m)},$B$14)=0,{mv(m)}<{T}),(9700+650)/12*MIN($B$14,{T}-{mv(m)}),0)'),
     ('Foreign employee salary (invoiced two months ahead)', 'راتب الموظف الأجنبي (يُفوتَر مقدماً بشهرين)', 'Monthly · شهرياً',
      lambda m: f'=IF({mv(m)}=0,2*{S},IF(AND({mv(m)}>=1,{mv(m)}<={T}-2),{S},0))'),
     ('Foreign employee social insurance (2%, after arrival)', 'التأمينات الاجتماعية على الأجنبي (2%، بعد وصوله)', 'Monthly, after arrival and salary update · شهرياً',
      lambda m: f'=IF(AND({mv(m)}>=1,{mv(m)}<={T}),{S}*0.02,0)'),
     ('Business Partner monthly service fee', 'رسوم خدمة بزنس بارتنر الشهرية', 'Monthly invoice only · الفاتورة الشهرية فقط',
      lambda m: f'=IF(AND({mv(m)}>=1,{mv(m)}<={T}),$B$16,0)'),
     ('Our localisation fee (monthly)', 'رسوم التوطين لدينا (شهرياً)', 'Monthly · شهرياً',
      lambda m: f'=IF(AND({mv(m)}>=1,{mv(m)}<={T}),{CP}B{fee_row},0)'),
     ('VAT 15% on our fees (service fee + localisation)', 'ضريبة 15% على رسومنا (الخدمة + التوطين)', 'Monthly · شهرياً',
      lambda m: f'=IF(AND({mv(m)}>=1,{mv(m)}<={T}),({CP}B{fee_row}+$B$16)*0.15,0)'),
     ('VAT 15% on medical insurance', 'ضريبة 15% على التأمين الطبي', 'With the insurance · مع التأمين',
      lambda m: f'=IF({MED(m)},$B$13*0.15,0)'),
     ('Saudi employee salary', 'راتب الموظف السعودي', 'Per the invoicing choice above · حسب الاختيار أعلاه',
      lambda m: f'=IF(AND({SA},{mv(m)}>=IF($B$11="Advance",0,1),{mv(m)}<=IF($B$11="Advance",{T}-1,{T})),$B$10,0)'),
     ('Saudi employee medical insurance (monthly)', 'التأمين الطبي للسعودي (شهرياً)', 'Monthly · شهرياً',
      lambda m: f'=IF(AND({SA},{mv(m)}>=1,{mv(m)}<={T}),$B$13/12,0)'),
     ('Saudi employee social insurance — separate invoice', 'التأمينات الاجتماعية للسعودي — فاتورة منفصلة', 'Monthly, separate invoice · شهرياً بفاتورة منفصلة',
      lambda m: f'=IF(AND({SA},{mv(m)}>=1,{mv(m)}<={T}),$B$10*$B$12/100,0)'),
     ('End-of-service award (Labour Law arts. 84-87)', 'مكافأة نهاية الخدمة (نظام العمل م84-87)', 'After contract end, separate invoice at actual · بعد نهاية العقد',
      lambda m: f'=IF({mv(m)}={T},{S}/24*{T},0)'),
     ('Leave pay (actual)', 'بدل الإجازة (بالفعلي)', 'After contract end, separate invoice at actual · بعد نهاية العقد',
      lambda m: f'=IF({mv(m)}={T},{S}/30*21/12*{T},0)'),
     ('Return flight ticket (actual)', 'تذكرة العودة (بالفعلي)', 'After contract end, separate invoice at actual · بعد نهاية العقد',
      lambda m: f'=IF({mv(m)}={T},1500/12*{T},0)'),
    ]
    def put_row(r, en, ar, when, fn):
        wbs.cell(r, 1, en).font = f_n; a2 = wbs.cell(r, 2, ar); a2.font = f_n; a2.alignment = rtl
        wbs.cell(r, 3, when).font = f_s
        for cc in (1, 3): wbs.cell(r, cc).alignment = wrap
        for m in range(NM + 1):
            c = wbs.cell(r, FM + m, fn(m)); c.number_format = '#,##0;-#,##0;""'; c.border = box; c.font = f_n
        t = wbs.cell(r, 4, f'=SUM({ML(0)}{r}:{ML(NM)}{r})'); t.number_format = '#,##0'; t.font = f_b; t.border = box
        wbs.row_dimensions[r].height = 30
    r0 = HR + 1
    for i, (en, ar, when, fn) in enumerate(sched): put_row(r0 + i, en, ar, when, fn)
    rl = r0 + len(sched) - 1
    rt = rl + 1
    wbs.cell(rt, 1, 'Total invoiced (SAR)').font = f_b
    wbs.cell(rt, 2, 'إجمالي ما يُفوتَر (ريال)').font = f_b; wbs.cell(rt, 2).alignment = rtl
    for m in range(NM + 1):
        c = wbs.cell(rt, FM + m, f'=SUM({ML(m)}{r0}:{ML(m)}{rl})'); c.number_format = '#,##0;-#,##0;""'; c.font = f_b; c.fill = fill_p; c.border = box
    t = wbs.cell(rt, 4, f'=SUM(D{r0}:D{rl})'); t.number_format = '#,##0'; t.font = f_b; t.fill = fill_p
    put_row(rt + 1, 'Exit and re-entry visa — optional, at contract end (outside the total)', 'تأشيرة الخروج والعودة — اختيارية عند نهاية العقد (خارج الإجمالي)', 'At contract end if renewing · عند التجديد إن لزم',
            lambda m: f'=IF({mv(m)}={T},200,0)')
    wbs.cell(rt + 3, 1, 'Check: total for the term on the Transparent cost sheet (SAR)').font = f_s
    ck = wbs.cell(rt + 3, 4, f'={CP}B{lc2+6}'); ck.number_format = '#,##0'; ck.font = f_s
    wbs.cell(rt + 4, 1, 'Difference (timing and rounding only)').font = f_s
    dk = wbs.cell(rt + 4, 4, f'=D{rt}-D{rt+3}'); dk.number_format = '#,##0'; dk.font = f_s
    note(wbs, rt + 6, 'VAT 15% applies to our service fee, the localisation fee and the medical insurance only; other costs follow the actual invoice (reading of the owner\'s costing decision — to be confirmed). Items "at actual" are invoiced separately as incurred: any document needing attestation, and transport, housing and meal allowance on arrival. Contract-end items are one separate invoice after the contract ends, at the actual total. The signed agreement governs.', 'الضريبة 15% على رسوم خدمتنا ورسوم التوطين والتأمين الطبي فقط؛ وسائر التكاليف بحسب الفاتورة الفعلية (قراءة لقرار الكوستينج للمالك — تُؤكَّد). والبنود «بالفعلي» تُفوتر منفصلة عند حدوثها: أي مستند يحتاج تصديقاً، والمواصلات والسكن وبدل الطعام عند الوصول. وبنود نهاية العقد فاتورة واحدة منفصلة بعد نهايته بالإجمالي الفعلي. والعقد الموقع هو المرجع.', 90)
    wbs.freeze_panes = wbs.cell(HR + 1, FM)
    wc.cell(lc2 + 9, 1, 'Actual invoices, stages, dates and payment frequency follow the "Billing schedule" sheet. The monthly figures above are the average over the term.').font = f_s
    wc.cell(lc2 + 9, 3, 'الفواتير والمراحل والتواريخ ودورية الدفع الفعلية في ورقة «Billing schedule». والأرقام الشهرية أعلاه متوسط على مدة العقد.').font = f_s
    wc.cell(lc2 + 9, 3).alignment = rtl
    wb['Rates'].sheet_state = 'hidden'

# order sheets
order = ['Start', 'Full employee cost', 'Transparent cost'] + (['Billing schedule'] if TRANSPARENT else []) + ['Profession calculator', 'Nitaqat calculator'] + (['Insurance', 'Recruitment'] if TRANSPARENT else []) + (['Cost table'] if INTERNAL else []) + ['Professions', 'Activity data', 'Fees', 'Rates', 'Groups']
wb._sheets = [wb[n] for n in order]
for n in ('Professions', 'Activity data', 'Fees', 'Rates', 'Groups'):
    wb[n].sheet_properties.tabColor = '9DB4FF'
for n in ('Start', 'Full employee cost', 'Transparent cost', 'Profession calculator', 'Nitaqat calculator') + (('Billing schedule',) if TRANSPARENT else ()):
    wb[n].sheet_properties.tabColor = NAVY
wb.save(OUT)
print('saved', OUT, 'professions', NP - 1, 'groups', len(groups))
