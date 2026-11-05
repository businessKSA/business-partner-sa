# -*- coding: utf-8 -*-
"""المستندات المطلوبة ودليل الاستقدام والمدد — وثيقة واحدة (تبويب Required Documents). لا أرقام حكومية مخترعة؛ المدد [●] حتى تثبتها الجهات."""
from content import *

BL = "________________"
ROWS = [
    ("A. From the Second Party (the Client)", "أ. من الطرف الثاني (العميل)", "", ""),
    ("Commercial registration and company details", "السجل التجاري وبيانات الشركة",
     "A copy of the commercial registration, the tax number, the national address, and the authorised signatory’s name and title.",
     "صورة السجل التجاري، والرقم الضريبي، والعنوان الوطني، واسم المفوّض بالتوقيع وصفته."),
    ("Establishment files", "ملفات المنشأة",
     "The establishment’s Qiwa and GOSI details, so that visas and workers can be linked to it.",
     "بيانات المنشأة في قوى والتأمينات الاجتماعية ليُربط بها التأشيرات والعمال."),
    ("Site and start date", "الموقع وتاريخ المباشرة",
     "The work location, the required start date, and the contract term.", "موقع العمل وتاريخ المباشرة المطلوب ومدة التعاقد."),
    ("Accommodation, transport and food choice", "خيار السكن والنقل والإعاشة",
     "Whether the Client or the First Party provides them: ☐ Client   ☐ First Party.", "من يوفّرها: ☐ العميل   ☐ الطرف الأول."),
    ("Required trades and the meaning of «professional»", "المهن المطلوبة ومعنى «محترف»",
     "For each trade: the exact tasks, tools, and the level that makes a worker «professional».",
     "لكل مهنة: المهام الدقيقة والأدوات والمستوى الذي يجعل العامل «محترفاً»."),
    ("Nationality split", "توزيع الجنسيات",
     "How many of each team should be Filipino, Indian and Nepali.", "كم من كل فريق يكون فلبينياً وهندياً ونيبالياً."),
    ("Signed documents", "الوثائق الموقّعة",
     "The signed quotation, agreement, non-disclosure agreement and authorisation letter.", "عرض السعر والعقد واتفاقية عدم الإفصاح وخطاب التفويض موقّعة."),
    ("B. From each worker (collected by the First Party through the licensed parties)", "ب. من كل عامل (تجمعها الشركة عبر الجهات المرخصة)", "", ""),
    ("Passport, photo and CV", "الجواز والصورة والسيرة", "A valid passport copy, a recent photo and a CV stating the trade and experience.", "صورة جواز ساري وصورة حديثة وسيرة تبيّن المهنة والخبرة."),
    ("Trade verification", "الفحص المهني", "The result of the trade verification described in the Agreement.", "نتيجة الفحص المهني الوارد في العقد."),
    ("Medical, police clearance and attestation", "الفحص الطبي والسجل الجنائي والتصديق", "As the embassy and the competent authorities require for each nationality.", "بحسب ما تشترطه السفارة والجهات المختصة لكل جنسية."),
    ("C. Recruitment and duration guide", "ج. دليل الاستقدام والمدد", "", ""),
]
for i, (se, sa, we, wa, d) in enumerate(STAGES, 1):
    ROWS.append(("Stage %d — %s (duration: %s days)" % (i, se, d), "المرحلة %d — %s (المدة: %s يوماً)" % (i, sa, d), we, wa))
ROWS += [
    ("How the durations are fixed", "كيف تُحدَّد المدد",
     "Each stage’s duration is confirmed in writing before dispatch, from the licensed recruitment parties, the embassies and the competent authorities. We do not guarantee a visa approval or an arrival date.",
     "تُثبَّت مدة كل مرحلة كتابةً قبل الإرسال من جهات الاستقدام المرخصة والسفارات والجهات المختصة. ولا نضمن قبول تأشيرة ولا موعد وصول."),
    ("Nationalities", "الجنسيات", "Filipino, Indian and Nepali only.", "الفلبينية والهندية والنيبالية فقط."),
    ("Guarantee and replacement", "الضمان والاستبدال", "As set in the Workforce Supply Agreement.", "وفق ما يحدده عقد توفير العمالة."),
]

def spec(rows, t_en, t_ar, k_en, k_ar, s_en, s_ar, numbered=True):
    return (rows, t_en, t_ar, k_en, k_ar, s_en, s_ar, numbered)

INFO = {
    "04-Required-Documents": spec([list(r) if False else r for r in ROWS], "Required Documents and Recruitment Guide", "المستندات المطلوبة ودليل الاستقدام والمدد", "CHECKLIST", "قائمة",
        "The documents we need, and how recruitment and its durations work.", "المستندات التي نحتاجها، وكيف يسير الاستقدام ومدده.", False),
}
