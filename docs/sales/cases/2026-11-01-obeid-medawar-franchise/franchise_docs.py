# -*- coding: utf-8 -*-
"""مستندات الامتياز التي يحتاجها المحامي السعودي — هياكل وقوائم بلا حكم قانوني: المضمون النهائي يقرّره المحامي المرخَّص."""
import os, sys
from content import *
import build_html as BH, build_office as BO

NOTE_EN = "Facts are filled from the Client’s documents; the final legal content and wording are determined by the Saudi-licensed legal counsel."
NOTE_AR = "تُعبَّأ الوقائع من مستندات العميل؛ والمضمون النظامي النهائي وصياغته يقرّرهما المحامي السعودي المرخَّص."

DOCS = {
"09-Client-Requirements-List": (
  "Client Requirements List", "قائمة المطلوب من العميل", "CHECKLIST", "قائمة",
  "Everything the Client provides so the legal and translation work can start.", "كل ما يقدّمه العميل لتبدأ الأعمال القانونية والترجمة.",
  [["Franchise agreements", "اتفاقيات الامتياز", "The four executed agreements with all schedules, annexes and amendments; dates of signature; confirmation that each remains in force; whether the four are substantially identical or differ materially.", "اتفاقيات الامتياز الأربع الموقّعة بملاحقها وتعديلاتها؛ وتواريخ التوقيع؛ وتأكيد أن كلاً منها سارٍ؛ وهل هي متطابقة جوهرياً أم بينها اختلافات مادية."],
   ["Disclosure material", "مواد الإفصاح", "Any existing disclosure document or franchise information memorandum; proof of delivery to the franchisees, if any.", "أي وثيقة إفصاح أو مذكرة معلومات امتياز قائمة؛ وإثبات تسليمها للممنوح لهم إن وُجد."],
   ["Franchisor documents", "مستندات مانح الامتياز", "Incorporation and constitutional documents; authorised signatories; audited financial statements for the available years.", "مستندات التأسيس والنظام الأساسي؛ والمفوّضون بالتوقيع؛ والقوائم المالية المدققة للسنوات المتاحة."],
   ["Trademarks", "العلامات التجارية", "Trademark registration certificates (countries, classes, owners, expiry) and any licence between the trademark owner and the franchisor.", "شهادات تسجيل العلامات (الدول والفئات والمالك وتاريخ الانتهاء) وأي ترخيص بين مالك العلامة ومانح الامتياز."],
   ["Saudi franchisees and locations", "الممنوح لهم والمواقع في السعودية", "Corporate documents of the two franchisees; documents of the three operating locations; the commercial registrations and licences in force.", "مستندات الشركتين الممنوح لهما؛ ومستندات المواقع التشغيلية الثلاثة؛ والسجلات والتراخيص السارية."],
   ["Manuals", "الأدلة", "Operations, training and brand manuals, or at least their tables of contents.", "أدلة التشغيل والتدريب والعلامة، أو فهارسها على الأقل."],
   ["Previous filings", "المراسلات والقيود السابقة", "Any previous correspondence or filings with the Ministry of Commerce; any powers of attorney, authorisations or declarations.", "أي مراسلات أو قيود سابقة لدى وزارة التجارة؛ وأي وكالات أو تفويضات أو إقرارات."],
   ["Authorisation and decisions", "التفويض والقرارات", "The signed authorisation letter (ticking what the Client authorises) and written approval of each external cost before it is incurred.", "خطاب التفويض الموقّع (بتحديد ما يفوّض به العميل) والموافقة الكتابية على كل تكلفة خارجية قبل تحمّلها."]]),
"10-Disclosure-Document-Outline": (
  "Saudi Disclosure Document: Outline", "وثيقة الإفصاح السعودية: الهيكل", "OUTLINE", "هيكل",
  "The sections the Saudi disclosure document is expected to cover, for the legal counsel to confirm and complete.", "الأقسام المتوقع أن تغطيها وثيقة الإفصاح السعودية ليؤكدها المحامي ويستكملها.",
  [["Franchisor and brand", "مانح الامتياز والعلامة", "Franchisor identity, history and ownership; the brand and its trademark status. %s" % NOTE_EN, "هوية مانح الامتياز وتاريخه وملكيته؛ والعلامة وحالتها. %s" % NOTE_AR],
   ["Franchise system", "منظومة الامتياز", "Description of the franchise system, the concept, products and services, and the support and training the franchisor provides.", "وصف منظومة الامتياز والفكرة والمنتجات والخدمات والدعم والتدريب الذي يقدمه مانح الامتياز."],
   ["Financial terms", "الشروط المالية", "Initial fees, royalties, marketing and other contributions, and the estimated initial investment.", "الرسوم الأولية والإتاوات ومساهمات التسويق وغيرها، وتقدير الاستثمار الأولي."],
   ["Franchisee obligations and restrictions", "التزامات الممنوح له وقيوده", "Operating standards, supply and approved-supplier requirements, territory, exclusivity, non-competition.", "معايير التشغيل ومتطلبات التوريد والموردين المعتمدين والنطاق والحصرية وعدم المنافسة."],
   ["Term, renewal and termination", "المدة والتجديد والإنهاء", "Duration, renewal conditions, termination and transfer.", "المدة وشروط التجديد والإنهاء والتنازل."],
   ["Financial statements and litigation", "القوائم المالية والنزاعات", "Audited financial statements and any material proceedings affecting the franchisor.", "القوائم المالية المدققة وأي دعاوى مؤثرة تخص مانح الامتياز."],
   ["Existing outlets", "المنافذ القائمة", "The existing franchised and owned outlets, including the three in the Kingdom.", "المنافذ القائمة الممنوحة والمملوكة، ومنها الثلاثة في المملكة."]]),
"11-Franchise-Agreement-Localisation-Outline": (
  "Franchise Agreement: Saudi Localisation Outline", "اتفاقية الامتياز: هيكل التوطين السعودي", "OUTLINE", "هيكل",
  "The points of the model agreement the legal counsel reviews and localises.", "نقاط الاتفاقية النموذجية التي يراجعها المحامي ويوطّنها.",
  [["Parties and recitals", "الأطراف والتمهيد", "Parties, trademark rights and the franchise grant. %s" % NOTE_EN, "الأطراف وحقوق العلامة ومنح الامتياز. %s" % NOTE_AR],
   ["Grant, territory and exclusivity", "المنح والنطاق والحصرية", "Scope of the grant, territory, exclusivity and reserved rights.", "نطاق المنح والمنطقة والحصرية والحقوق المحجوزة."],
   ["Fees and payments", "الرسوم والمدفوعات", "Initial fee, royalties, marketing contributions, currency and taxes.", "الرسم الأولي والإتاوات ومساهمات التسويق والعملة والضرائب."],
   ["Operations, standards and training", "التشغيل والمعايير والتدريب", "Manuals, standards, inspections, supplier approvals and training.", "الأدلة والمعايير والتفتيش واعتماد الموردين والتدريب."],
   ["Term, renewal, termination and transfer", "المدة والتجديد والإنهاء والتنازل", "Duration, renewal, termination triggers, post-termination obligations, transfer.", "المدة والتجديد وأسباب الإنهاء والتزامات ما بعد الإنهاء والتنازل."],
   ["Governing law and disputes", "القانون الحاكم والنزاعات", "Governing law, forum and language; the Arabic version.", "القانون الحاكم والجهة واللغة؛ والنسخة العربية."],
   ["Remediation notes", "ملاحظات التصحيح", "For each of the four existing agreements, the provisions that need amendment or a corrective addendum.", "لكل من الاتفاقيات الأربع القائمة، الأحكام التي تحتاج تعديلاً أو ملحقاً تصحيحياً."]]),
"12-Operations-and-Brand-Manual-Brief": (
  "Operations and Brand Manual: Review Brief", "دليل التشغيل والعلامة: موجز المراجعة", "BRIEF", "موجز",
  "What the legal counsel reviews in the manuals, and which parts need translation.", "ما يراجعه المحامي في الأدلة، وأي أجزاء تحتاج ترجمة.",
  [["Purpose", "الغرض", "Identify the parts of the operations, training and brand manuals that are required by the franchise rules or that contain obligations to be disclosed or registered.", "تحديد أجزاء أدلة التشغيل والتدريب والعلامة التي يتطلبها نظام الامتياز أو التي تتضمن التزامات يلزم الإفصاح عنها أو قيدها."],
   ["Review steps", "خطوات المراجعة", "Obtain the manuals or their tables of contents; mark the required parts; confirm the translation scope with the legal counsel before any translation order.", "الحصول على الأدلة أو فهارسها؛ وتحديد الأجزاء المطلوبة؛ وتأكيد نطاق الترجمة مع المحامي قبل أي طلب ترجمة."],
   ["Translation", "الترجمة", "Full translation of the manuals is not assumed; only the parts the legal counsel identifies.", "لا يُفترض ترجمة الأدلة كاملةً؛ بل الأجزاء التي يحدّدها المحامي فقط."],
   ["Brand elements", "عناصر العلامة", "Brand guidelines, licensed marks and any Saudi-specific adaptation.", "إرشادات العلامة والعلامات المرخَّصة وأي تكييف خاص بالسعودية."]]),
"13-Registration-Letter": (
  "Registration Letter to the Ministry of Commerce", "خطاب القيد إلى وزارة التجارة", "LETTER", "خطاب",
  "A letter template for the franchise registration file; the legal counsel confirms the form and the attachments required.", "نموذج خطاب لملف قيد الامتياز؛ ويؤكد المحامي الصيغة والمرفقات المطلوبة.",
  [["Addressee", "الجهة", "To the Ministry of Commerce, Franchise registration. Date: [●]. Reference: [●].", "إلى وزارة التجارة، قيد الامتياز. التاريخ: [●]. المرجع: [●]."],
   ["Subject", "الموضوع", "Request to register the franchise agreements of [franchisor: ●] in the Kingdom.", "طلب قيد اتفاقيات الامتياز الخاصة بـ[مانح الامتياز: ●] في المملكة."],
   ["Body", "المتن", "We submit, on behalf of the franchisor and under its written authorisation, the franchise registration file for the franchise agreements listed in the attached schedule, with the disclosure document and the supporting documents.", "نتقدم، نيابةً عن مانح الامتياز وبتفويض كتابي منه، بملف قيد الامتياز لاتفاقيات الامتياز المدرجة في الجدول المرفق، مع وثيقة الإفصاح والمستندات المؤيدة."],
   ["Attachments", "المرفقات", "Schedule of agreements; disclosure document; certified Arabic translations; authorisation letter; corporate and trademark documents. [exact list: legal counsel]", "جدول الاتفاقيات؛ وثيقة الإفصاح؛ الترجمات العربية المعتمدة؛ خطاب التفويض؛ مستندات الشركة والعلامة. [القائمة الدقيقة: المحامي]"],
   ["Signature", "التوقيع", "Signed by the authorised representative of the franchisor or its authorised legal counsel: [●].", "يوقّعه الممثل المفوَّض لمانح الامتياز أو محاميه المفوَّض: [●]."]]),
"14-Trademark-Review-Checklist": (
  "Trademark Review Checklist", "قائمة مراجعة العلامة التجارية", "CHECKLIST", "قائمة",
  "The trademark points to confirm before registration.", "نقاط العلامة التجارية المراد تأكيدها قبل القيد.",
  [["Ownership", "الملكية", "Who owns the mark; the chain of title between the trademark owner and the franchisor; the licence terms.", "من يملك العلامة؛ وسلسلة الملكية بين مالكها ومانح الامتياز؛ وشروط الترخيص."],
   ["Registration in the Kingdom", "التسجيل في المملكة", "Whether the mark is registered in the Kingdom; classes covered; registration number and expiry.", "هل العلامة مسجَّلة في المملكة؛ والفئات؛ ورقم التسجيل وتاريخ الانتهاء."],
   ["Coverage of the franchised activity", "تغطية النشاط الممنوح", "Whether the registered classes match the franchised goods and services.", "هل الفئات المسجَّلة تطابق السلع والخدمات الممنوحة."],
   ["Gaps and actions", "الفجوات والإجراءات", "Missing registrations, renewals or assignments, and who handles each. [●]", "التسجيلات أو التجديدات أو التنازلات الناقصة ومن يتولاها. [●]"]]),
}
if __name__ == "__main__":
    out = sys.argv[1]
    for fn, (t_en, t_ar, k_en, k_ar, s_en, s_ar, rows) in DOCS.items():
        open(os.path.join(out, fn + ".html"), "w", encoding="utf-8").write(BH.build_info(rows, t_en, t_ar, k_en, k_ar, s_en, s_ar, numbered=True))
        BO.build_docx_info(rows, t_en, t_ar, k_en, k_ar, s_en, s_ar, True, os.path.join(out, fn + ".docx"))
    print("ok docs")
