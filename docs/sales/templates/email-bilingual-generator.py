import sys,json,html
name_ar,name_en,folder_id,folder_name=sys.argv[1:5]
rows=[
(f"Dear {name_en},<br>Greetings,", f"السلام عليكم ورحمة الله وبركاته،<br>{name_ar}، تحية طيبة،"),
("Thank you for your interest in establishing a company under the Entrepreneurship Licence. We are pleased to offer you two options (prices before 15% VAT):",
 "شكراً لاهتمامكم بتأسيس شركة برخصة ريادة الأعمال. يسعدنا أن نقدّم لكم عرضنا، وفيه خياران (الأسعار قبل ضريبة القيمة المضافة 15٪):"),
("<b>Option A — SAR 25,000</b> (SAR 28,750 including VAT). Complete company formation. Government fees are not included: you pay all of them directly to the entities.",
 "<b>الخيار أ — 25,000 ريال</b> (الإجمالي مع الضريبة 28,750). تأسيس كامل للشركة. الرسوم الحكومية غير شاملة، وتسدّدون كلها مباشرة للجهات."),
("<b>Option B — SAR 30,000</b> (SAR 34,500 including VAT). Includes only the investment-licence fee and the incorporation-contract fee. Every other government fee is paid by you.",
 "<b>الخيار ب — 30,000 ريال</b> (الإجمالي مع الضريبة 34,500). يشمل رسوم رخصة الاستثمار ورسوم عقد التأسيس فقط. وتسدّدون كل رسم حكومي آخر."),
("<b>Payment:</b> the full fee in advance on signing the contract, before work starts.",
 "<b>طريقة الدفع:</b> كامل الأتعاب مقدماً عند التعاقد وقبل بدء العمل."),
("<b>Included:</b> eligibility study and structuring; investment registration with the Ministry of Investment; coordination with the support entity (accredited university or incubator); company formation, commercial registration and chamber membership; opening the entities’ files (zakat and tax, social insurance, human resources); the national address. The announced official period for investment registration is 10 working days from a complete file.",
 "<b>ما تشمله الخدمة:</b> دراسة الأهلية والهيكلة؛ والتسجيل الاستثماري لدى وزارة الاستثمار؛ والتنسيق مع جهة الدعم (جامعة أو حاضنة معتمدة)؛ وتأسيس الشركة والسجل التجاري وعضوية الغرفة؛ وفتح ملفات الجهات (الزكاة والضريبة، التأمينات، الموارد البشرية)؛ والعنوان الوطني. المدة الرسمية المعلنة للتسجيل الاستثماري 10 أيام عمل من اكتمال الملف."),
("<b>Not included:</b> attestation of foreign documents and certified translation; support-entity fees; sectoral licence fees for regulated activities; opening a bank account; post-incorporation obligations.",
 "<b>ما لا تشمله الخدمة:</b> تصديق المستندات الأجنبية والترجمة المعتمدة؛ ورسوم جهة الدعم؛ ورسوم الجهات القطاعية للأنشطة الخاضعة؛ وفتح الحساب البنكي؛ والالتزامات اللاحقة للتأسيس."),
("<b>Attachments</b> (quotation, contract, non-disclosure agreement, authorization letter, required-documents checklist, data form, service guide, government payments schedule and company profile):<br><a href=\"https://drive.google.com/drive/folders/%s\">%s</a>"%(folder_id,html.escape(folder_name)),
 "<b>المرفقات</b> (عرض السعر، والعقد، واتفاقية عدم الإفصاح، وخطاب التفويض، وقائمة المستندات، ونموذج البيانات، ودليل الخدمة، ومرفق المدفوعات الحكومية، والملف التعريفي):<br><a href=\"https://drive.google.com/drive/folders/%s\">%s</a>"%(folder_id,html.escape(folder_name))),
("We would be glad to arrange a short call to confirm the suitable option and start the procedures.",
 "يسعدنا ترتيب مكالمة قصيرة لتأكيد الخيار المناسب وبدء الإجراءات."),
("Best regards,<br>Dr. Baher Magnas<br>Chief Executive Officer — Business Partner<br>www.businesspartner.sa",
 "مع التحية،<br>د. باهر مقنص<br>المدير التنفيذي — Business Partner<br>www.businesspartner.sa"),
]
t='<table dir="ltr" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;line-height:1.6">'
for en,ar in rows:
    t+='<tr><td style="width:50%;vertical-align:top;padding:8px 12px;border-bottom:1px solid #e3e6ee" dir="ltr">'+en+'</td><td style="width:50%;vertical-align:top;padding:8px 12px;border-bottom:1px solid #e3e6ee;text-align:right" dir="rtl">'+ar+'</td></tr>'
t+='</table>'
print(t)
