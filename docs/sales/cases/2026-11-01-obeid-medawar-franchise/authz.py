# -*- coding: utf-8 -*-
"""خطاب التفويض لمكتب عبيد وميدور — نص القانونية (authorization-letter-template-DRAFT.md) + قائمة تفويض بخانات اختيار (§3.3).
غير المحدَّد غير مفوَّض. لا وكالة: الوكالة (إن لزمت) مستند مستقل خارج حزمتنا."""
import os, re
from content import *

AUTH_MD = os.path.join(ROOT, "docs/sales/templates/categories/authorization-letter-template-DRAFT.md")
T_EN, T_AR = "Authorization Letter", "خطاب تفويض"

def legal():
    out, in_p1, cur = {}, False, None
    for line in open(AUTH_MD, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## الجزء الأول"): in_p1 = True; continue
        if line.startswith("## الجزء الثاني"): break
        if not in_p1: continue
        if line.startswith("### "):
            cur = line[4:].strip(); out[cur] = {}
        elif cur and line.startswith("- EN: "): out[cur]["en"] = line[6:].strip()
        elif cur and line.startswith("- AR: "): out[cur]["ar"] = line[6:].strip()
    return out

def get(d, num):
    for k, v in d.items():
        if k.startswith("%d. " % num) and "en" in v:
            a, b = [x.strip() for x in k.split(" / ", 1)]
            return re.sub(r"^\d+\.\s*", "", a), re.sub(r"^\d+\.\s*", "", b), v["en"], v["ar"]
    raise KeyError(num)

BOX = "☐"
DELEG = [  # (title_en, title_ar, entity_en, entity_ar, scope_en, scope_ar)
    ("Filing and following up with the Ministry of Commerce", "التقديم والمتابعة لدى وزارة التجارة",
     "Ministry of Commerce (franchise registration)", "وزارة التجارة (قيد الامتياز)",
     "Preparing, submitting and following up the franchise registration file for the four franchise agreements. Signing the franchise agreements or any corporate decision on the Client’s behalf is excluded.",
     "إعداد ملف قيد الامتياز لاتفاقيات الامتياز الأربع وتقديمه ومتابعته. ويُستثنى توقيع اتفاقيات الامتياز أو أي قرار للشركة باسم العميل."),
    ("Appointing and instructing the Saudi legal counsel and the certified translation office", "تعيين المحامي السعودي ومكتب الترجمة المعتمد وتوجيههما",
     "The Saudi legal counsel and the certified translation provider approved by the Client", "المحامي السعودي ومزوّد الترجمة المعتمدة اللذان يوافق عليهما العميل",
     "Engaging them for the approved scope and amounts only, and coordinating their work. No external cost beyond the approved amounts without the Client’s prior written approval.",
     "التعاقد معهما لنطاق ومبالغ معتمدة فقط وتنسيق عملهما. ولا تكلفة خارجية تتجاوز المبالغ المعتمدة دون موافقة العميل الكتابية المسبقة."),
    ("Paying official fees on the Client’s behalf", "دفع الرسوم الرسمية نيابةً عن العميل",
     "The Ministry of Commerce and the other entities involved", "وزارة التجارة والجهات الأخرى ذات الصلة",
     "Only from funds the Client has deposited for that purpose, against the entity’s receipt; the unused balance is returned. Payment is executed by a human officer of the First Party, approved by Baher Bakr Ali Magnas, never by an artificial-intelligence system.",
     "من مبالغ أودعها العميل لهذا الغرض فقط وبإيصال الجهة، ويُرد الرصيد غير المستعمل. ويُنفَّذ الدفع موظف بشري لدى الطرف الأول بتعميد باهر بكر علي مقنص، ولا ينفّذه نظام ذكاء اصطناعي."),
    ("Receiving notifications and official correspondence", "استلام الإشعارات والمراسلات الرسمية",
     "The Ministry of Commerce and the other entities involved", "وزارة التجارة والجهات الأخرى ذات الصلة",
     "Receiving notifications and official documents relating to the authorised transactions only, and notifying the Client within 5 business days.",
     "استلام الإشعارات والمستندات الرسمية المتعلقة بالمعاملات المفوَّض بها وحدها، وإبلاغ العميل خلال 5 أيام عمل."),
    ("Viewing the Client’s accounts on the platforms", "الاطلاع على حسابات العميل في المنصات",
     "The Ministry of Commerce platform", "منصة وزارة التجارة",
     "View-only access through the platforms’ official delegation features, never through passwords or verification codes, limited to the authorised transactions.",
     "اطلاع فقط عبر خصائص التفويض الرسمية في المنصات، لا بكلمات المرور ولا رموز التحقق، ومحصور في المعاملات المفوَّض بها."),
    ("Receiving and sharing the franchise documents and data", "استلام مستندات الامتياز وبياناته ومشاركتها",
     "The Saudi legal counsel, the translation provider, the Ministry, and the First Party’s service providers (hosting and artificial intelligence)", "المحامي السعودي ومزوّد الترجمة والوزارة، ومزودو خدمات الطرف الأول (الاستضافة والذكاء الاصطناعي)",
     "Using and sharing the Client’s documents and data only as needed to perform the authorised services, under the data protection clause. Transfer outside the Kingdom: %s Authorised  %s Not authorised." % (BOX, BOX),
     "استعمال مستندات العميل وبياناته ومشاركتها بقدر ما يلزم لتنفيذ الخدمات المفوَّض بها فقط، وفق بند حماية البيانات. النقل خارج المملكة: %s مفوَّض  %s غير مفوَّض." % (BOX, BOX)),
]

def rows():
    d = legal()
    R = []
    def add(t_en, t_ar, b_en, b_ar): R.append([t_en, t_ar, b_en, b_ar])
    add("2. Services covered", "2. الخدمات المشمولة",
        "Only the services of accepted quotation (reference to be completed after agreement) (service BP-PL-0019, KSA Franchise Law compliance & registration) that the Second Party ticks in section 3. Anything not ticked is not authorised.",
        "خدمات عرض السعر المقبول (يُستكمل رقمه بعد الاتفاق) (الخدمة BP-PL-0019، الامتثال والقيد بنظام الامتياز التجاري) التي يحدّدها الطرف الثاني بعلامة في البند 3 وحدها. وغير المحدّد غير مفوَّض.")
    add("3. Delegation list — the Second Party ticks what it authorises", "3. قائمة التفويض — يحدّد الطرف الثاني ما يفوّض به",
        "Tick %s each delegation the Second Party authorises. For each item: the entity, the scope, the term stated in section 9, and the right to stop it immediately by written notice." % BOX,
        "يضع الطرف الثاني علامة %s أمام كل تفويض يمنحه. ولكل بند: الجهة والنطاق والمدة المذكورة في البند 9 وحقه في إيقافه فوراً بإشعار كتابي." % BOX)
    for i, (te, ta, ee, ea, se, sa) in enumerate(DELEG, 1):
        add("3.%d  %s  %s Authorised" % (i, te, BOX), "3.%d  %s  %s مفوَّض" % (i, ta, BOX),
            "<b>Entity:</b> %s<br><b>Scope:</b> %s<br><b>Stop:</b> immediately by written notice." % (ee, se),
            "<b>الجهة:</b> %s<br><b>النطاق:</b> %s<br><b>الإيقاف:</b> فوراً بإشعار كتابي." % (ea, sa))
    for num, label in ((3, "4"), (4, "5"), (5, "6"), (6, "7"), (7, "8"), (8, "9"), (9, "10"), (10, "11"), (11, "12"), (12, "13")):
        t_en, t_ar, b_en, b_ar = get(d, num)
        if num == 3:
            b_en = b_en.replace("Within the covered services only, the Authorised Party may:", "Within the services the Second Party has ticked in section 3 only, the First Party may:")
            b_ar = b_ar.replace("ضمن الخدمات المشمولة وحدها، للمفوَّض:", "ضمن البنود التي حدّدها الطرف الثاني في البند 3 وحدها، للطرف الأول:")
        if num == 7:
            b_en = "The First Party acts only through its named staff: Baher Bakr Ali Magnas, Chief Executive Officer; other named staff: to be completed after agreement (identification details are kept in the executed copy)."
            b_ar = "يعمل الطرف الأول عبر موظفيه المسمّين وحدهم: باهر بكر علي مقنص، المدير التنفيذي؛ وموظفون آخرون مسمّون: يُستكمل بعد الاتفاق (وبيانات الهوية في النسخة الموقّعة)."
        b_en = b_en.replace("the Category Annex", "section 3").replace("The Authorised Party", "The First Party").replace("the Authorised Party", "the First Party").replace("The Principal", "The Second Party").replace("the Principal", "the Second Party").replace("Principal’s", "Second Party’s")
        b_ar = b_ar.replace("ملحق الفئة", "البند 3").replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        b_en = b_en.replace("starts on [●] and ends", "starts on the day the service agreement is signed and ends").replace("or [●] months [recommended maximum 12]", "or 12 months after that date, whichever is earliest").replace("[2] business days", "5 business days")
        b_ar = b_ar.replace("يبدأ هذا الخطاب في [●] وينتهي", "يبدأ هذا الخطاب يوم توقيع عقد الخدمة وينتهي").replace("أو بعد [●] شهراً [الحد الأقصى المقترح 12]", "أو بعد 12 شهراً من ذلك التاريخ")
        t_en = t_en.replace("Principal’s", "Second Party’s").replace("Authorised Party’s", "First Party’s")
        t_ar = t_ar.replace("المفوَّض", "الطرف الأول").replace("المفوِّض", "الطرف الثاني")
        add("%s. %s" % (label, t_en), "%s. %s" % (label, t_ar), b_en, b_ar)
    return R

INFO_COVER = ("AUTHORIZATION", "تفويض", T_EN, T_AR,
              "The Second Party chooses, from a list, what it authorises the First Party to do.",
              "يختار الطرف الثاني من قائمة ما يفوّض به الطرف الأول.")
