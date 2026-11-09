# -*- coding: utf-8 -*-
"""EIC Workspaces → Edge Innovation Center: قرار المالك + وكالة خاصة بتغيير الاسم وتعديل العقد + قائمة توافق وزارة التجارة.
الاستعمال: python3 build.py <outdir>   (ثم render.cjs للـPDF وhtml2docx.py للـDOCX)"""
import os, sys, html
OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)

OLD_EN, OLD_AR = "EIC Workspaces", "إي.آي.سي ووركسبايسز"
NEW_EN = "Edge Innovation Center"
NEW_AR = "[●] (الكتابة العربية للاسم الجديد تؤكَّدها العميلة قبل الحجز)"
UNN = "7050483374"; MISA = "24925229628"
RAYA_EN = "Raya for Building Construction and Management Company"
RAYA_AR = "شركة راية لإنشاء وإدارة المباني"
RAYA_CR = "29592"

CSS = """
@page{size:A4;margin:16mm 14mm}
body{font-family:'Noto Naskh Arabic','Noto Sans Arabic',Arial,sans-serif;font-size:11.5px;line-height:1.7;color:#111}
h1{font-size:19px;text-align:center;margin:0 0 2px;color:#0B1B5A} .sub{text-align:center;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:6px}
td{border:1px solid #cfd4e3;padding:5px 8px;vertical-align:top;width:50%}
td.en{direction:ltr;text-align:left} td.ar{direction:rtl;text-align:right}
tr.sec td{background:#EEF1FA;font-weight:700}
.note{background:#FFF4E0;border:1px solid #e6c785;padding:6px 10px;margin:8px 0;font-size:11px}
"""
def e(s): return html.escape(s)
def row(en, ar, sec=False):
    return f'<tr class="{"sec" if sec else ""}"><td class="en">{en}</td><td class="ar">{ar}</td></tr>'
def page(title_en, title_ar, rows, note=None):
    CL = os.environ.get('CLIENT')
    n = '<div class="note">الخانات [●] وخطوط الإكمال تُعبَّأ من راية قبل التوقيع والتصديق. / Fields marked [●] and blank lines are completed by Raya before signature and attestation.</div>' if CL else (f'<div class="note">{note}</div>' if note else "")
    return f'<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>{e(title_en)}</title><style>{CSS}</style></head><body><h1>{title_ar} — {title_en}</h1><div class="sub">{OLD_AR} ← {NEW_EN}</div>{n}<table>{"".join(rows)}</table></body></html>'

# ---------- 01 قرار المالك ----------
SIG_EN = f"The Sole Shareholder: {RAYA_EN}<br>Representative: [●] — Capacity: [●]<br>Signature: ________ Date: ________"
SIG_AR = f"المالكة (الشريك الوحيد): {RAYA_AR}<br>ممثلها: [●] — الصفة: [●]<br>التوقيع: ________ التاريخ: ________"
res = [
 row("On [●] corresponding to [●], the undersigned:", "إنه في يوم [●] الموافق [●]، فإن الموقِّعة أدناه:"),
 row(f"{RAYA_EN}, an Egyptian company, Commercial Register No. {RAYA_CR}, head office [●], represented by [●] in the capacity of [●] pursuant to [●] (the “Owner”),",
     f"{RAYA_AR}، شركة مصرية بسجل تجاري رقم {RAYA_CR}، ومقرها [●]، ويمثلها [●] بصفته [●] بموجب [●] («المالكة»)،"),
 row(f"being the sole owner of the entire share capital of {OLD_EN}, a one-person limited liability company registered in the Kingdom of Saudi Arabia under Unified National Number {UNN} (the “Company”), and exercising the powers of the general assembly of partners under the Companies Law and the Company’s Articles of Association, hereby resolves as follows:",
     f"وهي المالكة لكامل رأس مال «{OLD_AR}»، شركة ذات مسؤولية محدودة (شخص واحد) مسجلة في المملكة العربية السعودية بالرقم الوطني الموحد {UNN} («الشركة»)، وتمارس صلاحيات جمعية الشركاء وفق نظام الشركات ونظام الشركة الأساس، قد قررت ما يأتي:"),
 row("First: Change of the trade name", "أولاً: تغيير الاسم التجاري", True),
 row(f"1) To change the Company’s name from “{OLD_EN}” (“{OLD_AR}”) to “{NEW_EN}”, with the Arabic form of the name as reserved on the Saudi Business Center platform, followed by the legal-form wording exactly as registered (“limited liability company of one person”).",
     f"1) تغيير اسم الشركة من «{OLD_AR}» ({OLD_EN}) إلى «{NEW_EN}»، بالصيغة العربية المحجوزة على منصة المركز السعودي للأعمال، يتبعها بيان شكل الشركة كما هو مسجَّل: «(شركة ذات المسؤولية المحدودة من شخص واحد)»."),
 row("2) The name change does not affect any of the Company’s rights, obligations, contracts, licences or registrations, all of which continue under the new name. The Company remains identified by its Unified National Number "+UNN+".",
     "2) لا يمس تغيير الاسم حقوق الشركة ولا التزاماتها ولا عقودها ولا تراخيصها ولا تسجيلاتها، وتستمر كلها باسمها الجديد. وتبقى الشركة معرَّفة برقمها الوطني الموحد "+UNN+"."),
 row("Second: Amendment of the Articles of Association", "ثانياً: تعديل نظام الشركة الأساس (عقد التأسيس)", True),
 row("3) To amend the “Company Name” article of the Articles of Association so that it reads: “[Arabic name] (a limited liability company of one person)” (currently: “E.I.C Workspaces (a limited liability company of one person)”). No other article is amended, and the other articles remain in force as they are.",
     "3) تعديل مادة «اسم الشركة» في نظام الشركة الأساس لتصبح: «شركة [الاسم العربي] (شركة ذات المسؤولية المحدودة من شخص واحد)» (نصها الحالي: «شركة "+OLD_AR+" (شركة ذات المسؤولية المحدودة من شخص واحد)»). ولا تُعدَّل أي مادة أخرى، وتبقى بقية المواد سارية كما هي."),
 row("4) To approve the amended Articles of Association (consolidated text) and to authorise its signature and authentication before the Ministry of Commerce and any competent authority.",
     "4) اعتماد نظام الشركة الأساس المعدَّل (النص المحدَّث) والتفويض بالتوقيع عليه وتوثيقه أمام وزارة التجارة وأي جهة مختصة."),
 row("Third: Implementation", "ثالثاً: التنفيذ", True),
 row("5) To authorise Mr. Baher Bakr Ali Magnas, Saudi national, National ID No. 1095794861 (the “Agent”), under the special power of attorney issued by the Owner for this purpose, to reserve the new name, amend the Commercial Register and the Articles of Association, sign the sole-shareholder decisions and the amended Articles on behalf of the Owner and the Company, and update the Company’s name with all government entities and platforms, and to pay the related fees.",
     "5) تفويض الأستاذ/ باهر بن بكر بن علي مقنص، سعودي الجنسية، الهوية الوطنية رقم 1095794861 («الوكيل») بموجب الوكالة الخاصة الصادرة عن المالكة لهذا الغرض بحجز الاسم الجديد وتعديل السجل التجاري ونظام الشركة الأساس وتوقيع قرارات الشريك الوحيد والنظام المعدَّل باسم المالكة والشركة، وتحديث اسم الشركة لدى جميع الجهات والمنصات الحكومية، وسداد الرسوم المتعلقة بذلك."),
 row("6) Under Article 6 of the Articles, the owner’s decisions are issued in writing and recorded in the Company’s special register; this resolution shall be so recorded. Resolution No.: [●].","6) وفق المادة السادسة من نظام الشركة الأساس تصدر قرارات المالك كتابةً وتُدوَّن في سجل خاص لدى الشركة، ويُدوَّن هذا القرار فيه. رقم القرار: [●]."),
 row("7) This resolution takes effect from the date of its attestation and is drawn up in Arabic and English; in case of discrepancy the Arabic text prevails.",
     "7) يسري هذا القرار من تاريخ تصديقه، وحُرر بالعربية والإنجليزية، وعند الاختلاف يُعتدّ بالنص العربي."),
 row(SIG_EN, SIG_AR),
 row("(Attestation: Egyptian notarisation, then the Egyptian Ministry of Foreign Affairs, then the Saudi Embassy/Consulate — left to the attesting authorities.)",
     "(التصديق: التوثيق في مصر، ثم وزارة الخارجية المصرية، ثم السفارة/القنصلية السعودية — يُترك لجهات التصديق.)"),
]
open(f"{OUT}/01-Owner-Resolution.html","w",encoding="utf-8").write(page("Sole Owner Resolution","قرار المالكة (الشريك الوحيد)",res,
 "مسودة: الخانات [●] تُكمَّل من راية. الصيغة العربية للاسم الجديد وصيغة مادة الاسم الحالية في النظام الأساس تُطابَقان على النسخة المسجلة قبل التوقيع."))

# ---------- 02 الوكالة الخاصة ----------
poa = [
 row("On [●] corresponding to [●], I, the undersigned:", "إنه في يوم [●] الموافق [●]، أنا الموقِّعة أدناه:"),
 row(f"{RAYA_EN}, an Egyptian company, Commercial Register No. {RAYA_CR}, head office [●], represented by [●] in the capacity of [●] pursuant to [●] (the “Principal”), the sole owner of {OLD_EN}, a one-person limited liability company, Unified National Number {UNN}, Ministry of Investment licence No. {MISA} (the “Company”), under whatever name it holds now or after the change,",
     f"{RAYA_AR}، شركة مصرية بسجل تجاري رقم {RAYA_CR}، ومقرها [●]، ويمثلها [●] بصفته [●] بموجب [●] («الموكِّلة»)، وهي المالكة الوحيدة لـ«{OLD_AR}»، شركة ذات مسؤولية محدودة (شخص واحد) بالرقم الوطني الموحد {UNN}، وترخيص وزارة الاستثمار رقم {MISA} («الشركة»)، أياً كان اسمها الآن أو بعد التغيير،"),
 row("have appointed Mr. Baher Bakr Ali Magnas, Saudi national, holder of National ID No. 1095794861 (the “Agent”), as special attorney, acting alone, in the following matters only:",
     "وكّلت الأستاذ/ باهر بن بكر بن علي مقنص، سعودي الجنسية، يحمل الهوية الوطنية رقم 1095794861 («الوكيل»)، وكالة خاصة، يباشرها منفرداً، في الأمور الآتية دون غيرها:"),
 row("First: Trade name", "أولاً: الاسم التجاري", True),
 row(f"1) To change the Company’s trade name from “{OLD_EN}” to “{NEW_EN}” (or any Arabic/transliterated form the Ministry of Commerce approves for it): checking availability, reserving the name, extending or renewing the reservation, choosing an alternative name if the first is not accepted, and registering the name in the Commercial Register.",
     f"1) تغيير الاسم التجاري للشركة من «{OLD_AR}» إلى «{NEW_EN}» (أو أي صيغة عربية أو معرَّبة تعتمدها وزارة التجارة له): فحص توافر الاسم وحجزه وتمديد الحجز أو تجديده، واختيار اسم بديل إن لم يُقبل الأول، وقيد الاسم في السجل التجاري."),
 row("Second: Constitutive contract / Articles of Association", "ثانياً: عقد التأسيس / النظام الأساس", True),
 row("2) To amend the Articles of Association solely to reflect the new name (the “Company Name” article and any article or clause that mentions the name), and to draft, sign, authenticate and file the amendment and the consolidated Articles before the Ministry of Commerce and the Saudi Business Center.",
     "2) تعديل نظام الشركة الأساس بما يعكس الاسم الجديد وحده (مادة «اسم الشركة» وأي مادة أو بند يرد فيه الاسم)، وصياغة التعديل والنظام المحدَّث والتوقيع عليهما وتوثيقهما وتقديمهما إلى وزارة التجارة والمركز السعودي للأعمال."),
 row("3) To sign, on behalf of the Principal as sole owner, the sole-owner decision approving the name change and the amended Articles, in the form required by the competent authority.",
     "3) توقيع قرار المالك الوحيد باسم الموكِّلة بالموافقة على تغيير الاسم والنظام المعدَّل، بالصيغة التي تشترطها الجهة المختصة."),
 row("Third: Records and platforms", "ثالثاً: السجلات والمنصات", True),
 row("4) To amend the Commercial Register (name only), obtain the updated register and data certificate, and update the Company’s name with: the Chamber of Commerce, the Ministry of Investment (licence/registration data), ZATCA, GOSI, Qiwa and the Ministry of Human Resources, Muqeem, Balady, the National Address, and other government platforms of the Company; and to use the electronic authorisations of those platforms for that purpose.",
     "4) تعديل السجل التجاري (الاسم فقط)، واستخراج السجل المحدَّث وشهادة البيانات، وتحديث اسم الشركة لدى: الغرفة التجارية، ووزارة الاستثمار (بيانات الترخيص/التسجيل)، وهيئة الزكاة والضريبة والجمارك، والتأمينات الاجتماعية، وقوى ووزارة الموارد البشرية، ومقيم، وبلدي، والعنوان الوطني، وسائر المنصات الحكومية للشركة، واستعمال التفويضات الإلكترونية في تلك المنصات لهذا الغرض."),
 row("5) To update the Company’s records at banks after the name change (submitting updated documents and know-your-customer forms), without opening accounts or disposing of any funds.",
     "5) تحديث بيانات الشركة لدى البنوك بعد تغيير الاسم (تقديم المستندات المحدَّثة ونماذج التعريف بالعميل)، دون فتح حسابات أو التصرف في أي أموال."),
 row("Fourth: General provisions", "رابعاً: أحكام عامة", True),
 row("6) The Agent may submit and sign applications and declarations, pay government fees through official channels, receive and deliver documents, file administrative objections or grievances before the same authority, and follow up until completion.",
     "6) للوكيل تقديم الطلبات والإقرارات وتوقيعها، وسداد الرسوم الحكومية بقنوات الدفع الرسمية، واستلام المستندات وتسليمها، وتقديم الاعتراض أو التظلم الإداري لدى الجهة نفسها، ومتابعة الإجراءات حتى إنهائها."),
 row("7) The Agent may delegate others in all or part of this power of attorney and may revoke any delegation.",
     "7) للوكيل أن يوكّل غيره في هذه الوكالة كلها أو بعضها، وأن يعزل من وكّله."),
 row("8) This power of attorney expressly excludes: judicial matters of any kind; trademark and intellectual-property filings; changing the Company’s activities, capital, shareholding, management or legal form; selling, transferring or pledging shares; liquidating the Company; and opening or operating bank accounts or disposing of funds.",
     "8) تستثنى من هذه الوكالة صراحةً: الأمور القضائية بأنواعها؛ وطلبات العلامات التجارية والملكية الفكرية؛ وتغيير أنشطة الشركة أو رأس مالها أو ملكيتها أو إدارتها أو شكلها القانوني؛ وبيع الحصص أو نقلها أو رهنها؛ وتصفية الشركة؛ وفتح الحسابات البنكية أو تشغيلها أو التصرف في الأموال."),
 row(f"9) The Company is identified by its Unified National Number {UNN}, so this power of attorney remains valid under the old name, the new name, or both. For identification only, the current name is {OLD_EN}.",
     f"9) المعتبر في تحديد الشركة رقمها الوطني الموحد {UNN}، فتبقى هذه الوكالة سارية باسمها القديم أو الجديد أو بهما معاً. ويُذكر للتعريف فقط: الاسم الحالي «{OLD_AR}»."),
 row("10) Narrow construction: this power of attorney is not a general management authority and is read narrowly, for completing the trade name change only. Government fees are paid from funds provided by the Principal or the Company.","10) تفسير ضيق: ليست هذه الوكالة تفويضاً عاماً بإدارة الشركة، وتُفسَّر تفسيراً ضيقاً لإتمام تغيير الاسم التجاري فقط. وتُسدَّد الرسوم الحكومية من أموال توفرها الموكِّلة أو الشركة."),
 row("11) Term: one (1) year from the date of attestation, or completion of the name change, whichever is earlier, unless cancelled earlier by formal notarised notice. Drawn up in Arabic and English; in case of discrepancy the Arabic text prevails.",
     "11) المدة: سنة (1) من تاريخ التصديق أو حتى إتمام تغيير الاسم أيهما أسبق، ما لم تُلغَ قبل ذلك بإشعار رسمي موثّق. حُررت بالعربية والإنجليزية، وعند الاختلاف يُعتدّ بالنص العربي."),
 row(SIG_EN.replace("The Sole Shareholder","The Principal"), SIG_AR.replace("المالكة (الشريك الوحيد)","الموكِّلة")),
 row("(Attestation: Egyptian notarisation, then the Egyptian Ministry of Foreign Affairs, then the Saudi Embassy/Consulate.)",
     "(التصديق: التوثيق في مصر، ثم وزارة الخارجية المصرية، ثم السفارة/القنصلية السعودية.)"),
]
open(f"{OUT}/02-Power-of-Attorney-Trade-Name.html","w",encoding="utf-8").write(page("Special Power of Attorney — Trade Name & Articles","وكالة خاصة — تغيير الاسم التجاري وتعديل العقد",poa,
 "مسودة مخصّصة بدل الوكالات الثلاث العامة: لا إدارة ولا مفوضون ولا علامات تجارية ولا أمور بنكية غير تحديث البيانات. الخانات [●] من راية."))

# ---------- 03 توافق وزارة التجارة وخطوات التصديق ----------
chk = [
 row("Item","البند",True),
 row("Sole-owner decision (not “partners’ resolution”): the Company is one-person, so the decision is issued in writing by the owner; the Articles already say so.",
     "القرار قرار «المالك الوحيد» لا «قرار شركاء»: الشركة شخص واحد، فيصدر مكتوباً من المالكة، ونظام الشركة يقرر ذلك أصلاً."),
 row("Name must carry the legal-form wording (limited liability — one person) per Ministry of Commerce rules; the Arabic spelling is reserved on the Saudi Business Center before signing.",
     "الاسم يقترن ببيان شكل الشركة (ذات مسؤولية محدودة — شخص واحد) وفق ضوابط الوزارة، وتُحجز الصيغة العربية على المركز السعودي للأعمال قبل التوقيع."),
 row("The name must not match or resemble a reserved/registered name, must not be misleading or on the Ministry’s prohibited list; latin-letter names are subject to the by-law’s language rules.",
     "ألا يطابق الاسم أو يشابه اسماً محجوزاً أو مقيداً، وألا يضلل أو يرد في قائمة الأسماء المحظورة؛ والأسماء بحروف لاتينية تخضع لأحكام اللغة في اللائحة."),
 row("Only the name clause is amended; amendments follow the procedure for amending the Articles, and the name change does not affect the Company’s rights or obligations.",
     "يُعدَّل بند الاسم وحده، وبإجراءات تعديل نظام الشركة الأساس، ولا يمس التغيير حقوق الشركة والتزاماتها."),
 row("Facts from the registered Articles (request no. 720736) and CR (issued 26/06/2025): owner Raya, 100% of 1,000 shares, capital SAR 100,000; Article 1 is the name; Article 6 records owner decisions in a special register; the first manager (an Egyptian national) was appointed by a separate sole-owner decision and holds, per Article 5, powers that include amending the company name and reserving trade names, each exercisable alone and delegable.",
 "وقائع من نظام الأساس المسجَّل (رقم الطلب 720736) وشهادة السجل (26/06/2025): المالكة راية بملكية 100% من 1,000 حصة ورأس مال 100,000 ريال؛ المادة الأولى هي الاسم؛ المادة السادسة تُدوّن قرارات المالك في سجل خاص؛ والمدير الأول (مصري الجنسية) عُيّن بقرار مالك مستقل، وتشمل صلاحياته في المادة الخامسة تعديل اسم الشركة وحجز الأسماء التجارية، يمارسها منفرداً ويحق له التوكيل فيها."),
 row("Option to confirm: because the manager may delegate the name-change powers, the agent’s authority could come from the manager locally, shortening the Egyptian attestation chain. The sole-owner resolution amending the Articles still comes from Raya. Confirm on the Saudi Business Center which route the platform accepts.",
 "خيار يُؤكَّد: لأن للمدير حق التوكيل في صلاحيات تغيير الاسم، قد تصدر وكالة الوكيل منه محلياً فيقصر مسار التصديق المصري، بينما يبقى قرار المالكة لتعديل النظام الأساس من راية. يُؤكَّد على المركز السعودي للأعمال أي المسارين تقبله المنصة."),
 row("Foreign-issued documents (resolution, power of attorney, Raya’s documents): Egyptian notarisation → Egyptian Ministry of Foreign Affairs → Saudi Embassy/Consulate in Egypt. Raya’s signatory authority is proved by its commercial register and a board resolution, attested the same way.",
     "المستندات الصادرة في مصر (القرار، الوكالة، مستندات راية): التوثيق المصري ← وزارة الخارجية المصرية ← السفارة/القنصلية السعودية في مصر. وتُثبت صلاحية الموقِّع بالسجل التجاري وقرار مجلس الإدارة مصدَّقين بالتسلسل نفسه."),
 row("Since the Company holds a Ministry of Investment licence, the new name must also be updated there; confirm whether the platform requires a separate application.",
     "الشركة بترخيص وزارة الاستثمار، فيُحدَّث الاسم لديها أيضاً، ويُؤكَّد هل تطلب المنصة طلباً مستقلاً."),
 row("To be confirmed on the Saudi Business Center before filing (official ministry pages were unreachable when this review was prepared): exact fees, whether the amended Articles may be signed by the Agent electronically under this power of attorney or needs the owner’s attested signature, Arabic form of a latin name, and any translation of Egyptian documents.",
     "يُؤكَّد على المركز السعودي للأعمال قبل التقديم (صفحات الوزارة الرسمية لم تكن متاحة وقت إعداد هذه المراجعة): الرسوم الفعلية، وهل يوقّع الوكيل النظام المعدَّل إلكترونياً بموجب هذه الوكالة أم يلزم توقيع المالكة المصدَّق، والصيغة العربية للاسم اللاتيني، وأي ترجمة معتمدة لمستندات مصرية."),
]
open(f"{OUT}/03-MoC-Compliance-Checklist.html","w",encoding="utf-8").write(page("Ministry of Commerce Compliance Checklist","قائمة توافق وزارة التجارة وخطوات التصديق",chk))
print("ok", OUT)
