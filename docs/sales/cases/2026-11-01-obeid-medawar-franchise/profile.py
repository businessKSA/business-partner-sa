# -*- coding: utf-8 -*-
"""بروفايل Business Partner (ثنائي اللغة) — من صفحات الشركة وحدها، بلا أرقام عملاء ولا مدّعيات غير موثقة."""
import os, sys
from content import *
import build_html as BH, build_office as BO

T_EN, T_AR = "Company Profile", "الملف التعريفي للشركة"
ROWS = [
 ["Who we are", "من نحن",
  "Business Partner is an operating partner for companies in Saudi Arabia. We deal with platforms and government authorities on your behalf and complete your business requirements clearly, quickly and methodically.",
  "بزنس بارتنر شريك تشغيلي للشركات في المملكة العربية السعودية. نتعامل مع المنصات والجهات الحكومية نيابةً عنكم وننجز متطلبات أعمالكم بوضوح وسرعة ومنهجية."],
 ["What we do", "ماذا نقدم",
  "We understand your case, identify the right service and track, prepare the documents, file the request with the relevant platform, and follow up to issuance, keeping you updated at every stage. Services cover consultation, government services, company formation, recruitment and employment (including outsourced employment and contracting), HR services, and AI-driven digital infrastructure.",
  "نفهم حالتكم، ونحدد الخدمة والمسار المناسبين، ونجهّز المستندات، ونقدّم الطلب على المنصة المعنية، ونتابع حتى الصدور مع إبلاغكم في كل مرحلة. وتشمل خدماتنا الاستشارات والخدمات الحكومية وتأسيس الشركات والتوظيف والتعهيد وخدمات الموارد البشرية والبنية التحتية الرقمية بالذكاء الاصطناعي."],
 ["How we work", "كيف نعمل",
  "Clarity: fees, charges and timelines disclosed before you start. Speed: ready-made tracks that save time. Reliability: compliance with regulations and follow-up to issuance. Technology: a smart assistant serving you on WhatsApp around the clock.",
  "الوضوح: الأتعاب والرسوم والمدد تُعلن قبل البدء. السرعة: مسارات جاهزة توفّر الوقت. الموثوقية: الالتزام بالأنظمة والمتابعة حتى الصدور. التقنية: مستشار ذكي يخدمكم على واتساب على مدار الساعة."],
 ["Company details", "بيانات الشركة",
  "Registered name: Business Partner Solutions Company. Unified number: 7038825860. VAT number: 312079341500003. National address: RDAA9214. Hours: Sunday–Thursday, 9 AM – 6 PM. Mobile: 00966530540231. Email: business@businesspartner.sa. Website: businesspartner.sa. A ZATCA-compliant tax invoice is issued for every paid order.",
  "الاسم المسجَّل: شركة بزنس بارتنر سلوشنز. الرقم الموحد: 7038825860. الرقم الضريبي: 312079341500003. العنوان الوطني: RDAA9214. أوقات العمل: الأحد–الخميس، 9 صباحاً – 6 مساءً. الجوال: 00966530540231. البريد: business@businesspartner.sa. الموقع: businesspartner.sa. وتصدر فاتورة ضريبية متوافقة مع الزكاة والضريبة والجمارك لكل طلب مدفوع."],
]
COVER = ("COMPANY PROFILE", "ملف تعريفي", T_EN, T_AR, "Who we are, what we do and how we work.", "من نحن وماذا نقدم وكيف نعمل.")
if __name__ == "__main__":
    out = sys.argv[1]
    open(os.path.join(out, "08-Company-Profile.html"), "w", encoding="utf-8").write(BH.build_info(ROWS, T_EN, T_AR, COVER[0], COVER[1], COVER[4], COVER[5], numbered=False))
    BO.build_docx_info(ROWS, T_EN, T_AR, COVER[0], COVER[1], COVER[4], COVER[5], False, os.path.join(out, "08-Company-Profile.docx"))
