# -*- coding: utf-8 -*-
import importlib.util,os
_s=importlib.util.spec_from_file_location('cc',os.path.join(os.path.dirname(os.path.abspath(__file__)),'REV-contract-content.py'));_c=importlib.util.module_from_spec(_s);_s.loader.exec_module(_c)
H,R=_c.H,_c.R
OUTNAME="REV-nda-mutual-bilingual.html"
def blocks():
    return [[
      H(2,'Purpose','الغرض'),
      R('2.1','Exchange of information to evaluate a potential collaboration or perform services agreed between the parties (the “Purpose”).','تبادل معلومات لغرض تقييم تعاون محتمل أو تنفيذ خدمات متفق عليها بين الطرفين («الغرض»).'),
      H(3,'Confidential Information','المعلومات السرية'),
      R('3.1','Any non-public information disclosed in any form, including pricing, clients, documents, operational data, contact data and plans.','كل معلومة غير عامة تُفصح بأي وسيلة، وتشمل الأسعار والعملاء والمستندات والبيانات التشغيلية وبيانات التواصل والخطط.'),
      H(4,'Obligations','الالتزامات'),
      R('4.1','Each party uses the information only for the Purpose.','يستخدم كل طرف المعلومات للغرض فقط.'),
      R('4.2','No disclosure to third parties except employees, advisors and technology, artificial intelligence and hosting service providers who need it and are bound by confidentiality.','لا يُفصح لأي طرف ثالث إلا للعاملين والمستشارين ومزودي الخدمات التقنية والذكاء الاصطناعي والاستضافة المحتاجين لها والملتزمين بالسرية.'),
      R('4.3','Each party protects the information with at least reasonable care, not less than its care for its own information.','يحمي كل طرف المعلومات بعناية معقولة لا تقل عن عنايته بمعلوماته.'),
      H(5,'Exclusions','الاستثناءات'),
      R('5.1','Information that is public, previously known, independently developed, or lawfully received from a third party.','المعلومات العامة، أو المعروفة سابقاً، أو المطوّرة باستقلال، أو المستلمة من طرف ثالث بصورة مشروعة.'),
      R('5.2','Information legally compelled to be disclosed, with notice to the other party.','المعلومات المطلوب الإفصاح عنها بأمر نظامي مع إشعار الطرف الآخر.'),
      R('5.3','The burden of proving an exception lies on the party claiming it.','وعبء إثبات الاستثناء على من يدّعيه.'),
      H(6,'Use of Deliverables','استعمال المخرجات'),
      R('6.1','This agreement does not prevent the Second Party from using deliverables handed to it under a service contract in accordance with its terms.','لا تمنع هذه الاتفاقية الطرف الثاني من استعمال المخرجات المسلَّمة له بموجب عقد خدمة وفق شروطه.')],
     [H(7,'Personal Data','البيانات الشخصية'),
      R('7.1','Personal data is handled under the Personal Data Protection Law and its regulations.','تُعامل البيانات الشخصية وفق نظام حماية البيانات الشخصية ولوائحه.'),
      R('7.2','It is used only for the Purpose.','ولا تُستعمل إلا للغرض.'),
      R('7.3','The parties agree on further details in any service contract.','ويتفق الطرفان على التفاصيل الإضافية في أي عقد خدمة.'),
      H(8,'Term','المدة'),
      R('8.1','Effective from signature for 3 years.','يسري الاتفاق من تاريخ التوقيع ولمدة 3 سنوات.'),
      R('8.2','Confidentiality survives expiry for 5 years, and remains open-ended for trade secrets and personal data.','وتستمر السرية بعد انتهائه لمدة 5 سنوات، وتبقى مفتوحة المدة للأسرار التجارية والبيانات الشخصية.'),
      H(9,'Return &amp; Destruction','الإعادة والإتلاف'),
      R('9.1','On request or when the Purpose ends, information is returned or destroyed within 14 days.','عند الطلب أو انتهاء الغرض تُعاد المعلومات أو تُتلف خلال 14 يوماً.'),
      R('9.2','Excepted: automatic backups and statutorily retained copies.','عدا النسخ الاحتياطية الآلية والمحتفظ بها نظاماً.'),
      H(10,'Breach &amp; Remedies','الإخلال والتعويض'),
      R('10.1','The affected party may claim compensation for proven actual direct damage.','يحق للطرف المتضرر المطالبة بالتعويض عن الضرر الفعلي المباشر المثبت.'),
      R('10.2','It may seek an urgent court order to stop disclosure, with no fixed penalty.','وطلب أمر قضائي مستعجل بوقف الإفصاح، دون غرامة ثابتة.'),
      H(11,'Governing Law','القانون والاختصاص'),
      R('11.1','Governed by the laws of the Kingdom of Saudi Arabia.','تخضع لأنظمة المملكة العربية السعودية.'),
      R('11.2','Disputes are resolved amicably within 30 days of written notice, then before the Commercial Court in Riyadh.','وتُحل النزاعات ودياً خلال 30 يوماً من الإخطار الخطي ثم أمام المحكمة التجارية في الرياض.')]]
