# -*- coding: utf-8 -*-
import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _helpers import *
OUTNAME='REV-client-data-form.html'; SHELL='contract'; NOCOVERS=True; NOPARTIES=True
TITLE=('Company Data Form','نموذج بيانات الشركة')
F=[('Company name (Arabic / English)','اسم الشركة (عربي / إنجليزي)'),('Unified number / Commercial registration no.','الرقم الموحد / السجل التجاري'),('VAT number','الرقم الضريبي'),('National address','العنوان الوطني'),('Website','الموقع الإلكتروني'),('Authorized representative','الممثل المفوض'),('Title','الصفة'),('Email','الإيميل'),('Mobile','الجوال'),('Business activity','النشاط التجاري'),('Products / services to promote','المنتجات / الخدمات المراد الترويج لها'),('Target sectors and entities','القطاعات والجهات المستهدفة'),('Target cities / regions','المدن / المناطق المستهدفة'),('Vendor portals already registered on','منصات الموردين المسجل عليها حالياً'),('Selected package (REV-LAUNCH / REV-GROWTH / REV-PRO)','الباقة المختارة (REV-LAUNCH / REV-GROWTH / REV-PRO)')]
def blocks():
    rows=[[x,'&nbsp;'] for x in F]
    t=TB([('Field','الحقل'),'<span class="pn">Your answer</span><br><span class="pa">إجابتكم</span>'],rows,[48,52])
    t=t.replace('<td class="c">&nbsp;</td>','<td class="c" style="height:34px">&nbsp;</td>')
    return [[H(1,'Please complete and return','يرجى تعبئة النموذج وإعادته'),
      R('1.1','Return this form with the documents listed in the Documents Checklist, to business@businesspartner.sa.','أعيدوا هذا النموذج مع المستندات الواردة في قائمة المستندات إلى business@businesspartner.sa.'),t]]
