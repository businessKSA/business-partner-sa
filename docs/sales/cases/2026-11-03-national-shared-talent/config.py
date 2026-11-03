# -*- coding: utf-8 -*-
"""الكوادر الوطنية المشتركة (CL-0015): خطاب التفويض وفق الهيكل (أ) الأقرب عند القانونية — العميل صاحب العمل مباشرة بعقد جزئي مسجّل وBusiness Partner تدير وتفوتر.
مشروط بردّ القانونية النهائي؛ لا يُصدَّر قبله. العرض والعقد والـNDA قائمة في services/national-shared-talent-out."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "2026-11-03-eor-shared", "engine"))
from eor_common import make

C = make(
    client_en="[●] — Shared National Talent client", client_ar="[●] — عميل الكوادر الوطنية المشتركة",
    roles=[dict(en="Saudi staff — part-time or flexible", ar="موظفون سعوديون — دوام جزئي أو مرن", nat_en="Saudi", nat_ar="سعودي", count=1)],
    source="inside", housing="client",
    site_en="[●]", site_ar="[●]", start_en="[●]", start_ar="[●]",
    term_en="[●] months", term_ar="[●] شهراً", med_en="[●]", med_ar="[●]",
)
C["docs"] = ["authz"]
C["ref_en"], C["ref_ar"] = "Shared National Talent", "الكوادر الوطنية المشتركة"
C["authz"] = dict(
    services_en="shared national talent — part-time and flexible Saudi staff", services_ar="الكوادر الوطنية المشتركة — موظفون سعوديون بدوام جزئي أو مرن",
    deleg=[
        ("Employment-contract documentation", "توثيق عقود العمل", "Qiwa and the Ministry of Human Resources and Social Development", "قوى ووزارة الموارد البشرية والتنمية الاجتماعية",
         "Preparing, submitting and following up the documentation of the part-time or flexible employment contracts of the Saudi staff placed with the Client, on the Client’s establishment.",
         "إعداد توثيق عقود العمل الجزئية أو المرنة للموظفين السعوديين المسنَدين للعميل وتقديمها ومتابعتها، على منشأة العميل."),
        ("Social-insurance registration", "التسجيل في التأمينات الاجتماعية", "GOSI", "التأمينات الاجتماعية",
         "Registering the Saudi staff and updating their wage records on the Client’s establishment.", "تسجيل الموظفين السعوديين وتحديث أجورهم على منشأة العميل."),
        ("Flexible-work contracts", "عقود العمل المرن", "The flexible-work platform (Murn)", "منصة العمل المرن (مرن)",
         "Preparing and following up flexible-work contracts for the staff for whom the Client chooses that form.", "إعداد عقود العمل المرن ومتابعتها للموظفين الذين يختار العميل هذه الصيغة لهم."),
        ("Paying official fees on the Client’s behalf", "دفع الرسوم الرسمية نيابةً عن العميل", "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
         "Only from funds the Client has deposited for that purpose, against the entity’s receipt; the unused balance is returned.", "من مبالغ أودعها العميل لهذا الغرض فقط وبإيصال الجهة، ويُرد الرصيد غير المستعمل."),
        ("Receiving notifications and official correspondence", "استلام الإشعارات والمراسلات الرسمية", "The entities named in the items above", "الجهات المسماة في البنود أعلاه",
         "Receiving notifications and official documents relating to the authorised transactions only, and notifying the Client within [2] business days.", "استلام الإشعارات والمستندات الرسمية المتعلقة بالمعاملات المفوَّض بها وحدها، وإبلاغ العميل خلال [2] يوم عمل."),
        ("Viewing the Client’s accounts on the platforms", "الاطلاع على حسابات العميل في المنصات", "The platforms of the entities named above", "منصات الجهات المسماة أعلاه",
         "View-only access through the platforms’ official delegation features, never through passwords or verification codes, limited to the authorised transactions.", "اطلاع فقط عبر خصائص التفويض الرسمية في المنصات، لا بكلمات المرور ولا رموز التحقق، ومحصور في المعاملات المفوَّض بها."),
        ("Transferring the Saudi staff’s and the Client’s data", "نقل بيانات الموظفين السعوديين والعميل", "The entities, and the First Party’s service providers", "الجهات، ومزودو خدمات الطرف الأول",
         "Transferring documents and data only as needed to perform the authorised services, under the data protection clause. Inside the Kingdom only.", "نقل المستندات والبيانات بقدر ما يلزم لتنفيذ الخدمات المفوَّض بها فقط، وفق بند حماية البيانات. داخل المملكة فقط."),
    ])
