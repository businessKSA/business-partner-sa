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
FEE_BY_CAT = {'Standard': 500, 'Administrative': 2000, 'Technical': 1500, 'Engineering': 3000}
rows_p = [('أي مهنة أخرى بلا قرار توطين · Any other profession', 'أي مهنة أخرى', 'لا يوجد دليل', 'No localisation guide', 0, 0, 0, 'Standard', 500, 'Standard fee', '')]
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
FEE_FORMULA = '=IFERROR(IF(ISNUMBER(INDEX(Professions!$I$2:$I$%d,MATCH(B5,Professions!$A$2:$A$%d,0))),INDEX(Professions!$I$2:$I$%d,MATCH(B5,Professions!$A$2:$A$%d,0)),0),0)' % ((NP_LATE,)*4)
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
def price(a, n):
    return (a + (9700 + 650 + 240) / 12 + 600 / 12 + (a / 30 * 21) / 12 + 200 / 12 + 3000 / n + a / 2 / 12 + a * 0.02 + 1500 / 12 + 1000) * (1 + 0.1)

# ---------- 0. Start ----------
ws0 = wb.active; ws0.title = 'Start'
title(ws0, 'Business Partner — Employee Cost & Localisation Calculators', 'بزنس بارتنر — حاسبات تكلفة الموظف والتوطين')
ws0.column_dimensions['A'].width = 58; ws0.column_dimensions['C'].width = 58
lines = [
 ('How to use', 'طريقة الاستخدام'),
 ('Change only the light-blue cells. Everything else is calculated.', 'غيّر الخانات الزرقاء الفاتحة فقط. كل شيء آخر يُحسب تلقائياً.'),
 ('Sheet "Lump sum": one fixed monthly price per employee (Model 2), for 6, 12 or 24 months.', 'ورقة «Lump sum»: سعر شهري ثابت لكل موظف (النموذج الثاني) لمدة 6 أو 12 أو 24 شهراً.'),
 ('Sheet "Cost plus": monthly invoice at actual cost plus our localisation fee (Model 1).', 'ورقة «Cost plus»: فاتورة شهرية بالتكلفة الفعلية زائد رسم التوطين (النموذج الأول).'),
 ('Sheet "By profession": the localisation ratio, minimum Saudi salary and our fee for each profession.', 'ورقة «By profession»: نسبة التوطين والحد الأدنى لأجر السعودي ورسمنا لكل مهنة.'),
 ('Sheet "By activity": the Nitaqat band percentages and Saudi headcount for your activity group.', 'ورقة «By activity»: نسب نطاقات وعدد السعوديين المطلوب لمجموعة نشاطك.'),
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
for j, n in enumerate((6, 12, 24)): wr.cell(1, 2 + j, n)
pk = list(range(1000, 20001, 1000))
for i, a in enumerate(pk, 2):
    wr.cell(i, 1, a)
    for j, n in enumerate((6, 12, 24)):
        wr.cell(i, 2 + j, round(price(a, n), 8))
hdr(wr, 1, ['Total monthly package (SAR)', 6, 12, 24])
RL = len(pk) + 1
wr.column_dimensions['A'].width = 30
for col in 'BCD': wr.column_dimensions[col].width = 18
wr['F1'] = 'Monthly price excl. VAT by contract term in months (reference table used by the Lump sum sheet).'
wr['F1'].font = f_s
wr.sheet_state = 'visible'

# ---------- Fees ----------
wf = wb.create_sheet('Fees')
hdr(wf, 1, ['Category', 'Fee per month excl. VAT (SAR)', 'Notes', 'Professional accreditation'])
fees_rows = [('None', 0, 'No localisation fee'), ('Standard', 500, 'Profession without a localisation decision'),
             ('Administrative', 2000, 'Purchasing, sales, marketing, accounting'),
             ('Technical', 1500, 'Technical engineering professions'),
             ('Engineering', 3000, 'Engineering professions')]
for i, r in enumerate(fees_rows, 2):
    for j, v in enumerate(r, 1): wf.cell(i, j, v)
wf.column_dimensions['A'].width = 20; wf.column_dimensions['B'].width = 30; wf.column_dimensions['C'].width = 50

# ---------- Lump sum ----------
ws = wb.create_sheet('Lump sum', 1)
title(ws, 'Foreign employee — monthly price (Model 2: lump sum)', 'الموظف الأجنبي — السعر الشهري (النموذج الثاني: مبلغ مقطوع)')
note(ws, 2, 'Change the light-blue cells only.', 'غيّر الخانات الزرقاء الفاتحة فقط.', 20)
row(ws, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', inp=True, fmt='#,##0')
row(ws, 4, 'Contract term in months (6, 12 or 24)', 12, 'مدة العقد بالأشهر (6 أو 12 أو 24)', inp=True)
row(ws, 5, 'Profession (localisation fee is added on top)', rows_p[0][0], 'المهنة (رسم التوطين يُضاف فوق السعر)', inp=True)
row(ws, 6, 'External recruitment costs, total actual (SAR) — 0 if the employee is already in the Kingdom', 0, 'تكاليف الاستقدام من الخارج الفعلية الإجمالية (ريال) — 0 إن كان الموظف داخل المملكة', inp=True, fmt=NUM)
row(ws, 7, 'Contracts and attestation costs, total actual (SAR)', 0, 'تكاليف العقود والتصديق الفعلية الإجمالية (ريال)', inp=True, fmt=NUM)
row(ws, 8, 'Arrival ticket, total actual (SAR)', 2000, 'تذكرة القدوم الفعلية (ريال)', inp=True, fmt=NUM)
EXTRA = '(B6+B7+B8)/B4*1.1'
if INTERNAL:
    ex = '(B3+(9700+650+240)/12+600/12+(B3/30*21)/12+200/12+3000/B4+B3/2/12+B3*2%+1500/12+1000+(B6+B7+B8)/B4)*(1+0.1)'
    row(ws, 9, 'Monthly price before localisation, excl. VAT (SAR)', '=MROUND(' + ex + ',10)', 'السعر الشهري قبل التوطين قبل الضريبة (ريال)', bold=True, fmt=NUM)
    row(ws, 10, 'Cost before the 10% (INTERNAL)', '=(B3+(9700+650+240)/12+600/12+(B3/30*21)/12+200/12+3000/B4+B3/2/12+B3*2%+1500/12+1000+(B6+B7+B8)/B4)', 'التكلفة قبل الـ10% (داخلي)', fmt=NUM)
    row(ws, 11, 'Localisation fee per month, added on top (SAR)', FEE_FORMULA, 'رسم التوطين شهرياً يُضاف فوق السعر (ريال)', fmt=NUM)
    o = 11
else:
    row(ws, 9, 'Monthly price before localisation, excl. VAT (SAR)',
        f'=MROUND(FORECAST(B3,INDEX(Rates!$B$2:$D${RL},0,MATCH(B4,Rates!$B$1:$D$1,0)),Rates!$A$2:$A${RL})+{EXTRA},10)',
        'السعر الشهري قبل التوطين قبل الضريبة (ريال)', bold=True, fmt=NUM)
    row(ws, 10, 'Localisation fee per month, added on top (SAR)', FEE_FORMULA, 'رسم التوطين شهرياً يُضاف فوق السعر (ريال)', fmt=NUM)
    o = 10
row(ws, o + 1, 'Monthly price incl. localisation fee, excl. VAT (SAR)', f'=B9+B{o}', 'السعر الشهري شامل رسم التوطين قبل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(ws, o + 2, 'VAT 15% (SAR)', f'=B{o+1}*0.15', 'ضريبة القيمة المضافة 15% (ريال)', fmt=NUM)
row(ws, o + 3, 'Monthly price incl. VAT (SAR)', f'=B{o+1}+B{o+2}', 'السعر الشهري شامل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(ws, o + 4, 'Total for the term excl. VAT (SAR)', f'=B{o+1}*B4', 'الإجمالي للمدة قبل الضريبة (ريال)', fmt=NUM)
row(ws, o + 5, 'Two months in advance excl. VAT (SAR)', f'=B{o+1}*2', 'شهران مقدماً قبل الضريبة (ريال)', fmt=NUM)
r0 = o + 7
ws.cell(r0, 1, 'Same package by term — monthly price excl. VAT').font = f_b
ws.cell(r0, 3, 'نفس الراتب بحسب المدة — السعر الشهري قبل الضريبة').font = f_b; ws.cell(r0, 3).alignment = rtl
for k, (n, col) in enumerate(((6, 'B'), (12, 'C'), (24, 'D'))):
    if not INTERNAL:
        base = f'MROUND(FORECAST($B$3,Rates!${col}$2:${col}${RL},Rates!$A$2:$A${RL})+(B6+B7+B8)/{n}*1.1,10)'
    else:
        base = f'MROUND((B3+(9700+650+240)/12+600/12+(B3/30*21)/12+200/12+3000/{n}+B3/2/12+B3*2%+1500/12+1000+(B6+B7+B8)/{n})*(1+0.1),10)'
    row(ws, r0 + 1 + k, f'{n} months', f'={base}+B{o}', f'{n} أشهر' if n == 6 else f'{n} شهراً', fmt=NUM)
note(ws, r0 + 5, 'The monthly price covers salary and allowances, work permit and levy, residency, medical and social insurance, end of service, leave pay, tickets and exit and re-entry visa, transfer, visa and recruitment costs, contracts and attestation, and our service fee. The price changes with the term because transfer and visa fees are spread over the contract months. The localisation fee is added on top of the price and follows the profession (see "By profession"); Saudi-only professions are not transferred and professions outside our approved categories are quoted on request.',
     'السعر الشهري يشمل الراتب والبدلات، ورخصة العمل والمقابل المالي، والإقامة، والتأمين الطبي والاجتماعي، ومكافأة نهاية الخدمة، وبدل الإجازة، وتذاكر الطيران والخروج والعودة، وتكاليف النقل والتأشيرة والاستقدام، والعقود والتصديق، ورسم خدمتنا. ويتغير السعر بتغير المدة لأن رسوم النقل والتأشيرة تُقسَّم على أشهر العقد. ويُضاف رسم التوطين فوق السعر بحسب المهنة (انظر «By profession»)، والمهن المقصورة على السعوديين لا يُنقل إليها أجنبي، والمهن خارج فئاتنا المعتمدة تُحدَّد عند الطلب.', 110)
dv = DataValidation(type='list', formula1='"6,12,24"', allow_blank=False); ws.add_data_validation(dv); dv.add('B4')
dv2 = DataValidation(type='list', formula1='=Professions!$A$2:$A$%d' % NP_LATE, allow_blank=False); ws.add_data_validation(dv2); dv2.add('B5')
dv3 = DataValidation(type='decimal', operator='greaterThan', formula1='0'); ws.add_data_validation(dv3); dv3.add('B3')

# ---------- Cost plus ----------
wc = wb.create_sheet('Cost plus', 2)
title(wc, 'Foreign employee — monthly invoice (Model 1: cost plus)', 'الموظف الأجنبي — الفاتورة الشهرية (النموذج الأول: تكلفة زائد)')
note(wc, 2, 'Change the light-blue cells only. Items that do not apply (for example recruitment from abroad for an employee already in the Kingdom) stay at 0.', 'غيّر الخانات الزرقاء الفاتحة فقط. والبنود التي لا تنطبق (مثل الاستقدام من الخارج لموظف داخل المملكة) اتركها 0.', 34)
row(wc, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', inp=True, fmt='#,##0')
row(wc, 4, 'Contract term in months (6, 12 or 24)', 12, 'مدة العقد بالأشهر (6 أو 12 أو 24)', inp=True)
row(wc, 5, 'Medical insurance per month (SAR) — per insurer quote by age, class and gender', 0, 'التأمين الطبي شهرياً (ريال) — حسب عرض شركة التأمين: العمر والفئة والجنس', inp=True, fmt=NUM)
row(wc, 6, 'Transfer and visa fees, total actual (SAR)', 3000, 'رسوم النقل والتأشيرة الفعلية الإجمالية (ريال)', inp=True, fmt=NUM)
row(wc, 7, 'Profession (our localisation fee)', rows_p[0][0], 'المهنة (رسم التوطين لدينا)', inp=True)
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
row(wc, last + 2, 'Our localisation fee, excl. VAT', FEE_FORMULA_C, 'رسم التوطين لدينا قبل الضريبة', fmt=NUM)
row(wc, last + 3, 'VAT 15% on our fee only', f'=B{last+2}*0.15', 'ضريبة 15% على رسمنا فقط', fmt=NUM)
row(wc, last + 4, 'Total monthly invoice (SAR)', f'=B{last+1}+B{last+2}+B{last+3}', 'إجمالي الفاتورة الشهرية (ريال)', bold=True, fmt=NUM, shade=True)
row(wc, last + 5, 'Total for the term (SAR)', f'=B{last+4}*B4', 'الإجمالي للمدة (ريال)', fmt=NUM)
row(wc, last + 6, 'Two months in advance (SAR)', f'=B{last+4}*2', 'شهران مقدماً (ريال)', fmt=NUM)
note(wc, last + 7, 'Each item is invoiced separately at actual cost; government fees carry no VAT and VAT applies only to our fee. One-off items (transfer, recruitment, attestation, arrival ticket) are spread over the contract months, so the monthly share changes with the term. Medical insurance follows the insurer quote.',
     'كل بند يُفوتر منفصلاً بالتكلفة الفعلية؛ والرسوم الحكومية بلا ضريبة والضريبة على رسمنا فقط. والبنود لمرة واحدة (النقل والاستقدام والتصديق وتذكرة القدوم) تُقسَّم على أشهر العقد فتتغير حصتها الشهرية بالمدة. والتأمين الطبي حسب عرض شركة التأمين.', 80)
dv_c = DataValidation(type='list', formula1='"6,12,24"'); wc.add_data_validation(dv_c); dv_c.add('B4')
dv_c2 = DataValidation(type='list', formula1='=Professions!$A$2:$A$%d' % NP_LATE); wc.add_data_validation(dv_c2); dv_c2.add('B7')

# ---------- Professions ----------
wp = wb.create_sheet('Professions')
hdr(wp, 1, ['Profession · guide', 'Profession', 'Guide (Arabic)', 'Guide (English)', 'Ratio %', 'Min workers', 'Min Saudi salary (SAR)', 'Category', 'Fee per month excl. VAT (SAR)', 'Notes', 'Professional accreditation'])
for i, r in enumerate(rows_p, 2):
    for j, v in enumerate(r, 1): wp.cell(i, j, v)
NP = len(rows_p) + 1
for col, w in zip('ABCDEFGHIJK', (60, 34, 34, 28, 10, 12, 18, 16, 22, 60, 40)): wp.column_dimensions[col].width = w
wp.freeze_panes = 'B2'

# ---------- By profession ----------
wl = wb.create_sheet('By profession', 3)
title(wl, 'Localisation by profession', 'التوطين بحسب المهنة')
note(wl, 2, 'Choose the profession from the list in cell B3. Change the light-blue cells only.', 'اختر المهنة من القائمة في الخانة B3. غيّر الخانات الزرقاء الفاتحة فقط.', 22)
row(wl, 3, 'Profession · guide (choose from the list)', rows_p[0][0], 'المهنة · الدليل (اختر من القائمة)', inp=True)
wl['B3'].alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); wl.column_dimensions['B'].width = 46
wl.row_dimensions[3].height = 48
row(wl, 4, 'Foreign employees to transfer in this profession', 1, 'عدد الموظفين الأجانب المراد نقلهم في هذه المهنة', inp=True)
row(wl, 5, 'Total workers in this profession at your company (Saudi + foreign)', 1, 'إجمالي العاملين في هذه المهنة لدى شركتك (سعودي + أجنبي)', inp=True)
row(wl, 6, 'Contract term in months', 12, 'مدة العقد بالأشهر', inp=True)
look = lambda col: f'=INDEX(Professions!${col}$2:${col}${NP},MATCH($B$3,Professions!$A$2:$A${NP},0))'
row(wl, 7, 'Guide', look('C'), 'الدليل')
row(wl, 8, 'Localisation ratio', f'=INDEX(Professions!$E$2:$E${NP},MATCH($B$3,Professions!$A$2:$A${NP},0))/100', 'نسبة التوطين', fmt='0%')
row(wl, 9, 'Minimum workers for the ratio to apply', look('F'), 'الحد الأدنى للعاملين لسريان النسبة')
row(wl, 10, 'Minimum Saudi salary counted (SAR)', '=IF(INDEX(Professions!$G$2:$G$%d,MATCH($B$3,Professions!$A$2:$A$%d,0))=0,"None stated",INDEX(Professions!$G$2:$G$%d,MATCH($B$3,Professions!$A$2:$A$%d,0)))' % (NP,NP,NP,NP), 'الحد الأدنى لأجر السعودي المحتسب (ريال)', fmt='#,##0')
row(wl, 11, 'Category', look('H'), 'الفئة')
row(wl, 12, 'Our fee per employee per month, excl. VAT (SAR)',
    f'=IF(B11="Saudi-only","Not transferable",IF(B11="On request","Quoted on request",INDEX(Professions!$I$2:$I${NP},MATCH($B$3,Professions!$A$2:$A${NP},0))))',
    'رسمنا لكل موظف شهرياً قبل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(wl, 13, 'Our monthly fee for these employees, excl. VAT (SAR)', '=IF(ISNUMBER(B12),B12*B4,B12)', 'رسمنا الشهري لهؤلاء الموظفين قبل الضريبة (ريال)', bold=True, fmt=NUM)
row(wl, 14, 'VAT 15% (SAR)', '=IF(ISNUMBER(B13),B13*0.15,"—")', 'ضريبة 15% (ريال)', fmt=NUM)
row(wl, 15, 'Monthly fee incl. VAT (SAR)', '=IF(ISNUMBER(B13),B13+B14,"—")', 'الرسم الشهري شامل الضريبة (ريال)', bold=True, fmt=NUM, shade=True)
row(wl, 16, 'Fee for the term excl. VAT (SAR)', '=IF(ISNUMBER(B13),B13*B6,"—")', 'الرسم للمدة قبل الضريبة (ريال)', fmt=NUM)
row(wl, 17, 'Saudis required by the ratio (indicative, rounded up)', '=IF(B5>=B9,ROUNDUP(B5*B8,0),0)', 'عدد السعوديين المطلوب بالنسبة (استرشادي، تقريب للأعلى)')
row(wl, 18, 'Notes from the guide', look('J'), 'ملاحظات الدليل')
wl.row_dimensions[18].height = 90; wl['B18'].alignment = Alignment(wrap_text=True, vertical='top', horizontal='left')
wl.row_dimensions[7].height = 34
note(wl, 19, 'Localisation ratios and minimum salaries come from the Ministry of Human Resources procedural guides. A Saudi paid below the minimum is not counted toward the ratio. Saudi-only professions (human resources, secretarial, reception, customer service and similar) are not transferred to foreign employees. Fees for professions outside our approved categories are quoted on request. Accounting steps up in stages (40%, then 50% from 27/10/2026, 60%, 70%) and project management moves to 70% from 14/02/2027.',
     'نسب التوطين والحد الأدنى للأجور من الأدلة الإجرائية لوزارة الموارد البشرية. والسعودي الذي يقل أجره عن الحد الأدنى لا يُحتسب ضمن النسبة. والمهن المقصورة على السعوديين (الموارد البشرية والسكرتارية والاستقبال وخدمة العملاء وما شابهها) لا يُنقل إليها أجنبي. ورسوم المهن خارج فئاتنا المعتمدة تُحدَّد عند الطلب. والمحاسبة تتدرج (40% ثم 50% من 27/10/2026 ثم 60% ثم 70%)، وإدارة المشاريع 70% من 14/02/2027.', 150)
dvp = DataValidation(type='list', formula1=f'=Professions!$A$2:$A${NP}', allow_blank=False); wl.add_data_validation(dvp); dvp.add('B3')
dvm = DataValidation(type='list', formula1='"6,12,24"'); wl.add_data_validation(dvm); dvm.add('B6')

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

# ---------- By activity ----------
wa = wb.create_sheet('By activity', 4)
title(wa, 'Localisation by activity (Nitaqat)', 'التوطين بحسب النشاط (نطاقات)')
note(wa, 2, 'Choose your activity group in B3. Change the light-blue cells only.', 'اختر مجموعة نشاطك في B3. غيّر الخانات الزرقاء الفاتحة فقط.', 22)
row(wa, 3, 'Activity group (choose from the list)', 'الصناعات', 'مجموعة النشاط (اختر من القائمة)', inp=True)
row(wa, 4, 'Total workforce (Saudi + foreign)', 30, 'إجمالي العاملين (سعودي + أجنبي)', inp=True)
row(wa, 5, 'Year', 2026, 'السنة', inp=True)
row(wa, 6, 'Current number of Saudi employees', 0, 'عدد الموظفين السعوديين الحاليين', inp=True)
wa.cell(7, 1, 'Band').font = f_b
for j, t in enumerate(('Minimum Saudi %', 'Saudis needed'), 2): pass
hdr(wa, 7, ['Band', 'Minimum Saudi % (Y = M·ln X + C)', 'الحد الأدنى للسعودة %'])
wa.cell(7, 4, 'Saudis needed'); wa.cell(7, 5, 'Gap vs current Saudis')
for cidx in (4, 5):
    c = wa.cell(7, cidx); c.font = Font(name='Arial', bold=True, color='FFFFFF', size=10); c.fill = fill_h; c.alignment = ctr
wa.column_dimensions['D'].width = 18; wa.column_dimensions['E'].width = 22
bands = [('light_green', 'Light green', 'أخضر منخفض'), ('medium_green', 'Medium green', 'أخضر متوسط'), ('high_green', 'High green', 'أخضر مرتفع'), ('platinum', 'Platinum', 'بلاتيني')]
rngA = f"'Activity data'!$A$2:$A${ND}"; rngB = f"'Activity data'!$B$2:$B${ND}"
for k, (code, en, ar) in enumerate(bands, 8):
    m = f"SUMIFS('Activity data'!$C$2:$C${ND},{rngA},$B$3,{rngB},\"{code}\")"
    cc = f"CHOOSE($B$5-2025,SUMIFS('Activity data'!$D$2:$D${ND},{rngA},$B$3,{rngB},\"{code}\"),SUMIFS('Activity data'!$E$2:$E${ND},{rngA},$B$3,{rngB},\"{code}\"),SUMIFS('Activity data'!$F$2:$F${ND},{rngA},$B$3,{rngB},\"{code}\"))"
    a = wa.cell(k, 1, en); a.font = f_b; a.border = box; a.alignment = wrap
    b = wa.cell(k, 2, f'=ROUND(MIN(100,MAX(0,{m}*LN(MAX($B$4,1))+{cc})),2)'); b.number_format = '0.00'; b.alignment = ctr; b.border = box; b.font = f_b
    c = wa.cell(k, 3, ar); c.font = f_n; c.alignment = rtl; c.border = box
    d = wa.cell(k, 4, f'=ROUNDUP(B{k}/100*$B$4,0)'); d.alignment = ctr; d.border = box; d.font = f_b
    e = wa.cell(k, 5, f'=MAX(0,D{k}-$B$6)'); e.alignment = ctr; e.border = box
    wa.row_dimensions[k].height = 26
row(wa, 12, 'Current Saudisation %', '=IF($B$4>0,ROUND($B$6/$B$4*100,2),0)', 'نسبة السعودة الحالية %', fmt='0.00')
row(wa, 13, 'Current band', '=IF(B12>=B11,"Platinum",IF(B12>=B10,"High green",IF(B12>=B9,"Medium green",IF(B12>=B8,"Light green","Red"))))', 'النطاق الحالي', bold=True, shade=True)
note(wa, 14, 'Nitaqat bands follow the Ministry formula Y = M·ln(X) + C per activity group and year. The group for your commercial activity (ISIC code) must be confirmed on the Ministry tool; the group listed here is a selection, not a determination.',
     'نطاقات تتبع معادلة الوزارة Y = M·ln(X) + C لكل مجموعة نشاط وسنة. ويجب تأكيد مجموعة نشاطك التجاري (رمز ISIC) من أداة الوزارة؛ فالمجموعة المعروضة هنا اختيار وليست تحديداً.', 90)
dva = DataValidation(type='list', formula1=f'=Groups!$A$2:$A${len(groups)+1}'); wa.add_data_validation(dva); dva.add('B3')
dvy = DataValidation(type='list', formula1='"2026,2027,2028"'); wa.add_data_validation(dvy); dvy.add('B5')

for _n in ('Lump sum','Cost plus'):
    wb[_n].column_dimensions['B'].width = 46
    wb[_n]['B5'].alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
    wb[_n].row_dimensions[5 if _n=='Lump sum' else 7].height = 48
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
    tr(3, 'Contract term in months (6, 12 or 24)', 12, 'Input', inp=True, fmt='0')
    wt['A4'] = 'Component'; wt['B4'] = 'Cost'; wt['C4'] = 'Basis'
    for q in ('A4', 'B4', 'C4'):
        wt[q].font = Font(name='Arial', bold=True, color='FFFFFF'); wt[q].fill = fill_h; wt[q].alignment = ctr
    comp = [
     ('Salary', '=B2', 'Total monthly package'),
     ('Visa and joining fee', '=3000/B3', 'SAR 3,000 ÷ contract months'),
     ('Iqamah + LL + Ajeer', '=(9700+650+240)/12', '(9,700 levy and permit + 650 iqama + 240 Ajeer) ÷ 12'),
     ('Insurance', '=600/12', 'SAR 600 ÷ 12'),
     ('Re-entry visa', '=200/12', 'SAR 200 ÷ 12'),
     ('EOS', '=B2/24', 'Salary ÷ 24'),
     ('Leave pay', '=B2/30*21/12', '21 days a year'),
     ('Return ticket', '=1500/12', 'SAR 1,500 ÷ 12'),
     ('Arrival ticket', '=2000/B3', 'SAR 2,000 ÷ contract months'),
     ('Gosi', '=B2*2%', '2% of salary'),
     ('Overhead', 1000, 'SAR 1,000 per employee per month'),
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
    dvt = DataValidation(type='list', formula1='"6,12,24"'); wt.add_data_validation(dvt); dvt.add('B3')

if TRANSPARENT:
    del wb['Lump sum']; del wb['Cost plus']
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
    # ---- Lump sum (transparent) ----
    ws = wb.create_sheet('Lump sum', 1)
    t4(ws, 'Foreign employee — monthly price (Model 2: lump sum)', 'الموظف الأجنبي — السعر الشهري (النموذج الثاني: مبلغ مقطوع)', '', '')
    r4(ws, 2, 'Change the light-blue cells only. The calculation is shown line by line, so you can follow how the salary drives the price.', 'غيّر الخانات الزرقاء الفاتحة فقط. والحسبة معروضة سطراً بسطر لتتبع كيف يؤثر الراتب على السعر.', 'Formulas are visible in every cell.')
    ws.row_dimensions[2].height = 40
    r4(ws, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', 'The variable that drives the price', inp=True, fmt='#,##0')
    r4(ws, 4, 'Contract term in months (6, 12 or 24)', 12, 'مدة العقد بالأشهر (6 أو 12 أو 24)', 'One-off fees are spread over this term', inp=True)
    r4(ws, 5, 'Profession (localisation fee is added on top)', rows_p[0][0], 'المهنة (رسم التوطين يُضاف فوق السعر)', 'See "By profession"', inp=True)
    r4(ws, 6, 'Recruited from abroad? (Yes or No)', 'No', 'مستقدَم من الخارج؟ (Yes أو No)', 'Yes uses the "Recruitment" sheet', inp=True)
    r4(ws, 7, 'Use the "Insurance" sheet estimate? (Yes or No)', 'Yes', 'استعمال تقدير ورقة «Insurance»؟ (Yes أو No)', 'No uses SAR 600 per year', inp=True)
    ws.cell(9, 1, 'Cost component per month').font = f_b; ws.cell(9, 3, 'بند التكلفة الشهري').font = f_b; ws.cell(9, 3).alignment = rtl
    comp = [
     ('Salary', '=B3', 'الراتب', 'Total monthly package'),
     ('Iqama + work permit and levy + Ajeer', '=(9700+650+240)/12', 'الإقامة + رخصة العمل والمقابل المالي + أجير', '(9,700 levy and permit + 650 iqama + 240 Ajeer) ÷ 12'),
     ('Medical insurance', '=IF(B7="Yes",Insurance!B13,600/12)', 'التأمين الطبي', 'Insurance sheet (age, sex, nationality, class) or SAR 600 ÷ 12'),
     ('Re-entry visa', '=200/12', 'تأشيرة الخروج والعودة', 'SAR 200 ÷ 12'),
     ('End of service', '=B3/24', 'مكافأة نهاية الخدمة', 'Salary ÷ 24 (half a month a year for the first five years)'),
     ('Leave pay', '=B3/30*21/12', 'بدل الإجازة', '21 days a year: salary ÷ 30 × 21 ÷ 12'),
     ('Social insurance (GOSI), foreign', '=B3*2%', 'التأمينات الاجتماعية للأجنبي', '2% of salary'),
     ('Return flight ticket', '=1500/12', 'تذكرة الطيران (العودة)', 'SAR 1,500 ÷ 12'),
     ('Visa and joining fee', '=3000/B4', 'رسوم التأشيرة والالتحاق', 'SAR 3,000 ÷ contract months'),
     ('Recruitment from abroad', '=IF(B6="Yes",Recruitment!B11,0)/B4', 'الاستقدام من الخارج', 'Recruitment sheet total ÷ contract months'),
     ('Arrival ticket', '=IF(B6="Yes",Recruitment!B12,2000)/B4', 'تذكرة القدوم', 'SAR 2,000 (or the country value) ÷ contract months'),
     ('Operating and management costs', 1000, 'التكاليف التشغيلية والإدارية', 'SAR 1,000 per employee per month'),
    ]
    for i, (e, v, a, h) in enumerate(comp, 10): r4(ws, i, e, v, a, h, fmt=NUM)
    lc = 10 + len(comp) - 1
    R = lc + 1
    r4(ws, R, 'Total cost per month (SAR)', f'=SUM(B10:B{lc})', 'إجمالي التكلفة الشهرية (ريال)', 'Sum of the lines above', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 1, 'Service fee 10% (SAR)', f'=B{R}*0.1', 'رسم الخدمة 10% (ريال)', 'Total cost × 10%', fmt=NUM)
    r4(ws, R + 2, 'Monthly price before localisation, excl. VAT (SAR)', f'=MROUND(B{R}+B{R+1},10)', 'السعر الشهري قبل التوطين قبل الضريبة (ريال)', 'Total cost + 10%, rounded to the nearest 10', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 3, 'Localisation fee per month, added on top (SAR)', FEE_FORMULA, 'رسم التوطين شهرياً يُضاف فوق السعر (ريال)', 'By profession', fmt=NUM)
    r4(ws, R + 4, 'Monthly price incl. localisation fee, excl. VAT (SAR)', f'=B{R+2}+B{R+3}', 'السعر الشهري شامل رسم التوطين قبل الضريبة (ريال)', '', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 5, 'VAT 15% (SAR)', f'=B{R+4}*0.15', 'ضريبة القيمة المضافة 15% (ريال)', '', fmt=NUM)
    r4(ws, R + 6, 'Monthly price incl. VAT (SAR)', f'=B{R+4}+B{R+5}', 'السعر الشهري شامل الضريبة (ريال)', '', bold=True, fmt=NUM, shade=True)
    r4(ws, R + 7, 'Total for the term excl. VAT (SAR)', f'=B{R+4}*B4', 'الإجمالي للمدة قبل الضريبة (ريال)', '', fmt=NUM)
    r4(ws, R + 8, 'Two months in advance excl. VAT (SAR)', f'=B{R+4}*2', 'شهران مقدماً قبل الضريبة (ريال)', '', fmt=NUM)
    cmp0 = R + 10
    ws.cell(cmp0, 1, 'Same package by term — monthly price excl. VAT').font = f_b
    ws.cell(cmp0, 3, 'نفس الراتب بحسب المدة — السعر الشهري قبل الضريبة').font = f_b; ws.cell(cmp0, 3).alignment = rtl
    fixed = f'(SUM(B10:B{lc})-B18-B19-B20)'
    oneoff = '(3000+IF(B6="Yes",Recruitment!B11,0)+IF(B6="Yes",Recruitment!B12,2000))'
    for k, n in enumerate((6, 12, 24)):
        r4(ws, cmp0 + 1 + k, f'{n} months', f'=MROUND(({fixed}+{oneoff}/{n})*1.1,10)+B{R+3}', f'{n} أشهر' if n == 6 else f'{n} شهراً', 'Fixed monthly costs + one-off costs ÷ months, plus 10%, plus localisation', fmt=NUM)
    note(ws, cmp0 + 5, 'Indicative. The signed proposal and agreement govern. Saudi-only professions are not transferred to foreign employees, and professions outside our approved categories are quoted on request.', 'استرشادي. والعرض والعقد الموقّعان هما المرجع. والمهن المقصورة على السعوديين لا يُنقل إليها أجنبي، والمهن خارج فئاتنا المعتمدة تُحدَّد عند الطلب.', 50)
    for rng, lst in (('B4', '"6,12,24"'), ('B5', f'={PRO}'), ('B6', '"Yes,No"'), ('B7', '"Yes,No"')):
        dvz = DataValidation(type='list', formula1=lst); ws.add_data_validation(dvz); dvz.add(rng)
    ws['B5'].alignment = ctr; ws.row_dimensions[5].height = 48
    # ---- Cost plus (transparent) ----
    wc = wb.create_sheet('Cost plus', 2)
    t4(wc, 'Foreign employee — monthly invoice (Model 1: cost plus)', 'الموظف الأجنبي — الفاتورة الشهرية (النموذج الأول: تكلفة زائد)', '', '')
    r4(wc, 2, 'Change the light-blue cells only. Each item is invoiced separately at actual cost.', 'غيّر الخانات الزرقاء الفاتحة فقط. وكل بند يُفوتر منفصلاً بالتكلفة الفعلية.', 'Government fees carry no VAT; VAT applies only to our fee.')
    r4(wc, 3, 'Total monthly package (SAR)', 6000, 'إجمالي الراتب الشهري (ريال)', '', inp=True, fmt='#,##0')
    r4(wc, 4, 'Contract term in months (6, 12 or 24)', 12, 'مدة العقد بالأشهر (6 أو 12 أو 24)', '', inp=True)
    r4(wc, 5, 'Profession (our localisation fee)', rows_p[0][0], 'المهنة (رسم التوطين لدينا)', 'See "By profession"', inp=True)
    r4(wc, 6, 'Recruited from abroad? (Yes or No)', 'No', 'مستقدَم من الخارج؟ (Yes أو No)', 'Yes uses the "Recruitment" sheet', inp=True)
    r4(wc, 7, 'Use the "Insurance" sheet estimate? (Yes or No)', 'Yes', 'استعمال تقدير ورقة «Insurance»؟ (Yes أو No)', 'No uses SAR 600 per year', inp=True)
    wc.cell(9, 1, 'Costs at actual — no VAT').font = f_b; wc.cell(9, 3, 'التكاليف بالتكلفة الفعلية — بلا ضريبة').font = f_b; wc.cell(9, 3).alignment = rtl
    items = [
     ('Salary', '=B3', 'الراتب', 'Total monthly package'),
     ('Iqama + work permit and levy', '=(9700+650)/12', 'الإقامة + رخصة العمل والمقابل المالي', '(9,700 levy and permit + 650 iqama) ÷ 12'),
     ('Medical insurance', '=IF(B7="Yes",Insurance!B13,600/12)', 'التأمين الطبي', 'Insurance sheet or SAR 600 ÷ 12'),
     ('Social insurance (GOSI), foreign', '=B3*0.02', 'التأمينات الاجتماعية للأجنبي', '2% of salary'),
     ('End of service', '=B3/24', 'مكافأة نهاية الخدمة', 'Salary ÷ 24'),
     ('Leave pay', '=B3/30*21/12', 'بدل الإجازة', '21 days a year'),
     ('Exit and re-entry visa', '=200/12', 'تأشيرة الخروج والعودة', 'SAR 200 ÷ 12'),
     ('Return flight ticket', '=1500/12', 'تذكرة الطيران (العودة)', 'SAR 1,500 ÷ 12'),
     ('Transfer and visa fees', '=3000/B4', 'رسوم النقل والتأشيرة', 'Actual fee (SAR 3,000 shown) ÷ contract months'),
     ('Recruitment from abroad', '=IF(B6="Yes",Recruitment!B11,0)/B4', 'الاستقدام من الخارج', 'Recruitment sheet total ÷ contract months'),
     ('Arrival ticket', '=IF(B6="Yes",Recruitment!B12,2000)/B4', 'تذكرة القدوم', 'SAR 2,000 (or the country value) ÷ contract months'),
    ]
    for i, (e, v, a, h) in enumerate(items, 10): r4(wc, i, e, v, a, h, fmt=NUM)
    lc2 = 10 + len(items) - 1
    r4(wc, lc2 + 1, 'Total costs at actual (no VAT)', f'=SUM(B10:B{lc2})', 'إجمالي التكاليف بالفعلي (بلا ضريبة)', '', bold=True, fmt=NUM, shade=True)
    r4(wc, lc2 + 2, 'Our localisation fee, excl. VAT', FEE_FORMULA.replace('B5', 'B5'), 'رسم التوطين لدينا قبل الضريبة', 'By profession', fmt=NUM)
    r4(wc, lc2 + 3, 'VAT 15% on our fee only', f'=B{lc2+2}*0.15', 'ضريبة 15% على رسمنا فقط', '', fmt=NUM)
    r4(wc, lc2 + 4, 'Total monthly invoice (SAR)', f'=B{lc2+1}+B{lc2+2}+B{lc2+3}', 'إجمالي الفاتورة الشهرية (ريال)', '', bold=True, fmt=NUM, shade=True)
    r4(wc, lc2 + 5, 'Total for the term (SAR)', f'=B{lc2+4}*B4', 'الإجمالي للمدة (ريال)', '', fmt=NUM)
    r4(wc, lc2 + 6, 'Two months in advance (SAR)', f'=B{lc2+4}*2', 'شهران مقدماً (ريال)', '', fmt=NUM)
    for rng, lst in (('B4', '"6,12,24"'), ('B5', f'={PRO}'), ('B6', '"Yes,No"'), ('B7', '"Yes,No"')):
        dvz = DataValidation(type='list', formula1=lst); wc.add_data_validation(dvz); dvz.add(rng)
    wc['B5'].alignment = ctr; wc.row_dimensions[5].height = 48
    wb['Rates'].sheet_state = 'hidden'

# order sheets
order = ['Start', 'Lump sum', 'Cost plus', 'By profession', 'By activity'] + (['Insurance', 'Recruitment'] if TRANSPARENT else []) + (['Cost table'] if INTERNAL else []) + ['Professions', 'Activity data', 'Fees', 'Rates', 'Groups']
wb._sheets = [wb[n] for n in order]
for n in ('Professions', 'Activity data', 'Fees', 'Rates', 'Groups'):
    wb[n].sheet_properties.tabColor = '9DB4FF'
for n in ('Start', 'Lump sum', 'Cost plus', 'By profession', 'By activity'):
    wb[n].sheet_properties.tabColor = NAVY
wb.save(OUT)
print('saved', OUT, 'professions', NP - 1, 'groups', len(groups))
