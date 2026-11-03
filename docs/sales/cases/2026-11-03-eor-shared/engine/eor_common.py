# -*- coding: utf-8 -*-
"""المحتوى المشترك لحزمة نظام التعاقد (EOR). cfg العميل يمرّر الحقائق فقط؛ كل ما لم يُوثَّق `[●]`.
قرارات المالك المطبّقة: «نظام التعاقد» بالعربي بدل EOR · تذكرة القدوم والسفارة ومكاتب الخارج على العميل ·
لا تكلفة ولا هامش ولا سعودة في مستند العميل · العقد والـNDA والتفويض من نصوص القانونية (templates/categories)."""

def make(*, client_en, client_ar, roles, source, housing, site_en, site_ar, start_en, start_ar,
         term_en, term_ar, med_en, med_ar, countries_en="[●]", countries_ar="[●]", headcount_note=None,
         workers_suffix=None, workers_label=None, date_en="3 November 2026", date_ar="3 نوفمبر 2026", extra_scope=None, extra_req=None):
    workers = sum(r["count"] for r in roles)
    wl_en, wl_ar = workers_label or (str(workers), str(workers))
    wsuf_en, wsuf_ar = workers_suffix or ("", "")
    abroad, inside = source in ("abroad", "tbd"), source in ("inside", "tbd")

    # ----- النطاق
    sourcing_en = {"abroad": "Recruitment through licensed recruitment parties abroad, work-visa issuance, and following up the applications until the workers arrive and start.",
                   "inside": "Transferring the services of workers already inside the Kingdom to Business Partner as their employer, and issuing their work and residence permits.",
                   "tbd": "Either transferring the services of workers already inside the Kingdom, or recruiting from abroad through licensed parties with work-visa issuance — as the Client chooses for each worker."}[source]
    sourcing_ar = {"abroad": "الاستقدام عبر جهات استقدام مرخصة في الخارج، واستخراج تأشيرات العمل، ومتابعة الطلبات حتى وصول العمال ومباشرتهم.",
                   "inside": "نقل خدمات العمال الموجودين داخل المملكة إلى Business Partner بصفتها صاحب عملهم، واستخراج رخص عملهم وإقاماتهم.",
                   "tbd": "إما نقل خدمات العمال الموجودين داخل المملكة، أو الاستقدام من الخارج عبر جهات مرخصة مع استخراج تأشيرات العمل، بحسب اختيار العميل لكل عامل."}[source]
    housing_en = {"bp": "Accommodation, meals and transport for the workers are provided by Business Partner and included in the monthly price.",
                  "client": "Accommodation, meals and transport for the workers are provided by the Client.",
                  "choice": "Accommodation, meals and transport: the Client chooses who provides them (see section 4). Where Business Partner provides them they are added to the monthly price."}[housing]
    housing_ar = {"bp": "السكن والإعاشة والمواصلات للعمال توفّرها Business Partner وهي ضمن السعر الشهري.",
                  "client": "السكن والإعاشة والمواصلات للعمال يوفّرها العميل.",
                  "choice": "السكن والإعاشة والمواصلات: يحدّد العميل من يوفّرها (انظر البند 4). وإن وفّرتها Business Partner أُضيفت إلى السعر الشهري."}[housing]
    scope = [
        ("Employment on your behalf", "التعاقد نيابةً عنكم",
         "Business Partner is the workers’ legal employer: it contracts them, pays their wages through the wage-protection system, and keeps their records with the government entities. They work for you under your daily direction.",
         "تكون Business Partner صاحب العمل النظامي للعمال: تتعاقد معهم وتدفع أجورهم عبر نظام حماية الأجور وتحفظ سجلاتهم لدى الجهات الحكومية. ويعملون لديكم بتوجيهكم اليومي."),
        ("Roles, site and term", "الوظائف والموقع والمدة",
         "%s worker(s) in the roles listed in section 2, working in %s, starting %s, for %s." % (wl_en, site_en, start_en, term_en),
         "%s عاملاً في الوظائف المبيّنة في البند 2، في %s، بدءاً من %s، لمدة %s." % (wl_ar, site_ar, start_ar, term_ar)),
        ("Sourcing the workers", "توفير العمال", sourcing_en, sourcing_ar),
        ("Residency and insurance", "الإقامة والتأمين",
         "Residence permits, work permits, health insurance (%s) and social insurance for each assigned worker, as the regulations require." % med_en,
         "الإقامات ورخص العمل والتأمين الصحي (%s) والتأمينات الاجتماعية لكل عامل مسنَد، بحسب الأنظمة." % med_ar),
        ("Accommodation, meals and transport", "السكن والإعاشة والمواصلات", housing_en, housing_ar),
        ("Management and replacement", "الإدارة والاستبدال",
         "Monthly payroll and records, one point of contact, and replacement of a worker who is unfit or leaves, as set in the Agreement.",
         "الرواتب والسجلات شهرياً، ونقطة اتصال واحدة، واستبدال العامل الذي لا يصلح أو يغادر، وفق ما يحدده العقد."),
    ] + (extra_scope or [])

    includes = [
        ("The workers’ salaries and allowances, as agreed per role in the table above.", "رواتب العمال وبدلاتهم، بحسب ما يُتفق عليه لكل وظيفة في الجدول أعلاه."),
        ("Residence permits, work permits and the Ajeer platform fees, kept valid for the whole term.", "الإقامات ورخص العمل ورسوم منصة أجير، سارية طوال مدة العقد."),
        ("Health insurance (%s) and social insurance for each worker." % med_en, "التأمين الصحي (%s) والتأمينات الاجتماعية لكل عامل." % med_ar),
        ("Employment management: contracts, monthly payroll through the wage-protection system, records, and one point of contact.", "إدارة التعاقد: العقود والرواتب شهرياً عبر نظام حماية الأجور والسجلات ونقطة اتصال واحدة."),
        ("Replacement of a worker who is unfit or leaves, as set in the Agreement.", "استبدال العامل الذي لا يصلح أو يغادر، وفق ما يحدده العقد."),
    ]
    if housing == "bp":
        includes.append(("Accommodation, meals and transport for the workers.", "السكن والإعاشة والمواصلات للعمال."))

    BR = ("[●]", "[●]")
    at_cost = []
    if inside:
        at_cost.append(("Service-transfer fee", "رسم نقل الخدمات", "The government fee for transferring a worker’s sponsorship to Business Partner, paid to the entity at cost.",
                        "الرسم الحكومي لنقل كفالة العامل إلى Business Partner، يُسدَّد للجهة بالتكلفة.", BR))
    if abroad:
        at_cost += [
            ("Recruitment abroad and embassy requirements", "الاستقدام من الخارج ومتطلبات السفارة", "The licensed recruitment parties’ charges, visa and embassy requirements, attestation and medical checks, invoiced at actual cost.",
             "رسوم جهات الاستقدام المرخصة ومتطلبات التأشيرة والسفارة والتصديق والفحص الطبي، بالتكلفة الفعلية.", "client"),
            ("Arrival ticket", "تذكرة القدوم", "The workers’ travel ticket to the Kingdom.", "تذكرة سفر العمال إلى المملكة.", "client")]
    at_cost += [
        ("End-of-service award", "مكافأة نهاية الخدمة", "Calculated under the labour regulations, settled with the final invoice.", "تُحتسب وفق نظام العمل وتُسوَّى مع الفاتورة الأخيرة.", BR),
        ("Annual leave", "الإجازة السنوية", "Leave entitlement of 21 days per year, settled at cost.", "استحقاق الإجازة 21 يوماً في السنة، يُسوَّى بالتكلفة.", BR),
        ("Return ticket", "تذكرة العودة", "The workers’ return ticket at the end of the term.", "تذكرة عودة العمال عند انتهاء المدة.", BR)]

    requirements = [
        ("Company details: commercial registration, national address, tax number and the authorised signatory’s name and title.", "بيانات المنشأة: السجل التجاري والعنوان الوطني والرقم الضريبي واسم المفوّض بالتوقيع وصفته."),
        ("For each role: the exact tasks, the number of workers, the required nationality and experience, and the salary range the Client has in mind.", "لكل وظيفة: المهام الدقيقة وعدد العمال والجنسية والخبرة المطلوبة ونطاق الراتب الذي يتصوره العميل."),
        ("For workers the Client has chosen: CVs and a contact number for each worker, and whether each is inside the Kingdom or must be recruited from abroad.", "للعمال الذين اختارهم العميل: السير الذاتية ورقم تواصل كل عامل، وهل هو داخل المملكة أو يلزم استقدامه من الخارج."),
        ("The work site, the start date and the term, and day-to-day supervision, a safe working environment and safety equipment.", "موقع العمل وتاريخ المباشرة والمدة، والإشراف اليومي وبيئة عمل آمنة ومعدات السلامة."),
        ("The accommodation, meals and transport arrangement, if different from section 1.", "ترتيب السكن والإعاشة والمواصلات إن اختلف عمّا في البند 1."),
        ("The signed quotation, agreement, non-disclosure agreement and authorisation letter, and payment of the advance before the start of procedures.", "عرض السعر والعقد واتفاقية عدم الإفصاح وخطاب التفويض موقّعة، وسداد الدفعة المقدمة قبل بدء الإجراءات."),
    ] + (extra_req or [])

    exclusions = [
        ("VAT at 15%, added according to the regulations.", "ضريبة القيمة المضافة 15% وتُضاف وفق النظام."),
        ("The items in section 4, which are invoiced at actual cost to the party stated there.", "البنود الواردة في البند 4، وتُفوتر بتكلفتها الفعلية على الطرف المبيّن فيه."),
        ("Uniforms, tools, equipment and materials for the work, unless agreed in writing.", "الزي والأدوات والمعدات والمواد للعمل، ما لم يُتفق عليها كتابةً."),
        ("Overtime, invoiced at the actual hours worked under the regulations.", "العمل الإضافي، ويُفوتر بالساعات الفعلية وفق الأنظمة."),
        ("Any worker beyond the number stated, and any change of role or nationality, which need a written change request priced separately.", "أي عمالة تزيد عن العدد المذكور وأي تغيير في الوظيفة أو الجنسية، وتحتاج طلب تغيير كتابياً يُسعَّر على حدة."),
        ("Any effect on the Client’s localisation count or band is not guaranteed.", "لا يُضمن أي أثر على نسبة التوطين أو نطاق العميل."),
    ]

    stages = [("Acceptance and advance", "القبول والدفعة المقدمة", "Signing the quotation, the agreement and the authorisation, and paying the advance.", "توقيع العرض والعقد والتفويض وسداد الدفعة المقدمة."),
              ("Selection", "الاختيار", "Candidate CVs, the Client’s interview and selection.", "سير المرشحين، ومقابلة العميل واختياره.")]
    stages.append(("Contracting and government procedures", "التعاقد والإجراءات الحكومية",
                   {"abroad": "Work-visa applications, attestation and medical checks through the licensed parties.", "inside": "Service-transfer requests, work permits and insurance registration.",
                    "tbd": "Service-transfer requests or work-visa applications, work permits and insurance registration."}[source],
                   {"abroad": "طلبات تأشيرات العمل والتصديق والفحص الطبي عبر الجهات المرخصة.", "inside": "طلبات نقل الخدمات ورخص العمل وتسجيل التأمين.",
                    "tbd": "طلبات نقل الخدمات أو تأشيرات العمل، ورخص العمل وتسجيل التأمين."}[source]))
    if abroad: stages.append(("Travel and arrival", "السفر والوصول", "Booking travel, arrival, and handing the workers over at the site.", "حجز السفر والوصول وتسليم العمال في الموقع."))
    stages.append(("Residency and start", "الإقامة والمباشرة", "Iqama, work permit, insurance, and starting work.", "الإقامة ورخصة العمل والتأمين، وبدء العمل."))

    terms = [
        ("This quotation is valid for 14 days from its date.", "هذا العرض سارٍ لمدة 14 يوماً من تاريخه."),
        ("Prices are in Saudi riyals, per worker per month, before 15% VAT, which is added according to the regulations.", "الأسعار بالريال السعودي، للعامل الواحد شهرياً، قبل ضريبة القيمة المضافة 15% وتُضاف وفق النظام."),
        ("The stage durations depend on the licensed parties, the embassies and the competent authorities; we state them in writing before starting and do not guarantee a visa approval, a transfer approval or an arrival date.",
         "تعتمد مدد المراحل على الجهات المرخصة والسفارات والجهات المختصة؛ ونذكرها كتابةً قبل البدء ولا نضمن قبول تأشيرة ولا موافقة نقل ولا موعد وصول."),
        ("Early termination before the end of the term, end-of-service and replacement: as set in the Agreement.", "الإنهاء المبكر قبل نهاية المدة ونهاية الخدمة والاستبدال: وفق ما يحدده العقد."),
        ("No fee is charged to any worker in any form, and no worker’s passport is withheld.", "لا يُتقاضى أي مقابل من أي عامل بأي صورة، ولا يُحجز جواز أي عامل."),
        ("The legal terms are in the Agreement, the non-disclosure agreement and the authorisation letter signed with this quotation.", "الأحكام القانونية في العقد واتفاقية عدم الإفصاح وخطاب التفويض الموقّعة مع هذا العرض."),
    ]

    q = dict(
        title_en="Quotation: Employment Outsourcing", title_ar="عرض سعر: نظام التعاقد",
        cover_title_en="Employment Outsourcing (EOR) — %s workers" % wl_en, cover_title_ar="نظام التعاقد — %s عاملاً" % wl_ar,
        cover_sub_en="We employ the workers on your behalf, manage their contracts, payroll and government files, and assign them to work with you.",
        cover_sub_ar="نوظّف العمال نيابةً عنكم، وندير عقودهم ورواتبهم وملفاتهم الحكومية، ونسندهم للعمل لديكم.",
        cover_tag_en="Employment outsourcing · %s workers · %s" % (wl_en, site_en), cover_tag_ar="نظام التعاقد · %s عاملاً · %s" % (wl_ar, site_ar),
        scope=scope, includes=includes, at_cost=at_cost, requirements=requirements, exclusions=exclusions, stages=stages,
        term_en="Term: %s, starting %s, in %s. Procedures start after the agreement is signed and the advance is paid, early enough for the workers to be available on the start date." % (term_en, start_en, site_en),
        term_ar="المدة: %s، بدءاً من %s، في %s. تبدأ الإجراءات بعد توقيع العقد وسداد الدفعة المقدمة، بوقت يكفي لتوفّر العمال في تاريخ البدء." % (term_ar, start_ar, site_ar),
        terms=terms, workers_suffix_en=wsuf_en, workers_suffix_ar=wsuf_ar,
        price_note_en="Monthly price per worker, in Saudi riyals, before 15%% VAT. The monthly total for all workers is the sum of the rows. %s" % (headcount_note[0] if headcount_note else ""),
        price_note_ar="السعر الشهري للعامل بالريال السعودي قبل ضريبة القيمة المضافة 15%%. والإجمالي الشهري لكل العمال مجموع الصفوف. %s" % (headcount_note[1] if headcount_note else ""),
    )

    # ----- العقد
    subject = [
        ("The First Party employs the workers listed in the accepted quotation, as their legal employer, and assigns them to work for the Second Party in the roles, numbers and nationalities stated there, which form an integral part of this Agreement.",
         "يوظّف الطرف الأول العمال المبيّنين في عرض السعر المقبول بصفته صاحب عملهم النظامي، ويسندهم للعمل لدى الطرف الثاني في الوظائف والأعداد والجنسيات المذكورة فيه، ويُعدّ جزءاً لا يتجزأ من هذا العقد."),
        ("This is a separate written contract for employment on behalf of the Second Party. It is not a recruitment-only service, and it does not make the workers employees of the Second Party.",
         "هذا عقد كتابي مستقل للتعاقد نيابةً عن الطرف الثاني، وليس خدمة استقدام فقط، ولا يجعل العمال موظفين لدى الطرف الثاني."),
        ("The workers remain employed by the First Party, or by a licensed partner where the regulations so require. The First Party remains responsible to the Second Party for performance.",
         "يبقى العمال على عمل الطرف الأول، أو شريك مرخّص حيث تقتضي الأنظمة ذلك. ويبقى الطرف الأول مسؤولاً أمام الطرف الثاني عن التنفيذ."),
    ]
    term_c = [
        ("The Agreement starts on signature and runs for %s, from the start date at the site, renewable by written agreement." % term_en,
         "يبدأ العقد من التوقيع ويستمر %s من تاريخ المباشرة في الموقع، ويُجدَّد باتفاق كتابي." % term_ar),
        ("The expected start date at the site is %s, in %s." % (start_en, site_en), "تاريخ المباشرة المتوقع في الموقع %s، في %s." % (start_ar, site_ar)),
        ("The stages are those in the accepted quotation; the First Party states each stage’s duration in writing before starting.", "المراحل هي الواردة في عرض السعر المقبول، ويذكر الطرف الأول مدة كل مرحلة كتابةً قبل البدء."),
        ("The durations depend on the licensed parties, the embassies and the competent authorities. The First Party does not guarantee a visa approval, a transfer approval or an arrival date.",
         "تعتمد المدد على الجهات المرخصة والسفارات والجهات المختصة، ولا يضمن الطرف الأول قبول تأشيرة ولا موافقة نقل ولا موعد وصول.")]
    conditions = [
        ("Accommodation, meals and transport are provided by the party stated in the accepted quotation; where the First Party provides them, they are included in or added to the monthly price as that quotation states.",
         "يوفّر السكن والإعاشة والمواصلات الطرف المبيّن في عرض السعر المقبول؛ وإن وفّرها الطرف الأول فهي ضمن السعر الشهري أو تُضاف إليه كما يذكر ذلك العرض."),
        ("The Second Party provides a safe site, the tools, equipment, materials and personal protective equipment for the work, unless agreed otherwise in writing.",
         "يوفّر الطرف الثاني موقعاً آمناً والأدوات والمعدات والمواد ومعدات الحماية الشخصية للعمل، ما لم يُتفق على غير ذلك كتابةً."),
        ("The Second Party directs the daily tasks within the agreed roles only. Hiring, dismissal, discipline, wages and leave remain the First Party’s.",
         "يوجّه الطرف الثاني المهام اليومية ضمن الوظائف المتفق عليها فقط. وتبقى قرارات التوظيف والفصل والتأديب والأجور والإجازات للطرف الأول.")]
    cancel = [
        ("Cancellation before the procedures start: refund of the advance after deducting the actual costs incurred, and [●].", "الإلغاء قبل بدء الإجراءات: يُرد المقدَّم بعد خصم التكاليف الفعلية المتكبدة، و[●]."),
        ("Cancellation after the procedures start: amounts spent or committed to third parties are not refundable, except where the First Party is at fault.", "الإلغاء بعد بدء الإجراءات: لا تُسترد المبالغ المنفقة أو الملتزَم بها للغير، إلا لخطأ من الطرف الأول."),
        ("Where a visa or transfer is rejected, or a worker does not travel or start, the First Party replaces the worker or refunds the amounts paid for that worker, as stated in the accepted quotation.",
         "عند رفض تأشيرة أو نقل، أو عدم سفر العامل أو مباشرته، يستبدله الطرف الأول أو يرد المبالغ المدفوعة عن ذلك العامل، وفق ما يذكره عرض السعر المقبول.")]
    contract = dict(title_en="Employment Outsourcing Agreement", title_ar="عقد نظام التعاقد",
                    sub_en="Employment of %s worker(s) on behalf of the Client and their assignment to work with it." % wl_en,
                    sub_ar="توظيف %s عاملاً نيابةً عن العميل وإسنادهم للعمل لديه." % wl_ar,
                    subject=subject, term=term_c, conditions=conditions, cancel=cancel)

    # ----- التفويض
    D = {}
    D["visa"] = ("Work-visa and recruitment applications", "طلبات تأشيرات العمل والاستقدام", "Qiwa and the competent authorities for work visas", "قوى والجهات المختصة بتأشيرات العمل",
                 "Preparing, submitting and following up the work-visa and recruitment applications for the workers of the accepted quotation, until the workers arrive.",
                 "إعداد طلبات تأشيرات العمل والاستقدام لعمال عرض السعر المقبول وتقديمها ومتابعتها حتى وصول العمال.")
    D["transfer"] = ("Service-transfer requests and employment contracts", "طلبات نقل الخدمات وعقود العمل", "Qiwa and the Ministry of Human Resources and Social Development", "قوى ووزارة الموارد البشرية والتنمية الاجتماعية",
                     "Preparing, submitting and following up the service-transfer requests of the workers of the accepted quotation, and documenting their employment contracts.",
                     "إعداد طلبات نقل خدمات عمال عرض السعر المقبول وتقديمها ومتابعتها، وتوثيق عقود عملهم.")
    D["perm"] = ("Residence permits, work permits and insurance", "الإقامات ورخص العمل والتأمين", "Muqeem, Qiwa, GOSI and the Ministry of Human Resources", "مقيم وقوى والتأمينات الاجتماعية ووزارة الموارد البشرية",
                 "Issuing and renewing the workers’ residence permits and work permits, registering their insurance, and opening the related files.",
                 "إصدار إقامات العمال ورخص عملهم وتجديدها، وتسجيل تأمينهم، وفتح الملفات المرتبطة.")
    D["offices"] = ("Dealing with licensed recruitment parties", "التعامل مع جهات الاستقدام المرخصة", "Licensed recruitment parties in %s" % countries_en, "جهات الاستقدام المرخصة في %s" % countries_ar,
                    "Instructing the licensed parties, receiving candidate CVs, and coordinating travel and arrival. No fee is taken from any worker.",
                    "توجيه الجهات المرخصة، واستلام سير المرشحين، وتنسيق السفر والوصول. ولا يُؤخذ أي مقابل من أي عامل.")
    D["fees"] = ("Paying official fees on the Client’s behalf", "دفع الرسوم الرسمية نيابةً عن العميل", "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
                 "Only from funds the Client has deposited for that purpose, against the entity’s receipt; the unused balance is returned.",
                 "من مبالغ أودعها العميل لهذا الغرض فقط وبإيصال الجهة، ويُرد الرصيد غير المستعمل.")
    D["notices"] = ("Receiving notifications and official correspondence", "استلام الإشعارات والمراسلات الرسمية", "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
                    "Receiving notifications and official documents relating to the authorised transactions only, and notifying the Client within [2] business days.",
                    "استلام الإشعارات والمستندات الرسمية المتعلقة بالمعاملات المفوَّض بها وحدها، وإبلاغ العميل خلال [2] يوم عمل.")
    D["view"] = ("Viewing the Client’s accounts on the platforms", "الاطلاع على حسابات العميل في المنصات", "The platforms of the entities named above", "منصات الجهات المسماة أعلاه",
                 "View-only access through the platforms’ official delegation features, never through passwords or verification codes, limited to the authorised transactions.",
                 "اطلاع فقط عبر خصائص التفويض الرسمية في المنصات، لا بكلمات المرور ولا رموز التحقق، ومحصور في المعاملات المفوَّض بها.")
    out_en = "Transfer outside the Kingdom (needed for recruitment abroad): {BOX} Authorised  {BOX} Not authorised."
    out_ar = "النقل خارج المملكة (يلزم للاستقدام من الخارج): {BOX} مفوَّض  {BOX} غير مفوَّض."
    data_en = "Transferring documents and data only as needed to perform the authorised services, under the data protection clause. " + (out_en if abroad else "Inside the Kingdom only.")
    data_ar = "نقل المستندات والبيانات بقدر ما يلزم لتنفيذ الخدمات المفوَّض بها فقط، وفق بند حماية البيانات. " + (out_ar if abroad else "داخل المملكة فقط.")
    D["data"] = ("Transferring the workers’ and the Client’s data", "نقل بيانات العمال والعميل", "The entities, %sand the First Party’s service providers" % ("the licensed recruitment parties abroad, " if abroad else ""),
                 "الجهات، %sومزودو خدمات الطرف الأول" % ("وجهات الاستقدام المرخصة في الخارج، " if abroad else ""), data_en, data_ar)
    keys = (["visa"] if abroad else []) + (["transfer"] if inside else []) + ["perm"] + (["offices"] if abroad else []) + ["fees", "notices", "view", "data"]
    authz = dict(deleg=[D[k] for k in keys],
                 services_en="employment outsourcing" + (", with recruitment and work-visa services" if abroad else "") + (", with service-transfer services" if inside else ""),
                 services_ar="نظام التعاقد" + ("، مع خدمات الاستقدام وتأشيرات العمل" if abroad else "") + ("، مع خدمات نقل الخدمات" if inside else ""))

    return dict(client_en=client_en, client_ar=client_ar, date_en=date_en, date_ar=date_ar,
                ref_en="Employment Outsourcing", ref_ar="نظام التعاقد", roles=roles, quote=q, contract=contract, authz=authz)
