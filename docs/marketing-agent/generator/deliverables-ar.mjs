// Arabic wording for the catalogue's deliverables.
// The catalogue stores most deliverables in English; Arabic marketing copy must not
// mix the two. This covers every English deliverable currently in services.json —
// anything unmapped falls through unchanged, so a new English entry is visible
// rather than silently dropped.
export const DELIVERABLES_AR = {
  "Commercial Registration (CR)": "السجل التجاري",
  "CR": "السجل التجاري",
  "factory Commercial Registration": "السجل التجاري للمصنع",
  "CR struck off": "شطب السجل التجاري",
  "Chamber of Commerce membership": "عضوية الغرفة التجارية",
  "Chamber membership": "عضوية الغرفة التجارية",
  "Chamber of Commerce membership for the wholly-owned entity": "عضوية الغرفة التجارية للكيان المملوك بالكامل",
  "Chamber of Commerce membership for the joint venture": "عضوية الغرفة التجارية للمشروع المشترك",
  "Articles of Association": "عقد التأسيس",
  "drafted & notarized Articles of Association": "صياغة وتوثيق عقد التأسيس",
  "Drafted & notarized incorporation contract (Articles of Association)": "صياغة وتوثيق عقد التأسيس",
  "Reserved trade name": "حجز الاسم التجاري",
  "MISA license": "ترخيص وزارة الاستثمار",
  "MISA investor license": "ترخيص المستثمر من وزارة الاستثمار",
  "MISA Entrepreneur license": "ترخيص رائد الأعمال من وزارة الاستثمار",
  "related MODON/MISA approvals": "موافقات مدن ووزارة الاستثمار ذات العلاقة",
  "Industrial license": "الترخيص الصناعي",
  "initial ZATCA/VAT registration": "التسجيل المبدئي في الزكاة والضريبة والقيمة المضافة",
  "ZATCA/VAT registration. (Secondary licensing & back-office available as add-ons.)":
    "التسجيل في الزكاة والضريبة والقيمة المضافة (التراخيص الثانوية والدعم الإداري كخدمات إضافية)",
  "Liquidation completed": "إتمام التصفية",
  "entity closure certificate": "شهادة إغلاق الكيان",
  "Document preparation": "تجهيز المستندات",
  "application submission and follow-up with the authority": "تقديم الطلب ومتابعته لدى الجهة المختصة",
  "Eligibility assessment and recommended Premium Residency pathway":
    "تقييم الأهلية وتحديد مسار الإقامة المميزة المناسب",
  "Civil Defense safety certificate for the premises": "شهادة سلامة الدفاع المدني للموقع",
  "Issued employee health certificates": "إصدار الشهادات الصحية للموظفين",
  "New Iqama (residence permit) issued for the employee": "إصدار إقامة جديدة للموظف",
  "Multi-workflow AI automations": "أتمتة متعددة المسارات بالذكاء الاصطناعي",
  "document intelligence": "معالجة ذكية للمستندات",
  "reporting dashboards": "لوحات تقارير",
  "ongoing optimization & support": "تحسين ودعم مستمر",
  "Configured WhatsApp AI agent": "وكيل واتساب ذكي جاهز للتشغيل",
  "CRM/email/calendar/document integration": "ربط مع نظام العملاء والبريد والتقويم والمستندات",
  "lead qualification, instant fixed-price quoting and automated follow-up flows":
    "تأهيل العملاء وتسعير فوري ثابت ومتابعة آلية",
};

export const toArabicDeliverable = (text) => DELIVERABLES_AR[String(text).trim()] ?? String(text).trim();
