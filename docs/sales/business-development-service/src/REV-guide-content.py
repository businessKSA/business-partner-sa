# -*- coding: utf-8 -*-
import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _helpers import *
OUTNAME='REV-guide.html'; SHELL='contract'; NOCOVERS=True; NOPARTIES=True
TITLE=('Business Development Packages Guide','دليل باقات تطوير الأعمال')
def blocks():
    return [[H(1,'The Service','الخدمة'),
      R('1.1','“Business Development as a Service”: we supply sales leads and referrals to your company and help you register as a vendor with companies, for a monthly fee plus a success fee on closed deals.','«تطوير الأعمال كخدمة»: نزوّد شركتكم بفرص بيع وإحالات ونساعدكم في التسجيل كمورد لدى الشركات، برسم شهري ونسبة نجاح على الصفقات المغلقة.'),
      R('1.2','The annual contract allows cancellation after a minimum commitment of 3 months.','العقد سنوي، ويجوز الإلغاء بعد حد أدنى للالتزام مدته 3 أشهر.'),
      H(2,'Packages and Monthly Deliverables','الباقات والمخرجات الشهرية'),
      TB(PH(('Item','البند')),[
        [('Monthly fee (SAR, excl. VAT)','الرسم الشهري (ريال، قبل الضريبة)'),N('2,500'),N('5,000'),N('9,500')],
        [('Advance payment, 3 months (SAR, excl. VAT)','الدفعة المقدمة، 3 أشهر (ريال، قبل الضريبة)'),N('7,500'),N('15,000'),N('28,500')],
        [('Total for 12 months (SAR, excl. VAT)','إجمالي 12 شهراً (ريال، قبل الضريبة)'),N('30,000'),N('60,000'),N('114,000')],
        [('Qualified leads per month','فرص مؤهلة شهرياً'),N('4'),N('8'),N('16')],
        [('Vendor registrations per month','تسجيلات مورد شهرياً'),N('4'),N('8'),N('16')],
        [('Meetings per month','اجتماعات شهرياً'),N('4'),N('8'),N('16')],
      ],[40,20,20,20]),
      R('2.1','Prices exclude 15% VAT. Monthly performance report and a list of companies, portals and registration emails by your activity.','الأسعار قبل ضريبة القيمة المضافة 15%. وتقرير أداء شهري وقائمة الشركات وصفحات وإيميلات التسجيل بحسب نشاطكم.'),
      H(3,'Success Fee','نسبة النجاح'),
      TB([('Deal value (SAR)','قيمة الصفقة (ريال)'),'<span class="pn">Lead handover only</span><br><span class="pa">تسليم الفرصة فقط</span>','<span class="pn">With our participation in closing</span><br><span class="pa">بمشاركتنا في الإغلاق</span>'],[
        [('Up to and including 1,000,000','حتى 1,000,000 شاملةً'),N('10%'),N('12.5%')],
        [('Above 1,000,000 up to and including 5,000,000','أكثر من 1,000,000 حتى 5,000,000 شاملةً'),N('5%'),N('7.5%')],
        [('Above 5,000,000','أكثر من 5,000,000'),N('2.5%'),N('5%')]],[44,28,28]),
      R('3.1','The fee is before tax and applies to deals arising from the leads we deliver, as defined in the contract.','النسبة قبل الضريبة وتسري على الصفقات الناتجة عن الفرص التي نسلّمها، كما يحدد العقد.'),
      H(4,'How It Works','كيف تعمل الخدمة'),
      R('4.1','You choose a package and sign the quotation and contract.','تختارون الباقة وتوقّعون عرض السعر والعقد.'),
      R('4.2','You provide the company data form and the required documents.','تزوّدوننا بنموذج بيانات الشركة والمستندات المطلوبة.'),
      R('4.3','We deliver qualified leads, vendor registrations and meetings every month.','نسلّمكم شهرياً الفرص المؤهلة وتسجيلات المورد والاجتماعات.'),
      R('4.4','You follow up the leads and report outcomes; we send a monthly performance report.','تتابعون الفرص وتبلّغوننا بنتائجها، ونرسل تقرير أداء شهرياً.'),
      R('4.5','The success fee is due on closed deals arising from delivered leads, per the contract.','تُستحق نسبة النجاح على الصفقات المغلقة الناتجة عن الفرص المسلَّمة وفق العقد.')]]
