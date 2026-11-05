# -*- coding: utf-8 -*-
"""خطاب التفويض لخدمة تطوير الأعمال (REV): الطرف الثاني يضع علامة على ما يفوّض به. غير المحدَّد غير مفوَّض.
النص المشترك مأخوذ بتصرف من templates/categories/authorization-letter-template-DRAFT.md (الجزء الأول)، وبنود التفويض من عقد REV بند 6.6.
يُرقَّم بعد بند الأطراف (1) الذي يأتي من الغلاف."""
import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _helpers import *
OUTNAME='REV-authorization.html'; SHELL='contract'
TITLE=('Authorization Letter','خطاب تفويض')
BOX='☐'
ACTS=[
 ('Submit vendor-registration applications, with the Second Party’s documents, on the platforms of the target companies, in the Second Party’s name.',
  'تقديم طلبات التسجيل كمورد، بمستندات الطرف الثاني، على منصات الشركات المستهدفة باسمه.'),
 ('Communicate with the target companies to introduce the Second Party and arrange meetings, using its company profile.',
  'مراسلة الشركات المستهدفة للتعريف بالطرف الثاني وترتيب الاجتماعات، باستعمال ملفه التعريفي.'),
 ('Receive registration notifications and correspondence from those companies and inform the Second Party within 2 business days.',
  'استلام إشعارات التسجيل ومراسلات تلك الشركات، وإبلاغ الطرف الثاني خلال يومي عمل.'),
 ('View the registration status through the platforms’ official delegated-access features only, never through passwords or verification codes.',
  'الاطلاع على حالة التسجيل عبر خصائص التفويض الرسمية في المنصات فقط، لا بكلمات المرور ولا رموز التحقق.'),
 ('Share the Second Party’s documents and data with those companies only as needed for registration, under the Non-Disclosure Agreement.',
  'مشاركة مستندات الطرف الثاني وبياناته مع تلك الشركات بقدر ما يلزم للتسجيل فقط، وفق اتفاقية عدم الإفصاح.'),
]
def blocks():
    rows=[[x,BOX] for x in ACTS]
    t=TB([('Authorized action','الإجراء المفوَّض'),'<span class="pn">Authorized</span><br><span class="pa">مفوَّض</span>'],rows,[84,16])
    return [
     [H(2,'Subject','الموضوع'),
      R('2.1','This letter is an annex to the Business Development Service Agreement between the parties (the “Agreement”). Under clause 6.6 of the Agreement, the Second Party authorizes the First Party to perform only the actions ticked below.',
        'هذا الخطاب ملحق بعقد خدمة تطوير الأعمال بين الطرفين («العقد»). وبموجب البند 6.6 من العقد يفوّض الطرف الثاني الطرف الأول بالقيام بالإجراءات المؤشَّر عليها أدناه فقط.'),
      R('2.2','Any action not ticked is not authorized.','أي إجراء غير مؤشَّر عليه غير مفوَّض.')],
     [H(3,'Authorized Actions','الإجراءات المفوَّضة'),
      R('3.1','The Second Party ticks each action it authorizes.','يضع الطرف الثاني علامة أمام كل إجراء يفوّض به.'),t],
     [H(4,'Actions Never Authorized','ما لا يشمله التفويض أبداً'),
      R('4.1','The First Party may not, under this letter: (a) sign contracts, commitments, bids or settlements on the Second Party’s behalf; (b) receive or hold the Second Party’s funds; (c) open, close or change bank accounts or payment details; (d) transfer, pledge or dispose of shares, assets or rights; (e) conduct judicial proceedings or file court claims; (f) accept prices or terms offered by any company; (g) delegate its authority to others.',
        'لا يجوز للطرف الأول بموجب هذا الخطاب: (أ) توقيع عقود أو التزامات أو عروض أو تسويات باسم الطرف الثاني؛ (ب) استلام أموال الطرف الثاني أو حيازتها؛ (ج) فتح الحسابات البنكية أو إغلاقها أو تغيير بيانات الدفع؛ (د) نقل الحصص أو الأصول أو الحقوق أو رهنها أو التصرف فيها؛ (هـ) مباشرة إجراءات قضائية أو رفع دعاوى؛ (و) قبول أسعار أو شروط تعرضها أي شركة؛ (ز) تفويض غيره بصلاحياته.')],
     [H(5,'How Access Is Granted','طريقة منح الوصول'),
      R('5.1','Access is given only through the official delegation or authorization features of the platforms where available, never by sharing credentials or verification codes. Where a platform does not offer delegation, the Second Party acts itself under the First Party’s guidance.',
        'يُمنح الوصول عبر خصائص التفويض الرسمية في المنصات حيث تتوفر، لا بمشاركة بيانات الدخول ولا رموز التحقق. وحيث لا تتيح المنصة تفويضاً، يعمل الطرف الثاني بنفسه بإرشاد من الطرف الأول.'),
      R('5.2','The Second Party personally approves any submission that a platform requires it to approve personally.','ويعتمد الطرف الثاني بنفسه أي تقديم تشترط المنصة اعتماده شخصياً.')],
     [H(6,'Named Staff','الموظفون المسمّون'),
      R('6.1','The First Party acts only through its named staff, whose identification details are kept in the executed copy.','يعمل الطرف الأول عبر موظفيه المسمّين وحدهم، وبيانات هويتهم في النسخة الموقّعة.')],
     [H(7,'Term and Revocation','المدة والإلغاء'),
      R('7.1','This letter is valid during the term of the Agreement and ends on its expiry or termination.','يسري هذا الخطاب خلال مدة العقد وينتهي بانتهائه أو إنهائه.'),
      R('7.2','The Second Party may change the ticked actions or revoke this letter at any time by written notice, effective on receipt, without prejudice to fees earned under the Agreement.',
        'وللطرف الثاني تغيير الإجراءات المؤشَّر عليها أو إلغاء هذا الخطاب في أي وقت بإشعار كتابي ينفذ باستلامه، دون المساس بالرسوم المستحقة بموجب العقد.'),
      R('7.3','On revocation or expiry the First Party stops acting, hands over documents and removes any platform delegation within 2 business days.',
        'وعند الإلغاء أو الانتهاء يتوقف الطرف الأول عن العمل، ويسلّم المستندات، ويزيل أي تفويض في المنصات خلال يومي عمل.')],
     [H(8,'Undertakings','الالتزامات'),
      R('8.1','The Second Party ensures that its information and documents are true and complete, and notifies the First Party of any change affecting the registrations.',
        'يضمن الطرف الثاني صحة معلوماته ومستنداته واكتمالها، ويبلغ الطرف الأول بأي تغيير يمس التسجيلات.'),
      R('8.2','The First Party acts within this letter only, keeps a log of its acts (date, company, act, result) and shares it on request, keeps the matters confidential under the Non-Disclosure Agreement, and handles personal data under the data protection clause of the Agreement.',
        'يعمل الطرف الأول ضمن هذا الخطاب فقط، ويحتفظ بسجل لأعماله (التاريخ، الشركة، العمل، النتيجة) ويقدمه عند الطلب، ويحافظ على سريتها وفق اتفاقية عدم الإفصاح، ويعالج البيانات الشخصية وفق بند حماية البيانات في العقد.')],
     [H(9,'Effect, Law and Precedence','الأثر والقانون والأسبقية'),
      R('9.1','Acts within this letter bind the Second Party; acts outside it do not. The First Party does not guarantee the decision of any company.',
        'تُلزم الأعمال ضمن هذا الخطاب الطرف الثاني، ولا تلزمه الأعمال خارجه. ولا يضمن الطرف الأول قرار أي شركة.'),
      R('9.2','This letter is governed by the laws of the Kingdom of Saudi Arabia and disputes follow the dispute clause of the Agreement. If it conflicts with the Agreement, the provision more protective of the Second Party’s funds and credentials applies.',
        'يخضع هذا الخطاب لأنظمة المملكة العربية السعودية، وتُحل النزاعات وفق بند النزاعات في العقد. وعند التعارض مع العقد يُؤخذ بالأحمى لأموال الطرف الثاني وبيانات دخوله.')],
    ]
