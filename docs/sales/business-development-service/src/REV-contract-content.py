# -*- coding: utf-8 -*-
RLM='‏'
def H(n,en,ar):
    return f'<div class="rw hh"><div class="col" dir="ltr"><h2><span class="n">{n}</span>{en}</h2></div><div class="col" dir="rtl"><h2><span class="n">{n}</span>{ar}</h2></div></div>'
def R(num,en,ar):
    n=f'<span class="bu">{num}</span>' if num else ''
    return f'<div class="rw lr"><div class="col" dir="ltr">{n}{en}</div><div class="col" dir="rtl">{n}{ar}{RLM}</div></div>'
def LB(en,ar): return f'<div class="lb"><span>{en}</span><span dir="rtl">{ar}</span></div>'
def TH(en,ar): return f'<th><div class="lb"><span>{en}</span><span dir="rtl">{ar}</span></div></th>'
def TB(head,rows,widths):
    cg=''.join(f'<col style="width:{w}%">' for w in widths)
    h='<tr>'+''.join(TH(*x) if isinstance(x,tuple) else f'<th class="c">{x}</th>' for x in head)+'</tr>'
    body=''
    for r in rows:
        body+='<tr>'+''.join(f'<td>{LB(*c)}</td>' if isinstance(c,tuple) else f'<td class="c">{c}</td>' for c in r)+'</tr>'
    return f'<table class="bt"><colgroup>{cg}</colgroup>{h}{body}</table>'
def PK(): 
    return [('REV-LAUNCH','الانطلاق'),('REV-GROWTH','النمو'),('REV-PRO','الاحترافية')]
def PH(first):
    return [first]+['<span class="pn">REV-LAUNCH</span><br><span class="pa">Launch · الانطلاق</span>','<span class="pn">REV-GROWTH</span><br><span class="pa">Growth · النمو</span>','<span class="pn">REV-PRO</span><br><span class="pa">Pro · الاحترافية</span>']
N=lambda x:f'<span class="num">{x}</span>'
EM='<bdi>business@businesspartner.sa</bdi>'

OUTNAME="REV-contract-bilingual.html"
def blocks():
    B=[]
    # 2
    B.append([H(2,'Subject','موضوع العقد'),
      R('2.1','The First Party provides the “Business Development as a Service”: supplying sales leads and referrals to the Second Party and assisting it to register as a vendor with companies, within the selected package.',
        'يقدّم الطرف الأول للطرف الثاني خدمة «تطوير الأعمال كخدمة»: تزويده بفرص بيع (Leads) وإحالات (Referrals) ومساعدته في التسجيل كمورد لدى الشركات، ضمن الباقة المختارة.')])
    # 3
    B.append([H(3,'Package &amp; Fees','الباقة والرسوم'),
      TB(PH(('Item','البند')),[
        [('Selected package','الباقة المختارة'),'☐','☐','☐'],
        [('Monthly fee (SAR, excl. VAT)','الرسم الشهري (ريال، قبل الضريبة)'),N('2,500'),N('5,000'),N('9,500')],
        [('Advance payment, 3 months (SAR, excl. VAT)','الدفعة المقدمة، 3 أشهر (ريال، قبل الضريبة)'),N('7,500'),N('15,000'),N('28,500')],
        [('Total for 12 months (SAR, excl. VAT)','إجمالي 12 شهراً (ريال، قبل الضريبة)'),N('30,000'),N('60,000'),N('114,000')],
      ],[40,20,20,20])])
    B.append([
      R('3.1','Prices exclude VAT; 15% VAT is added.','الأسعار قبل الضريبة، وتُضاف ضريبة القيمة المضافة 15%.'),
      R('3.2','Payment is in advance for a minimum of 3 months, against a tax invoice issued on receipt.','الدفع مقدماً لمدة 3 أشهر كحد أدنى بفاتورة ضريبية تصدر عند القبض.'),
      R('3.3','Later months are invoiced monthly in advance, each payable within 5 days of the invoice date.','تُفوتر الأشهر اللاحقة شهرياً مقدماً، ويُسدَّد كل مبلغ خلال 5 أيام من تاريخ الفاتورة.'),
      R('3.4','Payment is by bank transfer to the First Party’s account at [●], IBAN [●].','السداد بتحويل بنكي إلى حساب الطرف الأول لدى [●]، آيبان [●].'),
      R('3.5','No late-payment interest applies; on late payment the First Party may suspend the service after written notice and recover its documented actual collection costs.','لا تُحتسب فوائد تأخير؛ وللطرف الأول عند التأخر إيقاف الخدمة بعد إشعار كتابي واسترداد التكاليف الفعلية المثبتة لتحصيل المستحق.')])
    # 4
    B.append([H(4,'Monthly Deliverables','المخرجات الشهرية'),
      R('','The First Party commits to the following monthly minimum by package:','يلتزم الطرف الأول شهرياً بالحد الأدنى التالي بحسب الباقة:'),
      TB(PH(('Deliverable','المخرج')),[
        [('Qualified leads','فرص مؤهلة'),N('4'),N('8'),N('16')],
        [('Vendor registrations','تسجيلات مورد'),N('4'),N('8'),N('16')],
        [('Meetings','اجتماعات'),N('4'),N('8'),N('16')],
      ],[40,20,20,20])])
    B.append([
      R('4.1','<b>“Qualified lead”:</b> an entity with valid contact details (email and/or mobile) and a stated need or clear rationale.','<b>«فرصة مؤهلة»:</b> جهة ببيانات تواصل صالحة (إيميل و/أو جوال) وحاجة معلنة أو مبرر واضح.'),
      R('4.2','<b>“Vendor registration”:</b> a complete submission of the registration application, with documents, on the target company’s platform, not the company’s acceptance. It requires the Second Party to provide complete documents on time, failing which any shortfall is not the First Party’s default.','<b>«تسجيل مورد»:</b> تقديم مكتمل لطلب التسجيل على منصة الشركة المستهدفة بمستنداته، لا قبول الشركة له. ويشترط توفير الطرف الثاني مستنداته كاملة في الوقت المناسب وإلا لا يُعدّ النقص تقصيراً من الطرف الأول.'),
      R('4.3','<b>“Meeting”:</b> a meeting actually held, or arranged and missed by the Second Party or the entity; such a miss is not the First Party’s default.','<b>«اجتماع»:</b> اجتماع عُقد فعلاً أو جرى ترتيبه فتخلّف عنه الطرف الثاني أو الجهة، ولا يُعدّ تخلّفهما تقصيراً من الطرف الأول.'),
      R('4.4','The minimum is a monthly commitment, and the sole remedy for missing it is completion of the shortfall in the following month.','الحد الأدنى التزام شهري، وجزاء الإخلال به حصراً: استكمال المخرجات الناقصة في الشهر التالي.'),
      R('4.5','Failing completion, a credit is applied to the next invoice; on expiry or termination the credit is settled in cash or deducted from the last invoice, and it does not count toward the liability cap.','فإن لم تُستكمل يُحتسب رصيد دائن في الفاتورة التالية، وعند انتهاء العقد يُسوّى الرصيد نقداً أو يُخصم من آخر فاتورة، ولا يدخل هذا الرصيد في حساب سقف المسؤولية.'),
      R('4.6','Monthly performance report, and a list of companies, portals and registration emails by the Second Party’s activity.','تقرير أداء شهري، وقائمة الشركات وصفحات وإيميلات التسجيل بحسب نشاط الطرف الثاني.')])
    # 5
    B.append([H(5,'Success Fee','نسبة النجاح'),
      R('','The First Party earns a success fee when the Second Party concludes a deal arising from a lead it delivered, by deal value:','يستحق الطرف الأول نسبة نجاح عند إبرام الطرف الثاني صفقة ناتجة عن فرصة سلّمها، بحسب قيمة الصفقة:'),
      TB([('Deal value (SAR)','قيمة الصفقة (ريال)'),
          '<span class="pn">Lead handover only</span><br><span class="pa">تسليم الفرصة فقط</span>',
          '<span class="pn">With First Party’s participation in closing</span><br><span class="pa">بمشاركة الطرف الأول في الإغلاق</span>'],[
        [('Up to and including 1,000,000','حتى 1,000,000 شاملةً'),N('10%'),N('12.5%')],
        [('Above 1,000,000 up to and including 5,000,000','أكثر من 1,000,000 حتى 5,000,000 شاملةً'),N('5%'),N('7.5%')],
        [('Above 5,000,000','أكثر من 5,000,000'),N('2.5%'),N('5%')],
      ],[44,28,28])])
    B.append([
      R('5.1','Participation in closing adds 2.5% on the same deal. The fee is before tax and 15% VAT is added.','تُضاف 2.5% على الصفقة نفسها عند المشاركة في الإغلاق (Closing). النسبة قبل الضريبة وتُضاف عليها ضريبة القيمة المضافة 15%.'),
      R('5.2','Value basis: signed contract or purchase order value, excl. VAT. The tier applies to the whole value, and the parties acknowledge the effect of this at the tier boundaries.','أساس القيمة: قيمة العقد أو أمر الشراء الموقّع قبل الضريبة. تُطبَّق الشريحة على كامل القيمة، ويقرّ الطرفان بعلمهما بأثر ذلك عند حدّي الشريحة.'),
      R('5.3','<b>Due date:</b> within 14 days of the Second Party’s receipt of the first payment from the entity under the deal [or of 60 days after it is concluded, whichever is earlier].','<b>الاستحقاق:</b> خلال 14 يوماً من استلام الطرف الثاني أول دفعة من الجهة عن الصفقة [أو من مرور 60 يوماً على إبرامها أيهما أسبق].'),
      R('5.4','<b>“Deal”:</b> a binding contract or purchase order concluded between the Second Party and the entity for the supply of the Second Party’s products or services, valued at its signed value.','<b>«الصفقة»:</b> عقد أو أمر شراء ملزم يُبرم بين الطرف الثاني والجهة لتوريد منتجاته أو خدماته، وتُحسب بقيمته الموقّعة.'),
      R('5.5','<b>“Attribution period”:</b> 12 months from the date the lead is delivered in writing.','<b>«مدة الإسناد»:</b> 12 شهراً من تاريخ تسليم الفرصة كتابةً.'),
      R('5.6','<b>“Deal arising from a lead”:</b> a deal concluded with the entity whose lead was delivered in writing (email or portal), or with its affiliates or related companies, within the attribution period, including purchase orders actually issued during that period under it, whether renewals, repeat orders or call-offs under a framework agreement, but not estimated values.','<b>«الصفقة الناتجة عن فرصة»:</b> صفقة تُبرم مع الجهة التي سُلّمت فرصتها كتابةً (بريد أو بوابة) أو مع شركاتها التابعة أو المرتبطة، خلال مدة الإسناد، وتشمل أوامر الشراء الصادرة فعلاً خلال المدة بموجبها، من تجديد أو أمر متكرر أو أمر ضمن عقد إطار، دون القيم المقدّرة.'),
      R('5.7','<b>“Participation in closing”:</b> a written request from the Second Party for the First Party’s participation, or its actual attendance at a negotiation meeting at the Second Party’s request.','<b>«المشاركة في الإغلاق»:</b> طلب كتابي من الطرف الثاني بمشاركة الطرف الأول، أو حضوره فعلاً اجتماع تفاوض بطلب الطرف الثاني.'),
      R('5.8','<b>Notification and evidence:</b> the Second Party notifies the First Party in writing within 7 days of concluding the deal and provides a copy of the contract or purchase order (or its value only, if the price is confidential). If it does not, the First Party may rely on its own evidence (CC copies, supplier portal, public award) and may request an annual written statement of deal values certified by the Second Party’s CFO.','<b>الإبلاغ والإثبات:</b> يبلّغ الطرف الثاني الطرف الأول كتابةً خلال 7 أيام من إبرام الصفقة ويزوّده بصورة العقد أو أمر الشراء (أو قيمته فقط إن كان السعر سرياً). وإن لم يُبلّغ فللطرف الأول الاستناد إلى أدلته (نسخة CC، بوابة الموردين، ترسية معلنة)، وله طلب إقرار كتابي سنوي معتمد من المدير المالي للطرف الثاني بقيم الصفقات.'),
      R('5.9','<b>Existing contract:</b> no fee is due on an entity to which the Second Party had an existing contract to supply its products or services before the lead was delivered, provided it proves this by a written document (contract, purchase order or invoice), not a statement, within 5 business days of handover; such a lead does not count toward the monthly deliverables.','<b>العقد القائم:</b> لا تُستحق نسبة على جهة كان للطرف الثاني عقد قائم لتوريد منتجاته أو خدماته لها قبل تسليم الفرصة، متى أثبت ذلك بمستند مكتوب (عقد أو أمر شراء أو فاتورة) خلال 5 أيام عمل من التسليم لا بإفادة، ولا تُحسب هذه الفرصة ضمن المخرجات الشهرية.'),
      R('5.10','<b>Rejecting a lead:</b> the grounds are limited to invalid contact details, an entity outside the declared activity, or a documented prior relationship. The First Party may provide a replacement or correction within 5 business days. A rejected lead does not count toward the monthly deliverables, and its rejection does not extinguish the First Party’s right to the fee if a deal is concluded with the same entity or its affiliates within the attribution period.','<b>رفض الفرصة:</b> تنحصر الأسباب في بيانات تواصل غير صالحة، أو جهة خارج النشاط المعلن، أو علاقة سابقة موثّقة. وللطرف الأول تقديم بديل أو تصحيح خلال 5 أيام عمل. والفرصة المرفوضة لا تُحسب ضمن المخرجات الشهرية، ولا يُسقط رفضها حق الطرف الأول في النسبة إذا أُبرمت صفقة مع الجهة نفسها أو تابعاتها خلال مدة الإسناد.'),
      R('5.11','The Second Party shall not agree with the entity to delay closing or restructure the deal to avoid the fee.','لا يتفق الطرف الثاني مع الجهة على تأخير الإغلاق أو إعادة هيكلة الصفقة لتفادي النسبة.'),
      R('5.12','<b>Survival:</b> the fee remains due to the First Party even after the contract expires or is terminated or cancelled for any reason, on every lead it delivered while the contract was in force, whenever the deal is concluded with the same entity or its affiliates within the attribution period, whether the Second Party closes it alone or with the First Party’s participation. This clause survives expiry of the contract, and termination does not extinguish an accrued right.','<b>بقاء الأثر:</b> تبقى النسبة مستحقة للطرف الأول حتى بعد انتهاء العقد أو إنهائه أو إلغائه لأي سبب، عن كل فرصة سلّمها أثناء سريانه، متى أُبرمت الصفقة مع الجهة نفسها أو تابعاتها خلال مدة الإسناد، سواء أغلقها الطرف الثاني بنفسه أو بمشاركة الطرف الأول. ويبقى هذا البند نافذاً بعد انتهاء العقد، ولا يُسقط الإنهاء حقاً نشأ.')])
    # 6
    B.append([H(6,'Second Party Obligations','التزامات الطرف الثاني (العميل)'),
      R('6.1','<b>Documents:</b> provide the required information and documents on time and bear responsibility for their accuracy.','<b>المستندات:</b> تزويد الطرف الأول بالمعلومات والمستندات اللازمة في الوقت المناسب وتحمّل صحتها.'),
      R('6.2','<b>Follow-up:</b> attend meetings, follow up leads within 7 days of handover, and report outcomes and any closed deal.','<b>المتابعة:</b> حضور الاجتماعات، ومتابعة الفرص خلال 7 أيام من تسليمها، وإبلاغ الطرف الأول بنتائجها وبأي صفقة مغلقة.'),
      R('6.3','<b>Rejecting a lead:</b> a lead is deemed accepted unless the Second Party rejects it in writing, with reasons, within 5 business days of handover, on the grounds in clause 5.10.','<b>رفض الفرصة:</b> تُعدّ الفرصة مقبولة ما لم يرفضها الطرف الثاني كتابةً مع بيان السبب خلال 5 أيام عمل من تسليمها، وللأسباب الواردة في البند 5.10.'),
      R('6.4','<b>Contact data:</b> comply with clause 7 on the contact details received in leads.','<b>بيانات التواصل:</b> الالتزام بالبند 7 في بيانات التواصل المستلمة ضمن الفرص.'),
      R('6.5','<b>Payment:</b> pay the fees and the success fee on their due dates under clauses 3 and 5.','<b>السداد:</b> سداد الرسوم ونسبة النجاح في مواعيد استحقاقها وفق البندين 3 و5.'),
      R('6.6','<b>Cooperation:</b> authorize the First Party in writing to submit registration applications in its name; do not hand over account passwords (delegated access or a separate account is used); a buying entity’s rejection for missing documents is the Second Party’s responsibility.','<b>التعاون:</b> تفويض الطرف الأول كتابةً بتقديم طلبات التسجيل باسمه، وعدم تسليمه كلمات مرور حساباته (يُعتمد وصول مفوَّض أو حساب مستقل)؛ ورفض الجهة المشترية لنقص المستندات مسؤولية الطرف الثاني.'),
      R('6.7',f'<b>Copy (CC):</b> copy the First Party’s email {EM} on email correspondence concerning delivered leads with the referred entities, and consent to this. The First Party keeps such correspondence confidential and uses it only for evidence and follow-up; failure to copy does not forfeit the First Party’s success fee, which may be proved by any other evidence.',f'<b>النسخة (CC):</b> إضافة بريد الطرف الأول {EM} في خانة النسخة في المراسلات الإلكترونية الخاصة بالفرص المسلَّمة مع الجهات المحالة، والموافقة على ذلك. ويتعهد الطرف الأول بسرية هذه المراسلات واستعمالها للإثبات والمتابعة فقط، ولا يُسقط عدم إضافتها حق الطرف الأول في نسبة النجاح (يجوز إثباته بأي دليل آخر).')])
    # 7
    B.append([H(7,'Contact Data Protection','حماية بيانات التواصل'),
      R('7.1','<b>Nature and roles:</b> contact details in leads (name, email, mobile) are personal data. The First Party is a controller when collecting them, and the Second Party becomes an independent controller for its own purposes on receipt, so this is a transfer between controllers, not processing on behalf. The First Party acts as processor only for the Second Party’s own data (its documents and registration data).','<b>الطبيعة والأدوار:</b> بيانات التواصل في الفرص (اسم، بريد، جوال) بيانات شخصية. الطرف الأول جهة تحكم عند جمعها، ويصبح الطرف الثاني جهة تحكم مستقلة لأغراضه عند تسلّمها، فهذا نقل بين جهتي تحكم لا معالجة بالنيابة. ولا يكون الطرف الأول معالجاً إلا فيما يعالجه من بيانات الطرف الثاني نفسه (مستنداته وبيانات تسجيله).'),
      R('7.2','<b>Purpose:</b> the Second Party uses the data only for the agreed purpose (business communications offering its products or services to the entity).','<b>الغرض:</b> يستعمل الطرف الثاني البيانات للغرض المتفق عليه فقط (تواصل تجاري لعرض منتجاته أو خدماته على الجهة).'),
      R('7.3','<b>Storage and security:</b> the Second Party applies reasonable security measures and retains the data for [24] months from delivery or until the contract ends, whichever is earlier.','<b>التخزين:</b> يتخذ الطرف الثاني تدابير أمنية معقولة، ويحتفظ بالبيانات [24] شهراً من تسليمها أو حتى انتهاء العقد أيهما أسبق.'),
      R('7.4','<b>Sharing with third parties:</b> the Second Party shall not sell or transfer the data to any third party or merge it into general marketing lists, and shall not transfer it outside the Kingdom except under the statutory transfer rules.','<b>المشاركة مع الغير:</b> لا يبيع الطرف الثاني البيانات ولا ينقلها لأي طرف ثالث ولا يدمجها في قوائم تسويقية عامة، ولا ينقلها خارج المملكة إلا وفق ضوابط النقل النظامية.'),
      R('7.5','<b>Rights:</b> the Second Party honors opt-out requests and data subject rights immediately and informs the First Party; its marketing messages include an unsubscribe link, and it keeps opt-out records.','<b>الحقوق:</b> يحترم الطرف الثاني طلبات الإلغاء وحقوق أصحاب البيانات فوراً ويبلّغ الطرف الأول بها، وتتضمن رسائله التسويقية رابط إلغاء الاشتراك مع حفظ سجلات الإلغاء.'),
      R('7.6','<b>Destruction:</b> after the retention period the Second Party destroys the data, unless an actual commercial relationship arises, in which case it retains what that relationship needs. “Actual commercial relationship” means a signed contract or active negotiation documented in writing. Excepted: what the law requires or what is needed to prove the success fee.','<b>الإتلاف:</b> يتلف الطرف الثاني البيانات بعد انقضاء مدة الاحتفاظ، ما لم تنشأ علاقة تجارية فعلية فيحتفظ بما يلزمها. و«علاقة تجارية فعلية» عقد موقّع أو تفاوض نشط موثّق كتابةً. ويُستثنى ما يلزم نظاماً أو لإثبات نسبة النجاح.'),
      R('7.7','<b>Breach:</b> each party notifies the other within 48 hours of becoming aware of a breach, and each also meets its own statutory notification duties.','<b>التسرّب:</b> يشعر كل طرف الآخر خلال 48 ساعة من العلم بأي تسرّب، مع التزام كل طرف بما يفرضه النظام عليه من إبلاغ.'),
      R('7.8','<b>First Party:</b> it warrants the source and lawfulness of collection only to the best of its knowledge, without warranting accuracy or currency, and publishes the required privacy notice.','<b>الطرف الأول:</b> يضمن مصدر البيانات ومشروعية جمعها في حدود علمه فقط، دون ضمان صحتها أو حداثتها، وينشر إشعار الخصوصية اللازم.')])
    # 8-9
    B.append([H(8,'Term','المدة'),
      R('8.1','The term is 12 months from [●] and renews by mutual consent.','مدة العقد 12 شهراً من تاريخ [●]، وتتجدد بموافقة الطرفين.'),
      H(9,'Termination','الإلغاء'),
      R('9.1','The minimum commitment is 3 full months.','الحد الأدنى للالتزام 3 أشهر كاملة.'),
      R('9.2','After it, the Second Party may cancel by written notice of 30 days; the notice may be sent during the second month so that it takes effect no earlier than the end of the third month.','يحق للطرف الثاني الإلغاء بعد انقضاء هذا الحد بإشعار خطي مدته 30 يوماً، ويجوز إرسال الإشعار خلال الشهر الثاني بحيث لا يسري قبل نهاية الشهر الثالث.'),
      R('9.3','Fees are due until the cancellation actually takes effect; amounts paid in advance for later months are refunded pro rata or deducted, and nothing is refundable for the first three months.','تُستحق الرسوم حتى تاريخ سريان الإلغاء الفعلي، ويُرد بالتناسب أو يُخصم ما دُفع مقدماً عن أشهر لاحقة له، ولا استرداد عن الأشهر الثلاثة الأولى.'),
      R('9.4','The First Party may terminate the contract or suspend the service for non-payment or material breach after 10 days’ written warning.','للطرف الأول إنهاء العقد أو إيقاف الخدمة عند عدم السداد أو الإخلال الجسيم بعد إنذار كتابي مدته 10 أيام.'),
      R('9.5','Success fees remain due after cancellation or expiry on delivered leads under clause 5.','تبقى نسب النجاح مستحقة بعد الإلغاء أو الانتهاء عن الفرص المسلَّمة وفق البند 5.'),
      H(10,'Exclusions','خارج نطاق السعر'),
      R('10.1','Not included: registration fees charged by buyers, government fees or platform subscriptions, travel, classification or certificates, and any item not expressly listed: [●].','لا يشمل السعر: رسوم التسجيل لدى الجهات، والرسوم الحكومية واشتراكات المنصات، والسفر، والتصنيف والشهادات، وأي بند غير مذكور صراحة: [●].')])
    B.append([H(11,'No Guarantee','عدم الضمان'),
      R('11.1','The First Party does not guarantee vendor acceptance or deal closure; the final decision rests with the buying entities.','لا يضمن الطرف الأول قبول تسجيل المورد أو إغلاق صفقة، والقرار النهائي للجهات المشترية.'),
      R('11.2','Its obligation is limited to the monthly deliverables (clause 4), the sole remedy for missing them being completion then credit.','والتزامه محصور في المخرجات الشهرية (بند 4)، وجزاء الإخلال بها هو الاستكمال ثم الرصيد الدائن حصراً.'),
      H(12,'Confidentiality','السرية'),
      R('12.1','Both parties are bound by the attached Non-Disclosure Agreement, which does not prevent the Second Party from using delivered leads for the purpose of this contract.','يلتزم الطرفان بسرية المعلومات وفق اتفاقية عدم الإفصاح المرفقة، ولا يمنع ذلك استعمال الطرف الثاني للفرص المسلَّمة لغرض هذا العقد.'),
      H(13,'Intellectual Property','الملكية الفكرية'),
      R('13.1','Reports, lists and lead databases are the First Party’s property.','التقارير والقوائم وقواعد الفرص ملك الطرف الأول.'),
      R('13.2','The Second Party has a limited, non-exclusive, non-transferable licence to use them for its agreed business purpose during the term and afterwards to the extent of the leads delivered, with no resale or sub-licensing.','وللطرف الثاني ترخيص محدود غير حصري غير قابل للتنازل لاستعمالها لغرضه التجاري المتفق عليه خلال مدة العقد وبعدها بقدر الفرص المسلَّمة، ولا يجوز إعادة بيعها ولا ترخيصها من الباطن.'),
      H(14,'Subcontractors','الاستعانة بالغير'),
      R('14.1','The First Party may use contractors, processors and tool providers (including artificial intelligence and cloud hosting) under similar confidentiality obligations, and remains liable to the Second Party.','للطرف الأول الاستعانة بمقاولين ومعالجين ومزودي أدوات (ومنها الذكاء الاصطناعي والاستضافة السحابية) بالتزامات سرية مماثلة، ويبقى مسؤولاً أمام الطرف الثاني.')])
    B.append([H(15,'Anti-Bribery &amp; Government Entities','مكافحة الرشوة والجهات الحكومية'),
      R('15.1','Neither party, nor its agents or subcontractors, shall pay or offer any unlawful advantage to employees of buying entities.','لا يدفع أي طرف أو وكلاؤه أو مقاولوه من الباطن أو يعرض أي مزية غير مشروعة لموظفي الجهات المشترية.'),
      R('15.2','Where the entity is governmental or semi-governmental, the treatment of the success fee on it is: [●], and both parties comply with the government competition and procurement rules.','وإن كانت الجهة حكومية أو شبه حكومية فيُحدَّد حكم نسبة النجاح عنها بـ: [●]، ويلتزم الطرفان بأنظمة المنافسات والمشتريات الحكومية.'),
      H(16,'Liability','المسؤولية'),
      R('16.1','The First Party’s total aggregate liability for all claims arising out of this contract taken together does not exceed the monthly fees paid or due during the twelve months preceding the first event giving rise to a claim.','لا تتجاوز مسؤولية الطرف الأول الإجمالية عن جميع المطالبات الناشئة عن هذا العقد مجتمعةً الرسوم الشهرية المدفوعة أو المستحقة خلال الأشهر الاثني عشر السابقة للواقعة الأولى المنشئة للمطالبة.'),
      R('16.2','The cap is not less than the fees for the minimum commitment (3 months).','ولا يقل السقف عن رسوم الحد الأدنى للالتزام (3 أشهر).'),
      R('16.3','The First Party is not liable for indirect damages or loss of profit or opportunity.','ولا يُسأل الطرف الأول عن الأضرار غير المباشرة أو فوات الربح أو الفرص.'),
      R('16.4','Neither this cap nor this exclusion applies to fraud, wilful misconduct or gross negligence, nor to breach of confidentiality or the Personal Data Protection Law, and neither limits the Second Party’s financial obligations.','ولا يسري هذا السقف ولا هذا الاستبعاد على الغش أو التعمد أو الخطأ الجسيم، ولا على الإخلال بالسرية أو بنظام حماية البيانات الشخصية، ولا يُحدّ من التزامات الطرف الثاني المالية.')])
    B.append([H(17,'Governing Law &amp; Disputes','القانون وحل النزاعات'),
      R('17.1','The contract is governed by the laws of the Kingdom of Saudi Arabia.','يخضع العقد لأنظمة المملكة العربية السعودية.'),
      R('17.2','Disputes are resolved amicably within 30 days of written notice, then before the Commercial Court in Riyadh.','تُحل النزاعات ودياً خلال 30 يوماً من الإخطار الخطي، ثم أمام المحكمة التجارية في الرياض.'),
      R('17.3','The contract documents rank in this order: the contract, then the quotation, then any addendum.','تُقدَّم وثائق العقد بالترتيب: العقد ثم عرض السعر ثم أي ملحق.'),
      R('17.4','Electronic signature is valid.','ويُعتدّ بالتوقيع الإلكتروني.'),
      H(18,'General','أحكام عامة'),
      R('18.1','The Arabic version prevails in case of discrepancy: [●].','النسخة العربية هي المرجع عند الاختلاف: [●].'),
      R('18.2','Amendments only in writing signed by both parties.','لا يُعدَّل العقد إلا كتابةً بموافقة الطرفين.'),
      R('18.3','The contract may not be assigned or transferred without consent.','لا يُنقل العقد أو يُتنازل عنه دون موافقة.'),
      R('18.4','It replaces any prior offers, and remains valid in the remainder if a part is void.','يحل العقد محل أي عروض سابقة، ويبقى باقيه نافذاً إن بطل جزء منه.'),
      R('18.5','Neither party is liable for delay caused by force majeure.','ولا يُسأل أي طرف عن تأخر ناتج عن القوة القاهرة.'),
      R('18.6','Notices to the addresses stated: [●].','الإشعارات على العناوين المذكورة: [●].')])
    return B
