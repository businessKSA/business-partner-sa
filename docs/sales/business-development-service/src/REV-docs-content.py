# -*- coding: utf-8 -*-
import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _helpers import *
OUTNAME='REV-documents-checklist.html'; SHELL='contract'; NOCOVERS=True; NOPARTIES=True
TITLE=('Documents Checklist','قائمة المستندات المطلوبة')
D=[('Commercial registration','السجل التجاري'),('VAT registration certificate','شهادة التسجيل في ضريبة القيمة المضافة'),('National address proof','إثبات العنوان الوطني'),('Company profile','الملف التعريفي للشركة'),('Authorization letter for the signatory','تفويض الموقّع'),('Products / services catalogue and price list','كتالوج المنتجات / الخدمات وقائمة الأسعار'),('List of previous clients and references','قائمة العملاء السابقين والمراجع'),('Chamber of Commerce certificate','شهادة الغرفة التجارية'),('Zakat / tax certificate','شهادة الزكاة والدخل'),('GOSI certificate','شهادة التأمينات الاجتماعية'),('Saudization (Nitaqat) certificate','شهادة السعودة (نطاقات)'),('Quality / ISO certificates, if any','شهادات الجودة / آيزو إن وُجدت'),('Company logo (high resolution)','شعار الشركة بدقة عالية')]
def blocks():
    rows=[[x,'☐'] for x in D]
    t=TB([('Document','المستند'),'<span class="pn">Provided</span><br><span class="pa">تم التزويد</span>'],rows,[78,22])
    return [[H(1,'Documents needed for vendor registration','المستندات اللازمة للتسجيل كمورد'),
      R('1.1','Please provide these documents on time; delays in documents delay vendor registrations.','يرجى تزويدنا بهذه المستندات في الوقت المناسب، فتأخر المستندات يؤخر تسجيلات المورد.'),t]]
