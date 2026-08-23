// Category playbooks — the marketing angle for each service family.
//
// The first campaign failed partly because one email listed ten services at once,
// so recipients could not tell what was being offered (one read it as a job ad).
// Every pack this generator produces is about ONE service and opens on the
// trigger that makes a buyer act, not on a description of us.

export const BRAND = {
  name: "Business Partner",
  nameAr: "بزنس بارتنر",
  site: "https://businesspartner.sa",
  whatsapp: "https://wa.me/966507034157",
  phone: "0507034157",
  email: "business@businesspartnerksa.com",
  navy: "#0b1b5a",
  navyDeep: "#060f38",
  gold: "#c8973b",
  goldSoft: "#e4c687",
  paper: "#f2f4fa",
  ink: "#0b1330",
  inkSoft: "#4a5170",
  green: "#1f8f4e",
};

// pain    → the moment the buyer feels the problem
// outcome → the headline promise (what changes for them)
// steps   → ONLY used when the catalogue lists no deliverables. These describe the
//            engagement process, which is true for every service in the family —
//            never specific outputs, which would promise the wrong thing. Only 20 of
//            95 services carry real deliverables; the rest must not inherit claims
//            that belong to a different service in the same category.
// proof   → the reassurance line under the CTA
export const PLAYBOOKS = {
  "تأسيس الشركات": {
    pain: "التأسيس يتعطّل عادةً في التفاصيل: اسم مرفوض، نشاط غير مطابق، أو مستند ناقص يرجّعك للبداية.",
    outcome: "أسّس كيانك وأنت في مكانك",
    steps: ["مراجعة النشاط والمتطلبات النظامية", "تجهيز المستندات والنماذج", "التنفيذ والرفع لدى الجهة المختصة", "المتابعة حتى الإصدار والتسليم"],
    proof: "تعطينا فكرتك ونسلّمك كياناً جاهزاً للانطلاق.",
    audience: "رواد الأعمال والشركات الجديدة",
  },
  "العلاقات الحكومية": {
    pain: "الغرامة لا تأتي فجأة — تأتي لأن أحداً لم ينتبه لتاريخ انتهاء في منصة حكومية.",
    outcome: "منصاتك الحكومية تحت المراقبة يومياً",
    steps: ["مراجعة حالة ملفك على المنصة", "تجهيز المستندات المطلوبة", "التنفيذ والرفع لدى الجهة المختصة", "المتابعة حتى الإنجاز والتسليم"],
    proof: "ننبّهك قبل الموعد لا بعده.",
    audience: "المنشآت العاملة التي لديها موظفون وملفات حكومية",
  },
  "دعم الأعمال": {
    pain: "الأعمال الإدارية الصغيرة تأكل وقت الإدارة كل أسبوع، وتأجيلها يكلّف أكثر من إنجازها.",
    outcome: "أعمالك الإدارية تُنجَز عنك",
    steps: ["تحديد المتطلبات بدقة", "تجهيز المستندات والنماذج", "التنفيذ لدى الجهة المختصة", "المتابعة حتى الإصدار والتسليم"],
    proof: "أتعاب واضحة ومتابعة كاملة حتى الإنجاز.",
    audience: "الشركات الصغيرة والمتوسطة",
  },
  "الموارد البشرية": {
    pain: "ملف موظف ناقص أو عقد غير مطابق يتحوّل إلى مخالفة عند أول تفتيش.",
    outcome: "ملفات موظفيك مطابقة ومحدّثة",
    steps: ["مراجعة وضعك الحالي", "تجهيز المستندات النظامية", "التنفيذ والرفع على المنصة المختصة", "المتابعة حتى الاعتماد"],
    proof: "مراجعة أولية مجانية لوضع منشأتك الحالي.",
    audience: "مديرو الموارد البشرية وأصحاب المنشآت",
  },
  "الاستثمار الأجنبي": {
    pain: "دخول السوق السعودي يتأخر شهوراً بسبب ترتيب المستندات والاشتراطات لا بسبب القرار نفسه.",
    outcome: "دخولك للسوق السعودي بخطوات واضحة",
    steps: ["دراسة المتطلبات النظامية لنشاطك", "تجهيز الملف والمستندات", "التقديم لدى الجهة المختصة", "المتابعة حتى الإصدار"],
    proof: "نتولّى الإجراءات كاملة نيابةً عنك.",
    audience: "المستثمرون والشركات الأجنبية",
  },
  "التوظيف والاستقدام": {
    pain: "الشاغر المفتوح شهراً إضافياً يكلّف أكثر بكثير من تكلفة توظيفه.",
    outcome: "الكادر المناسب في وقت أقل",
    steps: ["تحديد الاحتياج وتوصيف الوظيفة", "تجهيز المتطلبات النظامية", "التنفيذ لدى الجهة المختصة", "المتابعة حتى الإنجاز"],
    proof: "ترشيحات مدروسة لا سِيَر مكدّسة.",
    audience: "المنشآت التي توظّف",
  },
  "العقارات": {
    pain: "الموقع الخطأ أو العقد غير المدروس يظل يكلّفك طوال مدة الإيجار.",
    outcome: "مقرّك المناسب بشروط تحميك",
    steps: ["تحديد المواصفات والميزانية", "ترشيح خيارات مطابقة", "التفاوض ومراجعة العقد", "إنهاء الإجراءات والتوثيق"],
    proof: "نمثّل مصلحتك في التفاوض.",
    audience: "الشركات الباحثة عن مقر أو توسّع",
  },
  "الإقامة المميزة": {
    pain: "الإقامة المميزة تُرفض غالباً بسبب ملف غير مرتّب لا بسبب عدم الأهلية.",
    outcome: "ملف إقامة مميزة مكتمل من أول مرة",
    steps: ["تقييم الأهلية قبل التقديم", "تجهيز الملف والمستندات", "التقديم والمتابعة", "معالجة أي ملاحظات حتى الإصدار"],
    proof: "نقيّم أهليتك قبل أن تدفع أي رسوم.",
    audience: "المقيمون والمستثمرون المؤهلون",
  },
  "الأتمتة والذكاء الاصطناعي": {
    pain: "الفريق يقضي ساعات أسبوعياً في مهام متكرّرة يمكن لنظام أن ينجزها بلا خطأ.",
    outcome: "شغل متكرر يتحوّل إلى نظام يعمل عنك",
    steps: ["حصر العملية المستهدفة", "تصميم مسار الأتمتة", "الربط والتشغيل", "المتابعة والتحسين"],
    proof: "نبدأ بعملية واحدة ونقيس أثرها قبل التوسّع.",
    audience: "الشركات التي تريد رفع كفاءة التشغيل",
  },
};

export const DEFAULT_PLAYBOOK = {
  pain: "بعض الإجراءات تبدو بسيطة حتى تبدأ فيها — ثم تكتشف أنها تحتاج وقتاً ومتابعة يومية.",
  outcome: "ننجزها عنك بأتعاب واضحة",
  steps: ["تحديد المتطلبات", "التنفيذ لدى الجهة المختصة", "المتابعة حتى الإصدار", "تسليم المخرجات"],
  proof: "أتعاب واضحة ومتابعة كاملة.",
  audience: "المنشآت في السعودية",
};

export const playbookFor = (service) =>
  PLAYBOOKS[service.categoryAr] ?? PLAYBOOKS[service.category] ?? DEFAULT_PLAYBOOK;
